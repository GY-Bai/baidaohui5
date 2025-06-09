import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

export async function GET(_request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 检查用户权限
    const role = user.user_metadata?.role || 'fan';
    if (!['master', 'firstmate'].includes(role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // 模拟最近用户数据
    const users = [];
    const roles = ['fan', 'member', 'seller'];
    
    for (let i = 0; i < 10; i++) {
      const registerDate = new Date();
      registerDate.setDate(registerDate.getDate() - i);
      
      const lastSignIn = new Date();
      lastSignIn.setHours(lastSignIn.getHours() - Math.floor(Math.random() * 24));
      
      users.push({
        id: `user_${i + 1}`,
        email: `user${i + 1}@example.com`,
        role: roles[Math.floor(Math.random() * roles.length)],
        created_at: registerDate.toISOString(),
        last_sign_in: Math.random() > 0.3 ? lastSignIn.toISOString() : '',
      });
    }

    return NextResponse.json({ users });

  } catch (error) {
    console.error('获取最近用户失败:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 