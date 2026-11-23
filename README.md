# Multica Workbench for Paseo

A native Paseo plugin that recreates the Multica admin console inside Paseo: issues,
kanban, projects, team, chat, automation, workflows, labels, inbox and workspace
settings — all talking directly to the Multica backend API. Works with the official
cloud (`https://api.multica.ai`) and any self-hosted Multica server.

## Features

- **Overview** — workspace stats, usage & stability (7-day tokens / tasks / failure
  reasons / average duration), recently updated issues, project progress, inbox preview
  and agent roster in an equal-height two-column grid. A dismissible co-creation banner
  links to GitHub issues / PRs; once dismissed it stays hidden across restarts.
- **Issues** — six-column kanban with per-column pagination and server-side column
  totals, plus a 36px list view; search, project filter and saved views (all / mine /
  active / done / closed).
- **Issue detail** — breadcrumb + centered thread + collapsible attribute panel; status,
  priority, assignee, project and label edits; parent/children blocks; threaded comments
  with per-comment reply bands, `@` agent mentions and resolve toggles; per-comment
  activity groups; a live "agent is responding" row under the triggering comment with
  step text, elapsed time, run-log shortcut and a confirmed cancel action.
- **Execution visibility** — right-panel execution log (cost / tokens / agent work),
  run-history modal with per-agent bars and day-grouped table, and a searchable
  per-run step log (offsets, durations, commands, outputs).
- **Inbox** — fixed-height scrolling list, archive / snooze / delete, unread badge on the
  Paseo sidebar entry; entering the inbox marks everything read automatically.
- **Team / chat / automation / workflows / labels / projects** — full CRUD surfaces with
  paginated, waterfall-loaded lists.
- **Settings** — multiple server connections (keys stay daemon-side), workspace switching,
  members & invitations, profile, access tokens, notification preferences, internal-route
  toggle, and the embedded API explorer (the single entry point for interface debugging).
- **Touch & soft keyboard** — on iPad / iPhone (native app and touch web) the chat, issue
  reply and settings surfaces lift their input area above the soft keyboard by the
  measured keyboard height, so the composer and the row beneath it stay visible; a
  bottom-pinned transcript stays pinned while the viewport shrinks. Desktop is unchanged.

## Setup

1. Install the plugin from the Paseo registry, or locally for development:
   `paseo plugin add /path/to/paseo-multica`.
2. Open **Multica → Settings → Connections**, add a server (default
   `https://api.multica.ai`) and paste a personal access token created in Multica
   (Settings → API tokens). The token is stored only in the daemon-side store
   `~/.paseo/multica/connections.json` with mode `0600`; the UI shows a masked prefix.
3. Pick a workspace. Everything else loads on demand.

## Usage examples

- Browse the kanban, open an issue, reply with `@<agent-name>` to dispatch work, and watch
  the live response row and run log update.
- Debug any backend endpoint in **Settings → API debugging**: pick a route, edit path /
  query / body JSON (for example `{"limit": 1}`), send, and inspect status, duration and
  the response JSON.
- Switch between several Multica servers (official cloud + self-hosted) from the workspace
  picker; each connection keeps its own key, workspace and internal-route preference.

## Internationalization

The UI follows the Paseo app language (English / 中文) by default. A plugin-level override
in **Settings → Language** (Follow Paseo / English / 中文, persisted locally) lets you pin
either language regardless of the host setting. All strings live in a bilingual
catalog (`tools/i18n-zh.json` + `tools/i18n-en.json`, 900+ keys) compiled into
`client/workbench/i18n-resources.ts` by `node tools/i18n-build.mjs`; call sites use `t()`
from `client/workbench/i18n.ts`, and persistent registrations (command center, settings
screen titles) use SDK `PluginMessage`s so the host resolves them in the presenting
language. The current locale is shown in Settings. Regenerate media per locale with
`node tools/render-media.mjs en|zh`.

## Media & provenance

Listing screenshots and the icon are **synthetic renderings built from fictional seed
data** (`tools/demo-data.mjs`), not captures of any real workspace:

```bash
node tools/render-media.mjs en              # writes assets/screenshots/en/*.svg + assets/icon.svg
node tools/render-media.mjs zh              # writes assets/screenshots/zh/*.svg
rsvg-convert -w 1600 -h 900 assets/screenshots/en/overview.svg -o assets/screenshots/en/overview.png
rsvg-convert -w 256 -h 256 assets/icon.svg -o assets/icon.png
```

`node tools/demo-server.mjs` serves the same seed data as a local Multica-compatible API
for hands-on demos; point a throwaway connection at `http://127.0.0.1:4173`, then delete
that connection and stop the server when done. No real names, IDs, tokens or hostnames
appear in any committed asset.

## Security & data flow

- Reads by default; every mutation hangs off an explicit user gesture, destructive ones
  behind a confirmation dialog.
- All HTTP requests are issued by the daemon to the configured Multica base URL only.
  No telemetry, no hidden network calls, no dynamic code evaluation.
- Credentials never reach the client bundle, logs, or documentation.
- See `OVERVIEW.md` for the full capability / permission / data-access description and
  `AGENTS.md` for contributor and release rules.

## Development

```bash
npm install
npm run typecheck
npm run lint
```

## License

MIT — see `LICENSE`.