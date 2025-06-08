import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

export async function GET(request: NextRequest) {
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

    // 调用fortune-service获取所有订单
    const fortuneServiceUrl = process.env.FORTUNE_SERVICE_URL || 'http://localhost:3001';
    const response = await fetch(`${fortuneServiceUrl}/fortune/admin/orders`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.FORTUNE_SERVICE_SECRET}`,
      },
    });

    if (!response.ok) {
      throw new Error('获取订单失败');
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      orders: data.orders || [],
    });

  } catch (error) {
    console.error('获取管理员订单失败:', error);
    return NextResponse.json(
      { error: '获取订单失败' },
      { status: 500 }
    );
  }
} 