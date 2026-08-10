import { useState } from 'react';
import type { LoadPoint } from '../lib/heatBalance';

/**
 * Heating and cooling demand over the itinerary — one panel, one axis, because
 * both series are kW.
 *
 * Palette: categorical slot 8 (red) for heating and slot 1 (blue) for cooling,
 * validated against this app's white surface — CVD ΔE 21.6, normal-vision ΔE
 * 32.3, both clear 3:1 contrast. The two never overlap (a timestep is heating
 * or cooling, never both), so identity is carried by position as well as hue.
 */

const HEATING = '#e34948';
const COOLING = '#2a78d6';

const W = 900;
const LEFT = 54;
const RIGHT = 74;
const PLOT_H = 190;
const TOP = 20;
const AXIS_H = 26;
const PLOT_W = W - LEFT - RIGHT;
const H = TOP + PLOT_H + AXIS_H;

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });

export default function LoadChart({ points }: { points: LoadPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  if (points.length < 2) return null;

  const peak = Math.max(
    1,
    ...points.map((p) => Math.max(p.heating, p.cooling)),
  );
  const hi = peak * 1.12;

  const x = (i: number) => LEFT + (i / (points.length - 1)) * PLOT_W;
  const y = (v: number) => TOP + PLOT_H - (v / hi) * PLOT_H;

  const line = (key: 'heating' | 'cooling') =>
    points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`)
      .join(' ');

  const ticks = [0, hi / 2, hi];
  const tickIndices = Array.from({ length: 6 }, (_, i) =>
    Math.round((i / 5) * (points.length - 1)),
  );

  const point = hover !== null ? points[hover] : null;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const f = (svgX - LEFT) / PLOT_W;
    if (f < -0.02 || f > 1.02) return setHover(null);
    setHover(Math.round(Math.min(1, Math.max(0, f)) * (points.length - 1)));
  };

  const onKey = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const base = hover ?? 0;
    setHover(
      Math.max(0, Math.min(points.length - 1, base + (e.key === 'ArrowRight' ? 1 : -1))),
    );
  };

  return (
    <div className="chart">
      <div className="chart-readout" aria-live="polite">
        {point ? (
          <>
            <strong>{fmtTime(point.time)}</strong>
            <span>
              <i className="swatch" style={{ background: HEATING }} /> Heating{' '}
              {point.heating.toFixed(1)} kW
            </span>
            <span>
              <i className="swatch" style={{ background: COOLING }} /> Cooling{' '}
              {point.cooling.toFixed(1)} kW
            </span>
            <span>Ambient {point.airTemp.toFixed(1)} °C</span>
          </>
        ) : (
          <span className="chart-readout-idle">
            Hover the chart — or focus it and use ← → — to read values.
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart-svg"
        role="img"
        aria-label="Heating and cooling demand over the itinerary. Values are listed in the data table below."
        tabIndex={0}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onKeyDown={onKey}
      >
        <text x={LEFT} y={TOP - 6} className="chart-panel-title">
          Vessel demand
          <tspan className="chart-unit"> (kW)</tspan>
        </text>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={LEFT} x2={LEFT + PLOT_W} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={LEFT - 8} y={y(t) + 3.5} className="chart-tick chart-tick-y">
              {t.toFixed(0)}
            </text>
          </g>
        ))}

        <path d={line('heating')} className="chart-line" style={{ stroke: HEATING }} />
        <path d={line('cooling')} className="chart-line" style={{ stroke: COOLING }} />

        {/* Direct labels at the right edge — secondary encoding beside the hue. */}
        <circle cx={LEFT + PLOT_W + 8} cy={y(points.at(-1)!.heating)} r={3.5} fill={HEATING} />
        <text
          x={LEFT + PLOT_W + 16}
          y={y(points.at(-1)!.heating) + 3.5}
          className="chart-direct-label"
        >
          Heating
        </text>
        <circle cx={LEFT + PLOT_W + 8} cy={y(points.at(-1)!.cooling)} r={3.5} fill={COOLING} />
        <text
          x={LEFT + PLOT_W + 16}
          y={y(points.at(-1)!.cooling) + 3.5}
          className="chart-direct-label"
        >
          Cooling
        </text>

        {point && hover !== null && (
          <>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={TOP}
              y2={TOP + PLOT_H}
              className="chart-crosshair"
            />
            <circle cx={x(hover)} cy={y(point.heating)} r={4} fill={HEATING} className="chart-dot" />
            <circle cx={x(hover)} cy={y(point.cooling)} r={4} fill={COOLING} className="chart-dot" />
          </>
        )}

        <line
          x1={LEFT}
          x2={LEFT + PLOT_W}
          y1={TOP + PLOT_H}
          y2={TOP + PLOT_H}
          className="chart-axis"
        />

        {tickIndices.map((i) => (
          <text key={i} x={x(i)} y={H - 8} className="chart-tick" textAnchor="middle">
            {fmtDay(points[i].time)}
          </text>
        ))}
      </svg>

      <div className="chart-footer">
        <div className="chart-legend">
          <span className="legend-item">
            <i className="swatch" style={{ background: HEATING }} /> Heating demand
          </span>
          <span className="legend-item">
            <i className="swatch" style={{ background: COOLING }} /> Cooling demand
          </span>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          aria-expanded={showTable}
          onClick={() => setShowTable((v) => !v)}
        >
          {showTable ? 'Hide data table' : 'Show data table'}
        </button>
      </div>

      {showTable && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Ambient °C</th>
                <th scope="col">Heating kW</th>
                <th scope="col">Cooling kW</th>
                <th scope="col">Transmission kW</th>
                <th scope="col">Ventilation kW</th>
                <th scope="col">Internal kW</th>
                <th scope="col">Solar kW</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.time}>
                  <td>{fmtTime(p.time)}</td>
                  <td>{p.airTemp.toFixed(1)}</td>
                  <td>{p.heating.toFixed(1)}</td>
                  <td>{p.cooling.toFixed(1)}</td>
                  <td>{p.transmission.toFixed(1)}</td>
                  <td>{p.ventilation.toFixed(1)}</td>
                  <td>{p.internal.toFixed(1)}</td>
                  <td>{p.solar.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
