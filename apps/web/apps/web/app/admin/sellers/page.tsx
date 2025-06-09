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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@kit/ui/dialog';
import { Badge } from '@kit/ui/badge';
import { Key, Edit, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface SellerKey {
  _id: string;
  seller_id: string;
  seller_email: string;
  stripe_publishable_key: string;
  stripe_secret_key: string;
  webhook_secret?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminSellersPage() {
  const [keys, setKeys] = useState<SellerKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<SellerKey | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showSecrets, setShowSecrets] = useState<{[key: string]: boolean}>({});
  const [formData, setFormData] = useState({
    seller_email: '',
    stripe_publishable_key: '',
    stripe_secret_key: '',
    webhook_secret: '',
    is_active: true,
  });

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      const response = await fetch('/api/key');
      if (!response.ok) throw new Error('获取密钥失败');
      const data = await response.json();
      setKeys(data.keys || []);
    } catch (error) {
      console.error('获取密钥失败:', error);
      toast.error('获取密钥失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const url = selectedKey ? `/api/key/${selectedKey._id}` : '/api/key';
      const method = selectedKey ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '操作失败');
      }

      toast.success(selectedKey ? '更新成功' : '创建成功');
      setIsEditing(false);
      setSelectedKey(null);
      resetForm();
      fetchKeys();
    } catch (error) {
      console.error('操作失败:', error);
      toast.error(error instanceof Error ? error.message : '操作失败');
    }
  };

  const handleDelete = async (keyId: string) => {
    if (!confirm('确定要删除这个密钥配置吗？')) return;

    try {
      const response = await fetch(`/api/key/${keyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('删除失败');

      toast.success('删除成功');
      fetchKeys();
    } catch (error) {
      console.error('删除失败:', error);
      toast.error('删除失败');
    }
  };

  const resetForm = () => {
    setFormData({
      seller_email: '',
      stripe_publishable_key: '',
      stripe_secret_key: '',
      webhook_secret: '',
      is_active: true,
    });
  };

  const openEditDialog = (key?: SellerKey) => {
    if (key) {
      setSelectedKey(key);
      setFormData({
        seller_email: key.seller_email,
        stripe_publishable_key: key.stripe_publishable_key,
        stripe_secret_key: key.stripe_secret_key,
        webhook_secret: key.webhook_secret || '',
        is_active: key.is_active,
      });
    } else {
      setSelectedKey(null);
      resetForm();
    }
    setIsEditing(true);
  };

  const toggleSecretVisibility = (keyId: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [keyId]: !prev[keyId]
    }));
  };

  const maskSecret = (secret: string, show: boolean) => {
    if (show) return secret;
    return secret.substring(0, 8) + '••••••••' + secret.substring(secret.length - 4);
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
        <h1 className="text-2xl font-bold">商户密钥管理</h1>
        <Button onClick={() => openEditDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          添加密钥
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>密钥列表 ({keys.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>商户邮箱</TableHead>
                <TableHead>Publishable Key</TableHead>
                <TableHead>Secret Key</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key._id}>
                  <TableCell className="font-medium">
                    {key.seller_email}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    <div className="flex items-center gap-2">
                                             <span>{maskSecret(key.stripe_publishable_key, showSecrets[key._id] || false)}</span>
                       <Button
                         size="sm"
                         variant="ghost"
                         onClick={() => toggleSecretVisibility(key._id)}
                       >
                         {showSecrets[key._id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                       </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    <div className="flex items-center gap-2">
                                             <span>{maskSecret(key.stripe_secret_key, showSecrets[key._id] || false)}</span>
                       <Button
                         size="sm"
                         variant="ghost"
                         onClick={() => toggleSecretVisibility(key._id)}
                       >
                         {showSecrets[key._id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                       </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={key.is_active ? "default" : "secondary"}>
                      {key.is_active ? '启用' : '禁用'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(key.created_at).toLocaleString('zh-CN')}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(key)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        编辑
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(key._id)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        删除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {keys.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              暂无密钥配置
            </div>
          )}
        </CardContent>
      </Card>

      {/* 编辑对话框 */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedKey ? '编辑密钥' : '添加密钥'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">商户邮箱</label>
              <Input
                value={formData.seller_email}
                onChange={(e) => setFormData(prev => ({ ...prev, seller_email: e.target.value }))}
                placeholder="seller@example.com"
                disabled={!!selectedKey}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Stripe Publishable Key</label>
              <Input
                value={formData.stripe_publishable_key}
                onChange={(e) => setFormData(prev => ({ ...prev, stripe_publishable_key: e.target.value }))}
                placeholder="pk_test_..."
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Stripe Secret Key</label>
              <Input
                type="password"
                value={formData.stripe_secret_key}
                onChange={(e) => setFormData(prev => ({ ...prev, stripe_secret_key: e.target.value }))}
                placeholder="sk_test_..."
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Webhook Secret (可选)</label>
              <Input
                type="password"
                value={formData.webhook_secret}
                onChange={(e) => setFormData(prev => ({ ...prev, webhook_secret: e.target.value }))}
                placeholder="whsec_..."
              />
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
              />
              <label htmlFor="is_active" className="text-sm font-medium">启用</label>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSubmit} className="flex-1">
                <Key className="w-4 h-4 mr-2" />
                {selectedKey ? '更新' : '创建'}
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                取消
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 