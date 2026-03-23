"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { logout } from "@/app/actions/auth";

export default function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);

    try {
      const result = await logout();

      if (result.success) {
        toast.success("ออกจากระบบสำเร็จ");
        router.push("/login");
        router.refresh();
      } else {
        toast.error(result.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการออกจากระบบ");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleLogout}
      disabled={isLoading}
      variant="outline"
      className="h-[52px]"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          กำลังออกจากระบบ...
        </>
      ) : (
        <>
          <LogOut className="mr-2 h-4 w-4" />
          ออกจากระบบ
        </>
      )}
    </Button>
  );
}
