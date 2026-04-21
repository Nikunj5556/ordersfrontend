import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { phone, otp, orderId } = await req.json();

    if (!phone || !otp || !orderId) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }

    const normalizedPhone = phone.startsWith('+') ? phone : `+91${phone.replace(/^0/, '')}`;

    // Check OTP
    const { data: otpRow } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('phone', normalizedPhone)
      .eq('code', otp)
      .single();

    if (!otpRow) {
      return NextResponse.json({ error: 'Invalid OTP. Please try again.' }, { status: 400 });
    }

    if (new Date(otpRow.expires_at) < new Date()) {
      return NextResponse.json({ error: 'OTP has expired. Please request a new one.' }, { status: 400 });
    }

    // Mark session verified
    await supabase
      .from('portal_sessions')
      .update({ verified: true })
      .eq('phone', normalizedPhone)
      .eq('order_id', orderId);

    // Clean up OTP
    await supabase.from('otp_codes').delete().eq('phone', normalizedPhone);

    // Get customer from DB
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    // Set session cookie
    const cookieStore = await cookies();
    const sessionToken = Buffer.from(JSON.stringify({
      phone: normalizedPhone,
      orderId,
      customerId: customer?.id,
      exp: Date.now() + 24 * 60 * 60 * 1000
    })).toString('base64');

    cookieStore.set('bc_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24,
      path: '/',
      sameSite: 'lax',
    });

    return NextResponse.json({
      success: true,
      customer: customer || null,
      sessionToken,
    });
  } catch (err: unknown) {
    console.error('Verify OTP error:', err);
    return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 500 });
  }
}
