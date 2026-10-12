import NumberField from './NumberField';
import {
  METRIC_FIELDS,
  WINDOW_TYPES,
  averageRooms,
  emptyMetrics,
  newZone,
  projectTotals,
  resolveZone,
  sovSampleZones,
  uid,
  type Room,
  type WindowType,
  type Zone,
  type ZoneMetrics,
} from '../lib/zones';

interface Props {
  zones: Zone[];
  /** Takes an updater so quick successive edits cannot clobber each other. */
  onChange: (update: (zones: Zone[]) => Zone[]) => void;
}

const fmt = (n: number, digits = 1) =>
  Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : '—';

const MetricHeads = () => (
  <>
    {METRIC_FIELDS.map((f) => (
      <th key={f.key} scope="col" className="zone-num">
        {f.label}
        <span className="zone-unit">{f.unit}</span>
      </th>
    ))}
  </>
);

/** One row of averaged per-room values, in the same columns as the room table. */
function AverageTable({
  metrics,
  onChange,
}: {
  metrics: ZoneMetrics;
  onChange: (patch: Partial<ZoneMetrics>) => void;
}) {
  return (
    <div className="table-scroll">
      <table className="zone-table">
        <thead>
          <tr>
            <MetricHeads />
          </tr>
        </thead>
        <tbody>
          <tr>
            {METRIC_FIELDS.map((f) => (
              <td key={f.key}>
                <NumberField
                  value={metrics[f.key]}
                  step={f.step}
                  aria-label={f.label}
                  onChange={(v) => onChange({ [f.key]: v })}
                />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function RoomTable({ rooms, onChange }: { rooms: Room[]; onChange: (rooms: Room[]) => void }) {
  const averages = averageRooms(rooms);
  const patch = (id: string, values: Partial<Room>) =>
    onChange(rooms.map((r) => (r.id === id ? { ...r, ...values } : r)));

  return (
    <>
      <div className="table-scroll">
        <table className="zone-table">
          <thead>
            <tr>
              <th scope="col">Room</th>
              <MetricHeads />
              <th scope="col" aria-label="Remove" />
            </tr>
          </thead>
          <tbody>
            {rooms.length === 0 && (
              <tr>
                <td colSpan={METRIC_FIELDS.length + 2} className="zone-empty">
                  No rooms yet. Add rooms to compute the group average.
                </td>
              </tr>
            )}
            {rooms.map((room) => (
              <tr key={room.id}>
                <td>
                  <input
                    className="field-input zone-name"
                    type="text"
                    aria-label="Room name"
                    value={room.name}
                    onChange={(e) => patch(room.id, { name: e.target.value })}
                  />
                </td>
                {METRIC_FIELDS.map((f) => (
                  <td key={f.key}>
                    <NumberField
                      value={room[f.key]}
                      step={f.step}
                      aria-label={`${room.name} ${f.label}`}
                      onChange={(v) => patch(room.id, { [f.key]: v })}
                    />
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="icon-btn icon-btn-danger"
                    title="Remove room"
                    aria-label={`Remove ${room.name}`}
                    onClick={() => onChange(rooms.filter((r) => r.id !== room.id))}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {rooms.length > 0 && (
            <tfoot>
              <tr>
                <th scope="row">Average ({rooms.length})</th>
                {METRIC_FIELDS.map((f) => (
                  <td key={f.key} className="zone-num">
                    {fmt(averages[f.key], 2)}
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-small zone-add-room"
        onClick={() =>
          onChange([...rooms, { id: uid(), name: `Room ${rooms.length + 1}`, ...emptyMetrics() }])
        }
      >
        + Add room
      </button>
    </>
  );
}

function ZoneCard({
  zone,
  index,
  onChange,
  onRemove,
}: {
  zone: Zone;
  index: number;
  onChange: (patch: Partial<Zone>) => void;
  onRemove: () => void;
}) {
  const { count, totals } = resolveZone(zone);
  const chips: { label: string; value: number; unit: string; digits?: number }[] = [
    { label: 'Area', value: totals.area_m2, unit: 'm²' },
    { label: 'Persons', value: totals.persons, unit: '' },
    { label: 'Volume', value: totals.volume_m3, unit: 'm³' },
    { label: 'Fresh air', value: totals.freshAir_m3h, unit: 'm³/h' },
    { label: 'Equip', value: totals.equip_kW, unit: 'kW', digits: 3 },
  ];

  return (
    <li className="zone-card">
      <div className="zone-card-head">
        <span className="zone-index" aria-hidden="true">
          {index + 1}
        </span>
        <div className="field zone-code">
          <label className="field-label" htmlFor={`zone-id-${zone.uid}`}>
            Group code
          </label>
          <input
            id={`zone-id-${zone.uid}`}
            className="field-input"
            type="text"
            value={zone.id}
            onChange={(e) => onChange({ id: e.target.value })}
          />
        </div>
        <div className="field zone-description">
          <label className="field-label" htmlFor={`zone-desc-${zone.uid}`}>
            Description
          </label>
          <input
            id={`zone-desc-${zone.uid}`}
            className="field-input"
            type="text"
            placeholder="e.g. Interior accommodation"
            value={zone.description}
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </div>
        <button
          type="button"
          className="icon-btn icon-btn-danger"
          title="Remove room group"
          aria-label={`Remove room group ${zone.id}`}
          onClick={onRemove}
        >
          ✕
        </button>
      </div>

      <div className="zone-controls">
        <div className="field">
          <span className="field-label">Input mode</span>
          <div className="zone-mode" role="group" aria-label="Input mode">
            <button
              type="button"
              className={`chip${zone.mode === 'average' ? ' is-active' : ''}`}
              aria-pressed={zone.mode === 'average'}
              onClick={() => onChange({ mode: 'average' })}
            >
              Average
            </button>
            <button
              type="button"
              className={`chip${zone.mode === 'rooms' ? ' is-active' : ''}`}
              aria-pressed={zone.mode === 'rooms'}
              onClick={() => onChange({ mode: 'rooms' })}
            >
              Room by room
            </button>
          </div>
        </div>
        <div className="field zone-small">
          <label className="field-label" htmlFor={`zone-wt-${zone.uid}`}>
            Window type
          </label>
          <select
            id={`zone-wt-${zone.uid}`}
            className="field-input"
            value={zone.window_type}
            onChange={(e) => onChange({ window_type: e.target.value as WindowType })}
          >
            {WINDOW_TYPES.map((wt) => (
              <option key={wt} value={wt}>
                {wt}
              </option>
            ))}
          </select>
        </div>
        {zone.mode === 'average' && (
          <div className="field zone-small">
            <span className="field-label">Room count</span>
            <NumberField
              value={zone.count}
              step={1}
              aria-label="Room count"
              onChange={(v) => onChange({ count: Math.round(v) })}
            />
          </div>
        )}
        <p className="zone-mode-hint">
          {zone.mode === 'average'
            ? 'Enter averaged per-room values directly.'
            : 'Enter each room; the average is computed automatically.'}
        </p>
      </div>

      {zone.mode === 'average' ? (
        <AverageTable
          metrics={zone.averages}
          onChange={(patch) => onChange({ averages: { ...zone.averages, ...patch } })}
        />
      ) : (
        <RoomTable rooms={zone.rooms} onChange={(rooms) => onChange({ rooms })} />
      )}

      <div className="zone-totals">
        <span>
          Group totals ({count} {count === 1 ? 'room' : 'rooms'})
        </span>
        {chips.map((chip) => (
          <span className="spec-chip" key={chip.label}>
            {chip.label} <strong>{fmt(chip.value, chip.digits ?? 2)}</strong> {chip.unit}
          </span>
        ))}
      </div>
    </li>
  );
}

/**
 * Step 1 — room group definition. Each group is a set of similar rooms, entered
 * as per-room averages or room by room.
 */
export default function RoomGroups({ zones, onChange }: Props) {
  const totals = projectTotals(zones);
  const roomCount = zones.reduce((n, z) => n + resolveZone(z).count, 0);

  return (
    <section className="panel">
      <div className="library-head">
        <div>
          <h3 className="panel-title">Room group definition</h3>
          <p className="panel-text">
            Define each room group's geometry and basic parameters. Enter averaged
            values directly, or build the average room by room.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={() => onChange(() => sovSampleZones())}
        >
          Reset to SOV example
        </button>
      </div>

      {zones.length === 0 ? (
        <p className="library-empty">No room groups defined yet.</p>
      ) : (
        <ol className="zone-list">
          {zones.map((zone, i) => (
            <ZoneCard
              key={zone.uid}
              zone={zone}
              index={i}
              onChange={(patch) =>
                onChange((prev) => prev.map((z) => (z.uid === zone.uid ? { ...z, ...patch } : z)))
              }
              onRemove={() => onChange((prev) => prev.filter((z) => z.uid !== zone.uid))}
            />
          ))}
        </ol>
      )}

      <button
        type="button"
        className="btn btn-ghost zone-add"
        onClick={() => onChange((prev) => [...prev, newZone(prev.length + 1)])}
      >
        + Add room group
      </button>

      {zones.length > 0 && (
        <>
          <h4 className="library-group-title zone-summary-title">Project summary</h4>
          <div className="table-scroll">
            <table className="zone-table zone-summary">
              <thead>
                <tr>
                  <th scope="col">Room group</th>
                  <th scope="col" className="zone-num">Rooms</th>
                  <th scope="col" className="zone-num">Area m²</th>
                  <th scope="col" className="zone-num">Persons</th>
                  <th scope="col" className="zone-num">Volume m³</th>
                  <th scope="col" className="zone-num">Fresh air m³/h</th>
                  <th scope="col" className="zone-num">Equip kW</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z) => {
                  const r = resolveZone(z);
                  return (
                    <tr key={z.uid}>
                      <th scope="row">
                        {z.id}
                        {z.description && <span className="zone-unit">{z.description}</span>}
                      </th>
                      <td className="zone-num">{r.count}</td>
                      <td className="zone-num">{fmt(r.totals.area_m2)}</td>
                      <td className="zone-num">{fmt(r.totals.persons)}</td>
                      <td className="zone-num">{fmt(r.totals.volume_m3)}</td>
                      <td className="zone-num">{fmt(r.totals.freshAir_m3h)}</td>
                      <td className="zone-num">{fmt(r.totals.equip_kW, 3)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td className="zone-num">{roomCount}</td>
                  <td className="zone-num">{fmt(totals.area_m2)}</td>
                  <td className="zone-num">{fmt(totals.persons)}</td>
                  <td className="zone-num">{fmt(totals.volume_m3)}</td>
                  <td className="zone-num">{fmt(totals.freshAir_m3h)}</td>
                  <td className="zone-num">{fmt(totals.equip_kW, 3)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
