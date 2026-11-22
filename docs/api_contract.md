# API Contract — Smart Travel Bag Dashboard

> Version 1.0 — Initial contract

## Overview

The dashboard backend exposes REST API endpoints for communication between the ESP32 device, the browser UI, and the AI analysis service.

Base URL: `http://<server-ip>:5001`

---

## Endpoints

### 1. Dashboard Page

**GET** `/dashboard`

Returns the dashboard HTML page.

**Response**: `200 OK` — HTML document

---

### 2. Receive Telemetry

**POST** `/api/update`

Receives sensor telemetry from the ESP32 device.

**Request Body** (JSON):

```json
{
  "device_id": "smart-travel-bag-01",
  "timestamp": "2026-11-22T09:30:00+05:30",
  "weight_kg": 4.25,
  "locked": true,
  "bag_open": false,
  "movement_detected": false,
  "distance_cm": 85.4,
  "gps": {
    "valid": true,
    "latitude": 20.4625,
    "longitude": 85.8828
  },
  "sensors": {
    "rfid": "online",
    "servo": "online",
    "hx711": "online",
    "mpu6050": "online",
    "reed_switch": "online",
    "ultrasonic": "online",
    "gps": "online",
    "buzzer": "online"
  },
  "rfid_result": "accepted",
  "accel": {
    "x": 0.12,
    "y": -0.05,
    "z": 9.78
  }
}
```

**Field Reference**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `device_id` | string | Recommended | Unique device identifier |
| `timestamp` | string | Optional | Device-side ISO-8601 timestamp |
| `weight_kg` | float | Optional | Calibrated weight in kilograms (0–100) |
| `locked` | boolean | Optional | Lock state (true = locked) |
| `bag_open` | boolean | Optional | Reed switch state (true = open) |
| `movement_detected` | boolean | Optional | MPU6050 activity flag |
| `distance_cm` | float | Optional | Ultrasonic distance (0–500 cm) |
| `gps` | object | Optional | GPS fix data |
| `gps.valid` | boolean | — | Whether GPS fix is valid |
| `gps.latitude` | float | — | Latitude (-90 to 90) |
| `gps.longitude` | float | — | Longitude (-180 to 180) |
| `sensors` | object | Recommended | Health status per sensor module |
| `sensors.<module>` | string | — | One of: `online`, `offline`, `not_tested`, `error` |
| `rfid_result` | string | Optional | `"accepted"` or `"rejected"` |
| `accel` | object | Optional | MPU6050 acceleration (x, y, z) |
| `tilt` | object | Optional | MPU6050 tilt data |

**Response** (JSON):

```json
{
  "status": "ok",
  "received_at": "2026-11-22T09:30:00.123456+00:00"
}
```

**Errors**: `400 Bad Request` — Invalid or missing JSON

---

### 3. Get Status

**GET** `/api/status`

Returns the latest device and sensor status. Polled by the browser.

**Response** (JSON):

```json
{
  "device_online": true,
  "stale": false,
  "last_update": "2026-11-22T09:30:00.123456+00:00",
  "last_update_stale": false,
  "telemetry": {
    "device_id": "smart-travel-bag-01",
    "weight_kg": 4.25,
    "locked": true,
    "bag_open": false,
    "movement_detected": false,
    "distance_cm": 85.4,
    "gps": {
      "valid": true,
      "latitude": 20.4625,
      "longitude": 85.8828
    },
    "sensors": {
      "rfid": "online",
      "servo": "online",
      "hx711": "online",
      "mpu6050": "online",
      "reed_switch": "online",
      "ultrasonic": "online",
      "gps": "online",
      "buzzer": "online",
      "esp32_cam": "not_tested"
    },
    "rfid_result": "accepted",
    "accel": {"x": 0.12, "y": -0.05, "z": 9.78},
    "server_received_at": "2026-11-22T09:30:00.123456+00:00"
  },
  "sensor_health": {
    "rfid": "online",
    "servo": "online",
    "hx711": "online",
    "mpu6050": "online",
    "reed_switch": "online",
    "ultrasonic": "online",
    "gps": "online",
    "buzzer": "online",
    "esp32_cam": "not_tested"
  },
  "config": {
    "stale_threshold_seconds": 10,
    "esp32_cam_stream_url": "http://192.168.1.100:81/stream"
  },
  "server_time": "2026-11-22T09:30:02.654321+00:00"
}
```

---

### 4. Get Events

**GET** `/api/events?limit=50`

Returns recent security and device events, newest first.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 50 | Maximum number of events to return |

**Response** (JSON):

```json
{
  "events": [
    {
      "type": "security",
      "message": "Bag OPENED",
      "severity": "warning",
      "timestamp": "2026-11-22T09:30:00.123456+00:00"
    },
    {
      "type": "device",
      "message": "Device connected — first telemetry received",
      "severity": "info",
      "timestamp": "2026-11-22T09:29:58.000000+00:00"
    }
  ]
}
```

**Event Types**: `device`, `security`, `ai_alert`, `system`

**Severity Levels**: `info`, `warning`, `critical`

---

### 5. Request AI Analysis

**POST** `/api/analyze`

Forwards the current sensor snapshot to the AI analysis service and returns the result.

**Request Body**: Empty or omitted (uses latest stored telemetry)

**Response** (JSON — success):

```json
{
  "status": "SAFE",
  "risk_level": "low",
  "risk_score": 0,
  "explanation": "All sensors nominal. No security concerns detected.",
  "factors": [],
  "timestamp": "2026-11-22T09:30:05.000000+00:00",
  "service_available": true
}
```

**Response** (JSON — service unavailable):

```json
{
  "service_available": false,
  "error": "AI service is unreachable (connection refused)",
  "timestamp": "2026-11-22T09:30:05.000000+00:00"
}
```

---

### 6. Get Configuration

**GET** `/api/config`

Returns safe dashboard configuration values.

**Response** (JSON):

```json
{
  "stale_threshold_seconds": 10,
  "esp32_cam_stream_url": "http://192.168.1.100:81/stream",
  "ai_server_url": "http://localhost:3000"
}
```

---

## AI Analysis Service Endpoints

Base URL: `http://<server-ip>:3000`

### POST /analyze

Receives a sensor snapshot and returns a security assessment.

**Request Body**: Same telemetry JSON as `/api/update`

**Response**: Same as the dashboard's `/api/analyze` response above.

### GET /health

Health check endpoint.

**Response**:

```json
{
  "status": "healthy",
  "service": "ai_analysis",
  "timestamp": "2026-11-22T09:30:00.000000+00:00"
}
```

---

## Status Vocabulary

| State | Meaning |
|-------|---------|
| `online` | Recent valid communication received |
| `offline` | Expected update has not arrived within stale threshold |
| `not_tested` | No successful hardware test recorded yet |
| `error` | Device or server explicitly reported a fault |

---

## Notes

- All timestamps are ISO-8601 format in UTC.
- Missing or invalid fields are preserved as `null` rather than being replaced with zero.
- The dashboard rejects malformed JSON with a 400 error.
- Sensor status values are validated against the allowed set.
- The AI service is advisory; it does not guarantee theft detection.
