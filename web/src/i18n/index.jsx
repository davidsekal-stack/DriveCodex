import { createContext, useContext, useState, useEffect } from 'react'
import { strings as cs } from './cs.js'

// Re-export non-React helpers from translate.js
export { getStrings, translate } from './translate.js'
import { allStrings } from './translate.js'

function detectLang() {
  const stored = localStorage.getItem('gb-lang')
  if (stored && allStrings[stored]) return stored
  const nav = (navigator.language ?? '').slice(0, 2)
  if (nav === 'de') return 'de'
  if (nav === 'en') return 'en'
  return 'cs'
}

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(detectLang)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const dict = allStrings[lang] || cs

  /** Translate key with optional parameter interpolation */
  const tr = (key, params) => {
    let str = dict[key] ?? cs[key] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(`{${k}}`, String(v))
      }
    }
    return str
  }

  const changeLang = (l) => {
    setLang(l)
    localStorage.setItem('gb-lang', l)
  }

  return (
    <I18nContext.Provider value={{ tr, lang, changeLang }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
