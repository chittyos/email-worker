#!/bin/bash

# Update DNS records for nevershitty.com to use Cloudflare Email Routing

set -e

DOMAIN="nevershitty.com"

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
echo " Updating DNS for $DOMAIN"
echo "═══════════════════════════════════════════════"
echo ""

# Check for Cloudflare API token
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    error "CLOUDFLARE_API_TOKEN not set. Please set it first."
fi

# Get Zone ID
log "Getting Zone ID for $DOMAIN..."
ZONE_RESPONSE=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=$DOMAIN" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json")

ZONE_ID=$(echo "$ZONE_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$ZONE_ID" ]; then
    error "Could not find zone ID for $DOMAIN"
fi

log "Zone ID: $ZONE_ID"

# Get existing DNS records
log "Fetching existing DNS records..."
RECORDS=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?type=MX,TXT" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json")

# Delete existing MX records
log "Removing old MX records..."
echo "$RECORDS" | grep -o '"id":"[^"]*"[^}]*"type":"MX"' | grep -o '"id":"[^"]*' | cut -d'"' -f4 | while read -r record_id; do
    if [ ! -z "$record_id" ]; then
        curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$record_id" \
            -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            -H "Content-Type: application/json" > /dev/null
        echo "  Deleted MX record: $record_id"
    fi
done

# Add Cloudflare Email Routing MX records
log "Adding Cloudflare Email Routing MX records..."

MX_RECORDS=(
    '{"type":"MX","name":"@","content":"route1.mx.cloudflare.net","priority":1,"ttl":1}'
    '{"type":"MX","name":"@","content":"route2.mx.cloudflare.net","priority":2,"ttl":1}'
    '{"type":"MX","name":"@","content":"route3.mx.cloudflare.net","priority":3,"ttl":1}'
)

for mx_record in "${MX_RECORDS[@]}"; do
    RESULT=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        --data "$mx_record")

    if echo "$RESULT" | grep -q '"success":true'; then
        MX_SERVER=$(echo "$mx_record" | grep -o '"content":"[^"]*' | cut -d'"' -f4)
        echo "  Added: $MX_SERVER"
    else
        warning "Failed to add MX record"
        echo "$RESULT" | grep -o '"message":"[^"]*' | cut -d'"' -f4
    fi
done

# Update SPF record
log "Updating SPF record..."

# Find and delete old SPF record
SPF_ID=$(echo "$RECORDS" | grep -o '"id":"[^"]*"[^}]*"v=spf1[^"]*' | grep -o '"id":"[^"]*' | cut -d'"' -f4 | head -1)

if [ ! -z "$SPF_ID" ]; then
    curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$SPF_ID" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" > /dev/null
    echo "  Removed old SPF record"
fi

# Add new SPF record
SPF_RECORD='{"type":"TXT","name":"@","content":"v=spf1 include:_spf.mx.cloudflare.net include:_spf.google.com ~all","ttl":1}'

RESULT=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data "$SPF_RECORD")

if echo "$RESULT" | grep -q '"success":true'; then
    echo "  Added new SPF record for Cloudflare and Google"
else
    warning "Failed to add SPF record"
fi

# Add DMARC record if missing
log "Checking DMARC record..."
DMARC_EXISTS=$(echo "$RECORDS" | grep -c '"name":"_dmarc' || true)

if [ "$DMARC_EXISTS" -eq 0 ]; then
    DMARC_RECORD='{"type":"TXT","name":"_dmarc","content":"v=DMARC1; p=quarantine; rua=mailto:dmarc@nevershitty.com","ttl":1}'

    RESULT=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        --data "$DMARC_RECORD")

    if echo "$RESULT" | grep -q '"success":true'; then
        echo "  Added DMARC record"
    fi
else
    echo "  DMARC record already exists"
fi

echo ""
log "DNS update complete!"
echo ""
echo "Next steps:"
echo "1. Go to Cloudflare Dashboard → Email → Email Routing"
echo "2. Enable Email Routing for $DOMAIN"
echo "3. Configure destination addresses"
echo "4. Set up routing rules to forward to Google Workspace"
echo ""
echo "Testing commands:"
echo "  dig MX $DOMAIN +short"
echo "  dig TXT $DOMAIN +short | grep spf"
echo ""
log "Changes may take 5-10 minutes to propagate"