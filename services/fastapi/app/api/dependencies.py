from fastapi import Depends, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.models import OfficerModel
from app.core.security import decode_access_token
from app.core.exceptions import SakshamException

from app.repositories.memory.incident_repository import incident_repo
from app.repositories.memory.demand_repository import demand_repo
from app.repositories.memory.resource_repository import resource_repo
from app.repositories.memory.vehicle_repository import vehicle_repo
from app.repositories.memory.allocation_repository import allocation_repo
from app.repositories.memory.dispatch_repository import dispatch_repo

from app.domain.incidents.service import IncidentService
from app.domain.demands.service import DemandService
from app.domain.resources.service import ResourceService
from app.domain.vehicles.service import VehicleService
from app.domain.matching.service import MatchingService
from app.domain.allocation.service import AllocationService
from app.domain.dispatch.service import DispatchService
from app.domain.delivery.service import DeliveryService

# JWT token bearer authentication scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def get_current_officer(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> OfficerModel:
    payload = decode_access_token(token)
    if not payload:
        raise SakshamException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="UNAUTHORIZED",
            message="Invalid or expired access token."
        )
    
    officer_id = payload.get("sub")
    if not officer_id:
        raise SakshamException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="UNAUTHORIZED",
            message="Token payload is missing subject identifier."
        )
        
    officer = db.query(OfficerModel).filter(OfficerModel.id == officer_id).first()
    if not officer:
        raise SakshamException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="UNAUTHORIZED",
            message="Officer record associated with token was not found."
        )
        
    if officer.accountStatus != "ACTIVE":
        raise SakshamException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="INACTIVE_ACCOUNT",
            message="Officer account is inactive."
        )
        
    if officer.verificationStatus != "VERIFIED":
        raise SakshamException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="UNVERIFIED_OFFICER",
            message="Officer account has not been verified."
        )
        
    return officer

class RoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_officer: OfficerModel = Depends(get_current_officer)) -> OfficerModel:
        if current_officer.role not in self.allowed_roles:
            raise SakshamException(
                status_code=status.HTTP_403_FORBIDDEN,
                code="FORBIDDEN",
                message=f"Access denied. Role '{current_officer.role}' is not authorized."
            )
        return current_officer

def require_role(roles: List[str]):
    return Depends(RoleChecker(roles))

from app.repositories.postgres.incident_repository import SqlAlchemyIncidentRepository
from app.repositories.postgres.demand_repository import SqlAlchemyDemandRepository
from app.repositories.postgres.resource_repository import SqlAlchemyResourceRepository
from app.repositories.postgres.vehicle_repository import SqlAlchemyVehicleRepository
from app.repositories.postgres.allocation_repository import SqlAlchemyAllocationRepository
from app.repositories.postgres.dispatch_repository import SqlAlchemyDispatchRepository

from sqlalchemy import text

def _check_db(db: Session) -> bool:
    try:
        db.execute(text("SELECT 1"))
        return True
    except Exception:
        return False

def get_incident_service(db: Session = Depends(get_db)) -> IncidentService:
    if _check_db(db):
        return IncidentService(SqlAlchemyIncidentRepository(db))
    return IncidentService(incident_repo)

def get_demand_service(db: Session = Depends(get_db)) -> DemandService:
    if _check_db(db):
        return DemandService(SqlAlchemyDemandRepository(db))
    return DemandService(demand_repo)

def get_resource_service(db: Session = Depends(get_db)) -> ResourceService:
    if _check_db(db):
        return ResourceService(SqlAlchemyResourceRepository(db))
    return ResourceService(resource_repo)

def get_vehicle_service(db: Session = Depends(get_db)) -> VehicleService:
    if _check_db(db):
        return VehicleService(SqlAlchemyVehicleRepository(db))
    return VehicleService(vehicle_repo)

def get_matching_service(db: Session = Depends(get_db)) -> MatchingService:
    if _check_db(db):
        return MatchingService(SqlAlchemyDemandRepository(db), SqlAlchemyResourceRepository(db))
    return MatchingService(demand_repo, resource_repo)

def get_allocation_service(db: Session = Depends(get_db)) -> AllocationService:
    if _check_db(db):
        return AllocationService(SqlAlchemyAllocationRepository(db), SqlAlchemyDemandRepository(db), SqlAlchemyResourceRepository(db))
    return AllocationService(allocation_repo, demand_repo, resource_repo)

def get_dispatch_service(db: Session = Depends(get_db)) -> DispatchService:
    if _check_db(db):
        return DispatchService(
            SqlAlchemyDispatchRepository(db),
            SqlAlchemyAllocationRepository(db),
            SqlAlchemyVehicleRepository(db),
            SqlAlchemyResourceRepository(db),
            SqlAlchemyDemandRepository(db),
            SqlAlchemyIncidentRepository(db)
        )
    return DispatchService(dispatch_repo, allocation_repo, vehicle_repo, resource_repo, demand_repo, incident_repo)


from app.repositories.postgres.delivery_repository import SqlAlchemyDeliveryRepository
from app.repositories.postgres.shelter_repository import SqlAlchemyShelterRepository
from app.domain.shelter.service import ShelterService
from app.domain.routing.service import RoutingService

def get_routing_service(db: Session = Depends(get_db)) -> RoutingService:
    if _check_db(db):
        return RoutingService(
            SqlAlchemyDispatchRepository(db),
            SqlAlchemyAllocationRepository(db),
            SqlAlchemyVehicleRepository(db),
            SqlAlchemyResourceRepository(db),
            SqlAlchemyDemandRepository(db),
            SqlAlchemyIncidentRepository(db)
        )
    return RoutingService(dispatch_repo, allocation_repo, vehicle_repo, resource_repo, demand_repo, incident_repo)

def get_delivery_service(db: Session = Depends(get_db)) -> DeliveryService:
    if _check_db(db):
        return DeliveryService(
            SqlAlchemyDeliveryRepository(db),
            SqlAlchemyDispatchRepository(db),
            SqlAlchemyAllocationRepository(db),
            SqlAlchemyVehicleRepository(db),
            SqlAlchemyResourceRepository(db),
            SqlAlchemyDemandRepository(db),
            SqlAlchemyIncidentRepository(db)
        )
    return DeliveryService(None, dispatch_repo, allocation_repo, vehicle_repo, resource_repo, demand_repo, incident_repo)

def get_shelter_service(db: Session = Depends(get_db)) -> ShelterService:
    if _check_db(db):
        return ShelterService(SqlAlchemyShelterRepository(db))
    return ShelterService(None)

