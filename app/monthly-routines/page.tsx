import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserMonthlyRoutines } from '@/app/actions/monthly-routines';
import MonthlyRoutinesList from '@/components/monthly-routines/MonthlyRoutinesList';

export const metadata = {
  title: 'กิจวัตรรายเดือน | Abduloei',
  description: 'จัดการกิจวัตรรายเดือนของคุณ',
};

export default async function MonthlyRoutinesPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const { routines } = await getUserMonthlyRoutines();

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <MonthlyRoutinesList initialRoutines={routines} />
      </div>
    </div>
  );
}
