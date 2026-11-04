# DermAI Health Monitor: Model Rollback Instructions

If for any reason you wish to revert to the previous model checkpoint, follow these simple steps:

## Automatic Rollback
A complete backup of the pre-replacement checkpoint and configurations was created at:
`models/backup_pre_replacement/`

To restore the backup:

### 1. In PowerShell / Terminal:
```powershell
# Navigate to the project root
cd "Z:\skin disease classification - 17 aiml"

# Copy the backup checkpoint back to the primary location
Copy-Item -Path "models\backup_pre_replacement\best_model.pth" -Destination "models\best_model.pth" -Force
```

### 2. Restart the Backend Server:
```powershell
python -u run_server.py
```
The server will automatically reload `models\best_model.pth` upon startup and print the loaded checkpoint information in the logs.

---

## Verifying Restoration:
Run the verification script to verify which checkpoint is currently active:
```powershell
python -u verify_efficientnetv2_s.py
```
