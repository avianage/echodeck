# EchoDeck Enterprise Readiness Tasks

## Notes

Excludes over-engineering (scaling, Redis, SOC2) until post-revenue.
Updated with additional items from full codebase exploration.

## Completed Tasks

- Security audit
- Rate limiting implementation
- Zod validation on API routes
- Next.js 16.2.4 upgrade (resolved DoS CVE)
- Environment variable hardening
- 0 high CVEs remaining
- Passing build

## Pending Tasks (Prioritized)

| Priority         | Category       | Task                                                       | Effort | Required For                       | Status  |
| ---------------- | -------------- | ---------------------------------------------------------- | ------ | ---------------------------------- | ------- |
| 1 (Urgent)       | Legal          | Privacy Policy + TOS pages                                 | 2h     | Legal compliance, payment approval | Pending |
| 1 (Urgent)       | Reliability    | Automated DB backups (pg_dump)                             | 15m    | Data safety                        | Pending |
| 1 (Urgent)       | Security       | Replace console.log with Pino logger                       | 3h     | Production debugging               | Pending |
| 2 (High)         | Security       | Add 2FA to NextAuth                                        | 4h     | Enterprise account security        | Pending |
| 2 (High)         | Compliance     | GDPR cookie consent banner                                 | 2h     | EU legal compliance                | Pending |
| 2 (High)         | Monetization   | Stripe integration + usage quotas                          | 6h     | Revenue generation                 | Pending |
| 2 (High)         | Code Quality   | Add test infrastructure (Jest/Playwright)                  | 4h     | Code reliability                   | Pending |
| 2 (High)         | Code Quality   | Configure Prettier + format script                         | 1h     | Code consistency                   | Pending |
| 2 (High)         | TypeScript     | Fix 63+ `any` types, enable no-explicit-any rule           | 6h     | Type safety                        | Pending |
| 2 (High)         | API            | Fix incorrect HTTP status codes (411→400, 403→404)         | 2h     | API correctness                    | Pending |
| 2 (High)         | Code Quality   | Tighten ESLint rules (enable no-unused-vars, prefer-const) | 1h     | Code quality                       | Pending |
| 3 (Medium)       | Operations     | Uptime monitoring (UptimeRobot)                            | 30m    | Outage alerts                      | Pending |
| 3 (Medium)       | Compliance     | Verify GDPR data deletion endpoint                         | 2h     | GDPR compliance                    | Pending |
| 3 (Medium)       | Docs           | Basic OpenAPI spec                                         | 2h     | Enterprise onboarding              | Pending |
| 3 (Medium)       | Accessibility  | Add aria labels, role attributes, skip nav                 | 3h     | WCAG compliance                    | Pending |
| 3 (Medium)       | SEO            | Add robots.ts, sitemap.ts, OG/Twitter metadata             | 2h     | Search visibility                  | Pending |
| 3 (Medium)       | Performance    | Replace <img> with next/image, add dynamic imports         | 4h     | Page load speed                    | Pending |
| 3 (Medium)       | PWA            | Add service worker (next-pwa) for offline support          | 3h     | Offline functionality              | Pending |
| 3 (Medium)       | CI/CD          | Add GitHub Actions (lint, build, test)                     | 2h     | Deployment safety                  | Pending |
| 4 (Post-Revenue) | Reliability    | Redis for distributed rate limiting                        | 4h     | Multi-instance deployment          | Pending |
| 4 (Post-Revenue) | Security       | Persistent audit logs                                      | 3h     | SOC2 compliance                    | Pending |
| 4 (Post-Revenue) | Monitoring     | Prometheus metrics                                         | 4h     | Scaling performance tracking       | Pending |
| 4 (Post-Revenue) | Docker         | Add resource limits, logging to docker-compose             | 1h     | Container stability                | Pending |
| 4 (Post-Revenue) | Email          | Extract email templates, add plain-text fallback           | 2h     | Email deliverability               | Pending |
| 4 (Post-Revenue) | Error Handling | Add 500 error page, improve global-error.tsx               | 1h     | User experience                    | Pending |
