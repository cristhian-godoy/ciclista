import { DijkstraRouter } from './router';
import { avoidBusyRoadsCost, avoidStoppingCost, standardCost } from './strategies';
import type { StrategyRouteVariant, WorkerRoutingRequest, WorkerRoutingResponse } from './types';

const router = new DijkstraRouter();

const STRATEGIES = [
  { label: 'standard', costFn: standardCost },
  { label: 'avoid-stops', costFn: avoidStoppingCost },
  { label: 'quiet-streets', costFn: avoidBusyRoadsCost },
] as const;

self.onmessage = (e: MessageEvent<WorkerRoutingRequest>) => {
  const { requestId, graph, startCoord, endCoord, overrides } = e.data;

  try {
    const alts: StrategyRouteVariant[] = [];

    for (const strategy of STRATEGIES) {
      const result = router.findRoute(graph, startCoord, endCoord, strategy.costFn, overrides);
      if (result) {
        alts.push({ label: strategy.label, result });
      }
    }

    const response: WorkerRoutingResponse = { requestId, routeVariants: alts };
    self.postMessage(response);
  } catch (error) {
    const response: WorkerRoutingResponse = { requestId, error: String(error) };
    self.postMessage(response);
  }
};
