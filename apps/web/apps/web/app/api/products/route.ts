import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');

    // 这里应该调用shop-service的API
    // 暂时返回模拟数据
    const mockProducts = generateMockProducts(category, page, limit);

    return NextResponse.json({
      products: mockProducts.products,
      total: mockProducts.total,
      hasMore: mockProducts.hasMore,
    });

  } catch (error) {
    console.error('获取商品列表失败:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 生成模拟商品数据
function generateMockProducts(category: string | null, page: number, limit: number) {
  const categories = ['jewelry', 'crystals', 'books', 'accessories', 'home'];
  const productNames = {
    jewelry: ['开运金戒指', '招财银手镯', '护身玉吊坠', '转运珍珠项链'],
    crystals: ['紫水晶原石', '白水晶球', '黑曜石手串', '粉晶摆件'],
    books: ['易经入门', '风水宝典', '面相学大全', '八字命理'],
    accessories: ['五帝钱', '红绳手链', '护身符', '开光貔貅'],
    home: ['招财猫摆件', '风水罗盘', '水晶洞', '龙龟摆件'],
  };

  const totalProducts = 48; // 模拟总商品数
  const startIndex = (page - 1) * limit;
  const endIndex = Math.min(startIndex + limit, totalProducts);
  
  const products = [];
  
  for (let i = startIndex; i < endIndex; i++) {
    const productCategory = category && category !== 'all' 
      ? category 
      : categories[i % categories.length];
    
    const categoryNames = productNames[productCategory as keyof typeof productNames] || ['商品'];
    const productName = categoryNames[i % categoryNames.length];
    
    products.push({
      id: `product_${i + 1}`,
      name: `${productName} ${i + 1}号`,
      description: `这是一款精心挑选的${productName}，具有强大的开运功效，适合日常佩戴或摆放。经过大师开光，能够为您带来好运和财富。`,
      price: Math.floor(Math.random() * 500) + 50,
      currency: 'USD',
      images: [
        `https://picsum.photos/400/400?random=${i + 100}`,
        `https://picsum.photos/400/400?random=${i + 200}`,
      ],
      category: productCategory,
      seller_id: `seller_${(i % 5) + 1}`,
      seller_name: `开运商家${(i % 5) + 1}`,
      stripe_price_id: `price_${i + 1}`,
      stripe_payment_link: `https://buy.stripe.com/test_${i + 1}`,
      rating: Math.round((Math.random() * 2 + 3) * 10) / 10, // 3.0-5.0
      review_count: Math.floor(Math.random() * 100) + 10,
      in_stock: Math.random() > 0.1, // 90%有库存
      created_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  
  return {
    products,
    total: totalProducts,
    hasMore: endIndex < totalProducts,
  };
} 