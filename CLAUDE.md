# CLAUDE.md — Bedtime Bonanza

A personalized bedtime story generator for children aged 2–5. Parents build characters and pick settings; the app calls Claude to generate a gentle, age-appropriate story.

---

## Architecture

**Monorepo with two npm workspaces:**

```
bedtime-bonanza/
├── server/          Express API (Node.js, ESM)
├── client/          React + Vite SPA
├── package.json     Root — workspaces, shared scripts
├── railway.json     Railway backend deployment config
└── .github/
    └── workflows/
        └── deploy.yml   GitHub Actions → GitHub Pages
```

`npm install` at the repo root installs all workspace dependencies into the root `node_modules/`. There are no separate installs needed.

---

## Development

```bash
npm run dev        # starts both server (port 3001) and client (port 5173) via concurrently
npm run build      # builds client to client/dist/ (used by CI)
npm start          # starts server only (production)
```

The Vite dev server proxies `/api/*` to `http://localhost:3001`, so the frontend always uses relative `/api/story` URLs — no client env vars needed during local development.

**Environment variables for local dev:** create `server/.env` (never commit it):
```
ANTHROPIC_API_KEY=sk-ant-...
PORT=3001
```

---

## Backend — `server/index.js`

Single-file Express server (ESM, `"type": "module"`).

**API endpoints:**
- `GET  /api/health` → `{ ok: true }`
- `POST /api/story`  → generates a story via Claude (rate-limited: 10 req / 15 min / IP)
- `GET  *`           → serves `client/dist/` as static (production only; falls back to `index.html` for SPA routing)

**POST /api/story request shape:**
```js
{
  characters: [
    {
      id: string,          // UUID
      name: string,        // max 30 chars
      type: string,        // "Human"|"Animal"|"Fantasy Creature"|"Robot"|"Fairy"|"Dragon"|"Talking Object"
      subtype: string,     // required for non-Human, non-Robot types; max 40 chars
      trait: string,       // "Brave"|"Curious"|"Kind"|"Funny"|"Shy"|"Adventurous"|"Gentle"|"Playful"
      appearance: string   // optional; max 80 chars
    }
    // 1–4 characters
  ],
  settings: {
    setting: string,  // from SETTINGS list in BuildPage.jsx
    theme: string,    // from THEMES list in BuildPage.jsx (value field)
    length: string,   // "quick" | "short" | "medium"
    style: string     // "cozy" | "refrain" | "rhyme" | "silly" (optional; defaults to "cozy")
  },
  specialDetails: string,   // optional "Something from today"; max 200 chars after sanitizing
  recentStories: [          // optional; last ≤5 atlas entries, used to avoid repeating openings/plots
    { title: string, firstLine: string }
  ],
  avoidNames: string,       // comma-separated, from localStorage avoid-list
  avoidLocations: string    // comma-separated, from localStorage avoid-list
}
```

**Response shape (success):**
```js
{ title: string, location: string, refrain: string, style: string, pages: string[] }
// refrain is "" unless style === "refrain"; rhyme pages contain \n line breaks between verse lines
```

**Error responses:** `{ error: string }` with status 400 (validation), 429 (rate limit), 502 (Claude error), 503 (key not configured).

**Claude integration:**
- Model: `claude-sonnet-5-5` via `client.beta.messages.create`, `output_config.effort: 'low'`, adaptive thinking (default)
- Do NOT send `temperature` — Sonnet 5.5 rejects non-default sampling. Variety comes from the prompt: `STYLE_GUIDE` (per-style structure), `pickRecipe()` (random opening / story device / bedtime landing), and the `recentStories` avoid-list.
- `max_tokens: 4000` for every length (thinking tokens count toward it); length is controlled by page + word targets in the prompt
- Page / word targets: `quick`→3 pages / ~150, `short`→4 / ~300, `medium`→5 / ~500
- Structured output (`output_config.format` JSON schema `STORY_SCHEMA`): `{ title, location, refrain, pages }`; a plain-text fallback parser handles non-JSON replies
- Server-side refusal fallback enabled (`server-side-fallback-2026-07-01`, `fallbacks: 'default'`); a final `stop_reason: 'refusal'` returns 502
- Input sanitization strips HTML tags before sending to Claude: `.replace(/<[^>]*>/g, '')`

**Server env vars:**
| Var | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Required. Claude API key. |
| `PORT` | Optional. Defaults to 3001. |
| `NODE_ENV` | Set to `production` on Railway. |
| `CORS_ORIGIN` | Allowed origin in production (set to `https://corneliustgunn.github.io`). |

---

## Frontend — `client/`

React 18 + Vite 6, `"type": "module"`. All routing uses **`createHashRouter`** (hash-based URLs like `/#/build`) for GitHub Pages compatibility — do not switch to `createBrowserRouter`.

**Vite base path:** `/bedtime-bonanza/` — required for GitHub Pages sub-path. Asset URLs in the build will include this prefix.

**Client env vars (baked in at build time):**
| Var | Purpose |
|---|---|
| `VITE_API_URL` | Backend URL prefix. Empty in dev (proxy handles it). Set to the Railway URL in production via GitHub Actions secret. |

### Pages

| Route | File | Purpose |
|---|---|---|
| `/#/` | `pages/HomePage.jsx` | Landing page with "Let's build a story" CTA |
| `/#/build` | `pages/BuildPage.jsx` | Character builder + story settings + story style + "Something from today" + generate button |
| `/#/story` | `pages/StoryPage.jsx` | Displays generated story; receives story via `useLocation().state.story` |

`StoryPage` redirects to `/` if there is no story in router state (direct-link protection).

### Components

| Component | Purpose |
|---|---|
| `Header.jsx` | App logo, animated stars, optional subtitle prop |
| `CharacterList.jsx` | Manages array of up to 4 characters; shows cards + add/remove |
| `CharacterForm.jsx` | Form to add one character. **Important:** rendered as `<div>`, NOT `<form>`, because it lives inside BuildPage's outer `<form>`. The "Add Character" button is `type="button"` with `onClick`. Never wrap this in a `<form>` tag. |
| `CharacterCard.jsx` | Displays one character pill with emoji, name, description, remove button |
| `StoryDisplay.jsx` | Paginated story with prev/next navigation, dot indicators, optional Web Speech API read-aloud. Highlights the `refrain` (if any) and preserves `\n` line breaks within a page (verse) |
| `LoadingSpinner.jsx` | Full-screen overlay shown while Claude generates |

### Data — SETTINGS and THEMES

Both arrays live at the top of `BuildPage.jsx`. They drive both the UI and (via the server's `buildUserPrompt`) the Claude prompt. When adding new settings or themes:
- Add to the array in `BuildPage.jsx`
- The server uses the raw string value in the prompt — no server changes needed
- For new `length` values, both `BuildPage.jsx` (UI options) **and** `server/index.js` (validation + `WORD_COUNT_MAP` / `PAGE_COUNT_MAP` / `STORY_LENGTH_MAP`) must be updated

**Story length values and word targets:**
| value | label | pages | words |
|---|---|---|---|
| `quick` | 1 min | 3 | ~150 |
| `short` | 3 min | 4 | ~300 |
| `medium` | 5 min | 5 | ~500 |

**Story styles** (`STYLES` in `BuildPage.jsx`, `STYLE_GUIDE` in `server/index.js` — adding a style requires both):
`cozy` (calm wind-down, default), `refrain` (repeated chantable line, pattern plot), `rhyme` (AABB verse), `silly` (gentle absurdity, sound words, running gag).

---

## Styling

**Approach:** Global utility classes in `client/src/index.css` + CSS Modules per component (`ComponentName.module.css` co-located with the JSX file).

**Never edit** button colors via the global `--color-button` variable if you only want to change one button — use a CSS module override instead (see `BuildPage.module.css` `.generateBtn`).

**Key CSS variables (defined in `client/src/index.css`):**
```css
--color-bg: #0f0e17          /* page background */
--color-surface: #1a1a2e     /* card background */
--color-surface-2: #16213e   /* input background */
--color-border: #2a2a4a
--color-accent: #f7c59f      /* warm peach (headings, highlights) */
--color-accent-2: #a8dadc    /* soft teal */
--color-accent-3: #c77dff    /* purple */
--color-text: #eef0f2
--color-text-muted: #8892a0
--color-button: #e05c6f      /* coral (most primary buttons) */
--color-button-hover: #c74458
--font-heading: 'Nunito', sans-serif
--font-body: 'Nunito', sans-serif
--font-story: 'Lora', serif  /* story reading text only */
--max-width: 640px
```

**Responsive breakpoints:** `480px` (BuildPage settings grid) and `640px` (global font scale, header sizing).

**Global utility classes:** `.page`, `.container`, `.card`, `.section-heading`, `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-lg`, `.btn-sm`, `.form-group`, `.form-label`, `.form-input`, `.form-select`, `.select-wrapper`, `.animate-fade-in`.

---

## Deployment

### GitHub Pages (frontend)

Automated via `.github/workflows/deploy.yml`:
- Triggers on push to `main`
- Builds `client/` with `VITE_API_URL` injected from the `VITE_API_URL` GitHub Actions secret
- Deploys `client/dist/` to the `gh-pages` branch via `peaceiris/actions-gh-pages`
- Live URL: `https://corneliustgunn.github.io/bedtime-bonanza/`

### Railway (backend)

Configured via `railway.json` at the repo root:
- Builder: Nixpacks
- Build: `npm install` (workspaces installs everything; set explicitly so the client is not rebuilt — the frontend lives on GitHub Pages)
- Start: `node server/index.js`
- Health check: `/api/health` (Railway marks a deploy live only once the app responds)
- Env vars (set manually in the Railway dashboard → service → Variables): `NODE_ENV=production`, `CORS_ORIGIN=https://corneliustgunn.github.io`, `ANTHROPIC_API_KEY`. Do NOT set `PORT` — Railway injects it automatically and the server reads `process.env.PORT`.

After changes that need to be live: merge to `main` → GitHub Actions deploys frontend automatically; Railway auto-deploys backend on push to `main` (if the repo is connected).

---

## Conventions

- **ESM throughout:** both `server/` and `client/` use `"type": "module"`. No `require()`.
- **No nested `<form>` elements:** `CharacterForm` is a `<div>` not a `<form>`. Don't introduce nested forms.
- **Sanitize user input server-side** before passing to Claude. The sanitize helper strips HTML tags.
- **ANTHROPIC_API_KEY is server-side only.** Never import `@anthropic-ai/sdk` in the client.
- **Hash router is intentional.** `createHashRouter` is required for GitHub Pages. Don't change to `createBrowserRouter`.
- **Vite base path is intentional.** `base: '/bedtime-bonanza/'` is required. Don't remove it.
- **CSS module files** are co-located with their component (same directory, same base name).
- **Emoji on decorative elements** use `aria-hidden="true"`.
- **Min tap target:** 48px height on all interactive elements for mobile usability.
