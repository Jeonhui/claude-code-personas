---
description: Logout from the current Claude Code profile (clears Keychain credentials and saved credential file)
---

Logout from the current Claude Code profile. This removes the authentication credentials from both the macOS Keychain and the saved credential file for the active profile.

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" logout
```

After logout, the user can run `claude` to log in again with a different account.
