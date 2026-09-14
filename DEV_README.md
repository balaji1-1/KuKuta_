Dev helper scripts — Quick Start
=================================

**Best approach:** Use the helper scripts at the repo root:

Files:
------

- `dev.sh` (Unix/macOS) — starts frontend in background, then runs Django `runserver`.
- `dev.bat` (Windows) — opens frontend in a new terminal, then runs Django `runserver` in the current window.

Both scripts use environment variables (optional):

- `FRONTEND_DIR` — path to frontend directory (default `kukuta.com`)
- `FRONTEND_CMD` — command to run frontend (default `npm run dev`)
- `FRONTEND_LOG` — path to frontend logs (default `<FRONTEND_DIR>/frontend.log`)

Quick start
-----------

**Windows (PowerShell / CMD):**

```cmd
dev.bat
```

**Unix/macOS (Bash / Zsh):**

```bash
chmod +x dev.sh
./dev.sh
```

**With custom options:**

```bash
FRONTEND_CMD="pnpm dev" ./dev.sh
```

```cmd
set FRONTEND_CMD=pnpm dev
dev.bat
```

Alternative: Django wrapper
---------------------------

There is also a custom `runserver` wrapper in `project_k/management/commands/runserver.py` that attempts to auto-start the frontend when running `python manage.py runserver`. However, the helper scripts above are more reliable and simpler to use.
