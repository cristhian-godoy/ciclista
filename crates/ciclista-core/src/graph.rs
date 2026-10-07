use std::collections::{HashMap, HashSet};
use serde::{Deserialize, Serialize};

/// Represents a single vertex in the street routing network.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GraphNode {
    pub id: String,
    pub lat: f64,
    pub lng: f64,
    #[serde(default)]
    pub tags: HashMap<String, String>,
}

/// Represents a directed link between two vertices in the street network.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GraphEdge {
    pub target: String,
    pub distance: f64,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub name: Option<String>,
    #[serde(rename = "speedLimit", skip_serializing_if = "Option::is_none", default)]
    pub speed_limit: Option<f64>,
    #[serde(default)]
    pub tags: HashMap<String, String>,
}

/// Adjacency list entry storing a vertex node and its outgoing directed edges.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct NodeEntry {
    pub node: GraphNode,
    pub edges: Vec<GraphEdge>,
}

/// Traversable street network graph composed of indexed vertices and adjacency edges.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct StreetGraph {
    pub nodes: HashMap<String, NodeEntry>,
}

impl StreetGraph {
    /// Creates an empty street network graph.
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
        }
    }

    /// Merges another graph into this one, deduplicating directed edges by target node ID.
    pub fn merge_with(&mut self, other: StreetGraph) {
        for (node_id, other_entry) in other.nodes {
            if let Some(existing_entry) = self.nodes.get_mut(&node_id) {
                let existing_targets: HashSet<String> = existing_entry
                    .edges
                    .iter()
                    .map(|e| e.target.clone())
                    .collect();

                for edge in other_entry.edges {
                    if !existing_targets.contains(&edge.target) {
                        existing_entry.edges.push(edge);
                    }
                }
            } else {
                self.nodes.insert(node_id, other_entry);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_merge_with() {
        let mut g1 = StreetGraph::new();
        let mut n1_edges = Vec::new();
        n1_edges.push(GraphEdge {
            target: "2".to_string(),
            distance: 100.0,
            name: Some("Edge 1->2".to_string()),
            speed_limit: Some(5.0),
            tags: HashMap::new(),
        });

        g1.nodes.insert(
            "1".to_string(),
            NodeEntry {
                node: GraphNode {
                    id: "1".to_string(),
                    lat: 48.0,
                    lng: 11.0,
                    tags: HashMap::new(),
                },
                edges: n1_edges,
            },
        );

        let mut g2 = StreetGraph::new();
        let mut n1_edges_2 = Vec::new();
        // Duplicate edge 1->2
        n1_edges_2.push(GraphEdge {
            target: "2".to_string(),
            distance: 100.0,
            name: Some("Edge 1->2 duplicate".to_string()),
            speed_limit: Some(5.0),
            tags: HashMap::new(),
        });
        // New edge 1->3
        n1_edges_2.push(GraphEdge {
            target: "3".to_string(),
            distance: 150.0,
            name: Some("Edge 1->3".to_string()),
            speed_limit: Some(5.0),
            tags: HashMap::new(),
        });

        g2.nodes.insert(
            "1".to_string(),
            NodeEntry {
                node: GraphNode {
                    id: "1".to_string(),
                    lat: 48.0,
                    lng: 11.0,
                    tags: HashMap::new(),
                },
                edges: n1_edges_2,
            },
        );

        // New node 4 in g2
        g2.nodes.insert(
            "4".to_string(),
            NodeEntry {
                node: GraphNode {
                    id: "4".to_string(),
                    lat: 48.1,
                    lng: 11.1,
                    tags: HashMap::new(),
                },
                edges: vec![],
            },
        );

        g1.merge_with(g2);

        assert_eq!(g1.nodes.len(), 2);
        let entry1 = g1.nodes.get("1").unwrap();
        assert_eq!(entry1.edges.len(), 2);
        assert_eq!(entry1.edges[0].target, "2");
        assert_eq!(entry1.edges[1].target, "3");
        assert!(g1.nodes.contains_key("4"));
    }
}
