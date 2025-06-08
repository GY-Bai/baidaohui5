import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Badge } from '@kit/ui/badge';
import { Settings, User, Mail, Calendar, Shield } from 'lucide-react';

export default async function SellerSettingsPage() {
  const supabase = getSupabaseServerClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">账户设置</h1>
        <p className="text-gray-600">管理您的账户信息和偏好设置</p>
      </div>

      {/* 账户信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>账户信息</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-700">邮箱地址</label>
              <div className="flex items-center space-x-2 mt-1">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-gray-900">{user?.email}</span>
                <Badge variant="default" className="text-xs">
                  已验证
                </Badge>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">用户角色</label>
              <div className="flex items-center space-x-2 mt-1">
                <Shield className="h-4 w-4 text-gray-400" />
                <span className="text-gray-900">商户 (Seller)</span>
                <Badge variant="outline" className="text-xs">
                  活跃
                </Badge>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">注册时间</label>
              <div className="flex items-center space-x-2 mt-1">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-gray-900">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '未知'}
                </span>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">用户ID</label>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-gray-900 font-mono text-sm">
                  {user?.id}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 系统设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>系统设置</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h4 className="font-medium">API密钥管理</h4>
                <p className="text-sm text-gray-600">管理您的Stripe API密钥配置</p>
              </div>
              <Badge variant="outline">
                已配置
              </Badge>
            </div>
            
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h4 className="font-medium">商品同步</h4>
                <p className="text-sm text-gray-600">自动同步Stripe商品信息</p>
              </div>
              <Badge variant="default">
                启用
              </Badge>
            </div>
            
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h4 className="font-medium">支付通知</h4>
                <p className="text-sm text-gray-600">接收支付成功的邮件通知</p>
              </div>
              <Badge variant="default">
                启用
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 帮助信息 */}
      <Card>
        <CardHeader>
          <CardTitle>使用指南</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900">1. 配置API密钥</h4>
              <p className="text-sm text-blue-700">
                在"密钥管理"页面添加您的Stripe API密钥，包括Publishable Key和Secret Key。
              </p>
            </div>
            
            <div className="p-3 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-900">2. 添加商品</h4>
              <p className="text-sm text-green-700">
                在"商品管理"页面添加您的商品信息，包括名称、描述、价格和Stripe支付链接。
              </p>
            </div>
            
            <div className="p-3 bg-purple-50 rounded-lg">
              <h4 className="font-medium text-purple-900">3. 管理订单</h4>
              <p className="text-sm text-purple-700">
                系统会自动同步您的Stripe订单信息，您可以在仪表盘查看销售数据。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 