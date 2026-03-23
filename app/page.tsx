import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <main className="text-center px-4 max-w-2xl">
        <div className="flex justify-center mb-8">
          <div className="w-24 h-24 rounded-full bg-[#00B900] flex items-center justify-center">
            <span className="text-4xl font-bold text-white">A</span>
          </div>
        </div>
        <h1 className="text-5xl font-bold text-white mb-4">
          Abduloei
        </h1>
        <p className="text-xl text-gray-400 mb-8">
          ผู้ช่วยบ้านอัจฉริยะสำหรับครอบครัวไทย
        </p>
        <p className="text-gray-500 mb-12">
          AI Home Assistant ที่เข้าใจภาษาไทย พร้อมช่วยเหลือคุณในทุกเรื่องของบ้าน
        </p>
        <Link href="/login">
          <Button className="h-[52px] px-8 bg-[#00B900] hover:bg-[#009900] text-white font-medium text-lg">
            เข้าสู่ระบบ
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>
      </main>
    </div>
  );
}
