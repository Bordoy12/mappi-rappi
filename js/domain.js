/* ================= Capa de dominio compartida =================
   Todas las interfaces (MAPPI + Radar v2 y MAPPI MVP 2.0) leen y escriben la base a través de
   este archivo. Aquí viven las reglas del negocio: compra verificada, monedas, límites, canjes,
   decisiones y regla de alerta. Las pantallas solo deciden cómo mostrarlo.
   En producción, cada operación de Domain se convierte en un endpoint (ver docs/ARQUITECTURA.md). */

/* ---------- Bus: avisa a la interfaz de cada evento registrado ---------- */
const Bus = {
  fns: [],
  on(fn) { this.fns.push(fn); },
  emit(ev) { this.fns.forEach(fn => { try { fn(ev); } catch (e) { console.error(e); } }); },
};

/* ---------- Consultas comunes ---------- */
const Q = {
  norm: s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(),
  following(uid = 'u_me') { return new Set(DB.data.follows.filter(f => f.follower_id === uid).map(f => f.followee_id)); },
  saved(uid = 'u_me') { return new Set(DB.data.saves.filter(s => s.user_id === uid).map(s => s.restaurant_id)); },
  balance(uid = 'u_me') { return DB.data.wallet_ledger.filter(l => l.user_id === uid).reduce((a, l) => a + l.delta, 0); },
  weekRewards(uid = 'u_me') { const now = DB.nowMs(); return DB.data.wallet_ledger.filter(l => l.user_id === uid && l.kind !== 'bonus' && l.delta > 0 && now - Date.parse(l.created_at) < 7 * DAY).length; },
  reviewFor(oid) { return DB.data.reviews.find(r => r.order_id === oid); },
  myOrders(uid = 'u_me') { return DB.data.orders.filter(o => o.user_id === uid).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)); },
  lastUnreviewed(uid = 'u_me') { return this.myOrders(uid).find(o => o.status === 'recibido' && !this.reviewFor(o.id)); },
  eligibleOrder(rid, uid = 'u_me') { return this.myOrders(uid).find(o => o.restaurant_id === rid && o.status === 'recibido' && !this.reviewFor(o.id)); },
  highlights() { return DB.data.decisions.filter(d => d.action === 'destacar').map(d => d.restaurant_id); },
  decisionFor(rid) { return DB.data.decisions.find(d => d.restaurant_id === rid); },
  dishStats(did) { const rs = DB.data.reviews.filter(r => r.dish_id === did); return { si: rs.filter(r => r.answer === 'si').length, dep: rs.filter(r => r.answer === 'dep').length, no: rs.filter(r => r.answer === 'no').length }; },
  topDish(rid) { return DB.dishesOf(rid).map(d => ({ d, s: this.dishStats(d.id) })).sort((a, b) => b.s.si - a.s.si)[0]; },
  verifiedWeek(rid) { const now = DB.nowMs(); return DB.data.reviews.filter(r => r.restaurant_id === rid && now - Date.parse(r.created_at) < 7 * DAY).length; },
  search(q) {
    const n = this.norm(q.trim()); if (!n) return [];
    return DB.data.restaurants.filter(r => [r.name, r.cat, r.comuna, ...r.tags, ...DB.dishesOf(r.id).map(d => d.name)].some(t => this.norm(t).includes(n))).map(r => r.id);
  },
};

/* ---------- Registro de eventos ---------- */
// Métricas que Radar lee de un aliado; se comparan antes y después de cada acción
function metrics(rid) {
  const s = Engine.series(rid), v = Engine.validation(rid), f = v.funnel;
  return { saves: ['Guardados esta semana', s.mappi[7]], buy: ['Compraron (7 días)', f.buy], reviews: ['Me gusta verificados', v.total], pctSi: ['% de pedidos con me gusta', v.pctSi ?? 0],
    menu: ['Abrieron el menú (7 días)', f.menu], open: ['Abrieron la ficha (7 días)', f.open], share: ['Compartieron (7 días)', f.share], busq: ['Búsquedas esta semana', s.busquedas ? s.busquedas[7] : 0], exp: ['Lo vieron (7 días)', f.exp] };
}
const changeTxt = c => `${c.l}: ${c.from} a ${c.to}`;
// Escribe (mutate), registra el evento con el antes y el después, y lo publica en el feed de Radar
function act(type, props = {}, mutate, radarText, table) {
  const rid = props.restaurant_id, before = rid ? Engine.score(rid) : null, mb = rid ? metrics(rid) : null;
  if (mutate) mutate();
  DB.rev++;
  const after = rid ? Engine.score(rid) : null, ma = rid ? metrics(rid) : null;
  const changes = rid ? Object.keys(mb).filter(k => mb[k][1] !== ma[k][1]).map(k => ({ k, l: mb[k][0], from: mb[k][1], to: ma[k][1] })) : [];
  const ev = DB.insert('events', { id: DB.id('e'), ts: DB.nowISO(), user_id: props.user_id || 'u_me', type, table: table || 'events', ...props, score_before: before?.total ?? null, score_after: after?.total ?? null, changes });
  if (radarText) {
    DB.data.session.radarFeed.unshift({ id: ev.id, ts: ev.ts, restaurant_id: rid || null, title: props.title || null, source: 'MAPPI', text: radarText, delta: after ? after.total - before.total : 0, change: changes[0] || null, mappi: true, fresh: true,
      estadoChange: before && before.a.estado !== after.a.estado ? [before.a.estado, after.a.estado] : null });
  }
  Bus.emit(ev);
  return ev;
}
function onceTrack(key, type, props, text, table) { const o = DB.data.session.once; if (o[key]) return; o[key] = true; act(type, props, null, text, table); }
const evDone = (type, rid) => DB.data.events.some(e => e.type === type && (!rid || e.restaurant_id === rid));
function bootFeed() {
  const s = DB.data.session;
  if (!s.radarFeed.length) s.radarFeed = DB.data.signal_feed.map((f, i) => ({ id: 'f' + i, ts: new Date(DB.nowMs() - f.mins_ago * 60000).toISOString(), restaurant_id: f.restaurant_id, source: f.source, text: f.text, delta: f.delta, neg: !!f.neg, mappi: false }));
  s.once ||= {}; s.tick ||= 0;
}

/* ---------- Operaciones del negocio ---------- */
const ANSWERS = { si: 'Me gusta' };
const REVIEW_REWARD = 20, SAVED_BONUS = 10, WEEKLY_REWARD_CAP = 3, SHIPPING = 1290;
const DECISION_STAGE = { 'Seguir observando': 'evaluacion', 'Solicitar información': 'evaluacion', 'Contactar al aliado': 'contactado', 'Proponer acción comercial': 'accion', 'Descartar por ahora': 'descartado' };
const NEXT_STAGE_OF = { evaluacion: 'contactado', contactado: 'accion', accion: 'medido' };

const Domain = {
  enterMappi() { act('enter_mappi', {}, null, null); },
  openRestaurant(rid) { onceTrack('open_' + rid, 'open_restaurant', { restaurant_id: rid }, 'Una persona abrió la ficha en MAPPI'); },
  openMenu(rid) { onceTrack('menu_' + rid, 'open_menu', { restaurant_id: rid }, 'Abrió el menú desde MAPPI'); },
  impression(rid) { onceTrack('imp_' + rid, 'impression', { restaurant_id: rid }, null); },
  openProfile(uid) { act('open_profile', { target_user: uid }, null, null); },
  viewStory(review, uid) { onceTrack('story_' + review.id, 'view_story', { restaurant_id: review.restaurant_id, target_user: uid }, `Vio la recomendación de ${DB.user(uid).name} en una historia`); },
  viewExternal(rid) { act('view_external', { restaurant_id: rid }, null, 'Vio contenido de redes desde la ficha'); },
  radarOpen(rid) { onceTrack('ropen_' + rid, 'radar_open', { restaurant_id: rid, user_id: 'radar' }, null); },

  toggleFollow(uid) {
    const has = Q.following().has(uid), u = DB.user(uid);
    const recs = new Set(DB.data.reviews.filter(r => r.user_id === uid && r.answer === 'si').map(r => r.restaurant_id)).size;
    act(has ? 'unfollow' : 'follow', { target_user: uid, title: 'Red de perfiles afines' }, () => {
      if (has) DB.remove('follows', f => f.follower_id === 'u_me' && f.followee_id === uid);
      else DB.insert('follows', { follower_id: 'u_me', followee_id: uid, created_at: DB.nowISO() });
    }, has ? null : `Siguió a ${u.name} ${u.initial}.: suma confianza a sus ${recs} recomendaciones`, 'follows');
    return !has;
  },
  toggleSave(rid) {
    const has = Q.saved().has(rid);
    act(has ? 'unsave' : 'save', { restaurant_id: rid }, () => {
      if (has) DB.remove('saves', s => s.user_id === 'u_me' && s.restaurant_id === rid);
      else DB.insert('saves', { user_id: 'u_me', restaurant_id: rid, created_at: DB.nowISO() });
    }, has ? 'Quitado de "Quiero probar"' : 'Guardado en "Quiero probar"', 'saves');
    return !has;
  },
  share(rid) { act('share', { restaurant_id: rid }, null, 'Compartido desde MAPPI'); return `mappi.link/r/${rid}`; },
  search(q) {
    const matches = Q.search(q);
    if (matches.length) act('search', { query: q, matches, restaurant_id: matches[0] }, null, `Búsqueda "${q}" con ${matches.length} resultado${matches.length === 1 ? '' : 's'}`);
    else act('search_empty', { query: q, title: 'Demanda sin oferta' }, () => {
      const u = DB.data.unmatched_searches.find(x => Q.norm(x.query) === Q.norm(q));
      if (u) u.count_7d++; else DB.insert('unmatched_searches', { query: q, comuna: DB.me().comuna, count_7d: 1, count_prev: 0 });
    }, `Búsqueda sin resultado: "${q}"`, 'unmatched_searches');
    return matches;
  },
  availableCoupon() { return DB.data.coupons.find(c => !c.used); },
  quote(dishId, qty, useCoupon) {
    const d = DB.dish(dishId), sub = d.price * qty, cp = this.availableCoupon(), canCp = !!cp && sub >= cp.min;
    const disc = useCoupon && canCp ? cp.discount : 0;
    return { sub, ship: SHIPPING, disc, total: sub + SHIPPING - disc, coupon: cp, canCp };
  },
  placeOrder(rid, dishId, qty, useCoupon) {
    const dsh = DB.dish(dishId), q = this.quote(dishId, qty, useCoupon), use = q.disc > 0;
    const repeat = DB.data.orders.some(o => o.user_id === 'u_me' && o.restaurant_id === rid);
    let order;
    act('order', { restaurant_id: rid, dish_id: dishId, qty, repeat }, () => {
      if (use) q.coupon.used = true;
      order = DB.insert('orders', { id: DB.id('o_s'), user_id: 'u_me', restaurant_id: rid, dish_id: dishId, qty, total: q.total, status: 'confirmado', coupon: use, source: 'mappi', session: true, created_at: DB.nowISO() });
    }, `Pedido desde MAPPI: ${qty} × ${dsh.name}${use ? ' con beneficio' : ''}`, 'orders');
    return order;
  },
  receive(orderId) { const o = DB.data.orders.find(x => x.id === orderId); o.status = 'recibido'; act('receive', { restaurant_id: o.restaurant_id, order_id: o.id }, null, null, 'orders'); return o; },
  skipReview(rid) { act('skip_review', { restaurant_id: rid }, null, null); },
  rejectReview(rid) { act('review_rejected', { restaurant_id: rid }, null, null); return 'Solo puedes dar me gusta a platos que recibiste en Rappi. Pide algo de este menú y, al recibirlo, podrás darle me gusta.'; },
  // "Me gusta" con compra verificada: sin comentarios ni etiquetas (las marcas no quieren texto abierto),
  // tope semanal de premios y bono por probar algo guardado
  publishReview({ orderId }) {
    const answer = 'si', txt = '', tags = [];
    const o = DB.data.orders.find(x => x.id === orderId);
    if (!o || o.user_id !== 'u_me' || o.status !== 'recibido') return { error: 'Solo puedes dar me gusta a pedidos recibidos.' };
    const r = DB.rest(o.restaurant_id), dsh = DB.dish(o.dish_id), prev = Q.reviewFor(o.id);
    const kind = prev ? 'edit' : Q.weekRewards() >= WEEKLY_REWARD_CAP ? 'limit' : 'ok';
    let bonus = false;
    act(prev ? 'review_edit' : 'review', { restaurant_id: o.restaurant_id, dish_id: dsh.id, answer, rewarded: kind === 'ok' }, () => {
      if (prev) { prev.answer = answer; prev.text = txt; prev.tags = [...tags]; return; }
      DB.insert('reviews', { id: DB.id('rv_s'), order_id: o.id, user_id: 'u_me', restaurant_id: o.restaurant_id, dish_id: dsh.id, answer, text: txt, tags: [...tags], rewarded: kind === 'ok', verified: true, created_at: DB.nowISO() });
      if (kind === 'ok') {
        DB.insert('wallet_ledger', { user_id: 'u_me', delta: REVIEW_REWARD, reason: `Me gusta, ${r.name}`, created_at: DB.nowISO() });
        bonus = DB.data.saves.some(s => s.user_id === 'u_me' && s.restaurant_id === o.restaurant_id && Date.parse(s.created_at) <= Date.parse(o.created_at));
        if (bonus) DB.insert('wallet_ledger', { user_id: 'u_me', delta: SAVED_BONUS, kind: 'bonus', reason: `Bono: probaste ${r.name}, que tenías guardado`, created_at: DB.nowISO() });
      }
    }, prev ? null : `Me gusta verificado a ${dsh.name}${kind === 'ok' ? ', con monedas' : ', sin monedas'}`, 'reviews');
    return { kind, bonus, coins: kind === 'ok' ? REVIEW_REWARD + (bonus ? SAVED_BONUS : 0) : 0, rid: o.restaurant_id, ans: answer, text: txt };
  },
  redeem(benefitId, { fail = false } = {}) {
    const b = DB.data.benefits.find(x => x.id === benefitId);
    if (Q.balance() < b.cost) return { error: `Te faltan ${b.cost - Q.balance()} monedas.` };
    if (fail) { act('redeem_fail', { benefit: b.id }, null, null); return { error: 'No pudimos completar el canje. Tu saldo no cambió; inténtalo de nuevo.' }; }
    act('redeem', { benefit: b.id }, () => {
      DB.insert('wallet_ledger', { user_id: 'u_me', delta: -b.cost, reason: `Canje, ${b.title}`, created_at: DB.nowISO() });
      DB.insert('coupons', { id: DB.id('c'), benefit_id: b.id, title: b.title, detail: b.detail.replace('vigencia', 'vence en'), discount: b.discount, min: b.min, used: false, created_at: DB.nowISO() });
    }, null, 'wallet_ledger');
    return { ok: true, benefit: b };
  },
  // Radar: la decisión es de una persona y queda registrada con su motivo
  decide(rid, f) {
    if (!f.opt || !f.owner || (f.why || '').trim().length < 5) return { error: 'Para guardar, elige una decisión, un responsable y escribe el motivo (5 caracteres o más).' };
    if (f.opt === 'Proponer acción comercial' && !f.action) return { error: 'Elige el tipo de acción comercial.' };
    let dec;
    act('decision', { restaurant_id: rid, user_id: 'radar', option: f.opt }, () => {
      dec = DB.insert('decisions', { id: DB.id('d'), restaurant_id: rid, option: f.opt, action: f.opt === 'Proponer acción comercial' ? f.action : null, owner: f.owner, why: f.why.trim(), next: (f.next || '').trim(), ts: DB.nowISO(), date: DB.nowISO().slice(0, 10), stage: DECISION_STAGE[f.opt], result: null });
    }, null, 'decisions');
    return { decision: dec };
  },
  ordersSince(dec) { return DB.data.orders.filter(o => o.restaurant_id === dec.restaurant_id && o.session && Date.parse(o.created_at) >= Date.parse(dec.ts || dec.date)).length; },
  advance(decisionId) {
    const dec = DB.data.decisions.find(x => x.id === decisionId), nx = NEXT_STAGE_OF[dec.stage]; if (!nx) return dec;
    act('stage', { restaurant_id: dec.restaurant_id, user_id: 'radar', stage: nx }, () => {
      dec.stage = nx;
      if (nx === 'medido') { const n = this.ordersSince(dec); dec.result = dec.action === 'destacar' ? `${n} pedido${n === 1 ? '' : 's'} desde MAPPI tras destacar` : 'Resultado registrado'; }
      if (nx === 'accion' && !dec.result) dec.result = 'En curso';
    }, null, 'decisions');
    return dec;
  },
  // Perfil propio en MAPPI
  setPublic(on) { act('profile_public', { title: 'Perfil MAPPI' }, () => { DB.me().public = !!on; }, null, 'users'); },
  toggleTaste(t) {
    const me = DB.me(), i = me.tastes.indexOf(t);
    act('profile_taste', { title: 'Perfil MAPPI', taste: t }, () => { if (i >= 0) me.tastes.splice(i, 1); else me.tastes.push(t); }, null, 'users');
    return i < 0;
  },
  applyRule(rule) { act('rule_change', { user_id: 'radar' }, () => { DB.data.rule = { ...rule }; }, null, 'rule'); },
  reset() { DB.wipe(); DB.load(window.SEED, { fresh: true }); bootFeed(); },
};

