import styles from './LoadingSpinner.module.css'

const MESSAGES = [
  'Weaving your story…',
  'Sprinkling some magic…',
  'Finding the perfect words…',
  'Gathering the characters…',
  'Setting the scene…',
]

export default function LoadingSpinner() {
  return (
    <div className={styles.overlay} role="status" aria-live="polite">
      <div className={styles.content}>
        <div className={styles.spinner} aria-hidden="true">✨</div>
        <p className={styles.message}>{MESSAGES[Math.floor(Math.random() * MESSAGES.length)]}</p>
        <p className={styles.submessage}>This takes about 5-10 seconds</p>
      </div>
    </div>
  )
}
