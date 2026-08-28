export const metadata = {
  title: 'Committee Admin Portal | Edwin & Jamirah Kwanjula',
  description: 'Manage pledges, verify Mobile Money receipts, and configure notification alerts.',
  robots: { index: false, follow: false }
};

// Chrome only. The session check deliberately does not live here: a layout does
// not re-render on navigation and does not control whether the rest of the route
// renders, so an auth check here would not be one. Every /api/admin/* route
// guards itself with requireAdmin(), and app/admin/page.js asks the server
// whether a session exists before showing anything.
export default function AdminLayout({ children }) {
  return children;
}
