import { useStore } from '../store.jsx'
import { Badge } from './atoms.jsx'
import { GoalIcon } from './icons.jsx'
import { txtOn, formationRows } from '../lib/util.js'

function Pitch({ tid, lineup, attackUp }) {
  const { th, t, dark } = useStore()
  const T = t(tid)
  let rows = lineup.rows.slice()
  if (attackUp) rows = rows.slice().reverse()
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, justifyContent: 'center' }}>
        <Badge id={tid} size={24} />
        <span style={{ fontWeight: 750, fontSize: 14, color: th.tx }}>{T.name}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: th.faint }}>{lineup.f}</span>
      </div>
      <div style={{
        position: 'relative', borderRadius: 14, padding: '14px 8px', display: 'flex', flexDirection: 'column', gap: 6,
        background: dark ? 'linear-gradient(180deg,#13361f,#0e2a18)' : 'linear-gradient(180deg,#2f9e54,#268a48)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)',
      }}>
        <div style={{ position: 'absolute', left: '12%', right: '12%', top: '50%', height: 1, background: 'rgba(255,255,255,0.25)' }} />
        {rows.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
            {row.map((p, pi) => (
              <div key={pi} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 60 }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', background: T.c, color: txtOn(T.c), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, boxShadow: '0 2px 5px rgba(0,0,0,0.3)' }}>{p.n}</span>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 60 }}>{p.name || ''}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// Pull a numeric stat from an ESPN boxscore map, trying several possible keys.
function statNum(map, keys) {
  for (const k of keys) { if (map && map[k] != null && map[k] !== '') return parseFloat(String(map[k]).replace('%', '')) || 0 }
  return null
}

// Build the paired-bar stat rows from ESPN boxscore maps (or null if unusable).
function liveStatRows(sH, sA) {
  if (!sH || !sA) return null
  const rows = []
  const posH = statNum(sH, ['possessionPct']), posA = statNum(sA, ['possessionPct'])
  if (posH != null && posA != null) rows.push(['Possession', posH + '%', posA + '%', posH, posA])
  const pair = (label, keys) => {
    const vh = statNum(sH, keys), va = statNum(sA, keys)
    if (vh != null && va != null) rows.push([label, vh, va, vh, va])
  }
  pair('Shots', ['totalShots'])
  pair('On target', ['shotsOnTarget', 'onTargetScoringAtt'])
  pair('Corners', ['wonCorners'])
  pair('Fouls', ['foulsCommitted'])
  pair('Saves', ['saves'])
  return rows.length ? rows : null
}

function Msg({ children }) {
  const { th } = useStore()
  return <div style={{ textAlign: 'center', color: th.faint, fontWeight: 600, padding: '30px 0', lineHeight: 1.5 }}>{children}</div>
}

export function MatchModal() {
  const { th, D, t, sel, modalTab, setModalTab, mScore, events, detailReady, closeMatch, detail } = useStore()
  if (!sel) return null
  const m = D.MATCHES.find(x => x.id === sel)
  if (!m) return null
  const s = mScore(m)
  const isLive = m.status === 'LIVE'
  const ready = detailReady(m)
  const ev = events(m)

  const tabBtn = (id, label) => {
    const on = modalTab === id
    return (
      <button key={id} onClick={() => setModalTab(id)} style={{
        border: 'none', cursor: 'pointer', font: 'inherit', padding: '9px 16px', borderRadius: 9999, fontSize: 13,
        fontWeight: on ? 800 : 650, color: on ? '#fff' : th.sub, background: on ? th.accent : 'transparent',
      }}>{label}</button>
    )
  }

  const lineups = detail && detail.lineups
  const stats = detail && detail.stats
  const statRows = stats ? liveStatRows(stats[m.h], stats[m.a]) : null

  let body
  if (!ready) {
    body = (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '36px 0' }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', border: '3px solid ' + th.bd, borderTopColor: th.accent, animation: 'wcSpin .8s linear infinite' }} />
      </div>
    )
  } else if (modalTab === 'summary') {
    body = ev.length
      ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {ev.map((e, i) => {
            const home = e.team === m.h
            return (
              <div key={i} style={{ display: 'flex', justifyContent: home ? 'flex-start' : 'flex-end', padding: '7px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexDirection: home ? 'row' : 'row-reverse', maxWidth: '78%' }}>
                  <span style={{ fontWeight: 850, fontSize: 13, color: th.accent, minWidth: 34, textAlign: home ? 'left' : 'right' }}>{e.min + "'"}</span>
                  <GoalIcon color={th.tx} />
                  <span style={{ fontSize: 14, fontWeight: 650, color: th.tx, textAlign: home ? 'left' : 'right' }}>
                    {e.name}
                    {e.assist ? <span style={{ color: th.faint, fontWeight: 600, fontSize: 12 }}>{'  assist ' + e.assist}</span> : null}
                    <span style={{ color: th.faint, fontWeight: 600 }}>{'  ' + (t(e.team) ? t(e.team).code : e.team)}</span>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )
      : <Msg>{s.hs == null ? 'Match has not started' : 'No goals'}</Msg>
  } else if (modalTab === 'stats') {
    body = statRows && statRows.length
      ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 2px' }}>
          {statRows.map((row, i) => {
            const [label, vh, va, bh, ba] = row
            return (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 750, color: th.tx, marginBottom: 6 }}>
                  <span>{vh}</span>
                  <span style={{ color: th.sub, fontWeight: 700, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
                  <span>{va}</span>
                </div>
                <div style={{ display: 'flex', gap: 4, height: 7 }}>
                  <div style={{ flex: bh || 1, background: th.accent, borderRadius: 9999, opacity: bh ? 1 : 0.25 }} />
                  <div style={{ flex: ba || 1, background: th.sub, borderRadius: 9999, opacity: ba ? 0.55 : 0.25 }} />
                </div>
              </div>
            )
          })}
        </div>
      )
      : <Msg>Match stats aren’t available yet.</Msg>
  } else {
    const luH = lineups && lineups[m.h]
    const luA = lineups && lineups[m.a]
    body = (luH && luA)
      ? (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <Pitch tid={m.h} lineup={{ f: luH.formation, rows: formationRows(luH.formation, luH.players) }} attackUp={false} />
          <Pitch tid={m.a} lineup={{ f: luA.formation, rows: formationRows(luA.formation, luA.players) }} attackUp={true} />
        </div>
      )
      : <Msg>Lineups aren’t available yet.</Msg>
  }

  return (
    <div onClick={closeMatch} style={{
      position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(8,6,20,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, background: th.sf, borderRadius: 22, overflow: 'hidden', boxShadow: th.shadow, animation: 'wcPop .2s ease' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid ' + th.bd, position: 'relative' }}>
          <button onClick={closeMatch} style={{ position: 'absolute', right: 14, top: 14, width: 32, height: 32, borderRadius: '50%', border: '1px solid ' + th.bd, background: th.sf2, cursor: 'pointer', color: th.sub, fontSize: 18, lineHeight: 1 }}>×</button>
          <div style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: th.faint, letterSpacing: '0.04em' }}>
            {(m.g && m.g !== '?' ? 'Group ' + m.g : (m.stage || 'Knockout')) + (m.v ? ' · ' + m.v : '')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 14, marginTop: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <Badge id={m.h} size={46} />
              <span style={{ fontWeight: 750, fontSize: 14, color: th.tx, textAlign: 'center' }}>{t(m.h).name}</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              {s.hs != null
                ? <div style={{ fontWeight: 850, fontSize: 38, letterSpacing: '-0.03em', color: th.tx, lineHeight: 1 }}>{s.hs + ' – ' + s.as}</div>
                : <div style={{ fontWeight: 800, fontSize: 20, color: th.tx }}>{m.time}</div>}
              <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: isLive ? th.live : th.faint }}>
                {isLive ? (s.minute >= 90 ? "90'+" : s.minute + "'") : (s.hs != null ? 'Full time' : m.date)}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <Badge id={m.a} size={46} />
              <span style={{ fontWeight: 750, fontSize: 14, color: th.tx, textAlign: 'center' }}>{t(m.a).name}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, padding: '12px 18px 0', justifyContent: 'center' }}>
          {tabBtn('summary', 'Summary')}
          {tabBtn('lineups', 'Lineups')}
          {tabBtn('stats', 'Stats')}
        </div>
        <div style={{ padding: '16px 22px 24px' }}>{body}</div>
      </div>
    </div>
  )
}
