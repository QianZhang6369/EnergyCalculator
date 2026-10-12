import { getRegion, type AnnualPlan, type Region } from '../data/regions';
import type { HourlyYear } from '../types';

/**
 * Placeholder weather source.
 *
 * A region with measured hourly data (`region.hourly`) uses it, both for the
 * monthly means shown in step 2 and hour by hour in the results. Every other
 * region falls back to the model below.
 *
 * REPLACE ME: the fallback is synthetic. The values come from a
 * latitude/season climatology, a diurnal cycle on air temperature, and smooth
 * low-frequency noise so an hourly series looks like weather rather than white
 * noise. They carry no meteorological meaning. Because the model only knows
 * latitude and season, warm-water regions read too cool in winter and humidity
 * does not change with the season. Per-region climate tables (or a weather
 * API) would replace `climatology`, `meanHumidity` and `MEAN_CLOUD`.
 */

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Mean fraction of clear-sky irradiance reaching the surface. */
export const MEAN_CLOUD = 0.68;

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

/** Mean relative humidity for a latitude, %. Drier towards the poles. */
export const meanHumidity = (lat: number) => 82 - 0.16 * Math.abs(lat);

/** Hours the vessel takes to work through a region's latitudes and back. */
const REGION_CYCLE_HOURS = 168;

/**
 * Latitude within a region at a given hour: the vessel moves steadily through
 * the region's representative latitudes and returns to the first, once a week.
 */
export function regionLatitudeAt(region: Region, hour: number): number {
  const n = region.lats.length;
  const position = ((hour % REGION_CYCLE_HOURS) / REGION_CYCLE_HOURS) * n;
  const i = Math.floor(position);
  const from = region.lats[i % n];
  const to = region.lats[(i + 1) % n];
  return from + (to - from) * (position - i);
}

/** Monthly mean conditions in one region. */
export interface MonthlyMeans {
  /**
   * Air temperature, °C, with its range: the lowest and highest hour of the
   * month for measured data, the spread across the region's latitudes otherwise.
   */
  airTemp: number;
  airTempLow: number;
  airTempHigh: number;
  /** Seawater temperature, °C. */
  seawaterTemp: number;
  /** Relative humidity, %. */
  relativeHumidity: number;
  /** Solar irradiance averaged over all 24 hours of the day, W/m². */
  solarRadiation: number;
}

const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length;

/** 24-hour mean irradiance at mid-month under mean cloud cover. */
function dailyMeanSolar(lat: number, month: number): number {
  let sum = 0;
  for (let h = 0; h < 24; h += 1) {
    // 2001 is not a leap year; longitude 0 so UTC is local solar time.
    sum += solarIrradiance(lat, 0, new Date(Date.UTC(2001, month, 15, h, 30)), MEAN_CLOUD);
  }
  return sum / 24;
}

/** First hour of each month in a non-leap year, plus the year end. */
const MONTH_START_HOUR = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365].map(
  (day) => day * 24,
);

/** Monthly means of a measured year, worked out once per region. */
const measuredMeans = new Map<string, MonthlyMeans[]>();

function measuredMonthlyMeans(region: Region, hourly: HourlyYear): MonthlyMeans[] {
  const cached = measuredMeans.get(region.id);
  if (cached) return cached;
  const months = MONTH_START_HOUR.slice(0, 12).map((start, m) => {
    const end = MONTH_START_HOUR[m + 1];
    const air = hourly.airTemp.slice(start, end);
    return {
      airTemp: mean(air),
      airTempLow: Math.min(...air),
      airTempHigh: Math.max(...air),
      seawaterTemp: mean(hourly.seawaterTemp.slice(start, end)),
      relativeHumidity: mean(hourly.relativeHumidity.slice(start, end)),
      solarRadiation: mean(hourly.solarRadiation.slice(start, end)),
    };
  });
  measuredMeans.set(region.id, months);
  return months;
}

export function monthlyMeans(region: Region, month: number): MonthlyMeans {
  if (region.hourly) return measuredMonthlyMeans(region, region.hourly)[month];
  const climates = region.lats.map((lat) => climatology(lat, month));
  const air = climates.map((c) => c.air);
  return {
    airTemp: mean(air),
    airTempLow: Math.min(...air),
    airTempHigh: Math.max(...air),
    seawaterTemp: mean(climates.map((c) => c.sea)),
    relativeHumidity: mean(region.lats.map(meanHumidity)),
    solarRadiation: mean(region.lats.map((lat) => dailyMeanSolar(lat, month))),
  };
}

/** The twelve monthly means of an annual plan, January first. */
export const planMeans = (plan: AnnualPlan): MonthlyMeans[] =>
  plan.map((id, month) => monthlyMeans(getRegion(id), month));
