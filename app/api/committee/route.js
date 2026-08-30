import { NextResponse } from 'next/server';
import { getCommitteeMembers } from '@/lib/committee-service';

export const dynamic = 'force-dynamic';

/** Public, read-only. Committee members are only ever added or removed from the admin portal. */
export async function GET() {
  const members = await getCommitteeMembers();
  return NextResponse.json(members);
}
