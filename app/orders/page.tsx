'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import {
  Package, ShieldCheck, Truck, MessageCircle, Search, ChevronDown,
  ChevronRight, X, Upload, CheckCircle2, AlertCircle, Loader2,
  RotateCcw, RefreshCw, Ban, Eye, FileText, ShoppingBag, Clock,
  MapPin, Phone, CreditCard, ArrowRight, Zap, Star, Lock,
  ExternalLink, Copy, Check, Info
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type AppState = 'login' | 'otp' | 'dashboard';
type ActiveTab = 'all' | 'active' | 'delivered' | 'cancelled' | 'returns';
type ModalType = 'return' | 'replace' | 'track' | 'cancel' | null;
type RefundMethod = 'upi' | 'bank' | '';
type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallet' | '';

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number | string;
  products?: { id: string; name: string; image_url?: string; price: number | string };
  // from cache items
  title?: string;
  variant_title?: string;
  image?: string;
}

interface Order {
  // cache shape
  id?: string;
  shopify_order_id?: number;
  order_name?: string;
  order_number?: string;
  phone?: string;
  customer_name?: string;
  status?: string;
  fulfillment_status?: string;
  financial_status?: string;
  total_amount?: number | string;
  total_price?: number | string;
  currency?: string;
  tracking_number?: string;
  tracking_url?: string;
  expected_delivery?: string;
  items?: OrderItem[];
  order_items?: OrderItem[];
  created_at?: string;
  updated_at?: string;
}

interface SelectedItem {
  order: Order;
  item: OrderItem;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (amount: number | string | undefined) => {
  const n = Number(amount ?? 0);
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
};

const fmtDate = (s?: string) => {
  if (!s) return '';
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const daysSince = (s?: string) => {
  if (!s) return 999;
  return Math.floor((Date.now() - new Date(s).getTime()) / 86400000);
};

const normalizeItems = (order: Order): OrderItem[] => {
  const raw = order.items || order.order_items || [];
  return raw.map((i: OrderItem) => ({
    ...i,
    title: i.title || i.products?.name || 'Product',
    image: i.image || i.products?.image_url || '',
    price: i.price || i.products?.price || 0,
  }));
};

const orderStatus = (order: Order): string => {
  if (order.status === 'cancelled') return 'cancelled';
  if (order.fulfillment_status === 'fulfilled' || order.status === 'delivered') return 'delivered';
  if (order.fulfillment_status === 'partial') return 'shipped';
  if (order.status === 'shipped') return 'shipped';
  if (order.status === 'processing') return 'processing';
  return 'processing';
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  delivered:  { label: 'Delivered',  color: 'text-emerald-700', bg: 'bg-emerald-50',  dot: 'bg-emerald-500' },
  shipped:    { label: 'Shipped',    color: 'text-blue-700',    bg: 'bg-blue-50',     dot: 'bg-blue-500'    },
  processing: { label: 'Processing', color: 'text-amber-700',   bg: 'bg-amber-50',    dot: 'bg-amber-500'   },
  placed:     { label: 'Placed',     color: 'text-amber-700',   bg: 'bg-amber-50',    dot: 'bg-amber-400'   },
  cancelled:  { label: 'Cancelled',  color: 'text-red-700',     bg: 'bg-red-50',      dot: 'bg-red-500'     },
  returned:   { label: 'Returned',   color: 'text-purple-700',  bg: 'bg-purple-50',   dot: 'bg-purple-500'  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['processing'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded-xl ${className}`} />;
}

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6);

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        const next = [...digits]; next[i] = ''; onChange(next.join(''));
      } else if (i > 0) {
        refs.current[i - 1]?.focus();
      }
    }
  };

  const handleChange = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return;
    const char = v.slice(-1);
    const next = [...digits]; next[i] = char;
    onChange(next.join(''));
    if (char && i < 5) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) { onChange(pasted); refs.current[Math.min(pasted.length, 5)]?.focus(); }
    e.preventDefault();
  };

  return (
    <div className="flex gap-2 justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          className={`w-12 h-14 text-center text-xl font-bold border-2 rounded-2xl outline-none transition-all duration-150
            ${d ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-900'}
            focus:border-blue-500 focus:bg-blue-50`}
        />
      ))}
    </div>
  );
}

// ─── Modal Wrapper ─────────────────────────────────────────────────────────────

function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[92vh] flex flex-col shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Image Upload ─────────────────────────────────────────────────────────────

function ImageUpload({ images, setImages }: {
  images: string[]; setImages: (imgs: string[]) => void;
}) {
  const [dragging, setDragging] = useState(false);

  const process = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = e => {
        if (e.target?.result) setImages([...images, e.target.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div>
      <label
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); process(e.dataTransfer.files); }}
        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 cursor-pointer transition-all duration-200
          ${dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
      >
        <input type="file" className="hidden" accept="image/*" multiple onChange={e => process(e.target.files)} />
        <Upload size={24} className="text-gray-400 mb-2" />
        <p className="text-sm font-medium text-gray-600">Drag photos here or <span className="text-blue-600">browse</span></p>
        <p className="text-xs text-gray-400 mt-1">Clear product photos help us process faster</p>
      </label>
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {images.map((img, i) => (
            <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-200">
              <img src={img} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => setImages(images.filter((_, j) => j !== i))}
                className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
              >
                <X size={10} className="text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Return Modal ─────────────────────────────────────────────────────────────

function ReturnModal({ open, onClose, selected, sessionToken, customerId }: {
  open: boolean; onClose: () => void; selected: SelectedItem | null;
  sessionToken: string; customerId: string;
}) {
  const [reason, setReason] = useState('');
  const [info, setInfo] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('');
  const [upiId, setUpiId] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setReason(''); setInfo(''); setImages([]); setPhone(''); setAddress('');
    setRefundMethod(''); setUpiId(''); setBankAccount(''); setBankIfsc('');
    setConfirmed(false); setLoading(false); setSuccess(false); setError('');
  };

  const handleClose = () => { reset(); onClose(); };

  const submit = async () => {
    if (!reason) { setError('Please select a reason.'); return; }
    if (!address) { setError('Please enter your pickup address.'); return; }
    if (!phone) { setError('Please enter your phone number.'); return; }
    if (!refundMethod) { setError('Please select a refund method.'); return; }
    if (refundMethod === 'upi' && !upiId) { setError('Please enter your UPI ID.'); return; }
    if (refundMethod === 'bank' && (!bankAccount || !bankIfsc)) { setError('Please enter bank details.'); return; }
    if (!confirmed) { setError('Please confirm the item condition.'); return; }
    setError(''); setLoading(true);

    try {
      const res = await fetch('/api/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({
          orderItemId: selected?.item.id,
          customerId,
          reason, additionalInfo: info, productImages: images,
          contactPhone: phone, pickupAddress: address,
          refundMethod, upiId, bankAccountNo: bankAccount, bankIfsc,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Return Item">
      {success ? (
        <div className="py-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-emerald-600" />
          </div>
          <h4 className="text-xl font-bold text-gray-900 mb-2">Return Submitted!</h4>
          <p className="text-gray-500 text-sm leading-relaxed">
            Our team will contact you via WhatsApp or Phone within <strong>48 hours</strong> to schedule a pickup.
          </p>
          <div className="mt-6 bg-blue-50 rounded-2xl p-4 text-left space-y-2">
            <div className="flex items-start gap-2 text-sm text-blue-800">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>A delivery executive will visit your address to inspect the item.</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-blue-800">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>Refund is initiated after the delivery executive confirms the pickup.</span>
            </div>
          </div>
          <button onClick={handleClose} className="mt-6 w-full btn-primary">Done</button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Product preview */}
          {selected && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-200 shrink-0">
                {selected.item.image && (
                  <img src={selected.item.image} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{selected.item.title}</p>
                <p className="text-gray-500 text-xs">{fmt(selected.item.price)} · Qty {selected.item.quantity}</p>
              </div>
            </div>
          )}

          {/* Steps info */}
          <div className="bg-blue-50 rounded-2xl p-4 space-y-2">
            {['Upload photos & provide details below', 'We contact you within 48 hours', 'Delivery agent visits for pickup', 'Refund after approval'].map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-blue-800">
                <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                {s}
              </div>
            ))}
          </div>

          <div>
            <label className="label">Reason for Return <span className="text-red-500">*</span></label>
            <select value={reason} onChange={e => setReason(e.target.value)} className="input-field">
              <option value="">Select a reason</option>
              <option value="damaged">Damaged item</option>
              <option value="wrong_item">Wrong item received</option>
              <option value="missing_parts">Missing parts</option>
              <option value="defective">Defective product</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="label">Product Photos</label>
            <ImageUpload images={images} setImages={setImages} />
          </div>

          <div>
            <label className="label">Additional Details</label>
            <textarea value={info} onChange={e => setInfo(e.target.value)} rows={3}
              placeholder="Describe the issue in detail..."
              className="input-field resize-none" />
          </div>

          <div>
            <label className="label">Phone Number <span className="text-red-500">*</span></label>
            <input value={phone} onChange={e => setPhone(e.target.value)} type="tel"
              placeholder="+91 XXXXXXXXXX" className="input-field" />
          </div>

          <div>
            <label className="label">Pickup Address <span className="text-red-500">*</span></label>
            <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2}
              placeholder="Full address with pincode..." className="input-field resize-none" />
          </div>

          {/* Refund method */}
          <div>
            <label className="label">Refund Method <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-2">
              {(['upi', 'bank'] as RefundMethod[]).map(m => (
                <button key={m} onClick={() => setRefundMethod(m)}
                  className={`p-3 rounded-2xl border-2 text-sm font-medium transition-all ${refundMethod === m ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {m === 'upi' ? '📲 UPI' : '🏦 Bank Transfer'}
                </button>
              ))}
            </div>
            {refundMethod === 'upi' && (
              <input value={upiId} onChange={e => setUpiId(e.target.value)} className="input-field mt-2"
                placeholder="yourname@upi" />
            )}
            {refundMethod === 'bank' && (
              <div className="space-y-2 mt-2">
                <input value={bankAccount} onChange={e => setBankAccount(e.target.value)}
                  className="input-field" placeholder="Account Number" />
                <input value={bankIfsc} onChange={e => setBankIfsc(e.target.value)}
                  className="input-field" placeholder="IFSC Code" />
              </div>
            )}
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-blue-600" />
            <span className="text-sm text-gray-600">I confirm the item is unused except for inspection purposes.</span>
          </label>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-sm text-red-700">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button onClick={submit} disabled={loading} className="btn-primary w-full">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : 'Submit Return Request'}
          </button>
        </div>
      )}
    </Modal>
  );
}

// ─── Replace Modal ────────────────────────────────────────────────────────────

function ReplaceModal({ open, onClose, selected, sessionToken, customerId, allProducts }: {
  open: boolean; onClose: () => void; selected: SelectedItem | null;
  sessionToken: string; customerId: string; allProducts: { id: string; name: string; price: number; image_url?: string }[];
}) {
  const [sameProduct, setSameProduct] = useState(true);
  const [replacementId, setReplacementId] = useState('');
  const [reason, setReason] = useState('');
  const [info, setInfo] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('');
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('');
  const [upiId, setUpiId] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [rzpLoading, setRzpLoading] = useState(false);
  const [paidId, setPaidId] = useState('');

  const origPrice = Number(selected?.item.price ?? 0);
  const replProduct = allProducts.find(p => p.id === replacementId);
  const replPrice = sameProduct ? origPrice : Number(replProduct?.price ?? 0);
  const diff = replPrice - origPrice;

  const reset = () => {
    setSameProduct(true); setReplacementId(''); setReason(''); setInfo('');
    setImages([]); setPhone(''); setAddress(''); setPayMethod('');
    setRefundMethod(''); setUpiId(''); setBankAccount(''); setBankIfsc('');
    setLoading(false); setSuccess(false); setError(''); setPaidId('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleRazorpay = async () => {
    setRzpLoading(true); setError('');
    try {
      const res = await fetch('/api/replacement', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: diff, orderItemId: selected?.item.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Load Razorpay script if needed
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load payment gateway'));
          document.body.appendChild(script);
        });
      }

      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: data.amount,
        currency: data.currency,
        name: 'Breakfast Club',
        description: `Replacement for ${selected?.item.title}`,
        order_id: data.orderId,
        prefill: { contact: phone },
        theme: { color: '#2563EB' },
        handler: (response: { razorpay_payment_id: string }) => {
          setPaidId(response.razorpay_payment_id);
          setRzpLoading(false);
        },
        modal: { ondismiss: () => setRzpLoading(false) },
      });
      rzp.open();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Payment failed. Try again.');
      setRzpLoading(false);
    }
  };

  const submit = async () => {
    if (!reason) { setError('Please select a reason.'); return; }
    if (!phone) { setError('Please enter your phone number.'); return; }
    if (!address) { setError('Please enter your pickup address.'); return; }
    if (!sameProduct && !replacementId) { setError('Please select a replacement product.'); return; }
    if (diff > 0 && !paidId) { setError('Please complete the payment first.'); return; }
    if (diff < 0 && !refundMethod) { setError('Please select a refund method.'); return; }
    setError(''); setLoading(true);

    try {
      const res = await fetch('/api/replacement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({
          orderItemId: selected?.item.id, customerId, reason,
          additionalInfo: info, productImages: images, contactPhone: phone,
          pickupAddress: address, replacementProductId: sameProduct ? selected?.item.product_id : replacementId,
          priceDifference: diff, payeePaymentMethod: payMethod, payerPaymentMethod: refundMethod,
          upiId, bankAccountNo: bankAccount, bankIfsc, rzpPaymentId: paidId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Replace Item">
      {success ? (
        <div className="py-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-emerald-600" />
          </div>
          <h4 className="text-xl font-bold text-gray-900 mb-2">Replacement Requested!</h4>
          <p className="text-gray-500 text-sm leading-relaxed">
            We will process your replacement and keep you updated via WhatsApp and email.
          </p>
          {diff < 0 && (
            <div className="mt-4 bg-emerald-50 rounded-2xl p-4 text-sm text-emerald-800">
              Refund of {fmt(Math.abs(diff))} will be credited after the delivery agent confirms pickup.
            </div>
          )}
          <button onClick={handleClose} className="mt-6 w-full btn-primary">Done</button>
        </div>
      ) : (
        <div className="space-y-5">
          {selected && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-200 shrink-0">
                {selected.item.image && <img src={selected.item.image} alt="" className="w-full h-full object-cover" />}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{selected.item.title}</p>
                <p className="text-gray-500 text-xs">{fmt(origPrice)}</p>
              </div>
            </div>
          )}

          {/* Same or Different */}
          <div>
            <label className="label">Replacement Type</label>
            <div className="grid grid-cols-2 gap-2">
              {[true, false].map(same => (
                <button key={String(same)} onClick={() => { setSameProduct(same); setReplacementId(''); }}
                  className={`p-3 rounded-2xl border-2 text-sm font-medium transition-all
                    ${sameProduct === same ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                  {same ? '🔄 Same Product' : '🔀 Different Product'}
                </button>
              ))}
            </div>
          </div>

          {!sameProduct && allProducts.length > 0 && (
            <div>
              <label className="label">Select Replacement Product</label>
              <select value={replacementId} onChange={e => setReplacementId(e.target.value)} className="input-field">
                <option value="">Choose a product...</option>
                {allProducts.map(p => (
                  <option key={p.id} value={p.id}>{p.name} — {fmt(p.price)}</option>
                ))}
              </select>
            </div>
          )}

          {/* Price difference box */}
          {!sameProduct && replacementId && (
            <div className={`rounded-2xl p-4 ${diff > 0 ? 'bg-blue-50 border border-blue-200' : diff < 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-200'}`}>
              {diff > 0 && (
                <div className="flex items-center gap-2 text-blue-800 text-sm font-medium">
                  <CreditCard size={16} />
                  Additional payment required: <strong>{fmt(diff)}</strong>
                </div>
              )}
              {diff < 0 && (
                <div className="flex items-center gap-2 text-emerald-800 text-sm font-medium">
                  <CheckCircle2 size={16} />
                  You will receive a refund of: <strong>{fmt(Math.abs(diff))}</strong>
                </div>
              )}
              {diff === 0 && (
                <div className="flex items-center gap-2 text-gray-600 text-sm">
                  <Check size={16} /> No additional payment required
                </div>
              )}
            </div>
          )}

          {/* Payment UI for upgrades */}
          {diff > 0 && (
            <div className="space-y-3">
              <label className="label">Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                {(['upi', 'card', 'netbanking', 'wallet'] as PaymentMethod[]).map(m => (
                  <button key={m} onClick={() => setPayMethod(m)}
                    className={`p-2.5 rounded-xl border-2 text-xs font-medium transition-all capitalize
                      ${payMethod === m ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'}`}>
                    {m === 'upi' ? '📲 UPI' : m === 'card' ? '💳 Card' : m === 'netbanking' ? '🏦 Net Banking' : '👛 Wallet'}
                  </button>
                ))}
              </div>
              {paidId ? (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl text-sm text-emerald-700">
                  <CheckCircle2 size={16} /> Payment successful! ID: {paidId.slice(0, 12)}...
                </div>
              ) : (
                <button onClick={handleRazorpay} disabled={rzpLoading}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
                  {rzpLoading ? <><Loader2 size={14} className="animate-spin" /> Processing...</> : <><Lock size={14} /> Pay {fmt(diff)} Securely</>}
                </button>
              )}
              <p className="text-xs text-center text-gray-400">🔒 Secure Payments Powered by Razorpay</p>
            </div>
          )}

          {/* Refund method for downgrades */}
          {diff < 0 && (
            <div>
              <label className="label">Receive Refund Via</label>
              <div className="grid grid-cols-2 gap-2">
                {(['upi', 'bank'] as RefundMethod[]).map(m => (
                  <button key={m} onClick={() => setRefundMethod(m)}
                    className={`p-3 rounded-2xl border-2 text-sm font-medium transition-all
                      ${refundMethod === m ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                    {m === 'upi' ? '📲 UPI' : '🏦 Bank Transfer'}
                  </button>
                ))}
              </div>
              {refundMethod === 'upi' && (
                <input value={upiId} onChange={e => setUpiId(e.target.value)} className="input-field mt-2" placeholder="yourname@upi" />
              )}
              {refundMethod === 'bank' && (
                <div className="space-y-2 mt-2">
                  <input value={bankAccount} onChange={e => setBankAccount(e.target.value)} className="input-field" placeholder="Account Number" />
                  <input value={bankIfsc} onChange={e => setBankIfsc(e.target.value)} className="input-field" placeholder="IFSC Code" />
                </div>
              )}
              {refundMethod && <p className="text-xs text-gray-400 mt-1.5">🔒 Refund details are encrypted and used only for payout.</p>}
            </div>
          )}

          <div>
            <label className="label">Reason <span className="text-red-500">*</span></label>
            <select value={reason} onChange={e => setReason(e.target.value)} className="input-field">
              <option value="">Select a reason</option>
              <option value="damaged">Damaged item</option>
              <option value="wrong_item">Wrong item received</option>
              <option value="size_issue">Size / fit issue</option>
              <option value="quality_issue">Quality not as expected</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="label">Product Photos</label>
            <ImageUpload images={images} setImages={setImages} />
          </div>

          <div>
            <label className="label">Additional Details</label>
            <textarea value={info} onChange={e => setInfo(e.target.value)} rows={2}
              placeholder="Any other info..." className="input-field resize-none" />
          </div>

          <div>
            <label className="label">Phone Number <span className="text-red-500">*</span></label>
            <input value={phone} onChange={e => setPhone(e.target.value)} type="tel"
              placeholder="+91 XXXXXXXXXX" className="input-field" />
          </div>

          <div>
            <label className="label">Pickup Address <span className="text-red-500">*</span></label>
            <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2}
              placeholder="Full address with pincode..." className="input-field resize-none" />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-sm text-red-700">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button onClick={submit} disabled={loading}
            className="btn-primary w-full">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : 'Submit Replacement Request'}
          </button>
        </div>
      )}
    </Modal>
  );
}

// ─── Track Modal ──────────────────────────────────────────────────────────────

function TrackModal({ open, onClose, order }: {
  open: boolean; onClose: () => void; order: Order | null;
}) {
  const status = order ? orderStatus(order) : 'processing';
  const steps = ['placed', 'processing', 'shipped', 'delivered'];
  const stepLabels = ['Order Placed', 'Packed & Ready', 'On the Way', 'Delivered'];
  const stepIdx = steps.indexOf(status === 'cancelled' ? 'placed' : status);

  return (
    <Modal open={open} onClose={onClose} title="Track Package">
      {order && (
        <div className="space-y-5">
          <div className="p-4 bg-gray-50 rounded-2xl space-y-1">
            <p className="text-xs text-gray-500">Order</p>
            <p className="font-bold text-gray-900">{order.order_name || order.order_number}</p>
            {order.tracking_number && (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-gray-500">{order.tracking_number}</p>
                <button onClick={() => navigator.clipboard.writeText(order.tracking_number!)}
                  className="text-blue-600"><Copy size={12} /></button>
              </div>
            )}
          </div>

          {order.expected_delivery && (
            <div className="bg-blue-50 rounded-2xl p-4">
              <p className="text-xs text-blue-600 font-medium">Expected Delivery</p>
              <p className="font-bold text-blue-900 text-lg mt-0.5">{order.expected_delivery}</p>
            </div>
          )}

          {/* Timeline */}
          <div className="relative pl-6">
            <div className="absolute left-2.5 top-3 bottom-3 w-0.5 bg-gray-200" />
            {steps.map((step, i) => {
              const done = i <= stepIdx;
              const active = i === stepIdx;
              return (
                <div key={step} className="relative flex items-center gap-3 mb-6 last:mb-0">
                  <div className={`absolute -left-6 w-5 h-5 rounded-full border-2 flex items-center justify-center
                    ${done ? 'border-blue-500 bg-blue-500' : 'border-gray-300 bg-white'}`}>
                    {done && <Check size={10} className="text-white" />}
                  </div>
                  <div className={`${active ? 'text-blue-700 font-bold' : done ? 'text-gray-700' : 'text-gray-400'}`}>
                    <p className="text-sm font-semibold">{stepLabels[i]}</p>
                    {active && <p className="text-xs text-blue-500 mt-0.5">Current status</p>}
                  </div>
                </div>
              );
            })}
          </div>

          {order.tracking_url && (
            <a href={order.tracking_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full p-3 rounded-xl border-2 border-blue-200 text-blue-700 text-sm font-semibold hover:bg-blue-50 transition-colors">
              <ExternalLink size={14} /> Open Carrier Tracking
            </a>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─── Cancel Modal ──────────────────────────────────────────────────────────────

function CancelModal({ open, onClose, order, sessionToken }: {
  open: boolean; onClose: () => void; order: Order | null; sessionToken: string;
}) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!reason) { setError('Please select a reason.'); return; }
    setLoading(true);
    try {
      // Calls to your cancellation endpoint (implement per your Shopify setup)
      await new Promise(r => setTimeout(r, 1200)); // placeholder
      setSuccess(true);
    } catch {
      setError('Failed to cancel. Contact support.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Cancel Order">
      {success ? (
        <div className="py-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Ban size={28} className="text-red-500" />
          </div>
          <h4 className="text-xl font-bold text-gray-900 mb-2">Order Cancelled</h4>
          <p className="text-gray-500 text-sm">Your order has been cancelled successfully. Refund will be processed in 5–7 business days.</p>
          <button onClick={onClose} className="mt-6 w-full btn-primary">Done</button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 rounded-2xl flex gap-2">
            <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">This action cannot be undone. Your order will be permanently cancelled.</p>
          </div>

          <div>
            <label className="label">Reason for Cancellation</label>
            <select value={reason} onChange={e => setReason(e.target.value)} className="input-field">
              <option value="">Select a reason</option>
              <option value="mistake">Ordered by mistake</option>
              <option value="cheaper">Found it cheaper elsewhere</option>
              <option value="delay">Delivery delay</option>
              <option value="other">Other</option>
            </select>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-sm text-red-700">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button onClick={onClose}
              className="p-3 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors text-sm">
              Keep Order
            </button>
            <button onClick={submit} disabled={loading}
              className="p-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors text-sm flex items-center justify-center gap-1.5">
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              {loading ? 'Cancelling...' : 'Confirm Cancel'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({
  order, onReturn, onReplace, onTrack, onCancel
}: {
  order: Order;
  onReturn: (order: Order, item: OrderItem) => void;
  onReplace: (order: Order, item: OrderItem) => void;
  onTrack: (order: Order) => void;
  onCancel: (order: Order) => void;
}) {
  const status = orderStatus(order);
  const items = normalizeItems(order);
  const total = order.total_amount ?? order.total_price ?? 0;
  const shippingAddr = order.shipping_address as Record<string, string> | undefined;
  const shipTo = shippingAddr?.name || order.customer_name || '';
  const deliveredDaysAgo = status === 'delivered' ? daysSince(order.updated_at || order.created_at) : 0;

  const canReturn = status === 'delivered' && deliveredDaysAgo <= 3;
  const canReplace = status === 'delivered' && deliveredDaysAgo <= 3;
  const canCancel = status === 'placed' || status === 'processing';
  const canTrack = !!order.tracking_number || !!order.tracking_url || status === 'shipped';

  return (
    <div className="order-card group">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Clock size={13} /> {fmtDate(order.created_at)}
          </span>
          <span className="font-semibold text-gray-800">{fmt(total)}</span>
          {shipTo && (
            <span className="flex items-center gap-1">
              <MapPin size={13} /> {shipTo}
            </span>
          )}
          <span className="font-mono text-gray-400 text-xs">
            {order.order_name || order.order_number}
          </span>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="border-t border-gray-100 pt-4 space-y-4">
        {items.map((item, i) => (
          <div key={item.id || i} className="flex gap-4">
            {/* Product image */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-gray-100 shrink-0 border border-gray-100">
              {item.image ? (
                <img src={item.image} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package size={24} className="text-gray-300" />
                </div>
              )}
            </div>

            {/* Product info */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-sm leading-tight truncate">{item.title}</p>
              {item.variant_title && (
                <p className="text-gray-400 text-xs mt-0.5">{item.variant_title}</p>
              )}
              <p className="text-gray-500 text-xs mt-1">
                {fmt(item.price)} · Qty {item.quantity}
              </p>

              {/* Action buttons — desktop inline */}
              <div className="hidden sm:flex flex-wrap gap-1.5 mt-3">
                {canTrack && (
                  <button onClick={() => onTrack(order)} className="action-btn-primary">
                    <Truck size={13} /> Track
                  </button>
                )}
                {canReturn && (
                  <button onClick={() => onReturn(order, item)} className="action-btn">
                    <RotateCcw size={13} /> Return
                  </button>
                )}
                {canReplace && (
                  <button onClick={() => onReplace(order, item)} className="action-btn">
                    <RefreshCw size={13} /> Replace
                  </button>
                )}
                {canCancel && (
                  <button onClick={() => onCancel(order)} className="action-btn-danger">
                    <Ban size={13} /> Cancel
                  </button>
                )}
                <button className="action-btn">
                  <ShoppingBag size={13} /> Buy Again
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile actions */}
      <div className="sm:hidden flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
        {canTrack && (
          <button onClick={() => onTrack(order)} className="action-btn-primary flex-1">
            <Truck size={13} /> Track
          </button>
        )}
        {canReturn && (
          <button onClick={() => onReturn(order, items[0])} className="action-btn flex-1">
            <RotateCcw size={13} /> Return
          </button>
        )}
        {canReplace && (
          <button onClick={() => onReplace(order, items[0])} className="action-btn flex-1">
            <RefreshCw size={13} /> Replace
          </button>
        )}
        {canCancel && (
          <button onClick={() => onCancel(order)} className="action-btn-danger flex-1">
            <Ban size={13} /> Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

export default function OrdersPage() {
  const [appState, setAppState] = useState<AppState>('login');
  const [orderId, setOrderId] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [customerId, setCustomerId] = useState('');

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('all');
  const [search, setSearch] = useState('');

  const [modal, setModal] = useState<ModalType>(null);
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [allProducts, setAllProducts] = useState<{ id: string; name: string; price: number; image_url?: string }[]>([]);

  // OTP countdown
  useEffect(() => {
    if (otpTimer > 0) {
      const t = setTimeout(() => setOtpTimer(v => v - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [otpTimer]);

  const sendOtp = async () => {
    if (!orderId.trim()) { setError('Please enter your Order ID.'); return; }
    if (!phone.trim()) { setError('Please enter your phone number.'); return; }
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, orderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAppState('otp'); setOtpTimer(60);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length < 6) { setError('Please enter the 6-digit OTP.'); return; }
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp, orderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSessionToken(data.sessionToken);
      setCustomerId(data.customer?.id ?? '');
      setAppState('dashboard');
      fetchOrders(data.sessionToken);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = useCallback(async (token: string) => {
    setOrdersLoading(true);
    try {
      const res = await fetch('/api/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrders(data.orders || []);
    } catch {
      // graceful fallback
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const filteredOrders = orders.filter(order => {
    const status = orderStatus(order);
    const matchesTab =
      activeTab === 'all' ? true :
      activeTab === 'active' ? ['placed', 'processing', 'shipped'].includes(status) :
      activeTab === 'delivered' ? status === 'delivered' :
      activeTab === 'cancelled' ? status === 'cancelled' :
      activeTab === 'returns' ? false : true; // returns tab shows aftersale requests

    const q = search.toLowerCase();
    const matchesSearch = !q || (
      (order.order_name || order.order_number || '').toLowerCase().includes(q) ||
      normalizeItems(order).some(i => i.title?.toLowerCase().includes(q))
    );

    return matchesTab && matchesSearch;
  });

  const activeShipment = orders.find(o => ['shipped', 'processing'].includes(orderStatus(o)));

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'all', label: 'All Orders' },
    { id: 'active', label: 'Active' },
    { id: 'delivered', label: 'Delivered' },
    { id: 'cancelled', label: 'Cancelled' },
    { id: 'returns', label: 'Returns' },
  ];

  // ── Render: Login ──────────────────────────────────────────────────────────

  if (appState === 'login' || appState === 'otp') {
    return (
      <div className="min-h-screen bg-white">
        {/* Hero */}
        <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
          <div className="max-w-6xl mx-auto px-4 py-16 sm:py-20">
            <div className="flex flex-col sm:flex-row items-center gap-10">
              {/* Left text */}
              <div className="flex-1 text-center sm:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 border border-blue-400/30 rounded-full text-xs font-medium text-blue-300 mb-5">
                  <Zap size={11} /> Breakfast Club Order Portal
                </div>
                <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-4 tracking-tight">
                  Manage Your<br />
                  <span className="text-blue-400">Orders Easily</span>
                </h1>
                <p className="text-slate-300 text-lg leading-relaxed mb-6 max-w-md">
                  Track deliveries, request returns, replace products, and manage all your purchases in one secure place.
                </p>
                <div className="space-y-2">
                  {['Secure WhatsApp OTP login', 'Fast returns within policy', 'Real-time order updates'].map(t => (
                    <div key={t} className="flex items-center gap-2 text-sm text-slate-300">
                      <CheckCircle2 size={15} className="text-blue-400 shrink-0" /> {t}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right illustration */}
              <div className="flex gap-4 shrink-0">
                {[
                  { icon: Package, label: 'Track' },
                  { icon: RotateCcw, label: 'Return' },
                  { icon: RefreshCw, label: 'Replace' },
                  { icon: ShieldCheck, label: 'Secure' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-1.5">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                      <Icon size={24} className="text-blue-300" />
                    </div>
                    <span className="text-xs text-slate-400">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Auth Card */}
        <div className="max-w-md mx-auto px-4 -mt-8 pb-16">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-8">
            {appState === 'login' ? (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Find Your Order</h2>
                  <p className="text-gray-500 text-sm mt-1">Enter your details to view and manage orders</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="label">Order ID</label>
                    <input
                      value={orderId}
                      onChange={e => setOrderId(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendOtp()}
                      placeholder="BC-1234"
                      className="input-field text-base"
                    />
                  </div>
                  <div>
                    <label className="label">WhatsApp Phone Number</label>
                    <input
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendOtp()}
                      type="tel"
                      placeholder="+91 XXXXXXXXXX"
                      className="input-field text-base"
                    />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-sm text-red-700">
                      <AlertCircle size={15} /> {error}
                    </div>
                  )}

                  <button onClick={sendOtp} disabled={loading} className="btn-primary w-full text-base py-3.5">
                    {loading ? (
                      <><Loader2 size={16} className="animate-spin" /> Sending OTP...</>
                    ) : (
                      <><MessageCircle size={16} /> Continue with WhatsApp</>
                    )}
                  </button>

                  <p className="text-xs text-center text-gray-400">
                    By continuing, you agree to secure verification. We won't spam you.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="mb-6 text-center">
                  <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <MessageCircle size={26} className="text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Verify Your Number</h2>
                  <p className="text-gray-500 text-sm mt-1">
                    We sent a 6-digit code to your WhatsApp<br />
                    <strong className="text-gray-700">{phone}</strong>
                  </p>
                </div>

                <div className="space-y-4">
                  <OtpInput value={otp} onChange={setOtp} />

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-sm text-red-700">
                      <AlertCircle size={15} /> {error}
                    </div>
                  )}

                  <button onClick={verifyOtp} disabled={loading || otp.length < 6} className="btn-primary w-full">
                    {loading ? <><Loader2 size={16} className="animate-spin" /> Verifying...</> : 'Verify OTP'}
                  </button>

                  <div className="flex items-center justify-between text-sm">
                    <button onClick={() => { setAppState('login'); setOtp(''); setError(''); }}
                      className="text-gray-500 hover:text-gray-700">← Change number</button>
                    {otpTimer > 0 ? (
                      <span className="text-gray-400">Resend in {otpTimer}s</span>
                    ) : (
                      <button onClick={() => { sendOtp(); setOtp(''); }} className="text-blue-600 font-medium hover:text-blue-700">
                        Resend Code
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Trust indicators */}
          <div className="flex items-center justify-center gap-6 mt-6">
            {[
              { icon: Lock, text: 'SSL Encrypted' },
              { icon: ShieldCheck, text: 'OTP Verified' },
              { icon: Star, text: 'Trusted Brand' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-1.5 text-xs text-gray-400">
                <Icon size={12} /> {text}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Dashboard ───────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky top bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-4">
          <div className="flex items-center gap-2 font-extrabold text-gray-900 text-lg tracking-tight shrink-0">
            <ShoppingBag size={20} className="text-blue-600" />
            <span>Breakfast Club</span>
          </div>
          <div className="flex-1 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search orders or products..."
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
            />
          </div>
          <button onClick={() => { setAppState('login'); setOrders([]); setSessionToken(''); }}
            className="text-xs text-gray-400 hover:text-gray-600 shrink-0">Sign out</button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Active shipment banner */}
        {activeShipment && (
          <div className="mb-6 bg-gradient-to-r from-blue-600 to-blue-700 rounded-3xl p-5 text-white">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-blue-200 text-xs font-medium mb-1">YOUR LATEST ACTIVE ORDER</p>
                <h2 className="text-xl font-bold">
                  {activeShipment.expected_delivery
                    ? `Arrives ${activeShipment.expected_delivery}`
                    : `Order ${activeShipment.order_name || activeShipment.order_number} is on its way`}
                </h2>
                <p className="text-blue-200 text-sm mt-1">
                  {normalizeItems(activeShipment)[0]?.title}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Truck size={28} className="text-white" />
                </div>
                <button onClick={() => { setSelectedOrder(activeShipment); setModal('track'); }}
                  className="px-4 py-2 bg-white text-blue-700 rounded-xl text-xs font-bold hover:bg-blue-50 transition-colors whitespace-nowrap">
                  Track Package
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl mb-5 overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-fit px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-150
                ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Orders list */}
        {ordersLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="order-card">
                <div className="flex items-center justify-between mb-4">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <div className="flex gap-4 pt-4 border-t border-gray-100">
                  <Skeleton className="w-20 h-20 rounded-2xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package size={28} className="text-gray-300" />
            </div>
            <p className="font-semibold text-gray-700 text-lg mb-1">
              {search ? 'No results found' : 'No orders here'}
            </p>
            <p className="text-gray-400 text-sm">
              {search ? 'Try a different order ID or product name' : "You don't have any orders in this category yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order, i) => (
              <OrderCard
                key={order.id || i}
                order={order}
                onReturn={(o, item) => { setSelectedOrder(o); setSelectedItem({ order: o, item }); setModal('return'); }}
                onReplace={(o, item) => { setSelectedOrder(o); setSelectedItem({ order: o, item }); setModal('replace'); }}
                onTrack={o => { setSelectedOrder(o); setModal('track'); }}
                onCancel={o => { setSelectedOrder(o); setModal('cancel'); }}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      <ReturnModal
        open={modal === 'return'}
        onClose={() => setModal(null)}
        selected={selectedItem}
        sessionToken={sessionToken}
        customerId={customerId}
      />
      <ReplaceModal
        open={modal === 'replace'}
        onClose={() => setModal(null)}
        selected={selectedItem}
        sessionToken={sessionToken}
        customerId={customerId}
        allProducts={allProducts}
      />
      <TrackModal
        open={modal === 'track'}
        onClose={() => setModal(null)}
        order={selectedOrder}
      />
      <CancelModal
        open={modal === 'cancel'}
        onClose={() => setModal(null)}
        order={selectedOrder}
        sessionToken={sessionToken}
      />
    </div>
  );
}
