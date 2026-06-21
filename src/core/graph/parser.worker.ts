import { OSMGraphParser } from './parser';

const parser = new OSMGraphParser();

self.onmessage = (e: MessageEvent) => {
  const { requestId, rawData } = e.data;

  try {
    const graph = parser.parse(rawData);
    const nodesEntries = Array.from(graph.nodes.entries());
    const serializedNodes = JSON.stringify(nodesEntries);
    self.postMessage({ requestId, serializedNodes });
  } catch (error) {
    self.postMessage({ requestId, error: String(error) });
  }
};
