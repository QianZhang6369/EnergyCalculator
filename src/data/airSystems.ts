import type { AirSystemId } from '../types';

/**
 * Step 4 — air-side distribution options.
 *
 * How the conditioned air is delivered to the spaces, chosen alongside the
 * chilled water configuration. The energy wheel recovers exhaust heat/cold
 * into the supply stream; the fan-coil variants take part of the load to
 * local units instead of the central AHU.
 */

export interface AirSystemOption {
  id: AirSystemId;
  name: string;
  /** One-liner under the name in the selection list. */
  tagline: string;
}

export const AIR_SYSTEMS: AirSystemOption[] = [
  {
    id: 'ahu',
    name: 'Central AHU',
    tagline: 'All ventilation and conditioning through one central air handling unit.',
  },
  {
    id: 'ahu-wheel',
    name: 'Central AHU with energy wheel',
    tagline: 'Exhaust air heat and cold are recovered into the supply air stream.',
  },
  {
    id: 'ahu-fcu',
    name: 'AHU + FCU',
    tagline: 'AHU covers ventilation; fan-coil units handle the local loads.',
  },
  {
    id: 'ahu-wheel-fcu',
    name: 'AHU with energy wheel + FCU',
    tagline: 'AHU with energy recovery for ventilation plus local fan-coil units.',
  },
];

export const getAirSystem = (id: AirSystemId | null) =>
  AIR_SYSTEMS.find((a) => a.id === id) ?? null;
