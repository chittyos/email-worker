# Cloudflare Email Worker

Multi-domain smart email routing for ChittyOS domains through Cloudflare to Google Workspace.

## Features

- **Multi-Domain Support**: Routes email for nevershitty.com, chitty.cc, chittychat.com, chittyos.com, mrniceweird.com, and more
- **Smart Routing**: Per-domain routing rules with custom addresses and catch-all
- **Spam Protection**: Filters spam keywords and suspicious patterns
- **Google Workspace Integration**: Seamless forwarding to Google Workspace accounts
- **Analytics Ready**: Optional KV storage for email metadata

## Supported Domains

- nevershitty.com
- chitty.cc
- chittychat.com
- chittyos.com
- mrniceweird.com
- chittyrouter.com
- (expandable to all 73 ChittyOS domains)

## Email Flow

```
External Sender → Cloudflare MX → Email Worker → Google Workspace
```

## Deployment

```bash
# Deploy the worker
wrangler deploy

# Update DNS records (manual via Cloudflare Dashboard)
./update-nevershitty-dns.sh

# Monitor logs
wrangler tail email-worker
```

## Configuration

Each domain in `email-worker.js` has:
- `googleWorkspace`: Enable Google Workspace forwarding
- `defaultForward`: Catch-all email address
- `routes`: Specific email routing rules

## DNS Requirements

For each domain, configure:

1. **MX Records**:
   - Priority 1: route1.mx.cloudflare.net
   - Priority 2: route2.mx.cloudflare.net
   - Priority 3: route3.mx.cloudflare.net

2. **SPF Record**:
   ```
   v=spf1 include:_spf.mx.cloudflare.net include:_spf.google.com ~all
   ```

3. **DMARC Record**:
   ```
   v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com
   ```

## Google Workspace Setup

1. In Google Admin Console, select "I use another mail server"
2. Configure mail to route through Cloudflare first
3. Verify domain ownership
4. Set up DKIM signing for outbound mail

## Testing

```bash
# Check MX records
dig MX yourdomain.com +short

# Test email routing
echo "Test" | mail -s "Test Email" test@yourdomain.com

# Monitor worker logs
wrangler tail email-worker
```

## Scripts

- `deploy-nevershitty-email.sh` - Deployment automation
- `nevershitty-cloudflare-google-setup.sh` - Setup guide
- `update-nevershitty-dns.sh` - DNS update script (requires API token)

## License

Part of ChittyOS Framework