import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

export async function GET(request: NextRequest) {
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

    // 模拟最近订单数据
    const orders = [];
    const statuses = ['pending', 'paid-queued', 'processing', 'completed', 'refunded'];
    
    for (let i = 0; i < 10; i++) {
      const orderDate = new Date();
      orderDate.setHours(orderDate.getHours() - i * 2);
      
      orders.push({
        id: `order_${Date.now()}_${i}`,
        user_name: `用户${i + 1}`,
        amount: Math.floor(Math.random() * 500) + 50,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        is_urgent: Math.random() > 0.7,
        created_at: orderDate.toISOString(),
      });
    }

    return NextResponse.json({ orders });

  } catch (error) {
    console.error('获取最近订单失败:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 