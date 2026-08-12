'use client';

import { useState } from 'react';
import { sendReviewReminderToMentor } from '@/modules/tasks/actions';
import { useUI } from '@/components/ui/UIProvider';

interface SendReminderButtonProps {
  assignmentId: string;
  mentorName?: string | null;
  className?: string;
}

export default function SendReminderButton({
  assignmentId,
  mentorName,
  className = '',
}: SendReminderButtonProps) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useUI();

  const handleSendReminder = async () => {
    if (loading || sent) return;
    setLoading(true);
    try {
      const res = await sendReviewReminderToMentor(assignmentId);
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
          : 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500/30'
      } ${className}`}
      title={mentorName ? `Kirim reminder notifikasi ke Mentor: ${mentorName}` : 'Kirim reminder ke Mentor'}
    >
      <span>{loading ? '⏳' : sent ? '✓' : '🔔'}</span>
      <span>
        {loading
          ? 'Mengirim...'
          : sent
          ? 'Reminder Terkirim'
          : mentorName
          ? `Ingatkan Mentor (${mentorName})`
          : 'Ingatkan Mentor'}
      </span>
    </button>
  );
}
