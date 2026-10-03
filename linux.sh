#!/usr/bin/env bash
# ==============================================================================
# RentBill - Unified Linux Management CLI
# Flags: --build, --install, --update, --remove, --status, --logs
# ==============================================================================

set -e

APP_NAME="rentbill"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="${APP_NAME}.service"
USER_SYSTEMD_DIR="${HOME}/.config/systemd/user"
SERVICE_FILE="${USER_SYSTEMD_DIR}/${SERVICE_NAME}"

# Helper colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_banner() {
    echo -e "${BLUE}======================================================${NC}"
    echo -e "${BLUE}          🏠  RentBill Linux Manager                  ${NC}"
    echo -e "${BLUE}======================================================${NC}"
}

usage() {
    print_banner
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  --build      Compile the application binary from source"
    echo "  --install    Install and start RentBill as a background systemd user service"
    echo "  --update     Rebuild binary and restart the running systemd service"
    echo "  --remove     Stop, disable, and remove the systemd service"
    echo "  --status     Check current status of the background service"
    echo "  --logs       Follow live logs from the service"
    echo "  --help       Show this help message"
    echo ""
}

do_build() {
    echo -e "${YELLOW}🔨 Building '${APP_NAME}' binary...${NC}"
    if ! command -v go >/dev/null 2>&1; then
        echo -e "${RED}❌ Error: 'go' is not installed or not in PATH.${NC}"
        exit 1
    fi
    (cd "${SCRIPT_DIR}" && go build -ldflags="-s -w" -o "${APP_NAME}" .)
    chmod +x "${SCRIPT_DIR}/${APP_NAME}"
    echo -e "${GREEN}✅ Build successful: ${SCRIPT_DIR}/${APP_NAME}${NC}"
}

do_install() {
    print_banner
    # Ensure binary exists or build it
    if [ ! -f "${SCRIPT_DIR}/${APP_NAME}" ]; then
        echo "Binary not found. Initiating build..."
        do_build
    else
        chmod +x "${SCRIPT_DIR}/${APP_NAME}"
    fi

    echo -e "${YELLOW}⚙️  Configuring user systemd service...${NC}"
    mkdir -p "${USER_SYSTEMD_DIR}"

    cat <<EOF > "${SERVICE_FILE}"
[Unit]
Description=RentBill Rental Management Service
After=network.target

[Service]
Type=simple
WorkingDirectory=${SCRIPT_DIR}
ExecStart=${SCRIPT_DIR}/${APP_NAME}
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=default.target
EOF

    echo "🔄 Reloading systemd user daemon..."
    systemctl --user daemon-reload

    echo "🚀 Enabling and starting '${SERVICE_NAME}'..."
    systemctl --user enable --now "${SERVICE_NAME}"

    if command -v loginctl >/dev/null 2>&1; then
        loginctl enable-linger "$USER" 2>/dev/null || true
    fi

    echo ""
    echo -e "${GREEN}✅ RentBill installed and running successfully!${NC}"
    echo "  • Status: $0 --status"
    echo "  • Logs:   $0 --logs"
    echo "  • Access: http://localhost:8080"
}

do_update() {
    print_banner
    echo -e "${YELLOW}🔄 Updating RentBill...${NC}"
    do_build

    if systemctl --user is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then
        echo "🔁 Restarting background service..."
        systemctl --user restart "${SERVICE_NAME}"
        echo -e "${GREEN}✅ Service restarted with the updated binary!${NC}"
    else
        echo -e "${YELLOW}⚠️  Service is not currently running. Run '$0 --install' to start it.${NC}"
    fi
}

do_remove() {
    print_banner
    echo -e "${YELLOW}🗑️  Removing RentBill service...${NC}"

    if systemctl --user is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then
        echo "🛑 Stopping service..."
        systemctl --user stop "${SERVICE_NAME}"
    fi

    if systemctl --user is-enabled --quiet "${SERVICE_NAME}" 2>/dev/null; then
        echo "🔌 Disabling service..."
        systemctl --user disable "${SERVICE_NAME}"
    fi

    if [ -f "${SERVICE_FILE}" ]; then
        echo "🗑️  Removing ${SERVICE_FILE}..."
        rm -f "${SERVICE_FILE}"
    fi

    echo "🔄 Reloading systemd user daemon..."
    systemctl --user daemon-reload
    systemctl --user reset-failed 2>/dev/null || true

    echo ""
    echo -e "${GREEN}✅ RentBill service removed successfully!${NC}"
    echo "   (Your database 'rentbill.db' and project files were kept safe)"
}

do_status() {
    systemctl --user status "${SERVICE_NAME}"
}

do_logs() {
    journalctl --user -u "${SERVICE_NAME}" -f
}

case "$1" in
    --build)
        do_build
        ;;
    --install)
        do_install
        ;;
    --update)
        do_update
        ;;
    --remove)
        do_remove
        ;;
    --status)
        do_status
        ;;
    --logs)
        do_logs
        ;;
    --help|-h|"")
        usage
        ;;
    *)
        echo -e "${RED}Unknown option: $1${NC}"
        usage
        exit 1
        ;;
esac
