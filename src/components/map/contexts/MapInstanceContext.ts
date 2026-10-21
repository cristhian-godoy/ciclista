import type * as maplibregl from 'maplibre-gl';
import type React from 'react';
import { createContext, useContext } from 'react';

import type { ToolbarMode } from '../../SideToolbar';

/**
 * Context menu display state structure.
 */
export interface ContextMenuData {
  visible: boolean;
  x: number;
  y: number;
  lng: number;
  lat: number;
  crossingId: string | null;
  nodeIds: string | null;
  placeId?: string | null;
}

/**
 * Domain context type defining MapLibre map instance, theme, and view panel visibility states.
 */
export interface MapInstanceContextType {
  map: maplibregl.Map | null;
  setMap: React.Dispatch<React.SetStateAction<maplibregl.Map | null>>;
  mapReady: boolean;
  setMapReady: React.Dispatch<React.SetStateAction<boolean>>;
  theme: 'bright' | 'liberty' | 'dark';
  shouldFitBounds: boolean;
  setShouldFitBounds: (val: boolean) => void;
  dockExpanded: boolean;
  setDockExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  contextMenu: ContextMenuData;
  setContextMenu: React.Dispatch<React.SetStateAction<ContextMenuData>>;
  appMode: ToolbarMode;
  setAppMode: (mode: ToolbarMode) => void;
}

/**
 * Context instance for MapLibre map instance and viewport controls.
 */
export const MapInstanceContext = createContext<MapInstanceContextType | null>(null);

/**
 * React hook to consume the nearest MapInstanceContext.
 *
 * @returns Active MapInstanceContextType value.
 * @throws Error when consumed outside of a MapInstanceContext provider.
 */
export function useMapInstanceContext(): MapInstanceContextType {
  const context = useContext(MapInstanceContext);
  if (!context) {
    throw new Error(
      'useMapInstanceContext must be used within a MapInstanceContext.Provider or MapProvider',
    );
  }
  return context;
}
