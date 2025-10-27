# Feature: Mobile-Friendly Renderer Refactor

## Problem Statement
The Audio Project Manager UI works well on desktop Electron and standard web browsers but performs poorly on mobile devices. Layouts do not adapt to small screens, interactions rely on mouse/keyboard metaphors, and critical workflows become unusable on touch devices. We have new visual designs (desktop + mobile) that introduce refreshed layouts, updated aesthetics, and universal interaction patterns. Mobile will support a curated subset of desktop functionality.

## Goals & Non-Goals
- **Goals**
  - Implement responsive layouts that respect the new designs across desktop, tablet, and phone breakpoints.
  - Introduce mobile-specific interaction patterns per instructions (touch gestures, larger hit targets, simplified flows) while maintaining parity where feasible.
  - Support design-driven front-end features required to deliver the new UI (e.g., adaptive navigation, condensed toolbars, context-aware modals).
  - Establish a systematic approach to platform capability detection so the renderer can gracefully expose a subset of features on small screens.
  - Ensure theming, spacing, and typography scale appropriately across form factors while maintaining accessibility.
  - Keep changes confined to renderer/UI layers; no backend/business-scope features included in this spec.
- **Non-Goals**
  - Authoring brand-new business workflows or backend APIs.
  - Replacing Orbit schema, Redux shape, or IPC contracts unless strictly required to unblock the UI refactor.
  - Implementing accessibility audits beyond the scope of the provided designs.

## Inputs & Deliverables
- **Inputs** (supplied during implementation):
  - Annotated design files/screenshots for desktop, tablet, and mobile layouts.
  - Design tokens for spacing, colors, typography, and component states.
  - Platform-specific interaction notes (e.g., gestures, navigation patterns, contextual actions).
- **Deliverables**:
  - Updated React components, hooks, and styling to match the supplied designs.
  - Responsive breakpoints and layout utilities integrated into the renderer.
  - Feature gating / capability detection logic for desktop vs mobile.
  - Updated tests (unit, integration, snapshot where applicable) to cover new UI behavior.
  - Documentation snippets (developer notes) describing new layout system, component usage, and platform coverage matrix.

## Implementation Requirements
### Layout & Styling
- Introduce or extend a responsive grid / layout utility aligned with the design tokens.
- Update core shells (navigation, headers, footers, sidebars) to adapt across breakpoints.
- Ensure typography scales for readability on small screens; adjust MUI theme or component overrides as needed.
- Replace any fixed-width/height assumptions with flexible units; eliminate viewport-breaking overflow.

### Navigation & Interaction Patterns
- Create adaptive navigation structures (e.g., bottom navigation, drawer menus, contextual action sheets) per provided mobile designs.
- Rework mouse/keyboard-dependent interactions into touch-friendly equivalents where the mobile design includes/assumes that interaction.
- Ensure keyboard accessibility remains intact on desktop; do not regress existing hotkey flows.
- Provide clear affordances for feature subsets—surface unavailable desktop features on mobile with “upgrade” or “desktop only” cues when required by design.

### Component Updates
- Refactor key view components (TeamScreen, PlanScreen, PassageDetail, Burrito flows) to support mobile layouts.
- Extract reusable UI primitives for repeated mobile patterns (card lists, expandable panels, responsive tables-to-lists transforms).
- Update dialog/modal behavior to follow platform guidelines (full-screen overlays on mobile where designs specify).

### Platform Detection & Feature Subsetting
- Introduce a centralized capability detector (viewport width, user agent, device class) to drive conditional rendering.
- Codify which features are desktop-only vs mobile-supported; expose this via context or hooks for consistent UI logic.
- Provide fallback messaging or alternate flows when a mobile user encounters an unsupported feature.

### Testing & Validation
- Add/adjust unit tests for layout utilities, hooks, and platform detection logic.
- Coordinate a design review loop: produce snapshots (if available) for sign-off, adjust iteratively based on feedback.
- Update .memory.md to reduce iteration loops when making similar/patterned mistakes.

## Acceptance Criteria
- All primary renderer views render correctly on mobile breakpoints, matching provided designs (verified via screenshot comparison and design QA sign-off).
- Touch interactions (tap, swipe, drag where specified) replace mouse/keyboard dependencies without breaking desktop behavior.
- Feature gating accurately reflects the intended desktop vs mobile matrix; unsupported features provide clear guidance.
- No critical regressions in Electron desktop experience (layouts remain stable, hotkeys functional, window sizing unaffected).
- Tests covering new utilities/components pass (`npm run test`, targeted renderer suites) and lint/type checks remain clean.

## Rollout & Risk Mitigation
- Plan phased releases per feature area (navigation, Team/Plan views, detail screens) to reduce risk.
- Maintain feature flags or environment toggles for mobile-specific components during rollout.
- Monitor performance on low-powered mobile devices; optimize bundle splits and lazy loading where necessary.
- Capture open questions (design ambiguities, missing assets) in project tracking, resolve with UX before implementation stalls.

## Open Questions / Follow-ups
- Confirm target device list and breakpoints (e.g., minimum supported viewport width, tablet portrait/landscape specifics).
- Align with design team on animation/motion requirements for mobile interactions.
- Determine whether to introduce a component library (e.g., Storybook) for regression checks going forward.
