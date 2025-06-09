// Cloudflare Pages Function types
interface PagesContext<Env = any> {
  request: Request;
  env: Env;
  waitUntil: (promise: Promise<any>) => void;
}

type PagesFunction<Env = any> = (context: PagesContext<Env>) => Promise<Response> | Response;

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 缓存配置
const CACHE_TTL = 60; // 60秒缓存
const CACHE_KEY_PREFIX = 'products';

// 获取缓存键
function getCacheKey(category?: string, page?: number): string {
  const parts = [CACHE_KEY_PREFIX];
  if (category) parts.push(`category-${category}`);
  if (page) parts.push(`page-${page}`);
  return parts.join(':');
}

// 从Supabase获取产品数据
async function fetchProductsFromSupabase(
  env: Env,
  category?: string,
  page: number = 1,
  limit: number = 20
): Promise<{ products: Product[]; total: number }> {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_ANON_KEY;
  
  let url = `${supabaseUrl}/rest/v1/products?select=*,count&is_active=eq.true&order=created_at.desc`;
  
  // 添加分类过滤
  if (category && category !== 'all') {
    url += `&category=eq.${encodeURIComponent(category)}`;
  }
  
  // 添加分页
  const offset = (page - 1) * limit;
  url += `&limit=${limit}&offset=${offset}`;
  
  const response = await fetch(url, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'count=exact',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Supabase request failed: ${response.status}`);
  }
  
  const products = await response.json() as Product[];
  const total = parseInt(response.headers.get('Content-Range')?.split('/')[1] || '0');
  
  return { products, total };
}

// 设置缓存响应头
function setCacheHeaders(response: Response, ttl: number): Response {
  const headers = new Headers(response.headers);
  
  // 设置缓存控制头
  headers.set('Cache-Control', `public, max-age=${ttl}, s-maxage=${ttl}`);
  headers.set('CDN-Cache-Control', `public, max-age=${ttl}`);
  headers.set('Cloudflare-CDN-Cache-Control', `public, max-age=${ttl}`);
  
  // 设置ETag用于条件请求
  const etag = `"${Date.now()}"`;
  headers.set('ETag', etag);
  
  // 设置Vary头
  headers.set('Vary', 'Accept-Encoding, Accept');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// GET请求处理器
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    
    // 解析查询参数
    const category = url.searchParams.get('category') || undefined;
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    
    // 验证参数
    if (page < 1 || limit < 1 || limit > 100) {
      return new Response(JSON.stringify({
        error: 'Invalid parameters',
        message: 'page必须≥1，limit必须在1-100之间',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // 检查条件请求
    const ifNoneMatch = request.headers.get('If-None-Match');
    if (ifNoneMatch) {
      // 简单的ETag检查，实际应该更复杂
      const lastModified = new Date().toISOString().split('T')[0];
      if (ifNoneMatch.includes(lastModified)) {
        return new Response(null, { status: 304 });
      }
    }
    
    // 尝试从Cloudflare Cache API获取缓存
    const cacheKey = getCacheKey(category, page);
    const cacheUrl = new URL(request.url);
    cacheUrl.searchParams.set('cache_key', cacheKey);
    
    const cache = (globalThis as any).caches.default;
    let cachedResponse = await cache.match(cacheUrl);
    
    if (cachedResponse) {
      console.log('Cache hit for:', cacheKey);
      return setCacheHeaders(cachedResponse, CACHE_TTL);
    }
    
    console.log('Cache miss for:', cacheKey);
    
    // 从数据库获取数据
    const { products, total } = await fetchProductsFromSupabase(
      env,
      category,
      page,
      limit
    );
    
    // 构建响应数据
    const responseData = {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      meta: {
        category: category || 'all',
        cached: false,
        timestamp: new Date().toISOString(),
      },
    };
    
    // 创建响应
    const response = new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
    
    // 设置缓存头并存储到缓存
    const cachedResponseToStore = setCacheHeaders(response.clone(), CACHE_TTL);
    
    // 异步存储到缓存，不阻塞响应
    context.waitUntil(cache.put(cacheUrl, cachedResponseToStore));
    
    return setCacheHeaders(response, CACHE_TTL);
    
  } catch (error) {
    console.error('Products API error:', error);
    
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: '获取产品列表失败',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// OPTIONS请求处理器（CORS预检）
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, If-None-Match',
      'Access-Control-Max-Age': '86400',
    },
  });
}; 