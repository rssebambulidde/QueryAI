import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Enhanced error message parser for payment errors
 * Provides user-friendly, actionable error messages based on error type
 */
export function getPaymentErrorMessage(error: string | null | undefined, payment?: { callback_data?: Record<string, any> }): string {
  if (!error) {
    return 'Payment failed. Please try again or contact support.';
  }

  const errorLower = error.toLowerCase();
  const failureReason = payment?.callback_data?.failure_reason || payment?.callback_data?.failed_payment_reason;

  // Check failure reason first (from PayPal webhook/callback)
  if (failureReason) {
    const reasonLower = String(failureReason).toLowerCase();
    
    if (reasonLower.includes('insufficient_funds') || reasonLower.includes('insufficient funds')) {
      return 'Payment failed due to insufficient funds. Please check your card balance or use a different payment method.';
    }
    if (reasonLower.includes('expired_card') || reasonLower.includes('expired card')) {
      return 'Your card has expired. Please update your payment method with a valid card.';
    }
    if (reasonLower.includes('declined') || reasonLower.includes('card declined')) {
      return 'Your payment was declined by your bank. Please contact your bank or use a different payment method.';
    }
    if (reasonLower.includes('invalid_card') || reasonLower.includes('invalid card')) {
      return 'Invalid card information. Please check your card details and try again.';
    }
    if (reasonLower.includes('cvv') || reasonLower.includes('security code')) {
      return 'Invalid security code (CVV). Please check your card\'s security code and try again.';
    }
    if (reasonLower.includes('zip') || reasonLower.includes('postal code')) {
      return 'Invalid billing address. Please check your ZIP/postal code and try again.';
    }
    if (reasonLower.includes('limit') || reasonLower.includes('exceeded')) {
      return 'Payment limit exceeded. Please contact your bank or use a different payment method.';
    }
    if (reasonLower.includes('fraud') || reasonLower.includes('suspicious')) {
      return 'Payment flagged for security review. Please contact your bank to authorize this transaction.';
    }
  }

  // Check error message content
  if (errorLower.includes('insufficient_funds') || errorLower.includes('insufficient funds')) {
    return 'Payment failed due to insufficient funds. Please check your card balance or use a different payment method.';
  }
  if (errorLower.includes('expired_card') || errorLower.includes('expired card') || errorLower.includes('card expired')) {
    return 'Your card has expired. Please update your payment method with a valid card.';
  }
  if (errorLower.includes('declined') || errorLower.includes('card declined') || errorLower.includes('payment declined')) {
    return 'Your payment was declined by your bank. Please contact your bank or use a different payment method.';
  }
  if (errorLower.includes('invalid_card') || errorLower.includes('invalid card') || errorLower.includes('card invalid')) {
    return 'Invalid card information. Please check your card details and try again.';
  }
  if (errorLower.includes('cvv') || errorLower.includes('security code') || errorLower.includes('cvc')) {
    return 'Invalid security code (CVV). Please check your card\'s security code and try again.';
  }
  if (errorLower.includes('zip') || errorLower.includes('postal code') || errorLower.includes('billing address')) {
    return 'Invalid billing address. Please check your ZIP/postal code and try again.';
  }
  if (errorLower.includes('network') || errorLower.includes('connection')) {
    return 'Network error occurred. Please check your internet connection and try again.';
  }
  if (errorLower.includes('timeout')) {
    return 'Payment request timed out. Please try again.';
  }
  if (errorLower.includes('already captured') || errorLower.includes('already processed')) {
    return 'This payment has already been processed. Please check your billing history.';
  }
  if (errorLower.includes('plan') && errorLower.includes('not found')) {
    return 'Subscription plan not found. Please contact support for assistance.';
  }

  // Return original error if no specific match, but ensure it's user-friendly
  return error || 'Payment failed. Please try again or contact support.';
}
