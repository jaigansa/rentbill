package api

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

var AppConfig Config
var ConfigPath = "./config.json"

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 14)
	return string(bytes), err
}

func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

func encrypt(plaintext, key string) (string, error) {
	if key == "" {
		return plaintext, nil
	}
	k := make([]byte, 32)
	copy(k, key)
	block, err := aes.NewCipher(k)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return "ENC:" + base64.StdEncoding.EncodeToString(ciphertext), nil
}

func decrypt(ciphertext, key string) (string, error) {
	if !strings.HasPrefix(ciphertext, "ENC:") || key == "" {
		return ciphertext, nil
	}
	k := make([]byte, 32)
	copy(k, key)
	data, err := base64.StdEncoding.DecodeString(ciphertext[4:])
	if err != nil {
		return ciphertext, nil
	}
	block, err := aes.NewCipher(k)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}
	nonce, ciphertextBytes := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertextBytes, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

func InitConfig() {
	if _, err := os.Stat(ConfigPath); os.IsNotExist(err) {
		hash, _ := HashPassword("1234")
		AppConfig = Config{
			DbPath:          "./rentbill.db",
			MasterPinHash:   hash,
			Username:        "admin",
			PropertyName:    "RENTBILL PRO",
			PropertyAddress: "Property Management System",
			SessionSecret:   "rb-pro-secret-key-change-me-for-security-2026",
			ServerPort:      8080,
		}
		SaveConfig()
	} else {
		file, _ := os.ReadFile(ConfigPath)
		json.Unmarshal(file, &AppConfig)
		if AppConfig.PropertyName == "" {
			AppConfig.PropertyName = "RENTBILL PRO"
		}
		if AppConfig.PropertyAddress == "" {
			AppConfig.PropertyAddress = "Property Management System"
		}
		if AppConfig.AgreementTerms == "" {
			AppConfig.AgreementTerms = `1. LEASE PERIOD: 11 Months. Extension subject to mutual agreement.
2. PAYMENT: Rent must be paid on or before the 5th of every month.
3. SECURITY DEPOSIT: Interest-free advance, refundable on vacancy.
4. MAINTENANCE: Tenant is responsible for internal minor repairs.
5. USAGE: Premises to be used for residential purposes only.
6. NOTICE PERIOD: 1 month written notice required from either party.`
		}
		if AppConfig.MasterPinHash == "" {
			hash, _ := HashPassword("1234")
			AppConfig.MasterPinHash = hash
			SaveConfig()
		}
		if AppConfig.StaffPinHash == "" {
			hash, _ := HashPassword("0000")
			AppConfig.StaffPinHash = hash
			SaveConfig()
		}
		if AppConfig.ServerPort == 0 {
			AppConfig.ServerPort = 8080
		}
		if AppConfig.EmailPass != "" {
			AppConfig.EmailPass, _ = decrypt(AppConfig.EmailPass, AppConfig.SessionSecret)
		}
	}
	if len(AppConfig.SessionSecret) < 16 {
		AppConfig.SessionSecret = "rentbill-secure-session-fallback-secret-2024"
		SaveConfig()
	}
}

func SaveConfig() {
	tempConfig := AppConfig
	if tempConfig.EmailPass != "" {
		tempConfig.EmailPass, _ = encrypt(tempConfig.EmailPass, AppConfig.SessionSecret)
	}
	data, _ := json.MarshalIndent(tempConfig, "", "  ")
	os.WriteFile(ConfigPath, data, 0600)
}
