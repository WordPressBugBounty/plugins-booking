"use strict";

// ---------------------------------------------------------------------------------------------------------------------
// == File  /includes/page-form-builder/field-packs/calendar/_out/calendar.js
// == Pack  Calendar (WP-template–driven) — minimal, modern, and Builder-focused renderer
// == Compatible with PHP pack: ../calendar.php (version 1.2.2)
// ---------------------------------------------------------------------------------------------------------------------
(function (w) {
  'use strict';

  // Direct dev logger alias (snake format); no local wrappers.
  const dev = w._wpbc && w._wpbc.dev ? w._wpbc.dev : {
    log() {},
    error() {}
  };

  // Core singletons from the Builder.
  var Core = w.WPBC_BFB_Core || {};
  var Registry = Core.WPBC_BFB_Field_Renderer_Registry;
  var Field_Base = Core.WPBC_BFB_Field_Base || null;
  if (!Registry || !Registry.register) {
    dev.error('WPBC_BFB_Field_Calendar', 'Registry missing — load bfb-core first.');
    return;
  }

  // Localized boot payload from PHP (calendar.php::enqueue_js()).
  var Boot = w.WPBC_BFB_CalendarBoot || {};

  // Remember which resource IDs already have their data loaded this session.
  var rid_loaded_cache = Object.create(null);

  // -----------------------------------------------------------------------------------------------------------------
  // Resource ID Helpers
  // -----------------------------------------------------------------------------------------------------------------
  /**
   *  Get configured preview booking resource ID from localized boot data.
   *
   * @returns {number}
   */
  function get_configured_preview_resource_id() {
    var rid = Number(Boot.default_preview_resource_id || 1);
    rid = isFinite(rid) ? Math.max(1, Math.floor(rid)) : 1;
    return rid;
  }

  /**
   * Get first existing booking resource ID from localized boot data.
   *
   * @returns {number}
   */
  function get_first_existing_resource_id() {
    var resources = Array.isArray(Boot.booking_resources) ? Boot.booking_resources : [];
    for (var i = 0; i < resources.length; i++) {
      var id = Number(resources[i] && resources[i].booking_type_id);
      if (isFinite(id) && id > 0) {
        return Math.floor(id);
      }
    }
    return 1;
  }

  /**
   * Resolve effective preview booking resource ID.
   * Priority:
   * 1. Configured default preview resource, if it exists
   * 2. Provided rid, if it exists
   * 3. First existing booking resource
   * 4. Fallback to 1
   *
   * @param {number} rid_candidate
   * @returns {number}
   */
  function resolve_effective_resource_id(rid_candidate) {
    var resources = Array.isArray(Boot.booking_resources) ? Boot.booking_resources : [];
    var configured_rid = get_configured_preview_resource_id();
    var candidate = Number(rid_candidate || 1);
    function resource_exists(id) {
      id = Number(id || 1);
      if (!isFinite(id) || id <= 0) {
        return false;
      }
      for (var i = 0; i < resources.length; i++) {
        if (Number(resources[i] && resources[i].booking_type_id) === id) {
          return true;
        }
      }
      return false;
    }
    if (resource_exists(configured_rid)) {
      return configured_rid;
    }
    if (resource_exists(candidate)) {
      return candidate;
    }
    return get_first_existing_resource_id();
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Small utilities
  // -----------------------------------------------------------------------------------------------------------------

  /**
   * Debounce wrapper.
   *
   * @param {Function} fn
   * @param {number}   ms
   * @returns {Function}
   */
  function debounce(fn, ms) {
    var t;
    return function () {
      var a = arguments;
      clearTimeout(t);
      t = setTimeout(function () {
        fn.apply(null, a);
      }, ms);
    };
  }

  /**
   * Wait until calendar API is present in the window (e.g., wpbc_calendar_show).
   *
   * @param {Function} cb           Callback when ready.
   * @param {number}   max_tries    Maximum retry attempts.
   * @param {number}   delay_ms     Delay between attempts.
   */
  function wait_until_api_ready(cb, max_tries, delay_ms) {
    var tries = 0;
    (function tick() {
      if (typeof w.wpbc_calendar_show === 'function') {
        try {
          cb();
        } catch (e) {
          dev.error('api_ready_cb', e);
        }
        return;
      }
      if (tries++ >= (max_tries || 40)) {
        dev.log('calendar_api_not_ready_after_retries');
        return;
      }
      w.setTimeout(tick, delay_ms || 100);
    })();
  }

  /**
   * Apply "months in row" class to container element.
   *
   * @param {Element} field_el  Field root element (wrap).
   * @param {number}  months    1..12
   */
  function apply_months_class(field_el, months) {
    var cont = field_el ? field_el.querySelector('.wpbc_cal_container') : null;
    if (!cont) {
      return;
    }
    // Remove existing cal_month_num_* safely via classList.
    Array.from(cont.classList).forEach(function (c) {
      if (/^cal_month_num_\d+$/.test(c)) {
        cont.classList.remove(c);
      }
    });
    cont.classList.add('cal_month_num_' + months);
  }

  /**
   * Set secure parameters (nonce, user_id, locale) before any AJAX calls.
   */
  function set_secure_params() {
    try {
      if (!(w._wpbc && typeof w._wpbc.set_secure_param === 'function')) {
        return;
      }
      if (Boot.nonce) {
        w._wpbc.set_secure_param('nonce', String(Boot.nonce));
      }
      if (Boot.user_id != null) {
        w._wpbc.set_secure_param('user_id', String(Boot.user_id));
      }
      if (Boot.locale) {
        w._wpbc.set_secure_param('locale', String(Boot.locale));
      }
    } catch (e) {
      dev.log('secure_params_skip', e);
    }
  }

  /**
   * Builder canvas preview starts at next month so it does not mostly show past/unavailable dates near month end.
   *
   * @returns {number[]} [year, month]
   */
  function get_canvas_next_month_scroll_to() {
    var today_arr = null;
    try {
      if (w._wpbc && typeof w._wpbc.get_other_param === 'function') {
        today_arr = w._wpbc.get_other_param('today_arr');
      }
    } catch (e) {}
    var base_date = new Date();
    if (today_arr && today_arr.length >= 2) {
      base_date = new Date(Number(today_arr[0]), Number(today_arr[1]) - 1, 1);
    } else {
      base_date.setDate(1);
    }
    base_date.setMonth(base_date.getMonth() + 1);
    return [base_date.getFullYear(), base_date.getMonth() + 1];
  }

  /**
   * Push calendar environment parameters for a specific resource and months count.
   * We *directly* set parameters (no global polyfill) to keep this file self-contained.
   *
   * @param {number} rid
   * @param {number} months
   */
  function set_calendar_params(rid, months) {
    var L = Boot || {};
    try {
      if (w._wpbc && typeof w._wpbc.balancer__set_max_threads === 'function') {
        w._wpbc.balancer__set_max_threads(Number(L.balancer_max_threads || 1));
      }
    } catch (e) {}
    function set_param(k, v) {
      try {
        if (w._wpbc && typeof w._wpbc.calendar__set_param_value === 'function') {
          w._wpbc.calendar__set_param_value(rid, k, v);
        }
      } catch (e) {}
    }
    if (L.booking_max_monthes_in_calendar != null) {
      set_param('booking_max_monthes_in_calendar', String(L.booking_max_monthes_in_calendar));
    }
    if (L.booking_start_day_weeek != null) {
      set_param('booking_start_day_weeek', String(L.booking_start_day_weeek));
    }
    set_param('calendar_number_of_months', String(months));
    set_param('calendar_scroll_to', get_canvas_next_month_scroll_to());
    if (L.booking_date_format) {
      set_param('booking_date_format', String(L.booking_date_format));
    }
    if (L.booking_time_format) {
      set_param('booking_time_format', String(L.booking_time_format));
    }
    var ds = L.days_selection || {};
    set_param('days_select_mode', String(ds.days_select_mode || 'multiple'));
    set_param('fixed__days_num', Number(ds.fixed__days_num || 0));
    if (ds.fixed__week_days__start != null) {
      set_param('fixed__week_days__start', [String(ds.fixed__week_days__start)]);
    }
    set_param('dynamic__days_min', Number(ds.dynamic__days_min || 0));
    set_param('dynamic__days_max', Number(ds.dynamic__days_max || 0));
    if (ds.dynamic__days_specific != null) {
      var arr = String(ds.dynamic__days_specific || '').split(/\s*,\s*/).filter(Boolean).map(Number);
      set_param('dynamic__days_specific', arr);
    }
    if (ds.dynamic__week_days__start != null) {
      set_param('dynamic__week_days__start', [String(ds.dynamic__week_days__start)]);
    }
    try {
      if (typeof w.wpbc__conditions__SAVE_INITIAL__days_selection_params__bm === 'function') {
        w.wpbc__conditions__SAVE_INITIAL__days_selection_params__bm(rid);
      }
    } catch (e) {}
  }

  /**
   * Extract sanitized rid and months from data or DOM.
   *
   * @param {Element} field_el
   * @param {object}  data
   * @returns {{rid:number, months:number}}
   */
  function get_rid_and_months(field_el, data) {
    var rid = 1;
    var months = 1;

    // NEW: prefer dataset on the wrap (Inspector edits land here first)
    var wrap = field_el ? field_el.closest && field_el.closest('.wpbc_calendar_wraper') || field_el : null;
    if (wrap && wrap.dataset) {
      if (wrap.dataset.resource_id != null && wrap.dataset.resource_id !== '') {
        rid = Number(wrap.dataset.resource_id);
      }
      if (wrap.dataset.months != null && wrap.dataset.months !== '') {
        months = Number(wrap.dataset.months);
      }
    }
    if (data && data.resource_id != null) {
      rid = Number(data.resource_id);
    }
    if (data && data.months != null) {
      months = Number(data.months);
    }
    if (!data) {
      // Fallbacks from DOM when data object is not provided.
      var n = field_el ? field_el.querySelector('[id^="calendar_booking"]') : null;
      if (n && n.id) {
        var m1 = n.id.match(/calendar_booking(\d+)/);
        if (m1) {
          rid = Number(m1[1]);
        }
      }
      var cont = field_el ? field_el.querySelector('.wpbc_cal_container') : null;
      if (cont && cont.className) {
        var m2 = cont.className.match(/cal_month_num_(\d+)/);
        if (m2) {
          months = Number(m2[1]);
        }
      }
    }

    // FixIn: 2026-03-07   Override to  always get the default booking resource,  for specific user in MU or for existed resourecs !
    rid = resolve_effective_resource_id(rid);
    months = isFinite(months) ? Math.max(1, Math.min(12, Math.floor(months))) : 1;
    return {
      rid: rid,
      months: months
    };
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Minimal preview bootstrap — load/refresh a calendar for a field
  // -----------------------------------------------------------------------------------------------------------------

  /**
   * Initialize (or update) a calendar preview for a given field element.
   *
   * @param {Element} field_el           - calendar field element (wrap)
   * @param {object}  data               - builder field data (optional)
   * @param {boolean} should_reload_data - force AJAX data reload
   */
  function init_field(field_el, data, should_reload_data = true) {
    if (!field_el) {
      return;
    }
    var pair = get_rid_and_months(field_el, data);
    var rid = pair.rid;
    wait_until_api_ready(function () {
      // 1) Always (re)apply local UI — needed after DOM moves.
      apply_months_class(field_el, pair.months);
      set_calendar_params(rid, pair.months);
      try {
        w.wpbc_calendar_show(String(rid));
      } catch (e1) {
        dev.error('wpbc_calendar_show', e1);
      }
      set_secure_params();

      // 2) Decide on AJAX strictly by RID state + explicit request.
      var first_time_for_rid = !rid_loaded_cache[rid];
      // Respect caller intent. Reload only if explicitly asked OR first time for this RID.
      var do_reload = !!should_reload_data || first_time_for_rid;
      try {
        if (typeof w.wpbc_calendar__load_data__ajx === 'function') {
          if (do_reload) {
            w.wpbc_calendar__load_data__ajx({
              'resource_id': rid,
              'booking_hash': '',
              'request_uri': Boot.request_uri || (w.location ? String(w.location.pathname + w.location.search) : ''),
              'custom_form': 'standard',
              'aggregate_resource_id_str': '',
              'aggregate_type': 'all'
            });
            // Mark this rid as loaded so subsequent DOM churn uses look-only refresh.
            rid_loaded_cache[rid] = true;
          } else if (typeof w.wpbc_calendar__update_look === 'function') {
            w.wpbc_calendar__update_look(rid);
          }
        }
      } catch (e2) {
        dev.log('calendar_data_load_skip', e2);
      }

      // Track last config for soft dedupe (UI churn); keep per-element.
      try {
        field_el.setAttribute('data-wpbc-cal-init', '1');
        field_el.setAttribute('data-wpbc-cal-loaded-rid', String(rid));
      } catch (e3) {}
      try {
        apply_calendar_legend_preview_from_controls();
      } catch (e4) {}
    }, 40, 100);
  }

  // -----------------------------------------------------------------------------------------------------------------
  // FOCS: tiny bus & DOM helpers (snake format)
  // -----------------------------------------------------------------------------------------------------------------
  const defer_fn = fn => typeof w.requestAnimationFrame === 'function' ? w.requestAnimationFrame(fn) : setTimeout(fn, 0);
  function find_calendar_wrap(el) {
    if (!el) {
      return null;
    }
    return el.closest && el.closest('.wpbc_calendar_wraper') || el;
  }
  function is_calendar_wrap(el) {
    var wrap = find_calendar_wrap(el);
    return !!(wrap && (wrap.dataset && wrap.dataset.type === 'calendar' || wrap.querySelector && wrap.querySelector('[id^="calendar_booking"]')));
  }
  function look_refresh(target, opts) {
    var o = opts || {};
    var wrap = find_calendar_wrap(target);
    if (!wrap || !document.contains(wrap)) {
      return;
    }
    defer_fn(function () {
      init_field(wrap, null, !!o.reload);
    });
  }
  function on_event(type, handler) {
    document.addEventListener(type, handler);
  }
  function get_calendar_skin_url_from_select(select_el) {
    if (!select_el || !select_el.options) {
      return '';
    }
    var selected_option = select_el.options[select_el.selectedIndex];
    if (selected_option) {
      return String(selected_option.getAttribute('data-wpbc-calendar-skin-url') || select_el.value || '');
    }
    return String(select_el.value || '');
  }
  function apply_calendar_skin_from_select(select_el) {
    var skin_url = get_calendar_skin_url_from_select(select_el);
    if (!skin_url || typeof w.wpbc__calendar__change_skin !== 'function') {
      return;
    }
    try {
      w.wpbc__calendar__change_skin(skin_url);
    } catch (e) {
      dev.error('calendar_skin_preview', e);
    }
  }
  function bind_calendar_skin_preview_events() {
    document.addEventListener('change', function (e) {
      var target = e && e.target;
      if (target && target.matches && target.matches('.js-wpbc-bfb-calendar-skin')) {
        apply_calendar_skin_from_select(target);
      }
    }, true);
  }
  function escape_html(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  var legend_item_option_map = {
    available: {
      show: 'booking_legend_is_show_item_available',
      text: 'booking_legend_text_for_item_available'
    },
    pending: {
      show: 'booking_legend_is_show_item_pending',
      text: 'booking_legend_text_for_item_pending'
    },
    approved: {
      show: 'booking_legend_is_show_item_approved',
      text: 'booking_legend_text_for_item_approved'
    },
    partially: {
      show: 'booking_legend_is_show_item_partially',
      text: 'booking_legend_text_for_item_partially'
    },
    unavailable: {
      show: 'booking_legend_is_show_item_unavailable',
      text: 'booking_legend_text_for_item_unavailable'
    }
  };
  function get_checkbox_value_from_id(id, fallback) {
    var el = document.getElementById(id);
    if (el) {
      return el.checked ? 'On' : 'Off';
    }
    return fallback === 'On' ? 'On' : 'Off';
  }
  function get_text_value_from_id(id, fallback) {
    var el = document.getElementById(id);
    if (el) {
      return String(el.value || '');
    }
    return String(fallback || '');
  }
  function get_calendar_legend_values_from_controls() {
    var boot_legend = Boot.calendar_legend || {};
    var boot_items = boot_legend.items || {};
    var values = {
      show_legend: get_checkbox_value_from_id('booking_is_show_legend', boot_legend.show_legend),
      show_numbers: get_checkbox_value_from_id('booking_legend_is_show_numbers', boot_legend.show_numbers),
      is_vertical: get_checkbox_value_from_id('booking_legend_is_vertical', boot_legend.is_vertical),
      items: {}
    };
    Object.keys(legend_item_option_map).forEach(function (item_key) {
      var map = legend_item_option_map[item_key];
      var boot_item = boot_items[item_key] || {};
      values.items[item_key] = {
        show: get_checkbox_value_from_id(map.show, boot_item.show),
        title: get_text_value_from_id(map.text, boot_item.title || boot_item.placeholder || '')
      };
    });
    return values;
  }
  function extract_legend_item_html(template_html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = String(template_html || '');
    var item = tmp.querySelector('.wpdev_hint_with_text');
    return item ? item.outerHTML : '';
  }
  function render_calendar_legend_html(values) {
    var boot_legend = Boot.calendar_legend || {};
    var boot_items = boot_legend.items || {};
    var order = Array.isArray(boot_legend.items_order) ? boot_legend.items_order : Object.keys(legend_item_option_map);
    var html = '';
    if (!values || values.show_legend !== 'On') {
      return '';
    }
    order.forEach(function (item_key) {
      var item_values = values.items[item_key] || {};
      var boot_item = boot_items[item_key] || {};
      var template = values.show_numbers === 'On' ? boot_item.template_number : boot_item.template_blank;
      var item_html = extract_legend_item_html(template);
      if (item_values.show !== 'On' || !item_html) {
        return;
      }
      item_html = item_html.replace(/__WPBC_LEGEND_TITLE__/g, escape_html(item_values.title || boot_item.placeholder || ''));
      html += item_html;
    });
    if (!html) {
      return '';
    }
    return '<div class="block_hints datepick ' + (values.is_vertical === 'On' ? ' block_hints_vertical ' : '') + '">' + html + '</div>';
  }
  function store_calendar_legend_values_in_boot(values) {
    Boot.calendar_legend = Boot.calendar_legend || {};
    Boot.calendar_legend.items = Boot.calendar_legend.items || {};
    Boot.calendar_legend.show_legend = values.show_legend;
    Boot.calendar_legend.show_numbers = values.show_numbers;
    Boot.calendar_legend.is_vertical = values.is_vertical;
    Object.keys(values.items || {}).forEach(function (item_key) {
      Boot.calendar_legend.items[item_key] = Boot.calendar_legend.items[item_key] || {};
      Boot.calendar_legend.items[item_key].show = values.items[item_key].show;
      Boot.calendar_legend.items[item_key].title = values.items[item_key].title;
    });
  }
  function apply_calendar_legend_preview_from_controls() {
    var values = get_calendar_legend_values_from_controls();
    var html = render_calendar_legend_html(values);
    var nodes = document.querySelectorAll('.js-wpbc-bfb-calendar-legend-preview');
    store_calendar_legend_values_in_boot(values);
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].innerHTML = html;
    }
  }
  function sync_calendar_legend_inspector_visibility() {
    var main = document.getElementById('booking_is_show_legend');
    var options = document.querySelector('.js-wpbc-bfb-calendar-legend-options');
    if (!main || !options) {
      return;
    }
    options.style.display = main.checked ? '' : 'none';
  }
  function bind_calendar_legend_preview_events() {
    function on_inspector_render() {
      sync_calendar_legend_inspector_visibility();
    }
    document.addEventListener('change', function (e) {
      var target = e && e.target;
      if (target && target.matches && target.matches('.js-wpbc-bfb-calendar-legend-control')) {
        sync_calendar_legend_inspector_visibility();
        apply_calendar_legend_preview_from_controls();
      }
    }, true);
    document.addEventListener('input', debounce(function (e) {
      var target = e && e.target;
      if (target && target.matches && target.matches('.js-wpbc-bfb-calendar-legend-control')) {
        apply_calendar_legend_preview_from_controls();
      }
    }, 150), true);
    document.addEventListener('wpbc_bfb_inspector_ready', on_inspector_render);
    document.addEventListener('wpbc_bfb_inspector_render', on_inspector_render);
  }

  /**
   * Initialize all calendars present in the current Builder preview panel.
   */
  function init_all_on_page(should_reload_data = true) {
    var scope = w.document.querySelector('#wpbc_bfb__pages_panel') || w.document;
    var nodes = scope.querySelectorAll('[id^="calendar_booking"]');
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var field_el = node.closest('.wpbc_calendar_wraper') || node.parentElement || node;
      init_field(field_el, null, should_reload_data);
    }
  }

  /**
   * Listen to builder’s bus (events bubble on document via Core.WPBC_BFB_EventBus)
   */
  function bind_builder_bus_events() {
    // Alias events once.
    var EV = Core.WPBC_BFB_Events || {};

    // 1) First structure ready -> look-only render.
    on_event(EV.STRUCTURE_LOADED, function () {
      init_all_on_page(false);
    });

    // 2) Field/section added -> initialize that node if it’s a calendar (force reload).
    on_event(EV.FIELD_ADD, function (e) {
      var el = e && e.detail && e.detail.el;
      if (!el) {
        // Defensive fallback: if emitter didn’t provide the element, refresh all calendars (look-only).
        return defer_fn(function () {
          init_all_on_page(false);
        });
      }
      if (is_calendar_wrap(el)) {
        look_refresh(el, {
          reload: true
        }); // builder just inserted; So do Ajax fetch data.
      }
    });

    // 3) Generic structure changes.
    on_event(EV.STRUCTURE_CHANGE, function (e) {
      var d = e && e.detail || {};
      var reason = d.reason || '';

      // Heavy operations -> cheap look refresh for all calendars, no data reload.
      if (reason === 'sort-update' || reason === 'section-move' || reason === 'delete') {
        return defer_fn(function () {
          init_all_on_page(false);
        });
      }

      // Only care about calendar targets.
      if (!is_calendar_wrap(d.el)) return;

      // Only reload data on committed resource_id changes.
      var k = d.key || '';
      var phase = (d.phase || '').toLowerCase(); // set by the emitter above.
      if (k === 'resource_id' && phase !== 'change') {
        return; // Skip on second input handler: ins.addEventListener( 'input', handler, true );  in ../includes/page-form-builder/__js/core/bfb-ui.js //.
      }
      // Replace to  TRUE,  if needs to  FORCE ajax reload of calendar  data of resource ID change.
      var must_reload = k === 'resource_id' && phase === 'change' ? false : false;
      look_refresh(d.el, {
        reload: must_reload
      });
    });
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Field Renderer (class-like, extendable)
  // -----------------------------------------------------------------------------------------------------------------
  class WPBC_BFB_Field_Calendar extends (Field_Base || class {}) {
    static template_id = 'wpbc-bfb-field-calendar'; // Underscore template id from PHP printer.
    static kind = 'calendar';

    /**
     * Default props — keep in sync with PHP schema defaults.
     */
    static get_defaults() {
      return {
        type: 'calendar',
        label: 'Select Date',
        resource_id: resolve_effective_resource_id(1),
        months: 1,
        name: '',
        html_id: '',
        cssclass: '',
        help: '',
        min_width: '250px'
      };
    }

    /**
     * Called by the Builder after the field is dropped/loaded/previewed.
     * We (re)initialize the preview for the specific element.
     *
     * @param {object}  data
     * @param {Element} field_el
     * @param {{context:string}} ctx
     */
    static on_field_drop(data, field_el, ctx) {
      try {
        init_field(field_el, data, false);
      } catch (e) {
        dev.error('WPBC_BFB_Field_Calendar.on_field_drop', e);
      }
    }

    /**
     * Hydrate after preview render (no rebuild). Called by builder.render_preview().
     */
    static hydrate(field_el, data, ctx) {
      try {
        init_field(field_el, data, false);
      } catch (e) {
        dev.error('WPBC_BFB_Field_Calendar.hydrate', e);
      }
    }
  }

  // Register pack renderer with the central registry.
  try {
    Registry.register('calendar', WPBC_BFB_Field_Calendar);
  } catch (e) {
    dev.error('WPBC_BFB_Field_Calendar.register', e);
  }

  // Bootstrap: on DOM ready, run a first scan and wire light reactivity.
  function on_ready(fn) {
    if (w.document.readyState === 'interactive' || w.document.readyState === 'complete') {
      try {
        fn();
      } catch (e) {}
    } else {
      w.document.addEventListener('DOMContentLoaded', function () {
        try {
          fn();
        } catch (e) {}
      });
    }
  }
  on_ready(function () {
    setTimeout(function () {
      init_all_on_page(false);
      bind_builder_bus_events();
      bind_calendar_skin_preview_events();
      bind_calendar_legend_preview_events();
      sync_calendar_legend_inspector_visibility();
    }, 0);
  });

  // Optional export (handy for debugging).
  w.WPBC_BFB_Field_Calendar = WPBC_BFB_Field_Calendar;

  // -- Export for "Booking Form" ------------------------------------------------------------------------------------

  /**
   * Register the "calendar" exporter (lazy: tries now, or waits for exporter-ready).
   * Output:
   *   • [calendar] only (no rid/months/class/id tokens inside)
   *   • If html_id / cssclass set → wrap shortcode in <span ... style="flex:1;">…</span>
   *   • Label above (when addLabels !== false).
   *     Help text is appended by WPBC_BFB_Exporter.render_field_node().
   *
   * Booking Form exporter callback (Advanced Form shortcode).
   *
   * This callback is registered per field type via:
   *   WPBC_BFB_Exporter.register( 'shortcode_name', callback )
   *
   * Core call site (builder-exporter.js):
   *   WPBC_BFB_Exporter.run_registered_exporter( field, io, cfg, once, ctx )
   *     → callback( field, emit, { io, cfg, once, ctx, core } );
   *
   * @callback WPBC_BFB_ExporterCallback
   * @param {Object}  field
   *   Normalized field data coming from the Builder structure.
   *   - field.type          {string}   Field type, e.g. "text".
   *   - field.name          {string}   Name as stored on the canvas (already validated).
   *   - field.id / html_id  {string}   Optional HTML id / user-visible id.
   *   - field.label         {string}   Visible label in the form (may be empty).
   *   - field.placeholder   {string}   Placeholder text (may be empty).
   *   - field.required      {boolean|number|string} "truthy" if required.
   *   - field.cssclass      {string}   Extra CSS classes entered in Inspector.
   *   - field.default_value {string}   Default text value.
   *   - field.options       {Array}    Only for option-based fields (select, checkbox, etc.).
   *   - ...                 (Any other pack-specific props are also present.)
   *
   * @param {function(string):void} emit
   *   Emits one line/fragment into the export buffer.
   *   - Each call corresponds to one `push()` in the core exporter.
   *   - For multi-line output (e.g. label + shortcode), call `emit()` multiple times:
   *       emit('<l>Label</l>');
   *       emit('<br>[text* name ...]');
   *
   * @param {Object} [extras]
   *   Extra context passed by the core exporter.
   *
   * @param {Object} [extras.io]
   *   Low-level writer used internally by the core.
   *   Normally you do NOT need it in packs — prefer `emit()`.
   *   - extras.io.open(str)   → open a nested block (increments indentation).
   *   - extras.io.close(str)  → close a block (decrements indentation).
   *   - extras.io.push(str)   → push raw line (used by `emit()`).
   *   - extras.io.blank()     → push an empty line.
   *
   * @param {Object} [extras.cfg]
   *   Export configuration (same object passed to WPBC_BFB_Exporter.export_form()).
   *   Useful flags for field packs:
   *   - extras.cfg.addLabels {boolean}  Default: true.
   *       If false, packs should NOT emit <l>Label</l> lines.
   *   - extras.cfg.newline   {string}   Newline separator (usually "\n").
   *   - extras.cfg.gapPercent{number}   Layout gap (used only by section/column logic).
   *
   * @param {Object} [extras.once]
   *   Shared "once-per-form" guards across all fields.
   *   Counters are incremented by some field types (captcha, coupon, etc.).
   *   Typical shape:
   *   - extras.once.captcha          {number}
   *   - extras.once.country          {number}
   *   - extras.once.coupon           {number}
   *   - extras.once.cost_corrections {number}
   *   - extras.once.submit           {number}
   *
   *   Text field usually does not touch this object, but other packs can use it
   *   to skip duplicates (e.g. only the first [coupon] per form is exported).
   *
   * @param {Object} [extras.ctx]
   *   Shared export context for the entire form.
   *   Currently:
   *   - extras.ctx.usedIds {Set<string>}
   *       Set of HTML/shortcode IDs already used in this export.
   *       Helpers like Exp.id_option(field, ctx) use it to ensure uniqueness.
   *
   *   Packs normally just pass `ctx` into helpers (id_option, etc.) without
   *   mutating it directly.
   *
   * @param {Object} [extras.core]
   *   Reference to WPBC_BFB_Core passed from builder-exporter.js.
   *   Primarily used to access sanitizers:
   *   - extras.core.WPBC_BFB_Sanitize.escape_html(...)
   *   - extras.core.WPBC_BFB_Sanitize.escape_for_shortcode(...)
   *   - extras.core.WPBC_BFB_Sanitize.sanitize_html_name(...)
   *   - etc.
   */
  function export_shortcode_in_booking_form() {
    const Exp = w.WPBC_BFB_Exporter;
    if (!Exp || typeof Exp.register !== 'function') {
      return false;
    }
    if (typeof Exp.has_exporter === 'function' && Exp.has_exporter('calendar')) {
      return true;
    }

    // Use sanitize helpers from core (already loaded).
    const S = Core.WPBC_BFB_Sanitize || w.WPBC_BFB_Core && w.WPBC_BFB_Core.WPBC_BFB_Sanitize || {};
    const esc = S.escape_html || (v => String(v));
    const sid = S.sanitize_html_id || (v => String(v));
    const scls = S.sanitize_css_classlist || (v => String(v));

    /**
     * Per-field exporter for "calendar" in Advanced Form.
     * @type {WPBC_BFB_ExporterCallback}
     */
    Exp.register('calendar', (field, emit, extras = {}) => {
      const cfg = extras.cfg || {};
      const ctx = extras.ctx;
      const usedIds = ctx && ctx.usedIds instanceof Set ? ctx.usedIds : null;
      const addLabels = cfg.addLabels !== false;

      // Optional wrapper attrs (id/class on outer span, not inside [calendar]).
      let html_id = field && field.html_id ? sid(String(field.html_id)) : '';
      if (html_id && usedIds) {
        let u = html_id,
          i = 2;
        while (usedIds.has(u)) {
          u = `${html_id}_${i++}`;
        }
        usedIds.add(u);
        html_id = u;
      }
      const cls_raw = field && (field.cssclass_extra || field.cssclass || field.class) || '';
      const cls = scls(String(cls_raw));
      const hasWrap = !!(html_id || cls);
      const wrapOpen = hasWrap ? `<span${html_id ? ` id="${esc(html_id)}"` : ''}${cls ? ` class="${esc(cls)}"` : ''} style="flex:1;">` : '';
      const wrapClose = hasWrap ? '</span>' : '';

      // Calendar body is intentionally minimal; no rid/months/id/class tokens inside shortcode.
      const body = '[calendar]';
      const label = typeof field?.label === 'string' ? field.label.trim() : '';
      if (label && addLabels) {
        emit(`<l>${esc(label)}</l>`);
        emit(`<br>${wrapOpen}${body}${wrapClose}`);
      } else {
        emit(`${wrapOpen}${body}${wrapClose}`);
      }
    });
    return true;
  }

  // Try now; if exporter isn't ready yet, wait for one-shot event from builder-exporter.
  if (!export_shortcode_in_booking_form()) {
    document.addEventListener('wpbc:bfb:exporter-ready', export_shortcode_in_booking_form, {
      once: true
    });
  }

  // -- Export for "Booking Data" ------------------------------------------------------------------------------------

  /**
   * Register the "calendar" exporter for "Content of booking fields data". Produces e.g.: "<b>Dates</b>:
   * <f>[dates]</f><br>"
   *
   * Booking Data exporter callback ("Content of booking fields data").  Default output: <b>Label</b>:
   * <f>[field_name]</f><br>
   *
   * Registered per field type via:
   *   WPBC_BFB_ContentExporter.register( 'shortcode_name', callback )
   *
   * Core call site (builder-exporter.js):
   *   WPBC_BFB_ContentExporter.run_registered_exporter( field, emit, { cfg, core } );
   *
   * @callback WPBC_BFB_ContentExporterCallback
   * @param {Object}  field
   *   Normalized field data (same shape as in the main exporter).
   *   Important properties for content templates:
   *   - field.type      {string}  Field type, e.g. "text".
   *   - field.name      {string}  Field name used as placeholder token.
   *   - field.label     {string}  Human-readable label (may be empty).
   *   - field.options   {Array}   For option-based fields (select, checkbox, radio, etc.).
   *   - Other pack-specific props if needed.
   *
   * @param {function(string):void} emit
   *   Emits a raw HTML fragment into the "Content of booking fields data" template.
   *   Core will wrap everything once into:
   *     <div class="standard-content-form">
   *       ... emitted fragments ...
   *     </div>
   *
   *   Typical usage pattern:
   *     emit('<b>Label</b>: <f>[field_name]</f><br>');
   *
   *   In most cases, packs call the shared helper:
   *     WPBC_BFB_ContentExporter.emit_line_bold_field(emit, label, token, cfg);
   *
   * @param {Object} [extras]
   *   Additional context passed from run_registered_exporter().
   *
   * @param {Object} [extras.cfg]
   *   Content exporter configuration:
   *   - extras.cfg.addLabels {boolean} Default: true.
   *       If false, helper may omit the bold label part.
   *   - extras.cfg.sep       {string}  Label separator, default ": ".
   *       Example: "<b>Label</b>: " vs "<b>Label</b> – ".
   *   - extras.cfg.newline   {string}  Newline separator when joining lines (usually "\n").
   *
   * @param {Object} [extras.core]
   *   Reference to WPBC_BFB_Core (same as in main exporter).
   *   Usually not needed here, because:
   *   - Sanitization and consistent rendering are already done via
   *     WPBC_BFB_ContentExporter.emit_line_bold_field( ... ).
   */
  function export_shortcode_in_booking_data() {
    var C = w.WPBC_BFB_ContentExporter;
    if (!C || typeof C.register !== 'function') {
      return false;
    }
    if (typeof C.has_exporter === 'function' && C.has_exporter('calendar')) {
      return true;
    }
    C.register('calendar', function (field, emit, extras) {
      extras = extras || {};
      var cfg = extras.cfg || {};
      var label = typeof field.label === 'string' && field.label.trim() ? field.label.trim() : 'Dates';

      // Reuse shared formatter from builder-exporter - e.g.: emit_line_bold_field(emit, label, token, cfg) ->  emit(`<b>${S.escape_html(label)}</b>${sep}<f>[${token}]</f><br>`); .
      // C.emit_line_bold_field( emit, label, 'dates', cfg );

      if (0) {
        // Defensive fallback: keep a simple, backward-compatible output. Just for help  in using in other field packs.
        var core_local = extras.core || Core || {};
        var S_local = core_local.WPBC_BFB_Sanitize || {};
        var esc = S_local.escape_html || function (s) {
          return String(s);
        };
        var sep = cfg && typeof cfg.sep === 'string' ? cfg.sep : ': ';
        var title = label ? '<b>' + esc(label) + '</b>' + sep : '';
        emit(title + '<f>[dates]</f><br>');
      }
    });
    return true;
  }
  if (!export_shortcode_in_booking_data()) {
    document.addEventListener('wpbc:bfb:content-exporter-ready', export_shortcode_in_booking_data, {
      once: true
    });
  }
})(window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3MvY2FsZW5kYXIvX291dC9jYWxlbmRhci5qcyIsIm5hbWVzIjpbInciLCJkZXYiLCJfd3BiYyIsImxvZyIsImVycm9yIiwiQ29yZSIsIldQQkNfQkZCX0NvcmUiLCJSZWdpc3RyeSIsIldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5IiwiRmllbGRfQmFzZSIsIldQQkNfQkZCX0ZpZWxkX0Jhc2UiLCJyZWdpc3RlciIsIkJvb3QiLCJXUEJDX0JGQl9DYWxlbmRhckJvb3QiLCJyaWRfbG9hZGVkX2NhY2hlIiwiT2JqZWN0IiwiY3JlYXRlIiwiZ2V0X2NvbmZpZ3VyZWRfcHJldmlld19yZXNvdXJjZV9pZCIsInJpZCIsIk51bWJlciIsImRlZmF1bHRfcHJldmlld19yZXNvdXJjZV9pZCIsImlzRmluaXRlIiwiTWF0aCIsIm1heCIsImZsb29yIiwiZ2V0X2ZpcnN0X2V4aXN0aW5nX3Jlc291cmNlX2lkIiwicmVzb3VyY2VzIiwiQXJyYXkiLCJpc0FycmF5IiwiYm9va2luZ19yZXNvdXJjZXMiLCJpIiwibGVuZ3RoIiwiaWQiLCJib29raW5nX3R5cGVfaWQiLCJyZXNvbHZlX2VmZmVjdGl2ZV9yZXNvdXJjZV9pZCIsInJpZF9jYW5kaWRhdGUiLCJjb25maWd1cmVkX3JpZCIsImNhbmRpZGF0ZSIsInJlc291cmNlX2V4aXN0cyIsImRlYm91bmNlIiwiZm4iLCJtcyIsInQiLCJhIiwiYXJndW1lbnRzIiwiY2xlYXJUaW1lb3V0Iiwic2V0VGltZW91dCIsImFwcGx5Iiwid2FpdF91bnRpbF9hcGlfcmVhZHkiLCJjYiIsIm1heF90cmllcyIsImRlbGF5X21zIiwidHJpZXMiLCJ0aWNrIiwid3BiY19jYWxlbmRhcl9zaG93IiwiZSIsImFwcGx5X21vbnRoc19jbGFzcyIsImZpZWxkX2VsIiwibW9udGhzIiwiY29udCIsInF1ZXJ5U2VsZWN0b3IiLCJmcm9tIiwiY2xhc3NMaXN0IiwiZm9yRWFjaCIsImMiLCJ0ZXN0IiwicmVtb3ZlIiwiYWRkIiwic2V0X3NlY3VyZV9wYXJhbXMiLCJzZXRfc2VjdXJlX3BhcmFtIiwibm9uY2UiLCJTdHJpbmciLCJ1c2VyX2lkIiwibG9jYWxlIiwiZ2V0X2NhbnZhc19uZXh0X21vbnRoX3Njcm9sbF90byIsInRvZGF5X2FyciIsImdldF9vdGhlcl9wYXJhbSIsImJhc2VfZGF0ZSIsIkRhdGUiLCJzZXREYXRlIiwic2V0TW9udGgiLCJnZXRNb250aCIsImdldEZ1bGxZZWFyIiwic2V0X2NhbGVuZGFyX3BhcmFtcyIsIkwiLCJiYWxhbmNlcl9fc2V0X21heF90aHJlYWRzIiwiYmFsYW5jZXJfbWF4X3RocmVhZHMiLCJzZXRfcGFyYW0iLCJrIiwidiIsImNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUiLCJib29raW5nX21heF9tb250aGVzX2luX2NhbGVuZGFyIiwiYm9va2luZ19zdGFydF9kYXlfd2VlZWsiLCJib29raW5nX2RhdGVfZm9ybWF0IiwiYm9va2luZ190aW1lX2Zvcm1hdCIsImRzIiwiZGF5c19zZWxlY3Rpb24iLCJkYXlzX3NlbGVjdF9tb2RlIiwiZml4ZWRfX2RheXNfbnVtIiwiZml4ZWRfX3dlZWtfZGF5c19fc3RhcnQiLCJkeW5hbWljX19kYXlzX21pbiIsImR5bmFtaWNfX2RheXNfbWF4IiwiZHluYW1pY19fZGF5c19zcGVjaWZpYyIsImFyciIsInNwbGl0IiwiZmlsdGVyIiwiQm9vbGVhbiIsIm1hcCIsImR5bmFtaWNfX3dlZWtfZGF5c19fc3RhcnQiLCJ3cGJjX19jb25kaXRpb25zX19TQVZFX0lOSVRJQUxfX2RheXNfc2VsZWN0aW9uX3BhcmFtc19fYm0iLCJnZXRfcmlkX2FuZF9tb250aHMiLCJkYXRhIiwid3JhcCIsImNsb3Nlc3QiLCJkYXRhc2V0IiwicmVzb3VyY2VfaWQiLCJuIiwibTEiLCJtYXRjaCIsImNsYXNzTmFtZSIsIm0yIiwibWluIiwiaW5pdF9maWVsZCIsInNob3VsZF9yZWxvYWRfZGF0YSIsInBhaXIiLCJlMSIsImZpcnN0X3RpbWVfZm9yX3JpZCIsImRvX3JlbG9hZCIsIndwYmNfY2FsZW5kYXJfX2xvYWRfZGF0YV9fYWp4IiwicmVxdWVzdF91cmkiLCJsb2NhdGlvbiIsInBhdGhuYW1lIiwic2VhcmNoIiwid3BiY19jYWxlbmRhcl9fdXBkYXRlX2xvb2siLCJlMiIsInNldEF0dHJpYnV0ZSIsImUzIiwiYXBwbHlfY2FsZW5kYXJfbGVnZW5kX3ByZXZpZXdfZnJvbV9jb250cm9scyIsImU0IiwiZGVmZXJfZm4iLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJmaW5kX2NhbGVuZGFyX3dyYXAiLCJlbCIsImlzX2NhbGVuZGFyX3dyYXAiLCJ0eXBlIiwibG9va19yZWZyZXNoIiwidGFyZ2V0Iiwib3B0cyIsIm8iLCJkb2N1bWVudCIsImNvbnRhaW5zIiwicmVsb2FkIiwib25fZXZlbnQiLCJoYW5kbGVyIiwiYWRkRXZlbnRMaXN0ZW5lciIsImdldF9jYWxlbmRhcl9za2luX3VybF9mcm9tX3NlbGVjdCIsInNlbGVjdF9lbCIsIm9wdGlvbnMiLCJzZWxlY3RlZF9vcHRpb24iLCJzZWxlY3RlZEluZGV4IiwiZ2V0QXR0cmlidXRlIiwidmFsdWUiLCJhcHBseV9jYWxlbmRhcl9za2luX2Zyb21fc2VsZWN0Iiwic2tpbl91cmwiLCJ3cGJjX19jYWxlbmRhcl9fY2hhbmdlX3NraW4iLCJiaW5kX2NhbGVuZGFyX3NraW5fcHJldmlld19ldmVudHMiLCJtYXRjaGVzIiwiZXNjYXBlX2h0bWwiLCJzIiwicmVwbGFjZSIsImxlZ2VuZF9pdGVtX29wdGlvbl9tYXAiLCJhdmFpbGFibGUiLCJzaG93IiwidGV4dCIsInBlbmRpbmciLCJhcHByb3ZlZCIsInBhcnRpYWxseSIsInVuYXZhaWxhYmxlIiwiZ2V0X2NoZWNrYm94X3ZhbHVlX2Zyb21faWQiLCJmYWxsYmFjayIsImdldEVsZW1lbnRCeUlkIiwiY2hlY2tlZCIsImdldF90ZXh0X3ZhbHVlX2Zyb21faWQiLCJnZXRfY2FsZW5kYXJfbGVnZW5kX3ZhbHVlc19mcm9tX2NvbnRyb2xzIiwiYm9vdF9sZWdlbmQiLCJjYWxlbmRhcl9sZWdlbmQiLCJib290X2l0ZW1zIiwiaXRlbXMiLCJ2YWx1ZXMiLCJzaG93X2xlZ2VuZCIsInNob3dfbnVtYmVycyIsImlzX3ZlcnRpY2FsIiwia2V5cyIsIml0ZW1fa2V5IiwiYm9vdF9pdGVtIiwidGl0bGUiLCJwbGFjZWhvbGRlciIsImV4dHJhY3RfbGVnZW5kX2l0ZW1faHRtbCIsInRlbXBsYXRlX2h0bWwiLCJ0bXAiLCJjcmVhdGVFbGVtZW50IiwiaW5uZXJIVE1MIiwiaXRlbSIsIm91dGVySFRNTCIsInJlbmRlcl9jYWxlbmRhcl9sZWdlbmRfaHRtbCIsIm9yZGVyIiwiaXRlbXNfb3JkZXIiLCJodG1sIiwiaXRlbV92YWx1ZXMiLCJ0ZW1wbGF0ZSIsInRlbXBsYXRlX251bWJlciIsInRlbXBsYXRlX2JsYW5rIiwiaXRlbV9odG1sIiwic3RvcmVfY2FsZW5kYXJfbGVnZW5kX3ZhbHVlc19pbl9ib290Iiwibm9kZXMiLCJxdWVyeVNlbGVjdG9yQWxsIiwic3luY19jYWxlbmRhcl9sZWdlbmRfaW5zcGVjdG9yX3Zpc2liaWxpdHkiLCJtYWluIiwic3R5bGUiLCJkaXNwbGF5IiwiYmluZF9jYWxlbmRhcl9sZWdlbmRfcHJldmlld19ldmVudHMiLCJvbl9pbnNwZWN0b3JfcmVuZGVyIiwiaW5pdF9hbGxfb25fcGFnZSIsInNjb3BlIiwibm9kZSIsInBhcmVudEVsZW1lbnQiLCJiaW5kX2J1aWxkZXJfYnVzX2V2ZW50cyIsIkVWIiwiV1BCQ19CRkJfRXZlbnRzIiwiU1RSVUNUVVJFX0xPQURFRCIsIkZJRUxEX0FERCIsImRldGFpbCIsIlNUUlVDVFVSRV9DSEFOR0UiLCJkIiwicmVhc29uIiwia2V5IiwicGhhc2UiLCJ0b0xvd2VyQ2FzZSIsIm11c3RfcmVsb2FkIiwiV1BCQ19CRkJfRmllbGRfQ2FsZW5kYXIiLCJ0ZW1wbGF0ZV9pZCIsImtpbmQiLCJnZXRfZGVmYXVsdHMiLCJsYWJlbCIsIm5hbWUiLCJodG1sX2lkIiwiY3NzY2xhc3MiLCJoZWxwIiwibWluX3dpZHRoIiwib25fZmllbGRfZHJvcCIsImN0eCIsImh5ZHJhdGUiLCJvbl9yZWFkeSIsInJlYWR5U3RhdGUiLCJleHBvcnRfc2hvcnRjb2RlX2luX2Jvb2tpbmdfZm9ybSIsIkV4cCIsIldQQkNfQkZCX0V4cG9ydGVyIiwiaGFzX2V4cG9ydGVyIiwiUyIsIldQQkNfQkZCX1Nhbml0aXplIiwiZXNjIiwic2lkIiwic2FuaXRpemVfaHRtbF9pZCIsInNjbHMiLCJzYW5pdGl6ZV9jc3NfY2xhc3NsaXN0IiwiZmllbGQiLCJlbWl0IiwiZXh0cmFzIiwiY2ZnIiwidXNlZElkcyIsIlNldCIsImFkZExhYmVscyIsInUiLCJoYXMiLCJjbHNfcmF3IiwiY3NzY2xhc3NfZXh0cmEiLCJjbGFzcyIsImNscyIsImhhc1dyYXAiLCJ3cmFwT3BlbiIsIndyYXBDbG9zZSIsImJvZHkiLCJ0cmltIiwib25jZSIsImV4cG9ydF9zaG9ydGNvZGVfaW5fYm9va2luZ19kYXRhIiwiQyIsIldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlciIsImNvcmVfbG9jYWwiLCJjb3JlIiwiU19sb2NhbCIsInNlcCIsIndpbmRvdyJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL2ZpZWxkLXBhY2tzL2NhbGVuZGFyL19zcmMvY2FsZW5kYXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vID09IEZpbGUgIC9pbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9maWVsZC1wYWNrcy9jYWxlbmRhci9fb3V0L2NhbGVuZGFyLmpzXHJcbi8vID09IFBhY2sgIENhbGVuZGFyIChXUC10ZW1wbGF0ZeKAk2RyaXZlbikg4oCUIG1pbmltYWwsIG1vZGVybiwgYW5kIEJ1aWxkZXItZm9jdXNlZCByZW5kZXJlclxyXG4vLyA9PSBDb21wYXRpYmxlIHdpdGggUEhQIHBhY2s6IC4uL2NhbGVuZGFyLnBocCAodmVyc2lvbiAxLjIuMilcclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbihmdW5jdGlvbiAodykge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0Ly8gRGlyZWN0IGRldiBsb2dnZXIgYWxpYXMgKHNuYWtlIGZvcm1hdCk7IG5vIGxvY2FsIHdyYXBwZXJzLlxyXG5cdGNvbnN0IGRldiA9ICh3Ll93cGJjICYmIHcuX3dwYmMuZGV2KSA/IHcuX3dwYmMuZGV2IDogeyBsb2coKXt9LCBlcnJvcigpe30gfTtcclxuXHJcblx0Ly8gQ29yZSBzaW5nbGV0b25zIGZyb20gdGhlIEJ1aWxkZXIuXHJcblx0dmFyIENvcmUgICAgICAgPSB3LldQQkNfQkZCX0NvcmUgfHwge307XHJcblx0dmFyIFJlZ2lzdHJ5ICAgPSBDb3JlLldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5O1xyXG5cdHZhciBGaWVsZF9CYXNlID0gQ29yZS5XUEJDX0JGQl9GaWVsZF9CYXNlIHx8IG51bGw7XHJcblxyXG5cdGlmICggIVJlZ2lzdHJ5IHx8ICFSZWdpc3RyeS5yZWdpc3RlciApIHtcclxuXHRcdGRldi5lcnJvciggJ1dQQkNfQkZCX0ZpZWxkX0NhbGVuZGFyJywgJ1JlZ2lzdHJ5IG1pc3Npbmcg4oCUIGxvYWQgYmZiLWNvcmUgZmlyc3QuJyApO1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0Ly8gTG9jYWxpemVkIGJvb3QgcGF5bG9hZCBmcm9tIFBIUCAoY2FsZW5kYXIucGhwOjplbnF1ZXVlX2pzKCkpLlxyXG5cdHZhciBCb290ID0gdy5XUEJDX0JGQl9DYWxlbmRhckJvb3QgfHwge307XHJcblxyXG5cdC8vIFJlbWVtYmVyIHdoaWNoIHJlc291cmNlIElEcyBhbHJlYWR5IGhhdmUgdGhlaXIgZGF0YSBsb2FkZWQgdGhpcyBzZXNzaW9uLlxyXG5cdHZhciByaWRfbG9hZGVkX2NhY2hlID0gT2JqZWN0LmNyZWF0ZSggbnVsbCApO1xyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFJlc291cmNlIElEIEhlbHBlcnNcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8qKlxyXG5cdCAqICBHZXQgY29uZmlndXJlZCBwcmV2aWV3IGJvb2tpbmcgcmVzb3VyY2UgSUQgZnJvbSBsb2NhbGl6ZWQgYm9vdCBkYXRhLlxyXG5cdCAqXHJcblx0ICogQHJldHVybnMge251bWJlcn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiBnZXRfY29uZmlndXJlZF9wcmV2aWV3X3Jlc291cmNlX2lkKCkge1xyXG5cdFx0dmFyIHJpZCA9IE51bWJlciggQm9vdC5kZWZhdWx0X3ByZXZpZXdfcmVzb3VyY2VfaWQgfHwgMSApO1xyXG5cdFx0cmlkICAgICA9IGlzRmluaXRlKCByaWQgKSA/IE1hdGgubWF4KCAxLCBNYXRoLmZsb29yKCByaWQgKSApIDogMTtcclxuXHRcdHJldHVybiByaWQ7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgZmlyc3QgZXhpc3RpbmcgYm9va2luZyByZXNvdXJjZSBJRCBmcm9tIGxvY2FsaXplZCBib290IGRhdGEuXHJcblx0ICpcclxuXHQgKiBAcmV0dXJucyB7bnVtYmVyfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGdldF9maXJzdF9leGlzdGluZ19yZXNvdXJjZV9pZCgpIHtcclxuXHJcblx0XHR2YXIgcmVzb3VyY2VzID0gQXJyYXkuaXNBcnJheSggQm9vdC5ib29raW5nX3Jlc291cmNlcyApID8gQm9vdC5ib29raW5nX3Jlc291cmNlcyA6IFtdO1xyXG5cclxuXHRcdGZvciAoIHZhciBpID0gMDsgaSA8IHJlc291cmNlcy5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0dmFyIGlkID0gTnVtYmVyKCByZXNvdXJjZXNbaV0gJiYgcmVzb3VyY2VzW2ldLmJvb2tpbmdfdHlwZV9pZCApO1xyXG5cdFx0XHRpZiAoIGlzRmluaXRlKCBpZCApICYmIGlkID4gMCApIHtcclxuXHRcdFx0XHRyZXR1cm4gTWF0aC5mbG9vciggaWQgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiAxO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogUmVzb2x2ZSBlZmZlY3RpdmUgcHJldmlldyBib29raW5nIHJlc291cmNlIElELlxyXG5cdCAqIFByaW9yaXR5OlxyXG5cdCAqIDEuIENvbmZpZ3VyZWQgZGVmYXVsdCBwcmV2aWV3IHJlc291cmNlLCBpZiBpdCBleGlzdHNcclxuXHQgKiAyLiBQcm92aWRlZCByaWQsIGlmIGl0IGV4aXN0c1xyXG5cdCAqIDMuIEZpcnN0IGV4aXN0aW5nIGJvb2tpbmcgcmVzb3VyY2VcclxuXHQgKiA0LiBGYWxsYmFjayB0byAxXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge251bWJlcn0gcmlkX2NhbmRpZGF0ZVxyXG5cdCAqIEByZXR1cm5zIHtudW1iZXJ9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gcmVzb2x2ZV9lZmZlY3RpdmVfcmVzb3VyY2VfaWQocmlkX2NhbmRpZGF0ZSkge1xyXG5cclxuXHRcdHZhciByZXNvdXJjZXMgPSBBcnJheS5pc0FycmF5KCBCb290LmJvb2tpbmdfcmVzb3VyY2VzICkgPyBCb290LmJvb2tpbmdfcmVzb3VyY2VzIDogW107XHJcblx0XHR2YXIgY29uZmlndXJlZF9yaWQgPSBnZXRfY29uZmlndXJlZF9wcmV2aWV3X3Jlc291cmNlX2lkKCk7XHJcblx0XHR2YXIgY2FuZGlkYXRlID0gTnVtYmVyKCByaWRfY2FuZGlkYXRlIHx8IDEgKTtcclxuXHJcblx0XHRmdW5jdGlvbiByZXNvdXJjZV9leGlzdHMoaWQpIHtcclxuXHRcdFx0aWQgPSBOdW1iZXIoIGlkIHx8IDEgKTtcclxuXHRcdFx0aWYgKCAhIGlzRmluaXRlKCBpZCApIHx8IGlkIDw9IDAgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCByZXNvdXJjZXMubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdFx0aWYgKCBOdW1iZXIoIHJlc291cmNlc1tpXSAmJiByZXNvdXJjZXNbaV0uYm9va2luZ190eXBlX2lkICkgPT09IGlkICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIHJlc291cmNlX2V4aXN0cyggY29uZmlndXJlZF9yaWQgKSApIHtcclxuXHRcdFx0cmV0dXJuIGNvbmZpZ3VyZWRfcmlkO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggcmVzb3VyY2VfZXhpc3RzKCBjYW5kaWRhdGUgKSApIHtcclxuXHRcdFx0cmV0dXJuIGNhbmRpZGF0ZTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZ2V0X2ZpcnN0X2V4aXN0aW5nX3Jlc291cmNlX2lkKCk7XHJcblx0fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFNtYWxsIHV0aWxpdGllc1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdC8qKlxyXG5cdCAqIERlYm91bmNlIHdyYXBwZXIuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxyXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSAgIG1zXHJcblx0ICogQHJldHVybnMge0Z1bmN0aW9ufVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGRlYm91bmNlKGZuLCBtcykge1xyXG5cdFx0dmFyIHQ7XHJcblx0XHRyZXR1cm4gZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR2YXIgYSA9IGFyZ3VtZW50cztcclxuXHRcdFx0Y2xlYXJUaW1lb3V0KCB0ICk7XHJcblx0XHRcdHQgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0Zm4uYXBwbHkoIG51bGwsIGEgKTtcclxuXHRcdFx0fSwgbXMgKTtcclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBXYWl0IHVudGlsIGNhbGVuZGFyIEFQSSBpcyBwcmVzZW50IGluIHRoZSB3aW5kb3cgKGUuZy4sIHdwYmNfY2FsZW5kYXJfc2hvdykuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYiAgICAgICAgICAgQ2FsbGJhY2sgd2hlbiByZWFkeS5cclxuXHQgKiBAcGFyYW0ge251bWJlcn0gICBtYXhfdHJpZXMgICAgTWF4aW11bSByZXRyeSBhdHRlbXB0cy5cclxuXHQgKiBAcGFyYW0ge251bWJlcn0gICBkZWxheV9tcyAgICAgRGVsYXkgYmV0d2VlbiBhdHRlbXB0cy5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3YWl0X3VudGlsX2FwaV9yZWFkeShjYiwgbWF4X3RyaWVzLCBkZWxheV9tcykge1xyXG5cdFx0dmFyIHRyaWVzID0gMDtcclxuXHRcdChmdW5jdGlvbiB0aWNrKCkge1xyXG5cdFx0XHRpZiAoIHR5cGVvZiB3LndwYmNfY2FsZW5kYXJfc2hvdyA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0Y2IoKTtcclxuXHRcdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHRcdGRldi5lcnJvciggJ2FwaV9yZWFkeV9jYicsIGUgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggdHJpZXMrKyA+PSAobWF4X3RyaWVzIHx8IDQwKSApIHtcclxuXHRcdFx0XHRkZXYubG9nKCAnY2FsZW5kYXJfYXBpX25vdF9yZWFkeV9hZnRlcl9yZXRyaWVzJyApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHR3LnNldFRpbWVvdXQoIHRpY2ssIGRlbGF5X21zIHx8IDEwMCApO1xyXG5cdFx0fSkoKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFwcGx5IFwibW9udGhzIGluIHJvd1wiIGNsYXNzIHRvIGNvbnRhaW5lciBlbGVtZW50LlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtFbGVtZW50fSBmaWVsZF9lbCAgRmllbGQgcm9vdCBlbGVtZW50ICh3cmFwKS5cclxuXHQgKiBAcGFyYW0ge251bWJlcn0gIG1vbnRocyAgICAxLi4xMlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGFwcGx5X21vbnRoc19jbGFzcyhmaWVsZF9lbCwgbW9udGhzKSB7XHJcblx0XHR2YXIgY29udCA9IGZpZWxkX2VsID8gZmllbGRfZWwucXVlcnlTZWxlY3RvciggJy53cGJjX2NhbF9jb250YWluZXInICkgOiBudWxsO1xyXG5cdFx0aWYgKCAhIGNvbnQgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdC8vIFJlbW92ZSBleGlzdGluZyBjYWxfbW9udGhfbnVtXyogc2FmZWx5IHZpYSBjbGFzc0xpc3QuXHJcblx0XHRBcnJheS5mcm9tKCBjb250LmNsYXNzTGlzdCApLmZvckVhY2goIGZ1bmN0aW9uIChjKSB7XHJcblx0XHRcdGlmICggL15jYWxfbW9udGhfbnVtX1xcZCskLy50ZXN0KCBjICkgKSB7XHJcblx0XHRcdFx0Y29udC5jbGFzc0xpc3QucmVtb3ZlKCBjICk7XHJcblx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHRcdGNvbnQuY2xhc3NMaXN0LmFkZCggJ2NhbF9tb250aF9udW1fJyArIG1vbnRocyApO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogU2V0IHNlY3VyZSBwYXJhbWV0ZXJzIChub25jZSwgdXNlcl9pZCwgbG9jYWxlKSBiZWZvcmUgYW55IEFKQVggY2FsbHMuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gc2V0X3NlY3VyZV9wYXJhbXMoKSB7XHJcblx0XHR0cnkge1xyXG5cdFx0XHRpZiAoICEody5fd3BiYyAmJiB0eXBlb2Ygdy5fd3BiYy5zZXRfc2VjdXJlX3BhcmFtID09PSAnZnVuY3Rpb24nKSApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBCb290Lm5vbmNlICkge1xyXG5cdFx0XHRcdHcuX3dwYmMuc2V0X3NlY3VyZV9wYXJhbSggJ25vbmNlJywgU3RyaW5nKCBCb290Lm5vbmNlICkgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIEJvb3QudXNlcl9pZCAhPSBudWxsICkge1xyXG5cdFx0XHRcdHcuX3dwYmMuc2V0X3NlY3VyZV9wYXJhbSggJ3VzZXJfaWQnLCBTdHJpbmcoIEJvb3QudXNlcl9pZCApICk7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBCb290LmxvY2FsZSApIHtcclxuXHRcdFx0XHR3Ll93cGJjLnNldF9zZWN1cmVfcGFyYW0oICdsb2NhbGUnLCBTdHJpbmcoIEJvb3QubG9jYWxlICkgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdGRldi5sb2coICdzZWN1cmVfcGFyYW1zX3NraXAnLCBlICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBCdWlsZGVyIGNhbnZhcyBwcmV2aWV3IHN0YXJ0cyBhdCBuZXh0IG1vbnRoIHNvIGl0IGRvZXMgbm90IG1vc3RseSBzaG93IHBhc3QvdW5hdmFpbGFibGUgZGF0ZXMgbmVhciBtb250aCBlbmQuXHJcblx0ICpcclxuXHQgKiBAcmV0dXJucyB7bnVtYmVyW119IFt5ZWFyLCBtb250aF1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiBnZXRfY2FudmFzX25leHRfbW9udGhfc2Nyb2xsX3RvKCkge1xyXG5cdFx0dmFyIHRvZGF5X2FyciA9IG51bGw7XHJcblxyXG5cdFx0dHJ5IHtcclxuXHRcdFx0aWYgKCB3Ll93cGJjICYmIHR5cGVvZiB3Ll93cGJjLmdldF9vdGhlcl9wYXJhbSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHR0b2RheV9hcnIgPSB3Ll93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RvZGF5X2FycicgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIGJhc2VfZGF0ZSA9IG5ldyBEYXRlKCk7XHJcblx0XHRpZiAoIHRvZGF5X2FyciAmJiB0b2RheV9hcnIubGVuZ3RoID49IDIgKSB7XHJcblx0XHRcdGJhc2VfZGF0ZSA9IG5ldyBEYXRlKCBOdW1iZXIoIHRvZGF5X2FyclswXSApLCBOdW1iZXIoIHRvZGF5X2FyclsxXSApIC0gMSwgMSApO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0YmFzZV9kYXRlLnNldERhdGUoIDEgKTtcclxuXHRcdH1cclxuXHJcblx0XHRiYXNlX2RhdGUuc2V0TW9udGgoIGJhc2VfZGF0ZS5nZXRNb250aCgpICsgMSApO1xyXG5cclxuXHRcdHJldHVybiBbIGJhc2VfZGF0ZS5nZXRGdWxsWWVhcigpLCBiYXNlX2RhdGUuZ2V0TW9udGgoKSArIDEgXTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFB1c2ggY2FsZW5kYXIgZW52aXJvbm1lbnQgcGFyYW1ldGVycyBmb3IgYSBzcGVjaWZpYyByZXNvdXJjZSBhbmQgbW9udGhzIGNvdW50LlxyXG5cdCAqIFdlICpkaXJlY3RseSogc2V0IHBhcmFtZXRlcnMgKG5vIGdsb2JhbCBwb2x5ZmlsbCkgdG8ga2VlcCB0aGlzIGZpbGUgc2VsZi1jb250YWluZWQuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge251bWJlcn0gcmlkXHJcblx0ICogQHBhcmFtIHtudW1iZXJ9IG1vbnRoc1xyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHNldF9jYWxlbmRhcl9wYXJhbXMocmlkLCBtb250aHMpIHtcclxuXHRcdHZhciBMID0gQm9vdCB8fCB7fTtcclxuXHRcdHRyeSB7XHJcblx0XHRcdGlmICggdy5fd3BiYyAmJiB0eXBlb2Ygdy5fd3BiYy5iYWxhbmNlcl9fc2V0X21heF90aHJlYWRzID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdHcuX3dwYmMuYmFsYW5jZXJfX3NldF9tYXhfdGhyZWFkcyggTnVtYmVyKCBMLmJhbGFuY2VyX21heF90aHJlYWRzIHx8IDEgKSApO1xyXG5cdFx0XHR9XHJcblx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdH1cclxuXHJcblx0XHRmdW5jdGlvbiBzZXRfcGFyYW0oaywgdikge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGlmICggdy5fd3BiYyAmJiB0eXBlb2Ygdy5fd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtX3ZhbHVlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0dy5fd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtX3ZhbHVlKCByaWQsIGssIHYgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBMLmJvb2tpbmdfbWF4X21vbnRoZXNfaW5fY2FsZW5kYXIgIT0gbnVsbCApIHtcclxuXHRcdFx0c2V0X3BhcmFtKCAnYm9va2luZ19tYXhfbW9udGhlc19pbl9jYWxlbmRhcicsIFN0cmluZyggTC5ib29raW5nX21heF9tb250aGVzX2luX2NhbGVuZGFyICkgKTtcclxuXHRcdH1cclxuXHRcdGlmICggTC5ib29raW5nX3N0YXJ0X2RheV93ZWVlayAhPSBudWxsICkge1xyXG5cdFx0XHRzZXRfcGFyYW0oICdib29raW5nX3N0YXJ0X2RheV93ZWVlaycsIFN0cmluZyggTC5ib29raW5nX3N0YXJ0X2RheV93ZWVlayApICk7XHJcblx0XHR9XHJcblx0XHRzZXRfcGFyYW0oICdjYWxlbmRhcl9udW1iZXJfb2ZfbW9udGhzJywgU3RyaW5nKCBtb250aHMgKSApO1xyXG5cdFx0c2V0X3BhcmFtKCAnY2FsZW5kYXJfc2Nyb2xsX3RvJywgZ2V0X2NhbnZhc19uZXh0X21vbnRoX3Njcm9sbF90bygpICk7XHJcblxyXG5cdFx0aWYgKCBMLmJvb2tpbmdfZGF0ZV9mb3JtYXQgKSB7XHJcblx0XHRcdHNldF9wYXJhbSggJ2Jvb2tpbmdfZGF0ZV9mb3JtYXQnLCBTdHJpbmcoIEwuYm9va2luZ19kYXRlX2Zvcm1hdCApICk7XHJcblx0XHR9XHJcblx0XHRpZiAoIEwuYm9va2luZ190aW1lX2Zvcm1hdCApIHtcclxuXHRcdFx0c2V0X3BhcmFtKCAnYm9va2luZ190aW1lX2Zvcm1hdCcsIFN0cmluZyggTC5ib29raW5nX3RpbWVfZm9ybWF0ICkgKTtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgZHMgPSBMLmRheXNfc2VsZWN0aW9uIHx8IHt9O1xyXG5cdFx0c2V0X3BhcmFtKCAnZGF5c19zZWxlY3RfbW9kZScsIFN0cmluZyggZHMuZGF5c19zZWxlY3RfbW9kZSB8fCAnbXVsdGlwbGUnICkgKTtcclxuXHRcdHNldF9wYXJhbSggJ2ZpeGVkX19kYXlzX251bScsIE51bWJlciggZHMuZml4ZWRfX2RheXNfbnVtIHx8IDAgKSApO1xyXG5cdFx0aWYgKCBkcy5maXhlZF9fd2Vla19kYXlzX19zdGFydCAhPSBudWxsICkge1xyXG5cdFx0XHRzZXRfcGFyYW0oICdmaXhlZF9fd2Vla19kYXlzX19zdGFydCcsIFsgU3RyaW5nKCBkcy5maXhlZF9fd2Vla19kYXlzX19zdGFydCApIF0gKTtcclxuXHRcdH1cclxuXHRcdHNldF9wYXJhbSggJ2R5bmFtaWNfX2RheXNfbWluJywgTnVtYmVyKCBkcy5keW5hbWljX19kYXlzX21pbiB8fCAwICkgKTtcclxuXHRcdHNldF9wYXJhbSggJ2R5bmFtaWNfX2RheXNfbWF4JywgTnVtYmVyKCBkcy5keW5hbWljX19kYXlzX21heCB8fCAwICkgKTtcclxuXHRcdGlmICggZHMuZHluYW1pY19fZGF5c19zcGVjaWZpYyAhPSBudWxsICkge1xyXG5cdFx0XHR2YXIgYXJyID0gU3RyaW5nKCBkcy5keW5hbWljX19kYXlzX3NwZWNpZmljIHx8ICcnICkuc3BsaXQoIC9cXHMqLFxccyovICkuZmlsdGVyKCBCb29sZWFuICkubWFwKCBOdW1iZXIgKTtcclxuXHRcdFx0c2V0X3BhcmFtKCAnZHluYW1pY19fZGF5c19zcGVjaWZpYycsIGFyciApO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCBkcy5keW5hbWljX193ZWVrX2RheXNfX3N0YXJ0ICE9IG51bGwgKSB7XHJcblx0XHRcdHNldF9wYXJhbSggJ2R5bmFtaWNfX3dlZWtfZGF5c19fc3RhcnQnLCBbIFN0cmluZyggZHMuZHluYW1pY19fd2Vla19kYXlzX19zdGFydCApIF0gKTtcclxuXHRcdH1cclxuXHJcblx0XHR0cnkge1xyXG5cdFx0XHRpZiAoIHR5cGVvZiB3LndwYmNfX2NvbmRpdGlvbnNfX1NBVkVfSU5JVElBTF9fZGF5c19zZWxlY3Rpb25fcGFyYW1zX19ibSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHR3LndwYmNfX2NvbmRpdGlvbnNfX1NBVkVfSU5JVElBTF9fZGF5c19zZWxlY3Rpb25fcGFyYW1zX19ibSggcmlkICk7XHJcblx0XHRcdH1cclxuXHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogRXh0cmFjdCBzYW5pdGl6ZWQgcmlkIGFuZCBtb250aHMgZnJvbSBkYXRhIG9yIERPTS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gZmllbGRfZWxcclxuXHQgKiBAcGFyYW0ge29iamVjdH0gIGRhdGFcclxuXHQgKiBAcmV0dXJucyB7e3JpZDpudW1iZXIsIG1vbnRoczpudW1iZXJ9fVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGdldF9yaWRfYW5kX21vbnRocyhmaWVsZF9lbCwgZGF0YSkge1xyXG5cdFx0dmFyIHJpZCAgICA9IDE7XHJcblx0XHR2YXIgbW9udGhzID0gMTtcclxuXHJcblx0XHQvLyBORVc6IHByZWZlciBkYXRhc2V0IG9uIHRoZSB3cmFwIChJbnNwZWN0b3IgZWRpdHMgbGFuZCBoZXJlIGZpcnN0KVxyXG5cdFx0dmFyIHdyYXAgPSBmaWVsZF9lbCA/IChmaWVsZF9lbC5jbG9zZXN0ICYmIGZpZWxkX2VsLmNsb3Nlc3QoJy53cGJjX2NhbGVuZGFyX3dyYXBlcicpKSB8fCBmaWVsZF9lbCA6IG51bGw7XHJcblx0XHRpZiAod3JhcCAmJiB3cmFwLmRhdGFzZXQpIHtcclxuXHRcdFx0aWYgKHdyYXAuZGF0YXNldC5yZXNvdXJjZV9pZCAhPSBudWxsICYmIHdyYXAuZGF0YXNldC5yZXNvdXJjZV9pZCAhPT0gJycpIHtcclxuXHRcdFx0XHRyaWQgPSBOdW1iZXIod3JhcC5kYXRhc2V0LnJlc291cmNlX2lkKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAod3JhcC5kYXRhc2V0Lm1vbnRocyAhPSBudWxsICYmIHdyYXAuZGF0YXNldC5tb250aHMgIT09ICcnKSB7XHJcblx0XHRcdFx0bW9udGhzID0gTnVtYmVyKHdyYXAuZGF0YXNldC5tb250aHMpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBkYXRhICYmIGRhdGEucmVzb3VyY2VfaWQgIT0gbnVsbCApIHtcclxuXHRcdFx0cmlkID0gTnVtYmVyKCBkYXRhLnJlc291cmNlX2lkICk7XHJcblx0XHR9XHJcblx0XHRpZiAoIGRhdGEgJiYgZGF0YS5tb250aHMgIT0gbnVsbCApIHtcclxuXHRcdFx0bW9udGhzID0gTnVtYmVyKCBkYXRhLm1vbnRocyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggIWRhdGEgKSB7XHJcblx0XHRcdC8vIEZhbGxiYWNrcyBmcm9tIERPTSB3aGVuIGRhdGEgb2JqZWN0IGlzIG5vdCBwcm92aWRlZC5cclxuXHRcdFx0dmFyIG4gPSBmaWVsZF9lbCA/IGZpZWxkX2VsLnF1ZXJ5U2VsZWN0b3IoICdbaWRePVwiY2FsZW5kYXJfYm9va2luZ1wiXScgKSA6IG51bGw7XHJcblx0XHRcdGlmICggbiAmJiBuLmlkICkge1xyXG5cdFx0XHRcdHZhciBtMSA9IG4uaWQubWF0Y2goIC9jYWxlbmRhcl9ib29raW5nKFxcZCspLyApO1xyXG5cdFx0XHRcdGlmICggbTEgKSB7XHJcblx0XHRcdFx0XHRyaWQgPSBOdW1iZXIoIG0xWzFdICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdHZhciBjb250ID0gZmllbGRfZWwgPyBmaWVsZF9lbC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfY2FsX2NvbnRhaW5lcicgKSA6IG51bGw7XHJcblx0XHRcdGlmICggY29udCAmJiBjb250LmNsYXNzTmFtZSApIHtcclxuXHRcdFx0XHR2YXIgbTIgPSBjb250LmNsYXNzTmFtZS5tYXRjaCggL2NhbF9tb250aF9udW1fKFxcZCspLyApO1xyXG5cdFx0XHRcdGlmICggbTIgKSB7XHJcblx0XHRcdFx0XHRtb250aHMgPSBOdW1iZXIoIG0yWzFdICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gRml4SW46IDIwMjYtMDMtMDcgICBPdmVycmlkZSB0byAgYWx3YXlzIGdldCB0aGUgZGVmYXVsdCBib29raW5nIHJlc291cmNlLCAgZm9yIHNwZWNpZmljIHVzZXIgaW4gTVUgb3IgZm9yIGV4aXN0ZWQgcmVzb3VyZWNzICFcclxuXHRcdHJpZCA9IHJlc29sdmVfZWZmZWN0aXZlX3Jlc291cmNlX2lkKCByaWQgKTtcclxuXHJcblx0XHRtb250aHMgPSBpc0Zpbml0ZSggbW9udGhzICkgPyBNYXRoLm1heCggMSwgTWF0aC5taW4oIDEyLCBNYXRoLmZsb29yKCBtb250aHMgKSApICkgOiAxO1xyXG5cclxuXHRcdHJldHVybiB7IHJpZDogcmlkLCBtb250aHM6IG1vbnRocyB9O1xyXG5cdH1cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBNaW5pbWFsIHByZXZpZXcgYm9vdHN0cmFwIOKAlCBsb2FkL3JlZnJlc2ggYSBjYWxlbmRhciBmb3IgYSBmaWVsZFxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBJbml0aWFsaXplIChvciB1cGRhdGUpIGEgY2FsZW5kYXIgcHJldmlldyBmb3IgYSBnaXZlbiBmaWVsZCBlbGVtZW50LlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtFbGVtZW50fSBmaWVsZF9lbCAgICAgICAgICAgLSBjYWxlbmRhciBmaWVsZCBlbGVtZW50ICh3cmFwKVxyXG5cdCAqIEBwYXJhbSB7b2JqZWN0fSAgZGF0YSAgICAgICAgICAgICAgIC0gYnVpbGRlciBmaWVsZCBkYXRhIChvcHRpb25hbClcclxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IHNob3VsZF9yZWxvYWRfZGF0YSAtIGZvcmNlIEFKQVggZGF0YSByZWxvYWRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiBpbml0X2ZpZWxkKGZpZWxkX2VsLCBkYXRhLCBzaG91bGRfcmVsb2FkX2RhdGEgPSB0cnVlKSB7XHJcblx0XHRpZiAoICFmaWVsZF9lbCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBwYWlyID0gZ2V0X3JpZF9hbmRfbW9udGhzKCBmaWVsZF9lbCwgZGF0YSApO1xyXG5cdFx0dmFyIHJpZCAgPSBwYWlyLnJpZDtcclxuXHJcblxyXG5cdFx0d2FpdF91bnRpbF9hcGlfcmVhZHkoIGZ1bmN0aW9uICgpIHtcclxuXHJcblx0XHRcdC8vIDEpIEFsd2F5cyAocmUpYXBwbHkgbG9jYWwgVUkg4oCUIG5lZWRlZCBhZnRlciBET00gbW92ZXMuXHJcblx0XHRcdGFwcGx5X21vbnRoc19jbGFzcyggZmllbGRfZWwsIHBhaXIubW9udGhzICk7XHJcblx0XHRcdHNldF9jYWxlbmRhcl9wYXJhbXMoIHJpZCwgcGFpci5tb250aHMgKTtcclxuXHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0dy53cGJjX2NhbGVuZGFyX3Nob3coIFN0cmluZyggcmlkICkgKTtcclxuXHRcdFx0fSBjYXRjaCAoIGUxICkge1xyXG5cdFx0XHRcdGRldi5lcnJvciggJ3dwYmNfY2FsZW5kYXJfc2hvdycsIGUxICk7XHJcblx0XHRcdH1cclxuXHRcdFx0c2V0X3NlY3VyZV9wYXJhbXMoKTtcclxuXHJcblx0XHRcdC8vIDIpIERlY2lkZSBvbiBBSkFYIHN0cmljdGx5IGJ5IFJJRCBzdGF0ZSArIGV4cGxpY2l0IHJlcXVlc3QuXHJcblx0XHRcdHZhciBmaXJzdF90aW1lX2Zvcl9yaWQgPSAhcmlkX2xvYWRlZF9jYWNoZVtyaWRdO1xyXG5cdFx0XHQvLyBSZXNwZWN0IGNhbGxlciBpbnRlbnQuIFJlbG9hZCBvbmx5IGlmIGV4cGxpY2l0bHkgYXNrZWQgT1IgZmlyc3QgdGltZSBmb3IgdGhpcyBSSUQuXHJcblx0XHRcdHZhciBkb19yZWxvYWQgICAgICAgICAgPSAhIXNob3VsZF9yZWxvYWRfZGF0YSB8fCBmaXJzdF90aW1lX2Zvcl9yaWQ7XHJcblxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGlmICggdHlwZW9mIHcud3BiY19jYWxlbmRhcl9fbG9hZF9kYXRhX19hanggPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRpZiAoIGRvX3JlbG9hZCApIHtcclxuXHRcdFx0XHRcdFx0dy53cGJjX2NhbGVuZGFyX19sb2FkX2RhdGFfX2FqeCgge1xyXG5cdFx0XHRcdFx0XHRcdCdyZXNvdXJjZV9pZCcgICAgICAgICAgICAgIDogcmlkLFxyXG5cdFx0XHRcdFx0XHRcdCdib29raW5nX2hhc2gnICAgICAgICAgICAgIDogJycsXHJcblx0XHRcdFx0XHRcdFx0J3JlcXVlc3RfdXJpJyAgICAgICAgICAgICAgOiBCb290LnJlcXVlc3RfdXJpIHx8ICh3LmxvY2F0aW9uID8gU3RyaW5nKCB3LmxvY2F0aW9uLnBhdGhuYW1lICsgdy5sb2NhdGlvbi5zZWFyY2ggKSA6ICcnKSxcclxuXHRcdFx0XHRcdFx0XHQnY3VzdG9tX2Zvcm0nICAgICAgICAgICAgICA6ICdzdGFuZGFyZCcsXHJcblx0XHRcdFx0XHRcdFx0J2FnZ3JlZ2F0ZV9yZXNvdXJjZV9pZF9zdHInOiAnJyxcclxuXHRcdFx0XHRcdFx0XHQnYWdncmVnYXRlX3R5cGUnICAgICAgICAgICA6ICdhbGwnXHJcblx0XHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHRcdFx0Ly8gTWFyayB0aGlzIHJpZCBhcyBsb2FkZWQgc28gc3Vic2VxdWVudCBET00gY2h1cm4gdXNlcyBsb29rLW9ubHkgcmVmcmVzaC5cclxuXHRcdFx0XHRcdFx0cmlkX2xvYWRlZF9jYWNoZVtyaWRdID0gdHJ1ZTtcclxuXHRcdFx0XHRcdH0gZWxzZSBpZiAoIHR5cGVvZiB3LndwYmNfY2FsZW5kYXJfX3VwZGF0ZV9sb29rID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHR3LndwYmNfY2FsZW5kYXJfX3VwZGF0ZV9sb29rKCByaWQgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gY2F0Y2ggKCBlMiApIHtcclxuXHRcdFx0XHRkZXYubG9nKCAnY2FsZW5kYXJfZGF0YV9sb2FkX3NraXAnLCBlMiApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBUcmFjayBsYXN0IGNvbmZpZyBmb3Igc29mdCBkZWR1cGUgKFVJIGNodXJuKTsga2VlcCBwZXItZWxlbWVudC5cclxuXHRcdFx0dHJ5IHsgZmllbGRfZWwuc2V0QXR0cmlidXRlKCdkYXRhLXdwYmMtY2FsLWluaXQnLCAnMScpOyBmaWVsZF9lbC5zZXRBdHRyaWJ1dGUoJ2RhdGEtd3BiYy1jYWwtbG9hZGVkLXJpZCcsIFN0cmluZyhyaWQpKTsgfSBjYXRjaCAoZTMpIHt9XHJcblx0XHRcdHRyeSB7IGFwcGx5X2NhbGVuZGFyX2xlZ2VuZF9wcmV2aWV3X2Zyb21fY29udHJvbHMoKTsgfSBjYXRjaCAoZTQpIHt9XHJcblxyXG5cdFx0fSwgNDAsIDEwMCApO1xyXG5cdH1cclxuXHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gRk9DUzogdGlueSBidXMgJiBET00gaGVscGVycyAoc25ha2UgZm9ybWF0KVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Y29uc3QgZGVmZXJfZm4gPSAoZm4pID0+ICh0eXBlb2Ygdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPT09ICdmdW5jdGlvbicgPyB3LnJlcXVlc3RBbmltYXRpb25GcmFtZSggZm4gKSA6IHNldFRpbWVvdXQoIGZuLCAwICkpO1xyXG5cclxuXHRmdW5jdGlvbiBmaW5kX2NhbGVuZGFyX3dyYXAoZWwpIHtcclxuXHRcdGlmICggISBlbCApIHtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gKGVsLmNsb3Nlc3QgJiYgZWwuY2xvc2VzdCggJy53cGJjX2NhbGVuZGFyX3dyYXBlcicgKSkgfHwgZWw7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpc19jYWxlbmRhcl93cmFwKGVsKSB7XHJcblx0XHR2YXIgd3JhcCA9IGZpbmRfY2FsZW5kYXJfd3JhcCggZWwgKTtcclxuXHRcdHJldHVybiAhISh3cmFwICYmIChcclxuXHRcdFx0KHdyYXAuZGF0YXNldCAmJiB3cmFwLmRhdGFzZXQudHlwZSA9PT0gJ2NhbGVuZGFyJykgfHxcclxuXHRcdFx0KHdyYXAucXVlcnlTZWxlY3RvciAmJiB3cmFwLnF1ZXJ5U2VsZWN0b3IoICdbaWRePVwiY2FsZW5kYXJfYm9va2luZ1wiXScgKSlcclxuXHRcdCkpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gbG9va19yZWZyZXNoKHRhcmdldCwgb3B0cykge1xyXG5cdFx0dmFyIG8gICAgPSBvcHRzIHx8IHt9O1xyXG5cdFx0dmFyIHdyYXAgPSBmaW5kX2NhbGVuZGFyX3dyYXAoIHRhcmdldCApO1xyXG5cdFx0aWYgKCAhIHdyYXAgfHwgISBkb2N1bWVudC5jb250YWlucyggd3JhcCApICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHRkZWZlcl9mbiggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRpbml0X2ZpZWxkKCB3cmFwLCBudWxsLCAhIW8ucmVsb2FkICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBvbl9ldmVudCh0eXBlLCBoYW5kbGVyKSB7XHJcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCB0eXBlLCBoYW5kbGVyICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfY2FsZW5kYXJfc2tpbl91cmxfZnJvbV9zZWxlY3Qoc2VsZWN0X2VsKSB7XHJcblx0XHRpZiAoICEgc2VsZWN0X2VsIHx8ICEgc2VsZWN0X2VsLm9wdGlvbnMgKSB7XHJcblx0XHRcdHJldHVybiAnJztcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgc2VsZWN0ZWRfb3B0aW9uID0gc2VsZWN0X2VsLm9wdGlvbnNbIHNlbGVjdF9lbC5zZWxlY3RlZEluZGV4IF07XHJcblx0XHRpZiAoIHNlbGVjdGVkX29wdGlvbiApIHtcclxuXHRcdFx0cmV0dXJuIFN0cmluZyggc2VsZWN0ZWRfb3B0aW9uLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1jYWxlbmRhci1za2luLXVybCcgKSB8fCBzZWxlY3RfZWwudmFsdWUgfHwgJycgKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gU3RyaW5nKCBzZWxlY3RfZWwudmFsdWUgfHwgJycgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGFwcGx5X2NhbGVuZGFyX3NraW5fZnJvbV9zZWxlY3Qoc2VsZWN0X2VsKSB7XHJcblx0XHR2YXIgc2tpbl91cmwgPSBnZXRfY2FsZW5kYXJfc2tpbl91cmxfZnJvbV9zZWxlY3QoIHNlbGVjdF9lbCApO1xyXG5cdFx0aWYgKCAhIHNraW5fdXJsIHx8IHR5cGVvZiB3LndwYmNfX2NhbGVuZGFyX19jaGFuZ2Vfc2tpbiAhPT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRyeSB7XHJcblx0XHRcdHcud3BiY19fY2FsZW5kYXJfX2NoYW5nZV9za2luKCBza2luX3VybCApO1xyXG5cdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdGRldi5lcnJvciggJ2NhbGVuZGFyX3NraW5fcHJldmlldycsIGUgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGJpbmRfY2FsZW5kYXJfc2tpbl9wcmV2aWV3X2V2ZW50cygpIHtcclxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBmdW5jdGlvbiAoZSkge1xyXG5cdFx0XHR2YXIgdGFyZ2V0ID0gZSAmJiBlLnRhcmdldDtcclxuXHRcdFx0aWYgKCB0YXJnZXQgJiYgdGFyZ2V0Lm1hdGNoZXMgJiYgdGFyZ2V0Lm1hdGNoZXMoICcuanMtd3BiYy1iZmItY2FsZW5kYXItc2tpbicgKSApIHtcclxuXHRcdFx0XHRhcHBseV9jYWxlbmRhcl9za2luX2Zyb21fc2VsZWN0KCB0YXJnZXQgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSwgdHJ1ZSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZXNjYXBlX2h0bWwocykge1xyXG5cdFx0cmV0dXJuIFN0cmluZyggcyA9PSBudWxsID8gJycgOiBzIClcclxuXHRcdFx0LnJlcGxhY2UoIC8mL2csICcmYW1wOycgKVxyXG5cdFx0XHQucmVwbGFjZSggLzwvZywgJyZsdDsnIClcclxuXHRcdFx0LnJlcGxhY2UoIC8+L2csICcmZ3Q7JyApXHJcblx0XHRcdC5yZXBsYWNlKCAvXCIvZywgJyZxdW90OycgKVxyXG5cdFx0XHQucmVwbGFjZSggLycvZywgJyYjMDM5OycgKTtcclxuXHR9XHJcblxyXG5cdHZhciBsZWdlbmRfaXRlbV9vcHRpb25fbWFwID0ge1xyXG5cdFx0YXZhaWxhYmxlICA6IHsgc2hvdzogJ2Jvb2tpbmdfbGVnZW5kX2lzX3Nob3dfaXRlbV9hdmFpbGFibGUnLCB0ZXh0OiAnYm9va2luZ19sZWdlbmRfdGV4dF9mb3JfaXRlbV9hdmFpbGFibGUnIH0sXHJcblx0XHRwZW5kaW5nICAgIDogeyBzaG93OiAnYm9va2luZ19sZWdlbmRfaXNfc2hvd19pdGVtX3BlbmRpbmcnLCB0ZXh0OiAnYm9va2luZ19sZWdlbmRfdGV4dF9mb3JfaXRlbV9wZW5kaW5nJyB9LFxyXG5cdFx0YXBwcm92ZWQgICA6IHsgc2hvdzogJ2Jvb2tpbmdfbGVnZW5kX2lzX3Nob3dfaXRlbV9hcHByb3ZlZCcsIHRleHQ6ICdib29raW5nX2xlZ2VuZF90ZXh0X2Zvcl9pdGVtX2FwcHJvdmVkJyB9LFxyXG5cdFx0cGFydGlhbGx5ICA6IHsgc2hvdzogJ2Jvb2tpbmdfbGVnZW5kX2lzX3Nob3dfaXRlbV9wYXJ0aWFsbHknLCB0ZXh0OiAnYm9va2luZ19sZWdlbmRfdGV4dF9mb3JfaXRlbV9wYXJ0aWFsbHknIH0sXHJcblx0XHR1bmF2YWlsYWJsZTogeyBzaG93OiAnYm9va2luZ19sZWdlbmRfaXNfc2hvd19pdGVtX3VuYXZhaWxhYmxlJywgdGV4dDogJ2Jvb2tpbmdfbGVnZW5kX3RleHRfZm9yX2l0ZW1fdW5hdmFpbGFibGUnIH1cclxuXHR9O1xyXG5cclxuXHRmdW5jdGlvbiBnZXRfY2hlY2tib3hfdmFsdWVfZnJvbV9pZChpZCwgZmFsbGJhY2spIHtcclxuXHRcdHZhciBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBpZCApO1xyXG5cdFx0aWYgKCBlbCApIHtcclxuXHRcdFx0cmV0dXJuIGVsLmNoZWNrZWQgPyAnT24nIDogJ09mZic7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gZmFsbGJhY2sgPT09ICdPbicgPyAnT24nIDogJ09mZic7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfdGV4dF92YWx1ZV9mcm9tX2lkKGlkLCBmYWxsYmFjaykge1xyXG5cdFx0dmFyIGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIGlkICk7XHJcblx0XHRpZiAoIGVsICkge1xyXG5cdFx0XHRyZXR1cm4gU3RyaW5nKCBlbC52YWx1ZSB8fCAnJyApO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIFN0cmluZyggZmFsbGJhY2sgfHwgJycgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9jYWxlbmRhcl9sZWdlbmRfdmFsdWVzX2Zyb21fY29udHJvbHMoKSB7XHJcblx0XHR2YXIgYm9vdF9sZWdlbmQgPSBCb290LmNhbGVuZGFyX2xlZ2VuZCB8fCB7fTtcclxuXHRcdHZhciBib290X2l0ZW1zICA9IGJvb3RfbGVnZW5kLml0ZW1zIHx8IHt9O1xyXG5cdFx0dmFyIHZhbHVlcyAgICAgID0ge1xyXG5cdFx0XHRzaG93X2xlZ2VuZCA6IGdldF9jaGVja2JveF92YWx1ZV9mcm9tX2lkKCAnYm9va2luZ19pc19zaG93X2xlZ2VuZCcsIGJvb3RfbGVnZW5kLnNob3dfbGVnZW5kICksXHJcblx0XHRcdHNob3dfbnVtYmVyczogZ2V0X2NoZWNrYm94X3ZhbHVlX2Zyb21faWQoICdib29raW5nX2xlZ2VuZF9pc19zaG93X251bWJlcnMnLCBib290X2xlZ2VuZC5zaG93X251bWJlcnMgKSxcclxuXHRcdFx0aXNfdmVydGljYWwgOiBnZXRfY2hlY2tib3hfdmFsdWVfZnJvbV9pZCggJ2Jvb2tpbmdfbGVnZW5kX2lzX3ZlcnRpY2FsJywgYm9vdF9sZWdlbmQuaXNfdmVydGljYWwgKSxcclxuXHRcdFx0aXRlbXMgICAgICAgOiB7fVxyXG5cdFx0fTtcclxuXHJcblx0XHRPYmplY3Qua2V5cyggbGVnZW5kX2l0ZW1fb3B0aW9uX21hcCApLmZvckVhY2goIGZ1bmN0aW9uIChpdGVtX2tleSkge1xyXG5cdFx0XHR2YXIgbWFwICAgICAgID0gbGVnZW5kX2l0ZW1fb3B0aW9uX21hcFtpdGVtX2tleV07XHJcblx0XHRcdHZhciBib290X2l0ZW0gPSBib290X2l0ZW1zW2l0ZW1fa2V5XSB8fCB7fTtcclxuXHRcdFx0dmFsdWVzLml0ZW1zW2l0ZW1fa2V5XSA9IHtcclxuXHRcdFx0XHRzaG93IDogZ2V0X2NoZWNrYm94X3ZhbHVlX2Zyb21faWQoIG1hcC5zaG93LCBib290X2l0ZW0uc2hvdyApLFxyXG5cdFx0XHRcdHRpdGxlOiBnZXRfdGV4dF92YWx1ZV9mcm9tX2lkKCBtYXAudGV4dCwgYm9vdF9pdGVtLnRpdGxlIHx8IGJvb3RfaXRlbS5wbGFjZWhvbGRlciB8fCAnJyApXHJcblx0XHRcdH07XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0cmV0dXJuIHZhbHVlcztcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGV4dHJhY3RfbGVnZW5kX2l0ZW1faHRtbCh0ZW1wbGF0ZV9odG1sKSB7XHJcblx0XHR2YXIgdG1wID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcclxuXHRcdHRtcC5pbm5lckhUTUwgPSBTdHJpbmcoIHRlbXBsYXRlX2h0bWwgfHwgJycgKTtcclxuXHRcdHZhciBpdGVtID0gdG1wLnF1ZXJ5U2VsZWN0b3IoICcud3BkZXZfaGludF93aXRoX3RleHQnICk7XHJcblx0XHRyZXR1cm4gaXRlbSA/IGl0ZW0ub3V0ZXJIVE1MIDogJyc7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiByZW5kZXJfY2FsZW5kYXJfbGVnZW5kX2h0bWwodmFsdWVzKSB7XHJcblx0XHR2YXIgYm9vdF9sZWdlbmQgPSBCb290LmNhbGVuZGFyX2xlZ2VuZCB8fCB7fTtcclxuXHRcdHZhciBib290X2l0ZW1zICA9IGJvb3RfbGVnZW5kLml0ZW1zIHx8IHt9O1xyXG5cdFx0dmFyIG9yZGVyICAgICAgID0gQXJyYXkuaXNBcnJheSggYm9vdF9sZWdlbmQuaXRlbXNfb3JkZXIgKSA/IGJvb3RfbGVnZW5kLml0ZW1zX29yZGVyIDogT2JqZWN0LmtleXMoIGxlZ2VuZF9pdGVtX29wdGlvbl9tYXAgKTtcclxuXHRcdHZhciBodG1sICAgICAgICA9ICcnO1xyXG5cclxuXHRcdGlmICggISB2YWx1ZXMgfHwgdmFsdWVzLnNob3dfbGVnZW5kICE9PSAnT24nICkge1xyXG5cdFx0XHRyZXR1cm4gJyc7XHJcblx0XHR9XHJcblxyXG5cdFx0b3JkZXIuZm9yRWFjaCggZnVuY3Rpb24gKGl0ZW1fa2V5KSB7XHJcblx0XHRcdHZhciBpdGVtX3ZhbHVlcyA9IHZhbHVlcy5pdGVtc1tpdGVtX2tleV0gfHwge307XHJcblx0XHRcdHZhciBib290X2l0ZW0gICA9IGJvb3RfaXRlbXNbaXRlbV9rZXldIHx8IHt9O1xyXG5cdFx0XHR2YXIgdGVtcGxhdGUgICAgPSAodmFsdWVzLnNob3dfbnVtYmVycyA9PT0gJ09uJykgPyBib290X2l0ZW0udGVtcGxhdGVfbnVtYmVyIDogYm9vdF9pdGVtLnRlbXBsYXRlX2JsYW5rO1xyXG5cdFx0XHR2YXIgaXRlbV9odG1sICAgPSBleHRyYWN0X2xlZ2VuZF9pdGVtX2h0bWwoIHRlbXBsYXRlICk7XHJcblxyXG5cdFx0XHRpZiAoIGl0ZW1fdmFsdWVzLnNob3cgIT09ICdPbicgfHwgISBpdGVtX2h0bWwgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpdGVtX2h0bWwgPSBpdGVtX2h0bWwucmVwbGFjZSggL19fV1BCQ19MRUdFTkRfVElUTEVfXy9nLCBlc2NhcGVfaHRtbCggaXRlbV92YWx1ZXMudGl0bGUgfHwgYm9vdF9pdGVtLnBsYWNlaG9sZGVyIHx8ICcnICkgKTtcclxuXHRcdFx0aHRtbCArPSBpdGVtX2h0bWw7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0aWYgKCAhIGh0bWwgKSB7XHJcblx0XHRcdHJldHVybiAnJztcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gJzxkaXYgY2xhc3M9XCJibG9ja19oaW50cyBkYXRlcGljayAnICsgKHZhbHVlcy5pc192ZXJ0aWNhbCA9PT0gJ09uJyA/ICcgYmxvY2tfaGludHNfdmVydGljYWwgJyA6ICcnKSArICdcIj4nICsgaHRtbCArICc8L2Rpdj4nO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc3RvcmVfY2FsZW5kYXJfbGVnZW5kX3ZhbHVlc19pbl9ib290KHZhbHVlcykge1xyXG5cdFx0Qm9vdC5jYWxlbmRhcl9sZWdlbmQgPSBCb290LmNhbGVuZGFyX2xlZ2VuZCB8fCB7fTtcclxuXHRcdEJvb3QuY2FsZW5kYXJfbGVnZW5kLml0ZW1zID0gQm9vdC5jYWxlbmRhcl9sZWdlbmQuaXRlbXMgfHwge307XHJcblx0XHRCb290LmNhbGVuZGFyX2xlZ2VuZC5zaG93X2xlZ2VuZCAgPSB2YWx1ZXMuc2hvd19sZWdlbmQ7XHJcblx0XHRCb290LmNhbGVuZGFyX2xlZ2VuZC5zaG93X251bWJlcnMgPSB2YWx1ZXMuc2hvd19udW1iZXJzO1xyXG5cdFx0Qm9vdC5jYWxlbmRhcl9sZWdlbmQuaXNfdmVydGljYWwgID0gdmFsdWVzLmlzX3ZlcnRpY2FsO1xyXG5cclxuXHRcdE9iamVjdC5rZXlzKCB2YWx1ZXMuaXRlbXMgfHwge30gKS5mb3JFYWNoKCBmdW5jdGlvbiAoaXRlbV9rZXkpIHtcclxuXHRcdFx0Qm9vdC5jYWxlbmRhcl9sZWdlbmQuaXRlbXNbaXRlbV9rZXldID0gQm9vdC5jYWxlbmRhcl9sZWdlbmQuaXRlbXNbaXRlbV9rZXldIHx8IHt9O1xyXG5cdFx0XHRCb290LmNhbGVuZGFyX2xlZ2VuZC5pdGVtc1tpdGVtX2tleV0uc2hvdyAgPSB2YWx1ZXMuaXRlbXNbaXRlbV9rZXldLnNob3c7XHJcblx0XHRcdEJvb3QuY2FsZW5kYXJfbGVnZW5kLml0ZW1zW2l0ZW1fa2V5XS50aXRsZSA9IHZhbHVlcy5pdGVtc1tpdGVtX2tleV0udGl0bGU7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBhcHBseV9jYWxlbmRhcl9sZWdlbmRfcHJldmlld19mcm9tX2NvbnRyb2xzKCkge1xyXG5cdFx0dmFyIHZhbHVlcyA9IGdldF9jYWxlbmRhcl9sZWdlbmRfdmFsdWVzX2Zyb21fY29udHJvbHMoKTtcclxuXHRcdHZhciBodG1sICAgPSByZW5kZXJfY2FsZW5kYXJfbGVnZW5kX2h0bWwoIHZhbHVlcyApO1xyXG5cdFx0dmFyIG5vZGVzICA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICcuanMtd3BiYy1iZmItY2FsZW5kYXItbGVnZW5kLXByZXZpZXcnICk7XHJcblxyXG5cdFx0c3RvcmVfY2FsZW5kYXJfbGVnZW5kX3ZhbHVlc19pbl9ib290KCB2YWx1ZXMgKTtcclxuXHJcblx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0bm9kZXNbaV0uaW5uZXJIVE1MID0gaHRtbDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHN5bmNfY2FsZW5kYXJfbGVnZW5kX2luc3BlY3Rvcl92aXNpYmlsaXR5KCkge1xyXG5cdFx0dmFyIG1haW4gICAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ2Jvb2tpbmdfaXNfc2hvd19sZWdlbmQnICk7XHJcblx0XHR2YXIgb3B0aW9ucyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICcuanMtd3BiYy1iZmItY2FsZW5kYXItbGVnZW5kLW9wdGlvbnMnICk7XHJcblx0XHRpZiAoICEgbWFpbiB8fCAhIG9wdGlvbnMgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdG9wdGlvbnMuc3R5bGUuZGlzcGxheSA9IG1haW4uY2hlY2tlZCA/ICcnIDogJ25vbmUnO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYmluZF9jYWxlbmRhcl9sZWdlbmRfcHJldmlld19ldmVudHMoKSB7XHJcblx0XHRmdW5jdGlvbiBvbl9pbnNwZWN0b3JfcmVuZGVyKCkge1xyXG5cdFx0XHRzeW5jX2NhbGVuZGFyX2xlZ2VuZF9pbnNwZWN0b3JfdmlzaWJpbGl0eSgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBmdW5jdGlvbiAoZSkge1xyXG5cdFx0XHR2YXIgdGFyZ2V0ID0gZSAmJiBlLnRhcmdldDtcclxuXHRcdFx0aWYgKCB0YXJnZXQgJiYgdGFyZ2V0Lm1hdGNoZXMgJiYgdGFyZ2V0Lm1hdGNoZXMoICcuanMtd3BiYy1iZmItY2FsZW5kYXItbGVnZW5kLWNvbnRyb2wnICkgKSB7XHJcblx0XHRcdFx0c3luY19jYWxlbmRhcl9sZWdlbmRfaW5zcGVjdG9yX3Zpc2liaWxpdHkoKTtcclxuXHRcdFx0XHRhcHBseV9jYWxlbmRhcl9sZWdlbmRfcHJldmlld19mcm9tX2NvbnRyb2xzKCk7XHJcblx0XHRcdH1cclxuXHRcdH0sIHRydWUgKTtcclxuXHJcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnaW5wdXQnLCBkZWJvdW5jZSggZnVuY3Rpb24gKGUpIHtcclxuXHRcdFx0dmFyIHRhcmdldCA9IGUgJiYgZS50YXJnZXQ7XHJcblx0XHRcdGlmICggdGFyZ2V0ICYmIHRhcmdldC5tYXRjaGVzICYmIHRhcmdldC5tYXRjaGVzKCAnLmpzLXdwYmMtYmZiLWNhbGVuZGFyLWxlZ2VuZC1jb250cm9sJyApICkge1xyXG5cdFx0XHRcdGFwcGx5X2NhbGVuZGFyX2xlZ2VuZF9wcmV2aWV3X2Zyb21fY29udHJvbHMoKTtcclxuXHRcdFx0fVxyXG5cdFx0fSwgMTUwICksIHRydWUgKTtcclxuXHJcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnd3BiY19iZmJfaW5zcGVjdG9yX3JlYWR5Jywgb25faW5zcGVjdG9yX3JlbmRlciApO1xyXG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmNfYmZiX2luc3BlY3Rvcl9yZW5kZXInLCBvbl9pbnNwZWN0b3JfcmVuZGVyICk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBJbml0aWFsaXplIGFsbCBjYWxlbmRhcnMgcHJlc2VudCBpbiB0aGUgY3VycmVudCBCdWlsZGVyIHByZXZpZXcgcGFuZWwuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gaW5pdF9hbGxfb25fcGFnZShzaG91bGRfcmVsb2FkX2RhdGEgPSB0cnVlKSB7XHJcblx0XHR2YXIgc2NvcGUgPSB3LmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICcjd3BiY19iZmJfX3BhZ2VzX3BhbmVsJyApIHx8IHcuZG9jdW1lbnQ7XHJcblx0XHR2YXIgbm9kZXMgPSBzY29wZS5xdWVyeVNlbGVjdG9yQWxsKCAnW2lkXj1cImNhbGVuZGFyX2Jvb2tpbmdcIl0nICk7XHJcblx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0dmFyIG5vZGUgICAgID0gbm9kZXNbaV07XHJcblx0XHRcdHZhciBmaWVsZF9lbCA9IG5vZGUuY2xvc2VzdCggJy53cGJjX2NhbGVuZGFyX3dyYXBlcicgKSB8fCBub2RlLnBhcmVudEVsZW1lbnQgfHwgbm9kZTtcclxuXHRcdFx0aW5pdF9maWVsZCggZmllbGRfZWwsIG51bGwsIHNob3VsZF9yZWxvYWRfZGF0YSApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIExpc3RlbiB0byBidWlsZGVy4oCZcyBidXMgKGV2ZW50cyBidWJibGUgb24gZG9jdW1lbnQgdmlhIENvcmUuV1BCQ19CRkJfRXZlbnRCdXMpXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gYmluZF9idWlsZGVyX2J1c19ldmVudHMoKSB7XHJcblxyXG5cdFx0Ly8gQWxpYXMgZXZlbnRzIG9uY2UuXHJcblx0XHR2YXIgRVYgPSBDb3JlLldQQkNfQkZCX0V2ZW50cyB8fCB7fTtcclxuXHJcblx0XHQvLyAxKSBGaXJzdCBzdHJ1Y3R1cmUgcmVhZHkgLT4gbG9vay1vbmx5IHJlbmRlci5cclxuXHRcdG9uX2V2ZW50KCBFVi5TVFJVQ1RVUkVfTE9BREVELCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdGluaXRfYWxsX29uX3BhZ2UoIGZhbHNlICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0Ly8gMikgRmllbGQvc2VjdGlvbiBhZGRlZCAtPiBpbml0aWFsaXplIHRoYXQgbm9kZSBpZiBpdOKAmXMgYSBjYWxlbmRhciAoZm9yY2UgcmVsb2FkKS5cclxuXHRcdG9uX2V2ZW50KCBFVi5GSUVMRF9BREQsIGZ1bmN0aW9uIChlKSB7XHJcblx0XHRcdHZhciBlbCA9IGUgJiYgZS5kZXRhaWwgJiYgZS5kZXRhaWwuZWw7XHJcblx0XHRcdGlmICggISBlbCApIHtcclxuXHRcdFx0XHQvLyBEZWZlbnNpdmUgZmFsbGJhY2s6IGlmIGVtaXR0ZXIgZGlkbuKAmXQgcHJvdmlkZSB0aGUgZWxlbWVudCwgcmVmcmVzaCBhbGwgY2FsZW5kYXJzIChsb29rLW9ubHkpLlxyXG5cdFx0XHRcdHJldHVybiBkZWZlcl9mbihmdW5jdGlvbiAoKSB7IGluaXRfYWxsX29uX3BhZ2UoZmFsc2UpOyB9KTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIGlzX2NhbGVuZGFyX3dyYXAoIGVsICkgKSB7XHJcblx0XHRcdFx0bG9va19yZWZyZXNoKCBlbCwgeyByZWxvYWQ6IHRydWUgfSApOyAvLyBidWlsZGVyIGp1c3QgaW5zZXJ0ZWQ7IFNvIGRvIEFqYXggZmV0Y2ggZGF0YS5cclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cclxuXHJcblx0XHQvLyAzKSBHZW5lcmljIHN0cnVjdHVyZSBjaGFuZ2VzLlxyXG5cdFx0b25fZXZlbnQoIEVWLlNUUlVDVFVSRV9DSEFOR0UsIGZ1bmN0aW9uIChlKSB7XHJcblx0XHRcdHZhciBkICAgICAgPSAoZSAmJiBlLmRldGFpbCkgfHwge307XHJcblx0XHRcdHZhciByZWFzb24gPSBkLnJlYXNvbiB8fCAnJztcclxuXHJcblx0XHRcdC8vIEhlYXZ5IG9wZXJhdGlvbnMgLT4gY2hlYXAgbG9vayByZWZyZXNoIGZvciBhbGwgY2FsZW5kYXJzLCBubyBkYXRhIHJlbG9hZC5cclxuXHRcdFx0aWYgKCByZWFzb24gPT09ICdzb3J0LXVwZGF0ZScgfHwgcmVhc29uID09PSAnc2VjdGlvbi1tb3ZlJyB8fCByZWFzb24gPT09ICdkZWxldGUnICkge1xyXG5cdFx0XHRcdHJldHVybiBkZWZlcl9mbiggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0aW5pdF9hbGxfb25fcGFnZSggZmFsc2UgKTtcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIE9ubHkgY2FyZSBhYm91dCBjYWxlbmRhciB0YXJnZXRzLlxyXG5cdFx0XHRpZiAoICEgaXNfY2FsZW5kYXJfd3JhcCggZC5lbCApICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0Ly8gT25seSByZWxvYWQgZGF0YSBvbiBjb21taXR0ZWQgcmVzb3VyY2VfaWQgY2hhbmdlcy5cclxuXHRcdFx0dmFyIGsgICAgID0gZC5rZXkgfHwgJyc7XHJcblx0XHRcdHZhciBwaGFzZSA9IChkLnBoYXNlIHx8ICcnKS50b0xvd2VyQ2FzZSgpOyAvLyBzZXQgYnkgdGhlIGVtaXR0ZXIgYWJvdmUuXHJcblx0XHRcdGlmICggayA9PT0gJ3Jlc291cmNlX2lkJyAmJiBwaGFzZSAhPT0gJ2NoYW5nZScgKSB7XHJcblx0XHRcdFx0cmV0dXJuOyAvLyBTa2lwIG9uIHNlY29uZCBpbnB1dCBoYW5kbGVyOiBpbnMuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgaGFuZGxlciwgdHJ1ZSApOyAgaW4gLi4vaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX19qcy9jb3JlL2JmYi11aS5qcyAvLy5cclxuXHRcdFx0fVxyXG5cdFx0XHQvLyBSZXBsYWNlIHRvICBUUlVFLCAgaWYgbmVlZHMgdG8gIEZPUkNFIGFqYXggcmVsb2FkIG9mIGNhbGVuZGFyICBkYXRhIG9mIHJlc291cmNlIElEIGNoYW5nZS5cclxuXHRcdFx0dmFyIG11c3RfcmVsb2FkID0gKGsgPT09ICdyZXNvdXJjZV9pZCcgJiYgcGhhc2UgPT09ICdjaGFuZ2UnKVxyXG5cdFx0XHRcdD8gZmFsc2VcclxuXHRcdFx0XHQ6IGZhbHNlO1xyXG5cdFx0XHRsb29rX3JlZnJlc2goIGQuZWwsIHsgcmVsb2FkOiBtdXN0X3JlbG9hZCB9ICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIEZpZWxkIFJlbmRlcmVyIChjbGFzcy1saWtlLCBleHRlbmRhYmxlKVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Y2xhc3MgV1BCQ19CRkJfRmllbGRfQ2FsZW5kYXIgZXh0ZW5kcyAoRmllbGRfQmFzZSB8fCBjbGFzcyB7fSkge1xyXG5cclxuXHRcdHN0YXRpYyB0ZW1wbGF0ZV9pZCA9ICd3cGJjLWJmYi1maWVsZC1jYWxlbmRhcic7ICAvLyBVbmRlcnNjb3JlIHRlbXBsYXRlIGlkIGZyb20gUEhQIHByaW50ZXIuXHJcblx0XHRzdGF0aWMga2luZCAgICAgICAgPSAnY2FsZW5kYXInO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRGVmYXVsdCBwcm9wcyDigJQga2VlcCBpbiBzeW5jIHdpdGggUEhQIHNjaGVtYSBkZWZhdWx0cy5cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGdldF9kZWZhdWx0cygpIHtcclxuXHRcdFx0cmV0dXJuIHtcclxuXHRcdFx0XHR0eXBlICAgICAgIDogJ2NhbGVuZGFyJyxcclxuXHRcdFx0XHRsYWJlbCAgICAgIDogJ1NlbGVjdCBEYXRlJyxcclxuXHRcdFx0XHRyZXNvdXJjZV9pZDogcmVzb2x2ZV9lZmZlY3RpdmVfcmVzb3VyY2VfaWQoIDEgKSxcclxuXHRcdFx0XHRtb250aHMgICAgIDogMSxcclxuXHRcdFx0XHRuYW1lICAgICAgIDogJycsXHJcblx0XHRcdFx0aHRtbF9pZCAgICA6ICcnLFxyXG5cdFx0XHRcdGNzc2NsYXNzICAgOiAnJyxcclxuXHRcdFx0XHRoZWxwICAgICAgIDogJycsXHJcblx0XHRcdFx0bWluX3dpZHRoICA6ICcyNTBweCdcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENhbGxlZCBieSB0aGUgQnVpbGRlciBhZnRlciB0aGUgZmllbGQgaXMgZHJvcHBlZC9sb2FkZWQvcHJldmlld2VkLlxyXG5cdFx0ICogV2UgKHJlKWluaXRpYWxpemUgdGhlIHByZXZpZXcgZm9yIHRoZSBzcGVjaWZpYyBlbGVtZW50LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7b2JqZWN0fSAgZGF0YVxyXG5cdFx0ICogQHBhcmFtIHtFbGVtZW50fSBmaWVsZF9lbFxyXG5cdFx0ICogQHBhcmFtIHt7Y29udGV4dDpzdHJpbmd9fSBjdHhcclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIG9uX2ZpZWxkX2Ryb3AoZGF0YSwgZmllbGRfZWwsIGN0eCkge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGluaXRfZmllbGQoIGZpZWxkX2VsLCBkYXRhLCBmYWxzZSApO1xyXG5cdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHRkZXYuZXJyb3IoICdXUEJDX0JGQl9GaWVsZF9DYWxlbmRhci5vbl9maWVsZF9kcm9wJywgZSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBIeWRyYXRlIGFmdGVyIHByZXZpZXcgcmVuZGVyIChubyByZWJ1aWxkKS4gQ2FsbGVkIGJ5IGJ1aWxkZXIucmVuZGVyX3ByZXZpZXcoKS5cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGh5ZHJhdGUoZmllbGRfZWwsIGRhdGEsIGN0eCkge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGluaXRfZmllbGQoIGZpZWxkX2VsLCBkYXRhLCBmYWxzZSApO1xyXG5cdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHRkZXYuZXJyb3IoICdXUEJDX0JGQl9GaWVsZF9DYWxlbmRhci5oeWRyYXRlJywgZSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdH1cclxuXHJcblx0Ly8gUmVnaXN0ZXIgcGFjayByZW5kZXJlciB3aXRoIHRoZSBjZW50cmFsIHJlZ2lzdHJ5LlxyXG5cdHRyeSB7XHJcblx0XHRSZWdpc3RyeS5yZWdpc3RlciggJ2NhbGVuZGFyJywgV1BCQ19CRkJfRmllbGRfQ2FsZW5kYXIgKTtcclxuXHR9IGNhdGNoICggZSApIHtcclxuXHRcdGRldi5lcnJvciggJ1dQQkNfQkZCX0ZpZWxkX0NhbGVuZGFyLnJlZ2lzdGVyJywgZSApO1xyXG5cdH1cclxuXHJcblx0Ly8gQm9vdHN0cmFwOiBvbiBET00gcmVhZHksIHJ1biBhIGZpcnN0IHNjYW4gYW5kIHdpcmUgbGlnaHQgcmVhY3Rpdml0eS5cclxuXHRmdW5jdGlvbiBvbl9yZWFkeShmbikge1xyXG5cdFx0aWYgKCB3LmRvY3VtZW50LnJlYWR5U3RhdGUgPT09ICdpbnRlcmFjdGl2ZScgfHwgdy5kb2N1bWVudC5yZWFkeVN0YXRlID09PSAnY29tcGxldGUnICkge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGZuKCk7XHJcblx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR3LmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdET01Db250ZW50TG9hZGVkJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRmbigpO1xyXG5cdFx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0b25fcmVhZHkoIGZ1bmN0aW9uICgpIHtcclxuXHRcdHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0aW5pdF9hbGxfb25fcGFnZSggZmFsc2UgKTtcclxuXHRcdFx0YmluZF9idWlsZGVyX2J1c19ldmVudHMoKTtcclxuXHRcdFx0YmluZF9jYWxlbmRhcl9za2luX3ByZXZpZXdfZXZlbnRzKCk7XHJcblx0XHRcdGJpbmRfY2FsZW5kYXJfbGVnZW5kX3ByZXZpZXdfZXZlbnRzKCk7XHJcblx0XHRcdHN5bmNfY2FsZW5kYXJfbGVnZW5kX2luc3BlY3Rvcl92aXNpYmlsaXR5KCk7XHJcblx0XHR9LCAwICk7XHJcblx0fSApO1xyXG5cclxuXHQvLyBPcHRpb25hbCBleHBvcnQgKGhhbmR5IGZvciBkZWJ1Z2dpbmcpLlxyXG5cdHcuV1BCQ19CRkJfRmllbGRfQ2FsZW5kYXIgPSBXUEJDX0JGQl9GaWVsZF9DYWxlbmRhcjtcclxuXHJcblxyXG5cdC8vIC0tIEV4cG9ydCBmb3IgXCJCb29raW5nIEZvcm1cIiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0LyoqXHJcblx0ICogUmVnaXN0ZXIgdGhlIFwiY2FsZW5kYXJcIiBleHBvcnRlciAobGF6eTogdHJpZXMgbm93LCBvciB3YWl0cyBmb3IgZXhwb3J0ZXItcmVhZHkpLlxyXG5cdCAqIE91dHB1dDpcclxuXHQgKiAgIOKAoiBbY2FsZW5kYXJdIG9ubHkgKG5vIHJpZC9tb250aHMvY2xhc3MvaWQgdG9rZW5zIGluc2lkZSlcclxuXHQgKiAgIOKAoiBJZiBodG1sX2lkIC8gY3NzY2xhc3Mgc2V0IOKGkiB3cmFwIHNob3J0Y29kZSBpbiA8c3BhbiAuLi4gc3R5bGU9XCJmbGV4OjE7XCI+4oCmPC9zcGFuPlxyXG5cdCAqICAg4oCiIExhYmVsIGFib3ZlICh3aGVuIGFkZExhYmVscyAhPT0gZmFsc2UpLlxyXG5cdCAqICAgICBIZWxwIHRleHQgaXMgYXBwZW5kZWQgYnkgV1BCQ19CRkJfRXhwb3J0ZXIucmVuZGVyX2ZpZWxkX25vZGUoKS5cclxuXHQgKlxyXG5cdCAqIEJvb2tpbmcgRm9ybSBleHBvcnRlciBjYWxsYmFjayAoQWR2YW5jZWQgRm9ybSBzaG9ydGNvZGUpLlxyXG5cdCAqXHJcblx0ICogVGhpcyBjYWxsYmFjayBpcyByZWdpc3RlcmVkIHBlciBmaWVsZCB0eXBlIHZpYTpcclxuXHQgKiAgIFdQQkNfQkZCX0V4cG9ydGVyLnJlZ2lzdGVyKCAnc2hvcnRjb2RlX25hbWUnLCBjYWxsYmFjayApXHJcblx0ICpcclxuXHQgKiBDb3JlIGNhbGwgc2l0ZSAoYnVpbGRlci1leHBvcnRlci5qcyk6XHJcblx0ICogICBXUEJDX0JGQl9FeHBvcnRlci5ydW5fcmVnaXN0ZXJlZF9leHBvcnRlciggZmllbGQsIGlvLCBjZmcsIG9uY2UsIGN0eCApXHJcblx0ICogICAgIOKGkiBjYWxsYmFjayggZmllbGQsIGVtaXQsIHsgaW8sIGNmZywgb25jZSwgY3R4LCBjb3JlIH0gKTtcclxuXHQgKlxyXG5cdCAqIEBjYWxsYmFjayBXUEJDX0JGQl9FeHBvcnRlckNhbGxiYWNrXHJcblx0ICogQHBhcmFtIHtPYmplY3R9ICBmaWVsZFxyXG5cdCAqICAgTm9ybWFsaXplZCBmaWVsZCBkYXRhIGNvbWluZyBmcm9tIHRoZSBCdWlsZGVyIHN0cnVjdHVyZS5cclxuXHQgKiAgIC0gZmllbGQudHlwZSAgICAgICAgICB7c3RyaW5nfSAgIEZpZWxkIHR5cGUsIGUuZy4gXCJ0ZXh0XCIuXHJcblx0ICogICAtIGZpZWxkLm5hbWUgICAgICAgICAge3N0cmluZ30gICBOYW1lIGFzIHN0b3JlZCBvbiB0aGUgY2FudmFzIChhbHJlYWR5IHZhbGlkYXRlZCkuXHJcblx0ICogICAtIGZpZWxkLmlkIC8gaHRtbF9pZCAge3N0cmluZ30gICBPcHRpb25hbCBIVE1MIGlkIC8gdXNlci12aXNpYmxlIGlkLlxyXG5cdCAqICAgLSBmaWVsZC5sYWJlbCAgICAgICAgIHtzdHJpbmd9ICAgVmlzaWJsZSBsYWJlbCBpbiB0aGUgZm9ybSAobWF5IGJlIGVtcHR5KS5cclxuXHQgKiAgIC0gZmllbGQucGxhY2Vob2xkZXIgICB7c3RyaW5nfSAgIFBsYWNlaG9sZGVyIHRleHQgKG1heSBiZSBlbXB0eSkuXHJcblx0ICogICAtIGZpZWxkLnJlcXVpcmVkICAgICAge2Jvb2xlYW58bnVtYmVyfHN0cmluZ30gXCJ0cnV0aHlcIiBpZiByZXF1aXJlZC5cclxuXHQgKiAgIC0gZmllbGQuY3NzY2xhc3MgICAgICB7c3RyaW5nfSAgIEV4dHJhIENTUyBjbGFzc2VzIGVudGVyZWQgaW4gSW5zcGVjdG9yLlxyXG5cdCAqICAgLSBmaWVsZC5kZWZhdWx0X3ZhbHVlIHtzdHJpbmd9ICAgRGVmYXVsdCB0ZXh0IHZhbHVlLlxyXG5cdCAqICAgLSBmaWVsZC5vcHRpb25zICAgICAgIHtBcnJheX0gICAgT25seSBmb3Igb3B0aW9uLWJhc2VkIGZpZWxkcyAoc2VsZWN0LCBjaGVja2JveCwgZXRjLikuXHJcblx0ICogICAtIC4uLiAgICAgICAgICAgICAgICAgKEFueSBvdGhlciBwYWNrLXNwZWNpZmljIHByb3BzIGFyZSBhbHNvIHByZXNlbnQuKVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtmdW5jdGlvbihzdHJpbmcpOnZvaWR9IGVtaXRcclxuXHQgKiAgIEVtaXRzIG9uZSBsaW5lL2ZyYWdtZW50IGludG8gdGhlIGV4cG9ydCBidWZmZXIuXHJcblx0ICogICAtIEVhY2ggY2FsbCBjb3JyZXNwb25kcyB0byBvbmUgYHB1c2goKWAgaW4gdGhlIGNvcmUgZXhwb3J0ZXIuXHJcblx0ICogICAtIEZvciBtdWx0aS1saW5lIG91dHB1dCAoZS5nLiBsYWJlbCArIHNob3J0Y29kZSksIGNhbGwgYGVtaXQoKWAgbXVsdGlwbGUgdGltZXM6XHJcblx0ICogICAgICAgZW1pdCgnPGw+TGFiZWw8L2w+Jyk7XHJcblx0ICogICAgICAgZW1pdCgnPGJyPlt0ZXh0KiBuYW1lIC4uLl0nKTtcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBbZXh0cmFzXVxyXG5cdCAqICAgRXh0cmEgY29udGV4dCBwYXNzZWQgYnkgdGhlIGNvcmUgZXhwb3J0ZXIuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge09iamVjdH0gW2V4dHJhcy5pb11cclxuXHQgKiAgIExvdy1sZXZlbCB3cml0ZXIgdXNlZCBpbnRlcm5hbGx5IGJ5IHRoZSBjb3JlLlxyXG5cdCAqICAgTm9ybWFsbHkgeW91IGRvIE5PVCBuZWVkIGl0IGluIHBhY2tzIOKAlCBwcmVmZXIgYGVtaXQoKWAuXHJcblx0ICogICAtIGV4dHJhcy5pby5vcGVuKHN0cikgICDihpIgb3BlbiBhIG5lc3RlZCBibG9jayAoaW5jcmVtZW50cyBpbmRlbnRhdGlvbikuXHJcblx0ICogICAtIGV4dHJhcy5pby5jbG9zZShzdHIpICDihpIgY2xvc2UgYSBibG9jayAoZGVjcmVtZW50cyBpbmRlbnRhdGlvbikuXHJcblx0ICogICAtIGV4dHJhcy5pby5wdXNoKHN0cikgICDihpIgcHVzaCByYXcgbGluZSAodXNlZCBieSBgZW1pdCgpYCkuXHJcblx0ICogICAtIGV4dHJhcy5pby5ibGFuaygpICAgICDihpIgcHVzaCBhbiBlbXB0eSBsaW5lLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IFtleHRyYXMuY2ZnXVxyXG5cdCAqICAgRXhwb3J0IGNvbmZpZ3VyYXRpb24gKHNhbWUgb2JqZWN0IHBhc3NlZCB0byBXUEJDX0JGQl9FeHBvcnRlci5leHBvcnRfZm9ybSgpKS5cclxuXHQgKiAgIFVzZWZ1bCBmbGFncyBmb3IgZmllbGQgcGFja3M6XHJcblx0ICogICAtIGV4dHJhcy5jZmcuYWRkTGFiZWxzIHtib29sZWFufSAgRGVmYXVsdDogdHJ1ZS5cclxuXHQgKiAgICAgICBJZiBmYWxzZSwgcGFja3Mgc2hvdWxkIE5PVCBlbWl0IDxsPkxhYmVsPC9sPiBsaW5lcy5cclxuXHQgKiAgIC0gZXh0cmFzLmNmZy5uZXdsaW5lICAge3N0cmluZ30gICBOZXdsaW5lIHNlcGFyYXRvciAodXN1YWxseSBcIlxcblwiKS5cclxuXHQgKiAgIC0gZXh0cmFzLmNmZy5nYXBQZXJjZW50e251bWJlcn0gICBMYXlvdXQgZ2FwICh1c2VkIG9ubHkgYnkgc2VjdGlvbi9jb2x1bW4gbG9naWMpLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IFtleHRyYXMub25jZV1cclxuXHQgKiAgIFNoYXJlZCBcIm9uY2UtcGVyLWZvcm1cIiBndWFyZHMgYWNyb3NzIGFsbCBmaWVsZHMuXHJcblx0ICogICBDb3VudGVycyBhcmUgaW5jcmVtZW50ZWQgYnkgc29tZSBmaWVsZCB0eXBlcyAoY2FwdGNoYSwgY291cG9uLCBldGMuKS5cclxuXHQgKiAgIFR5cGljYWwgc2hhcGU6XHJcblx0ICogICAtIGV4dHJhcy5vbmNlLmNhcHRjaGEgICAgICAgICAge251bWJlcn1cclxuXHQgKiAgIC0gZXh0cmFzLm9uY2UuY291bnRyeSAgICAgICAgICB7bnVtYmVyfVxyXG5cdCAqICAgLSBleHRyYXMub25jZS5jb3Vwb24gICAgICAgICAgIHtudW1iZXJ9XHJcblx0ICogICAtIGV4dHJhcy5vbmNlLmNvc3RfY29ycmVjdGlvbnMge251bWJlcn1cclxuXHQgKiAgIC0gZXh0cmFzLm9uY2Uuc3VibWl0ICAgICAgICAgICB7bnVtYmVyfVxyXG5cdCAqXHJcblx0ICogICBUZXh0IGZpZWxkIHVzdWFsbHkgZG9lcyBub3QgdG91Y2ggdGhpcyBvYmplY3QsIGJ1dCBvdGhlciBwYWNrcyBjYW4gdXNlIGl0XHJcblx0ICogICB0byBza2lwIGR1cGxpY2F0ZXMgKGUuZy4gb25seSB0aGUgZmlyc3QgW2NvdXBvbl0gcGVyIGZvcm0gaXMgZXhwb3J0ZWQpLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IFtleHRyYXMuY3R4XVxyXG5cdCAqICAgU2hhcmVkIGV4cG9ydCBjb250ZXh0IGZvciB0aGUgZW50aXJlIGZvcm0uXHJcblx0ICogICBDdXJyZW50bHk6XHJcblx0ICogICAtIGV4dHJhcy5jdHgudXNlZElkcyB7U2V0PHN0cmluZz59XHJcblx0ICogICAgICAgU2V0IG9mIEhUTUwvc2hvcnRjb2RlIElEcyBhbHJlYWR5IHVzZWQgaW4gdGhpcyBleHBvcnQuXHJcblx0ICogICAgICAgSGVscGVycyBsaWtlIEV4cC5pZF9vcHRpb24oZmllbGQsIGN0eCkgdXNlIGl0IHRvIGVuc3VyZSB1bmlxdWVuZXNzLlxyXG5cdCAqXHJcblx0ICogICBQYWNrcyBub3JtYWxseSBqdXN0IHBhc3MgYGN0eGAgaW50byBoZWxwZXJzIChpZF9vcHRpb24sIGV0Yy4pIHdpdGhvdXRcclxuXHQgKiAgIG11dGF0aW5nIGl0IGRpcmVjdGx5LlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IFtleHRyYXMuY29yZV1cclxuXHQgKiAgIFJlZmVyZW5jZSB0byBXUEJDX0JGQl9Db3JlIHBhc3NlZCBmcm9tIGJ1aWxkZXItZXhwb3J0ZXIuanMuXHJcblx0ICogICBQcmltYXJpbHkgdXNlZCB0byBhY2Nlc3Mgc2FuaXRpemVyczpcclxuXHQgKiAgIC0gZXh0cmFzLmNvcmUuV1BCQ19CRkJfU2FuaXRpemUuZXNjYXBlX2h0bWwoLi4uKVxyXG5cdCAqICAgLSBleHRyYXMuY29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5lc2NhcGVfZm9yX3Nob3J0Y29kZSguLi4pXHJcblx0ICogICAtIGV4dHJhcy5jb3JlLldQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2h0bWxfbmFtZSguLi4pXHJcblx0ICogICAtIGV0Yy5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiBleHBvcnRfc2hvcnRjb2RlX2luX2Jvb2tpbmdfZm9ybSgpIHtcclxuXHJcblx0XHRjb25zdCBFeHAgPSB3LldQQkNfQkZCX0V4cG9ydGVyO1xyXG5cdFx0aWYgKCAhIEV4cCB8fCB0eXBlb2YgRXhwLnJlZ2lzdGVyICE9PSAnZnVuY3Rpb24nICkgeyByZXR1cm4gZmFsc2U7IH1cclxuXHRcdGlmICggdHlwZW9mIEV4cC5oYXNfZXhwb3J0ZXIgPT09ICdmdW5jdGlvbicgJiYgRXhwLmhhc19leHBvcnRlciggJ2NhbGVuZGFyJyApICkgeyByZXR1cm4gdHJ1ZTsgfVxyXG5cclxuXHRcdC8vIFVzZSBzYW5pdGl6ZSBoZWxwZXJzIGZyb20gY29yZSAoYWxyZWFkeSBsb2FkZWQpLlxyXG5cdFx0Y29uc3QgUyAgICA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemUgfHwgKHcuV1BCQ19CRkJfQ29yZSAmJiB3LldQQkNfQkZCX0NvcmUuV1BCQ19CRkJfU2FuaXRpemUpIHx8IHt9O1xyXG5cdFx0Y29uc3QgZXNjICA9IFMuZXNjYXBlX2h0bWwgfHwgKHYgPT4gU3RyaW5nKCB2ICkpO1xyXG5cdFx0Y29uc3Qgc2lkICA9IFMuc2FuaXRpemVfaHRtbF9pZCB8fCAodiA9PiBTdHJpbmcoIHYgKSk7XHJcblx0XHRjb25zdCBzY2xzID0gUy5zYW5pdGl6ZV9jc3NfY2xhc3NsaXN0IHx8ICh2ID0+IFN0cmluZyggdiApKTtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFBlci1maWVsZCBleHBvcnRlciBmb3IgXCJjYWxlbmRhclwiIGluIEFkdmFuY2VkIEZvcm0uXHJcblx0XHQgKiBAdHlwZSB7V1BCQ19CRkJfRXhwb3J0ZXJDYWxsYmFja31cclxuXHRcdCAqL1xyXG5cdFx0RXhwLnJlZ2lzdGVyKCAnY2FsZW5kYXInLCAoZmllbGQsIGVtaXQsIGV4dHJhcyA9IHt9KSA9PiB7XHJcblxyXG5cdFx0XHRjb25zdCBjZmcgICAgICAgPSBleHRyYXMuY2ZnIHx8IHt9O1xyXG5cdFx0XHRjb25zdCBjdHggICAgICAgPSBleHRyYXMuY3R4O1xyXG5cdFx0XHRjb25zdCB1c2VkSWRzICAgPSAoY3R4ICYmIGN0eC51c2VkSWRzIGluc3RhbmNlb2YgU2V0KSA/IGN0eC51c2VkSWRzIDogbnVsbDtcclxuXHRcdFx0Y29uc3QgYWRkTGFiZWxzID0gY2ZnLmFkZExhYmVscyAhPT0gZmFsc2U7XHJcblxyXG5cdFx0XHQvLyBPcHRpb25hbCB3cmFwcGVyIGF0dHJzIChpZC9jbGFzcyBvbiBvdXRlciBzcGFuLCBub3QgaW5zaWRlIFtjYWxlbmRhcl0pLlxyXG5cdFx0XHRsZXQgaHRtbF9pZCA9IGZpZWxkICYmIGZpZWxkLmh0bWxfaWQgPyBzaWQoIFN0cmluZyggZmllbGQuaHRtbF9pZCApICkgOiAnJztcclxuXHRcdFx0aWYgKCBodG1sX2lkICYmIHVzZWRJZHMgKSB7XHJcblx0XHRcdFx0bGV0IHUgPSBodG1sX2lkLCBpID0gMjtcclxuXHRcdFx0XHR3aGlsZSAoIHVzZWRJZHMuaGFzKCB1ICkgKSB7XHJcblx0XHRcdFx0XHR1ID0gYCR7aHRtbF9pZH1fJHtpKyt9YDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dXNlZElkcy5hZGQoIHUgKTtcclxuXHRcdFx0XHRodG1sX2lkID0gdTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgY2xzX3JhdyA9IGZpZWxkICYmIChmaWVsZC5jc3NjbGFzc19leHRyYSB8fCBmaWVsZC5jc3NjbGFzcyB8fCBmaWVsZC5jbGFzcykgfHwgJyc7XHJcblx0XHRcdGNvbnN0IGNscyAgICAgPSBzY2xzKCBTdHJpbmcoIGNsc19yYXcgKSApO1xyXG5cclxuXHRcdFx0Y29uc3QgaGFzV3JhcCAgID0gISEoIGh0bWxfaWQgfHwgY2xzICk7XHJcblx0XHRcdGNvbnN0IHdyYXBPcGVuICA9IGhhc1dyYXBcclxuXHRcdFx0XHQ/IGA8c3BhbiR7aHRtbF9pZCA/IGAgaWQ9XCIke2VzYyggaHRtbF9pZCApfVwiYCA6ICcnfSR7Y2xzID8gYCBjbGFzcz1cIiR7ZXNjKCBjbHMgKX1cImAgOiAnJ30gc3R5bGU9XCJmbGV4OjE7XCI+YFxyXG5cdFx0XHRcdDogJyc7XHJcblx0XHRcdGNvbnN0IHdyYXBDbG9zZSA9IGhhc1dyYXAgPyAnPC9zcGFuPicgOiAnJztcclxuXHJcblx0XHRcdC8vIENhbGVuZGFyIGJvZHkgaXMgaW50ZW50aW9uYWxseSBtaW5pbWFsOyBubyByaWQvbW9udGhzL2lkL2NsYXNzIHRva2VucyBpbnNpZGUgc2hvcnRjb2RlLlxyXG5cdFx0XHRjb25zdCBib2R5ICA9ICdbY2FsZW5kYXJdJztcclxuXHRcdFx0Y29uc3QgbGFiZWwgPSAodHlwZW9mIGZpZWxkPy5sYWJlbCA9PT0gJ3N0cmluZycpID8gZmllbGQubGFiZWwudHJpbSgpIDogJyc7XHJcblxyXG5cdFx0XHRpZiAoIGxhYmVsICYmIGFkZExhYmVscyApIHtcclxuXHRcdFx0XHRlbWl0KCBgPGw+JHtlc2MoIGxhYmVsICl9PC9sPmAgKTtcclxuXHRcdFx0XHRlbWl0KCBgPGJyPiR7d3JhcE9wZW59JHtib2R5fSR7d3JhcENsb3NlfWAgKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRlbWl0KCBgJHt3cmFwT3Blbn0ke2JvZHl9JHt3cmFwQ2xvc2V9YCApO1xyXG5cdFx0XHR9XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fVxyXG5cclxuXHQvLyBUcnkgbm93OyBpZiBleHBvcnRlciBpc24ndCByZWFkeSB5ZXQsIHdhaXQgZm9yIG9uZS1zaG90IGV2ZW50IGZyb20gYnVpbGRlci1leHBvcnRlci5cclxuXHRpZiAoICEgZXhwb3J0X3Nob3J0Y29kZV9pbl9ib29raW5nX2Zvcm0oKSApIHtcclxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOmJmYjpleHBvcnRlci1yZWFkeScsIGV4cG9ydF9zaG9ydGNvZGVfaW5fYm9va2luZ19mb3JtLCB7IG9uY2U6IHRydWUgfSApO1xyXG5cdH1cclxuXHJcblx0Ly8gLS0gRXhwb3J0IGZvciBcIkJvb2tpbmcgRGF0YVwiIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHQvKipcclxuXHQgKiBSZWdpc3RlciB0aGUgXCJjYWxlbmRhclwiIGV4cG9ydGVyIGZvciBcIkNvbnRlbnQgb2YgYm9va2luZyBmaWVsZHMgZGF0YVwiLiBQcm9kdWNlcyBlLmcuOiBcIjxiPkRhdGVzPC9iPjpcclxuXHQgKiA8Zj5bZGF0ZXNdPC9mPjxicj5cIlxyXG5cdCAqXHJcblx0ICogQm9va2luZyBEYXRhIGV4cG9ydGVyIGNhbGxiYWNrIChcIkNvbnRlbnQgb2YgYm9va2luZyBmaWVsZHMgZGF0YVwiKS4gIERlZmF1bHQgb3V0cHV0OiA8Yj5MYWJlbDwvYj46XHJcblx0ICogPGY+W2ZpZWxkX25hbWVdPC9mPjxicj5cclxuXHQgKlxyXG5cdCAqIFJlZ2lzdGVyZWQgcGVyIGZpZWxkIHR5cGUgdmlhOlxyXG5cdCAqICAgV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyLnJlZ2lzdGVyKCAnc2hvcnRjb2RlX25hbWUnLCBjYWxsYmFjayApXHJcblx0ICpcclxuXHQgKiBDb3JlIGNhbGwgc2l0ZSAoYnVpbGRlci1leHBvcnRlci5qcyk6XHJcblx0ICogICBXUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIucnVuX3JlZ2lzdGVyZWRfZXhwb3J0ZXIoIGZpZWxkLCBlbWl0LCB7IGNmZywgY29yZSB9ICk7XHJcblx0ICpcclxuXHQgKiBAY2FsbGJhY2sgV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyQ2FsbGJhY2tcclxuXHQgKiBAcGFyYW0ge09iamVjdH0gIGZpZWxkXHJcblx0ICogICBOb3JtYWxpemVkIGZpZWxkIGRhdGEgKHNhbWUgc2hhcGUgYXMgaW4gdGhlIG1haW4gZXhwb3J0ZXIpLlxyXG5cdCAqICAgSW1wb3J0YW50IHByb3BlcnRpZXMgZm9yIGNvbnRlbnQgdGVtcGxhdGVzOlxyXG5cdCAqICAgLSBmaWVsZC50eXBlICAgICAge3N0cmluZ30gIEZpZWxkIHR5cGUsIGUuZy4gXCJ0ZXh0XCIuXHJcblx0ICogICAtIGZpZWxkLm5hbWUgICAgICB7c3RyaW5nfSAgRmllbGQgbmFtZSB1c2VkIGFzIHBsYWNlaG9sZGVyIHRva2VuLlxyXG5cdCAqICAgLSBmaWVsZC5sYWJlbCAgICAge3N0cmluZ30gIEh1bWFuLXJlYWRhYmxlIGxhYmVsIChtYXkgYmUgZW1wdHkpLlxyXG5cdCAqICAgLSBmaWVsZC5vcHRpb25zICAge0FycmF5fSAgIEZvciBvcHRpb24tYmFzZWQgZmllbGRzIChzZWxlY3QsIGNoZWNrYm94LCByYWRpbywgZXRjLikuXHJcblx0ICogICAtIE90aGVyIHBhY2stc3BlY2lmaWMgcHJvcHMgaWYgbmVlZGVkLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtmdW5jdGlvbihzdHJpbmcpOnZvaWR9IGVtaXRcclxuXHQgKiAgIEVtaXRzIGEgcmF3IEhUTUwgZnJhZ21lbnQgaW50byB0aGUgXCJDb250ZW50IG9mIGJvb2tpbmcgZmllbGRzIGRhdGFcIiB0ZW1wbGF0ZS5cclxuXHQgKiAgIENvcmUgd2lsbCB3cmFwIGV2ZXJ5dGhpbmcgb25jZSBpbnRvOlxyXG5cdCAqICAgICA8ZGl2IGNsYXNzPVwic3RhbmRhcmQtY29udGVudC1mb3JtXCI+XHJcblx0ICogICAgICAgLi4uIGVtaXR0ZWQgZnJhZ21lbnRzIC4uLlxyXG5cdCAqICAgICA8L2Rpdj5cclxuXHQgKlxyXG5cdCAqICAgVHlwaWNhbCB1c2FnZSBwYXR0ZXJuOlxyXG5cdCAqICAgICBlbWl0KCc8Yj5MYWJlbDwvYj46IDxmPltmaWVsZF9uYW1lXTwvZj48YnI+Jyk7XHJcblx0ICpcclxuXHQgKiAgIEluIG1vc3QgY2FzZXMsIHBhY2tzIGNhbGwgdGhlIHNoYXJlZCBoZWxwZXI6XHJcblx0ICogICAgIFdQQkNfQkZCX0NvbnRlbnRFeHBvcnRlci5lbWl0X2xpbmVfYm9sZF9maWVsZChlbWl0LCBsYWJlbCwgdG9rZW4sIGNmZyk7XHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge09iamVjdH0gW2V4dHJhc11cclxuXHQgKiAgIEFkZGl0aW9uYWwgY29udGV4dCBwYXNzZWQgZnJvbSBydW5fcmVnaXN0ZXJlZF9leHBvcnRlcigpLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IFtleHRyYXMuY2ZnXVxyXG5cdCAqICAgQ29udGVudCBleHBvcnRlciBjb25maWd1cmF0aW9uOlxyXG5cdCAqICAgLSBleHRyYXMuY2ZnLmFkZExhYmVscyB7Ym9vbGVhbn0gRGVmYXVsdDogdHJ1ZS5cclxuXHQgKiAgICAgICBJZiBmYWxzZSwgaGVscGVyIG1heSBvbWl0IHRoZSBib2xkIGxhYmVsIHBhcnQuXHJcblx0ICogICAtIGV4dHJhcy5jZmcuc2VwICAgICAgIHtzdHJpbmd9ICBMYWJlbCBzZXBhcmF0b3IsIGRlZmF1bHQgXCI6IFwiLlxyXG5cdCAqICAgICAgIEV4YW1wbGU6IFwiPGI+TGFiZWw8L2I+OiBcIiB2cyBcIjxiPkxhYmVsPC9iPiDigJMgXCIuXHJcblx0ICogICAtIGV4dHJhcy5jZmcubmV3bGluZSAgIHtzdHJpbmd9ICBOZXdsaW5lIHNlcGFyYXRvciB3aGVuIGpvaW5pbmcgbGluZXMgKHVzdWFsbHkgXCJcXG5cIikuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge09iamVjdH0gW2V4dHJhcy5jb3JlXVxyXG5cdCAqICAgUmVmZXJlbmNlIHRvIFdQQkNfQkZCX0NvcmUgKHNhbWUgYXMgaW4gbWFpbiBleHBvcnRlcikuXHJcblx0ICogICBVc3VhbGx5IG5vdCBuZWVkZWQgaGVyZSwgYmVjYXVzZTpcclxuXHQgKiAgIC0gU2FuaXRpemF0aW9uIGFuZCBjb25zaXN0ZW50IHJlbmRlcmluZyBhcmUgYWxyZWFkeSBkb25lIHZpYVxyXG5cdCAqICAgICBXUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIuZW1pdF9saW5lX2JvbGRfZmllbGQoIC4uLiApLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGV4cG9ydF9zaG9ydGNvZGVfaW5fYm9va2luZ19kYXRhKCkge1xyXG5cclxuXHRcdHZhciBDID0gdy5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXI7XHJcblx0XHRpZiAoICEgQyB8fCB0eXBlb2YgQy5yZWdpc3RlciAhPT0gJ2Z1bmN0aW9uJyApIHsgcmV0dXJuIGZhbHNlOyB9XHJcblx0XHRpZiAoIHR5cGVvZiBDLmhhc19leHBvcnRlciA9PT0gJ2Z1bmN0aW9uJyAmJiBDLmhhc19leHBvcnRlciggJ2NhbGVuZGFyJyApICkgeyByZXR1cm4gdHJ1ZTsgfVxyXG5cclxuXHRcdEMucmVnaXN0ZXIoICdjYWxlbmRhcicsIGZ1bmN0aW9uICggZmllbGQsIGVtaXQsIGV4dHJhcyApIHtcclxuXHJcblx0XHRcdGV4dHJhcyAgICA9IGV4dHJhcyB8fCB7fTtcclxuXHRcdFx0dmFyIGNmZyAgID0gZXh0cmFzLmNmZyB8fCB7fTtcclxuXHRcdFx0dmFyIGxhYmVsID0gKHR5cGVvZiBmaWVsZC5sYWJlbCA9PT0gJ3N0cmluZycgJiYgZmllbGQubGFiZWwudHJpbSgpKSA/IGZpZWxkLmxhYmVsLnRyaW0oKSA6ICdEYXRlcyc7XHJcblxyXG5cdFx0XHQvLyBSZXVzZSBzaGFyZWQgZm9ybWF0dGVyIGZyb20gYnVpbGRlci1leHBvcnRlciAtIGUuZy46IGVtaXRfbGluZV9ib2xkX2ZpZWxkKGVtaXQsIGxhYmVsLCB0b2tlbiwgY2ZnKSAtPiAgZW1pdChgPGI+JHtTLmVzY2FwZV9odG1sKGxhYmVsKX08L2I+JHtzZXB9PGY+WyR7dG9rZW59XTwvZj48YnI+YCk7IC5cclxuXHRcdFx0Ly8gQy5lbWl0X2xpbmVfYm9sZF9maWVsZCggZW1pdCwgbGFiZWwsICdkYXRlcycsIGNmZyApO1xyXG5cclxuXHRcdFx0aWYoMCkge1xyXG5cdFx0XHRcdC8vIERlZmVuc2l2ZSBmYWxsYmFjazoga2VlcCBhIHNpbXBsZSwgYmFja3dhcmQtY29tcGF0aWJsZSBvdXRwdXQuIEp1c3QgZm9yIGhlbHAgIGluIHVzaW5nIGluIG90aGVyIGZpZWxkIHBhY2tzLlxyXG5cdFx0XHRcdHZhciBjb3JlX2xvY2FsID0gZXh0cmFzLmNvcmUgfHwgQ29yZSB8fCB7fTtcclxuXHRcdFx0XHR2YXIgU19sb2NhbCAgICA9IGNvcmVfbG9jYWwuV1BCQ19CRkJfU2FuaXRpemUgfHwge307XHJcblx0XHRcdFx0dmFyIGVzYyAgICAgICAgPSBTX2xvY2FsLmVzY2FwZV9odG1sIHx8IGZ1bmN0aW9uIChzKSB7IHJldHVybiBTdHJpbmcoIHMgKTsgfTtcclxuXHJcblx0XHRcdFx0dmFyIHNlcCAgID0gKGNmZyAmJiB0eXBlb2YgY2ZnLnNlcCA9PT0gJ3N0cmluZycpID8gY2ZnLnNlcCA6ICc6ICc7XHJcblx0XHRcdFx0dmFyIHRpdGxlID0gbGFiZWwgPyAnPGI+JyArIGVzYyggbGFiZWwgKSArICc8L2I+JyArIHNlcCA6ICcnO1xyXG5cdFx0XHRcdGVtaXQoIHRpdGxlICsgJzxmPltkYXRlc108L2Y+PGJyPicgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cclxuXHRcdHJldHVybiB0cnVlO1xyXG5cdH1cclxuXHJcblx0aWYgKCAhIGV4cG9ydF9zaG9ydGNvZGVfaW5fYm9va2luZ19kYXRhKCkgKSB7XHJcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzpiZmI6Y29udGVudC1leHBvcnRlci1yZWFkeScsIGV4cG9ydF9zaG9ydGNvZGVfaW5fYm9va2luZ19kYXRhLCB7IG9uY2U6IHRydWUgfSApO1xyXG5cdH1cclxuXHJcbn0pKCB3aW5kb3cgKTtcclxuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDLFVBQVVBLENBQUMsRUFBRTtFQUNiLFlBQVk7O0VBRVo7RUFDQSxNQUFNQyxHQUFHLEdBQUlELENBQUMsQ0FBQ0UsS0FBSyxJQUFJRixDQUFDLENBQUNFLEtBQUssQ0FBQ0QsR0FBRyxHQUFJRCxDQUFDLENBQUNFLEtBQUssQ0FBQ0QsR0FBRyxHQUFHO0lBQUVFLEdBQUdBLENBQUEsRUFBRSxDQUFDLENBQUM7SUFBRUMsS0FBS0EsQ0FBQSxFQUFFLENBQUM7RUFBRSxDQUFDOztFQUUzRTtFQUNBLElBQUlDLElBQUksR0FBU0wsQ0FBQyxDQUFDTSxhQUFhLElBQUksQ0FBQyxDQUFDO0VBQ3RDLElBQUlDLFFBQVEsR0FBS0YsSUFBSSxDQUFDRyxnQ0FBZ0M7RUFDdEQsSUFBSUMsVUFBVSxHQUFHSixJQUFJLENBQUNLLG1CQUFtQixJQUFJLElB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
