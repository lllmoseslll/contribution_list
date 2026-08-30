'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FaArrowLeft,
  FaMagnifyingGlass,
  FaPhone,
  FaSpinner,
  FaUserGroup
} from 'react-icons/fa6';

export default function GuestsPage() {
  const [guests, setGuests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/guests')
      .then(res => res.json())
      .then(data => { if (!cancelled) setGuests(Array.isArray(data) ? data : []); })
      .catch(err => console.error('Failed to load guest list:', err))
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filteredGuests = guests.filter(g => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (g.name || '').toLowerCase().includes(q) || (g.phone || '').toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-brand-950 text-white py-10 px-5 text-center border-b border-brand-800">
        <div className="max-w-3xl mx-auto">
          <p className="text-accent-400 text-xs font-bold tracking-widest uppercase mb-2">
            Edwin &amp; Jamirah Kwanjula
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2 flex items-center justify-center gap-2.5">
            <FaUserGroup className="text-accent-400" aria-hidden="true" /> Guest List
          </h1>
          <p className="text-sm text-brand-200">
            Everyone confirmed to attend the Introduction Ceremony. Maintained by the committee.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 mt-5 px-4 py-2 rounded-full text-xs font-semibold text-brand-100 bg-brand-900/80 hover:bg-brand-800 border border-brand-700 transition"
          >
            <FaArrowLeft aria-hidden="true" /> Back to Home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto w-full px-5 py-8">
        <div className="relative mb-5">
          <FaMagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 text-sm" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2.5 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-700"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 text-neutral-500 text-sm py-16">
            <FaSpinner className="animate-spin" aria-hidden="true" /> Loading guest list...
          </div>
        ) : filteredGuests.length === 0 ? (
          <div className="text-center py-16 text-neutral-500 text-sm border border-dashed border-neutral-300 rounded-xl">
            <FaUserGroup className="text-3xl mb-3 block mx-auto text-neutral-300" aria-hidden="true" />
            {guests.length === 0
              ? 'No guests added yet. Check back soon!'
              : 'No guests match your search.'}
          </div>
        ) : (
          <>
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">
              {filteredGuests.length} Guest{filteredGuests.length === 1 ? '' : 's'}
            </p>
            <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100 overflow-hidden">
              {filteredGuests.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-3 p-4">
                  <span className="font-semibold text-neutral-900 text-sm">{g.name}</span>
                  {g.phone && (
                    <a
                      href={`tel:${g.phone}`}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:underline whitespace-nowrap"
                    >
                      <FaPhone className="text-[10px]" aria-hidden="true" /> {g.phone}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
