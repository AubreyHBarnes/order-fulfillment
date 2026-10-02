# YouTube Video Script: Building a Grocery Fulfillment App

**Purpose of this doc:** a speaking script/outline for a YouTube video walking through this project — why it exists, what it's built with, and how it evolved phase by phase. Written for practicing presentation delivery, so it's closer to "notes you talk from" than "text you read verbatim." `[Bracketed cues]` are stage directions (what to show on screen, when to demo something live). Plain paragraphs are narration you can paraphrase in your own words.

**Who it's for:** the target audience is experienced engineers and hiring managers, but the script is written so a beginner can follow it too. Each technical idea gets a short **In plain terms:** line — a one- or two-sentence explanation you can say out loud before moving on. Experienced viewers lose nothing (it's a few seconds each), and it shows you can explain your own work clearly, which is a skill interviewers look for in its own right. Skip any that feel redundant once you're comfortable.

**Framing for the whole video:** this is a work in progress, not a finished product. Say so up front and mean it — the unfinished parts are presented as deliberate, documented next steps and become talking points, not apologies.

**Estimated total runtime:** ~28-35 minutes with the live demos. Sections 10-13 (the September work) are the strongest material for an engineering audience; if you need to cut time, shorten sections 4-9 rather than those.

---

## Outline (for your own reference / video chapters)

1. Cold open / hook (0:00)
2. Why this project exists — the Whole Foods pain points (0:45)
3. Tech stack and why each piece was chosen (3:30)
4. Phase 1-2: Foundation, Auth (7:00)
5. Phase 3: Customer shopping experience + pickup time slots (8:00)
6. Phase 4, part 1: Assignment logic + the schema-drift debugging story (10:00)
7. Phase 4, part 2: The rush-order deep dive (13:00)
8. Phase 4, part 3: The shopping workflow + bugs only live testing caught (16:30)
9. Phase 4, part 4: Closing out placeholders — drop-offs, check-ins, settings (19:00)
10. Phase 5: From polling to Realtime (20:30)
11. Phase 6, part 1: Moving the decisions to the server (23:00)
12. Phase 6, part 2: The arrival hand-off — and being corrected (25:30)
13. Phase 6, part 3: Locking the database (27:30)
14. What's still open (30:30)
15. Close / call to action (33:00)

---

## 1. Cold open / hook

`[SCREEN: app running in the dual emulator setup — customer on one side, shopper on the other]`

Open on something visual and concrete before any talking-head explanation — the rush-order interrupt actually happening live: place a rush order as the customer, watch the shopper's screen get the interrupt modal a second or two later.

> "This is a shopper mid-order getting bumped onto a rush order automatically — no refresh, no manual dispatch. Nobody's phone made that decision; a function running on the server did, and pushed the result to the shopper's screen live. I'm going to walk through how this app is built, why I built it, and honestly, some of the bugs I only found by breaking it live. One thing up front: this is a work in progress. It's not finished, and I'll be specific at the end about what's still open and what I'd build next."

---

## 2. Why this project exists

`[SCREEN: talking head or slides, no app yet]`

This is the section to make personal and specific — don't generalize to "online grocery shopping is convenient." Name the actual friction points you've hit as a Whole Foods pickup customer, since those are the ones this project explicitly tries to answer:

- **The ETA jumps around and doesn't mean anything.** You'll watch the in-app "shopper is 2-3 minutes away" estimate bounce up and down, sometimes while you can see you're still half a mile out. That's a GPS-accuracy problem more than a software bug — consumer GPS in a dense retail lot is commonly off by 30-100+ feet — but it's the kind of thing worth understanding *why* it happens before trying to build something similar.
- **Parking-spot communication is just a free-text field**, and when there are two or three other pickup-enabled stores in the same lot, "spot 4" is ambiguous. A structured, store-scoped selection would remove that ambiguity — this project hasn't built that yet (more on that later), but it's called out explicitly as a scoped-and-deferred decision, not an oversight.
- **When you have more than one order ready, there's no single pickup.** You end up doing two separate handoffs for what should be one trip to your trunk. This project's data model doesn't solve that yet either — flagged as a real, larger feature gap.
- **Nothing tells anyone when priorities change.** If something more urgent needs to jump the queue, or a shopper needs to be redirected, that coordination doesn't happen live. This is the one this project actually *does* solve, and it's the thread running through the whole video.

> "I'm not trying to rebuild Whole Foods' entire backend — this is a solo portfolio project. But every decision in it is trying to answer a real, specific piece of friction I've personally hit as a customer, and I wanted the reasoning behind each one to be traceable, not just the code."

`[SCREEN: docs/DECISIONS.md, scroll past the title/intro paragraph]`

Mention here that this project keeps a running engineering decision log, not just commit messages — and that the rest of this video is largely walking through that log in order.

**In plain terms:** a decision log is a diary for the codebase. Code shows *what* the app does; the log records *why* it does it that way, what else was considered, and what was knowingly left unfinished.

---

## 3. Tech stack and why each piece was chosen

`[SCREEN: README.md "Built With" section]`

Frame this less as a list and more as "what problem was each piece solving, and what did I get out of learning it":

- **React Native (bare, not Expo), TypeScript.** Cross-platform from one codebase, and bare RN specifically (not Expo) to actually deal with native tooling — Gradle, the Android SDK, emulators — instead of it being abstracted away. More setup pain up front, but the skills transfer to any real native RN project.
  **In plain terms:** React Native lets you write one app in JavaScript and run it on both Android and iPhone. TypeScript is JavaScript with type labels, so mistakes like passing text where a number belongs get caught before the app runs. "Bare" means I manage the Android build tools myself instead of letting a framework hide them.
- **React Native Paper (Material Design 3).** Accessible, production-styled components — buttons, dialogs, snackbars — instead of hand-building a design system. It's the direct reason later features like the interrupt modal could be built quickly.
- **React Navigation.** Two entirely different navigator stacks (customer vs. shopper) sharing the same login and theme underneath.
- **Appwrite (Backend-as-a-Service).** This is the one worth spending the most time on. Instead of writing and hosting a custom backend, Appwrite provides a database, user accounts, live updates over WebSockets, and serverless functions out of the box. The tradeoff, and it's a recurring theme: **you're working against someone else's schema, someone else's permission model and someone else's error messages**, which is a different skill than owning your backend end to end.
  **In plain terms:** a backend is the part of an app that lives on a server — the shared database and the rules about who can change what. A Backend-as-a-Service is a company that runs that part for you, so you configure it instead of building it.
- **Appwrite Functions (Node.js).** Added later in the project, and it became the most important piece — every decision about who does which order now runs here, not on anyone's phone. Section 11 covers why.
  **In plain terms:** a serverless function is a small piece of code that lives on the server and runs automatically when something happens — like "an order was just created" — without you managing a server yourself.
- **AsyncStorage.** Simple on-device storage for the cart — deliberately not a database, since a cart is per-device, temporary state.

> "None of these are exotic choices — that's kind of the point. The goal wasn't to show off an unusual stack, it was to use the stack you'd actually find at a company doing this kind of app, and go deep enough into each piece that the tradeoffs are real, not textbook."

---

## 4. Phase 1-2: Foundation & Auth

`[SCREEN: quick cut through login/register screens]`

Keep this brief — it's necessary context, not the interesting part of the story:

- Phase 1: Appwrite backend configured, collections created by hand through the console, RN project scaffolded.
  **In plain terms:** a *collection* is like a spreadsheet tab in the database — one for Orders, one for Products, and so on. Each row is one record.
- Phase 2: role-based login/register (customer vs. shopper), persistent sessions, password reset.

Worth one sentence acknowledging the environment-setup pain that isn't glamorous but is real: getting a bare RN Android build working locally meant fixing a genuine Gradle/AGP version mismatch (the project was pinned to Gradle 9.0 but the installed Android Gradle Plugin only supported up to 8.13) and sorting out JDK version conflicts. That's the unglamorous 20% of any real mobile project.

---

## 5. Phase 3: Customer shopping experience + pickup time slots

`[SCREEN: checkout flow, time-slot picker]`

Cover product browsing/search/cart/checkout quickly, then slow down for the first *decision* worth explaining:

**Pickup time slots, scoped to pickup only.** Checkout originally hardcoded every order to "ready in 30 minutes," with no way to choose a time. The fix — a time-slot picker — was deliberately scoped to pickup orders only, leaving delivery on the old default.

> "This is a good example of a scope decision that's easy to get wrong in the direction of *more* work. It would've been tempting to build one generic 'scheduled time' picker for both — but delivery scheduling is a genuinely different problem, with delivery windows and driver ETAs, that nobody had actually asked for. Building it speculatively would've meant guessing at requirements instead of solving the one that was real."

Then the follow-up: **rush orders**, changing the normal slot grid from 30 to 60 minutes and adding a "Rush Order" toggle that targets 30 minutes out instead. Plant a seed for section 7 — mention that this is where the `priority` field first got used, and tease that reusing it (instead of adding a new field) is what made a much bigger feature "just work" later.

---

## 6. Phase 4, part 1: Assignment logic + the schema-drift debugging story

`[SCREEN: functions/auto-assignment/src/main.js, getNextOrderForAssignment]`

**Auto-assignment via sort order, not a routing algorithm.** When a shopper becomes free, the system takes all waiting orders, sorts them by when they're due, and hands over the most urgent one. No weighting, no scoring.

> "A real dispatch system weighs shopper proximity, current load, order age — often as its own service. I deliberately didn't build that, because the goal was to prove a *correct* assignment mechanism — find, sort, assign, save — not to reimplement a logistics-routing algorithm. And the one signal that matters most for grocery pickup is exactly the one it sorts on: whichever order is due soonest should go out the door first."

Worth one sentence of foreshadowing: at this point in the project, this logic ran *on the shopper's phone*. Section 11 is about why that had to change.

**Now the debugging story — this is a great teaching segment.** The Appwrite collections were hand-created through the console early on and drifted from what the code actually read and wrote: `shopperId` vs. the real field `shopperID`, `lastActiveTimestamp` vs. `lastActiveTimeStamp`, missing Create/Delete permissions. Shopper registration was failing, and — this is the interesting part — **the error messages actively lied.** A failed cleanup step, blocked by a missing Delete permission, surfaced as "not authorized," which hid the real capitalization bug underneath it.

**In plain terms:** a *schema* is the database's definition of what each record looks like — which fields exist, their exact names and types. "Schema drift" is when the code and the database quietly disagree about that, like the code writing to `shopperId` while the database only knows `shopperID`.

> "Debugging this one error message at a time would have taken forever, and worse, been actively misleading. What actually worked was getting the *ground truth*: I pulled every collection's real field list straight from Appwrite's API and compared it against every place in the code that read or wrote those fields. That found all four problems — two capitalization bugs, two permission gaps — in one pass instead of four separate debugging sessions."

Teaching point to state explicitly: **silent empty results are a specific hazard in query-based backends.** A query filtering on a field that doesn't exist didn't throw an error — it just returned nothing, which would have quietly broken availability toggling for every shopper without anyone seeing an error.

Also worth a line on the choice made once the drift was found: the *code* was changed to match the database, not the other way around — the database was already the de facto source of truth, and changing it risked breaking anything else already pointed at it.

---

## 7. Phase 4, part 2: The rush-order deep dive

`[SCREEN: split — customer placing a rush order / shopper receiving the interrupt]`

This is the centerpiece feature. Explicitly contrast the *simple* part against the *complex* part, because that contrast is the actual insight.

### The simple part: reusing a field instead of adding one

When rush orders needed to jump the queue, every Order already had a `priority` field — defined in the original schema, but never set by any code. Instead of adding a new `isRush` field, rush orders set `priority: 1`, normal ones `0`, and everything else rode on infrastructure that already existed:

> "Because assignment already sorts by ready time, and a rush order is only 30 minutes out, it *automatically* sorts to the front of the queue. Zero changes to the assignment logic itself. That's the kind of moment that makes a project feel well-designed in hindsight — not because it was predicted, but because an earlier decision generalized to a case it wasn't written for."

Name the cost too, for honesty: `priority` is now effectively a yes/no flag rather than a general scale — that would matter if a future feature wanted more than two priority levels.

### The complex part: interrupting a shopper who's mid-task

`[SCREEN: docs/DECISIONS.md, "Rush-order interrupt" entries]`

Getting an idle shopper a rush order is one query. **Taking an order away from a shopper who's actively working on something else** is a completely different problem, and it took three pieces:

1. **Data** — `interruptedAt`/`interruptReason` fields (already in the schema, never used — a sign this was planned all along) plus a separate `interruptOrder()` path, kept distinct from a shopper voluntarily stepping away because they model different things.
2. **Decision logic** — try an idle shopper first; only if everyone's busy, interrupt whoever's *current* order is due furthest out — reusing the same "sort by urgency" signal rather than inventing a second rule.
3. **Live notification** — the interrupt modal on the shopper's screen. At the time, this was done by **polling**: the shopper's app asked the server "anything new for me?" every 8 seconds.
   **In plain terms:** polling is like refreshing your email every few seconds to check for new mail, versus push, where the mail shows up on its own. Polling is simpler and more predictable, but always a little late.

> "Push notifications over WebSockets were the plan from day one, and I looked at them here — but the SDK had some React Native behavior I couldn't vouch for yet. Polling was slower, up to 8 seconds late, but it used code I'd already proven worked. I picked predictability over speed, on purpose, and wrote down that it was a temporary choice. Section 10 is where I came back and replaced it."

**Then tell the bug story from testing this live** — a concrete example of "type-checking doesn't save you from a live schema": the first interrupt reason was a dynamic string (`Interrupted for rush order ${orderId}`), which failed on save because the live database caps `interruptReason` at 40 characters. TypeScript said `string`, which is true and says nothing about a server-side length limit. Caught immediately in a live two-emulator test, fixed to a short fixed string.

`[DEMO: the full interrupt flow — two busy shoppers, place a rush order, show the modal landing on whichever shopper had the furthest-out order]`

### The reuse callback: accept/decline

When a shopper gets auto-assigned an order, they see an accept/decline prompt instead of it silently becoming their task. The interesting choice: **decline didn't need its own code path.** "Auto-assigned, then declined" ends in exactly the same state as "went available, then went unavailable" — same order, same shopper, same release back to the queue — so decline reuses that path.

> "When two user actions produce the same underlying state change, you don't need two code paths for it. Writing a second one just to feel purpose-built would've been two ways to do one thing."

---

## 8. Phase 4, part 3: The shopping workflow + bugs only live testing caught

`[SCREEN: ShoppingScreen checklist, substitution flow]`

Cover the core loop briefly — claim an order, work a checklist (found / out-of-stock / propose substitute with customer approval), complete it — then spend real time on **three bugs found only by running the flow, not by the type checker or linter**:

**In plain terms:** a *type checker* and a *linter* are tools that read your code without running it and flag mistakes. They're good at catching typos and mismatched types, but they can't know what's actually in the live database.

1. **Search had been silently broken since an earlier phase.** It relied on a full-text search index on Products that had never been created — every search failed, logged to a console nobody was watching.
2. **An entire order status could never be reached.** The code and UI had included `ready_for_pickup` for a while, but the database's list of allowed status values was never updated to include it — so the first live attempt failed outright.
3. **Claiming a second order could orphan the first.** Nothing checked whether a shopper already had an order in progress, so the first one kept its shopper assignment but nothing pointed back to it anymore — it became unreachable.

> "The theme across all three: type-checking tells you your code agrees with itself. It says nothing about whether the live database, its indexes, or its data agree with what your code assumes. The only way these surfaced was running the real flow against the real backend."

Good spot to show the **dual-emulator setup** if you haven't already — two independent Android emulators, one signed in as a customer, one as a shopper, so you can watch both sides update in real time. One sentence on why: logging out and back in on a single device can't show *simultaneity* — by the time you've switched accounts, you can't tell if something updated live or just loaded fresh.

---

## 9. Phase 4, part 4: Closing out placeholders

`[SCREEN: Drop Offs / Customer Check-ins / Shopper Settings screens]`

Quick pass through finishing the last placeholder screens:

- **Customer Check-ins is store-wide** — any on-duty shopper sees every waiting customer, like a real curbside desk. (Section 12 revisits how the *notification* for an arrival works — that one I got wrong the first time.)
- **Drop Offs needed a status that didn't exist yet** — delivery orders jumped straight from `shopping` to `completed`, so a new `out_for_delivery` status was added to give the screen something real to act on.
- **A second, more severe schema-drift bug**, this time on `CustomerArrivals`: required fields the database enforced (arrival times, `parkingSpot` as a required number 1-5) didn't match what the code sent, breaking the customer's "I've Arrived" button outright. Same resolution as the first drift story: fix the code to match the live schema.

Loop back to the intro: `parkingSpot` being a required number 1-5 on the real schema is exactly why a proper structured picker, instead of free text, is flagged as a deliberate, still-open decision rather than quietly bolted on during a bug fix.

---

## 10. Phase 5: From polling to Realtime

`[SCREEN: src/services/realtimeService.ts, then the substitution round trip live on both emulators]`

This is where the "temporary" polling from section 7 got replaced — and the interesting part is *how* the decision was made.

> "Twice, I'd set Realtime aside because the SDK's React Native behavior was 'unverified.' The third time, I realized that if I kept writing 'unverified' without ever testing it, it would become a permanent excuse instead of a real blocker. So instead of reasoning about it, I ran an experiment."

**The spike:** a throwaway listener, mounted on both emulators for over a minute — through several heartbeat cycles, backgrounding and foregrounding the app, and writes from one device observed on the other. The feared crash never happened. Events arrived in 1-4 seconds, reliably.

**In plain terms:** a *spike* is a small, disposable experiment whose only job is to answer a question — "does this actually work here?" — before you commit to building on it. You throw the code away and keep the answer.

**The decision:** replaced 8-second polling with live subscriptions at all 8 places that had it, centralized in one service file. Two facts about Appwrite Realtime shaped every screen, and both are worth explaining to an engineering audience:

1. **No server-side filtering.** Subscribing to Orders delivers *every* order's changes, project-wide. Each screen filters for its own records. (Section 14 comes back to why this matters for privacy.)
2. **No replay after a disconnect.** If the connection drops — a network blip, or the app going to the background — any changes during that gap are simply gone. So the app does a fresh fetch after every reconnect and every time it comes back to the foreground.
   **In plain terms:** it's like a live radio broadcast, not a podcast. If you step away, you miss that part — so when you come back, you have to check the news to catch up.

> "I deliberately didn't add a backup poll 'just in case.' If the live connection is broken, I'd rather the data visibly go stale than have a timer quietly paper over it with data that looks live but isn't. A problem you can see is a problem you can fix."

**A small, satisfying fix worth one minute:** the spike did find one real SDK problem — the SDK reads browser-only storage that doesn't exist in React Native, in two places where the SDK's own authors had forgotten a safety check they'd added everywhere else. Rather than hide the warning, I patched those two lines using `patch-package`, which reapplies the fix automatically on every install.

**In plain terms:** `patch-package` lets you make a small fix to someone else's library and keep it in your project, so it isn't lost the next time the library gets reinstalled.

`[DEMO: shopper proposes a substitution → customer's screen shows it live → customer approves → shopper's screen updates — no refresh on either side]`

---

## 11. Phase 6, part 1: Moving the decisions to the server

`[SCREEN: functions/auto-assignment/src/main.js — the header comment, then a handler]`

This is the architectural turning point of the project. Explain the problem first, because it's not obvious until you see it:

> "Up to this point, every phone was making assignment decisions. When a shopper went available, *their phone* looked at the order queue and assigned itself an order. Which works fine with one shopper. With five, you have five phones all reading the same queue at the same time, each deciding on its own — and nothing stops two of them from grabbing the same order."

**In plain terms:** that's called a *race condition* — two actors racing to change the same thing, where the result depends on who happens to get there first. It almost never shows up in testing with one user, and shows up constantly in production with many.

There's a second problem, about **trust**: if the phone makes the decision, anyone who can modify the app — or skip it and call the database directly — can make whatever decision they want.

**The decision:** all assignment logic moved into one Appwrite Function. It's *event-triggered* — it runs automatically when an order is created or updated, or when a shopper's status changes — so the phone isn't involved in the decision at all. It just finds out the result live, through the Realtime subscriptions from section 10.

**Why event-triggered, not called by the app:** it takes the client out of the loop entirely. The app can't forget to call it, call it twice, or call it with the wrong information.

**One subtle design point worth calling out:** the Function's own writes trigger new events, which run the Function again. That sounds like an infinite loop — so every handler only acts on records in a specific *temporary* state (like "waiting and unassigned"), and every write moves the record *out* of that state. The follow-up run looks, finds nothing to do, and stops. That was verified by watching the execution logs, not just reasoned about.

**Two bugs standing it up**, both good examples of "the documentation didn't say":
1. The Function's database permissions needed a scope called `documents.read`/`documents.write` — the obviously-named `databases.read`/`databases.write` weren't enough to touch the actual records.
2. Appwrite registered the Function's triggers under one naming format but *delivered* events under a newer, different one, so the Function ignored real events. Fixed by matching on the collection name itself, so either format works.

---

## 12. Phase 6, part 2: The arrival hand-off — and being corrected

`[SCREEN: ArrivalNotificationModal on the shopper emulator]`

This section is worth including partly *because* it starts with a mistake.

**What I built first:** when a customer taps "I've Arrived," every on-duty shopper got the same notification toast — treating it like the shared check-in queue.

**What was actually right:** based on how the real app works, the arrival should go to **one specific shopper** — whoever shopped that order — as a prompt they have to accept or decline. If they don't respond within 60 seconds, they're marked unavailable and the hand-off goes to the next free shopper.

> "I'd built a reasonable design for the wrong requirement. The lesson I took isn't 'ask more questions' in the abstract — it's that I'd assumed a notification pattern from a similar-looking feature instead of checking how the real thing behaves. The fix took a day; building the wrong thing well could have taken much longer to notice."

**Why the timeout had to live on the server:** a countdown timer inside the app stops the moment the shopper's phone locks or the app is closed — exactly when the timeout matters most. So the same Function gained a schedule: every minute, it sweeps for arrivals that have waited too long.

**In plain terms:** a *cron schedule* is a "run this every X" timer that lives on the server. The catch is that it can't run more often than once a minute, so a 60-second timeout is actually detected somewhere between 60 and 119 seconds — a real limitation, and one I'd rather state than hide.

**Three bugs found only by testing it live** — pick one or two for time:
1. **A timeout could corrupt a completed order.** When a shopper was marked unavailable, their "current order" was released back to the queue — without checking whether that order was already finished. A stale pointer could have turned a completed order back into a new, unclaimed one. Fixed by checking the order's status first.
2. **Declining could hand the arrival straight back to you.** Declining doesn't make a shopper unavailable, so they'd still look free — and the reassignment could pick them again. Fixed by recording who declined and excluding them.
3. **A prompt could outlive the arrival it referred to**, throwing a raw error on tap. Now treated as a quiet no-op.

---

## 13. Phase 6, part 3: Locking the database

`[SCREEN: DECISIONS.md "Permission tightening complete" entry, then a terminal showing the 401]`

This is the strongest engineering story in the project. Set it up simply:

> "Moving decisions to the server in section 11 had a catch. The Function was making the right decisions — but the database still let *any* app write *any* order directly. The Function's rules were a convention everyone happened to follow, not something anything enforced. A rule that can be skipped isn't really a rule."

**In plain terms:** it's like hiring a security guard for the front door but leaving the side door unlocked. The guard does their job perfectly, and it doesn't matter.

**Why this was a big job, not a settings change:** Appwrite's permissions are all-or-nothing per collection — there's no way to say "shoppers can update *this* field of an order but not *that* one." So removing write access from the app meant *every* change the app still made had to move into the Function first: claiming an order, marking items found, approving a substitution, cancelling — **13 separate server actions** in all.

**How the server knows who's asking:** the app sends a short-lived signed token (a JWT) with each request, and the Function verifies it with Appwrite before doing anything. Then — separately — it checks whether that person is *allowed* to do this: is this actually your order? Are you the shopper this arrival was sent to?

**In plain terms:** the JWT is like a wristband at a concert — it proves who you are and that you got in legitimately. But having a wristband doesn't mean you can go backstage. *Authentication* is proving who you are; *authorization* is checking what you're allowed to do. They're separate checks, and you need both.

**The rollout order was the design:** build all 13 actions and switch the app over to them one at a time *while the old write access was still open* — so a mistake meant "this button doesn't work yet," easily reverted, not "the app is broken." Only once all 13 were live-verified was write access removed — one collection at a time, least critical first, testing the full flow after each.

`[DEMO: a direct write attempt returning 401 Unauthorized, then the same change succeeding through the app]`

**A testing gotcha that's a great 30-second story:** the first enforcement test "passed" — the write went through with a 200 OK. Alarming. It turned out Appwrite skips the permission check entirely when an update changes *nothing* — it was sending the same values the record already had. A real test has to actually change something. Otherwise you get a false result in either direction.

**One more honest detail:** after the lock, a verification pass re-tested the four paths that had only been reasoned about, not observed. It found one real bug (a race between two realtime events that re-opened the arrival prompt after a decline) and two hardening gaps, all fixed and re-verified.

> "Before this, every permission check in the Function was advisory. Now Appwrite itself rejects anything that doesn't go through them. That's the difference between a rule and a suggestion."

---

## 14. What's still open

`[SCREEN: README roadmap section, then the "Open issues from a system-design review" entry in DECISIONS.md]`

Be direct: this is unfinished, and knowing *exactly* how it's unfinished is the point of this section.

> "Anyone can point at a finished feature. Being able to explain why something isn't built yet, what could go wrong because of it, and what it would take to fix, is the more useful signal."

**Known gaps from a system-design review** — the ones worth naming on camera:
- **The server can still race with itself.** Moving decisions into one Function cut the number of decision-makers from "every phone" to "one place" — but that one place can run several copies at the same moment. Two shoppers tapping Claim at the same instant can both pass the "is this still available?" check before either saves. The fix is a database transaction or a conditional write, and it's the next thing I'd build.
  **In plain terms:** the check ("is it free?") and the action ("take it") need to happen as one step that nobody can squeeze in between.
- **Some updates can stop halfway.** Assigning an order updates two records separately; a crash between them leaves them disagreeing. Same fix (transactions), or a regular cleanup job that finds and repairs mismatches.
- **Reads are still wide open.** I locked who can *change* data, but not who can *read* it — anyone can currently list every order, including addresses. It's all test data, so nothing real is exposed, but in production this would be the first thing to fix, using row-level permissions.
- **The app still sets a few things the server should,** like the order total and arrival timestamps — both should be calculated on the server.
- **Testing is mostly manual.** Everything was verified live on two emulators, which is thorough but slow. The Function's rules are the best candidates for automated tests.

**Features deliberately deferred:**
- **Proximity check-in and a staff lot map** — notify shoppers only when a customer is actually within 100 meters of *this* store's pickup area (the nearest competing pickup lot is 356 meters away), decided on the server from background location. Fully planned, including a testing strategy — and postponed, because background location on Android is its own large project.
- **Multi-order pickup consolidation** — the "two hand-offs for one trip" problem from the intro. No data-model support yet.
- **Structured parking-spot selection** — the free-text problem from the intro.
- **Visual polish** — product images and UI improvements are what I'm working on next.

---

## 15. Close / call to action

`[SCREEN: back to the app, maybe the DECISIONS.md file one more time]`

> "That's the project so far — from a real frustration with an app I use every week, through the tech choices, the parts that turned out simple and the parts that turned out genuinely hard, and moving the app's decisions and its rules onto the server. It's not finished, and the list of what's next is written down in the repo. If you want the full reasoning behind any of these calls, the engineering decision log is public — link in the description. Thanks for watching."

---

## Notes to self for delivery

- **Sections 11 and 13 are the ones to rehearse most** — they're the strongest material for an engineering audience and have the most moving parts to explain without reading.
- **Say the "In plain terms" lines naturally**, as asides — "which, put simply, means…" — not as a separate lecture voice.
- Have the dual-emulator setup already running and logged in *before* recording, so you're not waiting on boot times on camera.
- **Before recording, clean up:** clear the stale `ready_for_pickup` test orders from September so demo lists aren't cluttered, and check that no test order contains your real name, address or vehicle.
- **Never show the Appwrite console's API keys or project settings on screen.** If you record the console, blur those in editing.
- A stale dev-mode "WebSocket error" toast can sit over the bottom buttons after the app idles — dismiss it before a take, or restart the app.
- Good standalone short clips: the three live-testing bugs (section 8), the "200 OK that wasn't" story (section 13), and the corrected-requirement story (section 12) — each is a self-contained 60-90 second setup/reveal/fix.
