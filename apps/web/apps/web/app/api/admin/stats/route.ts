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

    // 这里应该调用各个微服务的API获取真实数据
    // 暂时返回模拟数据
    const stats = {
      totalUsers: 1250,
      totalRevenue: 125000.50,
      totalOrders: 850,
      totalProducts: 120,
      pendingOrders: 45,
      completedOrders: 720,
      refundedOrders: 85,
      averageRating: 4.6,
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('获取统计数据失败:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 