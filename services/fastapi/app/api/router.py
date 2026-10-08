from fastapi import APIRouter
from app.api.v1 import (
    health,
    auth,
    incidents,
    demands,
    resources,
    vehicles,
    matching,
    allocations,
    dispatch,
    delivery,
    websocket,
    translation,
    shelters,
    routing
)

api_router = APIRouter()

# Mount health
api_router.include_router(health.router, prefix="/health", tags=["Health"])

# Mount auth
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])

# Mount domain resource routes
api_router.include_router(incidents.router, prefix="/incidents", tags=["Incidents"])
api_router.include_router(demands.router, prefix="/demands", tags=["Demands"])
api_router.include_router(resources.router, prefix="/resources", tags=["Resources"])
api_router.include_router(vehicles.router, prefix="/vehicles", tags=["Vehicles"])
api_router.include_router(shelters.router, prefix="/shelters", tags=["Shelters"])
api_router.include_router(matching.router, prefix="/matching", tags=["Matching"])
api_router.include_router(allocations.router, prefix="/allocations", tags=["Allocations"])
api_router.include_router(dispatch.router, prefix="/dispatch", tags=["Dispatch"])
api_router.include_router(delivery.router, prefix="/delivery", tags=["Delivery"])
api_router.include_router(translation.router, prefix="/translation", tags=["Translation"])
api_router.include_router(routing.router, prefix="/routing", tags=["Routing"])
api_router.include_router(websocket.router, prefix="/ws", tags=["WebSocket"])
