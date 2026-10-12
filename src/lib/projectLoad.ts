import { getRegion, regionsInPlan, type AnnualPlan } from '../data/regions';
import { zoneAirOf, type AirSetup } from './airSystems';
import {
  DEFAULT_ROOM_HUMIDITY_PCT,
  DEFAULT_ROOM_SETPOINT_C,
  ahuParamsOf,
  type HvacDesign,
  type LoadDesign,
} from './hvacDesign';
import {
  computeProjectLoad,
  computeZoneLoad,
  type ProjectLoadResult,
  type WeatherHour,
  type ZoneLoadResult,
} from './loadCalc';
import { generateYear } from './weather';
import type { Zone } from './zones';

/**
 * Bridges the project to the load calculation in `loadCalc.ts`: the weather
 * comes from the annual plan of step 2, the rest from steps 1, 3 and 4.
 */

/** The hourly data is for 2025, a year of 8760 hours. */
const WEATHER_YEAR = 2025;

/**
 * One year of hourly weather for the plan. Regions with measured data supply
 * their own hours; the others are synthetic and differ on every call.
 */
export function weatherRows(plan: AnnualPlan): WeatherHour[] {
  return generateYear(plan, WEATHER_YEAR).map((w) => ({
    time: w.time.slice(0, 19).replace('T', ' '),
    temp_C: w.airTemp,
    rh_pct: w.relativeHumidity,
    solarMean_Wm2: w.solarRadiation,
  }));
}

/** Short name of the weather behind a plan, e.g. for a file name. */
export const weatherLabel = (plan: AnnualPlan) =>
  regionsInPlan(plan)
    .map((id) => getRegion(id).code)
    .join('-');

const loadDesign = (air: AirSetup, hvac: HvacDesign): LoadDesign => ({
  ...hvac.params,
  terminalFanPercentile: air.terminalFanPercentile,
  terminalFanOversizing: air.terminalFanOversizing,
});

export function projectLoad(
  zones: Zone[],
  air: AirSetup,
  hvac: HvacDesign,
  rows: WeatherHour[],
  label: string,
): ProjectLoadResult {
  return computeProjectLoad(
    zones,
    (uid) => zoneAirOf(air, uid),
    (ahuId) => ahuParamsOf(hvac, ahuId),
    (uid) => hvac.roomSetpoints[uid] ?? DEFAULT_ROOM_SETPOINT_C,
    (uid) => hvac.roomHumidity[uid] ?? DEFAULT_ROOM_HUMIDITY_PCT,
    loadDesign(air, hvac),
    air.ahus,
    rows,
    label,
  );
}

/** The full hourly load of one room group. */
export function zoneLoad(
  zone: Zone,
  air: AirSetup,
  hvac: HvacDesign,
  rows: WeatherHour[],
): ZoneLoadResult {
  const cfg = zoneAirOf(air, zone.uid);
  return computeZoneLoad(
    zone,
    cfg,
    ahuParamsOf(hvac, cfg.ahuId ?? ''),
    loadDesign(air, hvac),
    hvac.roomSetpoints[zone.uid] ?? DEFAULT_ROOM_SETPOINT_C,
    hvac.roomHumidity[zone.uid] ?? DEFAULT_ROOM_HUMIDITY_PCT,
    rows,
  );
}
