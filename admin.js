const { fork } = require('child_process');
const path = require('path');

const startupTimeoutMs = Number(process.env.ADMIN_STARTUP_TIMEOUT_MS) || 5000;
const childPath = path.join(__dirname, 'admin-child.js');

const child = fork(childPath, {
  env: process.env,
  stdio: ['inherit', 'inherit', 'inherit', 'ipc']
});

let started = false;
const timeout = setTimeout(() => {
  if (started) return;
  console.error(`Admin failed to start within ${startupTimeoutMs}ms. Killing child process.`);
  try {
    child.kill('SIGTERM');
  } catch (e) {
    try { child.kill(); } catch (_) {}
  }
  process.exit(1);
}, startupTimeoutMs);

child.on('message', (msg) => {
  if (msg && msg.type === 'listening') {
    started = true;
    clearTimeout(timeout);
    console.log(`admin running on ${msg.port} (child pid ${child.pid})`);
  }
  if (msg && msg.type === 'error') {
    console.error('Child reported error during startup:\n', msg.error);
  }
});

child.on('exit', (code, signal) => {
  if (!started) {
    clearTimeout(timeout);
    console.error(`Admin child exited before startup. code=${code} signal=${signal}`);
    process.exit(code || 1);
  } else {
    process.exit(code || 0);
  }
});

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
