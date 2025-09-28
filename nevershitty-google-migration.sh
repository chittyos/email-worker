#!/bin/bash

# Google Workspace Migration for nevershitty.com
# Split Delivery Configuration (Mail routes through intermediate server to Google)

DOMAIN="nevershitty.com"
GOOGLE_MX="ASPMX.L.GOOGLE.COM"
DATE=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="google_migration_${DATE}.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

header() {
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN} $1${NC}"
    echo -e "${GREEN}========================================${NC}\n"
}

# Main execution
header "Google Workspace Migration for $DOMAIN"

log "Migration Type: Split Delivery (Mail Server -> Google)"
log "Target Google MX: $GOOGLE_MX"
log "Configuration started at $(date)"

echo ""
log "IMPORTANT: This setup uses split delivery configuration."
log "Your mail will flow: External Sender -> Your Mail Server -> Google (ASPMX.L.GOOGLE.COM)"
echo ""