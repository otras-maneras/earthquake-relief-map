'use client';

import dynamic from 'next/dynamic';

const Mapa3DView = dynamic(() => import('./Mapa3DView'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center text-ap-muted text-sm bg-ap-bg">Cargando mapa 3D…</div>
  ),
});

export default function Mapa3DClient() {
  return <Mapa3DView />;
}
