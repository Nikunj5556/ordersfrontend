import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

function getSession(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      return JSON.parse(Buffer.from(authHeader.slice(7), 'base64').toString());
    } catch { return null; }
  }
  return null;
}

// Create Razorpay order
export async function PUT(req: NextRequest) {
  try {
    const { amount, currency = 'INR', orderItemId } = await req.json();

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paise
      currency,
      receipt: `repl_${orderItemId}_${Date.now()}`,
    });

    return NextResponse.json({ orderId: order.id, amount: order.amount, currency: order.currency });
  } catch (err: unknown) {
    console.error('Razorpay order error:', err);
    return NextResponse.json({ error: 'Payment initiation failed' }, { status: 500 });
  }
}

// Submit replacement request
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
      replacementProductId,
      priceDifference,
      payeePaymentMethod,
      payerPaymentMethod,
      upiId,
      bankAccountNo,
      bankIfsc,
      rzpPaymentId,
    } = body;

    if (!orderItemId || !reason || !contactPhone || !pickupAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check no existing pending request
    const { data: existing } = await supabase
      .from('aftersale_replacement_request')
      .select('id, status')
      .eq('order_item_id', orderItemId)
      .in('status', ['pending_review', 'approved', 'pickup_scheduled'])
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        error: 'A replacement request already exists for this item.',
      }, { status: 409 });
    }

    const insertPayload: Record<string, unknown> = {
      order_item_id: orderItemId,
      customer_id: customerId,
      reason,
      additional_info: additionalInfo,
      product_images: productImages || [],
      contact_phone: contactPhone,
      pickup_address: typeof pickupAddress === 'string'
        ? { address: pickupAddress }
        : pickupAddress,
      replacement_product_id: replacementProductId || null,
      price_difference: priceDifference || 0,
      status: 'pending_review',
    };

    // If customer pays extra (priceDiff > 0)
    if (priceDifference > 0) {
      insertPayload.payee_payment_method = payeePaymentMethod ? [payeePaymentMethod] : null;
      insertPayload.payee_rzp_payment_id = rzpPaymentId || null;
    }

    // If store refunds customer (priceDiff < 0)
    if (priceDifference < 0) {
      insertPayload.payer_payment_method = payerPaymentMethod || null;
      insertPayload.payee_upi_id = payerPaymentMethod === 'upi' ? upiId : null;
      insertPayload.payee_bank_account_no = payerPaymentMethod === 'bank' ? bankAccountNo : null;
      insertPayload.payee_bank_ifsc = payerPaymentMethod === 'bank' ? bankIfsc : null;
    }

    const { data, error } = await supabase
      .from('aftersale_replacement_request')
      .insert(insertPayload)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, request: data });
  } catch (err: unknown) {
    console.error('Replacement request error:', err);
    return NextResponse.json({ error: 'Failed to submit replacement request' }, { status: 500 });
  }
}
