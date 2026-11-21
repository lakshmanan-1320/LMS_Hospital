'use client';

import { useEffect, useState } from 'react';
import {
  Tag,
  Plus,
  Search,
  Filter,
  Copy,
  Check,
  Share2,
  ExternalLink,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useCouponStore } from '../stores/useCouponStore';
import CouponFormModal from './CouponFormModal';
import CouponDeleteModal from './CouponDeleteModal';

export default function CouponManagementView({ role = 'admin' }) {
  const isInstructor = role === 'instructor';

  const {
    coupons,
    total,
    page,
    limit,
    totalPages,
    isLoading,
    filters,
    setFilters,
    setPage,
    fetchCoupons,
    openCreateModal,
    openEditModal,
    openDeleteModal,
    error,
    successMessage,
    resetStatus,
  } = useCouponStore();

  const [copiedCode, setCopiedCode] = useState(null);
  const [copiedLink, setCopiedLink] = useState(null);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => resetStatus(), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, resetStatus]);

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleCopyLink = (coupon) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    let url = '';
    if (coupon.course_slug || coupon.course_id) {
      url = `${origin}/courses/${coupon.course_slug || coupon.course_id}?coupon=${coupon.code}`;
    } else {
      url = `${origin}/cart?coupon=${coupon.code}`;
    }
    navigator.clipboard.writeText(url);
    setCopiedLink(coupon.coupon_id);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  // Quick stats computed from current coupon list
  const activeCount = coupons.filter((c) => c.is_active).length;
  const totalRedemptions = coupons.reduce((sum, c) => sum + Number(c.used_count || 0), 0);

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1360px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {successMessage && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 20px',
            backgroundColor: '#065f46',
            color: '#ffffff',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
            fontSize: '13px',
            fontWeight: '600',
          }}
        >
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', margin: '4px 0 6px' }}>
            {isInstructor ? 'Platform Coupons & Promotions' : 'Coupons & Discounts'}
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0, maxWidth: '640px' }}>
            {isInstructor
              ? 'Browse platform coupons created by administrators. You can copy coupon codes or share links with your students, or apply admin-created coupons to your courses in the Course Editor under Pricing & Access.'
              : 'Create and govern platform-wide promotional campaigns, review instructor course coupons, and track student redemption metrics.'}
          </p>
        </div>

        {!isInstructor && (
          <button
            type="button"
            onClick={openCreateModal}
            className="btn btn-dark"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              fontSize: '13px',
              fontWeight: '600',
              borderRadius: '10px',
              backgroundColor: 'var(--dash-primary, #0d9488)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(13, 148, 136, 0.2)',
            }}
          >
            <Plus size={16} />
            New Promotional Coupon
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div style={{ backgroundColor: '#ffffff', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
            Total Coupons
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
            {total}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
            {isInstructor ? 'Created by you' : 'Platform & course total'}
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
            Active Offers
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#059669', marginTop: '4px' }}>
            {activeCount}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
            Ready for student checkout
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
            Total Redemptions
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--dash-text, #0284c7)', marginTop: '4px' }}>
            {totalRedemptions}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
            Students claimed discount
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '16px 20px',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
              }}
            />
            <input
              type="text"
              placeholder="Search by code or description..."
              value={filters.search}
              onChange={(e) => setFilters({ search: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                color: '#0f172a',
              }}
            />
          </div>

          {/* Scope filter (Admin only) */}
          {!isInstructor && (
            <select
              value={filters.scope}
              onChange={(e) => setFilters({ scope: e.target.value })}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                color: '#475569',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="all">All Scopes</option>
              <option value="platform">Platform-wide</option>
              <option value="course">Course-specific</option>
            </select>
          )}

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => setFilters({ status: e.target.value })}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              color: '#475569',
              backgroundColor: '#ffffff',
            }}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Coupons Table */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        {isLoading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '14px', fontWeight: '600' }}>Loading coupons...</div>
          </div>
        ) : coupons.length === 0 ? (
          <div style={{ padding: '64px 24px', textAlign: 'center' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                backgroundColor: '#f1f5f9',
                color: '#94a3b8',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 16px',
              }}
            >
              <Tag size={28} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px' }}>
              No coupons found
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '420px', margin: '0 auto 18px' }}>
              {isInstructor
                ? 'No platform promotional coupons have been created by administrators yet.'
                : 'No promotional coupons have been created. Click "+ New Promotional Coupon" to begin.'}
            </p>
            {!isInstructor && (
              <button
                type="button"
                onClick={openCreateModal}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--dash-primary, #0d9488)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                + Create Coupon
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '12px 18px' }}>Code & Description</th>
                  <th style={{ padding: '12px 18px' }}>Scope & Target</th>
                  <th style={{ padding: '12px 18px' }}>Discount</th>
                  <th style={{ padding: '12px 18px' }}>Usage / Limit</th>
                  <th style={{ padding: '12px 18px' }}>Validity</th>
                  <th style={{ padding: '12px 18px' }}>Status</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody style={{ divideY: '1px solid #e2e8f0' }}>
                {coupons.map((coupon) => {
                  const isExpired = coupon.valid_until && new Date(coupon.valid_until) < new Date();
                  const isUsedUp = coupon.usage_limit !== null && Number(coupon.used_count) >= Number(coupon.usage_limit);

                  return (
                    <tr
                      key={coupon.coupon_id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fafafa')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Code & Description */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: '700',
                              fontSize: '13px',
                              letterSpacing: '0.04em',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              backgroundColor: '#f1f5f9',
                              color: '#0f172a',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            {coupon.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(coupon.code)}
                            title="Copy Code"
                            style={{
                              border: 'none',
                              background: 'none',
                              cursor: 'pointer',
                              color: copiedCode === coupon.code ? '#059669' : '#94a3b8',
                              padding: '2px',
                            }}
                          >
                            {copiedCode === coupon.code ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                        {coupon.description && (
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                            {coupon.description}
                          </div>
                        )}
                      </td>

                      {/* Scope & Target */}
                      <td style={{ padding: '14px 18px' }}>
                        {coupon.scope === 'course' ? (
                          <div>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: '9999px',
                                fontSize: '11px',
                                fontWeight: '600',
                                backgroundColor: '#f0fdfa',
                                color: '#0f766e',
                                border: '1px solid #99f6e4',
                              }}
                            >
                              🎯 Course Only
                            </span>
                            <div
                              style={{
                                fontSize: '12px',
                                fontWeight: '600',
                                color: '#0f172a',
                                marginTop: '4px',
                                maxWidth: '220px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={coupon.course_title || 'Target Course'}
                            >
                              {coupon.course_title || 'Target Course'}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: '9999px',
                                fontSize: '11px',
                                fontWeight: '600',
                                backgroundColor: '#f5f3ff',
                                color: '#6d28d9',
                                border: '1px solid #ddd6fe',
                              }}
                            >
                              🌐 Platform-wide
                            </span>
                          </div>
                        )}
                        {!isInstructor && coupon.instructor_name && (
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                            by {coupon.instructor_name}
                          </div>
                        )}
                      </td>

                      {/* Discount Value */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>
                          {coupon.discount_type === 'percentage'
                            ? `${Number(coupon.discount_value)}% OFF`
                            : `₹${Number(coupon.discount_value)} OFF`}
                        </div>
                        {coupon.max_discount_amount && coupon.discount_type === 'percentage' && (
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            Capped at ₹{coupon.max_discount_amount}
                          </div>
                        )}
                        {Number(coupon.min_order_value) > 0 && (
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                            Min order ₹{coupon.min_order_value}
                          </div>
                        )}
                      </td>

                      {/* Usage */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>
                          {coupon.used_count}{' '}
                          <span style={{ color: '#94a3b8', fontWeight: '400' }}>
                            / {coupon.usage_limit ? coupon.usage_limit : '∞'}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          Max {coupon.per_user_limit} per student
                        </div>
                      </td>

                      {/* Validity */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontSize: '12px', color: '#0f172a' }}>
                          {new Date(coupon.valid_from).toLocaleDateString()}
                        </div>
                        <div style={{ fontSize: '11px', color: isExpired ? '#dc2626' : '#64748b' }}>
                          {coupon.valid_until
                            ? `Expires ${new Date(coupon.valid_until).toLocaleDateString()}`
                            : 'No expiration'}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 18px' }}>
                        {isExpired ? (
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '9999px',
                              fontSize: '11px',
                              fontWeight: '600',
                              backgroundColor: '#fee2e2',
                              color: '#b91c1c',
                            }}
                          >
                            Expired
                          </span>
                        ) : isUsedUp ? (
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '9999px',
                              fontSize: '11px',
                              fontWeight: '600',
                              backgroundColor: '#fee2e2',
                              color: '#b91c1c',
                            }}
                          >
                            Exhausted
                          </span>
                        ) : coupon.is_active ? (
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '9999px',
                              fontSize: '11px',
                              fontWeight: '600',
                              backgroundColor: '#dcfce7',
                              color: '#15803d',
                            }}
                          >
                            Active
                          </span>
                        ) : (
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '9999px',
                              fontSize: '11px',
                              fontWeight: '600',
                              backgroundColor: '#f1f5f9',
                              color: '#64748b',
                            }}
                          >
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          {/* Share Link Button */}
                          <button
                            type="button"
                            onClick={() => handleCopyLink(coupon)}
                            title="Copy Shareable Link"
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: copiedLink === coupon.coupon_id ? '#ecfdf5' : '#ffffff',
                              color: copiedLink === coupon.coupon_id ? '#059669' : '#334155',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: '600',
                            }}
                          >
                            {copiedLink === coupon.coupon_id ? <Check size={13} /> : <Share2 size={13} />}
                            {copiedLink === coupon.coupon_id ? 'Copied!' : 'Share'}
                          </button>

                          {!isInstructor && (
                            <>
                              {/* Edit Button */}
                              <button
                                type="button"
                                onClick={() => openEditModal(coupon)}
                                title="Edit Coupon"
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: '#ffffff',
                                  color: '#475569',
                                  cursor: 'pointer',
                                  display: 'grid',
                                  placeItems: 'center',
                                }}
                              >
                                <Edit2 size={13} />
                              </button>

                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={() => openDeleteModal(coupon)}
                                title="Delete Coupon"
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  borderRadius: '6px',
                                  border: '1px solid #fee2e2',
                                  backgroundColor: '#fff1f2',
                                  color: '#e11d48',
                                  cursor: 'pointer',
                                  display: 'grid',
                                  placeItems: 'center',
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#fafafa',
            }}
          >
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} coupons total)
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '12px',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  opacity: page <= 1 ? 0.5 : 1,
                }}
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '12px',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: page >= totalPages ? 0.5 : 1,
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals (Admin only for creation & deletion) */}
      {!isInstructor && (
        <>
          <CouponFormModal role={role} />
          <CouponDeleteModal />
        </>
      )}
    </div>
  );
}

