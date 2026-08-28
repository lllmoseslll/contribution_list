# Remove the Generic-AI Visual Language, Rebuild It as a Restrained Professional One

2026-08-28 — plan for the current branch, `feat/admin-and-design-system` (nine commits in, unmerged,
unpushed — this redesign depends directly on work already committed there: the `brand`/`accent`/`neutral`
`@theme` tokens from `Design_feat/palette`, the `react-icons/fa6` migration from `Design_feat/icons`, the
`/admin` route from `Admin_feat/route`, and the global focus ring from `CardUX_feat/filters`. A fresh
branch would have to re-derive all four; there is no reason to). Format follows this repo's own
`plans/admin-route-three-colour-system-react-icons-and-contributor-disclosure.md`, itself modelled on
`plans/batch-scoring-origin-tabs-dataset-catalog-and-frontend-security.md` in the Credit-scoring-system
repo: verified Context with file:line, a Research section with external citations, numbered Decisions
naming rejected alternatives, one commit per step with a Verify line, then Risks, end-to-end Verification,
per-step Execution prompts with model selection, and an empty Session log.

**Conventions.** Commit prefix: `Redesign_*` throughout — this plan is one cohesive visual pass, not a mix
of concerns that need separable prefixes. No AI co-author trailers. Every commit updates this plan's
Session log in the same commit.

**A note on the requested "frontend design skill."** As stated in the previous plan: no skill by that
name exists in this environment. The `design` skill produces a separate published mockup canvas, not edits
to this Next.js app's own files, so it is not the right tool for restyling `app/page.js` and
`app/admin/page.js` in place. This plan's design reasoning is instead grounded in a line-by-line audit of
the current markup (below) and in named, cited design-critique and design-system sources (Research), plus
a close visual reading of the reference screenshot the user supplied.

**What "this page" means here.** The user's redesign request and the reference image both concern the
*application UI* — the public budget/pledge page and the `/admin` console. `lib/mailer.js`'s email HTML
templates are a distinct surface (sent to inboxes, rendered by mail clients, not by this app's own CSS)
and are out of scope; where they share a pattern this plan removes from the UI (emoji, in Context 15),
that is named as a deliberate exclusion, not an oversight.

---

## Context (verified 2026-08-28, against the current tip of `feat/admin-and-design-system`)

1. **The hero is a checklist match for the pattern named "AI slop."** `app/page.js:419` is
   `bg-gradient-to-br from-brand-950 via-brand-900 to-brand-900` with `shadow-xl` and a 4px accent border;
   `:420` overlays a decorative dotted radial-gradient background (`bg-[radial-gradient(#f59e0b_1px,transparent_1px)]`)
   purely for texture; `:423-425` is an uppercase pill badge ("THE KWANJULA BUDGET") sitting directly above
   the `<h1>`. Research item 1 names this exact shape — "a centered hero with a badge directly above the
   H1" — as the first item on a widely-cited checklist for spotting AI-generated interfaces.
2. **Every card in the budget list carries a colored left border, a second named tell.** The item-card
   status rail at `app/page.js:737-743` is `absolute inset-y-0 left-0 w-1.5` in brand/accent/neutral
   depending on funding state. Research item 1's checklist names "colored left borders on cards"
   specifically.
3. **Stat tiles are icon-in-rounded-square, a third named tell.** `app/page.js:474-476`:
   `w-13 h-13 rounded-xl bg-accent-50 text-accent-700 flex items-center justify-center` wrapping a single
   icon, repeated for all four metrics (`:475`, `:486`, `:497`, `:510`). This is the checklist's
   "icon-in-rounded-square stat tile" pattern verbatim.
4. **`rounded-2xl`/`rounded-3xl` plus `shadow-lg`/`shadow-xl`/`shadow-2xl` is the default surface treatment
   everywhere, not the exception.** Counting: `rounded-3xl` appears 4 times in `app/page.js` and 3 in
   `app/admin/page.js` (modal shells, the Roll of Honor section, the payment-channels section, the admin
   shell); `rounded-2xl` appears 16 times in `app/page.js` alone; `shadow-xl`/`shadow-2xl` appears 5 times
   in `app/page.js` and 2 in `app/admin/page.js`. Every one of the seven `rounded-3xl` surfaces is also
   `shadow-lg` or heavier (`app/page.js:880,939,1091,1334`; `app/admin/page.js:397,908,1045`) — this is
   the checklist's `rounded-2xl shadow-lg` combination, applied as the house style rather than reserved
   for elevated surfaces.
5. **The Mobile Money section is glassmorphism, a pattern Research item 1 calls "screams-AI-on-sight."**
   `app/page.js:939` is a dark `rounded-3xl` section; the three contact cards inside
   (`:953,996,1023`) are `bg-white/10 backdrop-blur-md` / `bg-white/5 backdrop-blur-md` over it, with
   nested `bg-black/30`/`bg-black/40` translucent chips for the phone-number rows (`:959,971,1001,1028,1059,1061`).
   This is distinct from `.modal-backdrop` (`app/globals.css:116-119`\*, a scrim behind a modal dialog,
   which is a standard, functional dimming pattern and is not touched by this plan) — the payment section's
   blur is decorative glass wrapped around ordinary content sitting in the page flow, which is the pattern
   the research flags.
6. **Every heading, on both pages, uses an ornamental serif display font layered onto an otherwise sans-serif
   app.** `.font-serif-royal` (`app/globals.css:102-104`) is `'Playfair Display', 'Cinzel', Georgia, serif`
   and appears on 8 headings in `app/page.js` (`:427` hero H1, `:543`, `:707`, `:883`, `:944`, `:1075`
   footer, `:1096`, `:1339`) and 2 in `app/admin/page.js` (`:401`, `:911`), while the body font
   (`app/globals.css:70`) is `'Outfit'`, a geometric sans. Mixing a wedding-invitation display serif into
   every section header of an otherwise data-dense sans-serif interface is its own inconsistency, distinct
   from — but adjacent to — the gradient/glass/badge tells above.
7. **Primary-action color is inconsistent between the two pages, undocumented, and drifted from what
   `@theme`'s own comment says the roles are.** `app/globals.css:13` documents
   `brand — … primary actions`, `accent — … Attention, money outstanding, destructive confirmation`. In
   practice: the public page's two pledge CTAs are gold (`app/page.js:442` gradient `accent-500→600`,
   `:656` solid `accent-600`), while every primary action on `/admin` is emerald
   (`app/admin/page.js:457` "Unlock Admin Portal", `:539` "Add Offline Pledge", `:884` "Save Settings", all
   `bg-brand-800`). Two colors are both "the primary action color," depending on which page you're on, and
   neither reading matches the comment that named the roles.
8. **Status is communicated by a heavy, saturated, bordered pill on both pages.** The item-card funding
   badge (`app/page.js:753-761`) is `text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase
   tracking-wider` with a tinted background *and* a matching border *and* uppercase tracked text — three
   separate emphasis techniques stacked on one four-word label. The admin pledge-status chip
   (`app/admin/page.js:610-617`) repeats the same shape. The reference screenshot's own status column
   (Context 14) shows the word "Live" in plain text with no pill, no border, no background tint at all.
9. **Hover micro-interactions add a lift transform that the reference has nowhere.** `hover:-translate-y-1`
   on all four stat tiles (`app/page.js:474,485,496,507`) and `hover:-translate-y-0.5` on the two hero CTA
   buttons (`:442,448`) — a floating-card affordance with no corresponding pattern in the cited professional
   references (Research item 2).
10. **Decorative emoji sit inside otherwise icon-driven UI chrome, an inconsistency the icon migration
    didn't reach.** The prior plan's Step 7 replaced all 79 `<i className="fa-…">` icons with
    `react-icons/fa6` specifically to get UI iconography off an inconsistent, unsizeable glyph system —
    but literal emoji still appear in the live-toast copy (`app/page.js:146` "🎉 …"), the offline-pledge
    success toast (`app/admin/page.js:688` "🎉"), and two decorative accents (`app/page.js:1140`,
    `app/admin/page.js:931`, both "✨"). Research item 1 names emoji-as-decoration alongside emoji-as-icon
    as part of the same tell — no cited professional reference (Research item 2) uses emoji in UI copy.
    `lib/mailer.js`'s email templates carry five more (💍, 🎉, 🙏) and are explicitly out of scope
    (see "What 'this page' means here," above).
11. **The admin pledges table already resembles the cited professional pattern, and needs the least
    change of anything audited.** `app/admin/page.js:552-566`: an `overflow-x-auto border rounded-xl`
    wrapper, an uppercase `text-[10px]` gray column header row, `divide-y divide-neutral-100` row
    separators, hover-highlighted rows. This is close to Research item 2's cited Stripe-dashboard pattern
    already — dense table, muted gridlines, right-aligned figures — and is evidence that this plan's
    target look is achievable in this codebase; it is not a foreign import.
12. **Admin filter pills and public filter chips are two different visual treatments of the same
    control.** `/admin`'s pledge-status filter (`app/admin/page.js:502-518`, "All (n) / Pending (n) / Paid
    (n)") is `rounded-full` with a solid `bg-brand-800` fill on the active pill. The public page's
    equivalent (`app/page.js:558-575` `FILTER_CHIPS`, "All Items / Needs Support / …") is `rounded-md` with
    a lighter `bg-accent-100` tint on the active chip. Same interaction, same underlying pattern
    (single-select toggle group), two unrelated visual treatments and two different accent colors.
13. **Both category tabs and filter chips are already extracted to typed constants, from the prior plan's
    Step 9.** `CATEGORY_TABS` and `FILTER_CHIPS` (`app/page.js`, module scope, added in
    `CardUX_feat/filters`) are the single source of truth for both the rendered controls and the empty-state
    message. Any restyle of these controls edits one render site each; the data does not need touching.
14. **The reference screenshot's actual UI chrome uses none of the patterns in Context 1-9, deliberately.**
    Read directly from the image the user supplied: the "browser window" frame and its violet backdrop are
    a *presentation device* for the screenshot, not part of the product's own UI — everything inside the
    white window is the actual design. Inside it: a flat white background throughout, no gradient
    anywhere in the product chrome; card/row borders are a single hairline gray, and the only shadow of any
    weight is the outer frame (a screenshot-presentation artifact, not a product style); the one primary
    button ("Create Project") is a small, solid, moderately-rounded (~8-10px) indigo fill with no gradient
    and no lift-on-hover; section navigation ("Contributions / Orders / Favorite Projects / Inbox") is
    plain text with a colored underline under the active item, no pill background; the contribution
    "cards" are actually table rows — a small uppercase gray label row (CONTRIBUTION DATE / PROJECT /
    STATUS / PROJECT OWNER / REWARD) sits above each entry's content, and the status column ("Live") is
    plain text with no badge; per-row actions are three buttons of visibly different weight stacked in a
    single fixed-width column (solid primary, light-gray secondary, lighter tertiary) rather than one
    button per row; typography is small throughout (roughly 12-14px body, an 18-20px page H1) and
    information-dense, not spacious.
15. **This is exactly "the Purple Problem," and the reference screenshot is itself an instance of it —
    which is the argument against copying its hue.** Research item 1 traces today's glut of
    indigo/violet-primary interfaces to Tailwind UI's own historical default (`bg-indigo-500`), reproduced
    at scale because so much of the web's training data was built on it. The reference app's indigo is not
    evidence that "professional" means indigo; it is evidence of the same default everyone else also
    inherited. What is transferable from the reference is the *restraint* — one saturated color, used only
    on the single primary action and the active-state indicator, everywhere else flat and neutral — not
    the specific hue.

\* `app/globals.css` line numbers below refer to the file as it stands after `CardUX_feat/filters`
(119 lines; the focus-ring rule occupies 74-100).

---

## Research: what "looks AI-generated" names, and what the cited professional alternative does instead

**1. The tells this plan removes are a named, catalogued phenomenon, not a matter of taste.** Tailwind's
own co-founder has publicly traced the glut of near-identical AI-generated interfaces to Tailwind UI's
historical default of `bg-indigo-500` on every button, reproduced at scale because so much of the training
data used it — commentators call this "the Purple Problem"
([DEV Community](https://dev.to/alanwest/why-every-ai-built-website-looks-the-same-blame-tailwinds-indigo-500-3h2p),
[Standard Beagle Studio](https://standardbeagle.com/the-year-ai-generated-interfaces-took-over/)). A
widely-cited checklist for spotting the resulting "AI slop" names, verbatim, several patterns this app
carries today: gradients and glows, a centered hero with a badge directly above the H1, icon-in-rounded-square
stat tiles, colored left borders on cards, `rounded-2xl shadow-lg` on every surface, and emoji used as
icons or decoration
([Developers Digest](https://www.developersdigest.tech/blog/ai-design-slop-and-how-to-spot-it),
[SmoothUI](https://smoothui.dev/blog/ai-design-slop)). Glassmorphism specifically is called out as a
"screams-AI-on-sight" pattern, and emoji-as-icon is flagged because no professional design system ships
emoji as iconography — it renders inconsistently across platforms and cannot be sized or recolored like a
real icon ([impeccable.style/slop](https://impeccable.style/slop/),
[vibecodekit.dev](https://vibecodekit.dev/ai-slop-design)). **Why this matters here:** Context 1-10 above
show this app currently exhibits essentially every item on that list, in the specific surfaces named.

**2. The cited professional alternative is "borders, not shadows," with color reserved for meaning.**
Linear and Vercel are named as the reference implementations of this pattern: a 1px border at roughly
8% opacity reads as cleaner and ages better across themes and screen densities than a soft drop shadow;
visual hierarchy comes from type weight and spacing, and color is spent only where it signals state —
never as decoration
([925studios, SaaS dashboard examples 2026](https://www.925studios.co/blog/saas-dashboard-design-examples-2026)).
Stripe's dashboard is the cited reference for dense data display specifically: a dense table as the
primary surface, right-aligned tabular figures, muted gridlines, and status shown as a small, low-weight
colored chip rather than a heavy bordered-and-tinted badge — rows are made scannable through hover state
and spacing, not loud borders
([DesignSystems.one, Stripe](https://www.designsystems.one/design-systems/stripe-design)). **Why this
matters here:** this is the specific, named alternative to Context 4 (shadow-heavy `rounded-2xl` surfaces)
and Context 8 (heavy bordered-and-tinted status pills) — not an aesthetic preference invented for this
plan.

**3. A denser admin view and a more spacious public view is documented, standard practice — not an
inconsistency to resolve away.** Shopify's Polaris design system states this split by name: high-density
layouts belong on information-rich, comparison-heavy interfaces (index pages, data tables), while
lower-density layouts belong on focused, single-task pages, which get larger hit targets and more room
([Shopify Polaris, Layout → Density](https://polaris-react.shopify.com/design/layout/density)). On
concrete numbers, standard-density table rows run 48-56px and compact rows 40-44px, trading
information-per-screen against scan comfort
([Pencil & Paper, Enterprise Data Tables](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables),
[Denovers, Enterprise Table UX](https://www.denovers.com/blog/enterprise-table-ux-design)). **Why this
matters here:** Context 11 already shows `/admin`'s pledge table converging on this pattern un-prompted;
this plan does not need to force the public page (a single-task "browse and pledge" surface) into the
same density to be "professional" — it needs the *decorative* tells removed, not the page turned into a
spreadsheet.

**What this does not justify.** None of the above argues for adopting the reference's indigo as this
app's brand color (Context 15), for restructuring the page's information architecture into a multi-page
dashboard with global nav (out of scope — this is a single-page public board plus a small admin console,
not a SaaS product), or for stripping every trace of personality from a page whose entire subject is a
family ceremony. The target is the removal of the *decorative* tells the research names, not a wedding
site turned into an operations console.

---

## Decisions

**D1 — Follow the reference for structure, type discipline, density, and restraint; keep the `brand` /
`accent` / `neutral` three-colour system rather than adopting the reference's indigo.** The system was
built deliberately (prior plan's Step 6), is now load-bearing across both pages, and Research item 1
(Context 15) is itself the argument against copying the reference's hue — its indigo is evidence of a
widely-inherited default, not evidence that indigo signals professionalism. What *is* adopted from the
reference is how sparingly it spends that one saturated color: one primary button, one active-tab
underline, one status accent — never smeared across borders, backgrounds, and badges at once.
*Rejected:* re-deriving the palette around indigo/violet to match the screenshot literally — it would
discard working, just-committed infrastructure to chase a hue that is itself the symptom Research item 1
describes, and would abandon the "Kwanjula" ceremony's own emerald-and-gold identity for no stated reason
beyond the reference happening to use a different color.

**D2 — `brand` (emerald) becomes the single, consistent primary-action color on both pages; `accent`
(gold) is reserved for money figures, the funding-progress indicator, and true one-off emphasis.** This
resolves Context 7 (accent buttons on the public page, brand buttons on `/admin`, with `@theme`'s own
comment already saying "brand … primary actions") by making the code match the documentation instead of
changing the documentation to match the drift. Concretely: "Make a Pledge Now," "Make General Pledge," and
the item-card "Pledge for this Item" button move from gold to solid emerald; gold stays on money amounts,
the "Remaining Balance" stat tile, and the progress-bar fill. *Rejected:* standardizing on accent/gold
instead — gold is the ceremony's traditional-value/attention color per the existing role comment, and
overloading it onto every button as well would leave nothing distinct for "this is a number that matters."

**D3 — Remove every gradient from UI chrome; every fill becomes a single flat color.** This affects the
hero background (D5 below), both pledge-CTA buttons, the progress-bar fill, the general-pledge callout
background, and the payment-channels section background — all currently `bg-gradient-to-*`
(Context 1, 4). *Rejected:* keeping gradients but muting their stop colors closer together — still reads
as the named tell (Research item 1) at any saturation; the fix is removing the technique, not softening
it.

**D4 — Replace glassmorphism in the payment-channels section with flat, bordered cards; keep the section
itself dark.** `bg-white/10 backdrop-blur-md`, `bg-white/5 backdrop-blur-md`, and the `bg-black/30`/`/40`
translucent chips (Context 5) become solid `brand-900`/`brand-800` card fills with a plain 1px border,
inside an unchanged dark `brand-950` section. The section stays dark deliberately — it is the one
visual break between "browse the budget" and "here is how to actually pay," and removing the color break
entirely would cost that signal. *Rejected:* moving the whole section to a light background to eliminate
glass entirely — it would flatten the page into one long light scroll with no visual rhythm, which the
reference itself avoids by varying weight (its header bar is a distinctly different tone from its content
area) even though it never uses transparency to do it.

**D5 — The hero drops its decorative dotted-pattern overlay and its badge-above-H1; the eyebrow, if kept,
is plain small-caps text with no pill.** Context 1 names both as catalogued tells (Research item 1). The
badge either disappears entirely (H1 becomes the first thing in the hero) or becomes unstyled uppercase
text with letter-spacing and no background, border, or icon-in-a-pill treatment.
*Rejected:* keeping the pill but changing its color — the shape itself (floating badge directly over an
H1) is what's named, independent of color.

**D6 — Radius and shadow both come down to a restrained, two-tier scale: `rounded-lg` (cards, inputs,
buttons) and `rounded-full` reserved for genuinely circular elements (avatars, status dots, icon-only
round buttons); shadows drop to `shadow-sm` at most on resting surfaces, with `shadow-md`/`shadow-lg`
reserved for genuinely elevated surfaces (modals, dropdowns, toasts) — never for a card sitting in normal
page flow.** This directly targets Context 4 and Context 9 (the `rounded-2xl/3xl shadow-lg/xl/2xl`
combination as the default, plus the hover-lift transform that reinforces the same "floating card"
read), and is the concrete form of Research item 2's "borders, not shadows." Hover state becomes a border
or background-tint change, never a translate. *Rejected:* a single universal radius/shadow value — modals
and toasts are genuinely elevated above the page (they interrupt it) and the reference itself does keep
its dropdown/tooltip elements shadowed even though its cards are flat; collapsing that distinction would
either make modals look like they belong in the page flow or drag every card up to modal-weight visually.

**D7 — Status stops being a heavy tinted-and-bordered pill; it becomes a small colored dot plus plain
text, on both pages.** Directly matches Context 14's reading of the reference ("Live" as plain text, no
badge) and directly answers Context 8 and Context 12 (two unrelated pill treatments for the same kind of
control). One shared visual pattern — dot + label — replaces the item-card funding badge, the admin
pledge-status chip, and unifies the public filter chips with the admin filter pills into the same
underline-or-outline toggle-group treatment. *Rejected:* keeping the pill shape but removing only the
border or only the uppercase tracking — piecemeal softening still reads as a badge; the fix is changing
what kind of thing it visually is.

**D8 — All eight `font-serif-royal` headings move to the existing Outfit sans, at a smaller, more
restrained type scale; the couple's names keep their emphasis through weight and size, not typeface.**
Directly answers Context 6. `.font-serif-royal` and its Google Fonts imports (Playfair Display, Cinzel;
`app/layout.js`) are deleted once nothing references the class. *Rejected:* keeping the serif solely for
the couple's names in the hero, as a single deliberate "personality" touch — tempting, and the nearest
runner-up, but the request was to remove *all* the generic elements, and a lone serif accent inside an
otherwise fully sans-serif, restrained, professional page reads as exactly the kind of inconsistent
type-mixing the cited professional references (Research item 2) don't do. If the user wants that touch
back after seeing the result, it is a one-line revert of this single decision, not a structural change.

**D9 — Decorative emoji are removed from all UI copy on both pages (toasts, activity messages); the
already-established `react-icons/fa6` set is used wherever the emoji stood in for an icon, and the text
stands alone wherever it did not.** Answers Context 10, and keeps the icon migration's own precedent
(icons-not-emoji) consistent across every surface it touches. `lib/mailer.js`'s email templates are
explicitly untouched (scope boundary stated above); their emoji is a separate, later decision if the user
wants it addressed.

**D10 — Page structure and both pages' information architecture are unchanged.** No section is added,
removed, reordered, or moved between pages; `/admin`'s three tabs stay three tabs; the public page's
seven sections (announcement bar, hero, stats, budget items, general-pledge callout, Roll of Honor,
payment channels, footer) stay seven sections in the same order. This is a restyle of *how* each existing
piece of content is presented, not a rewrite of *what* content exists or where. *Rejected:* adopting the
reference's top-nav-plus-content-area shell (logo, Explore/My Projects nav, global search, avatar) as a
new page shell — this app is a single public page and a small admin console, not a multi-page product;
importing that shell would add navigation with nothing behind it to navigate to.

---

## Steps (each = one commit; each ends with a Session-log entry)

### Phase A — Shared foundations

#### Step 1 — Type scale, radius/shadow convention, and the primary-action color, in one place.
Delete `.font-serif-royal` from `app/globals.css` and its Google Fonts `<link>` from `app/layout.js`
(D8); every `font-serif-royal` class is removed from both page files in the same commit, since leaving
even one orphaned reference would silently keep loading the deleted class. Document the radius/shadow
convention from D6 as a comment in `app/globals.css` next to the `@theme` block, so it is discoverable the
same way the color-role comment already is, rather than existing only in this plan. **Verify:** `grep -rn
"font-serif-royal\|Playfair\|Cinzel" app/ node_modules/next/dist/docs` (excluding node_modules) returns
nothing outside this plan; `next build` clean; every heading on both pages renders in Outfit at the sizes
Step 2/4 set, confirmed visually.

### Phase B — Public page

#### Step 2 — Rebuild the hero: no gradient, no dotted overlay, no badge-over-H1, restrained scale (D3, D5).
Flat `bg-brand-950` (or a single darker/lighter neutral if a flat emerald reads too heavy at full-bleed
width — decide by eye against the built page, not in the abstract); delete the radial-gradient overlay
div; the eyebrow becomes plain uppercase small-caps text or is removed outright; H1 drops from
`text-3xl sm:text-5xl` to a more restrained `text-2xl sm:text-4xl`; both CTA buttons drop their gradients
and hover-lift transforms per D3/D6, with the primary one recolored to solid `brand` per D2.
**Verify:** no `bg-gradient-to-*`, no `bg-[radial-gradient` string, and no `hover:-translate-y` remains in
the hero's JSX; the hero renders correctly at 390px and 1440px; both CTAs still open their respective
modals/scroll targets unchanged.

#### Step 3 — Stat tiles and the funding-progress bar drop the icon-in-square treatment and the gradient fill (D3, D6).
The four stat tiles lose `hover:-translate-y-1` and their `rounded-xl` icon squares shrink or are
replaced with a plain small icon beside the label (not boxed); tiles drop to `shadow-sm`/border-only. The
overall funding-progress bar (`app/page.js:530`) loses its three-stop gradient fill for a single flat
`brand` fill. **Verify:** all four figures (Total Budget, Total Raised, Remaining, Supporters) still read
correctly from `stats`; the progress bar's width calculation is untouched, only its fill color; 390px/1440px
screenshots show no layout regression.

#### Step 4 — Item cards: remove the colored status rail, replace the funding badge with dot+text (D2, D6, D7).
`app/page.js:737-743`'s `absolute … w-1.5` rail is deleted; the funding badge
(`app/page.js:753-761`) becomes a small colored dot (brand/accent/neutral matching the existing
covered/partial/needs-support logic) plus plain-weight text, no pill background or border; the "Pledge
for this Item" button recolors from accent to brand (D2) and drops its gradient if any remains after Step
2/3's sweep. The `<details>` contributor disclosure from the prior plan's Step 8 is untouched structurally
— only the surrounding card chrome changes. **Verify:** all three funding states (covered / partial /
needs-support) remain visually distinguishable via dot color + text, not rail position, since the rail is
gone; the disclosure still opens/closes exactly as before; a screen reader still gets the same information
(the badge text, not a color, carries the state — confirmed unchanged from the prior plan's contrast work).

#### Step 5 — Category tabs and filter chips converge on one shared toggle-group treatment (D7).
`CATEGORY_TABS` renders as underline tabs (plain text, colored underline on the active one, matching
Context 14's reading of the reference's own section nav) rather than filled pill buttons.
`FILTER_CHIPS` becomes a lighter bordered toggle group — active state is a border-and-text color change,
not a filled tint — visually consistent with the admin pledge-status filter this same step also
restyles (D7, Context 12). No change to `activeCategory`/`activeFilter` state or to the `filteredSections`
logic. **Verify:** clicking each tab/chip still filters exactly as it did before (cross-check against the
prior plan's Step 9 result-count verification); keyboard focus ring (prior plan, `CardUX_feat/filters`)
still shows correctly on the new control shapes; 390px renders without horizontal scroll on the tab row.

#### Step 6 — General-pledge callout, Roll of Honor, and payment channels drop gradients, glass, and heavy shadow (D3, D4, D6).
The callout background becomes a flat tinted surface instead of a two-stop gradient. The Roll of Honor
section drops `rounded-3xl`/`shadow-md` to the Step-1 convention; its individual contributor cards are
otherwise already close to the target (Context notes none of the audited tells there beyond radius/shadow).
The payment-channels section keeps its dark background (D4) but its three contact cards become flat
`bg-brand-900`/`brand-800` with a 1px border, no `backdrop-blur`; the black/30-40 translucent number chips
become a plain darker-flat row. **Verify:** the WhatsApp deep link, tel: links, and copy-to-clipboard
buttons all still work unchanged; contrast of white text on the new flat dark card backgrounds still meets
WCAG AA (checked the same way the prior plan's Step 6 checked the three-colour system — compute, don't
assume).

#### Step 7 — Modals (pledge submission, success, and their shared shell) drop `rounded-3xl`/`shadow-2xl` to the Step-1 convention; emoji removed from toast/success copy (D6, D9).
Modal shells keep meaningfully more shadow than page content (D6's stated exception for elevated
surfaces) but move off the heaviest `rounded-3xl`/`shadow-2xl` pairing to `rounded-lg`/`shadow-lg`. The
success-modal confetti burst (`app/page.js:244-250`) is left as a functional celebration effect —
distinct from a static decorative UI pattern, and not named in either research checklist — but its
trigger copy and the live-pledge toast both drop their emoji per D9. **Verify:** the pledge submission
flow (open → fill → submit → success modal → confetti → toast) works end to end unchanged; no emoji
string remains in `app/page.js`'s toast/success copy (checked by the same grep used in Context 10, rerun
after the edit).

### Phase C — Admin page

#### Step 8 — Admin shell, login screen, and settings cards drop to the Step-1 radius/shadow convention; primary buttons recolor to brand only where they weren't already (D2, D6).
`/admin`'s outer shell (`app/admin/page.js:397`), the passcode screen, and the three settings cards move
off `rounded-3xl` to the shared convention. Since `/admin`'s primary buttons were already brand-colored
(Context 7), this step is verification-and-consistency more than a color change — the remaining work is
radius/shadow and removing the two emoji instances (Context 10) and the `hover:-translate-y` equivalents
if any exist here. **Verify:** login still works with the correct passcode and still refuses an incorrect
one (re-run the prior plan's Step 3 cookie-session checks to confirm the restyle touched nothing
functional); all three settings cards save correctly.

#### Step 9 — Admin pledge-status filter pills converge with the public filter-chip treatment from Step 5; the pledge-status chip in the table becomes dot+text (D7).
Closes the Context 12 inconsistency from the other direction: the admin filter pills
(`app/admin/page.js:502-518`) adopt the same toggle-group shape Step 5 gave the public filter chips, and
the per-row status chip (`:610-617`) becomes the same dot+text pattern Step 4 gave the public item-card
badge. The table itself (Context 11) is otherwise left alone — it was already the closest thing in the
app to the cited professional pattern. **Verify:** filtering by All/Pending/Paid still works; toggling a
row's Paid/Pledged status still updates correctly; the CSV export and offline-pledge-add actions are
unaffected (this step touches no handler, only `className` strings).

---

## Risks

1. **A visual restyle across ~30 distinct surfaces, by hand, with no visual regression tests in this
   repo.** As in the prior plan's Step 6 (the color sweep) and Step 4 (moving ~475 lines of admin JSX),
   the only safety net is the walk-through in each step's Verify line, done in full, in the browser,
   before moving to the next step — not assumed from reading the diff.
2. **D2's color reconciliation (accent → brand on the two public pledge CTAs) is a visible brand change,
   not just a restraint pass.** It should read as correct once built — gold reserved for money, green for
   action, matching the color-role comment that already existed — but it is worth a deliberate look at
   the built result specifically for this change, since it is the one decision in this plan that alters
   what color something *is*, not just how heavily it's styled.
3. **Removing the item-card status rail (Step 4) removes a signal some users may have relied on for
   fast left-edge scanning down a long list.** The dot+text replacement is verified for information
   parity (Step 4's Verify line), but "scanning a color strip down the left edge of a list" and "reading a
   dot next to each row's title" are different reading patterns. If this reads worse in practice than in
   principle, restoring a *thin* (not `w-1.5`) rail without the border-and-badge stacking that made it a
   named tell is a small, isolated change — not a reason to revert the whole plan.
4. **The payment-channels section (Step 6) is the one place D4 keeps a dark, visually distinct surface
   deliberately.** Getting the flat-dark-card contrast right (Verify line requires computing it, per the
   prior plan's established practice) matters more here than anywhere else in this plan, because it is
   the one section design intentionally keeps different from the rest of the now-uniformly-flat, mostly
   light page.
5. **Step 8/9 touch `/admin`, which is behind the passcode-and-session work from the prior plan.** A
   restyle mistake there is not visible without logging in first — remember to check both the logged-out
   (passcode screen) and logged-in states explicitly, not just the one that happens to be open.

## Verification (end-to-end, after Step 9)

1. Neither `font-serif-royal` nor its Google Fonts import remain anywhere in `app/`; `next build` is clean.
2. No `bg-gradient-to-*`, no `bg-[radial-gradient`, no `backdrop-blur`, and no `hover:-translate-y` remains
   in `app/page.js` or `app/admin/page.js`, except the deliberately-kept `.modal-backdrop` scrim (Context 5).
3. No surface in normal page flow (i.e., not a modal, dropdown, or toast) carries `rounded-2xl`,
   `rounded-3xl`, `shadow-lg`, `shadow-xl`, or `shadow-2xl`.
4. Every primary action button on both pages is the same `brand` color; `accent` appears only on money
   figures, the progress-bar fill, and any remaining true one-off emphasis.
5. Every status indicator (item-card funding state, admin pledge status) is the dot+text pattern; the
   public filter chips and the admin filter pills share one visual treatment.
6. No decorative emoji remains in `app/page.js` or `app/admin/page.js` UI copy.
7. The full pledge flow (submit → confetti → success → live toast on another browser tab → admin sees it
   in the pledges table) works end to end; `/admin` login, all three tabs, CSV export, and offline-pledge
   add all work unchanged.
8. WCAG AA contrast holds for text on every recolored/reflattened surface, computed (not eyeballed) the
   same way the prior plan's Step 6 computed it — especially the flattened payment-channels cards (Risk 4).
9. 390px and 1440px screenshots of both pages show no horizontal overflow and no broken layout anywhere
   touched by Steps 2-9.
10. Visually, side by side with the reference screenshot: flat surfaces, hairline borders where the
    current build has shadows, one consistently-used primary color, dot+text status instead of pills, and
    no gradient, blur, or badge-above-headline anywhere — while remaining recognizably the Kwanjula budget
    page, not a copy of the reference's own content or navigation shell (D10).

## Execution prompts

1. Sonnet 5 · `Redesign_feat/foundations: type scale, radius/shadow convention, primary-action colour` —
   Step 1.
2. **Opus 5** · `Redesign_feat/hero: flat colour, no dotted overlay, no badge-over-h1` — Step 2 (the
   single highest-visibility surface in the app; get this one right before the rest follow its lead).
3. Sonnet 5 · `Redesign_feat/stats-progress: flat fills, no icon-square lift` — Step 3.
4. **Opus 5** · `Redesign_feat/item-cards: dot-and-text status, no rail` — Step 4 (Risk 3 — the one
   change with a real information-parity question to verify, not just a style swap).
5. Sonnet 5 · `Redesign_feat/tabs-and-chips: one shared toggle-group treatment` — Step 5.
6. **Opus 5** · `Redesign_feat/payment-section: flat dark cards, no glass` — Step 6 (Risk 4 — the one
   surface design keeps deliberately different, and the one place contrast must be computed, not assumed).
7. Sonnet 5 · `Redesign_feat/modals: shadow convention, no emoji in toasts` — Step 7.
8. Sonnet 5 · `Redesign_feat/admin-shell: shared convention, no emoji` — Step 8.
9. Sonnet 5 · `Redesign_feat/admin-status: dot-and-text, shared chip style` — Step 9.

---

## Session log

*(Appended per step, in the same commit as the work.)*

### Step 1 — `Redesign_feat/foundations: type scale, radius/shadow convention, primary-action colour`

**The primary-action colour reconciliation (D2) is scoped to Steps 2 and 4, not this one.** Step 1's own
body text — unlike its title — only ever described the font removal and the radius/shadow convention;
the actual button recolouring happens where the buttons themselves are touched (the hero CTAs in Step 2,
the item-card pledge button in Step 4). This step establishes the *documented* convention only, the same
way the `brand`/`accent`/`neutral` role comment documents colour without a lint rule enforcing it.

**All ten `font-serif-royal` occurrences (8 in `app/page.js`, 2 in `app/admin/page.js`) were removed by a
script matching the class both mid-string and at the end of a `className`**, rather than by hand, since a
manual sweep across two large files risks missing one and leaving an orphaned reference that would keep
the deleted Google Fonts weights loading for nothing. `.font-serif-royal`'s definition and the Playfair
Display / Cinzel weights in `app/layout.js`'s font `<link>` are deleted in the same commit — only
`Outfit` remains.

**The radius/shadow convention is written as a comment in `app/globals.css`, next to the colour-role
comment it deliberately matches in tone and placement**, so a future pass has one place to find both
documented conventions rather than needing to reconstruct the reasoning from this plan file.

**Verified:** `grep -rn "font-serif-royal|Playfair|Cinzel" app/` returns nothing; `next build` is clean;
the hero H1 computed `font-family` is `Outfit, …` in the browser, confirmed live rather than assumed from
the diff.

### Step 2 — `Redesign_feat/hero: flat colour, no dotted overlay, no badge-over-h1`

**Every tell named in Context 1 is gone from the hero specifically.** The gradient (`bg-gradient-to-br
from-brand-950 via-brand-900 to-brand-900`) is a flat `bg-brand-950`; the decorative dotted radial-gradient
overlay div is deleted outright; the pill badge sitting above the H1 ("THE KWANJULA BUDGET" in a bordered,
tinted, icon-bearing pill) is now plain uppercase small-caps text with no background, border, or icon — the
`<FaGem>` import that only served that badge is removed along with it. The H1 drops from
`text-3xl sm:text-5xl font-extrabold` with a `drop-shadow-md` to a plainer `text-2xl sm:text-4xl font-bold`
with no drop-shadow; the "&" loses its `italic font-serif` styling (a second, smaller serif-touch this
plan's Step 1 pass on `.font-serif-royal` didn't reach, since it was a bare Tailwind `font-serif` utility,
not the custom class). The subtitle scales down from `text-lg sm:text-2xl` to `text-base sm:text-lg` to
match.

**All four hero buttons lose their gradients, heavy shadows, and hover-lift transforms (D3, D6, D9).** The
primary CTA drops its three-stop `from-accent-500 to-accent-600` gradient, `shadow-lg shadow-accent-600/30`,
and `hover:-translate-y-0.5` for a flat fill and a plain background-color hover state — and is recoloured
from accent (gold) to brand (emerald) per D2, which this step is the first to actually execute (Step 1
only documented the convention). The two outlined buttons (PDF, Mobile Money) move from translucent
`bg-brand-950/80` / `bg-brand-800/60` fills with soft borders to a single flat treatment: transparent
background, a plain `border-brand-700`, `hover:bg-brand-900`.

**Contrast was computed, not assumed, and it caught a real failure before it shipped.** White text on the
first choice of primary-button fill, `brand-600` (#059669), measured 3.77:1 — below the 4.5:1 AA minimum
for normal-weight text at this size (the button text is bold but only 14-16px, under the 18.66px bold
threshold WCAG's "large text" exception requires). Moved to `brand-700` (#047857): 5.48:1. Hover state
moved to `brand-800` rather than a lighter shade, so it gets *more* readable on interaction, never less.
The eyebrow (`accent-400` on `brand-950`), subtitle (`brand-200`), and both outlined-button label colors
(`accent-300`, `brand-100`) were all separately computed against the flat `brand-950` background and clear
9:1 or better.

**Verified:** built and loaded in the browser — the primary button's computed background is
`rgb(4, 120, 87)` (`#047857`, confirmed brand-700, not the color initially written); the pledge modal
still opens and closes from the hero's primary CTA; a fresh grep of the hero's JSX for
`bg-gradient|radial-gradient|hover:-translate|shadow-xl|shadow-lg|shadow-2xl` returns nothing; 390px
viewport shows zero horizontal overflow.

### Step 3 — `Redesign_feat/stats-progress: flat fills, no icon-square lift`

**All four stat tiles drop the icon-in-rounded-square treatment Context 3 named as a checklist match.**
Each tile's `w-13 h-13 rounded-xl bg-{colour}-{50/100/200} … flex items-center justify-center` icon
container is gone; the icon is now a plain, unboxed glyph sitting beside the label text, sized
`text-lg`. `hover:-translate-y-1` is removed from all four (D6, D9); `rounded-2xl shadow-lg` on every
tile becomes `rounded-lg border border-neutral-200` (or a coloured equivalent, see next). The two tiles
that previously carried a two-stop `bg-gradient-to-br from-white to-{colour}-50/50` wash (D3) are now a
single flat `bg-brand-50` / `bg-accent-50`.

**Contrast on the two new flat-tinted tiles was computed before shipping, matching the practice this
plan's Step 2 established.** `brand-700`/`brand-800` text on `brand-50` measures 5.21/7.29:1; `accent-700`
text on `accent-50` measures 4.84:1 — all comfortably clear AA for text. The two icons that sit on a plain
white tile (`accent-600` coins, `neutral-600` supporters) were checked against the lower 3:1 bar that
applies to decorative graphics rather than text, since both are `aria-hidden`: 3.19:1 and 7.58:1,
both passing.

**The funding-progress bar's three-stop `from-accent-500 via-brand-600 to-brand-500` gradient fill is now
a single flat `bg-brand-600`** (D3); its container drops from `rounded-2xl shadow-md` to
`rounded-lg border` matching the tile convention. The width calculation and the percentage/remaining-amount
text next to it are untouched — only the fill's own styling changed.

**Verified:** built and loaded in the browser — all four figures (Total Budget, Total Raised, Remaining,
Supporters) still read the live `stats` object correctly; the progress bar's inline `width` style
confirmed at the real computed `4%`, not a hardcoded placeholder. A scoped grep of this section's JSX for
`shadow-lg|shadow-xl|shadow-md|hover:-translate|bg-gradient|rounded-2xl` (plus the old
icon-in-square container shape) returns nothing. 390px viewport: zero horizontal overflow.

### Step 4 — `Redesign_feat/item-cards: dot-and-text status, no rail`

**The plan's own diagnosis of the "Pledge for this Item" button was slightly off, and the actual state
was less work than the plan assumed.** Step 4's write-up said the button "recolors from accent to brand" —
but on inspection its background/border/text (`bg-brand-50 hover:bg-brand-900 border-brand-300
text-brand-950`) were already brand; only the `<FaHandHoldingHeart>` icon inside it was accent-colored.
Recorded here rather than left to look like the plan and the diff disagree: the fix was recoloring one
icon (`text-accent-500` → `text-brand-700`, with `group-hover:text-white` added and a `group` class added
to the button so the icon follows the button's own hover-fill), not the whole button.

**The status rail (Context 2, a named checklist tell) is deleted outright** — the `absolute inset-y-0
left-0 w-1.5` span and the `overflow-hidden`/`relative` positioning it required on the card wrapper are
both gone, since nothing else in the card needed the card to clip its own children. The card's
`hover:shadow-md` also drops (D6) in favor of the existing `hover:border-neutral-300`, so hover state is a
border color change only, never an added shadow.

**The funding badge (Context 8) is now a small colored dot plus plain-weight text**, replacing
`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider` with a coloured background
*and* border *and* uppercase tracking stacked on one label. The three states keep their existing colour
logic (brand/accent/neutral) — only *how* that colour is expressed changed, from a heavy bordered pill to
a 6px dot beside `text-xs font-semibold` text.

**Risk 3's information-parity question was checked, not assumed.** Every one of the three funding states
still carries a text label that alone disambiguates it ("Covered" / "100% Funded" / "X% Supported" /
"Needs Support" were always the actual source of truth, never the rail's position) — and the covered
state additionally keeps its own card-level tell independent of anything this step touched: the wrapper's
`border-brand-300 bg-brand-50/20` highlight for `isCovered` cards was already there before this step and
is untouched, so a covered card is still visually distinct from a glance at the whole card, not only from
reading its dot. The dot itself adds a second, redundant signal for partial vs. needs-support that the
rail also used to carry (colour), so nothing that was previously conveyed only by colour is now conveyed
only by text — colour is still present, just relocated from a 6px-wide strip down the entire card height
to a 6px dot beside the label it describes.

**The item-card's own per-item progress-bar fill lost its gradient too** (`bg-gradient-to-r from-accent-500
to-accent-600` → flat `bg-accent-600`) — this is a *different* progress bar from the page-level one Step 3
already flattened, and Step 3 never claimed to reach it; fixing it here keeps the whole item-card redesign
in one step rather than leaving one flagged gradient for a later pass to rediscover.

**Verified:** built and loaded in the browser. A covered card's dot computes to `rgb(5, 150, 105)`
(`brand-600`) with its card border at `rgb(110, 231, 183)` (`brand-300`) and its disabled "Fully
Sponsored" button present; contrast for all three dot-label text colours on white — `accent-700` 5.02:1,
`neutral-600` 7.58:1, `brand-700` 5.48:1 — clears AA. Clicking "Pledge for this Item" still opens the
pledge modal with the correct item pre-selected. The contributor `<details>` disclosure (prior plan's
Step 8) still opens/closes correctly after the wrapper restructuring. A scoped grep of the item-card JSX
for the rail, the pill-badge shape, any remaining gradient, and `hover:shadow-md` returns nothing. 390px
viewport: zero horizontal overflow.

### Step 5 — `Redesign_feat/tabs-and-chips: one shared toggle-group treatment`

**Scoped to the public page only — the admin pledge-status filter stays for Step 9, as that step's own
description already fully owns it.** Step 5's body text named the admin filter as something "this same
step also restyles," which duplicates Step 9's dedicated scope; rather than do the same change twice (or
half of it here and half there), this commit touches only `app/page.js`'s `CATEGORY_TABS` and
`FILTER_CHIPS`, leaving the admin pledge-status filter and pledge-status chip exactly where Step 9 already
describes them.

**`CATEGORY_TABS` renders as plain-text underline tabs, matching Context 14's reading of the reference's
own section nav** ("Contributions / Orders / Favorite Projects / Inbox" — plain text, a colored underline
on the active item, no pill background). The five per-icon lookups
(`FaBorderAll`/`FaAward`/`FaShirt`/`FaBasketShopping`/`FaClapperboard`) are dropped along with their now-dead
imports and the now-unused `icon` field on each `CATEGORY_TABS` entry — the reference's own nav has no
icons at all, and keeping unused icon data around after removing its only reader would be exactly the kind
of orphaned reference this plan's Step 1 was careful to avoid for `.font-serif-royal`.

**`FILTER_CHIPS`'s active state changes from a filled, accent-tinted pill (`bg-accent-100 border-accent-400
text-accent-900`) to a plain-white chip with a `brand-700` border and text (D7).** Brand rather than accent
for the active indicator, matching D2's reservation of accent for money/progress/emphasis rather than
UI-state signaling.

**Verified:** built and loaded in the browser. Selecting "A: Important Gifts" + "Fully Covered" together
correctly narrows the result count to "Showing 0 of 40 items," and "Clear filters" restores "Showing 40 of
40" — the filtering logic (`activeCategory`/`activeFilter` state, `filteredSections` memo) was never
touched, only the controls' `className`s. The active tab's computed `border-bottom-color` and the active
chip's computed `border-color` both resolve to `rgb(4, 120, 87)` (`brand-700`). The keyboard focus ring
(prior plan's `CardUX_feat/filters`) still shows on both control shapes — confirmed via `getComputedStyle`
after a real `.focus()` call, `rgb(255, 255, 255) 0px 0px 0px 2px, rgb(217, 119, 6) 0px 0px 0px 4px`,
matching the white-plus-accent-600 ring established there. 390px viewport: zero horizontal overflow on the
scrollable tab row.
