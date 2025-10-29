## Tracking Events – Postman Reference

Use this guide to replay the three tracking events our stack emits: `link.click`, `signup.created`, and `subscription.updated`. Examples assume the Next.js app is running locally on `http://localhost:3000` and that your tracking collector lives at `https://tracking.dev/api`.

---

### Common Setup

| Variable      | Example Value             | Purpose                                                                |
|---------------|---------------------------|------------------------------------------------------------------------|
| `baseUrl`     | `http://localhost:3000`   | Next.js instance.                                                       |
| `trackingUrl` | `https://tracking.dev/api`| External collector (only needed for `link.click` & backend mocks).      |
| `meyoo_ref`   | `growth-slug-42`          | Referral slug; the web route refuses to fire without this cookie.       |

Add this header to every `/api/v1/tracking` request:

```
Cookie: meyoo_ref={{meyoo_ref}}
```

Sign in through the browser (or copy your authenticated cookies) before hitting the authenticated routes.

---

### 1. Link Click (middleware)

This event is sent directly from the Next.js middleware whenever a referral slug is detected. To simulate it manually, hit the downstream collector:

```
POST {{trackingUrl}}
Headers:
  Content-Type: application/json
Body (raw JSON):
{
  "type": "link.click",
  "eventType": "link.click",
  "ref": "{{meyoo_ref}}",
  "slug": "{{meyoo_ref}}",
  "path": "/?ref={{meyoo_ref}}",
  "source": "https://partner.example.com",
  "timestamp": {{now}}
}
```

> Tip: use a pre-request script (`pm.variables.set("now", Date.now());`) to populate the timestamp automatically.

---

### 2. Signup Created (Onboarding – Shopify step)

```
POST {{baseUrl}}/api/v1/tracking
Headers:
  Content-Type: application/json
  Cookie: meyoo_ref={{meyoo_ref}}
Body (raw JSON):
{
  "type": "signup.created",
  "context": "onboarding_shopify"
}
```

**Server-enriched fields**

| Field              | Example                   | Notes                                                |
|--------------------|---------------------------|------------------------------------------------------|
| `customerId`       | `us_1abc…`                | Convex user ID (always included).                    |
| `email`            | `founder@store.com`       | User email if available.                             |
| `plan` / `planKey` | "Free Plan" / "free"     | Defaults to Free until billing activates.            |
| `ref` / `slug`     | `growth-slug-42`          | Referral slug (cookie or onboarding metadata).       |
| `billingCycle`     | `"monthly"`              | From the billing record (may be `null` if absent).   |
| `metadata`         | Current onboarding step snapshot. | Useful for funnel debugging.               |

Skip reasons you might see: `missing_referral_cookie`, `already_subscribed`.

---

### 3. Subscription Updated (Onboarding – Marketing step)

Trigger this once the user has completed billing and lands on the marketing integrations step.

```
POST {{baseUrl}}/api/v1/tracking
Headers:
  Content-Type: application/json
  Cookie: meyoo_ref={{meyoo_ref}}
Body (raw JSON):
{
  "type": "subscription.updated",
  "context": "onboarding_marketing"
}
```

**Additional fields**

| Field        | Example                                          |
|--------------|--------------------------------------------------|
| `billingId`  | `gid://shopify/AppSubscription/1234567890`       |
| `plan`       | "Starter Plan"                                  |
| `metadata.subscriptionStatus` | "ACTIVE"                       |

Skip reasons here: `missing_referral_cookie`, `subscription_not_active` (if billing hasn’t processed yet).

---

### 4. Subscription Updated (Convex backend mock)

Convex fires the same `subscription.updated` event whenever Shopify webhooks arrive. To mimic the backend payload directly:

```
POST {{trackingUrl}}
Headers:
  Content-Type: application/json
Body (raw JSON):
{
  "type": "subscription.updated",
  "eventType": "subscription.updated",
  "source": "convex:organizationBilling",
  "customerId": "us_1abc…",
  "email": "founder@store.com",
  "organizationId": "org_1xyz…",
  "plan": "Growth Plan",
  "planKey": "growth",
  "billingCycle": "monthly",
  "billingId": "gid://shopify/AppSubscription/1234567890",
  "ref": "growth-slug-42",
  "slug": "growth-slug-42",
  "metadata": {
    "subscriptionStatus": "ACTIVE",
    "isUpgrade": true,
    "becamePaid": true,
    "previousPlan": "Free Plan"
  },
  "timestamp": {{now}}
}
```

Feel free to tweak `subscriptionStatus`, `isUpgrade`, or `previousPlan` to cover edge cases (downgrades, cancellations, paused states, etc.).

---

### Handy Snippets

```javascript
// Pre-request Script
pm.variables.set("now", Date.now());
```

Duplicate the signup request and just change `type`/`context` to hop between scenarios quickly.

---

That’s it—three payload templates and you can mirror every event that flows through production. Copy, tweak, send, repeat. 🚀
