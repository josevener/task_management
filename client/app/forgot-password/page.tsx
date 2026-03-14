'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Layers, Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiClientError, apiPost } from '@/lib/api-client';
import { useToast } from '@/lib/toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      // Assuming a generic api endpoint for forgot password exists, such as /api/auth/forgot-password
      // If it doesn't exist, this will simulate the network request structure for when it is implemented.
      await apiPost('/auth/forgot-password', { email });
      setIsSubmitted(true);
      showToast('Reset link sent to your email', 'success');
    }
    catch (error) {
      if (error instanceof ApiClientError) {
        if (error.errors) {
          setErrors(error.errors);
        }
        else {
          showToast(error.message || 'Failed to send reset link. Please try again.', 'error');
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
          <span className="text-2xl font-bold tracking-tight">Zentrix</span>
        </div>

        <div className="relative z-10 flex max-w-lg flex-col gap-6 my-auto">
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
            Don't worry, we've got you covered.
          </h1>
          <p className="text-lg font-medium text-indigo-100/70 leading-relaxed">
            Enter the email address associated with your account, and we'll send you a secure link to reset your password. Get back to being productive in no time.
          </p>
        </div>

        <div className="relative z-10 text-sm font-medium text-indigo-400/60">
          © {new Date().getFullYear()} Zentrix Solutions. All rights reserved.
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex w-full items-center justify-center p-8 sm:p-12 lg:w-1/2 lg:p-16">
        <div className="w-full max-w-[420px] space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">

          {/* Mobile Logo */}
          <div className="flex items-center justify-center gap-2 lg:hidden mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-md">
              <Layers className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">Zentrix</span>
          </div>

          <Link
            href="/login"
            className="inline-flex flex-row items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground group"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to login
          </Link>

          {!isSubmitted ? (
            <>
              <div className="space-y-2 text-center lg:text-left">
                <h2 className="text-3xl font-bold tracking-tight text-foreground">Forgot password?</h2>
                <p className="text-sm text-muted-foreground">
                  No problem. Type in your email and we'll send you a link to reset your password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2 relative group">
                    <Label htmlFor="email" className="text-sm font-medium text-foreground">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Input
                        id="email"
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                        className={`h-11 pl-10 pr-4 transition-all duration-200 bg-transparent
                          focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 
                          ${errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-input hover:border-indigo-500/50'}`}
                      />
                      <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    </div>
                    {errors.email && (
                      <p className="text-sm font-medium text-red-500 animate-in slide-in-from-top-1">
                        {errors.email}
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
                      Sending link...
                    </span>
                  ) : (
                    'Send Reset Link'
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
                <h3 className="text-2xl font-bold tracking-tight text-foreground">Check your email</h3>
                <p className="text-sm text-muted-foreground px-4">
                  We've sent a password reset link to <span className="font-semibold text-foreground">{email}</span>. Please check your inbox and spam folder.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 mt-4 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-900/30 cursor-pointer"
                onClick={() => setIsSubmitted(false)}
              >
                Try a different email
              </Button>
            </div>
          )}

          <div className="text-center text-sm pt-4 border-t border-border/50">
            <span className="text-muted-foreground mr-1">Remembered your password?</span>
            <Link
              href="/login"
              className="font-semibold text-indigo-600 transition-colors hover:text-indigo-500 hover:underline underline-offset-4"
            >
              Sign in securely
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
