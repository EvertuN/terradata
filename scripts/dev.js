#!/usr/bin/env node
/**
 * Starts the Next.js dev server and the Rust API together.
 * No extra dependencies: just two child processes with clean shutdown.
 */
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const children = [];
let shuttingDown = false;

function killTree(child) {
  if (!child || child.killed) return;

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
    });
  } else {
    child.kill('SIGTERM');
  }
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    killTree(child);
  }

  setTimeout(() => process.exit(code), 250);
}

function start(name, command, args, env) {
  const child = spawn(command, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });

  children.push(child);
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`[${name}] exited with code ${code ?? 1}`);
      shutdown(code ?? 1);
    }
  });

  return child;
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('TerraData dev: http://localhost:3000 (web) + http://localhost:8080 (api)');

start('api', 'cargo', ['run', '--manifest-path', 'backend/Cargo.toml']);
start(
  'web',
  process.execPath,
  [require.resolve('next/dist/bin/next'), 'dev', '-p', '3000'],
  {
    // Same-origin in production; localhost API during development.
    NEXT_PUBLIC_API_BASE_URL:
      process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080',
  }
);
