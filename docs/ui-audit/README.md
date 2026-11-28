# UI audit: light vs dark theme (2026-10-29)

Method: Android emulator (Pixel-class, 1080x2400), app in `system` theme mode, flipped with
`adb shell cmd uimode night no|yes` after navigating to each screen. Each screen is captured as
`<name>-light.png` and `<name>-dark.png`. Branch `feature/proximity-foreground` at `707bcd0`.
Both roles were driven live against the real Appwrite backend with test accounts.

## Findings (most severe first)

| # | Severity | Finding | Where | Evidence |
|---|---|---|---|---|
| 1 | Bug | Navigation header stays **white in dark mode** on every pushed screen. It also makes the status-bar clock/icons invisible (light icons on a white bar). | `src/navigation/AppNavigator.tsx:369-371` (`ShopperStack`) and `:475-477` (`MainStack`) hardcode `headerStyle.backgroundColor: '#FFFFFF'`, no theme lookup | every `*-dark.png` except `shopper/02-dashboard` |
| 2 | Contrast | Category chips in dark mode are saturated green with blue text; hard to read and off-palette | customer catalog | `customer/04-catalog-dark.png` |
| 3 | Consistency | Selected "System" segment in Appearance is green; primary elsewhere is blue | shopper settings | `shopper/06-settings-dark.png` |
| 4 | Polish | "Staff Has Been Notified" card shows a visible inner panel edge (two greens) | customer order detail | `customer/01-order-detail-top-dark.png` |
| 5 | Bug (open from earlier) | Timeline repeats `orderDate` on every step | `OrderTimeline.tsx:157,193` | `customer/01-order-detail-top-*.png` |

Not UI, noticed while testing:
- A dev-only "WebSocket error" LogBox toast (Appwrite Realtime reconnects) recurs and overlays the bottom of the screen,
  swallowing taps. Realtime itself kept working. The capture helper dismisses it before each shot.
- Seed data: Drop Offs addresses read "1Main, Austin, TX" / "2Main, ...".

## Screens captured

Shopper: `01-customer-checkins`, `02-dashboard`, `03-pick-tasks`, `04-task-detail`, `05-drop-offs`,
`06-settings`, `07-shopping-unresolved`, `08-shopping-item-found`, `09-complete-order`.
Customer: `01-order-detail-top`, `02-order-detail-bottom`, `03-my-orders`, `04-catalog`,
`05-cart-empty`, `06-cart-with-item`, `07-checkout-delivery`, `08-checkout-pickup`.

## Second pass, 2026-11-17 (customer side, pre-brand build)

Captured from the `before-brand-system` tag (`eb4d674`), light and dark, same method as above. Large-font shots use
`adb shell settings put system font_scale 1.5` set **before** launching the app (changing it while the app is open kills it).

Screens: `customer/09-search-milk`, `10-search-no-results`, `11-category-dairy`, `12-product-credit-popup`,
`13-checkout-rush-on`, `14-catalog-large-font`, `15-cart-large-font`, `16-checkout-pickup-large-font`,
`17-checkout-pickup-large-font-bottom`, `18-checkout-rush-on-large-font`, `19-login`, `20-login-empty-submit`,
`21-register`, `22-forgot-password`.

| # | Severity | Finding | Evidence |
|---|---|---|---|
| 6 | Bug | At 1.5x font the catalog category chips clip their labels vertically ("bakery", "beverages" cut off), "Add to Cart" truncates to "Add to Ca…", and "Aisle A1" truncates to "Aisle A" | `customer/14-catalog-large-font-*.png` |
| 7 | Bug | Same white-header-in-dark slab (#1) on Checkout, Reset Password and the search/no-results screen | `10-*-dark`, `13-*-dark`, `22-*-dark` |
| 8 | Bug | ForgotPassword ignores dark mode entirely (light body, dark text) | `22-forgot-password-dark.png` |
| 9 | Contrast | Native "Please fill in all fields" alert is a white box in dark mode, and the Login title behind it is near-invisible dark-on-black | `20-login-empty-submit-dark.png` |
| 10 | Consistency | **Fixed 2026-11-25 (109e13c).** "All" chip stayed checked while a search was active (now no chip is selected; clearing the search restores "All"; pull-to-refresh re-runs the search). A category tap still clears the search, by design. Verified in the emulator. | `09-search-milk-*.png`, `11-category-dairy-*.png` |

## Third pass, 2026-11-25 (shopper modals, current build)

Captured on `fix/ui-audit`. The arrival modal was triggered by inserting a test `CustomerArrivals` row for a leftover ready order via REST as the customer, then deleting it with the API key.

Screens (light and dark): `shopper/10-substitution-picker-empty-*`, `11-substitution-picker-results-*`, `12-arrival-modal-*`, `13-arrival-modal-unavailable-dark`, `14-urgent-toast-*`, `15-order-reassigned-modal-*`, `16-new-assignment-modal-*`.

The urgent toast, interrupt and new-assignment modals were triggered through the Function the way the app does it: normal orders due earlier than the shopper's current one (toast), a rush order (interrupt), then the shopper toggled unavailable/available (new assignment). The test orders were cancelled and #BB02DC98 was handed back afterwards (status is now `assigned`, not `shopping`; its picked item survived).

| # | Severity | Finding | Evidence |
|---|---|---|---|
| 11 | Bug | **Fixed 2026-11-25.** Substitution picker offered the item being replaced as a substitute (searching "lettuce" while replacing Romaine Lettuce listed Romaine Lettuce first); it is now filtered out. Verified in the emulator. | `11-substitution-picker-results-*.png` |
| 12 | Polish | **Fixed 2026-11-26.** The picker now debounces (300 ms after the last keystroke) and drops stale responses, and the empty state shows a hint ("Search for a replacement for <item>"). Not reproduced beforehand, so the race was fixed on the code path rather than confirmed; verified in the emulator that typing "lettuce" shows the spinner, then one result set, and "milk" lists Whole/Almond Milk. Original report: Picker search showed Lemonade and Lemons for "lettuce" on the first run but not on a rerun, so this is probably a stale-response race (a late result for "le" overwriting "lettuce"), not fuzzy matching. Not yet confirmed or fixed. The empty state is only a header and a search box, with no hint or suggestions | `10-*`, `11-*` |
| 13 | Polish | **Fixed 2026-11-28.** The arrival modal now shows a live countdown ("Respond within 55s or this goes to another shopper") driven by the server's `notifiedShopperAt` + 60 s, and "Time expired - reassigning..." at zero. The countdown also fires the timeout itself, since cron is unavailable on this plan (see DECISIONS.md). Verified in the emulator on the shopper side: countdown, expiry, shopper marked Unavailable. Not yet seen live: the customer-side 30 s backstop. | `12-arrival-modal-*.png` |
| 14 | Bug (edge case) | **Fixed 2026-11-25.** Arrival modal stayed up, with live buttons, after its arrival was deleted, completed or reassigned. It now switches to a "No Longer Available" notice ("This hand-off is no longer available, or the order is no longer assigned to you.") with an OK button. Also shown if Hand Off / Unavailable hits a row that no longer exists. Verified by deleting the row while the modal was up. Not tested live: the reassigned-to-someone-else path and the accept echo guard. | `13-arrival-modal-unavailable-dark.png` |
| 15 | Contrast | **Fixed 2026-11-26.** In the Order Reassigned modal the order number was amber on a white card in light mode (about 1.6:1); it now uses the on-surface text color. Re-captured and verified in light and dark. | `15-order-reassigned-modal-light.png` |
| 16 | UX gap | **Fixed 2026-11-25.** After a rush order bumped the shopper (or the order was otherwise released or cancelled), the Shopping screen stayed open on the order and kept listing its items. Server writes were already safe (the Function returns 403 "This order is not assigned to you"), so it was confusing rather than corrupting. `ShoppingScreen` now watches its own order (realtime plus a re-check on app resume): a rush bump sends the shopper to the dashboard, where Order Reassigned already explains; any other loss shows a "No Longer Assigned to You" notice with a Back to Home button. Verified both paths live. | `17-order-no-longer-assigned-dark.png` |
| 17 | Bug (edge case) | **Fixed 2026-11-26** (chose to show the same accept/decline modal): the check now runs on any change to a different order, not just no-order to order; a rush interrupt still shows only Order Reassigned, so the two don't stack. Verified live: a non-interrupt A to B swap raises New Order Assigned, and a rush bump still shows only Order Reassigned. Original report: The New Order Assigned modal only fires if the app sees the shopper go from *no order* to an order. If an order is swapped for another auto-assigned one while the app is backgrounded or the socket is down (one reconcile sees order A, the next sees order B), a non-interrupt swap shows nothing. It took a background/foreground reconcile to show any of the three live modals, because the realtime socket dropped in the emulator | `ShopperAssignmentContext.tsx` `fetchAndReconcile`; reproduced 2026-11-25 |
| 1 (more) | | The white status bar in dark mode (#1) also shows behind both the picker and the arrival modal | `10-*-dark`, `12-*-dark` |

## Not yet covered

- **Order confirmation:** needs a real order placed against live Appwrite (and the auto-assignment Function would pick it up). Not done without your OK.
- **Tablet layouts:** no tablet AVD exists.
- Shopper-side large-font.
