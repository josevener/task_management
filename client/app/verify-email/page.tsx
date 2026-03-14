'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Layers, Loader2, Mail, CheckCircle2, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiClientError, apiPost } from '@/lib/api-client';
import { useToast } from '@/lib/toast';

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get('email') || '';

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cooldown, setCooldown] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { showToast } = useToast();

  useEffect(() => {
    if (!email) {
      router.push('/register');
    }
  }, [email, router]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleOtpChange = (index: number, value: string) => {
    // Only allow numbers
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];

    newOtp[index] = value.slice(-1); // Take only the last character

    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = [...otp];

    pastedData.split('').forEach((char, idx) => {
      if (idx < 6) newOtp[idx] = char;
    });

    setOtp(newOtp);

    // Focus last input or the one after the last filled
    const nextIdx = Math.min(pastedData.length, 5);
    inputRefs.current[nextIdx]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otp.join('');

    if (otpCode.length < 6) {
      setErrors({ otp: 'Please enter all 6 digits' });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      await apiPost('/auth/verify-otp', { email, otp_code: otpCode });
      showToast('Email verified successfully!', 'success');
      router.push('/dashboard');
    }
    catch (error) {
      if (error instanceof ApiClientError) {
        if (error.status === 400 || error.status === 404) {
          setErrors({ form: error.message });
        }
        else if (error.errors) {
          setErrors(error.errors);
        }
        else {
          showToast(error.message || 'Verification failed. Please try again.', 'error');
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

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;

    setResending(true);
    try {
      await apiPost('/auth/resend-otp', { email });
      showToast('New verification code sent!', 'success');
      setCooldown(120); // 120 seconds cooldown
    }
    catch (error) {
      showToast('Failed to resend code. Please try again later.', 'error');
    }
    finally {
      setResending(false);
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

        <Link
          href="/register"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground group"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to registration
        </Link>

        <div className="space-y-2 text-center lg:text-left">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Verify your email</h2>
          <p className="text-sm text-muted-foreground">
            We've sent a 6-digit code to <span className="font-semibold text-foreground">{email}</span>.
          </p>
        </div>

        {errors.form && (
          <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg text-sm text-red-600 dark:text-red-400">
            {errors.form}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-4">
            <Label className="text-sm font-medium text-foreground">Verification Code</Label>
            <div className="flex justify-between gap-2" onPaste={handlePaste}>
              {otp.map((digit, idx) => (
                <Input
                  key={idx}
                  ref={(el) => { inputRefs.current[idx] = el; }}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className="h-12 w-12 text-center text-lg font-bold p-0 transition-all duration-200 
                    focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  disabled={loading}
                  autoFocus={idx === 0}
                />
              ))}
            </div>
            {errors.otp && (
              <p className="text-sm font-medium text-red-500 animate-in slide-in-from-top-1">
                {errors.otp}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <Button
              type="submit"
              className="w-full h-11 text-base font-medium shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/30 hover:-translate-y-0.5 cursor-pointer"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Verifying...
                </span>
              ) : (
                'Verify Email'
              )}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0 || resending}
                className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-500 disabled:text-muted-foreground disabled:cursor-not-allowed cursor-pointer"
              >
                {resending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className={`h-4 w-4 transition-transform ${cooldown === 0 ? 'group-hover:rotate-180 duration-500' : ''}`} />
                )}
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend verification code'}
              </button>
            </div>
          </div>
        </form>

        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-4 border-t border-border/50">
          <div className="flex items-center gap-1">
            <Mail className="h-3 w-3" />
            Check your spam folder
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
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
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 shadow-inner backdrop-blur-md border border-white/20 mb-2">
            <CheckCircle2 className="h-10 w-10 text-indigo-400" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
            One step closer.
          </h1>
          <p className="text-lg font-medium text-indigo-100/70 leading-relaxed">
            We've sent a verification code to your email. Enter it to activate your account and start managing your tasks with Zentrix.
          </p>
        </div>

        <div className="relative z-10 text-sm font-medium text-indigo-400/60">
          © {new Date().getFullYear()} Zentrix Solutions. All rights reserved.
        </div>
      </div>

      {/* Right Panel - Handled by Suspense for useSearchParams */}
      <Suspense fallback={
        <div className="flex w-full items-center justify-center lg:w-1/2">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      }>
        <VerifyEmailForm />
      </Suspense>
    </div>
  );
}
