import YearPreviewChart from '../components/YearPreviewChart';
import {
  MONTH_NAMES,
  REGIONS,
  REGION_PRESETS,
  SEASONAL_PRESETS,
  getRegion,
  regionColors,
  regionsInPlan,
  type AnnualPlan,
} from '../data/regions';
import { planMeans, type MonthlyMeans } from '../lib/weather';
import type { WeatherCondition } from '../types';

interface Props {
  weather: WeatherCondition;
  onChange: (next: WeatherCondition) => void;
}

const ALL_PRESETS = [...SEASONAL_PRESETS, ...REGION_PRESETS];

const MON = MONTH_NAMES.map((name) => name.slice(0, 3));

const fmt = (v: number, digits = 1) => v.toFixed(digits).replace('-', '−');

type MeanKey = 'airTemp' | 'seawaterTemp' | 'relativeHumidity' | 'solarRadiation';

/** Lowest-to-highest monthly mean of one quantity, and when each falls. */
function span(means: MonthlyMeans[], key: MeanKey, digits: number, unit: string) {
  const lo = means.reduce((a, s, m) => (s[key] < means[a][key] ? m : a), 0);
  const hi = means.reduce((a, s, m) => (s[key] > means[a][key] ? m : a), 0);
  return {
    value: `${fmt(means[lo][key], digits)} to ${fmt(means[hi][key], digits)} ${unit}`,
    sub: means[lo][key] === means[hi][key] ? 'Same all year' : `Low ${MON[lo]} · high ${MON[hi]}`,
  };
}

export default function Step2WeatherCondition({ weather, onChange }: Props) {
  const plan = weather.plan;
  const colors = regionColors(plan);
  const means = planMeans(plan);
  const used = regionsInPlan(plan);

  // The starting point is whichever preset the plan still matches, so the list
  // never claims a pattern the user has since edited away from.
  const preset = ALL_PRESETS.find((p) => p.plan.every((id, m) => id === plan[m]));

  const setPlan = (next: AnnualPlan) => onChange({ ...weather, plan: next });

  // Say which regions rest on measured data and which on the model.
  const measured = used.map(getRegion).filter((r) => r.hourly);
  const measuredText = measured.map((r) => `${r.name} uses ${r.hourly?.source}`).join('; ');
  const dataNote =
    measured.length === 0
      ? 'Values are synthetic for now, from a model that only knows latitude and season.'
      : measured.length === used.length
        ? `${measuredText}.`
        : `${measuredText}. The other regions are synthetic for now, from a model that only knows latitude and season.`;

  const changes = plan.filter((id, m) => id !== plan[(m + 1) % 12]).length;

  const facts = [
    {
      label: 'Regions',
      value: String(used.length),
      sub: `${changes} change${changes === 1 ? '' : 's'} a year`,
    },
    { label: 'Air temperature', ...span(means, 'airTemp', 1, '°C') },
    { label: 'Seawater', ...span(means, 'seawaterTemp', 1, '°C') },
    { label: 'Humidity', ...span(means, 'relativeHumidity', 0, '%') },
    { label: 'Solar radiation', ...span(means, 'solarRadiation', 0, 'W/m²') },
  ];

  return (
    <div className="step-page">
      <header className="step-header">
        <h2>Weather condition</h2>
        <p>
          Plan where the vessel operates through the year. Each month has one main
          operating region, and the weather for that month comes from that region.
        </p>
      </header>

      <section className="panel">
        <div className="library-head plan-head">
          <div>
            <h3 className="panel-title">Annual plan</h3>
            <p className="panel-text">Choose the main operating region for each month.</p>
          </div>
          <div className="field plan-start">
            <label className="field-label" htmlFor="plan-start">
              Start from
            </label>
            <select
              id="plan-start"
              className="field-input"
              value={preset?.id ?? ''}
              onChange={(e) => {
                const picked = ALL_PRESETS.find((p) => p.id === e.target.value);
                if (picked) setPlan([...picked.plan]);
              }}
            >
              <option value="">Your own plan</option>
              <optgroup label="Seasonal patterns">
                {SEASONAL_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="One region all year">
                {REGION_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        <ol className="plan-months">
          {plan.map((id, m) => (
            <li
              key={MONTH_NAMES[m]}
              className="plan-month"
              style={{ '--region': colors.get(id) } as React.CSSProperties}
            >
              <label className="plan-month-name" htmlFor={`plan-month-${m}`}>
                <i className="plan-swatch" />
                {MONTH_NAMES[m]}
                <span className="plan-month-number">{String(m + 1).padStart(2, '0')}</span>
              </label>
              <select
                id={`plan-month-${m}`}
                className="field-input"
                value={id}
                onChange={(e) => setPlan(plan.map((p, i) => (i === m ? e.target.value : p)))}
              >
                {REGIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel">
        <div className="library-head plan-head">
          <div>
            <h3 className="panel-title">Year preview</h3>
            <p className="panel-text">
              Monthly mean conditions where the ship is. The coloured band and dots show
              which region is active. {dataNote}
            </p>
          </div>
          <div className="chart-legend">
            <span className="legend-item">
              <i className="plan-key" /> Air temperature
            </span>
            <span className="legend-item">
              <i className="plan-key plan-key-sea" /> Seawater temperature
            </span>
          </div>
        </div>

        <dl className="fact-list plan-facts">
          {facts.map((fact) => (
            <div className="fact" key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
              <dd className="fact-sub">{fact.sub}</dd>
            </div>
          ))}
        </dl>

        <YearPreviewChart plan={plan} means={means} colors={colors} />

        <p className="profile-meta">
          {changes
            ? `${changes} region change${changes === 1 ? '' : 's'} through the year. The ship switches region at the month boundary; the crossing between regions is not modelled.`
            : 'One region all year, so the ship never repositions.'}
        </p>
      </section>
    </div>
  );
}
