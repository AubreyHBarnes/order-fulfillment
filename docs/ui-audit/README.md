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

Screens: `shopper/10-substitution-picker-empty-*`, `11-substitution-picker-results-*`, `12-arrival-modal-*` (light and dark).

| # | Severity | Finding | Evidence |
|---|---|---|---|
| 11 | Bug | Substitution picker offers the item being replaced as a substitute (searching "lettuce" while replacing Romaine Lettuce lists Romaine Lettuce first) | `11-substitution-picker-results-*.png` |
| 12 | Polish | Picker search is loose: "lettuce" also returns Lemonade and Lemons. The empty state is only a header and a search box, with no hint or suggestions | `10-*`, `11-*` |
| 13 | Polish | Arrival modal has a 60 s timeout and reassigns, but nothing on screen shows the shopper the countdown | `12-arrival-modal-*.png` |
| 14 | Bug (edge case) | Arrival modal stays up after its arrival row is deleted, until the app restarts. A cancelled or reassigned arrival could leave the same stale modal. Not tested: what Hand Off does on a deleted row | observed live 2026-11-25 |
| 1 (more) | | The white status bar in dark mode (#1) also shows behind both the picker and the arrival modal | `10-*-dark`, `12-*-dark` |

## Not yet covered

- **Order confirmation:** needs a real order placed against live Appwrite (and the auto-assignment Function would pick it up). Not done without your OK.
- **Shopper modals still to capture:** new assignment, interrupted order, urgent toast. These need orders created or reassigned on live Appwrite while the shopper app is open. (Arrival hand-off and substitution picker are done, see the third pass.)
- **Tablet layouts:** no tablet AVD exists.
- Shopper-side large-font.
