No God Files
Max 300 lines per file
Max 50 lines per function
Single responsibility - one thing per file/function/class
Consistent Naming
Descriptive names, no abbreviations
Boolean prefixes (is, has, can)
Functions are verbs
Constants in SCREAMING_SNAKE
Database in snake_case
Rotating Logs
 - 10MB max per file
 - 5 files retained
No sensitive data logged
Clean Git Workflow
Branch naming with ticket numbers
Conventional commits
PR requires CI + approval
Squash merge
Security Baseline
No secrets in code
Input validation
Parameterized queries
Least privilege
Guardrails
Don't touch generated files
Don't touch lock files directly
Don't touch CI configs without review
## Security Checklist (when building web apps)
- Validate CSRF tokens server-side, not just presence
- All access control enforced backend, never trust frontend
- No secrets in client bundles - use env vars
- Parameterized queries only, no string concatenation
- Validate file uploads: type, size, rename, store outside webroot
