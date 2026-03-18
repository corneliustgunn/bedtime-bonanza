import { Link } from 'react-router-dom'
import styles from './Header.module.css'

export default function Header({ subtitle }) {
  return (
    <header className={styles.header}>
      <div className={styles.stars} aria-hidden="true">
        <span className={styles.star} style={{ '--delay': '0s', '--x': '10%', '--size': '4px' }} />
        <span className={styles.star} style={{ '--delay': '0.8s', '--x': '25%', '--size': '3px' }} />
        <span className={styles.star} style={{ '--delay': '1.4s', '--x': '60%', '--size': '5px' }} />
        <span className={styles.star} style={{ '--delay': '0.3s', '--x': '75%', '--size': '3px' }} />
        <span className={styles.star} style={{ '--delay': '2s', '--x': '88%', '--size': '4px' }} />
        <span className={styles.star} style={{ '--delay': '1s', '--x': '45%', '--size': '3px' }} />
      </div>
      <Link to="/" className={styles.logo}>
        <span className={styles.moon} aria-hidden="true">🌙</span>
        <span className={styles.title}>Bedtime Bonanza</span>
      </Link>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </header>
  )
}
