import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Badge } from '@kit/ui/badge';
import { Key, ShoppingBag, DollarSign, TrendingUp } from 'lucide-react';

export default async function SellerDashboard() {
  const supabase = getSupabaseServerClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 这里应该调用相关服务获取商户数据
  // 暂时使用模拟数据
  const stats = {
    totalKeys: 2,
    activeKeys: 1,
    totalProducts: 15,
    activeProducts: 12,
    monthlyRevenue: 2580,
    totalOrders: 45,
  };

  return (
    <div className="space-y-6">
      {/* 欢迎信息 */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          欢迎回来，{user?.email}
        </h1>
        <p className="text-blue-100">
          管理您的商户密钥和商品信息
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              API密钥
            </CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalKeys}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <span>活跃: {stats.activeKeys}</span>
              <Badge variant={stats.activeKeys > 0 ? "default" : "secondary"} className="text-xs">
                {stats.activeKeys > 0 ? "正常" : "待配置"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              商品数量
            </CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <span>上架: {stats.activeProducts}</span>
              <Badge variant="default" className="text-xs">
                活跃
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              月度收入
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.monthlyRevenue}</div>
            <p className="text-xs text-muted-foreground">
              +12.5% 较上月
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              总订单数
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground">
              +8 本月新增
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 快速操作 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>快速操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <div className="flex items-center space-x-3">
                <Key className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="font-medium">管理API密钥</div>
                  <div className="text-sm text-gray-500">配置Stripe密钥</div>
                </div>
              </div>
              <Badge variant="outline">
                {stats.activeKeys}/{stats.totalKeys}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <div className="flex items-center space-x-3">
                <ShoppingBag className="h-5 w-5 text-green-500" />
                <div>
                  <div className="font-medium">商品管理</div>
                  <div className="text-sm text-gray-500">上传和管理商品</div>
                </div>
              </div>
              <Badge variant="outline">
                {stats.activeProducts} 活跃
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>系统状态</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">API连接状态</span>
              <Badge variant={stats.activeKeys > 0 ? "default" : "destructive"}>
                {stats.activeKeys > 0 ? "正常" : "未配置"}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">商品同步状态</span>
              <Badge variant="default">
                正常
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">支付处理状态</span>
              <Badge variant="default">
                正常
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 