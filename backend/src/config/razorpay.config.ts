import { registerAs } from '@nestjs/config';

export const razorpayConfig = registerAs('razorpay', () => ({
  keyId: process.env.RAZORPAY_KEY_ID || '',
  keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || 'lms_wh_secret_test_32chars_key!',
  mockMode: process.env.RAZORPAY_MOCK_MODE === 'true', // true only if explicitly set to 'true'; false runs real-time Razorpay
  currency: process.env.RAZORPAY_CURRENCY || 'INR',
}));

