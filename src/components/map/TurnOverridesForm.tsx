import React from 'react';

import type { SemanticTurnType } from '../../core/config';

/**
 * Maneuver path specification between an incoming street and an outgoing street.
 */
export interface NodeManeuver {
  /** Source node identifier of the incoming approach link */
  fromNodeId: string;
  /** Descriptive street name of the incoming link */
  fromStreetName: string;
  /** Target node identifier of the outgoing link */
  toNodeId: string;
  /** Descriptive street name of the outgoing departure link */
  toStreetName: string;
  /** Relative geometric turn direction category */
  direction: 'left' | 'right' | 'u-turn' | 'straight';
  /** Verbal compass direction of arrival (e.g. Northbound) */
  incomingDir: string;
  /** Verbal compass direction of departure (e.g. Eastbound) */
  outgoingDir: string;
}

/**
 * Properties for the TurnOverridesForm component.
 */
export interface TurnOverridesFormProps {
  /**
   * List of traversable maneuvers passing through the node.
   */
  maneuvers: readonly NodeManeuver[];
  /**
   * Current map of composite turn keys (e.g. "from->to") to semantic turn overrides.
   */
  nodeTurns: Record<string, SemanticTurnType>;
  /**
   * Callback fired when a turn override selection is changed.
   */
  onTurnChange: (compositeKey: string, value: string) => void;
}

/**
 * Subcomponent rendering the turn-by-turn penalty override selectors in NodePopup.
 */
export const TurnOverridesForm: React.FC<TurnOverridesFormProps> = ({
  maneuvers,
  nodeTurns,
  onTurnChange,
}) => {
  if (maneuvers.length === 0) {
    return null;
  }

  return (
    <div className="popup-form-group">
      <div className="osm-tags-title popup-tags-title">Turn Overrides</div>
      <div className="popup-turn-container">
        {maneuvers.map((m) => {
          const compositeKey = `${m.fromNodeId}->${m.toNodeId}`;
          const activeVal = nodeTurns[compositeKey] || 'default';

          return (
            <div key={compositeKey} className="popup-turn-item">
              <div className="text-secondary">
                From <strong>{m.fromStreetName}</strong> ({m.incomingDir})
                <br />
                To <strong>{m.toStreetName}</strong> ({m.outgoingDir} -{' '}
                {m.direction === 'left'
                  ? 'Left Turn'
                  : m.direction === 'right'
                    ? 'Right Turn'
                    : m.direction === 'u-turn'
                      ? 'U-Turn'
                      : 'Straight'}
                )
              </div>
              <select
                aria-label={`Turn override from ${m.fromStreetName} to ${m.toStreetName}`}
                value={activeVal}
                onChange={(e) => onTurnChange(compositeKey, e.target.value)}
                className="popup-turn-select"
              >
                <option value="default" className="popup-select-option">
                  Default
                </option>
                <option value="left_turn" className="popup-select-option">
                  Direct Left Turn
                </option>
                <option value="right_turn" className="popup-select-option">
                  Direct Right Turn
                </option>
                <option value="green_arrow_right" className="popup-select-option">
                  Green Arrow Right Turn
                </option>
                <option value="indirect_left" className="popup-select-option">
                  Indirect Left Turn
                </option>
                <option value="u_turn" className="popup-select-option">
                  U-Turn
                </option>
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
};
