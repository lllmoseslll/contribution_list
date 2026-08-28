'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  FaArrowLeft,
  FaArrowsRotate,
  FaBell,
  FaCheck,
  FaCheckDouble,
  FaCircleInfo,
  FaClock,
  FaEnvelope,
  FaEnvelopeOpenText,
  FaFileCsv,
  FaFilePdf,
  FaFloppyDisk,
  FaGear,
  FaListCheck,
  FaLock,
  FaPaperPlane,
  FaPhone,
  FaPlus,
  FaRegEnvelope,
  FaRegEnvelopeOpen,
  FaRegEye,
  FaRegEyeSlash,
  FaRegFileLines,
  FaRegTrashCan,
  FaRightFromBracket,
  FaRotateLeft,
  FaServer,
  FaShieldHalved,
  FaSpinner,
  FaUserShield,
  FaXmark
} from 'react-icons/fa6';

function formatUGX(num) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0
  }).format(num || 0);
}

function formatDate(iso) {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('en-UG', {
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
  const [newEmailInput, setNewEmailInput] = useState('');
  const [customTestEmail, setCustomTestEmail] = useState('');

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
    ownerEmail: '',
    notifyEmail: '',
    notifyEmails: ['edwinlaston@gmail.com'],
    ownerPhone: '',
    emailNotificationsEnabled: true,
    smtp: {
      enabled: false,
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 587,
      user: '',
      hasPassword: false,
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
      const res = await fetch(`/api/admin/pledges?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
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
      const res = await fetch(`/api/admin/notifications?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
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
      const res = await fetch(`/api/admin/settings?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      if (res.ok) {
        const data = await res.json();
        let emails = [];
        if (Array.isArray(data.notifyEmails) && data.notifyEmails.length > 0) {
          emails = data.notifyEmails;
        } else if (data.notifyEmail) {
          emails = data.notifyEmail.split(',').map(s => s.trim()).filter(Boolean);
        } else if (data.ownerEmail) {
          emails = [data.ownerEmail.trim()];
        } else {
          emails = ['edwinlaston@gmail.com'];
        }
        setAdminSettings({
          ...data,
          notifyEmails: emails,
          notifyEmail: emails.join(', ')
        });
      }
    } catch (err) {
      console.error('Failed to load admin settings:', err);
    }
  };

  const handleAddEmail = (emailToAdd) => {
    const target = (emailToAdd || newEmailInput).trim().toLowerCase();
    if (!target) {
      showToast('Please enter an email address', 'error');
      return;
    }
    if (!target.includes('@') || !target.includes('.')) {
      showToast('Please enter a valid email address (e.g. name@example.com)', 'error');
      return;
    }
    const current = adminSettings.notifyEmails || [];
    if (current.includes(target)) {
      showToast('This email is already in the recipient list', 'info');
      return;
    }
    const updated = [...current, target];
    setAdminSettings(prev => ({
      ...prev,
      notifyEmails: updated,
      notifyEmail: updated.join(', ')
    }));
    setNewEmailInput('');
    showToast(`Added ${target} to notification recipients`, 'success');
  };

  const handleRemoveEmail = (emailToRemove) => {
    const current = adminSettings.notifyEmails || [];
    const updated = current.filter(e => e !== emailToRemove);
    setAdminSettings(prev => ({
      ...prev,
      notifyEmails: updated,
      notifyEmail: updated.join(', ')
    }));
    showToast(`Removed ${emailToRemove}`, 'info');
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
    if (!numAmt || numAmt < 5000) {
      showToast('Please enter an amount of 5,000 UGX or more.', 'error');
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
  const handleSendTestEmail = async (overrideEmail) => {
    const specified = typeof overrideEmail === 'string' ? overrideEmail.trim() : customTestEmail.trim();
    const fallbackRecipients = (adminSettings.notifyEmails && adminSettings.notifyEmails.length > 0)
      ? adminSettings.notifyEmails.join(', ')
      : (adminSettings.notifyEmail || adminSettings.ownerEmail || 'edwinlaston@gmail.com');
    const recipient = specified || fallbackRecipients;

    setTestEmailStatus({ loading: true, msg: `Dispatching test email to ${recipient}...` });
    try {
      const res = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail: recipient })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send test email');

      setTestEmailStatus({ success: true, msg: `Test email successfully dispatched to ${recipient}! Check inbox.` });
      showToast(`Test email sent to ${recipient}!`, 'success');
      loadAdminNotifications();
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

  // Unlike the public Pledge Report link, this reads the committee's own PDF
  // route — same report, but its contributor page carries every pledge's
  // real name, phone and amount with no anonymisation applied.
  const handleExportPdf = async () => {
    try {
      const res = await fetch('/api/admin/pdf');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'PDF generation failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kwanjula-committee-pledge-report-${new Date().toISOString().slice(0, 10)}.pdf`;
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
    <div className="min-h-screen bg-neutral-50 py-6 px-3 sm:px-4">

      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white ${
          toast.type === 'error' ? 'bg-accent-800' : 'bg-brand-700'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="mx-auto max-w-5xl bg-white rounded-3xl shadow-lg border border-neutral-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-950 to-brand-950 text-white p-5 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <FaLock className="text-accent-400" aria-hidden="true" /> Committee Admin Portal
            </h3>
            <p className="text-xs text-brand-300">Manage pledges, verify Mobile Money receipts, email alerts & settings</p>
          </div>
          <div className="flex items-center gap-2">
            {adminAuthenticated && (
              <button
                onClick={handleAdminLogout}
                className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5"
                title="End this admin session"
              >
                <FaRightFromBracket aria-hidden="true" /> Sign out
              </button>
            )}
            <Link
              href="/"
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5"
              title="Back to the public budget page"
            >
              <FaArrowLeft aria-hidden="true" /> Back to site
            </Link>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6">
          {!adminAuthenticated ? (
            /* Login Box */
            <form onSubmit={handleAdminLogin} className="max-w-xs mx-auto text-center py-8">
              <div className="w-14 h-14 rounded-full bg-accent-50 text-accent-700 flex items-center justify-center text-2xl mx-auto mb-3">
                <FaShieldHalved aria-hidden="true" />
              </div>
              <h4 className="font-bold text-neutral-900 text-base mb-1">Committee Passcode</h4>
              <p className="text-xs text-neutral-500 mb-4">Enter PIN to access committee records</p>
              
              <div className="relative mb-3">
                <input
                  type={showPin ? 'text' : 'password'}
                  required
                  placeholder="Committee passcode"
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  className="w-full text-center font-bold tracking-widest p-2.5 pr-9 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-700"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-600"
                  aria-label={showPin ? 'Hide passcode' : 'Show passcode'}
                >
                  {showPin ? <FaRegEyeSlash aria-hidden="true" /> : <FaRegEye aria-hidden="true" />}
                </button>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-brand-800 hover:bg-brand-900 text-white font-bold text-xs rounded-xl transition shadow"
              >
                Unlock Admin Portal
              </button>
            </form>
          ) : (
            /* Unlocked Admin Dashboard */
            <div>
              {/* Tabs */}
              <div className="flex border-b border-neutral-200 mb-6 gap-2">
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
                        ? 'border-brand-800 text-brand-900'
                        : 'border-transparent text-neutral-500 hover:text-neutral-600'
                    }`}
                  >
                    {{
                    'fa-list-check': <FaListCheck aria-hidden="true" />,
                    'fa-envelope-open-text': <FaEnvelopeOpenText aria-hidden="true" />,
                    'fa-gear': <FaGear aria-hidden="true" />,
                  }[t.icon]} {t.label}
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
                              ? 'bg-brand-800 text-white border-brand-800'
                              : 'bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200'
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
                        className="text-xs p-2 border border-neutral-300 rounded-lg flex-1 md:w-48 focus:outline-none focus:ring-1 focus:ring-brand-700"
                      />
                      <button
                        type="button"
                        onClick={handleExportCsv}
                        className="px-3 py-2 rounded-lg text-xs font-bold bg-brand-50 text-brand-800 border border-brand-200 flex items-center gap-1.5 hover:bg-brand-100 shrink-0"
                        title="Export all records as CSV spreadsheet"
                      >
                        <FaFileCsv aria-hidden="true" /> Export CSV
                      </button>
                      <button
                        type="button"
                        onClick={handleExportPdf}
                        className="px-3 py-2 rounded-lg text-xs font-bold bg-brand-50 text-brand-800 border border-brand-200 flex items-center gap-1.5 hover:bg-brand-100 shrink-0"
                        title="Download the pledge report PDF with real contributor names, phone numbers and amounts"
                      >
                        <FaFilePdf aria-hidden="true" /> Download PDF
                      </button>
                      <button
                        onClick={() => setIsOfflineModalOpen(true)}
                        className="px-3 py-2 rounded-lg text-xs font-bold bg-brand-800 text-white flex items-center gap-1.5 hover:bg-brand-900 shrink-0"
                      >
                        <FaPlus aria-hidden="true" /> Add Offline Pledge
                      </button>
                    </div>
                  </div>

                  {/* Total summary */}
                  <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 mb-4 text-xs flex justify-between items-center">
                    <span>Total Pledges Recorded: <strong>{adminPledges.length}</strong></span>
                    <span>Total Value: <strong className="text-brand-700 font-bold">{formatUGX(adminPledges.reduce((s, p) => s + (p.amount || 0), 0))}</strong></span>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto border border-neutral-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-50 text-neutral-500 font-bold uppercase text-[10px] border-b">
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
                      <tbody className="divide-y divide-neutral-100">
                        {filteredAdminPledges.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="p-6 text-center text-neutral-500">
                              No pledges found matching your filters.
                            </td>
                          </tr>
                        ) : (
                          filteredAdminPledges.map((p, i) => {
                            const isPaid = p.status === 'paid';
                            return (
                              <tr key={p.id || i} className="hover:bg-neutral-50">
                                <td className="p-3 text-neutral-500 whitespace-nowrap">{formatDate(p.date)}</td>
                                <td className="p-3">
                                  <div className="font-bold text-neutral-900">{p.name}</div>
                                  {p.phone && (
                                    <div className="text-[11px] text-neutral-500">
                                      <FaPhone className="text-[9px] mr-1 text-neutral-500" aria-hidden="true" />
                                      <a href={`tel:${p.phone}`} className="hover:underline">{p.phone}</a>
                                    </div>
                                  )}
                                  {p.email && (
                                    <div className="text-[10px] text-neutral-500">{p.email}</div>
                                  )}
                                  {p.isAnonymous && (
                                    <span className="text-[9px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded">Anonymous on Wall</span>
                                  )}
                                </td>
                                <td className="p-3">
                                  <div className="font-semibold text-neutral-800">{p.itemName}</div>
                                  <div className="text-[10px] text-neutral-500">{p.sectionTitle || 'General'}</div>
                                </td>
                                <td className="p-3 font-bold text-neutral-900 whitespace-nowrap">
                                  {formatUGX(p.amount)}
                                </td>
                                <td className="p-3 text-neutral-600">
                                  <div className="text-[11px]">{p.paymentMethod || 'Mobile Money'}</div>
                                  {p.message && (
                                    <div className="text-[10px] text-neutral-500 italic line-clamp-1" title={p.message}>
                                      "{p.message}"
                                    </div>
                                  )}
                                </td>
                                <td className="p-3">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                                    isPaid
                                      ? 'bg-brand-100 text-brand-800 border border-brand-200'
                                      : 'bg-accent-100 text-accent-800 border border-accent-200'
                                  }`}>
                                    {isPaid ? <FaCheckDouble aria-hidden="true" /> : <FaClock aria-hidden="true" />}
                                    {isPaid ? 'Paid & Received' : 'Pledged / Pending'}
                                  </span>
                                </td>
                                <td className="p-3 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleUpdatePledgeStatus(p.id, isPaid ? 'pledged' : 'paid')}
                                      className={`px-2 py-1 rounded text-[11px] font-bold border transition ${
                                        isPaid
                                          ? 'bg-accent-50 text-accent-800 border-accent-200 hover:bg-accent-100'
                                          : 'bg-brand-50 text-brand-800 border-brand-200 hover:bg-brand-100'
                                      }`}
                                      title={isPaid ? 'Mark as Pledged / Pending' : 'Mark as Paid / Received'}
                                    >
                                      {isPaid ? (
                                        <>
                                          <FaRotateLeft className="mr-1" aria-hidden="true" /> Mark Pledged
                                        </>
                                      ) : (
                                        <>
                                          <FaCheck className="mr-1" aria-hidden="true" /> Mark Paid
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => handleDeletePledge(p.id, p.name)}
                                      className="p-1 text-neutral-500 hover:text-accent-800 rounded hover:bg-accent-50 transition"
                                      title="Void / Delete pledge"
                                      aria-label={`Delete pledge from ${p.name}`}
                                    >
                                      <FaRegTrashCan aria-hidden="true" />
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
                    <p className="text-xs text-neutral-500">
                      Automated email alerts generated for Edwin Laston on new contributions:
                    </p>
                    <button
                      onClick={() => loadAdminNotifications()}
                      className="text-xs text-brand-800 font-bold hover:underline flex items-center gap-1"
                    >
                      <FaArrowsRotate aria-hidden="true" /> Refresh
                    </button>
                  </div>

                  {adminNotifs.length === 0 ? (
                    <div className="text-center py-12 text-neutral-500 text-xs border border-dashed border-neutral-200 rounded-xl">
                      <FaRegEnvelope className="text-2xl mb-2 block text-neutral-300" aria-hidden="true" />
                      No email alerts generated yet. They will appear here immediately as pledges are made.
                    </div>
                  ) : (
                    adminNotifs.map((n, i) => (
                      <div key={n.id || i} className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50 text-xs space-y-1.5">
                        <div className="flex justify-between text-neutral-500 text-[11px]">
                          <span>To: <strong>{n.recipient}</strong></span>
                          <span>{formatDate(n.date)}</span>
                        </div>
                        <div className="font-bold text-neutral-800">
                          🎉 New Pledge: {n.pledgerName} ({formatUGX(n.amount)}) for {n.item}
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            n.status === 'sent_smtp' ? 'bg-brand-100 text-brand-800' : 'bg-neutral-200 text-neutral-700'
                          }`}>
                            Status: {n.status === 'sent_smtp' ? 'Delivered via SMTP' : 'Saved in Outbox'}
                          </span>
                          <button
                            onClick={() => setPreviewEmailHtml(n.htmlPreview)}
                            className="text-xs text-brand-700 font-bold hover:underline flex items-center gap-1"
                          >
                            <FaRegFileLines aria-hidden="true" /> Preview HTML Email
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: SETTINGS - NOTIFICATION RECIPIENT EMAILS */}
              {adminTab === 'settings' && (
                <form onSubmit={handleSaveSettings} className="space-y-5 text-xs">

                  {/* Pledge Alert Notification Emails */}
                  <div className="p-5 sm:p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm">
                    <div className="flex flex-wrap justify-between items-center gap-3 pb-4 border-b border-neutral-100">
                      <div>
                        <h5 className="font-bold text-neutral-900 text-base flex items-center gap-2">
                          <FaBell className="text-brand-700" aria-hidden="true" /> Pledge Alert Notification Inboxes
                        </h5>
                        <p className="text-neutral-500 text-xs mt-0.5">
                          Every time a contributor submits a pledge, an instant email alert will be delivered to all addresses listed below.
                        </p>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-xl border border-brand-200 transition">
                        <input
                          type="checkbox"
                          checked={adminSettings.emailNotificationsEnabled !== false}
                          onChange={(e) => setAdminSettings(prev => ({ ...prev, emailNotificationsEnabled: e.target.checked }))}
                          className="rounded text-brand-700 focus:ring-brand-700 w-4 h-4"
                        />
                        <span className="font-bold text-brand-900 text-xs">Email Alerts Active</span>
                      </label>
                    </div>

                    {/* Add Email Form Row */}
                    <div className="mt-4">
                      <label className="block text-neutral-700 text-xs font-bold mb-1.5">
                        Add New Notification Recipient Email
                      </label>
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                        <div className="relative w-full sm:w-96">
                          <FaEnvelope className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                          <input
                            type="email"
                            placeholder="e.g. edwinlaston@gmail.com"
                            value={newEmailInput}
                            onChange={(e) => setNewEmailInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddEmail();
                              }
                            }}
                            className="w-full pl-9 pr-3 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-700 transition"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddEmail()}
                          className="px-4 py-2.5 bg-brand-800 hover:bg-brand-900 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center gap-1.5 shrink-0"
                        >
                          <FaPlus aria-hidden="true" /> Add Recipient
                        </button>
                      </div>
                    </div>

                    {/* Current Recipient List */}
                    <div className="mt-5">
                      <div className="text-[11px] uppercase tracking-wider font-extrabold text-neutral-500 mb-2.5 flex items-center justify-between">
                        <span>Active Alert Inboxes ({(adminSettings.notifyEmails || []).length})</span>
                        {(adminSettings.notifyEmails || []).length === 0 && (
                          <span className="text-orange-600 font-bold">⚠️ No notification emails configured</span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {(adminSettings.notifyEmails || []).map((email, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 bg-neutral-50 hover:bg-white rounded-xl border border-neutral-200 transition group shadow-2xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-800 font-bold flex items-center justify-center text-xs shrink-0">
                                @
                              </div>
                              <span className="font-semibold text-neutral-800 text-xs truncate" title={email}>
                                {email}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveEmail(email)}
                              className="w-6 h-6 rounded-lg text-neutral-400 hover:text-orange-600 hover:bg-orange-50 flex items-center justify-center transition"
                              title="Remove email"
                            >
                              <FaXmark aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Quick Suggestion if empty */}
                      {(!adminSettings.notifyEmails || adminSettings.notifyEmails.length === 0) && (
                        <div className="p-4 bg-orange-50/70 border border-orange-200 rounded-xl mt-2 flex items-center justify-between">
                          <div className="text-xs text-orange-900">
                            <strong>Quick suggestion:</strong> Add the groom's email (<code>edwinlaston@gmail.com</code>) to receive pledge notifications.
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddEmail('edwinlaston@gmail.com')}
                            className="text-xs font-bold text-orange-800 bg-white px-3 py-1 rounded-lg border border-orange-300 hover:bg-orange-100 transition shrink-0 ml-2"
                          >
                            + Add Edwin
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Test Email Section with Custom Recipient Input */}
                    <div className="mt-6 pt-5 border-t border-neutral-200">
                      <div className="bg-neutral-50/80 p-4 rounded-xl border border-neutral-200">
                        <label className="block text-neutral-800 text-xs font-bold mb-1">
                          ⚡ Test Live Email Alert Delivery
                        </label>
                        <p className="text-neutral-500 text-[11px] mb-2.5">
                          Set the exact email address you want to send the test alert to:
                        </p>
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                          <div className="relative w-full sm:w-80">
                            <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs" aria-hidden="true" />
                            <input
                              type="email"
                              placeholder={adminSettings.notifyEmails?.[0] || 'e.g. edwinlaston@gmail.com'}
                              value={customTestEmail}
                              onChange={(e) => setCustomTestEmail(e.target.value)}
                              className="w-full pl-8 pr-3 py-2 bg-white border border-neutral-300 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-700 transition"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSendTestEmail()}
                            disabled={testEmailStatus?.loading}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-neutral-900 hover:bg-neutral-800 text-white transition flex items-center gap-2 shadow-2xs shrink-0 disabled:opacity-50"
                          >
                            {testEmailStatus?.loading ? <FaSpinner className="animate-spin" aria-hidden="true" /> : <FaPaperPlane className="text-brand-400" aria-hidden="true" />}
                            Send Test Email
                          </button>
                        </div>

                        {/* Quick pick chips */}
                        {(adminSettings.notifyEmails || []).length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                            <span className="text-[10px] text-neutral-500 font-bold uppercase mr-1">Quick pick:</span>
                            {(adminSettings.notifyEmails || []).map((em, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setCustomTestEmail(em)}
                                className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border transition ${customTestEmail === em ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'}`}
                              >
                                {em}
                              </button>
                            ))}
                          </div>
                        )}

                        {testEmailStatus?.msg && (
                          <div className={`mt-3 p-2.5 rounded-lg text-xs font-semibold ${testEmailStatus.success ? 'bg-brand-50 text-brand-800 border border-brand-200' : 'bg-orange-50 text-orange-800 border border-orange-200'}`}>
                            {testEmailStatus.msg}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end pt-4">
                        <button
                          type="submit"
                          disabled={isSavingSettings}
                          className="px-6 py-2.5 bg-brand-800 hover:bg-brand-900 text-white font-bold rounded-xl transition shadow flex items-center gap-2 text-xs"
                        >
                          {isSavingSettings ? (
                            <>
                              <FaSpinner className="animate-spin" aria-hidden="true" /> Saving...
                            </>
                          ) : (
                            <>
                              <FaFloppyDisk aria-hidden="true" /> Save Notification Inboxes
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Public Committee Contacts Card */}
                  <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-sm">
                    <h5 className="font-bold text-neutral-900 mb-1 text-sm flex items-center gap-2">
                      <FaUserShield className="text-brand-700" aria-hidden="true" /> Public Committee Contact Details
                    </h5>
                    <p className="text-neutral-500 mb-3 text-xs">Shown to contributors on the public page for reference & phone inquiries.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-neutral-500 text-[10px] uppercase font-bold mb-1">Primary Organizer Name</label>
                        <input
                          type="text"
                          value={adminSettings.ownerName || ''}
                          onChange={(e) => setAdminSettings(prev => ({ ...prev, ownerName: e.target.value }))}
                          className="w-full p-2.5 border border-neutral-300 rounded-xl text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-neutral-500 text-[10px] uppercase font-bold mb-1">Public Contact Email</label>
                        <input
                          type="email"
                          value={adminSettings.ownerEmail || ''}
                          onChange={(e) => setAdminSettings(prev => ({ ...prev, ownerEmail: e.target.value }))}
                          className="w-full p-2.5 border border-neutral-300 rounded-xl text-xs"
                        />
                      </div>
                    </div>
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
            <div className="bg-brand-900 text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Add Offline / Phone Pledge</h3>
                <p className="text-xs text-brand-200">Record pledges received via phone calls or cash in hand</p>
              </div>
              <button
                onClick={() => setIsOfflineModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm"
                aria-label="Close"
              >
                <FaXmark aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleOfflinePledgeSubmit} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 uppercase mb-1">Target Item</label>
                <select
                  value={offlineForm.itemId}
                  onChange={(e) => setOfflineForm(prev => ({ ...prev, itemId: e.target.value }))}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl"
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
                <label className="block font-bold text-neutral-700 uppercase mb-1">Contributor Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mzee Peter"
                  value={offlineForm.name}
                  onChange={(e) => setOfflineForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-2.5 border border-neutral-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-neutral-700 uppercase mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="0772 000000"
                    value={offlineForm.phone}
                    onChange={(e) => setOfflineForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full p-2.5 border border-neutral-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-neutral-700 uppercase mb-1">Pledge Amount (UGX) *</label>
                  <input
                    type="number"
                    required
                    min="1000"
                    placeholder="e.g. 200,000"
                    value={offlineForm.amount}
                    onChange={(e) => setOfflineForm(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full p-2.5 border border-neutral-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-neutral-700 uppercase mb-1">Payment Method</label>
                  <select
                    value={offlineForm.paymentMethod}
                    onChange={(e) => setOfflineForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                    className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl"
                  >
                    <option value="Cash / Hand Delivery">Cash / Hand Delivery</option>
                    <option value="Airtel Money (0703464261)">Airtel Money</option>
                    <option value="MTN Mobile Money (0774324968)">MTN Mobile Money</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="In-Kind / Physical Item">In-Kind / Physical Item</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-neutral-700 uppercase mb-1">Status</label>
                  <select
                    value={offlineForm.status}
                    onChange={(e) => setOfflineForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl"
                  >
                    <option value="paid">Paid & Received (Default)</option>
                    <option value="pledged">Pledged / Pending Payment</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-neutral-700 uppercase mb-1">Note / Blessing Message</label>
                <textarea
                  rows="2"
                  placeholder="Optional note"
                  value={offlineForm.message}
                  onChange={(e) => setOfflineForm(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full p-2.5 border border-neutral-300 rounded-xl"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOfflineModalOpen(false)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOffline}
                  className="px-4 py-2 bg-brand-800 hover:bg-brand-900 text-white rounded-xl font-bold flex items-center gap-1.5"
                >
                  {isSubmittingOffline ? <FaSpinner className="animate-spin" aria-hidden="true" /> : <FaCheck aria-hidden="true" />}
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
            <div className="p-4 bg-neutral-900 text-white flex justify-between items-center">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <FaRegEnvelopeOpen className="text-accent-400" aria-hidden="true" /> Formatted Notification Email Preview
              </h4>
              <button
                onClick={() => setPreviewEmailHtml(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm"
                aria-label="Close"
              >
                <FaXmark aria-hidden="true" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 bg-neutral-100">
              <div
                className="bg-white rounded-xl p-4 shadow border border-neutral-200"
                dangerouslySetInnerHTML={{ __html: previewEmailHtml }}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
