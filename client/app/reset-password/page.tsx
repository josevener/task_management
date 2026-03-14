'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Layers, Loader2, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiClientError, apiPost } from '@/lib/api-client';
import { useToast } from '@/lib/toast';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSuccess, setIsSuccess] = useState(false);

  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    if (!token) {
      setErrors({ token: 'Reset token is missing from the URL' });
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' });
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setErrors({ password: 'Password must be at least 8 characters long' });
      setLoading(false);
      return;
    }

    try {
      await apiPost('/auth/reset-password', { token, password });
      setIsSuccess(true);
      showToast('Password reset successfully!', 'success');
    }
    catch (error) {
      if (error instanceof ApiClientError) {
        if (error.status === 400) {
          // Token expired or invalid
          setErrors({ form: error.message });
        }
        else if (error.errors) {
          setErrors(error.errors);
        }
        else {
          showToast(error.message || 'Failed to reset password. Please try again.', 'error');
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
    <div className="flex w-full items-center justify-center p-8 sm:p-12 lg:w-1/2 lg:p-16">
      <div className="w-full max-w-[420px] space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">

        {/* Mobile Logo */}
        <div className="flex items-center justify-center gap-2 lg:hidden mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-md">
            <Layers className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight">Zentrix</span>
        </div>

        {!isSuccess ? (
          <>
            <div className="space-y-2 text-center lg:text-left">
              <h2 className="text-3xl font-bold tracking-tight text-foreground">Set new password</h2>
              <p className="text-sm text-muted-foreground">
                Please enter your new password below. Make it strong.
              </p>
            </div>

            {errors.form && (
              <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg text-sm text-red-600 dark:text-red-400">
                {errors.form}
              </div>
            )}
            {errors.token && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                {errors.token} <Link href="/forgot-password" className="underline font-medium hover:text-amber-800 dark:hover:text-amber-300">Request a new link?</Link>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2 relative group">
                  <Label htmlFor="password" className="text-sm font-medium text-foreground">
                    New Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className={`h-11 pl-10 pr-10 transition-all duration-200 bg-transparent
                        focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 
                        ${errors.password ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-input hover:border-indigo-500/50'}`}
                    />
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none cursor-pointer"
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

                <div className="space-y-2 relative group">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                    Confirm New Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                      className={`h-11 pl-10 pr-10 transition-all duration-200 bg-transparent
                        focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 
                        ${errors.confirmPassword ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-input hover:border-indigo-500/50'}`}
                    />
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-sm font-medium text-red-500 animate-in slide-in-from-top-1">
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base font-medium shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/30 hover:-translate-y-0.5 cursor-pointer"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Resetting...
                  </span>
                ) : (
                  'Reset Password'
                )}
              </Button>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-6 text-center animate-in zoom-in-95 duration-500 py-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold tracking-tight text-foreground">Password reset complete</h3>
              <p className="text-sm text-muted-foreground px-4">
                Your password has been successfully updated. You can now sign in with your new password.
              </p>
            </div>
            <Button
              asChild
              className="w-full h-11 mt-4 shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/30 hover:-translate-y-0.5 cursor-pointer"
            >
              <Link href="/login">Continue to Sign In</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
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
          <span className="text-2xl font-bold tracking-tight">Zentrix</span>
        </div>

        <div className="relative z-10 flex max-w-lg flex-col gap-6 my-auto">
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
            Secure your account.
          </h1>
          <p className="text-lg font-medium text-indigo-100/70 leading-relaxed">
            Create a strong, unique password to protect your workspace. We recommend using a mix of letters, numbers, and symbols.
          </p>
        </div>

        <div className="relative z-10 text-sm font-medium text-indigo-400/60">
          © {new Date().getFullYear()} Zentrix Inc. All rights reserved.
        </div>
      </div>

      {/* Right Panel - Handled by Suspense for useSearchParams */}
      <Suspense fallback={
        <div className="flex w-full items-center justify-center lg:w-1/2">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      }>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
