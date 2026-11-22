# Pin Map — Smart Travel Bag

> **Status**: Template — Update after hardware verification.

## ESP32 DevKit V1 Pin Assignments

| Module | Function | GPIO Pin | Bus | Notes |
|--------|----------|----------|-----|-------|
| HX711 (Load Cell) | Data (DOUT) | GPIO 4 | — | |
| HX711 (Load Cell) | Clock (SCK) | GPIO 5 | — | |
| RFID RC522 | SPI CS (SS) | GPIO 15 | SPI | |
| RFID RC522 | Reset (RST) | GPIO 2 | — | |
| RFID RC522 | MOSI | GPIO 23 | SPI | Default |
| RFID RC522 | MISO | GPIO 19 | SPI | Default |
| RFID RC522 | SCK | GPIO 18 | SPI | Default |
| SG90 Servo | Signal | GPIO 13 | — | Use external 5V supply |
| Reed Switch | Signal | GPIO 12 | — | INPUT_PULLUP |
| Ultrasonic | Trigger | GPIO 25 | — | |
| Ultrasonic | Echo | GPIO 26 | — | Use voltage divider for 3.3V |
| Buzzer | Signal | GPIO 27 | — | Active or passive buzzer |
| GPS Module | RX | GPIO 16 | UART2 | GPS TX → ESP32 RX |
| GPS Module | TX | GPIO 17 | UART2 | GPS RX → ESP32 TX |
| MPU6050 | SDA | GPIO 21 | I2C | Default I2C |
| MPU6050 | SCL | GPIO 22 | I2C | Default I2C |
| OLED Display | SDA | GPIO 21 | I2C | Same bus as MPU6050 |
| OLED Display | SCL | GPIO 22 | I2C | Same bus as MPU6050 |

## I2C Addresses

| Module | Address |
|--------|---------|
| MPU6050 | 0x68 (default) or 0x69 |
| OLED (SSD1306) | 0x3C or 0x3D |

## SPI Bus (RFID RC522)

| Signal | GPIO |
|--------|------|
| MOSI | 23 |
| MISO | 19 |
| SCK | 18 |
| CS/SS | 15 |

## UART (GPS)

| Signal | GPIO |
|--------|------|
| UART2 RX | 16 |
| UART2 TX | 17 |
| Baud Rate | 9600 |

## Power Notes

- **SG90 Servo**: Use a separate regulated 5V supply. Connect the servo ground to ESP32 ground.
- **ESP32**: Power via USB or 5V pin with adequate current.
- **Ultrasonic Echo**: The HC-SR04 echo pin outputs 5V. Use a voltage divider (2x 1kΩ + 2kΩ) to reduce to 3.3V.

## Conflict Check

> Verify there are no GPIO conflicts before finalizing:
> - GPIO 0: Used by ESP32-CAM if on same board (not applicable here)
> - GPIO 2: Must be LOW at boot for ESP32 (connected to RFID RST — check if this causes boot issues)
> - GPIO 12: Has internal pull-up; may affect boot if reed switch pulls it low
> - GPIO 15: Must be LOW at boot for some ESP32 variants

**TODO**: Test boot sequence with all modules connected.
