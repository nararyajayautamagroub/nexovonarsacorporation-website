# NEXOVONARSA CORPORATION — Corporate Project Control Center

Internal-style single-page dashboard for monitoring the 2026–2030 corporate project portfolio.

## Included
- Corporate dashboard and status KPIs
- Companies and business-unit overview
- Central Projects database with search and filters
- Project detail modal with corporate-control fields
- Roadmap 2026–2030 and management hierarchy
- Calendar/review cadence, milestones and tasks
- Reports, risks, budget, documents and decisions
- Notifications, team view and audit/activity log
- CSV export of the current project filter
- Responsive dark corporate interface with animated buttons and subtle shadows
- System Health page for automated telemetry and integrity checks
- Scraper Sources page for public metadata monitoring
- Automated repository validator for data, routes, links and source integrity
- Static deployment, no build step required

## Files
- `index.html` — application shell
- `styles.css` — responsive corporate UI
- `data.js` — companies, roadmap and alerts
- `portfolio.js` — project portfolio baseline
- `app.js` — dashboard logic, filters, detail view and CSV export
- `scripts/sync-github.mjs` — GitHub repository intelligence sync
- `scripts/scrape-public.mjs` — public HTTPS metadata scraper
- `scripts/validate.mjs` — automated structural/data validation
- `scrape-config.json` — public scraper source registry
- `external-live.js` — generated scraper snapshot
- `.github/workflows/deploy.yml` — GitHub Pages deployment

## Data governance
The baseline follows the supplied Corporate Project Roadmap. Progress is shown only when an authoritative value exists in the project registry; otherwise it remains `TBD`. PIC, target, budget and similar operational fields remain `TBD` until the responsible project owner supplies actual data. The dashboard does not invent operational metrics.

**Last Update:** 10/08/2026  
**Planning Period:** 2026–2030  
**Document Owner:** NEXOVONARSA CORPORATION

## Live GitHub integration
The Corporate Control Center now has a **Repository Intelligence** page. It synchronizes the owner's GitHub repositories through the GitHub API instead of maintaining a hand-edited project list.

### What is synchronized
- Repository inventory and visibility
- Repository URL, default branch, language and size
- Latest push/update timestamps
- Latest commit
- Open issues and pull requests
- Branch count
- Latest GitHub Actions workflow state
- Corporate mapping (company, business unit and project)

### Refresh model
GitHub Actions runs repository synchronization and public metadata scraping every **15 minutes** and commits `github-live.js` plus `external-live.js` when data changes. This is near-real-time polling, not a permanent WebSocket connection. GitHub Pages remains static, so the design does not expose a GitHub token to browser JavaScript.

### Private repositories
For cross-repository private-data access, create a GitHub fine-grained token with the minimum required read access and save it as the repository secret **GH_PAT**. Do not put the token in source files.

Without `GH_PAT`, the workflow falls back to `GITHUB_TOKEN`, which is intentionally limited by GitHub Actions permissions and may not be able to inspect private sibling repositories.

### Current connected repositories
The connected GitHub account currently exposes these owned repositories to the corporate registry:
- `nararya-customer-service-platform` (private)
- `modbussid-converter`
- `nararya-bot-discord`
- `narasacakraperwana-website`
- `nararyastudio-website`
- `nararyagarage-website`
- `nexovonarsacorporation-website`

New owned repositories are automatically discovered by the sync job. If a new repository has no corporate mapping, it appears as **UNMAPPED** until its mapping is added to `sync-config.json`.


## Automated quality controls

The **Corporate Quality Gate** runs `scripts/validate.mjs` on pushes and pull requests. The validator checks JavaScript syntax, required files, portfolio fields, duplicate IDs, progress bounds, route coverage, GitHub URL safety, scraper configuration, generated snapshot structure and accidental token-like literals.

The scraper is intentionally metadata-only. It fetches configured public HTTPS pages, records title/description/canonical URL/HTTP status/fetch timing, and never requires credentials or private cookies. A failed public source is reported in the dashboard instead of being silently treated as healthy.

The **System Health** page is an operational view of the latest generated snapshots. It does not invent project progress, PIC, budget or target values; unknown operational values remain **TBD**.
