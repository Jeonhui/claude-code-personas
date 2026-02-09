# 🎭 Claude Code Personas

![Version](https://img.shields.io/badge/version-1.0.1-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

A **[Claude Code plugin](https://code.claude.com/docs/plugins)** for managing multiple personas — switch between accounts, credentials, and settings seamlessly.

---

## 🚀 How It Works

**Claude Code** stores session and auth data in `~/.claude`. This plugin isolates each persona into its own directory under `~/.claude-profiles/` and manages the active persona by swapping a symbolic link at `~/.claude`.

```
~/.claude-profiles/
├── default/          # 🏠 Migrated from original ~/.claude
├── work/             # 🏢 Work account
└── personal/         # 👤 Personal account

~/.claude -> ~/.claude-profiles/work   (symlink to active persona)
```

**Atomic Switching**: When you switch personas, the plugin atomically replaces the `~/.claude` symlink to point to the target directory. Each persona is fully isolated — its own auth tokens, settings, and session data.

### 🔐 Account Switching (macOS)

Claude Code stores OAuth credentials in the **macOS Keychain** (`Claude Code-credentials` service). This plugin backs up and restores Keychain credentials per persona, so switching personas also switches the logged-in account.

1.  **Switch** `work` → backup current credentials → swap symlink → restore `work` credentials
2.  **Login** `work` → switch to `work` → clear credentials → run `claude` to OAuth login
3.  **Logout** → clear credentials from Keychain and saved file

---

## 📦 Installation

### From Marketplace

Add the marketplace and install the plugin:

```bash
/plugin marketplace add Jeonhui/claude-code-personas
/plugin install personas@claude-code-personas
```

### Local Development

Clone the repository, build, and load directly:

```bash
git clone https://github.com/Jeonhui/claude-code-personas.git
cd claude-code-personas/plugins/personas
npm install && npm run build
```

```bash
claude --plugin-dir ./plugins/personas
```

---

## 🛠 Usage

After installation, the following skills are available inside Claude Code:

| Skill | Description |
| :--- | :--- |
| `/personas:list` | 📋 List all personas with auth status |
| `/personas:create <name>` | ➕ Create a new isolated persona |
| `/personas:switch <name>` | 🔄 Switch the active persona (swaps symlink and credentials) |
| `/personas:delete <name>` | 🗑️ Delete a persona (cannot delete the active one) |
| `/personas:status` | ℹ️ Show current persona status with auth info |
| `/personas:login [name]` | 🔑 Login to a persona (creates if needed, clears auth for fresh OAuth) |
| `/personas:logout` | 🚪 Logout from the current persona (clears credentials) |

### ⚡ Quick Start

```bash
/personas:create work
/personas:switch work
```

> **Note:** Restart Claude Code after switching personas for changes to take full effect.

### 👥 Multi-Account Setup

To set up multiple accounts:

1.  **Login to Work:**
    ```bash
    /personas:login work
    ```
    *Creates `work` persona, switches to it, and clears credentials. Run `claude` to complete OAuth login.*

2.  **Login to Personal:**
    ```bash
    /personas:login personal
    ```
    *Repeat for your personal account.*

3.  **Switch Between Accounts:**
    ```bash
    /personas:switch work       # Restores work account credentials
    /personas:switch personal   # Restores personal account credentials
    ```

4.  **Check Status:**
    ```bash
    /personas:list
    ```
    ```
    ▸ work (active) — pro ✓ — last used just now
      personal — authenticated ✓ — last used 2h ago
    ```

### 💻 Standalone CLI

The plugin also works as a standalone CLI tool:

```bash
cd plugins/personas
npm link

claude-profile create work
claude-profile login work
claude-profile switch personal
claude-profile list
claude-profile status
claude-profile logout
claude-profile delete personal
```

---

## 🔄 First-Time Migration

When you first create or switch a persona, the plugin automatically detects if `~/.claude` is a real directory (not yet managed). It will:

1.  Move the existing `~/.claude` to `~/.claude-profiles/default/`
2.  Create a symlink `~/.claude -> ~/.claude-profiles/default/`
3.  Continue with the requested operation

Your existing configuration is preserved as the `default` persona.

---

## 📂 Project Structure

```
claude-code-personas/
├── .claude-plugin/
│   └── marketplace.json              # Marketplace catalog
├── plugins/
│   └── personas/                     # Plugin root
│       ├── .claude-plugin/
│       │   └── plugin.json           # Plugin manifest
│       ├── skills/                   # Claude Code skills
│       ├── hooks/
│       │   └── hooks.json            # SessionStart hook
│       ├── src/                      # TypeScript source
│       │   ├── index.ts              # CLI entry point
│       │   ├── manager.ts            # ProfileManager class
│       │   └── utils/
│       │       ├── fs.ts             # Filesystem utilities
│       │       └── keychain.ts       # macOS Keychain utilities
│       ├── dist/                     # Compiled output
│       ├── package.json
│       └── tsconfig.json
└── .gitignore
```

### Key Source Files

| File | Role |
| :--- | :--- |
| `src/utils/fs.ts` | 📂 **Filesystem**: Symlink creation, directory management, secure JSON I/O (`0o700`) |
| `src/utils/keychain.ts` | 🔐 **Keychain**: Read, write, delete credentials via `security` CLI |
| `src/manager.ts` | ⚙️ **Manager**: Core logic for profiles, switching, and credential backups |
| `src/index.ts` | 🖥️ **CLI**: Interface using `commander` with colored output |

---

## 🛡️ Security

- **Permissions**: Profile directories use `0o700` (owner-only).
- **Credentials**: Stored files use `0o600` (owner-only read/write).
- **Atomic Swaps**: Symlinks are replaced via temp-link + rename to avoid breakage.
- **Validation**: Persona names are restricted to alphanumeric, hyphens, and underscores.
- **Keychain**: Uses macOS `security` CLI with scoped service names.

---

## 🎣 Hooks

The plugin includes a **SessionStart** hook that displays the currently active persona when Claude Code starts a new session.

---

## 📋 Requirements

- **Node.js**: >= 18.0.0
- **Claude Code**: >= 1.0.33
- **OS**: macOS (Required for Keychain-based account switching)

---

## 🏢 Team Distribution

To make this plugin available for your team automatically, add the marketplace to your project's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "claude-code-personas": {
      "source": {
        "source": "github",
        "repo": "Jeonhui/claude-code-personas"
      }
    }
  },
  "enabledPlugins": {
    "personas@claude-code-personas": true
  }
}
```

---

## 📄 License

MIT
