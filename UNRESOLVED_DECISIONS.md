# Critical Unresolved Decisions

Before proceeding with substantial implementation, the following decisions need to be confirmed or clarified:

## 1. Fulfillment Model
- **Current Assumption**: Initial version assumes vintajoriginal manages orders and inventory internally (administrator manually processes orders, prepares packages, arranges delivery, updates fulfillment statuses).
- **Decision Needed**: Confirm this assumption is correct, or specify if there are any existing fulfillment processes or preferences (e.g., third-party logistics interest).

## 2. Shipping Provider
- **Current Status**: Initial delivery market is Azerbaijan only. No carrier selected; manual tracking entry remains the working assumption.
- **Decision Needed**: 
  - Confirm if we should proceed with a flexible shipping interface (manual tracking number entry) for initial version.
  - Any known preferences or constraints regarding shipping providers?
  - Should we integrate with any specific provider's API in Phase 1, or defer to later?

## 3. Payment Gateway
- **Current Status**: Stripe selected as the preferred provider. The user has an existing Stripe account with account country Germany. AZN is intended as the checkout currency; confirm the account's live payment and payout settings before launch.
- **Remaining Checks**: Verify that the existing German Stripe account is active for live payments and its payout setup is appropriate for this seller. Keep checkout in test mode until verified.

## 4. Initial Inventory Scale
- **Current Status**: Final SKU count not confirmed; optimized for small catalog that can grow.
- **Decision Needed**: 
  - Approximate expected number of products at launch? (e.g., <100, 100-500, 500-1000+)
  - Expected growth rate? (Helps inform caching/pagination decisions)

## 5. Existing Assets
- **Current Status**: Project directory is empty; no reusable code/assets found.
- **Decision Needed**:
  - Confirm if there are any existing assets elsewhere (domain, logo, product photography, branding files) that we should be aware of or incorporate.
  - Do you have a registered domain in mind for development/testing?

## 6. Administrator Roles & Permissions
- **Current Plan**: Start with single administrator role; authorization designed to support additional roles later.
- **Decision Needed**:
  - Confirm if the initial admin should have full access (products, orders, refunds, users, settings) or if any restrictions are desired initially.
  - Any specific permission granularity needed (e.g., separate roles for content vs. order management)?

## 7. Session Management Approach
- **Current Recommendation**: Prefer secure server-managed sessions using HttpOnly, Secure, SameSite cookies (over JWT for simplicity and security).
- **Decision Needed**:
  - Confirm approval of server-managed session approach.
  - Any preference for JWT or alternative authentication method?

## 8. Design Concept Approval
- **Current Status**: Provided design system description and representative page layouts in text (DESIGN_SYSTEM.md).
- **Decision Needed**:
  - Is the textual design system description sufficient for approval to proceed with implementation?
  - If not, what specific visual mockups or additional details are needed?

## 9. Legal/Policy Page Content
- **Current Status**: Placeholder pages included for shipping info, return/refund policy, privacy, terms.
- **Decision Needed**:
  - Do you have the final content for these pages, or should we develop with clear placeholders to be replaced later?
  - Any specific legal requirements for Azerbaijan e-commerce we should be aware of?
- Seller reports that no Azerbaijan VÖEN is currently available; confirm applicable tax/business registration obligations and Stripe merchant eligibility before live sales.

## 10. Optional Features (Post-Launch Consideration)
- **Current Plan**: Core features prioritized; optional features (wishlist, size guide, product reviews, discount codes, order tracking, email notifications) noted as separate modules.
- **Decision Needed**:
  - Confirm approval to defer optional features to post-launch phases.
  - Any of these considered essential for initial launch?

## 11. Development Environment & Deployment
- **Current Status**: To be determined.
- **Decision Needed**:
  - Preferred development environment (local, specific IDE)?
  - Hosting preferences for production (local Azerbaijani provider, cloud service)?
  - Any CI/CD or deployment process preferences?

---
*Bu qərarların clarificationı, verdiyi təminatlara uyğun bir loyiha təminatı üçün əhəmiyyətlidir.*
