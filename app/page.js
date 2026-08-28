'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import {
  FaArrowDown,
  FaBell,
  FaCalendarDays,
  FaCheck,
  FaCheckDouble,
  FaChevronDown,
  FaCircleCheck,
  FaCircleInfo,
  FaCoins,
  FaEnvelope,
  FaFilePdf,
  FaFilter,
  FaFlagCheckered,
  FaGift,
  FaHandHoldingDollar,
  FaHandHoldingHeart,
  FaHeart,
  FaHeartCircleCheck,
  FaListCheck,
  FaLock,
  FaMagnifyingGlass,
  FaMobileScreenButton,
  FaPaperPlane,
  FaPhone,
  FaRegCommentDots,
  FaRegCopy,
  FaRegEnvelope,
  FaRegUser,
  FaScaleBalanced,
  FaShieldHalved,
  FaSpinner,
  FaStar,
  FaTrophy,
  FaUsers,
  FaWhatsapp,
  FaXmark
} from 'react-icons/fa6';

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

// Shared by the tab/chip controls and the empty-state message, so a filter's
// name is defined once rather than typed twice and risking drift between them.
const CATEGORY_TABS = [
  { id: 'all', label: 'All Sections' },
  { id: 'sec-A', label: 'A: Important Gifts' },
  { id: 'sec-B', label: 'B: Clothes & Suitcases' },
  { id: 'sec-C', label: 'C: Gifts & Groceries' },
  { id: 'sec-E', label: 'E: Others & Operations' }
];

const FILTER_CHIPS = [
  { id: 'all', label: 'All Items' },
  { id: 'needs-pledges', label: 'Needs Support' },
  { id: 'partially-pledged', label: 'Partially Supported' },
  { id: 'fully-covered', label: 'Fully Covered' }
];

export default function KwanjulaBudgetPage() {
  const [budget, setBudget] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [liveConnected, setLiveConnected] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedText, setCopiedText] = useState(null);
  const [toast, setToast] = useState(null);
  const [showAllHonorPledges, setShowAllHonorPledges] = useState(false);

  // Modals state
  const [isPledgeModalOpen, setIsPledgeModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  // Public Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    amount: '',
    itemId: 'general',
    paymentMethod: 'Airtel Money (0703464261)',
    message: '',
    isAnonymous: false,
    hideAmount: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Every pledge id seen on the previous poll, so a newly-appeared one can be
  // told apart from one that was already on the page — the polling
  // replacement for the "PLEDGE_ADDED" event a push connection used to carry.
  const seenPledgeIdsRef = useRef(null);

  // Show Toast
  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Polling instead of a push connection. Vercel's serverless functions don't
  // share memory across invocations/instances and enforce execution-time
  // limits, so an in-memory EventEmitter and a long-lived SSE stream — what
  // this used to be — can't reliably reach every visitor once deployed there.
  // Re-fetching every few seconds has none of that risk, and for a
  // contribution counter, "updates within a few seconds" reads as live to a
  // visitor even though nothing is actually pushed.
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/budget?t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const data = await res.json();
        if (cancelled) return;

        setBudget(data);
        setIsLoading(false);
        setLiveConnected(true);

        // Item-level pledges don't carry the item's own name (see
        // lib/budget-service.js's recentPledges mapping), so it's captured
        // here from the enclosing item while it's in scope.
        const currentPledges = new Map();
        for (const sec of data.sections || []) {
          for (const item of sec.items || []) {
            for (const p of item.recentPledges || []) {
              currentPledges.set(p.id, { ...p, itemName: item.name });
            }
          }
        }
        for (const p of data.recentGeneralPledges || []) currentPledges.set(p.id, p);

        // The very first poll seeds the baseline — every pledge on it is
        // "already there", not new, so no toast fires for a page load.
        if (seenPledgeIdsRef.current) {
          for (const [id, p] of currentPledges) {
            if (seenPledgeIdsRef.current.has(id)) continue;
            const amt = p.amount ? formatUGX(p.amount) : 'a generous contribution';
            showToast(`🎉 ${p.name} just pledged ${amt} for ${p.itemName}!`, 'success');
          }
        }
        seenPledgeIdsRef.current = new Set(currentPledges.keys());
      } catch (err) {
        console.error('Error fetching budget:', err);
        if (!cancelled) {
          setIsLoading(false);
          setLiveConnected(false);
        }
      }
    };

    poll();
    const intervalId = setInterval(poll, 7000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  // Copy to clipboard
  const handleCopy = (text) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedText(text);
    showToast(`Copied ${text} to clipboard!`, 'success');
    setTimeout(() => setCopiedText(null), 2500);
  };

  const [testEmailAddress, setTestEmailAddress] = useState('edwinlaston@gmail.com');
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState(null);

  const handleSendLiveTestEmail = async (e) => {
    if (e) e.preventDefault();
    setTestEmailLoading(true);
    setTestEmailResult(null);
    try {
      const res = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail: testEmailAddress })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send test email');
      setTestEmailResult({ success: true, msg: data.message });
      showToast('Live test email dispatched! Check inbox.', 'success');
    } catch (err) {
      setTestEmailResult({ success: false, msg: err.message });
      showToast(err.message, 'error');
    } finally {
      setTestEmailLoading(false);
    }
  };

  // Open Pledge modal for specific item
  const openPledgeModal = (item = null) => {
    setSelectedItem(item);
    setFormData(prev => ({
      ...prev,
      itemId: item ? item.id : 'general',
      amount: ''
    }));
    setIsPledgeModalOpen(true);
  };

  // Submit Pledge (Public)
  const handlePledgeSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Please enter your name.', 'error');
      return;
    }
    const numAmt = Number(formData.amount);
    if (!numAmt || numAmt < 5000) {
      showToast('Please enter an amount of 5,000 UGX or more.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/pledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit pledge');

      setIsPledgeModalOpen(false);
      setReceiptData({
        name: formData.name,
        amount: numAmt,
        item: data.pledge?.itemName || (selectedItem ? selectedItem.name : 'Ceremony Contribution'),
        spilloverInfo: data.spilloverInfo,
        serverMessage: data.message
      });

      // Confetti burst!
      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#16a34a', '#059669', '#4ade80', '#10b981', '#ffffff']
        });
      } catch (e) {}

      setIsSuccessModalOpen(true);
      // Immediately refresh budget state
      poll();

      // Reset form
      setFormData({
        name: '',
        phone: '',
        email: '',
        amount: '',
        itemId: 'general',
        paymentMethod: 'Airtel Money (0703464261)',
        message: '',
        isAnonymous: false,
        hideAmount: false
      });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Amount chips
  const applyQuickAmount = (val) => {
    setFormData(prev => ({ ...prev, amount: val }));
  };

  // Filtered Sections
  const filteredSections = useMemo(() => {
    if (!budget?.sections) return [];
    const query = searchQuery.trim().toLowerCase();

    return budget.sections
      .filter(sec => activeCategory === 'all' || sec.id === activeCategory)
      .map(sec => {
        const filteredItems = (sec.items || []).filter(item => {
          if (query && !item.name.toLowerCase().includes(query) && !(item.remarks || '').toLowerCase().includes(query)) {
            return false;
          }
          if (activeFilter === 'needs-pledges') {
            return !item.isFullyFunded && (!item.pledgedAmount || item.pledgedAmount === 0);
          }
          if (activeFilter === 'partially-pledged') {
            return !item.isFullyFunded && item.pledgedAmount > 0;
          }
          if (activeFilter === 'fully-covered') {
            return item.isFullyFunded;
          }
          return true;
        });
        return { ...sec, items: filteredItems };
      })
      .filter(sec => sec.items.length > 0);
  }, [budget, activeCategory, activeFilter, searchQuery]);

  // Every item in the budget, regardless of category/filter/search — the
  // denominator for "Showing X of Y items" and for telling an empty result
  // apart from a budget that genuinely has nothing in it yet.
  const totalItemsCount = useMemo(() => {
    if (!budget?.sections) return 0;
    return budget.sections.reduce((sum, sec) => sum + (sec.items?.length || 0), 0);
  }, [budget]);

  const visibleItemsCount = useMemo(
    () => filteredSections.reduce((sum, sec) => sum + sec.items.length, 0),
    [filteredSections]
  );

  const isFiltered = activeCategory !== 'all' || activeFilter !== 'all' || searchQuery.trim() !== '';

  const resetFilters = () => {
    setSearchQuery('');
    setActiveCategory('all');
    setActiveFilter('all');
  };

  // Names the specific constraints narrowing the result, so the empty state
  // can say what's responsible instead of a generic "no matches" — a search
  // term, a section, and a status filter can each independently be the reason.
  const activeFilterDescriptions = useMemo(() => {
    const parts = [];
    const q = searchQuery.trim();
    if (q) parts.push(`matching "${q}"`);
    if (activeCategory !== 'all') {
      const label = CATEGORY_TABS.find(t => t.id === activeCategory)?.label;
      if (label) parts.push(`in ${label}`);
    }
    if (activeFilter !== 'all') {
      const label = FILTER_CHIPS.find(c => c.id === activeFilter)?.label;
      if (label) parts.push(`filtered to "${label}"`);
    }
    return parts;
  }, [searchQuery, activeCategory, activeFilter]);

  // All Pledges for Roll of Honor Wall (Both Items & General Pledges)
  const rollOfHonorPledges = useMemo(() => {
    if (!budget?.sections) return [];
    let list = [...(budget.recentGeneralPledges || [])];
    budget.sections.forEach(sec => {
      (sec.items || []).forEach(itm => {
        (itm.recentPledges || []).forEach(p => {
          list.push({ ...p, itemName: itm.name });
        });
      });
    });
    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [budget]);

  // Financial Stats
  const stats = budget?.stats || {
    totalBudget: 31090000,
    totalCoveredAndPledged: 800000,
    totalRemaining: 30290000,
    totalPercentage: 3,
    pledgersCount: 0,
    totalPledgesCount: 0
  };

  return (
    <div className="flex-1 flex flex-col bg-neutral-50 text-neutral-900 selection:bg-brand-200">
      
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-brand-900 text-brand-100 border-l-4 border-brand-400' : 'bg-neutral-900 text-white border-l-4 border-accent-500'
        }`}>
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} className="opacity-70 hover:opacity-100 ml-2" aria-label="Dismiss">
            <FaXmark aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Top Announcement Bar */}
      <div className="bg-brand-950 text-brand-200 text-xs sm:text-sm py-2.5 px-4 border-b border-brand-800/50">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-900 text-brand-300 border border-brand-700/60">
              <span className={`w-2 h-2 rounded-full ${liveConnected ? 'bg-brand-400 pulse-dot' : 'bg-accent-400'}`}></span>
              {liveConnected ? 'Live Sync Active' : 'Connecting...'}
            </span>
            <span className="hidden sm:inline text-brand-400/40">•</span>
            <span className="inline-flex items-center gap-1.5 text-brand-100 font-medium">
              <FaCalendarDays className="text-accent-400" aria-hidden="true" />
              Ceremony Date: <strong>Friday, 27th November 2026</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/api/budget/pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-brand-200 bg-brand-900/60 hover:bg-brand-800 border border-brand-700/60 transition"
              title="Download a live pledge report as PDF"
            >
              <FaFilePdf className="text-accent-400" aria-hidden="true" /> Pledge Report
            </a>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-accent-300 bg-accent-500/10 hover:bg-accent-500/20 border border-accent-500/30 transition"
            >
              <FaLock className="text-[10px]" aria-hidden="true" /> Committee Portal
            </Link>
          </div>
        </div>
      </div>

      {/* Hero Banner */}
      <header className="relative bg-brand-950 text-white py-12 sm:py-16 px-4 text-center border-b border-brand-800">
        <div className="relative max-w-4xl mx-auto">
          <p className="text-accent-400 text-xs font-bold tracking-widest uppercase mb-3">
            The Kwanjula Budget
          </p>

          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white mb-3">
            Mr. Edwin Laston <span className="text-accent-400">&amp;</span> Jamirah Nakayemba
          </h1>

          <p className="text-base sm:text-lg text-brand-200 font-medium mb-3">
            Official Introduction Ceremony Contribution &amp; Pledges Board
          </p>

          <p className="max-w-2xl mx-auto text-neutral-200 text-sm leading-relaxed mb-8">
            Welcome family, relatives, and dear friends! Stand with Edwin & Jamirah as they take this blessed step. Choose any item from our official budget below to make a pledge and write your name. All contributions deduct from the remaining total in real-time.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => openPledgeModal(null)}
              className="px-6 py-3 rounded-lg font-bold text-sm sm:text-base bg-brand-700 hover:bg-brand-800 text-white transition flex items-center gap-2"
            >
              <FaHeartCircleCheck aria-hidden="true" /> Make a Pledge Now
            </button>
            <a
              href="#budgetSection"
              className="px-6 py-3 rounded-lg font-semibold text-sm sm:text-base bg-white text-brand-950 hover:bg-neutral-100 transition flex items-center gap-2"
            >
              <FaListCheck aria-hidden="true" /> View Budget Items
            </a>
            <a
              href="#honorWall"
              className="px-5 py-3 rounded-lg font-semibold text-sm sm:text-base bg-brand-900/80 hover:bg-brand-800 text-brand-100 border border-brand-700 transition flex items-center gap-2"
            >
              <FaUsers className="text-accent-400" aria-hidden="true" /> Roll of Honor ({stats.totalPledgesCount})
            </a>
            <a
              href="/api/budget/pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3 rounded-lg font-semibold text-sm sm:text-base border border-brand-700 hover:bg-brand-900 text-accent-300 transition flex items-center gap-2"
            >
              <FaFilePdf className="text-accent-400" aria-hidden="true" /> Pledge Report
            </a>
            <a
              href="#paymentSection"
              className="px-5 py-3 rounded-lg font-semibold text-sm sm:text-base border border-brand-700 hover:bg-brand-900 text-brand-100 transition flex items-center gap-2"
            >
              <FaMobileScreenButton aria-hidden="true" /> Mobile Money
            </a>
          </div>
        </div>
      </header>

      {/* Financial Metrics & Ceremony Funding Milestone Showcase */}
      <section className="max-w-6xl mx-auto w-full px-4 -mt-8 relative z-20 mb-12">
        {/* 4 Financial Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">

          {/* Card 1: Total Budget Target */}
          <div className="bg-white p-5 rounded-xl border border-neutral-200/90 shadow-xs flex items-center gap-3.5 transition-all duration-200 hover:border-neutral-300">
            <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0 text-neutral-700 text-xl">
              <FaCoins className="text-accent-600" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Total Target Budget</div>
              <div className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">{formatUGX(stats.totalBudget)}</div>
              <div className="text-[11px] text-neutral-500 font-medium">Official Ceremony Budget</div>
            </div>
          </div>

          {/* Card 2: Total Raised & Pledged */}
          <div className="bg-gradient-to-br from-brand-50 to-emerald-100/50 p-5 rounded-xl border border-brand-200/90 shadow-xs flex items-center gap-3.5 transition-all duration-200 hover:border-brand-300">
            <div className="w-12 h-12 rounded-xl bg-brand-200/60 flex items-center justify-center shrink-0 text-brand-800 text-xl">
              <FaCircleCheck className="text-brand-700" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-brand-800 uppercase tracking-wider">Total Raised & Pledged</div>
              <div className="text-xl sm:text-2xl font-black text-brand-700 tracking-tight">{formatUGX(stats.totalCoveredAndPledged)}</div>
              <div className="text-[11px] font-bold text-brand-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-brand-600 pulse-dot inline-block"></span>
                <span>{stats.totalPercentage}% Funded so far</span>
              </div>
            </div>
          </div>

          {/* Card 3: Orange Remaining Balance */}
          <div className="bg-gradient-to-br from-orange-50 via-amber-50/70 to-orange-100/90 p-5 rounded-xl border border-orange-300 shadow-sm ring-1 ring-orange-400/25 flex items-center gap-3.5 transition-all duration-200 hover:border-orange-400">
            <div className="w-12 h-12 rounded-xl bg-orange-200/70 flex items-center justify-center shrink-0 text-orange-700 text-xl">
              <FaScaleBalanced className="text-orange-600" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-orange-900 uppercase tracking-wider">Remaining Balance</div>
              <div className="text-xl sm:text-2xl font-black text-orange-600 tracking-tight">{formatUGX(stats.totalRemaining)}</div>
              <div className="text-[11px] font-extrabold text-orange-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-500 pulse-dot-orange inline-block"></span>
                <span>Live subtracting balance</span>
              </div>
            </div>
          </div>

          {/* Card 4: Supporters & Pledges */}
          <div className="bg-white p-5 rounded-xl border border-neutral-200/90 shadow-xs flex items-center gap-3.5 transition-all duration-200 hover:border-neutral-300">
            <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0 text-neutral-700 text-xl">
              <FaUsers className="text-neutral-700" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Community Backers</div>
              <div className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">{stats.pledgersCount} Contributors</div>
              <div className="text-[11px] text-neutral-500 font-medium">{stats.totalPledgesCount} pledges recorded</div>
            </div>
          </div>

        </div>

        {/* ================= CEREMONY FUNDING MILESTONE SHOWCASE ================= */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-neutral-200/90 shadow-sm relative overflow-hidden">
          {/* Subtle Background Shimmer Accent */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-50/50 rounded-full blur-3xl -z-10 pointer-events-none"></div>

          {/* Milestone Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-5 border-b border-neutral-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-brand-100 text-brand-900 border border-brand-200">
                  Live Ceremony Progress
                </span>
                <span className="text-xs text-neutral-500 font-medium">Edwin & Jamirah Kwanjula • 27 Nov 2026</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-brand-950 flex items-center gap-2">
                <FaTrophy className="text-accent-500" aria-hidden="true" /> Ceremony Funding Milestone Journey
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="bg-brand-50 border border-brand-200 px-3.5 py-1.5 rounded-xl text-xs font-bold text-brand-900 flex items-center gap-2">
                <FaCircleCheck className="text-brand-700" aria-hidden="true" />
                <span><strong>{stats.totalPercentage}%</strong> of Goal Achieved</span>
              </div>
              <div className="bg-orange-50 border border-orange-200 px-3.5 py-1.5 rounded-xl text-xs font-bold text-orange-800 flex items-center gap-1.5">
                <span>🟧 <strong>{formatUGX(stats.totalRemaining)}</strong> Remaining</span>
              </div>
            </div>
          </div>

          {/* Interactive Milestone Checkpoints Track */}
          <div className="mb-4">
            {/* Checkpoint Indicators Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              
              {/* Checkpoint 1: 25% */}
              <div className={`p-3.5 rounded-xl border transition-all duration-200 flex flex-col justify-between ${stats.totalPercentage >= 25 ? 'bg-brand-50/80 border-brand-300 shadow-xs' : 'bg-neutral-50/60 border-neutral-200'}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${stats.totalPercentage >= 25 ? 'bg-brand-700 text-white' : 'bg-neutral-200 text-neutral-600'}`}>
                    {stats.totalPercentage >= 25 ? '✓ 25% Achieved' : 'Stage 1 • 25%'}
                  </span>
                  <span className="text-xs font-bold text-neutral-500">{formatUGX(stats.totalBudget * 0.25)}</span>
                </div>
                <div>
                  <div className="font-bold text-xs text-neutral-900">Foundation & Cultural Gifts</div>
                  <div className="text-[10px] text-neutral-500">Essential introduction items & mutwalo</div>
                </div>
              </div>

              {/* Checkpoint 2: 50% */}
              <div className={`p-3.5 rounded-xl border transition-all duration-200 flex flex-col justify-between ${stats.totalPercentage >= 50 ? 'bg-brand-50/80 border-brand-300 shadow-xs' : stats.totalPercentage >= 25 ? 'bg-white border-brand-300 ring-1 ring-brand-400/30' : 'bg-neutral-50/60 border-neutral-200'}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${stats.totalPercentage >= 50 ? 'bg-brand-700 text-white' : stats.totalPercentage >= 25 ? 'bg-accent-600 text-white animate-pulse' : 'bg-neutral-200 text-neutral-600'}`}>
                    {stats.totalPercentage >= 50 ? '✓ 50% Achieved' : 'Stage 2 • 50%'}
                  </span>
                  <span className="text-xs font-bold text-neutral-500">{formatUGX(stats.totalBudget * 0.50)}</span>
                </div>
                <div>
                  <div className="font-bold text-xs text-neutral-900">Halfway Celebration 🎉</div>
                  <div className="text-[10px] text-neutral-500">Major family gifts & food requirements</div>
                </div>
              </div>

              {/* Checkpoint 3: 75% */}
              <div className={`p-3.5 rounded-xl border transition-all duration-200 flex flex-col justify-between ${stats.totalPercentage >= 75 ? 'bg-brand-50/80 border-brand-300 shadow-xs' : 'bg-neutral-50/60 border-neutral-200'}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${stats.totalPercentage >= 75 ? 'bg-brand-700 text-white' : 'bg-neutral-200 text-neutral-600'}`}>
                    {stats.totalPercentage >= 75 ? '✓ 75% Achieved' : 'Stage 3 • 75%'}
                  </span>
                  <span className="text-xs font-bold text-neutral-500">{formatUGX(stats.totalBudget * 0.75)}</span>
                </div>
                <div>
                  <div className="font-bold text-xs text-neutral-900">Attire & Family Wardrobe</div>
                  <div className="text-[10px] text-neutral-500">Groom, bride & parents traditional wear</div>
                </div>
              </div>

              {/* Checkpoint 4: 100% */}
              <div className={`p-3.5 rounded-xl border transition-all duration-200 flex flex-col justify-between ${stats.totalPercentage >= 100 ? 'bg-brand-50 border-brand-400 shadow-sm' : 'bg-neutral-50/60 border-neutral-200'}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${stats.totalPercentage >= 100 ? 'bg-brand-800 text-white' : 'bg-neutral-200 text-neutral-600'}`}>
                    {stats.totalPercentage >= 100 ? '🏆 100% Victory!' : 'Stage 4 • 100%'}
                  </span>
                  <span className="text-xs font-bold text-neutral-500">{formatUGX(stats.totalBudget)}</span>
                </div>
                <div>
                  <div className="font-bold text-xs text-neutral-900">100% Ceremony Success 💍</div>
                  <div className="text-[10px] text-neutral-500">Complete introduction fully funded</div>
                </div>
              </div>

            </div>

            {/* High-Definition Layered Progress Bar */}
            <div className="relative w-full h-4 bg-neutral-200/80 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-gradient-to-r from-brand-700 via-brand-600 to-accent-500 rounded-full transition-all duration-700 relative shimmer-bar"
                style={{ width: `${Math.min(100, Math.max(3, stats.totalPercentage))}%` }}
              >
                {/* Glowing Lead Pin */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md"></div>
              </div>
            </div>
          </div>

          {/* Motivational Bottom Callout */}
          <div className="mt-5 pt-4 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <p className="text-neutral-600 text-center sm:text-left">
              🙏 <strong>Together We Build:</strong> Every pledge directly reduces the remaining ceremony balance and brings Edwin & Jamirah closer to 27th Nov 2026!
            </p>
            <button
              onClick={() => openPledgeModal(null)}
              className="px-4 py-2 rounded-xl font-bold bg-brand-800 hover:bg-brand-900 text-white transition flex items-center gap-1.5 shrink-0 shadow-sm text-xs"
            >
              <FaHandHoldingHeart aria-hidden="true" /> Contribute to Milestone
            </button>
          </div>
        </div>
      </section>

      {/* Main Budget Section */}
      <main className="max-w-6xl mx-auto w-full px-4 mb-16" id="budgetSection">
        
        {/* Controls & Search */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-brand-950">Budget Sections & Items</h2>
            <p className="text-neutral-500 text-sm mt-1">Select any item below to sponsor all or part of it.</p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="w-full sm:w-80 relative">
              <FaMagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 text-sm" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search items (e.g. Cows, Rice, Suitcase)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-neutral-300 rounded-full focus:outline-none focus:ring-2 focus:ring-brand-700 focus:border-transparent transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-600"
                  aria-label="Clear search"
                >
                  <FaXmark className="text-sm" aria-hidden="true" />
                </button>
              )}
            </div>

            <a
              href="/api/budget/pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-brand-900 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-full transition whitespace-nowrap"
              title="Download a live pledge report as PDF"
            >
              <FaFilePdf className="text-accent-500" aria-hidden="true" /> PDF
            </a>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-5 overflow-x-auto border-b border-neutral-200 mb-4 scrollbar-none">
          {CATEGORY_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`pb-3 -mb-px text-sm font-semibold whitespace-nowrap border-b-2 transition ${
                activeCategory === tab.id
                  ? 'border-brand-700 text-brand-900'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          <span className="text-xs font-semibold text-neutral-500 mr-1 flex items-center gap-1">
            <FaFilter aria-hidden="true" /> Filter:
          </span>
          {FILTER_CHIPS.map(chip => (
            <button
              key={chip.id}
              onClick={() => setActiveFilter(chip.id)}
              className={`px-3 py-1 rounded-md text-xs font-medium border bg-white transition ${
                activeFilter === chip.id
                  ? 'border-brand-700 text-brand-800 font-semibold'
                  : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Result Count */}
        {!isLoading && totalItemsCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500 mb-6 -mt-3">
            <span>
              Showing <strong className="text-neutral-700 font-bold">{visibleItemsCount}</strong> of{' '}
              <strong className="text-neutral-700 font-bold">{totalItemsCount}</strong> items
            </span>
            {isFiltered && (
              <button
                onClick={resetFilters}
                className="font-semibold text-brand-700 hover:text-brand-800 underline underline-offset-2"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* General Pledge Callout */}
        <div className="bg-accent-50 border border-accent-200 rounded-lg p-5 sm:p-6 mb-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-accent-700 text-white flex items-center justify-center text-xl shrink-0">
              <FaHandHoldingDollar aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-bold text-accent-950 text-base sm:text-lg">Prefer to make a General Contribution?</h3>
              <p className="text-accent-800 text-xs sm:text-sm mt-0.5">
                Support the overall ceremony expenses with any amount without selecting a specific single item.
              </p>
            </div>
          </div>
          <button
            onClick={() => openPledgeModal(null)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-sm font-bold bg-brand-700 hover:bg-brand-800 text-white transition shrink-0 flex items-center justify-center gap-2"
          >
            <FaGift aria-hidden="true" /> Make General Pledge
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-16 text-neutral-500">
            <div className="w-10 h-10 border-4 border-neutral-200 border-t-brand-700 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm font-medium">Loading real-time budget data...</p>
          </div>
        )}

        {/* Empty Search / Filter Result */}
        {!isLoading && filteredSections.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-neutral-200">
            <FaMagnifyingGlass className="text-neutral-300 text-4xl mb-3" aria-hidden="true" />
            {isFiltered ? (
              <>
                <h3 className="text-base font-bold text-neutral-700">No items {activeFilterDescriptions.join(', ')}</h3>
                <p className="text-xs text-neutral-500 mt-1">
                  {totalItemsCount} item{totalItemsCount === 1 ? '' : 's'} exist in the budget — none of them match what's
                  currently selected above.
                </p>
                <button
                  onClick={resetFilters}
                  className="mt-4 px-4 py-1.5 text-xs font-semibold text-brand-800 bg-brand-50 hover:bg-brand-100 rounded-lg border border-brand-200 transition"
                >
                  Clear Filters
                </button>
              </>
            ) : (
              <>
                <h3 className="text-base font-bold text-neutral-700">No budget items yet</h3>
                <p className="text-xs text-neutral-500 mt-1">The committee hasn't published any budget items to sponsor.</p>
              </>
            )}
          </div>
        )}

        {/* Budget Items Sections */}
        {!isLoading && filteredSections.map(sec => (
          <div key={sec.id} className="mb-12">
            {/* Section Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b-2 border-neutral-200 mb-6">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-brand-900 text-white font-extrabold flex items-center justify-center text-sm shadow">
                  {sec.code}
                </span>
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-brand-950">
                    Section {sec.code}: {sec.title}
                  </h3>
                  <p className="text-xs text-neutral-500">{sec.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs sm:text-sm text-neutral-600">
                <span>Target: <strong>{formatUGX(sec.totalCost)}</strong></span>
                <span>Remaining: <strong className="text-orange-600 font-bold">{formatUGX(sec.remainingAmount)}</strong></span>
                <span className="px-2.5 py-0.5 rounded-full bg-neutral-100 font-bold text-neutral-700 text-xs">
                  {sec.percentage}% Funded
                </span>
              </div>
            </div>

            {/* Items List */}
            <div className="space-y-3">
              {sec.items.map(item => {
                const isCovered = item.isFullyFunded;
                const isPartial = !isCovered && item.pledgedAmount > 0;
                const recentPledges = item.recentPledges || [];

                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-lg border transition-colors duration-200 ${
                      isCovered ? 'border-brand-300 bg-brand-50/20' : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div className="px-5 py-4 sm:px-6 sm:py-5">
                      {/* Main Row */}
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">

                        {/* Identity + Figures */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                            <h4 className="font-bold text-neutral-900 text-base leading-snug">{item.name}</h4>
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap">
                              <span
                                aria-hidden="true"
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  isCovered ? 'bg-brand-600' : isPartial ? 'bg-orange-500' : 'bg-neutral-400'
                                }`}
                              ></span>
                              <span className={isCovered ? 'text-brand-700' : isPartial ? 'text-orange-700' : 'text-neutral-600'}>
                                {isCovered ? (item.remarks === 'Covered' ? 'Covered' : '100% Funded') : (isPartial ? `${item.percentage}% Supported` : 'Needs Support')}
                              </span>
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-neutral-500 mt-2">
                            <span>Qty <strong className="text-neutral-800">{item.qty || '1'}</strong></span>
                            {item.unitCost ? (
                              <>
                                <span className="text-neutral-300" aria-hidden="true">&bull;</span>
                                <span>Unit <strong className="text-neutral-800">{formatUGX(item.unitCost)}</strong></span>
                              </>
                            ) : null}
                            <span className="text-neutral-300" aria-hidden="true">&bull;</span>
                            <span>Target <strong className="text-neutral-800">{formatUGX(item.totalCost)}</strong></span>
                            <span className="text-neutral-300" aria-hidden="true">&bull;</span>
                            <span>
                              Remaining{' '}
                              <strong className={isCovered ? 'text-brand-700' : 'text-orange-600 font-bold'}>
                                {formatUGX(item.remainingAmount)}
                              </strong>
                            </span>
                          </div>
                        </div>

                        {/* Progress */}
                        <div className="w-full lg:w-56 shrink-0">
                          <div className="flex justify-between text-[11px] font-bold text-neutral-500 mb-1">
                            <span>Progress</span>
                            <span className={isCovered ? 'text-brand-700' : 'text-neutral-700'}>{item.percentage}%</span>
                          </div>
                          <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${isCovered ? 'bg-brand-600' : 'bg-accent-600'}`}
                              style={{ width: `${Math.max(item.percentage, isCovered ? 100 : 0)}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Action Button */}
                        <div className="w-full lg:w-48 shrink-0">
                          {isCovered ? (
                            <button
                              disabled
                              className="w-full py-2.5 px-4 rounded-lg text-xs font-bold text-neutral-500 bg-neutral-100 cursor-not-allowed flex items-center justify-center gap-1.5"
                            >
                              <FaCheckDouble className="text-brand-700" aria-hidden="true" /> Fully Sponsored
                            </button>
                          ) : (
                            <button
                              onClick={() => openPledgeModal(item)}
                              className="group w-full py-2.5 px-4 rounded-lg text-xs sm:text-sm font-bold text-brand-950 bg-brand-50 hover:bg-brand-900 hover:text-white border border-brand-300 transition flex items-center justify-center gap-2"
                            >
                              <FaHandHoldingHeart className="text-brand-700 group-hover:text-white" aria-hidden="true" /> Pledge for this Item
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Supporters */}
                      {recentPledges.length > 0 ? (
                        <div className="mt-4 pt-3 border-t border-dashed border-neutral-200">
                          <div className="flex items-center gap-1.5 mb-2">
                            <FaUsers className="text-brand-700 text-xs shrink-0" aria-hidden="true" />
                            <span className="text-[11px] font-bold uppercase text-brand-900">
                              Supporters ({recentPledges.length}):
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {recentPledges.map((p, i) => (
                              <span
                                key={p.id || i}
                                className="text-xs bg-brand-50 hover:bg-brand-100 text-brand-950 border border-brand-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 transition"
                                title={p.message ? `"${p.message}"` : 'Pledged for this item'}
                              >
                                <FaCheck className="text-brand-700 text-[10px]" aria-hidden="true" />
                                <strong>{p.name}</strong>
                                {p.amount && <span className="text-brand-700 font-bold">({formatUGX(p.amount)})</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 pt-3 border-t border-dashed border-neutral-200">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-bold uppercase text-neutral-500 flex items-center gap-1.5 mr-1 shrink-0">
                              <FaUsers className="text-neutral-500" aria-hidden="true" /> Supporters (0):
                            </span>

                            {isCovered && item.remarks === 'Covered' ? (
                              <span className="text-xs bg-brand-50 text-brand-800 border border-brand-200 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                                <FaStar className="text-accent-500 text-[10px]" aria-hidden="true" /> Pre-covered by Family
                              </span>
                            ) : (
                              !isCovered && (
                                <span className="text-xs text-neutral-500 italic">No pledges yet. Be the first!</span>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Contributor Roll of Honor & Blessings Wall */}
        <section className="bg-white rounded-lg p-6 sm:p-8 border border-neutral-200 mb-16" id="honorWall">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-brand-950 flex items-center gap-2">
                <FaHeart className="text-accent-500" aria-hidden="true" /> Contributor Roll of Honor & Blessings
              </h2>
              <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
                Thank you to everyone standing with Mr. Edwin Laston & Jamirah Nakayemba!
              </p>
            </div>
            {rollOfHonorPledges.length > 9 && (
              <button
                onClick={() => setShowAllHonorPledges(!showAllHonorPledges)}
                className="px-4 py-1.5 rounded-md text-xs font-bold text-brand-800 bg-brand-50 hover:bg-brand-100 border border-brand-200 transition"
              >
                {showAllHonorPledges ? 'Show Less' : `View All (${rollOfHonorPledges.length})`}
              </button>
            )}
          </div>

          {rollOfHonorPledges.length === 0 ? (
            <div className="text-center py-10 text-neutral-500 text-sm">
              <FaRegCommentDots className="text-3xl mb-2 block" aria-hidden="true" />
              No pledges recorded yet. Submit the first pledge and leave your warm wishes for the couple!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(showAllHonorPledges ? rollOfHonorPledges : rollOfHonorPledges.slice(0, 9)).map((p, idx) => {
                const initials = (p.name || 'W').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <div key={p.id || idx} className="bg-neutral-50 p-4 rounded-lg border border-neutral-200 flex flex-col gap-2.5 transition-colors hover:bg-white hover:border-neutral-300">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-brand-800 text-white font-bold text-sm flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-neutral-900 text-sm truncate">{p.name}</div>
                        <div className="text-[11px] text-neutral-500">{formatDate(p.date)}</div>
                      </div>
                    </div>

                    <div className="bg-brand-50 text-xs px-3 py-1.5 rounded-lg flex justify-between items-center text-brand-950 font-medium">
                      <span className="truncate mr-2"><FaGift className="text-brand-700 mr-1" aria-hidden="true" /> {p.itemName}</span>
                      <strong className="text-brand-700 shrink-0">{p.amount ? formatUGX(p.amount) : 'Generous'}</strong>
                    </div>

                    {p.message && (
                      <p className="text-xs text-neutral-600 italic border-l-2 border-accent-400 pl-2.5 line-clamp-3">
                        "{p.message}"
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Mobile Money Payment Channels Section */}
        <section className="bg-brand-950 text-white rounded-lg p-6 sm:p-10" id="paymentSection">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <p className="text-accent-300 text-xs font-bold uppercase tracking-widest mb-2">
              Verified Payment Channels
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">How to Fulfill Your Pledge</h2>
            <p className="text-brand-200 text-xs sm:text-sm">
              Please send your contribution directly via Mobile Money to the Groom or Committee Members below. Use your <strong>Name</strong> and <strong>Pledged Item</strong> as reference.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">

            {/* Edwin Laston */}
            <div className="bg-brand-900 rounded-lg p-6 border border-accent-700 flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-extrabold text-accent-300 tracking-wider uppercase mb-1">Groom / Primary Organizer</div>
                <h3 className="text-xl font-bold text-white mb-4">Mr. Edwin Laston</h3>

                <div className="space-y-2 mb-6">
                  <div className="flex items-center justify-between bg-brand-950 p-2.5 rounded-lg text-sm">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-accent-700 text-white">Airtel Money</span>
                    <span className="font-mono font-bold text-white tracking-wide">0703464261</span>
                    <button
                      onClick={() => handleCopy('0703464261')}
                      className="p-1.5 text-neutral-300 hover:text-white"
                      title="Copy Airtel number"
                    >
                      {copiedText === '0703464261' ? <FaCheck className="text-brand-400" aria-hidden="true" /> : <FaRegCopy aria-hidden="true" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between bg-brand-950 p-2.5 rounded-lg text-sm">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-accent-500 text-black">MTN Money</span>
                    <span className="font-mono font-bold text-white tracking-wide">0774324968</span>
                    <button
                      onClick={() => handleCopy('0774324968')}
                      className="p-1.5 text-neutral-300 hover:text-white"
                      title="Copy MTN number"
                    >
                      {copiedText === '0774324968' ? <FaCheck className="text-brand-400" aria-hidden="true" /> : <FaRegCopy aria-hidden="true" />}
                    </button>
                  </div>
                </div>
              </div>

              <a
                href="https://wa.me/256703464261?text=Hello%20Edwin,%20I%20have%20made%20a%20pledge%20for%20your%20Introduction%20Ceremony!"
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 px-4 rounded-lg text-sm font-bold bg-[#25D366] hover:bg-[#1ebd5b] text-white flex items-center justify-center gap-2 transition"
              >
                <FaWhatsapp className="text-base" aria-hidden="true" /> Chat Edwin on WhatsApp
              </a>
            </div>

            {/* KMP Emitu */}
            <div className="bg-brand-900 rounded-lg p-6 border border-brand-800 flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-extrabold text-brand-300 tracking-wider uppercase mb-1">Committee Member</div>
                <h3 className="text-xl font-bold text-white mb-4">Mr. KMP Emitu Ezielkel</h3>

                <div className="bg-brand-950 p-2.5 rounded-lg text-sm flex items-center justify-between mb-6">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-accent-500 text-black">MTN Money</span>
                  <span className="font-mono font-bold text-white tracking-wide">0783987907</span>
                  <button
                    onClick={() => handleCopy('0783987907')}
                    className="p-1.5 text-neutral-300 hover:text-white"
                    title="Copy number"
                  >
                    {copiedText === '0783987907' ? <FaCheck className="text-brand-400" aria-hidden="true" /> : <FaRegCopy aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <a
                href="tel:0783987907"
                className="w-full py-2.5 px-4 rounded-lg text-sm font-bold bg-brand-800 hover:bg-brand-700 text-white flex items-center justify-center gap-2 transition"
              >
                <FaPhone className="text-xs" aria-hidden="true" /> Call Contact
              </a>
            </div>

            {/* Emmanuel Tinkasimire */}
            <div className="bg-brand-900 rounded-lg p-6 border border-brand-800 flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-extrabold text-brand-300 tracking-wider uppercase mb-1">Committee Member</div>
                <h3 className="text-xl font-bold text-white mb-4">Mr. Tinkasimire Emmanuel</h3>

                <div className="bg-brand-950 p-2.5 rounded-lg text-sm flex items-center justify-between mb-6">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-accent-700 text-white">Airtel Money</span>
                  <span className="font-mono font-bold text-white tracking-wide">0706171109</span>
                  <button
                    onClick={() => handleCopy('0706171109')}
                    className="p-1.5 text-neutral-300 hover:text-white"
                    title="Copy number"
                  >
                    {copiedText === '0706171109' ? <FaCheck className="text-brand-400" aria-hidden="true" /> : <FaRegCopy aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <a
                href="tel:0706171109"
                className="w-full py-2.5 px-4 rounded-lg text-sm font-bold bg-brand-800 hover:bg-brand-700 text-white flex items-center justify-center gap-2 transition"
              >
                <FaPhone className="text-xs" aria-hidden="true" /> Call Contact
              </a>
            </div>

          </div>

          {/* Quick USSD Steps */}
          <div className="bg-brand-900 rounded-lg p-4 sm:p-5 border border-brand-800 text-xs text-brand-200">
            <div className="font-bold text-white text-sm mb-2 flex items-center gap-2">
              <FaCircleInfo className="text-accent-400" aria-hidden="true" /> Quick Mobile Money USSD Codes:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-brand-950 p-3 rounded-lg">
                <span className="font-bold text-accent-300 block mb-1">Airtel Money:</span>
                Dial <span className="font-mono font-bold text-white bg-brand-800 px-1.5 py-0.5 rounded">*185#</span> &gt; Select 1 (Send Money) &gt; Enter <span className="font-mono text-white font-bold">0703464261</span> (Edwin Laston).
              </div>
              <div className="bg-brand-950 p-3 rounded-lg">
                <span className="font-bold text-accent-400 block mb-1">MTN Mobile Money:</span>
                Dial <span className="font-mono font-bold text-white bg-brand-800 px-1.5 py-0.5 rounded">*165#</span> &gt; Select 1 (Send Money) &gt; Enter <span className="font-mono text-white font-bold">0774324968</span> (Edwin Laston).
              </div>
            </div>
          </div>
        </section>

        {/* ================= TEST EMAIL NOTIFICATION SECTION ================= */}
        <section className="bg-gradient-to-br from-brand-900 via-brand-950 to-neutral-900 text-white rounded-2xl p-6 sm:p-8 border border-brand-800 shadow-md mb-16" id="testEmailSection">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-brand-700 text-white border border-brand-600">
                  Live System Test
                </span>
                <span className="text-xs text-brand-300 font-semibold">Instant Alert Verification</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <FaPaperPlane className="text-accent-400" aria-hidden="true" /> Test Real-Time Pledge Email Alert
              </h3>
              <p className="text-xs sm:text-sm text-brand-200 mt-1">
                Verify that email notifications are delivered instantly when a contribution is made. Enter any email address below to receive a live test pledge notification.
              </p>
            </div>

            <form onSubmit={handleSendLiveTestEmail} className="w-full md:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative">
                <FaEnvelope className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400 text-xs" aria-hidden="true" />
                <input
                  type="email"
                  required
                  placeholder="Enter email (e.g. edwinlaston@gmail.com)"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  className="w-full sm:w-72 pl-9 pr-3 py-2.5 bg-brand-950/80 border border-brand-700 rounded-xl text-xs text-white placeholder-brand-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:bg-brand-950 transition"
                />
              </div>
              <button
                type="submit"
                disabled={testEmailLoading}
                className="px-5 py-2.5 bg-accent-600 hover:bg-accent-500 text-neutral-950 font-bold rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-2 shrink-0 disabled:opacity-60"
              >
                {testEmailLoading ? (
                  <>
                    <FaSpinner className="animate-spin" aria-hidden="true" /> Sending...
                  </>
                ) : (
                  <>
                    <FaPaperPlane aria-hidden="true" /> Send Test Email
                  </>
                )}
              </button>
            </form>
          </div>

          {testEmailResult && (
            <div className={`mt-4 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${testEmailResult.success ? 'bg-brand-800/80 text-brand-100 border border-brand-600' : 'bg-red-950/80 text-red-200 border border-red-800'}`}>
              {testEmailResult.success ? <FaCircleCheck className="text-accent-400 shrink-0 text-sm" aria-hidden="true" /> : <FaCircleInfo className="text-red-400 shrink-0 text-sm" aria-hidden="true" />}
              <span>{testEmailResult.msg}</span>
            </div>
          )}
        </section>

      </main>

      {/* Footer */}
      <footer className="mt-auto bg-brand-950 text-brand-300 py-8 px-4 border-t border-brand-900">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm">
          <div>
            <div className="font-bold text-white text-base">Mr. Edwin Laston & Jamirah Nakayemba</div>
            <div>Introduction Ceremony (Kwanjula) — Friday, 27th November 2026</div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a href="/api/budget/pdf" target="_blank" rel="noopener noreferrer" className="underline hover:text-white flex items-center gap-1">
              <FaFilePdf className="text-accent-400" aria-hidden="true" /> Pledge Report
            </a>
            <a href="#testEmailSection" className="underline hover:text-white flex items-center gap-1">
              <FaPaperPlane className="text-accent-400" aria-hidden="true" /> Test Email
            </a>
            <button onClick={() => openPledgeModal(null)} className="underline hover:text-white">Make a Pledge</button>
            <Link href="/admin" className="underline hover:text-white">Committee Admin Portal</Link>
          </div>
        </div>
      </footer>

      {/* ================= MODAL: PLEDGE SUBMISSION (PUBLIC) ================= */}
      {isPledgeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-900 to-brand-900 text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <FaHandHoldingHeart className="text-accent-400" aria-hidden="true" /> Make a Pledge
                </h3>
                <p className="text-xs text-brand-200">Enter your name and contribution details (Minimum 5,000 UGX)</p>
              </div>
              <button
                onClick={() => setIsPledgeModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm"
                aria-label="Close"
              >
                <FaXmark aria-hidden="true" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handlePledgeSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-sm">
              
              {/* Selected Item Banner or Dropdown */}
              {selectedItem ? (
                <div className="bg-brand-50 border border-brand-200 p-3.5 rounded-2xl flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-brand-800">Target Item</span>
                    <h4 className="font-bold text-neutral-900 text-sm sm:text-base">{selectedItem.name} {selectedItem.qty ? `(${selectedItem.qty})` : ''}</h4>
                    <div className="text-xs text-neutral-500 flex gap-3 mt-0.5">
                      <span>Total: <strong>{formatUGX(selectedItem.totalCost)}</strong></span>
                      <span>Remaining: <strong className="text-orange-600 font-bold">{formatUGX(selectedItem.remainingAmount)}</strong></span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="text-xs font-semibold text-brand-800 hover:underline"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">Select Item to Support *</label>
                  <select
                    value={formData.itemId}
                    onChange={(e) => setFormData(prev => ({ ...prev, itemId: e.target.value }))}
                    className="w-full p-2.5 text-sm bg-neutral-50 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-brand-700 focus:outline-none"
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
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">Your Full Name *</label>
                <div className="relative">
                  <FaRegUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Uncle David / Aunt Sarah / Moses"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-neutral-300 rounded-xl focus:ring-2 focus:ring-brand-700 focus:outline-none"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">Phone Number (MTN / Airtel) *</label>
                <div className="relative">
                  <FaPhone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 0772 123456"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-neutral-300 rounded-xl focus:ring-2 focus:ring-brand-700 focus:outline-none"
                  />
                </div>
                <span className="text-[11px] text-neutral-500 mt-0.5 block">Used by the committee to verify Mobile Money and send receipts</span>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">Email Address (Optional)</label>
                <div className="relative">
                  <FaRegEnvelope className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
                  <input
                    type="email"
                    placeholder="e.g. you@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-neutral-300 rounded-xl focus:ring-2 focus:ring-brand-700 focus:outline-none"
                  />
                </div>
                <span className="text-[11px] text-neutral-500 mt-0.5 block">Receive an automated confirmation email receipt</span>
              </div>

              {/* Amount */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-neutral-700 uppercase">Pledge Amount (UGX) *</label>
                  <span className="text-[11px] font-bold text-brand-700">Min: 5,000 UGX</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-neutral-500">UGX</span>
                  <input
                    type="number"
                    required
                    min="5000"
                    step="5000"
                    placeholder="e.g. 50,000"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full pl-13 pr-3 py-2 text-sm font-bold bg-white border border-neutral-300 rounded-xl focus:ring-2 focus:ring-brand-700 focus:outline-none"
                  />
                </div>

                {/* Live Spillover Notice */}
                {selectedItem && Number(formData.amount) > selectedItem.remainingAmount && selectedItem.remainingAmount > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 mt-2 flex items-start gap-2">
                    <span className="text-base shrink-0">🎉</span>
                    <div>
                      <strong>100% Item Cover + Excess Spillover:</strong> Pledging <strong>{formatUGX(Number(formData.amount))}</strong> will completely fund <strong>{selectedItem.name}</strong> 100% ({formatUGX(selectedItem.remainingAmount)}), and your extra <strong>{formatUGX(Number(formData.amount) - selectedItem.remainingAmount)}</strong> will automatically be added to the <strong>General Ceremony Fund</strong>!
                    </div>
                  </div>
                )}

                {/* Quick Chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[5000, 20000, 50000, 100000, 200000, 500000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => applyQuickAmount(val)}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition"
                    >
                      +{formatUGX(val)}
                    </button>
                  ))}
                  {selectedItem && selectedItem.remainingAmount > 0 && (
                    <button
                      type="button"
                      onClick={() => applyQuickAmount(selectedItem.remainingAmount)}
                      className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 hover:bg-orange-200 text-orange-800 border border-orange-300 transition"
                    >
                      Cover Remaining ({formatUGX(selectedItem.remainingAmount)})
                    </button>
                  )}
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">Fulfillment Mode</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  className="w-full p-2.5 text-sm bg-neutral-50 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-brand-700 focus:outline-none"
                >
                  <option value="Airtel Money (0703464261)">Airtel Money (0703464261 - Edwin Laston)</option>
                  <option value="MTN Mobile Money (0774324968)">MTN Mobile Money (0774324968 - Edwin Laston)</option>
                  <option value="Cash / Hand Delivery">Cash / Hand Delivery</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="In-Kind / Physical Delivery">In-Kind / Physical Item Delivery</option>
                </select>
              </div>

              {/* Blessing Message */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">Warm Blessing / Note to Couple</label>
                <textarea
                  rows="2"
                  placeholder="e.g. Wishing Edwin & Jamirah God's richest blessings and joy!"
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full p-2.5 text-sm bg-white border border-neutral-300 rounded-xl focus:ring-2 focus:ring-brand-700 focus:outline-none"
                ></textarea>
              </div>

              {/* Privacy Checkboxes */}
              <div className="bg-neutral-50 p-3 rounded-xl space-y-2 text-xs">
                <label className="flex items-center gap-2 text-neutral-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isAnonymous}
                    onChange={(e) => setFormData(prev => ({ ...prev, isAnonymous: e.target.checked }))}
                    className="rounded text-brand-700 focus:ring-brand-600"
                  />
                  <span>Display name as <strong>"Generous Well-wisher"</strong> on public wall</span>
                </label>
                <label className="flex items-center gap-2 text-neutral-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hideAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, hideAmount: e.target.checked }))}
                    className="rounded text-brand-700 focus:ring-brand-600"
                  />
                  <span>Keep exact amount private on public wall</span>
                </label>
              </div>

              {/* Notice */}
              <div className="bg-accent-50 border border-accent-200 p-3 rounded-xl text-xs text-accent-900 flex items-start gap-2">
                <FaBell className="text-accent-700 mt-0.5" aria-hidden="true" />
                <span>An instant email alert is dispatched to Mr. Edwin Laston, and the budget balance subtracts in real-time across all connected screens.</span>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPledgeModalOpen(false)}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs sm:text-sm font-bold text-white bg-brand-800 hover:bg-brand-900 rounded-xl shadow transition flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <FaSpinner className="animate-spin" aria-hidden="true" /> Recording...
                    </>
                  ) : (
                    <>
                      <FaPaperPlane aria-hidden="true" /> Submit & Subtract
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: SUCCESS ACKNOWLEDGEMENT ================= */}
      {isSuccessModalOpen && receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center animate-in zoom-in duration-200">
            <div className="w-16 h-16 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-3xl mx-auto mb-4">
              <FaCircleCheck aria-hidden="true" />
            </div>

            <h3 className="text-xl font-bold text-brand-950 mb-1">
              Thank You for Your Blessing!
            </h3>
            <p className="text-xs text-neutral-500 mb-4">
              Your contribution has been recorded and subtracted from the ceremony budget in real-time.
            </p>

            {/* 100% Item Cover Celebration Banner */}
            {receiptData.spilloverInfo?.covered100 && (
              <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 text-xs text-amber-900 mb-4 text-left">
                <div className="font-black text-amber-950 flex items-center gap-1.5 mb-1">
                  <FaTrophy className="text-accent-600" aria-hidden="true" /> 100% Item Fully Funded!
                </div>
                <div>
                  You have completely covered <strong>{receiptData.spilloverInfo.itemName}</strong>!
                  {receiptData.spilloverInfo.spilloverAmount > 0 && (
                    <span className="block mt-1 font-semibold text-brand-800">
                      + Your extra {formatUGX(receiptData.spilloverInfo.spilloverAmount)} was added to the General Ceremony Fund.
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 text-left space-y-2 text-xs mb-5">
              <div className="flex justify-between">
                <span className="text-neutral-500">Contributor:</span>
                <strong className="text-neutral-800">{receiptData.name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Pledged For:</span>
                <strong className="text-neutral-800">{receiptData.item}</strong>
              </div>
              <div className="flex justify-between pt-2 border-t border-neutral-200 text-sm font-bold">
                <span className="text-neutral-700">Total Amount:</span>
                <span className="text-brand-700">{formatUGX(receiptData.amount)}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-neutral-500">Notification Alert:</span>
                <span className="text-[11px] font-bold text-brand-700 bg-brand-100 px-2 py-0.5 rounded-full">
                  <FaEnvelope className="mr-1" aria-hidden="true" /> Dispatched to Inboxes
                </span>
              </div>
            </div>

            <div className="bg-accent-50 border border-accent-200 rounded-2xl p-3.5 text-xs text-accent-900 mb-5">
              <div className="font-bold mb-1">Fulfill via Mobile Money:</div>
              <div className="flex justify-around font-mono font-bold">
                <span>Airtel: 0703464261</span>
                <span>MTN: 0774324968</span>
              </div>
              <div className="text-[10px] text-accent-700 mt-1">Ref: {receiptData.name} - {receiptData.item}</div>
            </div>

            <div className="space-y-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`I just pledged ${formatUGX(receiptData.amount)} towards ${receiptData.item} for Mr. Edwin Laston & Jamirah Nakayemba's Introduction Ceremony on 27th Nov 2026! Join us in contributing here: ${typeof window !== 'undefined' ? window.location.origin : ''}`)}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#25D366] text-white flex items-center justify-center gap-2 hover:bg-[#1ebd5b] transition"
              >
                <FaWhatsapp className="text-sm" aria-hidden="true" /> Share on WhatsApp
              </a>
              <button
                onClick={() => setIsSuccessModalOpen(false)}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 transition"
              >
                Done & Return to Budget
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
