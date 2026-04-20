import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getSession(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      return JSON.parse(Buffer.from(authHeader.slice(7), 'base64').toString());
    } catch { return null; }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session?.phone) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      orderItemId,
      customerId,
      reason,
      additionalInfo,
      productImages,
      contactPhone,
      pickupAddress,
      refundMethod,
      upiId,
      bankAccountNo,
      bankIfsc,
    } = body;

    if (!orderItemId || !reason || !contactPhone || !pickupAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check no existing pending request
    const { data: existing } = await supabase
      .from('aftersale_return_request')
      .select('id, status')
      .eq('order_item_id', orderItemId)
      .in('status', ['pending_review', 'approved', 'pickup_scheduled'])
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        error: 'A return request already exists for this item.',
      }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('aftersale_return_request')
      .insert({
        order_item_id: orderItemId,
        customer_id: customerId,
        reason,
        additional_info: additionalInfo,
        product_images: productImages || [],
        contact_phone: contactPhone,
        pickup_address: pickupAddress,
        status: 'pending_review',
        payee_payment_method: refundMethod,
        payee_upi_id: refundMethod === 'upi' ? upiId : null,
        payee_bank_account_no: refundMethod === 'bank' ? bankAccountNo : null,
        payee_bank_ifsc: refundMethod === 'bank' ? bankIfsc : null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, request: data });
  } catch (err: unknown) {
    console.error('Return request error:', err);
    return NextResponse.json({ error: 'Failed to submit return request' }, { status: 500 });
  }
}
