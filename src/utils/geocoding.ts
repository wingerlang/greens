/**
 * Comprehensive geocoding utility for mapping race locations.
 * Includes common Swedish cities, international marathon cities, and fuzzy mapping.
 */

export interface LatLon {
    lat: number;
    lon: number;
}

// Extensive cache of common race locations
export const CITY_COORDINATES: Record<string, [number, number]> = {
    // SWEDEN - Main Cities
    'stockholm': [59.3293, 18.0686],
    'göteborg': [57.7089, 11.9746],
    'gothenburg': [57.7089, 11.9746],
    'malmö': [55.6050, 13.0038],
    'uppsala': [59.8586, 17.6389],
    'västerås': [59.6099, 16.5448],
    'örebro': [59.2741, 15.2066],
    'linköping': [58.4108, 15.6214],
    'helsingborg': [56.0465, 12.6945],
    'jönköping': [57.7826, 14.1618],
    'norrköping': [58.5877, 16.1819],
    'lund': [55.7047, 13.1910],
    'umeå': [63.8258, 20.2630],
    'gävle': [60.6749, 17.1413],
    'borås': [57.7210, 12.9401],
    'eskilstuna': [59.3713, 16.5131],
    'halmstad': [56.6745, 12.8578],
    'växjö': [56.8777, 14.8091],
    'karlstad': [59.3793, 13.5036],
    'karlskrona': [56.1612, 15.5869],
    'skellefteå': [64.7507, 20.9528],
    'kalmar': [56.6634, 16.3568],
    'visby': [57.6348, 18.2948],
    'borlänge': [60.4843, 15.4340],
    'lidköping': [58.5032, 13.1534],
    'enköping': [59.6359, 17.0777],
    'trollhättan': [58.2835, 12.2858],
    'falun': [60.6036, 15.6260],
    'nyköping': [58.7527, 17.0083],
    'uddevalla': [58.3477, 11.9298],
    'skövde': [58.3916, 13.8461],
    'hässleholm': [56.1589, 13.7668],
    'varberg': [57.1056, 12.2508],
    'östersund': [63.1767, 14.6361],
    'motala': [58.5350, 15.0340],

    // SWEDEN - Common Race/Outdoor Locations
    'åre': [63.4000, 13.0833],
    'mora': [61.0063, 14.5414],
    'sälen': [61.1605, 13.2662],
    'båstad': [56.4333, 12.8333],
    'lidingö': [59.3667, 18.1333],
    'djurgården': [59.3283, 18.1186],
    'hemavan': [65.8153, 15.0886],
    'abisko': [68.3495, 18.8312],
    'kiruna': [67.8558, 20.2253],
    'rittorp': [58.4500, 14.3333],
    'billingen': [58.4000, 13.8167],
    'idre': [61.8566, 12.7169],
    'funäsdalen': [62.4641, 12.5482],
    'ramundberget': [62.6953, 12.3853],
    'vemdalen': [62.4475, 13.9620],
    'tällberg': [60.8228, 14.9961],
    'rattvik': [60.8858, 15.1167],
    'eksjö': [57.6676, 14.9711],

    // SCANDINAVIA
    'oslo': [59.9139, 10.7522],
    'bergen': [60.3913, 5.3221],
    'stavanger': [58.9700, 5.7331],
    'trondheim': [63.4305, 10.3951],
    'copenhagen': [55.6761, 12.5683],
    'köpenhamn': [55.6761, 12.5683],
    'aarhus': [56.1522, 10.2039],
    'helsinki': [60.1699, 24.9384],
    'helsingfors': [60.1699, 24.9384],
    'rovaniemi': [66.5039, 25.7285],
    'reykjavik': [64.1466, -21.9426],

    // INTERNATIONAL - Major Marathons & Races
    'london': [51.5074, -0.1278],
    'berlin': [52.5200, 13.4050],
    'paris': [48.8566, 2.3522],
    'new york': [40.7128, -74.0060],
    'nyc': [40.7128, -74.0060],
    'boston': [42.3601, -71.0589],
    'chicago': [41.8781, -87.6298],
    'tokyo': [35.6762, 139.6503],
    'amsterdam': [52.3676, 4.9041],
    'rotterdam': [51.9225, 4.4792],
    'valencia': [39.4699, -0.3763],
    'barcelona': [41.3851, 2.1734],
    'madrid': [40.4168, -3.7038],
    'rome': [41.9028, 12.4964],
    'milan': [45.4642, 9.1900],
    'vienna': [48.2082, 16.3738],
    'hamburg': [53.5511, 9.9937],
    'frankfurt': [50.1109, 8.6821],
    'munich': [48.1351, 11.5820],
    'zurich': [47.3769, 8.5417],
    'geneva': [46.2044, 6.1432],
    'chamonix': [45.9237, 6.8694], // UTMB
    'zermatt': [46.0207, 7.7491],
    'courmayeur': [45.7872, 6.9723],
    'athens': [37.9838, 23.7275],
    'dublin': [53.3498, -6.2603],
    'cape town': [-33.9249, 18.4241],
    'sydney': [-33.8688, 151.2093],
};

// Aliases and common abbreviations
const LOCATION_ALIASES: Record<string, string> = {
    'sthlm': 'stockholm',
    'gbg': 'göteborg',
    'gothenburg': 'göteborg',
    'uppsala': 'uppsala',
    'lidingo': 'lidingö',
    'are': 'åre',
    'nyc': 'new york',
    'ny': 'new york',
    'cph': 'copenhagen',
    'kbh': 'copenhagen',
    'köpenhamn': 'copenhagen',
    'helsingfors': 'helsinki',
};

/**
 * Normalizes a location string to a standardized city name.
 */
export function normalizeLocation(location: string): string {
    if (!location) return '';
    
    // 1. Lowercase and trim
    let normalized = location.toLowerCase().trim();
    
    // 2. Remove common prefixes/suffixes like "City", "Marathon", etc.
    normalized = normalized.replace(/\b(marathon|loppet|race|runt|stadslopp|city|centrum|vinter|summer)\b/g, '').trim();
    
    // 3. Take first part before comma or dash
    normalized = normalized.split(/[,|-]/)[0].trim();
    
    // 4. Check aliases
    if (LOCATION_ALIASES[normalized]) {
        return LOCATION_ALIASES[normalized];
    }
    
    return normalized;
}

/**
 * Geocodes a location string, using local cache first, then falling back to an external provider if needed.
 */
const EXTERNAL_CACHE: Record<string, [number, number]> = JSON.parse(localStorage.getItem('greens_geocode_cache') || '{}');
let lastGeocodeTime = 0;

export async function geocodeLocation(location: string): Promise<[number, number] | null> {
    const normalized = normalizeLocation(location);
    
    // 1. Check hardcoded cache
    if (CITY_COORDINATES[normalized]) {
        return CITY_COORDINATES[normalized];
    }
    
    // 2. Check partial matches in hardcoded cache
    for (const [city, coords] of Object.entries(CITY_COORDINATES)) {
        if (normalized.includes(city) || city.includes(normalized)) {
            return coords;
        }
    }

    // 3. Check persistent localStorage cache
    if (EXTERNAL_CACHE[normalized]) {
        return EXTERNAL_CACHE[normalized];
    }
    
    // 4. Fallback to OpenStreetMap Nominatim with rate limiting (1 request per second)
    const now = Date.now();
    const waitTime = Math.max(0, 1100 - (now - lastGeocodeTime)); // 1.1s to be safe
    if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    try {
        lastGeocodeTime = Date.now();
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`, {
            headers: {
                'Accept-Language': 'sv,en',
                'User-Agent': 'GreensApp/1.0' // Good practice for Nominatim
            }
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        
        if (data && data.length > 0) {
            const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
            // Save to cache
            EXTERNAL_CACHE[normalized] = coords;
            localStorage.setItem('greens_geocode_cache', JSON.stringify(EXTERNAL_CACHE));
            return coords;
        }
    } catch (e) {
        console.error(`Geocoding failed for ${location}:`, e);
    }
    
    return null;
}
