import { execFile } from 'child_process';
import os from 'os';

// ── Constants ──────────────────────────────────────────────────────────

const KEYCHAIN_SERVICE = 'Claude Code-credentials';
const KEYCHAIN_ACCOUNT = os.userInfo().username;

// ── Helpers ────────────────────────────────────────────────────────────

function exec(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 10_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

// ── Public API ─────────────────────────────────────────────────────────

export function isKeychainAvailable(): boolean {
  return process.platform === 'darwin';
}

export async function readKeychainCredentials(): Promise<string | null> {
  if (!isKeychainAvailable()) return null;

  try {
    const { stdout } = await exec('security', [
      'find-generic-password',
      '-s', KEYCHAIN_SERVICE,
      '-a', KEYCHAIN_ACCOUNT,
      '-w',
    ]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function writeKeychainCredentials(json: string): Promise<void> {
  if (!isKeychainAvailable()) {
    throw new Error('Keychain is only available on macOS.');
  }

  // Delete existing entry first (ignore errors if it doesn't exist)
  await deleteKeychainCredentials().catch(() => {});

  await exec('security', [
    'add-generic-password',
    '-s', KEYCHAIN_SERVICE,
    '-a', KEYCHAIN_ACCOUNT,
    '-w', json,
    '-U',
  ]);
}

export async function deleteKeychainCredentials(): Promise<void> {
  if (!isKeychainAvailable()) return;

  try {
    await exec('security', [
      'delete-generic-password',
      '-s', KEYCHAIN_SERVICE,
      '-a', KEYCHAIN_ACCOUNT,
    ]);
  } catch {
    // Entry may not exist — ignore
  }
}
