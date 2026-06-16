import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  latitude: number | null;
  longitude: number | null;
  radius: number;
  onChange: (lat: number, lng: number) => void;
}

/**
 * Free map picker (OpenStreetMap tiles via Leaflet — no API key, no cost).
 * Click the map to drop the school location; a circle shows the geofence radius.
 * Uses a CircleMarker (SVG) so there are no bundler marker-icon issues.
 */
export function LocationPicker({ latitude, longitude, radius, onChange }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Initialise the map once.
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const hasPoint = latitude != null && longitude != null;
    const start: [number, number] = hasPoint ? [latitude!, longitude!] : [20.5937, 78.9629];
    const map = L.map(elRef.current).setView(start, hasPoint ? 16 : 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => onChangeRef.current(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    // The container is often sized after mount — recompute tiles.
    setTimeout(() => map.invalidateSize(), 150);
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the marker + radius circle in sync.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (latitude == null || longitude == null) {
      markerRef.current?.remove();
      circleRef.current?.remove();
      markerRef.current = null;
      circleRef.current = null;
      return;
    }
    const ll: [number, number] = [latitude, longitude];
    if (!markerRef.current) {
      markerRef.current = L.circleMarker(ll, {
        radius: 7,
        color: "#4f46e5",
        fillColor: "#4f46e5",
        fillOpacity: 1,
      }).addTo(map);
      circleRef.current = L.circle(ll, {
        radius,
        color: "#4f46e5",
        fillColor: "#4f46e5",
        fillOpacity: 0.12,
      }).addTo(map);
      map.setView(ll, 16);
    } else {
      markerRef.current.setLatLng(ll);
      circleRef.current!.setLatLng(ll).setRadius(radius);
      // Keep the selected point centered when it changes (current-location / edits).
      map.panTo(ll);
    }
  }, [latitude, longitude, radius]);

  return <div ref={elRef} className="map-picker" />;
}
