import type { Vessel, VesselCategory } from '../types';

/**
 * Building geometry, thermal envelope and internal gains derived from a vessel's
 * principal dimensions.
 *
 * These are ESTIMATES from simple geometric rules, not data from a real general
 * arrangement. They exist so a freshly selected vessel produces a plausible heat
 * balance immediately; every value stays editable in step 3. Replace this module
 * with figures from the actual GA and insulation schedule before the numbers are
 * used for anything real.
 */

interface CategoryTraits {
  /** Storey height of a conditioned deck, m. */
  deckHeight: number;
  /** Share of the accommodation perimeter that is glazed. */
  glazingRatio: number;
  /** U-values, W/m²K. */
  uBulkhead: number;
  uDeck: number;
  uWindow: number;
  uShell: number;
  /** Internal gains, W/m². */
  lighting: number;
  equipment: number;
  /** Share of persons present in conditioned spaces on average. */
  occupancy: number;
  /** Share of the conditioned envelope that sits below the waterline. */
  submergedRatio: number;
}

const TRAITS: Record<VesselCategory, CategoryTraits> = {
  Passenger: {
    deckHeight: 2.7,
    glazingRatio: 0.22,
    uBulkhead: 0.85,
    uDeck: 1.0,
    uWindow: 2.6,
    uShell: 1.4,
    lighting: 9,
    equipment: 14,
    occupancy: 0.75,
    submergedRatio: 0.1,
  },
  Offshore: {
    deckHeight: 2.6,
    glazingRatio: 0.1,
    uBulkhead: 0.7,
    uDeck: 0.85,
    uWindow: 2.2,
    uShell: 1.2,
    lighting: 8,
    equipment: 16,
    occupancy: 0.85,
    submergedRatio: 0.16,
  },
  Special: {
    deckHeight: 2.6,
    glazingRatio: 0.12,
    uBulkhead: 0.75,
    uDeck: 0.9,
    uWindow: 2.4,
    uShell: 1.3,
    lighting: 8,
    equipment: 18,
    occupancy: 0.8,
    submergedRatio: 0.14,
  },
};

const round = (v: number, d = 0) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

/**
 * How far the conditioned area may be scaled from the vessel's own figure.
 *
 * Not an arbitrary restriction: the derivation assumes a deck height, a glazing
 * fraction and a plausible deckhouse shape for the vessel's category. Outside
 * this range the arithmetic stays self-consistent but stops describing anything
 * resembling that vessel.
 */
export const AREA_SCALE_MIN = 0.5;
export const AREA_SCALE_MAX = 2;
export const AREA_SCALE_STEP = 0.05;

/** The vessel's own conditioned area — the size the scale knob defaults to. */
export function referenceAreaFor(vessel: Vessel): number {
  const { loa = 100, beam = 18, conditionedArea } = vessel.specs;
  return conditionedArea ?? loa * beam * 0.8;
}

export function areaBoundsFor(vessel: Vessel): { min: number; max: number } {
  const reference = referenceAreaFor(vessel);
  return {
    min: Math.round(reference * AREA_SCALE_MIN),
    max: Math.round(reference * AREA_SCALE_MAX),
  };
}

export function clampArea(vessel: Vessel, area: number): number {
  const { min, max } = areaBoundsFor(vessel);
  return Math.min(max, Math.max(min, area));
}

/**
 * Values for the three vessel-sourced groups in step 3, keyed by parameter key.
 *
 * Geometry model: the conditioned volume is treated as a block of `decks`
 * storeys whose footprint is the conditioned area divided by the deck count.
 * The block's perimeter gives the exposed bulkhead area, its footprint gives the
 * exposed (weather) deck area.
 */
export function designDefaultsFor(
  vessel: Vessel,
  areaOverride?: number,
): Record<string, string> {
  const t = TRAITS[vessel.category];
  const { loa = 100, beam = 18, passengers = 0, crew = 0 } = vessel.specs;

  const reference = referenceAreaFor(vessel);
  const area =
    areaOverride !== undefined && Number.isFinite(areaOverride) && areaOverride > 0
      ? clampArea(vessel, areaOverride)
      : reference;

  // Persons scale with the vessel, holding its own occupant density constant —
  // otherwise a vessel twice the size carries the same crew, and ventilation and
  // occupant gains stay flat while the envelope grows.
  const persons = Math.round(((passengers + crew) / reference) * area);

  // Deck count: enough storeys that a deck's footprint fits inside the hull.
  const maxFootprint = loa * beam * 0.72;
  const decks = Math.max(2, Math.min(14, Math.ceil(area / maxFootprint)));

  const footprint = area / decks;
  // Treat the deckhouse footprint as a rectangle of the vessel's aspect ratio.
  const blockBeam = Math.min(beam, Math.sqrt(footprint * (beam / loa)));
  const blockLength = footprint / blockBeam;
  const perimeter = 2 * (blockLength + blockBeam);

  const grossWallArea = perimeter * t.deckHeight * decks;
  const windowArea = grossWallArea * t.glazingRatio;
  const exposedBulkheadArea = grossWallArea - windowArea;
  const volume = area * t.deckHeight;

  return {
    // Building geometry
    conditionedArea: String(round(area)),
    conditionedVolume: String(round(volume)),
    numberOfDecks: String(decks),
    exposedBulkheadArea: String(round(exposedBulkheadArea)),
    exposedDeckArea: String(round(footprint)),
    windowArea: String(round(windowArea)),
    shellAreaSeawater: String(round(grossWallArea * t.submergedRatio)),

    // Thermal envelope
    uBulkhead: String(t.uBulkhead),
    uDeck: String(t.uDeck),
    uWindow: String(t.uWindow),
    uShell: String(t.uShell),
    solarFactor: '0.5',
    solarIrradiance: '700',

    // Internal gains
    personsOnBoard: String(persons),
    sensiblePerPerson: '75',
    occupancyFactor: String(t.occupancy),
    lightingLoad: String(t.lighting),
    equipmentLoad: String(t.equipment),
  };
}
