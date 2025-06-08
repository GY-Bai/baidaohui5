import { AwsClient } from 'aws4fetch';

interface Env {
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
  R2_ENDPOINT: string;
  SUPABASE_JWT_SECRET: string;
}

interface SignedUrlRequest {
  fileName: string;
  fileType: string;
  fileSize: number;
  category: 'avatar' | 'chat' | 'product' | 'fortune';
}

interface SignedUrlResponse {
  uploadUrl: string;
  fileUrl: string;
  fileKey: string;
  expiresIn: number;
}

// 验证JWT令牌
async function verifyJWT(token: string, secret: string): Promise<any> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const [header, payload, signature] = token.split('.');
    const data = `${header}.${payload}`;
    
    const expectedSignature = new Uint8Array(
      await crypto.subtle.sign('HMAC', key, encoder.encode(data))
    );
    
    const actualSignature = new Uint8Array(
      Array.from(atob(signature.replace(/-/g, '+').replace(/_/g, '/')))
        .map(c => c.charCodeAt(0))
    );

    // 验证签名
    if (expectedSignature.length !== actualSignature.length) {
      return null;
    }
    
    for (let i = 0; i < expectedSignature.length; i++) {
      if (expectedSignature[i] !== actualSignature[i]) {
        return null;
      }
    }

    // 解析payload
    const decodedPayload = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    );

    // 检查过期时间
    if (decodedPayload.exp && decodedPayload.exp < Date.now() / 1000) {
      return null;
    }

    return decodedPayload;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

// 生成文件键
function generateFileKey(category: string, fileName: string, userId: string): string {
  const timestamp = Date.now();
  const randomId = crypto.randomUUID();
  const extension = fileName.split('.').pop() || '';
  
  return `${category}/${userId}/${timestamp}-${randomId}.${extension}`;
}

// 验证文件类型和大小
function validateFile(fileType: string, fileSize: number, category: string): string | null {
  const maxSizes = {
    avatar: 5 * 1024 * 1024, // 5MB
    chat: 10 * 1024 * 1024,  // 10MB
    product: 20 * 1024 * 1024, // 20MB
    fortune: 5 * 1024 * 1024,  // 5MB
  };

  const allowedTypes = {
    avatar: ['image/jpeg', 'image/png', 'image/webp'],
    chat: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'],
    product: ['image/jpeg', 'image/png', 'image/webp'],
    fortune: ['image/jpeg', 'image/png', 'image/webp'],
  };

  if (fileSize > maxSizes[category]) {
    return `文件大小超过限制 (${Math.round(maxSizes[category] / 1024 / 1024)}MB)`;
  }

  if (!allowedTypes[category].includes(fileType)) {
    return `不支持的文件类型: ${fileType}`;
  }

  return null;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;

    // 检查Content-Type
    if (!request.headers.get('content-type')?.includes('application/json')) {
      return new Response(JSON.stringify({
        error: 'Invalid content type',
        message: '请求类型必须是application/json',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 验证授权
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        message: '缺少授权令牌',
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyJWT(token, env.SUPABASE_JWT_SECRET);
    
    if (!payload || !payload.sub) {
      return new Response(JSON.stringify({
        error: 'Invalid token',
        message: '无效的授权令牌',
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 解析请求体
    let requestData: SignedUrlRequest;
    try {
      requestData = await request.json();
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Invalid JSON',
        message: '请求体格式错误',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { fileName, fileType, fileSize, category } = requestData;

    // 验证必需字段
    if (!fileName || !fileType || !fileSize || !category) {
      return new Response(JSON.stringify({
        error: 'Missing fields',
        message: '缺少必需字段: fileName, fileType, fileSize, category',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 验证文件
    const validationError = validateFile(fileType, fileSize, category);
    if (validationError) {
      return new Response(JSON.stringify({
        error: 'File validation failed',
        message: validationError,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 生成文件键
    const fileKey = generateFileKey(category, fileName, payload.sub);
    
    // 创建AWS客户端
    const client = new AwsClient({
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      region: 'auto',
    });

    // 生成预签名URL
    const expiresIn = 15 * 60; // 15分钟
    const uploadUrl = await client.sign(
      new Request(`${env.R2_ENDPOINT}/${env.R2_BUCKET_NAME}/${fileKey}`, {
        method: 'PUT',
        headers: {
          'Content-Type': fileType,
          'Content-Length': fileSize.toString(),
        },
      }),
      {
        aws: { signQuery: true },
        expiresIn,
      }
    );

    // 构建公共访问URL
    const fileUrl = `https://cdn.baidaohui.com/${fileKey}`;

    const response: SignedUrlResponse = {
      uploadUrl: uploadUrl.url,
      fileUrl,
      fileKey,
      expiresIn,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('Signed URL generation failed:', error);
    
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: '服务器内部错误',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// 处理OPTIONS请求（CORS预检）
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': 'https://baidaohui.com',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}; 