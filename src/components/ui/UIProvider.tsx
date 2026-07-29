'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, title?: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useUI() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const toast = useCallback((message: string, type: ToastType = 'info', title?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        isOpen: true,
        options: {
          confirmText: 'Ya, Lanjutkan',
          cancelText: 'Batal',
          variant: 'danger',
          ...options,
        },
        resolve,
      });
    });
  }, []);

  const handleConfirmClose = (result: boolean) => {
    if (confirmState) {
      confirmState.resolve(result);
      setConfirmState(null);
    }
  };

  return (
    <ToastContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast Render Container */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-xl backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 ${
              t.type === 'success'
                ? 'bg-emerald-500/10 dark:bg-emerald-950/80 border-emerald-500/20 text-emerald-950 dark:text-emerald-200'
                : t.type === 'error'
                ? 'bg-red-500/10 dark:bg-red-950/80 border-red-500/20 text-red-950 dark:text-red-200'
                : t.type === 'warning'
                ? 'bg-amber-500/10 dark:bg-amber-950/80 border-amber-500/20 text-amber-950 dark:text-amber-200'
                : 'bg-indigo-500/10 dark:bg-indigo-950/80 border-indigo-500/20 text-indigo-950 dark:text-indigo-200'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {t.type === 'success' && <span className="text-lg">✅</span>}
              {t.type === 'error' && <span className="text-lg">🚨</span>}
              {t.type === 'warning' && <span className="text-lg">⚠️</span>}
              {t.type === 'info' && <span className="text-lg">ℹ️</span>}
            </div>

            <div className="flex-1 min-w-0">
              {t.title && <h5 className="font-bold text-xs mb-0.5">{t.title}</h5>}
              <p className="text-xs leading-relaxed opacity-90">{t.message}</p>
            </div>

            <button
              onClick={() => removeToast(t.id)}
              className="text-xs opacity-60 hover:opacity-100 transition-opacity p-1 -mr-1"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Confirmation Dialog Render */}
      {confirmState && confirmState.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div
                className={`p-3 rounded-2xl shrink-0 ${
                  confirmState.options.variant === 'danger'
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                    : confirmState.options.variant === 'warning'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                }`}
              >
                {confirmState.options.variant === 'danger' && (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
                {confirmState.options.variant === 'warning' && (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {confirmState.options.variant === 'info' && (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {confirmState.options.title}
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {confirmState.options.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleConfirmClose(false)}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold transition-all active:scale-[0.98]"
              >
                {confirmState.options.cancelText}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmClose(true)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-all active:scale-[0.98] ${
                  confirmState.options.variant === 'danger'
                    ? 'bg-red-600 hover:bg-red-500 shadow-red-500/20'
                    : confirmState.options.variant === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20'
                    : 'bg-purple-600 hover:bg-purple-500 shadow-purple-500/20'
                }`}
              >
                {confirmState.options.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}
