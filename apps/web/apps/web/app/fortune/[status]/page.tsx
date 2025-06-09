'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { Badge } from '@kit/ui/badge';
import { Loader2 } from 'lucide-react';

interface Order {
  id: string;
  user_id: string;
  amount: number;
  message: string;
  is_urgent: boolean;
  images: string[];
  status: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  reply?: string;
  reply_images: string[];
}

interface OrdersResponse {
  orders: Order[];
  total: number;
  hasMore: boolean;
}

const statusMap = {
  queue: 'paid-queued',
  done: 'completed',
  refund: 'refunded',
} as const;

const statusLabels = {
  queue: '排队中',
  done: '已完成',
  refund: '已退款',
} as const;

const statusColors = {
  queue: 'bg-blue-100 text-blue-800',
  done: 'bg-green-100 text-green-800',
  refund: 'bg-red-100 text-red-800',
} as const;

export default function FortuneListPage() {
  const params = useParams();
  const status = params.status as keyof typeof statusMap;
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // 获取订单列表
  const fetchOrders = useCallback(async (pageNum: number, reset = false) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const queryParams = new URLSearchParams({
        page: pageNum.toString(),
        limit: '20',
      });

      if (status && statusMap[status]) {
        queryParams.append('status', statusMap[status]);
      }

      const response = await fetch(`/api/fortune/list?${queryParams}`);
      
      if (!response.ok) {
        throw new Error('获取订单列表失败');
      }

      const data: OrdersResponse = await response.json();
      
      if (reset || pageNum === 1) {
        setOrders(data.orders);
      } else {
        setOrders(prev => [...prev, ...data.orders]);
      }
      
      setHasMore(data.hasMore);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取订单失败');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [status]);

  // 初始加载
  useEffect(() => {
    setPage(1);
    fetchOrders(1, true);
  }, [fetchOrders]);

  // 加载更多
  const loadMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchOrders(nextPage);
    }
  };

  // 无限滚动监听
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop
        >= document.documentElement.offsetHeight - 1000
      ) {
        loadMore();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore]);

  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  // 格式化金额
  const formatAmount = (amount: number) => {
    return `$${amount.toFixed(2)}`;
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
            <Button onClick={() => fetchOrders(1, true)}>
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          算命订单 - {status ? statusLabels[status] : '全部'}
        </h1>
        <p className="text-gray-600">
          共 {orders.length} 条订单
        </p>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-500">暂无订单</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    订单 #{order.id.slice(-8)}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {order.is_urgent && (
                      <Badge variant="destructive">紧急</Badge>
                    )}
                    <Badge 
                      className={statusColors[status] || 'bg-gray-100 text-gray-800'}
                    >
                      {statusLabels[status] || order.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">金额</p>
                    <p className="font-semibold text-lg">{formatAmount(order.amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">创建时间</p>
                    <p className="text-sm">{formatDate(order.created_at)}</p>
                  </div>
                </div>

                {order.message && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-1">附言</p>
                    <p className="text-sm bg-gray-50 p-3 rounded">
                      {order.message.length > 200 
                        ? `${order.message.slice(0, 200)}...` 
                        : order.message
                      }
                    </p>
                  </div>
                )}

                {order.images && order.images.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2">图片</p>
                    <div className="grid grid-cols-3 gap-2">
                      {order.images.slice(0, 3).map((image, index) => (
                        <img
                          key={index}
                          src={image}
                          alt={`订单图片 ${index + 1}`}
                          className="w-full h-20 object-cover rounded"
                        />
                      ))}
                      {order.images.length > 3 && (
                        <div className="w-full h-20 bg-gray-100 rounded flex items-center justify-center text-sm text-gray-600">
                          +{order.images.length - 3} 张
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {order.reply && (
                  <div className="mt-4 border-t pt-4">
                    <p className="text-sm text-gray-600 mb-1">大师回复</p>
                    <p className="text-sm bg-blue-50 p-3 rounded">
                      {order.reply}
                    </p>
                    {order.completed_at && (
                      <p className="text-xs text-gray-500 mt-2">
                        完成时间: {formatDate(order.completed_at)}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {/* 加载更多按钮 */}
          {hasMore && (
            <div className="text-center py-6">
              {loadingMore ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span>加载更多...</span>
                </div>
              ) : (
                <Button onClick={loadMore} variant="outline">
                  加载更多
                </Button>
              )}
            </div>
          )}

          {!hasMore && orders.length > 0 && (
            <div className="text-center py-6">
              <p className="text-gray-500">已加载全部订单</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 