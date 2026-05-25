import { MapPin, ZoomIn } from 'lucide-react';
import React, { useEffect, useRef } from 'react';

import { useMapContext } from './MapContext';

/**
 *
 */
export const MapContextMenu: React.FC = () => {
  const {
    map,
    contextMenu,
    setContextMenu,
    setManagedClusterId,
    setManagedNodeIds,
    onStartDrag,
    onEndDrag,
  } = useMapContext();

  const onStartDragRef = useRef(onStartDrag);
  const onEndDragRef = useRef(onEndDrag);
  const setManagedClusterIdRef = useRef(setManagedClusterId);
  const setManagedNodeIdsRef = useRef(setManagedNodeIds);

  useEffect(() => {
    onStartDragRef.current = onStartDrag;
  }, [onStartDrag]);

  useEffect(() => {
    onEndDragRef.current = onEndDrag;
  }, [onEndDrag]);

  useEffect(() => {
    setManagedClusterIdRef.current = setManagedClusterId;
  }, [setManagedClusterId]);

  useEffect(() => {
    setManagedNodeIdsRef.current = setManagedNodeIds;
  }, [setManagedNodeIds]);

  if (!map || !contextMenu.visible) return null;

  return (
    <div
      className="map-context-menu"
      style={{
        left: `${contextMenu.x}px`,
        top: `${contextMenu.y}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {contextMenu.crossingId !== null && (
        <button
          className="map-context-menu-item"
          onClick={() => {
            if (contextMenu.crossingId !== null) {
              const nodeIds = JSON.parse(contextMenu.nodeIds || '[]');
              if (setManagedClusterIdRef.current) {
                setManagedClusterIdRef.current(contextMenu.crossingId);
              }
              if (setManagedNodeIdsRef.current) {
                setManagedNodeIdsRef.current(nodeIds);
              }

              map.easeTo({
                center: [contextMenu.lng, contextMenu.lat],
                zoom: 17.5,
              });
            }
            setContextMenu((prev) => ({ ...prev, visible: false }));
          }}
        >
          <ZoomIn size={14} style={{ color: '#f59e0b' }} />
          <span>Manage Traffic Lights</span>
        </button>
      )}
      <button
        className="map-context-menu-item"
        onClick={() => {
          if (onStartDragRef.current) {
            onStartDragRef.current({ lat: contextMenu.lat, lng: contextMenu.lng });
          }
          setContextMenu((prev) => ({ ...prev, visible: false }));
        }}
      >
        <MapPin size={14} style={{ color: '#10b981' }} />
        <span>Start Route Here</span>
      </button>
      <button
        className="map-context-menu-item"
        onClick={() => {
          if (onEndDragRef.current) {
            onEndDragRef.current({ lat: contextMenu.lat, lng: contextMenu.lng });
          }
          setContextMenu((prev) => ({ ...prev, visible: false }));
        }}
      >
        <MapPin size={14} style={{ color: '#ef4444' }} />
        <span>End Route Here</span>
      </button>
    </div>
  );
};
