import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import SellerSidebar from './_components/seller-sidebar';

export default async function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = getSupabaseServerClient();
  
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // 检查用户是否登录
  if (authError || !user) {
    redirect('/auth/sign-in');
  }

  // 检查用户角色权限
  const role = user.user_metadata?.role || 'fan';
  if (role !== 'seller') {
    redirect('/unauthorized');
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 侧边栏 */}
      <div className="w-64 bg-white shadow-sm border-r">
        <SellerSidebar />
      </div>
      
      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部导航栏 */}
        <header className="bg-white shadow-sm border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">
              商户后台
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {user.email}
              </span>
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user.email?.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </header>
        
        {/* 页面内容 */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
} 