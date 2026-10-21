use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use ciclista_core::geo::Coordinate;
use ciclista_core::graph::{NodeEntry, StreetGraph};
use ciclista_core::parser::{load_mock_graph, parse_osm_json};
use ciclista_core::router::{
    find_route_variants_astar, find_route_variants_dijkstra, LocalOverrides, StrategyRouteVariant,
};

#[wasm_bindgen]
pub struct WasmStreetGraph {
    pub(crate) inner: StreetGraph,
}

#[wasm_bindgen]
impl WasmStreetGraph {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: StreetGraph::new(),
        }
    }

    #[wasm_bindgen(getter)]
    pub fn node_count(&self) -> usize {
        self.inner.nodes.len()
    }

    #[wasm_bindgen]
    pub fn merge_with(&mut self, other: &WasmStreetGraph) {
        self.inner.merge_with(other.inner.clone());
    }

    #[wasm_bindgen]
    pub fn to_json(&self) -> Result<String, JsValue> {
        serde_json::to_string(&self.inner)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    #[wasm_bindgen]
    pub fn from_json(json: &str) -> Result<WasmStreetGraph, JsValue> {
        let inner: StreetGraph = serde_json::from_str(json)
            .map_err(|e| JsValue::from_str(&format!("Deserialization error: {}", e)))?;
        Ok(WasmStreetGraph { inner })
    }

    #[wasm_bindgen]
    pub fn to_entries_json(&self) -> Result<String, JsValue> {
        let entries: Vec<(&String, &NodeEntry)> = self.inner.nodes.iter().collect();
        serde_json::to_string(&entries)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    #[wasm_bindgen]
    pub fn merge_from_js_graph(&mut self, graph_val: JsValue) -> Result<(), JsValue> {
        let other: StreetGraph = if let Ok(js_g) =
            serde_wasm_bindgen::from_value::<JsStreetGraph>(graph_val.clone())
        {
            let nodes = match js_g.nodes {
                NodeCollection::Map(m) => m,
                NodeCollection::List(l) => l.into_iter().collect(),
            };
            StreetGraph { nodes }
        } else {
            serde_wasm_bindgen::from_value(graph_val)
                .map_err(|e| JsValue::from_str(&format!("Invalid graph data: {}", e)))?
        };

        self.inner.merge_with(other);
        Ok(())
    }

    #[wasm_bindgen]
    pub fn merge_osm_json(&mut self, raw_json: &str) {
        let other = parse_osm_json(raw_json);
        self.inner.merge_with(other);
    }

    #[wasm_bindgen]
    pub fn clear(&mut self) {
        self.inner.nodes.clear();
    }

    #[wasm_bindgen]
    pub fn find_route_variants(
        &self,
        start_coord: JsValue,
        end_coord: JsValue,
        overrides: JsValue,
        algorithm: Option<String>,
    ) -> Result<JsValue, JsValue> {
        WasmEngine::find_route_variants(self, start_coord, end_coord, overrides, algorithm)
    }
}

#[derive(Debug, Deserialize)]
struct JsStreetGraph {
    nodes: NodeCollection,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum NodeCollection {
    Map(HashMap<String, NodeEntry>),
    List(Vec<(String, NodeEntry)>),
}

#[wasm_bindgen]
pub struct WasmEngine;

#[wasm_bindgen]
impl WasmEngine {
    #[wasm_bindgen]
    pub fn init_panic_hook() {
        console_error_panic_hook::set_once();
    }

    #[wasm_bindgen]
    pub fn parse_graph_json(raw_json: &str) -> WasmStreetGraph {
        let graph = parse_osm_json(raw_json);
        WasmStreetGraph { inner: graph }
    }

    #[wasm_bindgen]
    pub fn load_mock_graph() -> WasmStreetGraph {
        WasmStreetGraph {
            inner: load_mock_graph(),
        }
    }

    #[wasm_bindgen]
    pub fn parse_graph(raw_data: JsValue) -> Result<WasmStreetGraph, JsValue> {
        if raw_data.is_string() {
            let s = raw_data.as_string().unwrap_or_default();
            return Ok(Self::parse_graph_json(&s));
        }

        if raw_data.is_null() || raw_data.is_undefined() {
            return Ok(Self::load_mock_graph());
        }

        let json_str: String = js_sys::JSON::stringify(&raw_data)?
            .as_string()
            .unwrap_or_default();

        Ok(Self::parse_graph_json(&json_str))
    }

    #[wasm_bindgen]
    pub fn find_route_variants(
        graph: &WasmStreetGraph,
        start_coord: JsValue,
        end_coord: JsValue,
        overrides: JsValue,
        algorithm: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let start: Coordinate = serde_wasm_bindgen::from_value(start_coord)
            .map_err(|e| JsValue::from_str(&format!("Invalid start_coord: {}", e)))?;
        let end: Coordinate = serde_wasm_bindgen::from_value(end_coord)
            .map_err(|e| JsValue::from_str(&format!("Invalid end_coord: {}", e)))?;

        let local_overrides: LocalOverrides = if overrides.is_null() || overrides.is_undefined() {
            LocalOverrides::default()
        } else {
            serde_wasm_bindgen::from_value(overrides)
                .map_err(|e| JsValue::from_str(&format!("Invalid overrides: {}", e)))?
        };

        let variants: Vec<StrategyRouteVariant> = match algorithm.as_deref() {
            Some("dijkstra") => {
                find_route_variants_dijkstra(&graph.inner, start, end, &local_overrides)
            }
            _ => find_route_variants_astar(&graph.inner, start, end, &local_overrides),
        };

        let serializer = serde_wasm_bindgen::Serializer::json_compatible();
        variants
            .serialize(&serializer)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    #[wasm_bindgen]
    pub fn find_route_variants_astar(
        graph: &WasmStreetGraph,
        start_coord: JsValue,
        end_coord: JsValue,
        overrides: JsValue,
    ) -> Result<JsValue, JsValue> {
        let start: Coordinate = serde_wasm_bindgen::from_value(start_coord)
            .map_err(|e| JsValue::from_str(&format!("Invalid start_coord: {}", e)))?;
        let end: Coordinate = serde_wasm_bindgen::from_value(end_coord)
            .map_err(|e| JsValue::from_str(&format!("Invalid end_coord: {}", e)))?;

        let local_overrides: LocalOverrides = if overrides.is_null() || overrides.is_undefined() {
            LocalOverrides::default()
        } else {
            serde_wasm_bindgen::from_value(overrides)
                .map_err(|e| JsValue::from_str(&format!("Invalid overrides: {}", e)))?
        };

        let variants: Vec<StrategyRouteVariant> =
            find_route_variants_astar(&graph.inner, start, end, &local_overrides);

        let serializer = serde_wasm_bindgen::Serializer::json_compatible();
        variants
            .serialize(&serializer)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    #[wasm_bindgen]
    pub fn find_route_variants_dijkstra(
        graph: &WasmStreetGraph,
        start_coord: JsValue,
        end_coord: JsValue,
        overrides: JsValue,
    ) -> Result<JsValue, JsValue> {
        let start: Coordinate = serde_wasm_bindgen::from_value(start_coord)
            .map_err(|e| JsValue::from_str(&format!("Invalid start_coord: {}", e)))?;
        let end: Coordinate = serde_wasm_bindgen::from_value(end_coord)
            .map_err(|e| JsValue::from_str(&format!("Invalid end_coord: {}", e)))?;

        let local_overrides: LocalOverrides = if overrides.is_null() || overrides.is_undefined() {
            LocalOverrides::default()
        } else {
            serde_wasm_bindgen::from_value(overrides)
                .map_err(|e| JsValue::from_str(&format!("Invalid overrides: {}", e)))?
        };

        let variants: Vec<StrategyRouteVariant> =
            find_route_variants_dijkstra(&graph.inner, start, end, &local_overrides);

        let serializer = serde_wasm_bindgen::Serializer::json_compatible();
        variants
            .serialize(&serializer)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    #[wasm_bindgen]
    pub fn find_route_variants_from_js_graph(
        graph_val: JsValue,
        start_coord: JsValue,
        end_coord: JsValue,
        overrides: JsValue,
        algorithm: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let graph: StreetGraph = if let Ok(js_g) =
            serde_wasm_bindgen::from_value::<JsStreetGraph>(graph_val.clone())
        {
            let nodes = match js_g.nodes {
                NodeCollection::Map(m) => m,
                NodeCollection::List(l) => l.into_iter().collect(),
            };
            StreetGraph { nodes }
        } else {
            serde_wasm_bindgen::from_value(graph_val)
                .map_err(|e| JsValue::from_str(&format!("Invalid graph data: {}", e)))?
        };

        let wasm_graph = WasmStreetGraph { inner: graph };
        Self::find_route_variants(&wasm_graph, start_coord, end_coord, overrides, algorithm)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wasm_street_graph_lifecycle() {
        let mut graph = WasmStreetGraph::new();
        assert_eq!(graph.node_count(), 0);

        let mock = WasmEngine::load_mock_graph();
        assert!(mock.node_count() > 0);

        let json = mock.to_json().expect("Serialization should succeed");
        let restored = WasmStreetGraph::from_json(&json).expect("Deserialization should succeed");
        assert_eq!(restored.node_count(), mock.node_count());

        let entries_json = mock.to_entries_json().expect("entries json");
        assert!(entries_json.starts_with('['));

        graph.merge_with(&mock);
        assert_eq!(graph.node_count(), mock.node_count());

        graph.clear();
        assert_eq!(graph.node_count(), 0);
    }

    #[test]
    fn test_wasm_street_graph_merge_osm_json() {
        let mut graph = WasmStreetGraph::new();
        let raw_json = r#"{
            "elements": [
                { "type": "node", "id": 1, "lat": 48.13, "lon": 11.57, "tags": {} },
                { "type": "node", "id": 2, "lat": 48.14, "lon": 11.58, "tags": {} },
                { "type": "way", "id": 10, "nodes": [1, 2], "tags": { "highway": "residential" } }
            ]
        }"#;
        graph.merge_osm_json(raw_json);
        assert_eq!(graph.node_count(), 2);
    }

    #[test]
    fn test_wasm_engine_parse_graph_json() {
        let empty_json = r#"{"elements":[]}"#;
        let fallback_graph = WasmEngine::parse_graph_json(empty_json);
        assert_eq!(fallback_graph.node_count(), 7); // Falls back to mock graph on empty data

        let raw_osm = r#"{
            "elements": [
                {"type": "node", "id": 1, "lat": 48.1, "lon": 11.1, "tags": {}},
                {"type": "node", "id": 2, "lat": 48.2, "lon": 11.2, "tags": {}},
                {"type": "way", "id": 10, "nodes": [1, 2], "tags": {"highway": "cycleway"}}
            ]
        }"#;
        let parsed = WasmEngine::parse_graph_json(raw_osm);
        assert_eq!(parsed.node_count(), 2);
    }

    #[test]
    fn test_wasm_engine_routing_parity_internal() {
        let graph = WasmEngine::load_mock_graph();
        let start = Coordinate {
            lat: 48.137,
            lng: 11.575,
        };
        let end = Coordinate {
            lat: 48.140,
            lng: 11.580,
        };
        let overrides = LocalOverrides::default();

        let astar_variants = find_route_variants_astar(&graph.inner, start, end, &overrides);
        let dijkstra_variants = find_route_variants_dijkstra(&graph.inner, start, end, &overrides);

        assert_eq!(astar_variants.len(), dijkstra_variants.len());
        for (a, d) in astar_variants.iter().zip(dijkstra_variants.iter()) {
            assert_eq!(a.label, d.label);
            assert_eq!(a.result.path_node_ids, d.result.path_node_ids);
            assert!(
                (a.result.total_duration_seconds - d.result.total_duration_seconds).abs() < 1e-4
            );
            assert!((a.result.total_distance_meters - d.result.total_distance_meters).abs() < 1e-4);
        }
    }
}
