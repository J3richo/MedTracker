/* Registre de l'état des sources de données, affiché dans le panneau « État des sources ». */
(function () {
  const MT = window.MT;
  const registry = {};
  const LABELS = { ok: 'OK', pending: 'En cours', error: 'Erreur', partial: 'Partiel', idle: 'Inactive' };

  MT.status = {
    // Déclare une source (nom, catégorie, lien) ; l'état est mis à jour ensuite.
    define(id, info) {
      registry[id] = Object.assign({ id, state: 'idle', message: '' }, registry[id] || {}, info);
      schedule();
    },
    set(id, patch) {
      registry[id] = Object.assign(registry[id] || { id, name: id, category: 'Autre' }, patch, { at: new Date() });
      schedule();
    },
    get: (id) => registry[id],
    all: () => Object.values(registry)
  };

  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; render(); });
  }

  function render() {
    const body = document.querySelector('#panel-status .card-body');
    if (!body) return;
    const items = MT.status.all().sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name));
    const counts = items.reduce((acc, s) => ((acc[s.state] = (acc[s.state] || 0) + 1), acc), {});
    document.getElementById('status-tag').textContent =
      `${counts.ok || 0} OK · ${counts.error || 0} en erreur · ${counts.idle || 0} inactives`;

    body.innerHTML = `
      <p class="hint">Les couches de carte ne sont testées qu'une fois activées. Une source en erreur signale
      souvent un blocage CORS, un identifiant de couche modifié ou une indisponibilité du serveur.</p>
      <div class="table-scroll" style="max-height:420px"><table class="table status-table">
        <thead><tr><th>Source</th><th>Catégorie</th><th>État</th><th>Détail</th></tr></thead>
        <tbody>${items.map((s) => `
          <tr>
            <td>${s.url ? `<a href="${MT.escape(s.url)}" target="_blank" rel="noopener">${MT.escape(s.name)}</a>` : MT.escape(s.name)}</td>
            <td>${MT.escape(s.category || '')}</td>
            <td><span class="dot ${s.state}"></span>${LABELS[s.state] || s.state}</td>
            <td class="muted">${MT.escape(s.message || '')}${s.at ? ` <small>(${s.at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})</small>` : ''}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;
  }
})();
