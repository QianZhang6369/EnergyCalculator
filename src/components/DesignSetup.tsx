import NumberField from './NumberField';
import {
  COOLING_SOURCES,
  HEAT_SOURCES,
  freshAirBreakdown,
  zoneAirOf,
  type AirSetup,
  type CoolingSource,
  type HeatSource,
} from '../lib/airSystems';
import {
  DEFAULT_ROOM_HUMIDITY_PCT,
  DEFAULT_ROOM_SETPOINT_C,
  FAN_METHODS,
  ahuParamsOf,
  fanPower,
  fanSfpUsed,
  type AhuParams,
  type DesignParams,
  type FanMethod,
  type HvacDesign,
} from '../lib/hvacDesign';
import { WINDOW_TYPES, type Zone } from '../lib/zones';

interface Props {
  zones: Zone[];
  air: AirSetup;
  design: HvacDesign;
  /** Takes an updater so quick successive edits cannot clobber each other. */
  onChange: (update: (design: HvacDesign) => HvacDesign) => void;
}

/** A numeric AHU parameter shown as one table column. */
interface AhuColumn {
  key: keyof AhuParams;
  head: string;
  /** Used in the input's accessible name, after the AHU name. */
  name: string;
  step: number;
  min?: number;
  disabled?: (p: AhuParams) => boolean;
}

const SUPPLY_COLUMNS: AhuColumn[] = [
  { key: 'winterSetpoint_C', head: 'Winter supply °C', name: 'winter set-point', step: 0.5, min: -50 },
  { key: 'summerSetpoint_C', head: 'Summer supply °C', name: 'summer set-point', step: 0.5, min: -50 },
  { key: 'rampOatLow_C', head: 'Ramp low OAT °C', name: 'ramp low OAT', step: 1, min: -50 },
  { key: 'rampOatHigh_C', head: 'Ramp high OAT °C', name: 'ramp high OAT', step: 1, min: -50 },
];

const noWheel = (p: AhuParams) => !p.hasWheel;

const WHEEL_COLUMNS: AhuColumn[] = [
  { key: 'wheelTempEff_pct', head: 'Temp. η %', name: 'wheel temperature efficiency', step: 1, disabled: noWheel },
  { key: 'wheelHumidityEff_pct', head: 'Humidity η %', name: 'wheel humidity efficiency', step: 1, disabled: noWheel },
  { key: 'wheelReturnRatio', head: 'Wheel return', name: 'wheel return ratio', step: 0.05, disabled: noWheel },
  { key: 'fanDeltaT_K', head: 'Fan ΔT K', name: 'fan delta T', step: 0.5 },
];

const byPressure = (p: AhuParams) => p.fanMethod === 'pressure';
const bySfp = (p: AhuParams) => p.fanMethod !== 'pressure';

const FAN_COLUMNS: AhuColumn[] = [
  { key: 'extractAirRatio', head: 'Extract air ratio', name: 'extract air ratio', step: 0.05 },
  { key: 'sfpSupply_kWm3s', head: 'SFP supply kW/(m³/s)', name: 'SFP supply fan', step: 0.1, disabled: byPressure },
  { key: 'sfpExtract_kWm3s', head: 'SFP extract kW/(m³/s)', name: 'SFP extract fan', step: 0.1, disabled: byPressure },
  { key: 'fanDpSupply_Pa', head: 'Δp supply Pa', name: 'supply fan pressure drop', step: 50, disabled: bySfp },
  { key: 'fanEffSupply', head: 'η supply', name: 'supply fan efficiency', step: 0.005, disabled: bySfp },
  { key: 'fanDpExtract_Pa', head: 'Δp extract Pa', name: 'extract fan pressure drop', step: 50, disabled: bySfp },
  { key: 'fanEffExtract', head: 'η extract', name: 'extract fan efficiency', step: 0.005, disabled: bySfp },
];

/** A numeric global parameter shown as one labelled field. */
const SCALARS: { key: keyof DesignParams; label: string; unit: string; step: number; min?: number }[] = [
  { key: 'pAtm_Pa', label: 'Barometric pressure', unit: 'Pa', step: 100, min: 1 },
  { key: 'bulkhead_U', label: 'U-value bulkhead', unit: 'W/m²·K', step: 0.05 },
  { key: 'refGTI_Wm2', label: 'Reference irradiance', unit: 'W/m²', step: 10, min: 1 },
  { key: 'heatPerPersonSensible_W', label: 'Sensible heat per person', unit: 'W/pers', step: 5 },
  { key: 'rhoCp', label: 'Air ρ·cp (sensible)', unit: 'kJ/m³·K', step: 0.05 },
  { key: 'airDensity_kgm3', label: 'Air density (enthalpy)', unit: 'kg/m³', step: 0.05 },
];

const fixed2 = (n: number) => n.toFixed(2);

/**
 * Step 3 — general design parameters: basic parameters, then the operating,
 * fan and chiller parameters of the air handling units.
 */
export default function DesignSetup({ zones, air, design, onChange }: Props) {
  const { params } = design;

  const setParams = (patch: Partial<DesignParams>) =>
    onChange((prev) => ({ ...prev, params: { ...prev.params, ...patch } }));

  const setAhu = (ahuId: string, patch: Partial<AhuParams>) =>
    onChange((prev) => ({
      ...prev,
      ahuParams: { ...prev.ahuParams, [ahuId]: { ...ahuParamsOf(prev, ahuId), ...patch } },
    }));

  const ahuCells = (ahuName: string, ahuId: string, p: AhuParams, columns: AhuColumn[]) =>
    columns.map((col) => (
      <td key={col.key}>
        <NumberField
          value={p[col.key] as number}
          step={col.step}
          min={col.min}
          disabled={col.disabled?.(p)}
          aria-label={`${ahuName} ${col.name}`}
          onChange={(v) => setAhu(ahuId, { [col.key]: v })}
        />
      </td>
    ));

  const heads = (columns: AhuColumn[]) =>
    columns.map((col) => (
      <th key={col.key} scope="col" className="zone-num">
        {col.head}
      </th>
    ));

  const noAhus = <p className="library-empty">No AHUs defined. Add AHUs in step 4 first.</p>;

  return (
    <>
      <section className="panel">
        <h3 className="panel-title">Basic parameters</h3>
        <p className="panel-text">
          Room conditions per room group, then the envelope and air properties used
          for every group.
        </p>

        <h4 className="library-group-title design-subtitle">Room set-point &amp; humidity</h4>
        {zones.length === 0 ? (
          <p className="library-empty">No room groups defined. Add them in step 1 first.</p>
        ) : (
          <div className="table-scroll">
            <table className="zone-table design-narrow">
              <thead>
                <tr>
                  <th scope="col">Room group</th>
                  <th scope="col" className="zone-num">Room °C</th>
                  <th scope="col" className="zone-num">Room RH %</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((zone) => (
                  <tr key={zone.uid}>
                    <th scope="row">
                      {zone.id}
                      {zone.description && <span className="zone-unit">{zone.description}</span>}
                    </th>
                    <td>
                      <NumberField
                        value={design.roomSetpoints[zone.uid] ?? DEFAULT_ROOM_SETPOINT_C}
                        step={0.5}
                        min={-50}
                        aria-label={`${zone.id} room set-point`}
                        onChange={(v) =>
                          onChange((prev) => ({
                            ...prev,
                            roomSetpoints: { ...prev.roomSetpoints, [zone.uid]: v },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <NumberField
                        value={design.roomHumidity[zone.uid] ?? DEFAULT_ROOM_HUMIDITY_PCT}
                        step={1}
                        aria-label={`${zone.id} room humidity`}
                        onChange={(v) =>
                          onChange((prev) => ({
                            ...prev,
                            roomHumidity: {
                              ...prev.roomHumidity,
                              [zone.uid]: Math.min(100, Math.max(0, v)),
                            },
                          }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="field-grid design-scalars">
          {SCALARS.map((s) => (
            <div className="field" key={s.key}>
              <span className="field-label">
                {s.label}
                <span className="field-unit">{s.unit}</span>
              </span>
              <NumberField
                value={params[s.key] as number}
                step={s.step}
                min={s.min}
                aria-label={s.label}
                // Pressure and reference irradiance are divisors, so never 0.
                onChange={(v) => setParams({ [s.key]: s.min ? v || s.min : v })}
              />
            </div>
          ))}
          <div className="field">
            <label className="field-label" htmlFor="design-occupancy">
              Occupancy
              <span className="field-unit">fresh-air method C</span>
            </label>
            <select
              id="design-occupancy"
              className="field-input"
              value={params.occupancyReduced ? 'reduced' : 'full'}
              onChange={(e) => setParams({ occupancyReduced: e.target.value === 'reduced' })}
            >
              <option value="full">Full</option>
              <option value="reduced">Reduced</option>
            </select>
          </div>
        </div>

        <h4 className="library-group-title design-subtitle">Window type</h4>
        <div className="table-scroll">
          <table className="zone-table design-narrow">
            <thead>
              <tr>
                <th scope="col">Window type</th>
                <th scope="col" className="zone-num">U-value W/m²·K</th>
                <th scope="col" className="zone-num">Radiation W/m²</th>
                <th scope="col" className="zone-num">g-value</th>
              </tr>
            </thead>
            <tbody>
              {WINDOW_TYPES.map((wt) => {
                const props = params.windows[wt];
                const setWindow = (patch: Partial<typeof props>) =>
                  setParams({ windows: { ...params.windows, [wt]: { ...props, ...patch } } });
                return (
                  <tr key={wt}>
                    <th scope="row">{wt}</th>
                    <td>
                      <NumberField
                        value={props.u_value}
                        step={0.1}
                        aria-label={`${wt} U-value`}
                        onChange={(v) => setWindow({ u_value: v })}
                      />
                    </td>
                    <td>
                      <NumberField
                        value={props.radiation}
                        step={10}
                        aria-label={`${wt} radiation`}
                        onChange={(v) => setWindow({ radiation: v })}
                      />
                    </td>
                    <td className="zone-num design-derived">
                      {(props.radiation / (params.refGTI_Wm2 || 800)).toFixed(3)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="design-note">g-value = radiation ÷ reference irradiance (above).</p>
      </section>

      <section className="panel">
        <h3 className="panel-title">AHU general parameters</h3>
        <p className="panel-text">
          Supply set-point ramps linearly from the winter (cold) value at the ramp-low
          outdoor temperature to the summer (warm) value at the ramp-high outdoor
          temperature.
        </p>
        {air.ahus.length === 0 ? (
          noAhus
        ) : (
          <div className="table-scroll design-table-scroll">
            <table className="zone-table design-table">
              <thead>
                <tr>
                  <th scope="col">AHU</th>
                  <th scope="col" className="zone-num">Recirc. air %</th>
                  {heads(SUPPLY_COLUMNS)}
                  <th scope="col">Heat recovery wheel</th>
                  {heads(WHEEL_COLUMNS)}
                  <th scope="col">Heat source</th>
                  <th scope="col">Cool source</th>
                </tr>
              </thead>
              <tbody>
                {air.ahus.map((ahu) => {
                  const p = ahuParamsOf(design, ahu.id);
                  return (
                    <tr key={ahu.id}>
                      <th scope="row">{ahu.name}</th>
                      <td>
                        <NumberField
                          value={p.recircAir_pct}
                          step={100}
                          aria-label={`${ahu.name} recirculation air`}
                          // Recirculation is all or nothing.
                          onChange={(v) => setAhu(ahu.id, { recircAir_pct: v >= 50 ? 100 : 0 })}
                        />
                      </td>
                      {ahuCells(ahu.name, ahu.id, p, SUPPLY_COLUMNS)}
                      <td>
                        <select
                          className="field-input"
                          aria-label={`${ahu.name} heat recovery wheel`}
                          value={p.hasWheel ? 'yes' : 'no'}
                          onChange={(e) => setAhu(ahu.id, { hasWheel: e.target.value === 'yes' })}
                        >
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                        </select>
                      </td>
                      {ahuCells(ahu.name, ahu.id, p, WHEEL_COLUMNS)}
                      <td>
                        <select
                          className="field-input"
                          aria-label={`${ahu.name} heat source`}
                          value={p.heatSource}
                          onChange={(e) => setAhu(ahu.id, { heatSource: e.target.value as HeatSource })}
                        >
                          {HEAT_SOURCES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          className="field-input"
                          aria-label={`${ahu.name} cool source`}
                          value={p.coolSource}
                          onChange={(e) =>
                            setAhu(ahu.id, { coolSource: e.target.value as CoolingSource })
                          }
                        >
                          {COOLING_SOURCES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h3 className="panel-title">AHU fan parameters</h3>
        <p className="panel-text">
          Constant airflow: supply fan power = airflow (m³/s) × SFP used; extract fan
          power = airflow × extract ratio × SFP used. Choose the method per AHU: SFP
          uses the SFP inputs; Pressure drop uses SFP = total pressure drop (Pa) ÷ 1000
          ÷ overall efficiency (fan × motor × drive, e.g. 0.625). Airflow is the sum of
          the fresh air of the room groups on the AHU. Set the extract ratio to 0 for a
          unit without an extract fan.
        </p>
        {air.ahus.length === 0 ? (
          noAhus
        ) : (
          <div className="table-scroll design-table-scroll">
            <table className="zone-table design-table">
              <thead>
                <tr>
                  <th scope="col">AHU</th>
                  <th scope="col" className="zone-num">Supply airflow m³/h</th>
                  <th scope="col">Method</th>
                  {heads(FAN_COLUMNS)}
                  <th scope="col" className="zone-num design-result-start">SFP used supply</th>
                  <th scope="col" className="zone-num">SFP used extract</th>
                  <th scope="col" className="zone-num">Supply fan kW</th>
                  <th scope="col" className="zone-num">Extract fan kW</th>
                  <th scope="col" className="zone-num">Total fan kW</th>
                </tr>
              </thead>
              <tbody>
                {air.ahus.map((ahu) => {
                  const p = ahuParamsOf(design, ahu.id);
                  const airflow = zones.reduce((sum, z) => {
                    const cfg = zoneAirOf(air, z.uid);
                    return cfg.ahuId === ahu.id
                      ? sum +
                          freshAirBreakdown(z, cfg.freshAirMethod, params.occupancyReduced).design_m3h
                      : sum;
                  }, 0);
                  const fan = fanPower(airflow, p);
                  const sfp = fanSfpUsed(p);
                  return (
                    <tr key={ahu.id}>
                      <th scope="row">{ahu.name}</th>
                      <td className="zone-num design-derived">
                        {airflow.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </td>
                      <td>
                        <select
                          className="field-input"
                          aria-label={`${ahu.name} fan power method`}
                          value={p.fanMethod}
                          onChange={(e) => setAhu(ahu.id, { fanMethod: e.target.value as FanMethod })}
                        >
                          {FAN_METHODS.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      {ahuCells(ahu.name, ahu.id, p, FAN_COLUMNS)}
                      <td className="zone-num design-derived design-result-start">
                        {fixed2(sfp.supply_kWm3s)}
                      </td>
                      <td className="zone-num design-derived">{fixed2(sfp.extract_kWm3s)}</td>
                      <td className="zone-num design-derived">{fixed2(fan.supply_kW)}</td>
                      <td className="zone-num design-derived">{fixed2(fan.extract_kW)}</td>
                      <td className="zone-num design-total">{fixed2(fan.total_kW)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h3 className="panel-title">Chiller parameters</h3>
        <p className="panel-text">
          Fixed COP: chiller electricity = chiller cooling load (AHU coils + FCU
          terminal cooling) ÷ COP.
        </p>
        <div className="field-grid design-scalars">
          <div className="field">
            <span className="field-label">
              Chiller COP
              <span className="field-unit">fixed</span>
            </span>
            <NumberField
              value={params.chillerCOP}
              step={0.1}
              min={0.1}
              aria-label="Chiller COP"
              onChange={(v) => setParams({ chillerCOP: v > 0 ? v : 0.1 })}
            />
          </div>
        </div>
      </section>
    </>
  );
}
