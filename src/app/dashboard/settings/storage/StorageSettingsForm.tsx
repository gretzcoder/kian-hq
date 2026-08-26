'use client';

import { useState } from 'react';
import { StorageSettings, updateStorageSettings, testStorageConnectionAction } from '@/modules/storage/actions';

interface StorageSettingsFormProps {
  initialSettings: StorageSettings;
}

export default function StorageSettingsForm({ initialSettings }: StorageSettingsFormProps) {
  const [enabled, setEnabled] = useState(initialSettings.gdrive_enabled);
  const [clientEmail, setClientEmail] = useState(initialSettings.gdrive_client_email);
  const [privateKey, setPrivateKey] = useState(
    initialSettings.gdrive_private_key ? '••••••••••••••••••••••••••••••••' : ''
  );
  const [rootFolderId, setRootFolderId] = useState(initialSettings.gdrive_root_folder_id);
  const [avatarsFolderId, setAvatarsFolderId] = useState(initialSettings.gdrive_avatars_folder_id);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  const handleTestConnection = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const res = await testStorageConnectionAction({
        client_email: clientEmail,
        private_key: privateKey,
        root_folder_id: rootFolderId,
      });

      if (res.success) {
        setMessage({ type: 'success', text: `✅ ${res.message}` });
      } else {
        setMessage({ type: 'error', text: `❌ ${res.message}` });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: `❌ Test Koneksi Gagal: ${err.message}` });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const formData = new FormData();
    formData.set('gdrive_enabled', enabled ? 'true' : 'false');
    formData.set('gdrive_client_email', clientEmail);
    formData.set('gdrive_private_key', privateKey);
    formData.set('gdrive_root_folder_id', rootFolderId);
    formData.set('gdrive_avatars_folder_id', avatarsFolderId);

    try {
      const res = await updateStorageSettings(formData);
      if (res.success) {
        setMessage({ type: 'success', text: '✨ Pengaturan Storage Google Drive berhasil disimpan!' });
      } else {
        setMessage({ type: 'error', text: `⚠️ ${res.error || 'Gagal menyimpan pengaturan.'}` });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: `⚠️ Kesalahan sistem: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {message && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold transition-all flex items-center justify-between gap-3 ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20'
          }`}
        >
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} className="text-zinc-400 hover:text-zinc-600">
            ✕
          </button>
        </div>
      )}

      {/* Storage Configuration Form */}
      <form onSubmit={handleSubmit} className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
        {/* Toggle Switch */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800">
          <div>
            <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>Aktifkan Storage Google Drive</span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Jika aktif, pengguna dapat mengunggah file submit karya atau foto profil langsung ke Google Drive.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setEnabled((p) => !p)}
            className={`w-12 h-6 rounded-full transition-colors relative focus:outline-none ${
              enabled ? 'bg-purple-600' : 'bg-zinc-300 dark:bg-zinc-700'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Credentials Inputs */}
        <div className="space-y-4">
          <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            🔑 Google Service Account Credentials
          </h4>

          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Service Account Client Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="kian-hq-storage@project-id.iam.gserviceaccount.com"
              required={enabled}
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-purple-500 font-mono transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Service Account RSA Private Key (PEM Format) <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----"
              required={enabled}
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-purple-500 font-mono transition-all"
            />
          </div>
        </div>

        {/* Folder IDs Inputs */}
        <div className="space-y-4 pt-2">
          <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            📁 Folder Google Drive Destination
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Default Root Folder ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={rootFolderId}
                onChange={(e) => setRootFolderId(e.target.value)}
                placeholder="Paste Folder ID dari URL Google Drive..."
                required={enabled}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-purple-500 font-mono transition-all"
              />
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">
                Folder utama pengumpulan hasil karya tim/workspace.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Folder Profile Avatars ID (Opsional)
              </label>
              <input
                type="text"
                value={avatarsFolderId}
                onChange={(e) => setAvatarsFolderId(e.target.value)}
                placeholder="Paste Folder ID khusus Foto Profil..."
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-purple-500 font-mono transition-all"
              />
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">
                Folder khusus untuk menyimpan foto avatar pengguna.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing || !clientEmail}
            className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all disabled:opacity-50"
          >
            {testing ? '⚡ Menguji...' : '🔍 Test Koneksi Google Drive'}
          </button>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 text-xs font-black px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-md shadow-purple-500/20 disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : '💾 Simpan Pengaturan Storage'}
          </button>
        </div>
      </form>

      {/* Guide Collapsible */}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 rounded-3xl overflow-hidden text-xs">
        <button
          type="button"
          onClick={() => setShowGuide((p) => !p)}
          className="w-full text-left p-4.5 font-bold flex items-center justify-between text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span>📖</span>
            <span>Panduan Membuat Google Drive Service Account</span>
          </div>
          <span>{showGuide ? '▲ Tutup' : '▼ Lihat Panduan'}</span>
        </button>

        {showGuide && (
          <div className="p-5 border-t border-zinc-200 dark:border-zinc-800 space-y-3 text-zinc-600 dark:text-zinc-400 leading-relaxed">
            <ol className="list-decimal list-inside space-y-2">
              <li>Buka <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-purple-600 dark:text-purple-400 font-bold underline">Google Cloud Console</a> dan buat Project baru.</li>
              <li>Aktifkan API <strong>Google Drive API</strong> di menu <em>APIs & Services &gt; Library</em>.</li>
              <li>Buka <em>APIs & Services &gt; Credentials</em>, klik <strong>Create Credentials &gt; Service Account</strong>.</li>
              <li>Buat Service Account, kemudian di tab <strong>Keys</strong>, klik <em>Add Key &gt; Create new key (JSON)</em>.</li>
              <li>Buka file JSON hasil download: copy <code>client_email</code> ke field Email, dan copy seluruh teks <code>private_key</code> ke field Private Key.</li>
              <li><strong>PENTING:</strong> Buka folder target di Google Drive Anda, klik <strong>Bagikan (Share)</strong>, lalu tambahkan <code>client_email</code> Service Account sebagai <strong>Editor</strong> agar Service Account dapat meng-upload file ke folder tersebut.</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
