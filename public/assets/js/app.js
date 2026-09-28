/* Campus Köthen – News & Events
 * Loads every post and event from the Campus Köthen API (via the same-origin
 * proxy under /api/, configured through API_BASE_URL) and renders them with
 * client-side filtering by channel, type and full-text search.
 */
(function () {
  'use strict';

  var API = '/api/v1';
  var PAGE_SIZE = 50;               // API maximum
  var REFRESH_MS = 5 * 60 * 1000;   // auto refresh interval while the tab is visible
  var TZ = 'Europe/Berlin';
  var t = function () { return window.I18N.t.apply(null, arguments); };

  var state = {
    posts: [],
    channels: [],
    tags: [],
    truncated: false,
    loadedAt: null,
    loading: false,
    error: null,
    tab: 'news',
    selectedChannels: new Set(),  // empty = all channels
    selectedTag: null,            // null = all types
    query: '',
    expanded: new Set(),
    pendingHash: location.hash
  };

  var el = {};

  /* ------------------------------------------------------------------ utils */

  function h(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.indexOf('on') === 0 && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (k === 'style') Object.keys(v).forEach(function (p) { node.style.setProperty(p, v[p]); });
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function svgIcon(pathD) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(ns, 'path');
    p.setAttribute('d', pathD);
    svg.appendChild(p);
    return svg;
  }

  var ICON = {
    calendar: 'M7 3v3M17 3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z',
    link: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
    external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
    chevron: 'm6 9 6 6 6-6',
    download: 'M12 4v11M7 10l5 5 5-5M5 20h14'
  };

  function isSafeHref(url) {
    return typeof url === 'string' && /^(https?:|mailto:|tel:)/i.test(url.trim());
  }

  /** Map any CMS/API image URL onto the same-origin media proxy. */
  function proxiedImage(url) {
    if (!url || typeof url !== 'string') return null;
    var m = url.match(/\/uploads\/([A-Za-z0-9._-]+)(?:[?#].*)?$/);
    return m ? API + '/media/uploads/' + m[1] : null;
  }

  function colorOf(ch) {
    return ch && /^#[0-9a-f]{6}$/i.test(ch.colorHex || '') ? ch.colorHex : '#C2185B';
  }

  function normalize(s) {
    return (s || '').toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  /* ------------------------------------------------------------ date utils */

  function fmt(date, opts) {
    return new Intl.DateTimeFormat(window.I18N.locale(), Object.assign({ timeZone: TZ }, opts)).format(date);
  }

  function berlinDayKey(date) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }

  function relativeTime(date) {
    var diff = (date.getTime() - Date.now()) / 1000;
    var abs = Math.abs(diff);
    var rtf = new Intl.RelativeTimeFormat(window.I18N.lang, { numeric: 'auto' });
    if (abs < 60) return rtf.format(0, 'second');
    if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
    if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), 'day');
    if (abs < 86400 * 30) return rtf.format(Math.round(diff / (86400 * 7)), 'week');
    return fmt(date, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function eventRange(post) {
    var start = new Date(post.eventStart);
    var end = post.eventEnd ? new Date(post.eventEnd) : null;
    var sameDay = !end || berlinDayKey(start) === berlinDayKey(end);
    var dateLong = { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' };
    var dateShort = { weekday: 'short', day: 'numeric', month: 'short' };
    var time = { hour: '2-digit', minute: '2-digit' };
    var clock = t('clock') ? ' ' + t('clock') : '';

    if (post.eventAllDay) {
      if (sameDay) return fmt(start, dateLong) + ' · ' + t('allDay');
      return fmt(start, dateShort) + ' – ' + fmt(end, dateLong) + ' · ' + t('allDay');
    }
    if (sameDay) {
      return fmt(start, dateLong) + ' · ' + fmt(start, time) + (end ? '–' + fmt(end, time) : '') + clock;
    }
    return fmt(start, dateShort) + ', ' + fmt(start, time) + ' – ' + fmt(end, dateShort) + ', ' + fmt(end, time) + clock;
  }

  function eventEndTime(post) {
    var end = new Date(post.eventEnd || post.eventStart);
    if (post.eventAllDay) {
      // treat all-day events as lasting until the end of that (Berlin) day
      end = new Date(end.getTime() + 24 * 3600 * 1000 - 1);
    }
    return end;
  }

  function isUpcoming(post) { return eventEndTime(post).getTime() >= Date.now(); }

  function eventBadge(post) {
    var now = Date.now();
    var start = new Date(post.eventStart).getTime();
    if (start <= now && eventEndTime(post).getTime() >= now) return { cls: 'badge-live', text: t('now') };
    var today = berlinDayKey(new Date());
    var tomorrow = berlinDayKey(new Date(now + 86400000));
    var day = berlinDayKey(new Date(start));
    if (day === today) return { cls: 'badge-soon', text: t('today') };
    if (day === tomorrow) return { cls: 'badge-soon', text: t('tomorrow') };
    return null;
  }

  /* -------------------------------------------------------- content blocks */

  function renderInline(node) {
    if (!node) return null;
    if (node.type === 'text') {
      var out = document.createTextNode(node.text || '');
      if (node.code) out = h('code', null, [out]);
      if (node.bold) out = h('strong', null, [out]);
      if (node.italic) out = h('em', null, [out]);
      if (node.underline) out = h('u', null, [out]);
      if (node.strikethrough) out = h('s', null, [out]);
      return out;
    }
    if (node.type === 'link') {
      var kids = (node.children || []).map(renderInline);
      if (!isSafeHref(node.url)) return h('span', null, kids);
      return h('a', { href: node.url, target: '_blank', rel: 'noopener noreferrer' }, kids);
    }
    if (node.type === 'list') return renderBlock(node);
    if (node.children) return h('span', null, node.children.map(renderInline));
    return null;
  }

  function renderBlock(block) {
    if (!block || typeof block !== 'object') return null;
    var kids = function () { return (block.children || []).map(renderInline); };
    switch (block.type) {
      case 'paragraph': {
        var p = h('p', null, kids());
        return p.textContent.trim() || p.querySelector('a') ? p : null;
      }
      case 'heading': {
        var lvl = Number(block.level) || 3;
        return h(lvl <= 2 ? 'h4' : lvl === 3 ? 'h5' : 'h6', null, kids());
      }
      case 'list': {
        var ordered = block.format === 'ordered';
        return h(ordered ? 'ol' : 'ul', null, (block.children || []).map(function (item) {
          if (item.type === 'list') return h('li', null, [renderBlock(item)]);
          return h('li', null, (item.children || []).map(renderInline));
        }));
      }
      case 'quote':
        return h('blockquote', null, kids());
      case 'image': {
        var img = block.image || block;
        var src = proxiedImage(img.url);
        if (!src) return null;
        return h('figure', null, [h('img', {
          src: src, alt: img.alternativeText || '', loading: 'lazy', decoding: 'async',
          width: img.width || null, height: img.height || null
        })]);
      }
      default:
        return null;
    }
  }

  function blocksToText(blocks) {
    var parts = [];
    (function walk(nodes) {
      (nodes || []).forEach(function (n) {
        if (!n) return;
        if (n.type === 'text' && n.text) parts.push(n.text);
        if (n.children) walk(n.children);
        if (n.type === 'paragraph' || n.type === 'heading' || n.type === 'list-item' || n.type === 'quote') parts.push('\n');
      });
    })(blocks);
    return parts.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* ------------------------------------------------------------------- ICS */

  function icsEscape(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, function (c) { return '\\' + c; });
  }
  function icsFold(line) {
    var out = [];
    while (line.length > 74) { out.push(line.slice(0, 74)); line = ' ' + line.slice(74); }
    out.push(line);
    return out.join('\r\n');
  }
  function icsUtc(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function icsDate(d) { return berlinDayKey(d).replace(/-/g, ''); }

  function downloadIcs(post) {
    var start = new Date(post.eventStart);
    var end = post.eventEnd ? new Date(post.eventEnd) : null;
    var lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Campus Koethen//News Website//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + post.slug + '@campus-koethen-news',
      'DTSTAMP:' + icsUtc(new Date())
    ];
    if (post.eventAllDay) {
      var last = end || start;
      var exclusive = new Date(new Date(berlinDayKey(last) + 'T12:00:00Z').getTime() + 86400000);
      lines.push('DTSTART;VALUE=DATE:' + icsDate(start));
      lines.push('DTEND;VALUE=DATE:' + exclusive.toISOString().slice(0, 10).replace(/-/g, ''));
    } else {
      lines.push('DTSTART:' + icsUtc(start));
      lines.push('DTEND:' + icsUtc(end || new Date(start.getTime() + 3600000)));
    }
    lines.push('SUMMARY:' + icsEscape(post.title));
    var desc = blocksToText(post.content);
    if (desc) lines.push('DESCRIPTION:' + icsEscape(desc));
    lines.push('URL:' + location.origin + '/#post-' + encodeURIComponent(post.slug));
    lines.push('END:VEVENT', 'END:VCALENDAR');
    var blob = new Blob([lines.map(icsFold).join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = h('a', { href: url, download: post.slug + '.ics' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  /* ----------------------------------------------------------------- toast */

  var toastTimer;
  function toast(msg) {
    var box = document.getElementById('toast');
    if (!box) { box = h('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(box); }
    box.textContent = msg;
    box.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.classList.remove('is-visible'); }, 2200);
  }

  function copyLink(post) {
    var url = location.origin + location.pathname + '#post-' + encodeURIComponent(post.slug);
    var done = function () { toast(t('copied')); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(done, function () { history.replaceState(null, '', url); done(); });
    } else {
      history.replaceState(null, '', url);
      done();
    }
  }

  /* ----------------------------------------------------------------- cards */

  function channelHandle(ch) {
    return h('button', {
      type: 'button', class: 'handle', style: { '--ch': colorOf(ch) }, title: ch.name,
      onclick: function () { selectOnlyChannel(ch.slug); }
    }, ['@' + ch.name]);
  }

  function dateBlock(post) {
    var d = new Date(post.eventStart);
    return h('div', { class: 'date-block', 'aria-hidden': 'true' }, [
      h('span', { class: 'date-weekday', text: fmt(d, { weekday: 'short' }).replace('.', '') }),
      h('span', { class: 'date-day', text: fmt(d, { day: 'numeric' }) }),
      h('span', { class: 'date-month', text: fmt(d, { month: 'short' }).replace('.', '') })
    ]);
  }

  function buildCard(post, variant) {
    var primary = post.primaryChannel || (post.channels || [])[0] || {};
    var isEvent = !!post.eventStart;
    var expanded = state.expanded.has(post.slug);
    var contentId = 'content-' + variant + '-' + post.slug;

    var published = post.publishedAt ? new Date(post.publishedAt) : null;
    var meta = h('div', { class: 'card-meta' }, [
      channelHandle(primary),
      (post.channels || []).filter(function (c) { return c.slug !== primary.slug; }).map(channelHandle),
      published ? h('time', {
        class: 'card-time', datetime: post.publishedAt,
        title: fmt(published, { dateStyle: 'full', timeStyle: 'short' })
      }, [relativeTime(published)]) : null
    ].flat());

    var badges = h('div', { class: 'card-badges' }, [
      post.tag ? h('span', { class: 'badge badge-tag badge-tag-' + post.tag.slug, text: post.tag.name }) : null,
      isEvent && variant === 'event' ? (function () {
        var b = eventBadge(post); return b ? h('span', { class: 'badge ' + b.cls, text: b.text }) : null;
      })() : null
    ]);

    var eventInfo = isEvent ? h('p', { class: 'event-info' }, [svgIcon(ICON.calendar), h('span', { text: eventRange(post) })]) : null;

    var hero = null;
    if (post.heroImage) {
      var src = proxiedImage(post.heroImage.url);
      if (src) {
        hero = h('figure', { class: 'card-hero' }, [h('img', {
          src: src, alt: post.heroImage.alternativeText || '', loading: 'lazy', decoding: 'async',
          width: post.heroImage.width || null, height: post.heroImage.height || null
        })]);
      }
    }

    var content = h('div', { class: 'card-content' + (expanded ? ' is-expanded' : ''), id: contentId },
      (post.content || []).map(renderBlock));

    var toggle = h('button', {
      type: 'button', class: 'more-toggle', 'aria-expanded': String(expanded), 'aria-controls': contentId, hidden: true,
      onclick: function () {
        var open = !content.classList.contains('is-expanded');
        content.classList.toggle('is-expanded', open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.lastChild.textContent = open ? t('showLess') : t('showMore');
        if (open) state.expanded.add(post.slug); else state.expanded.delete(post.slug);
      }
    }, [svgIcon(ICON.chevron), h('span', { text: expanded ? t('showLess') : t('showMore') })]);

    var actions = h('div', { class: 'card-actions' }, [
      toggle,
      h('span', { class: 'spacer' }),
      post.sourceUrl && isSafeHref(post.sourceUrl) ? h('a', {
        class: 'icon-btn', href: post.sourceUrl, target: '_blank', rel: 'noopener noreferrer',
        title: t('source') + ': ' + (post.sourceName || post.sourceUrl)
      }, [svgIcon(ICON.external), h('span', { class: 'icon-btn-label', text: post.sourceName || t('source') })]) : null,
      isEvent ? h('button', {
        type: 'button', class: 'icon-btn', title: t('addToCalendar'), 'aria-label': t('addToCalendar'),
        onclick: function () { downloadIcs(post); }
      }, [svgIcon(ICON.download), h('span', { class: 'icon-btn-label', text: '.ics' })]) : null,
      h('button', {
        type: 'button', class: 'icon-btn', title: t('share'), 'aria-label': t('share'),
        onclick: function () { copyLink(post); }
      }, [svgIcon(ICON.link)])
    ]);

    var body = h('div', { class: 'card-body' }, [
      meta, badges,
      h('h3', { class: 'card-title', text: post.title }),
      eventInfo, hero, content, actions
    ]);

    var card = h('article', {
      class: 'card card-' + variant + (variant === 'event' && !isUpcoming(post) ? ' is-past' : ''),
      id: variant === 'news' ? 'post-' + post.slug : 'event-' + post.slug,
      style: { '--ch': colorOf(primary) },
      'data-slug': post.slug
    }, variant === 'event' ? [dateBlock(post), body] : [body]);

    // Only show the "more" toggle when the clamped content actually overflows.
    requestAnimationFrame(function () {
      var overflowing = content.scrollHeight > content.clientHeight + 4 || content.classList.contains('is-expanded');
      if (content.classList.contains('is-expanded')) {
        content.classList.remove('is-expanded');
        overflowing = content.scrollHeight > content.clientHeight + 4;
        content.classList.add('is-expanded');
      }
      toggle.hidden = !overflowing;
      if (!overflowing) content.classList.add('is-short');
    });

    return card;
  }

  function skeletons(n) {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < n; i++) {
      frag.appendChild(h('div', { class: 'card skeleton', 'aria-hidden': 'true' }, [
        h('div', { class: 'sk sk-line sk-short' }), h('div', { class: 'sk sk-title' }),
        h('div', { class: 'sk sk-line' }), h('div', { class: 'sk sk-line' }), h('div', { class: 'sk sk-line sk-mid' })
      ]));
    }
    return frag;
  }

  /* --------------------------------------------------------------- filters */

  function matches(post) {
    if (state.selectedChannels.size) {
      var hit = (post.channels || []).some(function (c) { return state.selectedChannels.has(c.slug); }) ||
        (post.primaryChannel && state.selectedChannels.has(post.primaryChannel.slug));
      if (!hit) return false;
    }
    if (state.query) {
      var hay = post._search || (post._search = normalize(post.title + ' ' + blocksToText(post.content) + ' ' +
        (post.channels || []).map(function (c) { return c.name; }).join(' ')));
      var terms = normalize(state.query).split(/\s+/).filter(Boolean);
      if (!terms.every(function (term) { return hay.indexOf(term) !== -1; })) return false;
    }
    return true;
  }

  function newsItems() {
    return state.posts.filter(function (p) {
      return matches(p) && (!state.selectedTag || (p.tag && p.tag.slug === state.selectedTag));
    }).sort(function (a, b) {
      return new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0);
    });
  }

  function allEvents() { return state.posts.filter(function (p) { return !!p.eventStart; }); }

  function selectOnlyChannel(slug) {
    state.selectedChannels = new Set([slug]);
    syncUrl(); render();
    el.chipsChannels.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function resetFilters() {
    state.selectedChannels.clear();
    state.selectedTag = null;
    state.query = '';
    el.search.value = '';
    syncUrl(); render();
  }

  /* ------------------------------------------------------------ URL state */

  function readUrl() {
    var p = new URLSearchParams(location.search);
    state.tab = p.get('tab') === 'events' ? 'events' : 'news';
    state.selectedChannels = new Set((p.get('channels') || '').split(',').filter(Boolean));
    state.selectedTag = p.get('tag') || null;
    state.query = p.get('q') || '';
  }

  function syncUrl() {
    var url = new URL(location.href);
    var set = function (k, v) { if (v) url.searchParams.set(k, v); else url.searchParams.delete(k); };
    set('tab', state.tab === 'events' ? 'events' : '');
    set('channels', Array.from(state.selectedChannels).join(','));
    set('tag', state.selectedTag || '');
    set('q', state.query);
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  /* -------------------------------------------------------------- render */

  function renderChips() {
    var counts = {};
    state.posts.forEach(function (p) {
      (p.channels || []).forEach(function (c) { counts[c.slug] = (counts[c.slug] || 0) + 1; });
    });

    el.chipsChannels.replaceChildren(
      h('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(state.selectedChannels.size === 0),
        onclick: function () { state.selectedChannels.clear(); syncUrl(); render(); }
      }, [t('allChannels')])
    );
    state.channels.forEach(function (ch) {
      var on = state.selectedChannels.has(ch.slug);
      el.chipsChannels.appendChild(h('button', {
        type: 'button', class: 'chip chip-channel', 'aria-pressed': String(on), style: { '--ch': colorOf(ch) },
        title: ch.description || ch.name,
        onclick: function () {
          if (state.selectedChannels.has(ch.slug)) state.selectedChannels.delete(ch.slug);
          else state.selectedChannels.add(ch.slug);
          syncUrl(); render();
        }
      }, [h('span', { class: 'chip-dot', 'aria-hidden': 'true' }), ch.name,
        h('span', { class: 'chip-count', text: String(counts[ch.slug] || 0) })]));
    });

    el.chipsTags.replaceChildren(
      h('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(!state.selectedTag),
        onclick: function () { state.selectedTag = null; syncUrl(); render(); }
      }, [t('allTags')])
    );
    state.tags.forEach(function (tag) {
      el.chipsTags.appendChild(h('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(state.selectedTag === tag.slug),
        onclick: function () { state.selectedTag = state.selectedTag === tag.slug ? null : tag.slug; syncUrl(); render(); }
      }, [tag.name]));
    });
    el.tagRow.hidden = state.tab !== 'news' || state.tags.length === 0;
  }

  function renderTabs() {
    ['news', 'events'].forEach(function (name) {
      var tab = document.getElementById('tab-' + name);
      var active = state.tab === name;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      document.getElementById('panel-' + name).hidden = !active || !!(state.error && !state.posts.length);
    });
  }

  function showState(kind) {
    el.state.replaceChildren();
    el.state.hidden = !kind;
    if (!kind) return;
    if (kind === 'error') {
      el.state.appendChild(h('div', { class: 'state-box' }, [
        h('p', { class: 'state-title', text: t('errorTitle') }),
        h('p', { text: t('errorText') }),
        h('button', { type: 'button', class: 'btn btn-primary', onclick: function () { load(true); } }, [t('retry')])
      ]));
    } else if (kind === 'empty') {
      el.state.appendChild(h('div', { class: 'state-box' }, [
        h('p', { class: 'state-title', text: t('emptyTitle') }),
        h('p', { text: t('emptyText') }),
        h('button', { type: 'button', class: 'btn btn-primary', onclick: resetFilters }, [t('resetFilters')])
      ]));
    }
  }

  /* News cards go into independent columns (filled left/right in turn), so
   * expanding one card never pushes down the card in the neighbouring column. */
  var twoColumns = window.matchMedia('(min-width: 940px)');
  function renderColumns(container, cards) {
    var n = twoColumns.matches ? 2 : 1;
    var cols = [];
    for (var i = 0; i < n; i++) cols.push(h('div', { class: 'post-column' }));
    cards.forEach(function (card, idx) { cols[idx % n].appendChild(card); });
    container.replaceChildren.apply(container, cards.length ? cols : []);
  }

  function render() {
    renderTabs();
    renderChips();

    if (state.loading && !state.posts.length) {
      renderColumns(el.newsList, Array.prototype.slice.call(skeletons(4).childNodes));
      el.upcoming.replaceChildren(skeletons(2));
      el.past.replaceChildren();
      el.resultInfo.textContent = t('loading');
      showState(null);
      return;
    }
    if (state.error && !state.posts.length) {
      el.newsList.replaceChildren(); el.upcoming.replaceChildren(); el.past.replaceChildren();
      el.resultInfo.textContent = '';
      showState('error');
      return;
    }

    var filtersActive = state.selectedChannels.size || state.query || (state.tab === 'news' && state.selectedTag);

    if (state.tab === 'news') {
      var items = newsItems();
      renderColumns(el.newsList, items.map(function (p) { return buildCard(p, 'news'); }));
      el.resultInfo.textContent = t('resultsNews', items.length, state.posts.length);
      showState(items.length ? null : 'empty');
    } else {
      var all = allEvents();
      var filtered = all.filter(matches);
      var up = filtered.filter(isUpcoming).sort(function (a, b) { return new Date(a.eventStart) - new Date(b.eventStart); });
      var past = filtered.filter(function (p) { return !isUpcoming(p); }).sort(function (a, b) { return new Date(b.eventStart) - new Date(a.eventStart); });

      el.upcoming.replaceChildren.apply(el.upcoming, up.length ? up.map(function (p) { return buildCard(p, 'event'); })
        : [h('p', { class: 'list-empty', text: t('noUpcoming') })]);
      el.past.replaceChildren.apply(el.past, past.map(function (p) { return buildCard(p, 'event'); }));
      el.pastHeading.hidden = past.length === 0;
      el.resultInfo.textContent = t('resultsEvents', filtered.length, all.length);
      showState(filtered.length === 0 && filtersActive ? 'empty' : null);
      document.getElementById('panel-events').hidden = filtered.length === 0 && !!filtersActive;
    }

    var notes = [];
    if (state.loadedAt) notes.push(t('updated', fmt(state.loadedAt, { hour: '2-digit', minute: '2-digit' })));
    if (state.truncated) notes.push(t('truncated'));
    el.updated.textContent = notes.join(' · ');

    handlePendingHash();
  }

  function handlePendingHash() {
    var hash = state.pendingHash;
    if (!hash || !state.posts.length) return;
    var m = hash.match(/^#(?:post|event)-(.+)$/);
    state.pendingHash = null;
    if (!m) return;
    var slug = decodeURIComponent(m[1]);
    var post = state.posts.find(function (p) { return p.slug === slug; });
    if (!post) return;
    var id = (state.tab === 'events' && post.eventStart ? 'event-' : 'post-') + slug;
    var target = document.getElementById(id);
    if (!target) {
      // Target hidden by filters → reset them and show it in the news feed
      state.selectedChannels.clear(); state.selectedTag = null; state.query = ''; el.search.value = '';
      state.tab = 'news';
      state.pendingHash = hash;
      syncUrl(); render();
      return;
    }
    state.expanded.add(slug);
    var content = target.querySelector('.card-content');
    var toggle = target.querySelector('.more-toggle');
    if (content) content.classList.add('is-expanded');
    if (toggle) { toggle.setAttribute('aria-expanded', 'true'); toggle.lastChild.textContent = t('showLess'); }
    target.classList.add('is-highlighted');
    setTimeout(function () { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
  }

  /* ---------------------------------------------------------------- data */

  function getJson(path) {
    var sep = path.indexOf('?') === -1 ? '?' : '&';
    return fetch(API + path + sep + 'locale=' + window.I18N.lang, { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + path);
        return r.json();
      });
  }

  function fetchAllPosts() {
    return getJson('/posts?pageSize=' + PAGE_SIZE + '&page=1').then(function (first) {
      var pages = (first.meta && first.meta.pagination && first.meta.pagination.totalPages) || 1;
      var rest = [];
      for (var i = 2; i <= pages; i++) rest.push(getJson('/posts?pageSize=' + PAGE_SIZE + '&page=' + i));
      return Promise.all(rest).then(function (more) {
        var all = first.data.slice();
        var truncated = !!(first.meta && first.meta.truncated);
        more.forEach(function (res) { all = all.concat(res.data || []); truncated = truncated || !!(res.meta && res.meta.truncated); });
        var seen = new Set();
        all = all.filter(function (p) { if (seen.has(p.slug)) return false; seen.add(p.slug); return true; });
        return { posts: all, truncated: truncated };
      });
    });
  }

  function load(showSpinner) {
    if (state.loading) return;
    state.loading = true;
    if (showSpinner) { state.error = null; render(); }

    Promise.all([
      getJson('/posts/channels'),
      getJson('/posts/tags').catch(function () { return { data: [] }; }),
      fetchAllPosts(),
      getJson('/environment').catch(function () { return null; })
    ]).then(function (res) {
      state.channels = (res[0].data || []).slice().sort(function (a, b) {
        return (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name);
      });
      state.tags = res[1].data || [];
      state.posts = res[2].posts;
      state.truncated = res[2].truncated;
      state.loadedAt = new Date();
      state.error = null;
      var banner = document.getElementById('test-banner');
      if (banner) banner.hidden = !(res[3] && res[3].data && res[3].data.userTestData);
    }).catch(function (err) {
      state.error = err;
      if (window.console) console.warn('[campus-koethen] load failed:', err);
    }).finally(function () {
      state.loading = false;
      render();
    });
  }

  /* ---------------------------------------------------------------- init */

  function initTabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () {
        state.tab = tab.getAttribute('data-tab');
        syncUrl(); render();
      });
      tab.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        var next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        next.focus(); next.click();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    el.newsList = document.getElementById('news-list');
    el.upcoming = document.getElementById('events-upcoming');
    el.past = document.getElementById('events-past');
    el.pastHeading = document.getElementById('past-heading');
    el.chipsChannels = document.getElementById('channel-chips');
    el.chipsTags = document.getElementById('tag-chips');
    el.tagRow = document.getElementById('tag-row');
    el.search = document.getElementById('search');
    el.resultInfo = document.getElementById('result-info');
    el.state = document.getElementById('state');
    el.updated = document.getElementById('updated');

    readUrl();
    el.search.value = state.query;
    initTabs();

    var searchTimer;
    el.search.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { state.query = el.search.value.trim(); syncUrl(); render(); }, 150);
    });

    var onLayoutChange = function () { if (state.tab === 'news') render(); };
    if (twoColumns.addEventListener) twoColumns.addEventListener('change', onLayoutChange);
    else if (twoColumns.addListener) twoColumns.addListener(onLayoutChange);

    window.addEventListener('hashchange', function () { state.pendingHash = location.hash; handlePendingHash(); });

    window.I18N.onChange(function () {
      state.posts.forEach(function (p) { delete p._search; });
      load(false);
      render();
    });

    setInterval(function () { if (document.visibilityState === 'visible') load(false); }, REFRESH_MS);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && state.loadedAt && Date.now() - state.loadedAt > REFRESH_MS) load(false);
    });

    state.loading = false;
    load(true);
  });
})();
