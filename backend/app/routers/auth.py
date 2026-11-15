"""Sign-in. Owner: Ria.

Hackathon sign-in is an email check: any @usc.edu address gets a session
token. There is no password and no real USC single sign-on.
"""

from fastapi import APIRouter, HTTPException

from app.schemas import LoginRequest, LoginResponse
from app.store import store

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest) -> LoginResponse:
    email = body.email.strip().lower()
    if not email.endswith("@usc.edu") or email == "@usc.edu":
        raise HTTPException(status_code=403, detail="A @usc.edu email is required")
    token, user = store.login(email)
    return LoginResponse(token=token, user=user)
