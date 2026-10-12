/**
 * Step 4 parameters, grouped for the heat-balance calculation.
 *
 * `source: 'vessel'` marks a group that is filled in from the vessel selected in
 * step 1 — the user can still override any value. `source: 'user'` is theirs to
 * define from the start.
 */

export interface ParamField {
  key: string;
  label: string;
  unit?: string;
  type?: 'number' | 'text' | 'select';
  options?: string[];
  defaultValue?: string;
  hint?: string;
}

export interface ParamGroup {
  id: string;
  title: string;
  description: string;
  source: 'vessel' | 'user';
  /**
   * How the group responds to the vessel size scale in step 1.
   *
   * `scales` — extensive quantities: areas, volumes, counts. They grow with the
   * vessel.
   * `fixed`  — intensive properties: U-values, W/m², W/person. Properties of how
   * the vessel is built and fitted out, not of how big it is, so a larger vessel
   * of the same type keeps them.
   *
   * Groups are deliberately all-one-or-all-the-other. A group containing both
   * needs two contradictory-looking badges, which reads as a mistake.
   */
  scaling?: 'scales' | 'fixed';
  fields: ParamField[];
}

export const DESIGN_PARAMETER_GROUPS: ParamGroup[] = [
  {
    id: 'geometry',
    title: 'Building geometry & occupancy',
    description:
      'The quantities that make up the vessel: conditioned spaces, the boundary areas heat passes through, and the number of people aboard. Every value here grows with the size scale.',
    source: 'vessel',
    scaling: 'scales',
    fields: [
      { key: 'conditionedArea', label: 'Conditioned floor area', unit: 'm²', defaultValue: '1800' },
      {
        key: 'personsOnBoard',
        label: 'Persons on board',
        unit: 'pers',
        defaultValue: '215',
        hint: 'Scales with the vessel, holding its own occupant density constant.',
      },
      { key: 'conditionedVolume', label: 'Conditioned volume', unit: 'm³', defaultValue: '4680' },
      { key: 'numberOfDecks', label: 'Conditioned decks', unit: '–', defaultValue: '4' },
      {
        key: 'exposedBulkheadArea',
        label: 'Exposed bulkhead area',
        unit: 'm²',
        defaultValue: '1400',
        hint: 'Side and end boundaries of the accommodation exposed to outside air.',
      },
      { key: 'exposedDeckArea', label: 'Exposed deck area', unit: 'm²', defaultValue: '620' },
      { key: 'windowArea', label: 'Window area', unit: 'm²', defaultValue: '120' },
      {
        key: 'shellAreaSeawater',
        label: 'Boundary area to seawater',
        unit: 'm²',
        defaultValue: '180',
        hint: 'Conditioned boundaries below the waterline — these see sea temperature, not air.',
      },
    ],
  },
  {
    id: 'envelope',
    title: 'Thermal envelope',
    description:
      'How the vessel is built and insulated. None of these change with the size scale — a larger vessel of the same type is built the same way.',
    source: 'vessel',
    scaling: 'fixed',
    fields: [
      { key: 'uBulkhead', label: 'U-value outer bulkhead', unit: 'W/m²K', defaultValue: '0.9' },
      { key: 'uDeck', label: 'U-value exposed deck', unit: 'W/m²K', defaultValue: '1.1' },
      { key: 'uWindow', label: 'U-value window', unit: 'W/m²K', defaultValue: '2.6' },
      { key: 'uShell', label: 'U-value shell to seawater', unit: 'W/m²K', defaultValue: '1.4' },
      { key: 'solarFactor', label: 'Window solar factor (g)', unit: '–', defaultValue: '0.5' },
      {
        key: 'solarIrradiance',
        label: 'Design solar irradiance',
        unit: 'W/m²',
        defaultValue: '700',
        hint: 'Peak clear-sky value. Scaled over the day by hour; not taken from the step 2 profile.',
      },
    ],
  },
  {
    id: 'internal',
    title: 'Internal gains',
    description:
      'How much heat each person, and each square metre, gives off. These rates are set by the vessel type and do not change with size — but the total gain still grows, because the area and person count above do.',
    source: 'vessel',
    scaling: 'fixed',
    fields: [
      { key: 'sensiblePerPerson', label: 'Sensible heat per person', unit: 'W/pers', defaultValue: '75' },
      {
        key: 'occupancyFactor',
        label: 'Occupancy diversity',
        unit: '–',
        defaultValue: '0.75',
        hint: 'Average share of persons present in conditioned spaces.',
      },
      { key: 'lightingLoad', label: 'Lighting load', unit: 'W/m²', defaultValue: '8' },
      { key: 'equipmentLoad', label: 'Equipment load', unit: 'W/m²', defaultValue: '12' },
    ],
  },
  {
    id: 'indoor',
    title: 'Indoor design conditions',
    description: 'The temperatures the system has to hold. Below the heating set-point the plant heats; above the cooling set-point it cools.',
    source: 'user',
    fields: [
      { key: 'winterIndoorTemp', label: 'Heating set-point', unit: '°C', defaultValue: '22' },
      { key: 'summerIndoorTemp', label: 'Cooling set-point', unit: '°C', defaultValue: '25' },
    ],
  },
  {
    id: 'water',
    title: 'Chilled & heating water',
    description: 'Water-side temperatures used later by the plant model in step 3.',
    source: 'user',
    fields: [
      { key: 'chwSupplyTemp', label: 'Chilled water supply', unit: '°C', defaultValue: '7' },
      { key: 'chwReturnTemp', label: 'Chilled water return', unit: '°C', defaultValue: '12' },
      { key: 'hwSupplyTemp', label: 'Heating water supply', unit: '°C', defaultValue: '70' },
      { key: 'hwReturnTemp', label: 'Heating water return', unit: '°C', defaultValue: '50' },
    ],
  },
];

/**
 * Ventilation inputs. No longer shown on step 4, but the heat balance still
 * needs them, so their defaults are kept here and folded into the project data.
 * Move these fields into whichever step should own them (step 3 is the natural
 * home, being the air-side system) rather than deleting them.
 */
export const VENTILATION_FIELDS: ParamField[] = [
  { key: 'freshAirPerPerson', label: 'Fresh air per person', unit: 'm³/h·pers', defaultValue: '30' },
  {
    key: 'airChangeRate',
    label: 'Minimum fresh-air change rate',
    unit: '1/h',
    defaultValue: '1.0',
    hint: 'Outside air only — recirculated supply air carries no outdoor-air load.',
  },
  {
    key: 'heatRecovery',
    label: 'Ventilation heat recovery',
    unit: '%',
    defaultValue: '0',
    hint: 'Sensible effectiveness of any exhaust-air heat recovery.',
  },
];

/** Keys that step 1 fills in from the selected vessel. */
export const VESSEL_SOURCED_KEYS = DESIGN_PARAMETER_GROUPS.filter(
  (g) => g.source === 'vessel',
).flatMap((g) => g.fields.map((f) => f.key));

/** Flat map of `key -> defaultValue` used to initialise the form. */
export const designParameterDefaults = (): Record<string, string> =>
  Object.fromEntries(
    [
      ...DESIGN_PARAMETER_GROUPS.flatMap((g) => g.fields),
      ...VENTILATION_FIELDS,
    ].map((f) => [f.key, f.defaultValue ?? ''] as const),
  );
