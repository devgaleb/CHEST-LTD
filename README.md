# Chest v4.0 — Minecraft Discord Control Center

Chest is a Node.js 20+ / Discord.js 14 slash-command bot for managing configured Minecraft Java servers. It combines status queries, RCON, allowlisted host lifecycle scripts, backups, log tailing, persistent audit history, scheduled tasks and a token-protected dashboard. Branding concept boards are included in `assets/branding/`.

## Implemented commands

| Command | Purpose | Access |
|---|---|---|
| `/help`, `/about`, `/ping` | Help and diagnostics | Everyone |
| `/status`, `/players` | Minecraft server status and available player sample | Everyone |
| `/server action` | Start/stop/restart through explicitly configured host scripts | Chest admin |
| `/console command` | Execute RCON commands | Chest admin |
| `/announce message` | Broadcast through RCON | Chest admin |
| `/whitelist action player` | Whitelist operations | Chest admin |
| `/backup server` | Save-all (when RCON configured), compress world directory, prune old backups | Chest admin |
| `/logs server` | Read last 100 lines from configured absolute `latest.log` | Chest admin |
| `/history count` | Read persistent JSONL audit history | Chest admin |
| `/plugins server` | List plugin JAR files from configured plugin directory | Chest admin |

Admin access is granted to Discord Administrators or the configured `ADMIN_ROLE_ID`. Audit records are stored in `data/audit.jsonl` by default. Protect the data and backup directories with OS permissions.

## Install

1. Install Node.js 20 or newer.
2. Extract the ZIP, open a terminal in `ChestBot`, run `npm install`.
3. Copy `.env.example` to `.env` and fill in the Discord token/application ID, Minecraft address, RCON credentials and admin role.
4. Run `npm run check`, then `npm run deploy`, then `npm start`.
5. Invite the bot using `bot` and `applications.commands` scopes and only the Discord permissions it needs.

## Multi-server configuration

Set `MC_SERVERS_JSON` to a JSON array. Each server object may include `id`, `name`, `host`, `port`, `rconHost`, `rconPort`, `rconPassword`, `worldDir`, `pluginDir`, `logFile`, and `scripts` with absolute `start`, `stop`, and `restart` executable paths. If no JSON array is set, the single-server environment variables are used. Use unique server IDs. Keep secrets out of source control.

## Automation

`AUTO_BACKUP_CRON` and `AUTO_RESTART_CRON` accept node-cron expressions and are disabled when blank. Scheduled backups run only for configured servers with a `worldDir`; scheduled restarts only run when a restart script is configured. Optional notices are sent to `STATUS_CHANNEL_ID`. Test cron schedules in a non-production environment first.

## Dashboard

Set `DASHBOARD_ENABLED=true`, a `DASHBOARD_TOKEN` of at least 32 random characters, and leave `DASHBOARD_HOST=127.0.0.1` unless you have secured remote access with a VPN and HTTPS reverse proxy. Open `http://127.0.0.1:8787`, enter the token, and use server status, lifecycle actions, RCON console, backups, logs and history. The API uses bearer-token authentication and constant-time token comparison. The browser stores the token in session storage for that tab; never use this dashboard on a public unencrypted network.

## Security notes

- RCON is effectively remote console access. Bind it to localhost/private network; never expose its port publicly.
- Host scripts must be absolute, administrator-owned files with strict permissions. Chest passes no user-supplied arguments to them.
- Do not share `.env`, bot tokens, RCON passwords, backups, or audit records.
- The dashboard is privileged. Use localhost or a properly configured private access layer; use a strong unique token.
- Backups are archives of the configured world directory. For consistent backups, configure RCON and set `BACKUP_REQUIRE_RCON=true`; test restores separately before relying on backups.

## Honest feature boundaries

- Log history reads the configured Minecraft `latest.log`; it does not stream from a remote host without a mounted file or log-forwarding integration.
- TPS is attempted via RCON `tps`; vanilla servers may not support it. Metrics depend on server software.
- Plugin management currently inventories local JARs only. It does not fetch arbitrary plugin binaries or install them automatically.
- World restore is not exposed as a command because safe restoration needs server-specific stop/start integration and an operator-reviewed rollback workflow. Do not manually extract backups over a running world.
- This project has syntax checks, not a live end-to-end test against your Discord application or hosting provider.

## Included references

`REFERENCES.md` documents the three supplied repositories. `assets/branding/` contains generated brand boards; these are concept collages, not individually sliced production assets. The original uploaded project archives are also bundled under `references/original-uploads/` for traceability. Review each original repository's license before reusing its code.

## Chest 4.0 security and advanced management

### Plugin installation
Use `/plugin action:Install` with a simple `.jar` filename, an HTTPS URL, and the expected SHA-256 checksum. The hostname must be listed in `APPROVED_PLUGIN_HOSTS` (comma-separated). Downloads are capped at 100 MB, limited to HTTPS, restricted to allowlisted hosts, and rejected on checksum mismatch. Redirects are revalidated. Plugin installation/removal modifies the configured plugin directory; schedule a maintenance window and restart the server to load changes. Only install plugins you trust.

Example:
`APPROVED_PLUGIN_HOSTS=hangar.papermc.io,cdn.example.org`

### World restore safety
The dashboard's Backups & Restore section lists Chest backups and can restore a selected backup. Restore requires configured trusted `stop` and `start` scripts. Chest creates a fresh pre-restore backup, extracts to a staging directory, rejects archive traversal and symbolic links, moves the old world to a rollback directory, and then swaps the restored world into place. Keep adequate disk space and test this on a disposable server first. If a restore or restart fails, inspect the host and rollback directory manually; this cannot guarantee recovery from hardware or filesystem failure.

### Dashboard endpoints
Authenticated dashboard endpoints include `/api/backups/:id`, `/api/restore/:id`, and `/api/plugins/:id`. They use the same bearer token as the dashboard. Do not expose this privileged service directly to the public internet.

### Limits / compatibility
- Minecraft world listing, world creation, and dimension switching are not universally supported through vanilla RCON; those features need server-specific plugins or a hosting-panel adapter. `/world` currently offers supported console utilities, not arbitrary world creation.
- Automatic backups run at the configured cron schedule. Scheduled restore is intentionally not supported.
- Plugin installation is checksum/host constrained but does not itself verify plugin code safety or Minecraft/server-version compatibility.
- A JavaScript syntax check is not an end-to-end test. Verify commands, backup/restore, RCON, scripts and dashboard on a staging server before production.

## v5 hardening and operational notes

- The dashboard login shell is reachable without a token; all `/api/*` routes require the configured bearer token. `/health` returns only a minimal liveness response.
- API requests have a basic per-IP in-memory rate limit (120/minute) and responses include common browser security headers. If running behind a reverse proxy, configure Express `trust proxy` only for your known proxy and enforce an additional proxy-level rate limit.
- `/api/health` reports Chest process uptime and host/process memory metrics. These are host metrics, not a substitute for Minecraft server TPS or JVM metrics.
- Run `npm test` for the included Node test suite and `npm run check` for syntax checks.
- Keep `DASHBOARD_HOST=127.0.0.1` unless you have intentionally secured remote access. Use a VPN or HTTPS reverse proxy, a long random dashboard token, firewall restrictions, and a separate OS account for Chest.
- Use a dedicated Minecraft account/process and restrict file permissions on `.env`, backups, world paths, plugin folders, and lifecycle scripts. Never run Chest as root/Administrator.
- This project has not been live-tested against your Discord application, RCON endpoint, hosting provider, or specific Minecraft server build in this environment. Perform staging tests and a restore drill before production use. No software can honestly be guaranteed bug-free.


## Automatic local verification (v5.1)

`npm start` and `npm run deploy` now automatically run `npm run verify` first. Verification performs JavaScript syntax checks and runs the local Node.js test suite; startup/deployment is stopped if either check fails. You can run the same checks manually with `npm run verify`. This is automated preflight verification, not a guarantee of bug-free operation: it does not connect to Discord, Minecraft, RCON, or your hosting panel, and cannot validate host-specific scripts or safely prove a restore works. Perform a staging restore drill before relying on backups.
