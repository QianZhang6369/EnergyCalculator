import { useMemo, useRef, useState } from 'react';

/**
 * Stacked time-series panels over a shared x axis, with drag-to-zoom.
 *
 * A year of hourly data is far more points than pixels, so the visible slice is
 * bucketed down to at most `MAX_POINTS` before drawing. Load panels aggregate by
 * MAX so peaks survive zooming out — a mean would flatten exactly the moments
 * the plant is sized for. Weather panels aggregate by MEAN, which is the honest
 * summary for a continuous condition.
 *
 * Separate panels rather than one plot with several y-scales: measures with
 * different units never share an axis.
 */

const MAX_POINTS = 700;

export interface ChartSeries {
  label: string;
  color: string;
  values: number[];
}

export interface ChartPanel {
  title: string;
  unit: string;
  series: ChartSeries[];
  aggregate: 'max' | 'mean';
}

interface Props {
  times: string[];
  panels: ChartPanel[];
  range: [number, number];
  onRangeChange: (range: [number, number]) => void;
}

const W = 960;
const LEFT = 54;
const RIGHT = 86;
const PANEL_H = 104;
const PANEL_GAP = 30;
const TOP = 22;
const AXIS_H = 26;
const PLOT_W = W - LEFT - RIGHT;

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const fmtTick = (iso: string, span: number) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: span > 24 * 40 ? undefined : '2-digit',
    month: 'short',
    year: span > 24 * 300 ? '2-digit' : undefined,
  });

export default function ProfileChart({ times, panels, range, onRangeChange }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const dragRef = useRef<{ from: number; to: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [lo, hi] = range;
  const span = Math.max(1, hi - lo);
  const bucketSize = Math.max(1, Math.ceil(span / MAX_POINTS));

  const view = useMemo(() => {
    const buckets: number[] = [];
    for (let i = lo; i < hi; i += bucketSize) buckets.push(i);

    const reduce = (values: number[], mode: 'max' | 'mean') =>
      buckets.map((startIdx) => {
        const end = Math.min(hi, startIdx + bucketSize);
        let acc = mode === 'max' ? -Infinity : 0;
        for (let i = startIdx; i < end; i += 1) {
          const v = values[i] ?? 0;
          if (mode === 'max') acc = Math.max(acc, v);
          else acc += v;
        }
        return mode === 'max' ? acc : acc / Math.max(1, end - startIdx);
      });

    return {
      buckets,
      times: buckets.map((i) => times[i]),
      panels: panels.map((panel) => {
        const series = panel.series.map((s) => ({
          ...s,
          points: reduce(s.values, panel.aggregate),
        }));
        const all = series.flatMap((s) => s.points);
        const min = Math.min(...all);
        const max = Math.max(...all);
        const pad = (max - min) * 0.15 || 1;
        return { ...panel, series, lo: min - pad, hi: max + pad };
      }),
    };
  }, [times, panels, lo, hi, bucketSize]);

  const n = view.buckets.length;
  const H = TOP + panels.length * PANEL_H + (panels.length - 1) * PANEL_GAP + AXIS_H;

  if (n < 2) return null;

  const x = (i: number) => LEFT + (i / (n - 1)) * PLOT_W;
  const panelTop = (index: number) => TOP + index * (PANEL_H + PANEL_GAP);

  const indexAt = (clientX: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * W;
    const f = (svgX - LEFT) / PLOT_W;
    return Math.round(Math.min(1, Math.max(0, f)) * (n - 1));
  };

  // The drag lives in a ref as well as state: several mouse events can land
  // inside one frame, and a handler reading `drag` from its render closure would
  // still see the value from before the drag started — losing a fast flick.
  const onDown = (e: React.MouseEvent) => {
    const i = indexAt(e.clientX);
    dragRef.current = { from: i, to: i };
    setDrag(dragRef.current);
  };

  const onMove = (e: React.MouseEvent) => {
    const i = indexAt(e.clientX);
    if (dragRef.current) {
      dragRef.current = { ...dragRef.current, to: i };
      setDrag(dragRef.current);
    } else {
      setHover(i);
    }
  };

  const onUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (d && Math.abs(d.to - d.from) >= 2) {
      const a = Math.min(d.from, d.to);
      const b = Math.max(d.from, d.to);
      onRangeChange([lo + a * bucketSize, Math.min(hi, lo + (b + 1) * bucketSize)]);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const base = hover ?? 0;
    setHover(Math.max(0, Math.min(n - 1, base + (e.key === 'ArrowRight' ? 1 : -1))));
  };

  const tickCount = 6;
  const tickIndices = Array.from({ length: tickCount }, (_, i) =>
    Math.round((i / (tickCount - 1)) * (n - 1)),
  );

  const hoveredTime = hover !== null ? view.times[hover] : null;

  return (
    <div className="chart">
      <div className="chart-readout" aria-live="polite">
        {hoveredTime ? (
          <>
            <strong>{fmtTime(hoveredTime)}</strong>
            {view.panels.flatMap((panel) =>
              panel.series.map((s) => (
                <span key={panel.title + s.label}>
                  <i className="swatch" style={{ background: s.color }} />
                  {s.label} {s.points[hover!]?.toFixed(1)} {panel.unit}
                </span>
              )),
            )}
          </>
        ) : (
          <span className="chart-readout-idle">
            Hover to read values · drag across the chart to zoom into a period
          </span>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="chart-svg"
        role="img"
        aria-label="Profile over the selected period. Values are listed in the data table."
        tabIndex={0}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={() => {
          setHover(null);
          dragRef.current = null;
          setDrag(null);
        }}
        onKeyDown={onKey}
      >
        {view.panels.map((panel, pi) => {
          const top = panelTop(pi);
          const bottom = top + PANEL_H;
          const y = (v: number) =>
            bottom - ((v - panel.lo) / (panel.hi - panel.lo || 1)) * PANEL_H;
          const ticks = [panel.lo, (panel.lo + panel.hi) / 2, panel.hi];

          return (
            <g key={panel.title}>
              <text x={LEFT} y={top - 6} className="chart-panel-title">
                {panel.title}
                <tspan className="chart-unit"> ({panel.unit})</tspan>
              </text>

              {ticks.map((t) => (
                <g key={t}>
                  <line x1={LEFT} x2={LEFT + PLOT_W} y1={y(t)} y2={y(t)} className="chart-grid" />
                  <text x={LEFT - 8} y={y(t) + 3.5} className="chart-tick chart-tick-y">
                    {Math.abs(t) >= 100 ? t.toFixed(0) : t.toFixed(1)}
                  </text>
                </g>
              ))}

              {panel.series.map((s) => (
                <g key={s.label}>
                  <path
                    d={s.points
                      .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
                      .join(' ')}
                    className="chart-line"
                    style={{ stroke: s.color }}
                  />
                  {panel.series.length > 1 && (
                    <>
                      <circle
                        cx={LEFT + PLOT_W + 8}
                        cy={y(s.points[s.points.length - 1])}
                        r={3.5}
                        fill={s.color}
                      />
                      <text
                        x={LEFT + PLOT_W + 16}
                        y={y(s.points[s.points.length - 1]) + 3.5}
                        className="chart-direct-label"
                      >
                        {s.label}
                      </text>
                    </>
                  )}
                </g>
              ))}

              {drag && (
                <rect
                  x={Math.min(x(drag.from), x(drag.to))}
                  y={top}
                  width={Math.abs(x(drag.to) - x(drag.from))}
                  height={PANEL_H}
                  className="chart-brush"
                />
              )}

              {hover !== null && !drag && (
                <>
                  <line
                    x1={x(hover)}
                    x2={x(hover)}
                    y1={top}
                    y2={bottom}
                    className="chart-crosshair"
                  />
                  {panel.series.map((s) => (
                    <circle
                      key={s.label}
                      cx={x(hover)}
                      cy={y(s.points[hover])}
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
            {view.times[i] ? fmtTick(view.times[i], span) : ''}
          </text>
        ))}
      </svg>
    </div>
  );
}
