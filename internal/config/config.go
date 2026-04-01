package config

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
	"time"

	"golang.org/x/crypto/bcrypt"
	"rentbill/internal/models"
)

var AppConfig models.Config
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
		AppConfig = models.Config{
			DbPath:        "./rentbill.db",
			MasterPinHash: hash,
			Username:      "admin",
			SessionSecret: fmt.Sprintf("%x", time.Now().UnixNano()),
			ServerPort:    8080,
		}
		SaveConfig()
	} else {
		file, _ := os.ReadFile(ConfigPath)
		json.Unmarshal(file, &AppConfig)
		if AppConfig.MasterPinHash == "" {
			hash, _ := HashPassword("1234")
			AppConfig.MasterPinHash = hash
			SaveConfig()
		}
		if AppConfig.ServerPort == 0 {
			AppConfig.ServerPort = 8080
		}
		if AppConfig.EmailPass != "" {
			AppConfig.EmailPass, _ = decrypt(AppConfig.EmailPass, AppConfig.SessionSecret)
		}
	}
	if AppConfig.SessionSecret == "" || AppConfig.SessionSecret == "rent-bill-pro-default-secret-key-123" {
		AppConfig.SessionSecret = fmt.Sprintf("s-%x", time.Now().UnixNano())
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
