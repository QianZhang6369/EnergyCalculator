import NumberField from './NumberField';
import {
  COOLING_SOURCES,
  FRESH_AIR_METHODS,
  HEAT_SOURCES,
  LIGHTING_PROFILES,
  OCCUPANCY_PROFILES,
  TERMINAL_FANS,
  TERMINAL_UNITS,
  defaultTerminalFan,
  freshAirBreakdown,
  profileAveragePct,
  profileFractions,
  zoneAirOf,
  type AirSetup,
  type CoolingSource,
  type FreshAirMethod,
  type HeatSource,
  type LightingProfile,
  type OccupancyProfile,
  type TerminalFan,
  type TerminalUnit,
  type ZoneAirConfig,
} from '../lib/airSystems';
import { uid, type Zone } from '../lib/zones';

interface Props {
  zones: Zone[];
  air: AirSetup;
  /** Takes an updater so quick successive edits cannot clobber each other. */
  onChange: (update: (air: AirSetup) => AirSetup) => void;
  reducedOccupancy: boolean;
}

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

/** 24 bars for an hourly profile; each bar has a native tooltip with its value. */
function HourProfileChart({ fractions, label }: { fractions: number[]; label: string }) {
  const width = 96;
  const height = 24;
  const slot = width / (fractions.length || 1);
  return (
    <svg
      role="img"
      aria-label={`${label}: hourly profile, daily average ${profileAveragePct(fractions)} %`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="air-profile"
    >
      <rect width={width} height={height} rx={2} className="air-profile-track" />
      {fractions.map((f, h) => {
        const v = Math.min(1, Math.max(0, f));
        const barH = Math.max(v * height, v > 0 ? 1 : 0);
        return (
          <g key={h}>
            <title>{`${String(h).padStart(2, '0')}:00 · ${Math.round(v * 100)} %`}</title>
            {/* Full-height hit area so the tooltip also works on low bars. */}
            <rect x={h * slot} y={0} width={slot} height={height} fill="transparent" />
            <rect x={h * slot + slot * 0.1} y={height - barH} width={slot * 0.8} height={barH} />
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Step 3 — air system configuration: the air handling units, then the air
 * system of each room group.
 */
export default function AirSystems({ zones, air, onChange, reducedOccupancy }: Props) {
  const setZoneAir = (zoneUid: string, patch: Partial<ZoneAirConfig>) =>
    onChange((prev) => ({
      ...prev,
      airConfig: { ...prev.airConfig, [zoneUid]: { ...zoneAirOf(prev, zoneUid), ...patch } },
    }));

  const addAhu = () =>
    onChange((prev) => ({
      ...prev,
      ahus: [...prev.ahus, { id: `ahu-${uid()}`, name: `AHU-${prev.ahus.length + 1}` }],
    }));

  const renameAhu = (id: string, name: string) =>
    onChange((prev) => ({
      ...prev,
      ahus: prev.ahus.map((a) => (a.id === id ? { ...a, name } : a)),
    }));

  // Room groups fed by the removed unit go back to unassigned.
  const removeAhu = (id: string) =>
    onChange((prev) => ({
      ...prev,
      ahus: prev.ahus.filter((a) => a.id !== id),
      airConfig: Object.fromEntries(
        Object.entries(prev.airConfig).map(([key, cfg]) => [
          key,
          cfg.ahuId === id ? { ...cfg, ahuId: null } : cfg,
        ]),
      ),
    }));

  const rows = zones.map((zone) => {
    const cfg = zoneAirOf(air, zone.uid);
    return { zone, cfg, fa: freshAirBreakdown(zone, cfg.freshAirMethod, reducedOccupancy) };
  });
  const totalDesign = rows.reduce((sum, r) => sum + r.fa.design_m3h, 0);

  return (
    <>
      <section className="panel">
        <div className="library-head">
          <div>
            <h3 className="panel-title">
              Air handling units
              <span className="tag tag-muted">{air.ahus.length}</span>
            </h3>
            <p className="panel-text">
              Define the units here, then assign one as the fresh-air source of each
              room group below.
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-small" onClick={addAhu}>
            + Add AHU
          </button>
        </div>
        {air.ahus.length === 0 ? (
          <p className="library-empty">
            No AHUs yet. Add at least one to assign as a room group's fresh-air source.
          </p>
        ) : (
          <ul className="air-ahus">
            {air.ahus.map((ahu, i) => (
              <li key={ahu.id}>
                <span className="zone-index" aria-hidden="true">
                  {i + 1}
                </span>
                <input
                  className="field-input"
                  type="text"
                  aria-label={`AHU ${i + 1} name`}
                  value={ahu.name}
                  onChange={(e) => renameAhu(ahu.id, e.target.value)}
                />
                <button
                  type="button"
                  className="icon-btn icon-btn-danger"
                  title="Remove AHU"
                  aria-label={`Remove ${ahu.name}`}
                  onClick={() => removeAhu(ahu.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h3 className="panel-title">Room-group air systems</h3>
        <p className="panel-text">
          For each room group: its fresh-air source, terminal unit, fresh-air method,
          occupancy profile and lighting. Profiles are by hour of day on the clock of
          the weather data (GMT).
        </p>
        <div className="table-scroll air-table-scroll">
          <table className="zone-table air-table">
            <thead>
              <tr>
                <th scope="col">Room group</th>
                <th scope="col">Fresh-air AHU</th>
                <th scope="col">Terminal unit</th>
                <th scope="col">Terminal fan</th>
                <th scope="col" className="zone-num">Fan W/kW</th>
                <th scope="col">Heating source</th>
                <th scope="col">Cooling source</th>
                <th scope="col">Fresh-air method</th>
                <th scope="col">Occupancy profile</th>
                <th scope="col" className="zone-num">Lighting W/m²</th>
                <th scope="col">Lighting profile</th>
                <th scope="col" className="zone-num">Person m³/h</th>
                <th scope="col" className="zone-num">ACH m³/h</th>
                <th scope="col" className="zone-num">Design m³/h</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={14} className="zone-empty">
                    No room groups defined. Add them in step 1 first.
                  </td>
                </tr>
              )}
              {rows.map(({ zone, cfg, fa }) => {
                const occupancy = profileFractions(OCCUPANCY_PROFILES, cfg.occupancyProfile);
                const lighting = profileFractions(LIGHTING_PROFILES, cfg.lightingProfile);
                return (
                  <tr key={zone.uid}>
                    <th scope="row">
                      {zone.id}
                      {zone.description && <span className="zone-unit">{zone.description}</span>}
                    </th>
                    <td>
                      <select
                        className="field-input"
                        aria-label={`${zone.id} fresh-air AHU`}
                        value={cfg.ahuId ?? ''}
                        onChange={(e) => setZoneAir(zone.uid, { ahuId: e.target.value || null })}
                      >
                        <option value="">— none —</option>
                        {air.ahus.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="field-input"
                        aria-label={`${zone.id} terminal unit`}
                        value={cfg.terminalUnit}
                        onChange={(e) => {
                          // A new terminal type brings its default fan.
                          const terminalUnit = e.target.value as TerminalUnit;
                          setZoneAir(zone.uid, { terminalUnit, ...defaultTerminalFan(terminalUnit) });
                        }}
                      >
                        {TERMINAL_UNITS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="field-input"
                        aria-label={`${zone.id} terminal fan`}
                        value={cfg.terminalFan}
                        onChange={(e) =>
                          setZoneAir(zone.uid, { terminalFan: e.target.value as TerminalFan })
                        }
                      >
                        {TERMINAL_FANS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <NumberField
                        value={cfg.terminalFan_WperkW}
                        step={1}
                        disabled={cfg.terminalFan === 'none'}
                        aria-label={`${zone.id} terminal fan power per kW capacity`}
                        onChange={(v) => setZoneAir(zone.uid, { terminalFan_WperkW: Math.max(0, v) })}
                      />
                    </td>
                    <td>
                      <select
                        className="field-input"
                        aria-label={`${zone.id} heating source`}
                        value={cfg.terminalHeatSource}
                        onChange={(e) =>
                          setZoneAir(zone.uid, { terminalHeatSource: e.target.value as HeatSource })
                        }
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
                        aria-label={`${zone.id} cooling source`}
                        value={cfg.terminalCoolSource}
                        onChange={(e) =>
                          setZoneAir(zone.uid, { terminalCoolSource: e.target.value as CoolingSource })
                        }
                      >
                        {COOLING_SOURCES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="field-input air-method"
                        aria-label={`${zone.id} fresh-air method`}
                        value={cfg.freshAirMethod}
                        onChange={(e) =>
                          setZoneAir(zone.uid, { freshAirMethod: e.target.value as FreshAirMethod })
                        }
                      >
                        {FRESH_AIR_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="air-profile-cell">
                        <select
                          className="field-input"
                          aria-label={`${zone.id} occupancy profile`}
                          value={cfg.occupancyProfile}
                          onChange={(e) =>
                            setZoneAir(zone.uid, {
                              occupancyProfile: e.target.value as OccupancyProfile,
                            })
                          }
                        >
                          {OCCUPANCY_PROFILES.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                        <HourProfileChart fractions={occupancy} label={`${zone.id} occupancy`} />
                        <span>avg {profileAveragePct(occupancy)} %</span>
                      </div>
                    </td>
                    <td>
                      <NumberField
                        value={cfg.lighting_Wm2}
                        step={1}
                        aria-label={`${zone.id} lighting power density`}
                        onChange={(v) => setZoneAir(zone.uid, { lighting_Wm2: Math.max(0, v) })}
                      />
                    </td>
                    <td>
                      <div className="air-profile-cell">
                        <select
                          className="field-input"
                          aria-label={`${zone.id} lighting profile`}
                          value={cfg.lightingProfile}
                          onChange={(e) =>
                            setZoneAir(zone.uid, {
                              lightingProfile: e.target.value as LightingProfile,
                            })
                          }
                        >
                          {LIGHTING_PROFILES.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                        <HourProfileChart fractions={lighting} label={`${zone.id} lighting`} />
                        <span>avg {profileAveragePct(lighting)} %</span>
                      </div>
                    </td>
                    {/* The basis the chosen method ignores is shown dimmed. */}
                    <td className={`zone-num${cfg.freshAirMethod === 'air_change' ? ' air-unused' : ''}`}>
                      {fmt(fa.personBased_m3h)}
                    </td>
                    <td className={`zone-num${cfg.freshAirMethod === 'person' ? ' air-unused' : ''}`}>
                      {fmt(fa.airChange_m3h)}
                    </td>
                    <td className="zone-num air-design">{fmt(fa.design_m3h)}</td>
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <th scope="row" colSpan={13}>
                    Total design fresh air
                  </th>
                  <td className="zone-num">{fmt(totalDesign)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="air-sizing">
          <strong>Terminal fan sizing</strong>
          <label>
            Design percentile
            <NumberField
              value={air.terminalFanPercentile}
              step={0.001}
              aria-label="Terminal fan design percentile"
              onChange={(v) =>
                onChange((prev) => ({ ...prev, terminalFanPercentile: Math.min(1, Math.max(0, v)) }))
              }
            />
          </label>
          <label>
            Oversizing factor
            <NumberField
              value={air.terminalFanOversizing}
              step={0.05}
              aria-label="Terminal fan oversizing factor"
              onChange={(v) => onChange((prev) => ({ ...prev, terminalFanOversizing: Math.max(0, v) }))}
            />
          </label>
          <p>
            Terminal fan power = design capacity × fan W/kW, where design capacity =
            oversizing factor × the design-percentile terminal heating or cooling of the
            simulation (whichever is larger). Constant: that power every hour. On-off:
            scaled each hour by (terminal heating + cooling) ÷ design capacity. Fan heat
            is not added to the room balance.
          </p>
        </div>
      </section>
    </>
  );
}
