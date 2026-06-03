# Project ownership and sync models

APM supports three distinct ways a project relates to the cloud. These are ownership/sync models, not project content types (Scripture vs General).

**Personal Team (cloud):** Solo projects backed up and synced to the cloud. Some admin operations require an Internet connection because cloud authority is the source of truth for configuration that is not fully available offline.

**Work Alone (local-only):** Projects that never sync to the cloud. The user can perform admin functions offline because there is no cloud authority to conflict with.

**Team + Offline Available:** Shared cloud projects downloaded for disconnected work. Still sync to the cloud when online; distinct from Work Alone.

Desktop supports Work Alone, Personal Team, team projects, and offline Paratext folder sync. Web supports cloud-backed flows only (no Work Alone, no local Paratext folder sync).
