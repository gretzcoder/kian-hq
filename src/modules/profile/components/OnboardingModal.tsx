'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateOjtProfile } from '@/modules/profile/actions';

interface OnboardingModalProps {
  initialName: string;
  isStaff?: boolean;
}

const AVAILABLE_ROLES = [
  { key: 'RESEARCHER', label: 'Researcher', emoji: '🔍' },
  { key: 'PLANNER', label: 'Planner', emoji: '🧠' },
  { key: 'DESIGNER', label: 'Designer', emoji: '🎨' },
  { key: 'VIDEO_EDITOR', label: 'Video Editor', emoji: '🎬' },
];

export default function OnboardingModal({ initialName, isStaff = false }: OnboardingModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  // Form states
  const [name, setName] = useState(initialName || '');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [university, setUniversity] = useState('');
  const [studyProgram, setStudyProgram] = useState('');
  const [semester, setSemester] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [customRole, setCustomRole] = useState('');
  const [tools, setTools] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleRole = (roleKey: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleKey) ? prev.filter((r) => r !== roleKey) : [...prev, roleKey]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError('Nama lengkap wajib diisi.');
    if (!whatsappNumber.trim()) return setError('Nomor WhatsApp wajib diisi.');

    setLoading(true);
    try {
      const res = await updateOjtProfile({
        name,
        university,
        study_program: studyProgram,
        semester,
        whatsapp_number: whatsappNumber,
        department,
        bio,
        avatar_url: avatarUrl,
        main_roles: selectedRoles,
        custom_role: customRole,
        tools,
        portfolio_url: portfolioUrl,
        completeOnboarding: true,
      });

      if (res.success) {
        router.refresh();
      } else {
        setError(res.error || 'Gagal menyimpan profil onboarding.');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem.');
      setLoading(false);
    }
  };

  const inputCls =
    'w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-purple-500 transition-colors placeholder:text-zinc-400';
  const labelCls =
    'block text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-1';

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-300">
      <div className="w-full max-w-xl bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 my-auto">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-600 text-white text-2xl shadow-lg mb-1">
            🚀
          </div>
          <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
            Selamat Datang di Kian HQ!
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
            {isStaff
              ? 'Lengkapi data profil kamu terlebih dahulu agar tim & koordinator dapat mengenali peran serta keahlianmu.'
              : 'Lengkapi data profil kamu terlebih dahulu agar koordinator & mentor dapat mengenali keahlianmu.'}
          </p>

          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 pt-2">
            <span className={`h-1.5 rounded-full transition-all duration-300 ${step === 1 ? 'w-8 bg-purple-600' : 'w-2 bg-zinc-200 dark:bg-zinc-800'}`} />
            <span className={`h-1.5 rounded-full transition-all duration-300 ${step === 2 ? 'w-8 bg-purple-600' : 'w-2 bg-zinc-200 dark:bg-zinc-800'}`} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {step === 1 ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
              <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest">
                1. Data Diri {isStaff ? '& Jabatan' : '& Kampus'}
              </p>

              <div>
                <label className={labelCls}>Nama *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Syaiful Bakhri"
                  required
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Nomor WhatsApp *</label>
                <input
                  type="text"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="e.g. 081234567890"
                  required
                  className={inputCls}
                />
              </div>

              {isStaff ? (
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
              ) : (
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
                      placeholder="e.g. DKV / Sistem Informasi"
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
              )}

              <button
                type="button"
                onClick={() => {
                  if (!name.trim() || !whatsappNumber.trim()) {
                    return setError('Nama dan Nomor WhatsApp wajib diisi.');
                  }
                  setError(null);
                  setStep(2);
                }}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg text-xs sm:text-sm mt-4"
              >
                Lanjut ke Langkah 2 ➔
              </button>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
              <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest">
                2. Keahlian & Bio
              </p>

              {/* Roles Selection */}
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
                        className={`px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
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

              <div>
                <label className={labelCls}>Keahlian / Minat Lainnya (Opsional)</label>
                <input
                  type="text"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  placeholder="e.g. Copywriter, Motion Designer"
                  className={inputCls}
                />
              </div>

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
                <label className={labelCls}>Bio / Deskripsi Diri</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={2}
                  placeholder={isStaff ? 'e.g. Mentor Divisi Video & Creative Strategy Kian HQ' : 'e.g. Antusias di bidang visual design & motion graphics.'}
                  className={`${inputCls} resize-none`}
                />
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

              {error && (
                <p className="text-xs text-red-500 font-bold bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  ⚠️ {error}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold py-3 rounded-xl hover:bg-zinc-200 transition-colors text-xs sm:text-sm"
                >
                  ⬅ Kembali
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg text-xs sm:text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? 'Menyimpan...' : 'Simpan & Mulai 🚀'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
