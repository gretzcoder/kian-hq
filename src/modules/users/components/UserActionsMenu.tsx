'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { resetUserPassword, deleteUser } from '../actions';
import { startImpersonatingUser } from '../impersonationActions';
import { useUI } from '@/components/ui/UIProvider';

export default function UserActionsMenu({
  userId,
  userName,
  isSelf,
}: {
  userId: string;
  userName: string;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { toast, confirm } = useUI();

  const handleImpersonate = async () => {
    setLoading(true);
    try {
      const res = await startImpersonatingUser(userId);
      if (res.success) {
        toast(`Sekarang masuk sebagai akun "${userName}"`, 'success', 'User Impersonation');
        router.refresh();
      } else {
        toast(res.error ?? 'Gagal mensimulasikan akun.', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Terjadi kesalahan sistem.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const isConfirmed = await confirm({
      title: 'Reset Password',
      message: `Apakah Anda yakin ingin me-reset password untuk "${userName}" kembali ke default ("kianizer")?`,
      confirmText: 'Ya, Reset',
      variant: 'warning',
    });

    if (!isConfirmed) return;

    setLoading(true);
    try {
      const res = await resetUserPassword(userId);
      if (res.success) {
        toast(`Password untuk ${userName} telah di-reset ke "kianizer"`, 'success', 'Password Reset');
      } else {
        toast(res.error ?? 'Gagal me-reset password.', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Terjadi kesalahan sistem.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    const isConfirmed = await confirm({
      title: 'Hapus User',
      message: `Apakah Anda yakin ingin menghapus user "${userName}" secara permanen? Semua hak akses dan tugas terkait akan dihapus.`,
      confirmText: 'Ya, Hapus Permanen',
      variant: 'danger',
    });

    if (!isConfirmed) return;

    setLoading(true);
    try {
      const res = await deleteUser(userId);
      if (res.success) {
        toast(`User ${userName} berhasil dihapus.`, 'success');
      } else {
        toast(res.error ?? 'Gagal menghapus user.', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Terjadi kesalahan sistem.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (isSelf) {
    return <span className="text-[10px] text-zinc-400 dark:text-zinc-600 font-bold">Active Session</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      {/* Impersonate / Login As Button */}
      <button
        onClick={handleImpersonate}
        disabled={loading}
        title={`Masuk & uji aplikasi sebagai ${userName}`}
        className="text-[10px] font-bold text-purple-700 dark:text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-600 border border-purple-500/20 px-2.5 py-1 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97] flex items-center gap-1"
      >
        <span>🎭</span>
        <span>Login As</span>
      </button>

      {/* Reset Password Button */}
      <button
        onClick={handleResetPassword}
        disabled={loading}
        title="Reset password to 'kianizer'"
        className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-purple-500/5 border border-zinc-200 dark:border-zinc-800 hover:border-purple-500/15 px-2.5 py-1 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97]"
      >
        Reset PW
      </button>

      {/* Delete User Button */}
      <button
        onClick={handleDeleteUser}
        disabled={loading}
        title="Delete user completely"
        className="text-[10px] font-bold text-red-600 dark:text-red-400 hover:bg-red-500/10 bg-red-500/5 border border-red-500/10 px-2.5 py-1 rounded-xl transition-all disabled:opacity-50 active:scale-[0.97]"
      >
        Delete
      </button>
    </div>
  );
}
