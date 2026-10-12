# Energy Calculator — Marine HVAC

Four-step input wizard for a marine HVAC energy calculation. React + Vite + TypeScript.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## The four steps

| # | Step | File | State |
|---|------|------|-------|
| 1 | Vessel type | [Step1VesselType.tsx](src/steps/Step1VesselType.tsx) | Done — 3 vessels with figures |
| 2 | Weather condition | [Step2WeatherCondition.tsx](src/steps/Step2WeatherCondition.tsx) | Placeholder — free-text notes only |
| 3 | Air and water system | [Step3AirWaterSystem.tsx](src/steps/Step3AirWaterSystem.tsx) | Done — 2 layouts with schematics |
| 4 | Design parameters | [Step4DesignParameters.tsx](src/steps/Step4DesignParameters.tsx) | Template — 6 groups, 27 fields |

Wizard input is held in [useProject.ts](src/state/useProject.ts) and persisted to
`localStorage`, so a page reload does not lose the entered data. Stored values are
merged over the current defaults, so adding new parameters does not break saved
projects.

## Extending it

**Add a vessel** — append an entry to `VESSELS` in
[src/data/vessels.ts](src/data/vessels.ts), then add a drawing under the same
`figure` key in the `figures` registry in
[VesselFigure.tsx](src/components/figures/VesselFigure.tsx). The selection grid and
the summary panel pick it up automatically. To use a photo or GA drawing instead of
the built-in line art, the registry entry can simply return an `<img>`.

**Add or change design parameters** — edit `DESIGN_PARAMETER_GROUPS` in
[src/data/designParameters.ts](src/data/designParameters.ts). Each field supports
`label`, `unit`, `type` (`number` / `text` / `select`), `options`, `defaultValue`
and `hint`. The form renders itself from that definition.

**Add a system layout** — append to `SYSTEM_LAYOUTS` in
[src/data/systems.ts](src/data/systems.ts) and add the matching drawing in
[SystemSchematic.tsx](src/components/figures/SystemSchematic.tsx). Parameters shared
by all layouts live in `COMMON_SYSTEM_FIELDS`.

## Not implemented yet

- **Weather data model** (step 2) — planned: route / operating area, ambient dry-bulb
  and humidity profile, seawater temperature profile, time share per climate zone.
- **Calculation engine** — the "Run calculation" button on step 4 is a stub. Nothing
  downstream of the inputs exists yet.
- **Results / report page** — no fifth step.
