#!/bin/bash

# HTTPS Certificate Generation Script
# Generate self-signed certificates for development and testing environments only

set -e

# Default configuration
CERT_DIR="./certs"
CERT_FILE="server.crt"
KEY_FILE="server.key"
DAYS=365
COUNTRY="CN"
STATE="Beijing"
CITY="Beijing"
ORG="Fun Code"
ORG_UNIT="IT"
COMMON_NAME="localhost"

# Create certificate directory
mkdir -p "$CERT_DIR"

echo "Generating HTTPS self-signed certificate..."
echo "Certificate directory: $CERT_DIR"
echo "Certificate file: $CERT_FILE"
echo "Private key file: $KEY_FILE"
echo "Validity period: $DAYS days"
echo "Common name: $COMMON_NAME"
echo ""

# Generate private key
openssl genrsa -out "$CERT_DIR/$KEY_FILE" 2048

# Generate self-signed certificate
openssl req -new -x509 -key "$CERT_DIR/$KEY_FILE" -out "$CERT_DIR/$CERT_FILE" -days $DAYS -subj "/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORG/OU=$ORG_UNIT/CN=$COMMON_NAME"

# Set file permissions
chmod 600 "$CERT_DIR/$KEY_FILE"
chmod 644 "$CERT_DIR/$CERT_FILE"

echo "✅ Certificate generation completed!"
echo ""
echo "Certificate file paths:"
echo "  Certificate: $(pwd)/$CERT_DIR/$CERT_FILE"
echo "  Private key: $(pwd)/$CERT_DIR/$KEY_FILE"
echo ""
echo "Configuration file example (config.yaml):"
echo "server:"
echo "  mode: \"https_only\"  # or \"both\", \"https_redirect\""
echo "  http_port: \":8080\""
echo "  https_port: \":8443\""
echo "  tls:"
echo "    cert_file: \"$(pwd)/$CERT_DIR/$CERT_FILE\""
echo "    key_file: \"$(pwd)/$CERT_DIR/$KEY_FILE\""
echo ""
echo "⚠️  Warning: This is a self-signed certificate for development and testing only!"
echo "   Browsers will show security warnings, you need to manually trust the certificate."
echo "   For production environments, please use certificates issued by a CA." 