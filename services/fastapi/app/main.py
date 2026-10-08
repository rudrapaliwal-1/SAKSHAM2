from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.exceptions import SakshamException
from app.api.router import api_router

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="SAKSHAM Disaster Response and Relief Coordination Network - FastAPI Core",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN, "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom exception handler for SAKSHAM core domain exceptions
@app.exception_handler(SakshamException)
async def saksham_exception_handler(request: Request, exc: SakshamException):
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.detail
    )

# Include the central api router prefixing everything with settings.API_PREFIX (default /api/v1)
app.include_router(api_router, prefix=settings.API_PREFIX)

# Include the routing & optimization module
from app.routing.routes import router as routing_router
app.include_router(routing_router)
app.include_router(routing_router, prefix=settings.API_PREFIX)

# Separate health endpoint at root /health as requested by the user
@app.get("/health", tags=["Health"], summary="Root Health Status Check")
async def root_health():
    return {
        "status": "ok",
        "service": "saksham-fastapi",
        "version": settings.APP_VERSION
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
