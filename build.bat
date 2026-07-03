@echo off
echo 🚀 Starting build process for Windows...

:: Check for Go
where go >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Error: Go compiler is not installed or not in PATH!
    exit /b 1
)

:: Run go tidy
echo Cleaning dependencies...
go mod tidy

:: Build executable
echo 🔨 Building Go application (rentbill.exe)...
go build -o rentbill.exe .
if %ERRORLEVEL% neq 0 (
    echo ❌ Go Build failed!
    exit /b 1
)

echo -------------------------------------------
echo ✅ Build Complete! (Binary kept at root)
echo 🚀 Run with: rentbill.exe
echo -------------------------------------------
