'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { useUser } from '@kit/supabase/hooks/use-user';

/**
 * 角色跳转组件
 * Google OAuth登录后根据用户角色跳转到对应页面
 */
export function RoleRedirect() {
  const router = useRouter();
  const supabase = useSupabase();
  const user = useUser();

  useEffect(() => {
    if (!user) return;

    // 获取用户角色
    const role = user.user_metadata?.role || 'fan';
    
    // 根据角色跳转到对应的首页
    const redirectPath = getRoleBasedHomePath(role);
    
    // 延迟跳转，确保认证状态已同步
    setTimeout(() => {
      router.replace(redirectPath);
    }, 100);
  }, [user, router]);

  // 监听认证状态变化
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const role = session.user.user_metadata?.role || 'fan';
          const redirectPath = getRoleBasedHomePath(role);
          
          // 跳转到角色对应的首页
          router.replace(redirectPath);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase.auth, router]);

  return null; // 这个组件不渲染任何内容
}

/**
 * 根据用户角色获取对应的首页路径
 */
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

/**
 * 检查用户是否有权限访问指定路径
 */
export function checkRoutePermission(userRole: string, pathname: string): boolean {
  // 定义路径权限映射
  const routePermissions: Record<string, string[]> = {
    '/fan': ['fan', 'member', 'seller', 'master', 'firstmate'],
    '/member': ['member', 'master', 'firstmate'],
    '/seller': ['seller', 'master', 'firstmate'],
    '/admin': ['master', 'firstmate'],
    '/master': ['master', 'firstmate'],
  };

  // 检查路径权限
  for (const [route, allowedRoles] of Object.entries(routePermissions)) {
    if (pathname.startsWith(route)) {
      return allowedRoles.includes(userRole);
    }
  }

  // 默认允许访问公共路径
  return true;
}

/**
 * 获取用户角色的中文显示名称
 */
export function getRoleDisplayName(role: string): string {
  const roleNames: Record<string, string> = {
    fan: '粉丝',
    member: '会员',
    seller: '商家',
    master: '主人',
    firstmate: '大副',
  };

  return roleNames[role] || '未知角色';
}

/**
 * 检查用户是否可以访问聊天功能
 */
export function canAccessChat(userRole: string, channelName?: string): boolean {
  // fan角色不能访问#general频道
  if (userRole === 'fan' && channelName === 'general') {
    return false;
  }

  // 其他情况允许访问
  return true;
}

/**
 * 检查用户是否可以发起私聊
 */
export function canStartPrivateChat(userRole: string, targetRole: string): boolean {
  // member之间不能私聊
  if (userRole === 'member' && targetRole === 'member') {
    return false;
  }

  return true;
} 