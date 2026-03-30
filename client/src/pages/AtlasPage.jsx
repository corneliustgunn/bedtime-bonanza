import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'
import Header from '../components/Header.jsx'
import { CHARACTER_TYPES } from '../components/characterTypes.js'
import { getCoords } from '../utils/locationCoords.js'
import styles from './AtlasPage.module.css'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'
const TYPE_EMOJI = Object.fromEntries(CHARACTER_TYPES.map((t) => [t.type, t.emoji]))

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export default function AtlasPage() {
  const [entries, setEntries] = useState([])
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('storyAtlas')
      if (raw) setEntries(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  // Group entries by location string
  const byLocation = {}
  for (const e of entries) {
    if (!byLocation[e.location]) byLocation[e.location] = []
    byLocation[e.location].push(e)
  }

  // Separate real-world (mappable) from fantastical / unknown
  const pinned   = Object.entries(byLocation).filter(([loc]) =>  getCoords(loc))
  const unmapped = Object.entries(byLocation).filter(([loc]) => !getCoords(loc))

  const selectedStories = selected ? (byLocation[selected] ?? []) : []

  const locationCount = Object.keys(byLocation).length
  const storyCount    = entries.length

  return (
    <div className="page">
      <div className={`container ${styles.container}`}>
        <Header subtitle="Story Atlas" />

        {storyCount === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyGlobe} aria-hidden="true">🌍</span>
            <p className={styles.emptyTitle}>Your atlas is empty.</p>
            <p className={styles.emptyHint}>Build your first story to plant a pin on the map.</p>
            <Link to="/build" className="btn btn-primary">Build a story ✨</Link>
          </div>
        ) : (
          <main className={styles.main}>
            <p className={styles.stats}>
              {storyCount} {storyCount === 1 ? 'story' : 'stories'} across{' '}
              {locationCount} {locationCount === 1 ? 'location' : 'locations'}
            </p>

            <div className={styles.mapWrapper}>
              <ComposableMap
                projectionConfig={{ scale: 142, center: [10, 10] }}
                width={980}
                height={490}
                className={styles.map}
              >
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        style={{
                          default: { fill: '#16213e', stroke: '#2a2a4a', strokeWidth: 0.5, outline: 'none' },
                          hover:   { fill: '#1e2a4a', stroke: '#2a2a4a', strokeWidth: 0.5, outline: 'none' },
                          pressed: { fill: '#16213e', outline: 'none' },
                        }}
                      />
                    ))
                  }
                </Geographies>

                {pinned.map(([loc, stories]) => {
                  const isActive = selected === loc
                  return (
                    <Marker
                      key={loc}
                      coordinates={getCoords(loc)}
                      onClick={() => setSelected(isActive ? null : loc)}
                    >
                      <g
                        className={`${styles.pin} ${isActive ? styles.pinActive : ''}`}
                        role="button"
                        tabIndex={0}
                        aria-label={`${loc}: ${stories.length} ${stories.length === 1 ? 'story' : 'stories'}`}
                        onKeyDown={(e) => e.key === 'Enter' && setSelected(isActive ? null : loc)}
                      >
                        {/* outer glow ring, only when active */}
                        {isActive && <circle cx={0} cy={-11} r={12} className={styles.pinGlow} />}
                        {/* pin head */}
                        <circle cx={0} cy={-11} r={isActive ? 8 : 6} className={styles.pinHead} />
                        {/* pin stem */}
                        <line x1={0} y1={-3} x2={0} y2={0} className={styles.pinStem} strokeWidth={2} strokeLinecap="round" />
                        {/* story count badge */}
                        {stories.length > 1 && (
                          <text x={0} y={-10} textAnchor="middle" dominantBaseline="middle" className={styles.pinCount}>
                            {stories.length}
                          </text>
                        )}
                      </g>
                    </Marker>
                  )
                })}
              </ComposableMap>
            </div>

            {selected && (
              <div className={styles.panel} key={selected}>
                <div className={styles.panelHeader}>
                  <h2 className={styles.panelHeading}>
                    <span aria-hidden="true">📍</span> {selected}
                  </h2>
                  <button
                    type="button"
                    className={styles.panelClose}
                    onClick={() => setSelected(null)}
                    aria-label="Close panel"
                  >
                    ×
                  </button>
                </div>
                <div className={styles.stories}>
                  {selectedStories.map((s) => (
                    <div key={s.id} className={styles.storyCard}>
                      <p className={styles.storyTitle}>{s.title}</p>
                      <div className={styles.chars}>
                        {s.characters.map((c) => (
                          <span key={c.name} className={styles.char}>
                            <span aria-hidden="true">{TYPE_EMOJI[c.type] ?? '⭐'}</span> {c.name}
                          </span>
                        ))}
                      </div>
                      <p className={styles.storyDate}>{formatDate(s.ts)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {unmapped.length > 0 && (
              <section className={styles.realms}>
                <h3 className={styles.realmsHeading}>
                  <span aria-hidden="true">✨</span> Fantastical Realms
                </h3>
                <div className={styles.realmList}>
                  {unmapped.map(([loc, stories]) => (
                    <div key={loc} className={styles.realmCard}>
                      <span className={styles.realmName}>{loc}</span>
                      <span className={styles.realmCount}>
                        {stories.length} {stories.length === 1 ? 'story' : 'stories'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </main>
        )}

        <div className={styles.actions}>
          <Link to="/build" className="btn btn-secondary">Build a story</Link>
          <Link to="/"      className="btn btn-ghost">Home</Link>
        </div>
      </div>
    </div>
  )
}
