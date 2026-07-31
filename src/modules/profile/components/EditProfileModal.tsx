'use client';

import { useState } from 'react';
import { updateOjtProfile, changePassword } from '../actions';

interface EditProfileModalProps {
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
    department?: string;
    bio?: string;
    userType?: string;
  };
  isOpen: boolean;
  onClose: () => void;
}

const AVAILABLE_ROLES = [
  { key: 'RESEARCHER', label: 'Researcher', emoji: '🔍' },
  { key: 'PLANNER', label: 'Planner', emoji: '🧠' },
  { key: 'DESIGNER', label: 'Designer', emoji: '🎨' },
  { key: 'VIDEO_EDITOR', label: 'Video Editor', emoji: '🎬' },
];

export default function EditProfileModal({ initialData, isOpen, onClose }: EditProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  const isStaff = initialData.userType === 'STAFF';

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
  const [department, setDepartment] = useState(initialData.department || '');
  const [bio, setBio] = useState(initialData.bio || '');

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

  if (!isOpen) return null;

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
      department,
      bio,
    });

    setProfileMsg(
      res.success ? { ok: true, text: 'Profil berhasil diperbarui!' } : { ok: false, text: res.error ?? 'Gagal.' }
    );
    setProfileLoading(false);
    if (res.success) {
      setTimeout(() => onClose(), 600);
    }
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
      setTimeout(() => onClose(), 600);
    } else {
      setPwMsg({ ok: false, text: res.error ?? 'Gagal.' });
    }
    setPwLoading(false);
  };

  const inputCls =
    'w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-purple-500 transition-colors placeholder:text-zinc-400';
  const labelCls =
    'block text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-1';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-5 my-auto max-h-[90vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3 shrink-0">
          <div>
            <h3 className="text-lg font-black text-zinc-900 dark:text-white">Pengaturan Profil</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Perbarui data diri & keamanan akunmu.</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white font-bold flex items-center justify-center text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex-1 pb-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'profile'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Data Profil
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('password')}
            className={`flex-1 pb-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'password'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Ubah Password
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-4">
          {activeTab === 'profile' ? (
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nama *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
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
                    placeholder="081234567890"
                    className={inputCls}
                  />
                </div>
              </div>

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

              {/* Department field for Staff */}
              {isStaff && (
                <div>
                  <label className={labelCls}>Jabatan / Divisi</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Mentor Lead Content / Head of Design"
                    className={inputCls}
                  />
                </div>
              )}

              {/* Academic Details (Only for OJT) */}
              {!isStaff && (
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
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Semester</label>
                    <input
                      type="text"
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
              )}

              {/* Minat Utama (For both OJT & Staff) */}
              <div>
                <label className={labelCls}>Minat / Keahlian Utama</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {AVAILABLE_ROLES.map((r) => {
                    const isSelected = selectedRoles.includes(r.key);
                    return (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => toggleRole(r.key)}
                        className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-purple-500/10 border-purple-500 text-purple-700 dark:text-purple-300'
                            : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
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

              <div>
                <label className={labelCls}>Keahlian / Minat Lainnya (Opsional)</label>
                <input
                  type="text"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  placeholder="e.g. Copywriter, Branding Strategy"
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Tools & Software</label>
                  <input
                    type="text"
                    value={tools}
                    onChange={(e) => setTools(e.target.value)}
                    placeholder="e.g. Figma, Premiere, Photoshop"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Portofolio / Drive</label>
                  <input
                    type="url"
                    value={portfolioUrl}
                    onChange={(e) => setPortfolioUrl(e.target.value)}
                    placeholder="https://..."
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Bio (Available for both OJT & Staff) */}
              <div>
                <label className={labelCls}>Bio / Deskripsi Diri</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={2}
                  placeholder={isStaff ? 'e.g. Mentor Divisi Video & Creative Strategy Kian HQ' : 'e.g. Antusias di bidang visual design & motion graphics.'}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {profileMsg && (
                <p className={`text-xs font-bold ${profileMsg.ok ? 'text-emerald-500' : 'text-red-500'}`}>
                  {profileMsg.ok ? '✓' : '⚠️'} {profileMsg.text}
                </p>
              )}

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={profileLoading || !name.trim()}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md disabled:opacity-50"
                >
                  {profileLoading ? 'Menyimpan...' : 'Simpan Profil'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handlePasswordSave} className="space-y-3">
              <div>
                <label className={labelCls}>Password Saat Ini</label>
                <div className="relative">
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    required
                    className={inputCls + ' pr-10'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs"
                  >
                    {showCurrentPw ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div>
                <label className={labelCls}>Password Baru</label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    required
                    className={inputCls + ' pr-10'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs"
                  >
                    {showNewPw ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div>
                <label className={labelCls}>Konfirmasi Password Baru</label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  required
                  className={`${inputCls} ${confirmPw && newPw !== confirmPw ? 'border-red-500' : ''}`}
                />
              </div>

              {pwMsg && (
                <p className={`text-xs font-bold ${pwMsg.ok ? 'text-emerald-500' : 'text-red-500'}`}>
                  {pwMsg.ok ? '✓' : '⚠️'} {pwMsg.text}
                </p>
              )}

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pwLoading || !currentPw || !newPw || !confirmPw}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md disabled:opacity-50"
                >
                  {pwLoading ? 'Menyimpan...' : 'Ubah Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
