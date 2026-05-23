# Rule: Planning in Repository

## Activation
- **Always On**

## Description
Instructs the agent to store and manage implementation plans, task lists, and walkthroughs directly inside the repository under the `docs/` folder, rather than using the system's default app data `brain` folder.

## Guidelines
1. **Implementation Plans**: Write and update all implementation plans at `docs/implementation_plan.md` instead of the system's app data brain folder.
2. **Tasks**: Track the progress checklist in `docs/task.md` and synchronize the root-level `task.md` with it.
3. **Walkthroughs**: Write walkthroughs at `docs/walkthrough.md` instead of the brain folder.
4. **No Brain Folder Markdown**: Do not write `.md` artifacts into the system's app data `brain/` directory.
