/*
  ========================================================================================
   ROBONAV — STANDALONE 1.3-INCH OLED ROBOT FACE & EXPRESSIONS TEST
   Board: ESP32 DevKit V1 (or standard ESP32)
   Display: 1.3" I2C OLED (SH1106 / SSD1306, 128x64 pixels, Address: 0x3C)
  ========================================================================================
   WIRING:
   - OLED VCC -> ESP32 3V3 (or 5V/VIN if module has 3.3V regulator)
   - OLED GND -> ESP32 GND
   - OLED SDA -> ESP32 GPIO 13
   - OLED SCL -> ESP32 GPIO 14
  ========================================================================================
   Required Library (install via Arduino Library Manager):
   - "Adafruit GFX Library" by Adafruit
   - "Adafruit SSD1306" by Adafruit  (OR "Adafruit_SH1106" for SH1106 modules)
  ========================================================================================
*/

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C

#define OLED_SDA 13
#define OLED_SCL 14

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

enum RobotFaceState {
  FACE_BOOTING,
  FACE_CONNECTING,
  FACE_ONLINE,
  FACE_MAPPING,
  FACE_OBSERVATION,
  FACE_NAVIGATING,
  FACE_OBSTACLE,
  FACE_REPLANNING,
  FACE_ARRIVED,
  FACE_RETURNING_HOME,
  FACE_IDLE,
  FACE_EMERGENCY_STOP,
  FACE_NO_CONNECTION,
  NUM_FACES
};

RobotFaceState currentState = FACE_BOOTING;
unsigned long lastStateChange = 0;
int animFrame = 0;

void drawEye(int x, int y, int w, int h, bool pupilLeft, bool pupilRight, bool closed) {
  if (closed) {
    display.drawFastHLine(x, y + h / 2, w, SSD1306_WHITE);
    display.drawFastHLine(x, y + h / 2 + 1, w, SSD1306_WHITE);
    return;
  }
  display.fillRoundRect(x, y, w, h, 4, SSD1306_WHITE);
  // Pupil
  int px = x + w / 2 - 2;
  int py = y + h / 2 - 2;
  if (pupilLeft) px = x + 2;
  if (pupilRight) px = x + w - 6;
  display.fillCircle(px + 2, py + 2, 2, SSD1306_BLACK);
}

void renderFace(RobotFaceState state, int frame) {
  display.clearDisplay();

  const char* label = "";

  switch (state) {
    case FACE_BOOTING:
      label = "BOOTING...";
      drawEye(24, 12 + (frame % 3), 26, 26, false, false, false);
      drawEye(78, 12 + (frame % 3), 26, 26, false, false, false);
      display.drawFastHLine(48, 44, 32, SSD1306_WHITE);
      break;

    case FACE_CONNECTING:
      label = "CONNECTING...";
      drawEye(24, 14, 26, 24, (frame % 2 == 0), (frame % 2 != 0), false);
      drawEye(78, 14, 26, 24, (frame % 2 == 0), (frame % 2 != 0), false);
      display.drawCircle(64, 46, 4, SSD1306_WHITE);
      break;

    case FACE_ONLINE:
      label = "ONLINE";
      drawEye(24, 12, 26, 26, false, false, false);
      drawEye(78, 12, 26, 26, false, false, false);
      display.drawFastHLine(50, 44, 28, SSD1306_WHITE);
      display.drawPixel(48, 43, SSD1306_WHITE);
      display.drawPixel(79, 43, SSD1306_WHITE);
      break;

    case FACE_MAPPING:
      label = "MAPPING...";
      drawEye(24, 14, 28, 22, (frame % 4 < 2), (frame % 4 >= 2), false);
      drawEye(76, 14, 28, 22, (frame % 4 < 2), (frame % 4 >= 2), false);
      for (int x = 40; x <= 88; x += 4) {
        display.drawPixel(x, 44 + ((x / 4 + frame) % 4) - 2, SSD1306_WHITE);
      }
      break;

    case FACE_OBSERVATION:
      label = "HAPPY OBSERVATION";
      if (frame % 6 == 0) {
        drawEye(24, 12, 26, 26, false, false, true);
        drawEye(78, 12, 26, 26, false, false, true);
      } else {
        drawEye(24, 12, 26, 26, false, false, false);
        drawEye(78, 12, 26, 26, false, false, false);
      }
      display.drawFastHLine(52, 45, 24, SSD1306_WHITE);
      display.drawPixel(50, 43, SSD1306_WHITE);
      display.drawPixel(77, 43, SSD1306_WHITE);
      break;

    case FACE_NAVIGATING:
      label = "NAVIGATING";
      drawEye(26, 16, 28, 18, false, true, false);
      drawEye(74, 16, 28, 18, false, true, false);
      display.drawFastHLine(54, 44, 20, SSD1306_WHITE);
      break;

    case FACE_OBSTACLE:
      label = "OBSTACLE!";
      drawEye(20 + (frame % 2 * 2), 10, 32, 28, false, false, false);
      drawEye(76 - (frame % 2 * 2), 10, 32, 28, false, false, false);
      display.drawRect(52, 42, 24, 8, SSD1306_WHITE);
      break;

    case FACE_REPLANNING:
      label = "REROUTING...";
      drawEye(24, 14, 26, 24, (frame % 2 == 0), (frame % 2 == 1), false);
      drawEye(78, 14, 26, 24, (frame % 2 == 0), (frame % 2 == 1), false);
      display.drawFastHLine(56, 44, 16, SSD1306_WHITE);
      break;

    case FACE_ARRIVED:
      label = "ARRIVED!";
      display.drawCircle(37, 24, 12, SSD1306_WHITE);
      display.fillRect(20, 24, 34, 14, SSD1306_BLACK);
      display.drawCircle(91, 24, 12, SSD1306_WHITE);
      display.fillRect(74, 24, 34, 14, SSD1306_BLACK);
      display.drawCircle(64, 40, 10, SSD1306_WHITE);
      display.fillRect(52, 30, 24, 10, SSD1306_BLACK);
      break;

    case FACE_RETURNING_HOME:
      label = "RETURNING HOME";
      drawEye(26, 14, 26, 22, true, false, false);
      drawEye(76, 14, 26, 22, true, false, false);
      display.drawFastHLine(52, 44, 24, SSD1306_WHITE);
      break;

    case FACE_IDLE:
      label = "IDLE";
      drawEye(24, 16, 26, 18, false, false, false);
      drawEye(78, 16, 26, 18, false, false, false);
      display.drawFastHLine(54, 44, 20, SSD1306_WHITE);
      break;

    case FACE_EMERGENCY_STOP:
      label = "STOPPED";
      display.drawLine(24, 12, 50, 36, SSD1306_WHITE);
      display.drawLine(50, 12, 24, 36, SSD1306_WHITE);
      display.drawLine(78, 12, 104, 36, SSD1306_WHITE);
      display.drawLine(104, 12, 78, 36, SSD1306_WHITE);
      display.drawFastHLine(48, 46, 32, SSD1306_WHITE);
      break;

    case FACE_NO_CONNECTION:
      label = "NO CONNECTION";
      drawEye(24, 16, 26, 22, false, false, false);
      drawEye(78, 16, 26, 22, false, false, false);
      display.drawCircle(64, 52, 8, SSD1306_WHITE);
      display.fillRect(54, 52, 20, 10, SSD1306_BLACK);
      break;

    default:
      break;
  }

  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  int16_t x1, y1;
  uint16_t w, h;
  display.getTextBounds(label, 0, 54, &x1, &y1, &w, &h);
  display.setCursor((SCREEN_WIDTH - w) / 2, 54);
  display.print(label);

  display.display();
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n[OLED TEST] Initializing I2C Wire on SDA=13, SCL=14...");

  Wire.begin(OLED_SDA, OLED_SCL);

  if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println("[OLED TEST] ERROR: SSD1306 OLED not found at 0x3C!");
    Serial.println("Check wiring or try SH1106 initialization.");
  } else {
    Serial.println("[OLED TEST] OLED initialized successfully at 0x3C!");
  }

  display.clearDisplay();
  display.display();
}

void loop() {
  unsigned long now = millis();

  if (now - lastStateChange > 3500) {
    lastStateChange = now;
    currentState = (RobotFaceState)((currentState + 1) % NUM_FACES);
    Serial.printf("[OLED TEST] State changed to: %d\n", currentState);
  }

  static unsigned long lastFrameTime = 0;
  if (now - lastFrameTime > 200) {
    lastFrameTime = now;
    animFrame++;
    renderFace(currentState, animFrame);
  }
}
