import type { Waypoint, WeatherPoint } from '../types';
import { parseStamp } from './itinerary';

/**
 * Placeholder weather source.
 *
 * REPLACE ME: `generateProfile` is the single seam for a real weather API. It is
 * already async and produces samples keyed on position + timestamp, so swapping
 * the body for an HTTP call (Open-Meteo, Meteomatics, StormGeo, …) needs no
 * change anywhere else — the chart, the data model and persistence stay as they
 * are.
 *
 * Until then the values are synthetic: a latitude/season climatology, a diurnal
 * cycle on air temperature, and smooth low-frequency noise so the series looks
 * like a weather profile rather than white noise. They carry no meteorological
 * meaning.
 */

export interface SeriesField {
  key: 'airTemp' | 'seawaterTemp' | 'relativeHumidity' | 'solarRadiation';
  label: string;
  unit: string;
}

export const SERIES_FIELDS: SeriesField[] = [
  { key: 'airTemp', label: 'Air temperature', unit: '°C' },
  { key: 'seawaterTemp', label: 'Seawater temperature', unit: '°C' },
  { key: 'relativeHumidity', label: 'Relative humidity', unit: '%' },
  { key: 'solarRadiation', label: 'Solar radiation', unit: 'W/m²' },
];

export const INTERVAL_OPTIONS = [1, 3, 6] as const;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round = (v: number, d = 1) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

/**
 * Day-month-hour stamps from step 2 carry no year; `parseStamp` anchors them
 * to a fixed reference year so they still resolve to real instants here.
 */
const timeOf = parseStamp;

/** First and last instant the itinerary covers, or null if times are missing. */
export function timeRange(waypoints: Waypoint[]): { start: number; end: number } | null {
  const stamps = waypoints
    .flatMap((w) => [timeOf(w.arrival), timeOf(w.departure)])
    .filter((t): t is number => t !== null);
  if (stamps.length < 2) return null;
  const start = Math.min(...stamps);
  const end = Math.max(...stamps);
  return end > start ? { start, end } : null;
}

/**
 * Where the vessel is at time `t`: alongside if within a stop's window,
 * otherwise interpolated along the leg by elapsed fraction.
 */
export function positionAt(waypoints: Waypoint[], t: number): { lat: number; lon: number } {
  const first = waypoints[0];
  for (let i = 0; i < waypoints.length; i += 1) {
    const wp = waypoints[i];
    const arrive = timeOf(wp.arrival);
    const depart = timeOf(wp.departure);

    if (arrive !== null && depart !== null && t >= arrive && t <= depart) {
      return { lat: wp.lat, lon: wp.lon };
    }

    const next = waypoints[i + 1];
    if (!next) continue;
    const legStart = depart ?? arrive;
    const legEnd = timeOf(next.arrival) ?? timeOf(next.departure);
    if (legStart !== null && legEnd !== null && t > legStart && t < legEnd) {
      const f = (t - legStart) / (legEnd - legStart);
      return {
        lat: wp.lat + (next.lat - wp.lat) * f,
        lon: wp.lon + (next.lon - wp.lon) * f,
      };
    }
  }
  // Before the first stop or after the last one.
  const last = waypoints[waypoints.length - 1] ?? first;
  const firstTime = timeOf(first?.arrival ?? '') ?? timeOf(first?.departure ?? '');
  if (firstTime !== null && t < firstTime) return { lat: first.lat, lon: first.lon };
  return { lat: last.lat, lon: last.lon };
}

/** Sum of three sines — smooth, aperiodic-looking variation over hours. */
export const makeWave = () => {
  const phases = [Math.random(), Math.random(), Math.random()];
  return (hours: number) =>
    0.55 * Math.sin(2 * Math.PI * (hours / 53 + phases[0])) +
    0.3 * Math.sin(2 * Math.PI * (hours / 19 + phases[1])) +
    0.15 * Math.sin(2 * Math.PI * (hours / 7 + phases[2]));
};

/**
 * Clear-sky global irradiance on a horizontal surface, W/m².
 *
 * Uses the real solar-elevation geometry — declination from day of year, hour
 * angle from local solar time — so daylength varies with latitude and season,
 * and polar day and polar night both fall out of it correctly. `cloud` is the
 * fraction of clear-sky that reaches the surface.
 */
export function solarIrradiance(lat: number, lon: number, date: Date, cloud: number): number {
  const dayOfYear =
    (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) -
      Date.UTC(date.getUTCFullYear(), 0, 0)) /
    86_400_000;
  const rad = Math.PI / 180;
  const declination = 23.45 * Math.sin(2 * Math.PI * ((284 + dayOfYear) / 365));
  // Local solar time from longitude, so noon is noon wherever the ship is.
  const solarHour = date.getUTCHours() + date.getUTCMinutes() / 60 + lon / 15;
  const hourAngle = 15 * (solarHour - 12);
  const sinElevation =
    Math.sin(lat * rad) * Math.sin(declination * rad) +
    Math.cos(lat * rad) * Math.cos(declination * rad) * Math.cos(hourAngle * rad);
  return sinElevation <= 0 ? 0 : 1090 * sinElevation * cloud;
}

/** Mean air and sea temperature for a latitude and month. */
export function climatology(lat: number, month: number) {
  const absLat = Math.abs(lat);
  const declination = 23.45 * Math.sin(((month + 1 - 3) / 12) * 2 * Math.PI);
  const summerness = (lat >= 0 ? declination : -declination) / 23.45;
  const air = 29 - 0.45 * absLat + 0.22 * absLat * summerness;
  // The sea is milder than the air: warmer in winter, cooler in summer, and
  // never below its freezing point.
  const sea = clamp(27.5 - 0.38 * absLat + 0.1 * absLat * summerness, -1.8, 32);
  return { air, sea };
}

function buildSeries(waypoints: Waypoint[], intervalHours: number): WeatherPoint[] {
  const range = timeRange(waypoints);
  if (!range) return [];

  const stepMs = intervalHours * 3_600_000;
  const count = Math.floor((range.end - range.start) / stepMs) + 1;
  // Guard against a very long route at a fine interval.
  const capped = Math.min(count, 2000);

  const waveAir = makeWave();
  const waveSea = makeWave();
  const waveRh = makeWave();
  const waveCloud = makeWave();

  const points: WeatherPoint[] = [];
  for (let i = 0; i < capped; i += 1) {
    const ms = range.start + i * stepMs;
    const date = new Date(ms);
    const hours = i * intervalHours;
    const { lat, lon } = positionAt(waypoints, ms);
    const mean = climatology(lat, date.getMonth());

    // Air: climatology + daily cycle (small at sea) + weather systems.
    const diurnal = 2.4 * Math.sin(2 * Math.PI * ((date.getHours() - 9) / 24));
    const airAnomaly = diurnal + 3.6 * waveAir(hours);
    const airTemp = mean.air + airAnomaly;

    // Sea: same climatology, far more damped, no daily cycle.
    const seawaterTemp = clamp(mean.sea + 0.9 * waveSea(hours), -1.8, 34);

    // Humidity moves against the air-temperature anomaly.
    const relativeHumidity = clamp(
      82 - 0.16 * Math.abs(lat) - 1.4 * airAnomaly + 9 * waveRh(hours),
      25,
      100,
    );

    // Cloud cover drifts slowly; 0.35 overcast to 1.0 clear.
    const cloud = clamp(0.68 + 0.32 * waveCloud(hours), 0.35, 1);

    points.push({
      time: date.toISOString(),
      lat: round(lat, 3),
      lon: round(lon, 3),
      airTemp: round(clamp(airTemp, -35, 45)),
      seawaterTemp: round(seawaterTemp),
      relativeHumidity: round(relativeHumidity, 0),
      solarRadiation: Math.round(solarIrradiance(lat, lon, date, cloud)),
    });
  }
  return points;
}

/** The weather profile over the whole itinerary. */
export async function generateProfile(
  waypoints: Waypoint[],
  intervalHours: number,
): Promise<WeatherPoint[]> {
  return buildSeries(waypoints, intervalHours);
}

export interface ProfileStats {
  count: number;
  spanHours: number;
  airTemp: { min: number; max: number; mean: number };
  seawaterTemp: { min: number; max: number; mean: number };
  relativeHumidity: { min: number; max: number; mean: number };
  solarRadiation: { min: number; max: number; mean: number };
}

const stat = (values: number[]) => ({
  min: round(Math.min(...values)),
  max: round(Math.max(...values)),
  mean: round(values.reduce((s, v) => s + v, 0) / values.length),
});

export function summarise(series: WeatherPoint[]): ProfileStats | null {
  if (series.length === 0) return null;
  const first = new Date(series[0].time).getTime();
  const last = new Date(series[series.length - 1].time).getTime();
  return {
    count: series.length,
    spanHours: Math.round((last - first) / 3_600_000),
    airTemp: stat(series.map((p) => p.airTemp)),
    seawaterTemp: stat(series.map((p) => p.seawaterTemp)),
    relativeHumidity: stat(series.map((p) => p.relativeHumidity)),
    solarRadiation: stat(series.map((p) => p.solarRadiation)),
  };
}
