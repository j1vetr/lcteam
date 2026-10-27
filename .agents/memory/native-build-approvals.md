---
name: Native build approvals
description: A working native module does not prove pnpm approved its install scripts on the Ubuntu host.
---

Do not treat a successful Argon2 runtime check as proof that dependency build scripts were approved.

**Why:** During Ubuntu setup, Argon2 worked while the server's workspace configuration explicitly denied both Argon2 and esbuild builds. Prebuilt binaries can mask missing build permissions.

**How to apply:** Inspect the actual permission diff before resolving deployment conflicts. Keep intentional build approvals in the repository rather than repeatedly approving them only on the server. Never discard unrelated server edits.
