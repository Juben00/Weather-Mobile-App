import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import * as geolocation from "@tauri-apps/plugin-geolocation";
import Database from "@tauri-apps/plugin-sql";
import { Button } from "@/components/ui/button";
import { IoArrowBack, IoLocation, IoLocationOutline, IoNavigate, IoTrashOutline, IoAddCircleOutline, IoSunny, IoMoon, IoWater, IoUmbrella } from "react-icons/io5";
import { WiHumidity, WiStrongWind, WiThermometer, WiBarometer, WiCloudy, WiWindDeg } from "react-icons/wi";
import { MdVisibility } from "react-icons/md";

interface WeatherProps {
    isDarkMode: boolean;
}

interface HourlyForecast {
    time: string;
    temperature: number;
    weather_code: number;
    icon: string;
}

interface DailyForecast {
    date: string;
    temp_max: number;
    temp_min: number;
    weather_code: number;
    icon: string;
    description: string;
    sunrise: string;
    sunset: string;
    uv_index_max: number;
    precipitation_sum: number;
    precipitation_probability_max: number;
}

interface WeatherData {
    location: string;
    country: string;
    temperature: number;
    feels_like: number;
    humidity: number;
    description: string;
    icon: string;
    wind_speed: number;
    pressure: number;
    cloud_cover: number;
    visibility: number;
    wind_direction: number;
    hourly: HourlyForecast[];
    daily: DailyForecast[];
}

interface SavedLocation {
    id: number;
    name: string;
    country: string;
}

// Helper to format time from ISO string
const formatHour = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

// Helper to format date
const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};

// Helper to format just the day name
const formatDayName = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString([], { weekday: 'short' });
};

// Helper to get wind direction as compass
const getWindDirection = (degrees: number) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
};

// Helper to get UV index level
const getUVLevel = (uv: number) => {
    if (uv <= 2) return { label: 'Low', color: 'text-green-500' };
    if (uv <= 5) return { label: 'Moderate', color: 'text-yellow-500' };
    if (uv <= 7) return { label: 'High', color: 'text-orange-500' };
    if (uv <= 10) return { label: 'Very High', color: 'text-red-500' };
    return { label: 'Extreme', color: 'text-purple-500' };
};

export default function Weather({ }: WeatherProps) {
    const navigate = useNavigate();
    const [city, setCity] = useState("");
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(false);
    const [gpsLoading, setGpsLoading] = useState(false);
    const [error, setError] = useState("");
    const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);

    // Load saved locations from database on mount
    useEffect(() => {
        loadSavedLocations();
    }, []);

    const loadSavedLocations = async () => {
        try {
            const db = await Database.load("sqlite:weather.db");
            const result = await db.select<SavedLocation[]>(
                "SELECT id, name, country FROM locations ORDER BY created_at DESC"
            );
            setSavedLocations(result);
        } catch (err) {
            console.error("Failed to load saved locations:", err);
        }
    };

    const searchWeather = async (searchCity?: string) => {
        const cityToSearch = searchCity || city;
        if (!cityToSearch.trim()) return;

        setLoading(true);
        setError("");

        try {
            const data = await invoke<WeatherData>("get_weather", { city: cityToSearch });
            setWeather(data);
        } catch (err) {
            setError(err as string);
            setWeather(null);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        searchWeather();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            searchWeather();
        }
    };

    const getLocationWeather = async () => {
        setGpsLoading(true);
        setError("");

        try {
            // Check and request permissions
            let permissions = await geolocation.checkPermissions();

            if (permissions.location !== "granted") {
                permissions = await geolocation.requestPermissions(["location"]);
            }

            if (permissions.location !== "granted") {
                setError("Location permission denied. Please enable location access in your device settings.");
                return;
            }

            // Get current position
            const position = await geolocation.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0,
            });

            // Fetch weather using coordinates
            const data = await invoke<WeatherData>("get_weather_by_coords", {
                lat: position.coords.latitude,
                lon: position.coords.longitude,
            });

            setWeather(data);
            setCity(data.location);
        } catch (err) {
            console.error("GPS error:", err);
            setError(typeof err === "string" ? err : "Failed to get your location. Please try searching manually.");
            setWeather(null);
        } finally {
            setGpsLoading(false);
        }
    };

    const saveCurrentLocation = async () => {
        if (weather) {
            try {
                const db = await Database.load("sqlite:weather.db");
                await db.execute(
                    "INSERT OR IGNORE INTO locations (name, country) VALUES (?, ?)",
                    [weather.location, weather.country]
                );
                await loadSavedLocations();
            } catch (err) {
                console.error("Failed to save location:", err);
            }
        }
    };

    const deleteLocation = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const db = await Database.load("sqlite:weather.db");
            await db.execute("DELETE FROM locations WHERE id = ?", [id]);
            await loadSavedLocations();
        } catch (err) {
            console.error("Failed to delete location:", err);
        }
    };

    const selectSavedLocation = (location: SavedLocation) => {
        setCity(location.name);
        searchWeather(location.name);
    };

    const isLocationSaved = (locationName: string) => {
        return savedLocations.some(loc => loc.name === locationName);
    };

    const toggleSaveLocation = async () => {
        if (!weather) return;
        
        try {
            const db = await Database.load("sqlite:weather.db");
            if (isLocationSaved(weather.location)) {
                // Unsave - delete by name
                await db.execute("DELETE FROM locations WHERE name = ?", [weather.location]);
            } else {
                // Save
                await db.execute(
                    "INSERT OR IGNORE INTO locations (name, country) VALUES (?, ?)",
                    [weather.location, weather.country]
                );
            }
            await loadSavedLocations();
        } catch (err) {
            console.error("Failed to toggle location:", err);
        }
    };

    return (
        <div className="flex flex-col w-full min-h-full">

            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-border/50">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate("/")}
                    className="rounded-full hover:bg-muted"
                >
                    <IoArrowBack size={20} />
                </Button>
                <h1 className="text-xl font-semibold">Weather</h1>
            </div>

            {/* Search */}
            <div className="p-4">
                <div className="flex gap-2 items-stretch">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder="Search city..."
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full h-full pl-4 pr-4 py-2.5 rounded-xl border border-border bg-white dark:bg-muted/30 focus:border-primary/50 transition-colors outline-none text-foreground"
                        />
                    </div>
                    <Button
                        onClick={handleSearch}
                        disabled={loading || gpsLoading}
                        className="rounded-xl px-6 h-auto cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                        {loading ? "..." : "Search"}
                    </Button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="mx-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center">
                    {error}
                </div>
            )}

            {/* Weather Display */}
            <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
                {weather ? (
                    <div className="w-full max-w-md mx-auto space-y-4">
                        {/* Location */}
                        <div className="flex items-center justify-center gap-2">
                            <IoLocation className="text-primary" size={20} />
                            <h2 className="text-2xl font-bold">{weather.location}</h2>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-muted-foreground">{weather.country}</span>
                            <button
                                onClick={toggleSaveLocation}
                                className="ml-1 p-1 rounded-full hover:bg-muted/50 transition-colors"
                                title={isLocationSaved(weather.location) ? "Remove from Saved" : "Save Location"}
                            >
                                {isLocationSaved(weather.location) ? (
                                    <IoLocation className="text-primary" size={18} />
                                ) : (
                                    <IoAddCircleOutline className="text-muted-foreground hover:text-primary" size={18} />
                                )}
                            </button>
                        </div>

                        {/* Main Weather Card */}
                        <div className="bg-linear-to-br from-primary/10 to-primary/5 rounded-3xl p-8 border border-border/50">
                            <div className="text-center">
                                <div className="text-7xl mb-2">{weather.icon}</div>
                                <p className="text-6xl font-bold tracking-tight">{Math.round(weather.temperature)}°</p>
                                <p className="text-lg text-muted-foreground mt-2">{weather.description}</p>
                            </div>
                        </div>

                        {/* Primary Stats Grid */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-muted/30 rounded-2xl p-4 text-center border border-border/50">
                                <WiThermometer className="mx-auto text-primary" size={28} />
                                <p className="text-xs text-muted-foreground mt-1">Feels Like</p>
                                <p className="font-semibold">{Math.round(weather.feels_like)}°</p>
                            </div>
                            <div className="bg-muted/30 rounded-2xl p-4 text-center border border-border/50">
                                <WiHumidity className="mx-auto text-primary" size={28} />
                                <p className="text-xs text-muted-foreground mt-1">Humidity</p>
                                <p className="font-semibold">{weather.humidity}%</p>
                            </div>
                            <div className="bg-muted/30 rounded-2xl p-4 text-center border border-border/50">
                                <WiStrongWind className="mx-auto text-primary" size={28} />
                                <p className="text-xs text-muted-foreground mt-1">Wind</p>
                                <p className="font-semibold">{Math.round(weather.wind_speed)} km/h</p>
                            </div>
                        </div>

                        {/* Extended Stats Grid */}
                        <div className="grid grid-cols-4 gap-2">
                            <div className="bg-muted/30 rounded-xl p-3 text-center border border-border/50">
                                <WiBarometer className="mx-auto text-primary" size={24} />
                                <p className="text-[10px] text-muted-foreground mt-1">Pressure</p>
                                <p className="font-semibold text-sm">{Math.round(weather.pressure)} hPa</p>
                            </div>
                            <div className="bg-muted/30 rounded-xl p-3 text-center border border-border/50">
                                <WiCloudy className="mx-auto text-primary" size={24} />
                                <p className="text-[10px] text-muted-foreground mt-1">Clouds</p>
                                <p className="font-semibold text-sm">{weather.cloud_cover}%</p>
                            </div>
                            <div className="bg-muted/30 rounded-xl p-3 text-center border border-border/50">
                                <MdVisibility className="mx-auto text-primary" size={24} />
                                <p className="text-[10px] text-muted-foreground mt-1">Visibility</p>
                                <p className="font-semibold text-sm">{weather.visibility.toFixed(1)} km</p>
                            </div>
                            <div className="bg-muted/30 rounded-xl p-3 text-center border border-border/50">
                                <WiWindDeg className="mx-auto text-primary" size={24} style={{ transform: `rotate(${weather.wind_direction}deg)` }} />
                                <p className="text-[10px] text-muted-foreground mt-1">Direction</p>
                                <p className="font-semibold text-sm">{getWindDirection(weather.wind_direction)}</p>
                            </div>
                        </div>

                        {/* Today's Details */}
                        {weather.daily.length > 0 && (
                            <div className="bg-muted/30 rounded-2xl p-4 border border-border/50">
                                <h3 className="font-semibold mb-3 text-sm">Today's Details</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex items-center gap-3">
                                        <IoSunny className="text-yellow-500" size={20} />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Sunrise</p>
                                            <p className="font-medium text-sm">{formatHour(weather.daily[0].sunrise)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <IoMoon className="text-blue-400" size={20} />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Sunset</p>
                                            <p className="font-medium text-sm">{formatHour(weather.daily[0].sunset)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <IoSunny className={getUVLevel(weather.daily[0].uv_index_max).color} size={20} />
                                        <div>
                                            <p className="text-xs text-muted-foreground">UV Index</p>
                                            <p className="font-medium text-sm">
                                                {weather.daily[0].uv_index_max.toFixed(1)}
                                                <span className={`ml-1 text-xs ${getUVLevel(weather.daily[0].uv_index_max).color}`}>
                                                    ({getUVLevel(weather.daily[0].uv_index_max).label})
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <IoUmbrella className="text-blue-500" size={20} />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Precipitation</p>
                                            <p className="font-medium text-sm">
                                                {weather.daily[0].precipitation_sum.toFixed(1)} mm
                                                <span className="ml-1 text-xs text-muted-foreground">
                                                    ({weather.daily[0].precipitation_probability_max}%)
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Hourly Forecast */}
                        {weather.hourly.length > 0 && (
                            <div className="bg-muted/30 rounded-2xl p-4 border border-border/50">
                                <h3 className="font-semibold mb-3 text-sm">Hourly Forecast</h3>
                                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                                    {weather.hourly.slice(0, 24).map((hour, index) => (
                                        <div key={index} className="flex-shrink-0 text-center min-w-[60px]">
                                            <p className="text-xs text-muted-foreground">{formatHour(hour.time)}</p>
                                            <div className="text-2xl my-1">{hour.icon}</div>
                                            <p className="font-semibold text-sm">{Math.round(hour.temperature)}°</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 7-Day Forecast */}
                        {weather.daily.length > 0 && (
                            <div className="bg-muted/30 rounded-2xl p-4 border border-border/50">
                                <h3 className="font-semibold mb-3 text-sm">7-Day Forecast</h3>
                                <div className="space-y-2">
                                    {weather.daily.map((day, index) => (
                                        <div key={index} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                                            <div className="flex items-center gap-3 w-24">
                                                <span className="text-2xl">{day.icon}</span>
                                                <span className="text-sm font-medium">{formatDayName(day.date)}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <IoWater size={12} />
                                                <span>{day.precipitation_probability_max}%</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="font-semibold">{Math.round(day.temp_max)}°</span>
                                                <span className="text-muted-foreground">{Math.round(day.temp_min)}°</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="w-full max-w-sm mx-auto">
                        {/* GPS Location Button */}
                        <Button
                            onClick={getLocationWeather}
                            disabled={loading || gpsLoading}
                            variant="outline"
                            className="w-full mb-4 rounded-xl gap-2 p-3"
                        >
                            <IoNavigate size={18} className={gpsLoading ? "animate-pulse" : ""} />
                            {gpsLoading ? "Getting location..." : "Use My Current Location"}
                        </Button>

                        {/* Saved Locations List */}
                        {savedLocations.length > 0 ? (
                            <div className="mb-6">
                                <p className="text-sm text-muted-foreground mb-3 text-center">Saved Locations</p>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {savedLocations.map((location) => (
                                        <div
                                            key={location.id}
                                            onClick={() => selectSavedLocation(location)}
                                            className="flex items-center justify-between bg-linear-to-br from-primary/10 to-primary/5 rounded-xl p-3 border border-border/50 cursor-pointer hover:border-primary/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <IoLocation className="text-primary" size={18} />
                                                <div className="text-left">
                                                    <p className="font-medium">{location.name}</p>
                                                    <p className="text-xs text-muted-foreground">{location.country}</p>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => deleteLocation(location.id, e)}
                                                className="h-8 w-8 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                            >
                                                <IoTrashOutline size={16} />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="mb-6">
                                <p className="text-sm text-muted-foreground mb-3 text-center">Saved Locations</p>
                                <div className="bg-muted/30 rounded-xl p-6 border border-dashed border-border">
                                    <IoLocationOutline className="mx-auto text-muted-foreground mb-2" size={32} />
                                    <p className="text-muted-foreground text-sm text-center">No saved locations</p>
                                    <p className="text-xs text-muted-foreground mt-1 text-center">Search for a city and save it to your list</p>
                                </div>
                            </div>
                        )}

                        <div className="text-6xl mb-4 opacity-30 text-center">🌤️</div>
                        <p className="text-muted-foreground text-center">Search for a city to see the weather</p>
                    </div>
                )}
            </div>

        </div>
    );
}
