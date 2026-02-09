---
description: Login to a Claude Code profile (creates the profile if it doesn't exist, clears credentials for fresh OAuth login)
---

Login to a Claude Code profile. If the profile doesn't exist, it will be created automatically. This clears existing credentials so the next `claude` launch triggers a fresh OAuth login.

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" login $ARGUMENTS
```

After login, remind the user to run `claude` to complete the OAuth login flow.
