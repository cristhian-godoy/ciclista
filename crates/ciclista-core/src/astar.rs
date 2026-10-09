use std::collections::{BinaryHeap, HashMap};

use crate::geo::{
    get_projection_t, haversine_distance, project_point_on_segment, Coordinate,
};
use crate::graph::{GraphEdge, GraphNode, StreetGraph};
use crate::router::{
    build_route_statistics, find_nearest_edge, find_nearest_node, get_bike_impacts,
    get_crossing_turn_effect, get_effective_turn_penalty, HeapItem, LocalOverrides, RouteResult,
    VirtualRoutingConfig,
};

/// Computes an upper bound on maximum possible bicycle travel speed in m/s
/// to ensure that the Euclidean/Haversine heuristic is strictly admissible and consistent.
pub fn compute_max_travel_speed_ms(overrides: &LocalOverrides) -> f64 {
    let (cruising_speed_kmh, _, _) = get_bike_impacts(overrides.bike_config.as_ref());
    let mut max_speed_kmh = cruising_speed_kmh.max(30.0);

    if let Some(rules) = &overrides.rules_config {
        for sign_cfg in rules.signs.values() {
            if sign_cfg.base_speed_kmh > max_speed_kmh {
                max_speed_kmh = sign_cfg.base_speed_kmh;
            }
        }
        for road_cfg in rules.roads.values() {
            if road_cfg.base_speed_kmh > max_speed_kmh {
                max_speed_kmh = road_cfg.base_speed_kmh;
            }
        }
    }

    // High comfort multipliers (quiet-streets) scale cost down by up to 0.6 (equivalent to 1/0.6x speed).
    // Cycleway base speed may be 1.33x cruising speed.
    // Adding safety factor guarantees admissibility (h <= h*) and consistency across all profiles.
    let peak_speed_ms = (max_speed_kmh / 3.6) * 1.35;
    let min_cost_multiplier = 0.6;
    (peak_speed_ms / min_cost_multiplier) * 1.10
}

#[derive(Clone, Copy)]
enum MeetingPoint {
    Node(usize),
    Edge(usize, usize),
}

#[derive(Clone)]
struct IncomingEdge {
    source_int: usize,
    edge: GraphEdge,
}

/// Bidirectional A* ("Meet in the middle") router for bicycle networks.
/// Expands forward from origin and backward from destination simultaneously using
/// balanced consistent heuristics derived from geodesic haversine distance.
#[derive(Default)]
pub struct AStarRouter;

pub type BidirectionalAStarRouter = AStarRouter;

impl AStarRouter {
    pub fn new() -> Self {
        Self
    }

    fn get_forward_edges<'a>(
        u_id: &str,
        graph: &'a StreetGraph,
        virtual_config: Option<&'a VirtualRoutingConfig>,
    ) -> Vec<&'a GraphEdge> {
        if let Some(vc) = virtual_config {
            if u_id == "virtual-start" {
                vc.start_edges.iter().collect()
            } else if u_id == "virtual-end" {
                Vec::new()
            } else if let Some(entry) = graph.nodes.get(u_id) {
                let mut edges: Vec<&GraphEdge> = entry.edges.iter().collect();
                if let Some(extra) = vc.end_virtual_edges.get(u_id) {
                    edges.push(extra);
                }
                edges
            } else {
                Vec::new()
            }
        } else if let Some(entry) = graph.nodes.get(u_id) {
            entry.edges.iter().collect()
        } else {
            Vec::new()
        }
    }

    /// Executes bidirectional A* search with meet-in-the-middle stopping criteria.
    pub(crate) fn run_bidirectional_astar<F>(
        &self,
        graph: &StreetGraph,
        start_id: &str,
        end_id: &str,
        cost_fn: F,
        overrides: &LocalOverrides,
        virtual_config: Option<&VirtualRoutingConfig>,
    ) -> (bool, HashMap<String, String>)
    where
        F: Fn(&str, &GraphEdge, &str, &LocalOverrides, &StreetGraph) -> f64,
    {
        let turns_cfg = overrides
            .rules_config
            .as_ref()
            .map(|r| r.turns.clone())
            .unwrap_or_default();

        let n = graph.nodes.len() + if virtual_config.is_some() { 2 } else { 0 };
        let mut node_id_to_int: HashMap<String, usize> = HashMap::with_capacity(n);
        let mut int_to_node_id: Vec<String> = Vec::with_capacity(n);
        let mut coords: Vec<Coordinate> = Vec::with_capacity(n);

        let mut idx = 0;
        for (node_id, entry) in &graph.nodes {
            node_id_to_int.insert(node_id.clone(), idx);
            int_to_node_id.push(node_id.clone());
            coords.push(Coordinate {
                lat: entry.node.lat,
                lng: entry.node.lng,
            });
            idx += 1;
        }

        if let Some(vc) = virtual_config {
            if !node_id_to_int.contains_key(start_id) {
                node_id_to_int.insert(start_id.to_string(), idx);
                int_to_node_id.push(start_id.to_string());
                coords.push(Coordinate {
                    lat: vc.start_node.lat,
                    lng: vc.start_node.lng,
                });
                idx += 1;
            }
            if !node_id_to_int.contains_key(end_id) {
                node_id_to_int.insert(end_id.to_string(), idx);
                int_to_node_id.push(end_id.to_string());
                coords.push(Coordinate {
                    lat: vc.end_node.lat,
                    lng: vc.end_node.lng,
                });
            }
        }

        let start_int = match node_id_to_int.get(start_id) {
            Some(&i) => i,
            None => return (false, HashMap::new()),
        };
        let end_int = match node_id_to_int.get(end_id) {
            Some(&i) => i,
            None => return (false, HashMap::new()),
        };

        if start_int == end_int {
            return (true, HashMap::new());
        }

        let total_nodes = int_to_node_id.len();

        // Index reverse incoming edges for backward search
        let mut incoming_edges: Vec<Vec<IncomingEdge>> = vec![Vec::new(); total_nodes];
        for u in 0..total_nodes {
            let u_id = &int_to_node_id[u];
            let outgoing = Self::get_forward_edges(u_id, graph, virtual_config);
            for edge in outgoing {
                if let Some(&v) = node_id_to_int.get(&edge.target) {
                    incoming_edges[v].push(IncomingEdge {
                        source_int: u,
                        edge: edge.clone(),
                    });
                }
            }
        }

        let v_max = compute_max_travel_speed_ms(overrides);
        let start_coord = coords[start_int];
        let end_coord = coords[end_int];
        let h_st = haversine_distance(start_coord.lat, start_coord.lng, end_coord.lat, end_coord.lng) / v_max;

        let h_f = |i: usize| -> f64 {
            haversine_distance(coords[i].lat, coords[i].lng, end_coord.lat, end_coord.lng) / v_max
        };

        let h_b = |i: usize| -> f64 {
            haversine_distance(coords[i].lat, coords[i].lng, start_coord.lat, start_coord.lng) / v_max
        };

        // Consistent bidirectional potential keys (Ikeda et al. / Goldberg & Harrelson)
        let key_f = |i: usize, dist: f64| -> f64 {
            dist + (h_f(i) - h_b(i) - h_st) / 2.0
        };

        let key_b = |i: usize, dist: f64| -> f64 {
            dist + (h_b(i) - h_f(i) - h_st) / 2.0
        };

        let get_node_ref = |i: usize| -> Option<&GraphNode> {
            let id = &int_to_node_id[i];
            if let Some(vc) = virtual_config {
                if id == "virtual-start" {
                    return Some(&vc.start_node);
                } else if id == "virtual-end" {
                    return Some(&vc.end_node);
                }
            }
            graph.nodes.get(id).map(|e| &e.node)
        };

        let compute_turn_penalty = |parent_idx: isize, curr_idx: usize, next_idx: isize| -> f64 {
            if parent_idx < 0 || next_idx < 0 {
                return 0.0;
            }
            let p_node = get_node_ref(parent_idx as usize);
            let c_node = get_node_ref(curr_idx);
            let n_node = get_node_ref(next_idx as usize);
            if let (Some(p), Some(c), Some(n)) = (p_node, c_node, n_node) {
                get_effective_turn_penalty(p, c, n, overrides, &turns_cfg)
            } else {
                0.0
            }
        };

        let mut dist_f = vec![f64::INFINITY; total_nodes];
        let mut parent_f = vec![-1isize; total_nodes];
        let mut closed_f = vec![false; total_nodes];
        let mut heap_f = BinaryHeap::new();

        let mut dist_b = vec![f64::INFINITY; total_nodes];
        let mut succ_b = vec![-1isize; total_nodes];
        let mut closed_b = vec![false; total_nodes];
        let mut heap_b = BinaryHeap::new();

        dist_f[start_int] = 0.0;
        heap_f.push(HeapItem {
            cost: key_f(start_int, 0.0),
            node: start_int,
        });

        dist_b[end_int] = 0.0;
        heap_b.push(HeapItem {
            cost: key_b(end_int, 0.0),
            node: end_int,
        });

        let mut mu = f64::INFINITY;
        let mut best_meeting: Option<MeetingPoint> = None;

        while let (Some(top_f_item), Some(top_b_item)) = (heap_f.peek(), heap_b.peek()) {
            let top_f = top_f_item.cost;
            let top_b = top_b_item.cost;

            // Stopping condition: when minimum keys sum exceeds best found path cost
            if top_f + top_b + h_st >= mu {
                break;
            }

            if top_f <= top_b {
                let HeapItem { cost: curr_k, node: u } = heap_f.pop().unwrap();
                if closed_f[u] {
                    continue;
                }
                if curr_k > key_f(u, dist_f[u]) + 1e-9 {
                    continue;
                }
                closed_f[u] = true;

                let u_id = &int_to_node_id[u];

                // Check meeting at node u
                if dist_b[u] < f64::INFINITY {
                    let parent_id_str = if parent_f[u] != -1 {
                        Some(int_to_node_id[parent_f[u] as usize].as_str())
                    } else {
                        None
                    };
                    let succ_id_str = if succ_b[u] != -1 {
                        Some(int_to_node_id[succ_b[u] as usize].as_str())
                    } else {
                        None
                    };
                    let (banned, node_delta) = match (parent_id_str, succ_id_str) {
                        (Some(p), Some(s)) => get_crossing_turn_effect(Some(p), u_id, s, overrides),
                        _ => (false, 0.0),
                    };
                    if !banned {
                        let mut cand_cost = dist_f[u] + dist_b[u] + node_delta;
                        if parent_f[u] != -1 && succ_b[u] != -1 {
                            cand_cost += compute_turn_penalty(parent_f[u], u, succ_b[u]);
                        }
                        if cand_cost < mu {
                            mu = cand_cost;
                            best_meeting = Some(MeetingPoint::Node(u));
                        }
                    }
                }

                let current_edges = Self::get_forward_edges(u_id, graph, virtual_config);
                for edge in current_edges {
                    let Some(&v) = node_id_to_int.get(&edge.target) else { continue };
                    if closed_f[v] {
                        continue;
                    }
                    let v_id = &int_to_node_id[v];

                    let mut step_cost = cost_fn(u_id, edge, v_id, overrides, graph);
                    if parent_f[u] != -1 {
                        step_cost += compute_turn_penalty(parent_f[u], u, v as isize);
                    }

                    let parent_id_str = if parent_f[u] != -1 {
                        Some(int_to_node_id[parent_f[u] as usize].as_str())
                    } else {
                        None
                    };
                    let (is_banned, crossing_delta) = get_crossing_turn_effect(
                        parent_id_str,
                        u_id,
                        v_id,
                        overrides,
                    );
                    if is_banned {
                        continue;
                    }
                    step_cost += crossing_delta;

                    // Check meeting across edge u -> v
                    if dist_b[v] < f64::INFINITY {
                        let succ_id_str = if succ_b[v] != -1 {
                            Some(int_to_node_id[succ_b[v] as usize].as_str())
                        } else {
                            None
                        };
                        let (banned, edge_delta) = match succ_id_str {
                            Some(s) => get_crossing_turn_effect(Some(u_id), v_id, s, overrides),
                            None => (false, 0.0),
                        };
                        if !banned {
                            let mut edge_meeting_cost = dist_f[u] + step_cost + dist_b[v] + edge_delta;
                            if succ_b[v] != -1 {
                                edge_meeting_cost += compute_turn_penalty(u as isize, v, succ_b[v]);
                            }
                            if edge_meeting_cost < mu {
                                mu = edge_meeting_cost;
                                best_meeting = Some(MeetingPoint::Edge(u, v));
                            }
                        }
                    }

                    let new_dist = dist_f[u] + step_cost;
                    if new_dist < dist_f[v] {
                        dist_f[v] = new_dist;
                        parent_f[v] = u as isize;
                        heap_f.push(HeapItem {
                            cost: key_f(v, new_dist),
                            node: v,
                        });
                    }
                }
            } else {
                let HeapItem { cost: curr_k, node: v } = heap_b.pop().unwrap();
                if closed_b[v] {
                    continue;
                }
                if curr_k > key_b(v, dist_b[v]) + 1e-9 {
                    continue;
                }
                closed_b[v] = true;

                let v_id = &int_to_node_id[v];

                // Check meeting at node v
                if dist_f[v] < f64::INFINITY {
                    let parent_id_str = if parent_f[v] != -1 {
                        Some(int_to_node_id[parent_f[v] as usize].as_str())
                    } else {
                        None
                    };
                    let succ_id_str = if succ_b[v] != -1 {
                        Some(int_to_node_id[succ_b[v] as usize].as_str())
                    } else {
                        None
                    };
                    let (banned, node_delta) = match (parent_id_str, succ_id_str) {
                        (Some(p), Some(s)) => get_crossing_turn_effect(Some(p), v_id, s, overrides),
                        _ => (false, 0.0),
                    };
                    if !banned {
                        let mut cand_cost = dist_f[v] + dist_b[v] + node_delta;
                        if parent_f[v] != -1 && succ_b[v] != -1 {
                            cand_cost += compute_turn_penalty(parent_f[v], v, succ_b[v]);
                        }
                        if cand_cost < mu {
                            mu = cand_cost;
                            best_meeting = Some(MeetingPoint::Node(v));
                        }
                    }
                }

                // Expand incoming edges into v (stepping backward from v to u)
                for in_edge in &incoming_edges[v] {
                    let u = in_edge.source_int;
                    if closed_b[u] {
                        continue;
                    }
                    let u_id = &int_to_node_id[u];

                    let mut step_cost = cost_fn(u_id, &in_edge.edge, v_id, overrides, graph);
                    if succ_b[v] != -1 {
                        step_cost += compute_turn_penalty(u as isize, v, succ_b[v]);
                    }

                    let (is_banned, delta) = get_crossing_turn_effect(None, u_id, v_id, overrides);
                    if is_banned {
                        continue;
                    }
                    step_cost += delta;

                    if succ_b[v] != -1 {
                        let succ_id_str = &int_to_node_id[succ_b[v] as usize];
                        let (turn_banned, turn_delta) =
                            get_crossing_turn_effect(Some(u_id), v_id, succ_id_str, overrides);
                        if turn_banned {
                            continue;
                        }
                        step_cost += turn_delta;
                    }

                    // Check meeting across edge u -> v
                    if dist_f[u] < f64::INFINITY {
                        let parent_id_str = if parent_f[u] != -1 {
                            Some(int_to_node_id[parent_f[u] as usize].as_str())
                        } else {
                            None
                        };
                        let (banned, edge_delta) = match parent_id_str {
                            Some(p) => get_crossing_turn_effect(Some(p), u_id, v_id, overrides),
                            None => (false, 0.0),
                        };
                        if !banned {
                            let mut edge_meeting_cost = dist_f[u] + step_cost + dist_b[v] + edge_delta;
                            if parent_f[u] != -1 {
                                edge_meeting_cost += compute_turn_penalty(parent_f[u], u, v as isize);
                            }
                            if edge_meeting_cost < mu {
                                mu = edge_meeting_cost;
                                best_meeting = Some(MeetingPoint::Edge(u, v));
                            }
                        }
                    }

                    let new_dist = dist_b[v] + step_cost;
                    if new_dist < dist_b[u] {
                        dist_b[u] = new_dist;
                        succ_b[u] = v as isize;
                        heap_b.push(HeapItem {
                            cost: key_b(u, new_dist),
                            node: u,
                        });
                    }
                }
            }
        }

        let meeting = match best_meeting {
            Some(m) if mu < f64::INFINITY => m,
            _ => return (false, HashMap::new()),
        };

        let mut path_ints: Vec<usize> = Vec::new();

        match meeting {
            MeetingPoint::Node(m) => {
                let mut forward_path = Vec::new();
                let mut curr = m as isize;
                while curr != -1 {
                    forward_path.push(curr as usize);
                    if curr == start_int as isize {
                        break;
                    }
                    curr = parent_f[curr as usize];
                }
                forward_path.reverse();
                path_ints.extend(forward_path);

                let mut curr = succ_b[m];
                while curr != -1 {
                    path_ints.push(curr as usize);
                    if curr == end_int as isize {
                        break;
                    }
                    curr = succ_b[curr as usize];
                }
            }
            MeetingPoint::Edge(u, v) => {
                let mut forward_path = Vec::new();
                let mut curr = u as isize;
                while curr != -1 {
                    forward_path.push(curr as usize);
                    if curr == start_int as isize {
                        break;
                    }
                    curr = parent_f[curr as usize];
                }
                forward_path.reverse();
                path_ints.extend(forward_path);

                let mut curr = v as isize;
                while curr != -1 {
                    path_ints.push(curr as usize);
                    if curr == end_int as isize {
                        break;
                    }
                    curr = succ_b[curr as usize];
                }
            }
        }

        let mut previous = HashMap::new();
        for i in 1..path_ints.len() {
            let from_id = &int_to_node_id[path_ints[i - 1]];
            let to_id = &int_to_node_id[path_ints[i]];
            previous.insert(to_id.clone(), from_id.clone());
        }

        (true, previous)
    }

    /// Evaluates optimal path routing using Bidirectional A* with snapping and virtual edge projection.
    pub fn find_route<F>(
        &self,
        graph: &StreetGraph,
        start: Coordinate,
        end: Coordinate,
        cost_fn: F,
        overrides: &LocalOverrides,
    ) -> Option<RouteResult>
    where
        F: Fn(&str, &GraphEdge, &str, &LocalOverrides, &StreetGraph) -> f64,
    {
        let start_edge_ref = find_nearest_edge(graph, start);
        let end_edge_ref = find_nearest_edge(graph, end);

        let (start_edge_ref, end_edge_ref) = match (start_edge_ref, end_edge_ref) {
            (Some(s), Some(e)) => (s, e),
            _ => return self.find_route_node_fallback(graph, start, end, cost_fn, overrides),
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
            _ => return self.find_route_node_fallback(graph, start, end, cost_fn, overrides),
        };

        const START_VNODE_ID: &str = "virtual-start";
        const END_VNODE_ID: &str = "virtual-end";

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

        let (dest_reached, previous) = self.run_bidirectional_astar(
            graph,
            START_VNODE_ID,
            END_VNODE_ID,
            cost_fn,
            overrides,
            Some(&virtual_config),
        );

        if !dest_reached {
            return None;
        }

        let stats = build_route_statistics(graph, &previous, END_VNODE_ID, overrides, Some(&virtual_config));

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

        Some(RouteResult {
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
        })
    }

    /// Fallback route finder using direct node snapping.
    pub fn find_route_node_fallback<F>(
        &self,
        graph: &StreetGraph,
        start: Coordinate,
        end: Coordinate,
        cost_fn: F,
        overrides: &LocalOverrides,
    ) -> Option<RouteResult>
    where
        F: Fn(&str, &GraphEdge, &str, &LocalOverrides, &StreetGraph) -> f64,
    {
        let start_node_id = find_nearest_node(graph, start)?;
        let end_node_id = find_nearest_node(graph, end)?;

        if start_node_id == end_node_id {
            let start_node = &graph.nodes.get(&start_node_id)?.node;
            let mut road_type_totals = HashMap::new();
            road_type_totals.insert("cycleway".to_string(), 0.0);
            road_type_totals.insert("residential".to_string(), 0.0);
            road_type_totals.insert("primary".to_string(), 0.0);
            road_type_totals.insert("other".to_string(), 0.0);

            let mut surface_totals = HashMap::new();
            surface_totals.insert("paved".to_string(), 0.0);
            surface_totals.insert("gravel".to_string(), 0.0);
            surface_totals.insert("cobblestone".to_string(), 0.0);

            return Some(RouteResult {
                path_node_ids: vec![start_node_id],
                coordinates: vec![Coordinate { lat: start_node.lat, lng: start_node.lng }],
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
            });
        }

        let (dest_reached, previous) = self.run_bidirectional_astar(
            graph,
            &start_node_id,
            &end_node_id,
            cost_fn,
            overrides,
            None,
        );

        if !dest_reached {
            return None;
        }

        let stats = build_route_statistics(graph, &previous, &end_node_id, overrides, None);

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

        Some(RouteResult {
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
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;
    use crate::parser::load_mock_graph;
    use crate::router::{
        avoid_stops_cost, quiet_streets_cost, standard_cost, DijkstraRouter,
    };

    #[test]
    fn test_astar_mock_graph() {
        let graph = load_mock_graph();
        let router = AStarRouter::new();
        let overrides = LocalOverrides::default();

        let start = Coordinate { lat: 48.13715, lng: 11.5754 }; // Marienplatz (Node 1)
        let end = Coordinate { lat: 48.135, lng: 11.582 }; // Isartor (Node 5)

        let result = router.find_route(&graph, start, end, standard_cost, &overrides);
        assert!(result.is_some(), "A* routing result should not be None");

        let route = result.unwrap();
        assert!(route.total_distance_meters > 100.0);
        assert!(route.total_duration_seconds > 0.0);
        assert!(route.coordinates.len() >= 2);
    }

    #[test]
    fn test_astar_dijkstra_parity_all_strategies() {
        let graph = load_mock_graph();
        let astar = AStarRouter::new();
        let dijkstra = DijkstraRouter::new();
        let overrides = LocalOverrides::default();

        let start = Coordinate { lat: 48.13715, lng: 11.5754 };
        let end = Coordinate { lat: 48.135, lng: 11.582 };

        // 1. Standard
        let astar_std = astar.find_route(&graph, start, end, standard_cost, &overrides).unwrap();
        let dijk_std = dijkstra.find_route(&graph, start, end, standard_cost, &overrides).unwrap();
        assert!((astar_std.total_distance_meters - dijk_std.total_distance_meters).abs() < 1e-3);
        assert!((astar_std.total_duration_seconds - dijk_std.total_duration_seconds).abs() < 1e-3);
        assert_eq!(astar_std.path_node_ids, dijk_std.path_node_ids);

        // 2. Avoid stops
        let astar_stops = astar.find_route(&graph, start, end, avoid_stops_cost, &overrides).unwrap();
        let dijk_stops = dijkstra.find_route(&graph, start, end, avoid_stops_cost, &overrides).unwrap();
        assert!((astar_stops.total_distance_meters - dijk_stops.total_distance_meters).abs() < 1e-3);
        assert!((astar_stops.total_duration_seconds - dijk_stops.total_duration_seconds).abs() < 1e-3);
        assert_eq!(astar_stops.path_node_ids, dijk_stops.path_node_ids);

        // 3. Quiet streets
        let astar_quiet = astar.find_route(&graph, start, end, quiet_streets_cost, &overrides).unwrap();
        let dijk_quiet = dijkstra.find_route(&graph, start, end, quiet_streets_cost, &overrides).unwrap();
        assert!((astar_quiet.total_distance_meters - dijk_quiet.total_distance_meters).abs() < 1e-3);
        assert!((astar_quiet.total_duration_seconds - dijk_quiet.total_duration_seconds).abs() < 1e-3);
        assert_eq!(astar_quiet.path_node_ids, dijk_quiet.path_node_ids);
    }

    #[test]
    fn test_astar_blocked_edge_penalty() {
        let graph = load_mock_graph();
        let router = AStarRouter::new();

        let mut overrides = LocalOverrides::default();
        let start = Coordinate { lat: 48.13715, lng: 11.5754 };
        let end = Coordinate { lat: 48.135, lng: 11.582 };

        let clean_res = router.find_route(&graph, start, end, standard_cost, &overrides).unwrap();

        let mut blocked = HashSet::new();
        blocked.insert("1->2".to_string());
        overrides.blocked_edges = Some(blocked);

        let blocked_res = router.find_route(&graph, start, end, standard_cost, &overrides).unwrap();
        assert!(blocked_res.total_duration_seconds >= clean_res.total_duration_seconds);
    }

    #[test]
    fn test_astar_unreachable() {
        let mut disjoint_graph = StreetGraph::new();
        disjoint_graph.nodes.insert(
            "1".to_string(),
            crate::graph::NodeEntry {
                node: GraphNode { id: "1".to_string(), lat: 48.1, lng: 11.1, tags: HashMap::new() },
                edges: Vec::new(),
            },
        );
        disjoint_graph.nodes.insert(
            "2".to_string(),
            crate::graph::NodeEntry {
                node: GraphNode { id: "2".to_string(), lat: 48.2, lng: 11.2, tags: HashMap::new() },
                edges: Vec::new(),
            },
        );

        let router = AStarRouter::new();
        let overrides = LocalOverrides::default();
        let res = router.find_route(
            &disjoint_graph,
            Coordinate { lat: 48.1, lng: 11.1 },
            Coordinate { lat: 48.2, lng: 11.2 },
            standard_cost,
            &overrides,
        );
        assert!(res.is_none());
    }

    #[test]
    fn test_astar_crossing_turn_penalty() {
        let graph = load_mock_graph();
        let router = AStarRouter::new();
        let mut overrides = LocalOverrides::default();

        let start = Coordinate { lat: 48.13715, lng: 11.5754 };
        let end = Coordinate { lat: 48.135, lng: 11.582 };

        let clean_res = router.find_route(&graph, start, end, standard_cost, &overrides).unwrap();

        let turn_override = crate::router::CrossingTurnOverride {
            id: "turn-1".to_string(),
            crossing_id: "cluster-1".to_string(),
            from_node_id: "1".to_string(),
            to_node_id: "2".to_string(),
            path_node_ids: Some(vec!["1".to_string(), "2".to_string()]),
            time_delta_seconds: 30.0,
            banned: false,
            turn_type: "direct".to_string(),
            description: None,
            created_at: None,
        };
        overrides.crossing_turns = Some(vec![turn_override]);

        let penalized_res = router.find_route(&graph, start, end, standard_cost, &overrides).unwrap();
        assert!(penalized_res.total_duration_seconds > clean_res.total_duration_seconds);
    }
}

