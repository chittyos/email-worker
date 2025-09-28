# Contributing to ChittyOS Email Worker

Thank you for your interest in contributing to the ChittyOS Email Worker!

## Development Setup

1. Clone the repository:
```bash
git clone https://github.com/chittyos/email-worker.git
cd email-worker
```

2. Install dependencies:
```bash
npm install
```

3. Configure Cloudflare authentication:
```bash
wrangler login
```

## Adding New Domains

To add support for a new domain:

1. Edit `email-worker.js`
2. Add domain configuration to `DOMAIN_CONFIG` object:
```javascript
"yourdomain.com": {
  googleWorkspace: true,
  defaultForward: "admin@yourdomain.com",
  routes: {
    "admin": "admin@yourdomain.com",
    "support": "support@yourdomain.com",
  }
}
```

3. Test locally:
```bash
npm run dev
```

4. Deploy:
```bash
npm run deploy
```

## Testing

- Test email routing locally with `wrangler dev`
- Monitor production logs with `wrangler tail email-worker`
- Send test emails to verify routing

## Code Style

- Use ES6+ features
- Keep functions small and focused
- Add comments for complex logic
- Follow existing patterns in the codebase

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Test thoroughly
5. Commit with descriptive messages
6. Push to your fork
7. Open a Pull Request

## Security

- Never commit API keys or secrets
- Report security issues privately to security@chittyos.com
- Follow Cloudflare Worker best practices

## Questions?

- Open an issue for bugs or feature requests
- Contact admin@chittyos.com for other inquiries

## License

By contributing, you agree that your contributions will be licensed under the MIT License.