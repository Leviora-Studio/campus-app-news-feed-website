/* Campus Köthen – News & Events · UI texts and language handling (shared by all pages) */
(function () {
  'use strict';

  var STORAGE_KEY = 'ck-lang';

  var DICT = {
    de: {
      skip: 'Zum Inhalt springen',
      testBanner: 'Hinweis: Diese Umgebung kann Testinhalte enthalten.',
      getApp: 'App laden',
      eyebrow: 'Neuigkeiten & Veranstaltungen in Köthen',
      heroLine1: 'Was geht.',
      heroLine2: 'Auf dem Campus.',
      heroLead: 'Alle News und Events am Campus Köthen – direkt aus der Campus-Köthen-App, übersichtlich an einem Ort.',
      feedHeading: 'Feed',
      tabNews: 'Neuigkeiten',
      tabEvents: 'Veranstaltungen',
      searchLabel: 'Suchen',
      searchPlaceholder: 'Titel oder Text durchsuchen …',
      filterChannels: 'Kanäle',
      filterTags: 'Art',
      allChannels: 'Alle Kanäle',
      allTags: 'Alle',
      upcoming: 'Kommende Veranstaltungen',
      past: 'Vergangene Veranstaltungen',
      appEyebrow: 'Campus Köthen App',
      appHeading: 'Dein Campus. In einer App.',
      appText: 'Stundenplan, Mensa, Neuigkeiten und Hochschuldienste – News-Kanälen folgen und Erinnerungen erhalten, direkt auf deinem Smartphone.',
      getNow: 'Jetzt laden',
      footerContent: 'Inhalte: Studierendenschaft der Hochschule Anhalt, Standort Köthen.',
      imprint: 'Impressum',
      privacy: 'Datenschutz',
      appWebsite: 'App-Website',
      independence: 'Keine offizielle Website der Hochschule Anhalt.',
      showMore: 'Mehr anzeigen',
      showLess: 'Weniger anzeigen',
      source: 'Quelle',
      share: 'Link kopieren',
      copied: 'Link kopiert',
      addToCalendar: 'In Kalender (.ics)',
      allDay: 'ganztägig',
      today: 'Heute',
      tomorrow: 'Morgen',
      now: 'Läuft gerade',
      loading: 'Lade Beiträge …',
      errorTitle: 'Die Inhalte konnten gerade nicht geladen werden.',
      errorText: 'Bitte versuche es in einem Moment erneut.',
      retry: 'Erneut versuchen',
      emptyTitle: 'Keine Treffer',
      emptyText: 'Für diese Auswahl gibt es gerade nichts. Passe die Filter an oder setze sie zurück.',
      resetFilters: 'Filter zurücksetzen',
      noUpcoming: 'Aktuell sind keine kommenden Veranstaltungen angekündigt.',
      noPast: 'Keine vergangenen Veranstaltungen.',
      resultsNews: function (n, t) { return n === t ? n + (n === 1 ? ' Beitrag' : ' Beiträge') : n + ' von ' + t + ' Beiträgen'; },
      resultsEvents: function (n, t) { return n === t ? n + (n === 1 ? ' Veranstaltung' : ' Veranstaltungen') : n + ' von ' + t + ' Veranstaltungen'; },
      updated: function (time) { return 'Zuletzt aktualisiert: ' + time + ' Uhr'; },
      truncated: 'Hinweis: Die Liste wurde vom Server gekürzt und ist möglicherweise unvollständig.',
      untilTime: 'bis',
      clock: 'Uhr',
      imageAlt: 'Beitragsbild',
      back: '← Zurück zur Übersicht',
      switchLang: 'Switch to English',
      tabsLabel: 'Ansicht',
      pastToggleShow: 'Vergangene anzeigen',
      filtersLabel: 'Filter',
      calendarBadge: 'Kalender',
      cancelled: 'Abgesagt',
      openInGoogle: 'Im Google Kalender öffnen'
    },
    en: {
      skip: 'Skip to content',
      testBanner: 'Note: this environment may contain test content.',
      getApp: 'Get the app',
      eyebrow: 'News & events in Köthen',
      heroLine1: "What's on.",
      heroLine2: 'Around campus.',
      heroLead: 'All news and events at Campus Köthen – straight from the Campus Köthen app, neatly in one place.',
      feedHeading: 'Feed',
      tabNews: 'News',
      tabEvents: 'Events',
      searchLabel: 'Search',
      searchPlaceholder: 'Search titles and text …',
      filterChannels: 'Channels',
      filterTags: 'Type',
      allChannels: 'All channels',
      allTags: 'All',
      upcoming: 'Upcoming events',
      past: 'Past events',
      appEyebrow: 'Campus Köthen app',
      appHeading: 'Your campus. In one app.',
      appText: 'Timetable, canteen, news and university services – follow news channels and get reminders right on your phone.',
      getNow: 'Get it on',
      footerContent: 'Content: Student Body of Anhalt University of Applied Sciences, Köthen campus.',
      imprint: 'Legal notice',
      privacy: 'Privacy',
      appWebsite: 'App website',
      independence: 'Not an official website of Anhalt University of Applied Sciences.',
      showMore: 'Show more',
      showLess: 'Show less',
      source: 'Source',
      share: 'Copy link',
      copied: 'Link copied',
      addToCalendar: 'Add to calendar (.ics)',
      allDay: 'all day',
      today: 'Today',
      tomorrow: 'Tomorrow',
      now: 'Happening now',
      loading: 'Loading posts …',
      errorTitle: 'The content could not be loaded right now.',
      errorText: 'Please try again in a moment.',
      retry: 'Try again',
      emptyTitle: 'Nothing found',
      emptyText: 'There is nothing for this selection right now. Adjust or reset the filters.',
      resetFilters: 'Reset filters',
      noUpcoming: 'No upcoming events have been announced yet.',
      noPast: 'No past events.',
      resultsNews: function (n, t) { return n === t ? n + (n === 1 ? ' post' : ' posts') : n + ' of ' + t + ' posts'; },
      resultsEvents: function (n, t) { return n === t ? n + (n === 1 ? ' event' : ' events') : n + ' of ' + t + ' events'; },
      updated: function (time) { return 'Last updated: ' + time; },
      truncated: 'Note: the server shortened this list, it may be incomplete.',
      untilTime: 'until',
      clock: '',
      imageAlt: 'Post image',
      back: '← Back to overview',
      switchLang: 'Auf Deutsch umschalten',
      tabsLabel: 'View',
      pastToggleShow: 'Show past events',
      filtersLabel: 'Filters',
      calendarBadge: 'Calendar',
      cancelled: 'Cancelled',
      openInGoogle: 'Open in Google Calendar'
    }
  };

  function readStoredLang() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function storeLang(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* storage unavailable – ignore */ }
  }

  function detectLang() {
    var params = new URLSearchParams(location.search);
    var fromUrl = params.get('lang');
    if (fromUrl === 'de' || fromUrl === 'en') return fromUrl;
    var stored = readStoredLang();
    if (stored === 'de' || stored === 'en') return stored;
    var nav = (navigator.language || 'de').toLowerCase();
    return nav.indexOf('de') === 0 ? 'de' : 'en';
  }

  var listeners = [];
  var I18N = {
    lang: detectLang(),
    t: function (key) {
      var d = DICT[I18N.lang] || DICT.de;
      var v = d[key];
      if (v === undefined) v = DICT.de[key];
      if (typeof v === 'function') return v.apply(null, Array.prototype.slice.call(arguments, 1));
      return v === undefined ? key : v;
    },
    locale: function () { return I18N.lang === 'en' ? 'en-GB' : 'de-DE'; },
    apply: function (root) {
      root = root || document;
      document.documentElement.lang = I18N.lang;
      root.querySelectorAll('[data-i18n]').forEach(function (el) {
        el.textContent = I18N.t(el.getAttribute('data-i18n'));
      });
      root.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
        el.setAttribute('placeholder', I18N.t(el.getAttribute('data-i18n-placeholder')));
      });
      root.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
        el.setAttribute('aria-label', I18N.t(el.getAttribute('data-i18n-aria')));
      });
      // Pages with bilingual static content (e.g. legal page) mark blocks with data-lang
      root.querySelectorAll('[data-lang]').forEach(function (el) {
        el.hidden = el.getAttribute('data-lang') !== I18N.lang;
      });
      var toggle = document.getElementById('lang-toggle');
      if (toggle) {
        toggle.textContent = I18N.lang === 'de' ? 'EN' : 'DE';
        toggle.setAttribute('aria-label', I18N.t('switchLang'));
        toggle.setAttribute('lang', I18N.lang === 'de' ? 'en' : 'de');
      }
    },
    set: function (lang) {
      if (lang !== 'de' && lang !== 'en') return;
      I18N.lang = lang;
      storeLang(lang);
      var url = new URL(location.href);
      if (url.searchParams.has('lang')) { url.searchParams.set('lang', lang); history.replaceState(null, '', url); }
      I18N.apply();
      listeners.forEach(function (fn) { fn(lang); });
    },
    onChange: function (fn) { listeners.push(fn); }
  };

  window.I18N = I18N;

  document.addEventListener('DOMContentLoaded', function () {
    I18N.apply();
    var toggle = document.getElementById('lang-toggle');
    if (toggle) {
      toggle.addEventListener('click', function () { I18N.set(I18N.lang === 'de' ? 'en' : 'de'); });
    }
    // Legal page: "#impressum" / "#datenschutz" point to the English section when English is active
    function jumpToLocalizedAnchor() {
      if (I18N.lang !== 'en' || !location.hash) return;
      var en = document.getElementById(location.hash.slice(1) + '-en');
      if (en) en.scrollIntoView();
    }
    jumpToLocalizedAnchor();
    window.addEventListener('hashchange', jumpToLocalizedAnchor);
  });
})();
