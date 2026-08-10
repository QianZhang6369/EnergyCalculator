import { useMemo, useState } from 'react';
import {
  FEATURED_VESSELS,
  VESSELS,
  VESSEL_CATEGORIES,
  getVessel,
  specRows,
  specSummary,
} from '../data/vessels';
import VesselFigure from '../components/figures/VesselFigure';
import type { VesselCategory } from '../types';

interface Props {
  vesselId: string | null;
  projectName: string;
  onSelect: (id: string) => void;
  onProjectNameChange: (name: string) => void;
}

type Filter = 'All' | VesselCategory;

export default function Step1VesselType({
  vesselId,
  projectName,
  onSelect,
  onProjectNameChange,
}: Props) {
  const selected = getVessel(vesselId);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('All');

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = VESSELS.filter((v) => {
      const inCategory = filter === 'All' || v.category === filter;
      const inQuery =
        !needle ||
        v.name.toLowerCase().includes(needle) ||
        v.tagline.toLowerCase().includes(needle);
      return inCategory && inQuery;
    });
    return VESSEL_CATEGORIES.map((category) => ({
      category,
      vessels: matches.filter((v) => v.category === category),
    })).filter((g) => g.vessels.length > 0);
  }, [query, filter]);

  const resultCount = groups.reduce((n, g) => n + g.vessels.length, 0);

  return (
    <div className="step-page">
      <header className="step-header">
        <h2>Vessel</h2>
        <p>
          Choose the vessel the HVAC plant is designed for. Its key information sets
          the default load profile used in the calculation.
        </p>
      </header>

      <div className="field field-wide">
        <label className="field-label" htmlFor="project-name">
          Project name
        </label>
        <input
          id="project-name"
          className="field-input"
          type="text"
          placeholder="e.g. Newbuild 2481 — accommodation HVAC"
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
        />
      </div>

      <section>
        <h3 className="section-title">Common vessels</h3>
        <div className="vessel-grid" role="radiogroup" aria-label="Common vessels">
          {FEATURED_VESSELS.map((vessel) => {
            const isSelected = vessel.id === vesselId;
            return (
              <button
                key={vessel.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`vessel-card${isSelected ? ' is-selected' : ''}`}
                onClick={() => onSelect(vessel.id)}
              >
                <div className="vessel-card-figure">
                  <VesselFigure figure={vessel.figure} />
                </div>
                <div className="vessel-card-body">
                  <h3>{vessel.name}</h3>
                  <ul className="spec-chips">
                    {specSummary(vessel).map((item) => (
                      <li className="spec-chip" key={item}>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <p>{vessel.tagline}</p>
                </div>
                <span className="vessel-card-check" aria-hidden="true">
                  ✓
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="library-head">
          <div>
            <h3 className="panel-title">Vessel library</h3>
            <p className="panel-text">
              Every vessel in the library. {VESSELS.length} vessels available.
            </p>
          </div>
          <input
            className="field-input library-search"
            type="search"
            placeholder="Search vessels…"
            aria-label="Search vessels"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="chip-row" role="group" aria-label="Filter by category">
          {(['All', ...VESSEL_CATEGORIES] as Filter[]).map((option) => (
            <button
              key={option}
              type="button"
              className={`chip${filter === option ? ' is-active' : ''}`}
              aria-pressed={filter === option}
              onClick={() => setFilter(option)}
            >
              {option}
            </button>
          ))}
        </div>

        {resultCount === 0 ? (
          <p className="library-empty">No vessel matches “{query}”.</p>
        ) : (
          groups.map((group) => (
            <div className="library-group" key={group.category}>
              <h4 className="library-group-title">{group.category}</h4>
              <ul className="library-list">
                {group.vessels.map((vessel) => {
                  const isSelected = vessel.id === vesselId;
                  return (
                    <li key={vessel.id}>
                      <button
                        type="button"
                        className={`library-row${isSelected ? ' is-selected' : ''}`}
                        aria-pressed={isSelected}
                        onClick={() => onSelect(vessel.id)}
                      >
                        <span className="library-row-main">
                          <span className="library-row-name">
                            {vessel.name}
                            {vessel.featured && <span className="tag">Common</span>}
                          </span>
                          <span className="library-row-tagline">{vessel.tagline}</span>
                        </span>
                        <span className="library-row-specs">
                          {specSummary(vessel).join(' · ')}
                        </span>
                        <span className="library-row-check" aria-hidden="true">
                          ✓
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>

      {selected && (
        <section className="panel">
          <div className="detail-head">
            {selected.figure && (
              <div className="detail-figure">
                <VesselFigure figure={selected.figure} />
              </div>
            )}
            <div>
              <h3 className="panel-title">{selected.name}</h3>
              <p className="panel-text">{selected.description ?? selected.tagline}</p>
            </div>
          </div>
          <h4 className="library-group-title detail-specs-title">Key information</h4>
          <dl className="fact-list">
            {specRows(selected).map((row) => (
              <div className="fact" key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
