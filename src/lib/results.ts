import type { DesignParameters, SystemLayoutId, WeatherPoint, Waypoint } from '../types';
import { climatology, makeWave, positionAt, solarIrradiance, timeRange } from './weather';
import { calculateLoads, type LoadPoint } from './heatBalance';

/**
 * Annual results.
 *
 * WHAT IS REAL AND WHAT IS NOT:
 *
 *  - The weather is SYNTHETIC. A full year is generated from the same
 *    latitude/season climatology used in step 2, with the vessel cycling around
 *    its itinerary repeatedly through the year. No forecast data is involved.
 *  - The load profile IS computed, by running the step 3 heat balance against
 *    that synthetic weather at every hour. So the loads follow the design
 *    parameters and the weather, they are not random.
 *  - The plant model below (COP against seawater, pump laws, free-cooling
 *    changeover) uses PLACEHOLDER coefficients defined in this file. They are
 *    plausible, not vendor data. Once the equipment catalogue carries typed
 *    ratings, read them from the selected chiller and pump instead.
 */

const HOURS_PER_YEAR = 8760;

/** Placeholder plant assumptions — replace with data from the selected equipment. */
const PLANT = {
  /** COP at the reference seawater temperature below. */
  ratedCop: 5.0,
  referenceSeawater: 20,
  /** Fractional COP change per K of seawater above the reference. */
  copPerKelvin: 0.022,
  minCop: 1.6,
  maxCop: 9,
  /** Chilled water pump absorbed power at design flow, as a share of peak cooling. */
  pumpShareOfPeak: 0.035,
  /** Variable-speed pumps do not go below this share of design speed. */
  minSpeedRatio: 0.35,
  /** Seawater temperature below which free cooling can carry the load. */
  freeCoolingChangeover: 12,
  /** Seawater pump power while free cooling, as a share of design pump power. */
  freeCoolingPumpShare: 1.15,
  /** Seasonal COP of the heating plant. */
  heatingCop: 3.2,
  /** Share of heating met by recovered condenser heat on a TEMS plant. */
  temsRecoveryShare: 0.6,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number, d = 1) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

/**
 * A full year of synthetic weather. The vessel repeats its itinerary as many
 * times as fits in the year, so position — and therefore climate — varies the
 * way it would in service.
 */
export function generateYear(waypoints: Waypoint[], year: number): WeatherPoint[] {
  const range = timeRange(waypoints);
  const start = Date.UTC(year, 0, 1);

  const waveAir = makeWave();
  const waveSea = makeWave();
  const waveRh = makeWave();
  const waveCloud = makeWave();

  const points: WeatherPoint[] = [];
  for (let h = 0; h < HOURS_PER_YEAR; h += 1) {
    const ms = start + h * 3_600_000;
    const date = new Date(ms);

    let lat = 40;
    let lon = 0;
    if (range) {
      // Loop the itinerary through the year.
      const legMs = range.end - range.start;
      const phase = ((h * 3_600_000) % legMs) + range.start;
      const pos = positionAt(waypoints, phase);
      lat = pos.lat;
      lon = pos.lon;
    } else if (waypoints.length > 0) {
      lat = waypoints[0].lat;
      lon = waypoints[0].lon;
    }

    const mean = climatology(lat, date.getMonth());
    const diurnal = 2.4 * Math.sin(2 * Math.PI * ((date.getHours() - 9) / 24));
    const airAnomaly = diurnal + 3.6 * waveAir(h);

    points.push({
      time: date.toISOString(),
      lat: round(lat, 3),
      lon: round(lon, 3),
      airTemp: round(clamp(mean.air + airAnomaly, -35, 45)),
      seawaterTemp: round(clamp(mean.sea + 0.9 * waveSea(h), -1.8, 34)),
      relativeHumidity: round(
        clamp(82 - 0.16 * Math.abs(lat) - 1.4 * airAnomaly + 9 * waveRh(h), 25, 100),
        0,
      ),
      solarRadiation: Math.round(
        solarIrradiance(lat, lon, date, clamp(0.68 + 0.32 * waveCloud(h), 0.35, 1)),
      ),
    });
  }
  return points;
}

export interface PlantPoint {
  /** Electrical power of the chillers, kW. */
  chillerKw: number;
  /** Electrical power of the chilled water pumps, kW. */
  pumpKw: number;
  /** Electrical power of the heating plant, kW. */
  heatingKw: number;
  /**
   * Chiller COP available at the current seawater temperature. Always defined —
   * it is a property of the machine and the sea, not of whether it happens to be
   * running, so the series stays continuous instead of collapsing to zero
   * whenever the plant is off.
   */
  cop: number;
  freeCooling: boolean;
}

export interface EquipmentSummary {
  item: string;
  capacityKw: number;
  peakKw: number;
  annualKwh: number;
  hours: number;
  averageCop: number | null;
}

export interface ResultsData {
  weather: WeatherPoint[];
  loads: LoadPoint[];
  plant: PlantPoint[];
  peakCooling: number;
  peakHeating: number;
  coolingEnergy: number;
  heatingEnergy: number;
  equipment: EquipmentSummary[];
  totalElectricity: number;
  specificEnergy: number | null;
  freeCoolingHours: number;
  seasonalCop: number | null;
}

/**
 * How the configuration chosen in step 4 changes the plant model.
 * Two-way valves let the pump slow down; three-way valves do not. The
 * free-cooling and TEMS configurations can stop the compressors in cold water.
 */
const configTraits = (layout: SystemLayoutId | null) => ({
  variableFlow: layout === 'chiller-2way' || layout === 'chiller-2way-fc' || layout === 'tems',
  freeCooling:
    layout === 'chiller-2way-fc' || layout === 'chiller-3way-fc' || layout === 'tems',
  heatRecovery: layout === 'tems',
});

export function computeResults(
  design: DesignParameters,
  waypoints: Waypoint[],
  layout: SystemLayoutId | null,
  year: number,
): ResultsData | null {
  const weather = generateYear(waypoints, year);
  const loadResult = calculateLoads(design, weather, 1);
  if (!loadResult) return null;

  const loads = loadResult.points;
  const traits = configTraits(layout);

  const peakCooling = Math.max(1, ...loads.map((p) => p.cooling));
  const peakHeating = Math.max(0, ...loads.map((p) => p.heating));
  const pumpDesignKw = peakCooling * PLANT.pumpShareOfPeak;

  const plant: PlantPoint[] = [];
  let chillerKwh = 0;
  let pumpKwh = 0;
  let heatingKwh = 0;
  let chillerHours = 0;
  let pumpHours = 0;
  let heatingHours = 0;
  let freeCoolingHours = 0;
  let coolingDelivered = 0;
  let peakChiller = 0;
  let peakPump = 0;
  let peakHeatingKw = 0;

  loads.forEach((point, i) => {
    const sea = weather[i].seawaterTemp;
    const running = point.cooling > 0;
    const canFreeCool = traits.freeCooling && sea < PLANT.freeCoolingChangeover;

    // COP falls as seawater warms.
    const cop = clamp(
      PLANT.ratedCop * (1 - PLANT.copPerKelvin * (sea - PLANT.referenceSeawater)),
      PLANT.minCop,
      PLANT.maxCop,
    );

    const freeCooling = running && canFreeCool;
    const chillerKw = running && !freeCooling ? point.cooling / cop : 0;

    let pumpKw = 0;
    if (running) {
      if (freeCooling) {
        pumpKw = pumpDesignKw * PLANT.freeCoolingPumpShare;
      } else if (traits.variableFlow) {
        // Affinity law on the throttled flow ratio.
        const ratio = clamp(point.cooling / peakCooling, PLANT.minSpeedRatio, 1);
        pumpKw = pumpDesignKw * ratio ** 3;
      } else {
        pumpKw = pumpDesignKw;
      }
    }

    // Heating: recovered condenser heat displaces part of the demand on TEMS.
    const recovered = traits.heatRecovery ? PLANT.temsRecoveryShare : 0;
    const heatingKw =
      point.heating > 0 ? (point.heating * (1 - recovered)) / PLANT.heatingCop : 0;

    plant.push({
      chillerKw: round(chillerKw),
      pumpKw: round(pumpKw, 2),
      heatingKw: round(heatingKw),
      cop: round(cop, 2),
      freeCooling,
    });

    chillerKwh += chillerKw;
    pumpKwh += pumpKw;
    heatingKwh += heatingKw;
    if (chillerKw > 0) chillerHours += 1;
    if (pumpKw > 0) pumpHours += 1;
    if (heatingKw > 0) heatingHours += 1;
    if (freeCooling) freeCoolingHours += 1;
    coolingDelivered += point.cooling;
    peakChiller = Math.max(peakChiller, chillerKw);
    peakPump = Math.max(peakPump, pumpKw);
    peakHeatingKw = Math.max(peakHeatingKw, heatingKw);
  });

  const area = Number(design.conditionedArea);
  const totalElectricity = chillerKwh + pumpKwh + heatingKwh;

  return {
    weather,
    loads,
    plant,
    peakCooling: round(peakCooling),
    peakHeating: round(peakHeating),
    coolingEnergy: round(coolingDelivered, 0),
    heatingEnergy: round(loadResult.heatingEnergy, 0),
    freeCoolingHours,
    seasonalCop: chillerKwh > 0 ? round(coolingDelivered / chillerKwh, 2) : null,
    totalElectricity: round(totalElectricity, 0),
    specificEnergy:
      Number.isFinite(area) && area > 0 ? round(totalElectricity / area, 1) : null,
    equipment: [
      {
        item: 'Chillers',
        capacityKw: round(peakCooling, 0),
        peakKw: round(peakChiller, 0),
        annualKwh: round(chillerKwh, 0),
        hours: chillerHours,
        averageCop: chillerKwh > 0 ? round(coolingDelivered / chillerKwh, 2) : null,
      },
      {
        item: 'Chilled water pumps',
        capacityKw: round(pumpDesignKw, 1),
        peakKw: round(peakPump, 1),
        annualKwh: round(pumpKwh, 0),
        hours: pumpHours,
        averageCop: null,
      },
      {
        item: 'Heating plant',
        capacityKw: round(peakHeating, 0),
        peakKw: round(peakHeatingKw, 0),
        annualKwh: round(heatingKwh, 0),
        hours: heatingHours,
        averageCop: PLANT.heatingCop,
      },
    ],
  };
}
