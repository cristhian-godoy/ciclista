use std::collections::HashMap;
use serde::{Deserialize, Serialize};

/// Generic internal cycling infrastructure concepts mapped from OSM tags.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InfrastructureType {
    PedestrianZone,
    Sidewalk,
    SharedPath,
    SegregatedPath,
    LivingStreet,
    BicycleStreet,
}

impl InfrastructureType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::PedestrianZone => "pedestrian_zone",
            Self::Sidewalk => "sidewalk",
            Self::SharedPath => "shared_path",
            Self::SegregatedPath => "segregated_path",
            Self::LivingStreet => "living_street",
            Self::BicycleStreet => "bicycle_street",
        }
    }
}

/// Classifications for various OSM highway types.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RoadType {
    Primary,
    Secondary,
    Residential,
    Service,
    PathDefault,
}

impl RoadType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Primary => "primary",
            Self::Secondary => "secondary",
            Self::Residential => "residential",
            Self::Service => "service",
            Self::PathDefault => "path_default",
        }
    }
}

/// Result of mapping an OSM way's tags to infrastructure concept and road classification.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OSMRuleMatch {
    pub sign: Option<InfrastructureType>,
    pub road: RoadType,
    #[serde(rename = "bicycleFrei")]
    pub bicycle_frei: bool,
}

/// Maps an OSM way's highway tag and full tag set to the applicable infrastructure concept
/// and road classification for cycling cost evaluation.
pub fn map_osm_to_sign_and_road(highway: &str, tags: &HashMap<String, String>) -> OSMRuleMatch {
    let bicycle = tags.get("bicycle").map(|s| s.as_str());
    let foot = tags.get("foot").map(|s| s.as_str());
    let bicycle_frei = bicycle == Some("yes")
        || bicycle == Some("designated")
        || bicycle == Some("permissive");

    // 1. Bicycle street
    if tags.get("bicycle_road").map(|s| s.as_str()) == Some("yes")
        || tags.get("cyclestreet").map(|s| s.as_str()) == Some("yes")
        || highway == "bicycle_road"
    {
        return OSMRuleMatch {
            sign: Some(InfrastructureType::BicycleStreet),
            road: RoadType::PathDefault,
            bicycle_frei: true,
        };
    }

    // 2. Cycleway
    if highway == "cycleway" {
        return OSMRuleMatch {
            sign: Some(InfrastructureType::SegregatedPath),
            road: RoadType::PathDefault,
            bicycle_frei: true,
        };
    }

    // 3. Living street
    if highway == "living_street" {
        return OSMRuleMatch {
            sign: Some(InfrastructureType::LivingStreet),
            road: RoadType::Residential,
            bicycle_frei: true,
        };
    }

    // 4. Path / track / footway: check for shared or segregated designation
    if highway == "path" || highway == "track" || highway == "footway" {
        let is_bicycle_designated = bicycle == Some("designated") || bicycle == Some("yes");
        let is_foot_designated = foot == Some("designated") || foot == Some("yes");

        if is_bicycle_designated && is_foot_designated {
            if tags.get("segregated").map(|s| s.as_str()) == Some("yes") {
                return OSMRuleMatch {
                    sign: Some(InfrastructureType::SegregatedPath),
                    road: RoadType::PathDefault,
                    bicycle_frei: true,
                };
            }
            return OSMRuleMatch {
                sign: Some(InfrastructureType::SharedPath),
                road: RoadType::PathDefault,
                bicycle_frei: true,
            };
        }
    }

    // 5. Path / track fallbacks
    if highway == "path" || highway == "track" {
        return OSMRuleMatch {
            sign: None,
            road: RoadType::PathDefault,
            bicycle_frei,
        };
    }

    // 6. Pedestrian zone
    if highway == "pedestrian" {
        return OSMRuleMatch {
            sign: Some(InfrastructureType::PedestrianZone),
            road: RoadType::PathDefault,
            bicycle_frei,
        };
    }

    // 7. Footway / sidewalk
    if highway == "footway" || highway == "steps" {
        return OSMRuleMatch {
            sign: Some(InfrastructureType::Sidewalk),
            road: RoadType::PathDefault,
            bicycle_frei,
        };
    }

    // 8. Road classifications
    if highway == "primary" || highway == "primary_link" {
        return OSMRuleMatch {
            sign: None,
            road: RoadType::Primary,
            bicycle_frei: true,
        };
    }
    if highway == "secondary" || highway == "secondary_link" {
        return OSMRuleMatch {
            sign: None,
            road: RoadType::Secondary,
            bicycle_frei: true,
        };
    }
    if highway == "residential"
        || highway == "tertiary"
        || highway == "tertiary_link"
        || highway == "unclassified"
    {
        return OSMRuleMatch {
            sign: None,
            road: RoadType::Residential,
            bicycle_frei: true,
        };
    }
    if highway == "service" {
        return OSMRuleMatch {
            sign: None,
            road: RoadType::Service,
            bicycle_frei: true,
        };
    }

    // 9. Fallback
    OSMRuleMatch {
        sign: None,
        road: RoadType::PathDefault,
        bicycle_frei: true,
    }
}

/// Classifies an OSM node's tags into a traffic control type.
pub fn map_osm_node_to_control(tags: &HashMap<String, String>) -> Option<&'static str> {
    let highway = tags.get("highway").map(|s| s.as_str());
    let crossing = tags.get("crossing").map(|s| s.as_str());

    if highway == Some("traffic_signals")
        || crossing == Some("traffic_signals")
        || crossing == Some("controlled")
    {
        return Some("signal");
    }
    if highway == Some("give_way") {
        return Some("yield");
    }
    if highway == Some("stop") {
        return Some("stop");
    }
    if crossing == Some("zebra") || crossing == Some("marked") {
        return Some("crossing");
    }

    None
}

/// Checks if an OSM way's tags indicate the presence of a cycleway on the street.
pub fn has_cycleway(tags: &HashMap<String, String>) -> bool {
    let candidates = [
        tags.get("cycleway"),
        tags.get("cycleway:left"),
        tags.get("cycleway:right"),
        tags.get("cycleway:both"),
    ];

    candidates.into_iter().any(|v| {
        if let Some(val) = v {
            val != "no" && val != "none" && val != "separate"
        } else {
            false
        }
    })
}

/// Classifies an OSM surface tag into 'paved', 'gravel', or 'cobblestone'.
pub fn get_surface_type(tags: &HashMap<String, String>) -> &'static str {
    let surface = tags.get("surface").map(|s| s.as_str());
    let Some(surface) = surface else {
        if tags.get("highway").map(|s| s.as_str()) == Some("track") {
            return "gravel";
        }
        return "paved";
    };

    const PAVED_VALUES: &[&str] = &[
        "asphalt",
        "concrete",
        "paved",
        "paving_stones",
        "sett",
        "concrete:lanes",
        "concrete:plates",
    ];
    const GRAVEL_VALUES: &[&str] = &[
        "gravel",
        "unpaved",
        "compacted",
        "fine_gravel",
        "dirt",
        "earth",
        "grass",
        "ground",
        "mud",
        "sand",
    ];
    const COBBLESTONE_VALUES: &[&str] = &["cobblestone", "cobblestone:flattened", "grass_paver"];

    if PAVED_VALUES.contains(&surface) {
        return "paved";
    }
    if GRAVEL_VALUES.contains(&surface) {
        return "gravel";
    }
    if COBBLESTONE_VALUES.contains(&surface) {
        return "cobblestone";
    }

    "paved"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_map_osm_to_sign_and_road() {
        let mut tags = HashMap::new();
        tags.insert("highway".to_string(), "cycleway".to_string());
        let m = map_osm_to_sign_and_road("cycleway", &tags);
        assert_eq!(m.sign, Some(InfrastructureType::SegregatedPath));
        assert_eq!(m.road, RoadType::PathDefault);
        assert!(m.bicycle_frei);

        let mut tags2 = HashMap::new();
        tags2.insert("highway".to_string(), "primary".to_string());
        let m2 = map_osm_to_sign_and_road("primary", &tags2);
        assert_eq!(m2.sign, None);
        assert_eq!(m2.road, RoadType::Primary);
    }

    #[test]
    fn test_has_cycleway() {
        let mut tags = HashMap::new();
        tags.insert("cycleway".to_string(), "lane".to_string());
        assert!(has_cycleway(&tags));

        tags.insert("cycleway".to_string(), "no".to_string());
        assert!(!has_cycleway(&tags));
    }

    #[test]
    fn test_get_surface_type() {
        let mut tags = HashMap::new();
        tags.insert("surface".to_string(), "asphalt".to_string());
        assert_eq!(get_surface_type(&tags), "paved");

        tags.insert("surface".to_string(), "gravel".to_string());
        assert_eq!(get_surface_type(&tags), "gravel");

        tags.insert("surface".to_string(), "cobblestone".to_string());
        assert_eq!(get_surface_type(&tags), "cobblestone");
    }
}
