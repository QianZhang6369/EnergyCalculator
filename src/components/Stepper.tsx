export interface StepDefinition {
  id: number;
  title: string;
  subtitle: string;
}

interface Props {
  steps: StepDefinition[];
  current: number;
  /** Steps the user is allowed to jump to directly. */
  reachable: (step: number) => boolean;
  onSelect: (step: number) => void;
}

export default function Stepper({ steps, current, reachable, onSelect }: Props) {
  return (
    <nav className="stepper" aria-label="Wizard steps">
      {steps.map((step, index) => {
        const state =
          step.id === current ? 'current' : step.id < current ? 'done' : 'upcoming';
        const enabled = reachable(step.id);
        return (
          <button
            key={step.id}
            type="button"
            className={`step step-${state}`}
            disabled={!enabled}
            aria-current={step.id === current ? 'step' : undefined}
            onClick={() => enabled && onSelect(step.id)}
          >
            <span className="step-index">{state === 'done' ? '✓' : index + 1}</span>
            <span className="step-text">
              <span className="step-title">{step.title}</span>
              <span className="step-subtitle">{step.subtitle}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
