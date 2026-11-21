const RAZORPAY_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

let loadingPromise = null;

/**
 * Load the Razorpay Checkout SDK once, on demand (only when the user starts a paid checkout).
 * @returns {Promise<boolean>} true when window.Razorpay is available
 */
export function loadRazorpay() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => {
      loadingPromise = null; // allow a retry on the next attempt
      script.remove();
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return loadingPromise;
}
