# OCR-Portal Roadmap

## Planned

### Process Management
- [ ] Set up PM2 (or Windows Service) for backend/frontend so dev servers survive RDP disconnects and terminal closures

### Entra ID RBAC
- [ ] Integrate Microsoft Entra ID for authentication (SSO foundation already exists via OIDC)
- [ ] Read role/permission assignments from AD Notes field on user objects
- [ ] Map AD Notes values to app roles (viewer, operator, finance_admin, manager, admin)
- [ ] Auto-provision/sync user roles on login based on AD Notes
- [ ] Remove local password auth once Entra ID is fully rolled out (or keep as fallback)

### Security Hardening
- [ ] **CSRF protection** — Add server-side token validation for all state-changing endpoints (POST, PUT, DELETE). SameSite cookies help but don't cover older browsers. The server generates a random token per session; the frontend sends it back with each request; forged requests from malicious sites get rejected because they can't read the token.
- [ ] **Brute force protection** — Lock accounts after N consecutive failed login attempts. Prevents attackers from guessing passwords by trying thousands of combinations. Includes cooldown period and admin unlock capability.
- [ ] **Custom CSP headers** — Configure a Content-Security-Policy tailored to this app instead of Helmet defaults. Tells the browser exactly which domains can serve scripts, styles, images, and API connections. Limits damage from XSS by blocking unauthorized script execution even if injection occurs.
- [ ] **HTTPS/TLS** — Set up TLS termination via reverse proxy (e.g. IIS, nginx) or direct certificate. Encrypts all traffic between browser and server so credentials, tokens, and document data can't be intercepted on the network.
- [ ] **File upload hardening** — Enforce file size limits, validate MIME types against actual file content (not just extension), and reject unexpected formats. Prevents oversized uploads from exhausting disk and blocks disguised malicious files.
- [ ] **Security event logging** — Log failed authentication attempts, authorization denials, and rate limit hits at warn level. Currently failed auths only log at debug. Visible logging enables monitoring and incident response.
- [ ] **Failed auth alerting** — Flag repeated login failures from the same IP or user account. Surfaces active brute force or credential stuffing attempts so they can be investigated before an account is compromised.
- [ ] **XSS input sanitization** — Add an explicit sanitization layer (e.g. DOMPurify) for content from external sources — OCR text results, filenames, user-submitted fields. React auto-escapes by default, but raw OCR output or any use of dangerouslySetInnerHTML could bypass that.
- [ ] **Audit trail** — Log who accessed, viewed, or modified documents and when. Provides accountability and supports compliance requirements. Stored separately from application logs for retention.

### Deployment
- [ ] Configure second machine (QA/staging) environment for full functionality including on-the-fly image generation
