import type { DesignParameters, Vessel } from '../types';
import { designDefaultsFor } from './vesselDefaults';

/**
 * Step 1 — room groups.
 *
 * A group (a "zone") is a set of similar rooms, e.g. 53 interior cabins. Its
 * per-room values are either entered directly as an average, or entered room
 * by room and averaged automatically.
 *
 * Ported from EnergyCalculator Light, field names included, so that its
 * per-group load calculation can follow later without a data migration. For
 * now only the group totals are used: see `designFromZones`.
 */

export type WindowType = 'Type 1' | 'Type 2';

export const WINDOW_TYPES: WindowType[] = ['Type 1', 'Type 2'];

export type ZoneInputMode = 'average' | 'rooms';

/** Per-room numeric fields that get averaged across the rooms in a group. */
export interface ZoneMetrics {
  area_m2: number;
  persons: number;
  window_m2: number;
  sun_win_m2: number;
  bulkhead_m2: number;
  ach: number;
  height_m: number;
  FA_per_person_m3h: number;
  equip_kW: number;
}

export interface Room extends ZoneMetrics {
  id: string;
  name: string;
}

export interface Zone {
  /** Editable group code, e.g. `Z1-INTERIOR`. */
  id: string;
  /** Stable machine id used as React key, independent of the editable code. */
  uid: string;
  description: string;
  /** Group-level categorical parameter (not averaged). */
  window_type: WindowType;
  mode: ZoneInputMode;
  /** Number of rooms of this type — used directly in 'average' mode. */
  count: number;
  /** Averaged per-room values — used directly in 'average' mode. */
  averages: ZoneMetrics;
  /** Individual rooms — used in 'rooms' mode; count and averages are derived. */
  rooms: Room[];
}

export interface MetricField {
  key: keyof ZoneMetrics;
  label: string;
  unit: string;
  step: number;
}

export const METRIC_FIELDS: MetricField[] = [
  { key: 'area_m2', label: 'Floor area', unit: 'm²', step: 0.1 },
  { key: 'persons', label: 'Persons', unit: 'pers', step: 0.05 },
  { key: 'window_m2', label: 'Window area', unit: 'm²', step: 0.1 },
  { key: 'sun_win_m2', label: 'Sunlit window', unit: 'm²', step: 0.1 },
  { key: 'bulkhead_m2', label: 'Bulkhead area', unit: 'm²', step: 0.1 },
  { key: 'ach', label: 'Air changes', unit: 'ACH', step: 0.01 },
  { key: 'height_m', label: 'Deck height', unit: 'm', step: 0.1 },
  { key: 'FA_per_person_m3h', label: 'Fresh air / person', unit: 'm³/h', step: 1 },
  { key: 'equip_kW', label: 'Equipment load', unit: 'kW', step: 0.001 },
];

export function emptyMetrics(): ZoneMetrics {
  return {
    area_m2: 0,
    persons: 0,
    window_m2: 0,
    sun_win_m2: 0,
    bulkhead_m2: 0,
    ach: 0,
    height_m: 2.1,
    FA_per_person_m3h: 30,
    equip_kW: 0,
  };
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export function newZone(index: number): Zone {
  return {
    id: `G${index}`,
    uid: uid(),
    description: '',
    window_type: 'Type 1',
    mode: 'average',
    count: 1,
    averages: emptyMetrics(),
    rooms: [],
  };
}

type SampleRow = [string, string, WindowType, number, ...number[]];

// Code, description, window type, room count, then METRIC_FIELDS in order.
const SOV_SAMPLE: SampleRow[] = [
  ['Z1-INTERIOR', 'Interior accom. (no bulkhead)', 'Type 1', 53, 22.69, 1.75, 0, 0, 0, 4.12, 2.1, 30, 0.013],
  ['Z2-EXPOSED', 'Exposed accom. (bulkhead>0)', 'Type 1', 67, 12.72, 2.82, 0.88, 0.88, 10.96, 6.21, 2.1, 30, 0],
  ['Z3-PUBLIC', 'Public / office (PFCU)', 'Type 1', 16, 27.75, 10, 3.5, 2.69, 18.94, 1.19, 2.1, 34, 0],
  ['Z4-GALLEY', 'Galley AG-3 100% OA', 'Type 1', 2, 37.5, 0, 0, 0, 0, 28, 2.1, 30, 0],
  ['Z5-WHEELHOUSE', 'Wheelhouse AW-4 recirc', 'Type 2', 1, 300, 12, 126.99, 65, 550, 2.3, 2.3, 30, 0],
];

/** The starting set: the room groups of a service operation vessel. */
export function sovSampleZones(): Zone[] {
  return SOV_SAMPLE.map(([id, description, window_type, count, ...values]) => ({
    id,
    uid: uid(),
    description,
    window_type,
    mode: 'average',
    count,
    averages: Object.fromEntries(
      METRIC_FIELDS.map((f, i) => [f.key, values[i]]),
    ) as unknown as ZoneMetrics,
    rooms: [],
  }));
}

/** Averages derived from the rooms of a group. */
export function averageRooms(rooms: Room[]): ZoneMetrics {
  const out = emptyMetrics();
  for (const f of METRIC_FIELDS) {
    out[f.key] =
      rooms.length === 0
        ? 0
        : rooms.reduce((sum, r) => sum + (Number(r[f.key]) || 0), 0) / rooms.length;
  }
  return out;
}

export interface ZoneTotals {
  area_m2: number;
  persons: number;
  volume_m3: number;
  freshAir_m3h: number;
  equip_kW: number;
  window_m2: number;
  bulkhead_m2: number;
}

export interface ResolvedZone {
  /** Effective number of rooms for this group. */
  count: number;
  /** Effective per-room averages (either entered or computed from rooms). */
  averages: ZoneMetrics;
  totals: ZoneTotals;
}

const round = (n: number, dp = 2) => {
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
};

/** Resolve a group to its effective count, averages and derived totals. */
export function resolveZone(zone: Zone): ResolvedZone {
  const isRooms = zone.mode === 'rooms';
  const count = isRooms ? zone.rooms.length : Math.max(0, zone.count);
  const averages = isRooms ? averageRooms(zone.rooms) : zone.averages;
  return {
    count,
    averages,
    totals: {
      area_m2: round(count * averages.area_m2),
      persons: round(count * averages.persons),
      volume_m3: round(count * averages.area_m2 * averages.height_m),
      freshAir_m3h: round(count * averages.persons * averages.FA_per_person_m3h),
      equip_kW: round(count * averages.equip_kW, 3),
      window_m2: round(count * averages.window_m2),
      bulkhead_m2: round(count * averages.bulkhead_m2),
    },
  };
}

/** Totals across all groups. */
export function projectTotals(zones: Zone[]): ZoneTotals {
  const sum: ZoneTotals = {
    area_m2: 0,
    persons: 0,
    volume_m3: 0,
    freshAir_m3h: 0,
    equip_kW: 0,
    window_m2: 0,
    bulkhead_m2: 0,
  };
  for (const zone of zones) {
    const { totals } = resolveZone(zone);
    (Object.keys(sum) as (keyof ZoneTotals)[]).forEach((key) => {
      sum[key] = round(sum[key] + totals[key], 3);
    });
  }
  return sum;
}

/** A stored list made safe: older projects have none, so they get the start set. */
export function normalizeZones(zones: unknown): Zone[] {
  if (!Array.isArray(zones)) return sovSampleZones();
  return (zones as Zone[]).map((z, i) => ({
    ...newZone(i + 1),
    ...z,
    averages: { ...emptyMetrics(), ...z.averages },
    rooms: Array.isArray(z.rooms) ? z.rooms : [],
  }));
}

/**
 * The heat-balance inputs that come from the room groups.
 *
 * The calculation is still one balance for the whole ship, so the groups feed
 * it through their totals: floor area, volume, window and bulkhead area,
 * persons and equipment. What the groups do not carry — exposed deck and shell
 * area, U-values, lighting, occupancy — is still estimated from the vessel
 * type, sized to the groups' total floor area.
 *
 * Not used yet: sunlit window area, air changes, fresh air per person and
 * window type. They wait for the per-group calculation.
 */
export function designFromZones(vessel: Vessel | null, zones: Zone[]): DesignParameters {
  const totals = projectTotals(zones);
  return {
    ...(vessel ? designDefaultsFor(vessel, totals.area_m2) : {}),
    conditionedArea: String(totals.area_m2),
    conditionedVolume: String(totals.volume_m3),
    windowArea: String(totals.window_m2),
    exposedBulkheadArea: String(totals.bulkhead_m2),
    personsOnBoard: String(totals.persons),
    // The balance takes equipment as a density over the conditioned area.
    equipmentLoad: String(
      totals.area_m2 > 0 ? round((totals.equip_kW * 1000) / totals.area_m2, 2) : 0,
    ),
  };
}
