package main

import (
        "fmt"
        "net/http"

        "github.com/gin-contrib/sessions"
        "github.com/gin-contrib/sessions/cookie"
        "github.com/gin-gonic/gin"
        "rentbill/internal/config"
        "rentbill/internal/database"
        "rentbill/internal/handlers"
        "rentbill/internal/middleware"
)

func main() {
        gin.SetMode(gin.ReleaseMode)
        config.InitConfig()
        database.InitDB()
        database.StartAutoBackup()
        defer database.DB.Close()

        r := gin.New()
        r.Use(gin.Logger(), gin.Recovery())

        store := cookie.NewStore([]byte(config.AppConfig.SessionSecret))
        store.Options(sessions.Options{
                Path:     "/",
                MaxAge:   86400 * 30,
                HttpOnly: true,
                SameSite: http.SameSiteLaxMode,
        })
        r.Use(sessions.Sessions("rent_pro_session", store))

        // Static files
        r.StaticFile("/", "./public/index.html")
        r.StaticFile("/sw.js", "./public/sw.js")
        r.StaticFile("/manifest.json", "./public/manifest.json")
        r.StaticFile("/favicon.ico", "./public/icon.svg")
        r.StaticFile("/style.css", "./public/css/style.css")
        r.Static("/js", "./public/js")
        r.Static("/css", "./public/css")
        r.Static("/public", "./public")

        api := r.Group("/api")
        {
                // Public Auth
                api.POST("/auth/verify", handlers.VerifyPin)
                api.POST("/auth/forgot-pin", handlers.ForgotPin)

                // Protected Routes
                auth := api.Group("/")
                auth.Use(middleware.IsAuthenticated())
                {
                        // System
                        auth.GET("/logs", handlers.GetLogs)
                        auth.GET("/settings", handlers.GetSettings)
                        auth.POST("/settings", handlers.UpdateSettings)
                        auth.POST("/settings/test-email", handlers.TestEmail)
                        auth.POST("/db/backup", handlers.CreateBackup)
                        auth.POST("/db/restore", handlers.RestoreDatabase)
                        auth.POST("/auth/check-pin", handlers.CheckPin)
                        auth.GET("/reports/audit/:month", handlers.GetAuditReport)

                        // Renters
                        auth.GET("/renters", handlers.GetRenters)
                        auth.GET("/renter/:id", handlers.GetRenter)
                        auth.POST("/renters", handlers.CreateRenter)
                        auth.PUT("/renters/:id", handlers.UpdateRenter)
                        auth.DELETE("/renters/:id", handlers.DeleteRenter)
                        auth.POST("/vacant", handlers.MarkVacant)
                        auth.POST("/restore", handlers.RestoreRenter)
                        auth.GET("/renters/history", handlers.GetRenterHistory)

                        // Bills
                        auth.GET("/bills/:renter_id", handlers.GetBills)
                        auth.GET("/bill/:id", handlers.GetBill)
                        auth.POST("/bills", handlers.CreateBill)
                        auth.PUT("/bills/:id/pay", handlers.PayBill)
                        auth.DELETE("/bills/:id", handlers.DeleteBill)
                        auth.POST("/bills/email", handlers.SendBillEmail)
                        auth.GET("/reports/monthly/:month", handlers.GetMonthlyReport)
                        auth.GET("/reports/financial-summary", handlers.GetFinancialSummary)
                        auth.GET("/reports/pending-bills", handlers.GetAllPendingBills)
			auth.GET("/reports/tenant-ledger", handlers.GetTenantLedger)
                        auth.GET("/reports/all-paid-bills", handlers.GetAllPaidBills)
                        auth.GET("/last-eb/:renter_id", handlers.GetLastEB)

                        // Expenses
                        auth.GET("/expenses", handlers.GetExpenses)
                        auth.POST("/expenses", handlers.CreateExpense)
                        auth.DELETE("/expenses/:id", handlers.DeleteExpense)

                        // Withdrawals
                        auth.GET("/withdrawals", handlers.GetOwnerWithdrawals)
                        auth.POST("/withdrawals", handlers.CreateOwnerWithdrawal)
                        auth.DELETE("/withdrawals/:id", handlers.DeleteOwnerWithdrawal)
                }
        }

        fmt.Printf("Rent Bill Pro starting on :%d\n", config.AppConfig.ServerPort)
        r.Run(fmt.Sprintf(":%d", config.AppConfig.ServerPort))
}
