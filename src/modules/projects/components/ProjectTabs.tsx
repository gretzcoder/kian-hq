'use client';

import { useState } from 'react';
import BriefForm from '@/modules/content-brief/components/BriefForm';
import ProjectTimeline from '@/modules/timeline/components/ProjectTimeline';
import TaskActions from '@/modules/tasks/components/TaskActions';

interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  gdrive_asset_url: string | null;
  status: string;
  assigned_to: string | null;
  created_by: string;
  deadline: number | null;
  assigned_name: string | null;
  assigned_email: string | null;
  creator_name: string | null;
}

interface User {
  id: string;
  name: string;
}

interface Brief {
  audience: string | null;
  objectives: string | null;
  key_messages: string | null;
  visual_style: string | null;
}

export default function ProjectTabs({
  projectId,
  tasks,
  users,
  brief,
  canCreateTask,
  canApproveTask,
  canDeleteTask,
  canEditBrief,
  currentUserId,
  handleCreateTask,
}: {
  projectId: string;
  tasks: Task[];
  users: User[];
  brief: Brief | null;
  canCreateTask: boolean;
  canApproveTask: boolean;
  canDeleteTask: boolean;
  canEditBrief: boolean;
  currentUserId: string;
  handleCreateTask: (formData: FormData) => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<'tasks' | 'brief' | 'timeline'>('tasks');

  const taskColors: Record<string, string> = {
    TODO: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/80',
    IN_PROGRESS: 'bg-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/10 dark:border-blue-500/20',
    IN_REVIEW: 'bg-yellow-500/5 text-yellow-600 dark:text-yellow-400 border-yellow-500/10 dark:border-yellow-500/20',
    REVISION: 'bg-red-500/5 text-red-600 dark:text-red-400 border-red-500/10 dark:border-red-500/20',
    APPROVED: 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/10 dark:border-emerald-500/20',
    COMPLETED: 'bg-purple-500/5 text-purple-600 dark:text-purple-400 border-purple-500/10 dark:border-purple-500/20',
  };
  return (
    <div className="space-y-6">
      {/* Tabs Selector Bar */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-2 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-5 pb-3 text-sm font-bold border-b-2 transition-all duration-200 shrink-0 ${
            activeTab === 'tasks'
              ? 'border-purple-600 dark:border-purple-500 text-zinc-900 dark:text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          Tasks Registry ({tasks.length})
        </button>
        <button
          onClick={() => setActiveTab('brief')}
          className={`px-5 pb-3 text-sm font-bold border-b-2 transition-all duration-200 shrink-0 ${
            activeTab === 'brief'
              ? 'border-purple-600 dark:border-purple-500 text-zinc-900 dark:text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          Creative Brief
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={`px-5 pb-3 text-sm font-bold border-b-2 transition-all duration-200 shrink-0 ${
            activeTab === 'timeline'
              ? 'border-purple-600 dark:border-purple-500 text-zinc-900 dark:text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          Campaign Timeline
        </button>
      </div>

      {/* Tab Contents */}
      <div className="pt-2">
        {activeTab === 'tasks' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left Column: Tasks List */}
            <div className="lg:col-span-2 space-y-4">
              {tasks.length === 0 ? (
                <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent rounded-3xl p-12 text-center text-zinc-500">
                  No tasks created for this project yet. Define steps on the right panel.
                </div>
              ) : (
                <div className="space-y-4">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-300 shadow-sm hover:shadow-md"
                    >
                      <div className="flex flex-wrap justify-between items-start gap-4 mb-3">
                        <div>
                          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{task.title}</h3>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                            {task.description || 'No description provided.'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wider border ${
                              taskColors[task.status] || taskColors.TODO
                            }`}
                          >
                            {task.status}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider mt-4">
                        <div>
                          Owner:{' '}
                          <span className="text-zinc-700 dark:text-zinc-300 font-bold">
                            {task.assigned_name || 'Unassigned'}
                          </span>
                        </div>
                        {task.deadline && (
                          <div className="font-mono">
                            Due:{' '}
                            <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                              {new Date(task.deadline).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Client-side action trigger component */}
                      <TaskActions
                        task={task}
                        currentUserId={currentUserId}
                        canApprove={canApproveTask}
                        canDelete={canDeleteTask}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Creation Form Panel */}
            {canCreateTask ? (
              <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm">
                <h2 className="text-lg font-bold mb-1 text-zinc-900 dark:text-zinc-100">Create Task</h2>
                <p className="text-zinc-500 dark:text-zinc-500 text-xs mb-6">Define a job step, select an owner, and specify a deadline.</p>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const formData = new FormData(form);
                    await handleCreateTask(formData);
                    form.reset();
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                      Task Title
                    </label>
                    <input
                      type="text"
                      name="title"
                      required
                      placeholder="e.g. Design Thumbnail Mockup"
                      className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all duration-200"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                      Description
                    </label>
                    <textarea
                      name="description"
                      rows={3}
                      placeholder="Explain details or creative direction..."
                      className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all resize-none duration-200"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                      Assign To
                    </label>
                    <select
                      name="assignedTo"
                      className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-500 dark:text-zinc-400 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all cursor-pointer duration-200"
                    >
                      <option value="">Unassigned (Open for Claim)</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                      Deadline
                    </label>
                    <input
                      type="date"
                      name="deadline"
                      className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all text-zinc-500 dark:text-zinc-400 duration-200 cursor-pointer"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all duration-300 shadow-[0_4px_16px_rgba(147,51,234,0.15)] hover:shadow-[0_4px_20px_rgba(147,51,234,0.25)] active:scale-[0.98] mt-4"
                  >
                    Create Task
                  </button>
                </form>
              </div>
            ) : (
              <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 text-center text-zinc-500 text-xs shadow-sm">
                🔒 You do not have permissions to append tasks.
              </div>
            )}
          </div>
        )}

        {activeTab === 'brief' && (
          <BriefForm
            projectId={projectId}
            brief={brief}
            canEdit={canEditBrief}
          />
        )}

        {activeTab === 'timeline' && (
          <ProjectTimeline tasks={tasks} />
        )}
      </div>
    </div>
  );
}
