import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Waypoint } from '../types';

interface Props {
  waypoints: Waypoint[];
  selectedId: string | null;
  onAdd: (lat: number, lon: number) => void;
  onSelect: (id: string) => void;
  onMove: (id: string, lat: number, lon: number) => void;
}

const numberedIcon = (index: number, active: boolean) =>
  L.divIcon({
    className: '',
    html: `<span class="map-pin${active ? ' is-active' : ''}">${index + 1}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

/**
 * Leaflet map with an OpenStreetMap base layer and the OpenSeaMap nautical
 * overlay. Clicking the map appends a waypoint; markers can be dragged.
 *
 * Tiles are fetched from the public OSM and OpenSeaMap servers, so the map needs
 * an internet connection. Swapping in another tile provider — or Google — only
 * touches this file.
 */
export default function ItineraryMap({
  waypoints,
  selectedId,
  onAdd,
  onSelect,
  onMove,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  // Keep the latest callbacks without re-registering the map click handler.
  const handlers = useRef({ onAdd, onSelect, onMove });
  handlers.current = { onAdd, onSelect, onMove };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [60.4, 5.3],
      zoom: 5,
      worldCopyJump: true,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
      attribution: '© OpenSeaMap',
      maxZoom: 18,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      handlers.current.onAdd(e.latlng.lat, e.latlng.lng);
    });

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Redraw markers and the route line whenever the itinerary changes.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();

    if (waypoints.length > 1) {
      L.polyline(
        waypoints.map((w) => [w.lat, w.lon] as L.LatLngTuple),
        { className: 'map-route', weight: 3 },
      ).addTo(layer);
    }

    waypoints.forEach((wp, index) => {
      L.marker([wp.lat, wp.lon], {
        icon: numberedIcon(index, wp.id === selectedId),
        draggable: true,
        keyboard: false,
      })
        .on('click', () => handlers.current.onSelect(wp.id))
        .on('dragend', (e) => {
          const { lat, lng } = (e.target as L.Marker).getLatLng();
          handlers.current.onMove(wp.id, lat, lng);
        })
        .bindTooltip(`${index + 1}. ${wp.name}`, { direction: 'top', offset: [0, -12] })
        .addTo(layer);
    });
  }, [waypoints, selectedId]);

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="map-canvas" />
      <p className="map-hint">
        Click the map to add a stop. Drag a marker to reposition it.
      </p>
    </div>
  );
}
