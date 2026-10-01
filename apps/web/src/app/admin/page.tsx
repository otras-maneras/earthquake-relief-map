import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import AdminClient from './AdminClient';

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect('/admin/login');
  return <AdminClient user={{ name: session.name, role: session.role }} />;
}
