import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 获取频道消息
export async function GET(
  request: NextRequest,
  { params }: { params: { channelId: string } }
) {
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

    const { channelId } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before'); // 用于分页

    // 验证用户是否是频道成员
    const { data: membership } = await supabase
      .from('chat_channel_members')
      .select('id')
      .eq('channel_id', channelId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: '没有权限访问此频道' }, { status: 403 });
    }

    // 构建查询
    let query = supabase
      .from('chat_messages')
      .select(`
        *,
        user:profiles!chat_messages_user_id_fkey(
          id,
          full_name,
          avatar_url,
          role
        ),
        reply_to_message:chat_messages!chat_messages_reply_to_fkey(
          id,
          content,
          user:profiles!chat_messages_user_id_fkey(
            id,
            full_name
          )
        ),
        reactions:chat_message_reactions(
          id,
          reaction,
          user_id,
          user:profiles!chat_message_reactions_user_id_fkey(
            id,
            full_name
          )
        )
      `)
      .eq('channel_id', channelId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error('获取消息失败:', error);
      return NextResponse.json({ error: '获取消息失败' }, { status: 500 });
    }

    // 反转消息顺序（最新的在底部）
    const formattedMessages = messages?.reverse().map(message => ({
      id: message.id,
      content: message.content,
      message_type: message.message_type,
      attachments: message.attachments,
      created_at: message.created_at,
      updated_at: message.updated_at,
      user: message.user,
      reply_to: message.reply_to_message,
      reactions: message.reactions || [],
      metadata: message.metadata,
    })) || [];

    return NextResponse.json({ messages: formattedMessages });
  } catch (error) {
    console.error('API错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 发送消息
export async function POST(
  request: NextRequest,
  { params }: { params: { channelId: string } }
) {
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

    const { channelId } = params;
    const body = await request.json();
    const { content, message_type = 'text', attachments = [], reply_to } = body;

    // 验证输入
    if (!content && (!attachments || attachments.length === 0)) {
      return NextResponse.json({ error: '消息内容不能为空' }, { status: 400 });
    }

    // 验证用户是否是频道成员
    const { data: membership } = await supabase
      .from('chat_channel_members')
      .select('id')
      .eq('channel_id', channelId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: '没有权限发送消息到此频道' }, { status: 403 });
    }

    // 检查用户权限
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: '用户信息不存在' }, { status: 404 });
    }

    // Fan用户不能发送消息
    if (profile.role === 'fan') {
      return NextResponse.json({ error: 'Fan用户不能发送消息' }, { status: 403 });
    }

    // Member只能在私聊中发送消息
    if (profile.role === 'member') {
      const { data: channel } = await supabase
        .from('chat_channels')
        .select('type')
        .eq('id', channelId)
        .single();

      if (channel?.type !== 'direct') {
        return NextResponse.json({ error: 'Member只能在私聊中发送消息' }, { status: 403 });
      }
    }

    // 发送消息
    const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        channel_id: channelId,
        user_id: user.id,
        content,
        message_type,
        attachments,
        reply_to,
      })
      .select(`
        *,
        user:profiles!chat_messages_user_id_fkey(
          id,
          full_name,
          avatar_url,
          role
        )
      `)
      .single();

    if (messageError) {
      console.error('发送消息失败:', messageError);
      return NextResponse.json({ error: '发送消息失败' }, { status: 500 });
    }

    // 更新频道的最后更新时间
    await supabase
      .from('chat_channels')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', channelId);

    return NextResponse.json({ message });
  } catch (error) {
    console.error('API错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
} 