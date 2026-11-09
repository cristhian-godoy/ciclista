import type * as maplibregl from 'maplibre-gl';
import { useCallback, useContext, useEffect, useMemo, useRef } from 'react';

import type { SelectionTool } from '../components/map/contexts/StudioStateContext';
import type {
  ContextMenuData,
  DebugSubMode,
  EditSubMode,
  MapContextType,
} from '../components/map/MapContext';
import {
  CrossingEditorContext,
  MapContext,
  MapInstanceContext,
  NavigationStateContext,
  RoutingStateContext,
  StudioStateContext,
} from '../components/map/MapContext';
import { coordToChunkId } from '../core/common/geo';
import { findEdgesWithinRadius, findNearestEdge } from '../core/common/geometry';
import type { Coordinate } from '../core/common/types';
import type { GraphNode, StreetGraph } from '../core/graph/types';
import type { Landmark } from '../core/landmarks/types';
import type { Place } from './usePlaces';

/**
 * Configuration options for useMapInteractionController hook.
 */
export interface UseMapInteractionControllerOptions {
  /** MapLibre map instance */
  map?: maplibregl.Map | null;
  /** Context menu state setter */
  setContextMenu?: React.Dispatch<React.SetStateAction<ContextMenuData>>;
  /** Dock expanded state setter */
  setDockExpanded?: (expanded: boolean) => void;
  /** Routing start coordinate */
  startCoord?: Coordinate | null;
  /** Routing destination coordinate */
  endCoord?: Coordinate | null;
  /** Active turn-by-turn navigation flag */
  isNavigating?: boolean;
  /** Street network graph */
  graph?: StreetGraph | null;
  /** Active application mode */
  appMode?: string;
  /** Active edit sub-mode ('paths' | 'signals') */
  editSubMode?: EditSubMode;
  /** Selected edge identifiers */
  selectedEdgeIds?: string[];
  /** State setter for selected edge identifiers */
  setSelectedEdgeIds?: React.Dispatch<React.SetStateAction<string[]>>;
  /** Active studio selection tool */
  selectionTool?: SelectionTool;
  /** Radius for brush tool in meters */
  brushRadius?: number;
  /** Registered places or landmarks list */
  places?: Array<Place | Landmark>;
  /** Callback to open create place modal */
  openCreatePlaceModal?: (coord?: Coordinate | null) => void;
  /** Callback to open edit place modal */
  openEditPlaceModal?: (place: Place | Landmark) => void;
  /** Callback to select a graph node */
  onNodeSelect?: (node: GraphNode | null) => void;
  /** Callback to initiate or update start pin drag */
  onStartDrag?: (coord: Coordinate | null) => void;
  /** Callback to initiate or update destination pin drag */
  onEndDrag?: (coord: Coordinate | null) => void;
  /** Setter for active managed cluster ID */
  setManagedClusterId?: (clusterId: string | null) => void;
  /** Setter for active managed node IDs */
  setManagedNodeIds?:
    React.Dispatch<React.SetStateAction<string[]>> | ((nodeIds: string[]) => void);
  /** Setter for active crossing ID */
  setActiveCrossingId?: (crossingId: string | null) => void;
  /** Pin placement mode active flag */
  isPlacingPlace?: boolean;
  /** Setter for pin placement mode */
  setIsPlacingPlace?: (isPlacing: boolean) => void;
  /** Intermediate route stop placement mode active flag */
  isPlacingStop?: boolean;
  /** Setter for intermediate route stop placement mode */
  setIsPlacingStop?: (isPlacing: boolean) => void;
  /** Index of intermediate route stop being repositioned */
  placingStopIndex?: number | null;
  /** Setter for intermediate route stop reposition index */
  setPlacingStopIndex?: (index: number | null) => void;
  /** Callback to append intermediate waypoint */
  onAddWaypoint?: (coord: Coordinate) => void;
  /** Callback to update intermediate waypoint */
  onUpdateWaypoint?: (index: number, coord: Coordinate) => void;
  /** Active debug sub-mode ('chunks' | 'route') */
  debugSubMode?: DebugSubMode;
  /** Selected debug chunk identifier */
  selectedDebugChunkId?: string | null;
  /** Setter for selected debug chunk identifier */
  setSelectedDebugChunkId?: (chunkId: string | null) => void;
}

/**
 * Return interface for useMapInteractionController hook.
 */
export interface UseMapInteractionControllerReturn {
  /** Map single click handler */
  handleClick: (e: maplibregl.MapMouseEvent) => void;
  /** Map right-click contextmenu handler */
  handleContextMenu: (e: maplibregl.MapMouseEvent) => void;
  /** Map drag start handler */
  handleDragStart: () => void;
  /** Map zoom start handler */
  handleZoomStart: () => void;
}

/**
 * Controller hook consolidating all map canvas user interactions:
 * single click, contextmenu, drag start, and zoom start.
 */
export function useMapInteractionController(
  options: UseMapInteractionControllerOptions = {},
): UseMapInteractionControllerReturn {
  const mapCtx = useContext(MapContext);
  const mapInstanceCtx = useContext(MapInstanceContext);
  const routingCtx = useContext(RoutingStateContext);
  const navigationCtx = useContext(NavigationStateContext);
  const studioCtx = useContext(StudioStateContext);
  const crossingCtx = useContext(CrossingEditorContext);

  const ctx: Partial<MapContextType> = useMemo(() => {
    if (mapCtx) return mapCtx;
    if (mapInstanceCtx && routingCtx && navigationCtx && studioCtx) {
      return {
        ...mapInstanceCtx,
        ...routingCtx,
        ...navigationCtx,
        ...studioCtx,
        ...(crossingCtx ?? {}),
      };
    }
    return {};
  }, [mapCtx, mapInstanceCtx, routingCtx, navigationCtx, studioCtx, crossingCtx]);

  const map = options.map !== undefined ? options.map : ctx.map;
  const setContextMenu = options.setContextMenu ?? ctx.setContextMenu;
  const setDockExpanded = options.setDockExpanded ?? ctx.setDockExpanded;
  const startCoord = options.startCoord !== undefined ? options.startCoord : ctx.startCoord;
  const endCoord = options.endCoord !== undefined ? options.endCoord : ctx.endCoord;
  const isNavigating = options.isNavigating !== undefined ? options.isNavigating : ctx.isNavigating;
  const graph = options.graph !== undefined ? options.graph : ctx.graph;
  const appMode = options.appMode !== undefined ? options.appMode : ctx.appMode;
  const selectedEdgeIds =
    options.selectedEdgeIds !== undefined ? options.selectedEdgeIds : ctx.selectedEdgeIds;
  const setSelectedEdgeIds = options.setSelectedEdgeIds ?? ctx.setSelectedEdgeIds;
  const selectionTool =
    options.selectionTool !== undefined ? options.selectionTool : ctx.selectionTool;
  const brushRadius = options.brushRadius !== undefined ? options.brushRadius : ctx.brushRadius;
  const places = useMemo(
    () => options.places ?? ctx.places ?? ctx.landmarks ?? [],
    [options.places, ctx.places, ctx.landmarks],
  );
  const openCreatePlaceModal =
    options.openCreatePlaceModal ?? ctx.openCreatePlaceModal ?? ctx.openCreateLandmarkModal;
  const openEditPlaceModal =
    options.openEditPlaceModal ?? ctx.openEditPlaceModal ?? ctx.openEditLandmarkModal;
  const onNodeSelect = options.onNodeSelect ?? ctx.onNodeSelect;
  const onStartDrag = options.onStartDrag ?? ctx.onStartDrag;
  const onEndDrag = options.onEndDrag ?? ctx.onEndDrag;
  const setManagedClusterId = options.setManagedClusterId ?? ctx.setManagedClusterId;
  const setManagedNodeIds = options.setManagedNodeIds ?? ctx.setManagedNodeIds;
  const setActiveCrossingId = options.setActiveCrossingId ?? ctx.setActiveCrossingId;
  const isPlacingPlace =
    options.isPlacingPlace !== undefined ? options.isPlacingPlace : ctx.isPlacingPlace;
  const setIsPlacingPlace = options.setIsPlacingPlace ?? ctx.setIsPlacingPlace;
  const isPlacingStop =
    options.isPlacingStop !== undefined ? options.isPlacingStop : ctx.isPlacingStop;
  const setIsPlacingStop = options.setIsPlacingStop ?? ctx.setIsPlacingStop;
  const placingStopIndex =
    options.placingStopIndex !== undefined ? options.placingStopIndex : ctx.placingStopIndex;
  const setPlacingStopIndex = options.setPlacingStopIndex ?? ctx.setPlacingStopIndex;
  const onAddWaypoint = options.onAddWaypoint ?? ctx.onAddWaypoint;
  const onUpdateWaypoint = options.onUpdateWaypoint ?? ctx.onUpdateWaypoint;
  const editSubMode =
    options.editSubMode !== undefined ? options.editSubMode : (ctx.editSubMode ?? 'paths');
  const debugSubMode =
    options.debugSubMode !== undefined ? options.debugSubMode : (ctx.debugSubMode ?? 'chunks');
  const selectedDebugChunkId =
    options.selectedDebugChunkId !== undefined
      ? options.selectedDebugChunkId
      : (ctx.selectedDebugChunkId ?? null);
  const setSelectedDebugChunkId = options.setSelectedDebugChunkId ?? ctx.setSelectedDebugChunkId;

  const mapRef = useRef(map);
  const startCoordRef = useRef(startCoord);
  const endCoordRef = useRef(endCoord);
  const isNavigatingRef = useRef(isNavigating);
  const appModeRef = useRef(appMode);
  const editSubModeRef = useRef<EditSubMode>(editSubMode);
  const debugSubModeRef = useRef<DebugSubMode>(debugSubMode);
  const selectedDebugChunkIdRef = useRef<string | null>(selectedDebugChunkId);
  const setSelectedDebugChunkIdRef = useRef(setSelectedDebugChunkId);
  const selectedEdgeIdsRef = useRef<string[] | undefined>(selectedEdgeIds);
  const setSelectedEdgeIdsRef = useRef<React.Dispatch<React.SetStateAction<string[]>> | undefined>(
    setSelectedEdgeIds,
  );
  const selectionToolRef = useRef<SelectionTool | undefined>(selectionTool);
  const brushRadiusRef = useRef<number | undefined>(brushRadius);
  const graphRef = useRef<StreetGraph | null | undefined>(graph);
  const placesRef = useRef<Landmark[]>(places);
  const openCreatePlaceModalRef = useRef(openCreatePlaceModal);
  const openEditPlaceModalRef = useRef(openEditPlaceModal);
  const onNodeSelectRef = useRef(onNodeSelect);
  const onStartDragRef = useRef(onStartDrag);
  const onEndDragRef = useRef(onEndDrag);
  const setManagedClusterIdRef = useRef(setManagedClusterId);
  const setManagedNodeIdsRef = useRef(setManagedNodeIds);
  const setActiveCrossingIdRef = useRef(setActiveCrossingId);
  const isPlacingPlaceRef = useRef<boolean | undefined>(isPlacingPlace);
  const setIsPlacingPlaceRef = useRef(setIsPlacingPlace);
  const isPlacingStopRef = useRef<boolean | undefined>(isPlacingStop);
  const setIsPlacingStopRef = useRef(setIsPlacingStop);
  const placingStopIndexRef = useRef<number | null | undefined>(placingStopIndex);
  const setPlacingStopIndexRef = useRef(setPlacingStopIndex);
  const onAddWaypointRef = useRef(onAddWaypoint);
  const onUpdateWaypointRef = useRef(onUpdateWaypoint);
  const setContextMenuRef = useRef<
    React.Dispatch<React.SetStateAction<ContextMenuData>> | undefined
  >(setContextMenu);
  const setDockExpandedRef = useRef(setDockExpanded);

  useEffect(() => {
    mapRef.current = map;
    startCoordRef.current = startCoord;
    endCoordRef.current = endCoord;
    isNavigatingRef.current = isNavigating;
    appModeRef.current = appMode;
    editSubModeRef.current = editSubMode;
    debugSubModeRef.current = debugSubMode;
    selectedDebugChunkIdRef.current = selectedDebugChunkId;
    setSelectedDebugChunkIdRef.current = setSelectedDebugChunkId;
    selectedEdgeIdsRef.current = selectedEdgeIds;
    setSelectedEdgeIdsRef.current = setSelectedEdgeIds;
    selectionToolRef.current = selectionTool;
    brushRadiusRef.current = brushRadius;
    graphRef.current = graph;
    placesRef.current = places;
    openCreatePlaceModalRef.current = openCreatePlaceModal;
    openEditPlaceModalRef.current = openEditPlaceModal;
    onNodeSelectRef.current = onNodeSelect;
    onStartDragRef.current = onStartDrag;
    onEndDragRef.current = onEndDrag;
    setManagedClusterIdRef.current = setManagedClusterId;
    setManagedNodeIdsRef.current = setManagedNodeIds;
    setActiveCrossingIdRef.current = setActiveCrossingId;
    isPlacingPlaceRef.current = isPlacingPlace;
    setIsPlacingPlaceRef.current = setIsPlacingPlace;
    isPlacingStopRef.current = isPlacingStop;
    setIsPlacingStopRef.current = setIsPlacingStop;
    placingStopIndexRef.current = placingStopIndex;
    setPlacingStopIndexRef.current = setPlacingStopIndex;
    onAddWaypointRef.current = onAddWaypoint;
    onUpdateWaypointRef.current = onUpdateWaypoint;
    setContextMenuRef.current = setContextMenu;
    setDockExpandedRef.current = setDockExpanded;
  }, [
    map,
    startCoord,
    endCoord,
    isNavigating,
    appMode,
    editSubMode,
    debugSubMode,
    selectedDebugChunkId,
    setSelectedDebugChunkId,
    selectedEdgeIds,
    setSelectedEdgeIds,
    selectionTool,
    brushRadius,
    graph,
    places,
    openCreatePlaceModal,
    openEditPlaceModal,
    onNodeSelect,
    onStartDrag,
    onEndDrag,
    setManagedClusterId,
    setManagedNodeIds,
    setActiveCrossingId,
    isPlacingPlace,
    setIsPlacingPlace,
    isPlacingStop,
    setIsPlacingStop,
    placingStopIndex,
    setPlacingStopIndex,
    onAddWaypoint,
    onUpdateWaypoint,
    setContextMenu,
    setDockExpanded,
  ]);

  // Dismiss context menu on outside window clicks
  useEffect(() => {
    const handleWindowClick = () => {
      setContextMenuRef.current?.((prev: ContextMenuData) =>
        prev.visible ? { ...prev, visible: false } : prev,
      );
    };
    window.addEventListener('click', handleWindowClick);
    return () => {
      window.removeEventListener('click', handleWindowClick);
    };
  }, []);

  const handleClick = useCallback((e: maplibregl.MapMouseEvent) => {
    setContextMenuRef.current?.((prev: ContextMenuData) =>
      prev.visible ? { ...prev, visible: false } : prev,
    );

    if (
      e.defaultPrevented ||
      (e.originalEvent && e.originalEvent.defaultPrevented) ||
      isNavigatingRef.current
    ) {
      return;
    }

    const currentMap = mapRef.current;
    if (!currentMap) return;

    // Handle pin placement mode strictly outside non-placement modes
    if (isPlacingPlaceRef.current) {
      const isInvalidMode =
        appModeRef.current === 'edit' ||
        appModeRef.current === 'events' ||
        (appModeRef.current as string) === 'studio';
      if (!isInvalidMode) {
        const clickedCoord = { lat: e.lngLat.lat, lng: e.lngLat.lng };
        setIsPlacingPlaceRef.current?.(false);
        openCreatePlaceModalRef.current?.(clickedCoord);
        return;
      }
      setIsPlacingPlaceRef.current?.(false);
    }

    // Handle route stop placement mode
    if (isPlacingStopRef.current) {
      const clickedCoord = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      const targetIndex = placingStopIndexRef.current;
      setIsPlacingStopRef.current?.(false);
      setPlacingStopIndexRef.current?.(null);

      if (typeof targetIndex === 'number' && targetIndex >= 0) {
        onUpdateWaypointRef.current?.(targetIndex, clickedCoord);
      } else {
        onAddWaypointRef.current?.(clickedCoord);
      }
      return;
    }

    if (appModeRef.current === 'debug') {
      onNodeSelectRef.current?.(null);
      if ((debugSubModeRef.current ?? 'chunks') === 'chunks') {
        const clickedChunkId = coordToChunkId(e.lngLat.lat, e.lngLat.lng);
        setSelectedDebugChunkIdRef.current?.(
          selectedDebugChunkIdRef.current === clickedChunkId ? null : clickedChunkId,
        );
      }
      return;
    }

    // Traffic layer queries are strictly scoped:
    // - In 'routing' mode: NEVER query traffic layers so clicks place pins without interference.
    // - In 'places' or 'events'/'studio' modes: clicks target domain features.
    // - In 'edit' mode:
    //   * When editSubMode === 'paths': query ONLY 'traffic-lights-cluster', setting activeCrossingId ONLY.
    //   * When editSubMode === 'signals': query 'traffic-lights-cluster' (expands cluster) and 'traffic-lights-unclustered'.
    // - When appMode is undefined: query both for generic/backwards compatibility.
    const isRouting = appModeRef.current === 'routing';
    const isEdit = appModeRef.current === 'edit';
    const currentSubMode = editSubModeRef.current;

    const shouldQueryTraffic =
      !isRouting &&
      appModeRef.current !== 'places' &&
      appModeRef.current !== 'landmarks' &&
      appModeRef.current !== 'events' &&
      (appModeRef.current as string) !== 'studio';

    let trafficFeatures: maplibregl.MapGeoJSONFeature[] = [];

    if (shouldQueryTraffic) {
      let trafficLayersToQuery: string[];

      if (isEdit && currentSubMode === 'paths') {
        trafficLayersToQuery = ['traffic-lights-cluster'];
      } else {
        const availableTrafficLayers: string[] = [];
        if (typeof currentMap.getLayer === 'function') {
          if (currentMap.getLayer('traffic-lights-unclustered'))
            availableTrafficLayers.push('traffic-lights-unclustered');
          if (currentMap.getLayer('traffic-lights-cluster'))
            availableTrafficLayers.push('traffic-lights-cluster');
        }
        trafficLayersToQuery =
          availableTrafficLayers.length > 0
            ? availableTrafficLayers
            : ['traffic-lights-unclustered', 'traffic-lights-cluster'];
      }

      const trafficBbox: [maplibregl.PointLike, maplibregl.PointLike] = [
        [e.point.x - 10, e.point.y - 10],
        [e.point.x + 10, e.point.y + 10],
      ];

      if (typeof currentMap.queryRenderedFeatures === 'function') {
        try {
          trafficFeatures = currentMap.queryRenderedFeatures(trafficBbox, {
            layers: trafficLayersToQuery,
          });
        } catch {
          trafficFeatures = [];
        }
      }
    }

    if (trafficFeatures.length > 0) {
      // Priority A: Crossing cluster feature (ALWAYS expand/zoom, NEVER select individual light)
      const clusterFeature = trafficFeatures.find(
        (f) =>
          f.layer?.id === 'traffic-lights-cluster' ||
          f.properties?.type === 'crossing' ||
          Boolean(f.properties?.crossingId && f.properties?.nodeIds),
      );

      if (clusterFeature) {
        const props = clusterFeature.properties ?? {};
        const coords = (clusterFeature.geometry as { coordinates?: number[] })?.coordinates;
        const lat = coords?.[1] ?? e.lngLat.lat;
        const lng = coords?.[0] ?? e.lngLat.lng;

        let nodeIds: string[] = [];
        if (props.nodeIds) {
          if (typeof props.nodeIds === 'string') {
            try {
              nodeIds = JSON.parse(props.nodeIds);
            } catch {
              nodeIds = [];
            }
          } else if (Array.isArray(props.nodeIds)) {
            nodeIds = props.nodeIds.map(String);
          }
        }

        const crossingId = props.crossingId ? String(props.crossingId) : null;

        if (crossingId) {
          if (isEdit && currentSubMode === 'paths') {
            setActiveCrossingIdRef.current?.(crossingId);
          } else {
            setManagedClusterIdRef.current?.(crossingId);
            setManagedNodeIdsRef.current?.(nodeIds);
            setActiveCrossingIdRef.current?.(crossingId);
          }
        }

        currentMap.easeTo?.({
          center: [lng, lat],
          zoom: 17.5,
        });
        return;
      }

      // Priority B: Individual unclustered signal feature (select light and open popup)
      if (!isEdit || currentSubMode === 'signals') {
        const signalFeature = trafficFeatures.find(
          (f) =>
            f.layer?.id === 'traffic-lights-unclustered' ||
            f.properties?.type === 'signal' ||
            (Boolean(f.properties?.id) && !f.properties?.crossingId) ||
            (f.id !== undefined && f.id !== null && !f.properties?.crossingId),
        );

        if (signalFeature) {
          const props = signalFeature.properties ?? {};
          const currentGraph = graphRef.current;
          const coords = (signalFeature.geometry as { coordinates?: number[] })?.coordinates;
          const lat = coords?.[1] ?? e.lngLat.lat;
          const lng = coords?.[0] ?? e.lngLat.lng;
          const nodeId = String(props.id ?? signalFeature.id ?? '');

          if (nodeId) {
            const graphEntry = currentGraph?.nodes.get(nodeId);

            let tags: Record<string, string> = {};
            if (props.tags) {
              if (typeof props.tags === 'string') {
                try {
                  tags = JSON.parse(props.tags);
                } catch {
                  tags = {};
                }
              } else if (typeof props.tags === 'object') {
                tags = props.tags as Record<string, string>;
              }
            }

            const targetNode: GraphNode = {
              ...(graphEntry?.node ?? {
                id: nodeId,
                lat,
                lng,
                tags:
                  graphEntry?.node.tags ??
                  (Object.keys(tags).length > 0 ? tags : { highway: 'traffic_signals' }),
              }),
            };

            onNodeSelectRef.current?.(targetNode);
            currentMap.easeTo?.({
              center: [lng, lat],
              duration: 400,
            });
            return;
          }
        }
      }
    }

    // Check for clicks on landmarks/places
    const availablePlaceLayers: string[] = [];
    if (typeof currentMap.getLayer === 'function') {
      if (currentMap.getLayer('landmarks-circle-layer'))
        availablePlaceLayers.push('landmarks-circle-layer');
    }
    const placeBbox: [maplibregl.PointLike, maplibregl.PointLike] = [
      [e.point.x - 8, e.point.y - 8],
      [e.point.x + 8, e.point.y + 8],
    ];
    let placeFeatures: maplibregl.MapGeoJSONFeature[] = [];
    if (availablePlaceLayers.length > 0 && typeof currentMap.queryRenderedFeatures === 'function') {
      try {
        placeFeatures = currentMap.queryRenderedFeatures(placeBbox, {
          layers: availablePlaceLayers,
        });
      } catch {
        placeFeatures = [];
      }
    }

    if (placeFeatures.length > 0 && placeFeatures[0]?.properties?.id) {
      const placeId = String(placeFeatures[0].properties.id);
      const targetPlace = placesRef.current?.find((lm: Landmark) => lm.id === placeId);
      if (targetPlace) {
        if (appModeRef.current === 'places' || (appModeRef.current as string) === 'landmarks') {
          openEditPlaceModalRef.current?.(targetPlace);
          return;
        }

        if (appModeRef.current === 'routing') {
          const coord: Coordinate = { lat: targetPlace.lat, lng: targetPlace.lng };
          if (e.originalEvent?.shiftKey) {
            onEndDragRef.current?.(coord);
          } else {
            onStartDragRef.current?.(coord);
          }
          return;
        }
      }
    }

    // Studio/Events mode edge selection
    if (appModeRef.current === 'events' || (appModeRef.current as string) === 'studio') {
      const currentGraph = graphRef.current;
      if (!currentGraph) return;

      if (selectionToolRef.current === 'click') {
        const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
          [e.point.x - 6, e.point.y - 6],
          [e.point.x + 6, e.point.y + 6],
        ];
        let edgeId: string | null = null;
        const features =
          typeof currentMap?.queryRenderedFeatures === 'function'
            ? currentMap.queryRenderedFeatures(bbox, { layers: ['network-streets-layer'] })
            : [];

        if (
          features.length > 0 &&
          features[0]?.properties &&
          typeof features[0].properties.edgeId === 'string'
        ) {
          edgeId = features[0].properties.edgeId;
        } else {
          const nearest = findNearestEdge(currentGraph, { lat: e.lngLat.lat, lng: e.lngLat.lng });
          if (nearest && nearest.distance <= 30) {
            edgeId = `${nearest.uId}->${nearest.vId}`;
          }
        }

        if (edgeId) {
          const targetId = edgeId;
          setSelectedEdgeIdsRef.current?.((prev: string[]) =>
            prev.includes(targetId)
              ? prev.filter((id: string) => id !== targetId)
              : [...prev, targetId],
          );
        }
      } else if (selectionToolRef.current === 'brush') {
        const coord = { lat: e.lngLat.lat, lng: e.lngLat.lng };
        const matching = findEdgesWithinRadius(currentGraph, coord, brushRadiusRef.current ?? 20);
        if (matching.length > 0) {
          setSelectedEdgeIdsRef.current?.((prev: string[]) => {
            const set = new Set(prev);
            for (const id of matching) set.add(id);
            return Array.from(set);
          });
        }
      }
      return;
    }

    if (appModeRef.current === 'places' || (appModeRef.current as string) === 'landmarks') {
      onNodeSelectRef.current?.(null);
      return;
    }

    onNodeSelectRef.current?.(null);

    // Placing start/end pins strictly restricted to appMode === 'routing'
    if (appModeRef.current !== 'routing') {
      return;
    }

    const sCoord = startCoordRef.current;
    const eCoord = endCoordRef.current;
    const clickedCoord = { lat: e.lngLat.lat, lng: e.lngLat.lng };

    // Once both pins are placed, do not re-add pins on click
    if (sCoord && eCoord) {
      return;
    }

    if (!sCoord) {
      onStartDragRef.current?.(clickedCoord);
      onEndDragRef.current?.(null);
    } else {
      onEndDragRef.current?.(clickedCoord);
    }
  }, []);

  const handleContextMenu = useCallback((e: maplibregl.MapMouseEvent) => {
    const currentMap = mapRef.current;
    if (!currentMap) return;

    if (appModeRef.current === 'debug') {
      const chunkId = coordToChunkId(e.lngLat.lat, e.lngLat.lng);
      setContextMenuRef.current?.({
        visible: true,
        x: e.point.x,
        y: e.point.y,
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
        crossingId: null,
        nodeIds: null,
        placeId: null,
        chunkId,
      });
      return;
    }

    if (appModeRef.current === 'events' || (appModeRef.current as string) === 'studio') {
      const currentGraph = graphRef.current;
      const coord = { lat: e.lngLat.lat, lng: e.lngLat.lng };

      if (selectionToolRef.current === 'brush') {
        e.originalEvent?.preventDefault?.();
        if (currentGraph) {
          const matching = findEdgesWithinRadius(currentGraph, coord, brushRadiusRef.current ?? 20);
          if (matching.length > 0) {
            const toRemove = new Set(matching);
            setSelectedEdgeIdsRef.current?.((prev: string[]) =>
              prev.filter((id: string) => !toRemove.has(id)),
            );
          }
        }
        return;
      }

      if (selectionToolRef.current === 'click') {
        let edgeId: string | undefined = undefined;

        const edgeFeatures =
          typeof currentMap.queryRenderedFeatures === 'function'
            ? currentMap.queryRenderedFeatures(e.point, {
                layers: ['street-graph-layer-interactive', 'street-graph-layer'],
              })
            : [];

        if (
          edgeFeatures.length > 0 &&
          edgeFeatures[0]?.properties &&
          edgeFeatures[0].properties.edgeId
        ) {
          edgeId = edgeFeatures[0].properties.edgeId;
        } else if (currentGraph) {
          const nearest = findNearestEdge(currentGraph, coord);
          if (nearest && nearest.distance <= 30) {
            edgeId = `${nearest.uId}->${nearest.vId}`;
          }
        }

        if (edgeId) {
          e.originalEvent?.preventDefault?.();
          const targetId = edgeId;
          setSelectedEdgeIdsRef.current?.((prev: string[]) =>
            prev.filter((id: string) => id !== targetId),
          );
          return;
        }
      }

      // In events/studio mode, suppress opening the context menu when clicking empty map space
      e.originalEvent?.preventDefault?.();
      return;
    }

    const availableLandmarkLayers: string[] = [];
    if (currentMap.getLayer('landmarks-circle-layer'))
      availableLandmarkLayers.push('landmarks-circle-layer');
    if (currentMap.getLayer('landmarks-label-layer'))
      availableLandmarkLayers.push('landmarks-label-layer');

    const landmarkFeatures =
      availableLandmarkLayers.length > 0 && typeof currentMap.queryRenderedFeatures === 'function'
        ? currentMap.queryRenderedFeatures(
            [
              [e.point.x - 8, e.point.y - 8],
              [e.point.x + 8, e.point.y + 8],
            ],
            { layers: availableLandmarkLayers },
          )
        : [];

    let clickedPlaceId: string | null = null;
    if (landmarkFeatures.length > 0 && landmarkFeatures[0]?.properties?.id) {
      const landmarkId = String(landmarkFeatures[0].properties.id);
      const targetPlace = placesRef.current?.find((lm: Landmark) => lm.id === landmarkId);
      if (targetPlace) {
        clickedPlaceId = targetPlace.id;
      }
    }

    const canQueryCrossing = !appModeRef.current || appModeRef.current === 'edit';
    const features = canQueryCrossing
      ? currentMap.queryRenderedFeatures(e.point, {
          layers: ['traffic-lights-cluster'],
        })
      : [];
    const firstFeature = features[0];
    const crossingId = firstFeature?.properties
      ? (firstFeature.properties.crossingId as string)
      : null;
    const nodeIds = firstFeature?.properties ? (firstFeature.properties.nodeIds as string) : null;

    // In edit mode (crossing editor), only open context menu when a crossing cluster was clicked
    if (appModeRef.current === 'edit' && !crossingId) {
      e.originalEvent?.preventDefault?.();
      return;
    }

    setContextMenuRef.current?.({
      visible: true,
      x: e.point.x,
      y: e.point.y,
      lng: e.lngLat.lng,
      lat: e.lngLat.lat,
      crossingId,
      nodeIds,
      placeId: clickedPlaceId,
    });
  }, []);

  const handleDragStart = useCallback(() => {
    setContextMenuRef.current?.((prev: ContextMenuData) =>
      prev.visible ? { ...prev, visible: false } : prev,
    );
    setDockExpandedRef.current?.(false);
  }, []);

  const handleZoomStart = useCallback(() => {
    setContextMenuRef.current?.((prev: ContextMenuData) =>
      prev.visible ? { ...prev, visible: false } : prev,
    );
    setDockExpandedRef.current?.(false);
  }, []);

  return {
    handleClick,
    handleContextMenu,
    handleDragStart,
    handleZoomStart,
  };
}
