import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import CampanasClient from './CampanasClient';

export default async function CampanasPage() {
  const session = await getSession();
  if (!session) redirect('/admin/login');
  return <CampanasClient />;
}
