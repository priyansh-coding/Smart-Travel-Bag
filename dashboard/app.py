"""
Smart Travel Bag — Dashboard Flask Backend
Receives telemetry from ESP32, serves dashboard, exposes API,
forwards snapshots to AI service, handles device commands (buzzer, lock).
Port: 5001
"""

import os
import time
import json
import threading
from datetime import datetime, timezone

from flask import Flask, request, jsonify, render_template

import requests as http_requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
CONFIG = {
    "DASHBOARD_HOST": "0.0.0.0",
    "DASHBOARD_PORT": int(os.environ.get("PORT", 5001)),
    "AI_SERVER_URL": os.environ.get("AI_SERVER_URL", "http://localhost:3000"),
    "AI_ANALYZE_ENDPOINT": "/analyze",
    "STALE_THRESHOLD_SECONDS": 15,
    "MAX_EVENTS": 100,
    "MAX_COMMANDS": 20,
    "ESP32_CAM_STREAM_URL": os.environ.get("ESP32_CAM_STREAM_URL", "http://192.168.1.100:81/stream"),
}

# ---------------------------------------------------------------------------
# In-memory state (thread-safe via lock)
# ---------------------------------------------------------------------------
state_lock = threading.Lock()

latest_telemetry = {}
last_update_time = None
events = []
device_online = False

SENSOR_MODULES = [
    "rfid", "servo", "hx711", "mpu6050",
    "reed_switch", "ultrasonic", "gps", "buzzer", "esp32_cam",
]
sensor_health = {s: "not_tested" for s in SENSOR_MODULES}

# Command queue: ESP32 polls this, dashboard pushes to it
command_queue = []
command_counter = 0

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def now_iso():
    return datetime.now(timezone.utc).isoformat()

def is_stale():
    if last_update_time is None:
        return True
    return (time.time() - last_update_time) > CONFIG["STALE_THRESHOLD_SECONDS"]

def add_event(event_type, message, severity="info"):
    event = {
        "type": event_type,
        "message": message,
        "severity": severity,
        "timestamp": now_iso(),
    }
    with state_lock:
        events.insert(0, event)
        if len(events) > CONFIG["MAX_EVENTS"]:
            events.pop()

def push_command(cmd_type, params=None):
    """Add a command to the queue for ESP32 to pick up."""
    global command_counter
    command_counter += 1
    cmd = {
        "id": command_counter,
        "type": cmd_type,
        "params": params or {},
        "created_at": now_iso(),
        "executed": False,
    }
    with state_lock:
        command_queue.append(cmd)
        if len(command_queue) > CONFIG["MAX_COMMANDS"]:
            command_queue.pop(0)
    return cmd

def validate_telemetry(data):
    errors = []
    cleaned = {}

    if not isinstance(data, dict):
        return None, ["Payload must be a JSON object"]

    cleaned["device_id"] = data.get("device_id", "unknown")
    cleaned["device_timestamp"] = data.get("timestamp", None)

    # Weight
    weight = data.get("weight_kg")
    if weight is not None:
        try:
            weight = float(weight)
            if weight < 0 or weight > 100:
                errors.append("weight_kg out of range (0-100)")
                weight = None
        except (ValueError, TypeError):
            errors.append("weight_kg not a valid number")
            weight = None
    cleaned["weight_kg"] = weight

    # Locked
    locked = data.get("locked")
    cleaned["locked"] = bool(locked) if locked is not None else None

    # Bag open
    bag_open = data.get("bag_open")
    cleaned["bag_open"] = bool(bag_open) if bag_open is not None else None

    # Movement
    movement = data.get("movement_detected")
    cleaned["movement_detected"] = bool(movement) if movement is not None else None

    # Distance
    distance = data.get("distance_cm")
    if distance is not None:
        try:
            distance = float(distance)
            if distance < 0 or distance > 500:
                errors.append("distance_cm out of range (0-500)")
                distance = None
        except (ValueError, TypeError):
            errors.append("distance_cm not a valid number")
            distance = None
    cleaned["distance_cm"] = distance

    # GPS
    gps = data.get("gps")
    if isinstance(gps, dict):
        gps_clean = {
            "valid": bool(gps.get("valid", False)),
            "latitude": None,
            "longitude": None,
        }
        lat = gps.get("latitude")
        lon = gps.get("longitude")
        if lat is not None and lon is not None:
            try:
                lat_f = float(lat)
                lon_f = float(lon)
                if -90 <= lat_f <= 90 and -180 <= lon_f <= 180:
                    gps_clean["latitude"] = lat_f
                    gps_clean["longitude"] = lon_f
                else:
                    errors.append("GPS coords out of range")
            except (ValueError, TypeError):
                errors.append("GPS coords not valid numbers")
        cleaned["gps"] = gps_clean
    else:
        cleaned["gps"] = {"valid": False, "latitude": None, "longitude": None}

    # Sensors
    sensors_incoming = data.get("sensors", {})
    if isinstance(sensors_incoming, dict):
        valid_states = {"online", "offline", "not_tested", "error"}
        cleaned_sensors = {}
        for key in SENSOR_MODULES:
            val = sensors_incoming.get(key, "not_tested")
            cleaned_sensors[key] = val if val in valid_states else "error"
        cleaned["sensors"] = cleaned_sensors
    else:
        cleaned["sensors"] = {s: "not_tested" for s in SENSOR_MODULES}

    # RFID
    cleaned["rfid_result"] = data.get("rfid_result")

    # Accel / tilt
    cleaned["accel"] = data.get("accel")
    cleaned["tilt"] = data.get("tilt")

    cleaned["server_received_at"] = now_iso()
    return cleaned, errors

def detect_events(old_telemetry, new_telemetry):
    if not old_telemetry:
        add_event("device", "Device connected — first telemetry received", "info")
        return

    old_open = old_telemetry.get("bag_open")
    new_open = new_telemetry.get("bag_open")
    if old_open is not None and new_open is not None and old_open != new_open:
        if new_open:
            locked = new_telemetry.get("locked")
            sev = "critical" if locked else "warning"
            add_event("security", "Bag OPENED" + (" (while locked!)" if locked else ""), sev)
        else:
            add_event("security", "Bag CLOSED", "info")

    old_move = old_telemetry.get("movement_detected")
    new_move = new_telemetry.get("movement_detected")
    if old_move is not None and new_move is not None and old_move != new_move:
        if new_move:
            add_event("security", "Movement DETECTED", "warning")
        else:
            add_event("security", "Movement stopped", "info")

    old_locked = old_telemetry.get("locked")
    new_locked = new_telemetry.get("locked")
    if old_locked is not None and new_locked is not None and old_locked != new_locked:
        if new_locked:
            add_event("security", "Bag LOCKED", "info")
        else:
            add_event("security", "Bag UNLOCKED", "warning")

    rfid_result = new_telemetry.get("rfid_result")
    if rfid_result is not None:
        old_rfid = old_telemetry.get("rfid_result")
        if rfid_result != old_rfid:
            if rfid_result == "accepted":
                add_event("security", "RFID tag ACCEPTED", "info")
            elif rfid_result == "rejected":
                add_event("security", "RFID tag REJECTED — unauthorized!", "critical")

def call_ai_service(snapshot):
    url = CONFIG["AI_SERVER_URL"] + CONFIG["AI_ANALYZE_ENDPOINT"]
    try:
        resp = http_requests.post(url, json=snapshot, timeout=5)
        if resp.status_code == 200:
            result = resp.json()
            result["timestamp"] = now_iso()
            result["service_available"] = True
            return result
        else:
            return {"service_available": False, "error": f"AI returned {resp.status_code}", "timestamp": now_iso()}
    except http_requests.exceptions.ConnectionError:
        return {"service_available": False, "error": "AI service unreachable", "timestamp": now_iso()}
    except http_requests.exceptions.Timeout:
        return {"service_available": False, "error": "AI service timeout", "timestamp": now_iso()}
    except Exception as e:
        return {"service_available": False, "error": str(e), "timestamp": now_iso()}

# ---------------------------------------------------------------------------
# Flask App
# ---------------------------------------------------------------------------
app = Flask(__name__)

@app.route("/")
def index():
    return '<meta http-equiv="refresh" content="0;url=/dashboard">'

@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")

@app.route("/api/update", methods=["POST"])
def api_update():
    global latest_telemetry, last_update_time, device_online, sensor_health

    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid JSON"}), 400

    cleaned, errors = validate_telemetry(data)
    if cleaned is None:
        return jsonify({"error": errors}), 400

    with state_lock:
        old_telemetry = latest_telemetry.copy() if latest_telemetry else {}
        latest_telemetry = cleaned
        last_update_time = time.time()
        device_online = True
        for sensor, state in cleaned.get("sensors", {}).items():
            sensor_health[sensor] = state

    detect_events(old_telemetry, cleaned)

    if errors:
        add_event("device", f"Validation warnings: {'; '.join(errors)}", "warning")

    return jsonify({"status": "ok", "received_at": cleaned["server_received_at"]})

@app.route("/api/status")
def api_status():
    with state_lock:
        stale = is_stale()
        current_online = device_online and not stale
        status = {
            "device_online": current_online,
            "stale": stale,
            "last_update": latest_telemetry.get("server_received_at") if latest_telemetry else None,
            "telemetry": latest_telemetry if latest_telemetry else {},
            "sensor_health": dict(sensor_health),
            "server_time": now_iso(),
        }
    return jsonify(status)

@app.route("/api/events")
def api_events():
    limit = request.args.get("limit", 50, type=int)
    with state_lock:
        return jsonify({"events": events[:limit]})

@app.route("/api/commands", methods=["GET"])
def api_get_commands():
    """ESP32 polls this to get pending commands."""
    with state_lock:
        pending = [cmd for cmd in command_queue if not cmd.get("executed")]
        # Mark them as dispatched
        for cmd in pending:
            cmd["executed"] = True
    return jsonify({"commands": pending})

@app.route("/api/commands/ack", methods=["POST"])
def api_ack_command():
    """ESP32 acknowledges command execution."""
    data = request.get_json(silent=True)
    if not data or "id" not in data:
        return jsonify({"error": "Missing command id"}), 400
    cmd_id = data["id"]
    with state_lock:
        for cmd in command_queue:
            if cmd["id"] == cmd_id:
                cmd["acknowledged"] = True
                cmd["ack_at"] = now_iso()
                break
    return jsonify({"status": "ok"})

@app.route("/api/buzzer", methods=["POST"])
def api_buzzer():
    """Dashboard sends buzzer command."""
    data = request.get_json(silent=True) or {}
    action = data.get("action")  # "on", "off", "beep", "pattern"
    duration_ms = data.get("duration_ms", 500)
    pattern = data.get("pattern")  # optional: "sos", "alert", "confirm"

    if action not in ("on", "off", "beep", "pattern"):
        return jsonify({"error": "Invalid action. Use: on, off, beep, pattern"}), 400

    cmd = push_command("buzzer", {
        "action": action,
        "duration_ms": duration_ms,
        "pattern": pattern,
    })

    add_event("command", f"Buzzer: {action}" + (f" ({pattern})" if pattern else ""), "info")
    return jsonify({"status": "ok", "command_id": cmd["id"]})

@app.route("/api/lock", methods=["POST"])
def api_lock():
    """Dashboard sends lock/unlock command."""
    data = request.get_json(silent=True) or {}
    action = data.get("action")  # "lock" or "unlock"

    if action not in ("lock", "unlock"):
        return jsonify({"error": "Invalid action. Use: lock, unlock"}), 400

    cmd = push_command("servo", {"action": action})
    add_event("command", f"Lock: {action}", "info")
    return jsonify({"status": "ok", "command_id": cmd["id"]})

@app.route("/api/analyze", methods=["POST"])
def api_analyze():
    with state_lock:
        if not latest_telemetry or is_stale():
            return jsonify({
                "service_available": False,
                "error": "No current telemetry",
                "timestamp": now_iso(),
            }), 400
        snapshot = latest_telemetry.copy()

    result = call_ai_service(snapshot)

    if result.get("service_available") and result.get("status") in ("WARNING", "ALERT"):
        add_event("ai_alert", f"AI: {result.get('status')} — {result.get('explanation', '')}", "warning")

    return jsonify(result)

@app.route("/api/config")
def api_config():
    return jsonify({
        "stale_threshold_seconds": CONFIG["STALE_THRESHOLD_SECONDS"],
        "esp32_cam_stream_url": CONFIG["ESP32_CAM_STREAM_URL"],
        "ai_server_url": CONFIG["AI_SERVER_URL"],
    })

# ---------------------------------------------------------------------------
# Background stale checker
# ---------------------------------------------------------------------------
def stale_checker():
    global device_online
    while True:
        time.sleep(2)
        with state_lock:
            if last_update_time and (time.time() - last_update_time) > CONFIG["STALE_THRESHOLD_SECONDS"]:
                if device_online:
                    device_online = False
                    add_event("device", "Device OFFLINE — no telemetry", "warning")

stale_thread = threading.Thread(target=stale_checker, daemon=True)
stale_thread.start()

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print(f"[Dashboard] Starting on {CONFIG['DASHBOARD_HOST']}:{CONFIG['DASHBOARD_PORT']}")
    print(f"[Dashboard] AI server: {CONFIG['AI_SERVER_URL']}{CONFIG['AI_ANALYZE_ENDPOINT']}")
    print(f"[Dashboard] Endpoints:")
    print(f"  GET  /dashboard          — UI")
    print(f"  POST /api/update         — ESP32 telemetry")
    print(f"  GET  /api/status         — Dashboard polls")
    print(f"  GET  /api/events         — Event log")
    print(f"  GET  /api/commands       — ESP32 polls commands")
    print(f"  POST /api/commands/ack   — ESP32 acks command")
    print(f"  POST /api/buzzer         — Dashboard → buzzer")
    print(f"  POST /api/lock           — Dashboard → lock")
    add_event("system", "Dashboard server started", "info")
    app.run(host=CONFIG["DASHBOARD_HOST"], port=CONFIG["DASHBOARD_PORT"], debug=False, threaded=True)
