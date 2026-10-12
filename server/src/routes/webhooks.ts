import { Hono } from 'hono';
import { webhookService } from '../services/billing/webhookService.js';
import { logger } from '../lib/logger.js';

export const webhooksRouter = new Hono();

webhooksRouter.post('/webhooks/:provider', async (c) => {
  const provider = c.req.param('provider');

  // Read raw text body BEFORE any JSON parsing (Rule 01, Rule 02)
  const rawBody = await c.req.raw.text();

  // Paystack uses x-paystack-signature; fallback to x-webhook-signature
  const signature =
    c.req.header('x-paystack-signature') ||
    c.req.header('x-webhook-signature') ||
    c.req.header('X-Paystack-Signature');

  const result = await webhookService.handleWebhook(provider, rawBody, signature);

  // Return 200 immediately for both processed and duplicate webhooks (Rule 02)
  return c.json({ status: 'ok', eventId: result.eventId }, 200);
});
