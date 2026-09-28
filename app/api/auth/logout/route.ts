import { NextResponse } from 'next/server'
import { clearSession } from '@/lib/auth'
import { handleRequestSecurityError, requireSameOrigin } from '@/lib/security'
export async function POST(req: Request) {
  try { requireSameOrigin(req); await clearSession(); return NextResponse.json({ ok: true }) }
  catch (error) { const e=handleRequestSecurityError(error); if(e) return e; return NextResponse.json({error:'Unable to logout.'},{status:500}) }
}
