import React from 'react';

/**
 * Properties for the OsmTagTable component.
 */
export interface OsmTagTableProps {
  /**
   * Key-value attributes from OpenStreetMap.
   */
  tags: Record<string, string>;
}

/**
 * Displays raw OpenStreetMap key-value tags in an inspectable table format.
 */
export const OsmTagTable: React.FC<OsmTagTableProps> = ({ tags }) => {
  const entries = Object.entries(tags);

  return (
    <>
      <div className="osm-tags-title popup-tags-title">OSM Tags</div>
      <div className="osm-tags-container">
        {entries.length > 0 ? (
          entries.map(([key, val]) => (
            <div key={key} className="osm-tag-row">
              <span className="osm-tag-key">{key}</span>
              <span className="osm-tag-val">{String(val)}</span>
            </div>
          ))
        ) : (
          <div className="popup-empty-tags">No tags available</div>
        )}
      </div>
    </>
  );
};
