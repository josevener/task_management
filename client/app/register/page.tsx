'use client';

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

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { register } = useAuth();
  const { showToast } = useToast();
  const router = useRouter(); 

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    // Clear error for this field when user starts typing
    if (errors[e.target.name]) {
      setErrors({
        ...errors,
        [e.target.name]: '',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    // Client-side validation
    if (formData.password !== formData.confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' });
      setLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setErrors({ password: 'Password must be at least 8 characters long' });
      setLoading(false);
      return;
    }

    try {
      await register({
        email: formData.email,
        password: formData.password,
        first_name: formData.first_name,
        last_name: formData.last_name,
      });
      showToast('Registration successful!', 'success');
    }
    catch (error) {
      if (error instanceof ApiClientError) {
        if (error.errors) {
          setErrors(error.errors);
        }
        else {
          showToast(error.message || 'Registration failed. Please try again.', 'error');
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
            Start your journey to better productivity.
          </h1>
          <p className="text-lg font-medium text-indigo-100/70 leading-relaxed">
            Create an account to experience the new standard of task management. Join thousands of teams turning chaos into structured success.
          </p>
        </div>

        <div className="relative z-10 text-sm font-medium text-indigo-400/60">
          © {new Date().getFullYear()} Zentrix Inc. All rights reserved.
        </div>
      </div>

      {/* Right Panel - Form (Reduced paddings and margins to prevent scrolling) */}
      <div className="flex w-full items-center justify-center p-4 sm:p-6 lg:w-1/2 lg:p-10">
        <div className="w-full max-w-[420px] space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
          <div className="space-y-1 text-center lg:text-left">
            {/* Mobile Logo */}
            <div className="mb-4 flex items-center justify-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 shadow-md">
                <Layers className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight">Zentrix</span>
            </div>
            
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Create Account</h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Enter your information to set up your new workspace
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 relative group">
                <Label htmlFor="first_name" className="text-xs font-medium text-foreground sm:text-sm">
                  First Name
                </Label>
                <Input
                  id="first_name"
                  name="first_name"
                  type="text"
                  placeholder="John"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className={`h-10 px-3 text-sm transition-all duration-200 bg-transparent
                    focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 
                    ${errors.first_name ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-input hover:border-indigo-500/50'}`}
                />
                {errors.first_name && (
                  <p className="text-xs font-medium text-red-500 animate-in slide-in-from-top-1">
                    {errors.first_name}
                  </p>
                )}
              </div>

              <div className="space-y-1.5 relative group">
                <Label htmlFor="last_name" className="text-xs font-medium text-foreground sm:text-sm">
                  Last Name
                </Label>
                <Input
                  id="last_name"
                  name="last_name"
                  type="text"
                  placeholder="Doe"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className={`h-10 px-3 text-sm transition-all duration-200 bg-transparent
                    focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 
                    ${errors.last_name ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-input hover:border-indigo-500/50'}`}
                />
                {errors.last_name && (
                  <p className="text-xs font-medium text-red-500 animate-in slide-in-from-top-1">
                    {errors.last_name}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5 relative group">
              <Label htmlFor="email" className="text-xs font-medium text-foreground sm:text-sm">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={loading}
                className={`h-10 px-3 text-sm transition-all duration-200 bg-transparent
                  focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 
                  ${errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-input hover:border-indigo-500/50'}`}
              />
              {errors.email && (
                <p className="text-xs font-medium text-red-500 animate-in slide-in-from-top-1">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="space-y-1.5 relative group">
              <Label htmlFor="password" className="text-xs font-medium text-foreground sm:text-sm">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className={`h-10 px-3 pr-10 text-sm transition-all duration-200 bg-transparent
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
                <p className="text-xs font-medium text-red-500 animate-in slide-in-from-top-1">
                  {errors.password}
                </p>
              )}
            </div>

            <div className="space-y-1.5 relative group">
              <Label htmlFor="confirmPassword" className="text-xs font-medium text-foreground sm:text-sm">
                Confirm Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className={`h-10 px-3 pr-10 text-sm transition-all duration-200 bg-transparent
                    focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 
                    ${errors.confirmPassword ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-input hover:border-indigo-500/50'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs font-medium text-red-500 animate-in slide-in-from-top-1">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full h-10 mt-1 text-sm font-medium shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/30 hover:-translate-y-0.5" 
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>

          <div className="text-center text-xs sm:text-sm pt-1">
            <span className="text-muted-foreground mr-1">Already have an account?</span>
            <Link 
              href="/login" 
              className="font-semibold text-indigo-600 transition-colors hover:text-indigo-500 hover:underline underline-offset-4"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
