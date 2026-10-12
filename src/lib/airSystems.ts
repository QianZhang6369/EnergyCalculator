import { resolveZone, type Zone } from './zones';

/**
 * Step 4 — air system configuration.
 *
 * The air handling units, and for each room group its fresh-air source,
 * terminal unit, fresh-air method, occupancy profile and lighting.
 *
 * Ported from EnergyCalculator Light, names included, so its per-group load
 * calculation can follow later without a data migration. Nothing here feeds
 * the results yet: the heat balance is still one balance for the whole ship.
 */

/** An air handling unit that supplies fresh air to one or more room groups. */
export interface Ahu {
  /** Stable machine id (React key and reference target). */
  id: string;
  /** Editable tag, e.g. "AHU-1". */
  name: string;
}

/** Terminal (room-level) unit type. */
export type TerminalUnit = 'CBU-EL' | 'CBU-M' | 'FCU';

export const TERMINAL_UNITS: TerminalUnit[] = ['CBU-EL', 'CBU-M', 'FCU'];

/** Terminal-unit fan: none, running constantly, or on-off with the part load. */
export type TerminalFan = 'none' | 'constant' | 'onoff';

export const TERMINAL_FANS: { value: TerminalFan; label: string }[] = [
  { value: 'none', label: 'No fan' },
  { value: 'constant', label: 'Constant' },
  { value: 'onoff', label: 'On-off' },
];

/**
 * Default terminal fan per terminal type: fan coils have their own fan (20 W
 * per kW capacity, constant); cabin booster units have none.
 */
export function defaultTerminalFan(terminal: TerminalUnit): {
  terminalFan: TerminalFan;
  terminalFan_WperkW: number;
} {
  return terminal === 'FCU'
    ? { terminalFan: 'constant', terminalFan_WperkW: 20 }
    : { terminalFan: 'none', terminalFan_WperkW: 0 };
}

/** Heating energy source. Only "Electricity" is electric (counted 1:1). */
export type HeatSource = 'Waste heat' | 'Heat pump' | 'Electricity';

export const HEAT_SOURCES: HeatSource[] = ['Waste heat', 'Heat pump', 'Electricity'];

/** Cooling energy source. Only the chiller for now. */
export type CoolingSource = 'Chiller';

export const COOLING_SOURCES: CoolingSource[] = ['Chiller'];

/** How the design fresh-air flow of a room group is derived. */
export type FreshAirMethod = 'method1' | 'air_change' | 'person' | 'method_c';

export const FRESH_AIR_METHODS: { value: FreshAirMethod; label: string }[] = [
  { value: 'method1', label: 'max(person-based, air-change basis)' },
  { value: 'air_change', label: 'Air-change basis' },
  { value: 'person', label: 'Person-based' },
  { value: 'method_c', label: 'max(person-based, 80 m³/h) — 40 if reduced occupancy' },
];

export interface HourProfile<Id extends string> {
  value: Id;
  label: string;
  /** 24 fractions (0–1) by hour of day, on the clock of the weather data (GMT). */
  fractions: number[];
}

/** Occupancy profile — share of the design persons present by hour of day. */
export type OccupancyProfile = 'always' | 'cabins' | 'public' | 'watch';

export const OCCUPANCY_PROFILES: HourProfile<OccupancyProfile>[] = [
  { value: 'always', label: 'Always 100 %', fractions: Array(24).fill(1) },
  {
    value: 'cabins',
    label: 'Cabins',
    fractions: [
      0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.7, 0.4, 0.2, 0.2, 0.2, 0.2, 0.3, 0.2, 0.2, 0.2, 0.2,
      0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
    ],
  },
  {
    value: 'public',
    label: 'Public / office',
    fractions: [
      0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.2, 0.6, 0.4, 0.3, 0.3, 0.5, 0.8, 0.5, 0.3, 0.3,
      0.3, 0.5, 0.8, 0.6, 0.5, 0.4, 0.2, 0.1,
    ],
  },
  { value: 'watch', label: 'Watch (wheelhouse)', fractions: Array(24).fill(0.6) },
];

/** Lighting profile — share of the installed lighting on by hour of day. */
export type LightingProfile = 'always_on' | 'cabins' | 'public' | 'wheelhouse';

export const LIGHTING_PROFILES: HourProfile<LightingProfile>[] = [
  { value: 'always_on', label: 'Always on', fractions: Array(24).fill(1) },
  {
    value: 'cabins',
    label: 'Lighting – cabins',
    fractions: [
      0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.5, 0.5, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1,
      0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.5, 0.2,
    ],
  },
  {
    value: 'public',
    label: 'Lighting – public',
    fractions: [
      0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.5,
    ],
  },
  {
    value: 'wheelhouse',
    label: 'Lighting – wheelhouse',
    fractions: [
      0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5,
      0.5, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1,
    ],
  },
];

/** Hourly fractions of a profile, falling back to the first one in the list. */
export const profileFractions = <Id extends string>(profiles: HourProfile<Id>[], id: Id) =>
  (profiles.find((p) => p.value === id) ?? profiles[0]).fractions;

/** Daily average of an hourly profile, as a rounded percentage. */
export function profileAveragePct(fractions: number[]): number {
  if (fractions.length === 0) return 0;
  return Math.round((fractions.reduce((a, b) => a + b, 0) / fractions.length) * 100);
}

/** Air-system settings of one room group. */
export interface ZoneAirConfig {
  /** Id of the AHU feeding fresh air to this group (null = unassigned). */
  ahuId: string | null;
  terminalUnit: TerminalUnit;
  /** Terminal-unit fan control (none = no own fan). */
  terminalFan: TerminalFan;
  /** Terminal fan power per kW of terminal design capacity, W/kW. */
  terminalFan_WperkW: number;
  freshAirMethod: FreshAirMethod;
  /** Hourly share of the design persons present. */
  occupancyProfile: OccupancyProfile;
  /** Installed lighting power density, W per m² of floor area. */
  lighting_Wm2: number;
  /** Hourly share of the installed lighting switched on. */
  lightingProfile: LightingProfile;
  /** Heating source for the terminal's heating (reheat) duty. */
  terminalHeatSource: HeatSource;
  /** Cooling source for the terminal's cooling (FCU) duty. */
  terminalCoolSource: CoolingSource;
}

export function defaultZoneAirConfig(): ZoneAirConfig {
  return {
    ahuId: null,
    terminalUnit: 'CBU-EL',
    ...defaultTerminalFan('CBU-EL'),
    freshAirMethod: 'method1',
    occupancyProfile: 'always',
    lighting_Wm2: 0,
    lightingProfile: 'always_on',
    terminalHeatSource: 'Electricity',
    terminalCoolSource: 'Chiller',
  };
}

/** Step 4 — the air side of the project. */
export interface AirSetup {
  ahus: Ahu[];
  /** Per room group, keyed by the group's `uid`. Missing groups use the defaults. */
  airConfig: Record<string, ZoneAirConfig>;
  /**
   * Design percentile (0–1) of the hourly terminal heating / cooling used to
   * size the terminal fans.
   */
  terminalFanPercentile: number;
  /** Oversizing factor on the terminal design capacity. */
  terminalFanOversizing: number;
}

export const emptyAirSetup = (): AirSetup => ({
  ahus: [],
  airConfig: {},
  terminalFanPercentile: 0.996,
  terminalFanOversizing: 1.2,
});

/** A stored setup made safe; projects saved before this step have none. */
export function normalizeAirSetup(stored: Partial<AirSetup> | undefined): AirSetup {
  const base = emptyAirSetup();
  return {
    ...base,
    ...stored,
    ahus: Array.isArray(stored?.ahus) ? stored.ahus : base.ahus,
    airConfig: stored?.airConfig ?? base.airConfig,
  };
}

/** Settings of one group: what is stored, over the defaults. */
export const zoneAirOf = (air: AirSetup, zoneUid: string): ZoneAirConfig => ({
  ...defaultZoneAirConfig(),
  ...air.airConfig[zoneUid],
});

export interface FreshAirBreakdown {
  /** Fresh air required on a per-person basis, m³/h. */
  personBased_m3h: number;
  /** Fresh air implied by the air-change rate, m³/h. */
  airChange_m3h: number;
  /** Design value selected by the group's method, m³/h. */
  design_m3h: number;
}

/**
 * Fresh-air method C (FCU / CFCU / beams): floor at full occupancy, and the
 * flat flow used when occupancy is reduced, m³/h per room.
 */
const FA_C_FLOOR_M3H = 80;
const FA_C_REDUCED_M3H = 40;

/** Design fresh-air flow of one room from its person-based and air-change bases. */
function roomDesign(method: FreshAirMethod, p: number, a: number, reduced: boolean): number {
  switch (method) {
    case 'person':
      return p;
    case 'air_change':
      return a;
    case 'method_c':
      return reduced ? FA_C_REDUCED_M3H : Math.max(p, FA_C_FLOOR_M3H);
    default:
      return Math.max(p, a);
  }
}

const round1 = (n: number) => Math.round((n + Number.EPSILON) * 10) / 10;

/**
 * Fresh-air flow of a whole room group, broken down by basis. The method is
 * applied per room and summed, so the non-linear methods size every room to its
 * own rule. In average mode the per-room value comes from the group averages.
 */
export function freshAirBreakdown(
  zone: Zone,
  method: FreshAirMethod,
  reducedOccupancy = false,
): FreshAirBreakdown {
  let personBased = 0;
  let airChange = 0;
  let design = 0;

  if (zone.mode === 'rooms') {
    for (const r of zone.rooms) {
      const p = r.persons * r.FA_per_person_m3h;
      const a = r.area_m2 * r.height_m * r.ach;
      personBased += p;
      airChange += a;
      design += roomDesign(method, p, a, reducedOccupancy);
    }
  } else {
    const { count, averages } = resolveZone(zone);
    const p = averages.persons * averages.FA_per_person_m3h;
    const a = averages.area_m2 * averages.height_m * averages.ach;
    personBased = count * p;
    airChange = count * a;
    design = count * roomDesign(method, p, a, reducedOccupancy);
  }

  return {
    personBased_m3h: round1(personBased),
    airChange_m3h: round1(airChange),
    design_m3h: round1(design),
  };
}
