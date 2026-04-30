/**
 * Nexus Pixel — Script de rastreamento para lojas Bagy
 * Versão: 1.0.0
 *
 * Como usar:
 *   1. Copie o snippet gerado em Configurações → Pixel Nexus no dashboard.
 *   2. Cole antes de </body> no tema da sua loja Bagy.
 *
 * Eventos rastreados automaticamente:
 *   - page_view (a cada carregamento de página)
 *
 * Eventos manuais via window.nexusPixel:
 *   - nexusPixel.addToCart({ product_id, name, price, quantity })
 *   - nexusPixel.beginCheckout({ value, currency })
 *   - nexusPixel.purchase({ order_id, value, currency })
 *   - nexusPixel.track(eventName, metadata)
 */
(function (w, d, accountSlug, endpoint) {
  'use strict';

  var SESSION_KEY = '__nx_sid';
  var SENT_PV_KEY = '__nx_pv_' + d.location.pathname;

  // ── Session ID ─────────────────────────────────────────────────
  function getSessionId() {
    try {
      var sid = sessionStorage.getItem(SESSION_KEY);
      if (!sid) {
        sid = 'nx-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        sessionStorage.setItem(SESSION_KEY, sid);
      }
      return sid;
    } catch (_) {
      return 'nx-' + Math.random().toString(36).slice(2, 10);
    }
  }

  // ── Send ────────────────────────────────────────────────────────
  function send(event, metadata) {
    var payload = JSON.stringify({
      account: accountSlug,
      event: event,
      session_id: getSessionId(),
      page: d.location.pathname,
      referrer: d.referrer || null,
      metadata: metadata || {}
    });

    // sendBeacon é mais confiável em navegação (não bloqueia)
    if (navigator.sendBeacon) {
      try {
        var blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(endpoint, blob);
        return;
      } catch (_) { /* fallback */ }
    }

    // Fallback: fetch com keepalive
    try {
      fetch(endpoint, {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true
      });
    } catch (_) { /* silencia erros de rede */ }
  }

  // ── Auto page_view ──────────────────────────────────────────────
  // Evita duplicate firing em SPAs ou double-load
  function trackPageView() {
    try {
      if (sessionStorage.getItem(SENT_PV_KEY)) return;
      sessionStorage.setItem(SENT_PV_KEY, '1');
    } catch (_) { /* sem sessionStorage — envia mesmo assim */ }
    send('page_view');
  }

  if (d.readyState === 'complete' || d.readyState === 'interactive') {
    trackPageView();
  } else {
    d.addEventListener('DOMContentLoaded', trackPageView);
  }

  // ── API pública ─────────────────────────────────────────────────
  w.nexusPixel = {
    track: function (event, metadata) { send(event, metadata); },

    addToCart: function (product) {
      send('add_to_cart', {
        product_id: product.product_id || product.id || null,
        name: product.name || null,
        price: product.price || 0,
        quantity: product.quantity || 1
      });
    },

    beginCheckout: function (data) {
      send('begin_checkout', {
        value: (data && data.value) || 0,
        currency: (data && data.currency) || 'BRL',
        items: (data && data.items) || []
      });
    },

    purchase: function (data) {
      send('purchase', {
        order_id: (data && data.order_id) || null,
        value: (data && data.value) || 0,
        currency: (data && data.currency) || 'BRL'
      });
    }
  };

})(window, document, window.__nexusAccount || '{{ACCOUNT_SLUG}}', 'https://vvtalmhfdchhwlzqgnvt.supabase.co/functions/v1/track');
