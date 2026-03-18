import { Link } from 'react-router-dom'
import Header from '../components/Header.jsx'
import styles from './HomePage.module.css'

const FEATURES = [
  { emoji: '👧', label: 'Custom characters', desc: 'Name them, choose their type and appearance' },
  { emoji: '🌍', label: 'Diverse worlds', desc: 'Stories set across cultures and landscapes' },
  { emoji: '🌙', label: 'Age-appropriate', desc: 'Gentle language for children aged 2–5' },
  { emoji: '🔊', label: 'Read aloud', desc: 'Tap a button and let the app narrate' },
]

export default function HomePage() {
  return (
    <div className="page">
      <div className="container">
        <Header />

        <main className={styles.main}>
          <h1 className={styles.headline}>
            Every night, <br />
            <span className={styles.highlight}>a new story</span>
          </h1>
          <p className={styles.lead}>
            Build a personalized bedtime story starring your child's favorite characters — in seconds.
          </p>

          <Link to="/build" className={`btn btn-primary btn-lg ${styles.cta}`}>
            Let's build a story ✨
          </Link>

          <div className={styles.features}>
            {FEATURES.map((f) => (
              <div key={f.label} className={styles.feature}>
                <span className={styles.featureEmoji} aria-hidden="true">{f.emoji}</span>
                <div>
                  <strong className={styles.featureLabel}>{f.label}</strong>
                  <span className={styles.featureDesc}> — {f.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
