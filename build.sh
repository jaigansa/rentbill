#!/bin/bash

# RentBill Pro: Unified Build Script
PACK_ONLY=false

# Parse arguments
for arg in "$@"; do
    if [ "$arg" == "--pack" ]; then
        PACK_ONLY=true
    fi
done

echo "🚀 Starting build process..."

# 1. Build Go Binary
echo "Hamster Building Go application..."
go build -o rentbill ./cmd/rentbill/main.go
if [ $? -ne 0 ]; then
    echo "❌ Go Build failed!"
    exit 1
fi

# 2. Handle Archiving if --pack is used
if [ "$PACK_ONLY" = true ]; then
    echo "📦 Packaging for deployment (--pack)..."
    DIST_DIR="rentbill_release"
    rm -rf $DIST_DIR
    mkdir -p $DIST_DIR/backups

    # Copy Files
    cp rentbill $DIST_DIR/
    cp -r public $DIST_DIR/
    
    if [ -f "config.json" ]; then
        cp config.json $DIST_DIR/config.json.template
    fi

    # Compress
    echo "📚 Creating compressed archive..."
    TAR_FILE="rentbill_deploy.tar.gz"
    tar -czf $TAR_FILE $DIST_DIR

    # Cleanup release folder
    rm -rf $DIST_DIR
    # We remove the local binary only when packing
    rm rentbill

    echo "-------------------------------------------"
    echo "✅ Build & Pack Complete!"
    echo "📦 Archive: $TAR_FILE"
    echo "-------------------------------------------"
else
    echo "-------------------------------------------"
    echo "✅ Build Complete! (Binary kept at root)"
    echo "🚀 Run with: ./rentbill"
    echo "-------------------------------------------"
fi
