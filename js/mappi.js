/* ================= MAPPI · app del usuario =================
   MAPPI vive dentro de Rappi y aprovecha comportamientos que el usuario ya tiene:
   descubrir, guardar, pedir y dar me gusta. Agrega una sola idea nueva: seguir a personas con
   gustos parecidos ("perfiles afines"). Cada acción queda como evento para Radar. */

const SCREEN_INFO = {
  raccount:{ st: 'Entrada', t: 'Cuenta de Rappi', d: 'MAPPI se integra a la cuenta que el usuario ya conoce: las Monedas MAPPI aparecen junto a Créditos y Cupones, y desde aquí se llega al perfil.' },
  profile: { st: 'Confiar', t: 'Tu perfil en MAPPI', d: 'El usuario controla su identidad: si su perfil es público, sus gustos y los platos a los que dio me gusta. Desde aquí también se entiende cómo ganar monedas.' },
  rappi:   { st: 'Entrada', t: 'MAPPI dentro de Rappi', d: 'El usuario no descarga nada nuevo: MAPPI aparece como una sección de la app de Rappi, con lo que prueban personas de gustos parecidos.' },
  home:    { st: 'Descubrir', t: 'Inicio de MAPPI', d: 'La franja de monedas y el botón ? explican cómo se ganan los puntos. Recomendaciones de perfiles afines con compra verificada. Si hay un pedido reciente sin opinar, aparece "Tu último pedido": el punto de entrada más natural para opinar.' },
  explore: { st: 'Descubrir', t: 'Mapa real, lista y búsqueda', d: 'Mapa real (OpenStreetMap o Google Maps). "Cerca de ti" acerca el mapa a lo que está a pocas cuadras. El número del pin son me gusta con compra verificada de esta semana y "Cómo llegar" abre Google Maps. Las búsquedas sin resultado llegan a Radar como demanda sin oferta.' },
  people:  { st: 'Confiar', t: 'Perfiles afines', d: 'La pertenencia nace de la identificación: "personas como yo". La afinidad se calcula con gustos, restaurantes en común y comuna. Seguir a alguien es una señal de confianza para Radar.' },
  story:   { st: 'Confiar', t: 'Historias de perfiles afines', d: 'Lo que probaron personas con gustos como los tuyos, en formato de historia: una recomendación con compra verificada por tarjeta. Desde aquí se guarda o se abre el lugar sin salir del flujo.' },
  person:  { st: 'Confiar', t: 'Perfil de una persona', d: 'Solo se muestran me gusta con compra verificada. Así la recomendación se siente auténtica y no publicidad.' },
  ficha:   { st: 'Descubrir y elegir', t: 'Ficha del restaurante', d: 'Contenido de dos orígenes, siempre identificados: me gusta "En Rappi" con compra verificada y contenido externo "En redes". Guardar, compartir y abrir el menú son señales de intención.' },
  order:   { st: 'Pedir', t: 'Menú y pedido', d: 'No se realiza cobro. Si el usuario canjeó un cupón, puede aplicarlo aquí. El pedido suma a la serie de pedidos de Radar.' },
  tracking:{ st: 'Pedir', t: 'Estado del pedido', d: 'Al recibir el pedido se invita a dar me gusta. Solo se puede dar me gusta a lo que se compró.' },
  review:  { st: 'Me gusta y ganar', t: 'Me gusta después de probar', d: 'Un solo gesto: me gusta. No hay comentarios ni texto abierto, porque en la entrevista Rappi advirtió que a las marcas no les gustan. Solo se puede dar me gusta a un plato recibido (compra verificada).' },
  done:    { st: 'Me gusta y ganar', t: 'Confirmación', d: 'Las monedas se acreditan una vez por plato de un pedido. El usuario ve en qué ayudó su me gusta.' },
  wallet:  { st: 'Canjear y volver', t: 'Mis Monedas MAPPI', d: 'Saldo, beneficios e historial. El canje pide confirmación, descuenta una sola vez y, si falla, no toca el saldo.' },
};

/* ---------- Consultas de MAPPI ---------- */
const M = {
  following() { return Q.following(); },
  saved() { return Q.saved(); },
  balance() { return Q.balance(); },
  weekRewards() { return Q.weekRewards(); },
  _aff: null,
  affinity(uid) {
    if (!this._aff || this._aff.rev !== DB.data.orders.length) this._aff = { rev: DB.data.orders.length, map: {} };
    return this._aff.map[uid] ||= Engine.affinity('u_me', uid);
  },
  publicPeople() { return DB.data.users.filter(u => u.public); },
  reviewsOf(rid) { return DB.data.reviews.filter(r => r.restaurant_id === rid).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)); },
  verifiedWeek(rid) { return Q.verifiedWeek(rid); },
  dishStats(did) { return Q.dishStats(did); },
  topDish(rid) { return Q.topDish(rid); },
  // Personas que sigo o con alta afinidad que recomiendan este restaurante
  trustedFor(rid) {
    const fol = this.following();
    const ids = [...new Set(DB.data.reviews.filter(r => r.restaurant_id === rid && r.answer === 'si').map(r => r.user_id))];
    return ids.map(id => DB.user(id)).filter(u => u.public).map(u => ({ u, f: fol.has(u.id), a: this.affinity(u.id).pct }))
      .filter(x => x.f || x.a >= 70).sort((x, y) => (y.f - x.f) || (y.a - x.a));
  },
  // Personas para las historias: primero a quienes sigo, luego perfiles con alta afinidad
  storyPeople() {
    const fol = this.following();
    return this.publicPeople().filter(u => this.storiesOf(u.id).length && (fol.has(u.id) || this.affinity(u.id).pct >= 72))
      .sort((a, b) => (fol.has(b.id) - fol.has(a.id)) || (this.affinity(b.id).pct - this.affinity(a.id).pct)).slice(0, 8);
  },
  storiesOf(uid) { return DB.data.reviews.filter(r => r.user_id === uid && r.answer !== 'no').sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 3); },
  // Lo que más guardan personas con gustos parecidos (al menos 2 gustos en común) o a quienes sigo
  trending() {
    const mine = new Set(DB.me().tastes), fol = this.following(), now = DB.nowMs();
    const like = u => fol.has(u.id) || u.tastes.filter(t => mine.has(t)).length >= 2;
    const count = {};
    DB.data.saves.forEach(s => { if (s.user_id !== 'u_me' && now - Date.parse(s.created_at) < 14 * DAY && like(DB.user(s.user_id))) count[s.restaurant_id] = (count[s.restaurant_id] || 0) + 1; });
    return Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => ({ r: DB.rest(id), n }));
  },
  lastUnreviewed() { return Q.lastUnreviewed(); },
  reviewFor(oid) { return Q.reviewFor(oid); },
  myOrders() { return Q.myOrders(); },
  highlights() { return Q.highlights(); },
  norm: s => Q.norm(s),
  search(q) { return Q.search(q); },

};

function navRoot(s) {
  if (s === 'wallet') return 'wallet';
  if (s === 'profile') return 'profile';
  if (s === 'people' || s === 'person') return 'people';
  if (['explore', 'ficha', 'order', 'tracking'].includes(s)) return 'explore';
  return 'home';
}
const RAPPI_SCREENS = ['rappi', 'raccount'];
const isRappiScreen = s => RAPPI_SCREENS.includes(s);

/* Partes del teléfono que cambian con cada pantalla. La carcasa (isla, barra
   de estado, indicador de inicio) es fija y está en index.html. */
function phoneParts() {
  const m = S.m, isRappi = isRappiScreen(m.screen);
  const nav = isRappi
    ? [['rappi', 'Inicio', icon('house')], ['ofertas', 'Ofertas', icon('percent')], ['home', 'MAPPI', icon('map-pin-fill'), true], ['raccount', 'Cuenta', icon('user-circle')]]
    : [['home', 'Inicio', icon('house')], ['explore', 'Mapa', icon('map-trifold')], ['people', 'Personas', icon('users-three')], ['wallet', 'Monedas', coin(22)], ['profile', 'Perfil', icon('user-circle')]];
  const cur = isRappi ? m.screen : navRoot(m.screen);
  return {
    screen: `<div class="${m._anim ? 'screen-in' : ''}">${SCREENS[m.screen]()}</div>`,
    nav: nav.map(([s, l, ic, isNew]) => `<button data-a="tab" data-s="${s}" aria-current="${cur === s}">${ic}<span>${l}</span>${isNew ? '<span class="badge-new">Nuevo</span>' : ''}</button>`).join(''),
    toast: m.toast ? `<div class="toast" role="status">${icon('check-circle')}<span>${esc(m.toast)}</span></div>` : '',
    sheet: m.sheet ? SHEETS[m.sheet]() : '',
    full: m.screen === 'story',
    rappi: isRappi,
  };
}

/* ---------- Hojas inferiores ---------- */
const SHEETS = {
  // Explica cómo se ganan y canjean las Monedas MAPPI (feedback: "no se explica cómo se ganan los puntos")
  coins() {
    const bal = M.balance(), bens = [...DB.data.benefits].sort((a, b) => a.cost - b.cost), nx = bens.find(b => b.cost > bal);
    const step = (n, ic, t, d, pts) => `<li class="how"><span class="how-n">${n}</span><span class="how-ic">${icon(ic)}</span><span class="how-t"><b>${t}</b><span>${d}</span></span>${pts ? `<span class="how-pts">${coin(16)}${pts}</span>` : ''}</li>`;
    return `<div class="sheet-bg" data-a="closeSheet"></div>
    <div class="bsheet" role="dialog" aria-modal="true" aria-labelledby="coins-t">
      <span class="grab" aria-hidden="true"></span>
      <div class="bs-head">${coin(44)}<div><h3 id="coins-t">Así ganas Monedas MAPPI</h3><p class="fine">Dale me gusta a lo que pides en Rappi y canjea beneficios.</p></div></div>
      <ol class="how-list">
        ${step(1, 'shopping-bag', 'Pide en Rappi como siempre', 'Cuando tu pedido llega, puedes darle me gusta.', '')}
        ${step(2, 'heart', 'Dale me gusta al plato', 'Un toque, sin escribir nada. Solo a platos que recibiste.', '+20')}
        ${step(3, 'bookmark-simple', 'Prueba lo que guardaste', 'Si el lugar estaba en "Quiero probar" antes de pedir, ganas un bono.', '+10')}
        ${step(4, 'ticket', 'Canjea tus monedas', bens.map(b => `${b.cost} = ${b.title.toLowerCase()}`).join(' · '), '')}
      </ol>
      <div class="bs-rules">${icon('info')}<span>Máximo ${WEEKLY_REWARD_CAP} me gusta premiados cada 7 días. Solo a pedidos recibidos (compra verificada). Las monedas no son dinero.</span></div>
      <div class="bs-bal"><span>Tu saldo: <b class="num">${bal}</b></span>${nx ? `<span class="fine">Te faltan ${nx.cost - bal} para ${esc(nx.title.toLowerCase())}</span>` : '<span class="fine">Ya puedes canjear</span>'}</div>
      <button class="btn btn-primary btn-block" data-a="closeSheet">Entendido</button>
    </div>`;
  },
};

function restCard(rid) {
  const r = DB.rest(rid), t = M.topDish(rid), tr = M.trustedFor(rid);
  return `<button class="rcard" data-a="openRest" data-r="${rid}">
    ${poster(r, 'img')}
    <div class="body"><div class="rname">${esc(r.name)}</div><div class="rmeta">${esc(r.cat)}, ${String(r.dist_km).replace('.', ',')} km</div>
      <div class="dish-line">${esc(t.d.name)}</div>
      ${tr.length ? `<div class="by"><span class="avatars">${tr.slice(0, 3).map(x => avatar(x.u, 'sm')).join('')}</span><span><b>${esc(tr[0].u.name)}</b>${tr.length > 1 ? ` y ${tr.length - 1} más` : ''} le gusta${tr.length > 1 ? 'n' : ''}</span></div>`
        : `<span class="verif likes">${icon('heart-fill')}${t.s.si} me gusta</span>`}
    </div></button>`;
}

const SCREENS = {
  /* ---------- Inicio de Rappi (punto de entrada, basado en la app real) ---------- */
  rappi() {
    const fol = [...M.following()].map(id => DB.user(id));
    const near = DB.data.restaurants.filter(r => r.dist_km <= 1.6).sort((a, b) => a.dist_km - b.dist_km).slice(0, 6);
    const eta = r => Math.round(14 + r.dist_km * 9);
    const fee = r => r.dist_km < 1 ? 'Envío gratis' : clp(490 + Math.round(r.dist_km * 4) * 100);
    const stars = r => (4.3 + ([...r.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 7) / 10).toFixed(1).replace('.', ',');
    return `<div class="pad r-home">
      <div class="r-top"><div><div class="fine">${esc(CONFIG.ME.city)}</div><button class="r-addr" data-a="soon" data-v="Cambiar dirección">${esc(CONFIG.ME.address)}${icon('caret-down')}</button></div>
        <button class="r-bell" data-a="soon" data-v="Notificaciones" aria-label="Notificaciones">${icon('bell')}</button></div>
      <form class="r-search" data-form="rsearch" role="search">${icon('magnifying-glass')}<input type="search" name="q" placeholder="¿Qué quieres hoy?" aria-label="Buscar en Rappi"></form>
      <div class="r-cats">
        <button class="r-cat big" data-a="soon" data-v="Restaurantes"><span class="r-ill" style="--c:#FFE6DE">${icon('hamburger-duotone')}</span><b>Restaurantes</b></button>
        <button class="r-cat big turbo" data-a="soon" data-v="Turbo"><span class="r-ill" style="--c:#DDF6E5">${icon('lightning-fill')}<em>10 min</em></span><b>Turbo</b></button>
        <button class="r-cat" data-a="soon" data-v="Supermercado"><span class="r-ill" style="--c:#FFF3D6">${icon('shopping-bag')}</span><b>Super</b></button>
        <button class="r-cat" data-a="soon" data-v="Farmacia"><span class="r-ill" style="--c:#E3EEFF">${icon('plus')}</span><b>Farmacia</b></button>
        <button class="r-cat" data-a="soon" data-v="Retail"><span class="r-ill" style="--c:#F3E8FF">${icon('storefront')}</span><b>Retail</b></button>
      </div>
      <button class="mappi-banner" data-a="enterMappi">
        <span class="mb-pin" aria-hidden="true">${icon('map-pin-fill')}</span>
        <span class="mb-tx"><span class="mb-tag">Nuevo en Rappi</span><b>MAPPI: lo que piden personas como tú</b><span>${fol.length ? esc(fol.slice(0, 2).map(u => u.name).join(' y ')) + ' y otros recomendaron 6 lugares esta semana.' : 'Recomendaciones de personas con gustos parecidos.'} Opina y gana monedas.</span></span>
        <span class="mb-go">Ver ${icon('arrow-right')}</span>
      </button>
      <div class="sec-h">Cerca de ti <button class="more" data-a="enterMappiMap">Ver en el mapa</button></div>
      <div class="carousel" tabindex="0" role="region" aria-label="Restaurantes cerca">${near.map(r => `<button class="r-card" data-a="openRestFromRappi" data-r="${r.id}">
          <span class="r-photo">${PHOTOS.has(r.id) ? `<span class="ph-${r.id}"></span>` : `<span style="background:${grad(r)}"></span>`}${M.verifiedWeek(r.id) ? `<span class="r-badge">${icon('seal-check-fill')}${M.verifiedWeek(r.id)} en MAPPI</span>` : ''}</span>
          <b>${esc(r.name)}</b>
          <span class="r-meta">${icon('lightning-fill')}${eta(r)} min · ${fee(r)} · ${icon('star-fill')}${stars(r)}</span>
        </button>`).join('')}</div>
      <div class="r-pro"><div><b>Rappi <span>Pro</span></b><span class="fine">Envíos gratis y beneficios exclusivos</span></div><button class="btn btn-sm btn-violet" data-a="soon" data-v="Rappi Pro">Conocer</button></div>
      <p class="fine center" style="margin-top:14px">Vista simulada de Rappi para el prototipo. Solo MAPPI es interactivo.</p>
    </div>`;
  },

  /* ---------- Cuenta de Rappi (con acceso a MAPPI) ---------- */
  raccount() {
    const me = DB.me(), last = M.myOrders()[0];
    return `<div class="pad">
      <div class="m-top" style="align-items:center"><button class="icon-btn" data-a="tab" data-s="rappi" aria-label="Volver">${icon('arrow-left')}</button><h2 class="m-h sm" style="flex:1">Cuenta</h2></div>
      <button class="acc-user" data-a="tab" data-s="profile">${avatar(me)}<span><b>${esc(me.name)} ${esc(me.initial)}.</b><span class="fine">Ver perfil MAPPI ›</span></span></button>
      <div class="acc-tiles">
        <button data-a="tab" data-s="orders">${icon('receipt')}<span>Pedidos</span></button>
        <button data-a="soon" data-v="Ayuda">${icon('question')}<span>Ayuda</span></button>
        <button data-a="soon" data-v="Medios de pago">${icon('ticket')}<span>Medios de pago</span></button>
      </div>
      ${last ? `<div class="sec-h">Pedidos recientes</div><button class="list-row" data-a="tab" data-s="orders">${thumb(DB.rest(last.restaurant_id))}<div style="flex:1;min-width:0"><div class="rname">${esc(DB.rest(last.restaurant_id).name)}</div><div class="rmeta">${ago(last.created_at)}</div></div>${icon('caret-right')}</button>` : ''}
      <div class="sec-h">Beneficios</div>
      <div class="acc-list">
        <button data-a="soon" data-v="Créditos">${icon('coins')}<span>Créditos</span><b>$0</b></button>
        <button data-a="soon" data-v="Cupones">${icon('ticket')}<span>Cupones</span>${icon('caret-right')}</button>
        <button data-a="tab" data-s="wallet" class="hl">${coin(20)}<span>Monedas MAPPI <span class="tag t-acc">Nuevo</span></span><b class="num">${M.balance()}</b></button>
        <button data-a="sheet" data-v="coins">${icon('question')}<span>¿Cómo gano monedas?</span>${icon('caret-right')}</button>
      </div>
      <div class="sec-h">Presentación</div>
      <div class="acc-list">
        <button data-a="view" data-v="radar">${icon('broadcast')}<span>Ver Radar (equipo Rappi)</span>${icon('caret-right')}</button>
        <button data-a="reset">${icon('arrows-clockwise')}<span>Reiniciar prototipo</span>${icon('caret-right')}</button>
      </div>
    </div>`;
  },

  /* ---------- Perfil propio en MAPPI (feedback: "falta el usuario/cuenta/perfil") ---------- */
  profile() {
    const m = S.m, me = DB.me(), fol = M.following(), saved = [...M.saved()];
    const revs = DB.data.reviews.filter(r => r.user_id === 'u_me').sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    const followers = DB.data.follows.filter(x => x.followee_id === 'u_me').length;
    const allTastes = [...new Set(DB.data.users.flatMap(u => u.tastes))].sort();
    const tab = m.profTab || 'opiniones';
    const since = new Date(me.joined + 'T12:00:00').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
    return `<div class="pad">
      <div class="m-top" style="align-items:center"><div><div class="m-kicker">Tu cuenta</div><h2 class="m-h sm">Perfil</h2></div>
        <button class="coin-pill" data-a="tab" data-s="wallet" aria-label="Mis Monedas MAPPI: ${M.balance()}">${coin(22)}<span class="num">${M.balance()}</span></button></div>
      <div class="prof-card">
        ${avatar(me, 'lg')}
        <div class="pc-tx"><b>${esc(me.name)} ${esc(me.initial)}.</b><span>${me.age} años · ${esc(me.comuna)}</span><span class="fine">En MAPPI desde ${since}</span></div>
      </div>
      <div class="stats four"><div><b class="num">${revs.length}</b><span>me gusta</span></div><div><b class="num">${followers}</b><span>seguidores</span></div><div><b class="num">${fol.size}</b><span>siguiendo</span></div><div><b class="num">${saved.length}</b><span>guardados</span></div></div>
      <label class="toggle card pub">
        <input type="checkbox" data-a2="public" ${me.public ? 'checked' : ''}>
        <span><b>Perfil público</b><span class="fine">${me.public ? 'Personas afines pueden seguirte y ver tus recomendaciones.' : 'Solo tú ves tus me gusta con tu nombre. Actívalo para que otros te sigan.'}</span></span>
      </label>
      <div class="sec-h">Mis gustos <small>toca para cambiar</small></div>
      <div class="tastes left">${allTastes.map(t => `<button class="chip" data-a="taste" data-v="${esc(t)}" aria-pressed="${me.tastes.includes(t)}">${esc(t)}</button>`).join('')}</div>
      <button class="earn-strip" data-a="sheet" data-v="coins">${coin(26)}<span><b>+20 monedas por cada me gusta</b><span>¿Cómo funciona?</span></span>${icon('caret-right')}</button>
      <div class="seg" role="group" aria-label="Contenido del perfil" style="margin-top:16px">
        <button data-a="profTab" data-v="opiniones" aria-pressed="${tab === 'opiniones'}">Me gusta (${revs.length})</button>
        <button data-a="profTab" data-v="guardados" aria-pressed="${tab === 'guardados'}">Quiero probar (${saved.length})</button>
        <button data-a="profTab" data-v="pedidos" aria-pressed="${tab === 'pedidos'}">Pedidos</button>
      </div>
      <div style="margin-top:6px">
      ${tab === 'opiniones' ? (revs.length ? revs.map(r => { const rs = DB.rest(r.restaurant_id); return `<button class="list-row" data-a="openRest" data-r="${rs.id}">${thumb(rs)}<div style="flex:1;min-width:0"><div class="rname" style="font-size:14px">${esc(rs.name)}</div><div class="rmeta">${esc(DB.dish(r.dish_id).name)}, ${ago(r.created_at)}</div></div><span class="like-pill">${icon('heart-fill')}</span></button>`; }).join('')
          : `<div class="empty">${icon('heart')}<b>Aún no das me gusta</b>Cuando recibas un pedido, dale me gusta si te gustó y gana 20 monedas.</div>`)
        : tab === 'guardados' ? (saved.length ? saved.map(id => { const r = DB.rest(id), t = M.topDish(id); return `<button class="list-row" data-a="openRest" data-r="${id}">${thumb(r)}<div style="flex:1;min-width:0"><div class="rname">${esc(r.name)}</div><div class="rmeta">${esc(r.cat)}, ${String(r.dist_km).replace('.', ',')} km</div><div class="dish-line">${esc(t.d.name)}</div></div>${icon('caret-right')}</button>`; }).join('')
          : `<div class="empty">${icon('bookmark-simple')}<b>Nada guardado</b>Toca "Quiero probar" en un restaurante. Si después lo pides y opinas, ganas 10 monedas de bono.</div>`)
        : (M.myOrders().length ? M.myOrders().slice(0, 8).map(o => { const r = DB.rest(o.restaurant_id), d = DB.dish(o.dish_id), rv = M.reviewFor(o.id); return `<div class="list-row">${thumb(r)}<div style="flex:1;min-width:0"><div class="rname" style="font-size:14px">${o.qty} × ${esc(d.name)}</div><div class="rmeta">${esc(r.name)}, ${ago(o.created_at)}</div></div>${rv ? `<span class="like-pill">${icon('heart-fill')}</span>` : o.status === 'recibido' ? `<button class="btn btn-sm btn-primary" data-a="reviewStart" data-o="${o.id}">${icon('heart')}Me gusta</button>` : `<span class="tag t-mut">En camino</span>`}</div>`; }).join('')
          : `<div class="empty">${icon('receipt')}<b>Sin pedidos</b></div>`)}
      </div>
      <div class="acc-list" style="margin-top:18px">
        <button data-a="tab" data-s="rappi">${icon('arrow-left')}<span>Volver a Rappi</span>${icon('caret-right')}</button>
      </div>
    </div>`;
  },

  home() {
    const m = S.m, last = M.lastUnreviewed(), me = DB.me();
    const lr = last && DB.rest(last.restaurant_id), ld = last && DB.dish(last.dish_id);
    const people = M.storyPeople(), fol = M.following(), trend = M.trending(), hl = M.highlights();
    const ids = ['azafran', 'humo', 'omu', 'tostado', 'guera', 'hua'];
    return `<div class="pad">
      <div class="m-top"><div><button class="rappi-link" data-a="tab" data-s="rappi">${icon('caret-left')}Volver a Rappi</button><div class="m-kicker">Hola, ${esc(me.name)}</div><h2 class="m-h">Descubre qué probar</h2></div>
        <div class="top-acts"><button class="coin-pill ${m.bump ? 'bump' : ''}" data-a="tab" data-s="wallet" aria-label="Mis Monedas MAPPI: ${M.balance()}">${coin(22)}<span class="num">${M.balance()}</span></button>
        <button class="help-dot" data-a="sheet" data-v="coins" aria-label="¿Cómo gano monedas?">${icon('question')}</button></div></div>
      ${people.length ? `<div class="stories" aria-label="Historias de perfiles afines">${people.map(u => `<button class="story-bubble ${m.seen.has(u.id) ? 'seen' : ''}" data-a="openStory" data-u="${u.id}" aria-label="Ver historia de ${esc(uname(u))}"><span class="ring">${avatar(u)}</span><span class="nm">${esc(u.name)}</span><span class="pc">${fol.has(u.id) ? 'Lo sigues' : M.affinity(u.id).pct + '% afín'}</span></button>`).join('')}
        <button class="story-bubble add" data-a="tab" data-s="people" aria-label="Buscar más perfiles"><span class="ring">${icon('user-plus')}</span><span class="nm">Más</span><span class="pc">perfiles</span></button></div>`
        : `<div class="empty card">${icon('users-three')}<b>Todavía no sigues a nadie</b>Sigue perfiles afines para ver qué están probando.<button class="btn btn-violet btn-sm" data-a="tab" data-s="people">Buscar perfiles</button></div>`}
      ${last && m.showLast ? '' : `<button class="earn-strip" data-a="sheet" data-v="coins">${coin(26)}<span><b>Dale me gusta a tus pedidos y gana +20</b><span>Canjéalas por cupones y envío gratis. ¿Cómo funciona?</span></span>${icon('caret-right')}</button>`}
      ${last && m.showLast ? `<div class="last">
        <div class="last-row">${thumb(lr)}<div style="flex:1;min-width:0"><div class="last-kicker">Tu último pedido</div><div class="rname">${esc(ld.name)}</div><div class="rmeta">${esc(lr.name)}, recibido ${ago(last.created_at)}</div></div></div>
        <p style="font-size:14px">¿Te gustó? Dale me gusta y gana <b>20 Monedas MAPPI</b>. <button class="link" data-a="sheet" data-v="coins">¿Cómo funciona?</button></p>
        <div class="btn-row"><button class="btn btn-primary" data-a="reviewStart" data-o="${last.id}">${icon('heart')}Me gusta</button><button class="btn btn-line" data-a="dismissLast">Ahora no</button></div>
      </div>` : ''}
      ${hl.map(id => { const r = DB.rest(id), t = M.topDish(id); return `<div class="featured fade-in">
        <div class="lab">${icon('megaphone')}Destacado por Rappi. No es una recomendación de personas.</div>
        <div class="last-row">${thumb(r)}<div style="flex:1"><div class="rname">${esc(r.name)}</div><div class="rmeta">${esc(t.d.name)}, ${clp(t.d.price)}</div></div><button class="btn btn-line btn-sm" data-a="openRest" data-r="${id}">Ver</button></div></div>`; }).join('')}
      ${trend.length ? `<div class="sec-h">Guardado por personas como tú <small>14 días</small></div>
      <ol class="trend">${trend.map((x, i) => { const t = M.topDish(x.r.id); return `<li><button data-a="openRest" data-r="${x.r.id}"><span class="rank">${i + 1}</span>${poster(x.r, 'sq')}<span class="tx"><b>${esc(x.r.name)}</b><span>${esc(t.d.name)}</span><span class="cnt">${icon('bookmark-simple-fill')}${plural(x.n, 'persona lo guardó', 'personas lo guardaron')}</span></span>${icon('caret-right')}</button></li>`; }).join('')}</ol>` : ''}
      <button class="map-entry" data-a="tab" data-s="explore">
        <div class="mini" data-map="mini">${MapView.engine === 'svg' ? mapSVG() + [['azafran', 64, 52], ['humo', 40, 40], ['omu', 82, 70]].map(([id, x, y]) => `<span class="pin" style="left:${x}%;top:${y}%"><span class="bub">${icon('seal-check-fill')}${M.verifiedWeek(id)}</span><span class="tip"></span></span>`).join('') : ''}</div>
        <div class="lbl"><div><div class="rname">Explora en el mapa</div><div class="rmeta">Lugares cerca con me gusta verificados</div></div><span style="color:var(--accent)">${icon('arrow-right')}</span></div>
      </button>
      <div class="sec-h">Recomendado cerca de ti <small>por personas que compraron</small></div>
      <div class="carousel" tabindex="0" role="region" aria-label="Recomendados cerca de ti">${ids.map(restCard).join('')}</div>
    </div>`;
  },

  story() {
    const st = S.m.story, u = DB.user(st.people[st.p]), list = M.storiesOf(u.id), r = list[Math.min(st.j, list.length - 1)];
    const rs = DB.rest(r.restaurant_id), d = DB.dish(r.dish_id), af = M.affinity(u.id), saved = M.saved().has(rs.id);
    Domain.viewStory(r, u.id);
    return `<div class="story" style="--g1:${rs.grad[0]};--g2:${rs.grad[1]}">
      ${icon(glyph(rs), 'story-bg')}
      <div class="story-bar" aria-hidden="true">${list.map((_, i) => `<span class="seg ${i < st.j ? 'done' : i === st.j ? 'now' : ''}"><i></i></span>`).join('')}</div>
      <div class="story-head"><button data-a="openPerson" data-u="${u.id}" class="who">${avatar(u)}<span><b>${esc(uname(u))}</b><span>${af.pct}% afín, ${ago(r.created_at)}</span></span></button><button class="story-x" data-a="closeStory" aria-label="Cerrar historia">${icon('x')}</button></div>
      <button class="tap prev" data-a="storyNav" data-v="-1" aria-label="Historia anterior"></button><button class="tap next" data-a="storyNav" data-v="1" aria-label="Historia siguiente"></button>
      <div class="story-body">
        <span class="seal">${icon('seal-check-fill')}Compra verificada</span>
        <div class="story-like">${icon('heart-fill')}<span>Le gustó</span></div>
        <q class="story-q">${esc(d.name)}</q>
        <div class="story-rest">${thumb(rs)}<span><b>${esc(rs.name)}</b><span>${esc(d.name)}, ${clp(d.price)}</span></span></div>
      </div>
      <div class="story-actions"><button class="btn ${saved ? 'btn-glass on' : 'btn-glass'}" data-a="save" data-r="${rs.id}" aria-pressed="${saved}">${icon(saved ? 'bookmark-simple-fill' : 'bookmark-simple')}${saved ? 'Guardado' : 'Quiero probar'}</button><button class="btn btn-primary" data-a="openRest" data-r="${rs.id}">Ver lugar ${icon('arrow-right')}</button></div>
    </div>`;
  },

  explore() {
    const m = S.m, saved = M.saved(), fol = M.following(), mine = new Set(DB.me().tastes);
    DB.data.restaurants.filter(r => r.dist_km <= 3.5).forEach(r => Domain.impression(r.id));
    let ids = DB.data.restaurants.map(r => r.id);
    const searching = m.q && m.qDone;
    if (searching) ids = M.search(m.q);
    else {
      if (m.filter === 'cerca') ids = ids.filter(id => DB.rest(id).dist_km <= 3.5);
      if (m.filter === 'gustos') ids = ids.filter(id => DB.rest(id).tags.some(t => mine.has(t)));
      if (m.filter === 'siguen') ids = ids.filter(id => DB.data.reviews.some(r => r.restaurant_id === id && r.answer === 'si' && fol.has(r.user_id)));
      if (m.filter === 'guardados') ids = ids.filter(id => saved.has(id));
    }
    ids.sort((a, b) => DB.rest(a).dist_km - DB.rest(b).dist_km);
    const sel = ids.includes(m.sel) ? m.sel : ids[0];
    const emptyMsg = searching
      ? `<div class="empty">${icon('magnifying-glass')}<b>Sin resultados para "${esc(m.q)}"</b>Lo anotamos: las búsquedas sin resultado le muestran a Rappi qué se busca y todavía no está en la app.<button class="btn btn-line btn-sm" data-a="clearSearch">Limpiar búsqueda</button></div>`
      : m.filter === 'guardados' ? `<div class="empty">${icon('bookmark-simple')}<b>Aún no guardas lugares</b>Toca "Quiero probar" en la ficha de un restaurante para tenerlo aquí.</div>`
      : `<div class="empty">${icon('users-three')}<b>Nada por aquí todavía</b>Sigue a más perfiles afines para ver sus recomendaciones.</div>`;
    const row = id => { const r = DB.rest(id), t = M.topDish(id); return `<button class="list-row" data-a="openRest" data-r="${id}">${thumb(r)}<div style="flex:1;min-width:0"><div class="rname">${esc(r.name)}${saved.has(id) ? ` <span style="color:var(--accent)">${icon('bookmark-simple-fill')}</span>` : ''}</div><div class="rmeta">${esc(r.cat)}, ${esc(r.comuna)}, ${String(r.dist_km).replace('.', ',')} km</div><div class="dish-line">${esc(t.d.name)}</div></div><span class="verif">${icon('seal-check-fill')}${M.verifiedWeek(id)}</span></button>`; };
    const pinHTML = (id, isSel) => `<span class="pin ${isSel ? 'sel' : ''}" role="button" aria-label="${esc(DB.rest(id).name)}, ${M.verifiedWeek(id)} me gusta verificados esta semana"><span class="bub">${icon('seal-check-fill')}${M.verifiedWeek(id)}</span><span class="tip"></span>${isSel ? `<span class="nm">${esc(DB.rest(id).name)}</span>` : ''}</span>`;
    // "Cerca de ti" acerca el mapa a lo que está a pocas cuadras (feedback de la entrevista)
    const near = ids.filter(id => DB.rest(id).dist_km <= 1.6);
    const fitIds = m.filter === 'cerca' ? (near.length ? near : ids.slice(0, 4)) : ids;
    M._exploreMap = { items: ids.map(id => ({ id, html: pinHTML(id, id === sel), sel: id === sel })), focus: sel,
      fitKey: `${m.filter}|${ids.join(',')}`, fit: { ids: fitIds, maxZoom: m.filter === 'cerca' ? 16 : 14 } };
    const live = MapView.engine !== 'svg';
    const body = !ids.length ? emptyMsg
      : (m.mode === 'map' && !searching) ? `<div class="map" data-map="explore">
          ${live ? '' : `${mapSVG()}<div class="me" style="left:50%;top:50%" aria-label="Tu ubicación"></div>
          ${ids.filter(id => DB.rest(id).dist_km <= 3.5 && (M.verifiedWeek(id) > 0 || id === sel)).map(id => { const r = DB.rest(id); return `<button class="pin ${id === sel ? 'sel' : ''}" style="left:${Math.min(92, Math.max(8, r.x))}%;top:${Math.min(84, Math.max(14, r.y))}%" data-a="pin" data-r="${id}" aria-label="${esc(r.name)}, ${M.verifiedWeek(id)} me gusta verificados esta semana"><span class="bub">${icon('seal-check-fill')}${M.verifiedWeek(id)}</span><span class="tip"></span>${id === sel ? `<span class="nm">${esc(r.name)}</span>` : ''}</button>`; }).join('')}`}
          ${live ? `<button class="map-fab" data-a="recenter" aria-label="Volver a mi ubicación">${icon('crosshair')}</button>` : ''}
          <div class="map-legend">${icon('seal-check-fill')}<span>Número = me gusta con compra verificada esta semana</span></div></div>
          <div class="map-src">${esc(MapView.label())}</div>
          ${sel ? (() => { const r = DB.rest(sel), t = M.topDish(sel), tr = M.trustedFor(sel); return `<div class="card sheet"><button class="sheet-main" data-a="openRest" data-r="${sel}">${thumb(r)}<div style="flex:1;min-width:0"><div class="rname">${esc(r.name)}</div><div class="rmeta">${esc(r.cat)}, ${String(r.dist_km).replace('.', ',')} km</div><div class="dish-line">${esc(t.d.name)}</div>${tr.length ? `<div class="by" style="margin-top:3px"><span class="avatars">${tr.slice(0, 3).map(x => avatar(x.u, 'sm')).join('')}</span><b>${esc(tr[0].u.name)}</b>${tr.length > 1 ? ` y ${tr.length - 1} más` : ''}</div>` : ''}</div></button>
            <div class="sheet-acts"><a class="btn btn-sm btn-line" href="${GEO.directions(sel)}" target="_blank" rel="noopener">${icon('map-pin')}Cómo llegar</a><button class="btn btn-sm btn-primary" data-a="openRest" data-r="${sel}">Ver lugar</button></div></div>`; })() : ''}`
      : ids.map(row).join('');
    return `<div class="pad">
      <div class="m-top"><div><div class="m-kicker">Mapa</div><h2 class="m-h">¿Qué probamos hoy?</h2></div></div>
      <form class="searchbar" data-form="search" role="search"><span class="muted">${icon('magnifying-glass')}</span><input type="search" name="q" value="${esc(m.q)}" placeholder="Plato, cocina o restaurante" aria-label="Buscar en MAPPI">${m.q ? `<button type="button" class="btn btn-sm btn-soft" data-a="clearSearch">Limpiar</button>` : `<button class="btn btn-sm btn-primary" type="submit">Buscar</button>`}</form>
      ${searching ? `<p class="fine" style="margin:10px 0">${plural(ids.length, 'resultado', 'resultados')} para "${esc(m.q)}"</p>` : `
      <div class="seg" role="group" aria-label="Vista" style="margin-top:12px"><button data-a="mode" data-v="map" aria-pressed="${m.mode === 'map'}">Mapa</button><button data-a="mode" data-v="list" aria-pressed="${m.mode === 'list'}">Lista</button></div>
      <div class="chips">${[['cerca', 'Cerca de ti'], ['siguen', 'De quienes sigues'], ['gustos', 'Tus gustos'], ['guardados', `Quiero probar (${saved.size})`]].map(([f, l]) => `<button class="chip" data-a="filter" data-v="${f}" aria-pressed="${m.filter === f}">${l}</button>`).join('')}</div>`}
      ${body}
    </div>`;
  },

  people() {
    const m = S.m, fol = M.following();
    const list = m.pplTab === 'sigues' ? [...fol].map(id => DB.user(id))
      : M.publicPeople().filter(u => !fol.has(u.id)).sort((a, b) => M.affinity(b.id).pct - M.affinity(a.id).pct).slice(0, 12);
    return `<div class="pad">
      <div class="m-top"><div><div class="m-kicker">Personas</div><h2 class="m-h">Perfiles afines</h2></div></div>
      <p class="fine" style="margin-bottom:12px">Personas que piden parecido a ti. Solo ves me gusta de lo que compraron en Rappi.</p>
      <div class="seg" role="group" aria-label="Lista de personas"><button data-a="pplTab" data-v="sugeridos" aria-pressed="${m.pplTab !== 'sigues'}">Sugeridos</button><button data-a="pplTab" data-v="sigues" aria-pressed="${m.pplTab === 'sigues'}">Sigues (${fol.size})</button></div>
      ${list.length ? list.map(u => { const af = M.affinity(u.id), f = fol.has(u.id), n = DB.data.reviews.filter(r => r.user_id === u.id).length; return `<div class="person">
        <button data-a="openPerson" data-u="${u.id}" style="display:flex;gap:12px;align-items:center;flex:1;min-width:0">${avatar(u)}<div class="info"><div class="rname" style="font-size:14px">${esc(uname(u))} <span class="aff">${af.pct}%</span></div><div class="why">${esc(af.reasons[0] || `${u.age} años, ${u.comuna}`)}</div><div class="fine">${plural(n, 'me gusta verificado', 'me gusta verificados')}</div></div></button>
        <button class="btn btn-sm ${f ? 'btn-soft' : 'btn-violet'}" data-a="follow" data-u="${u.id}" aria-pressed="${f}">${f ? icon('user-check') + 'Siguiendo' : icon('user-plus') + 'Seguir'}</button></div>`; }).join('')
        : `<div class="empty">${icon('users-three')}<b>Aún no sigues a nadie</b>Mira los sugeridos: tienen gustos parecidos a los tuyos.</div>`}
    </div>`;
  },

  person() {
    const u = DB.user(S.m.person), af = M.affinity(u.id), f = M.following().has(u.id);
    const revs = DB.data.reviews.filter(r => r.user_id === u.id).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    const followers = DB.data.follows.filter(x => x.followee_id === u.id).length;
    return `<div class="pad">
      <div class="m-top"><button class="icon-btn" data-a="back" aria-label="Volver">${icon('caret-left')}</button></div>
      <div class="prof-head">${avatar(u, 'lg')}<h2>${esc(uname(u))}</h2><div class="rmeta">${u.age} años, ${esc(u.comuna)}${u.bio ? `. ${esc(u.bio)}` : ''}</div>
        <div class="tastes">${u.tastes.map(t => `<span class="tag ${DB.me().tastes.includes(t) ? 't-vio' : 't-mut'}">${esc(t)}</span>`).join('')}</div>
        <button class="btn ${f ? 'btn-soft' : 'btn-violet'}" data-a="follow" data-u="${u.id}" aria-pressed="${f}" style="margin-top:6px">${f ? icon('user-check') + 'Siguiendo' : icon('user-plus') + 'Seguir'}</button></div>
      <div class="aff-big"><div style="display:flex;justify-content:space-between;align-items:baseline"><span class="pct">${af.pct}%</span><span class="fine">de afinidad contigo</span></div>
        ${af.reasons.length ? `<ul>${af.reasons.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="fine">Tienen pocos gustos en común.</p>'}</div>
      <div class="stats"><div><b class="num">${revs.length}</b><span>me gusta verificados</span></div><div><b class="num">${followers}</b><span>seguidores</span></div><div><b class="num">${new Set(revs.map(r => r.restaurant_id)).size}</b><span>lugares probados</span></div></div>
      <div class="sec-h">Le gustó</div>
      ${revs.length ? revs.slice(0, 8).map(r => { const rs = DB.rest(r.restaurant_id); return `<button class="list-row" data-a="openRest" data-r="${rs.id}">${thumb(rs)}<div style="flex:1;min-width:0"><div class="rname" style="font-size:14px">${esc(rs.name)}</div><div class="rmeta">${esc(DB.dish(r.dish_id).name)}, ${ago(r.created_at)}</div></div><span class="like-pill">${icon('heart-fill')}</span></button>`; }).join('')
        : `<div class="empty">${icon('heart')}<b>Todavía no da me gusta</b></div>`}
    </div>`;
  },

  ficha() {
    const m = S.m, id = m.rest, r = DB.rest(id), saved = M.saved().has(id), tr = M.trustedFor(id), hl = M.highlights().includes(id);
    const dishList = DB.dishesOf(id).map(d => ({ d, n: M.dishStats(d.id).si })).sort((a, b) => b.n - a.n), maxL = Math.max(1, ...dishList.map(x => x.n));
    const dishes = dishList.map(({ d, n }) => `<div class="card dish">
      <div class="dish-top"><span class="dish-name">${esc(d.name)}</span><span class="num" style="font-size:13px;color:var(--muted)">${clp(d.price)}</span></div>
      <div class="like-row"><span class="like-bar"><i style="width:${n / maxL * 100}%"></i></span><span class="like-n">${icon('heart-fill')}<b class="num">${n}</b> me gusta</span></div></div>`).join('');
    const ops = M.reviewsOf(id), fol = M.following();
    ops.sort((a, b) => (fol.has(b.user_id) - fol.has(a.user_id)) || ((b.user_id === 'u_me') - (a.user_id === 'u_me')) || (Date.parse(b.created_at) - Date.parse(a.created_at)));
    const ext = DB.data.external_content.filter(c => c.restaurant_id === id);
    const tab = m.tab === 'rappi'
      ? (ops.slice(0, m.allOps ? 50 : 5).map(o => { const u = DB.user(o.user_id); return `<div class="like-item"><button class="op-who" data-a="${u.public ? 'openPerson' : ''}" data-u="${u.id}">${avatar(u, 'sm')}<span><b>${esc(uname(u))}</b>${fol.has(u.id) ? ' <span class="aff">Lo sigues</span>' : ''}<span class="rmeta">Le gustó ${esc(DB.dish(o.dish_id).name)}, ${ago(o.created_at)}</span></span></button><span class="seal" title="Compra verificada">${icon('seal-check-fill')}</span><span class="like-pill">${icon('heart-fill')}</span></div>`; }).join('')
        + (ops.length > 5 && !m.allOps ? `<button class="btn btn-soft btn-block btn-sm" data-a="allOps">Ver los ${ops.length} me gusta</button>` : '')
        + `<button class="btn btn-line btn-block" style="margin-top:10px" data-a="opineHere" data-r="${id}">${icon('heart')}¿Lo probaste? Dale me gusta</button>${m.notice ? `<div class="notice err" role="alert" style="margin-top:8px">${icon('warning')}<span>${m.notice}</span></div>` : ''}`)
      : (ext.length ? `<div style="margin:10px 0"><span class="tag t-warn">Contenido de ejemplo</span></div>` + ext.map(t => `<button class="tk" data-a="viewExt" data-r="${id}" style="width:100%;text-align:left"><span class="tk-vid" style="background:linear-gradient(160deg,${r.grad[0]},#111)">${icon('play-fill')}</span><span style="display:grid;gap:4px;align-content:start"><b style="font-size:14px;display:flex;gap:5px;align-items:center">${icon(t.network + '-logo')}${esc(t.handle)}</b><span style="font-size:14px">${esc(t.title)}</span><span class="rmeta">${esc(t.views)} reproducciones. Contenido externo, sin compra verificada.</span></span></button>`).join('')
        : `<div class="empty">${icon('tiktok-logo')}<b>Sin contenido en redes</b>Este restaurante aún no aparece en redes. Puedes guiarte por los me gusta de quienes compraron.</div>`);
    const from = Math.min(...DB.dishesOf(id).map(x => x.price));
    return `${PHOTOS.has(id) ? `<div class="hero photo ph-${id}">` : `<div class="hero" style="background:${grad(r)}">${icon(glyph(r), 'bg-ic')}`}
        <button class="back" data-a="back" aria-label="Volver">${icon('caret-left')}</button>
        <div><h2>${esc(r.name)}</h2><div class="sub">${esc(r.cat)}, ${esc(r.comuna)}, ${String(r.dist_km).replace('.', ',')} km</div></div></div>
      <div class="pad">
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px"><span class="tag t-good">${icon('heart-fill')}${plural(M.verifiedWeek(id), 'me gusta verificado', 'me gusta verificados')} esta semana</span>${hl ? `<span class="tag t-mut">${icon('megaphone')}Destacado por Rappi</span>` : ''}</div>
        ${tr.length ? `<button class="trust" data-a="openPerson" data-u="${tr[0].u.id}"><span class="avatars">${tr.slice(0, 4).map(x => avatar(x.u, 'sm')).join('')}</span><span><b>${esc(tr[0].u.name)}</b>${tr.length > 1 ? ` y ${plural(tr.length - 1, 'perfil afín', 'perfiles afines')}` : ''} le${tr.length > 1 ? 's' : ''} gusta${tr[0].f ? '' : `, ${tr[0].a}% afín`}</span></button>` : ''}
        <div class="actions">
          <button class="btn ${saved ? 'btn-soft' : 'btn-line'}" data-a="save" data-r="${id}" aria-pressed="${saved}" style="${saved ? 'color:var(--accent)' : ''}">${saved ? icon('bookmark-simple-fill') + 'Guardado' : icon('bookmark-simple') + 'Quiero probar'}</button>
          <button class="btn btn-line" data-a="share" data-r="${id}">${icon('share-network')}Compartir</button>
        </div>
        <div class="loc card"><span class="loc-ic">${icon('map-pin-fill')}</span><span class="loc-tx"><b>${esc(r.comuna)} · ${String(r.dist_km).replace('.', ',')} km de ti</b><span class="fine">Unos ${Math.max(3, Math.round(r.dist_km * 13))} min caminando · dirección referencial</span></span>
          <a class="btn btn-sm btn-line" href="${GEO.directions(id)}" target="_blank" rel="noopener">Cómo llegar</a></div>
        <div class="sec-h" style="margin-top:6px">Platos con más me gusta</div>
        ${dishes}
        <div class="seg" style="margin-top:16px" role="group" aria-label="Origen del contenido"><button data-a="rtab" data-v="rappi" aria-pressed="${m.tab === 'rappi'}">Me gusta en Rappi (${ops.length})</button><button data-a="rtab" data-v="redes" aria-pressed="${m.tab === 'redes'}">En redes (${ext.length})</button></div>
        ${tab}
        <div class="cta-bar"><span><b class="num">${clp(from)}</b><span>platos desde, envío ${clp(1290)}</span></span><button class="btn btn-primary" data-a="order" data-r="${id}">${icon('shopping-bag')}Ver menú y pedir</button></div>
      </div>`;
  },

  order() {
    const m = S.m, r = DB.rest(m.rest), ds = DB.dishesOf(m.rest), pick = m.pick || ds[0].id, d = DB.dish(pick);
    const sub = d.price * m.qty, cp = DB.data.coupons.find(c => !c.used), canCp = cp && sub >= cp.min, disc = (m.useCoupon && canCp) ? cp.discount : 0, ship = 1290;
    return `<div class="pad">
      <div class="m-top" style="align-items:center"><button class="icon-btn" data-a="back" aria-label="Volver">${icon('caret-left')}</button>
        <div style="flex:1"><div class="m-kicker">Menú</div><h2 class="m-h sm">${esc(r.name)}</h2></div></div>
      ${ds.map(x => { const s = M.dishStats(x.id); return `<button class="menu-item" data-a="pick" data-d="${x.id}" aria-pressed="${x.id === pick}"><span class="radio"></span><span style="flex:1"><span class="rname" style="display:block;font-size:14px">${esc(x.name)}</span><span class="verif likes">${icon('heart-fill')}${s.si} me gusta</span></span><span class="num" style="font-weight:700">${clp(x.price)}</span></button>`; }).join('')}
      <div style="display:flex;justify-content:space-between;align-items:center;margin:14px 0"><span class="lbl" style="margin:0">Cantidad</span>
        <div class="stepper"><button data-a="qty" data-v="-1" aria-label="Quitar uno">${icon('minus')}</button><span class="num" style="min-width:28px;text-align:center;font-weight:700">${m.qty}</span><button data-a="qty" data-v="1" aria-label="Agregar uno">${icon('plus')}</button></div></div>
      ${cp ? `<label class="toggle card" style="padding:12px;${canCp ? '' : 'opacity:.6'}"><input type="checkbox" data-a="cpn" ${m.useCoupon && canCp ? 'checked' : ''} ${canCp ? '' : 'disabled'}> Usar ${esc(cp.title.toLowerCase())} ${canCp ? '' : `<span class="fine">(pedido mínimo ${clp(cp.min)})</span>`}</label>` : ''}
      <div class="card sum" style="margin-top:12px">
        <div class="sum-row"><span>Subtotal</span><span class="num">${clp(sub)}</span></div>
        <div class="sum-row"><span>Envío</span><span class="num">${clp(ship)}</span></div>
        ${disc ? `<div class="sum-row" style="color:var(--good)"><span>Beneficio Monedas MAPPI</span><span class="num">-${clp(disc)}</span></div>` : ''}
        <div class="sum-row" style="font-weight:800"><span>Total</span><span class="num">${clp(sub + ship - disc)}</span></div>
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:14px" data-a="confirmOrder">Confirmar pedido</button>
      <p class="fine" style="margin-top:8px;text-align:center">Prototipo: no se realiza cobro ni envío.</p>
    </div>`;
  },

  tracking() {
    const o = M.myOrders()[0];
    if (!o) return `<div class="pad"><div class="m-top"><div><div class="m-kicker">Pedidos</div><h2 class="m-h sm">Sin pedidos</h2></div></div><div class="empty">${icon('receipt')}<b>Todavía no tienes pedidos</b><button class="btn btn-primary btn-sm" data-a="tab" data-s="explore">Explorar</button></div></div>`;
    const r = DB.rest(o.restaurant_id), d = DB.dish(o.dish_id), rec = o.status === 'recibido', rv = M.reviewFor(o.id);
    return `<div class="pad">
      <div class="m-top"><div><div class="m-kicker">Tu pedido</div><h2 class="m-h sm">${rec ? 'Pedido recibido' : 'Pedido confirmado'}</h2></div></div>
      <div class="card" style="padding:14px;display:flex;gap:12px;align-items:center">${thumb(r)}<div><div class="rname">${o.qty} × ${esc(d.name)}</div><div class="rmeta">${esc(r.name)}${o.coupon ? ', con beneficio aplicado' : ''}</div></div></div>
      <div class="track">${['Pedido confirmado', 'En preparación y en camino', 'Recibido'].map((t, i) => `<div class="tstep ${(i < 2 || rec) ? 'done' : ''}"><span class="tdot">${(i < 2 || rec) ? icon('check') : ''}</span><div><b style="font-size:14px">${t}</b>${i === 1 && !rec ? '<div class="fine">Llega en 25 a 35 min</div>' : ''}</div></div>`).join('')}</div>
      ${!rec ? `<button class="btn btn-primary btn-block" data-a="received">Marcar como recibido</button><p class="fine" style="margin-top:8px;text-align:center">En la app real esto ocurre solo, al entregar el pedido.</p>`
        : rv ? `<div class="notice ok">${icon('heart-fill')}<span>Le diste me gusta a este plato. ¡Gracias!</span></div><div class="btn-row" style="margin-top:10px"><button class="btn btn-line" data-a="tab" data-s="home">Volver al inicio</button></div>`
        : `<div class="last"><b>¿Ya lo probaste?</b><p style="font-size:14px">Si te gustó, dale me gusta y gana 20 Monedas MAPPI.</p><div class="btn-row"><button class="btn btn-primary" data-a="reviewStart" data-o="${o.id}">${icon('heart')}Sí, ya lo probé</button><button class="btn btn-line" data-a="skipReview">Ahora no</button></div></div>`}
    </div>`;
  },

  /* ---------- Me gusta (sin comentarios) ---------- */
  review() {
    const m = S.m, dr = m.draft, o = DB.data.orders.find(x => x.id === dr.orderId), r = DB.rest(o.restaurant_id), d = DB.dish(o.dish_id), prev = M.reviewFor(o.id);
    const savedBefore = DB.data.saves.some(s => s.user_id === 'u_me' && s.restaurant_id === o.restaurant_id && Date.parse(s.created_at) <= Date.parse(o.created_at));
    const n = M.dishStats(d.id).si;
    return `<div class="pad">
      <div class="m-top" style="align-items:center"><button class="icon-btn" data-a="back" aria-label="Volver">${icon('caret-left')}</button><div style="flex:1"><div class="m-kicker">Tu pedido</div><h2 class="m-h sm">¿Te gustó?</h2></div></div>
      <div class="like-hero">
        <span class="like-thumb">${thumb(r)}</span>
        <b>${esc(d.name)}</b><span class="rmeta">${esc(r.name)} · ${plural(n, 'persona le dio me gusta', 'personas le dieron me gusta')}</span>
        ${prev ? `<div class="like-big on" aria-hidden="true">${icon('heart-fill')}</div><p class="fine">Ya le diste me gusta a este plato.</p>`
          : `<button class="like-big ${dr.ans ? 'on' : ''}" data-a="likeTap" aria-pressed="${!!dr.ans}" aria-label="Me gusta">${icon(dr.ans ? 'heart-fill' : 'heart')}</button><p class="fine">${dr.ans ? 'Me gusta' : 'Toca el corazón'}</p>`}
      </div>
      ${prev ? '' : `<div class="last" style="gap:6px"><b style="display:flex;gap:8px;align-items:center">${coin(20)}Gana 20 Monedas MAPPI${savedBefore ? ' + 10 de bono' : ''}</b><p style="font-size:13.5px">Solo se da me gusta a platos que recibiste, así cada uno viene de una compra real.${savedBefore ? ' El bono es porque probaste un lugar que tenías guardado.' : ''} <button class="link" data-a="sheet" data-v="coins">¿Cómo funciona?</button></p></div>`}
      ${dr.err ? `<div class="notice err" role="alert" style="margin-top:8px">${icon('warning')}<span>${dr.err}</span></div>` : ''}
      ${prev ? `<button class="btn btn-line btn-block" style="margin-top:12px" data-a="tab" data-s="home">Volver al inicio</button>`
        : `<button class="btn btn-primary btn-block" style="margin-top:12px" data-a="publish" ${dr.ans ? '' : 'disabled'}>${icon('heart-fill')}Dar me gusta</button>
      <button class="btn btn-block" style="margin-top:6px;color:var(--muted)" data-a="skipReview">No me gustó / ahora no</button>`}
      <p class="fine" style="margin-top:10px">Sin comentarios: tu me gusta se muestra con el sello Compra verificada.</p>
    </div>`;
  },

  done() {
    const x = S.m.lastResult, r = DB.rest(x.rid), sc = Engine.score(x.rid);
    const burst = `<span class="burst" aria-hidden="true">${[...Array(10)].map((_, i) => `<span style="--i:${i}">${coin(16)}</span>`).join('')}</span>`;
    const head = x.kind === 'ok' ? `<div class="big-coin">${burst}${coin(84)}</div><h2 class="m-h">Sumaste ${x.coins} Monedas MAPPI</h2><p>Tu saldo es <b class="num">${M.balance()}</b>.${x.bonus ? ' Incluye 10 de bono por probar un lugar que tenías guardado.' : ''}</p>`
      : x.kind === 'limit' ? `<div class="big-coin">${coin(64)}</div><h2 class="m-h sm">Me gusta publicado</h2><p>Esta vez no suma monedas: llegaste al máximo de 3 me gusta premiados en 7 días.</p>`
      : `<h2 class="m-h sm">Ya le habías dado me gusta</h2><p>No suma monedas nuevas.</p>`;
    const followers = DB.data.follows.filter(f => f.followee_id === 'u_me').length;
    return `<div class="done-wrap">${head}
      <div class="card like-done">${icon('heart-fill')}<span>Le diste me gusta a <b>${esc(DB.dish(DB.data.reviews.filter(r => r.user_id === 'u_me').slice(-1)[0]?.dish_id)?.name || r.name)}</b></span></div>
      <div class="ripple"><b style="font-size:13.5px">Tu me gusta ayuda a</b>
        <div class="ln">${icon('users-three')}<span>Personas con gustos como los tuyos${followers ? `, incluidas ${followers} que te siguen` : ''}</span></div>
        <div class="ln">${icon('storefront')}<span>${esc(r.name)} a saber qué funciona y qué mejorar</span></div></div>
      <div class="btn-row" style="justify-content:center"><button class="btn btn-primary" data-a="tab" data-s="wallet">Ver mis monedas</button><button class="btn btn-line" data-a="tab" data-s="explore">Seguir explorando</button></div></div>`;
  },

  wallet() {
    const m = S.m, bal = M.balance();
    const pend = DB.data.reviews.filter(r => r.user_id === 'u_me' && r.status === 'en_revision').map(r => ({ t: `Me gusta, ${DB.rest(r.restaurant_id).name}`, a: 'En revisión', kind: 'pend', at: r.created_at }));
    const hist = [...DB.data.wallet_ledger.filter(l => l.user_id === 'u_me').map(l => ({ t: l.reason, a: (l.delta > 0 ? '+' : '') + l.delta, kind: l.delta > 0 ? 'in' : 'out', at: l.created_at })), ...pend].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    return `<div class="pad">
      <div class="m-top"><div><div class="m-kicker">Billetera</div><h2 class="m-h">Mis Monedas MAPPI</h2></div></div>
      ${(() => { const nx = DB.data.benefits.filter(b => b.cost > bal).sort((a, b) => a.cost - b.cost)[0]; return `<div class="wallet-hero"><p>Saldo disponible</p><div class="bal">${coin(38)}<span class="num">${bal}</span></div>
        ${nx ? `<div class="goal"><div class="goal-t"><span>Te faltan <b>${nx.cost - bal}</b> para ${esc(nx.title.toLowerCase())}</span><span class="num">${bal}/${nx.cost}</span></div><div class="goal-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${nx.cost}" aria-valuenow="${bal}" aria-label="Avance al siguiente beneficio"><i style="width:${Math.round(bal / nx.cost * 100)}%"></i></div></div>` : `<p>Puedes canjear cualquier beneficio.</p>`}</div>`; })()}
      ${m.notice ? `<div class="notice ${m.notice.startsWith('No pudimos') ? 'err' : 'ok'}" role="status" style="margin-top:10px">${icon(m.notice.startsWith('No pudimos') ? 'warning' : 'check-circle')}<span>${m.notice}</span></div>` : ''}
      <div class="sec-h">Cómo ganar <button class="more" data-a="sheet" data-v="coins">Ver explicación</button></div>
      <div class="earn"><div><b>+20 por me gusta</b>A un plato que recibiste</div><div><b>+10 de bono</b>Si pruebas un lugar que guardaste</div><div><b>Sin escribir</b>Un toque, sin comentarios</div><div><b>Máximo 3</b>Me gusta premiados cada 7 días (llevas ${M.weekRewards()})</div></div>
      <div class="sec-h">Beneficios</div>
      ${DB.data.benefits.map(b => { const can = bal >= b.cost;
        if (m.confirm === b.id) return `<div class="confirm"><b>Canjear ${b.cost} monedas por este beneficio</b><p style="font-size:13.5px">${esc(b.title)}. ${esc(b.detail)}.</p><div class="btn-row"><button class="btn btn-primary" data-a="redeemOk" data-b="${b.id}" ${m.busy ? 'disabled' : ''}>${m.busy ? 'Canjeando...' : 'Confirmar canje'}</button><button class="btn btn-line" data-a="redeemNo">Cancelar</button></div></div>`;
        return `<div class="card benefit"><span style="color:var(--accent)">${icon('ticket')}</span><div class="t"><div class="rname" style="font-size:14px">${esc(b.title)}</div><div class="rmeta">${esc(b.detail)}</div>${can ? '' : `<div class="fine">Te faltan ${b.cost - bal} monedas</div>`}</div><button class="btn btn-sm ${can ? 'btn-primary' : 'btn-soft'}" data-a="redeemAsk" data-b="${b.id}" ${can ? '' : 'disabled aria-disabled="true"'}>${coin(16)}<span class="num">${b.cost}</span></button></div>`; }).join('')}
      <div class="sec-h">Mis beneficios</div>
      ${DB.data.coupons.length ? DB.data.coupons.map(c => `<div class="coupon ${c.used ? 'used' : ''}"><b>${esc(c.title)}</b><span class="rmeta">${esc(c.detail)}</span><span class="tag ${c.used ? 't-mut' : 't-good'}" style="justify-self:start">${c.used ? 'Usado' : 'Disponible'}</span>${c.used ? '' : `<button class="btn btn-line btn-sm" style="justify-self:start;margin-top:4px" data-a="tab" data-s="explore">Usar en un pedido</button>`}</div>`).join('')
        : `<div class="empty" style="padding:16px">${icon('gift')}<b>Aún no tienes beneficios</b>Cuando canjees monedas, tus cupones aparecerán aquí.</div>`}
      <div class="sec-h">Historial</div>
      ${hist.map(h => `<div class="hist"><div><div>${esc(h.t)}</div><div class="fine">${ago(h.at)}</div></div><span class="amt num" style="color:${h.kind === 'in' ? 'var(--good)' : h.kind === 'out' ? 'var(--accent)' : 'var(--muted)'}">${h.a}</span></div>`).join('')}
      <p class="fine" style="margin-top:12px">Las monedas no son dinero y no se retiran. Valores ilustrativos, por validar con Rappi.</p>
    </div>`;
  },
};

/* Después de dibujar la pantalla, monta los mapas reales en sus huecos */
function afterRenderMaps() {
  if (S.m.screen === 'explore' && M._exploreMap) {
    MapView.show('explore', { ...M._exploreMap, onPick: id => { A.pin({ r: id }); render(); } });
  }
  if (S.m.screen === 'home') {
    const ids = ['azafran', 'humo', 'omu', 'burger', 'poke'];
    MapView.show('mini', { interactive: false, fitKey: 'mini', fit: { ids, maxZoom: 15 },
      items: ids.map(id => ({ id, html: `<span class="pin"><span class="bub">${icon('seal-check-fill')}${M.verifiedWeek(id)}</span><span class="tip"></span></span>` })) });
  }
}

function mapSVG() {
  return `<svg class="base" viewBox="0 0 360 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="360" height="400" style="fill:var(--map-bg)"/>
    ${[...Array(6)].map((_, i) => [...Array(7)].map((_, j) => `<rect x="${8 + i * 60}" y="${8 + j * 58}" width="48" height="46" rx="4" style="fill:var(--map-block)"/>`).join('')).join('')}
    <path d="M-10 70 C 80 40, 160 110, 240 70 S 380 60, 380 60" style="stroke:var(--map-water)" stroke-width="16" fill="none"/>
    <ellipse cx="110" cy="250" rx="46" ry="30" style="fill:var(--map-park)"/>
    <ellipse cx="292" cy="150" rx="34" ry="24" style="fill:var(--map-park)"/>
    ${[60, 120, 180, 240, 300].map(x => `<line x1="${x - 4}" y1="0" x2="${x - 4}" y2="400" style="stroke:var(--map-road)" stroke-width="7"/>`).join('')}
    ${[58, 116, 174, 232, 290, 348].map(y => `<line x1="0" y1="${y - 4}" x2="360" y2="${y - 4}" style="stroke:var(--map-road)" stroke-width="7"/>`).join('')}
    <path d="M0 330 L 360 120" style="stroke:var(--map-road)" stroke-width="12"/>
  </svg>`;
}

