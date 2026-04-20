import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { phone, orderId } = await req.json();

    if (!phone || !orderId) {
      return NextResponse.json({ error: 'Phone and Order ID are required' }, { status: 400 });
    }

    // Normalize phone
    const normalizedPhone = phone.startsWith('+') ? phone : `+91${phone.replace(/^0/, '')}`;

    // Check order exists in orders_cache
    const { data: cachedOrder } = await supabase
      .from('orders_cache')
      .select('id, phone, order_name')
      .eq('order_name', orderId)
      .single();

    if (!cachedOrder) {
      return NextResponse.json({ error: 'Order not found. Please check your Order ID.' }, { status: 404 });
    }

    // Verify phone matches order (loose match)
    const orderPhone = cachedOrder.phone?.replace(/\D/g, '').slice(-10);
    const inputPhone = normalizedPhone.replace(/\D/g, '').slice(-10);

    if (orderPhone && orderPhone !== inputPhone) {
      return NextResponse.json({ error: 'Phone number does not match this order.' }, { status: 400 });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    // Upsert OTP
    await supabase.from('otp_codes').upsert({
      phone: normalizedPhone,
      code: otp,
      expires_at: expiresAt,
    });

    // Create/update portal session
    await supabase.from('portal_sessions').insert({
      phone: normalizedPhone,
      order_id: orderId,
      verified: false,
      otp_code: otp,
      expires_at: expiresAt,
    });

    // Send OTP via WhatsApp (using your WhatsApp provider)
    // Replace with your actual WhatsApp API call
    const waResponse = await fetch(process.env.WHATSAPP_API_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
      },
      body: JSON.stringify({
        phone: normalizedPhone,
        message: `Your Breakfast Club verification code is: *${otp}*\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
      }),
    }).catch(() => null);

    // Log OTP
    await supabase.from('otp_logs').insert({
      phone: normalizedPhone,
      otp,
      status: waResponse?.ok ? 'sent' : 'failed',
      provider: 'whatsapp',
    });

    return NextResponse.json({ success: true, message: 'OTP sent via WhatsApp' });
  } catch (err: unknown) {
    console.error('Send OTP error:', err);
    return NextResponse.json({ error: 'Failed to send OTP. Please try again.' }, { status: 500 });
  }
}
