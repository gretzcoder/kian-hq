'use client';

import { useState } from 'react';
import { sendReviewReminderToMentor, sendSubmissionReminderToTrooper } from '@/modules/tasks/actions';
import { useUI } from '@/components/ui/UIProvider';

interface SendReminderButtonProps {
  assignmentId: string;
  targetRole?: 'MENTOR' | 'TROOPER';
  mentorName?: string | null;
  assigneeName?: string | null;
  className?: string;
}

export default function SendReminderButton({
  assignmentId,
  targetRole = 'MENTOR',
  mentorName,
  assigneeName,
  className = '',
}: SendReminderButtonProps) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useUI();

  const isTrooperTarget = targetRole === 'TROOPER';
  const targetName = isTrooperTarget ? assigneeName || 'Peserta' : mentorName || 'Mentor';

  const handleSendReminder = async () => {
    if (loading || sent) return;
    setLoading(true);
    try {
      const res = isTrooperTarget
        ? await sendSubmissionReminderToTrooper(assignmentId)
        : await sendReviewReminderToMentor(assignmentId);

      if (res.success) {
        setSent(true);
        toast(res.message || 'Notifikasi reminder berhasil dikirim!', 'success');
      } else {
        toast(res.error || 'Gagal mengirim reminder', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Error occurred', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSendReminder}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border active:scale-95 cursor-pointer ${
        sent
          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400'
          : isTrooperTarget
          ? 'bg-indigo-500/10 text-indigo-700 hover:bg-indigo-500/20 border-indigo-500/20 dark:text-indigo-300 dark:hover:bg-indigo-500/30'
          : 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500/30'
      } ${className}`}
      title={
        isTrooperTarget
          ? `Kirim reminder pengerjaan ke Peserta: ${targetName}`
          : `Kirim reminder notifikasi review ke Mentor: ${targetName}`
      }
    >
      <span>{loading ? '⏳' : sent ? '✓' : '🔔'}</span>
      <span>
        {loading
          ? 'Mengirim...'
          : sent
          ? 'Reminder Terkirim'
          : isTrooperTarget
          ? `Ingatkan Peserta (${targetName})`
          : `Ingatkan Mentor (${targetName})`}
      </span>
    </button>
  );
}
