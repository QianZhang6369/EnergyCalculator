import type { Vessel, VesselCategory, VesselSpecs } from '../types';

/**
 * Vessel library.
 *
 * Each entry is one specific vessel — a reference design with concrete key
 * information — not an abstract vessel type. `featured: true` puts it in the card
 * row at the top of step 1; those also need a `figure` and a description.
 *
 * WARNING: apart from the Ro-Pax ferry (100 m / 200 pax, given by the user) every
 * number below is an invented but plausible reference figure, put here so the UI
 * has something to show. None of it is validated design data — replace it with
 * your own reference vessels before anyone uses this for real work.
 */

export const VESSEL_CATEGORIES: VesselCategory[] = ['Passenger', 'Offshore', 'Special'];

/**
 * Display order and units for the key information grid.
 *
 * `beam` is deliberately absent: it is not shown to the user, but each vessel
 * still carries it because `lib/vesselDefaults.ts` derives the step 4 building
 * geometry from length × beam. Do not delete it from the vessel specs.
 */
export const SPEC_ROWS: {
  key: keyof VesselSpecs;
  label: string;
  unit: string;
}[] = [
  { key: 'loa', label: 'Length overall', unit: 'm' },
  { key: 'passengers', label: 'Passengers / special personnel', unit: 'pers' },
  { key: 'crew', label: 'Crew', unit: 'pers' },
  { key: 'conditionedArea', label: 'Conditioned area', unit: 'm²' },
  { key: 'grossTonnage', label: 'Gross tonnage', unit: 'GT' },
];

export const VESSELS: Vessel[] = [
  /* ---------- Passenger ---------- */
  {
    id: 'ferry-ropax-100',
    name: 'Ro-Pax Ferry',
    category: 'Passenger',
    featured: true,
    figure: 'ferry',
    tagline: 'Short crossings, occupancy swings from full to empty each day',
    description:
      'Passenger load swings between full and near-empty over a single day, and the ' +
      'plant has to pull down quickly after each turnaround. Vehicle deck ventilation ' +
      'is a separate system but shares the same power budget.',
    specs: {
      loa: 100,
      beam: 18,
      passengers: 200,
      crew: 15,
      conditionedArea: 1800,
      grossTonnage: 5000,
    },
  },
  {
    id: 'ferry-ropax-200',
    name: 'Ro-Pax Ferry (large)',
    category: 'Passenger',
    figure: 'ferry',
    tagline: 'Overnight routes with cabins, high simultaneous cooling demand',
    specs: {
      loa: 200,
      beam: 30,
      passengers: 1500,
      crew: 120,
      conditionedArea: 12000,
      grossTonnage: 45000,
    },
  },
  {
    id: 'cruise-ship',
    name: 'Cruise Ship',
    category: 'Passenger',
    featured: true,
    figure: 'cruise',
    tagline: 'High occupancy, large conditioned volume, 24/7 operation',
    description:
      'Very high fresh-air demand driven by passenger cabins and public spaces. ' +
      'Latent load and simultaneous heating/cooling zones are the main design drivers.',
    specs: {
      loa: 300,
      beam: 37,
      passengers: 3000,
      crew: 1200,
      conditionedArea: 55000,
      grossTonnage: 140000,
    },
  },
  {
    id: 'cruise-expedition',
    name: 'Expedition Cruise Ship',
    category: 'Passenger',
    figure: 'cruise',
    tagline: 'Polar and tropical service on the same hull, wide ambient range',
    specs: {
      loa: 120,
      beam: 20,
      passengers: 200,
      crew: 120,
      conditionedArea: 6000,
      grossTonnage: 12000,
    },
  },
  {
    id: 'superyacht',
    name: 'Superyacht',
    category: 'Passenger',
    tagline: 'Low occupancy, high comfort and very low noise limits',
    specs: {
      loa: 60,
      beam: 11,
      passengers: 12,
      crew: 20,
      conditionedArea: 900,
      grossTonnage: 1100,
    },
  },

  /* ---------- Offshore ---------- */
  {
    id: 'sov',
    name: 'Service Operation Vessel',
    category: 'Offshore',
    featured: true,
    figure: 'sov',
    tagline: 'Offshore wind technicians, weeks on station, hotel-type load',
    description:
      'Accommodation is occupied continuously for weeks offshore, so the load looks ' +
      'more like a hotel than a cargo ship. Comfort while on dynamic positioning and ' +
      'drying capacity for work clothing are usually the sizing cases.',
    specs: {
      loa: 85,
      beam: 19,
      passengers: 60,
      crew: 25,
      conditionedArea: 2000,
      grossTonnage: 9000,
    },
  },
  {
    id: 'csov',
    name: 'Commissioning SOV',
    category: 'Offshore',
    figure: 'sov',
    tagline: 'Larger technician complement, extended commissioning campaigns',
    specs: {
      loa: 90,
      beam: 20,
      passengers: 120,
      crew: 30,
      conditionedArea: 2800,
      grossTonnage: 11000,
    },
  },

  /* ---------- Special ---------- */
  {
    id: 'research-vessel',
    name: 'Research Vessel',
    category: 'Special',
    tagline: 'Conditioned laboratories with tight temperature tolerance',
    specs: {
      loa: 90,
      beam: 18,
      passengers: 40,
      crew: 30,
      conditionedArea: 1600,
      grossTonnage: 6000,
    },
  },
  {
    id: 'naval-opv',
    name: 'Naval Offshore Patrol Vessel',
    category: 'Special',
    tagline: 'High crew density, citadel and NBC ventilation modes',
    specs: {
      loa: 90,
      beam: 14,
      crew: 60,
      conditionedArea: 1400,
      grossTonnage: 2000,
    },
  },
  {
    id: 'fishing-vessel',
    name: 'Fishing / Processing Vessel',
    category: 'Special',
    tagline: 'Processing and freezing plant alongside the accommodation',
    specs: {
      loa: 70,
      beam: 14,
      crew: 35,
      conditionedArea: 900,
      grossTonnage: 3000,
    },
  },
];

export const FEATURED_VESSELS = VESSELS.filter((v) => v.featured);

export const getVessel = (id: string | null) => VESSELS.find((v) => v.id === id) ?? null;

const num = (value: number) => value.toLocaleString('en-US').replace(/,/g, ' ');

/** Compact key information, e.g. `["100 m", "200 pax", "15 crew"]`. */
export const specSummary = (vessel: Vessel): string[] => {
  const { loa, passengers, crew, conditionedArea } = vessel.specs;
  const parts: string[] = [];
  if (loa) parts.push(`${loa} m`);
  if (passengers) parts.push(`${num(passengers)} pax`);
  if (crew) parts.push(`${num(crew)} crew`);
  if (conditionedArea) parts.push(`${num(conditionedArea)} m²`);
  return parts;
};

/** Full key information for the detail panel. */
export const specRows = (vessel: Vessel) =>
  SPEC_ROWS.flatMap((row) => {
    const value = vessel.specs[row.key];
    return value === undefined ? [] : [{ label: row.label, value: `${num(value)} ${row.unit}` }];
  });
