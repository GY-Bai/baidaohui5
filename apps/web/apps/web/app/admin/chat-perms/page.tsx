'use client';

import { useState, useEffect } from 'react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@kit/ui/table';
import { Badge } from '@kit/ui/badge';
import { Switch } from '@kit/ui/switch';
import { Search, MessageSquare, Users } from 'lucide-react';
import { toast } from 'sonner';

interface ChatPermission {
  user_id: string;
  user_email: string;
  user_name?: string;
  role: string;
  can_chat: boolean;
  can_access_general: boolean;
  last_active?: string;
  created_at: string;
}

export default function AdminChatPermsPage() {
  const [permissions, setPermissions] = useState<ChatPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updating, setUpdating] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const response = await fetch('/api/chat/permission');
      if (!response.ok) throw new Error('获取权限失败');
      const data = await response.json();
      setPermissions(data.permissions || []);
    } catch (error) {
      console.error('获取权限失败:', error);
      toast.error('获取权限失败');
    } finally {
      setLoading(false);
    }
  };

  const updatePermission = async (userId: string, field: 'can_chat' | 'can_access_general', value: boolean) => {
    setUpdating(prev => ({ ...prev, [userId]: true }));
    
    try {
      const response = await fetch(`/api/chat/permission/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          [field]: value,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '更新失败');
      }

      // 更新本地状态
      setPermissions(prev => 
        prev.map(perm => 
          perm.user_id === userId 
            ? { ...perm, [field]: value }
            : perm
        )
      );

      toast.success('权限更新成功');
    } catch (error) {
      console.error('更新权限失败:', error);
      toast.error(error instanceof Error ? error.message : '更新权限失败');
    } finally {
      setUpdating(prev => ({ ...prev, [userId]: false }));
    }
  };

  const filteredPermissions = permissions.filter(perm => {
    const searchLower = searchTerm.toLowerCase();
    return (
      perm.user_email.toLowerCase().includes(searchLower) ||
      (perm.user_name && perm.user_name.toLowerCase().includes(searchLower)) ||
      perm.role.toLowerCase().includes(searchLower)
    );
  });

  const roleLabels = {
    'fan': '粉丝',
    'member': '会员',
    'seller': '卖家',
    'firstmate': '大副',
    'master': '大师'
  };

  const roleColors = {
    'fan': 'bg-gray-100 text-gray-800',
    'member': 'bg-blue-100 text-blue-800',
    'seller': 'bg-green-100 text-green-800',
    'firstmate': 'bg-purple-100 text-purple-800',
    'master': 'bg-red-100 text-red-800'
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">聊天权限管理</h1>
        <Button onClick={fetchPermissions} variant="outline">
          刷新
        </Button>
      </div>

      {/* 搜索 */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="搜索用户邮箱、姓名或角色..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* 权限表格 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            用户权限列表 ({filteredPermissions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>私聊权限</TableHead>
                <TableHead>群聊权限</TableHead>
                <TableHead>最后活跃</TableHead>
                <TableHead>注册时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPermissions.map((perm) => (
                <TableRow key={perm.user_id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{perm.user_name || '未设置'}</div>
                      <div className="text-sm text-gray-500">{perm.user_email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={roleColors[perm.role as keyof typeof roleColors]}>
                      {roleLabels[perm.role as keyof typeof roleLabels] || perm.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={perm.can_chat}
                        onCheckedChange={(checked) => updatePermission(perm.user_id, 'can_chat', checked)}
                        disabled={updating[perm.user_id] || ['master', 'firstmate'].includes(perm.role)}
                      />
                      <span className="text-sm">
                        {perm.can_chat ? '允许' : '禁止'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={perm.can_access_general}
                        onCheckedChange={(checked) => updatePermission(perm.user_id, 'can_access_general', checked)}
                        disabled={updating[perm.user_id] || !['member', 'master', 'firstmate'].includes(perm.role)}
                      />
                      <span className="text-sm">
                        {perm.can_access_general ? '允许' : '禁止'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {perm.last_active ? (
                      <span className="text-sm">
                        {new Date(perm.last_active).toLocaleString('zh-CN')}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">从未活跃</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {new Date(perm.created_at).toLocaleString('zh-CN')}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredPermissions.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? '没有找到匹配的用户' : '暂无用户数据'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 权限说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            权限说明
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><strong>私聊权限：</strong>控制用户是否可以发起和参与私聊对话</div>
          <div><strong>群聊权限：</strong>控制Member是否可以访问#general频道</div>
          <div><strong>注意：</strong>Master和Firstmate的权限无法修改，始终拥有所有权限</div>
          <div><strong>Fan和Seller：</strong>默认无群聊权限，只有Member及以上角色可以访问群聊</div>
        </CardContent>
      </Card>
    </div>
  );
} 