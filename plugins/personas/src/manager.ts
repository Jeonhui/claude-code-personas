import path from 'path';
import {
  ensureDirectory,
  createSymlink,
  readSymlinkTarget,
  isSymlink,
  pathExists,
  directoryExists,
  writeJsonFile,
  readJsonFile,
  removeDirectory,
  listSubdirectories,
  resolveHomePath,
} from './utils/fs';
import {
  isKeychainAvailable,
  readKeychainCredentials,
  writeKeychainCredentials,
  deleteKeychainCredentials,
} from './utils/keychain';

// ── Types ──────────────────────────────────────────────────────────────

export interface ProfileMetadata {
  name: string;
  createdAt: string;
  lastUsedAt: string;
}

export interface AuthInfo {
  authenticated: boolean;
  subscriptionType?: string;
  expiresAt?: number;
}

export interface ProfileInfo extends ProfileMetadata {
  path: string;
  active: boolean;
  auth: AuthInfo;
}

export interface ProfileStatus {
  activeProfile: string | null;
  profilesDir: string;
  configDir: string;
  isSymlink: boolean;
  totalProfiles: number;
  auth: AuthInfo;
}

// ── Constants ──────────────────────────────────────────────────────────

const PROFILES_DIR_NAME = '.claude-profiles';
const CLAUDE_CONFIG_DIR_NAME = '.claude';
const METADATA_FILE = '.profile-metadata.json';
const CREDENTIALS_FILE = '.credentials.json';
const DEFAULT_PROFILE_NAME = 'default';

// ── ProfileManager ─────────────────────────────────────────────────────

export class ProfileManager {
  private readonly profilesDir: string;
  private readonly configDir: string;

  constructor() {
    this.profilesDir = resolveHomePath(PROFILES_DIR_NAME);
    this.configDir = resolveHomePath(CLAUDE_CONFIG_DIR_NAME);
  }

  async init(): Promise<void> {
    await ensureDirectory(this.profilesDir);
  }

  private profilePath(name: string): string {
    return path.join(this.profilesDir, name);
  }

  private metadataPath(name: string): string {
    return path.join(this.profilePath(name), METADATA_FILE);
  }

  private credentialsPath(name: string): string {
    return path.join(this.profilePath(name), CREDENTIALS_FILE);
  }

  private validateName(name: string): void {
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Error(
        `Invalid profile name "${name}". Use only letters, numbers, hyphens, and underscores.`
      );
    }
    if (name.length > 64) {
      throw new Error('Profile name must be 64 characters or fewer.');
    }
  }

  // ── Credential Helpers ─────────────────────────────────────────────

  async saveCredentials(name: string): Promise<void> {
    if (!isKeychainAvailable()) return;

    const json = await readKeychainCredentials();
    if (json) {
      await writeJsonFile(this.credentialsPath(name), json);
    }
  }

  async restoreCredentials(name: string): Promise<void> {
    if (!isKeychainAvailable()) return;

    const saved = await readJsonFile<string>(this.credentialsPath(name));
    if (saved) {
      await writeKeychainCredentials(saved);
    } else {
      await deleteKeychainCredentials();
    }
  }

  async getAuthInfo(name?: string): Promise<AuthInfo> {
    if (!isKeychainAvailable()) {
      return { authenticated: false };
    }

    let json: string | null = null;

    if (name) {
      // Read from saved credentials file
      json = await readJsonFile<string>(this.credentialsPath(name));
    } else {
      // Read from current Keychain
      json = await readKeychainCredentials();
    }

    if (!json) {
      return { authenticated: false };
    }

    try {
      const creds = typeof json === 'string' ? JSON.parse(json) : json;
      const info: AuthInfo = { authenticated: true };

      if (creds.subscriptionType) {
        info.subscriptionType = creds.subscriptionType;
      }
      if (creds.expiresAt) {
        info.expiresAt = creds.expiresAt;
      }

      return info;
    } catch {
      return { authenticated: true };
    }
  }

  // ── Commands ───────────────────────────────────────────────────────

  async create(name: string): Promise<ProfileMetadata> {
    this.validateName(name);
    await this.init();

    const profileDir = this.profilePath(name);

    if (await directoryExists(profileDir)) {
      throw new Error(`Profile "${name}" already exists.`);
    }

    await this.migrateExistingConfigIfNeeded();
    await ensureDirectory(profileDir);

    const metadata: ProfileMetadata = {
      name,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    };

    await writeJsonFile(this.metadataPath(name), metadata);
    return metadata;
  }

  async list(): Promise<ProfileInfo[]> {
    await this.init();

    const activeProfile = await this.getActiveProfileName();
    const dirs = await listSubdirectories(this.profilesDir);

    const profiles: ProfileInfo[] = [];

    for (const dir of dirs) {
      const metadata = await readJsonFile<ProfileMetadata>(
        this.metadataPath(dir)
      );
      const isActive = dir === activeProfile;
      const auth = isActive
        ? await this.getAuthInfo()
        : await this.getAuthInfo(dir);

      profiles.push({
        name: metadata?.name ?? dir,
        createdAt: metadata?.createdAt ?? 'unknown',
        lastUsedAt: metadata?.lastUsedAt ?? 'unknown',
        path: this.profilePath(dir),
        active: isActive,
        auth,
      });
    }

    profiles.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return profiles;
  }

  async switch(name: string): Promise<void> {
    this.validateName(name);
    await this.init();

    const profileDir = this.profilePath(name);

    if (!(await directoryExists(profileDir))) {
      throw new Error(
        `Profile "${name}" does not exist. Create it first with: create ${name}`
      );
    }

    await this.migrateExistingConfigIfNeeded();

    if (
      (await pathExists(this.configDir)) &&
      !(await isSymlink(this.configDir))
    ) {
      throw new Error(
        `${this.configDir} exists but is not a symlink. ` +
          `Back it up manually or remove it before switching profiles.`
      );
    }

    // Backup current profile credentials before switching
    const currentProfile = await this.getActiveProfileName();
    if (currentProfile && isKeychainAvailable()) {
      await this.saveCredentials(currentProfile);
    }

    // Switch symlink
    await createSymlink(profileDir, this.configDir);

    // Restore target profile credentials
    if (isKeychainAvailable()) {
      await this.restoreCredentials(name);
    }

    const metaPath = this.metadataPath(name);
    const metadata = await readJsonFile<ProfileMetadata>(metaPath);
    if (metadata) {
      metadata.lastUsedAt = new Date().toISOString();
      await writeJsonFile(metaPath, metadata);
    }
  }

  async delete(name: string): Promise<void> {
    this.validateName(name);

    const profileDir = this.profilePath(name);

    if (!(await directoryExists(profileDir))) {
      throw new Error(`Profile "${name}" does not exist.`);
    }

    const activeProfile = await this.getActiveProfileName();
    if (name === activeProfile) {
      throw new Error(
        `Cannot delete the active profile "${name}". Switch to another profile first.`
      );
    }

    await removeDirectory(profileDir);
  }

  async status(): Promise<ProfileStatus> {
    await this.init();

    const activeProfile = await this.getActiveProfileName();
    const dirs = await listSubdirectories(this.profilesDir);
    const symlinkActive = await isSymlink(this.configDir);
    const auth = await this.getAuthInfo();

    return {
      activeProfile,
      profilesDir: this.profilesDir,
      configDir: this.configDir,
      isSymlink: symlinkActive,
      totalProfiles: dirs.length,
      auth,
    };
  }

  async login(name: string): Promise<void> {
    this.validateName(name);
    await this.init();

    // Create profile if it doesn't exist
    const profileDir = this.profilePath(name);
    if (!(await directoryExists(profileDir))) {
      await this.create(name);
    }

    // Switch to the profile
    await this.switch(name);

    // Clear Keychain credentials to trigger fresh login
    if (isKeychainAvailable()) {
      await deleteKeychainCredentials();
    }
  }

  async logout(): Promise<void> {
    if (!isKeychainAvailable()) {
      throw new Error('Keychain is only available on macOS.');
    }

    // Delete from Keychain
    await deleteKeychainCredentials();

    // Delete saved credentials for current profile
    const currentProfile = await this.getActiveProfileName();
    if (currentProfile) {
      const credPath = this.credentialsPath(currentProfile);
      const { remove } = await import('fs-extra');
      await remove(credPath);
    }
  }

  // ── Internal Helpers ───────────────────────────────────────────────

  private async getActiveProfileName(): Promise<string | null> {
    const target = await readSymlinkTarget(this.configDir);
    if (!target) return null;

    const resolved = path.resolve(path.dirname(this.configDir), target);
    if (!resolved.startsWith(this.profilesDir)) {
      return null;
    }

    return path.basename(resolved);
  }

  private async migrateExistingConfigIfNeeded(): Promise<void> {
    const configExists = await pathExists(this.configDir);
    const configIsSymlink = await isSymlink(this.configDir);

    if (!configExists || configIsSymlink) {
      return;
    }

    const defaultProfileDir = this.profilePath(DEFAULT_PROFILE_NAME);

    if (await directoryExists(defaultProfileDir)) {
      return;
    }

    const { rename } = await import('fs-extra');
    await rename(this.configDir, defaultProfileDir);
    await ensureDirectory(defaultProfileDir);

    const metadata: ProfileMetadata = {
      name: DEFAULT_PROFILE_NAME,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    };
    await writeJsonFile(this.metadataPath(DEFAULT_PROFILE_NAME), metadata);
    await createSymlink(defaultProfileDir, this.configDir);
  }
}
