# An Admin Route of Its Own, a Three-Colour System, react-icons, and Contributors Behind a Disclosure

2026-08-28 — plan for branch `feat/admin-and-design-system`, to be cut from `main` (the repo has one
branch and one commit, `60253ee first commit`, and the entire application is still untracked). Moves the
committee admin surface out of a modal buried in the public page and onto its own authenticated route,
collapses seven Tailwind colour families to a three-colour token system, replaces 67 CDN Font Awesome
tags with `react-icons`, and puts each item's contributor list behind a disclosure on the card. Format
follows `plans/batch-scoring-origin-tabs-dataset-catalog-and-frontend-security.md` (in the
Credit-scoring-system repo): verified Context with file:line, numbered Decisions naming rejected
alternatives, one commit per step with a Verify line, then Risks, end-to-end Verification, per-step
Execution prompts with model selection, and a Session log appended per step.

**Conventions.** Commit prefixes: `Sec_*` (the second admin console, the passcode, the secrets on disk),
`Admin_*` (the `/admin` route, its session, its settings), `Design_*` (colour tokens and icons),
`CardUX_*` (the contributor disclosure and the page-usability pass). No AI co-author trailers. Every
commit updates this plan's Session log in the same commit; commits that change observable behaviour also
update `README.md`, whose "Overview" currently describes behaviour this plan changes.

**Phase A ships first and independently.** `public/index.html` is a complete, live, second copy of this
application — including a fully wired admin console — that Next serves at `/index.html` and that prints
the default passcode on screen (Context 5). `data/settings.json` holds that passcode in plaintext, is not
gitignored, and is one `git add` away from being committed forever (Context 7). Neither depends on
anything else in this plan, and neither should wait behind a design system.

**A note on the requested "frontend design skill".** There is no such skill in this environment. The
skills that exist (`artifact-design`, `dataviz`, `design`) all target *Artifacts* — standalone published
pages — not edits to a Next.js app, and `design` produces a separate mockup canvas rather than touching
`app/`. The usability work in Phase D is therefore grounded in the page's own measured problems
(Context 10, 11, 14, 15) and in the published guidance cited under Research, not in a skill.

---

## Context (verified 2026-08-28)

1. **A complete admin API already exists — nine route handlers.** `app/api/admin/verify/route.js`,
   `settings/route.js`, `notifications/route.js`, `test-email/route.js`, `export/route.js`,
   `pledges/route.js` (GET list + POST offline pledge), `pledges/[id]/route.js` (DELETE) and
   `pledges/[id]/status/route.js` (POST). Listing, creating, deleting, re-statusing, exporting to CSV,
   reading the notification outbox, editing settings and sending a test email are all already
   implemented server-side. **"Add an admin side" is not a backend project — it is a routing, session
   and UI project.**
2. **An admin UI already exists too, as a modal inside the public page.** `app/page.js:1529-2004` is the
   "COMMITTEE ADMIN PORTAL" modal with three tabs — Pledges (`:1614`), Notifications outbox (`:1778`),
   Settings & SMTP (`:1827`). It is opened from the top announcement bar (`:590`) and from the footer
   (`:1217`). There are two further admin-only modals after it: Add Offline Pledge (`:2005`) and Email
   HTML Preview (`:2141`).
3. **The "email to receive notifications on" field the request asks for already exists.**
   `app/page.js:1863-1870` is a required `type="email"` input labelled "Recipient Alert Email" bound to
   `adminSettings.ownerEmail`; `lib/mailer.js:35` reads `settings.ownerEmail` as the `to:` address for
   every pledge alert, and `lib/mailer.js:151-161` sends it. The feature is present, wired end to end,
   and undiscoverable — it sits three clicks deep inside a modal on the public page, behind a passcode,
   under a heading that says "Groom / Committee Contacts" rather than anything about notifications.
   **This is the strongest single argument for the whole of Phase B: the request is not for a missing
   feature, it is for a findable place to put one.**
4. **That same notification-recipient address is published to anyone who asks.**
   `app/api/admin/settings/route.js:11-19` returns `ownerEmail` in the *unauthenticated* branch of `GET`,
   so `curl http://host/api/admin/settings` hands out the alert inbox with no passcode. It is
   additionally hardcoded in `README.md:15` and in `.env.example:5`.
5. **`public/index.html` is a live second copy of the entire app, admin console included.** 31 KB of
   HTML plus `public/css/styles.css` (36 KB) and `public/js/app.js` (38 KB). Next serves everything under
   `public/` verbatim — `GET /index.html` returns **200** against the running dev server. Its JavaScript
   calls the same live endpoints: `/api/budget`, `/api/pledge`, `/api/admin/verify`, `/api/admin/export`,
   `/api/admin/pledges`, `/api/admin/notifications`, `/api/admin/settings`, `/api/admin/test-email`
   (`public/js/app.js:156,560,624,638,714,735,750,787,823,855`). And `public/index.html:522` renders the
   passcode field with `placeholder="Enter PIN (Default: edwin2026)"` — the admin passcode is printed on
   a page anyone can load. It also calls `/api/pledges` (`:652`), a route that does not exist in `app/`,
   so it is unmaintained as well as live.
6. **The passcode is the entire authentication system, and it travels badly.** Every admin route compares
   a raw `x-admin-pin` header against `settings.adminPin || 'edwin2026'` — the literal string
   `'edwin2026'` is hardcoded as a fallback in seven files (`verify/route.js:9`, `settings/route.js:9,29`,
   `notifications/route.js:10`, `test-email/route.js:11`, `pledges/route.js:12,25`,
   `pledges/[id]/route.js:10`, `pledges/[id]/status/route.js:10`, `export/route.js:10`). The CSV export
   is worse: `app/page.js:1649` builds `href={/api/admin/export?pin=${encodeURIComponent(adminPin)}}` and
   `export/route.js:7` reads it from the query string, so the passcode lands in browser history, the
   server access log, and any proxy in between. `verify/route.js:12` returns
   `{ success: true, token: 'admin-ok' }` — a token that is a constant, is not a session, and which no
   caller ever uses; the client keeps re-sending the raw passcode instead.
7. **`data/settings.json` holds the passcode in plaintext, is not gitignored, and is not yet
   committed.** `data/settings.json:5` is `"adminPin": "edwin2026"`; `smtp.pass` (`:14`) is empty today
   and is written by the settings form the moment SMTP is configured. `git check-ignore` reports the file
   is **not** ignored, and `git status` lists `data/` as untracked — so nothing is in history yet. This is
   the one finding in this plan that is free to fix now and expensive to fix later.
8. **There is no admin session at all — the passcode lives in React state.** `app/page.js:45-46` are
   `useState('')` / `useState(false)`; `grep` finds no `sessionStorage`, `localStorage` or cookie use
   anywhere in `app/`. A page refresh logs the committee out, and every admin request re-sends the
   passcode as a header.
9. **Typing the passcode tears down the live budget feed.** The SSE effect at `app/page.js:118-183` has
   `[adminAuthenticated, adminPin]` as its dependency array (`:183`). `setAdminPin` fires on every
   keystroke, so each character closes the `EventSource`, re-runs `fetchInitialBudget()`, and opens a new
   stream. The effect's `es.onerror` also schedules `connectSSE()` on a 3-second `setTimeout` (`:150-155`)
   whose handle the cleanup at `:178-182` never clears, so a failing stream during typing can leave
   several reconnect timers racing.
10. **One file, one component, both audiences.** `app/page.js` is 2168 lines, `'use client'` at `:1`, a
    single `KwanjulaBudgetPage` component from `:26` to the end, with **31** `useState` calls — of which
    13 (`:44-69`, `:71-93`) exist only to serve the admin modal. Every visitor to the public page
    downloads and hydrates the entire committee console.
11. **Seven Tailwind colour families are in use on the page, not three.** Counting
    `bg|text|border|from|to|via|ring|divide|shadow` utilities in `app/page.js`: `slate` 213, `emerald` 160,
    `amber` 83, `rose` 15, `teal` 4, `red` 3, `purple` 2 — **480 utility occurrences across 7 families.**
    That count is the size of the mechanical part of the colour diff.
12. **A three-colour token system is already declared, and is almost entirely unused.**
    `app/globals.css:5-22` declares twelve custom properties in exactly the shape the request asks for —
    four emerald, five gold/accent, five neutral. Only two of them (`--bg-main`, `--text-main`) are ever
    consumed, both in the `body` rule at `:26-27`. The ten brand and accent tokens are referenced by
    nothing, in CSS or JS. Worse, `.pulse-dot` (`:41-45`) hardcodes `rgba(16, 185, 129, …)` — emerald-500,
    a *different* emerald from `--primary-emerald` (`#065f46`, emerald-800). The system exists; the app
    ignores it and drifts from it.
13. **Tailwind is v4.3.3, where `@theme` is the mechanism that turns tokens into utilities.**
    `node_modules/tailwindcss/theme.css` is itself an `@theme default` block, and `index.css` uses
    `@theme default inline reference`. Declaring the palette in a `:root` inside `@layer base`, as
    `globals.css` does today, produces custom properties that generate **no** utility classes — which is
    exactly why nothing uses them. `@theme { --color-brand-600: … }` generates `bg-brand-600`,
    `text-brand-600`, `border-brand-600` and the rest.
14. **Icons are 67 Font Awesome `<i>` tags fed by a CDN stylesheet.** `app/layout.js:15` links
    `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css` — a render-blocking
    request to a third-party host on every page load, alongside the Google Fonts links at `:12-14`.
    `app/page.js` contains 67 `<i className="fa-…">` elements over ~45 distinct icons. **`react-icons` is
    not installed** (npm resolves it at 5.7.0). **`lucide-react` 1.34.0 *is* a dependency in
    `package.json:24` and is imported nowhere in the repo** — a dead dependency.
15. **Every item already ships its complete contributor list to the browser.**
    `lib/budget-service.js:100-107` maps **all** of an item's pledges into `recentPledges` — the field
    name is misleading, there is no slice — with `name` already anonymised to `'Generous Well-wisher'`
    when `isAnonymous`, and `amount` already nulled when `hideAmount` (`:102-103`). `app/page.js:973-1004`
    renders them as always-visible chips under every card. **A contributor dropdown needs no API change
    and no new data — only a disclosure.**
16. **The page already has a disclosure precedent, and it is inconsistent with the cards.** The Roll of
    Honor collapses to 9 entries behind a "View All (n)" / "Show Less" button (`app/page.js:1009-1016`,
    `:1026`), while the item cards expand every contributor unconditionally. Two lists of the same data,
    two opposite defaults.
17. **`updateSettings` is a shallow merge.** `lib/budget-service.js:171-176` is
    `{ ...current, ...newSettings }`, so a POST carrying a partial `smtp` object replaces the stored one
    wholesale rather than merging it. Today the client always POSTs the whole settings object
    (`app/page.js:372-379`), which masks this; any narrower client — including the one Phase B
    introduces — would silently drop fields.
18. **This is Next.js 16.3.3, where `middleware.js` is deprecated and renamed to `proxy.js`.**
    `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md:11` states the
    rename; the changelog entry is `v16.0.0 | Middleware is deprecated and renamed to Proxy. Proxy
    defaults to the Node.js runtime` (`proxy.md:806`). The same doc says "We recommend users avoid relying
    on Middleware unless no other options exist" (`:783`) and "you should not attempt relying on shared
    modules or globals" (`:19`). The authentication guide is explicit that auth checks do **not** belong
    in a layout — "these don't re-render on navigation… A layout also does not control whether the rest of
    the route renders" (`02-guides/authentication.md:1352-1354`) — and recommends a Data Access Layer with
    a `verifySession()` guarded by `import 'server-only'` (`:1131-1160`), with Route Handlers "treated
    with the same security considerations as public-facing API endpoints" (`:1503`).
19. **`AGENTS.md` instructs reading `node_modules/next/dist/docs/` before writing code**, because this
    Next version's APIs and conventions differ from training data. Context 18 is a live example: an agent
    working from memory writes `middleware.js` and a layout-level auth check, and both are wrong here.
20. **`.env.example` documents environment variables the app never reads.** `ADMIN_PIN` is read once
    (`verify/route.js:9`) and ignored by the other eight routes, which read only `settings.adminPin`;
    `OWNER_EMAIL` is read once (`mailer.js:35`); and **none** of `SMTP_ENABLED`, `SMTP_HOST`, `SMTP_PORT`,
    `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (`.env.example:10-17`) are read anywhere —
    `lib/mailer.js:4-28` builds its transport exclusively from `settings.smtp`. The documented way to
    configure this app does not work.

---

## Research: what the request is really asking for, and what shipped practice says

**1. A dropdown of contributors is progressive disclosure, and the rules for it are settled.** Nielsen
Norman Group's guidance is to show the few most important options first and defer the rest to a second
level on request, and their accordion guidance is specific about the shape: accordions suit *many short
sections* (tabs suit few long ones), more than two levels of disclosure hurts usability, and the summary
must carry enough information scent that a user knows what they get by opening it
([progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/),
[accordions on desktop](https://www.nngroup.com/articles/accordions-on-desktop/)). **Why you should copy
it:** an item card is exactly "many short sections" — dozens of cards, each with a handful of
contributors — and the current page violates the rule in both directions at once, expanding every card's
contributors unconditionally (Context 15) while collapsing the Roll of Honor at nine (Context 16). The
information-scent rule is what makes the summary "Supporters (3)" rather than a bare chevron, and it is
why the count must stay visible when the panel is closed.

**2. Three colours is a proportion discipline, not a subtraction.** The 60-30-10 rule allocates a
dominant colour to surfaces and backgrounds, a secondary to structure and cards, and an accent to
calls-to-action and highlights — the value is the resulting hierarchy, so a user instantly knows where to
look ([LogRocket](https://blog.logrocket.com/ux-design/60-30-10-rule/),
[UX Planet](https://uxplanet.org/the-60-30-10-rule-a-foolproof-way-to-choose-colors-for-your-ui-design-d15625e56d25)).
Both sources make the same two operational points: put the colours in one place — CSS custom properties
or the Tailwind config — rather than scattering them through markup, and check the resulting pairs
against WCAG AA (4.5:1 for body text) because a proportion rule says nothing about contrast. **Why you
should copy it:** the "one place" is `@theme` (Context 13) and it is the difference between three colours
that hold and three colours that drift back to seven the next time someone adds a card — which is
precisely what happened to the tokens already sitting unused in `globals.css` (Context 12).

**3. A shared secret in a URL is the failure mode session management exists to prevent.** OWASP's Session
Management guidance is that session identifiers must not travel in query strings, because they are
recorded in web server logs, proxy logs and browser history, and leak onward through the `Referer`
header; the recommended carrier is an `HttpOnly` cookie, and the recommended shape is a session
identifier issued after authentication rather than the credential itself being replayed
([Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html),
[Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)).
**Why you should copy it:** this app does both prohibited things — it replays the credential itself on
every call as a header (Context 6) and it puts that credential in a URL for CSV export — and it already
has the right shape half-built: `verify/route.js:12` returns a token, it is simply a constant that
nobody uses. Issuing a real one into a cookie is a smaller change than it sounds.

**What this does not justify.** None of this argues for adding user accounts, roles, a password database,
or an auth library to a four-person committee's ceremony page. The threat model here is "a link gets
shared, a laptop gets borrowed, the repo goes public" — not credential stuffing. One shared passcode, held
in an environment variable, exchanged for a signed short-lived cookie, is proportionate; anything more is
ceremony of a different kind. It also does not justify a component-library migration: the request is
three colours and `react-icons`, not a rewrite.

---

## Decisions

**D1 — The admin surface moves to its own route, `app/admin/`, and leaves the public page entirely.**
`/admin` gets a passcode screen and, once authenticated, the three existing tabs (pledges, notifications
outbox, settings) plus the two admin modals. The public page keeps a single discreet link to it and drops
all 13 admin `useState` hooks, ~475 lines of admin JSX, and the admin fetch handlers. *Rejected:* keeping
the modal and merely polishing it — it is the literal reading of "add an admin side", but Context 3 shows
the request is about findability, and the modal is why the notification-email field the user asked for
already exists yet reads as missing. *Also rejected:* a separate application or subdomain — the API,
the data layer and the SSE stream are shared, and splitting deployment for a ceremony page buys nothing.

**D2 — Authentication becomes a passcode exchanged once for a signed, `HttpOnly`, `SameSite=Lax`
session cookie.** `POST /api/admin/verify` compares the submitted passcode against `ADMIN_PIN` from the
environment and, on success, sets a signed cookie with a bounded lifetime instead of returning the
constant `'admin-ok'`. Every other admin route reads the cookie. The `x-admin-pin` header and the
`?pin=` query parameter both disappear; CSV export becomes an authenticated `GET` that relies on the
cookie the browser already sends. This is Research 3, and it also fixes Context 8 for free — a cookie
survives a refresh, so the committee stops being logged out by F5. *Rejected:* keeping the header and
merely removing it from the export URL — it halves the exposure and leaves the credential replayed on
every request, which is the part OWASP is actually about. *Also rejected:* an auth library (NextAuth /
Auth.js) — user accounts, a provider config and a database migration to model one shared passcode.

**D3 — The passcode moves to the environment and stops being a settings field; a shared
`requireAdmin()` in a `server-only` module replaces nine copies of the comparison.**
`lib/admin-auth.js` exports `requireAdmin(req)` returning the session or `null`, and the seven hardcoded
`'edwin2026'` fallbacks are deleted — an unset `ADMIN_PIN` refuses to authenticate anyone rather than
silently accepting the published default. `adminPin` is removed from `data/settings.json` and from the
settings form; changing it becomes an ops action (edit `.env`, restart), documented in `.env.example`.
*Rejected:* a `proxy.js` gate over `/api/admin/*` and `/admin` — Context 18 is explicit that Next 16
deprecates the convention, tells you to avoid it unless there is no other option, and warns against
relying on shared modules inside it; the auth guide's own recommendation is a `server-only` DAL called
from each handler, which is what `requireAdmin()` is. *Also rejected:* keeping the passcode editable in
the UI — it is the credential that gates the UI, storing it in the same JSON blob the UI writes is the
loop that put it in `data/settings.json` in the first place (Context 7).

**D4 — The notification recipient becomes its own named setting, separate from the public contact
address, and stops being served to unauthenticated callers.** `settings.notifyEmail` (falling back to
`ownerEmail` when unset, so nothing breaks on first deploy) is what `lib/mailer.js` sends alerts to;
`ownerEmail` stays the public-facing contact. The settings route's unauthenticated branch stops returning
either address. In `/admin` this gets its own card titled for what it does — "Pledge alert notifications"
— with the recipient, the on/off toggle (`emailNotificationsEnabled`, which the current form never
exposes) and the "send test email" action together in one place. *Rejected:* reusing `ownerEmail` as-is —
it is one field serving two purposes with opposite disclosure requirements (Context 4), and the request
specifically asks for "the email they want to receive notification on", which is the private one.

**D5 — Delete the legacy static console: `public/index.html`, `public/css/`, `public/js/`.** It is a
live, unmaintained, fully wired duplicate admin console that advertises the default passcode (Context 5).
*Rejected:* leaving it and merely removing the placeholder text — the passcode is the smaller half; the
larger half is a second admin console with no session, no upkeep and a call to a route that no longer
exists. *Also rejected:* moving it to a `legacy/` folder outside `public/` — `git` already holds it if
anyone ever wants it, and `server.cjs` (27 KB, the pre-Next Express server, referenced by the
`server-legacy` script in `package.json:9`) is the thing that actually served it; leave that script and
file alone in this plan and delete only what Next publishes to the web.

**D6 — Three colours, declared once in `@theme`, named by role: `brand`, `accent`, `neutral`.**
`brand` is the existing emerald, `accent` the existing gold/amber, `neutral` the existing slate — the
palette `globals.css:5-22` already describes (Context 12), moved into a Tailwind v4 `@theme` block so it
generates utilities (Context 13). The four non-palette families collapse by role, not by hue: covered →
`brand`, partial/attention → `accent`, needs-support → `neutral` outline, destructive admin actions
(delete a pledge) → `accent` with an explicit confirm rather than a fourth colour. `.pulse-dot`'s
hardcoded emerald-500 becomes `var(--color-brand-500)`. *Rejected:* keeping `rose` as a fourth
"danger" colour — it is the honest argument against three colours and the request was explicit; the
confirm dialog, not the hue, is what prevents an accidental delete. *Also rejected:* renaming to
`emerald`/`gold`/`slate` — role names survive a palette change, hue names do not, and this palette has
already drifted once.

**D7 — `react-icons`, imported from the `react-icons/fa6` subpath, replacing the CDN link.** The 67
existing icons are Font Awesome 6 (Context 14), so `fa6` is a near 1:1 mapping and the migration stays
mechanical rather than becoming a redesign; `app/layout.js:15` loses the third-party stylesheet. Icons
get `aria-hidden` where decorative and an accessible name where they carry meaning. `lucide-react` is
removed from `package.json` in the same commit. *Rejected:* `lucide-react`, which is already installed
and unused — the request named `react-icons`, and lucide has no 1:1 Font Awesome mapping, so adopting it
would turn an icon swap into an icon redesign across 45 distinct glyphs. *Also rejected:* importing from
the `react-icons` root — it defeats subpath tree-shaking and pulls a very large module graph for 45
icons.

**D8 — The contributor list becomes a native `<details>` / `<summary>` disclosure on each card, closed
by default, with the count in the summary.** Summary reads "Supporters (3)" with a rotating chevron;
open state reveals the existing chips unchanged. Cards with zero supporters render the current
"No pledges yet. Be the first!" line as static text with no control to open. This is Research 1, and it
also settles Context 16 — the Roll of Honor's "View All" and the card disclosure become the same gesture.
*Rejected:* a controlled `useState` panel with `aria-expanded`/`aria-controls` — it is what a component
library would ship, and here it means re-implementing keyboard handling, focus and the open/close
semantics that `<details>` gives correctly for free, in a component that already carries 31 hooks
(Context 10). *Also rejected:* opening the disclosure by default for partially-funded items — a
per-card default that varies by state is exactly the "users get lost between levels" failure NN/g warns
about.

**D9 — `updateSettings` deep-merges, and the settings endpoint stops round-tripping secrets.**
`lib/budget-service.js:171-176` merges nested objects (Context 17) so a narrower client cannot silently
drop `smtp`; `GET /api/admin/settings` returns `smtp.pass` as a boolean `hasPassword` rather than the
password, and `POST` leaves the stored password untouched when the field is absent. *Rejected:*
continuing to POST the whole settings object from the client to sidestep the merge bug — it is what
masks the bug today, and it means the browser holds the SMTP password in React state for the whole
session.

**D10 — The public page keeps its current information architecture; the usability pass is scoped to
what the split and the disclosure expose.** Concretely: the section/filter/search controls
(`app/page.js:721-807`) get a visible result count and a clearer empty state, the sticky pledge CTA
stays, and the card row keeps the layout shipped on 2026-08-28. *Rejected:* a broader redesign of the
public page — "more user friendly" without a named problem is unbounded, and the three named problems
(admin buried, seven colours, contributors always expanded) are addressed by D1, D6 and D8. Anything
further should follow from watching someone use it, not from this plan.

---

## Steps (each = one commit; each ends with a Session-log entry, and a `README.md` update where behaviour changes)

### Phase A — The second console and the secrets on disk (ships first, independent of everything below)

#### Step 1 — Delete the legacy static console and stop the secrets reaching git (D5).
`git rm -r --cached` is unnecessary — nothing is tracked yet — so simply delete `public/index.html`,
`public/css/` and `public/js/`, keeping `public/introduction-budget-edwin-laston.pdf` (linked from
`app/page.js:581` and `:1213`). Add `/data/settings.json` and `/data/notifications.json` to `.gitignore`,
and commit `data/settings.example.json` carrying the same shape with empty credentials, so a fresh clone
still boots. `data/budget.json` and `data/pledges.json` stay tracked — they are the ceremony's content,
not secrets. **Verify:** `GET /index.html` returns 404 and `GET /introduction-budget-edwin-laston.pdf`
still returns 200; `git check-ignore -v data/settings.json` reports it ignored; `git status` shows no
file containing `edwin2026`; `grep -rn "edwin2026" --exclude-dir=node_modules .` returns only the
route-handler fallbacks that Step 2 removes; the app builds and the public page renders unchanged.

#### Step 2 — Move the passcode to the environment and out of every URL (D2 partial, D3).
Add `lib/admin-auth.js` with `import 'server-only'` exporting `requireAdmin(req)`; point all nine admin
routes at it; delete the seven `'edwin2026'` fallbacks so an unset `ADMIN_PIN` authenticates nobody;
change `export/route.js` to authenticate from the same helper rather than `searchParams.get('pin')` and
change `app/page.js:1649` to a `fetch`-and-`blob` download instead of a credential-bearing `href`; remove
`adminPin` from `data/settings.json` and from the settings form (`app/page.js:1831-1844`); rewrite
`.env.example` to document only variables that are actually read, with `ADMIN_PIN` required and the dead
`SMTP_*` block removed or wired (Context 20 — prefer removing here and let D9's settings UI own SMTP).
**Verify:** with `ADMIN_PIN` unset the app boots and every admin route returns 401 including with the old
default passcode; with it set, login succeeds and all nine routes work; `/api/admin/export?pin=edwin2026`
returns 401 and the in-app CSV download still produces the same file; no request in the Network panel
carries a passcode in its URL; `grep -rn "edwin2026" app lib` returns nothing.

### Phase B — The admin route

#### Step 3 — Issue a session cookie and read it everywhere (D2).
`POST /api/admin/verify` sets a signed `HttpOnly`, `SameSite=Lax`, `Secure`-in-production cookie with a
bounded lifetime (sign with `ADMIN_SESSION_SECRET`, a second required env var) and stops returning
`token: 'admin-ok'`; add `POST /api/admin/logout` to clear it; `requireAdmin()` reads the cookie and the
`x-admin-pin` header is removed from every client call. **Verify:** logging in sets exactly one cookie,
flagged `HttpOnly`; `document.cookie` in the console cannot see it; a page refresh keeps the committee
logged in; logout clears it and the next admin call returns 401; a forged cookie with a mutated payload
is rejected; a cookie past its lifetime is rejected; no admin request carries `x-admin-pin`.

#### Step 4 — Create `/admin` and move the console into it (D1).
`app/admin/page.js` (client) plus `app/admin/layout.js` for chrome only — **not** for the auth check
(Context 18). Passcode screen when unauthenticated; the three tabs and the two admin modals move over
verbatim, minus styling changes, which belong to Phase C. Delete from `app/page.js`: the 13 admin
`useState` hooks (`:44-69`, `:71-93`), the admin fetch handlers, the admin modal blocks (`:1529-2004`,
`:2005-2140`, `:2141-…`), and fix the SSE dependency array at `:183` to `[]` now that no admin state
feeds it (Context 9). The two entry points (`:590`, `:1217`) become links to `/admin`. **Verify:**
`/admin` renders the passcode screen logged-out and the console logged-in; every action that worked in
the modal works on the route — list, filter, search, add offline pledge, change status, delete, export,
read the outbox, preview an email, save settings, send a test email; the public page no longer contains
any admin markup (`grep -c "adminPin" app/page.js` is 0) and its `useState` count drops from 31 to ~18;
typing in the passcode field opens exactly one `EventSource` connection and issues no `/api/budget`
refetch; a pledge submitted in another browser still updates the public page live.

#### Step 5 — Give notifications their own settings card, and stop leaking the recipient (D4, D9).
Add `settings.notifyEmail` with an `ownerEmail` fallback in `lib/mailer.js`; remove `ownerEmail` and
`ownerPhone` from the unauthenticated branch of `settings/route.js:13-19`; deep-merge in
`updateSettings`; return `hasPassword` instead of `smtp.pass` and preserve the stored password when the
field is absent. In `/admin`, group recipient + `emailNotificationsEnabled` + "Send test email" into one
card headed for what it does. **Verify:** an unauthenticated `GET /api/admin/settings` returns neither
email address; setting a new recipient and submitting a pledge sends the alert to the new address and
records it in the outbox; toggling notifications off records the pledge with status `saved_inbox` and
sends nothing; saving settings without touching SMTP leaves `smtp.user`/`smtp.pass` intact in
`data/settings.json`; the SMTP password never appears in any response body.

### Phase C — The design system

#### Step 6 — Three colours in `@theme`, seven families collapsed (D6).
Rewrite `app/globals.css` so the palette lives in `@theme` as `--color-brand-*`, `--color-accent-*`,
`--color-neutral-*` (Context 13), keeping `body`, `.font-serif-royal`, `.pulse-dot` and `.modal-backdrop`
and pointing `.pulse-dot` at `var(--color-brand-500)`. Then sweep `app/page.js` and `app/admin/` —
~480 occurrences (Context 11) — mapping by role per D6. **Verify:** `grep -oE
"(bg|text|border|from|to|via|ring|divide|shadow)-(slate|rose|teal|red|purple|emerald|amber)-[0-9]+" app`
returns nothing; the build succeeds; body text on every surface meets WCAG AA 4.5:1 and large text 3:1,
checked on the four states a card can be in; covered / partial / needs-support remain visually
distinguishable to a viewer with deuteranopia (the status rail's position and the badge text carry the
distinction, not hue alone); screenshots at 390px and 1440px show no unintended colour left behind.

#### Step 7 — react-icons in, the Font Awesome CDN out (D7).
`npm i react-icons@5`, `npm rm lucide-react`; replace all 67 `<i className="fa-…">` with `fa6` imports;
delete `app/layout.js:15`. Decorative icons get `aria-hidden="true"`; icon-only buttons get an
accessible name. **Verify:** `grep -c 'className="fa-' app` is 0 and no request to `cdnjs.cloudflare.com`
appears in the Network panel; every icon renders (walk the public page, all three admin tabs and all
five modals); `npm ls lucide-react` reports it absent; icon-only controls announce a name in an
accessibility-tree inspection; the production build's first-load JS for `/` does not regress by more
than a few KB versus the pre-change build — record both numbers in the Session log.

### Phase D — Card usability

#### Step 8 — Contributors behind a disclosure on every card (D8).
Replace the always-open supporters block (`app/page.js:973-1004`) with `<details>` / `<summary>`, summary
"Supporters (n)" plus a chevron that rotates on `[open]`, chips unchanged inside. Zero-supporter cards
render static text and no control. Apply the same gesture to the Roll of Honor's "View All" toggle
(`:1009-1016`) so the two lists behave alike. **Verify:** every card renders closed on load and the
contributor names are absent from the accessible tree until opened; the count in the summary matches the
chip count once opened; opening one card does not affect another; keyboard `Tab` reaches the summary and
`Enter`/`Space` toggles it; a card whose item is pre-covered by family still shows its
"Pre-covered by Family" chip on open; a live pledge arriving over SSE updates a closed card's count
without opening it; the section renders correctly at 390px.

#### Step 9 — The scoped usability pass (D10).
Result count on the filter bar ("Showing 12 of 47 items"), a clearer empty state naming which filter is
responsible, and a visible focus ring on every interactive element (currently absent — a keyboard user
cannot see where they are). **Verify:** the count updates with search, category and filter changes and
matches the rendered card count; clearing filters from the empty state restores all items; every
control shows a focus ring under keyboard navigation; a full keyboard traversal of the public page
reaches the pledge CTA on every card and the `/admin` link, in visual order.

---

## Risks

1. **Step 1 deletes 105 KB of working, if unmaintained, UI.** `public/index.html` + `css` + `js` is a
   complete alternative frontend. It is in git only if it was committed — and it was **not**: `git status`
   shows `public/` untracked, so deleting it removes the only copy. Commit it once on the branch before
   deleting it in the next commit, or copy it outside the repo first. This is the one genuinely
   irreversible action in the plan.
2. **Step 2 will lock out anyone who has not set `ADMIN_PIN`.** That is the point — Context 6's fallback
   is published in a file anyone can read — but it converts a silent insecure default into a hard
   failure. Set the variable in `.env` *before* merging, and make the 401 body name the missing variable
   rather than saying "Unauthorized".
3. **The cookie in Step 3 changes how every admin call authenticates, all at once.** Nine routes and one
   download path move together; there is no half-migrated state that works. Verify each route
   individually against a logged-in and a logged-out browser before moving to Step 4, because Step 4's
   own verification will otherwise blame the wrong step.
4. **Step 4 moves ~475 lines of JSX between files and deletes 13 hooks from a 2168-line component.**
   Nothing here is typed and there are no tests in this repo at all — no test runner, no specs. The only
   safety net is the walk-through in the Verify line, so do it in full, and do it before the Phase C
   sweep repaints everything and makes a regression hard to attribute.
5. **Step 6 touches ~480 utility occurrences by hand.** A find-and-replace across colour families will
   silently change meaning where the same family serves two roles — `slate` is both "neutral surface" and
   "disabled" today, and `amber` is both "accent" and "partially funded". Map by role per occurrence, not
   by family, and expect the diff to be large and boring; a small clever diff here is a wrong one.
6. **Three colours can lose a distinction that matters.** "Needs support" currently reads rose/red, and
   under D6 it becomes a neutral outline. If, on screen, the three funding states stop being
   distinguishable at a glance, the fix is contrast and the status rail's weight — not a fourth hue. If
   that fails, the honest outcome is to tell the user that three colours costs this specific signal and
   let them choose; do not quietly add a colour back.
7. **`<details>` styling and animation differ across browsers.** Height animation on open is not reliably
   available; a rotating chevron and an instant reveal are. Do not reach for a JS-controlled panel to get
   an animation — that is D8's rejected alternative arriving through the back door.
8. **`data/*.json` is the database, and it is written with non-atomic `fs.writeFileSync`**
   (`lib/budget-service.js:30-39`). Two simultaneous pledges can interleave a read-modify-write and lose
   one. This is pre-existing, out of scope, and worth naming here because Phase B's admin actions
   (delete, re-status, settings save) increase how often two writes overlap. If it surfaces during
   verification, log it and raise it separately rather than absorbing a fix mid-step.
9. **`ADMIN_SESSION_SECRET` is new required configuration.** A deploy that forgets it must refuse to
   start rather than fall back to a constant — the same discipline Step 2 applies to `ADMIN_PIN`, and the
   exact trap Context 6's `'edwin2026'` fallback illustrates.

## Verification (end-to-end, after Step 9)

1. `GET /index.html` is 404; the budget PDF still serves; no tracked file contains `edwin2026`;
   `data/settings.json` is gitignored.
2. With `ADMIN_PIN` or `ADMIN_SESSION_SECRET` unset the app refuses to authenticate anyone and says which
   variable is missing; with both set, `/admin` logs in, survives a refresh, and logs out.
3. No admin request carries a credential in a URL or a header; the session cookie is `HttpOnly` and
   invisible to `document.cookie`; a forged or expired cookie is rejected.
4. Every admin capability works on `/admin`: list, filter, search, add offline pledge, change status,
   delete, CSV export, notification outbox, email preview, save settings, send test email.
5. Changing the notification recipient in `/admin` and submitting a pledge from the public page delivers
   the alert to the new address and records it in the outbox; toggling notifications off sends nothing
   and records `saved_inbox`; an unauthenticated `GET /api/admin/settings` returns no email address and
   no SMTP password.
6. The public page contains no admin markup, its `useState` count is ~18, and typing anywhere on it opens
   exactly one `EventSource`; a pledge in one browser updates another browser live.
7. Only `brand`, `accent` and `neutral` colour utilities appear in `app/`; all text meets WCAG AA; the
   three funding states are distinguishable without relying on hue.
8. No request to `cdnjs.cloudflare.com`; all 67 icons render as `react-icons/fa6`; `lucide-react` is gone;
   first-load JS for `/` is recorded before and after.
9. Every card's contributors are closed on load with an accurate count in the summary, open on click and
   on `Enter`/`Space`, and update over SSE while closed.
10. `npx next build` is clean; the public page and `/admin` are walked at 390px and 1440px with no
    horizontal overflow and a visible focus ring throughout.

## Execution prompts

1. **Opus 5** · `Sec_fix/legacy-console: delete the second admin console and gitignore the secrets` —
   Step 1 (an irreversible delete of the only copy of 105 KB of UI, and a published credential — Risk 1).
2. **Opus 5** · `Sec_fix/passcode: require ADMIN_PIN and get it out of every url` — Step 2
   (nine routes, seven deleted fallbacks, and a change that locks people out by design — Risk 2).
3. **Opus 5** · `Admin_feat/session: exchange the passcode for a signed httponly cookie` — Step 3
   (all nine routes change how they authenticate at once, with no half-migrated state — Risk 3).
4. **Opus 5** · `Admin_feat/route: move the committee console to /admin` — Step 4 (~475 lines of JSX
   across files, 13 hooks deleted from a 2168-line component, no tests anywhere — Risk 4).
5. Sonnet 5 · `Admin_feat/notifications: a named recipient, a deep merge, and no leaked secrets` — Step 5.
6. **Opus 5** · `Design_feat/palette: three colours in @theme, seven families collapsed` — Step 6
   (~480 hand-mapped occurrences where family does not equal role, plus a contrast and colour-blindness
   check — Risks 5, 6).
7. Sonnet 5 · `Design_feat/icons: react-icons/fa6 in, the font-awesome cdn out` — Step 7.
8. Sonnet 5 · `CardUX_feat/supporters: contributors behind a details disclosure` — Step 8.
9. Sonnet 5 · `CardUX_feat/filters: result counts, honest empty states, visible focus` — Step 9.

---

## Session log

*(Appended per step, in the same commit as the work.)*

### Step 1 — `Sec_fix/legacy-console: delete the second admin console and gitignore the secrets`

**The plan named the wrong file as the PII risk, and reading the data is what showed that.** D5 and Step 1
said `data/pledges.json` stays tracked because it is "the ceremony's content". It is not. It holds one
pledge carrying a real contributor's full name, phone number and email address — on a record whose own
`isAnonymous: true` and `hideAmount: true` flags say that person asked not to be identified publicly
(`lib/budget-service.js:102-103` honours those flags when rendering, and committing the raw file defeats
both). `data/notifications.json` holds the same fields again, plus the rendered alert email. Both are now
gitignored alongside `settings.json`; neither needs an example file, because `readJSON()`
(`lib/budget-service.js:15-28`) creates them empty on first run. `data/budget.json` stays tracked — it is
the itemised budget this application exists to publish, and contains nothing about anyone.

**Two commits, not one.** Risk 1 was real: `public/` was untracked, so the pre-Next static build existed
in exactly one place on disk. `2c7bcbd chore: track the application as it stands` imports the tree with
the three data files already ignored, which is what makes the deletion in this commit recoverable. Doing
it the other way round — deleting first — would have destroyed the only copy.

**The passcode was published in two more places than Context 5 found.** `README.md:57` printed
"Enter the Admin PIN: `edwin2026`" and `:71` repeated it under Portal Features; `README.md` is tracked and
this repo has a GitHub remote configured (`git@github-personal:lllmoseslll/contribution_list.git`), so
those two lines were a publication in the same sense `public/index.html:522` was. Both now point at
`ADMIN_PIN` in `.env` instead. `.env.example:6`'s value was blanked in the baseline commit rather than
carried into history.

**`server.cjs` still has seven copies of the fallback and is deliberately untouched** (`:534`, `:573`,
`:586`, `:598`, `:632`, `:672`, `:699`, `:724`). D5 scoped this step to what Next publishes to the web,
and Next does not serve `server.cjs` — it is the pre-Next Express server, reachable only by running
`npm run server-legacy`. It is named here so it is not mistaken for an oversight; deleting it is a
separate call for the repo's owner.

**`edwin2026` must be rotated regardless of any of this.** It was rendered as visible placeholder text on
a page anyone could load, and it now exists in this branch's history inside the preserved
`public/index.html`. Removing it from the working tree is not the control that matters; changing
`ADMIN_PIN` in `.env` is, and Step 2 is what makes that variable authoritative.

**Verified:** `GET /index.html`, `/css/styles.css` and `/js/app.js` all return 404 and
`/introduction-budget-edwin-laston.pdf` still returns 200 against the running server; `git check-ignore`
confirms all three data files ignored and `budget.json` tracked; `git grep edwin2026` outside `plans/`
returns only `app/` (Step 2) and `server.cjs` (out of scope); `npx next build` clean, 13 routes.

### Step 2 — `Sec_fix/passcode: require ADMIN_PIN and get it out of every url`

**`lib/admin-auth.js` is the seam Step 3 needs.** It exports `getAdminPin()`, `matchesAdminPin()`,
`isAdminRequest(req)` and `requireAdmin(req)`; the nine routes call `requireAdmin` and are now indifferent
to *how* a caller proves itself. Step 3 changes this file's internals from a header to a cookie and
touches no route. The comparison is constant-time — both sides are SHA-256'd first so `timingSafeEqual`
gets equal-length buffers and the length of the submitted passcode does not leak through a throw.

**The settings route needed two shapes, not one.** `GET /api/admin/settings` deliberately answers
unauthenticated callers with a sanitised payload the public page depends on, so it uses `isAdminRequest()`
rather than `requireAdmin()` and still returns 200 with no credential. That is why the probe below shows
`/api/admin/settings` returning 200 with `ADMIN_PIN` unset while everything else returns 401 — it is
correct, not a hole, and Step 5 is what removes the two email addresses still in that branch.

**`POST /api/admin/settings` now strips `adminPin` from the incoming body.** Removing the field from the
form is not sufficient on its own: the endpoint merged whatever it was handed straight into
`data/settings.json` (`lib/budget-service.js:171-176`), so any stale client, cached bundle or hand-rolled
request could write a credential back into the file Step 1 just finished getting out of git.

**Two documentation lies were removed rather than left.** `.env.example` listed seven `SMTP_*` variables
that nothing reads — `lib/mailer.js:4-28` builds its transport exclusively from `settings.smtp` — and
`README.md:66` told the reader they could "set `SMTP_USER` and `SMTP_PASS` directly in the `.env` file",
which has never been true. Both now say where SMTP is actually configured.

**Probed against `next start`, both ways.** With `ADMIN_PIN=""`: every admin route 401s, including with
the old default passcode, and the body reads *"ADMIN_PIN is not set on this server. Set it in .env (see
.env.example) and restart."* With `ADMIN_PIN=edwin2026`: `/api/admin/pledges`, `/notifications`,
`/settings`, `/export` and `POST /verify` all return 200 with the header and 401 without it or with a
wrong one. `GET /api/admin/export?pin=edwin2026` returns **401** — the query-parameter path is gone.

**Verified in the browser too.** Logging into the portal on the dev server: the passcode field's
placeholder no longer advertises a default; the Settings tab now shows two cards ("Groom / Committee
Contacts", "Live SMTP Email Dispatch") with the passcode card gone and the string "passcode" absent from
the rendered page; Export CSV is a `<button>` with no `href`, and the fetch it makes returns
`text/csv` with the same header row and `Content-Disposition` filename as before. Fourteen network
requests were captured across a full login and none carries a credential in its URL.

**The capture also reproduces Context 9 exactly** — three `GET /api/stream` connections and four
`GET /api/budget` fetches for one login, because each keystroke in the passcode field re-ran the SSE
effect. Step 4 fixes it.

**`edwin2026` is still the working passcode** and still needs rotating; this step only makes `.env` the
place to do it.

### Step 3 — `Admin_feat/session: exchange the passcode for a signed httponly cookie`

**Step 2's seam held: not one route handler changed.** All nine still call `requireAdmin(req)`; only
`lib/admin-auth.js` learned to read a cookie instead of a header. The only route files touched were
`verify/route.js` (which now issues the cookie and gained a `GET` returning `{ authenticated }`) and the
new `logout/route.js`. That is the whole argument for having built the helper first.

**No session store, deliberately.** The token is `base64url(JSON).base64url(HMAC-SHA256)` with the expiry
*inside* the signed payload, so it cannot be extended by editing the cookie, and rotating
`ADMIN_SESSION_SECRET` invalidates every issued session at once. One shared committee credential does not
justify a store, and a file-backed one would inherit `data/`'s non-atomic `writeFileSync` (Risk 8).

**`configurationError()` runs before any credential is examined**, so a deployment missing either
variable fails by name — "ADMIN_SESSION_SECRET is not set on this server" — rather than silently rejecting
a correct passcode, which is the failure mode Risk 9 describes.

**A failed login now actively clears any cookie it finds**, so a wrong passcode cannot leave a stale
session behind.

**The passcode is dropped from React state the moment it is accepted** (`setAdminPin('')`). It is
submitted exactly once, to one endpoint, and is never in memory, in a header or in a URL again.

**Probed against `next start`.** Login returns exactly one `Set-Cookie`:
`kwanjula_admin=…; Path=/; Max-Age=28800; Secure; HttpOnly; SameSite=lax`. With it, `/pledges`,
`/notifications`, `/settings` and `/export` all return 200; without it, 401 — **including with
`x-admin-pin: edwin2026`**, so the old replay path is genuinely closed. Four tampering attempts all
return 401: payload swapped for a far-future expiry with the original signature, signature prefix
mutated, unsigned junk, and a *correctly signed but expired* token minted with the real secret. Logout
clears the cookie and the next call is 401.

**Verified in the browser.** After login `document.cookie` is empty — the session is invisible to
JavaScript. A full page reload comes back already signed in (the new mount-time `GET /api/admin/verify`),
which is the first time this app has survived a refresh; Context 8 is closed. "Sign out" returns the
portal to the passcode prompt and the next `/api/admin/pledges` is 401.

**The SSE dependency array is deliberately still `[adminAuthenticated, adminPin]`.** Nothing in that
effect needs the passcode any more, so the dependency is now purely vestigial — but Step 4 owns that fix,
and moving it here would blur which commit to blame if the live feed regresses.

### Step 4 — `Admin_feat/route: move the committee console to /admin`

**The public page lost 943 lines and 16 hooks.** `app/page.js` went 2195 → 1252 lines and 31 → **15**
`useState` calls — better than the ~18 the plan estimated, because the offline-pledge form and the
settings object took eleven of them with it. `app/admin/page.js` is 995 lines with 17 hooks. Every
visitor to the public page previously downloaded and hydrated all of it.

**The move was mechanical, and that was the point.** Five line-ranges came out of `app/page.js` bottom-up
— the modals (`1559-2192`), the `filteredAdminPledges` memo, the handlers, the mount-time session check
and the admin state block — and went into the new route unchanged. The only edits to the moved JSX were
the three the medium forced: the modal backdrop and its `max-h-[92vh] overflow-y-auto flex-1` shell became
a page card, and the close button became a "Back to site" `<Link>`. A console that is a page does not need
a way to be dismissed.

**`app/admin/layout.js` deliberately contains no auth check**, and says so in a comment. Context 18's
guidance is that a layout does not re-render on navigation and does not control whether the rest of the
route renders — an auth check there would look like one without being one. The route's protection is
where it already was: `requireAdmin()` on every `/api/admin/*` handler, plus the page asking the server
whether a session exists before rendering anything. The layout does add `robots: { index: false }`.

**Context 9 is closed, and the network capture proves it.** With the passcode field gone from the public
page, the SSE dependency array becomes `[]` and the two `if (adminAuthenticated) loadAdminPledges()` calls
inside the stream handler are deleted. A fresh load of `/` now opens **one** `/api/stream` connection.
(Two `/api/budget` requests remain — that is React StrictMode double-invoking the effect in dev, which
predates this branch and does not happen in a production build.)

**Walked every capability on the new route rather than assuming the move was clean.** Logged in; all
three tabs render (`Pledges (1)`, `Email Outbox (1)`, `Settings & SMTP`); added an offline pledge and the
table went 1 → 2 rows; toggled its status Paid → Pledged; deleted it and the table went back to 1.
`data/pledges.json` is byte-for-byte what it was before the walk — one real pledge, status `pledged`.
Saved settings ("Settings saved successfully!") and confirmed `data/settings.json` kept all six keys and
its nested `smtp` object intact. Enabled SMTP to make the test-email control render and clicked it: it
reports *"SMTP is not enabled or credentials (user/password) are empty in settings."* rather than
throwing. Reloading `/admin` comes back signed in.

**The live feed still works across pages.** Posting a pledge to `/api/pledge` with the public page open
put the contributor's name onto the item card and into the Roll of Honor with no refresh; deleting it
through the admin API restored the file.

**The public page carries no admin markup at all** — `adminPin`, `adminAuthenticated`, `adminSettings`,
`adminPledges`, `adminNotifs`, `x-admin-pin` and `/api/admin/` all return zero matches in `app/page.js`.
Both former entry points are now `<Link href="/admin">`.
