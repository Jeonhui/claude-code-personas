import { Command } from 'commander';
import chalk from 'chalk';
import { ProfileManager } from './manager';

const manager = new ProfileManager();
const program = new Command();

program
  .name('claude-profile')
  .description(
    'Manage multiple Claude Code profiles with isolated configurations'
  )
  .version('1.0.0');

// ── profile list ────────────────────────────────────────────────────────

program
  .command('list')
  .alias('ls')
  .description('List all profiles')
  .action(async () => {
    try {
      const profiles = await manager.list();

      if (profiles.length === 0) {
        console.log(chalk.yellow('No profiles found. Create one with:'));
        console.log(chalk.cyan('  claude-profile create <name>'));
        return;
      }

      console.log(chalk.bold('\nClaude Code Profiles:\n'));

      for (const profile of profiles) {
        const marker = profile.active ? chalk.green('\u25b8 ') : '  ';
        const name = profile.active
          ? chalk.green.bold(profile.name)
          : chalk.white(profile.name);
        const tag = profile.active ? chalk.green(' (active)') : '';
        const authTag = formatAuthTag(
          profile.auth.authenticated,
          profile.auth.subscriptionType
        );
        const lastUsed =
          profile.lastUsedAt !== 'unknown'
            ? chalk.gray(` \u2014 last used ${formatDate(profile.lastUsedAt)}`)
            : '';

        console.log(`${marker}${name}${tag}${authTag}${lastUsed}`);
      }

      console.log(chalk.gray(`\n  ${profiles.length} profile(s) total\n`));
    } catch (err) {
      exitWithError(err);
    }
  });

// ── profile create ──────────────────────────────────────────────────────

program
  .command('create <name>')
  .description('Create a new profile')
  .action(async (name: string) => {
    try {
      const metadata = await manager.create(name);
      console.log(chalk.green(`\u2713 Profile "${metadata.name}" created.`));
      console.log(
        chalk.gray(`  Switch to it with: claude-profile switch ${name}`)
      );
    } catch (err) {
      exitWithError(err);
    }
  });

// ── profile switch ──────────────────────────────────────────────────────

program
  .command('switch <name>')
  .alias('use')
  .description('Switch to a profile')
  .action(async (name: string) => {
    try {
      await manager.switch(name);
      const auth = await manager.getAuthInfo();
      const authStatus = auth.authenticated
        ? chalk.green('authenticated')
        : chalk.yellow('not authenticated');
      console.log(chalk.green(`\u2713 Switched to profile "${name}".`));
      console.log(chalk.gray(`  Auth: ${authStatus}`));
      console.log(
        chalk.gray('  Restart Claude Code for changes to take effect.')
      );
    } catch (err) {
      exitWithError(err);
    }
  });

// ── profile delete ──────────────────────────────────────────────────────

program
  .command('delete <name>')
  .alias('rm')
  .description('Delete a profile (cannot delete the active profile)')
  .action(async (name: string) => {
    try {
      await manager.delete(name);
      console.log(chalk.green(`\u2713 Profile "${name}" deleted.`));
    } catch (err) {
      exitWithError(err);
    }
  });

// ── profile login ───────────────────────────────────────────────────────

program
  .command('login [name]')
  .description(
    'Login to a profile (creates profile if needed, clears auth for fresh login)'
  )
  .action(async (name?: string) => {
    try {
      const profileName = name || 'default';
      await manager.login(profileName);
      console.log(
        chalk.green(`\u2713 Switched to profile "${profileName}".`)
      );
      console.log(
        chalk.yellow(
          '  Credentials cleared. Run `claude` to log in with a new account.'
        )
      );
    } catch (err) {
      exitWithError(err);
    }
  });

// ── profile logout ──────────────────────────────────────────────────────

program
  .command('logout')
  .description('Logout from the current profile (clears auth credentials)')
  .action(async () => {
    try {
      await manager.logout();
      console.log(chalk.green('\u2713 Logged out from current profile.'));
      console.log(
        chalk.gray('  Run `claude` to log in again.')
      );
    } catch (err) {
      exitWithError(err);
    }
  });

// ── profile status ──────────────────────────────────────────────────────

program
  .command('status')
  .description('Show current profile status')
  .option('-q, --quiet', 'Show only the active profile name')
  .action(async (options: { quiet?: boolean }) => {
    try {
      const status = await manager.status();

      if (options.quiet) {
        if (status.activeProfile) {
          console.log(`[personas] active: ${status.activeProfile}`);
        }
        return;
      }

      const authStatus = status.auth.authenticated
        ? chalk.green(
            `yes${status.auth.subscriptionType ? ` (${status.auth.subscriptionType})` : ''}`
          )
        : chalk.yellow('no');

      console.log(chalk.bold('\nProfile Manager Status:\n'));
      console.log(
        `  Active profile : ${
          status.activeProfile
            ? chalk.green.bold(status.activeProfile)
            : chalk.yellow('none (not managed)')
        }`
      );
      console.log(`  Authenticated  : ${authStatus}`);
      console.log(`  Config path    : ${chalk.cyan(status.configDir)}`);
      console.log(
        `  Symlink active : ${
          status.isSymlink ? chalk.green('yes') : chalk.yellow('no')
        }`
      );
      console.log(`  Profiles dir   : ${chalk.cyan(status.profilesDir)}`);
      console.log(`  Total profiles : ${status.totalProfiles}`);
      console.log();
    } catch (err) {
      exitWithError(err);
    }
  });

// ── Helpers ─────────────────────────────────────────────────────────────

function formatAuthTag(
  authenticated: boolean,
  subscriptionType?: string
): string {
  if (!authenticated) {
    return chalk.gray(' \u2014 ') + chalk.yellow('not authenticated');
  }
  const sub = subscriptionType || 'authenticated';
  return chalk.gray(' \u2014 ') + chalk.cyan(`${sub} \u2713`);
}

function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  } catch {
    return iso;
  }
}

function exitWithError(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  console.error(chalk.red(`Error: ${message}`));
  process.exit(1);
}

// ── Run ─────────────────────────────────────────────────────────────────

program.parse();
