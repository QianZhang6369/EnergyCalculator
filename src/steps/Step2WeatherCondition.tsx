import { useState } from 'react';
import ItineraryMap from '../components/ItineraryMap';
import {
  formatDuration,
  formatLat,
  formatLon,
  hoursBetween,
  issues,
  legs,
} from '../lib/itinerary';
import WeatherChart from '../components/WeatherChart';
import {
  INTERVAL_OPTIONS,
  SERIES_FIELDS,
  generateProfile,
  summarise,
  timeRange,
} from '../lib/weather';
import type { WeatherCondition, Waypoint } from '../types';

interface Props {
  weather: WeatherCondition;
  /** Accepts an updater so rapid successive edits cannot clobber each other. */
  onChange: (
    next: WeatherCondition | ((weather: WeatherCondition) => WeatherCondition),
  ) => void;
}

const newId = () =>
  `wp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export default function Step2WeatherCondition({ weather, onChange }: Props) {
  const waypoints = weather.waypoints ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const setWaypoints = (updater: (current: Waypoint[]) => Waypoint[]) =>
    onChange((w) => ({ ...w, waypoints: updater(w.waypoints ?? []) }));

  const addWaypoint = (lat: number, lon: number) => {
    const id = newId();
    setWaypoints((current) => [
      ...current,
      { id, name: `Stop ${current.length + 1}`, lat, lon, arrival: '', departure: '' },
    ]);
    setSelectedId(id);
  };

  const patch = (id: string, values: Partial<Waypoint>) =>
    setWaypoints((current) =>
      current.map((w) => (w.id === id ? { ...w, ...values } : w)),
    );

  const remove = (id: string) => {
    setWaypoints((current) => current.filter((w) => w.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const move = (index: number, delta: number) => {
    setWaypoints((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const interval = weather.intervalHours || 3;
  const series = weather.series ?? [];

  const generateWeather = async () => {
    setGenerating(true);
    try {
      const next = await generateProfile(waypoints, interval);
      onChange((w) => ({ ...w, intervalHours: interval, series: next }));
    } finally {
      setGenerating(false);
    }
  };

  const routeLegs = legs(waypoints);
  const stats = summarise(series);
  // The profile needs at least two distinct timestamps to span anything.
  const hasTimeline = timeRange(waypoints) !== null;
  const problems = issues(waypoints);
  const problemsById = new Map<string, string[]>();
  problems.forEach((p) => {
    problemsById.set(p.waypointId, [...(problemsById.get(p.waypointId) ?? []), p.message]);
  });

  const totalDistance = routeLegs.reduce((sum, l) => sum + l.distanceNm, 0);
  const totalHours = hoursBetween(
    waypoints[0]?.arrival || waypoints[0]?.departure || '',
    waypoints.at(-1)?.departure || waypoints.at(-1)?.arrival || '',
  );

  return (
    <div className="step-page">
      <header className="step-header">
        <h2>Weather condition</h2>
        <p>
          Define the vessel's sailing route. Each stop carries an arrival and departure
          time, which will drive the ambient conditions used for each leg.
        </p>
      </header>

      <section className="panel">
        <h3 className="panel-title">Sailing route</h3>
        <p className="panel-text">
          Click the map to add a stop, then set its times in the list below.
        </p>
        <ItineraryMap
          waypoints={waypoints}
          selectedId={selectedId}
          onAdd={addWaypoint}
          onSelect={setSelectedId}
          onMove={(id, lat, lon) => patch(id, { lat, lon })}
        />
      </section>

      {waypoints.length === 0 ? (
        <section className="empty-state">
          <div className="empty-state-icon" aria-hidden="true">
            ⚓
          </div>
          <h3>No stops yet</h3>
          <p>
            Click anywhere on the map above to drop the first stop of the sailing route.
          </p>
        </section>
      ) : (
        <section className="panel">
          <div className="library-head">
            <div>
              <h3 className="panel-title">Stops</h3>
              <p className="panel-text">
                {waypoints.length} stop{waypoints.length === 1 ? '' : 's'} ·{' '}
                {totalDistance.toFixed(0)} nm total
                {totalHours !== null && totalHours > 0
                  ? ` · ${formatDuration(totalHours)} end to end`
                  : ''}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => setWaypoints(() => [])}
            >
              Clear route
            </button>
          </div>

          <ol className="stop-list">
            {waypoints.map((wp, index) => {
              const stay = hoursBetween(wp.arrival, wp.departure);
              const leg = routeLegs[index - 1];
              const warnings = problemsById.get(wp.id) ?? [];
              return (
                <li key={wp.id}>
                  {leg && (
                    <div className="leg-row">
                      <span className="leg-line" aria-hidden="true" />
                      <span>
                        {leg.distanceNm.toFixed(0)} nm
                        {leg.hours !== null && leg.hours > 0 && (
                          <>
                            {' · '}
                            {formatDuration(leg.hours)}
                            {leg.knots !== null && ` · ${leg.knots.toFixed(1)} kn`}
                          </>
                        )}
                      </span>
                    </div>
                  )}
                  <div
                    className={`stop${wp.id === selectedId ? ' is-selected' : ''}`}
                    onFocusCapture={() => setSelectedId(wp.id)}
                  >
                    <div className="stop-main">
                    <span className="stop-index" aria-hidden="true">
                      {index + 1}
                    </span>
                    <div className="stop-fields">
                      <div className="field">
                        <label className="field-label" htmlFor={`${wp.id}-name`}>
                          Stop name
                        </label>
                        <input
                          id={`${wp.id}-name`}
                          className="field-input"
                          type="text"
                          value={wp.name}
                          onChange={(e) => patch(wp.id, { name: e.target.value })}
                        />
                        <p className="field-hint">
                          {formatLat(wp.lat)}, {formatLon(wp.lon)}
                        </p>
                      </div>
                      <div className="field">
                        <label className="field-label" htmlFor={`${wp.id}-arrival`}>
                          Arrival
                        </label>
                        <input
                          id={`${wp.id}-arrival`}
                          className="field-input"
                          type="datetime-local"
                          value={wp.arrival}
                          onChange={(e) => patch(wp.id, { arrival: e.target.value })}
                        />
                      </div>
                      <div className="field">
                        <label className="field-label" htmlFor={`${wp.id}-departure`}>
                          Departure
                        </label>
                        <input
                          id={`${wp.id}-departure`}
                          className="field-input"
                          type="datetime-local"
                          value={wp.departure}
                          onChange={(e) => patch(wp.id, { departure: e.target.value })}
                        />
                        <p className="field-hint">
                          {stay !== null && stay >= 0
                            ? `Alongside ${formatDuration(stay)}`
                            : 'Time alongside'}
                        </p>
                      </div>
                    </div>
                    <div className="stop-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        title="Move up"
                        aria-label={`Move ${wp.name} earlier`}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Move down"
                        aria-label={`Move ${wp.name} later`}
                        disabled={index === waypoints.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="icon-btn icon-btn-danger"
                        title="Remove stop"
                        aria-label={`Remove ${wp.name}`}
                        onClick={() => remove(wp.id)}
                      >
                        ✕
                      </button>
                    </div>
                    </div>
                  </div>
                  {warnings.map((message) => (
                    <p className="stop-warning" key={message}>
                      ⚠ {message}
                    </p>
                  ))}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="panel">
        <div className="library-head">
          <div>
            <h3 className="panel-title">Weather along the route</h3>
            <p className="panel-text">
              A weather profile sampled along the sailing route. The vessel position is
              interpolated between stops, so each sample is the condition where the
              ship actually is at that time. Values are synthetic for now — swap in
              a live forecast by replacing <code>generateProfile</code> in{' '}
              <code>src/lib/weather.ts</code>.
            </p>
          </div>
          <div className="weather-controls">
            <div className="field">
              <label className="field-label" htmlFor="weather-interval">
                Interval
              </label>
              <select
                id="weather-interval"
                className="field-input"
                value={interval}
                onChange={(e) => {
                  const intervalHours = Number(e.target.value);
                  onChange((w) => ({ ...w, intervalHours }));
                }}
              >
                {INTERVAL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option} h
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!hasTimeline || generating}
              title={
                hasTimeline
                  ? undefined
                  : 'Set arrival and departure times on at least two stops first'
              }
              onClick={generateWeather}
            >
              {generating
                ? 'Generating…'
                : stats
                  ? 'Regenerate profile'
                  : 'Generate profile'}
            </button>
          </div>
        </div>

        {stats ? (
          <>
            <dl className="fact-list">
              {SERIES_FIELDS.map((field) => {
                const s = stats[field.key];
                return (
                  <div className="fact" key={field.key}>
                    <dt>{field.label}</dt>
                    <dd>
                      {s.min.toFixed(1)} – {s.max.toFixed(1)} {field.unit}
                    </dd>
                    <dd className="fact-sub">mean {s.mean.toFixed(1)}</dd>
                  </div>
                );
              })}
            </dl>
            <p className="profile-meta">
              {stats.count} samples · every {interval} h · {stats.spanHours} h covered
            </p>
            <WeatherChart series={series} />
          </>
        ) : (
          <p className="library-empty">
            {hasTimeline
              ? 'No profile generated yet.'
              : 'Set arrival and departure times on at least two stops, then generate the profile.'}
          </p>
        )}
      </section>
    </div>
  );
}
