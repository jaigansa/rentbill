#!/usr/bin/env bash
# ==============================================================================
# RentBill - Unified Linux Management CLI
# Flags: --build, --install, --update, --remove, --status, --logs, --setup
# ==============================================================================

set -e

APP_NAME="rentbill"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="${APP_NAME}.service"

# Linux standard installation locations (XDG Base Directory Specification)
INSTALL_BIN_DIR="${HOME}/.local/bin"
INSTALL_DATA_DIR="${XDG_DATA_HOME:-${HOME}/.local/share}/${APP_NAME}"
INSTALL_APP_DIR="${HOME}/.local/share/applications"
INSTALL_ICON_DIR="${HOME}/.local/share/icons/hicolor/scalable/apps"
USER_SYSTEMD_DIR="${HOME}/.config/systemd/user"
SERVICE_FILE="${USER_SYSTEMD_DIR}/${SERVICE_NAME}"
DEFAULT_DB="${INSTALL_DATA_DIR}/${APP_NAME}.db"

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
    echo "Usage: $0 [COMMAND] [FLAGS]"
    echo ""
    echo "Commands:"
    echo "  install            Full install (desktop launcher + background service)"
    echo "  run                Run RentBill in foreground (GUI or --server)"
    echo "  status             Check status of background service"
    echo "  logs               Follow live logs of background service"
    echo "  uninstall          Stop and remove service, desktop launcher & binary"
    echo ""
    echo "Flags:"
    echo "  --share, -s        Enable local network Wi-Fi mobile sharing"
    echo "  --port, -p <num>   Set HTTP port (default: 8080)"
    echo "  --server           Run in headless server mode (with 'run')"
    echo ""
    echo "Examples:"
    echo "  $0 install --share"
    echo "  $0 run"
    echo "  $0 status"
    echo "  $0 logs"
    echo "  $0 uninstall"
    echo ""
}

install_go() {
    # 1. Check if 'mise' version manager is present
    if command -v mise >/dev/null 2>&1; then
        echo -e "${BLUE}▶ Detected 'mise' version manager. Installing Go via mise...${NC}"
        if mise use -g go@latest || mise install go@latest; then
            mise use -g go@latest 2>/dev/null || true
            export PATH="${HOME}/.local/share/mise/shims:${PATH}"
            if command -v go >/dev/null 2>&1; then
                echo -e "${GREEN}✅ Go successfully installed via mise: $(go version)${NC}"
                return 0
            fi
        fi
    fi

    # 2. Standalone official Go binary tarball installation to ~/.local/go
    echo -e "${BLUE}▶ Installing official Go binary to '${HOME}/.local/go'...${NC}"
    local arch="$(uname -m)"
    local go_arch="amd64"
    case "${arch}" in
        x86_64|amd64)   go_arch="amd64" ;;
        aarch64|arm64)  go_arch="arm64" ;;
        armv7*|armv6*)  go_arch="armv6l" ;;
        i386|i686)      go_arch="386" ;;
        *)              go_arch="amd64" ;;
    esac

    local go_ver=""
    if command -v curl >/dev/null 2>&1; then
        go_ver=$(curl -sSL "https://go.dev/VERSION?m=text" 2>/dev/null | head -n 1)
    elif command -v wget >/dev/null 2>&1; then
        go_ver=$(wget -qO- "https://go.dev/VERSION?m=text" 2>/dev/null | head -n 1)
    fi
    [ -z "${go_ver}" ] && go_ver="go1.23.6"

    local tarball="${go_ver}.linux-${go_arch}.tar.gz"
    local download_url="https://go.dev/dl/${tarball}"
    local tmp_dest="/tmp/${tarball}"

    echo -e "${BLUE}  Downloading ${download_url}...${NC}"
    local dl_ok=0
    if command -v curl >/dev/null 2>&1; then
        curl -fSL "${download_url}" -o "${tmp_dest}" && dl_ok=1
    elif command -v wget >/dev/null 2>&1; then
        wget -q --show-progress "${download_url}" -O "${tmp_dest}" && dl_ok=1
    fi

    if [ "${dl_ok}" -eq 1 ] && [ -f "${tmp_dest}" ]; then
        mkdir -p "${HOME}/.local"
        rm -rf "${HOME}/.local/go"
        tar -C "${HOME}/.local" -xzf "${tmp_dest}"
        rm -f "${tmp_dest}"
        export PATH="${HOME}/.local/go/bin:${PATH}"
        if [ -x "${HOME}/.local/go/bin/go" ]; then
            for rc in "${HOME}/.bashrc" "${HOME}/.zshrc" "${HOME}/.profile"; do
                if [ -f "${rc}" ] && ! grep -q '/.local/go/bin' "${rc}"; then
                    echo 'export PATH="${HOME}/.local/go/bin:${PATH}"' >> "${rc}"
                fi
            done
            echo -e "${GREEN}✅ Go successfully installed: $(${HOME}/.local/go/bin/go version)${NC}"
            return 0
        fi
    fi

    # 3. System package manager fallback (if sudo is available)
    if command -v sudo >/dev/null 2>&1; then
        echo -e "${BLUE}▶ Attempting installation via system package manager...${NC}"
        if command -v pacman >/dev/null 2>&1; then
            sudo pacman -Sy --noconfirm go && return 0
        elif command -v apt-get >/dev/null 2>&1; then
            sudo apt-get update && sudo apt-get install -y golang-go && return 0
        elif command -v dnf >/dev/null 2>&1; then
            sudo dnf install -y golang && return 0
        elif command -v apk >/dev/null 2>&1; then
            sudo apk add go && return 0
        fi
    fi

    return 1
}

ensure_go() {
    if command -v go >/dev/null 2>&1; then
        return 0
    fi
    # Search common Go install locations
    local candidate_paths=(
        "${HOME}/.local/share/mise/shims"
        "${HOME}/.local/go/bin"
        "/usr/local/go/bin"
        "${HOME}/go/bin"
        "${HOME}/.asdf/shims"
        "${HOME}/.nix-profile/bin"
        "/snap/bin"
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

    # If Go is not found, automatically install and setup
    echo -e "${YELLOW}⚠️  Go is not installed or not in PATH.${NC}"
    echo -e "${BLUE}📦 Automatically setting up Go environment...${NC}"
    if install_go; then
        return 0
    fi
    return 1
}

setup_dependencies() {
    echo -e "${YELLOW}📦 Checking and setting up dependencies...${NC}"

    # 1. Ensure Go is installed and in PATH
    if ! ensure_go; then
        echo -e "${RED}❌ Error: 'go' could not be found or installed automatically.${NC}"
        echo -e "${RED}   Please install Go manually: https://go.dev/dl/${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ Go compiler:${NC} $(go version)"

    # 2. Ensure data directories exist
    mkdir -p "${INSTALL_DATA_DIR}"
    mkdir -p "${SCRIPT_DIR}/data"

    # 3. Ensure Go module dependencies are downloaded
    echo -e "${BLUE}▶ Ensuring project Go module dependencies are ready...${NC}"
    if (cd "${SCRIPT_DIR}" && go mod download); then
        echo -e "${GREEN}✓ Go module dependencies verified${NC}"
    else
        echo -e "${YELLOW}⚠️  Note: Could not run 'go mod download'. Proceeding with cached modules...${NC}"
    fi

    # 4. Verify public assets
    if [ -f "${SCRIPT_DIR}/public/index.html" ]; then
        echo -e "${GREEN}✓ Frontend web assets verified${NC}"
    else
        echo -e "${YELLOW}⚠️  Warning: public/index.html not found in ${SCRIPT_DIR}${NC}"
    fi
}

ensure_binary() {
    if [ ! -x "${SCRIPT_DIR}/${APP_NAME}" ]; then
        echo -e "${YELLOW}Binary not found. Initiating build...${NC}"
        do_build
    fi
}

get_server_args() {
    local args="-server -port ${PORT}"
    if [ "$SHARE" = true ]; then
        args="${args} -share"
    fi
    echo "${args}"
}

do_build() {
    setup_dependencies
    echo -e "${YELLOW}🔨 Building '${APP_NAME}' pure Go binary (CGO_ENABLED=0)...${NC}"
    (cd "${SCRIPT_DIR}" && CGO_ENABLED=0 go build -ldflags="-s -w" -o "${APP_NAME}" .)
    chmod +x "${SCRIPT_DIR}/${APP_NAME}"
    echo -e "${GREEN}✅ Build successful: ${SCRIPT_DIR}/${APP_NAME}${NC}"
}

install_binary_and_assets() {
    echo -e "${BLUE}▶ Installing binary and desktop assets...${NC}"
    mkdir -p "${INSTALL_BIN_DIR}"
    mkdir -p "${INSTALL_DATA_DIR}"
    mkdir -p "${INSTALL_ICON_DIR}"
    mkdir -p "${HOME}/.local/share/pixmaps"

    cp -f "${SCRIPT_DIR}/${APP_NAME}" "${INSTALL_BIN_DIR}/${APP_NAME}"
    chmod +x "${INSTALL_BIN_DIR}/${APP_NAME}"

    if [ -f "${SCRIPT_DIR}/public/favicon.svg" ]; then
        cp -f "${SCRIPT_DIR}/public/favicon.svg" "${INSTALL_ICON_DIR}/${APP_NAME}.svg"
        cp -f "${SCRIPT_DIR}/public/favicon.svg" "${HOME}/.local/share/pixmaps/${APP_NAME}.svg"
    fi
}

install_desktop_entry() {
    ensure_binary
    echo -e "${YELLOW}🖥️  Configuring Linux desktop application launcher...${NC}"
    mkdir -p "${INSTALL_APP_DIR}"
    install_binary_and_assets

    local bin_args=""
    if [ "$SHARE" = true ]; then
        bin_args=" -share"
    fi

    local desktop_file="${INSTALL_APP_DIR}/rentbill.desktop"
    cat <<EOF > "${desktop_file}"
[Desktop Entry]
Name=RentBill
GenericName=Rental & Billing Manager
Comment=Manage tenants, utility meter calculations, and rent receipts
Exec=${INSTALL_BIN_DIR}/${APP_NAME}${bin_args}
Icon=${INSTALL_ICON_DIR}/${APP_NAME}.svg
Terminal=false
Type=Application
Categories=Office;Finance;Utility;
Keywords=rent;bill;tenant;property;finance;
StartupNotify=true
Path=${INSTALL_DATA_DIR}
EOF

    chmod +x "${desktop_file}"
    update-desktop-database "${INSTALL_APP_DIR}" 2>/dev/null || true
    echo -e "${GREEN}✓ Desktop launcher ready: ${desktop_file}${NC}"
}

do_install() {
    ensure_binary
    install_desktop_entry

    echo -e "${YELLOW}⚙️  Configuring user systemd service...${NC}"
    mkdir -p "${USER_SYSTEMD_DIR}"
    mkdir -p "${INSTALL_DATA_DIR}"

    # Stop any conflicting standalone foreground process before starting service
    pkill -x "${APP_NAME}" 2>/dev/null || true

    local exec_args="-server -port ${PORT}"
    if [ "$SHARE" = true ]; then
        exec_args="${exec_args} -share"
        echo -e "${GREEN}📡 Local Network (Wi-Fi) sharing enabled in service (Port ${PORT})${NC}"
    fi

    cat <<EOF > "${SERVICE_FILE}"
[Unit]
Description=RentBill Rental Management Service
After=network.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DATA_DIR}
ExecStart=${INSTALL_BIN_DIR}/${APP_NAME} ${exec_args} -db-path ${DEFAULT_DB}
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
    echo "  • Launcher: Desktop menu (Rofi / Wofi / GNOME / KDE)"
    echo "  • Binary:   ${INSTALL_BIN_DIR}/${APP_NAME}"
    echo "  • Database: ${DEFAULT_DB}"
    echo "  • Service:  ${SERVICE_FILE}"
    echo "  • Status:   $0 status"
    echo "  • Logs:     $0 logs"
    echo "  • Local:    http://localhost:${PORT}"
    if [ "$SHARE" = true ]; then
        echo "  • Wi-Fi:    Accessible to mobile phones on the same Wi-Fi network"
    fi
    if [[ ":$PATH:" != *":${INSTALL_BIN_DIR}:"* ]]; then
        echo -e "${YELLOW}  💡 Tip: Ensure '${INSTALL_BIN_DIR}' is in your PATH to run 'rentbill' from any terminal.${NC}"
    fi
}

do_run() {
    ensure_binary
    local args="-port ${PORT}"
    if [ "$SERVER_MODE" = true ]; then
        args="-server ${args}"
    fi
    if [ "$SHARE" = true ]; then
        args="${args} -share"
        echo -e "${GREEN}📡 Local Network (Wi-Fi) sharing enabled (Port ${PORT})${NC}"
    fi

    if [ "$SERVER_MODE" = true ]; then
        echo -e "${GREEN}🚀 Starting RentBill server in foreground...${NC}"
    else
        echo -e "${GREEN}🚀 Launching RentBill...${NC}"
    fi
    exec "${SCRIPT_DIR}/${APP_NAME}" ${args}
}

do_uninstall() {
    echo -e "${YELLOW}🗑️  Uninstalling RentBill service and desktop launcher...${NC}"

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

    if [ -f "${INSTALL_APP_DIR}/rentbill.desktop" ]; then
        echo "🗑️  Removing desktop launcher..."
        rm -f "${INSTALL_APP_DIR}/rentbill.desktop"
    fi

    if [ -f "${INSTALL_BIN_DIR}/${APP_NAME}" ]; then
        echo "🗑️  Removing installed binary from ${INSTALL_BIN_DIR}..."
        rm -f "${INSTALL_BIN_DIR}/${APP_NAME}"
    fi

    echo "🔄 Reloading systemd user daemon..."
    systemctl --user daemon-reload
    systemctl --user reset-failed 2>/dev/null || true

    echo ""
    echo -e "${GREEN}✅ RentBill uninstalled successfully!${NC}"
    echo "   (Your persistent database in '${INSTALL_DATA_DIR}/' was kept safe)"
}

do_status() {
    systemctl --user status "${SERVICE_NAME}"
}

do_logs() {
    journalctl --user -u "${SERVICE_NAME}" -f
}

do_update() {
    echo -e "${YELLOW}🔄 Updating RentBill...${NC}"
    do_build

    if [ -f "${INSTALL_BIN_DIR}/${APP_NAME}" ]; then
        echo "📦 Updating installed binary in '${INSTALL_BIN_DIR}/${APP_NAME}'..."
        install_binary_and_assets
    fi

    if [ "$SHARE" = true ]; then
        do_install
        return
    fi

    if systemctl --user is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then
        echo "🔁 Restarting background service..."
        systemctl --user restart "${SERVICE_NAME}"
        echo -e "${GREEN}✅ Service restarted with the updated binary!${NC}"
    else
        echo -e "${YELLOW}⚠️  Service is not currently running. Run '$0 install' to start it.${NC}"
    fi
}

# ==============================================================================
# Global CLI Argument Parsing & Command Normalization
# Supports both: ./rentbill.sh <cmd> and ./rentbill.sh --<cmd> with flags in any order
# ==============================================================================
ACTION=""
SHARE=false
PORT="8080"
SERVER_MODE=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --share|-s|--lan|-lan)
            SHARE=true
            shift
            ;;
        --port|-p)
            PORT="$2"
            shift 2
            ;;
        --port=*|-port=*)
            PORT="${1#*=}"
            shift
            ;;
        --server|-server|--headless|-headless)
            SERVER_MODE=true
            shift
            ;;
        install|--install|--server-install|server-install|--install-server)
            ACTION="install"
            shift
            ;;
        run|--run)
            ACTION="run"
            shift
            ;;
        status|--status)
            ACTION="status"
            shift
            ;;
        logs|--logs)
            ACTION="logs"
            shift
            ;;
        uninstall|--uninstall|remove|--remove)
            ACTION="uninstall"
            shift
            ;;
        start|--start)
            ACTION="start"
            shift
            ;;
        stop|--stop)
            ACTION="stop"
            shift
            ;;
        restart|--restart)
            ACTION="restart"
            shift
            ;;
        server|--run-server|run-server)
            ACTION="run"
            SERVER_MODE=true
            shift
            ;;
        desktop|--desktop)
            ACTION="desktop"
            shift
            ;;
        build|--build)
            ACTION="build"
            shift
            ;;
        update|--update)
            ACTION="update"
            shift
            ;;
        setup|--setup|deps|--deps)
            ACTION="setup"
            shift
            ;;
        help|--help|-h|"")
            ACTION="help"
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            exit 1
            ;;
    esac
done

# Print banner once for non-help actions
if [ "${ACTION}" != "help" ] && [ -n "${ACTION}" ]; then
    print_banner
fi

case "${ACTION}" in
    install)
        do_install
        ;;
    run)
        do_run
        ;;
    status)
        do_status
        ;;
    logs)
        do_logs
        ;;
    uninstall)
        do_uninstall
        ;;
    start)
        systemctl --user start "${SERVICE_NAME}"
        echo -e "${GREEN}✅ RentBill service started.${NC}"
        ;;
    stop)
        systemctl --user stop "${SERVICE_NAME}"
        echo -e "${YELLOW}🛑 RentBill service stopped.${NC}"
        ;;
    restart)
        systemctl --user restart "${SERVICE_NAME}"
        echo -e "${GREEN}🔄 RentBill service restarted.${NC}"
        ;;
    build)
        do_build
        ;;
    desktop)
        install_desktop_entry
        ;;
    update)
        do_update
        ;;
    setup)
        setup_dependencies
        echo -e "${GREEN}✅ All dependent resources successfully verified and ready!${NC}"
        ;;
    help|"")
        usage
        ;;
esac
