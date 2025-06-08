import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const AI_PROXY_URL = process.env.AI_PROXY_URL || 'http://localhost:3003';

// AI聊天接口
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { messages, model = 'gpt-4o-mini', stream = false } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: '消息不能为空' }, { status: 400 });
    }

    // 获取用户信息
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: '用户信息不存在' }, { status: 404 });
    }

    // 检查用户权限：Fan用户不能使用AI
    if (profile.role === 'fan') {
      return NextResponse.json({ error: 'Fan用户不能使用AI助手' }, { status: 403 });
    }

    // 调用AI代理服务
    const aiResponse = await fetch(`${AI_PROXY_URL}/api/ai/chat${stream ? '/stream' : ''}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages,
        model,
        user_id: user.id,
        user_role: profile.role,
      }),
    });

    if (!aiResponse.ok) {
      const errorData = await aiResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || 'AI服务请求失败' },
        { status: aiResponse.status }
      );
    }

    if (stream) {
      // 流式响应
      return new Response(aiResponse.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // 普通响应
      const data = await aiResponse.json();
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error('AI聊天API错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 获取可用模型列表
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

    // 调用AI代理服务获取模型列表
    const aiResponse = await fetch(`${AI_PROXY_URL}/api/ai/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!aiResponse.ok) {
      const errorData = await aiResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || '获取模型列表失败' },
        { status: aiResponse.status }
      );
    }

    const data = await aiResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('获取模型列表API错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
} 