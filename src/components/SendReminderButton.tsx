'use client';

import { useState } from 'react';
import {
  sendReviewReminderToMentor,
  sendSubmissionReminderToTrooper,
  sendReviewReminderToCoordinator,
  sendTaskSmartReminder,
} from '@/modules/tasks/actions';
import { useUI } from '@/components/ui/UIProvider';

interface SendReminderButtonProps {
  assignmentId: string;
  targetRole?: 'MENTOR' | 'TROOPER' | 'COORDINATOR';
  mentorName?: string | null;
  assigneeName?: string | null;
  coordinatorName?: string | null;
  className?: string;
}

export default function SendReminderButton({
  assignmentId,
  targetRole = 'MENTOR',
  mentorName,
  assigneeName,
  coordinatorName,
  className = '',
}: SendReminderButtonProps) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useUI();

  const isTrooperTarget = targetRole === 'TROOPER';
  const isCoordTarget = targetRole === 'COORDINATOR';

  const targetName = isTrooperTarget
    ? assigneeName || 'Peserta'
    : isCoordTarget
    ? coordinatorName || 'Koordinator'
    : mentorName || 'Mentor';

  const handleSendReminder = async () => {
    if (loading || sent) return;
    setLoading(true);
    try {
      const res = isTrooperTarget
        ? await sendSubmissionReminderToTrooper(assignmentId)
        : isCoordTarget
        ? await sendReviewReminderToCoordinator(assignmentId)
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
          : isCoordTarget
          ? 'bg-purple-500/10 text-purple-700 hover:bg-purple-500/20 border-purple-500/20 dark:text-purple-300 dark:hover:bg-purple-500/30'
          : 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500/30'
      } ${className}`}
      title={
        isTrooperTarget
          ? `Kirim reminder pengerjaan ke Peserta: ${targetName}`
          : isCoordTarget
          ? `Kirim reminder QC Review ke Koordinator`
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
          : isCoordTarget
          ? `Ingatkan Coordinator QC`
          : `Ingatkan Mentor (${targetName})`}
      </span>
    </button>
  );
}

interface TaskSmartReminderButtonProps {
  taskId: string;
  unsubmittedCount: number;
  waitingReviewCount: number;
  mentorName?: string | null;
  className?: string;
}

export function TaskSmartReminderButton({
  taskId,
  unsubmittedCount,
  waitingReviewCount,
  mentorName,
  className = '',
}: TaskSmartReminderButtonProps) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useUI();

  const handleSendBatchReminder = async () => {
    if (loading || sent) return;
    setLoading(true);
    try {
      const res = await sendTaskSmartReminder(taskId);
      if (res.success) {
        setSent(true);
        toast(res.message || 'Smart Reminder berhasil dikirim!', 'success');
      } else {
        toast(res.error || 'Gagal mengirim reminder', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Error occurred', 'error');
    } finally {
      setLoading(false);
    }
  };

  let buttonText = 'Ingatkan Task';
  if (unsubmittedCount > 0 && waitingReviewCount > 0) {
    buttonText = `Ingatkan All (${unsubmittedCount} Trooper & Mentor)`;
  } else if (unsubmittedCount > 0) {
    buttonText = `Ingatkan All Peserta (${unsubmittedCount} Belum Submit)`;
  } else if (waitingReviewCount > 0) {
    buttonText = `Ingatkan Mentor Review (${mentorName || 'Mentor'})`;
  }

  return (
    <button
      type="button"
      onClick={handleSendBatchReminder}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all border active:scale-95 cursor-pointer ${
        sent
          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400'
          : 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500/30'
      } ${className}`}
      title="Kirim notifikasi reminder otomatis ke semua peserta & mentor"
    >
      <span>{loading ? '⏳' : sent ? '✓' : '🔔'}</span>
      <span>{loading ? 'Mengirim...' : sent ? 'Reminder Terkirim' : buttonText}</span>
    </button>
  );
}
