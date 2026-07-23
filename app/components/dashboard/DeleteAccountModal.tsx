"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, X } from "lucide-react";

interface DeleteAccountModalProps {
  email: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteAccountModal({ email, onClose, onConfirm }: DeleteAccountModalProps) {
  const [input, setInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = input.trim().toLowerCase() === email.toLowerCase();

  const handleConfirm = async () => {
    if (!matches || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await onConfirm();
    } catch {
      setError("Something went wrong while deleting your account. Please try again.");
      setDeleting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={deleting ? undefined : onClose}
    >
      <div
        className="bg-white rounded-[2rem] shadow-2xl border border-[rgba(196,154,60,0.2)] max-w-md w-full p-6 md:p-8 space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3
              className="font-bold text-lg text-[#1c1917]"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Delete account
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={deleting}
            className="text-[#78716c] hover:text-[#1c1917] transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-[#78716c] leading-relaxed">
          This will permanently delete your account and all associated data. This action cannot be undone.
          To confirm, type <span className="font-bold text-[#1c1917]">{email}</span> below.
        </p>

        <div>
          <label className="block text-[10px] font-bold text-[#78716c] uppercase tracking-wider mb-1.5">
            Email address
          </label>
          <input
            type="email"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={email}
            disabled={deleting}
            autoFocus
            className="w-full h-11 px-3.5 rounded-xl bg-white border border-[rgba(196,154,60,0.3)] text-[#1c1917] text-sm font-semibold placeholder:text-[#C4BBA6] placeholder:font-normal outline-none focus:ring-4 focus:ring-rose-50 focus:border-rose-300 transition-all disabled:opacity-50"
          />
        </div>

        {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-[#78716c] hover:text-[#1c1917] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!matches || deleting}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-rose-700 transition-colors disabled:opacity-40 disabled:hover:bg-rose-600"
          >
            {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {deleting ? "Deleting..." : "Delete account"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
