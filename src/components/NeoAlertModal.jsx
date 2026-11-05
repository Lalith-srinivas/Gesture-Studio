import React, { useEffect } from 'react';

export default function NeoAlertModal({ popup, onClose }) {
  useEffect(() => {
    if (!popup) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [popup, onClose]);

  if (!popup) return null;

  const {
    title,
    message,
    type = 'info',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
  } = popup;

  const handleConfirm = () => {
    onClose?.();
    if (onConfirm) onConfirm();
  };

  const getBadge = () => {
    switch (type) {
      case 'warning':
        return {
          bg: 'bg-neo-yellow text-black',
          icon: '⚠️',
          label: 'ALERT'
        };
      case 'error':
        return {
          bg: 'bg-neo-red text-white',
          icon: '❌',
          label: 'ERROR'
        };
      case 'success':
        return {
          bg: 'bg-neo-lime text-black',
          icon: '✓',
          label: 'SUCCESS'
        };
      case 'confirm':
        return {
          bg: 'bg-neo-pink text-black',
          icon: '❓',
          label: 'CONFIRMATION'
        };
      default:
        return {
          bg: 'bg-[#6366F1] text-white',
          icon: 'ℹ️',
          label: 'NOTICE'
        };
    }
  };

  const badge = getBadge();
  const isConfirm = type === 'confirm' || Boolean(onConfirm);

  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none">
      <div className="bg-[#FFFDF5] border-3 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] max-w-sm w-full p-5 sm:p-6 text-center relative animate-in zoom-in-95 duration-150">
        
        {/* Header Badge */}
        <div className="mb-2">
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 border border-black font-mono font-black text-[11px] uppercase shadow-xs ${badge.bg}`}>
            <span>{badge.icon}</span>
            <span>{badge.label}</span>
          </span>
        </div>

        {/* Title */}
        {title && (
          <h3 className="font-display font-black text-xl uppercase tracking-tight text-black mt-2 mb-1.5 leading-tight">
            {title}
          </h3>
        )}

        {/* Message */}
        <p className="font-mono text-xs sm:text-sm text-zinc-700 leading-relaxed my-3 break-words">
          {message}
        </p>

        {/* Action Buttons */}
        <div className="mt-5 flex gap-2">
          {isConfirm ? (
            <>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-2.5 bg-neo-red text-white hover:bg-rose-600 border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm active:translate-y-0.5 transition-all cursor-pointer"
              >
                {confirmText}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-white hover:bg-zinc-100 border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm active:translate-y-0.5 transition-all cursor-pointer"
              >
                {cancelText}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-neo-lime hover:bg-lime-300 border-2 border-black font-mono font-black text-xs uppercase shadow-neo-sm active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>✓</span>
              <span>GOT IT</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

