import { useEffect, useRef } from 'react';
import Icon from '../ui/Icon';

/**
 * Pluggable map container (Leaflet + OpenStreetMap, free/no key).
 *
 * Markers: [{ id, lat, lng, tone: 'success'|'warning'|'danger'|'info', label, onClick, popup }]
 *
 * When no coordinates exist the panel renders an accessible, list-style
 * fallback (map is never the ONLY way to reach data).
 */
export default function MapContainer({
  markers = [],
  height = 420,
  center,
  zoom = 12,
  title = 'City Map',
  fallbackTitle = 'Interactive map',
  demoNote = 'Coordinates are representative (demo) points.',
  fallback,
}) {
  const nodeRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    let map;
    let mounted = true;

    const coords = markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));

    if (coords.length === 0) return () => { mounted = false; };

    let leaflet;
    let tileLayer;

    async function init() {
      try {
        leaflet = await import('leaflet');
        if (!mounted || !nodeRef.current) return;

        const startCenter = center || coords[0] || { lat: 19.076, lng: 72.8777 };
        map = leaflet.map(nodeRef.current, { zoomControl: true }).setView([startCenter.lat, startCenter.lng], zoom);

        tileLayer = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 18,
        });
        tileLayer.addTo(map);

        const has = coords.length > 0;

        if (has) {
          const group = [];
          coords.forEach((m) => {
            const icon = leaflet.divIcon({
              className: 'app-marker-wrap',
              html: `<div class="app-marker app-marker-${m.tone || 'info'}"><span class="app-marker-pin"></span></div>`,
              iconSize: [22, 22],
              iconAnchor: [11, 22],
            });
            const marker = leaflet.marker([m.lat, m.lng], { icon });
            if (m.popup) {
              marker.bindPopup(
                `<div class="app-popup"><div class="app-popup-title">${m.popup.title}</div>${m.popup.desc ? `<div class="app-popup-desc">${m.popup.desc}</div>` : ''}</div>`
              );
            }
            marker.on('click', () => m.onClick && m.onClick(m));
            marker.addTo(map);
            group.push(marker);
          });

          if (group.length === 1) {
            map.setView(group[0].getLatLng(), zoom);
          } else {
            const bounds = leaflet.latLngBounds(group.map((g) => g.getLatLng()));
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
          }
        }
      } catch (err) {
        console.error('[MapContainer] Leaflet init failed:', err);
      }
    }

    init();

    return () => {
      mounted = false;
      setTimeout(() => {
        if (map) map.remove();
        mapRef.current = null;
      }, 0);
    };
  }, [markers, center, zoom]);

  const coords = markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));

  if (coords.length === 0) {
    return fallback ? (
      fallback
    ) : (
      <div className="map-fallback">
        <Icon name="map-pin" size={26} />
        <div>
          <strong>{fallbackTitle}</strong>
          <p>Map coordinates are not available for these records yet. Use the list view to review them.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="map-container">
      <div className="map-tools" aria-hidden="true">
        <span className="map-tools-title">{title}</span>
        {demoNote && <span className="map-demo-note">{demoNote}</span>}
      </div>
      <div className="map-canvas" ref={nodeRef} style={{ height }} aria-label={title} role="region" />
    </div>
  );
}