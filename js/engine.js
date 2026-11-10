/* ================= Motor de señales =================
   Funciones puras sobre la base (DB). MAPPI escribe filas (guardados, pedidos, opiniones,
   búsquedas, seguidos); este motor las convierte en series semanales, condiciones, estado
   y un puntaje de oportunidad explicable para Radar. Radar propone; una persona decide. */
const SOURCES = {
  tiktok:    { n: 'TikTok', short: 'TikTok', ty: 'Externa', u: 'videos nuevos por semana', icon: 'tiktok-logo' },
  google:    { n: 'Reseñas de Google', short: 'Google', ty: 'Externa', u: 'reseñas nuevas por semana', icon: 'google-logo' },
  instagram: { n: 'Instagram', short: 'Instagram', ty: 'Externa', u: 'menciones por semana', icon: 'instagram-logo' },
  mappi:     { n: 'MAPPI', short: 'MAPPI', ty: 'Interna', u: 'guardados por semana', icon: 'bookmark-simple' },
  busquedas: { n: 'Búsquedas en Rappi', short: 'Búsquedas', ty: 'Interna', u: 'búsquedas por semana', icon: 'magnifying-glass' },
  pedidos:   { n: 'Pedidos', short: 'Pedidos', ty: 'Resultado', u: 'pedidos por semana', icon: 'receipt' },
};
const INTEREST_KEYS = ['tiktok', 'google', 'instagram', 'mappi', 'busquedas'];
const EXTERNAL_KEYS = ['tiktok', 'google', 'instagram'];
const ESTADO = {
  alerta: ['Para revisión', 't-acc'],
  obs:    ['En observación', 't-warn'],
  cons:   ['Consolidado', 't-mut'],
  none:   ['Sin señales', 't-mut'],
};

const Engine = {
  weekOf(ms) {
    const diff = Math.max(0, Date.parse(DB.data.meta.anchor) - ms);
    return Math.max(0, 7 - Math.floor(diff / (7 * DAY)));
  },
  // Series de 8 semanas. "mappi" se calcula desde la tabla de guardados; la sesión suma
  // búsquedas y pedidos a la semana actual.
  series(rid) {
    const d = DB.data, out = { tiktok: null, google: null, instagram: null, mappi: [0, 0, 0, 0, 0, 0, 0, 0], busquedas: null, pedidos: null };
    d.signals_weekly.forEach(s => { if (s.restaurant_id === rid) out[s.source] = [...s.values]; });
    d.saves.forEach(s => { if (s.restaurant_id === rid) out.mappi[this.weekOf(Date.parse(s.created_at))]++; });
    const searches = d.events.filter(e => e.type === 'search' && (e.matches || []).includes(rid)).length;
    const sessionOrders = d.orders.filter(o => o.session && o.restaurant_id === rid).length;
    if (out.busquedas) out.busquedas[7] += searches;
    if (out.pedidos) out.pedidos[7] += sessionOrders;
    return out;
  },
  growth(a) { if (!a) return null; const f = Math.max(a[0], 1); return Math.round((a[7] - a[0]) / f * 100); },
  streak(a) { if (!a) return 0; let n = 0; for (let i = a.length - 1; i > 0; i--) { if (a[i] > a[i - 1]) n++; else break; } return n; },
  growing(a, rule) { return !!a && this.streak(a) >= rule.min_rising_weeks && this.growth(a) >= rule.min_growth; },
  // Hubo una racha de alzas relevante en algún momento del período (para "En observación")
  hadRise(a, rule) {
    if (!a) return false;
    for (let i = 1; i < a.length; i++) {
      let j = i; while (j < a.length && a[j] > a[j - 1]) j++;
      const run = j - i, base = Math.max(a[i - 1], 1);
      if (run >= rule.min_rising_weeks && (a[j - 1] - a[i - 1]) / base * 100 >= rule.min_growth) return true;
      i = j;
    }
    return false;
  },
  // Base pequeña: menos de N videos y N reseñas por semana → se exige una fuente más
  smallBase(s, rule) { return !!(s.tiktok || s.google) && ['tiktok', 'google'].every(k => !s[k] || s[k][7] < rule.small_base); },

  analyze(rid, rule = DB.data.rule) {
    const r = DB.rest(rid), s = this.series(rid);
    const grow = INTEREST_KEYS.filter(k => this.growing(s[k], rule));
    const ext = grow.filter(k => EXTERNAL_KEYS.includes(k));
    const hasExternal = EXTERNAL_KEYS.some(k => s[k]);
    const small = this.smallBase(s, rule);
    const need = rule.min_sources + (small ? 1 : 0);
    const best = INTEREST_KEYS.filter(k => s[k]).map(k => [k, this.streak(s[k])]).sort((a, b) => b[1] - a[1])[0] || ['tiktok', 0];
    const crit = {
      perfil: [r.audience_18_34 >= rule.min_audience, r.audience_18_34 >= rule.min_audience
        ? `${r.audience_18_34}% de la audiencia tiene entre 18 y 34 años`
        : `Solo ${r.audience_18_34}% tiene entre 18 y 34 años`],
      personas: [r.top_account_share <= rule.max_top_share, r.top_account_share <= rule.max_top_share
        ? `${r.distinct_accounts} cuentas distintas; la que más aporta suma ${r.top_account_share}%`
        : `Una sola cuenta aporta ${r.top_account_share}% de las menciones`],
      repite: [grow.length >= need && ext.length >= rule.min_external, !hasExternal
        ? `${grow.length} fuentes internas creciendo; no hay fuente externa en la zona`
        : `${grow.length} fuentes creciendo, ${ext.length} externas${small ? ` (base pequeña: se exigen ${need})` : ''}`],
      sostiene: [best[1] >= rule.sustain_weeks, best[1] > 0
        ? `${best[1]} semana${best[1] > 1 ? 's' : ''} seguidas en ${SOURCES[best[0]].short}`
        : 'Ninguna fuente sube esta semana'],
    };
    const ok = Object.values(crit).filter(x => x[0]).length;
    const ordersGrowth = this.growth(s.pedidos) || 0;
    let estado = 'none';
    if (s.pedidos && s.pedidos[7] >= rule.consolidated_orders && !grow.length) estado = 'cons';
    else if (ok === 4) estado = 'alerta';
    else if (INTEREST_KEYS.some(k => this.hadRise(s[k], rule))) estado = 'obs';
    const flags = [];
    if (small) flags.push('Base pequeña');
    if (!hasExternal) flags.push('Sin fuente externa');
    if (r.anti_signals.length) flags.push('Con antiseñales');
    if (ordersGrowth > rule.late_orders_growth) flags.push('Ya visible en ventas');
    const ix = this.interestIndex(s);
    const gi = Math.round((ix[7] - ix[0]) / Math.max(ix[0], 1) * 100);
    return { r, s, grow, ext, small, crit, ok, estado, flags, ordersGrowth, ix, gi, streak: best[1], hasExternal };
  },
  idx(a) { const m = a.reduce((x, y) => x + y, 0) / a.length || 1; return a.map(v => v / m * 100); },
  interestIndex(s) {
    const ks = INTEREST_KEYS.filter(k => s[k] && s[k].some(v => v > 0));
    if (!ks.length) return [100, 100, 100, 100, 100, 100, 100, 100];
    const ix = ks.map(k => this.idx(s[k]));
    return [...Array(8)].map((_, i) => Math.round(ix.reduce((a, v) => a + v[i], 0) / ix.length));
  },

  // Línea de tiempo de la señal: intensidad por semana (cambio contra la semana 1, escala log) y
  // semana en que empezó el alza de cada fuente. Muestra cuántas semanas antes de ventas apareció el interés.
  timeline(rid, rule = DB.data.rule) {
    const a = this.analyze(rid, rule);
    const rows = Object.keys(SOURCES).filter(k => a.s[k]).map(k => {
      const s = a.s[k], base = Math.max(s[0], 1), st = this.streak(s);
      return { k, s, heat: s.map(v => Math.max(0, Math.min(1, Math.log2(Math.max(v, 0.5) / base) / 3))), growing: a.grow.includes(k), start: a.grow.includes(k) ? 7 - st : null, g: this.growth(s) };
    });
    const starts = rows.filter(r => r.k !== 'pedidos' && r.start != null);
    const first = starts.length ? Math.min(...starts.map(r => r.start)) : null;
    return { rows, first, firstSrc: first != null ? starts.find(r => r.start === first).k : null, lead: first != null ? 7 - first : 0, ordersGrowth: a.ordersGrowth };
  },
  // Validación desde MAPPI: opiniones verificadas, guardados y perfiles que recomiendan
  validation(rid) {
    const d = DB.data, now = DB.nowMs();
    const revs = d.reviews.filter(x => x.restaurant_id === rid);
    const recent = revs.filter(x => now - Date.parse(x.created_at) < 56 * DAY);
    // Con solo "me gusta", la calidad se mide como la parte de los pedidos que recibe uno
    const orders = d.orders.filter(x => x.restaurant_id === rid && now - Date.parse(x.created_at) < 56 * DAY).length;
    const pct = arr => orders ? Math.min(100, Math.round(arr.length / orders * 100)) : null;
    const inc = recent.filter(x => x.rewarded), spont = recent.filter(x => !x.rewarded);
    const week = revs.filter(x => now - Date.parse(x.created_at) < 7 * DAY);
    const recommenders = [...new Set(recent.filter(x => x.answer === 'si').map(x => x.user_id))].map(id => DB.user(id)).filter(u => u && u.public);
    const f = this.funnel(rid);
    return { total: recent.length, week: week.length, pctSi: pct(recent), pctInc: pct(inc), pctSpont: pct(spont), inc: inc.length, spont: spont.length, recommenders, funnel: f };
  },
  funnel(rid) {
    const d = DB.data, now = DB.nowMs(), wk = x => now - Date.parse(x.created_at) < 7 * DAY;
    const days = d.mappi_funnel_daily.filter(x => x.restaurant_id === rid);
    const ev = t => d.events.filter(e => e.type === t && e.restaurant_id === rid).length;
    const sum = k => days.reduce((a, x) => a + x[k], 0);
    return {
      exp: sum('impressions') + ev('impression'),
      open: sum('profile_opens') + ev('open_restaurant'),
      save: new Set(d.saves.filter(x => x.restaurant_id === rid && wk(x)).map(x => x.user_id)).size,
      menu: sum('menu_opens') + ev('open_menu'),
      buy: new Set(d.orders.filter(x => x.restaurant_id === rid && x.source !== 'rappi' && wk(x)).map(x => x.user_id)).size,
      share: d.events.filter(e => e.type === 'share' && e.restaurant_id === rid).length,
    };
  },

  // Puntaje de oportunidad 0 a 100, siempre con su desglose. Curvas suaves para que un
  // solo indicador muy alto no sature el total; las penalizaciones se muestran aparte.
  score(rid, rule = DB.data.rule) {
    const a = this.analyze(rid, rule), v = this.validation(rid), clamp = (x, m) => Math.max(0, Math.min(m, x));
    const soft = (x, k) => 1 - Math.exp(-Math.max(0, x) / k);
    const s = a.s, mappiNow = s.mappi[7], mappiPrev = Math.max(1, s.mappi[4]);
    const accounts = a.crit.personas[0] ? Math.min(8, Math.log2(a.r.distinct_accounts + 1) * 1.6) : 0;
    const momentum = 8 * Math.min(1, mappiNow / 30) * (mappiNow / mappiPrev >= 1.5 ? 1 : 0.6);
    const late = a.ordersGrowth > rule.late_orders_growth;
    const parts = [
      { k: 'interes', l: 'Interés', max: 25, v: Math.round(25 * soft(a.gi, 350)), why: `Índice combinado ${a.gi >= 0 ? '+' : ''}${a.gi}% en 8 semanas` },
      { k: 'amplitud', l: 'Amplitud', max: 20, v: clamp(Math.round(a.grow.length / 5 * 12 + accounts), 20), why: `${a.grow.length} de 5 fuentes crecen; ${a.crit.personas[0] ? `${a.r.distinct_accounts} cuentas distintas` : 'concentrado en pocas cuentas'}` },
      { k: 'persistencia', l: 'Persistencia', max: 15, v: clamp(Math.round(a.streak / 7 * 15), 15), why: `${a.streak} semana${a.streak === 1 ? '' : 's'} seguidas al alza` },
      { k: 'mappi', l: 'Validación MAPPI', max: 20, v: clamp(Math.round(momentum + (v.pctSi != null ? v.pctSi / 100 * 8 : 0) + Math.min(4, v.funnel.buy / 3)), 20), why: `${mappiNow} guardados esta semana, ${v.pctSi ?? 0}% de los pedidos con me gusta, ${v.funnel.buy} compras` },
      { k: 'ventana', l: 'Ventana para actuar', max: 20, v: late ? 0 : Math.round(20 * soft(a.gi - a.ordersGrowth, 300)), why: late ? 'Los pedidos ya subieron: la ventana pasó' : `Interés ${a.gi >= 0 ? '+' : ''}${a.gi}% contra pedidos ${a.ordersGrowth >= 0 ? '+' : ''}${a.ordersGrowth}%` },
    ];
    const penalties = [];
    if (a.r.anti_signals.length) penalties.push({ l: `${a.r.anti_signals.length} antiseñal${a.r.anti_signals.length > 1 ? 'es' : ''} de operación`, v: Math.min(18, a.r.anti_signals.length * 6) });
    if (a.small) penalties.push({ l: 'Base pequeña', v: 8 });
    if (!a.hasExternal) penalties.push({ l: 'Sin fuente externa en la zona', v: 12 });
    if (!a.crit.perfil[0]) penalties.push({ l: 'Audiencia fuera del perfil', v: 10 });
    const penalty = penalties.reduce((x, p) => x + p.v, 0);
    const total = clamp(parts.reduce((x, p) => x + p.v, 0) - penalty, 100);
    const conf = !a.hasExternal || a.small ? 'Baja' : (a.r.distinct_accounts >= 20 && v.total >= 10 ? 'Alta' : 'Media');
    return { total, parts, penalties, penalty, conf, a, v };
  },
  _memo: {},
  board(rule = DB.data.rule) {
    const key = DB.rev + JSON.stringify(rule);
    if (this._memo.key === key) return this._memo.v;
    this._memo = { key, v: this._board(rule) };
    return this._memo.v;
  },
  _board(rule) {
    return DB.data.restaurants.map(r => this.score(r.id, rule)).sort((x, y) => {
      const o = { alerta: 0, obs: 1, cons: 2, none: 3 };
      return (o[x.a.estado] - o[y.a.estado]) || (y.total - x.total);
    });
  },

  // Afinidad entre dos personas: gustos, restaurantes en común, comuna y edad
  affinity(aId, bId) {
    const d = DB.data, A = DB.user(aId), B = DB.user(bId);
    const ta = new Set(A.tastes), tb = new Set(B.tastes), inter = [...ta].filter(x => tb.has(x));
    const ra = new Set(d.orders.filter(o => o.user_id === aId).map(o => o.restaurant_id));
    const rb = new Set(d.orders.filter(o => o.user_id === bId).map(o => o.restaurant_id));
    const both = [...ra].filter(x => rb.has(x));
    const overlap = inter.length / Math.max(1, Math.min(ta.size, tb.size));
    // Base 30 + gustos en común (40) + restaurantes en común (15) + misma comuna (8) + edad parecida (7)
    const pct = Math.round(30 + 40 * overlap + 15 * Math.min(1, both.length / 2) + (A.comuna === B.comuna ? 8 : 0) + (Math.abs(A.age - B.age) <= 5 ? 7 : 0));
    const reasons = [];
    if (inter.length) reasons.push(`Les gusta ${inter.slice(0, 2).join(' y ').toLowerCase()}`);
    if (both.length) reasons.push(`Ambos pidieron en ${DB.rest(both[0]).name}`);
    if (A.comuna === B.comuna) reasons.push(`Los dos piden en ${A.comuna}`);
    return { pct: Math.min(pct, 98), reasons, shared: inter };
  },
  // KPIs del piloto (lámina "¿Cómo sabremos si funciona?")
  kpis() {
    const d = DB.data, now = DB.nowMs(), in30 = x => now - Date.parse(x.created_at) < 30 * DAY;
    const actSet = new Set([...d.saves.filter(in30), ...d.orders.filter(o => o.source !== 'rappi' && in30(o)), ...d.reviews.filter(in30)].map(x => x.user_id));
    const recSet = new Set(d.reviews.filter(in30).map(x => x.user_id));
    const saveSet = new Set(d.saves.filter(in30).map(x => x.user_id));
    const followSet = new Set(d.follows.filter(in30).map(x => x.follower_id));
    const board = this.board();
    const distinctSignals = board.reduce((n, b) => n + b.a.grow.length, 0);
    const hist = d.alert_history, hit = hist.filter(h => h.outcome === 'accion');
    return {
      users: d.users.length, active: actSet.size, recommend: recSet.size, save: saveSet.size, follow: followSet.size,
      distinctSignals, alerts: board.filter(b => b.a.estado === 'alerta').length, obs: board.filter(b => b.a.estado === 'obs').length,
      precision: Math.round(hit.length / hist.length * 100), lead: (hit.reduce((a, h) => a + h.lead_weeks, 0) / hit.length).toFixed(1),
      decisions: d.decisions.length,
    };
  },
};

