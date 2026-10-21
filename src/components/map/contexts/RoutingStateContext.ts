import type React from 'react';
import { createContext, useContext } from 'react';

import type { Coordinate } from '../../../core/common/types';
import type { SemanticTurnType } from '../../../core/config';
import type { GraphNode, StreetGraph } from '../../../core/graph/types';
import type { InspectorBranchEvaluation } from '../../../core/inspector/types';
import type { StrategyRouteVariant } from '../../../core/router/types';

/**
 * Domain context type defining street graph, routing variants, node overrides, and inspector states.
 */
export interface RoutingStateContextType {
  graph: StreetGraph | null;
  loadedBBoxes: [number, number, number, number][];
  startCoord: Coordinate | null;
  endCoord: Coordinate | null;
  routeVariants: StrategyRouteVariant[];
  activeAlternativeLabel: 'standard' | 'avoid-stops' | 'quiet-streets';
  onSelectAlternative: (label: 'standard' | 'avoid-stops' | 'quiet-streets') => void;
  customNodeDelays: Map<string, number>;
  customNodeNotes: Map<string, string>;
  customNodeTurns: Map<string, Record<string, SemanticTurnType>>;
  selectedNode: GraphNode | null;
  onStartDrag: (coord: Coordinate | null) => void;
  onEndDrag: (coord: Coordinate | null) => void;
  onNodeSelect: (node: GraphNode | null) => void;
  onSaveNodeOverride: (nodeId: string, delay: number, notes: string) => void;
  onSaveNodeTurns: (nodeId: string, turns: Record<string, SemanticTurnType>) => void;
  onClearNodeOverride: (nodeId: string) => void;
  showMinorControls: boolean;
  setShowMinorControls: (val: boolean) => void;
  managedClusterId: string | null;
  setManagedClusterId: (val: string | null) => void;
  managedNodeIds: string[];
  setManagedNodeIds: React.Dispatch<React.SetStateAction<string[]>>;

  // Inspector Mode states
  isInspectorModeActive: boolean;
  onToggleInspectorMode: () => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  selectedAlternativeTargetId: string | null;
  setSelectedAlternativeTargetId: (id: string | null) => void;
  inspectorBranches: InspectorBranchEvaluation[];
}

/**
 * Context instance for routing calculations, graph nodes, and road configuration overrides.
 */
export const RoutingStateContext = createContext<RoutingStateContextType | null>(null);

/**
 * React hook to consume the nearest RoutingStateContext.
 *
 * @returns Active RoutingStateContextType value.
 * @throws Error when consumed outside of a RoutingStateContext provider.
 */
export function useRoutingStateContext(): RoutingStateContextType {
  const context = useContext(RoutingStateContext);
  if (!context) {
    throw new Error(
      'useRoutingStateContext must be used within a RoutingStateContext.Provider or MapProvider',
    );
  }
  return context;
}
