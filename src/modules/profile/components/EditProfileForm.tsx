'use client';

import { useState } from 'react';
import { updateProfileName, changePassword } from '../actions';

interface EditProfileFormProps {
  currentName: string;
}

export default function EditProfileForm({ currentName }: EditProfileFormProps) {
  const [activeSection, setActiveSection] = useState<'name' | 'password' | null>(null);

  // Name form state
  const [name, setName] = useState(currentName);
  const [nameLoading, setNameLoading] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Password form state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const handleNameSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameLoading(true);
    setNameMsg(null);
    const res = await updateProfileName(name);
    setNameMsg(res.success ? { ok: true, text: 'Nama berhasil diperbarui!' } : { ok: false, text: res.error ?? 'Gagal.' });
    setNameLoading(false);
    if (res.success) setActiveSection(null);
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPw !== confirmPw) return setPwMsg({ ok: false, text: 'Password baru tidak cocok.' });
    if (newPw.length < 6) return setPwMsg({ ok: false, text: 'Password baru minimal 6 karakter.' });
    setPwLoading(true);
    const res = await changePassword(currentPw, newPw);
    if (res.success) {
      setPwMsg({ ok: true, text: 'Password berhasil diubah!' });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setActiveSection(null);
    } else {
      setPwMsg({ ok: false, text: res.error ?? 'Gagal.' });
    }
    setPwLoading(false);
  };

  const inputCls = 'w-full bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-colors placeholder:text-zinc-400';
  const btnPrimary = 'bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all active:scale-[0.97]';
  const btnGhost = 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 text-sm font-bold px-3 py-2.5 rounded-xl transition-colors';

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Edit Profil</p>

      {/* Name Section */}
      <div className="border border-zinc-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setActiveSection(activeSection === 'name' ? null : 'name')}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
        >
          <div className="text-left">
            <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Nama Tampilan</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{currentName}</p>
          </div>
          <span className={`text-zinc-400 text-xs font-bold transition-transform duration-200 ${activeSection === 'name' ? 'rotate-180' : ''}`}>▾</span>
        </button>

        {activeSection === 'name' && (
          <div className="border-t border-zinc-100 dark:border-zinc-800 p-4">
            <form onSubmit={handleNameSave} className="space-y-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama tampilan baru"
                required
                className={inputCls}
              />
              {nameMsg && (
                <p className={`text-xs font-bold ${nameMsg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {nameMsg.ok ? '✓' : '⚠️'} {nameMsg.text}
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setActiveSection(null); setName(currentName); }} className={btnGhost}>Batal</button>
                <button type="submit" disabled={nameLoading || !name.trim()} className={btnPrimary}>
                  {nameLoading ? 'Menyimpan...' : 'Simpan Nama'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Password Section */}
      <div className="border border-zinc-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setActiveSection(activeSection === 'password' ? null : 'password')}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
        >
          <div className="text-left">
            <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Ubah Password</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Minimal 6 karakter</p>
          </div>
          <span className={`text-zinc-400 text-xs font-bold transition-transform duration-200 ${activeSection === 'password' ? 'rotate-180' : ''}`}>▾</span>
        </button>

        {activeSection === 'password' && (
          <div className="border-t border-zinc-100 dark:border-zinc-800 p-4">
            <form onSubmit={handlePasswordSave} className="space-y-3">
              {/* Current password */}
              <div className="relative">
                <input
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="Password saat ini"
                  required
                  className={inputCls + ' pr-10'}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-xs"
                >
                  {showCurrentPw ? '🙈' : '👁️'}
                </button>
              </div>

              {/* New password */}
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="Password baru (min. 6 karakter)"
                  required
                  className={inputCls + ' pr-10'}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-xs"
                >
                  {showNewPw ? '🙈' : '👁️'}
                </button>
              </div>

              {/* Confirm new password */}
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Ulangi password baru"
                required
                className={`${inputCls} ${confirmPw && newPw !== confirmPw ? 'border-red-400 dark:border-red-500' : ''}`}
              />
              {confirmPw && newPw !== confirmPw && (
                <p className="text-xs text-red-500 font-bold">⚠️ Password tidak cocok</p>
              )}

              {pwMsg && (
                <p className={`text-xs font-bold ${pwMsg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {pwMsg.ok ? '✓' : '⚠️'} {pwMsg.text}
                </p>
              )}

              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setActiveSection(null); setCurrentPw(''); setNewPw(''); setConfirmPw(''); }} className={btnGhost}>
                  Batal
                </button>
                <button type="submit" disabled={pwLoading || !currentPw || !newPw || !confirmPw} className={btnPrimary}>
                  {pwLoading ? 'Menyimpan...' : 'Ubah Password'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
