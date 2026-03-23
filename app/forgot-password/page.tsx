"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ArrowLeft, Mail } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { forgotPassword } from "@/app/actions/auth";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations/auth";

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setIsLoading(true);

    try {
      const result = await forgotPassword(data);

      if (result.success) {
        setEmailSent(true);
        toast.success("ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว");
      } else {
        toast.error(result.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
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
              <Mail className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center font-bold text-white">
            {emailSent ? "ตรวจสอบอีเมลของคุณ" : "ลืมรหัสผ่าน"}
          </CardTitle>
          <CardDescription className="text-center text-gray-400">
            {emailSent
              ? `เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปยัง ${getValues("email")}`
              : "กรอกอีเมลของคุณเพื่อรับลิงก์รีเซ็ตรหัสผ่าน"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emailSent ? (
            <div className="space-y-4">
              <div className="bg-[#00B900]/10 border border-[#00B900]/30 rounded-lg p-4">
                <p className="text-sm text-[#00B900]">
                  กรุณาตรวจสอบอีเมลของคุณและคลิกลิงก์เพื่อรีเซ็ตรหัสผ่าน
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  หากไม่พบอีเมล กรุณาตรวจสอบในโฟลเดอร์สแปม
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-[52px] bg-[#2A2A2A] border-[#333333] text-white hover:bg-[#333333]"
                onClick={() => setEmailSent(false)}
              >
                ส่งอีเมลอีกครั้ง
              </Button>

              <Link href="/login" className="block">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full h-[52px] text-white hover:bg-[#2A2A2A]"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  กลับไปหน้าเข้าสู่ระบบ
                </Button>
              </Link>
            </div>
          ) : (
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

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-[52px] bg-[#00B900] hover:bg-[#009900] text-white font-medium"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    กำลังส่งอีเมล...
                  </>
                ) : (
                  "ส่งลิงก์รีเซ็ตรหัสผ่าน"
                )}
              </Button>

              {/* Back to Login */}
              <Link href="/login" className="block">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full h-[52px] text-white hover:bg-[#2A2A2A]"
                  disabled={isLoading}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  กลับไปหน้าเข้าสู่ระบบ
                </Button>
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
