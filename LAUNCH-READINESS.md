# Launchory launch readiness — 2026-11-09

## Deployed preview
- Vercel project: `launchory`
- Branch: `launchory-marketplace-preview`
- Preview: https://launchory-git-launchory-marke-b9c3be-kennedyowen-7300s-projects.vercel.app/marketplace.html
- Production `joinlaunchory.com` waitlist remains unchanged.

## Built and connected
- Supabase US West project `nsilgdncjaxwlqioiizk`
- Founder/creative signup flow and auth-based profiles
- Creator discovery by specialty, skills, availability, starting price, and portfolio
- Founder project briefs, edit/cancel before hiring, invitation to specific creatives
- Proposals, founder acceptance, automated move from open -> in_progress, messaging
- Portfolio pieces, reviews restricted to founders of paid completed projects
- Stripe Connect Express onboarding code, hosted Checkout, 7% fee, invoice generation,
  webhook validation, founder-approved separate charges and transfers, idempotent checkout retries
- In-app realtime subscription for new proposals, invitations and messages
- Payment readiness indicator disables transactions while server configuration is absent

## Verified with direct database integration tests (all test records rolled back)
- Auth signup trigger creates a creative profile
- Real founder role can post, edit and cancel an open project
- Fake/unauthorized account cannot post without an eligible founder profile
- Founder posts -> invites creative -> creative proposes/messages -> founder accepts/replies
- Accepted proposals automatically close their project to additional applicants
- Reviews insert only after a simulated transferred payment and completed project
- Unrelated authenticated account cannot view a private proposal or conversation
- Authenticated clients cannot read `profiles.stripe_account_id`
- Source JavaScript parses; Vercel latest preview build reached READY
- No test projects, proposals or reviews left in production database

## Not verified / required before external launch
1. Configure Supabase Auth > URL Configuration. Add the preview hostname and eventual
   `https://joinlaunchory.com/marketplace.html` to allowed redirects. Confirm email templates
   and SMTP delivery. Turn on leaked-password protection.
2. In Vercel **Preview** environment add secret values:
   - `SUPABASE_SERVICE_ROLE_KEY` (Supabase service-role/secret key, server side only)
   - `STRIPE_SECRET_KEY` (Stripe *test-mode* secret key)
   - `STRIPE_WEBHOOK_SECRET` (signing secret of test webhook destination)
   Never commit or paste these values into a chat.
3. In Stripe test mode configure webhook destination
   `https://launchory-git-launchory-marke-b9c3be-kennedyowen-7300s-projects.vercel.app/api/webhook`.
   Subscribe to checkout.session.completed, checkout.session.async_payment_succeeded,
   checkout.session.async_payment_failed, charge.refunded, charge.dispute.created.
4. Verify with two separate *actual browser sessions* that email signup and confirmation,
   project creation, editable profiles, invitations, proposals and messages work.
5. Test actual Stripe Express onboarding and test Checkout, webhook processing,
   paid invoice, successful transfer, failed transfer retry, expired session resume.
6. Build and test operational refund/dispute/chargeback handling, transfer reversals,
   admin moderation and member reporting. Financial/legal policies and Stripe fee liability
   must be reviewed before taking live money. Connect is not escrow.
7. Final review for performance, accessibility, abuse controls, email notifications and privacy.
8. Set production-only secrets, production Stripe webhook and production auth redirects only
   after testing, then merge the branch to main on explicit launch approval.

**Status:** working prelaunch marketplace preview. It is not yet verified end-to-end or
authorized to take live payments. A green Vercel build does not prove browser flows.
