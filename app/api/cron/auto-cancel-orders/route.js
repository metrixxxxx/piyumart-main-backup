// app/api/cron/auto-cancel-orders/route.js
// Call this via Vercel Cron or any external scheduler every hour
// Vercel cron config: vercel.json -> { "crons": [{ "path": "/api/cron/auto-cancel-orders", "schedule": "0 * * * *" }] }

import { NextResponse } from 'next/server'
import { autoExpireOrders } from '@/lib/orders/orderService'

export async function GET(req) {
  // Protect with a secret header/token
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await autoExpireOrders()
    console.log(`[cron] Auto-cancelled ${result.count} expired orders`)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[cron error]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}