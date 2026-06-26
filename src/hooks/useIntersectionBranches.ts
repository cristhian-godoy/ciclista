import { useMemo } from 'react';

import type { LocalOverrides } from '../core/config';
import type { StreetGraph } from '../core/graph/types';
import { evaluateIntersectionBranches } from '../core/inspector/evaluator';
import type { InspectorBranchEvaluation } from '../core/inspector/types';
import type { RouteResult } from '../core/router/types';

interface UseIntersectionBranchesProps {
  selectedNodeId: string | null;
  routeResult: RouteResult | null;
  graph: StreetGraph | null;
  overrides: LocalOverrides;
  activeStrategyLabel?: 'standard' | 'avoid-stops' | 'quiet-streets';
}

/**
 * Custom React hook to dynamically evaluate alternative outgoing intersection branches
 * on-demand for the currently selected node in inspector mode.
 */
export function useIntersectionBranches({
  selectedNodeId,
  routeResult,
  graph,
  overrides,
  activeStrategyLabel = 'standard',
}: UseIntersectionBranchesProps): InspectorBranchEvaluation[] {
  return useMemo(() => {
    if (!selectedNodeId || !routeResult || !graph) {
      return [];
    }
    return evaluateIntersectionBranches(
      selectedNodeId,
      routeResult,
      graph,
      overrides,
      activeStrategyLabel,
    );
  }, [selectedNodeId, routeResult, graph, overrides, activeStrategyLabel]);
}
