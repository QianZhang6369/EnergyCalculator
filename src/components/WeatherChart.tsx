import { useMemo, useState } from 'react';
import type { WeatherPoint } from '../types';

/**
 * Weather profile as small multiples over a shared time axis.
 *
 * Stacked panels rather than one plot with several y-scales: a dual-axis chart
 * invents a correlation between measures that do not share units. Temperature
 * keeps two series on one axis because both are °C.
 *
 * One colour per measured item, from categorical slots 1–4. Validated all-pairs
 * against this app's white surface: worst CVD ΔE 13.0, worst normal-vision ΔE
 * 19.6. Humidity and solar sit below 3:1 contrast, so the relief rule applies —
 * every panel is titled and the data table carries every value.
 */
const AIR = '#2a78d6';
const SEA = '#008300';
const HUMIDITY = '#e87ba4';
const SOLAR = '#eda100';

interface PanelSpec {
  title: string;
  unit: string;
  series: { key: keyof WeatherPoint; label: string; color: string }[];
}

const PANELS: PanelSpec[] = [
  {
    title: 'Temperature',
    unit: '°C',
    series: [
      { key: 'airTemp', label: 'Air', color: AIR },
      { key: 'seawaterTemp', label: 'Seawater', color: SEA },
    ],
  },
  {
    title: 'Relative humidity',
    unit: '%',
    series: [{ key: 'relativeHumidity', label: 'Relative humidity', color: HUMIDITY }],
  },
  {
    title: 'Solar radiation',
    unit: 'W/m²',
    series: [{ key: 'solarRadiation', label: 'Solar radiation', color: SOLAR }],
  },
];

const W = 900;
const LEFT = 48;
const RIGHT = 78;
const PANEL_H = 116;
const PANEL_GAP = 30;
const TOP = 22;
const AXIS_H = 26;
const PLOT_W = W - LEFT - RIGHT;
const H = TOP + PANELS.length * PANEL_H + (PANELS.length - 1) * PANEL_GAP + AXIS_H;

const niceBounds = (values: number[]) => {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (lo === hi) return { lo: lo - 1, hi: hi + 1 };
  const pad = (hi - lo) * 0.15;
  return { lo: lo - pad, hi: hi + pad };
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });

export default function WeatherChart({ series }: { series: WeatherPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const panels = useMemo(
    () =>
      PANELS.map((panel) => {
        const values = panel.series.flatMap((s) =>
          series.map((p) => p[s.key] as number),
        );
        return { ...panel, ...niceBounds(values) };
      }),
    [series],
  );

  if (series.length < 2) return null;

  const x = (i: number) => LEFT + (i / (series.length - 1)) * PLOT_W;
  const panelTop = (index: number) => TOP + index * (PANEL_H + PANEL_GAP);

  // Six evenly spaced x ticks.
  const tickIndices = Array.from({ length: 6 }, (_, i) =>
    Math.round((i / 5) * (series.length - 1)),
  );

  const active = hover ?? null;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const f = (svgX - LEFT) / PLOT_W;
    if (f < -0.02 || f > 1.02) return setHover(null);
    setHover(Math.round(clamp01(f) * (series.length - 1)));
  };

  const onKey = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const base = active ?? 0;
    setHover(Math.max(0, Math.min(series.length - 1, base + (e.key === 'ArrowRight' ? 1 : -1))));
  };

  const point = active !== null ? series[active] : null;

  return (
    <div className="chart">
      <div className="chart-readout" aria-live="polite">
        {point ? (
          <>
            <strong>{fmtTime(point.time)}</strong>
            <span>
              <i className="swatch" style={{ background: AIR }} /> Air{' '}
              {point.airTemp.toFixed(1)} °C
            </span>
            <span>
              <i className="swatch" style={{ background: SEA }} /> Seawater{' '}
              {point.seawaterTemp.toFixed(1)} °C
            </span>
            <span>
              <i className="swatch" style={{ background: HUMIDITY }} /> RH{' '}
              {point.relativeHumidity} %
            </span>
            <span>
              <i className="swatch" style={{ background: SOLAR }} /> Solar{' '}
              {point.solarRadiation} W/m²
            </span>
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
        aria-label="Weather profile over the itinerary. Values are listed in the data table below."
        tabIndex={0}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onKeyDown={onKey}
      >
        {panels.map((panel, pi) => {
          const top = panelTop(pi);
          const bottom = top + PANEL_H;
          const y = (v: number) =>
            bottom - ((v - panel.lo) / (panel.hi - panel.lo)) * PANEL_H;
          const ticks = [panel.lo, (panel.lo + panel.hi) / 2, panel.hi];

          return (
            <g key={panel.title}>
              <text x={LEFT} y={top - 6} className="chart-panel-title">
                {panel.title}
                <tspan className="chart-unit"> ({panel.unit})</tspan>
              </text>

              {ticks.map((t) => (
                <g key={t}>
                  <line
                    x1={LEFT}
                    x2={LEFT + PLOT_W}
                    y1={y(t)}
                    y2={y(t)}
                    className="chart-grid"
                  />
                  <text x={LEFT - 8} y={y(t) + 3.5} className="chart-tick chart-tick-y">
                    {t.toFixed(t > 100 ? 0 : 1)}
                  </text>
                </g>
              ))}

              {panel.series.map((s) => {
                const d = series
                  .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p[s.key] as number).toFixed(1)}`)
                  .join(' ');
                const lastValue = series[series.length - 1][s.key] as number;
                // Direct labels only where two series share an axis — secondary
                // encoding beside the hue. A lone series is named by the panel
                // title, so labelling it again is noise (and overflows the box).
                const labelled = panel.series.length > 1;
                return (
                  <g key={String(s.key)}>
                    <path d={d} className="chart-line" style={{ stroke: s.color }} />
                    {labelled && (
                      <>
                        <circle
                          cx={LEFT + PLOT_W + 8}
                          cy={y(lastValue)}
                          r={3.5}
                          fill={s.color}
                        />
                        <text
                          x={LEFT + PLOT_W + 16}
                          y={y(lastValue) + 3.5}
                          className="chart-direct-label"
                        >
                          {s.label}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}

              {point && active !== null && (
                <>
                  <line
                    x1={x(active)}
                    x2={x(active)}
                    y1={top}
                    y2={bottom}
                    className="chart-crosshair"
                  />
                  {panel.series.map((s) => (
                    <circle
                      key={String(s.key)}
                      cx={x(active)}
                      cy={y(point[s.key] as number)}
                      r={4}
                      fill={s.color}
                      className="chart-dot"
                    />
                  ))}
                </>
              )}

              <line
                x1={LEFT}
                x2={LEFT + PLOT_W}
                y1={bottom}
                y2={bottom}
                className="chart-axis"
              />
            </g>
          );
        })}

        {tickIndices.map((i) => (
          <text key={i} x={x(i)} y={H - 8} className="chart-tick" textAnchor="middle">
            {fmtDay(series[i].time)}
          </text>
        ))}
      </svg>

      <div className="chart-footer">
        <div className="chart-legend">
          <span className="legend-item">
            <i className="swatch" style={{ background: AIR }} /> Air temperature
          </span>
          <span className="legend-item">
            <i className="swatch" style={{ background: SEA }} /> Seawater temperature
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
                <th scope="col">Lat</th>
                <th scope="col">Lon</th>
                <th scope="col">Air °C</th>
                <th scope="col">Sea °C</th>
                <th scope="col">RH %</th>
                <th scope="col">Solar W/m²</th>
              </tr>
            </thead>
            <tbody>
              {series.map((p) => (
                <tr key={p.time}>
                  <td>{fmtTime(p.time)}</td>
                  <td>{p.lat.toFixed(2)}</td>
                  <td>{p.lon.toFixed(2)}</td>
                  <td>{p.airTemp.toFixed(1)}</td>
                  <td>{p.seawaterTemp.toFixed(1)}</td>
                  <td>{p.relativeHumidity}</td>
                  <td>{p.solarRadiation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
