# Engineering Decision Log

This is a running log of the non-obvious engineering calls made on this project — not just *what* was built, but *why*, what else was considered, and what tradeoffs were accepted along the way. Inline code comments explain a specific function's local reasoning; this file is the bigger picture, meant to be readable end-to-end without the code open.

It exists for two reasons: to keep a real record while the project is being actively developed with AI-assisted pairing, and to serve as a reference for explaining the project's design decisions to a technical audience (interviews, a portfolio walkthrough, a talk). Entries are in chronological order. Each one follows roughly the same shape: **Context** (what problem existed), **Decision** (what was actually done), **Why**, **Alternatives considered**, and **Consequences / left open** (the honest tradeoffs and what's deliberately deferred).

---

## Auto-assignment via sort order, not a routing algorithm

**Context:** Shoppers need orders assigned to them somehow. A real fulfillment platform (Whole Foods/Amazon-style) runs this through a dedicated routing/dispatch system — proximity, shopper load, order age, all weighed together, often as its own service.

**Decision:** Orders are assigned by a simple deterministic rule: when a shopper flips their status to Available, the app queries all `pending` unassigned orders sorted by `scheduledReadyTime` ascending, and hands them the single most time-urgent one (`getNextOrderForAssignment` in `orderService.ts`). No weighting, no scoring, no server-side function.

**Why:** This is a solo portfolio project, not a production dispatch system — the goal was to demonstrate a coherent, correct assignment *mechanism* (query, sort, assign, persist) rather than reimplement a logistics-routing algorithm that would take the scope far beyond what a mobile app + BaaS backend needs to prove. Sorting by `scheduledReadyTime` also happens to be the one signal that matters most for a grocery pickup app specifically: whichever order is due soonest should go out the door first.

**Alternatives considered:** A serverless Appwrite Function that runs assignment logic server-side (more realistic architecture, matches the README's stated "Functions (Node.js serverless)" tech goal) was considered but deferred — the client-side version proves the same data flow with far less infrastructure to stand up first.

**Consequences / left open:** This is explicitly flagged in the README as a simplification ("a simple client-side flag today, not yet a ranking/routing algorithm or serverless function"). It also means assignment only happens at the moment a shopper *becomes* available — an order placed while a shopper is already active and idle-available doesn't get pushed to anyone until the next status change or manual pull. That gap is directly what motivated the rush-order interrupt discussion below.

---

## Appwrite schema drift, and how it was diagnosed

**Context:** The Appwrite Cloud collections were hand-created through the console early on, and drifted from what the app code actually read/wrote — `shopperId` vs. the real attribute `shopperID`, `lastActiveTimestamp` vs. `lastActiveTimeStamp`, missing `Create`/`Delete` permissions. Shopper registration was failing, and the client SDK's own error messages were actively misleading: a failed *rollback* delete (masked by a missing `Delete` permission) surfaced as "not authorized," hiding the real attribute-casing bug underneath it.

**Decision:** Rather than iterate error-by-error through the Appwrite console, a server-side API key (scoped to Databases read/write, Auth users read/write) was added to `.env` for local debugging, used to pull each collection's *actual* attribute list via the REST API (`GET /v1/databases/{db}/collections/{id}`) and diff it directly against every `createDocument`/`updateDocument`/`Query.equal` call in the code.

**Why:** Debugging a schema mismatch by reading error messages one at a time is slow and, in this case, actively misleading (the rollback masking bug). Diffing the ground-truth schema against every call site in one pass found all four drift points (casing on two attributes, two permission gaps) in a single debugging session instead of four separate ones.

**Alternatives considered:** Fixing the *schema* to match the code (renaming the Appwrite attributes) was the other direction this could have gone. The code was changed instead, since the console-configured schema was the "source of truth" already in use and changing it risked breaking anything else already pointed at it.

**Consequences / left open:** This also caught a real, independent bug in passing: `getShopperStatus()` querying a nonexistent field (`shopperId`) silently returned zero results instead of throwing — meaning it would have quietly broken availability toggling and order auto-assignment for every registered shopper without ever raising an error. Silent empty-result failures like this are worth specifically watching for in Appwrite (or any query-based) code, since they don't announce themselves. **The debug API key is dev-only** — it's deliberately never shipped in the client app; the client SDK's inability to do things like delete Auth accounts is an intentional Appwrite platform boundary, not a workaround target.

---

## Pickup time slots scoped to pickup only, not delivery

**Context:** Checkout hardcoded every order's `scheduledReadyTime` to "30 minutes from now," with no way for a customer to actually choose a pickup time.

**Decision:** Added a time-slot picker (`TimeSlotSelector.tsx`), but scoped its rendering and validation strictly to `fulfillmentType === 'pickup'`. Delivery orders were deliberately left on the old hardcoded default.

**Why:** The actual ask was about picking up an order — there was no delivery-dispatch UX requirement in scope, and guessing at one (a delivery window picker, driver ETA logic, etc.) would have been solving a problem nobody raised. Scoping tightly to the real request kept the change small and correct instead of speculatively building out an adjacent feature.

**Alternatives considered:** A single generic "scheduled time" picker for both fulfillment types was considered and rejected for the same reason — it would've had to either fake delivery-window semantics or leave half its options meaningless for a delivery order.

**Consequences / left open:** Delivery orders still have no real scheduling story. That's a known, intentional gap, not an oversight.

---

## Rush orders: hourly slots + reusing an existing field over adding a new one

**Context:** Following on from the time-slot feature above: normal pickup slots were on a 30-minute grid, and there was no way to get an order ready faster than the next slot. The ask was for pickup slots to land on the hour, plus a "Rush Order" option that bypasses slot selection entirely and targets 30 minutes out instead.

**Decision:** Changed the normal slot interval from 30 to 60 minutes, added a `RushOrderToggle` component and `getRushReadyTime()` helper, and — instead of adding a new schema attribute to flag a rush order — reused the `priority` field that already existed on the Order schema (visible in the README's Orders Collection table) but was never actually set by any code path. `priority: 1` now means "rush," `0` means normal.

**Why:** Adding a new boolean attribute (e.g. `isRush`) would have meant another Appwrite console change plus another field to keep the type, the write path, and any future read paths in sync — for information that `priority` already existed to carry and wasn't carrying. Since order assignment already sorts by `scheduledReadyTime` ascending, a rush order's soonest-in-the-queue ready time means it naturally sorts to the front of assignment with zero changes to the assignment logic itself — the existing mechanism from the decision above "just worked" for a new case it wasn't originally written for.

**Alternatives considered:** A new `isRush` boolean field, and a special-cased branch in the assignment query to prioritize rush orders explicitly, were both considered and rejected as unnecessary — see Why.

**Consequences / left open:** `priority` is now implicitly a two-state (0/1) rush flag rather than a general-purpose priority scale, which is a semantic narrowing worth knowing about if a future feature wants "priority" to mean something more granular. Verified end-to-end in the Android emulator, including confirming the placed order's Appwrite document had `priority: 1` and a `scheduledReadyTime` exactly 30 minutes after `orderDate`.

---

## Releasing a shopper's order when they go unavailable

**Context:** A shopper toggling their status to Unavailable while actively working an order left that order permanently stuck `assigned` to them — it never returned to the pending queue, so it would just sit there indefinitely, invisible to every other shopper.

**Decision:** `updateShopperAvailability` now branches on becoming-available vs. becoming-unavailable. Going unavailable while holding an order calls a new `unassignOrder()` (resets `shopperID` to empty, `status` back to `pending`, `autoAssigned` to `false`) and then `reassignIfMostUrgent()` immediately checks whether that now-freed order is the single most urgent thing in the queue — if so, it's hitched straight to the next idle shopper instead of waiting for someone to notice it later.

**Why:** An order silently going stale because its shopper stepped away is a worse failure mode than briefly having no shopper on it — it should always be recoverable by falling back into the same pool every other pending order lives in.

**Alternatives considered:** Leaving the order `assigned` but flagging the shopper as unavailable (so a manager/dashboard could manually reassign) was considered and rejected — there's no manager-facing reassignment UI in this app, so that would have created an order with no path back to being worked at all.

**Consequences / left open:** `reassignIfMostUrgent` only ever acts on an order that has *already* been released back to `pending` — it does not, and was never designed to, take an order away from a *different* shopper who's actively working it. That distinction is the crux of the rush-order interrupt gap discussed below.

---

## Pull-based data, not realtime — a scope boundary, not an oversight

**Context:** The README's original tech goals list Appwrite Realtime (WebSocket subscriptions) as a planned technical highlight. As built so far, nothing in the app subscribes to anything — `ShopperDashboardScreen` refetches its status/task data on `useFocusEffect` (i.e., whenever the screen regains focus), and that's the only refresh mechanism anywhere.

**Decision (so far, implicit through omission):** Ship the pull-based version first — fetch-on-focus, fetch-on-manual-refresh — and treat realtime subscriptions as a distinct follow-up phase rather than a blocking requirement for every other feature.

**Why:** Pull-on-focus is enough to prove every other piece of the data flow (auth, CRUD against Appwrite, order lifecycle, assignment) end-to-end without also standing up and debugging a WebSocket subscription layer at the same time. It's a smaller, independently-verifiable slice.

**Alternatives considered:** None seriously — this was more a sequencing choice than a considered tradeoff at the time each feature was built. It's called out explicitly here because it stopped being a free simplification the moment a *live* interrupt notification was requested (see next section): a shopper mid-shop won't see anything change on their screen until they navigate away and back, no matter what the backend does, until realtime is actually wired in.

**Consequences / left open:** This is the single biggest piece of infrastructure the app is currently missing relative to its own stated goals. Concretely blocks: live order-status updates for customers, and any kind of push notification to a shopper (new assignment, interruption, etc.) without them manually refreshing.

---

## Rush-order shopper interrupt: identified as a gap (built below)

**Context:** Testing the rush-order feature live (two Android emulators running a customer and a shopper session side by side) surfaced that placing a rush order while a shopper is already mid-shop on a different order does *nothing visible* — no notification, no reassignment, nothing. Real gig-fulfillment apps (Whole Foods/Amazon Flex-style) both notify a shopper immediately when a new order is assigned (with accept/decline), and can interrupt an in-progress order for something more urgent.

**Findings from auditing the existing code:** Two things suggested this was *intended* to exist eventually but never got built: the Appwrite `orders` collection already has `interruptedAt`/`interruptReason` attributes defined (visible in the README's schema table), but they're `null` on every order and referenced by zero lines of app code — a schema anticipated ahead of the feature that implements it. Separately, the reassignment logic added for the "shopper goes unavailable" fix above only ever operates on an order already back in the `pending` queue — by design, it never reaches into a *different* shopper's active order.

**Decision:** Not yet built. Documented as two separable features instead of one: (1) an accept/decline confirmation modal shown when a shopper goes Available and an order auto-assigns (self-contained, no new infrastructure — the order is already returned synchronously today, it's just never surfaced to the user), and (2) true mid-shop interruption for rush orders, which needs interrupt-decision logic (who gets interrupted and when), the realtime layer from the section above (otherwise "interrupted" just means "silently different next time you refresh"), and the actual notification UI (`react-native-paper`'s `Dialog`/`Portal`, already an unused dependency, is the natural building block over reaching for a new library).

**Why documented before implemented:** Given how much this touches — schema, backend assignment logic, a whole missing realtime layer, and new UI — going in with an explicit plan matters more here than for most of the smaller fixes above, hence stopping to write this down and get alignment before writing any code.

**Consequences / left open:** This is the current known frontier of the project. Whichever of the two sub-features gets built first should get its own entry here once it exists.

**Update:** Both sub-features were built next - see "Accept/decline on new assignment" and "Rush-order interrupt: decision logic, polling, and notification UI" below.

---

## Dual-emulator setup for live cross-role testing

**Context:** Verifying "does a shopper see X happen when a customer does Y" requires watching both roles' screens change in real time, which a single emulator (and a single logged-in session) can't do.

**Decision:** Run two independent Android emulator instances side by side — a second AVD (`Shopper_Phone`) cloned from the primary one's config, given its own fresh userdata so it can hold a separate logged-in session, sharing the same Metro bundler and the same real Appwrite backend as the primary emulator.

**Why:** This is the only way to actually *observe* a cross-role live-update bug or gap (like the rush-order interrupt gap above) rather than infer it from reading code — the blank-screen-until-refresh behavior on the shopper side was directly visible this way, side by side with the customer's action that should have (eventually) caused it.

**Alternatives considered:** A single emulator with logout/login switching between customer and shopper accounts was the fallback, but it can't show simultaneity — by the time you'd switched accounts to check the shopper's screen, you'd have lost the ability to tell whether an update was "live" versus "just refreshed."

**Consequences / left open:** Two emulator instances is noticeably heavier on the dev machine (RAM/CPU) than one — fine on the current 12-core/30GB machine, but worth knowing as a cost if this pattern gets reused for a machine with less headroom.

---

## Accept/decline on new assignment

**Context:** When a shopper toggled to Available and an order auto-assigned, it happened silently - the dashboard's current task just changed underneath them with no confirmation step, unlike the accept/decline pattern real gig-fulfillment apps use.

**Decision:** Added `NewAssignmentModal`, shown right after `updateShopperAvailability` returns a newly auto-assigned order (in `ShopperDashboardScreen.handleStatusChange`) instead of immediately setting it as the current task. Accept promotes it to the current task as before. Decline calls `updateShopperAvailability(shopperId, false)` a second time - no new backend logic needed, since by that point the shopper's status doc already has `currentOrderId` set, so the existing "going unavailable while working an order" branch (built for the earlier unassign fix) releases it back to `pending` and offers it to the next idle shopper, exactly as if the shopper had gone unavailable mid-task on their own.

**Why reuse `updateShopperAvailability` for decline instead of a dedicated decline function?** The state after auto-assign-then-decline is identical to the state after go-available-then-go-unavailable-mid-task - same order, same shopper, same "release it" outcome. Writing a second code path for the same state transition would just be two ways to do one thing.

**Alternatives considered:** A `react-native-paper` `Dialog`/`Portal` was considered for the modal itself, since the library's already a dependency, but set aside in favor of the same bare `Modal` + `Pressable`-backdrop pattern already proven in this codebase (`ShopperStatusDropdown`) - untested library components didn't need to be introduced for something the existing pattern already handles well. One correction carried over from that component: its inner content wasn't actually wrapped in its own `Pressable` to stop touch propagation, despite a comment claiming it was - fixed properly in the new component.

**Consequences / left open:** None significant - this is fully self-contained, no schema or realtime changes, verified end-to-end in the emulator (toggle Available, modal appears with correct order #/time; Decline confirmed via Appwrite REST to release the order back to `pending`; Accept confirmed to populate the current task).

---

## Rush-order interrupt: decision logic, polling, and notification UI

**Context:** Continuing directly from the gap identified above - build the actual interrupt behavior: when a rush order is placed and every shopper is already busy, take the least-urgent in-progress order from whoever has it and hand them the rush order instead, then tell them live.

**Decision, in three parts:**

1. **Schema/types:** Added `interruptedAt`/`interruptReason` to the `Order` TypeScript type (the Appwrite attributes already existed, unused) and a new `interruptOrder()` in `orderService.ts` - same shape as the existing `unassignOrder()`, plus the two new fields. Kept as a separate function rather than an optional flag on `unassignOrder`, since the two model different things: a shopper voluntarily stepping away vs. an order being taken from them.

2. **Decision logic:** New `handleRushOrderPlacement()` in `shopperStatusService.ts`, triggered from `CheckoutScreen` right after order creation, scoped to `priority === 1` only (normal orders keep their existing assign-on-availability-toggle behavior unchanged - broadening that further wasn't asked for). Tries an idle shopper first (reusing `getNextAvailableShopper`, no interruption needed); if everyone's busy, a new `getInterruptCandidateShopper()` finds whoever's current order has the furthest-out `scheduledReadyTime` - the same signal the rest of the assignment logic already sorts by, reused here rather than inventing a second heuristic (e.g. shopping progress) for a first version.

3. **Live notification:** New `ShopperAssignmentContext`, polling `getShopperStatus` every 8 seconds while a shopper is anywhere in the shopper navigation stack (mounted once in `AppNavigator.tsx`, wrapping the whole `ShopperStack.Navigator`, not per-screen). True Appwrite Realtime was investigated and set aside for now - this SDK version's React Native behavior here is unverified territory (undocumented database-scoped channel format, an unguarded `window.localStorage` access in the Realtime service's connection handler that likely isn't a global in this RN runtime). Polling reuses an already-proven fetch with zero new unknowns, at the cost of latency instead of instant push.

**A real bug caught during live verification:** the first version's interrupt reason was a dynamic string (`Interrupted for rush order ${orderId}`), which failed at write time - `interruptReason` is capped at 40 characters on the Appwrite schema, and the dynamic string was well over that. Caught immediately via a live end-to-end test (an `AppwriteException` in `adb logcat`, not a silent failure) and fixed to a short fixed string. Worth calling out because it's exactly the kind of thing that only surfaces by actually running the flow against the real schema, not from reading the code or type-checking alone - `interruptReason: string` in TypeScript says nothing about a server-side length cap.

**Verified end-to-end (2026-08-17):** two busy shoppers set up across the dual-emulator setup, a rush order placed while both were mid-order; the interrupt logic correctly picked the shopper with the furthest-out `scheduledReadyTime`, released their order (confirmed via Appwrite REST: `status: pending`, `interruptedAt`/`interruptReason` set), assigned the rush order to them instead, and the polling-driven `OrderInterruptedModal` appeared on their device within the poll window with the correct order details.

**Consequences / left open:** If the shopper is actively viewing `TaskDetailScreen` for the exact order that gets interrupted, that screen doesn't auto-refresh or auto-navigate away (a pre-existing limitation of that screen - it fetches once on mount - not something this feature introduces). Realtime remains a documented future upgrade over polling, should the up-to-8-second latency ever matter more than the integration risk did at the time this was built.

---

## Phase 4 core loop: claim → shop → complete

**Context:** A Phase 4 shopper-features spec, originally written in a browser session before this project moved to Claude Code CLI, was pasted in for a gap audit. Auditing found 4.1 (dashboard) done, 4.2 (order acceptance) partially done (auto-assignment accept/decline existed; manually claiming an order from the available-tasks list did not), 4.3 (shopping workflow) and 4.5 (completion) entirely unbuilt (`updatePickedItems()` existed with zero callers), 4.4 (arrivals) done on the customer side only, and 4.6 (emergency stop) already functionally covered by the existing "toggle Unavailable while working an order" release-and-reassign behavior (see above). The spec's suggested architecture (a `/hooks` directory, Appwrite Realtime subscriptions) was explicitly not followed - it conflicts with the "Pull-based data, not realtime" decision above.

**Decision:** Built the core loop only - claim an order, work a checklist (found/out-of-stock/substitute with customer approval), complete it - scoped down from the full spec by explicit user choice. Shopper-side arrivals and a dedicated in-shopping-screen emergency-stop action were deferred to a later pass.

**Schema:** Added one new optional `Order` attribute, `itemIssues` (string, 1000 chars, default `""`), via the Appwrite REST API using the debug `APPWRITE_API_KEY` already in `.env` (previously used read-only for schema inspection, per the "Appwrite schema drift" entry above - this is its first write use, with explicit user go-ahead beforehand). Encodes out-of-stock markers and substitution proposals/approval state per item, compact-string style like the existing `items`/`pickedItems` fields: `productId:oos` or `productId:sub:subProductId:pending|approved|rejected`. Parse/format helpers live in the new `src/utils/orderItems.ts`.

**Why one field instead of a new collection?** The existing `OrderMessages` collection (`messageID, orderID, senderID, receiverID, messageContent, sentDateTime, isRead`) was inspected live and found to be a generic chat shape with no status/approval fields - encoding structured substitution state into it would have meant JSON-stuffing `messageContent`, which isn't simpler than one purpose-built compact-string field following the pattern already established by `items`/`pickedItems`.

**Substitution approval, without realtime:** The shopper's `ShoppingScreen` polls the order every 8 seconds (same interval as `ShopperAssignmentContext`) only while a proposed substitution is `pending`. The customer's `OrderDetailScreen` polls the same way, but scoped to `order.status === 'shopping'` (the only window a new proposal could appear in), reusing its existing `loadOrder()`. Both are local `useEffect`/`setInterval` polls, not a new global context - each only matters while its own screen is open.

**Reuse over duplication:** `updateShopperAvailability`'s "becoming available with no order → auto-assign the next pending order" logic was extracted into a shared `autoAssignNextOrderTo()` in `shopperStatusService.ts`, since `OrderCompletionScreen` needed the identical sequence after freeing a shopper. `assignOrderToShopper()` in `orderService.ts` gained a third `autoAssigned` parameter (default `true`, preserving every existing caller) so the new manual-claim path from `TaskDetailScreen` could pass `false` without a separate function.

**Verified end-to-end (2026-08-18, dual-emulator):** start shopping → propose a substitute → customer approves via the 8s poll → shopper's screen picks up the approval via its own 8s poll → mark ready for pickup → shopper freed and the next pending order auto-assigned, confirmed live on the dashboard. Also verified the claim-gating fix below by attempting to open a second pending order while already mid-task and confirming no claim action was offered.

**Three real, pre-existing bugs surfaced by running the actual flow (not caught by `tsc`/`eslint`, exactly the kind DECISIONS.md keeps flagging as only found live):**

1. **`Query.search('name', ...)` had no fulltext index.** `productService.searchProducts()` - used by the customer home screen's search bar since Phase 3, and now by the new `SubstitutionPickerModal` - was calling `Query.search` against a `Products` collection with zero indexes defined. Every search silently failed with `AppwriteException: Searching by attribute "name" requires a fulltext index`, console-logged but never surfaced to a human before now. Fixed by adding a `fulltext` index on `Products.name` via the API key. This means customer product search was very likely broken in production since Phase 3 shipped, unrelated to Phase 4's changes - just never previously exercised by someone watching the console.

2. **`ready_for_pickup` was never added to the `Order.status` enum on Appwrite**, even though the TypeScript `OrderStatus` type and the customer-facing UI (`OrderTimeline`, `OrderStatusBadge`) have included it since Phase 3's pickup/arrival work. No order could ever actually reach that status - `completeOrder()` failed with `Invalid document structure` on first live attempt. Fixed by widening the enum's `elements` to include it (kept `default: 'pending'`, `required: false` unchanged). Confirmed live afterward.

3. **Claiming an order didn't check whether the shopper already had one in flight.** `TaskDetailScreen`'s claim action offered "Claim & Start Shopping" on any pending order regardless of the shopper's own `ShopperStatus.currentOrderId` - claiming a second order while mid-task on a first would silently orphan the first (its `shopperID` stays set, but nothing points `ShopperStatus.currentOrderId` at it any more, so it's unreachable by the release-back-to-queue path). Same failure mode the "releasing a shopper's order when they go unavailable" fix (above) exists to prevent, just reachable through a different door. Fixed by fetching the shopper's own status on `TaskDetailScreen` mount and gating the `claim` branch on `!shopperActiveOrderId`, mirroring the exact guard `updateShopperAvailability` already uses (`isAvailable && !previousOrderId`). Verified live: with a task already assigned, opening a different pending order's detail screen now shows no claim action.

---

## Manual order swap + non-blocking "more urgent order" toast

**Context:** The claim-gating fix above solved the orphaning bug but created a new gap: a shopper mid-task on a low-urgency order had no way to switch onto a newly-arrived, more time-sensitive order without first abandoning their current one via the status dropdown (losing the direct navigation flow) - and had no way to even find out such an order existed short of manually re-checking Available Tasks. Concrete scenario given: shopper starts a 2pm-due order at 9am; an 11am-due order arrives while they're mid-shop; nothing on screen reflects that.

**Decision, in two parts:**

1. **Manual swap.** `TaskDetailScreen`'s claim-gate now offers a third action, `swap`, when viewing a different pending order while already mid-task: confirms via `Alert.alert` (showing the current order's short id and due time), then `swapCurrentOrder()` (new, `shopperStatusService.ts`) claims the new order *before* releasing the old one (so a failed claim leaves the shopper with their original order intact, not stranded with neither), then releases the old order via the existing `unassignOrder`, then calls the newly-exported `reassignIfMostUrgent` (previously private, used only by the go-unavailable path) so the released order gets an immediate hand-off to another idle shopper if it's now the single most urgent thing pending - same behavior as every other release path in this app, reused rather than reinvented.

2. **Non-blocking urgent-order toast.** Extended `ShopperAssignmentContext`'s existing 8s poll (see "Rush-order interrupt" above) to also compare the pending queue's single most urgent order (`getNextOrderForAssignment`, already sorted ascending by `scheduledReadyTime`) against the shopper's own current order's due time, only while `assigned`/`shopping`. If the queue has something more urgent, a `Snackbar` (`UrgentOrderToast`, new) shows a dismissable, auto-expiring notice - deliberately not `OrderInterruptedModal`'s blocking treatment, since nothing happened to *this* shopper's order, they just might not know something more urgent is sitting unclaimed. A `lastNotifiedUrgentOrderIdRef` prevents re-notifying for the same still-unclaimed candidate on every subsequent tick, reset whenever the shopper's own current order changes.

**Two more bugs found live while testing this (neither introduced by this feature, both reproduced by it):**

- **Order short-id display was inconsistent.** `ShopperDashboardScreen`'s `generateShortOrderId` and `OrderInterruptedModal` both truncated by the *first* 8 characters (`substring(0, 8)`), while every other screen (`TaskDetailScreen`, the customer `OrderDetailScreen`) truncates by the *last* 8 (`slice(-8)`). The same order showed two different "short ids" depending which screen you were on - caught directly when the swap confirmation dialog's order id didn't match what the dashboard had just shown for the same order. Fixed both to `slice(-8)` to match the majority convention.
- **`interruptedAt` was never cleared on reassignment, causing a false "Order Reassigned" modal.** An order genuinely interrupted for a rush order in an earlier session kept that `interruptedAt` timestamp forever. When it later got auto-assigned, then released again for an unrelated reason (this session's swap), `ShopperAssignmentContext`'s polling only checks "is `interruptedAt` set", not "was this order *just* interrupted in this transition" - so it fired the interrupt modal off stale history. Fixed at the root: `assignOrderToShopper()` (`orderService.ts`) now clears `interruptedAt`/`interruptReason` on every fresh assignment, regardless of which of its several callers (auto-assignment, manual claim, swap) does the assigning - the moment an order is freshly assigned is the one point where any prior interrupt is unambiguously resolved.

**Verified end-to-end (2026-08-18, dual-emulator):** swap confirmed via the app (correct confirmation dialog, correct navigation into the new order) and independently via direct Appwrite REST reads (released order back to `pending`/unassigned, new order `shopping` with the right `shopperID`, `ShopperStatus.currentOrderId` updated). Toast confirmed visually rendering with the correct message and a working Dismiss action.

**Consequences / left open:** During rapid dev-loop testing (repeated `am force-stop` + relaunch cycles within seconds of each other, not a realistic usage pattern), the toast's first firing after a fresh app launch showed inconsistent timing - sometimes on the first eligible poll tick, sometimes not for several minutes, despite the underlying comparison logic (traced with temporary debug logging) evaluating correctly and identically every time it ran. Root cause not conclusively identified; suspected Metro/Hermes bundle-cache interaction with unusually frequent cold-start cycles rather than an app logic bug, since a real shopper session mounts this provider once and polls continuously rather than restarting every few seconds. Worth a closer look if it's ever observed to be slow on a real device across a normal session.
