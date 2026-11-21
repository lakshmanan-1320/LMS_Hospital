'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Receipt,
  Search,
  Filter,
  RefreshCw,
  FileText,
  Eye,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  ShoppingBag,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { useOrderStore } from '../stores/useOrderStore';
import OrderDetailModal from './OrderDetailModal';
import InvoiceModal from './InvoiceModal';
import AdminRefundQueueView from '@/modules/refunds/components/AdminRefundQueueView';
import FinancialAuditLedgerView from '@/modules/refunds/components/FinancialAuditLedgerView';

const STATUS_CONFIG = {
  completed: {
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    label: 'Completed',
  },
  pending: {
    bg: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    label: 'Pending',
  },
  failed: {
    bg: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
    label: 'Failed',
  },
  refunded: {
    bg: 'bg-purple-50 text-purple-700 border-purple-200',
    dot: 'bg-purple-500',
    label: 'Refunded',
  },
  partially_refunded: {
    bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dot: 'bg-indigo-500',
    label: 'Partial Refund',
  },
  cancelled: {
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
    label: 'Cancelled',
  },
};

export default function AdminOrdersLedgerView({ role = 'admin' }) {
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'refunds' | 'audit'

  const {
    orders,
    total,
    selectedOrder,
    selectedInvoice,
    isLoading,
    isDetailLoading,
    isInvoiceLoading,
    error,
    search,
    statusFilter,
    page,
    limit,
    fetchOrders,
    fetchOrderDetails,
    fetchInvoice,
    setSearch,
    setStatusFilter,
    setPage,
    clearSelectedOrder,
    clearSelectedInvoice,
  } = useOrderStore();

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => {
    if (activeTab === 'orders') {
      fetchOrders(role);
    }
  }, [role, page, statusFilter, fetchOrders, activeTab]);

  // Debounced search handling
  useEffect(() => {
    if (activeTab !== 'orders') return;
    const timer = setTimeout(() => {
      if (localSearch !== search) {
        setSearch(localSearch);
        fetchOrders(role);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [localSearch, search, setSearch, fetchOrders, role, activeTab]);

  const handleOpenDetail = async (identifier) => {
    setDetailModalOpen(true);
    await fetchOrderDetails(identifier);
  };

  const handleOpenInvoice = async (identifier) => {
    setInvoiceModalOpen(true);
    await fetchInvoice(identifier);
  };

  const handleSwitchFromDetailToInvoice = async (identifier) => {
    setDetailModalOpen(false);
    setInvoiceModalOpen(true);
    await fetchInvoice(identifier);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Platform Metrics
  const metrics = useMemo(() => {
    const count = total;
    const completedOrders = orders.filter((o) => o.status === 'completed');
    const totalSpentOrRevenue = orders.reduce(
      (sum, o) => sum + Number(o.total_amount ?? o.totalAmount ?? 0),
      0
    );
    const totalItems = orders.reduce((sum, o) => sum + (o.items?.length || 1), 0);
    return {
      count,
      completedCount: completedOrders.length,
      amount: totalSpentOrRevenue,
      totalItems,
    };
  }, [orders, total]);

  const formatPrice = (val, currency = 'INR') => {
    const num = Number(val || 0);
    return `${currency === 'INR' ? '₹' : currency} ${num.toLocaleString('en-IN')}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return String(dateStr);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Header */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Platform Orders & Financial Ledger
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Audit checkouts, process student refund requests, and inspect the double-entry financial audit trail.
            </p>
          </div>

          {activeTab === 'orders' && (
            <button
              type="button"
              onClick={() => fetchOrders(role)}
              disabled={isLoading}
              className="self-start sm:self-auto inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs transition disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin text-teal-600' : ''} />
              <span>Refresh</span>
            </button>
          )}
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-6 mt-6">
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`relative pb-3 text-sm font-bold transition flex items-center gap-2 ${
              activeTab === 'orders'
                ? 'text-slate-900 border-b-2 border-slate-900'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt size={16} />
            <span>Platform Orders</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('refunds')}
            className={`relative pb-3 text-sm font-bold transition flex items-center gap-2 ${
              activeTab === 'refunds'
                ? 'text-slate-900 border-b-2 border-slate-900'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <RotateCcw size={16} />
            <span>Refund Requests</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`relative pb-3 text-sm font-bold transition flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'text-slate-900 border-b-2 border-slate-900'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck size={16} />
            <span>Financial Audit Ledger</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'refunds' ? (
        <AdminRefundQueueView />
      ) : activeTab === 'audit' ? (
        <FinancialAuditLedgerView />
      ) : (
        /* PLATFORM ORDERS TAB */
        <div className="space-y-6">
          {/* Metrics Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Total Orders</span>
                <Receipt size={16} className="text-teal-600" />
              </div>
              <div className="text-2xl font-heading font-bold text-slate-900">{metrics.count}</div>
              <span className="text-[10px] text-slate-400 block mt-0.5">Recorded on platform</span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Page Volume</span>
                <DollarSign size={16} className="text-teal-600" />
              </div>
              <div className="text-2xl font-heading font-bold text-slate-900">
                {formatPrice(metrics.amount)}
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">Across active page</span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Courses Purchased</span>
                <BookOpen size={16} className="text-teal-600" />
              </div>
              <div className="text-2xl font-heading font-bold text-slate-900">{metrics.totalItems}</div>
              <span className="text-[10px] text-slate-400 block mt-0.5">Course item records</span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Completed</span>
                <CheckCircle2 size={16} className="text-emerald-600" />
              </div>
              <div className="text-2xl font-heading font-bold text-emerald-700">
                {metrics.completedCount}
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">Paid & enrolled</span>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Search by order number (ORD-...), student email, or name..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter size={15} className="text-slate-400 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-teal-500 focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed / Paid</option>
                <option value="pending">Pending Payment</option>
                <option value="refunded">Refunded</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Orders List / Table */}
          {isLoading ? (
            <div className="py-20 text-center text-slate-400 space-y-3 rounded-2xl border border-slate-200 bg-white shadow-xs">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
              <p className="text-xs font-medium">Fetching platform orders ledger...</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 text-xs flex items-center gap-3">
              <AlertCircle size={18} className="shrink-0 text-rose-600" />
              <div>
                <p className="font-bold">Error loading orders</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center rounded-2xl border border-dashed border-slate-200 bg-white space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                <ShoppingBag size={22} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">No orders found</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {search || statusFilter !== 'all'
                    ? 'Try adjusting your search or status filter.'
                    : 'No platform orders recorded yet.'}
                </p>
              </div>
            </div>
          ) : (
            /* FULL-SCREEN ADMIN DATA TABLE */
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-4">Order Number</th>
                      <th className="py-3.5 px-4">Student</th>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4">Items / Course</th>
                      <th className="py-3.5 px-4">Gateway Reference</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Amount</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.map((ord) => {
                      const status = ord.status || 'completed';
                      const st = STATUS_CONFIG[status] || STATUS_CONFIG.cancelled;
                      const orderNum = ord.order_number || ord.orderNumber;
                      const invoiceNum = ord.invoice_number || ord.invoiceNumber;
                      const amt = ord.total_amount ?? ord.totalAmount;
                      const date = ord.created_at || ord.createdAt;
                      const studentName =
                        ord.student_name ||
                        ord.studentName ||
                        [ord.first_name, ord.last_name].filter(Boolean).join(' ') ||
                        ord.billing_details?.studentName ||
                        ord.billingDetails?.studentName ||
                        'Student';
                      const studentEmail =
                        ord.student_email ||
                        ord.studentEmail ||
                        ord.email ||
                        ord.billing_details?.email ||
                        ord.billingDetails?.email ||
                        '';

                      return (
                        <tr
                          key={ord.order_id || ord.orderId || orderNum}
                          className="hover:bg-slate-50/50 transition"
                        >
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-slate-900 block">{orderNum}</span>
                            {invoiceNum && (
                              <span className="text-[10px] text-slate-400 font-mono">{invoiceNum}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-slate-900">{studentName}</p>
                            <p className="text-[11px] text-slate-500 font-mono">{studentEmail}</p>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                            {formatDate(date)}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                              <BookOpen size={12} /> {ord.items?.length || ord.item_count || 1} course(s)
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                            {ord.payment_id || ord.paymentId ? (
                              <span title={ord.payment_id || ord.paymentId}>
                                {(ord.payment_id || ord.paymentId).slice(0, 14)}...
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${st.bg}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                              {st.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                            {formatPrice(amt, ord.currency)}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenDetail(orderNum || ord.order_id || ord.orderId)}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-teal-700 hover:border-teal-300 transition"
                                title="View Order Details"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenInvoice(orderNum || ord.order_id || ord.orderId)}
                                className="p-1.5 rounded-lg border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 transition"
                                title="View Tax Invoice"
                              >
                                <FileText size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xs">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1 || isLoading}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>
              <span className="text-slate-500 font-medium">
                Page <strong className="text-slate-900">{page}</strong> of{' '}
                <strong className="text-slate-900">{totalPages}</strong>
              </span>
              <button
                type="button"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages || isLoading}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <OrderDetailModal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          clearSelectedOrder();
        }}
        order={selectedOrder}
        isLoading={isDetailLoading}
        onOpenInvoice={handleSwitchFromDetailToInvoice}
        role={role}
      />

      <InvoiceModal
        isOpen={invoiceModalOpen}
        onClose={() => {
          setInvoiceModalOpen(false);
          clearSelectedInvoice();
        }}
        invoice={selectedInvoice}
        isLoading={isInvoiceLoading}
      />
    </div>
  );
}
