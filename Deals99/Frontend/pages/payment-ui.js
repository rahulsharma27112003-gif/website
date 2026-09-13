/**
 * Client-side payment helpers (Stripe Elements + Razorpay Checkout).
 */
import { fetchPaymentConfig, verifyPayment } from '../api.js';

let stripeInstance = null;
let stripeElements = null;
let cardElement = null;

export async function getPaymentConfig() {
  return fetchPaymentConfig();
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export async function initStripeCardElement(publishableKey, mountSelector = '#stripe-card-element') {
  if (!publishableKey) throw new Error('Stripe publishable key not configured');
  await loadScript('https://js.stripe.com/v3/');
  stripeInstance = window.Stripe(publishableKey);
  stripeElements = stripeInstance.elements();
  const mount = document.querySelector(mountSelector);
  if (!mount) throw new Error('Stripe mount element not found');
  mount.innerHTML = '';
  cardElement = stripeElements.create('card', { hidePostalCode: true });
  cardElement.mount(mount);
  return { stripe: stripeInstance, cardElement };
}

export async function confirmStripeCardPayment(clientSecret) {
  if (!stripeInstance || !cardElement) {
    throw new Error('Stripe card element not initialized');
  }
  const result = await stripeInstance.confirmCardPayment(clientSecret, {
    payment_method: { card: cardElement },
  });
  if (result.error) {
    throw new Error(result.error.message || 'Stripe payment failed');
  }
  const intent = result.paymentIntent;
  if (intent?.id) {
    await verifyPayment(intent.id, 'stripe');
  }
  return intent;
}

export async function openRazorpayCheckout({ keyId, orderId, amount, currency = 'INR', orderNumber, onSuccess }) {
  if (!keyId) throw new Error('Razorpay key not configured');
  await loadScript('https://checkout.razorpay.com/v1/checkout.js');
  return new Promise((resolve, reject) => {
    const options = {
      key: keyId,
      amount: Math.round(parseFloat(amount) * 100),
      currency,
      name: 'Deals99',
      description: `Order ${orderNumber || orderId}`,
      order_id: orderId,
      handler: async (response) => {
        try {
          await verifyPayment(response.razorpay_payment_id, 'razorpay');
          sessionStorage.removeItem('deals99_pending_payment');
          onSuccess?.(response);
          resolve(response);
        } catch (err) {
          reject(err);
        }
      },
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled')),
      },
    };
    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', (resp) => {
      reject(new Error(resp.error?.description || 'Razorpay payment failed'));
    });
    rzp.open();
  });
}

export function showPaymentModal({ title, bodyHtml, onConfirm, confirmLabel = 'Pay now' }) {
  let modal = document.getElementById('deals99PaymentModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'deals99PaymentModal';
    modal.className = 'modal fade';
    modal.tabIndex = -1;
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="deals99PaymentModalTitle">Complete payment</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body" id="deals99PaymentModalBody"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" id="deals99PaymentConfirmBtn">${confirmLabel}</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  document.getElementById('deals99PaymentModalTitle').textContent = title;
  document.getElementById('deals99PaymentModalBody').innerHTML = bodyHtml;
  const bsModal = new bootstrap.Modal(modal);
  const confirmBtn = document.getElementById('deals99PaymentConfirmBtn');
  const newConfirm = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
  newConfirm.addEventListener('click', async () => {
    newConfirm.disabled = true;
    newConfirm.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Processing…';
    try {
      await onConfirm();
      bsModal.hide();
    } catch (err) {
      window.NotificationManager?.show(err.message || 'Payment failed', 'error');
    } finally {
      newConfirm.disabled = false;
      newConfirm.textContent = confirmLabel;
    }
  });
  bsModal.show();
  return bsModal;
}

export async function completePendingPayment(pending, order) {
  const config = await getPaymentConfig();

  if (pending.payment_method === 'stripe' && pending.client_secret && config.stripe_publishable_key) {
    showPaymentModal({
      title: 'Pay with card (Stripe)',
      bodyHtml: '<p class="small text-muted mb-3">Enter card details to complete your order.</p><div id="stripe-card-element" class="form-control py-3"></div>',
      confirmLabel: 'Pay now',
      onConfirm: async () => {
        await initStripeCardElement(config.stripe_publishable_key);
        await confirmStripeCardPayment(pending.client_secret);
        sessionStorage.removeItem('deals99_pending_payment');
        window.NotificationManager?.show('Payment completed successfully', 'success');
      },
    });
    return true;
  }

  if (pending.payment_method === 'razorpay' && pending.razorpay_order_id) {
    const keyId = pending.razorpay_key_id || config.razorpay_key_id;
    await openRazorpayCheckout({
      keyId,
      orderId: pending.razorpay_order_id,
      amount: order?.total_amount || order?.total || 0,
      orderNumber: order?.order_number,
      onSuccess: () => {
        window.NotificationManager?.show('Payment completed successfully', 'success');
      },
    });
    return true;
  }

  return false;
}
