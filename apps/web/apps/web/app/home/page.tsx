import { PageBody, PageHeader } from '@kit/ui/page';
import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

import { DashboardDemo } from '~/home/_components/dashboard-demo';
import { SupabaseChatInterface } from '~/home/_components/supabase-chat-interface';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getCurrentUser() {
  try {
    // 这里应该从session中获取用户信息
    // 暂时返回模拟数据，实际应该从认证中间件获取
    return {
      id: 'user-123',
      name: '测试用户',
      email: 'test@example.com',
      role: 'member',
      avatar: undefined,
    };
  } catch (error) {
    console.error('获取用户信息失败:', error);
    redirect('/auth/sign-in');
  }
}

export default async function HomePage() {
  const currentUser = await getCurrentUser();

  return (
    <>
      <PageHeader description={'百刀会 - 聊天与AI助手'} />

      <PageBody>
        <div className="space-y-8">
          {/* 聊天界面 */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">聊天室</h2>
              <p className="text-gray-600 text-sm mt-1">
                与其他成员交流，或使用AI助手获得帮助
              </p>
            </div>
            <div className="p-6">
              <SupabaseChatInterface currentUser={currentUser} />
            </div>
          </div>

          {/* 原有的仪表盘演示 */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">仪表盘</h2>
              <p className="text-gray-600 text-sm mt-1">
                查看您的账户概览和统计信息
              </p>
            </div>
            <div className="p-6">
              <DashboardDemo />
            </div>
          </div>
        </div>
      </PageBody>
    </>
  );
}
