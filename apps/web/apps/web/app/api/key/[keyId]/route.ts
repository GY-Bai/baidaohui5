import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

export async function PUT(
  _request: NextRequest,
  { params }: { params: { keyId: string } }
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
    const { stripe_publishable_key, stripe_secret_key, webhook_secret, is_active } = body;

    // 调用key-service更新密钥
    const keyServiceUrl = process.env.KEY_SERVICE_URL || 'http://localhost:3002';
    const response = await fetch(`${keyServiceUrl}/keys/${params.keyId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.KEY_SERVICE_SECRET}`,
      },
      body: JSON.stringify({
        stripe_publishable_key,
        stripe_secret_key,
        webhook_secret,
        is_active,
        updated_by: user.id,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || '更新密钥失败');
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      message: '更新成功',
      key: data.key,
    });

  } catch (error) {
    console.error('更新密钥失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新密钥失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { keyId: string } }
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

    // 调用key-service删除密钥
    const keyServiceUrl = process.env.KEY_SERVICE_URL || 'http://localhost:3002';
    const response = await fetch(`${keyServiceUrl}/keys/${params.keyId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.KEY_SERVICE_SECRET}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || '删除密钥失败');
    }
    
    return NextResponse.json({
      success: true,
      message: '删除成功',
    });

  } catch (error) {
    console.error('删除密钥失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除密钥失败' },
      { status: 500 }
    );
  }
} 