/* Electricitat Samsó — menú, galeria, formularis, eines (avaries, solar, potència) i animacions. Sense dependències. */
(function () {
  'use strict';

  var reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var idioma = document.documentElement.lang === 'es' ? 'es-ES' : 'ca-ES';
  function num(n, dec) {
    return new Intl.NumberFormat(idioma, { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }).format(n);
  }

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
      if (boto.getAttribute('aria-expanded') === 'true') return tancaMenu();
      boto.setAttribute('aria-expanded', 'true');
      menu.classList.add('obert');
      document.body.classList.add('menu-obert');
    });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) tancaMenu(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') tancaMenu(); });
    window.matchMedia('(min-width: 1180px)').addEventListener('change', tancaMenu);
  }

  // ---------- lightbox (només les fotos visibles del grup, per si hi ha filtres) ----------
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
      grup = Array.prototype.filter.call(
        document.querySelectorAll('a[data-lightbox="' + a.dataset.lightbox + '"]'),
        function (el) { return !el.closest('[hidden]'); });
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

  // ---------- filtres de la pàgina de treballs ----------
  var filtres = document.querySelector('[data-filtres]');
  var galeriaF = document.querySelector('[data-galeria-filtrable]');
  if (filtres && galeriaF) {
    filtres.addEventListener('click', function (e) {
      var b = e.target.closest('[data-filtre]');
      if (!b) return;
      filtres.querySelectorAll('[data-filtre]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      var f = b.dataset.filtre;
      galeriaF.querySelectorAll('li').forEach(function (li) { li.hidden = f !== 'tots' && li.dataset.cat !== f; });
    });
  }

  // ---------- formularis ----------
  var demo = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ||
    document.body.hasAttribute('data-boceto');
  var avui = new Date();
  var avuiIso = new Date(avui.getTime() - avui.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  document.querySelectorAll('input[data-avui]').forEach(function (i) { i.min = avuiIso; });

  // omple el formulari si venim d'una eina (?servei=...&motiu=...)
  var params = new URLSearchParams(location.search);
  var selServei = document.querySelector('select[name="servei"]');
  if (selServei && params.get('servei')) {
    var opcio = selServei.querySelector('option[data-slug="' + params.get('servei') + '"]');
    if (opcio) opcio.selected = true;
  }
  var missatge = document.querySelector('form[data-formulari] textarea[name="missatge"]');
  if (missatge && params.get('motiu') && !missatge.value) missatge.value = params.get('motiu') + '. ';

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

  // ---------- assistent d'avaries ----------
  document.querySelectorAll('[data-avaries]').forEach(function (eina) {
    var opcions = eina.querySelectorAll('[data-avaria]');
    var resultats = eina.querySelectorAll('.avaria-resultat');
    function obre(id, desplaca) {
      opcions.forEach(function (o) { o.setAttribute('aria-expanded', String(o.dataset.avaria === id)); });
      resultats.forEach(function (r) {
        var ara = r.id === 'avaria-' + id;
        r.classList.toggle('actiu', ara);
        var tornar = r.querySelector('[data-avaria-tornar]');
        if (tornar) tornar.hidden = false;
        if (ara && desplaca) {
          r.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth', block: 'nearest' });
          r.focus({ preventScroll: true });
        }
      });
    }
    opcions.forEach(function (o) {
      o.setAttribute('aria-expanded', 'false');
      o.addEventListener('click', function (e) { e.preventDefault(); obre(o.dataset.avaria, true); });
    });
    eina.addEventListener('click', function (e) {
      if (!e.target.closest('[data-avaria-tornar]')) return;
      opcions.forEach(function (o) { o.setAttribute('aria-expanded', 'false'); });
      resultats.forEach(function (r) { r.classList.remove('actiu'); });
      opcions[0].focus();
    });
  });

  // ---------- calculadora solar ----------
  // Supòsits orientatius (Penedès): 1.450 kWh/kWp·any, plaques de 450 W, preu mitjà 0,20 €/kWh,
  // compensació d'excedents 0,06 €/kWh, cobrir ~70 % del consum.
  var SOLAR = {
    casa: { min: 30, max: 400, pas: 5, inicial: 90, autoconsum: 0.65, euroKwp: 1300, minPlaques: 4 },
    empresa: { min: 100, max: 3000, pas: 50, inicial: 600, autoconsum: 0.8, euroKwp: 1000, minPlaques: 8 }
  };
  document.querySelectorAll('[data-solar]').forEach(function (eina) {
    var rang = eina.querySelector('[data-solar-factura]');
    var sortida = eina.querySelector('[data-solar-factura-out]');
    var visual = eina.querySelector('[data-solar-plaques]');
    var r = function (k) { return eina.querySelector('[data-r="' + k + '"]'); };
    var tipus = 'casa';
    var plaquesAnteriors = 0;

    function calcula() {
      var c = SOLAR[tipus];
      var factura = +rang.value;
      sortida.textContent = num(factura) + ' €';
      var consumAnual = factura * 12 / 0.20;
      var plaques = Math.max(c.minPlaques, Math.ceil(consumAnual * 0.7 / 1450 / 0.45));
      var kwp = plaques * 0.45;
      var produccio = kwp * 1450;
      var autoconsumit = Math.min(produccio * c.autoconsum, consumAnual);
      var estalvi = autoconsumit * 0.20 + (produccio - autoconsumit) * 0.06;
      var inversio = Math.round(kwp * c.euroKwp / 100) * 100;
      r('estalvi').textContent = num(Math.round(estalvi / 10) * 10) + ' €' + eina.dataset.perAny;
      r('plaques').textContent = num(plaques);
      r('potencia').textContent = num(kwp, 2) + ' kWp';
      r('inversio').textContent = '≈ ' + num(inversio) + ' €';
      r('amortitzacio').textContent = num(inversio / estalvi, 1) + ' ' + eina.dataset.anys;

      // dibuix de les plaques (màx. 40; la resta, "+N")
      if (plaques !== plaquesAnteriors) {
        var mostrades = Math.min(plaques, 40);
        visual.textContent = '';
        for (var i = 0; i < mostrades; i++) {
          var p = document.createElement('span');
          p.className = 'placa';
          if (!reduit) p.style.animationDelay = (i < plaquesAnteriors ? 0 : (i - plaquesAnteriors) * 25) + 'ms';
          visual.appendChild(p);
        }
        if (plaques > mostrades) {
          var mes = document.createElement('span');
          mes.className = 'plaques-mes';
          mes.textContent = '+' + (plaques - mostrades);
          visual.appendChild(mes);
        }
        plaquesAnteriors = plaques;
      }
    }
    eina.querySelectorAll('input[name="solar-tipus"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        tipus = radio.value;
        var c = SOLAR[tipus];
        rang.min = c.min; rang.max = c.max; rang.step = c.pas; rang.value = c.inicial;
        calcula();
      });
    });
    rang.addEventListener('input', calcula);
    calcula();
  });

  // ---------- calculadora de potència ----------
  document.querySelectorAll('[data-potencia]').forEach(function (eina) {
    var trams = eina.dataset.trams.split(',').map(Number);
    var max = trams[trams.length - 1];
    var caselles = eina.querySelectorAll('input[data-w]');
    var ple = eina.querySelector('[data-trams-ple]');
    var marques = eina.querySelectorAll('[data-tram]');
    var trifasica = eina.querySelector('[data-trifasica]');
    function calcula() {
      var w = 0;
      caselles.forEach(function (c) { if (c.checked) w += +c.dataset.w; });
      var kw = w / 1000;
      var tram = trams.filter(function (t) { return t >= kw; })[0];
      eina.querySelector('[data-r="total"]').textContent = num(kw, 2) + ' kW';
      eina.querySelector('[data-r="recomanada"]').textContent = tram ? num(tram, 2) + ' kW' : '> ' + num(max, 2) + ' kW';
      ple.style.width = Math.min(100, kw / max * 100) + '%';
      marques.forEach(function (m) { m.classList.toggle('actiu', +m.dataset.tram === tram); });
      trifasica.hidden = !!tram;
    }
    caselles.forEach(function (c) { c.addEventListener('change', calcula); });
    calcula();
  });

  // ---------- titular amb paraules que roten ----------
  var rotador = document.querySelector('[data-rotador]');
  if (rotador && !reduit) {
    var paraules = rotador.querySelectorAll('.rot-paraula');
    var idx = 0;
    setInterval(function () {
      var abans = paraules[idx];
      idx = (idx + 1) % paraules.length;
      abans.classList.remove('actiu');
      abans.classList.add('surt');
      setTimeout(function () { abans.classList.remove('surt'); }, 450);
      paraules[idx].classList.add('actiu');
    }, 2400);
  }

  // ---------- comptadors i aparició en fer scroll ----------
  function compta(el) {
    var final = parseInt(el.dataset.compta, 10);
    if (isNaN(final)) return;
    var inici = final > 1000 ? final - 60 : 0;
    var t0 = null, durada = 1300;
    function pas(t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / durada);
      el.textContent = Math.round(inici + (final - inici) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(pas);
    }
    requestAnimationFrame(pas);
  }
  var animables = document.querySelectorAll(
    '.seccio-cap, .targeta, .avantatges li, .galeria li, .historia-teaser > *, .linia-temps li, .eina, .eina-targeta, .faq details, .llista-check li');
  if ('IntersectionObserver' in window && !reduit) {
    animables.forEach(function (el) {
      var germans = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      el.classList.add('revela');
      el.style.setProperty('--i', Math.min(germans, 6));
    });
    var obs = new IntersectionObserver(function (entrades) {
      entrades.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('vist');
        obs.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    animables.forEach(function (el) { obs.observe(el); });

    var obsC = new IntersectionObserver(function (entrades) {
      entrades.forEach(function (en) {
        if (!en.isIntersecting) return;
        compta(en.target);
        obsC.unobserve(en.target);
      });
    }, { threshold: 0.6 });
    document.querySelectorAll('[data-compta]').forEach(function (el) { obsC.observe(el); });
  }

  // ---------- si s'entra amb #avaria-xxx (enllaç directe), obre aquell problema ----------
  if (/^#avaria-/.test(location.hash)) {
    var o = document.querySelector('[data-avaria="' + location.hash.slice(8) + '"]');
    if (o) o.click();
  }
})();
