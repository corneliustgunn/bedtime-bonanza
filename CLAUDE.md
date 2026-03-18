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
├── render.yaml      Render.com backend deployment config
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
    length: string    // "quick" | "short" | "medium"
  }
}
```

**Response shape (success):**
```js
{ title: string, pages: string[] }  // pages = Claude text split on \n\n
```

**Error responses:** `{ error: string }` with status 400 (validation), 429 (rate limit), 502 (Claude error), 503 (key not configured).

**Claude integration:**
- Model: `claude-3-5-haiku-20241022`
- max_tokens: `quick`→300, `short`→600, `medium`→900
- Word count targets: `quick`→80-100, `short`→250-300, `medium`→450-500
- Input sanitization strips HTML tags before sending to Claude: `.replace(/<[^>]*>/g, '')`
- Response parsed by extracting `TITLE:` and `STORY:` markers, then splitting on blank lines

**Server env vars:**
| Var | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Required. Claude API key. |
| `PORT` | Optional. Defaults to 3001. |
| `NODE_ENV` | Set to `production` on Render. |
| `CORS_ORIGIN` | Allowed origin in production (set to `https://corneliustgunn.github.io`). |

---

## Frontend — `client/`

React 18 + Vite 6, `"type": "module"`. All routing uses **`createHashRouter`** (hash-based URLs like `/#/build`) for GitHub Pages compatibility — do not switch to `createBrowserRouter`.

**Vite base path:** `/bedtime-bonanza/` — required for GitHub Pages sub-path. Asset URLs in the build will include this prefix.

**Client env vars (baked in at build time):**
| Var | Purpose |
|---|---|
| `VITE_API_URL` | Backend URL prefix. Empty in dev (proxy handles it). Set to the Render URL in production via GitHub Actions secret. |

### Pages

| Route | File | Purpose |
|---|---|---|
| `/#/` | `pages/HomePage.jsx` | Landing page with "Let's build a story" CTA |
| `/#/build` | `pages/BuildPage.jsx` | Character builder + story settings + generate button |
| `/#/story` | `pages/StoryPage.jsx` | Displays generated story; receives story via `useLocation().state.story` |

`StoryPage` redirects to `/` if there is no story in router state (direct-link protection).

### Components

| Component | Purpose |
|---|---|
| `Header.jsx` | App logo, animated stars, optional subtitle prop |
| `CharacterList.jsx` | Manages array of up to 4 characters; shows cards + add/remove |
| `CharacterForm.jsx` | Form to add one character. **Important:** rendered as `<div>`, NOT `<form>`, because it lives inside BuildPage's outer `<form>`. The "Add Character" button is `type="button"` with `onClick`. Never wrap this in a `<form>` tag. |
| `CharacterCard.jsx` | Displays one character pill with emoji, name, description, remove button |
| `StoryDisplay.jsx` | Paginated story with prev/next navigation, dot indicators, optional Web Speech API read-aloud |
| `LoadingSpinner.jsx` | Full-screen overlay shown while Claude generates |

### Data — SETTINGS and THEMES

Both arrays live at the top of `BuildPage.jsx`. They drive both the UI and (via the server's `buildUserPrompt`) the Claude prompt. When adding new settings or themes:
- Add to the array in `BuildPage.jsx`
- The server uses the raw string value in the prompt — no server changes needed
- For new `length` values, both `BuildPage.jsx` (UI options) **and** `server/index.js` (validation + word count + max_tokens) must be updated

**Story length values and word targets:**
| value | label | words | max_tokens |
|---|---|---|---|
| `quick` | 1 min | 80–100 | 300 |
| `short` | 3 min | 250–300 | 600 |
| `medium` | 5 min | 450–500 | 900 |

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

### Render.com (backend)

Configured via `render.yaml` at the repo root:
- Build: `npm install` (workspaces installs everything)
- Start: `node server/index.js`
- Env vars: `NODE_ENV=production`, `CORS_ORIGIN=https://corneliustgunn.github.io`, `ANTHROPIC_API_KEY` (set manually in Render dashboard — `sync: false`)

After changes that need to be live: merge to `main` → GitHub Actions deploys frontend automatically; Render auto-deploys backend on push to `main` (if connected).

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
