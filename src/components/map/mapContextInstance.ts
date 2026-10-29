import { createContext, useContext } from 'react';

import type {
  CrossingEditorContextType,
  MapInstanceContextType,
  NavigationStateContextType,
  RoutingStateContextType,
  StudioStateContextType,
} from './contexts';
import {
  CrossingEditorContext,
  MapInstanceContext,
  NavigationStateContext,
  RoutingStateContext,
  StudioStateContext,
} from './contexts';

export type {
  ContextMenuData,
  CrossingEditorContextType,
  EditSubMode,
  LandmarkModalState,
  MapInstanceContextType,
  NavigationStateContextType,
  PlaceModalState,
  RoutingStateContextType,
  StudioStateContextType,
} from './contexts';
export {
  CrossingEditorContext,
  MapInstanceContext,
  NavigationStateContext,
  RoutingStateContext,
  StudioStateContext,
  useCrossingEditorContext,
  useMapInstanceContext,
  useNavigationStateContext,
  useRoutingStateContext,
  useStudioStateContext,
} from './contexts';

/**
 * Composite MapContextType combining all focused domain context states and operations.
 */
export type MapContextType = MapInstanceContextType &
  RoutingStateContextType &
  NavigationStateContextType &
  StudioStateContextType &
  CrossingEditorContextType;

/**
 * Primary React context instance providing MapContextType values to map component hierarchy.
 */
export const MapContext = createContext<MapContextType | null>(null);

/**
 * React hook to consume the nearest MapContext or compose from domain-scoped contexts.
 *
 * @returns Active MapContextType value.
 * @throws Error when consumed outside of a MapProvider hierarchy.
 */
export function useMapContext(): MapContextType {
  const legacy = useContext(MapContext);
  const mapInstance = useContext(MapInstanceContext);
  const routing = useContext(RoutingStateContext);
  const navigation = useContext(NavigationStateContext);
  const studio = useContext(StudioStateContext);
  const crossing = useContext(CrossingEditorContext);

  if (legacy) {
    return legacy;
  }

  if (mapInstance && routing && navigation && studio) {
    return {
      ...mapInstance,
      ...routing,
      ...navigation,
      ...studio,
      ...(crossing ?? {}),
    };
  }

  throw new Error('useMapContext must be used within a MapProvider');
}
