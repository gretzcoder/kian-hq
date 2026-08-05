'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { updateOjtProfile } from '@/modules/profile/actions';
import { stopImpersonatingUser } from '@/modules/users/impersonationActions';

interface OnboardingModalProps {
  initialName: string;
  isStaff?: boolean;
  isImpersonating?: boolean;
}

const AVAILABLE_ROLES = [
  { key: 'RESEARCHER', label: 'Researcher', emoji: '🔍' },
  { key: 'PLANNER', label: 'Planner', emoji: '🧠' },
  { key: 'DESIGNER', label: 'Designer', emoji: '🎨' },
  { key: 'VIDEO_EDITOR', label: 'Video Editor', emoji: '🎬' },
];

const BIO_MAX = 300;

// ── Validation helpers ────────────────────────────────────────────────────────

function validateName(v: string): string | null {
  if (!v.trim()) return 'Nama lengkap wajib diisi.';
  if (v.trim().length < 2) return 'Nama minimal 2 karakter.';
  if (v.trim().length > 100) return 'Nama maksimal 100 karakter.';
  return null;
}

/**
 * Valid Indonesian phone: starts with 08, +628, or 628
 * Length 10–15 digits (without +)
 */
function validateWhatsapp(v: string): string | null {
  if (!v.trim()) return 'Nomor WhatsApp wajib diisi.';
  const cleaned = v.replace(/[\s\-().]/g, '');
  if (!/^(\+62|62|08)\d+$/.test(cleaned)) {
    return 'Format tidak valid. Gunakan format 081234567890 atau +6281234567890.';
  }
  const digitOnly = cleaned.replace(/^\+/, '');
  if (digitOnly.length < 10 || digitOnly.length > 15) {
    return 'Nomor WhatsApp harus 10–15 digit.';
  }
  return null;
}

function validateNIM(v: string): string | null {
  if (!v.trim()) return null; // optional
  if (!/^\d{8}$/.test(v.trim())) return 'NIM harus tepat 8 digit angka.';
  return null;
}

function validateSemester(v: string): string | null {
  if (!v.trim()) return null; // optional
  const n = Number(v.trim());
  if (!Number.isInteger(n) || n < 1 || n > 14) return 'Semester harus berupa angka 1–14.';
  return null;
}

function validatePortfolio(v: string): string | null {
  if (!v.trim()) return null; // optional
  try { new URL(v.trim()); return null; } catch { return 'URL portofolio tidak valid.'; }
}

function validateAvatar(v: string): string | null {
  if (!v.trim()) return null; // optional
  try { new URL(v.trim()); return null; } catch { return 'URL foto profil tidak valid.'; }
}

// ── Shared UI classes ─────────────────────────────────────────────────────────

const inputCls = (err?: string | null) =>
  `w-full bg-zinc-50 dark:bg-zinc-900 border text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 transition-colors placeholder:text-zinc-400 ${
    err
      ? 'border-red-400 dark:border-red-500 focus:border-red-400 focus:ring-red-400/20'
      : 'border-zinc-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-purple-500/20'
  }`;

const labelCls =
  'block text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-1';

function FieldError({ msg }: { msg?: string | null }) {
  if (!msg) return null;
  return <p className="text-[10px] text-red-500 font-bold mt-1 flex items-center gap-1"><span>⚠</span>{msg}</p>;
}

function ErrorBanner({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <p className="text-xs text-red-500 font-bold bg-red-500/8 border border-red-500/20 rounded-xl p-3 flex items-start gap-2">
      <span className="shrink-0">⚠️</span>
      <span>{msg}</span>
    </p>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OnboardingModal({
  initialName,
  isStaff = false,
  isImpersonating = false,
}: OnboardingModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  const handleExitImpersonation = () => {
    setLoading(true);
    stopImpersonatingUser().then(() => {
      router.refresh();
    });
  };

  // Step 1 fields
  const [name,            setName]            = useState(initialName || '');
  const [whatsappNumber,  setWhatsappNumber]  = useState('');
  const [department,      setDepartment]      = useState('');
  const [university,      setUniversity]      = useState('');
  const [studentIdNumber, setStudentIdNumber] = useState('');
  const [studyProgram,    setStudyProgram]    = useState('');
  const [semester,        setSemester]        = useState('');

  // Step 2 fields
  const [selectedRoles,   setSelectedRoles]   = useState<string[]>([]);
  const [customRole,      setCustomRole]      = useState('');
  const [tools,           setTools]           = useState('');
  const [portfolioUrl,    setPortfolioUrl]    = useState('');
  const [avatarUrl,       setAvatarUrl]       = useState('');
  const [bio,             setBio]             = useState('');

  // Per-field touched errors (only shown after blur or attempted advance)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const setFE = (key: string, val: string | null) =>
    setFieldErrors((p) => ({ ...p, [key]: val }));

  const toggleRole = (roleKey: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleKey) ? prev.filter((r) => r !== roleKey) : [...prev, roleKey]
    );
  };

  // ── Step 1 → 2 ─────────────────────────────────────────────────────────────

  const handleNextStep = useCallback(() => {
    setGlobalError(null);

    // Run all step 1 validations
    const errs: Record<string, string | null> = {
      name:      validateName(name),
      whatsapp:  validateWhatsapp(whatsappNumber),
      nim:       validateNIM(studentIdNumber),
      semester:  validateSemester(semester),
    };
    setFieldErrors((p) => ({ ...p, ...errs }));

    const hasError = Object.values(errs).some(Boolean);
    if (hasError) {
      setGlobalError('Harap perbaiki kolom yang masih merah di bawah sebelum lanjut.');
      return;
    }

    setGlobalError(null);
    setStep(2);
  }, [name, whatsappNumber, studentIdNumber, semester]);

  // ── Final submit ────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);

    // Validate step 2
    const step2Errs: Record<string, string | null> = {
      portfolio: validatePortfolio(portfolioUrl),
      avatar:    validateAvatar(avatarUrl),
    };

    // Require at least one skill (either preset or custom)
    if (selectedRoles.length === 0 && !customRole.trim()) {
      step2Errs.skills = 'Pilih minimal 1 keahlian atau isi bidang keahlian lainnya.';
    } else {
      step2Errs.skills = null;
    }

    // Bio length
    if (bio.length > BIO_MAX) {
      step2Errs.bio = `Bio maksimal ${BIO_MAX} karakter (saat ini ${bio.length}).`;
    }

    setFieldErrors((p) => ({ ...p, ...step2Errs }));
    const hasError = Object.values(step2Errs).some(Boolean);
    if (hasError) {
      setGlobalError('Harap perbaiki isian yang masih merah sebelum menyimpan.');
      return;
    }

    setLoading(true);
    try {
      const res = await updateOjtProfile({
        name,
        university,
        student_id_number: studentIdNumber,
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
        setGlobalError(res.error || 'Gagal menyimpan profil onboarding.');
        setLoading(false);
      }
    } catch (err: any) {
      setGlobalError(err.message || 'Terjadi kesalahan sistem.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-300">
      <div className="w-full max-w-xl bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 my-auto">
        {/* Admin Impersonation Exit Alert */}
        {isImpersonating && (
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-bold text-xs">
              <span className="text-base">🎭</span>
              <span>Mode Impersonation Admin (Profil user ini belum lengkap)</span>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={handleExitImpersonation}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50 shrink-0"
            >
              ✕ Exit Impersonation
            </button>
          </div>
        )}

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
          {/* ── Step 1 ──────────────────────────────────────────────────────── */}
          {step === 1 ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
              <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest">
                1. Data Diri {isStaff ? '& Jabatan' : '& Kampus'}
              </p>

              {/* Global error for step 1 */}
              <ErrorBanner msg={globalError} />

              {/* Name */}
              <div>
                <label className={labelCls}>Nama Lengkap *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setFE('name', validateName(name))}
                  placeholder="e.g. Syaiful Bakhri"
                  className={inputCls(fieldErrors.name)}
                />
                <FieldError msg={fieldErrors.name} />
              </div>

              {/* WhatsApp */}
              <div>
                <label className={labelCls}>Nomor WhatsApp * <span className="normal-case font-normal text-zinc-400">(format: 081234567890)</span></label>
                <input
                  type="tel"
                  value={whatsappNumber}
                  onChange={(e) => {
                    // Allow digits, +, spaces, dashes, dots
                    const val = e.target.value.replace(/[^\d+\s\-().]/g, '');
                    setWhatsappNumber(val);
                  }}
                  onBlur={() => setFE('whatsapp', validateWhatsapp(whatsappNumber))}
                  placeholder="e.g. 081234567890 atau +6281234567890"
                  className={inputCls(fieldErrors.whatsapp)}
                  maxLength={17}
                />
                <FieldError msg={fieldErrors.whatsapp} />
              </div>

              {/* Staff: department / OJT: campus fields */}
              {isStaff ? (
                <div>
                  <label className={labelCls}>Jabatan / Divisi</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Mentor Lead Content / Head of Design"
                    className={inputCls()}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Asal Kampus</label>
                      <input
                        type="text"
                        value={university}
                        onChange={(e) => setUniversity(e.target.value)}
                        placeholder="e.g. UBSI Bekasi"
                        className={inputCls()}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>NIM (Nomor Induk Mahasiswa)</label>
                      <input
                        type="text"
                        value={studentIdNumber}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          if (val.length <= 8) setStudentIdNumber(val);
                        }}
                        onBlur={() => setFE('nim', validateNIM(studentIdNumber))}
                        placeholder="e.g. 12230123 (8 digit)"
                        maxLength={8}
                        inputMode="numeric"
                        className={inputCls(fieldErrors.nim)}
                      />
                      <FieldError msg={fieldErrors.nim} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Program Studi</label>
                      <input
                        type="text"
                        value={studyProgram}
                        onChange={(e) => setStudyProgram(e.target.value)}
                        placeholder="e.g. DKV / Sistem Informasi"
                        className={inputCls()}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Semester <span className="normal-case font-normal text-zinc-400">(1–14)</span></label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={semester}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                          setSemester(val);
                        }}
                        onBlur={() => setFE('semester', validateSemester(semester))}
                        placeholder="e.g. 6"
                        className={inputCls(fieldErrors.semester)}
                      />
                      <FieldError msg={fieldErrors.semester} />
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleNextStep}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg text-xs sm:text-sm mt-4 active:scale-[0.98]"
              >
                Lanjut ke Langkah 2 ➔
              </button>
            </div>
          ) : (
          /* ── Step 2 ──────────────────────────────────────────────────────── */
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
              <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest">
                2. Keahlian & Bio
              </p>

              {/* Roles Selection */}
              <div>
                <label className={labelCls}>
                  Minat / Keahlian Utama *
                  <span className="normal-case font-normal text-zinc-400 ml-1">(pilih minimal 1)</span>
                </label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {AVAILABLE_ROLES.map((r) => {
                    const isSelected = selectedRoles.includes(r.key);
                    return (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => {
                          toggleRole(r.key);
                          setFE('skills', null);
                        }}
                        className={`px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-purple-500/10 border-purple-500 text-purple-700 dark:text-purple-300 shadow-sm'
                            : fieldErrors.skills
                            ? 'bg-red-500/5 border-red-400 dark:border-red-500 text-zinc-600 dark:text-zinc-400 hover:border-red-300'
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
                <FieldError msg={fieldErrors.skills} />
              </div>

              {/* Custom role */}
              <div>
                <label className={labelCls}>Keahlian / Minat Lainnya <span className="normal-case font-normal">(atau isi ini jika tidak ada di atas)</span></label>
                <input
                  type="text"
                  value={customRole}
                  onChange={(e) => {
                    setCustomRole(e.target.value);
                    setFE('skills', null);
                  }}
                  placeholder="e.g. Copywriter, Motion Designer"
                  className={inputCls()}
                />
              </div>

              {/* Tools */}
              <div>
                <label className={labelCls}>Tools & Software</label>
                <input
                  type="text"
                  value={tools}
                  onChange={(e) => setTools(e.target.value)}
                  placeholder="e.g. Figma, Premiere Pro, CapCut"
                  className={inputCls()}
                />
              </div>

              {/* Bio with character counter */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={labelCls}>Bio / Deskripsi Diri</label>
                  <span className={`text-[9px] font-bold tabular-nums ${bio.length > BIO_MAX ? 'text-red-500' : 'text-zinc-400'}`}>
                    {bio.length}/{BIO_MAX}
                  </span>
                </div>
                <textarea
                  value={bio}
                  onChange={(e) => {
                    setBio(e.target.value);
                    if (e.target.value.length <= BIO_MAX) setFE('bio', null);
                  }}
                  onBlur={() => setFE('bio', bio.length > BIO_MAX ? `Bio maksimal ${BIO_MAX} karakter.` : null)}
                  rows={2}
                  placeholder={isStaff ? 'e.g. Mentor Divisi Video & Creative Strategy Kian HQ' : 'e.g. Antusias di bidang visual design & motion graphics.'}
                  className={`${inputCls(fieldErrors.bio)} resize-none`}
                />
                <FieldError msg={fieldErrors.bio} />
              </div>

              {/* Portfolio URL */}
              <div>
                <label className={labelCls}>Link Portofolio (Behance / Drive / Web / Social Media)</label>
                <input
                  type="text"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  onBlur={() => setFE('portfolio', validatePortfolio(portfolioUrl))}
                  placeholder="e.g. https://behance.net/... atau https://drive.google.com/..."
                  className={inputCls(fieldErrors.portfolio)}
                />
                <FieldError msg={fieldErrors.portfolio} />
              </div>

              {/* Avatar URL */}
              <div>
                <label className={labelCls}>Foto Profil (URL)</label>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  onBlur={() => setFE('avatar', validateAvatar(avatarUrl))}
                  placeholder="https://..."
                  className={inputCls(fieldErrors.avatar)}
                />
                <FieldError msg={fieldErrors.avatar} />
                {/* Preview */}
                {avatarUrl && !fieldErrors.avatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt="preview"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    className="mt-2 w-12 h-12 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                  />
                )}
              </div>

              {/* Global error */}
              <ErrorBanner msg={globalError} />

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setGlobalError(null); setStep(1); }}
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
