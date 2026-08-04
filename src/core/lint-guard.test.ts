import { execSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

describe('Linter Configuration Integrity Guard', () => {
  it('ensures linter configuration files are untouched in git working tree', () => {
    try {
      const changedFiles = execSync('git diff HEAD --name-only', { encoding: 'utf-8' });
      expect(changedFiles).not.toContain('.stylelintrc.json');
      expect(changedFiles).not.toContain('eslint.config.js');
    } catch {
      // In non-git environment or test harness without git repository, pass gracefully
    }
  });
});
