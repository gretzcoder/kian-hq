'use client';

import { useState } from 'react';
import { createRoleAction, updateRoleAction, deleteRoleAction } from '../actions';

interface Role {
  id: string;
  name: string;
  description: string | null;
  color?: string | null;
}

const PRESET_COLORS = [
  '#8B5CF6', // Purple
  '#3B82F6', // Blue
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#06B6D4', // Cyan
  '#F43F5E', // Rose
  '#EC4899', // Pink
  '#EAB308', // Yellow
];

export default function RoleSettingsPanel({ roles }: { roles: Role[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states for creating role
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#8B5CF6');

  // Editing state
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editColor, setEditColor] = useState('#8B5CF6');

  const protectedRoles = [
    'role_executive',
    'role_coordinator',
    'role_creator',
    'role_collaborator',
    'role_mentor_troopers',
    'role_troopers',
  ];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await createRoleAction(name.trim(), description.trim(), color);
      if (res.success) {
        setName('');
        setDescription('');
        setColor('#8B5CF6');
        setSuccess('Role created successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(res.error ?? 'Failed to create role.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (roleId: string) => {
    if (!editName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await updateRoleAction(roleId, editName.trim(), editDesc.trim(), editColor);
      if (res.success) {
        setEditingRoleId(null);
        setSuccess('Role updated successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(res.error ?? 'Failed to update role.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (roleId: string, roleName: string) => {
    if (!confirm(`Are you sure you want to delete the role "${roleName}"? This will delete its permission maps and user role assignments.`)) return;

    setLoading(true);
    setError(null);
    try {
      const res = await deleteRoleAction(roleId);
      if (res.success) {
        setSuccess('Role deleted successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(res.error ?? 'Failed to delete role.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* List Roles */}
      <div className="xl:col-span-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Roles Management</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Create, edit, or customize colors for system & custom roles.
          </p>
        </div>

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-3">
            {error}
          </p>
        )}
        {success && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-4 py-3">
            ✓ {success}
          </p>
        )}

        <div className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
          {roles.map((role) => {
            const isProtected = protectedRoles.includes(role.id);
            const isEditing = editingRoleId === role.id;
            const activeColor = role.color || '#8B5CF6';

            return (
              <div key={role.id} className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                {isEditing ? (
                  <div className="flex-1 space-y-3 bg-zinc-50 dark:bg-zinc-900/60 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <div>
                      <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Nama Role</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Role Name"
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl px-3 py-2 focus:outline-none transition-all font-bold uppercase tracking-wider"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Deskripsi</label>
                      <input
                        type="text"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Role Description"
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl px-3 py-2 focus:outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Warna Role (Hex / Picker)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          className="w-9 h-9 rounded-xl border border-zinc-300 dark:border-zinc-700 cursor-pointer bg-transparent p-0.5"
                        />
                        <input
                          type="text"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          placeholder="#8B5CF6"
                          className="w-32 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-mono font-bold rounded-xl px-3 py-2 focus:outline-none uppercase text-zinc-900 dark:text-zinc-100"
                        />
                        <div className="flex items-center gap-1 overflow-x-auto">
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setEditColor(c)}
                              className={`w-6 h-6 rounded-full border transition-all ${editColor === c ? 'scale-110 ring-2 ring-purple-500' : 'opacity-80 hover:opacity-100'}`}
                              style={{ backgroundColor: c, borderColor: `${c}80` }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="inline-block text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border"
                        style={{
                          backgroundColor: `${activeColor}1a`,
                          borderColor: `${activeColor}40`,
                          color: activeColor,
                        }}
                      >
                        {role.name}
                      </span>
                      {isProtected && (
                        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-600 bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200/40 dark:border-zinc-700/40 px-2 py-0.5 rounded-md">
                          System Role
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      {role.description || 'No description provided.'}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2 shrink-0">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => handleUpdate(role.id)}
                        disabled={loading}
                        className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all"
                      >
                        Simpan
                      </button>
                      <button
                        onClick={() => setEditingRoleId(null)}
                        className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-bold text-xs px-3.5 py-2 rounded-xl transition-all"
                      >
                        Batal
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingRoleId(role.id);
                          setEditName(role.name);
                          setEditDesc(role.description || '');
                          setEditColor(role.color || '#8B5CF6');
                        }}
                        className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-xs px-3.5 py-1.5 rounded-xl transition-all"
                      >
                        Edit
                      </button>
                      {!isProtected && (
                        <button
                          onClick={() => handleDelete(role.id, role.name)}
                          disabled={loading}
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs px-3.5 py-1.5 rounded-xl transition-all"
                        >
                          Delete
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Custom Role */}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Create New Role</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Define a custom role with a unique clearance tier and custom color.
          </p>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Role Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. VIDEOGRAPHER"
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl px-3 py-2.5 focus:outline-none transition-all uppercase tracking-wider font-bold"
            />
          </div>

          <div>
            <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Description</label>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the scope of this role..."
              rows={3}
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-xs rounded-xl px-3 py-2.5 focus:outline-none transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Pilihan Warna Role</label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-9 h-9 rounded-xl border border-zinc-300 dark:border-zinc-700 cursor-pointer bg-transparent p-0.5"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#8B5CF6"
                className="w-32 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-mono font-bold rounded-xl px-3 py-2 focus:outline-none uppercase text-zinc-900 dark:text-zinc-100"
              />
              <span
                className="text-[10px] font-black uppercase px-3 py-1.5 rounded-full border ml-auto"
                style={{
                  backgroundColor: `${color}1a`,
                  borderColor: `${color}40`,
                  color: color,
                }}
              >
                {name.trim() || 'PREVIEW'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border transition-all ${color === c ? 'scale-110 ring-2 ring-purple-500' : 'opacity-80 hover:opacity-100'}`}
                  style={{ backgroundColor: c, borderColor: `${c}80` }}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-2.5 rounded-xl transition-all disabled:opacity-60 active:scale-[0.98]"
          >
            {loading ? 'Creating...' : '+ Create Role'}
          </button>
        </form>
      </div>
    </div>
  );
}
