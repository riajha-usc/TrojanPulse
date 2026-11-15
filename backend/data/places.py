"""Fixed places and the demo clock, shared by the generators and the services.

Coordinates are approximate (read off the OpenStreetMap graph or the campus map). Every value
here is an input a judge can change and watch the outputs move.
"""

from datetime import datetime, timedelta, timezone

# The demo always runs "now" = Friday Nov 13 2026, 11:30 PM Los Angeles time, so every rehearsal
# shows the same numbers. Leavey Library really closes at midnight on Fridays (libraries.usc.edu).
LA_TZ = timezone(timedelta(hours=-8))  # PST in November
DEMO_NOW = datetime(2026, 11, 13, 23, 30)

WALK_SPEED_M_PER_MIN = 80

# Campus spots: walk starts, Fryft/shuttle pickups and pod meeting points (all well lit).
CAMPUS = {
    "Leavey Library": (34.0221, -118.2829),
    "Doheny Library": (34.0203, -118.2838),
    "USC Village": (34.0254, -118.2852),
    "Ginsburg Hall": (34.0212, -118.2893),
}
PICKUP_SPOTS = list(CAMPUS)

MEETING_POINTS = {
    "Leavey Library north exit": (34.0221, -118.2829),
    "Doheny Library front steps": (34.0205, -118.2838),
    "USC Village central plaza": (34.0256, -118.2849),
    "Ginsburg Hall main entrance": (34.0213, -118.2891),
}

# Where students walk home to: the housing streets north and west of campus.
DESTINATIONS = {
    "Ellendale Pl & 28th St": (34.0294, -118.2888),
    "Hoover St & 28th St": (34.0292, -118.2840),
    "Hoover St & 30th St": (34.0274, -118.2840),
    "Hoover St & Adams Blvd": (34.0317, -118.2840),
    "Vermont Ave & 28th St": (34.0296, -118.2916),
    "Ellendale Pl & Adams Blvd": (34.0328, -118.2889),
}

# Places open late. Names are generic on purpose; closing time is "HH:MM" (after midnight = next day).
BUSINESSES = [
    {"id": "biz_1", "name": "Convenience store", "location": (34.0258, -118.2846), "closes": "02:00"},
    {"id": "biz_2", "name": "Late-night pizza", "location": (34.0284, -118.2841), "closes": "03:00"},
    {"id": "biz_3", "name": "Taco stand", "location": (34.0300, -118.2841), "closes": "01:00"},
    {"id": "biz_4", "name": "Gas station market", "location": (34.0318, -118.2846), "closes": "00:00"},
    {"id": "biz_5", "name": "Coffee shop", "location": (34.0252, -118.2858), "closes": "23:00"},
    {"id": "biz_6", "name": "Burger counter", "location": (34.0295, -118.2905), "closes": "01:30"},
]

# Leavey Library closing time by weekday (Mon=0). None = open 24 hours. From libraries.usc.edu, Nov 2026.
LEAVEY_CLOSES = {0: None, 1: None, 2: None, 3: None, 4: "00:00", 5: "21:00", 6: None}

# The demo stories the generators build in.
DEMO_ORIGIN = "Leavey Library"
DEMO_DESTINATION = "Ellendale Pl & 28th St"
BROKEN_LIGHT_STREET = "Ellendale Place"  # lights out on its south block, which the fastest route uses
BROKEN_LIGHT_MAX_LAT = 34.0290  # stop ~40 m short of the 28th St corner
