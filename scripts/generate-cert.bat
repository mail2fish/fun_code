@echo off
setlocal enabledelayedexpansion

rem HTTPS Certificate Generation Script (Windows version)
rem Generate self-signed certificates for development and testing environments only

echo Checking OpenSSL availability...

rem Check if OpenSSL is available
openssl version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: OpenSSL command not found
    echo.
    echo Please install OpenSSL:
    echo 1. Download OpenSSL for Windows: https://slproweb.com/products/Win32OpenSSL.html
    echo 2. Or use chocolatey: choco install openssl
    echo 3. Or use winget: winget install openssl
    echo.
    pause
    exit /b 1
)

rem Default configuration
set CERT_DIR=.\certs
set CERT_FILE=server.crt
set KEY_FILE=server.key
set DAYS=365
set COUNTRY=CN
set STATE=Beijing
set CITY=Beijing
set ORG=Fun Code
set ORG_UNIT=IT
set COMMON_NAME=localhost

rem Create certificate directory
if not exist "%CERT_DIR%" mkdir "%CERT_DIR%"

echo Generating HTTPS self-signed certificate...
echo Certificate directory: %CERT_DIR%
echo Certificate file: %CERT_FILE%
echo Private key file: %KEY_FILE%
echo Validity period: %DAYS% days
echo Common name: %COMMON_NAME%
echo.

rem Generate private key
echo Generating private key...
openssl genrsa -out "%CERT_DIR%\%KEY_FILE%" 2048
if %errorlevel% neq 0 (
    echo ❌ Private key generation failed
    pause
    exit /b 1
)

rem Generate self-signed certificate
echo Generating certificate...
openssl req -new -x509 -key "%CERT_DIR%\%KEY_FILE%" -out "%CERT_DIR%\%CERT_FILE%" -days %DAYS% -subj "/C=%COUNTRY%/ST=%STATE%/L=%CITY%/O=%ORG%/OU=%ORG_UNIT%/CN=%COMMON_NAME%"
if %errorlevel% neq 0 (
    echo ❌ Certificate generation failed
    pause
    exit /b 1
)

echo.
echo ✅ Certificate generation completed!
echo.
echo Certificate file paths:
echo   Certificate: %CD%\%CERT_DIR%\%CERT_FILE%
echo   Private key: %CD%\%CERT_DIR%\%KEY_FILE%
echo.
echo Configuration file example (config.yaml):
echo server:
echo   mode: "https_only"  # or "both", "https_redirect"
echo   http_port: ":8080"
echo   https_port: ":8443"
echo   tls:
echo     cert_file: '%CD%\%CERT_DIR%\%CERT_FILE%'
echo     key_file: '%CD%\%CERT_DIR%\%KEY_FILE%'
echo.
echo ⚠️  Warning: This is a self-signed certificate for development and testing only!
echo    Browsers will show security warnings, you need to manually trust the certificate.
echo    For production environments, please use certificates issued by a CA.
echo.
pause 