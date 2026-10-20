(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const els = {
    grid: $('grid'), stats: $('stats'), categories: $('categories'), search: $('search-input'),
    sort: $('sort-select'), resultCount: $('result-count'), empty: $('empty-state'),
    modal: $('modal'), frame: $('modal-frame'), modalTitle: $('modal-title'),
    modalCategory: $('modal-category'), modalDescription: $('modal-description'),
    modalOpen: $('modal-open'), theme: $('theme-toggle')
  };
  const STORE = { favorites: 'pixelArcade.favorites.v1', recent: 'pixelArcade.recent.v1', theme: 'pixelArcade.theme.v1' };
  const emoji = { puzzle:'🧩', arcade:'🕹️', shooter:'🎯', racing:'🏎️', sports:'⚽', platformer:'🏃', casual:'🎈', board:'♟️', 'word-quiz':'📝', '3d':'🌐' };
  const state = { games: [], categories: [], query: '', category: 'all', view: 'all', sort: 'default', current: null, favorites: readStore(STORE.favorites, []), recent: readStore(STORE.recent, []), shuffled: [] };
  const safe = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function readStore(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return Array.isArray(fallback) ? (Array.isArray(v) ? v : fallback) : (v ?? fallback); } catch { return fallback; } }
  function writeStore(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

  async function init() {
    const savedTheme = readStore(STORE.theme, 'dark'); setTheme(savedTheme);
    els.theme.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
    $('random-game').addEventListener('click', playRandom);
    els.search.addEventListener('input', () => { state.query = els.search.value.trim().toLowerCase(); render(); });
    els.sort.addEventListener('change', () => { state.sort = els.sort.value; if (state.sort === 'shuffle') state.shuffled = shuffle(state.games.map(g => g.slug)); render(); });
    $('quick-filters').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (!b) return; state.view = b.dataset.view; document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('active', x === b)); render(); });
    $('clear-filters').addEventListener('click', clearFilters);
    els.grid.addEventListener('click', e => {
      const fav = e.target.closest('[data-favorite]');
      if (fav) { e.stopPropagation(); toggleFavorite(fav.dataset.favorite); return; }
      const card = e.target.closest('[data-game]'); if (card) openGame(card.dataset.game);
    });
    els.modal.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeGame));
    $('modal-reload').addEventListener('click', () => { if (state.current) { const path = state.current.path; els.frame.src = 'about:blank'; requestAnimationFrame(() => { els.frame.src = path; }); } });
    $('modal-open').addEventListener('click', () => { if (state.current) window.open(state.current.path, '_blank', 'noopener'); });
    $('modal-fullscreen').addEventListener('click', () => { const panel = document.querySelector('.modal-panel'); if (!document.fullscreenElement) panel.requestFullscreen?.(); else document.exitFullscreen?.(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !els.modal.hidden) { closeGame(); return; }
      if (e.target.matches('input,textarea,select')) return;
      if (e.key === '/') { e.preventDefault(); els.search.focus(); }
      if (e.key.toLowerCase() === 'r' && els.modal.hidden) playRandom();
    });
    window.addEventListener('hashchange', () => { const m = location.hash.match(/^#play=([\w-]+)/); if (m) openGame(m[1], false); else if (!els.modal.hidden) closeGame(false); });
    try {
      const response = await fetch('games/registry.json');
      if (!response.ok) throw new Error(`Registry request failed (${response.status})`);
      const data = await response.json();
      state.games = Array.isArray(data.games) ? data.games : [];
      state.categories = Array.isArray(data.categories) ? data.categories : [];
      if (!state.games.length) throw new Error('No games were listed in the registry.');
      state.shuffled = shuffle(state.games.map(g => g.slug));
      renderStats(); renderCategories(); render();
      const deepLink = location.hash.match(/^#play=([\w-]+)/); if (deepLink) openGame(deepLink[1], false);
    } catch (err) {
      console.error(err);
      els.grid.innerHTML = `<div class="load-error"><h3>Couldn't load the game library</h3><p>${safe(err.message)}</p><p>Make sure <code>games/registry.json</code> exists and the site is being served from the repository root.</p></div>`;
      els.resultCount.textContent = 'Library unavailable';
    }
  }
  function setTheme(theme) { const value = theme === 'light' ? 'light' : 'dark'; document.documentElement.dataset.theme = value; els.theme.textContent = value === 'dark' ? '☀' : '☾'; writeStore(STORE.theme, value); }
  function shuffle(items) { const a = [...items]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function renderStats() {
    const cats = state.categories.map(c => ({...c, count: state.games.filter(g => g.category === c.id).length})).sort((a,b) => b.count-a.count).slice(0,3);
    els.stats.innerHTML = `<div class="stat"><strong>${state.games.length}</strong><span>games in the library</span></div><div class="stat"><strong>${state.categories.length}</strong><span>categories</span></div><div class="stat"><strong>${state.favorites.length}</strong><span>your favorites</span></div>${cats.map(c=>`<div class="stat stat-small"><strong>${c.count}</strong><span>${safe(c.emoji || emoji[c.id] || '🎮')} ${safe(c.label)}</span></div>`).join('')}`;
  }
  function renderCategories() {
    els.categories.innerHTML = `<button class="category-btn active" data-category="all" type="button">All categories</button>` + state.categories.map(c => `<button class="category-btn" data-category="${safe(c.id)}" type="button">${safe(c.emoji || emoji[c.id] || '🎮')} ${safe(c.label)} <span>${state.games.filter(g=>g.category===c.id).length}</span></button>`).join('');
    els.categories.addEventListener('click', e => { const b = e.target.closest('[data-category]'); if (!b) return; state.category = b.dataset.category; els.categories.querySelectorAll('.category-btn').forEach(x => x.classList.toggle('active', x === b)); render(); });
  }
  function getFiltered() {
    let games = state.games.filter(g => {
      if (state.category !== 'all' && g.category !== state.category) return false;
      if (state.view === 'favorites' && !state.favorites.includes(g.slug)) return false;
      if (state.view === 'recent' && !state.recent.includes(g.slug)) return false;
      if (state.query) { const hay = `${g.name} ${g.category} ${(g.tags||[]).join(' ')} ${g.description||''} ${g.tech||''}`.toLowerCase(); if (!hay.includes(state.query)) return false; }
      return true;
    });
    if (state.sort === 'az') games.sort((a,b)=>a.name.localeCompare(b.name));
    if (state.sort === 'za') games.sort((a,b)=>b.name.localeCompare(a.name));
    if (state.sort === 'shuffle') { const rank = new Map(state.shuffled.map((s,i)=>[s,i])); games.sort((a,b)=>(rank.get(a.slug)??99999)-(rank.get(b.slug)??99999)); }
    if (state.view === 'recent') { const rank = new Map(state.recent.map((s,i)=>[s,i])); games.sort((a,b)=>(rank.get(a.slug)??99999)-(rank.get(b.slug)??99999)); }
    return games;
  }
  function render() {
    const games = getFiltered();
    els.resultCount.textContent = `${games.length} of ${state.games.length} games`;
    $('stats').querySelectorAll('.stat')[2]?.querySelector('strong') && ($('stats').querySelectorAll('.stat')[2].querySelector('strong').textContent = state.favorites.length);
    els.empty.hidden = games.length > 0;
    els.grid.hidden = games.length === 0;
    els.grid.innerHTML = games.map(g => {
      const favorite = state.favorites.includes(g.slug);
      const cat = state.categories.find(c => c.id === g.category);
      return `<button class="game-card" type="button" data-game="${safe(g.slug)}" aria-label="Play ${safe(g.name)}"><span class="card-art cat-${safe(g.category)}"><span class="card-emoji">${safe(emoji[g.category] || '🎮')}</span><span class="card-play">▶ PLAY</span><span class="card-category">${safe(cat?.label || g.category)}</span></span><span class="card-content"><span class="card-title-row"><strong>${safe(g.name)}</strong><span class="favorite-star ${favorite?'is-favorite':''}" data-favorite="${safe(g.slug)}" role="button" tabindex="0" aria-label="${favorite?'Remove from':'Add to'} favorites" title="${favorite?'Remove from':'Add to'} favorites">${favorite?'♥':'♡'}</span></span><span class="card-description">${safe(g.description || 'Jump in and play.')}</span><span class="card-tags"><span>${safe(g.tech === 'three' ? 'THREE.JS' : g.tech === 'phaser' ? 'PHASER' : 'HTML5')}</span>${(g.tags||[]).slice(0,2).map(t=>`<span>${safe(t)}</span>`).join('')}</span></span></button>`;
    }).join('');
  }
  function toggleFavorite(slug) { state.favorites = state.favorites.includes(slug) ? state.favorites.filter(s=>s!==slug) : [slug,...state.favorites]; writeStore(STORE.favorites,state.favorites); renderStats(); render(); }
  function openGame(slug, updateHash = true) {
    const game = state.games.find(g=>g.slug===slug); if (!game) return;
    state.current = game;
    state.recent = [slug,...state.recent.filter(s=>s!==slug)].slice(0,12); writeStore(STORE.recent,state.recent); renderStats();
    const cat = state.categories.find(c=>c.id===game.category);
    els.modalTitle.textContent = game.name; els.modalCategory.textContent = `${cat?.emoji || emoji[game.category] || '🎮'} ${cat?.label || game.category}`;
    els.modalDescription.textContent = game.description || 'Have fun!';
    els.frame.src = game.path; els.modalOpen.href = game.path; els.modal.hidden = false; document.body.classList.add('modal-open');
    if (updateHash && location.hash !== `#play=${slug}`) history.replaceState(null,'',`#play=${slug}`);
  }
  function closeGame(updateHash = true) { els.modal.hidden = true; els.frame.src = 'about:blank'; document.body.classList.remove('modal-open'); if (document.fullscreenElement) document.exitFullscreen?.(); if (updateHash && location.hash.startsWith('#play=')) history.replaceState(null,'',location.pathname+location.search); state.current = null; }
  function playRandom() { const pool = getFiltered(); const source = pool.length ? pool : state.games; if (source.length) openGame(source[Math.floor(Math.random()*source.length)].slug); }
  function clearFilters() { state.query=''; state.category='all'; state.view='all'; state.sort='default'; els.search.value=''; els.sort.value='default'; document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view==='all')); els.categories.querySelectorAll('[data-category]').forEach(b=>b.classList.toggle('active',b.dataset.category==='all')); render(); }
  init();
})();
