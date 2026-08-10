import {
  SYSTEM_FAMILIES,
  SYSTEM_LAYOUTS,
  getLayout,
  systemDefaults,
} from '../data/systems';
import { AIR_SYSTEMS } from '../data/airSystems';
import { CHILLERS, PUMPS } from '../data/equipment';
import ParameterFields from '../components/ParameterFields';
import EquipmentSelect from '../components/EquipmentSelect';
import SystemSchematic from '../components/figures/SystemSchematic';
import type { AirWaterSystem, SystemLayoutId } from '../types';

interface Props {
  system: AirWaterSystem;
  onChange: (system: AirWaterSystem) => void;
}

export default function Step4AirWaterSystem({ system, onChange }: Props) {
  const layout = getLayout(system.layout);

  const selectLayout = (id: SystemLayoutId) => {
    // Keep values the user already typed, fill in the new configuration's defaults.
    onChange({
      ...system,
      layout: id,
      parameters: { ...systemDefaults(id), ...system.parameters },
    });
  };

  const setValue = (key: string, value: string) =>
    onChange({ ...system, parameters: { ...system.parameters, [key]: value } });

  return (
    <div className="step-page">
      <header className="step-header">
        <h2>Air and water system</h2>
        <p>
          Select the system configuration of the chilled water circuit. The choice drives
          how pump and compressor energy behave at part load.
        </p>
      </header>

      <section className="panel">
        <h3 className="panel-title">System configuration</h3>
        <p className="panel-text">
          {SYSTEM_LAYOUTS.length} configurations available. Selecting one shows its
          schematic and parameters below.
        </p>

        {SYSTEM_FAMILIES.map((family) => {
          const options = SYSTEM_LAYOUTS.filter((l) => l.family === family);
          if (options.length === 0) return null;
          return (
            <div className="library-group" key={family}>
              <h4 className="library-group-title">{family}</h4>
              <ul className="library-list" role="radiogroup" aria-label={family}>
                {options.map((option) => {
                  const isSelected = option.id === system.layout;
                  return (
                    <li key={option.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        className={`library-row${isSelected ? ' is-selected' : ''}`}
                        onClick={() => selectLayout(option.id)}
                      >
                        <span className="library-row-main">
                          <span className="library-row-name">{option.name}</span>
                          <span className="library-row-tagline">{option.tagline}</span>
                        </span>
                        <span className="library-row-check" aria-hidden="true">
                          ✓
                        </span>
                      </button>
                      {isSelected && (
                        <div
                          className={`schematic-frame is-inline${
                            option.id === 'tems' ? ' is-wide' : ''
                          }`}
                        >
                          <SystemSchematic layout={option.id} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      {layout && (
        <>
          <section className="panel">
            <h3 className="panel-title">Air distribution</h3>
            <p className="panel-text">
              How the conditioned air reaches the spaces. The energy wheel recovers
              exhaust heat and cold into the supply stream; the fan-coil variants
              leave part of the load to local units.
            </p>
            <ul className="library-list" role="radiogroup" aria-label="Air distribution">
              {AIR_SYSTEMS.map((option) => {
                const isSelected = option.id === system.airSystem;
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`library-row${isSelected ? ' is-selected' : ''}`}
                      onClick={() => onChange({ ...system, airSystem: option.id })}
                    >
                      <span className="library-row-main">
                        <span className="library-row-name">{option.name}</span>
                        <span className="library-row-tagline">{option.tagline}</span>
                      </span>
                      <span className="library-row-check" aria-hidden="true">
                        ✓
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="panel">
            <h3 className="panel-title">Plant parameters</h3>
            <p className="panel-text">
              Select the chiller and pump from the equipment catalogue. Ratings shown
              are placeholder data — see <code>src/data/equipment.ts</code>.
            </p>
            <div className="field-grid">
              <EquipmentSelect
                id="plant-chiller"
                label="Chiller"
                items={CHILLERS}
                value={system.parameters.chillerId ?? ''}
                onChange={(id) => setValue('chillerId', id)}
              />
              <EquipmentSelect
                id="plant-pump"
                label="Pump"
                items={PUMPS}
                value={system.parameters.pumpId ?? ''}
                onChange={(id) => setValue('pumpId', id)}
              />
            </div>
          </section>

          <section className="panel">
            <h3 className="panel-title">{layout.name} — specific parameters</h3>
            <p className="panel-text">Placeholders — not defined yet.</p>
            <ParameterFields
              fields={layout.fields}
              values={system.parameters}
              onChange={setValue}
            />
          </section>
        </>
      )}
    </div>
  );
}
