/**
 * Smart Travel Bag — Main ESP32 Firmware
 * 
 * Board: ESP32 DevKit V1
 * Framework: Arduino
 * 
 * Flow:
 *   1. Read all sensors every 2 seconds
 *   2. POST telemetry JSON to Flask backend /api/update
 *   3. GET /api/commands for pending commands (buzzer, lock)
 *   4. Execute commands, POST /api/commands/ack
 * 
 * Pin Map:
 *   HX711:   DOUT=4, SCK=5
 *   MPU6050: I2C (SDA=21, SCL=22)
 *   RFID:    SPI (SS=15, RST=2, MOSI=23, MISO=19, SCK=18)
 *   Servo:   GPIO 13
 *   Reed:    GPIO 12
 *   Ultra:   TRIG=25, ECHO=26
 *   Buzzer:  GPIO 27
 *   GPS:     RX=16, TX=17 (9600 baud)
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <ESP32Servo.h>

// ─── Wi-Fi & Server (UPDATE THESE) ────────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASS     = "YOUR_WIFI_PASSWORD";
const char* SERVER_BASE   = "http://YOUR_SERVER_IP:5001";
const String DEVICE_ID    = "smart-travel-bag-01";

const unsigned long TELEMETRY_INTERVAL = 2000;   // ms
const unsigned long COMMAND_INTERVAL   = 1000;   // ms — poll for commands

// ─── Pins ─────────────────────────────────────────────────────────────
#define HX711_DOUT      4
#define HX711_SCK       5
#define SERVO_PIN       13
#define REED_PIN        12
#define ULTRA_TRIG      25
#define ULTRA_ECHO      26
#define BUZZER_PIN      27
#define GPS_RX          16
#define GPS_TX          17

// ─── MPU6050 I2C ──────────────────────────────────────────────────────
#define MPU_ADDR        0x68

// ─── State ────────────────────────────────────────────────────────────
float weight_kg = 0.0;
bool locked = false;
bool bag_open = false;
bool movement_detected = false;
float distance_cm = 0.0;
double gps_lat = 0.0, gps_lon = 0.0;
bool gps_valid = false;
String rfid_result = "";

// Sensor health
String s_rfid="not_tested", s_servo="not_tested", s_hx711="not_tested";
String s_mpu="not_tested", s_reed="not_tested", s_ultra="not_tested";
String s_gps="not_tested", s_buzzer="not_tested";

// Calibration
const float HX711_CALIBRATION = 2280.0;  // Adjust for your load cell
const float HX711_OFFSET = 0.0;

// Movement threshold
const float MOVE_THRESHOLD = 0.5;

// Last command ID processed
int lastCommandId = 0;

// Timers
unsigned long lastTelemetry = 0;
unsigned long lastCommandPoll = 0;
unsigned long buzzerUntil = 0;

// Servo
Servo lockServo;

// ─── Setup ────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n═══ Smart Travel Bag ═══");

  // Pins
  pinMode(REED_PIN, INPUT_PULLUP);
  pinMode(ULTRA_TRIG, OUTPUT);
  pinMode(ULTRA_ECHO, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // Servo
  lockServo.attach(SERVO_PIN);
  lockServo.write(0);  // Unlocked position
  s_servo = "online";

  // I2C
  Wire.begin(21, 22);

  // Buzzer test
  testBuzzer();

  // Wi-Fi
  connectWiFi();

  // Init sensors
  initHX711();
  initMPU6050();
  initGPS();

  Serial.println("═══ Ready ═══");
}

// ─── Main Loop ────────────────────────────────────────────────────────
void loop() {
  // Wi-Fi reconnect
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Reconnecting...");
    connectWiFi();
  }

  unsigned long now = millis();

  // Telemetry
  if (now - lastTelemetry >= TELEMETRY_INTERVAL) {
    lastTelemetry = now;
    readAllSensors();
    sendTelemetry();
  }

  // Command polling
  if (now - lastCommandPoll >= COMMAND_INTERVAL) {
    lastCommandPoll = now;
    pollCommands();
  }

  // Buzzer auto-off
  if (buzzerUntil > 0 && now >= buzzerUntil) {
    digitalWrite(BUZZER_PIN, LOW);
    buzzerUntil = 0;
  }
}

// ─── Wi-Fi ────────────────────────────────────────────────────────────
void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("[WiFi] Connecting");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] OK — " + WiFi.localIP().toString());
  } else {
    Serial.println("\n[WiFi] FAIL — retrying");
  }
}

// ─── Sensor Init ──────────────────────────────────────────────────────
void initHX711() {
  pinMode(HX711_DOUT, INPUT);
  pinMode(HX711_SCK, OUTPUT);
  digitalWrite(HX711_SCK, LOW);
  // Tare: read a few samples
  delay(100);
  readHX711Raw();  // discard first reading
  delay(100);
  readHX711Raw();
  s_hx711 = "online";
  Serial.println("[HX711] OK");
}

void initMPU6050() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B);  // PWR_MGMT_1
  Wire.write(0);     // Wake up
  Wire.endTransmission();
  delay(100);

  // Check if MPU responds
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x75);  // WHO_AM_I
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 1);
  if (Wire.available()) {
    uint8_t id = Wire.read();
    if (id == 0x68 || id == 0x72) {
      s_mpu = "online";
      Serial.println("[MPU6050] OK — ID=0x" + String(id, HEX));
    } else {
      s_mpu = "error";
      Serial.println("[MPU6050] Wrong ID: 0x" + String(id, HEX));
    }
  } else {
    s_mpu = "offline";
    Serial.println("[MPU6050] No response");
  }
}

void initGPS() {
  Serial2.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
  s_gps = "online";
  Serial.println("[GPS] Serial2 OK");
}

void testBuzzer() {
  // Short beep on startup
  digitalWrite(BUZZER_PIN, HIGH);
  delay(100);
  digitalWrite(BUZZER_PIN, LOW);
  s_buzzer = "online";
  Serial.println("[Buzzer] Test OK");
}

// ─── Sensor Reading ───────────────────────────────────────────────────
void readAllSensors() {
  readWeight();
  readMovement();
  readReedSwitch();
  readUltrasonic();
  readGPS();
}

// HX711
long readHX711Raw() {
  while (digitalRead(HX711_DOUT) == HIGH) delay(1);
  long val = 0;
  for (int i = 0; i < 24; i++) {
    digitalWrite(HX711_SCK, HIGH);
    delayMicroseconds(1);
    val = val << 1;
    if (digitalRead(HX711_DOUT) == HIGH) val |= 1;
    digitalWrite(HX711_SCK, LOW);
    delayMicroseconds(1);
  }
  // 25th pulse for gain=128
  digitalWrite(HX711_SCK, HIGH);
  delayMicroseconds(1);
  digitalWrite(HX711_SCK, LOW);
  delayMicroseconds(1);

  if (val & 0x800000) val |= 0xFF000000;  // Sign extend
  return val;
}

void readWeight() {
  long raw = readHX711Raw();
  weight_kg = (float)(raw - HX711_OFFSET) / HX711_CALIBRATION;
  if (weight_kg < 0) weight_kg = 0;
}

// MPU6050 movement
void readMovement() {
  if (s_mpu != "online") return;

  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);  // ACCEL_XOUT_H
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 6);

  if (Wire.available() >= 6) {
    int16_t ax = (Wire.read() << 8) | Wire.read();
    int16_t ay = (Wire.read() << 8) | Wire.read();
    int16_t az = (Wire.read() << 8) | Wire.read();

    // Normalize to g (sensitivity = 16384 for ±2g)
    float ax_g = ax / 16384.0;
    float ay_g = ay / 16384.0;
    float az_g = az / 16384.0;

    // Movement = deviation from gravity
    float magnitude = sqrt(ax_g * ax_g + ay_g * ay_g + az_g * az_g);
    movement_detected = (abs(magnitude - 1.0) > MOVE_THRESHOLD);
  }
}

// Reed switch
void readReedSwitch() {
  int val = digitalRead(REED_PIN);
  // LOW = magnet near = bag closed; HIGH = no magnet = bag open
  bag_open = (val == HIGH);
  s_reed = "online";
}

// Ultrasonic
void readUltrasonic() {
  digitalWrite(ULTRA_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(ULTRA_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(ULTRA_TRIG, LOW);

  long duration = pulseIn(ULTRA_ECHO, HIGH, 30000);
  if (duration > 0) {
    distance_cm = duration * 0.034 / 2.0;
    s_ultra = "online";
  } else {
    distance_cm = -1;
    s_ultra = "error";
  }
}

// GPS — parse NMEA
void readGPS() {
  while (Serial2.available()) {
    char c = Serial2.read();
    // Simple $GPRMC parser
    static String buffer = "";
    if (c == '\n') {
      if (buffer.startsWith("$GPRMC")) {
        parseGPRMC(buffer);
      }
      buffer = "";
    } else if (c != '\r') {
      buffer += c;
    }
  }
}

void parseGPRMC(String sentence) {
  // $GPRMC,time,status,lat,N/S,lon,E/W,...
  int commaPositions[13];
  int commaCount = 0;
  for (int i = 0; i < sentence.length() && commaCount < 13; i++) {
    if (sentence[i] == ',') {
      commaPositions[commaCount++] = i;
    }
  }

  if (commaCount < 9) return;

  String status = sentence.substring(commaPositions[2] + 1, commaPositions[3]);
  if (status == "A") {
    // Valid fix
    String latStr = sentence.substring(commaPositions[3] + 1, commaPositions[4]);
    String latDir = sentence.substring(commaPositions[4] + 1, commaPositions[5]);
    String lonStr = sentence.substring(commaPositions[5] + 1, commaPositions[6]);
    String lonDir = sentence.substring(commaPositions[6] + 1, commaPositions[7]);

    gps_lat = parseGPSCoord(latStr, latDir);
    gps_lon = parseGPSCoord(lonStr, lonDir);
    gps_valid = true;
  } else {
    gps_valid = false;
  }
}

float parseGPSCoord(String raw, String dir) {
  // Format: DDMM.MMMM
  int dotPos = raw.indexOf('.');
  if (dotPos < 2) return 0;

  int deg = raw.substring(0, dotPos - 2).toInt();
  float min = raw.substring(dotPos - 2).toFloat();
  float coord = deg + min / 60.0;

  if (dir == "S" || dir == "W") coord = -coord;
  return coord;
}

// ─── Telemetry ────────────────────────────────────────────────────────
void sendTelemetry() {
  if (WiFi.status() != WL_CONNECTED) return;

  StaticJsonDocument<1024> doc;
  doc["device_id"] = DEVICE_ID;
  doc["weight_kg"] = weight_kg;
  doc["locked"] = locked;
  doc["bag_open"] = bag_open;
  doc["movement_detected"] = movement_detected;
  doc["distance_cm"] = distance_cm;

  JsonObject gps = doc.createNestedObject("gps");
  gps["valid"] = gps_valid;
  gps["latitude"] = gps_lat;
  gps["longitude"] = gps_lon;

  JsonObject sensors = doc.createNestedObject("sensors");
  sensors["rfid"] = s_rfid;
  sensors["servo"] = s_servo;
  sensors["hx711"] = s_hx711;
  sensors["mpu6050"] = s_mpu;
  sensors["reed_switch"] = s_reed;
  sensors["ultrasonic"] = s_ultra;
  sensors["gps"] = s_gps;
  sensors["buzzer"] = s_buzzer;

  if (rfid_result != "") doc["rfid_result"] = rfid_result;

  String payload;
  serializeJson(doc, payload);

  HTTPClient http;
  http.begin(String(SERVER_BASE) + "/api/update");
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(payload);

  if (code > 0) {
    Serial.printf("[TX] %d\n", code);
  } else {
    Serial.printf("[TX] FAIL: %s\n", http.errorToString(code).c_str());
  }
  http.end();
}

// ─── Command Polling ──────────────────────────────────────────────────
void pollCommands() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(String(SERVER_BASE) + "/api/commands");
  int code = http.GET();

  if (code == 200) {
    String body = http.getString();
    StaticJsonDocument<2048> doc;
    DeserializationError err = deserializeJson(doc, body);

    if (!err) {
      JsonArray cmds = doc["commands"];
      for (JsonObject cmd : cmds) {
        int cmdId = cmd["id"];
        if (cmdId > lastCommandId) {
          executeCommand(cmd);
          lastCommandId = cmdId;
          ackCommand(cmdId);
        }
      }
    }
  }
  http.end();
}

void executeCommand(JsonObject cmd) {
  String type = cmd["type"];
  JsonObject params = cmd["params"];

  Serial.printf("[CMD] %s\n", type.c_str());

  if (type == "buzzer") {
    String action = params["action"];
    int duration = params["duration_ms"] | 500;
    String pattern = params["pattern"] | "";

    if (action == "on") {
      digitalWrite(BUZZER_PIN, HIGH);
      buzzerUntil = millis() + duration;
      Serial.println("  Buzzer ON");
    } else if (action == "off") {
      digitalWrite(BUZZER_PIN, LOW);
      buzzerUntil = 0;
      Serial.println("  Buzzer OFF");
    } else if (action == "beep") {
      digitalWrite(BUZZER_PIN, HIGH);
      delay(min(duration, 500));
      digitalWrite(BUZZER_PIN, LOW);
      Serial.println("  Buzzer BEEP");
    } else if (action == "pattern") {
      playPattern(pattern);
    }
  }
  else if (type == "servo") {
    String action = params["action"];
    if (action == "lock") {
      lockServo.write(90);
      locked = true;
      Serial.println("  LOCKED");
    } else if (action == "unlock") {
      lockServo.write(0);
      locked = false;
      Serial.println("  UNLOCKED");
    }
  }
}

void playPattern(String pattern) {
  if (pattern == "sos") {
    // ... --- ...
    for (int i = 0; i < 3; i++) { digitalWrite(BUZZER_PIN, HIGH); delay(150); digitalWrite(BUZZER_PIN, LOW); delay(100); }
    delay(200);
    for (int i = 0; i < 3; i++) { digitalWrite(BUZZER_PIN, HIGH); delay(400); digitalWrite(BUZZER_PIN, LOW); delay(100); }
    delay(200);
    for (int i = 0; i < 3; i++) { digitalWrite(BUZZER_PIN, HIGH); delay(150); digitalWrite(BUZZER_PIN, LOW); delay(100); }
  } else if (pattern == "alert") {
    for (int i = 0; i < 5; i++) { digitalWrite(BUZZER_PIN, HIGH); delay(200); digitalWrite(BUZZER_PIN, LOW); delay(200); }
  } else if (pattern == "confirm") {
    digitalWrite(BUZZER_PIN, HIGH); delay(100); digitalWrite(BUZZER_PIN, LOW);
    delay(150);
    digitalWrite(BUZZER_PIN, HIGH); delay(100); digitalWrite(BUZZER_PIN, LOW);
  }
  buzzerUntil = 0;
}

void ackCommand(int cmdId) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(String(SERVER_BASE) + "/api/commands/ack");
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["id"] = cmdId;
  String payload;
  serializeJson(doc, payload);

  http.POST(payload);
  http.end();
  Serial.printf("[ACK] cmd %d\n", cmdId);
}
