import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

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

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session?.phone) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const phone = session.phone;

    // Get orders from cache (fast path)
    const { data: cachedOrders } = await supabase
      .from('orders_cache')
      .select('*')
      .ilike('phone', `%${phone.slice(-10)}%`)
      .order('created_at', { ascending: false });

    if (cachedOrders && cachedOrders.length > 0) {
      return NextResponse.json({ orders: cachedOrders, source: 'cache' });
    }

    // Fallback: relational orders
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .ilike('phone', `%${phone.slice(-10)}%`)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ orders: [], source: 'db' });
    }

    const { data: orders } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          products (id, name, image_url, price)
        ),
        order_tracking_data:order_tracking (*)
      `)
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });

    // Also get return/replacement requests
    const orderItemIds = orders?.flatMap(o => o.order_items?.map((i: { id: string }) => i.id) || []) || [];

    let returnRequests: unknown[] = [];
    let replacementRequests: unknown[] = [];

    if (orderItemIds.length > 0) {
      const [ret, rep] = await Promise.all([
        supabase.from('aftersale_return_request').select('*').in('order_item_id', orderItemIds),
        supabase.from('aftersale_replacement_request').select('*').in('order_item_id', orderItemIds),
      ]);
      returnRequests = ret.data || [];
      replacementRequests = rep.data || [];
    }

    return NextResponse.json({
      orders: orders || [],
      returnRequests,
      replacementRequests,
      source: 'db',
    });
  } catch (err: unknown) {
    console.error('Orders fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}
