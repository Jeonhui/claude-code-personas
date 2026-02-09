---
description: Delete an existing Claude Code profile (cannot delete the active profile)
---

Delete a Claude Code profile. The currently active profile cannot be deleted — the user must switch to a different profile first.

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" delete $ARGUMENTS
```

If deletion fails because the profile is active, suggest using `/personas:switch` first.
