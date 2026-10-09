import { MapPin } from 'lucide-react';
import type maplibregl from 'maplibre-gl';
import React, { useEffect, useMemo, useRef } from 'react';

import { haversineDistance } from '../core/common/geo';
import { findEdgesWithinRadius, findNearestEdge } from '../core/common/geometry';
import type { GraphNode } from '../core/graph/types';
import { ArrivalPanel } from './ArrivalPanel';
import { Toast } from './common/Toast';
import { BBoxBoundaryLayer } from './map/BBoxBoundaryLayer';
import { BlockedEdgesLayer } from './map/BlockedEdgesLayer';
import { BrushCircleLayer } from './map/BrushCircleLayer';
import { InspectorLayer } from './map/InspectorLayer';
import { type PlaceModalState, useMapContext } from './map/MapContext';
import { MapContextMenu } from './map/MapContextMenu';
import { MapLayerDock } from './map/MapLayerDock';
import { NavigationLayer } from './map/NavigationLayer';
import { NodePopup } from './map/NodePopup';
import { PlacesLayer } from './map/PlacesLayer';
import { RouteVariantsLayer } from './map/RouteVariantsLayer';
import { SelectedEdgesLayer } from './map/SelectedEdgesLayer';
import { SelectionToolsDock } from './map/SelectionToolsDock';
import { StartEndMarkers } from './map/StartEndMarkers';
import { StreetGraphLayer } from './map/StreetGraphLayer';
import { useMapInstance } from './map/useMapInstance';
import { NavigationHUD } from './NavigationHUD';
import { PlaceModal } from './PlaceModal';

interface MapViewProps {
  onMapBoundsChange?: (bbox: [number, number, number, number], zoom: number) => void;
  tileless?: boolean;
}

const MapViewContent: React.FC<{
  onMapBoundsChange?: (bbox: [number, number, number, number], zoom: number) => void;
  tileless?: boolean;
}> = ({ onMapBoundsChange, tileless = false }) => {
  const {
    map,
    setMap,
    mapReady,
    setMapReady,
    theme,
    setContextMenu,
    managedClusterId,
    setManagedClusterId,
    managedNodeIds,
    setManagedNodeIds,
    onNodeSelect,
    onStartDrag,
    onEndDrag,
    selectedNode,
    setDockExpanded,
    startCoord,
    endCoord,
    isNavigating,
    graph,
    appMode,
    selectedEdgeIds,
    setSelectedEdgeIds,
    selectionTool,
    brushRadius,
    landmarks,
    places,
    openCreateLandmarkModal,
    openCreatePlaceModal,
    openEditLandmarkModal,
    openEditPlaceModal,
    landmarkModal,
    placeModal,
    closeLandmarkModal,
    closePlaceModal,
    onCreateLandmark,
    onCreatePlace,
    onUpdateLandmark,
    onUpdatePlace,
    isPlacingPlace,
    setIsPlacingPlace,
  } = useMapContext();

  const currentPlaces = useMemo(() => places ?? landmarks ?? [], [places, landmarks]);
  const openCreatePlace = openCreatePlaceModal ?? openCreateLandmarkModal;
  const openEditPlace = openEditPlaceModal ?? openEditLandmarkModal;
  const closePlace = closePlaceModal ?? closeLandmarkModal;
  const handleCreatePlace = onCreatePlace ?? onCreateLandmark;
  const handleUpdatePlace = onUpdatePlace ?? onUpdateLandmark;

  const startCoordRef = useRef(startCoord);
  const endCoordRef = useRef(endCoord);
  const appModeRef = useRef(appMode);
  const selectedEdgeIdsRef = useRef(selectedEdgeIds);
  const selectionToolRef = useRef(selectionTool);
  const brushRadiusRef = useRef(brushRadius);
  const graphRef = useRef(graph);
  const placesRef = useRef(currentPlaces);
  const openCreatePlaceModalRef = useRef(openCreatePlace);
  const openEditPlaceModalRef = useRef(openEditPlace);
  const onNodeSelectRef = useRef(onNodeSelect);
  const setManagedClusterIdRef = useRef(setManagedClusterId);
  const setManagedNodeIdsRef = useRef(setManagedNodeIds);
  const onStartDragRef = useRef(onStartDrag);
  const onEndDragRef = useRef(onEndDrag);
  const isPlacingPlaceRef = useRef(isPlacingPlace);
  const setIsPlacingPlaceRef = useRef(setIsPlacingPlace);

  // Keep refs synchronized for event handlers
  useEffect(() => {
    startCoordRef.current = startCoord;
    endCoordRef.current = endCoord;
    appModeRef.current = appMode;
    selectedEdgeIdsRef.current = selectedEdgeIds;
    selectionToolRef.current = selectionTool;
    brushRadiusRef.current = brushRadius;
    graphRef.current = graph;
    placesRef.current = currentPlaces;
    openCreatePlaceModalRef.current = openCreatePlace;
    openEditPlaceModalRef.current = openEditPlace;
    onNodeSelectRef.current = onNodeSelect;
    setManagedClusterIdRef.current = setManagedClusterId;
    setManagedNodeIdsRef.current = setManagedNodeIds;
    onStartDragRef.current = onStartDrag;
    onEndDragRef.current = onEndDrag;
    isPlacingPlaceRef.current = isPlacingPlace;
    setIsPlacingPlaceRef.current = setIsPlacingPlace;
  }, [
    startCoord,
    endCoord,
    appMode,
    selectedEdgeIds,
    selectionTool,
    brushRadius,
    graph,
    currentPlaces,
    openCreatePlace,
    openEditPlace,
    onNodeSelect,
    setManagedClusterId,
    setManagedNodeIds,
    onStartDrag,
    onEndDrag,
    isPlacingPlace,
    setIsPlacingPlace,
  ]);

  // Set map canvas cursor to crosshair during pin placement mode
  useEffect(() => {
    if (!map) return;
    const canvas = map.getCanvas?.();
    if (!canvas) return;
    if (isPlacingPlace) {
      canvas.style.cursor = 'crosshair';
    } else {
      canvas.style.cursor = '';
    }
    return () => {
      if (canvas) {
        canvas.style.cursor = '';
      }
    };
  }, [map, isPlacingPlace]);

  // Handle Escape key to cancel pin placement mode
  useEffect(() => {
    if (!isPlacingPlace) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPlacingPlace?.(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlacingPlace, setIsPlacingPlace]);

  // Window click listener to close context menu
  useEffect(() => {
    const handleWindowClick = () => {
      setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    };
    window.addEventListener('click', handleWindowClick);
    return () => {
      window.removeEventListener('click', handleWindowClick);
    };
  }, [setContextMenu]);

  // Auto-collapse expanded crossing cluster when zoomed out below threshold or panned far away
  useEffect(() => {
    if (!map || !managedClusterId || managedNodeIds.length === 0) return;

    let clusterLat = 0;
    let clusterLng = 0;
    let foundCount = 0;

    const currentGraph = graphRef.current;
    if (currentGraph) {
      for (const id of managedNodeIds) {
        const nodeEntry = currentGraph.nodes.get(id);
        if (nodeEntry) {
          clusterLat += nodeEntry.node.lat;
          clusterLng += nodeEntry.node.lng;
          foundCount++;
        }
      }
    }

    if (foundCount > 0) {
      clusterLat /= foundCount;
      clusterLng /= foundCount;
    }

    const checkClusterProximity = () => {
      // Check zoom threshold (below 15.5)
      if (typeof map.getZoom === 'function') {
        const currentZoom = map.getZoom();
        if (currentZoom < 15.5) {
          setManagedClusterIdRef.current?.(null);
          setManagedNodeIdsRef.current?.([]);
          return;
        }
      }

      // Check distance threshold if cluster coordinates are resolved
      if (foundCount > 0 && typeof map.getCenter === 'function') {
        const center = map.getCenter();
        if (center && typeof center.lat === 'number' && typeof center.lng === 'number') {
          const dist = haversineDistance(center.lat, center.lng, clusterLat, clusterLng);
          // If camera center has panned farther than 450 meters away from the crossing
          if (dist > 450) {
            setManagedClusterIdRef.current?.(null);
            setManagedNodeIdsRef.current?.([]);
          }
        }
      }
    };

    if (typeof map.on === 'function') {
      map.on('moveend', checkClusterProximity);
    }

    return () => {
      if (typeof map.off === 'function') {
        map.off('moveend', checkClusterProximity);
      }
    };
  }, [map, managedClusterId, managedNodeIds, graph]);

  // Studio mode drag gestures: left-click drag for Radius Brush, right-click drag for Deselection
  useEffect(() => {
    if (!map || appMode !== 'studio') return;

    let isLeftDown = false;
    let isRightDown = false;

    const handleBrushAt = (coord: { lat: number; lng: number }) => {
      const currentGraph = graphRef.current;
      if (!currentGraph) return;
      const currentRadius = brushRadiusRef.current;
      const matching = findEdgesWithinRadius(currentGraph, coord, currentRadius);
      if (matching.length > 0) {
        setSelectedEdgeIds((prev) => {
          const set = new Set(prev);
          let changed = false;
          for (const edgeId of matching) {
            if (!set.has(edgeId)) {
              set.add(edgeId);
              changed = true;
            }
          }
          return changed ? Array.from(set) : prev;
        });
      }
    };

    const handleDeselectAt = (coord: { lat: number; lng: number }) => {
      const currentGraph = graphRef.current;
      if (!currentGraph || selectionToolRef.current !== 'brush') return;
      const currentRadius = brushRadiusRef.current;
      const matching = findEdgesWithinRadius(currentGraph, coord, currentRadius);
      if (matching.length > 0) {
        const toRemove = new Set(matching);
        setSelectedEdgeIds((prev) => prev.filter((id) => !toRemove.has(id)));
      }
    };

    const onMouseDown = (e: maplibregl.MapMouseEvent) => {
      if (e.originalEvent.button === 0 && selectionToolRef.current === 'brush') {
        isLeftDown = true;
        map.dragPan?.disable?.();
        handleBrushAt({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      } else if (e.originalEvent.button === 2 && selectionToolRef.current === 'brush') {
        isRightDown = true;
        e.originalEvent.preventDefault();
        map.dragPan?.disable?.();
        map.dragRotate?.disable?.();
        handleDeselectAt({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    };

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (isLeftDown && selectionToolRef.current === 'brush') {
        handleBrushAt({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      } else if (isRightDown && selectionToolRef.current === 'brush') {
        handleDeselectAt({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    };

    const onMouseUp = () => {
      if (isLeftDown) {
        isLeftDown = false;
        map.dragPan?.enable?.();
      }
      if (isRightDown) {
        isRightDown = false;
        map.dragPan?.enable?.();
        map.dragRotate?.enable?.();
      }
    };

    map.on('mousedown', onMouseDown);
    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      map.off('mousedown', onMouseDown);
      map.off('mousemove', onMouseMove);
      map.off('mouseup', onMouseUp);
      window.removeEventListener('mouseup', onMouseUp);
      map.dragPan?.enable?.();
      map.dragRotate?.enable?.();
    };
  }, [map, appMode, setSelectedEdgeIds]);

  // Handle right click on map (context menu trigger or studio deselection)
  const handleContextMenu = (e: maplibregl.MapMouseEvent) => {
    if (!map) return;

    if (appModeRef.current === 'studio') {
      const currentGraph = graphRef.current;
      const coord = { lat: e.lngLat.lat, lng: e.lngLat.lng };

      if (selectionToolRef.current === 'brush') {
        e.originalEvent?.preventDefault?.();
        if (currentGraph) {
          const matching = findEdgesWithinRadius(currentGraph, coord, brushRadiusRef.current);
          if (matching.length > 0) {
            const toRemove = new Set(matching);
            setSelectedEdgeIds((prev) => prev.filter((id) => !toRemove.has(id)));
          }
        }
        return;
      }

      if (selectionToolRef.current === 'click') {
        let edgeId: string | undefined = undefined;

        const edgeFeatures =
          typeof map.queryRenderedFeatures === 'function'
            ? map.queryRenderedFeatures(e.point, {
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
          setSelectedEdgeIds((prev) => prev.filter((id) => id !== targetId));
          return;
        }
      }
    }

    const availableLandmarkLayers: string[] = [];
    if (map.getLayer('landmarks-circle-layer'))
      availableLandmarkLayers.push('landmarks-circle-layer');
    if (map.getLayer('landmarks-label-layer'))
      availableLandmarkLayers.push('landmarks-label-layer');

    const landmarkFeatures =
      availableLandmarkLayers.length > 0 && typeof map.queryRenderedFeatures === 'function'
        ? map.queryRenderedFeatures(
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
      const targetPlace = placesRef.current?.find((lm) => lm.id === landmarkId);
      if (targetPlace) {
        clickedPlaceId = targetPlace.id;
      }
    }

    const features = map.queryRenderedFeatures(e.point, {
      layers: ['traffic-lights-cluster'],
    });
    const isCrossing = features.length > 0;
    const crossingId =
      isCrossing && features[0].properties ? (features[0].properties.crossingId as string) : null;
    const nodeIds =
      isCrossing && features[0].properties ? (features[0].properties.nodeIds as string) : null;

    setContextMenu({
      visible: true,
      x: e.point.x,
      y: e.point.y,
      lng: e.lngLat.lng,
      lat: e.lngLat.lat,
      crossingId,
      nodeIds,
      placeId: clickedPlaceId,
    });
  };

  // Handle left click on map (deselect / dropping markers / studio click selection / traffic light selection)
  const handleClick = (e: maplibregl.MapMouseEvent) => {
    setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));

    if (
      e.defaultPrevented ||
      (e.originalEvent && e.originalEvent.defaultPrevented) ||
      isNavigating
    ) {
      return;
    }

    if (!map) return;

    if (isPlacingPlaceRef.current) {
      const clickedCoord = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      setIsPlacingPlaceRef.current?.(false);
      openCreatePlaceModalRef.current?.(clickedCoord);
      return;
    }

    // Prioritize traffic lights and crossing clusters across all modes
    const availableTrafficLayers: string[] = [];
    if (typeof map.getLayer === 'function') {
      if (map.getLayer('traffic-lights-unclustered'))
        availableTrafficLayers.push('traffic-lights-unclustered');
      if (map.getLayer('traffic-lights-cluster'))
        availableTrafficLayers.push('traffic-lights-cluster');
    }
    const trafficLayersToQuery =
      availableTrafficLayers.length > 0
        ? availableTrafficLayers
        : ['traffic-lights-unclustered', 'traffic-lights-cluster'];

    const trafficBbox: [maplibregl.PointLike, maplibregl.PointLike] = [
      [e.point.x - 10, e.point.y - 10],
      [e.point.x + 10, e.point.y + 10],
    ];

    let trafficFeatures: maplibregl.MapGeoJSONFeature[] = [];
    if (typeof map.queryRenderedFeatures === 'function') {
      try {
        trafficFeatures = map.queryRenderedFeatures(trafficBbox, {
          layers: trafficLayersToQuery,
        });
      } catch {
        trafficFeatures = [];
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
        const lat = coords ? coords[1] : e.lngLat.lat;
        const lng = coords ? coords[0] : e.lngLat.lng;

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
          setManagedClusterIdRef.current?.(crossingId);
          setManagedNodeIdsRef.current?.(nodeIds);
        }

        map.easeTo?.({
          center: [lng, lat],
          zoom: 17.5,
        });
        return;
      }

      // Priority B: Individual unclustered signal feature (select light and open popup)
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
        const lat = coords ? coords[1] : e.lngLat.lat;
        const lng = coords ? coords[0] : e.lngLat.lng;
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
          map.easeTo?.({
            center: [lng, lat],
            duration: 400,
          });
          return;
        }
      }
    }

    if (appModeRef.current === 'studio') {
      const currentGraph = graphRef.current;
      if (!currentGraph) return;

      if (selectionToolRef.current === 'click') {
        const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
          [e.point.x - 6, e.point.y - 6],
          [e.point.x + 6, e.point.y + 6],
        ];
        let edgeId: string | null = null;
        const features =
          typeof map?.queryRenderedFeatures === 'function'
            ? map.queryRenderedFeatures(bbox, { layers: ['network-streets-layer'] })
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
          setSelectedEdgeIds((prev) =>
            prev.includes(targetId) ? prev.filter((id) => id !== targetId) : [...prev, targetId],
          );
        }
      } else if (selectionToolRef.current === 'brush') {
        const coord = { lat: e.lngLat.lat, lng: e.lngLat.lng };
        const matching = findEdgesWithinRadius(currentGraph, coord, brushRadiusRef.current);
        if (matching.length > 0) {
          setSelectedEdgeIds((prev) => {
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

    const sCoord = startCoordRef.current;
    const eCoord = endCoordRef.current;
    const clickedCoord = { lat: e.lngLat.lat, lng: e.lngLat.lng };

    // Once both pins are placed, do not re-add pins on click.
    // They must be dragged or set via context menu instead.
    if (sCoord && eCoord) {
      return;
    }

    if (!sCoord) {
      onStartDragRef.current?.(clickedCoord);
      onEndDragRef.current?.(null);
    } else {
      onEndDragRef.current?.(clickedCoord);
    }
  };

  const handleDragStart = () => {
    setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    setDockExpanded(false);
  };

  const handleZoomStart = () => {
    setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    setDockExpanded(false);
  };

  // Initialize and retrieve map instance via custom hook
  const {
    map: mapInstance,
    mapContainerRef,
    mapReady: mapInstanceReady,
  } = useMapInstance({
    theme,
    tileless,
    onMapBoundsChange,
    onContextMenu: handleContextMenu,
    onClick: handleClick,
    onDragStart: handleDragStart,
    onZoomStart: handleZoomStart,
  });

  // Synchronize internal map state with context
  useEffect(() => {
    setMap(mapInstance);
    setMapReady(mapInstanceReady);
  }, [mapInstance, mapInstanceReady, setMap, setMapReady]);

  return (
    <div className={`map-wrapper ${isPlacingPlace ? 'map-pin-placement-mode' : ''}`.trim()}>
      <div ref={mapContainerRef} className="map-container" />

      {map && mapReady && (
        <>
          <StreetGraphLayer />
          <SelectedEdgesLayer />
          <BrushCircleLayer />
          <BlockedEdgesLayer />
          <PlacesLayer />
          <RouteVariantsLayer />
          <BBoxBoundaryLayer />
          <StartEndMarkers />
          <NavigationLayer />
          <InspectorLayer />
          <NodePopup key={selectedNode?.id} />
          <MapContextMenu />
          <MapLayerDock />
          <SelectionToolsDock />
        </>
      )}

      <NavigationHUD />
      <ArrivalPanel />
      {(() => {
        const activeModal: PlaceModalState = placeModal ??
          landmarkModal ?? {
            isOpen: false,
            landmark: null,
            initialCoordinates: null,
          };
        return (
          <PlaceModal
            isOpen={activeModal.isOpen}
            place={activeModal.landmark}
            initialCoordinates={activeModal.initialCoordinates}
            onClose={closePlace ?? (() => {})}
            onCreatePlace={handleCreatePlace}
            onUpdatePlace={handleUpdatePlace}
            currentMapCenter={
              map && typeof map.getCenter === 'function'
                ? { lat: map.getCenter().lat, lng: map.getCenter().lng }
                : (startCoord ?? endCoord ?? null)
            }
            startCoord={startCoord}
            endCoord={endCoord}
          />
        );
      })()}

      {/* Persistent toast notifying user to pick a location on the map */}
      {isPlacingPlace && (
        <Toast
          message="Click on the map to set place location"
          icon={<MapPin size={16} />}
          position="bottom-right"
          persistent
          onClose={() => setIsPlacingPlace?.(false)}
        />
      )}
    </div>
  );
};

/**
 * Map container component that initializes the MapLibre GL instance,
 * handles map events, and mounts interactive layer overlays.
 */
export const MapView: React.FC<MapViewProps> = (props) => {
  return <MapViewContent onMapBoundsChange={props.onMapBoundsChange} tileless={props.tileless} />;
};
