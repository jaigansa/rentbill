.PHONY: all build setup run open test check clean windows mac mac-intel linux linux-arm64 help

APP_NAME ?= rentbill
VERSION ?= 1.0.0
LDFLAGS ?= -s -w -X 'main.Version=$(VERSION)'

# Default: Build pure Go static binary for current host OS
build:
	CGO_ENABLED=0 go build -ldflags="$(LDFLAGS)" -o $(APP_NAME) .

# Run as local pure Go desktop GUI app
run:
	CGO_ENABLED=0 go run .

# Run with local Wi-Fi sharing on static port 8080
share:
	CGO_ENABLED=0 go run . -share

# Run in headless server mode
server:
	CGO_ENABLED=0 go run . -server -port 8080

# Setup Go compiler and download project dependencies
setup:
	./linux.sh --setup

# Install as auto-starting systemd user service with Wi-Fi mobile sharing
install-share: build
	./rentbill.sh --install --share

# Install as auto-starting systemd user service (local loopback only)
install: build
	./rentbill.sh --install

# Install desktop application launcher with Wi-Fi sharing
desktop: build
	./rentbill.sh --desktop --share

# Run all automated tests
test:
	CGO_ENABLED=0 go test -v ./...

# Verify code cleanliness
check:
	go vet ./...
	@test -z "$$(gofmt -l .)" || (echo "Code formatting required:" && gofmt -l . && exit 1)

# --- Pure Go Cross-Compilation (Zero C Toolchain Required) ---

# Linux AMD64 (Statically linked)
linux:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o $(APP_NAME)-linux-amd64 .

# Linux ARM64 (Raspberry Pi / AWS Graviton / Oracle Ampere)
linux-arm64:
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags="$(LDFLAGS)" -o $(APP_NAME)-linux-arm64 .

# Windows AMD64 (rentbill.exe)
windows:
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o $(APP_NAME).exe .

# macOS Apple Silicon (M1/M2/M3/M4)
mac:
	CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -ldflags="$(LDFLAGS)" -o $(APP_NAME)-darwin-arm64 .

# macOS Intel AMD64
mac-intel:
	CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o $(APP_NAME)-darwin-amd64 .

# Build for all platforms simultaneously
all: build linux linux-arm64 windows mac mac-intel

# Clean compiled binaries
clean:
	rm -f $(APP_NAME) $(APP_NAME).exe $(APP_NAME)-linux-* $(APP_NAME)-darwin-*

help:
	@echo "RentBill - Pure Go Build & Installation Targets:"
	@echo "  make build          Build statically linked binary for current host OS"
	@echo "  make run            Run local pure Go desktop GUI app"
	@echo "  make share          Run with local Wi-Fi mobile sharing enabled (static port 8080)"
	@echo "  make install-share  Install auto-starting background systemd service with Wi-Fi sharing"
	@echo "  make install        Install auto-starting background systemd service (loopback only)"
	@echo "  make desktop        Install desktop application launcher with Wi-Fi sharing"
	@echo "  make test           Run all unit tests"
	@echo "  make check          Run go vet & gofmt checks"
	@echo "  make windows        Cross-compile standalone Windows binary (.exe)"
	@echo "  make mac            Cross-compile macOS Apple Silicon binary"
	@echo "  make mac-intel      Cross-compile macOS Intel binary"
	@echo "  make linux-arm64    Cross-compile Linux ARM64 binary (Raspberry Pi)"
	@echo "  make all            Build binaries for all platforms"
	@echo "  make clean          Remove all compiled binaries"
