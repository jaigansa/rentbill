@echo off
setlocal enabledelayedexpansion

:: Change working directory to project root
cd /d "%~dp0"

set ACTION=%1
if "%ACTION%"=="" set ACTION=build

if /i "%ACTION%"=="build" goto do_build
if /i "%ACTION%"=="install" goto do_install
if /i "%ACTION%"=="run" goto do_run
if /i "%ACTION%"=="pack" goto do_pack

echo ❌ Unknown command: %ACTION%
echo 💡 Available commands: win.bat [build^|install^|run^|pack]
exit /b 1

:do_build
echo 🚀 Building RentBill Pro (rentbill.exe)...
where go >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Error: Go compiler is not installed or not in PATH!
    exit /b 1
)
echo Cleaning dependencies...
go mod tidy
echo 🔨 Building single standalone executable (rentbill.exe)...
go build -ldflags="-s -w" -o rentbill.exe .
if %ERRORLEVEL% neq 0 (
    echo ❌ Go Build failed!
    exit /b 1
)
echo -------------------------------------------
echo ✅ Build Complete! Created: rentbill.exe
echo 🚀 Run with: win.bat run (or rentbill.exe)
echo -------------------------------------------
exit /b 0

:do_install
echo 🚀 Installing RentBill Pro...
where go >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Error: Go compiler is not installed or not in PATH!
    exit /b 1
)

set HAS_DATA=
if exist rentbill.db set HAS_DATA=1
if exist config.json set HAS_DATA=1

if defined HAS_DATA (
    set /p DEL_CHOICE="⚠️ Existing database/config found. Delete and start fresh? (y/N): "
    if /i "!DEL_CHOICE!"=="y" (
        echo 🗑️ Deleting existing database ^& configuration...
        if exist rentbill.db del /f /q rentbill.db
        if exist config.json del /f /q config.json
    ) else (
        echo ⚙️ Preserving existing database ^& configuration.
    )
)

echo 📂 Creating directories...
if not exist backups mkdir backups
if not exist uploads mkdir uploads
if not exist uploads\maintenance mkdir uploads\maintenance
if not exist uploads\proofs mkdir uploads\proofs

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
call :do_build
if %ERRORLEVEL% neq 0 exit /b 1
echo --------------------------------------------------
echo ✅ RentBill Pro is installed!
echo 🚀 Run with: win.bat run
echo 🌐 Web interface: http://localhost:8080
echo --------------------------------------------------
exit /b 0

:do_run
if not exist rentbill.exe (
    echo 🔨 rentbill.exe not found. Building first...
    call :do_build
    if !ERRORLEVEL! neq 0 exit /b 1
)
echo 🚀 Launching RentBill Pro...
rentbill.exe
exit /b 0

:do_pack
echo 📦 Packaging RentBill Pro...
call :do_build
if %ERRORLEVEL% neq 0 exit /b 1
echo 📚 Compressing release package...
powershell -Command "Compress-Archive -Path 'rentbill.exe', 'config.example.json', 'README.md' -DestinationPath 'rentbill_windows.zip' -Force"
echo -------------------------------------------
echo ✅ Package created: rentbill_windows.zip
echo -------------------------------------------
exit /b 0
