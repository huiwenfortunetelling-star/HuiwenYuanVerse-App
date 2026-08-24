/*
 * Huiwen YuanVerse - Customer Frontend Traditional Chinese Layer
 * ----------------------------------------------------------------
 * Purpose:
 *   Display customer-facing Simplified Chinese as Traditional Chinese
 *   without changing the app's internal logic, Supabase field names,
 *   IDs, URLs, referral codes, or stored database values.
 *
 * Important:
 *   - DO NOT include this file on the admin backend.
 *   - There is also a safety guard below that disables conversion on /admin/.
 *   - This file uses opencc-js 1.4.1 (cn -> tw) for high-quality phrase-aware
 *     Simplified-to-Traditional conversion.
 */

(() => {
  'use strict';

  // Safety: even if this script is accidentally included in admin, do nothing.
  if (/\/admin(?:\/|$)/i.test(window.location.pathname)) {
    return;
  }

  const OPENCC_URL =
    'https://cdn.jsdelivr.net/npm/opencc-js@1.4.1/dist/umd/full.js';

  // Elements whose contents must never be altered by the display converter.
  const SKIP_SELECTOR = [
    'script',
    'style',
    'noscript',
    'code',
    'pre',
    'textarea',
    'iframe',
    '[contenteditable="true"]',
    '[data-no-traditional]',
    '.ignore-opencc',
  ].join(',');

  // Only presentation attributes are converted.
  // IDs, names, values, data-* attributes, href/src, etc. are untouched.
  const TEXT_ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'];

  // Small site-specific post-conversion dictionary.
  // OpenCC already handles these in normal cases; keeping them here makes
  // the brand/feature terminology explicit and consistent.
  const SITE_TERMS = [
    ['慧文国际善缘界', '慧文國際善緣界'],
    ['慧文国际', '慧文國際'],
    ['善缘值', '善緣值'],
    ['善缘界', '善緣界'],
    ['邀请码', '邀請碼'],
    ['邀请链接', '邀請連結'],
    ['专属分享链接', '專屬分享連結'],
    ['最新公告', '最新公告'],
    ['社区掠影', '社區掠影'],
  ];

  let converter = null;
  let observer = null;
  let hooksInstalled = false;
  let conversionReady = false;

  const pendingRoots = new Set();
  let flushScheduled = false;

  function applySiteTerms(text) {
    let result = String(text ?? '');
    for (const [from, to] of SITE_TERMS) {
      if (result.includes(from)) {
        result = result.split(from).join(to);
      }
    }
    return result;
  }

  function convertText(value) {
    if (!converter || value == null) return value;

    const original = String(value);
    if (!original) return original;

    // Convert only strings that contain CJK characters.
    // This avoids wasting work on emails, referral codes, prices, IDs, etc.
    if (!/[\u3400-\u9FFF]/u.test(original)) {
      return original;
    }

    const converted = converter(original);
    return applySiteTerms(converted);
  }

  function shouldSkipNode(node) {
    if (!node) return true;

    const element =
      node.nodeType === Node.ELEMENT_NODE
        ? node
        : node.parentElement;

    if (!element) return false;
    return Boolean(element.closest(SKIP_SELECTOR));
  }

  function convertTextNode(textNode) {
    if (
      !textNode ||
      textNode.nodeType !== Node.TEXT_NODE ||
      shouldSkipNode(textNode)
    ) {
      return;
    }

    const before = textNode.nodeValue;
    const after = convertText(before);

    if (after !== before) {
      textNode.nodeValue = after;
    }
  }

  function convertElementAttributes(element) {
    if (
      !element ||
      element.nodeType !== Node.ELEMENT_NODE ||
      shouldSkipNode(element)
    ) {
      return;
    }

    for (const attr of TEXT_ATTRIBUTES) {
      if (!element.hasAttribute(attr)) continue;

      const before = element.getAttribute(attr);
      const after = convertText(before);

      if (after !== before) {
        element.setAttribute(attr, after);
      }
    }

    // Convert visible labels stored in value only for button-like inputs.
    if (
      element instanceof HTMLInputElement &&
      /^(button|submit|reset)$/i.test(element.type)
    ) {
      const before = element.value;
      const after = convertText(before);

      if (after !== before) {
        element.value = after;
      }
    }
  }

  function convertSubtree(root) {
    if (!converter || !root) return;

    if (root.nodeType === Node.TEXT_NODE) {
      convertTextNode(root);
      return;
    }

    if (root.nodeType !== Node.ELEMENT_NODE &&
        root.nodeType !== Node.DOCUMENT_NODE &&
        root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
      return;
    }

    if (root.nodeType === Node.ELEMENT_NODE && shouldSkipNode(root)) {
      return;
    }

    if (root.nodeType === Node.ELEMENT_NODE) {
      convertElementAttributes(root);
    }

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (shouldSkipNode(node)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );

    let node = walker.nextNode();
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        convertTextNode(node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        convertElementAttributes(node);
      }
      node = walker.nextNode();
    }
  }

  function scheduleConversion(root) {
    if (!conversionReady || !root) return;

    pendingRoots.add(root);

    if (flushScheduled) return;
    flushScheduled = true;

    requestAnimationFrame(() => {
      flushScheduled = false;

      const roots = Array.from(pendingRoots);
      pendingRoots.clear();

      for (const item of roots) {
        convertSubtree(item);
      }

      convertDocumentTitle();
    });
  }

  function convertDocumentTitle() {
    if (!converter) return;
    const before = document.title;
    const after = convertText(before);
    if (after !== before) {
      document.title = after;
    }
  }

  function installDialogHooks() {
    if (hooksInstalled || !converter) return;
    hooksInstalled = true;

    const originalAlert = window.alert.bind(window);
    const originalConfirm = window.confirm.bind(window);
    const originalPrompt = window.prompt.bind(window);

    window.alert = (message) =>
      originalAlert(convertText(message));

    window.confirm = (message) =>
      originalConfirm(convertText(message));

    window.prompt = (message, defaultValue) =>
      originalPrompt(convertText(message), defaultValue);
  }

  function installMutationObserver() {
    if (observer) return;

    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          scheduleConversion(mutation.target);
          continue;
        }

        if (mutation.type === 'attributes') {
          scheduleConversion(mutation.target);
          continue;
        }

        for (const addedNode of mutation.addedNodes) {
          scheduleConversion(addedNode);
        }
      }
    });

    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        ...TEXT_ATTRIBUTES,
        'value',
      ],
    });
  }

  function loadOpenCC() {
    if (window.OpenCC?.Converter) {
      return Promise.resolve(window.OpenCC);
    }

    return new Promise((resolve, reject) => {
      const existing = document.querySelector(
        'script[data-huiwen-opencc="1"]',
      );

      if (existing) {
        existing.addEventListener('load', () => {
          if (window.OpenCC?.Converter) {
            resolve(window.OpenCC);
          } else {
            reject(new Error('OpenCC loaded but is unavailable.'));
          }
        }, { once: true });

        existing.addEventListener(
          'error',
          () => reject(new Error('OpenCC failed to load.')),
          { once: true },
        );
        return;
      }

      const script = document.createElement('script');
      script.src = OPENCC_URL;
      script.async = true;
      script.dataset.huiwenOpencc = '1';

      script.onload = () => {
        if (window.OpenCC?.Converter) {
          resolve(window.OpenCC);
        } else {
          reject(new Error('OpenCC loaded but is unavailable.'));
        }
      };

      script.onerror = () => {
        reject(new Error('OpenCC failed to load.'));
      };

      document.head.appendChild(script);
    });
  }

  async function startTraditionalLayer() {
    try {
      const OpenCC = await loadOpenCC();

      // "tw" converts Simplified Chinese to Traditional Chinese characters
      // without forcing Taiwan-specific colloquial vocabulary ("twp").
      converter = OpenCC.Converter({
        from: 'cn',
        to: 'tw',
      });

      conversionReady = true;

      // Tell browsers/accessibility tools that the customer-facing page is
      // Traditional Chinese.
      document.documentElement.lang = 'zh-Hant';

      installDialogHooks();
      convertDocumentTitle();
      convertSubtree(document.documentElement);
      installMutationObserver();

      // Public helper for debugging/testing from DevTools if ever needed.
      window.HuiwenTraditional = Object.freeze({
        convert: convertText,
        refresh() {
          convertSubtree(document.documentElement);
          convertDocumentTitle();
        },
        version: '1.0.0',
      });

      document.dispatchEvent(
        new CustomEvent('huiwen:traditional-ready'),
      );
    } catch (error) {
      // Fail safely: if the converter CDN is unavailable, the original
      // Simplified Chinese page still functions normally.
      console.error(
        '[Huiwen Traditional] Traditional Chinese layer could not start:',
        error,
      );
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      startTraditionalLayer,
      { once: true },
    );
  } else {
    startTraditionalLayer();
  }
})();
