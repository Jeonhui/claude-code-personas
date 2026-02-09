import fs from 'fs-extra';
import path from 'path';

const DIR_PERMISSIONS = 0o700;
const FILE_PERMISSIONS = 0o600;

/**
 * Ensure a directory exists with restricted permissions.
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.ensureDir(dirPath);
  await fs.chmod(dirPath, DIR_PERMISSIONS);
}

/**
 * Create or replace a symbolic link atomically.
 * Uses a temporary link + rename to avoid a window where the link is missing.
 */
export async function createSymlink(
  target: string,
  linkPath: string
): Promise<void> {
  const tmpLink = `${linkPath}.tmp-${process.pid}`;

  try {
    await fs.remove(tmpLink);
    await fs.symlink(target, tmpLink);
    await fs.rename(tmpLink, linkPath);
  } catch (err) {
    await fs.remove(tmpLink).catch(() => {});
    throw err;
  }
}

/**
 * Read the target of a symbolic link.
 * Returns null if the path is not a symlink or does not exist.
 */
export async function readSymlinkTarget(
  linkPath: string
): Promise<string | null> {
  try {
    const stats = await fs.lstat(linkPath);
    if (!stats.isSymbolicLink()) {
      return null;
    }
    return fs.readlink(linkPath);
  } catch {
    return null;
  }
}

/**
 * Check whether a path is a symbolic link.
 */
export async function isSymlink(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.lstat(filePath);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Check whether a path exists (follows symlinks).
 */
export async function pathExists(filePath: string): Promise<boolean> {
  return fs.pathExists(filePath);
}

/**
 * Check whether a directory exists at the given path.
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Write a JSON file with restricted permissions.
 */
export async function writeJsonFile(
  filePath: string,
  data: unknown
): Promise<void> {
  await fs.writeJson(filePath, data, { spaces: 2 });
  await fs.chmod(filePath, FILE_PERMISSIONS);
}

/**
 * Read and parse a JSON file. Returns null if it does not exist.
 */
export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    return (await fs.readJson(filePath)) as T;
  } catch {
    return null;
  }
}

/**
 * Remove a directory and all its contents recursively.
 */
export async function removeDirectory(dirPath: string): Promise<void> {
  await fs.remove(dirPath);
}

/**
 * List immediate subdirectory names inside a directory.
 */
export async function listSubdirectories(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

/**
 * Resolve the home directory path.
 */
export function getHomePath(): string {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) {
    throw new Error('Unable to determine home directory');
  }
  return home;
}

/**
 * Resolve a path relative to the home directory.
 */
export function resolveHomePath(...segments: string[]): string {
  return path.join(getHomePath(), ...segments);
}
