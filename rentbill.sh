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
    echo "Usage: $0 [OPTION] [FLAGS]"
    echo ""
    echo "Options:"
    echo "  --build              Compile the application binary from source"
    echo "  --install [--share]  Install and start RentBill as an auto-starting systemd user service"
    echo "                       (Include --share to allow mobile phone Wi-Fi access on boot)"
    echo "  --desktop [--share]  Create a Linux desktop application shortcut (app menu launcher)"
    echo "  --update  [--share]  Rebuild binary and restart the running systemd service"
    echo "  --remove             Stop, disable, and remove the systemd service"
    echo "  --status             Check current status of the background service"
    echo "  --logs               Follow live logs from the service"
    echo "  --help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --install --share   # Run as background service with Wi-Fi mobile access enabled"
    echo "  $0 --desktop --share   # Create desktop app launcher with Wi-Fi sharing"
    echo ""
}

ensure_go() {
    if command -v go >/dev/null 2>&1; then
        return 0
    fi
    # Search common Go install locations
    local candidate_paths=(
        "/usr/local/go/bin"
        "${HOME}/go/bin"
        "${HOME}/.local/share/mise/shims"
        "${HOME}/.asdf/shims"
        "${HOME}/.nix-profile/bin"
    )
    for p in "${candidate_paths[@]}"; do
        if [ -x "${p}/go" ]; then
            export PATH="${p}:${PATH}"
            return 0
        fi
    done
    # Search for Go toolchain in module cache if present
    local tc
    tc=$(find "${HOME}/go/pkg/mod/golang.org/toolchain"*"/bin" -name "go" -type f -perm /111 2>/dev/null | head -n 1)
    if [ -n "$tc" ]; then
        export PATH="$(dirname "$tc"):${PATH}"
        return 0
    fi
    return 1
}

do_build() {
    echo -e "${YELLOW}🔨 Building '${APP_NAME}' pure Go binary (CGO_ENABLED=0)...${NC}"
    if ! ensure_go; then
        echo -e "${RED}❌ Error: 'go' is not installed or not in PATH.${NC}"
        exit 1
    fi
    (cd "${SCRIPT_DIR}" && CGO_ENABLED=0 go build -ldflags="-s -w" -o "${APP_NAME}" .)
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

    local exec_args="-server -port 8080"
    if [[ "$*" == *"--share"* ]] || [[ "$*" == *"-share"* ]] || [[ "$*" == *"--lan"* ]] || [[ "$*" == *"-lan"* ]]; then
        exec_args="${exec_args} -share"
        echo -e "${GREEN}📡 Local Network (Wi-Fi) sharing enabled in service${NC}"
    fi

    cat <<EOF > "${SERVICE_FILE}"
[Unit]
Description=RentBill Rental Management Service
After=network.target

[Service]
Type=simple
WorkingDirectory=${SCRIPT_DIR}
ExecStart=${SCRIPT_DIR}/${APP_NAME} ${exec_args}
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
    echo "  • Local:  http://localhost:8080"
    if [[ "${exec_args}" == *"-share"* ]]; then
        echo "  • Wi-Fi:  Accessible to mobile phones on the same Wi-Fi network"
    fi
}

do_desktop() {
    print_banner
    echo -e "${YELLOW}🖥️  Installing Linux desktop application launcher...${NC}"
    local app_dir="${HOME}/.local/share/applications"
    mkdir -p "${app_dir}"

    # Ensure binary exists or build it
    if [ ! -f "${SCRIPT_DIR}/${APP_NAME}" ]; then
        echo "Binary not found. Initiating build..."
        do_build
    fi

    local bin_args=""
    if [[ "$*" == *"--share"* ]] || [[ "$*" == *"-share"* ]] || [[ "$*" == *"--lan"* ]] || [[ "$*" == *"-lan"* ]]; then
        bin_args=" -share"
        echo -e "${GREEN}📡 Wi-Fi sharing will be active when launched from desktop menu${NC}"
    fi

    local desktop_file="${app_dir}/rentbill.desktop"
    cat <<EOF > "${desktop_file}"
[Desktop Entry]
Name=RentBill
GenericName=Rental & Billing Manager
Comment=Manage tenants, utility meter calculations, and rent receipts
Exec=${SCRIPT_DIR}/${APP_NAME}${bin_args}
Icon=${SCRIPT_DIR}/public/favicon.svg
Terminal=false
Type=Application
Categories=Office;Finance;Utility;
Keywords=rent;bill;tenant;property;finance;
StartupNotify=true
EOF

    chmod +x "${desktop_file}"
    echo -e "${GREEN}✅ Desktop launcher created: ${desktop_file}${NC}"
    echo "   You can now launch RentBill directly from your application launcher (Rofi, Wofi, GNOME, etc.)"
}

do_update() {
    print_banner
    echo -e "${YELLOW}🔄 Updating RentBill...${NC}"
    do_build

    if [[ "$*" == *"--share"* ]] || [[ "$*" == *"-share"* ]]; then
        do_install "$@"
        return
    fi

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
    echo "   (Your database in 'data/' and project files were kept safe)"
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
        do_install "$@"
        ;;
    --desktop)
        do_desktop "$@"
        ;;
    --update)
        do_update "$@"
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
