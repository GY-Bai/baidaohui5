import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

export async function PUT(
  _request: NextRequest,
  { params }: { params: { userId: string } }
) {
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

    const body = await request.json();
    const { can_chat, can_access_general } = body;

    // 调用chat-service更新用户权限
    const chatServiceUrl = process.env.CHAT_SERVICE_URL || 'http://localhost:3003';
    const response = await fetch(`${chatServiceUrl}/permissions/${params.userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CHAT_SERVICE_SECRET}`,
      },
      body: JSON.stringify({
        can_chat,
        can_access_general,
        updated_by: user.id,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || '更新权限失败');
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      message: '权限更新成功',
      permission: data.permission,
    });

  } catch (error) {
    console.error('更新聊天权限失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新权限失败' },
      { status: 500 }
    );
  }
} 