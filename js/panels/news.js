/*
 * Panneau « Actualités » : recherches thématiques Google Actualités (RSS) sur les 30 derniers jours.
 * Un navigateur ne pouvant pas lire directement un flux RSS d'un autre site, la lecture passe par
 * un relais CORS public (configurable dans js/config.js).
 */
(function () {
  const MT = window.MT;
  const body = () => document.querySelector('#panel-news .card-body');

  const TOPICS = [
    { id: 'mer', label: 'Mer & climat', q: 'Méditerranée (température de la mer OR canicule marine OR vague de chaleur marine)' },
    { id: 'premar', label: 'Préfecture maritime', q: '"préfecture maritime de la Méditerranée"' },
    { id: 'bio', label: 'Biodiversité', q: 'Méditerranée (biodiversité marine OR cétacés OR posidonie OR espèce invasive)' },
    { id: 'cote', label: 'Littoral', q: '(érosion OR trait de côte OR submersion) (Occitanie OR Var OR Hérault OR Corse OR Bouches-du-Rhône OR Alpes-Maritimes)' },
    { id: 'infra', label: 'Énergie & câbles', q: '(éolien flottant Méditerranée) OR (câble sous-marin Marseille)' },
    { id: 'pollution', label: 'Pollution', q: 'Méditerranée (pollution OR hydrocarbures OR plastique) mer' }
  ];
  const feedUrl = (q) =>
    `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:30d')}&hl=fr&gl=FR&ceid=FR:fr`;

  let items = [];
  let filter = MT.store.get('newsFilter') || 'all';

  MT.status.define('news', { name: 'Google Actualités (via relais CORS)', category: 'Actualités', url: 'https://news.google.com/' });

  function init() {
    body().innerHTML = `
      <div class="chips" id="news-chips">
        <button class="chip" data-id="all">Tout</button>
        ${TOPICS.map((t) => `<button class="chip" data-id="${t.id}">${t.label}</button>`).join('')}
      </div>
      <ul class="news-list" id="news-list"><li class="muted">Chargement…</li></ul>`;
    document.getElementById('news-chips').addEventListener('click', (e) => {
      const b = e.target.closest('[data-id]');
      if (!b) return;
      filter = b.dataset.id;
      MT.store.set('newsFilter', filter);
      render();
    });
  }

  async function load() {
    MT.status.set('news', { state: 'pending' });
    const results = await Promise.allSettled(TOPICS.map(async (t) => {
      const xml = await MT.fetchViaProxy(feedUrl(t.q), { timeout: 20000 });
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      return [...doc.querySelectorAll('item')].map((it) => {
        const title = it.querySelector('title')?.textContent || '';
        const source = it.querySelector('source')?.textContent || '';
        return {
          topic: t.id,
          title: source && title.endsWith(' - ' + source) ? title.slice(0, -(source.length + 3)) : title,
          link: it.querySelector('link')?.textContent || '#',
          date: new Date(it.querySelector('pubDate')?.textContent || 0),
          source
        };
      });
    }));
    const ok = results.filter((r) => r.status === 'fulfilled');
    const seen = new Set();
    items = ok.flatMap((r) => r.value)
      .sort((a, b) => b.date - a.date)
      .filter((it) => {
        const key = it.title.toLowerCase().slice(0, 80);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    if (ok.length) MT.status.set('news', { state: ok.length < TOPICS.length ? 'partial' : 'ok', message: `${items.length} articles (${ok.length}/${TOPICS.length} thèmes)` });
    else MT.status.set('news', { state: 'error', message: (results[0].reason && results[0].reason.message) || 'relais CORS indisponibles' });
    render();
  }

  function render() {
    document.querySelectorAll('#news-chips .chip').forEach((c) => c.classList.toggle('active', c.dataset.id === filter));
    const list = filter === 'all' ? items : items.filter((i) => i.topic === filter);
    document.getElementById('news-tag').textContent = `${list.length} articles · 30 j`;
    const topicLabel = (id) => (TOPICS.find((t) => t.id === id) || {}).label;
    document.getElementById('news-list').innerHTML = list.length
      ? list.slice(0, 40).map((it) => `
          <li>
            <a href="${MT.escape(it.link)}" target="_blank" rel="noopener">${MT.escape(it.title)}</a>
            <div class="news-meta"><span class="tag small">${MT.escape(topicLabel(it.topic))}</span>
              ${MT.escape(it.source)} · ${MT.timeAgo(it.date)}</div>
          </li>`).join('')
      : `<li class="muted">${MT.status.get('news').state === 'error'
          ? 'Actualités indisponibles : les relais CORS publics n’ont pas répondu. Réessayez plus tard ou changez de relais dans js/config.js.'
          : 'Aucun article.'}</li>`;
  }

  MT.on('init', init);
  MT.on('refresh', load);
})();
