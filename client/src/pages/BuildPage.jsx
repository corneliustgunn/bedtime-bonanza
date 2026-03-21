import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header.jsx'
import CharacterList from '../components/CharacterList.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import styles from './BuildPage.module.css'

const SETTINGS = [
  'African savanna',
  'Japanese countryside',
  'Indian village',
  'Norwegian fjords',
  'Mexican rainforest',
  'Moroccan medina',
  'Australian outback',
  'Brazilian ocean coast',
  'Chinese mountain village',
  'Enchanted forest',
  'Underwater kingdom',
  'Snowy Arctic tundra',
  'Busy city',
  'Floating sky islands',
]

const THEMES = [
  { value: 'friendship',   label: '🤝 Friendship'    },
  { value: 'kindness',     label: '💛 Kindness'       },
  { value: 'bravery',      label: '🦁 Bravery'        },
  { value: 'curiosity',    label: '🔍 Curiosity'      },
  { value: 'sharing',      label: '🎁 Sharing'        },
  { value: 'patience',     label: '🌱 Patience'       },
  { value: 'creativity',   label: '🎨 Creativity'     },
  { value: 'empathy',      label: '🤗 Empathy'        },
  { value: 'perseverance', label: '💪 Perseverance'   },
  { value: 'gratitude',    label: '🙏 Gratitude'      },
  { value: 'honesty',      label: '🛡️ Honesty'        },
  { value: 'acceptance',   label: '🌈 Acceptance'     },
  { value: 'helpfulness',  label: '🤲 Helpfulness'    },
  { value: 'joy',          label: '🎵 Joy'            },
  { value: 'imagination',  label: '💭 Imagination'    },
  { value: 'family',       label: '🏡 Family'         },
  { value: 'self-love',    label: '❤️ Being Yourself' },
  { value: 'growing-up',   label: '🦋 Growing Up'     },
  { value: 'nature',       label: '🌿 Nature'         },
  { value: 'dreams',       label: '🌙 Dreams'         },
  { value: 'learning',     label: '📚 Learning'       },
]

const DEFAULT_SETTINGS = {
  setting: 'Enchanted forest',
  theme: 'friendship',
  length: 'short',
}

// ── Avoid-list tracking (7-day expiry, stored in localStorage) ──────────────
const TRACK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const MAX_AVOID_NAMES = 40
const MAX_AVOID_LOCS  = 20

function loadTracked(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const list = JSON.parse(raw)
    const cutoff = Date.now() - TRACK_WINDOW_MS
    return list.filter((e) => e.ts > cutoff)
  } catch {
    return []
  }
}

function saveTracked(key, list) {
  try { localStorage.setItem(key, JSON.stringify(list)) } catch { /* ignore */ }
}

export default function BuildPage() {
  const [characters, setCharacters] = useState([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  function setSetting(field) {
    return (e) => setSettings((s) => ({ ...s, [field]: e.target.value }))
  }

  function pickRandomSetting() {
    const random = SETTINGS[Math.floor(Math.random() * SETTINGS.length)]
    setSettings((s) => ({ ...s, setting: random }))
  }

  function pickRandomTheme() {
    const random = THEMES[Math.floor(Math.random() * THEMES.length)]
    setSettings((s) => ({ ...s, theme: random.value }))
  }

  async function handleGenerate(e) {
    e.preventDefault()
    if (characters.length === 0) {
      setError('Please add at least one character to your story.')
      return
    }
    setError('')
    setLoading(true)
    try {
      // Load and filter tracked avoid-lists from localStorage
      const trackedNames = loadTracked('avoidNames')
      const trackedLocs  = loadTracked('avoidLocs')
      const avoidNames     = trackedNames.map((e) => e.value).join(', ')
      const avoidLocations = trackedLocs.map((e) => e.value).join(', ')

      const apiBase = import.meta.env.VITE_API_URL ?? ''
      const res = await fetch(`${apiBase}/api/story`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characters, settings, avoidNames, avoidLocations }),
      })
      if (!res.ok) {
        let message = 'Something went wrong. Please try again.'
        try {
          const data = await res.json()
          if (data.error) message = data.error
        } catch { /* non-JSON error body */ }
        setError(message)
        return
      }
      const data = await res.json()

      // Append used character names to avoid-list (capped at MAX_AVOID_NAMES)
      const now = Date.now()
      const newNames = characters.map((c) => ({ value: c.name, ts: now }))
      const updatedNames = [...trackedNames, ...newNames].slice(-MAX_AVOID_NAMES)
      saveTracked('avoidNames', updatedNames)

      // Append returned location to avoid-list (capped at MAX_AVOID_LOCS)
      if (data.location) {
        const updatedLocs = [...trackedLocs, { value: data.location, ts: now }].slice(-MAX_AVOID_LOCS)
        saveTracked('avoidLocs', updatedLocs)
      }

      navigate('/story', { state: { story: data } })
    } catch {
      setError('Could not reach the story server. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      {loading && <LoadingSpinner />}
      <div className="container">
        <Header subtitle="Build your story" />

        <form className={styles.form} onSubmit={handleGenerate} noValidate>
          {/* ── Characters ─────────────────────────────── */}
          <section className="card">
            <h2 className="section-heading">
              <span aria-hidden="true">🧸</span> Characters
            </h2>
            <CharacterList characters={characters} onChange={setCharacters} />
          </section>

          {/* ── Story Settings ──────────────────────────── */}
          <section className="card">
            <h2 className="section-heading">
              <span aria-hidden="true">🗺️</span> Story Settings
            </h2>

            <div className={styles.settingsGrid}>
              <div className="form-group">
                <div className={styles.themeLabelRow}>
                  <label className="form-label" htmlFor="setting">World / Setting</label>
                  <button type="button" className={styles.randomBtn} onClick={pickRandomSetting} title="Pick a random setting">
                    🎲
                  </button>
                </div>
                <div className="select-wrapper">
                  <select id="setting" className="form-select" value={settings.setting} onChange={setSetting('setting')}>
                    {SETTINGS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <div className={styles.themeLabelRow}>
                  <label className="form-label" htmlFor="theme">Story Theme</label>
                  <button type="button" className={styles.randomBtn} onClick={pickRandomTheme} title="Pick a random theme">
                    🎲
                  </button>
                </div>
                <div className="select-wrapper">
                  <select id="theme" className="form-select" value={settings.theme} onChange={setSetting('theme')}>
                    {THEMES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Story Length</label>
                <div className={styles.lengthToggle}>
                  {[
                    { value: 'quick',  label: '1 min', sub: 'Tiny tale'   },
                    { value: 'short',  label: '2 min', sub: 'Short story' },
                    { value: 'medium', label: '3 min', sub: 'Full story'  },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`${styles.lengthOption} ${settings.length === opt.value ? styles.lengthActive : ''}`}
                    >
                      <input
                        type="radio"
                        name="length"
                        value={opt.value}
                        checked={settings.length === opt.value}
                        onChange={setSetting('length')}
                        className={styles.hiddenRadio}
                      />
                      <span className={styles.lengthLabel}>{opt.label}</span>
                      <span className={styles.lengthSub}>{opt.sub}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── Error ──────────────────────────────────── */}
          {error && (
            <p className={styles.error} role="alert">⚠ {error}</p>
          )}

          {/* ── Generate ───────────────────────────────── */}
          <button
            type="submit"
            className={`btn btn-primary btn-lg ${styles.generateBtn}`}
            disabled={loading}
          >
            {loading ? 'Creating…' : '✨ Generate Story'}
          </button>
        </form>
      </div>
    </div>
  )
}
