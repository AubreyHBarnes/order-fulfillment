# YouTube Video Script: Building a Grocery Fulfillment App

**Purpose of this doc:** a speaking script/outline for a YouTube video walking through this project — why it exists, how it was built, how it answers each pain point, and what it would take to make it a real production system. Written for practicing presentation delivery, so it's closer to "notes you talk from" than "text you read verbatim." `[Bracketed cues]` are stage directions (what to show on screen, when to demo something live). Plain paragraphs are narration you can paraphrase in your own words.

**Who it's for:** the target audience is experienced engineers and hiring managers, but the script is written so a beginner can follow it too. Each technical idea gets a short **In plain terms:** line — a one- or two-sentence explanation you can say out loud before moving on. Experienced viewers lose nothing (it's a few seconds each), and it shows you can explain your own work clearly, which is a skill interviewers look for in its own right. Skip any that feel redundant once you're comfortable.

**Framing for the whole video:** this is a work in progress, not a finished product. Say so up front and mean it — the unfinished parts are presented as deliberate, documented next steps and become talking points, not apologies.


**Estimated total runtime:** roughly 40 minutes with live demos; per-chapter timings need re-estimating now that the script is regrouped. If you need to cut time, shorten Part 2 (sections 4-8) first. Sections 9-13 and 17 are the strongest material for an engineering audience.

**How the script is organized (regrouped 2026-11-22):** four parts. Part 1 is the hook and the pain points. Part 2 is how it was built, in the order the engineering happened, with the cross-cutting stories (schema drift, races, locking the database) that don't belong to any one pain point. Part 3 takes each pain point in detail, and each one ends with a "how production systems handle this, and where mine stops" comparison. Part 4 is the cross-cutting "what it would take to make this a real production system" section. **Sections marked `[TO DRAFT]` are outlined but not yet written.**

---

## Outline (for your own reference / video chapters)

**Part 1: Why**
1. Cold open / hook
2. Why this project exists, and the pain points overview

**Part 2: How I built it**
3. Tech stack and why each piece was chosen
4. Foundation and auth
5. Customer shopping experience + pickup time slots
6. Assignment logic + the schema-drift debugging story
7. The shopping workflow + bugs only live testing caught
8. Closing out placeholders: drop-offs, check-ins, settings
9. From polling to Realtime
10. Moving the decisions to the server
11. The arrival hand-off, and being corrected
12. Locking the database, and the production drift story

**Part 3: The pain points in detail**
13. Pain point #1: GPS, ETA and arrival (proximity check-in, gather alert, parking spots, manual fallback; plus how production apps typically handle GPS)
14. Pain point #4: nothing tells anyone when priorities change (the rush-order deep dive)
15. Pain point #5: duplicate and mistimed notifications (plus how notification systems are meant to prevent this)
16. Pain points #6 and #3: designed, not built (and the one I dropped)

**Part 4: Production**
17. From portfolio app to production system
18. Close / call to action

---

# PART 1: WHY

## 1. Cold open / hook

`[SCREEN: app running in the dual emulator setup — customer on one side, shopper on the other]`

Open on something visual and concrete before any talking-head explanation — the rush-order interrupt actually happening live: place a rush order as the customer, watch the shopper's screen get the interrupt modal a second or two later.

> "This is a shopper mid-order getting bumped onto a rush order automatically — no refresh, no manual dispatch. Nobody's phone made that decision; a function running on the server did, and pushed the result to the shopper's screen live. I'm going to walk through how this app is built, why I built it, and honestly, some of the bugs I only found by breaking it live. One thing up front: this is a work in progress. It's not finished, and I'll be specific at the end about what's still open and what I'd build next."

---

## 2. Why this project exists

`[SCREEN: talking head or slides, no app yet]`

This is the section to make personal and specific — don't generalize to "online grocery shopping is convenient." Name the actual friction points you've hit as a Whole Foods pickup customer, since those are the ones this project explicitly tries to answer:

- **#1: The ETA jumps around and doesn't mean anything.** You'll watch the in-app "shopper is 2-3 minutes away" estimate bounce up and down, sometimes while you can see you're still half a mile out. That's a GPS-accuracy problem more than a software bug — consumer GPS in a dense retail lot is commonly off by 30-100+ feet — but it's the kind of thing worth understanding *why* it happens before trying to build something similar. Related: the app tells you to tap "I'm on my way" at five minutes out, which is a poor signal when pickup time and traffic can't be predicted.
- **#3: When you have more than one order ready, there's no single pickup.** You end up doing two separate handoffs for what should be one trip to your trunk. This project's data model doesn't solve that yet — flagged as a real, larger feature gap.
- **#4: Nothing tells anyone when priorities change.** If something more urgent needs to jump the queue, or a shopper needs to be redirected, that coordination doesn't happen live. This is the one this project fully *solves*, and it's the thread running through the whole video.
- **#5: Duplicate and mistimed notifications.** As the person using the seller app: the same prompt twice, an unskippable modal that throws you out of what you were scanning. Hypotheses only, since I can't see their code.
- **#6: You can't change how you receive the order.** Someone who came in for in-store pickup and later needed to rest in their car, and the shopper had to find them. A real case from my own work.
- **And one I dropped (#2):** parking-spot communication being free text, ambiguous between nearby stores' lots. The premise was wrong, since each pickup-enabled store has its own lot at a separate shopping center. Worth saying out loud: part of the process was checking my own pain points against reality and cutting the ones that didn't hold.

> "I'm not trying to rebuild Whole Foods' entire backend — this is a solo portfolio project. But every decision in it is trying to answer a real, specific piece of friction I've personally hit as a customer, and I wanted the reasoning behind each one to be traceable, not just the code."

`[SCREEN: docs/DECISIONS.md, scroll past the title/intro paragraph]`

Mention here that this project keeps a running engineering decision log, not just commit messages — and that the rest of this video is largely walking through that log: first how it was built, then each pain point, then what it would take to make this production-grade.

**In plain terms:** a decision log is a diary for the codebase. Code shows *what* the app does; the log records *why* it does it that way, what else was considered, and what was knowingly left unfinished.

---

# PART 2: HOW I BUILT IT

## 3. Tech stack and why each piece was chosen

`[SCREEN: README.md "Built With" section]`

Frame this less as a list and more as "what problem was each piece solving, and what did I get out of learning it":

- **React Native (bare, not Expo), TypeScript.** Cross-platform from one codebase, and bare RN specifically (not Expo) to actually deal with native tooling — Gradle, the Android SDK, emulators — instead of it being abstracted away. More setup pain up front, but the skills transfer to any real native RN project.
  **In plain terms:** React Native lets you write one app in JavaScript and run it on both Android and iPhone. TypeScript is JavaScript with type labels, so mistakes like passing text where a number belongs get caught before the app runs. "Bare" means I manage the Android build tools myself instead of letting a framework hide them.
- **React Native Paper (Material Design 3).** Accessible, production-styled components — buttons, dialogs, snackbars — instead of hand-building a design system. It's the direct reason later features like the interrupt modal could be built quickly.
- **React Navigation.** Two entirely different navigator stacks (customer vs. shopper) sharing the same login and theme underneath.
- **Appwrite (Backend-as-a-Service).** This is the one worth spending the most time on. Instead of writing and hosting a custom backend, Appwrite provides a database, user accounts, live updates over WebSockets, and serverless functions out of the box. The tradeoff, and it's a recurring theme: **you're working against someone else's schema, someone else's permission model and someone else's error messages**, which is a different skill than owning your backend end to end.
  **In plain terms:** a backend is the part of an app that lives on a server — the shared database and the rules about who can change what. A Backend-as-a-Service is a company that runs that part for you, so you configure it instead of building it.
- **Appwrite Functions (Node.js).** Added later in the project, and it became the most important piece — every decision about who does which order now runs here, not on anyone's phone. Section 10 covers why.
  **In plain terms:** a serverless function is a small piece of code that lives on the server and runs automatically when something happens — like "an order was just created" — without you managing a server yourself.
- **AsyncStorage.** Simple on-device storage for the cart — deliberately not a database, since a cart is per-device, temporary state.

> "None of these are exotic choices — that's kind of the point. The goal wasn't to show off an unusual stack, it was to use the stack you'd actually find at a company doing this kind of app, and go deep enough into each piece that the tradeoffs are real, not textbook."

---

## 4. Foundation and auth

`[SCREEN: quick cut through login/register screens]`

Keep this brief — it's necessary context, not the interesting part of the story:

- Phase 1: Appwrite backend configured, collections created by hand through the console, RN project scaffolded.
  **In plain terms:** a *collection* is like a spreadsheet tab in the database — one for Orders, one for Products, and so on. Each row is one record.
- Phase 2: role-based login/register (customer vs. shopper), persistent sessions, password reset.

Worth one sentence acknowledging the environment-setup pain that isn't glamorous but is real: getting a bare RN Android build working locally meant fixing a genuine Gradle/AGP version mismatch (the project was pinned to Gradle 9.0 but the installed Android Gradle Plugin only supported up to 8.13) and sorting out JDK version conflicts. That's the unglamorous 20% of any real mobile project.

---

## 5. Customer shopping experience + pickup time slots

`[SCREEN: checkout flow, time-slot picker]`

Cover product browsing/search/cart/checkout quickly, then slow down for the first *decision* worth explaining:

**Pickup time slots, scoped to pickup only.** Checkout originally hardcoded every order to "ready in 30 minutes," with no way to choose a time. The fix — a time-slot picker — was deliberately scoped to pickup orders only, leaving delivery on the old default.

> "This is a good example of a scope decision that's easy to get wrong in the direction of *more* work. It would've been tempting to build one generic 'scheduled time' picker for both — but delivery scheduling is a genuinely different problem, with delivery windows and driver ETAs, that nobody had actually asked for. Building it speculatively would've meant guessing at requirements instead of solving the one that was real."

Then the follow-up: **rush orders**, changing the normal slot grid from 30 to 60 minutes and adding a "Rush Order" toggle that targets 30 minutes out instead. Plant a seed for section 14 — mention that this is where the `priority` field first got used, and tease that reusing it (instead of adding a new field) is what made a much bigger feature "just work" later.

---

## 6. Assignment logic + the schema-drift debugging story

`[SCREEN: functions/auto-assignment/src/main.js, getNextOrderForAssignment]`

**Auto-assignment via sort order, not a routing algorithm.** When a shopper becomes free, the system takes all waiting orders, sorts them by when they're due, and hands over the most urgent one. No weighting, no scoring.

> "A real dispatch system weighs shopper proximity, current load, order age — often as its own service. I deliberately didn't build that, because the goal was to prove a *correct* assignment mechanism — find, sort, assign, save — not to reimplement a logistics-routing algorithm. And the one signal that matters most for grocery pickup is exactly the one it sorts on: whichever order is due soonest should go out the door first."

Worth one sentence of foreshadowing: at this point in the project, this logic ran *on the shopper's phone*. Section 10 is about why that had to change.

**Now the debugging story — this is a great teaching segment.** The Appwrite collections were hand-created through the console early on and drifted from what the code actually read and wrote: `shopperId` vs. the real field `shopperID`, `lastActiveTimestamp` vs. `lastActiveTimeStamp`, missing Create/Delete permissions. Shopper registration was failing, and — this is the interesting part — **the error messages actively lied.** A failed cleanup step, blocked by a missing Delete permission, surfaced as "not authorized," which hid the real capitalization bug underneath it.

**In plain terms:** a *schema* is the database's definition of what each record looks like — which fields exist, their exact names and types. "Schema drift" is when the code and the database quietly disagree about that, like the code writing to `shopperId` while the database only knows `shopperID`.

> "Debugging this one error message at a time would have taken forever, and worse, been actively misleading. What actually worked was getting the *ground truth*: I pulled every collection's real field list straight from Appwrite's API and compared it against every place in the code that read or wrote those fields. That found all four problems — two capitalization bugs, two permission gaps — in one pass instead of four separate debugging sessions."

Teaching point to state explicitly: **silent empty results are a specific hazard in query-based backends.** A query filtering on a field that doesn't exist didn't throw an error — it just returned nothing, which would have quietly broken availability toggling for every shopper without anyone seeing an error.

Also worth a line on the choice made once the drift was found: the *code* was changed to match the database, not the other way around — the database was already the de facto source of truth, and changing it risked breaking anything else already pointed at it.

---

## 7. The shopping workflow + bugs only live testing caught

`[SCREEN: ShoppingScreen checklist, substitution flow]`

Cover the core loop briefly — claim an order, work a checklist (found / out-of-stock / propose substitute with customer approval), complete it — then spend real time on **three bugs found only by running the flow, not by the type checker or linter**:

**In plain terms:** a *type checker* and a *linter* are tools that read your code without running it and flag mistakes. They're good at catching typos and mismatched types, but they can't know what's actually in the live database.

1. **Search had been silently broken since an earlier phase.** It relied on a full-text search index on Products that had never been created — every search failed, logged to a console nobody was watching.
2. **An entire order status could never be reached.** The code and UI had included `ready_for_pickup` for a while, but the database's list of allowed status values was never updated to include it — so the first live attempt failed outright.
3. **Claiming a second order could orphan the first.** Nothing checked whether a shopper already had an order in progress, so the first one kept its shopper assignment but nothing pointed back to it anymore — it became unreachable.

> "The theme across all three: type-checking tells you your code agrees with itself. It says nothing about whether the live database, its indexes, or its data agree with what your code assumes. The only way these surfaced was running the real flow against the real backend."

Good spot to show the **dual-emulator setup** if you haven't already — two independent Android emulators, one signed in as a customer, one as a shopper, so you can watch both sides update in real time. One sentence on why: logging out and back in on a single device can't show *simultaneity* — by the time you've switched accounts, you can't tell if something updated live or just loaded fresh.

---

## 8. Closing out placeholders

`[SCREEN: Drop Offs / Customer Check-ins / Shopper Settings screens]`

Quick pass through finishing the last placeholder screens:

- **Customer Check-ins is store-wide** — any on-duty shopper sees every waiting customer, like a real curbside desk. (Section 11 revisits how the *notification* for an arrival works — that one I got wrong the first time.)
- **Drop Offs needed a status that didn't exist yet** — delivery orders jumped straight from `shopping` to `completed`, so a new `out_for_delivery` status was added to give the screen something real to act on.
- **A second, more severe schema-drift bug**, this time on `CustomerArrivals`: required fields the database enforced (arrival times, `parkingSpot` as a required number 1-5) didn't match what the code sent, breaking the customer's "I've Arrived" button outright. Same resolution as the first drift story: fix the code to match the live schema.

Loop back to the intro: `parkingSpot` being a required number 1-5 on the real schema is why the field was clamped to match the schema rather than redesigned during a bug fix. The 1-5 picker was built later, purely as a usability change (buttons instead of typing), not to solve ambiguity, since no other pickup lots share this one. Section 13 covers it.

---

## 9. From polling to Realtime

`[SCREEN: src/services/realtimeService.ts, then the substitution round trip live on both emulators]`

This is where the "temporary" polling from section 14 got replaced — and the interesting part is *how* the decision was made.

> "Twice, I'd set Realtime aside because the SDK's React Native behavior was 'unverified.' The third time, I realized that if I kept writing 'unverified' without ever testing it, it would become a permanent excuse instead of a real blocker. So instead of reasoning about it, I ran an experiment."

**The spike:** a throwaway listener, mounted on both emulators for over a minute — through several heartbeat cycles, backgrounding and foregrounding the app, and writes from one device observed on the other. The feared crash never happened. Events arrived in 1-4 seconds, reliably.

**In plain terms:** a *spike* is a small, disposable experiment whose only job is to answer a question — "does this actually work here?" — before you commit to building on it. You throw the code away and keep the answer.

**The decision:** replaced 8-second polling with live subscriptions at all 8 places that had it, centralized in one service file. Two facts about Appwrite Realtime shaped every screen, and both are worth explaining to an engineering audience:

1. **No server-side filtering.** Subscribing to Orders delivers *every* order's changes, project-wide. Each screen filters for its own records. (That was true at the time. Since then, row-level permissions on Orders mean Appwrite only delivers an order's events to its customer and the shoppers Team — section 12 covers it.)
2. **No replay after a disconnect.** If the connection drops — a network blip, or the app going to the background — any changes during that gap are simply gone. So the app does a fresh fetch after every reconnect and every time it comes back to the foreground.
   **In plain terms:** it's like a live radio broadcast, not a podcast. If you step away, you miss that part — so when you come back, you have to check the news to catch up.

> "I deliberately didn't add a backup poll 'just in case.' If the live connection is broken, I'd rather the data visibly go stale than have a timer quietly paper over it with data that looks live but isn't. A problem you can see is a problem you can fix."

**A small, satisfying fix worth one minute:** the spike did find one real SDK problem — the SDK reads browser-only storage that doesn't exist in React Native, in two places where the SDK's own authors had forgotten a safety check they'd added everywhere else. Rather than hide the warning, I patched those two lines using `patch-package`, which reapplies the fix automatically on every install.

**In plain terms:** `patch-package` lets you make a small fix to someone else's library and keep it in your project, so it isn't lost the next time the library gets reinstalled.

`[DEMO: shopper proposes a substitution → customer's screen shows it live → customer approves → shopper's screen updates — no refresh on either side]`

---

## 10. Moving the decisions to the server

`[SCREEN: functions/auto-assignment/src/main.js — the header comment, then a handler]`

This is the architectural turning point of the project. Explain the problem first, because it's not obvious until you see it:

> "Up to this point, every phone was making assignment decisions. When a shopper went available, *their phone* looked at the order queue and assigned itself an order. Which works fine with one shopper. With five, you have five phones all reading the same queue at the same time, each deciding on its own — and nothing stops two of them from grabbing the same order."

**In plain terms:** that's called a *race condition* — two actors racing to change the same thing, where the result depends on who happens to get there first. It almost never shows up in testing with one user, and shows up constantly in production with many.

There's a second problem, about **trust**: if the phone makes the decision, anyone who can modify the app — or skip it and call the database directly — can make whatever decision they want.

**The decision:** all assignment logic moved into one Appwrite Function. It's *event-triggered* — it runs automatically when an order is created or updated, or when a shopper's status changes — so the phone isn't involved in the decision at all. It just finds out the result live, through the Realtime subscriptions from section 9.

**Why event-triggered, not called by the app:** it takes the client out of the loop entirely. The app can't forget to call it, call it twice, or call it with the wrong information.

**One subtle design point worth calling out:** the Function's own writes trigger new events, which run the Function again. That sounds like an infinite loop — so every handler only acts on records in a specific *temporary* state (like "waiting and unassigned"), and every write moves the record *out* of that state. The follow-up run looks, finds nothing to do, and stops. That was verified by watching the execution logs, not just reasoned about.

**Two bugs standing it up**, both good examples of "the documentation didn't say":
1. The Function's database permissions needed a scope called `documents.read`/`documents.write` — the obviously-named `databases.read`/`databases.write` weren't enough to touch the actual records.
2. Appwrite registered the Function's triggers under one naming format but *delivered* events under a newer, different one, so the Function ignored real events. Fixed by matching on the collection name itself, so either format works.

---

## 11. The arrival hand-off, and being corrected

`[SCREEN: ArrivalNotificationModal on the shopper emulator]`

This section is worth including partly *because* it starts with a mistake.

**What I built first:** when a customer taps "I've Arrived," every on-duty shopper got the same notification toast — treating it like the shared check-in queue.

**What was actually right:** based on how the real app works, the arrival should go to **one specific shopper** — whoever shopped that order — as a prompt they have to accept or decline. If they don't respond within 60 seconds, they're marked unavailable and the hand-off goes to the next free shopper.

> "I'd built a reasonable design for the wrong requirement. The lesson I took isn't 'ask more questions' in the abstract — it's that I'd assumed a notification pattern from a similar-looking feature instead of checking how the real thing behaves. The fix took a day; building the wrong thing well could have taken much longer to notice."

**Why the timeout had to live on the server:** a countdown timer inside the app stops the moment the shopper's phone locks or the app is closed — exactly when the timeout matters most. So the same Function gained a schedule: every minute, it sweeps for arrivals that have waited too long.

**In plain terms:** a *cron schedule* is a "run this every X" timer that lives on the server. The catch is that it can't run more often than once a minute, so a 60-second timeout is actually detected somewhere between 60 and 119 seconds — a real limitation, and one I'd rather state than hide.

**An honest update on that sweep:** it isn't running in production right now. The Appwrite plan no longer allows cron schedules, and the live schedule was cleared on October 19 — so the timeout and reassignment described here work in the code and were verified when the schedule existed, but a shopper who ignores a prompt currently isn't timed out. Nothing errored when it stopped; I only found out when a deploy was rejected (section 12 tells that story). Restoring it is an open item.

**Three bugs found only by testing it live** — pick one or two for time:
1. **A timeout could corrupt a completed order.** When a shopper was marked unavailable, their "current order" was released back to the queue — without checking whether that order was already finished. A stale pointer could have turned a completed order back into a new, unclaimed one. Fixed by checking the order's status first.
2. **Declining could hand the arrival straight back to you.** Declining doesn't make a shopper unavailable, so they'd still look free — and the reassignment could pick them again. Fixed by recording who declined and excluding them.
3. **A prompt could outlive the arrival it referred to**, throwing a raw error on tap. Now treated as a quiet no-op.

---

## 12. Locking the database, and the production drift story

`[SCREEN: DECISIONS.md "Permission tightening complete" entry, then a terminal showing the 401]`

This is the strongest engineering story in the project. Set it up simply:

> "Moving decisions to the server in section 10 had a catch. The Function was making the right decisions — but the database still let *any* app write *any* order directly. The Function's rules were a convention everyone happened to follow, not something anything enforced. A rule that can be skipped isn't really a rule."

**In plain terms:** it's like hiring a security guard for the front door but leaving the side door unlocked. The guard does their job perfectly, and it doesn't matter.

**Why this was a big job, not a settings change:** Appwrite's permissions are all-or-nothing per collection — there's no way to say "shoppers can update *this* field of an order but not *that* one." So removing write access from the app meant *every* change the app still made had to move into the Function first: claiming an order, marking items found, approving a substitution, cancelling — **13 separate server actions** in all (15 now — joining the shoppers Team and creating an order were added later, for reasons covered below).

**How the server knows who's asking:** the app sends a short-lived signed token (a JWT) with each request, and the Function verifies it with Appwrite before doing anything. Then — separately — it checks whether that person is *allowed* to do this: is this actually your order? Are you the shopper this arrival was sent to?

**In plain terms:** the JWT is like a wristband at a concert — it proves who you are and that you got in legitimately. But having a wristband doesn't mean you can go backstage. *Authentication* is proving who you are; *authorization* is checking what you're allowed to do. They're separate checks, and you need both.

**The rollout order was the design:** build all 13 actions and switch the app over to them one at a time *while the old write access was still open* — so a mistake meant "this button doesn't work yet," easily reverted, not "the app is broken." Only once all 13 were live-verified was write access removed — one collection at a time, least critical first, testing the full flow after each.

`[DEMO: a direct write attempt returning 401 Unauthorized, then the same change succeeding through the app]`

**A testing gotcha that's a great 30-second story:** the first enforcement test "passed" — the write went through with a 200 OK. Alarming. It turned out Appwrite skips the permission check entirely when an update changes *nothing* — it was sending the same values the record already had. A real test has to actually change something. Otherwise you get a false result in either direction.

**One more honest detail:** after the lock, a verification pass re-tested the four paths that had only been reasoned about, not observed. It found one real bug (a race between two realtime events that re-opened the arrival prompt after a decline) and two hardening gaps, all fixed and re-verified.

> "Before this, every permission check in the Function was advisory. Now Appwrite itself rejects anything that doesn't go through them. That's the difference between a rule and a suggestion."

### Locking reads too: Orders row security

`[SCREEN: DECISIONS.md "Issue #5" entries]`

Writes were locked, but reads weren't — anyone could list every order, addresses included. Appwrite can scope reads per *row* instead of per collection, so each order is stamped with exactly two readers: its customer and a `shoppers` Team. That forced one more move into the Function: order *creation* had to become a server action (`createOrder`), because only the server can stamp those permissions safely.

**In plain terms:** instead of one lock on the whole filing cabinet, each folder gets its own lock — the customer has a key to their folder, and the shoppers' team has a key to all of them.

The server now owns every identity field on a new order and ignores whatever the app sends. Verified live by sending a forged order — someone else's customer ID, `status: completed`, a claim lock already set, an order date in the year 2000 — and getting back an order with the caller's real ID, `pending`, no lock, and the server's clock. The old client-side version had actually allowed backdating an order to jump the queue.

The flip itself was scripted with checks built in and an automatic rollback to the recorded previous state if any failed. Results: a guest sees 0 rows, a customer sees only their own orders (64 of 72) and gets a 404 on anyone else's, a direct write gets a 401, and a shopper sees all 72. One honest caveat: the "shopper sees pending orders" check passed vacuously — there were no pending orders at the time. The in-app dual-emulator pass is still to do.

### The production drift story (a great 60-90 second clip)

`[SCREEN: DECISIONS.md "Deploy gap and the lost cron schedule"]`

> "Before flipping that switch, I did a pre-flight — and part of it was downloading the Function that was actually live and diffing it against my repo. They didn't match."

- **The deploy gap.** `createOrder` was committed on `main` and marked done. But the live Function was an October 17 build from the proximity feature branch: it had the trip actions and no `createOrder`. Checkout on `main` would have failed against production — and deploying `main` as-is would have silently deleted the trip actions. Both choices broke something. The fix was merging `main` into the proximity branch, resolving two conflicts (keep both sides of the action switch; keep the branch's response shape so the trip reporter's reads still work), and deploying from there.
- **The schedule that vanished.** The first deploy attempt failed with `403 billing_feature_unsupported` — the plan no longer allows cron. The live schedule had been cleared on October 19, so the every-minute sweep (arrival timeouts, reassignment, stale-trip expiry) had silently not run in production for three days — and still isn't. Nothing errored, because everything triggered by events or HTTP calls kept working. The deploy script now warns loudly and reports the schedule that's actually live instead of echoing the one requested.

**In plain terms:** a *deployment* is the copy of the code that's really running on the server. It can quietly differ from the copy in your repository — like editing a recipe in your notebook while the restaurant kitchen is still cooking from the old card.

> "The lesson: 'done' for a server change means deployed *and* exercised live — and before any step that depends on production, check what's actually running against what's in the repo. Type checks, tests, and a green commit can't tell you that."

Same theme as sections 7 and 11 — the gap between what your code assumes and what the live system actually is — now applied to deployed code, not just the database.

---

# PART 3: THE PAIN POINTS IN DETAIL

## 13. Pain point #1: GPS, ETA and arrival

`[SCREEN: DECISIONS.md "Proximity check-in and the staff lot map", then the OnMyWayCard on the customer emulator]`

This answers the first frustration from section 2 — the meaningless "2-3 minutes away." The original plan was background location. The version actually built is deliberately smaller: **foreground-only** — the customer opens an "On my way" card on a ready pickup order, and while the app is on screen, location readings are sent to the server.

> "The phone is a sensor; the server decides. The app never says 'I've arrived.' It reports where it is, and the server decides whether that counts."

**How the server decides:**
- The pickup area is a real 4-point polygon of the lot, not a simple radius, with a 100-meter buffer — the nearest competing pickup lot is 356 meters away.
- **A speed gate:** a reading inside the buffer but moving at road speed (~8 m/s or more) is ignored, so driving past on the road doesn't trigger anything.
- **Two inside readings** (the zone's `requiredInsideReadings`) are required before it counts as arrived — one noisy GPS fix can't do it. An outside reading resets the count.
- **Untrustworthy readings are dropped** — mocked locations, implausible jumps, and poor accuracy never change the count.
- **A known limit, stated plainly:** a car stopped at a light *inside* the buffer has speed 0, passes the speed gate, and can count as arrived. The fixes are a tighter buffer or a polygon drawn tight to the lot.
- On arrival the server creates the same "Auto check-in" arrival the manual button would have, and the card flips to "Staff Has Been Notified."

**In plain terms:** a *geofence* is a virtual boundary around a place. The interesting part isn't drawing it — it's deciding what counts as *really* being inside, given that consumer GPS can be off by 30-100+ feet.

**Verified three ways:**
1. Pure-logic tests with fixture trips (the zone math and the trip rules, no network).
2. A live script run as a real test customer, against the real Function: 400/250/150 m → outside; 90 m moving fast → ignored; 60 m → inside; 40 m → arrived, exactly one arrival created. A shopper couldn't read the trip before arrival and could after.
3. The emulator, replaying GPS fixes with `adb` — including a fast leg that stays *inside* the buffer without ever arriving, then a slow leg that does. That's the competitor-lot demo in miniature.

`[DEMO: replay the emulator route — fast drive-past does nothing, slow approach flips the card to "Staff Has Been Notified"]`

**A bug only the live run caught:** the stored zone polygon was invalid JSON. A line-wrapped paste had put newlines inside the numbers and split one coordinate in two, so every location report would have thrown. The unit tests never saw it because they use fixture polygons. Fixed in place; the rule going forward is that anything that writes the polygon must parse it first. Another "type-checking can't see the live data" story.

**Also hit:** the Appwrite project had auto-paused after inactivity (403 `project_paused`). Worth checking before any demo.

**What this version is not:** it stops when the screen locks or the app goes to the background — by design, and documented. Background tracking, the staff lot map, a per-reading log for reviewing real drives, and the real-phone field test (the checklist is written; it hasn't been run) are all still open — section 17.

### Built since: the gather alert, parking-spot buttons, and the manual fallback

`[SCREEN: DECISIONS.md "Gather alert by ETA", then the shopper's Customer Check-ins screen]`

Arrival at 100 m gives a moving car only about ten seconds of warning, which is too little for a shopper to start gathering items. So the design separates two signals: a **gather alert** (the customer is about to arrive) and **arrival** (the customer is at the lot).

- **The rule:** ETA is straight-line distance to the lot divided by the customer's smoothed measured speed, with no routing API. The alert fires once, when the ETA is under 90 seconds on two readings in a row, the distance is shrinking, and the customer is actually moving. A parked car has no ETA, so it never triggers.
- **Where it lives:** the same server Function that decides arrival. It stamps a timestamp on the order and nothing else, so the shopper never sees the customer's location.
- **What the shopper sees:** an "Arriving soon" list on Customer Check-ins, the source of truth, plus one toast per order. It is deduped on purpose, which ties it to pain point #5 (section 15).
- **Parking spot:** five buttons for spots 1-5 plus "No spot available" (the lot can be full while the customer waits in it).
- **Manual fallback:** if location can't be shared, the customer can still tap "Tell the store I'm on my way". The server stamps a separate timestamp, the shopper sees a row with no toast, and it can never fire the gather alert.
- **Verified:** unit tests on the ETA decision; a live run against the deployed Function; the shopper emulator showing the toast and the list updating over realtime. **Not verified:** a real phone on a real drive. The 90 seconds, two readings and smoothing are starting guesses until then.
- **A failure I can demonstrate:** a car on the road driving toward the lot fires the alert early but never arrives, because straight-line distance can't see the road. It's pinned in a test and written in the decision log.

### How production apps typically handle GPS, and where this one differs

`[SCREEN: a two-column slide, "Typical production approach" vs "This app", then back to DECISIONS.md "Gather alert by ETA"]`

**Say this first, on camera:** "I haven't seen the inside of any retailer's app. What follows is how the platforms document that this is *meant* to be done, plus what I've felt as a customer. Where a real app differs, I'd like to hear it."

That sentence matters: everything in the left column below comes from Apple's and Google's own location documentation and general industry practice, not from any company's source code. Don't attribute a specific technique to a named retailer unless you have a source for it.

| | Typical production approach (platform-documented) | This app |
|---|---|---|
| **Where "arrived" is decided** | On the phone: the OS watches a circular region and wakes the app on entry (iOS region monitoring, Android `GeofencingClient`); the app then tells the backend "customer is here". | On the server. The phone only reports readings; the Function decides. The client can't declare arrival. |
| **App closed or screen off** | Works. OS geofencing and significant-change updates run without the app open, and are far kinder to the battery. | Foreground only: it stops when the screen locks. This is the biggest gap, and it is documented as open. |
| **Shape and size** | A circle. Android's docs recommend a radius of at least 100 m for best results (Apple documents no minimum; developers report about 100 m in practice), so the trigger fires well before the lot. | A real polygon of the lot plus a 100 m buffer, tunable in the database without an app release. |
| **Noisy GPS** | Mostly left to the OS's fused location (GPS + Wi-Fi + cell). Entry events can arrive late (Android's docs say a backgrounded app is told about geofence events only every couple of minutes on Android 8+), and the usual safety net is a manual "I'm here" button. | Two inside readings in a row, a speed gate, and rejection of mocked, jumpy or inaccurate fixes. The manual buttons stay as the fallback. |
| **"How far away are they"** | Commonly a routing service with live traffic, run from the phone or the server, which is why those ETAs follow the road. | Straight-line distance divided by smoothed measured speed, with no routing API. Traffic is already inside the measured speed. |
| **Permissions and policy** | Needs background location: on Android 10+ the app can't read location in the background without the separate `ACCESS_BACKGROUND_LOCATION` permission, plus store policy review. Apple limits an app to 20 monitored regions at once. | Foreground location only, so there is no background prompt and no foreground service to justify. |
| **Trust** | The client claims arrival, so the same trust as a button. | The client submits facts and the server concludes. It still can't defeat a deliberately spoofed GPS, which the log says out loud. |

**The honest ledger (this is the strong part of the segment):**
- **Where production is simply ahead:** background operation, battery efficiency, and road-aware ETA. Those are real gaps, and the right framing is "built the smaller version first and wrote down what it can't do."
- **Where this design is deliberately different:** the arrival rule lives on the server and is tunable per store, and the gather alert is a separate signal from arrival, so the shopper gets lead time instead of a ten-second warning.
- **The failure I can demonstrate:** a car driving past on the road toward the lot fires the gather alert early but never arrives. Straight-line ETA can't see the road. That is exactly where a routing API earns its cost, and `DECISIONS.md` says to revisit it only if measured-speed ETA proves too noisy on a real drive.

`[DEMO: emulator route replay, approach from the north at 6 m/s - the shopper's "Arriving soon" row and toast appear about 90 s out, before the arrival; then the drive-past route showing the early alert and no arrival]`

**Sources checked (2026-11-22):**
- Android, [Create and monitor geofences](https://developer.android.com/training/location/geofencing): 100 m minimum-radius recommendation; `ACCESS_FINE_LOCATION` plus `ACCESS_BACKGROUND_LOCATION` on Android 10+; background apps get geofence events about every couple of minutes on Android 8+.
- Android, [Background location limits](https://developer.android.com/about/versions/oreo/background-location-limits): why background updates are throttled.
- Apple, [Region Monitoring and iBeacon](https://developer.apple.com/library/mac/documentation/UserExperience/Conceptual/LocationAwarenessPG/RegionMonitoring/RegionMonitoring.html) (archived guide): at most 20 regions monitored per app. It's an old page, so confirm against the current Core Location docs.
- **Not found in an official source:** an Apple minimum geofence radius. The ~100 m figure for iOS comes from a developer-forum observation (thread 769113 era posts), so say "developers report" and not "Apple requires". Any third-party vendor numbers (e.g. 150 m, 100 geofences) are vendor advice, not platform limits.

**Before filming, verify:** (1) the sources above once more, since platform behavior changes and the Apple page is archived; (2) any claim about a specific retailer, which should be something you observed ("in my experience the app asks me to tap when I'm close"), not a claim about how it works inside; (3) the real-phone drive test, so the demo uses a real route and not only the emulator.

---

## 14. Pain point #4: nothing tells anyone when priorities change (the rush-order deep dive)

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

> "Push notifications over WebSockets were the plan from day one, and I looked at them here — but the SDK had some React Native behavior I couldn't vouch for yet. Polling was slower, up to 8 seconds late, but it used code I'd already proven worked. I picked predictability over speed, on purpose, and wrote down that it was a temporary choice. Section 9 is where I came back and replaced it."

**Then tell the bug story from testing this live** — a concrete example of "type-checking doesn't save you from a live schema": the first interrupt reason was a dynamic string (`Interrupted for rush order ${orderId}`), which failed on save because the live database caps `interruptReason` at 40 characters. TypeScript said `string`, which is true and says nothing about a server-side length limit. Caught immediately in a live two-emulator test, fixed to a short fixed string.

`[DEMO: the full interrupt flow — two busy shoppers, place a rush order, show the modal landing on whichever shopper had the furthest-out order]`

### The reuse callback: accept/decline

When a shopper gets auto-assigned an order, they see an accept/decline prompt instead of it silently becoming their task. The interesting choice: **decline didn't need its own code path.** "Auto-assigned, then declined" ends in exactly the same state as "went available, then went unavailable" — same order, same shopper, same release back to the queue — so decline reuses that path.

> "When two user actions produce the same underlying state change, you don't need two code paths for it. Writing a second one just to feel purpose-built would've been two ways to do one thing."

### How production systems handle this, and where this one stops `[TO DRAFT]`

Same pattern as sections 13 and 15: what well-documented systems do, then an honest ledger. Starting points that come from this repo, not from any outside claim:
- **Built:** one priority signal, an idle-first-then-furthest-due interrupt rule, a live modal, and decline reusing the release path.
- **Gaps to state:** the interrupt reaches only a shopper with the app open (no push); `priority` is effectively a yes/no flag; the choice of whom to interrupt is a single rule with no cost model.
- **To research before drafting:** how published dispatch systems pick whom to reassign (see the dispatch material in section 17), and what the platforms document for urgent, time-sensitive alerts. Cite only what is sourced.


---

## 15. Pain point #5: duplicate and mistimed notifications

`[SCREEN: talking head, then the Arriving soon list and the once-per-order toast on the shopper emulator]`

**A frustration from the production app, not reproduced in this one.** Talking point, not a feature. Three cases from my own use of the app:
1. **No assigned order:** a new-assignment modal and a toast both appear. Accepting through either works, but right after, a second toast and sound say there's an order to accept, when I already accepted.
2. **Mid-order, a customer arrives:** an unskippable modal (OK only) starts the drop-off steps, and I set my current order aside.
3. **During those staging steps or the pickup scan:** another unskippable "order ready to pickup" modal appears, and OK sends me to the home screen. I then have to navigate back to the order I was scanning, which wastes time.

I can't see their code, so these are hypotheses, ranked by how well they fit "identical, seconds later, after I accepted":
1. **A level-triggered rule instead of an edge-triggered one.** *Level* means "notify whenever an order is assigned to me" — every update while I own it matches again, including my own accept. *Edge* means "notify when the assignee *changes to* me" — it fires once, at the transition. Accepting writes to the same record, so a level rule re-notifies. This fits the delay best.
2. **A retry timer that doesn't know about the accept.** The server's "no response in N seconds, re-send" timer fires even though the ack was slow or lost.
3. **Two delivery channels with no shared dedup.** The modal and the toast (or a device notification via OS push) both fire for one event, and neither knows about the other.
4. **At-least-once delivery without idempotency.** Push services and job queues may deliver twice and expect the client to dedupe by a stable ID.
5. **Reconnect replay** — less likely given how consistent it is.

The fixes, in the same order: make triggers edge-based (compare old and new document); cancel the retry timer in the same transaction as the accept, and have re-sends check current state first; give every notification a stable ID like `orderId:assignmentVersion` and drop IDs already seen, suppressing push when the app is foregrounded; and make the tap handler a no-op if the target is already the active screen, otherwise deep-link straight to it instead of resetting to home.

**Tell them apart:** compare the two notifications' IDs and timestamps. Same ID and payload → channels or redelivery. A timestamp from *after* my accept → level trigger or retry. Whether it happens when I stay on the same screen versus backgrounding the app separates channels from state changes.

**How this app compares — honestly:**
- It has **no push channel at all** — only in-app realtime, which works while the app is open. So the two-channel duplicate can't happen here, and the flip side is that a backgrounded shopper gets nothing. That's a bigger gap against my original frustration than duplicates.
- Most flows are edge-like: the new-assignment modal only fires on the transition from no-order to has-order, and the urgent-order toast remembers the last order it announced.
- Cases 2 and 3 above are the other kind of problem: a notification that moves you away from work in progress. Here the arrival modal can be declined and times out, but *accepting* an arrival navigates to Customer Check-ins regardless of what the shopper was doing. Gentler than an unskippable modal, but the same class.
- The arrival handler is the exception — it's closer to level-triggered, with no memory of arrivals it already showed. It's guarded only because those updates are rare. A seen-ID check is a few lines; I haven't added it.

> "I found and fixed a version of this class of bug already — a declined arrival reopening the modal because two writes raced. The pattern is the same: the notification has to be tied to a *change*, not to a *state*."

### How notification systems are meant to prevent this, and where this app differs

`[SCREEN: two-column slide, "What the platforms provide" vs "This app", then the Arriving soon list and the once-per-order toast on the shopper emulator]`

**Say this first:** "I can't see how the production app is built, so I'm not saying what *they* do. This is what Apple and Google document as the intended tools for these exact problems, and how my app uses, or doesn't use, them."

| | What the platforms provide (documented) | This app |
|---|---|---|
| **One event, one notification** | Push services let you *collapse* messages: [FCM collapsible messages](https://firebase.google.com/docs/cloud-messaging/customize-messages/collapsible-message-types) and the APNs `apns-collapse-id` header replace an older queued message with a newer one that shares a key. This only covers messages not yet delivered; once shown, a later header can't remove it. | No push channel, so no queue to collapse. Instead, dedup happens in the app on a stable key: the gather-alert toast fires once per order (`isFreshGatherAlert` with a seen set), and the same event also appears as a persistent list row, not a second toast. |
| **Replace what's on screen** | Android can replace a still-visible notification that reuses the same tag (verify the exact `notify(tag, id)` behavior in the `NotificationManager` docs; I only found forum-level confirmation). | One row per order in "Arriving soon", updated in place over realtime, so the manual "on my way" and the measured alert are the same row, never two stacked ones. |
| **Interrupt only when it matters** | Apple's [Time Sensitive guidance](https://developer.apple.com/design/human-interface-guidelines/managing-notifications): reserve it for something relevant now, never escalate low-priority information. Android's design guidance says the same about heads-up notifications. | The gather alert is a toast, which can be dismissed and never blocks the screen. The manual "on my way" is deliberately a row with *no* toast, because it's low-confidence information. |
| **Don't move the user** | Not a platform rule, but a design principle behind both: a notification should never discard what the person is doing. | Still a gap. Accepting an arrival navigates to Customer Check-ins whatever the shopper was doing (cases 2 and 3). The gather alert avoids this: a toast plus a list, and it never navigates. |
| **Works when the app is closed** | Push (FCM/APNs) is how every closed-app notification arrives. | Not built. A backgrounded shopper gets nothing, which is a bigger gap than duplicates. |

**The honest ledger:**
- **What I fixed for the new feature, not the old ones:** the gather alert follows the fix pattern from this section: one key per event, handled before the "do I already have an order" guard, a persistent list as the source of truth, no navigation. It's a fresh example of building the rule right the first time.
- **What I haven't touched:** the arrival handler's missing seen-ID check and the navigate-on-accept behavior. Both are still open and listed in the table above.
- **What I can't show:** duplicates across two channels, because this app has one channel. Don't imply the problem was reproduced here.

**Before filming, verify:** the two linked pages are current (the FCM page describes collapsing for messages not yet delivered; the Apple page is the Human Interface Guidelines on managing notifications); the Android tag-replacement claim against the `NotificationManager` reference; and that you describe the three cases as your own experience of the production app, never as a diagnosis of it.

---

## 16. Pain points #6 and #3: designed, not built

`[SCREEN: DECISIONS.md pain-point table, rows 3 and 6]`

Two pain points that aren't solved, shown on purpose, because being exact about *why* is the more useful signal.

**#6: switching between in-store and bring-to-my-car.** A pickup customer can't change how they receive an order once it's placed. The real case: someone came in for in-store pickup, shopped while items were gathered, then needed to rest in their car, and the shopper had to find them.
- **Built:** "No spot available", which tells the shopper the customer is waiting in the lot (carried in the arrival's notes, no schema change).
- **Not built:** the switch itself. It's a mode change on a live order that the shopper must see immediately, so it likely needs a new order or arrival field. It also needs a rule for a switch mid-gather and after check-in, and for how it interacts with proximity auto-arrival and the manual "on my way".
- **Say it as a design question,** not an apology: what is the smallest model that makes the shopper's screen correct at every moment?

**#3: several ready orders mean separate handoffs.** One trip to the trunk should be one handoff. This needs a data-model change (some notion of a pickup that groups orders). It's parity with the live app rather than a gap the live app lacks, so it's out of scope for this project's framing, and the script says so.

**And the one I dropped (#2).** Free-text parking spots were ambiguous between nearby stores' lots. The premise was wrong, since each store has its own lot. Checking your own claims against reality and cutting the ones that fail is part of the process.


---

# PART 4: PRODUCTION

## 17. From portfolio app to production system

`[SCREEN: README roadmap section, then the "Open issues from a system-design review" entry in DECISIONS.md]`

Be direct: this is unfinished, and knowing *exactly* how it's unfinished is the point of this section.

> "Anyone can point at a finished feature. Being able to explain why something isn't built yet, what could go wrong because of it, and what it would take to fix, is the more useful signal."

**Say this first, on camera:** "I can't see how Amazon built Whole Foods' pickup system, and as far as I can find, no engineering write-up of it is public. So this isn't a comparison to their internals. It's what a system like this needs to be usable and scalable, and where mine stops. While I'm unable to finish this for practical use, here's what I would do, in this order."

### The production map `[TO DRAFT]`

One short passage per axis: what's built, the gap, what I'd do, and when. Estimates should be honest and informed, not measured, and labeled as estimates. Material that already exists is noted.

| Axis | What exists (from this repo) | To draft |
|---|---|---|
| 1. Correctness under concurrency | Claim locks and transactions, verified live (below). | Price and arrival timestamps are still client-set; assignment still touches two records. Server-calculate them. |
| 2. Reliability | The every-minute sweep is off in production; no retry or idempotency beyond event-state guards. | A job queue or scheduled trigger, retries with idempotency keys, stuck-state repair. |
| 3. Dispatch quality | Assignment is sort-by-due-time. Section 6 explains why that was deliberate. | What published dispatch systems do (batching and matching) and when this app would need it. See sources below, unverified. |
| 4. Notifications and location | No push channel; foreground-only location. Covered in sections 13 and 15. | Push and background location, as one rollout. |
| 5. Scale | One event-triggered Function; realtime delivers events to everyone allowed to read. Nothing load-tested. | What I'd measure first, and an honest estimate of where it breaks. Don't claim a number without measuring. |
| 6. Security and privacy | Orders and writes locked; reads on `CustomerArrivals` and `ShopperStatus` not yet (below). | Finish the read scoping; audit PII. |
| 7. Testing and operations | Fixture tests for zone, trips and gather alert; the rest verified live. No CI; server code untyped; only the last location reading survives. | CI, shared types or `@ts-check`, a per-reading log, deploy checks that diff live against the repo. |
| 8. Product breadth | Pickup only for proximity; Android only. | Multi-order pickup, iOS, multi-store zones. |

**Sources for the dispatch axis (found 2026-11-22, not yet verified):** no public Whole Foods or Amazon pickup architecture was found. The nearest public material is about other companies: Instacart's [fulfillment engine post](https://company.instacart.com/tech-innovation/building-an-on-demand-fulfillment-engine-is-hard) and [IEEE Spectrum's piece on its algorithms](https://spectrum.ieee.org/the-algorithms-that-make-instacart-roll); DoorDash's DeepRed dispatch system (not yet read); and academic batching work such as this [INFORMS paper on when to dispatch a batch](https://pubsonline.informs.org/doi/pdf/10.1287/serv.2022.0042). Read them before citing; use them as "published systems do X", never as claims about Amazon.

### What's closed, and what's still open

**Closed since the system-design review** — worth a sentence, because it shows the list gets worked:
- **The server racing with itself — fixed.** One Function can run several copies at once, so two shoppers tapping Claim at the same instant could both pass the "is this still available?" check. Fixed with claim locks, where the database decides the winner, and verified live.
  **In plain terms:** the check ("is it free?") and the action ("take it") now happen as one step that nobody can squeeze in between.
- **Reads on Orders — fixed.** Per-row permissions: a customer sees only their own orders, shoppers see all, guests see none (section 12). Still open: the same treatment for `CustomerArrivals` and `ShopperStatus`, and the in-app dual-emulator pass for Orders.
- **Product images — done.** The catalog is now 103 products with Unsplash images, each chosen image recorded.

**Known gaps still open** — the ones worth naming on camera:
- **Some updates can stop halfway.** Assigning an order updates two records separately; a crash between them leaves them disagreeing. The fix is transactions, or a regular cleanup job that finds and repairs mismatches.
- **The every-minute sweep isn't running in production** (section 12). The plan rejects cron; options are an upgrade, Appwrite's interval option (not yet investigated), or an external trigger. Until then, an ignored arrival prompt or an unanswered auto check-in isn't timed out or reassigned.
- **The app still sets a few things the server should,** like the order total (price trust is deliberately still open) and arrival timestamps — both should be calculated on the server.
- **The server logic isn't type-checked.** The app is TypeScript, but the Function (`main.js`, `trips.js`, `zone.js`) is plain JavaScript running on Node 22 — so nothing verifies that the app and the Function agree on the shape of their messages. I've already had a near-miss of this kind: the `{ success, data }` response shape had to be kept in sync by hand during the deploy-gap merge. Say it as a known gap, not a deliberate choice — the decision log doesn't record one. In production I'd share one set of types between client and server; a cheaper first step is `// @ts-check` with JSDoc comments, which needs no build step.
  **In plain terms:** type checking is spell-check for your data's shape — it catches "the app sent `readyForPickup` but the server expects `ready_for_pickup`" before anything runs. Plain JavaScript has no such check, so that mistake only shows up when something breaks.
- **Testing is partly automated now, mostly manual.** The pure logic for the pickup zone and trips has fixture-based tests, but the rest was verified live on emulators, which is thorough but slow. The Function's assignment rules are the best next candidates.

**Features deliberately deferred:**
- **Proximity: the rest of it.** The foreground-only version is built (section 13). Still open: background location (its own large Android project), the staff map of customers in the lot, a per-reading log so a real drive can be reviewed afterward (today only the last reading survives), and the real-phone field test — the checklist is written, including runs that are *expected* to fail, like a locked screen.
- **Multi-order pickup consolidation** — the "two hand-offs for one trip" problem from the intro (section 16). No data-model support yet.
- **UI polish** — product images are in; the broader UI/UX pass is what I'm working on next.

---

## 18. Close / call to action

`[SCREEN: back to the app, maybe the DECISIONS.md file one more time]`

> "That's the project so far — from a real frustration with an app I use every week, through the tech choices, the parts that turned out simple and the parts that turned out genuinely hard, moving the app's decisions and its rules onto the server, and what it would take to make this a real production system. It's not finished, and the list of what's next is written down in the repo. If you want the full reasoning behind any of these calls, the engineering decision log is public — link in the description. Thanks for watching."

---

## Notes to self for delivery

- **The dual-emulator setup only runs on the 12-core/30GB PC.** Running both emulators on the 14-core/15GB machine crashed it. Record the two-sided demos (sections 1, 14, 9, 11) on the big PC, or use one emulator plus a physical phone over `adb` for the second role.
- **Before recording, check the Appwrite project isn't paused** (403 `project_paused` after inactivity), and remember the every-minute sweep is off — don't demo an arrival timeout or reassignment expecting it to fire.
- **Sections 10, 12, 13 and 17 are the ones to rehearse most** — they're the strongest material for an engineering audience and have the most moving parts to explain without reading.
- **Say the "In plain terms" lines naturally**, as asides — "which, put simply, means…" — not as a separate lecture voice.
- Have the dual-emulator setup already running and logged in *before* recording, so you're not waiting on boot times on camera.
- **Before recording, clean up:** clear the stale `ready_for_pickup` test orders from September so demo lists aren't cluttered, and check that no test order contains your real name, address or vehicle.
- **Never show the Appwrite console's API keys or project settings on screen.** If you record the console, blur those in editing.
- A stale dev-mode "WebSocket error" toast can sit over the bottom buttons after the app idles — dismiss it before a take, or restart the app.
- Good standalone short clips: the three live-testing bugs (section 7), the "200 OK that wasn't" story (section 12), the production drift story (section 12), the corrupted-polygon story (section 13), and the corrected-requirement story (section 11) — each is a self-contained 60-90 second setup/reveal/fix.
- **Every pain-point section in Part 3 ends with a "how production handles this" comparison.** Keep the opening line the same each time: you can't see inside any specific app, and the left column is platform documentation and published systems, not claims about a company.
