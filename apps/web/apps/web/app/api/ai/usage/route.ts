import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const AI_PROXY_URL = process.env.AI_PROXY_URL || 'http://localhost:3003';

// 获取用户AI使用统计
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: '用户验证失败' }, { status: 401 });
    }

    // 调用AI代理服务获取使用统计
    const aiResponse = await fetch(`${AI_PROXY_URL}/api/ai/usage`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!aiResponse.ok) {
      const errorData = await aiResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || '获取使用统计失败' },
        { status: aiResponse.status }
      );
    }

    const data = await aiResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('获取AI使用统计API错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
} 