import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../ui/Icon';

// Reusable city GIS layer (Leaflet + OpenStreetMap, free/no key).
//
// Markers: [{ id, layer: 'bins'|'complaints'|'vehicles'|'hotspots'|'wards',
//   lat, lng, tone, label, popup:{title,desc}, ref }]
// Only layers passed via `layers` are offered — never show unbacked layers.
// - Layer toggles (keyboard-accessible checkboxes with live counts)
// - Grid clustering for dense/coincident pins (no extra dependency)
// - Viewport culling with a render cap for city-scale datasets
// - Selection sync: onSelect(marker) on click; selectedId flies + highlights
// - List fallback preserved: map is never the only path to the data
const MAX_RENDER = 500;

const TONE_RANK = { danger: 4, warning: 3, high: 3, info: 2, success: 1 };

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function clusterCellSize(zoom) {
  if (zoom <= 10) return 0.02;
  if (zoom <= 12) return 0.008;
  if (zoom <= 14) return 0.003;
  return 0.0012;
}

export default function CityMap({
  markers = [],
  layers = [],
  selectedId = null,
  onSelect = null,
  title = 'City Map',
  height = 420,
  center,
  zoom = 12,
  fallbackTitle = 'Interactive map',
  emptyNote = 'Map coordinates are not available for these records yet. Use the list view to review them.',
  className = '',
}) {
  const nodeRef = useRef(null);
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const groupRef = useRef(null);
  const renderPinsRef = useRef(() => {});

  // Live refs so the persistent map instance always renders current data.
  // Synced in an effect (never written during render).
  const liveRef = useRef({ markers, layers, selectedId, onSelect, visible: null });
  useEffect(() => {
    liveRef.current = {
      markers, layers, selectedId, onSelect, visible: liveRef.current.visible,
    };
  });

  const [visibleLayers, setVisibleLayers] = useState(() => new Set(layers.map((l) => l.key)));
  const [renderInfo, setRenderInfo] = useState({ shown: 0, total: 0, capped: false });
  const [mapError, setMapError] = useState(false);

  // Reset toggles when the offered layer set changes; keep live ref in sync.
  useEffect(() => {
    setVisibleLayers((prev) => {
      const keys = layers.map((l) => l.key);
      const next = new Set(keys.filter((k) => prev.size === 0 || prev.has(k)));
      // First mount (prev empty because useState initializer ran with []) —
      // default to all on.
      const initial = keys.length > 0 && prev.size === 0 ? new Set(keys) : next;
      liveRef.current.visible = initial;
      return initial;
    });
  }, [layers]);

  useEffect(() => {
    liveRef.current.visible = visibleLayers;
    if (mapRef.current) renderPinsRef.current();
  }, [visibleLayers]);

  useEffect(() => {
    if (mapRef.current) renderPinsRef.current();
  }, [markers, selectedId]);

  const layerCounts = useMemo(() => {
    const counts = {};
    markers.forEach((m) => {
      if (Number.isFinite(m.lat) && Number.isFinite(m.lng)) counts[m.layer] = (counts[m.layer] || 0) + 1;
    });
    return counts;
  }, [markers]);

  const toggleLayer = (key) => {
    setVisibleLayers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    let mounted = true;

    function renderPins() {
      const leaflet = leafletRef.current;
      const map = mapRef.current;
      const group = groupRef.current;
      if (!leaflet || !map || !group || !mounted) return;
      group.clearLayers();

      const { markers: all, visible, selectedId: sel, onSelect: cb } = liveRef.current;
      const inScope = all.filter(
        (mk) => Number.isFinite(mk.lat) && Number.isFinite(mk.lng) && (!visible || visible.has(mk.layer)),
      );
      const bounds = map.getBounds().pad(0.15);
      const inView = inScope.filter((mk) => bounds.contains([mk.lat, mk.lng]));
      const capped = inView.length > MAX_RENDER;
      const working = capped ? inView.slice(0, MAX_RENDER) : inView;
      setRenderInfo({ shown: working.length, total: inScope.length, capped });

      const cell = clusterCellSize(map.getZoom());
      const cells = new Map();
      working.forEach((mk) => {
        const key = `${Math.floor(mk.lat / cell)}:${Math.floor(mk.lng / cell)}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(mk);
      });

      cells.forEach((cellMarkers) => {
        if (cellMarkers.length === 1) {
          addPin(leaflet, group, map, cellMarkers[0], sel, cb);
        } else {
          const lat = cellMarkers.reduce((a, x) => a + x.lat, 0) / cellMarkers.length;
          const lng = cellMarkers.reduce((a, x) => a + x.lng, 0) / cellMarkers.length;
          const worst = cellMarkers.reduce(
            (a, x) => ((TONE_RANK[x.tone] || 0) > (TONE_RANK[a.tone] || 0) ? x : a),
            cellMarkers[0],
          );
          const icon = leaflet.divIcon({
            className: 'app-marker-wrap',
            html: `<div class="app-cluster app-marker-${worst.tone || 'info'}">${cellMarkers.length}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          });
          const cm = leaflet.marker([lat, lng], { icon });
          cm.on('click', () => {
            const mm = mapRef.current;
            if (mm) mm.setView([lat, lng], Math.min(mm.getZoom() + 2, 17));
          });
          cm.addTo(group);
        }
      });
    }

    function addPin(leaflet, group, map, mk, sel, cb) {
      const isSel = sel != null && String(mk.id) === String(sel);
      const icon = leaflet.divIcon({
        className: 'app-marker-wrap',
        html: `<div class="app-marker app-marker-${mk.tone || 'info'}${isSel ? ' app-marker-selected' : ''}"><span class="app-marker-pin"></span></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 22],
      });
      const pin = leaflet.marker([mk.lat, mk.lng], { icon, title: mk.label || '' });
      if (mk.popup) {
        pin.bindPopup(
          `<div class="app-popup"><div class="app-popup-title">${escapeHtml(mk.popup.title)}</div>${
            mk.popup.desc ? `<div class="app-popup-desc">${escapeHtml(mk.popup.desc)}</div>` : ''
          }</div>`,
        );
      }
      pin.on('click', () => cb && cb(mk));
      pin.addTo(group);
      if (isSel) {
        map.setView([mk.lat, mk.lng], Math.max(map.getZoom(), 14));
        pin.openPopup();
      }
    }

    renderPinsRef.current = renderPins;

    async function init() {
      try {
        const leaflet = await import('leaflet');
        if (!mounted || !nodeRef.current) return;
        leafletRef.current = leaflet;

        const startCenter = center || { lat: 19.076, lng: 72.8777 };
        const map = leaflet.map(nodeRef.current, { zoomControl: true }).setView([startCenter.lat, startCenter.lng], zoom);
        mapRef.current = map;

        leaflet
          .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 18,
          })
          .addTo(map);

        groupRef.current = leaflet.layerGroup().addTo(map);
        map.on('moveend zoomend', renderPins);
        renderPins();
      } catch {
        if (mounted) setMapError(true);
      }
    }

    init();

    return () => {
      mounted = false;
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
          groupRef.current = null;
        }
      }, 0);
    };
    // Mount once: the instance persists; rendering reads live refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasCoords = markers.some((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));

  if (mapError) {
    return (
      <div className="map-fallback">
        <Icon name="map-pin" size={26} />
        <div>
          <strong>{fallbackTitle}</strong>
          <p>The map could not be loaded. Use the list view to review these records.</p>
        </div>
      </div>
    );
  }

  if (!hasCoords) {
    return (
      <div className="map-fallback">
        <Icon name="map-pin" size={26} />
        <div>
          <strong>{fallbackTitle}</strong>
          <p>{emptyNote}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`map-container citymap ${className}`}>
      <div className="map-tools">
        <span className="map-tools-title">{title}</span>
        {renderInfo.capped && (
          <span className="map-demo-note">
            Showing {renderInfo.shown} of {renderInfo.total} in view
          </span>
        )}
      </div>
      {layers.length > 0 && (
        <div className="map-layers" role="group" aria-label="Map layers">
          {layers.map((l) => (
            <label key={l.key} className="map-layer-toggle">
              <input
                type="checkbox"
                checked={visibleLayers.has(l.key)}
                onChange={() => toggleLayer(l.key)}
              />
              <span className={`map-layer-dot map-layer-dot-${l.tone || 'info'}`} aria-hidden="true" />
              {l.label}
              <span className="map-layer-count">{layerCounts[l.key] || 0}</span>
            </label>
          ))}
        </div>
      )}
      <div className="map-canvas" ref={nodeRef} style={{ height }} aria-label={title} role="region" />
    </div>
  );
}
