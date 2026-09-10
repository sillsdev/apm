# Canonical personal workflow teams

Personal-named organizations can duplicate in local data. We still treat the user as having one **Personal Team** (oldest owned personal-named org with a cloud identity) and one **Work Alone Team** (oldest owned personal-named org without a cloud identity). Mode chooses which: **Work Alone** mode resolves the Work Alone Team; otherwise the Personal Team.

Edit Workflow and Workflow Navigation always use that canonical team's workflow — even when a project still belongs to a non-canonical duplicate. Project ownership and other team context stay on the recorded org until a deliberate migration. Empty workflows may be seeded from process templates (not copied from a duplicate), but only after the session’s team/workflow data is fully loaded: load complete, remote/backup queues idle, a create lock held, and a re-query that is still empty. An empty query during load must not create a second set of steps (a past failure mode when auto-create raced ahead of Orbit/backup catch-up).

## Considered options

- Prefer whatever org a personal project hangs off for Edit Workflow — rejected; leaves two workflows and recreates TT-7397.
- Copy steps from a duplicate onto the canonical team — rejected; two sources of truth and edited duplicates would fork configuration.
- Auto-seed whenever a step query returns empty — rejected; caused duplicate steps when data existed but was not loaded yet. Seeding is allowed only after load complete, queues idle, create lock, and a still-empty re-query.
