import { useEffect, useState } from 'react';

interface Props {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  disabled?: boolean;
  'aria-label'?: string;
}

/**
 * Numeric input that keeps a local text buffer so the user can freely clear the
 * field or type intermediate values (e.g. "1.", "") without it snapping to 0.
 */
export default function NumberField({ value, onChange, step = 0.01, min = 0, ...rest }: Props) {
  const [text, setText] = useState(() => String(value));

  // Keep the buffer in sync when the value changes from outside, but not while
  // the user is mid-edit typing an equal value.
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="number"
      inputMode="decimal"
      className="field-input zone-number"
      step={step}
      min={min}
      value={text}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        if (next === '' || next === '-') return onChange(0);
        const parsed = Number(next);
        if (!Number.isNaN(parsed)) onChange(parsed);
      }}
      onBlur={() => setText(String(value))}
      {...rest}
    />
  );
}
