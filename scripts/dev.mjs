import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const children = [
  spawn('pnpm', ['--dir', 'frontend', 'run', 'dev'], { cwd: root, stdio: 'inherit' }),
  spawn('go', ['run', '-mod=readonly', './cmd/server'], {
    cwd: resolve(root, 'backend'),
    stdio: 'inherit',
    detached: process.platform !== 'win32',
    env: { ...process.env, GOTOOLCHAIN: 'local', GOPROXY: 'off' }
  })
];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    try {
      if (child === children[1] && process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM');
      else child.kill('SIGTERM');
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }
}
for (const child of children) {
  child.on('error', (error) => { console.error(error.message); stop(1); });
  child.on('exit', (code, signal) => { if (!stopping) stop(signal ? 1 : (code ?? 1)); });
}
process.on('SIGINT', () => stop(130));
process.on('SIGTERM', () => stop(143));
