// Web Analytics Tracker SDK
// Lightweight, privacy-friendly analytics tracker (~3KB minified)
(function() {
  'use strict';

  var endpoint = '';
  var siteId = '';
  var currentPath = '';

  // Config from script tag
  var scripts = document.getElementsByTagName('script');
  for (var i = 0; i < scripts.length; i++) {
    var s = scripts[i];
    if (s.getAttribute('data-site-id')) {
      siteId = s.getAttribute('data-site-id');
      endpoint = s.getAttribute('data-endpoint') || (new URL(s.src).origin + '/api/collect');
      break;
    }
  }

  if (!siteId) return;

  // Privacy-friendly visitor ID (daily rotation, no cookies)
  function getVisitorId() {
    var date = new Date().toISOString().slice(0, 10);
    var raw = navigator.userAgent + '|' + navigator.language + '|' +
              screen.width + 'x' + screen.height + '|' + date + '|' + location.hostname;
    // Simple hash
    var hash = 0;
    for (var i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    return 'v' + Math.abs(hash).toString(36);
  }

  // Session ID (per-tab)
  function getSessionId() {
    var key = '_wa_sid';
    var sid = sessionStorage.getItem(key);
    if (!sid) {
      sid = 's' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
      sessionStorage.setItem(key, sid);
    }
    return sid;
  }

  // Get UTM params
  function getUTM() {
    var params = new URLSearchParams(location.search);
    return {
      us: params.get('utm_source') || '',
      um: params.get('utm_medium') || '',
      uc: params.get('utm_campaign') || '',
      ut: params.get('utm_term') || '',
      ux: params.get('utm_content') || ''
    };
  }

  // Send data
  function send(data) {
    var payload = JSON.stringify(data);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, payload);
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', endpoint, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(payload);
    }
  }

  // Track pageview
  function trackPageview() {
    var path = location.pathname;
    if (path === currentPath) return;
    currentPath = path;

    var utm = getUTM();
    send({
      sid: siteId,
      t: 'pageview',
      p: path,
      h: location.hostname,
      r: document.referrer || '',
      vid: getVisitorId(),
      ssid: getSessionId(),
      sw: screen.width,
      sh: screen.height,
      us: utm.us,
      um: utm.um,
      uc: utm.uc,
      ut: utm.ut,
      ux: utm.ux
    });
  }

  // Track custom event
  function trackEvent(name, value, props) {
    send({
      sid: siteId,
      t: 'event',
      p: location.pathname,
      h: location.hostname,
      r: '',
      vid: getVisitorId(),
      ssid: getSessionId(),
      sw: screen.width,
      sh: screen.height,
      en: name || '',
      ev: value || 0,
      props: props || {}
    });
  }

  // Track page leave (duration)
  var pageEnterTime = Date.now();
  function trackLeave() {
    var duration = Math.round((Date.now() - pageEnterTime) / 1000);
    if (duration < 1) return;
    send({
      sid: siteId,
      t: 'leave',
      p: location.pathname,
      h: location.hostname,
      r: '',
      vid: getVisitorId(),
      ssid: getSessionId(),
      sw: 0,
      sh: 0,
      d: duration
    });
  }

  // Track performance timing (Navigation Timing API)
  var perfSent = false;
  function trackPerformance() {
    if (perfSent) return;
    perfSent = true;

    var nt, st, tt, dp, dc, ol, plt;

    if (performance.getEntriesByType) {
      var entries = performance.getEntriesByType('navigation');
      if (entries && entries.length > 0) {
        var n = entries[0];
        nt = Math.round(n.connectEnd - n.startTime);
        st = Math.round(n.responseStart - n.requestStart);
        tt = Math.round(n.responseEnd - n.responseStart);
        dp = Math.round(n.domInteractive - n.responseEnd);
        dc = Math.round(n.domComplete - n.domInteractive);
        ol = Math.round(n.loadEventEnd - n.loadEventStart);
        plt = Math.round(n.loadEventEnd - n.startTime);
      }
    }

    if (typeof plt === 'undefined' && performance.timing) {
      var t = performance.timing;
      var s = t.navigationStart;
      nt = t.connectEnd - s;
      st = t.responseStart - t.requestStart;
      tt = t.responseEnd - t.responseStart;
      dp = t.domInteractive - t.responseEnd;
      dc = t.domComplete - t.domInteractive;
      ol = t.loadEventEnd - t.loadEventStart;
      plt = t.loadEventEnd - s;
    }

    if (!plt || plt <= 0) return;

    send({
      sid: siteId,
      t: 'performance',
      p: location.pathname,
      h: location.hostname,
      r: '',
      vid: getVisitorId(),
      ssid: getSessionId(),
      sw: screen.width,
      sh: screen.height,
      nt: nt || 0,
      st: st || 0,
      tt: tt || 0,
      dp: dp || 0,
      dc: dc || 0,
      ol: ol || 0,
      plt: plt || 0
    });
  }

  // Fire performance tracking after window load
  if (document.readyState === 'complete') {
    setTimeout(trackPerformance, 0);
  } else {
    window.addEventListener('load', function() {
      setTimeout(trackPerformance, 0);
    });
  }

  // SPA support: listen for pushState and popstate
  var origPushState = history.pushState;
  history.pushState = function() {
    origPushState.apply(this, arguments);
    setTimeout(function() {
      pageEnterTime = Date.now();
      trackPageview();
    }, 0);
  };

  window.addEventListener('popstate', function() {
    setTimeout(function() {
      pageEnterTime = Date.now();
      trackPageview();
    }, 0);
  });

  // Track leave on page unload
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
      trackLeave();
    } else {
      pageEnterTime = Date.now();
    }
  });

  // Initial pageview
  trackPageview();

  // --- Error tracking ---
  function trackError(data) {
    send({
      sid: siteId,
      t: 'error',
      p: location.pathname,
      h: location.hostname,
      r: '',
      vid: getVisitorId(),
      ssid: getSessionId(),
      sw: screen.width,
      sh: screen.height,
      em: data.message || '',
      es: data.source || '',
      est: data.stack || '',
      ef: data.filename || '',
      el: data.lineno || 0,
      ec: data.colno || 0,
      ehs: data.httpStatus || 0,
      ehu: data.httpUrl || ''
    });
  }

  // Dedup: same source+message+filename within 5s
  var recentErrors = {};
  function shouldTrack(source, message, filename) {
    var key = source + '|' + (message || '') + '|' + (filename || '');
    var now = Date.now();
    if (recentErrors[key] && now - recentErrors[key] < 5000) return false;
    recentErrors[key] = now;
    return true;
  }

  // 1. JS runtime errors
  var origOnError = window.onerror;
  window.onerror = function(message, source, lineno, colno, error) {
    if (shouldTrack('js', message, source)) {
      trackError({
        message: String(message),
        source: 'js',
        stack: error && error.stack ? error.stack.substring(0, 2000) : '',
        filename: source || '',
        lineno: lineno || 0,
        colno: colno || 0
      });
    }
    if (origOnError) origOnError.apply(this, arguments);
  };

  // 2. Unhandled promise rejections
  window.addEventListener('unhandledrejection', function(e) {
    var msg = e.reason ? (e.reason.message || String(e.reason)) : 'Unhandled Promise Rejection';
    var stack = e.reason && e.reason.stack ? e.reason.stack.substring(0, 2000) : '';
    if (shouldTrack('promise', msg, '')) {
      trackError({ message: msg, source: 'promise', stack: stack });
    }
  });

  // 3. Resource load errors (img/script/link)
  window.addEventListener('error', function(e) {
    var el = e.target;
    if (el && el !== window && (el.tagName === 'IMG' || el.tagName === 'SCRIPT' || el.tagName === 'LINK')) {
      var url = el.src || el.href || '';
      if (shouldTrack('resource', url, '')) {
        trackError({ message: 'Resource load failed: ' + url, source: 'resource', filename: url });
      }
    }
  }, true);

  // 4. HTTP errors (fetch + XMLHttpRequest)
  if (window.fetch) {
    var origFetch = window.fetch;
    window.fetch = function() {
      var url = arguments[0];
      if (typeof url === 'object' && url.url) url = url.url;
      return origFetch.apply(this, arguments).then(function(resp) {
        if (resp.status >= 400) {
          var u = String(url);
          if (u.indexOf('/api/collect') === -1 && shouldTrack('http', String(resp.status), u)) {
            trackError({ message: 'HTTP ' + resp.status, source: 'http', httpStatus: resp.status, httpUrl: u });
          }
        }
        return resp;
      });
    };
  }

  var origXHROpen = XMLHttpRequest.prototype.open;
  var origXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    this._waUrl = url;
    return origXHROpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function() {
    var xhr = this;
    xhr.addEventListener('loadend', function() {
      if (xhr.status >= 400) {
        var u = String(xhr._waUrl || '');
        if (u.indexOf('/api/collect') === -1 && shouldTrack('http', String(xhr.status), u)) {
          trackError({ message: 'HTTP ' + xhr.status, source: 'http', httpStatus: xhr.status, httpUrl: u });
        }
      }
    });
    return origXHRSend.apply(this, arguments);
  };

  // Public API
  window.wa = {
    track: trackEvent,
    pageview: trackPageview,
    trackError: trackError
  };
})();
