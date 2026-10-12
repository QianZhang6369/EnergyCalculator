import DesignSetup from '../components/DesignSetup';
import type { AirSetup } from '../lib/airSystems';
import { emptyHvacDesign, type HvacDesign } from '../lib/hvacDesign';
import type { Zone } from '../lib/zones';

interface Props {
  zones: Zone[];
  air: AirSetup;
  hvac: HvacDesign;
  onHvacChange: (update: (hvac: HvacDesign) => HvacDesign) => void;
}

export default function Step3DesignParameters({ zones, air, hvac, onHvacChange }: Props) {
  return (
    <div className="step-page">
      <header className="step-header">
        <h2>Design parameters</h2>
        <p>
          Basic parameters and per-AHU operating settings for the load calculation.
          The weather comes from step 2.
        </p>
      </header>

      <DesignSetup zones={zones} air={air} design={hvac} onChange={onHvacChange} />

      <div>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={() => onHvacChange(() => emptyHvacDesign())}
        >
          Reset to default values
        </button>
      </div>
    </div>
  );
}
