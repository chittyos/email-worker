# Setting Up "Send As" for Outgoing Emails

Since Cloudflare Email Workers only handle incoming mail, outgoing emails need to be configured in Google Workspace/Gmail.

## Quick Setup for Each Domain

### For nick@jeanarlene.com (your primary):

1. In Gmail, go to Settings → Accounts and Import
2. Under "Send mail as", click "Add another email address"
3. Add these addresses:
   - nick@nevershitty.com
   - nick@chitty.cc
   - nick@chittychat.com
   - nick@chittyos.com
   - nick@mrniceweird.com
   - nick@chittyrouter.com

### For mgmt@aribia.llc:

Add these send-as addresses:
- admin@[each domain]
- support@[each domain]
- legal@[each domain]
- security@[each domain]
- web@[each domain]
- postmaster@[each domain]

### For sharon@itcanbellc.com:

Add:
- sharon@[each domain]

## SMTP Configuration

For each "Send As" address, use:
- **SMTP Server**: smtp.gmail.com
- **Port**: 587 (TLS) or 465 (SSL)
- **Username**: Your Google Workspace email
- **Password**: App-specific password (generate in Google Account settings)

## Automatic Reply-From

Once configured, Gmail will automatically:
1. Reply from the address the email was sent to
2. Show a dropdown to choose which address to send from
3. Remember your preference per recipient

## SPF/DKIM/DMARC Setup

For proper deliverability, ensure each domain has:

```dns
# SPF (already configured)
TXT @ "v=spf1 include:_spf.mx.cloudflare.net include:_spf.google.com ~all"

# DKIM (need to add for each domain)
TXT google._domainkey "[DKIM key from Google Admin]"

# DMARC
TXT _dmarc "v=DMARC1; p=quarantine; rua=mailto:dmarc@[domain]"
```

## Google Workspace Admin Setup

If you have Google Workspace admin access:

1. Go to Admin Console → Apps → Google Workspace → Gmail
2. Enable "Let users send mail as their alias"
3. Configure domain aliases for automatic send-as

## Verification Process

For each send-as address:
1. Google sends verification email
2. Our email worker routes it to your inbox
3. Click verify link
4. Address is ready to use

## Pro Tips

- Set nick@nevershitty.com as default "Reply From" for that domain's emails
- Use labels/filters to organize incoming mail by domain
- Consider using different signatures for different domains