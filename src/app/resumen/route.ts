import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-static';
export const revalidate = 300;

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'presentacion.html');
    const html = await fs.promises.readFile(filePath, 'utf-8');
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    return new NextResponse('Error cargando presentación', { status: 500 });
  }
}
