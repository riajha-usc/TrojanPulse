"""Sign-in. Owner: Ria. STUB: returns a fixture user for any @usc.edu email."""

from fastapi import APIRouter, HTTPException

from app import fixtures
from app.schemas import LoginRequest, LoginResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest) -> LoginResponse:
    if not body.email.lower().endswith("@usc.edu"):
        raise HTTPException(status_code=403, detail="A @usc.edu email is required")
    # TODO(Ria): create or look up the user and issue a real token
    return LoginResponse(token="stub-token", user=fixtures.USER)
