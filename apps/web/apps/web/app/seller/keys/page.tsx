'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Badge } from '@kit/ui/badge';
import { Switch } from '@kit/ui/switch';
import { 
  Key, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff,
  AlertCircle,
  CheckCircle 
} from 'lucide-react';

interface ApiKey {
  id: string;
  seller_email: string;
  stripe_publishable_key: string;
  stripe_secret_key: string;
  webhook_secret?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function SellerKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [showForm, setShowForm] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);

  // 表单状态
  const [formData, setFormData] = useState({
    stripe_publishable_key: '',
    stripe_secret_key: '',
    webhook_secret: '',
    is_active: true,
  });

  // 获取密钥列表
  const fetchKeys = async () => {
    try {
      const response = await fetch('/api/key/seller');
      if (!response.ok) throw new Error('获取密钥失败');
      
      const data = await response.json();
      setKeys(data.keys || []);
    } catch (error) {
      console.error('获取密钥列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  // 切换密钥可见性
  const toggleSecretVisibility = (keyId: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [keyId]: !prev[keyId]
    }));
  };

  // 遮罩密钥显示
  const maskSecret = (secret: string, show: boolean) => {
    if (show) return secret;
    return secret.substring(0, 8) + '••••••••••••••••';
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      stripe_publishable_key: '',
      stripe_secret_key: '',
      webhook_secret: '',
      is_active: true,
    });
    setEditingKey(null);
    setShowForm(false);
  };

  // 打开编辑表单
  const openEditForm = (key: ApiKey) => {
    setEditingKey(key);
    setFormData({
      stripe_publishable_key: key.stripe_publishable_key,
      stripe_secret_key: key.stripe_secret_key,
      webhook_secret: key.webhook_secret || '',
      is_active: key.is_active,
    });
    setShowForm(true);
  };

  // 保存密钥
  const handleSave = async () => {
    try {
      const url = editingKey ? `/api/key/seller/${editingKey.id}` : '/api/key/seller';
      const method = editingKey ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '保存失败');
      }

      alert(editingKey ? '密钥更新成功' : '密钥创建成功');
      resetForm();
      fetchKeys();
    } catch (error) {
      alert(error instanceof Error ? error.message : '保存失败');
    }
  };

  // 删除密钥
  const handleDelete = async (keyId: string) => {
    if (!confirm('确定要删除这个密钥吗？此操作不可撤销。')) return;

    try {
      const response = await fetch(`/api/key/seller/${keyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('删除失败');

      alert('密钥删除成功');
      fetchKeys();
    } catch (error) {
      alert('删除密钥失败');
    }
  };

  // 切换密钥状态
  const toggleKeyStatus = async (keyId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/key/seller/${keyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: isActive }),
      });

      if (!response.ok) throw new Error('更新状态失败');

      alert(`密钥已${isActive ? '启用' : '禁用'}`);
      fetchKeys();
    } catch (error) {
      alert('更新状态失败');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API密钥管理</h1>
          <p className="text-gray-600">管理您的Stripe API密钥配置</p>
        </div>
        
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          添加密钥
        </Button>
      </div>

      {/* 添加/编辑表单 */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingKey ? '编辑密钥' : '添加新密钥'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="publishable_key">Stripe Publishable Key</Label>
              <Input
                id="publishable_key"
                placeholder="pk_test_..."
                value={formData.stripe_publishable_key}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  stripe_publishable_key: e.target.value
                }))}
              />
            </div>
            
            <div>
              <Label htmlFor="secret_key">Stripe Secret Key</Label>
              <Input
                id="secret_key"
                type="password"
                placeholder="sk_test_..."
                value={formData.stripe_secret_key}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  stripe_secret_key: e.target.value
                }))}
              />
            </div>
            
            <div>
              <Label htmlFor="webhook_secret">Webhook Secret (可选)</Label>
              <Input
                id="webhook_secret"
                placeholder="whsec_..."
                value={formData.webhook_secret}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  webhook_secret: e.target.value
                }))}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({
                  ...prev,
                  is_active: checked
                }))}
              />
              <Label htmlFor="is_active">启用此密钥</Label>
            </div>
            
            <div className="flex space-x-2 pt-4">
              <Button onClick={handleSave} className="flex-1">
                {editingKey ? '更新' : '创建'}
              </Button>
              <Button 
                variant="outline" 
                onClick={resetForm}
                className="flex-1"
              >
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 密钥列表 */}
      {keys.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Key className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              还没有配置API密钥
            </h3>
            <p className="text-gray-600 text-center mb-4">
              添加您的Stripe API密钥以开始接收支付
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              添加第一个密钥
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {keys.map((key) => (
            <Card key={key.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Key className="h-5 w-5 text-blue-500" />
                    <div>
                      <CardTitle className="text-lg">
                        Stripe API 密钥
                      </CardTitle>
                      <p className="text-sm text-gray-600">
                        创建于 {new Date(key.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={key.is_active ? "default" : "secondary"}>
                      {key.is_active ? "启用" : "禁用"}
                    </Badge>
                    <Switch
                      checked={key.is_active}
                      onCheckedChange={(checked) => toggleKeyStatus(key.id, checked)}
                    />
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      Publishable Key
                    </Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Input
                        value={maskSecret(key.stripe_publishable_key, showSecrets[key.id] || false)}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleSecretVisibility(key.id)}
                      >
                        {showSecrets[key.id] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      Secret Key
                    </Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Input
                        value={maskSecret(key.stripe_secret_key, showSecrets[key.id] || false)}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleSecretVisibility(key.id)}
                      >
                        {showSecrets[key.id] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {key.webhook_secret && (
                    <div>
                      <Label className="text-sm font-medium text-gray-700">
                        Webhook Secret
                      </Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <Input
                          value={maskSecret(key.webhook_secret, showSecrets[key.id] || false)}
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleSecretVisibility(key.id)}
                        >
                          {showSecrets[key.id] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center space-x-2">
                    {key.is_active ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    )}
                    <span className="text-sm text-gray-600">
                      {key.is_active ? '密钥正常工作' : '密钥已禁用'}
                    </span>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditForm(key)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      编辑
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(key.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      删除
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 