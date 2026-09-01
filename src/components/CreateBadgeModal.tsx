'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  BadgeCategory,
  BadgeItem,
  CATEGORY_META,
  RECOMMENDED_CATEGORY_SPARKS,
  RequirementType,
  AchievementConditionItem,
} from '@/modules/badges/badgeTypes';
import { createBadgeAction, updateBadgeAction, getBadgeRequirementOptions } from '@/modules/badges/badgeActions';

interface CreateBadgeModalProps {
  editBadge?: BadgeItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateBadgeModal({
  editBadge,
  isOpen,
  onClose,
  onSuccess,
}: CreateBadgeModalProps) {
  const isEditing = Boolean(editBadge);

  const [name, setName] = useState(editBadge?.name || '');
  const [category, setCategory] = useState<BadgeCategory>(editBadge?.category || 'ACHIEVEMENT');
  const [description, setDescription] = useState(editBadge?.description || '');
  const [iconMode, setIconMode] = useState<'URL' | 'FILE'>('URL');
  const [iconUrl, setIconUrl] = useState(editBadge?.iconUrl || '');
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [requirementType, setRequirementType] = useState<RequirementType>(editBadge?.requirementType || 'ACHIEVEMENT');
  const [selectedReqIds, setSelectedReqIds] = useState<string[]>(
    editBadge?.requirementType === 'TASK' || editBadge?.requirementType === 'WORKSPACE'
      ? (editBadge.requirementData as string[]) || []
      : []
  );

  const [achievementConditions, setAchievementConditions] = useState<AchievementConditionItem[]>(() => {
    if (editBadge?.requirementType === 'ACHIEVEMENT' && Array.isArray(editBadge.requirementData) && editBadge.requirementData.length > 0) {
      return editBadge.requirementData as AchievementConditionItem[];
    }
    return [{ id: 'cond_1', category: 'CHAMPION', minCount: 1, conditionType: 'COUNT', periodType: 'ANY' }];
  });

  const [isContinuousEarning, setIsContinuousEarning] = useState<boolean>(editBadge?.isContinuousEarning ?? false);
  const [sparksReward, setSparksReward] = useState<number>(editBadge ? editBadge.sparksReward : RECOMMENDED_CATEGORY_SPARKS.ACHIEVEMENT);
  const [isCustomSparks, setIsCustomSparks] = useState<boolean>(Boolean(editBadge));

  const [options, setOptions] = useState<{
    tasks: { id: string; title: string; workspaceName: string }[];
    workspaces: { id: string; name: string }[];
  }>({ tasks: [], workspaces: [] });

  const [loadingOptions, setLoadingOptions] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLoadingOptions(true);
      getBadgeRequirementOptions().then((res) => {
        setOptions({ tasks: res.tasks, workspaces: res.workspaces });
        setLoadingOptions(false);
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (editBadge) {
      setName(editBadge.name);
      setCategory(editBadge.category);
      setDescription(editBadge.description || '');
      setIconUrl(editBadge.iconUrl || '');
      setRequirementType(editBadge.requirementType);
      if (editBadge.requirementType === 'ACHIEVEMENT' && Array.isArray(editBadge.requirementData)) {
        setAchievementConditions(editBadge.requirementData as AchievementConditionItem[]);
      } else if (Array.isArray(editBadge.requirementData)) {
        setSelectedReqIds(editBadge.requirementData as string[]);
      }
      setIsContinuousEarning(editBadge.isContinuousEarning ?? false);
      setSparksReward(editBadge.sparksReward);
      setIsCustomSparks(true);
    }
  }, [editBadge]);

  const handleCategorySelect = (cat: BadgeCategory) => {
    setCategory(cat);
    if (cat === 'ACHIEVEMENT') {
      setRequirementType('ACHIEVEMENT');
    }
    if (!isCustomSparks) {
      setSparksReward(RECOMMENDED_CATEGORY_SPARKS[cat] || 25);
    }
  };

  if (!isOpen) return null;

  const handleToggleReqId = (id: string) => {
    setSelectedReqIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAddCondition = () => {
    setAchievementConditions((prev) => [
      ...prev,
      {
        id: `cond_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        category: 'CHAMPION',
        minCount: 1,
        conditionType: 'COUNT',
        periodType: 'ANY',
      },
    ]);
  };

  const handleUpdateCondition = (id: string, field: keyof AchievementConditionItem, value: any) => {
    setAchievementConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleRemoveCondition = (id: string) => {
    setAchievementConditions((prev) => (prev.length > 1 ? prev.filter((c) => c.id !== id) : prev));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nama badge wajib diisi.');
      return;
    }

    setError(null);
    const formData = new FormData();
    formData.append('name', name.trim());
    formData.append('category', category);
    formData.append('description', description.trim());
    formData.append('requirement_type', requirementType);

    if (requirementType === 'ACHIEVEMENT') {
      formData.append('requirement_data', JSON.stringify(achievementConditions));
    } else {
      formData.append('requirement_data', JSON.stringify(selectedReqIds));
    }

    formData.append('is_continuous_earning', isContinuousEarning ? '1' : '0');
    formData.append('sparks_reward', String(sparksReward));

    if (iconMode === 'URL' && iconUrl.trim()) {
      formData.append('icon_url', iconUrl.trim());
    } else if (iconMode === 'FILE' && iconFile) {
      formData.append('icon_file', iconFile);
    }

    startTransition(async () => {
      const res = isEditing && editBadge
        ? await updateBadgeAction(editBadge.id, formData)
        : await createBadgeAction(formData);

      if (res.success) {
        onSuccess();
        onClose();
        if (typeof window !== 'undefined') window.location.reload();
      } else {
        setError(res.error || 'Gagal menyimpan badge.');
      }
    });
  };

  const catMeta = CATEGORY_META[category] || CATEGORY_META.ACHIEVEMENT;

  const achievementCategoryOptions = [
    { id: 'CHAMPION', label: '🏆 Champion (Juara Umum)' },
    { id: 'PRODUCTIVE', label: '⚡ Most Productive' },
    { id: 'QUALITY', label: '🎯 High Quality' },
    { id: 'WORKSPACE', label: '🏢 Top Workspaces' },
    { id: 'TEAM_LEADER', label: '👑 Team Leaders' },
    { id: 'DESIGNER', label: '🎨 Designers' },
    { id: 'VIDEO_EDITOR', label: '🎬 Video Editors' },
    { id: 'PLANNER', label: '🧠 Planners' },
    { id: 'RESEARCHER', label: '🔍 Researchers' },
    { id: 'ALL', label: '🌟 Semua Kategori Gelar' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{isEditing ? '✏️' : '🏆'}</span>
            <div>
              <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100">
                {isEditing ? 'Edit Badge' : 'Buat Badge Baru'}
              </h3>
              <p className="text-[10px] text-zinc-500 font-bold dark:text-zinc-400">
                Atur kategori, logo, deskripsi, dan syarat kelayakan badge
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-500 flex items-center justify-center text-xs font-bold transition-all"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-bold">
              ⚠️ {error}
            </div>
          )}

          {/* Nama Badge */}
          <div>
            <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1.5">
              Nama Badge <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: 10x Champion Master, Elite Multi-Role Winner"
              required
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-zinc-100 font-bold focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Kategori Badge */}
          <div>
            <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1.5">
              Kategori Badge <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(CATEGORY_META) as BadgeCategory[]).map((cat) => {
                const meta = CATEGORY_META[cat];
                const isSelected = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategorySelect(cat)}
                    className={`p-2.5 rounded-2xl border text-left flex items-center gap-2 transition-all ${
                      isSelected
                        ? `bg-gradient-to-r ${meta.bgGradient} ${meta.border} text-zinc-900 dark:text-zinc-100 font-black shadow-sm ring-2 ring-purple-500/30`
                        : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300'
                    }`}
                  >
                    <span className="text-xl">{meta.icon}</span>
                    <span className="text-[11px] truncate">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reward Sparks (Bonus) */}
          <div className="space-y-2 bg-purple-500/5 dark:bg-purple-950/20 p-3.5 rounded-2xl border border-purple-500/20">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider">
                ✨ Reward Creative Sparks (Bonus User)
              </label>
              <span className="text-[10px] font-bold text-amber-500 font-mono">
                💡 Rekomendasi: +{RECOMMENDED_CATEGORY_SPARKS[category] || 25} Sparks
              </span>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={10000}
                value={sparksReward}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setSparksReward(isNaN(val) ? 0 : Math.max(0, val));
                  setIsCustomSparks(true);
                }}
                className="w-32 bg-white dark:bg-zinc-900 border border-purple-500/30 rounded-xl px-3 py-2 text-zinc-900 dark:text-zinc-100 font-black text-sm focus:outline-none focus:border-purple-500 font-mono"
              />
              <span className="text-xs font-bold text-zinc-500">Creative Sparks ✨</span>
            </div>

            {/* Quick recommendation buttons */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] text-zinc-400 font-bold">Pilih Cepat:</span>
              {[0, 10, 15, 20, 25, 35, 50].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => {
                    setSparksReward(amount);
                    setIsCustomSparks(true);
                  }}
                  className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                    sparksReward === amount
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:border-purple-500/40'
                  }`}
                >
                  {amount === 0 ? '0 ✨' : `+${amount} ✨`}
                </button>
              ))}
            </div>
          </div>

          {/* Deskripsi */}
          <div>
            <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1.5">
              Deskripsi Badge
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Penjelasan singkat mengenai pencapaian atau kehormatan badge ini..."
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          {/* Input Logo / Icon */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                Logo / Icon Badge (Opsional)
              </label>
              <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setIconMode('URL')}
                  className={`px-2.5 py-0.5 rounded-md transition-all ${iconMode === 'URL' ? 'bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 shadow-xs' : 'text-zinc-400'}`}
                >
                  Link URL
                </button>
                <button
                  type="button"
                  onClick={() => setIconMode('FILE')}
                  className={`px-2.5 py-0.5 rounded-md transition-all ${iconMode === 'FILE' ? 'bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 shadow-xs' : 'text-zinc-400'}`}
                >
                  Upload File
                </button>
              </div>
            </div>

            {iconMode === 'URL' ? (
              <input
                type="url"
                value={iconUrl}
                onChange={(e) => setIconUrl(e.target.value)}
                placeholder="https://example.com/badge-icon.png (Kosongkan jika ingin pakai icon bawaan)"
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-900 dark:text-zinc-100 font-mono text-xs focus:outline-none focus:border-purple-500"
              />
            ) : (
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setIconFile(e.target.files?.[0] || null)}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:border-purple-500"
              />
            )}
            <p className="text-[10px] text-zinc-400">
              *Jika dikosongkan, sistem akan otomatis menggunakan icon khas kategori <strong>{catMeta.icon} {catMeta.label}</strong>.
            </p>
          </div>

          {/* Jenis Syarat Kelayakan */}
          <div>
            <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1.5">
              Syarat Kelayakan Dapatkan Badge
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setRequirementType('ACHIEVEMENT')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  requirementType === 'ACHIEVEMENT'
                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400 font-bold shadow-xs'
                    : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-500'
                }`}
              >
                <p className="font-bold text-xs">🏆 Achievement</p>
                <p className="text-[9px] opacity-80 mt-0.5">Syarat juara & streak Leaderboard</p>
              </button>

              <button
                type="button"
                onClick={() => { setRequirementType('NONE'); setSelectedReqIds([]); }}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  requirementType === 'NONE'
                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400 font-bold shadow-xs'
                    : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-500'
                }`}
              >
                <p className="font-bold text-xs">✨ Tanpa Syarat</p>
                <p className="text-[9px] opacity-80 mt-0.5">Manual oleh Mentor/Admin</p>
              </button>

              <button
                type="button"
                onClick={() => { setRequirementType('TASK'); setSelectedReqIds([]); }}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  requirementType === 'TASK'
                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400 font-bold shadow-xs'
                    : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-500'
                }`}
              >
                <p className="font-bold text-xs">📋 Task Tertentu</p>
                <p className="text-[9px] opacity-80 mt-0.5">Pilih 1 atau lebih task</p>
              </button>

              <button
                type="button"
                onClick={() => { setRequirementType('WORKSPACE'); setSelectedReqIds([]); }}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  requirementType === 'WORKSPACE'
                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400 font-bold shadow-xs'
                    : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-500'
                }`}
              >
                <p className="font-bold text-xs">📁 Workspace</p>
                <p className="text-[9px] opacity-80 mt-0.5">Semua task workspace</p>
              </button>
            </div>
          </div>

          {/* Syarat Achievement Configurator */}
          {requirementType === 'ACHIEVEMENT' && (
            <div className="space-y-3 bg-gradient-to-br from-purple-500/5 via-indigo-500/5 to-amber-500/5 dark:from-purple-950/30 dark:to-indigo-950/20 p-4 rounded-2xl border border-purple-500/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider flex items-center gap-1.5">
                  <span>🏆 Atur Syarat Pencapaian Gelar Leaderboard</span>
                </span>
                <button
                  type="button"
                  onClick={handleAddCondition}
                  className="px-2.5 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold transition-all shadow-xs cursor-pointer"
                >
                  + Tambah Syarat
                </button>
              </div>

              {achievementConditions.map((cond, index) => (
                <div key={cond.id || index} className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2 relative group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-500">Syarat #{index + 1}</span>
                    {achievementConditions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCondition(cond.id)}
                        className="text-[10px] font-bold text-rose-500 hover:underline"
                      >
                        🗑️ Hapus
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Kategori Gelar */}
                    <div>
                      <label className="block text-[9px] font-bold text-zinc-400 mb-1">Kategori Gelar</label>
                      <select
                        value={cond.category}
                        onChange={(e) => handleUpdateCondition(cond.id, 'category', e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-bold"
                      >
                        {achievementCategoryOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Tipe Hitungan */}
                    <div>
                      <label className="block text-[9px] font-bold text-zinc-400 mb-1">Tipe Hitungan</label>
                      <select
                        value={cond.conditionType}
                        onChange={(e) => handleUpdateCondition(cond.id, 'conditionType', e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-bold"
                      >
                        <option value="COUNT">📊 Total Menang (Kumulatif)</option>
                        <option value="STREAK">🔥 Streak Beruntun (Consecutive)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    {/* Minimum Jumlah Wins / Streak */}
                    <div>
                      <label className="block text-[9px] font-bold text-zinc-400 mb-1">Minimal Jumlah Pencapaian</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={cond.minCount}
                          onChange={(e) => handleUpdateCondition(cond.id, 'minCount', Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-full text-xs p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-black font-mono"
                        />
                      </div>
                    </div>

                    {/* Periode Check */}
                    <div>
                      <label className="block text-[9px] font-bold text-zinc-400 mb-1">Filter Periode</label>
                      <select
                        value={cond.periodType || 'ANY'}
                        onChange={(e) => handleUpdateCondition(cond.id, 'periodType', e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-bold"
                      >
                        <option value="ANY">🗓️ Semua Periode</option>
                        <option value="WEEKLY">🗓️ Weekly Only</option>
                        <option value="MONTHLY">📅 Monthly Only</option>
                      </select>
                    </div>

                    {/* Mulai Tanggal Cutoff */}
                    <div>
                      <label className="block text-[9px] font-bold text-purple-600 dark:text-purple-400 mb-1" title="Pencapaian sebelum tanggal ini diabaikan">
                        📅 Mulai Tanggal (Cutoff)
                      </label>
                      <input
                        type="date"
                        value={cond.startDate || ''}
                        onChange={(e) => handleUpdateCondition(cond.id, 'startDate', e.target.value)}
                        className="w-full text-xs p-1.5 rounded-lg border border-purple-500/30 bg-zinc-50 dark:bg-zinc-800 font-bold text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Toggle Continuous Earning */}
              <div className="pt-2 border-t border-purple-500/20">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isContinuousEarning}
                    onChange={(e) => setIsContinuousEarning(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 mt-0.5"
                  />
                  <div>
                    <p className="text-xs font-black text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                      <span>🔄 Continuous Earning</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-500/10 border border-purple-500/20">Auto-Reward Sparks</span>
                    </p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                      Otomatis memberikan reward <strong>+{sparksReward} Sparks</strong> setiap kali pengguna mencapai gelar juara lagi di periode berikutnya tanpa perlu membuat badge baru.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Searchable Picker for Task / Workspace Requirement */}
          {(requirementType === 'TASK' || requirementType === 'WORKSPACE') && (
            <div className="space-y-2 bg-zinc-50 dark:bg-zinc-900/50 p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider">
                  Pilih {requirementType === 'TASK' ? 'Tugas Syarat' : 'Workspace Syarat'} ({selectedReqIds.length} terpilih)
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari..."
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 text-[10px] rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              </div>

              {loadingOptions ? (
                <p className="text-center py-4 text-zinc-400 font-bold">Memuat daftar pilihan...</p>
              ) : (
                <div className="max-h-44 overflow-y-auto divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                  {requirementType === 'TASK' ? (
                    options.tasks
                      .filter((t) => t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.workspaceName.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((t) => {
                        const isChecked = selectedReqIds.includes(t.id);
                        return (
                          <label
                            key={t.id}
                            className="flex items-center justify-between py-2 px-2 hover:bg-purple-500/5 rounded-lg cursor-pointer text-xs"
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate">{t.title}</p>
                              <p className="text-[9px] text-zinc-400 truncate">{t.workspaceName}</p>
                            </div>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleReqId(t.id)}
                              className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                            />
                          </label>
                        );
                      })
                  ) : (
                    options.workspaces
                      .filter((w) => w.name.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((w) => {
                        const isChecked = selectedReqIds.includes(w.id);
                        return (
                          <label
                            key={w.id}
                            className="flex items-center justify-between py-2 px-2 hover:bg-purple-500/5 rounded-lg cursor-pointer text-xs"
                          >
                            <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate">{w.name}</span>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleReqId(w.id)}
                              className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                            />
                          </label>
                        );
                      })
                  )}
                </div>
              )}
            </div>
          )}

          {/* Footer Submit Buttons */}
          <div className="flex gap-2 pt-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="flex-1 py-2.5 text-xs font-bold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-zinc-600 dark:text-zinc-400"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 py-2.5 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-all shadow-md shadow-purple-500/20 disabled:opacity-60"
            >
              {pending ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : 'Buat Badge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
