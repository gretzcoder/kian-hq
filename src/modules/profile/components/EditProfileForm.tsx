'use client';

import { useState } from 'react';
import { updateOjtProfile, changePassword } from '../actions';

interface EditProfileFormProps {
  initialData: {
    name: string;
    university?: string;
    study_program?: string;
    semester?: string;
    whatsapp_number?: string;
    avatar_url?: string;
    main_roles?: string[];
    custom_role?: string;
    tools?: string;
    portfolio_url?: string;
  };
}

const AVAILABLE_ROLES = [
  { key: 'RESEARCHER', label: 'Researcher', emoji: '🔍' },
  { key: 'PLANNER', label: 'Planner', emoji: '🧠' },
  { key: 'DESIGNER', label: 'Designer', emoji: '🎨' },
  { key: 'VIDEO_EDITOR', label: 'Video Editor', emoji: '🎬' },
];

export default function EditProfileForm({ initialData }: EditProfileFormProps) {
  // Ensure only ONE section ('profile' or 'password') can be open at a time
  const [activeSection, setActiveSection] = useState<'profile' | 'password' | null>(null);

  // Profile Form State
  const [name, setName] = useState(initialData.name || '');
  const [university, setUniversity] = useState(initialData.university || '');
  const [studyProgram, setStudyProgram] = useState(initialData.study_program || '');
  const [semester, setSemester] = useState(initialData.semester || '');
  const [whatsappNumber, setWhatsappNumber] = useState(initialData.whatsapp_number || '');
  const [avatarUrl, setAvatarUrl] = useState(initialData.avatar_url || '');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(initialData.main_roles || []);
  const [customRole, setCustomRole] = useState(initialData.custom_role || '');
  const [tools, setTools] = useState(initialData.tools || '');
  const [portfolioUrl, setPortfolioUrl] = useState(initialData.portfolio_url || '');

  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Password Form State
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const toggleRole = (roleKey: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleKey) ? prev.filter((r) => r !== roleKey) : [...prev, roleKey]
    );
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMsg(null);

    const res = await updateOjtProfile({
      name,
      university,
      study_program: studyProgram,
      semester,
      whatsapp_number: whatsappNumber,
      avatar_url: avatarUrl,
      main_roles: selectedRoles,
      custom_role: customRole,
      tools,
      portfolio_url: portfolioUrl,
    });

    setProfileMsg(
      res.success ? { ok: true, text: 'Profil OJT berhasil diperbarui!' } : { ok: false, text: res.error ?? 'Gagal.' }
    );
    setProfileLoading(false);
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
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setActiveSection(null);
    } else {
      setPwMsg({ ok: false, text: res.error ?? 'Gagal.' });
    }
    setPwLoading(false);
  };

  const inputCls =
    'w-full bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-colors placeholder:text-zinc-400';
  const labelCls =
    'block text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-1';
  const btnPrimary =
    'bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl transition-all active:scale-[0.97]';
  const btnGhost =
    'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 text-xs sm:text-sm font-bold px-3 py-2.5 rounded-xl transition-colors';

  return (
    <div className="space-y-3 w-full">
      <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
        Pengaturan Akun & Profil
      </p>

      {/* Edit Profile Data */}
      <div className="border border-zinc-200 dark:border-zinc-700 rounded-2xl overflow-hidden bg-white dark:bg-[#09090b]">
        <button
          type="button"
          onClick={() => setActiveSection(activeSection === 'profile' ? null : 'profile')}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors text-left"
        >
          <div className="min-w-0 pr-2">
            <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300 truncate">Data Profil & OJT</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">
              Identitas, WhatsApp, Kampus, & Portofolio
            </p>
          </div>
          <span
            className={`text-zinc-400 text-xs font-bold transition-transform duration-200 shrink-0 ${
              activeSection === 'profile' ? 'rotate-180' : ''
            }`}
          >
            ▾
          </span>
        </button>

        {activeSection === 'profile' && (
          <div className="border-t border-zinc-100 dark:border-zinc-800 p-4">
            <form onSubmit={handleProfileSave} className="space-y-4">
              {/* Nama & WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nama *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. John Doe"
                    required
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Nomor WhatsApp</label>
                  <input
                    type="text"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="e.g. 081234567890"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Avatar URL */}
              <div>
                <label className={labelCls}>Foto Profil (URL)</label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://..."
                  className={inputCls}
                />
              </div>

              {/* Kampus, Jurusan, Semester */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Universitas</label>
                  <input
                    type="text"
                    value={university}
                    onChange={(e) => setUniversity(e.target.value)}
                    placeholder="e.g. Nama Universitas / Perguruan Tinggi"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Program Studi</label>
                  <input
                    type="text"
                    value={studyProgram}
                    onChange={(e) => setStudyProgram(e.target.value)}
                    placeholder="e.g. DKV / Teknik Informatika"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Semester</label>
                  <input
                    type="text"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    placeholder="e.g. 6"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Main Roles (Multi-Select) */}
              <div>
                <label className={labelCls}>Minat Utama</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1.5">
                  {AVAILABLE_ROLES.map((r) => {
                    const isSelected = selectedRoles.includes(r.key);
                    return (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => toggleRole(r.key)}
                        className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-purple-500/10 border-purple-500 text-purple-700 dark:text-purple-300 shadow-sm'
                            : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span>{r.emoji}</span>
                          <span>{r.label}</span>
                        </span>
                        {isSelected && <span className="text-purple-600 dark:text-purple-400 text-xs">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Role */}
              <div>
                <label className={labelCls}>Minat Lainnya (Opsional)</label>
                <input
                  type="text"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  placeholder="e.g. Copywriter, Motion Designer"
                  className={inputCls}
                />
              </div>

              {/* Tools & Portfolio */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Tools & Software</label>
                  <input
                    type="text"
                    value={tools}
                    onChange={(e) => setTools(e.target.value)}
                    placeholder="e.g. Figma, Premiere Pro, CapCut"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Portofolio / Drive</label>
                  <input
                    type="url"
                    value={portfolioUrl}
                    onChange={(e) => setPortfolioUrl(e.target.value)}
                    placeholder="https://behance.net/... atau link Drive"
                    className={inputCls}
                  />
                </div>
              </div>

              {profileMsg && (
                <p
                  className={`text-xs font-bold ${
                    profileMsg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {profileMsg.ok ? '✓' : '⚠️'} {profileMsg.text}
                </p>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setActiveSection(null)} className={btnGhost}>
                  Batal
                </button>
                <button type="submit" disabled={profileLoading || !name.trim()} className={btnPrimary}>
                  {profileLoading ? 'Menyimpan...' : 'Simpan Profil'}
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
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors text-left"
        >
          <div>
            <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Ubah Password</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Minimal 6 karakter</p>
          </div>
          <span
            className={`text-zinc-400 text-xs font-bold transition-transform duration-200 ${
              activeSection === 'password' ? 'rotate-180' : ''
            }`}
          >
            ▾
          </span>
        </button>

        {activeSection === 'password' && (
          <div className="border-t border-zinc-100 dark:border-zinc-800 p-4">
            <form onSubmit={handlePasswordSave} className="space-y-3">
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
                <p
                  className={`text-xs font-bold ${
                    pwMsg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {pwMsg.ok ? '✓' : '⚠️'} {pwMsg.text}
                </p>
              )}

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection(null);
                    setCurrentPw('');
                    setNewPw('');
                    setConfirmPw('');
                  }}
                  className={btnGhost}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pwLoading || !currentPw || !newPw || !confirmPw}
                  className={btnPrimary}
                >
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
