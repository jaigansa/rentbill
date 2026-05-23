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

// GetIndexHTML returns the content of index.html
func GetIndexHTML() []byte {
	index, err := UIAssets.ReadFile("ui/index.html")
	if err != nil {
		panic(err)
	}
	return index
}
