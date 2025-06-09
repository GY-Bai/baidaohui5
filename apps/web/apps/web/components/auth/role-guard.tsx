'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { LoadingOverlay } from '@kit/ui/loading-overlay';
import { Alert, AlertDescription } from '@kit/ui/alert';
import { Button } from '@kit/ui/button';
import { Shield, ArrowLeft } from 'lucide-react';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
  fallbackPath?: string;
  showError?: boolean;
}

/**
 * 路由守护组件
 * 根据用户角色控制页面访问权限
 */
export function RoleGuard({ 
  children, 
  allowedRoles, 
  fallbackPath = '/unauthorized',
  showError = true 
}: RoleGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useSupabase();
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    checkAccess();
  }, [pathname]);

  const checkAccess = async () => {
    try {
      setIsLoading(true);
      
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        // 用户未登录，跳转到登录页
        router.replace(`/auth/sign-in?next=${encodeURIComponent(pathname)}`);
        return;
      }

      // 获取用户角色
      const role = user.user_metadata?.role || 'fan';
      setUserRole(role);

      // 检查权限
      if (allowedRoles.includes(role)) {
        setHasAccess(true);
      } else {
        setHasAccess(false);
        if (!showError) {
          router.replace(fallbackPath);
        }
      }
    } catch (error) {
      console.error('权限检查失败:', error);
      setHasAccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingOverlay />;
  }

  if (!hasAccess) {
    if (!showError) {
      return null;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-6 p-6">
          <div className="text-center">
            <Shield className="mx-auto h-12 w-12 text-red-500" />
            <h2 className="mt-4 text-2xl font-bold text-gray-900">
              访问被拒绝
            </h2>
            <p className="mt-2 text-gray-600">
              您的角色（{getRoleDisplayName(userRole)}）无权访问此页面
            </p>
          </div>

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              此页面需要以下角色之一：{allowedRoles.map(getRoleDisplayName).join('、')}
            </AlertDescription>
          </Alert>

          <div className="flex space-x-4">
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="flex-1"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </Button>
            <Button
              onClick={() => router.replace(getRoleBasedHomePath(userRole))}
              className="flex-1"
            >
              前往首页
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * 特定角色守护组件
 */
export function FanGuard({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={['fan', 'member', 'seller', 'master', 'firstmate']}>
      {children}
    </RoleGuard>
  );
}

export function MemberGuard({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={['member', 'master', 'firstmate']}>
      {children}
    </RoleGuard>
  );
}

export function SellerGuard({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={['seller', 'master', 'firstmate']}>
      {children}
    </RoleGuard>
  );
}

export function AdminGuard({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={['master', 'firstmate']}>
      {children}
    </RoleGuard>
  );
}

/**
 * 聊天权限守护组件
 */
interface ChatGuardProps {
  children: React.ReactNode;
  channelName?: string;
  targetUserRole?: string;
  chatType?: 'channel' | 'private';
}

export function ChatGuard({ 
  children, 
  channelName, 
  targetUserRole, 
  chatType = 'channel' 
}: ChatGuardProps) {
  const [hasAccess, setHasAccess] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const supabase = useSupabase();

  useEffect(() => {
    checkChatAccess();
  }, [channelName, targetUserRole, chatType]);

  const checkChatAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const role = user.user_metadata?.role || 'fan';
      setUserRole(role);

      if (chatType === 'channel') {
        // 检查频道访问权限
        if (role === 'fan' && channelName === 'general') {
          setHasAccess(false);
          return;
        }
      } else if (chatType === 'private') {
        // 检查私聊权限
        if (role === 'member' && targetUserRole === 'member') {
          setHasAccess(false);
          return;
        }
      }

      setHasAccess(true);
    } catch (error) {
      console.error('聊天权限检查失败:', error);
      setHasAccess(false);
    }
  };

  if (!hasAccess) {
    return (
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          {chatType === 'channel' 
            ? `您的角色（${getRoleDisplayName(userRole)}）无法访问 #${channelName} 频道`
            : `会员之间无法发起私聊`
          }
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
}

// 辅助函数
function getRoleDisplayName(role: string): string {
  const roleNames: Record<string, string> = {
    fan: '粉丝',
    member: '会员',
    seller: '商家',
    master: '主人',
    firstmate: '大副',
  };
  return roleNames[role] || '未知角色';
}

function getRoleBasedHomePath(role: string): string {
  switch (role) {
    case 'fan':
      return '/fan/dashboard';
    case 'member':
      return '/member/dashboard';
    case 'seller':
      return '/seller/dashboard';
    case 'master':
    case 'firstmate':
      return '/admin/dashboard';
    default:
      return '/fan/dashboard';
  }
} 