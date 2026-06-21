---
name: repo_init
description: 'Always use this skill! Trigger this at the beginning of every request, task, or conversation in this repository to orient yourself, gather context, and load repository rules.'
---

# Repository Initialization Protocol

When you trigger this skill, you **MUST** execute the following steps.
**Crucial Constraint**: You must do this all extremely silently to save tokens. Do not output walkthroughs, plans, or step-by-step actions to the user while doing this. Only provide a super tiny output at the end of the process.

1. **Check Structure**: Run the command `tree --info --gitignore` to understand the repository structure.
2. **Check History**: Run the command `git log --oneline --stat -n 20` to understand the recent history (if you deem it useful based on the request).
3. **Read Rules**: You MUST read the rules located in the `.agents/rules` directory! Do not skip this step.
4. **Silence Protocol**: Load and follow the instructions in the `silence` skill to guarantee silent execution and minimal token consumption.

Perform these steps before proceeding with the user's actual request.
