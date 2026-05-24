# Code Quality & Automation Plan

This document outlines the bite-sized steps to introduce JSDoc enforcement, automated import sorting, and strict pre-commit testing. These guardrails ensure that the codebase remains highly readable and stable, even during long gaps between active development sessions.

## Bite-size rule

**Each bite touches a minimal set of files, produces a clean build, and is independently committable.** No bite should require understanding another in-progress bite to be reviewed.

## Phase 1: JSDoc Enforcement

- [x] **Bite 1.1: Install ESLint JSDoc Plugin**
  - Run `pnpm add -D eslint-plugin-jsdoc`.
- [x] **Bite 1.2: Configure JSDoc Rules**
  - Update `eslint.config.js` to include the `jsdoc` plugin.
  - Enable `jsdoc/require-jsdoc` with severity set to `"warn"`.
  - Configure the rule to _only_ apply to exported functions, types, and interfaces (internal helpers are exempt).
- [x] **Bite 1.3: Document Core Interfaces**
  - Resolve any initial warnings by adding clean `/** ... */` JSDoc blocks to core exports in `src/core/types.ts` or `src/core/router/types.ts`.

## Phase 2: Import Sorting Automation

- [x] **Bite 2.1: Install Import Sort Plugin**
  - Run `pnpm add -D eslint-plugin-simple-import-sort`.
- [x] **Bite 2.2: Configure Import Rules**
  - Update `eslint.config.js` to enable `simple-import-sort/imports` and `simple-import-sort/exports`.
- [x] **Bite 2.3: Auto-format Existing Codebase**
  - Run `pnpm run lint --fix` to automatically sort all imports across the entire repository and commit the clean diff.

## Phase 3: Pre-Commit Test Enforcement

- [x] **Bite 3.1: Add Tests to Husky Hook**
  - Modify `.husky/pre-commit`.
  - Add `pnpm exec vitest run` (the `--run` flag ensures it executes once and exits, rather than hanging in watch mode) before the `lint-staged` command.
  - _Note: Tests will now run on every commit. Since the suite currently takes < 3 seconds, this provides an immediate safety net without ruining developer experience._
- [x] **Bite 3.2: Verify the Hook**
  - Make a minor safe commit to ensure tests execute successfully and do not block valid commits.
