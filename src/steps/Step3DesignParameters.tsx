import { DESIGN_PARAMETER_GROUPS } from '../data/designParameters';
import ParameterFields from '../components/ParameterFields';
import type { DesignParameters } from '../types';

interface Props {
  design: DesignParameters;
  onChange: (design: DesignParameters) => void;
}

/**
 * Only the parameters the user decides. Building geometry, thermal envelope and
 * internal gains are properties of the vessel and live in step 1, where they are
 * derived from its size — they are still part of `design`, just not edited here.
 */
const USER_GROUPS = DESIGN_PARAMETER_GROUPS.filter((g) => g.source === 'user');

export default function Step3DesignParameters({ design, onChange }: Props) {
  const setValue = (key: string, value: string) => onChange({ ...design, [key]: value });

  const resetUserGroups = () =>
    onChange({
      ...design,
      ...Object.fromEntries(
        USER_GROUPS.flatMap((g) => g.fields).map((f) => [f.key, f.defaultValue ?? '']),
      ),
    });

  return (
    <div className="step-page">
      <header className="step-header">
        <h2>Design parameters</h2>
        <p>Heat balance inputs following ISO 7547, using the step 2 weather profile.</p>
      </header>

      <p className="callout">
        Building geometry, thermal envelope and internal gains come from the vessel
        and its size, set in step 1.
      </p>

      {USER_GROUPS.map((group) => (
        <section className="panel" key={group.id}>
          <h3 className="panel-title">{group.title}</h3>
          <p className="panel-text">{group.description}</p>
          <ParameterFields fields={group.fields} values={design} onChange={setValue} />
        </section>
      ))}

      <div>
        <button type="button" className="btn btn-ghost btn-small" onClick={resetUserGroups}>
          Reset to default values
        </button>
      </div>
    </div>
  );
}
