import { WeatherData } from '../types';

export const fetchRaceWeather = async (lat: number, lon: number, dateStr: string): Promise<WeatherData | undefined> => {
  try {
    // Open-Meteo API (No key required for basic usage)
    // Format: YYYY-MM-DD
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,precipitation_probability_max,wind_speed_10m_max&start_date=${dateStr}&end_date=${dateStr}&timezone=auto`;
    
    const response = await fetch(url);
    if (!response.ok) return undefined;
    
    const data = await response.json();
    
    if (!data.daily || !data.daily.time || data.daily.time.length === 0) {
        return undefined;
    }

    return {
      temperatureMax: data.daily.temperature_2m_max[0],
      precipitationProb: data.daily.precipitation_probability_max[0],
      windSpeed: data.daily.wind_speed_10m_max[0],
      conditionCode: data.daily.weather_code[0]
    };
  } catch (error) {
    console.error("Weather fetch failed:", error);
    return undefined;
  }
};

export const getWeatherIcon = (code: number): string => {
  // WMO Weather interpretation codes (http://www.wmo.int/pages/prog/www/IMOP/publications/CIMO-Guide/CIMO_Guide-7th_Edition-2008/Part-I/Chapter-14.pdf)
  if (code === 0) return '☀️'; // Clear sky
  if (code === 1 || code === 2 || code === 3) return 'cloud'; // Mainly clear, partly cloudy, and overcast
  if (code >= 45 && code <= 48) return '🌫️'; // Fog
  if (code >= 51 && code <= 67) return '🌧️'; // Drizzle / Rain
  if (code >= 71 && code <= 77) return '❄️'; // Snow
  if (code >= 80 && code <= 82) return '🌦️'; // Rain showers
  if (code >= 95) return '⛈️'; // Thunderstorm
  return '🌡️';
};

export const getWeatherDescription = (code: number): string => {
    if (code === 0) return 'Clear Sky';
    if (code <= 3) return 'Cloudy';
    if (code <= 48) return 'Foggy';
    if (code <= 67) return 'Rainy';
    if (code <= 77) return 'Snowy';
    if (code >= 95) return 'Thunderstorms';
    return 'Variable';
};