import { spawn } from 'node:child_process';

export function spawnManaged(command, args, options = {}) {
  return spawn(command, args, {
    ...options,
    windowsHide: options.windowsHide ?? true,
    detached: options.detached ?? process.platform !== 'win32',
  });
}

export function terminateProcessTree(child) {
  if (!child) return;

  if (process.platform === 'win32' && child.pid) {
    const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    killer.on('error', () => {
      try { child.kill(); } catch { /* best effort */ }
    });
    return;
  }

  if (child.pid) {
    try {
      process.kill(-child.pid, 'SIGTERM');
      return;
    } catch {
      // Fall back to the direct child below.
    }
  }

  try { child.kill(); } catch { /* best effort */ }
}
