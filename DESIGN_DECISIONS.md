# Design Decisions: Brand Identity and Motion System

Case-study log. Each entry records **what changed**, **which brand attribute or pain point it serves**, and **alternatives considered**. Phases are appended as they are approved.

**Brand attributes:** Clear (not sterile) · Assured (not stiff) · Seamless (not sluggish)
**Contexts:** Shopper (one-handed, store lighting, interruptions) · Customer (anxious about substitutions and timing)
**Pain points:** (P1) jarring shopping-to-drop-off transition, (P2) unclear customer updates on shortages and substitutions

---

## Phase 0: Audit (no code changed)

Builds on the existing light/dark audit in `docs/ui-audit/README.md` (2026-10-29, 34 screenshots, 17 screens, branch `feature/proximity-foreground` at `707bcd0`). Findings A1-A5 below are that audit's five findings, carried forward unchanged. Everything else is new in this pass and comes from reading and grepping the source, so it is **static analysis, not yet live-verified**; items marked *(verify)* need a device check.

### 0.1 Project facts that shape the plan

| Fact | Value | Consequence |
|---|---|---|
| Platform | **Bare React Native 0.82.1, not Expo** (`app.json` has only name/displayName; `android/` and `ios/` committed) | Fonts and splash/icon are native assets, not `expo-font`/`expo-splash-screen`. Native dependencies need a rebuild of the APK (`npm run android`), not just a Metro reload. |
| React / Paper | React 19.1.1, react-native-paper ^5.14.5 (MD3) | Paper stays. Theme via `configureFonts` + MD3 theme objects. |
| TypeScript | `strict: true`; **zero real `any` in `src/`** (the 2 grep hits are the word "any" in comments) | Constraint is already met; keep it. |
| Animation libs installed | **None.** No Reanimated, no worklets, no gesture-handler, no haptics, no svg | Every motion item in Phase 2 needs a new dependency (see 0.9). |
| Animation in code today | 7 RN `Modal animationType` props (fade/slide). No `Animated`, no layout animation, no reduced-motion handling | Greenfield. No existing motion to migrate or break. |
| Fonts | **None bundled.** 1 `fontFamily` reference in all of `src/`; text renders in the Android system font (Roboto) | Plus Jakarta Sans and Inter must be added as native assets. |
| Theme infra | `ThemeContext` (`light`/`dark`/`system`, persisted at `@GroceryFulfillment:themeMode`, default `system`) + `PaperProvider` + `useAppTheme()` with a `theme.custom.*` extension | **Good bones: the system-default and in-app override already exist.** Phase 1 changes the values and widens the token set, not the mechanism. |
| Backend | Appwrite Cloud, Realtime, Functions | Untouched (constraint). Motion consumes the existing realtime callbacks. |

### 0.2 Screen inventory (both roles, both modes)

Routes are from `src/navigation/AppNavigator.tsx`. "Shot" = captured in `docs/ui-audit/` in light and dark. "Gap" = no screenshot yet; Phase 1 will capture it before and after.

**Auth stack:** Login, Register, ForgotPassword. *Gap (all three).* ForgotPassword is the worst offender (see 0.4).

**Customer (MainStack):**

| Screen | Shot | Notes |
|---|---|---|
| CustomerHome (catalog; 1008 lines, largest file) | Yes (`04-catalog`) | Category chips contrast bug (A2) |
| Cart | Yes (`05`, `06`) | Quantity IconButtons are 20dp icons, see 0.6 |
| Checkout (delivery / pickup) | Yes (`07`, `08`) | |
| OrderConfirmation | **Gap** | |
| Orders | Yes (`03`) | |
| OrderDetail (timeline, substitution card, arrival card) | Yes (`01`, `02`) | Timeline timestamps bug (A5); "Staff Notified" panel edge (A4) |
| Overlay: product photo-credit popup | **Gap** | Hard-coded scrim and white icon |
| Overlay: OrderReadyToast, arrival ("I've Arrived") card, OnMyWayCard | **Gap** | OnMyWayCard has a hard-coded error color and no theme hook |

**Shopper (ShopperStack):**

| Screen | Shot | Notes |
|---|---|---|
| ShopperHome (dashboard) | Yes (`02`) | The only screen whose dark header is correct |
| AvailableTasks (Pick Tasks) | Yes (`03`) | |
| TaskDetail | Yes (`04`) | Warning-as-text, see 0.5 |
| Shopping (item checklist) | Yes (`07`, `08`) | Core "item picked" moment |
| OrderCompletion | Yes (`09`) | Core handoff moment |
| DropOffs | Yes (`05`) | |
| CustomerCheckIns | Yes (`01`) | |
| ShopperSettings | Yes (`06`) | Selected-segment color bug (A3) |
| Overlays: NewAssignmentModal, ArrivalNotificationModal, OrderClaimedModal, OrderInterruptedModal, SubstitutionPickerModal, ShopperStatusDropdown, UrgentOrderToast | **Gap (all 7)** | All five modals hard-code the scrim `rgba(0,0,0,0.5)` and `shadowColor: '#000'` |

**Dev-only:** TestConnectionScreen (12 hard-coded colors, no theme hook; not user-facing, low priority, but it becomes the natural home for the Phase 3 style-guide route).

Coverage: 17 of ~37 distinct surfaces shot (screens + overlays). The gaps are mostly overlays, which is exactly where the key motion moments live, so closing them is part of Phase 1's before/after capture.

### 0.3 Existing audit findings carried forward

| ID | Sev | Finding | Root cause (verified in source) |
|---|---|---|---|
| A1 | Bug | Navigation header stays white in dark mode on every pushed screen; status-bar icons become invisible | `AppNavigator.tsx:370,372` (`ShopperStack`) and `:476,478` (`MainStack`) hard-code `#FFFFFF` and `#007AFF`. `WelcomeTitle` at `:107` hard-codes `#000`. The root `StatusBar` sets `backgroundColor` from the theme but the header paints over it. |
| A2 | Contrast | Dark-mode category chips are saturated green with blue text | Chips pick up MD3 `secondaryContainer`/`primary`, which are `green700`/`blue200` in `darkTheme.ts`: two unrelated hues |
| A3 | Consistency | Selected "System" segment is green while primary is blue | Same cause: Paper `SegmentedButtons` uses `secondaryContainer`, set to green700 |
| A4 | Polish | "Staff Has Been Notified" card shows an inner panel edge in dark mode | Two translucent greens stacked (`rgba(76,175,80,0.2)` over a green container) |
| A5 | Bug | Timeline repeats `orderDate` on every step | `OrderTimeline.tsx:157,193`. Needs server-side per-step timestamps. **Out of scope (backend).** The Phase 2 tracker animation will work off status, not timestamps, and the timeline will show a time only for the step that has a real one. |

**Insight for the case study:** A2, A3 and A4 are one bug seen three times. The old dark theme mixes a blue primary with green secondary and green translucent "success" fills, so every Paper component that reaches for `secondaryContainer` shows a hue the brand never chose. A single-hue-family palette fixes all three at the source, which is more convincing than three patches.

### 0.4 Hard-coded values inventory

Hard-coded color literals in `src/` outside `src/theme/` (grep, 2026-10-29; doc-comment ASCII art excluded):

| Category | Count | Where | Dark-mode risk |
|---|---|---|---|
| Whole-file legacy palette (`#f5f5f5 #333 #666 #ddd #007AFF #4CAF50`) | 12 | `ForgotPasswordScreen.tsx` (no `useAppTheme`) | **Critical.** Light backgrounds and dark text on a dark-mode device: the screen is effectively light-only |
| Navigation chrome | 10 | `AppNavigator.tsx` (header bg/tint, title `#000`, logout `#007AFF`, loading screen `#F5F5F5`/`#007AFF`/`#757575`) | **Critical** (A1), plus the app-boot loading screen flashes light on a dark device |
| Modal scrims `rgba(0,0,0,0.5)` | 6 | NewAssignment, ArrivalNotification, OrderInterrupted, OrderClaimed, SubstitutionPicker, ShopperStatusDropdown, ProductImage credit | Low. A black scrim works in both modes, but should be one token so opacity is tuned once |
| `shadowColor: '#000'` | 7 | 5 modals, QuickLinkCard, ShopperDashboardScreen, CustomerHomeScreen | Medium. Shadows are invisible on dark surfaces; brief calls for tonal elevation instead |
| Single colors | 5 | `OnMyWayCard` `#B00020` (error, no theme hook), `RushOrderToggle` `#fff`, `ProductImage` `#FFFFFF` icon on a dark chip, `CompletionSummary` `rgba(128,128,128,0.2)` | Medium. `#B00020` on a dark surface is ~2.5:1 *(verify)*; `#fff`-on-X depends on X |
| Alpha-suffix hack (`color + '20'`, `+ '30'`) | 8 | `OrderStatusBadge` and others | Medium. Works only while the source token is a 6-digit hex. It breaks silently if a token becomes `rgba()` or a named color, which Phase 1 may produce. Replace with explicit container tokens |
| `src/theme/*` (the source of truth itself) | 49 | `colors.ts` 43, `darkTheme.ts` 5, `lightTheme.ts` 1 | Expected. This is what gets regenerated |
| `TestConnectionScreen.tsx` | 12 | dev-only | Low |

Total outside the theme folder and the dev screen: **~42 literals in 15 files.** Fewer than feared: 45 of 53 `.tsx` files already read colors from the theme. The three that don't: `ForgotPasswordScreen`, `TestConnectionScreen`, `OnMyWayCard`.

**Typography:** 77 `fontSize` and 114 `fontWeight` literals, 1 `fontFamily`. 59 `variant="bodyMedium"` usages show most text already goes through Paper variants (good: `configureFonts` will reach it). The inline `fontSize` literals bypass the type scale: 12, 13, 14, 15, 16, 18, 24, 28, 32, 40, 48, 64 (12 distinct sizes). `fontWeight: '600'/'700'` inline will not select a custom font's weight on Android unless each weight is a separately named font family (see risk R3).

**Spacing (398 `padding`/`margin`/`gap` literals):** values used: 0, 2, 4, 5, 6, 8, 10, 12, 14, 15, 16, 18, 20, 24, 30, 32, 40, 100. The core scale is clearly 4/8/12/16/20/24/32, with stragglers (5, 6, 10, 14, 15, 18, 30) that look like drift. Proposed token scale: `xxs 2, xs 4, sm 8, md 12, lg 16, xl 24, xxl 32` (+ `xl2 20` only if the straggler review says it's real).

**Border radius:** 4, 6, 8, 10, 12, 14, 16, 20, 22, 40. Nine values; 8/12/16 account for 48 of 65 uses. Propose `sm 8, md 12, lg 16, full 999`.

**Animation / timing:** none hard-coded because none exists. Only `TOAST_DURATION_MS` constants and the Modal `animationType` props.

### 0.5 Status-color audit (brand rule: picked=green, substituted/short=amber, unavailable=gray, needs-action=red)

The current app has success/warning/error and **no status vocabulary**. Item states are inferred from `pickedQty` and `issue` (ItemChecklistItem comment: "no separate status field needed"), so the mapping is straightforward:

| Brand status | Current implementation | Gap |
|---|---|---|
| picked (green) | `custom.success` chip (found / approved substitute) | Light-mode `#4CAF50` text on white is **2.78:1, fails AA** |
| substituted/short (amber) | `custom.warning` = `#FFC107` | **Used as text color in 6 places** (`AvailableTasksScreen:303`, `TaskDetailScreen:426`, `CompletionSummary:36`, `ItemChecklistItem:62`, `OrderInterruptedModal:58`, `CurrentTaskCard:128`). `#FFC107` on white is **1.63:1.** This violates the brand rule (amber never as text on white) and is the most common WCAG failure in the app |
| unavailable (gray) | Out-of-stock reuses `errorContainer`/`error` (red) | Semantic mismatch: out of stock reads as an alarm. The brand wants gray; red is reserved for actions that need the user |
| needs action (red) | `error` for validation, cancelled, out-of-stock | Used too broadly. Red must be sparing |

Order-level badges (`OrderStatusBadge`) map 7 order statuses onto 4 colors (gray/primary/success/error). That is a separate vocabulary from item status and stays separate, but it should draw from the same tokens.

### 0.6 Accessibility audit

**Contrast, current palette (computed, WCAG relative luminance; script in session scratchpad):**

| Pair | Ratio | AA |
|---|---|---|
| Light: `#007AFF` primary text on white | 4.02 | **Fail** (needs 4.5) |
| Light: `textSecondary` `#757575` on `#F5F5F5` bg | 4.23 | **Fail** |
| Light: `textDisabled` `#BDBDBD` on white | 1.88 | Fail (disabled text is exempt, but it is also used for placeholders: *(verify)*) |
| Light: success `#4CAF50` text on white | 2.78 | **Fail** |
| Light: warning `#FFC107` text on white | 1.63 | **Fail** |
| Light: error `#E53935` on white | 4.23 | **Fail** (just) |
| Dark: primary `#90CAF9` on `#1E1E1E` | 9.53 | Pass |
| Dark: `textSecondary` `#BDBDBD` on `#1E1E1E` | 8.87 | Pass |
| Dark: `textDisabled` `#757575` on `#1E1E1E` | 3.62 | Fail (disabled-exempt) |
| Dark: success `#C8E6C9`, error `#FFCDD2` | 12.40 / 11.84 | Pass |
| Dark: header `#FFFFFF` with light status icons (A1) | 1.00 | **Total failure** |

**Pattern:** the dark theme passes comfortably and the *light* theme is the one that fails. That inverts the usual assumption ("dark mode is the afterthought") and is a good case-study point: the old light palette was borrowed from iOS system colors, which are tuned for large controls, not body text.

**Brand-palette baseline (the new colors, before any tuning):**

| Pair | Ratio | Verdict |
|---|---|---|
| `#1F6F50` primary on `#F7F8F5` surface | 5.71 | Pass text |
| White on `#1F6F50` | 6.09 | Pass |
| `#1A1F1C` ink on `#F7F8F5` | 15.68 | Pass |
| Ink on `#F2B33D` amber fill | 8.98 | Pass: **amber is a fill, ink is the label** |
| White on `#F2B33D` | 1.86 | **Fail**, so never white-on-amber |
| `#F2B33D` amber vs `#F7F8F5` surface (non-text, needs 3:1) | **1.74** | **Fail 1.4.11.** An amber icon or badge alone on the light surface is nearly invisible |
| `#1F6F50` primary on dark `#121412` (unshifted) | 3.04 | Fail text. Confirms the brief: primary must lighten in dark mode |
| `#F2B33D` amber on dark `#1E211F` | 8.74 | Pass (amber is naturally strong on dark) |

**Key finding for the case study:** the brand's amber works on dark but is too faint on light as a standalone mark (1.74:1). The rule "amber for backgrounds/icons only" is necessary but **not sufficient**: on the light theme an amber *icon alone* on a pale surface fails non-text contrast. Phase 1 resolution (proposed, not yet decided): amber is always a **filled shape with an ink glyph on it** (8.98:1 for the glyph) and the filled shape gets a 1px darker-amber outline in light mode to reach 3:1 against the surface. Alternative considered: use a second, darker amber for light-mode icons (~`#B07A00`). This retains one hue but gives up the brand's cheerful amber on light. Decision deferred to Phase 1 with measured ratios.

**Touch targets (48dp minimum):** elements with a measured dimension under 48dp that are tappable *(verify each on device)*:

- `ItemChecklistItem` quantity stepper: `IconButton size={18}`. Paper's IconButton adds padding to a 40dp default box (`size + 2*(11)` roughly), so it sits near 40dp, **below 48.** This is the shopper's most-used control, one-handed, in a store.
- `CartItemCard` quantity stepper: `IconButton size={20}`, same issue.
- `Button compact` is used in 15 places (`ItemChecklistItem` actions among them). `compact` removes Paper's minimum width and tightens padding; height stays ~40dp. **Found / Out / Substitute** are the shopper's primary actions and they are `compact`.
- `QuickLinkCard` badge 28dp (display only, OK) and icon wrapper 44dp (decorative inside a larger card: OK).
- `OrderTimeline` 32dp markers, `PickupLocationSelector` 24dp radio, `RushOrderToggle` 24dp: all decorative or inside a larger pressable row *(verify the pressable area)*.
- `CustomerHomeScreen:913`, `OrderDetailScreen:612`, `ShopperDashboardScreen:871`, `TaskDetailScreen:767,799`: 32dp elements, to be classified as tappable or not.
- `ProductImage` info badge: **24dp** tappable photo-credit button. Fails 48dp.

**Labels:** 93 `accessibilityLabel`/`Role` props across 53 files. Coverage is decent but I have not audited which of the 88 touchables lack one. Known gap from earlier work: item count label pluralization (fixed in `707bcd0`). The status badges and the stepper `IconButton`s need labels that include the item name ("Increase quantity of Bananas"); *(verify)*.

**Reduced motion:** no `AccessibilityInfo`/`useReducedMotion` usage anywhere. Modal fade/slide animations are native and ignore the setting.

**Font scaling:** large-font layouts have not been captured (README's "not yet covered"). With custom fonts and tabular figures this needs a pass; flagged for Phase 1 verification.

### 0.7 Contexts-of-use findings

- **Shopper, bright store light:** light theme must carry the contrast burden. It currently fails on secondary text, success, and warning (0.6). Fixing light mode is the higher-value half of Phase 1, not the dark half.
- **Shopper, night driving:** the drop-off flow (`DropOffs`, `CustomerCheckIns`, `OrderCompletion`, arrival hand-off modal) is where A1 lands: a white header slab and invisible status-bar icons in a dark cab. This is the strongest single justification for the audit order.
- **Mode switch mid-shift:** `system` default already handles it. The risk is *mid-animation* switches in Phase 2: animations must read colors from the live theme, not captured hex. Today there is no animation, so nothing to regress.
- **One-handed:** primary actions sit at the card bottom in `ItemChecklistItem` (good), but they are `compact`. Fix is size, not position.

### 0.8 Moments that most need motion

Ranked by pain-point impact. For each: current behavior, the job (feedback / continuity / orientation), and the hook that already exists.

| # | Moment | Current behavior | Job | Where it hooks in |
|---|---|---|---|---|
| 1 | **Shopping → drop-off handoff** (P1) | `OrderCompletion` is a hard screen push; `markReady` then returns the shopper to a different context. No sense of "the trip" | **Continuity + orientation** | `ShoppingScreen` → `OrderCompletionScreen` → `DropOffs`; navigation transitions plus a persistent 4-stage progress indicator (Shopping, Checkout, Driving, Drop-off) |
| 2 | **Shortage/substitution update** (P2) | Customer sees `SubstitutionApprovalCard` inside `OrderDetail`; no arrival cue, no state change cue after Approve/Reject | **Orientation + feedback** | `CustomerOrderContext` realtime callback → the card mounts/unmounts. Brief mandates banner/bottom sheet, never a modal |
| 3 | **Item picked** | Chip appears; list row just re-renders. No tactile or visual confirm | **Feedback** | `ItemChecklistItem` `onMarkFound` / quantity change. Add check animation + haptic |
| 4 | **Order status change** (customer) | `OrderTimeline` re-renders statically on realtime event | **Orientation** | `OrderDetailScreen` receives realtime updates; `OrderTimeline` step state |
| 5 | **Shopper auto-assignment** | `NewAssignmentModal` fades in | **Orientation** | `ShopperAssignmentContext`. Already a (non-blocking-ish) modal; keep a modal-like surface here because it needs an explicit accept, but make arrival feel earned, not startling |
| 6 | List changes when items complete | Rows stay in place; no reordering or layout animation | **Continuity** | `FlatList`/map in `ShoppingScreen` / `TaskDetailScreen` |

Dependency note: moments 2, 4 and 5 are driven by Appwrite Realtime callbacks. **The WebSocket-error toast from the earlier audit is a dev-only LogBox overlay** and realtime kept working, so it should not affect demos, but flag it for screen recordings (run a release build, or disable LogBox for the recording).

### 0.9 Dependency plan (needs your approval, nothing installed)

**Facts checked against npm today:**

- Project is **bare RN 0.82.1, not Expo.** Native modules need an APK rebuild.
- **Reanimated 4.7.1 (latest) requires RN 0.86 to 0.88, so it will NOT work here.** That would have been a trap: `npm install react-native-reanimated` with no version gets 4.7.1.
- **Reanimated 4.2.3** declares `react-native 0.80-0.84` and `react-native-worklets 0.7-0.8`: **fits RN 0.82.** (4.3.0 is 0.81-0.85, also fits; 4.1.x is `react-native: *`.) New Architecture is required by Reanimated 4, and RN 0.82 is New-Architecture-only, so this is consistent.
- Reanimated 4 splits worklets into `react-native-worklets`. It needs the Babel plugin `react-native-worklets/plugin` as the **last** entry in `babel.config.js`.
- `useReducedMotion` is in Reanimated (satisfies the constraint with no extra dependency).

**Proposed additions:**

| Package | Version (to pin) | Phase | Why | Alternative considered |
|---|---|---|---|---|
| `react-native-reanimated` | `~4.2.3` | 2 | UI-thread animation, `useReducedMotion`, layout animations (explicit requirement) | RN core `Animated` + `LayoutAnimation`: no `useReducedMotion`, JS-thread, layout animations flaky on New Arch. Rejected: brief names Reanimated |
| `react-native-worklets` | `~0.7.x` (exact pairing verified at install) | 2 | Required peer of Reanimated 4 | none (mandatory) |
| `react-native-haptic-feedback` | `^2.x` | 2 | Haptic on item picked | RN core `Vibration`: buzzes, no light/medium impact semantics, and feels like an error rather than a confirm. Also an option: no dependency, `Vibration.vibrate(10)`. **Cheapest fallback if you'd rather add nothing** |
| `react-native-svg` | `^15.x` | 2-3 | The animated check mark (stroke draw) and empty-state illustrations. Paper already pulls `react-native-vector-icons`, which does not support animated stroke paths | Animate a scale/opacity on an existing vector icon instead: no dependency, loses the "draw" feel. Could be Phase 2's cheaper path |
| Fonts: Plus Jakarta Sans, Inter | static `.ttf` files (SIL OFL) in `android/app/src/main/assets/fonts/` + `react-native.config.js` / iOS Info.plist | 1 | Brand typography | Variable fonts: RN on Android handles weight poorly with variable fonts; use static per-weight files |
| Splash | `react-native-bootsplash` | 3 | Dark splash variant on a bare project | Android 12 `SplashScreen` API via `styles.xml`/`values-night`: zero dependency, but I would only reach icon+color, not an animated logo. **Likely the lazier fit for a placeholder**; decide in Phase 3 |

Not proposed: gesture-handler (nothing in the brief needs it; the bottom sheet can be a Reanimated-driven view or Paper `Portal` + `Surface`), Skia, Lottie.

**Recommendation:** add Reanimated + worklets + haptics at Phase 2 start, defer `react-native-svg` and the splash library until the phase that proves they're needed, and take the `Vibration` fallback if you want zero new native modules for haptics. All native adds mean one APK rebuild per phase boundary.

### 0.10 Risks

- **R1 Reanimated version trap** (above). Pin the version; do not let `npm install` resolve latest.
- **R2 Fonts need a native rebuild and platform wiring.** Android loads by file name; the iOS project exists in `ios/` but this machine is Linux, so iOS font wiring would be unverified. I will wire Android and note iOS as untested.
- **R3 Custom font weights on Android.** `fontWeight: '700'` on a custom `fontFamily` falls back to synthetic bolding or is ignored. Paper's `configureFonts` handles this by assigning a named family per variant, but the 114 inline `fontWeight` literals bypass it. Phase 1 must replace those with variants or explicit family names.
- **R4 Dark-mode primary shift is visible.** The brand green must lighten on dark to pass; it will not be the exact `#1F6F50` in dark mode. This is a decision to explain in the case study, not hide.
- **R5 Realtime flakiness** during screen recordings (see 0.8).
- **R6 Test data** in live Appwrite (orders `6400B034`, `35934C69`, `F55B13C0`) is in intermediate states. For clean before/after captures I would reset or create fresh orders; that's a data write you should approve.

### 0.11 Screen recordings to capture now (BEFORE state)

Both light and dark, on the two emulators, **before Phase 1 changes anything.** Most of these are cheaper to record now than reconstruct later.

1. Customer catalog scroll (chips, cards, images) in light and dark. *Shows A2.*
2. Navigating through any pushed screen in dark (header slab). *Shows A1; the single most dramatic before/after.*
3. Shopper marking an item found, then substituted, then out of stock. *"Item picked" baseline: static chip swap.*
4. Shopper Complete Order → Drop Offs. *The jarring handoff (P1) baseline.*
5. Customer OrderDetail while the shopper changes status (two-emulator split-screen). *Static timeline baseline.*
6. Customer receiving a substitution request. *P2 baseline.*
7. ForgotPassword in dark (legacy-palette screen).
8. Mid-shift system theme flip on the shopper dashboard (`adb shell cmd uimode night yes`). *Baseline for the Phase 2 "no captured hex" requirement.*

I can drive these with the existing `shot.sh` helper for stills; true video needs `adb shell screenrecord` (works, 3-minute cap per clip, no audio) and I can script it.

### 0.12 Open questions for you

1. **Dependencies (0.9):** approve Reanimated `~4.2.3` + worklets at Phase 2? Haptics via library or the zero-dependency `Vibration` fallback?
2. **Amber on light (0.6):** the brand amber is 1.74:1 on the light surface. OK to resolve with "filled shape + ink glyph + darker-amber outline" in Phase 1, or would you rather introduce a second darker amber for light mode?
3. **Red usage:** the app uses red for out-of-stock today; the brand says gray for unavailable and red sparingly. OK to re-map out-of-stock to gray (Phase 1), reserving red for "needs action" (e.g., a substitution awaiting the customer's decision, an order that failed)?
4. **A5 timeline timestamps** is a backend change and out of scope under your constraints. OK to leave it and have the Phase 2 tracker show a time only where one is real?
5. **Before-state recordings (0.11):** shall I capture these now, before Phase 1, and should that reset the three live test orders first?

### 0.13 Answers to the open questions (2026-10-29)

| # | Decision | Status |
|---|---|---|
| 1 | Reanimated `~4.2.3` + `react-native-worklets` approved for Phase 2; haptics via library approved | Approved |
| 2 | Amber on light: **option C chosen.** Light-mode amber icons use a darker step of the same hue, `#8A5A00` (5.56:1 on the light surface; same ~40° hue as `#F2B33D`). Dark mode and amber fills keep `#F2B33D` (8.74:1 on dark; ink glyph on fill 8.98:1). Alternatives rejected: A, amber icon alone (1.74:1, fails); B, outlined fill (kept one brand hue but adds an outline treatment only in light mode) | Decided |
| 3 | Out-of-stock re-mapped from red to gray; red reserved for needs-action | Approved |
| 4 | A5 timeline timestamps postponed until the user can make the backend change; Phase 2 tracker shows a time only where a real one exists | Postponed |
| 5 | Before-state recordings captured; test orders reset first. Remaining substitution and handoff clips: user records by hand; the rest are skipped | Partial, see 0.14 |

### 0.14 Before-state recordings (`docs/ui-audit/recordings/`, uncommitted, 18 MB)

Captured on emulators via `adb screenrecord`, dev build, 1080x2400:

| Clip | Light | Dark | Notes |
|---|---|---|---|
| 01 customer catalog scroll | yes | yes | shows A2 (chips) |
| 02 shopper header navigation (Drop Offs, Pick Tasks, Check-ins) | yes | yes | shows A1 (white header slab in dark) |
| 08 mid-shift theme flip on dashboard | one clip (light, then dark, then light) | | baseline for the no-captured-hex requirement |
| 03 assignment modal + first item picked | partial | **missing** | order BB02DC98 |
| 04 shopping to drop-off handoff | **missing** | **missing** | |
| 05 customer order tracker | partial (static, nothing changed during the take) | **missing** | |
| 06 substitution request seen by customer | **missing** | **missing** | |
| 07 ForgotPassword dark | **missing** | | needs a logout |

Why the gap: scripted taps on the substitution picker were unreliable, and the dev-only WebSocket error toast overlaid the footage and swallowed taps. A temporary `LogBox.ignoreAllLogs` edit was used for part of the session and reverted (not committed).

Backend note (corrected, nothing changed): an earlier draft of this entry called the claim locks a bug. They are not. `claimLock` stays at 1 on an order and its shopper while the shopper holds the order, by design (`functions/auto-assignment/src/main.js:191`). The "no longer available" and "already have an active order" errors during recording came from resetting test data by direct database writes, which skipped the Function's cleanup, plus a stale Task Details screen. One possible gap remains and is unverified: `handleCancelOrder` (line 1229) does not clear the shopper's `currentOrderId` or lock when a customer cancels an `assigned` order. Customers can cancel only while `pending` or `assigned`, so the window is narrow. Logged as low priority, out of scope for the design work. No next-day auto-cancel exists in the Function or client code.

Test data left: order `BB02DC98` is assigned to shopper.tester with 1 of 3 items picked; `1A8739CF`, `F55B13C0`, `35934C69` are cancelled, `6400B034` completed.


---

## Phase 1: Tokens and theme

Branch `feature/brand-system`. Before-state is tagged `before-brand-system`. No new app dependencies. Gate: `npx tsc --noEmit` clean, 128 tests pass (109 are the new contrast assertions), and visual check on both emulators in both modes (after-shots in `docs/ui-audit/phase1/`).

### 1.1 What was built

| File | Contents |
|---|---|
| `src/theme/colors.ts` | `ColorTokens` with a `lightColors` / `darkColors` pair. M3 roles, tonal elevation ladder, scrim, ripple, media colors, and `status.{picked,substituted,unavailable,actionNeeded}` each with `color / container / onContainer / solid / onSolid` |
| `src/theme/typography.ts` | `fontFamilies`, `tabularNums`, Paper `configureFonts` for all 15 M3 variants |
| `src/theme/layout.ts` | `spacing` (2/4/8/12/16/20/24/32), `radius` (8/12/16/full), `minTouchTarget` 48 |
| `src/theme/motion.ts` | `duration` fast 150 / base 250 / slow 400; `easing` standard / exit / emphasized (cubic-bezier points); `spring` settle / pop / layout |
| `src/theme/buildTheme.ts` | One function maps a token set onto Paper's MD3 theme plus `theme.custom`, so light and dark cannot drift structurally. Legacy `custom.success/warning/...` keys are kept as aliases to the new status tokens |
| `src/theme/contrast.ts`, `__tests__/themeContrast.test.ts` | WCAG ratio helper and a test that fails if any pair in either mode drops below AA. `PRINT_CONTRAST=1 npx jest __tests__/themeContrast.test.ts` prints the table below |
| `android/app/src/main/assets/fonts/` | Static Inter 400/500/600/700 and Plus Jakarta Sans 600/700/800 (SIL OFL, licenses alongside) |

Existing mechanism reused unchanged: `ThemeContext` (system default plus in-app override persisted in AsyncStorage) and `PaperProvider`.

### 1.2 Replacement of hard-coded values

| Category | Before | After |
|---|---|---|
| Color literals outside `src/theme` | ~42 in 15 files | 0, except `shadowColor: '#000'` (8 sites): a black shadow is correct in both modes. Dark mode gets depth from tonal elevation, and shadows there are simply invisible |
| `fontWeight` literals | 112 | 0. Each became an explicit font family (headings to Plus Jakarta, everything else to Inter) |
| Padding, margin, gap literals | 335 on-scale | tokens. Off-scale values (5, 6, 10, 14, 15, 18, 30) deliberately left: snapping them changes layout, which is a visual decision |
| `borderRadius` | 45 on-scale | tokens |
| Navigation | white header, blue tint, light loading screen | themed header (`elevation.level2`), themed `NavigationContainer`, themed loading screen |
| `ForgotPasswordScreen` | legacy palette, no theme | themed via a `createStyles(theme)` factory |
| Alpha-suffix hacks (`color + '20'`) | 8 in `OrderStatusBadge` | explicit container/onContainer tokens |
| Scrims | `rgba(0,0,0,0.5)` x7 | `theme.custom.scrim`, one token per mode |
| Tabular figures | none | `tabularNums` on 47 price, total, quantity and count styles |

Left as-is and logged for later: 77 `fontSize` literals (the M3 variants carry most text; inline sizes are a type-scale decision), `TestConnectionScreen` (dev only), iOS font wiring (not done, not verifiable on this machine).

### 1.3 Contrast, every pair, both modes

`surface` rows are the base; `elevation5` rows are the worst case on the lightest/most tinted card surface. Text pairs need 4.5:1, outline boundaries need 3:1.

| Mode | Pair | Colors | Ratio | Needs |
|---|---|---|---|---|
| light | error / elevation5 | `#B3261E on #E5ECE7` | 5.44:1 | 4.5:1 |
| light | error / surface | `#B3261E on #F7F8F5` | 6.13:1 | 4.5:1 |
| light | inverseOnSurface / inverseSurface | `#EFF1ED on #2E312F` | 11.57:1 | 4.5:1 |
| light | onError / error | `#FFFFFF on #B3261E` | 6.54:1 | 4.5:1 |
| light | onErrorContainer / errorContainer | `#5C0F0B on #F9DEDC` | 10.80:1 | 4.5:1 |
| light | onMedia / mediaScrim over black | `#FFFFFF on #000000` | 21.00:1 | 4.5:1 |
| light | onPrimary / primary | `#FFFFFF on #1F6F50` | 6.09:1 | 4.5:1 |
| light | onPrimaryContainer / primaryContainer | `#0B3D2A on #CDEBDA` | 9.62:1 | 4.5:1 |
| light | onSecondaryContainer / secondaryContainer | `#0A1F16 on #CFE9D9` | 13.36:1 | 4.5:1 |
| light | onSurface / elevation5 | `#1A1F1C on #E5ECE7` | 13.91:1 | 4.5:1 |
| light | onSurface / surface | `#1A1F1C on #F7F8F5` | 15.68:1 | 4.5:1 |
| light | onSurface / surfaceVariant | `#1A1F1C on #DCE5DD` | 12.97:1 | 4.5:1 |
| light | onSurfaceVariant / elevation5 | `#454D47 on #E5ECE7` | 7.27:1 | 4.5:1 |
| light | onSurfaceVariant / surface | `#454D47 on #F7F8F5` | 8.19:1 | 4.5:1 |
| light | onSurfaceVariant / surfaceVariant | `#454D47 on #DCE5DD` | 6.77:1 | 4.5:1 |
| light | onTertiaryContainer / tertiaryContainer | `#001F29 on #C1E9FB` | 13.29:1 | 4.5:1 |
| light | outline / elevation5 (boundary) | `#79827B on #E5ECE7` | 3.30:1 | 3:1 |
| light | outline / surface (boundary) | `#79827B on #F7F8F5` | 3.72:1 | 3:1 |
| light | primary / elevation5 | `#1F6F50 on #E5ECE7` | 5.07:1 | 4.5:1 |
| light | primary / surface | `#1F6F50 on #F7F8F5` | 5.71:1 | 4.5:1 |
| light | status.actionNeeded.color / elevation5 | `#B3261E on #E5ECE7` | 5.44:1 | 4.5:1 |
| light | status.actionNeeded.color / surface | `#B3261E on #F7F8F5` | 6.13:1 | 4.5:1 |
| light | status.actionNeeded.onContainer / container | `#5C0F0B on #F9DEDC` | 10.80:1 | 4.5:1 |
| light | status.actionNeeded.onSolid / solid | `#FFFFFF on #B3261E` | 6.54:1 | 4.5:1 |
| light | status.picked.color / elevation5 | `#1F6F50 on #E5ECE7` | 5.07:1 | 4.5:1 |
| light | status.picked.color / surface | `#1F6F50 on #F7F8F5` | 5.71:1 | 4.5:1 |
| light | status.picked.onContainer / container | `#0F3B2A on #D5EBDD` | 9.98:1 | 4.5:1 |
| light | status.picked.onSolid / solid | `#FFFFFF on #1F6F50` | 6.09:1 | 4.5:1 |
| light | status.substituted.color / elevation5 | `#8A5A00 on #E5ECE7` | 4.93:1 | 4.5:1 |
| light | status.substituted.color / surface | `#8A5A00 on #F7F8F5` | 5.56:1 | 4.5:1 |
| light | status.substituted.onContainer / container | `#3D2A00 on #FBE7BC` | 11.28:1 | 4.5:1 |
| light | status.substituted.onSolid / solid | `#1A1F1C on #F2B33D` | 8.98:1 | 4.5:1 |
| light | status.unavailable.color / elevation5 | `#5C655F on #E5ECE7` | 5.02:1 | 4.5:1 |
| light | status.unavailable.color / surface | `#5C655F on #F7F8F5` | 5.66:1 | 4.5:1 |
| light | status.unavailable.onContainer / container | `#2F3631 on #E2E5E0` | 9.76:1 | 4.5:1 |
| light | status.unavailable.onSolid / solid | `#FFFFFF on #5C655F` | 6.03:1 | 4.5:1 |
| dark | error / elevation5 | `#FFB4AB on #1E3027` | 8.21:1 | 4.5:1 |
| dark | error / surface | `#FFB4AB on #111412` | 10.92:1 | 4.5:1 |
| dark | inverseOnSurface / inverseSurface | `#2E312F on #E1E3DF` | 10.18:1 | 4.5:1 |
| dark | onError / error | `#4B0008 on #FFB4AB` | 9.49:1 | 4.5:1 |
| dark | onErrorContainer / errorContainer | `#FFDAD6 on #7A1912` | 8.23:1 | 4.5:1 |
| dark | onMedia / mediaScrim over black | `#FFFFFF on #000000` | 21.00:1 | 4.5:1 |
| dark | onPrimary / primary | `#003825 on #6DDBAA` | 7.76:1 | 4.5:1 |
| dark | onPrimaryContainer / primaryContainer | `#C6F5DD on #0A5239` | 7.68:1 | 4.5:1 |
| dark | onSecondaryContainer / secondaryContainer | `#CFE9D9 on #364B40` | 7.29:1 | 4.5:1 |
| dark | onSurface / elevation5 | `#E1E3DF on #1E3027` | 10.78:1 | 4.5:1 |
| dark | onSurface / surface | `#E1E3DF on #111412` | 14.35:1 | 4.5:1 |
| dark | onSurface / surfaceVariant | `#E1E3DF on #404943` | 7.22:1 | 4.5:1 |
| dark | onSurfaceVariant / elevation5 | `#BFC9C1 on #1E3027` | 8.19:1 | 4.5:1 |
| dark | onSurfaceVariant / surface | `#BFC9C1 on #111412` | 10.89:1 | 4.5:1 |
| dark | onSurfaceVariant / surfaceVariant | `#BFC9C1 on #404943` | 5.48:1 | 4.5:1 |
| dark | onTertiaryContainer / tertiaryContainer | `#C1E9FB on #244C5A` | 7.23:1 | 4.5:1 |
| dark | outline / elevation5 (boundary) | `#8A938C on #1E3027` | 4.40:1 | 3:1 |
| dark | outline / surface (boundary) | `#8A938C on #111412` | 5.86:1 | 3:1 |
| dark | primary / elevation5 | `#6DDBAA on #1E3027` | 8.20:1 | 4.5:1 |
| dark | primary / surface | `#6DDBAA on #111412` | 10.92:1 | 4.5:1 |
| dark | status.actionNeeded.color / elevation5 | `#FFB4AB on #1E3027` | 8.21:1 | 4.5:1 |
| dark | status.actionNeeded.color / surface | `#FFB4AB on #111412` | 10.92:1 | 4.5:1 |
| dark | status.actionNeeded.onContainer / container | `#FFDAD6 on #7A1912` | 8.23:1 | 4.5:1 |
| dark | status.actionNeeded.onSolid / solid | `#4B0008 on #FFB4AB` | 9.49:1 | 4.5:1 |
| dark | status.picked.color / elevation5 | `#6DDBAA on #1E3027` | 8.20:1 | 4.5:1 |
| dark | status.picked.color / surface | `#6DDBAA on #111412` | 10.92:1 | 4.5:1 |
| dark | status.picked.onContainer / container | `#C9F2DD on #14402E` | 9.56:1 | 4.5:1 |
| dark | status.picked.onSolid / solid | `#003825 on #6DDBAA` | 7.76:1 | 4.5:1 |
| dark | status.substituted.color / elevation5 | `#F2B33D on #1E3027` | 7.49:1 | 4.5:1 |
| dark | status.substituted.color / surface | `#F2B33D on #111412` | 9.97:1 | 4.5:1 |
| dark | status.substituted.onContainer / container | `#FBE3A6 on #4A3810` | 8.93:1 | 4.5:1 |
| dark | status.substituted.onSolid / solid | `#1A1F1C on #F2B33D` | 8.98:1 | 4.5:1 |
| dark | status.unavailable.color / elevation5 | `#A3ACA5 on #1E3027` | 5.97:1 | 4.5:1 |
| dark | status.unavailable.color / surface | `#A3ACA5 on #111412` | 7.95:1 | 4.5:1 |
| dark | status.unavailable.onContainer / container | `#D4DAD5 on #2C322E` | 9.23:1 | 4.5:1 |
| dark | status.unavailable.onSolid / solid | `#1A1F1C on #A3ACA5` | 7.16:1 | 4.5:1 |

Minimum across all 72 rows: **3.30:1** (an outline boundary, which needs 3:1). Every text pair is 4.5:1 or better.

**Before vs after (the numbers that mattered):**

| Pair | Before | After |
|---|---|---|
| Light primary text on surface | 4.02:1 fail | 5.71:1 |
| Light secondary text | 4.23:1 fail | 8.19:1 |
| Light success text | 2.78:1 fail | 5.71:1 (`picked`) |
| Light warning/amber text | 1.63:1 fail | 5.56:1 (`#8A5A00`, same hue as `#F2B33D`) |
| Light error text | 4.23:1 fail | 6.13:1 |
| Dark header vs status-bar icons | 1.00:1 | themed, visible |

### 1.4 Decision log

**D1. One hue family, generated from the brand green.**
What: replaced the blue primary / green secondary / yellow warning palette with M3 roles generated from `#1F6F50` (tool: `@material/material-color-utilities`, run in a scratch directory, not an app dependency; output pasted into `colors.ts`).
Serves: Clear, Assured. Fixes audit findings A2, A3 and A4, which were one bug: Paper components that reach for `secondaryContainer` showed a green the brand never chose.
Alternatives: keep the iOS-blue and recolor only buttons (rejected: leaves three unrelated hues); use the generated primary `#006C4B` as-is (rejected: brand value `#1F6F50` is already 5.71:1 and must be exact in light mode).

**D2. Exact brand values in light, generated values in dark.**
What: light primary, surface and ink are exactly `#1F6F50`, `#F7F8F5`, `#1A1F1C`. Dark primary is the M3 tone-80 of the same hue (`#6DDBAA`); unshifted `#1F6F50` on the dark surface was 3.04:1 and fails text.
Serves: Assured. The brand stays recognizably itself, and dark mode reads as the same green, lighter.
Alternatives: one shared primary (rejected: fails AA on dark); dark mode with a tinted brand surface (rejected: dark gray surfaces were specified).

**D3. Dark surfaces are `#111412` with a tonal ladder, not black and not shadows.**
What: `elevation.level0..5` blend the primary into the surface at 5/8/11/12/14%. Modal cards use level 3, cards use level 1, the header uses level 2.
Serves: Clear. Depth reads without shadows, which vanish on dark.
Alternatives: pure black (rejected, harsh and no elevation room); shadows in dark (rejected, invisible).

**D4. Status colors are a fixed vocabulary, tuned per mode.**
What: `status.picked` green, `substituted` amber, `unavailable` gray, `actionNeeded` red, each with five roles. Out-of-stock moved from red to gray; order "Cancelled" badge moved from red to gray.
Serves: Pain point P2 (unclear shortage/substitution updates): a customer can learn that amber means "something changed, look" and that red always means "you need to act". Clear.
Alternatives: reuse success/warning/error (rejected: that was the old vocabulary, and out-of-stock read as an alarm).

**D5. Amber: darker step of the same hue for light-mode icons and text (option C).**
What: light `substituted.color` is `#8A5A00` (5.56:1); the fill stays `#F2B33D` with ink on it (8.98:1); dark mode uses `#F2B33D` for everything (9.97:1 on the dark surface).
Serves: Clear. The brand amber alone is 1.74:1 on the light surface.
Alternatives: outlined fill (option B); amber icon alone (option A, fails). See 0.13.

**D6. Fonts as separate static families, not variable fonts or `fontWeight`.**
What: each weight is its own family file (`Inter_600SemiBold`) because Android addresses custom fonts by file name; `fontWeight` is left at 400 to avoid faux bold. Headings (display, headline, titleLarge and the inline heading-like styles) use Plus Jakarta; title medium/small use its SemiBold.
Serves: Assured (a confident heading face) and Clear (Inter for dense body text and numerals).
Alternatives: variable fonts (rejected: unreliable weight selection on Android); a font-weight-to-family wrapper component (rejected: per-component override, against the "through the theme" constraint).

**D7. Tabular numerals on quantities, prices, totals and counts.**
What: a shared `tabularNums` style applied to 47 style entries.
Serves: Clear. Totals and steppers do not jitter when digits change, which matters once Phase 2 animates them.

**D8. 48dp targets on the shopper's primary controls.**
What: the quantity steppers (shopper and cart) are 48dp, the Found / Out of Stock / Substitute buttons have a 48dp minimum height (the `compact` flag is gone), and the photo-credit button gets a 48dp hit area with its 24dp visual unchanged (`hitSlop`).
Serves: the shopper context: one-handed, in motion.
Alternatives: bigger visuals (rejected for the credit badge: it would cover the product photo).

**D9. Navigation themed through the navigator, not per screen.**
What: `NavigationContainer theme`, one shared `headerOptions`, and `WelcomeTitle` / `LogoutButton` / loading screen read the theme.
Serves: the night-driving drop-off flow. Fixes finding A1 (white header and invisible status-bar icons in dark).

### 1.5 Before/after, verified live

Dark `Shopping` screen: header is dark and tinted, back arrow and status bar are visible; "Found" chip is the green container; steppers are 48dp and the disabled "+" is dimmed; buttons are the new primary. Dark catalog: chips are on-palette, cards use tonal elevation, prices are tabular Plus Jakarta/Inter. Light dashboard: headings in Plus Jakarta, brand green throughout. Files: `docs/ui-audit/phase1/`.

Not yet live-checked: Login/Register, the modals (tokens applied, not viewed), `ForgotPasswordScreen`, large-font layouts, and the amber `substituted` chip (no item was in that state; it is covered by the contrast test only).

### 1.6 Things I noticed that are not fixed

- `CurrentTaskCard` shows "Due by 7:00 PM" in the error color. Red is reserved for needs-action, so a due time should probably be neutral until it is urgent. A design call for you; one line to change.
- Phase 1 changed look-and-feel on every screen. The before-state clips can still be recorded from the `before-brand-system` tag.

### 1.7 Screen recordings for this phase

Record after the Phase 2 motion lands, but a quick Phase 1 pair is worth having now, in light and dark: (1) Shopping screen, mark an item Found; (2) the dark header navigation (the same clip as `02-header-navigation`) for the A1 before/after.

---

*Phase 1 complete. Awaiting approval before Phase 2.*
