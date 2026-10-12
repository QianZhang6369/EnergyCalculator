import { useMemo } from 'react';
import type { ZoneHourPoint } from '../../lib/loadCalc';

interface Props {
  hourly: ZoneHourPoint[];
  recirc: boolean;
}

const W = 760;
const H = 240;
const PAD = { top: 16, right: 44, bottom: 26, left: 44 };
const innerW = W - PAD.left - PAD.right;
const innerH = H - PAD.top - PAD.bottom;

const SENSIBLE = '#2563eb';
const DUTY = '#f59e0b';
const OUTDOOR = '#94a3b8';

const pathFrom = (values: number[], xOf: (i: number) => number, yOf: (v: number) => number) =>
  values.map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');

/**
 * Every hour of one room group: its sensible load and the terminal duty in kW
 * on the left scale, the outdoor temperature on the right one.
 */
export default function HourlyChart({ hourly, recirc }: Props) {
  const chart = useMemo(() => {
    const n = hourly.length;
    if (n === 0) return null;
    const sensible = hourly.map((h) => h.sensible_kW);
    const duty = hourly.map((h) => (recirc ? h.coilCooling_kW : h.reheat_kW));
    const temp = hourly.map((h) => h.tOut_C);

    // Reduced by hand: spreading 8760 values into Math.min overflows the stack
    // in some browsers.
    let kwMin = 0;
    let kwMax = 0;
    let tMin = Infinity;
    let tMax = -Infinity;
    for (let i = 0; i < n; i += 1) {
      kwMin = Math.min(kwMin, sensible[i], duty[i]);
      kwMax = Math.max(kwMax, sensible[i], duty[i]);
      tMin = Math.min(tMin, temp[i]);
      tMax = Math.max(tMax, temp[i]);
    }

    const xOf = (i: number) => PAD.left + (n === 1 ? 0 : (i / (n - 1)) * innerW);
    const kwPad = (kwMax - kwMin) * 0.05 || 1;
    const yKw = (v: number) =>
      PAD.top + innerH - ((v - (kwMin - kwPad)) / (kwMax + kwPad - (kwMin - kwPad))) * innerH;
    const tPad = (tMax - tMin) * 0.05 || 1;
    const yT = (v: number) =>
      PAD.top + innerH - ((v - (tMin - tPad)) / (tMax + tPad - (tMin - tPad))) * innerH;

    return {
      n,
      sensiblePath: pathFrom(sensible, xOf, yKw),
      dutyPath: pathFrom(duty, xOf, yKw),
      tempPath: pathFrom(temp, xOf, yT),
      zeroY: yKw(0),
      kwMin,
      kwMax,
      tMin,
      tMax,
    };
  }, [hourly, recirc]);

  if (!chart) return null;

  return (
    <div className="res-hourly">
      <ul className="res-legend">
        <Legend color={SENSIBLE} label="Group sensible (kW)" />
        <Legend color={DUTY} label={recirc ? 'Coil cooling (kW)' : 'CBU reheat (kW)'} />
        <Legend color={OUTDOOR} label="Outdoor °C" dashed />
      </ul>
      <div className="res-hourly-scroll">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Hourly group sensible load, duty and outdoor temperature"
        >
          <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH} className="res-frame" />
          <line
            x1={PAD.left}
            x2={PAD.left + innerW}
            y1={chart.zeroY}
            y2={chart.zeroY}
            className="res-zero"
          />
          <path d={chart.tempPath} fill="none" stroke={OUTDOOR} strokeWidth={1} strokeDasharray="4 3" />
          <path d={chart.sensiblePath} fill="none" stroke={SENSIBLE} strokeWidth={1.2} />
          <path d={chart.dutyPath} fill="none" stroke={DUTY} strokeWidth={1.2} />
          <text x={4} y={PAD.top + 8} className="chart-tick">
            {chart.kwMax.toFixed(0)}
          </text>
          <text x={4} y={PAD.top + innerH} className="chart-tick">
            {chart.kwMin.toFixed(0)}
          </text>
          <text x={W - PAD.right + 6} y={PAD.top + 8} className="chart-tick">
            {chart.tMax.toFixed(0)}°
          </text>
          <text x={W - PAD.right + 6} y={PAD.top + innerH} className="chart-tick">
            {chart.tMin.toFixed(0)}°
          </text>
          <text x={PAD.left} y={H - 8} className="chart-tick">
            hour 1
          </text>
          <text x={PAD.left + innerW} y={H - 8} textAnchor="end" className="chart-tick">
            hour {chart.n}
          </text>
        </svg>
      </div>
    </div>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <li>
      <svg width={18} height={8} aria-hidden="true">
        <line
          x1={0}
          y1={4}
          x2={18}
          y2={4}
          stroke={color}
          strokeWidth={2}
          strokeDasharray={dashed ? '4 3' : undefined}
        />
      </svg>
      {label}
    </li>
  );
}
