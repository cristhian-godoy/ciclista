import { DijkstraRouter } from './router';
import { avoidBusyRoadsCost, avoidStoppingCost, standardCost } from './strategies';
import type { StrategyRouteVariant } from './types';

const router = new DijkstraRouter();

const STRATEGIES = [
  { label: 'standard', costFn: standardCost },
  { label: 'avoid-stops', costFn: avoidStoppingCost },
  { label: 'quiet-streets', costFn: avoidBusyRoadsCost },
] as const;

self.onmessage = (e: MessageEvent) => {
  const { requestId, graph, startCoord, endCoord, overrides } = e.data;

  try {
    const alts: StrategyRouteVariant[] = [];

    for (const strategy of STRATEGIES) {
      const result = router.findRoute(graph, startCoord, endCoord, strategy.costFn, overrides);
      if (result) {
        alts.push({ label: strategy.label, result });
      }
    }

    self.postMessage({ requestId, routeVariants: alts });
  } catch (error) {
    self.postMessage({ requestId, error: String(error) });
  }
};
