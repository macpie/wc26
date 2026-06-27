import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { WC_ESPN } from './data/wc-espn.js'
import { theme } from './theme.js'
import { standings as calcStandings, thirdRace as calcThirdRace } from './lib/standings.js'

const PREFS_KEY = 'wc_prefs_v1'
const StoreContext = createContext(null)
export const useStore = () => useContext(StoreContext)

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') } catch (e) { return {} }
}

export function StoreProvider({ children }) {
  const saved = loadPrefs()

  // ---- persisted prefs ----
  const [view, setViewState] = useState(saved.view || 'today')
  const [dark, setDark] = useState(saved.dark || false)
  const [favs, setFavs] = useState(saved.favs || ['USA', 'BRA'])

  // ---- ephemeral UI ----
  const [sel, setSel] = useState(null)
  const [modalTab, setModalTab] = useState('summary')
  const [filter, setFilter] = useState('all')

  // ---- ESPN data source ----
  const [source, setSource] = useState('loading') // loading | live | error
  const [data, setData] = useState(null)
  const [detail, setDetail] = useState(null)

  const pollRef = useRef(null)

  const save = useCallback((patch) => {
    const next = Object.assign({ view, dark, favs }, patch)
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)) } catch (e) {}
  }, [view, dark, favs])

  const setView = (v) => { setViewState(v); save({ view: v }) }
  const toggleDark = () => { const d = !dark; setDark(d); save({ dark: d }) }
  const toggleFav = (id) => {
    setFavs(prev => {
      const has = prev.includes(id)
      const nextFavs = has ? prev.filter(x => x !== id) : prev.concat([id])
      save({ favs: nextFavs })
      return nextFavs
    })
  }

  // ---- data accessors ----
  const D = data
  const th = theme(dark)
  const t = (id) => (D ? D.TEAMS[id] : null)

  function mScore(m) {
    if (m.status === 'LIVE') return { hs: m.hs != null ? m.hs : 0, as: m.as != null ? m.as : 0, status: 'LIVE', minute: m.minute }
    return { hs: m.hs, as: m.as, status: m.status, minute: null }
  }
  const standings = (g) => calcStandings(D, g, mScore)
  const thirdRace = () => calcThirdRace(D, mScore)

  // Goal events for the open match come from the fetched ESPN match detail.
  function events(m) {
    return (detail && detail.id === m.id && detail.events) ? detail.events.slice().sort((a, b) => a.min - b.min) : []
  }
  // Is the detail for the currently-open match loaded yet?
  const detailReady = (m) => !!(detail && detail.id === m.id)

  // ---- match modal ----
  const openMatch = (m) => {
    if (m && (m.hs != null || m.status === 'LIVE')) {
      setSel(m.id); setModalTab('summary'); setDetail(null)
      WC_ESPN.detail(m.id)
        .then(d => setSel(cur => { if (cur === m.id) setDetail(d); return cur }))
        .catch(() => {})
    }
  }
  const closeMatch = () => setSel(null)

  // ---- live data (ESPN) ----
  const startPoll = useCallback(() => {
    clearInterval(pollRef.current)
    pollRef.current = setInterval(() => {
      setData(curData => {
        if (!curData) return curData
        WC_ESPN.refreshLive(curData.MATCHES)
          .then(r => setData(s => (s ? Object.assign({}, s, { MATCHES: r.matches }) : s)))
          .catch(() => {})
        return curData
      })
    }, 30000)
  }, [])

  const loadLive = useCallback(() => {
    setSource('loading')
    WC_ESPN.load()
      .then(d => { setData(d); setSource('live'); startPoll() })
      .catch(() => { setSource('error') })
  }, [startPoll])

  // ---- effects ----
  useEffect(() => {
    loadLive()
    return () => clearInterval(pollRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = {
    // state
    view, dark, favs, sel, modalTab, filter, source, data, detail,
    // accessors
    D, th, t, mScore, standings, thirdRace, events, detailReady,
    // actions
    setView, toggleDark, toggleFav, setFilter, setModalTab,
    openMatch, closeMatch, reload: loadLive,
  }
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
