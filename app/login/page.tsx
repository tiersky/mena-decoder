'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid username or password');
      } else if (result?.ok) {
        router.push('/');
        router.refresh();
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F4EDE3] to-[#FFB380] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo/Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="bg-[#FF5900] p-4 rounded-2xl mb-4 flex items-center justify-center">
              <img src="/talabat_icon_logo.png" alt="Talabat" className="w-12 h-12 object-contain" />
            </div>
            <h1 className="text-3xl font-bold text-[#431412] text-center">
              MENA Decoder
            </h1>
            <p className="text-[#431412]/70 text-center mt-2">
              Sign in to access the dashboard
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-[#431412] mb-2"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border border-[#431412]/20 rounded-lg focus:ring-2 focus:ring-[#FF5900] focus:border-transparent transition-all text-[#431412]"
                placeholder="Enter your username"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[#431412] mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-[#431412]/20 rounded-lg focus:ring-2 focus:ring-[#FF5900] focus:border-transparent transition-all text-[#431412]"
                placeholder="Enter your password"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#FF5900] hover:bg-[#E55000] text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Info */}
          <div className="mt-6 p-4 bg-[#CFFF00]/20 rounded-lg border border-[#431412]/10">
            <p className="text-sm text-[#431412] text-center">
              <strong>Default credentials:</strong>
              <br />
              Username: admin
              <br />
              Password: admin123
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
