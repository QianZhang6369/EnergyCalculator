import { DESIGN_PARAMETER_GROUPS, designParameterDefaults } from '../data/designParameters';
import ParameterFields from '../components/ParameterFields';
import { designDefaultsFor } from '../lib/vesselDefaults';
import type { DesignParameters, Vessel } from '../types';

interface Props {
  design: DesignParameters;
  vessel: Vessel | null;
  onChange: (design: DesignParameters) => void;
}

export default function Step3DesignParameters({ design, vessel, onChange }: Props) {
  const setValue = (key: string, value: string) => onChange({ ...design, [key]: value });

  return (
    <div className="step-page">
      <header className="step-header">
        <h2>Design parameters</h2>
        {/* Kept short enough to sit on one line at the 68ch measure. */}
        <p>The heat transfer calculation follows ISO 7547, except that the ambient air and seawater temperatures come from the step 2 weather profile instead of a single fixed design condition, so the balance is evaluated at every timestep along the sailing route.</p>
      </header>

      {vessel && (
        <p className="callout">
          Building geometry, thermal envelope, internal gains and occupancy were filled in
          from <strong>{vessel.name}</strong>, based on vessel's general information.
        </p>
      )}

      {DESIGN_PARAMETER_GROUPS.map((group) => {
        const fromVessel = group.source === 'vessel';
        return (
          <section className={`panel${fromVessel ? ' panel-vessel' : ''}`} key={group.id}>
            <h3 className="panel-title">
              {group.title}
              {fromVessel && <span className="tag">From vessel</span>}
            </h3>
            <p className="panel-text">{group.description}</p>
            <ParameterFields
              fields={group.fields}
              values={design}
              onChange={setValue}
              // Vessel-sourced values are fixed by the vessel selected in step 1.
              readOnly={fromVessel}
            />
          </section>
        );
      })}

      <div>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={() =>
            onChange({
              ...designParameterDefaults(),
              ...(vessel ? designDefaultsFor(vessel) : {}),
            })
          }
        >
          Reset all parameters
        </button>
      </div>
    </div>
  );
}
