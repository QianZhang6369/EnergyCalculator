# Vessel photos

Drop an image in here named after the vessel's `figure` key in
[`src/data/vessels.ts`](../../data/vessels.ts). It replaces the built-in line
drawing automatically — no code change needed.

| File to add | Used by | Vessels |
|---|---|---|
| `ferry.jpg` | `figure: 'ferry'` | Ro-Pax Ferry, Ro-Pax Ferry (large) |
| `cruise.jpg` | `figure: 'cruise'` | Cruise Ship, Expedition Cruise Ship |
| `sov.jpg` | `figure: 'sov'` | Service Operation Vessel, Commissioning SOV |

Accepted extensions: `.png`, `.jpg`, `.jpeg`, `.webp`, `.avif`.

If a file is missing, the SVG drawing in
[`VesselFigure.tsx`](../../components/figures/VesselFigure.tsx) is used instead, so
the app always renders.

## Notes

- Images are displayed in a **2:1 box with `object-fit: cover`**, so the middle
  band is what shows. Crop to roughly 2:1 (e.g. 1200×600) before dropping them in
  or the top and bottom of the ship will be cut off.
- Two vessels currently share each figure key. To give a vessel its own photo, add
  a new key — e.g. set `figure: 'csov'` on the Commissioning SOV and add
  `csov.jpg` here.
- **Check the licensing** before shipping this outside your team. Press and
  shipyard renders are usually copyrighted, and at least one of the candidate
  images carries a visible photographer watermark.
