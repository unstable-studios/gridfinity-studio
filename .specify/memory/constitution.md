<!--
Sync Impact Report
===================
Version change: N/A → 1.0.0 (initial ratification)
Modified principles: N/A (initial)
Added sections:
  - 7 Core Principles (I–VII)
  - Development Constraints
  - Quality Gates & Workflow
  - Governance
Removed sections: N/A
Templates requiring updates:
  - .specify/templates/plan-template.md — ✅ compatible (Constitution Check section present)
  - .specify/templates/spec-template.md — ✅ compatible (requirements use MUST language)
  - .specify/templates/tasks-template.md — ✅ compatible (test-first ordering matches TDD principle)
Follow-up TODOs: None
-->

# Gridfinity Studio Constitution

## Core Principles

### I. Type Safety & Schema Correctness

All code MUST be written in strict TypeScript with no use of `any`.
The canonical project schema (`src/shared/types/project.ts`) is the single
source of truth for project data. All data crossing process boundaries
MUST be validated against the project schema. Schema changes MUST be
backward-compatible or accompanied by a migration strategy.

- No `any`, `as unknown as T`, or `@ts-ignore` without explicit
  justification in a code comment referencing this principle.
- All IPC payloads MUST use `OperationResult<T>` for consistent
  error handling.
- Zod or equivalent runtime validation MUST guard all external input
  (file loads, IPC messages from renderer).

**Rationale**: A 3D design tool that corrupts project files destroys
user trust. Type safety and schema validation are the first line of
defense against data corruption.

### II. Electron Process Isolation

The Electron multi-process model MUST be strictly enforced:

- **Main process** (`src/main/`): Node.js APIs, file I/O, window
  management, IPC handlers. No DOM or React imports.
- **Preload** (`src/preload/`): Context bridge only. Exposes
  `window.api.*` surface. No business logic.
- **Renderer** (`src/renderer/`): React SPA, Three.js viewport, UI
  components. No Node.js APIs or `require()`.
- **Shared** (`src/shared/`): Types, schemas, validation. No
  process-specific imports.

Direct `ipcRenderer`/`ipcMain` usage outside the established
`window.api` pattern is prohibited. All new IPC channels MUST be
registered in preload and documented.

**Rationale**: Process isolation is Electron's security model. Violating
it exposes the app to remote code execution via the renderer.

### III. Test-First Development (NON-NEGOTIABLE)

All feature work MUST follow test-driven development:

1. Write tests that express the desired behavior.
2. Verify tests FAIL (red).
3. Implement the minimum code to make tests pass (green).
4. Refactor while keeping tests green.

This applies to:
- New features and user stories.
- Bug fixes (write a failing test that reproduces the bug first).
- Schema changes (contract tests for new/modified shapes).

Exceptions: Pure UI layout changes (visual regression testing is
recommended but not blocked on TDD). Exceptions MUST be noted in the
PR description.

**Rationale**: TDD catches regressions early and produces code with
built-in verification. In a 3D editor where state is complex, untested
code is a liability.

### IV. 3D Performance

The Three.js viewport MUST maintain 60 fps during normal interaction
(pan, orbit, zoom, select) on the minimum supported hardware tier.

- Mesh geometry MUST be instanced where repeated (e.g., grid cells,
  bin walls).
- React re-renders MUST NOT trigger unnecessary Three.js scene graph
  updates. Use `useMemo`, `useRef`, and `@react-three/fiber` best
  practices.
- Large operations (bulk placement, project load) MUST show progress
  feedback and MUST NOT block the UI thread.
- Performance regressions MUST be caught by profiling before merge.

**Rationale**: Users interact with Gridfinity layouts spatially. Laggy
3D interaction makes the tool unusable regardless of feature richness.

### V. User Experience & Accessibility

The application MUST be intuitive for users unfamiliar with CAD tools:

- All interactive elements MUST have visible affordances (hover states,
  cursors, tooltips).
- Keyboard shortcuts MUST exist for all frequent operations.
- Color MUST NOT be the sole indicator of state (support colorblind
  users).
- Undo/redo MUST work for all destructive actions in the viewport and
  sidebar.
- Error messages MUST be user-facing and actionable, not stack traces
  or developer jargon.

**Rationale**: Gridfinity Studio targets makers and organizers, not
software engineers. The UI must meet them where they are.

### VI. Conventional Commits & CI Discipline

All commits MUST follow the Conventional Commits specification enforced
by commitlint:

```
<type>(<scope>): <subject>
```

- Types: feat, fix, docs, style, refactor, perf, test, build, chore, ci
- Scopes: core, ui, middleware, ci, test, docs, repo, infra, deps, release
- Subject: imperative mood, lowercase, no period, max 72 chars.

CI checks (typecheck, lint, format, tests) MUST pass before merge.
Skipping CI checks or force-pushing over failures is prohibited.

**Rationale**: Consistent commit history enables automated changelogs
via release-please and makes bisecting regressions tractable.

### VII. Simplicity & YAGNI

Every abstraction, dependency, and architectural decision MUST justify
its existence against a simpler alternative:

- No premature abstractions. Three similar lines of code are better
  than a premature helper.
- No speculative features or "just in case" code paths.
- New dependencies MUST be justified (bundle size, maintenance burden,
  alternatives considered).
- Complexity MUST be tracked in the plan's Complexity Tracking table
  when a principle is intentionally bent.

**Rationale**: Desktop apps ship to users' machines. Every unnecessary
dependency and abstraction is maintenance debt that slows iteration.

## Development Constraints

- **Runtime**: Electron 39, Node v24, pnpm (no npm/yarn).
- **Frontend**: React 19, Tailwind CSS 4, Shadcn/ui, @react-three/fiber.
- **Language**: TypeScript 5.9 strict mode across all processes.
- **Build**: electron-vite + Vite 7. Build MUST complete without
  warnings treated as errors.
- **Release**: release-please for automated versioning and CHANGELOG.
  Manual version bumps are prohibited.
- **File format**: `.gfstudio` files are JSON conforming to the
  canonical project schema. The validator MUST reject files that fail
  schema validation, including duplicate ID detection.

## Quality Gates & Workflow

All pull requests MUST satisfy these gates before merge:

1. **Type check**: `pnpm typecheck` passes (both node and web configs).
2. **Lint**: `pnpm lint` passes with zero warnings.
3. **Format**: `pnpm format` produces no diff.
4. **Tests**: All tests pass. New features MUST include tests (per
   Principle III).
5. **Review**: At least one approving review.
6. **No force-push to main**: The main branch is protected. Force-push
   is prohibited.

Branch naming: `<issue-number>-<kebab-case-description>` (e.g.,
`42-add-bin-resize`).

## Governance

This constitution is the highest-authority document for Gridfinity
Studio development practices. It supersedes ad-hoc decisions, PR
comments, and verbal agreements.

**Amendment procedure**:
1. Propose the change in a PR modifying this file.
2. Document the rationale and migration impact.
3. Version bump per semantic versioning (see below).
4. All active contributors MUST acknowledge the change.

**Versioning policy**:
- MAJOR: Principle removed, redefined, or made incompatible with
  existing code.
- MINOR: New principle or section added, or existing guidance
  materially expanded.
- PATCH: Clarifications, typos, non-semantic wording improvements.

**Compliance review**: Every PR review MUST verify adherence to the
applicable principles. The plan template's "Constitution Check" section
MUST be completed before implementation begins.

**Version**: 1.0.0 | **Ratified**: 2026-03-04 | **Last Amended**: 2026-03-04
