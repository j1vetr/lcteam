---
name: Codegen compatibility
description: Why API generation explicitly targets the installed React Query major.
---

Keep Orval's React Query target major explicit rather than relying on automatic package detection in this monorepo.

**Why:** The generator did not find the consumer's React Query dependency through the shared client package and defaulted to an older major. This can produce incompatible hook option signatures even though generation succeeds.

**How to apply:** When upgrading the generator or React Query, align the explicit target with the consumer's installed version and regenerate the contract clients together.
