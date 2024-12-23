// Use this file to store all of the private credentials 
// and connection details

#define SECRET_SSID "YourWiFiSSID"		// replace MySSID with your WiFi network name
#define SECRET_PASS "YourPassword"		// replace MyPassword with your WiFi password

// client certificate for your ESP32 client
// unique cert should be generated for every client where the CN
// value is set to the "username" for that client
extern const char myc_cert[] =
"-----BEGIN CERTIFICATE-----\n" // 10-year cert
"MIIDRjCCAi4CCQDFeEHTJU7+cjANBgkqhkiG9w0BAQsFADBgMQswCQYDVQQGEwJV\n"
"UzELMAkGA1UECAwCUEExEDAOBgNVBAcMB0NyYWZ0b24xEjAQBgNVBAoMCU1vcnBo\n"
"... code of your actual client certificate goes here...\n"
"-----END CERTIFICATE-----\n";

// This is the client key that matches the above certificate
extern const char myc_key[] =
"-----BEGIN RSA PRIVATE KEY-----\n"
"MIIEowIBAAKCAQEAznqIm80zz2IayTDXm4M1ZNugeBOJ+F2dUfUyId7NPRsiDRoG\n"
"3FLaJCdoFjUbjZt2XVjRP/Z34fZW4le0WsYjAbrnHcQuKgpX0dW+FjRb2ggF+UUE\n"
"... code of your actual client private key goes here...\n"
"-----END RSA PRIVATE KEY-----\n";
