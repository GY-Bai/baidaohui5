import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 获取用户的频道列表
export async function GET(_request: NextRequest) {
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

    // 获取用户参与的频道
    const { data: channels, error } = await supabase
      .from('chat_channels')
      .select(`
        *,
        chat_channel_members!inner(
          role,
          joined_at,
          last_read_at,
          is_muted
        ),
        chat_unread_counts(
          unread_count
        )
      `)
      .eq('chat_channel_members.user_id', user.id)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('获取频道失败:', error);
      return NextResponse.json({ error: '获取频道失败' }, { status: 500 });
    }

    // 格式化频道数据
    const formattedChannels = channels?.map(channel => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      description: channel.description,
      created_at: channel.created_at,
      updated_at: channel.updated_at,
      member_info: channel.chat_channel_members[0],
      unread_count: channel.chat_unread_counts[0]?.unread_count || 0,
    })) || [];

    return NextResponse.json({ channels: formattedChannels });
  } catch (error) {
    console.error('API错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 创建新频道
export async function POST(_request: NextRequest) {
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
    const { name, type, description, members = [] } = body;

    // 验证输入
    if (!name || !type) {
      return NextResponse.json({ error: '频道名称和类型不能为空' }, { status: 400 });
    }

    if (!['direct', 'group', 'general'].includes(type)) {
      return NextResponse.json({ error: '无效的频道类型' }, { status: 400 });
    }

    // 检查权限：只有master和firstmate可以创建群聊
    if (type === 'group') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || !['master', 'firstmate'].includes(profile.role)) {
        return NextResponse.json({ error: '没有权限创建群聊' }, { status: 403 });
      }
    }

    // 创建频道
    const { data: channel, error: channelError } = await supabase
      .from('chat_channels')
      .insert({
        name,
        type,
        description,
        created_by: user.id,
      })
      .select()
      .single();

    if (channelError) {
      console.error('创建频道失败:', channelError);
      return NextResponse.json({ error: '创建频道失败' }, { status: 500 });
    }

    // 添加创建者为管理员
    const membersToAdd = [
      { channel_id: channel.id, user_id: user.id, role: 'admin' },
      ...members.map((memberId: string) => ({
        channel_id: channel.id,
        user_id: memberId,
        role: 'member'
      }))
    ];

    const { error: memberError } = await supabase
      .from('chat_channel_members')
      .insert(membersToAdd);

    if (memberError) {
      console.error('添加频道成员失败:', memberError);
      // 删除已创建的频道
      await supabase.from('chat_channels').delete().eq('id', channel.id);
      return NextResponse.json({ error: '添加频道成员失败' }, { status: 500 });
    }

    return NextResponse.json({ channel });
  } catch (error) {
    console.error('API错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
} 