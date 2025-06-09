'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@kit/ui/utils';
import { 
  Key, 
  ShoppingBag, 
  Home,
  Settings 
} from 'lucide-react';

const navigation = [
  {
    name: '概览',
    href: '/seller',
    icon: Home,
  },
  {
    name: '密钥管理',
    href: '/seller/keys',
    icon: Key,
  },
  {
    name: '商品管理',
    href: '/seller/products',
    icon: ShoppingBag,
  },
  {
    name: '设置',
    href: '/seller/settings',
    icon: Settings,
  },
];

export default function SellerSidebar() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      {/* Logo区域 */}
      <div className="flex items-center px-6 py-4 border-b">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">百</span>
          </div>
          <span className="ml-2 text-lg font-semibold text-gray-900">
            商户后台
          </span>
        </div>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon
                className={cn(
                  'mr-3 h-5 w-5',
                  isActive ? 'text-blue-700' : 'text-gray-400'
                )}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* 底部信息 */}
      <div className="px-4 py-4 border-t">
        <div className="text-xs text-gray-500">
          百刀会商户系统 v1.0
        </div>
      </div>
    </div>
  );
} 