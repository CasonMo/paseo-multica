# Multica

Multica is a native admin console for Multica inside Paseo. It covers issues and kanban,
projects, team (agents, squads, runtimes, skills), chat, automation, workflows, labels,
inbox, execution logs and workspace settings. It works with the official Multica cloud
(`https://api.multica.ai`) and with any self-hosted Multica server.

## How it works

The interface runs inside Paseo and recreates the layout of the official Multica console:
an icon rail for sections, a contextual second sidebar, and a main content area. Every
Multica API request is made by the Paseo daemon; the interface talks to the daemon over
Paseo's plugin RPC, so the browser tab never holds credentials or calls Multica directly.
Colors follow the official Multica palette and adapt to Paseo's light and dark themes.
The UI language follows the Paseo app language (English or Simplified Chinese); a
plugin-level override in Settings → Language can pin either language on this device.

## Setup

Requires Paseo 0.16.2 or later, on any operating system the Paseo daemon supports
(macOS, Linux, Windows). You need a Multica account or server and a personal access
token; the plugin does not create accounts. Installation commands are in the README.

1. Open **Multica** from the Paseo sidebar or the command center. The first run lands on
   Settings → Connections.
2. Add a server:
   - **Base URL** — `https://api.multica.ai` for the official cloud, or the API root of
     your self-hosted server.
   - **API key** — a personal access token created in Multica under Settings → API
     tokens, shaped like `mul_...`.
   - **Workspace** — optional; after a successful connection test the first workspace is
     selected automatically.
3. The **Test** button makes real requests to `/api/me` and `/api/workspaces` and reports
   the concrete failure reason if the connection does not work.

You can save several servers and switch between them at any time. Each connection keeps
its own key, workspace and internal-route preference.

## What you can do

- **Overview** — issue statistics, recently updated issues, project progress, a
  fixed-height inbox preview with unread count, online runtimes, agent status, and
  seven-day usage and stability (tokens, tasks, failure reasons, average duration).
- **Issues** — a six-column kanban with per-column totals and a compact list view,
  search and project filters. The detail view edits status, priority, assignee, project
  and labels through dropdowns, shows parent and child issues together, and carries a
  threaded comment section: replies, `@` agent mentions, resolve toggles, and per-comment
  activity groups. A comment that dispatches an agent shows a live "agent is responding"
  row with step text, a seconds timer, a run-log shortcut and a confirmed stop action;
  when the run finishes it becomes a comment with a link to its run log.
- **Execution logs** — a right-panel summary (cost, tokens, agent work time), a run
  history modal with per-agent bars and a day-grouped table, and a searchable per-run
  step log with offsets, durations, commands and outputs.
- **Inbox** — category and read filters, search, archive, snooze and delete. Entering the
  inbox marks notifications read automatically; the unread count also appears on the
  Paseo sidebar entry. Clicking the badge opens the inbox; clicking the row returns to
  the last opened page.
- **Team** — agents, squads, runtimes and skills. Create agents with a model picked from
  the runtime's live model list, manage squad members and leaders, bind skills, inspect
  runtime activity and per-agent usage, and review agent tasks, environment variables,
  MCP servers and labels.
- **Chat** — start conversations per agent, send messages, and follow execution steps
  and suggested follow-ups inside the thread.
- **Automation, workflows, labels, projects** — full create and edit surfaces with
  dropdown option fields, cron triggers, status handoff rules, colors and progress.
- **Settings** — connections, workspace switching, members and invitations, profile,
  access tokens (shown once), notification preferences, an internal-route toggle, and an
  embedded API explorer with 524 public routes (568 with internal routes enabled) that
  sends real requests and shows status, duration and response JSON.
- **Loading behavior** — paginated lists fetch 20–50 items first and prefetch the next
  page near the bottom, with a load-more button and a loaded/total footer. Endpoints
  without upstream pagination (inbox, chat) load in a single request and say so.

## Where your data goes

- The only network destination is the Multica base URL you configure. There is no
  telemetry, no hidden network call, no dynamic code execution, and nothing is downloaded
  or installed while the plugin runs.
- The API key is stored only on the daemon host, in `~/.paseo/multica/connections.json`
  with file mode `0600`. It is never sent to the interface; settings show a masked form
  such as `mul_…abcd`. The daemon attaches it as an `Authorization: Bearer` header on
  requests to the selected server only.
- Issue content, comments, chat messages and agent instructions you write are sent to the
  configured Multica server, which dispatches them to its own agent runtimes. This plugin
  sends nothing to any other third party.
- `/api/internal` and `/api/daemon` routes stay hidden until you explicitly enable them
  in settings. Requests sent from the API explorer are real and carry your token's
  permissions.
- Listing screenshots are rendered from synthetic seed data and contain no real
  workspace content.

## Limitations

- A Multica server and a personal access token are required; without them the plugin
  shows the connection setup and nothing else.
- Inbox and chat lists cannot paginate because the upstream endpoints ignore pagination
  parameters; they load in one request.
- The plugin manages one workspace per connection at a time; switching workspaces or
  servers is done in settings.