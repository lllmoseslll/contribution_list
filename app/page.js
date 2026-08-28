'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import confetti from 'canvas-confetti';

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

  const eventSourceRef = useRef(null);

  // Show Toast
  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Real-time Server-Sent Events (SSE) connection
  useEffect(() => {
    const connectSSE = () => {
      try {
        const es = new EventSource('/api/stream');
        eventSourceRef.current = es;

        es.onopen = () => {
          setLiveConnected(true);
        };

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'INITIAL_STATE') {
              setBudget(data.payload);
              setIsLoading(false);
            } else if (data.type === 'PLEDGE_ADDED') {
              setBudget(data.state);
              const p = data.pledge;
              const amt = p.amount ? formatUGX(p.amount) : 'a generous contribution';
              showToast(`🎉 ${p.name} just pledged ${amt} for ${p.itemName}!`, 'success');
            } else if (data.type === 'BUDGET_UPDATED') {
              setBudget(data.state);
            }
          } catch (e) {
            console.error('Failed to parse SSE event:', e);
          }
        };

        es.onerror = () => {
          setLiveConnected(false);
          es.close();
          // Fallback fetch after 3s
          setTimeout(() => {
            fetchInitialBudget();
            connectSSE();
          }, 3000);
        };
      } catch (err) {
        console.error('SSE initialization error:', err);
        fetchInitialBudget();
      }
    };

    const fetchInitialBudget = async () => {
      try {
        const res = await fetch('/api/budget');
        const data = await res.json();
        setBudget(data);
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching budget:', err);
      }
    };

    fetchInitialBudget();
    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
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
    if (!numAmt || numAmt <= 0) {
      showToast('Please enter a valid contribution amount.', 'error');
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
        item: data.pledge?.itemName || 'Ceremony Contribution'
      });

      // Confetti burst!
      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#d97706', '#059669', '#fbbf24', '#10b981', '#ffffff']
        });
      } catch (e) {}

      setIsSuccessModalOpen(true);
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
    <div className="flex-1 flex flex-col bg-slate-50 text-slate-900 selection:bg-emerald-200">
      
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-emerald-900 text-emerald-100 border-l-4 border-emerald-400' : 'bg-slate-900 text-white border-l-4 border-amber-500'
        }`}>
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} className="opacity-70 hover:opacity-100 ml-2">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      {/* Top Announcement Bar */}
      <div className="bg-emerald-950 text-emerald-200 text-xs sm:text-sm py-2.5 px-4 border-b border-emerald-800/50">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-900 text-emerald-300 border border-emerald-700/60">
              <span className={`w-2 h-2 rounded-full ${liveConnected ? 'bg-emerald-400 pulse-dot' : 'bg-amber-400'}`}></span>
              {liveConnected ? 'Live Sync Active' : 'Connecting...'}
            </span>
            <span className="hidden sm:inline text-emerald-400/40">•</span>
            <span className="text-emerald-100 font-medium">
              <i className="fa-solid fa-calendar-days text-amber-400 mr-1.5"></i>
              Ceremony Date: <strong>Friday, 27th November 2026</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/introduction-budget-edwin-laston.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-emerald-200 bg-emerald-900/60 hover:bg-emerald-800 border border-emerald-700/60 transition"
              title="View original official PDF"
            >
              <i className="fa-solid fa-file-pdf text-rose-400"></i> Official PDF
            </a>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition"
            >
              <i className="fa-solid fa-lock text-[10px]"></i> Committee Portal
            </Link>
          </div>
        </div>
      </div>

      {/* Hero Banner */}
      <header className="relative bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 text-white py-14 sm:py-18 px-4 text-center overflow-hidden border-b-4 border-amber-500 shadow-xl">
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:24px_24px]"></div>
        
        <div className="relative max-w-4xl mx-auto z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-bold tracking-widest uppercase mb-4 shadow-sm">
            <i className="fa-solid fa-gem text-amber-400"></i> The Kwanjula Budget
          </div>

          <h1 className="font-serif-royal text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-3 drop-shadow-md">
            Mr. Edwin Laston <span className="text-amber-400 italic font-serif">&</span> Jamirah Nakayemba
          </h1>

          <p className="text-lg sm:text-2xl text-emerald-200 font-medium mb-3">
            Official Introduction Ceremony Contribution & Pledges Board
          </p>

          <p className="max-w-2xl mx-auto text-slate-200 text-sm sm:text-base leading-relaxed mb-8">
            Welcome family, relatives, and dear friends! Stand with Edwin & Jamirah as they take this blessed step. Choose any item from our official budget below to make a pledge and write your name. All contributions deduct from the remaining total in real-time.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => openPledgeModal(null)}
              className="px-6 py-3 rounded-xl font-bold text-sm sm:text-base bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-lg shadow-amber-600/30 transition transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              <i className="fa-solid fa-heart-circle-check"></i> Make a Pledge Now
            </button>
            <a
              href="#budgetSection"
              className="px-6 py-3 rounded-xl font-semibold text-sm sm:text-base bg-white text-emerald-950 hover:bg-slate-100 shadow-md transition transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              <i className="fa-solid fa-list-check"></i> View Budget Items
            </a>
            <a
              href="/introduction-budget-edwin-laston.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3 rounded-xl font-semibold text-sm sm:text-base bg-emerald-950/80 hover:bg-emerald-900 border border-amber-400/40 text-amber-300 transition flex items-center gap-2 shadow-md"
            >
              <i className="fa-solid fa-file-pdf text-rose-400"></i> Download Official PDF
            </a>
            <a
              href="#paymentSection"
              className="px-5 py-3 rounded-xl font-semibold text-sm sm:text-base bg-emerald-800/60 hover:bg-emerald-800 border border-emerald-600/40 text-emerald-100 transition flex items-center gap-2"
            >
              <i className="fa-solid fa-mobile-screen-button"></i> Mobile Money
            </a>
          </div>
        </div>
      </header>

      {/* Financial Metrics Dashboard */}
      <section className="max-w-6xl mx-auto w-full px-4 -mt-8 relative z-20 mb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          
          <div className="bg-white p-5 rounded-2xl shadow-lg border border-slate-200/80 flex items-center gap-4 transition hover:-translate-y-1">
            <div className="w-13 h-13 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl shrink-0">
              <i className="fa-solid fa-coins"></i>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Budget</div>
              <div className="text-xl sm:text-2xl font-black text-slate-900">{formatUGX(stats.totalBudget)}</div>
              <div className="text-xs text-slate-400">Official Ceremony Budget</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-lg border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/50 flex items-center gap-4 transition hover:-translate-y-1">
            <div className="w-13 h-13 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl shrink-0">
              <i className="fa-solid fa-circle-check"></i>
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Total Raised & Pledged</div>
              <div className="text-xl sm:text-2xl font-black text-emerald-700">{formatUGX(stats.totalCoveredAndPledged)}</div>
              <div className="text-xs font-bold text-emerald-600">{stats.totalPercentage}% Funded</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-lg border border-amber-200 bg-gradient-to-br from-white to-amber-50/50 flex items-center gap-4 transition hover:-translate-y-1">
            <div className="w-13 h-13 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center text-xl shrink-0">
              <i className="fa-solid fa-scale-balanced"></i>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Remaining Balance</div>
              <div className="text-xl sm:text-2xl font-black text-amber-600">{formatUGX(stats.totalRemaining)}</div>
              <div className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                <i className="fa-solid fa-arrow-down"></i> Live subtracting
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-lg border border-slate-200/80 flex items-center gap-4 transition hover:-translate-y-1">
            <div className="w-13 h-13 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-xl shrink-0">
              <i className="fa-solid fa-users"></i>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Supporters</div>
              <div className="text-xl sm:text-2xl font-black text-slate-900">{stats.pledgersCount} Contributors</div>
              <div className="text-xs text-slate-400">{stats.totalPledgesCount} pledges recorded</div>
            </div>
          </div>

        </div>

        {/* Overall Progress Meter */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-md border border-slate-200/80">
          <div className="flex justify-between items-center text-xs sm:text-sm font-semibold text-slate-700 mb-2">
            <span>Ceremony Funding Milestone</span>
            <span className="text-emerald-700 font-bold">{stats.totalPercentage}% of {formatUGX(stats.totalBudget)} ({formatUGX(stats.totalRemaining)} remaining)</span>
          </div>
          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-emerald-600 to-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, Math.max(3, stats.totalPercentage))}%` }}
            ></div>
          </div>
        </div>
      </section>

      {/* Main Budget Section */}
      <main className="max-w-6xl mx-auto w-full px-4 mb-16" id="budgetSection">
        
        {/* Controls & Search */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6">
          <div>
            <h2 className="font-serif-royal text-2xl sm:text-3xl font-bold text-emerald-950">Budget Sections & Items</h2>
            <p className="text-slate-500 text-sm mt-1">Select any item below to sponsor all or part of it.</p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="w-full sm:w-80 relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
              <input
                type="text"
                placeholder="Search items (e.g. Cows, Rice, Suitcase)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-300 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <i className="fa-solid fa-xmark text-sm"></i>
                </button>
              )}
            </div>

            <a
              href="/introduction-budget-edwin-laston.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-full transition whitespace-nowrap"
              title="Inspect official signed budget"
            >
              <i className="fa-solid fa-file-pdf text-rose-500"></i> PDF
            </a>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
          {[
            { id: 'all', label: 'All Sections', icon: 'fa-border-all' },
            { id: 'sec-A', label: 'A: Important Gifts', icon: 'fa-award' },
            { id: 'sec-B', label: 'B: Clothes & Suitcases', icon: 'fa-shirt' },
            { id: 'sec-C', label: 'C: Gifts & Groceries', icon: 'fa-basket-shopping' },
            { id: 'sec-E', label: 'E: Others & Operations', icon: 'fa-clapperboard' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap flex items-center gap-2 border transition ${
                activeCategory === tab.id
                  ? 'bg-emerald-900 border-emerald-900 text-white shadow-md'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <i className={`fa-solid ${tab.icon}`}></i> {tab.label}
            </button>
          ))}
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
            <i className="fa-solid fa-filter"></i> Filter:
          </span>
          {[
            { id: 'all', label: 'All Items' },
            { id: 'needs-pledges', label: 'Needs Support' },
            { id: 'partially-pledged', label: 'Partially Supported' },
            { id: 'fully-covered', label: 'Fully Covered' }
          ].map(chip => (
            <button
              key={chip.id}
              onClick={() => setActiveFilter(chip.id)}
              className={`px-3 py-1 rounded-md text-xs font-medium border transition ${
                activeFilter === chip.id
                  ? 'bg-amber-100 border-amber-400 text-amber-900 font-bold'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* General Pledge Callout */}
        <div className="bg-gradient-to-r from-amber-50 to-amber-100/60 border border-amber-200 rounded-2xl p-5 sm:p-6 mb-10 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-500 text-white flex items-center justify-center text-xl shrink-0">
              <i className="fa-solid fa-hand-holding-dollar"></i>
            </div>
            <div>
              <h3 className="font-bold text-amber-950 text-base sm:text-lg">Prefer to make a General Contribution?</h3>
              <p className="text-amber-800 text-xs sm:text-sm mt-0.5">
                Support the overall ceremony expenses with any amount without selecting a specific single item.
              </p>
            </div>
          </div>
          <button
            onClick={() => openPledgeModal(null)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md transition shrink-0 flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-gift"></i> Make General Pledge
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-16 text-slate-500">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-emerald-700 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm font-medium">Loading real-time budget data...</p>
          </div>
        )}

        {/* Empty Search / Filter Result */}
        {!isLoading && filteredSections.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <i className="fa-solid fa-magnifying-glass text-slate-300 text-4xl mb-3"></i>
            <h3 className="text-base font-bold text-slate-700">No matching items found</h3>
            <p className="text-xs text-slate-400 mt-1">Try resetting your search query or selecting "All Items".</p>
            <button
              onClick={() => { setSearchQuery(''); setActiveCategory('all'); setActiveFilter('all'); }}
              className="mt-4 px-4 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition"
            >
              Reset All Filters
            </button>
          </div>
        )}

        {/* Budget Items Sections */}
        {!isLoading && filteredSections.map(sec => (
          <div key={sec.id} className="mb-12">
            {/* Section Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b-2 border-slate-200 mb-6">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-emerald-900 text-white font-extrabold flex items-center justify-center text-sm shadow">
                  {sec.code}
                </span>
                <div>
                  <h3 className="font-serif-royal text-xl sm:text-2xl font-bold text-emerald-950">
                    Section {sec.code}: {sec.title}
                  </h3>
                  <p className="text-xs text-slate-500">{sec.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs sm:text-sm text-slate-600">
                <span>Target: <strong>{formatUGX(sec.totalCost)}</strong></span>
                <span>Remaining: <strong className="text-amber-600 font-bold">{formatUGX(sec.remainingAmount)}</strong></span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 font-bold text-slate-700 text-xs">
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
                    className={`relative bg-white rounded-2xl border overflow-hidden transition-all duration-200 hover:shadow-md ${
                      isCovered ? 'border-emerald-300 bg-emerald-50/20' : 'border-slate-200/90 hover:border-slate-300'
                    }`}
                  >
                    {/* Status Rail */}
                    <span
                      aria-hidden="true"
                      className={`absolute inset-y-0 left-0 w-1.5 ${
                        isCovered ? 'bg-emerald-600' : isPartial ? 'bg-amber-500' : 'bg-rose-300'
                      }`}
                    ></span>

                    <div className="pl-5 pr-4 sm:pl-6 sm:pr-5 py-4 sm:py-5">
                      {/* Main Row */}
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">

                        {/* Identity + Figures */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                            <h4 className="font-bold text-slate-900 text-base leading-snug">{item.name}</h4>
                            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap ${
                              isCovered
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : isPartial
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {isCovered ? (item.remarks === 'Covered' ? 'Covered' : '100% Funded') : (isPartial ? `${item.percentage}% Supported` : 'Needs Support')}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 mt-2">
                            <span>Qty <strong className="text-slate-800">{item.qty || '1'}</strong></span>
                            {item.unitCost ? (
                              <>
                                <span className="text-slate-300">&bull;</span>
                                <span>Unit <strong className="text-slate-800">{formatUGX(item.unitCost)}</strong></span>
                              </>
                            ) : null}
                            <span className="text-slate-300">&bull;</span>
                            <span>Target <strong className="text-slate-800">{formatUGX(item.totalCost)}</strong></span>
                            <span className="text-slate-300">&bull;</span>
                            <span>
                              Remaining{' '}
                              <strong className={isCovered ? 'text-emerald-700' : 'text-amber-600'}>
                                {formatUGX(item.remainingAmount)}
                              </strong>
                            </span>
                          </div>
                        </div>

                        {/* Progress */}
                        <div className="w-full lg:w-56 shrink-0">
                          <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1">
                            <span>Progress</span>
                            <span className={isCovered ? 'text-emerald-700' : 'text-slate-700'}>{item.percentage}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${isCovered ? 'bg-emerald-600' : 'bg-gradient-to-r from-amber-500 to-amber-600'}`}
                              style={{ width: `${Math.max(item.percentage, isCovered ? 100 : 0)}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Action Button */}
                        <div className="w-full lg:w-48 shrink-0">
                          {isCovered ? (
                            <button
                              disabled
                              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-slate-400 bg-slate-100 cursor-not-allowed flex items-center justify-center gap-1.5"
                            >
                              <i className="fa-solid fa-check-double text-emerald-600"></i> Fully Sponsored
                            </button>
                          ) : (
                            <button
                              onClick={() => openPledgeModal(item)}
                              className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-emerald-950 bg-emerald-50 hover:bg-emerald-900 hover:text-white border border-emerald-300 transition flex items-center justify-center gap-2 shadow-sm"
                            >
                              <i className="fa-solid fa-hand-holding-heart text-amber-500"></i> Pledge for this Item
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Supporters */}
                      <div className="mt-4 pt-3 border-t border-dashed border-slate-200">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-bold uppercase text-slate-400 flex items-center gap-1.5 mr-1 shrink-0">
                            <i className="fa-solid fa-users text-slate-400"></i> Supporters ({recentPledges.length}):
                          </span>

                          {isCovered && item.remarks === 'Covered' && recentPledges.length === 0 && (
                            <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                              <i className="fa-solid fa-star text-amber-500 text-[10px]"></i> Pre-covered by Family
                            </span>
                          )}

                          {recentPledges.length > 0 ? (
                            recentPledges.map((p, i) => (
                              <span
                                key={p.id || i}
                                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 transition"
                                title={p.message ? `"${p.message}"` : 'Pledged for this item'}
                              >
                                <i className="fa-solid fa-check text-emerald-600 text-[10px]"></i>
                                <strong>{p.name}</strong>
                                {p.amount && <span className="text-emerald-700 font-bold">({formatUGX(p.amount)})</span>}
                              </span>
                            ))
                          ) : (
                            !isCovered && (
                              <span className="text-xs text-slate-400 italic">No pledges yet. Be the first!</span>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Contributor Roll of Honor & Blessings Wall */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-md mb-16">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
            <div>
              <h2 className="font-serif-royal text-2xl font-bold text-emerald-950 flex items-center gap-2">
                <i className="fa-solid fa-heart text-rose-500"></i> Contributor Roll of Honor & Blessings
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Thank you to everyone standing with Mr. Edwin Laston & Jamirah Nakayemba!
              </p>
            </div>
            {rollOfHonorPledges.length > 9 && (
              <button
                onClick={() => setShowAllHonorPledges(!showAllHonorPledges)}
                className="px-4 py-1.5 rounded-full text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
              >
                {showAllHonorPledges ? 'Show Less' : `View All (${rollOfHonorPledges.length})`}
              </button>
            )}
          </div>

          {rollOfHonorPledges.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              <i className="fa-regular fa-comment-dots text-3xl mb-2 block"></i>
              No pledges recorded yet. Submit the first pledge and leave your warm wishes for the couple!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(showAllHonorPledges ? rollOfHonorPledges : rollOfHonorPledges.slice(0, 9)).map((p, idx) => {
                const initials = (p.name || 'W').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <div key={p.id || idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col gap-2.5 transition hover:bg-white hover:shadow">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-800 text-white font-bold text-sm flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-sm truncate">{p.name}</div>
                        <div className="text-[11px] text-slate-400">{formatDate(p.date)}</div>
                      </div>
                    </div>

                    <div className="bg-emerald-50 text-xs px-3 py-1.5 rounded-lg flex justify-between items-center text-emerald-950 font-medium">
                      <span className="truncate mr-2"><i className="fa-solid fa-gift text-emerald-700 mr-1"></i> {p.itemName}</span>
                      <strong className="text-emerald-700 shrink-0">{p.amount ? formatUGX(p.amount) : 'Generous'}</strong>
                    </div>

                    {p.message && (
                      <p className="text-xs text-slate-600 italic border-l-2 border-amber-400 pl-2.5 line-clamp-3">
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
        <section className="bg-gradient-to-br from-emerald-950 to-teal-950 text-white rounded-3xl p-6 sm:p-10 shadow-xl" id="paymentSection">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 uppercase tracking-wider mb-2">
              <i className="fa-solid fa-shield-check"></i> Verified Payment Channels
            </span>
            <h2 className="font-serif-royal text-2xl sm:text-3xl font-bold mb-2">How to Fulfill Your Pledge</h2>
            <p className="text-emerald-200 text-xs sm:text-sm">
              Please send your contribution directly via Mobile Money to the Groom or Committee Members below. Use your <strong>Name</strong> and <strong>Pledged Item</strong> as reference.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
            
            {/* Edwin Laston */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-amber-400/50 flex flex-col justify-between shadow-lg">
              <div>
                <div className="text-[11px] font-extrabold text-amber-300 tracking-wider uppercase mb-1">Groom / Primary Organizer</div>
                <h3 className="text-xl font-bold text-white mb-4">Mr. Edwin Laston</h3>

                <div className="space-y-2 mb-6">
                  <div className="flex items-center justify-between bg-black/30 p-2.5 rounded-xl text-sm">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-600 text-white">Airtel Money</span>
                    <span className="font-mono font-bold text-white tracking-wide">0703464261</span>
                    <button
                      onClick={() => handleCopy('0703464261')}
                      className="p-1.5 text-slate-300 hover:text-white"
                      title="Copy Airtel number"
                    >
                      <i className={`fa-${copiedText === '0703464261' ? 'solid fa-check text-emerald-400' : 'regular fa-copy'}`}></i>
                    </button>
                  </div>

                  <div className="flex items-center justify-between bg-black/30 p-2.5 rounded-xl text-sm">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500 text-black">MTN Money</span>
                    <span className="font-mono font-bold text-white tracking-wide">0774324968</span>
                    <button
                      onClick={() => handleCopy('0774324968')}
                      className="p-1.5 text-slate-300 hover:text-white"
                      title="Copy MTN number"
                    >
                      <i className={`fa-${copiedText === '0774324968' ? 'solid fa-check text-emerald-400' : 'regular fa-copy'}`}></i>
                    </button>
                  </div>
                </div>
              </div>

              <a
                href="https://wa.me/256703464261?text=Hello%20Edwin,%20I%20have%20made%20a%20pledge%20for%20your%20Introduction%20Ceremony!"
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 px-4 rounded-xl text-sm font-bold bg-[#25D366] hover:bg-[#1ebd5b] text-white flex items-center justify-center gap-2 transition"
              >
                <i className="fa-brands fa-whatsapp text-base"></i> Chat Edwin on WhatsApp
              </a>
            </div>

            {/* KMP Emitu */}
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-extrabold text-emerald-300 tracking-wider uppercase mb-1">Committee Member</div>
                <h3 className="text-xl font-bold text-white mb-4">Mr. KMP Emitu Ezielkel</h3>

                <div className="bg-black/30 p-2.5 rounded-xl text-sm flex items-center justify-between mb-6">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500 text-black">MTN Money</span>
                  <span className="font-mono font-bold text-white tracking-wide">0783987907</span>
                  <button
                    onClick={() => handleCopy('0783987907')}
                    className="p-1.5 text-slate-300 hover:text-white"
                    title="Copy number"
                  >
                    <i className={`fa-${copiedText === '0783987907' ? 'solid fa-check text-emerald-400' : 'regular fa-copy'}`}></i>
                  </button>
                </div>
              </div>

              <a
                href="tel:0783987907"
                className="w-full py-2.5 px-4 rounded-xl text-sm font-bold bg-white/10 hover:bg-white/20 text-white flex items-center justify-center gap-2 transition"
              >
                <i className="fa-solid fa-phone text-xs"></i> Call Contact
              </a>
            </div>

            {/* Emmanuel Tinkasimire */}
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-extrabold text-emerald-300 tracking-wider uppercase mb-1">Committee Member</div>
                <h3 className="text-xl font-bold text-white mb-4">Mr. Tinkasimire Emmanuel</h3>

                <div className="bg-black/30 p-2.5 rounded-xl text-sm flex items-center justify-between mb-6">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-600 text-white">Airtel Money</span>
                  <span className="font-mono font-bold text-white tracking-wide">0706171109</span>
                  <button
                    onClick={() => handleCopy('0706171109')}
                    className="p-1.5 text-slate-300 hover:text-white"
                    title="Copy number"
                  >
                    <i className={`fa-${copiedText === '0706171109' ? 'solid fa-check text-emerald-400' : 'regular fa-copy'}`}></i>
                  </button>
                </div>
              </div>

              <a
                href="tel:0706171109"
                className="w-full py-2.5 px-4 rounded-xl text-sm font-bold bg-white/10 hover:bg-white/20 text-white flex items-center justify-center gap-2 transition"
              >
                <i className="fa-solid fa-phone text-xs"></i> Call Contact
              </a>
            </div>

          </div>

          {/* Quick USSD Steps */}
          <div className="bg-black/25 rounded-2xl p-4 sm:p-5 border border-white/10 text-xs text-emerald-200">
            <div className="font-bold text-white text-sm mb-2 flex items-center gap-2">
              <i className="fa-solid fa-circle-info text-amber-400"></i> Quick Mobile Money USSD Codes:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white/5 p-3 rounded-xl">
                <span className="font-bold text-red-400 block mb-1">Airtel Money:</span>
                Dial <span className="font-mono font-bold text-white bg-black/40 px-1.5 py-0.5 rounded">*185#</span> &gt; Select 1 (Send Money) &gt; Enter <span className="font-mono text-white font-bold">0703464261</span> (Edwin Laston).
              </div>
              <div className="bg-white/5 p-3 rounded-xl">
                <span className="font-bold text-amber-400 block mb-1">MTN Mobile Money:</span>
                Dial <span className="font-mono font-bold text-white bg-black/40 px-1.5 py-0.5 rounded">*165#</span> &gt; Select 1 (Send Money) &gt; Enter <span className="font-mono text-white font-bold">0774324968</span> (Edwin Laston).
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="mt-auto bg-emerald-950 text-emerald-300 py-8 px-4 border-t border-emerald-900">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm">
          <div>
            <div className="font-serif-royal font-bold text-white text-base">Mr. Edwin Laston & Jamirah Nakayemba</div>
            <div>Introduction Ceremony (Kwanjula) — Friday, 27th November 2026</div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a href="/introduction-budget-edwin-laston.pdf" target="_blank" rel="noopener noreferrer" className="underline hover:text-white flex items-center gap-1">
              <i className="fa-solid fa-file-pdf text-rose-400"></i> Official PDF
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
            <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="font-serif-royal text-lg font-bold flex items-center gap-2">
                  <i className="fa-solid fa-hand-holding-heart text-amber-400"></i> Make a Pledge
                </h3>
                <p className="text-xs text-emerald-200">Enter your name and contribution details</p>
              </div>
              <button
                onClick={() => setIsPledgeModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handlePledgeSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-sm">
              
              {/* Selected Item Banner or Dropdown */}
              {selectedItem ? (
                <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-emerald-800">Target Item</span>
                    <h4 className="font-bold text-slate-900 text-sm sm:text-base">{selectedItem.name} {selectedItem.qty ? `(${selectedItem.qty})` : ''}</h4>
                    <div className="text-xs text-slate-500 flex gap-3 mt-0.5">
                      <span>Total: <strong>{formatUGX(selectedItem.totalCost)}</strong></span>
                      <span>Remaining: <strong className="text-amber-600">{formatUGX(selectedItem.remainingAmount)}</strong></span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="text-xs font-semibold text-emerald-800 hover:underline"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Item to Support *</label>
                  <select
                    value={formData.itemId}
                    onChange={(e) => setFormData(prev => ({ ...prev, itemId: e.target.value }))}
                    className="w-full p-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-none"
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
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Your Full Name *</label>
                <div className="relative">
                  <i className="fa-regular fa-user absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Uncle David / Aunt Sarah / Moses"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phone Number (MTN / Airtel) *</label>
                <div className="relative">
                  <i className="fa-solid fa-phone absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 0772 123456"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Used by the committee to verify Mobile Money and send receipts</span>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email Address (Optional)</label>
                <div className="relative">
                  <i className="fa-regular fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                  <input
                    type="email"
                    placeholder="e.g. you@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Receive an automated confirmation email receipt</span>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Pledge Amount (UGX) *</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-400">UGX</span>
                  <input
                    type="number"
                    required
                    min="1000"
                    step="5000"
                    placeholder="e.g. 100,000"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full pl-13 pr-3 py-2 text-sm font-bold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>

                {/* Quick Chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[50000, 100000, 200000, 500000, 1000000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => applyQuickAmount(val)}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                    >
                      +{formatUGX(val)}
                    </button>
                  ))}
                  {selectedItem && selectedItem.remainingAmount > 0 && (
                    <button
                      type="button"
                      onClick={() => applyQuickAmount(selectedItem.remainingAmount)}
                      className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 transition"
                    >
                      Cover Remaining ({formatUGX(selectedItem.remainingAmount)})
                    </button>
                  )}
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Fulfillment Mode</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-none"
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
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Warm Blessing / Note to Couple</label>
                <textarea
                  rows="2"
                  placeholder="e.g. Wishing Edwin & Jamirah God's richest blessings and joy!"
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full p-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                ></textarea>
              </div>

              {/* Privacy Checkboxes */}
              <div className="bg-slate-50 p-3 rounded-xl space-y-2 text-xs">
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isAnonymous}
                    onChange={(e) => setFormData(prev => ({ ...prev, isAnonymous: e.target.checked }))}
                    className="rounded text-emerald-700 focus:ring-emerald-600"
                  />
                  <span>Display name as <strong>"Generous Well-wisher"</strong> on public wall</span>
                </label>
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hideAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, hideAmount: e.target.checked }))}
                    className="rounded text-emerald-700 focus:ring-emerald-600"
                  />
                  <span>Keep exact amount private on public wall</span>
                </label>
              </div>

              {/* Notice */}
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <i className="fa-solid fa-bell text-amber-600 mt-0.5"></i>
                <span>An instant email alert is dispatched to Mr. Edwin Laston, and the budget balance subtracts in real-time across all connected screens.</span>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPledgeModalOpen(false)}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded-xl shadow transition flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i> Recording...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane"></i> Submit & Subtract
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
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl mx-auto mb-4">
              <i className="fa-solid fa-circle-check"></i>
            </div>

            <h3 className="font-serif-royal text-xl font-bold text-emerald-950 mb-1">
              Thank You for Your Blessing!
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              Your contribution has been recorded and subtracted from the ceremony budget in real-time.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2 text-xs mb-5">
              <div className="flex justify-between">
                <span className="text-slate-500">Contributor:</span>
                <strong className="text-slate-800">{receiptData.name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pledged For:</span>
                <strong className="text-slate-800">{receiptData.item}</strong>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold">
                <span className="text-slate-700">Amount:</span>
                <span className="text-emerald-700">{formatUGX(receiptData.amount)}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-500">Notification Alert:</span>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  <i className="fa-solid fa-envelope mr-1"></i> Dispatched to Edwin
                </span>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-900 mb-5">
              <div className="font-bold mb-1">Fulfill via Mobile Money:</div>
              <div className="flex justify-around font-mono font-bold">
                <span>Airtel: 0703464261</span>
                <span>MTN: 0774324968</span>
              </div>
              <div className="text-[10px] text-amber-700 mt-1">Ref: {receiptData.name} - {receiptData.item}</div>
            </div>

            <div className="space-y-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`I just pledged ${formatUGX(receiptData.amount)} towards ${receiptData.item} for Mr. Edwin Laston & Jamirah Nakayemba's Introduction Ceremony on 27th Nov 2026! Join us in contributing here: ${typeof window !== 'undefined' ? window.location.origin : ''}`)}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#25D366] text-white flex items-center justify-center gap-2 hover:bg-[#1ebd5b] transition"
              >
                <i className="fa-brands fa-whatsapp text-sm"></i> Share on WhatsApp
              </a>
              <button
                onClick={() => setIsSuccessModalOpen(false)}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition"
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
