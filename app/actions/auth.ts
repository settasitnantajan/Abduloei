"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  type LoginInput,
  type ForgotPasswordInput,
  type ResetPasswordInput
} from "@/lib/validations/auth";

export async function login(formData: LoginInput) {
  try {
    // Validate input
    const validatedData = loginSchema.parse(formData);

    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: validatedData.email,
      password: validatedData.password,
    });

    if (error) {
      return {
        success: false,
        error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Login error:", error);
    return {
      success: false,
      error: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง"
    };
  }
}

export async function logout() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return { success: true };
  } catch (error) {
    console.error("Logout error:", error);
    return {
      success: false,
      error: "เกิดข้อผิดพลาดในการออกจากระบบ"
    };
  }
}

export async function forgotPassword(formData: ForgotPasswordInput) {
  try {
    // Validate input
    const validatedData = forgotPasswordSchema.parse(formData);

    const supabase = await createClient();

    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(
      validatedData.email,
      {
        redirectTo: redirectUrl,
      }
    );

    if (error) {
      return {
        success: false,
        error: "ไม่สามารถส่งอีเมลรีเซ็ตรหัสผ่านได้ กรุณาลองใหม่อีกครั้ง"
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Forgot password error:", error);
    return {
      success: false,
      error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
    };
  }
}

export async function resetPassword(formData: ResetPasswordInput) {
  try {
    // Validate input
    const validatedData = resetPasswordSchema.parse(formData);

    const supabase = await createClient();

    const { error } = await supabase.auth.updateUser({
      password: validatedData.password,
    });

    if (error) {
      return {
        success: false,
        error: "ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาลองใหม่อีกครั้ง"
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Reset password error:", error);
    return {
      success: false,
      error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
    };
  }
}

export async function getUser() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return { user: null };
    }

    return { user };
  } catch (error) {
    console.error("Get user error:", error);
    return { user: null };
  }
}
