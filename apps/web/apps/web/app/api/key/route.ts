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

    // 调用key-service获取所有密钥
    const keyServiceUrl = process.env.KEY_SERVICE_URL || 'http://localhost:3002';
    const response = await fetch(`${keyServiceUrl}/keys`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.KEY_SERVICE_SECRET}`,
      },
    });

    if (!response.ok) {
      throw new Error('获取密钥失败');
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      keys: data.keys || [],
    });

  } catch (error) {
    console.error('获取密钥失败:', error);
    return NextResponse.json(
      { error: '获取密钥失败' },
      { status: 500 }
    );
  }
}

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

    // 检查管理员权限
    const role = user.user_metadata?.role || 'fan';
    if (!['master', 'firstmate'].includes(role)) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const body = await request.json();
    const { seller_email, stripe_publishable_key, stripe_secret_key, webhook_secret, is_active } = body;

    // 验证必填字段
    if (!seller_email || !stripe_publishable_key || !stripe_secret_key) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
    }

    // 调用key-service创建密钥
    const keyServiceUrl = process.env.KEY_SERVICE_URL || 'http://localhost:3002';
    const response = await fetch(`${keyServiceUrl}/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.KEY_SERVICE_SECRET}`,
      },
      body: JSON.stringify({
        seller_email,
        stripe_publishable_key,
        stripe_secret_key,
        webhook_secret,
        is_active: is_active !== undefined ? is_active : true,
        created_by: user.id,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || '创建密钥失败');
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      message: '创建成功',
      key: data.key,
    });

  } catch (error) {
    console.error('创建密钥失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建密钥失败' },
      { status: 500 }
    );
  }
} 