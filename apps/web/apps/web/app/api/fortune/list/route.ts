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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // 这里应该调用fortune-service的API
    // 暂时返回模拟数据
    const mockOrders = generateMockOrders(user.id, status, page, limit);

    return NextResponse.json({
      orders: mockOrders.orders,
      total: mockOrders.total,
      hasMore: mockOrders.hasMore,
    });

  } catch (error) {
    console.error('获取订单列表失败:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 生成模拟订单数据
function generateMockOrders(userId: string, status: string | null, page: number, limit: number) {
  const allStatuses = ['pending', 'paid-queued', 'processing', 'completed', 'refunded'];
  const targetStatus = status || 'paid-queued';
  
  const totalOrders = 50; // 模拟总订单数
  const startIndex = (page - 1) * limit;
  const endIndex = Math.min(startIndex + limit, totalOrders);
  
  const orders = [];
  
  for (let i = startIndex; i < endIndex; i++) {
    const orderDate = new Date();
    orderDate.setDate(orderDate.getDate() - i);
    
    orders.push({
      id: `order_${Date.now()}_${i}`,
      user_id: userId,
      amount: Math.floor(Math.random() * 500) + 50,
      message: i % 3 === 0 ? `这是第${i + 1}个订单的附言，包含一些详细的问题描述...` : '',
      is_urgent: i % 5 === 0,
      images: i % 4 === 0 ? [`https://picsum.photos/200/200?random=${i}`] : [],
      status: targetStatus,
      created_at: orderDate.toISOString(),
      updated_at: orderDate.toISOString(),
      completed_at: targetStatus === 'completed' ? orderDate.toISOString() : undefined,
      reply: targetStatus === 'completed' ? `这是第${i + 1}个订单的大师回复...` : undefined,
      reply_images: [],
    });
  }
  
  return {
    orders,
    total: totalOrders,
    hasMore: endIndex < totalOrders,
  };
} 