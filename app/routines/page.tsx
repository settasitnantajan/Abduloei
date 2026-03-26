import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserRoutines } from '@/app/actions/routines';
import RoutinesList from '@/components/routines/RoutinesList';

export const metadata = {
  title: 'กิจวัตร | Abduloei',
  description: 'จัดการกิจวัตรประจำวันของคุณ',
};

export default async function RoutinesPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const { routines } = await getUserRoutines();

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <RoutinesList initialRoutines={routines} />
      </div>
    </div>
  );
}
