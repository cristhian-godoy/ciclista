import { logger } from '../common/logger';
import type { LocalOverrides } from '../config';
import { ensureWasmInitialized, WasmStreetGraph } from '../wasm';
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

let retainedWasmGraph: WasmStreetGraph | null = null;
let retainedNodeCount = 0;

self.onmessage = async (e: MessageEvent<WorkerRoutingRequest>) => {
  const {
    action,
    requestId,
    graph,
    chunkGraph,
    startCoord,
    endCoord,
    waypoints,
    overrides,
    algorithm = 'astar',
  } = e.data;

  try {
    const wasmReady = await ensureWasmInitialized();

    if (action === 'clear') {
      if (retainedWasmGraph) {
        retainedWasmGraph.clear();
        retainedNodeCount = 0;
      }
      return;
    }

    if (wasmReady) {
      if (!retainedWasmGraph) {
        retainedWasmGraph = new WasmStreetGraph();
      }

      if (chunkGraph) {
        retainedWasmGraph.merge_from_js_graph(chunkGraph);
        retainedNodeCount = retainedWasmGraph.node_count;
      }

      if (graph) {
        const currentGraphSize = graph.nodes ? graph.nodes.size : 0;
        if (currentGraphSize < retainedNodeCount) {
          retainedWasmGraph.clear();
          retainedWasmGraph.merge_from_js_graph(graph);
          retainedNodeCount = retainedWasmGraph.node_count;
        } else if (currentGraphSize > retainedNodeCount || retainedNodeCount === 0) {
          retainedWasmGraph.merge_from_js_graph(graph);
          retainedNodeCount = retainedWasmGraph.node_count;
        }
      }
    }

    if (action === 'merge_chunk') {
      return;
    }

    if (!startCoord || !endCoord) {
      return;
    }

    const hasWaypoints = Array.isArray(waypoints) && waypoints.length > 0;
    const points = hasWaypoints ? [startCoord, ...waypoints, endCoord] : null;

    if (!hasWaypoints && wasmReady && retainedWasmGraph && retainedWasmGraph.node_count > 0) {
      try {
        const variants = retainedWasmGraph.find_route_variants(
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

    // Fallback to TypeScript router
    if (!graph) {
      const response: WorkerRoutingResponse = {
        requestId,
        error: 'Graph unavailable for TypeScript routing fallback.',
      };
      self.postMessage(response);
      return;
    }

    const activeRouter = algorithm === 'dijkstra' ? dijkstraRouter : aStarRouter;
    const alts: StrategyRouteVariant[] = [];
    const localOverrides: LocalOverrides = overrides ?? {
      nodeDelays: new Map(),
      nodeNotes: new Map(),
      nodeTurns: new Map(),
    };

    for (const strategy of STRATEGIES) {
      const result = points
        ? findMultiStopRoute(activeRouter, graph, points, strategy.costFn, localOverrides)
        : activeRouter.findRoute(graph, startCoord, endCoord, strategy.costFn, localOverrides);
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
