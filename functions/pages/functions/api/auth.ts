/**
 * Auth API - 处理 Supabase JWT + inviteToken
 * 写入 users & invites 集合，签发 Session JWT
 */

import jwt from 'jsonwebtoken';
import { MongoClient } from 'mongodb';

// Cloudflare Pages Function types
interface PagesContext<Env = any> {
  request: Request;
  env: Env;
  waitUntil: (promise: Promise<any>) => void;
}

type PagesFunction<Env = any> = (context: PagesContext<Env>) => Promise<Response> | Response;

interface AuthRequest {
  supabaseToken: string;
  inviteToken?: string;
}

interface AuthResponse {
  success: boolean;
  sessionToken?: string;
  user?: {
    id: string;
    email: string;
    role: string;
    displayName?: string;
  };
  error?: string;
}

interface SupabaseUser {
  sub: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
}

interface SessionPayload {
  userId: string;
  supabaseId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

interface AuthEnv {
  SUPABASE_JWT_SECRET: string;
  MONGODB_URL: string;
  SESSION_JWT_SECRET: string;
}

export const onRequestPost: PagesFunction<AuthEnv> = async (context) => {
  let mongoClient: MongoClient | null = null;
  
  try {
    const request = context.request;
    const body: AuthRequest = await request.json();
    const { supabaseToken, inviteToken } = body;

    if (!supabaseToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing supabase token' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 1. 验证 Supabase JWT
    const supabaseJwtSecret = context.env.SUPABASE_JWT_SECRET;
    if (!supabaseJwtSecret) {
      throw new Error('SUPABASE_JWT_SECRET not configured');
    }

    let supabaseUser: SupabaseUser;
    try {
      supabaseUser = jwt.verify(supabaseToken, supabaseJwtSecret) as SupabaseUser;
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid supabase token' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 2. 连接 MongoDB
    const mongoUrl = context.env.MONGODB_URL;
    if (!mongoUrl) {
      throw new Error('MONGODB_URL not configured');
    }

    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    const db = mongoClient.db();
    
    const usersCollection = db.collection('users');
    const invitesCollection = db.collection('invites');

    // 3. 查找或创建用户
    let user = await usersCollection.findOne({ supabaseId: supabaseUser.sub });
    let userRole = 'fan'; // 默认角色

    if (!user) {
      // 4. 处理邀请码（如果提供）
      if (inviteToken) {
        const invite = await invitesCollection.findOne({
          token: inviteToken,
          status: 'active',
          expiresAt: { $gt: new Date() }
        });

        if (invite && invite.usedCount < invite.maxUses) {
          // 根据邀请类型设置角色
          userRole = invite.type === 'firstmate' ? 'firstmate' : 'member';
          
          // 更新邀请使用次数
          await invitesCollection.updateOne(
            { _id: invite._id },
            {
              $inc: { usedCount: 1 },
              $set: { 
                usedAt: new Date(),
                ...(invite.usedCount + 1 >= invite.maxUses ? { status: 'used' } : {})
              }
            }
          );
        }
      }

      // 创建新用户
      const newUser = {
        supabaseId: supabaseUser.sub,
        email: supabaseUser.email,
        displayName: supabaseUser.user_metadata?.full_name,
        avatarUrl: supabaseUser.user_metadata?.avatar_url,
        role: userRole,
        status: 'active',
        inviteToken: inviteToken || undefined,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await usersCollection.insertOne(newUser);
      user = { ...newUser, _id: result.insertedId };
    } else {
      // 更新现有用户的最后登录时间
      await usersCollection.updateOne(
        { _id: user._id },
        { 
          $set: { 
            lastLoginAt: new Date(),
            updatedAt: new Date()
          }
        }
      );
    }

    // 5. 生成 Session JWT
    const sessionJwtSecret = context.env.SESSION_JWT_SECRET;
    if (!sessionJwtSecret) {
      throw new Error('SESSION_JWT_SECRET not configured');
    }

    const sessionPayload: SessionPayload = {
      userId: user._id.toString(),
      supabaseId: user.supabaseId,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7天过期
    };

    const sessionToken = jwt.sign(sessionPayload, sessionJwtSecret);

    return new Response(
      JSON.stringify({
        success: true,
        sessionToken,
        user: {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          displayName: user.displayName
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Auth callback error:', error);
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
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}; 