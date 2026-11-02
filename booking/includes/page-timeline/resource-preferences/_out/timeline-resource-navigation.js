"use strict";

/**
 * Timeline booking Resource selector and Resource-page navigation.
 *
 * The server remains authoritative for authorization, selection persistence,
 * group-safe pagination, and signed window replacement. This focused module
 * owns only selector drafts, feedback, focus, and stale-safe browser requests.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
(function (window, document, wp) {
  'use strict';

  var module_id = 'resource_navigation';
  var all_mode = 'all';
  var explicit_mode = 'explicit';
  var selector_instance_id = 'wpbc-timeline-resource-selector';
  var default_sort_order = 'standard';
  var allowed_sort_orders = ['standard', 'title_asc', 'title_desc', 'id_asc', 'id_desc'];

  /**
   * Replace one bounded set of named placeholders in translated text.
   *
   * @param {string} text   Translated source text.
   * @param {Object} values Placeholder values keyed without braces.
   * @return {string} Interpolated plain text.
   */
  function interpolate(text, values) {
    Object.keys(values || {}).forEach(function (key) {
      text = String(text || '').replace(new RegExp('\\{' + key + '\\}', 'g'), String(values[key]));
    });
    return String(text || '');
  }

  /**
   * Normalize one positive integer using a bounded fallback.
   *
   * @param {*}      candidate Candidate value.
   * @param {number} fallback  Positive fallback.
   * @return {number} Positive integer.
   */
  function positive_integer(candidate, fallback) {
    candidate = Number(candidate);
    return Number.isInteger(candidate) && 0 < candidate ? candidate : fallback;
  }

  /**
   * Normalize the server-owned page-size choices and retain a compatible
   * previously stored size that predates the visible option list.
   *
   * @param {Array}  candidates        Server-owned visible choices.
   * @param {number} current_page_size Current persisted page size.
   * @param {number} maximum_page_size Server maximum.
   * @return {number[]} Ordered unique page-size choices.
   */
  function normalize_page_size_options(candidates, current_page_size, maximum_page_size) {
    var page_sizes = [];
    maximum_page_size = positive_integer(maximum_page_size, 50);
    (Array.isArray(candidates) ? candidates : []).forEach(function (candidate) {
      candidate = positive_integer(candidate, 0);
      if (candidate && candidate <= maximum_page_size && -1 === page_sizes.indexOf(candidate)) {
        page_sizes.push(candidate);
      }
    });
    current_page_size = positive_integer(current_page_size, 0);
    if (current_page_size && current_page_size <= maximum_page_size && -1 === page_sizes.indexOf(current_page_size)) {
      page_sizes.push(current_page_size);
    }
    page_sizes.sort(function (first_page_size, second_page_size) {
      return first_page_size - second_page_size;
    });
    return page_sizes;
  }

  /**
   * Normalize one server or draft Resource sort value.
   *
   * @param {*} candidate Candidate Resource sort value.
   * @return {string} Allow-listed Resource sort value.
   */
  function normalize_sort_order(candidate) {
    candidate = String(candidate || '');
    return -1 !== allowed_sort_orders.indexOf(candidate) ? candidate : default_sort_order;
  }

  /**
   * Normalize one server Resource-view record for browser drafts.
   *
   * @param {Object} candidate Candidate server record.
   * @param {number} fallback_page_size Default page size.
   * @return {Object} Canonical browser view.
   */
  function normalize_resource_view(candidate, fallback_page_size) {
    var selected_ids = Object.create(null);
    var selection_mode;
    candidate = candidate && 'object' === typeof candidate ? candidate : {};
    selection_mode = explicit_mode === candidate.selection_mode ? explicit_mode : all_mode;
    if (explicit_mode === selection_mode && Array.isArray(candidate.selected_resource_ids)) {
      candidate.selected_resource_ids.forEach(function (resource_id) {
        resource_id = positive_integer(resource_id, 0);
        if (resource_id) {
          selected_ids[resource_id] = true;
        }
      });
    }
    return {
      selection_mode: selection_mode,
      selected_ids: selected_ids,
      sort_order: normalize_sort_order(candidate.sort_order),
      page: positive_integer(candidate.page, 1),
      per_page: positive_integer(candidate.per_page, fallback_page_size),
      expanded_resource_ids: Array.isArray(candidate.expanded_resource_ids) ? candidate.expanded_resource_ids.slice() : [],
      expanded_parent_ids: Array.isArray(candidate.expanded_parent_ids) ? candidate.expanded_parent_ids.slice() : []
    };
  }

  /**
   * Clone a normalized Resource view without sharing draft collections.
   *
   * @param {Object} resource_view Normalized Resource view.
   * @return {Object} Independent clone.
   */
  function clone_resource_view(resource_view) {
    var selected_ids = Object.create(null);
    Object.keys(resource_view.selected_ids || {}).forEach(function (resource_id) {
      selected_ids[resource_id] = true;
    });
    return {
      selection_mode: resource_view.selection_mode,
      selected_ids: selected_ids,
      sort_order: normalize_sort_order(resource_view.sort_order),
      page: resource_view.page,
      per_page: resource_view.per_page,
      expanded_resource_ids: resource_view.expanded_resource_ids.slice(),
      expanded_parent_ids: resource_view.expanded_parent_ids.slice()
    };
  }

  /**
   * Convert a browser view into the complete save DTO.
   *
   * @param {Object} resource_view Normalized Resource view.
   * @param {number} requested_page Requested Resource page.
   * @return {Object} Complete Resource-view save request fields.
   */
  function build_save_dto(resource_view, requested_page) {
    return {
      selection_mode: resource_view.selection_mode,
      selected_resource_ids: explicit_mode === resource_view.selection_mode ? Object.keys(resource_view.selected_ids).map(Number) : [],
      sort_order: normalize_sort_order(resource_view.sort_order),
      page: positive_integer(requested_page, 1),
      per_page: resource_view.per_page,
      expanded_resource_ids: resource_view.expanded_resource_ids.slice(),
      expanded_parent_ids: resource_view.expanded_parent_ids.slice()
    };
  }

  /**
   * Extract one safe server error message from a jQuery AJAX result.
   *
   * @param {Object} response Optional JSON response.
   * @param {Object} request  Optional failed XMLHttpRequest.
   * @param {string} fallback Safe translated fallback.
   * @return {string} User-facing plain text.
   */
  function get_error_message(response, request, fallback) {
    if (response && response.data && response.data.message) {
      return String(response.data.message);
    }
    if (request && request.responseJSON && request.responseJSON.data && request.responseJSON.data.message) {
      return String(request.responseJSON.data.message);
    }
    return fallback;
  }

  /**
   * Create one Resource navigation module instance.
   *
   * @param {Object} context Page-controller hosts, settings, feedback, and signed replacement boundary.
   * @return {Object} Focused lifecycle and refresh controller.
   */
  function create_resource_navigation(context) {
    var mount = context.mount || null;
    var settings = context.settings || {};
    var configuration = settings.resource_navigation || {};
    var i18n = configuration.i18n || {};
    var transport_root = settings.transport && 'object' === typeof settings.transport ? settings.transport : {};
    var transport = transport_root.resources && 'object' === typeof transport_root.resources ? transport_root.resources : {};
    var transport_url = transport_root.url ? String(transport_root.url) : '';
    var announce = 'function' === typeof context.announce ? context.announce : function () {};
    var show_admin_message = 'function' === typeof context.show_admin_message ? context.show_admin_message : function () {};
    var replace_resource_view = 'function' === typeof context.replace_resource_view ? context.replace_resource_view : function () {
      return null;
    };
    var selector_host = null;
    var main_pagination_host = null;
    var timeline_root = null;
    var resource_header = null;
    var resource_pane = null;
    var resource_pane_toggle_host = null;
    var resource_pane_toggle = null;
    var selector_root = null;
    var selector_panel = null;
    var selector_backdrop = null;
    var selector_rows = null;
    var selector_pagination_host = null;
    var selector_status = null;
    var selector_status_message = null;
    var selector_spinner = null;
    var validation = null;
    var validation_message = null;
    var apply_button = null;
    var search_input = null;
    var sort_select = null;
    var page_size_select = null;
    var committed_view = normalize_resource_view(settings.resource_view, configuration.default_selector_size || 20);
    var draft_view = clone_resource_view(committed_view);
    var page_size_options = normalize_page_size_options(configuration.page_size_options, committed_view.per_page, configuration.maximum_selector_size);
    var resource_pagination = settings.resource_pagination || {};
    var selector_page = null;
    var selector_request = null;
    var selector_generation = 0;
    var materialization_generation = 0;
    var materialization_requests = [];
    var search_timer = 0;
    var is_saving = false;
    var is_materializing = false;
    var is_initialized = false;
    var pending_page_focus = '';
    var mobile_drawer_media = null;
    var was_mobile_layout = null;
    var is_resource_pane_collapsed = false;
    var visual_viewport = window.visualViewport || null;

    /**
     * Return one server-allow-listed Resource navigation template.
     *
     * @param {string} template_key Domain template key.
     * @return {Function|null} WordPress template renderer or null.
     */
    function get_template(template_key) {
      var template_id = configuration.templates && configuration.templates[template_key];
      return template_id && wp && 'function' === typeof wp.template ? wp.template(template_id) : null;
    }

    /**
     * Render one Resource navigation template into an owned host.
     *
     * @param {HTMLElement} target Target host.
     * @param {string} template_key Domain template key.
     * @param {Object} view_model Authorized template model.
     * @return {boolean} True when rendered.
     */
    function render_template(target, template_key, view_model) {
      var template = get_template(template_key);
      if (!target || !template) {
        return false;
      }
      target.innerHTML = template(view_model || {});
      return true;
    }

    /**
     * Return the current draft selection count.
     *
     * All-mode intentionally returns the authorized root-page total used by the
     * server. The trigger says "All Resources" so Business Large child rows are
     * never misrepresented as independently paged units.
     *
     * @return {number} Explicit count or authorized pagination total.
     */
    function get_selected_count() {
      return all_mode === draft_view.selection_mode ? Math.max(0, Number(resource_pagination.total_items) || 0) : Object.keys(draft_view.selected_ids).length;
    }

    /**
     * Return the exact authorized IDs controlled by one selector row.
     *
     * Business Large parent rows receive their complete group scope from the
     * server DTO. Flat and child rows retain one-Resource selection semantics.
     *
     * @param {Object} resource Authorized selector Resource DTO.
     * @return {number[]} Positive unique Resource IDs.
     */
    function get_resource_selection_scope(resource) {
      var scope_ids = resource && resource.is_group_control && Array.isArray(resource.selection_scope_ids) ? resource.selection_scope_ids : [resource ? resource.id : 0];
      var normalized_ids = Object.create(null);
      scope_ids.forEach(function (resource_id) {
        resource_id = positive_integer(resource_id, 0);
        if (resource_id) {
          normalized_ids[resource_id] = true;
        }
      });
      return Object.keys(normalized_ids).map(Number);
    }

    /**
     * Calculate one row's checked, mixed, or unchecked draft state.
     *
     * @param {Object} resource Authorized selector Resource DTO.
     * @return {string} One of selected, mixed, or unselected.
     */
    function get_resource_selection_state(resource) {
      var scope_ids = get_resource_selection_scope(resource);
      var selected_count;
      if (all_mode === draft_view.selection_mode) {
        return 'selected';
      }
      selected_count = scope_ids.filter(function (resource_id) {
        return Boolean(draft_view.selected_ids[resource_id]);
      }).length;
      if (!selected_count) {
        return 'unselected';
      }
      return selected_count === scope_ids.length ? 'selected' : 'mixed';
    }

    /**
     * Synchronize visible native checkbox properties after a draft change.
     *
     * @return {void}
     */
    function synchronize_selector_checkboxes() {
      var resources = selector_page && Array.isArray(selector_page.resources) ? selector_page.resources : [];
      resources.forEach(function (resource) {
        var checkbox = selector_rows ? selector_rows.querySelector('[data-wpbc-timeline-resource-checkbox][value="' + resource.id + '"]') : null;
        var selection_state = get_resource_selection_state(resource);
        if (!checkbox) {
          return;
        }
        checkbox.checked = 'selected' === selection_state;
        checkbox.indeterminate = 'mixed' === selection_state;
      });
    }

    /**
     * Return the selector trigger label for the committed view.
     *
     * @return {string} Translated plain label.
     */
    function get_trigger_label() {
      return all_mode === committed_view.selection_mode ? i18n.all_resources : interpolate(i18n.resources_count, {
        count: Object.keys(committed_view.selected_ids).length
      });
    }

    /**
     * Merge current presentation-only expansion state into a save candidate.
     *
     * Row and hierarchy toggles update the shared settings object between window
     * reads. Reading it at submit time avoids overwriting a newer browser state
     * with the Resource view captured when this module last refreshed.
     *
     * @param {Object} resource_view Normalized selection and paging state.
     * @return {Object} Independent view with current expansion collections.
     */
    function with_current_expansion_state(resource_view) {
      var save_view = clone_resource_view(resource_view);
      var preferences = settings.preferences || {};
      save_view.expanded_resource_ids = Array.isArray(preferences.expanded_resource_ids) ? preferences.expanded_resource_ids.slice() : save_view.expanded_resource_ids;
      save_view.expanded_parent_ids = Array.isArray(preferences.expanded_parent_ids) ? preferences.expanded_parent_ids.slice() : save_view.expanded_parent_ids;
      return save_view;
    }

    /**
     * Update selection labels, validation, and Apply availability.
     *
     * @return {void}
     */
    function refresh_selection_feedback() {
      var count = get_selected_count();
      var count_host = selector_root ? selector_root.querySelector('[data-wpbc-timeline-resource-selected-count]') : null;
      var trigger_label = selector_root ? selector_root.querySelector('[data-wpbc-timeline-resource-selector-label]') : null;
      var is_empty = explicit_mode === draft_view.selection_mode && 0 === count;
      if (count_host) {
        count_host.textContent = interpolate(i18n.selected_count, {
          count: count
        });
      }
      if (trigger_label) {
        trigger_label.textContent = get_trigger_label();
      }
      if (validation) {
        validation.hidden = !is_empty;
      }
      if (validation_message && is_empty) {
        validation_message.textContent = i18n.minimum_one;
      }
      if (apply_button) {
        apply_button.disabled = is_saving || is_materializing || is_empty;
        apply_button.textContent = is_saving ? i18n.applying : i18n.apply;
      }
    }

    /**
     * Set the selector's non-destructive loading or error feedback.
     *
     * @param {string} message Plain text message.
     * @param {boolean} is_error Whether the message represents an error.
     * @return {void}
     */
    function set_selector_status(message, is_error) {
      var is_loading;
      if (!selector_status) {
        return;
      }
      is_loading = message === i18n.loading || message === i18n.applying;
      if (selector_status_message) {
        selector_status_message.textContent = message || '';
      }
      if (selector_spinner) {
        selector_spinner.hidden = !is_loading;
      }
      selector_status.classList.toggle('is-error', Boolean(is_error));
      selector_status.classList.toggle('is-loading', is_loading);
      selector_status.hidden = !message;
    }

    /**
     * Report a Resource-view failure through both local and page-level feedback.
     *
     * Main sidebar pagination can run while the selector is closed, so its
     * failure cannot rely on the selector status region alone. The page-owned
     * notice callback keeps transport and save failures visible without letting
     * this domain adapter construct administration notice markup.
     *
     * @param {string} message Plain translated error text.
     * @param {boolean} show_notice Whether to display the page-level notice.
     * @return {void}
     */
    function report_save_error(message, show_notice) {
      message = String(message || i18n.load_error || '');
      set_selector_status(message, true);
      announce(message);
      if (show_notice) {
        show_admin_message(message, 'error', 30000);
      }
    }

    /**
     * Update selector and main paging controls during save/readback.
     *
     * @param {boolean} busy Whether a Resource-view request owns the UI.
     * @return {void}
     */
    function set_save_busy(busy) {
      is_saving = Boolean(busy);
      if (selector_root) {
        selector_root.classList.toggle('is-saving', is_saving);
        Array.prototype.forEach.call(selector_root.querySelectorAll('input, select, button'), function (control) {
          if (!control.hasAttribute('data-wpbc-timeline-resource-apply')) {
            control.disabled = is_saving;
          }
        });
      }
      refresh_selection_feedback();
      if (!is_saving && selector_page) {
        render_selector_page(selector_page);
      }
      render_main_pagination();
    }

    /**
     * Build a normalized pagination template model.
     *
     * @param {Object} pagination Server pagination DTO.
     * @param {string} pagination_context Main or selector context.
     * @param {boolean} busy Whether navigation is locked.
     * @return {Object} Template-ready model.
     */
    function get_pagination_view_model(pagination, pagination_context, busy) {
      var page = positive_integer(pagination.page, 1);
      var total_pages = Math.max(0, Number(pagination.total_pages) || 0);
      return {
        context: pagination_context,
        navigation_label: 'selector' === pagination_context ? i18n.choose_resources : settings.i18n.resource_heading,
        page_status: interpolate(i18n.page_status, {
          page: page,
          pages: Math.max(1, total_pages)
        }),
        has_previous: Boolean(pagination.has_previous),
        has_next: Boolean(pagination.has_next),
        is_busy: Boolean(busy),
        i18n: i18n
      };
    }

    /**
     * Render the fixed Resource sidebar pagination.
     *
     * @return {void}
     */
    function render_main_pagination() {
      if (!main_pagination_host) {
        return;
      }
      render_template(main_pagination_host, 'pagination', get_pagination_view_model(resource_pagination, 'main', is_saving));
    }

    /**
     * Render one authorized selector page with the current cross-page draft.
     *
     * @param {Object} response Selector endpoint DTO.
     * @return {void}
     */
    function render_selector_page(response) {
      var row_template = get_template('selector_row');
      var row_buffer;
      selector_page = response || {};
      if (selector_rows) {
        selector_rows.textContent = '';
      }
      if (!selector_rows || !row_template) {
        return;
      }
      (Array.isArray(selector_page.resources) ? selector_page.resources : []).forEach(function (resource) {
        var row_view_model = Object.assign({}, resource);
        row_view_model.selection_state = get_resource_selection_state(resource);
        row_view_model.is_selected = 'selected' === row_view_model.selection_state;
        row_view_model.checkbox_label = interpolate(resource.is_group_control ? i18n.select_resource_group : i18n.select_resource, {
          title: resource.title
        });
        row_buffer = document.createElement('div');
        row_buffer.innerHTML = row_template(row_view_model);
        if (row_buffer.firstElementChild) {
          selector_rows.appendChild(row_buffer.firstElementChild);
        }
      });
      synchronize_selector_checkboxes();
      if (selector_pagination_host) {
        render_template(selector_pagination_host, 'pagination', get_pagination_view_model(selector_page.selector_pagination || {}, 'selector', is_saving || is_materializing));
      }
      if (!selector_page.resources || !selector_page.resources.length) {
        set_selector_status(i18n.empty, false);
      } else {
        set_selector_status('', false);
      }
      refresh_selection_feedback();
      if (pending_page_focus && selector_pagination_host) {
        (selector_pagination_host.querySelector('[data-wpbc-timeline-resource-page="' + pending_page_focus + '"]') || search_input).focus();
        pending_page_focus = '';
      }
    }

    /**
     * Request one independently paged selector result and reject stale responses.
     *
     * @param {number} page Requested selector page.
     * @param {string} search Validated server search candidate.
     * @return {Object|null} jQuery request or null when transport is unavailable.
     */
    function request_selector_page(page, search) {
      var generation;
      if (is_saving || is_materializing) {
        return null;
      }
      if (!window.jQuery || !transport_url || !transport.action || !transport.nonce) {
        set_selector_status(i18n.load_error, true);
        return null;
      }
      selector_generation += 1;
      generation = selector_generation;
      if (selector_request && 'function' === typeof selector_request.abort) {
        selector_request.abort();
      }
      set_selector_status(i18n.loading, false);
      selector_request = window.jQuery.ajax({
        url: transport_url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: transport.action,
          nonce: transport.nonce,
          page: positive_integer(page, 1),
          per_page: positive_integer(draft_view.per_page, configuration.default_selector_size || 20),
          search: String(search || ''),
          sort_order: normalize_sort_order(draft_view.sort_order)
        }
      }).done(function (response) {
        if (generation !== selector_generation) {
          return;
        }
        if (!response || !response.success || !response.data) {
          set_selector_status(get_error_message(response, null, i18n.load_error), true);
          return;
        }
        render_selector_page(response.data);
      }).fail(function (request, request_status) {
        if (generation !== selector_generation || 'abort' === request_status) {
          return;
        }
        set_selector_status(get_error_message(null, request, i18n.load_error), true);
      }).always(function () {
        if (generation === selector_generation) {
          selector_request = null;
        }
      });
      return selector_request;
    }

    /**
     * Materialize all authorized IDs only when all-mode loses one checkbox.
     *
     * The persisted contract intentionally has only `all` and `explicit`; it has
     * no exclusion mode. A dedicated IDs-only read therefore produces an exact
     * explicit draft without applying presentation-row or hierarchy budgets.
     *
     * @param {number[]} excluded_resource_ids Exact Resource IDs unchecked from all-mode.
     * @return {void}
     */
    function materialize_all_except(excluded_resource_ids) {
      var generation;
      var maximum_selected = positive_integer(configuration.maximum_selected, 500);
      var request;
      var excluded_lookup = Object.create(null);
      (Array.isArray(excluded_resource_ids) ? excluded_resource_ids : [excluded_resource_ids]).forEach(function (resource_id) {
        resource_id = positive_integer(resource_id, 0);
        if (resource_id) {
          excluded_lookup[resource_id] = true;
        }
      });
      if (!window.jQuery || !transport_url || !transport.selection_action || !transport.selection_nonce || is_materializing || is_saving) {
        set_selector_status(i18n.load_error, true);
        return;
      }
      materialization_generation += 1;
      generation = materialization_generation;
      is_materializing = true;
      if (selector_root) {
        Array.prototype.forEach.call(selector_root.querySelectorAll('input, select, button'), function (control) {
          control.disabled = true;
        });
      }
      set_selector_status(i18n.loading, false);
      refresh_selection_feedback();

      /**
       * Release the materialization lock and restore the visible draft page.
       *
       * @param {string} error_message Safe error or an empty success value.
       * @return {void}
       */
      function finish_materialization(error_message) {
        if (generation !== materialization_generation) {
          return;
        }
        is_materializing = false;
        materialization_requests = [];
        if (selector_root) {
          Array.prototype.forEach.call(selector_root.querySelectorAll('input, select, button'), function (control) {
            control.disabled = false;
          });
        }
        if (selector_page) {
          render_selector_page(selector_page);
        }
        if (error_message) {
          set_selector_status(error_message, true);
        }
        refresh_selection_feedback();
      }
      request = window.jQuery.ajax({
        url: transport_url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: transport.selection_action,
          nonce: transport.selection_nonce
        }
      }).done(function (response) {
        var collected_ids = Object.create(null);
        var selection = response && response.data && response.data.selection ? response.data.selection : {};
        if (generation !== materialization_generation) {
          return;
        }
        if (!response || !response.success || explicit_mode !== selection.mode || !Array.isArray(selection.resource_ids)) {
          finish_materialization(get_error_message(response, null, i18n.load_error));
          return;
        }
        selection.resource_ids.forEach(function (resource_id) {
          resource_id = positive_integer(resource_id, 0);
          if (resource_id) {
            collected_ids[resource_id] = true;
          }
        });
        if (Object.keys(collected_ids).length !== selection.resource_ids.length || Object.keys(collected_ids).length !== Number(selection.count)) {
          finish_materialization(i18n.load_error);
          return;
        }
        if (Object.keys(collected_ids).length > maximum_selected) {
          finish_materialization(i18n.maximum_selected_error);
          return;
        }
        Object.keys(excluded_lookup).forEach(function (resource_id) {
          delete collected_ids[resource_id];
        });
        if (!Object.keys(collected_ids).length) {
          finish_materialization(i18n.minimum_one);
          return;
        }
        draft_view.selection_mode = explicit_mode;
        draft_view.selected_ids = collected_ids;
        finish_materialization('');
      }).fail(function (failed_request, request_status) {
        if (generation === materialization_generation && 'abort' !== request_status) {
          finish_materialization(get_error_message(null, failed_request, i18n.load_error));
        }
      });
      materialization_requests.push(request);
    }

    /**
     * Send one complete Resource-view save and keep controls locked through readback.
     *
     * @param {Object} candidate Complete Resource-view save DTO.
     * @param {boolean} close_selector Whether successful readback closes the selector.
     * @return {Object|null} jQuery-compatible completion promise or null.
     */
    function save_resource_view(candidate, close_selector) {
      var completion;
      var request;
      if (is_saving) {
        return null;
      }
      if (!window.jQuery || !transport_url || !transport.save_action || !transport.view_nonce) {
        report_save_error(i18n.load_error, true);
        return null;
      }
      completion = window.jQuery.Deferred();
      set_save_busy(true);
      set_selector_status(i18n.applying, false);
      request = window.jQuery.ajax({
        url: transport_url,
        method: 'POST',
        dataType: 'json',
        data: Object.assign({}, candidate, {
          action: transport.save_action,
          nonce: transport.view_nonce
        })
      }).done(function (response) {
        var replacement;
        var error_message;
        if (!response || !response.success || !response.data || !response.data.resource_view_context) {
          error_message = get_error_message(response, null, i18n.load_error);
          report_save_error(error_message, true);
          completion.reject(false);
          return;
        }
        committed_view = normalize_resource_view(response.data.resource_view, configuration.default_selector_size || 20);
        draft_view = clone_resource_view(committed_view);
        resource_pagination = response.data.resource_pagination || {};
        settings.resource_view = response.data.resource_view;
        settings.resource_pagination = resource_pagination;
        replacement = replace_resource_view(response.data.resource_view_context);
        if (!replacement || 'function' !== typeof replacement.done) {
          report_save_error(i18n.load_error, true);
          completion.reject(false);
          return;
        }
        replacement.done(function () {
          announce(i18n.applied);
          if (close_selector && selector_root) {
            var close_button = selector_root.querySelector('[data-wpbc-shared-ui-popover-close]');
            if (close_button) {
              // The save lock disables Cancel, but a successful Apply must close through the shared lifecycle.
              close_button.disabled = false;
              close_button.click();
            }
          }
          completion.resolve(true);
        }).fail(function () {
          // The page controller already owns the visible window-read error notice.
          report_save_error(i18n.load_error, false);
          completion.reject(false);
        });
      }).fail(function (failed_request, request_status) {
        if ('abort' !== request_status) {
          report_save_error(get_error_message(null, failed_request, i18n.load_error), true);
        }
        completion.reject(false);
      });
      completion.always(function () {
        set_save_busy(false);
        render_main_pagination();
      });
      return completion.promise({
        abort: function () {
          if (request && 'function' === typeof request.abort) {
            request.abort();
          }
        }
      });
    }

    /**
     * Reset the selector draft when its disclosure opens.
     *
     * @return {void}
     */
    function open_selector() {
      draft_view = clone_resource_view(committed_view);
      if (sort_select) {
        sort_select.value = draft_view.sort_order;
      }
      if (page_size_select) {
        page_size_select.value = String(draft_view.per_page);
      }
      refresh_selection_feedback();
      request_selector_page(1, search_input ? search_input.value : '');
      window.setTimeout(function () {
        if (search_input) {
          search_input.focus();
        }
      }, 0);
    }

    /**
     * Raise or restore the Resource header stacking layer with the selector.
     *
     * The date-axis header is a sibling stacking context. Raising the owning
     * Resource header prevents its current-date marker from painting over the
     * domain popover without changing Timeline scroll or shared-layer rules.
     *
     * @param {boolean} is_open Whether the Resource selector is open.
     * @return {void}
     */
    function set_selector_layer_state(is_open) {
      if (resource_header) {
        resource_header.classList.toggle('has-open-resource-selector', Boolean(is_open));
      }
      if (selector_backdrop) {
        selector_backdrop.hidden = !is_open || !is_mobile_drawer();
      }
    }

    /**
     * Determine whether the responsive Resource selector is a modal drawer.
     *
     * @return {boolean} True at the WordPress administration mobile breakpoint.
     */
    function is_mobile_drawer() {
      return Boolean(mobile_drawer_media && mobile_drawer_media.matches);
    }

    /**
     * Set the mobile Resource-pane presentation without changing saved view data.
     *
     * Both the sticky Resource header and Resource rows inherit the same collapsed
     * width from the Timeline root. This preserves their alignment with the date
     * axis while the toggle remains keyboard and screen-reader accessible.
     *
     * @param {boolean} should_collapse Whether the mobile Resource pane should collapse.
     * @return {void}
     */
    function set_resource_pane_collapsed(should_collapse) {
      var next_collapsed = Boolean(should_collapse && is_mobile_drawer());
      var toggle_label = next_collapsed ? i18n.show_resource_panel : i18n.hide_resource_panel;
      var accessible_label;
      var focused_control = document.activeElement;
      var should_restore_toggle_focus = Boolean(next_collapsed && focused_control && (resource_pane && resource_pane.contains(focused_control) || selector_host && selector_host.contains(focused_control)));
      if (next_collapsed && selector_root && selector_root.classList.contains('is-open')) {
        accessible_label = selector_root.querySelector('[data-wpbc-timeline-resource-cancel]');
        if (accessible_label) {
          accessible_label.click();
        }
      }
      is_resource_pane_collapsed = next_collapsed;
      if (timeline_root) {
        timeline_root.classList.toggle('is-resource-pane-collapsed', next_collapsed);
      }
      if (resource_pane) {
        if (next_collapsed) {
          resource_pane.setAttribute('aria-hidden', 'true');
          resource_pane.setAttribute('inert', '');
        } else {
          resource_pane.removeAttribute('aria-hidden');
          resource_pane.removeAttribute('inert');
        }
      }
      if (!resource_pane_toggle) {
        return;
      }
      resource_pane_toggle.hidden = !is_mobile_drawer();
      resource_pane_toggle.setAttribute('aria-expanded', next_collapsed ? 'false' : 'true');
      resource_pane_toggle.setAttribute('aria-label', toggle_label);
      resource_pane_toggle.setAttribute('title', toggle_label);
      accessible_label = resource_pane_toggle.querySelector('[data-wpbc-timeline-resource-pane-toggle-label]');
      if (accessible_label) {
        accessible_label.textContent = toggle_label;
      }
      if (should_restore_toggle_focus) {
        window.setTimeout(function () {
          if (resource_pane_toggle && !resource_pane_toggle.hidden) {
            resource_pane_toggle.focus();
          }
        }, 0);
      }
    }

    /**
     * Keep the drawer inside the visual viewport when zoom or a software
     * keyboard reduces the usable layout viewport.
     *
     * @return {void}
     */
    function update_mobile_viewport_metrics() {
      var viewport_height;
      var viewport_offset_top;
      var viewport_bottom_inset;
      if (!selector_panel || !is_mobile_drawer()) {
        if (selector_panel) {
          selector_panel.style.removeProperty('--wpbc-timeline-resource-mobile-viewport-height');
          selector_panel.style.removeProperty('--wpbc-timeline-resource-mobile-bottom-inset');
        }
        return;
      }
      viewport_height = visual_viewport ? visual_viewport.height : window.innerHeight;
      viewport_offset_top = visual_viewport ? visual_viewport.offsetTop : 0;
      viewport_bottom_inset = Math.max(0, window.innerHeight - viewport_height - viewport_offset_top);
      selector_panel.style.setProperty('--wpbc-timeline-resource-mobile-viewport-height', Math.max(1, Math.floor(viewport_height)) + 'px');
      selector_panel.style.setProperty('--wpbc-timeline-resource-mobile-bottom-inset', Math.floor(viewport_bottom_inset) + 'px');
    }

    /**
     * Synchronize responsive semantics without replacing the shared popover
     * lifecycle that owns open, close, Escape, and trigger focus restoration.
     *
     * @return {void}
     */
    function synchronize_responsive_mode() {
      var drawer_enabled = is_mobile_drawer();
      var selector_is_open = Boolean(selector_root && selector_root.classList.contains('is-open'));
      var entered_mobile_layout = drawer_enabled && true !== was_mobile_layout;
      if (!selector_root || !selector_panel) {
        return;
      }
      selector_root.classList.toggle('is-mobile-drawer', drawer_enabled);
      selector_panel.setAttribute('aria-modal', drawer_enabled ? 'true' : 'false');
      selector_panel.setAttribute('data-wpbc-timeline-resource-layout', drawer_enabled ? 'drawer' : 'popover');
      if (selector_backdrop) {
        selector_backdrop.hidden = !drawer_enabled || !selector_is_open;
      }
      if (entered_mobile_layout) {
        set_resource_pane_collapsed(true);
      } else if (!drawer_enabled) {
        set_resource_pane_collapsed(false);
      } else {
        set_resource_pane_collapsed(is_resource_pane_collapsed);
      }
      was_mobile_layout = drawer_enabled;
      update_mobile_viewport_metrics();
    }

    /**
     * Return enabled controls that can participate in the modal drawer focus loop.
     *
     * @return {HTMLElement[]} Ordered focusable controls.
     */
    function get_drawer_focusable_controls() {
      if (!selector_panel) {
        return [];
      }
      return Array.prototype.filter.call(selector_panel.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'), function (control) {
        return !control.hidden && !control.closest('[hidden]') && 'true' !== control.getAttribute('aria-hidden');
      });
    }

    /**
     * Handle Resource selector and pagination actions through one listener.
     *
     * @param {MouseEvent} event Delegated click event.
     * @return {void}
     */
    function handle_click(event) {
      var pane_toggle = event.target.closest('[data-wpbc-timeline-resource-pane-toggle]');
      var select_all_button = event.target.closest('[data-wpbc-timeline-resource-select-all]');
      var clear_all_button = event.target.closest('[data-wpbc-timeline-resource-clear-all]');
      var apply_control = event.target.closest('[data-wpbc-timeline-resource-apply]');
      var page_control = event.target.closest('[data-wpbc-timeline-resource-page]');
      var pagination;
      var direction;
      var target_page;
      if (pane_toggle && is_mobile_drawer()) {
        set_resource_pane_collapsed(!is_resource_pane_collapsed);
        return;
      }
      if (select_all_button && !is_saving && !is_materializing) {
        draft_view.selection_mode = all_mode;
        draft_view.selected_ids = Object.create(null);
        if (selector_page) {
          render_selector_page(selector_page);
        }
        return;
      }
      if (clear_all_button && !is_saving && !is_materializing) {
        draft_view.selection_mode = explicit_mode;
        draft_view.selected_ids = Object.create(null);
        if (selector_page) {
          render_selector_page(selector_page);
        }
        return;
      }
      if (apply_control) {
        if (apply_control.disabled || explicit_mode === draft_view.selection_mode && !Object.keys(draft_view.selected_ids).length) {
          refresh_selection_feedback();
          return;
        }
        save_resource_view(build_save_dto(with_current_expansion_state(draft_view), 1), true);
        return;
      }
      if (!page_control || page_control.disabled || is_saving || is_materializing) {
        return;
      }
      direction = page_control.getAttribute('data-wpbc-timeline-resource-page');
      if ('selector' === page_control.getAttribute('data-wpbc-timeline-resource-page-context')) {
        pagination = selector_page && selector_page.selector_pagination ? selector_page.selector_pagination : {};
        target_page = positive_integer(pagination.page, 1) + ('next' === direction ? 1 : -1);
        pending_page_focus = direction;
        request_selector_page(target_page, search_input ? search_input.value : '');
        return;
      }
      pagination = resource_pagination || {};
      target_page = positive_integer(pagination.page, 1) + ('next' === direction ? 1 : -1);
      save_resource_view(build_save_dto(with_current_expansion_state(committed_view), target_page), false);
    }

    /**
     * Update a cross-page selector draft from a checkbox.
     *
     * @param {Event} event Delegated change event.
     * @return {void}
     */
    function handle_change(event) {
      var checkbox = event.target.closest('[data-wpbc-timeline-resource-checkbox]');
      var sort_control = event.target.closest('[data-wpbc-timeline-resource-sort]');
      var page_size_control = event.target.closest('[data-wpbc-timeline-resource-page-size]');
      var requested_page_size;
      var resource_id;
      var resource;
      var selection_scope_ids;
      if (is_saving || is_materializing) {
        return;
      }
      if (sort_control) {
        draft_view.sort_order = normalize_sort_order(sort_control.value);
        pending_page_focus = '';
        request_selector_page(1, search_input ? search_input.value : '');
        return;
      }
      if (page_size_control) {
        requested_page_size = positive_integer(page_size_control.value, 0);
        if (-1 === page_size_options.indexOf(requested_page_size)) {
          page_size_control.value = String(draft_view.per_page);
          return;
        }
        draft_view.per_page = requested_page_size;
        pending_page_focus = '';
        request_selector_page(1, search_input ? search_input.value : '');
        return;
      }
      if (!checkbox) {
        return;
      }
      resource_id = positive_integer(checkbox.value, 0);
      if (!resource_id) {
        return;
      }
      resource = (selector_page && Array.isArray(selector_page.resources) ? selector_page.resources : []).filter(function (candidate) {
        return resource_id === positive_integer(candidate.id, 0);
      })[0];
      if (!resource) {
        // Retain the exact-row fallback for compatibility with pre-v2 cached selector markup.
        resource = {
          id: resource_id,
          is_group_control: false,
          selection_scope_ids: [resource_id]
        };
      }
      selection_scope_ids = get_resource_selection_scope(resource);
      if (all_mode === draft_view.selection_mode && !checkbox.checked) {
        checkbox.checked = true;
        checkbox.indeterminate = false;
        materialize_all_except(selection_scope_ids);
        return;
      }
      draft_view.selection_mode = explicit_mode;
      selection_scope_ids.forEach(function (selected_resource_id) {
        if (checkbox.checked) {
          draft_view.selected_ids[selected_resource_id] = true;
        } else {
          delete draft_view.selected_ids[selected_resource_id];
        }
      });
      synchronize_selector_checkboxes();
      refresh_selection_feedback();
    }

    /**
     * Debounce selector search without changing the cross-page draft.
     *
     * @param {InputEvent} event Delegated input event.
     * @return {void}
     */
    function handle_input(event) {
      if (!event.target.matches('[data-wpbc-timeline-resource-search]')) {
        return;
      }
      window.clearTimeout(search_timer);
      search_timer = window.setTimeout(function () {
        request_selector_page(1, event.target.value);
      }, Math.max(0, Number(configuration.search_delay_ms) || 250));
    }

    /**
     * Support direct search submission and predictable list entry by keyboard.
     *
     * @param {KeyboardEvent} event Delegated key event.
     * @return {void}
     */
    function handle_keydown(event) {
      var first_checkbox;
      var focusable_controls;
      var first_control;
      var last_control;
      if ('Tab' === event.key && is_mobile_drawer() && selector_root && selector_root.classList.contains('is-open')) {
        focusable_controls = get_drawer_focusable_controls();
        first_control = focusable_controls[0];
        last_control = focusable_controls[focusable_controls.length - 1];
        if (first_control && last_control && event.shiftKey && document.activeElement === first_control) {
          event.preventDefault();
          last_control.focus();
          return;
        }
        if (first_control && last_control && !event.shiftKey && document.activeElement === last_control) {
          event.preventDefault();
          first_control.focus();
          return;
        }
      }
      if (event.target.matches('[data-wpbc-timeline-resource-search]') && 'Enter' === event.key) {
        event.preventDefault();
        window.clearTimeout(search_timer);
        request_selector_page(1, event.target.value);
        return;
      }
      if (event.target.matches('[data-wpbc-timeline-resource-search]') && 'ArrowDown' === event.key) {
        first_checkbox = selector_rows ? selector_rows.querySelector('[data-wpbc-timeline-resource-checkbox]') : null;
        if (first_checkbox) {
          event.preventDefault();
          first_checkbox.focus();
        }
        return;
      }
      if (event.target.matches('[data-wpbc-timeline-resource-checkbox]') && 'ArrowUp' === event.key && selector_rows && event.target === selector_rows.querySelector('[data-wpbc-timeline-resource-checkbox]') && search_input) {
        event.preventDefault();
        search_input.focus();
      }
    }

    /**
     * Focus the selector search after the shared disclosure opens.
     *
     * @param {CustomEvent} event Shared UI layer lifecycle event.
     * @return {void}
     */
    function handle_layer_open(event) {
      if (event.detail && selector_instance_id === event.detail.instance_id) {
        synchronize_responsive_mode();
        set_selector_layer_state(true);
        open_selector();
      }
    }

    /**
     * Cancel selector-only reads when the disclosure closes.
     *
     * Save/readback remains owned by its independent request so closing with
     * Escape cannot interrupt a preference that the server may have committed.
     *
     * @param {CustomEvent} event Shared UI layer lifecycle event.
     * @return {void}
     */
    function handle_layer_close(event) {
      if (!event.detail || selector_instance_id !== event.detail.instance_id) {
        return;
      }
      set_selector_layer_state(false);
      selector_generation += 1;
      materialization_generation += 1;
      window.clearTimeout(search_timer);
      if (selector_request && 'function' === typeof selector_request.abort) {
        selector_request.abort();
      }
      selector_request = null;
      materialization_requests.forEach(function (request) {
        if (request && 'function' === typeof request.abort) {
          request.abort();
        }
      });
      materialization_requests = [];
      is_materializing = false;
      draft_view = clone_resource_view(committed_view);
    }

    /**
     * Refresh canonical view and pagination after a server window commit.
     *
     * @param {Object} resource_view Server Resource-view DTO.
     * @param {Object} pagination Server Resource pagination DTO.
     * @return {void}
     */
    function refresh(resource_view, pagination) {
      committed_view = normalize_resource_view(resource_view, configuration.default_selector_size || 20);
      draft_view = clone_resource_view(committed_view);
      page_size_options = normalize_page_size_options(configuration.page_size_options, committed_view.per_page, configuration.maximum_selector_size);
      resource_pagination = pagination && 'object' === typeof pagination ? pagination : {};
      settings.resource_view = resource_view;
      settings.resource_pagination = resource_pagination;
      if (page_size_select) {
        page_size_select.value = String(committed_view.per_page);
      }
      refresh_selection_feedback();
      render_main_pagination();
    }

    /**
     * Render the selector shell and attach delegated module listeners.
     *
     * @return {void}
     */
    function initialize() {
      if (!mount || is_initialized) {
        return;
      }
      selector_host = mount.querySelector('[data-wpbc-timeline-resource-selector-host]');
      main_pagination_host = mount.querySelector('[data-wpbc-timeline-resource-main-pagination]');
      timeline_root = mount.matches && mount.matches('.wpbc_timeline') ? mount : mount.querySelector('.wpbc_timeline');
      resource_pane = mount.querySelector('[data-wpbc-timeline-resource-pane]');
      resource_pane_toggle_host = mount.querySelector('[data-wpbc-timeline-resource-pane-toggle-host]');
      if (resource_pane_toggle_host) {
        render_template(resource_pane_toggle_host, 'pane_toggle', {
          show_label: i18n.show_resource_panel,
          hide_label: i18n.hide_resource_panel
        });
        resource_pane_toggle = resource_pane_toggle_host.querySelector('[data-wpbc-timeline-resource-pane-toggle]');
      }
      if (!selector_host || !render_template(selector_host, 'selector', {
        trigger_label: get_trigger_label(),
        selected_label: interpolate(i18n.selected_count, {
          count: get_selected_count()
        }),
        sort_order: committed_view.sort_order,
        sort_options: Array.isArray(configuration.sort_options) ? configuration.sort_options : [],
        per_page: committed_view.per_page,
        page_size_options: page_size_options,
        i18n: i18n
      })) {
        return;
      }
      selector_root = selector_host.querySelector('[data-wpbc-shared-ui-popover]');
      selector_panel = selector_host.querySelector('[data-wpbc-timeline-resource-selector-panel]');
      selector_backdrop = selector_host.querySelector('[data-wpbc-timeline-resource-drawer-backdrop]');
      resource_header = selector_root && selector_root.closest ? selector_root.closest('.wpbc_timeline__resource_header') : null;
      selector_rows = selector_host.querySelector('[data-wpbc-timeline-resource-selector-rows]');
      selector_pagination_host = selector_host.querySelector('[data-wpbc-timeline-resource-selector-pagination]');
      selector_status = selector_host.querySelector('[data-wpbc-timeline-resource-selector-status]');
      selector_status_message = selector_host.querySelector('[data-wpbc-timeline-resource-selector-status-message]');
      selector_spinner = selector_host.querySelector('[data-wpbc-timeline-resource-selector-spinner]');
      validation = selector_host.querySelector('[data-wpbc-timeline-resource-validation]');
      validation_message = selector_host.querySelector('[data-wpbc-timeline-resource-validation-message]');
      apply_button = selector_host.querySelector('[data-wpbc-timeline-resource-apply]');
      search_input = selector_host.querySelector('[data-wpbc-timeline-resource-search]');
      sort_select = selector_host.querySelector('[data-wpbc-timeline-resource-sort]');
      page_size_select = selector_host.querySelector('[data-wpbc-timeline-resource-page-size]');
      mobile_drawer_media = window.matchMedia ? window.matchMedia('(max-width: 782px)') : null;
      mount.addEventListener('click', handle_click);
      mount.addEventListener('change', handle_change);
      mount.addEventListener('input', handle_input);
      mount.addEventListener('keydown', handle_keydown);
      document.addEventListener('wpbc:shared-ui-layer-open', handle_layer_open);
      document.addEventListener('wpbc:shared-ui-layer-close', handle_layer_close);
      window.addEventListener('resize', update_mobile_viewport_metrics);
      if (mobile_drawer_media) {
        if ('function' === typeof mobile_drawer_media.addEventListener) {
          mobile_drawer_media.addEventListener('change', synchronize_responsive_mode);
        } else if ('function' === typeof mobile_drawer_media.addListener) {
          mobile_drawer_media.addListener(synchronize_responsive_mode);
        }
      }
      if (visual_viewport && 'function' === typeof visual_viewport.addEventListener) {
        visual_viewport.addEventListener('resize', update_mobile_viewport_metrics);
        visual_viewport.addEventListener('scroll', update_mobile_viewport_metrics);
      }
      is_initialized = true;
      synchronize_responsive_mode();
      refresh_selection_feedback();
      render_main_pagination();
    }

    /**
     * Abort requests, timers, and listeners owned by this module.
     *
     * @return {void}
     */
    function destroy() {
      if (!is_initialized) {
        return;
      }
      selector_generation += 1;
      materialization_generation += 1;
      window.clearTimeout(search_timer);
      set_selector_layer_state(false);
      if (selector_request && 'function' === typeof selector_request.abort) {
        selector_request.abort();
      }
      materialization_requests.forEach(function (request) {
        if (request && 'function' === typeof request.abort) {
          request.abort();
        }
      });
      mount.removeEventListener('click', handle_click);
      mount.removeEventListener('change', handle_change);
      mount.removeEventListener('input', handle_input);
      mount.removeEventListener('keydown', handle_keydown);
      document.removeEventListener('wpbc:shared-ui-layer-open', handle_layer_open);
      document.removeEventListener('wpbc:shared-ui-layer-close', handle_layer_close);
      window.removeEventListener('resize', update_mobile_viewport_metrics);
      if (mobile_drawer_media) {
        if ('function' === typeof mobile_drawer_media.removeEventListener) {
          mobile_drawer_media.removeEventListener('change', synchronize_responsive_mode);
        } else if ('function' === typeof mobile_drawer_media.removeListener) {
          mobile_drawer_media.removeListener(synchronize_responsive_mode);
        }
      }
      if (visual_viewport && 'function' === typeof visual_viewport.removeEventListener) {
        visual_viewport.removeEventListener('resize', update_mobile_viewport_metrics);
        visual_viewport.removeEventListener('scroll', update_mobile_viewport_metrics);
      }
      if (selector_panel) {
        selector_panel.style.removeProperty('--wpbc-timeline-resource-mobile-viewport-height');
        selector_panel.style.removeProperty('--wpbc-timeline-resource-mobile-bottom-inset');
        selector_panel.setAttribute('aria-modal', 'false');
        selector_panel.setAttribute('data-wpbc-timeline-resource-layout', 'popover');
      }
      if (selector_root) {
        selector_root.classList.remove('is-mobile-drawer');
      }
      if (selector_backdrop) {
        selector_backdrop.hidden = true;
      }
      if (timeline_root) {
        timeline_root.classList.remove('is-resource-pane-collapsed');
      }
      if (resource_pane) {
        resource_pane.removeAttribute('aria-hidden');
        resource_pane.removeAttribute('inert');
      }
      if (resource_pane_toggle) {
        resource_pane_toggle.hidden = true;
        resource_pane_toggle.setAttribute('aria-expanded', 'true');
      }
      was_mobile_layout = null;
      is_resource_pane_collapsed = false;
      is_initialized = false;
    }
    return {
      initialize: initialize,
      refresh: refresh,
      destroy: destroy
    };
  }
  if (window.wpbc_timeline_modules && 'function' === typeof window.wpbc_timeline_modules.register_factory) {
    window.wpbc_timeline_modules.register_factory(module_id, create_resource_navigation);
  }
})(window, document, window.wp);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS10aW1lbGluZS9yZXNvdXJjZS1wcmVmZXJlbmNlcy9fb3V0L3RpbWVsaW5lLXJlc291cmNlLW5hdmlnYXRpb24uanMiLCJuYW1lcyI6WyJ3aW5kb3ciLCJkb2N1bWVudCIsIndwIiwibW9kdWxlX2lkIiwiYWxsX21vZGUiLCJleHBsaWNpdF9tb2RlIiwic2VsZWN0b3JfaW5zdGFuY2VfaWQiLCJkZWZhdWx0X3NvcnRfb3JkZXIiLCJhbGxvd2VkX3NvcnRfb3JkZXJzIiwiaW50ZXJwb2xhdGUiLCJ0ZXh0IiwidmFsdWVzIiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJrZXkiLCJTdHJpbmciLCJyZXBsYWNlIiwiUmVnRXhwIiwicG9zaXRpdmVfaW50ZWdlciIsImNhbmRpZGF0ZSIsImZhbGxiYWNrIiwiTnVtYmVyIiwiaXNJbnRlZ2VyIiwibm9ybWFsaXplX3BhZ2Vfc2l6ZV9vcHRpb25zIiwiY2FuZGlkYXRlcyIsImN1cnJlbnRfcGFnZV9zaXplIiwibWF4aW11bV9wYWdlX3NpemUiLCJwYWdlX3NpemVzIiwiQXJyYXkiLCJpc0FycmF5IiwiaW5kZXhPZiIsInB1c2giLCJzb3J0IiwiZmlyc3RfcGFnZV9zaXplIiwic2Vjb25kX3BhZ2Vfc2l6ZSIsIm5vcm1hbGl6ZV9zb3J0X29yZGVyIiwibm9ybWFsaXplX3Jlc291cmNlX3ZpZXciLCJmYWxsYmFja19wYWdlX3NpemUiLCJzZWxlY3RlZF9pZHMiLCJjcmVhdGUiLCJzZWxlY3Rpb25fbW9kZSIsInNlbGVjdGVkX3Jlc291cmNlX2lkcyIsInJlc291cmNlX2lkIiwic29ydF9vcmRlciIsInBhZ2UiLCJwZXJfcGFnZSIsImV4cGFuZGVkX3Jlc291cmNlX2lkcyIsInNsaWNlIiwiZXhwYW5kZWRfcGFyZW50X2lkcyIsImNsb25lX3Jlc291cmNlX3ZpZXciLCJyZXNvdXJjZV92aWV3IiwiYnVpbGRfc2F2ZV9kdG8iLCJyZXF1ZXN0ZWRfcGFnZSIsIm1hcCIsImdldF9lcnJvcl9tZXNzYWdlIiwicmVzcG9uc2UiLCJyZXF1ZXN0IiwiZGF0YSIsIm1lc3NhZ2UiLCJyZXNwb25zZUpTT04iLCJjcmVhdGVfcmVzb3VyY2VfbmF2aWdhdGlvbiIsImNvbnRleHQiLCJtb3VudCIsInNldHRpbmdzIiwiY29uZmlndXJhdGlvbiIsInJlc291cmNlX25hdmlnYXRpb24iLCJpMThuIiwidHJhbnNwb3J0X3Jvb3QiLCJ0cmFuc3BvcnQiLCJyZXNvdXJjZXMiLCJ0cmFuc3BvcnRfdXJsIiwidXJsIiwiYW5ub3VuY2UiLCJzaG93X2FkbWluX21lc3NhZ2UiLCJyZXBsYWNlX3Jlc291cmNlX3ZpZXciLCJzZWxlY3Rvcl9ob3N0IiwibWFpbl9wYWdpbmF0aW9uX2hvc3QiLCJ0aW1lbGluZV9yb290IiwicmVzb3VyY2VfaGVhZGVyIiwicmVzb3VyY2VfcGFuZSIsInJlc291cmNlX3BhbmVfdG9nZ2xlX2hvc3QiLCJyZXNvdXJjZV9wYW5lX3RvZ2dsZSIsInNlbGVjdG9yX3Jvb3QiLCJzZWxlY3Rvcl9wYW5lbCIsInNlbGVjdG9yX2JhY2tkcm9wIiwic2VsZWN0b3Jfcm93cyIsInNlbGVjdG9yX3BhZ2luYXRpb25faG9zdCIsInNlbGVjdG9yX3N0YXR1cyIsInNlbGVjdG9yX3N0YXR1c19tZXNzYWdlIiwic2VsZWN0b3Jfc3Bpbm5lciIsInZhbGlkYXRpb24iLCJ2YWxpZGF0aW9uX21lc3NhZ2UiLCJhcHBseV9idXR0b24iLCJzZWFyY2hfaW5wdXQiLCJzb3J0X3NlbGVjdCIsInBhZ2Vfc2l6ZV9zZWxlY3QiLCJjb21taXR0ZWRfdmlldyIsImRlZmF1bHRfc2VsZWN0b3Jfc2l6ZSIsImRyYWZ0X3ZpZXciLCJwYWdlX3NpemVfb3B0aW9ucyIsIm1heGltdW1fc2VsZWN0b3Jfc2l6ZSIsInJlc291cmNlX3BhZ2luYXRpb24iLCJzZWxlY3Rvcl9wYWdlIiwic2VsZWN0b3JfcmVxdWVzdCIsInNlbGVjdG9yX2dlbmVyYXRpb24iLCJtYXRlcmlhbGl6YXRpb25fZ2VuZXJhdGlvbiIsIm1hdGVyaWFsaXphdGlvbl9yZXF1ZXN0cyIsInNlYXJjaF90aW1lciIsImlzX3NhdmluZyIsImlzX21hdGVyaWFsaXppbmciLCJpc19pbml0aWFsaXplZCIsInBlbmRpbmdfcGFnZV9mb2N1cyIsIm1vYmlsZV9kcmF3ZXJfbWVkaWEiLCJ3YXNfbW9iaWxlX2xheW91dCIsImlzX3Jlc291cmNlX3BhbmVfY29sbGFwc2VkIiwidmlzdWFsX3ZpZXdwb3J0IiwidmlzdWFsVmlld3BvcnQiLCJnZXRfdGVtcGxhdGUiLCJ0ZW1wbGF0ZV9rZXkiLCJ0ZW1wbGF0ZV9pZCIsInRlbXBsYXRlcyIsInRlbXBsYXRlIiwicmVuZGVyX3RlbXBsYXRlIiwidGFyZ2V0Iiwidmlld19tb2RlbCIsImlubmVySFRNTCIsImdldF9zZWxlY3RlZF9jb3VudCIsIk1hdGgiLCJtYXgiLCJ0b3RhbF9pdGVtcyIsImxlbmd0aCIsImdldF9yZXNvdXJjZV9zZWxlY3Rpb25fc2NvcGUiLCJyZXNvdXJjZSIsInNjb3BlX2lkcyIsImlzX2dyb3VwX2NvbnRyb2wiLCJzZWxlY3Rpb25fc2NvcGVfaWRzIiwiaWQiLCJub3JtYWxpemVkX2lkcyIsImdldF9yZXNvdXJjZV9zZWxlY3Rpb25fc3RhdGUiLCJzZWxlY3RlZF9jb3VudCIsImZpbHRlciIsIkJvb2xlYW4iLCJzeW5jaHJvbml6ZV9zZWxlY3Rvcl9jaGVja2JveGVzIiwiY2hlY2tib3giLCJxdWVyeVNlbGVjdG9yIiwic2VsZWN0aW9uX3N0YXRlIiwiY2hlY2tlZCIsImluZGV0ZXJtaW5hdGUiLCJnZXRfdHJpZ2dlcl9sYWJlbCIsImFsbF9yZXNvdXJjZXMiLCJyZXNvdXJjZXNfY291bnQiLCJjb3VudCIsIndpdGhfY3VycmVudF9leHBhbnNpb25fc3RhdGUiLCJzYXZlX3ZpZXciLCJwcmVmZXJlbmNlcyIsInJlZnJlc2hfc2VsZWN0aW9uX2ZlZWRiYWNrIiwiY291bnRfaG9zdCIsInRyaWdnZXJfbGFiZWwiLCJpc19lbXB0eSIsInRleHRDb250ZW50IiwiaGlkZGVuIiwibWluaW11bV9vbmUiLCJkaXNhYmxlZCIsImFwcGx5aW5nIiwiYXBwbHkiLCJzZXRfc2VsZWN0b3Jfc3RhdHVzIiwiaXNfZXJyb3IiLCJpc19sb2FkaW5nIiwibG9hZGluZyIsImNsYXNzTGlzdCIsInRvZ2dsZSIsInJlcG9ydF9zYXZlX2Vycm9yIiwic2hvd19ub3RpY2UiLCJsb2FkX2Vycm9yIiwic2V0X3NhdmVfYnVzeSIsImJ1c3kiLCJwcm90b3R5cGUiLCJjYWxsIiwicXVlcnlTZWxlY3RvckFsbCIsImNvbnRyb2wiLCJoYXNBdHRyaWJ1dGUiLCJyZW5kZXJfc2VsZWN0b3JfcGFnZSIsInJlbmRlcl9tYWluX3BhZ2luYXRpb24iLCJnZXRfcGFnaW5hdGlvbl92aWV3X21vZGVsIiwicGFnaW5hdGlvbiIsInBhZ2luYXRpb25fY29udGV4dCIsInRvdGFsX3BhZ2VzIiwibmF2aWdhdGlvbl9sYWJlbCIsImNob29zZV9yZXNvdXJjZXMiLCJyZXNvdXJjZV9oZWFkaW5nIiwicGFnZV9zdGF0dXMiLCJwYWdlcyIsImhhc19wcmV2aW91cyIsImhhc19uZXh0IiwiaXNfYnVzeSIsInJvd190ZW1wbGF0ZSIsInJvd19idWZmZXIiLCJyb3dfdmlld19tb2RlbCIsImFzc2lnbiIsImlzX3NlbGVjdGVkIiwiY2hlY2tib3hfbGFiZWwiLCJzZWxlY3RfcmVzb3VyY2VfZ3JvdXAiLCJzZWxlY3RfcmVzb3VyY2UiLCJ0aXRsZSIsImNyZWF0ZUVsZW1lbnQiLCJmaXJzdEVsZW1lbnRDaGlsZCIsImFwcGVuZENoaWxkIiwic2VsZWN0b3JfcGFnaW5hdGlvbiIsImVtcHR5IiwiZm9jdXMiLCJyZXF1ZXN0X3NlbGVjdG9yX3BhZ2UiLCJzZWFyY2giLCJnZW5lcmF0aW9uIiwialF1ZXJ5IiwiYWN0aW9uIiwibm9uY2UiLCJhYm9ydCIsImFqYXgiLCJtZXRob2QiLCJkYXRhVHlwZSIsImRvbmUiLCJzdWNjZXNzIiwiZmFpbCIsInJlcXVlc3Rfc3RhdHVzIiwiYWx3YXlzIiwibWF0ZXJpYWxpemVfYWxsX2V4Y2VwdCIsImV4Y2x1ZGVkX3Jlc291cmNlX2lkcyIsIm1heGltdW1fc2VsZWN0ZWQiLCJleGNsdWRlZF9sb29rdXAiLCJzZWxlY3Rpb25fYWN0aW9uIiwic2VsZWN0aW9uX25vbmNlIiwiZmluaXNoX21hdGVyaWFsaXphdGlvbiIsImVycm9yX21lc3NhZ2UiLCJjb2xsZWN0ZWRfaWRzIiwic2VsZWN0aW9uIiwibW9kZSIsInJlc291cmNlX2lkcyIsIm1heGltdW1fc2VsZWN0ZWRfZXJyb3IiLCJmYWlsZWRfcmVxdWVzdCIsInNhdmVfcmVzb3VyY2VfdmlldyIsImNsb3NlX3NlbGVjdG9yIiwiY29tcGxldGlvbiIsInNhdmVfYWN0aW9uIiwidmlld19ub25jZSIsIkRlZmVycmVkIiwicmVwbGFjZW1lbnQiLCJyZXNvdXJjZV92aWV3X2NvbnRleHQiLCJyZWplY3QiLCJhcHBsaWVkIiwiY2xvc2VfYnV0dG9uIiwiY2xpY2siLCJyZXNvbHZlIiwicHJvbWlzZSIsIm9wZW5fc2VsZWN0b3IiLCJ2YWx1ZSIsInNldFRpbWVvdXQiLCJzZXRfc2VsZWN0b3JfbGF5ZXJfc3RhdGUiLCJpc19vcGVuIiwiaXNfbW9iaWxlX2RyYXdlciIsIm1hdGNoZXMiLCJzZXRfcmVzb3VyY2VfcGFuZV9jb2xsYXBzZWQiLCJzaG91bGRfY29sbGFwc2UiLCJuZXh0X2NvbGxhcHNlZCIsInRvZ2dsZV9sYWJlbCIsInNob3dfcmVzb3VyY2VfcGFuZWwiLCJoaWRlX3Jlc291cmNlX3BhbmVsIiwiYWNjZXNzaWJsZV9sYWJlbCIsImZvY3VzZWRfY29udHJvbCIsImFjdGl2ZUVsZW1lbnQiLCJzaG91bGRfcmVzdG9yZV90b2dnbGVfZm9jdXMiLCJjb250YWlucyIsInNldEF0dHJpYnV0ZSIsInJlbW92ZUF0dHJpYnV0ZSIsInVwZGF0ZV9tb2JpbGVfdmlld3BvcnRfbWV0cmljcyIsInZpZXdwb3J0X2hlaWdodCIsInZpZXdwb3J0X29mZnNldF90b3AiLCJ2aWV3cG9ydF9ib3R0b21faW5zZXQiLCJzdHlsZSIsInJlbW92ZVByb3BlcnR5IiwiaGVpZ2h0IiwiaW5uZXJIZWlnaHQiLCJvZmZzZXRUb3AiLCJzZXRQcm9wZXJ0eSIsImZsb29yIiwic3luY2hyb25pemVfcmVzcG9uc2l2ZV9tb2RlIiwiZHJhd2VyX2VuYWJsZWQiLCJzZWxlY3Rvcl9pc19vcGVuIiwiZW50ZXJlZF9tb2JpbGVfbGF5b3V0IiwiZ2V0X2RyYXdlcl9mb2N1c2FibGVfY29udHJvbHMiLCJjbG9zZXN0IiwiZ2V0QXR0cmlidXRlIiwiaGFuZGxlX2NsaWNrIiwiZXZlbnQiLCJwYW5lX3RvZ2dsZSIsInNlbGVjdF9hbGxfYnV0dG9uIiwiY2xlYXJfYWxsX2J1dHRvbiIsImFwcGx5X2NvbnRyb2wiLCJwYWdlX2NvbnRyb2wiLCJkaXJlY3Rpb24iLCJ0YXJnZXRfcGFnZSIsImhhbmRsZV9jaGFuZ2UiLCJzb3J0X2NvbnRyb2wiLCJwYWdlX3NpemVfY29udHJvbCIsInJlcXVlc3RlZF9wYWdlX3NpemUiLCJzZWxlY3RlZF9yZXNvdXJjZV9pZCIsImhhbmRsZV9pbnB1dCIsImNsZWFyVGltZW91dCIsInNlYXJjaF9kZWxheV9tcyIsImhhbmRsZV9rZXlkb3duIiwiZmlyc3RfY2hlY2tib3giLCJmb2N1c2FibGVfY29udHJvbHMiLCJmaXJzdF9jb250cm9sIiwibGFzdF9jb250cm9sIiwic2hpZnRLZXkiLCJwcmV2ZW50RGVmYXVsdCIsImhhbmRsZV9sYXllcl9vcGVuIiwiZGV0YWlsIiwiaW5zdGFuY2VfaWQiLCJoYW5kbGVfbGF5ZXJfY2xvc2UiLCJyZWZyZXNoIiwiaW5pdGlhbGl6ZSIsInNob3dfbGFiZWwiLCJoaWRlX2xhYmVsIiwic2VsZWN0ZWRfbGFiZWwiLCJzb3J0X29wdGlvbnMiLCJtYXRjaE1lZGlhIiwiYWRkRXZlbnRMaXN0ZW5lciIsImFkZExpc3RlbmVyIiwiZGVzdHJveSIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJyZW1vdmVMaXN0ZW5lciIsInJlbW92ZSIsIndwYmNfdGltZWxpbmVfbW9kdWxlcyIsInJlZ2lzdGVyX2ZhY3RvcnkiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLXRpbWVsaW5lL3Jlc291cmNlLXByZWZlcmVuY2VzL19zcmMvdGltZWxpbmUtcmVzb3VyY2UtbmF2aWdhdGlvbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFRpbWVsaW5lIGJvb2tpbmcgUmVzb3VyY2Ugc2VsZWN0b3IgYW5kIFJlc291cmNlLXBhZ2UgbmF2aWdhdGlvbi5cbiAqXG4gKiBUaGUgc2VydmVyIHJlbWFpbnMgYXV0aG9yaXRhdGl2ZSBmb3IgYXV0aG9yaXphdGlvbiwgc2VsZWN0aW9uIHBlcnNpc3RlbmNlLFxuICogZ3JvdXAtc2FmZSBwYWdpbmF0aW9uLCBhbmQgc2lnbmVkIHdpbmRvdyByZXBsYWNlbWVudC4gVGhpcyBmb2N1c2VkIG1vZHVsZVxuICogb3ducyBvbmx5IHNlbGVjdG9yIGRyYWZ0cywgZmVlZGJhY2ssIGZvY3VzLCBhbmQgc3RhbGUtc2FmZSBicm93c2VyIHJlcXVlc3RzLlxuICpcbiAqIEBwYWNrYWdlIEJvb2tpbmcgQ2FsZW5kYXJcbiAqIEBzaW5jZSAgIDEyLjAuMFxuICovXG4oIGZ1bmN0aW9uICggd2luZG93LCBkb2N1bWVudCwgd3AgKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHR2YXIgbW9kdWxlX2lkID0gJ3Jlc291cmNlX25hdmlnYXRpb24nO1xuXHR2YXIgYWxsX21vZGUgPSAnYWxsJztcblx0dmFyIGV4cGxpY2l0X21vZGUgPSAnZXhwbGljaXQnO1xuXHR2YXIgc2VsZWN0b3JfaW5zdGFuY2VfaWQgPSAnd3BiYy10aW1lbGluZS1yZXNvdXJjZS1zZWxlY3Rvcic7XG5cdHZhciBkZWZhdWx0X3NvcnRfb3JkZXIgPSAnc3RhbmRhcmQnO1xuXHR2YXIgYWxsb3dlZF9zb3J0X29yZGVycyA9IFsgJ3N0YW5kYXJkJywgJ3RpdGxlX2FzYycsICd0aXRsZV9kZXNjJywgJ2lkX2FzYycsICdpZF9kZXNjJyBdO1xuXG5cdC8qKlxuXHQgKiBSZXBsYWNlIG9uZSBib3VuZGVkIHNldCBvZiBuYW1lZCBwbGFjZWhvbGRlcnMgaW4gdHJhbnNsYXRlZCB0ZXh0LlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdGV4dCAgIFRyYW5zbGF0ZWQgc291cmNlIHRleHQuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSB2YWx1ZXMgUGxhY2Vob2xkZXIgdmFsdWVzIGtleWVkIHdpdGhvdXQgYnJhY2VzLlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IEludGVycG9sYXRlZCBwbGFpbiB0ZXh0LlxuXHQgKi9cblx0ZnVuY3Rpb24gaW50ZXJwb2xhdGUoIHRleHQsIHZhbHVlcyApIHtcblx0XHRPYmplY3Qua2V5cyggdmFsdWVzIHx8IHt9ICkuZm9yRWFjaCggZnVuY3Rpb24gKCBrZXkgKSB7XG5cdFx0XHR0ZXh0ID0gU3RyaW5nKCB0ZXh0IHx8ICcnICkucmVwbGFjZSggbmV3IFJlZ0V4cCggJ1xcXFx7JyArIGtleSArICdcXFxcfScsICdnJyApLCBTdHJpbmcoIHZhbHVlc1sga2V5IF0gKSApO1xuXHRcdH0gKTtcblxuXHRcdHJldHVybiBTdHJpbmcoIHRleHQgfHwgJycgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBOb3JtYWxpemUgb25lIHBvc2l0aXZlIGludGVnZXIgdXNpbmcgYSBib3VuZGVkIGZhbGxiYWNrLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9ICAgICAgY2FuZGlkYXRlIENhbmRpZGF0ZSB2YWx1ZS5cblx0ICogQHBhcmFtIHtudW1iZXJ9IGZhbGxiYWNrICBQb3NpdGl2ZSBmYWxsYmFjay5cblx0ICogQHJldHVybiB7bnVtYmVyfSBQb3NpdGl2ZSBpbnRlZ2VyLlxuXHQgKi9cblx0ZnVuY3Rpb24gcG9zaXRpdmVfaW50ZWdlciggY2FuZGlkYXRlLCBmYWxsYmFjayApIHtcblx0XHRjYW5kaWRhdGUgPSBOdW1iZXIoIGNhbmRpZGF0ZSApO1xuXG5cdFx0cmV0dXJuIE51bWJlci5pc0ludGVnZXIoIGNhbmRpZGF0ZSApICYmIDAgPCBjYW5kaWRhdGUgPyBjYW5kaWRhdGUgOiBmYWxsYmFjaztcblx0fVxuXG5cdC8qKlxuXHQgKiBOb3JtYWxpemUgdGhlIHNlcnZlci1vd25lZCBwYWdlLXNpemUgY2hvaWNlcyBhbmQgcmV0YWluIGEgY29tcGF0aWJsZVxuXHQgKiBwcmV2aW91c2x5IHN0b3JlZCBzaXplIHRoYXQgcHJlZGF0ZXMgdGhlIHZpc2libGUgb3B0aW9uIGxpc3QuXG5cdCAqXG5cdCAqIEBwYXJhbSB7QXJyYXl9ICBjYW5kaWRhdGVzICAgICAgICBTZXJ2ZXItb3duZWQgdmlzaWJsZSBjaG9pY2VzLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gY3VycmVudF9wYWdlX3NpemUgQ3VycmVudCBwZXJzaXN0ZWQgcGFnZSBzaXplLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gbWF4aW11bV9wYWdlX3NpemUgU2VydmVyIG1heGltdW0uXG5cdCAqIEByZXR1cm4ge251bWJlcltdfSBPcmRlcmVkIHVuaXF1ZSBwYWdlLXNpemUgY2hvaWNlcy5cblx0ICovXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9wYWdlX3NpemVfb3B0aW9ucyggY2FuZGlkYXRlcywgY3VycmVudF9wYWdlX3NpemUsIG1heGltdW1fcGFnZV9zaXplICkge1xuXHRcdHZhciBwYWdlX3NpemVzID0gW107XG5cblx0XHRtYXhpbXVtX3BhZ2Vfc2l6ZSA9IHBvc2l0aXZlX2ludGVnZXIoIG1heGltdW1fcGFnZV9zaXplLCA1MCApO1xuXHRcdCggQXJyYXkuaXNBcnJheSggY2FuZGlkYXRlcyApID8gY2FuZGlkYXRlcyA6IFtdICkuZm9yRWFjaCggZnVuY3Rpb24gKCBjYW5kaWRhdGUgKSB7XG5cdFx0XHRjYW5kaWRhdGUgPSBwb3NpdGl2ZV9pbnRlZ2VyKCBjYW5kaWRhdGUsIDAgKTtcblx0XHRcdGlmICggY2FuZGlkYXRlICYmIGNhbmRpZGF0ZSA8PSBtYXhpbXVtX3BhZ2Vfc2l6ZSAmJiAtMSA9PT0gcGFnZV9zaXplcy5pbmRleE9mKCBjYW5kaWRhdGUgKSApIHtcblx0XHRcdFx0cGFnZV9zaXplcy5wdXNoKCBjYW5kaWRhdGUgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdFx0Y3VycmVudF9wYWdlX3NpemUgPSBwb3NpdGl2ZV9pbnRlZ2VyKCBjdXJyZW50X3BhZ2Vfc2l6ZSwgMCApO1xuXHRcdGlmICggY3VycmVudF9wYWdlX3NpemUgJiYgY3VycmVudF9wYWdlX3NpemUgPD0gbWF4aW11bV9wYWdlX3NpemUgJiYgLTEgPT09IHBhZ2Vfc2l6ZXMuaW5kZXhPZiggY3VycmVudF9wYWdlX3NpemUgKSApIHtcblx0XHRcdHBhZ2Vfc2l6ZXMucHVzaCggY3VycmVudF9wYWdlX3NpemUgKTtcblx0XHR9XG5cdFx0cGFnZV9zaXplcy5zb3J0KCBmdW5jdGlvbiAoIGZpcnN0X3BhZ2Vfc2l6ZSwgc2Vjb25kX3BhZ2Vfc2l6ZSApIHtcblx0XHRcdHJldHVybiBmaXJzdF9wYWdlX3NpemUgLSBzZWNvbmRfcGFnZV9zaXplO1xuXHRcdH0gKTtcblxuXHRcdHJldHVybiBwYWdlX3NpemVzO1xuXHR9XG5cblx0LyoqXG5cdCAqIE5vcm1hbGl6ZSBvbmUgc2VydmVyIG9yIGRyYWZ0IFJlc291cmNlIHNvcnQgdmFsdWUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gY2FuZGlkYXRlIENhbmRpZGF0ZSBSZXNvdXJjZSBzb3J0IHZhbHVlLlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IEFsbG93LWxpc3RlZCBSZXNvdXJjZSBzb3J0IHZhbHVlLlxuXHQgKi9cblx0ZnVuY3Rpb24gbm9ybWFsaXplX3NvcnRfb3JkZXIoIGNhbmRpZGF0ZSApIHtcblx0XHRjYW5kaWRhdGUgPSBTdHJpbmcoIGNhbmRpZGF0ZSB8fCAnJyApO1xuXG5cdFx0cmV0dXJuIC0xICE9PSBhbGxvd2VkX3NvcnRfb3JkZXJzLmluZGV4T2YoIGNhbmRpZGF0ZSApID8gY2FuZGlkYXRlIDogZGVmYXVsdF9zb3J0X29yZGVyO1xuXHR9XG5cblx0LyoqXG5cdCAqIE5vcm1hbGl6ZSBvbmUgc2VydmVyIFJlc291cmNlLXZpZXcgcmVjb3JkIGZvciBicm93c2VyIGRyYWZ0cy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNhbmRpZGF0ZSBDYW5kaWRhdGUgc2VydmVyIHJlY29yZC5cblx0ICogQHBhcmFtIHtudW1iZXJ9IGZhbGxiYWNrX3BhZ2Vfc2l6ZSBEZWZhdWx0IHBhZ2Ugc2l6ZS5cblx0ICogQHJldHVybiB7T2JqZWN0fSBDYW5vbmljYWwgYnJvd3NlciB2aWV3LlxuXHQgKi9cblx0ZnVuY3Rpb24gbm9ybWFsaXplX3Jlc291cmNlX3ZpZXcoIGNhbmRpZGF0ZSwgZmFsbGJhY2tfcGFnZV9zaXplICkge1xuXHRcdHZhciBzZWxlY3RlZF9pZHMgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0dmFyIHNlbGVjdGlvbl9tb2RlO1xuXG5cdFx0Y2FuZGlkYXRlID0gY2FuZGlkYXRlICYmICdvYmplY3QnID09PSB0eXBlb2YgY2FuZGlkYXRlID8gY2FuZGlkYXRlIDoge307XG5cdFx0c2VsZWN0aW9uX21vZGUgPSBleHBsaWNpdF9tb2RlID09PSBjYW5kaWRhdGUuc2VsZWN0aW9uX21vZGUgPyBleHBsaWNpdF9tb2RlIDogYWxsX21vZGU7XG5cdFx0aWYgKCBleHBsaWNpdF9tb2RlID09PSBzZWxlY3Rpb25fbW9kZSAmJiBBcnJheS5pc0FycmF5KCBjYW5kaWRhdGUuc2VsZWN0ZWRfcmVzb3VyY2VfaWRzICkgKSB7XG5cdFx0XHRjYW5kaWRhdGUuc2VsZWN0ZWRfcmVzb3VyY2VfaWRzLmZvckVhY2goIGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdHJlc291cmNlX2lkID0gcG9zaXRpdmVfaW50ZWdlciggcmVzb3VyY2VfaWQsIDAgKTtcblx0XHRcdFx0aWYgKCByZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0XHRzZWxlY3RlZF9pZHNbIHJlc291cmNlX2lkIF0gPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHNlbGVjdGlvbl9tb2RlOiBzZWxlY3Rpb25fbW9kZSxcblx0XHRcdHNlbGVjdGVkX2lkczogc2VsZWN0ZWRfaWRzLFxuXHRcdFx0c29ydF9vcmRlcjogbm9ybWFsaXplX3NvcnRfb3JkZXIoIGNhbmRpZGF0ZS5zb3J0X29yZGVyICksXG5cdFx0XHRwYWdlOiBwb3NpdGl2ZV9pbnRlZ2VyKCBjYW5kaWRhdGUucGFnZSwgMSApLFxuXHRcdFx0cGVyX3BhZ2U6IHBvc2l0aXZlX2ludGVnZXIoIGNhbmRpZGF0ZS5wZXJfcGFnZSwgZmFsbGJhY2tfcGFnZV9zaXplICksXG5cdFx0XHRleHBhbmRlZF9yZXNvdXJjZV9pZHM6IEFycmF5LmlzQXJyYXkoIGNhbmRpZGF0ZS5leHBhbmRlZF9yZXNvdXJjZV9pZHMgKSA/IGNhbmRpZGF0ZS5leHBhbmRlZF9yZXNvdXJjZV9pZHMuc2xpY2UoKSA6IFtdLFxuXHRcdFx0ZXhwYW5kZWRfcGFyZW50X2lkczogQXJyYXkuaXNBcnJheSggY2FuZGlkYXRlLmV4cGFuZGVkX3BhcmVudF9pZHMgKSA/IGNhbmRpZGF0ZS5leHBhbmRlZF9wYXJlbnRfaWRzLnNsaWNlKCkgOiBbXVxuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogQ2xvbmUgYSBub3JtYWxpemVkIFJlc291cmNlIHZpZXcgd2l0aG91dCBzaGFyaW5nIGRyYWZ0IGNvbGxlY3Rpb25zLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gcmVzb3VyY2VfdmlldyBOb3JtYWxpemVkIFJlc291cmNlIHZpZXcuXG5cdCAqIEByZXR1cm4ge09iamVjdH0gSW5kZXBlbmRlbnQgY2xvbmUuXG5cdCAqL1xuXHRmdW5jdGlvbiBjbG9uZV9yZXNvdXJjZV92aWV3KCByZXNvdXJjZV92aWV3ICkge1xuXHRcdHZhciBzZWxlY3RlZF9pZHMgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cblx0XHRPYmplY3Qua2V5cyggcmVzb3VyY2Vfdmlldy5zZWxlY3RlZF9pZHMgfHwge30gKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHJlc291cmNlX2lkICkge1xuXHRcdFx0c2VsZWN0ZWRfaWRzWyByZXNvdXJjZV9pZCBdID0gdHJ1ZTtcblx0XHR9ICk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0c2VsZWN0aW9uX21vZGU6IHJlc291cmNlX3ZpZXcuc2VsZWN0aW9uX21vZGUsXG5cdFx0XHRzZWxlY3RlZF9pZHM6IHNlbGVjdGVkX2lkcyxcblx0XHRcdHNvcnRfb3JkZXI6IG5vcm1hbGl6ZV9zb3J0X29yZGVyKCByZXNvdXJjZV92aWV3LnNvcnRfb3JkZXIgKSxcblx0XHRcdHBhZ2U6IHJlc291cmNlX3ZpZXcucGFnZSxcblx0XHRcdHBlcl9wYWdlOiByZXNvdXJjZV92aWV3LnBlcl9wYWdlLFxuXHRcdFx0ZXhwYW5kZWRfcmVzb3VyY2VfaWRzOiByZXNvdXJjZV92aWV3LmV4cGFuZGVkX3Jlc291cmNlX2lkcy5zbGljZSgpLFxuXHRcdFx0ZXhwYW5kZWRfcGFyZW50X2lkczogcmVzb3VyY2Vfdmlldy5leHBhbmRlZF9wYXJlbnRfaWRzLnNsaWNlKClcblx0XHR9O1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnQgYSBicm93c2VyIHZpZXcgaW50byB0aGUgY29tcGxldGUgc2F2ZSBEVE8uXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSByZXNvdXJjZV92aWV3IE5vcm1hbGl6ZWQgUmVzb3VyY2Ugdmlldy5cblx0ICogQHBhcmFtIHtudW1iZXJ9IHJlcXVlc3RlZF9wYWdlIFJlcXVlc3RlZCBSZXNvdXJjZSBwYWdlLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IENvbXBsZXRlIFJlc291cmNlLXZpZXcgc2F2ZSByZXF1ZXN0IGZpZWxkcy5cblx0ICovXG5cdGZ1bmN0aW9uIGJ1aWxkX3NhdmVfZHRvKCByZXNvdXJjZV92aWV3LCByZXF1ZXN0ZWRfcGFnZSApIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0c2VsZWN0aW9uX21vZGU6IHJlc291cmNlX3ZpZXcuc2VsZWN0aW9uX21vZGUsXG5cdFx0XHRzZWxlY3RlZF9yZXNvdXJjZV9pZHM6IGV4cGxpY2l0X21vZGUgPT09IHJlc291cmNlX3ZpZXcuc2VsZWN0aW9uX21vZGVcblx0XHRcdFx0PyBPYmplY3Qua2V5cyggcmVzb3VyY2Vfdmlldy5zZWxlY3RlZF9pZHMgKS5tYXAoIE51bWJlciApXG5cdFx0XHRcdDogW10sXG5cdFx0XHRzb3J0X29yZGVyOiBub3JtYWxpemVfc29ydF9vcmRlciggcmVzb3VyY2Vfdmlldy5zb3J0X29yZGVyICksXG5cdFx0XHRwYWdlOiBwb3NpdGl2ZV9pbnRlZ2VyKCByZXF1ZXN0ZWRfcGFnZSwgMSApLFxuXHRcdFx0cGVyX3BhZ2U6IHJlc291cmNlX3ZpZXcucGVyX3BhZ2UsXG5cdFx0XHRleHBhbmRlZF9yZXNvdXJjZV9pZHM6IHJlc291cmNlX3ZpZXcuZXhwYW5kZWRfcmVzb3VyY2VfaWRzLnNsaWNlKCksXG5cdFx0XHRleHBhbmRlZF9wYXJlbnRfaWRzOiByZXNvdXJjZV92aWV3LmV4cGFuZGVkX3BhcmVudF9pZHMuc2xpY2UoKVxuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogRXh0cmFjdCBvbmUgc2FmZSBzZXJ2ZXIgZXJyb3IgbWVzc2FnZSBmcm9tIGEgalF1ZXJ5IEFKQVggcmVzdWx0LlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gcmVzcG9uc2UgT3B0aW9uYWwgSlNPTiByZXNwb25zZS5cblx0ICogQHBhcmFtIHtPYmplY3R9IHJlcXVlc3QgIE9wdGlvbmFsIGZhaWxlZCBYTUxIdHRwUmVxdWVzdC5cblx0ICogQHBhcmFtIHtzdHJpbmd9IGZhbGxiYWNrIFNhZmUgdHJhbnNsYXRlZCBmYWxsYmFjay5cblx0ICogQHJldHVybiB7c3RyaW5nfSBVc2VyLWZhY2luZyBwbGFpbiB0ZXh0LlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X2Vycm9yX21lc3NhZ2UoIHJlc3BvbnNlLCByZXF1ZXN0LCBmYWxsYmFjayApIHtcblx0XHRpZiAoIHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5tZXNzYWdlICkge1xuXHRcdFx0cmV0dXJuIFN0cmluZyggcmVzcG9uc2UuZGF0YS5tZXNzYWdlICk7XG5cdFx0fVxuXHRcdGlmICggcmVxdWVzdCAmJiByZXF1ZXN0LnJlc3BvbnNlSlNPTiAmJiByZXF1ZXN0LnJlc3BvbnNlSlNPTi5kYXRhICYmIHJlcXVlc3QucmVzcG9uc2VKU09OLmRhdGEubWVzc2FnZSApIHtcblx0XHRcdHJldHVybiBTdHJpbmcoIHJlcXVlc3QucmVzcG9uc2VKU09OLmRhdGEubWVzc2FnZSApO1xuXHRcdH1cblxuXHRcdHJldHVybiBmYWxsYmFjaztcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGUgb25lIFJlc291cmNlIG5hdmlnYXRpb24gbW9kdWxlIGluc3RhbmNlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29udGV4dCBQYWdlLWNvbnRyb2xsZXIgaG9zdHMsIHNldHRpbmdzLCBmZWVkYmFjaywgYW5kIHNpZ25lZCByZXBsYWNlbWVudCBib3VuZGFyeS5cblx0ICogQHJldHVybiB7T2JqZWN0fSBGb2N1c2VkIGxpZmVjeWNsZSBhbmQgcmVmcmVzaCBjb250cm9sbGVyLlxuXHQgKi9cblx0ZnVuY3Rpb24gY3JlYXRlX3Jlc291cmNlX25hdmlnYXRpb24oIGNvbnRleHQgKSB7XG5cdFx0dmFyIG1vdW50ID0gY29udGV4dC5tb3VudCB8fCBudWxsO1xuXHRcdHZhciBzZXR0aW5ncyA9IGNvbnRleHQuc2V0dGluZ3MgfHwge307XG5cdFx0dmFyIGNvbmZpZ3VyYXRpb24gPSBzZXR0aW5ncy5yZXNvdXJjZV9uYXZpZ2F0aW9uIHx8IHt9O1xuXHRcdHZhciBpMThuID0gY29uZmlndXJhdGlvbi5pMThuIHx8IHt9O1xuXHRcdHZhciB0cmFuc3BvcnRfcm9vdCA9IHNldHRpbmdzLnRyYW5zcG9ydCAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIHNldHRpbmdzLnRyYW5zcG9ydCA/IHNldHRpbmdzLnRyYW5zcG9ydCA6IHt9O1xuXHRcdHZhciB0cmFuc3BvcnQgPSB0cmFuc3BvcnRfcm9vdC5yZXNvdXJjZXMgJiYgJ29iamVjdCcgPT09IHR5cGVvZiB0cmFuc3BvcnRfcm9vdC5yZXNvdXJjZXMgPyB0cmFuc3BvcnRfcm9vdC5yZXNvdXJjZXMgOiB7fTtcblx0XHR2YXIgdHJhbnNwb3J0X3VybCA9IHRyYW5zcG9ydF9yb290LnVybCA/IFN0cmluZyggdHJhbnNwb3J0X3Jvb3QudXJsICkgOiAnJztcblx0XHR2YXIgYW5ub3VuY2UgPSAnZnVuY3Rpb24nID09PSB0eXBlb2YgY29udGV4dC5hbm5vdW5jZSA/IGNvbnRleHQuYW5ub3VuY2UgOiBmdW5jdGlvbiAoKSB7fTtcblx0XHR2YXIgc2hvd19hZG1pbl9tZXNzYWdlID0gJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNvbnRleHQuc2hvd19hZG1pbl9tZXNzYWdlID8gY29udGV4dC5zaG93X2FkbWluX21lc3NhZ2UgOiBmdW5jdGlvbiAoKSB7fTtcblx0XHR2YXIgcmVwbGFjZV9yZXNvdXJjZV92aWV3ID0gJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNvbnRleHQucmVwbGFjZV9yZXNvdXJjZV92aWV3ID8gY29udGV4dC5yZXBsYWNlX3Jlc291cmNlX3ZpZXcgOiBmdW5jdGlvbiAoKSB7IHJldHVybiBudWxsOyB9O1xuXHRcdHZhciBzZWxlY3Rvcl9ob3N0ID0gbnVsbDtcblx0XHR2YXIgbWFpbl9wYWdpbmF0aW9uX2hvc3QgPSBudWxsO1xuXHRcdHZhciB0aW1lbGluZV9yb290ID0gbnVsbDtcblx0XHR2YXIgcmVzb3VyY2VfaGVhZGVyID0gbnVsbDtcblx0XHR2YXIgcmVzb3VyY2VfcGFuZSA9IG51bGw7XG5cdFx0dmFyIHJlc291cmNlX3BhbmVfdG9nZ2xlX2hvc3QgPSBudWxsO1xuXHRcdHZhciByZXNvdXJjZV9wYW5lX3RvZ2dsZSA9IG51bGw7XG5cdFx0dmFyIHNlbGVjdG9yX3Jvb3QgPSBudWxsO1xuXHRcdHZhciBzZWxlY3Rvcl9wYW5lbCA9IG51bGw7XG5cdFx0dmFyIHNlbGVjdG9yX2JhY2tkcm9wID0gbnVsbDtcblx0XHR2YXIgc2VsZWN0b3Jfcm93cyA9IG51bGw7XG5cdFx0dmFyIHNlbGVjdG9yX3BhZ2luYXRpb25faG9zdCA9IG51bGw7XG5cdFx0dmFyIHNlbGVjdG9yX3N0YXR1cyA9IG51bGw7XG5cdFx0dmFyIHNlbGVjdG9yX3N0YXR1c19tZXNzYWdlID0gbnVsbDtcblx0XHR2YXIgc2VsZWN0b3Jfc3Bpbm5lciA9IG51bGw7XG5cdFx0dmFyIHZhbGlkYXRpb24gPSBudWxsO1xuXHRcdHZhciB2YWxpZGF0aW9uX21lc3NhZ2UgPSBudWxsO1xuXHRcdHZhciBhcHBseV9idXR0b24gPSBudWxsO1xuXHRcdHZhciBzZWFyY2hfaW5wdXQgPSBudWxsO1xuXHRcdHZhciBzb3J0X3NlbGVjdCA9IG51bGw7XG5cdFx0dmFyIHBhZ2Vfc2l6ZV9zZWxlY3QgPSBudWxsO1xuXHRcdHZhciBjb21taXR0ZWRfdmlldyA9IG5vcm1hbGl6ZV9yZXNvdXJjZV92aWV3KCBzZXR0aW5ncy5yZXNvdXJjZV92aWV3LCBjb25maWd1cmF0aW9uLmRlZmF1bHRfc2VsZWN0b3Jfc2l6ZSB8fCAyMCApO1xuXHRcdHZhciBkcmFmdF92aWV3ID0gY2xvbmVfcmVzb3VyY2VfdmlldyggY29tbWl0dGVkX3ZpZXcgKTtcblx0XHR2YXIgcGFnZV9zaXplX29wdGlvbnMgPSBub3JtYWxpemVfcGFnZV9zaXplX29wdGlvbnMoXG5cdFx0XHRjb25maWd1cmF0aW9uLnBhZ2Vfc2l6ZV9vcHRpb25zLFxuXHRcdFx0Y29tbWl0dGVkX3ZpZXcucGVyX3BhZ2UsXG5cdFx0XHRjb25maWd1cmF0aW9uLm1heGltdW1fc2VsZWN0b3Jfc2l6ZVxuXHRcdCk7XG5cdFx0dmFyIHJlc291cmNlX3BhZ2luYXRpb24gPSBzZXR0aW5ncy5yZXNvdXJjZV9wYWdpbmF0aW9uIHx8IHt9O1xuXHRcdHZhciBzZWxlY3Rvcl9wYWdlID0gbnVsbDtcblx0XHR2YXIgc2VsZWN0b3JfcmVxdWVzdCA9IG51bGw7XG5cdFx0dmFyIHNlbGVjdG9yX2dlbmVyYXRpb24gPSAwO1xuXHRcdHZhciBtYXRlcmlhbGl6YXRpb25fZ2VuZXJhdGlvbiA9IDA7XG5cdFx0dmFyIG1hdGVyaWFsaXphdGlvbl9yZXF1ZXN0cyA9IFtdO1xuXHRcdHZhciBzZWFyY2hfdGltZXIgPSAwO1xuXHRcdHZhciBpc19zYXZpbmcgPSBmYWxzZTtcblx0XHR2YXIgaXNfbWF0ZXJpYWxpemluZyA9IGZhbHNlO1xuXHRcdHZhciBpc19pbml0aWFsaXplZCA9IGZhbHNlO1xuXHRcdHZhciBwZW5kaW5nX3BhZ2VfZm9jdXMgPSAnJztcblx0XHR2YXIgbW9iaWxlX2RyYXdlcl9tZWRpYSA9IG51bGw7XG5cdFx0dmFyIHdhc19tb2JpbGVfbGF5b3V0ID0gbnVsbDtcblx0XHR2YXIgaXNfcmVzb3VyY2VfcGFuZV9jb2xsYXBzZWQgPSBmYWxzZTtcblx0XHR2YXIgdmlzdWFsX3ZpZXdwb3J0ID0gd2luZG93LnZpc3VhbFZpZXdwb3J0IHx8IG51bGw7XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gb25lIHNlcnZlci1hbGxvdy1saXN0ZWQgUmVzb3VyY2UgbmF2aWdhdGlvbiB0ZW1wbGF0ZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZW1wbGF0ZV9rZXkgRG9tYWluIHRlbXBsYXRlIGtleS5cblx0XHQgKiBAcmV0dXJuIHtGdW5jdGlvbnxudWxsfSBXb3JkUHJlc3MgdGVtcGxhdGUgcmVuZGVyZXIgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfdGVtcGxhdGUoIHRlbXBsYXRlX2tleSApIHtcblx0XHRcdHZhciB0ZW1wbGF0ZV9pZCA9IGNvbmZpZ3VyYXRpb24udGVtcGxhdGVzICYmIGNvbmZpZ3VyYXRpb24udGVtcGxhdGVzWyB0ZW1wbGF0ZV9rZXkgXTtcblxuXHRcdFx0cmV0dXJuIHRlbXBsYXRlX2lkICYmIHdwICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3cC50ZW1wbGF0ZSA/IHdwLnRlbXBsYXRlKCB0ZW1wbGF0ZV9pZCApIDogbnVsbDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW5kZXIgb25lIFJlc291cmNlIG5hdmlnYXRpb24gdGVtcGxhdGUgaW50byBhbiBvd25lZCBob3N0LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gdGFyZ2V0IFRhcmdldCBob3N0LlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZW1wbGF0ZV9rZXkgRG9tYWluIHRlbXBsYXRlIGtleS5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gdmlld19tb2RlbCBBdXRob3JpemVkIHRlbXBsYXRlIG1vZGVsLlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiByZW5kZXJlZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZW5kZXJfdGVtcGxhdGUoIHRhcmdldCwgdGVtcGxhdGVfa2V5LCB2aWV3X21vZGVsICkge1xuXHRcdFx0dmFyIHRlbXBsYXRlID0gZ2V0X3RlbXBsYXRlKCB0ZW1wbGF0ZV9rZXkgKTtcblxuXHRcdFx0aWYgKCAhIHRhcmdldCB8fCAhIHRlbXBsYXRlICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHR0YXJnZXQuaW5uZXJIVE1MID0gdGVtcGxhdGUoIHZpZXdfbW9kZWwgfHwge30gKTtcblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBjdXJyZW50IGRyYWZ0IHNlbGVjdGlvbiBjb3VudC5cblx0XHQgKlxuXHRcdCAqIEFsbC1tb2RlIGludGVudGlvbmFsbHkgcmV0dXJucyB0aGUgYXV0aG9yaXplZCByb290LXBhZ2UgdG90YWwgdXNlZCBieSB0aGVcblx0XHQgKiBzZXJ2ZXIuIFRoZSB0cmlnZ2VyIHNheXMgXCJBbGwgUmVzb3VyY2VzXCIgc28gQnVzaW5lc3MgTGFyZ2UgY2hpbGQgcm93cyBhcmVcblx0XHQgKiBuZXZlciBtaXNyZXByZXNlbnRlZCBhcyBpbmRlcGVuZGVudGx5IHBhZ2VkIHVuaXRzLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7bnVtYmVyfSBFeHBsaWNpdCBjb3VudCBvciBhdXRob3JpemVkIHBhZ2luYXRpb24gdG90YWwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3NlbGVjdGVkX2NvdW50KCkge1xuXHRcdFx0cmV0dXJuIGFsbF9tb2RlID09PSBkcmFmdF92aWV3LnNlbGVjdGlvbl9tb2RlXG5cdFx0XHRcdD8gTWF0aC5tYXgoIDAsIE51bWJlciggcmVzb3VyY2VfcGFnaW5hdGlvbi50b3RhbF9pdGVtcyApIHx8IDAgKVxuXHRcdFx0XHQ6IE9iamVjdC5rZXlzKCBkcmFmdF92aWV3LnNlbGVjdGVkX2lkcyApLmxlbmd0aDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gdGhlIGV4YWN0IGF1dGhvcml6ZWQgSURzIGNvbnRyb2xsZWQgYnkgb25lIHNlbGVjdG9yIHJvdy5cblx0XHQgKlxuXHRcdCAqIEJ1c2luZXNzIExhcmdlIHBhcmVudCByb3dzIHJlY2VpdmUgdGhlaXIgY29tcGxldGUgZ3JvdXAgc2NvcGUgZnJvbSB0aGVcblx0XHQgKiBzZXJ2ZXIgRFRPLiBGbGF0IGFuZCBjaGlsZCByb3dzIHJldGFpbiBvbmUtUmVzb3VyY2Ugc2VsZWN0aW9uIHNlbWFudGljcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZXNvdXJjZSBBdXRob3JpemVkIHNlbGVjdG9yIFJlc291cmNlIERUTy5cblx0XHQgKiBAcmV0dXJuIHtudW1iZXJbXX0gUG9zaXRpdmUgdW5pcXVlIFJlc291cmNlIElEcy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfcmVzb3VyY2Vfc2VsZWN0aW9uX3Njb3BlKCByZXNvdXJjZSApIHtcblx0XHRcdHZhciBzY29wZV9pZHMgPSByZXNvdXJjZSAmJiByZXNvdXJjZS5pc19ncm91cF9jb250cm9sICYmIEFycmF5LmlzQXJyYXkoIHJlc291cmNlLnNlbGVjdGlvbl9zY29wZV9pZHMgKVxuXHRcdFx0XHQ/IHJlc291cmNlLnNlbGVjdGlvbl9zY29wZV9pZHNcblx0XHRcdFx0OiBbIHJlc291cmNlID8gcmVzb3VyY2UuaWQgOiAwIF07XG5cdFx0XHR2YXIgbm9ybWFsaXplZF9pZHMgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cblx0XHRcdHNjb3BlX2lkcy5mb3JFYWNoKCBmdW5jdGlvbiAoIHJlc291cmNlX2lkICkge1xuXHRcdFx0XHRyZXNvdXJjZV9pZCA9IHBvc2l0aXZlX2ludGVnZXIoIHJlc291cmNlX2lkLCAwICk7XG5cdFx0XHRcdGlmICggcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdFx0bm9ybWFsaXplZF9pZHNbIHJlc291cmNlX2lkIF0gPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cblx0XHRcdHJldHVybiBPYmplY3Qua2V5cyggbm9ybWFsaXplZF9pZHMgKS5tYXAoIE51bWJlciApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENhbGN1bGF0ZSBvbmUgcm93J3MgY2hlY2tlZCwgbWl4ZWQsIG9yIHVuY2hlY2tlZCBkcmFmdCBzdGF0ZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZXNvdXJjZSBBdXRob3JpemVkIHNlbGVjdG9yIFJlc291cmNlIERUTy5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IE9uZSBvZiBzZWxlY3RlZCwgbWl4ZWQsIG9yIHVuc2VsZWN0ZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3Jlc291cmNlX3NlbGVjdGlvbl9zdGF0ZSggcmVzb3VyY2UgKSB7XG5cdFx0XHR2YXIgc2NvcGVfaWRzID0gZ2V0X3Jlc291cmNlX3NlbGVjdGlvbl9zY29wZSggcmVzb3VyY2UgKTtcblx0XHRcdHZhciBzZWxlY3RlZF9jb3VudDtcblxuXHRcdFx0aWYgKCBhbGxfbW9kZSA9PT0gZHJhZnRfdmlldy5zZWxlY3Rpb25fbW9kZSApIHtcblx0XHRcdFx0cmV0dXJuICdzZWxlY3RlZCc7XG5cdFx0XHR9XG5cdFx0XHRzZWxlY3RlZF9jb3VudCA9IHNjb3BlX2lkcy5maWx0ZXIoIGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdHJldHVybiBCb29sZWFuKCBkcmFmdF92aWV3LnNlbGVjdGVkX2lkc1sgcmVzb3VyY2VfaWQgXSApO1xuXHRcdFx0fSApLmxlbmd0aDtcblx0XHRcdGlmICggISBzZWxlY3RlZF9jb3VudCApIHtcblx0XHRcdFx0cmV0dXJuICd1bnNlbGVjdGVkJztcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHNlbGVjdGVkX2NvdW50ID09PSBzY29wZV9pZHMubGVuZ3RoID8gJ3NlbGVjdGVkJyA6ICdtaXhlZCc7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3luY2hyb25pemUgdmlzaWJsZSBuYXRpdmUgY2hlY2tib3ggcHJvcGVydGllcyBhZnRlciBhIGRyYWZ0IGNoYW5nZS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc3luY2hyb25pemVfc2VsZWN0b3JfY2hlY2tib3hlcygpIHtcblx0XHRcdHZhciByZXNvdXJjZXMgPSBzZWxlY3Rvcl9wYWdlICYmIEFycmF5LmlzQXJyYXkoIHNlbGVjdG9yX3BhZ2UucmVzb3VyY2VzICkgPyBzZWxlY3Rvcl9wYWdlLnJlc291cmNlcyA6IFtdO1xuXG5cdFx0XHRyZXNvdXJjZXMuZm9yRWFjaCggZnVuY3Rpb24gKCByZXNvdXJjZSApIHtcblx0XHRcdFx0dmFyIGNoZWNrYm94ID0gc2VsZWN0b3Jfcm93cyA/IHNlbGVjdG9yX3Jvd3MucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2UtY2hlY2tib3hdW3ZhbHVlPVwiJyArIHJlc291cmNlLmlkICsgJ1wiXScgKSA6IG51bGw7XG5cdFx0XHRcdHZhciBzZWxlY3Rpb25fc3RhdGUgPSBnZXRfcmVzb3VyY2Vfc2VsZWN0aW9uX3N0YXRlKCByZXNvdXJjZSApO1xuXG5cdFx0XHRcdGlmICggISBjaGVja2JveCApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2hlY2tib3guY2hlY2tlZCA9ICdzZWxlY3RlZCcgPT09IHNlbGVjdGlvbl9zdGF0ZTtcblx0XHRcdFx0Y2hlY2tib3guaW5kZXRlcm1pbmF0ZSA9ICdtaXhlZCcgPT09IHNlbGVjdGlvbl9zdGF0ZTtcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gdGhlIHNlbGVjdG9yIHRyaWdnZXIgbGFiZWwgZm9yIHRoZSBjb21taXR0ZWQgdmlldy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gVHJhbnNsYXRlZCBwbGFpbiBsYWJlbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfdHJpZ2dlcl9sYWJlbCgpIHtcblx0XHRcdHJldHVybiBhbGxfbW9kZSA9PT0gY29tbWl0dGVkX3ZpZXcuc2VsZWN0aW9uX21vZGVcblx0XHRcdFx0PyBpMThuLmFsbF9yZXNvdXJjZXNcblx0XHRcdFx0OiBpbnRlcnBvbGF0ZSggaTE4bi5yZXNvdXJjZXNfY291bnQsIHsgY291bnQ6IE9iamVjdC5rZXlzKCBjb21taXR0ZWRfdmlldy5zZWxlY3RlZF9pZHMgKS5sZW5ndGggfSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE1lcmdlIGN1cnJlbnQgcHJlc2VudGF0aW9uLW9ubHkgZXhwYW5zaW9uIHN0YXRlIGludG8gYSBzYXZlIGNhbmRpZGF0ZS5cblx0XHQgKlxuXHRcdCAqIFJvdyBhbmQgaGllcmFyY2h5IHRvZ2dsZXMgdXBkYXRlIHRoZSBzaGFyZWQgc2V0dGluZ3Mgb2JqZWN0IGJldHdlZW4gd2luZG93XG5cdFx0ICogcmVhZHMuIFJlYWRpbmcgaXQgYXQgc3VibWl0IHRpbWUgYXZvaWRzIG92ZXJ3cml0aW5nIGEgbmV3ZXIgYnJvd3NlciBzdGF0ZVxuXHRcdCAqIHdpdGggdGhlIFJlc291cmNlIHZpZXcgY2FwdHVyZWQgd2hlbiB0aGlzIG1vZHVsZSBsYXN0IHJlZnJlc2hlZC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZXNvdXJjZV92aWV3IE5vcm1hbGl6ZWQgc2VsZWN0aW9uIGFuZCBwYWdpbmcgc3RhdGUuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fSBJbmRlcGVuZGVudCB2aWV3IHdpdGggY3VycmVudCBleHBhbnNpb24gY29sbGVjdGlvbnMuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gd2l0aF9jdXJyZW50X2V4cGFuc2lvbl9zdGF0ZSggcmVzb3VyY2VfdmlldyApIHtcblx0XHRcdHZhciBzYXZlX3ZpZXcgPSBjbG9uZV9yZXNvdXJjZV92aWV3KCByZXNvdXJjZV92aWV3ICk7XG5cdFx0XHR2YXIgcHJlZmVyZW5jZXMgPSBzZXR0aW5ncy5wcmVmZXJlbmNlcyB8fCB7fTtcblxuXHRcdFx0c2F2ZV92aWV3LmV4cGFuZGVkX3Jlc291cmNlX2lkcyA9IEFycmF5LmlzQXJyYXkoIHByZWZlcmVuY2VzLmV4cGFuZGVkX3Jlc291cmNlX2lkcyApXG5cdFx0XHRcdD8gcHJlZmVyZW5jZXMuZXhwYW5kZWRfcmVzb3VyY2VfaWRzLnNsaWNlKClcblx0XHRcdFx0OiBzYXZlX3ZpZXcuZXhwYW5kZWRfcmVzb3VyY2VfaWRzO1xuXHRcdFx0c2F2ZV92aWV3LmV4cGFuZGVkX3BhcmVudF9pZHMgPSBBcnJheS5pc0FycmF5KCBwcmVmZXJlbmNlcy5leHBhbmRlZF9wYXJlbnRfaWRzIClcblx0XHRcdFx0PyBwcmVmZXJlbmNlcy5leHBhbmRlZF9wYXJlbnRfaWRzLnNsaWNlKClcblx0XHRcdFx0OiBzYXZlX3ZpZXcuZXhwYW5kZWRfcGFyZW50X2lkcztcblxuXHRcdFx0cmV0dXJuIHNhdmVfdmlldztcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBVcGRhdGUgc2VsZWN0aW9uIGxhYmVscywgdmFsaWRhdGlvbiwgYW5kIEFwcGx5IGF2YWlsYWJpbGl0eS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVmcmVzaF9zZWxlY3Rpb25fZmVlZGJhY2soKSB7XG5cdFx0XHR2YXIgY291bnQgPSBnZXRfc2VsZWN0ZWRfY291bnQoKTtcblx0XHRcdHZhciBjb3VudF9ob3N0ID0gc2VsZWN0b3Jfcm9vdCA/IHNlbGVjdG9yX3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2Utc2VsZWN0ZWQtY291bnRdJyApIDogbnVsbDtcblx0XHRcdHZhciB0cmlnZ2VyX2xhYmVsID0gc2VsZWN0b3Jfcm9vdCA/IHNlbGVjdG9yX3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2Utc2VsZWN0b3ItbGFiZWxdJyApIDogbnVsbDtcblx0XHRcdHZhciBpc19lbXB0eSA9IGV4cGxpY2l0X21vZGUgPT09IGRyYWZ0X3ZpZXcuc2VsZWN0aW9uX21vZGUgJiYgMCA9PT0gY291bnQ7XG5cblx0XHRcdGlmICggY291bnRfaG9zdCApIHtcblx0XHRcdFx0Y291bnRfaG9zdC50ZXh0Q29udGVudCA9IGludGVycG9sYXRlKCBpMThuLnNlbGVjdGVkX2NvdW50LCB7IGNvdW50OiBjb3VudCB9ICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRyaWdnZXJfbGFiZWwgKSB7XG5cdFx0XHRcdHRyaWdnZXJfbGFiZWwudGV4dENvbnRlbnQgPSBnZXRfdHJpZ2dlcl9sYWJlbCgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB2YWxpZGF0aW9uICkge1xuXHRcdFx0XHR2YWxpZGF0aW9uLmhpZGRlbiA9ICEgaXNfZW1wdHk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHZhbGlkYXRpb25fbWVzc2FnZSAmJiBpc19lbXB0eSApIHtcblx0XHRcdFx0dmFsaWRhdGlvbl9tZXNzYWdlLnRleHRDb250ZW50ID0gaTE4bi5taW5pbXVtX29uZTtcblx0XHRcdH1cblx0XHRcdGlmICggYXBwbHlfYnV0dG9uICkge1xuXHRcdFx0XHRhcHBseV9idXR0b24uZGlzYWJsZWQgPSBpc19zYXZpbmcgfHwgaXNfbWF0ZXJpYWxpemluZyB8fCBpc19lbXB0eTtcblx0XHRcdFx0YXBwbHlfYnV0dG9uLnRleHRDb250ZW50ID0gaXNfc2F2aW5nID8gaTE4bi5hcHBseWluZyA6IGkxOG4uYXBwbHk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU2V0IHRoZSBzZWxlY3RvcidzIG5vbi1kZXN0cnVjdGl2ZSBsb2FkaW5nIG9yIGVycm9yIGZlZWRiYWNrLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgUGxhaW4gdGV4dCBtZXNzYWdlLlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfZXJyb3IgV2hldGhlciB0aGUgbWVzc2FnZSByZXByZXNlbnRzIGFuIGVycm9yLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2V0X3NlbGVjdG9yX3N0YXR1cyggbWVzc2FnZSwgaXNfZXJyb3IgKSB7XG5cdFx0XHR2YXIgaXNfbG9hZGluZztcblxuXHRcdFx0aWYgKCAhIHNlbGVjdG9yX3N0YXR1cyApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aXNfbG9hZGluZyA9IG1lc3NhZ2UgPT09IGkxOG4ubG9hZGluZyB8fCBtZXNzYWdlID09PSBpMThuLmFwcGx5aW5nO1xuXHRcdFx0aWYgKCBzZWxlY3Rvcl9zdGF0dXNfbWVzc2FnZSApIHtcblx0XHRcdFx0c2VsZWN0b3Jfc3RhdHVzX21lc3NhZ2UudGV4dENvbnRlbnQgPSBtZXNzYWdlIHx8ICcnO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBzZWxlY3Rvcl9zcGlubmVyICkge1xuXHRcdFx0XHRzZWxlY3Rvcl9zcGlubmVyLmhpZGRlbiA9ICEgaXNfbG9hZGluZztcblx0XHRcdH1cblx0XHRcdHNlbGVjdG9yX3N0YXR1cy5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtZXJyb3InLCBCb29sZWFuKCBpc19lcnJvciApICk7XG5cdFx0XHRzZWxlY3Rvcl9zdGF0dXMuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWxvYWRpbmcnLCBpc19sb2FkaW5nICk7XG5cdFx0XHRzZWxlY3Rvcl9zdGF0dXMuaGlkZGVuID0gISBtZXNzYWdlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlcG9ydCBhIFJlc291cmNlLXZpZXcgZmFpbHVyZSB0aHJvdWdoIGJvdGggbG9jYWwgYW5kIHBhZ2UtbGV2ZWwgZmVlZGJhY2suXG5cdFx0ICpcblx0XHQgKiBNYWluIHNpZGViYXIgcGFnaW5hdGlvbiBjYW4gcnVuIHdoaWxlIHRoZSBzZWxlY3RvciBpcyBjbG9zZWQsIHNvIGl0c1xuXHRcdCAqIGZhaWx1cmUgY2Fubm90IHJlbHkgb24gdGhlIHNlbGVjdG9yIHN0YXR1cyByZWdpb24gYWxvbmUuIFRoZSBwYWdlLW93bmVkXG5cdFx0ICogbm90aWNlIGNhbGxiYWNrIGtlZXBzIHRyYW5zcG9ydCBhbmQgc2F2ZSBmYWlsdXJlcyB2aXNpYmxlIHdpdGhvdXQgbGV0dGluZ1xuXHRcdCAqIHRoaXMgZG9tYWluIGFkYXB0ZXIgY29uc3RydWN0IGFkbWluaXN0cmF0aW9uIG5vdGljZSBtYXJrdXAuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSBQbGFpbiB0cmFuc2xhdGVkIGVycm9yIHRleHQuXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBzaG93X25vdGljZSBXaGV0aGVyIHRvIGRpc3BsYXkgdGhlIHBhZ2UtbGV2ZWwgbm90aWNlLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVwb3J0X3NhdmVfZXJyb3IoIG1lc3NhZ2UsIHNob3dfbm90aWNlICkge1xuXHRcdFx0bWVzc2FnZSA9IFN0cmluZyggbWVzc2FnZSB8fCBpMThuLmxvYWRfZXJyb3IgfHwgJycgKTtcblx0XHRcdHNldF9zZWxlY3Rvcl9zdGF0dXMoIG1lc3NhZ2UsIHRydWUgKTtcblx0XHRcdGFubm91bmNlKCBtZXNzYWdlICk7XG5cdFx0XHRpZiAoIHNob3dfbm90aWNlICkge1xuXHRcdFx0XHRzaG93X2FkbWluX21lc3NhZ2UoIG1lc3NhZ2UsICdlcnJvcicsIDMwMDAwICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogVXBkYXRlIHNlbGVjdG9yIGFuZCBtYWluIHBhZ2luZyBjb250cm9scyBkdXJpbmcgc2F2ZS9yZWFkYmFjay5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gYnVzeSBXaGV0aGVyIGEgUmVzb3VyY2UtdmlldyByZXF1ZXN0IG93bnMgdGhlIFVJLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2V0X3NhdmVfYnVzeSggYnVzeSApIHtcblx0XHRcdGlzX3NhdmluZyA9IEJvb2xlYW4oIGJ1c3kgKTtcblx0XHRcdGlmICggc2VsZWN0b3Jfcm9vdCApIHtcblx0XHRcdFx0c2VsZWN0b3Jfcm9vdC5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtc2F2aW5nJywgaXNfc2F2aW5nICk7XG5cdFx0XHRcdEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoXG5cdFx0XHRcdFx0c2VsZWN0b3Jfcm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnaW5wdXQsIHNlbGVjdCwgYnV0dG9uJyApLFxuXHRcdFx0XHRcdGZ1bmN0aW9uICggY29udHJvbCApIHtcblx0XHRcdFx0XHRcdGlmICggISBjb250cm9sLmhhc0F0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1yZXNvdXJjZS1hcHBseScgKSApIHtcblx0XHRcdFx0XHRcdFx0Y29udHJvbC5kaXNhYmxlZCA9IGlzX3NhdmluZztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0XHRyZWZyZXNoX3NlbGVjdGlvbl9mZWVkYmFjaygpO1xuXHRcdFx0aWYgKCAhIGlzX3NhdmluZyAmJiBzZWxlY3Rvcl9wYWdlICkge1xuXHRcdFx0XHRyZW5kZXJfc2VsZWN0b3JfcGFnZSggc2VsZWN0b3JfcGFnZSApO1xuXHRcdFx0fVxuXHRcdFx0cmVuZGVyX21haW5fcGFnaW5hdGlvbigpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEJ1aWxkIGEgbm9ybWFsaXplZCBwYWdpbmF0aW9uIHRlbXBsYXRlIG1vZGVsLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHBhZ2luYXRpb24gU2VydmVyIHBhZ2luYXRpb24gRFRPLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBwYWdpbmF0aW9uX2NvbnRleHQgTWFpbiBvciBzZWxlY3RvciBjb250ZXh0LlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gYnVzeSBXaGV0aGVyIG5hdmlnYXRpb24gaXMgbG9ja2VkLlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gVGVtcGxhdGUtcmVhZHkgbW9kZWwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3BhZ2luYXRpb25fdmlld19tb2RlbCggcGFnaW5hdGlvbiwgcGFnaW5hdGlvbl9jb250ZXh0LCBidXN5ICkge1xuXHRcdFx0dmFyIHBhZ2UgPSBwb3NpdGl2ZV9pbnRlZ2VyKCBwYWdpbmF0aW9uLnBhZ2UsIDEgKTtcblx0XHRcdHZhciB0b3RhbF9wYWdlcyA9IE1hdGgubWF4KCAwLCBOdW1iZXIoIHBhZ2luYXRpb24udG90YWxfcGFnZXMgKSB8fCAwICk7XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGNvbnRleHQ6IHBhZ2luYXRpb25fY29udGV4dCxcblx0XHRcdFx0bmF2aWdhdGlvbl9sYWJlbDogJ3NlbGVjdG9yJyA9PT0gcGFnaW5hdGlvbl9jb250ZXh0ID8gaTE4bi5jaG9vc2VfcmVzb3VyY2VzIDogc2V0dGluZ3MuaTE4bi5yZXNvdXJjZV9oZWFkaW5nLFxuXHRcdFx0XHRwYWdlX3N0YXR1czogaW50ZXJwb2xhdGUoIGkxOG4ucGFnZV9zdGF0dXMsIHsgcGFnZTogcGFnZSwgcGFnZXM6IE1hdGgubWF4KCAxLCB0b3RhbF9wYWdlcyApIH0gKSxcblx0XHRcdFx0aGFzX3ByZXZpb3VzOiBCb29sZWFuKCBwYWdpbmF0aW9uLmhhc19wcmV2aW91cyApLFxuXHRcdFx0XHRoYXNfbmV4dDogQm9vbGVhbiggcGFnaW5hdGlvbi5oYXNfbmV4dCApLFxuXHRcdFx0XHRpc19idXN5OiBCb29sZWFuKCBidXN5ICksXG5cdFx0XHRcdGkxOG46IGkxOG5cblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVuZGVyIHRoZSBmaXhlZCBSZXNvdXJjZSBzaWRlYmFyIHBhZ2luYXRpb24uXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl9tYWluX3BhZ2luYXRpb24oKSB7XG5cdFx0XHRpZiAoICEgbWFpbl9wYWdpbmF0aW9uX2hvc3QgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHJlbmRlcl90ZW1wbGF0ZShcblx0XHRcdFx0bWFpbl9wYWdpbmF0aW9uX2hvc3QsXG5cdFx0XHRcdCdwYWdpbmF0aW9uJyxcblx0XHRcdFx0Z2V0X3BhZ2luYXRpb25fdmlld19tb2RlbCggcmVzb3VyY2VfcGFnaW5hdGlvbiwgJ21haW4nLCBpc19zYXZpbmcgKVxuXHRcdFx0KTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW5kZXIgb25lIGF1dGhvcml6ZWQgc2VsZWN0b3IgcGFnZSB3aXRoIHRoZSBjdXJyZW50IGNyb3NzLXBhZ2UgZHJhZnQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcmVzcG9uc2UgU2VsZWN0b3IgZW5kcG9pbnQgRFRPLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX3NlbGVjdG9yX3BhZ2UoIHJlc3BvbnNlICkge1xuXHRcdFx0dmFyIHJvd190ZW1wbGF0ZSA9IGdldF90ZW1wbGF0ZSggJ3NlbGVjdG9yX3JvdycgKTtcblx0XHRcdHZhciByb3dfYnVmZmVyO1xuXG5cdFx0XHRzZWxlY3Rvcl9wYWdlID0gcmVzcG9uc2UgfHwge307XG5cdFx0XHRpZiAoIHNlbGVjdG9yX3Jvd3MgKSB7XG5cdFx0XHRcdHNlbGVjdG9yX3Jvd3MudGV4dENvbnRlbnQgPSAnJztcblx0XHRcdH1cblx0XHRcdGlmICggISBzZWxlY3Rvcl9yb3dzIHx8ICEgcm93X3RlbXBsYXRlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHQoIEFycmF5LmlzQXJyYXkoIHNlbGVjdG9yX3BhZ2UucmVzb3VyY2VzICkgPyBzZWxlY3Rvcl9wYWdlLnJlc291cmNlcyA6IFtdICkuZm9yRWFjaCggZnVuY3Rpb24gKCByZXNvdXJjZSApIHtcblx0XHRcdFx0dmFyIHJvd192aWV3X21vZGVsID0gT2JqZWN0LmFzc2lnbigge30sIHJlc291cmNlICk7XG5cblx0XHRcdFx0cm93X3ZpZXdfbW9kZWwuc2VsZWN0aW9uX3N0YXRlID0gZ2V0X3Jlc291cmNlX3NlbGVjdGlvbl9zdGF0ZSggcmVzb3VyY2UgKTtcblx0XHRcdFx0cm93X3ZpZXdfbW9kZWwuaXNfc2VsZWN0ZWQgPSAnc2VsZWN0ZWQnID09PSByb3dfdmlld19tb2RlbC5zZWxlY3Rpb25fc3RhdGU7XG5cdFx0XHRcdHJvd192aWV3X21vZGVsLmNoZWNrYm94X2xhYmVsID0gaW50ZXJwb2xhdGUoXG5cdFx0XHRcdFx0cmVzb3VyY2UuaXNfZ3JvdXBfY29udHJvbCA/IGkxOG4uc2VsZWN0X3Jlc291cmNlX2dyb3VwIDogaTE4bi5zZWxlY3RfcmVzb3VyY2UsXG5cdFx0XHRcdFx0eyB0aXRsZTogcmVzb3VyY2UudGl0bGUgfVxuXHRcdFx0XHQpO1xuXHRcdFx0XHRyb3dfYnVmZmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0XHRcdFx0cm93X2J1ZmZlci5pbm5lckhUTUwgPSByb3dfdGVtcGxhdGUoIHJvd192aWV3X21vZGVsICk7XG5cdFx0XHRcdGlmICggcm93X2J1ZmZlci5maXJzdEVsZW1lbnRDaGlsZCApIHtcblx0XHRcdFx0XHRzZWxlY3Rvcl9yb3dzLmFwcGVuZENoaWxkKCByb3dfYnVmZmVyLmZpcnN0RWxlbWVudENoaWxkICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdHN5bmNocm9uaXplX3NlbGVjdG9yX2NoZWNrYm94ZXMoKTtcblxuXHRcdFx0aWYgKCBzZWxlY3Rvcl9wYWdpbmF0aW9uX2hvc3QgKSB7XG5cdFx0XHRcdHJlbmRlcl90ZW1wbGF0ZShcblx0XHRcdFx0XHRzZWxlY3Rvcl9wYWdpbmF0aW9uX2hvc3QsXG5cdFx0XHRcdFx0J3BhZ2luYXRpb24nLFxuXHRcdFx0XHRcdGdldF9wYWdpbmF0aW9uX3ZpZXdfbW9kZWwoIHNlbGVjdG9yX3BhZ2Uuc2VsZWN0b3JfcGFnaW5hdGlvbiB8fCB7fSwgJ3NlbGVjdG9yJywgaXNfc2F2aW5nIHx8IGlzX21hdGVyaWFsaXppbmcgKVxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHNlbGVjdG9yX3BhZ2UucmVzb3VyY2VzIHx8ICEgc2VsZWN0b3JfcGFnZS5yZXNvdXJjZXMubGVuZ3RoICkge1xuXHRcdFx0XHRzZXRfc2VsZWN0b3Jfc3RhdHVzKCBpMThuLmVtcHR5LCBmYWxzZSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c2V0X3NlbGVjdG9yX3N0YXR1cyggJycsIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0XHRyZWZyZXNoX3NlbGVjdGlvbl9mZWVkYmFjaygpO1xuXHRcdFx0aWYgKCBwZW5kaW5nX3BhZ2VfZm9jdXMgJiYgc2VsZWN0b3JfcGFnaW5hdGlvbl9ob3N0ICkge1xuXHRcdFx0XHQoIHNlbGVjdG9yX3BhZ2luYXRpb25faG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1yZXNvdXJjZS1wYWdlPVwiJyArIHBlbmRpbmdfcGFnZV9mb2N1cyArICdcIl0nICkgfHwgc2VhcmNoX2lucHV0ICkuZm9jdXMoKTtcblx0XHRcdFx0cGVuZGluZ19wYWdlX2ZvY3VzID0gJyc7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVxdWVzdCBvbmUgaW5kZXBlbmRlbnRseSBwYWdlZCBzZWxlY3RvciByZXN1bHQgYW5kIHJlamVjdCBzdGFsZSByZXNwb25zZXMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gcGFnZSBSZXF1ZXN0ZWQgc2VsZWN0b3IgcGFnZS5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gc2VhcmNoIFZhbGlkYXRlZCBzZXJ2ZXIgc2VhcmNoIGNhbmRpZGF0ZS5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0galF1ZXJ5IHJlcXVlc3Qgb3IgbnVsbCB3aGVuIHRyYW5zcG9ydCBpcyB1bmF2YWlsYWJsZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZXF1ZXN0X3NlbGVjdG9yX3BhZ2UoIHBhZ2UsIHNlYXJjaCApIHtcblx0XHRcdHZhciBnZW5lcmF0aW9uO1xuXG5cdFx0XHRpZiAoIGlzX3NhdmluZyB8fCBpc19tYXRlcmlhbGl6aW5nICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGlmICggISB3aW5kb3cualF1ZXJ5IHx8ICEgdHJhbnNwb3J0X3VybCB8fCAhIHRyYW5zcG9ydC5hY3Rpb24gfHwgISB0cmFuc3BvcnQubm9uY2UgKSB7XG5cdFx0XHRcdHNldF9zZWxlY3Rvcl9zdGF0dXMoIGkxOG4ubG9hZF9lcnJvciwgdHJ1ZSApO1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHNlbGVjdG9yX2dlbmVyYXRpb24gKz0gMTtcblx0XHRcdGdlbmVyYXRpb24gPSBzZWxlY3Rvcl9nZW5lcmF0aW9uO1xuXHRcdFx0aWYgKCBzZWxlY3Rvcl9yZXF1ZXN0ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBzZWxlY3Rvcl9yZXF1ZXN0LmFib3J0ICkge1xuXHRcdFx0XHRzZWxlY3Rvcl9yZXF1ZXN0LmFib3J0KCk7XG5cdFx0XHR9XG5cdFx0XHRzZXRfc2VsZWN0b3Jfc3RhdHVzKCBpMThuLmxvYWRpbmcsIGZhbHNlICk7XG5cdFx0XHRzZWxlY3Rvcl9yZXF1ZXN0ID0gd2luZG93LmpRdWVyeS5hamF4KCB7XG5cdFx0XHRcdHVybDogdHJhbnNwb3J0X3VybCxcblx0XHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRcdGRhdGFUeXBlOiAnanNvbicsXG5cdFx0XHRcdGRhdGE6IHtcblx0XHRcdFx0XHRhY3Rpb246IHRyYW5zcG9ydC5hY3Rpb24sXG5cdFx0XHRcdFx0bm9uY2U6IHRyYW5zcG9ydC5ub25jZSxcblx0XHRcdFx0XHRwYWdlOiBwb3NpdGl2ZV9pbnRlZ2VyKCBwYWdlLCAxICksXG5cdFx0XHRcdFx0cGVyX3BhZ2U6IHBvc2l0aXZlX2ludGVnZXIoIGRyYWZ0X3ZpZXcucGVyX3BhZ2UsIGNvbmZpZ3VyYXRpb24uZGVmYXVsdF9zZWxlY3Rvcl9zaXplIHx8IDIwICksXG5cdFx0XHRcdFx0c2VhcmNoOiBTdHJpbmcoIHNlYXJjaCB8fCAnJyApLFxuXHRcdFx0XHRcdHNvcnRfb3JkZXI6IG5vcm1hbGl6ZV9zb3J0X29yZGVyKCBkcmFmdF92aWV3LnNvcnRfb3JkZXIgKVxuXHRcdFx0XHR9XG5cdFx0XHR9ICkuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdFx0aWYgKCBnZW5lcmF0aW9uICE9PSBzZWxlY3Rvcl9nZW5lcmF0aW9uICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICEgcmVzcG9uc2UgfHwgISByZXNwb25zZS5zdWNjZXNzIHx8ICEgcmVzcG9uc2UuZGF0YSApIHtcblx0XHRcdFx0XHRzZXRfc2VsZWN0b3Jfc3RhdHVzKCBnZXRfZXJyb3JfbWVzc2FnZSggcmVzcG9uc2UsIG51bGwsIGkxOG4ubG9hZF9lcnJvciApLCB0cnVlICk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlbmRlcl9zZWxlY3Rvcl9wYWdlKCByZXNwb25zZS5kYXRhICk7XG5cdFx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCByZXF1ZXN0LCByZXF1ZXN0X3N0YXR1cyApIHtcblx0XHRcdFx0aWYgKCBnZW5lcmF0aW9uICE9PSBzZWxlY3Rvcl9nZW5lcmF0aW9uIHx8ICdhYm9ydCcgPT09IHJlcXVlc3Rfc3RhdHVzICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRzZXRfc2VsZWN0b3Jfc3RhdHVzKCBnZXRfZXJyb3JfbWVzc2FnZSggbnVsbCwgcmVxdWVzdCwgaTE4bi5sb2FkX2Vycm9yICksIHRydWUgKTtcblx0XHRcdH0gKS5hbHdheXMoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0aWYgKCBnZW5lcmF0aW9uID09PSBzZWxlY3Rvcl9nZW5lcmF0aW9uICkge1xuXHRcdFx0XHRcdHNlbGVjdG9yX3JlcXVlc3QgPSBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cblx0XHRcdHJldHVybiBzZWxlY3Rvcl9yZXF1ZXN0O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE1hdGVyaWFsaXplIGFsbCBhdXRob3JpemVkIElEcyBvbmx5IHdoZW4gYWxsLW1vZGUgbG9zZXMgb25lIGNoZWNrYm94LlxuXHRcdCAqXG5cdFx0ICogVGhlIHBlcnNpc3RlZCBjb250cmFjdCBpbnRlbnRpb25hbGx5IGhhcyBvbmx5IGBhbGxgIGFuZCBgZXhwbGljaXRgOyBpdCBoYXNcblx0XHQgKiBubyBleGNsdXNpb24gbW9kZS4gQSBkZWRpY2F0ZWQgSURzLW9ubHkgcmVhZCB0aGVyZWZvcmUgcHJvZHVjZXMgYW4gZXhhY3Rcblx0XHQgKiBleHBsaWNpdCBkcmFmdCB3aXRob3V0IGFwcGx5aW5nIHByZXNlbnRhdGlvbi1yb3cgb3IgaGllcmFyY2h5IGJ1ZGdldHMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcltdfSBleGNsdWRlZF9yZXNvdXJjZV9pZHMgRXhhY3QgUmVzb3VyY2UgSURzIHVuY2hlY2tlZCBmcm9tIGFsbC1tb2RlLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbWF0ZXJpYWxpemVfYWxsX2V4Y2VwdCggZXhjbHVkZWRfcmVzb3VyY2VfaWRzICkge1xuXHRcdFx0dmFyIGdlbmVyYXRpb247XG5cdFx0XHR2YXIgbWF4aW11bV9zZWxlY3RlZCA9IHBvc2l0aXZlX2ludGVnZXIoIGNvbmZpZ3VyYXRpb24ubWF4aW11bV9zZWxlY3RlZCwgNTAwICk7XG5cdFx0XHR2YXIgcmVxdWVzdDtcblx0XHRcdHZhciBleGNsdWRlZF9sb29rdXAgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cblx0XHRcdCggQXJyYXkuaXNBcnJheSggZXhjbHVkZWRfcmVzb3VyY2VfaWRzICkgPyBleGNsdWRlZF9yZXNvdXJjZV9pZHMgOiBbIGV4Y2x1ZGVkX3Jlc291cmNlX2lkcyBdICkuZm9yRWFjaCggZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0cmVzb3VyY2VfaWQgPSBwb3NpdGl2ZV9pbnRlZ2VyKCByZXNvdXJjZV9pZCwgMCApO1xuXHRcdFx0XHRpZiAoIHJlc291cmNlX2lkICkge1xuXHRcdFx0XHRcdGV4Y2x1ZGVkX2xvb2t1cFsgcmVzb3VyY2VfaWQgXSA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblxuXHRcdFx0aWYgKCAhIHdpbmRvdy5qUXVlcnkgfHwgISB0cmFuc3BvcnRfdXJsIHx8ICEgdHJhbnNwb3J0LnNlbGVjdGlvbl9hY3Rpb24gfHwgISB0cmFuc3BvcnQuc2VsZWN0aW9uX25vbmNlIHx8IGlzX21hdGVyaWFsaXppbmcgfHwgaXNfc2F2aW5nICkge1xuXHRcdFx0XHRzZXRfc2VsZWN0b3Jfc3RhdHVzKCBpMThuLmxvYWRfZXJyb3IsIHRydWUgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0bWF0ZXJpYWxpemF0aW9uX2dlbmVyYXRpb24gKz0gMTtcblx0XHRcdGdlbmVyYXRpb24gPSBtYXRlcmlhbGl6YXRpb25fZ2VuZXJhdGlvbjtcblx0XHRcdGlzX21hdGVyaWFsaXppbmcgPSB0cnVlO1xuXHRcdFx0aWYgKCBzZWxlY3Rvcl9yb290ICkge1xuXHRcdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCBzZWxlY3Rvcl9yb290LnF1ZXJ5U2VsZWN0b3JBbGwoICdpbnB1dCwgc2VsZWN0LCBidXR0b24nICksIGZ1bmN0aW9uICggY29udHJvbCApIHtcblx0XHRcdFx0XHRjb250cm9sLmRpc2FibGVkID0gdHJ1ZTtcblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXHRcdFx0c2V0X3NlbGVjdG9yX3N0YXR1cyggaTE4bi5sb2FkaW5nLCBmYWxzZSApO1xuXHRcdFx0cmVmcmVzaF9zZWxlY3Rpb25fZmVlZGJhY2soKTtcblxuXHRcdFx0LyoqXG5cdFx0XHQgKiBSZWxlYXNlIHRoZSBtYXRlcmlhbGl6YXRpb24gbG9jayBhbmQgcmVzdG9yZSB0aGUgdmlzaWJsZSBkcmFmdCBwYWdlLlxuXHRcdFx0ICpcblx0XHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBlcnJvcl9tZXNzYWdlIFNhZmUgZXJyb3Igb3IgYW4gZW1wdHkgc3VjY2VzcyB2YWx1ZS5cblx0XHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0XHQgKi9cblx0XHRcdGZ1bmN0aW9uIGZpbmlzaF9tYXRlcmlhbGl6YXRpb24oIGVycm9yX21lc3NhZ2UgKSB7XG5cdFx0XHRcdGlmICggZ2VuZXJhdGlvbiAhPT0gbWF0ZXJpYWxpemF0aW9uX2dlbmVyYXRpb24gKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlzX21hdGVyaWFsaXppbmcgPSBmYWxzZTtcblx0XHRcdFx0bWF0ZXJpYWxpemF0aW9uX3JlcXVlc3RzID0gW107XG5cdFx0XHRcdGlmICggc2VsZWN0b3Jfcm9vdCApIHtcblx0XHRcdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCBzZWxlY3Rvcl9yb290LnF1ZXJ5U2VsZWN0b3JBbGwoICdpbnB1dCwgc2VsZWN0LCBidXR0b24nICksIGZ1bmN0aW9uICggY29udHJvbCApIHtcblx0XHRcdFx0XHRcdGNvbnRyb2wuZGlzYWJsZWQgPSBmYWxzZTtcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBzZWxlY3Rvcl9wYWdlICkge1xuXHRcdFx0XHRcdHJlbmRlcl9zZWxlY3Rvcl9wYWdlKCBzZWxlY3Rvcl9wYWdlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBlcnJvcl9tZXNzYWdlICkge1xuXHRcdFx0XHRcdHNldF9zZWxlY3Rvcl9zdGF0dXMoIGVycm9yX21lc3NhZ2UsIHRydWUgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZWZyZXNoX3NlbGVjdGlvbl9mZWVkYmFjaygpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXF1ZXN0ID0gd2luZG93LmpRdWVyeS5hamF4KCB7XG5cdFx0XHRcdHVybDogdHJhbnNwb3J0X3VybCxcblx0XHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRcdGRhdGFUeXBlOiAnanNvbicsXG5cdFx0XHRcdGRhdGE6IHtcblx0XHRcdFx0XHRhY3Rpb246IHRyYW5zcG9ydC5zZWxlY3Rpb25fYWN0aW9uLFxuXHRcdFx0XHRcdG5vbmNlOiB0cmFuc3BvcnQuc2VsZWN0aW9uX25vbmNlXG5cdFx0XHRcdH1cblx0XHRcdH0gKS5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0XHR2YXIgY29sbGVjdGVkX2lkcyA9IE9iamVjdC5jcmVhdGUoIG51bGwgKTtcblx0XHRcdFx0dmFyIHNlbGVjdGlvbiA9IHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5zZWxlY3Rpb24gPyByZXNwb25zZS5kYXRhLnNlbGVjdGlvbiA6IHt9O1xuXG5cdFx0XHRcdGlmICggZ2VuZXJhdGlvbiAhPT0gbWF0ZXJpYWxpemF0aW9uX2dlbmVyYXRpb24gKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggISByZXNwb25zZSB8fCAhIHJlc3BvbnNlLnN1Y2Nlc3MgfHwgZXhwbGljaXRfbW9kZSAhPT0gc2VsZWN0aW9uLm1vZGUgfHwgISBBcnJheS5pc0FycmF5KCBzZWxlY3Rpb24ucmVzb3VyY2VfaWRzICkgKSB7XG5cdFx0XHRcdFx0ZmluaXNoX21hdGVyaWFsaXphdGlvbiggZ2V0X2Vycm9yX21lc3NhZ2UoIHJlc3BvbnNlLCBudWxsLCBpMThuLmxvYWRfZXJyb3IgKSApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRzZWxlY3Rpb24ucmVzb3VyY2VfaWRzLmZvckVhY2goIGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdFx0cmVzb3VyY2VfaWQgPSBwb3NpdGl2ZV9pbnRlZ2VyKCByZXNvdXJjZV9pZCwgMCApO1xuXHRcdFx0XHRcdGlmICggcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdFx0XHRjb2xsZWN0ZWRfaWRzWyByZXNvdXJjZV9pZCBdID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0aWYgKFxuXHRcdFx0XHRcdE9iamVjdC5rZXlzKCBjb2xsZWN0ZWRfaWRzICkubGVuZ3RoICE9PSBzZWxlY3Rpb24ucmVzb3VyY2VfaWRzLmxlbmd0aFxuXHRcdFx0XHRcdHx8IE9iamVjdC5rZXlzKCBjb2xsZWN0ZWRfaWRzICkubGVuZ3RoICE9PSBOdW1iZXIoIHNlbGVjdGlvbi5jb3VudCApXG5cdFx0XHRcdCkge1xuXHRcdFx0XHRcdGZpbmlzaF9tYXRlcmlhbGl6YXRpb24oIGkxOG4ubG9hZF9lcnJvciApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIE9iamVjdC5rZXlzKCBjb2xsZWN0ZWRfaWRzICkubGVuZ3RoID4gbWF4aW11bV9zZWxlY3RlZCApIHtcblx0XHRcdFx0XHRmaW5pc2hfbWF0ZXJpYWxpemF0aW9uKCBpMThuLm1heGltdW1fc2VsZWN0ZWRfZXJyb3IgKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0T2JqZWN0LmtleXMoIGV4Y2x1ZGVkX2xvb2t1cCApLmZvckVhY2goIGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdFx0ZGVsZXRlIGNvbGxlY3RlZF9pZHNbIHJlc291cmNlX2lkIF07XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0aWYgKCAhIE9iamVjdC5rZXlzKCBjb2xsZWN0ZWRfaWRzICkubGVuZ3RoICkge1xuXHRcdFx0XHRcdGZpbmlzaF9tYXRlcmlhbGl6YXRpb24oIGkxOG4ubWluaW11bV9vbmUgKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0ZHJhZnRfdmlldy5zZWxlY3Rpb25fbW9kZSA9IGV4cGxpY2l0X21vZGU7XG5cdFx0XHRcdGRyYWZ0X3ZpZXcuc2VsZWN0ZWRfaWRzID0gY29sbGVjdGVkX2lkcztcblx0XHRcdFx0ZmluaXNoX21hdGVyaWFsaXphdGlvbiggJycgKTtcblx0XHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoIGZhaWxlZF9yZXF1ZXN0LCByZXF1ZXN0X3N0YXR1cyApIHtcblx0XHRcdFx0aWYgKCBnZW5lcmF0aW9uID09PSBtYXRlcmlhbGl6YXRpb25fZ2VuZXJhdGlvbiAmJiAnYWJvcnQnICE9PSByZXF1ZXN0X3N0YXR1cyApIHtcblx0XHRcdFx0XHRmaW5pc2hfbWF0ZXJpYWxpemF0aW9uKCBnZXRfZXJyb3JfbWVzc2FnZSggbnVsbCwgZmFpbGVkX3JlcXVlc3QsIGkxOG4ubG9hZF9lcnJvciApICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblxuXHRcdFx0bWF0ZXJpYWxpemF0aW9uX3JlcXVlc3RzLnB1c2goIHJlcXVlc3QgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTZW5kIG9uZSBjb21wbGV0ZSBSZXNvdXJjZS12aWV3IHNhdmUgYW5kIGtlZXAgY29udHJvbHMgbG9ja2VkIHRocm91Z2ggcmVhZGJhY2suXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gY2FuZGlkYXRlIENvbXBsZXRlIFJlc291cmNlLXZpZXcgc2F2ZSBEVE8uXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBjbG9zZV9zZWxlY3RvciBXaGV0aGVyIHN1Y2Nlc3NmdWwgcmVhZGJhY2sgY2xvc2VzIHRoZSBzZWxlY3Rvci5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0galF1ZXJ5LWNvbXBhdGlibGUgY29tcGxldGlvbiBwcm9taXNlIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2F2ZV9yZXNvdXJjZV92aWV3KCBjYW5kaWRhdGUsIGNsb3NlX3NlbGVjdG9yICkge1xuXHRcdFx0dmFyIGNvbXBsZXRpb247XG5cdFx0XHR2YXIgcmVxdWVzdDtcblxuXHRcdFx0aWYgKCBpc19zYXZpbmcgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHdpbmRvdy5qUXVlcnkgfHwgISB0cmFuc3BvcnRfdXJsIHx8ICEgdHJhbnNwb3J0LnNhdmVfYWN0aW9uIHx8ICEgdHJhbnNwb3J0LnZpZXdfbm9uY2UgKSB7XG5cdFx0XHRcdHJlcG9ydF9zYXZlX2Vycm9yKCBpMThuLmxvYWRfZXJyb3IsIHRydWUgKTtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRjb21wbGV0aW9uID0gd2luZG93LmpRdWVyeS5EZWZlcnJlZCgpO1xuXHRcdFx0c2V0X3NhdmVfYnVzeSggdHJ1ZSApO1xuXHRcdFx0c2V0X3NlbGVjdG9yX3N0YXR1cyggaTE4bi5hcHBseWluZywgZmFsc2UgKTtcblx0XHRcdHJlcXVlc3QgPSB3aW5kb3cualF1ZXJ5LmFqYXgoIHtcblx0XHRcdFx0dXJsOiB0cmFuc3BvcnRfdXJsLFxuXHRcdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdFx0ZGF0YVR5cGU6ICdqc29uJyxcblx0XHRcdFx0ZGF0YTogT2JqZWN0LmFzc2lnbigge30sIGNhbmRpZGF0ZSwge1xuXHRcdFx0XHRcdGFjdGlvbjogdHJhbnNwb3J0LnNhdmVfYWN0aW9uLFxuXHRcdFx0XHRcdG5vbmNlOiB0cmFuc3BvcnQudmlld19ub25jZVxuXHRcdFx0XHR9IClcblx0XHRcdH0gKS5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0XHR2YXIgcmVwbGFjZW1lbnQ7XG5cdFx0XHRcdHZhciBlcnJvcl9tZXNzYWdlO1xuXG5cdFx0XHRcdGlmICggISByZXNwb25zZSB8fCAhIHJlc3BvbnNlLnN1Y2Nlc3MgfHwgISByZXNwb25zZS5kYXRhIHx8ICEgcmVzcG9uc2UuZGF0YS5yZXNvdXJjZV92aWV3X2NvbnRleHQgKSB7XG5cdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSA9IGdldF9lcnJvcl9tZXNzYWdlKCByZXNwb25zZSwgbnVsbCwgaTE4bi5sb2FkX2Vycm9yICk7XG5cdFx0XHRcdFx0cmVwb3J0X3NhdmVfZXJyb3IoIGVycm9yX21lc3NhZ2UsIHRydWUgKTtcblx0XHRcdFx0XHRjb21wbGV0aW9uLnJlamVjdCggZmFsc2UgKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29tbWl0dGVkX3ZpZXcgPSBub3JtYWxpemVfcmVzb3VyY2VfdmlldyggcmVzcG9uc2UuZGF0YS5yZXNvdXJjZV92aWV3LCBjb25maWd1cmF0aW9uLmRlZmF1bHRfc2VsZWN0b3Jfc2l6ZSB8fCAyMCApO1xuXHRcdFx0XHRkcmFmdF92aWV3ID0gY2xvbmVfcmVzb3VyY2VfdmlldyggY29tbWl0dGVkX3ZpZXcgKTtcblx0XHRcdFx0cmVzb3VyY2VfcGFnaW5hdGlvbiA9IHJlc3BvbnNlLmRhdGEucmVzb3VyY2VfcGFnaW5hdGlvbiB8fCB7fTtcblx0XHRcdFx0c2V0dGluZ3MucmVzb3VyY2VfdmlldyA9IHJlc3BvbnNlLmRhdGEucmVzb3VyY2Vfdmlldztcblx0XHRcdFx0c2V0dGluZ3MucmVzb3VyY2VfcGFnaW5hdGlvbiA9IHJlc291cmNlX3BhZ2luYXRpb247XG5cdFx0XHRcdHJlcGxhY2VtZW50ID0gcmVwbGFjZV9yZXNvdXJjZV92aWV3KCByZXNwb25zZS5kYXRhLnJlc291cmNlX3ZpZXdfY29udGV4dCApO1xuXHRcdFx0XHRpZiAoICEgcmVwbGFjZW1lbnQgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHJlcGxhY2VtZW50LmRvbmUgKSB7XG5cdFx0XHRcdFx0cmVwb3J0X3NhdmVfZXJyb3IoIGkxOG4ubG9hZF9lcnJvciwgdHJ1ZSApO1xuXHRcdFx0XHRcdGNvbXBsZXRpb24ucmVqZWN0KCBmYWxzZSApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXBsYWNlbWVudC5kb25lKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0YW5ub3VuY2UoIGkxOG4uYXBwbGllZCApO1xuXHRcdFx0XHRcdGlmICggY2xvc2Vfc2VsZWN0b3IgJiYgc2VsZWN0b3Jfcm9vdCApIHtcblx0XHRcdFx0XHRcdHZhciBjbG9zZV9idXR0b24gPSBzZWxlY3Rvcl9yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXNoYXJlZC11aS1wb3BvdmVyLWNsb3NlXScgKTtcblx0XHRcdFx0XHRcdGlmICggY2xvc2VfYnV0dG9uICkge1xuXHRcdFx0XHRcdFx0XHQvLyBUaGUgc2F2ZSBsb2NrIGRpc2FibGVzIENhbmNlbCwgYnV0IGEgc3VjY2Vzc2Z1bCBBcHBseSBtdXN0IGNsb3NlIHRocm91Z2ggdGhlIHNoYXJlZCBsaWZlY3ljbGUuXG5cdFx0XHRcdFx0XHRcdGNsb3NlX2J1dHRvbi5kaXNhYmxlZCA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0XHRjbG9zZV9idXR0b24uY2xpY2soKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29tcGxldGlvbi5yZXNvbHZlKCB0cnVlICk7XG5cdFx0XHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0Ly8gVGhlIHBhZ2UgY29udHJvbGxlciBhbHJlYWR5IG93bnMgdGhlIHZpc2libGUgd2luZG93LXJlYWQgZXJyb3Igbm90aWNlLlxuXHRcdFx0XHRcdHJlcG9ydF9zYXZlX2Vycm9yKCBpMThuLmxvYWRfZXJyb3IsIGZhbHNlICk7XG5cdFx0XHRcdFx0Y29tcGxldGlvbi5yZWplY3QoIGZhbHNlICk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoIGZhaWxlZF9yZXF1ZXN0LCByZXF1ZXN0X3N0YXR1cyApIHtcblx0XHRcdFx0aWYgKCAnYWJvcnQnICE9PSByZXF1ZXN0X3N0YXR1cyApIHtcblx0XHRcdFx0XHRyZXBvcnRfc2F2ZV9lcnJvciggZ2V0X2Vycm9yX21lc3NhZ2UoIG51bGwsIGZhaWxlZF9yZXF1ZXN0LCBpMThuLmxvYWRfZXJyb3IgKSwgdHJ1ZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbXBsZXRpb24ucmVqZWN0KCBmYWxzZSApO1xuXHRcdFx0fSApO1xuXHRcdFx0Y29tcGxldGlvbi5hbHdheXMoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0c2V0X3NhdmVfYnVzeSggZmFsc2UgKTtcblx0XHRcdFx0cmVuZGVyX21haW5fcGFnaW5hdGlvbigpO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4gY29tcGxldGlvbi5wcm9taXNlKCB7XG5cdFx0XHRcdGFib3J0OiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0aWYgKCByZXF1ZXN0ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiByZXF1ZXN0LmFib3J0ICkge1xuXHRcdFx0XHRcdFx0cmVxdWVzdC5hYm9ydCgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc2V0IHRoZSBzZWxlY3RvciBkcmFmdCB3aGVuIGl0cyBkaXNjbG9zdXJlIG9wZW5zLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBvcGVuX3NlbGVjdG9yKCkge1xuXHRcdFx0ZHJhZnRfdmlldyA9IGNsb25lX3Jlc291cmNlX3ZpZXcoIGNvbW1pdHRlZF92aWV3ICk7XG5cdFx0XHRpZiAoIHNvcnRfc2VsZWN0ICkge1xuXHRcdFx0XHRzb3J0X3NlbGVjdC52YWx1ZSA9IGRyYWZ0X3ZpZXcuc29ydF9vcmRlcjtcblx0XHRcdH1cblx0XHRcdGlmICggcGFnZV9zaXplX3NlbGVjdCApIHtcblx0XHRcdFx0cGFnZV9zaXplX3NlbGVjdC52YWx1ZSA9IFN0cmluZyggZHJhZnRfdmlldy5wZXJfcGFnZSApO1xuXHRcdFx0fVxuXHRcdFx0cmVmcmVzaF9zZWxlY3Rpb25fZmVlZGJhY2soKTtcblx0XHRcdHJlcXVlc3Rfc2VsZWN0b3JfcGFnZSggMSwgc2VhcmNoX2lucHV0ID8gc2VhcmNoX2lucHV0LnZhbHVlIDogJycgKTtcblx0XHRcdHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGlmICggc2VhcmNoX2lucHV0ICkge1xuXHRcdFx0XHRcdHNlYXJjaF9pbnB1dC5mb2N1cygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCAwICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmFpc2Ugb3IgcmVzdG9yZSB0aGUgUmVzb3VyY2UgaGVhZGVyIHN0YWNraW5nIGxheWVyIHdpdGggdGhlIHNlbGVjdG9yLlxuXHRcdCAqXG5cdFx0ICogVGhlIGRhdGUtYXhpcyBoZWFkZXIgaXMgYSBzaWJsaW5nIHN0YWNraW5nIGNvbnRleHQuIFJhaXNpbmcgdGhlIG93bmluZ1xuXHRcdCAqIFJlc291cmNlIGhlYWRlciBwcmV2ZW50cyBpdHMgY3VycmVudC1kYXRlIG1hcmtlciBmcm9tIHBhaW50aW5nIG92ZXIgdGhlXG5cdFx0ICogZG9tYWluIHBvcG92ZXIgd2l0aG91dCBjaGFuZ2luZyBUaW1lbGluZSBzY3JvbGwgb3Igc2hhcmVkLWxheWVyIHJ1bGVzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBpc19vcGVuIFdoZXRoZXIgdGhlIFJlc291cmNlIHNlbGVjdG9yIGlzIG9wZW4uXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRfc2VsZWN0b3JfbGF5ZXJfc3RhdGUoIGlzX29wZW4gKSB7XG5cdFx0XHRpZiAoIHJlc291cmNlX2hlYWRlciApIHtcblx0XHRcdFx0cmVzb3VyY2VfaGVhZGVyLmNsYXNzTGlzdC50b2dnbGUoICdoYXMtb3Blbi1yZXNvdXJjZS1zZWxlY3RvcicsIEJvb2xlYW4oIGlzX29wZW4gKSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBzZWxlY3Rvcl9iYWNrZHJvcCApIHtcblx0XHRcdFx0c2VsZWN0b3JfYmFja2Ryb3AuaGlkZGVuID0gISBpc19vcGVuIHx8ICEgaXNfbW9iaWxlX2RyYXdlcigpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIERldGVybWluZSB3aGV0aGVyIHRoZSByZXNwb25zaXZlIFJlc291cmNlIHNlbGVjdG9yIGlzIGEgbW9kYWwgZHJhd2VyLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSBhdCB0aGUgV29yZFByZXNzIGFkbWluaXN0cmF0aW9uIG1vYmlsZSBicmVha3BvaW50LlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGlzX21vYmlsZV9kcmF3ZXIoKSB7XG5cdFx0XHRyZXR1cm4gQm9vbGVhbiggbW9iaWxlX2RyYXdlcl9tZWRpYSAmJiBtb2JpbGVfZHJhd2VyX21lZGlhLm1hdGNoZXMgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTZXQgdGhlIG1vYmlsZSBSZXNvdXJjZS1wYW5lIHByZXNlbnRhdGlvbiB3aXRob3V0IGNoYW5naW5nIHNhdmVkIHZpZXcgZGF0YS5cblx0XHQgKlxuXHRcdCAqIEJvdGggdGhlIHN0aWNreSBSZXNvdXJjZSBoZWFkZXIgYW5kIFJlc291cmNlIHJvd3MgaW5oZXJpdCB0aGUgc2FtZSBjb2xsYXBzZWRcblx0XHQgKiB3aWR0aCBmcm9tIHRoZSBUaW1lbGluZSByb290LiBUaGlzIHByZXNlcnZlcyB0aGVpciBhbGlnbm1lbnQgd2l0aCB0aGUgZGF0ZVxuXHRcdCAqIGF4aXMgd2hpbGUgdGhlIHRvZ2dsZSByZW1haW5zIGtleWJvYXJkIGFuZCBzY3JlZW4tcmVhZGVyIGFjY2Vzc2libGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IHNob3VsZF9jb2xsYXBzZSBXaGV0aGVyIHRoZSBtb2JpbGUgUmVzb3VyY2UgcGFuZSBzaG91bGQgY29sbGFwc2UuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRfcmVzb3VyY2VfcGFuZV9jb2xsYXBzZWQoIHNob3VsZF9jb2xsYXBzZSApIHtcblx0XHRcdHZhciBuZXh0X2NvbGxhcHNlZCA9IEJvb2xlYW4oIHNob3VsZF9jb2xsYXBzZSAmJiBpc19tb2JpbGVfZHJhd2VyKCkgKTtcblx0XHRcdHZhciB0b2dnbGVfbGFiZWwgPSBuZXh0X2NvbGxhcHNlZCA/IGkxOG4uc2hvd19yZXNvdXJjZV9wYW5lbCA6IGkxOG4uaGlkZV9yZXNvdXJjZV9wYW5lbDtcblx0XHRcdHZhciBhY2Nlc3NpYmxlX2xhYmVsO1xuXHRcdFx0dmFyIGZvY3VzZWRfY29udHJvbCA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG5cdFx0XHR2YXIgc2hvdWxkX3Jlc3RvcmVfdG9nZ2xlX2ZvY3VzID0gQm9vbGVhbihcblx0XHRcdFx0bmV4dF9jb2xsYXBzZWRcblx0XHRcdFx0JiYgZm9jdXNlZF9jb250cm9sXG5cdFx0XHRcdCYmIChcblx0XHRcdFx0XHRyZXNvdXJjZV9wYW5lICYmIHJlc291cmNlX3BhbmUuY29udGFpbnMoIGZvY3VzZWRfY29udHJvbCApXG5cdFx0XHRcdFx0fHwgc2VsZWN0b3JfaG9zdCAmJiBzZWxlY3Rvcl9ob3N0LmNvbnRhaW5zKCBmb2N1c2VkX2NvbnRyb2wgKVxuXHRcdFx0XHQpXG5cdFx0XHQpO1xuXG5cdFx0XHRpZiAoIG5leHRfY29sbGFwc2VkICYmIHNlbGVjdG9yX3Jvb3QgJiYgc2VsZWN0b3Jfcm9vdC5jbGFzc0xpc3QuY29udGFpbnMoICdpcy1vcGVuJyApICkge1xuXHRcdFx0XHRhY2Nlc3NpYmxlX2xhYmVsID0gc2VsZWN0b3Jfcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1yZXNvdXJjZS1jYW5jZWxdJyApO1xuXHRcdFx0XHRpZiAoIGFjY2Vzc2libGVfbGFiZWwgKSB7XG5cdFx0XHRcdFx0YWNjZXNzaWJsZV9sYWJlbC5jbGljaygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpc19yZXNvdXJjZV9wYW5lX2NvbGxhcHNlZCA9IG5leHRfY29sbGFwc2VkO1xuXHRcdFx0aWYgKCB0aW1lbGluZV9yb290ICkge1xuXHRcdFx0XHR0aW1lbGluZV9yb290LmNsYXNzTGlzdC50b2dnbGUoICdpcy1yZXNvdXJjZS1wYW5lLWNvbGxhcHNlZCcsIG5leHRfY29sbGFwc2VkICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHJlc291cmNlX3BhbmUgKSB7XG5cdFx0XHRcdGlmICggbmV4dF9jb2xsYXBzZWQgKSB7XG5cdFx0XHRcdFx0cmVzb3VyY2VfcGFuZS5zZXRBdHRyaWJ1dGUoICdhcmlhLWhpZGRlbicsICd0cnVlJyApO1xuXHRcdFx0XHRcdHJlc291cmNlX3BhbmUuc2V0QXR0cmlidXRlKCAnaW5lcnQnLCAnJyApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlc291cmNlX3BhbmUucmVtb3ZlQXR0cmlidXRlKCAnYXJpYS1oaWRkZW4nICk7XG5cdFx0XHRcdFx0cmVzb3VyY2VfcGFuZS5yZW1vdmVBdHRyaWJ1dGUoICdpbmVydCcgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHJlc291cmNlX3BhbmVfdG9nZ2xlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRyZXNvdXJjZV9wYW5lX3RvZ2dsZS5oaWRkZW4gPSAhIGlzX21vYmlsZV9kcmF3ZXIoKTtcblx0XHRcdHJlc291cmNlX3BhbmVfdG9nZ2xlLnNldEF0dHJpYnV0ZSggJ2FyaWEtZXhwYW5kZWQnLCBuZXh0X2NvbGxhcHNlZCA/ICdmYWxzZScgOiAndHJ1ZScgKTtcblx0XHRcdHJlc291cmNlX3BhbmVfdG9nZ2xlLnNldEF0dHJpYnV0ZSggJ2FyaWEtbGFiZWwnLCB0b2dnbGVfbGFiZWwgKTtcblx0XHRcdHJlc291cmNlX3BhbmVfdG9nZ2xlLnNldEF0dHJpYnV0ZSggJ3RpdGxlJywgdG9nZ2xlX2xhYmVsICk7XG5cdFx0XHRhY2Nlc3NpYmxlX2xhYmVsID0gcmVzb3VyY2VfcGFuZV90b2dnbGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2UtcGFuZS10b2dnbGUtbGFiZWxdJyApO1xuXHRcdFx0aWYgKCBhY2Nlc3NpYmxlX2xhYmVsICkge1xuXHRcdFx0XHRhY2Nlc3NpYmxlX2xhYmVsLnRleHRDb250ZW50ID0gdG9nZ2xlX2xhYmVsO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBzaG91bGRfcmVzdG9yZV90b2dnbGVfZm9jdXMgKSB7XG5cdFx0XHRcdHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0aWYgKCByZXNvdXJjZV9wYW5lX3RvZ2dsZSAmJiAhIHJlc291cmNlX3BhbmVfdG9nZ2xlLmhpZGRlbiApIHtcblx0XHRcdFx0XHRcdHJlc291cmNlX3BhbmVfdG9nZ2xlLmZvY3VzKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LCAwICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogS2VlcCB0aGUgZHJhd2VyIGluc2lkZSB0aGUgdmlzdWFsIHZpZXdwb3J0IHdoZW4gem9vbSBvciBhIHNvZnR3YXJlXG5cdFx0ICoga2V5Ym9hcmQgcmVkdWNlcyB0aGUgdXNhYmxlIGxheW91dCB2aWV3cG9ydC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gdXBkYXRlX21vYmlsZV92aWV3cG9ydF9tZXRyaWNzKCkge1xuXHRcdFx0dmFyIHZpZXdwb3J0X2hlaWdodDtcblx0XHRcdHZhciB2aWV3cG9ydF9vZmZzZXRfdG9wO1xuXHRcdFx0dmFyIHZpZXdwb3J0X2JvdHRvbV9pbnNldDtcblxuXHRcdFx0aWYgKCAhIHNlbGVjdG9yX3BhbmVsIHx8ICEgaXNfbW9iaWxlX2RyYXdlcigpICkge1xuXHRcdFx0XHRpZiAoIHNlbGVjdG9yX3BhbmVsICkge1xuXHRcdFx0XHRcdHNlbGVjdG9yX3BhbmVsLnN0eWxlLnJlbW92ZVByb3BlcnR5KCAnLS13cGJjLXRpbWVsaW5lLXJlc291cmNlLW1vYmlsZS12aWV3cG9ydC1oZWlnaHQnICk7XG5cdFx0XHRcdFx0c2VsZWN0b3JfcGFuZWwuc3R5bGUucmVtb3ZlUHJvcGVydHkoICctLXdwYmMtdGltZWxpbmUtcmVzb3VyY2UtbW9iaWxlLWJvdHRvbS1pbnNldCcgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR2aWV3cG9ydF9oZWlnaHQgPSB2aXN1YWxfdmlld3BvcnQgPyB2aXN1YWxfdmlld3BvcnQuaGVpZ2h0IDogd2luZG93LmlubmVySGVpZ2h0O1xuXHRcdFx0dmlld3BvcnRfb2Zmc2V0X3RvcCA9IHZpc3VhbF92aWV3cG9ydCA/IHZpc3VhbF92aWV3cG9ydC5vZmZzZXRUb3AgOiAwO1xuXHRcdFx0dmlld3BvcnRfYm90dG9tX2luc2V0ID0gTWF0aC5tYXgoIDAsIHdpbmRvdy5pbm5lckhlaWdodCAtIHZpZXdwb3J0X2hlaWdodCAtIHZpZXdwb3J0X29mZnNldF90b3AgKTtcblx0XHRcdHNlbGVjdG9yX3BhbmVsLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjLXRpbWVsaW5lLXJlc291cmNlLW1vYmlsZS12aWV3cG9ydC1oZWlnaHQnLCBNYXRoLm1heCggMSwgTWF0aC5mbG9vciggdmlld3BvcnRfaGVpZ2h0ICkgKSArICdweCcgKTtcblx0XHRcdHNlbGVjdG9yX3BhbmVsLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjLXRpbWVsaW5lLXJlc291cmNlLW1vYmlsZS1ib3R0b20taW5zZXQnLCBNYXRoLmZsb29yKCB2aWV3cG9ydF9ib3R0b21faW5zZXQgKSArICdweCcgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTeW5jaHJvbml6ZSByZXNwb25zaXZlIHNlbWFudGljcyB3aXRob3V0IHJlcGxhY2luZyB0aGUgc2hhcmVkIHBvcG92ZXJcblx0XHQgKiBsaWZlY3ljbGUgdGhhdCBvd25zIG9wZW4sIGNsb3NlLCBFc2NhcGUsIGFuZCB0cmlnZ2VyIGZvY3VzIHJlc3RvcmF0aW9uLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzeW5jaHJvbml6ZV9yZXNwb25zaXZlX21vZGUoKSB7XG5cdFx0XHR2YXIgZHJhd2VyX2VuYWJsZWQgPSBpc19tb2JpbGVfZHJhd2VyKCk7XG5cdFx0XHR2YXIgc2VsZWN0b3JfaXNfb3BlbiA9IEJvb2xlYW4oIHNlbGVjdG9yX3Jvb3QgJiYgc2VsZWN0b3Jfcm9vdC5jbGFzc0xpc3QuY29udGFpbnMoICdpcy1vcGVuJyApICk7XG5cdFx0XHR2YXIgZW50ZXJlZF9tb2JpbGVfbGF5b3V0ID0gZHJhd2VyX2VuYWJsZWQgJiYgdHJ1ZSAhPT0gd2FzX21vYmlsZV9sYXlvdXQ7XG5cblx0XHRcdGlmICggISBzZWxlY3Rvcl9yb290IHx8ICEgc2VsZWN0b3JfcGFuZWwgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHNlbGVjdG9yX3Jvb3QuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLW1vYmlsZS1kcmF3ZXInLCBkcmF3ZXJfZW5hYmxlZCApO1xuXHRcdFx0c2VsZWN0b3JfcGFuZWwuc2V0QXR0cmlidXRlKCAnYXJpYS1tb2RhbCcsIGRyYXdlcl9lbmFibGVkID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xuXHRcdFx0c2VsZWN0b3JfcGFuZWwuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXJlc291cmNlLWxheW91dCcsIGRyYXdlcl9lbmFibGVkID8gJ2RyYXdlcicgOiAncG9wb3ZlcicgKTtcblx0XHRcdGlmICggc2VsZWN0b3JfYmFja2Ryb3AgKSB7XG5cdFx0XHRcdHNlbGVjdG9yX2JhY2tkcm9wLmhpZGRlbiA9ICEgZHJhd2VyX2VuYWJsZWQgfHwgISBzZWxlY3Rvcl9pc19vcGVuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBlbnRlcmVkX21vYmlsZV9sYXlvdXQgKSB7XG5cdFx0XHRcdHNldF9yZXNvdXJjZV9wYW5lX2NvbGxhcHNlZCggdHJ1ZSApO1xuXHRcdFx0fSBlbHNlIGlmICggISBkcmF3ZXJfZW5hYmxlZCApIHtcblx0XHRcdFx0c2V0X3Jlc291cmNlX3BhbmVfY29sbGFwc2VkKCBmYWxzZSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c2V0X3Jlc291cmNlX3BhbmVfY29sbGFwc2VkKCBpc19yZXNvdXJjZV9wYW5lX2NvbGxhcHNlZCApO1xuXHRcdFx0fVxuXHRcdFx0d2FzX21vYmlsZV9sYXlvdXQgPSBkcmF3ZXJfZW5hYmxlZDtcblx0XHRcdHVwZGF0ZV9tb2JpbGVfdmlld3BvcnRfbWV0cmljcygpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBlbmFibGVkIGNvbnRyb2xzIHRoYXQgY2FuIHBhcnRpY2lwYXRlIGluIHRoZSBtb2RhbCBkcmF3ZXIgZm9jdXMgbG9vcC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge0hUTUxFbGVtZW50W119IE9yZGVyZWQgZm9jdXNhYmxlIGNvbnRyb2xzLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9kcmF3ZXJfZm9jdXNhYmxlX2NvbnRyb2xzKCkge1xuXHRcdFx0aWYgKCAhIHNlbGVjdG9yX3BhbmVsICkge1xuXHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBBcnJheS5wcm90b3R5cGUuZmlsdGVyLmNhbGwoXG5cdFx0XHRcdHNlbGVjdG9yX3BhbmVsLnF1ZXJ5U2VsZWN0b3JBbGwoICdidXR0b246bm90KFtkaXNhYmxlZF0pLCBpbnB1dDpub3QoW2Rpc2FibGVkXSksIHNlbGVjdDpub3QoW2Rpc2FibGVkXSksIFtocmVmXSwgW3RhYmluZGV4XTpub3QoW3RhYmluZGV4PVwiLTFcIl0pJyApLFxuXHRcdFx0XHRmdW5jdGlvbiAoIGNvbnRyb2wgKSB7XG5cdFx0XHRcdFx0cmV0dXJuICEgY29udHJvbC5oaWRkZW5cblx0XHRcdFx0XHRcdCYmICEgY29udHJvbC5jbG9zZXN0KCAnW2hpZGRlbl0nIClcblx0XHRcdFx0XHRcdCYmICd0cnVlJyAhPT0gY29udHJvbC5nZXRBdHRyaWJ1dGUoICdhcmlhLWhpZGRlbicgKTtcblx0XHRcdFx0fVxuXHRcdFx0KTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBIYW5kbGUgUmVzb3VyY2Ugc2VsZWN0b3IgYW5kIHBhZ2luYXRpb24gYWN0aW9ucyB0aHJvdWdoIG9uZSBsaXN0ZW5lci5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7TW91c2VFdmVudH0gZXZlbnQgRGVsZWdhdGVkIGNsaWNrIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX2NsaWNrKCBldmVudCApIHtcblx0XHRcdHZhciBwYW5lX3RvZ2dsZSA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS1yZXNvdXJjZS1wYW5lLXRvZ2dsZV0nICk7XG5cdFx0XHR2YXIgc2VsZWN0X2FsbF9idXR0b24gPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2Utc2VsZWN0LWFsbF0nICk7XG5cdFx0XHR2YXIgY2xlYXJfYWxsX2J1dHRvbiA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS1yZXNvdXJjZS1jbGVhci1hbGxdJyApO1xuXHRcdFx0dmFyIGFwcGx5X2NvbnRyb2wgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2UtYXBwbHldJyApO1xuXHRcdFx0dmFyIHBhZ2VfY29udHJvbCA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS1yZXNvdXJjZS1wYWdlXScgKTtcblx0XHRcdHZhciBwYWdpbmF0aW9uO1xuXHRcdFx0dmFyIGRpcmVjdGlvbjtcblx0XHRcdHZhciB0YXJnZXRfcGFnZTtcblxuXHRcdFx0aWYgKCBwYW5lX3RvZ2dsZSAmJiBpc19tb2JpbGVfZHJhd2VyKCkgKSB7XG5cdFx0XHRcdHNldF9yZXNvdXJjZV9wYW5lX2NvbGxhcHNlZCggISBpc19yZXNvdXJjZV9wYW5lX2NvbGxhcHNlZCApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICggc2VsZWN0X2FsbF9idXR0b24gJiYgISBpc19zYXZpbmcgJiYgISBpc19tYXRlcmlhbGl6aW5nICkge1xuXHRcdFx0XHRkcmFmdF92aWV3LnNlbGVjdGlvbl9tb2RlID0gYWxsX21vZGU7XG5cdFx0XHRcdGRyYWZ0X3ZpZXcuc2VsZWN0ZWRfaWRzID0gT2JqZWN0LmNyZWF0ZSggbnVsbCApO1xuXHRcdFx0XHRpZiAoIHNlbGVjdG9yX3BhZ2UgKSB7XG5cdFx0XHRcdFx0cmVuZGVyX3NlbGVjdG9yX3BhZ2UoIHNlbGVjdG9yX3BhZ2UgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGNsZWFyX2FsbF9idXR0b24gJiYgISBpc19zYXZpbmcgJiYgISBpc19tYXRlcmlhbGl6aW5nICkge1xuXHRcdFx0XHRkcmFmdF92aWV3LnNlbGVjdGlvbl9tb2RlID0gZXhwbGljaXRfbW9kZTtcblx0XHRcdFx0ZHJhZnRfdmlldy5zZWxlY3RlZF9pZHMgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0XHRcdGlmICggc2VsZWN0b3JfcGFnZSApIHtcblx0XHRcdFx0XHRyZW5kZXJfc2VsZWN0b3JfcGFnZSggc2VsZWN0b3JfcGFnZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggYXBwbHlfY29udHJvbCApIHtcblx0XHRcdFx0aWYgKCBhcHBseV9jb250cm9sLmRpc2FibGVkIHx8IGV4cGxpY2l0X21vZGUgPT09IGRyYWZ0X3ZpZXcuc2VsZWN0aW9uX21vZGUgJiYgISBPYmplY3Qua2V5cyggZHJhZnRfdmlldy5zZWxlY3RlZF9pZHMgKS5sZW5ndGggKSB7XG5cdFx0XHRcdFx0cmVmcmVzaF9zZWxlY3Rpb25fZmVlZGJhY2soKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0c2F2ZV9yZXNvdXJjZV92aWV3KCBidWlsZF9zYXZlX2R0byggd2l0aF9jdXJyZW50X2V4cGFuc2lvbl9zdGF0ZSggZHJhZnRfdmlldyApLCAxICksIHRydWUgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHBhZ2VfY29udHJvbCB8fCBwYWdlX2NvbnRyb2wuZGlzYWJsZWQgfHwgaXNfc2F2aW5nIHx8IGlzX21hdGVyaWFsaXppbmcgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGRpcmVjdGlvbiA9IHBhZ2VfY29udHJvbC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2UtcGFnZScgKTtcblx0XHRcdGlmICggJ3NlbGVjdG9yJyA9PT0gcGFnZV9jb250cm9sLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1yZXNvdXJjZS1wYWdlLWNvbnRleHQnICkgKSB7XG5cdFx0XHRcdHBhZ2luYXRpb24gPSBzZWxlY3Rvcl9wYWdlICYmIHNlbGVjdG9yX3BhZ2Uuc2VsZWN0b3JfcGFnaW5hdGlvbiA/IHNlbGVjdG9yX3BhZ2Uuc2VsZWN0b3JfcGFnaW5hdGlvbiA6IHt9O1xuXHRcdFx0XHR0YXJnZXRfcGFnZSA9IHBvc2l0aXZlX2ludGVnZXIoIHBhZ2luYXRpb24ucGFnZSwgMSApICsgKCAnbmV4dCcgPT09IGRpcmVjdGlvbiA/IDEgOiAtMSApO1xuXHRcdFx0XHRwZW5kaW5nX3BhZ2VfZm9jdXMgPSBkaXJlY3Rpb247XG5cdFx0XHRcdHJlcXVlc3Rfc2VsZWN0b3JfcGFnZSggdGFyZ2V0X3BhZ2UsIHNlYXJjaF9pbnB1dCA/IHNlYXJjaF9pbnB1dC52YWx1ZSA6ICcnICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHBhZ2luYXRpb24gPSByZXNvdXJjZV9wYWdpbmF0aW9uIHx8IHt9O1xuXHRcdFx0dGFyZ2V0X3BhZ2UgPSBwb3NpdGl2ZV9pbnRlZ2VyKCBwYWdpbmF0aW9uLnBhZ2UsIDEgKSArICggJ25leHQnID09PSBkaXJlY3Rpb24gPyAxIDogLTEgKTtcblx0XHRcdHNhdmVfcmVzb3VyY2VfdmlldyggYnVpbGRfc2F2ZV9kdG8oIHdpdGhfY3VycmVudF9leHBhbnNpb25fc3RhdGUoIGNvbW1pdHRlZF92aWV3ICksIHRhcmdldF9wYWdlICksIGZhbHNlICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogVXBkYXRlIGEgY3Jvc3MtcGFnZSBzZWxlY3RvciBkcmFmdCBmcm9tIGEgY2hlY2tib3guXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudCBEZWxlZ2F0ZWQgY2hhbmdlIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX2NoYW5nZSggZXZlbnQgKSB7XG5cdFx0XHR2YXIgY2hlY2tib3ggPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2UtY2hlY2tib3hdJyApO1xuXHRcdFx0dmFyIHNvcnRfY29udHJvbCA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS1yZXNvdXJjZS1zb3J0XScgKTtcblx0XHRcdHZhciBwYWdlX3NpemVfY29udHJvbCA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS1yZXNvdXJjZS1wYWdlLXNpemVdJyApO1xuXHRcdFx0dmFyIHJlcXVlc3RlZF9wYWdlX3NpemU7XG5cdFx0XHR2YXIgcmVzb3VyY2VfaWQ7XG5cdFx0XHR2YXIgcmVzb3VyY2U7XG5cdFx0XHR2YXIgc2VsZWN0aW9uX3Njb3BlX2lkcztcblxuXHRcdFx0aWYgKCBpc19zYXZpbmcgfHwgaXNfbWF0ZXJpYWxpemluZyApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBzb3J0X2NvbnRyb2wgKSB7XG5cdFx0XHRcdGRyYWZ0X3ZpZXcuc29ydF9vcmRlciA9IG5vcm1hbGl6ZV9zb3J0X29yZGVyKCBzb3J0X2NvbnRyb2wudmFsdWUgKTtcblx0XHRcdFx0cGVuZGluZ19wYWdlX2ZvY3VzID0gJyc7XG5cdFx0XHRcdHJlcXVlc3Rfc2VsZWN0b3JfcGFnZSggMSwgc2VhcmNoX2lucHV0ID8gc2VhcmNoX2lucHV0LnZhbHVlIDogJycgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBwYWdlX3NpemVfY29udHJvbCApIHtcblx0XHRcdFx0cmVxdWVzdGVkX3BhZ2Vfc2l6ZSA9IHBvc2l0aXZlX2ludGVnZXIoIHBhZ2Vfc2l6ZV9jb250cm9sLnZhbHVlLCAwICk7XG5cdFx0XHRcdGlmICggLTEgPT09IHBhZ2Vfc2l6ZV9vcHRpb25zLmluZGV4T2YoIHJlcXVlc3RlZF9wYWdlX3NpemUgKSApIHtcblx0XHRcdFx0XHRwYWdlX3NpemVfY29udHJvbC52YWx1ZSA9IFN0cmluZyggZHJhZnRfdmlldy5wZXJfcGFnZSApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRkcmFmdF92aWV3LnBlcl9wYWdlID0gcmVxdWVzdGVkX3BhZ2Vfc2l6ZTtcblx0XHRcdFx0cGVuZGluZ19wYWdlX2ZvY3VzID0gJyc7XG5cdFx0XHRcdHJlcXVlc3Rfc2VsZWN0b3JfcGFnZSggMSwgc2VhcmNoX2lucHV0ID8gc2VhcmNoX2lucHV0LnZhbHVlIDogJycgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIGNoZWNrYm94ICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRyZXNvdXJjZV9pZCA9IHBvc2l0aXZlX2ludGVnZXIoIGNoZWNrYm94LnZhbHVlLCAwICk7XG5cdFx0XHRpZiAoICEgcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHJlc291cmNlID0gKCBzZWxlY3Rvcl9wYWdlICYmIEFycmF5LmlzQXJyYXkoIHNlbGVjdG9yX3BhZ2UucmVzb3VyY2VzICkgPyBzZWxlY3Rvcl9wYWdlLnJlc291cmNlcyA6IFtdICkuZmlsdGVyKCBmdW5jdGlvbiAoIGNhbmRpZGF0ZSApIHtcblx0XHRcdFx0cmV0dXJuIHJlc291cmNlX2lkID09PSBwb3NpdGl2ZV9pbnRlZ2VyKCBjYW5kaWRhdGUuaWQsIDAgKTtcblx0XHRcdH0gKVswXTtcblx0XHRcdGlmICggISByZXNvdXJjZSApIHtcblx0XHRcdFx0Ly8gUmV0YWluIHRoZSBleGFjdC1yb3cgZmFsbGJhY2sgZm9yIGNvbXBhdGliaWxpdHkgd2l0aCBwcmUtdjIgY2FjaGVkIHNlbGVjdG9yIG1hcmt1cC5cblx0XHRcdFx0cmVzb3VyY2UgPSB7IGlkOiByZXNvdXJjZV9pZCwgaXNfZ3JvdXBfY29udHJvbDogZmFsc2UsIHNlbGVjdGlvbl9zY29wZV9pZHM6IFsgcmVzb3VyY2VfaWQgXSB9O1xuXHRcdFx0fVxuXHRcdFx0c2VsZWN0aW9uX3Njb3BlX2lkcyA9IGdldF9yZXNvdXJjZV9zZWxlY3Rpb25fc2NvcGUoIHJlc291cmNlICk7XG5cdFx0XHRpZiAoIGFsbF9tb2RlID09PSBkcmFmdF92aWV3LnNlbGVjdGlvbl9tb2RlICYmICEgY2hlY2tib3guY2hlY2tlZCApIHtcblx0XHRcdFx0Y2hlY2tib3guY2hlY2tlZCA9IHRydWU7XG5cdFx0XHRcdGNoZWNrYm94LmluZGV0ZXJtaW5hdGUgPSBmYWxzZTtcblx0XHRcdFx0bWF0ZXJpYWxpemVfYWxsX2V4Y2VwdCggc2VsZWN0aW9uX3Njb3BlX2lkcyApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRkcmFmdF92aWV3LnNlbGVjdGlvbl9tb2RlID0gZXhwbGljaXRfbW9kZTtcblx0XHRcdHNlbGVjdGlvbl9zY29wZV9pZHMuZm9yRWFjaCggZnVuY3Rpb24gKCBzZWxlY3RlZF9yZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0aWYgKCBjaGVja2JveC5jaGVja2VkICkge1xuXHRcdFx0XHRcdGRyYWZ0X3ZpZXcuc2VsZWN0ZWRfaWRzWyBzZWxlY3RlZF9yZXNvdXJjZV9pZCBdID0gdHJ1ZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRkZWxldGUgZHJhZnRfdmlldy5zZWxlY3RlZF9pZHNbIHNlbGVjdGVkX3Jlc291cmNlX2lkIF07XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdHN5bmNocm9uaXplX3NlbGVjdG9yX2NoZWNrYm94ZXMoKTtcblx0XHRcdHJlZnJlc2hfc2VsZWN0aW9uX2ZlZWRiYWNrKCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRGVib3VuY2Ugc2VsZWN0b3Igc2VhcmNoIHdpdGhvdXQgY2hhbmdpbmcgdGhlIGNyb3NzLXBhZ2UgZHJhZnQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0lucHV0RXZlbnR9IGV2ZW50IERlbGVnYXRlZCBpbnB1dCBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9pbnB1dCggZXZlbnQgKSB7XG5cdFx0XHRpZiAoICEgZXZlbnQudGFyZ2V0Lm1hdGNoZXMoICdbZGF0YS13cGJjLXRpbWVsaW5lLXJlc291cmNlLXNlYXJjaF0nICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIHNlYXJjaF90aW1lciApO1xuXHRcdFx0c2VhcmNoX3RpbWVyID0gd2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmVxdWVzdF9zZWxlY3Rvcl9wYWdlKCAxLCBldmVudC50YXJnZXQudmFsdWUgKTtcblx0XHRcdH0sIE1hdGgubWF4KCAwLCBOdW1iZXIoIGNvbmZpZ3VyYXRpb24uc2VhcmNoX2RlbGF5X21zICkgfHwgMjUwICkgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTdXBwb3J0IGRpcmVjdCBzZWFyY2ggc3VibWlzc2lvbiBhbmQgcHJlZGljdGFibGUgbGlzdCBlbnRyeSBieSBrZXlib2FyZC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7S2V5Ym9hcmRFdmVudH0gZXZlbnQgRGVsZWdhdGVkIGtleSBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9rZXlkb3duKCBldmVudCApIHtcblx0XHRcdHZhciBmaXJzdF9jaGVja2JveDtcblx0XHRcdHZhciBmb2N1c2FibGVfY29udHJvbHM7XG5cdFx0XHR2YXIgZmlyc3RfY29udHJvbDtcblx0XHRcdHZhciBsYXN0X2NvbnRyb2w7XG5cblx0XHRcdGlmIChcblx0XHRcdFx0J1RhYicgPT09IGV2ZW50LmtleVxuXHRcdFx0XHQmJiBpc19tb2JpbGVfZHJhd2VyKClcblx0XHRcdFx0JiYgc2VsZWN0b3Jfcm9vdFxuXHRcdFx0XHQmJiBzZWxlY3Rvcl9yb290LmNsYXNzTGlzdC5jb250YWlucyggJ2lzLW9wZW4nIClcblx0XHRcdCkge1xuXHRcdFx0XHRmb2N1c2FibGVfY29udHJvbHMgPSBnZXRfZHJhd2VyX2ZvY3VzYWJsZV9jb250cm9scygpO1xuXHRcdFx0XHRmaXJzdF9jb250cm9sID0gZm9jdXNhYmxlX2NvbnRyb2xzWzBdO1xuXHRcdFx0XHRsYXN0X2NvbnRyb2wgPSBmb2N1c2FibGVfY29udHJvbHNbIGZvY3VzYWJsZV9jb250cm9scy5sZW5ndGggLSAxIF07XG5cdFx0XHRcdGlmICggZmlyc3RfY29udHJvbCAmJiBsYXN0X2NvbnRyb2wgJiYgZXZlbnQuc2hpZnRLZXkgJiYgZG9jdW1lbnQuYWN0aXZlRWxlbWVudCA9PT0gZmlyc3RfY29udHJvbCApIHtcblx0XHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdGxhc3RfY29udHJvbC5mb2N1cygpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIGZpcnN0X2NvbnRyb2wgJiYgbGFzdF9jb250cm9sICYmICEgZXZlbnQuc2hpZnRLZXkgJiYgZG9jdW1lbnQuYWN0aXZlRWxlbWVudCA9PT0gbGFzdF9jb250cm9sICkge1xuXHRcdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdFx0Zmlyc3RfY29udHJvbC5mb2N1cygpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy10aW1lbGluZS1yZXNvdXJjZS1zZWFyY2hdJyApICYmICdFbnRlcicgPT09IGV2ZW50LmtleSApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0d2luZG93LmNsZWFyVGltZW91dCggc2VhcmNoX3RpbWVyICk7XG5cdFx0XHRcdHJlcXVlc3Rfc2VsZWN0b3JfcGFnZSggMSwgZXZlbnQudGFyZ2V0LnZhbHVlICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggZXZlbnQudGFyZ2V0Lm1hdGNoZXMoICdbZGF0YS13cGJjLXRpbWVsaW5lLXJlc291cmNlLXNlYXJjaF0nICkgJiYgJ0Fycm93RG93bicgPT09IGV2ZW50LmtleSApIHtcblx0XHRcdFx0Zmlyc3RfY2hlY2tib3ggPSBzZWxlY3Rvcl9yb3dzID8gc2VsZWN0b3Jfcm93cy5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1yZXNvdXJjZS1jaGVja2JveF0nICkgOiBudWxsO1xuXHRcdFx0XHRpZiAoIGZpcnN0X2NoZWNrYm94ICkge1xuXHRcdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdFx0Zmlyc3RfY2hlY2tib3guZm9jdXMoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoXG5cdFx0XHRcdGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy10aW1lbGluZS1yZXNvdXJjZS1jaGVja2JveF0nIClcblx0XHRcdFx0JiYgJ0Fycm93VXAnID09PSBldmVudC5rZXlcblx0XHRcdFx0JiYgc2VsZWN0b3Jfcm93c1xuXHRcdFx0XHQmJiBldmVudC50YXJnZXQgPT09IHNlbGVjdG9yX3Jvd3MucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2UtY2hlY2tib3hdJyApXG5cdFx0XHRcdCYmIHNlYXJjaF9pbnB1dFxuXHRcdFx0KSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHNlYXJjaF9pbnB1dC5mb2N1cygpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEZvY3VzIHRoZSBzZWxlY3RvciBzZWFyY2ggYWZ0ZXIgdGhlIHNoYXJlZCBkaXNjbG9zdXJlIG9wZW5zLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtDdXN0b21FdmVudH0gZXZlbnQgU2hhcmVkIFVJIGxheWVyIGxpZmVjeWNsZSBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9sYXllcl9vcGVuKCBldmVudCApIHtcblx0XHRcdGlmICggZXZlbnQuZGV0YWlsICYmIHNlbGVjdG9yX2luc3RhbmNlX2lkID09PSBldmVudC5kZXRhaWwuaW5zdGFuY2VfaWQgKSB7XG5cdFx0XHRcdHN5bmNocm9uaXplX3Jlc3BvbnNpdmVfbW9kZSgpO1xuXHRcdFx0XHRzZXRfc2VsZWN0b3JfbGF5ZXJfc3RhdGUoIHRydWUgKTtcblx0XHRcdFx0b3Blbl9zZWxlY3RvcigpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENhbmNlbCBzZWxlY3Rvci1vbmx5IHJlYWRzIHdoZW4gdGhlIGRpc2Nsb3N1cmUgY2xvc2VzLlxuXHRcdCAqXG5cdFx0ICogU2F2ZS9yZWFkYmFjayByZW1haW5zIG93bmVkIGJ5IGl0cyBpbmRlcGVuZGVudCByZXF1ZXN0IHNvIGNsb3Npbmcgd2l0aFxuXHRcdCAqIEVzY2FwZSBjYW5ub3QgaW50ZXJydXB0IGEgcHJlZmVyZW5jZSB0aGF0IHRoZSBzZXJ2ZXIgbWF5IGhhdmUgY29tbWl0dGVkLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtDdXN0b21FdmVudH0gZXZlbnQgU2hhcmVkIFVJIGxheWVyIGxpZmVjeWNsZSBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9sYXllcl9jbG9zZSggZXZlbnQgKSB7XG5cdFx0XHRpZiAoICEgZXZlbnQuZGV0YWlsIHx8IHNlbGVjdG9yX2luc3RhbmNlX2lkICE9PSBldmVudC5kZXRhaWwuaW5zdGFuY2VfaWQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHNldF9zZWxlY3Rvcl9sYXllcl9zdGF0ZSggZmFsc2UgKTtcblx0XHRcdHNlbGVjdG9yX2dlbmVyYXRpb24gKz0gMTtcblx0XHRcdG1hdGVyaWFsaXphdGlvbl9nZW5lcmF0aW9uICs9IDE7XG5cdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KCBzZWFyY2hfdGltZXIgKTtcblx0XHRcdGlmICggc2VsZWN0b3JfcmVxdWVzdCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygc2VsZWN0b3JfcmVxdWVzdC5hYm9ydCApIHtcblx0XHRcdFx0c2VsZWN0b3JfcmVxdWVzdC5hYm9ydCgpO1xuXHRcdFx0fVxuXHRcdFx0c2VsZWN0b3JfcmVxdWVzdCA9IG51bGw7XG5cdFx0XHRtYXRlcmlhbGl6YXRpb25fcmVxdWVzdHMuZm9yRWFjaCggZnVuY3Rpb24gKCByZXF1ZXN0ICkge1xuXHRcdFx0XHRpZiAoIHJlcXVlc3QgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHJlcXVlc3QuYWJvcnQgKSB7XG5cdFx0XHRcdFx0cmVxdWVzdC5hYm9ydCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRtYXRlcmlhbGl6YXRpb25fcmVxdWVzdHMgPSBbXTtcblx0XHRcdGlzX21hdGVyaWFsaXppbmcgPSBmYWxzZTtcblx0XHRcdGRyYWZ0X3ZpZXcgPSBjbG9uZV9yZXNvdXJjZV92aWV3KCBjb21taXR0ZWRfdmlldyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlZnJlc2ggY2Fub25pY2FsIHZpZXcgYW5kIHBhZ2luYXRpb24gYWZ0ZXIgYSBzZXJ2ZXIgd2luZG93IGNvbW1pdC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZXNvdXJjZV92aWV3IFNlcnZlciBSZXNvdXJjZS12aWV3IERUTy5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcGFnaW5hdGlvbiBTZXJ2ZXIgUmVzb3VyY2UgcGFnaW5hdGlvbiBEVE8uXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZWZyZXNoKCByZXNvdXJjZV92aWV3LCBwYWdpbmF0aW9uICkge1xuXHRcdFx0Y29tbWl0dGVkX3ZpZXcgPSBub3JtYWxpemVfcmVzb3VyY2VfdmlldyggcmVzb3VyY2VfdmlldywgY29uZmlndXJhdGlvbi5kZWZhdWx0X3NlbGVjdG9yX3NpemUgfHwgMjAgKTtcblx0XHRcdGRyYWZ0X3ZpZXcgPSBjbG9uZV9yZXNvdXJjZV92aWV3KCBjb21taXR0ZWRfdmlldyApO1xuXHRcdFx0cGFnZV9zaXplX29wdGlvbnMgPSBub3JtYWxpemVfcGFnZV9zaXplX29wdGlvbnMoXG5cdFx0XHRcdGNvbmZpZ3VyYXRpb24ucGFnZV9zaXplX29wdGlvbnMsXG5cdFx0XHRcdGNvbW1pdHRlZF92aWV3LnBlcl9wYWdlLFxuXHRcdFx0XHRjb25maWd1cmF0aW9uLm1heGltdW1fc2VsZWN0b3Jfc2l6ZVxuXHRcdFx0KTtcblx0XHRcdHJlc291cmNlX3BhZ2luYXRpb24gPSBwYWdpbmF0aW9uICYmICdvYmplY3QnID09PSB0eXBlb2YgcGFnaW5hdGlvbiA/IHBhZ2luYXRpb24gOiB7fTtcblx0XHRcdHNldHRpbmdzLnJlc291cmNlX3ZpZXcgPSByZXNvdXJjZV92aWV3O1xuXHRcdFx0c2V0dGluZ3MucmVzb3VyY2VfcGFnaW5hdGlvbiA9IHJlc291cmNlX3BhZ2luYXRpb247XG5cdFx0XHRpZiAoIHBhZ2Vfc2l6ZV9zZWxlY3QgKSB7XG5cdFx0XHRcdHBhZ2Vfc2l6ZV9zZWxlY3QudmFsdWUgPSBTdHJpbmcoIGNvbW1pdHRlZF92aWV3LnBlcl9wYWdlICk7XG5cdFx0XHR9XG5cdFx0XHRyZWZyZXNoX3NlbGVjdGlvbl9mZWVkYmFjaygpO1xuXHRcdFx0cmVuZGVyX21haW5fcGFnaW5hdGlvbigpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbmRlciB0aGUgc2VsZWN0b3Igc2hlbGwgYW5kIGF0dGFjaCBkZWxlZ2F0ZWQgbW9kdWxlIGxpc3RlbmVycy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaW5pdGlhbGl6ZSgpIHtcblx0XHRcdGlmICggISBtb3VudCB8fCBpc19pbml0aWFsaXplZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0c2VsZWN0b3JfaG9zdCA9IG1vdW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLXJlc291cmNlLXNlbGVjdG9yLWhvc3RdJyApO1xuXHRcdFx0bWFpbl9wYWdpbmF0aW9uX2hvc3QgPSBtb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1yZXNvdXJjZS1tYWluLXBhZ2luYXRpb25dJyApO1xuXHRcdFx0dGltZWxpbmVfcm9vdCA9IG1vdW50Lm1hdGNoZXMgJiYgbW91bnQubWF0Y2hlcyggJy53cGJjX3RpbWVsaW5lJyApID8gbW91bnQgOiBtb3VudC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfdGltZWxpbmUnICk7XG5cdFx0XHRyZXNvdXJjZV9wYW5lID0gbW91bnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2UtcGFuZV0nICk7XG5cdFx0XHRyZXNvdXJjZV9wYW5lX3RvZ2dsZV9ob3N0ID0gbW91bnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2UtcGFuZS10b2dnbGUtaG9zdF0nICk7XG5cdFx0XHRpZiAoIHJlc291cmNlX3BhbmVfdG9nZ2xlX2hvc3QgKSB7XG5cdFx0XHRcdHJlbmRlcl90ZW1wbGF0ZSggcmVzb3VyY2VfcGFuZV90b2dnbGVfaG9zdCwgJ3BhbmVfdG9nZ2xlJywge1xuXHRcdFx0XHRcdHNob3dfbGFiZWw6IGkxOG4uc2hvd19yZXNvdXJjZV9wYW5lbCxcblx0XHRcdFx0XHRoaWRlX2xhYmVsOiBpMThuLmhpZGVfcmVzb3VyY2VfcGFuZWxcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRyZXNvdXJjZV9wYW5lX3RvZ2dsZSA9IHJlc291cmNlX3BhbmVfdG9nZ2xlX2hvc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2UtcGFuZS10b2dnbGVdJyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHNlbGVjdG9yX2hvc3QgfHwgISByZW5kZXJfdGVtcGxhdGUoIHNlbGVjdG9yX2hvc3QsICdzZWxlY3RvcicsIHtcblx0XHRcdFx0dHJpZ2dlcl9sYWJlbDogZ2V0X3RyaWdnZXJfbGFiZWwoKSxcblx0XHRcdFx0c2VsZWN0ZWRfbGFiZWw6IGludGVycG9sYXRlKCBpMThuLnNlbGVjdGVkX2NvdW50LCB7IGNvdW50OiBnZXRfc2VsZWN0ZWRfY291bnQoKSB9ICksXG5cdFx0XHRcdHNvcnRfb3JkZXI6IGNvbW1pdHRlZF92aWV3LnNvcnRfb3JkZXIsXG5cdFx0XHRcdHNvcnRfb3B0aW9uczogQXJyYXkuaXNBcnJheSggY29uZmlndXJhdGlvbi5zb3J0X29wdGlvbnMgKSA/IGNvbmZpZ3VyYXRpb24uc29ydF9vcHRpb25zIDogW10sXG5cdFx0XHRcdHBlcl9wYWdlOiBjb21taXR0ZWRfdmlldy5wZXJfcGFnZSxcblx0XHRcdFx0cGFnZV9zaXplX29wdGlvbnM6IHBhZ2Vfc2l6ZV9vcHRpb25zLFxuXHRcdFx0XHRpMThuOiBpMThuXG5cdFx0XHR9ICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHNlbGVjdG9yX3Jvb3QgPSBzZWxlY3Rvcl9ob3N0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXNoYXJlZC11aS1wb3BvdmVyXScgKTtcblx0XHRcdHNlbGVjdG9yX3BhbmVsID0gc2VsZWN0b3JfaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1yZXNvdXJjZS1zZWxlY3Rvci1wYW5lbF0nICk7XG5cdFx0XHRzZWxlY3Rvcl9iYWNrZHJvcCA9IHNlbGVjdG9yX2hvc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2UtZHJhd2VyLWJhY2tkcm9wXScgKTtcblx0XHRcdHJlc291cmNlX2hlYWRlciA9IHNlbGVjdG9yX3Jvb3QgJiYgc2VsZWN0b3Jfcm9vdC5jbG9zZXN0ID8gc2VsZWN0b3Jfcm9vdC5jbG9zZXN0KCAnLndwYmNfdGltZWxpbmVfX3Jlc291cmNlX2hlYWRlcicgKSA6IG51bGw7XG5cdFx0XHRzZWxlY3Rvcl9yb3dzID0gc2VsZWN0b3JfaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1yZXNvdXJjZS1zZWxlY3Rvci1yb3dzXScgKTtcblx0XHRcdHNlbGVjdG9yX3BhZ2luYXRpb25faG9zdCA9IHNlbGVjdG9yX2hvc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2Utc2VsZWN0b3ItcGFnaW5hdGlvbl0nICk7XG5cdFx0XHRzZWxlY3Rvcl9zdGF0dXMgPSBzZWxlY3Rvcl9ob3N0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLXJlc291cmNlLXNlbGVjdG9yLXN0YXR1c10nICk7XG5cdFx0XHRzZWxlY3Rvcl9zdGF0dXNfbWVzc2FnZSA9IHNlbGVjdG9yX2hvc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2Utc2VsZWN0b3Itc3RhdHVzLW1lc3NhZ2VdJyApO1xuXHRcdFx0c2VsZWN0b3Jfc3Bpbm5lciA9IHNlbGVjdG9yX2hvc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2Utc2VsZWN0b3Itc3Bpbm5lcl0nICk7XG5cdFx0XHR2YWxpZGF0aW9uID0gc2VsZWN0b3JfaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1yZXNvdXJjZS12YWxpZGF0aW9uXScgKTtcblx0XHRcdHZhbGlkYXRpb25fbWVzc2FnZSA9IHNlbGVjdG9yX2hvc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2UtdmFsaWRhdGlvbi1tZXNzYWdlXScgKTtcblx0XHRcdGFwcGx5X2J1dHRvbiA9IHNlbGVjdG9yX2hvc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2UtYXBwbHldJyApO1xuXHRcdFx0c2VhcmNoX2lucHV0ID0gc2VsZWN0b3JfaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1yZXNvdXJjZS1zZWFyY2hdJyApO1xuXHRcdFx0c29ydF9zZWxlY3QgPSBzZWxlY3Rvcl9ob3N0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLXJlc291cmNlLXNvcnRdJyApO1xuXHRcdFx0cGFnZV9zaXplX3NlbGVjdCA9IHNlbGVjdG9yX2hvc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2UtcGFnZS1zaXplXScgKTtcblx0XHRcdG1vYmlsZV9kcmF3ZXJfbWVkaWEgPSB3aW5kb3cubWF0Y2hNZWRpYSA/IHdpbmRvdy5tYXRjaE1lZGlhKCAnKG1heC13aWR0aDogNzgycHgpJyApIDogbnVsbDtcblx0XHRcdG1vdW50LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGhhbmRsZV9jbGljayApO1xuXHRcdFx0bW91bnQuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIGhhbmRsZV9jaGFuZ2UgKTtcblx0XHRcdG1vdW50LmFkZEV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIGhhbmRsZV9pbnB1dCApO1xuXHRcdFx0bW91bnQuYWRkRXZlbnRMaXN0ZW5lciggJ2tleWRvd24nLCBoYW5kbGVfa2V5ZG93biApO1xuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6c2hhcmVkLXVpLWxheWVyLW9wZW4nLCBoYW5kbGVfbGF5ZXJfb3BlbiApO1xuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6c2hhcmVkLXVpLWxheWVyLWNsb3NlJywgaGFuZGxlX2xheWVyX2Nsb3NlICk7XG5cdFx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ3Jlc2l6ZScsIHVwZGF0ZV9tb2JpbGVfdmlld3BvcnRfbWV0cmljcyApO1xuXHRcdFx0aWYgKCBtb2JpbGVfZHJhd2VyX21lZGlhICkge1xuXHRcdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiBtb2JpbGVfZHJhd2VyX21lZGlhLmFkZEV2ZW50TGlzdGVuZXIgKSB7XG5cdFx0XHRcdFx0bW9iaWxlX2RyYXdlcl9tZWRpYS5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgc3luY2hyb25pemVfcmVzcG9uc2l2ZV9tb2RlICk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiBtb2JpbGVfZHJhd2VyX21lZGlhLmFkZExpc3RlbmVyICkge1xuXHRcdFx0XHRcdG1vYmlsZV9kcmF3ZXJfbWVkaWEuYWRkTGlzdGVuZXIoIHN5bmNocm9uaXplX3Jlc3BvbnNpdmVfbW9kZSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHZpc3VhbF92aWV3cG9ydCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgdmlzdWFsX3ZpZXdwb3J0LmFkZEV2ZW50TGlzdGVuZXIgKSB7XG5cdFx0XHRcdHZpc3VhbF92aWV3cG9ydC5hZGRFdmVudExpc3RlbmVyKCAncmVzaXplJywgdXBkYXRlX21vYmlsZV92aWV3cG9ydF9tZXRyaWNzICk7XG5cdFx0XHRcdHZpc3VhbF92aWV3cG9ydC5hZGRFdmVudExpc3RlbmVyKCAnc2Nyb2xsJywgdXBkYXRlX21vYmlsZV92aWV3cG9ydF9tZXRyaWNzICk7XG5cdFx0XHR9XG5cdFx0XHRpc19pbml0aWFsaXplZCA9IHRydWU7XG5cdFx0XHRzeW5jaHJvbml6ZV9yZXNwb25zaXZlX21vZGUoKTtcblx0XHRcdHJlZnJlc2hfc2VsZWN0aW9uX2ZlZWRiYWNrKCk7XG5cdFx0XHRyZW5kZXJfbWFpbl9wYWdpbmF0aW9uKCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQWJvcnQgcmVxdWVzdHMsIHRpbWVycywgYW5kIGxpc3RlbmVycyBvd25lZCBieSB0aGlzIG1vZHVsZS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZGVzdHJveSgpIHtcblx0XHRcdGlmICggISBpc19pbml0aWFsaXplZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0c2VsZWN0b3JfZ2VuZXJhdGlvbiArPSAxO1xuXHRcdFx0bWF0ZXJpYWxpemF0aW9uX2dlbmVyYXRpb24gKz0gMTtcblx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIHNlYXJjaF90aW1lciApO1xuXHRcdFx0c2V0X3NlbGVjdG9yX2xheWVyX3N0YXRlKCBmYWxzZSApO1xuXHRcdFx0aWYgKCBzZWxlY3Rvcl9yZXF1ZXN0ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBzZWxlY3Rvcl9yZXF1ZXN0LmFib3J0ICkge1xuXHRcdFx0XHRzZWxlY3Rvcl9yZXF1ZXN0LmFib3J0KCk7XG5cdFx0XHR9XG5cdFx0XHRtYXRlcmlhbGl6YXRpb25fcmVxdWVzdHMuZm9yRWFjaCggZnVuY3Rpb24gKCByZXF1ZXN0ICkge1xuXHRcdFx0XHRpZiAoIHJlcXVlc3QgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHJlcXVlc3QuYWJvcnQgKSB7XG5cdFx0XHRcdFx0cmVxdWVzdC5hYm9ydCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRtb3VudC5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2xpY2snLCBoYW5kbGVfY2xpY2sgKTtcblx0XHRcdG1vdW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBoYW5kbGVfY2hhbmdlICk7XG5cdFx0XHRtb3VudC5yZW1vdmVFdmVudExpc3RlbmVyKCAnaW5wdXQnLCBoYW5kbGVfaW5wdXQgKTtcblx0XHRcdG1vdW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywgaGFuZGxlX2tleWRvd24gKTtcblx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICd3cGJjOnNoYXJlZC11aS1sYXllci1vcGVuJywgaGFuZGxlX2xheWVyX29wZW4gKTtcblx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICd3cGJjOnNoYXJlZC11aS1sYXllci1jbG9zZScsIGhhbmRsZV9sYXllcl9jbG9zZSApO1xuXHRcdFx0d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdyZXNpemUnLCB1cGRhdGVfbW9iaWxlX3ZpZXdwb3J0X21ldHJpY3MgKTtcblx0XHRcdGlmICggbW9iaWxlX2RyYXdlcl9tZWRpYSApIHtcblx0XHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgbW9iaWxlX2RyYXdlcl9tZWRpYS5yZW1vdmVFdmVudExpc3RlbmVyICkge1xuXHRcdFx0XHRcdG1vYmlsZV9kcmF3ZXJfbWVkaWEucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIHN5bmNocm9uaXplX3Jlc3BvbnNpdmVfbW9kZSApO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgbW9iaWxlX2RyYXdlcl9tZWRpYS5yZW1vdmVMaXN0ZW5lciApIHtcblx0XHRcdFx0XHRtb2JpbGVfZHJhd2VyX21lZGlhLnJlbW92ZUxpc3RlbmVyKCBzeW5jaHJvbml6ZV9yZXNwb25zaXZlX21vZGUgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCB2aXN1YWxfdmlld3BvcnQgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHZpc3VhbF92aWV3cG9ydC5yZW1vdmVFdmVudExpc3RlbmVyICkge1xuXHRcdFx0XHR2aXN1YWxfdmlld3BvcnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3Jlc2l6ZScsIHVwZGF0ZV9tb2JpbGVfdmlld3BvcnRfbWV0cmljcyApO1xuXHRcdFx0XHR2aXN1YWxfdmlld3BvcnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3Njcm9sbCcsIHVwZGF0ZV9tb2JpbGVfdmlld3BvcnRfbWV0cmljcyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBzZWxlY3Rvcl9wYW5lbCApIHtcblx0XHRcdFx0c2VsZWN0b3JfcGFuZWwuc3R5bGUucmVtb3ZlUHJvcGVydHkoICctLXdwYmMtdGltZWxpbmUtcmVzb3VyY2UtbW9iaWxlLXZpZXdwb3J0LWhlaWdodCcgKTtcblx0XHRcdFx0c2VsZWN0b3JfcGFuZWwuc3R5bGUucmVtb3ZlUHJvcGVydHkoICctLXdwYmMtdGltZWxpbmUtcmVzb3VyY2UtbW9iaWxlLWJvdHRvbS1pbnNldCcgKTtcblx0XHRcdFx0c2VsZWN0b3JfcGFuZWwuc2V0QXR0cmlidXRlKCAnYXJpYS1tb2RhbCcsICdmYWxzZScgKTtcblx0XHRcdFx0c2VsZWN0b3JfcGFuZWwuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXJlc291cmNlLWxheW91dCcsICdwb3BvdmVyJyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBzZWxlY3Rvcl9yb290ICkge1xuXHRcdFx0XHRzZWxlY3Rvcl9yb290LmNsYXNzTGlzdC5yZW1vdmUoICdpcy1tb2JpbGUtZHJhd2VyJyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBzZWxlY3Rvcl9iYWNrZHJvcCApIHtcblx0XHRcdFx0c2VsZWN0b3JfYmFja2Ryb3AuaGlkZGVuID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggdGltZWxpbmVfcm9vdCApIHtcblx0XHRcdFx0dGltZWxpbmVfcm9vdC5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtcmVzb3VyY2UtcGFuZS1jb2xsYXBzZWQnICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHJlc291cmNlX3BhbmUgKSB7XG5cdFx0XHRcdHJlc291cmNlX3BhbmUucmVtb3ZlQXR0cmlidXRlKCAnYXJpYS1oaWRkZW4nICk7XG5cdFx0XHRcdHJlc291cmNlX3BhbmUucmVtb3ZlQXR0cmlidXRlKCAnaW5lcnQnICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHJlc291cmNlX3BhbmVfdG9nZ2xlICkge1xuXHRcdFx0XHRyZXNvdXJjZV9wYW5lX3RvZ2dsZS5oaWRkZW4gPSB0cnVlO1xuXHRcdFx0XHRyZXNvdXJjZV9wYW5lX3RvZ2dsZS5zZXRBdHRyaWJ1dGUoICdhcmlhLWV4cGFuZGVkJywgJ3RydWUnICk7XG5cdFx0XHR9XG5cdFx0XHR3YXNfbW9iaWxlX2xheW91dCA9IG51bGw7XG5cdFx0XHRpc19yZXNvdXJjZV9wYW5lX2NvbGxhcHNlZCA9IGZhbHNlO1xuXHRcdFx0aXNfaW5pdGlhbGl6ZWQgPSBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0aW5pdGlhbGl6ZTogaW5pdGlhbGl6ZSxcblx0XHRcdHJlZnJlc2g6IHJlZnJlc2gsXG5cdFx0XHRkZXN0cm95OiBkZXN0cm95XG5cdFx0fTtcblx0fVxuXG5cdGlmICggd2luZG93LndwYmNfdGltZWxpbmVfbW9kdWxlcyAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfdGltZWxpbmVfbW9kdWxlcy5yZWdpc3Rlcl9mYWN0b3J5ICkge1xuXHRcdHdpbmRvdy53cGJjX3RpbWVsaW5lX21vZHVsZXMucmVnaXN0ZXJfZmFjdG9yeSggbW9kdWxlX2lkLCBjcmVhdGVfcmVzb3VyY2VfbmF2aWdhdGlvbiApO1xuXHR9XG59KCB3aW5kb3csIGRvY3VtZW50LCB3aW5kb3cud3AgKSApO1xuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0UsV0FBV0EsTUFBTSxFQUFFQyxRQUFRLEVBQUVDLEVBQUUsRUFBRztFQUNuQyxZQUFZOztFQUVaLElBQUlDLFNBQVMsR0FBRyxxQkFBcUI7RUFDckMsSUFBSUMsUUFBUSxHQUFHLEtBQUs7RUFDcEIsSUFBSUMsYUFBYSxHQUFHLFVBQVU7RUFDOUIsSUFBSUMsb0JBQW9CLEdBQUcsaUNBQWlDO0VBQzVELElBQUlDLGtCQUFrQixHQUFHLFVBQVU7RUFDbkMsSUFBSUMsbUJBQW1CLEdBQUcsQ0FBRSxVQUFVLEVBQUUsV0FBVyxFQUFFLFlBQVksRUFBRSxRQUFRLEVBQUUsU0FBUyxD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
