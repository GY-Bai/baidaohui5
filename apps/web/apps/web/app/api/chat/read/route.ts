import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 标记频道已读
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
    const { channel_id, message_id } = body;

    if (!channel_id) {
      return NextResponse.json({ error: '频道ID不能为空' }, { status: 400 });
    }

    // 验证用户是否是频道成员
    const { data: membership } = await supabase
      .from('chat_channel_members')
      .select('id')
      .eq('channel_id', channel_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: '没有权限访问此频道' }, { status: 403 });
    }

    // 更新未读计数
    const { error: updateError } = await supabase
      .from('chat_unread_counts')
      .upsert({
        channel_id,
        user_id: user.id,
        unread_count: 0,
        last_read_message_id: message_id,
        updated_at: new Date().toISOString(),
      });

    if (updateError) {
      console.error('更新已读状态失败:', updateError);
      return NextResponse.json({ error: '更新已读状态失败' }, { status: 500 });
    }

    // 更新频道成员的最后阅读时间
    await supabase
      .from('chat_channel_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('channel_id', channel_id)
      .eq('user_id', user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
} 