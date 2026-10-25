# Optional host-control scripts

Chest intentionally does not guess how your Minecraft server is hosted. Create scripts appropriate to your setup (systemd, Docker Compose, Pterodactyl API wrapper, etc.), test them manually, then set the absolute script paths in `.env`. Keep these scripts owned by the bot's service account and avoid shell interpolation of external input. Start/stop/restart actions stay disabled until paths are configured.
