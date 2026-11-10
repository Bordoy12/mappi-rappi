/* ================= App: estado, conexión MAPPI → Radar, acciones ================= */
DB.load(window.SEED);
bootFeed();

function freshUI() {
  const v = location.hash.replace('#', '');
  return {
    view: ['mappi', 'conectado', 'radar'].includes(v) ? v : 'mappi',
    m: { screen: 'rappi', stack: [], rest: 'azafran', person: 'u_1', tab: 'rappi', mode: 'map', filter: 'cerca', sel: 'azafran', q: '', qDone: false, pick: null, qty: 1, useCoupon: false, draft: null, lastResult: null, notice: '', confirm: null, busy: false, failRedeem: false, toast: '', pplTab: 'sugeridos', showLast: true, allOps: false, seen: new Set(), story: null, sheet: null, profTab: 'opiniones' },
    r: { page: 'signals', open: null, fc: '', fk: '', fe: '', fq: '', sort: 'score', chartId: 'azafran', zone: 'nunoa', table: 'events', tq: '', form: { opt: '', action: '', owner: '', why: '', next: '' }, formErr: '', ruleDraft: null },
    gtoast: '',
  };
}
let S = freshUI();
let BASELINE = Object.fromEntries(Engine.board().map(b => [b.a.r.id, b.total]));

/* ---------- La interfaz escucha el bus del dominio ---------- */
Bus.on(ev => { S.lastEvent = ev.id; S.fly = S.view === 'conectado' && ev.user_id !== 'radar'; });

/* ---------- Recorrido guiado: Casa Azafrán de punta a punta ---------- */
const TOUR = [
  { t: 'Entra a MAPPI desde Rappi', done: () => evDone('enter_mappi'), go: () => { S.view = 'mappi'; A.enterMappi(); } },
  { t: 'Mira la historia de Javiera, una persona afín', done: () => evDone('view_story'), go: () => { S.view = 'mappi'; if (S.m.screen === 'rappi') A.enterMappi(); A.openStory({ u: 'u_2' }); } },
  { t: 'Abre Casa Azafrán', done: () => evDone('open_restaurant', 'azafran'), go: () => { S.view = 'mappi'; A.openRest({ r: 'azafran' }); } },
  { t: 'Guárdala en "Quiero probar"', done: () => evDone('save', 'azafran'), go: () => { S.view = 'mappi'; A.openRest({ r: 'azafran' }); } },
  { t: 'Pide el bowl', done: () => evDone('order', 'azafran'), go: () => { S.view = 'mappi'; A.order({ r: 'azafran' }); } },
  { t: 'Marca el pedido como recibido', done: () => evDone('receive', 'azafran'), go: () => { S.view = 'mappi'; A.tab({ s: 'orders' }); } },
  { t: 'Da me gusta con compra verificada', done: () => evDone('review', 'azafran'), go: () => { S.view = 'mappi'; const o = M.myOrders().find(x => x.restaurant_id === 'azafran' && x.status === 'recibido'); if (o && !M.reviewFor(o.id)) A.reviewStart({ o: o.id }); else A.tab({ s: 'orders' }); } },
  { t: 'Mira la señal en Radar', done: () => evDone('radar_open', 'azafran'), go: () => { A.view({ v: 'radar' }); A.ropen({ r: 'azafran' }); } },
  { t: 'Registra la decisión del equipo', done: () => !!decisionFor('azafran'), go: () => { A.view({ v: 'radar' }); A.ropen({ r: 'azafran' }); S.scrollTo = 'decision'; } },
];

/* ---------- Render ---------- */
// La barra superior es fija (index.html); aquí solo se marca la vista activa
function updateTopbar() {
  document.querySelectorAll('#topbar .switch button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === S.view)));
}

function guidePanel() {
  const info = SCREEN_INFO[S.m.screen], done = TOUR.map(s => s.done()), n = done.filter(Boolean).length, next = done.indexOf(false);
  const evs = DB.data.events.filter(e => e.user_id === 'u_me' && e.type !== 'impression').slice(-10).reverse();
  return `
    <div class="gcard"><div class="stage"><span class="tag t-acc">${esc(info.st)}</span><span class="tag t-mut">Pantalla de MAPPI</span></div><h3>${esc(info.t)}</h3><p>${esc(info.d)}</p></div>
    <div class="gcard"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px"><h3>Recorrido: Casa Azafrán</h3><span class="fine mono">${n}/${TOUR.length}</span></div>
      <div class="progress" aria-hidden="true"><i style="width:${n / TOUR.length * 100}%"></i></div>
      <p>De la recomendación a la decisión. Cada paso deja una señal que Radar usa.</p>
      <ol class="steps">${TOUR.map((s, i) => `<li class="${done[i] ? 'done' : ''} ${i === next ? 'next' : ''}"><span class="ck">${done[i] ? icon('check') : ''}</span><span class="t">${esc(s.t)}</span>${!done[i] ? `<button class="btn btn-sm ${i === next ? 'btn-primary' : 'btn-soft'}" data-a="tourGo" data-i="${i}">Ir</button>` : ''}</li>`).join('')}</ol>
      ${n === TOUR.length ? `<div class="notice ok">${icon('check-circle')}<span>Recorrido completo: la recomendación de una persona terminó en una decisión de Rappi con evidencia.</span></div>` : ''}</div>
    <div class="gcard"><h3 style="font-size:16px">Lo que Radar registra de esta sesión</h3>
      ${evs.length ? `<div class="evlog" tabindex="0" role="region" aria-label="Eventos registrados">${evs.map(e => { const d = EVENT_DICT[e.type] || [e.type, '']; const rs = e.restaurant_id && DB.rest(e.restaurant_id); return `<div class="ev"><time>${clock(Date.parse(e.ts))}</time><div>${esc(d[0])}${rs ? `: ${esc(rs.name)}` : ''} <span class="sig-to">${icon('arrow-right')}${esc(d[1])}</span>${e.changes?.[0] ? ` <span class="tag t-good">${esc(changeTxt(e.changes[0]))}</span>` : ''}${e.score_after != null && e.score_after !== e.score_before ? ` <span class="tag t-acc">${e.score_after - e.score_before > 0 ? '+' : ''}${e.score_after - e.score_before} pts</span>` : ''}</div></div>`; }).join('')}</div>`
        : `<p>Todavía no hay acciones. Sigue el recorrido o abre cualquier restaurante y verás aquí cómo cada acción llega a Radar.</p>`}
      <div class="btn-row"><button class="btn btn-soft" data-a="view" data-v="conectado">${icon('flow-arrow')}Ver flujo conectado</button><button class="btn btn-line" data-a="radarRest" data-r="azafran">Casa Azafrán en Radar</button></div></div>
    <div class="gcard"><h3 style="font-size:16px">Otros casos para probar</h3>
      <ol class="routes">
        <li><b>Sin me gusta:</b> en Inicio, toca "Ahora no" sobre Burger Central. No suma monedas y el local no pasa a alerta.</li>
        <li><b>Búsqueda sin resultado:</b> busca "comida etíope" en Explorar. Aparece en Radar como demanda sin oferta.</li>
        <li><b>Excepciones:</b> da me gusta desde una ficha sin haber pedido, intenta repetir el me gusta de un plato ya premiado o canjea sin saldo.</li>
        <li><b>Cierre del ciclo:</b> en Radar, decide "Proponer acción comercial" y "Destacar en MAPPI" para un aliado. Vuelve a MAPPI y míralo en Inicio.</li>
      </ol>
      <label class="toggle"><input type="checkbox" id="fail" ${S.m.failRedeem ? 'checked' : ''}> Simular error en el próximo canje</label></div>
    <div class="gcard"><h3 style="font-size:16px">Pruébalo en tu celular</h3>
      <p>Abre esta misma página desde el celular: la carcasa desaparece y MAPPI ocupa toda la pantalla. En iPhone usa Compartir > "Agregar a inicio" para abrirla como app.</p></div>`;
}

const CHAIN = [
  ['Descubre', ['open_restaurant', 'view_story', 'open_profile', 'view_external'], 'eye'],
  ['Guarda', ['save'], 'bookmark-simple'],
  ['Recomienda', ['review', 'share', 'follow'], 'chat-circle-text'],
  ['Busca', ['search', 'search_empty'], 'magnifying-glass'],
  ['Prueba', ['order', 'receive'], 'shopping-bag'],
  ['Recompra', ['reorder'], 'arrows-clockwise'],
];
const chainOf = e => CHAIN.findIndex(([, types]) => types.includes(e.type === 'order' && e.repeat ? 'reorder' : e.type));
function connectedView() {
  const evs = DB.data.events.filter(e => e.user_id === 'u_me' && e.type !== 'impression').slice(-14).reverse();
  const last = evs[0], lit = last && last.id === S.lastEvent;
  const rid = S.m.rest || 'azafran', sc = Engine.score(rid), a = sc.a;
  const board = Engine.board().slice(0, 6);
  return `
    <div class="conn-col">
      <div class="pipe"><h3 style="font-size:16px">Cada interacción deja una señal</h3>
        <ol class="chain">${CHAIN.map(([l, , ic], i) => { const n = evs.filter(e => chainOf(e) === i).length; return `<li class="${n ? 'on' : ''} ${lit && chainOf(last) === i ? 'now' : ''}">${icon(ic)}<b>${l}</b><span class="mono">${n}</span></li>`; }).join('')}</ol>
        ${last ? `<div class="pipe-now ${lit ? 'lit' : ''}"><span>${icon('hand-pointing')}<b>${esc((EVENT_DICT[last.type] || [last.type])[0])}</b></span>${icon('arrow-right')}<span class="code">${last.table}</span>${icon('arrow-right')}<span>${esc(last.changes?.[0] ? changeTxt(last.changes[0]) : (EVENT_DICT[last.type] || ['', ''])[1])}</span>${last.score_after != null ? `${icon('arrow-right')}<span class="mono">${last.score_after !== last.score_before ? `${last.score_before} a ${last.score_after} pts` : `${last.score_after} pts`}</span>` : ''}</div>` : ''}
        <div class="stream" tabindex="0" role="region" aria-label="Flujo de eventos">${evs.length ? evs.map((e, i) => { const d = EVENT_DICT[e.type] || [e.type, '', 'circle']; const rs = e.restaurant_id && DB.rest(e.restaurant_id); const dl = e.score_after != null ? e.score_after - e.score_before : null;
          return `<div class="sitem ${i === 0 && lit ? 'enter' : ''}"><div style="display:flex;justify-content:space-between;gap:8px"><b style="font-size:13.5px;display:flex;gap:6px;align-items:center">${icon(d[2])}${esc(d[0])}${rs ? `: ${esc(rs.name)}` : ''}</b><span class="fine mono">${clockS(Date.parse(e.ts))}</span></div>
            <div class="flow"><span class="code">${e.type}</span>${icon('arrow-right')}<span class="code">${e.table}</span>${icon('arrow-right')}<span>${esc(d[1])}</span>${e.changes?.[0] ? `<span class="tag t-good">${esc(changeTxt(e.changes[0]))}</span>` : ''}${dl ? `<span class="tag t-acc">${dl > 0 ? '+' : ''}${dl} pts</span>` : ''}</div></div>`; }).join('')
          : `<div class="empty">${icon('hand-pointing')}<b>Usa MAPPI en el teléfono</b>Cada acción aparece aquí: qué tabla se escribe, qué señal alimenta y cómo cambia el puntaje.<button class="btn btn-primary btn-sm" data-a="tourGo" data-i="${Math.max(0, TOUR.findIndex(s => !s.done()))}">Empezar recorrido</button></div>`}</div></div>
    </div>
    <div class="conn-col conn-radar">
      <div class="panel" style="display:grid;gap:12px"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div><span class="fine">Radar ve en este momento</span><h3 style="font-size:20px;margin:2px 0 0">${esc(a.r.name)}</h3><div class="fine">${esc(a.r.cat)}, ${esc(a.r.comuna)}</div></div>${stateTag(a.estado)}</div>
        <div class="scorecard" style="border:0;padding:0"><div class="big"><b>${sc.total}</b><span>/ 100</span>${sc.total !== BASELINE[rid] ? `<span class="tag t-good" style="margin-left:6px">${sc.total - BASELINE[rid] > 0 ? '+' : ''}${sc.total - BASELINE[rid]} en la sesión</span>` : ''}</div>
          <div class="parts">${sc.parts.map(p => `<div class="part"><div class="row"><span>${p.l}</span><b>${p.v}/${p.max}</b></div><div class="track2"><i style="width:${p.v / p.max * 100}%"></i></div></div>`).join('')}</div></div>
        <div><div class="fine" style="margin-bottom:4px">Guardados en MAPPI por semana: <b class="mono" style="color:var(--fg)">${a.s.mappi[7]}</b> esta semana</div>${spark(a.s.mappi, 'var(--accent)', 48)}</div>
        <div class="crits" style="grid-template-columns:1fr 1fr">${[['perfil', 'Perfil'], ['personas', 'Personas'], ['repite', 'Se repite'], ['sostiene', 'Se sostiene']].map(([k, l]) => `<div class="crit ${a.crit[k][0] ? 'on' : 'off'}" style="padding:8px 10px"><div class="ck" style="font-size:13px">${icon(a.crit[k][0] ? 'check-circle' : 'x-circle')}${l}</div></div>`).join('')}</div>
        <button class="btn btn-primary" data-a="radarRest" data-r="${rid}">Abrir en Radar ${icon('arrow-right')}</button></div>
      <div class="panel"><h3>${icon('lightning')}Ranking en vivo</h3>${board.map((b, i) => { const dl = b.total - (BASELINE[b.a.r.id] ?? b.total); return `<button class="src" style="width:100%;text-align:left" data-a="focusRest" data-r="${b.a.r.id}"><span class="rest-cell"><span class="mono muted">${i + 1}</span>${thumb(b.a.r)}<span><b style="font-size:13.5px">${esc(b.a.r.name)}</b><div class="fine">${ESTADO[b.a.estado][0]}</div></span></span><span style="display:flex;gap:8px;align-items:center">${dl ? `<span class="mono delta-up" style="font-size:12px">${dl > 0 ? '+' : ''}${dl}</span>` : ''}${scoreCell(b.total)}</span></button>`; }).join('')}</div>
    </div>`;
}

/* ---------- Paleta de comandos (⌘K / Ctrl+K) ---------- */
function cmdItems(q) {
  const n = M.norm(q || '');
  const items = [
    ...[['mappi', 'Ir a MAPPI', 'users-three'], ['conectado', 'Ver flujo conectado', 'flow-arrow'], ['radar', 'Ir a Radar', 'broadcast']].map(([v, l, ic]) => ({ l, sub: 'Vista', ic, run: () => A.view({ v }) })),
    ...RPAGES.map(([k, l, ic]) => ({ l, sub: 'Radar', ic, run: () => { A.view({ v: 'radar' }); A.rpage({ v: k }); } })),
    ...Engine.board().map(b => ({ l: b.a.r.name, sub: `${b.a.r.cat}, ${b.a.r.comuna}. ${ESTADO[b.a.estado][0]}, ${b.total} pts`, ic: glyph(b.a.r), run: () => A.radarRest({ r: b.a.r.id }) })),
    ...TOUR.map((t, i) => ({ l: t.t, sub: 'Recorrido Casa Azafrán', ic: 'path', run: () => TOUR[i].go() })),
    { l: 'Exportar base completa (JSON)', sub: 'Acción', ic: 'download-simple', run: () => A.exportDB() },
    { l: 'Reiniciar prototipo', sub: 'Acción', ic: 'arrows-clockwise', run: () => A.reset() },
  ];
  return (n ? items.filter(x => M.norm(x.l + ' ' + x.sub).includes(n)) : items).slice(0, 9);
}
function cmdHTML() {
  const c = S.cmd, items = c.items = cmdItems(c.q); c.i = Math.min(c.i, Math.max(0, items.length - 1));
  return `<div class="cmdk-wrap theme-radar"><div class="cmdk-bg" data-a="closeCmd"></div>
    <div class="cmdk" role="dialog" aria-modal="true" aria-label="Buscar en el prototipo">
      <label class="cmdk-in">${icon('magnifying-glass')}<input id="cmdk-q" type="text" value="${esc(c.q)}" placeholder="Busca un aliado, una página o una acción" aria-label="Buscar" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="cmdk-list"></label>
      <ul id="cmdk-list" role="listbox">${items.length ? items.map((x, i) => `<li role="option" aria-selected="${i === c.i}"><button data-a="cmdRun" data-i="${i}" class="${i === c.i ? 'on' : ''}">${icon(x.ic)}<span><b>${esc(x.l)}</b><span>${esc(x.sub)}</span></span>${i === c.i ? icon('arrow-elbow-down-right') : ''}</button></li>`).join('') : `<li class="empty" style="padding:18px">Sin resultados para "${esc(c.q)}"</li>`}</ul>
      <div class="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> moverse</span><span><kbd>Enter</kbd> abrir</span><span><kbd>Esc</kbd> cerrar</span></div>
    </div></div>`;
}
/* ---------- Dibujo ----------
   Cada acción cambia el estado S y llama a render(). render() solo rellena
   los bloques que ya existen en index.html. */
let lastScreen = null;
function render() {
  const view = S.view;
  document.body.className = view === 'radar' ? 'theme-radar' : 'theme-mappi';
  document.body.dataset.view = view;
  $('#main').dataset.view = view;
  updateTopbar();

  // Teléfono
  if (view !== 'radar') {
    const p = phoneParts(), sc = $('#screen');
    $('#phone').classList.toggle('is-story', p.full);
    $('#phone').classList.toggle('is-rappi', p.rappi);
    sc.innerHTML = p.screen;
    if (S.m.screen !== lastScreen && !S.m._keep) sc.scrollTop = 0;
    lastScreen = S.m.screen;
    $('#bnav').innerHTML = p.nav;
    $('#bnav').hidden = p.full;
    $('#ptoast').innerHTML = p.toast;
    $('#psheet').innerHTML = p.sheet;
    $('#sb-time').textContent = new Date().toLocaleTimeString('es-CL', { hour: 'numeric', minute: '2-digit', hourCycle: 'h23' });
    afterRenderMaps();
  }
  // Paneles según la vista
  $('#guide').innerHTML = view === 'mappi' ? guidePanel() : '';
  $('#conn').innerHTML = view === 'conectado' ? connectedView() : '';
  // Radar: el panel tiene su propio scroll; se conserva al redibujar salvo al cambiar de página
  if (view === 'radar') {
    const prev = document.getElementById('rd-scroll'), top = prev && !S.r._anim ? prev.scrollTop : 0;
    $('#radar').innerHTML = renderRadar();
    const now = document.getElementById('rd-scroll'); if (now) now.scrollTop = top;
  } else $('#radar').innerHTML = '';

  // Capas flotantes: aviso global, paleta de comandos y exportación
  $('#overlays').innerHTML = `${S.gtoast ? `<div class="gtoast" role="status">${icon('check-circle')}<span>${esc(S.gtoast)}</span></div>` : ''}${S.cmd ? cmdHTML() : ''}${S.exportBox ? `<div class="modal-bg"><div class="modal theme-radar" role="dialog" aria-modal="true" aria-labelledby="exp-t">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h3 id="exp-t" style="font-size:17px">Exportar ${esc(S.exportBox.name)}</h3><button class="icon-btn" data-a="closeExport" aria-label="Cerrar">${icon('x')}</button></div>
      <p class="fine">Si la descarga no empezó (algunos visores la bloquean), copia el contenido y pégalo en un archivo nuevo.</p>
      <textarea id="exp-text" readonly rows="12" class="mono" style="font-size:12px">${esc(S.exportBox.text.length > 400000 ? S.exportBox.text.slice(0, 400000) + '\n...' : S.exportBox.text)}</textarea>
      <div class="btn-row"><button class="btn btn-primary" data-a="copyExport">${icon('clipboard-text')}Copiar todo</button><button class="btn btn-line" data-a="saveExport">${icon('download-simple')}Descargar de nuevo</button></div></div></div>` : ''}`;
  if (S.cmd) { const q = document.getElementById('cmdk-q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  S.m._keep = false; S.m._anim = false; S.m.bump = false;
  // Historias: avanzan solas cada 6 s (nunca con movimiento reducido)
  clearTimeout(storyT);
  if (view !== 'radar' && S.m.screen === 'story' && !reduceMotion()) storyT = setTimeout(() => { if (S.m.screen === 'story') { A.storyNav({ v: 1 }); render(); } }, 6000);
  if (view === 'radar') drawCharts(); else { charts.forEach(c => c.destroy()); charts = []; }
  S.r._anim = false; S.r._animChart = false;
  DB.data.session.radarFeed.forEach(f => f.fresh = false);
  if (S.fly) { S.fly = false; flySignal(); }
  if (S.scrollTo) { const el = document.getElementById(S.scrollTo); if (el) el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }); S.scrollTo = null; }
}

// Un punto viaja desde el botón tocado hasta el puntaje de Radar: muestra que la acción llegó (respuesta, no adorno)
let lastClick = null;
function flySignal() {
  const to = document.querySelector('.conn-radar .big b'); if (!lastClick || !to || reduceMotion() || !document.body.animate) return;
  const b = to.getBoundingClientRect(), x0 = lastClick.x, y0 = lastClick.y, x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
  const dot = document.createElement('span'); dot.className = 'fly'; dot.style.left = x0 + 'px'; dot.style.top = y0 + 'px'; document.body.appendChild(dot);
  const dx = x1 - x0, dy = y1 - y0;
  dot.animate([{ transform: 'translate(-50%,-50%) scale(.6)', opacity: 1 }, { transform: `translate(calc(-50% + ${dx * .5}px), calc(-50% + ${dy * .5 - 80}px)) scale(1.3)`, opacity: 1, offset: .55 }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.5)`, opacity: .2 }], { duration: 750, easing: 'cubic-bezier(.4,0,.2,1)' }).onfinish = () => {
    dot.remove(); to.closest('.scorecard')?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.03)' }, { transform: 'scale(1)' }], { duration: 300 });
  };
}

/* ---------- Acciones ---------- */
const go = s => { S.m.stack.push(S.m.screen); S.m.screen = s; S.m._anim = true; $('#screen').scrollTop = 0; };
let toastT, gtoastT, storyT;
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function toast(t) { S.m.toast = t; clearTimeout(toastT); toastT = setTimeout(() => { S.m.toast = ''; render(); }, 2800); }
function gtoast(t) { S.gtoast = t; clearTimeout(gtoastT); gtoastT = setTimeout(() => { S.gtoast = ''; render(); }, 3200); }

const A = {
  view(d) { S.view = d.v; S.r._anim = S.r._animChart = true; try { history.replaceState(null, '', '#' + d.v); } catch (e) {} window.scrollTo({ top: 0 }); },
  reset() { Domain.reset(); const v = S.view; S = freshUI(); S.view = v; BASELINE = Object.fromEntries(Engine.board().map(b => [b.a.r.id, b.total])); M._aff = null; gtoast('Prototipo reiniciado: la base volvió a su estado inicial.'); },
  tab(d) {
    if (d.s === 'orders') { S.m.screen = 'tracking'; S.m.stack = []; S.m._anim = true; return; }
    if (d.s === 'ofertas') return A.soon({ v: 'Ofertas' });
    if (d.s === 'home' && isRappiScreen(S.m.screen)) return A.enterMappi();
    S.m.screen = d.s; S.m.stack = []; S.m.notice = ''; S.m._anim = true; S.m.qDone = d.s === 'explore' ? S.m.qDone : false;
  },
  enterMappi() {
    S.m.screen = 'home'; S.m.stack = []; S.m._anim = true; Domain.enterMappi();
    // La primera vez se explica cómo se ganan las monedas
    const ses = DB.data.session; if (!ses.coinsIntro) { ses.coinsIntro = true; DB.persist(); S.m.sheet = 'coins'; }
  },
  enterMappiMap() { A.enterMappi(); S.m.sheet = null; S.m.screen = 'explore'; S.m.mode = 'map'; S.m.filter = 'cerca'; },
  openRestFromRappi(d) { Domain.enterMappi(); S.m.stack = ['home']; A.openRest(d); },
  soon(d) { toast(`${d.v || 'Esta sección'}: fuera del alcance del prototipo. Prueba MAPPI.`); S.m._keep = true; },
  sheet(d) { S.m.sheet = d.v; S.m._keep = true; },
  closeSheet() { S.m.sheet = null; S.m._keep = true; },
  recenter() { MapView.recenter('explore'); S.m._keep = true; },
  profTab(d) { S.m.profTab = d.v; S.m._keep = true; },
  taste(d) { const on = Domain.toggleTaste(d.v); M._aff = null; S.m._keep = true; toast(on ? `Agregaste "${d.v}" a tus gustos. Tus recomendaciones se actualizan.` : `Quitaste "${d.v}" de tus gustos.`); },
  back() { S.m.screen = S.m.stack.pop() || 'home'; S.m.notice = ''; S.m._anim = true; },
  dismissLast() { S.m.showLast = false; S.m._keep = true; },
  mode(d) { S.m.mode = d.v; S.m._keep = true; },
  filter(d) { S.m.filter = d.v; S.m.mode = 'map'; S.m._keep = true; },
  pin(d) { S.m.sel = d.r; S.m._keep = true; },
  pplTab(d) { S.m.pplTab = d.v; },
  openRest(d) { S.m.rest = d.r; S.m.tab = 'rappi'; S.m.notice = ''; S.m.allOps = false; go('ficha'); Domain.openRestaurant(d.r); },
  openStory(d) {
    const people = M.storyPeople().map(u => u.id); if (!people.includes(d.u)) people.unshift(d.u);
    S.m.story = { people, p: people.indexOf(d.u), j: 0 }; S.m.seen.add(d.u); go('story');
  },
  storyNav(d) {
    const st = S.m.story, n = M.storiesOf(st.people[st.p]).length;
    st.j += Number(d.v);
    if (st.j >= n) { st.p++; st.j = 0; }
    if (st.j < 0) { st.p--; st.j = st.p >= 0 ? M.storiesOf(st.people[st.p]).length - 1 : 0; }
    if (st.p < 0 || st.p >= st.people.length) return A.closeStory();
    S.m.seen.add(st.people[st.p]); S.m._anim = false;
  },
  closeStory() { clearTimeout(storyT); S.m.screen = S.m.stack.pop() || 'home'; if (S.m.screen === 'story') S.m.screen = 'home'; S.m._anim = true; },
  openPerson(d) { S.m.person = d.u; go('person'); Domain.openProfile(d.u); },
  follow(d) { S.m._keep = true; const u = DB.user(d.u); toast(Domain.toggleFollow(d.u) ? `Ahora sigues a ${u.name}. Verás lo que prueba en Inicio.` : `Dejaste de seguir a ${u.name}`); },
  rtab(d) { S.m.tab = d.v; S.m._keep = true; },
  allOps() { S.m.allOps = true; S.m._keep = true; },
  viewExt(d) { S.m._keep = true; Domain.viewExternal(d.r); toast('En la app real se abre el video en la red social.'); },
  save(d) { S.m._keep = true; const r = DB.rest(d.r); toast(Domain.toggleSave(d.r) ? `${r.name} quedó en "Quiero probar". Si lo pides y opinas, ganas 10 monedas de bono.` : 'Quitado de "Quiero probar"'); },
  share(d) {
    S.m._keep = true; const link = Domain.share(d.r);
    try { navigator.clipboard?.writeText(link).catch(() => {}); } catch (e) {}
    toast(`Enlace copiado: ${link}`);
  },
  order(d) { S.m.rest = d.r; S.m.pick = DB.dishesOf(d.r)[0].id; S.m.qty = 1; S.m.useCoupon = false; go('order'); Domain.openMenu(d.r); },
  pick(d) { S.m.pick = d.d; S.m._keep = true; },
  qty(d) { S.m.qty = Math.max(1, Math.min(9, S.m.qty + Number(d.v))); S.m._keep = true; },
  confirmOrder() { const m = S.m; Domain.placeOrder(m.rest, m.pick || DB.dishesOf(m.rest)[0].id, m.qty, m.useCoupon); m.stack = []; m.screen = 'tracking'; m._anim = true; },
  received() { Domain.receive(M.myOrders()[0].id); },
  skipReview() { S.m.stack = []; S.m.screen = 'home'; S.m.showLast = true; S.m._anim = true; Domain.skipReview(M.lastUnreviewed()?.restaurant_id); },
  reviewStart(d) { const prev = M.reviewFor(d.o); S.m.draft = { orderId: d.o, ans: prev ? 'si' : null, err: '' }; go('review'); },
  opineHere(d) {
    const o = Q.eligibleOrder(d.r);
    if (o) return A.reviewStart({ o: o.id });
    S.m.notice = Domain.rejectReview(d.r); S.m._keep = true;
  },
  // El corazón se marca y luego se confirma con "Dar me gusta"
  likeTap() { const dr = S.m.draft; dr.ans = dr.ans ? null : 'si'; dr.err = ''; S.m._keep = true; },
  publish() {
    const m = S.m, dr = m.draft, res = Domain.publishReview({ orderId: dr.orderId });
    if (res.error) { dr.err = res.error; m._keep = true; return; }
    m.lastResult = res; m.stack = []; m.screen = 'done'; m._anim = true; m.bump = res.kind === 'ok'; m.showLast = true;
  },
  redeemAsk(d) { S.m.confirm = d.b; S.m.notice = ''; S.m._keep = true; },
  redeemNo() { S.m.confirm = null; S.m._keep = true; },
  redeemOk(d) {
    const m = S.m; if (m.busy) return;
    m.busy = true; m._keep = true; render();
    setTimeout(() => {
      const fail = m.failRedeem; m.failRedeem = false;
      const res = Domain.redeem(d.b, { fail });
      m.busy = false; m.confirm = null; m._keep = true;
      m.notice = res.error || `Canje realizado. Tu ${res.benefit.title.toLowerCase()} está disponible.`;
      render();
    }, 700);
  },
  clearSearch() { S.m.q = ''; S.m.qDone = false; S.m._keep = true; },
  tourGo(d) { TOUR[Number(d.i)].go(); },
  focusRest(d) { S.m.rest = d.r; },
  radarRest(d) { A.view({ v: 'radar' }); A.ropen({ r: d.r }); },
  seeInMappi() { A.view({ v: 'mappi' }); S.m.screen = 'home'; S.m.stack = []; S.m._anim = true; },

  // Radar
  rpage(d) { S.r._anim = S.r._animChart = true; S.r.page = d.v; S.r.open = null; window.scrollTo({ top: 0 }); },
  ropen(d) { S.r._anim = S.r._animChart = true; S.r.open = d.r; S.r.chartId = d.r; S.r.form = { opt: '', action: '', owner: '', why: '', next: '' }; S.r.formErr = ''; window.scrollTo({ top: 0 }); Domain.radarOpen(d.r); },
  rclose() { S.r._anim = S.r._animChart = true; S.r.open = null; },
  rfilter(d) { S.r._anim = true; S.r.page = 'cartera'; S.r.open = null; S.r.fe = d.v; },
  rdef(d) { S.r.def = S.r.def === d.v ? null : d.v; },
  rzone(d) { S.r._anim = true; S.r.page = 'zonas'; S.r.open = null; S.r.zone = d.v; },
  rscroll(d) { if (S.r.def) { S.r.def = null; render(); }
    document.getElementById(d.v)?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }); return false; },
  rclear() { Object.assign(S.r, { fc: '', fk: '', fe: '', fq: '' }); },
  rsort(d) { S.r.sort = d.v; },
  zone(d) { S.r.zone = d.v; },
  rtable(d) { S.r.table = d.v; S.r.tq = ''; },
  dopt(d) { S.r.form.opt = d.v; S.r.formErr = ''; },
  daction(d) { S.r.form.action = d.v; S.r.formErr = ''; },
  decide(d) {
    const f = S.r.form, res = Domain.decide(d.r, f);
    if (res.error) { S.r.formErr = res.error; return; }
    S.r.formErr = '';
    gtoast(f.action === 'destacar' ? `Decisión guardada. ${DB.rest(d.r).name} ya aparece como "Destacado por Rappi" en MAPPI.` : 'Decisión guardada en Seguimiento.');
  },
  advance(d) { Domain.advance(d.d); },
  ruleApply() { const dr = S.r.ruleDraft; if (!dr) return; Domain.applyRule(dr); S.r.ruleDraft = null; gtoast('Regla aplicada. Los estados de la cartera se recalcularon.'); },
  ruleReset() { S.r.ruleDraft = { ...DB.data.rule_default }; },
  openCmd() { S.cmd = { q: '', i: 0 }; },
  closeCmd() { S.cmd = null; },
  cmdRun(d) { const it = S.cmd.items[Number(d.i ?? S.cmd.i)]; S.cmd = null; it?.run(); },
  closeExport() { S.exportBox = null; },
  copyExport() {
    const t = S.exportBox.text;
    try { navigator.clipboard.writeText(t).then(() => { gtoast('Copiado al portapapeles.'); render(); }, () => { const el = document.getElementById('exp-text'); el?.select(); }); } catch (e) { document.getElementById('exp-text')?.select(); }
  },
  saveExport() { const b = S.exportBox; saveFile(b.name, b.text, b.type); },
  exportDB() { download('mappi-radar-db.json', JSON.stringify(DB.data, null, 2)); },
  exportTable() { const t = S.r.table; if (!(DB.data[t] || []).length) return gtoast(`La tabla ${t} está vacía: no hay filas que exportar.`); download(`${t}.csv`, toCSV(DB.data[t]), 'text/csv'); },
  exportCartera() { download('cartera-radar.csv', toCSV(Engine.board().map(b => ({ aliado: b.a.r.name, comuna: b.a.r.comuna, categoria: b.a.r.cat, estado: ESTADO[b.a.estado][0], puntaje: b.total, confianza: b.conf, fuentes_creciendo: b.a.grow.join(' '), pedidos_8_semanas: b.a.ordersGrowth + '%' }))), 'text/csv'); },
  exportDecisions() { download('decisiones-radar.csv', toCSV(DB.data.decisions.map(d => ({ aliado: DB.rest(d.restaurant_id).name, decision: d.option, accion: d.action ? ACTIONS[d.action] : '', responsable: d.owner, fecha: d.date, etapa: d.stage, motivo: d.why, proximo_paso: d.next, resultado: d.result || '' }))), 'text/csv'); },
};

/* ---------- Eventos del DOM ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-a]'); if (!t || t.matches('input')) return;
  const rc = t.getBoundingClientRect(); lastClick = { x: rc.left + rc.width / 2, y: rc.top + rc.height / 2 };
  if (t.disabled) return;
  const fn = A[t.dataset.a]; if (!fn) return;
  e.preventDefault();
  if (fn(t.dataset) === false) return; // acciones que no necesitan redibujar (por ejemplo, desplazarse)
  render();
});
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); S.cmd = S.cmd ? null : { q: '', i: 0 }; render(); return; }
  if (S.cmd) {
    if (e.key === 'Escape') { S.cmd = null; render(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); S.cmd.i = Math.max(0, Math.min(S.cmd.items.length - 1, S.cmd.i + (e.key === 'ArrowDown' ? 1 : -1))); render(); return; }
    if (e.key === 'Enter') { e.preventDefault(); A.cmdRun({}); render(); return; }
  }
  if (e.key === 'Escape' && S.exportBox) { S.exportBox = null; render(); return; }
  const t = e.target; if ((e.key === 'Enter' || e.key === ' ') && t.matches('tr[data-a], g[data-a]')) { e.preventDefault(); A[t.dataset.a](t.dataset); render(); }
});
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-form]'); if (!f) return; e.preventDefault();
  const q = (new FormData(f).get('q') || '').toString().trim(); if (!q) return;
  S.m.q = q; S.m.qDone = true;
  if (f.dataset.form === 'rsearch') { S.m.screen = 'explore'; S.m.stack = []; S.m._anim = true; }
  Domain.search(q);
  render();
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'fail') { S.m.failRedeem = t.checked; return; }
  if (t.dataset.a2 === 'public') { Domain.setPublic(t.checked); S.m._keep = true; toast(t.checked ? 'Tu perfil ahora es público.' : 'Tu perfil ahora es privado.'); render(); return; }
  if (t.dataset.a === 'cpn') { S.m.useCoupon = t.checked; S.m._keep = true; render(); return; }
  if (t.dataset.f && t.tagName === 'SELECT') { S.r[t.dataset.f] = t.value; if (t.dataset.f === 'chartId') S.r._animChart = true; render(); return; }
  if (t.dataset.f2) S.r.form[t.dataset.f2] = t.value;
});
let inputT;
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'cmdk-q') { S.cmd.q = t.value; S.cmd.i = 0; render(); return; }
    if (t.dataset.f2) S.r.form[t.dataset.f2] = t.value;
  if (t.dataset.rule) { (S.r.ruleDraft ||= { ...DB.data.rule })[t.dataset.rule] = Number(t.value); clearTimeout(inputT); inputT = setTimeout(() => { const y = window.scrollY; render(); window.scrollTo(0, y); const el = document.querySelector(`[data-rule="${t.dataset.rule}"]`); el?.focus(); }, 120); }
  if (t.dataset.f && t.type === 'search') { S.r[t.dataset.f] = t.value; clearTimeout(inputT); inputT = setTimeout(() => { render(); const el = document.querySelector(`[data-f="${t.dataset.f}"]`); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 200); }
});
window.addEventListener('hashchange', () => { const v = location.hash.replace('#', ''); if (['mappi', 'conectado', 'radar'].includes(v) && v !== S.view) { S.view = v; render(); } });

// Ingesta simulada de señales externas mientras se mira la portada de Radar
setInterval(() => {
  if (S.view !== 'radar' || S.r.open || S.r.page !== 'signals' || document.hidden) return;
  const s = DB.data.session, t = DB.data.signal_ticker[s.tick++ % DB.data.signal_ticker.length];
  s.radarFeed.unshift({ id: 't' + s.tick, ts: DB.nowISO(), restaurant_id: t.restaurant_id, source: t.source, text: t.text, delta: t.delta, neg: !!t.neg, mappi: false, fresh: true });
  s.radarFeed = s.radarFeed.slice(0, 40); DB.persist();
  const el = document.getElementById('feed'); if (!el) return;
  el.innerHTML = feedHTML(); el.scrollTo({ top: 0, behavior: 'smooth' });
  const n = document.getElementById('feed-count'); if (n) n.textContent = s.radarFeed.length;
  const u = document.getElementById('feed-upd'); if (u) u.textContent = clockS();
  s.radarFeed.forEach(f => f.fresh = false);
}, 7000);

MapView.onEngineChange = () => render();
MapView.init();
render();
// La hora de la barra de estado se actualiza cada 30 s
setInterval(() => { const el = $('#sb-time'); if (el) el.textContent = new Date().toLocaleTimeString('es-CL', { hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }); }, 30000);
