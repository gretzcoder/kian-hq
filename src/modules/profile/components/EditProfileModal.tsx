'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { updateOjtProfile, changePassword, getMyProfileAction } from '../actions';
import UserAvatar from '@/components/ui/UserAvatar';

interface EditProfileModalProps {
  initialData: {
    name: string;
    email?: string;
    username?: string;
    university?: string;
    student_id_number?: string;
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
  { key: 'RESEARCHER', label: 'Researcher', emoji: '🔍', desc: 'Riset tren & kompetitor' },
  { key: 'PLANNER', label: 'Planner', emoji: '🧠', desc: 'Content brief & calendar' },
  { key: 'DESIGNER', label: 'Designer', emoji: '🎨', desc: 'Visual identity & grafik' },
  { key: 'VIDEO_EDITOR', label: 'Video Editor', emoji: '🎬', desc: 'Reels, Tiktok & Video' },
];

interface BankAccountItem {
  bank_name: string;
  account_number: string;
  account_name: string;
}

interface EWalletItem {
  provider: string;
  account_number: string;
  account_name: string;
}

const BANK_OPTIONS = [
  'BCA',
  'Bank Mandiri',
  'BNI',
  'BRI',
  'Bank Jago',
  'BSI (Bank Syariah Indonesia)',
  'CIMB Niaga',
  'Permata Bank',
  'Seabank',
  'Bank Danamon',
  'Lainnya',
];

const EWALLET_OPTIONS = [
  'GoPay',
  'OVO',
  'DANA',
  'ShopeePay',
  'LinkAja',
  'iSAKU',
  'Lainnya',
];

export default function EditProfileModal({ initialData, isOpen, onClose }: EditProfileModalProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  const [userType, setUserType] = useState<string>(initialData.userType || '');
  const isStaff = userType === 'STAFF';

  // Profile Form State
  const [name, setName] = useState(initialData.name || '');
  const [email, setEmail] = useState(initialData.email || '');
  const [username, setUsername] = useState(initialData.username || '');
  const [university, setUniversity] = useState(initialData.university || '');
  const [studentIdNumber, setStudentIdNumber] = useState(initialData.student_id_number || '');
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

  // Financial Details State
  const [bankAccounts, setBankAccounts] = useState<BankAccountItem[]>([]);
  const [ewallets, setEwallets] = useState<EWalletItem[]>([]);

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

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync state & fetch complete profile details when modal opens
  useEffect(() => {
    if (isOpen) {
      setUserType(initialData.userType || '');
      setName(initialData.name || '');
      setEmail(initialData.email || '');
      setUsername(initialData.username || '');
      setUniversity(initialData.university || '');
      setStudentIdNumber(initialData.student_id_number || '');
      setStudyProgram(initialData.study_program || '');
      setSemester(initialData.semester || '');
      setWhatsappNumber(initialData.whatsapp_number || '');
      setAvatarUrl(initialData.avatar_url || '');
      setSelectedRoles(initialData.main_roles || []);
      setCustomRole(initialData.custom_role || '');
      setTools(initialData.tools || '');
      setPortfolioUrl(initialData.portfolio_url || '');
      setDepartment(initialData.department || '');
      setBio(initialData.bio || '');
      setBankAccounts([]);
      setEwallets([]);

      // Dynamically fetch full profile details from server
      getMyProfileAction().then((res) => {
        if (res.success && res.profile) {
          const p = res.profile as any;
          if (typeof p.name === 'string') setName(p.name);
          if (typeof p.email === 'string') setEmail(p.email);
          if (typeof p.username === 'string') setUsername(p.username);
          if (typeof p.university === 'string') setUniversity(p.university);
          if (typeof p.student_id_number === 'string') setStudentIdNumber(p.student_id_number);
          if (typeof p.study_program === 'string') setStudyProgram(p.study_program);
          if (typeof p.semester === 'string') setSemester(p.semester);
          if (typeof p.whatsapp_number === 'string') setWhatsappNumber(p.whatsapp_number);
          if (typeof p.avatar_url === 'string') setAvatarUrl(p.avatar_url);
          if (p.main_roles) {
            try {
              const parsed = typeof p.main_roles === 'string' ? JSON.parse(p.main_roles) : p.main_roles;
              if (Array.isArray(parsed)) setSelectedRoles(parsed);
            } catch {}
          }
          if (typeof p.custom_role === 'string') setCustomRole(p.custom_role);
          if (typeof p.tools === 'string') setTools(p.tools);
          if (typeof p.portfolio_url === 'string') setPortfolioUrl(p.portfolio_url);
          if (typeof p.department === 'string') setDepartment(p.department);
          if (typeof p.bio === 'string') setBio(p.bio);
          if (typeof p.user_type === 'string') setUserType(p.user_type);
          if (p.financial_details) {
            try {
              const fin = typeof p.financial_details === 'string' ? JSON.parse(p.financial_details) : p.financial_details;
              if (fin) {
                if (Array.isArray(fin.bank_accounts)) setBankAccounts(fin.bank_accounts);
                if (Array.isArray(fin.ewallets)) setEwallets(fin.ewallets);
              }
            } catch {}
          }
        }
      });
    }
  }, [isOpen, initialData]);

  const addBankAccount = () => {
    if (bankAccounts.length >= 3) return;
    setBankAccounts((prev) => [...prev, { bank_name: 'BCA', account_number: '', account_name: name || '' }]);
  };

  const removeBankAccount = (index: number) => {
    setBankAccounts((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateBankAccount = (index: number, field: keyof BankAccountItem, value: string) => {
    setBankAccounts((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const addEWallet = () => {
    if (ewallets.length >= 3) return;
    setEwallets((prev) => [...prev, { provider: 'GoPay', account_number: whatsappNumber || '', account_name: name || '' }]);
  };

  const removeEWallet = (index: number) => {
    setEwallets((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateEWallet = (index: number, field: keyof EWalletItem, value: string) => {
    setEwallets((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

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
      email,
      username,
      university,
      student_id_number: studentIdNumber,
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
      financial_details: {
        bank_accounts: bankAccounts,
        ewallets: ewallets,
      },
    });

    setProfileMsg(
      res.success ? { ok: true, text: 'Profil berhasil diperbarui!' } : { ok: false, text: res.error ?? 'Gagal memperbarui profil.' }
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
      setPwMsg({ ok: false, text: res.error ?? 'Gagal mengubah password.' });
    }
    setPwLoading(false);
  };

  const inputCls =
    'w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all placeholder:text-zinc-400 font-medium';
  const labelCls =
    'block text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1 flex items-center justify-between';

  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      {/* Modal Card - WIDER DESKTOP SIZING (max-w-4xl ~ 896px) */}
      <div className="w-full max-w-4xl bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 my-auto max-h-[90vh] flex flex-col z-[1001] transition-all">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-lg">
              👤
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white tracking-tight">
                Pengaturan Profil Pengguna
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Kelola informasi data diri lengkap, detail akademik/jabatan & keamanan akun platform KIAN HQ.
              </p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white font-bold flex items-center justify-center text-sm transition-all shrink-0 hover:scale-105 active:scale-95 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 shrink-0 gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`pb-3 text-xs sm:text-sm font-black border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <span>📝 Edit Data Profil Lengkap</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('password')}
            className={`pb-3 text-xs sm:text-sm font-black border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'password'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <span>🔒 Keamanan & Ubah Password</span>
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-6">
          {activeTab === 'profile' ? (
            <form onSubmit={handleProfileSave} className="space-y-6">
              
              {/* SECTION 1: Identitas & Informasi Kontak */}
              <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50/60 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-200/60 dark:border-zinc-800/60">
                  <span className="text-base">📌</span>
                  <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                    Identitas & Akses Kontak
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>
                      <span>Nama Lengkap *</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="e.g. Syaiful Bakhri"
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className={labelCls}>
                      <span>Username (Unik)</span>
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                      placeholder="e.g. syaiful_bakhri"
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className={labelCls}>
                      <span>Nomor WhatsApp</span>
                    </label>
                    <input
                      type="text"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="e.g. 081234567890"
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>
                      <span>Email Akun *</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="name@company.com"
                      className={inputCls}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className={labelCls}>
                      <span>Foto Profil URL (Direct / Google Drive Link)</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 shrink-0 overflow-hidden flex items-center justify-center">
                        <UserAvatar src={avatarUrl} name={name || 'Avatar'} size="md" />
                      </div>
                      <input
                        type="text"
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        placeholder="https://lh3.googleusercontent.com/d/..."
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Detail Akademik / Jabatan */}
              <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50/60 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60 dark:border-zinc-800/60">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{isStaff ? '💼' : '🎓'}</span>
                    <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                      {isStaff ? 'Detail Jabatan & Divisi Staff' : 'Detail Akademik & Perguruan Tinggi'}
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                    Role: {isStaff ? 'Staff / Management' : 'OJT Intern Trooper'}
                  </span>
                </div>

                {isStaff ? (
                  <div>
                    <label className={labelCls}>Jabatan / Divisi (Department)</label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Mentor Lead Content Strategy / Head of Creative Design"
                      className={inputCls}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                      <label className={labelCls}>Universitas / Perguruan Tinggi</label>
                      <input
                        type="text"
                        value={university}
                        onChange={(e) => setUniversity(e.target.value)}
                        placeholder="e.g. Universitas Indonesia / Telkom University"
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>NIM (8 Digit Angka)</label>
                      <input
                        type="text"
                        value={studentIdNumber}
                        onChange={(e) => setStudentIdNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
                        placeholder="e.g. 12022001"
                        maxLength={8}
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Semester</label>
                      <input
                        type="text"
                        value={semester}
                        onChange={(e) => setSemester(e.target.value)}
                        placeholder="e.g. Semester 6"
                        className={inputCls}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className={labelCls}>Program Studi / Jurusan</label>
                      <input
                        type="text"
                        value={studyProgram}
                        onChange={(e) => setStudyProgram(e.target.value)}
                        placeholder="e.g. S1 Desain Komunikasi Visual / Sistem Informasi"
                        className={inputCls}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 3: Keahlian Utama, Tools & Portofolio */}
              <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50/60 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-200/60 dark:border-zinc-800/60">
                  <span className="text-base">🎨</span>
                  <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                    Keahlian Utama, Tools & Portofolio
                  </h4>
                </div>

                {/* Minat / Keahlian Utama Grid */}
                <div>
                  <label className={labelCls}>
                    <span>Minat & Keahlian Utama (Pilih 1 atau Lebih)</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-1.5">
                    {AVAILABLE_ROLES.map((r) => {
                      const isSelected = selectedRoles.includes(r.key);
                      return (
                        <button
                          key={r.key}
                          type="button"
                          onClick={() => toggleRole(r.key)}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                            isSelected
                              ? 'bg-purple-500/10 border-purple-500 shadow-md shadow-purple-500/10 text-purple-700 dark:text-purple-300 scale-[1.02]'
                              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-purple-300 dark:hover:border-purple-800'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xl">{r.emoji}</span>
                            {isSelected ? (
                              <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold">
                                ✓
                              </span>
                            ) : (
                              <span className="w-5 h-5 rounded-full border border-zinc-300 dark:border-zinc-700" />
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-black">{r.label}</p>
                            <p className="text-[10px] text-zinc-400 font-normal mt-0.5">{r.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className={labelCls}>Spesialisasi / Keahlian Lainnya</label>
                    <input
                      type="text"
                      value={customRole}
                      onChange={(e) => setCustomRole(e.target.value)}
                      placeholder="e.g. Copywriter, Branding Strategy"
                      className={inputCls}
                    />
                  </div>

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
                    <label className={labelCls}>Portofolio / Link Google Drive</label>
                    <input
                      type="text"
                      value={portfolioUrl}
                      onChange={(e) => setPortfolioUrl(e.target.value)}
                      placeholder="https://dribbble.com/username atau drive link"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: Bio / Deskripsi Diri */}
              <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50/60 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-200/60 dark:border-zinc-800/60">
                  <span className="text-base">📝</span>
                  <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                    Bio & Deskripsi Diri Ringkas
                  </h4>
                </div>

                <div>
                  <label className={labelCls}>Bio Singkat</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    placeholder={
                      isStaff
                        ? 'e.g. Mentor Divisi Video & Creative Strategy Kian HQ dengan pengalaman 5+ tahun di bidang creative industry.'
                        : 'e.g. Antusias di bidang visual design, UI/UX, & motion graphics. Selalu bersemangat mempelajari tren konten baru.'
                    }
                    className={`${inputCls} resize-none leading-relaxed`}
                  />
                </div>
              </div>

              {/* SECTION 5: Detail Keuangan (Rekening Bank & E-Wallet) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50/60 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60 dark:border-zinc-800/60">
                  <div className="flex items-center gap-2">
                    <span className="text-base">💳</span>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                        Detail Keuangan (Rekening Bank & E-Wallet)
                      </h4>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-normal">
                        Input rekening bank, e-wallet, atau keduanya (maksimal 3 per kategori).
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sub-section 1: Rekening Bank */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">🏦</span>
                      <span className="text-xs font-black uppercase text-zinc-700 dark:text-zinc-300">
                        Rekening Bank ({bankAccounts.length}/3)
                      </span>
                    </div>
                    {bankAccounts.length < 3 && (
                      <button
                        type="button"
                        onClick={addBankAccount}
                        className="px-3 py-1 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                      >
                        <span>+ Tambah Rekening Bank</span>
                      </button>
                    )}
                  </div>

                  {bankAccounts.length === 0 ? (
                    <div className="p-3 text-center bg-white dark:bg-zinc-900/60 rounded-xl border border-zinc-200/60 dark:border-zinc-800 text-[11px] text-zinc-400 italic">
                      Belum ada detail Rekening Bank ditambahkan. Klik &quot;+ Tambah Rekening Bank&quot; untuk menambahkan.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {bankAccounts.map((acc, index) => (
                        <div
                          key={index}
                          className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2.5 relative"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider">
                              Rekening Bank #{index + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeBankAccount(index)}
                              className="text-red-500 hover:text-red-600 text-xs font-bold px-2 py-0.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-all cursor-pointer"
                            >
                              Hapus 🗑️
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className={labelCls}>Nama Bank</label>
                              <select
                                value={BANK_OPTIONS.includes(acc.bank_name) ? acc.bank_name : 'Lainnya'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val !== 'Lainnya') {
                                    updateBankAccount(index, 'bank_name', val);
                                  } else {
                                    updateBankAccount(index, 'bank_name', '');
                                  }
                                }}
                                className={inputCls}
                              >
                                {BANK_OPTIONS.map((b) => (
                                  <option key={b} value={b}>
                                    {b}
                                  </option>
                                ))}
                              </select>
                              {(!BANK_OPTIONS.includes(acc.bank_name) || acc.bank_name === '') && (
                                <input
                                  type="text"
                                  value={acc.bank_name}
                                  onChange={(e) => updateBankAccount(index, 'bank_name', e.target.value)}
                                  placeholder="Ketik nama bank..."
                                  className={`${inputCls} mt-1.5`}
                                />
                              )}
                            </div>

                            <div>
                              <label className={labelCls}>Nomor Rekening</label>
                              <input
                                type="text"
                                value={acc.account_number}
                                onChange={(e) => updateBankAccount(index, 'account_number', e.target.value.replace(/[^0-9-]/g, ''))}
                                placeholder="e.g. 1234567890"
                                className={inputCls}
                              />
                            </div>

                            <div>
                              <label className={labelCls}>Atas Nama (Nama Pemilik)</label>
                              <input
                                type="text"
                                value={acc.account_name}
                                onChange={(e) => updateBankAccount(index, 'account_name', e.target.value)}
                                placeholder="e.g. Syaiful Bakhri"
                                className={inputCls}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sub-section 2: E-Wallet */}
                <div className="space-y-3 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">📱</span>
                      <span className="text-xs font-black uppercase text-zinc-700 dark:text-zinc-300">
                        E-Wallet ({ewallets.length}/3)
                      </span>
                    </div>
                    {ewallets.length < 3 && (
                      <button
                        type="button"
                        onClick={addEWallet}
                        className="px-3 py-1 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                      >
                        <span>+ Tambah E-Wallet</span>
                      </button>
                    )}
                  </div>

                  {ewallets.length === 0 ? (
                    <div className="p-3 text-center bg-white dark:bg-zinc-900/60 rounded-xl border border-zinc-200/60 dark:border-zinc-800 text-[11px] text-zinc-400 italic">
                      Belum ada detail E-Wallet ditambahkan. Klik &quot;+ Tambah E-Wallet&quot; untuk menambahkan.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {ewallets.map((wallet, index) => (
                        <div
                          key={index}
                          className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2.5 relative"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider">
                              E-Wallet #{index + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeEWallet(index)}
                              className="text-red-500 hover:text-red-600 text-xs font-bold px-2 py-0.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-all cursor-pointer"
                            >
                              Hapus 🗑️
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className={labelCls}>Penyedia (Provider)</label>
                              <select
                                value={EWALLET_OPTIONS.includes(wallet.provider) ? wallet.provider : 'Lainnya'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val !== 'Lainnya') {
                                    updateEWallet(index, 'provider', val);
                                  } else {
                                    updateEWallet(index, 'provider', '');
                                  }
                                }}
                                className={inputCls}
                              >
                                {EWALLET_OPTIONS.map((ew) => (
                                  <option key={ew} value={ew}>
                                    {ew}
                                  </option>
                                ))}
                              </select>
                              {(!EWALLET_OPTIONS.includes(wallet.provider) || wallet.provider === '') && (
                                <input
                                  type="text"
                                  value={wallet.provider}
                                  onChange={(e) => updateEWallet(index, 'provider', e.target.value)}
                                  placeholder="Ketik nama e-wallet..."
                                  className={`${inputCls} mt-1.5`}
                                />
                              )}
                            </div>

                            <div>
                              <label className={labelCls}>Nomor E-Wallet / HP</label>
                              <input
                                type="text"
                                value={wallet.account_number}
                                onChange={(e) => updateEWallet(index, 'account_number', e.target.value.replace(/[^0-9]/g, ''))}
                                placeholder="e.g. 081234567890"
                                className={inputCls}
                              />
                            </div>

                            <div>
                              <label className={labelCls}>Atas Nama (Nama Pemilik)</label>
                              <input
                                type="text"
                                value={wallet.account_name}
                                onChange={(e) => updateEWallet(index, 'account_name', e.target.value)}
                                placeholder="e.g. Syaiful Bakhri"
                                className={inputCls}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {profileMsg && (
                <div
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                    profileMsg.ok
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                  }`}
                >
                  <span>{profileMsg.ok ? '✅' : '⚠️'}</span>
                  <span>{profileMsg.text}</span>
                </div>
              )}

              {/* Action Buttons Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={profileLoading || !name.trim()}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-md shadow-purple-500/20 disabled:opacity-50 active:scale-95 cursor-pointer flex items-center gap-2"
                >
                  {profileLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Perubahan Profil</span>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* PASSWORD TAB */
            <form onSubmit={handlePasswordSave} className="space-y-4 max-w-lg mx-auto py-4">
              <div className="p-4 rounded-2xl bg-zinc-50/60 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 space-y-4">
                <div>
                  <label className={labelCls}>Password Saat Ini</label>
                  <div className="relative">
                    <input
                      type={showCurrentPw ? 'text' : 'password'}
                      value={currentPw}
                      onChange={(e) => setCurrentPw(e.target.value)}
                      required
                      placeholder="Masukkan password lama..."
                      className={inputCls + ' pr-10'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
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
                      placeholder="Minimal 6 karakter..."
                      className={inputCls + ' pr-10'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
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
                    placeholder="Ketik ulang password baru..."
                    className={`${inputCls} ${confirmPw && newPw !== confirmPw ? 'border-red-500' : ''}`}
                  />
                </div>
              </div>

              {pwMsg && (
                <div
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                    pwMsg.ok
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                  }`}
                >
                  <span>{pwMsg.ok ? '✅' : '⚠️'}</span>
                  <span>{pwMsg.text}</span>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pwLoading || !currentPw || !newPw || !confirmPw}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-md shadow-purple-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {pwLoading ? 'Menyimpan...' : 'Ubah Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
