import { NextResponse } from 'next/server';
import { getCommitteeMembers, addCommitteeMember } from '@/lib/committee-service';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const members = await getCommitteeMembers();
  return NextResponse.json(members);
}

export async function POST(req) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;

    const body = await req.json();
    const { name, phone, role } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Committee member name is required.' }, { status: 400 });
    }
    if (!phone || !phone.trim()) {
      return NextResponse.json({ error: 'Phone number is required to receive Mobile Money pledges.' }, { status: 400 });
    }

    const newMember = await addCommitteeMember({
      id: 'committee-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      name: name.trim(),
      phone: phone.trim(),
      role: (role || '').trim()
    });

    return NextResponse.json({ success: true, member: newMember }, { status: 201 });
  } catch (err) {
    console.error('Admin committee member creation error:', err);
    return NextResponse.json({ error: 'Failed to add committee member' }, { status: 500 });
  }
}
