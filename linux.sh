#!/usr/bin/env bash

# Change working directory to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

ACTION="${1:-build}"

# Map legacy flags to actions
case "$ACTION" in
    --remove) ACTION="remove" ;;
    --update) ACTION="update" ;;
esac

INSTALL_DIR="/opt/rentbill"
SERVICE_NAME="rentbill.service"
BINARY_NAME="rentbill"

# helper: detect the real user when running under sudo
real_user() {
    if [ -n "$SUDO_USER" ]; then
        echo "$SUDO_USER"
    elif command -v logname &>/dev/null; then
        logname 2>/dev/null || echo "$USER"
    else
        echo "$USER"
    fi
}

require_root() {
    if [ "$EUID" -ne 0 ]; then
        echo "❌ Error: This action requires root. Please run: sudo $0 $1"
        exit 1
    fi
}

case "$ACTION" in
    build)
        echo "🚀 Building RentBill Pro..."
        if ! command -v go &> /dev/null; then
            echo "❌ Error: Go compiler is not installed or not in PATH!"
            exit 1
        fi
        echo "Cleaning dependencies..."
        go mod tidy
        echo "🔨 Building Go binary ($BINARY_NAME)..."
        go build -ldflags="-s -w" -o "$BINARY_NAME" .
        if [ $? -ne 0 ]; then
            echo "❌ Go Build failed!"
            exit 1
        fi
        echo "-------------------------------------------"
        echo "✅ Build Complete! Created: ./$BINARY_NAME"
        echo "🚀 Run with: ./linux.sh run (or ./rentbill)"
        echo "-------------------------------------------"
        ;;
    install)
        echo "🚀 Installing RentBill Pro..."
        if ! command -v go &> /dev/null; then
            echo "❌ Error: Go compiler is not installed or not in PATH!"
            exit 1
        fi

        if [ -f "rentbill.db" ] || [ -f "config.json" ]; then
            read -p "⚠️ Existing database/config found. Delete and start fresh? (y/N): " choice
            case "$choice" in
                [yY][eE][sS]|[yY])
                    echo "🗑️ Deleting existing database & configuration..."
                    rm -f rentbill.db config.json
                    ;;
                *)
                    echo "⚙️ Preserving existing database & configuration."
                    ;;
            esac
        fi

        echo "📂 Creating directories..."
        mkdir -p backups uploads/maintenance uploads/proofs
        if [ ! -f config.json ]; then
            if [ -f config.example.json ]; then
                cp config.example.json config.json
                echo "⚠️ Created config.json from example."
            else
                echo '{ "server_port": 8080 }' > config.json
                echo "⚠️ Created minimal config.json."
            fi
        fi
        "$0" build
        echo "--------------------------------------------------"
        echo "✅ RentBill Pro is installed!"
        echo "🚀 Run with: ./linux.sh run"
        echo "🌐 Web interface: http://localhost:8080"
        echo "--------------------------------------------------"
        ;;
    run)
        if [ ! -f "./rentbill" ]; then
            echo "🔨 Binary not found. Building first..."
            "$0" build || exit 1
        fi
        echo "🚀 Launching RentBill Pro..."
        ./rentbill
        ;;
    pack)
        echo "📦 Packaging RentBill Pro..."
        "$0" build || exit 1
        DIST_DIR="rentbill_release"
        rm -rf "$DIST_DIR"
        mkdir -p "$DIST_DIR"
        cp rentbill "$DIST_DIR/"
        if [ -f config.json ]; then
            cp config.json "$DIST_DIR/config.json.template"
        fi
        TAR_FILE="rentbill_deploy.tar.gz"
        tar -czf "$TAR_FILE" "$DIST_DIR"
        rm -rf "$DIST_DIR"
        echo "-------------------------------------------"
        echo "✅ Archive created: $TAR_FILE"
        echo "-------------------------------------------"
        ;;
    deploy)
        echo "🚀 Deploying RentBill Pro to $INSTALL_DIR (systemd)..."
        require_root "deploy"

        REAL_USER="$(real_user)"
        REAL_GROUP="$(id -gn "$REAL_USER")"
        echo "👤 Target user: $REAL_USER:$REAL_GROUP"

        "$0" build || exit 1

        echo "📂 Preparing installation directory at $INSTALL_DIR..."
        mkdir -p "$INSTALL_DIR"
        mkdir -p "$INSTALL_DIR/backups"
        mkdir -p "$INSTALL_DIR/uploads"

        echo "📦 Copying application files..."
        cp "$BINARY_NAME" "$INSTALL_DIR/"

        if [ -f "$INSTALL_DIR/config.json" ]; then
            echo "⚙️ Existing config.json found. Preserving current settings."
        elif [ -f "config.json" ]; then
            cp config.json "$INSTALL_DIR/"
        elif [ -f "config.example.json" ]; then
            cp config.example.json "$INSTALL_DIR/config.json"
            echo "⚠️ Created new config.json from example."
        fi

        echo "🔐 Setting folder permissions for $REAL_USER..."
        chown -R "$REAL_USER:$REAL_GROUP" "$INSTALL_DIR"
        chmod +x "$INSTALL_DIR/$BINARY_NAME"

        echo "⚙️ Configuring systemd service..."
        cat <<EOF > "/etc/systemd/system/$SERVICE_NAME"
[Unit]
Description=Rent Bill Pro Local Server
After=network.target
StartLimitIntervalSec=0

[Service]
User=$REAL_USER
Group=$REAL_GROUP
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/$BINARY_NAME
Restart=always
RestartSec=3
Environment=GIN_MODE=release

[Install]
WantedBy=multi-user.target
EOF

        echo "🔄 Reloading systemd and starting service..."
        systemctl daemon-reload
        systemctl enable "$SERVICE_NAME"
        systemctl restart "$SERVICE_NAME"

        echo "--------------------------------------------------"
        echo "✅ RentBill Pro is now successfully installed!"
        echo "📍 Location: $INSTALL_DIR"
        echo "🛠 Service: $SERVICE_NAME (running as $REAL_USER)"
        echo "🌐 Web interface: http://localhost:8080 (or your configured port)"
        echo "--------------------------------------------------"
        ;;
    update)
        echo "🔄 Updating RentBill Pro..."
        require_root "update"

        if [ ! -f "$INSTALL_DIR/$BINARY_NAME" ]; then
            echo "⚠️ No existing deployment found. Running full deploy..."
            "$0" deploy
            exit $?
        fi

        "$0" build || exit 1
        systemctl stop "$SERVICE_NAME" 2>/dev/null
        cp "$BINARY_NAME" "$INSTALL_DIR/"
        REAL_USER="$(real_user)"
        REAL_GROUP="$(id -gn "$REAL_USER")"
        chown -R "$REAL_USER:$REAL_GROUP" "$INSTALL_DIR"
        chmod +x "$INSTALL_DIR/$BINARY_NAME"
        systemctl daemon-reload
        systemctl restart "$SERVICE_NAME"
        echo "✅ Update complete. Database, config, backups, and uploads preserved."
        ;;
    remove)
        echo "🗑️  Uninstalling RentBill Pro..."
        require_root "remove"

        systemctl stop "$SERVICE_NAME" 2>/dev/null
        systemctl disable "$SERVICE_NAME" 2>/dev/null
        rm -f "/etc/systemd/system/$SERVICE_NAME"
        systemctl daemon-reload

        echo "❓ Do you want to delete all data (database, backups, and uploads) as well? (y/N)"
        read -r response
        if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            rm -rf "$INSTALL_DIR"
            echo "✅ Application and ALL data removed."
        else
            rm -f "$INSTALL_DIR/$BINARY_NAME"
            echo "✅ Application removed. Database, backups, and uploads preserved."
        fi
        exit 0
        ;;
    *)
        echo "❌ Unknown command: $ACTION"
        echo "💡 Usage: ./linux.sh [build|install|run|pack|deploy|update|remove]"
        echo "   Flags: ./linux.sh --update  |  ./linux.sh --remove"
        exit 1
        ;;
esac
