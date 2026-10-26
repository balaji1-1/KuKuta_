import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(frontendRoot, '..');
const viteCli = path.join(frontendRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const vitePort = process.env.KUKUTA_VITE_PORT || '5179';
const djangoPort = process.env.KUKUTA_DJANGO_PORT || '8000';

const pythonCandidates = [
  process.env.PYTHON,
  path.resolve(projectRoot, '..', '.venv', 'Scripts', 'python.exe'),
  path.join(projectRoot, '.venv', 'Scripts', 'python.exe'),
  path.join(projectRoot, '.venv', 'bin', 'python'),
  path.resolve(projectRoot, '..', '.venv', 'bin', 'python'),
].filter(Boolean);
const python = pythonCandidates.find((candidate) => existsSync(candidate)) || (process.platform === 'win32' ? 'python' : 'python3');

if (!existsSync(viteCli)) {
  console.error('Vite is not installed. Run npm install in kukuta.com first.');
  process.exit(1);
}

const vite = spawn(process.execPath, [viteCli, '--host', '127.0.0.1', '--port', vitePort], {
  cwd: frontendRoot,
  stdio: 'inherit',
});
const django = spawn(python, [path.join(projectRoot, 'manage.py'), 'runserver', `127.0.0.1:${djangoPort}`], {
  cwd: projectRoot,
  stdio: ['inherit', 'pipe', 'inherit'],
});

let djangoOutput = '';
django.stdout.setEncoding('utf8');
django.stdout.on('data', (chunk) => {
  const lines = `${djangoOutput}${chunk}`.split(/\r?\n/);
  djangoOutput = lines.pop() || '';
  for (const line of lines) {
    if (!line.includes('Starting development server at http://')) {
      process.stdout.write(`${line}\n`);
    }
  }
});

const children = [vite, django];

let stopping = false;
function stopAll(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill();
  }
}

for (const child of children) {
  child.on('error', (error) => {
    console.error(`Could not start a development server: ${error.message}`);
    stopAll(1);
  });
  child.on('exit', (code) => {
    if (!stopping) stopAll(code ?? 1);
  });
}

process.on('SIGINT', () => stopAll(130));
process.on('SIGTERM', () => stopAll(143));