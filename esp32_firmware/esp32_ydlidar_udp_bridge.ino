/*
  ========================================================================================
   ROBONAV — ESP32 DevKit V1 + YDLIDAR X2 WIRELESS UDP BRIDGE
   Firmware: Reads YDLIDAR X2 binary packets over UART and streams over UDP to Ubuntu PC
  ========================================================================================

   HARDWARE WIRING (ESP32 DevKit V1 <--> YDLIDAR X2):
   --------------------------------------------------------------------------------------
   YDLIDAR X2 Pin           ESP32 DevKit V1 Pin           Notes
   --------------------------------------------------------------------------------------
   Pin 1 (Red Wire):   5V   ->  VIN (or 5V external)      Requires 5V (≥1.5A power source)
   Pin 2 (Black Wire): GND  ->  GND                       Common Ground
   Pin 3 (Yellow Wire): TX  ->  GPIO 16 (RX2)             3.3V Logic Serial Data from LiDAR
   Pin 4 (White Wire): M_CTR->  GPIO 17 (TX2)             Driven HIGH (3.3V) to spin motor
   --------------------------------------------------------------------------------------

   UDP COMMUNICATION PROTOCOL:
   - Target Laptop IP:   Configured via PC_SERVER_HOST (discover with 'ip -4 addr show')
   - Target Laptop Port: 4210 (UDP)
   - ESP32 Local Port:   4211 (UDP)
   - Framing:            Binary Header (Magic 'YD', SeqNum, Timestamp, DeviceID, Length)
  ========================================================================================
*/

#include <WiFi.h>
#include <WiFiUdp.h>
#include <HardwareSerial.h>

// ========================================================================================
// 1. CENTRAL CONFIGURATION (Adjust credentials here)
// ========================================================================================
#define DEVICE_ID             "ESP32DEVKIT-001"
#define WIFI_SSID             "ZORO"
#define WIFI_PASSWORD         "00000000"

// Laptop Server IP & Ports (Update with your laptop's current Wi-Fi IPv4 address)
#define PC_SERVER_HOST        "10.166.2.244"
#define LAPTOP_UDP_PORT       4210
#define ESP32_LOCAL_PORT      4211

// Hardware UART Pins for YDLIDAR X2
#define PIN_LIDAR_RX          16     // ESP32 GPIO 16 (RX2) <- YDLIDAR X2 TX
#define PIN_LIDAR_M_CTR       17     // ESP32 GPIO 17 (TX2) -> YDLIDAR X2 M_CTR (Motor Enable)
#define LIDAR_BAUD_RATE       115200 // YDLIDAR X2 standard baud rate

// Diagnostic Mode: Set to true to print raw hex bytes to Serial Monitor for wiring verification
#define DIAGNOSTIC_MODE_RAW_HEX false

// ========================================================================================
// 2. BINARY UDP FRAMING STRUCTURES
// ========================================================================================
#pragma pack(push, 1)

struct LidarUdpHeader {
  uint8_t  magic[2];       // 'Y', 'D' (0x59, 0x44)
  uint8_t  version;        // 0x01
  uint8_t  packet_type;    // 0x01 = LiDAR Packet, 0x02 = Diagnostic Heartbeat
  uint32_t seq_num;        // Monotonically increasing sequence number
  uint32_t timestamp_ms;   // ESP32 millis()
  char     device_id[16];  // "ESP32DEVKIT-001\0"
  uint16_t payload_len;    // Length of payload following this header
};

struct LidarDiagnosticsPayload {
  uint32_t bytes_received;
  uint32_t valid_packets;
  uint32_t checksum_errors;
  uint32_t udp_sent;
  int32_t  wifi_rssi;
  uint32_t uptime_sec;
};

#pragma pack(pop)

// ========================================================================================
// 3. GLOBAL OBJECTS & METRICS
// ========================================================================================
WiFiUDP udp;
HardwareSerial LidarSerial(2);

uint32_t packetSequence = 0;
uint32_t totalBytesReceived = 0;
uint32_t totalValidPackets = 0;
uint32_t totalChecksumErrors = 0;
uint32_t totalUdpSent = 0;

unsigned long lastDiagTime = 0;
unsigned long lastSerialLogTime = 0;
unsigned long lastLidarByteTime = 0;

// Maximum size of a single YDLIDAR X2 packet (10-byte header + up to 55 samples * 2 = 120 bytes)
#define MAX_LIDAR_PACKET_SIZE 256
uint8_t lidarPacketBuffer[MAX_LIDAR_PACKET_SIZE];

// ========================================================================================
// 4. YDLIDAR X2 MOTOR CONTROL & UART INITIALIZATION
// ========================================================================================
void initLidarHardware() {
  // Motor Control: drive M_CTR HIGH (3.3V) to spin the motor
  pinMode(PIN_LIDAR_M_CTR, OUTPUT);
  digitalWrite(PIN_LIDAR_M_CTR, HIGH);
  Serial.println("[LIDAR] M_CTR set to HIGH (Motor spinning).");

  // Initialize HardwareSerial2 on GPIO 16 (RX)
  LidarSerial.begin(LIDAR_BAUD_RATE, SERIAL_8N1, PIN_LIDAR_RX, -1);
  Serial.printf("[LIDAR] HardwareSerial2 initialized @ %d baud on GPIO %d.\n", LIDAR_BAUD_RATE, PIN_LIDAR_RX);
}

// ========================================================================================
// 5. WI-FI & UDP MANAGEMENT
// ========================================================================================
void connectWiFi() {
  Serial.printf("[WIFI] Connecting to SSID: '%s'...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 40) {
    delay(500);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Connected successfully!");
    Serial.printf("[WIFI] ESP32 IP:  %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[WIFI] RSSI:      %d dBm\n", WiFi.RSSI());
    Serial.printf("[WIFI] Target PC: %s:%d (UDP)\n", PC_SERVER_HOST, LAPTOP_UDP_PORT);

    // Bind local UDP socket
    udp.begin(ESP32_LOCAL_PORT);
    Serial.printf("[UDP] Listening locally on port %d.\n", ESP32_LOCAL_PORT);
  } else {
    Serial.println("\n[WIFI] Failed to connect. Check SSID and password.");
  }
}

// ========================================================================================
// 6. UDP TRANSMISSION HELPERS
// ========================================================================================
void sendUdpPacket(uint8_t packetType, const uint8_t* payload, uint16_t length) {
  if (WiFi.status() != WL_CONNECTED) return;

  LidarUdpHeader header;
  header.magic[0] = 'Y';
  header.magic[1] = 'D';
  header.version = 0x01;
  header.packet_type = packetType;
  header.seq_num = packetSequence++;
  header.timestamp_ms = millis();
  memset(header.device_id, 0, sizeof(header.device_id));
  strncpy(header.device_id, DEVICE_ID, sizeof(header.device_id) - 1);
  header.payload_len = length;

  udp.beginPacket(PC_SERVER_HOST, LAPTOP_UDP_PORT);
  udp.write((const uint8_t*)&header, sizeof(header));
  if (length > 0 && payload != NULL) {
    udp.write(payload, length);
  }
  udp.endPacket();
  totalUdpSent++;
}

void sendDiagnosticHeartbeat() {
  unsigned long now = millis();
  if (now - lastDiagTime < 1000) return; // 1 Hz diagnostic heartbeat
  lastDiagTime = now;

  LidarDiagnosticsPayload diag;
  diag.bytes_received = totalBytesReceived;
  diag.valid_packets = totalValidPackets;
  diag.checksum_errors = totalChecksumErrors;
  diag.udp_sent = totalUdpSent;
  diag.wifi_rssi = (WiFi.status() == WL_CONNECTED) ? WiFi.RSSI() : 0;
  diag.uptime_sec = now / 1000;

  sendUdpPacket(0x02, (const uint8_t*)&diag, sizeof(diag));
}

// ========================================================================================
// 7. YDLIDAR X2 BINARY PACKET PARSER & CHECKSUM VERIFIER
// ========================================================================================
/*
  YDLIDAR X2 Packet Structure:
  Byte 0..1:   0xAA 0x55 (Sync Header, PH = 0x55AA in uint16)
  Byte 2:      CT (Package Type: 0x00 = Point Cloud, 0x01 = Zero-Angle packet)
  Byte 3:      LSN (Sample quantity, e.g. 10 to 40)
  Byte 4..5:   FSA (Start Angle, uint16 little endian, angle = (FSA >> 1) / 64.0)
  Byte 6..7:   LSA (End Angle, uint16 little endian, angle = (LSA >> 1) / 64.0)
  Byte 8..9:   CS (Check Code, uint16 little endian)
  Byte 10..N:  Distance Samples (LSN * 2 bytes, dist_mm = Si / 4.0)

  Checksum Algorithm:
  XOR combination: 0x55AA ^ ((LSN << 8) | CT) ^ FSA ^ LSA ^ S_1 ^ S_2 ^ ... ^ S_LSN == CS
*/

bool verifyChecksum(const uint8_t* buf, int totalLength, uint8_t ct, uint8_t lsn, uint16_t fsa, uint16_t lsa, uint16_t expectedCs) {
  uint16_t calculatedCs = 0x55AA;
  calculatedCs ^= (uint16_t)ct | ((uint16_t)lsn << 8);
  calculatedCs ^= fsa;
  calculatedCs ^= lsa;

  // XOR all distance words
  int sampleBytesStart = 10;
  for (int i = 0; i < lsn; i++) {
    int idx = sampleBytesStart + 2 * i;
    if (idx + 1 < totalLength) {
      uint16_t sampleWord = (uint16_t)buf[idx] | ((uint16_t)buf[idx + 1] << 8);
      calculatedCs ^= sampleWord;
    }
  }

  return (calculatedCs == expectedCs);
}

void processLidarSerial() {
  while (LidarSerial.available() > 0) {
    lastLidarByteTime = millis();
    totalBytesReceived++;

#if DIAGNOSTIC_MODE_RAW_HEX
    uint8_t rawB = LidarSerial.read();
    Serial.printf("%02X ", rawB);
    continue;
#endif

    static int state = 0;
    static uint8_t ct = 0;
    static uint8_t lsn = 0;
    static uint16_t fsa = 0;
    static uint16_t lsa = 0;
    static uint16_t cs = 0;
    static int expectedTotalBytes = 0;
    static int byteIndex = 0;

    uint8_t b = LidarSerial.read();

    if (state == 0) {
      if (b == 0xAA) {
        lidarPacketBuffer[0] = b;
        state = 1;
      }
    } else if (state == 1) {
      if (b == 0x55) {
        lidarPacketBuffer[1] = b;
        state = 2; // Sync Header found (0xAA 0x55)
      } else {
        state = (b == 0xAA) ? 1 : 0;
      }
    } else if (state == 2) {
      ct = b;
      lidarPacketBuffer[2] = b;
      state = 3;
    } else if (state == 3) {
      lsn = b;
      lidarPacketBuffer[3] = b;
      if (lsn > 0 && lsn <= 55) {
        expectedTotalBytes = 10 + (lsn * 2);
        byteIndex = 4;
        state = 4;
      } else {
        state = 0; // Malformed sample count
      }
    } else if (state == 4) {
      fsa = b;
      lidarPacketBuffer[byteIndex++] = b;
      state = 5;
    } else if (state == 5) {
      fsa |= ((uint16_t)b << 8);
      lidarPacketBuffer[byteIndex++] = b;
      state = 6;
    } else if (state == 6) {
      lsa = b;
      lidarPacketBuffer[byteIndex++] = b;
      state = 7;
    } else if (state == 7) {
      lsa |= ((uint16_t)b << 8);
      lidarPacketBuffer[byteIndex++] = b;
      state = 8;
    } else if (state == 8) {
      cs = b;
      lidarPacketBuffer[byteIndex++] = b;
      state = 9;
    } else if (state == 9) {
      cs |= ((uint16_t)b << 8);
      lidarPacketBuffer[byteIndex++] = b;
      state = 10; // Header complete, now read distance samples
    } else if (state == 10) {
      lidarPacketBuffer[byteIndex++] = b;
      if (byteIndex >= expectedTotalBytes) {
        // Complete YDLIDAR X2 binary packet received!
        if (verifyChecksum(lidarPacketBuffer, expectedTotalBytes, ct, lsn, fsa, lsa, cs)) {
          totalValidPackets++;
          // Send validated binary LiDAR packet immediately via UDP
          sendUdpPacket(0x01, lidarPacketBuffer, expectedTotalBytes);
        } else {
          totalChecksumErrors++;
        }
        state = 0; // Reset for next packet
      }
    }
  }
}

// ========================================================================================
// 8. SERIAL LOGGING & HEALTH MONITOR (Every 2 seconds)
// ========================================================================================
void printPeriodicDiagnostics() {
  unsigned long now = millis();
  if (now - lastSerialLogTime < 2000) return;
  lastSerialLogTime = now;

  bool lidarActive = (now - lastLidarByteTime < 1000);

  Serial.println("==================================================");
  Serial.printf("[STATUS] Device: %s | Wi-Fi: %s (RSSI: %d dBm)\n",
                DEVICE_ID,
                (WiFi.status() == WL_CONNECTED) ? "CONNECTED" : "OFFLINE",
                (WiFi.status() == WL_CONNECTED) ? WiFi.RSSI() : 0);
  Serial.printf("[LIDAR]  State: %s | Bytes RX: %u | Valid Packets: %u | CRC Errors: %u\n",
                lidarActive ? "STREAMING (115200 baud)" : "NO DATA / WAITING",
                totalBytesReceived, totalValidPackets, totalChecksumErrors);
  Serial.printf("[UDP]    Target: %s:%d | Sent Datagrams: %u | Seq: #%u\n",
                PC_SERVER_HOST, LAPTOP_UDP_PORT, totalUdpSent, packetSequence);
  Serial.println("==================================================");
}

// ========================================================================================
// 9. SETUP & MAIN LOOP
// ========================================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n\n====================================================================");
  Serial.println(" ROBONAV ESP32 DevKit V1 + YDLIDAR X2 WIRELESS UDP BRIDGE");
  Serial.printf(" Device ID:      %s\n", DEVICE_ID);
  Serial.printf(" Wi-Fi Target:   %s\n", WIFI_SSID);
  Serial.printf(" Laptop Target:  %s:%d (UDP)\n", PC_SERVER_HOST, LAPTOP_UDP_PORT);
  Serial.println("====================================================================");

  // Initialize hardware and motor
  initLidarHardware();

  // Connect to Wi-Fi network
  connectWiFi();
}

void loop() {
  // Auto-reconnect Wi-Fi if connection drops
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastReconnect = 0;
    if (millis() - lastReconnect > 3000) {
      lastReconnect = millis();
      Serial.println("[WIFI] Reconnecting to Wi-Fi...");
      WiFi.reconnect();
    }
  }

  // Parse YDLIDAR X2 UART data and transmit over UDP
  processLidarSerial();

  // Send 1 Hz Diagnostic Heartbeat
  sendDiagnosticHeartbeat();

  // Print periodic health stats to Serial Monitor
  printPeriodicDiagnostics();
}
