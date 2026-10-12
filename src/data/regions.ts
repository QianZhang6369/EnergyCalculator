import type { HourlyYear } from '../types';
import { bergen2025 } from './weather/bergen2025';
import { dubai2025 } from './weather/dubai2025';

/**
 * Step 2 — operating regions.
 *
 * The year is planned month by month: each month has one main operating region.
 * A region carries no ports or schedule, only a few representative latitudes
 * spread across it (and one longitude for local solar time). The weather model
 * in `lib/weather.ts` is latitude-and-season based, so that is all it needs.
 *
 * The positions are indicative, picked from typical ports of call. A region
 * with measured data carries it as `hourly`, which then replaces the synthetic
 * model for that region: add one with `scripts/import-weather.mjs`.
 */

export type RegionId = string;

export interface Region {
  id: RegionId;
  name: string;
  /** Three-letter code for tight spots, e.g. the band above the year chart. */
  code: string;
  /** Representative latitudes, °N (negative south). */
  lats: number[];
  /** Representative longitude, °E (negative west). */
  lon: number;
  /** The region's own colour, the same in every plan. */
  color: string;
  /** A measured year of hourly weather; the synthetic model is used without it. */
  hourly?: HourlyYear;
}

const unsorted: Region[] = [
  { id: 'alaska', name: 'Alaska', code: 'ALA', lats: [49.3, 55.3, 58.3, 59.5], lon: -131, color: '#008300' },
  { id: 'antarctic', name: 'Antarctic Peninsula', code: 'ANT', lats: [-54.8, -60, -64.8], lon: -65, color: '#7fb6e8' },
  { id: 'gulf', name: 'Arabian Gulf', code: 'GUL', lats: [25.3, 24.5, 25.3, 23.6], lon: 55, color: '#e34948', hourly: dubai2025 },
  { id: 'arctic', name: 'Arctic & Svalbard', code: 'ARC', lats: [69.7, 74, 78.2], lon: 17, color: '#5c6bc0' },
  { id: 'ausnz', name: 'Australia & NZ', code: 'AUS', lats: [-33.9, -37.8, -42.9, -36.8], lon: 155, color: '#e87ba4' },
  { id: 'baltic', name: 'Baltic', code: 'BAL', lats: [55.7, 59.3, 60.2, 59.4], lon: 20, color: '#4a3aa7' },
  { id: 'canary', name: 'Canary Islands', code: 'CAN', lats: [28.1, 28.5, 32.7, 29], lon: -16, color: '#eda100' },
  { id: 'caribbean', name: 'Caribbean', code: 'CAR', lats: [25.8, 25, 18.5], lon: -75, color: '#1baf7a' },
  { id: 'eastasia', name: 'East Asia', code: 'EAS', lats: [35.5, 35.1, 31.2], lon: 130, color: '#b0408f' },
  { id: 'hawaii', name: 'Hawaii', code: 'HAW', lats: [21.3, 19.7, 20.9], lon: -157, color: '#f08c5a' },
  { id: 'iceland', name: 'Iceland & Greenland', code: 'ICE', lats: [64.2, 64.2, 65.7], lon: -30, color: '#2aa7b8' },
  { id: 'indian', name: 'Indian Ocean', code: 'IND', lats: [-20.2, -4.6, 4.2], lon: 62, color: '#8fbf3f' },
  { id: 'mediterranean', name: 'Mediterranean', code: 'MED', lats: [41.4, 43.3, 44.4, 37.9], lon: 10, color: '#eb6834' },
  { id: 'newengland', name: 'New England & Canada', code: 'NEC', lats: [42.4, 44.7, 46.8], lon: -68, color: '#8a5a2b' },
  { id: 'nordic', name: 'Nordic coastal', code: 'NOR', lats: [60.4, 62.5, 63.4, 69.7], lon: 10, color: '#2a78d6', hourly: bergen2025 },
  { id: 'redsea', name: 'Red Sea', code: 'RED', lats: [21.5, 29.5, 26.7], lon: 36, color: '#a83232' },
  { id: 'southamerica', name: 'South America', code: 'SAM', lats: [-34.6, -22.9, -34.9], lon: -52, color: '#7a8f1f' },
  { id: 'southpacific', name: 'South Pacific', code: 'SPA', lats: [-17.5, -18.1, -22.3], lon: -160, color: '#36c2d6' },
  { id: 'seasia', name: 'South-East Asia', code: 'SEA', lats: [1.3, 3, 7.8, 13.1], lon: 101, color: '#c06ad4' },
];

/** Alphabetical, the order every region list is shown in. */
export const REGIONS: Region[] = [...unsorted].sort((a, b) => a.name.localeCompare(b.name));

const FALLBACK = REGIONS.find((r) => r.id === 'mediterranean') ?? REGIONS[0];

/** Resolves an id, falling back to a known region for ids from older projects. */
export const getRegion = (id: RegionId | undefined): Region =>
  REGIONS.find((r) => r.id === id) ?? FALLBACK;

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** One region id per month, January first. */
export type AnnualPlan = RegionId[];

export interface PlanPreset {
  id: string;
  label: string;
  plan: AnnualPlan;
}

const byMonth = (pick: (month: number) => RegionId): AnnualPlan =>
  MONTH_NAMES.map((_, m) => pick(m));

/** Seasonal starting points; a single-region year is offered for every region too. */
export const SEASONAL_PRESETS: PlanPreset[] = [
  {
    id: 'example',
    label: 'Example cruise year',
    plan: [
      'caribbean', 'caribbean', 'caribbean', 'canary', 'mediterranean', 'mediterranean',
      'nordic', 'nordic', 'mediterranean', 'mediterranean', 'canary', 'caribbean',
    ],
  },
  {
    id: 'car-med',
    label: 'Caribbean winter, Mediterranean summer',
    plan: byMonth((m) => (m >= 4 && m <= 9 ? 'mediterranean' : 'caribbean')),
  },
  {
    id: 'can-bal',
    label: 'Canaries winter, Baltic summer',
    plan: byMonth((m) => (m >= 4 && m <= 8 ? 'baltic' : 'canary')),
  },
  {
    id: 'aus-ala',
    label: 'Australia winter, Alaska summer',
    plan: byMonth((m) => (m >= 3 && m <= 8 ? 'alaska' : 'ausnz')),
  },
];

export const REGION_PRESETS: PlanPreset[] = REGIONS.map((r) => ({
  id: `region:${r.id}`,
  label: r.name,
  plan: byMonth(() => r.id),
}));

export const DEFAULT_PLAN: AnnualPlan = SEASONAL_PRESETS[0].plan;

/** A stored plan made safe: twelve entries, every one a known region. */
export function normalizePlan(plan: unknown): AnnualPlan {
  if (!Array.isArray(plan) || plan.length !== 12) return [...DEFAULT_PLAN];
  return plan.map((id) => getRegion(typeof id === 'string' ? id : undefined).id);
}

/** Regions in the plan, in order of first appearance. */
export const regionsInPlan = (plan: AnnualPlan): RegionId[] =>
  plan.filter((id, m) => plan.indexOf(id) === m);

/**
 * Colour of each region in the plan. A region keeps its own colour whatever
 * else is in the plan, so editing one month never recolours another. Nineteen
 * colours cannot all be told apart at a glance, so a colour never stands
 * alone: every use carries the region name.
 */
export function regionColors(plan: AnnualPlan): Map<RegionId, string> {
  return new Map(regionsInPlan(plan).map((id) => [id, getRegion(id).color]));
}
