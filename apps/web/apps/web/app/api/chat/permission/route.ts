import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

export async function GET(_request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    
    // 验证用户身份
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 检查管理员权限
    const role = user.user_metadata?.role || 'fan';
    if (!['master', 'firstmate'].includes(role)) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    // 调用chat-service获取所有用户权限
    const chatServiceUrl = process.env.CHAT_SERVICE_URL || 'http://localhost:3003';
    const response = await fetch(`${chatServiceUrl}/permissions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CHAT_SERVICE_SECRET}`,
      },
    });

    if (!response.ok) {
      throw new Error('获取权限失败');
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      permissions: data.permissions || [],
    });

  } catch (error) {
    console.error('获取聊天权限失败:', error);
    return NextResponse.json(
      { error: '获取权限失败' },
      { status: 500 }
    );
  }
} 