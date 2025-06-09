'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Badge } from '@kit/ui/badge';
import { Textarea } from '@kit/ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { 
  ShoppingBag, 
  Plus, 
  Edit, 
  Trash2, 
  ExternalLink,
  DollarSign,
  Package 
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  images: string[];
  seller_id: string;
  seller_email: string;
  stripe_price_id?: string;
  stripe_payment_link?: string;
  in_stock: boolean;
  created_at: string;
  updated_at: string;
}

const categories = [
  { value: 'jewelry', label: '珠宝首饰' },
  { value: 'crystals', label: '水晶宝石' },
  { value: 'books', label: '风水书籍' },
  { value: 'accessories', label: '开运配饰' },
  { value: 'home', label: '家居摆件' },
];

export default function SellerProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // 表单状态
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    currency: 'USD',
    category: '',
    images: [] as string[],
    stripe_price_id: '',
    stripe_payment_link: '',
  });

  // 获取商品列表
  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products/upload');
      if (!response.ok) throw new Error('获取商品失败');
      
      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('获取商品列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      currency: 'USD',
      category: '',
      images: [],
      stripe_price_id: '',
      stripe_payment_link: '',
    });
    setEditingProduct(null);
    setShowForm(false);
  };

  // 打开编辑表单
  const openEditForm = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      currency: product.currency,
      category: product.category,
      images: product.images,
      stripe_price_id: product.stripe_price_id || '',
      stripe_payment_link: product.stripe_payment_link || '',
    });
    setShowForm(true);
  };

  // 保存商品
  const handleSave = async () => {
    try {
      const url = editingProduct ? `/api/products/upload/${editingProduct.id}` : '/api/products/upload';
      const method = editingProduct ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '保存失败');
      }

      alert(editingProduct ? '商品更新成功' : '商品创建成功');
      resetForm();
      fetchProducts();
    } catch (error) {
      alert(error instanceof Error ? error.message : '保存失败');
    }
  };

  // 删除商品
  const handleDelete = async (productId: string) => {
    if (!confirm('确定要删除这个商品吗？此操作不可撤销。')) return;

    try {
      const response = await fetch(`/api/products/upload/${productId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('删除失败');

      alert('商品删除成功');
      fetchProducts();
    } catch (error) {
      alert('删除商品失败');
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
          <h1 className="text-2xl font-bold text-gray-900">商品管理</h1>
          <p className="text-gray-600">管理您的商品信息和Stripe支付链接</p>
        </div>
        
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          添加商品
        </Button>
      </div>

      {/* 添加/编辑表单 */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingProduct ? '编辑商品' : '添加新商品'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">商品名称</Label>
                <Input
                  id="name"
                  placeholder="输入商品名称"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    name: e.target.value
                  }))}
                />
              </div>
              
              <div>
                <Label htmlFor="category">商品分类</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData(prev => ({
                    ...prev,
                    category: value
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择分类" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="description">商品描述</Label>
              <Textarea
                id="description"
                placeholder="输入商品描述"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  description: e.target.value
                }))}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price">价格 (USD)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    price: e.target.value
                  }))}
                />
              </div>
              
              <div>
                <Label htmlFor="stripe_price_id">Stripe Price ID</Label>
                <Input
                  id="stripe_price_id"
                  placeholder="price_..."
                  value={formData.stripe_price_id}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    stripe_price_id: e.target.value
                  }))}
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="stripe_payment_link">Stripe 支付链接</Label>
              <Input
                id="stripe_payment_link"
                placeholder="https://buy.stripe.com/..."
                value={formData.stripe_payment_link}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  stripe_payment_link: e.target.value
                }))}
              />
            </div>
            
            <div className="flex space-x-2 pt-4">
              <Button onClick={handleSave} className="flex-1">
                {editingProduct ? '更新商品' : '创建商品'}
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

      {/* 商品列表 */}
      {products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingBag className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              还没有添加商品
            </h3>
            <p className="text-gray-600 text-center mb-4">
              添加您的第一个商品开始销售
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              添加第一个商品
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden">
              <div className="aspect-square bg-gray-100 relative">
                {product.images.length > 0 ? (
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-12 w-12 text-gray-400" />
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <Badge variant={product.in_stock ? "default" : "secondary"}>
                    {product.in_stock ? "有库存" : "缺货"}
                  </Badge>
                </div>
              </div>
              
              <CardContent className="p-4">
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg line-clamp-1">
                    {product.name}
                  </h3>
                  
                  <p className="text-gray-600 text-sm line-clamp-2">
                    {product.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span className="font-semibold text-green-600">
                        {product.price} {product.currency}
                      </span>
                    </div>
                    
                    <Badge variant="outline">
                      {categories.find(c => c.value === product.category)?.label || product.category}
                    </Badge>
                  </div>
                  
                  {product.stripe_payment_link && (
                    <div className="flex items-center space-x-1 text-sm text-blue-600">
                      <ExternalLink className="h-3 w-3" />
                      <span>已配置支付链接</span>
                    </div>
                  )}
                  
                  <div className="flex space-x-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditForm(product)}
                      className="flex-1"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      编辑
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(product.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
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