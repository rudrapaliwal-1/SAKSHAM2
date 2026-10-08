from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    APP_NAME: str = "SAKSHAM FastAPI Service"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    API_PREFIX: str = "/api/v1"
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    DATABASE_URL: str = "postgresql://saksham:saksham_secure_pass_2026@localhost:5432/saksham_db"

    # OSRM (road routing) settings.
    # OSRM_ENABLED defaults to False so existing tests/CI keep passing without
    # a live OSRM server — when disabled, distance/route calls fall back to
    # haversine straight-line math automatically. Set true in your local
    # .env once your india-260819.osrm build is running.
    OSRM_ENABLED: bool = False
    OSRM_LOCAL_URL: str = "http://localhost:5000"
    OSRM_PUBLIC_URL: str = "https://router.project-osrm.org"
    OSRM_PROFILE: str = "driving"
    OSRM_TIMEOUT_SECONDS: float = 3.0

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
