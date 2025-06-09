#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 修复未使用的导入
function fixUnusedImports() {
  const files = [
    'apps/web/apps/web/app/admin/_components/admin-sidebar.tsx',
    'apps/web/apps/web/app/admin/invite/page.tsx',
    'apps/web/apps/web/app/admin/layout.tsx',
    'apps/web/apps/web/app/admin/sellers/page.tsx',
    'apps/web/apps/web/app/home/_components/supabase-chat-interface.tsx',
    'apps/web/apps/web/app/home/page.tsx',
    'apps/web/apps/web/lib/supabaseChatAdapter.ts'
  ];

  files.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // 修复admin-sidebar.tsx
      if (filePath.includes('admin-sidebar.tsx')) {
        content = content.replace('ShoppingCart,', '');
        content = content.replace('Gift,', '');
        content = content.replace('BarChart3,', '');
        content = content.replace('UserCheck,', '');
      }
      
      // 修复invite/page.tsx
      if (filePath.includes('invite/page.tsx')) {
        content = content.replace('Edit,', '');
      }
      
      // 修复admin/layout.tsx
      if (filePath.includes('admin/layout.tsx')) {
        content = content.replace("import Link from 'next/link';", '');
      }
      
      // 修复sellers/page.tsx
      if (filePath.includes('sellers/page.tsx')) {
        content = content.replace('DialogTrigger,', '');
      }
      
      // 修复supabase-chat-interface.tsx
      if (filePath.includes('supabase-chat-interface.tsx')) {
        content = content.replace('CardHeader,', '');
        content = content.replace('CardTitle,', '');
        content = content.replace('Separator,', '');
        content = content.replace('Smile,', '');
        content = content.replace('MoreVertical,', '');
        content = content.replace('Users,', '');
        content = content.replace('Settings,', '');
        content = content.replace('Search,', '');
        content = content.replace('Info,', '');
        content = content.replace('Edit,', '');
      }
      
      // 修复home/page.tsx
      if (filePath.includes('home/page.tsx')) {
        content = content.replace('const supabase = createBrowserClient();', '// const supabase = createBrowserClient();');
      }
      
      // 修复supabaseChatAdapter.ts
      if (filePath.includes('supabaseChatAdapter.ts')) {
        content = content.replace('Channel,', '');
        content = content.replace('Message,', '');
      }
      
      fs.writeFileSync(filePath, content);
      console.log(`Fixed unused imports in ${filePath}`);
    }
  });
}

// 修复未使用的参数
function fixUnusedParams() {
  const files = [
    'apps/web/apps/web/app/api/admin/recent-orders/route.ts',
    'apps/web/apps/web/app/api/admin/recent-users/route.ts',
    'apps/web/apps/web/app/api/admin/stats/route.ts',
    'apps/web/apps/web/app/api/auth/me/route.ts',
    'apps/web/apps/web/app/api/chat/permission/route.ts',
    'apps/web/apps/web/app/api/fortune/admin/route.ts',
    'apps/web/apps/web/app/api/key/route.ts'
  ];

  files.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // 将未使用的request参数改为_request
      content = content.replace(/export async function GET\(request: Request\)/g, 'export async function GET(_request: Request)');
      
      fs.writeFileSync(filePath, content);
      console.log(`Fixed unused params in ${filePath}`);
    }
  });
}

// 修复未使用的变量
function fixUnusedVars() {
  const files = [
    'apps/web/apps/web/app/api/fortune/list/route.ts',
    'apps/web/apps/web/app/seller/keys/page.tsx',
    'apps/web/apps/web/app/seller/products/page.tsx',
    'apps/web/apps/web/lib/supabaseChatAdapter.ts'
  ];

  files.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // 修复fortune/list/route.ts
      if (filePath.includes('fortune/list/route.ts')) {
        content = content.replace('const allStatuses =', 'const _allStatuses =');
      }
      
      // 修复seller页面的error变量
      if (filePath.includes('seller/keys/page.tsx') || filePath.includes('seller/products/page.tsx')) {
        content = content.replace(/} catch \(error\) {/g, '} catch (_error) {');
      }
      
      // 修复supabaseChatAdapter.ts
      if (filePath.includes('supabaseChatAdapter.ts')) {
        content = content.replace('const { data } =', 'const { data: _data } =');
        content = content.replace('unreadData:', '_unreadData:');
      }
      
      fs.writeFileSync(filePath, content);
      console.log(`Fixed unused vars in ${filePath}`);
    }
  });
}

// 修复引号转义问题
function fixQuoteEscaping() {
  const filePath = 'apps/web/apps/web/app/seller/settings/page.tsx';
  
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 转义引号
    content = content.replace(/placeholder="([^"]*)"([^"]*)"([^"]*)"/g, 'placeholder="$1&quot;$2&quot;$3"');
    
    fs.writeFileSync(filePath, content);
    console.log(`Fixed quote escaping in ${filePath}`);
  }
}

// 运行所有修复
console.log('开始修复lint错误...');
fixUnusedImports();
fixUnusedParams();
fixUnusedVars();
fixQuoteEscaping();
console.log('lint错误修复完成！'); 