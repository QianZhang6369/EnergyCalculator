import type { SystemLayoutId } from '../../types';

/**
 * Simplified schematic of each system configuration.
 *
 * The four chilled-water configurations share one drawing — producer and
 * consumer as boxes, pump in the producer leg, control valve in the consumer
 * return — following the standard hydraulic circuit convention:
 *
 *   throttling circuit  two-way valve, variable-speed pump, no bypass
 *   diverting circuit   three-way valve, fixed-speed pump, bypass off the
 *                       supply riser into the valve's third port
 *
 * Colours follow this app's chilled-water convention rather than the heating
 * convention used on most textbook versions of these diagrams: blue is the cold
 * supply leaving the chiller, red the warm return.
 *
 * TEMS is a block flow rather than a circuit, because what matters there is
 * where the heat goes, not the pipework.
 */

const W = 520;
const H = 300;

/* ---------- primitives ---------- */

/** Fixed-speed pump. */
const Pump = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle r="13" className="sch-component" />
    <path d="M -5 -7 L 8 0 L -5 7 Z" className="sch-fill" />
  </g>
);

/** Variable-speed pump — circle crossed by the adjustment arrow. */
const VariablePump = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle r="13" className="sch-component" />
    <line x1="-9" y1="0" x2="9" y2="0" className="sch-line" />
    <line x1="-17" y1="17" x2="15" y2="-15" className="sch-line" />
    <path d="M 17 -17 L 7 -14 L 14 -7 Z" className="sch-fill" />
  </g>
);

const MotorActuator = ({ x, y }: { x: number; y: number }) => (
  <g>
    <line x1={x + 11} y1={y} x2={x + 23} y2={y} className="sch-line" />
    <circle cx={x + 36} cy={y} r="13" className="sch-actuator" />
    <text x={x + 36} y={y + 4} textAnchor="middle" className="sch-actuator-text">
      M
    </text>
  </g>
);

/** Two-way valve, flow passing top to bottom. */
const ThrottlingValve = ({ x, y }: { x: number; y: number }) => (
  <g>
    <g transform={`translate(${x} ${y})`} className="sch-valve-solid">
      <path d="M -11 -13 L 11 -13 L 0 0 Z" />
      <path d="M -11 13 L 11 13 L 0 0 Z" />
    </g>
    <MotorActuator x={x} y={y} />
  </g>
);

/** Three-way valve, flow top to bottom with the third port on the left. */
const DivertingValve = ({ x, y }: { x: number; y: number }) => (
  <g>
    <g transform={`translate(${x} ${y})`} className="sch-valve-solid">
      <path d="M -11 -13 L 11 -13 L 0 0 Z" />
      <path d="M -11 13 L 11 13 L 0 0 Z" />
      <path d="M -13 -11 L -13 11 L 0 0 Z" />
    </g>
    <MotorActuator x={x} y={y} />
  </g>
);

const Defs = () => (
  <defs>
    <marker
      id="flow-arrow"
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth="5"
      markerHeight="5"
      orient="auto"
    >
      <path d="M 0 0 L 10 5 L 0 10 z" className="sch-fill" />
    </marker>
  </defs>
);

/* ---------- chilled water circuits ---------- */

interface CircuitProps {
  mode: 'throttling' | 'diverting';
  freeCooling: boolean;
}

const HydraulicCircuit = ({ mode, freeCooling }: CircuitProps) => {
  const diverting = mode === 'diverting';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="system-schematic" role="img" aria-hidden="true">
      <Defs />
      <g transform={`translate(${freeCooling ? -8 : 38} 0)`}>
        {/* supply riser, producer -> consumer (cold) */}
        <path className="sch-pipe sch-supply" d="M172 224 V 86" />
        {/* consumer return, down to the valve and on to the producer (warm) */}
        <path className="sch-pipe sch-return" d="M282 86 V 147" />
        <path className="sch-pipe sch-return" d="M282 173 V 224" />

        {diverting && (
          <>
            {/* bypass off the supply riser into the valve's third port */}
            <path className="sch-pipe sch-supply" d="M172 160 H 269" />
            <text x="186" y="152" className="sch-label sch-label-small">
              bypass
            </text>
          </>
        )}

        {diverting ? (
          <DivertingValve x={282} y={160} />
        ) : (
          <ThrottlingValve x={282} y={160} />
        )}

        {diverting ? <Pump x={172} y={200} /> : <VariablePump x={172} y={200} />}

        <rect x="140" y="40" width="170" height="46" rx="4" className="sch-component" />
        <text x="225" y="60" textAnchor="middle" className="sch-label sch-label-strong">
          CONSUMER
        </text>
        <text x="225" y="76" textAnchor="middle" className="sch-label sch-label-small">
          AHU coil
        </text>

        <rect x="140" y="224" width="170" height="46" rx="4" className="sch-component" />
        <text x="225" y="244" textAnchor="middle" className="sch-label sch-label-strong">
          PRODUCER
        </text>
        <text x="225" y="260" textAnchor="middle" className="sch-label sch-label-small">
          chiller
        </text>

        {freeCooling && (
          <>
            <path className="sch-pipe sch-return" d="M310 246 H 350" />
            <rect x="350" y="224" width="92" height="44" rx="3" className="sch-component" />
            <path d="M358 230 l76 32 M358 262 l76 -32" className="sch-coil" />
            <text x="396" y="218" textAnchor="middle" className="sch-label sch-label-small">
              free-cooling HX
            </text>
            <g className="sch-pipe sch-seawater">
              <path d="M372 268 V 280" />
              <path d="M420 268 V 280" />
            </g>
            <text
              x="396"
              y="292"
              textAnchor="middle"
              className="sch-label sch-label-small sch-seawater-text"
            >
              seawater
            </text>
          </>
        )}

        <text
          x="164"
          y="116"
          textAnchor="end"
          className="sch-label sch-label-small sch-supply-text"
        >
          supply
        </text>
        <text x="292" y="112" className="sch-label sch-label-small sch-return-text">
          return
        </text>
      </g>
    </svg>
  );
};

/* ---------- simplified chiller ---------- */

/** The chiller as the calculation sees it: cooling out, electricity in, no hydraulics. */
const SimplifiedChiller = () => (
  <svg viewBox={`0 0 ${W} ${H}`} className="system-schematic" role="img" aria-hidden="true">
    <Defs />
    <path className="sch-pipe sch-supply" d="M172 224 V 86" />
    <path className="sch-pipe sch-return" d="M282 86 V 224" />

    <rect x="140" y="40" width="170" height="46" rx="4" className="sch-component" />
    <text x="225" y="60" textAnchor="middle" className="sch-label sch-label-strong">
      COOLING LOAD
    </text>
    <text x="225" y="76" textAnchor="middle" className="sch-label sch-label-small">
      AHU coils + terminals
    </text>

    <rect x="140" y="224" width="170" height="46" rx="4" className="sch-component" />
    <text x="225" y="244" textAnchor="middle" className="sch-label sch-label-strong">
      CHILLER
    </text>
    <text x="225" y="260" textAnchor="middle" className="sch-label sch-label-small">
      fixed COP
    </text>

    <line x1="400" y1="247" x2="314" y2="247" className="sch-line" markerEnd="url(#flow-arrow)" />
    <text x="408" y="243" className="sch-label sch-label-strong">
      Electricity
    </text>
    <text x="408" y="259" className="sch-label sch-label-small">
      cooling load ÷ COP
    </text>

    <text x="164" y="160" textAnchor="end" className="sch-label sch-label-small sch-supply-text">
      supply
    </text>
    <text x="292" y="160" className="sch-label sch-label-small sch-return-text">
      return
    </text>
  </svg>
);

/* ---------- TEMS plant diagram ---------- */

const TW = 1000;
const TH = 520;

/** Motor-driven pump, as drawn on the reference. */
const MiniPump = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x="-11" y="-16" width="22" height="13" rx="1.5" className="tems-motor" />
    <rect x="-7" y="-3" width="14" height="11" rx="1.5" className="tems-pumpbody" />
  </g>
);

/** Buffer vessel — hot at the top, cold at the bottom. */
const BufferTank = ({ x, y }: { x: number; y: number }) => (
  <rect x={x} y={y} width="46" height="104" rx="23" fill="url(#tank-grad)" stroke="#2c6ea8" strokeWidth="1.5" />
);

/** Plate heat exchanger, drawn as the reference's split parallelogram. */
const PlateHx = ({
  x,
  y,
  cold,
}: {
  x: number;
  y: number;
  cold: boolean;
}) => (
  <g transform={`translate(${x} ${y})`}>
    <path d="M0 0 L22 -6 L22 62 L0 68 Z" className={cold ? 'tems-hx-cold' : 'tems-hx-warm'} />
    <path d="M22 -6 L40 -12 L40 56 L22 62 Z" className={cold ? 'tems-hx-warm' : 'tems-hx-cold'} />
  </g>
);

/** Heat pump: two shells with the compressor above. */
const HeatPumpUnit = ({ x, y, label }: { x: number; y: number; label: string }) => (
  <g>
    <rect x={x + 42} y={y - 34} width="54" height="30" rx="2" className="sch-component" />
    <circle cx={x + 69} cy={y - 19} r="10" className="sch-component" />
    <path d={`M${x + 63} ${y - 19} a 6 6 0 0 1 12 0`} className="tems-compressor-line" />
    <line x1={x + 20} y1={y - 4} x2={x + 20} y2={y + 6} className="sch-line" />
    <line x1={x + 118} y1={y - 4} x2={x + 118} y2={y + 6} className="sch-line" />

    <rect x={x} y={y + 6} width="200" height="20" rx="2" className="tems-shell" />
    <rect x={x} y={y + 34} width="200" height="20" rx="2" className="tems-shell" />
    {[x - 4, x + 196].map((fx) => (
      <g key={fx}>
        <rect x={fx} y={y + 2} width="8" height="28" className="tems-shell" />
        <rect x={fx} y={y + 30} width="8" height="28" className="tems-shell" />
      </g>
    ))}
    <text x={x + 100} y={y + 82} textAnchor="middle" className="sch-label">
      {label}
    </text>
  </g>
);

const Tems = () => (
  <svg viewBox={`0 0 ${TW} ${TH}`} className="system-schematic" role="img" aria-hidden="true">
    <defs>
      <linearGradient id="tank-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#c0392b" />
        <stop offset="55%" stopColor="#7fb2d8" />
        <stop offset="100%" stopColor="#5b9bd0" />
      </linearGradient>
      <marker
        id="hot-arrow"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="5"
        markerHeight="5"
        orient="auto"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#b32d1f" />
      </marker>
    </defs>

    {/* ---- hot circuit (red) ---- */}
    <g className="tems-hot">
      {/* heat pumps to the hot header */}
      <path d="M120 430 H 246" />
      <path d="M450 430 H 656" />
      {/* riser to the hot buffer and the hot water consumers */}
      <path d="M520 430 V 214 H 454" />
      <path d="M430 150 V 62 H 363" />
      {/* diesel generator heat recovery branch */}
      <path d="M300 430 V 170 H 214" />
      {/* off-diagram connection to the diesel generator jacket water */}
      <path d="M186 150 H 120" markerEnd="url(#hot-arrow)" />
      <path d="M120 186 H 186" markerEnd="url(#hot-arrow)" />
      {/* heat dumping to sea */}
      <path d="M120 466 H 246" />
    </g>

    {/* ---- cold circuit (blue) ---- */}
    <g className="tems-cold">
      <path d="M860 430 H 926" />
      <path d="M860 466 H 926" />
      {/* cold header linking the two heat pumps */}
      <path d="M454 466 H 656" />
      {/* riser to the cold buffer and the cold water consumers */}
      <path d="M700 430 V 244 H 662" />
      <path d="M640 176 V 62 H 711" />
    </g>

    {/* ---- equipment ---- */}
    <PlateHx x={92} y={410} cold={false} />
    <MiniPump x={70} y={410} />
    <text x="104" y="500" textAnchor="middle" className="sch-label sch-label-small">
      Sea water
    </text>
    <text x="104" y="513" textAnchor="middle" className="sch-label sch-label-small">
      heat dumping
    </text>

    <PlateHx x={906} y={410} cold />
    <MiniPump x={962} y={410} />
    <text x="928" y="500" textAnchor="middle" className="sch-label sch-label-small">
      Sea water
    </text>
    <text x="928" y="513" textAnchor="middle" className="sch-label sch-label-small">
      heat collection / free cooling
    </text>

    <HeatPumpUnit x={250} y={410} label="Heat pump 2" />
    <HeatPumpUnit x={660} y={410} label="Heat pump 1" />

    <PlateHx x={186} y={126} cold={false} />
    <text x="118" y="176" textAnchor="end" className="sch-label sch-label-small">
      DIESEL GEN
    </text>
    <text x="118" y="189" textAnchor="end" className="sch-label sch-label-small">
      heat recovery
    </text>

    <BufferTank x={408} y={150} />
    <BufferTank x={640} y={176} />

    <MiniPump x={352} y={78} />
    <MiniPump x={352} y={50} />
    <text x="330" y="24" textAnchor="middle" className="sch-label sch-label-small">
      Hot water
    </text>
    <text x="330" y="37" textAnchor="middle" className="sch-label sch-label-small">
      consumers
    </text>

    <MiniPump x={722} y={78} />
    <MiniPump x={722} y={50} />
    <text x="744" y="24" textAnchor="middle" className="sch-label sch-label-small">
      Cold water
    </text>
    <text x="744" y="37" textAnchor="middle" className="sch-label sch-label-small">
      consumers
    </text>
  </svg>
);

export default function SystemSchematic({ layout }: { layout: SystemLayoutId }) {
  switch (layout) {
    case 'simplified-chiller':
      return <SimplifiedChiller />;
    case 'chiller-2way':
      return <HydraulicCircuit mode="throttling" freeCooling={false} />;
    case 'chiller-3way':
      return <HydraulicCircuit mode="diverting" freeCooling={false} />;
    case 'chiller-2way-fc':
      return <HydraulicCircuit mode="throttling" freeCooling />;
    case 'chiller-3way-fc':
      return <HydraulicCircuit mode="diverting" freeCooling />;
    case 'tems':
      return <Tems />;
    default:
      return null;
  }
}
