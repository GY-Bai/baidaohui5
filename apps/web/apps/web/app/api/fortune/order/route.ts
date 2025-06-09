import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

export async function POST(_request: NextRequest) {
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

    const body = await request.json();
    const { amount, message, isUrgent, images } = body;

    // 验证输入
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: '金额必须大于0' },
        { status: 400 }
      );
    }

    if (amount > 10000) {
      return NextResponse.json(
        { error: '金额不能超过10000' },
        { status: 400 }
      );
    }

    if (message && message.length > 2500) {
      return NextResponse.json(
        { error: '附言不能超过2500字' },
        { status: 400 }
      );
    }

    // 创建订单数据
    const orderData = {
      user_id: user.id,
      amount: amount,
      message: message || '',
      is_urgent: isUrgent || false,
      images: images || [],
      status: 'pending', // 待支付
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 这里应该调用fortune-service的gRPC接口
    // 暂时返回模拟响应
    const mockOrderId = `order_${Date.now()}`;

    // 生成Stripe支付链接
    const stripeUrl = `https://checkout.stripe.com/pay/${mockOrderId}`;

    return NextResponse.json({
      success: true,
      order: {
        id: mockOrderId,
        ...orderData,
        stripe_url: stripeUrl,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('创建订单失败:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 