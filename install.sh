#!/bin/bash

# RentBill Pro: Robust Installation Script
# This script handles building, directory setup, permissions, and systemd service creation.

INSTALL_DIR="/opt/rentbill"
SERVICE_NAME="rentbill.service"
BINARY_NAME="rentbill"
IS_WINDOWS=false
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    IS_WINDOWS=true
    BINARY_NAME="rentbill.exe"
    INSTALL_DIR="./release"
fi

echo "🚀 Starting RentBill Pro installation..."

# 1. Check for root privileges on Unix (required to write to /opt and /etc)
if [ "$IS_WINDOWS" = false ]; then
    if [ "$EUID" -ne 0 ]; then 
      echo "❌ Error: Please run as root: sudo $0"
      exit 1
    fi
fi

# 2. Identify the real user
if [ "$IS_WINDOWS" = true ]; then
    REAL_USER=$USER
    REAL_GROUP="Staff"
else
    REAL_USER=${SUDO_USER:-$(logname || echo $USER)}
    REAL_GROUP=$(id -gn $REAL_USER)
fi

echo "👤 Identifying system user: $REAL_USER:$REAL_GROUP"

# 3. Handle Removal or Update
if [ "$1" == "--remove" ]; then
    echo "🗑️  Uninstalling RentBill Pro..."
    if [ "$IS_WINDOWS" = false ]; then
        systemctl stop $SERVICE_NAME 2>/dev/null
        systemctl disable $SERVICE_NAME 2>/dev/null
        rm -f /etc/systemd/system/$SERVICE_NAME
        systemctl daemon-reload
    fi
    
    echo "❓ Do you want to delete all data (database, backups, and uploads) as well? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        rm -rf $INSTALL_DIR
        echo "✅ Application and ALL data removed."
    else
        rm -f $INSTALL_DIR/$BINARY_NAME
        echo "✅ Application removed. Database, backups, and uploads preserved."
    fi
    exit 0
fi

if [ "$1" == "--update" ]; then
    echo "🔄 Preparing to update RentBill Pro..."
    if [ "$IS_WINDOWS" = false ]; then
        systemctl stop $SERVICE_NAME 2>/dev/null
    fi
    # We don't remove INSTALL_DIR here to preserve DB, config, and uploads
    echo "✅ Ready for update."
fi

# 4. Build if binary is missing or if we want to ensure latest version
echo "🛠 Building application binary..."
if [ -f "./build.sh" ]; then
    chmod +x ./build.sh
    if [ "$IS_WINDOWS" = true ]; then
        ./build.sh
    else
        # Run build as the real user to avoid permission issues in the source folder
        su -c "./build.sh" $REAL_USER
    fi
    if [ $? -ne 0 ]; then
        echo "❌ Error: Build failed. Check logs above."
        exit 1
    fi
else
    echo "❌ Error: build.sh not found."
    exit 1
fi

# 5. Create directories
echo "📂 Preparing installation directory at $INSTALL_DIR..."
mkdir -p $INSTALL_DIR
mkdir -p $INSTALL_DIR/backups
mkdir -p $INSTALL_DIR/uploads

# 6. Copy application files
echo "📦 Copying files..."
cp $BINARY_NAME $INSTALL_DIR/

# 7. Handle configuration
if [ -f "$INSTALL_DIR/config.json" ]; then
    echo "⚙️  Existing config.json found. Preserving current settings."
else
    if [ -f "config.json" ]; then
        cp config.json $INSTALL_DIR/
    elif [ -f "config.example.json" ]; then
        cp config.example.json $INSTALL_DIR/config.json
        echo "⚠️  Created new config.json from example."
    fi
fi

# 8. Set Ownership and Permissions
if [ "$IS_WINDOWS" = false ]; then
    echo "🔐 Setting folder permissions for $REAL_USER..."
    chown -R $REAL_USER:$REAL_GROUP $INSTALL_DIR
    chmod +x $INSTALL_DIR/$BINARY_NAME
fi

# 9. Create/Update systemd service file
if [ "$IS_WINDOWS" = false ]; then
    echo "⚙️  Configuring systemd service..."
    cat <<EOF > /etc/systemd/system/$SERVICE_NAME
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

    # 10. Reload and start service
    echo "🔄 Reloading systemd and starting service..."
    systemctl daemon-reload
    systemctl enable $SERVICE_NAME
    systemctl restart $SERVICE_NAME
fi

echo "--------------------------------------------------"
echo "✅ RentBill Pro is now successfully installed!"
echo "📍 Location: $INSTALL_DIR"
if [ "$IS_WINDOWS" = false ]; then
    echo "🛠 Service: $SERVICE_NAME (running as $REAL_USER)"
fi
echo "🌐 Web interface: http://localhost:8080 (or your configured port)"
echo "--------------------------------------------------"
