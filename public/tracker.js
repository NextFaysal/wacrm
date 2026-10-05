/**
 * WACRM First-Party Growth & E-Commerce Analytics Tracker
 * Version: 2.0.0
 * Privacy-First, Zero External Dependencies, Resilient Sessionization
 */
(function (window, document) {
  'use strict';

  var COOKIE_VID_NAME = '_wacrm_vid';
  var COOKIE_SID_NAME = '_wacrm_sid';
  var STORAGE_PREFIX = 'wacrm:';

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
    return match ? decodeURIComponent(match[3]) : null;
  }

  function setCookie(name, value, days) {
    var expires = '';
    if (days) {
      var date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      expires = '; expires=' + date.toUTCString();
    }
    var domain = window.location.hostname;
    // Strip port if present
    domain = domain.split(':')[0];
    document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/; SameSite=Lax';
  }

  function getOrSetStorage(key, fallbackFn, isSession) {
    var storage = isSession ? window.sessionStorage : window.localStorage;
    try {
      var val = storage.getItem(STORAGE_PREFIX + key);
      if (!val) {
        val = fallbackFn();
        storage.setItem(STORAGE_PREFIX + key, val);
      }
      return val;
    } catch (e) {
      return fallbackFn();
    }
  }

  // 1. Resolve or Generate Visitor ID
  var visitorToken = getCookie(COOKIE_VID_NAME) || getOrSetStorage('vid', generateUUID, false);
  setCookie(COOKIE_VID_NAME, visitorToken, 365);

  // 2. Resolve or Generate Session ID (rolling 30 mins)
  var sessionToken = getCookie(COOKIE_SID_NAME) || getOrSetStorage('sid', generateUUID, true);
  setCookie(COOKIE_SID_NAME, sessionToken, 0.0208); // ~30 minutes

  // 3. Extract Marketing & Campaign Parameters
  var urlParams = new URLSearchParams(window.location.search);
  var utmSource = urlParams.get('utm_source');
  var utmMedium = urlParams.get('utm_medium');
  var utmCampaign = urlParams.get('utm_campaign');
  var utmTerm = urlParams.get('utm_term');
  var utmContent = urlParams.get('utm_content');
  var fbclid = urlParams.get('fbclid');
  var gclid = urlParams.get('gclid');
  var ttclid = urlParams.get('ttclid');

  // Detect Channel
  var detectedChannel = 'direct';
  var referrer = document.referrer || '';

  if (fbclid || (utmSource && /facebook|fb|instagram|ig|meta/i.test(utmSource))) {
    detectedChannel = 'meta';
  } else if (gclid || (utmSource && /google|adwords/i.test(utmSource))) {
    detectedChannel = 'google';
  } else if (ttclid || (utmSource && /tiktok/i.test(utmSource))) {
    detectedChannel = 'tiktok';
  } else if (utmSource && /whatsapp|wa/i.test(utmSource)) {
    detectedChannel = 'whatsapp';
  } else if (referrer) {
    if (/google|bing|yahoo|duckduckgo|ecosia/i.test(referrer)) {
      detectedChannel = 'organic';
    } else if (/facebook|instagram|tiktok|twitter|t\.co|linkedin/i.test(referrer)) {
      detectedChannel = 'social';
    } else {
      detectedChannel = 'referral';
    }
  }

  // Core Tracker Object
  var WacrmTracker = {
    visitorToken: visitorToken,
    sessionToken: sessionToken,
    detectedChannel: detectedChannel,
    accountId: window.__WACRM_ACCOUNT_ID__ || null,

    init: function (options) {
      if (options && options.accountId) {
        this.accountId = options.accountId;
      }
      this.attachGlobalInterceptors();
      this.track('PageView', {
        title: document.title,
        url: window.location.href,
        path: window.location.pathname
      });
    },

    track: function (eventName, payload) {
      payload = payload || {};
      var eventData = {
        accountId: this.accountId,
        visitorToken: this.visitorToken,
        sessionToken: this.sessionToken,
        eventName: eventName,
        pageUrl: window.location.href,
        referrer: referrer,
        channel: this.detectedChannel,
        utm: {
          source: utmSource,
          medium: utmMedium,
          campaign: utmCampaign,
          term: utmTerm,
          content: utmContent,
          fbclid: fbclid,
          gclid: gclid,
          ttclid: ttclid
        },
        payload: payload,
        timestamp: new Date().toISOString()
      };

      try {
        var blob = new Blob([JSON.stringify(eventData)], { type: 'application/json' });
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/public/events', blob);
        } else {
          fetch('/api/public/events', {
            method: 'POST',
            body: JSON.stringify(eventData),
            headers: { 'Content-Type': 'application/json' },
            keepalive: true
          }).catch(function () {});
        }
      } catch (err) {
        // Silent catch for ad-blockers or connection aborts
      }
    },

    attachGlobalInterceptors: function () {
      var self = this;
      document.addEventListener('click', function (e) {
        var target = e.target && e.target.closest('a, button');
        if (!target) return;

        var href = target.getAttribute('href') || '';
        // Detect WhatsApp clicks
        if (href.indexOf('wa.me') !== -1 || href.indexOf('whatsapp.com') !== -1 || target.getAttribute('data-track') === 'whatsapp') {
          self.track('WhatsAppClick', {
            targetUrl: href,
            text: target.innerText || ''
          });
        }

        // Detect Phone call clicks
        if (href.indexOf('tel:') === 0 || target.getAttribute('data-track') === 'phone') {
          self.track('PhoneClick', {
            phone: href.replace('tel:', ''),
            text: target.innerText || ''
          });
        }
      }, true);
    }
  };

  window.wacrmTracker = WacrmTracker;

  // Auto-initialize if DOM is ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    WacrmTracker.init();
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      WacrmTracker.init();
    });
  }
})(window, document);
