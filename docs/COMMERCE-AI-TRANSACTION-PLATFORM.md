# NEXOVONARSA CORPORATION — Commerce, AI & Transaction Platform

**Project ID:** NXC-COMMERCE-2026-001  
**Owner:** PT. NEXOVONARSA CORPORATION  
**Status:** PLANNED — implementation requires backend and payment-provider configuration  
**Planning period:** 2026–2030

## Goal

Define a secure, production-oriented commerce layer for corporate and business-unit services. The existing Corporate Project Control Center is a static dashboard; it must not pretend to process payments or expose secret credentials in browser code.

## User and project identity

- Generate an immutable internal user_id after server-side account creation (UUID/ULID).
- Generate a separate project_id for each managed project and a unique transaction_id for every checkout attempt.
- Store identity and access data server-side. Never use a client-provided ID as proof of identity.
- Support account profile, order history, and audit events with least-privilege access.

## Checkout lifecycle

1. User adds products/services to a cart and changes quantities.
2. Server reloads authoritative prices, checks stock/availability, calculates applicable fees, and creates an order.
3. Server creates a payment session with a licensed QRIS-capable payment provider.
4. Set payment expiry to at least 10 minutes; recommended default is 15 minutes, subject to provider support.
5. Display provider-generated QRIS, amount, transaction ID, expiry countdown, and PENDING status.
6. Mark an order PAID only after verifying the provider's signed webhook/callback and matching transaction, amount, currency, and order reference.
7. Expire unpaid orders server-side and reject late payment attempts according to provider rules.
8. Notify the customer and operators through an approved WhatsApp Business API integration after relevant order/payment state changes.

Never trust a browser button, screenshot, or user-submitted message as payment proof. Do not store payment credentials or provider secrets in frontend files.

## Suggested transaction states

CART → PENDING_PAYMENT → PAID
PENDING_PAYMENT → EXPIRED | CANCELLED | FAILED
PAID → REFUND_PENDING → REFUNDED (only when refund support is implemented)

Every transition should be validated server-side and written to an append-only audit log. Webhooks must be authenticated and idempotent.

## AI assistant

- Provide an assistant for product/service discovery, FAQ, and help with order status.
- Retrieve order details only after server-side authentication and authorization.
- Treat model output as advisory; do not let AI approve payments, alter prices, issue refunds, or access secrets.
- Add rate limits, input/output validation, abuse monitoring, and a fallback when the AI provider is unavailable.

## Real-time updates

Use provider webhooks as the source of truth for payments. Send verified state changes to the UI using Server-Sent Events, WebSockets, or short polling. Existing GitHub metadata sync is near-real-time repository monitoring, not a payment-status source.

## Required integrations and secrets

Configure these in the hosting provider's encrypted environment/secret store, never in committed files:

- Database URL and server-side service credentials
- Authentication provider settings
- QRIS payment provider API credentials and webhook signing secret
- WhatsApp Business API token, phone-number ID, and approved message templates
- AI provider API key, model selection, usage limits, and safety settings
- Public application URL and allowed-origin configuration

Do not enable production checkout until a real payment provider account, webhook endpoint, and end-to-end test transaction are configured.

## Minimum data model

- users: user_id, auth subject, display name, created/updated timestamps
- projects: project_id, owner, name, status, timestamps
- products: product/service ID, title, active flag, server-side price, currency
- orders: order ID, user ID, immutable item/price snapshot, totals, status, expiry
- transactions: transaction ID, order ID, provider reference, amount, status, expiry
- webhook_events: provider event ID, verified flag, processing result, received timestamp
- notifications: recipient, channel, template, delivery status, timestamps
- audit_events: actor, action, entity ID, timestamp, minimal metadata

## Delivery gates

- [ ] Confirm products, prices, currencies, and business-unit ownership.
- [ ] Select a QRIS provider and complete sandbox onboarding.
- [ ] Implement database schema, migrations, and server-side authorization.
- [ ] Implement cart and checkout UI with accessible responsive components.
- [ ] Implement payment-session creation, signed webhook verification, idempotency, and expiry worker.
- [ ] Implement WhatsApp Business notification integration with retry and delivery logs.
- [ ] Implement AI assistant with authorization, rate limits, and usage controls.
- [ ] Add unit, integration, security, and browser tests.
- [ ] Run sandbox end-to-end payment tests including expiry, duplicate webhooks, amount mismatch, and provider outage.
- [ ] Capture actual desktop and mobile screenshots from a running build.
- [ ] Configure production secrets and monitoring before enabling live payments.

## Current implementation boundary

This document records the technical direction. It does not claim that QRIS payments, WhatsApp delivery, AI API calls, or production real-time transaction processing are active. Those require a server-side application, provider accounts, secrets, and end-to-end validation.