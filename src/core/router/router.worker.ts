import { logger } from '../common/logger';
import { ensureWasmInitialized, WasmEngine } from '../wasm';
import { AStarRouter } from './astar';
import { findMultiStopRoute } from './multi-stop';
import { DijkstraRouter } from './router';
import { avoidBusyRoadsCost, avoidStoppingCost, standardCost } from './strategies';
import type { StrategyRouteVariant, WorkerRoutingRequest, WorkerRoutingResponse } from './types';

const aStarRouter = new AStarRouter();
const dijkstraRouter = new DijkstraRouter();

const STRATEGIES = [
  { label: 'standard', costFn: standardCost },
  { label: 'avoid-stops', costFn: avoidStoppingCost },
  { label: 'quiet-streets', costFn: avoidBusyRoadsCost },
] as const;

self.onmessage = async (e: MessageEvent<WorkerRoutingRequest>) => {
  const {
    requestId,
    graph,
    startCoord,
    endCoord,
    waypoints,
    overrides,
    algorithm = 'astar',
  } = e.data;

  try {
    const hasWaypoints = Array.isArray(waypoints) && waypoints.length > 0;
    const points = hasWaypoints ? [startCoord, ...waypoints, endCoord] : null;

    if (!hasWaypoints) {
      const wasmReady = await ensureWasmInitialized();
      if (wasmReady) {
        try {
          const variants = WasmEngine.find_route_variants_from_js_graph(
            graph,
            startCoord,
            endCoord,
            overrides,
            algorithm,
          ) as StrategyRouteVariant[];

          if (Array.isArray(variants) && variants.length > 0) {
            const response: WorkerRoutingResponse = { requestId, routeVariants: variants };
            self.postMessage(response);
            return;
          }
        } catch (error) {
          logger.warn('WASM routing calculation failed, falling back to TypeScript engine:', error);
        }
      }
    }

    const activeRouter = algorithm === 'dijkstra' ? dijkstraRouter : aStarRouter;
    const alts: StrategyRouteVariant[] = [];

    for (const strategy of STRATEGIES) {
      const result = points
        ? findMultiStopRoute(activeRouter, graph, points, strategy.costFn, overrides)
        : activeRouter.findRoute(graph, startCoord, endCoord, strategy.costFn, overrides);
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
