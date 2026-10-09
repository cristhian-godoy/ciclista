import type { LocalOverrides } from '../config';

/**
 * Evaluates whether a transition from currentId to neighborId (with optional parentId)
 * matches any configured crossing turn overrides.
 *
 * @param parentId - The preceding node in the path (or null if currentId is the first node).
 * @param currentId - The source node of the current edge transition.
 * @param neighborId - The target node of the current edge transition.
 * @param overrides - Local overrides containing crossing turn rules.
 * @returns Object indicating whether the turn is banned and the cumulative time delta penalty in seconds.
 */
export function getCrossingTurnEffect(
  parentId: string | null,
  currentId: string,
  neighborId: string,
  overrides?: LocalOverrides,
): { isBanned: boolean; timeDelta: number } {
  if (!overrides?.crossingTurns || overrides.crossingTurns.length === 0) {
    return { isBanned: false, timeDelta: 0 };
  }

  let cumulativeDelta = 0;

  for (const turn of overrides.crossingTurns) {
    let matches = false;
    let appliesDelta = false;

    const path = turn.pathNodeIds;
    if (path && path.length >= 2) {
      if (path.length === 2) {
        // Direct edge turn: [from, to]
        if (currentId === path[0] && neighborId === path[1]) {
          matches = true;
          appliesDelta = true;
        }
      } else if (path.length === 3) {
        // 2-hop turn: [parent, current, neighbor]
        if (parentId === path[0] && currentId === path[1] && neighborId === path[2]) {
          matches = true;
          appliesDelta = true;
        }
      } else {
        // Multi-hop path: [N0, N1, ..., Nk]
        // Check if (currentId, neighborId) is any step along the path for banning
        for (let i = 0; i < path.length - 1; i++) {
          if (currentId === path[i] && neighborId === path[i + 1]) {
            matches = true;
            break;
          }
        }
        // Time delta applies once at the arrival edge into target
        if (currentId === path[path.length - 2] && neighborId === path[path.length - 1]) {
          appliesDelta = true;
        }
      }
    } else {
      // Fallback matching fromNodeId and toNodeId directly
      if (currentId === turn.fromNodeId && neighborId === turn.toNodeId) {
        matches = true;
        appliesDelta = true;
      } else if (parentId === turn.fromNodeId && neighborId === turn.toNodeId) {
        matches = true;
        appliesDelta = true;
      }
    }

    if (matches && turn.banned) {
      return { isBanned: true, timeDelta: 0 };
    }

    if (appliesDelta && turn.timeDeltaSeconds) {
      cumulativeDelta += turn.timeDeltaSeconds;
    }
  }

  return { isBanned: false, timeDelta: cumulativeDelta };
}

/**
 * Checks if a direct edge between sourceId and targetId is prohibited by a direct crossing turn override.
 *
 * @param sourceId - Starting node identifier.
 * @param targetId - Target node identifier.
 * @param overrides - Local user overrides.
 * @returns True if edge matches a banned direct crossing turn.
 */
export function isCrossingTurnDirectlyBanned(
  sourceId: string,
  targetId: string,
  overrides?: LocalOverrides,
): boolean {
  if (!overrides?.crossingTurns) return false;
  return overrides.crossingTurns.some(
    (t) =>
      t.banned &&
      ((t.fromNodeId === sourceId && t.toNodeId === targetId) ||
        (t.pathNodeIds &&
          t.pathNodeIds.length === 2 &&
          t.pathNodeIds[0] === sourceId &&
          t.pathNodeIds[1] === targetId)),
  );
}
