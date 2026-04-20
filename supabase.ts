import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type OrderStatus = 'placed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
export type RequestStatus = 'pending_review' | 'approved' | 'rejected' | 'pickup_scheduled' | 'completed';

export interface Customer {
  id: string;
  shopify_customer_id: number;
  name: string;
  email?: string;
  phone?: string;
}

export interface Product {
  id: string;
  shopify_product_id: number;
  name: string;
  image_url?: string;
  price: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  products?: Product;
}

export interface OrderTracking {
  id: number;
  order_id: string;
  order_status: OrderStatus;
  order_tracking_id?: string;
  customer_id: string;
  order_carrier?: string;
}

export interface Order {
  id: string;
  shopify_order_id: number;
  customer_id: string;
  order_number: string;
  shipping_address?: Record<string, string>;
  billing_address?: Record<string, string>;
  order_phone?: string;
  total_price: number;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
  order_tracking_data?: OrderTracking;
}

export interface ReturnRequest {
  id: number;
  order_item_id: string;
  customer_id: string;
  status: RequestStatus;
  reason?: string;
  additional_info?: string;
  contact_phone: string;
  pickup_address?: string;
  payee_payment_method?: string;
  payee_upi_id?: string;
  payee_bank_account_no?: string;
  payee_bank_ifsc?: string;
  created_at: string;
}

export interface ReplacementRequest {
  id: string;
  order_item_id: string;
  customer_id: string;
  status: RequestStatus;
  reason: string;
  additional_info?: string;
  contact_phone: string;
  pickup_address: Record<string, string>;
  replacement_product_id?: string;
  price_difference: number;
  payer_payment_method?: string;
  payee_payment_method?: string[];
  payee_upi_id?: string;
  payee_bank_account_no?: string;
  payee_bank_ifsc?: string;
  payee_rzp_payment_id?: string;
  created_at: string;
}
