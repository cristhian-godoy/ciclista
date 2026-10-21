import type React from 'react';
import { createContext, useContext } from 'react';

import type { Coordinate } from '../../../core/common/types';
import type { MapEvent } from '../../../core/events/types';
import type {
  CreateLandmarkInput,
  Landmark,
  UpdateLandmarkInput,
} from '../../../core/landmarks/types';

/**
 * State representing place modal visibility, entity data, and spatial coordinates.
 */
export interface PlaceModalState {
  isOpen: boolean;
  landmark: Landmark | null;
  initialCoordinates: Coordinate | null;
}

/**
 * Selection tool mode for graph edge selection in events/studio mode.
 */
export type SelectionTool = 'click' | 'brush';

/**
 * Backward compatibility alias for LandmarkModalState.
 */
export type LandmarkModalState = PlaceModalState;

/**
 * Domain context type defining places management, studio event blockages, and road selection tools.
 */
export interface StudioStateContextType {
  places: Landmark[];
  setPlaces: React.Dispatch<React.SetStateAction<Landmark[]>>;
  /**
   * Alias for backward compatibility.
   * @deprecated Use `places` instead.
   */
  landmarks?: Landmark[];
  /**
   * Alias for backward compatibility.
   * @deprecated Use `setPlaces` instead.
   */
  setLandmarks?: React.Dispatch<React.SetStateAction<Landmark[]>>;

  selectedEdgeIds: string[];
  setSelectedEdgeIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectionTool: 'click' | 'brush';
  setSelectionTool: (tool: 'click' | 'brush') => void;
  brushRadius: number;
  setBrushRadius: (radius: number) => void;
  events: MapEvent[];
  setEvents: React.Dispatch<React.SetStateAction<MapEvent[]>>;
  onClearSelection: () => void;

  // Place modal and operations
  placeModal?: PlaceModalState;
  setPlaceModal?: React.Dispatch<React.SetStateAction<PlaceModalState>>;
  /**
   * Alias for backward compatibility.
   * @deprecated Use `placeModal` instead.
   */
  landmarkModal?: LandmarkModalState;
  /**
   * Alias for backward compatibility.
   * @deprecated Use `setPlaceModal` instead.
   */
  setLandmarkModal?: React.Dispatch<React.SetStateAction<LandmarkModalState>>;
  openCreatePlace?: (coord?: Coordinate | null) => void;
  openCreatePlaceModal?: (coord?: Coordinate | null) => void;
  /**
   * Alias for backward compatibility.
   * @deprecated Use `openCreatePlaceModal` instead.
   */
  openCreateLandmarkModal?: (coord?: Coordinate | null) => void;
  openEditPlaceModal?: (place: Landmark) => void;
  /**
   * Alias for backward compatibility.
   * @deprecated Use `openEditPlaceModal` instead.
   */
  openEditLandmarkModal?: (landmark: Landmark) => void;
  closePlaceModal?: () => void;
  /**
   * Alias for backward compatibility.
   * @deprecated Use `closePlaceModal` instead.
   */
  closeLandmarkModal?: () => void;
  onCreatePlace?: (input: CreateLandmarkInput) => void;
  /**
   * Alias for backward compatibility.
   * @deprecated Use `onCreatePlace` instead.
   */
  onCreateLandmark?: (input: CreateLandmarkInput) => void;
  onUpdatePlace?: (id: string, updates: UpdateLandmarkInput) => void;
  /**
   * Alias for backward compatibility.
   * @deprecated Use `onUpdatePlace` instead.
   */
  onUpdateLandmark?: (id: string, updates: UpdateLandmarkInput) => void;
  onDeletePlace?: (id: string) => void;
  /**
   * Alias for backward compatibility.
   * @deprecated Use `onDeletePlace` instead.
   */
  onDeleteLandmark?: (id: string) => void;

  // Place pin placement mode
  isPlacingPlace?: boolean;
  setIsPlacingPlace?: React.Dispatch<React.SetStateAction<boolean>> | ((val: boolean) => void);
}

/**
 * Context instance for places, events, and road edge selection tools.
 */
export const StudioStateContext = createContext<StudioStateContextType | null>(null);

/**
 * React hook to consume the nearest StudioStateContext.
 *
 * @returns Active StudioStateContextType value.
 * @throws Error when consumed outside of a StudioStateContext provider.
 */
export function useStudioStateContext(): StudioStateContextType {
  const context = useContext(StudioStateContext);
  if (!context) {
    throw new Error(
      'useStudioStateContext must be used within a StudioStateContext.Provider or MapProvider',
    );
  }
  return context;
}
