package api

import "time"

type Config struct {
	DbPath            string             `json:"db_path"`
	MasterPinHash     string             `json:"master_pin_hash"`
	StaffPinHash      string             `json:"staff_pin_hash"`
	Username          string             `json:"username"`
	PropertyName      string             `json:"property_name"`
	PropertyAddress   string             `json:"property_address"`
	AgreementTerms    string             `json:"agreement_terms"`
	EmailUser         string             `json:"email_user"`
	EmailPass         string             `json:"email_pass"`
	EmailBCC          string             `json:"email_bcc"`
	EmailHost         string             `json:"email_host"`
	EmailPort         int                `json:"email_port"`
	SessionSecret     string             `json:"session_secret"`
	ServerPort        int                `json:"server_port"`
	ReceivingAccounts []ReceivingAccount `json:"receiving_accounts"`
}

type ReceivingAccount struct {
	OwnerName       string `json:"owner_name"`
	Label           string `json:"label"`
	UPI             string `json:"upi"`
	BankName        string `json:"bank_name"`
	AccountNumber   string `json:"account_number"`
	IFSC            string `json:"ifsc"`
	PropertyName    string `json:"property_name"`
	PropertyAddress string `json:"property_address"`
	AgreementTerms  string `json:"agreement_terms"`
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
	MaintCharge      float64 `json:"maint_charge"`
	IsActive         int     `json:"is_active"`
	MobileNumber     string  `json:"mobile_number"`
	Email            string  `json:"email"`
	InitialEB        float64 `json:"initial_eb"`
	PermanentAddr    string  `json:"perm_address"`
	EmergencyContact string  `json:"emergency_contact"`
	Occupation       string  `json:"occupation"`
	AssignedUPI      string  `json:"assigned_upi"`
	PendingArrears   float64 `json:"pending_arrears"`
	PasswordHash     string  `json:"-"`
	AgreementExpiryDate string `json:"agreement_expiry_date"`
	WaterCalcMode    string  `json:"water_calc_mode"`
	WaterUnitPrice   float64 `json:"water_unit_price"`
	InitialWater     float64 `json:"initial_water"`
	VacateDate          *string  `json:"vacate_date,omitempty"`
	ExitRefundAmount    *string  `json:"exit_refund_amount,omitempty"`
	ExitDuesDeducted    *float64 `json:"exit_dues_deducted,omitempty"`
	ExitRepairsDeducted *float64 `json:"exit_repairs_deducted,omitempty"`
	ExitRefundLabel     *string  `json:"exit_refund_label,omitempty"`
	ExitBalance         *float64 `json:"exit_balance,omitempty"`
	ExitEBReading       *string  `json:"exit_eb_reading,omitempty"`
	ExitReason          *string  `json:"exit_reason,omitempty"`
	ExitRentDue         *float64 `json:"exit_rent_due,omitempty"`
	ExitEBDue           *float64 `json:"exit_eb_due,omitempty"`
}

type Bill struct {
	ID              int     `json:"id"`
	RenterID        int     `json:"renter_id"`
	BillingMonth    string  `json:"billing_month"`
	PrevEBReading   float64 `json:"prev_eb_reading"`
	CurrEBReading   float64 `json:"curr_eb_reading"`
	Others          float64 `json:"others"`
	TotalAmount     float64 `json:"total_amount"`
	IsPaid          int     `json:"is_paid"`
	PaymentMethod   *string `json:"payment_method"`
	PaymentDetails  *string `json:"payment_details"`
	PaymentDate     *string `json:"payment_date"`
	DateGenerated   string  `json:"date_generated"`
	Notes           string  `json:"notes"`
	RentAmount      float64 `json:"rent_amount"`
	WaterAmount     float64 `json:"water_amount"`
	MaintAmount     float64 `json:"maint_amount"`
	PaidAmount      float64 `json:"paid_amount"`
	DiscountAmount  float64 `json:"discount_amount"`
	WriteOffAmount  float64 `json:"write_off_amount"`
	ArrearsAmount   float64 `json:"arrears_amount"`
	ArrearsIncluded float64 `json:"arrears_included"`
	ProofStatus     string  `json:"proof_status,omitempty"`
	ProofRef        *string `json:"proof_ref,omitempty"`
	ProofPhoto      *string `json:"proof_photo,omitempty"`
	ProofDate       *string `json:"proof_date,omitempty"`
	PrevWaterReading float64 `json:"prev_water_reading"`
	CurrWaterReading float64 `json:"curr_water_reading"`
	WaterUnitPrice   float64 `json:"water_unit_price"`
	WaterCalcMode    string  `json:"water_calc_mode"`
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
	Amount    float64   `json:"amount"`
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

type MaintenanceTask struct {
	ID            int     `json:"id"`
	RenterID      *int    `json:"renter_id"` // Optional link to unit
	UnitRoom      string  `json:"unit_room,omitempty"`
	Title         string  `json:"title"`
	Description   string  `json:"description"`
	Category      string  `json:"category"`
	Priority      string  `json:"priority"`
	Status        string  `json:"status"` // Pending, In Progress, Resolved
	OwnerName     string  `json:"owner_name"`
	EstimatedCost float64 `json:"estimated_cost"`
	ActualCost    float64 `json:"actual_cost"`
	DateReported  string  `json:"date_reported"`
	DateResolved  *string `json:"date_resolved"`
	PhotoPath     string  `json:"photo_path"`
	Timestamp     string  `json:"timestamp"`
}

type Document struct {
	ID         int    `json:"id"`
	RenterID   *int   `json:"renter_id"`
	UnitRoom   string `json:"unit_room,omitempty"`
	FileName   string `json:"file_name"`
	FilePath   string `json:"file_path"`
	FileType   string `json:"file_type"` // ID Proof, Lease, Other
	UploadDate string `json:"upload_date"`
	ExpiryDate string `json:"expiry_date,omitempty"`
	Notes      string `json:"notes"`
}
