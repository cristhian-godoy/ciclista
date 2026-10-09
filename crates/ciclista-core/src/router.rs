use std::cmp::Ordering;
use std::collections::{BinaryHeap, HashMap, HashSet};
use serde::{Deserialize, Serialize};

use crate::geo::{
    get_projection_t, haversine_distance, project_point_on_segment, Coordinate,
};
use crate::graph::{GraphEdge, GraphNode, StreetGraph};
use crate::rules::{
    get_surface_type, has_cycleway, map_osm_node_to_control, map_osm_to_sign_and_road,
    InfrastructureType,
};

fn default_18() -> f64 { 18.0 }
fn default_15() -> f64 { 15.0 }
fn default_8() -> f64 { 8.0 }
fn default_4() -> f64 { 4.0 }
fn default_3() -> f64 { 3.0 }
fn default_1() -> f64 { 1.0 }
fn default_30() -> f64 { 30.0 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignRuleConfig {
    #[serde(rename = "signId")]
    pub sign_id: String,
    #[serde(default)]
    pub name: String,
    #[serde(rename = "baseSpeedKmh", default = "default_18")]
    pub base_speed_kmh: f64,
    #[serde(rename = "speedType")]
    pub speed_type: Option<String>,
    #[serde(rename = "flatPenaltySeconds", default)]
    pub flat_penalty_seconds: f64,
    pub comfort: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoadRuleConfig {
    #[serde(rename = "roadId")]
    pub road_id: String,
    #[serde(default)]
    pub name: String,
    #[serde(rename = "baseSpeedKmh", default = "default_18")]
    pub base_speed_kmh: f64,
    #[serde(rename = "speedType")]
    pub speed_type: Option<String>,
    #[serde(rename = "flatPenaltySeconds", default)]
    pub flat_penalty_seconds: f64,
    pub comfort: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeDelayConfig {
    #[serde(rename = "signalSeconds", default = "default_15")]
    pub signal_seconds: f64,
    #[serde(rename = "yieldSeconds", default = "default_3")]
    pub yield_seconds: f64,
    #[serde(rename = "stopSeconds", default = "default_8")]
    pub stop_seconds: f64,
    #[serde(rename = "crossingSeconds", default = "default_3")]
    pub crossing_seconds: f64,
}

impl Default for NodeDelayConfig {
    fn default() -> Self {
        Self {
            signal_seconds: 15.0,
            yield_seconds: 3.0,
            stop_seconds: 8.0,
            crossing_seconds: 3.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurnRuleConfig {
    #[serde(rename = "rightTurnPenaltySeconds", default = "default_1")]
    pub right_turn_penalty_seconds: f64,
    #[serde(rename = "leftTurnPenaltySeconds", default = "default_4")]
    pub left_turn_penalty_seconds: f64,
    #[serde(rename = "greenArrowRightTurnSeconds", default)]
    pub green_arrow_right_turn_seconds: f64,
    #[serde(rename = "indirectLeftTurnSeconds", default = "default_15")]
    pub indirect_left_turn_seconds: f64,
    #[serde(rename = "uTurnPenaltySeconds", default = "default_30")]
    pub u_turn_penalty_seconds: f64,
}

impl Default for TurnRuleConfig {
    fn default() -> Self {
        Self {
            right_turn_penalty_seconds: 1.0,
            left_turn_penalty_seconds: 4.0,
            green_arrow_right_turn_seconds: 0.0,
            indirect_left_turn_seconds: 15.0,
            u_turn_penalty_seconds: 30.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RulesConfiguration {
    #[serde(default)]
    pub signs: HashMap<String, SignRuleConfig>,
    #[serde(default)]
    pub roads: HashMap<String, RoadRuleConfig>,
    #[serde(rename = "nodeDelays", default)]
    pub node_delays: NodeDelayConfig,
    #[serde(default)]
    pub turns: TurnRuleConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BikeConfig {
    pub id: String,
    #[serde(rename = "customSpeedKmh", skip_serializing_if = "Option::is_none")]
    pub custom_speed_kmh: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MapEventEffect {
    #[serde(rename = "type")]
    pub effect_type: String,
    #[serde(rename = "penaltySeconds", default)]
    pub penalty_seconds: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MapEvent {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub active: bool,
    #[serde(rename = "edgeIds", default)]
    pub edge_ids: Vec<String>,
    pub effect: MapEventEffect,
    #[serde(rename = "createdAt", default)]
    pub created_at: f64,
}

fn deserialize_blocked_edges<'de, D>(deserializer: D) -> Result<Option<HashSet<String>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum SetOrVec {
        Set(HashSet<String>),
        Vec(Vec<String>),
    }

    let opt = Option::<SetOrVec>::deserialize(deserializer)?;
    Ok(opt.map(|item| match item {
        SetOrVec::Set(s) => s,
        SetOrVec::Vec(v) => v.into_iter().collect(),
    }))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrossingTurnOverride {
    pub id: String,
    #[serde(rename = "crossingId")]
    pub crossing_id: String,
    #[serde(rename = "fromNodeId")]
    pub from_node_id: String,
    #[serde(rename = "toNodeId")]
    pub to_node_id: String,
    #[serde(rename = "pathNodeIds", skip_serializing_if = "Option::is_none")]
    pub path_node_ids: Option<Vec<String>>,
    #[serde(rename = "timeDeltaSeconds", default)]
    pub time_delta_seconds: f64,
    #[serde(default)]
    pub banned: bool,
    #[serde(rename = "turnType", default)]
    pub turn_type: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub description: Option<String>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none", default)]
    pub created_at: Option<f64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LocalOverrides {
    #[serde(rename = "nodeDelays", default)]
    pub node_delays: HashMap<String, f64>,
    #[serde(rename = "nodeNotes", default)]
    pub node_notes: HashMap<String, String>,
    #[serde(rename = "nodeTurns", default)]
    pub node_turns: HashMap<String, HashMap<String, String>>,
    #[serde(rename = "crossingTurns", skip_serializing_if = "Option::is_none", default)]
    pub crossing_turns: Option<Vec<CrossingTurnOverride>>,
    #[serde(rename = "rulesConfig", skip_serializing_if = "Option::is_none")]
    pub rules_config: Option<RulesConfiguration>,
    #[serde(rename = "bikeConfig", skip_serializing_if = "Option::is_none")]
    pub bike_config: Option<BikeConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub events: Option<Vec<MapEvent>>,
    #[serde(
        rename = "blockedEdges",
        default,
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_blocked_edges"
    )]
    pub blocked_edges: Option<HashSet<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteEdgeDetail {
    #[serde(rename = "sourceId")]
    pub source_id: String,
    #[serde(rename = "targetId")]
    pub target_id: String,
    pub name: String,
    pub distance: f64,
    pub highway: String,
    pub tags: HashMap<String, String>,
    pub cost: f64,
    #[serde(rename = "matchedSign")]
    pub matched_sign: Option<String>,
    #[serde(rename = "matchedRoad")]
    pub matched_road: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteResult {
    #[serde(rename = "pathNodeIds")]
    pub path_node_ids: Vec<String>,
    pub coordinates: Vec<Coordinate>,
    #[serde(rename = "totalDurationSeconds")]
    pub total_duration_seconds: f64,
    #[serde(rename = "totalDistanceMeters")]
    pub total_distance_meters: f64,
    pub streets: Vec<String>,
    #[serde(rename = "trafficSignalsCount")]
    pub traffic_signals_count: usize,
    #[serde(rename = "yieldCount")]
    pub yield_count: usize,
    #[serde(rename = "signalCount")]
    pub signal_count: usize,
    #[serde(rename = "crossingCount")]
    pub crossing_count: usize,
    #[serde(rename = "roadTypeTotals")]
    pub road_type_totals: HashMap<String, f64>,
    #[serde(rename = "surfaceTotals")]
    pub surface_totals: HashMap<String, f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edges: Option<Vec<RouteEdgeDetail>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategyRouteVariant {
    pub label: String,
    pub result: RouteResult,
}

pub fn get_crossing_turn_effect(
    parent_id: Option<&str>,
    current_id: &str,
    next_id: &str,
    overrides: &LocalOverrides,
) -> (bool, f64) {
    let Some(turns) = &overrides.crossing_turns else {
        return (false, 0.0);
    };

    let mut cumulative_delta = 0.0;

    for turn in turns {
        let mut matches = false;
        let mut applies_delta = false;

        if let Some(path) = &turn.path_node_ids {
            if path.len() == 2 {
                if current_id == path[0] && next_id == path[1] {
                    matches = true;
                    applies_delta = true;
                }
            } else if path.len() == 3 {
                if parent_id == Some(path[0].as_str())
                    && current_id == path[1]
                    && next_id == path[2]
                {
                    matches = true;
                    applies_delta = true;
                }
            } else if path.len() > 3 {
                for i in 0..path.len() - 1 {
                    if current_id == path[i] && next_id == path[i + 1] {
                        matches = true;
                        break;
                    }
                }
                if current_id == path[path.len() - 2] && next_id == path[path.len() - 1] {
                    applies_delta = true;
                }
            }
        } else {
            if current_id == turn.from_node_id && next_id == turn.to_node_id {
                matches = true;
                applies_delta = true;
            } else if parent_id == Some(turn.from_node_id.as_str()) && next_id == turn.to_node_id {
                matches = true;
                applies_delta = true;
            }
        }

        if matches && turn.banned {
            return (true, 0.0);
        }

        if applies_delta && turn.time_delta_seconds.abs() > 1e-9 {
            cumulative_delta += turn.time_delta_seconds;
        }
    }

    (false, cumulative_delta)
}

pub fn is_edge_blocked(source_id: &str, target_id: &str, overrides: Option<&LocalOverrides>) -> bool {
    let Some(overrides) = overrides else { return false; };

    if let Some(turns) = &overrides.crossing_turns {
        for turn in turns {
            if turn.banned {
                if turn.from_node_id == source_id && turn.to_node_id == target_id {
                    return true;
                }
                if let Some(path) = &turn.path_node_ids {
                    if path.len() == 2 && path[0] == source_id && path[1] == target_id {
                        return true;
                    }
                }
            }
        }
    }

    let key1 = format!("{}->{}", source_id, target_id);
    let key2 = format!("{}->{}", target_id, source_id);

    if let Some(blocked) = &overrides.blocked_edges {
        if blocked.contains(&key1) || blocked.contains(&key2) {
            return true;
        }
    }

    if let Some(events) = &overrides.events {
        for event in events {
            if event.active && event.effect.effect_type == "road_blockage" {
                if event.edge_ids.iter().any(|id| id == &key1 || id == &key2) {
                    return true;
                }
            }
        }
    }

    false
}

pub(crate) struct SurfaceModifier {
    pub(crate) speed_multiplier: f64,
    pub(crate) flat_penalty: f64,
}

pub(crate) fn get_bike_impacts(config: Option<&BikeConfig>) -> (f64, SurfaceModifier, SurfaceModifier) {
    let id = config.map(|c| c.id.as_str()).unwrap_or("normal");
    let speed = config
        .and_then(|c| c.custom_speed_kmh)
        .unwrap_or_else(|| match id {
            "road" => 30.0,
            "ebike" => 25.0,
            "slow" => 15.0,
            _ => 18.0,
        });

    let (gravel, cobblestone) = match id {
        "road" => (
            SurfaceModifier { speed_multiplier: 0.4, flat_penalty: 15.0 },
            SurfaceModifier { speed_multiplier: 0.6, flat_penalty: 10.0 },
        ),
        "slow" | "ebike" => (
            SurfaceModifier { speed_multiplier: 0.9, flat_penalty: 0.0 },
            SurfaceModifier { speed_multiplier: 0.85, flat_penalty: 0.0 },
        ),
        _ => (
            SurfaceModifier { speed_multiplier: 0.8, flat_penalty: 0.0 },
            SurfaceModifier { speed_multiplier: 0.75, flat_penalty: 0.0 },
        ),
    };

    (speed, gravel, cobblestone)
}

fn resolve_speed_type_to_ms(speed_type: &str, base_speed_kmh: f64, cruising_speed_kmh: f64) -> f64 {
    let kmh = match speed_type {
        "relative" => cruising_speed_kmh,
        "slow" => 15.0,
        "slower" => 10.0,
        "dismount" => 4.0,
        _ => base_speed_kmh,
    };
    kmh / 3.6
}

pub fn resolve_speed_and_penalty(
    edge: &GraphEdge,
    overrides: &LocalOverrides,
) -> (f64, f64, bool) {
    let highway = edge.tags.get("highway").map(|s| s.as_str()).unwrap_or("");
    let rule_match = map_osm_to_sign_and_road(highway, &edge.tags);
    let (cruising_speed_kmh, gravel_mod, cobblestone_mod) = get_bike_impacts(overrides.bike_config.as_ref());

    let (mut speed, mut flat_penalty) = if let Some(rules) = &overrides.rules_config {
        if let Some(sign) = rule_match.sign {
            if let Some(cfg) = rules.signs.get(sign.as_str()) {
                let speed_type = cfg.speed_type.as_deref().unwrap_or_else(|| match sign {
                    InfrastructureType::SegregatedPath
                    | InfrastructureType::BicycleStreet
                    | InfrastructureType::LivingStreet => "relative",
                    InfrastructureType::PedestrianZone | InfrastructureType::Sidewalk => "dismount",
                    _ => "custom",
                });
                (
                    resolve_speed_type_to_ms(speed_type, cfg.base_speed_kmh, cruising_speed_kmh),
                    cfg.flat_penalty_seconds,
                )
            } else {
                (cruising_speed_kmh / 3.6, 0.0)
            }
        } else if let Some(cfg) = rules.roads.get(rule_match.road.as_str()) {
            let speed_type = cfg.speed_type.as_deref().unwrap_or("custom");
            (
                resolve_speed_type_to_ms(speed_type, cfg.base_speed_kmh, cruising_speed_kmh),
                cfg.flat_penalty_seconds,
            )
        } else {
            (cruising_speed_kmh / 3.6, 0.0)
        }
    } else {
        let base_speed = if has_cycleway(&edge.tags) {
            5.5
        } else if highway == "cycleway" {
            6.0
        } else if matches!(highway, "footway" | "pedestrian" | "path") {
            if rule_match.bicycle_frei { 4.5 } else { 1.2 }
        } else if highway == "service" {
            let srv = edge.tags.get("service").map(|s| s.as_str()).unwrap_or("");
            if srv == "parking_aisle" || srv == "driveway" { 1.5 } else { 3.0 }
        } else if highway == "primary" {
            4.0
        } else if highway == "secondary" {
            4.5
        } else if highway == "residential" {
            4.8
        } else if highway == "living_street" {
            4.0
        } else {
            5.0
        };
        (base_speed * (cruising_speed_kmh / 18.0), 0.0)
    };

    let surface_type = get_surface_type(&edge.tags);
    if surface_type == "gravel" {
        speed *= gravel_mod.speed_multiplier;
        flat_penalty += gravel_mod.flat_penalty;
    } else if surface_type == "cobblestone" {
        speed *= cobblestone_mod.speed_multiplier;
        flat_penalty += cobblestone_mod.flat_penalty;
    }

    (speed, flat_penalty, rule_match.bicycle_frei)
}

fn get_default_node_delay(tags: &HashMap<String, String>, cfg: Option<&NodeDelayConfig>) -> f64 {
    match map_osm_node_to_control(tags) {
        Some("signal") => cfg.map(|c| c.signal_seconds).unwrap_or(15.0),
        Some("yield") => cfg.map(|c| c.yield_seconds).unwrap_or(3.0),
        Some("stop") => cfg.map(|c| c.stop_seconds).unwrap_or(8.0),
        Some("crossing") => cfg.map(|c| c.crossing_seconds).unwrap_or(3.0),
        _ => 0.0,
    }
}

fn apply_restricted_path_penalty(cost: f64, highway: &str, bicycle_frei: bool) -> f64 {
    if matches!(highway, "footway" | "pedestrian" | "path") && !bicycle_frei {
        return (cost + 60.0) * 4.0;
    }
    cost
}

pub fn standard_cost(
    source_id: &str,
    edge: &GraphEdge,
    target_id: &str,
    overrides: &LocalOverrides,
    graph: &StreetGraph,
) -> f64 {
    let (speed, flat_penalty, bicycle_frei) = resolve_speed_and_penalty(edge, overrides);
    let highway = edge.tags.get("highway").map(|s| s.as_str()).unwrap_or("");

    let mut cost = edge.distance / speed + flat_penalty;
    cost = apply_restricted_path_penalty(cost, highway, bicycle_frei);

    if highway == "service" {
        let srv = edge.tags.get("service").map(|s| s.as_str()).unwrap_or("");
        if srv == "parking_aisle" || srv == "driveway" {
            cost += 30.0;
            cost *= 2.5;
        } else {
            cost += 5.0;
            cost *= 1.2;
        }
    }

    if let Some(custom_delay) = overrides.node_delays.get(target_id) {
        cost += *custom_delay;
    } else {
        let empty_tags = HashMap::new();
        let target_tags = graph
            .nodes
            .get(target_id)
            .map(|e| &e.node.tags)
            .unwrap_or(&empty_tags);
        cost += get_default_node_delay(
            target_tags,
            overrides.rules_config.as_ref().map(|r| &r.node_delays),
        );
    }

    if is_edge_blocked(source_id, target_id, Some(overrides)) {
        cost += 30.0;
    }

    cost
}

pub fn avoid_stops_cost(
    source_id: &str,
    edge: &GraphEdge,
    target_id: &str,
    overrides: &LocalOverrides,
    graph: &StreetGraph,
) -> f64 {
    let (speed, flat_penalty, bicycle_frei) = resolve_speed_and_penalty(edge, overrides);
    let highway = edge.tags.get("highway").map(|s| s.as_str()).unwrap_or("");

    let mut cost = edge.distance / speed + flat_penalty;
    cost = apply_restricted_path_penalty(cost, highway, bicycle_frei);

    if let Some(custom_delay) = overrides.node_delays.get(target_id) {
        cost += *custom_delay + 10.0;
    } else {
        let empty_tags = HashMap::new();
        let target_tags = graph
            .nodes
            .get(target_id)
            .map(|e| &e.node.tags)
            .unwrap_or(&empty_tags);
        let default_delay = get_default_node_delay(
            target_tags,
            overrides.rules_config.as_ref().map(|r| &r.node_delays),
        );
        if default_delay > 0.0 {
            let control_type = map_osm_node_to_control(target_tags);
            let base_stop_penalty = if matches!(control_type, Some("signal") | Some("stop")) {
                45.0
            } else {
                25.0
            };
            cost += default_delay + base_stop_penalty;
        }
    }

    if is_edge_blocked(source_id, target_id, Some(overrides)) {
        cost += 30.0;
    }

    cost
}

pub fn quiet_streets_cost(
    source_id: &str,
    edge: &GraphEdge,
    target_id: &str,
    overrides: &LocalOverrides,
    graph: &StreetGraph,
) -> f64 {
    let blocked = is_edge_blocked(source_id, target_id, Some(overrides));
    let base_cost = if blocked {
        let mut clean_overrides = overrides.clone();
        clean_overrides.blocked_edges = None;
        if let Some(events) = &clean_overrides.events {
            let key1 = format!("{}->{}", source_id, target_id);
            let key2 = format!("{}->{}", target_id, source_id);
            clean_overrides.events = Some(
                events
                    .iter()
                    .filter(|e| {
                        e.effect.effect_type != "road_blockage"
                            || !e.active
                            || (!e.edge_ids.contains(&key1) && !e.edge_ids.contains(&key2))
                    })
                    .cloned()
                    .collect(),
            );
        }
        standard_cost(source_id, edge, target_id, &clean_overrides, graph)
    } else {
        standard_cost(source_id, edge, target_id, overrides, graph)
    };

    let highway = edge.tags.get("highway").map(|s| s.as_str()).unwrap_or("");
    let is_cycleway = has_cycleway(&edge.tags);

    let mut comfort = if let Some(rules) = &overrides.rules_config {
        let rule_match = map_osm_to_sign_and_road(highway, &edge.tags);
        if let Some(sign) = rule_match.sign {
            rules.signs.get(sign.as_str()).and_then(|s| s.comfort.clone()).unwrap_or_else(|| "neutral".to_string())
        } else if let Some(road) = rules.roads.get(rule_match.road.as_str()) {
            road.comfort.clone().unwrap_or_else(|| "neutral".to_string())
        } else {
            "neutral".to_string()
        }
    } else if highway == "cycleway" {
        "very_high".to_string()
    } else if matches!(highway, "footway" | "pedestrian" | "path") {
        "high".to_string()
    } else if matches!(highway, "primary" | "primary_link") {
        if is_cycleway { "neutral".to_string() } else { "very_low".to_string() }
    } else if matches!(highway, "secondary" | "secondary_link") {
        if is_cycleway { "neutral".to_string() } else { "low".to_string() }
    } else if matches!(highway, "tertiary" | "tertiary_link") {
        if is_cycleway { "high".to_string() } else { "low".to_string() }
    } else if matches!(highway, "residential" | "living_street") {
        "high".to_string()
    } else {
        "neutral".to_string()
    };

    if is_cycleway && matches!(comfort.as_str(), "very_low" | "low" | "neutral") {
        comfort = "high".to_string();
    }

    let multiplier = match comfort.as_str() {
        "very_low" => 4.0,
        "low" => 2.0,
        "neutral" => 1.0,
        "high" => 0.8,
        "very_high" => 0.6,
        _ => 1.0,
    };

    let mut cost = base_cost * multiplier;
    if blocked {
        cost += 30.0;
    }
    cost
}

fn calculate_display_cost(
    _source_id: &str,
    edge: &GraphEdge,
    target_id: &str,
    overrides: &LocalOverrides,
    graph: &StreetGraph,
) -> f64 {
    let (speed, flat_penalty, _) = resolve_speed_and_penalty(edge, overrides);
    let mut cost = edge.distance / speed + flat_penalty;

    if let Some(custom_delay) = overrides.node_delays.get(target_id) {
        cost += *custom_delay;
    } else {
        let empty_tags = HashMap::new();
        let target_tags = graph
            .nodes
            .get(target_id)
            .map(|e| &e.node.tags)
            .unwrap_or(&empty_tags);
        cost += get_default_node_delay(
            target_tags,
            overrides.rules_config.as_ref().map(|r| &r.node_delays),
        );
    }

    cost
}

pub(crate) fn get_effective_turn_penalty(
    parent: &GraphNode,
    current: &GraphNode,
    next: &GraphNode,
    overrides: &LocalOverrides,
    turns_cfg: &TurnRuleConfig,
) -> f64 {
    if let Some(node_override) = overrides.node_turns.get(&current.id) {
        let key = format!("{}->{}", parent.id, next.id);
        if let Some(t_type) = node_override.get(&key) {
            return match t_type.as_str() {
                "right_turn" => turns_cfg.right_turn_penalty_seconds,
                "left_turn" => turns_cfg.left_turn_penalty_seconds,
                "green_arrow_right" => turns_cfg.green_arrow_right_turn_seconds,
                "indirect_left" => turns_cfg.indirect_left_turn_seconds,
                "u_turn" => turns_cfg.u_turn_penalty_seconds,
                _ => 0.0,
            };
        }
    }

    let cos_lat = ((current.lat * std::f64::consts::PI) / 180.0).cos();
    let v1x = (current.lng - parent.lng) * cos_lat;
    let v1y = current.lat - parent.lat;
    let v2x = (next.lng - current.lng) * cos_lat;
    let v2y = next.lat - current.lat;

    let len1 = (v1x * v1x + v1y * v1y).sqrt();
    let len2 = (v2x * v2x + v2y * v2y).sqrt();

    if len1 > 1e-7 && len2 > 1e-7 {
        let dot = v1x * v2x + v1y * v2y;
        let cos_theta = dot / (len1 * len2);
        let cross = v1x * v2y - v1y * v2x;

        if cos_theta < -0.7 {
            return turns_cfg.u_turn_penalty_seconds;
        } else if cos_theta >= -0.7 && cos_theta <= 0.7 {
            return if cross > 0.0 {
                turns_cfg.left_turn_penalty_seconds
            } else {
                turns_cfg.right_turn_penalty_seconds
            };
        }
    }

    0.0
}

fn get_road_type_category(highway: &str, tags: &HashMap<String, String>) -> &'static str {
    if highway == "cycleway"
        || has_cycleway(tags)
        || tags.get("bicycle").map(|s| s.as_str()) == Some("designated")
        || tags.get("bicycle").map(|s| s.as_str()) == Some("yes")
        || tags.get("bicycle_road").map(|s| s.as_str()) == Some("yes")
        || tags.get("cyclestreet").map(|s| s.as_str()) == Some("yes")
    {
        return "cycleway";
    }

    if matches!(highway, "residential" | "living_street" | "tertiary" | "tertiary_link" | "unclassified") {
        return "residential";
    }
    if matches!(highway, "primary" | "primary_link" | "secondary" | "secondary_link") {
        return "primary";
    }
    "other"
}

#[derive(Copy, Clone, PartialEq)]
pub(crate) struct HeapItem {
    pub(crate) cost: f64,
    pub(crate) node: usize,
}

impl Eq for HeapItem {}

impl Ord for HeapItem {
    fn cmp(&self, other: &Self) -> Ordering {
        other.cost.partial_cmp(&self.cost).unwrap_or(Ordering::Equal)
    }
}

impl PartialOrd for HeapItem {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

pub(crate) struct VirtualRoutingConfig {
    pub(crate) start_node: GraphNode,
    pub(crate) end_node: GraphNode,
    pub(crate) start_edges: Vec<GraphEdge>,
    pub(crate) end_virtual_edges: HashMap<String, GraphEdge>,
}

#[derive(Default)]
pub struct DijkstraRouter;

impl DijkstraRouter {
    pub fn new() -> Self {
        Self
    }

    fn run_dijkstra<F>(
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

        let mut idx = 0;
        for node_id in graph.nodes.keys() {
            node_id_to_int.insert(node_id.clone(), idx);
            int_to_node_id.push(node_id.clone());
            idx += 1;
        }

        if virtual_config.is_some() {
            if !node_id_to_int.contains_key(start_id) {
                node_id_to_int.insert(start_id.to_string(), idx);
                int_to_node_id.push(start_id.to_string());
                idx += 1;
            }
            if !node_id_to_int.contains_key(end_id) {
                node_id_to_int.insert(end_id.to_string(), idx);
                int_to_node_id.push(end_id.to_string());
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

        let total_nodes = int_to_node_id.len();
        let mut distances = vec![f64::INFINITY; total_nodes];
        let mut previous_int = vec![isize::MAX; total_nodes];
        let mut visited = vec![false; total_nodes];

        distances[start_int] = 0.0;
        let mut heap = BinaryHeap::new();
        heap.push(HeapItem { cost: 0.0, node: start_int });

        let mut dest_reached = false;

        while let Some(HeapItem { cost, node: current_int }) = heap.pop() {
            if current_int == end_int {
                dest_reached = true;
                break;
            }

            if visited[current_int] {
                continue;
            }
            if cost > distances[current_int] {
                continue;
            }
            visited[current_int] = true;

            let current_id = &int_to_node_id[current_int];
            let (current_node, current_edges): (Option<&GraphNode>, Vec<&GraphEdge>) = if let Some(vc) = virtual_config {
                if current_id == "virtual-start" {
                    (Some(&vc.start_node), vc.start_edges.iter().collect())
                } else if current_id == "virtual-end" {
                    (Some(&vc.end_node), Vec::new())
                } else if let Some(entry) = graph.nodes.get(current_id) {
                    let mut edges: Vec<&GraphEdge> = entry.edges.iter().collect();
                    if let Some(extra) = vc.end_virtual_edges.get(current_id) {
                        edges.push(extra);
                    }
                    (Some(&entry.node), edges)
                } else {
                    (None, Vec::new())
                }
            } else if let Some(entry) = graph.nodes.get(current_id) {
                (Some(&entry.node), entry.edges.iter().collect())
            } else {
                (None, Vec::new())
            };

            let Some(curr_node_ref) = current_node else { continue };
            let current_dist = distances[current_int];

            for edge in current_edges {
                let neighbor_id = &edge.target;
                let Some(&neighbor_int) = node_id_to_int.get(neighbor_id) else { continue };
                if visited[neighbor_int] {
                    continue;
                }

                let mut edge_cost = cost_fn(current_id, edge, neighbor_id, overrides, graph);

                let parent_int = previous_int[current_int];
                if parent_int != isize::MAX {
                    let parent_id = &int_to_node_id[parent_int as usize];
                    let parent_node = if let Some(vc) = virtual_config {
                        if parent_id == "virtual-start" {
                            Some(&vc.start_node)
                        } else if parent_id == "virtual-end" {
                            Some(&vc.end_node)
                        } else {
                            graph.nodes.get(parent_id).map(|e| &e.node)
                        }
                    } else {
                        graph.nodes.get(parent_id).map(|e| &e.node)
                    };

                    let neighbor_node = if let Some(vc) = virtual_config {
                        if neighbor_id == "virtual-start" {
                            Some(&vc.start_node)
                        } else if neighbor_id == "virtual-end" {
                            Some(&vc.end_node)
                        } else {
                            graph.nodes.get(neighbor_id).map(|e| &e.node)
                        }
                    } else {
                        graph.nodes.get(neighbor_id).map(|e| &e.node)
                    };

                    if let (Some(p_node), Some(n_node)) = (parent_node, neighbor_node) {
                        edge_cost += get_effective_turn_penalty(
                            p_node,
                            curr_node_ref,
                            n_node,
                            overrides,
                            &turns_cfg,
                        );
                    }
                }

                let parent_id_str = if parent_int != isize::MAX {
                    Some(int_to_node_id[parent_int as usize].as_str())
                } else {
                    None
                };
                let (is_banned, crossing_delta) = get_crossing_turn_effect(
                    parent_id_str,
                    current_id,
                    neighbor_id,
                    overrides,
                );
                if is_banned {
                    continue;
                }
                edge_cost += crossing_delta;

                let alt_dist = current_dist + edge_cost;
                if alt_dist < distances[neighbor_int] {
                    distances[neighbor_int] = alt_dist;
                    previous_int[neighbor_int] = current_int as isize;
                    heap.push(HeapItem { cost: alt_dist, node: neighbor_int });
                }
            }
        }

        let mut previous = HashMap::new();
        for (i, &p) in previous_int.iter().enumerate() {
            if p != isize::MAX {
                previous.insert(int_to_node_id[i].clone(), int_to_node_id[p as usize].clone());
            }
        }

        (dest_reached, previous)
    }

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

        let (dest_reached, previous) = self.run_dijkstra(
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

    fn find_route_node_fallback<F>(
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

        let (dest_reached, previous) = self.run_dijkstra(
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

pub fn find_nearest_node(graph: &StreetGraph, coord: Coordinate) -> Option<String> {
    let mut min_dist = f64::INFINITY;
    let mut nearest_id = None;

    for (id, entry) in &graph.nodes {
        let dist = haversine_distance(coord.lat, coord.lng, entry.node.lat, entry.node.lng);
        if dist < min_dist {
            min_dist = dist;
            nearest_id = Some(id.clone());
        }
    }

    nearest_id
}

pub(crate) struct NearestEdgeRef {
    pub(crate) u_id: String,
    pub(crate) v_id: String,
    pub(crate) projected: Coordinate,
    pub(crate) edge: GraphEdge,
}

pub(crate) fn find_nearest_edge(graph: &StreetGraph, coord: Coordinate) -> Option<NearestEdgeRef> {
    let mut min_dist = f64::INFINITY;
    let mut best_edge = None;

    for (u_id, entry) in &graph.nodes {
        let u_coord = Coordinate { lat: entry.node.lat, lng: entry.node.lng };
        for edge in &entry.edges {
            let v_id = &edge.target;
            let Some(v_entry) = graph.nodes.get(v_id) else { continue };
            let v_coord = Coordinate { lat: v_entry.node.lat, lng: v_entry.node.lng };

            let proj = project_point_on_segment(coord, u_coord, v_coord);
            let dist = haversine_distance(coord.lat, coord.lng, proj.lat, proj.lng);

            if dist < min_dist {
                min_dist = dist;
                best_edge = Some(NearestEdgeRef {
                    u_id: u_id.clone(),
                    v_id: v_id.clone(),
                    projected: proj,
                    edge: edge.clone(),
                });
            }
        }
    }

    best_edge
}

pub(crate) struct RouteStatistics {
    pub(crate) path_node_ids: Vec<String>,
    pub(crate) coordinates: Vec<Coordinate>,
    pub(crate) total_distance_meters: f64,
    pub(crate) streets: Vec<String>,
    pub(crate) traffic_signals_count: usize,
    pub(crate) signal_count: usize,
    pub(crate) yield_count: usize,
    pub(crate) crossing_count: usize,
    pub(crate) road_type_totals: HashMap<String, f64>,
    pub(crate) surface_totals: HashMap<String, f64>,
    pub(crate) edges: Vec<RouteEdgeDetail>,
    pub(crate) total_display_cost: f64,
}

pub(crate) fn build_route_statistics(
    graph: &StreetGraph,
    previous: &HashMap<String, String>,
    end_id: &str,
    overrides: &LocalOverrides,
    virtual_config: Option<&VirtualRoutingConfig>,
) -> RouteStatistics {
    let mut path_node_ids = Vec::new();
    let mut current = end_id.to_string();
    while !current.is_empty() {
        path_node_ids.insert(0, current.clone());
        current = previous.get(&current).cloned().unwrap_or_default();
    }

    let mut coordinates = Vec::new();
    let mut total_distance_meters = 0.0;
    let mut traffic_signals_count = 0;
    let mut signal_count = 0;
    let mut yield_count = 0;
    let mut crossing_count = 0;

    let mut road_type_totals = HashMap::new();
    road_type_totals.insert("cycleway".to_string(), 0.0);
    road_type_totals.insert("residential".to_string(), 0.0);
    road_type_totals.insert("primary".to_string(), 0.0);
    road_type_totals.insert("other".to_string(), 0.0);

    let mut surface_totals = HashMap::new();
    surface_totals.insert("paved".to_string(), 0.0);
    surface_totals.insert("gravel".to_string(), 0.0);
    surface_totals.insert("cobblestone".to_string(), 0.0);

    let mut streets_set = HashSet::new();
    let mut edges = Vec::new();
    let mut total_display_cost = 0.0;

    let mut last_signal_node: Option<Coordinate> = None;
    let mut last_yield_node: Option<Coordinate> = None;
    let mut last_stop_node: Option<Coordinate> = None;
    let mut last_crossing_node: Option<Coordinate> = None;

    let turns_cfg = overrides
        .rules_config
        .as_ref()
        .map(|r| r.turns.clone())
        .unwrap_or_default();

    for i in 0..path_node_ids.len() {
        let node_id = &path_node_ids[i];
        let (current_node, current_edges): (Option<&GraphNode>, Vec<&GraphEdge>) = if let Some(vc) = virtual_config {
            if node_id == "virtual-start" {
                (Some(&vc.start_node), vc.start_edges.iter().collect())
            } else if node_id == "virtual-end" {
                (Some(&vc.end_node), Vec::new())
            } else if let Some(entry) = graph.nodes.get(node_id) {
                let mut ed: Vec<&GraphEdge> = entry.edges.iter().collect();
                if let Some(extra) = vc.end_virtual_edges.get(node_id) {
                    ed.push(extra);
                }
                (Some(&entry.node), ed)
            } else {
                (None, Vec::new())
            }
        } else if let Some(entry) = graph.nodes.get(node_id) {
            (Some(&entry.node), entry.edges.iter().collect())
        } else {
            (None, Vec::new())
        };

        let Some(c_node) = current_node else { continue };
        let coord = Coordinate { lat: c_node.lat, lng: c_node.lng };
        coordinates.push(coord);

        let control_type = map_osm_node_to_control(&c_node.tags);
        if let Some(control) = control_type {
            let is_new_cluster = |last: Option<Coordinate>| {
                if let Some(l) = last {
                    haversine_distance(l.lat, l.lng, coord.lat, coord.lng) > 35.0
                } else {
                    true
                }
            };

            if control == "signal" && is_new_cluster(last_signal_node) {
                traffic_signals_count += 1;
                signal_count += 1;
                last_signal_node = Some(coord);
            } else if control == "yield" && is_new_cluster(last_yield_node) {
                yield_count += 1;
                last_yield_node = Some(coord);
            } else if control == "stop" && is_new_cluster(last_stop_node) {
                last_stop_node = Some(coord);
            } else if control == "crossing" && is_new_cluster(last_crossing_node) {
                crossing_count += 1;
                last_crossing_node = Some(coord);
            }
        }

        if i < path_node_ids.len() - 1 {
            let next_node_id = &path_node_ids[i + 1];
            if let Some(edge) = current_edges.into_iter().find(|e| &e.target == next_node_id) {
                total_distance_meters += edge.distance;
                if let Some(name) = &edge.name {
                    streets_set.insert(name.clone());
                }

                let display_cost = calculate_display_cost(node_id, edge, next_node_id, overrides, graph);

                let mut turn_penalty = 0.0;
                if i > 0 {
                    let parent_id = &path_node_ids[i - 1];
                    let parent_node = if let Some(vc) = virtual_config {
                        if parent_id == "virtual-start" {
                            Some(&vc.start_node)
                        } else if parent_id == "virtual-end" {
                            Some(&vc.end_node)
                        } else {
                            graph.nodes.get(parent_id).map(|e| &e.node)
                        }
                    } else {
                        graph.nodes.get(parent_id).map(|e| &e.node)
                    };

                    let next_node = if let Some(vc) = virtual_config {
                        if next_node_id == "virtual-start" {
                            Some(&vc.start_node)
                        } else if next_node_id == "virtual-end" {
                            Some(&vc.end_node)
                        } else {
                            graph.nodes.get(next_node_id).map(|e| &e.node)
                        }
                    } else {
                        graph.nodes.get(next_node_id).map(|e| &e.node)
                    };

                    if let (Some(p_node), Some(n_node)) = (parent_node, next_node) {
                        turn_penalty = get_effective_turn_penalty(
                            p_node,
                            c_node,
                            n_node,
                            overrides,
                            &turns_cfg,
                        );
                    }
                }

                let parent_id_str = if i > 0 {
                    Some(path_node_ids[i - 1].as_str())
                } else {
                    None
                };
                let (_, crossing_delta) = get_crossing_turn_effect(
                    parent_id_str,
                    node_id,
                    next_node_id,
                    overrides,
                );

                total_display_cost += display_cost + turn_penalty + crossing_delta;

                let highway = edge.tags.get("highway").map(|s| s.as_str()).unwrap_or("unknown");
                let cat = get_road_type_category(highway, &edge.tags);
                *road_type_totals.entry(cat.to_string()).or_insert(0.0) += edge.distance;

                let surface_type = get_surface_type(&edge.tags);
                *surface_totals.entry(surface_type.to_string()).or_insert(0.0) += edge.distance;

                let match_res = map_osm_to_sign_and_road(highway, &edge.tags);

                edges.push(RouteEdgeDetail {
                    source_id: node_id.clone(),
                    target_id: next_node_id.clone(),
                    name: edge.name.clone().unwrap_or_else(|| "Unnamed Street".to_string()),
                    distance: edge.distance,
                    highway: highway.to_string(),
                    tags: edge.tags.clone(),
                    cost: display_cost + turn_penalty + crossing_delta,
                    matched_sign: match_res.sign.map(|s| s.as_str().to_string()),
                    matched_road: match_res.road.as_str().to_string(),
                });
            }
        }
    }

    RouteStatistics {
        path_node_ids,
        coordinates,
        total_distance_meters,
        streets: streets_set.into_iter().collect(),
        traffic_signals_count,
        signal_count,
        yield_count,
        crossing_count,
        road_type_totals,
        surface_totals,
        edges,
        total_display_cost,
    }
}

/// Evaluates all 3 routing strategies (standard, avoid-stops, quiet-streets) for given start/end coordinates.
/// Defaults to the Bidirectional A* solver.
pub fn find_route_variants(
    graph: &StreetGraph,
    start: Coordinate,
    end: Coordinate,
    overrides: &LocalOverrides,
) -> Vec<StrategyRouteVariant> {
    find_route_variants_astar(graph, start, end, overrides)
}

/// Evaluates all 3 routing strategies using Bidirectional A*.
pub fn find_route_variants_astar(
    graph: &StreetGraph,
    start: Coordinate,
    end: Coordinate,
    overrides: &LocalOverrides,
) -> Vec<StrategyRouteVariant> {
    let router = crate::astar::AStarRouter::new();
    let mut variants = Vec::new();

    if let Some(standard) = router.find_route(graph, start, end, standard_cost, overrides) {
        variants.push(StrategyRouteVariant {
            label: "standard".to_string(),
            result: standard,
        });
    }

    if let Some(avoid_stops) = router.find_route(graph, start, end, avoid_stops_cost, overrides) {
        variants.push(StrategyRouteVariant {
            label: "avoid-stops".to_string(),
            result: avoid_stops,
        });
    }

    if let Some(quiet) = router.find_route(graph, start, end, quiet_streets_cost, overrides) {
        variants.push(StrategyRouteVariant {
            label: "quiet-streets".to_string(),
            result: quiet,
        });
    }

    variants
}

/// Evaluates all 3 routing strategies using Dijkstra algorithm.
pub fn find_route_variants_dijkstra(
    graph: &StreetGraph,
    start: Coordinate,
    end: Coordinate,
    overrides: &LocalOverrides,
) -> Vec<StrategyRouteVariant> {
    let router = DijkstraRouter::new();
    let mut variants = Vec::new();

    if let Some(standard) = router.find_route(graph, start, end, standard_cost, overrides) {
        variants.push(StrategyRouteVariant {
            label: "standard".to_string(),
            result: standard,
        });
    }

    if let Some(avoid_stops) = router.find_route(graph, start, end, avoid_stops_cost, overrides) {
        variants.push(StrategyRouteVariant {
            label: "avoid-stops".to_string(),
            result: avoid_stops,
        });
    }

    if let Some(quiet) = router.find_route(graph, start, end, quiet_streets_cost, overrides) {
        variants.push(StrategyRouteVariant {
            label: "quiet-streets".to_string(),
            result: quiet,
        });
    }

    variants
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::load_mock_graph;

    #[test]
    fn test_dijkstra_mock_graph() {
        let graph = load_mock_graph();
        let router = DijkstraRouter::new();
        let overrides = LocalOverrides::default();

        let start = Coordinate { lat: 48.13715, lng: 11.5754 }; // Marienplatz (Node 1)
        let end = Coordinate { lat: 48.135, lng: 11.582 }; // Isartor (Node 5)

        let result = router.find_route(&graph, start, end, standard_cost, &overrides);
        assert!(result.is_some(), "Routing result should not be None");

        let route = result.unwrap();
        assert!(route.total_distance_meters > 100.0);
        assert!(route.total_duration_seconds > 0.0);
        assert!(route.coordinates.len() >= 2);
    }

    #[test]
    fn test_find_route_variants() {
        let graph = load_mock_graph();
        let overrides = LocalOverrides::default();

        let start = Coordinate { lat: 48.13715, lng: 11.5754 };
        let end = Coordinate { lat: 48.135, lng: 11.582 };

        let variants = find_route_variants(&graph, start, end, &overrides);
        assert_eq!(variants.len(), 3);
        assert_eq!(variants[0].label, "standard");
        assert_eq!(variants[1].label, "avoid-stops");
        assert_eq!(variants[2].label, "quiet-streets");
    }

    #[test]
    fn test_blocked_edge_increases_cost() {
        let _graph = load_mock_graph();
        let mut overrides = LocalOverrides::default();
        let mut blocked = HashSet::new();
        blocked.insert("1->2".to_string());
        overrides.blocked_edges = Some(blocked);

        assert!(is_edge_blocked("1", "2", Some(&overrides)));
        assert!(is_edge_blocked("2", "1", Some(&overrides)));
        assert!(!is_edge_blocked("2", "7", Some(&overrides)));
    }

    #[test]
    fn test_crossing_turn_banned_and_penalty() {
        let graph = load_mock_graph();
        let router = DijkstraRouter::new();
        let mut overrides = LocalOverrides::default();

        let start = Coordinate { lat: 48.13715, lng: 11.5754 };
        let end = Coordinate { lat: 48.135, lng: 11.582 };

        let clean_res = router.find_route(&graph, start, end, standard_cost, &overrides).unwrap();

        let turn_override = CrossingTurnOverride {
            id: "turn-1".to_string(),
            crossing_id: "cluster-1".to_string(),
            from_node_id: "1".to_string(),
            to_node_id: "2".to_string(),
            path_node_ids: Some(vec!["1".to_string(), "2".to_string()]),
            time_delta_seconds: 45.0,
            banned: false,
            turn_type: "direct".to_string(),
            description: None,
            created_at: None,
        };
        overrides.crossing_turns = Some(vec![turn_override]);

        let penalized_res = router.find_route(&graph, start, end, standard_cost, &overrides).unwrap();
        assert!(penalized_res.total_duration_seconds > clean_res.total_duration_seconds);

        overrides.crossing_turns = Some(vec![CrossingTurnOverride {
            id: "turn-1".to_string(),
            crossing_id: "cluster-1".to_string(),
            from_node_id: "1".to_string(),
            to_node_id: "2".to_string(),
            path_node_ids: Some(vec!["1".to_string(), "2".to_string()]),
            time_delta_seconds: 0.0,
            banned: true,
            turn_type: "direct".to_string(),
            description: None,
            created_at: None,
        }]);

        assert!(is_edge_blocked("1", "2", Some(&overrides)));
    }
}

