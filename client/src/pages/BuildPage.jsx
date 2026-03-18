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
  { value: 'friendship', label: '🤝 Friendship' },
  { value: 'kindness', label: '💛 Kindness' },
  { value: 'bravery', label: '🦁 Bravery' },
  { value: 'curiosity', label: '🔍 Curiosity' },
  { value: 'sharing', label: '🎁 Sharing' },
  { value: 'patience', label: '🌱 Patience' },
]

const DEFAULT_SETTINGS = {
  setting: 'Enchanted forest',
  theme: 'friendship',
  length: 'short',
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

  async function handleGenerate(e) {
    e.preventDefault()
    if (characters.length === 0) {
      setError('Please add at least one character to your story.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characters, settings }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
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
                <label className="form-label" htmlFor="setting">World / Setting</label>
                <div className="select-wrapper">
                  <select id="setting" className="form-select" value={settings.setting} onChange={setSetting('setting')}>
                    {SETTINGS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="theme">Story Theme</label>
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
                    { value: 'short', label: 'Short', sub: '~3 min read' },
                    { value: 'medium', label: 'Medium', sub: '~5 min read' },
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
