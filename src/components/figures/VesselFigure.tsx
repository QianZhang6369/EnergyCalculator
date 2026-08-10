/**
 * Representative drawing for each vessel type.
 *
 * These are placeholder line drawings so the app has no external assets. To use a
 * real photo or GA drawing instead, replace the entry in `figures` with
 * `() => <img src={...} alt="" />` — the callers do not care what is rendered.
 */

import type { ReactElement, ReactNode } from 'react';

const Sea = () => (
  <>
    <path
      className="fig-sea"
      d="M0 128 q 20 -6 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 V160 H0 Z"
    />
    <path
      className="fig-sea-line"
      d="M0 128 q 20 -6 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0"
    />
  </>
);

const Frame = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 320 160" role="img" aria-hidden="true" className="vessel-figure">
    {children}
    <Sea />
  </svg>
);

const Ferry = () => (
  <Frame>
    {/* hull */}
    <path className="fig-hull" d="M22 102 H294 l-18 26 H42 Z" />
    {/* enclosed vehicle deck */}
    <rect className="fig-body" x="36" y="82" width="240" height="20" />
    {/* passenger deck */}
    <rect className="fig-accom" x="52" y="60" width="212" height="22" />
    {/* bridge */}
    <rect className="fig-accom" x="76" y="44" width="120" height="16" />
    {/* funnel */}
    <path className="fig-body" d="M204 60 h26 l-4 -22 h-18 Z" />
    <g className="fig-detail">
      <line x1="60" y1="71" x2="256" y2="71" />
      <line x1="84" y1="52" x2="188" y2="52" />
      <line x1="44" y1="92" x2="268" y2="92" />
      {/* bow door */}
      <line x1="48" y1="82" x2="48" y2="102" />
    </g>
  </Frame>
);

const ServiceOperationVessel = () => (
  <Frame>
    <path className="fig-hull" d="M28 100 H288 l-18 28 H50 Z" />
    {/* accommodation block, forward */}
    <rect className="fig-accom" x="56" y="50" width="96" height="50" />
    {/* bridge */}
    <rect className="fig-body" x="66" y="38" width="56" height="12" />
    {/* mast */}
    <line className="fig-detail" x1="140" y1="50" x2="140" y2="24" />
    {/* motion-compensated walk-to-work gangway */}
    <rect className="fig-body" x="152" y="70" width="46" height="9" />
    {/* deck crane */}
    <rect className="fig-body" x="206" y="78" width="14" height="22" />
    <g className="fig-detail">
      <path d="M213 78 L 262 48" />
      <path d="M262 48 v 14" />
      {/* window rows */}
      <line x1="62" y1="62" x2="146" y2="62" />
      <line x1="62" y1="74" x2="146" y2="74" />
      <line x1="62" y1="86" x2="146" y2="86" />
      {/* aft working deck */}
      <line x1="152" y1="100" x2="280" y2="100" />
    </g>
  </Frame>
);

const CruiseShip = () => (
  <Frame>
    <path className="fig-hull" d="M24 100 H292 l-16 28 H44 Z" />
    {/* superstructure decks */}
    <g className="fig-accom">
      <path d="M40 100 V72 h226 v28 Z" />
      <path d="M56 72 V56 h192 v16 Z" />
      <path d="M78 56 V44 h150 v12 Z" />
    </g>
    {/* funnel */}
    <path className="fig-body" d="M186 44 h24 v-14 h-18 Z" />
    {/* window rows */}
    <g className="fig-detail">
      <line x1="46" y1="82" x2="260" y2="82" />
      <line x1="46" y1="92" x2="260" y2="92" />
      <line x1="62" y1="64" x2="242" y2="64" />
    </g>
  </Frame>
);

const figures: Record<string, () => ReactElement> = {
  ferry: Ferry,
  cruise: CruiseShip,
  sov: ServiceOperationVessel,
};

/**
 * Photos take precedence over the line drawings. Drop an image into
 * `src/assets/vessels/` named after the vessel's `figure` key — `ferry.jpg`,
 * `cruise.jpg`, `sov.jpg` — and it is picked up automatically at build time.
 * Nothing breaks if the folder is empty; the drawing above is used instead.
 */
const photos: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../assets/vessels/*.{png,jpg,jpeg,webp,avif}', {
      eager: true,
      import: 'default',
    }) as Record<string, string>,
  ).map(([path, url]) => [path.split('/').pop()!.replace(/\.[^.]+$/, ''), url]),
);

export default function VesselFigure({ figure }: { figure?: string }) {
  const photo = figure ? photos[figure] : undefined;
  if (photo) {
    return <img className="vessel-photo" src={photo} alt="" />;
  }

  const Component = figure ? figures[figure] : undefined;
  if (!Component) {
    return (
      <svg viewBox="0 0 320 160" className="vessel-figure" aria-hidden="true">
        <rect x="8" y="8" width="304" height="144" className="fig-placeholder" rx="6" />
        <text x="160" y="86" textAnchor="middle" className="fig-placeholder-text">
          no figure
        </text>
      </svg>
    );
  }
  return <Component />;
}
