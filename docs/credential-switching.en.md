# Credential Switching — Operational Logic

This document explains the architecture for switching Claude Code login accounts simultaneously when switching profiles.

## Background

Claude Code stores its state in two primary locations:

| Storage | Content | Path |
| :--- | :--- | :--- |
| **Filesystem** | Config, sessions, project data | ~/.claude/ |
| **macOS Keychain** | OAuth credentials (access tokens, etc.) | Service: Claude Code-credentials |

Previous versions of the profile manager only swapped the ~/.claude symbolic link. This caused an issue where switching profiles did not change the actual logged-in account because the authentication data remained persisted in the Keychain.

## Solution Architecture

To solve this, each profile directory now includes a .credentials.json file to backup and restore Keychain authentication data.

``;text
~/.claude-profiles/
├── default/
│   ├── .profile-metadata.json
│   └── .credentials.json          ← Keychain backup
├── work/
│   ├── .profile-metadata.json
│   └── .credentials.json
└── personal/
    ├── .profile-metadata.json
    └── .credentials.json

macOS Keychain
└── Claude Code-credentials        ← Currently active credentials
``;

## Core Workflows

### 1. switch (Profile Transition)

**Scenario:** Current profile is default (active) → Target profile is work.

1. **Read** current credentials from Keychain via:
   security find-generic-password -s "..." -w
2. **Backup** the retrieved credentials to default/.credentials.json.
3. **Swap** the ~/.claude symbolic link to point to the work/ directory.
   ~/.claude -> ~/.claude-profiles/work
4. **Restore** credentials:
   - **If work/.credentials.json exists**: Restore it to the Keychain.
   - **If it does not exist**: Clear the Keychain (unauthenticated state).

**Result:** work profile activated + work account authenticated.

### 2. login (New Account Login)

**Command:** claude-profile login work

1. **Verify** existence of the "work" profile (auto-create if missing).
2. **Execute** switch("work"):
   (Backup current → Swap link → Attempt restoration).
3. **Delete** current Keychain credentials to force a clean slate:
   security delete-generic-password -s "..."
4. **Instruct** the user to run claude.

**Result:** work profile active in an unauthenticated state. Once the user completes the OAuth flow via claude, the new credentials are saved to the Keychain.

### 3. logout (Logout)

**Command:** claude-profile logout

1. **Delete** credentials from macOS Keychain.
2. **Remove** .credentials.json from the current profile directory.

**Result:** Current profile enters an unauthenticated state (both Keychain and file deleted).

## Keychain Interaction

Interaction with the Keychain is handled via the macOS security CLI.

| Action | Command |
| :--- | :--- |
| **Read** | security find-generic-password -s "Claude Code-credentials" -a <username> -w |
| **Write** | security add-generic-password -s "Claude Code-credentials" -a <username> -w <json> -U |
| **Delete** | security delete-generic-password -s "Claude Code-credentials" -a <username> |

* **Service Name**: Claude Code-credentials (Fixed value used by Claude Code).
* **Account Name**: OS Username (os.userInfo().username).
* **Value**: JSON string containing OAuth tokens, subscription type, etc.

## Authentication Status Display

The list and status commands display the authentication status for each profile:

``;text
Claude Code Profiles:

▸ work (active) — pro ✓ — last used just now
  personal — authenticated ✓ — last used 2h ago
  test — not authenticated — last used 5d ago

  3 profile(s) total
``;

| Profile Type | Credential Source | Reason |
| :--- | :--- | :--- |
| **Active Profile** | Keychain | Reflects the actual real-time authentication state. |
| **Inactive Profiles**| .credentials.json| Reflects the state backed up during the last switch. |

## File Security

| File/Folder | Permission | Description |
| :--- | :--- | :--- |
| .credentials.json | 0o600 | Read/Write restricted to Owner only. |
| .profile-metadata.json | 0o600 | Read/Write restricted to Owner only. |
| **Profile Directory** | 0o700 | Access restricted to Owner only. |

## Platform Support

| Feature | macOS | Linux / Windows |
| :--- | :---: | :---: |
| Profile Switching (Symlink) | Supported | Supported |
| Credential Backup (Keychain) | Supported | Not Supported (Ignored) |
| login / logout | Supported | Not Supported (Returns Error) |

The system uses isKeychainAvailable() to verify process.platform === 'darwin'. On non-macOS environments, Keychain operations are bypassed, while profile switching via symlinks remains functional.

## Sequence Diagram: switch

```mermaid
User          CLI            Manager         Keychain        FileSystem
 │             │               │               │               │
 │ switch work │               │               │               │
 │────────────>│               │               │               │
 │             │ switch(work)  │               │               │
 │             │──────────────>│               │               │
 │             │               │ read creds    │               │
 │             │               │──────────────>│               │
 │             │               │  json string  │               │
 │             │               │<──────────────│               │
 │             │               │               │ save to       │
 │             │               │               │ default/      │
 │             │               │──────────────────────────────>│
 │             │               │               │               │
 │             │               │ swap symlink  │               │
 │             │               │──────────────────────────────>│
 │             │               │               │               │
 │             │               │               │ read work/    │
 │             │               │               │ .credentials  │
 │             │               │<──────────────────────────────│
 │             │               │ write creds   │               │
 │             │               │──────────────>│               │
 │             │               │      done     │               │
 │             │<──────────────│               │               │
 │  ✓ Switched │               │               │               │
 │<────────────│               │               │               │
```