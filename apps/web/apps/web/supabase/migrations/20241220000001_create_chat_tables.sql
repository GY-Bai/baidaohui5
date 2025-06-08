-- 创建聊天频道表
CREATE TABLE IF NOT EXISTS chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('direct', 'group', 'general')),
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 创建频道成员表
CREATE TABLE IF NOT EXISTS chat_channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_muted BOOLEAN DEFAULT false,
  UNIQUE(channel_id, user_id)
);

-- 创建消息表
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
  attachments JSONB DEFAULT '[]'::jsonb,
  reply_to UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_deleted BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 创建消息反应表
CREATE TABLE IF NOT EXISTS chat_message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id, reaction)
);

-- 创建未读计数表
CREATE TABLE IF NOT EXISTS chat_unread_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  unread_count INTEGER DEFAULT 0,
  last_read_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(channel_id, user_id)
);

-- 创建正在输入状态表
CREATE TABLE IF NOT EXISTS chat_typing_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '10 seconds'),
  UNIQUE(channel_id, user_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_chat_channels_type ON chat_channels(type);
CREATE INDEX IF NOT EXISTS idx_chat_channels_created_by ON chat_channels(created_by);
CREATE INDEX IF NOT EXISTS idx_chat_channel_members_channel_id ON chat_channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_channel_members_user_id ON chat_channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_id ON chat_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_deleted ON chat_messages(is_deleted, deleted_at);
CREATE INDEX IF NOT EXISTS idx_chat_unread_counts_user_channel ON chat_unread_counts(user_id, channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_typing_expires ON chat_typing_indicators(expires_at);

-- 启用RLS
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_unread_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_typing_indicators ENABLE ROW LEVEL SECURITY;

-- 频道RLS策略
CREATE POLICY "Users can view channels they are members of" ON chat_channels
  FOR SELECT USING (
    id IN (
      SELECT channel_id FROM chat_channel_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create channels" ON chat_channels
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Channel creators and admins can update channels" ON chat_channels
  FOR UPDATE USING (
    created_by = auth.uid() OR
    id IN (
      SELECT channel_id FROM chat_channel_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- 频道成员RLS策略
CREATE POLICY "Users can view channel members for their channels" ON chat_channel_members
  FOR SELECT USING (
    channel_id IN (
      SELECT channel_id FROM chat_channel_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join channels" ON chat_channel_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave channels" ON chat_channel_members
  FOR DELETE USING (user_id = auth.uid());

-- 消息RLS策略
CREATE POLICY "Users can view messages in their channels" ON chat_messages
  FOR SELECT USING (
    channel_id IN (
      SELECT channel_id FROM chat_channel_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to their channels" ON chat_messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    channel_id IN (
      SELECT channel_id FROM chat_channel_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own messages" ON chat_messages
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own messages" ON chat_messages
  FOR DELETE USING (user_id = auth.uid());

-- 消息反应RLS策略
CREATE POLICY "Users can view reactions in their channels" ON chat_message_reactions
  FOR SELECT USING (
    message_id IN (
      SELECT id FROM chat_messages 
      WHERE channel_id IN (
        SELECT channel_id FROM chat_channel_members 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can add reactions" ON chat_message_reactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove their own reactions" ON chat_message_reactions
  FOR DELETE USING (user_id = auth.uid());

-- 未读计数RLS策略
CREATE POLICY "Users can view their own unread counts" ON chat_unread_counts
  FOR ALL USING (user_id = auth.uid());

-- 正在输入RLS策略
CREATE POLICY "Users can view typing indicators in their channels" ON chat_typing_indicators
  FOR SELECT USING (
    channel_id IN (
      SELECT channel_id FROM chat_channel_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own typing indicators" ON chat_typing_indicators
  FOR ALL USING (user_id = auth.uid());

-- 创建函数：更新未读计数
CREATE OR REPLACE FUNCTION update_unread_count()
RETURNS TRIGGER AS $$
BEGIN
  -- 为频道中的所有成员（除了发送者）增加未读计数
  INSERT INTO chat_unread_counts (channel_id, user_id, unread_count)
  SELECT 
    NEW.channel_id,
    cm.user_id,
    1
  FROM chat_channel_members cm
  WHERE cm.channel_id = NEW.channel_id 
    AND cm.user_id != NEW.user_id
  ON CONFLICT (channel_id, user_id)
  DO UPDATE SET 
    unread_count = chat_unread_counts.unread_count + 1,
    updated_at = NOW();
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器：新消息时更新未读计数
CREATE TRIGGER trigger_update_unread_count
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_unread_count();

-- 创建函数：清理过期的正在输入状态
CREATE OR REPLACE FUNCTION cleanup_expired_typing()
RETURNS void AS $$
BEGIN
  DELETE FROM chat_typing_indicators 
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 创建默认的#general频道
INSERT INTO chat_channels (id, name, type, description, created_by)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'general',
  'general',
  '百刀会官方聊天频道',
  (SELECT id FROM auth.users WHERE email = 'admin@baidaohui.com' LIMIT 1)
) ON CONFLICT (id) DO NOTHING; 