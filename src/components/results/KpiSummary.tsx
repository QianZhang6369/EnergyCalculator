import type { ReactNode } from 'react';
import type { ProjectLoadResult } from '../../lib/loadCalc';

/** Energy in MWh from kWh (magnitude), one decimal below 100 MWh. */
function mwh(kWh: number): string {
  const v = Math.abs(kWh) / 1000;
  return v.toLocaleString(undefined, { maximumFractionDigits: v >= 100 ? 0 : 1 });
}

/** Like mwh, but keeps a minus sign (latent when the wheel adds moisture). */
const signedMwh = (kWh: number) => (kWh < 0 ? `−${mwh(kWh)}` : mwh(kWh));

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

/**
 * Headline figures of the results. First the total HVAC electricity with its
 * split, then the thermal energy grouped by AHU, terminal unit and wheel.
 */
export default function KpiSummary({
  totals,
  hours,
}: {
  totals: ProjectLoadResult['totals'];
  hours: number;
}) {
  const unit = hours === 8760 ? 'MWh / year' : 'MWh';
  const total = totals.totalElectricity_kWh;
  const split = [
    { label: 'Electric heating', value: totals.electricalHeating_kWh, color: '#eb6834' },
    { label: 'AHU fans', value: totals.fanElectricity_kWh, color: '#4a3aa7' },
    { label: 'Terminal fans', value: totals.terminalFanEnergy_kWh, color: '#1a9a70' },
    { label: 'Chiller', value: totals.chillerElectricity_kWh, color: '#2a78d6' },
  ];

  return (
    <>
      <section className="panel">
        <p className="res-kpi-label">Total HVAC electricity</p>
        <p className="res-kpi-value">
          {mwh(total)} <span>{unit}</span>
        </p>
        <div className="res-split" aria-hidden="true">
          {split.map((s) => (
            <i
              key={s.label}
              style={{ width: `${total > 0 ? (s.value / total) * 100 : 0}%`, background: s.color }}
            />
          ))}
        </div>
        <ul className="res-legend">
          {split.map((s) => (
            <li key={s.label}>
              <i className="res-swatch" style={{ background: s.color }} />
              {s.label} {mwh(s.value)} MWh · {pct(s.value, total)} %
            </li>
          ))}
        </ul>
      </section>

      <div className="res-groups">
        <Group title="AHU">
          <Metric
            label="Fresh air"
            value={totals.freshAir_m3h.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            unit="m³/h"
          />
          <Metric label="Heating" value={mwh(totals.ahuHeatEnergy_kWh)} />
          <Metric
            label="Cooling"
            value={mwh(totals.ahuCoolEnergy_kWh)}
            sub={`of which ${mwh(totals.ahuCoolLatentEnergy_kWh)} latent`}
          />
        </Group>
        <Group title="Terminal unit">
          <Metric label="Heating" value={mwh(totals.reheatEnergy_kWh)} />
          <Metric
            label="Reheat by overcooling"
            value={mwh(totals.overcoolReheat_kWh)}
            sub={`${pct(totals.overcoolReheat_kWh, totals.reheatEnergy_kWh)} % of terminal heating`}
          />
          <Metric label="Cooling" value={mwh(totals.terminalCoolingEnergy_kWh)} />
          <Metric label="Fan electricity" value={mwh(totals.terminalFanEnergy_kWh)} />
        </Group>
        <Group title="Wheel recovery">
          <Metric
            label="Heating"
            value={mwh(totals.wheelHeating_kWh)}
            sub={`${mwh(totals.wheelHeatingSensible_kWh)} sensible · ${mwh(totals.wheelHeatingLatent_kWh)} latent`}
          />
          <Metric
            label="Pre-cooling"
            value={signedMwh(totals.wheelPrecooling_kWh)}
            sub={`${signedMwh(totals.wheelPrecoolingSensible_kWh)} sensible · ${signedMwh(totals.wheelPrecoolingLatent_kWh)} latent`}
          />
        </Group>
      </div>
    </>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel res-group">
      <h3 className="panel-title">{title}</h3>
      <dl>{children}</dl>
    </section>
  );
}

function Metric({
  label,
  value,
  unit = 'MWh',
  sub,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
}) {
  return (
    <div className="res-metric">
      <dt>{label}</dt>
      <dd>
        {value} <span>{unit}</span>
      </dd>
      {sub && <dd className="res-metric-sub">{sub}</dd>}
    </div>
  );
}
