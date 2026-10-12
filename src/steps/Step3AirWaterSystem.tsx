import {
  SYSTEM_FAMILIES,
  SYSTEM_LAYOUTS,
  systemDefaults,
} from '../data/systems';
import AirSystems from '../components/AirSystems';
import SystemSchematic from '../components/figures/SystemSchematic';
import type { AirSetup } from '../lib/airSystems';
import type { Zone } from '../lib/zones';
import type { AirWaterSystem, SystemLayoutId } from '../types';

interface Props {
  system: AirWaterSystem;
  onChange: (system: AirWaterSystem) => void;
  zones: Zone[];
  air: AirSetup;
  onAirChange: (update: (air: AirSetup) => AirSetup) => void;
  /** Step 4 switch that changes what fresh-air method C delivers. */
  reducedOccupancy: boolean;
}

export default function Step3AirWaterSystem({
  system,
  onChange,
  zones,
  air,
  onAirChange,
  reducedOccupancy,
}: Props) {
  const selectLayout = (id: SystemLayoutId) => {
    // Keep values the user already typed, fill in the new configuration's defaults.
    onChange({
      ...system,
      layout: id,
      parameters: { ...systemDefaults(id), ...system.parameters },
    });
  };

  return (
    <div className="step-page">
      <header className="step-header">
        <h2>Air and water system</h2>
        <p>
          Define the air handling units and the air system of each room group, then
          select the configuration of the chilled water circuit, which drives how pump
          and compressor energy behave at part load.
        </p>
      </header>

      <AirSystems
        zones={zones}
        air={air}
        onChange={onAirChange}
        reducedOccupancy={reducedOccupancy}
      />

      <section className="panel">
        <h3 className="panel-title">System configuration</h3>
        <p className="panel-text">
          {SYSTEM_LAYOUTS.length} configurations available. Selecting one shows its
          schematic below.
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
    </div>
  );
}
