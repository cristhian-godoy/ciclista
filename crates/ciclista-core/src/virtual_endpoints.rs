use std::collections::HashMap;

use crate::geo::{
    get_projection_t, haversine_distance, project_point_on_segment, Coordinate,
};
use crate::graph::{GraphEdge, GraphNode, StreetGraph};
use crate::router::{
    build_route_statistics, find_nearest_edge, LocalOverrides, RouteResult,
};

pub const START_VNODE_ID: &str = "virtual-start";
pub const END_VNODE_ID: &str = "virtual-end";

/// Virtual routing configuration specifying temporary endpoints and linking edges.
#[derive(Debug, Clone)]
pub struct VirtualRoutingConfig {
    pub start_node: GraphNode,
    pub end_node: GraphNode,
    pub start_edges: Vec<GraphEdge>,
    pub end_virtual_edges: HashMap<String, GraphEdge>,
}

/// Result of projecting start and destination coordinates to temporary virtual endpoints.
pub struct PreparedVirtualEndpoints {
    pub virtual_config: VirtualRoutingConfig,
    pub start_proj: Coordinate,
    pub end_proj: Coordinate,
}

/// Prepares virtual start and end nodes on nearest graph edges.
pub fn setup_virtual_endpoints(
    graph: &StreetGraph,
    start: Coordinate,
    end: Coordinate,
) -> Option<PreparedVirtualEndpoints> {
    let (start_edge_ref, end_edge_ref) = match (find_nearest_edge(graph, start), find_nearest_edge(graph, end)) {
        (Some(s), Some(e)) => (s, e),
        _ => return None,
    };

    let start_proj = start_edge_ref.projected;
    let start_u_id = start_edge_ref.u_id;
    let start_v_id = start_edge_ref.v_id;
    let start_edge = start_edge_ref.edge;

    let end_proj = end_edge_ref.projected;
    let end_u_id = end_edge_ref.u_id;
    let end_v_id = end_edge_ref.v_id;
    let end_edge = end_edge_ref.edge;

    let (start_u, start_v, end_u, end_v) = match (
        graph.nodes.get(&start_u_id),
        graph.nodes.get(&start_v_id),
        graph.nodes.get(&end_u_id),
        graph.nodes.get(&end_v_id),
    ) {
        (Some(su), Some(sv), Some(eu), Some(ev)) => (su, sv, eu, ev),
        _ => return None,
    };

    let virtual_start_node = GraphNode {
        id: START_VNODE_ID.to_string(),
        lat: start_proj.lat,
        lng: start_proj.lng,
        tags: HashMap::new(),
    };

    let virtual_end_node = GraphNode {
        id: END_VNODE_ID.to_string(),
        lat: end_proj.lat,
        lng: end_proj.lng,
        tags: HashMap::new(),
    };

    let mut start_edges = Vec::new();
    let mut end_virtual_edges = HashMap::new();

    let dist_to_vs = haversine_distance(start_proj.lat, start_proj.lng, start_v.node.lat, start_v.node.lng);
    let dist_to_us = haversine_distance(start_proj.lat, start_proj.lng, start_u.node.lat, start_u.node.lng);

    start_edges.push(GraphEdge {
        target: start_v_id.clone(),
        distance: dist_to_vs,
        name: start_edge.name.clone(),
        speed_limit: start_edge.speed_limit,
        tags: start_edge.tags.clone(),
    });

    if let Some(entry) = graph.nodes.get(&start_v_id) {
        if let Some(edge_vu) = entry.edges.iter().find(|e| e.target == start_u_id) {
            start_edges.push(GraphEdge {
                target: start_u_id.clone(),
                distance: dist_to_us,
                name: edge_vu.name.clone(),
                speed_limit: edge_vu.speed_limit,
                tags: edge_vu.tags.clone(),
            });
        }
    }

    let dist_u_to_e = haversine_distance(end_u.node.lat, end_u.node.lng, end_proj.lat, end_proj.lng);
    let dist_v_to_e = haversine_distance(end_v.node.lat, end_v.node.lng, end_proj.lat, end_proj.lng);

    end_virtual_edges.insert(
        end_u_id.clone(),
        GraphEdge {
            target: END_VNODE_ID.to_string(),
            distance: dist_u_to_e,
            name: end_edge.name.clone(),
            speed_limit: end_edge.speed_limit,
            tags: end_edge.tags.clone(),
        },
    );

    if let Some(entry) = graph.nodes.get(&end_v_id) {
        if let Some(edge_vu) = entry.edges.iter().find(|e| e.target == end_u_id) {
            end_virtual_edges.insert(
                end_v_id.clone(),
                GraphEdge {
                    target: END_VNODE_ID.to_string(),
                    distance: dist_v_to_e,
                    name: edge_vu.name.clone(),
                    speed_limit: edge_vu.speed_limit,
                    tags: edge_vu.tags.clone(),
                },
            );
        }
    }

    let same_edge = (start_u_id == end_u_id && start_v_id == end_v_id)
        || (start_u_id == end_v_id && start_v_id == end_u_id);

    if same_edge {
        let u_coord = Coordinate { lat: start_u.node.lat, lng: start_u.node.lng };
        let v_coord = Coordinate { lat: start_v.node.lat, lng: start_v.node.lng };
        let ts = get_projection_t(start, u_coord, v_coord);
        let te = get_projection_t(end, u_coord, v_coord);

        if ts <= te {
            start_edges.push(GraphEdge {
                target: END_VNODE_ID.to_string(),
                distance: haversine_distance(start_proj.lat, start_proj.lng, end_proj.lat, end_proj.lng),
                name: start_edge.name.clone(),
                speed_limit: start_edge.speed_limit,
                tags: start_edge.tags.clone(),
            });
        }

        if ts >= te {
            if let Some(entry) = graph.nodes.get(&start_v_id) {
                if let Some(edge_vu) = entry.edges.iter().find(|e| e.target == start_u_id) {
                    start_edges.push(GraphEdge {
                        target: END_VNODE_ID.to_string(),
                        distance: haversine_distance(start_proj.lat, start_proj.lng, end_proj.lat, end_proj.lng),
                        name: edge_vu.name.clone(),
                        speed_limit: edge_vu.speed_limit,
                        tags: edge_vu.tags.clone(),
                    });
                }
            }
        }
    }

    let virtual_config = VirtualRoutingConfig {
        start_node: virtual_start_node,
        end_node: virtual_end_node,
        start_edges,
        end_virtual_edges,
    };

    Some(PreparedVirtualEndpoints {
        virtual_config,
        start_proj,
        end_proj,
    })
}

/// Assembles final RouteResult from virtual endpoint routing search.
pub fn finalize_virtual_route(
    graph: &StreetGraph,
    previous: &HashMap<String, String>,
    start: Coordinate,
    end: Coordinate,
    start_proj: Coordinate,
    end_proj: Coordinate,
    overrides: &LocalOverrides,
    virtual_config: &VirtualRoutingConfig,
) -> RouteResult {
    let stats = build_route_statistics(graph, previous, END_VNODE_ID, overrides, Some(virtual_config));

    let mut raw_coords = vec![start];
    raw_coords.extend(stats.coordinates);
    raw_coords.push(end);

    let mut final_coords: Vec<Coordinate> = Vec::new();
    for c in raw_coords {
        if let Some(last) = final_coords.last() {
            let dist2 = (c.lat - last.lat).powi(2) + (c.lng - last.lng).powi(2);
            if dist2 > 1e-14 {
                final_coords.push(c);
            }
        } else {
            final_coords.push(c);
        }
    }

    let start_interp_dist = haversine_distance(start.lat, start.lng, start_proj.lat, start_proj.lng);
    let end_interp_dist = haversine_distance(end.lat, end.lng, end_proj.lat, end_proj.lng);
    let total_distance_meters = stats.total_distance_meters + start_interp_dist + end_interp_dist;

    const INTERPOLATION_SPEED_MS: f64 = 1.5;
    let start_interp_dur = start_interp_dist / INTERPOLATION_SPEED_MS;
    let end_interp_dur = end_interp_dist / INTERPOLATION_SPEED_MS;
    let total_duration_seconds = stats.total_display_cost + start_interp_dur + end_interp_dur;

    RouteResult {
        path_node_ids: stats.path_node_ids,
        coordinates: final_coords,
        total_duration_seconds,
        total_distance_meters,
        streets: stats.streets,
        traffic_signals_count: stats.traffic_signals_count,
        yield_count: stats.yield_count,
        signal_count: stats.signal_count,
        crossing_count: stats.crossing_count,
        road_type_totals: stats.road_type_totals,
        surface_totals: stats.surface_totals,
        edges: Some(stats.edges),
    }
}

/// Builds a zero-duration route for identical start and destination nodes.
pub fn build_single_node_fallback_route(node: &GraphNode, node_id: String) -> RouteResult {
    let mut road_type_totals = HashMap::new();
    road_type_totals.insert("cycleway".to_string(), 0.0);
    road_type_totals.insert("residential".to_string(), 0.0);
    road_type_totals.insert("primary".to_string(), 0.0);
    road_type_totals.insert("other".to_string(), 0.0);

    let mut surface_totals = HashMap::new();
    surface_totals.insert("paved".to_string(), 0.0);
    surface_totals.insert("gravel".to_string(), 0.0);
    surface_totals.insert("cobblestone".to_string(), 0.0);

    RouteResult {
        path_node_ids: vec![node_id],
        coordinates: vec![Coordinate { lat: node.lat, lng: node.lng }],
        total_duration_seconds: 0.0,
        total_distance_meters: 0.0,
        streets: Vec::new(),
        traffic_signals_count: 0,
        yield_count: 0,
        signal_count: 0,
        crossing_count: 0,
        road_type_totals,
        surface_totals,
        edges: Some(Vec::new()),
    }
}

/// Finalizes fallback route between physical vertices with segment projections.
pub fn finalize_fallback_route(
    graph: &StreetGraph,
    previous: &HashMap<String, String>,
    start: Coordinate,
    end: Coordinate,
    end_node_id: &str,
    overrides: &LocalOverrides,
) -> RouteResult {
    let stats = build_route_statistics(graph, previous, end_node_id, overrides, None);

    let mut final_coords: Vec<Coordinate> = Vec::new();
    if stats.coordinates.len() >= 2 {
        let n0 = stats.coordinates[0];
        let n1 = stats.coordinates[1];
        let nk_1 = stats.coordinates[stats.coordinates.len() - 2];
        let nk = stats.coordinates[stats.coordinates.len() - 1];

        let proj_start = project_point_on_segment(start, n0, n1);
        let proj_end = project_point_on_segment(end, nk_1, nk);

        let mut adjusted = vec![start, proj_start];
        for i in 1..stats.coordinates.len() - 1 {
            adjusted.push(stats.coordinates[i]);
        }
        adjusted.push(proj_end);
        adjusted.push(end);

        for c in adjusted {
            if let Some(last) = final_coords.last() {
                let dist2 = (c.lat - last.lat).powi(2) + (c.lng - last.lng).powi(2);
                if dist2 > 1e-14 {
                    final_coords.push(c);
                }
            } else {
                final_coords.push(c);
            }
        }
    } else if stats.coordinates.len() == 1 {
        final_coords = vec![start, stats.coordinates[0], end];
    }

    RouteResult {
        path_node_ids: stats.path_node_ids,
        coordinates: final_coords,
        total_duration_seconds: stats.total_display_cost,
        total_distance_meters: stats.total_distance_meters,
        streets: stats.streets,
        traffic_signals_count: stats.traffic_signals_count,
        yield_count: stats.yield_count,
        signal_count: stats.signal_count,
        crossing_count: stats.crossing_count,
        road_type_totals: stats.road_type_totals,
        surface_totals: stats.surface_totals,
        edges: Some(stats.edges),
    }
}
