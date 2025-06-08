'use client';

import { useState, useEffect } from 'react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Badge } from '@kit/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@kit/ui/table';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Textarea } from '@kit/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@kit/ui/dialog';
import { Search, Eye, MessageSquare, Filter } from 'lucide-react';
import { toast } from 'sonner';

interface Order {
  _id: string;
  user_id: string;
  user_email: string;
  amount: number;
  message: string;
  is_urgent: boolean;
  images: string[];
  status: 'pending' | 'paid-queued' | 'processing' | 'completed' | 'refunded';
  created_at: string;
  updated_at: string;
  reply?: string;
  reply_images: string[];
}

const statusLabels = {
  'pending': '待支付',
  'paid-queued': '排队中',
  'processing': '处理中',
  'completed': '已完成',
  'refunded': '已退款'
};

const statusColors = {
  'pending': 'bg-yellow-100 text-yellow-800',
  'paid-queued': 'bg-blue-100 text-blue-800',
  'processing': 'bg-purple-100 text-purple-800',
  'completed': 'bg-green-100 text-green-800',
  'refunded': 'bg-red-100 text-red-800'
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [reply, setReply] = useState('');
  const [replyImages, setReplyImages] = useState<string[]>([]);
  const [submittingReply, setSubmittingReply] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/fortune/admin');
      if (!response.ok) throw new Error('获取订单失败');
      const data = await response.json();
      setOrders(data.orders || []);
    } catch (error) {
      console.error('获取订单失败:', error);
      toast.error('获取订单失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async () => {
    if (!selectedOrder || !reply.trim()) return;

    setSubmittingReply(true);
    try {
      const response = await fetch(`/api/fortune/admin/${selectedOrder._id}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reply: reply.trim(),
          reply_images: replyImages,
        }),
      });

      if (!response.ok) throw new Error('回复失败');

      toast.success('回复成功，用户将收到通知');
      setReply('');
      setReplyImages([]);
      setSelectedOrder(null);
      fetchOrders(); // 刷新订单列表
    } catch (error) {
      console.error('回复失败:', error);
      toast.error('回复失败');
    } finally {
      setSubmittingReply(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.user_email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

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
        <h1 className="text-2xl font-bold">算命订单管理</h1>
        <Button onClick={fetchOrders} variant="outline">
          刷新
        </Button>
      </div>

      {/* 筛选和搜索 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="搜索订单ID或用户邮箱..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="筛选状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待支付</SelectItem>
                <SelectItem value="paid-queued">排队中</SelectItem>
                <SelectItem value="processing">处理中</SelectItem>
                <SelectItem value="completed">已完成</SelectItem>
                <SelectItem value="refunded">已退款</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 订单表格 */}
      <Card>
        <CardHeader>
          <CardTitle>订单列表 ({filteredOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>订单ID</TableHead>
                <TableHead>用户</TableHead>
                <TableHead>金额(USD)</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>紧急</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order._id}>
                  <TableCell className="font-mono text-sm">
                    {order._id.slice(-8)}
                  </TableCell>
                  <TableCell>{order.user_email}</TableCell>
                  <TableCell className="font-semibold">
                    ${order.amount}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[order.status]}>
                      {statusLabels[order.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {order.is_urgent && (
                      <Badge variant="destructive">紧急</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(order.created_at).toLocaleString('zh-CN')}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setSelectedOrder(order)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            查看
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>订单详情</DialogTitle>
                          </DialogHeader>
                          {selectedOrder && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium">订单ID</label>
                                  <p className="font-mono">{selectedOrder._id}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">用户邮箱</label>
                                  <p>{selectedOrder.user_email}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">金额</label>
                                  <p className="font-semibold">${selectedOrder.amount} USD</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">状态</label>
                                  <Badge className={statusColors[selectedOrder.status]}>
                                    {statusLabels[selectedOrder.status]}
                                  </Badge>
                                </div>
                              </div>
                              
                              <div>
                                <label className="text-sm font-medium">用户附言</label>
                                <p className="mt-1 p-3 bg-gray-50 rounded-md whitespace-pre-wrap">
                                  {selectedOrder.message}
                                </p>
                              </div>

                              {selectedOrder.images.length > 0 && (
                                <div>
                                  <label className="text-sm font-medium">用户上传图片</label>
                                  <div className="mt-1 grid grid-cols-2 gap-2">
                                    {selectedOrder.images.map((img, idx) => (
                                      <img 
                                        key={idx} 
                                        src={img} 
                                        alt={`用户图片${idx + 1}`}
                                        className="w-full h-32 object-cover rounded-md"
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}

                              {selectedOrder.reply && (
                                <div>
                                  <label className="text-sm font-medium">已回复内容</label>
                                  <p className="mt-1 p-3 bg-blue-50 rounded-md whitespace-pre-wrap">
                                    {selectedOrder.reply}
                                  </p>
                                </div>
                              )}

                              {selectedOrder.status === 'paid-queued' && (
                                <div className="border-t pt-4">
                                  <label className="text-sm font-medium">回复用户</label>
                                  <Textarea
                                    placeholder="输入回复内容..."
                                    value={reply}
                                    onChange={(e) => setReply(e.target.value)}
                                    className="mt-2"
                                    rows={4}
                                  />
                                  <Button 
                                    onClick={handleReply}
                                    disabled={!reply.trim() || submittingReply}
                                    className="mt-2"
                                  >
                                    <MessageSquare className="w-4 h-4 mr-2" />
                                    {submittingReply ? '发送中...' : '发送回复'}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredOrders.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              暂无订单数据
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 