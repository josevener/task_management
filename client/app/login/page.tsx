'use client';

/**
 * Login Page
 * 
 * User authentication page.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Layers, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiClientError } from '@/lib/api-client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { login } = useAuth();
  const { showToast } = useToast();
  const router = useRouter(); // Keeping router just in case, though currently unused in component

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      await login({ email, password });
      showToast('Login successful!', 'success');
    }
    catch (error) {
      if (error instanceof ApiClientError) {
        if (error.status === 403 && error.errors?.needs_verification) {
          showToast(error.message || 'Please verify your email.', 'error');
          router.push(`/verify-email?email=${encodeURIComponent(error.errors.email)}`);
        }
        else if (error.errors) {
          setErrors(error.errors);
        }
        else {
          showToast(error.message || 'Login failed. Please check your credentials.', 'error');
        }
      }
      else {
        showToast('An unexpected error occurred. Please try again.', 'error');
      }
    }
    finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background font-sans selection:bg-indigo-500/30">
      {/* Left Panel - Branding */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-black p-12 text-white lg:flex">
        {/* Dynamic Abstract Background Elements */}
        <div className="absolute -left-[10%] -top-[10%] h-[500px] w-[500px] rounded-full bg-indigo-600/20 blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-[10%] -right-[10%] h-[500px] w-[500px] rounded-full bg-purple-600/20 blur-[100px] pointer-events-none" />
        <div className="absolute left-[20%] top-[40%] h-[300px] w-[300px] rounded-full bg-blue-500/10 blur-[80px] pointer-events-none mix-blend-screen" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 shadow-inner backdrop-blur-md border border-white/20">
            <Layers className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight">Zentask</span>
        </div>

        <div className="relative z-10 flex max-w-lg flex-col gap-6 my-auto">
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
            Manage your work with clarity and elegance.
          </h1>
          <p className="text-lg font-medium text-indigo-100/70 leading-relaxed">
            Join thousands of teams who turn chaos into structured success with our premium task management platform. Experience the new standard of productivity.
          </p>
        </div>

        <div className="relative z-10 text-sm font-medium text-indigo-400/60">
          © {new Date().getFullYear()} Zentrix Solutions. All rights reserved.
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex w-full items-center justify-center p-8 sm:p-12 lg:w-1/2 lg:p-16">
        <div className="w-full max-w-[420px] space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
          <div className="space-y-2 text-center lg:text-left">
            {/* Mobile Logo */}
            <div className="mb-8 flex items-center justify-center gap-2 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-md">
                <Layers className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold tracking-tight">Zentask</span>
            </div>
            
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Welcome back</h2>
            <p className="text-sm text-muted-foreground">
              Enter your credentials to access your account dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2 relative group">
                <Label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className={`h-11 px-4 transition-all duration-200 bg-transparent
                    focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 
                    ${errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-input hover:border-indigo-500/50'}`}
                />
                {errors.email && (
                  <p className="text-sm font-medium text-red-500 animate-in slide-in-from-top-1">
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="space-y-2 relative group">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium text-foreground">
                    Password
                  </Label>
                  <Link 
                    href="/forgot-password" 
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className={`h-11 px-4 pr-10 transition-all duration-200 bg-transparent
                      focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 
                      ${errors.password ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-input hover:border-indigo-500/50'}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm font-medium text-red-500 animate-in slide-in-from-top-1">
                    {errors.password}
                  </p>
                )}
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 text-base font-medium shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/30 hover:-translate-y-0.5" 
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <div className="text-center text-sm">
            <span className="text-muted-foreground mr-1">Don&apos;t have an account?</span>
            <Link 
              href="/register" 
              className="font-semibold text-indigo-600 transition-colors hover:text-indigo-500 hover:underline underline-offset-4"
            >
              Sign up today
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
