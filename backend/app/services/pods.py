"""Pod matching. Owner: Soham."""

from typing import List

from app.schemas import LatLng, Pod


def match_pods(destination: LatLng, depart_in_min: int) -> List[Pod]:
    """Return pods heading near the destination within the departure window.

    Meeting points are lit landmarks such as library exits.
    """
    raise NotImplementedError("TODO(Soham)")
