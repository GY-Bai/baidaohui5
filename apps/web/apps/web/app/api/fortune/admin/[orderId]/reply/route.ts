import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
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

    const { reply, reply_images } = await request.json();

    if (!reply || !reply.trim()) {
      return NextResponse.json({ error: '回复内容不能为空' }, { status: 400 });
    }

    // 调用fortune-service回复订单
    const fortuneServiceUrl = process.env.FORTUNE_SERVICE_URL || 'http://localhost:3001';
    const response = await fetch(`${fortuneServiceUrl}/fortune/admin/orders/${params.orderId}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.FORTUNE_SERVICE_SECRET}`,
      },
      body: JSON.stringify({
        reply: reply.trim(),
        reply_images: reply_images || [],
        admin_id: user.id,
        admin_email: user.email,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || '回复失败');
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      message: '回复成功',
      order: data.order,
    });

  } catch (error) {
    console.error('回复订单失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '回复失败' },
      { status: 500 }
    );
  }
} 