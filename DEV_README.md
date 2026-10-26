Development Servers
===================

Start both the React/Vite frontend and Django API with the same command:

Windows (PowerShell or CMD):

```cmd
dev.bat
```

Unix/macOS:

```bash
./dev.sh
```

Or, from `kukuta.com`, run `npm run dev`. Both servers stop together when the command is interrupted.

Vite is available at `http://127.0.0.1:5179/static/` and Django at `http://127.0.0.1:8000/`. Use `npm run dev:react` in `kukuta.com` only when you want the frontend without Django.
