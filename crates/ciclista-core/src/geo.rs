use serde::{Deserialize, Serialize};

/// Geographic coordinates represented by latitude and longitude in degrees.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Coordinate {
    pub lat: f64,
    pub lng: f64,
}

/// Calculates the distance between two nearby points on the Earth's surface
/// using flat-earth equirectangular approximation in meters.
pub fn haversine_distance(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    const R: f64 = 6_371_000.0;
    let deg_to_rad = std::f64::consts::PI / 180.0;
    let d_lat = (lat2 - lat1) * deg_to_rad;
    let d_lon = (lon2 - lon1) * deg_to_rad;
    let mean_lat = ((lat1 + lat2) / 2.0) * deg_to_rad;
    let x = d_lon * mean_lat.cos();
    let y = d_lat;
    R * (x * x + y * y).sqrt()
}

/// Projects a point `p` onto a line segment defined by points `a` and `b`.
/// Returns the projected coordinate, clamped to the segment endpoints.
pub fn project_point_on_segment(p: Coordinate, a: Coordinate, b: Coordinate) -> Coordinate {
    let cos_lat = ((a.lat * std::f64::consts::PI) / 180.0).cos();
    let abx = (b.lng - a.lng) * cos_lat;
    let aby = b.lat - a.lat;

    let apx = (p.lng - a.lng) * cos_lat;
    let apy = p.lat - a.lat;

    let ab_len2 = abx * abx + aby * aby;
    if ab_len2 < 1e-14 {
        return Coordinate { lat: a.lat, lng: a.lng };
    }

    let mut t = (apx * abx + apy * aby) / ab_len2;
    t = t.clamp(0.0, 1.0);

    Coordinate {
        lat: a.lat + t * (b.lat - a.lat),
        lng: a.lng + t * (b.lng - a.lng),
    }
}

/// Calculates the projection factor `t` in [0, 1] of point `p` onto line segment `a-b`.
pub fn get_projection_t(p: Coordinate, a: Coordinate, b: Coordinate) -> f64 {
    let cos_lat = ((a.lat * std::f64::consts::PI) / 180.0).cos();
    let abx = (b.lng - a.lng) * cos_lat;
    let aby = b.lat - a.lat;

    let apx = (p.lng - a.lng) * cos_lat;
    let apy = p.lat - a.lat;

    let ab_len2 = abx * abx + aby * aby;
    if ab_len2 < 1e-14 {
        return 0.0;
    }

    let t = (apx * abx + apy * aby) / ab_len2;
    t.clamp(0.0, 1.0)
}

/// Calculates the initial bearing from coordinate `a` to coordinate `b` in degrees [0, 360).
pub fn calculate_bearing(a: Coordinate, b: Coordinate) -> f64 {
    let lat1 = (a.lat * std::f64::consts::PI) / 180.0;
    let lat2 = (b.lat * std::f64::consts::PI) / 180.0;
    let d_lng = ((b.lng - a.lng) * std::f64::consts::PI) / 180.0;

    let y = d_lng.sin() * lat2.cos();
    let x = lat1.cos() * lat2.sin() - lat1.sin() * lat2.cos() * d_lng.cos();

    let brng = (y.atan2(x) * 180.0) / std::f64::consts::PI;
    (brng + 360.0) % 360.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_haversine_distance() {
        // Distance between Marienplatz (48.13715, 11.5754) and Odeonsplatz (48.1428, 11.5775)
        let dist = haversine_distance(48.13715, 11.5754, 48.1428, 11.5775);
        assert!(dist > 600.0 && dist < 700.0, "Expected ~647m, got {}", dist);
    }

    #[test]
    fn test_project_point_on_segment() {
        let a = Coordinate { lat: 48.0, lng: 11.0 };
        let b = Coordinate { lat: 48.0, lng: 12.0 };
        let p = Coordinate { lat: 48.1, lng: 11.5 };

        let proj = project_point_on_segment(p, a, b);
        assert!((proj.lat - 48.0).abs() < 1e-6);
        assert!((proj.lng - 11.5).abs() < 1e-6);

        let t = get_projection_t(p, a, b);
        assert!((t - 0.5).abs() < 1e-6);
    }

    #[test]
    fn test_calculate_bearing() {
        let a = Coordinate { lat: 0.0, lng: 0.0 };
        let b = Coordinate { lat: 1.0, lng: 0.0 };
        let bearing_north = calculate_bearing(a, b);
        assert!((bearing_north - 0.0).abs() < 1e-6);

        let c = Coordinate { lat: 0.0, lng: 1.0 };
        let bearing_east = calculate_bearing(a, c);
        assert!((bearing_east - 90.0).abs() < 1e-6);
    }
}
