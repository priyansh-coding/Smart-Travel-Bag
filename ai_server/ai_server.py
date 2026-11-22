"""
Smart Travel Bag — AI Analysis Service
Receives sensor snapshots and returns a security assessment.
Proposed port: 3000
Endpoint: POST /analyze
"""

import os
from datetime import datetime, timezone

from flask import Flask, request, jsonify

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
CONFIG = {
    "HOST": "0.0.0.0",
    "PORT": 3000,
    # Thresholds for AI assessment (tune during testing)
    "WEIGHT_UNEXPECTED_CHANGE_KG": 2.0,
    "DISTANCE_CLOSE_CM": 30,
}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def analyze_snapshot(data):
    """
    Analyze a sensor snapshot and return a security assessment.

    This is a rule-based prototype. In a full implementation, this could
    call a machine learning model. For now, it evaluates sensor readings
    against configurable thresholds.

    Returns dict with:
        status: "SAFE" | "WARNING" | "ALERT"
        risk_level: "low" | "medium" | "high" | "critical"
        explanation: human-readable summary
        factors: list of contributing factors
    """
    factors = []
    risk_score = 0  # Accumulates risk points

    # --- 1. Bag open while locked ---
    locked = data.get("locked")
    bag_open = data.get("bag_open")
    if locked and bag_open:
        factors.append("Bag is OPEN while LOCKED — possible forced entry")
        risk_score += 50

    # --- 2. Unauthorized RFID ---
    rfid_result = data.get("rfid_result")
    if rfid_result == "rejected":
        factors.append("Unauthorized RFID tag detected")
        risk_score += 40

    # --- 3. Movement detected ---
    movement = data.get("movement_detected")
    if movement:
        factors.append("Movement detected on bag")
        risk_score += 20
        # If bag is unlocked AND movement detected, higher risk
        if locked is False:
            factors.append("Movement with bag unlocked")
            risk_score += 15

    # --- 4. Unexpected weight change ---
    weight = data.get("weight_kg")
    if weight is not None:
        # Note: in a full system, compare against a baseline weight
        # For prototype, flag extremely low or high values
        if weight < 0:
            factors.append("Invalid weight reading (negative)")
            risk_score += 10
        elif weight > 50:
            factors.append("Unusually heavy load detected")
            risk_score += 10

    # --- 5. Distance anomaly ---
    distance = data.get("distance_cm")
    if distance is not None:
        if 0 < distance < CONFIG["DISTANCE_CLOSE_CM"]:
            factors.append(f"Object very close to bag ({distance:.1f} cm)")
            risk_score += 10

    # --- 6. GPS check ---
    gps = data.get("gps", {})
    if isinstance(gps, dict) and gps.get("valid"):
        # GPS is working — no additional risk, but note it
        pass
    elif isinstance(gps, dict) and not gps.get("valid"):
        # GPS not valid — could be indoors, not necessarily a risk
        pass

    # --- 7. Sensor health ---
    sensors = data.get("sensors", {})
    offline_sensors = [k for k, v in sensors.items() if v == "offline"]
    error_sensors = [k for k, v in sensors.items() if v == "error"]
    if error_sensors:
        factors.append(f"Sensor errors: {', '.join(error_sensors)}")
        risk_score += 5
    if offline_sensors:
        factors.append(f"Sensors offline: {', '.join(offline_sensors)}")
        risk_score += 5

    # --- Determine overall status ---
    if risk_score >= 50:
        status = "ALERT"
        risk_level = "critical" if risk_score >= 80 else "high"
    elif risk_score >= 20:
        status = "WARNING"
        risk_level = "medium"
    else:
        status = "SAFE"
        risk_level = "low"

    # Build explanation
    if not factors:
        explanation = "All sensors nominal. No security concerns detected."
    else:
        explanation = f"Detected {len(factors)} factor(s): " + "; ".join(factors[:3])
        if len(factors) > 3:
            explanation += f" (and {len(factors) - 3} more)"

    return {
        "status": status,
        "risk_level": risk_level,
        "risk_score": risk_score,
        "explanation": explanation,
        "factors": factors,
        "timestamp": now_iso(),
        "service_available": True,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    return jsonify({
        "service": "Smart Travel Bag — AI Analysis Service",
        "version": "1.0",
        "endpoints": {
            "POST /analyze": "Submit sensor snapshot for security analysis",
        },
    })


@app.route("/analyze", methods=["POST"])
def analyze():
    """
    Receive sensor snapshot and return security assessment.
    """
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({
            "status": "ERROR",
            "error": "Invalid or missing JSON payload",
            "service_available": True,
            "timestamp": now_iso(),
        }), 400

    result = analyze_snapshot(data)
    return jsonify(result)


@app.route("/health")
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "service": "ai_analysis",
        "timestamp": now_iso(),
    })


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print(f"[AI Server] Starting on {CONFIG['HOST']}:{CONFIG['PORT']}")
    print(f"[AI Server] Endpoint: POST /analyze")
    app.run(
        host=CONFIG["HOST"],
        port=CONFIG["PORT"],
        debug=False,
        threaded=True,
    )
