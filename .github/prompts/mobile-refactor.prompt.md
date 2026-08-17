---
mode: React
tools: ['codebase', 'editFiles', 'runTests', 'problems', 'testFailure']
description: 'Guided workflow for implementing the mobile renderer refactor'
---
# Mobile Renderer Refactor Workflow

## Step 0 · Prerequisites
- Read `.github/specs/mobile-refactor.spec.md` for scope, acceptance criteria, and open questions.
- Review `.github/instructions/frontend.instructions.md` for renderer architecture guidance.
- Check `.github/.context.md` for overall project context and layer responsibilities.

## Step 1 · Architecture Alignment (Optional)
If architectural trade-offs or sequencing decisions are unclear, switch to the `architect` chat mode and request an assessment:
```
@mode architect
Review the mobile refactor spec and highlight architecture concerns for <area/component>.
```
Otherwise continue with the default React developer mode.

## Step 2 · Implementation Planning
- Identify the specific screen(s) or components to update (e.g., TeamScreen navigation).
- Outline the responsive/layout updates and platform feature gating required.
- Summarize dependencies (shared hooks, context, Redux slices) that need modification or reuse.

## Step 3 · Execute Changes (React Mode)
- Ensure chat is in React mode: `@mode react`.
- Implement UI updates in `src/renderer/src/**`, following the spec’s guidance.
- Prefer editing existing components/hooks; introduce new utilities only when needed for the new layouts or platform detection.
- Use existing helper hooks (`useMyNavigate`, `useCheckOnline`, etc.) rather than reinventing logic.

## Step 4 · Validation
- Run targeted tests as needed (`npm run test -- <pattern>`). Document any failures and fixes.
- Perform manual checks for responsive breakpoints (desktop, tablet, mobile) and feature gating.
- Capture feedback / adjustments from design review; loop back to Step 3 for tweaks.

## Step 5 · Wrap-Up
- Summarize changes, impacted files, and outstanding follow-ups.
- Update `.github/specs/mobile-refactor.spec.md` open questions if new decisions were made.
- Note next tasks for remaining views or interactions.
