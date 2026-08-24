import React, { useState } from 'react';
import TrialContactModal from './TrialContactModal';

interface WriteBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WriteBlockModal({ isOpen, onClose }: WriteBlockModalProps) {
  const [isContactOpen, setIsContactOpen] = useState(false);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 p-6 text-center">
          <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m11-3.5a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h3 className="text-xl font-bold text-slate-900 mb-2">Read-Only Mode Active</h3>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            Your trial period has ended. Your data is safe and fully accessible in read-only mode. Contact our team to activate your full account.
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-6 text-xs text-slate-600 text-left space-y-1">
            <div className="font-semibold text-slate-800">Support & Sales Assistance:</div>
            <div>Email: <a href="mailto:sales@medbuilds.com" className="text-emerald-700 font-medium hover:underline">sales@medbuilds.com</a></div>
            <div>Phone: <span className="font-medium text-slate-700">+91 98765 43210</span></div>
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
            >
              Continue in Read-Only
            </button>
            <button
              onClick={() => {
                onClose();
                setIsContactOpen(true);
              }}
              className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold rounded-lg shadow-sm transition-colors"
            >
              Get in Touch
            </button>
          </div>
        </div>
      </div>

      <TrialContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </>
  );
}
