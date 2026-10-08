from typing import List, Dict, Any
from app.repositories.interfaces import DemandRepositoryInterface, ResourceRepositoryInterface
from app.schemas.matching import MatchResponse, MatchRecommendation, ScoreBreakdown
from app.integrations.osrm_client import get_road_distance_km
from app.core.exceptions import EntityNotFoundException
from app.schemas.resource import ResourceStatus

# Centralized match weights
MATCH_WEIGHTS = {
    "COMPATIBILITY": 35.0,
    "AVAILABILITY": 25.0,
    "DISTANCE": 20.0,
    "PRIORITY": 10.0,
    "READINESS": 10.0
}

class MatchingService:
    def __init__(self, demand_repo: DemandRepositoryInterface, resource_repo: ResourceRepositoryInterface):
        self.demand_repo = demand_repo
        self.resource_repo = resource_repo

    def get_recommendations(self, demand_id: str, incident_lat: float, incident_lng: float) -> List[MatchRecommendation]:
        # 1. Retrieve the demand
        demand = self.demand_repo.get_by_id(demand_id)
        if not demand:
            demand = self.demand_repo.get_by_ref(demand_id)
            if not demand:
                raise EntityNotFoundException("DemandRequest", demand_id)

        # 2. Retrieve resources
        all_resources = self.resource_repo.list()
        
        # 3. Filter resources (eligible only)
        # Category compatibility check and status constraints
        eligible = []
        for res in all_resources:
            # - Category must match
            if res.category != demand.requestedType:
                continue
            # - Status must not be DEPLETED or RESERVED
            if res.status in [ResourceStatus.DEPLETED, ResourceStatus.RESERVED]:
                continue
            # - Quantity available - reserved must be > 0
            if res.availableQuantity - res.reservedQuantity <= 0:
                continue
            eligible.append(res)

        recommendations: List[MatchRecommendation] = []

        # 4. Score each resource
        for res in eligible:
            unreserved_qty = res.availableQuantity - res.reservedQuantity
            can_fully_fulfill = unreserved_qty >= demand.quantity

            # Calculate distance (real road distance via OSRM when enabled,
            # falls back to straight-line automatically if not)
            dist = get_road_distance_km(
                incident_lat, incident_lng,
                res.latitude, res.longitude
            )
            dist_km = round(dist, 1)

            # A. Compatibility Score (35%)
            compat_score = MATCH_WEIGHTS["COMPATIBILITY"]

            # B. Availability Score (25%)
            if can_fully_fulfill:
                avail_score = MATCH_WEIGHTS["AVAILABILITY"]
                avail_reason = f"Sufficient quantity is available: {int(unreserved_qty):,} {res.unit} (requires {int(demand.quantity):,})."
            else:
                ratio = unreserved_qty / demand.quantity
                avail_score = round(MATCH_WEIGHTS["AVAILABILITY"] * ratio, 1)
                avail_reason = f"Partial stock: {int(unreserved_qty):,} of {int(demand.quantity):,} {res.unit} available ({int(ratio * 100)}% of demand)."

            # C. Distance Score (20%)
            w_dist = MATCH_WEIGHTS["DISTANCE"]
            if dist <= 3.0:
                dist_score = w_dist
            elif dist <= 7.0:
                dist_score = round(w_dist * 0.88, 1)
            elif dist <= 12.0:
                dist_score = round(w_dist * 0.72, 1)
            elif dist <= 18.0:
                dist_score = round(w_dist * 0.56, 1)
            elif dist <= 25.0:
                dist_score = round(w_dist * 0.36, 1)
            elif dist <= 40.0:
                dist_score = round(w_dist * 0.20, 1)
            else:
                dist_score = max(0.0, round(w_dist * (1 - dist / 80.0), 1))

            # D. Priority Score (10%)
            w_prio = MATCH_WEIGHTS["PRIORITY"]
            if demand.priority == "CRITICAL":
                prio_score = w_prio
            elif demand.priority == "HIGH":
                prio_score = round(w_prio * 0.85, 1)
            elif demand.priority == "MEDIUM":
                prio_score = round(w_prio * 0.65, 1)
            else:
                prio_score = round(w_prio * 0.45, 1)

            # E. Readiness Score (10%)
            w_read = MATCH_WEIGHTS["READINESS"]
            if res.status == ResourceStatus.AVAILABLE:
                read_score = w_read
            elif res.status == ResourceStatus.LOW:
                read_score = round(w_read * 0.7, 1)
            elif res.status == ResourceStatus.IN_TRANSIT:
                read_score = round(w_read * 0.4, 1)
            else:
                read_score = 0.0

            # Final score
            final_score = round(compat_score + avail_score + dist_score + prio_score + read_score, 1)

            # Match type label
            match_type = "EXACT_MATCH" if can_fully_fulfill else "PARTIAL_MATCH"

            # Explanation components
            explanation = (
                f"Resource type matches request category '{res.category}'. "
                f"{avail_reason} "
                f"Distance is {dist_km} km. "
                f"Status: {res.status.value}."
            )

            recommendations.append(
                MatchRecommendation(
                    resourceId=res.id,
                    resourceName=res.materialName,
                    category=res.category,
                    score=final_score,
                    scoreBreakdown=ScoreBreakdown(
                        compatibility=compat_score,
                        availability=avail_score,
                        distance=dist_score,
                        priority=prio_score,
                        readiness=read_score
                    ),
                    distanceKm=dist_km,
                    explanation=explanation,
                    matchType=match_type
                )
            )

        # Sort recommendations by score descending, distance ascending
        recommendations.sort(key=lambda x: (-x.score, x.distanceKm))
        return recommendations
