"""Safe routing on the street graph. Owner: Soham.

Signature agreed with Ria. Keep the name, arguments and return type; the
implementation is yours.
"""

from app.schemas import LatLng, RoutesResponse


def get_routes(origin: LatLng, destination: LatLng) -> RoutesResponse:
    """Return the safest and fastest walking routes plus hazards near them.

    Safest weighs lighting, recent incidents and foot traffic. Fastest is the
    shortest walking time. Paths follow real streets from the OpenStreetMap graph.
    """
    raise NotImplementedError("TODO(Soham)")
