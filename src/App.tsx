import { useMemo, useState } from 'react';
import Stepper, { type StepDefinition } from './components/Stepper';
import Step1VesselType from './steps/Step1VesselType';
import Step2WeatherCondition from './steps/Step2WeatherCondition';
import Step3DesignParameters from './steps/Step3DesignParameters';
import Step4AirWaterSystem from './steps/Step4AirWaterSystem';
import Step5Results from './steps/Step5Results';
import { useProject } from './state/useProject';
import { getVessel } from './data/vessels';
import { getLayout } from './data/systems';
import { regionsInPlan } from './data/regions';
import { designFromZones } from './lib/zones';
import './App.css';

const STEPS: StepDefinition[] = [
  { id: 1, title: 'Vessel type', subtitle: 'What are we designing for' },
  { id: 2, title: 'Weather condition', subtitle: 'Ambient & route' },
  { id: 3, title: 'Design parameters', subtitle: 'Loads & set-points' },
  { id: 4, title: 'Air and water system', subtitle: 'System configuration' },
  { id: 5, title: 'Results', subtitle: 'Load & energy' },
];

const RESULTS_STEP = 5;

export default function App() {
  const { project, update, reset } = useProject();
  const [step, setStep] = useState(1);

  // Resolved against the catalogue, so an id saved before a vessel was renamed or
  // removed does not count as a valid selection.
  const vessel = getVessel(project.vesselId);
  const layout = getLayout(project.system.layout);
  // Areas, persons and equipment come from the room groups; the rest of the
  // design is what the user set in step 3.
  const design = useMemo(
    () => ({ ...project.design, ...designFromZones(vessel, project.zones) }),
    [project.design, project.zones, vessel],
  );
  const regionCount = regionsInPlan(project.weather.plan).length;

  // Step 1 gates the input steps; results additionally need a system configuration.
  const reachable = (target: number) => {
    if (target === 1) return true;
    if (target === RESULTS_STEP) return vessel !== null && layout !== null;
    return vessel !== null;
  };

  const canContinue = step === 1 ? vessel !== null : true;

  const go = (target: number) => {
    setStep(Math.min(STEPS.length, Math.max(1, target)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ❄
          </span>
          <div>
            <h1>Energy Calculator</h1>
            <p>Marine HVAC system</p>
          </div>
        </div>

        <Stepper steps={STEPS} current={step} reachable={reachable} onSelect={go} />

        <div className="summary">
          <h2>Summary</h2>
          <dl>
            <div>
              <dt>Project</dt>
              <dd>{project.projectName || '—'}</dd>
            </div>
            <div>
              <dt>Vessel</dt>
              <dd>{vessel?.name ?? '—'}</dd>
            </div>
            <div>
              <dt>Weather</dt>
              <dd>
                {regionCount} region{regionCount === 1 ? '' : 's'}
              </dd>
            </div>
            <div>
              <dt>System</dt>
              <dd>{layout?.name ?? '—'}</dd>
            </div>
          </dl>
          <button type="button" className="btn btn-ghost btn-small" onClick={reset}>
            Clear all inputs
          </button>
        </div>
      </aside>

      <main className="content">
        <div className="content-inner">
          {step === 1 && (
            <Step1VesselType
              vesselId={project.vesselId}
              projectName={project.projectName}
              onSelect={(vesselId) => update({ vesselId })}
              onProjectNameChange={(projectName) => update({ projectName })}
              zones={project.zones}
              onZonesChange={(change) => update((p) => ({ zones: change(p.zones) }))}
            />
          )}
          {step === 2 && (
            <Step2WeatherCondition
              weather={project.weather}
              onChange={(weather) => update({ weather })}
            />
          )}
          {step === 3 && (
            <Step3DesignParameters
              design={project.design}
              onChange={(design) => update({ design })}
            />
          )}
          {step === 4 && (
            <Step4AirWaterSystem
              system={project.system}
              onChange={(system) => update({ system })}
            />
          )}
          {step === RESULTS_STEP && (
            <Step5Results
              design={design}
              plan={project.weather.plan}
              layout={project.system.layout}
            />
          )}
        </div>

        <footer className="wizard-footer">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={step === 1}
            onClick={() => go(step - 1)}
          >
            ← Back
          </button>
          <span className="wizard-progress">
            Step {step} of {STEPS.length}
          </span>
          {step === 4 ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={layout === null}
              title={layout ? undefined : 'Select a system configuration first'}
              onClick={() => go(RESULTS_STEP)}
            >
              Run calculation →
            </button>
          ) : step < STEPS.length ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canContinue}
              onClick={() => go(step + 1)}
              title={canContinue ? undefined : 'Select a vessel type to continue'}
            >
              Continue →
            </button>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => go(4)}>
              Back to inputs
            </button>
          )}
        </footer>
      </main>
    </div>
  );
}
