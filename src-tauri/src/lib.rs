use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Serialize, Deserialize, Clone)]
pub struct HourlyForecast {
    pub time: String,
    pub temperature: f64,
    pub weather_code: u32,
    pub icon: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DailyForecast {
    pub date: String,
    pub temp_max: f64,
    pub temp_min: f64,
    pub weather_code: u32,
    pub icon: String,
    pub description: String,
    pub sunrise: String,
    pub sunset: String,
    pub uv_index_max: f64,
    pub precipitation_sum: f64,
    pub precipitation_probability_max: u32,
}

#[derive(Serialize, Deserialize)]
pub struct WeatherData {
    pub location: String,
    pub country: String,
    pub temperature: f64,
    pub feels_like: f64,
    pub humidity: u32,
    pub description: String,
    pub icon: String,
    pub wind_speed: f64,
    // New fields
    pub pressure: f64,
    pub cloud_cover: u32,
    pub visibility: f64,
    pub wind_direction: u32,
    pub hourly: Vec<HourlyForecast>,
    pub daily: Vec<DailyForecast>,
}

// Open-Meteo Geocoding response
#[derive(Deserialize)]
struct GeoResponse {
    results: Option<Vec<GeoResult>>,
}

#[derive(Deserialize)]
struct GeoResult {
    name: String,
    country: String,
    latitude: f64,
    longitude: f64,
}

// Reverse Geocoding response
#[derive(Deserialize)]
struct ReverseGeoResponse {
    address: Option<ReverseGeoAddress>,
}

#[derive(Deserialize)]
struct ReverseGeoAddress {
    city: Option<String>,
    town: Option<String>,
    village: Option<String>,
    municipality: Option<String>,
    country: Option<String>,
}

// Open-Meteo Weather response
#[derive(Deserialize)]
struct OpenMeteoResponse {
    current: CurrentWeather,
    hourly: HourlyWeather,
    daily: DailyWeather,
}

#[derive(Deserialize)]
struct CurrentWeather {
    temperature_2m: f64,
    apparent_temperature: f64,
    relative_humidity_2m: u32,
    weather_code: u32,
    wind_speed_10m: f64,
    surface_pressure: f64,
    cloud_cover: u32,
    visibility: f64,
    wind_direction_10m: u32,
}

#[derive(Deserialize)]
struct HourlyWeather {
    time: Vec<String>,
    temperature_2m: Vec<f64>,
    weather_code: Vec<u32>,
}

#[derive(Deserialize)]
struct DailyWeather {
    time: Vec<String>,
    temperature_2m_max: Vec<f64>,
    temperature_2m_min: Vec<f64>,
    weather_code: Vec<u32>,
    sunrise: Vec<String>,
    sunset: Vec<String>,
    uv_index_max: Vec<f64>,
    precipitation_sum: Vec<f64>,
    precipitation_probability_max: Vec<u32>,
}

fn get_weather_description(code: u32) -> (&'static str, &'static str) {
    match code {
        0 => ("Clear sky", "☀️"),
        1 => ("Mainly clear", "🌤️"),
        2 => ("Partly cloudy", "⛅"),
        3 => ("Overcast", "☁️"),
        45 | 48 => ("Foggy", "🌫️"),
        51 | 53 | 55 => ("Drizzle", "🌧️"),
        56 | 57 => ("Freezing drizzle", "🌧️"),
        61 | 63 | 65 => ("Rain", "🌧️"),
        66 | 67 => ("Freezing rain", "🌧️"),
        71 | 73 | 75 => ("Snow", "🌨️"),
        77 => ("Snow grains", "🌨️"),
        80 | 81 | 82 => ("Rain showers", "🌦️"),
        85 | 86 => ("Snow showers", "🌨️"),
        95 => ("Thunderstorm", "⛈️"),
        96 | 99 => ("Thunderstorm with hail", "⛈️"),
        _ => ("Unknown", "🌡️"),
    }
}

#[tauri::command]
async fn get_weather(city: String) -> Result<WeatherData, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    // First, geocode the city name to get coordinates
    let geo_url = format!(
        "https://geocoding-api.open-meteo.com/v1/search?name={}&count=1&language=en&format=json",
        city
    );
    
    let geo_response = client.get(&geo_url)
        .send()
        .await
        .map_err(|e| format!("Failed to geocode city: {}", e))?;
    
    let geo_data: GeoResponse = geo_response
        .json()
        .await
        .map_err(|e| format!("Failed to parse geocoding response: {}", e))?;
    
    let location = geo_data.results
        .and_then(|r| r.into_iter().next())
        .ok_or_else(|| "City not found".to_string())?;
    
    // Fetch weather with extended data
    let weather_url = format!(
        "https://api.open-meteo.com/v1/forecast?latitude={}&longitude={}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,surface_pressure,cloud_cover,visibility,wind_direction_10m&hourly=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max&timezone=auto&forecast_days=7",
        location.latitude, location.longitude
    );
    
    let weather_response = client.get(&weather_url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch weather: {}", e))?;
    
    if !weather_response.status().is_success() {
        return Err(format!("Weather API error: {}", weather_response.status()));
    }
    
    let weather_data: OpenMeteoResponse = weather_response
        .json()
        .await
        .map_err(|e| format!("Failed to parse weather response: {}", e))?;
    
    let (description, icon) = get_weather_description(weather_data.current.weather_code);
    
    // Build hourly forecast (next 24 hours)
    let hourly: Vec<HourlyForecast> = weather_data.hourly.time.iter()
        .take(24)
        .enumerate()
        .map(|(i, time)| {
            let (_, hourly_icon) = get_weather_description(weather_data.hourly.weather_code[i]);
            HourlyForecast {
                time: time.clone(),
                temperature: weather_data.hourly.temperature_2m[i],
                weather_code: weather_data.hourly.weather_code[i],
                icon: hourly_icon.to_string(),
            }
        })
        .collect();
    
    // Build daily forecast
    let daily: Vec<DailyForecast> = weather_data.daily.time.iter()
        .enumerate()
        .map(|(i, date)| {
            let (daily_desc, daily_icon) = get_weather_description(weather_data.daily.weather_code[i]);
            DailyForecast {
                date: date.clone(),
                temp_max: weather_data.daily.temperature_2m_max[i],
                temp_min: weather_data.daily.temperature_2m_min[i],
                weather_code: weather_data.daily.weather_code[i],
                icon: daily_icon.to_string(),
                description: daily_desc.to_string(),
                sunrise: weather_data.daily.sunrise[i].clone(),
                sunset: weather_data.daily.sunset[i].clone(),
                uv_index_max: weather_data.daily.uv_index_max[i],
                precipitation_sum: weather_data.daily.precipitation_sum[i],
                precipitation_probability_max: weather_data.daily.precipitation_probability_max[i],
            }
        })
        .collect();
    
    Ok(WeatherData {
        location: location.name,
        country: location.country,
        temperature: weather_data.current.temperature_2m,
        feels_like: weather_data.current.apparent_temperature,
        humidity: weather_data.current.relative_humidity_2m,
        description: description.to_string(),
        icon: icon.to_string(),
        wind_speed: weather_data.current.wind_speed_10m,
        pressure: weather_data.current.surface_pressure,
        cloud_cover: weather_data.current.cloud_cover,
        visibility: weather_data.current.visibility / 1000.0, // Convert to km
        wind_direction: weather_data.current.wind_direction_10m,
        hourly,
        daily,
    })
}

#[tauri::command]
async fn get_weather_by_coords(lat: f64, lon: f64) -> Result<WeatherData, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    // Reverse geocode to get location name using Nominatim (OpenStreetMap)
    let reverse_geo_url = format!(
        "https://nominatim.openstreetmap.org/reverse?format=json&lat={}&lon={}",
        lat, lon
    );
    
    let reverse_response = client.get(&reverse_geo_url)
        .header("User-Agent", "WeatherApp/1.0")
        .send()
        .await
        .map_err(|e| format!("Failed to reverse geocode: {}", e))?;
    
    let reverse_data: ReverseGeoResponse = reverse_response
        .json()
        .await
        .map_err(|e| format!("Failed to parse reverse geocoding response: {}", e))?;
    
    let location_name = reverse_data.address
        .as_ref()
        .and_then(|addr| {
            addr.city.clone()
                .or_else(|| addr.town.clone())
                .or_else(|| addr.village.clone())
                .or_else(|| addr.municipality.clone())
        })
        .unwrap_or_else(|| format!("{:.2}, {:.2}", lat, lon));
    
    let country_name = reverse_data.address
        .as_ref()
        .and_then(|addr| addr.country.clone())
        .unwrap_or_else(|| "Unknown".to_string());
    
    // Fetch weather with extended data
    let weather_url = format!(
        "https://api.open-meteo.com/v1/forecast?latitude={}&longitude={}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,surface_pressure,cloud_cover,visibility,wind_direction_10m&hourly=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max&timezone=auto&forecast_days=7",
        lat, lon
    );
    
    let weather_response = client.get(&weather_url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch weather: {}", e))?;
    
    if !weather_response.status().is_success() {
        return Err(format!("Weather API error: {}", weather_response.status()));
    }
    
    let weather_data: OpenMeteoResponse = weather_response
        .json()
        .await
        .map_err(|e| format!("Failed to parse weather response: {}", e))?;
    
    let (description, icon) = get_weather_description(weather_data.current.weather_code);
    
    // Build hourly forecast (next 24 hours)
    let hourly: Vec<HourlyForecast> = weather_data.hourly.time.iter()
        .take(24)
        .enumerate()
        .map(|(i, time)| {
            let (_, hourly_icon) = get_weather_description(weather_data.hourly.weather_code[i]);
            HourlyForecast {
                time: time.clone(),
                temperature: weather_data.hourly.temperature_2m[i],
                weather_code: weather_data.hourly.weather_code[i],
                icon: hourly_icon.to_string(),
            }
        })
        .collect();
    
    // Build daily forecast
    let daily: Vec<DailyForecast> = weather_data.daily.time.iter()
        .enumerate()
        .map(|(i, date)| {
            let (daily_desc, daily_icon) = get_weather_description(weather_data.daily.weather_code[i]);
            DailyForecast {
                date: date.clone(),
                temp_max: weather_data.daily.temperature_2m_max[i],
                temp_min: weather_data.daily.temperature_2m_min[i],
                weather_code: weather_data.daily.weather_code[i],
                icon: daily_icon.to_string(),
                description: daily_desc.to_string(),
                sunrise: weather_data.daily.sunrise[i].clone(),
                sunset: weather_data.daily.sunset[i].clone(),
                uv_index_max: weather_data.daily.uv_index_max[i],
                precipitation_sum: weather_data.daily.precipitation_sum[i],
                precipitation_probability_max: weather_data.daily.precipitation_probability_max[i],
            }
        })
        .collect();
    
    Ok(WeatherData {
        location: location_name,
        country: country_name,
        temperature: weather_data.current.temperature_2m,
        feels_like: weather_data.current.apparent_temperature,
        humidity: weather_data.current.relative_humidity_2m,
        description: description.to_string(),
        icon: icon.to_string(),
        wind_speed: weather_data.current.wind_speed_10m,
        pressure: weather_data.current.surface_pressure,
        cloud_cover: weather_data.current.cloud_cover,
        visibility: weather_data.current.visibility / 1000.0, // Convert to km
        wind_direction: weather_data.current.wind_direction_10m,
        hourly,
        daily,
    })
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:weather.db", vec![
                    tauri_plugin_sql::Migration {
                        version: 1,
                        description: "Create settings table",
                        sql: "CREATE TABLE IF NOT EXISTS settings (
                            key TEXT PRIMARY KEY,
                            value TEXT NOT NULL
                        );",
                        kind: tauri_plugin_sql::MigrationKind::Up,
                    },
                    tauri_plugin_sql::Migration {
                        version: 2,
                        description: "Create locations table",
                        sql: "CREATE TABLE IF NOT EXISTS locations (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            name TEXT NOT NULL UNIQUE,
                            country TEXT NOT NULL,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        );",
                        kind: tauri_plugin_sql::MigrationKind::Up,
                    }
                ])
                .build()
        )
        .invoke_handler(tauri::generate_handler![greet, get_weather, get_weather_by_coords])
        .plugin(tauri_plugin_geolocation::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
