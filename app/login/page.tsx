"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { login } from "@/app/actions/auth";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      remember: false,
    },
  });

  const remember = watch("remember");

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);

    try {
      const result = await login(data);

      if (result.success) {
        toast.success("เข้าสู่ระบบสำเร็จ");
        router.push("/chat");
        router.refresh();
      } else {
        toast.error(result.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <Card className="w-full max-w-md bg-[#1A1A1A] border-[#333333] shadow-lg shadow-black/50">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-[#00B900] flex items-center justify-center">
              <span className="text-2xl font-bold text-white">A</span>
            </div>
          </div>
          <CardTitle className="text-2xl text-center font-bold text-white">
            เข้าสู่ระบบ
          </CardTitle>
          <CardDescription className="text-center text-gray-400">
            Abduloei - ผู้ช่วยบ้านอัจฉริยะ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-white">
                อีเมล
              </label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                autoComplete="email"
                disabled={isLoading}
                className="h-[52px] bg-[#2A2A2A] border-[#333333] text-white placeholder:text-gray-500"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-white">
                รหัสผ่าน
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={isLoading}
                  className="h-[52px] pr-12 bg-[#2A2A2A] border-[#333333] text-white placeholder:text-gray-500"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-400 p-2"
                  disabled={isLoading}
                  aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={remember}
                  onCheckedChange={(checked) => setValue("remember", checked as boolean)}
                  disabled={isLoading}
                />
                <label
                  htmlFor="remember"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-white"
                >
                  จดจำฉันไว้
                </label>
              </div>
              <Link
                href="/forgot-password"
                className="text-sm text-[#00B900] hover:underline"
              >
                ลืมรหัสผ่าน?
              </Link>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-[52px] bg-[#00B900] hover:bg-[#009900] text-white font-medium"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  กำลังเข้าสู่ระบบ...
                </>
              ) : (
                "เข้าสู่ระบบ"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
