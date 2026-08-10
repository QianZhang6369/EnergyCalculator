import type { ParamField } from '../data/designParameters';

interface Props {
  fields: ParamField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  /** Show the values but do not let them be edited. */
  readOnly?: boolean;
}

/** Renders a grid of labelled inputs from a field definition list. */
export default function ParameterFields({
  fields,
  values,
  onChange,
  readOnly = false,
}: Props) {
  // Guard here as well as on the element: `readOnly` stops a user typing, but
  // it does not stop a change event arriving by any other route.
  const handle = (key: string, value: string) => {
    if (readOnly) return;
    onChange(key, value);
  };
  return (
    <div className="field-grid">
      {fields.map((field) => {
        const id = `field-${field.key}`;
        return (
          <div className="field" key={field.key}>
            <label className="field-label" htmlFor={id}>
              {field.label}
              {field.unit && <span className="field-unit">{field.unit}</span>}
            </label>
            {field.type === 'select' ? (
              <select
                id={id}
                className="field-input"
                value={values[field.key] ?? ''}
                disabled={readOnly}
                onChange={(e) => handle(field.key, e.target.value)}
              >
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                className={`field-input${readOnly ? ' is-readonly' : ''}`}
                type={field.type === 'text' ? 'text' : 'number'}
                inputMode={field.type === 'text' ? undefined : 'decimal'}
                step="any"
                value={values[field.key] ?? ''}
                readOnly={readOnly}
                onChange={(e) => handle(field.key, e.target.value)}
              />
            )}
            {field.hint && <p className="field-hint">{field.hint}</p>}
          </div>
        );
      })}
    </div>
  );
}
