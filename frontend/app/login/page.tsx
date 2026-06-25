'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { Zap, ChevronRight, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState(urlError ? `Authentication Error: ${urlError}` : '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        // Using form data for OAuth2 password bearer
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);
        
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Invalid email or password');
        }

        const data = await response.json();
        api.setToken(data.access_token);
        router.push('/dashboard');
      } else {
        await api.post('/api/auth/register', {
          email,
          password,
          name: name,
        });
        
        // Auto login after register
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);
        
        const loginResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData,
        });
        const loginData = await loginResponse.json();
        api.setToken(loginData.access_token);
        router.push('/dashboard');
      }
    } catch (err: any) {
      if (err.detail && typeof err.detail === 'string') {
        setError(err.detail);
      } else if (err.message && typeof err.message === 'string') {
        setError(err.message);
      } else {
        setError(typeof err === 'object' ? JSON.stringify(err) : String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/login/google`;
  };

  const handleGithubLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/login/github`;
  };

  const handleGuestLogin = () => {
    api.setToken('guest_token');
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex">
      {/* ─── Left: Form ─── */}
      <div className="w-full lg:w-[500px] flex flex-col justify-center px-12 py-12 shrink-0 bg-white border-r border-[#f0ebe1] shadow-[20px_0_40px_rgba(0,0,0,0.02)] z-10">
        
        <Link href="/" className="flex items-center gap-2 mb-16 w-fit">
          <div className="w-8 h-8 bg-[#FF4400] rounded-xl flex items-center justify-center">
            <Zap size={16} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-[16px] tracking-tight text-[#1a1a1a]" style={{ fontFamily: "'Space Mono', monospace" }}>
            NEURALFORGE
          </span>
        </Link>

        <div className="mb-8">
          <h1 className="text-[32px] font-bold text-[#1a1a1a] tracking-tight mb-2">
            {isLogin ? 'Welcome back' : 'Create an account'}
          </h1>
          <p className="text-[15px] text-[#888]">
            {isLogin 
              ? 'Enter your details to access your workspace.' 
              : 'Join the enterprise AutoML platform today.'}
          </p>
        </div>

        {error && (
          <div className="bg-[#FEF2F2] border border-[#FCA5A5] text-[#EF4444] px-4 py-3 rounded-xl text-[14px] mb-6 font-medium">
            {error}
          </div>
        )}

        <div className="space-y-4 mb-8">
          <button 
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 h-12 rounded-xl bg-white border border-[#e8ddd0] hover:border-[#1a1a1a] text-[#1a1a1a] font-bold text-[14px] transition-colors"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
          
          <button 
            onClick={handleGithubLogin}
            className="w-full flex items-center justify-center gap-3 h-12 rounded-xl bg-white border border-[#e8ddd0] hover:border-[#1a1a1a] text-[#1a1a1a] font-bold text-[14px] transition-colors"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.113.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
            Continue with GitHub
          </button>
        </div>

        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1 h-px bg-[#f0ebe1]" />
          <span className="text-[12px] text-[#999] font-bold uppercase tracking-wider">or continue with email</span>
          <div className="flex-1 h-px bg-[#f0ebe1]" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div>
              <label className="text-[12px] font-bold text-[#555] mb-1.5 block">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full h-12 bg-[#FDFBF7] border border-[#f0ebe1] rounded-xl px-4 text-[14px] outline-none focus:border-[#FF4400] transition-colors"
                placeholder="John Doe"
              />
            </div>
          )}
          
          <div>
            <label className="text-[12px] font-bold text-[#555] mb-1.5 block">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-12 bg-[#FDFBF7] border border-[#f0ebe1] rounded-xl px-4 text-[14px] outline-none focus:border-[#FF4400] transition-colors"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12px] font-bold text-[#555]">Password</label>
              {isLogin && (
                <Link href="/forgot-password" className="text-[12px] font-bold text-[#FF4400] hover:underline">
                  Forgot password?
                </Link>
              )}
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full h-12 bg-[#FDFBF7] border border-[#f0ebe1] rounded-xl px-4 text-[14px] outline-none focus:border-[#FF4400] transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="btn-coral w-full h-12 text-[15px] mt-2"
          >
            {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-4">
          <button 
            onClick={handleGuestLogin}
            className="w-full h-12 bg-[#FDFBF7] border border-[#f0ebe1] hover:border-[#1a1a1a] rounded-xl text-[#1a1a1a] font-bold text-[15px] transition-colors"
          >
            Continue as Guest
          </button>
        </div>

        <p className="mt-8 text-center text-[14px] text-[#888]">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="font-bold text-[#FF4400] hover:underline"
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>

      {/* ─── Right: Feature Showcase ─── */}
      <div className="hidden lg:flex flex-1 flex-col justify-between px-20 py-16 hero-gradient relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#FF4400]/5 rounded-[100%] blur-[100px] -z-10 pointer-events-none" />
        
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#f0ebe1] text-[#FF4400] text-[11px] font-bold mb-6">
            <span className="w-2 h-2 rounded-full bg-[#FF4400] animate-pulse" />
            NeuralForge Enterprise
          </div>
          <h2 className="text-[48px] font-extrabold text-[#1a1a1a] leading-tight mb-6">
            Build production-ready <br />
            ML in minutes, not months.
          </h2>
          
          <div className="space-y-4 max-w-[400px]">
            {[
              'Automated data cleaning & feature engineering',
              'Multi-model benchmarking (XGBoost, Random Forest)',
              '1-click deployment to AWS, GCP, Azure',
              'Live endpoint monitoring & drift detection',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <CheckCircle2 size={20} className="text-[#10B981] shrink-0 mt-0.5" />
                <span className="text-[15px] text-[#555] font-medium leading-snug">{item}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Abstract Chart Graphic */}
        <div className="w-full max-w-[600px] h-[300px] bg-white rounded-2xl border border-[#f0ebe1] shadow-2xl p-6 flex flex-col gap-4 mt-12 relative z-10">
          <div className="flex gap-4">
            <div className="w-1/3 h-20 bg-[#FFF8F0] border border-[#f0ebe1] rounded-xl" />
            <div className="w-1/3 h-20 bg-[#FDFBF7] border border-[#f0ebe1] rounded-xl" />
            <div className="w-1/3 h-20 bg-[#FDFBF7] border border-[#f0ebe1] rounded-xl" />
          </div>
          <div className="flex-1 bg-[#FDFBF7] border border-[#f0ebe1] rounded-xl flex items-end justify-between p-4 px-8">
            <div className="w-8 bg-[#FF4400]/20 rounded-t-sm h-[30%]" />
            <div className="w-8 bg-[#FF4400]/40 rounded-t-sm h-[50%]" />
            <div className="w-8 bg-[#FF4400]/60 rounded-t-sm h-[40%]" />
            <div className="w-8 bg-[#FF4400]/80 rounded-t-sm h-[70%]" />
            <div className="w-8 bg-[#FF4400] rounded-t-sm h-[90%]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
