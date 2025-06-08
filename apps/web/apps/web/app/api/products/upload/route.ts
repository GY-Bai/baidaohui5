import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

export async function POST(request: NextRequest) {
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

    // 检查Seller权限
    const role = user.user_metadata?.role || 'fan';
    if (role !== 'seller') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const body = await request.json();
    const { 
      name, 
      description, 
      price, 
      currency = 'USD',
      category,
      images,
      stripe_price_id,
      stripe_payment_link 
    } = body;

    // 验证必填字段
    if (!name || !description || !price || !category) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
    }

    // 调用shop-service创建商品
    const shopServiceUrl = process.env.SHOP_SERVICE_URL || 'http://localhost:3003';
    const response = await fetch(`${shopServiceUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SHOP_SERVICE_SECRET}`,
      },
      body: JSON.stringify({
        name,
        description,
        price,
        currency,
        category,
        images: images || [],
        seller_id: user.id,
        seller_email: user.email,
        stripe_price_id,
        stripe_payment_link,
        created_by: user.id,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || '创建商品失败');
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      message: '商品创建成功',
      product: data.product,
    });

  } catch (error) {
    console.error('创建商品失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建商品失败' },
      { status: 500 }
    );
  }
}

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

    // 检查Seller权限
    const role = user.user_metadata?.role || 'fan';
    if (role !== 'seller') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');

    // 调用shop-service获取当前Seller的商品
    const shopServiceUrl = process.env.SHOP_SERVICE_URL || 'http://localhost:3003';
    const response = await fetch(`${shopServiceUrl}/products/seller/${user.id}?page=${page}&limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SHOP_SERVICE_SECRET}`,
      },
    });

    if (!response.ok) {
      throw new Error('获取商品失败');
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      products: data.products || [],
      total: data.total || 0,
      hasMore: data.hasMore || false,
    });

  } catch (error) {
    console.error('获取商品失败:', error);
    return NextResponse.json(
      { error: '获取商品失败' },
      { status: 500 }
    );
  }
} 