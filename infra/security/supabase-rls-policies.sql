-- 百刀会 Supabase RLS 安全策略
-- 确保所有表都启用了行级安全

-- 启用RLS
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_unread_counts ENABLE ROW LEVEL SECURITY;

-- 聊天频道策略
CREATE POLICY "用户只能查看自己有权限的频道" ON chat_channels
    FOR SELECT USING (
        -- 公共频道 (#general)
        type = 'general' 
        OR 
        -- 私聊频道 (用户是参与者)
        (type = 'direct' AND id IN (
            SELECT channel_id FROM chat_channel_members 
            WHERE user_id = auth.uid()
        ))
        OR
        -- 用户是频道创建者
        created_by = auth.uid()
    );

CREATE POLICY "用户可以创建私聊频道" ON chat_channels
    FOR INSERT WITH CHECK (
        -- 只能创建私聊频道
        type = 'direct' 
        AND created_by = auth.uid()
    );

CREATE POLICY "只有管理员可以修改频道" ON chat_channels
    FOR UPDATE USING (
        -- 检查用户是否为Master或Firstmate
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' IN ('master', 'firstmate')
        )
    );

-- 聊天消息策略
CREATE POLICY "用户只能查看有权限频道的消息" ON chat_messages
    FOR SELECT USING (
        channel_id IN (
            SELECT id FROM chat_channels 
            WHERE 
                -- 公共频道
                type = 'general' 
                OR 
                -- 私聊频道 (用户是成员)
                (type = 'direct' AND id IN (
                    SELECT channel_id FROM chat_channel_members 
                    WHERE user_id = auth.uid()
                ))
                OR
                -- 用户是频道创建者
                created_by = auth.uid()
        )
    );

CREATE POLICY "用户可以发送消息到有权限的频道" ON chat_messages
    FOR INSERT WITH CHECK (
        -- 消息发送者必须是当前用户
        user_id = auth.uid()
        AND
        -- 检查用户对频道的权限
        channel_id IN (
            SELECT id FROM chat_channels 
            WHERE 
                -- 公共频道 (需要检查用户角色)
                (type = 'general' AND EXISTS (
                    SELECT 1 FROM auth.users 
                    WHERE id = auth.uid() 
                    AND raw_user_meta_data->>'role' IN ('master', 'firstmate', 'member')
                ))
                OR 
                -- 私聊频道 (用户是成员)
                (type = 'direct' AND id IN (
                    SELECT channel_id FROM chat_channel_members 
                    WHERE user_id = auth.uid()
                ))
        )
    );

CREATE POLICY "用户只能删除自己的消息" ON chat_messages
    FOR DELETE USING (
        user_id = auth.uid()
        OR
        -- 管理员可以删除任何消息
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' IN ('master', 'firstmate')
        )
    );

CREATE POLICY "用户只能更新自己的消息" ON chat_messages
    FOR UPDATE USING (
        user_id = auth.uid()
        OR
        -- 管理员可以更新任何消息
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' IN ('master', 'firstmate')
        )
    );

-- 频道成员策略
CREATE POLICY "用户只能查看自己参与的频道成员" ON chat_channel_members
    FOR SELECT USING (
        user_id = auth.uid()
        OR
        channel_id IN (
            SELECT channel_id FROM chat_channel_members 
            WHERE user_id = auth.uid()
        )
        OR
        -- 管理员可以查看所有成员
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' IN ('master', 'firstmate')
        )
    );

CREATE POLICY "用户可以加入私聊频道" ON chat_channel_members
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND
        channel_id IN (
            SELECT id FROM chat_channels 
            WHERE type = 'direct'
        )
    );

CREATE POLICY "用户可以离开频道" ON chat_channel_members
    FOR DELETE USING (
        user_id = auth.uid()
        OR
        -- 管理员可以移除任何成员
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' IN ('master', 'firstmate')
        )
    );

-- 未读计数策略
CREATE POLICY "用户只能查看自己的未读计数" ON chat_unread_counts
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "用户只能更新自己的未读计数" ON chat_unread_counts
    FOR ALL USING (user_id = auth.uid());

-- 创建安全函数：检查用户聊天权限
CREATE OR REPLACE FUNCTION check_chat_permission(target_user_id UUID, channel_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    current_user_role TEXT;
    target_user_role TEXT;
BEGIN
    -- 获取当前用户角色
    SELECT raw_user_meta_data->>'role' INTO current_user_role
    FROM auth.users WHERE id = auth.uid();
    
    -- 获取目标用户角色
    SELECT raw_user_meta_data->>'role' INTO target_user_role
    FROM auth.users WHERE id = target_user_id;
    
    -- 权限检查逻辑
    CASE 
        WHEN current_user_role = 'fan' THEN
            -- Fan不能发起聊天
            RETURN FALSE;
        WHEN current_user_role = 'seller' THEN
            -- Seller可以与Master/Firstmate聊天，但不能访问#general
            RETURN channel_type = 'direct' AND target_user_role IN ('master', 'firstmate');
        WHEN current_user_role = 'member' THEN
            -- Member只能与Master聊天，可以访问#general
            RETURN (channel_type = 'direct' AND target_user_role = 'master') 
                   OR channel_type = 'general';
        WHEN current_user_role IN ('master', 'firstmate') THEN
            -- Master/Firstmate可以与任何人聊天
            RETURN TRUE;
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器：自动设置消息时间戳
CREATE OR REPLACE FUNCTION set_message_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.created_at = NOW();
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_message_timestamp_trigger
    BEFORE INSERT ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION set_message_timestamp();

-- 创建触发器：更新未读计数
CREATE OR REPLACE FUNCTION update_unread_count()
RETURNS TRIGGER AS $$
BEGIN
    -- 为频道中的其他用户增加未读计数
    INSERT INTO chat_unread_counts (user_id, channel_id, count)
    SELECT 
        cm.user_id,
        NEW.channel_id,
        1
    FROM chat_channel_members cm
    WHERE cm.channel_id = NEW.channel_id 
    AND cm.user_id != NEW.user_id
    ON CONFLICT (user_id, channel_id) 
    DO UPDATE SET 
        count = chat_unread_counts.count + 1,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_unread_count_trigger
    AFTER INSERT ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_unread_count(); 