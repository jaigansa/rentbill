package main

import (
	"embed"
	"io/fs"
	"net/http"
)

// --- STATIC ASSETS ---

// UIAssets holds the embedded static files
//go:embed all:ui
var UIAssets embed.FS

// GetPublicFS returns the FS for the ui directory
func GetPublicFS() http.FileSystem {
	publicDir, err := fs.Sub(UIAssets, "ui")
	if err != nil {
		panic(err)
	}
	return http.FS(publicDir)
}

// GetIndexHTML returns the permanent HTML content from ui/index.html.
func GetIndexHTML() []byte {
	index, err := UIAssets.ReadFile("ui/index.html")
	if err == nil && len(index) > 0 {
		return index
	}

	return []byte("<!DOCTYPE html><html><head><title>RentBill Pro</title></head><body style=\"font-family:sans-serif; text-align:center; padding:3rem;\"><h2>RentBill Pro - UI Initialization Error</h2><p>Unable to load ui/index.html from embedded assets.</p></body></html>")
}

