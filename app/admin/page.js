'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

function formatUGX(num) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0
  }).format(num || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function AdminPage() {
  const [toast, setToast] = useState(null);

  // The offline-pledge form needs the item list; nothing else here reads it.
  const [budget, setBudget] = useState(null);

  // Admin state
  const [adminPin, setAdminPin] = useState('');
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminTab, setAdminTab] = useState('pledges');
  const [adminPledges, setAdminPledges] = useState([]);
  const [adminFilter, setAdminFilter] = useState('all');
  const [adminSearch, setAdminSearch] = useState('');
  const [adminNotifs, setAdminNotifs] = useState([]);
  const [previewEmailHtml, setPreviewEmailHtml] = useState(null);
  const [showPin, setShowPin] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState(null);

  // Admin Offline Pledge Modal
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);
  const [offlineForm, setOfflineForm] = useState({
    name: '',
    phone: '',
    email: '',
    amount: '',
    itemId: 'general',
    paymentMethod: 'Cash / Hand Delivery',
    status: 'paid',
    message: ''
  });
  const [isSubmittingOffline, setIsSubmittingOffline] = useState(false);

  const [adminSettings, setAdminSettings] = useState({
    ownerName: 'Mr. Edwin Laston',
    ownerEmail: 'edwinlaston@gmail.com',
    ownerPhone: '0703464261 / 0774324968',
    emailNotificationsEnabled: true,
    smtp: {
      enabled: false,
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 587,
      user: '',
      pass: '',
      from: 'Edwin & Jamirah Kwanjula <noreply@edwinlaston.org>'
    },
    paymentInfo: {
      airtelMoney: '0703464261 (Edwin Laston)',
      mtnMoney: '0774324968 (Edwin Laston)',
      kmpEmitu: '0783987907 (KMP Emitu Ezielkel)',
      tinkasimire: '0706171109 (Mr Tinkasimire Emmanuel)',
      note: 'Please use your Name & Pledged Item as reference when sending Mobile Money.'
    }
  });

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    let cancelled = false;
    fetch('/api/budget')
      .then(res => res.json())
      .then(data => { if (!cancelled) setBudget(data); })
      .catch(err => console.error('Failed to load budget:', err));
    return () => { cancelled = true; };
  }, []);

  // A session cookie outlives the page, so ask whether one is already valid.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/verify');
        if (!res.ok) return;
        const { authenticated } = await res.json();
        if (!cancelled && authenticated) {
          setAdminAuthenticated(true);
          loadAdminData();
        }
      } catch {
        // No session, or the server is unreachable — stay logged out.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load Admin Pledges directly from dedicated API
  const loadAdminPledges = async () => {
    try {
      const res = await fetch('/api/admin/pledges');
      if (res.ok) {
        const data = await res.json();
        setAdminPledges(data);
      }
    } catch (err) {
      console.error('Failed to load admin pledges:', err);
    }
  };

  // Load Admin Notifications
  const loadAdminNotifications = async () => {
    try {
      const res = await fetch('/api/admin/notifications');
      if (res.ok) {
        const data = await res.json();
        setAdminNotifs(data);
      }
    } catch (err) {
      console.error('Failed to load admin notifications:', err);
    }
  };

  // Load Admin Settings
  const loadAdminSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setAdminSettings(data);
      }
    } catch (err) {
      console.error('Failed to load admin settings:', err);
    }
  };

  // Load everything the console needs once a session exists.
  const loadAdminData = () => {
    loadAdminPledges();
    loadAdminNotifications();
    loadAdminSettings();
  };

  const handleAdminLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout failed:', err);
    }
    setAdminAuthenticated(false);
    setAdminPledges([]);
    setAdminNotifs([]);
    showToast('Signed out of the Committee Portal', 'success');
  };

  // Exchange the passcode for a session cookie. The passcode is sent once and
  // then dropped from state — every later request rides the cookie instead.
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: adminPin })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid PIN');

      setAdminPin('');
      setAdminAuthenticated(true);
      loadAdminData();
      showToast('Committee Admin Portal unlocked', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Update Pledge Status (Pledged <-> Paid)
  const handleUpdatePledgeStatus = async (pledgeId, newStatus) => {
    try {
      const res = await fetch(`/api/admin/pledges/${pledgeId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update pledge status');

      showToast(`Pledge marked as "${newStatus === 'paid' ? 'Paid / Received' : 'Pledged / Pending'}"`, 'success');
      loadAdminPledges();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Void / Delete Pledge
  const handleDeletePledge = async (pledgeId, pledgerName) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to void the pledge by "${pledgerName}"? This will automatically restore the item and grand total balance.`
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/admin/pledges/${pledgeId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete pledge');

      showToast(`Pledge by "${pledgerName}" voided. Budget balance restored!`, 'info');
      loadAdminPledges();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Submit Offline / Phone Pledge
  const handleOfflinePledgeSubmit = async (e) => {
    e.preventDefault();
    if (!offlineForm.name.trim()) {
      showToast('Contributor name is required.', 'error');
      return;
    }
    const numAmt = Number(offlineForm.amount);
    if (!numAmt || numAmt <= 0) {
      showToast('Please enter a valid amount.', 'error');
      return;
    }

    setIsSubmittingOffline(true);
    try {
      const res = await fetch('/api/admin/pledges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offlineForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record offline pledge');

      showToast(`Offline pledge for "${offlineForm.name}" recorded successfully!`, 'success');
      setIsOfflineModalOpen(false);
      setOfflineForm({
        name: '',
        phone: '',
        email: '',
        amount: '',
        itemId: 'general',
        paymentMethod: 'Cash / Hand Delivery',
        status: 'paid',
        message: ''
      });
      loadAdminPledges();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmittingOffline(false);
    }
  };

  // Send Test Email via SMTP
  const handleSendTestEmail = async () => {
    setTestEmailStatus({ loading: true, msg: 'Dispatching test email...' });
    try {
      const res = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail: adminSettings.ownerEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send test email');

      setTestEmailStatus({ success: true, msg: data.message || 'Test email dispatched successfully! Check inbox.' });
      showToast('Test email sent successfully!', 'success');
    } catch (err) {
      setTestEmailStatus({ success: false, msg: err.message });
      showToast(err.message, 'error');
    }
  };

  // Save Admin Settings
  const handleExportCsv = async () => {
    try {
      const res = await fetch('/api/admin/export');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kwanjula-pledges-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminSettings)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');

      showToast('Settings saved successfully!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Admin Pledges filtered by status and search
  const filteredAdminPledges = useMemo(() => {
    return adminPledges.filter(p => {
      if (adminFilter === 'paid' && p.status !== 'paid') return false;
      if (adminFilter === 'pledged' && p.status === 'paid') return false;
      if (adminSearch.trim()) {
        const q = adminSearch.toLowerCase();
        const matchName = (p.name || '').toLowerCase().includes(q);
        const matchItem = (p.itemName || '').toLowerCase().includes(q);
        const matchPhone = (p.phone || '').toLowerCase().includes(q);
        if (!matchName && !matchItem && !matchPhone) return false;
      }
      return true;
    });
  }, [adminPledges, adminFilter, adminSearch]);

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-3 sm:px-4">

      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white ${
          toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-700'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="mx-auto max-w-5xl bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 to-teal-950 text-white p-5 flex justify-between items-center">
          <div>
            <h3 className="font-serif-royal text-lg font-bold flex items-center gap-2">
              <i className="fa-solid fa-lock text-amber-400"></i> Committee Admin Portal
            </h3>
            <p className="text-xs text-emerald-300">Manage pledges, verify Mobile Money receipts, email alerts & settings</p>
          </div>
          <div className="flex items-center gap-2">
            {adminAuthenticated && (
              <button
                onClick={handleAdminLogout}
                className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5"
                title="End this admin session"
              >
                <i className="fa-solid fa-right-from-bracket"></i> Sign out
              </button>
            )}
            <Link
              href="/"
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5"
              title="Back to the public budget page"
            >
              <i className="fa-solid fa-arrow-left"></i> Back to site
            </Link>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6">
          {!adminAuthenticated ? (
            /* Login Box */
            <form onSubmit={handleAdminLogin} className="max-w-xs mx-auto text-center py-8">
              <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-2xl mx-auto mb-3">
                <i className="fa-solid fa-shield-halved"></i>
              </div>
              <h4 className="font-bold text-slate-900 text-base mb-1">Committee Passcode</h4>
              <p className="text-xs text-slate-500 mb-4">Enter PIN to access committee records</p>
              
              <div className="relative mb-3">
                <input
                  type={showPin ? 'text' : 'password'}
                  required
                  placeholder="Committee passcode"
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  className="w-full text-center font-bold tracking-widest p-2.5 pr-9 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <i className={`fa-regular ${showPin ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl transition shadow"
              >
                Unlock Admin Portal
              </button>
            </form>
          ) : (
            /* Unlocked Admin Dashboard */
            <div>
              {/* Tabs */}
              <div className="flex border-b border-slate-200 mb-6 gap-2">
                {[
                  { id: 'pledges', label: `Pledges (${adminPledges.length})`, icon: 'fa-list-check' },
                  { id: 'notifications', label: `Email Outbox (${adminNotifs.length})`, icon: 'fa-envelope-open-text' },
                  { id: 'settings', label: 'Settings & SMTP', icon: 'fa-gear' }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setAdminTab(t.id);
                      if (t.id === 'notifications') loadAdminNotifications();
                      if (t.id === 'pledges') loadAdminPledges();
                      if (t.id === 'settings') loadAdminSettings();
                    }}
                    className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
                      adminTab === t.id
                        ? 'border-emerald-800 text-emerald-900'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <i className={`fa-solid ${t.icon}`}></i> {t.label}
                  </button>
                ))}
              </div>

              {/* TAB 1: PLEDGES */}
              {adminTab === 'pledges' && (
                <div>
                  {/* Sub-bar with metrics, search, and action buttons */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Filter pills */}
                      {[
                        { id: 'all', label: `All (${adminPledges.length})` },
                        { id: 'pledged', label: `Pending (${adminPledges.filter(p => p.status !== 'paid').length})` },
                        { id: 'paid', label: `Paid (${adminPledges.filter(p => p.status === 'paid').length})` }
                      ].map(f => (
                        <button
                          key={f.id}
                          onClick={() => setAdminFilter(f.id)}
                          className={`px-3 py-1 rounded-full text-xs font-bold border transition ${
                            adminFilter === f.id
                              ? 'bg-emerald-800 text-white border-emerald-800'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <input
                        type="text"
                        placeholder="Search contributor / item..."
                        value={adminSearch}
                        onChange={(e) => setAdminSearch(e.target.value)}
                        className="text-xs p-2 border border-slate-300 rounded-lg flex-1 md:w-48 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                      />
                      <button
                        type="button"
                        onClick={handleExportCsv}
                        className="px-3 py-2 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 hover:bg-emerald-100 shrink-0"
                        title="Export all records as CSV spreadsheet"
                      >
                        <i className="fa-solid fa-file-csv"></i> Export CSV
                      </button>
                      <button
                        onClick={() => setIsOfflineModalOpen(true)}
                        className="px-3 py-2 rounded-lg text-xs font-bold bg-emerald-800 text-white flex items-center gap-1.5 hover:bg-emerald-900 shrink-0"
                      >
                        <i className="fa-solid fa-plus"></i> Add Offline Pledge
                      </button>
                    </div>
                  </div>

                  {/* Total summary */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 text-xs flex justify-between items-center">
                    <span>Total Pledges Recorded: <strong>{adminPledges.length}</strong></span>
                    <span>Total Value: <strong className="text-emerald-700 font-bold">{formatUGX(adminPledges.reduce((s, p) => s + (p.amount || 0), 0))}</strong></span>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b">
                        <tr>
                          <th className="p-3">Date</th>
                          <th className="p-3">Contributor Contact</th>
                          <th className="p-3">Item & Section</th>
                          <th className="p-3">Amount</th>
                          <th className="p-3">Payment Info</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredAdminPledges.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="p-6 text-center text-slate-400">
                              No pledges found matching your filters.
                            </td>
                          </tr>
                        ) : (
                          filteredAdminPledges.map((p, i) => {
                            const isPaid = p.status === 'paid';
                            return (
                              <tr key={p.id || i} className="hover:bg-slate-50">
                                <td className="p-3 text-slate-500 whitespace-nowrap">{formatDate(p.date)}</td>
                                <td className="p-3">
                                  <div className="font-bold text-slate-900">{p.name}</div>
                                  {p.phone && (
                                    <div className="text-[11px] text-slate-500">
                                      <i className="fa-solid fa-phone text-[9px] mr-1 text-slate-400"></i>
                                      <a href={`tel:${p.phone}`} className="hover:underline">{p.phone}</a>
                                    </div>
                                  )}
                                  {p.email && (
                                    <div className="text-[10px] text-slate-400">{p.email}</div>
                                  )}
                                  {p.isAnonymous && (
                                    <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">Anonymous on Wall</span>
                                  )}
                                </td>
                                <td className="p-3">
                                  <div className="font-semibold text-slate-800">{p.itemName}</div>
                                  <div className="text-[10px] text-slate-400">{p.sectionTitle || 'General'}</div>
                                </td>
                                <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                                  {formatUGX(p.amount)}
                                </td>
                                <td className="p-3 text-slate-600">
                                  <div className="text-[11px]">{p.paymentMethod || 'Mobile Money'}</div>
                                  {p.message && (
                                    <div className="text-[10px] text-slate-400 italic line-clamp-1" title={p.message}>
                                      "{p.message}"
                                    </div>
                                  )}
                                </td>
                                <td className="p-3">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                                    isPaid
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                                  }`}>
                                    <i className={`fa-solid ${isPaid ? 'fa-check-double' : 'fa-clock'}`}></i>
                                    {isPaid ? 'Paid & Received' : 'Pledged / Pending'}
                                  </span>
                                </td>
                                <td className="p-3 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleUpdatePledgeStatus(p.id, isPaid ? 'pledged' : 'paid')}
                                      className={`px-2 py-1 rounded text-[11px] font-bold border transition ${
                                        isPaid
                                          ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                          : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                      }`}
                                      title={isPaid ? 'Mark as Pledged / Pending' : 'Mark as Paid / Received'}
                                    >
                                      {isPaid ? (
                                        <>
                                          <i className="fa-solid fa-rotate-left mr-1"></i> Mark Pledged
                                        </>
                                      ) : (
                                        <>
                                          <i className="fa-solid fa-check mr-1"></i> Mark Paid
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => handleDeletePledge(p.id, p.name)}
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition"
                                      title="Void / Delete pledge"
                                    >
                                      <i className="fa-regular fa-trash-can"></i>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: NOTIFICATIONS OUTBOX */}
              {adminTab === 'notifications' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs text-slate-500">
                      Automated email alerts generated for Edwin Laston on new contributions:
                    </p>
                    <button
                      onClick={() => loadAdminNotifications()}
                      className="text-xs text-emerald-800 font-bold hover:underline flex items-center gap-1"
                    >
                      <i className="fa-solid fa-arrows-rotate"></i> Refresh
                    </button>
                  </div>

                  {adminNotifs.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                      <i className="fa-regular fa-envelope text-2xl mb-2 block text-slate-300"></i>
                      No email alerts generated yet. They will appear here immediately as pledges are made.
                    </div>
                  ) : (
                    adminNotifs.map((n, i) => (
                      <div key={n.id || i} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-1.5">
                        <div className="flex justify-between text-slate-400 text-[11px]">
                          <span>To: <strong>{n.recipient}</strong></span>
                          <span>{formatDate(n.date)}</span>
                        </div>
                        <div className="font-bold text-slate-800">
                          🎉 New Pledge: {n.pledgerName} ({formatUGX(n.amount)}) for {n.item}
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            n.status === 'sent_smtp' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                          }`}>
                            Status: {n.status === 'sent_smtp' ? 'Delivered via SMTP' : 'Saved in Outbox'}
                          </span>
                          <button
                            onClick={() => setPreviewEmailHtml(n.htmlPreview)}
                            className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1"
                          >
                            <i className="fa-regular fa-file-lines"></i> Preview HTML Email
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: SETTINGS & SMTP */}
              {adminTab === 'settings' && (
                <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">

                  {/* Committee Owner & Recipient Email */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <h5 className="font-bold text-slate-900 mb-1 text-sm flex items-center gap-2">
                      <i className="fa-solid fa-user-shield text-emerald-600"></i> Groom / Committee Contacts
                    </h5>
                    <p className="text-slate-500 mb-3">Notification alerts are dispatched to this email when a new pledge is made.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1">Primary Organizer Name</label>
                        <input
                          type="text"
                          value={adminSettings.ownerName || 'Mr. Edwin Laston'}
                          onChange={(e) => setAdminSettings(prev => ({ ...prev, ownerName: e.target.value }))}
                          className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1">Recipient Alert Email</label>
                        <input
                          type="email"
                          required
                          value={adminSettings.ownerEmail || 'edwinlaston@gmail.com'}
                          onChange={(e) => setAdminSettings(prev => ({ ...prev, ownerEmail: e.target.value }))}
                          className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Live SMTP Dispatch */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex justify-between items-center mb-1">
                      <h5 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <i className="fa-solid fa-server text-emerald-600"></i> Live SMTP Email Dispatch
                      </h5>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={adminSettings.smtp?.enabled || false}
                          onChange={(e) => setAdminSettings(prev => ({
                            ...prev,
                            smtp: { ...prev.smtp, enabled: e.target.checked }
                          }))}
                          className="rounded text-emerald-700"
                        />
                        <span className="font-bold text-emerald-800">Enable Live SMTP</span>
                      </label>
                    </div>
                    <p className="text-slate-500 mb-3">Deliver alerts directly to Edwin's Gmail inbox and send instant receipts to contributors.</p>

                    {adminSettings.smtp?.enabled && (
                      <div className="space-y-3 pt-2 border-t border-slate-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1">SMTP Service</label>
                            <select
                              value={adminSettings.smtp?.service || 'gmail'}
                              onChange={(e) => setAdminSettings(prev => ({
                                ...prev,
                                smtp: { ...prev.smtp, service: e.target.value }
                              }))}
                              className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                            >
                              <option value="gmail">Google Gmail</option>
                              <option value="custom">Custom SMTP Server</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1">Email / User</label>
                            <input
                              type="text"
                              placeholder="e.g. edwinlaston@gmail.com"
                              value={adminSettings.smtp?.user || ''}
                              onChange={(e) => setAdminSettings(prev => ({
                                ...prev,
                                smtp: { ...prev.smtp, user: e.target.value }
                              }))}
                              className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1">Google App Password (16 letters)</label>
                            <input
                              type="password"
                              placeholder="16-letter App Password"
                              value={adminSettings.smtp?.pass || ''}
                              onChange={(e) => setAdminSettings(prev => ({
                                ...prev,
                                smtp: { ...prev.smtp, pass: e.target.value }
                              }))}
                              className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1">From Header</label>
                            <input
                              type="text"
                              value={adminSettings.smtp?.from || 'Edwin & Jamirah Kwanjula <noreply@edwinlaston.org>'}
                              onChange={(e) => setAdminSettings(prev => ({
                                ...prev,
                                smtp: { ...prev.smtp, from: e.target.value }
                              }))}
                              className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                            />
                          </div>
                        </div>

                        {/* Test Email Button & Status */}
                        <div className="pt-2 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={handleSendTestEmail}
                            disabled={testEmailStatus?.loading}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 flex items-center gap-1.5"
                          >
                            <i className={`fa-solid ${testEmailStatus?.loading ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
                            Send Test Email to Verify
                          </button>
                          {testEmailStatus?.msg && (
                            <span className={`text-xs font-semibold ${testEmailStatus.success ? 'text-emerald-700' : 'text-rose-600'}`}>
                              {testEmailStatus.msg}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-3">
                    <button
                      type="submit"
                      disabled={isSavingSettings}
                      className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl transition shadow flex items-center gap-2"
                    >
                      {isSavingSettings ? (
                        <>
                          <i className="fa-solid fa-spinner fa-spin"></i> Saving...
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-floppy-disk"></i> Save Settings
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

            </div>
          )}
        </div>
      </div>

      {/* ================= MODAL: ADD OFFLINE PLEDGE (ADMIN) ================= */}
      {isOfflineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-in zoom-in duration-200">
            <div className="bg-emerald-900 text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="font-serif-royal text-lg font-bold">Add Offline / Phone Pledge</h3>
                <p className="text-xs text-emerald-200">Record pledges received via phone calls or cash in hand</p>
              </div>
              <button
                onClick={() => setIsOfflineModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleOfflinePledgeSubmit} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Target Item</label>
                <select
                  value={offlineForm.itemId}
                  onChange={(e) => setOfflineForm(prev => ({ ...prev, itemId: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                >
                  <option value="general">✨ General Ceremony Contribution</option>
                  {budget?.sections?.map(sec => (
                    <optgroup key={sec.id} label={`Section ${sec.code}: ${sec.title}`}>
                      {sec.items.map(itm => (
                        <option key={itm.id} value={itm.id}>
                          {itm.name} {itm.isFullyFunded ? '(Covered)' : `(${formatUGX(itm.remainingAmount)} left)`}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Contributor Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mzee Peter"
                  value={offlineForm.name}
                  onChange={(e) => setOfflineForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="0772 000000"
                    value={offlineForm.phone}
                    onChange={(e) => setOfflineForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Pledge Amount (UGX) *</label>
                  <input
                    type="number"
                    required
                    min="1000"
                    placeholder="e.g. 200,000"
                    value={offlineForm.amount}
                    onChange={(e) => setOfflineForm(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Payment Method</label>
                  <select
                    value={offlineForm.paymentMethod}
                    onChange={(e) => setOfflineForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="Cash / Hand Delivery">Cash / Hand Delivery</option>
                    <option value="Airtel Money (0703464261)">Airtel Money</option>
                    <option value="MTN Mobile Money (0774324968)">MTN Mobile Money</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="In-Kind / Physical Item">In-Kind / Physical Item</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Status</label>
                  <select
                    value={offlineForm.status}
                    onChange={(e) => setOfflineForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="paid">Paid & Received (Default)</option>
                    <option value="pledged">Pledged / Pending Payment</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Note / Blessing Message</label>
                <textarea
                  rows="2"
                  placeholder="Optional note"
                  value={offlineForm.message}
                  onChange={(e) => setOfflineForm(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOfflineModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOffline}
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold flex items-center gap-1.5"
                >
                  {isSubmittingOffline ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                  Save Offline Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EMAIL HTML PREVIEW (ADMIN) ================= */}
      {previewEmailHtml && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <i className="fa-regular fa-envelope-open text-amber-400"></i> Formatted Notification Email Preview
              </h4>
              <button
                onClick={() => setPreviewEmailHtml(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 bg-slate-100">
              <div
                className="bg-white rounded-xl p-4 shadow border border-slate-200"
                dangerouslySetInnerHTML={{ __html: previewEmailHtml }}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
