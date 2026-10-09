/*
  SustainX Smart Dustbin Alert System
  ESP32 IoT Client Example
  
  Description:
  Sends a POST request to the SustainX backend when the dustbin level
  (simulated or measured via Ultrasonic sensor) reaches >= 80%.
  Device authentication is required via X-Device-Id / X-Device-Key headers.
  Generate matching credentials in the database with:
    cd server && npm run seed-city
  (or use IOT_ALLOW_PUBLIC_INGEST=true for local development only).
*/

#include <WiFi.h>
#include <HTTPClient.h>

// --- Configuration ---
const char* ssid = "Hmm";
const char* password = "password";

// Backend URL (requires device auth)
const char* serverUrl = "http://172.22.254.141:5000/api/iot/data";

// Dustbin Configuration
const char* block = "A";       // Assigned block for this ESP32
const char* binId = "NMMC-BIN-001";  // Unique ID for this specific dustbin

// Device credentials — provisioned by seed-city (see output table)
const char* deviceId = "DEV-001";
const char* apiKey = "sx-dev-key-001";

void setup() {
  Serial.begin(115200);

  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi!");
}

void loop() {
  // 1. Measure Dustbin Level (Simulated for this example)
  // Replace this with actual sensor logic (e.g., HC-SR04 Ultrasonic)
  int fillLevelPercentage = 92; // Simulated 92% full

  // Report EVERY cycle, not only when full. The backend stores each reading
  // (history/offline detection) and deduplicates overflow alerts itself via
  // cooldown + open-complaint checks, so routine readings never spam alerts.
  if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      
      // Initialize HTTP request
      http.begin(serverUrl);
      
      // Set headers
      http.addHeader("Content-Type", "application/json");
      http.addHeader("X-Device-Id", deviceId);
      http.addHeader("X-Device-Key", apiKey);

      // Prepare JSON payload with block, level, and binId
      String payload = "{\"block\":\"" + String(block) + "\", \"level\":" + String(fillLevelPercentage) + ", \"binId\":\"" + String(binId) + "\"}";

      Serial.print("Sending Alert: ");
      Serial.println(payload);

      // Send POST request
      int httpResponseCode = http.POST(payload);

      if (httpResponseCode > 0) {
        String response = http.getString();
        Serial.print("Response Code: ");
        Serial.println(httpResponseCode);
        Serial.println("Server Response: " + response);
      } else {
        Serial.print("Error on sending POST: ");
        Serial.println(httpResponseCode);
      }

      http.end();
    } else {
      Serial.println("WiFi Disconnected");
    }

  // Poll every 30 seconds to prevent spamming the server
  delay(30000); 
}

