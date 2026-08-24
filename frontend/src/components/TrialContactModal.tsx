import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../api/client';

interface TrialContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TrialContactModal({ isOpen, onClose }: TrialContactModalProps) {
  const { user, trialEndsAt } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const mailtoSubject = encodeURIComponent(`MedBuilds Upgrade Inquiry - ${user?.hospitalId || 'Hospital'}`);
  const mailtoBody = encodeURIComponent(
    `Hello MedBuilds Sales Team,\n\n` +
    `We would like to activate our hospital account.\n\n` +
    `Hospital ID: ${user?.hospitalId || 'N/A'}\n` +
    `Contact Person: ${user?.name || 'N/A'} (${user?.role || 'Staff'})\n` +
    `Email: ${user?.email || 'N/A'}\n` +
    `Trial Expiry: ${trialEndsAt ? new Date(trialEndsAt).toLocaleDateString() : 'N/A'}\n\n` +
    `Please reach out to us at your earliest convenience.`
  );
  const mailtoLink = `mailto:sales@medbuilds.com?subject=${mailtoSubject}&body=${mailtoBody}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await apiClient.post('/trial/contact', {
        hospital_id: user?.hospitalId,
        contact_name: name,
        email,
        phone,
        message,
        inquiry_type: 'UPGRADE'
      });
      setSent(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not send request. Please use direct email below.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-r from-emerald-700 to-teal-800 px-6 py-4 text-white flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold">Contact Us to Upgrade</h3>
            <p className="text-xs text-emerald-100">Activate your hospital account with our team</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {sent ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 className="text-lg font-bold text-slate-800 mb-1">Inquiry Sent Successfully</h4>
              <p className="text-sm text-slate-600 mb-6">
                Our sales team has received your hospital upgrade request and will reach out shortly.
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-emerald-700 text-white text-sm font-semibold rounded-lg hover:bg-emerald-800 transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 space-y-1">
                <div><span className="font-semibold text-slate-800">Hospital ID:</span> {user?.hospitalId || 'N/A'}</div>
                <div><span className="font-semibold text-slate-800">Trial Period:</span> {trialEndsAt ? new Date(trialEndsAt).toLocaleDateString() : 'Active 7-Day Trial'}</div>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Your Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Message / Requirements (Optional)</label>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us about your hospital bed capacity or specific requirements..."
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <a
                  href={mailtoLink}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold underline flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Open Email Client
                </a>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 text-sm font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Sending...' : 'Send Inquiry'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
