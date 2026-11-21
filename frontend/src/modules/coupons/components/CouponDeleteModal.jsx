'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useCouponStore } from '../stores/useCouponStore';

export default function CouponDeleteModal() {
  const {
    selectedCoupon,
    isDeleteModalOpen,
    closeDeleteModal,
    deleteCoupon,
    isDeleting,
    error,
  } = useCouponStore();

  if (!isDeleteModalOpen || !selectedCoupon) return null;

  const handleDelete = async () => {
    await deleteCoupon(selectedCoupon.coupon_id);
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="modal-container"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '460px',
          padding: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <AlertTriangle size={22} />
          </div>
          <button
            type="button"
            onClick={closeDeleteModal}
            disabled={isDeleting}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: 'none',
              background: '#f1f5f9',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              color: '#64748b',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px' }}>
          Delete Coupon {selectedCoupon.code}?
        </h3>
        <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, margin: '0 0 20px' }}>
          Are you sure you want to delete coupon code <strong>{selectedCoupon.code}</strong>? Students will no longer be able to redeem this code during checkout.
        </p>

        {error && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: '12px',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={closeDeleteModal}
            disabled={isDeleting}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: '600',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.7 : 1,
            }}
          >
            {isDeleting ? 'Deleting...' : 'Delete Coupon'}
          </button>
        </div>
      </div>
    </div>
  );
}

