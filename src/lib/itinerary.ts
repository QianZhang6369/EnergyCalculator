import type { Waypoint } from '../types';

const EARTH_RADIUS_NM = 3440.065;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two positions, in nautical miles. */
export function distanceNm(a: Waypoint, b: Waypoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Day-month-hour stamps (`MM-DDTHH:00`) are anchored to a fixed reference year
 * so durations can be computed without the user ever picking a year. 2000 is a
 * leap year, so 02-29 is representable.
 */
const ANCHOR_YEAR = 2000;

const MONTH_DAY_HOUR = /^(\d{2})-(\d{2})T(\d{2}):00$/;

/**
 * Timestamp in milliseconds for arithmetic. Accepts the `MM-DDTHH:00` format,
 * or a full ISO timestamp (legacy saved projects).
 */
export function parseStamp(stamp: string): number | null {
  if (!stamp) return null;
  const m = MONTH_DAY_HOUR.exec(stamp);
  if (m) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    const hour = Number(m[3]);
    const date = new Date(ANCHOR_YEAR, month - 1, day, hour);
    // Reject rolled-over dates like 02-30 or 13-40 rather than silently shift.
    const valid =
      date.getFullYear() === ANCHOR_YEAR &&
      date.getMonth() === month - 1 &&
      date.getDate() === day;
    return valid ? date.getTime() : null;
  }
  const t = new Date(stamp).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Hours between two stop-time stamps, or null if either is unset/invalid. */
export function hoursBetween(from: string, to: string): number | null {
  const a = parseStamp(from);
  const b = parseStamp(to);
  if (a === null || b === null) return null;
  return (b - a) / 3_600_000;
}

export interface Leg {
  from: Waypoint;
  to: Waypoint;
  distanceNm: number;
  /** Departure of `from` to arrival at `to`. */
  hours: number | null;
  /** Implied average speed over the ground, knots. */
  knots: number | null;
}

export function legs(waypoints: Waypoint[]): Leg[] {
  return waypoints.slice(0, -1).map((from, i) => {
    const to = waypoints[i + 1];
    const nm = distanceNm(from, to);
    const hours = hoursBetween(from.departure, to.arrival);
    return {
      from,
      to,
      distanceNm: nm,
      hours,
      knots: hours && hours > 0 ? nm / hours : null,
    };
  });
}

export interface ItineraryIssue {
  waypointId: string;
  message: string;
}

/**
 * Timing problems worth surfacing. Deliberately warnings rather than hard
 * validation — a partially filled itinerary is a normal working state.
 */
export function issues(waypoints: Waypoint[]): ItineraryIssue[] {
  const found: ItineraryIssue[] = [];

  waypoints.forEach((wp, i) => {
    if (wp.arrival && parseStamp(wp.arrival) === null) {
      found.push({
        waypointId: wp.id,
        message: 'Arrival must be MM-DDTHH:00, e.g. 07-15T08:00.',
      });
    }
    if (wp.departure && parseStamp(wp.departure) === null) {
      found.push({
        waypointId: wp.id,
        message: 'Departure must be MM-DDTHH:00, e.g. 07-15T08:00.',
      });
    }
    const stay = hoursBetween(wp.arrival, wp.departure);
    if (stay !== null && stay < 0) {
      found.push({ waypointId: wp.id, message: 'Departure is before arrival.' });
    }
    const previous = waypoints[i - 1];
    if (previous) {
      const transit = hoursBetween(previous.departure, wp.arrival);
      if (transit !== null && transit < 0) {
        found.push({
          waypointId: wp.id,
          message: `Arrives before leaving ${previous.name}.`,
        });
      }
    }
  });

  return found;
}

/** `12.5 h` → `12 h 30 min`, for display. */
export function formatDuration(hours: number): string {
  const sign = hours < 0 ? '-' : '';
  const total = Math.round(Math.abs(hours) * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${sign}${m} min`;
  return m === 0 ? `${sign}${h} h` : `${sign}${h} h ${m} min`;
}

/** 60.1234 → `60.123° N` */
export function formatLat(lat: number): string {
  return `${Math.abs(lat).toFixed(3)}° ${lat >= 0 ? 'N' : 'S'}`;
}

export function formatLon(lon: number): string {
  const wrapped = ((lon + 180) % 360 + 360) % 360 - 180;
  return `${Math.abs(wrapped).toFixed(3)}° ${wrapped >= 0 ? 'E' : 'W'}`;
}
