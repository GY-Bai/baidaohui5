'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { Badge } from '@kit/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';
import { 
  Users, 
  DollarSign, 
  ShoppingCart, 
  Star,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  pendingOrders: number;
  completedOrders: number;
  refundedOrders: number;
  averageRating: number;
}

interface RecentOrder {
  id: string;
  user_name: string;
  amount: number;
  status: string;
  is_urgent: boolean;
  created_at: string;
}

interface RecentUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
  last_sign_in: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // 并行获取所有数据
      const [statsRes, ordersRes, usersRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/recent-orders'),
        fetch('/api/admin/recent-users'),
      ]);

      if (!statsRes.ok || !ordersRes.ok || !usersRes.ok) {
        throw new Error('获取数据失败');
      }

      const [statsData, ordersData, usersData] = await Promise.all([
        statsRes.json(),
        ordersRes.json(),
        usersRes.json(),
      ]);

      setStats(statsData);
      setRecentOrders(ordersData.orders);
      setRecentUsers(usersData.users);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'pending': { label: '待支付', variant: 'secondary' as const },
      'paid-queued': { label: '排队中', variant: 'default' as const },
      'processing': { label: '处理中', variant: 'default' as const },
      'completed': { label: '已完成', variant: 'default' as const },
      'refunded': { label: '已退款', variant: 'destructive' as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || 
                  { label: status, variant: 'secondary' as const };

    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      'fan': { label: '粉丝', variant: 'secondary' as const },
      'member': { label: '会员', variant: 'default' as const },
      'master': { label: '大师', variant: 'default' as const },
      'firstmate': { label: '大副', variant: 'default' as const },
      'seller': { label: '商家', variant: 'outline' as const },
    };

    const config = roleConfig[role as keyof typeof roleConfig] || 
                  { label: role, variant: 'secondary' as const };

    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">加载中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchDashboardData}>
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">管理后台</h1>
        <p className="text-gray-600">百刀会运营数据总览</p>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总用户数</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                注册用户总数
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总收入</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
              <p className="text-xs text-muted-foreground">
                累计收入金额
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总订单数</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-yellow-600">{stats.pendingOrders} 待处理</span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">平均评分</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageRating.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">
                用户满意度评分
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 详细数据 */}
      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList>
          <TabsTrigger value="orders">最近订单</TabsTrigger>
          <TabsTrigger value="users">最近用户</TabsTrigger>
          <TabsTrigger value="analytics">数据分析</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>最近订单</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="font-medium">订单 #{order.id.slice(-8)}</p>
                        <p className="text-sm text-gray-600">{order.user_name}</p>
                      </div>
                      {order.is_urgent && (
                        <Badge variant="destructive">紧急</Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(order.amount)}</p>
                        <p className="text-sm text-gray-600">{formatDate(order.created_at)}</p>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>最近注册用户</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{user.email}</p>
                      <p className="text-sm text-gray-600">
                        注册时间: {formatDate(user.created_at)}
                      </p>
                      {user.last_sign_in && (
                        <p className="text-sm text-gray-600">
                          最后登录: {formatDate(user.last_sign_in)}
                        </p>
                      )}
                    </div>
                    <div>
                      {getRoleBadge(user.role)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>订单状态分布</CardTitle>
              </CardHeader>
              <CardContent>
                {stats && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-yellow-500" />
                        待处理
                      </span>
                      <span className="font-medium">{stats.pendingOrders}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                        已完成
                      </span>
                      <span className="font-medium">{stats.completedOrders}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center">
                        <XCircle className="h-4 w-4 mr-2 text-red-500" />
                        已退款
                      </span>
                      <span className="font-medium">{stats.refundedOrders}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>业务指标</CardTitle>
              </CardHeader>
              <CardContent>
                {stats && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center">
                        <TrendingUp className="h-4 w-4 mr-2 text-blue-500" />
                        商品总数
                      </span>
                      <span className="font-medium">{stats.totalProducts}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>订单完成率</span>
                      <span className="font-medium">
                        {((stats.completedOrders / stats.totalOrders) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>平均订单金额</span>
                      <span className="font-medium">
                        {formatCurrency(stats.totalRevenue / stats.totalOrders)}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 