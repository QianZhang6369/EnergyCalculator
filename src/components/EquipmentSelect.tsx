import { findEquipment, manufacturersOf, type EquipmentOption } from '../data/equipment';

interface Props {
  id: string;
  label: string;
  items: EquipmentOption[];
  value: string;
  onChange: (id: string) => void;
}

/**
 * Equipment picker grouped by manufacturer. The rating of the selected item is
 * shown underneath so the choice is not just an opaque model number.
 */
export default function EquipmentSelect({ id, label, items, value, onChange }: Props) {
  const selected = findEquipment(items, value);

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="field-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— Select —</option>
        {manufacturersOf(items).map((manufacturer) => (
          <optgroup key={manufacturer} label={manufacturer}>
            {items
              .filter((i) => i.manufacturer === manufacturer)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.model}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      <p className="field-hint">
        {selected ? `${selected.manufacturer} · ${selected.rating}` : 'Nothing selected yet.'}
      </p>
    </div>
  );
}
