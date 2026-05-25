import { avoidBusyRoadsCost, avoidStoppingCost, standardCost } from './cost';
import { DijkstraRouter } from './router';
import type { RouteAlternative } from './types';

const router = new DijkstraRouter();

self.onmessage = (e: MessageEvent) => {
  const { requestId, graph, startCoord, endCoord, overrides } = e.data;

  try {
    const standardResult = router.findRoute(graph, startCoord, endCoord, standardCost, overrides);
    const avoidStopsResult = router.findRoute(
      graph,
      startCoord,
      endCoord,
      avoidStoppingCost,
      overrides,
    );
    const quietResult = router.findRoute(
      graph,
      startCoord,
      endCoord,
      avoidBusyRoadsCost,
      overrides,
    );

    const alts: RouteAlternative[] = [];
    if (standardResult) {
      alts.push({ label: 'standard', result: standardResult });
    }
    if (avoidStopsResult) {
      alts.push({ label: 'avoid-stops', result: avoidStopsResult });
    }
    if (quietResult) {
      alts.push({ label: 'quiet-streets', result: quietResult });
    }

    self.postMessage({ requestId, routeAlternatives: alts });
  } catch (error) {
    self.postMessage({ requestId, error: String(error) });
  }
};
