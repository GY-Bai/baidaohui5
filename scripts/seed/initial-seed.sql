-- 百刀会初始数据种子脚本
-- 创建Master用户和#general频道

-- 插入Master用户（需要在Supabase Auth中先创建用户）
-- 这里假设Master用户的UUID已知
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data,
    role
) VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'master@baidaohui.com',
    crypt('master_password_change_me', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"role": "master", "display_name": "百刀会主人", "avatar_url": ""}'::jsonb,
    'authenticated'
) ON CONFLICT (id) DO UPDATE SET
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = NOW();

-- 创建#general公共频道
INSERT INTO chat_channels (
    id,
    name,
    type,
    description,
    created_by,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'general',
    'general',
    '百刀会公共聊天频道',
    '00000000-0000-0000-0000-000000000001'::uuid,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    description = EXCLUDED.description,
    updated_at = NOW();

-- 创建欢迎消息
INSERT INTO chat_messages (
    id,
    channel_id,
    user_id,
    content,
    message_type,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    '🎉 欢迎来到百刀会！这里是我们的公共聊天频道。

📋 **频道规则：**
• 保持友善和尊重
• 禁止发布不当内容
• 有问题可以直接私信我

💬 **如何开始：**
• Member可以在此频道聊天
• 想要私聊请点击我的头像
• 查看商品请访问商店页面

期待与大家的交流！ ✨',
    'text',
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- 创建系统配置表（如果不存在）
CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 插入系统配置
INSERT INTO system_config (key, value, description) VALUES
    ('chat_settings', '{"max_message_length": 2000, "file_upload_enabled": true, "max_file_size_mb": 10}', '聊天系统设置'),
    ('payment_settings', '{"stripe_enabled": true, "min_amount_cents": 100, "max_amount_cents": 100000}', '支付系统设置'),
    ('fortune_settings', '{"base_price_cents": 2000, "rush_multiplier": 1.5, "max_queue_size": 50}', '算命系统设置'),
    ('site_settings', '{"site_name": "百刀会", "site_description": "专属粉丝俱乐部", "maintenance_mode": false}', '网站基本设置')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW();

-- 创建用户角色权限表
CREATE TABLE IF NOT EXISTS role_permissions (
    role VARCHAR(50) NOT NULL,
    permission VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (role, permission)
);

-- 插入角色权限
INSERT INTO role_permissions (role, permission) VALUES
    -- Master权限
    ('master', 'chat.general.read'),
    ('master', 'chat.general.write'),
    ('master', 'chat.direct.read'),
    ('master', 'chat.direct.write'),
    ('master', 'chat.moderate'),
    ('master', 'admin.users.manage'),
    ('master', 'admin.orders.manage'),
    ('master', 'admin.fortune.manage'),
    ('master', 'admin.system.manage'),
    
    -- Firstmate权限
    ('firstmate', 'chat.general.read'),
    ('firstmate', 'chat.general.write'),
    ('firstmate', 'chat.direct.read'),
    ('firstmate', 'chat.direct.write'),
    ('firstmate', 'chat.moderate'),
    ('firstmate', 'admin.users.view'),
    ('firstmate', 'admin.orders.view'),
    
    -- Member权限
    ('member', 'chat.general.read'),
    ('member', 'chat.general.write'),
    ('member', 'chat.direct.read'),
    ('member', 'chat.direct.write'),
    ('member', 'shop.browse'),
    ('member', 'shop.purchase'),
    ('member', 'fortune.order'),
    
    -- Seller权限
    ('seller', 'chat.direct.read'),
    ('seller', 'chat.direct.write'),
    ('seller', 'shop.manage'),
    ('seller', 'products.manage'),
    
    -- Fan权限（最基础）
    ('fan', 'shop.browse')
ON CONFLICT (role, permission) DO NOTHING;

-- 创建邀请码表（如果不存在）
CREATE TABLE IF NOT EXISTS invite_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    target_role VARCHAR(50) NOT NULL DEFAULT 'member',
    max_uses INTEGER DEFAULT 1,
    used_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建初始邀请码
INSERT INTO invite_codes (code, created_by, target_role, max_uses, expires_at) VALUES
    ('WELCOME2024', '00000000-0000-0000-0000-000000000001'::uuid, 'member', 100, NOW() + INTERVAL '30 days'),
    ('VIP2024', '00000000-0000-0000-0000-000000000001'::uuid, 'member', 10, NOW() + INTERVAL '7 days')
ON CONFLICT (code) DO NOTHING;

-- 创建通知设置表
CREATE TABLE IF NOT EXISTS notification_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id),
    email_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT true,
    chat_notifications BOOLEAN DEFAULT true,
    order_notifications BOOLEAN DEFAULT true,
    fortune_notifications BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 为Master用户创建通知设置
INSERT INTO notification_settings (user_id) VALUES
    ('00000000-0000-0000-0000-000000000001'::uuid)
ON CONFLICT (user_id) DO NOTHING;

-- 创建审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_id ON chat_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- 记录种子数据创建日志
INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values) VALUES
    ('00000000-0000-0000-0000-000000000001'::uuid, 'seed_data_created', 'system', 'initial_seed', '{"description": "Initial seed data created", "version": "1.0"}');

-- 提交事务
COMMIT;

-- 显示创建结果
SELECT 'Seed data created successfully!' as status;
SELECT 'Master user ID: 00000000-0000-0000-0000-000000000001' as master_info;
SELECT 'General channel ID: 00000000-0000-0000-0000-000000000001' as channel_info;
SELECT 'Available invite codes:' as invite_info;
SELECT code, target_role, max_uses, expires_at FROM invite_codes WHERE is_active = true; 