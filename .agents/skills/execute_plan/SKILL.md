---
name: execute_plan
description: 'Use this skill to systematically execute a repository implementation plan, working task by task, committing after each, and avoiding slow harness task features.'
---

# Plan Execution Protocol

When you are asked to execute a plan or roadmap in this repository, you **MUST** follow this iterative work cycle:

## Loop: Take, Work, Verify, Commit, Next

For each task in the plan:

1. **Take Task**: Identify the specific task from the plan you are beginning.
2. **Work**: Implement the code changes required for this task. Adhere to codebase guidelines, type definitions, and naming conventions.
3. **Verify**:
   - Run tests (`pnpm test` or the appropriate test command) to ensure there are no regressions.
   - Run the linter (`pnpm lint`) to verify code styling and formatting rules.
4. **Commit**:
   - Stage only the files modified or added for this specific task.
   - Commit the changes with a clear, descriptive message (e.g., `git commit -m "Implement Web Worker for graph parsing"`).
5. **Next**: Move to the next task in the plan.

## Strict Efficiency Constraint: No Harness Background Tasks

> [!IMPORTANT]
> **Do not use the harness background task execution feature for fast or synchronous commands.**
> Running commands in the background (which requires querying status, polling, or waiting) adds unnecessary system overhead, generates excessive logs, and slows down execution.
>
> - **Synchronous Command Execution:** For tests (`pnpm test`), linters (`pnpm lint`), or Git commits (`git commit`), execute the `run_command` tool directly and wait for completion.
> - **No Background Polling:** Avoid sending commands to the background unless they are long-running servers. Never check background status loops recursively.
