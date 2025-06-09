import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            访问被拒绝
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            您没有权限访问此页面
          </p>
        </div>
        <div className="text-center">
          <Link
            href="/auth/sign-in"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            返回登录
          </Link>
        </div>
      </div>
    </div>
  );
} 