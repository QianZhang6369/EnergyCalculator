import { useState } from 'react';
import { MONTH_NAMES, getRegion, type AnnualPlan, type RegionId } from '../data/regions';
import type { MonthlyMeans } from '../lib/weather';

/**
 * Monthly means over the planned year, as small multiples on a shared month
 * axis: temperature, relative humidity and solar radiation each keep their own
 * scale rather than sharing one plot with several y-axes.
 *
 * The lines are drawn in ink; colour is reserved for the region, shown as the
 * band above the charts, the tint behind them and the dots on each line.
 */

interface Props {
  plan: AnnualPlan;
  means: MonthlyMeans[];
  colors: Map<RegionId, string>;
}

type MeanKey = 'airTemp' | 'seawaterTemp' | 'relativeHumidity' | 'solarRadiation';

const W = 960;
const LEFT = 44;
const RIGHT = 12;
const PLOT_W = W - LEFT - RIGHT;
const BAND_W = PLOT_W / 12;
/** Region names and the colour band sit above the first panel. */
const HEADER_H = 50;
const TITLE_H = 26;
const PANEL_GAP = 14;
const AXIS_H = 30;

/** Rough width of a 12px semibold label, to decide whether it fits its span. */
const labelWidth = (text: string) => text.length * 6.9;

const fmt = (v: number, digits = 1) => v.toFixed(digits).replace('-', '−');

const x = (month: number) => LEFT + BAND_W * (month + 0.5);

/** Consecutive months with the same region, January to December. */
function runs(plan: AnnualPlan) {
  const out: { id: RegionId; from: number; to: number }[] = [];
  plan.forEach((id, m) => {
    const last = out[out.length - 1];
    if (last && last.id === id) last.to = m;
    else out.push({ id, from: m, to: m });
  });
  return out;
}

export default function YearPreviewChart({ plan, means, colors }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  const range = (keys: MeanKey[]) => {
    const values = means.flatMap((s) => keys.map((k) => s[k]));
    return [Math.min(...values), Math.max(...values)];
  };
  const [tLo, tHi] = range(['airTemp', 'seawaterTemp']);
  const tStep = tHi - tLo > 22 ? 10 : 5;
  const [hLo, hHi] = range(['relativeHumidity']);
  const [, sHi] = range(['solarRadiation']);
  const sStep = sHi > 240 ? 100 : 50;

  let top = HEADER_H;
  const panels = [
    {
      title: 'Temperature',
      unit: '°C',
      height: 170,
      step: tStep,
      lo: Math.floor((tLo - 3) / tStep) * tStep,
      hi: Math.ceil((tHi + 3) / tStep) * tStep,
    },
    {
      title: 'Relative humidity',
      unit: '%',
      height: 96,
      step: 10,
      lo: Math.floor((hLo - 4) / 10) * 10,
      hi: Math.ceil((hHi + 4) / 10) * 10,
    },
    {
      title: 'Solar radiation',
      unit: 'W/m², monthly mean',
      height: 110,
      step: sStep,
      lo: 0,
      hi: Math.max(sStep, Math.ceil((sHi * 1.2) / sStep) * sStep),
    },
  ].map((spec) => {
    const panelTop = top + TITLE_H;
    const bottom = panelTop + spec.height;
    top = bottom + PANEL_GAP;
    const ticks: number[] = [];
    for (let v = spec.lo; v <= spec.hi + 0.01; v += spec.step) ticks.push(v);
    return {
      ...spec,
      top: panelTop,
      bottom,
      ticks,
      y: (v: number) => bottom - ((v - spec.lo) / (spec.hi - spec.lo)) * spec.height,
    };
  });
  const [temp, humidity, solar] = panels;
  const H = solar.bottom + AXIS_H;

  const colorAt = (month: number) => colors.get(plan[month]) ?? '#6f7d8c';
  const path = (panel: (typeof panels)[number], key: MeanKey) =>
    means.map((s, m) => `${m ? 'L' : 'M'}${x(m).toFixed(1)} ${panel.y(s[key]).toFixed(1)}`).join('');
  const dots = (panel: (typeof panels)[number], key: MeanKey) =>
    means.map((s, m) => (
      <circle key={m} className="chart-dot" cx={x(m)} cy={panel.y(s[key])} r={5} fill={colorAt(m)} />
    ));

  // Direct labels on the extremes only; the tooltip and tiles carry the rest.
  const warmest = means.reduce((a, s, m) => (s.airTemp > means[a].airTemp ? m : a), 0);
  const coldest = means.reduce((a, s, m) => (s.airTemp < means[a].airTemp ? m : a), 0);
  const sunniest = means.reduce((a, s, m) => (s.solarRadiation > means[a].solarRadiation ? m : a), 0);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    setHover(Math.min(11, Math.max(0, Math.floor((svgX - LEFT) / BAND_W))));
  };

  const onKey = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const base = hover ?? 0;
    setHover(Math.min(11, Math.max(0, base + (e.key === 'ArrowRight' ? 1 : -1))));
  };

  const point = hover !== null ? means[hover] : null;

  return (
    <div className="chart year-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart-svg"
        role="img"
        aria-label="Monthly mean temperature, relative humidity and solar radiation through the year, with the active region shown above each month."
        tabIndex={0}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        onKeyDown={onKey}
      >
        {runs(plan).map((run) => {
          const region = getRegion(run.id);
          const color = colors.get(run.id) ?? '#6f7d8c';
          const x0 = LEFT + run.from * BAND_W;
          const w = (run.to - run.from + 1) * BAND_W;
          const label =
            labelWidth(region.name) <= w - 8 ? region.name : labelWidth(region.code) <= w - 6 ? region.code : '';
          return (
            <g key={run.from}>
              {panels.map((p) => (
                <rect key={p.title} x={x0} y={p.top} width={w} height={p.height} fill={color} opacity={0.07} />
              ))}
              <rect x={x0 + 1} y={30} width={Math.max(2, w - 2)} height={8} rx={4} fill={color} />
              {label && (
                <text x={x0 + w / 2} y={22} className="year-chart-span" textAnchor="middle">
                  {label}
                </text>
              )}
            </g>
          );
        })}

        {panels.map((p) => (
          <g key={p.title}>
            <text x={LEFT} y={p.top - 9} className="chart-panel-title">
              {p.title}
              <tspan className="chart-unit"> ({p.unit})</tspan>
            </text>
            {p.ticks.map((t) => (
              <g key={t}>
                <line
                  x1={LEFT}
                  x2={LEFT + PLOT_W}
                  y1={p.y(t)}
                  y2={p.y(t)}
                  className={t === p.lo ? 'chart-axis' : 'chart-grid'}
                />
                <text x={LEFT - 8} y={p.y(t) + 3.5} className="chart-tick chart-tick-y">
                  {fmt(t, 0)}
                </text>
              </g>
            ))}
          </g>
        ))}

        {MONTH_NAMES.map((name, m) => (
          <text key={name} x={x(m)} y={solar.bottom + 18} className="chart-tick" textAnchor="middle">
            {name.slice(0, 3)}
          </text>
        ))}

        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={temp.top} y2={solar.bottom} className="chart-crosshair" />
        )}

        <path d={path(temp, 'seawaterTemp')} className="chart-line year-chart-sea" />
        <path d={path(temp, 'airTemp')} className="chart-line year-chart-main" />
        {dots(temp, 'airTemp')}
        <text x={x(warmest)} y={temp.y(means[warmest].airTemp) - 11} className="year-chart-value" textAnchor="middle">
          {fmt(means[warmest].airTemp)}°
        </text>
        {coldest !== warmest && (
          <text x={x(coldest)} y={temp.y(means[coldest].airTemp) + 19} className="year-chart-value" textAnchor="middle">
            {fmt(means[coldest].airTemp)}°
          </text>
        )}

        <path d={path(humidity, 'relativeHumidity')} className="chart-line year-chart-main" />
        {dots(humidity, 'relativeHumidity')}

        <path d={path(solar, 'solarRadiation')} className="chart-line year-chart-main" />
        {dots(solar, 'solarRadiation')}
        <text
          x={x(sunniest)}
          y={solar.y(means[sunniest].solarRadiation) - 11}
          className="year-chart-value"
          textAnchor="middle"
        >
          {fmt(means[sunniest].solarRadiation, 0)}
        </text>
      </svg>

      {point && hover !== null && (
        <div
          className="year-chart-tip"
          style={
            hover < 6
              ? { left: `calc(${(x(hover) / W) * 100}% + 14px)` }
              : { right: `calc(${((W - x(hover)) / W) * 100}% + 14px)` }
          }
        >
          <strong>{MONTH_NAMES[hover]}</strong>
          <span className="year-chart-tip-region">
            <i className="swatch" style={{ background: colorAt(hover) }} />
            {getRegion(plan[hover]).name}
          </span>
          <dl>
            <div>
              <dt>Air</dt>
              <dd>{fmt(point.airTemp)} °C</dd>
            </div>
            <div>
              <dt>Range</dt>
              <dd>
                {fmt(point.airTempLow)} to {fmt(point.airTempHigh)} °C
              </dd>
            </div>
            <div>
              <dt>Seawater</dt>
              <dd>{fmt(point.seawaterTemp)} °C</dd>
            </div>
            <div>
              <dt>Humidity</dt>
              <dd>{fmt(point.relativeHumidity, 0)} %</dd>
            </div>
            <div>
              <dt>Solar</dt>
              <dd>{fmt(point.solarRadiation, 0)} W/m²</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
