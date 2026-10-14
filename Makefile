.PHONY: build run clean test windows mac

# Build single binary for current OS
build:
	go build -ldflags="-s -w" -o rentbill .

# Run the app directly
run:
	go run .

# Run tests
test:
	go test -v ./...

# Cross-compile for Windows (creates rentbill.exe)
windows:
	GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o rentbill.exe .

# Cross-compile for macOS (creates rentbill-darwin)
mac:
	GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o rentbill-darwin .

# Clean build artifacts
clean:
	rm -f rentbill rentbill.exe rentbill-darwin
