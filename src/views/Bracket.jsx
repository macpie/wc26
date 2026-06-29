import { useRef, useState, useLayoutEffect } from 'react'
import { useStore } from '../store.jsx'
import { Wrap, Badge } from '../components/atoms.jsx'
import { dateKey, liveClock } from '../lib/util.js'

const GAP = 46       // horizontal gap between rounds (room for the connector elbows)
const CELL_W = 208
const SLOT = 88      // vertical slot height for a cell in the most-populated round

// All knockout rounds we know how to render, in order. Only those present in the data show
// as columns — the WC uses Round of 32 (no play-offs); the Champions League uses play-offs.
const KO_ROUNDS = [
  { slug: 'round-of-32', title: 'Round of 32' },
  { slug: 'knockout-round-playoffs', title: 'Play-offs' },
  { slug: 'round-of-16', title: 'Round of 16' },
  { slug: 'quarterfinals', title: 'Quarter-finals' },
  { slug: 'semifinals', title: 'Semi-finals' },
  { slug: 'final', title: 'Final' },
]

// Saved World Cup bracket order from ESPN (espn.com/soccer/bracket/_/league/fifa.world).
// ESPN exposes each match's on-bracket position only on the (CORS-blocked) bracket page, so
// we save it here. For each round, value[k] is the bracket position (1-based) of that round's
// k-th match once the round is sorted by event id — which follows FIFA's fixed match order, so
// this layout holds for the real tournament regardless of which teams qualify. Reordering by
// it makes the columns + connectors match ESPN's bracket. Only the WC matches these counts;
// other competitions fall back to chronological order.
const WC_BRACKET_ORDER = {
  'round-of-32': [3, 9, 4, 1, 10, 11, 2, 8, 7, 12, 5, 6, 15, 14, 13, 16],
  'round-of-16': [2, 1, 5, 6, 3, 4, 8, 7],
  'quarterfinals': [1, 2, 3, 4],
  'semifinals': [1, 2],
  'final': [1],
}

function bracketSorted(slug, matches) {
  const tpl = WC_BRACKET_ORDER[slug]
  if (!tpl || matches.length !== tpl.length) return matches
  return matches.slice().sort((a, b) => Number(a.id) - Number(b.id))
    .map((m, i) => ({ m, pos: tpl[i] }))
    .sort((a, b) => a.pos - b.pos)
    .map(x => x.m)
}

function ColumnHead({ label, color }) {
  return (
    <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color, marginBottom: 8 }}>{label}</div>
  )
}

// ---- live bracket cell, built from a real ESPN knockout match ----
function LiveKoCell({ m }) {
  const { th, t, favs, mScore, openMatch } = useStore()
  const s = mScore(m)
  const played = s.hs != null
  const isLive = m.status === 'LIVE'
  const clickable = played || isLive || (m.hKnown && m.aKnown) // decided matchups open a preview
  const favH = m.hKnown && favs.includes(m.h), favA = m.aKnown && favs.includes(m.a)
  const fav = favH || favA

  const slot = (code, known, label, score, isWinner, isFav) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 9px' }}>
      {known
        ? <Badge id={code} size={19} />
        : <span style={{ width: 19, height: 19, borderRadius: '50%', border: '1.5px dashed ' + th.bd2, flex: '0 0 auto' }} />}
      <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: known ? (isFav || isWinner ? 800 : 700) : 550, color: isFav ? th.accent : (known ? th.tx : th.faint), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {known ? (t(code) ? t(code).name : code) : label}
      </span>
      {isFav ? <span style={{ color: th.accent, fontSize: 10, flex: '0 0 auto' }}>★</span> : null}
      {played ? <span style={{ fontSize: 13, fontWeight: 800, color: isWinner ? th.tx : th.sub, fontVariantNumeric: 'tabular-nums' }}>{score}</span> : null}
    </div>
  )

  return (
    <button
      onClick={() => clickable && openMatch(m)}
      style={{
        width: CELL_W, border: '1px solid ' + (fav ? th.accent : th.bd), background: fav ? th.accentSoft : th.sf, borderRadius: 12, overflow: 'hidden',
        textAlign: 'left', font: 'inherit', cursor: clickable ? 'pointer' : 'default', padding: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 9px', background: th.sf2, borderBottom: '1px solid ' + th.bd }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, color: th.faint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.date + ' · ' + m.time}</span>
        {isLive
          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9.5, fontWeight: 800, color: th.live, flex: '0 0 auto' }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: th.live, animation: 'wcPulse 1s infinite' }} />{liveClock(s)}</span>
          : <span style={{ fontSize: 9.5, fontWeight: 700, color: th.faint, flex: '0 0 auto' }}>{played ? 'FT' : ''}</span>}
      </div>
      {slot(m.h, m.hKnown, m.hName, s.hs, played && s.hs > s.as, favH)}
      <div style={{ height: 1, background: th.bd }} />
      {slot(m.a, m.aKnown, m.aName, s.as, played && s.as > s.hs, favA)}
    </button>
  )
}

// Lay the rounds out into columns + the connections between cells. A clean single-elimination
// bracket (WC) is split into two sides that meet at the Final in the centre; anything else
// (e.g. the two-legged Champions League) stays a single left-to-right flow.
function buildLayout(rounds, byRound, th) {
  const roundMatches = rounds.map(r => byRound[r.slug] || [])
  const counts = roundMatches.map(a => a.length)
  const twoSided = counts.length >= 3 && counts[counts.length - 1] === 1 &&
    counts.slice(0, -1).every((c, i) => c === 2 * counts[i + 1])

  const columns = [], connections = []
  if (twoSided) {
    const last = rounds.length - 1
    const tag = {}
    rounds.slice(0, last).forEach((r, ri) => { tag['L' + ri] = columns.length; columns.push({ title: r.title, accent: false, matches: roundMatches[ri].slice(0, roundMatches[ri].length / 2) }) })
    tag.F = columns.length; columns.push({ title: rounds[last].title, accent: true, matches: roundMatches[last] })
    for (let ri = last - 1; ri >= 0; ri--) { tag['R' + ri] = columns.length; columns.push({ title: rounds[ri].title, accent: false, matches: roundMatches[ri].slice(roundMatches[ri].length / 2) }) }
    ;['L', 'R'].forEach(side => {
      for (let ri = 0; ri < last; ri++) {
        const fi = tag[side + ri], ti = ri === last - 1 ? tag.F : tag[side + (ri + 1)]
        columns[fi].matches.forEach((m, j) => connections.push([[fi, j], [ti, Math.floor(j / 2)]]))
      }
    })
  } else {
    rounds.forEach((r, ri) => columns.push({ title: r.title, accent: ri === rounds.length - 1, matches: roundMatches[ri] }))
    for (let r = 0; r < columns.length - 1; r++) {
      const cur = columns[r].matches, next = columns[r + 1].matches
      cur.forEach((m, i) => connections.push([[r, i], [r + 1, Math.floor(i * next.length / cur.length)]]))
    }
  }
  return { columns, connections }
}

export function Bracket() {
  const { th, D } = useStore()

  // Group knockout fixtures by round, then order each round to match ESPN's bracket layout
  // (falling back to chronological order where we have no saved template).
  const byRound = {}
  D.MATCHES.forEach(m => { if (m.round && m.round !== 'group-stage') (byRound[m.round] = byRound[m.round] || []).push(m) })
  Object.keys(byRound).forEach(slug => {
    byRound[slug].sort((a, b) => dateKey(a.date) - dateKey(b.date) || String(a.id).localeCompare(String(b.id)))
    byRound[slug] = bracketSorted(slug, byRound[slug])
  })
  const rounds = KO_ROUNDS.filter(r => byRound[r.slug] && byRound[r.slug].length)

  const { columns, connections } = buildLayout(rounds, byRound, th)
  // Every column gets the same total height; a cell's slot = SLOT × (maxCells / thisCount),
  // so each round's cells are centred against the round that feeds them (and never overlap).
  const maxCells = Math.max(1, ...columns.map(c => c.matches.length))

  // Measure rendered cell positions and draw elbow connectors (works whichever direction
  // the feeder sits relative to its target, so two-sided brackets converge at the centre).
  const wrapRef = useRef(null)
  const cellRefs = useRef([])
  cellRefs.current = columns.map(() => [])
  const [conns, setConns] = useState({ w: 0, h: 0, lines: [] })

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const compute = () => {
      const wr = wrap.getBoundingClientRect()
      const box = el => { const r = el.getBoundingClientRect(); return { x: r.left - wr.left + wrap.scrollLeft, y: r.top - wr.top + wrap.scrollTop, w: r.width, h: r.height } }
      const lines = []
      connections.forEach(([[fc, fi], [tc, ti]]) => {
        const fe = cellRefs.current[fc] && cellRefs.current[fc][fi]
        const te = cellRefs.current[tc] && cellRefs.current[tc][ti]
        if (!fe || !te) return
        const a = box(fe), b = box(te)
        const ltr = a.x < b.x
        const ax = ltr ? a.x + a.w : a.x, bx = ltr ? b.x : b.x + b.w
        const ay = a.y + a.h / 2, by = b.y + b.h / 2, mx = (ax + bx) / 2
        lines.push(`M${ax.toFixed(1)},${ay.toFixed(1)} H${mx.toFixed(1)} V${by.toFixed(1)} H${bx.toFixed(1)}`)
      })
      setConns({ w: wrap.scrollWidth, h: wrap.scrollHeight, lines })
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(wrap)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [D.slug, D.MATCHES.length, columns.length])

  return (
    <Wrap>
      <div style={{ marginBottom: 18, fontSize: 13, color: th.sub, fontWeight: 550 }}>
        Knockout fixtures from the live schedule — kickoff times included. Decided matchups show teams and scores; undecided slots fill in as earlier rounds finish. Scroll →
      </div>
      {columns.length ? (
        <div className="wc-scroll" ref={wrapRef} style={{ overflowX: 'auto', position: 'relative', paddingBottom: 18 }}>
          <svg width={conns.w} height={conns.h} style={{ position: 'absolute', top: 0, left: 0, zIndex: 0, pointerEvents: 'none', overflow: 'visible' }}>
            {conns.lines.map((d, i) => <path key={i} d={d} fill="none" stroke={th.bd2} strokeWidth={1.5} />)}
          </svg>
          <div style={{ display: 'flex', gap: GAP, alignItems: 'stretch', position: 'relative', zIndex: 1, width: 'max-content' }}>
            {columns.map((col, ci) => (
              <div key={ci} style={{ display: 'flex', flexDirection: 'column', flex: '0 0 auto', alignSelf: 'stretch', width: CELL_W }}>
                <ColumnHead label={col.title} color={col.accent ? th.accent : th.tx} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {col.matches.map((m, mi) => (
                    <div key={m.id} style={{ height: (SLOT * maxCells) / col.matches.length, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div ref={el => { cellRefs.current[ci][mi] = el }}>
                        <LiveKoCell m={m} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ padding: '30px 0', color: th.faint, fontWeight: 600 }}>Knockout fixtures will appear once they’re scheduled.</div>
      )}
    </Wrap>
  )
}
