import type { CoolingSource, HeatSource } from './airSystems';
import type { WindowType } from './zones';

/**
 * Step 3 — general design parameters.
 *
 * Room set-points per room group, the envelope and air properties, the window
 * types, and the operating, fan and chiller parameters of the air handling
 * units.
 *
 * Ported from EnergyCalculator Light, names included, so its per-group load
 * calculation can follow later without a data migration. Light's weather
 * selection is left out: step 2 owns the weather here. Nothing in this file
 * feeds the results yet, apart from the fan figures shown in step 3 itself.
 */

/** How the AHU fan power is obtained. */
export type FanMethod = 'sfp' | 'pressure';

export const FAN_METHODS: { value: FanMethod; label: string }[] = [
  { value: 'sfp', label: 'SFP' },
  { value: 'pressure', label: 'Pressure drop' },
];

/** Operating parameters of one AHU. */
export interface AhuParams {
  /** Supply set-point at cold outdoor, °C — the cold end of the ramp. */
  winterSetpoint_C: number;
  /** Supply set-point at warm outdoor, °C — the warm end of the ramp. */
  summerSetpoint_C: number;
  /** Outdoor temperature at or below which the supply is the winter set-point, °C. */
  rampOatLow_C: number;
  /** Outdoor temperature at or above which the supply is the summer set-point, °C. */
  rampOatHigh_C: number;
  /** Whether the AHU has a heat-recovery (enthalpy) wheel. */
  hasWheel: boolean;
  /** Wheel sensible (temperature) efficiency, 0–100 %. */
  wheelTempEff_pct: number;
  /** Wheel latent (humidity) efficiency, 0–100 %. */
  wheelHumidityEff_pct: number;
  /** Enthalpy-wheel return-air ratio, 0–1. */
  wheelReturnRatio: number;
  /** Supply-fan temperature rise, fan before the coil, K. */
  fanDeltaT_K: number;
  /** Recirculated air share of supply, 0 or 100 % (above 0 = recirculating). */
  recircAir_pct: number;
  /** Fan power method — which of the fan inputs below are used. */
  fanMethod: FanMethod;
  /** Supply-fan specific fan power, kW per m³/s — method SFP. */
  sfpSupply_kWm3s: number;
  /** Extract airflow as a fraction of the supply airflow (0 = no extract fan). */
  extractAirRatio: number;
  /** Extract-fan specific fan power, kW per m³/s — method SFP. */
  sfpExtract_kWm3s: number;
  /** Supply-fan total pressure drop at design airflow, Pa — method Pressure drop. */
  fanDpSupply_Pa: number;
  /** Supply-fan overall efficiency, fan × motor × drive, 0–1. */
  fanEffSupply: number;
  /** Extract-fan total pressure drop at design airflow, Pa. */
  fanDpExtract_Pa: number;
  /** Extract-fan overall efficiency, fan × motor × drive, 0–1. */
  fanEffExtract: number;
  /** Heating source for the AHU coil's heating (preheat) duty. */
  heatSource: HeatSource;
  /** Cooling source for the AHU coil's cooling duty. */
  coolSource: CoolingSource;
}

export function defaultAhuParams(): AhuParams {
  return {
    winterSetpoint_C: 20,
    summerSetpoint_C: 12,
    rampOatLow_C: 10,
    rampOatHigh_C: 16,
    hasWheel: false,
    wheelTempEff_pct: 75,
    wheelHumidityEff_pct: 65,
    wheelReturnRatio: 0.95,
    fanDeltaT_K: 2,
    recircAir_pct: 0,
    fanMethod: 'sfp',
    sfpSupply_kWm3s: 2.4,
    extractAirRatio: 0.95,
    sfpExtract_kWm3s: 2,
    // 1 500 / 1 250 Pa at 0.625 reproduce SFP 2.4 / 2.0.
    fanDpSupply_Pa: 1500,
    fanEffSupply: 0.625,
    fanDpExtract_Pa: 1250,
    fanEffExtract: 0.625,
    heatSource: 'Electricity',
    coolSource: 'Chiller',
  };
}

/**
 * SFP used for the fan power, kW per m³/s: the SFP input (method SFP), or total
 * pressure drop (Pa) ÷ 1000 ÷ overall efficiency (method Pressure drop; 0 when
 * the efficiency is not positive).
 */
export function fanSfpUsed(ahu: AhuParams): { supply_kWm3s: number; extract_kWm3s: number } {
  if (ahu.fanMethod !== 'pressure') {
    return { supply_kWm3s: ahu.sfpSupply_kWm3s, extract_kWm3s: ahu.sfpExtract_kWm3s };
  }
  const fromPressure = (dp: number, eff: number) => (eff > 0 ? dp / 1000 / eff : 0);
  return {
    supply_kWm3s: fromPressure(ahu.fanDpSupply_Pa, ahu.fanEffSupply),
    extract_kWm3s: fromPressure(ahu.fanDpExtract_Pa, ahu.fanEffExtract),
  };
}

/** Constant-airflow fan power of an AHU at the given supply airflow. */
export function fanPower(
  airflow_m3h: number,
  ahu: AhuParams,
): { supply_kW: number; extract_kW: number; total_kW: number } {
  const flow_m3s = airflow_m3h / 3600;
  const sfp = fanSfpUsed(ahu);
  const supply_kW = flow_m3s * sfp.supply_kWm3s;
  const extract_kW = flow_m3s * ahu.extractAirRatio * sfp.extract_kWm3s;
  return { supply_kW, extract_kW, total_kW: supply_kW + extract_kW };
}

/** Default room set-point temperature (°C) and relative humidity (%). */
export const DEFAULT_ROOM_SETPOINT_C = 24;
export const DEFAULT_ROOM_HUMIDITY_PCT = 50;

/** Thermal properties of a window type. */
export interface WindowProps {
  /** Thermal transmittance, W/m²·K. */
  u_value: number;
  /** Solar radiation allowance at the reference irradiance, W/m². */
  radiation: number;
}

/** Global design parameters. */
export interface DesignParams {
  /** Bulkhead (external wall) U-value, W/m²·K. */
  bulkhead_U: number;
  /** Reference irradiance behind the solar allowance, W/m²; g = radiation / refGTI. */
  refGTI_Wm2: number;
  /** Sensible heat gain per person, W. */
  heatPerPersonSensible_W: number;
  /** Barometric pressure, Pa. */
  pAtm_Pa: number;
  /** Air ρ·cp for sensible terms, kJ/m³·K. */
  rhoCp: number;
  /** Air density for enthalpy and latent terms, kg/m³. */
  airDensity_kgm3: number;
  /** Reduced occupancy — fresh-air method C then delivers 40 m³/h per room. */
  occupancyReduced: boolean;
  /** Chiller fixed COP (cooling kW ÷ electric kW). */
  chillerCOP: number;
  /** U-value and radiation per window type. */
  windows: Record<WindowType, WindowProps>;
}

export function defaultDesignParams(): DesignParams {
  return {
    bulkhead_U: 0.6,
    refGTI_Wm2: 800,
    heatPerPersonSensible_W: 70,
    pAtm_Pa: 101325,
    rhoCp: 1.2,
    airDensity_kgm3: 1.2,
    occupancyReduced: false,
    chillerCOP: 3.5,
    // Radiation is the solar allowance at the reference irradiance; the
    // effective g-value is radiation / refGTI.
    windows: {
      'Type 1': { u_value: 1.1, radiation: 240 },
      'Type 2': { u_value: 3.5, radiation: 350 },
    },
  };
}

/** Step 3 — the design side of the project. */
export interface HvacDesign {
  params: DesignParams;
  /** Per AHU, keyed by its id. Missing units use the defaults. */
  ahuParams: Record<string, AhuParams>;
  /** Room set-point per room group, °C, keyed by the group's `uid`. */
  roomSetpoints: Record<string, number>;
  /** Room relative humidity per room group, %, keyed by the group's `uid`. */
  roomHumidity: Record<string, number>;
}

export const emptyHvacDesign = (): HvacDesign => ({
  params: defaultDesignParams(),
  ahuParams: {},
  roomSetpoints: {},
  roomHumidity: {},
});

/** A stored design made safe; projects saved before this step have none. */
export function normalizeHvacDesign(stored: Partial<HvacDesign> | undefined): HvacDesign {
  const base = emptyHvacDesign();
  return {
    params: {
      ...base.params,
      ...stored?.params,
      windows: { ...base.params.windows, ...stored?.params?.windows },
    },
    ahuParams: stored?.ahuParams ?? {},
    roomSetpoints: stored?.roomSetpoints ?? {},
    roomHumidity: stored?.roomHumidity ?? {},
  };
}

/** Parameters of one AHU: what is stored, over the defaults. */
export const ahuParamsOf = (design: HvacDesign, ahuId: string): AhuParams => ({
  ...defaultAhuParams(),
  ...design.ahuParams[ahuId],
});

/**
 * Outdoor-air handling mode of an AHU:
 *  - oa100        · 100 % outdoor air, once-through (e.g. galley)
 *  - oa100_wheel  · 100 % outdoor air with a heat-recovery wheel
 *  - recirc       · recirculating: minimum fresh air plus return air
 */
export type OaMode = 'oa100' | 'oa100_wheel' | 'recirc';

/** The mode follows from the wheel flag and recirculation; recirculation wins. */
export function ahuOaMode(ahu: Pick<AhuParams, 'hasWheel' | 'recircAir_pct'>): OaMode {
  if (ahu.recircAir_pct > 0) return 'recirc';
  return ahu.hasWheel ? 'oa100_wheel' : 'oa100';
}

export const modeHasWheel = (mode: OaMode) => mode === 'oa100_wheel';

export const modeIsRecirc = (mode: OaMode) => mode === 'recirc';

/**
 * Supply-air set-point at a given outdoor temperature, ramping linearly from
 * the cold set-point (at or below the low ramp temperature) to the warm
 * set-point (at or above the high one).
 */
export function supplySetpointAt(
  oat_C: number,
  p: Pick<AhuParams, 'winterSetpoint_C' | 'summerSetpoint_C' | 'rampOatLow_C' | 'rampOatHigh_C'>,
): number {
  const { winterSetpoint_C: cold, summerSetpoint_C: warm } = p;
  const lo = p.rampOatLow_C;
  const hi = p.rampOatHigh_C;
  if (hi <= lo) return warm;
  if (oat_C <= lo) return cold;
  if (oat_C >= hi) return warm;
  return cold + (warm - cold) * ((oat_C - lo) / (hi - lo));
}

/** What the load calculation reads: step 3's parameters plus step 4's fan sizing. */
export type LoadDesign = DesignParams & {
  terminalFanPercentile: number;
  terminalFanOversizing: number;
};
