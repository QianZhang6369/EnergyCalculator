import type { DesignParameters, WeatherPoint } from '../types';

/**
 * Sensible heat balance for the conditioned spaces, in the style of ISO 7547
 * ("Ships and marine technology — Air-conditioning and ventilation of
 * accommodation spaces — Design conditions and basis of calculations").
 *
 * IMPORTANT — read before trusting a number out of this file:
 *
 * 1. This is an ISO 7547-STYLE balance, not a certified implementation of the
 *    standard. The structure follows it (transmission through each boundary +
 *    ventilation + internal gains against an indoor set-point), but the
 *    coefficients, area model and diversity factors here are this app's own.
 *    Check them against the current text of the standard before relying on
 *    them.
 *
 * 2. The deliberate departure from ISO 7547 is the ambient condition. The
 *    standard works from a single fixed design condition; here the ambient air
 *    and seawater temperatures come from the step 2 weather profile, so the
 *    balance is evaluated at every timestep along the itinerary rather than
 *    once at a design point.
 *
 * 3. Cooling includes the LATENT load — dehumidifying the outside air down to
 *    the indoor humidity ratio, plus the moisture given off by people. Indoor
 *    humidity is not an input any more, so it is fixed by pairing the cooling
 *    set-point with `INDOOR_DESIGN_RH` below. Heating stays sensible-only, which
 *    is correct: humidification is not modelled.
 *
 * 4. Wind speed from step 2 is not used; external surface coefficients are
 *    assumed constant, as in the standard.
 */

const AIR_DENSITY = 1.2; // kg/m³
const AIR_CP = 1005; // J/kgK
/** Latent heat of vaporisation of water, J/kg. */
const H_FG = 2_450_000;
/**
 * Indoor humidity assumed for the dehumidification calculation. Indoor humidity
 * was removed from the step 3 inputs, so the cooling set-point is paired with
 * this relative humidity to fix the indoor humidity ratio. Make it an input
 * again if the design condition needs to vary.
 */
const INDOOR_DESIGN_RH = 50;
/** Latent heat released per person, W. */
const LATENT_PER_PERSON = 55;

/*
 * Sol-air temperature constants. Sun falling on decks and bulkheads warms them
 * well above ambient, and the resulting transmission is a large part of a
 * marine cooling load — larger than the window gain on most vessels, because
 * the opaque area dwarfs the glazed area. Standard practice is to drive the
 * opaque surfaces from sol-air temperature rather than air temperature.
 */
/** Solar absorptance of light marine paint. Dark hulls are nearer 0.9. */
const SOLAR_ABSORPTANCE = 0.45;
/** Outside surface heat transfer coefficient, W/m²K. */
const OUTSIDE_FILM = 22;
/** Long-wave radiation loss to a clear sky from a horizontal surface, K. */
const SKY_RADIATION_K = 3.9;
/**
 * Global horizontal irradiance reaching a vertical surface, averaged over the
 * orientations a deckhouse presents to the sun.
 */
const VERTICAL_IRRADIANCE_FACTOR = 0.45;

/** Saturation vapour pressure over water, Pa (Magnus). */
const satPressure = (tempC: number) =>
  610.94 * Math.exp((17.625 * tempC) / (tempC + 243.04));

/** Humidity ratio, kg water per kg dry air, at sea-level pressure. */
const humidityRatio = (tempC: number, rhPercent: number) => {
  const pv = (rhPercent / 100) * satPressure(tempC);
  return (0.622 * pv) / (101_325 - pv);
};

const num = (params: DesignParameters, key: string): number => {
  const raw = params[key];
  const value = Number(raw);
  return raw === undefined || raw === '' || Number.isNaN(value) ? NaN : value;
};

export interface LoadPoint {
  time: string;
  /** kW, zero when not heating. */
  heating: number;
  /** kW, zero when not cooling. */
  cooling: number;
  /** Component breakdown at the governing set-point, kW. */
  transmission: number;
  ventilation: number;
  internal: number;
  solar: number;
  /** Dehumidification load included in `cooling`, kW. */
  latent: number;
  airTemp: number;
}

export interface LoadResult {
  points: LoadPoint[];
  peakHeating: { kW: number; time: string } | null;
  peakCooling: { kW: number; time: string } | null;
  /** Integrated over the itinerary, kWh. */
  heatingEnergy: number;
  coolingEnergy: number;
  heatingHours: number;
  coolingHours: number;
  neutralHours: number;
  /** Steady conductance figures, for display. */
  uaAir: number;
  uaSea: number;
  ventilationUA: number;
  internalGain: number;
}

/**
 * Daylight shape applied to the design solar irradiance: zero at night, peak at
 * local noon. Used because solar radiation is not part of the weather profile.
 */
const daylightFactor = (date: Date): number => {
  const hour = date.getHours() + date.getMinutes() / 60;
  const f = Math.sin((Math.PI * (hour - 6)) / 12);
  return f > 0 ? f : 0;
};

export interface MissingInput {
  key: string;
}

/** Returns the parameter keys that are blank or non-numeric. */
export function missingInputs(params: DesignParameters): string[] {
  const required = [
    'conditionedVolume',
    'exposedBulkheadArea',
    'exposedDeckArea',
    'windowArea',
    'shellAreaSeawater',
    'uBulkhead',
    'uDeck',
    'uWindow',
    'uShell',
    'solarFactor',
    'solarIrradiance',
    'personsOnBoard',
    'sensiblePerPerson',
    'occupancyFactor',
    'lightingLoad',
    'equipmentLoad',
    'conditionedArea',
    'winterIndoorTemp',
    'summerIndoorTemp',
    'freshAirPerPerson',
    'airChangeRate',
    'heatRecovery',
  ];
  return required.filter((key) => Number.isNaN(num(params, key)));
}

export function calculateLoads(
  params: DesignParameters,
  series: WeatherPoint[],
  intervalHours: number,
): LoadResult | null {
  if (series.length === 0 || missingInputs(params).length > 0) return null;

  const p = (key: string) => num(params, key);

  // Transmission conductance to outside air, W/K.
  // Split by boundary, because the opaque surfaces see sol-air temperature
  // while glazing does not (its solar gain is counted separately as the
  // transmitted component).
  const uaBulkhead = p('uBulkhead') * p('exposedBulkheadArea');
  const uaDeck = p('uDeck') * p('exposedDeckArea');
  const uaWindow = p('uWindow') * p('windowArea');
  const uaAir = uaBulkhead + uaDeck + uaWindow;

  // Transmission conductance to seawater, W/K.
  const uaSea = p('uShell') * p('shellAreaSeawater');

  // Ventilation: OUTSIDE AIR ONLY — the larger of the per-person fresh air
  // requirement and the minimum fresh-air change rate, less any heat recovery.
  // Recirculated supply air is deliberately excluded: it re-enters at room
  // condition and carries no outdoor-air load, so counting the total supply air
  // change rate here would overstate the load several times over.
  const flowPersons = p('personsOnBoard') * p('freshAirPerPerson'); // m³/h
  const flowChanges = p('airChangeRate') * p('conditionedVolume'); // m³/h
  const flow = Math.max(flowPersons, flowChanges);
  const recovery = Math.min(0.95, Math.max(0, p('heatRecovery') / 100));
  const ventilationUA = (flow / 3600) * AIR_DENSITY * AIR_CP * (1 - recovery); // W/K

  // Internal gains, W — constant over the itinerary.
  const internalGain =
    p('personsOnBoard') * p('occupancyFactor') * p('sensiblePerPerson') +
    (p('lightingLoad') + p('equipmentLoad')) * p('conditionedArea');

  const solarPeak = p('windowArea') * p('solarFactor') * p('solarIrradiance'); // W

  const tHeat = p('winterIndoorTemp');
  const tCool = p('summerIndoorTemp');

  // Latent side: outside air mass flow, the indoor humidity ratio it is dried
  // down to, and the moisture the occupants add.
  const ventilationMassFlow = (flow / 3600) * AIR_DENSITY; // kg/s
  const indoorW = humidityRatio(tCool, INDOOR_DESIGN_RH);
  const occupantLatent = p('personsOnBoard') * p('occupancyFactor') * LATENT_PER_PERSON;

  const points: LoadPoint[] = [];
  let heatingEnergy = 0;
  let coolingEnergy = 0;
  let heatingHours = 0;
  let coolingHours = 0;

  for (const sample of series) {
    const date = new Date(sample.time);
    // Prefer the irradiance carried by the weather profile. The design
    // irradiance shaped over the day is only a fallback for a series that has
    // no solar data.
    const solar =
      typeof sample.solarRadiation === 'number'
        ? p('windowArea') * p('solarFactor') * sample.solarRadiation
        : solarPeak * daylightFactor(date);

    // Sol-air temperature of the opaque surfaces: sunlit steel runs well above
    // ambient. The horizontal term also loses long-wave heat to the sky, which
    // is why a deck can sit below air temperature on a clear night.
    const irradiance = sample.solarRadiation ?? 0;
    const deckSolAir =
      sample.airTemp + (SOLAR_ABSORPTANCE * irradiance) / OUTSIDE_FILM - SKY_RADIATION_K;
    const bulkheadSolAir =
      sample.airTemp +
      (SOLAR_ABSORPTANCE * irradiance * VERTICAL_IRRADIANCE_FACTOR) / OUTSIDE_FILM;

    /** Net heat the plant must add at indoor temperature `ti`, in W. */
    const net = (ti: number) =>
      uaBulkhead * (ti - bulkheadSolAir) +
      uaDeck * (ti - deckSolAir) +
      uaWindow * (ti - sample.airTemp) +
      uaSea * (ti - sample.seawaterTemp) +
      ventilationUA * (ti - sample.airTemp) -
      internalGain -
      solar;

    // Latent load: moisture carried in by the outside air above the indoor
    // humidity ratio, plus what the occupants give off. Only ever a cooling
    // load — humidification is not modelled.
    const outdoorW = humidityRatio(sample.airTemp, sample.relativeHumidity);
    const latentW =
      ventilationMassFlow * H_FG * Math.max(0, outdoorW - indoorW) + occupantLatent;

    // Two set-points with a dead band between them, so at most one of these is
    // positive. Dehumidification can still be needed inside the dead band, so
    // the latent load rides on the cooling side whenever heating is off.
    const heating = Math.max(0, net(tHeat)) / 1000;
    const cooling = heating > 0 ? 0 : (Math.max(0, -net(tCool)) + latentW) / 1000;

    const governing = heating > 0 ? tHeat : tCool;
    points.push({
      time: sample.time,
      heating,
      cooling,
      latent: heating > 0 ? 0 : latentW / 1000,
      transmission:
        (uaAir * (governing - sample.airTemp) + uaSea * (governing - sample.seawaterTemp)) /
        1000,
      ventilation: (ventilationUA * (governing - sample.airTemp)) / 1000,
      internal: internalGain / 1000,
      solar: solar / 1000,
      airTemp: sample.airTemp,
    });

    heatingEnergy += heating * intervalHours;
    coolingEnergy += cooling * intervalHours;
    if (heating > 0) heatingHours += intervalHours;
    else if (cooling > 0) coolingHours += intervalHours;
  }

  const peakOf = (key: 'heating' | 'cooling') => {
    let best: LoadPoint | null = null;
    for (const point of points) if (!best || point[key] > best[key]) best = point;
    return best && best[key] > 0 ? { kW: best[key], time: best.time } : null;
  };

  const totalHours = series.length * intervalHours;

  return {
    points,
    peakHeating: peakOf('heating'),
    peakCooling: peakOf('cooling'),
    heatingEnergy,
    coolingEnergy,
    heatingHours,
    coolingHours,
    neutralHours: Math.max(0, totalHours - heatingHours - coolingHours),
    uaAir,
    uaSea,
    ventilationUA,
    internalGain,
  };
}
