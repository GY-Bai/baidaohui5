'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { Badge } from '@kit/ui/badge';
import { Loader2, ExternalLink, Star } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  images: string[];
  category: string;
  seller_id: string;
  seller_name: string;
  stripe_price_id: string;
  stripe_payment_link: string;
  rating: number;
  review_count: number;
  in_stock: boolean;
  created_at: string;
}

interface ProductsResponse {
  products: Product[];
  total: number;
  hasMore: boolean;
}

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { value: 'all', label: '全部商品' },
    { value: 'jewelry', label: '珠宝首饰' },
    { value: 'crystals', label: '水晶宝石' },
    { value: 'books', label: '风水书籍' },
    { value: 'accessories', label: '开运配饰' },
    { value: 'home', label: '家居摆件' },
  ];

  // 获取商品列表
  const fetchProducts = useCallback(async (pageNum: number, reset = false) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const queryParams = new URLSearchParams({
        page: pageNum.toString(),
        limit: '12',
      });

      if (selectedCategory !== 'all') {
        queryParams.append('category', selectedCategory);
      }

      const response = await fetch(`/api/products?${queryParams}`);
      
      if (!response.ok) {
        throw new Error('获取商品列表失败');
      }

      const data: ProductsResponse = await response.json();
      
      if (reset || pageNum === 1) {
        setProducts(data.products);
      } else {
        setProducts(prev => [...prev, ...data.products]);
      }
      
      setHasMore(data.hasMore);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取商品失败');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [selectedCategory]);

  // 初始加载
  useEffect(() => {
    setPage(1);
    fetchProducts(1, true);
  }, [fetchProducts]);

  // 加载更多
  const loadMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchProducts(nextPage);
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

  // 处理分类切换
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setPage(1);
  };

  // 格式化价格
  const formatPrice = (price: number, currency: string) => {
    return currency === 'USD' ? `$${price.toFixed(2)}` : `¥${price.toFixed(2)}`;
  };

  // 渲染星级评分
  const renderRating = (rating: number) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
            }`}
          />
        ))}
        <span className="ml-1 text-sm text-gray-600">({rating.toFixed(1)})</span>
      </div>
    );
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
            <Button onClick={() => fetchProducts(1, true)}>
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
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-4">百刀会商城</h1>
        <p className="text-gray-600 text-lg">精选开运好物，助您趋吉避凶</p>
      </div>

      {/* 分类筛选 */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-2 justify-center">
          {categories.map((category) => (
            <Button
              key={category.value}
              variant={selectedCategory === category.value ? 'default' : 'outline'}
              onClick={() => handleCategoryChange(category.value)}
              className="mb-2"
            >
              {category.label}
            </Button>
          ))}
        </div>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-500">暂无商品</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 商品瀑布流 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <Card key={product.id} className="hover:shadow-lg transition-shadow duration-300 overflow-hidden">
                {/* 商品图片 */}
                <div className="relative aspect-square overflow-hidden">
                  <img
                    src={product.images[0] || '/images/placeholder-product.jpg'}
                    alt={product.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                  {!product.in_stock && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                      <Badge variant="secondary">缺货</Badge>
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <Badge variant="outline" className="bg-white">
                      {categories.find(c => c.value === product.category)?.label || product.category}
                    </Badge>
                  </div>
                </div>

                <CardHeader className="pb-2">
                  <CardTitle className="text-lg line-clamp-2">{product.name}</CardTitle>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-primary">
                      {formatPrice(product.price, product.currency)}
                    </span>
                    {renderRating(product.rating)}
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {product.description}
                  </p>
                  
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs text-gray-500">
                      by {product.seller_name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {product.review_count} 评价
                    </span>
                  </div>

                  {/* 购买按钮 */}
                  <Button
                    className="w-full"
                    disabled={!product.in_stock}
                    onClick={() => window.open(product.stripe_payment_link, '_blank')}
                  >
                    {product.in_stock ? (
                      <>
                        立即购买
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </>
                    ) : (
                      '暂时缺货'
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 加载更多 */}
          {hasMore && (
            <div className="text-center py-8">
              {loadingMore ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span>加载更多商品...</span>
                </div>
              ) : (
                <Button onClick={loadMore} variant="outline" size="lg">
                  查看更多商品
                </Button>
              )}
            </div>
          )}

          {!hasMore && products.length > 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">已展示全部商品</p>
            </div>
          )}
        </>
      )}
    </div>
  );
} 