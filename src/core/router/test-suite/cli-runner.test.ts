import { describe, expect, it } from 'vitest';

import { OSMGraphParser } from '../../graph/parser';
import { ROUTING_TEST_CASES } from './registry';
import { runRoutingTest } from './runner';

describe('Routing Test Suite CLI Runner', () => {
  const parser = new OSMGraphParser();
  const munichGraph = parser.parse(null);

  it.each(ROUTING_TEST_CASES)('executes test case: $id ($name)', (testCase) => {
    const result = runRoutingTest(testCase, munichGraph);
    if (!result.passed) {
      console.error(`Failures for ${testCase.id}:`, result.failures);
    }
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
    expect(result.resolvedRoute).not.toBeNull();
  });
});
