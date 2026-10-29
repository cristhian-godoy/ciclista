# Rule: Linter and Type Integrity

## Activation
- **Always On**

## Guidelines

1. **No Tooling Workarounds**:
   - Do NOT modify or relax linter, compiler, or build configurations (`.stylelintrc.json`, `eslint.config.js`, `tsconfig*.json`, etc.) to make checks pass.
   - Do NOT use suppression directives (`/* eslint-disable */`, `@ts-ignore`, `@ts-expect-error`, `/* stylelint-disable */`) to bypass errors. Resolve the underlying code issue directly.

2. **Type Safety**:
   - Prefer concrete TypeScript interfaces and type narrowing over `any`. Keep type assertions (`as T`) localized strictly to untyped third-party library boundaries.

3. **JSDoc Standards**:
   - Exported functions, classes, interfaces, type aliases, and enums must include meaningful JSDoc descriptions explaining structural purpose and behavior. Avoid empty or redundant tags.
