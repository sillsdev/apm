# Project ownership and sync models

APM supports three distinct ways a project relates to the cloud. These are ownership/sync models, not project content types (Scripture vs General).

**Personal Team (cloud):** Solo projects backed up and synced to the cloud. Some admin operations require an Internet connection because cloud authority is the source of truth for configuration that is not fully available offline. See ADR 0012 for how the canonical Personal Team and its workflow are chosen when personal-named orgs duplicate.

**Work Alone (local-only):** Projects that never sync to the cloud, owned by the **Work Alone Team**. The user can perform admin functions offline because there is no cloud authority to conflict with. See ADR 0012 for canonical Work Alone Team / workflow resolution.

**Team + Offline Available:** Shared cloud projects downloaded for disconnected work. Still syncs to the cloud when online; distinct from Work Alone.

Desktop supports Work Alone, Personal Team, team projects, and offline Paratext folder sync. Web supports cloud-backed flows only (no Work Alone, no local Paratext folder sync).
