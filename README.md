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
- Responsive dark corporate interface
- Static deployment, no build step required

## Files
- `index.html` — application shell
- `styles.css` — responsive corporate UI
- `data.js` — companies, roadmap and alerts
- `portfolio.js` — project portfolio baseline
- `app.js` — dashboard logic, filters, detail view and CSV export
- `.github/workflows/deploy.yml` — GitHub Pages deployment

## Data governance
The baseline follows the supplied Corporate Project Roadmap. Progress values are starter values where available; PIC, target, budget and similar operational fields remain `TBD` until the responsible project owner supplies actual data.

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
GitHub Actions runs the sync every **15 minutes** and commits `github-live.js` when data changes. This is near-real-time polling, not a permanent WebSocket connection. GitHub Pages remains static, so the design does not expose a GitHub token to browser JavaScript.

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
