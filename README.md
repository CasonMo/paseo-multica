# Multica Workbench for Paseo

A native Paseo plugin that recreates the Multica admin console inside Paseo: issues,
kanban, projects, team, chat, automation, workflows, labels, inbox and workspace
settings — all talking directly to the Multica backend API. Works with the official
cloud (`https://api.multica.ai`) and any self-hosted Multica server.

## Features

- **Overview** — workspace stats, usage & stability (7-day tokens / tasks / failure
  reasons / average duration), recently updated issues, project progress, inbox preview
  and agent roster in an equal-height two-column grid.
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