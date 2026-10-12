import { useState, type ReactNode } from 'react';
import type { MonthlyRow } from '../../lib/loadCalc';

// Series colours — checked for colour-blind separation on a light surface.
const C = {
  electricHeating: '#eb6834',
  fans: '#4a3aa7',
  terminalFans: '#1a9a70',
  chiller: '#2a78d6',
  ahuHeating: '#e34948',
  terminalHeating: '#eda100',
  overcoolReheat: '#a3261f',
  ahuCooling: '#2a78d6',
  terminalCooling: '#22b8cf',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Energy in MWh from kWh, one decimal; a dash when zero. */
function mwh(kWh: number): string {
  if (Math.abs(kWh) < 0.5) return '—';
  return (kWh / 1000).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

const fmt1 = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 1 });

interface Series {
  label: string;
  color: string;
  /** One value per month, MWh, never negative. */
  values: number[];
}

/** Monthly results: electricity and thermal energy charts, then the table. */
export default function MonthlyResults({ monthly }: { monthly: MonthlyRow[] }) {
  const multiYear = new Set(monthly.map((m) => m.key.slice(0, 4))).size > 1;
  const labels = monthly.map((m) => {
    const name = MONTHS[Number(m.key.slice(5, 7)) - 1] ?? m.key;
    return multiYear ? `${name} ${m.key.slice(2, 4)}` : name;
  });
  const col = (pick: (m: MonthlyRow) => number) => monthly.map((m) => pick(m) / 1000);

  const electricity: Series[] = [
    { label: 'Electric heating', color: C.electricHeating, values: col((m) => m.electricHeating_kWh) },
    { label: 'AHU fans', color: C.fans, values: col((m) => m.fanElectricity_kWh) },
    { label: 'Terminal fans', color: C.terminalFans, values: col((m) => m.terminalFanElectricity_kWh) },
    { label: 'Chiller', color: C.chiller, values: col((m) => m.chillerElectricity_kWh) },
  ];
  const heating: Series[] = [
    { label: 'AHU heating', color: C.ahuHeating, values: col((m) => m.ahuHeating_kWh) },
    {
      label: 'Terminal heating (other)',
      color: C.terminalHeating,
      values: col((m) => m.terminalHeating_kWh - m.overcoolReheat_kWh),
    },
    { label: 'Reheat by overcooling', color: C.overcoolReheat, values: col((m) => m.overcoolReheat_kWh) },
  ];
  const cooling: Series[] = [
    { label: 'AHU cooling', color: C.ahuCooling, values: col((m) => m.ahuCooling_kWh) },
    { label: 'Terminal cooling', color: C.terminalCooling, values: col((m) => m.terminalCooling_kWh) },
  ];

  const sum = (pick: (m: MonthlyRow) => number) => monthly.reduce((a, m) => a + pick(m), 0);
  const elecTotal = (m: MonthlyRow) =>
    m.electricHeating_kWh +
    m.fanElectricity_kWh +
    m.terminalFanElectricity_kWh +
    m.chillerElectricity_kWh;

  return (
    <>
      <section className="panel">
        <h3 className="panel-title">
          Electricity by month <span className="res-title-unit">MWh</span>
        </h3>
        <StackedBars labels={labels} up={electricity} />
      </section>

      <section className="panel">
        <h3 className="panel-title">
          Thermal energy by month{' '}
          <span className="res-title-unit">
            MWh · heating above zero, cooling below · outdoor temperature underneath
          </span>
        </h3>
        <StackedBars
          labels={labels}
          up={heating}
          down={cooling}
          line={{
            label: 'Mean outdoor temperature',
            unit: '°C',
            values: monthly.map((m) => m.outdoorTemp_C),
          }}
        />
      </section>

      <section className="panel">
        <h3 className="panel-title">
          Monthly results <span className="res-title-unit">MWh</span>
        </h3>
        <div className="table-scroll res-table-scroll">
          <table className="zone-table res-table">
            <thead>
              <tr>
                <th scope="col" rowSpan={2}>
                  Month
                </th>
                <th scope="col" rowSpan={2} className="zone-num res-sep">
                  Outdoor
                  <span className="zone-unit">mean °C</span>
                </th>
                <th scope="colgroup" colSpan={5} className="res-head-group res-sep">
                  Electricity
                </th>
                <th scope="colgroup" colSpan={3} className="res-head-group res-sep">
                  Heating
                </th>
                <th scope="colgroup" colSpan={2} className="res-head-group res-sep">
                  Cooling
                </th>
              </tr>
              <tr>
                <th scope="col" className="zone-num res-sep">Heating</th>
                <th scope="col" className="zone-num">AHU fans</th>
                <th scope="col" className="zone-num">Terminal fans</th>
                <th scope="col" className="zone-num">Chiller</th>
                <th scope="col" className="zone-num">Total</th>
                <th scope="col" className="zone-num res-sep">AHU</th>
                <th scope="col" className="zone-num">Terminal</th>
                <th scope="col" className="zone-num">of which reheat</th>
                <th scope="col" className="zone-num res-sep">AHU</th>
                <th scope="col" className="zone-num">Terminal</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((m, i) => (
                <tr key={m.key}>
                  <th scope="row">{labels[i]}</th>
                  <Num sep>{fmt1(m.outdoorTemp_C)}</Num>
                  <Num sep>{mwh(m.electricHeating_kWh)}</Num>
                  <Num>{mwh(m.fanElectricity_kWh)}</Num>
                  <Num>{mwh(m.terminalFanElectricity_kWh)}</Num>
                  <Num>{mwh(m.chillerElectricity_kWh)}</Num>
                  <Num bold>{mwh(elecTotal(m))}</Num>
                  <Num sep>{mwh(m.ahuHeating_kWh)}</Num>
                  <Num>{mwh(m.terminalHeating_kWh)}</Num>
                  <Num>{mwh(m.overcoolReheat_kWh)}</Num>
                  <Num sep>{mwh(m.ahuCooling_kWh)}</Num>
                  <Num>{mwh(m.terminalCooling_kWh)}</Num>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <Num sep>
                  {fmt1(sum((m) => m.outdoorTemp_C * m.hours) / Math.max(1, sum((m) => m.hours)))}
                </Num>
                <Num sep>{mwh(sum((m) => m.electricHeating_kWh))}</Num>
                <Num>{mwh(sum((m) => m.fanElectricity_kWh))}</Num>
                <Num>{mwh(sum((m) => m.terminalFanElectricity_kWh))}</Num>
                <Num>{mwh(sum((m) => m.chillerElectricity_kWh))}</Num>
                <Num>{mwh(sum(elecTotal))}</Num>
                <Num sep>{mwh(sum((m) => m.ahuHeating_kWh))}</Num>
                <Num>{mwh(sum((m) => m.terminalHeating_kWh))}</Num>
                <Num>{mwh(sum((m) => m.overcoolReheat_kWh))}</Num>
                <Num sep>{mwh(sum((m) => m.ahuCooling_kWh))}</Num>
                <Num>{mwh(sum((m) => m.terminalCooling_kWh))}</Num>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="res-note">
          Electricity = electric heating + AHU fans + terminal fans + chiller. Heating and
          cooling are thermal energy; reheat by overcooling is part of the terminal heating.
        </p>
      </section>
    </>
  );
}

function Num({ children, sep, bold }: { children: ReactNode; sep?: boolean; bold?: boolean }) {
  return (
    <td className={`zone-num${sep ? ' res-sep' : ''}${bold ? ' res-bold' : ''}`}>{children}</td>
  );
}

const W = 760;
const PAD = { top: 10, right: 8, bottom: 24, left: 40 };
/** Surface gap between stacked segments, px. */
const GAP = 2;
/** Second-measure strip under the bars. */
const STRIP = { gap: 14, height: 88 };

/** A "nice" axis step giving roughly four ticks up to max. */
function niceStep(max: number): number {
  if (max <= 0) return 1;
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

/**
 * Stacked monthly bars. `up` stacks above the zero line; the optional `down`
 * stacks below it. The optional `line` is a second measure with its own scale,
 * drawn as a strip under the bars on the same month axis. Hovering a month
 * shows its values.
 */
function StackedBars({
  labels,
  up,
  down = [],
  line,
}: {
  labels: string[];
  up: Series[];
  down?: Series[];
  line?: { label: string; unit: string; values: number[] };
}) {
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const total = (series: Series[], i: number) =>
    series.reduce((a, s) => a + Math.max(0, s.values[i] ?? 0), 0);
  const maxUp = Math.max(0, ...labels.map((_, i) => total(up, i)));
  const maxDown = Math.max(0, ...labels.map((_, i) => total(down, i)));
  const step = niceStep(Math.max(maxUp, maxDown));
  const topV = Math.max(step, Math.ceil(maxUp / step) * step);
  const botV = maxDown > 0 ? Math.ceil(maxDown / step) * step : 0;

  const barsH = down.length > 0 ? 300 : 220;
  const H = barsH + (line ? STRIP.gap + STRIP.height : 0);
  const innerW = W - PAD.left - PAD.right;
  const innerH = barsH - PAD.top - PAD.bottom;
  const scale = innerH / (topV + botV);
  const zeroY = PAD.top + topV * scale;
  const slot = innerW / Math.max(n, 1);
  const barW = Math.min(36, slot * 0.6);

  const ticks: number[] = [];
  for (let v = -botV; v <= topV + 1e-9; v += step) ticks.push(v);

  const segments = (series: Series[], i: number, dir: 1 | -1) => {
    let offset = 0;
    return series.map((s) => {
      const h = Math.max(0, s.values[i] ?? 0) * scale;
      const y = dir === 1 ? zeroY - offset - h : zeroY + offset;
      offset += h;
      if (h <= 0) return null;
      const drawn = h > GAP + 1 ? h - GAP : h;
      return (
        <rect
          key={s.label}
          x={PAD.left + i * slot + (slot - barW) / 2}
          y={dir === 1 ? y + (h - drawn) : y}
          width={barW}
          height={drawn}
          rx={1.5}
          fill={s.color}
        />
      );
    });
  };

  const legend = [...up, ...down];

  // Strip under the bars: its own scale, labelled directly (no second axis).
  const stripTop = PAD.top + innerH + STRIP.gap;
  const lineMin = line ? Math.min(...line.values) : 0;
  const lineMax = line ? Math.max(...line.values) : 0;
  const lineY = (v: number) => {
    const plotTop = stripTop + 32;
    const plotH = STRIP.height - 32 - 6;
    return lineMax === lineMin
      ? plotTop + plotH / 2
      : plotTop + plotH - ((v - lineMin) / (lineMax - lineMin)) * plotH;
  };
  const xMid = (i: number) => PAD.left + (i + 0.5) * slot;

  return (
    <div className="res-bars">
      <ul className="res-legend">
        {legend.map((s) => (
          <li key={s.label}>
            <i className="res-swatch" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
        {line && (
          <li>
            <i className="res-line-key" />
            {line.label} ({line.unit})
          </li>
        )}
      </ul>
      <div className="res-bars-plot">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Stacked monthly bars: ${legend.map((s) => s.label).join(', ')}`}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((v) => {
            const y = zeroY - v * scale;
            return (
              <g key={v}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={y}
                  y2={y}
                  className={Math.abs(v) < 1e-9 ? 'chart-axis' : 'chart-grid'}
                />
                <text x={PAD.left - 6} y={y + 3.5} className="chart-tick chart-tick-y">
                  {fmt1(Math.abs(v))}
                </text>
              </g>
            );
          })}
          {line && (
            <g>
              <text x={PAD.left} y={stripTop + 8} className="chart-tick">
                {line.label} ({line.unit})
              </text>
              <path
                d={line.values
                  .map((v, i) => `${i === 0 ? 'M' : 'L'}${xMid(i).toFixed(1)},${lineY(v).toFixed(1)}`)
                  .join(' ')}
                className="res-line"
              />
              {line.values.map((v, i) => (
                <g key={i}>
                  <circle cx={xMid(i)} cy={lineY(v)} r={4} className="res-line-dot" />
                  <text x={xMid(i)} y={lineY(v) - 8} textAnchor="middle" className="chart-tick">
                    {fmt1(v)}
                  </text>
                </g>
              ))}
            </g>
          )}
          {labels.map((label, i) => (
            <g key={label + i}>
              {hover === i && (
                <rect
                  x={PAD.left + i * slot}
                  y={PAD.top}
                  width={slot}
                  height={H - PAD.top - PAD.bottom}
                  className="res-hover"
                />
              )}
              {segments(up, i, 1)}
              {segments(down, i, -1)}
              <text x={xMid(i)} y={H - 7} textAnchor="middle" className="chart-tick">
                {label}
              </text>
              <rect
                x={PAD.left + i * slot}
                y={0}
                width={slot}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            </g>
          ))}
        </svg>
        {hover !== null && (
          <div
            className="res-tip"
            style={{
              left: `${((PAD.left + (hover + 0.5) * slot) / W) * 100}%`,
              transform: `translateX(${hover > n / 2 ? '-105%' : '5%'})`,
            }}
          >
            <strong>{labels[hover]}</strong>
            {legend.map((s) => (
              <div key={s.label}>
                <span>
                  <i className="res-swatch" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span>{fmt1(s.values[hover] ?? 0)}</span>
              </div>
            ))}
            {line && (
              <div className="res-tip-rule">
                <span>{line.label}</span>
                <span>
                  {fmt1(line.values[hover] ?? 0)} {line.unit}
                </span>
              </div>
            )}
            {down.length === 0 && (
              <div className="res-tip-rule res-bold">
                <span>Total</span>
                <span>{fmt1(total(up, hover))}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
