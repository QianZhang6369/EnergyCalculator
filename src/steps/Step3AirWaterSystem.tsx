import { SYSTEM_LAYOUTS, getLayout, systemDefaults } from '../data/systems';
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
  /** Fixed chiller COP of step 4, echoed under the selected configuration. */
  chillerCOP: number;
}

export default function Step3AirWaterSystem({
  system,
  onChange,
  zones,
  air,
  onAirChange,
  reducedOccupancy,
  chillerCOP,
}: Props) {
  const layout = getLayout(system.layout);

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
          select the configuration of the chilled water system.
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
          Select the chilled water configuration. Only the simplified chiller is
          modelled so far: the others can be selected and show their schematic, but
          the results are calculated as a simplified chiller.
        </p>

        <div className="config-grid" role="radiogroup" aria-label="System configuration">
          {SYSTEM_LAYOUTS.map((option) => {
            const isSelected = option.id === system.layout;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`config-card${isSelected ? ' is-selected' : ''}`}
                onClick={() => selectLayout(option.id)}
              >
                <span className="config-card-family">{option.family}</span>
                <span className="config-card-name">{option.name}</span>
                <span className="config-card-tagline">{option.tagline}</span>
                <span className={`tag${option.modelled ? '' : ' tag-muted'}`}>
                  {option.modelled ? 'Modelled' : 'Not modelled yet'}
                </span>
                <span className="library-row-check config-card-check" aria-hidden="true">
                  ✓
                </span>
              </button>
            );
          })}
        </div>

        {layout && (
          <div className="config-detail">
            <h4 className="library-group-title">{layout.name}</h4>
            <p className="panel-text">
              {layout.modelled
                ? 'Chiller electricity = chiller cooling load ÷ COP. Pumps, valves and part-load behaviour are not modelled.'
                : 'Not modelled yet — the results use the simplified chiller: chiller cooling load ÷ COP.'}{' '}
              COP {chillerCOP}, set in step 4 (Design parameters).
            </p>
            <div className={`schematic-frame${layout.id === 'tems' ? ' is-wide' : ''}`}>
              <SystemSchematic layout={layout.id} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
