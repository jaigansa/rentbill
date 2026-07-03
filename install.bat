@echo off
echo 🚀 Starting RentBill Pro installation for Windows...

:: Check for Go
where go >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Error: Go compiler is not installed or not in PATH!
    exit /b 1
)

:: Create local directories
echo 📂 Creating directories...
if not exist backups mkdir backups
if not exist uploads mkdir uploads

:: Handle config.json
if not exist config.json (
    if exist config.example.json (
        copy config.example.json config.json >nul
        echo ⚠️ Created config.json from example.
    ) else (
        echo { "server_port": 8080 } > config.json
        echo ⚠️ Created minimal config.json.
    )
) else (
    echo ⚙️ Existing config.json found. Preserving current settings.
)

:: Build the application
echo 🛠 Running build.bat...
call build.bat
if %ERRORLEVEL% neq 0 (
    echo ❌ Installation failed: Build failed.
    exit /b 1
)

echo --------------------------------------------------
echo ✅ RentBill Pro is now successfully installed!
echo 📂 Location: %CD%
echo 🚀 Run the application using: rentbill.exe
echo 🌐 Web interface: http://localhost:8080 (or your configured port)
echo --------------------------------------------------
