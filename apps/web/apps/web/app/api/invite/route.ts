import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

export async function POST(_request: NextRequest) {
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
    const { role: inviteRole, expiry, maxUses } = body;

    // 验证参数
    if (!inviteRole || !['member', 'seller'].includes(inviteRole)) {
      return NextResponse.json({ error: '无效的邀请角色' }, { status: 400 });
    }

    if (!expiry || !['1h', '4h', '24h', '48h', 'unlimited'].includes(expiry)) {
      return NextResponse.json({ error: '无效的有效期' }, { status: 400 });
    }

    if (maxUses === undefined || ![1, 10, 100, -1].includes(maxUses)) {
      return NextResponse.json({ error: '无效的使用次数' }, { status: 400 });
    }

    // 调用invite-service生成邀请链接
    const inviteServiceUrl = process.env.INVITE_SERVICE_URL || 'http://localhost:3004';
    const response = await fetch(`${inviteServiceUrl}/invites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INVITE_SERVICE_SECRET}`,
      },
      body: JSON.stringify({
        role: inviteRole,
        expiry,
        maxUses,
        createdBy: user.id,
        createdByEmail: user.email,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || '生成邀请链接失败');
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      message: '邀请链接生成成功',
      invite: data.invite,
    });

  } catch (error) {
    console.error('生成邀请链接失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成邀请链接失败' },
      { status: 500 }
    );
  }
} 