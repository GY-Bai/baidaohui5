'use client';

import { useState, useEffect } from 'react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@kit/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@kit/ui/dialog';
import { Badge } from '@kit/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@kit/ui/select';
import { 
  Plus, 
  Copy, 
  Edit, 
  Trash2, 
  Users, 
  Calendar,
  Link as LinkIcon,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';

interface InviteLink {
  id: string;
  code: string;
  target_role: string;
  max_uses: number;
  current_uses: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string;
}

export default function InviteManagePage() {
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newInvite, setNewInvite] = useState({
    code: '',
    target_role: 'member',
    max_uses: 10,
    expires_days: 30,
  });

  const supabase = useSupabase();

  useEffect(() => {
    loadInviteLinks();
  }, []);

  const loadInviteLinks = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('invite_links')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setInviteLinks(data || []);
    } catch (error) {
      console.error('加载邀请链接失败:', error);
      toast.error('加载邀请链接失败');
    } finally {
      setIsLoading(false);
    }
  };

  const createInviteLink = async () => {
    try {
      if (!newInvite.code.trim()) {
        toast.error('请输入邀请码');
        return;
      }

      const expiresAt = newInvite.expires_days > 0 
        ? new Date(Date.now() + newInvite.expires_days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { data, error } = await supabase
        .from('invite_links')
        .insert({
          code: newInvite.code.toUpperCase(),
          target_role: newInvite.target_role,
          max_uses: newInvite.max_uses,
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error('邀请码已存在，请使用其他邀请码');
        } else {
          throw error;
        }
        return;
      }

      setInviteLinks(prev => [data, ...prev]);
      setIsCreateDialogOpen(false);
      setNewInvite({
        code: '',
        target_role: 'member',
        max_uses: 10,
        expires_days: 30,
      });
      
      toast.success('邀请链接创建成功');
    } catch (error) {
      console.error('创建邀请链接失败:', error);
      toast.error('创建邀请链接失败');
    }
  };

  const toggleInviteStatus = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('invite_links')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;

      setInviteLinks(prev => 
        prev.map(link => 
          link.id === id ? { ...link, is_active: !isActive } : link
        )
      );

      toast.success(isActive ? '邀请链接已禁用' : '邀请链接已启用');
    } catch (error) {
      console.error('更新邀请链接状态失败:', error);
      toast.error('更新状态失败');
    }
  };

  const deleteInviteLink = async (id: string) => {
    if (!confirm('确定要删除这个邀请链接吗？')) return;

    try {
      const { error } = await supabase
        .from('invite_links')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setInviteLinks(prev => prev.filter(link => link.id !== id));
      toast.success('邀请链接已删除');
    } catch (error) {
      console.error('删除邀请链接失败:', error);
      toast.error('删除失败');
    }
  };

  const copyInviteUrl = (code: string) => {
    const url = `${window.location.origin}/invite/${code}`;
    navigator.clipboard.writeText(url);
    toast.success('邀请链接已复制到剪贴板');
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewInvite(prev => ({ ...prev, code: result }));
  };

  const getRoleDisplayName = (role: string) => {
    const roleNames: Record<string, string> = {
      member: '会员',
      seller: '商家',
    };
    return roleNames[role] || role;
  };

  const getStatusBadge = (link: InviteLink) => {
    if (!link.is_active) {
      return <Badge variant="secondary">已禁用</Badge>;
    }
    
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return <Badge variant="destructive">已过期</Badge>;
    }
    
    if (link.current_uses >= link.max_uses) {
      return <Badge variant="destructive">已用完</Badge>;
    }
    
    return <Badge variant="default">有效</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">邀请链接管理</h1>
          <p className="text-gray-600">创建和管理用户邀请链接</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              创建邀请链接
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建新的邀请链接</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="code">邀请码</Label>
                <div className="flex space-x-2">
                  <Input
                    id="code"
                    value={newInvite.code}
                    onChange={(e) => setNewInvite(prev => ({ 
                      ...prev, 
                      code: e.target.value.toUpperCase() 
                    }))}
                    placeholder="输入邀请码"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generateRandomCode}
                  >
                    随机生成
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="target_role">目标角色</Label>
                <Select
                  value={newInvite.target_role}
                  onValueChange={(value) => setNewInvite(prev => ({ 
                    ...prev, 
                    target_role: value 
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">会员</SelectItem>
                    <SelectItem value="seller">商家</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="max_uses">最大使用次数</Label>
                <Input
                  id="max_uses"
                  type="number"
                  min="1"
                  value={newInvite.max_uses}
                  onChange={(e) => setNewInvite(prev => ({ 
                    ...prev, 
                    max_uses: parseInt(e.target.value) || 1 
                  }))}
                />
              </div>

              <div>
                <Label htmlFor="expires_days">有效期（天）</Label>
                <Input
                  id="expires_days"
                  type="number"
                  min="0"
                  value={newInvite.expires_days}
                  onChange={(e) => setNewInvite(prev => ({ 
                    ...prev, 
                    expires_days: parseInt(e.target.value) || 0 
                  }))}
                  placeholder="0 表示永不过期"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  取消
                </Button>
                <Button onClick={createInviteLink}>
                  创建
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <LinkIcon className="h-5 w-5 mr-2" />
            邀请链接列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">加载中...</div>
          ) : inviteLinks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              暂无邀请链接
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>邀请码</TableHead>
                  <TableHead>目标角色</TableHead>
                  <TableHead>使用情况</TableHead>
                  <TableHead>有效期</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inviteLinks.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell className="font-mono">
                      {link.code}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getRoleDisplayName(link.target_role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4" />
                        <span>{link.current_uses}/{link.max_uses}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {link.expires_at ? (
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {new Date(link.expires_at).toLocaleDateString()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-500">永不过期</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(link)}
                    </TableCell>
                    <TableCell>
                      {new Date(link.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyInviteUrl(link.code)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleInviteStatus(link.id, link.is_active)}
                        >
                          {link.is_active ? (
                            <XCircle className="h-4 w-4" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteInviteLink(link.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 