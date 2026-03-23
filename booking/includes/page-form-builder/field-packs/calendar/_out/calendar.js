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
    set_param('calendar_scroll_to', false);
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3MvY2FsZW5kYXIvX291dC9jYWxlbmRhci5qcyIsIm5hbWVzIjpbInciLCJkZXYiLCJfd3BiYyIsImxvZyIsImVycm9yIiwiQ29yZSIsIldQQkNfQkZCX0NvcmUiLCJSZWdpc3RyeSIsIldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5IiwiRmllbGRfQmFzZSIsIldQQkNfQkZCX0ZpZWxkX0Jhc2UiLCJyZWdpc3RlciIsIkJvb3QiLCJXUEJDX0JGQl9DYWxlbmRhckJvb3QiLCJyaWRfbG9hZGVkX2NhY2hlIiwiT2JqZWN0IiwiY3JlYXRlIiwiZ2V0X2NvbmZpZ3VyZWRfcHJldmlld19yZXNvdXJjZV9pZCIsInJpZCIsIk51bWJlciIsImRlZmF1bHRfcHJldmlld19yZXNvdXJjZV9pZCIsImlzRmluaXRlIiwiTWF0aCIsIm1heCIsImZsb29yIiwiZ2V0X2ZpcnN0X2V4aXN0aW5nX3Jlc291cmNlX2lkIiwicmVzb3VyY2VzIiwiQXJyYXkiLCJpc0FycmF5IiwiYm9va2luZ19yZXNvdXJjZXMiLCJpIiwibGVuZ3RoIiwiaWQiLCJib29raW5nX3R5cGVfaWQiLCJyZXNvbHZlX2VmZmVjdGl2ZV9yZXNvdXJjZV9pZCIsInJpZF9jYW5kaWRhdGUiLCJjb25maWd1cmVkX3JpZCIsImNhbmRpZGF0ZSIsInJlc291cmNlX2V4aXN0cyIsImRlYm91bmNlIiwiZm4iLCJtcyIsInQiLCJhIiwiYXJndW1lbnRzIiwiY2xlYXJUaW1lb3V0Iiwic2V0VGltZW91dCIsImFwcGx5Iiwid2FpdF91bnRpbF9hcGlfcmVhZHkiLCJjYiIsIm1heF90cmllcyIsImRlbGF5X21zIiwidHJpZXMiLCJ0aWNrIiwid3BiY19jYWxlbmRhcl9zaG93IiwiZSIsImFwcGx5X21vbnRoc19jbGFzcyIsImZpZWxkX2VsIiwibW9udGhzIiwiY29udCIsInF1ZXJ5U2VsZWN0b3IiLCJmcm9tIiwiY2xhc3NMaXN0IiwiZm9yRWFjaCIsImMiLCJ0ZXN0IiwicmVtb3ZlIiwiYWRkIiwic2V0X3NlY3VyZV9wYXJhbXMiLCJzZXRfc2VjdXJlX3BhcmFtIiwibm9uY2UiLCJTdHJpbmciLCJ1c2VyX2lkIiwibG9jYWxlIiwic2V0X2NhbGVuZGFyX3BhcmFtcyIsIkwiLCJiYWxhbmNlcl9fc2V0X21heF90aHJlYWRzIiwiYmFsYW5jZXJfbWF4X3RocmVhZHMiLCJzZXRfcGFyYW0iLCJrIiwidiIsImNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUiLCJib29raW5nX21heF9tb250aGVzX2luX2NhbGVuZGFyIiwiYm9va2luZ19zdGFydF9kYXlfd2VlZWsiLCJib29raW5nX2RhdGVfZm9ybWF0IiwiYm9va2luZ190aW1lX2Zvcm1hdCIsImRzIiwiZGF5c19zZWxlY3Rpb24iLCJkYXlzX3NlbGVjdF9tb2RlIiwiZml4ZWRfX2RheXNfbnVtIiwiZml4ZWRfX3dlZWtfZGF5c19fc3RhcnQiLCJkeW5hbWljX19kYXlzX21pbiIsImR5bmFtaWNfX2RheXNfbWF4IiwiZHluYW1pY19fZGF5c19zcGVjaWZpYyIsImFyciIsInNwbGl0IiwiZmlsdGVyIiwiQm9vbGVhbiIsIm1hcCIsImR5bmFtaWNfX3dlZWtfZGF5c19fc3RhcnQiLCJ3cGJjX19jb25kaXRpb25zX19TQVZFX0lOSVRJQUxfX2RheXNfc2VsZWN0aW9uX3BhcmFtc19fYm0iLCJnZXRfcmlkX2FuZF9tb250aHMiLCJkYXRhIiwid3JhcCIsImNsb3Nlc3QiLCJkYXRhc2V0IiwicmVzb3VyY2VfaWQiLCJuIiwibTEiLCJtYXRjaCIsImNsYXNzTmFtZSIsIm0yIiwibWluIiwiaW5pdF9maWVsZCIsInNob3VsZF9yZWxvYWRfZGF0YSIsInBhaXIiLCJlMSIsImZpcnN0X3RpbWVfZm9yX3JpZCIsImRvX3JlbG9hZCIsIndwYmNfY2FsZW5kYXJfX2xvYWRfZGF0YV9fYWp4IiwicmVxdWVzdF91cmkiLCJsb2NhdGlvbiIsInBhdGhuYW1lIiwic2VhcmNoIiwid3BiY19jYWxlbmRhcl9fdXBkYXRlX2xvb2siLCJlMiIsInNldEF0dHJpYnV0ZSIsImUzIiwiZGVmZXJfZm4iLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJmaW5kX2NhbGVuZGFyX3dyYXAiLCJlbCIsImlzX2NhbGVuZGFyX3dyYXAiLCJ0eXBlIiwibG9va19yZWZyZXNoIiwidGFyZ2V0Iiwib3B0cyIsIm8iLCJkb2N1bWVudCIsImNvbnRhaW5zIiwicmVsb2FkIiwib25fZXZlbnQiLCJoYW5kbGVyIiwiYWRkRXZlbnRMaXN0ZW5lciIsImluaXRfYWxsX29uX3BhZ2UiLCJzY29wZSIsIm5vZGVzIiwicXVlcnlTZWxlY3RvckFsbCIsIm5vZGUiLCJwYXJlbnRFbGVtZW50IiwiYmluZF9idWlsZGVyX2J1c19ldmVudHMiLCJFViIsIldQQkNfQkZCX0V2ZW50cyIsIlNUUlVDVFVSRV9MT0FERUQiLCJGSUVMRF9BREQiLCJkZXRhaWwiLCJTVFJVQ1RVUkVfQ0hBTkdFIiwiZCIsInJlYXNvbiIsImtleSIsInBoYXNlIiwidG9Mb3dlckNhc2UiLCJtdXN0X3JlbG9hZCIsIldQQkNfQkZCX0ZpZWxkX0NhbGVuZGFyIiwidGVtcGxhdGVfaWQiLCJraW5kIiwiZ2V0X2RlZmF1bHRzIiwibGFiZWwiLCJuYW1lIiwiaHRtbF9pZCIsImNzc2NsYXNzIiwiaGVscCIsIm1pbl93aWR0aCIsIm9uX2ZpZWxkX2Ryb3AiLCJjdHgiLCJoeWRyYXRlIiwib25fcmVhZHkiLCJyZWFkeVN0YXRlIiwiZXhwb3J0X3Nob3J0Y29kZV9pbl9ib29raW5nX2Zvcm0iLCJFeHAiLCJXUEJDX0JGQl9FeHBvcnRlciIsImhhc19leHBvcnRlciIsIlMiLCJXUEJDX0JGQl9TYW5pdGl6ZSIsImVzYyIsImVzY2FwZV9odG1sIiwic2lkIiwic2FuaXRpemVfaHRtbF9pZCIsInNjbHMiLCJzYW5pdGl6ZV9jc3NfY2xhc3NsaXN0IiwiZmllbGQiLCJlbWl0IiwiZXh0cmFzIiwiY2ZnIiwidXNlZElkcyIsIlNldCIsImFkZExhYmVscyIsInUiLCJoYXMiLCJjbHNfcmF3IiwiY3NzY2xhc3NfZXh0cmEiLCJjbGFzcyIsImNscyIsImhhc1dyYXAiLCJ3cmFwT3BlbiIsIndyYXBDbG9zZSIsImJvZHkiLCJ0cmltIiwib25jZSIsImV4cG9ydF9zaG9ydGNvZGVfaW5fYm9va2luZ19kYXRhIiwiQyIsIldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlciIsImNvcmVfbG9jYWwiLCJjb3JlIiwiU19sb2NhbCIsInMiLCJzZXAiLCJ0aXRsZSIsIndpbmRvdyJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL2ZpZWxkLXBhY2tzL2NhbGVuZGFyL19zcmMvY2FsZW5kYXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vID09IEZpbGUgIC9pbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9maWVsZC1wYWNrcy9jYWxlbmRhci9fb3V0L2NhbGVuZGFyLmpzXHJcbi8vID09IFBhY2sgIENhbGVuZGFyIChXUC10ZW1wbGF0ZeKAk2RyaXZlbikg4oCUIG1pbmltYWwsIG1vZGVybiwgYW5kIEJ1aWxkZXItZm9jdXNlZCByZW5kZXJlclxyXG4vLyA9PSBDb21wYXRpYmxlIHdpdGggUEhQIHBhY2s6IC4uL2NhbGVuZGFyLnBocCAodmVyc2lvbiAxLjIuMilcclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbihmdW5jdGlvbiAodykge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0Ly8gRGlyZWN0IGRldiBsb2dnZXIgYWxpYXMgKHNuYWtlIGZvcm1hdCk7IG5vIGxvY2FsIHdyYXBwZXJzLlxyXG5cdGNvbnN0IGRldiA9ICh3Ll93cGJjICYmIHcuX3dwYmMuZGV2KSA/IHcuX3dwYmMuZGV2IDogeyBsb2coKXt9LCBlcnJvcigpe30gfTtcclxuXHJcblx0Ly8gQ29yZSBzaW5nbGV0b25zIGZyb20gdGhlIEJ1aWxkZXIuXHJcblx0dmFyIENvcmUgICAgICAgPSB3LldQQkNfQkZCX0NvcmUgfHwge307XHJcblx0dmFyIFJlZ2lzdHJ5ICAgPSBDb3JlLldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5O1xyXG5cdHZhciBGaWVsZF9CYXNlID0gQ29yZS5XUEJDX0JGQl9GaWVsZF9CYXNlIHx8IG51bGw7XHJcblxyXG5cdGlmICggIVJlZ2lzdHJ5IHx8ICFSZWdpc3RyeS5yZWdpc3RlciApIHtcclxuXHRcdGRldi5lcnJvciggJ1dQQkNfQkZCX0ZpZWxkX0NhbGVuZGFyJywgJ1JlZ2lzdHJ5IG1pc3Npbmcg4oCUIGxvYWQgYmZiLWNvcmUgZmlyc3QuJyApO1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0Ly8gTG9jYWxpemVkIGJvb3QgcGF5bG9hZCBmcm9tIFBIUCAoY2FsZW5kYXIucGhwOjplbnF1ZXVlX2pzKCkpLlxyXG5cdHZhciBCb290ID0gdy5XUEJDX0JGQl9DYWxlbmRhckJvb3QgfHwge307XHJcblxyXG5cdC8vIFJlbWVtYmVyIHdoaWNoIHJlc291cmNlIElEcyBhbHJlYWR5IGhhdmUgdGhlaXIgZGF0YSBsb2FkZWQgdGhpcyBzZXNzaW9uLlxyXG5cdHZhciByaWRfbG9hZGVkX2NhY2hlID0gT2JqZWN0LmNyZWF0ZSggbnVsbCApO1xyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFJlc291cmNlIElEIEhlbHBlcnNcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8qKlxyXG5cdCAqICBHZXQgY29uZmlndXJlZCBwcmV2aWV3IGJvb2tpbmcgcmVzb3VyY2UgSUQgZnJvbSBsb2NhbGl6ZWQgYm9vdCBkYXRhLlxyXG5cdCAqXHJcblx0ICogQHJldHVybnMge251bWJlcn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiBnZXRfY29uZmlndXJlZF9wcmV2aWV3X3Jlc291cmNlX2lkKCkge1xyXG5cdFx0dmFyIHJpZCA9IE51bWJlciggQm9vdC5kZWZhdWx0X3ByZXZpZXdfcmVzb3VyY2VfaWQgfHwgMSApO1xyXG5cdFx0cmlkICAgICA9IGlzRmluaXRlKCByaWQgKSA/IE1hdGgubWF4KCAxLCBNYXRoLmZsb29yKCByaWQgKSApIDogMTtcclxuXHRcdHJldHVybiByaWQ7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgZmlyc3QgZXhpc3RpbmcgYm9va2luZyByZXNvdXJjZSBJRCBmcm9tIGxvY2FsaXplZCBib290IGRhdGEuXHJcblx0ICpcclxuXHQgKiBAcmV0dXJucyB7bnVtYmVyfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGdldF9maXJzdF9leGlzdGluZ19yZXNvdXJjZV9pZCgpIHtcclxuXHJcblx0XHR2YXIgcmVzb3VyY2VzID0gQXJyYXkuaXNBcnJheSggQm9vdC5ib29raW5nX3Jlc291cmNlcyApID8gQm9vdC5ib29raW5nX3Jlc291cmNlcyA6IFtdO1xyXG5cclxuXHRcdGZvciAoIHZhciBpID0gMDsgaSA8IHJlc291cmNlcy5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0dmFyIGlkID0gTnVtYmVyKCByZXNvdXJjZXNbaV0gJiYgcmVzb3VyY2VzW2ldLmJvb2tpbmdfdHlwZV9pZCApO1xyXG5cdFx0XHRpZiAoIGlzRmluaXRlKCBpZCApICYmIGlkID4gMCApIHtcclxuXHRcdFx0XHRyZXR1cm4gTWF0aC5mbG9vciggaWQgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiAxO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogUmVzb2x2ZSBlZmZlY3RpdmUgcHJldmlldyBib29raW5nIHJlc291cmNlIElELlxyXG5cdCAqIFByaW9yaXR5OlxyXG5cdCAqIDEuIENvbmZpZ3VyZWQgZGVmYXVsdCBwcmV2aWV3IHJlc291cmNlLCBpZiBpdCBleGlzdHNcclxuXHQgKiAyLiBQcm92aWRlZCByaWQsIGlmIGl0IGV4aXN0c1xyXG5cdCAqIDMuIEZpcnN0IGV4aXN0aW5nIGJvb2tpbmcgcmVzb3VyY2VcclxuXHQgKiA0LiBGYWxsYmFjayB0byAxXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge251bWJlcn0gcmlkX2NhbmRpZGF0ZVxyXG5cdCAqIEByZXR1cm5zIHtudW1iZXJ9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gcmVzb2x2ZV9lZmZlY3RpdmVfcmVzb3VyY2VfaWQocmlkX2NhbmRpZGF0ZSkge1xyXG5cclxuXHRcdHZhciByZXNvdXJjZXMgPSBBcnJheS5pc0FycmF5KCBCb290LmJvb2tpbmdfcmVzb3VyY2VzICkgPyBCb290LmJvb2tpbmdfcmVzb3VyY2VzIDogW107XHJcblx0XHR2YXIgY29uZmlndXJlZF9yaWQgPSBnZXRfY29uZmlndXJlZF9wcmV2aWV3X3Jlc291cmNlX2lkKCk7XHJcblx0XHR2YXIgY2FuZGlkYXRlID0gTnVtYmVyKCByaWRfY2FuZGlkYXRlIHx8IDEgKTtcclxuXHJcblx0XHRmdW5jdGlvbiByZXNvdXJjZV9leGlzdHMoaWQpIHtcclxuXHRcdFx0aWQgPSBOdW1iZXIoIGlkIHx8IDEgKTtcclxuXHRcdFx0aWYgKCAhIGlzRmluaXRlKCBpZCApIHx8IGlkIDw9IDAgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCByZXNvdXJjZXMubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdFx0aWYgKCBOdW1iZXIoIHJlc291cmNlc1tpXSAmJiByZXNvdXJjZXNbaV0uYm9va2luZ190eXBlX2lkICkgPT09IGlkICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIHJlc291cmNlX2V4aXN0cyggY29uZmlndXJlZF9yaWQgKSApIHtcclxuXHRcdFx0cmV0dXJuIGNvbmZpZ3VyZWRfcmlkO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggcmVzb3VyY2VfZXhpc3RzKCBjYW5kaWRhdGUgKSApIHtcclxuXHRcdFx0cmV0dXJuIGNhbmRpZGF0ZTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZ2V0X2ZpcnN0X2V4aXN0aW5nX3Jlc291cmNlX2lkKCk7XHJcblx0fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFNtYWxsIHV0aWxpdGllc1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdC8qKlxyXG5cdCAqIERlYm91bmNlIHdyYXBwZXIuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxyXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSAgIG1zXHJcblx0ICogQHJldHVybnMge0Z1bmN0aW9ufVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGRlYm91bmNlKGZuLCBtcykge1xyXG5cdFx0dmFyIHQ7XHJcblx0XHRyZXR1cm4gZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR2YXIgYSA9IGFyZ3VtZW50cztcclxuXHRcdFx0Y2xlYXJUaW1lb3V0KCB0ICk7XHJcblx0XHRcdHQgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0Zm4uYXBwbHkoIG51bGwsIGEgKTtcclxuXHRcdFx0fSwgbXMgKTtcclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBXYWl0IHVudGlsIGNhbGVuZGFyIEFQSSBpcyBwcmVzZW50IGluIHRoZSB3aW5kb3cgKGUuZy4sIHdwYmNfY2FsZW5kYXJfc2hvdykuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYiAgICAgICAgICAgQ2FsbGJhY2sgd2hlbiByZWFkeS5cclxuXHQgKiBAcGFyYW0ge251bWJlcn0gICBtYXhfdHJpZXMgICAgTWF4aW11bSByZXRyeSBhdHRlbXB0cy5cclxuXHQgKiBAcGFyYW0ge251bWJlcn0gICBkZWxheV9tcyAgICAgRGVsYXkgYmV0d2VlbiBhdHRlbXB0cy5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3YWl0X3VudGlsX2FwaV9yZWFkeShjYiwgbWF4X3RyaWVzLCBkZWxheV9tcykge1xyXG5cdFx0dmFyIHRyaWVzID0gMDtcclxuXHRcdChmdW5jdGlvbiB0aWNrKCkge1xyXG5cdFx0XHRpZiAoIHR5cGVvZiB3LndwYmNfY2FsZW5kYXJfc2hvdyA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0Y2IoKTtcclxuXHRcdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHRcdGRldi5lcnJvciggJ2FwaV9yZWFkeV9jYicsIGUgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggdHJpZXMrKyA+PSAobWF4X3RyaWVzIHx8IDQwKSApIHtcclxuXHRcdFx0XHRkZXYubG9nKCAnY2FsZW5kYXJfYXBpX25vdF9yZWFkeV9hZnRlcl9yZXRyaWVzJyApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHR3LnNldFRpbWVvdXQoIHRpY2ssIGRlbGF5X21zIHx8IDEwMCApO1xyXG5cdFx0fSkoKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFwcGx5IFwibW9udGhzIGluIHJvd1wiIGNsYXNzIHRvIGNvbnRhaW5lciBlbGVtZW50LlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtFbGVtZW50fSBmaWVsZF9lbCAgRmllbGQgcm9vdCBlbGVtZW50ICh3cmFwKS5cclxuXHQgKiBAcGFyYW0ge251bWJlcn0gIG1vbnRocyAgICAxLi4xMlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGFwcGx5X21vbnRoc19jbGFzcyhmaWVsZF9lbCwgbW9udGhzKSB7XHJcblx0XHR2YXIgY29udCA9IGZpZWxkX2VsID8gZmllbGRfZWwucXVlcnlTZWxlY3RvciggJy53cGJjX2NhbF9jb250YWluZXInICkgOiBudWxsO1xyXG5cdFx0aWYgKCAhIGNvbnQgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdC8vIFJlbW92ZSBleGlzdGluZyBjYWxfbW9udGhfbnVtXyogc2FmZWx5IHZpYSBjbGFzc0xpc3QuXHJcblx0XHRBcnJheS5mcm9tKCBjb250LmNsYXNzTGlzdCApLmZvckVhY2goIGZ1bmN0aW9uIChjKSB7XHJcblx0XHRcdGlmICggL15jYWxfbW9udGhfbnVtX1xcZCskLy50ZXN0KCBjICkgKSB7XHJcblx0XHRcdFx0Y29udC5jbGFzc0xpc3QucmVtb3ZlKCBjICk7XHJcblx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHRcdGNvbnQuY2xhc3NMaXN0LmFkZCggJ2NhbF9tb250aF9udW1fJyArIG1vbnRocyApO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogU2V0IHNlY3VyZSBwYXJhbWV0ZXJzIChub25jZSwgdXNlcl9pZCwgbG9jYWxlKSBiZWZvcmUgYW55IEFKQVggY2FsbHMuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gc2V0X3NlY3VyZV9wYXJhbXMoKSB7XHJcblx0XHR0cnkge1xyXG5cdFx0XHRpZiAoICEody5fd3BiYyAmJiB0eXBlb2Ygdy5fd3BiYy5zZXRfc2VjdXJlX3BhcmFtID09PSAnZnVuY3Rpb24nKSApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBCb290Lm5vbmNlICkge1xyXG5cdFx0XHRcdHcuX3dwYmMuc2V0X3NlY3VyZV9wYXJhbSggJ25vbmNlJywgU3RyaW5nKCBCb290Lm5vbmNlICkgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIEJvb3QudXNlcl9pZCAhPSBudWxsICkge1xyXG5cdFx0XHRcdHcuX3dwYmMuc2V0X3NlY3VyZV9wYXJhbSggJ3VzZXJfaWQnLCBTdHJpbmcoIEJvb3QudXNlcl9pZCApICk7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBCb290LmxvY2FsZSApIHtcclxuXHRcdFx0XHR3Ll93cGJjLnNldF9zZWN1cmVfcGFyYW0oICdsb2NhbGUnLCBTdHJpbmcoIEJvb3QubG9jYWxlICkgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdGRldi5sb2coICdzZWN1cmVfcGFyYW1zX3NraXAnLCBlICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBQdXNoIGNhbGVuZGFyIGVudmlyb25tZW50IHBhcmFtZXRlcnMgZm9yIGEgc3BlY2lmaWMgcmVzb3VyY2UgYW5kIG1vbnRocyBjb3VudC5cclxuXHQgKiBXZSAqZGlyZWN0bHkqIHNldCBwYXJhbWV0ZXJzIChubyBnbG9iYWwgcG9seWZpbGwpIHRvIGtlZXAgdGhpcyBmaWxlIHNlbGYtY29udGFpbmVkLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtudW1iZXJ9IHJpZFxyXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBtb250aHNcclxuXHQgKi9cclxuXHRmdW5jdGlvbiBzZXRfY2FsZW5kYXJfcGFyYW1zKHJpZCwgbW9udGhzKSB7XHJcblx0XHR2YXIgTCA9IEJvb3QgfHwge307XHJcblx0XHR0cnkge1xyXG5cdFx0XHRpZiAoIHcuX3dwYmMgJiYgdHlwZW9mIHcuX3dwYmMuYmFsYW5jZXJfX3NldF9tYXhfdGhyZWFkcyA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHR3Ll93cGJjLmJhbGFuY2VyX19zZXRfbWF4X3RocmVhZHMoIE51bWJlciggTC5iYWxhbmNlcl9tYXhfdGhyZWFkcyB8fCAxICkgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gc2V0X3BhcmFtKGssIHYpIHtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRpZiAoIHcuX3dwYmMgJiYgdHlwZW9mIHcuX3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdHcuX3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSggcmlkLCBrLCB2ICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggTC5ib29raW5nX21heF9tb250aGVzX2luX2NhbGVuZGFyICE9IG51bGwgKSB7XHJcblx0XHRcdHNldF9wYXJhbSggJ2Jvb2tpbmdfbWF4X21vbnRoZXNfaW5fY2FsZW5kYXInLCBTdHJpbmcoIEwuYm9va2luZ19tYXhfbW9udGhlc19pbl9jYWxlbmRhciApICk7XHJcblx0XHR9XHJcblx0XHRpZiAoIEwuYm9va2luZ19zdGFydF9kYXlfd2VlZWsgIT0gbnVsbCApIHtcclxuXHRcdFx0c2V0X3BhcmFtKCAnYm9va2luZ19zdGFydF9kYXlfd2VlZWsnLCBTdHJpbmcoIEwuYm9va2luZ19zdGFydF9kYXlfd2VlZWsgKSApO1xyXG5cdFx0fVxyXG5cdFx0c2V0X3BhcmFtKCAnY2FsZW5kYXJfbnVtYmVyX29mX21vbnRocycsIFN0cmluZyggbW9udGhzICkgKTtcclxuXHRcdHNldF9wYXJhbSggJ2NhbGVuZGFyX3Njcm9sbF90bycsIGZhbHNlICk7XHJcblxyXG5cdFx0aWYgKCBMLmJvb2tpbmdfZGF0ZV9mb3JtYXQgKSB7XHJcblx0XHRcdHNldF9wYXJhbSggJ2Jvb2tpbmdfZGF0ZV9mb3JtYXQnLCBTdHJpbmcoIEwuYm9va2luZ19kYXRlX2Zvcm1hdCApICk7XHJcblx0XHR9XHJcblx0XHRpZiAoIEwuYm9va2luZ190aW1lX2Zvcm1hdCApIHtcclxuXHRcdFx0c2V0X3BhcmFtKCAnYm9va2luZ190aW1lX2Zvcm1hdCcsIFN0cmluZyggTC5ib29raW5nX3RpbWVfZm9ybWF0ICkgKTtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgZHMgPSBMLmRheXNfc2VsZWN0aW9uIHx8IHt9O1xyXG5cdFx0c2V0X3BhcmFtKCAnZGF5c19zZWxlY3RfbW9kZScsIFN0cmluZyggZHMuZGF5c19zZWxlY3RfbW9kZSB8fCAnbXVsdGlwbGUnICkgKTtcclxuXHRcdHNldF9wYXJhbSggJ2ZpeGVkX19kYXlzX251bScsIE51bWJlciggZHMuZml4ZWRfX2RheXNfbnVtIHx8IDAgKSApO1xyXG5cdFx0aWYgKCBkcy5maXhlZF9fd2Vla19kYXlzX19zdGFydCAhPSBudWxsICkge1xyXG5cdFx0XHRzZXRfcGFyYW0oICdmaXhlZF9fd2Vla19kYXlzX19zdGFydCcsIFsgU3RyaW5nKCBkcy5maXhlZF9fd2Vla19kYXlzX19zdGFydCApIF0gKTtcclxuXHRcdH1cclxuXHRcdHNldF9wYXJhbSggJ2R5bmFtaWNfX2RheXNfbWluJywgTnVtYmVyKCBkcy5keW5hbWljX19kYXlzX21pbiB8fCAwICkgKTtcclxuXHRcdHNldF9wYXJhbSggJ2R5bmFtaWNfX2RheXNfbWF4JywgTnVtYmVyKCBkcy5keW5hbWljX19kYXlzX21heCB8fCAwICkgKTtcclxuXHRcdGlmICggZHMuZHluYW1pY19fZGF5c19zcGVjaWZpYyAhPSBudWxsICkge1xyXG5cdFx0XHR2YXIgYXJyID0gU3RyaW5nKCBkcy5keW5hbWljX19kYXlzX3NwZWNpZmljIHx8ICcnICkuc3BsaXQoIC9cXHMqLFxccyovICkuZmlsdGVyKCBCb29sZWFuICkubWFwKCBOdW1iZXIgKTtcclxuXHRcdFx0c2V0X3BhcmFtKCAnZHluYW1pY19fZGF5c19zcGVjaWZpYycsIGFyciApO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCBkcy5keW5hbWljX193ZWVrX2RheXNfX3N0YXJ0ICE9IG51bGwgKSB7XHJcblx0XHRcdHNldF9wYXJhbSggJ2R5bmFtaWNfX3dlZWtfZGF5c19fc3RhcnQnLCBbIFN0cmluZyggZHMuZHluYW1pY19fd2Vla19kYXlzX19zdGFydCApIF0gKTtcclxuXHRcdH1cclxuXHJcblx0XHR0cnkge1xyXG5cdFx0XHRpZiAoIHR5cGVvZiB3LndwYmNfX2NvbmRpdGlvbnNfX1NBVkVfSU5JVElBTF9fZGF5c19zZWxlY3Rpb25fcGFyYW1zX19ibSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHR3LndwYmNfX2NvbmRpdGlvbnNfX1NBVkVfSU5JVElBTF9fZGF5c19zZWxlY3Rpb25fcGFyYW1zX19ibSggcmlkICk7XHJcblx0XHRcdH1cclxuXHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogRXh0cmFjdCBzYW5pdGl6ZWQgcmlkIGFuZCBtb250aHMgZnJvbSBkYXRhIG9yIERPTS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gZmllbGRfZWxcclxuXHQgKiBAcGFyYW0ge29iamVjdH0gIGRhdGFcclxuXHQgKiBAcmV0dXJucyB7e3JpZDpudW1iZXIsIG1vbnRoczpudW1iZXJ9fVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGdldF9yaWRfYW5kX21vbnRocyhmaWVsZF9lbCwgZGF0YSkge1xyXG5cdFx0dmFyIHJpZCAgICA9IDE7XHJcblx0XHR2YXIgbW9udGhzID0gMTtcclxuXHJcblx0XHQvLyBORVc6IHByZWZlciBkYXRhc2V0IG9uIHRoZSB3cmFwIChJbnNwZWN0b3IgZWRpdHMgbGFuZCBoZXJlIGZpcnN0KVxyXG5cdFx0dmFyIHdyYXAgPSBmaWVsZF9lbCA/IChmaWVsZF9lbC5jbG9zZXN0ICYmIGZpZWxkX2VsLmNsb3Nlc3QoJy53cGJjX2NhbGVuZGFyX3dyYXBlcicpKSB8fCBmaWVsZF9lbCA6IG51bGw7XHJcblx0XHRpZiAod3JhcCAmJiB3cmFwLmRhdGFzZXQpIHtcclxuXHRcdFx0aWYgKHdyYXAuZGF0YXNldC5yZXNvdXJjZV9pZCAhPSBudWxsICYmIHdyYXAuZGF0YXNldC5yZXNvdXJjZV9pZCAhPT0gJycpIHtcclxuXHRcdFx0XHRyaWQgPSBOdW1iZXIod3JhcC5kYXRhc2V0LnJlc291cmNlX2lkKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAod3JhcC5kYXRhc2V0Lm1vbnRocyAhPSBudWxsICYmIHdyYXAuZGF0YXNldC5tb250aHMgIT09ICcnKSB7XHJcblx0XHRcdFx0bW9udGhzID0gTnVtYmVyKHdyYXAuZGF0YXNldC5tb250aHMpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBkYXRhICYmIGRhdGEucmVzb3VyY2VfaWQgIT0gbnVsbCApIHtcclxuXHRcdFx0cmlkID0gTnVtYmVyKCBkYXRhLnJlc291cmNlX2lkICk7XHJcblx0XHR9XHJcblx0XHRpZiAoIGRhdGEgJiYgZGF0YS5tb250aHMgIT0gbnVsbCApIHtcclxuXHRcdFx0bW9udGhzID0gTnVtYmVyKCBkYXRhLm1vbnRocyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggIWRhdGEgKSB7XHJcblx0XHRcdC8vIEZhbGxiYWNrcyBmcm9tIERPTSB3aGVuIGRhdGEgb2JqZWN0IGlzIG5vdCBwcm92aWRlZC5cclxuXHRcdFx0dmFyIG4gPSBmaWVsZF9lbCA/IGZpZWxkX2VsLnF1ZXJ5U2VsZWN0b3IoICdbaWRePVwiY2FsZW5kYXJfYm9va2luZ1wiXScgKSA6IG51bGw7XHJcblx0XHRcdGlmICggbiAmJiBuLmlkICkge1xyXG5cdFx0XHRcdHZhciBtMSA9IG4uaWQubWF0Y2goIC9jYWxlbmRhcl9ib29raW5nKFxcZCspLyApO1xyXG5cdFx0XHRcdGlmICggbTEgKSB7XHJcblx0XHRcdFx0XHRyaWQgPSBOdW1iZXIoIG0xWzFdICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdHZhciBjb250ID0gZmllbGRfZWwgPyBmaWVsZF9lbC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfY2FsX2NvbnRhaW5lcicgKSA6IG51bGw7XHJcblx0XHRcdGlmICggY29udCAmJiBjb250LmNsYXNzTmFtZSApIHtcclxuXHRcdFx0XHR2YXIgbTIgPSBjb250LmNsYXNzTmFtZS5tYXRjaCggL2NhbF9tb250aF9udW1fKFxcZCspLyApO1xyXG5cdFx0XHRcdGlmICggbTIgKSB7XHJcblx0XHRcdFx0XHRtb250aHMgPSBOdW1iZXIoIG0yWzFdICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gRml4SW46IDIwMjYtMDMtMDcgICBPdmVycmlkZSB0byAgYWx3YXlzIGdldCB0aGUgZGVmYXVsdCBib29raW5nIHJlc291cmNlLCAgZm9yIHNwZWNpZmljIHVzZXIgaW4gTVUgb3IgZm9yIGV4aXN0ZWQgcmVzb3VyZWNzICFcclxuXHRcdHJpZCA9IHJlc29sdmVfZWZmZWN0aXZlX3Jlc291cmNlX2lkKCByaWQgKTtcclxuXHJcblx0XHRtb250aHMgPSBpc0Zpbml0ZSggbW9udGhzICkgPyBNYXRoLm1heCggMSwgTWF0aC5taW4oIDEyLCBNYXRoLmZsb29yKCBtb250aHMgKSApICkgOiAxO1xyXG5cclxuXHRcdHJldHVybiB7IHJpZDogcmlkLCBtb250aHM6IG1vbnRocyB9O1xyXG5cdH1cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBNaW5pbWFsIHByZXZpZXcgYm9vdHN0cmFwIOKAlCBsb2FkL3JlZnJlc2ggYSBjYWxlbmRhciBmb3IgYSBmaWVsZFxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBJbml0aWFsaXplIChvciB1cGRhdGUpIGEgY2FsZW5kYXIgcHJldmlldyBmb3IgYSBnaXZlbiBmaWVsZCBlbGVtZW50LlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtFbGVtZW50fSBmaWVsZF9lbCAgICAgICAgICAgLSBjYWxlbmRhciBmaWVsZCBlbGVtZW50ICh3cmFwKVxyXG5cdCAqIEBwYXJhbSB7b2JqZWN0fSAgZGF0YSAgICAgICAgICAgICAgIC0gYnVpbGRlciBmaWVsZCBkYXRhIChvcHRpb25hbClcclxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IHNob3VsZF9yZWxvYWRfZGF0YSAtIGZvcmNlIEFKQVggZGF0YSByZWxvYWRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiBpbml0X2ZpZWxkKGZpZWxkX2VsLCBkYXRhLCBzaG91bGRfcmVsb2FkX2RhdGEgPSB0cnVlKSB7XHJcblx0XHRpZiAoICFmaWVsZF9lbCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBwYWlyID0gZ2V0X3JpZF9hbmRfbW9udGhzKCBmaWVsZF9lbCwgZGF0YSApO1xyXG5cdFx0dmFyIHJpZCAgPSBwYWlyLnJpZDtcclxuXHJcblxyXG5cdFx0d2FpdF91bnRpbF9hcGlfcmVhZHkoIGZ1bmN0aW9uICgpIHtcclxuXHJcblx0XHRcdC8vIDEpIEFsd2F5cyAocmUpYXBwbHkgbG9jYWwgVUkg4oCUIG5lZWRlZCBhZnRlciBET00gbW92ZXMuXHJcblx0XHRcdGFwcGx5X21vbnRoc19jbGFzcyggZmllbGRfZWwsIHBhaXIubW9udGhzICk7XHJcblx0XHRcdHNldF9jYWxlbmRhcl9wYXJhbXMoIHJpZCwgcGFpci5tb250aHMgKTtcclxuXHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0dy53cGJjX2NhbGVuZGFyX3Nob3coIFN0cmluZyggcmlkICkgKTtcclxuXHRcdFx0fSBjYXRjaCAoIGUxICkge1xyXG5cdFx0XHRcdGRldi5lcnJvciggJ3dwYmNfY2FsZW5kYXJfc2hvdycsIGUxICk7XHJcblx0XHRcdH1cclxuXHRcdFx0c2V0X3NlY3VyZV9wYXJhbXMoKTtcclxuXHJcblx0XHRcdC8vIDIpIERlY2lkZSBvbiBBSkFYIHN0cmljdGx5IGJ5IFJJRCBzdGF0ZSArIGV4cGxpY2l0IHJlcXVlc3QuXHJcblx0XHRcdHZhciBmaXJzdF90aW1lX2Zvcl9yaWQgPSAhcmlkX2xvYWRlZF9jYWNoZVtyaWRdO1xyXG5cdFx0XHQvLyBSZXNwZWN0IGNhbGxlciBpbnRlbnQuIFJlbG9hZCBvbmx5IGlmIGV4cGxpY2l0bHkgYXNrZWQgT1IgZmlyc3QgdGltZSBmb3IgdGhpcyBSSUQuXHJcblx0XHRcdHZhciBkb19yZWxvYWQgICAgICAgICAgPSAhIXNob3VsZF9yZWxvYWRfZGF0YSB8fCBmaXJzdF90aW1lX2Zvcl9yaWQ7XHJcblxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGlmICggdHlwZW9mIHcud3BiY19jYWxlbmRhcl9fbG9hZF9kYXRhX19hanggPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRpZiAoIGRvX3JlbG9hZCApIHtcclxuXHRcdFx0XHRcdFx0dy53cGJjX2NhbGVuZGFyX19sb2FkX2RhdGFfX2FqeCgge1xyXG5cdFx0XHRcdFx0XHRcdCdyZXNvdXJjZV9pZCcgICAgICAgICAgICAgIDogcmlkLFxyXG5cdFx0XHRcdFx0XHRcdCdib29raW5nX2hhc2gnICAgICAgICAgICAgIDogJycsXHJcblx0XHRcdFx0XHRcdFx0J3JlcXVlc3RfdXJpJyAgICAgICAgICAgICAgOiBCb290LnJlcXVlc3RfdXJpIHx8ICh3LmxvY2F0aW9uID8gU3RyaW5nKCB3LmxvY2F0aW9uLnBhdGhuYW1lICsgdy5sb2NhdGlvbi5zZWFyY2ggKSA6ICcnKSxcclxuXHRcdFx0XHRcdFx0XHQnY3VzdG9tX2Zvcm0nICAgICAgICAgICAgICA6ICdzdGFuZGFyZCcsXHJcblx0XHRcdFx0XHRcdFx0J2FnZ3JlZ2F0ZV9yZXNvdXJjZV9pZF9zdHInOiAnJyxcclxuXHRcdFx0XHRcdFx0XHQnYWdncmVnYXRlX3R5cGUnICAgICAgICAgICA6ICdhbGwnXHJcblx0XHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHRcdFx0Ly8gTWFyayB0aGlzIHJpZCBhcyBsb2FkZWQgc28gc3Vic2VxdWVudCBET00gY2h1cm4gdXNlcyBsb29rLW9ubHkgcmVmcmVzaC5cclxuXHRcdFx0XHRcdFx0cmlkX2xvYWRlZF9jYWNoZVtyaWRdID0gdHJ1ZTtcclxuXHRcdFx0XHRcdH0gZWxzZSBpZiAoIHR5cGVvZiB3LndwYmNfY2FsZW5kYXJfX3VwZGF0ZV9sb29rID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHR3LndwYmNfY2FsZW5kYXJfX3VwZGF0ZV9sb29rKCByaWQgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gY2F0Y2ggKCBlMiApIHtcclxuXHRcdFx0XHRkZXYubG9nKCAnY2FsZW5kYXJfZGF0YV9sb2FkX3NraXAnLCBlMiApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBUcmFjayBsYXN0IGNvbmZpZyBmb3Igc29mdCBkZWR1cGUgKFVJIGNodXJuKTsga2VlcCBwZXItZWxlbWVudC5cclxuXHRcdFx0dHJ5IHsgZmllbGRfZWwuc2V0QXR0cmlidXRlKCdkYXRhLXdwYmMtY2FsLWluaXQnLCAnMScpOyBmaWVsZF9lbC5zZXRBdHRyaWJ1dGUoJ2RhdGEtd3BiYy1jYWwtbG9hZGVkLXJpZCcsIFN0cmluZyhyaWQpKTsgfSBjYXRjaCAoZTMpIHt9XHJcblxyXG5cdFx0fSwgNDAsIDEwMCApO1xyXG5cdH1cclxuXHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gRk9DUzogdGlueSBidXMgJiBET00gaGVscGVycyAoc25ha2UgZm9ybWF0KVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Y29uc3QgZGVmZXJfZm4gPSAoZm4pID0+ICh0eXBlb2Ygdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPT09ICdmdW5jdGlvbicgPyB3LnJlcXVlc3RBbmltYXRpb25GcmFtZSggZm4gKSA6IHNldFRpbWVvdXQoIGZuLCAwICkpO1xyXG5cclxuXHRmdW5jdGlvbiBmaW5kX2NhbGVuZGFyX3dyYXAoZWwpIHtcclxuXHRcdGlmICggISBlbCApIHtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gKGVsLmNsb3Nlc3QgJiYgZWwuY2xvc2VzdCggJy53cGJjX2NhbGVuZGFyX3dyYXBlcicgKSkgfHwgZWw7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpc19jYWxlbmRhcl93cmFwKGVsKSB7XHJcblx0XHR2YXIgd3JhcCA9IGZpbmRfY2FsZW5kYXJfd3JhcCggZWwgKTtcclxuXHRcdHJldHVybiAhISh3cmFwICYmIChcclxuXHRcdFx0KHdyYXAuZGF0YXNldCAmJiB3cmFwLmRhdGFzZXQudHlwZSA9PT0gJ2NhbGVuZGFyJykgfHxcclxuXHRcdFx0KHdyYXAucXVlcnlTZWxlY3RvciAmJiB3cmFwLnF1ZXJ5U2VsZWN0b3IoICdbaWRePVwiY2FsZW5kYXJfYm9va2luZ1wiXScgKSlcclxuXHRcdCkpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gbG9va19yZWZyZXNoKHRhcmdldCwgb3B0cykge1xyXG5cdFx0dmFyIG8gICAgPSBvcHRzIHx8IHt9O1xyXG5cdFx0dmFyIHdyYXAgPSBmaW5kX2NhbGVuZGFyX3dyYXAoIHRhcmdldCApO1xyXG5cdFx0aWYgKCAhIHdyYXAgfHwgISBkb2N1bWVudC5jb250YWlucyggd3JhcCApICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHRkZWZlcl9mbiggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRpbml0X2ZpZWxkKCB3cmFwLCBudWxsLCAhIW8ucmVsb2FkICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBvbl9ldmVudCh0eXBlLCBoYW5kbGVyKSB7XHJcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCB0eXBlLCBoYW5kbGVyICk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBJbml0aWFsaXplIGFsbCBjYWxlbmRhcnMgcHJlc2VudCBpbiB0aGUgY3VycmVudCBCdWlsZGVyIHByZXZpZXcgcGFuZWwuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gaW5pdF9hbGxfb25fcGFnZShzaG91bGRfcmVsb2FkX2RhdGEgPSB0cnVlKSB7XHJcblx0XHR2YXIgc2NvcGUgPSB3LmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICcjd3BiY19iZmJfX3BhZ2VzX3BhbmVsJyApIHx8IHcuZG9jdW1lbnQ7XHJcblx0XHR2YXIgbm9kZXMgPSBzY29wZS5xdWVyeVNlbGVjdG9yQWxsKCAnW2lkXj1cImNhbGVuZGFyX2Jvb2tpbmdcIl0nICk7XHJcblx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0dmFyIG5vZGUgICAgID0gbm9kZXNbaV07XHJcblx0XHRcdHZhciBmaWVsZF9lbCA9IG5vZGUuY2xvc2VzdCggJy53cGJjX2NhbGVuZGFyX3dyYXBlcicgKSB8fCBub2RlLnBhcmVudEVsZW1lbnQgfHwgbm9kZTtcclxuXHRcdFx0aW5pdF9maWVsZCggZmllbGRfZWwsIG51bGwsIHNob3VsZF9yZWxvYWRfZGF0YSApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIExpc3RlbiB0byBidWlsZGVy4oCZcyBidXMgKGV2ZW50cyBidWJibGUgb24gZG9jdW1lbnQgdmlhIENvcmUuV1BCQ19CRkJfRXZlbnRCdXMpXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gYmluZF9idWlsZGVyX2J1c19ldmVudHMoKSB7XHJcblxyXG5cdFx0Ly8gQWxpYXMgZXZlbnRzIG9uY2UuXHJcblx0XHR2YXIgRVYgPSBDb3JlLldQQkNfQkZCX0V2ZW50cyB8fCB7fTtcclxuXHJcblx0XHQvLyAxKSBGaXJzdCBzdHJ1Y3R1cmUgcmVhZHkgLT4gbG9vay1vbmx5IHJlbmRlci5cclxuXHRcdG9uX2V2ZW50KCBFVi5TVFJVQ1RVUkVfTE9BREVELCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdGluaXRfYWxsX29uX3BhZ2UoIGZhbHNlICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0Ly8gMikgRmllbGQvc2VjdGlvbiBhZGRlZCAtPiBpbml0aWFsaXplIHRoYXQgbm9kZSBpZiBpdOKAmXMgYSBjYWxlbmRhciAoZm9yY2UgcmVsb2FkKS5cclxuXHRcdG9uX2V2ZW50KCBFVi5GSUVMRF9BREQsIGZ1bmN0aW9uIChlKSB7XHJcblx0XHRcdHZhciBlbCA9IGUgJiYgZS5kZXRhaWwgJiYgZS5kZXRhaWwuZWw7XHJcblx0XHRcdGlmICggISBlbCApIHtcclxuXHRcdFx0XHQvLyBEZWZlbnNpdmUgZmFsbGJhY2s6IGlmIGVtaXR0ZXIgZGlkbuKAmXQgcHJvdmlkZSB0aGUgZWxlbWVudCwgcmVmcmVzaCBhbGwgY2FsZW5kYXJzIChsb29rLW9ubHkpLlxyXG5cdFx0XHRcdHJldHVybiBkZWZlcl9mbihmdW5jdGlvbiAoKSB7IGluaXRfYWxsX29uX3BhZ2UoZmFsc2UpOyB9KTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIGlzX2NhbGVuZGFyX3dyYXAoIGVsICkgKSB7XHJcblx0XHRcdFx0bG9va19yZWZyZXNoKCBlbCwgeyByZWxvYWQ6IHRydWUgfSApOyAvLyBidWlsZGVyIGp1c3QgaW5zZXJ0ZWQ7IFNvIGRvIEFqYXggZmV0Y2ggZGF0YS5cclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cclxuXHJcblx0XHQvLyAzKSBHZW5lcmljIHN0cnVjdHVyZSBjaGFuZ2VzLlxyXG5cdFx0b25fZXZlbnQoIEVWLlNUUlVDVFVSRV9DSEFOR0UsIGZ1bmN0aW9uIChlKSB7XHJcblx0XHRcdHZhciBkICAgICAgPSAoZSAmJiBlLmRldGFpbCkgfHwge307XHJcblx0XHRcdHZhciByZWFzb24gPSBkLnJlYXNvbiB8fCAnJztcclxuXHJcblx0XHRcdC8vIEhlYXZ5IG9wZXJhdGlvbnMgLT4gY2hlYXAgbG9vayByZWZyZXNoIGZvciBhbGwgY2FsZW5kYXJzLCBubyBkYXRhIHJlbG9hZC5cclxuXHRcdFx0aWYgKCByZWFzb24gPT09ICdzb3J0LXVwZGF0ZScgfHwgcmVhc29uID09PSAnc2VjdGlvbi1tb3ZlJyB8fCByZWFzb24gPT09ICdkZWxldGUnICkge1xyXG5cdFx0XHRcdHJldHVybiBkZWZlcl9mbiggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0aW5pdF9hbGxfb25fcGFnZSggZmFsc2UgKTtcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIE9ubHkgY2FyZSBhYm91dCBjYWxlbmRhciB0YXJnZXRzLlxyXG5cdFx0XHRpZiAoICEgaXNfY2FsZW5kYXJfd3JhcCggZC5lbCApICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0Ly8gT25seSByZWxvYWQgZGF0YSBvbiBjb21taXR0ZWQgcmVzb3VyY2VfaWQgY2hhbmdlcy5cclxuXHRcdFx0dmFyIGsgICAgID0gZC5rZXkgfHwgJyc7XHJcblx0XHRcdHZhciBwaGFzZSA9IChkLnBoYXNlIHx8ICcnKS50b0xvd2VyQ2FzZSgpOyAvLyBzZXQgYnkgdGhlIGVtaXR0ZXIgYWJvdmUuXHJcblx0XHRcdGlmICggayA9PT0gJ3Jlc291cmNlX2lkJyAmJiBwaGFzZSAhPT0gJ2NoYW5nZScgKSB7XHJcblx0XHRcdFx0cmV0dXJuOyAvLyBTa2lwIG9uIHNlY29uZCBpbnB1dCBoYW5kbGVyOiBpbnMuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgaGFuZGxlciwgdHJ1ZSApOyAgaW4gLi4vaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX19qcy9jb3JlL2JmYi11aS5qcyAvLy5cclxuXHRcdFx0fVxyXG5cdFx0XHQvLyBSZXBsYWNlIHRvICBUUlVFLCAgaWYgbmVlZHMgdG8gIEZPUkNFIGFqYXggcmVsb2FkIG9mIGNhbGVuZGFyICBkYXRhIG9mIHJlc291cmNlIElEIGNoYW5nZS5cclxuXHRcdFx0dmFyIG11c3RfcmVsb2FkID0gKGsgPT09ICdyZXNvdXJjZV9pZCcgJiYgcGhhc2UgPT09ICdjaGFuZ2UnKVxyXG5cdFx0XHRcdD8gZmFsc2VcclxuXHRcdFx0XHQ6IGZhbHNlO1xyXG5cdFx0XHRsb29rX3JlZnJlc2goIGQuZWwsIHsgcmVsb2FkOiBtdXN0X3JlbG9hZCB9ICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIEZpZWxkIFJlbmRlcmVyIChjbGFzcy1saWtlLCBleHRlbmRhYmxlKVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Y2xhc3MgV1BCQ19CRkJfRmllbGRfQ2FsZW5kYXIgZXh0ZW5kcyAoRmllbGRfQmFzZSB8fCBjbGFzcyB7fSkge1xyXG5cclxuXHRcdHN0YXRpYyB0ZW1wbGF0ZV9pZCA9ICd3cGJjLWJmYi1maWVsZC1jYWxlbmRhcic7ICAvLyBVbmRlcnNjb3JlIHRlbXBsYXRlIGlkIGZyb20gUEhQIHByaW50ZXIuXHJcblx0XHRzdGF0aWMga2luZCAgICAgICAgPSAnY2FsZW5kYXInO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRGVmYXVsdCBwcm9wcyDigJQga2VlcCBpbiBzeW5jIHdpdGggUEhQIHNjaGVtYSBkZWZhdWx0cy5cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGdldF9kZWZhdWx0cygpIHtcclxuXHRcdFx0cmV0dXJuIHtcclxuXHRcdFx0XHR0eXBlICAgICAgIDogJ2NhbGVuZGFyJyxcclxuXHRcdFx0XHRsYWJlbCAgICAgIDogJ1NlbGVjdCBEYXRlJyxcclxuXHRcdFx0XHRyZXNvdXJjZV9pZDogcmVzb2x2ZV9lZmZlY3RpdmVfcmVzb3VyY2VfaWQoIDEgKSxcclxuXHRcdFx0XHRtb250aHMgICAgIDogMSxcclxuXHRcdFx0XHRuYW1lICAgICAgIDogJycsXHJcblx0XHRcdFx0aHRtbF9pZCAgICA6ICcnLFxyXG5cdFx0XHRcdGNzc2NsYXNzICAgOiAnJyxcclxuXHRcdFx0XHRoZWxwICAgICAgIDogJycsXHJcblx0XHRcdFx0bWluX3dpZHRoICA6ICcyNTBweCdcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENhbGxlZCBieSB0aGUgQnVpbGRlciBhZnRlciB0aGUgZmllbGQgaXMgZHJvcHBlZC9sb2FkZWQvcHJldmlld2VkLlxyXG5cdFx0ICogV2UgKHJlKWluaXRpYWxpemUgdGhlIHByZXZpZXcgZm9yIHRoZSBzcGVjaWZpYyBlbGVtZW50LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7b2JqZWN0fSAgZGF0YVxyXG5cdFx0ICogQHBhcmFtIHtFbGVtZW50fSBmaWVsZF9lbFxyXG5cdFx0ICogQHBhcmFtIHt7Y29udGV4dDpzdHJpbmd9fSBjdHhcclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIG9uX2ZpZWxkX2Ryb3AoZGF0YSwgZmllbGRfZWwsIGN0eCkge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGluaXRfZmllbGQoIGZpZWxkX2VsLCBkYXRhLCBmYWxzZSApO1xyXG5cdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHRkZXYuZXJyb3IoICdXUEJDX0JGQl9GaWVsZF9DYWxlbmRhci5vbl9maWVsZF9kcm9wJywgZSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBIeWRyYXRlIGFmdGVyIHByZXZpZXcgcmVuZGVyIChubyByZWJ1aWxkKS4gQ2FsbGVkIGJ5IGJ1aWxkZXIucmVuZGVyX3ByZXZpZXcoKS5cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGh5ZHJhdGUoZmllbGRfZWwsIGRhdGEsIGN0eCkge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGluaXRfZmllbGQoIGZpZWxkX2VsLCBkYXRhLCBmYWxzZSApO1xyXG5cdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHRkZXYuZXJyb3IoICdXUEJDX0JGQl9GaWVsZF9DYWxlbmRhci5oeWRyYXRlJywgZSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdH1cclxuXHJcblx0Ly8gUmVnaXN0ZXIgcGFjayByZW5kZXJlciB3aXRoIHRoZSBjZW50cmFsIHJlZ2lzdHJ5LlxyXG5cdHRyeSB7XHJcblx0XHRSZWdpc3RyeS5yZWdpc3RlciggJ2NhbGVuZGFyJywgV1BCQ19CRkJfRmllbGRfQ2FsZW5kYXIgKTtcclxuXHR9IGNhdGNoICggZSApIHtcclxuXHRcdGRldi5lcnJvciggJ1dQQkNfQkZCX0ZpZWxkX0NhbGVuZGFyLnJlZ2lzdGVyJywgZSApO1xyXG5cdH1cclxuXHJcblx0Ly8gQm9vdHN0cmFwOiBvbiBET00gcmVhZHksIHJ1biBhIGZpcnN0IHNjYW4gYW5kIHdpcmUgbGlnaHQgcmVhY3Rpdml0eS5cclxuXHRmdW5jdGlvbiBvbl9yZWFkeShmbikge1xyXG5cdFx0aWYgKCB3LmRvY3VtZW50LnJlYWR5U3RhdGUgPT09ICdpbnRlcmFjdGl2ZScgfHwgdy5kb2N1bWVudC5yZWFkeVN0YXRlID09PSAnY29tcGxldGUnICkge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGZuKCk7XHJcblx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR3LmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdET01Db250ZW50TG9hZGVkJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRmbigpO1xyXG5cdFx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0b25fcmVhZHkoIGZ1bmN0aW9uICgpIHtcclxuXHRcdHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0aW5pdF9hbGxfb25fcGFnZSggZmFsc2UgKTtcclxuXHRcdFx0YmluZF9idWlsZGVyX2J1c19ldmVudHMoKTtcclxuXHRcdH0sIDAgKTtcclxuXHR9ICk7XHJcblxyXG5cdC8vIE9wdGlvbmFsIGV4cG9ydCAoaGFuZHkgZm9yIGRlYnVnZ2luZykuXHJcblx0dy5XUEJDX0JGQl9GaWVsZF9DYWxlbmRhciA9IFdQQkNfQkZCX0ZpZWxkX0NhbGVuZGFyO1xyXG5cclxuXHJcblx0Ly8gLS0gRXhwb3J0IGZvciBcIkJvb2tpbmcgRm9ybVwiIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHQvKipcclxuXHQgKiBSZWdpc3RlciB0aGUgXCJjYWxlbmRhclwiIGV4cG9ydGVyIChsYXp5OiB0cmllcyBub3csIG9yIHdhaXRzIGZvciBleHBvcnRlci1yZWFkeSkuXHJcblx0ICogT3V0cHV0OlxyXG5cdCAqICAg4oCiIFtjYWxlbmRhcl0gb25seSAobm8gcmlkL21vbnRocy9jbGFzcy9pZCB0b2tlbnMgaW5zaWRlKVxyXG5cdCAqICAg4oCiIElmIGh0bWxfaWQgLyBjc3NjbGFzcyBzZXQg4oaSIHdyYXAgc2hvcnRjb2RlIGluIDxzcGFuIC4uLiBzdHlsZT1cImZsZXg6MTtcIj7igKY8L3NwYW4+XHJcblx0ICogICDigKIgTGFiZWwgYWJvdmUgKHdoZW4gYWRkTGFiZWxzICE9PSBmYWxzZSkuXHJcblx0ICogICAgIEhlbHAgdGV4dCBpcyBhcHBlbmRlZCBieSBXUEJDX0JGQl9FeHBvcnRlci5yZW5kZXJfZmllbGRfbm9kZSgpLlxyXG5cdCAqXHJcblx0ICogQm9va2luZyBGb3JtIGV4cG9ydGVyIGNhbGxiYWNrIChBZHZhbmNlZCBGb3JtIHNob3J0Y29kZSkuXHJcblx0ICpcclxuXHQgKiBUaGlzIGNhbGxiYWNrIGlzIHJlZ2lzdGVyZWQgcGVyIGZpZWxkIHR5cGUgdmlhOlxyXG5cdCAqICAgV1BCQ19CRkJfRXhwb3J0ZXIucmVnaXN0ZXIoICdzaG9ydGNvZGVfbmFtZScsIGNhbGxiYWNrIClcclxuXHQgKlxyXG5cdCAqIENvcmUgY2FsbCBzaXRlIChidWlsZGVyLWV4cG9ydGVyLmpzKTpcclxuXHQgKiAgIFdQQkNfQkZCX0V4cG9ydGVyLnJ1bl9yZWdpc3RlcmVkX2V4cG9ydGVyKCBmaWVsZCwgaW8sIGNmZywgb25jZSwgY3R4IClcclxuXHQgKiAgICAg4oaSIGNhbGxiYWNrKCBmaWVsZCwgZW1pdCwgeyBpbywgY2ZnLCBvbmNlLCBjdHgsIGNvcmUgfSApO1xyXG5cdCAqXHJcblx0ICogQGNhbGxiYWNrIFdQQkNfQkZCX0V4cG9ydGVyQ2FsbGJhY2tcclxuXHQgKiBAcGFyYW0ge09iamVjdH0gIGZpZWxkXHJcblx0ICogICBOb3JtYWxpemVkIGZpZWxkIGRhdGEgY29taW5nIGZyb20gdGhlIEJ1aWxkZXIgc3RydWN0dXJlLlxyXG5cdCAqICAgLSBmaWVsZC50eXBlICAgICAgICAgIHtzdHJpbmd9ICAgRmllbGQgdHlwZSwgZS5nLiBcInRleHRcIi5cclxuXHQgKiAgIC0gZmllbGQubmFtZSAgICAgICAgICB7c3RyaW5nfSAgIE5hbWUgYXMgc3RvcmVkIG9uIHRoZSBjYW52YXMgKGFscmVhZHkgdmFsaWRhdGVkKS5cclxuXHQgKiAgIC0gZmllbGQuaWQgLyBodG1sX2lkICB7c3RyaW5nfSAgIE9wdGlvbmFsIEhUTUwgaWQgLyB1c2VyLXZpc2libGUgaWQuXHJcblx0ICogICAtIGZpZWxkLmxhYmVsICAgICAgICAge3N0cmluZ30gICBWaXNpYmxlIGxhYmVsIGluIHRoZSBmb3JtIChtYXkgYmUgZW1wdHkpLlxyXG5cdCAqICAgLSBmaWVsZC5wbGFjZWhvbGRlciAgIHtzdHJpbmd9ICAgUGxhY2Vob2xkZXIgdGV4dCAobWF5IGJlIGVtcHR5KS5cclxuXHQgKiAgIC0gZmllbGQucmVxdWlyZWQgICAgICB7Ym9vbGVhbnxudW1iZXJ8c3RyaW5nfSBcInRydXRoeVwiIGlmIHJlcXVpcmVkLlxyXG5cdCAqICAgLSBmaWVsZC5jc3NjbGFzcyAgICAgIHtzdHJpbmd9ICAgRXh0cmEgQ1NTIGNsYXNzZXMgZW50ZXJlZCBpbiBJbnNwZWN0b3IuXHJcblx0ICogICAtIGZpZWxkLmRlZmF1bHRfdmFsdWUge3N0cmluZ30gICBEZWZhdWx0IHRleHQgdmFsdWUuXHJcblx0ICogICAtIGZpZWxkLm9wdGlvbnMgICAgICAge0FycmF5fSAgICBPbmx5IGZvciBvcHRpb24tYmFzZWQgZmllbGRzIChzZWxlY3QsIGNoZWNrYm94LCBldGMuKS5cclxuXHQgKiAgIC0gLi4uICAgICAgICAgICAgICAgICAoQW55IG90aGVyIHBhY2stc3BlY2lmaWMgcHJvcHMgYXJlIGFsc28gcHJlc2VudC4pXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge2Z1bmN0aW9uKHN0cmluZyk6dm9pZH0gZW1pdFxyXG5cdCAqICAgRW1pdHMgb25lIGxpbmUvZnJhZ21lbnQgaW50byB0aGUgZXhwb3J0IGJ1ZmZlci5cclxuXHQgKiAgIC0gRWFjaCBjYWxsIGNvcnJlc3BvbmRzIHRvIG9uZSBgcHVzaCgpYCBpbiB0aGUgY29yZSBleHBvcnRlci5cclxuXHQgKiAgIC0gRm9yIG11bHRpLWxpbmUgb3V0cHV0IChlLmcuIGxhYmVsICsgc2hvcnRjb2RlKSwgY2FsbCBgZW1pdCgpYCBtdWx0aXBsZSB0aW1lczpcclxuXHQgKiAgICAgICBlbWl0KCc8bD5MYWJlbDwvbD4nKTtcclxuXHQgKiAgICAgICBlbWl0KCc8YnI+W3RleHQqIG5hbWUgLi4uXScpO1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IFtleHRyYXNdXHJcblx0ICogICBFeHRyYSBjb250ZXh0IHBhc3NlZCBieSB0aGUgY29yZSBleHBvcnRlci5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBbZXh0cmFzLmlvXVxyXG5cdCAqICAgTG93LWxldmVsIHdyaXRlciB1c2VkIGludGVybmFsbHkgYnkgdGhlIGNvcmUuXHJcblx0ICogICBOb3JtYWxseSB5b3UgZG8gTk9UIG5lZWQgaXQgaW4gcGFja3Mg4oCUIHByZWZlciBgZW1pdCgpYC5cclxuXHQgKiAgIC0gZXh0cmFzLmlvLm9wZW4oc3RyKSAgIOKGkiBvcGVuIGEgbmVzdGVkIGJsb2NrIChpbmNyZW1lbnRzIGluZGVudGF0aW9uKS5cclxuXHQgKiAgIC0gZXh0cmFzLmlvLmNsb3NlKHN0cikgIOKGkiBjbG9zZSBhIGJsb2NrIChkZWNyZW1lbnRzIGluZGVudGF0aW9uKS5cclxuXHQgKiAgIC0gZXh0cmFzLmlvLnB1c2goc3RyKSAgIOKGkiBwdXNoIHJhdyBsaW5lICh1c2VkIGJ5IGBlbWl0KClgKS5cclxuXHQgKiAgIC0gZXh0cmFzLmlvLmJsYW5rKCkgICAgIOKGkiBwdXNoIGFuIGVtcHR5IGxpbmUuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge09iamVjdH0gW2V4dHJhcy5jZmddXHJcblx0ICogICBFeHBvcnQgY29uZmlndXJhdGlvbiAoc2FtZSBvYmplY3QgcGFzc2VkIHRvIFdQQkNfQkZCX0V4cG9ydGVyLmV4cG9ydF9mb3JtKCkpLlxyXG5cdCAqICAgVXNlZnVsIGZsYWdzIGZvciBmaWVsZCBwYWNrczpcclxuXHQgKiAgIC0gZXh0cmFzLmNmZy5hZGRMYWJlbHMge2Jvb2xlYW59ICBEZWZhdWx0OiB0cnVlLlxyXG5cdCAqICAgICAgIElmIGZhbHNlLCBwYWNrcyBzaG91bGQgTk9UIGVtaXQgPGw+TGFiZWw8L2w+IGxpbmVzLlxyXG5cdCAqICAgLSBleHRyYXMuY2ZnLm5ld2xpbmUgICB7c3RyaW5nfSAgIE5ld2xpbmUgc2VwYXJhdG9yICh1c3VhbGx5IFwiXFxuXCIpLlxyXG5cdCAqICAgLSBleHRyYXMuY2ZnLmdhcFBlcmNlbnR7bnVtYmVyfSAgIExheW91dCBnYXAgKHVzZWQgb25seSBieSBzZWN0aW9uL2NvbHVtbiBsb2dpYykuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge09iamVjdH0gW2V4dHJhcy5vbmNlXVxyXG5cdCAqICAgU2hhcmVkIFwib25jZS1wZXItZm9ybVwiIGd1YXJkcyBhY3Jvc3MgYWxsIGZpZWxkcy5cclxuXHQgKiAgIENvdW50ZXJzIGFyZSBpbmNyZW1lbnRlZCBieSBzb21lIGZpZWxkIHR5cGVzIChjYXB0Y2hhLCBjb3Vwb24sIGV0Yy4pLlxyXG5cdCAqICAgVHlwaWNhbCBzaGFwZTpcclxuXHQgKiAgIC0gZXh0cmFzLm9uY2UuY2FwdGNoYSAgICAgICAgICB7bnVtYmVyfVxyXG5cdCAqICAgLSBleHRyYXMub25jZS5jb3VudHJ5ICAgICAgICAgIHtudW1iZXJ9XHJcblx0ICogICAtIGV4dHJhcy5vbmNlLmNvdXBvbiAgICAgICAgICAge251bWJlcn1cclxuXHQgKiAgIC0gZXh0cmFzLm9uY2UuY29zdF9jb3JyZWN0aW9ucyB7bnVtYmVyfVxyXG5cdCAqICAgLSBleHRyYXMub25jZS5zdWJtaXQgICAgICAgICAgIHtudW1iZXJ9XHJcblx0ICpcclxuXHQgKiAgIFRleHQgZmllbGQgdXN1YWxseSBkb2VzIG5vdCB0b3VjaCB0aGlzIG9iamVjdCwgYnV0IG90aGVyIHBhY2tzIGNhbiB1c2UgaXRcclxuXHQgKiAgIHRvIHNraXAgZHVwbGljYXRlcyAoZS5nLiBvbmx5IHRoZSBmaXJzdCBbY291cG9uXSBwZXIgZm9ybSBpcyBleHBvcnRlZCkuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge09iamVjdH0gW2V4dHJhcy5jdHhdXHJcblx0ICogICBTaGFyZWQgZXhwb3J0IGNvbnRleHQgZm9yIHRoZSBlbnRpcmUgZm9ybS5cclxuXHQgKiAgIEN1cnJlbnRseTpcclxuXHQgKiAgIC0gZXh0cmFzLmN0eC51c2VkSWRzIHtTZXQ8c3RyaW5nPn1cclxuXHQgKiAgICAgICBTZXQgb2YgSFRNTC9zaG9ydGNvZGUgSURzIGFscmVhZHkgdXNlZCBpbiB0aGlzIGV4cG9ydC5cclxuXHQgKiAgICAgICBIZWxwZXJzIGxpa2UgRXhwLmlkX29wdGlvbihmaWVsZCwgY3R4KSB1c2UgaXQgdG8gZW5zdXJlIHVuaXF1ZW5lc3MuXHJcblx0ICpcclxuXHQgKiAgIFBhY2tzIG5vcm1hbGx5IGp1c3QgcGFzcyBgY3R4YCBpbnRvIGhlbHBlcnMgKGlkX29wdGlvbiwgZXRjLikgd2l0aG91dFxyXG5cdCAqICAgbXV0YXRpbmcgaXQgZGlyZWN0bHkuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge09iamVjdH0gW2V4dHJhcy5jb3JlXVxyXG5cdCAqICAgUmVmZXJlbmNlIHRvIFdQQkNfQkZCX0NvcmUgcGFzc2VkIGZyb20gYnVpbGRlci1leHBvcnRlci5qcy5cclxuXHQgKiAgIFByaW1hcmlseSB1c2VkIHRvIGFjY2VzcyBzYW5pdGl6ZXJzOlxyXG5cdCAqICAgLSBleHRyYXMuY29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5lc2NhcGVfaHRtbCguLi4pXHJcblx0ICogICAtIGV4dHJhcy5jb3JlLldQQkNfQkZCX1Nhbml0aXplLmVzY2FwZV9mb3Jfc2hvcnRjb2RlKC4uLilcclxuXHQgKiAgIC0gZXh0cmFzLmNvcmUuV1BCQ19CRkJfU2FuaXRpemUuc2FuaXRpemVfaHRtbF9uYW1lKC4uLilcclxuXHQgKiAgIC0gZXRjLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGV4cG9ydF9zaG9ydGNvZGVfaW5fYm9va2luZ19mb3JtKCkge1xyXG5cclxuXHRcdGNvbnN0IEV4cCA9IHcuV1BCQ19CRkJfRXhwb3J0ZXI7XHJcblx0XHRpZiAoICEgRXhwIHx8IHR5cGVvZiBFeHAucmVnaXN0ZXIgIT09ICdmdW5jdGlvbicgKSB7IHJldHVybiBmYWxzZTsgfVxyXG5cdFx0aWYgKCB0eXBlb2YgRXhwLmhhc19leHBvcnRlciA9PT0gJ2Z1bmN0aW9uJyAmJiBFeHAuaGFzX2V4cG9ydGVyKCAnY2FsZW5kYXInICkgKSB7IHJldHVybiB0cnVlOyB9XHJcblxyXG5cdFx0Ly8gVXNlIHNhbml0aXplIGhlbHBlcnMgZnJvbSBjb3JlIChhbHJlYWR5IGxvYWRlZCkuXHJcblx0XHRjb25zdCBTICAgID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZSB8fCAody5XUEJDX0JGQl9Db3JlICYmIHcuV1BCQ19CRkJfQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZSkgfHwge307XHJcblx0XHRjb25zdCBlc2MgID0gUy5lc2NhcGVfaHRtbCB8fCAodiA9PiBTdHJpbmcoIHYgKSk7XHJcblx0XHRjb25zdCBzaWQgID0gUy5zYW5pdGl6ZV9odG1sX2lkIHx8ICh2ID0+IFN0cmluZyggdiApKTtcclxuXHRcdGNvbnN0IHNjbHMgPSBTLnNhbml0aXplX2Nzc19jbGFzc2xpc3QgfHwgKHYgPT4gU3RyaW5nKCB2ICkpO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUGVyLWZpZWxkIGV4cG9ydGVyIGZvciBcImNhbGVuZGFyXCIgaW4gQWR2YW5jZWQgRm9ybS5cclxuXHRcdCAqIEB0eXBlIHtXUEJDX0JGQl9FeHBvcnRlckNhbGxiYWNrfVxyXG5cdFx0ICovXHJcblx0XHRFeHAucmVnaXN0ZXIoICdjYWxlbmRhcicsIChmaWVsZCwgZW1pdCwgZXh0cmFzID0ge30pID0+IHtcclxuXHJcblx0XHRcdGNvbnN0IGNmZyAgICAgICA9IGV4dHJhcy5jZmcgfHwge307XHJcblx0XHRcdGNvbnN0IGN0eCAgICAgICA9IGV4dHJhcy5jdHg7XHJcblx0XHRcdGNvbnN0IHVzZWRJZHMgICA9IChjdHggJiYgY3R4LnVzZWRJZHMgaW5zdGFuY2VvZiBTZXQpID8gY3R4LnVzZWRJZHMgOiBudWxsO1xyXG5cdFx0XHRjb25zdCBhZGRMYWJlbHMgPSBjZmcuYWRkTGFiZWxzICE9PSBmYWxzZTtcclxuXHJcblx0XHRcdC8vIE9wdGlvbmFsIHdyYXBwZXIgYXR0cnMgKGlkL2NsYXNzIG9uIG91dGVyIHNwYW4sIG5vdCBpbnNpZGUgW2NhbGVuZGFyXSkuXHJcblx0XHRcdGxldCBodG1sX2lkID0gZmllbGQgJiYgZmllbGQuaHRtbF9pZCA/IHNpZCggU3RyaW5nKCBmaWVsZC5odG1sX2lkICkgKSA6ICcnO1xyXG5cdFx0XHRpZiAoIGh0bWxfaWQgJiYgdXNlZElkcyApIHtcclxuXHRcdFx0XHRsZXQgdSA9IGh0bWxfaWQsIGkgPSAyO1xyXG5cdFx0XHRcdHdoaWxlICggdXNlZElkcy5oYXMoIHUgKSApIHtcclxuXHRcdFx0XHRcdHUgPSBgJHtodG1sX2lkfV8ke2krK31gO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHR1c2VkSWRzLmFkZCggdSApO1xyXG5cdFx0XHRcdGh0bWxfaWQgPSB1O1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCBjbHNfcmF3ID0gZmllbGQgJiYgKGZpZWxkLmNzc2NsYXNzX2V4dHJhIHx8IGZpZWxkLmNzc2NsYXNzIHx8IGZpZWxkLmNsYXNzKSB8fCAnJztcclxuXHRcdFx0Y29uc3QgY2xzICAgICA9IHNjbHMoIFN0cmluZyggY2xzX3JhdyApICk7XHJcblxyXG5cdFx0XHRjb25zdCBoYXNXcmFwICAgPSAhISggaHRtbF9pZCB8fCBjbHMgKTtcclxuXHRcdFx0Y29uc3Qgd3JhcE9wZW4gID0gaGFzV3JhcFxyXG5cdFx0XHRcdD8gYDxzcGFuJHtodG1sX2lkID8gYCBpZD1cIiR7ZXNjKCBodG1sX2lkICl9XCJgIDogJyd9JHtjbHMgPyBgIGNsYXNzPVwiJHtlc2MoIGNscyApfVwiYCA6ICcnfSBzdHlsZT1cImZsZXg6MTtcIj5gXHJcblx0XHRcdFx0OiAnJztcclxuXHRcdFx0Y29uc3Qgd3JhcENsb3NlID0gaGFzV3JhcCA/ICc8L3NwYW4+JyA6ICcnO1xyXG5cclxuXHRcdFx0Ly8gQ2FsZW5kYXIgYm9keSBpcyBpbnRlbnRpb25hbGx5IG1pbmltYWw7IG5vIHJpZC9tb250aHMvaWQvY2xhc3MgdG9rZW5zIGluc2lkZSBzaG9ydGNvZGUuXHJcblx0XHRcdGNvbnN0IGJvZHkgID0gJ1tjYWxlbmRhcl0nO1xyXG5cdFx0XHRjb25zdCBsYWJlbCA9ICh0eXBlb2YgZmllbGQ/LmxhYmVsID09PSAnc3RyaW5nJykgPyBmaWVsZC5sYWJlbC50cmltKCkgOiAnJztcclxuXHJcblx0XHRcdGlmICggbGFiZWwgJiYgYWRkTGFiZWxzICkge1xyXG5cdFx0XHRcdGVtaXQoIGA8bD4ke2VzYyggbGFiZWwgKX08L2w+YCApO1xyXG5cdFx0XHRcdGVtaXQoIGA8YnI+JHt3cmFwT3Blbn0ke2JvZHl9JHt3cmFwQ2xvc2V9YCApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGVtaXQoIGAke3dyYXBPcGVufSR7Ym9keX0ke3dyYXBDbG9zZX1gICk7XHJcblx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9XHJcblxyXG5cdC8vIFRyeSBub3c7IGlmIGV4cG9ydGVyIGlzbid0IHJlYWR5IHlldCwgd2FpdCBmb3Igb25lLXNob3QgZXZlbnQgZnJvbSBidWlsZGVyLWV4cG9ydGVyLlxyXG5cdGlmICggISBleHBvcnRfc2hvcnRjb2RlX2luX2Jvb2tpbmdfZm9ybSgpICkge1xyXG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6YmZiOmV4cG9ydGVyLXJlYWR5JywgZXhwb3J0X3Nob3J0Y29kZV9pbl9ib29raW5nX2Zvcm0sIHsgb25jZTogdHJ1ZSB9ICk7XHJcblx0fVxyXG5cclxuXHQvLyAtLSBFeHBvcnQgZm9yIFwiQm9va2luZyBEYXRhXCIgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlZ2lzdGVyIHRoZSBcImNhbGVuZGFyXCIgZXhwb3J0ZXIgZm9yIFwiQ29udGVudCBvZiBib29raW5nIGZpZWxkcyBkYXRhXCIuIFByb2R1Y2VzIGUuZy46IFwiPGI+RGF0ZXM8L2I+OlxyXG5cdCAqIDxmPltkYXRlc108L2Y+PGJyPlwiXHJcblx0ICpcclxuXHQgKiBCb29raW5nIERhdGEgZXhwb3J0ZXIgY2FsbGJhY2sgKFwiQ29udGVudCBvZiBib29raW5nIGZpZWxkcyBkYXRhXCIpLiAgRGVmYXVsdCBvdXRwdXQ6IDxiPkxhYmVsPC9iPjpcclxuXHQgKiA8Zj5bZmllbGRfbmFtZV08L2Y+PGJyPlxyXG5cdCAqXHJcblx0ICogUmVnaXN0ZXJlZCBwZXIgZmllbGQgdHlwZSB2aWE6XHJcblx0ICogICBXUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIucmVnaXN0ZXIoICdzaG9ydGNvZGVfbmFtZScsIGNhbGxiYWNrIClcclxuXHQgKlxyXG5cdCAqIENvcmUgY2FsbCBzaXRlIChidWlsZGVyLWV4cG9ydGVyLmpzKTpcclxuXHQgKiAgIFdQQkNfQkZCX0NvbnRlbnRFeHBvcnRlci5ydW5fcmVnaXN0ZXJlZF9leHBvcnRlciggZmllbGQsIGVtaXQsIHsgY2ZnLCBjb3JlIH0gKTtcclxuXHQgKlxyXG5cdCAqIEBjYWxsYmFjayBXUEJDX0JGQl9Db250ZW50RXhwb3J0ZXJDYWxsYmFja1xyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgZmllbGRcclxuXHQgKiAgIE5vcm1hbGl6ZWQgZmllbGQgZGF0YSAoc2FtZSBzaGFwZSBhcyBpbiB0aGUgbWFpbiBleHBvcnRlcikuXHJcblx0ICogICBJbXBvcnRhbnQgcHJvcGVydGllcyBmb3IgY29udGVudCB0ZW1wbGF0ZXM6XHJcblx0ICogICAtIGZpZWxkLnR5cGUgICAgICB7c3RyaW5nfSAgRmllbGQgdHlwZSwgZS5nLiBcInRleHRcIi5cclxuXHQgKiAgIC0gZmllbGQubmFtZSAgICAgIHtzdHJpbmd9ICBGaWVsZCBuYW1lIHVzZWQgYXMgcGxhY2Vob2xkZXIgdG9rZW4uXHJcblx0ICogICAtIGZpZWxkLmxhYmVsICAgICB7c3RyaW5nfSAgSHVtYW4tcmVhZGFibGUgbGFiZWwgKG1heSBiZSBlbXB0eSkuXHJcblx0ICogICAtIGZpZWxkLm9wdGlvbnMgICB7QXJyYXl9ICAgRm9yIG9wdGlvbi1iYXNlZCBmaWVsZHMgKHNlbGVjdCwgY2hlY2tib3gsIHJhZGlvLCBldGMuKS5cclxuXHQgKiAgIC0gT3RoZXIgcGFjay1zcGVjaWZpYyBwcm9wcyBpZiBuZWVkZWQuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge2Z1bmN0aW9uKHN0cmluZyk6dm9pZH0gZW1pdFxyXG5cdCAqICAgRW1pdHMgYSByYXcgSFRNTCBmcmFnbWVudCBpbnRvIHRoZSBcIkNvbnRlbnQgb2YgYm9va2luZyBmaWVsZHMgZGF0YVwiIHRlbXBsYXRlLlxyXG5cdCAqICAgQ29yZSB3aWxsIHdyYXAgZXZlcnl0aGluZyBvbmNlIGludG86XHJcblx0ICogICAgIDxkaXYgY2xhc3M9XCJzdGFuZGFyZC1jb250ZW50LWZvcm1cIj5cclxuXHQgKiAgICAgICAuLi4gZW1pdHRlZCBmcmFnbWVudHMgLi4uXHJcblx0ICogICAgIDwvZGl2PlxyXG5cdCAqXHJcblx0ICogICBUeXBpY2FsIHVzYWdlIHBhdHRlcm46XHJcblx0ICogICAgIGVtaXQoJzxiPkxhYmVsPC9iPjogPGY+W2ZpZWxkX25hbWVdPC9mPjxicj4nKTtcclxuXHQgKlxyXG5cdCAqICAgSW4gbW9zdCBjYXNlcywgcGFja3MgY2FsbCB0aGUgc2hhcmVkIGhlbHBlcjpcclxuXHQgKiAgICAgV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyLmVtaXRfbGluZV9ib2xkX2ZpZWxkKGVtaXQsIGxhYmVsLCB0b2tlbiwgY2ZnKTtcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBbZXh0cmFzXVxyXG5cdCAqICAgQWRkaXRpb25hbCBjb250ZXh0IHBhc3NlZCBmcm9tIHJ1bl9yZWdpc3RlcmVkX2V4cG9ydGVyKCkuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge09iamVjdH0gW2V4dHJhcy5jZmddXHJcblx0ICogICBDb250ZW50IGV4cG9ydGVyIGNvbmZpZ3VyYXRpb246XHJcblx0ICogICAtIGV4dHJhcy5jZmcuYWRkTGFiZWxzIHtib29sZWFufSBEZWZhdWx0OiB0cnVlLlxyXG5cdCAqICAgICAgIElmIGZhbHNlLCBoZWxwZXIgbWF5IG9taXQgdGhlIGJvbGQgbGFiZWwgcGFydC5cclxuXHQgKiAgIC0gZXh0cmFzLmNmZy5zZXAgICAgICAge3N0cmluZ30gIExhYmVsIHNlcGFyYXRvciwgZGVmYXVsdCBcIjogXCIuXHJcblx0ICogICAgICAgRXhhbXBsZTogXCI8Yj5MYWJlbDwvYj46IFwiIHZzIFwiPGI+TGFiZWw8L2I+IOKAkyBcIi5cclxuXHQgKiAgIC0gZXh0cmFzLmNmZy5uZXdsaW5lICAge3N0cmluZ30gIE5ld2xpbmUgc2VwYXJhdG9yIHdoZW4gam9pbmluZyBsaW5lcyAodXN1YWxseSBcIlxcblwiKS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBbZXh0cmFzLmNvcmVdXHJcblx0ICogICBSZWZlcmVuY2UgdG8gV1BCQ19CRkJfQ29yZSAoc2FtZSBhcyBpbiBtYWluIGV4cG9ydGVyKS5cclxuXHQgKiAgIFVzdWFsbHkgbm90IG5lZWRlZCBoZXJlLCBiZWNhdXNlOlxyXG5cdCAqICAgLSBTYW5pdGl6YXRpb24gYW5kIGNvbnNpc3RlbnQgcmVuZGVyaW5nIGFyZSBhbHJlYWR5IGRvbmUgdmlhXHJcblx0ICogICAgIFdQQkNfQkZCX0NvbnRlbnRFeHBvcnRlci5lbWl0X2xpbmVfYm9sZF9maWVsZCggLi4uICkuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gZXhwb3J0X3Nob3J0Y29kZV9pbl9ib29raW5nX2RhdGEoKSB7XHJcblxyXG5cdFx0dmFyIEMgPSB3LldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlcjtcclxuXHRcdGlmICggISBDIHx8IHR5cGVvZiBDLnJlZ2lzdGVyICE9PSAnZnVuY3Rpb24nICkgeyByZXR1cm4gZmFsc2U7IH1cclxuXHRcdGlmICggdHlwZW9mIEMuaGFzX2V4cG9ydGVyID09PSAnZnVuY3Rpb24nICYmIEMuaGFzX2V4cG9ydGVyKCAnY2FsZW5kYXInICkgKSB7IHJldHVybiB0cnVlOyB9XHJcblxyXG5cdFx0Qy5yZWdpc3RlciggJ2NhbGVuZGFyJywgZnVuY3Rpb24gKCBmaWVsZCwgZW1pdCwgZXh0cmFzICkge1xyXG5cclxuXHRcdFx0ZXh0cmFzICAgID0gZXh0cmFzIHx8IHt9O1xyXG5cdFx0XHR2YXIgY2ZnICAgPSBleHRyYXMuY2ZnIHx8IHt9O1xyXG5cdFx0XHR2YXIgbGFiZWwgPSAodHlwZW9mIGZpZWxkLmxhYmVsID09PSAnc3RyaW5nJyAmJiBmaWVsZC5sYWJlbC50cmltKCkpID8gZmllbGQubGFiZWwudHJpbSgpIDogJ0RhdGVzJztcclxuXHJcblx0XHRcdC8vIFJldXNlIHNoYXJlZCBmb3JtYXR0ZXIgZnJvbSBidWlsZGVyLWV4cG9ydGVyIC0gZS5nLjogZW1pdF9saW5lX2JvbGRfZmllbGQoZW1pdCwgbGFiZWwsIHRva2VuLCBjZmcpIC0+ICBlbWl0KGA8Yj4ke1MuZXNjYXBlX2h0bWwobGFiZWwpfTwvYj4ke3NlcH08Zj5bJHt0b2tlbn1dPC9mPjxicj5gKTsgLlxyXG5cdFx0XHQvLyBDLmVtaXRfbGluZV9ib2xkX2ZpZWxkKCBlbWl0LCBsYWJlbCwgJ2RhdGVzJywgY2ZnICk7XHJcblxyXG5cdFx0XHRpZigwKSB7XHJcblx0XHRcdFx0Ly8gRGVmZW5zaXZlIGZhbGxiYWNrOiBrZWVwIGEgc2ltcGxlLCBiYWNrd2FyZC1jb21wYXRpYmxlIG91dHB1dC4gSnVzdCBmb3IgaGVscCAgaW4gdXNpbmcgaW4gb3RoZXIgZmllbGQgcGFja3MuXHJcblx0XHRcdFx0dmFyIGNvcmVfbG9jYWwgPSBleHRyYXMuY29yZSB8fCBDb3JlIHx8IHt9O1xyXG5cdFx0XHRcdHZhciBTX2xvY2FsICAgID0gY29yZV9sb2NhbC5XUEJDX0JGQl9TYW5pdGl6ZSB8fCB7fTtcclxuXHRcdFx0XHR2YXIgZXNjICAgICAgICA9IFNfbG9jYWwuZXNjYXBlX2h0bWwgfHwgZnVuY3Rpb24gKHMpIHsgcmV0dXJuIFN0cmluZyggcyApOyB9O1xyXG5cclxuXHRcdFx0XHR2YXIgc2VwICAgPSAoY2ZnICYmIHR5cGVvZiBjZmcuc2VwID09PSAnc3RyaW5nJykgPyBjZmcuc2VwIDogJzogJztcclxuXHRcdFx0XHR2YXIgdGl0bGUgPSBsYWJlbCA/ICc8Yj4nICsgZXNjKCBsYWJlbCApICsgJzwvYj4nICsgc2VwIDogJyc7XHJcblx0XHRcdFx0ZW1pdCggdGl0bGUgKyAnPGY+W2RhdGVzXTwvZj48YnI+JyApO1xyXG5cdFx0XHR9XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fVxyXG5cclxuXHRpZiAoICEgZXhwb3J0X3Nob3J0Y29kZV9pbl9ib29raW5nX2RhdGEoKSApIHtcclxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOmJmYjpjb250ZW50LWV4cG9ydGVyLXJlYWR5JywgZXhwb3J0X3Nob3J0Y29kZV9pbl9ib29raW5nX2RhdGEsIHsgb25jZTogdHJ1ZSB9ICk7XHJcblx0fVxyXG5cclxufSkoIHdpbmRvdyApO1xyXG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUMsVUFBVUEsQ0FBQyxFQUFFO0VBQ2IsWUFBWTs7RUFFWjtFQUNBLE1BQU1DLEdBQUcsR0FBSUQsQ0FBQyxDQUFDRSxLQUFLLElBQUlGLENBQUMsQ0FBQ0UsS0FBSyxDQUFDRCxHQUFHLEdBQUlELENBQUMsQ0FBQ0UsS0FBSyxDQUFDRCxHQUFHLEdBQUc7SUFBRUUsR0FBR0EsQ0FBQSxFQUFFLENBQUMsQ0FBQztJQUFFQyxLQUFLQSxDQUFBLEVBQUUsQ0FBQztFQUFFLENBQUM7O0VBRTNFO0VBQ0EsSUFBSUMsSUFBSSxHQUFTTCxDQUFDLENBQUNNLGFBQWEsSUFBSSxDQUFDLENBQUM7RUFDdEMsSUFBSUMsUUFBUSxHQUFLRixJQUFJLENBQUNHLGdDQUFnQztFQUN0RCxJQUFJQyxVQUFVLEdBQUdK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
