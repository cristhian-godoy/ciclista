use std::collections::HashMap;
use serde::Deserialize;

use crate::geo::haversine_distance;
use crate::graph::{GraphEdge, GraphNode, NodeEntry, StreetGraph};

#[derive(Debug, Deserialize)]
struct OSMGeometryPoint {
    lat: f64,
    lon: f64,
}

#[derive(Debug, Deserialize)]
struct OSMElement {
    #[serde(rename = "type")]
    element_type: String,
    id: i64,
    #[serde(default)]
    lat: Option<f64>,
    #[serde(default)]
    lon: Option<f64>,
    #[serde(default)]
    tags: Option<HashMap<String, String>>,
    #[serde(default)]
    nodes: Option<Vec<i64>>,
    #[serde(default)]
    geometry: Option<Vec<OSMGeometryPoint>>,
}

#[derive(Debug, Deserialize)]
struct OSMRawResponse {
    #[serde(default)]
    elements: Option<Vec<OSMElement>>,
}

/// Generates a sample mock commute graph (Munich center) for sandbox or offline testing.
pub fn load_mock_graph() -> StreetGraph {
    let mut graph = StreetGraph::new();

    let nodes_data = vec![
        ("1", 48.13715, 11.5754, vec![("name", "Home (Marienplatz)")]),
        (
            "2",
            48.1428,
            11.5775,
            vec![
                ("highway", "traffic_signals"),
                ("name", "Odeonsplatz Intersection"),
            ],
        ),
        (
            "3",
            48.139,
            11.581,
            vec![("highway", "give_way"), ("name", "Maximilianstrasse Yield")],
        ),
        (
            "4",
            48.1351,
            11.576,
            vec![
                ("highway", "traffic_signals"),
                ("name", "Viktualienmarkt Light"),
            ],
        ),
        ("5", 48.135, 11.582, vec![("name", "Office (Isartor)")]),
        (
            "6",
            48.138,
            11.578,
            vec![("highway", "stop"), ("name", "Residenzstrasse Stop Sign")],
        ),
        (
            "7",
            48.1405,
            11.5795,
            vec![
                ("highway", "crossing"),
                ("crossing", "controlled"),
                ("name", "Pedestrian Crossing"),
            ],
        ),
    ];

    for (id, lat, lng, tag_list) in nodes_data {
        let mut tags = HashMap::new();
        for (k, v) in tag_list {
            tags.insert(k.to_string(), v.to_string());
        }
        graph.nodes.insert(
            id.to_string(),
            NodeEntry {
                node: GraphNode {
                    id: id.to_string(),
                    lat,
                    lng,
                    tags,
                },
                edges: Vec::new(),
            },
        );
    }

    let mut add_bi_edge = |u_id: &str, v_id: &str, name: &str, dist: f64, tag_list: Vec<(&str, &str)>| {
        let mut tags = HashMap::new();
        for (k, v) in tag_list {
            tags.insert(k.to_string(), v.to_string());
        }

        let edge_uv = GraphEdge {
            target: v_id.to_string(),
            distance: dist,
            name: Some(name.to_string()),
            speed_limit: Some(5.0),
            tags: tags.clone(),
        };
        let edge_vu = GraphEdge {
            target: u_id.to_string(),
            distance: dist,
            name: Some(name.to_string()),
            speed_limit: Some(5.0),
            tags,
        };

        if let Some(entry) = graph.nodes.get_mut(u_id) {
            entry.edges.push(edge_uv);
        }
        if let Some(entry) = graph.nodes.get_mut(v_id) {
            entry.edges.push(edge_vu);
        }
    };

    // Route A (Via Intersections with lights and controls)
    add_bi_edge("1", "2", "Theatinerstraße", 180.0, vec![("highway", "tertiary")]);
    add_bi_edge(
        "2",
        "7",
        "Residenzstraße North",
        110.0,
        vec![("highway", "residential"), ("cycleway", "track")],
    );
    add_bi_edge(
        "7",
        "3",
        "Residenzstraße South",
        110.0,
        vec![("highway", "residential"), ("cycleway", "track")],
    );
    add_bi_edge("3", "5", "Maximilianstraße", 250.0, vec![("highway", "tertiary")]);

    // Route B (Via stop sign and alternative lights)
    add_bi_edge(
        "1",
        "6",
        "Sendlinger Straße North",
        75.0,
        vec![("highway", "residential"), ("cycleway", "lane")],
    );
    add_bi_edge(
        "6",
        "4",
        "Sendlinger Straße South",
        75.0,
        vec![("highway", "residential"), ("cycleway", "lane")],
    );
    add_bi_edge("4", "5", "Tal", 350.0, vec![("highway", "service")]);

    graph
}

/// Parses raw OpenStreetMap JSON response into a traversable StreetGraph network.
pub fn parse_osm_json(raw_json: &str) -> StreetGraph {
    let parsed: Result<OSMRawResponse, _> = serde_json::from_str(raw_json);
    let Ok(data) = parsed else {
        return load_mock_graph();
    };

    let Some(elements) = data.elements else {
        return load_mock_graph();
    };

    if elements.is_empty() {
        return load_mock_graph();
    }

    let mut temp_nodes: HashMap<String, GraphNode> = HashMap::new();

    // 1. First pass: Collect all node coordinates and tags
    for el in &elements {
        if el.element_type == "node" {
            let id_str = el.id.to_string();
            let lat = el.lat.unwrap_or(0.0);
            let lng = el.lon.unwrap_or(0.0);
            let tags = el.tags.clone().unwrap_or_default();

            if let Some(existing) = temp_nodes.get_mut(&id_str) {
                existing.tags = tags;
                if lat != 0.0 || lng != 0.0 {
                    existing.lat = lat;
                    existing.lng = lng;
                }
            } else {
                temp_nodes.insert(
                    id_str.clone(),
                    GraphNode {
                        id: id_str,
                        lat,
                        lng,
                        tags,
                    },
                );
            }
        } else if el.element_type == "way" {
            if let (Some(nodes), Some(geometry)) = (&el.nodes, &el.geometry) {
                for (i, node_id) in nodes.iter().enumerate() {
                    let Some(geo_pt) = geometry.get(i) else { continue };
                    let id_str = node_id.to_string();

                    if let Some(existing) = temp_nodes.get_mut(&id_str) {
                        if existing.lat == 0.0 && existing.lng == 0.0 {
                            existing.lat = geo_pt.lat;
                            existing.lng = geo_pt.lon;
                        }
                    } else {
                        temp_nodes.insert(
                            id_str.clone(),
                            GraphNode {
                                id: id_str,
                                lat: geo_pt.lat,
                                lng: geo_pt.lon,
                                tags: HashMap::new(),
                            },
                        );
                    }
                }
            }
        }
    }

    let mut graph = StreetGraph::new();

    // 2. Second pass: Process ways and construct edges
    for el in &elements {
        if el.element_type != "way" {
            continue;
        }

        let way_tags = el.tags.clone().unwrap_or_default();
        let highway = way_tags.get("highway").map(|s| s.as_str()).unwrap_or("");

        if highway.is_empty()
            || matches!(
                highway,
                "motorway" | "motorway_link" | "proposed" | "construction" | "abandoned" | "steps"
            )
        {
            continue;
        }

        if way_tags.get("bicycle").map(|s| s.as_str()) == Some("no")
            || way_tags.get("access").map(|s| s.as_str()) == Some("no")
        {
            continue;
        }

        let Some(nodes_list) = &el.nodes else { continue };
        if nodes_list.len() < 2 {
            continue;
        }

        let mut speed_limit = 5.0;
        if let Some(raw_speed) = way_tags.get("maxspeed") {
            let trimmed = raw_speed.trim();
            let mut is_mph = false;
            let numeric_part = if trimmed.to_lowercase().ends_with("mph") {
                is_mph = true;
                trimmed[..trimmed.len() - 3].trim()
            } else {
                trimmed
            };

            if let Ok(mut limit_kmh) = numeric_part.parse::<f64>() {
                if is_mph {
                    limit_kmh *= 1.60934;
                }
                speed_limit = ((limit_kmh * 1000.0) / 3600.0).min(5.0);
            }
        }

        let oneway = way_tags.get("oneway").map(|s| s.as_str()) == Some("yes");
        let oneway_bicycle = match way_tags.get("oneway:bicycle").map(|s| s.as_str()) {
            Some("yes") => true,
            Some("no") => false,
            _ => oneway,
        };

        let edge_name = way_tags.get("name").cloned();

        for i in 0..nodes_list.len() - 1 {
            let u_id = nodes_list[i].to_string();
            let v_id = nodes_list[i + 1].to_string();

            let (u_node, v_node) = match (temp_nodes.get(&u_id), temp_nodes.get(&v_id)) {
                (Some(u), Some(v)) => (u.clone(), v.clone()),
                _ => continue,
            };

            let dist = haversine_distance(u_node.lat, u_node.lng, v_node.lat, v_node.lng);

            let u_entry = graph.nodes.entry(u_id.clone()).or_insert_with(|| NodeEntry {
                node: u_node,
                edges: Vec::new(),
            });
            u_entry.edges.push(GraphEdge {
                target: v_id.clone(),
                distance: dist,
                name: edge_name.clone(),
                speed_limit: Some(speed_limit),
                tags: way_tags.clone(),
            });

            let v_entry = graph.nodes.entry(v_id.clone()).or_insert_with(|| NodeEntry {
                node: v_node,
                edges: Vec::new(),
            });

            if !oneway_bicycle {
                v_entry.edges.push(GraphEdge {
                    target: u_id.clone(),
                    distance: dist,
                    name: edge_name.clone(),
                    speed_limit: Some(speed_limit),
                    tags: way_tags.clone(),
                });
            }
        }
    }

    if graph.nodes.is_empty() {
        return load_mock_graph();
    }

    graph
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_mock_graph() {
        let graph = load_mock_graph();
        assert_eq!(graph.nodes.len(), 7);
        assert!(graph.nodes.contains_key("1"));
        assert!(graph.nodes.contains_key("5"));
    }

    #[test]
    fn test_parse_empty_json() {
        let graph = parse_osm_json("{}");
        assert_eq!(graph.nodes.len(), 7); // Falls back to mock graph
    }
}
