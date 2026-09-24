import { NextRequest, NextResponse } from 'next/server';

import { accessKeyFor, getSiteProtection } from '@/lib/site-protection';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    // Password and on/off switch are managed in Sanity Studio ("Site Password")
    const { enabled, password: correctPassword } = await getSiteProtection();

    if (!enabled) {
      return NextResponse.json({ success: true, accessKey: null });
    }

    if (correctPassword && password === correctPassword) {
      return NextResponse.json({ success: true, accessKey: accessKeyFor(correctPassword) });
    } else {
      return NextResponse.json({ success: false, error: 'Incorrect password' }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }
}
