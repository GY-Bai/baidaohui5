import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 删除/撤回消息
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { messageId: string } }
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

    const { messageId } = params;

    // 获取消息信息
    const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .select(`
        *,
        channel:chat_channels(
          id,
          type,
          created_by
        )
      `)
      .eq('id', messageId)
      .eq('is_deleted', false)
      .single();

    if (messageError || !message) {
      return NextResponse.json({ error: '消息不存在' }, { status: 404 });
    }

    // 检查权限：只有消息发送者或频道管理员可以删除消息
    const { data: membership } = await supabase
      .from('chat_channel_members')
      .select('role')
      .eq('channel_id', message.channel_id)
      .eq('user_id', user.id)
      .single();

    const canDelete = 
      message.user_id === user.id || // 消息发送者
      membership?.role === 'admin' || // 频道管理员
      message.channel?.created_by === user.id; // 频道创建者

    if (!canDelete) {
      return NextResponse.json({ error: '没有权限删除此消息' }, { status: 403 });
    }

    // 软删除消息
    const { error: deleteError } = await supabase
      .from('chat_messages')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        content: null, // 清空内容
        attachments: [], // 清空附件
      })
      .eq('id', messageId);

    if (deleteError) {
      console.error('删除消息失败:', deleteError);
      return NextResponse.json({ error: '删除消息失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 编辑消息
export async function PUT(
  _request: NextRequest,
  { params }: { params: { messageId: string } }
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

    const { messageId } = params;
    const body = await request.json();
    const { content } = body;

    if (!content || content.trim() === '') {
      return NextResponse.json({ error: '消息内容不能为空' }, { status: 400 });
    }

    // 获取消息信息
    const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('id', messageId)
      .eq('user_id', user.id) // 只能编辑自己的消息
      .eq('is_deleted', false)
      .single();

    if (messageError || !message) {
      return NextResponse.json({ error: '消息不存在或没有权限编辑' }, { status: 404 });
    }

    // 检查消息是否在可编辑时间内（15分钟）
    const messageTime = new Date(message.created_at);
    const now = new Date();
    const timeDiff = now.getTime() - messageTime.getTime();
    const fifteenMinutes = 15 * 60 * 1000;

    if (timeDiff > fifteenMinutes) {
      return NextResponse.json({ error: '消息发送超过15分钟，无法编辑' }, { status: 403 });
    }

    // 更新消息
    const { data: updatedMessage, error: updateError } = await supabase
      .from('chat_messages')
      .update({
        content: content.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId)
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

    if (updateError) {
      console.error('更新消息失败:', updateError);
      return NextResponse.json({ error: '更新消息失败' }, { status: 500 });
    }

    return NextResponse.json({ message: updatedMessage });
  } catch (error) {
    console.error('API错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
} 