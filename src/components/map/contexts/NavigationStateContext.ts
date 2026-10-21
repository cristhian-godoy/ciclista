import { createContext, useContext } from 'react';

import type { NavigationState, RideStats } from '../../../core/navigation/types';

/**
 * Domain context type defining turn-by-turn navigation telemetry and status.
 */
export interface NavigationStateContextType {
  navigationState: NavigationState;
  isNavigating: boolean;
  rideStats: RideStats | null;
  onStopNavigation: () => void;
}

/**
 * Context instance for navigation telemetry and active trip controls.
 */
export const NavigationStateContext = createContext<NavigationStateContextType | null>(null);

/**
 * React hook to consume the nearest NavigationStateContext.
 *
 * @returns Active NavigationStateContextType value.
 * @throws Error when consumed outside of a NavigationStateContext provider.
 */
export function useNavigationStateContext(): NavigationStateContextType {
  const context = useContext(NavigationStateContext);
  if (!context) {
    throw new Error(
      'useNavigationStateContext must be used within a NavigationStateContext.Provider or MapProvider',
    );
  }
  return context;
}
