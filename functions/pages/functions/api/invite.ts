import jwt from 'jsonwebtoken';
import { MongoClient, ObjectId } from 'mongodb';
import QRCode from 'qrcode';
import { randomBytes } from 'crypto';

// Cloudflare Pages Function types
interface PagesContext<Env = any> {
  request: Request;
  env: Env;
  waitUntil: (promise: Promise<any>) => void;
}

type PagesFunction<Env = any> = (context: PagesContext<Env>) => Promise<Response> | Response;

interface SessionPayload {
  userId: string;
  supabaseId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

interface CreateInviteRequest {
  type: 'member' | 'firstmate';
  expiresIn?: number; // hours, default 24
  maxUses?: number; // default 1
}

interface CreateInviteResponse {
  success: boolean;
  invite?: {
    token: string;
    type: string;
    expiresAt: string;
    maxUses: number;
    qrCodeDataUrl: string;
    inviteUrl: string;
  };
  error?: string;
}

/**
 * Invite API - Master/Firstmate 创建邀请
 * 生成 token & QR 码
 */

interface InviteEnv {
  SESSION_JWT_SECRET: string;
  MONGODB_URL: string;
  FRONTEND_URL?: string;
}

export const onRequestPost: PagesFunction<InviteEnv> = async (context) => {
  let mongoClient: MongoClient | null = null;
  
  try {
    const request = context.request;
    
    // 验证权限
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 验证 Session JWT
    const sessionToken = authHeader.substring(7);
    const sessionJwtSecret = context.env.SESSION_JWT_SECRET;
    if (!sessionJwtSecret) {
      throw new Error('SESSION_JWT_SECRET not configured');
    }

    let user: SessionPayload;
    try {
      user = jwt.verify(sessionToken, sessionJwtSecret) as SessionPayload;
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 检查用户权限 (只有 Master/Firstmate 可以创建邀请)
    if (!['master', 'firstmate'].includes(user.role)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Insufficient permissions' }),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 解析请求体
    const body: CreateInviteRequest = await request.json();
    const { type, expiresIn = 24, maxUses = 1 } = body;

    if (!type || !['member', 'firstmate'].includes(type)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid invite type' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 只有 Master 可以创建 Firstmate 邀请
    if (type === 'firstmate' && user.role !== 'master') {
      return new Response(
        JSON.stringify({ success: false, error: 'Only Master can create Firstmate invites' }),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 连接 MongoDB
    const mongoUrl = context.env.MONGODB_URL;
    if (!mongoUrl) {
      throw new Error('MONGODB_URL not configured');
    }

    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    const db = mongoClient.db();
    const invitesCollection = db.collection('invites');

    // 生成邀请 token
    const inviteToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresIn * 60 * 60 * 1000);

    // 生成邀请链接
    const baseUrl = context.env.FRONTEND_URL || 'https://baidaohui.com';
    const inviteUrl = `${baseUrl}/auth/sign-up?invite=${inviteToken}`;

    // 生成 QR 码
    const qrCodeDataUrl = await QRCode.toDataURL(inviteUrl, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // 创建邀请记录
    const inviteDoc = {
      token: inviteToken,
      type,
      createdBy: user.userId,
      status: 'active',
      expiresAt,
      maxUses,
      usedCount: 0,
      qrCodeUrl: qrCodeDataUrl,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await invitesCollection.insertOne(inviteDoc);

    return new Response(
      JSON.stringify({
        success: true,
        invite: {
          token: inviteToken,
          type,
          expiresAt: expiresAt.toISOString(),
          maxUses,
          qrCodeDataUrl,
          inviteUrl
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      }
    );

  } catch (error) {
    console.error('Create invite error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  } finally {
    if (mongoClient) {
      await mongoClient.close();
    }
  }
}

export const onRequestGet: PagesFunction<InviteEnv> = async (context) => {
  let mongoClient: MongoClient | null = null;
  
  try {
    const request = context.request;
    
    // 验证权限
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 验证 Session JWT
    const sessionToken = authHeader.substring(7);
    const sessionJwtSecret = context.env.SESSION_JWT_SECRET;
    if (!sessionJwtSecret) {
      throw new Error('SESSION_JWT_SECRET not configured');
    }

    let user: SessionPayload;
    try {
      user = jwt.verify(sessionToken, sessionJwtSecret) as SessionPayload;
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 检查用户权限
    if (!['master', 'firstmate'].includes(user.role)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Insufficient permissions' }),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 连接 MongoDB
    const mongoUrl = context.env.MONGODB_URL;
    if (!mongoUrl) {
      throw new Error('MONGODB_URL not configured');
    }

    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    const db = mongoClient.db();
    const invitesCollection = db.collection('invites');

    // 查询用户创建的邀请记录
    const invites = await invitesCollection
      .find({ createdBy: user.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return new Response(
      JSON.stringify({
        success: true,
        invites: invites.map(invite => ({
          id: invite._id.toString(),
          token: invite.token,
          type: invite.type,
          status: invite.status,
          expiresAt: invite.expiresAt.toISOString(),
          maxUses: invite.maxUses,
          usedCount: invite.usedCount,
          qrCodeUrl: invite.qrCodeUrl,
          createdAt: invite.createdAt.toISOString()
        }))
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Get invites error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } finally {
    if (mongoClient) {
      await mongoClient.close();
    }
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
} 