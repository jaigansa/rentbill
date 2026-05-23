package main

import (
	"fmt"
	"io/fs"
	"net/http"

	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"rentbill/api"
)

func main() {
	gin.SetMode(gin.ReleaseMode)
	
	// Initialize core logic
	api.InitConfig()
	if err := api.InitDB(); err != nil {
		panic(err)
	}
	api.StartAutoBackup()
	defer api.DB.Close()

	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	// Session setup
	store := cookie.NewStore([]byte(api.AppConfig.SessionSecret))
	store.Options(sessions.Options{
		Path:     "/",
		MaxAge:   86400 * 30, // 30 days
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
	})
	r.Use(sessions.Sessions("rent_pro_session", store))

	// Embedded UI Assets
	publicFS := GetPublicFS()
	
	r.GET("/", func(c *gin.Context) {
		c.Data(http.StatusOK, "text/html; charset=utf-8", GetIndexHTML())
	})
	
	// Root level assets
	r.GET("/sw.js", func(c *gin.Context) { c.FileFromFS("sw.js", publicFS) })
	r.GET("/manifest.json", func(c *gin.Context) { c.FileFromFS("manifest.json", publicFS) })
	r.GET("/favicon.ico", func(c *gin.Context) { c.FileFromFS("icon.svg", publicFS) })
	r.GET("/icon.svg", func(c *gin.Context) { c.FileFromFS("icon.svg", publicFS) })
	r.GET("/style.css", func(c *gin.Context) { c.FileFromFS("css/style.css", publicFS) })

	// UI sub-folders
	jsFS, _ := fs.Sub(UIAssets, "ui/js")
	cssFS, _ := fs.Sub(UIAssets, "ui/css")
	fontsFS, _ := fs.Sub(UIAssets, "ui/fonts")
	libsFS, _ := fs.Sub(UIAssets, "ui/libs")
	
	r.StaticFS("/js", http.FS(jsFS))
	r.StaticFS("/css", http.FS(cssFS))
	r.StaticFS("/fonts", http.FS(fontsFS))
	r.StaticFS("/libs", http.FS(libsFS))

	// External storage
	r.Static("/uploads", "./uploads")

	// API Routes
	v1 := r.Group("/api")
	{
		// Public Auth
		v1.POST("/auth/verify", api.VerifyPin)
		v1.POST("/auth/forgot-pin", api.ForgotPin)

		// Real-time Event Stream (Public for connection, but session-checked inside if needed)
		v1.GET("/events/stream", api.SSEHandler)

		// Protected Logic
		auth := v1.Group("/")
		auth.Use(api.IsAuthenticated())
		{
			// Core
			auth.GET("/settings", api.GetSettings)
			auth.POST("/settings", api.UpdateSettings)
			auth.POST("/settings/test-email", api.TestEmail)
			auth.POST("/db/backup", api.CreateBackup)
			auth.POST("/db/restore", api.RestoreDatabase)
			auth.POST("/auth/check-pin", api.CheckPin)
			auth.POST("/auth/logout", api.Logout)
			auth.GET("/logs", api.GetLogs)

			// Management
			auth.GET("/renters", api.GetRenters)
			auth.POST("/renters", api.CreateRenter)
			auth.GET("/renter/:id", api.GetRenter)
			auth.PUT("/renters/:id", api.UpdateRenter)
			auth.DELETE("/renters/:id", api.DeleteRenter)
			auth.POST("/vacant", api.MarkVacant)
			auth.POST("/restore", api.RestoreRenter)
			auth.GET("/renters/history", api.GetRenterHistory)
			auth.GET("/renters/export", api.ExportRentersCSV)
			auth.POST("/renters/import", api.ImportRentersCSV)

			// Bills
			auth.GET("/bills/:renter_id", api.GetBills)
			auth.GET("/bill/:id", api.GetBill)
			auth.POST("/bills", api.CreateBill)
			auth.PUT("/bills/:id/pay", api.PayBill)
			auth.DELETE("/bills/:id", api.DeleteBill)
			auth.POST("/bills/email", api.SendBillEmail)
			auth.GET("/last-eb/:renter_id", api.GetLastEB)

			// Operations
			auth.GET("/expenses", api.GetExpenses)
			auth.POST("/expenses", api.CreateExpense)
			auth.DELETE("/expenses/:id", api.DeleteExpense)
			auth.GET("/withdrawals", api.GetOwnerWithdrawals)
			auth.POST("/withdrawals", api.CreateOwnerWithdrawal)
			auth.DELETE("/withdrawals/:id", api.DeleteOwnerWithdrawal)
			auth.GET("/maintenance", api.GetMaintenanceTasks)
			auth.POST("/maintenance", api.CreateMaintenanceTask)
			auth.PUT("/maintenance/:id", api.UpdateMaintenanceTask)
			auth.DELETE("/maintenance/:id", api.DeleteMaintenanceTask)
			auth.POST("/maintenance/:id/upload", api.UploadMaintenancePhoto)

			// Documents
			auth.GET("/documents", api.GetDocuments)
			auth.POST("/documents/upload", api.UploadDocument)
			auth.DELETE("/documents/:id", api.DeleteDocument)

			// Reports
			auth.GET("/reports/financial-summary", api.GetFinancialSummary)
			auth.GET("/reports/tenant-ledger", api.GetTenantLedger)
			auth.GET("/reports/trends", api.GetTrendData)
			auth.GET("/reports/audit", api.GetAuditReport)
			auth.GET("/reports/monthly/:month", api.GetMonthlyReport)
			auth.GET("/reports/pending-bills", api.GetAllPendingBills)
			auth.GET("/reports/all-paid-bills", api.GetAllPaidBills)
		}
	}

	fmt.Printf("Rent Bill Pro starting on :%d\n", api.AppConfig.ServerPort)
	r.Run(fmt.Sprintf(":%d", api.AppConfig.ServerPort))
}
