from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

router = APIRouter()

# ─────────────────────────────────────────────────────────────
# Pydantic Schemas
# ─────────────────────────────────────────────────────────────

class ClimateScenarioCreate(BaseModel):
    neighborhoodId: str
    neighborhoodName: str
    interventionType: str
    budgetInr: float
    surfaceTempDeltaC: float
    floodRiskReductionPct: float
    canopyIncreasePct: float
    peopleProtected: int
    notes: Optional[str] = ""

class ClimateScenarioResponse(ClimateScenarioCreate):
    id: str
    createdAt: str
    status: str = "PROPOSED"

class VulnerabilityWeightsConfig(BaseModel):
    hazardSeverity: float = Field(0.25, ge=0.0, le=1.0)
    populationExposure: float = Field(0.25, ge=0.0, le=1.0)
    essentialServices: float = Field(0.20, ge=0.0, le=1.0)
    resourceAvailability: float = Field(0.15, ge=0.0, le=1.0)
    demographicSensitivity: float = Field(0.15, ge=0.0, le=1.0)
    dataConfidence: float = Field(0.92, ge=0.0, le=1.0)
    updatedAt: Optional[str] = None
    appliedBy: Optional[str] = "Command Center Operator"

class VolunteerRegister(BaseModel):
    fullName: str
    email: str
    phone: str
    skills: List[str]
    serviceAreas: List[str]
    availabilityStatus: str = "ACTIVE" # ACTIVE, STANDBY, DEPLOYED

class VolunteerResponse(VolunteerRegister):
    id: str
    registeredAt: str
    hoursLogged: float = 0.0
    tasksCompleted: int = 0
    verificationBadge: str = "VERIFIED_COMMUNITY_RESPONDER"

class TaskCreate(BaseModel):
    title: str
    neighborhoodId: str
    neighborhoodName: str
    hazardType: str
    priority: str = "HIGH" # CRITICAL, HIGH, MEDIUM, LOW
    requiredSkills: List[str]
    estimatedHours: float = 3.0

class TaskUpdate(BaseModel):
    status: Optional[str] = None # OPEN, ASSIGNED, IN_PROGRESS, COMPLETED, VERIFIED
    assignedVolunteerId: Optional[str] = None
    assignedVolunteerName: Optional[str] = None
    hoursLogged: Optional[float] = None
    evidenceNotes: Optional[str] = None
    evidencePhotoUrl: Optional[str] = None
    verifiedBy: Optional[str] = None

class TaskResponse(BaseModel):
    id: str
    title: str
    neighborhoodId: str
    neighborhoodName: str
    hazardType: str
    priority: str
    status: str # OPEN, ASSIGNED, IN_PROGRESS, COMPLETED, VERIFIED
    requiredSkills: List[str]
    estimatedHours: float
    assignedVolunteerId: Optional[str] = None
    assignedVolunteerName: Optional[str] = None
    hoursLogged: float = 0.0
    evidenceNotes: Optional[str] = None
    evidencePhotoUrl: Optional[str] = None
    verifiedBy: Optional[str] = None
    verifiedAt: Optional[str] = None
    createdAt: str

class CampaignCreate(BaseModel):
    title: str
    type: str # TREE_CANOPY, COOL_ROOF, CLEANUP, WATER_SECURITY, RAINWATER_HARVESTING, AWARENESS
    targetCount: int
    unit: str
    wardId: str
    wardName: str
    targetDate: str
    maxVolunteers: int = 50

class CampaignResponse(CampaignCreate):
    id: str
    currentCount: int = 0
    volunteersJoined: int = 0
    status: str = "ACTIVE"
    progressPct: float = 0.0
    createdAt: str

class ResponsePlanCreate(BaseModel):
    neighborhoodId: str
    neighborhoodName: str
    primaryHazard: str
    riskSeverity: str
    objectives: List[str]
    requiredSupplies: List[Dict[str, Any]]
    assignedUnits: List[str]
    evacuationRouteSafe: bool = True
    approvedBy: str = "Incident Commander"

class ResponsePlanResponse(ResponsePlanCreate):
    id: str
    planReference: str
    generatedAt: str
    status: str = "DISPATCHED"

# ─────────────────────────────────────────────────────────────
# In-Memory Database Fixtures for High Reliability & Demo Mode
# ─────────────────────────────────────────────────────────────

_SCENARIOS_STORE: Dict[str, ClimateScenarioResponse] = {
    "scen-001": ClimateScenarioResponse(
        id="scen-001",
        neighborhoodId="ward-15",
        neighborhoodName="Yamuna Floodplain (Ward 15)",
        interventionType="COOL_ROOFS",
        budgetInr=1200000,
        surfaceTempDeltaC=-2.4,
        floodRiskReductionPct=0.0,
        canopyIncreasePct=0.0,
        peopleProtected=14200,
        notes="High-albedo SRI coating on 320 zinc sheet rooftops in transit settlement.",
        createdAt="2026-10-15T14:30:00Z",
        status="ACTIVE"
    ),
    "scen-002": ClimateScenarioResponse(
        id="scen-002",
        neighborhoodId="ward-22",
        neighborhoodName="Seelampur E-Waste & Textile Zone (Ward 22)",
        interventionType="WATER_ATM_KIOSKS",
        budgetInr=850000,
        surfaceTempDeltaC=-0.8,
        floodRiskReductionPct=0.0,
        canopyIncreasePct=0.0,
        peopleProtected=28500,
        notes="3 high-capacity solar chilled RO water dispensing kiosks in dense alleys.",
        createdAt="2026-10-16T09:15:00Z",
        status="APPROVED"
    )
}

_WEIGHTS_STORE = VulnerabilityWeightsConfig(
    hazardSeverity=0.25,
    populationExposure=0.25,
    essentialServices=0.20,
    resourceAvailability=0.15,
    demographicSensitivity=0.15,
    dataConfidence=0.92,
    updatedAt="2026-10-17T06:00:00Z",
    appliedBy="Chief Resilience Officer"
)

_VOLUNTEERS_STORE: Dict[str, VolunteerResponse] = {
    "vol-101": VolunteerResponse(
        id="vol-101",
        fullName="Aarav Sharma",
        email="aarav.resilience@wow-delhi.org",
        phone="+91 98110 44219",
        skills=["First Aid", "Heat Stroke Triage", "Water Distribution"],
        serviceAreas=["Yamuna Floodplain (Ward 15)", "Kashmere Gate (Ward 18)"],
        availabilityStatus="ACTIVE",
        registeredAt="2026-09-12T10:00:00Z",
        hoursLogged=48.5,
        tasksCompleted=16,
        verificationBadge="GOLD_RESPONDER"
    ),
    "vol-102": VolunteerResponse(
        id="vol-102",
        fullName="Dr. Priya Nambiar",
        email="priya.nambiar@delhi-health.org",
        phone="+91 98220 55182",
        skills=["Medical Emergency", "Hydration Clinics", "Elderly Care"],
        serviceAreas=["Seelampur (Ward 22)", "Geeta Colony (Ward 28)"],
        availabilityStatus="DEPLOYED",
        registeredAt="2026-08-04T12:00:00Z",
        hoursLogged=72.0,
        tasksCompleted=24,
        verificationBadge="MEDICAL_LEAD"
    ),
    "vol-103": VolunteerResponse(
        id="vol-103",
        fullName="Rajesh Meena",
        email="rajesh.m@civildefence.gov.in",
        phone="+91 99101 88320",
        skills=["Flood Rescue", "Inflatable Boat Pilot", "Sandbag Levee"],
        serviceAreas=["Yamuna Floodplain (Ward 15)", "Majnu Ka Tila (Ward 12)"],
        availabilityStatus="ACTIVE",
        registeredAt="2026-09-20T08:30:00Z",
        hoursLogged=34.0,
        tasksCompleted=11,
        verificationBadge="RESCUE_SPECIALIST"
    )
}

_TASKS_STORE: Dict[str, TaskResponse] = {
    "task-001": TaskResponse(
        id="task-001",
        title="Distribute 4,000L Chilled Electrolyte Water at Yamuna Pushta",
        neighborhoodId="ward-15",
        neighborhoodName="Yamuna Floodplain (Ward 15)",
        hazardType="URBAN_HEAT",
        priority="CRITICAL",
        status="IN_PROGRESS",
        requiredSkills=["Water Distribution", "Heat Stroke Triage"],
        estimatedHours=4.0,
        assignedVolunteerId="vol-101",
        assignedVolunteerName="Aarav Sharma",
        hoursLogged=2.5,
        evidenceNotes="Dispatched bowser to Pushta sector 3; 1,200 beneficiaries hydrated.",
        createdAt="2026-10-17T07:00:00Z"
    ),
    "task-002": TaskResponse(
        id="task-002",
        title="Deploy 500 Submersible Dewatering Sandbags at Monastery Culvert",
        neighborhoodId="ward-12",
        neighborhoodName="Majnu Ka Tila (Ward 12)",
        hazardType="FLOOD_SURGE",
        priority="HIGH",
        status="OPEN",
        requiredSkills=["Flood Rescue", "Sandbag Levee"],
        estimatedHours=5.0,
        assignedVolunteerId=None,
        assignedVolunteerName=None,
        hoursLogged=0.0,
        createdAt="2026-10-17T08:15:00Z"
    ),
    "task-003": TaskResponse(
        id="task-003",
        title="Inspect 180 SRI High-Reflectance Coated Roofs in Seelampur Block C",
        neighborhoodId="ward-22",
        neighborhoodName="Seelampur E-Waste & Textile Zone (Ward 22)",
        hazardType="URBAN_HEAT",
        priority="MEDIUM",
        status="VERIFIED",
        requiredSkills=["Thermal Survey", "Building Audit"],
        estimatedHours=6.0,
        assignedVolunteerId="vol-102",
        assignedVolunteerName="Dr. Priya Nambiar",
        hoursLogged=6.0,
        evidenceNotes="Infrared pyrometer verified average surface temperature reduction of 5.8°C.",
        evidencePhotoUrl="https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400",
        verifiedBy="SEWA Field Auditor R-14",
        verifiedAt="2026-10-16T17:00:00Z",
        createdAt="2026-10-16T08:00:00Z"
    )
}

_CAMPAIGNS_STORE: Dict[str, CampaignResponse] = {
    "camp-001": CampaignResponse(
        id="camp-001",
        title="Yamuna Green Buffer: 5,000 Native Riparian Trees",
        type="TREE_CANOPY",
        targetCount=5000,
        currentCount=3820,
        unit="Trees Planted & Geo-tagged",
        wardId="ward-15",
        wardName="Yamuna Floodplain (Ward 15)",
        targetDate="2026-11-15",
        maxVolunteers=120,
        volunteersJoined=94,
        status="ACTIVE",
        progressPct=76.4,
        createdAt="2026-09-01T00:00:00Z"
    ),
    "camp-002": CampaignResponse(
        id="camp-002",
        title="Cool Roofs Delhi: 2,500 Reflective Coatings in Informal Settlements",
        type="COOL_ROOF",
        targetCount=2500,
        currentCount=1680,
        unit="Rooftops Coated (SRI > 85)",
        wardId="ward-22",
        wardName="Seelampur E-Waste Zone",
        targetDate="2026-10-30",
        maxVolunteers=80,
        volunteersJoined=72,
        status="ACTIVE",
        progressPct=67.2,
        createdAt="2026-09-15T00:00:00Z"
    ),
    "camp-003": CampaignResponse(
        id="camp-003",
        title="Clean Drainage & Solid Waste Desilting Drive",
        type="CLEANUP",
        targetCount=80,
        currentCount=62,
        unit="Tons Silt & Waste Cleared",
        wardId="ward-18",
        wardName="Kashmere Gate Lowlands",
        targetDate="2026-10-25",
        maxVolunteers=60,
        volunteersJoined=58,
        status="ACTIVE",
        progressPct=77.5,
        createdAt="2026-10-01T00:00:00Z"
    )
}

_PLANS_STORE: Dict[str, ResponsePlanResponse] = {
    "plan-001": ResponsePlanResponse(
        id="plan-001",
        planReference="CRP-DEL-2026-044",
        neighborhoodId="ward-15",
        neighborhoodName="Yamuna Floodplain (Ward 15)",
        primaryHazard="URBAN_HEAT",
        riskSeverity="CRITICAL",
        objectives=[
            "Establish 3 emergency hydration stations along Pushta Road",
            "Deploy 12 volunteer heat-spotters with digital thermometers",
            "Pre-position 2 water bowsers at transit settlement entries"
        ],
        requiredSupplies=[
            {"item": "Chilled Potable Water", "quantity": 15000, "unit": "Liters"},
            {"item": "Oral Rehydration Salts (ORS)", "quantity": 2500, "unit": "Satchets"},
            {"item": "Ice Packs & Cold Compresses", "quantity": 400, "unit": "Units"}
        ],
        assignedUnits=["NDRF Quick Response Team 4", "Delhi Civil Defence Unit 9"],
        evacuationRouteSafe=True,
        approvedBy="Command Center Incident Commander",
        generatedAt="2026-10-17T06:30:00Z",
        status="DISPATCHED"
    )
}

# ─────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────

# 1. SCENARIOS
@router.get("/scenarios", response_model=List[ClimateScenarioResponse], summary="List saved intervention scenarios")
async def list_scenarios(neighborhoodId: Optional[str] = Query(None)):
    scenarios = list(_SCENARIOS_STORE.values())
    if neighborhoodId:
        scenarios = [s for s in scenarios if s.neighborhoodId == neighborhoodId]
    return scenarios

@router.post("/scenarios", response_model=ClimateScenarioResponse, status_code=status.HTTP_201_CREATED, summary="Save a climate intervention scenario")
async def create_scenario(payload: ClimateScenarioCreate):
    new_id = f"scen-{uuid.uuid4().hex[:6]}"
    scenario = ClimateScenarioResponse(
        id=new_id,
        createdAt=datetime.utcnow().isoformat() + "Z",
        status="PROPOSED",
        **payload.model_dump()
    )
    _SCENARIOS_STORE[new_id] = scenario
    return scenario

# 2. VULNERABILITY WEIGHTS
@router.get("/weights", response_model=VulnerabilityWeightsConfig, summary="Get active vulnerability score weights")
async def get_weights():
    return _WEIGHTS_STORE

@router.post("/weights", response_model=VulnerabilityWeightsConfig, summary="Update configurable vulnerability weights")
async def update_weights(payload: VulnerabilityWeightsConfig):
    global _WEIGHTS_STORE
    _WEIGHTS_STORE = payload
    _WEIGHTS_STORE.updatedAt = datetime.utcnow().isoformat() + "Z"
    return _WEIGHTS_STORE

# 3. VOLUNTEERS
@router.get("/volunteers", response_model=List[VolunteerResponse], summary="List registered climate resilience volunteers")
async def list_volunteers(status_filter: Optional[str] = Query(None)):
    vols = list(_VOLUNTEERS_STORE.values())
    if status_filter:
        vols = [v for v in vols if v.availabilityStatus == status_filter]
    return vols

@router.post("/volunteers", response_model=VolunteerResponse, status_code=status.HTTP_201_CREATED, summary="Register a new volunteer")
async def register_volunteer(payload: VolunteerRegister):
    new_id = f"vol-{uuid.uuid4().hex[:5]}"
    vol = VolunteerResponse(
        id=new_id,
        registeredAt=datetime.utcnow().isoformat() + "Z",
        hoursLogged=0.0,
        tasksCompleted=0,
        verificationBadge="VERIFIED_COMMUNITY_RESPONDER",
        **payload.model_dump()
    )
    _VOLUNTEERS_STORE[new_id] = vol
    return vol

# 4. COMMUNITY TASKS (Workflow: OPEN -> ASSIGNED -> IN_PROGRESS -> COMPLETED -> VERIFIED)
@router.get("/tasks", response_model=List[TaskResponse], summary="List community response tasks")
async def list_tasks(neighborhoodId: Optional[str] = Query(None), status_filter: Optional[str] = Query(None)):
    tasks = list(_TASKS_STORE.values())
    if neighborhoodId:
        tasks = [t for t in tasks if t.neighborhoodId == neighborhoodId]
    if status_filter:
        tasks = [t for t in tasks if t.status == status_filter]
    return tasks

@router.post("/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED, summary="Create a new community task")
async def create_task(payload: TaskCreate):
    new_id = f"task-{uuid.uuid4().hex[:6]}"
    task = TaskResponse(
        id=new_id,
        status="OPEN",
        createdAt=datetime.utcnow().isoformat() + "Z",
        **payload.model_dump()
    )
    _TASKS_STORE[new_id] = task
    return task

@router.patch("/tasks/{task_id}", response_model=TaskResponse, summary="Advance task lifecycle status or assign volunteer")
async def update_task(task_id: str, payload: TaskUpdate):
    if task_id not in _TASKS_STORE:
        raise HTTPException(status_code=404, detail="Task not found")
    
    current = _TASKS_STORE[task_id].model_dump()
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    
    # Auto timestamp verification if completed / verified
    if updates.get("status") == "VERIFIED" and not updates.get("verifiedAt"):
        updates["verifiedAt"] = datetime.utcnow().isoformat() + "Z"
        if not updates.get("verifiedBy"):
            updates["verifiedBy"] = "Lead Resilience Officer"
            
    # Update volunteer hours if provided
    if updates.get("hoursLogged") and current.get("assignedVolunteerId"):
        vol_id = current["assignedVolunteerId"]
        if vol_id in _VOLUNTEERS_STORE:
            _VOLUNTEERS_STORE[vol_id].hoursLogged += float(updates["hoursLogged"])
            if updates.get("status") in ["COMPLETED", "VERIFIED"]:
                _VOLUNTEERS_STORE[vol_id].tasksCompleted += 1
                
    current.update(updates)
    updated_obj = TaskResponse(**current)
    _TASKS_STORE[task_id] = updated_obj
    return updated_obj

# 5. CAMPAIGNS
@router.get("/campaigns", response_model=List[CampaignResponse], summary="List climate action campaigns")
async def list_campaigns():
    return list(_CAMPAIGNS_STORE.values())

@router.post("/campaigns", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED, summary="Create a climate campaign")
async def create_campaign(payload: CampaignCreate):
    new_id = f"camp-{uuid.uuid4().hex[:6]}"
    camp = CampaignResponse(
        id=new_id,
        currentCount=0,
        volunteersJoined=1,
        status="ACTIVE",
        progressPct=0.0,
        createdAt=datetime.utcnow().isoformat() + "Z",
        **payload.model_dump()
    )
    _CAMPAIGNS_STORE[new_id] = camp
    return camp

# 6. RESPONSE PLANS
@router.get("/response-plans", response_model=List[ResponsePlanResponse], summary="List generated community response plans")
async def list_response_plans():
    return list(_PLANS_STORE.values())

@router.post("/response-plans", response_model=ResponsePlanResponse, status_code=status.HTTP_201_CREATED, summary="Create and authorize a response plan")
async def create_response_plan(payload: ResponsePlanCreate):
    new_id = f"plan-{uuid.uuid4().hex[:6]}"
    ref = f"CRP-DEL-{datetime.utcnow().year}-{uuid.uuid4().hex[:4].upper()}"
    plan = ResponsePlanResponse(
        id=new_id,
        planReference=ref,
        generatedAt=datetime.utcnow().isoformat() + "Z",
        status="DISPATCHED",
        **payload.model_dump()
    )
    _PLANS_STORE[new_id] = plan
    return plan

# 7. VERIFIED IMPACT AGGREGATES
@router.get("/impact", summary="Get verified climate resilience impact metrics")
async def get_verified_impact():
    return {
        "summary": {
            "communityRequestsResolved": 142,
            "peopleAssisted": 3820,
            "waterDeliveredLiters": 84500,
            "volunteerHoursLogged": 1286.5,
            "treesPlantedAndMaintained": 3820,
            "wasteCollectedTons": 62.4,
            "coolRoofsCoated": 1680,
            "averageCampaignCompletionPct": 73.7
        },
        "verificationMethodology": {
            "verified": "Direct GPS timestamped photo & sensor telemetry audited by on-duty coordinator",
            "selfReported": "Field volunteer submission pending physical counter-check",
            "estimated": "LBNL Urban Heat Island empirical cooling curves & Delhi Master Plan 2041 catchment model"
        },
        "lastAuditTimestamp": datetime.utcnow().isoformat() + "Z"
    }
