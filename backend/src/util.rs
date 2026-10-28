use unicode_normalization::{char::is_combining_mark, UnicodeNormalization};

/// Normalizes coordinates to ~110m precision. This deliberately matches the old
/// client cache so mobile users moving slowly keep hitting the same cache entry.
pub fn normalize_coords(lat: f64, lon: f64) -> (f64, f64, String) {
    let lat = (lat * 1000.0).round() / 1000.0;
    let lon = (lon * 1000.0).round() / 1000.0;
    (lat, lon, format!("{lat:.3},{lon:.3}"))
}

pub fn valid_coords(lat: f64, lon: f64) -> bool {
    lat.is_finite()
        && lon.is_finite()
        && (-90.0..=90.0).contains(&lat)
        && (-180.0..=180.0).contains(&lon)
}

/// Accent-insensitive, punctuation-insensitive lowercase key.
pub fn normalize_city_name(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    let mut pending_space = false;

    for ch in value
        .nfd()
        .filter(|ch| !is_combining_mark(*ch))
        .flat_map(char::to_lowercase)
    {
        if ch.is_ascii_alphanumeric() {
            if pending_space && !out.is_empty() {
                out.push(' ');
            }
            pending_space = false;
            out.push(ch);
        } else {
            pending_space = true;
        }
    }

    out
}

pub fn is_bad_image(url: &str) -> bool {
    let lower = url.to_ascii_lowercase();
    [
        "flag_of",
        "bandeira",
        "coat_of_arms",
        "brasao",
        "brasão",
        "_map",
        "map_of",
        "map-",
        "mapa",
        "locator",
        "localizador",
    ]
    .iter()
    .any(|needle| lower.contains(needle))
}

pub fn haversine_km(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    const EARTH_RADIUS_KM: f64 = 6371.0;
    let d_lat = (lat2 - lat1).to_radians();
    let d_lon = (lon2 - lon1).to_radians();
    let a = (d_lat / 2.0).sin().powi(2)
        + lat1.to_radians().cos() * lat2.to_radians().cos() * (d_lon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());
    EARTH_RADIUS_KM * c
}

pub fn bearing(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> String {
    let d_lon = (lon2 - lon1).to_radians();
    let y = d_lon.sin() * lat2.to_radians().cos();
    let x = lat1.to_radians().cos() * lat2.to_radians().sin()
        - lat1.to_radians().sin() * lat2.to_radians().cos() * d_lon.cos();
    let mut angle = y.atan2(x).to_degrees();
    angle = (angle + 360.0) % 360.0;

    const DIRECTIONS: [&str; 8] = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];
    DIRECTIONS[((angle / 45.0).round() as usize) % 8].to_string()
}

pub fn format_distance(distance_km: f64) -> String {
    if distance_km >= 1.0 {
        format!("{distance_km:.1} km")
    } else {
        format!("{} m", (distance_km * 1000.0).round() as i64)
    }
}

pub fn round_i32(value: f64) -> i32 {
    value.round() as i32
}

pub fn round_1(value: f64) -> f64 {
    (value * 10.0).round() / 10.0
}

/// Parses Wikidata's WKT `Point(lon lat)` literal.
pub fn parse_wkt_point(value: &str) -> Option<(f64, f64)> {
    let rest = value.strip_prefix("Point(")?;
    let rest = rest.strip_suffix(')')?;
    let mut parts = rest.split_whitespace();
    let lon = parts.next()?.parse::<f64>().ok()?;
    let lat = parts.next()?.parse::<f64>().ok()?;
    Some((lat, lon))
}

pub fn city_key(name: &str, admin1: &str, country_code: &str) -> String {
    format!(
        "{}|{}|{}",
        normalize_city_name(name),
        admin1.to_ascii_lowercase(),
        country_code.to_ascii_lowercase()
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_accents_and_punctuation() {
        assert_eq!(normalize_city_name("São Paulo"), "sao paulo");
        assert_eq!(normalize_city_name("  Florianópolis  "), "florianopolis");
        assert_eq!(normalize_city_name("Belo-Horizonte"), "belo horizonte");
    }

    #[test]
    fn coordinates_round_consistently() {
        let (lat, lon, key) = normalize_coords(-23.55051, -46.63331);
        assert!((lat + 23.551).abs() < f64::EPSILON);
        assert!((lon + 46.633).abs() < f64::EPSILON);
        assert_eq!(key, "-23.551,-46.633");
    }

    #[test]
    fn bearing_is_in_portuguese() {
        assert_eq!(bearing(0.0, 0.0, 1.0, 0.0), "N");
        assert_eq!(bearing(0.0, 0.0, 0.0, 1.0), "L");
        assert_eq!(bearing(0.0, 0.0, -1.0, 0.0), "S");
    }

    #[test]
    fn parses_wkt() {
        assert_eq!(
            parse_wkt_point("Point(-46.6333 -23.5505)"),
            Some((-23.5505, -46.6333))
        );
    }

    #[test]
    fn filters_maps_and_flags_without_rejecting_city_photos() {
        assert!(!is_bad_image(
            "https://upload.wikimedia.org/wikipedia/commons/Brasilia_panorama.jpg"
        ));
        assert!(is_bad_image(
            "https://upload.wikimedia.org/wikipedia/commons/Flag_of_Brazil.svg"
        ));
        assert!(is_bad_image(
            "https://upload.wikimedia.org/wikipedia/commons/Location_map_Brazil.svg"
        ));
    }
}
