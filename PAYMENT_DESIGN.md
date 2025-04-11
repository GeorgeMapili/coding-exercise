# Technical Design: Per-User Monthly Subscriptions with Stripe

**1. Introduction**

This document outlines the technical design for implementing a per-user monthly subscription payment system. The goal is
to enable users to subscribe to a service on a recurring monthly basis, granting them access based on their payment
status.

**2. Problem Statement**

The application currently lacks a payment processing mechanism. We need to introduce a system that allows users to
subscribe to a monthly plan, integrates with a reliable payment provider, manages subscription statuses, and controls
user access based on those statuses.

**3. Proposed Implementation**

We propose using Stripe as the payment gateway due to its robust features, developer-friendly APIs, extensive
documentation, and built-in support for recurring subscriptions.

**3.1. Payment Provider: Stripe**

- **Why Stripe?**
  - **Subscription Management:** Stripe Billing offers comprehensive tools for creating and managing subscription plans,
    handling recurring payments, prorations, and lifecycle events.
  - **Security:** Stripe handles PCI compliance, reducing our security burden. Sensitive card details are tokenized and
    managed by Stripe, never directly touching our servers.
  - **Developer Experience:** Well-documented APIs (REST, client-side libraries like Stripe.js/Elements), webhooks for
    real-time event handling, and a testing environment (Test Mode).
  - **Integration:** Integrates easily with various backend languages and frameworks.
  - **Checkout/Payment Links:** Offers pre-built, customizable checkout pages (Stripe Checkout) or embeddable UI
    components (Stripe Elements) for a seamless user experience.

**3.2. High-Level Payment Flow**

1.  **User Initiates Subscription:**
    - The user selects a subscription plan within the application UI.
    - The client-side application makes a request to our backend server to create a checkout session.
2.  **Backend Creates Stripe Session:**
    - The backend receives the request, identifies the user and the selected plan.
    - It uses the Stripe API to create a `Customer` object in Stripe if one doesn't exist for the user, linking it to
      our internal user ID (e.g., via metadata).
    - It then creates a Stripe `Checkout Session` configured for the specific subscription plan and customer. This
      session includes success and cancellation URLs pointing back to our application.
    - The backend returns the `Checkout Session ID` to the client.
3.  **Client Redirects to Stripe Checkout:**
    - The client-side application uses the `Session ID` and Stripe.js to redirect the user to the Stripe-hosted checkout
      page.
4.  **User Completes Payment:**
    - The user enters their payment details securely on the Stripe Checkout page.
    - Stripe processes the payment.
5.  **Stripe Redirects & Sends Webhooks:**
    - **Redirect:** Upon successful payment (or cancellation), Stripe redirects the user back to the `success_url` (or
      `cancel_url`) specified during session creation. The success page should inform the user their subscription is
      active but _not_ grant access solely based on this redirect (as it can be faked).
    - **Webhook:** Stripe sends asynchronous events (webhooks) to a predefined endpoint on our backend server for
      critical events like `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.updated`,
      `customer.subscription.deleted`, etc. This is the _source of truth_ for subscription status.
6.  **Backend Handles Webhooks:**
    - Our backend listens for and verifies incoming Stripe webhooks using the webhook signing secret.
    - Based on the event type (e.g., `invoice.payment_succeeded`), the backend updates the user's subscription status,
      plan details, and next billing date in our database.
7.  **Access Granted:**
    - The application logic checks the user's subscription status in our database to grant or deny access to protected
      features.

**3.3. Subscription Management Strategy**

- **Database Schema:** We need to extend our user data model or create a dedicated `subscriptions` table. Key fields
  would include:
  - `user_id` (Foreign key to users table)
  - `stripe_customer_id` (String, nullable)
  - `stripe_subscription_id` (String, unique, nullable)
  - `plan_id` (String or Enum representing the subscribed plan)
  - `status` (Enum: e.g., `active`, `inactive`, `past_due`, `canceled`)
  - `current_period_end` (Timestamp: When the current paid period ends)
  - `cancel_at_period_end` (Boolean: Indicates if cancellation is requested)
  - `created_at`, `updated_at`
- **Stripe as Source of Truth:** While our DB stores the current _interpreted_ state for quick access checks, Stripe
  remains the ultimate source of truth for billing details and subscription lifecycle. Webhooks are crucial for keeping
  our DB synchronized.
- **Stripe Customer Portal:** Consider integrating the Stripe Customer Portal. This allows users to self-manage their
  subscription (update payment methods, cancel, view invoices) directly through a Stripe-hosted interface, reducing our
  development and support load. This requires passing the `stripe_customer_id` when creating the portal session.

**3.4. Access Control**

- **Middleware/Decorators:** Implement middleware (in web frameworks) or decorators/guards that check the user's
  subscription `status` and potentially `current_period_end` from our database before allowing access to protected
  routes or features.
- **Status Check:** The primary check should be against the `status` field in our database (e.g., `status == 'active'`).
- **Granularity:** Access control can be applied at the route level, feature level, or based on specific plan tiers if
  multiple plans are introduced later.

**3.5. Handling Subscription Lifecycle Events (via Webhooks)**

Our webhook handler endpoint needs to securely process various Stripe events:

- `checkout.session.completed`: Often the first indication a subscription might be starting. We retrieve the
  `subscription_id` and `customer_id` from the session object and store them in our DB, potentially setting an initial
  `active` status (though `invoice.payment_succeeded` is often preferred for activation).
- `invoice.payment_succeeded`: Confirms a recurring payment was successful. Update `status` to `active` and set
  `current_period_end` based on the invoice data.
- `invoice.payment_failed`: A payment failed. Update `status` to `past_due` (or `inactive` depending on Stripe retry
  settings and grace period configuration). Initiate dunning process if configured in Stripe. Access might be revoked
  immediately or after a grace period.
- `customer.subscription.updated`: Handles changes like upgrades, downgrades, or cancellations initiated via the Stripe
  dashboard or Customer Portal. Update `plan_id`, `status`, `current_period_end`, and `cancel_at_period_end` in our DB
  accordingly.
- `customer.subscription.deleted`: The subscription has ended (either cancelled immediately or at period end after
  `cancel_at_period_end` was true). Update `status` to `inactive` or `canceled`. Revoke access.

**Webhook Security:**

- **Verification:** ALWAYS verify webhook signatures using your Stripe webhook signing secret to ensure requests
  genuinely come from Stripe.
- **Idempotency:** Design webhook handlers to be idempotent. Network issues might cause Stripe to retry sending the same
  event. Check if the event has already been processed (e.g., by storing and checking Stripe Event IDs) before
  performing database updates.
- **Endpoint Security:** Protect the webhook endpoint from unauthorized access.

**4. Conclusion**

This design leverages Stripe for handling the complexities of payment processing and subscription management, allowing
us to focus on core application features. Key elements are the secure handling of the payment flow via Stripe Checkout,
robust subscription state management synchronized via webhooks, and clear access control logic based on the user's
subscription status stored in our database.
