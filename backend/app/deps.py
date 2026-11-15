"""Shared request dependencies. Owner: Ria."""

import logging
from typing import Callable, Optional, TypeVar

from fastapi import Header, HTTPException

from app import fixtures
from app.schemas import User
from app.store import store

T = TypeVar("T")
log = logging.getLogger(__name__)


def current_user(authorization: Optional[str] = Header(None)) -> User:
    """The signed-in user from an "Authorization: Bearer <token>" header.

    With no header the demo user is returned, so the frontends work before
    they wire up sign-in. A header with an unknown token is rejected.
    """
    if not authorization:
        return fixtures.USER
    token = authorization.removeprefix("Bearer ").strip()
    user = store.users_by_token.get(token)
    if user is None:
        raise HTTPException(status_code=401, detail="Unknown or expired token")
    return user


def service_or_fixture(call: Callable[[], T], fallback: T) -> T:
    """Run a service function, falling back to example data when it cannot answer.

    Two cases fall back: the function is not implemented yet, or its data
    files are missing (the street graph or the generated datasets have not
    been created on this machine). The second case is logged, because it
    means the setup steps in the README were skipped.
    """
    try:
        return call()
    except NotImplementedError:
        return fallback
    except FileNotFoundError as missing:
        log.warning("Serving example data, data files are missing: %s", missing)
        return fallback
