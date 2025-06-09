'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@kit/ui/utils';
import { 
  LayoutDashboard, 
  Users, 
  ShoppingCart, 
  Star,
  Settings,
  Home,
  LogOut,
  Wand2,
  Key,
  MessageSquare,
  UserPlus
} from 'lucide-react';

const navigation = [
  {
    name: '仪表盘',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    name: '算命订单',
    href: '/admin/orders',
    icon: Wand2,
  },
  {
    name: '商户密钥',
    href: '/admin/sellers',
    icon: Key,
  },
  {
    name: '聊天权限',
    href: '/admin/chat-perms',
    icon: MessageSquare,
  },
  {
    name: '邀请链接',
    href: '/admin/invite',
    icon: UserPlus,
  },
  {
    name: '用户管理',
    href: '/admin/users',
    icon: Users,
  },
  {
    name: '商品管理',
    href: '/admin/products',
    icon: Star,
  },
  {
    name: '系统设置',
    href: '/admin/settings',
    icon: Settings,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col w-64 bg-white shadow-lg">
      {/* Logo */}
      <div className="flex items-center justify-center h-16 px-4 bg-primary">
        <h1 className="text-xl font-bold text-white">百刀会管理</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors',
                isActive
                  ? 'bg-primary text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t">
        <Link
          href="/home"
          className="flex items-center px-4 py-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Home className="w-5 h-5 mr-3" />
          返回首页
        </Link>
        <Link
          href="/auth/sign-out"
          className="flex items-center px-4 py-3 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-5 h-5 mr-3" />
          退出登录
        </Link>
      </div>
    </div>
  );
} 