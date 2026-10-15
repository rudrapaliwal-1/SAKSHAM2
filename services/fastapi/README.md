# SAKSHAM FastAPI Service

This is the FastAPI-based backend service for SAKSHAM. Decoupled from direct persistence details via the Repository pattern, it connects directly to the live PostgreSQL database for secure Authentication and Role-Based Access Control (RBAC), while using in-memory state layers for domain validations.

## Architecture

The project implements a clean domain-driven layering:

```
FastAPI Router -> Domain Services -> Repository Interfaces -> Data Adapter (SQLAlchemy/PostgreSQL & Memory)
```

- **Domain Services**: Execute validation, state machine transitions, and matching calculations. Decoupled from persistence layers.
- **Repository Abstraction**: Defined abstract interfaces (`app/repositories/interfaces.py`) enabling data mapping.
- **Pydantic Schemas**: Provides strict data serialization and validation for API requests.
- **Security & RBAC Layer**: Directly validates user sessions against PostgreSQL table `"Officer"` mapping.

## Authentication & RBAC

### JWT Authentication Flow
1. **Officer Login (`POST /api/v1/auth/login`)**: Client sends credentials (email and password). The service looks up the officer in PostgreSQL, verifies the bcrypt hash, checks that `accountStatus == 'ACTIVE'` and `verificationStatus == 'VERIFIED'`, and issues a signed JWT access token containing subject ID, role, and operational region.
2. **Authorized Actions (`GET /api/v1/auth/me`)**: Submitting endpoints with the `Authorization: Bearer <token>` header injects details of the authenticated officer.

### Role-Based Access Control (RBAC) Matrix
- **PUBLIC**: Read-only access to Incidents, Resources, Vehicles, Shelters, and Analytics.
- **OPERATOR**: Command Centre access, Incident updates, and operational timelines.
- **AUTHORITY**: Operational actions, matching execution, and allocation approvals.
- **ADMIN**: Access to System Administration and user account management.

### Regional Access Control
JWT payloads include the officer's `region` (e.g. `East Delhi`), paving the way for regional jurisdiction verification on operations:
```python
# Regional access checks
if officer.region and record.region != officer.region:
    raise HTTPException(status_code=403, detail="Operational record is outside your jurisdiction.")
```

## Local Setup & Run

1. **Navigate to the service folder**:
   ```bash
   cd services/fastapi
   ```

2. **Create and activate a virtual environment**:
   ```bash
   python -m venv .venv
   
   # Windows PowerShell:
   .\.venv\Scripts\Activate.ps1
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variable**:
   Copy `.env.example` to `.env` and fill in credentials:
   ```bash
   DATABASE_URL="postgresql://<user>:<password>@localhost:5432/saksham_db"  # placeholder credentials
   ```

5. **Launch the FastAPI app**:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

   The server will run on `http://localhost:8000`.
   Open the interactive API documentation (Swagger UI) at `http://localhost:8000/docs`.

6. **Run test suite**:
   ```bash
   pytest
   ```

## Compatibility with Express Backend
This FastAPI service is designed to co-exist alongside the existing Express + Prisma service (`services/api`). The database schemas, route payloads, response structures, and domain state-machines align exactly with the patterns defined in Backend Phases 1 and 2, facilitating a seamless gradual transition.
