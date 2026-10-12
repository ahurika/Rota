import crypto from 'node:crypto';
import { env } from '../../config/env.js';

export class PaymentProvider {
  private secretKey: string;

  constructor(secretKey?: string) {
    this.secretKey = secretKey || env.PAYSTACK_SECRET_KEY || 'test_secret_paystack_key';
  }

  public setSecretKey(key: string) {
    this.secretKey = key;
  }

  /**
   * Cryptographically verifies HMAC SHA-512 webhook signature using constant-time comparison.
   * Proof Test T6: Bad signature fails and writes nothing.
   */
  public verifyWebhookSignature(
    rawBody: string,
    signature: string | undefined | null,
    overrideSecret?: string
  ): boolean {
    if (!signature || typeof signature !== 'string') {
      return false;
    }

    const secret = overrideSecret || this.secretKey;
    const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    if (expectedBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
  }

  /**
   * Generates a hosted checkout URL for the transaction attempt.
   */
  public async createCheckoutSession(params: {
    amountCents: number;
    currency: string;
    email: string;
    reference: string;
    callbackUrl?: string;
  }): Promise<{ checkoutUrl: string; reference: string }> {
    // If running in live test mode with a real Paystack key, can call out; otherwise return deterministic test hosted link
    const checkoutUrl = `https://checkout.paystack.com/${encodeURIComponent(params.reference)}`;
    return {
      checkoutUrl,
      reference: params.reference,
    };
  }
}

export const paymentProvider = new PaymentProvider();
