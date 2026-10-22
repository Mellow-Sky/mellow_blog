import type { Metadata } from 'next';
import AdminPanel from '@/components/admin/AdminPanel';
import './admin.css';

export const metadata: Metadata = { title: '博客后台管理', robots: { index: false, follow: false } };

export default function AdminPage() {
  return <AdminPanel />;
}
