# Rule: Directory Descriptions (.info) and Tree Usage

## Activation
- **Always On**

## Guidelines
1. **Directory Descriptions (.info)**:
   - Always keep directory-level `.info` files up to date when adding, deleting, or refactoring files or directories.
   - Use `tree --info --gitignore` to list files and inspect the directory structure and their accompanying `.info` summaries.

2. **Tree Command Safety**:
   - **Never** run the `tree` shell command without the `--gitignore` option. Running `tree` without it can dump massive, irrelevant folders (e.g., `node_modules`, build artifacts) and pollute/overload the agent's context.
