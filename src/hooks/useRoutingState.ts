import { useState } from 'react';

import type { Coordinate } from '../core/common/types';
import type { GraphNode } from '../core/graph/types';

/**
 * Hook to manage routing configuration state, coordinates, selected nodes,
 * and routing strategy.
 */
export function useRoutingState() {
  const [startCoord, setStartCoord] = useState<Coordinate | null>(null);
  const [endCoord, setEndCoord] = useState<Coordinate | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [routingStrategy, setRoutingStrategy] = useState<
    'standard' | 'avoid-stops' | 'quiet-streets'
  >('standard');

  return {
    startCoord,
    setStartCoord,
    endCoord,
    setEndCoord,
    selectedNode,
    setSelectedNode,
    routingStrategy,
    setRoutingStrategy,
  };
}
/**
 * Return type of the useRoutingState hook.
 */
export type UseRoutingStateReturn = ReturnType<typeof useRoutingState>;
