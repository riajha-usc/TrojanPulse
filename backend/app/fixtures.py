"""Example data returned by the stub endpoints.

Every value here is a placeholder so the frontends can build against real
URLs from the first commit. Coordinates are approximate. Replace each stub
with real logic behind the same schema, then delete the fixture it used.
"""

from datetime import datetime, timezone

from app import schemas as s

NOW = datetime(2026, 11, 14, 8, 41, 7, tzinfo=timezone.utc)

LEAVEY = s.LatLng(lat=34.0217, lng=-118.2828)
ELLENDALE_28TH = s.LatLng(lat=34.0297, lng=-118.2915)
HOOVER_30TH = s.LatLng(lat=34.0262, lng=-118.2841)

USER = s.User(id="u_demo", email="demo@usc.edu", display_name="Demo Trojan")

SAFEST = s.RouteOption(
    kind="safest",
    path=[
        LEAVEY,
        s.LatLng(lat=34.0235, lng=-118.2841),
        HOOVER_30TH,
        s.LatLng(lat=34.0297, lng=-118.2841),
        ELLENDALE_28TH,
    ],
    minutes=14,
    distance_m=1150,
    notes=["Lit the whole way", "2 open businesses"],
)

FASTEST = s.RouteOption(
    kind="fastest",
    path=[LEAVEY, s.LatLng(lat=34.0235, lng=-118.2915), ELLENDALE_28TH],
    minutes=11,
    distance_m=930,
    notes=["1 light out", "Low foot traffic"],
)

HAZARD = s.Hazard(
    id="hz_1",
    type="light_out",
    location=s.LatLng(lat=34.0270, lng=-118.2915),
    report_count=4,
    summary="Streetlight out on Ellendale Pl, 4 reports this week.",
    updated_at=NOW,
)

ROUTES = s.RoutesResponse(origin=LEAVEY, destination=ELLENDALE_28TH, safest=SAFEST, fastest=FASTEST, hazards=[HAZARD])

POD = s.Pod(
    id="pod_1",
    members=[
        s.PodMember(user_id="u_maya", display_name="Maya R.", initials="MR"),
        s.PodMember(user_id="u_dev", display_name="Dev K.", initials="DK"),
    ],
    destination_label="Ellendale Pl & 28th St",
    meeting_point_label="Leavey Library north exit",
    meeting_point=LEAVEY,
    leaves_in_min=5,
)

WALK = s.Walk(
    id="walk_1",
    user_id=USER.id,
    status="active",
    destination_label="Ellendale Pl & 28th St",
    route=SAFEST,
    pod_id=POD.id,
    safe_phrase="red umbrella",
    started_at=NOW,
)

AUDIO_RESULT = s.AudioChunkResponse(
    transcript="Stop following me. I said stop. Red umbrella.",
    sound_label="shouting",
    sound_score=0.91,
    alert_score=0.97,
    triggered=True,
    reasons=["Safe phrase heard", "Shouting 0.91", "Sudden stop"],
)

ALERT = s.Alert(
    id="alert_1",
    walk_id=WALK.id,
    user_display_name=USER.display_name,
    status="open",
    source="voice",
    location=HOOVER_30TH,
    location_label="Hoover St near 30th St",
    transcript=AUDIO_RESULT.transcript,
    reasons=AUDIO_RESULT.reasons,
    pod_notified=2,
    contacts_notified=2,
    created_at=NOW,
)

SUMMARY = s.DashboardSummary(
    simulated=True,
    active_walks=42,
    pods_in_progress=11,
    active_hazard_reports=16,
    open_alerts=1,
    median_response_s=120,
    top_hazard_summary=HAZARD.summary,
)

HEATMAP = s.HeatmapResponse(
    window_min=60,
    points=[
        s.HeatmapPoint(location=HOOVER_30TH, intensity=0.9),
        s.HeatmapPoint(location=ELLENDALE_28TH, intensity=0.6),
        s.HeatmapPoint(location=LEAVEY, intensity=0.7),
    ],
)

FORECAST = s.ForecastResponse(
    series=[
        s.ForecastSeries(
            service="fryft",
            buckets=[
                s.ForecastBucket(label="00:00", requests=40, is_forecast=False),
                s.ForecastBucket(label="00:30", requests=58, is_forecast=False),
                s.ForecastBucket(label="01:00", requests=66, is_forecast=True),
                s.ForecastBucket(label="01:30", requests=82, is_forecast=True),
            ],
        ),
        s.ForecastSeries(
            service="shuttle",
            buckets=[
                s.ForecastBucket(label="00:00", requests=52, is_forecast=False),
                s.ForecastBucket(label="00:30", requests=30, is_forecast=False),
                s.ForecastBucket(label="01:00", requests=22, is_forecast=True),
                s.ForecastBucket(label="01:30", requests=14, is_forecast=True),
            ],
        ),
    ],
    surge_note="Fryft surge expected at 1:30 AM near Leavey Library.",
)

WAIT_TIMES = s.WaitTimesResponse(
    items=[
        s.WaitTime(location_label="Leavey Library", now_min=12, in_30_min=25),
        s.WaitTime(location_label="USC Village", now_min=8, in_30_min=14),
        s.WaitTime(location_label="Ginsburg Hall", now_min=6, in_30_min=9),
        s.WaitTime(location_label="Doheny Library", now_min=5, in_30_min=6),
    ]
)

CORRIDORS = s.CorridorsResponse(
    items=[
        s.Corridor(from_label="Leavey Library", to_label="Ellendale Pl", walks=31),
        s.Corridor(from_label="Ginsburg Hall", to_label="28th St", walks=24),
        s.Corridor(from_label="Doheny Library", to_label="Figueroa St", walks=17),
    ]
)
