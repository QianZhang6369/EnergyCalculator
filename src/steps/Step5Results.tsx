import { useMemo, useState, type ReactNode } from 'react';
import HourlyChart from '../components/results/HourlyChart';
import KpiSummary from '../components/results/KpiSummary';
import MonthlyResults from '../components/results/MonthlyResults';
import type { AnnualPlan } from '../data/regions';
import type { AirSetup } from '../lib/airSystems';
import type { HvacDesign } from '../lib/hvacDesign';
import { hourlyToCsv } from '../lib/loadCalc';
import { projectLoad, weatherLabel, weatherRows, zoneLoad } from '../lib/projectLoad';
import type { Zone } from '../lib/zones';

interface Props {
  zones: Zone[];
  air: AirSetup;
  hvac: HvacDesign;
  plan: AnnualPlan;
}

const fmt = (n: number, dp = 1) => n.toLocaleString(undefined, { maximumFractionDigits: dp });

/** Power in kW with two decimals; a dash when zero. */
const kw = (v: number) => (v === 0 ? '—' : v.toFixed(2));

/** Rounded percentage of part in total (0 when total is 0). */
const share = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

/** Energy magnitude in MWh from kWh (two decimals below 10 MWh); a dash when zero. */
const mwh = (kWh: number) => {
  if (kWh === 0) return '—';
  const v = Math.abs(kWh) / 1000;
  const dp = v < 10 ? 2 : 1;
  return v.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
};

/** Like mwh, but keeps a minus sign (e.g. latent when the wheel adds moisture). */
const signedMwh = (kWh: number) => (kWh < 0 ? `−${mwh(kWh)}` : mwh(kWh));

type ResultTab = 'summary' | 'monthly' | 'hourly';

const RESULT_TABS: { value: ResultTab; label: string }[] = [
  { value: 'summary', label: 'Summary' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'hourly', label: 'Hourly' },
];

/** A column heading: right-aligned unless `left`, with an optional unit line. */
function Th({
  children,
  unit,
  left,
  sep,
  rowSpan,
}: {
  children: ReactNode;
  unit?: string;
  left?: boolean;
  sep?: boolean;
  rowSpan?: number;
}) {
  return (
    <th scope="col" rowSpan={rowSpan} className={`${left ? '' : 'zone-num'}${sep ? ' res-sep' : ''}`}>
      {children}
      {unit && <span className="zone-unit">{unit}</span>}
    </th>
  );
}

/** A heading spanning a group of columns. */
const GroupTh = ({ children, colSpan }: { children: ReactNode; colSpan: number }) => (
  <th scope="colgroup" colSpan={colSpan} className="res-head-group res-sep">
    {children}
  </th>
);

/** A numeric cell. */
const Td = ({ children, sep, bold }: { children?: ReactNode; sep?: boolean; bold?: boolean }) => (
  <td className={`zone-num${sep ? ' res-sep' : ''}${bold ? ' res-bold' : ''}`}>{children}</td>
);

/** Thin right-aligned bar with a percentage caption. */
function ShareBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="res-share" title={label}>
      <span>
        <i style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </span>
      {pct} %
    </div>
  );
}

export default function Step5Results({ zones, air, hvac, plan }: Props) {
  const [seed, setSeed] = useState(0);
  const [tab, setTab] = useState<ResultTab>('summary');
  const [selectedUid, setSelectedUid] = useState('');

  // `seed` only forces a fresh year of synthetic weather on demand.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rows = useMemo(() => weatherRows(plan), [plan, seed]);

  const result = useMemo(
    () => projectLoad(zones, air, hvac, rows, weatherLabel(plan)),
    [zones, air, hvac, rows, plan],
  );

  const selectedZone = zones.find((z) => z.uid === selectedUid) ?? zones[0];

  // Only the hourly tab needs every hour of one group.
  const detail = useMemo(
    () => (tab === 'hourly' && selectedZone ? zoneLoad(selectedZone, air, hvac, rows) : null),
    [tab, selectedZone, air, hvac, rows],
  );

  const recirc = detail?.summary.mode === 'recirc';

  // The 24 hours of the day with the peak sensible load.
  const peakDay = useMemo(() => {
    if (!detail) return [];
    const day = detail.summary.peakSensibleTime.slice(0, 10);
    return detail.hourly.filter((h) => h.time.startsWith(day));
  }, [detail]);

  const exportCsv = () => {
    if (!detail || !selectedZone) return;
    const blob = new Blob([hourlyToCsv(detail.hourly)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hourly_${selectedZone.id}_${result.weather}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const { totals } = result;

  return (
    <div className="step-page">
      <header className="step-header">
        <h2>Results</h2>
        <p>
          Hourly load and energy over one year of the annual plan, per room group, AHU and
          chiller.
        </p>
      </header>

      {zones.length === 0 || result.hours === 0 ? (
        <p className="library-empty">
          {zones.length === 0
            ? 'No room groups defined. Add them in step 1.'
            : 'No weather data for the annual plan.'}
        </p>
      ) : (
        <>
          <div className="res-toolbar">
            <div className="res-tabs" role="tablist" aria-label="Results view">
              {RESULT_TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.value}
                  className={`chip${tab === t.value ? ' is-active' : ''}`}
                  onClick={() => setTab(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              title="Regions without measured data use synthetic weather, which differs on every run."
              onClick={() => setSeed((s) => s + 1)}
            >
              Regenerate weather
            </button>
          </div>

          {tab === 'summary' && (
            <>
              <KpiSummary totals={totals} hours={result.hours} />

              <section className="panel">
                <h3 className="panel-title">Room group results</h3>
                <div className="table-scroll res-table-scroll">
                  <table className="zone-table res-table">
                    <thead>
                      <tr>
                        <Th left rowSpan={2}>
                          Room group
                        </Th>
                        <Th sep rowSpan={2} unit="m³/h">
                          Fresh air
                        </Th>
                        <GroupTh colSpan={2}>Terminal heating</GroupTh>
                        <GroupTh colSpan={2}>Overcooling &amp; reheat</GroupTh>
                        <Th sep rowSpan={2} unit="MWh">
                          Terminal cooling
                        </Th>
                        <GroupTh colSpan={2}>Terminal fan</GroupTh>
                      </tr>
                      <tr>
                        <Th sep unit="MWh">Electricity</Th>
                        <Th unit="MWh">Water</Th>
                        <Th sep unit="MWh · % of heating">Reheat</Th>
                        <Th unit="h · % of period">Hours</Th>
                        <Th sep unit="kW">Design power</Th>
                        <Th unit="MWh">Electricity</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.zones.map((z) => {
                        const description = zones.find((zone) => zone.uid === z.zoneUid)?.description;
                        return (
                          <tr key={z.zoneUid}>
                            <th scope="row">
                              {z.zoneId}
                              {description && <span className="zone-unit">{description}</span>}
                            </th>
                            <Td sep>{fmt(z.freshFlow_m3h, 0)}</Td>
                            <Td sep>{mwh(z.terminalHeatElectric_kWh)}</Td>
                            <Td>{mwh(z.terminalHeatWater_kWh)}</Td>
                            <Td sep>
                              {z.overcoolReheat_kWh > 0 ? (
                                <>
                                  {mwh(z.overcoolReheat_kWh)}
                                  <ShareBar
                                    pct={share(z.overcoolReheat_kWh, z.reheatEnergy_kWh)}
                                    label="Share of this group's terminal heating"
                                  />
                                </>
                              ) : (
                                '—'
                              )}
                            </Td>
                            <Td>
                              {z.overcoolHours > 0 ? (
                                <>
                                  {fmt(z.overcoolHours, 0)}
                                  <ShareBar
                                    pct={share(z.overcoolHours, result.hours)}
                                    label="Share of the period"
                                  />
                                </>
                              ) : (
                                '—'
                              )}
                            </Td>
                            <Td sep>{mwh(z.terminalCoolingEnergy_kWh)}</Td>
                            <Td sep>{kw(z.terminalFanDesign_kW)}</Td>
                            <Td>{mwh(z.terminalFanEnergy_kWh)}</Td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th scope="row">Project total</th>
                        <Td sep>{fmt(totals.freshAir_m3h, 0)}</Td>
                        <Td sep>{mwh(totals.terminalHeatElectric_kWh)}</Td>
                        <Td>{mwh(totals.terminalHeatWater_kWh)}</Td>
                        <Td sep>
                          {mwh(totals.overcoolReheat_kWh)}
                          {totals.overcoolReheat_kWh > 0 && (
                            <ShareBar
                              pct={share(totals.overcoolReheat_kWh, totals.reheatEnergy_kWh)}
                              label="Share of all terminal heating"
                            />
                          )}
                        </Td>
                        <Td>
                          {fmt(totals.overcoolHours, 0)}
                          <span className="zone-unit">any group</span>
                        </Td>
                        <Td sep>{mwh(totals.terminalCoolingEnergy_kWh)}</Td>
                        <Td sep>{kw(totals.terminalFanDesign_kW)}</Td>
                        <Td>{mwh(totals.terminalFanEnergy_kWh)}</Td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="res-note">
                  Terminal heating is split by the heating source set in step 3: electricity,
                  or water (waste heat or heat pump). Overcooling &amp; reheat = the terminal
                  heats while the room has no net heat loss or the AHU cooling coil is on. The
                  total for hours counts hours when at least one room group qualifies (not a
                  sum). Terminal fan (step 3): design power = terminal design capacity × fan
                  W/kW; constant fans run at it every hour, on-off fans follow the terminal's
                  part load.
                </p>
              </section>

              {result.ahuRows.length > 0 && (
                <section className="panel">
                  <h3 className="panel-title">AHU results</h3>
                  <div className="table-scroll res-table-scroll">
                    <table className="zone-table res-table">
                      <thead>
                        <tr>
                          <Th left rowSpan={2}>
                            AHU
                          </Th>
                          <Th sep rowSpan={2} unit="m³/h">
                            Supply air
                          </Th>
                          <GroupTh colSpan={2}>Coil</GroupTh>
                          <GroupTh colSpan={3}>Wheel heating</GroupTh>
                          <GroupTh colSpan={3}>Wheel pre-cooling</GroupTh>
                          <GroupTh colSpan={4}>Fans</GroupTh>
                        </tr>
                        <tr>
                          <Th sep unit="MWh">Heating</Th>
                          <Th unit="MWh">Cooling</Th>
                          <Th sep unit="MWh">Total</Th>
                          <Th unit="MWh">Sensible</Th>
                          <Th unit="MWh">Latent</Th>
                          <Th sep unit="MWh">Total</Th>
                          <Th unit="MWh">Sensible</Th>
                          <Th unit="MWh">Latent</Th>
                          <Th sep unit="kW">Supply</Th>
                          <Th unit="kW">Extract</Th>
                          <Th unit="kW">Total</Th>
                          <Th unit="MWh">Electricity</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.ahuRows.map((a) => (
                          <tr key={a.key}>
                            <th scope="row">{a.name}</th>
                            <Td sep>{fmt(a.airflow_m3h, 0)}</Td>
                            <Td sep>{mwh(a.heating_kWh)}</Td>
                            <Td>{mwh(a.cooling_kWh)}</Td>
                            <Td sep>{mwh(a.wheelHeating_kWh)}</Td>
                            <Td>{mwh(a.wheelHeatingSensible_kWh)}</Td>
                            <Td>{mwh(a.wheelHeatingLatent_kWh)}</Td>
                            <Td sep>{signedMwh(a.wheelPrecooling_kWh)}</Td>
                            <Td>{signedMwh(a.wheelPrecoolingSensible_kWh)}</Td>
                            <Td>{signedMwh(a.wheelPrecoolingLatent_kWh)}</Td>
                            <Td sep>{kw(a.supplyPower_kW)}</Td>
                            <Td>{kw(a.extractPower_kW)}</Td>
                            <Td>{kw(a.totalPower_kW)}</Td>
                            <Td>{mwh(a.energy_kWh)}</Td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <th scope="row">Project total</th>
                          <Td sep>{fmt(totals.freshAir_m3h, 0)}</Td>
                          <Td sep>{mwh(totals.ahuHeatEnergy_kWh)}</Td>
                          <Td>{mwh(totals.ahuCoolEnergy_kWh)}</Td>
                          <Td sep>{mwh(totals.wheelHeating_kWh)}</Td>
                          <Td>{mwh(totals.wheelHeatingSensible_kWh)}</Td>
                          <Td>{mwh(totals.wheelHeatingLatent_kWh)}</Td>
                          <Td sep>{signedMwh(totals.wheelPrecooling_kWh)}</Td>
                          <Td>{signedMwh(totals.wheelPrecoolingSensible_kWh)}</Td>
                          <Td>{signedMwh(totals.wheelPrecoolingLatent_kWh)}</Td>
                          <Td sep />
                          <Td />
                          <Td>{kw(totals.fanPower_kW)}</Td>
                          <Td>{mwh(totals.fanElectricity_kWh)}</Td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <p className="res-note">
                    Coil heating and cooling are thermal energy (cooling includes
                    dehumidification). Wheel recovery is the heat the wheel adds to or removes
                    from the fresh air. Wheel heating (hours the wheel raises the fresh-air
                    enthalpy) and pre-cooling (hours it lowers it) are each split into sensible
                    + latent. In heating the sensible part replaces coil heating and the latent
                    part is moisture added to the fresh air; in pre-cooling the latent part is
                    moisture removed. Fans: SFP or pressure-drop method (step 4), constant
                    airflow for all {result.hours} h; terminal fans are in the room group table.
                  </p>
                </section>
              )}

              <section className="panel">
                <h3 className="panel-title">Chiller results</h3>
                <div className="table-scroll res-table-scroll">
                  <table className="zone-table res-table">
                    <thead>
                      <tr>
                        <th scope="colgroup" colSpan={3} className="res-head-group">
                          Chiller cooling load
                        </th>
                        <Th sep rowSpan={2} unit="fixed">
                          Chiller COP
                        </Th>
                        <Th sep rowSpan={2} unit="MWh">
                          Electricity consumption
                        </Th>
                      </tr>
                      <tr>
                        <Th unit="MWh">AHU coils</Th>
                        <Th unit="MWh">Water-cooled terminals</Th>
                        <Th unit="MWh">Total</Th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <Td>{mwh(totals.ahuCoolEnergy_kWh)}</Td>
                        <Td>{mwh(totals.terminalCoolingEnergy_kWh)}</Td>
                        <Td bold>{mwh(totals.chillerCoolingEnergy_kWh)}</Td>
                        <Td sep>{fmt(hvac.params.chillerCOP, 2)}</Td>
                        <Td sep bold>
                          {mwh(totals.chillerElectricity_kWh)}
                        </Td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="res-note">
                  Chiller cooling load = AHU cooling coils + water-cooled terminal cooling
                  (FCU). Electricity consumption = cooling load ÷ COP; the COP is set in step 4.
                </p>
              </section>
            </>
          )}

          {tab === 'monthly' && <MonthlyResults monthly={result.monthly} />}

          {tab === 'hourly' && detail && selectedZone && (
            <>
              <section className="panel">
                <div className="library-head">
                  <h3 className="panel-title">Hourly detail</h3>
                  <div className="res-hourly-controls">
                    <select
                      className="field-input"
                      aria-label="Select room group for hourly detail"
                      value={selectedZone.uid}
                      onChange={(e) => setSelectedUid(e.target.value)}
                    >
                      {zones.map((z) => (
                        <option key={z.uid} value={z.uid}>
                          {z.id}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn btn-ghost btn-small" onClick={exportCsv}>
                      Export CSV
                    </button>
                  </div>
                </div>

                <HourlyChart hourly={detail.hourly} recirc={recirc} />

                <h4 className="library-group-title design-subtitle">
                  Peak-sensible day · {detail.summary.peakSensibleTime.slice(0, 10)}
                </h4>
                <div className="table-scroll">
                  <table className="zone-table res-table res-peak">
                    <thead>
                      <tr>
                        <Th left>Time (GMT)</Th>
                        <Th>T_out °C</Th>
                        <Th>RH %</Th>
                        <Th>Solar W/m²</Th>
                        <Th>Group sens. kW</Th>
                        <Th>Supply °C</Th>
                        {recirc ? (
                          <>
                            <Th>OA load kW</Th>
                            <Th>Coil dew °C</Th>
                            <Th>Coil cool kW</Th>
                          </>
                        ) : (
                          <>
                            <Th left>Wheel</Th>
                            <Th>Coil dew °C</Th>
                            <Th>Vent kW</Th>
                            <Th>Reheat kW</Th>
                          </>
                        )}
                        <Th>Term. cool kW</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {peakDay.map((h) => (
                        <tr
                          key={h.time}
                          className={
                            h.condensation ? 'res-wet' : h.wheelStatus === 'OFF' ? 'res-wheel-off' : undefined
                          }
                        >
                          <th scope="row">{h.time.slice(11, 16)}</th>
                          <Td>{fmt(h.tOut_C)}</Td>
                          <Td>{Math.round(h.rhOut_pct)}</Td>
                          <Td>{Math.round(h.solarMean_Wm2)}</Td>
                          <Td bold>{fmt(h.sensible_kW, 2)}</Td>
                          <Td>{fmt(h.supplySetpoint_C)}</Td>
                          {recirc ? (
                            <>
                              <Td>{fmt(h.oaLoad_kW, 2)}</Td>
                              <Td>{fmt(h.coilInletDew_C)}</Td>
                              <Td bold>{fmt(h.coilCooling_kW, 2)}</Td>
                            </>
                          ) : (
                            <>
                              <td className="res-muted">{h.wheelStatus}</td>
                              <Td>{fmt(h.coilInletDew_C)}</Td>
                              <Td>{fmt(h.ventCooling_kW, 2)}</Td>
                              <Td bold>{fmt(h.reheat_kW, 2)}</Td>
                            </>
                          )}
                          <Td>{fmt(h.terminalCooling_kW, 2)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="res-note">
                  Showing the 24 h of the peak-sensible day. Blue = wet coil, green = wheel off.
                  Export CSV for all {detail.summary.hours} h and every column.
                </p>
              </section>

              <section className="panel">
                <h3 className="panel-title">Calculation notes</h3>
                <ul className="res-notes">
                  <li>
                    Barometric pressure, ρ·cp, reference irradiance and heat per person are set
                    in step 4 (Basic parameters); room set-point &amp; humidity are per room
                    group; fan ΔT and wheel return ratio are per AHU.
                  </li>
                  <li>
                    Solar gain uses the solar radiation of step 2: sun-window m² × solar/1000 ×
                    (radiation ÷ reference irradiance).
                  </li>
                  <li>
                    Room set-point is per room group (step 4); the supply-air temperature ramps
                    with outdoor temperature between the AHU's winter and summer set-points;
                    fresh-air quantity is the step 3 method.
                  </li>
                  <li>
                    CBU-EL duty = max(−(group sensible + ventilation cooling), 0) — a CBU can
                    only heat. Only ventilation energy is counted for the coil.
                  </li>
                </ul>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
