"""
Central configuration for the routing module.
Reads from environment variables so you can point at your local
India OSRM instance in dev and something else in prod, without
touching code.
"""
import os

# Your locally-hosted OSRM server (built from india-260819.osm.pbf).
# Example: docker run -t -i -p 5000:5000 -v "$(pwd):/data" osrm/osrm-backend
#          osrm-routed --algorithm mld /data/india-260819.osrm
OSRM_LOCAL_URL = os.getenv("OSRM_LOCAL_URL", "http://localhost:5000")

# Public demo server, used only as a fallback if the local instance
# is unreachable (matches your "Public OSRM fallback" checklist item).
# NOTE: the public server has no India-specific profile guarantees and
# is rate-limited — do not rely on it for production traffic.
OSRM_PUBLIC_URL = os.getenv("OSRM_PUBLIC_URL", "https://router.project-osrm.org")

# "driving" is the only profile OSRM ships by default unless you built
# custom car/bike/foot profiles into your .osrm extract.
OSRM_PROFILE = os.getenv("OSRM_PROFILE", "driving")

# Seconds before we give up on the local server and try the fallback.
OSRM_TIMEOUT_SECONDS = float(os.getenv("OSRM_TIMEOUT_SECONDS", "5"))

# OR-Tools solver time budget (seconds). Keep this short for interactive
# dispatch requests; raise it for batch/offline optimization runs.
SOLVER_TIME_LIMIT_SECONDS = int(os.getenv("SOLVER_TIME_LIMIT_SECONDS", "10"))
