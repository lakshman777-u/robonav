/*
  ========================================================================================
   ROBONAV — STANDALONE DUAL ULTRASONIC SENSOR TEST (HC-SR04)
   Board: ESP32 DevKit V1
  ========================================================================================
   CRITICAL VOLTAGE PROTECTION WARNING:
   HC-SR04 runs on 5V. Its ECHO pin outputs 5V signals.
   ESP32 GPIO pins are 3.3V maximum.
   YOU MUST USE A VOLTAGE DIVIDER on each ECHO pin:
     HC-SR04 ECHO -> [ 1 kΩ Resistor ] -> ESP32 GPIO -> [ 2 kΩ Resistor ] -> GND
  ========================================================================================
   WIRING TABLE:
   - Front Sensor:
       VCC  -> ESP32 VIN (5V Rail)
       GND  -> ESP32 GND
       TRIG -> ESP32 GPIO 4
       ECHO -> ESP32 GPIO 18 (via 1kΩ/2kΩ voltage divider)
   - Side Sensor (Angled Left or Right):
       VCC  -> ESP32 VIN (5V Rail)
       GND  -> ESP32 GND
       TRIG -> ESP32 GPIO 5
       ECHO -> ESP32 GPIO 19 (via 1kΩ/2kΩ voltage divider)
  ========================================================================================
*/

#define PIN_FRONT_TRIG 4
#define PIN_FRONT_ECHO 18

#define PIN_SIDE_TRIG  5
#define PIN_SIDE_ECHO  19

// Maximum distance in cm (timeout = max_cm * 58 microseconds)
#define MAX_DISTANCE_CM 400
#define TIMEOUT_US (MAX_DISTANCE_CM * 58)

// Distance Thresholds in cm
#define DIST_EMERGENCY_STOP 15.0f
#define DIST_OBSTACLE       25.0f
#define DIST_CAUTION        50.0f

float readUltrasonicCm(uint8_t trigPin, uint8_t echoPin) {
  // Clear trigger
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  // Emit 10 microsecond pulse
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  // Measure pulse duration with timeout to prevent blocking
  long duration = pulseIn(echoPin, HIGH, TIMEOUT_US);
  if (duration <= 0) {
    return -1.0f; // Timeout or sensor disconnected
  }

  // Speed of sound: 343 m/s -> 0.0343 cm/us -> duration / 58.2
  float distanceCm = (float)duration / 58.2f;
  if (distanceCm < 2.0f || distanceCm > 400.0f) {
    return -1.0f; // Out of range
  }
  return distanceCm;
}

const char* getStatusString(float distCm) {
  if (distCm < 0) return "OUT OF RANGE / NO ECHO";
  if (distCm <= DIST_EMERGENCY_STOP) return "EMERGENCY STOP (<15cm)";
  if (distCm <= DIST_OBSTACLE) return "OBSTACLE DETECTED (15-25cm)";
  if (distCm <= DIST_CAUTION) return "CAUTION (25-50cm)";
  return "CLEAR (>50cm)";
}

void printAsciiBar(float distCm) {
  if (distCm < 0) {
    Serial.print("[????]");
    return;
  }
  int bars = (int)(distCm / 5.0f);
  if (bars > 20) bars = 20;
  Serial.print("[");
  for (int i = 0; i < bars; i++) Serial.print("=");
  for (int i = bars; i < 20; i++) Serial.print(" ");
  Serial.print("]");
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\n====================================================================");
  Serial.println(" ROBONAV — STANDALONE DUAL ULTRASONIC SENSOR TEST (HC-SR04)");
  Serial.println(" Front: TRIG=4, ECHO=18  |  Side: TRIG=5, ECHO=19");
  Serial.println("====================================================================");

  pinMode(PIN_FRONT_TRIG, OUTPUT);
  pinMode(PIN_FRONT_ECHO, INPUT);

  pinMode(PIN_SIDE_TRIG, OUTPUT);
  pinMode(PIN_SIDE_ECHO, INPUT);

  digitalWrite(PIN_FRONT_TRIG, LOW);
  digitalWrite(PIN_SIDE_TRIG, LOW);
}

void loop() {
  float frontDist = readUltrasonicCm(PIN_FRONT_TRIG, PIN_FRONT_ECHO);
  delay(30); // Prevent ultrasonic acoustic cross-talk
  float sideDist  = readUltrasonicCm(PIN_SIDE_TRIG, PIN_SIDE_ECHO);

  Serial.println("--------------------------------------------------------------------");
  Serial.printf("FRONT DISTANCE: %6.1f cm (%4.2f m) ", frontDist, (frontDist > 0 ? frontDist / 100.0f : 0));
  printAsciiBar(frontDist);
  Serial.printf(" -> Status: %s\n", getStatusString(frontDist));

  Serial.printf("SIDE  DISTANCE: %6.1f cm (%4.2f m) ", sideDist, (sideDist > 0 ? sideDist / 100.0f : 0));
  printAsciiBar(sideDist);
  Serial.printf(" -> Status: %s\n", getStatusString(sideDist));

  delay(200);
}
