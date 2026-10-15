'use client';
import { useState } from 'react';
import { api, setToken, setUserName } from '../../lib/api';
import logoImg from '../../logo.png';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api.post('/api/users/login', { email, password });
      if (!data.token) throw new Error('Login succeeded but no token returned');
      setToken(data.token);
      if (data.name) setUserName(data.name);
      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center min-h-screen">
      <div className="w-full max-w-sm px-6">
        <div className="mb-8 flex justify-center">
          <img src={logoImg.src} alt="Active Mentor" className="h-12 w-auto" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-white/60 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#DA7235]"
              placeholder="you@clinic.com"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#DA7235]"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-[#DA7235] text-white font-semibold hover:bg-[#c5622a] transition-colors disabled:opacity-50"
          >
            {loading ? 'Logging in…' : 'Log In'}
          </button>
        </form>

        <p className="text-center text-white/30 text-sm mt-6">
          New to the portal?{' '}
          <Link href="/signup" className="text-[#DA7235] hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
