import { useMemo, useState } from 'react';
import ProfileChart, { type ChartPanel } from '../components/ProfileChart';
import { computeResults } from '../lib/results';
import type { DesignParameters, SystemLayoutId, Waypoint } from '../types';

interface Props {
  design: DesignParameters;
  waypoints: Waypoint[];
  layout: SystemLayoutId | null;
}

/*
 * Categorical slots, all validated all-pairs against this app's white surface.
 * Humidity and solar sit below 3:1 contrast, so they rely on the relief rule —
 * every panel carries a title naming its measure.
 */
const HEATING = '#e34948';
const COOLING = '#2a78d6';
const AIR = '#2a78d6';
const SEA = '#008300';
const HUMIDITY = '#e87ba4';
const SOLAR = '#eda100';
const COP = '#4a3aa7';

const HOURS_PER_YEAR = 8760;

const PRESETS: { label: string; hours: number }[] = [
  { label: 'Year', hours: HOURS_PER_YEAR },
  { label: '3 months', hours: 24 * 91 },
  { label: 'Month', hours: 24 * 30 },
  { label: 'Week', hours: 24 * 7 },
];

const fmtDate = (iso: string | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

const kwh = (v: number) =>
  v >= 1000 ? `${(v / 1000).toFixed(1)} MWh` : `${v.toFixed(0)} kWh`;

export default function Step5Results({ design, waypoints, layout }: Props) {
  const year = new Date().getFullYear();
  const [seed, setSeed] = useState(0);
  const [range, setRange] = useState<[number, number]>([0, HOURS_PER_YEAR]);

  // `seed` is only here to force a fresh synthetic year on demand.
  const results = useMemo(
    () => computeResults(design, waypoints, layout, year),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [design, waypoints, layout, year, seed],
  );

  if (!results) {
    return (
      <div className="step-page">
        <header className="step-header">
          <h2>Results</h2>
          <p>The heat balance could not run.</p>
        </header>
        <p className="library-empty">
          Some design parameters in step 3 are blank or non-numeric. Fill them in and
          come back.
        </p>
      </div>
    );
  }

  const times = results.weather.map((w) => w.time);

  const loadPanels: ChartPanel[] = [
    {
      title: 'Vessel demand',
      unit: 'kW',
      aggregate: 'max',
      series: [
        { label: 'Cooling', color: COOLING, values: results.loads.map((p) => p.cooling) },
        { label: 'Heating', color: HEATING, values: results.loads.map((p) => p.heating) },
      ],
    },
  ];

  const energyPanels: ChartPanel[] = [
    {
      title: 'Electrical power',
      unit: 'kW',
      aggregate: 'max',
      series: [
        { label: 'Chillers', color: COOLING, values: results.plant.map((p) => p.chillerKw) },
        { label: 'Pumps', color: SEA, values: results.plant.map((p) => p.pumpKw) },
      ],
    },
    {
      title: 'Cooling capacity delivered',
      unit: 'kW',
      aggregate: 'max',
      series: [
        { label: 'Cooling capacity', color: COOLING, values: results.loads.map((p) => p.cooling) },
      ],
    },
    {
      title: 'Chiller COP at seawater temperature',
      unit: '–',
      aggregate: 'mean',
      series: [{ label: 'COP', color: COP, values: results.plant.map((p) => p.cop) }],
    },
  ];

  const weatherPanels: ChartPanel[] = [
    {
      title: 'Temperature',
      unit: '°C',
      aggregate: 'mean',
      series: [
        { label: 'Air', color: AIR, values: results.weather.map((w) => w.airTemp) },
        { label: 'Seawater', color: SEA, values: results.weather.map((w) => w.seawaterTemp) },
      ],
    },
    {
      title: 'Relative humidity',
      unit: '%',
      aggregate: 'mean',
      series: [
        {
          label: 'Relative humidity',
          color: HUMIDITY,
          values: results.weather.map((w) => w.relativeHumidity),
        },
      ],
    },
    {
      title: 'Solar radiation',
      unit: 'W/m²',
      aggregate: 'mean',
      series: [
        {
          label: 'Solar radiation',
          color: SOLAR,
          values: results.weather.map((w) => w.solarRadiation),
        },
      ],
    },
  ];

  const applyPreset = (hours: number) => {
    const centre = Math.round((range[0] + range[1]) / 2);
    const half = Math.round(hours / 2);
    let lo = Math.max(0, centre - half);
    const hi = Math.min(HOURS_PER_YEAR, lo + hours);
    lo = Math.max(0, hi - hours);
    setRange([lo, hi]);
  };

  const spanHours = range[1] - range[0];

  return (
    <div className="step-page">
      <header className="step-header">
        <h2>Results</h2>
        <p>
          Annual profile for {year}. Weather is synthetic and the plant coefficients
          are placeholders — see the note at the bottom.
        </p>
      </header>

      <section className="panel">
        <div className="library-head">
          <div>
            <h3 className="panel-title">Key figures</h3>
            <p className="panel-text">Over the full year, independent of the zoom below.</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => setSeed((s) => s + 1)}
          >
            Regenerate year
          </button>
        </div>
        <dl className="fact-list">
          <div className="fact">
            <dt>Peak cooling</dt>
            <dd>{results.peakCooling.toFixed(0)} kW</dd>
          </div>
          <div className="fact">
            <dt>Peak heating</dt>
            <dd>{results.peakHeating.toFixed(0)} kW</dd>
          </div>
          <div className="fact">
            <dt>Cooling delivered</dt>
            <dd>{kwh(results.coolingEnergy)}</dd>
          </div>
          <div className="fact">
            <dt>Heating delivered</dt>
            <dd>{kwh(results.heatingEnergy)}</dd>
          </div>
          <div className="fact">
            <dt>Plant electricity</dt>
            <dd>{kwh(results.totalElectricity)}</dd>
            <dd className="fact-sub">chillers + pumps + heating</dd>
          </div>
          <div className="fact">
            <dt>Seasonal COP</dt>
            <dd>{results.seasonalCop ?? '—'}</dd>
            <dd className="fact-sub">cooling delivered ÷ chiller kWh</dd>
          </div>
          <div className="fact">
            <dt>Specific energy</dt>
            <dd>{results.specificEnergy ? `${results.specificEnergy} kWh/m²` : '—'}</dd>
          </div>
          <div className="fact">
            <dt>Free cooling</dt>
            <dd>{results.freeCoolingHours} h</dd>
            <dd className="fact-sub">compressors off</dd>
          </div>
        </dl>
      </section>

      {/* One filter row scoping every chart below — deliberately not a panel of
          its own, so it reads as a control rather than a result. */}
      <div className="filter-row">
        <div className="chip-row">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={`chip${spanHours === preset.hours ? ' is-active' : ''}`}
              onClick={() => applyPreset(preset.hours)}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            className="chip"
            disabled={range[0] === 0 && range[1] === HOURS_PER_YEAR}
            onClick={() => setRange([0, HOURS_PER_YEAR])}
          >
            Reset
          </button>
        </div>
        <span className="filter-caption">
          {fmtDate(times[range[0]])} → {fmtDate(times[Math.min(range[1], times.length - 1)])} ·{' '}
          {spanHours} h · drag a chart to zoom
        </span>
      </div>

      <section className="panel">
        <h3 className="panel-title">Load profile</h3>
        <p className="panel-text">
          Heating and cooling demand. Aggregated by peak when zoomed out, so the
          sizing hours stay visible.
        </p>
        <ProfileChart
          times={times}
          panels={loadPanels}
          range={range}
          onRangeChange={setRange}
        />
      </section>

      <section className="panel">
        <h3 className="panel-title">Weather profile</h3>
        <p className="panel-text">
          The ambient conditions the loads above were calculated from. Aggregated by
          mean.
        </p>
        <ProfileChart
          times={times}
          panels={weatherPanels}
          range={range}
          onRangeChange={setRange}
        />
      </section>

      <section className="panel">
        <h3 className="panel-title">Energy performance</h3>
        <p className="panel-text">
          Power drawn, cooling delivered and the COP available at the seawater
          temperature of the moment — over the same period as the charts above.
        </p>
        <ProfileChart
          times={times}
          panels={energyPanels}
          range={range}
          onRangeChange={setRange}
        />
        <h4 className="library-group-title detail-specs-title">Annual totals</h4>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Capacity kW</th>
                <th scope="col">Peak power kW</th>
                <th scope="col">Annual kWh</th>
                <th scope="col">Operating h</th>
                <th scope="col">Average COP</th>
              </tr>
            </thead>
            <tbody>
              {results.equipment.map((row) => (
                <tr key={row.item}>
                  <td>{row.item}</td>
                  <td>{row.capacityKw.toLocaleString()}</td>
                  <td>{row.peakKw.toLocaleString()}</td>
                  <td>{row.annualKwh.toLocaleString()}</td>
                  <td>{row.hours.toLocaleString()}</td>
                  <td>{row.averageCop ?? '—'}</td>
                </tr>
              ))}
              <tr className="data-table-total">
                <td>Total</td>
                <td>—</td>
                <td>—</td>
                <td>{results.totalElectricity.toLocaleString()}</td>
                <td>—</td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p className="callout callout-warn">
        <strong>Not for design use.</strong> The weather is generated, not forecast.
        The loads are computed from it with the ISO 7547-style balance, which is
        sensible heat only — no latent load. Chiller COP, pump laws and the
        free-cooling changeover use placeholder coefficients in{' '}
        <code>src/lib/results.ts</code>, not data from the equipment selected in step 4.
      </p>
    </div>
  );
}
