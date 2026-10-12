import type { ParamField } from './designParameters';
import type { SystemLayoutId } from '../types';

export type SystemFamily = 'Simplified' | 'Chilled water' | 'With free cooling' | 'Integrated';

export interface SystemLayout {
  id: SystemLayoutId;
  name: string;
  family: SystemFamily;
  /** One-liner under the name in the selection list — the only prose still shown. */
  tagline: string;
  /** Whether the load calculation models this configuration. Only the simplified chiller is. */
  modelled: boolean;
  /**
   * Longer prose and pros/cons. Neither is rendered any more: the description
   * above the schematic and the cards below it were both removed. Kept because
   * this is the data a side-by-side comparison view would need — delete both
   * fields if that view is not wanted.
   */
  description: string;
  characteristics: { label: string; value: string }[];
  /** Fields shown in the per-configuration section. */
  fields: ParamField[];
}

export const SYSTEM_FAMILIES: SystemFamily[] = [
  'Simplified',
  'Chilled water',
  'With free cooling',
  'Integrated',
];

/**
 * Placeholder fields for the per-configuration section, until it is decided what
 * each configuration actually needs there. Keys must stay unique so the values
 * persist independently.
 */
const TBC_FIELDS: ParamField[] = [
  { key: 'tbc1', label: 'To be continued', defaultValue: '' },
  { key: 'tbc2', label: 'To be continued', defaultValue: '' },
  { key: 'tbc3', label: 'To be continued', defaultValue: '' },
];

/** Equipment selections stored per project. */
export const PLANT_SELECTION_KEYS = ['chillerId', 'pumpId'] as const;

/** What a new project starts on — the configuration the load calculation models. */
export const DEFAULT_LAYOUT: SystemLayoutId = 'simplified-chiller';

export const SYSTEM_LAYOUTS: SystemLayout[] = [
  {
    id: 'simplified-chiller',
    name: 'Simplified chiller',
    family: 'Simplified',
    modelled: true,
    tagline: 'Fixed COP',
    description:
      'The chiller is reduced to one figure: electricity is the chiller cooling load ' +
      'divided by a fixed COP. Pumps, valves and part-load behaviour are not modelled.',
    characteristics: [
      { label: 'Compressor energy', value: 'Cooling load ÷ fixed COP' },
      { label: 'Pump energy', value: 'Not modelled' },
    ],
    fields: [],
  },
  {
    id: 'chiller-2way',
    name: 'Chiller + two-way valve',
    family: 'Chilled water',
    modelled: false,
    tagline: 'Variable flow',
    description:
      'Each air handling unit coil is controlled by a two-way valve. As the valves close, ' +
      'the flow through the system drops and the pump can slow down, so pump energy follows ' +
      'the load. A minimum-flow bypass protects the chiller evaporator at low load.',
    characteristics: [
      { label: 'Flow', value: 'Variable' },
      { label: 'Water ΔT at part load', value: 'Maintained' },
      { label: 'Pump energy', value: 'Low — follows the load' },
      { label: 'Watch out for', value: 'Minimum evaporator flow' },
    ],
    fields: TBC_FIELDS,
  },
  {
    id: 'chiller-3way',
    name: 'Chiller + three-way valve',
    family: 'Chilled water',
    modelled: false,
    tagline: 'Constant flow',
    description:
      'Each coil is fitted with a three-way valve that diverts unused water around the coil. ' +
      'System flow stays roughly constant regardless of load, which keeps the chiller ' +
      'evaporator safe but means the pump runs at full power all the time.',
    characteristics: [
      { label: 'Flow', value: 'Constant' },
      { label: 'Water ΔT at part load', value: 'Degrades (low ΔT syndrome)' },
      { label: 'Pump energy', value: 'High — constant' },
      { label: 'Watch out for', value: 'Return water temperature' },
    ],
    fields: TBC_FIELDS,
  },
  {
    id: 'chiller-2way-fc',
    name: 'Chiller + two-way valve + free cooling',
    family: 'With free cooling',
    modelled: false,
    tagline: 'Variable flow',
    description:
      'As the two-way arrangement, plus a plate heat exchanger in the return line fed by ' +
      'seawater. When the sea is cold enough the compressors unload or stop and the heat ' +
      'exchanger carries the load, leaving only pump power. The saving depends entirely on ' +
      'how much of the itinerary sits below the changeover temperature.',
    characteristics: [
      { label: 'Flow', value: 'Variable' },
      { label: 'Water ΔT at part load', value: 'Maintained' },
      { label: 'Pump energy', value: 'Low — follows the load' },
      { label: 'Compressor energy', value: 'None while free cooling' },
      { label: 'Watch out for', value: 'Changeover hunting, fouling' },
    ],
    fields: TBC_FIELDS,
  },
  {
    id: 'chiller-3way-fc',
    name: 'Chiller + three-way valve + free cooling',
    family: 'With free cooling',
    modelled: false,
    tagline: 'Constant flow',
    description:
      'As the three-way arrangement, plus a seawater plate heat exchanger in the return ' +
      'line. Compressor energy falls away in cold water, but the pumps still run at full ' +
      'flow, so the saving is smaller than the two-way version of the same idea.',
    characteristics: [
      { label: 'Flow', value: 'Constant' },
      { label: 'Water ΔT at part load', value: 'Degrades (low ΔT syndrome)' },
      { label: 'Pump energy', value: 'High — constant' },
      { label: 'Compressor energy', value: 'None while free cooling' },
      { label: 'Watch out for', value: 'Low ΔT limits free-cooling hours' },
    ],
    fields: TBC_FIELDS,
  },
  {
    id: 'tems',
    name: 'Thermal energy management system',
    family: 'Integrated',
    modelled: false,
    tagline: 'Heating and cooling with recovery',
    description:
      'Cooling and heating are served by the same machines. Condenser heat that a chiller ' +
      'would reject to sea is recovered for hot water and reheat, a reversible heat pump ' +
      'covers the rest, and a buffer store decouples the two demands in time. Most ' +
      'effective when heating and cooling occur at once — which is the normal state on a ' +
      'vessel with simultaneous internal and perimeter zones.',
    characteristics: [
      { label: 'Flow', value: 'Variable, both loops' },
      { label: 'Pump energy', value: 'Low — follows the load' },
      { label: 'Compressor energy', value: 'Offset by recovered heat' },
      { label: 'Best case', value: 'Simultaneous heating and cooling' },
      { label: 'Watch out for', value: 'Control complexity, store sizing' },
    ],
    fields: TBC_FIELDS,
  },
];

export const getLayout = (id: SystemLayoutId | null) =>
  SYSTEM_LAYOUTS.find((l) => l.id === id) ?? null;

export const systemDefaults = (id: SystemLayoutId): Record<string, string> => {
  const layout = getLayout(id);
  const fields = layout?.fields ?? [];
  return {
    chillerId: '',
    pumpId: '',
    ...Object.fromEntries(fields.map((f) => [f.key, f.defaultValue ?? ''] as const)),
  };
};
