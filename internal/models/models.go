package models

import "time"

type Config struct {
	DbPath            string             `json:"db_path"`
	MasterPinHash     string             `json:"master_pin_hash"`
	Username          string             `json:"username"`
	EmailUser         string             `json:"email_user"`
	EmailPass         string             `json:"email_pass"`
	EmailBCC          string             `json:"email_bcc"`
	SessionSecret     string             `json:"session_secret"`
	ServerPort        int                `json:"server_port"`
	ReceivingAccounts []ReceivingAccount `json:"receiving_accounts"`
}

type ReceivingAccount struct {
	OwnerName     string `json:"owner_name"`
	Label         string `json:"label"`
	UPI           string `json:"upi"`
	BankName      string `json:"bank_name"`
	AccountNumber string `json:"account_number"`
	IFSC          string `json:"ifsc"`
}

type Renter struct {
	ID               int     `json:"id"`
	Name             string  `json:"name"`
	RoomNo           string  `json:"room_no"`
	AadharNo         string  `json:"aadhar_no"`
	MoveInDate       string  `json:"move_in_date"`
	AdvanceAmount    float64 `json:"advance_amount"`
	BaseRent         float64 `json:"base_rent"`
	EBUnitPrice      float64 `json:"eb_unit_price"`
	WaterMaint       float64 `json:"water_maint"`
	IsActive         int     `json:"is_active"`
	MobileNumber     string  `json:"mobile_number"`
	Email            string  `json:"email"`
	InitialEB        float64 `json:"initial_eb"`
	PermanentAddr    string  `json:"perm_address"`
	EmergencyContact string  `json:"emergency_contact"`
	Occupation       string  `json:"occupation"`
	AssignedUPI      string  `json:"assigned_upi"`
	PendingArrears   float64 `json:"pending_arrears"`
}

type Bill struct {
	ID              int      `json:"id"`
	RenterID        int      `json:"renter_id"`
	BillingMonth    string   `json:"billing_month"`
	PrevEBReading   float64  `json:"prev_eb_reading"`
	CurrEBReading   float64  `json:"curr_eb_reading"`
	Others          float64  `json:"others"`
	TotalAmount     float64  `json:"total_amount"`
	IsPaid          int      `json:"is_paid"`
	PaymentMethod   *string  `json:"payment_method"`
	PaymentDetails  *string  `json:"payment_details"`
	PaymentDate     *string  `json:"payment_date"`
	DateGenerated   string   `json:"date_generated"`
	Notes           string   `json:"notes"`
	RentAmount      float64  `json:"rent_amount"`
	WaterAmount     float64  `json:"water_amount"`
	PaidAmount      float64  `json:"paid_amount"`
	DiscountAmount  float64  `json:"discount_amount"`
	WriteOffAmount  float64  `json:"write_off_amount"`
	ArrearsAmount   float64  `json:"arrears_amount"`
	ArrearsIncluded float64  `json:"arrears_included"`
}

type Expense struct {
	ID        int     `json:"id"`
	Category  string  `json:"category"`
	Amount    float64 `json:"amount"`
	Date      string  `json:"date"`
	Notes     string  `json:"notes"`
	OwnerName string  `json:"owner_name"`
	Timestamp string  `json:"timestamp"`
}

type ActivityLog struct {
	ID        int       `json:"id"`
	Action    string    `json:"action"`
	Details   string    `json:"details"`
	Username  string    `json:"username"`
	Timestamp time.Time `json:"timestamp"`
}

type OwnerWithdrawal struct {
	ID        int     `json:"id"`
	OwnerName string  `json:"owner_name"`
	Amount    float64 `json:"amount"`
	Date      string  `json:"date"`
	Notes     string  `json:"notes"`
	Timestamp string  `json:"timestamp"`
}
