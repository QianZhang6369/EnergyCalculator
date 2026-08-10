import type { Waypoint } from '../types';
import { distanceNm } from '../lib/itinerary';

/**
 * Step 2 — route library.
 *
 * Classic operating areas with plausible routes. The coordinates are real
 * port positions, but the schedules are GENERATED: applying a route fills the
 * stops with a random but plausible arrival/departure timing, so the weather
 * profile can be generated immediately. Everything the library produces is an
 * ordinary `Waypoint[]` and stays fully editable afterwards.
 *
 * Every route is a LOOP — the final leg returns to the first stop — and the
 * generated times are day-month-hour stamps (`MM-DDTHH:00`) that repeat each
 * year, so a route stands for a repeating operating pattern rather than a
 * one-off voyage.
 */

export interface LibraryStop {
  name: string;
  lat: number;
  lon: number;
}

export interface LibraryRoute {
  id: string;
  name: string;
  /** One-liner under the name in the selection list. */
  tagline: string;
  /** Operating region, shown as a label on the row. */
  region: string;
  stops: LibraryStop[];
}

export const LIBRARY_ROUTES: LibraryRoute[] = [
  {
    id: 'nordic',
    name: 'Nordic coastal',
    tagline: 'Bergen → Ålesund → Trondheim → Tromsø → Bergen',
    region: 'Nordic',
    stops: [
      { name: 'Bergen', lat: 60.39, lon: 5.32 },
      { name: 'Ålesund', lat: 62.47, lon: 6.15 },
      { name: 'Trondheim', lat: 63.43, lon: 10.4 },
      { name: 'Tromsø', lat: 69.65, lon: 18.96 },
    ],
  },
  {
    id: 'mediterranean',
    name: 'Mediterranean',
    tagline: 'Barcelona → Marseille → Genoa → Athens → Barcelona',
    region: 'Mediterranean',
    stops: [
      { name: 'Barcelona', lat: 41.39, lon: 2.17 },
      { name: 'Marseille', lat: 43.3, lon: 5.37 },
      { name: 'Genoa', lat: 44.41, lon: 8.93 },
      { name: 'Athens (Piraeus)', lat: 37.94, lon: 23.65 },
    ],
  },
  {
    id: 'baltic',
    name: 'Baltic',
    tagline: 'Copenhagen → Stockholm → Helsinki → Tallinn → Copenhagen',
    region: 'Baltic',
    stops: [
      { name: 'Copenhagen', lat: 55.68, lon: 12.57 },
      { name: 'Stockholm', lat: 59.33, lon: 18.07 },
      { name: 'Helsinki', lat: 60.17, lon: 24.94 },
      { name: 'Tallinn', lat: 59.44, lon: 24.75 },
    ],
  },
  {
    id: 'caribbean',
    name: 'Caribbean',
    tagline: 'Miami → Nassau → San Juan → Miami',
    region: 'Caribbean',
    stops: [
      { name: 'Miami', lat: 25.76, lon: -80.19 },
      { name: 'Nassau', lat: 25.04, lon: -77.35 },
      { name: 'San Juan', lat: 18.47, lon: -66.11 },
    ],
  },
];

const pad = (n: number) => String(n).padStart(2, '0');

/** `MM-DDTHH:00` in local time — day, month and whole hour, no year. */
const formatMonthDay = (date: Date) =>
  `${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:00`;

const addHours = (date: Date, hours: number) => new Date(date.getTime() + hours * 3_600_000);

const rand = (min: number, max: number) => min + Math.random() * (max - min);

const newId = () =>
  `wp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * Materialises a library route into editable waypoints with a plausible,
 * randomly generated schedule. The route is a loop: the last stop is the first
 * one again. The vessel leaves the first stop at 06:00 today, sails each leg at
 * a random 14–20 kn, and stays 6–14 h alongside each stop. Every time is a
 * whole hour. Random on purpose — the library carries no real schedule data.
 */
export function materializeRoute(route: LibraryRoute): Waypoint[] {
  const waypoints: Waypoint[] = [];
  let clock = new Date();
  clock.setHours(6, 0, 0, 0);

  // Close the loop: the final leg returns to the first stop.
  const stops = [...route.stops, route.stops[0]];

  stops.forEach((stop, i) => {
    const stay = Math.round(rand(6, 14));
    waypoints.push({
      id: newId(),
      name: stop.name,
      lat: stop.lat,
      lon: stop.lon,
      arrival: formatMonthDay(clock),
      departure: formatMonthDay(addHours(clock, stay)),
    });

    const next = stops[i + 1];
    if (next) {
      // Only lat/lon are used by the distance calculation.
      const nm = distanceNm(stop as Waypoint, next as Waypoint);
      const speed = rand(14, 20);
      clock = addHours(clock, stay + Math.round(nm / speed));
    }
  });

  return waypoints;
}
