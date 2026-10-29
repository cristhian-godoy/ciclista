import type React from 'react';
import { createContext, useContext } from 'react';

import type { CrossingTurnOverride } from '../../../core/config';

/**
 * Sub-mode discriminator within Edit Mode toggling between micro-path routing and signal wait times.
 */
export type EditSubMode = 'paths' | 'signals';

/**
 * Domain context type defining crossing edge and node selection and turn delays in Crossing Edit mode.
 */
export interface CrossingEditorContextType {
  activeCrossingId?: string | null;
  setActiveCrossingId?: (id: string | null) => void;
  activeTurnSelection?: {
    fromNodeId: string | null;
    toNodeId: string | null;
    waypointNodeIds: string[];
  };
  setActiveTurnSelection?: React.Dispatch<
    React.SetStateAction<{
      fromNodeId: string | null;
      toNodeId: string | null;
      waypointNodeIds: string[];
    }>
  >;
  crossingTurns?: CrossingTurnOverride[];
  onSaveCrossingTurn?: (override: CrossingTurnOverride) => void;
  onDeleteCrossingTurn?: (id: string) => void;
  editSubMode?: EditSubMode;
  setEditSubMode?: (mode: EditSubMode) => void;
}

/**
 * Context instance for crossing micro-geometry editing and crossing turn override definitions.
 */
export const CrossingEditorContext = createContext<CrossingEditorContextType | null>(null);

/**
 * React hook to consume the nearest CrossingEditorContext.
 *
 * @returns Active CrossingEditorContextType value.
 * @throws Error when consumed outside of a CrossingEditorContext provider.
 */
export function useCrossingEditorContext(): CrossingEditorContextType {
  const context = useContext(CrossingEditorContext);
  if (!context) {
    throw new Error(
      'useCrossingEditorContext must be used within a CrossingEditorContext.Provider or MapProvider',
    );
  }
  return context;
}
