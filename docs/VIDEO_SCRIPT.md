# YouTube Video Script: Building a Grocery Fulfillment App

**Purpose of this doc:** a speaking script/outline for a YouTube video walking through this project — why it exists, what it's built with, and how it evolved phase by phase. Written for practicing presentation delivery, so it's closer to "notes you talk from" than "text you read verbatim." `[Bracketed cues]` are stage directions (what to show on screen, when to demo something live). Plain paragraphs are narration you can paraphrase in your own words.

**Estimated total runtime:** ~18-25 minutes depending on how much of the live demo you keep in.

---

## Outline (for your own reference / video chapters)

1. Cold open / hook (0:00)
2. Why this project exists — the Whole Foods pain points (0:30)
3. Tech stack and why each piece was chosen (3:00)
4. Phase 1-2: Foundation, Auth (6:00)
5. Phase 3: Customer shopping experience + pickup time slots (7:30)
6. Phase 4, part 1: Assignment logic + the schema-drift debugging story (9:30)
7. Phase 4, part 2: The rush-order deep dive (13:00)
8. Phase 4, part 3: The shopping workflow + bugs only live testing caught (17:00)
9. Phase 4, part 4: Closing out placeholders — drop-offs, check-ins, settings (20:00)
10. What's still open / Phase 5 (22:00)
11. Close / call to action (24:00)

---

## 1. Cold open / hook

`[SCREEN: app running in the dual emulator setup — customer on one side, shopper on the other]`

Open on something visual and concrete before any talking-head explanation — the rush-order interrupt actually happening live: place a rush order as the customer, watch the shopper's screen get the interrupt modal a few seconds later.

> "This is a shopper mid-order getting bumped onto a rush order automatically — no refresh, no manual dispatch. I'm going to walk through how this app is built, why I built it, and honestly, some of the bugs I only found by breaking it live. This one specifically started as a complaint about an app I use every week."

---

## 2. Why this project exists

`[SCREEN: talking head or slides, no app yet]`

This is the section to make personal and specific — don't generalize to "online grocery shopping is convenient." Name the actual friction points you've hit as a Whole Foods pickup customer, since those are the ones this project explicitly tries to answer:

- **The ETA jumps around and doesn't mean anything.** You'll watch the in-app "shopper is 2-3 minutes away" estimate bounce up and down, sometimes while you can see you're still half a mile out. That's a GPS-accuracy problem more than a software bug — consumer GPS in a dense retail lot is commonly off by 30-100+ feet — but it's the kind of thing worth understanding *why* it happens before trying to build something similar.
- **Parking-spot communication is just a free-text field**, and when there are two or three other pickup-enabled stores in the same lot, "spot 4" is ambiguous. A structured, store-scoped selection would remove that ambiguity — this project deliberately didn't build that yet (more on that later), but it's called out explicitly as a scoped-and-deferred decision, not an oversight.
- **When you have more than one order ready, there's no single pickup.** You end up doing two separate handoffs for what should be one trip to your trunk. This project's data model doesn't solve that yet either — flagged as a real, larger feature gap.
- **Nothing tells anyone when priorities change.** If something more urgent needs to jump the queue, or a shopper needs to be redirected, that coordination doesn't happen live. This is the one this project actually *does* solve, and it's the centerpiece of the video — the rush-order interrupt system.

> "I'm not trying to rebuild Whole Foods' entire backend — this is a solo portfolio project. But every decision in it is trying to answer a real, specific piece of friction I've personally hit as a customer, and I wanted the reasoning behind each one to be traceable, not just the code."

`[SCREEN: docs/DECISIONS.md, scroll past the title/intro paragraph]`

Mention here that this project keeps a running engineering decision log, not just commit messages — and that the rest of this video is largely walking through that log in order.

---

## 3. Tech stack and why each piece was chosen

`[SCREEN: README.md "Built With" section]`

Frame this less as a list and more as "what problem was each piece solving, and what did I get out of learning it":

- **React Native (bare, not Expo), TypeScript.** Cross-platform from one codebase, and bare RN specifically (not Expo) to actually deal with native tooling — Gradle, the Android SDK, AVDs — instead of it being abstracted away. That's more setup pain up front (there's a whole story later about a Gradle/AGP version mismatch), but it means the skills transfer to any real native RN project, not just an Expo-managed one.
- **React Native Paper (Material Design 3).** Rather than hand-building a design system, this gets accessible, production-styled components for free — buttons, dialogs, snackbars — and it's the direct reason later features (the interrupt modal, the urgent-order toast) could be built quickly without inventing new UI primitives.
- **React Navigation.** Standard stack/tab navigation for a multi-role app — two entirely different navigator stacks (customer vs. shopper) that share the same auth/theme context underneath.
- **Appwrite (Backend-as-a-Service).** This is the one worth spending the most explanation time on. Instead of standing up and hosting a custom backend, Appwrite gives a real database, real authentication, and a real (if not yet wired in) realtime/WebSocket layer out of the box. The tradeoff, and this becomes a recurring theme: **you're now working against someone else's schema and someone else's error messages**, which is a different (and in some ways harder) skill than owning your own backend end to end. There's a whole segment coming up about that.
- **AsyncStorage.** Simple persistent local storage for the cart — deliberately not over-engineered into a database for something that's inherently per-device, ephemeral state.

> "None of these are exotic choices — that's kind of the point. The goal wasn't to show off an unusual stack, it was to use the stack you'd actually find at a company doing this kind of app, and go deep enough into each piece that the tradeoffs are real, not textbook."

---

## 4. Phase 1-2: Foundation & Auth

`[SCREEN: quick cut through login/register screens]`

Keep this brief — it's necessary context, not the interesting part of the story:

- Phase 1: Appwrite backend configured, collections created by hand through the console, RN project scaffolded.
- Phase 2: role-based login/register (customer vs. shopper), persistent sessions, password reset.

Worth one sentence acknowledging the environment-setup pain that isn't glamorous but is real: getting a bare RN Android build working locally meant fixing a genuine Gradle/AGP version mismatch (the project was pinned to Gradle 9.0 but the installed Android Gradle Plugin only supported up to 8.13) and sorting out JDK version conflicts. That's the unglamorous 20% of any real mobile project.

---

## 5. Phase 3: Customer shopping experience + pickup time slots

`[SCREEN: checkout flow, time-slot picker]`

Cover product browsing/search/cart/checkout quickly, then slow down for the first *decision* worth explaining:

**Pickup time slots, scoped to pickup only.** Checkout originally hardcoded every order to "ready in 30 minutes," with no way to actually choose a time. The fix — a time-slot picker — was deliberately scoped to `fulfillmentType === 'pickup'` only, leaving delivery orders on the old default.

> "This is a good example of a scope decision that's easy to get wrong in the direction of *more* work. It would've been tempting to build one generic 'scheduled time' picker for both delivery and pickup — but delivery scheduling is a genuinely different problem (windows, driver ETAs) that nobody had actually asked for. Building it speculatively would've meant guessing at requirements instead of solving the one that was real."

Then the follow-up: **rush orders**, changing the normal slot grid from 30 to 60 minutes and adding a "Rush Order" toggle that targets 30 minutes out instead. This is a good moment to plant a seed for the bigger rush-order segment coming up — mention that this is where the `priority` field first got used, and tease that reusing it (instead of adding a new field) is what made a much bigger feature "just work" later.

---

## 6. Phase 4, part 1: Assignment logic + the schema-drift debugging story

`[SCREEN: orderService.ts, getNextOrderForAssignment]`

**Auto-assignment via sort order, not a routing algorithm.** When a shopper goes Available, the app queries pending orders sorted by `scheduledReadyTime` ascending and hands them the single most urgent one. No weighting, no scoring, no server-side function.

> "A real dispatch system weighs shopper proximity, current load, order age — often as its own service. I made a deliberate call not to build that, because the goal here was to prove a coherent, *correct* assignment mechanism — query, sort, assign, persist — not to reimplement a logistics-routing algorithm that would blow the scope of a solo mobile-plus-BaaS project. And the one signal that actually matters most for a grocery pickup app is exactly the one it sorts on: whichever order is due soonest should go out the door first."

**Now the debugging story — this is a great teaching segment.** The Appwrite collections were hand-created through the console early on and drifted from what the code actually read/wrote: `shopperId` vs. the real attribute `shopperID`, `lastActiveTimestamp` vs. `lastActiveTimeStamp`, missing `Create`/`Delete` permissions. Shopper registration was failing, and — this is the interesting part — **the error messages actively lied.** A failed rollback delete, masked by a missing `Delete` permission, surfaced as "not authorized," which hid the real casing bug underneath it.

> "Debugging this one error message at a time would have taken forever, and worse, been actively misleading. What actually worked was stepping back and getting the *ground truth*: I added a server-side debug API key, scoped to database and auth read/write, pulled every collection's actual attribute list straight from the Appwrite REST API, and diffed it against every place in the code that read or wrote those fields. That found all four drift points — two casing bugs, two permission gaps — in one pass instead of four separate debugging sessions."

Good teaching point to state explicitly: **silent empty-result failures are a specific hazard in query-based backends.** `getShopperStatus()` querying a nonexistent field didn't throw — it just silently returned zero results, which would have quietly broken availability toggling for every shopper without ever raising an error. That's worth calling out as a category of bug to watch for, not just a one-off fix.

Also worth a line on the choice made once the drift was found: the *code* was changed to match the already-in-use console schema, not the other way around — because the schema was already the de facto source of truth, and changing it risked breaking anything else already pointed at it.

---

## 7. Phase 4, part 2: The rush-order deep dive

`[SCREEN: split — customer placing a rush order / shopper receiving the interrupt]`

This is the section the user specifically wants highlighted — spend real time here, and explicitly contrast the *simple* part against the *complex* part, because that contrast is the actual insight.

### The simple part: reusing a field instead of adding one

When rush orders needed to reliably jump the queue, the schema already had a `priority` field on every Order — defined in the original schema, but never actually set by any code path. Instead of adding a new `isRush` boolean (another Appwrite console change, another field to keep in sync everywhere), the decision was to set `priority: 1` for rush, `0` for normal, and let it ride entirely on infrastructure that already existed:

> "Because assignment already sorts by `scheduledReadyTime` ascending, and a rush order's ready time is only 30 minutes out, it *automatically* sorts to the front of the queue. Zero changes to the assignment logic itself. That's the kind of moment that makes a project feel well-designed in hindsight — not because it was predicted, but because the earlier decision to sort by urgency generalized to a case it wasn't originally written for."

Worth naming the actual cost of this shortcut too, for honesty: `priority` is now implicitly a two-state flag rather than a general-purpose scale — a semantic narrowing that would matter if a future feature wanted more than two priority levels.

### The complex part: actually interrupting a shopper who's mid-task

`[SCREEN: docs/DECISIONS.md, "Rush-order interrupt" entries]`

This is where it stops being simple. Getting an idle shopper a rush order is one query. **Taking an order away from a shopper who's actively working something else** is a completely different problem, and it took three separate pieces to build:

1. **Schema/types** — `interruptedAt`/`interruptReason` fields already existed on the Appwrite schema (defined ahead of time, never used — a sign this was *planned* to exist eventually) plus a new `interruptOrder()` function, deliberately kept separate from the existing `unassignOrder()` because they model different things: a shopper voluntarily stepping away vs. having an order taken from them.
2. **Decision logic** — a new function that tries an idle shopper first, and only if everyone's busy, picks whoever's *current* order has the furthest-out ready time to interrupt — reusing the exact same "sort by urgency" signal as the base assignment logic, rather than inventing a second heuristic like shopping progress.
3. **Live notification** — this is the part that needed real infrastructure that didn't exist yet: a polling context checking shopper status every 8 seconds while anywhere in the shopper navigation stack, which is what actually pops the interrupt modal on the shopper's screen.

> "True Appwrite Realtime — WebSocket subscriptions — was on the original plan and I actually investigated it here. I set it aside deliberately: this particular SDK version's React Native behavior was unverified territory, including an unguarded `window.localStorage` access inside the Realtime connection handler that almost certainly isn't a global in the RN runtime. Polling is objectively worse — up to 8 seconds of latency instead of instant push — but it reused an already-proven fetch path with zero new unknowns. That's a real engineering tradeoff: correctness and predictability over raw responsiveness, made explicitly rather than by default."

**Then tell the bug story that came out of testing this live** — it's a great concrete example of "type-checking doesn't save you from a live schema": the first version's interrupt reason was a dynamic string (`Interrupted for rush order ${orderId}`), which failed at write time because `interruptReason` is capped at 40 characters on the live Appwrite schema. TypeScript said `string`, which is true and also completely uninformative about a server-side length cap. Caught immediately via an `AppwriteException` in `adb logcat` during a live dual-emulator test, fixed to a short fixed string.

`[DEMO: if you can reproduce it live, do the full interrupt flow here — two busy shoppers, place a rush order, show the interrupt modal landing on whichever shopper had the furthest-out order]`

### The reuse callback: accept/decline

Tie back to something built around the same time — when a shopper auto-gets assigned an order, they now see an accept/decline modal instead of it silently becoming their task. The interesting engineering choice: **decline doesn't need its own function.** The state after "auto-assign then decline" is identical to "go available, then go unavailable mid-task" — same order, same shopper, same release-back-to-pending outcome — so decline just calls the existing availability-toggle function a second time.

> "This is worth calling out as a small example of a bigger principle: when two user actions produce the same underlying state transition, you don't need two code paths for it. Writing a second one just to feel purpose-built would've been two ways to do one thing."

---

## 8. Phase 4, part 3: The shopping workflow + bugs only live testing caught

`[SCREEN: ShoppingScreen checklist, substitution flow]`

Cover the core loop briefly — claim an order, work a checklist (found / out-of-stock / propose substitute with customer approval), complete it — then spend the real time on **three bugs found only by actually running the flow, not by `tsc` or `eslint`**, because this is a strong, honest teaching moment about the limits of static checking:

1. **A search feature had been silently broken since an earlier phase.** `Query.search()` was being called against a Products collection with no fulltext index defined — every search failed with an `AppwriteException`, logged to console but never surfaced to a human, because nobody had been watching the console when it happened.
2. **An entire status value could never actually be reached.** The TypeScript type and the UI had included `ready_for_pickup` since an earlier phase, but the Appwrite `status` enum itself was never widened to include it — so any order trying to reach that status failed outright with `Invalid document structure` on the very first live attempt.
3. **Claiming a second order could silently orphan the first.** Nothing checked whether a shopper already had an order in flight before letting them claim another — the first order's `shopperID` stayed set, but nothing pointed back to it anymore, so it became unreachable by any release-back-to-queue path. Same failure shape as an earlier bug fix, just reachable through a different door.

> "The theme across all three: type-checking tells you your code is internally consistent. It says nothing about whether the live schema, the live indexes, or the live data actually agree with what your types claim. The only way any of these three surfaced was by running the real flow against the real backend and watching what actually broke."

Good spot to mention the dual-emulator setup here if you haven't already shown it — two independent Android emulators, one signed in as a customer, one as a shopper, so you can literally watch both sides update (or fail to update) in real time side by side. Worth one sentence on why: a single emulator with logout/login switching can't show *simultaneity* — by the time you've swapped accounts, you can't tell if something was live or just freshly refreshed.

---

## 9. Phase 4, part 4: Closing out placeholders

`[SCREEN: Drop Offs / Customer Check-ins / Shopper Settings screens]`

Quick pass through finishing the last static-placeholder screens:

- **Customer Check-ins is store-wide**, not scoped to one shopper's own orders — matches how a real curbside desk actually works, any on-duty shopper sees every waiting customer.
- **Drop Offs needed a real status that didn't exist yet** — delivery orders used to jump straight from `shopping` to `completed` with no "out for delivery" state in between, so a new `out_for_delivery` status was added specifically to give this screen something real to act on.
- A second, more severe schema-drift bug turned up here — this time on `CustomerArrivals`: required fields the live schema actually enforced (`arrivedAt`/`notifiedShopperAt` as required datetimes, `parkingSpot` as a required integer 1-5) didn't match what the code assumed, and it was breaking the customer-facing "I've Arrived" button outright. Same resolution pattern as the very first schema-drift story: fix the code to match the live schema, not the reverse.

This is a good moment to loop back to the "why I started this" section: the parking-spot field being a *required integer 1-5* on the real schema is directly the reason a proper structured picker (instead of free text) is flagged as a deliberate, still-open decision rather than something quietly bolted on as a side effect of this bug fix.

---

## 10. What's still open / Phase 5

`[SCREEN: README roadmap section]`

Be honest and specific about what's deliberately unfinished — this is a portfolio project and showing you know the difference between "not built" and "didn't think of it" is worth more than pretending everything's done:

- **Realtime is still polling, not WebSockets.** This is the single biggest gap relative to the project's own original goals, and it's a deliberate sequencing choice, not an oversight — pull-based data was enough to prove every other piece of the flow (auth, CRUD, order lifecycle, assignment) without also debugging a WebSocket layer at the same time.
- **Multi-order pickup consolidation** — the exact "two separate handoffs for one trip" problem named in the intro — has zero data-model support today. Real fix needs grouping a customer's ready orders, a group-level arrival flow, and a staff-facing view this app doesn't have a role for yet. Named explicitly as a bigger, separate initiative.
- **Structured parking-spot selection** and **geofenced auto-arrival detection** were both explicitly weighed and explicitly deferred — geofencing specifically because it needs a location library, background permissions with real app-store review exposure, and because consumer GPS accuracy (the same issue named in the opening) is a real risk against a tight proximity threshold.

> "I think it matters that these are documented as decisions, not left as silent gaps. Anyone can point at a finished feature. Being able to explain *why* something isn't built yet, and what it would actually take, is the more useful signal in an interview or a portfolio review."

---

## 11. Close / call to action

`[SCREEN: back to the app, maybe the DECISIONS.md file one more time]`

> "That's the project end to end — from a real, specific frustration with an app I use every week, through the tech choices, through the parts that turned out simple and the parts that turned out genuinely hard, plus a few bugs that only showed up by actually running the thing. If you want to see the full reasoning behind any of these calls, the engineering decision log is public in the repo — link in the description. Thanks for watching."

---

## Notes to self for delivery

- The rush-order segment (section 7) is the one to rehearse most — it's the centerpiece and has the most moving parts to explain clearly without a script in front of you.
- Have the dual-emulator setup already running and logged in *before* recording, so you're not waiting on boot times on camera.
- The three "bugs only live testing caught" (section 8) are strong standalone clips if this ever gets cut into shorts — each one is a self-contained 60-90 second story with a clear setup/reveal/fix shape.
