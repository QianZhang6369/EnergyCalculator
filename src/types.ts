/** Shared data model for the four wizard steps. */

export type VesselId = string;

export type VesselCategory = 'Passenger' | 'Offshore' | 'Special';

/** Key information for one specific vessel. Any field may be omitted. */
export interface VesselSpecs {
  /** Length overall, m. */
  loa?: number;
  /** Beam, m. */
  beam?: number;
  /** Passengers or special personnel (technicians, scientists), persons. */
  passengers?: number;
  /** Crew, persons. */
  crew?: number;
  /** Air-conditioned floor area, m². */
  conditionedArea?: number;
  /** Gross tonnage, GT. */
  grossTonnage?: number;
}

export interface Vessel {
  id: VesselId;
  name: string;
  category: VesselCategory;
  /** One-line HVAC characteristic shown on the card and in the library list. */
  tagline: string;
  specs: VesselSpecs;
  /** Shown as a card at the top of step 1 rather than only in the library. */
  featured?: boolean;
  /** Longer text shown once the vessel is selected. */
  description?: string;
  /** Key into the figure registry in `components/figures/VesselFigure.tsx`. */
  figure?: string;
}

/** One sample of the weather profile: conditions at a position and time. */
export interface WeatherPoint {
  /** ISO timestamp of the sample. */
  time: string;
  /** Interpolated vessel position at that time. */
  lat: number;
  lon: number;
  /** Ambient dry-bulb air temperature, °C. */
  airTemp: number;
  /** Seawater temperature, °C. */
  seawaterTemp: number;
  /** Relative humidity, %. */
  relativeHumidity: number;
  /** Global solar irradiance on a horizontal surface, W/m². */
  solarRadiation: number;
}

/** One stop on the vessel's itinerary. */
export interface Waypoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Local datetime as `YYYY-MM-DDTHH:mm`, or '' when not set. */
  arrival: string;
  departure: string;
}

/** Step 2 — itinerary plus the weather profile sampled along it. */
export interface WeatherCondition {
  waypoints: Waypoint[];
  /** Sampling interval of `series`, in hours. */
  intervalHours: number;
  /** Time series over the whole itinerary; empty until generated. */
  series: WeatherPoint[];
}

/** Step 3 — every value is kept as a string so partially typed input survives. */
export type DesignParameters = Record<string, string>;

export type SystemLayoutId =
  | 'chiller-2way'
  | 'chiller-3way'
  | 'chiller-2way-fc'
  | 'chiller-3way-fc'
  | 'tems';

/** Step 4 */
export interface AirWaterSystem {
  layout: SystemLayoutId | null;
  parameters: Record<string, string>;
}

export interface ProjectData {
  projectName: string;
  vesselId: VesselId | null;
  weather: WeatherCondition;
  design: DesignParameters;
  system: AirWaterSystem;
}
