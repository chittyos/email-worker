#!/bin/bash

# Deploy nevershitty.com Email Setup with Cloudflare + Google Workspace

set -e

DOMAIN="nevershitty.com"
WORKER_NAME="nevershitty-email-worker"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}✓${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }
warning() { echo -e "${YELLOW}⚠${NC} $1"; }

echo ""
echo "═══════════════════════════════════════════════"
echo " Deploying Email Setup for $DOMAIN"
echo "═══════════════════════════════════════════════"
echo ""

# Step 1: Check prerequisites
log "Checking prerequisites..."

if ! command -v wrangler &> /dev/null; then
    error "Wrangler CLI not found. Install with: npm install -g wrangler"
fi

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    warning "CLOUDFLARE_API_TOKEN not set. You'll need to authenticate."
fi

# Step 2: Deploy Email Worker
log "Deploying Cloudflare Email Worker..."

if [ -f "nevershitty-email-worker.js" ]; then
    wrangler deploy --config nevershitty-email-wrangler.toml
    log "Email worker deployed successfully"
else
    error "nevershitty-email-worker.js not found"
fi

# Step 3: Configure DNS Records
log "Configuring DNS records..."

cat << EOF

${YELLOW}Manual DNS Configuration Required:${NC}

1. Go to Cloudflare Dashboard → $DOMAIN → DNS

2. Add these MX records:
   Priority | Name | Mail Server
   ---------|------|---------------------------
   1        | @    | route1.mx.cloudflare.net
   2        | @    | route2.mx.cloudflare.net  
   3        | @    | route3.mx.cloudflare.net

3. Add SPF record:
   Type: TXT
   Name: @
   Content: "v=spf1 include:_spf.mx.cloudflare.net include:_spf.google.com ~all"

4. Add DMARC record:
   Type: TXT
   Name: _dmarc
   Content: "v=DMARC1; p=quarantine; rua=mailto:dmarc@$DOMAIN"

EOF

# Step 4: Configure Email Routing
log "Setting up Email Routing..."

cat << EOF

${YELLOW}Email Routing Configuration:${NC}

1. Go to Cloudflare → Email → Email Routing
2. Enable Email Routing for $DOMAIN
3. Configure routing rules:
   - Set catch-all to forward to your Google Workspace
   - Add custom addresses as needed

4. In Google Admin Console:
   - Select "I use another mail server"
   - Verify domain ownership
   - Configure DKIM signing

EOF

# Step 5: Test configuration
log "Testing configuration..."

echo ""
echo "Run these commands to test:"
echo ""
echo "  # Check MX records"
echo "  dig MX $DOMAIN +short"
echo ""
echo "  # Check SPF record"
echo "  dig TXT $DOMAIN +short | grep spf"
echo ""
echo "  # Check worker status"
echo "  wrangler tail $WORKER_NAME"
echo ""
echo "  # Send test email"
echo "  echo 'Test' | mail -s 'Test Email' test@$DOMAIN"
echo ""

log "Deployment complete!"
log "Email flow: External → Cloudflare MX → Email Worker → Google Workspace"
log "Monitor worker logs with: wrangler tail $WORKER_NAME"