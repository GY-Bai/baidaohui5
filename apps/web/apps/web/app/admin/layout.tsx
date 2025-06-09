import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { AdminSidebar } from './_components/admin-sidebar';

export const metadata: Metadata = {
  title: '管理后台 - 百刀会',
  description: '百刀会管理后台',
};

interface AdminLayoutProps {
  children: ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const supabase = getSupabaseServerClient();
  
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/auth/sign-in');
  }

  // 检查用户权限
  const role = user.user_metadata?.role || 'fan';
  if (!['master', 'firstmate'].includes(role)) {
    redirect('/unauthorized');
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
} 