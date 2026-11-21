'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Percent,
  IndianRupee,
  Calendar,
  AlertCircle,
  HelpCircle,
  Check,
  Tag,
  BookOpen,
} from 'lucide-react';
import { useCouponStore } from '../stores/useCouponStore';

/**
 * Generate a clean, random promotional code e.g. "PROMO-7K9A" or "SAVE50"
 */
function generateCode(prefix = 'PROMO') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${rand}`;
}

export default function CouponFormModal({ role = 'admin' }) {
  const isInstructor = role === 'instructor';

  const {
    selectedCoupon,
    isFormModalOpen,
    closeFormModal,
    createCoupon,
    updateCoupon,
    isSaving,
    error,
    myCourses,
    fetchMyCourses,
    isLoadingCourses,
  } = useCouponStore();

  const isEditing = Boolean(selectedCoupon);

  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [scope, setScope] = useState(isInstructor ? 'course' : 'platform');
  const [courseId, setCourseId] = useState('');
  const [minOrderValue, setMinOrderValue] = useState('0');
  const [maxDiscountAmount, setMaxDiscountAmount] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [perUserLimit, setPerUserLimit] = useState('1');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState('');

  // Preload courses for instructor or when scope is course
  useEffect(() => {
    if (isFormModalOpen) {
      fetchMyCourses();
    }
  }, [isFormModalOpen, fetchMyCourses]);

  // Populate form if editing
  useEffect(() => {
    if (selectedCoupon) {
      setCode(selectedCoupon.code || '');
      setDescription(selectedCoupon.description || '');
      setDiscountType(selectedCoupon.discount_type || 'percentage');
      setDiscountValue(selectedCoupon.discount_value !== undefined ? String(selectedCoupon.discount_value) : '');
      setScope(selectedCoupon.scope || (isInstructor ? 'course' : 'platform'));
      setCourseId(selectedCoupon.course_id || '');
      setMinOrderValue(selectedCoupon.min_order_value !== undefined ? String(selectedCoupon.min_order_value) : '0');
      setMaxDiscountAmount(selectedCoupon.max_discount_amount !== null && selectedCoupon.max_discount_amount !== undefined ? String(selectedCoupon.max_discount_amount) : '');
      setUsageLimit(selectedCoupon.usage_limit !== null && selectedCoupon.usage_limit !== undefined ? String(selectedCoupon.usage_limit) : '');
      setPerUserLimit(selectedCoupon.per_user_limit !== undefined ? String(selectedCoupon.per_user_limit) : '1');

      if (selectedCoupon.valid_from) {
        setValidFrom(new Date(selectedCoupon.valid_from).toISOString().slice(0, 16));
      } else {
        setValidFrom(new Date().toISOString().slice(0, 16));
      }

      if (selectedCoupon.valid_until) {
        setValidUntil(new Date(selectedCoupon.valid_until).toISOString().slice(0, 16));
      } else {
        setValidUntil('');
      }

      setIsActive(selectedCoupon.is_active !== undefined ? selectedCoupon.is_active : true);
    } else {
      // Default new coupon values
      setCode('');
      setDescription('');
      setDiscountType('percentage');
      setDiscountValue('20');
      setScope(isInstructor ? 'course' : 'platform');
      setCourseId(myCourses.length > 0 ? (myCourses[0].courseId || myCourses[0].course_id || '') : '');
      setMinOrderValue('0');
      setMaxDiscountAmount('');
      setUsageLimit('100');
      setPerUserLimit('1');
      setValidFrom(new Date().toISOString().slice(0, 16));

      // Default valid for 14 days
      const d = new Date();
      d.setDate(d.getDate() + 14);
      setValidUntil(d.toISOString().slice(0, 16));

      setIsActive(true);
    }
    setFormError('');
  }, [selectedCoupon, isFormModalOpen, isInstructor, myCourses]);

  if (!isFormModalOpen) return null;

  const handleQuickPresetDays = (days) => {
    const from = validFrom ? new Date(validFrom) : new Date();
    const until = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
    setValidUntil(until.toISOString().slice(0, 16));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setFormError('Coupon code is required.');
      return;
    }

    const numValue = Number(discountValue);
    if (isNaN(numValue) || numValue <= 0) {
      setFormError('Discount value must be greater than zero.');
      return;
    }

    if (discountType === 'percentage' && numValue > 100) {
      setFormError('Percentage discount cannot exceed 100%.');
      return;
    }

    if ((isInstructor || scope === 'course') && !courseId) {
      setFormError('Please select a course for this course-scoped coupon.');
      return;
    }

    if (validUntil && validFrom && new Date(validUntil) <= new Date(validFrom)) {
      setFormError('Expiry date must be after start date.');
      return;
    }

    const payload = {
      code: cleanCode,
      description: description.trim() || undefined,
      discount_type: discountType,
      discount_value: numValue,
      scope: isInstructor ? 'course' : scope,
      course_id: (isInstructor || scope === 'course') ? courseId : undefined,
      min_order_value: Number(minOrderValue) || 0,
      max_discount_amount: maxDiscountAmount ? Number(maxDiscountAmount) : undefined,
      usage_limit: usageLimit ? Number(usageLimit) : undefined,
      per_user_limit: Number(perUserLimit) || 1,
      valid_from: validFrom ? new Date(validFrom).toISOString() : new Date().toISOString(),
      valid_until: validUntil ? new Date(validUntil).toISOString() : undefined,
      is_active: isActive,
    };

    let result;
    if (isEditing) {
      result = await updateCoupon(selectedCoupon.coupon_id, payload);
    } else {
      result = await createCoupon(payload);
    }

    if (!result?.success) {
      setFormError(result?.error || 'Failed to save coupon.');
    }
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
        overflowY: 'auto',
      }}
    >
      <div
        className="modal-container"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '620px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#fafaf9',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: '#ecfdf5',
                color: '#059669',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Tag size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                {isEditing ? 'Edit Coupon' : isInstructor ? 'Create Course Coupon' : 'Create Platform Coupon'}
              </h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
                {isInstructor
                  ? 'Self-service promotional code for your published course'
                  : 'Platform-wide or course-targeted promotional discount'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeFormModal}
            disabled={isSaving}
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

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          {(formError || error) && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} />
              <span>{formError || error}</span>
            </div>
          )}

          {/* Scope Selector (Only for Admin, Instructors are locked to course) */}
          {!isInstructor ? (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '6px' }}>
                Coupon Scope
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setScope('platform')}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1.5px solid ${scope === 'platform' ? 'var(--dash-primary, #0d9488)' : '#e2e8f0'}`,
                    backgroundColor: scope === 'platform' ? '#f0fdfa' : '#ffffff',
                    color: scope === 'platform' ? '#0f766e' : '#475569',
                    fontSize: '13px',
                    fontWeight: scope === 'platform' ? '600' : '500',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  🌐 Platform-wide (All Courses)
                </button>
                <button
                  type="button"
                  onClick={() => setScope('course')}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1.5px solid ${scope === 'course' ? 'var(--dash-primary, #0d9488)' : '#e2e8f0'}`,
                    backgroundColor: scope === 'course' ? '#f0fdfa' : '#ffffff',
                    color: scope === 'course' ? '#0f766e' : '#475569',
                    fontSize: '13px',
                    fontWeight: scope === 'course' ? '600' : '500',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  🎯 Specific Course
                </button>
              </div>
            </div>
          ) : null}

          {/* Target Course Selector (Required if scope is course or user is instructor) */}
          {(isInstructor || scope === 'course') && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '6px' }}>
                Target Course <span style={{ color: '#ef4444' }}>*</span>
              </label>
              {isLoadingCourses ? (
                <div style={{ fontSize: '13px', color: '#64748b' }}>Loading your courses...</div>
              ) : myCourses.length === 0 ? (
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fef3c7',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#92400e',
                  }}
                >
                  No published paid courses found. You must have at least one published paid course to create a course coupon.
                </div>
              ) : (
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#0f172a',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <option value="">-- Select a published course --</option>
                  {myCourses.map((c) => {
                    const cid = c.courseId || c.course_id;
                    const price = c.price ?? 0;
                    return (
                      <option key={cid} value={cid}>
                        {c.title} (₹{price})
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          )}

          {/* Coupon Code & Generate Button */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '6px' }}>
              Coupon Code <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. REACT50, SUMMER25"
                maxLength={30}
                required
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  fontWeight: '700',
                  letterSpacing: '0.05em',
                  color: '#0f172a',
                  textTransform: 'uppercase',
                }}
              />
              <button
                type="button"
                onClick={() => setCode(generateCode(isInstructor ? 'SAVE' : 'SALE'))}
                className="btn btn-small"
                style={{
                  padding: '0 14px',
                  fontSize: '12px',
                  borderRadius: '8px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <Sparkles size={14} />
                Generate
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '6px' }}>
              Description / Promotion Note
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 50% discount for YouTube community"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                color: '#0f172a',
              }}
            />
          </div>

          {/* Discount Type & Value */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '6px' }}>
                Discount Type
              </label>
              <div style={{ display: 'flex', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setDiscountType('percentage')}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    fontSize: '12px',
                    fontWeight: discountType === 'percentage' ? '700' : '500',
                    border: 'none',
                    backgroundColor: discountType === 'percentage' ? 'var(--dash-primary, #0d9488)' : '#f8fafc',
                    color: discountType === 'percentage' ? '#ffffff' : '#475569',
                    cursor: 'pointer',
                  }}
                >
                  % Percentage
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType('fixed')}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    fontSize: '12px',
                    fontWeight: discountType === 'fixed' ? '700' : '500',
                    border: 'none',
                    backgroundColor: discountType === 'fixed' ? 'var(--dash-primary, #0d9488)' : '#f8fafc',
                    color: discountType === 'fixed' ? '#ffffff' : '#475569',
                    cursor: 'pointer',
                  }}
                >
                  ₹ Fixed Amount
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '6px' }}>
                {discountType === 'percentage' ? 'Percentage Off (%)' : 'Discount Amount (₹)'} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="number"
                min="0.01"
                max={discountType === 'percentage' ? '100' : '99999'}
                step="any"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === 'percentage' ? 'e.g. 50' : 'e.g. 200'}
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#0f172a',
                }}
              />
            </div>
          </div>

          {/* Limits: Min Order & Max Discount (Cap) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '6px' }}>
                Min Order Value (₹)
              </label>
              <input
                type="number"
                min="0"
                value={minOrderValue}
                onChange={(e) => setMinOrderValue(e.target.value)}
                placeholder="0"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#0f172a',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '6px' }}>
                Max Cap (₹, Optional)
              </label>
              <input
                type="number"
                min="1"
                value={maxDiscountAmount}
                onChange={(e) => setMaxDiscountAmount(e.target.value)}
                placeholder="No max cap"
                disabled={discountType === 'fixed'}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#0f172a',
                  backgroundColor: discountType === 'fixed' ? '#f1f5f9' : '#ffffff',
                }}
              />
            </div>
          </div>

          {/* Usage Limit & Per User Limit */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '6px' }}>
                Total Usage Limit
              </label>
              <input
                type="number"
                min="1"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                placeholder="e.g. 100 students"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#0f172a',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '6px' }}>
                Per-Student Limit
              </label>
              <input
                type="number"
                min="1"
                value={perUserLimit}
                onChange={(e) => setPerUserLimit(e.target.value)}
                placeholder="1"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#0f172a',
                }}
              />
            </div>
          </div>

          {/* Dates & Quick Presets */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '6px' }}>
                Start Date
              </label>
              <input
                type="datetime-local"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#0f172a',
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', margin: 0 }}>
                  Expiry Date
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => handleQuickPresetDays(7)}
                    style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: '#e2e8f0', border: 'none', cursor: 'pointer' }}
                  >
                    +7d
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPresetDays(14)}
                    style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: '#e2e8f0', border: 'none', cursor: 'pointer' }}
                  >
                    +14d
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPresetDays(30)}
                    style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: '#e2e8f0', border: 'none', cursor: 'pointer' }}
                  >
                    +30d
                  </button>
                </div>
              </div>
              <input
                type="datetime-local"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                placeholder="Optional (Never)"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#0f172a',
                }}
              />
            </div>
          </div>

          {/* Active Switch */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>Coupon Status</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {isActive ? 'Active and immediately redeemable by students' : 'Inactive / paused'}
              </div>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span
                style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  inset: 0,
                  backgroundColor: isActive ? 'var(--dash-primary, #0d9488)' : '#cbd5e1',
                  borderRadius: '24px',
                  transition: '0.2s',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    content: '""',
                    height: '18px',
                    width: '18px',
                    left: isActive ? '23px' : '3px',
                    bottom: '3px',
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    transition: '0.2s',
                  }}
                />
              </span>
            </label>
          </div>

          {/* Modal Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              marginTop: '10px',
              paddingTop: '16px',
              borderTop: '1px solid #e2e8f0',
            }}
          >
            <button
              type="button"
              onClick={closeFormModal}
              disabled={isSaving}
              style={{
                padding: '9px 18px',
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
              type="submit"
              disabled={isSaving || ((isInstructor || scope === 'course') && myCourses.length === 0)}
              style={{
                padding: '9px 22px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--dash-primary, #0d9488)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '600',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.7 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {isSaving ? 'Saving...' : isEditing ? 'Update Coupon' : 'Create Coupon'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

