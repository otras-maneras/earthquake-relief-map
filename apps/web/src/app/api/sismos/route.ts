import { NextResponse } from 'next/server';

// Réplicas en vivo desde USGS (zona del epicentro). Excluye los 2 sismos
// principales (M7+, que ya se muestran como epicentros). Se cachea en CDN.
const USGS =
  'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
  '&starttime=2026-06-24&minmagnitude=3' +
  '&minlatitude=9&maxlatitude=12&minlongitude=-70&maxlongitude=-66' +
  '&orderby=time';

const CACHE = { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' };

export async function GET() {
  try {
    const r = await fetch(USGS, { next: { revalidate: 300 } });
    if (!r.ok) return NextResponse.json([], { headers: CACHE });
    const d = await r.json();
    const sismos = (d.features || [])
      .filter((f: any) => f?.properties?.mag != null && f.properties.mag < 7)
      .map((f: any) => ({
        id: f.id as string,
        mag: f.properties.mag as number,
        place: f.properties.place as string,
        time: f.properties.time as number,
        depth: f.geometry.coordinates[2] as number,
        lat: f.geometry.coordinates[1] as number,
        lng: f.geometry.coordinates[0] as number,
      }));
    return NextResponse.json(sismos, { headers: CACHE });
  } catch {
    return NextResponse.json([], { headers: CACHE });
  }
}
