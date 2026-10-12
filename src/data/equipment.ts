/**
 * Equipment catalogue for the plant selection drop-downs in step 3.
 *
 * PLACEHOLDER DATA. The manufacturer names are deliberately generic and every
 * rating below is invented. Real vendor names are not used here on purpose —
 * publishing made-up capacities and COPs against a real company's product line
 * would be misleading. Replace this file with your own selection data (or point
 * it at a vendor catalogue) before the choice drives any calculation.
 *
 * The `id` is what gets stored in the project, so keep ids stable when editing.
 */

export interface EquipmentOption {
  id: string;
  manufacturer: string;
  model: string;
  /** One-line rating summary shown under the drop-down once selected. */
  rating: string;
}

export const CHILLERS: EquipmentOption[] = [
  {
    id: 'chl-a-200',
    manufacturer: 'Manufacturer A',
    model: 'Marine Chiller 200',
    rating: '200 kW · COP 4.1 · fixed speed · seawater cooled',
  },
  {
    id: 'chl-a-350',
    manufacturer: 'Manufacturer A',
    model: 'Marine Chiller 350',
    rating: '350 kW · COP 4.4 · fixed speed · seawater cooled',
  },
  {
    id: 'chl-b-300v',
    manufacturer: 'Manufacturer B',
    model: 'AquaMarine 300 VSD',
    rating: '300 kW · COP 5.0 · variable speed · seawater cooled',
  },
  {
    id: 'chl-b-500v',
    manufacturer: 'Manufacturer B',
    model: 'AquaMarine 500 VSD',
    rating: '500 kW · COP 5.2 · variable speed · seawater cooled',
  },
  {
    id: 'chl-c-400mag',
    manufacturer: 'Manufacturer C',
    model: 'TurboCore 400',
    rating: '400 kW · COP 6.1 · magnetic bearing · oil free',
  },
  {
    id: 'chl-c-700mag',
    manufacturer: 'Manufacturer C',
    model: 'TurboCore 700',
    rating: '700 kW · COP 6.3 · magnetic bearing · oil free',
  },
];

export const PUMPS: EquipmentOption[] = [
  {
    id: 'pmp-a-end65',
    manufacturer: 'Manufacturer A',
    model: 'EndSuction 65-200',
    rating: '45 m³/h · 25 m head · η 0.62 · fixed speed',
  },
  {
    id: 'pmp-a-end100',
    manufacturer: 'Manufacturer A',
    model: 'EndSuction 100-250',
    rating: '120 m³/h · 28 m head · η 0.68 · fixed speed',
  },
  {
    id: 'pmp-b-inline80',
    manufacturer: 'Manufacturer B',
    model: 'InLine 80 VSD',
    rating: '80 m³/h · 26 m head · η 0.71 · variable speed',
  },
  {
    id: 'pmp-b-inline150',
    manufacturer: 'Manufacturer B',
    model: 'InLine 150 VSD',
    rating: '180 m³/h · 30 m head · η 0.74 · variable speed',
  },
  {
    id: 'pmp-c-split125',
    manufacturer: 'Manufacturer C',
    model: 'SplitCase 125',
    rating: '250 m³/h · 32 m head · η 0.78 · variable speed',
  },
];

/** Manufacturers in catalogue order, for grouping the drop-down. */
export const manufacturersOf = (items: EquipmentOption[]): string[] => [
  ...new Set(items.map((i) => i.manufacturer)),
];

export const findEquipment = (items: EquipmentOption[], id: string | undefined) =>
  items.find((i) => i.id === id) ?? null;
