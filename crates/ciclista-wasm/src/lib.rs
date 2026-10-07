use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use ciclista_core::geo::Coordinate;
use ciclista_core::graph::{NodeEntry, StreetGraph};
use ciclista_core::parser::{load_mock_graph, parse_osm_json};
use ciclista_core::router::{find_route_variants, LocalOverrides, StrategyRouteVariant};

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
            find_route_variants(&graph.inner, start, end, &local_overrides);

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
        Self::find_route_variants(&wasm_graph, start_coord, end_coord, overrides)
    }
}
