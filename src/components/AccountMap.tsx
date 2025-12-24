/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Circle, Popup, useMap } from 'react-leaflet';
import { AccountsService } from '../generated';

type AccountCircle = {
  id: string;
  name?: string;
  lat: number;
  lng: number;
  address?: string;
  revenue?: number;
};

const GEO_CACHE_KEY = 'account_geo_cache_v1';

function loadCache(): Record<string, { lat: number; lng: number }> {
  try {
    const raw = localStorage.getItem(GEO_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveCache(c: Record<string, { lat: number; lng: number }>) {
  try {
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(c));
  } catch { /* empty */ }
}

function buildAddress(a: any) {
  const parts = [a.address1_line1, a.address1_city, a.address1_stateorprovince, a.address1_postalcode, a.address1_country]
    .filter(Boolean);
  return parts.join(', ');
}

async function geocodeAddress(q: string) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'TerritoryManager/1.0 (+https://example.com)' } });
    if (!res.ok) return null;
    const arr = await res.json();
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const first = arr[0];
    return { lat: parseFloat(first.lat), lng: parseFloat(first.lon) };
  } catch (e) {
    console.error('geocode error', e);
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseRevenue(val: any): number {
  if (!val) return 0;
  const num = parseFloat(val);
  return Number.isFinite(num) ? Math.max(num, 0) : 0;
}

function colorFromRevenue(id: string): string {
  // Generate a consistent random color based on account ID
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

function radiusFromRevenue(revenue: number, zoom: number): number {
  // Direct mapping: 10M revenue = 1km radius
  const baseRadius = zoom < 5 ? revenue / 1000000 : revenue < 10000000 ? 1 : revenue / 10000000; // in km
  // Scale: lower zoom (zoom out) = larger circles, higher zoom (zoom in) = smaller circles
  const scale = Math.max(0.1, 13 - zoom); // At zoom 1, scale=14; at zoom 15+, scale=1
  return Math.min(baseRadius * scale * 1500, 100000); // Max 50km radius
}

const AccountMap: React.FC = () => {
  const [circles, setCircles] = useState<AccountCircle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const allAccounts: any[] = [];
        let options: any = { maxPageSize: 5000 };
        while (true) {
          const res = await AccountsService.getAll(options);
          // tolerant extraction: different SDKs return different shapes
          let accounts: any = (res as any).result ?? (res as any).value ?? (res as any).data ?? res;
          if (accounts && accounts.value) accounts = accounts.value;
          if (!Array.isArray(accounts)) accounts = [];
          allAccounts.push(...accounts);
          // Check for next link
          const nextLink = (res as any)['@odata.nextLink'];
          if (nextLink) {
            // Extract skip token from nextLink
            const url = new URL(nextLink);
            const skipToken = url.searchParams.get('$skiptoken');
            if (skipToken) {
              options.skipToken = skipToken;
            } else {
              break;
            }
          } else {
            break;
          }
        }

        console.log(`Retrieved ${allAccounts.length} accounts`);
        //alert(`Retrieved ${allAccounts.length} accounts`);

        const cache = loadCache();
        const out: AccountCircle[] = [];

        for (const a of allAccounts) {
          let lat = parseFloat(a.address1_latitude ?? a.address1_lat ?? '');
          let lng = parseFloat(a.address1_longitude ?? a.address1_long ?? '');

          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            const addr = buildAddress(a);
            if (addr) {
              const cached = cache[addr];
              if (cached) {
                lat = cached.lat;
                lng = cached.lng;
              } else {
                const g = await geocodeAddress(addr);
                if (g) {
                  lat = g.lat;
                  lng = g.lng;
                  cache[addr] = { lat: g.lat, lng: g.lng };
                  saveCache(cache);
                }
                // be kind to Nominatim
                await sleep(150);
              }
            }
          }

          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            const revenue = parseRevenue(a.revenue);
            out.push({ 
              id: a.accountid, 
              name: a.name, 
              lat, 
              lng, 
              address: buildAddress(a),
              revenue 
            });
          }
        }

        console.log(`Created ${out.length} circles`);
        //alert(`Created ${out.length} circles`);
        if (active) setCircles(out);
      } catch (e) {
        console.error(e);
        //alert('Error loading accounts: ' + e);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const CirclesLayer: React.FC<{ circles: AccountCircle[] }> = ({ circles }) => {
    const map = useMap();
    const [zoom, setZoom] = useState(map.getZoom());

    useEffect(() => {
      const handleZoom = () => setZoom(map.getZoom());
      map.on('zoomend', handleZoom);
      return () => {
        map.off('zoomend', handleZoom);
      };
    }, [map]);

    useEffect(() => {
      if (circles.length > 0) {
        const bounds = circles.map(c => [c.lat, c.lng] as [number, number]);
        map.fitBounds(bounds, { padding: [20, 20] });
      }
    }, [circles, map]);

    return (
      <>
        {circles.map((c) => (
          <Circle 
            key={c.id} 
            center={[c.lat, c.lng]} 
            radius={radiusFromRevenue(c.revenue || 0, zoom)}
            pathOptions={{
              color: colorFromRevenue(c.id),
              fillColor: colorFromRevenue(c.id),
              fillOpacity: 0.6,
              weight: 2,
              opacity: 0.8
            }}
          >
            <Popup>
              <div style={{ fontSize: '0.9rem' }}>
                <strong>{c.name}</strong>
                <div style={{ marginTop: '0.3rem', color: '#666' }}>{c.address}</div>
                {c.revenue && c.revenue > 0 && (
                  <div style={{ marginTop: '0.3rem', fontWeight: 'bold', color: '#0066cc' }}>
                    Revenue: ${(c.revenue / 1000000).toFixed(1)}M
                  </div>
                )}
              </div>
            </Popup>
          </Circle>
        ))}
      </>
    );
  };

  return (
    <div style={{ height: '100vh', width: '100vw', margin: 0, padding: 0 }}>
      {loading && <div style={{ position: 'absolute', top: '1rem', left: '1rem', background: 'white', padding: '0.5rem', borderRadius: '4px', zIndex: 1000 }}>Loading accounts and locations…</div>}
      <MapContainer 
        center={[20, 0]} 
        zoom={2} 
        minZoom={1}
        style={{ height: '100%', width: '100%' }}
        maxBounds={[[-85, -180], [85, 180]]}
        maxBoundsViscosity={1}
      >
        <TileLayer 
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
          attribution='© OpenStreetMap contributors'
          noWrap={true}
        />
        <CirclesLayer circles={circles} />
      </MapContainer>
    </div>
  );
};

export default AccountMap;
