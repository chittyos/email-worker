#!/bin/bash

# Cloudflare + Google Workspace Setup for nevershitty.com
# Using Cloudflare Email Routing to forward to Google Workspace

DOMAIN="nevershitty.com"
GOOGLE_MX="ASPMX.L.GOOGLE.COM"
CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-}"
CLOUDFLARE_ZONE_ID="${CLOUDFLARE_ZONE_ID:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
info() { echo -e "${BLUE}[INFO]${NC} $1"; }

header() {
    echo -e "\n${BLUE}═══════════════════════════════════════${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════${NC}\n"
}

# Main
header "Cloudflare + Google Workspace Setup"

log "Domain: $DOMAIN"
log "Setup: Cloudflare Email Routing → Google Workspace"
echo ""

# Step 1: Cloudflare DNS Configuration
header "Step 1: Cloudflare DNS Records"

cat << 'EOF'
Required DNS records in Cloudflare:

1. MX Records (for Cloudflare Email Routing):
   Priority | Name | Value
   ---------|------|------------------------
   1        | @    | route1.mx.cloudflare.net
   2        | @    | route2.mx.cloudflare.net
   3        | @    | route3.mx.cloudflare.net

2. TXT Records for SPF:
   Name: @
   Value: "v=spf1 include:_spf.mx.cloudflare.net include:_spf.google.com ~all"

3. DMARC Record:
   Name: _dmarc
   Value: "v=DMARC1; p=quarantine; rua=mailto:dmarc@nevershitty.com"

EOF

echo ""
header "Step 2: Cloudflare Email Routing Setup"

cat << 'EOF'
In Cloudflare Dashboard:

1. Go to Email > Email Routing
2. Enable Email Routing for nevershitty.com
3. Create destination addresses:
   - Add your Google Workspace email addresses
   
4. Create routing rules:
   - Catch-all: Forward to admin@nevershitty.com → your.google.workspace@gmail.com
   - Custom addresses as needed

EOF

echo ""
header "Step 3: Google Workspace Configuration"

cat << 'EOF'
In Google Admin Console:

1. Verify domain ownership (TXT record verification)
2. Since using Cloudflare routing:
   - Click "I use another mail server"
   - Cloudflare will handle the routing
   
3. Configure Google Workspace to accept mail from Cloudflare:
   - Add Cloudflare IPs to allowed senders
   - Configure DKIM signing for outbound mail

4. DKIM Setup:
   - Generate DKIM key in Google Admin
   - Add DKIM record to Cloudflare DNS:
     Name: google._domainkey
     Value: [Your DKIM key from Google]

EOF

echo ""
header "Step 4: Verification Commands"

echo "Test MX records:"
echo "  dig MX $DOMAIN +short"
echo ""
echo "Test SPF record:"
echo "  dig TXT $DOMAIN +short | grep spf"
echo ""
echo "Test DMARC:"
echo "  dig TXT _dmarc.$DOMAIN +short"
echo ""
echo "Test email routing:"
echo "  echo 'Test' | mail -s 'Cloudflare Routing Test' test@$DOMAIN"

echo ""
header "Configuration Summary"

cat << EOF
${GREEN}Email Flow Path:${NC}
External Sender → Cloudflare MX → Cloudflare Email Routing → Google Workspace

${GREEN}Benefits:${NC}
• Cloudflare DDoS protection
• Email routing rules and filtering
• Simplified DNS management
• Google Workspace features

${YELLOW}Next Steps:${NC}
1. Configure Cloudflare Email Routing rules
2. Verify in Google Admin Console
3. Test email delivery
4. Monitor for 24-48 hours
EOF