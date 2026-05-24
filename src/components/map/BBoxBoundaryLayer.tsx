import maplibregl from 'maplibre-gl';
import React, { useEffect } from 'react';

interface BBoxBoundaryLayerProps {
  map: maplibregl.Map;
  loadedBBoxes: [number, number, number, number][];
}

/**
 *
 */
export const BBoxBoundaryLayer: React.FC<BBoxBoundaryLayerProps> = ({ map, loadedBBoxes }) => {
  // Add source on mount/map change
  useEffect(() => {
    if (!map.getSource('loaded-bbox')) {
      map.addSource('loaded-bbox', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    return () => {
      if (map.getSource('loaded-bbox')) {
        map.removeSource('loaded-bbox');
      }
    };
  }, [map]);

  // Sync loadedBBoxes into the source
  useEffect(() => {
    const bboxSource = map.getSource('loaded-bbox') as maplibregl.GeoJSONSource;
    if (!bboxSource) return;

    if (loadedBBoxes && loadedBBoxes.length > 0) {
      const features = loadedBBoxes.map((bbox) => {
        const [minLat, minLng, maxLat, maxLng] = bbox;
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Polygon' as const,
            coordinates: [
              [
                [minLng, minLat],
                [maxLng, minLat],
                [maxLng, maxLat],
                [minLng, maxLat],
                [minLng, minLat],
              ],
            ],
          },
          properties: {},
        };
      });
      bboxSource.setData({
        type: 'FeatureCollection',
        features,
      });
    } else {
      bboxSource.setData({
        type: 'FeatureCollection',
        features: [],
      });
    }
  }, [map, loadedBBoxes]);

  return null;
};
