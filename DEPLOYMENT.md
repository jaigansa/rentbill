# Deployment Guide - Rent Bill Pro 🚀

Follow these steps to host Rent Bill Pro on a Linux server (Ubuntu/Debian) for 24/7 access.

## 1. Prepare the Server
Ensure you have a Linux VPS with Go and SQLite installed.

## 2. Install using Script
We provide a convenient installation script for Linux environments:
```bash
chmod +x install.sh
sudo ./install.sh
```
This script will:
- Build the binary if missing.
- Create the necessary folders (`/opt/rentbill` and `backups/`).
- **Automatically configure and start the systemd service.**
- Set up proper user/group permissions.

## 3. Manage the Service
Once installed, you can manage the app using standard systemd commands:

```bash
sudo systemctl status rentbill
sudo systemctl restart rentbill
sudo systemctl stop rentbill
```

## 4. Security Recommendations
- **Reverse Proxy**: Use Nginx or Caddy as a reverse proxy to handle SSL (HTTPS) and serve the app on Port 80/443.
- **Firewall**: Ensure only necessary ports (80, 443, 22) are open.
- **Backup Strategy**: Regularly download the `.db` files from the app settings to your local machine.

## 5. Updating the App
To update to a new version:
1. Pull latest code: `git pull`
2. Re-run `./build.sh`
3. Restart service: `sudo systemctl restart rentbill`
