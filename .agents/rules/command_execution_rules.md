# Rule: Synchronous Command Execution Timeout

## Activation

- **Always On**

## Guidelines

1. **Tool Execution Parameter**:
   - For all `run_command` tool calls, you MUST set the `WaitMsBeforeAsync` argument to `10000` (10 seconds) to maximize synchronous execution duration. This prevents commands from moving to background tasks and generating async notifications.
