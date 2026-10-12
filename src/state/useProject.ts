import { useCallback, useEffect, useState } from 'react';
import type { ProjectData } from '../types';
import { designParameterDefaults } from '../data/designParameters';
import { DEFAULT_PLAN, normalizePlan } from '../data/regions';
import { emptyAirSetup, normalizeAirSetup } from '../lib/airSystems';
import { emptyHvacDesign, normalizeHvacDesign } from '../lib/hvacDesign';
import { normalizeZones, sovSampleZones } from '../lib/zones';

const STORAGE_KEY = 'energy-calculator.project';

const emptyProject = (): ProjectData => ({
  projectName: '',
  // A new project starts as a service operation vessel with its room groups.
  vesselId: 'sov',
  zones: sovSampleZones(),
  weather: { plan: [...DEFAULT_PLAN] },
  design: designParameterDefaults(),
  hvac: emptyHvacDesign(),
  air: emptyAirSetup(),
  system: { layout: null, parameters: {} },
});

const load = (): ProjectData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProject();
    // Merge over the defaults so newly added parameters appear in old projects.
    const stored = JSON.parse(raw) as Partial<ProjectData>;
    const base = emptyProject();
    return {
      ...base,
      ...stored,
      // Rebuilt rather than merged: projects saved before the annual plan carry
      // an itinerary here, which is dropped.
      zones: normalizeZones(stored.zones),
      hvac: normalizeHvacDesign(stored.hvac),
      air: normalizeAirSetup(stored.air),
      weather: { plan: normalizePlan(stored.weather?.plan) },
      design: { ...base.design, ...stored.design },
      system: { ...base.system, ...stored.system },
    };
  } catch {
    return emptyProject();
  }
};

/** Wizard data, persisted to localStorage so a reload does not lose the input. */
export function useProject() {
  const [project, setProject] = useState<ProjectData>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  }, [project]);

  /**
   * Accepts a plain patch, or a function of the current project for updates that
   * build on existing state — the function form is required when several updates
   * can land before React re-renders (e.g. two quick map clicks), otherwise the
   * later one is computed from stale props and clobbers the earlier.
   */
  const update = useCallback(
    (patch: Partial<ProjectData> | ((p: ProjectData) => Partial<ProjectData>)) => {
      setProject((p) => ({ ...p, ...(typeof patch === 'function' ? patch(p) : patch) }));
    },
    [],
  );

  const reset = useCallback(() => setProject(emptyProject()), []);

  return { project, update, reset };
}
