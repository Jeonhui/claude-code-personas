---
description: Switch the active Claude Code profile by updating the configuration symlink
---

Switch the active Claude Code profile. This updates the `~/.claude` symlink to point to the selected profile directory.

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" switch $ARGUMENTS
```

After switching, remind the user to **restart Claude Code** for the changes to take full effect.
