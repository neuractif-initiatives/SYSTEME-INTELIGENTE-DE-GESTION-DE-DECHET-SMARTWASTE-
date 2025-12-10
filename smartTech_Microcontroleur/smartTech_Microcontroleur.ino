#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>   // v6
#include <TinyGPSPlus.h>
#include <SPIFFS.h>

// ----------------------- GPS & UART -----------------------
TinyGPSPlus gps;
HardwareSerial SerialGPS(2);   // UART2: GPS on ESP32 (RX=16, TX=17)
HardwareSerial SerialGSM(1);   // UART1: GSM (RX=26, TX=27)

// ----------------------- CONFIGURATIONS -----------------------
// WiFi & Backend
const char* WIFI_SSID = "TON_SSID";
const char* WIFI_PASSWORD = "TON_MDP";
const char* SERVER_URL = "http://TON_SERVEUR/api/poubelle";

// GSM (APN)
const char* GSM_APN  = "internet";
const char* GSM_USER = "";
const char* GSM_PASS = "";

// Pins
const int ULTRASONIC_TRIG = 5;
const int ULTRASONIC_ECHO = 18;
const int GPS_RX_PIN = 16;    // GPS TX -> ESP32 RX
const int GPS_TX_PIN = 17;    // GPS RX -> ESP32 TX
const int GSM_RX_PIN = 26;    // GSM TX -> ESP32 RX
const int GSM_TX_PIN = 27;    // GSM RX -> ESP32 TX
const int BAT_ADC_PIN = 34;   // ADC pin pour batterie

// Batterie (diviseur)
const float R_TOP = 100000.0f;
const float R_BOT = 56000.0f;
const float DIVIDER = R_BOT / (R_TOP + R_BOT);
const float ADC_REF = 3.3f;
const float ADC_COUNTS = 4095.0f;
const float ADC_CAL_FACTOR = 1.0f; // ajuste si nécessaire

// Hauteur poubelle (chargée depuis config)
int hauteurPoubelle = 0;

// Seuils
const int THRESHOLD_WARNING = 50;
const int THRESHOLD_ALERT = 80;
const int THRESHOLD_CRITICAL = 95;

// Intervalle de mesure
unsigned long lastMeasureTime = 0;
const unsigned long measureInterval = 600000UL; // 10 minutes

// ----------------------- SPIFFS & config -----------------------
struct Config {
  String device_id;
  float battery_min;     // V
  int fill_limit;        // %
  int poubelle_height;   // cm
};
Config configData;

// ----------------------- Queue en RAM (circular simple) -----------------------
#define TAILLE_FILE 20
String fileAttente[TAILLE_FILE];
int indexAjout = 0;
int indexLecture = 0;

// ----------------------- Prototypes -----------------------
void logErreur(const char* message);
void setupAll();
void setupWiFi();
bool connectWiFi();
bool envoyerDonneesViaWiFi(const String &json);
bool envoyerDonneesViaGSM(const String &json);
bool envoyerDonnees(const String &json);
void ajouterAFile(const String &json);
bool fileVide();
void traiterFile();

float readBatteryVoltage();
int voltageToPercent(float v);

long mesurerDistanceCm();
int calculerNiveauRemplissage(long distanceCm);

bool chargerConfig();
bool sauvegarderConfig();

bool lireGPS(double &lat, double &lon);
String construireJSON(const String &id, int niveau, long distanceCm, int batterie, double lat, double lon);

bool attendreReponse(String expect, unsigned long timeout = 5000);
bool initGSM();

// ----------------------- LOG ERREUR -----------------------
void logErreur(const char* message) {
  Serial.print("ERREUR: ");
  Serial.println(message);
  File f = SPIFFS.open("/erreurs.txt", FILE_APPEND);
  if (f) {
    f.println(message);
    f.close();
  }
}

// ----------------------- UTILITAIRES -----------------------
void setupAll() {
  Serial.begin(115200);
  delay(200);

  // ADC config
  analogReadResolution(12);
  #ifdef ESP32
    analogSetPinAttenuation(BAT_ADC_PIN, ADC_11db);
  #endif

  // SPIFFS init
  if (!SPIFFS.begin(true)) {
    logErreur("Montage SPIFFS échoué");
    return;
  } else {
    Serial.println("SPIFFS ok");
  }

  // Charger config si existe
  if (!chargerConfig()) {
    configData.device_id = "UNREGISTERED";
    configData.battery_min = 3.2f;
    configData.fill_limit = 80;
    configData.poubelle_height = 0;
    sauvegarderConfig();
  } else {
    hauteurPoubelle = configData.poubelle_height;
  }

  // Initialiser pins capteur ultrason
  pinMode(ULTRASONIC_TRIG, OUTPUT);
  pinMode(ULTRASONIC_ECHO, INPUT);

  // Initialiser GPS UART
  SerialGPS.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  // Initialiser GSM UART
  SerialGSM.begin(115200, SERIAL_8N1, GSM_RX_PIN, GSM_TX_PIN);

  // Connexion WiFi
  setupWiFi();

  Serial.println("Setup terminé.");
}

void setupWiFi() {
  WiFi.mode(WIFI_STA);
  connectWiFi();
}

bool connectWiFi() {
  Serial.printf("Connexion WiFi %s...\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int trials = 0;
  while (WiFi.status() != WL_CONNECTED && trials < 20) {
    delay(500);
    Serial.print(".");
    trials++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("\nWiFi connecté, IP: ");
    Serial.println(WiFi.localIP());
    return true;
  } else {
    Serial.println("\nWiFi non connecté.");
    return false;
  }
}

// ----------------------- BATTERIE -----------------------
float readBatteryVoltage() {
  long sum = 0;
  const int N = 8;
  for (int i = 0; i < N; i++) {
    sum += analogRead(BAT_ADC_PIN);
    delay(5);
  }
  float avg = sum / (float)N;
  float tension_adc = (avg / ADC_COUNTS) * ADC_REF * ADC_CAL_FACTOR;
  float batteryVoltage = tension_adc / DIVIDER;
  return batteryVoltage;
}

int voltageToPercent(float v) {
  if (v >= 4.20f) return 100;
  if (v >= 4.15f) return 95;
  if (v >= 4.08f) return 90;
  if (v >= 4.00f) return 80;
  if (v >= 3.92f) return 70;
  if (v >= 3.85f) return 60;
  if (v >= 3.78f) return 50;
  if (v >= 3.70f) return 40;
  if (v >= 3.62f) return 30;
  if (v >= 3.50f) return 20;
  if (v >= 3.40f) return 10;
  return 0;
}

// ----------------------- ULTRASONIC -----------------------
long mesurerDistanceCm() {
  digitalWrite(ULTRASONIC_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(ULTRASONIC_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(ULTRASONIC_TRIG, LOW);

  long duree = pulseIn(ULTRASONIC_ECHO, HIGH, 30000); // timeout 30ms
  if (duree <= 0) return -1;
  float distance = (duree * 0.0343f) / 2.0f;
  return (long)distance;
}

int calculerNiveauRemplissage(long distanceCm) {
  if (hauteurPoubelle <= 0) return -1; // non configurée
  long hauteur_libre = distanceCm;
  if (hauteur_libre < 0) hauteur_libre = 0;
  if (hauteur_libre > hauteurPoubelle) hauteur_libre = hauteurPoubelle;
  int niveau = 100 - ((hauteur_libre * 100) / hauteurPoubelle);
  if (niveau < 0) niveau = 0;
  if (niveau > 100) niveau = 100;
  return niveau;
}

// ----------------------- GPS -----------------------
bool lireGPS(double &lat, double &lon) {
  unsigned long start = millis();
  while (millis() - start < 1000) { // 1 seconde max
    while (SerialGPS.available() > 0) {
      gps.encode(SerialGPS.read());
    }
    if (gps.location.isValid()) {
      lat = gps.location.lat();
      lon = gps.location.lng();
      return true;
    }
  }
  return false;
}

// ----------------------- JSON -----------------------
String construireJSON(const String &id, int niveau, long distanceCm, int batterie, double lat, double lon) {
  StaticJsonDocument<512> doc;
  doc["bin_id"] = id;
  doc["level"] = niveau;
  doc["distance_cm"] = distanceCm;
  doc["battery"] = batterie;

  if (!isnan(lat) && !isnan(lon) && lat != 0.0 && lon != 0.0) {
    JsonObject g = doc.createNestedObject("gps");
    g["lat"] = lat;
    g["lon"] = lon;
  }

  doc["client_time_ms"] = millis();

  String out;
  serializeJson(doc, out);
  return out;
}

// ----------------------- SPIFFS config -----------------------
bool chargerConfig() {
  if (!SPIFFS.exists("/config.json")) return false;
  File f = SPIFFS.open("/config.json", "r");
  if (!f) return false;

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, f);
  f.close();
  if (err) return false;

  // Safe ArduinoJson v6 reads
  configData.device_id       = doc.containsKey("device_id") ? doc["device_id"].as<String>() : "";
  configData.battery_min     = doc.containsKey("battery_min") ? doc["battery_min"].as<float>() : 3.2f;
  configData.fill_limit      = doc.containsKey("fill_limit") ? doc["fill_limit"].as<int>() : 80;
  configData.poubelle_height = doc.containsKey("poubelle_height") ? doc["poubelle_height"].as<int>() : 0;

  return true;
}

bool sauvegarderConfig() {
  File f = SPIFFS.open("/config.json", "w");
  if (!f) return false;

  StaticJsonDocument<256> doc;
  doc["device_id"] = configData.device_id;
  doc["battery_min"] = configData.battery_min;
  doc["fill_limit"] = configData.fill_limit;
  doc["poubelle_height"] = configData.poubelle_height;

  serializeJson(doc, f);
  f.close();
  return true;
}

// ----------------------- Queue -----------------------
void ajouterAFile(const String &json) {
  int next = (indexAjout + 1) % TAILLE_FILE;
  if (next == indexLecture) {
    Serial.println("⚠ File pleine, impossible d'ajouter !");
    logErreur("File pleine");
    return;
  }
  fileAttente[indexAjout] = json;
  indexAjout = next;
  Serial.println("🟡 Message ajouté à la file d'attente.");
}

bool fileVide() {
  return indexAjout == indexLecture;
}

void traiterFile() {
  if (fileVide()) return;
  Serial.println("📤 Tentative d'envoi de la file...");
  int essais = 0;
  while (!fileVide() && essais < 3) {
    String json = fileAttente[indexLecture];
    bool ok = envoyerDonnees(json); // WiFi préféré
    if (ok) {
      Serial.println("✔ Message envoyé depuis la file !");
      indexLecture = (indexLecture + 1) % TAILLE_FILE;
      essais = 0;
    } else {
      essais++;
      Serial.println("⚠ Échec, nouvelle tentative...");
      delay(2000);
    }
  }
}

// ----------------------- Envoi WiFi -----------------------
bool envoyerDonneesViaWiFi(const String &json) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi non connecté !");
    return false;
  }
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  int httpResponseCode = http.POST(json);

  if (httpResponseCode > 0) {
    Serial.print("✔ Réponse serveur : ");
    Serial.println(httpResponseCode);
    http.end();
    return true;
  } else {
    Serial.print("❌ Erreur HTTP : ");
    Serial.println(httpResponseCode);
    http.end();
    return false;
  }
}

// ----------------------- Envoi GSM (SIM800 style) -----------------------
bool attendreReponse(String expect, unsigned long timeout) {
  unsigned long start = millis();
  String buffer = "";
  while (millis() - start < timeout) {
    while (SerialGSM.available()) {
      char c = SerialGSM.read();
      buffer += c;
    }
    if (buffer.indexOf(expect) != -1) return true;
  }
  Serial.print("Timeout, attendu: "); Serial.println(expect);
  Serial.print("Buffer: "); Serial.println(buffer);
  return false;
}

bool initGSM() {
  SerialGSM.println("AT");
  if (!attendreReponse("OK", 2000)) return false;

  SerialGSM.println("AT+CSQ"); // quality
  delay(200);

  SerialGSM.printf("AT+SAPBR=3,1,\"CONTYPE\",\"GPRS\"\r\n");
  delay(200);
  SerialGSM.printf("AT+SAPBR=3,1,\"APN\",\"%s\"\r\n", GSM_APN);
  delay(200);
  if (GSM_USER && strlen(GSM_USER) > 0) {
    SerialGSM.printf("AT+SAPBR=3,1,\"USER\",\"%s\"\r\n", GSM_USER);
    delay(200);
    SerialGSM.printf("AT+SAPBR=3,1,\"PWD\",\"%s\"\r\n", GSM_PASS);
    delay(200);
  }
  SerialGSM.println("AT+SAPBR=1,1"); // open bearer
  if (!attendreReponse("OK", 5000)) return false;

  SerialGSM.println("AT+HTTPINIT");
  if (!attendreReponse("OK", 3000)) return false;

  return true;
}

bool envoyerDonneesViaGSM(const String &json) {
  if (!initGSM()) {
    Serial.println("Erreur init GSM");
    return false;
  }
  SerialGSM.printf("AT+HTTPPARA=\"URL\",\"%s\"\r\n", SERVER_URL);
  attendreReponse("OK", 2000);
  SerialGSM.println("AT+HTTPPARA=\"CONTENT\",\"application/json\"");
  attendreReponse("OK", 2000);

  SerialGSM.printf("AT+HTTPDATA=%d,10000\r\n", json.length());
  if (!attendreReponse("DOWNLOAD", 3000)) {
    logErreur("Echec HTTPDATA");
    return false;
  }
  SerialGSM.print(json);
  delay(100);
  if (!attendreReponse("OK", 10000)) {
    logErreur("Echec envoi payload GSM");
    return false;
  }

  SerialGSM.println("AT+HTTPACTION=1"); // POST
  if (!attendreReponse("+HTTPACTION:", 10000)) {
    logErreur("Echec HTTPACTION");
    return false;
  }

  SerialGSM.println("AT+HTTPREAD");
  attendreReponse("OK", 5000);

  SerialGSM.println("AT+HTTPTERM");
  attendreReponse("OK", 3000);

  Serial.println("✔ Envoi via GSM OK");
  return true;
}

// ----------------------- WRAPPER Envoi -----------------------
bool envoyerDonnees(const String &json) {
  if (WiFi.status() == WL_CONNECTED) {
    if (envoyerDonneesViaWiFi(json)) return true;
    Serial.println("Échec WiFi, tentative GSM...");
    if (envoyerDonneesViaGSM(json)) return true;
    return false;
  } else {
    Serial.println("WiFi absent, utilisation GSM...");
    if (envoyerDonneesViaGSM(json)) return true;
    return false;
  }
}

// ----------------------- Helpers -----------------------
bool distanceValide(long d) { return (d > 2 && d < 400); }
bool gpsValide(double lat, double lon) { return !(lat == 0.0 && lon == 0.0); }
bool wifiOK() { return (WiFi.status() == WL_CONNECTED); }
bool batterieFaible(int pourcent) { return (pourcent < 20); }

// ----------------------- SETUP & LOOP -----------------------
void setup() {
  setupAll();
}

void loop() {
  // Traitement de file en priorité (si WiFi ok)
  traiterFile();

  // Vérifier si temps de mesure
  if (millis() - lastMeasureTime >= measureInterval) {
    lastMeasureTime = millis();

    // 1. Batterie
    float vbat = readBatteryVoltage();
    int batPercent = voltageToPercent(vbat);
    if (batterieFaible(batPercent)) {
      logErreur("Batterie faible");
    }

    // 2. Distance
    long distance = mesurerDistanceCm();
    if (!distanceValide(distance)) {
      logErreur("Distance invalide");
      // on continue quand même pour log
    }

    // 3. Charger la hauteur si non configurée
    if (hauteurPoubelle == 0 && configData.poubelle_height > 0) {
      hauteurPoubelle = configData.poubelle_height;
    }

    int niveau = -1;
    if (hauteurPoubelle > 0 && distance >= 0) {
      niveau = calculerNiveauRemplissage(distance);
    }

    // 4. GPS
    double lat = NAN, lon = NAN;
    lireGPS(lat, lon); // update si disponible

    // 5. Construire JSON
    String id = configData.device_id;
    String payload = construireJSON(id, niveau, distance, batPercent, lat, lon);
    Serial.println("Payload: ");
    Serial.println(payload);

    // 6. Envoyer (WiFi préféré)
    bool ok = envoyerDonnees(payload);
    if (!ok) {
      ajouterAFile(payload);
    } else {
      // flush queue si possible
      traiterFile();
    }
  }

  delay(100);
}
