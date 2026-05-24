# Package Manager & JSON Linting Plan

This document outlines the bite-sized steps to enforce strict package manager usage and introduce automated guardrails for `package.json` to ensure code-quality is maintained, especially when collaborating with AI assistants.

## Bite-size rule

**Each bite touches a minimal set of files, produces a clean build, and is independently committable.** No bite should require understanding another in-progress bite to be reviewed.

## Phase 1: Enforce Package Manager (only-allow)

- [ ] **Bite 1.1: Install only-allow**
  - Run `pnpm add -D only-allow` to add it to development dependencies.
- [ ] **Bite 1.2: Add preinstall script**
  - Update `package.json` scripts to include `"preinstall": "npx only-allow pnpm"`.
  - Test by temporarily running `npm install` to ensure the hook aggressively blocks the action.

## Phase 2: AI Guardrails (package.json linting)

- [ ] **Bite 2.1: Install ESLint plugin**
  - Run `pnpm add -D eslint-plugin-package-json` to install the linter.
- [ ] **Bite 2.2: Configure ESLint**
  - Update `eslint.config.js` to include the `package-json` plugin and rules.
  - Enable rules such as sorting dependencies (`package-json/sort-collections`) and enforcing valid properties.
- [ ] **Bite 2.3: Fix existing violations**
  - Run ESLint over `package.json`.
  - Alphabetize dependencies and `devDependencies` if they are currently out of order.
- [ ] **Bite 2.4: Automate in Pre-commit hook**
  - Ensure the existing `lint-staged` configuration in `package.json` automatically includes `.json` files so that any future AI or human edits to `package.json` are strictly linted before a commit is allowed.
