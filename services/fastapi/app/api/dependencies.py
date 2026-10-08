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

def get_incident_service(db: Session = Depends(get_db)) -> IncidentService:
    repo = SqlAlchemyIncidentRepository(db)
    return IncidentService(repo)

def get_demand_service(db: Session = Depends(get_db)) -> DemandService:
    repo = SqlAlchemyDemandRepository(db)
    return DemandService(repo)

def get_resource_service(db: Session = Depends(get_db)) -> ResourceService:
    repo = SqlAlchemyResourceRepository(db)
    return ResourceService(repo)

def get_vehicle_service(db: Session = Depends(get_db)) -> VehicleService:
    repo = SqlAlchemyVehicleRepository(db)
    return VehicleService(repo)

def get_matching_service(db: Session = Depends(get_db)) -> MatchingService:
    demand = SqlAlchemyDemandRepository(db)
    resource = SqlAlchemyResourceRepository(db)
    return MatchingService(demand, resource)

def get_allocation_service(db: Session = Depends(get_db)) -> AllocationService:
    alloc = SqlAlchemyAllocationRepository(db)
    demand = SqlAlchemyDemandRepository(db)
    resource = SqlAlchemyResourceRepository(db)
    return AllocationService(alloc, demand, resource)

def get_dispatch_service(db: Session = Depends(get_db)) -> DispatchService:
    dispatch = SqlAlchemyDispatchRepository(db)
    alloc = SqlAlchemyAllocationRepository(db)
    vehicle = SqlAlchemyVehicleRepository(db)
    resource = SqlAlchemyResourceRepository(db)
    demand = SqlAlchemyDemandRepository(db)
    incident = SqlAlchemyIncidentRepository(db)
    return DispatchService(dispatch, alloc, vehicle, resource, demand, incident)

from app.repositories.postgres.delivery_repository import SqlAlchemyDeliveryRepository
from app.repositories.postgres.shelter_repository import SqlAlchemyShelterRepository
from app.domain.shelter.service import ShelterService

def get_delivery_service(db: Session = Depends(get_db)) -> DeliveryService:
    delivery = SqlAlchemyDeliveryRepository(db)
    dispatch = SqlAlchemyDispatchRepository(db)
    alloc = SqlAlchemyAllocationRepository(db)
    vehicle = SqlAlchemyVehicleRepository(db)
    resource = SqlAlchemyResourceRepository(db)
    demand = SqlAlchemyDemandRepository(db)
    incident = SqlAlchemyIncidentRepository(db)
    return DeliveryService(delivery, dispatch, alloc, vehicle, resource, demand, incident)

def get_shelter_service(db: Session = Depends(get_db)) -> ShelterService:
    repo = SqlAlchemyShelterRepository(db)
    return ShelterService(repo)

from app.domain.routing.service import RoutingService

def get_routing_service(db: Session = Depends(get_db)) -> RoutingService:
    dispatch = SqlAlchemyDispatchRepository(db)
    alloc = SqlAlchemyAllocationRepository(db)
    vehicle = SqlAlchemyVehicleRepository(db)
    resource = SqlAlchemyResourceRepository(db)
    demand = SqlAlchemyDemandRepository(db)
    incident = SqlAlchemyIncidentRepository(db)
    return RoutingService(dispatch, alloc, vehicle, resource, demand, incident)

