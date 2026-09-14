Runserver wrapper — React dev server helper
=========================================

What it does
------------

This custom management command wraps Django's built-in `runserver` and attempts to start the React development server
for the frontend located in the `kukuta.com` directory by running `npm run dev` there. It is a convenience for local
development so you can start both backend and frontend with a single command.

Where it lives
--------------

- `project_k/management/commands/runserver.py`

Usage
-----

- Start both servers (default):

```
python manage.py runserver
```

- Skip starting the frontend:

```
python manage.py runserver --no-frontend
```

- Or disable frontend auto-start via environment variable (useful in CI or remote shells):

Windows (PowerShell/CMD):

```
set DISABLE_FRONTEND=1
python manage.py runserver
```

macOS / Linux:

```
export DISABLE_FRONTEND=1
python manage.py runserver
```

Notes
-----

- The command expects `npm` to be available on `PATH`. If `npm` is not found you'll see a warning and the Django
  server will continue to run without the frontend.
- The frontend is started with `npm run dev` inside the `kukuta.com` folder adjacent to the Django project root.
- When you stop Django (Ctrl+C), the wrapper will attempt to terminate the frontend process as well.

Configuration and logging
-------------------------

You can override behaviour with environment variables or command-line options:

- `FRONTEND_DIR` — path to the frontend folder (defaults to `<project root>/kukuta.com`).
- `FRONTEND_CMD` — a shell command string to run the frontend (for example: `npm run dev` or `pnpm dev`).
- `FRONTEND_LOG` — path to an append log file where the frontend stdout/stderr will be written (defaults to
  `<FRONTEND_DIR>/frontend.log`).

Command-line option:

- `--frontend-log <path>` — set or override the frontend log path for this invocation.

Examples:

```
FRONTEND_CMD="pnpm dev" python manage.py runserver
```

```
python manage.py runserver --frontend-log /tmp/kukuta-frontend.log
```

If you want different behaviour (custom frontend path, different npm script, etc.), modify
`project_k/management/commands/runserver.py` accordingly.
