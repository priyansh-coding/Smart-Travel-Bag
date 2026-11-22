# Test Report — Smart Travel Bag

> **Status**: Template — Fill in results after hardware testing.

## Acceptance Tests

| Test ID | Test | Pass Condition | Result | Notes |
|---------|------|----------------|--------|-------|
| AT-01 | ESP32 connection | Dashboard shows controller online only after valid telemetry received; offline after timeout | ⬜ Not tested | |
| AT-02 | Weight reading | Changing physical load changes displayed calibrated weight; units and timestamp correct | ⬜ Not tested | |
| AT-03 | RFID and lock | Authorized/unauthorized RFID results and lock state match actual controller behaviour | ⬜ Not tested | |
| AT-04 | Bag-open detection | Opening/closing bag changes reed-switch status and creates expected event | ⬜ Not tested | |
| AT-05 | Movement detection | Moving bag changes MPU6050 activity state; stationary not falsely reported as movement | ⬜ Not tested | |
| AT-06 | GPS | Valid fix displays correct coordinates; invalid/no fix clearly shown without false location | ⬜ Not tested | |
| AT-07 | Ultrasonic | Distance changes when target distance changes; invalid values flagged | ⬜ Not tested | |
| AT-08 | Camera | Live stream appears when camera reachable; unavailable state shown when disconnected | ⬜ Not tested | |
| AT-09 | AI service | Actual telemetry submitted; returned result displayed; service failure not shown as SAFE | ⬜ Not tested | |
| AT-10 | Mobile layout | Cards, map, events, and camera remain usable on mobile browser | ⬜ Not tested | |
| AT-11 | No simulated data | Production/demo mode uses live device values or explicit "No live data" labels | ⬜ Not tested | |

## Hardware Verification

| Module | Tested | Pin Used | Notes |
|--------|--------|----------|-------|
| HX711 + Load Cell | ⬜ | | |
| MPU6050 | ⬜ | | |
| RFID RC522 | ⬜ | | |
| SG90 Servo | ⬜ | | |
| Reed Switch | ⬜ | | |
| Ultrasonic (HC-SR04) | ⬜ | | |
| GPS Module | ⬜ | | |
| Buzzer | ⬜ | | |
| OLED Display | ⬜ | | |
| ESP32-CAM | ⬜ | | |

## Calibration Records

| Sensor | Reference Value | Raw Value | Calibration Factor | Date |
|--------|----------------|-----------|--------------------|------|
| HX711 / Load Cell | | | | |
| Ultrasonic | | | | |
| MPU6050 | | | | |

## Integration Test Notes

### Wi-Fi Connectivity
- SSID tested: 
- Signal strength: 
- Reconnection behavior: 

### Telemetry Interval
- Configured: 2000 ms
- Actual observed: 
- Wi-Fi reliability: 

### Stale Detection
- Threshold: 10 seconds
- Observed behavior: 

### AI Service Integration
- Response time: 
- Error handling: 

## Known Limitations

1. 
2. 
3. 

## Sign-off

| Role | Name | Date |
|------|------|------|
| Tester | | |
| Reviewer | | |
