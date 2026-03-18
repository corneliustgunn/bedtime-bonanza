import { useState, useEffect, useRef } from 'react'
import styles from './StoryDisplay.module.css'

export default function StoryDisplay({ title, pages }) {
  const [currentPage, setCurrentPage] = useState(0)
  const [speaking, setSpeaking] = useState(false)
  const contentRef = useRef(null)

  const total = pages.length
  const hasSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window

  // Reset to page 0 when story changes
  useEffect(() => {
    setCurrentPage(0)
    stopSpeech()
  }, [title])

  // Scroll to top of content on page change
  useEffect(() => {
    contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [currentPage])

  function stopSpeech() {
    if (hasSpeech) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
    }
  }

  function toggleReadAloud() {
    if (!hasSpeech) return
    if (speaking) {
      stopSpeech()
      return
    }
    const utterance = new SpeechSynthesisUtterance(pages[currentPage])
    utterance.rate = 0.85
    utterance.pitch = 1.05
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
    setSpeaking(true)
  }

  function goTo(page) {
    stopSpeech()
    setCurrentPage(page)
  }

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.title}>{title}</h2>

      <div className={styles.pageIndicator} aria-label={`Page ${currentPage + 1} of ${total}`}>
        {pages.map((_, i) => (
          <button
            key={i}
            className={`${styles.dot} ${i === currentPage ? styles.dotActive : ''}`}
            onClick={() => goTo(i)}
            aria-label={`Go to page ${i + 1}`}
            type="button"
          />
        ))}
      </div>

      <div className={styles.storyPage} ref={contentRef} key={currentPage}>
        <p className={styles.text}>{pages[currentPage]}</p>
      </div>

      <div className={styles.nav}>
        <button
          className="btn btn-secondary"
          onClick={() => goTo(currentPage - 1)}
          disabled={currentPage === 0}
          type="button"
        >
          ← Prev
        </button>

        <span className={styles.pageCount}>
          {currentPage + 1} / {total}
        </span>

        {currentPage < total - 1 ? (
          <button
            className="btn btn-primary"
            onClick={() => goTo(currentPage + 1)}
            type="button"
          >
            Next →
          </button>
        ) : (
          <button
            className="btn btn-secondary"
            onClick={() => goTo(0)}
            type="button"
          >
            Start Over
          </button>
        )}
      </div>

      {hasSpeech && (
        <button
          className={`btn btn-ghost btn-sm ${styles.readAloud}`}
          onClick={toggleReadAloud}
          type="button"
        >
          {speaking ? '⏹ Stop Reading' : '🔊 Read Aloud'}
        </button>
      )}
    </div>
  )
}
