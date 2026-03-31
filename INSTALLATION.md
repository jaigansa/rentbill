# Installation Guide - Rent Bill Pro 🛠

This guide will help you set up Rent Bill Pro on your local machine for development or personal use.

## Prerequisites
- **Go (Golang)**: Version 1.20 or higher.
- **SQLite3**: Installed on your system.
- **Git**: For cloning the repository.

## 1. Clone the Repository
```bash
git clone https://github.com/your-repo/rentbill.git
cd rentbill
```

## 2. Install Dependencies
The project uses Go modules. Fetch all required packages using:
```bash
go mod tidy
```

## 3. Initial Configuration
Copy the example configuration file:
```bash
cp config.example.json config.json
```
*Note: The app will automatically initialize with default settings (PIN: 1234) if this file is missing.*

## 4. Build the Application
Use the provided build script:
```bash
chmod +x build.sh
./build.sh
```
This will compile the Go backend and prepare the application binary.

## 5. Run the App
Start the server:
```bash
./rentbill
```
By default, the app will be accessible at: `http://localhost:8080`

## 6. Project Structure
- `/cmd/rentbill`: Main entry point.
- `/internal/handlers`: Backend API logic.
- `/internal/models`: Data structures.
- `/public`: Frontend assets (HTML, CSS, JS).
- `/backups`: Local database snapshots.
- `rentbill.db`: The live SQLite database file.
