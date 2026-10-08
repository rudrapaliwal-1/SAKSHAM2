import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import router as routing_router

app = FastAPI(
    title="SAKSHAM Routing & Logistics Optimization Service",
    version="1.0.0",
    description="OSRM Road Matrix + Google OR-Tools CVRP Route Optimization Engine"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routing_router)

@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "service": "saksham-optimizer", "version": "1.0.0"}

if __name__ == "__main__":
    uvicorn.run("services.optimizer.main:app", host="0.0.0.0", port=5000, reload=True)
