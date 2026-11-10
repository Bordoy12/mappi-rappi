/* ================= Radar · panel del equipo Rappi =================
   Cruza señales externas (redes, reseñas) e internas (búsquedas, pedidos, MAPPI) para
   proponer aliados que merecen seguimiento. Radar propone; una persona decide y el
   resultado vuelve a calibrar la regla. */

const DECISIONS = [
  { o: 'Seguir observando', ic: 'eye', stage: 'evaluacion' },
  { o: 'Solicitar información', ic: 'question', stage: 'evaluacion' },
  { o: 'Contactar al aliado', ic: 'handshake', stage: 'contactado' },
  { o: 'Proponer acción comercial', ic: 'rocket-launch', stage: 'accion' },
  { o: 'Descartar por ahora', ic: 'x-circle', stage: 'descartado' },
];
const ACTIONS = { destacar: 'Destacar en MAPPI', cupon: 'Cupón de bienvenida', visita: 'Visita del KAM' };
const OWNERS = ['KAM Zona Oriente', 'KAM Zona Sur', 'KAM Zona Centro', 'Hunting', 'Analítica', 'Gestión de aliados'];
const STAGES = [['por_decidir', 'Por decidir'], ['evaluacion', 'En evaluación'], ['contactado', 'Contactado'], ['accion', 'Acción en curso'], ['medido', 'Resultado medido']];
const NEXT_STAGE = { evaluacion: 'contactado', contactado: 'accion', accion: 'medido' };
const RPAGES = [
  ['signals', 'Resumen'], ['cartera', 'Aliados'], ['zonas', 'Mapa de zonas'], ['seguimiento', 'Seguimiento'],
  ['piloto', 'Piloto y KPIs'], ['regla', 'Regla'], ['datos', 'Datos'], ['guia', 'Cómo leer el panel'],
];
const TABLE_INFO = {
  restaurants: 'Aliados con atributos de audiencia y concentración', dishes: 'Platos y precios', users: 'Personas (30 con perfil público)', follows: 'Quién sigue a quién (perfiles afines)',
  saves: 'Guardados "Quiero probar": fuente de la serie MAPPI', orders: 'Pedidos originados en MAPPI', reviews: 'Me gusta con compra verificada (sin comentarios)', external_content: 'Contenido de redes enlazado',
  signals_weekly: 'Series semanales externas e internas', mappi_funnel_daily: 'Exposición y aperturas por día', events: 'Registro de eventos de esta sesión', decisions: 'Decisiones del equipo',
  alert_history: 'Alertas cerradas (para medir precisión)', unmatched_searches: 'Búsquedas sin resultado', hypotheses: 'Hipótesis abiertas', zones: 'Comunas y cobertura externa',
  wallet_ledger: 'Movimientos de Monedas MAPPI', coupons: 'Beneficios canjeados', benefits: 'Catálogo de beneficios', signal_feed: 'Señales iniciales del feed', signal_ticker: 'Señales simuladas de ingesta',
};
const EVENT_DICT = {
  enter_mappi: ['Entró a MAPPI desde Rappi', 'Uso de MAPPI (KPI del piloto)', 'house'],
  impression: ['Restaurante mostrado en el mapa', 'Embudo: lo vieron', 'eye'],
  open_restaurant: ['Abrió la ficha', 'Embudo: abrieron la ficha', 'storefront'],
  open_profile: ['Abrió un perfil afín', 'Red de confianza', 'user'],
  view_story: ['Vio la historia de un perfil afín', 'Exposición por recomendación de personas', 'users-three'],
  follow: ['Siguió a un perfil afín', 'Red de confianza', 'user-plus'],
  unfollow: ['Dejó de seguir', 'Red de confianza', 'user'],
  save: ['Guardó para probar', 'Serie MAPPI (guardados)', 'bookmark-simple'],
  unsave: ['Quitó de guardados', 'Serie MAPPI (guardados)', 'bookmark-simple'],
  share: ['Compartió', 'Embudo: compartidos', 'share-network'],
  search: ['Buscó', 'Búsquedas en Rappi', 'magnifying-glass'],
  search_empty: ['Búsqueda sin resultado', 'Demanda sin oferta (Hunting)', 'question'],
  view_external: ['Vio contenido de redes', 'Interés externo confirmado', 'play'],
  open_menu: ['Abrió el menú', 'Embudo: abrieron el menú', 'receipt'],
  order: ['Pidió', 'Pedidos y embudo: compraron', 'shopping-bag'],
  receive: ['Recibió el pedido', 'Habilita el me gusta verificado', 'truck'],
  review: ['Dio me gusta con compra verificada', 'Validación MAPPI', 'heart'],
  review_edit: ['Repitió un me gusta', 'Validación MAPPI (sin monedas)', 'heart'],
  review_rejected: ['Intentó dar me gusta sin compra', 'Bloqueado: sin compra verificada', 'shield-check'],
  skip_review: ['No dio me gusta', 'Tasa de respuesta', 'clock'],
  redeem: ['Canjeó monedas', 'Costo del incentivo', 'ticket'],
  redeem_fail: ['El canje falló', 'Saldo sin cambios', 'warning'],
  radar_open: ['Radar abrió la ficha del aliado', 'Uso de Radar', 'presentation-chart'],
  decision: ['Decisión registrada', 'Seguimiento', 'flag'],
  stage: ['Etapa de seguimiento actualizada', 'Seguimiento', 'kanban'],
  rule_change: ['Regla de alerta actualizada', 'Calibración', 'sliders-horizontal'],
  profile_public: ['Cambió la visibilidad de su perfil', 'Red de confianza', 'user-circle'],
  profile_taste: ['Actualizó sus gustos', 'Afinidad entre perfiles', 'user-circle'],
};
const decisionFor = id => Q.decisionFor(id);
const scoreCell = t => `<span class="score"><span>${t}</span><span class="meter" aria-hidden="true"><i style="width:${t}%"></i></span></span>`;
const stateTag = e => `<span class="tag ${ESTADO[e][1]}">${ESTADO[e][0]}</span>`;

/* ---------- Estructura del panel: pantalla de oficina, barra superior y pestañas ---------- */
function renderRadar() {
  const r = S.r, alerts = Engine.board().filter(b => b.a.estado === 'alerta').length;
  const page = r.open ? radarDetail(r.open) : ({ signals: radarSignals, cartera: radarCartera, zonas: radarZonas, seguimiento: radarSeguimiento, regla: radarRegla, piloto: radarPiloto, datos: radarDatos, guia: radarGuia }[r.page])();
  return `<div class="rd-screen">
    <header class="rd-top">
      <div class="rd-brand">Rappi <span>Radar · Hunting Santiago</span></div>
      <span class="rd-live"><i></i>Datos de hoy · actualizado <b class="mono" id="feed-upd">${clockS()}</b></span>
      <button class="rd-ghost" data-a="exportCartera">${icon('download-simple')}Exportar</button>
      <span class="rd-user" title="Equipo de Hunting">HS</span>
    </header>
    <nav class="rd-nav" aria-label="Secciones de Radar"><div class="rd-pills">
      ${RPAGES.map(([k, l]) => `<button class="rd-pill" data-a="rpage" data-v="${k}" aria-current="${r.page === k && !r.open}">${l}${k === 'signals' && alerts ? `<em>${alerts}</em>` : k === 'seguimiento' && DB.data.decisions.length ? `<em>${DB.data.decisions.length}</em>` : ''}</button>`).join('')}
    </div></nav>
    <div class="rd-scroll" id="rd-scroll"><div class="rmain ${r._anim ? 'fade-in' : ''}">${page}</div></div>
  </div>`;
}

/* ---------- Radar polar: anillo = estado, cercanía al centro = puntaje, sentido horario = orden ---------- */
function radarPlot(board, top = []) {
  const rank = Object.fromEntries(top.map((b, i) => [b.a.r.id, i + 1]));
  const C = 200, bands = { alerta: [24, 74], obs: [86, 136], rest: [148, 190] };
  const groups = { alerta: board.filter(b => b.a.estado === 'alerta'), obs: board.filter(b => b.a.estado === 'obs'), rest: board.filter(b => b.a.estado === 'cons' || b.a.estado === 'none') };
  const blips = [];
  Object.entries(groups).forEach(([g, list], gi) => [...list].sort((x, y) => y.total - x.total).forEach((b, i, arr) => {
    const ang = (-90 + 360 / arr.length * i + gi * 19) * Math.PI / 180, [r0, r1] = bands[g], r = r0 + (1 - b.total / 100) * (r1 - r0);
    blips.push({ b, g, x: C + r * Math.cos(ang), y: C + r * Math.sin(ang) });
  }));
  const wedge = `M${C},${C} L${C},${C - 192} A192,192 0 0,1 ${(C + 192 * Math.sin(Math.PI / 4.5)).toFixed(1)},${(C - 192 * Math.cos(Math.PI / 4.5)).toFixed(1)} Z`;
  return `<svg class="radar-svg" viewBox="-62 -6 524 412" role="group" aria-label="Radar de aliados: ${groups.alerta.length} para revisión, ${groups.obs.length} en observación">
    <defs><radialGradient id="rg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#DE3410" stop-opacity=".10"/><stop offset="1" stop-color="#DE3410" stop-opacity="0"/></radialGradient></defs>
    <circle cx="${C}" cy="${C}" r="192" fill="url(#rg)"/>
    ${[80, 142, 192].map(r => `<circle cx="${C}" cy="${C}" r="${r}" class="ring"/>`).join('')}
    ${[0, 60, 120].map(a => `<line x1="${C + 192 * Math.cos(a * Math.PI / 180)}" y1="${C + 192 * Math.sin(a * Math.PI / 180)}" x2="${C - 192 * Math.cos(a * Math.PI / 180)}" y2="${C - 192 * Math.sin(a * Math.PI / 180)}" class="spoke"/>`).join('')}
    <g class="sweep"><path d="${wedge}" class="wedge"/><line x1="${C}" y1="${C}" x2="${C}" y2="${C - 192}" class="beam"/></g>
    ${[['Para revisión', 80], ['En observación', 142], ['Sin señales', 192]].map(([l, r]) => `<text x="${C + 4}" y="${C - r + 13}" class="band-l">${l}</text>`).join('')}
    ${blips.map(({ b, g, x, y }) => `<g class="blip b-${g}" data-a="ropen" data-r="${b.a.r.id}" tabindex="0" role="button" aria-label="${esc(b.a.r.name)}, ${ESTADO[b.a.estado][0]}, puntaje ${b.total}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})">
      <title>${esc(b.a.r.name)}: ${b.total} pts, ${ESTADO[b.a.estado][0]}</title>${g === 'alerta' ? '<circle r="15" class="halo"/>' : ''}<circle r="${rank[b.a.r.id] ? 9.5 : g === 'obs' ? 5.5 : 3.6}" class="dot"/>
      ${rank[b.a.r.id] ? `<text y="3.6" text-anchor="middle" class="num-l">${rank[b.a.r.id]}</text>` : g === 'obs' ? `<text x="${x >= C ? 9 : -9}" y="4" text-anchor="${x >= C ? 'start' : 'end'}" class="lbl">${esc(b.a.r.name)}</text>` : ''}</g>`).join('')}
    <circle cx="${C}" cy="${C}" r="3" class="center"/>
  </svg>`;
}

/* ---------- Señales ---------- */
function feedHTML() {
  const feed = DB.data.session.radarFeed.slice(0, 18);
  if (!feed.length) return `<div class="empty">${icon('broadcast')}<b>Sin señales todavía</b>Las señales aparecen aquí apenas llegan.</div>`;
  return feed.map(f => {
    const rs = f.restaurant_id && DB.rest(f.restaurant_id);
    const cd = f.change ? f.change.to - f.change.from : 0;
    const d = typeof f.delta === 'number' ? (f.delta ? `${f.delta > 0 ? '+' : ''}${f.delta} pts` : cd ? `${cd > 0 ? '+' : ''}${cd}` : 'Nuevo') : f.delta;
    return `<div class="sig ${f.mappi ? 'mappi' : ''} ${f.fresh ? 'enter' : ''}">
      <div class="sig-top"><div><div style="font-weight:650;font-size:14px">${rs ? esc(rs.name) : esc(f.title || 'MAPPI')}</div><div class="fine">${rs ? `${esc(rs.cat)}, ${esc(rs.comuna)}` : 'Sin aliado asociado'}</div></div><div class="sig-pct ${f.neg ? 'delta-dn' : 'delta-up'}">${esc(d)}</div></div>
      <div style="font-size:13px">${esc(f.text)}</div>
      ${f.change ? `<div class="fine">${esc(changeTxt(f.change))}</div>` : ''}
      ${f.estadoChange ? `<div class="notice info" style="padding:6px 9px;font-size:12px">${icon('lightning')}<span>Cambió de "${ESTADO[f.estadoChange[0]][0]}" a "${ESTADO[f.estadoChange[1]][0]}"</span></div>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap"><span class="tag ${f.mappi ? 't-good' : 't-acc'}">${f.mappi ? 'Desde MAPPI' : 'Señal externa'}</span><span class="tag t-mut">${esc(f.source)}</span></div>
      <div style="display:flex;justify-content:space-between;align-items:center"><span class="fine mono">${clock(Date.parse(f.ts))}</span>${rs ? `<button class="sig-btn" data-a="ropen" data-r="${rs.id}">Analizar aliado</button>` : ''}</div></div>`;
  }).join('');
}
/* ---------- Resumen (portada del panel) ---------- */
// Mini gráfico de línea para las tarjetas
function spark(vals, color = 'var(--accent)') {
  const w = 200, h = 26, mx = Math.max(...vals, 1), mn = Math.min(...vals, 0);
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * w).toFixed(1)},${(h - (v - mn) / ((mx - mn) || 1) * (h - 4) - 2).toFixed(1)}`).join(' ');
  return `<svg class="odk-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
}
// Definiciones que abre la "i" de cada tarjeta
const KPI_DEFS = {
  alerta: 'Aliados que cumplen las <b>4 condiciones</b> de la regla: perfil objetivo, distintas personas, se repite y se sostiene. Son los que conviene revisar primero.',
  senales: 'Cambios detectados hoy en <b>5 fuentes</b>: TikTok, reseñas de Google, Instagram, búsquedas en Rappi y MAPPI. Cada señal se suma al aliado que corresponde.',
  likes: 'Me gusta que dieron personas que <b>compraron y recibieron</b> el plato. No hay comentarios: es una señal limpia y verificada.',
  anticipa: 'Semanas promedio entre la primera señal y el alza en pedidos, en alertas pasadas que terminaron en <b>acción justificada</b>.',
  zona: 'Comuna con más aliados en revisión y mayor puntaje. Sirve para decidir dónde enfocar al equipo esta semana.',
  demanda: 'Búsquedas en Rappi que <b>no encontraron resultado</b> en 7 días. Muestran lo que la gente quiere y todavía no está en la app.',
};
function odk(k, { cls = '', title, value, valueCls = '', sub, link, linkA, extra = '' }) {
  const open = S.r.def === k;
  return `<div class="odk ${cls} ${open ? 'def-open' : ''}">
    <div class="odk-h"><span>${title}</span><button class="odk-i" data-a="rdef" data-v="${k}" aria-expanded="${open}" aria-label="Qué significa ${esc(title)}">i</button></div>
    <span class="odk-v ${valueCls}">${value}</span>
    <p class="odk-s">${sub}</p>${extra}
    <button class="odk-a" ${linkA}>${link} ›</button>
    ${open ? `<div class="odk-d" role="note">${KPI_DEFS[k]}<br><button class="odk-gl" data-a="rpage" data-v="guia">Ver glosario</button></div>` : ''}
  </div>`;
}
function radarSignals() {
  const r = S.r, board = Engine.board(), feed = DB.data.session.radarFeed, k = Engine.kpis(), d = DB.data, now = DB.nowMs();
  const top = board.filter(b => b.a.estado === 'alerta' || b.a.estado === 'obs').slice(0, 6);
  const cc = Engine.analyze(r.chartId), gi = cc.gi, gp = cc.ordersGrowth;
  const ins = gp > 100 ? 'Los pedidos ya acompañan al interés: el crecimiento es visible en ventas.' : (gi - gp > 50 ? 'Hay una brecha entre interés y ventas: es la ventana para actuar antes que la competencia.' : 'No hay una brecha clara entre interés y ventas.');
  const um = [...d.unmatched_searches].sort((a, b) => b.count_7d - a.count_7d);
  // Series semanales para los mini gráficos
  const sigWeeks = [...Array(8)].map((_, i) => d.signals_weekly.filter(s => s.kind === 'externa').reduce((a, s) => a + (s.values[i] || 0), 0));
  const likeWeeks = [...Array(8)].map((_, i) => d.reviews.filter(x => { const age = Math.floor((now - Date.parse(x.created_at)) / (7 * DAY)); return 7 - age === i; }).length);
  const likes7 = likeWeeks[7], likesPrev = likeWeeks[6] || 1;
  const sigToday = 23 + feed.length - 6;
  const zoneScore = d.zones.map(z => { const bs = board.filter(b => b.a.r.zone === z.id); return { z, al: bs.filter(b => b.a.estado === 'alerta').length, mx: bs.length ? Math.max(...bs.map(b => b.total)) : 0, n: bs.length }; }).sort((a, b) => b.al - a.al || b.mx - a.mx);
  const hot = zoneScore[0];
  const gUp = (a, b) => { const g = Math.round((a - b) / Math.max(1, b) * 100); return `<span class="${g >= 0 ? 'up' : 'dn'}">${g >= 0 ? '▲' : '▼'} ${Math.abs(g)}%</span>`; };
  const lead = top[0], best = lead && [...lead.parts].sort((x, y) => y.v / y.max - x.v / x.max)[0];
  return `
    <section class="od-sec" id="sec-resumen">
      <div class="od-sh"><div><h2>Resumen de hoy</h2><p>Aliados que ya están en Rappi y cuyo interés crece antes de notarse en pedidos. Toca la <b>i</b> de cada tarjeta para ver qué significa.</p></div>
        <button class="od-link" data-a="rpage" data-v="guia">¿Cómo leer este panel?</button></div>
      <div class="od-kpis">
        ${odk('alerta', { cls: 'hl', title: 'Para revisión', value: k.alerts, sub: `cumplen las 4 condiciones · ${k.obs} más en observación`, link: 'Ver aliados', linkA: 'data-a="rfilter" data-v="alerta"' })}
        ${odk('senales', { title: 'Señales hoy', value: `<span id="kpi-sig">${sigToday}</span>`, sub: `${gUp(sigWeeks[7], sigWeeks[6])} vs semana pasada · 5 fuentes`, extra: spark(sigWeeks), link: 'Ver señales en vivo', linkA: 'data-a="rscroll" data-v="sec-vivo"' })}
        ${odk('likes', { title: 'Me gusta verificados (7 días)', value: likes7, sub: `${gUp(likes7, likesPrev)} vs semana pasada · solo compras reales`, extra: spark(likeWeeks, '#1F9D55'), link: 'Ver piloto', linkA: 'data-a="rpage" data-v="piloto"' })}
        ${odk('anticipa', { title: 'Anticipación promedio', value: `${k.lead.replace('.', ',')} sem`, sub: `antes del alza en pedidos · precisión ${k.precision}%`, link: 'Ver seguimiento', linkA: 'data-a="rpage" data-v="seguimiento"' })}
        ${odk('zona', { title: 'Zona más caliente', value: esc(hot.z.name), valueCls: 'odk-t', sub: `${plural(hot.al, 'aliado para revisión', 'aliados para revisión')} · puntaje máximo ${hot.mx}`, link: 'Ver zona', linkA: `data-a="rzone" data-v="${hot.z.id}"` })}
        ${odk('demanda', { cls: 'cold', title: 'Demanda sin oferta', value: um.reduce((a, u) => a + u.count_7d, 0), sub: `búsquedas sin resultado · la más buscada: "${esc(um[0].query)}"`, link: 'Ver búsquedas', linkA: 'data-a="rscroll" data-v="sec-demanda"' })}
      </div>
      <div class="od-insights">
        ${lead ? `<div class="od-ins"><i style="background:var(--accent)"></i><span><b>${esc(lead.a.r.name)}</b> lidera con ${lead.total} puntos: ${esc(best.why.charAt(0).toLowerCase() + best.why.slice(1))}.</span></div>` : ''}
        <div class="od-ins"><i style="background:#1F9D55"></i><span>Los me gusta verificados ${likes7 >= likesPrev ? 'subieron' : 'bajaron'} esta semana: ${likes7} contra ${likeWeeks[6]}.</span></div>
        <div class="od-ins"><i style="background:var(--blue)"></i><span>"${esc(um[0].query)}" se buscó ${um[0].count_7d} veces en ${esc(um[0].comuna)} sin encontrar resultado.</span></div>
      </div>
    </section>

    <section class="od-sec" id="sec-prioridad">
      <div class="od-sh"><div><h2>Prioridad de hoy</h2><p>Ordenada por puntaje de oportunidad. Radar propone; una persona decide.</p></div><button class="od-link" data-a="rpage" data-v="cartera">Ver todos los aliados</button></div>
      <div class="od-cards2">
        <div class="od-card"><div class="od-ch"><div><h3>Aliados a mirar</h3><p>Puntaje de 0 a 100 y el motivo principal</p></div></div>
          ${top.map((b, i) => { const bw = [...b.parts].sort((x, y) => y.v / y.max - x.v / x.max)[0], dec = decisionFor(b.a.r.id); return `<button class="prio-row" data-a="ropen" data-r="${b.a.r.id}">
            <span class="rk">${i + 1}</span>${thumb(b.a.r)}<span class="tx"><b>${esc(b.a.r.name)}</b><span>${esc(bw.why)}</span></span>
            <span class="end">${scoreCell(b.total)}${dec ? `<span class="tag t-vio">${esc(dec.option)}</span>` : stateTag(b.a.estado)}</span></button>`; }).join('')}</div>
        <div class="od-card feedcard" id="sec-vivo"><div class="od-ch"><div><h3><span class="pulse"></span>Señales en tiempo real</h3><p><b class="mono" id="feed-count">${feed.length}</b> en esta sesión</p></div></div>
          <div class="feed" id="feed" tabindex="0" role="region" aria-label="Señales recientes">${feedHTML()}</div></div>
      </div>
    </section>

    <section class="od-sec" id="sec-tendencia">
      <div class="od-sh"><div><h2>Interés vs. pedidos</h2><p>Índice de 5 fuentes (promedio del período = 100) contra pedidos reales. Cuando el interés sube y los pedidos no, está la ventana para actuar.</p></div></div>
      <div class="od-card">
        <div class="od-ch"><div class="legend"><span><i style="background:var(--accent)"></i>Interés combinado</span><span><i class="dash"></i>Pedidos</span></div>
          <select data-f="chartId" aria-label="Aliado del gráfico" style="width:auto">${board.map(b => `<option value="${b.a.r.id}" ${b.a.r.id === r.chartId ? 'selected' : ''}>${esc(b.a.r.name)}</option>`).join('')}</select></div>
        <div class="chart-wrap"><canvas id="mainChart" aria-label="Gráfico de interés y pedidos de ${esc(cc.r.name)}"></canvas></div>
        <div class="insight">${icon('lightning')}<span>En 8 semanas el interés por <b>${esc(cc.r.name)}</b> cambió <b>${pct(gi)}</b> y los pedidos <b>${pct(gp)}</b>. ${ins}</span></div>
      </div>
    </section>

    <section class="od-sec" id="sec-demanda">
      <div class="od-sh"><div><h2>Cartera y demanda</h2><p>Dónde está cada aliado según su estado, y qué busca la gente sin encontrarlo.</p></div></div>
      <div class="od-cards2">
        <div class="od-card"><div class="od-ch"><div><h3>Radar de la cartera</h3><p>Más cerca del centro, mayor puntaje. Toca un punto para ver la evidencia.</p></div></div>${radarPlot(board, top)}</div>
        <div class="od-card"><div class="od-ch"><div><h3>Demanda sin oferta</h3><p>Búsquedas sin resultado, últimos 7 días</p></div></div>
          ${um.slice(0, 6).map(u => { const mx = um[0].count_7d; return `<div class="dem-row"><div class="fun-top"><span>"${esc(u.query)}" <em>${esc(u.comuna)}</em></span><span class="mono">${u.count_7d} <span class="${u.count_7d > u.count_prev ? 'delta-up' : 'muted'}" style="font-size:12px">${u.count_prev ? pct(Math.round((u.count_7d - u.count_prev) / u.count_prev * 100)) : 'nueva'}</span></span></div><span class="fun-bar"><i style="width:${u.count_7d / mx * 100}%;background:var(--blue)"></i></span></div>`; }).join('')}</div>
      </div>
      <p class="od-end">Fin del resumen · <button data-a="rscroll" data-v="sec-resumen">volver al inicio</button></p>
    </section>`;
}

/* ---------- Cómo leer el panel ---------- */
function radarGuia() {
  const g = [
    ['Para revisión', 'Aliado que cumple las 4 condiciones de la regla. Es una propuesta: una persona decide si se actúa.'],
    ['En observación', 'Alguna fuente subió 2 semanas seguidas, pero todavía no cumple todo. Se mira, no se actúa.'],
    ['Puntaje de oportunidad', 'De 0 a 100. Suma interés, amplitud, persistencia, validación MAPPI y ventana para actuar, y resta antiseñales.'],
    ['Interés combinado', 'Índice que junta 5 fuentes. 100 es el promedio del período; sobre 100, el interés está creciendo.'],
    ['Ventana para actuar', 'Cuánto subió el interés comparado con los pedidos. Si los pedidos ya subieron, la ventana pasó.'],
    ['Me gusta verificados', 'Un toque que da quien compró y recibió el plato. Sin comentarios, para cuidar a las marcas y mantener la señal limpia.'],
    ['Antiseñales', 'Problemas de operación (demoras, quiebres, reclamos) que restan puntaje aunque el interés crezca.'],
    ['Demanda sin oferta', 'Búsquedas en Rappi sin resultado. Pistas de lo que falta en la app.'],
  ];
  const srcs = [['tiktok-logo', 'TikTok: videos y menciones', 'Externa'], ['google-logo', 'Reseñas de Google', 'Externa'], ['instagram-logo', 'Instagram: menciones', 'Externa'], ['magnifying-glass', 'Búsquedas y visitas a menús', 'Interna'], ['heart', 'MAPPI: guardados y me gusta verificados', 'Interna']];
  return `<section class="od-sec"><div class="od-sh"><div><h2>¿Cómo leer el panel?</h2><p>Las palabras que más se usan, explicadas sin jerga.</p></div></div>
    <div class="od-gloss">${g.map(([t, p]) => `<div class="od-g"><h4>${t}</h4><p>${p}</p></div>`).join('')}</div></section>
    <section class="od-sec"><div class="od-sh"><div><h2>Fuentes</h2><p>De dónde vienen las señales. Ninguna alerta sale de una sola fuente.</p></div></div>
      <div class="od-mix-list">${srcs.map(([ic, l, t]) => `<div class="od-src"><span class="od-src-t">${icon(ic)}${t}</span><small>${l}</small></div>`).join('')}</div></section>
    <section class="od-sec"><div class="od-sh"><div><h2>Hipótesis abiertas</h2><p>Lo que el equipo está evaluando con estas señales.</p></div></div>
      <div class="od-card">${DB.data.hypotheses.map(h => `<button class="src" style="width:100%;text-align:left" data-a="ropen" data-r="${h.restaurant_id}"><span><b style="font-size:13.5px">${esc(h.title)}</b><div class="fine">${esc(h.text)}</div></span><span class="tag ${h.status === 'Para revisión' ? 't-acc' : h.status === 'En evaluación' ? 't-vio' : 't-mut'}">${esc(h.status)}</span></button>`).join('')}</div>
      <p class="od-end">Fin del panel · <button data-a="rpage" data-v="signals">volver al resumen</button></p></section>`;
}

/* ---------- Cartera ---------- */
function radarCartera() {
  const r = S.r, board = Engine.board();
  const comunas = [...new Set(DB.data.restaurants.map(x => x.comuna))].sort(), cats = [...new Set(DB.data.restaurants.map(x => x.cat))].sort();
  let rows = board.filter(b => (!r.fc || b.a.r.comuna === r.fc) && (!r.fk || b.a.r.cat === r.fk) && (!r.fe || b.a.estado === r.fe) && (!r.fq || M.norm(b.a.r.name).includes(M.norm(r.fq))));
  if (r.sort === 'score') rows.sort((a, b) => b.total - a.total);
  if (r.sort === 'name') rows.sort((a, b) => a.a.r.name.localeCompare(b.a.r.name));
  if (r.sort === 'orders') rows.sort((a, b) => b.a.ordersGrowth - a.a.ordersGrowth);
  const sortBtn = (k, l) => `<button data-a="rsort" data-v="${k}" aria-pressed="${r.sort === k}">${l}${r.sort === k ? icon('caret-down') : ''}</button>`;
  return `<div class="rhead"><div><h1>Cartera de aliados</h1><p>Todos los aliados con su estado según la regla vigente y su puntaje de oportunidad. Haz clic en una fila para ver la evidencia.</p></div>
      <button class="btn btn-line btn-sm" data-a="exportCartera">${icon('download-simple')}Exportar CSV</button></div>
    <div class="filters">
      <input type="search" data-f="fq" value="${esc(r.fq)}" placeholder="Buscar aliado" aria-label="Buscar aliado">
      <select data-f="fc" aria-label="Comuna"><option value="">Todas las comunas</option>${comunas.map(c => `<option ${r.fc === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <select data-f="fk" aria-label="Categoría"><option value="">Todas las categorías</option>${cats.map(c => `<option ${r.fk === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <select data-f="fe" aria-label="Estado"><option value="">Todos los estados</option>${Object.entries(ESTADO).map(([k, v]) => `<option value="${k}" ${r.fe === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select>
      ${(r.fc || r.fk || r.fe || r.fq) ? `<button class="btn btn-soft btn-sm" data-a="rclear">Limpiar filtros</button>` : ''}
      <span class="fine" style="margin-left:auto">${plural(rows.length, 'aliado', 'aliados')}</span></div>
    <div class="tbl-wrap"><table><thead><tr><th>${sortBtn('name', 'Aliado')}</th><th>${sortBtn('score', 'Puntaje')}</th><th>Estado</th><th>Fuentes creciendo</th><th>Condiciones</th><th>${sortBtn('orders', 'Pedidos 8 sem.')}</th><th>Decisión</th></tr></thead><tbody>
      ${rows.map(b => { const a = b.a, crit = Object.values(a.crit), dec = decisionFor(a.r.id);
        return `<tr class="click" data-a="ropen" data-r="${a.r.id}" tabindex="0"><td><div class="rest-cell">${thumb(a.r)}<div><b>${esc(a.r.name)}</b><div class="fine">${esc(a.r.cat)}, ${esc(a.r.comuna)}</div></div></div></td>
        <td>${scoreCell(b.total)}<div class="fine">Confianza ${b.conf.toLowerCase()}</div></td>
        <td><div style="display:flex;gap:4px;flex-wrap:wrap">${stateTag(a.estado)}${a.flags.map(f => `<span class="tag t-mut">${f}</span>`).join('')}</div></td>
        <td><div class="mini-src">${a.grow.length ? a.grow.map(k => `<span class="tag ${SOURCES[k].ty === 'Externa' ? 't-acc' : 't-good'}">${SOURCES[k].short}</span>`).join('') : '<span class="fine">Ninguna</span>'}</div></td>
        <td><div class="crit-dots" aria-label="${a.ok} de 4 condiciones">${crit.map(x => `<i class="${x[0] ? 'on' : ''}"></i>`).join('')}</div><span class="fine mono">${a.ok}/4</span></td>
        <td class="mono" style="color:${a.ordersGrowth > 50 ? 'var(--accent)' : 'var(--fg)'}">${pct(a.ordersGrowth)}</td>
        <td>${dec ? `<span class="tag t-vio">${esc(dec.option)}</span>` : '<span class="fine">Sin decisión</span>'}</td></tr>`; }).join('')}
      ${rows.length ? '' : `<tr><td colspan="7"><div class="empty">${icon('funnel')}<b>Sin aliados con estos filtros</b>Cambia la comuna, la categoría o el estado.</div></td></tr>`}
    </tbody></table></div>`;
}

/* ---------- Zonas ---------- */
function radarZonas() {
  const r = S.r, board = Engine.board();
  const byZone = Object.fromEntries(DB.data.zones.map(z => [z.id, board.filter(b => b.a.r.zone === z.id)]));
  const color = s => s == null ? 'var(--surface)' : `color-mix(in srgb, var(--accent) ${Math.round(8 + s * 0.62)}%, var(--surface))`;
  const sel = r.zone && DB.ix.zone[r.zone];
  const list = sel ? byZone[sel.id] : [];
  const rows = 5, cells = [];
  for (let y = 0; y < rows; y++) for (let x = 1; x <= 6; x++) {
    const z = DB.data.zones.find(q => q.col === x && q.row === y);
    if (!z) { cells.push('<div aria-hidden="true"></div>'); continue; }
    const bs = byZone[z.id], mx = bs.length ? Math.max(...bs.map(b => b.total)) : null, al = bs.filter(b => b.a.estado === 'alerta').length, ob = bs.filter(b => b.a.estado === 'obs').length;
    cells.push(`<button class="zone ${z.ext ? '' : 'noext'} ${r.zone === z.id ? 'sel' : ''}" style="background-color:${color(mx)}" data-a="zone" data-v="${z.id}" aria-label="${esc(z.name)}: ${bs.length} aliados, ${al} para revisión"><b>${esc(z.name)}</b><span><span class="zs">${mx ?? '-'}</span><div class="zc">${bs.length ? `${al ? `${al} revisión` : ''}${al && ob ? ', ' : ''}${ob ? `${ob} obs.` : ''}${!al && !ob ? `${plural(bs.length, 'aliado', 'aliados')}` : ''}` : 'Sin aliados'}</div></span></button>`);
  }
  return `<div class="rhead"><div><h1>Mapa de zonas</h1><p>Pulso por comuna: el color muestra el puntaje más alto de la zona. Las zonas rayadas no tienen fuente externa, así que solo pueden quedar en observación.</p></div></div>
    <div class="panel"><div class="carto">${cells.join('')}</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:12px"><span class="zlegend"><i style="background:${color(10)}"></i>Bajo</span><span class="zlegend"><i style="background:${color(50)}"></i>Medio</span><span class="zlegend"><i style="background:${color(90)}"></i>Alto</span><span class="zlegend"><i class="zone noext" style="aspect-ratio:auto;padding:0;border-radius:3px"></i>Sin fuente externa</span></div></div>
    ${sel ? `<div class="panel fade-in"><h3>${icon('map-pin')}${esc(sel.name)} <span class="tag t-mut">${esc(sel.area)}</span>${sel.ext ? '' : '<span class="tag t-warn">Sin fuente externa</span>'}</h3>
      ${list.length ? list.map(b => `<button class="src" style="width:100%;text-align:left" data-a="ropen" data-r="${b.a.r.id}"><span class="rest-cell">${thumb(b.a.r)}<span><b>${esc(b.a.r.name)}</b><div class="fine">${esc(b.a.r.cat)}</div></span></span><span style="display:flex;gap:10px;align-items:center">${stateTag(b.a.estado)}${scoreCell(b.total)}</span></button>`).join('')
        : `<div class="empty">${icon('storefront')}<b>Sin aliados monitoreados en ${esc(sel.name)}</b>Las búsquedas sin resultado de esta zona pueden mostrar qué falta.</div>`}</div>`
      : `<div class="notice info">${icon('info')}<span>Elige una comuna para ver sus aliados.</span></div>`}`;
}

/* ---------- Seguimiento ---------- */
function radarSeguimiento() {
  const ds = DB.data.decisions, board = Engine.board();
  const pend = board.filter(b => b.a.estado === 'alerta' && !decisionFor(b.a.r.id));
  const col = st => st === 'por_decidir' ? pend.map(b => `<button class="kcard" data-a="ropen" data-r="${b.a.r.id}"><b>${esc(b.a.r.name)}</b><span class="meta">${esc(b.a.r.comuna)}, puntaje ${b.total}</span><span class="tag t-acc" style="justify-self:start">Decidir</span></button>`).join('')
    : ds.filter(d => d.stage === st).map(d => { const rs = DB.rest(d.restaurant_id), since = DB.data.orders.filter(o => o.restaurant_id === d.restaurant_id && o.session && Date.parse(o.created_at) >= Date.parse(d.ts || d.date)).length;
      return `<div class="kcard"><b>${esc(rs.name)}</b><span class="tag t-vio" style="justify-self:start">${esc(d.option)}${d.action ? `: ${ACTIONS[d.action]}` : ''}</span><span class="meta">${esc(d.owner)}, ${dayLabel(d.ts || d.date)}</span><span>${esc(d.next || 'Sin próximo paso')}</span>
        ${d.action === 'destacar' ? `<span class="meta">${plural(since, 'pedido', 'pedidos')} desde que se destacó</span>` : ''}${d.result ? `<span class="tag t-good" style="justify-self:start">${esc(d.result)}</span>` : ''}
        <div class="acts"><button class="btn btn-soft btn-sm" data-a="ropen" data-r="${rs.id}">Ver</button>${NEXT_STAGE[st] ? `<button class="btn btn-line btn-sm" data-a="advance" data-d="${d.id}">Mover ${icon('arrow-right')}</button>` : ''}</div></div>`; }).join('');
  const discarded = ds.filter(d => d.stage === 'descartado');
  return `<div class="rhead"><div><h1>Seguimiento</h1><p>Cada decisión guarda responsable, fecha, motivo y próximo paso. Los resultados medidos vuelven a calibrar la regla de Radar.</p></div>
      <button class="btn btn-line btn-sm" data-a="exportDecisions">${icon('download-simple')}Exportar CSV</button></div>
    <div class="kanban">${STAGES.map(([k, l]) => { const n = k === 'por_decidir' ? pend.length : ds.filter(d => d.stage === k).length; return `<div class="kcol"><h4>${l}<span>${n}</span></h4>${col(k) || `<p class="fine" style="padding:4px">Nada aquí todavía.</p>`}</div>`; }).join('')}</div>
    ${discarded.length ? `<div class="panel"><h3>Descartados por ahora</h3>${discarded.map(d => `<div class="src"><span><b>${esc(DB.rest(d.restaurant_id).name)}</b> <span class="fine">${esc(d.why)}</span></span><span class="fine">${esc(d.owner)}</span></div>`).join('')}</div>` : ''}
    <div class="panel"><h3>${icon('target')}Cómo se mide si Radar sirve</h3><ul class="bul"><li>Aliados detectados que Rappi no tenía identificados antes.</li><li>Semanas de anticipación entre la primera señal y el alza en pedidos.</li><li>Alertas que terminan en seguimiento o acción justificada (precisión).</li><li>Evolución de los aliados sobre los que se actuó, contra un grupo comparable.</li></ul></div>`;
}

/* ---------- Regla y calibración ---------- */
const RULE_FIELDS = [
  ['min_growth', 'Crecimiento mínimo en el período', 10, 60, 5, '%'], ['min_rising_weeks', 'Semanas seguidas para "crecer"', 1, 4, 1, ''],
  ['sustain_weeks', 'Semanas para "se sostiene"', 2, 7, 1, ''], ['min_sources', 'Fuentes creciendo para "se repite"', 1, 5, 1, ''],
  ['max_top_share', 'Máximo aporte de una sola cuenta', 20, 80, 5, '%'], ['min_audience', 'Audiencia mínima de 18 a 34 años', 30, 80, 5, '%'],
];
function radarRegla() {
  const r = S.r, cur = DB.data.rule, draft = r.ruleDraft || { ...cur };
  const now = Engine.board(cur), next = Engine.board(draft);
  const changes = next.map(b => ({ b, prev: now.find(x => x.a.r.id === b.a.r.id) })).filter(x => x.prev.a.estado !== x.b.a.estado);
  const dirty = JSON.stringify(draft) !== JSON.stringify(cur);
  const h = DB.data.alert_history, k = Engine.kpis();
  const outLbl = { accion: ['Acción justificada', 't-good'], falsa: ['Falsa alarma', 't-bad'], descartada: ['Descartada', 't-mut'] };
  return `<div class="rhead"><div><h1>Regla y calibración</h1><p>La regla es una propuesta del equipo, sin calibrar con datos reales. Mueve los umbrales y mira qué aliados cambian de estado antes de aplicarla.</p></div></div>
    <div class="panel"><h3>${icon('sliders-horizontal')}Umbrales</h3>
      <div class="sliders">${RULE_FIELDS.map(([key, l, mn, mx, st, u]) => `<label class="slider"><span class="row"><span>${l}</span><b>${draft[key]}${u}</b></span><input type="range" min="${mn}" max="${mx}" step="${st}" value="${draft[key]}" data-rule="${key}" aria-label="${l}"></label>`).join('')}</div>
      <p class="fine" style="margin-top:12px">Queda <b>En observación</b> si alguna fuente sube ${draft.min_rising_weeks} semanas seguidas y al menos ${draft.min_growth}%. Pasa a <b>Para revisión</b> si cumple las cuatro condiciones. Con base pequeña (menos de ${draft.small_base} videos y reseñas por semana) se exige una fuente más. Las antiseñales no bloquean: se muestran para que la persona decida.</p>
      <div class="notice ${changes.length ? 'info' : ''}" style="margin-top:12px">${icon(changes.length ? 'lightning' : 'check-circle')}<span>${changes.length ? `Con estos umbrales cambian ${plural(changes.length, 'aliado', 'aliados')}. Para revisión: ${now.filter(b => b.a.estado === 'alerta').length} hoy, ${next.filter(b => b.a.estado === 'alerta').length} con la nueva regla.` : 'Con estos umbrales ningún aliado cambia de estado.'}</span></div>
      ${changes.length ? `<div class="diff" style="margin-top:10px">${changes.map(x => `<span class="tag t-mut">${esc(x.b.a.r.name)}: ${ESTADO[x.prev.a.estado][0]} ${icon('arrow-right')} ${ESTADO[x.b.a.estado][0]}</span>`).join('')}</div>` : ''}
      <div class="btn-row" style="margin-top:14px"><button class="btn btn-primary" data-a="ruleApply" ${dirty ? '' : 'disabled'}>Aplicar regla</button><button class="btn btn-line" data-a="ruleReset">Volver a la regla original</button></div></div>
    <div class="two">
      <div class="panel"><h3>${icon('target')}Precisión histórica</h3>
        <div class="three" style="grid-template-columns:1fr 1fr"><div class="kpi"><div class="k">Alertas con acción justificada</div><div class="v">${k.precision}%</div><div class="s">${h.filter(x => x.outcome === 'accion').length} de ${h.length} alertas cerradas</div></div><div class="kpi"><div class="k">Anticipación promedio</div><div class="v">${k.lead.replace('.', ',')}</div><div class="s">semanas antes del alza en pedidos</div></div></div>
        <p class="fine" style="margin-top:10px">Historial ficticio. En el piloto, cada decisión medida se suma aquí y sirve para ajustar los umbrales.</p></div>
      <div class="panel"><h3>${icon('clipboard-text')}Alertas cerradas</h3>
        ${h.map(x => `<div class="src"><span><b>${esc(x.name)}</b> <span class="fine">${esc(x.cat)}, ${esc(x.comuna)}</span></span><span style="display:flex;gap:8px;align-items:center"><span class="fine mono">${x.orders_after}</span><span class="tag ${outLbl[x.outcome][1]}">${outLbl[x.outcome][0]}</span></span></div>`).join('')}</div>
    </div>`;
}

/* ---------- Piloto y KPIs ---------- */
function radarPiloto() {
  const k = Engine.kpis(), d = DB.data, now = DB.nowMs(), in30 = x => now - Date.parse(x.created_at) < 30 * DAY;
  const revs = d.reviews.filter(in30), inc = revs.filter(r => r.rewarded), sp = revs.filter(r => !r.rewarded);
  const coins = d.wallet_ledger.filter(l => l.delta > 0 && in30(l)).reduce((a, l) => a + l.delta, 0) + inc.length * 20;
  const saves = d.saves.filter(in30).length, orders = d.orders.filter(o => o.source !== 'rappi' && in30(o)).length;
  const share = (a, b) => b ? Math.round(a / b * 100) : 0;
  return `<div class="rhead"><div><h1>Piloto y KPIs</h1><p>Cómo sabremos si funciona: cuántas personas usan, dan me gusta y guardan, y cuántas señales distintas recibe Rappi. Se calculan sobre la base simulada y se actualizan con lo que haces en MAPPI.</p></div></div>
    <h3 style="font-size:15px">Para el piloto con usuarios</h3>
    <div class="kpis">
      <div class="kpi"><div class="k">Usan MAPPI</div><div class="v">${k.active}</div><div class="s">${share(k.active, d.meta.exposed_users)}% de ${d.meta.exposed_users.toLocaleString('es-CL')} que la vieron (30 días)</div></div>
      <div class="kpi"><div class="k">Dan me gusta</div><div class="v">${k.recommend}</div><div class="s">${share(k.recommend, k.active)}% de quienes la usan dio me gusta</div></div>
      <div class="kpi"><div class="k">Dispuestas a guardar</div><div class="v">${k.save}</div><div class="s">${share(k.save, d.meta.exposed_users)}% de quienes la vieron</div></div>
      <div class="kpi"><div class="k">Siguen perfiles afines</div><div class="v">${new Set(d.follows.map(f => f.follower_id)).size}</div><div class="s">personas en la red de confianza</div></div>
    </div>
    <h3 style="font-size:15px">Para Rappi</h3>
    <div class="kpis">
      <div class="kpi"><div class="k">Señales distintas</div><div class="v">${k.distinctSignals}</div><div class="s">fuentes creciendo, sumadas por aliado</div></div>
      <div class="kpi"><div class="k">Aliados para revisión</div><div class="v">${k.alerts}</div><div class="s">${k.obs} más en observación</div></div>
      <div class="kpi"><div class="k">Precisión histórica</div><div class="v">${k.precision}%</div><div class="s">alertas con acción justificada</div></div>
      <div class="kpi"><div class="k">Anticipación</div><div class="v">${k.lead.replace('.', ',')}</div><div class="s">semanas antes de ventas</div></div>
    </div>
    <div class="two">
      <div class="panel"><h3>${icon('funnel')}Del guardado al me gusta (30 días)</h3>
        <div class="vbars">${[['Guardados', saves, saves], ['Pedidos desde MAPPI', orders, saves], ['Me gusta verificados', revs.length, saves]].map(([l, v, base]) => `<div class="vbar"><span>${l}</span><span class="b"><i style="width:${share(v, base)}%;background:var(--accent)"></i></span><b>${v}</b></div>`).join('')}</div>
        <p class="fine" style="margin-top:10px">${share(orders, saves)}% de los guardados termina en pedido y ${share(revs.length, orders)}% de los pedidos recibe un me gusta.</p></div>
      <div class="panel"><h3>${icon('shield-check')}Me gusta con y sin monedas</h3>
        <div class="vbars"><div class="vbar"><span>Con monedas</span><span class="b"><i style="width:${share(inc.length, revs.length)}%;background:var(--accent)"></i></span><b>${inc.length}</b></div><div class="vbar"><span>Espontáneos</span><span class="b"><i style="width:${share(sp.length, revs.length)}%;background:var(--blue)"></i></span><b>${sp.length}</b></div></div>
        <p class="fine" style="margin-top:10px">${share(inc.length, revs.length)}% de los me gusta recibió monedas. Si esa parte crece mucho más rápido que los espontáneos, revisar si el incentivo infla la señal. Todos exigen compra verificada y no hay comentarios.</p></div>
    </div>
    <div class="panel"><h3>${icon('ticket')}Costo del incentivo</h3>
      <p style="font-size:14px">En 30 días se entregaron cerca de <b class="mono">${coins}</b> monedas. Con 100 monedas = $1.000 de beneficio, el costo máximo es <b class="mono">${clp(coins * 10)}</b>, o <b class="mono">${clp(revs.length ? coins * 10 / revs.length : 0)}</b> por me gusta verificado.</p>
      <p class="fine" style="margin-top:6px">El costo real es menor: no todas las monedas se canjean. Valores ilustrativos, por validar con Rappi.</p></div>`;
}

/* ---------- Datos ---------- */
function radarDatos() {
  const r = S.r, names = DB.tableNames(), t = names.includes(r.table) ? r.table : 'restaurants';
  let rows = DB.data[t]; if (r.tq) { const q = M.norm(r.tq); rows = rows.filter(x => M.norm(JSON.stringify(x)).includes(q)); }
  const cols = [...new Set(rows.slice(0, 50).flatMap(x => Object.keys(x)))].slice(0, 9);
  const cell = v => v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return `<div class="rhead"><div><h1>Datos</h1><p>Base de datos simulada que alimenta MAPPI y Radar. Todo lo que haces en el prototipo se escribe aquí y queda guardado en este navegador.</p></div>
      <div class="btn-row"><button class="btn btn-line btn-sm" data-a="exportTable">${icon('download-simple')}CSV de la tabla</button><button class="btn btn-primary btn-sm" data-a="exportDB">${icon('download-simple')}Base completa (JSON)</button></div></div>
    <div class="tables">${names.map(n => `<button class="tbtn" data-a="rtable" data-v="${n}" aria-pressed="${n === t}"><b>${n}</b><span>${plural(DB.data[n].length, 'fila', 'filas')}${TABLE_INFO[n] ? `. ${TABLE_INFO[n]}` : ''}</span></button>`).join('')}</div>
    <div class="panel"><div class="filters" style="margin-bottom:10px"><h3 style="margin:0">${esc(t)}</h3><input type="search" data-f="tq" value="${esc(r.tq)}" placeholder="Filtrar filas" aria-label="Filtrar filas"><span class="fine" style="margin-left:auto">Mostrando ${Math.min(50, rows.length)} de ${rows.length}</span></div>
      ${rows.length ? `<div class="tbl-wrap"><table class="datagrid" style="min-width:0"><thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, 50).map(x => `<tr>${cols.map(c => `<td title="${esc(cell(x[c]))}">${esc(cell(x[c]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
        : `<div class="empty">${icon('table')}<b>${t === 'events' ? 'Aún no hay eventos en esta sesión' : 'Sin filas'}</b>${t === 'events' ? 'Usa MAPPI: cada acción aparece aquí como una fila.' : 'Prueba con otro filtro.'}</div>`}</div>
    <div class="panel"><h3>${icon('flow-arrow')}Diccionario de eventos: de la acción a la señal</h3>
      <div class="dict">${Object.entries(EVENT_DICT).map(([k, [l, s, ic]]) => `<div><span style="display:flex;gap:6px;align-items:center">${icon(ic)}<b>${l}</b></span><span class="fine"><span class="code">${k}</span> alimenta: ${s}</span></div>`).join('')}</div></div>`;
}

/* ---------- Detalle de aliado ---------- */
function radarDetail(id) {
  const r = S.r, sc = Engine.score(id), a = sc.a, v = sc.v, c = a.r, dec = decisionFor(id), f = r.form;
  const sess = DB.data.events.filter(e => e.restaurant_id === id && e.user_id === 'u_me');
  const sDelta = t => { const n = sess.filter(e => e.type === t).length; return n ? `+${n} en esta sesión` : ''; };
  const crit = [['perfil', 'Perfil objetivo'], ['personas', 'Distintas personas'], ['repite', 'Se repite'], ['sostiene', 'Se sostiene']];
  const likeMap = {}; DB.data.reviews.filter(x => x.restaurant_id === id).forEach(x => { const n = DB.dish(x.dish_id)?.name; if (n) likeMap[n] = (likeMap[n] || 0) + 1; });
  const topLikes = Object.entries(likeMap).sort((x, y) => y[1] - x[1]).slice(0, 3);
  const visita = c.visit || (a.estado === 'alerta' || a.estado === 'obs' ? { por: c.summary, rev: c.anti_signals[0] || 'Capacidad en hora punta y disponibilidad.', pre: '¿Quiere crecer en delivery? ¿Tiene acuerdos con otras apps?' } : null);
  const ext = DB.data.external_content.filter(x => x.restaurant_id === id);
  const evs = DB.data.events.filter(e => e.restaurant_id === id && e.user_id === 'u_me').slice(-8).reverse();
  return `<div><button class="backlink" data-a="rclose">${icon('caret-left')}Volver</button></div>
    <div class="det-head"><div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${stateTag(a.estado)}${a.flags.map(x => `<span class="tag t-mut">${x}</span>`).join('')}${dec ? `<span class="tag t-vio">${esc(dec.option)}</span>` : ''}</div>
      <h1>${esc(c.name)}</h1><div class="fine" style="font-size:14px;margin-top:4px">${esc(c.cat)}, ${esc(c.comuna)}. En Rappi desde ${c.in_rappi_since}.</div>
      <p class="lead">${esc(c.summary)}</p>
      <div class="crits" style="margin-top:16px">${crit.map(([k, l]) => { const x = a.crit[k]; return `<div class="crit ${x[0] ? 'on' : 'off'}"><div class="ck">${icon(x[0] ? 'check-circle' : 'x-circle')}${l}</div><p>${esc(x[1])}</p></div>`; }).join('')}</div>
      <div class="panel" style="display:grid;gap:10px;margin-top:16px"><div class="chart-head"><h3 style="margin:0">Interés combinado vs. pedidos</h3><div class="legend"><span><i style="background:var(--accent)"></i>Interés combinado</span><span><i class="dash"></i>Pedidos</span></div></div>
        <div class="chart-wrap" style="height:200px"><canvas id="detailChart" aria-label="Gráfico de interés y pedidos de ${esc(c.name)}"></canvas></div></div></div>
      <div class="scorecard" style="position:sticky;top:12px"><div style="display:flex;justify-content:space-between;align-items:center"><span class="fine">Puntaje de oportunidad</span><span class="tag ${sc.conf === 'Alta' ? 't-good' : sc.conf === 'Media' ? 't-warn' : 't-mut'}">Confianza ${sc.conf.toLowerCase()}</span></div>
        <div class="big"><b>${sc.total}</b><span>/ 100</span></div>
        <div class="parts">${sc.parts.map(p => `<div class="part"><div class="row"><span>${p.l}</span><b>${p.v}/${p.max}</b></div><div class="track2"><i style="width:${p.v / p.max * 100}%"></i></div><div class="why">${esc(p.why)}</div></div>`).join('')}
          ${sc.penalties.map(p => `<div class="part"><div class="row" style="color:var(--bad)"><span>${esc(p.l)}</span><b>-${p.v}</b></div></div>`).join('')}</div>
        <p class="fine">El puntaje ordena la cartera. El estado lo define la regla de 4 condiciones.</p></div></div>
    ${(() => { const tl = Engine.timeline(id), wl = weekLabels(); return `<div class="panel"><h3>${icon('path')}Cómo se formó la señal</h3>
      <p class="fine" style="margin:-4px 0 12px;max-width:72ch">${tl.first != null ? `La primera fuente en subir fue <b style="color:var(--fg)">${SOURCES[tl.firstSrc].n}</b>, hace ${plural(tl.lead, 'semana', 'semanas')}. Mientras tanto, los pedidos cambiaron ${pct(tl.ordersGrowth)}.` : 'Ninguna fuente sostiene un alza en estas 8 semanas.'} El color muestra cuánto subió cada fuente contra la primera semana.</p>
      <div class="heat" role="table" aria-label="Intensidad semanal por fuente">
        <div class="hrow head" role="row"><span role="columnheader">Fuente</span>${wl.map((w, i) => `<span role="columnheader" class="${i === 7 ? 'today' : ''}">${i === 7 ? 'Hoy' : w}</span>`).join('')}<span role="columnheader">Cambio</span></div>
        ${tl.rows.map(r => `<div class="hrow ${r.k === 'pedidos' ? 'orders' : ''}" role="row"><span role="rowheader" class="src-l">${icon(SOURCES[r.k].icon)}${SOURCES[r.k].short}</span>${r.s.map((v, i) => `<span role="cell" class="cell ${r.start === i ? 'start' : ''}" style="--h:${Math.round(r.heat[i] * 100)}%" title="${esc(SOURCES[r.k].n)}, semana del ${wl[i]}: ${v}">${r.start === i ? `<i class="sr">Inicio del alza</i>` : ''}</span>`).join('')}<span role="cell" class="mono chg ${r.growing ? 'up' : ''}">${pct(r.g)}</span></div>`).join('')}
        ${['tiktok', 'google', 'instagram'].filter(k => !tl.rows.some(r => r.k === k)).length ? `<p class="fine" style="margin-top:6px">Sin fuente externa disponible para esta zona. No bloquea el análisis.</p>` : ''}
      </div>
      <div class="legend" style="margin-top:10px"><span><i style="background:color-mix(in srgb,var(--accent) 80%,var(--surface-2))"></i>Sube fuerte</span><span><i style="background:color-mix(in srgb,var(--accent) 25%,var(--surface-2))"></i>Sube poco</span><span><i class="start-key"></i>Semana en que empezó el alza</span></div></div>`; })()}
    <div class="panel"><h3>${icon('users-three')}Respuesta en MAPPI <span class="tag t-mut">Últimos 7 días</span></h3>
      <p class="fine" style="margin-bottom:12px">Personas distintas por acción. Pueden superponerse; no es un embudo obligatorio.</p>
      <div class="funnel">${[['exp', 'Lo vieron', 'impression'], ['open', 'Abrieron la ficha', 'open_restaurant'], ['save', 'Guardaron', 'save'], ['menu', 'Abrieron el menú', 'open_menu'], ['buy', 'Compraron', 'order'], ['share', 'Compartieron', 'share']].map(([k, l, t]) => `<div class="fstep"><div class="v">${v.funnel[k]}</div><div class="k">${l}</div><div class="d">${sDelta(t)}</div></div>`).join('')}</div>
      <div class="three" style="margin-top:12px">
        <div><div class="fine" style="margin-bottom:6px">Me gusta verificados (8 semanas)</div><div class="vbars"><div class="vbar"><span>Con monedas</span><span class="b"><i style="width:${v.total ? v.inc / v.total * 100 : 0}%;background:var(--accent)"></i></span><b>${v.inc}</b></div><div class="vbar"><span>Espontáneos</span><span class="b"><i style="width:${v.total ? v.spont / v.total * 100 : 0}%;background:var(--blue)"></i></span><b>${v.spont}</b></div></div><p class="fine" style="margin-top:6px">${v.pctSi ?? 0}% de los pedidos recibe me gusta. Se leen aparte.</p></div>
        <div><div class="fine" style="margin-bottom:6px">Platos con más me gusta</div>${topLikes.length ? `<div class="qtags" style="gap:6px">${topLikes.map(([t, n]) => `<span class="tag t-good">${icon('heart-fill')}${esc(t)} ${n}</span>`).join('')}</div>` : '<p class="fine">Sin me gusta todavía.</p>'}</div>
        <div><div class="fine" style="margin-bottom:6px">Perfiles afines a los que les gusta</div>${v.recommenders.length ? `<div style="display:flex;gap:8px;align-items:center"><span class="avatars">${v.recommenders.slice(0, 5).map(u => avatar(u, 'sm')).join('')}</span><span class="fine">${plural(v.recommenders.length, 'perfil público', 'perfiles públicos')} con ${DB.data.follows.filter(f => v.recommenders.some(u => u.id === f.followee_id)).length} seguidores en total</span></div>` : '<p class="fine">Todavía ninguno.</p>'}</div>
      </div></div>
    <div class="two">
      <div class="panel"><h3>${icon('user')}Quién genera la señal</h3><ul class="bul"><li>${esc(a.crit.perfil[1])}</li><li>${esc(a.crit.personas[1])}</li><li><b>Plato que concentra el interés:</b> ${esc(c.star_dish)} (${c.star_share}% de las menciones)</li></ul>
        ${ext.length ? `<h3 style="margin-top:14px">${icon('play')}Contenido externo enlazado</h3>${ext.map(x => `<div class="src"><span class="l">${icon(x.network + '-logo')}${esc(x.handle)}: ${esc(x.title)}</span><span class="fine mono">${esc(x.views)}</span></div>`).join('')}` : ''}</div>
      <div class="panel"><h3>${icon('warning')}Antiseñales ${c.anti_signals.length ? `<span class="tag t-bad">${c.anti_signals.length}</span>` : ''}</h3>${c.anti_signals.length ? `<ul class="bul">${c.anti_signals.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="fine">No se detectan problemas de operación.</p>'}
        <h3 style="margin-top:14px">${icon('question')}Qué falta saber</h3>${c.unknowns.length ? `<ul class="bul">${c.unknowns.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="fine">Sin preguntas abiertas registradas.</p>'}</div>
    </div>
    ${evs.length ? `<div class="panel"><h3>${icon('clock')}Actividad reciente desde MAPPI</h3><div class="timeline">${evs.map(e => `<div class="tl"><time>${clock(Date.parse(e.ts))}</time><span>${esc((EVENT_DICT[e.type] || [e.type])[0])}${e.dish_id ? `: ${esc(DB.dish(e.dish_id).name)}` : ''}${e.answer ? ` (${e.answer === 'si' ? 'Sí' : e.answer === 'dep' ? 'Depende' : 'No'})` : ''}${e.changes?.[0] ? ` <span class="tag t-good">${esc(changeTxt(e.changes[0]))}</span>` : ''}</span></div>`).join('')}</div></div>` : ''}
    ${visita ? `<div class="panel visit"><h3>${icon('clipboard-text')}Ficha de visita para el KAM</h3><dl><dt>Por qué ir</dt><dd>${esc(visita.por)}</dd><dt>Plato estrella</dt><dd>${esc(c.star_dish)}</dd><dt>Revisar</dt><dd>${esc(visita.rev)}</dd><dt>Preguntar</dt><dd>${esc(visita.pre)}</dd></dl></div>` : ''}
    <div class="panel" id="decision"><h3>${icon('flag')}Decisión del equipo</h3>
      ${dec ? `<div class="notice ok">${icon('check-circle')}<span>Registrado: <b>${esc(dec.option)}${dec.action ? `, ${ACTIONS[dec.action]}` : ''}</b>. ${esc(dec.owner)}, ${dayLabel(dec.ts || dec.date)}. Próximo paso: ${esc(dec.next || 'sin definir')}.</span></div>
        <div class="btn-row" style="margin-top:10px"><button class="btn btn-line" data-a="rpage" data-v="seguimiento">Ver seguimiento</button>${dec.action === 'destacar' ? `<button class="btn btn-line" data-a="seeInMappi" data-r="${id}">Ver cómo aparece en MAPPI</button>` : ''}</div>`
      : `<p class="fine" style="margin-bottom:10px">Una alerta no confirma una tendencia. La decisión es de una persona y queda registrada con su motivo.</p>
      <div class="decide-opts" role="group" aria-label="Decisión">${DECISIONS.map(d => `<button class="dopt" data-a="dopt" data-v="${d.o}" aria-pressed="${f.opt === d.o}">${icon(d.ic)}${d.o}</button>`).join('')}</div>
      ${f.opt === 'Proponer acción comercial' ? `<div style="margin-top:12px"><span class="lbl">Tipo de acción</span><div class="filters">${Object.entries(ACTIONS).map(([k, l]) => `<button class="chip" data-a="daction" data-v="${k}" aria-pressed="${f.action === k}">${l}</button>`).join('')}</div>${f.action === 'destacar' ? `<p class="help">Aparecerá en MAPPI con la etiqueta "Destacado por Rappi", separado de las recomendaciones de personas.</p>` : ''}</div>` : ''}
      <div class="form-grid">
        <div><label class="lbl" for="owner">Responsable</label><select id="owner" data-f2="owner"><option value="">Elegir...</option>${OWNERS.map(o => `<option ${f.owner === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
        <div><label class="lbl" for="next">Próximo paso</label><input type="text" id="next" data-f2="next" value="${esc(f.next)}" placeholder="Visitar el local el martes"><div class="help">Opcional</div></div>
        <div class="full"><label class="lbl" for="why">Motivo</label><textarea id="why" data-f2="why" rows="2" placeholder="Por qué tomas esta decisión">${esc(f.why)}</textarea></div>
      </div>
      ${r.formErr ? `<div class="notice err" role="alert" style="margin-top:10px">${icon('warning')}<span>${r.formErr}</span></div>` : ''}
      <button class="btn btn-primary" style="margin-top:12px" data-a="decide" data-r="${id}">Guardar decisión</button>
      <p class="fine" style="margin-top:6px">No se contacta a nadie desde el prototipo.</p>`}
    </div>`;
}

/* ---------- Gráfico ---------- */
let charts = [];
function drawCharts() {
  charts.forEach(c => c.destroy()); charts = [];
  if (!window.Chart) return;
  const mk = (cvId, rid) => {
    const cv = document.getElementById(cvId); if (!cv) return;
    const a = Engine.analyze(rid), po = Engine.idx(a.s.pedidos).map(Math.round), ctx = cv.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, cv.parentElement.clientHeight || 260); g.addColorStop(0, 'rgba(222,52,16,.22)'); g.addColorStop(1, 'rgba(222,52,16,0)');
    Chart.defaults.font.family = 'Inter, system-ui, sans-serif'; Chart.defaults.color = '#666672';
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || !S.r._animChart;
    charts.push(new Chart(ctx, { type: 'line', data: { labels: weekLabels(), datasets: [
      { label: 'Interés combinado', data: a.ix, borderColor: '#DE3410', backgroundColor: g, borderWidth: 2.5, fill: true, tension: .4, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#DE3410', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2 },
      { label: 'Pedidos', data: po, borderColor: '#2A63D6', backgroundColor: 'transparent', borderWidth: 2, borderDash: [6, 5], tension: .4, pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: '#2A63D6', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, animation: reduce ? false : { duration: 500 },
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1A1A22', borderColor: 'rgba(0,0,0,.1)', borderWidth: 1, titleColor: '#FFFFFF', bodyColor: '#C9C9D2', padding: 12, cornerRadius: 10,
          callbacks: { title: it => 'Semana del ' + it[0].label, label: it => it.datasetIndex === 0 ? ` Interés combinado: ${it.parsed.y}` : ` Pedidos: ${a.s.pedidos[it.dataIndex]} (índice ${it.parsed.y})` } } },
        scales: { x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, font: { size: 11 } } }, y: { grid: { color: 'rgba(26,26,34,.07)' }, border: { display: false }, ticks: { font: { size: 11 } } } } } }));
  };
  mk('mainChart', S.r.chartId); if (S.r.open) mk('detailChart', S.r.open);
}

