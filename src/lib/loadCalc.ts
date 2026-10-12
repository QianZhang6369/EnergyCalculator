import {
  freshAirBreakdown,
  lightingFractions,
  occupancyFractions,
  type Ahu,
  type CoolingSource,
  type HeatSource,
  type ZoneAirConfig,
} from './airSystems'
import {
  ahuOaMode,
  fanPower,
  modeHasWheel,
  modeIsRecirc,
  supplySetpointAt,
  type AhuParams,
  type LoadDesign as DesignParams,
  type OaMode,
} from './hvacDesign'
import { resolveZone, type Zone } from './zones'

// This file is EnergyCalculator Light's engine, kept as close to the original
// as possible (formatting included) so later fixes there can be carried over.
// Differences: the imports above, the weather rows are passed in instead of
// being picked from a built-in dataset, and the fan helpers live in
// hvacDesign.ts.

/** One hour of weather, as the engine reads it. */
export interface WeatherHour {
  /** `YYYY-MM-DD HH:00:00`, GMT. */
  time: string
  temp_C: number
  rh_pct: number
  solarMean_Wm2: number
}

// ---------------------------------------------------------------------------
// Load & energy calculation — ported from Dubai_2025_Z2_EnergyCalc.xlsx
// (sheet Z2_Aug formula reference). Solar uses the solar_mean column.
// Sign convention: cooling negative, heating positive.
// ---------------------------------------------------------------------------

/** Saturation vapour pressure (Pa) — Magnus/ASHRAE. */
function pSat(t_C: number): number {
  return 610.94 * Math.exp((17.625 * t_C) / (t_C + 243.04))
}

/** Humidity ratio (kg/kg) at dry-bulb T and relative humidity RH%. */
function humidityRatio(t_C: number, rh_pct: number, pAtm: number): number {
  const pw = (rh_pct / 100) * pSat(t_C)
  return (0.621945 * pw) / (pAtm - pw)
}

/** Dew-point temperature (°C) for a given humidity ratio. */
function dewPoint(w: number, pAtm: number): number {
  const pw = (w * pAtm) / (0.621945 + w)
  const l = Math.log(pw / 610.94)
  return (243.04 * l) / (17.625 - l)
}

export interface ZoneLoadSummary {
  zoneUid: string
  zoneId: string
  mode: OaMode
  hours: number
  /** Constant zone fresh-air flow (m³/h). */
  freshFlow_m3h: number
  roomSetpoint_C: number
  /** Zone sensible cooling load (kW): positive = gain to remove. */
  peakSensible_kW: number
  minSensible_kW: number
  meanSensible_kW: number

  // --- 100 % OA modes (once-through / wheel) ---
  /** Mean ventilation cooling (kW, negative) — varies with the supply ramp. */
  ventCooling_kW: number
  /** CBU reheat duty (kW, heating positive). */
  peakReheat_kW: number
  meanReheat_kW: number
  reheatHours: number
  reheatEnergy_kWh: number
  /** Terminal heating supplied by electricity (kWh, positive). */
  terminalHeatElectric_kWh: number
  /** Terminal heating supplied by water — waste heat or heat pump (kWh). */
  terminalHeatWater_kWh: number
  /** Heat from lighting, whole room group (kWh, positive). */
  lightingHeat_kWh: number
  /** Terminal design capacity Q_design = oversizing × design-percentile
   *  terminal heating / cooling of this simulation (kW). */
  terminalDesignCapacity_kW: number
  /** Terminal fan design power = Q_design × fan W per kW (kW); 0 = no fan. */
  terminalFanDesign_kW: number
  /** Terminal fan electricity over the period (kWh). */
  terminalFanEnergy_kWh: number
  /** Part of the reheat caused by overcooling (kWh, positive). */
  overcoolReheat_kWh: number
  /** Hours in overcooling & reheat. */
  overcoolHours: number
  /** Wheel heat recovered in heating (kWh, enthalpy basis, positive). */
  wheelHeating_kWh: number
  /** Sensible part of the wheel heating — the part that replaces AHU coil
   *  heating (kWh, positive). */
  wheelHeatingSensible_kWh: number
  /** Latent part of the wheel heating — moisture added to the fresh air
   *  (kWh, positive). */
  wheelHeatingLatent_kWh: number
  /** Wheel heat removed in pre-cooling (kWh, enthalpy basis, positive). */
  wheelPrecooling_kWh: number
  /** Sensible part of the wheel pre-cooling (kWh, positive = heat removed). */
  wheelPrecoolingSensible_kWh: number
  /** Latent part of the wheel pre-cooling (kWh, positive = moisture
   *  removed). */
  wheelPrecoolingLatent_kWh: number
  ventEnergy_kWh: number

  // --- Recirculating mode ---
  /** Mean outdoor-air sensible load carried by the coil (kW). */
  oaLoadMean_kW: number
  /** Peak AHU cooling-coil duty (kW, cooling negative). */
  peakCoilCooling_kW: number
  /** AHU cooling-coil sensible energy over the period (kWh, negative). */
  coilCoolingEnergy_kWh: number

  // --- terminal-unit cooling (FCU only) ---
  /** Peak terminal-unit cooling duty (kW, cooling negative). */
  peakTerminalCooling_kW: number
  /** Terminal-unit cooling energy over the period (kWh, negative). */
  terminalCoolingEnergy_kWh: number

  // --- energy by source ---
  /** AHU coil cooling of the fresh air over the period (kWh, negative) —
   *  total (sensible + latent) in the 100 % OA modes. */
  ahuCoolEnergy_kWh: number
  /** Latent (dehumidification) part of the AHU coil cooling (kWh, negative). */
  ahuCoolLatentEnergy_kWh: number
  /** AHU coil heating / preheat over the period (kWh, positive). */
  ahuHeatEnergy_kWh: number
  /** Total chiller cooling (AHU + FCU terminal) (kWh, negative). */
  chillerCoolingEnergy_kWh: number
  peakChiller_kW: number
  /** Cooling energy grouped by source (kWh, negative). */
  coolBySource_kWh: Record<CoolingSource, number>
  /** Heating energy grouped by source (kWh, positive). */
  heatBySource_kWh: Record<HeatSource, number>
  /** Electrical heating = heat tagged "Electricity" (kWh, positive). */
  electricalHeating_kWh: number
  peakElectricalHeat_kW: number

  // --- common ---
  /** Energy over the period (kWh, 1 h step). */
  sensibleEnergy_kWh: number
  /** Enthalpy-wheel operating hours. */
  wheelOnHours: number
  wetCoilHours: number
  peakSensibleTime: string
}

/** One fully-detailed hourly row (mirrors the workbook's Z2_Hourly columns). */
export interface ZoneHourPoint {
  time: string
  // weather
  tOut_C: number
  rhOut_pct: number
  wOut: number
  hOut_kJkg: number
  solarMean_Wm2: number
  // room sensible load breakdown (per room)
  transWin_kW: number
  solar_kW: number
  transBulk_kW: number
  /** Share of the design persons present this hour (0–1). */
  occupancyFraction: number
  persons_kW: number
  equip_kW: number
  /** Share of the installed lighting on this hour (0–1). */
  lightingFraction: number
  /** Lighting heat (kW per room). */
  lighting_kW: number
  perRoom_kW: number
  sensible_kW: number // zone total
  // AHU air path
  wheelStatus: 'ON' | 'MODULATING' | 'OFF' | '—'
  /** Wheel fraction (0–1): 1 = ON, partial = modulating, 0 = off / no wheel. */
  wheelFraction: number
  tAfterWheel_C: number
  wAfterWheel: number
  coilInletT_C: number
  coilInletDew_C: number
  condensation: boolean
  supplyW: number
  supplyRH_pct: number
  /** Supply-air set-point for this hour (°C) — ramps with outdoor temp. */
  supplySetpoint_C: number
  // duty (cooling negative, heating positive)
  ventCooling_kW: number
  oaLoad_kW: number
  coilCooling_kW: number
  reheat_kW: number
  /** Overcooling & reheat hour: the terminal heats while the zone has no net
   *  heat loss or the AHU cooling coil is on. */
  overcooling: boolean
  /** Part of the reheat caused by overcooling (kW, positive). */
  overcoolReheat_kW: number
  /** Wheel heat transfer to the fresh air (kW, enthalpy basis): positive =
   *  heat recovered (heating), negative = heat removed (pre-cooling). */
  wheelRecovery_kW: number
  /** Terminal-unit cooling duty (kW, negative). FCU only; CBU-El/CBU-M = 0. */
  terminalCooling_kW: number
  /** AHU coil cooling of the fresh air (kW, negative), total. → Chiller. */
  ahuCool_kW: number
  /** Latent (dehumidification) part of the AHU coil cooling (kW, negative). */
  ahuCoolLatent_kW: number
  /** AHU coil heating / preheat of the fresh air (kW, positive). → heat source. */
  ahuHeat_kW: number
  /** Terminal fan part-load ratio = (terminal heating + |terminal cooling|) ÷
   *  Q_design, max 1. */
  terminalFanPlr: number
  /** Terminal fan power (kW): constant = design power, on-off = design power
   *  × part-load ratio, 0 without an own fan. */
  terminalFan_kW: number
  mode: string
}

/** Percentile of a sample with linear interpolation (Excel PERCENTILE). */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.min(1, Math.max(0, p)) * (sorted.length - 1)
  const lo = Math.floor(rank)
  const hi = Math.ceil(rank)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo)
}

/** Partial vapour pressure (Pa) for a humidity ratio. */
function partialPressure(w: number, pAtm: number): number {
  return (w * pAtm) / (0.621945 + w)
}

/** Moist-air enthalpy (kJ/kg dry air). */
function enthalpy(t_C: number, w: number): number {
  return 1.006 * t_C + w * (2501 + 1.86 * t_C)
}

export interface ZoneLoadResult {
  summary: ZoneLoadSummary
  hourly: ZoneHourPoint[]
}

/** Compute the full hourly load & the summary for one zone. */
export function computeZoneLoad(
  zone: Zone,
  air: ZoneAirConfig,
  ahu: AhuParams,
  design: DesignParams,
  roomSetpoint_C: number,
  roomRH_pct: number,
  rows: WeatherHour[],
): ZoneLoadResult {
  const { count, averages } = resolveZone(zone)
  const win = design.windows[zone.window_type]
  const uWin = win.u_value
  const gEff = win.radiation / (design.refGTI_Wm2 || 800)
  const uBulk = design.bulkhead_U
  const hpp_kW = design.heatPerPersonSensible_W / 1000
  const pAtm = design.pAtm_Pa
  const rhoCp = design.rhoCp
  const fanDeltaT = ahu.fanDeltaT_K
  const wheelReturnRatio = ahu.wheelReturnRatio
  const tRoom = roomSetpoint_C
  // Supply-air (cooling-coil) set-point ramps with outdoor temperature between
  // the cold (winter) and warm (summer) set-points — computed per hour below.
  const netBulk = Math.max(0, averages.bulkhead_m2 - averages.window_m2)

  const freshFlow = freshAirBreakdown(
    zone,
    air.freshAirMethod,
    design.occupancyReduced,
  ).design_m3h
  const oaMode = ahuOaMode(ahu)
  const recirc = modeIsRecirc(oaMode)
  const wheel = modeHasWheel(oaMode)

  // Fresh-air sensible capacity (kW per K).
  const oaCap = (freshFlow / 3600) * rhoCp
  // Fresh-air dry mass flow (kg/s) for the enthalpy (total coil) terms.
  const mAir = (freshFlow / 3600) * design.airDensity_kgm3

  const wRoom = humidityRatio(tRoom, roomRH_pct, pAtm)
  const etaT = ahu.wheelTempEff_pct / 100
  const etaW = ahu.wheelHumidityEff_pct / 100
  const recircFrac = Math.min(1, Math.max(0, ahu.recircAir_pct / 100))
  const modeLabel = oaMode
  // Only FCU terminals can cool; CBU-El / CBU-M are heating-only.
  const isFcu = air.terminalUnit === 'FCU'
  // Share of the design persons present, by hour of day (clock of the weather
  // data, no time offset).
  const occupancy = occupancyFractions(air.occupancyProfile)
  // Installed lighting per room (kW) and the share switched on by hour of day.
  const lightingInstalled_kW = (averages.area_m2 * air.lighting_Wm2) / 1000
  const lightingProfile = lightingFractions(air.lightingProfile)

  const hourly: ZoneHourPoint[] = []
  let sumS = 0
  let sumR = 0
  let sumVent = 0
  let sumCoil = 0
  let sumOaLoad = 0
  let sumTerm = 0
  let sumAhuCool = 0 // magnitude (≥0)
  let sumAhuCoolLatent = 0 // magnitude (≥0)
  let sumAhuHeat = 0 // magnitude (≥0)
  let sumTermCoolMag = 0 // magnitude (≥0)
  let sumOvercool = 0
  let overcoolHours = 0
  let sumLighting = 0 // per room
  let sumWheelHeat = 0
  let sumWheelHeatSensible = 0
  let sumWheelCool = 0 // magnitude (≥0)
  let sumWheelCoolSensible = 0
  let peakS = -Infinity
  let minS = Infinity
  let peakR = -Infinity
  let peakCoil = 0 // most negative (largest cooling)
  let peakTerm = 0 // most negative (largest terminal cooling)
  let peakChillerMag = 0 // magnitude (≥0)
  let peakElecMag = 0 // magnitude (≥0)
  let peakTime = ''
  let reheatHours = 0
  let wheelOnHours = 0
  let wetCoilHours = 0

  for (const r of rows) {
    const dT = r.temp_C - tRoom
    const transWin = (averages.window_m2 * uWin * dT) / 1000
    const solar = (averages.sun_win_m2 * r.solarMean_Wm2 * gEff) / 1000
    const transBulk = (netBulk * uBulk * dT) / 1000
    const hourOfDay = Number(r.time.slice(11, 13)) || 0
    const occFrac = occupancy[hourOfDay] ?? 1
    const persons = averages.persons * hpp_kW * occFrac
    const litFrac = lightingProfile[hourOfDay] ?? 1
    const lighting = lightingInstalled_kW * litFrac
    const perRoom =
      transWin + solar + transBulk + persons + averages.equip_kW + lighting
    const sensible = perRoom * count

    const wOut = humidityRatio(r.temp_C, r.rh_pct, pAtm)
    const hOut = enthalpy(r.temp_C, wOut)

    // Supply set-point ramps with the outdoor temperature.
    const tSupply = supplySetpointAt(r.temp_C, ahu)
    const ventCooling = oaCap * (tSupply - tRoom)
    const wSatSupply = humidityRatio(tSupply, 100, pAtm)

    let reheat = 0
    let coilCooling = 0
    let oaLoad = 0
    let wetCoil = false
    let wheelFrac = 0
    let wheelStatus: ZoneHourPoint['wheelStatus'] = '—'
    let tAfterWheel = r.temp_C
    let wAfterWheel = wOut
    let coilInletT: number
    let coilInletDew: number
    let supplyW = 0
    let supplyRH = 0

    if (recirc) {
      // Recirculating AHU: the cooling coil removes the zone gains plus the
      // outdoor-air sensible burden; supply flow modulates, so no CBU reheat.
      oaLoad = oaCap * dT
      const net = sensible + oaLoad
      coilCooling = net > 0 ? -net : 0
      // Coil sees a mix of recirculated room air and fresh air.
      const wMix = recircFrac * wRoom + (1 - recircFrac) * wOut
      wAfterWheel = wMix
      coilInletT = recircFrac * tRoom + (1 - recircFrac) * r.temp_C
      coilInletDew = dewPoint(wMix, pAtm)
      wetCoil = coilInletDew > tSupply
      supplyW = Math.min(wMix, wSatSupply)
    } else {
      // 100 % OA: fresh air delivered at the set-point; CBU-El makes up the
      // balance (heating only). Optional wheel recovers on the OA path.
      reheat = Math.max(-(sensible + ventCooling), 0)
      // Wheel control: OFF when it would push the air away from the set-point
      // (room and set-point on opposite sides of the outdoor temperature);
      // MODULATING when full recovery plus fan heat would overshoot the
      // set-point in heating; otherwise fully ON.
      if (wheel) {
        const fullRecovery = etaT * wheelReturnRatio * (tRoom - r.temp_C)
        if ((tRoom - r.temp_C) * (tSupply - r.temp_C) <= 0) {
          wheelStatus = 'OFF'
        } else if (
          tSupply > r.temp_C &&
          r.temp_C + fullRecovery + fanDeltaT > tSupply
        ) {
          wheelStatus = 'MODULATING'
          wheelFrac =
            fullRecovery !== 0
              ? Math.max(0, (tSupply - fanDeltaT - r.temp_C) / fullRecovery)
              : 0
        } else {
          wheelStatus = 'ON'
          wheelFrac = 1
        }
      }
      tAfterWheel =
        r.temp_C + etaT * wheelReturnRatio * wheelFrac * (tRoom - r.temp_C)
      wAfterWheel = wOut + etaW * wheelReturnRatio * wheelFrac * (wRoom - wOut)
      coilInletT = tAfterWheel + fanDeltaT
      coilInletDew = dewPoint(wAfterWheel, pAtm)
      // A wet coil leaves the air saturated at the set-point.
      const coolingOn = coilInletT > tSupply + 0.001
      wetCoil = coolingOn && coilInletDew > tSupply
      supplyW = coolingOn ? Math.min(wAfterWheel, wSatSupply) : wAfterWheel
    }

    supplyRH =
      (partialPressure(supplyW, pAtm) /
        (610.94 * Math.exp((17.625 * tSupply) / (tSupply + 243.04)))) *
      100

    // Terminal cooling — the mirror of reheat: when the room balance is a net
    // gain (ventilation under-cools), an FCU makes up the cooling. CBU = 0.
    const balance = sensible + (recirc ? 0 : ventCooling)
    const terminalCooling = isFcu ? -Math.max(balance, 0) : 0

    // AHU coil duty — conditioning the fresh air to the supply set-point.
    // Recirc: the coil holds the room (zone gains + OA load). 100 % OA: the
    // coil takes the (wheel-treated) fresh air from its inlet to the set-point.
    let ahuCool = 0 // magnitude (≥0), → Chiller
    let ahuCoolLatent = 0 // magnitude (≥0), part of ahuCool
    let ahuHeat = 0 // magnitude (≥0), → AHU heat source
    if (recirc) {
      const net = sensible + oaLoad
      ahuCool = Math.max(net, 0)
      ahuHeat = Math.max(-net, 0)
    } else {
      const d = coilInletT - tSupply
      if (d > 0.001) {
        // Cooling coil — total duty from the moist-air enthalpy drop (sensible
        // + condensation); the sensible part uses the moist-air heat capacity.
        ahuCool =
          mAir *
          (enthalpy(coilInletT, wAfterWheel) - enthalpy(tSupply, supplyW))
        const coolSensible = mAir * (1.006 + 1.86 * wAfterWheel) * d
        ahuCoolLatent = ahuCool - coolSensible
      } else if (d < -0.001) {
        ahuHeat = -d * oaCap
      }
    }
    // Overcooling & reheat — the terminal heats while the zone has no net heat
    // loss or the AHU cooling coil is on: the supply air brings cooling the
    // room does not need. Energy = the ventilation part of the reheat.
    const coilCoolingOn = !recirc && coilInletT > tSupply + 0.001
    const overcooling = reheat > 0.001 && (sensible >= 0 || coilCoolingOn)
    const overcoolReheat = overcooling
      ? Math.min(reheat, Math.max(-ventCooling, 0))
      : 0
    // Wheel heat transfer — enthalpy change of the fresh air across the wheel.
    const wheelRecovery =
      wheelFrac > 0
        ? mAir * (enthalpy(tAfterWheel, wAfterWheel) - hOut)
        : 0

    const termCoolMag = -terminalCooling
    const chillerMag = ahuCool + termCoolMag
    const elecHeatMag =
      (ahu.heatSource === 'Electricity' ? ahuHeat : 0) +
      (air.terminalHeatSource === 'Electricity' ? reheat : 0)

    sumS += sensible
    sumR += reheat
    sumVent += recirc ? 0 : ventCooling
    sumCoil += coilCooling
    sumOaLoad += oaLoad
    sumTerm += terminalCooling
    sumAhuCool += ahuCool
    sumAhuCoolLatent += ahuCoolLatent
    sumAhuHeat += ahuHeat
    sumTermCoolMag += termCoolMag
    sumOvercool += overcoolReheat
    if (overcooling) overcoolHours += 1
    sumLighting += lighting
    // Heating vs pre-cooling by the sign of the enthalpy change. Sensible part
    // on the same basis as the coil heating (ρ·cp); latent = the remainder.
    const wheelSensible = oaCap * (tAfterWheel - r.temp_C)
    if (wheelRecovery > 0) {
      sumWheelHeat += wheelRecovery
      sumWheelHeatSensible += wheelSensible
    } else {
      sumWheelCool -= wheelRecovery
      sumWheelCoolSensible -= wheelSensible
    }
    if (chillerMag > peakChillerMag) peakChillerMag = chillerMag
    if (elecHeatMag > peakElecMag) peakElecMag = elecHeatMag
    if (sensible > peakS) {
      peakS = sensible
      peakTime = r.time
    }
    if (sensible < minS) minS = sensible
    if (reheat > peakR) peakR = reheat
    if (coilCooling < peakCoil) peakCoil = coilCooling
    if (terminalCooling < peakTerm) peakTerm = terminalCooling
    if (reheat > 0.001) reheatHours += 1
    if (wheelFrac > 0) wheelOnHours += 1
    if (wetCoil) wetCoilHours += 1

    hourly.push({
      time: r.time,
      tOut_C: r.temp_C,
      rhOut_pct: r.rh_pct,
      wOut,
      hOut_kJkg: hOut,
      solarMean_Wm2: r.solarMean_Wm2,
      transWin_kW: transWin,
      solar_kW: solar,
      transBulk_kW: transBulk,
      occupancyFraction: occFrac,
      persons_kW: persons,
      equip_kW: averages.equip_kW,
      lightingFraction: litFrac,
      lighting_kW: lighting,
      perRoom_kW: perRoom,
      sensible_kW: sensible,
      wheelStatus,
      wheelFraction: wheelFrac,
      tAfterWheel_C: tAfterWheel,
      wAfterWheel,
      coilInletT_C: coilInletT,
      coilInletDew_C: coilInletDew,
      condensation: wetCoil,
      supplyW,
      supplyRH_pct: supplyRH,
      supplySetpoint_C: tSupply,
      ventCooling_kW: recirc ? 0 : ventCooling,
      oaLoad_kW: oaLoad,
      coilCooling_kW: coilCooling,
      reheat_kW: reheat,
      overcooling,
      overcoolReheat_kW: overcoolReheat,
      wheelRecovery_kW: wheelRecovery,
      terminalCooling_kW: terminalCooling,
      ahuCool_kW: -ahuCool,
      ahuCoolLatent_kW: -ahuCoolLatent,
      ahuHeat_kW: ahuHeat,
      terminalFanPlr: 0, // filled below, once the design capacity is known
      terminalFan_kW: 0,
      mode: modeLabel,
    })
  }

  // Terminal fan — sized on this simulation: Q_design = oversizing × the
  // larger of the design-percentile terminal heating and cooling.
  const qDesign =
    design.terminalFanOversizing *
    Math.max(
      percentile(
        hourly.map((h) => h.reheat_kW),
        design.terminalFanPercentile,
      ),
      percentile(
        hourly.map((h) => -h.terminalCooling_kW),
        design.terminalFanPercentile,
      ),
    )
  const fanDesign_kW =
    air.terminalFan === 'none' ? 0 : (qDesign * air.terminalFan_WperkW) / 1000
  let sumTermFan = 0
  for (const h of hourly) {
    h.terminalFanPlr =
      qDesign > 0
        ? Math.min(1, (h.reheat_kW - h.terminalCooling_kW) / qDesign)
        : 0
    h.terminalFan_kW =
      air.terminalFan === 'onoff' ? fanDesign_kW * h.terminalFanPlr : fanDesign_kW
    sumTermFan += h.terminalFan_kW
  }

  const n = rows.length || 1
  const rnd = (x: number, dp = 2) => {
    const f = 10 ** dp
    return Math.round(x * f) / f
  }

  // Attribute the constant per-zone heating sources to buckets.
  const heatBySource: Record<HeatSource, number> = {
    'Waste heat': 0,
    'Heat pump': 0,
    Electricity: 0,
  }
  heatBySource[air.terminalHeatSource] += sumR // terminal reheat
  heatBySource[ahu.heatSource] += sumAhuHeat // AHU preheat
  for (const k of Object.keys(heatBySource) as HeatSource[]) {
    heatBySource[k] = rnd(heatBySource[k], 1)
  }

  const coolBySource: Record<CoolingSource, number> = { Chiller: 0 }
  coolBySource[ahu.coolSource] += -sumAhuCool // AHU coil cooling
  coolBySource[air.terminalCoolSource] += -sumTermCoolMag // FCU cooling
  for (const k of Object.keys(coolBySource) as CoolingSource[]) {
    coolBySource[k] = rnd(coolBySource[k], 1)
  }

  return {
    hourly,
    summary: {
      zoneUid: zone.uid,
      zoneId: zone.id,
      mode: oaMode,
      hours: rows.length,
      freshFlow_m3h: rnd(freshFlow, 1),
      roomSetpoint_C: tRoom,
      peakSensible_kW: rnd(peakS),
      minSensible_kW: rnd(minS),
      meanSensible_kW: rnd(sumS / n),
      ventCooling_kW: recirc ? 0 : rnd(sumVent / n),
      peakReheat_kW: rnd(peakR),
      meanReheat_kW: rnd(sumR / n),
      reheatHours,
      reheatEnergy_kWh: rnd(sumR, 1),
      terminalHeatElectric_kWh:
        air.terminalHeatSource === 'Electricity' ? rnd(sumR, 1) : 0,
      terminalHeatWater_kWh:
        air.terminalHeatSource === 'Electricity' ? 0 : rnd(sumR, 1),
      lightingHeat_kWh: rnd(sumLighting * count, 1),
      terminalDesignCapacity_kW: rnd(qDesign),
      terminalFanDesign_kW: rnd(fanDesign_kW, 3),
      terminalFanEnergy_kWh: rnd(sumTermFan, 1),
      overcoolReheat_kWh: rnd(sumOvercool, 1),
      overcoolHours,
      wheelHeating_kWh: rnd(sumWheelHeat, 1),
      wheelHeatingSensible_kWh: rnd(sumWheelHeatSensible, 1),
      wheelHeatingLatent_kWh: rnd(sumWheelHeat - sumWheelHeatSensible, 1),
      wheelPrecooling_kWh: rnd(sumWheelCool, 1),
      wheelPrecoolingSensible_kWh: rnd(sumWheelCoolSensible, 1),
      wheelPrecoolingLatent_kWh: rnd(sumWheelCool - sumWheelCoolSensible, 1),
      ventEnergy_kWh: recirc ? 0 : rnd(sumVent, 1),
      oaLoadMean_kW: rnd(sumOaLoad / n),
      peakCoilCooling_kW: rnd(peakCoil),
      coilCoolingEnergy_kWh: rnd(sumCoil, 1),
      peakTerminalCooling_kW: rnd(peakTerm),
      terminalCoolingEnergy_kWh: rnd(sumTerm, 1),
      ahuCoolEnergy_kWh: rnd(-sumAhuCool, 1),
      ahuCoolLatentEnergy_kWh: rnd(-sumAhuCoolLatent, 1),
      ahuHeatEnergy_kWh: rnd(sumAhuHeat, 1),
      chillerCoolingEnergy_kWh: rnd(-(sumAhuCool + sumTermCoolMag), 1),
      peakChiller_kW: rnd(-peakChillerMag),
      coolBySource_kWh: coolBySource,
      heatBySource_kWh: heatBySource,
      electricalHeating_kWh: heatBySource.Electricity,
      peakElectricalHeat_kW: rnd(peakElecMag),
      sensibleEnergy_kWh: rnd(sumS, 1),
      wheelOnHours,
      wetCoilHours,
      peakSensibleTime: peakTime,
    },
  }
}

/** Build a CSV string of the full hourly detail (all workbook columns). */
export function hourlyToCsv(hourly: ZoneHourPoint[]): string {
  const header = [
    'time',
    'T_out_C',
    'RH_out_pct',
    'W_out_kgkg',
    'h_out_kJkg',
    'solar_mean_Wm2',
    'trans_window_kW',
    'solar_kW',
    'trans_bulkhead_kW',
    'occupancy_fraction',
    'persons_kW',
    'equipment_kW',
    'lighting_fraction',
    'lighting_kW',
    'per_room_kW',
    'zone_sensible_kW',
    'wheel_status',
    'wheel_fraction',
    'T_after_wheel_C',
    'W_after_wheel_kgkg',
    'coil_inlet_T_C',
    'coil_inlet_dew_C',
    'condensation',
    'supply_setpoint_C',
    'supply_W_kgkg',
    'supply_RH_pct',
    'vent_cooling_kW',
    'oa_load_kW',
    'coil_cooling_kW',
    'reheat_kW',
    'overcool_reheat_kW',
    'wheel_recovery_kW',
    'terminal_cooling_kW',
    'ahu_cool_kW',
    'ahu_cool_latent_kW',
    'ahu_heat_kW',
    'terminal_fan_plr',
    'terminal_fan_kW',
    'mode',
  ]
  const g = (n: number, dp = 3) => (Number.isFinite(n) ? n.toFixed(dp) : '')
  const lines = hourly.map((h) =>
    [
      h.time,
      g(h.tOut_C, 1),
      g(h.rhOut_pct, 0),
      g(h.wOut, 5),
      g(h.hOut_kJkg, 2),
      g(h.solarMean_Wm2, 1),
      g(h.transWin_kW),
      g(h.solar_kW),
      g(h.transBulk_kW),
      g(h.occupancyFraction, 2),
      g(h.persons_kW),
      g(h.equip_kW),
      g(h.lightingFraction, 2),
      g(h.lighting_kW),
      g(h.perRoom_kW),
      g(h.sensible_kW),
      h.wheelStatus,
      g(h.wheelFraction),
      g(h.tAfterWheel_C, 2),
      g(h.wAfterWheel, 5),
      g(h.coilInletT_C, 2),
      g(h.coilInletDew_C, 2),
      h.condensation ? 'Yes' : 'No',
      g(h.supplySetpoint_C, 2),
      g(h.supplyW, 5),
      g(h.supplyRH_pct, 1),
      g(h.ventCooling_kW),
      g(h.oaLoad_kW),
      g(h.coilCooling_kW),
      g(h.reheat_kW),
      g(h.overcoolReheat_kW),
      g(h.wheelRecovery_kW),
      g(h.terminalCooling_kW),
      g(h.ahuCool_kW),
      g(h.ahuCoolLatent_kW),
      g(h.ahuHeat_kW),
      g(h.terminalFanPlr),
      g(h.terminalFan_kW),
      h.mode,
    ].join(','),
  )
  return [header.join(','), ...lines].join('\n')
}

/** One equipment row (an AHU or a terminal type) split by source. */
export interface EquipmentRow {
  key: string
  name: string
  kind: 'ahu' | 'terminal'
  coolBySource_kWh: Record<CoolingSource, number>
  heatBySource_kWh: Record<HeatSource, number>
}

/** Per-AHU results: coil energy, wheel recovery, and fan power & electricity
 *  (SFP or pressure-drop method, constant airflow). */
export interface AhuRow {
  key: string
  name: string
  /** AHU supply airflow = sum of the fresh air of its room groups (m³/h). */
  airflow_m3h: number
  /** Coil heating over the period (kWh, positive). */
  heating_kWh: number
  /** Coil cooling over the period, total incl. latent (kWh, positive). */
  cooling_kWh: number
  /** Wheel heat recovered in heating (kWh, positive). */
  wheelHeating_kWh: number
  /** Sensible and latent parts of the wheel heating (kWh, positive). */
  wheelHeatingSensible_kWh: number
  wheelHeatingLatent_kWh: number
  /** Wheel heat removed in pre-cooling (kWh, positive). */
  wheelPrecooling_kWh: number
  /** Sensible and latent parts of the wheel pre-cooling (kWh, positive). */
  wheelPrecoolingSensible_kWh: number
  wheelPrecoolingLatent_kWh: number
  supplyPower_kW: number
  extractPower_kW: number
  totalPower_kW: number
  /** Fan electricity over the period (kWh). */
  energy_kWh: number
}

/** Project energy for one calendar month (kWh, all positive magnitudes). */
export interface MonthlyRow {
  /** Year-month key, e.g. "2025-07". */
  key: string
  hours: number
  /** Mean outdoor (ambient) temperature of the month (°C). */
  outdoorTemp_C: number
  electricHeating_kWh: number
  fanElectricity_kWh: number
  terminalFanElectricity_kWh: number
  chillerElectricity_kWh: number
  ahuHeating_kWh: number
  terminalHeating_kWh: number
  /** Part of the terminal heating caused by overcooling. */
  overcoolReheat_kWh: number
  ahuCooling_kWh: number
  terminalCooling_kWh: number
}

export interface ProjectLoadResult {
  weather: string
  hours: number
  zones: ZoneLoadSummary[]
  /** Project energy by calendar month, in dataset order. */
  monthly: MonthlyRow[]
  /** Energy re-sliced by equipment (AHUs then terminal types). */
  equipment: EquipmentRow[]
  /** Coil energy, wheel recovery and fans per AHU (unassigned groups last). */
  ahuRows: AhuRow[]
  totals: {
    peakSensible_kW: number
    meanSensible_kW: number
    ventCooling_kW: number
    peakReheat_kW: number
    peakCoilCooling_kW: number
    peakTerminalCooling_kW: number
    sensibleEnergy_kWh: number
    reheatEnergy_kWh: number
    ventEnergy_kWh: number
    coilCoolingEnergy_kWh: number
    terminalCoolingEnergy_kWh: number
    ahuHeatEnergy_kWh: number
    ahuCoolEnergy_kWh: number
    ahuCoolLatentEnergy_kWh: number
    terminalHeatElectric_kWh: number
    terminalHeatWater_kWh: number
    lightingHeat_kWh: number
    /** Terminal fan design power of all room groups (kW). */
    terminalFanDesign_kW: number
    /** Terminal fan electricity over the period (kWh). */
    terminalFanEnergy_kWh: number
    overcoolReheat_kWh: number
    wheelHeating_kWh: number
    wheelHeatingSensible_kWh: number
    wheelHeatingLatent_kWh: number
    wheelPrecooling_kWh: number
    wheelPrecoolingSensible_kWh: number
    wheelPrecoolingLatent_kWh: number
    /** Electric heating + chiller + AHU fan + terminal fan electricity (kWh). */
    totalElectricity_kWh: number
    /** Design fresh-air flow of all room groups (m³/h). */
    freshAir_m3h: number
    /** Hours when at least one room group is in overcooling & reheat. */
    overcoolHours: number
    chillerCoolingEnergy_kWh: number
    peakChiller_kW: number
    /** Chiller electricity = chiller cooling ÷ fixed COP (kWh, positive). */
    chillerElectricity_kWh: number
    peakChillerElectric_kW: number
    /** AHU fan power (kW) and electricity over the period (kWh). */
    fanPower_kW: number
    fanElectricity_kWh: number
    coolBySource_kWh: Record<CoolingSource, number>
    heatBySource_kWh: Record<HeatSource, number>
    electricalHeating_kWh: number
    peakElectricalHeat_kW: number
  }
}

/** Compute load summaries for every zone plus project totals. */
export function computeProjectLoad(
  zones: Zone[],
  getZoneAir: (uid: string) => ZoneAirConfig,
  getAhuParams: (ahuId: string) => AhuParams,
  getRoomSetpoint: (uid: string) => number,
  getRoomHumidity: (uid: string) => number,
  design: DesignParams,
  ahus: Ahu[] = [],
  rows: WeatherHour[] = [],
  weather = '',
): ProjectLoadResult {

  const rnd = (x: number, dp = 1) => {
    const f = 10 ** dp
    return Math.round(x * f) / f
  }
  const roundRecord = <K extends string>(r: Record<K, number>) => {
    for (const k of Object.keys(r) as K[]) r[k] = rnd(r[k])
    return r
  }
  const emptyCool = (): Record<CoolingSource, number> => ({ Chiller: 0 })
  const emptyHeat = (): Record<HeatSource, number> => ({
    'Waste heat': 0,
    'Heat pump': 0,
    Electricity: 0,
  })

  // AHUs are shared equipment (aggregate by unit); terminals are zone-specific
  // (one row per zone). Both slice the same energy as the project totals.
  const ahuBucket = new Map<
    string,
    {
      name: string
      cool: Record<CoolingSource, number>
      heat: Record<HeatSource, number>
      params: AhuParams
      airflow_m3h: number
      wheelHeating_kWh: number
      wheelHeatingSensible_kWh: number
      wheelHeatingLatent_kWh: number
      wheelPrecooling_kWh: number
      wheelPrecoolingSensible_kWh: number
      wheelPrecoolingLatent_kWh: number
    }
  >()
  const terminalRows: EquipmentRow[] = []
  // Hours when at least one room group is in overcooling & reheat.
  const anyOvercooling: boolean[] = new Array(rows.length).fill(false)

  // Monthly buckets, keyed by the year-month of each weather hour.
  const monthly: MonthlyRow[] = []
  const monthOfHour: number[] = []
  const chillerCoolingByMonth: number[] = []
  for (const r of rows) {
    const key = r.time.slice(0, 7)
    if (monthly.length === 0 || monthly[monthly.length - 1].key !== key) {
      monthly.push({
        key,
        hours: 0,
        outdoorTemp_C: 0, // summed here, averaged below
        electricHeating_kWh: 0,
        fanElectricity_kWh: 0,
        terminalFanElectricity_kWh: 0,
        chillerElectricity_kWh: 0,
        ahuHeating_kWh: 0,
        terminalHeating_kWh: 0,
        overcoolReheat_kWh: 0,
        ahuCooling_kWh: 0,
        terminalCooling_kWh: 0,
      })
      chillerCoolingByMonth.push(0)
    }
    monthly[monthly.length - 1].hours += 1
    monthly[monthly.length - 1].outdoorTemp_C += r.temp_C
    monthOfHour.push(monthly.length - 1)
  }

  const summaries = zones.map((z) => {
    const air = getZoneAir(z.uid)
    const ahu = getAhuParams(air.ahuId ?? '')
    const zoneLoad = computeZoneLoad(
      z,
      air,
      ahu,
      design,
      getRoomSetpoint(z.uid),
      getRoomHumidity(z.uid),
      rows,
    )
    const s = zoneLoad.summary
    const ahuHeatElectric = ahu.heatSource === 'Electricity'
    const terminalHeatElectric = air.terminalHeatSource === 'Electricity'
    zoneLoad.hourly.forEach((h, i) => {
      if (h.overcooling) anyOvercooling[i] = true
      const mi = monthOfHour[i]
      const m = monthly[mi]
      m.ahuHeating_kWh += h.ahuHeat_kW
      m.terminalHeating_kWh += h.reheat_kW
      m.overcoolReheat_kWh += h.overcoolReheat_kW
      m.ahuCooling_kWh -= h.ahuCool_kW
      m.terminalCooling_kWh -= h.terminalCooling_kW
      m.terminalFanElectricity_kWh += h.terminalFan_kW
      m.electricHeating_kWh +=
        (ahuHeatElectric ? h.ahuHeat_kW : 0) +
        (terminalHeatElectric ? h.reheat_kW : 0)
      chillerCoolingByMonth[mi] -= h.ahuCool_kW + h.terminalCooling_kW
    })

    // AHU bucket — coil cooling → cool source, preheat → heat source.
    const ahuKey = air.ahuId ?? '__none__'
    if (!ahuBucket.has(ahuKey)) {
      const name =
        ahus.find((a) => a.id === air.ahuId)?.name ?? '— unassigned —'
      ahuBucket.set(ahuKey, {
        name,
        cool: emptyCool(),
        heat: emptyHeat(),
        params: ahu,
        airflow_m3h: 0,
        wheelHeating_kWh: 0,
        wheelHeatingSensible_kWh: 0,
        wheelHeatingLatent_kWh: 0,
        wheelPrecooling_kWh: 0,
        wheelPrecoolingSensible_kWh: 0,
        wheelPrecoolingLatent_kWh: 0,
      })
    }
    const ab = ahuBucket.get(ahuKey)!
    ab.airflow_m3h += s.freshFlow_m3h
    ab.cool[ahu.coolSource] += s.ahuCoolEnergy_kWh
    ab.heat[ahu.heatSource] += s.ahuHeatEnergy_kWh
    ab.wheelHeating_kWh += s.wheelHeating_kWh
    ab.wheelHeatingSensible_kWh += s.wheelHeatingSensible_kWh
    ab.wheelHeatingLatent_kWh += s.wheelHeatingLatent_kWh
    ab.wheelPrecooling_kWh += s.wheelPrecooling_kWh
    ab.wheelPrecoolingSensible_kWh += s.wheelPrecoolingSensible_kWh
    ab.wheelPrecoolingLatent_kWh += s.wheelPrecoolingLatent_kWh

    // Terminal — one row per zone (reheat → heat source, FCU cooling → cool).
    const tc = emptyCool()
    tc[air.terminalCoolSource] += s.terminalCoolingEnergy_kWh
    const th = emptyHeat()
    th[air.terminalHeatSource] += s.reheatEnergy_kWh
    terminalRows.push({
      key: `term:${z.uid}`,
      name: `${z.id} · ${air.terminalUnit}`,
      kind: 'terminal',
      coolBySource_kWh: roundRecord(tc),
      heatBySource_kWh: roundRecord(th),
    })

    return s
  })

  // AHU rows in the ahus list order (unassigned last), then per-zone terminals.
  const equipment: EquipmentRow[] = []
  const ahuOrder = [...ahus.map((a) => a.id), '__none__']
  for (const key of ahuOrder) {
    const b = ahuBucket.get(key)
    if (!b) continue
    equipment.push({
      key: `ahu:${key}`,
      name: b.name,
      kind: 'ahu',
      coolBySource_kWh: roundRecord(b.cool),
      heatBySource_kWh: roundRecord(b.heat),
    })
  }
  equipment.push(...terminalRows)

  // Per-AHU results. Fans run at constant airflow over every hour of the
  // dataset; room groups without an AHU have no fan.
  const sumValues = (r: Record<string, number>) =>
    Object.values(r).reduce((a, v) => a + v, 0)
  const ahuRows: AhuRow[] = []
  let fanPower_kW = 0
  let fanElectricity_kWh = 0
  for (const key of ahuOrder) {
    const b = ahuBucket.get(key)
    if (!b) continue
    const p =
      key === '__none__'
        ? { supply_kW: 0, extract_kW: 0, total_kW: 0 }
        : fanPower(b.airflow_m3h, b.params)
    const energy = p.total_kW * rows.length
    fanPower_kW += p.total_kW
    fanElectricity_kWh += energy
    ahuRows.push({
      key: `ahu:${key}`,
      name: b.name,
      airflow_m3h: rnd(b.airflow_m3h),
      heating_kWh: rnd(sumValues(b.heat)),
      cooling_kWh: rnd(-sumValues(b.cool)),
      wheelHeating_kWh: rnd(b.wheelHeating_kWh),
      wheelHeatingSensible_kWh: rnd(b.wheelHeatingSensible_kWh),
      wheelHeatingLatent_kWh: rnd(b.wheelHeatingLatent_kWh),
      wheelPrecooling_kWh: rnd(b.wheelPrecooling_kWh),
      wheelPrecoolingSensible_kWh: rnd(b.wheelPrecoolingSensible_kWh),
      wheelPrecoolingLatent_kWh: rnd(b.wheelPrecoolingLatent_kWh),
      supplyPower_kW: rnd(p.supply_kW, 2),
      extractPower_kW: rnd(p.extract_kW, 2),
      totalPower_kW: rnd(p.total_kW, 2),
      energy_kWh: rnd(energy),
    })
  }

  const num = {
    peakSensible_kW: 0,
    meanSensible_kW: 0,
    ventCooling_kW: 0,
    peakReheat_kW: 0,
    peakCoilCooling_kW: 0,
    peakTerminalCooling_kW: 0,
    sensibleEnergy_kWh: 0,
    reheatEnergy_kWh: 0,
    ventEnergy_kWh: 0,
    coilCoolingEnergy_kWh: 0,
    terminalCoolingEnergy_kWh: 0,
    ahuHeatEnergy_kWh: 0,
    ahuCoolEnergy_kWh: 0,
    ahuCoolLatentEnergy_kWh: 0,
    terminalHeatElectric_kWh: 0,
    terminalHeatWater_kWh: 0,
    lightingHeat_kWh: 0,
    terminalFanEnergy_kWh: 0,
    overcoolReheat_kWh: 0,
    wheelHeating_kWh: 0,
    wheelHeatingSensible_kWh: 0,
    wheelHeatingLatent_kWh: 0,
    wheelPrecooling_kWh: 0,
    wheelPrecoolingSensible_kWh: 0,
    wheelPrecoolingLatent_kWh: 0,
    chillerCoolingEnergy_kWh: 0,
    peakChiller_kW: 0,
    electricalHeating_kWh: 0,
    peakElectricalHeat_kW: 0,
  }
  const heatBySource_kWh: Record<HeatSource, number> = {
    'Waste heat': 0,
    'Heat pump': 0,
    Electricity: 0,
  }
  const coolBySource_kWh: Record<CoolingSource, number> = { Chiller: 0 }
  for (const s of summaries) {
    for (const k of Object.keys(num) as (keyof typeof num)[]) {
      num[k] += s[k]
    }
    for (const src of Object.keys(heatBySource_kWh) as HeatSource[]) {
      heatBySource_kWh[src] += s.heatBySource_kWh[src]
    }
    for (const src of Object.keys(coolBySource_kWh) as CoolingSource[]) {
      coolBySource_kWh[src] += s.coolBySource_kWh[src]
    }
  }
  for (const k of Object.keys(num) as (keyof typeof num)[]) num[k] = rnd(num[k])
  for (const src of Object.keys(heatBySource_kWh) as HeatSource[])
    heatBySource_kWh[src] = rnd(heatBySource_kWh[src])
  for (const src of Object.keys(coolBySource_kWh) as CoolingSource[])
    coolBySource_kWh[src] = rnd(coolBySource_kWh[src])
  // Chiller electricity — fixed COP on the chiller cooling load.
  const cop = design.chillerCOP > 0 ? design.chillerCOP : 0
  const chillerElectricity_kWh = cop
    ? rnd(-num.chillerCoolingEnergy_kWh / cop)
    : 0
  monthly.forEach((m, i) => {
    m.outdoorTemp_C = m.hours > 0 ? m.outdoorTemp_C / m.hours : 0
    m.fanElectricity_kWh = fanPower_kW * m.hours
    m.chillerElectricity_kWh = cop ? chillerCoolingByMonth[i] / cop : 0
    for (const k of Object.keys(m) as (keyof MonthlyRow)[]) {
      if (k !== 'key' && k !== 'hours') m[k] = rnd(m[k])
    }
  })
  const totals = {
    ...num,
    chillerElectricity_kWh,
    freshAir_m3h: rnd(summaries.reduce((sum, s) => sum + s.freshFlow_m3h, 0)),
    overcoolHours: anyOvercooling.filter(Boolean).length,
    totalElectricity_kWh: rnd(
      num.electricalHeating_kWh +
        chillerElectricity_kWh +
        fanElectricity_kWh +
        num.terminalFanEnergy_kWh,
    ),
    peakChillerElectric_kW: cop ? rnd(-num.peakChiller_kW / cop) : 0,
    fanPower_kW: rnd(fanPower_kW, 2),
    fanElectricity_kWh: rnd(fanElectricity_kWh),
    terminalFanDesign_kW: rnd(
      summaries.reduce((sum, z) => sum + z.terminalFanDesign_kW, 0),
      2,
    ),
    heatBySource_kWh,
    coolBySource_kWh,
  }

  return {
    weather,
    hours: rows.length,
    zones: summaries,
    monthly,
    equipment,
    ahuRows,
    totals,
  }
}
