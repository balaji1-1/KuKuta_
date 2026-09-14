import os
import re
import shlex
import subprocess
import threading
import atexit
import time

from django.conf import settings  # type: ignore[reportMissingModuleSource]
from django.core.management.commands.runserver import Command as RunserverCommand  # type: ignore[reportMissingModuleSource]


class Command(RunserverCommand):
    help = 'Starts Django development server and (optionally) the frontend dev server.'

    def add_arguments(self, parser):
        super().add_arguments(parser)
        parser.add_argument(
            '--no-frontend', action='store_true', dest='no_frontend',
            help='Do not start the frontend dev server'
        )
        parser.add_argument(
            '--frontend-log', dest='frontend_log', default=None,
            help='Path to file where frontend stdout/stderr will be appended'
        )

    def handle(self, *args, **options):
        self.frontend_proc = None
        self.frontend_logfile = None
        self.frontend_url = None

        start_frontend = not options.get('no_frontend') and os.environ.get('DISABLE_FRONTEND') is None

        if start_frontend:
            try:
                frontend_dir = os.environ.get('FRONTEND_DIR') or os.path.join(settings.BASE_DIR, 'kukuta.com')
                if not os.path.isdir(frontend_dir):
                    self.stdout.write(self.style.WARNING(f'Frontend directory not found: {frontend_dir}'))
                else:
                    # frontend command can be overridden with FRONTEND_CMD env var
                    frontend_cmd_env = os.environ.get('FRONTEND_CMD')
                    if frontend_cmd_env:
                        cmd = shlex.split(frontend_cmd_env)
                    else:
                        if os.name == 'nt':
                            cmd = ['cmd.exe', '/c', 'npm', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '5179']
                        else:
                            cmd = ['npm', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '5179']

                    # log path from option or env var or default to frontend dir/frontend.log
                    log_path = options.get('frontend_log') or os.environ.get('FRONTEND_LOG') or os.path.join(frontend_dir, 'frontend.log')

                    # ensure directory exists for the log
                    try:
                        os.makedirs(os.path.dirname(log_path), exist_ok=True)
                    except Exception:
                        pass

                    # open logfile in append mode (line buffered)
                    try:
                        self.frontend_logfile = open(log_path, 'a', buffering=1, encoding='utf-8', errors='ignore')
                    except Exception:
                        self.frontend_logfile = None

                    creationflags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0

                    self.stdout.write(f'Starting frontend: {" ".join(cmd)} in {frontend_dir} — logs: {log_path}')
                    try:
                        self.frontend_proc = subprocess.Popen(
                            cmd,
                            cwd=frontend_dir,
                            stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT,
                            text=True,
                            encoding='utf-8',
                            errors='ignore',
                            creationflags=creationflags,
                            shell=False,
                        )

                        if self.frontend_logfile:
                            threading.Thread(target=self._monitor_frontend_output, daemon=True).start()

                        atexit.register(self._stop_frontend)
                        self.stdout.write(self.style.SUCCESS('Frontend dev server started.'))
                        self._wait_for_frontend_url(timeout=15)
                    except FileNotFoundError:
                        self.stdout.write(self.style.WARNING('`npm` (or configured command) was not found. Install Node/npm or adjust FRONTEND_CMD.'))
            except Exception as exc:  # pragma: no cover - best-effort helper
                self.stdout.write(self.style.ERROR(f'Could not start frontend dev server: {exc}'))

        try:
            super().handle(*args, **options)
        finally:
            # ensure frontend is stopped when Django exits
            self._stop_frontend()

    def _monitor_frontend_output(self):
        if not getattr(self, 'frontend_proc', None):
            return

        local_url_pattern = re.compile(r'Local:\s*(https?://[^\s]+/static/)')
        proc = self.frontend_proc

        while proc.poll() is None:
            line = proc.stdout.readline()
            if not line:
                break
            if self.frontend_logfile:
                try:
                    self.frontend_logfile.write(line)
                except Exception:
                    pass
            match = local_url_pattern.search(line)
            if match:
                self.frontend_url = match.group(1)
                os.environ['VITE_DEV_SERVER_URL'] = self.frontend_url
                self.stdout.write(self.style.SUCCESS(f'Frontend dev server URL detected: {self.frontend_url}'))
                break

        if self.frontend_logfile:
            try:
                self.frontend_logfile.flush()
            except Exception:
                pass

    def _wait_for_frontend_url(self, timeout=15):
        deadline = time.time() + timeout
        while time.time() < deadline:
            if getattr(self, 'frontend_url', None):
                return
            if self.frontend_proc and self.frontend_proc.poll() is not None:
                break
            time.sleep(0.1)

    def _stop_frontend(self):
        proc = getattr(self, 'frontend_proc', None)
        logfile = getattr(self, 'frontend_logfile', None)
        if proc and proc.poll() is None:
            try:
                proc.terminate()
                time.sleep(1)
                if proc.poll() is None:
                    proc.kill()
            except Exception:
                pass
        if logfile:
            try:
                logfile.close()
            except Exception:
                pass
