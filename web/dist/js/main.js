/* Electricitat Samsó — menú mòbil, galeria (lightbox) i formularis. Sense dependències. */
(function () {
  'use strict';

  // ---------- menú mòbil ----------
  var boto = document.querySelector('[data-menu-boto]');
  var menu = document.getElementById('menu');
  function tancaMenu() {
    boto.setAttribute('aria-expanded', 'false');
    menu.classList.remove('obert');
    document.body.classList.remove('menu-obert');
  }
  if (boto && menu) {
    boto.addEventListener('click', function () {
      var obert = boto.getAttribute('aria-expanded') === 'true';
      if (obert) return tancaMenu();
      boto.setAttribute('aria-expanded', 'true');
      menu.classList.add('obert');
      document.body.classList.add('menu-obert');
    });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) tancaMenu(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') tancaMenu(); });
    window.matchMedia('(min-width: 960px)').addEventListener('change', tancaMenu);
  }

  // ---------- lightbox ----------
  var dialeg = document.querySelector('[data-lightbox-dialog]');
  if (dialeg && typeof dialeg.showModal === 'function') {
    var imatge = dialeg.querySelector('[data-lightbox-img]');
    var text = dialeg.querySelector('[data-lightbox-text]');
    var grup = [], actual = 0;

    function mostra(i) {
      actual = (i + grup.length) % grup.length;
      var a = grup[actual], mini = a.querySelector('img');
      imatge.src = a.href;
      imatge.alt = mini ? mini.alt : '';
      if (a.dataset.w) { imatge.width = a.dataset.w; imatge.height = a.dataset.h; }
      text.textContent = text.dataset.foto + ' ' + (actual + 1) + ' ' + text.dataset.de + ' ' + grup.length;
      dialeg.querySelector('[data-lightbox-ant]').hidden = grup.length < 2;
      dialeg.querySelector('[data-lightbox-seg]').hidden = grup.length < 2;
    }
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-lightbox]');
      if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
      e.preventDefault();
      grup = Array.prototype.slice.call(document.querySelectorAll('a[data-lightbox="' + a.dataset.lightbox + '"]'));
      mostra(grup.indexOf(a));
      dialeg.showModal();
    });
    dialeg.querySelector('[data-lightbox-tanca]').addEventListener('click', function () { dialeg.close(); });
    dialeg.querySelector('[data-lightbox-ant]').addEventListener('click', function () { mostra(actual - 1); });
    dialeg.querySelector('[data-lightbox-seg]').addEventListener('click', function () { mostra(actual + 1); });
    dialeg.addEventListener('click', function (e) { if (e.target === dialeg || e.target.tagName === 'FIGURE') dialeg.close(); });
    dialeg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') mostra(actual - 1);
      if (e.key === 'ArrowRight') mostra(actual + 1);
    });
    var iniciX = null;
    dialeg.addEventListener('touchstart', function (e) { iniciX = e.touches[0].clientX; }, { passive: true });
    dialeg.addEventListener('touchend', function (e) {
      if (iniciX === null) return;
      var dx = e.changedTouches[0].clientX - iniciX;
      if (Math.abs(dx) > 50) mostra(actual + (dx < 0 ? 1 : -1));
      iniciX = null;
    });
    dialeg.addEventListener('close', function () { imatge.removeAttribute('src'); });
  }

  // ---------- formularis ----------
  var demo = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ||
    document.body.hasAttribute('data-boceto');
  var avui = new Date();
  var avuiIso = new Date(avui.getTime() - avui.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  document.querySelectorAll('input[data-avui]').forEach(function (i) { i.min = avuiIso; });

  document.querySelectorAll('form[data-formulari]').forEach(function (form) {
    var estat = form.querySelector('.form-estat');
    var enviar = form.querySelector('button[type="submit"]');
    function avisa(tipus, missatge) {
      estat.hidden = false;
      estat.className = 'form-estat ' + tipus;
      estat.textContent = missatge;
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (demo) return avisa('demo', estat.dataset.demo);
      if (!window.fetch) return form.submit();
      var textBoto = enviar.textContent;
      enviar.disabled = true;
      enviar.textContent = enviar.dataset.textEnviant;
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (r) {
          if (!r.ok) throw new Error(r.error || 'error');
          form.reset();
          avisa('ok', estat.dataset.ok);
        })
        .catch(function () { avisa('error', estat.dataset.error); })
        .then(function () { enviar.disabled = false; enviar.textContent = textBoto; });
    });
  });
})();
