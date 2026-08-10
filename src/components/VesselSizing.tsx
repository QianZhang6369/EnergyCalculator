import {
  AREA_SCALE_MAX,
  AREA_SCALE_MIN,
  AREA_SCALE_STEP,
  designDefaultsFor,
  referenceAreaFor,
} from '../lib/vesselDefaults';
import type { DesignParameters, Vessel } from '../types';

interface Props {
  vessel: Vessel;
  design: DesignParameters;
  onChange: (design: DesignParameters) => void;
}

const num = (v: string | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmt = (v: number, digits = 0) =>
  v.toLocaleString(undefined, { maximumFractionDigits: digits });

/**
 * The single scaling knob. Conditioned area is the master figure — geometry,
 * envelope and internal gains are all re-derived from it, so one control
 * resizes the whole vessel.
 *
 * The control reads as a multiplier, but what gets STORED is the resulting
 * absolute area. Storing the factor instead would mean that correcting a
 * vessel's reference area in the catalogue silently resized every saved
 * project; storing the area does not.
 */
export default function VesselSizing({ vessel, design, onChange }: Props) {
  const reference = referenceAreaFor(vessel);
  const applied = num(design.conditionedArea) || reference;
  const scale = applied / reference;

  const setScale = (next: number) =>
    onChange({ ...design, ...designDefaultsFor(vessel, Math.round(reference * next)) });

  const persons = num(design.personsOnBoard);
  const internalGainKw =
    (persons * num(design.occupancyFactor) * num(design.sensiblePerPerson) +
      (num(design.lightingLoad) + num(design.equipmentLoad)) * applied) /
    1000;

  return (
    <section className="panel panel-vessel">
      <div className="library-head">
        <div>
          <h3 className="panel-title">Vessel size</h3>
          <p className="panel-text">
            Resizes the vessel. Areas, volumes and person counts scale with it;
            construction properties — U-values and the W/m² densities — stay fixed,
            because a larger vessel of the same type is built the same way. Nothing
            below is edited directly.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          disabled={Math.round(applied) === Math.round(reference)}
          onClick={() => setScale(1)}
        >
          Reset to 1.00×
        </button>
      </div>

      <div className="scale-control">
        <output className="scale-value" htmlFor="vessel-scale">
          {scale.toFixed(2)}×
        </output>
        <div className="scale-slider">
          <input
            id="vessel-scale"
            type="range"
            min={AREA_SCALE_MIN}
            max={AREA_SCALE_MAX}
            step={AREA_SCALE_STEP}
            value={scale}
            aria-label="Vessel size scale"
            onChange={(e) => setScale(Number(e.target.value))}
          />
          <div className="scale-ends">
            <span>{AREA_SCALE_MIN.toFixed(2)}×</span>
            <span>reference {fmt(reference)} m²</span>
            <span>{AREA_SCALE_MAX.toFixed(2)}×</span>
          </div>
        </div>
      </div>

      <dl className="fact-list">
        <div className="fact">
          <dt>Conditioned area</dt>
          <dd>{fmt(applied)} m²</dd>
        </div>
        <div className="fact">
          <dt>Persons on board</dt>
          <dd>{fmt(persons)}</dd>
          <dd className="fact-sub">occupant density held constant</dd>
        </div>
        <div className="fact">
          <dt>Internal gains</dt>
          <dd>{fmt(internalGainKw, 1)} kW</dd>
          <dd className="fact-sub">people, lighting, equipment</dd>
        </div>
      </dl>
    </section>
  );
}
