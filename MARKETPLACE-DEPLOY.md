# Launchory marketplace build and release

## Implemented
- Supabase project nsilgdncjaxwlqioiizk (US West) with profiles, projects, proposals, messages, payments, row-level security, signup trigger, and single-accepted-proposal constraint.
- Two-sided marketplace UI at /marketplace.html: accounts, portfolios, creative search, projects, proposals, messaging, payouts, and transaction records.
- Vercel APIs for Stripe Connect onboarding, hosted Checkout, automatic paid invoices, signed webhooks, founder-approved separate charges/transfers with 7% Launchory fee.

## Required before payments can work
In the Vercel Launchory project **Preview** environment, enter these as secrets via Vercel's settings (never paste them into chat or commit them):
1. SUPABASE_SERVICE_ROLE_KEY: server-only key from Supabase's API Keys settings.
2. STRIPE_SECRET_KEY: Stripe test-mode key.
3. STRIPE_WEBHOOK_SECRET: signing secret for the preview webhook destination.

Already configured in preview: SUPABASE_URL, SUPABASE_ANON_KEY (public publishable key), SITE_URL.

Stripe test-mode webhook URL: https://<preview-hostname>/api/webhook. Subscribe to checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, charge.refunded, charge.dispute.created.

In Supabase Auth URL Configuration, allow the Vercel preview and joinlaunchory.com redirect URLs; configure email templates, deliverability, CAPTCHA, and password recovery.

## Mandatory acceptance tests
- Founder and creative signup, confirmation, profile and password recovery.
- Search, filters, project postings, role restrictions, proposals, single acceptance, private messaging and RLS isolation.
- Stripe Express onboarding, test Checkout, invoice, webhook payment status, 7% accounting and founder-authorized release.
- Test expired checkout recovery, chargebacks, refunds before/after transfer, webhook retries and support reconciliation.
- Add public terms, refund and dispute policies, moderation/reporting, actual verification workflow, reviews, notification preferences, media uploads and accessibility tests before claiming five-star/full public readiness.
- Confirm international payments, tax reporting and Stripe fees, with appropriate legal/compliance review. Stripe Connect does not create general-purpose escrow.

Do not merge the preview branch or switch production payment credentials until these checks pass and the user explicitly approves release. Current production and waitlist must be preserved.
