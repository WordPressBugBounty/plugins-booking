"use strict";

/**
 * Control shared request sequences and render normalized catalog responses.
 *
 * Domain scripts provide configuration and domain-specific interactions. This
 * controller owns only allow-listed WP templates, shared response validation,
 * loading, empty, populated, error, and stale-response mechanics.
 *
 * @since 11.6.0
 */
(function (window, document) {
  'use strict';

  var catalog_states = {};

  /**
   * Return a normalized non-negative request sequence.
   *
   * @param {*} sequence Candidate request sequence.
   * @return {number|null} Sequence or null when malformed.
   */
  function normalize_sequence(sequence) {
    var normalized_sequence;
    if ('number' === typeof sequence && isFinite(sequence) && Math.floor(sequence) === sequence) {
      normalized_sequence = sequence;
    } else if ('string' === typeof sequence && /^\d+$/.test(sequence)) {
      normalized_sequence = parseInt(sequence, 10);
    } else {
      return null;
    }
    return 0 <= normalized_sequence ? normalized_sequence : null;
  }

  /**
   * Return a supported positive response schema version.
   *
   * WordPress localizes top-level scalar values as strings, so the registered
   * configuration may contain "1" while the nested response retains number 1.
   *
   * @param {*} schema_version Candidate schema version.
   * @return {number|null} Supported version or null.
   */
  function normalize_schema_version(schema_version) {
    var normalized_version = normalize_sequence(schema_version);
    return 1 === normalized_version ? normalized_version : null;
  }

  /**
   * Return one catalog's request state.
   *
   * @param {string} catalog_id Registered catalog identifier.
   * @return {Object|null} Mutable catalog state or null.
   */
  function get_catalog_state(catalog_id) {
    if (!catalog_id || 'string' !== typeof catalog_id) {
      return null;
    }
    if (!catalog_states[catalog_id]) {
      catalog_states[catalog_id] = {
        actions_controller: null,
        abort_controller: null,
        config: null,
        content_element: null,
        latest_sequence: 0,
        preference_abort_controller: null,
        preference_revision: 0,
        request_values: {},
        search_timer: 0,
        selection_controller: null,
        sortable: null
      };
    }
    return catalog_states[catalog_id];
  }

  /**
   * Return the registered, bounded delay for an incremental search request.
   *
   * Search timing is a domain-neutral interaction mechanic. Catalogs may tune
   * the delay through their server-normalized configuration without replacing
   * the shared request controller.
   *
   * @param {Object} config Registered browser configuration.
   * @return {number} Delay in milliseconds between zero and 2000.
   */
  function get_search_debounce_delay(config) {
    var search_config = config && config.search && 'object' === typeof config.search ? config.search : {};
    var debounce_delay = Number(search_config.debounce_delay_ms);
    if (!isFinite(debounce_delay) || debounce_delay < 0) {
      return 300;
    }
    return Math.min(2000, Math.floor(debounce_delay));
  }

  /**
   * Determine whether clearing search bypasses the incremental-search delay.
   *
   * Immediate clear remains the compatibility default. A catalog may disable
   * it only through server-normalized, domain-neutral search configuration.
   *
   * @param {Object} config Registered browser configuration.
   * @return {boolean} True when Clear must request unfiltered results now.
   */
  function is_immediate_search_clear_enabled(config) {
    return !config || !config.search || false !== config.search.immediate_clear;
  }

  /**
   * Start a new request sequence for one catalog.
   *
   * @param {string} catalog_id Registered catalog identifier.
   * @return {number} New sequence, or zero for an invalid catalog.
   */
  function next_request_sequence(catalog_id) {
    var catalog_state = get_catalog_state(catalog_id);
    if (!catalog_state) {
      return 0;
    }
    catalog_state.latest_sequence += 1;
    return catalog_state.latest_sequence;
  }

  /**
   * Determine whether a response belongs to an older request.
   *
   * @param {string} catalog_id Registered catalog identifier.
   * @param {*}      sequence   Response request sequence.
   * @return {boolean} True when the response must not render.
   */
  function is_stale_response(catalog_id, sequence) {
    var catalog_state = get_catalog_state(catalog_id);
    var normalized_sequence = normalize_sequence(sequence);
    return !catalog_state || null === normalized_sequence || normalized_sequence < catalog_state.latest_sequence;
  }

  /**
   * Resolve one allow-listed template identifier from the configuration.
   *
   * @param {Object} config        Registered browser configuration.
   * @param {string} template_role Template role such as empty or error.
   * @return {string} Template identifier or an empty string.
   */
  function get_template_id(config, template_role) {
    var catalog_state;
    var initial_request;
    var template_id = '';
    var template_pack;
    var template_pack_id;
    if (!config || !config.templates || 'string' !== typeof template_role) {
      return '';
    }
    if ('string' === typeof config.templates[template_role]) {
      template_id = config.templates[template_role];
    }
    catalog_state = config.catalog_id || config.id ? get_catalog_state(config.catalog_id || config.id) : null;
    initial_request = config.initial_request || {};
    template_pack_id = catalog_state && catalog_state.request_values.template_pack ? catalog_state.request_values.template_pack : initial_request.template_pack;
    template_pack = config.template_packs && config.template_packs[template_pack_id];
    if (template_pack && 'string' === typeof template_pack[template_role]) {
      template_id = template_pack[template_role];
    }
    return /^[a-z0-9_-]+$/.test(template_id) ? template_id : '';
  }

  /**
   * Synchronize one server-authoritative allow-listed presentation pack.
   *
   * The active pack is shared presentation state only. Updating it before an
   * items template is resolved allows an AJAX response to switch markup while
   * leaving the provider, DTO, authorization, and mutation paths unchanged.
   *
   * @param {Object} config           Registered browser configuration.
   * @param {*}      template_pack_id Candidate pack identifier from a response.
   * @return {string} Active allow-listed pack identifier.
   */
  function set_active_template_pack(config, template_pack_id) {
    var catalog_root;
    var catalog_state = config && config.catalog_id ? get_catalog_state(config.catalog_id) : null;
    var normalized_pack_id = 'string' === typeof template_pack_id ? template_pack_id : '';
    if (!catalog_state || !config.template_packs || !config.template_packs[normalized_pack_id]) {
      normalized_pack_id = config && config.default_template_pack && config.template_packs && config.template_packs[config.default_template_pack] ? config.default_template_pack : '';
    }
    if (!normalized_pack_id) {
      return '';
    }
    catalog_state.request_values.template_pack = normalized_pack_id;
    catalog_root = catalog_state.content_element ? catalog_state.content_element.closest('[data-wpbc-catalog-id]') : null;
    if (catalog_root) {
      catalog_root.setAttribute('data-wpbc-template-pack', normalized_pack_id);
    }
    return normalized_pack_id;
  }

  /**
   * Compile one allow-listed WordPress template.
   *
   * @param {Object} config        Registered browser configuration.
   * @param {string} template_role Template role.
   * @return {Function|null} Compiled template or null.
   */
  function load_template(config, template_role) {
    var template_id = get_template_id(config, template_role);
    if (!template_id || !window.wp || 'function' !== typeof window.wp.template) {
      return null;
    }
    try {
      return window.wp.template(template_id);
    } catch (error) {
      return null;
    }
  }

  /**
   * Replace one catalog's current presentation with rendered template output.
   *
   * @param {Object} config        Registered browser configuration.
   * @param {string} template_role Allow-listed template role.
   * @param {Object} template_data Normalized template data.
   * @return {boolean} True when rendered.
   */
  function render_template(config, template_role, template_data) {
    var catalog_root;
    var catalog_state = get_catalog_state(config.catalog_id);
    var render_target;
    var rendered_html;
    var template = load_template(config, template_role);
    if (!catalog_state || !catalog_state.content_element || !template) {
      return false;
    }
    try {
      rendered_html = template(template_data || {});
    } catch (error) {
      return false;
    }
    render_target = catalog_state.response_element || catalog_state.content_element;
    dispatch_catalog_event(config, 'wpbc:ui-catalog-before-render', {
      catalog_id: config.catalog_id,
      template_role: template_role
    });
    render_target.innerHTML = rendered_html;
    catalog_root = catalog_state.content_element.parentNode;
    if (catalog_root && 'function' === typeof catalog_root.setAttribute) {
      catalog_root.setAttribute('aria-busy', 'shell' === template_role ? 'true' : 'false');
    }
    if ('shell' !== template_role) {
      set_catalog_loading_state(config, false);
    }
    return true;
  }

  /**
   * Toggle a persistent catalog overlay without removing the current rows.
   *
   * Catalogs with a dedicated overlay keep their existing table visible beneath
   * the Booking Calendar spinner. Generic catalogs retain the shell-template
   * fallback when no overlay is declared.
   *
   * @param {Object}  config     Registered browser configuration.
   * @param {boolean} is_loading Whether a request is active.
   * @return {boolean} True when a persistent overlay was updated.
   */
  function set_catalog_loading_state(config, is_loading) {
    var catalog_state = config && config.catalog_id ? get_catalog_state(config.catalog_id) : null;
    var loading_element = catalog_state ? catalog_state.loading_element : null;
    if (catalog_state && catalog_state.content_element) {
      catalog_state.content_element.setAttribute('aria-busy', is_loading ? 'true' : 'false');
    }
    if (!loading_element) {
      return false;
    }
    loading_element.classList.toggle('is-visible', !!is_loading);
    return true;
  }

  /**
   * Set the table minimum width from currently visible header contracts.
   *
   * Domain styles declare `--wpbc-listing-column-min-width` per column. The
   * shared controller sums only rendered headers so wide/custom views scroll
   * horizontally while short presets continue filling the available panel.
   *
   * @param {Object} config Registered browser configuration.
   * @return {void}
   */
  function sync_catalog_table_min_width(config) {
    var mount_element = config && config.mount_id ? document.getElementById(config.mount_id) : null;
    var table = mount_element ? mount_element.querySelector('.wpbc_ui_listing__table--catalog') : null;
    var header_cells;
    var table_min_width = 0;
    if (!table || 'function' !== typeof window.getComputedStyle) {
      return;
    }
    header_cells = Array.prototype.filter.call(table.querySelectorAll('thead > tr > th'), function (header_cell) {
      return !header_cell.hidden;
    });
    header_cells.forEach(function (header_cell) {
      var column_min_width = parseFloat(window.getComputedStyle(header_cell).getPropertyValue('--wpbc-listing-column-min-width'));
      if (isFinite(column_min_width) && 0 < column_min_width) {
        table_min_width += column_min_width;
      }
    });
    if (0 < table_min_width) {
      table.style.setProperty('--wpbc-listing-table-min-width', Math.ceil(table_min_width) + 'px');
    }
  }

  /**
   * Keep the open column customizer inside the usable browser viewport.
   *
   * @param {HTMLDetailsElement} customizer Column customizer details element.
   * @return {void}
   */
  function position_display_panel(customizer) {
    var panel = customizer ? customizer.querySelector('.wpbc_ui_listing__display_panel') : null;
    var summary = customizer ? customizer.querySelector('summary') : null;
    var field_list = customizer ? customizer.querySelector('[data-wpbc-ui-catalog-column-list]') : null;
    var summary_rect;
    var panel_rect;
    var viewport_width;
    var viewport_height;
    var margin = 12;
    var gap = 6;
    var space_above;
    var space_below;
    var natural_height;
    var open_above;
    var available_height;
    var rendered_height;
    var panel_left;
    var panel_top;
    if (!customizer || !customizer.open || !panel || !summary) {
      return;
    }
    customizer.classList.remove('is-positioned');
    panel.style.removeProperty('--wpbc-listing-display-panel-max-height');
    panel.style.removeProperty('left');
    panel.style.removeProperty('top');
    summary_rect = summary.getBoundingClientRect();
    panel_rect = panel.getBoundingClientRect();
    viewport_width = document.documentElement.clientWidth || window.innerWidth || 0;
    viewport_height = window.innerHeight || document.documentElement.clientHeight || 0;
    space_above = Math.max(0, summary_rect.top - margin - gap);
    space_below = Math.max(0, viewport_height - summary_rect.bottom - margin - gap);
    natural_height = panel.scrollHeight;
    if (field_list) {
      natural_height += Math.max(0, field_list.scrollHeight - field_list.clientHeight);
    }
    open_above = space_below < natural_height && space_above > space_below;
    available_height = open_above ? space_above : space_below;
    customizer.classList.toggle('is-open-above', open_above);
    panel.style.setProperty('--wpbc-listing-display-panel-max-height', Math.floor(available_height) + 'px');
    rendered_height = panel.getBoundingClientRect().height;
    panel_left = Math.max(margin, Math.min(summary_rect.right - panel_rect.width, viewport_width - panel_rect.width - margin));
    panel_top = open_above ? summary_rect.top - gap - rendered_height : summary_rect.bottom + gap;
    panel_top = Math.max(margin, Math.min(panel_top, viewport_height - rendered_height - margin));
    panel.style.setProperty('left', Math.round(panel_left) + 'px');
    panel.style.setProperty('top', Math.round(panel_top) + 'px');
    customizer.classList.add('is-positioned');
  }

  /**
   * Clear fixed column-panel coordinates after the customizer closes.
   *
   * @param {HTMLDetailsElement} customizer Column customizer details element.
   * @return {void}
   */
  function reset_display_panel_position(customizer) {
    var panel = customizer ? customizer.querySelector('.wpbc_ui_listing__display_panel') : null;
    if (!customizer || !panel) {
      return;
    }
    customizer.classList.remove('is-open-above', 'is-positioned');
    panel.style.removeProperty('--wpbc-listing-display-panel-max-height');
    panel.style.removeProperty('left');
    panel.style.removeProperty('top');
  }

  /**
   * Close one column customizer and optionally return focus to its summary.
   *
   * Keyboard and explicit Close-button dismissal restore focus to the control
   * that opened the panel. Pointer dismissal keeps the pointer's natural focus
   * destination while sharing the same details-toggle cleanup path.
   *
   * @param {HTMLDetailsElement|null} customizer    Column customizer details element.
   * @param {boolean}                 restore_focus Whether summary focus is restored.
   * @return {void}
   */
  function close_display_customizer(customizer, restore_focus) {
    var summary;
    if (!customizer || !customizer.open) {
      return;
    }
    customizer.open = false;
    if (!restore_focus) {
      return;
    }
    summary = customizer.querySelector('summary');
    if (summary && 'function' === typeof summary.focus) {
      summary.focus();
    }
  }

  /**
   * Render a generic safe browser error.
   *
   * @param {Object} config  Registered browser configuration.
   * @param {string} message Safe localized error message.
   * @return {boolean} True when rendered.
   */
  function render_error(config, message) {
    var i18n = config.i18n || {};
    return render_template(config, 'error', {
      title: i18n.error_title || '',
      message: message || i18n.error_message || ''
    });
  }

  /**
   * Dispatch one shared catalog lifecycle event from the current mount.
   *
   * @param {Object} config     Registered browser configuration.
   * @param {string} event_name Stable shared event name.
   * @param {Object} detail     JSON-safe event detail.
   * @return {boolean} True when the event was dispatched.
   */
  function dispatch_catalog_event(config, event_name, detail) {
    var catalog_event;
    var catalog_state = get_catalog_state(config.catalog_id);
    if (!catalog_state || !catalog_state.content_element || 'string' !== typeof event_name) {
      return false;
    }
    if ('function' === typeof window.CustomEvent) {
      catalog_event = new window.CustomEvent(event_name, {
        bubbles: true,
        detail: detail || {}
      });
    } else {
      catalog_event = document.createEvent('CustomEvent');
      catalog_event.initCustomEvent(event_name, true, false, detail || {});
    }
    catalog_state.content_element.dispatchEvent(catalog_event);
    return true;
  }

  /**
   * Append one normalized request value to a URL-encoded AJAX body.
   *
   * @param {URLSearchParams} request_body  Request body receiving values.
   * @param {string}          request_key   Normalized request key.
   * @param {*}               request_value Scalar or scalar-array value.
   * @return {void}
   */
  function append_request_value(request_body, request_key, request_value) {
    if (Array.isArray(request_value)) {
      request_value.forEach(function (array_value) {
        if (null !== array_value && 'object' !== typeof array_value) {
          request_body.append(request_key + '[]', String(array_value));
        }
      });
      return;
    }
    if (null !== request_value && 'undefined' !== typeof request_value && 'object' !== typeof request_value) {
      request_body.append(request_key, String(request_value));
    }
  }

  /**
   * Return ordered column IDs from the current display controls.
   *
   * @param {HTMLElement} mount_element Catalog mount element.
   * @return {string[]} Current column order.
   */
  function get_column_order(mount_element) {
    return Array.prototype.slice.call(mount_element.querySelectorAll('[data-wpbc-ui-catalog-column-item]')).map(function (column_item) {
      return column_item.getAttribute('data-wpbc-ui-catalog-column-item') || '';
    }).filter(function (column_id) {
      return !!column_id;
    });
  }

  /**
   * Return visible column IDs from the current display controls.
   *
   * @param {HTMLElement} mount_element Catalog mount element.
   * @return {string[]} Current visible columns.
   */
  function get_visible_columns(mount_element) {
    return Array.prototype.slice.call(mount_element.querySelectorAll('[data-wpbc-ui-catalog-column-visible]')).filter(function (column_control) {
      return column_control.checked;
    }).map(function (column_control) {
      return column_control.value;
    });
  }

  /**
   * Request the current column controls and persist the validated result.
   *
   * @param {Object}      config        Registered browser configuration.
   * @param {HTMLElement} mount_element Catalog mount element.
   * @return {Promise<boolean>} Shared request result.
   */
  function save_column_controls(config, mount_element) {
    var view_control = mount_element.querySelector('[data-wpbc-ui-catalog-view]');
    if (view_control) {
      view_control.value = 'custom';
    }
    return request_catalog(config, {
      column_order: get_column_order(mount_element),
      page_number: 1,
      preference_action: 'save',
      visible_columns: get_visible_columns(mount_element)
    });
  }

  /**
   * Announce a completed column-order change to assistive technology.
   *
   * @param {Object}      config        Registered browser configuration.
   * @param {HTMLElement} mount_element Catalog mount element.
   * @return {void}
   */
  function announce_column_moved(config, mount_element) {
    var status_element = mount_element.querySelector('[data-wpbc-ui-catalog-column-status]');
    if (!status_element) {
      return;
    }
    status_element.textContent = '';
    window.setTimeout(function () {
      status_element.textContent = config.i18n && config.i18n.column_moved ? config.i18n.column_moved : '';
    }, 0);
  }

  /**
   * Synchronize the current catalog state into the initial URL aliases.
   *
   * Search and page number remain request-local but survive a normal refresh
   * through the URL. Persisted settings are also reflected for shareable state.
   *
   * @param {Object} config   Registered browser configuration.
   * @param {Object} response Normalized successful response.
   * @return {void}
   */
  function update_url_state(config, response) {
    var filters = response.filters || {};
    var parameters = config.url_parameters || {};
    var state_values = {
      page_number: response.pagination.page_number,
      items_per_page: response.pagination.items_per_page,
      sort_by: response.sorting.sort_by,
      sort_order: response.sorting.sort_order,
      search: filters.search || '',
      visible_columns: response.display.visible_columns || [],
      column_order: response.display.column_order || [],
      template_pack: response.display.template_pack || ''
    };
    var page_url;
    if (!window.history || 'function' !== typeof window.history.replaceState || 'function' !== typeof window.URL) {
      return;
    }
    page_url = new window.URL(window.location.href);
    Object.keys(filters).forEach(function (filter_key) {
      state_values[filter_key] = filters[filter_key];
    });
    Object.keys(parameters).forEach(function (state_key) {
      var parameter_name = parameters[state_key];
      var state_value = state_values[state_key];
      if (!parameter_name) {
        return;
      }
      if (Array.isArray(state_value)) {
        state_value = state_value.join(',');
      }
      if ('' === state_value || null === state_value || 'undefined' === typeof state_value) {
        page_url.searchParams.delete(parameter_name);
      } else {
        page_url.searchParams.set(parameter_name, String(state_value));
      }
    });
    window.history.replaceState({}, document.title, page_url.toString());
  }

  /**
   * Bind domain-neutral delegated catalog controls once per mount.
   *
   * @param {Object}      config        Registered browser configuration.
   * @param {HTMLElement} mount_element Catalog mount element.
   * @return {void}
   */
  function bind_catalog_controls(config, mount_element) {
    var catalog_state = get_catalog_state(config.catalog_id);
    if (!catalog_state || mount_element._wpbc_ui_catalog_controls_bound) {
      return;
    }
    mount_element._wpbc_ui_catalog_controls_bound = true;
    mount_element.addEventListener('submit', function (event) {
      var search_control;
      if (!event.target.matches('[data-wpbc-ui-catalog-filters]')) {
        return;
      }
      event.preventDefault();
      search_control = mount_element.querySelector('[data-wpbc-ui-catalog-search]');
      request_catalog(config, {
        page_number: 1,
        search: search_control ? search_control.value : ''
      });
    });
    mount_element.addEventListener('input', function (event) {
      var clear_control;
      if (!event.target.matches('[data-wpbc-ui-catalog-search]')) {
        return;
      }
      clear_control = mount_element.querySelector('[data-wpbc-ui-catalog-search-clear]');
      if (clear_control) {
        clear_control.hidden = !event.target.value;
      }
      window.clearTimeout(catalog_state.search_timer);
      catalog_state.search_timer = window.setTimeout(function () {
        request_catalog(config, {
          page_number: 1,
          search: event.target.value || ''
        });
      }, get_search_debounce_delay(config));
    });
    mount_element.addEventListener('change', function (event) {
      var default_request = config.default_request || {};
      var filter_key;
      if (event.target.matches('[data-wpbc-ui-catalog-items-per-page]')) {
        request_catalog(config, {
          items_per_page: Number(event.target.value),
          page_number: 1,
          preference_action: 'save'
        });
      } else if (event.target.matches('[data-wpbc-ui-catalog-page-number]')) {
        request_catalog(config, {
          page_number: Number(event.target.value) || 1
        });
      } else if (event.target.matches('[data-wpbc-ui-catalog-template-pack]')) {
        if (config.template_packs && config.template_packs[event.target.value]) {
          request_catalog(config, {
            page_number: 1,
            preference_action: 'save',
            template_pack: event.target.value
          });
        }
      } else if (event.target.matches('[data-wpbc-ui-catalog-filter]')) {
        filter_key = event.target.getAttribute('data-wpbc-ui-catalog-filter') || '';
        if (/^[a-z0-9_]+$/.test(filter_key)) {
          var filter_request = {
            page_number: 1,
            preference_action: 'save'
          };
          filter_request[filter_key] = event.target.value;
          request_catalog(config, filter_request);
        }
      } else if (event.target.matches('[data-wpbc-ui-catalog-column-visible]')) {
        save_column_controls(config, mount_element);
      } else if (event.target.matches('[data-wpbc-ui-catalog-view]') && 'custom' !== event.target.value) {
        var view_definition = config.views && config.views.definitions ? config.views.definitions[event.target.value] : null;
        if (view_definition && Array.isArray(view_definition.fields)) {
          request_catalog(config, {
            page_number: 1,
            preference_action: 'save',
            visible_columns: view_definition.fields
          });
        }
      }
    });
    mount_element.addEventListener('click', function (event) {
      var close_control = event.target.closest('[data-wpbc-ui-catalog-display-close]');
      var default_request = config.default_request || {};
      var page_control = event.target.closest('[data-wpbc-ui-catalog-page]');
      var reset_control = event.target.closest('[data-wpbc-ui-catalog-preferences-reset]');
      var reset_order_control = event.target.closest('[data-wpbc-ui-catalog-column-order-reset]');
      var search_clear = event.target.closest('[data-wpbc-ui-catalog-search-clear]');
      var sort_control = event.target.closest('[data-wpbc-ui-catalog-sort]');
      var sort_key;
      if (search_clear) {
        event.preventDefault();
        var search_control = mount_element.querySelector('[data-wpbc-ui-catalog-search]');
        window.clearTimeout(catalog_state.search_timer);
        if (search_control) {
          search_control.value = '';
          search_control.focus();
        }
        search_clear.hidden = true;
        if (is_immediate_search_clear_enabled(config)) {
          request_catalog(config, {
            page_number: 1,
            search: ''
          });
        } else {
          catalog_state.search_timer = window.setTimeout(function () {
            request_catalog(config, {
              page_number: 1,
              search: ''
            });
          }, get_search_debounce_delay(config));
        }
      } else if (sort_control) {
        event.preventDefault();
        sort_key = sort_control.getAttribute('data-wpbc-ui-catalog-sort') || '';
        request_catalog(config, {
          page_number: 1,
          preference_action: 'save',
          sort_by: sort_key,
          sort_order: sort_key === catalog_state.request_values.sort_by && 'asc' === catalog_state.request_values.sort_order ? 'desc' : 'asc'
        });
      } else if (page_control && !page_control.disabled) {
        event.preventDefault();
        request_catalog(config, {
          page_number: Number(page_control.getAttribute('data-wpbc-ui-catalog-page')) || 1
        });
      } else if (reset_order_control) {
        event.preventDefault();
        request_catalog(config, {
          column_order: default_request.column_order || [],
          page_number: 1,
          preference_action: 'save'
        });
      } else if (reset_control) {
        event.preventDefault();
        request_catalog(config, Object.assign({}, default_request, {
          preference_action: 'reset'
        }));
      } else if (close_control) {
        event.preventDefault();
        var customizer = close_control.closest('[data-wpbc-ui-catalog-display-customizer]');
        close_display_customizer(customizer, true);
      }
    });
    mount_element.addEventListener('keydown', function (event) {
      var customizer = event.target && 'function' === typeof event.target.closest ? event.target.closest('[data-wpbc-ui-catalog-display-customizer]') : null;
      if ('Escape' !== event.key || !customizer || !customizer.open) {
        return;
      }
      event.preventDefault();
      close_display_customizer(customizer, true);
    });
    mount_element.addEventListener('toggle', function (event) {
      var customizer = event.target.closest('[data-wpbc-ui-catalog-display-customizer]');
      if (!customizer) {
        return;
      }
      if (customizer.open) {
        window.requestAnimationFrame(function () {
          position_display_panel(customizer);
        });
      } else {
        reset_display_panel_position(customizer);
      }
    }, true);
    document.addEventListener('click', function (event) {
      var customizer = mount_element.querySelector('[data-wpbc-ui-catalog-display-customizer]');
      if (customizer && customizer.open && !customizer.contains(event.target)) {
        close_display_customizer(customizer, false);
      }
    });
    window.addEventListener('resize', function () {
      position_display_panel(mount_element.querySelector('[data-wpbc-ui-catalog-display-customizer]'));
      sync_catalog_table_min_width(config);
    });
    window.addEventListener('scroll', function (event) {
      var customizer = mount_element.querySelector('[data-wpbc-ui-catalog-display-customizer]');
      if (customizer && customizer.open && (!event.target || 'function' !== typeof event.target.closest || !event.target.closest('[data-wpbc-ui-catalog-display-customizer]'))) {
        position_display_panel(customizer);
      }
    }, true);
  }

  /**
   * Initialize pointer and keyboard column ordering after toolbar rendering.
   *
   * @param {Object} config Registered browser configuration.
   * @return {void}
   */
  function refresh_catalog_controls(config) {
    var catalog_state = get_catalog_state(config.catalog_id);
    var mount_element = document.getElementById(config.mount_id);
    var column_list = mount_element ? mount_element.querySelector('[data-wpbc-ui-catalog-column-list]') : null;
    if (!catalog_state || !column_list || column_list._wpbc_ui_catalog_initialized) {
      return;
    }
    column_list._wpbc_ui_catalog_initialized = true;
    column_list.addEventListener('keydown', function (event) {
      var handle = event.target.closest('[data-wpbc-ui-catalog-column-drag-handle]');
      var item;
      var sibling;
      if (!handle || 'ArrowUp' !== event.key && 'ArrowDown' !== event.key) {
        return;
      }
      item = handle.closest('[data-wpbc-ui-catalog-column-item]');
      sibling = 'ArrowUp' === event.key ? item.previousElementSibling : item.nextElementSibling;
      while (sibling && '1' !== sibling.getAttribute('data-wpbc-ui-catalog-column-reorderable')) {
        sibling = 'ArrowUp' === event.key ? sibling.previousElementSibling : sibling.nextElementSibling;
      }
      if (!sibling) {
        return;
      }
      event.preventDefault();
      if ('ArrowUp' === event.key) {
        column_list.insertBefore(item, sibling);
      } else {
        column_list.insertBefore(sibling, item);
      }
      save_column_controls(config, mount_element);
      announce_column_moved(config, mount_element);
      handle.focus();
    });
    if ('function' === typeof window.Sortable) {
      catalog_state.sortable = new window.Sortable(column_list, {
        animation: 150,
        chosenClass: 'is-dragging',
        draggable: '[data-wpbc-ui-catalog-column-reorderable="1"]',
        ghostClass: 'is-drag-placeholder',
        handle: '[data-wpbc-ui-catalog-column-drag-handle]',
        onEnd: function (sort_event) {
          if (sort_event.oldIndex !== sort_event.newIndex) {
            save_column_controls(config, mount_element);
            announce_column_moved(config, mount_element);
          }
        }
      });
    }
  }

  /**
   * Validate a normalized server response before rendering.
   *
   * @param {Object} config   Registered browser configuration.
   * @param {*}      response Candidate response.
   * @return {boolean} True when the response contract is supported.
   */
  function validate_response(config, response) {
    var configured_schema_version = config ? normalize_schema_version(config.schema_version) : null;
    var response_schema_version = response ? normalize_schema_version(response.schema_version) : null;
    if (!config || !response || 'object' !== typeof response || response.catalog_id !== config.catalog_id || null === configured_schema_version || response_schema_version !== configured_schema_version || 'boolean' !== typeof response.success || null === normalize_sequence(response.request_id)) {
      return false;
    }
    if (false === response.success) {
      return !!response.error && 'object' === typeof response.error && 'string' === typeof response.error.code && 'string' === typeof response.error.message && 'boolean' === typeof response.error.retryable;
    }
    return Array.isArray(response.items) && !!response.pagination && 'object' === typeof response.pagination && !!response.sorting && 'object' === typeof response.sorting && !!response.filters && 'object' === typeof response.filters && !!response.display && 'object' === typeof response.display && !!response.hierarchy && 'object' === typeof response.hierarchy && !!response.capabilities && 'object' === typeof response.capabilities && Array.isArray(response.messages);
  }

  /**
   * Refresh optional shared hierarchy mechanics after domain rows are mounted.
   *
   * The rendered lifecycle event runs synchronously first so a domain adapter
   * can compose its WP row templates before the controller indexes node DOM.
   *
   * @param {Object} config   Registered browser configuration.
   * @param {Object} response Normalized current response.
   * @return {boolean} Whether hierarchy behavior is active.
   */
  function refresh_catalog_hierarchy(config, response) {
    var catalog_state = config && config.catalog_id ? get_catalog_state(config.catalog_id) : null;
    return !!(catalog_state && catalog_state.hierarchy_controller && 'function' === typeof catalog_state.hierarchy_controller.refresh && catalog_state.hierarchy_controller.refresh(response && response.hierarchy ? response.hierarchy : {}));
  }

  /**
   * Render a current normalized response and ignore stale sequences.
   *
   * @param {Object} config           Registered browser configuration.
   * @param {*}      response         Candidate normalized response.
   * @param {*}      request_sequence Sequence assigned when the request began.
   * @return {boolean} True when the response changed the catalog.
   */
  function render_response(config, response, request_sequence) {
    var catalog_state;
    var i18n;
    var items_template_data;
    var response_sequence = response && normalize_sequence(response.request_id);
    var normalized_sequence = normalize_sequence(request_sequence);
    if (!config || !config.catalog_id) {
      return false;
    }
    catalog_state = get_catalog_state(config.catalog_id);
    if (!catalog_state || null === normalized_sequence || null === response_sequence || response_sequence !== normalized_sequence || is_stale_response(config.catalog_id, normalized_sequence)) {
      return false;
    }
    if (!validate_response(config, response)) {
      return render_error(config, config.i18n && config.i18n.error_message ? config.i18n.error_message : '');
    }
    if (false === response.success) {
      return render_error(config, response.error.message);
    }
    set_active_template_pack(config, response.display.template_pack);
    i18n = config.i18n || {};
    if (0 === response.items.length) {
      var is_empty_rendered = render_template(config, 'empty', {
        title: i18n.empty_title || '',
        message: i18n.empty_message || ''
      });
      if (is_empty_rendered) {
        dispatch_catalog_event(config, 'wpbc:ui-catalog-rendered', {
          catalog_id: config.catalog_id,
          request_sequence: normalized_sequence,
          response: response
        });
        refresh_catalog_hierarchy(config, response);
      }
      return is_empty_rendered;
    }
    items_template_data = Object.assign({}, response, {
      i18n: i18n
    });
    if (!render_template(config, 'items', items_template_data)) {
      return render_error(config, i18n.error_message || '');
    }
    dispatch_catalog_event(config, 'wpbc:ui-catalog-rendered', {
      catalog_id: config.catalog_id,
      request_sequence: normalized_sequence,
      response: response
    });
    refresh_catalog_hierarchy(config, response);
    sync_catalog_table_min_width(config);
    return true;
  }

  /**
   * Request and render one normalized catalog response.
   *
   * Request cancellation and sequence checks are shared mechanics. Catalog
   * scripts supply only normalized request values and respond to lifecycle
   * events after the allow-listed items template is mounted.
   *
   * @param {Object} config         Registered browser configuration.
   * @param {Object} request_values Normalized request overrides.
   * @return {Promise<boolean>} Whether a current response was rendered.
   */
  function request_catalog(config, request_values) {
    var catalog_state;
    var persistent_request_values;
    var preference_action;
    var request_body;
    var request_sequence;
    var request_url;
    if (!config || !config.catalog_id || !config.ajax_url || !config.action || !config.nonce || 'function' !== typeof window.fetch) {
      return Promise.resolve(render_error(config || {}, config && config.i18n ? config.i18n.error_message : ''));
    }
    catalog_state = get_catalog_state(config.catalog_id);
    if (!catalog_state) {
      return Promise.resolve(false);
    }
    if (catalog_state.abort_controller && 'function' === typeof catalog_state.abort_controller.abort) {
      catalog_state.abort_controller.abort();
    }
    catalog_state.abort_controller = 'function' === typeof window.AbortController ? new window.AbortController() : null;
    persistent_request_values = Object.assign({}, request_values || {});
    preference_action = persistent_request_values.preference_action || '';
    delete persistent_request_values.preference_action;
    catalog_state.request_values = Object.assign({}, config.initial_request || {}, catalog_state.request_values || {}, persistent_request_values);
    request_sequence = next_request_sequence(config.catalog_id);
    catalog_state.request_values.request_id = request_sequence;
    if (!set_catalog_loading_state(config, true)) {
      render_template(config, 'shell', {
        catalog_id: config.catalog_id,
        aria_label: config.i18n && config.i18n.catalog_label ? config.i18n.catalog_label : '',
        loading_message: config.i18n && config.i18n.loading ? config.i18n.loading : ''
      });
    }
    dispatch_catalog_event(config, 'wpbc:ui-catalog-loading', {
      catalog_id: config.catalog_id,
      request_sequence: request_sequence
    });
    request_body = new window.URLSearchParams();
    request_body.append('action', config.action);
    request_body.append('nonce', config.nonce);
    if (preference_action) {
      catalog_state.preference_revision = Math.max(Date.now(), catalog_state.preference_revision + 1);
      request_body.append('preference_action', preference_action);
      request_body.append('preference_revision', String(catalog_state.preference_revision));
    }
    Object.keys(catalog_state.request_values).forEach(function (request_key) {
      append_request_value(request_body, request_key, catalog_state.request_values[request_key]);
    });
    request_url = String(config.ajax_url);
    return window.fetch(request_url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      body: request_body.toString(),
      signal: catalog_state.abort_controller ? catalog_state.abort_controller.signal : undefined
    }).then(function (response) {
      return response.text().then(function (response_text) {
        var response_payload = null;
        try {
          response_payload = JSON.parse(response_text);
        } catch (error) {
          response_payload = null;
        }
        if (is_stale_response(config.catalog_id, request_sequence)) {
          return false;
        }
        if (!response_payload) {
          return render_error(config, config.i18n && config.i18n.error_message ? config.i18n.error_message : '');
        }
        var is_rendered = render_response(config, response_payload, request_sequence);
        if (is_rendered && response_payload.success) {
          catalog_state.request_values = Object.assign({}, catalog_state.request_values, {
            page_number: response_payload.pagination.page_number,
            items_per_page: response_payload.pagination.items_per_page,
            sort_by: response_payload.sorting.sort_by,
            sort_order: response_payload.sorting.sort_order,
            search: response_payload.filters.search || '',
            visible_columns: response_payload.display.visible_columns || [],
            column_order: response_payload.display.column_order || [],
            template_pack: response_payload.display.template_pack || ''
          });
          Object.keys(response_payload.filters || {}).forEach(function (filter_key) {
            catalog_state.request_values[filter_key] = response_payload.filters[filter_key];
          });
          update_url_state(config, response_payload);
        }
        return is_rendered;
      });
    }).catch(function (error) {
      if (error && 'AbortError' === error.name) {
        return false;
      }
      if (is_stale_response(config.catalog_id, request_sequence)) {
        return false;
      }
      return render_error(config, config.i18n && config.i18n.error_message ? config.i18n.error_message : '');
    });
  }

  /**
   * Persist validated presentation preferences without rebuilding catalog rows.
   *
   * Domain catalogs may add their own scalar preference values to the shared
   * request state. The endpoint remains responsible for validation and
   * authorization. A separate abort slot prevents a disclosure-state save from
   * cancelling an active list request or showing the catalog loading overlay.
   *
   * @param {Object} config            Registered browser configuration.
   * @param {Object} preference_values Shared or domain-owned request values.
   * @return {Promise<boolean>} Whether the current preference request succeeded.
   */
  function save_catalog_preferences(config, preference_values) {
    var catalog_state;
    var request_body;
    var request_revision;
    if (!config || !config.catalog_id || !config.ajax_url || !config.action || !config.nonce || 'function' !== typeof window.fetch) {
      return Promise.resolve(false);
    }
    catalog_state = get_catalog_state(config.catalog_id);
    if (!catalog_state) {
      return Promise.resolve(false);
    }
    if (catalog_state.preference_abort_controller && 'function' === typeof catalog_state.preference_abort_controller.abort) {
      catalog_state.preference_abort_controller.abort();
    }
    catalog_state.preference_abort_controller = 'function' === typeof window.AbortController ? new window.AbortController() : null;
    catalog_state.request_values = Object.assign({}, config.initial_request || {}, catalog_state.request_values || {}, preference_values || {});
    catalog_state.preference_revision = Math.max(Date.now(), catalog_state.preference_revision + 1);
    request_revision = catalog_state.preference_revision;
    request_body = new window.URLSearchParams();
    request_body.append('action', config.action);
    request_body.append('nonce', config.nonce);
    request_body.append('preference_action', 'save');
    request_body.append('preference_revision', String(request_revision));
    request_body.append('preferences_only', '1');
    Object.keys(catalog_state.request_values).forEach(function (request_key) {
      append_request_value(request_body, request_key, catalog_state.request_values[request_key]);
    });
    return window.fetch(String(config.ajax_url), {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      body: request_body.toString(),
      signal: catalog_state.preference_abort_controller ? catalog_state.preference_abort_controller.signal : undefined
    }).then(function (response) {
      return response.text().then(function (response_text) {
        var response_payload = null;
        try {
          response_payload = JSON.parse(response_text);
        } catch (error) {
          response_payload = null;
        }
        return request_revision === catalog_state.preference_revision && response.ok && !!response_payload && true === response_payload.success;
      });
    }).catch(function (error) {
      return false;
    });
  }

  /**
   * Remove the keyboard focus proxy previously owned by one overflow tooltip.
   *
   * Overflow text may live inside an existing interactive control. The helper
   * reuses that control's focus instead of inserting a nested tab stop, and it
   * must release the proxy before rebuilding or destroying the Tippy instance.
   *
   * @param {HTMLElement} text_element Overflow-tooltip text element.
   * @return {void}
   */
  function clear_overflow_tooltip_focus_proxy(text_element) {
    var focus_proxy = text_element && text_element._wpbc_ui_catalog_overflow_focus_proxy;
    if (!focus_proxy) {
      return;
    }
    focus_proxy.owner.removeEventListener('focus', focus_proxy.show);
    focus_proxy.owner.removeEventListener('blur', focus_proxy.hide);
    delete text_element._wpbc_ui_catalog_overflow_focus_proxy;
  }

  /**
   * Find an existing interactive ancestor that can own keyboard tooltip focus.
   *
   * @param {HTMLElement} text_element Overflow-tooltip text element.
   * @return {HTMLElement|null} Existing focus owner, or null when the helper
   *                            should make the text itself keyboard focusable.
   */
  function get_overflow_tooltip_focus_owner(text_element) {
    var focus_owner;
    if (!text_element || 'function' !== typeof text_element.closest) {
      return null;
    }
    focus_owner = text_element.closest(['a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])', 'select:not([disabled])', 'textarea:not([disabled])', 'summary', '[contenteditable="true"]', '[tabindex]:not([tabindex="-1"])'].join(', '));
    return focus_owner && focus_owner !== text_element ? focus_owner : null;
  }

  /**
   * Return the bounded pointer delay requested by one overflow-tooltip owner.
   *
   * For focus-enabled tooltips, keyboard focus remains immediate. The value
   * configures only Tippy's pointer-hover delay and is bounded so a malformed
   * template attribute cannot make authorized text effectively unreachable.
   *
   * @param {HTMLElement} text_element Overflow-tooltip text element.
   * @return {number} Pointer show delay in milliseconds between zero and 2000.
   */
  function get_overflow_tooltip_pointer_delay(text_element) {
    var delay_attribute = text_element ? text_element.getAttribute('data-wpbc-ui-catalog-overflow-tooltip-delay-ms') || '' : '';
    if (!/^\d+$/.test(delay_attribute)) {
      return 0;
    }
    return Math.min(2000, parseInt(delay_attribute, 10));
  }

  /**
   * Report whether one overflow tooltip is intentionally pointer-only.
   *
   * Some text is nested in a control whose accessible name already exposes the
   * complete value. Those templates can keep the visual hover aid without
   * reopening it when the owning control receives focus for another action.
   *
   * @param {HTMLElement} text_element Overflow-tooltip text element.
   * @return {boolean} True when keyboard focus must not activate this tooltip.
   */
  function is_overflow_tooltip_pointer_only(text_element) {
    return Boolean(text_element && 'pointer-only' === text_element.getAttribute('data-wpbc-ui-catalog-overflow-tooltip-focus'));
  }

  /**
   * Reuse an existing interactive ancestor for keyboard tooltip activation.
   *
   * Pointer hover remains scoped to the clipped text itself. Keyboard users
   * receive the same full-text Tippy when the existing owner receives focus,
   * without invalid nested controls or an extra stop in the tab order.
   *
   * @param {HTMLElement} text_element Overflow-tooltip text element.
   * @return {boolean} True when an ancestor focus proxy was registered.
   */
  function bind_overflow_tooltip_focus_proxy(text_element) {
    var focus_owner = get_overflow_tooltip_focus_owner(text_element);
    var show_tooltip;
    var hide_tooltip;
    clear_overflow_tooltip_focus_proxy(text_element);
    if (is_overflow_tooltip_pointer_only(text_element) || !focus_owner || !text_element._tippy) {
      return false;
    }
    show_tooltip = function () {
      if (text_element._tippy && 'function' === typeof text_element._tippy.show) {
        text_element._tippy.show();
      }
    };
    hide_tooltip = function () {
      if (text_element._tippy && 'function' === typeof text_element._tippy.hide) {
        text_element._tippy.hide();
      }
    };
    focus_owner.addEventListener('focus', show_tooltip);
    focus_owner.addEventListener('blur', hide_tooltip);
    text_element._wpbc_ui_catalog_overflow_focus_proxy = {
      owner: focus_owner,
      show: show_tooltip,
      hide: hide_tooltip
    };
    if (document.activeElement === focus_owner) {
      show_tooltip();
    }
    return true;
  }

  /**
   * Add full-text tooltips only to catalog text that is visually clipped.
   *
   * The helper owns the domain-neutral overflow measurement, keyboard focus,
   * Booking Calendar tooltip initialization, and native-title fallback. Domain
   * templates opt in by providing authorized plain text through the
   * `data-wpbc-ui-catalog-overflow-tooltip` attribute.
   *
   * @param {HTMLElement} catalog_mount Catalog mount element.
   * @return {void}
   */
  function synchronize_overflow_tooltips(catalog_mount) {
    var has_overflowing_text = false;
    var tooltip_selector;
    if (!catalog_mount) {
      return;
    }
    catalog_mount.querySelectorAll('[data-wpbc-ui-catalog-overflow-tooltip]').forEach(function (text_element) {
      var full_text = text_element.getAttribute('data-wpbc-ui-catalog-overflow-tooltip') || '';
      var static_title = text_element.getAttribute('data-wpbc-ui-catalog-static-title') || '';
      var focus_owner;
      var is_overflowing = text_element.scrollWidth > text_element.clientWidth + 1 || text_element.scrollHeight > text_element.clientHeight + 1;
      clear_overflow_tooltip_focus_proxy(text_element);
      if (text_element._tippy && 'function' === typeof text_element._tippy.destroy) {
        text_element._tippy.destroy();
      }
      text_element.classList.remove('tooltip_top', 'wpbc_ui_listing__overflow_tooltip');
      text_element.removeAttribute('title');
      text_element.removeAttribute('data-original-title');
      if ('1' === text_element.getAttribute('data-wpbc-ui-catalog-tooltip-tabindex')) {
        text_element.removeAttribute('tabindex');
        text_element.removeAttribute('data-wpbc-ui-catalog-tooltip-tabindex');
      }
      if (full_text && is_overflowing) {
        focus_owner = get_overflow_tooltip_focus_owner(text_element);
        text_element.setAttribute('data-original-title', full_text);
        text_element.classList.add('tooltip_top', 'wpbc_ui_listing__overflow_tooltip');
        if (!is_overflow_tooltip_pointer_only(text_element) && !focus_owner && !text_element.hasAttribute('tabindex')) {
          text_element.setAttribute('tabindex', '0');
          text_element.setAttribute('data-wpbc-ui-catalog-tooltip-tabindex', '1');
        }
        has_overflowing_text = true;
      } else if (static_title) {
        text_element.setAttribute('title', static_title);
      }
    });
    tooltip_selector = catalog_mount.id ? '#' + catalog_mount.id + ' .wpbc_ui_listing__overflow_tooltip' : '';
    if (has_overflowing_text && tooltip_selector && 'function' === typeof window.wpbc_define_tippy_tooltips && window.wpbc_define_tippy_tooltips(tooltip_selector)) {
      catalog_mount.querySelectorAll('.wpbc_ui_listing__overflow_tooltip').forEach(function (text_element) {
        var pointer_delay = get_overflow_tooltip_pointer_delay(text_element);
        if (0 < pointer_delay && text_element._tippy && 'function' === typeof text_element._tippy.setProps) {
          text_element._tippy.setProps({
            delay: [pointer_delay, 0]
          });
        }
        bind_overflow_tooltip_focus_proxy(text_element);
      });
      return;
    }
    catalog_mount.querySelectorAll('.wpbc_ui_listing__overflow_tooltip').forEach(function (text_element) {
      text_element.setAttribute('title', text_element.getAttribute('data-original-title') || '');
    });
  }

  /**
   * Create a domain-neutral native inspector state workflow.
   *
   * Domains supply their allow-listed shell renderer, host/footer boundaries,
   * localized shell data, and sidebar expansion callback. The shared workflow
   * owns only shell mounting and the empty, loading, error, and form states.
   *
   * @param {Object} settings Inspector boundary callbacks and shell data.
   * @return {Object|false} Inspector workflow controller or false when invalid.
   */
  function create_inspector_workflow(settings) {
    var options = Object.assign({
      expand: null,
      get_footer: null,
      get_host: null,
      render_shell: null,
      shell_data: {}
    }, settings || {});
    if ('function' !== typeof options.get_host || 'function' !== typeof options.render_shell) {
      return false;
    }

    /**
     * Return the current domain-owned inspector host.
     *
     * @return {Element|null} Inspector host or null when it is unavailable.
     */
    function get_host() {
      var host = options.get_host();
      return host && host.querySelector ? host : null;
    }

    /**
     * Return the current domain-owned sticky footer when configured.
     *
     * @return {Element|null} Inspector footer or null when it is unavailable.
     */
    function get_footer() {
      var footer = 'function' === typeof options.get_footer ? options.get_footer() : null;
      return footer && footer.querySelector ? footer : null;
    }

    /**
     * Mount the allow-listed shared shell inside the domain host once.
     *
     * @return {boolean} True when the inspector shell is available.
     */
    function mount() {
      var host = get_host();
      var rendered_shell;
      if (!host) {
        return false;
      }
      if (!host.querySelector('[data-wpbc-ui-catalog-inspector]')) {
        try {
          rendered_shell = options.render_shell(Object.assign({}, options.shell_data || {}));
        } catch (error) {
          return false;
        }
        if ('string' !== typeof rendered_shell || !rendered_shell) {
          return false;
        }
        host.innerHTML = rendered_shell;
      }
      return !!host.querySelector('[data-wpbc-ui-catalog-inspector]');
    }

    /**
     * Synchronize one allow-listed inspector presentation state.
     *
     * @param {string} state   Empty, loading, error, or form.
     * @param {string} message Optional safe error message.
     * @return {boolean} True when the mounted shell was updated.
     */
    function set_state(state, message) {
      var error;
      var error_text;
      var footer;
      var form_target;
      var host;
      var loading;
      var empty;
      if (['empty', 'loading', 'error', 'form'].indexOf(state) < 0 || !mount()) {
        return false;
      }
      host = get_host();
      footer = get_footer();
      empty = host.querySelector('[data-wpbc-ui-catalog-inspector-empty]');
      loading = host.querySelector('[data-wpbc-ui-catalog-inspector-loading]');
      error = host.querySelector('[data-wpbc-ui-catalog-inspector-error]');
      form_target = host.querySelector('[data-wpbc-ui-catalog-inspector-form]');
      if (empty) {
        empty.hidden = 'empty' !== state;
      }
      if (loading) {
        loading.hidden = 'loading' !== state;
      }
      if (error) {
        error.hidden = 'error' !== state;
        error_text = error.querySelector('p');
        if (error_text) {
          error_text.textContent = String(message || '');
        }
      }
      if (form_target && 'form' !== state) {
        form_target.innerHTML = '';
      }
      if (footer) {
        footer.hidden = 'form' !== state;
      }
      return true;
    }

    /**
     * Expand the configured native sidebar boundary.
     *
     * @return {void}
     */
    function expand() {
      if ('function' === typeof options.expand) {
        options.expand();
      }
    }

    /**
     * Mount, reveal loading state, and immediately expand the inspector.
     *
     * @return {boolean} True when the loading state was opened.
     */
    function open_loading() {
      if (!set_state('loading', '')) {
        return false;
      }
      expand();
      return true;
    }

    /**
     * Return the shell form target used by domain-owned templates.
     *
     * @return {Element|null} Form target or null when mounting failed.
     */
    function get_form_target() {
      var host = mount() ? get_host() : null;
      return host ? host.querySelector('[data-wpbc-ui-catalog-inspector-form]') : null;
    }
    return {
      expand: expand,
      get_form_target: get_form_target,
      mount: mount,
      open_loading: open_loading,
      set_state: set_state
    };
  }

  /**
   * Create a domain-neutral inline-editing workflow controller.
   *
   * Domains retain ownership of editable fields, draft values, authorization,
   * review payloads, and mutations. This controller only synchronizes the
   * repeated catalog mechanics around an active inline workflow: sticky-bar
   * registration, busy controls, navigation locking, changed-row presentation,
   * and the shared active-state classes.
   *
   * @param {HTMLElement|string} catalog_mount Catalog mount element or its ID.
   * @param {Object}             settings      Domain selectors and page element.
   * @return {Object|false} Inline workflow controller or false when unavailable.
   */
  function create_inline_editing_workflow(catalog_mount, settings) {
    var options;
    var mount_element = 'string' === typeof catalog_mount ? document.getElementById(catalog_mount) : catalog_mount;
    var default_protected_selector = ['[data-wpbc-ui-catalog-view]', '[data-wpbc-ui-catalog-template-pack]', '[data-wpbc-ui-catalog-display-customizer] summary', '[data-wpbc-ui-catalog-search]', '[data-wpbc-ui-catalog-filter]', '[data-wpbc-ui-catalog-select-item]', '[data-wpbc-ui-catalog-select-all]', '[data-wpbc-ui-catalog-sort]', '[data-wpbc-ui-catalog-page]', '[data-wpbc-ui-catalog-page-number]', '[data-wpbc-ui-catalog-items-per-page]', '[data-wpbc-ui-catalog-column-visible]', '[data-wpbc-ui-catalog-column-order-reset]', '[data-wpbc-ui-catalog-preferences-reset]'].join(', ');
    if (!mount_element || !mount_element.querySelector) {
      return false;
    }
    options = Object.assign({
      bar_selector: '[data-wpbc-ui-catalog-inline-bar]',
      cancel_selector: '[data-wpbc-ui-catalog-inline-cancel]',
      controls_root: mount_element,
      count_selector: '[data-wpbc-ui-catalog-inline-count]',
      page_element: mount_element,
      protected_selector: '',
      review_selector: '[data-wpbc-ui-catalog-inline-review]',
      toggle_label_selector: '[data-wpbc-ui-catalog-inline-toggle-label]',
      toggle_selector: '[data-wpbc-ui-catalog-inline-toggle]'
    }, settings || {});

    /**
     * Return the configured page element without escaping the catalog mount.
     *
     * @return {HTMLElement|null} Configured page root, mount, or null.
     */
    function get_page_element() {
      if (options.page_element && options.page_element.nodeType) {
        return options.page_element;
      }
      return 'string' === typeof options.page_element ? mount_element.querySelector(options.page_element) : mount_element;
    }

    /**
     * Return the complete selector for controls locked by active drafts.
     *
     * @return {string} Shared selectors plus the trusted domain extension.
     */
    function get_protected_selector() {
      return options.protected_selector ? default_protected_selector + ', ' + options.protected_selector : default_protected_selector;
    }

    /**
     * Preserve and restore a control's pre-workflow disabled state.
     *
     * @param {HTMLElement} control         Catalog control to synchronize.
     * @param {boolean}     controls_locked Whether inline navigation is locked.
     * @return {void}
     */
    function synchronize_protected_control(control, controls_locked) {
      var prior_disabled;
      if (controls_locked) {
        if (!control.hasAttribute('data-wpbc-ui-catalog-inline-was-disabled')) {
          control.setAttribute('data-wpbc-ui-catalog-inline-was-disabled', control.disabled ? '1' : '0');
        }
        control.disabled = true;
        control.setAttribute('aria-disabled', 'true');
        return;
      }
      if (!control.hasAttribute('data-wpbc-ui-catalog-inline-was-disabled')) {
        return;
      }
      prior_disabled = '1' === control.getAttribute('data-wpbc-ui-catalog-inline-was-disabled');
      control.disabled = prior_disabled;
      control.removeAttribute('data-wpbc-ui-catalog-inline-was-disabled');
      if (!prior_disabled) {
        control.removeAttribute('aria-disabled');
      }
    }

    /**
     * Register the current inline bar with the shared viewport controller.
     *
     * @return {void}
     */
    function register_sticky_bar() {
      var inline_bar = mount_element.querySelector(options.bar_selector);
      var selection_controller = mount_element._wpbc_ui_catalog_selection_controller;
      if (inline_bar && selection_controller && 'function' === typeof selection_controller.register_viewport_sticky) {
        selection_controller.register_viewport_sticky(inline_bar);
      }
    }

    /**
     * Remove shared changed-row presentation after inline mode ends.
     *
     * Domain drafts and values remain domain-owned. This cleanup removes only
     * the shared class and badge that this controller previously applied.
     *
     * @return {void}
     */
    function clear_changed_rows() {
      mount_element.querySelectorAll('.wpbc_ui_catalog_inline_row.is-inline-changed').forEach(function (row_element) {
        set_row_changed(row_element, false, null, '');
      });
    }

    /**
     * Synchronize shared inline workflow presentation from domain-owned state.
     *
     * @param {Object} workflow_state Normalized active, busy, count, and labels.
     * @return {void}
     */
    function synchronize(workflow_state) {
      var active;
      var busy;
      var controls_root;
      var controls_locked;
      var inline_bar;
      var page_element;
      var toggle_button;
      var toggle_label;
      workflow_state = workflow_state || {};
      active = true === workflow_state.active;
      busy = true === workflow_state.busy;
      controls_root = options.controls_root && options.controls_root.querySelectorAll ? options.controls_root : mount_element;
      controls_locked = active || true === workflow_state.lock_controls;
      inline_bar = mount_element.querySelector(options.bar_selector);
      page_element = get_page_element();
      toggle_button = mount_element.querySelector(options.toggle_selector);
      if (inline_bar) {
        inline_bar.hidden = !active;
        inline_bar.setAttribute('aria-busy', busy ? 'true' : 'false');
        if (inline_bar.querySelector(options.count_selector)) {
          inline_bar.querySelector(options.count_selector).textContent = String(workflow_state.count_text || '');
        }
        if (inline_bar.querySelector(options.review_selector)) {
          inline_bar.querySelector(options.review_selector).disabled = busy || !Number(workflow_state.changed_count || 0);
        }
        if (inline_bar.querySelector(options.cancel_selector)) {
          inline_bar.querySelector(options.cancel_selector).disabled = busy;
        }
      }
      if (toggle_button) {
        toggle_button.classList.toggle('is-active', active);
        toggle_button.classList.toggle('is-busy', busy);
        toggle_button.disabled = busy || true === workflow_state.toggle_disabled || !active && false === workflow_state.has_items;
        toggle_button.setAttribute('aria-pressed', active ? 'true' : 'false');
        toggle_button.setAttribute('aria-busy', busy ? 'true' : 'false');
        toggle_label = toggle_button.querySelector(options.toggle_label_selector);
        if (toggle_label) {
          toggle_label.textContent = active ? String(workflow_state.active_toggle_text || '') : String(workflow_state.inactive_toggle_text || '');
        }
      }
      if (page_element) {
        page_element.classList.toggle('is-inline-editing', active);
      }
      if (!active) {
        clear_changed_rows();
      }
      controls_root.querySelectorAll(get_protected_selector()).forEach(function (control) {
        synchronize_protected_control(control, controls_locked);
      });
      register_sticky_bar();
      if (mount_element._wpbc_ui_catalog_selection_controller && 'function' === typeof mount_element._wpbc_ui_catalog_selection_controller.refresh_viewport_sticky) {
        mount_element._wpbc_ui_catalog_selection_controller.refresh_viewport_sticky();
      }
    }

    /**
     * Block a captured event that targets a control protected by active drafts.
     *
     * @param {Event}   event           Captured browser event.
     * @param {boolean} controls_locked Whether the domain workflow is active.
     * @return {boolean} True when the event was blocked.
     */
    function protect_event(event, controls_locked) {
      if (!controls_locked || !event.target || !event.target.closest) {
        return false;
      }
      if (!event.target.closest(get_protected_selector())) {
        return false;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      return true;
    }

    /**
     * Synchronize one changed row and its accessible text badge.
     *
     * @param {HTMLElement} row_element       Domain row or card element.
     * @param {boolean}     changed           Whether its draft differs.
     * @param {HTMLElement} indicator_element Backward-compatible fallback badge host.
     * @param {string}      changed_label     Localized badge text.
     * @return {void}
     */
    function set_row_changed(row_element, changed, indicator_element, changed_label) {
      var indicator;
      var preferred_indicator_host;
      if (!row_element) {
        return;
      }
      row_element.classList.add('wpbc_ui_catalog_inline_row');
      row_element.classList.toggle('is-inline-changed', !!changed);
      preferred_indicator_host = row_element.querySelector('[data-wpbc-ui-catalog-inline-changed-host]');
      indicator = row_element.querySelector('[data-wpbc-ui-catalog-inline-changed-label]');
      if (!changed) {
        if (indicator) {
          indicator.remove();
        }
        return;
      }
      if (indicator && preferred_indicator_host && indicator.parentElement !== preferred_indicator_host) {
        preferred_indicator_host.insertBefore(indicator, preferred_indicator_host.firstChild);
      }
      indicator_element = preferred_indicator_host || indicator_element;
      if (!indicator && indicator_element) {
        indicator = document.createElement('span');
        indicator.className = 'wpbc_ui_catalog_inline_changed_label';
        indicator.setAttribute('data-wpbc-ui-catalog-inline-changed-label', '');
        if (preferred_indicator_host) {
          preferred_indicator_host.insertBefore(indicator, preferred_indicator_host.firstChild);
        } else {
          indicator_element.appendChild(indicator);
        }
      }
      if (indicator) {
        indicator.textContent = String(changed_label || '');
      }
    }
    return {
      protect_event: protect_event,
      register_sticky_bar: register_sticky_bar,
      set_row_changed: set_row_changed,
      synchronize: synchronize
    };
  }

  /**
   * Create a domain-neutral signed-review presentation controller.
   *
   * Domains own preview and apply requests, signed plans, permissions, field
   * validation, and mutations. This controller accepts only the normalized
   * review DTO and owns the repeated model preparation and busy-state locking.
   *
   * @param {Object} settings DOM roots and domain button selectors.
   * @return {Object} Review presentation controller.
   */
  function create_inline_review_workflow(settings) {
    var options = Object.assign({
      apply_selector: '[data-wpbc-ui-catalog-inline-review-apply]',
      cancel_selector: '[data-wpbc-ui-catalog-inline-review-cancel]',
      root: document
    }, settings || {});

    /**
     * Normalize one server-authoritative review DTO for a domain template.
     *
     * @param {Object} review       Server review with rows and field changes.
     * @param {Object} presentation Localized headings and explanatory text.
     * @return {Object} Executable-free template model.
     */
    function prepare(review, presentation) {
      var normalized_rows = [];
      review = review && 'object' === typeof review ? review : {};
      presentation = presentation && 'object' === typeof presentation ? presentation : {};
      (Array.isArray(review.rows) ? review.rows : []).forEach(function (row) {
        var normalized_fields = [];
        var normalized_notes = [];
        if (!row || 'object' !== typeof row) {
          return;
        }
        (Array.isArray(row.fields) ? row.fields : []).forEach(function (field) {
          if (!field || 'object' !== typeof field) {
            return;
          }
          normalized_fields.push({
            after: String(undefined === field.after ? '' : field.after),
            before: String(undefined === field.before ? '' : field.before),
            key: String(field.key || ''),
            label: String(field.label || field.key || '')
          });
        });
        (Array.isArray(row.notes) ? row.notes : []).forEach(function (note) {
          if ('string' === typeof note || 'number' === typeof note) {
            normalized_notes.push(String(note));
          }
        });
        if (normalized_fields.length) {
          normalized_rows.push({
            fields: normalized_fields,
            id: Number(row.id || 0),
            notes: normalized_notes,
            title: String(row.title || '')
          });
        }
      });
      return {
        changed_label: String(presentation.changed_label || ''),
        description: String(presentation.description || ''),
        form_id: String(presentation.form_id || ''),
        mode: String(presentation.mode || 'inline_review'),
        pending_message: String(presentation.pending_message || ''),
        rows: normalized_rows,
        title: String(presentation.title || ''),
        warning: String(review.warning || presentation.warning || '')
      };
    }

    /**
     * Lock or unlock review actions while a domain request is in flight.
     *
     * @param {Object} review_state Busy and apply-ready flags.
     * @return {void}
     */
    function synchronize(review_state) {
      var busy;
      var can_apply;
      var root = options.root && options.root.querySelectorAll ? options.root : document;
      review_state = review_state || {};
      busy = true === review_state.busy;
      can_apply = true === review_state.can_apply;
      root.querySelectorAll(options.apply_selector).forEach(function (control) {
        control.disabled = busy || !can_apply;
        control.classList.toggle('is-busy', busy);
        control.setAttribute('aria-busy', busy ? 'true' : 'false');
      });
      root.querySelectorAll(options.cancel_selector).forEach(function (control) {
        control.disabled = busy;
      });
      root.querySelectorAll('[data-wpbc-ui-catalog-inline-review-form]').forEach(function (form) {
        form.setAttribute('aria-busy', busy ? 'true' : 'false');
      });
    }
    return {
      prepare: prepare,
      synchronize: synchronize
    };
  }

  /**
   * Create a domain-neutral permanent-deletion review controller.
   *
   * Domains remain responsible for deciding whether deletion is allowed,
   * producing the signed impact review, rendering their allow-listed template,
   * and applying the mutation. This controller owns only the repeated browser
   * mechanics for explicit acknowledgement, destructive footer presentation,
   * busy locking, and reduced-motion-safe attention feedback.
   *
   * @param {Object} settings DOM roots and domain selectors.
   * @return {Object} Deletion-review presentation controller.
   */
  function create_delete_review_workflow(settings) {
    var options = Object.assign({
      acknowledgement_selector: '[data-wpbc-ui-catalog-delete-acknowledgement]',
      apply_selector: '[data-wpbc-ui-catalog-delete-apply], [data-wpbc-ui-catalog-inspector-save]',
      cancel_selector: '[data-wpbc-ui-catalog-delete-cancel], [data-wpbc-ui-catalog-inspector-cancel]',
      root: document
    }, settings || {});
    var review_state = {
      busy: false,
      can_apply: false
    };

    /**
     * Return the configured query root.
     *
     * @return {Document|Element} Query-capable root.
     */
    function get_root() {
      return options.root && options.root.querySelectorAll ? options.root : document;
    }

    /**
     * Return the active acknowledgement checkbox.
     *
     * @return {HTMLInputElement|null} Checkbox or null when the review is blocked.
     */
    function get_acknowledgement() {
      return get_root().querySelector(options.acknowledgement_selector);
    }

    /**
     * Restart the finite acknowledgement attention animation.
     *
     * @return {void}
     */
    function pulse_acknowledgement() {
      var acknowledgement = get_acknowledgement();
      var container = acknowledgement ? acknowledgement.closest('.wpbc_ui_catalog_delete_review__acknowledgement') : null;
      if (!container) {
        return;
      }
      container.classList.remove('is-attention');
      void container.offsetWidth;
      container.classList.add('is-attention');
    }

    /**
     * Synchronize destructive review actions with server and user state.
     *
     * @param {Object} next_state Busy and server-authoritative apply flags.
     * @return {void}
     */
    function synchronize(next_state) {
      var acknowledgement;
      var acknowledged;
      var root = get_root();
      next_state = next_state || {};
      if ('boolean' === typeof next_state.busy) {
        review_state.busy = next_state.busy;
      }
      if ('boolean' === typeof next_state.can_apply) {
        review_state.can_apply = next_state.can_apply;
      }
      acknowledgement = get_acknowledgement();
      acknowledged = !!acknowledgement && acknowledgement.checked;
      root.querySelectorAll(options.apply_selector).forEach(function (control) {
        control.disabled = review_state.busy || !review_state.can_apply || !acknowledged;
        control.classList.toggle('is-busy', review_state.busy);
        control.setAttribute('aria-busy', review_state.busy ? 'true' : 'false');
      });
      root.querySelectorAll(options.cancel_selector).forEach(function (control) {
        control.disabled = review_state.busy;
      });
      root.querySelectorAll('[data-wpbc-ui-catalog-delete-review-form]').forEach(function (form) {
        form.setAttribute('aria-busy', review_state.busy ? 'true' : 'false');
      });
    }

    /**
     * Apply the standard destructive footer contract to domain-owned controls.
     *
     * @param {Object} footer_settings Footer element, form ID, and label.
     * @return {void}
     */
    function configure_footer(footer_settings) {
      var footer_options = footer_settings || {};
      var footer = footer_options.footer && footer_options.footer.querySelector ? footer_options.footer : null;
      var apply_button = footer ? footer.querySelector(options.apply_selector) : null;
      if (!apply_button) {
        return;
      }
      apply_button.classList.remove('button-primary', 'button-link-delete');
      apply_button.classList.add('button-secondary', 'wpbc_ui_catalog_delete_review__apply');
      apply_button.textContent = String(footer_options.label || '');
      if (footer_options.form_id) {
        apply_button.setAttribute('form', String(footer_options.form_id));
      }
      review_state.can_apply = true === footer_options.can_apply;
      review_state.busy = false;
      synchronize();
    }

    /**
     * Handle a delegated acknowledgement change.
     *
     * @param {Event} event Browser change event.
     * @return {boolean} True when the event belonged to this workflow.
     */
    function handle_change(event) {
      var target = event && event.target;
      if (!target || !target.matches || !target.matches(options.acknowledgement_selector)) {
        return false;
      }
      if (target.checked) {
        var container = target.closest('.wpbc_ui_catalog_delete_review__acknowledgement');
        if (container) {
          container.classList.remove('is-attention');
        }
      } else {
        pulse_acknowledgement();
      }
      synchronize();
      return true;
    }
    return {
      configure_footer: configure_footer,
      handle_change: handle_change,
      pulse_acknowledgement: pulse_acknowledgement,
      synchronize: synchronize
    };
  }

  /**
   * Mount one registered catalog and render its initial response.
   *
   * @param {Object} config Registered browser configuration.
   * @return {Object|false} Catalog controller or false when mounting fails.
   */
  function mount_catalog(config) {
    var catalog_state;
    var catalog_template;
    var content_element;
    var initial_sequence;
    var mount_element;
    if (!config || !config.id || !config.mount_id || !config.templates || !config.templates.catalog || !config.templates.shell) {
      return false;
    }
    config.catalog_id = config.id;
    mount_element = document.getElementById(config.mount_id);
    catalog_template = load_template(config, 'catalog');
    if (!mount_element || !catalog_template) {
      return false;
    }
    mount_element.innerHTML = catalog_template(Object.assign({}, config, {
      catalog_id: config.catalog_id
    }));
    content_element = mount_element.querySelector('[data-wpbc-catalog-content]');
    if (!content_element) {
      return false;
    }
    if (config.i18n && config.i18n.catalog_label) {
      content_element.parentNode.setAttribute('aria-label', config.i18n.catalog_label);
    }
    catalog_state = get_catalog_state(config.catalog_id);
    catalog_state.config = config;
    catalog_state.content_element = content_element;
    catalog_state.response_element = content_element.querySelector('[data-wpbc-ui-catalog-response]') || content_element;
    catalog_state.loading_element = content_element.querySelector('[data-wpbc-ui-catalog-loading]');
    catalog_state.latest_sequence = 0;
    catalog_state.request_values = Object.assign({}, config.initial_request || {});
    bind_catalog_controls(config, mount_element);
    if (window.wpbc_ui_catalog_actions && 'function' === typeof window.wpbc_ui_catalog_actions.initialize) {
      catalog_state.actions_controller = window.wpbc_ui_catalog_actions.initialize(mount_element, config);
    }
    if (config.features && config.features.hierarchy && window.wpbc_ui_catalog_hierarchy && 'function' === typeof window.wpbc_ui_catalog_hierarchy.initialize) {
      catalog_state.hierarchy_controller = window.wpbc_ui_catalog_hierarchy.initialize(mount_element, config, function (hierarchy_state) {
        var hierarchy_configuration = config.hierarchy || {};
        var preference_key = String(hierarchy_configuration.preference_key || '');
        var preference_values = {};
        if ('global' !== hierarchy_configuration.persistence || !preference_key) {
          return Promise.resolve(false);
        }
        preference_values[preference_key] = JSON.stringify(hierarchy_state || {});
        return save_catalog_preferences(config, preference_values);
      });
    }
    if (config.features && config.features.selection && window.wpbc_ui_catalog_selection && 'function' === typeof window.wpbc_ui_catalog_selection.initialize) {
      catalog_state.selection_controller = window.wpbc_ui_catalog_selection.initialize(mount_element, config);
    }
    if (!set_catalog_loading_state(config, true)) {
      render_template(config, 'shell', {
        catalog_id: config.catalog_id,
        aria_label: config.i18n && config.i18n.catalog_label ? config.i18n.catalog_label : '',
        loading_message: config.i18n && config.i18n.loading ? config.i18n.loading : ''
      });
    }
    if (config.auto_load) {
      request_catalog(config, config.initial_request || {});
      initial_sequence = catalog_state.latest_sequence;
    } else {
      initial_sequence = next_request_sequence(config.catalog_id);
      if (config.initial_response) {
        render_response(config, config.initial_response, initial_sequence);
      }
    }
    return {
      catalog_id: config.catalog_id,
      clear_selection: function () {
        if (catalog_state.selection_controller && 'function' === typeof catalog_state.selection_controller.clear) {
          catalog_state.selection_controller.clear();
        }
      },
      get_selected_ids: function () {
        return catalog_state.selection_controller && 'function' === typeof catalog_state.selection_controller.get_selected_ids ? catalog_state.selection_controller.get_selected_ids() : [];
      },
      get_hierarchy_controller: function () {
        return catalog_state.hierarchy_controller || false;
      },
      sequence: initial_sequence,
      load: function (request_values) {
        return request_catalog(config, request_values || {});
      },
      save_preferences: function (preference_values) {
        return save_catalog_preferences(config, preference_values || {});
      },
      refresh_controls: function () {
        refresh_catalog_controls(config);
      },
      sync_table_min_width: function () {
        sync_catalog_table_min_width(config);
      },
      next_sequence: function () {
        return next_request_sequence(config.catalog_id);
      },
      render_response: function (response, request_sequence) {
        return render_response(config, response, request_sequence);
      }
    };
  }
  window.wpbc_ui_catalog = window.wpbc_ui_catalog || {};
  window.wpbc_ui_catalog.create_inspector_workflow = create_inspector_workflow;
  window.wpbc_ui_catalog.create_inline_editing_workflow = create_inline_editing_workflow;
  window.wpbc_ui_catalog.create_inline_review_workflow = create_inline_review_workflow;
  window.wpbc_ui_catalog.create_delete_review_workflow = create_delete_review_workflow;
  window.wpbc_ui_catalog.is_stale_response = is_stale_response;
  window.wpbc_ui_catalog.load_template = load_template;
  window.wpbc_ui_catalog.mount = mount_catalog;
  window.wpbc_ui_catalog.next_request_sequence = next_request_sequence;
  window.wpbc_ui_catalog.render_response = render_response;
  window.wpbc_ui_catalog.request = request_catalog;
  window.wpbc_ui_catalog.sync_table_min_width = sync_catalog_table_min_width;
  window.wpbc_ui_catalog.synchronize_overflow_tooltips = synchronize_overflow_tooltips;
  window.wpbc_ui_catalog.validate_response = validate_response;
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvX3NoYXJlZC11aS1jYXRhbG9nL19vdXQvd3BiY191aV9jYXRhbG9nLmpzIiwibmFtZXMiOlsid2luZG93IiwiZG9jdW1lbnQiLCJjYXRhbG9nX3N0YXRlcyIsIm5vcm1hbGl6ZV9zZXF1ZW5jZSIsInNlcXVlbmNlIiwibm9ybWFsaXplZF9zZXF1ZW5jZSIsImlzRmluaXRlIiwiTWF0aCIsImZsb29yIiwidGVzdCIsInBhcnNlSW50Iiwibm9ybWFsaXplX3NjaGVtYV92ZXJzaW9uIiwic2NoZW1hX3ZlcnNpb24iLCJub3JtYWxpemVkX3ZlcnNpb24iLCJnZXRfY2F0YWxvZ19zdGF0ZSIsImNhdGFsb2dfaWQiLCJhY3Rpb25zX2NvbnRyb2xsZXIiLCJhYm9ydF9jb250cm9sbGVyIiwiY29uZmlnIiwiY29udGVudF9lbGVtZW50IiwibGF0ZXN0X3NlcXVlbmNlIiwicHJlZmVyZW5jZV9hYm9ydF9jb250cm9sbGVyIiwicHJlZmVyZW5jZV9yZXZpc2lvbiIsInJlcXVlc3RfdmFsdWVzIiwic2VhcmNoX3RpbWVyIiwic2VsZWN0aW9uX2NvbnRyb2xsZXIiLCJzb3J0YWJsZSIsImdldF9zZWFyY2hfZGVib3VuY2VfZGVsYXkiLCJzZWFyY2hfY29uZmlnIiwic2VhcmNoIiwiZGVib3VuY2VfZGVsYXkiLCJOdW1iZXIiLCJkZWJvdW5jZV9kZWxheV9tcyIsIm1pbiIsImlzX2ltbWVkaWF0ZV9zZWFyY2hfY2xlYXJfZW5hYmxlZCIsImltbWVkaWF0ZV9jbGVhciIsIm5leHRfcmVxdWVzdF9zZXF1ZW5jZSIsImNhdGFsb2dfc3RhdGUiLCJpc19zdGFsZV9yZXNwb25zZSIsImdldF90ZW1wbGF0ZV9pZCIsInRlbXBsYXRlX3JvbGUiLCJpbml0aWFsX3JlcXVlc3QiLCJ0ZW1wbGF0ZV9pZCIsInRlbXBsYXRlX3BhY2siLCJ0ZW1wbGF0ZV9wYWNrX2lkIiwidGVtcGxhdGVzIiwiaWQiLCJ0ZW1wbGF0ZV9wYWNrcyIsInNldF9hY3RpdmVfdGVtcGxhdGVfcGFjayIsImNhdGFsb2dfcm9vdCIsIm5vcm1hbGl6ZWRfcGFja19pZCIsImRlZmF1bHRfdGVtcGxhdGVfcGFjayIsImNsb3Nlc3QiLCJzZXRBdHRyaWJ1dGUiLCJsb2FkX3RlbXBsYXRlIiwid3AiLCJ0ZW1wbGF0ZSIsImVycm9yIiwicmVuZGVyX3RlbXBsYXRlIiwidGVtcGxhdGVfZGF0YSIsInJlbmRlcl90YXJnZXQiLCJyZW5kZXJlZF9odG1sIiwicmVzcG9uc2VfZWxlbWVudCIsImRpc3BhdGNoX2NhdGFsb2dfZXZlbnQiLCJpbm5lckhUTUwiLCJwYXJlbnROb2RlIiwic2V0X2NhdGFsb2dfbG9hZGluZ19zdGF0ZSIsImlzX2xvYWRpbmciLCJsb2FkaW5nX2VsZW1lbnQiLCJjbGFzc0xpc3QiLCJ0b2dnbGUiLCJzeW5jX2NhdGFsb2dfdGFibGVfbWluX3dpZHRoIiwibW91bnRfZWxlbWVudCIsIm1vdW50X2lkIiwiZ2V0RWxlbWVudEJ5SWQiLCJ0YWJsZSIsInF1ZXJ5U2VsZWN0b3IiLCJoZWFkZXJfY2VsbHMiLCJ0YWJsZV9taW5fd2lkdGgiLCJnZXRDb21wdXRlZFN0eWxlIiwiQXJyYXkiLCJwcm90b3R5cGUiLCJmaWx0ZXIiLCJjYWxsIiwicXVlcnlTZWxlY3RvckFsbCIsImhlYWRlcl9jZWxsIiwiaGlkZGVuIiwiZm9yRWFjaCIsImNvbHVtbl9taW5fd2lkdGgiLCJwYXJzZUZsb2F0IiwiZ2V0UHJvcGVydHlWYWx1ZSIsInN0eWxlIiwic2V0UHJvcGVydHkiLCJjZWlsIiwicG9zaXRpb25fZGlzcGxheV9wYW5lbCIsImN1c3RvbWl6ZXIiLCJwYW5lbCIsInN1bW1hcnkiLCJmaWVsZF9saXN0Iiwic3VtbWFyeV9yZWN0IiwicGFuZWxfcmVjdCIsInZpZXdwb3J0X3dpZHRoIiwidmlld3BvcnRfaGVpZ2h0IiwibWFyZ2luIiwiZ2FwIiwic3BhY2VfYWJvdmUiLCJzcGFjZV9iZWxvdyIsIm5hdHVyYWxfaGVpZ2h0Iiwib3Blbl9hYm92ZSIsImF2YWlsYWJsZV9oZWlnaHQiLCJyZW5kZXJlZF9oZWlnaHQiLCJwYW5lbF9sZWZ0IiwicGFuZWxfdG9wIiwib3BlbiIsInJlbW92ZSIsInJlbW92ZVByb3BlcnR5IiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0IiwiZG9jdW1lbnRFbGVtZW50IiwiY2xpZW50V2lkdGgiLCJpbm5lcldpZHRoIiwiaW5uZXJIZWlnaHQiLCJjbGllbnRIZWlnaHQiLCJtYXgiLCJ0b3AiLCJib3R0b20iLCJzY3JvbGxIZWlnaHQiLCJoZWlnaHQiLCJyaWdodCIsIndpZHRoIiwicm91bmQiLCJhZGQiLCJyZXNldF9kaXNwbGF5X3BhbmVsX3Bvc2l0aW9uIiwiY2xvc2VfZGlzcGxheV9jdXN0b21pemVyIiwicmVzdG9yZV9mb2N1cyIsImZvY3VzIiwicmVuZGVyX2Vycm9yIiwibWVzc2FnZSIsImkxOG4iLCJ0aXRsZSIsImVycm9yX3RpdGxlIiwiZXJyb3JfbWVzc2FnZSIsImV2ZW50X25hbWUiLCJkZXRhaWwiLCJjYXRhbG9nX2V2ZW50IiwiQ3VzdG9tRXZlbnQiLCJidWJibGVzIiwiY3JlYXRlRXZlbnQiLCJpbml0Q3VzdG9tRXZlbnQiLCJkaXNwYXRjaEV2ZW50IiwiYXBwZW5kX3JlcXVlc3RfdmFsdWUiLCJyZXF1ZXN0X2JvZHkiLCJyZXF1ZXN0X2tleSIsInJlcXVlc3RfdmFsdWUiLCJpc0FycmF5IiwiYXJyYXlfdmFsdWUiLCJhcHBlbmQiLCJTdHJpbmciLCJnZXRfY29sdW1uX29yZGVyIiwic2xpY2UiLCJtYXAiLCJjb2x1bW5faXRlbSIsImdldEF0dHJpYnV0ZSIsImNvbHVtbl9pZCIsImdldF92aXNpYmxlX2NvbHVtbnMiLCJjb2x1bW5fY29udHJvbCIsImNoZWNrZWQiLCJ2YWx1ZSIsInNhdmVfY29sdW1uX2NvbnRyb2xzIiwidmlld19jb250cm9sIiwicmVxdWVzdF9jYXRhbG9nIiwiY29sdW1uX29yZGVyIiwicGFnZV9udW1iZXIiLCJwcmVmZXJlbmNlX2FjdGlvbiIsInZpc2libGVfY29sdW1ucyIsImFubm91bmNlX2NvbHVtbl9tb3ZlZCIsInN0YXR1c19lbGVtZW50IiwidGV4dENvbnRlbnQiLCJzZXRUaW1lb3V0IiwiY29sdW1uX21vdmVkIiwidXBkYXRlX3VybF9zdGF0ZSIsInJlc3BvbnNlIiwiZmlsdGVycyIsInBhcmFtZXRlcnMiLCJ1cmxfcGFyYW1ldGVycyIsInN0YXRlX3ZhbHVlcyIsInBhZ2luYXRpb24iLCJpdGVtc19wZXJfcGFnZSIsInNvcnRfYnkiLCJzb3J0aW5nIiwic29ydF9vcmRlciIsImRpc3BsYXkiLCJwYWdlX3VybCIsImhpc3RvcnkiLCJyZXBsYWNlU3RhdGUiLCJVUkwiLCJsb2NhdGlvbiIsImhyZWYiLCJPYmplY3QiLCJrZXlzIiwiZmlsdGVyX2tleSIsInN0YXRlX2tleSIsInBhcmFtZXRlcl9uYW1lIiwic3RhdGVfdmFsdWUiLCJqb2luIiwic2VhcmNoUGFyYW1zIiwiZGVsZXRlIiwic2V0IiwidG9TdHJpbmciLCJiaW5kX2NhdGFsb2dfY29udHJvbHMiLCJfd3BiY191aV9jYXRhbG9nX2NvbnRyb2xzX2JvdW5kIiwiYWRkRXZlbnRMaXN0ZW5lciIsImV2ZW50Iiwic2VhcmNoX2NvbnRyb2wiLCJ0YXJnZXQiLCJtYXRjaGVzIiwicHJldmVudERlZmF1bHQiLCJjbGVhcl9jb250cm9sIiwiY2xlYXJUaW1lb3V0IiwiZGVmYXVsdF9yZXF1ZXN0IiwiZmlsdGVyX3JlcXVlc3QiLCJ2aWV3X2RlZmluaXRpb24iLCJ2aWV3cyIsImRlZmluaXRpb25zIiwiZmllbGRzIiwiY2xvc2VfY29udHJvbCIsInBhZ2VfY29udHJvbCIsInJlc2V0X2NvbnRyb2wiLCJyZXNldF9vcmRlcl9jb250cm9sIiwic2VhcmNoX2NsZWFyIiwic29ydF9jb250cm9sIiwic29ydF9rZXkiLCJkaXNhYmxlZCIsImFzc2lnbiIsImtleSIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsImNvbnRhaW5zIiwicmVmcmVzaF9jYXRhbG9nX2NvbnRyb2xzIiwiY29sdW1uX2xpc3QiLCJfd3BiY191aV9jYXRhbG9nX2luaXRpYWxpemVkIiwiaGFuZGxlIiwiaXRlbSIsInNpYmxpbmciLCJwcmV2aW91c0VsZW1lbnRTaWJsaW5nIiwibmV4dEVsZW1lbnRTaWJsaW5nIiwiaW5zZXJ0QmVmb3JlIiwiU29ydGFibGUiLCJhbmltYXRpb24iLCJjaG9zZW5DbGFzcyIsImRyYWdnYWJsZSIsImdob3N0Q2xhc3MiLCJvbkVuZCIsInNvcnRfZXZlbnQiLCJvbGRJbmRleCIsIm5ld0luZGV4IiwidmFsaWRhdGVfcmVzcG9uc2UiLCJjb25maWd1cmVkX3NjaGVtYV92ZXJzaW9uIiwicmVzcG9uc2Vfc2NoZW1hX3ZlcnNpb24iLCJzdWNjZXNzIiwicmVxdWVzdF9pZCIsImNvZGUiLCJyZXRyeWFibGUiLCJpdGVtcyIsImhpZXJhcmNoeSIsImNhcGFiaWxpdGllcyIsIm1lc3NhZ2VzIiwicmVmcmVzaF9jYXRhbG9nX2hpZXJhcmNoeSIsImhpZXJhcmNoeV9jb250cm9sbGVyIiwicmVmcmVzaCIsInJlbmRlcl9yZXNwb25zZSIsInJlcXVlc3Rfc2VxdWVuY2UiLCJpdGVtc190ZW1wbGF0ZV9kYXRhIiwicmVzcG9uc2Vfc2VxdWVuY2UiLCJsZW5ndGgiLCJpc19lbXB0eV9yZW5kZXJlZCIsImVtcHR5X3RpdGxlIiwiZW1wdHlfbWVzc2FnZSIsInBlcnNpc3RlbnRfcmVxdWVzdF92YWx1ZXMiLCJyZXF1ZXN0X3VybCIsImFqYXhfdXJsIiwiYWN0aW9uIiwibm9uY2UiLCJmZXRjaCIsIlByb21pc2UiLCJyZXNvbHZlIiwiYWJvcnQiLCJBYm9ydENvbnRyb2xsZXIiLCJhcmlhX2xhYmVsIiwiY2F0YWxvZ19sYWJlbCIsImxvYWRpbmdfbWVzc2FnZSIsImxvYWRpbmciLCJVUkxTZWFyY2hQYXJhbXMiLCJEYXRlIiwibm93IiwibWV0aG9kIiwiY3JlZGVudGlhbHMiLCJoZWFkZXJzIiwiYm9keSIsInNpZ25hbCIsInVuZGVmaW5lZCIsInRoZW4iLCJ0ZXh0IiwicmVzcG9uc2VfdGV4dCIsInJlc3BvbnNlX3BheWxvYWQiLCJKU09OIiwicGFyc2UiLCJpc19yZW5kZXJlZCIsImNhdGNoIiwibmFtZSIsInNhdmVfY2F0YWxvZ19wcmVmZXJlbmNlcyIsInByZWZlcmVuY2VfdmFsdWVzIiwicmVxdWVzdF9yZXZpc2lvbiIsIm9rIiwiY2xlYXJfb3ZlcmZsb3dfdG9vbHRpcF9mb2N1c19wcm94eSIsInRleHRfZWxlbWVudCIsImZvY3VzX3Byb3h5IiwiX3dwYmNfdWlfY2F0YWxvZ19vdmVyZmxvd19mb2N1c19wcm94eSIsIm93bmVyIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsInNob3ciLCJoaWRlIiwiZ2V0X292ZXJmbG93X3Rvb2x0aXBfZm9jdXNfb3duZXIiLCJmb2N1c19vd25lciIsImdldF9vdmVyZmxvd190b29sdGlwX3BvaW50ZXJfZGVsYXkiLCJkZWxheV9hdHRyaWJ1dGUiLCJpc19vdmVyZmxvd190b29sdGlwX3BvaW50ZXJfb25seSIsIkJvb2xlYW4iLCJiaW5kX292ZXJmbG93X3Rvb2x0aXBfZm9jdXNfcHJveHkiLCJzaG93X3Rvb2x0aXAiLCJoaWRlX3Rvb2x0aXAiLCJfdGlwcHkiLCJhY3RpdmVFbGVtZW50Iiwic3luY2hyb25pemVfb3ZlcmZsb3dfdG9vbHRpcHMiLCJjYXRhbG9nX21vdW50IiwiaGFzX292ZXJmbG93aW5nX3RleHQiLCJ0b29sdGlwX3NlbGVjdG9yIiwiZnVsbF90ZXh0Iiwic3RhdGljX3RpdGxlIiwiaXNfb3ZlcmZsb3dpbmciLCJzY3JvbGxXaWR0aCIsImRlc3Ryb3kiLCJyZW1vdmVBdHRyaWJ1dGUiLCJoYXNBdHRyaWJ1dGUiLCJ3cGJjX2RlZmluZV90aXBweV90b29sdGlwcyIsInBvaW50ZXJfZGVsYXkiLCJzZXRQcm9wcyIsImRlbGF5IiwiY3JlYXRlX2luc3BlY3Rvcl93b3JrZmxvdyIsInNldHRpbmdzIiwib3B0aW9ucyIsImV4cGFuZCIsImdldF9mb290ZXIiLCJnZXRfaG9zdCIsInJlbmRlcl9zaGVsbCIsInNoZWxsX2RhdGEiLCJob3N0IiwiZm9vdGVyIiwibW91bnQiLCJyZW5kZXJlZF9zaGVsbCIsInNldF9zdGF0ZSIsInN0YXRlIiwiZXJyb3JfdGV4dCIsImZvcm1fdGFyZ2V0IiwiZW1wdHkiLCJpbmRleE9mIiwib3Blbl9sb2FkaW5nIiwiZ2V0X2Zvcm1fdGFyZ2V0IiwiY3JlYXRlX2lubGluZV9lZGl0aW5nX3dvcmtmbG93IiwiZGVmYXVsdF9wcm90ZWN0ZWRfc2VsZWN0b3IiLCJiYXJfc2VsZWN0b3IiLCJjYW5jZWxfc2VsZWN0b3IiLCJjb250cm9sc19yb290IiwiY291bnRfc2VsZWN0b3IiLCJwYWdlX2VsZW1lbnQiLCJwcm90ZWN0ZWRfc2VsZWN0b3IiLCJyZXZpZXdfc2VsZWN0b3IiLCJ0b2dnbGVfbGFiZWxfc2VsZWN0b3IiLCJ0b2dnbGVfc2VsZWN0b3IiLCJnZXRfcGFnZV9lbGVtZW50Iiwibm9kZVR5cGUiLCJnZXRfcHJvdGVjdGVkX3NlbGVjdG9yIiwic3luY2hyb25pemVfcHJvdGVjdGVkX2NvbnRyb2wiLCJjb250cm9sIiwiY29udHJvbHNfbG9ja2VkIiwicHJpb3JfZGlzYWJsZWQiLCJyZWdpc3Rlcl9zdGlja3lfYmFyIiwiaW5saW5lX2JhciIsIl93cGJjX3VpX2NhdGFsb2dfc2VsZWN0aW9uX2NvbnRyb2xsZXIiLCJyZWdpc3Rlcl92aWV3cG9ydF9zdGlja3kiLCJjbGVhcl9jaGFuZ2VkX3Jvd3MiLCJyb3dfZWxlbWVudCIsInNldF9yb3dfY2hhbmdlZCIsInN5bmNocm9uaXplIiwid29ya2Zsb3dfc3RhdGUiLCJhY3RpdmUiLCJidXN5IiwidG9nZ2xlX2J1dHRvbiIsInRvZ2dsZV9sYWJlbCIsImxvY2tfY29udHJvbHMiLCJjb3VudF90ZXh0IiwiY2hhbmdlZF9jb3VudCIsInRvZ2dsZV9kaXNhYmxlZCIsImhhc19pdGVtcyIsImFjdGl2ZV90b2dnbGVfdGV4dCIsImluYWN0aXZlX3RvZ2dsZV90ZXh0IiwicmVmcmVzaF92aWV3cG9ydF9zdGlja3kiLCJwcm90ZWN0X2V2ZW50Iiwic3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uIiwiY2hhbmdlZCIsImluZGljYXRvcl9lbGVtZW50IiwiY2hhbmdlZF9sYWJlbCIsImluZGljYXRvciIsInByZWZlcnJlZF9pbmRpY2F0b3JfaG9zdCIsInBhcmVudEVsZW1lbnQiLCJmaXJzdENoaWxkIiwiY3JlYXRlRWxlbWVudCIsImNsYXNzTmFtZSIsImFwcGVuZENoaWxkIiwiY3JlYXRlX2lubGluZV9yZXZpZXdfd29ya2Zsb3ciLCJhcHBseV9zZWxlY3RvciIsInJvb3QiLCJwcmVwYXJlIiwicmV2aWV3IiwicHJlc2VudGF0aW9uIiwibm9ybWFsaXplZF9yb3dzIiwicm93cyIsInJvdyIsIm5vcm1hbGl6ZWRfZmllbGRzIiwibm9ybWFsaXplZF9ub3RlcyIsImZpZWxkIiwicHVzaCIsImFmdGVyIiwiYmVmb3JlIiwibGFiZWwiLCJub3RlcyIsIm5vdGUiLCJkZXNjcmlwdGlvbiIsImZvcm1faWQiLCJtb2RlIiwicGVuZGluZ19tZXNzYWdlIiwid2FybmluZyIsInJldmlld19zdGF0ZSIsImNhbl9hcHBseSIsImZvcm0iLCJjcmVhdGVfZGVsZXRlX3Jldmlld193b3JrZmxvdyIsImFja25vd2xlZGdlbWVudF9zZWxlY3RvciIsImdldF9yb290IiwiZ2V0X2Fja25vd2xlZGdlbWVudCIsInB1bHNlX2Fja25vd2xlZGdlbWVudCIsImFja25vd2xlZGdlbWVudCIsImNvbnRhaW5lciIsIm9mZnNldFdpZHRoIiwibmV4dF9zdGF0ZSIsImFja25vd2xlZGdlZCIsImNvbmZpZ3VyZV9mb290ZXIiLCJmb290ZXJfc2V0dGluZ3MiLCJmb290ZXJfb3B0aW9ucyIsImFwcGx5X2J1dHRvbiIsImhhbmRsZV9jaGFuZ2UiLCJtb3VudF9jYXRhbG9nIiwiY2F0YWxvZ190ZW1wbGF0ZSIsImluaXRpYWxfc2VxdWVuY2UiLCJjYXRhbG9nIiwic2hlbGwiLCJ3cGJjX3VpX2NhdGFsb2dfYWN0aW9ucyIsImluaXRpYWxpemUiLCJmZWF0dXJlcyIsIndwYmNfdWlfY2F0YWxvZ19oaWVyYXJjaHkiLCJoaWVyYXJjaHlfc3RhdGUiLCJoaWVyYXJjaHlfY29uZmlndXJhdGlvbiIsInByZWZlcmVuY2Vfa2V5IiwicGVyc2lzdGVuY2UiLCJzdHJpbmdpZnkiLCJzZWxlY3Rpb24iLCJ3cGJjX3VpX2NhdGFsb2dfc2VsZWN0aW9uIiwiYXV0b19sb2FkIiwiaW5pdGlhbF9yZXNwb25zZSIsImNsZWFyX3NlbGVjdGlvbiIsImNsZWFyIiwiZ2V0X3NlbGVjdGVkX2lkcyIsImdldF9oaWVyYXJjaHlfY29udHJvbGxlciIsImxvYWQiLCJzYXZlX3ByZWZlcmVuY2VzIiwicmVmcmVzaF9jb250cm9scyIsInN5bmNfdGFibGVfbWluX3dpZHRoIiwibmV4dF9zZXF1ZW5jZSIsIndwYmNfdWlfY2F0YWxvZyIsInJlcXVlc3QiXSwic291cmNlcyI6WyJpbmNsdWRlcy9fc2hhcmVkLXVpLWNhdGFsb2cvX3NyYy93cGJjX3VpX2NhdGFsb2cuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDb250cm9sIHNoYXJlZCByZXF1ZXN0IHNlcXVlbmNlcyBhbmQgcmVuZGVyIG5vcm1hbGl6ZWQgY2F0YWxvZyByZXNwb25zZXMuXG4gKlxuICogRG9tYWluIHNjcmlwdHMgcHJvdmlkZSBjb25maWd1cmF0aW9uIGFuZCBkb21haW4tc3BlY2lmaWMgaW50ZXJhY3Rpb25zLiBUaGlzXG4gKiBjb250cm9sbGVyIG93bnMgb25seSBhbGxvdy1saXN0ZWQgV1AgdGVtcGxhdGVzLCBzaGFyZWQgcmVzcG9uc2UgdmFsaWRhdGlvbixcbiAqIGxvYWRpbmcsIGVtcHR5LCBwb3B1bGF0ZWQsIGVycm9yLCBhbmQgc3RhbGUtcmVzcG9uc2UgbWVjaGFuaWNzLlxuICpcbiAqIEBzaW5jZSAxMS42LjBcbiAqL1xuKCBmdW5jdGlvbiAoIHdpbmRvdywgZG9jdW1lbnQgKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHR2YXIgY2F0YWxvZ19zdGF0ZXMgPSB7fTtcblxuXHQvKipcblx0ICogUmV0dXJuIGEgbm9ybWFsaXplZCBub24tbmVnYXRpdmUgcmVxdWVzdCBzZXF1ZW5jZS5cblx0ICpcblx0ICogQHBhcmFtIHsqfSBzZXF1ZW5jZSBDYW5kaWRhdGUgcmVxdWVzdCBzZXF1ZW5jZS5cblx0ICogQHJldHVybiB7bnVtYmVyfG51bGx9IFNlcXVlbmNlIG9yIG51bGwgd2hlbiBtYWxmb3JtZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiBub3JtYWxpemVfc2VxdWVuY2UoIHNlcXVlbmNlICkge1xuXHRcdHZhciBub3JtYWxpemVkX3NlcXVlbmNlO1xuXG5cdFx0aWYgKCAnbnVtYmVyJyA9PT0gdHlwZW9mIHNlcXVlbmNlICYmIGlzRmluaXRlKCBzZXF1ZW5jZSApICYmIE1hdGguZmxvb3IoIHNlcXVlbmNlICkgPT09IHNlcXVlbmNlICkge1xuXHRcdFx0bm9ybWFsaXplZF9zZXF1ZW5jZSA9IHNlcXVlbmNlO1xuXHRcdH0gZWxzZSBpZiAoICdzdHJpbmcnID09PSB0eXBlb2Ygc2VxdWVuY2UgJiYgL15cXGQrJC8udGVzdCggc2VxdWVuY2UgKSApIHtcblx0XHRcdG5vcm1hbGl6ZWRfc2VxdWVuY2UgPSBwYXJzZUludCggc2VxdWVuY2UsIDEwICk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHJldHVybiAwIDw9IG5vcm1hbGl6ZWRfc2VxdWVuY2UgPyBub3JtYWxpemVkX3NlcXVlbmNlIDogbnVsbDtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gYSBzdXBwb3J0ZWQgcG9zaXRpdmUgcmVzcG9uc2Ugc2NoZW1hIHZlcnNpb24uXG5cdCAqXG5cdCAqIFdvcmRQcmVzcyBsb2NhbGl6ZXMgdG9wLWxldmVsIHNjYWxhciB2YWx1ZXMgYXMgc3RyaW5ncywgc28gdGhlIHJlZ2lzdGVyZWRcblx0ICogY29uZmlndXJhdGlvbiBtYXkgY29udGFpbiBcIjFcIiB3aGlsZSB0aGUgbmVzdGVkIHJlc3BvbnNlIHJldGFpbnMgbnVtYmVyIDEuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gc2NoZW1hX3ZlcnNpb24gQ2FuZGlkYXRlIHNjaGVtYSB2ZXJzaW9uLlxuXHQgKiBAcmV0dXJuIHtudW1iZXJ8bnVsbH0gU3VwcG9ydGVkIHZlcnNpb24gb3IgbnVsbC5cblx0ICovXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9zY2hlbWFfdmVyc2lvbiggc2NoZW1hX3ZlcnNpb24gKSB7XG5cdFx0dmFyIG5vcm1hbGl6ZWRfdmVyc2lvbiA9IG5vcm1hbGl6ZV9zZXF1ZW5jZSggc2NoZW1hX3ZlcnNpb24gKTtcblxuXHRcdHJldHVybiAxID09PSBub3JtYWxpemVkX3ZlcnNpb24gPyBub3JtYWxpemVkX3ZlcnNpb24gOiBudWxsO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiBvbmUgY2F0YWxvZydzIHJlcXVlc3Qgc3RhdGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBjYXRhbG9nX2lkIFJlZ2lzdGVyZWQgY2F0YWxvZyBpZGVudGlmaWVyLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gTXV0YWJsZSBjYXRhbG9nIHN0YXRlIG9yIG51bGwuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfY2F0YWxvZ19zdGF0ZSggY2F0YWxvZ19pZCApIHtcblx0XHRpZiAoICEgY2F0YWxvZ19pZCB8fCAnc3RyaW5nJyAhPT0gdHlwZW9mIGNhdGFsb2dfaWQgKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRpZiAoICEgY2F0YWxvZ19zdGF0ZXNbIGNhdGFsb2dfaWQgXSApIHtcblx0XHRcdGNhdGFsb2dfc3RhdGVzWyBjYXRhbG9nX2lkIF0gPSB7XG5cdFx0XHRcdGFjdGlvbnNfY29udHJvbGxlcjogbnVsbCxcblx0XHRcdFx0YWJvcnRfY29udHJvbGxlcjogbnVsbCxcblx0XHRcdFx0Y29uZmlnOiBudWxsLFxuXHRcdFx0XHRjb250ZW50X2VsZW1lbnQ6IG51bGwsXG5cdFx0XHRcdGxhdGVzdF9zZXF1ZW5jZTogMCxcblx0XHRcdFx0cHJlZmVyZW5jZV9hYm9ydF9jb250cm9sbGVyOiBudWxsLFxuXHRcdFx0XHRwcmVmZXJlbmNlX3JldmlzaW9uOiAwLFxuXHRcdFx0XHRyZXF1ZXN0X3ZhbHVlczoge30sXG5cdFx0XHRcdHNlYXJjaF90aW1lcjogMCxcblx0XHRcdFx0c2VsZWN0aW9uX2NvbnRyb2xsZXI6IG51bGwsXG5cdFx0XHRcdHNvcnRhYmxlOiBudWxsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHJldHVybiBjYXRhbG9nX3N0YXRlc1sgY2F0YWxvZ19pZCBdO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiB0aGUgcmVnaXN0ZXJlZCwgYm91bmRlZCBkZWxheSBmb3IgYW4gaW5jcmVtZW50YWwgc2VhcmNoIHJlcXVlc3QuXG5cdCAqXG5cdCAqIFNlYXJjaCB0aW1pbmcgaXMgYSBkb21haW4tbmV1dHJhbCBpbnRlcmFjdGlvbiBtZWNoYW5pYy4gQ2F0YWxvZ3MgbWF5IHR1bmVcblx0ICogdGhlIGRlbGF5IHRocm91Z2ggdGhlaXIgc2VydmVyLW5vcm1hbGl6ZWQgY29uZmlndXJhdGlvbiB3aXRob3V0IHJlcGxhY2luZ1xuXHQgKiB0aGUgc2hhcmVkIHJlcXVlc3QgY29udHJvbGxlci5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBSZWdpc3RlcmVkIGJyb3dzZXIgY29uZmlndXJhdGlvbi5cblx0ICogQHJldHVybiB7bnVtYmVyfSBEZWxheSBpbiBtaWxsaXNlY29uZHMgYmV0d2VlbiB6ZXJvIGFuZCAyMDAwLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X3NlYXJjaF9kZWJvdW5jZV9kZWxheSggY29uZmlnICkge1xuXHRcdHZhciBzZWFyY2hfY29uZmlnID0gY29uZmlnICYmIGNvbmZpZy5zZWFyY2ggJiYgJ29iamVjdCcgPT09IHR5cGVvZiBjb25maWcuc2VhcmNoID8gY29uZmlnLnNlYXJjaCA6IHt9O1xuXHRcdHZhciBkZWJvdW5jZV9kZWxheSA9IE51bWJlciggc2VhcmNoX2NvbmZpZy5kZWJvdW5jZV9kZWxheV9tcyApO1xuXG5cdFx0aWYgKCAhIGlzRmluaXRlKCBkZWJvdW5jZV9kZWxheSApIHx8IGRlYm91bmNlX2RlbGF5IDwgMCApIHtcblx0XHRcdHJldHVybiAzMDA7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIE1hdGgubWluKCAyMDAwLCBNYXRoLmZsb29yKCBkZWJvdW5jZV9kZWxheSApICk7XG5cdH1cblxuXHQvKipcblx0ICogRGV0ZXJtaW5lIHdoZXRoZXIgY2xlYXJpbmcgc2VhcmNoIGJ5cGFzc2VzIHRoZSBpbmNyZW1lbnRhbC1zZWFyY2ggZGVsYXkuXG5cdCAqXG5cdCAqIEltbWVkaWF0ZSBjbGVhciByZW1haW5zIHRoZSBjb21wYXRpYmlsaXR5IGRlZmF1bHQuIEEgY2F0YWxvZyBtYXkgZGlzYWJsZVxuXHQgKiBpdCBvbmx5IHRocm91Z2ggc2VydmVyLW5vcm1hbGl6ZWQsIGRvbWFpbi1uZXV0cmFsIHNlYXJjaCBjb25maWd1cmF0aW9uLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnIFJlZ2lzdGVyZWQgYnJvd3NlciBjb25maWd1cmF0aW9uLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gQ2xlYXIgbXVzdCByZXF1ZXN0IHVuZmlsdGVyZWQgcmVzdWx0cyBub3cuXG5cdCAqL1xuXHRmdW5jdGlvbiBpc19pbW1lZGlhdGVfc2VhcmNoX2NsZWFyX2VuYWJsZWQoIGNvbmZpZyApIHtcblx0XHRyZXR1cm4gISBjb25maWcgfHwgISBjb25maWcuc2VhcmNoIHx8IGZhbHNlICE9PSBjb25maWcuc2VhcmNoLmltbWVkaWF0ZV9jbGVhcjtcblx0fVxuXG5cdC8qKlxuXHQgKiBTdGFydCBhIG5ldyByZXF1ZXN0IHNlcXVlbmNlIGZvciBvbmUgY2F0YWxvZy5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IGNhdGFsb2dfaWQgUmVnaXN0ZXJlZCBjYXRhbG9nIGlkZW50aWZpZXIuXG5cdCAqIEByZXR1cm4ge251bWJlcn0gTmV3IHNlcXVlbmNlLCBvciB6ZXJvIGZvciBhbiBpbnZhbGlkIGNhdGFsb2cuXG5cdCAqL1xuXHRmdW5jdGlvbiBuZXh0X3JlcXVlc3Rfc2VxdWVuY2UoIGNhdGFsb2dfaWQgKSB7XG5cdFx0dmFyIGNhdGFsb2dfc3RhdGUgPSBnZXRfY2F0YWxvZ19zdGF0ZSggY2F0YWxvZ19pZCApO1xuXG5cdFx0aWYgKCAhIGNhdGFsb2dfc3RhdGUgKSB7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cblx0XHRjYXRhbG9nX3N0YXRlLmxhdGVzdF9zZXF1ZW5jZSArPSAxO1xuXG5cdFx0cmV0dXJuIGNhdGFsb2dfc3RhdGUubGF0ZXN0X3NlcXVlbmNlO1xuXHR9XG5cblx0LyoqXG5cdCAqIERldGVybWluZSB3aGV0aGVyIGEgcmVzcG9uc2UgYmVsb25ncyB0byBhbiBvbGRlciByZXF1ZXN0LlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gY2F0YWxvZ19pZCBSZWdpc3RlcmVkIGNhdGFsb2cgaWRlbnRpZmllci5cblx0ICogQHBhcmFtIHsqfSAgICAgIHNlcXVlbmNlICAgUmVzcG9uc2UgcmVxdWVzdCBzZXF1ZW5jZS5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSByZXNwb25zZSBtdXN0IG5vdCByZW5kZXIuXG5cdCAqL1xuXHRmdW5jdGlvbiBpc19zdGFsZV9yZXNwb25zZSggY2F0YWxvZ19pZCwgc2VxdWVuY2UgKSB7XG5cdFx0dmFyIGNhdGFsb2dfc3RhdGUgPSBnZXRfY2F0YWxvZ19zdGF0ZSggY2F0YWxvZ19pZCApO1xuXHRcdHZhciBub3JtYWxpemVkX3NlcXVlbmNlID0gbm9ybWFsaXplX3NlcXVlbmNlKCBzZXF1ZW5jZSApO1xuXG5cdFx0cmV0dXJuICEgY2F0YWxvZ19zdGF0ZSB8fCBudWxsID09PSBub3JtYWxpemVkX3NlcXVlbmNlIHx8IG5vcm1hbGl6ZWRfc2VxdWVuY2UgPCBjYXRhbG9nX3N0YXRlLmxhdGVzdF9zZXF1ZW5jZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXNvbHZlIG9uZSBhbGxvdy1saXN0ZWQgdGVtcGxhdGUgaWRlbnRpZmllciBmcm9tIHRoZSBjb25maWd1cmF0aW9uLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnICAgICAgICBSZWdpc3RlcmVkIGJyb3dzZXIgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtzdHJpbmd9IHRlbXBsYXRlX3JvbGUgVGVtcGxhdGUgcm9sZSBzdWNoIGFzIGVtcHR5IG9yIGVycm9yLlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IFRlbXBsYXRlIGlkZW50aWZpZXIgb3IgYW4gZW1wdHkgc3RyaW5nLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X3RlbXBsYXRlX2lkKCBjb25maWcsIHRlbXBsYXRlX3JvbGUgKSB7XG5cdFx0dmFyIGNhdGFsb2dfc3RhdGU7XG5cdFx0dmFyIGluaXRpYWxfcmVxdWVzdDtcblx0XHR2YXIgdGVtcGxhdGVfaWQgPSAnJztcblx0XHR2YXIgdGVtcGxhdGVfcGFjaztcblx0XHR2YXIgdGVtcGxhdGVfcGFja19pZDtcblxuXHRcdGlmICggISBjb25maWcgfHwgISBjb25maWcudGVtcGxhdGVzIHx8ICdzdHJpbmcnICE9PSB0eXBlb2YgdGVtcGxhdGVfcm9sZSApIHtcblx0XHRcdHJldHVybiAnJztcblx0XHR9XG5cblx0XHRpZiAoICdzdHJpbmcnID09PSB0eXBlb2YgY29uZmlnLnRlbXBsYXRlc1sgdGVtcGxhdGVfcm9sZSBdICkge1xuXHRcdFx0dGVtcGxhdGVfaWQgPSBjb25maWcudGVtcGxhdGVzWyB0ZW1wbGF0ZV9yb2xlIF07XG5cdFx0fVxuXG5cdFx0Y2F0YWxvZ19zdGF0ZSAgICA9ICggY29uZmlnLmNhdGFsb2dfaWQgfHwgY29uZmlnLmlkICkgPyBnZXRfY2F0YWxvZ19zdGF0ZSggY29uZmlnLmNhdGFsb2dfaWQgfHwgY29uZmlnLmlkICkgOiBudWxsO1xuXHRcdGluaXRpYWxfcmVxdWVzdCAgPSBjb25maWcuaW5pdGlhbF9yZXF1ZXN0IHx8IHt9O1xuXHRcdHRlbXBsYXRlX3BhY2tfaWQgPSBjYXRhbG9nX3N0YXRlICYmIGNhdGFsb2dfc3RhdGUucmVxdWVzdF92YWx1ZXMudGVtcGxhdGVfcGFja1xuXHRcdFx0PyBjYXRhbG9nX3N0YXRlLnJlcXVlc3RfdmFsdWVzLnRlbXBsYXRlX3BhY2tcblx0XHRcdDogaW5pdGlhbF9yZXF1ZXN0LnRlbXBsYXRlX3BhY2s7XG5cdFx0dGVtcGxhdGVfcGFjayAgICA9IGNvbmZpZy50ZW1wbGF0ZV9wYWNrcyAmJiBjb25maWcudGVtcGxhdGVfcGFja3NbIHRlbXBsYXRlX3BhY2tfaWQgXTtcblxuXHRcdGlmICggdGVtcGxhdGVfcGFjayAmJiAnc3RyaW5nJyA9PT0gdHlwZW9mIHRlbXBsYXRlX3BhY2tbIHRlbXBsYXRlX3JvbGUgXSApIHtcblx0XHRcdHRlbXBsYXRlX2lkID0gdGVtcGxhdGVfcGFja1sgdGVtcGxhdGVfcm9sZSBdO1xuXHRcdH1cblxuXHRcdHJldHVybiAvXlthLXowLTlfLV0rJC8udGVzdCggdGVtcGxhdGVfaWQgKSA/IHRlbXBsYXRlX2lkIDogJyc7XG5cdH1cblxuXHQvKipcblx0ICogU3luY2hyb25pemUgb25lIHNlcnZlci1hdXRob3JpdGF0aXZlIGFsbG93LWxpc3RlZCBwcmVzZW50YXRpb24gcGFjay5cblx0ICpcblx0ICogVGhlIGFjdGl2ZSBwYWNrIGlzIHNoYXJlZCBwcmVzZW50YXRpb24gc3RhdGUgb25seS4gVXBkYXRpbmcgaXQgYmVmb3JlIGFuXG5cdCAqIGl0ZW1zIHRlbXBsYXRlIGlzIHJlc29sdmVkIGFsbG93cyBhbiBBSkFYIHJlc3BvbnNlIHRvIHN3aXRjaCBtYXJrdXAgd2hpbGVcblx0ICogbGVhdmluZyB0aGUgcHJvdmlkZXIsIERUTywgYXV0aG9yaXphdGlvbiwgYW5kIG11dGF0aW9uIHBhdGhzIHVuY2hhbmdlZC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyAgICAgICAgICAgUmVnaXN0ZXJlZCBicm93c2VyIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7Kn0gICAgICB0ZW1wbGF0ZV9wYWNrX2lkIENhbmRpZGF0ZSBwYWNrIGlkZW50aWZpZXIgZnJvbSBhIHJlc3BvbnNlLlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IEFjdGl2ZSBhbGxvdy1saXN0ZWQgcGFjayBpZGVudGlmaWVyLlxuXHQgKi9cblx0ZnVuY3Rpb24gc2V0X2FjdGl2ZV90ZW1wbGF0ZV9wYWNrKCBjb25maWcsIHRlbXBsYXRlX3BhY2tfaWQgKSB7XG5cdFx0dmFyIGNhdGFsb2dfcm9vdDtcblx0XHR2YXIgY2F0YWxvZ19zdGF0ZSA9IGNvbmZpZyAmJiBjb25maWcuY2F0YWxvZ19pZCA/IGdldF9jYXRhbG9nX3N0YXRlKCBjb25maWcuY2F0YWxvZ19pZCApIDogbnVsbDtcblx0XHR2YXIgbm9ybWFsaXplZF9wYWNrX2lkID0gJ3N0cmluZycgPT09IHR5cGVvZiB0ZW1wbGF0ZV9wYWNrX2lkID8gdGVtcGxhdGVfcGFja19pZCA6ICcnO1xuXG5cdFx0aWYgKCAhIGNhdGFsb2dfc3RhdGUgfHwgISBjb25maWcudGVtcGxhdGVfcGFja3MgfHwgISBjb25maWcudGVtcGxhdGVfcGFja3NbIG5vcm1hbGl6ZWRfcGFja19pZCBdICkge1xuXHRcdFx0bm9ybWFsaXplZF9wYWNrX2lkID0gY29uZmlnICYmIGNvbmZpZy5kZWZhdWx0X3RlbXBsYXRlX3BhY2sgJiYgY29uZmlnLnRlbXBsYXRlX3BhY2tzXG5cdFx0XHRcdCYmIGNvbmZpZy50ZW1wbGF0ZV9wYWNrc1sgY29uZmlnLmRlZmF1bHRfdGVtcGxhdGVfcGFjayBdXG5cdFx0XHRcdD8gY29uZmlnLmRlZmF1bHRfdGVtcGxhdGVfcGFja1xuXHRcdFx0XHQ6ICcnO1xuXHRcdH1cblx0XHRpZiAoICEgbm9ybWFsaXplZF9wYWNrX2lkICkge1xuXHRcdFx0cmV0dXJuICcnO1xuXHRcdH1cblxuXHRcdGNhdGFsb2dfc3RhdGUucmVxdWVzdF92YWx1ZXMudGVtcGxhdGVfcGFjayA9IG5vcm1hbGl6ZWRfcGFja19pZDtcblx0XHRjYXRhbG9nX3Jvb3QgPSBjYXRhbG9nX3N0YXRlLmNvbnRlbnRfZWxlbWVudFxuXHRcdFx0PyBjYXRhbG9nX3N0YXRlLmNvbnRlbnRfZWxlbWVudC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1jYXRhbG9nLWlkXScgKVxuXHRcdFx0OiBudWxsO1xuXHRcdGlmICggY2F0YWxvZ19yb290ICkge1xuXHRcdFx0Y2F0YWxvZ19yb290LnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10ZW1wbGF0ZS1wYWNrJywgbm9ybWFsaXplZF9wYWNrX2lkICk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5vcm1hbGl6ZWRfcGFja19pZDtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb21waWxlIG9uZSBhbGxvdy1saXN0ZWQgV29yZFByZXNzIHRlbXBsYXRlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnICAgICAgICBSZWdpc3RlcmVkIGJyb3dzZXIgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtzdHJpbmd9IHRlbXBsYXRlX3JvbGUgVGVtcGxhdGUgcm9sZS5cblx0ICogQHJldHVybiB7RnVuY3Rpb258bnVsbH0gQ29tcGlsZWQgdGVtcGxhdGUgb3IgbnVsbC5cblx0ICovXG5cdGZ1bmN0aW9uIGxvYWRfdGVtcGxhdGUoIGNvbmZpZywgdGVtcGxhdGVfcm9sZSApIHtcblx0XHR2YXIgdGVtcGxhdGVfaWQgPSBnZXRfdGVtcGxhdGVfaWQoIGNvbmZpZywgdGVtcGxhdGVfcm9sZSApO1xuXG5cdFx0aWYgKCAhIHRlbXBsYXRlX2lkIHx8ICEgd2luZG93LndwIHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiB3aW5kb3cud3AudGVtcGxhdGUgKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuIHdpbmRvdy53cC50ZW1wbGF0ZSggdGVtcGxhdGVfaWQgKTtcblx0XHR9IGNhdGNoICggZXJyb3IgKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogUmVwbGFjZSBvbmUgY2F0YWxvZydzIGN1cnJlbnQgcHJlc2VudGF0aW9uIHdpdGggcmVuZGVyZWQgdGVtcGxhdGUgb3V0cHV0LlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnICAgICAgICBSZWdpc3RlcmVkIGJyb3dzZXIgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtzdHJpbmd9IHRlbXBsYXRlX3JvbGUgQWxsb3ctbGlzdGVkIHRlbXBsYXRlIHJvbGUuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSB0ZW1wbGF0ZV9kYXRhIE5vcm1hbGl6ZWQgdGVtcGxhdGUgZGF0YS5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHJlbmRlcmVkLlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVuZGVyX3RlbXBsYXRlKCBjb25maWcsIHRlbXBsYXRlX3JvbGUsIHRlbXBsYXRlX2RhdGEgKSB7XG5cdFx0dmFyIGNhdGFsb2dfcm9vdDtcblx0XHR2YXIgY2F0YWxvZ19zdGF0ZSA9IGdldF9jYXRhbG9nX3N0YXRlKCBjb25maWcuY2F0YWxvZ19pZCApO1xuXHRcdHZhciByZW5kZXJfdGFyZ2V0O1xuXHRcdHZhciByZW5kZXJlZF9odG1sO1xuXHRcdHZhciB0ZW1wbGF0ZSA9IGxvYWRfdGVtcGxhdGUoIGNvbmZpZywgdGVtcGxhdGVfcm9sZSApO1xuXG5cdFx0aWYgKCAhIGNhdGFsb2dfc3RhdGUgfHwgISBjYXRhbG9nX3N0YXRlLmNvbnRlbnRfZWxlbWVudCB8fCAhIHRlbXBsYXRlICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRyZW5kZXJlZF9odG1sID0gdGVtcGxhdGUoIHRlbXBsYXRlX2RhdGEgfHwge30gKTtcblx0XHR9IGNhdGNoICggZXJyb3IgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmVuZGVyX3RhcmdldCA9IGNhdGFsb2dfc3RhdGUucmVzcG9uc2VfZWxlbWVudCB8fCBjYXRhbG9nX3N0YXRlLmNvbnRlbnRfZWxlbWVudDtcblx0XHRkaXNwYXRjaF9jYXRhbG9nX2V2ZW50KCBjb25maWcsICd3cGJjOnVpLWNhdGFsb2ctYmVmb3JlLXJlbmRlcicsIHtcblx0XHRcdGNhdGFsb2dfaWQ6IGNvbmZpZy5jYXRhbG9nX2lkLFxuXHRcdFx0dGVtcGxhdGVfcm9sZTogdGVtcGxhdGVfcm9sZVxuXHRcdH0gKTtcblx0XHRyZW5kZXJfdGFyZ2V0LmlubmVySFRNTCA9IHJlbmRlcmVkX2h0bWw7XG5cdFx0Y2F0YWxvZ19yb290ID0gY2F0YWxvZ19zdGF0ZS5jb250ZW50X2VsZW1lbnQucGFyZW50Tm9kZTtcblx0XHRpZiAoIGNhdGFsb2dfcm9vdCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgY2F0YWxvZ19yb290LnNldEF0dHJpYnV0ZSApIHtcblx0XHRcdGNhdGFsb2dfcm9vdC5zZXRBdHRyaWJ1dGUoICdhcmlhLWJ1c3knLCAnc2hlbGwnID09PSB0ZW1wbGF0ZV9yb2xlID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xuXHRcdH1cblx0XHRpZiAoICdzaGVsbCcgIT09IHRlbXBsYXRlX3JvbGUgKSB7XG5cdFx0XHRzZXRfY2F0YWxvZ19sb2FkaW5nX3N0YXRlKCBjb25maWcsIGZhbHNlICk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHQvKipcblx0ICogVG9nZ2xlIGEgcGVyc2lzdGVudCBjYXRhbG9nIG92ZXJsYXkgd2l0aG91dCByZW1vdmluZyB0aGUgY3VycmVudCByb3dzLlxuXHQgKlxuXHQgKiBDYXRhbG9ncyB3aXRoIGEgZGVkaWNhdGVkIG92ZXJsYXkga2VlcCB0aGVpciBleGlzdGluZyB0YWJsZSB2aXNpYmxlIGJlbmVhdGhcblx0ICogdGhlIEJvb2tpbmcgQ2FsZW5kYXIgc3Bpbm5lci4gR2VuZXJpYyBjYXRhbG9ncyByZXRhaW4gdGhlIHNoZWxsLXRlbXBsYXRlXG5cdCAqIGZhbGxiYWNrIHdoZW4gbm8gb3ZlcmxheSBpcyBkZWNsYXJlZC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9ICBjb25maWcgICAgIFJlZ2lzdGVyZWQgYnJvd3NlciBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IGlzX2xvYWRpbmcgV2hldGhlciBhIHJlcXVlc3QgaXMgYWN0aXZlLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gYSBwZXJzaXN0ZW50IG92ZXJsYXkgd2FzIHVwZGF0ZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiBzZXRfY2F0YWxvZ19sb2FkaW5nX3N0YXRlKCBjb25maWcsIGlzX2xvYWRpbmcgKSB7XG5cdFx0dmFyIGNhdGFsb2dfc3RhdGUgPSBjb25maWcgJiYgY29uZmlnLmNhdGFsb2dfaWQgPyBnZXRfY2F0YWxvZ19zdGF0ZSggY29uZmlnLmNhdGFsb2dfaWQgKSA6IG51bGw7XG5cdFx0dmFyIGxvYWRpbmdfZWxlbWVudCA9IGNhdGFsb2dfc3RhdGUgPyBjYXRhbG9nX3N0YXRlLmxvYWRpbmdfZWxlbWVudCA6IG51bGw7XG5cblx0XHRpZiAoIGNhdGFsb2dfc3RhdGUgJiYgY2F0YWxvZ19zdGF0ZS5jb250ZW50X2VsZW1lbnQgKSB7XG5cdFx0XHRjYXRhbG9nX3N0YXRlLmNvbnRlbnRfZWxlbWVudC5zZXRBdHRyaWJ1dGUoICdhcmlhLWJ1c3knLCBpc19sb2FkaW5nID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xuXHRcdH1cblx0XHRpZiAoICEgbG9hZGluZ19lbGVtZW50ICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGxvYWRpbmdfZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtdmlzaWJsZScsICEhIGlzX2xvYWRpbmcgKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTZXQgdGhlIHRhYmxlIG1pbmltdW0gd2lkdGggZnJvbSBjdXJyZW50bHkgdmlzaWJsZSBoZWFkZXIgY29udHJhY3RzLlxuXHQgKlxuXHQgKiBEb21haW4gc3R5bGVzIGRlY2xhcmUgYC0td3BiYy1saXN0aW5nLWNvbHVtbi1taW4td2lkdGhgIHBlciBjb2x1bW4uIFRoZVxuXHQgKiBzaGFyZWQgY29udHJvbGxlciBzdW1zIG9ubHkgcmVuZGVyZWQgaGVhZGVycyBzbyB3aWRlL2N1c3RvbSB2aWV3cyBzY3JvbGxcblx0ICogaG9yaXpvbnRhbGx5IHdoaWxlIHNob3J0IHByZXNldHMgY29udGludWUgZmlsbGluZyB0aGUgYXZhaWxhYmxlIHBhbmVsLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnIFJlZ2lzdGVyZWQgYnJvd3NlciBjb25maWd1cmF0aW9uLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3luY19jYXRhbG9nX3RhYmxlX21pbl93aWR0aCggY29uZmlnICkge1xuXHRcdHZhciBtb3VudF9lbGVtZW50ID0gY29uZmlnICYmIGNvbmZpZy5tb3VudF9pZCA/IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBjb25maWcubW91bnRfaWQgKSA6IG51bGw7XG5cdFx0dmFyIHRhYmxlID0gbW91bnRfZWxlbWVudCA/IG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvciggJy53cGJjX3VpX2xpc3RpbmdfX3RhYmxlLS1jYXRhbG9nJyApIDogbnVsbDtcblx0XHR2YXIgaGVhZGVyX2NlbGxzO1xuXHRcdHZhciB0YWJsZV9taW5fd2lkdGggPSAwO1xuXG5cdFx0aWYgKCAhIHRhYmxlIHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aGVhZGVyX2NlbGxzID0gQXJyYXkucHJvdG90eXBlLmZpbHRlci5jYWxsKCB0YWJsZS5xdWVyeVNlbGVjdG9yQWxsKCAndGhlYWQgPiB0ciA+IHRoJyApLCBmdW5jdGlvbiAoIGhlYWRlcl9jZWxsICkge1xuXHRcdFx0cmV0dXJuICEgaGVhZGVyX2NlbGwuaGlkZGVuO1xuXHRcdH0gKTtcblx0XHRoZWFkZXJfY2VsbHMuZm9yRWFjaCggZnVuY3Rpb24gKCBoZWFkZXJfY2VsbCApIHtcblx0XHRcdHZhciBjb2x1bW5fbWluX3dpZHRoID0gcGFyc2VGbG9hdChcblx0XHRcdFx0d2luZG93LmdldENvbXB1dGVkU3R5bGUoIGhlYWRlcl9jZWxsICkuZ2V0UHJvcGVydHlWYWx1ZSggJy0td3BiYy1saXN0aW5nLWNvbHVtbi1taW4td2lkdGgnIClcblx0XHRcdCk7XG5cdFx0XHRpZiAoIGlzRmluaXRlKCBjb2x1bW5fbWluX3dpZHRoICkgJiYgMCA8IGNvbHVtbl9taW5fd2lkdGggKSB7XG5cdFx0XHRcdHRhYmxlX21pbl93aWR0aCArPSBjb2x1bW5fbWluX3dpZHRoO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0XHRpZiAoIDAgPCB0YWJsZV9taW5fd2lkdGggKSB7XG5cdFx0XHR0YWJsZS5zdHlsZS5zZXRQcm9wZXJ0eSggJy0td3BiYy1saXN0aW5nLXRhYmxlLW1pbi13aWR0aCcsIE1hdGguY2VpbCggdGFibGVfbWluX3dpZHRoICkgKyAncHgnICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEtlZXAgdGhlIG9wZW4gY29sdW1uIGN1c3RvbWl6ZXIgaW5zaWRlIHRoZSB1c2FibGUgYnJvd3NlciB2aWV3cG9ydC5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRGV0YWlsc0VsZW1lbnR9IGN1c3RvbWl6ZXIgQ29sdW1uIGN1c3RvbWl6ZXIgZGV0YWlscyBlbGVtZW50LlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gcG9zaXRpb25fZGlzcGxheV9wYW5lbCggY3VzdG9taXplciApIHtcblx0XHR2YXIgcGFuZWwgPSBjdXN0b21pemVyID8gY3VzdG9taXplci5xdWVyeVNlbGVjdG9yKCAnLndwYmNfdWlfbGlzdGluZ19fZGlzcGxheV9wYW5lbCcgKSA6IG51bGw7XG5cdFx0dmFyIHN1bW1hcnkgPSBjdXN0b21pemVyID8gY3VzdG9taXplci5xdWVyeVNlbGVjdG9yKCAnc3VtbWFyeScgKSA6IG51bGw7XG5cdFx0dmFyIGZpZWxkX2xpc3QgPSBjdXN0b21pemVyID8gY3VzdG9taXplci5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWNvbHVtbi1saXN0XScgKSA6IG51bGw7XG5cdFx0dmFyIHN1bW1hcnlfcmVjdDtcblx0XHR2YXIgcGFuZWxfcmVjdDtcblx0XHR2YXIgdmlld3BvcnRfd2lkdGg7XG5cdFx0dmFyIHZpZXdwb3J0X2hlaWdodDtcblx0XHR2YXIgbWFyZ2luID0gMTI7XG5cdFx0dmFyIGdhcCA9IDY7XG5cdFx0dmFyIHNwYWNlX2Fib3ZlO1xuXHRcdHZhciBzcGFjZV9iZWxvdztcblx0XHR2YXIgbmF0dXJhbF9oZWlnaHQ7XG5cdFx0dmFyIG9wZW5fYWJvdmU7XG5cdFx0dmFyIGF2YWlsYWJsZV9oZWlnaHQ7XG5cdFx0dmFyIHJlbmRlcmVkX2hlaWdodDtcblx0XHR2YXIgcGFuZWxfbGVmdDtcblx0XHR2YXIgcGFuZWxfdG9wO1xuXG5cdFx0aWYgKCAhIGN1c3RvbWl6ZXIgfHwgISBjdXN0b21pemVyLm9wZW4gfHwgISBwYW5lbCB8fCAhIHN1bW1hcnkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y3VzdG9taXplci5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtcG9zaXRpb25lZCcgKTtcblx0XHRwYW5lbC5zdHlsZS5yZW1vdmVQcm9wZXJ0eSggJy0td3BiYy1saXN0aW5nLWRpc3BsYXktcGFuZWwtbWF4LWhlaWdodCcgKTtcblx0XHRwYW5lbC5zdHlsZS5yZW1vdmVQcm9wZXJ0eSggJ2xlZnQnICk7XG5cdFx0cGFuZWwuc3R5bGUucmVtb3ZlUHJvcGVydHkoICd0b3AnICk7XG5cdFx0c3VtbWFyeV9yZWN0ID0gc3VtbWFyeS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRwYW5lbF9yZWN0ID0gcGFuZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0dmlld3BvcnRfd2lkdGggPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50V2lkdGggfHwgd2luZG93LmlubmVyV2lkdGggfHwgMDtcblx0XHR2aWV3cG9ydF9oZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHQgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudEhlaWdodCB8fCAwO1xuXHRcdHNwYWNlX2Fib3ZlID0gTWF0aC5tYXgoIDAsIHN1bW1hcnlfcmVjdC50b3AgLSBtYXJnaW4gLSBnYXAgKTtcblx0XHRzcGFjZV9iZWxvdyA9IE1hdGgubWF4KCAwLCB2aWV3cG9ydF9oZWlnaHQgLSBzdW1tYXJ5X3JlY3QuYm90dG9tIC0gbWFyZ2luIC0gZ2FwICk7XG5cdFx0bmF0dXJhbF9oZWlnaHQgPSBwYW5lbC5zY3JvbGxIZWlnaHQ7XG5cdFx0aWYgKCBmaWVsZF9saXN0ICkge1xuXHRcdFx0bmF0dXJhbF9oZWlnaHQgKz0gTWF0aC5tYXgoIDAsIGZpZWxkX2xpc3Quc2Nyb2xsSGVpZ2h0IC0gZmllbGRfbGlzdC5jbGllbnRIZWlnaHQgKTtcblx0XHR9XG5cdFx0b3Blbl9hYm92ZSA9IHNwYWNlX2JlbG93IDwgbmF0dXJhbF9oZWlnaHQgJiYgc3BhY2VfYWJvdmUgPiBzcGFjZV9iZWxvdztcblx0XHRhdmFpbGFibGVfaGVpZ2h0ID0gb3Blbl9hYm92ZSA/IHNwYWNlX2Fib3ZlIDogc3BhY2VfYmVsb3c7XG5cdFx0Y3VzdG9taXplci5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtb3Blbi1hYm92ZScsIG9wZW5fYWJvdmUgKTtcblx0XHRwYW5lbC5zdHlsZS5zZXRQcm9wZXJ0eSggJy0td3BiYy1saXN0aW5nLWRpc3BsYXktcGFuZWwtbWF4LWhlaWdodCcsIE1hdGguZmxvb3IoIGF2YWlsYWJsZV9oZWlnaHQgKSArICdweCcgKTtcblx0XHRyZW5kZXJlZF9oZWlnaHQgPSBwYW5lbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQ7XG5cdFx0cGFuZWxfbGVmdCA9IE1hdGgubWF4KCBtYXJnaW4sIE1hdGgubWluKCBzdW1tYXJ5X3JlY3QucmlnaHQgLSBwYW5lbF9yZWN0LndpZHRoLCB2aWV3cG9ydF93aWR0aCAtIHBhbmVsX3JlY3Qud2lkdGggLSBtYXJnaW4gKSApO1xuXHRcdHBhbmVsX3RvcCA9IG9wZW5fYWJvdmUgPyBzdW1tYXJ5X3JlY3QudG9wIC0gZ2FwIC0gcmVuZGVyZWRfaGVpZ2h0IDogc3VtbWFyeV9yZWN0LmJvdHRvbSArIGdhcDtcblx0XHRwYW5lbF90b3AgPSBNYXRoLm1heCggbWFyZ2luLCBNYXRoLm1pbiggcGFuZWxfdG9wLCB2aWV3cG9ydF9oZWlnaHQgLSByZW5kZXJlZF9oZWlnaHQgLSBtYXJnaW4gKSApO1xuXHRcdHBhbmVsLnN0eWxlLnNldFByb3BlcnR5KCAnbGVmdCcsIE1hdGgucm91bmQoIHBhbmVsX2xlZnQgKSArICdweCcgKTtcblx0XHRwYW5lbC5zdHlsZS5zZXRQcm9wZXJ0eSggJ3RvcCcsIE1hdGgucm91bmQoIHBhbmVsX3RvcCApICsgJ3B4JyApO1xuXHRcdGN1c3RvbWl6ZXIuY2xhc3NMaXN0LmFkZCggJ2lzLXBvc2l0aW9uZWQnICk7XG5cdH1cblxuXHQvKipcblx0ICogQ2xlYXIgZml4ZWQgY29sdW1uLXBhbmVsIGNvb3JkaW5hdGVzIGFmdGVyIHRoZSBjdXN0b21pemVyIGNsb3Nlcy5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRGV0YWlsc0VsZW1lbnR9IGN1c3RvbWl6ZXIgQ29sdW1uIGN1c3RvbWl6ZXIgZGV0YWlscyBlbGVtZW50LlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gcmVzZXRfZGlzcGxheV9wYW5lbF9wb3NpdGlvbiggY3VzdG9taXplciApIHtcblx0XHR2YXIgcGFuZWwgPSBjdXN0b21pemVyID8gY3VzdG9taXplci5xdWVyeVNlbGVjdG9yKCAnLndwYmNfdWlfbGlzdGluZ19fZGlzcGxheV9wYW5lbCcgKSA6IG51bGw7XG5cblx0XHRpZiAoICEgY3VzdG9taXplciB8fCAhIHBhbmVsICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjdXN0b21pemVyLmNsYXNzTGlzdC5yZW1vdmUoICdpcy1vcGVuLWFib3ZlJywgJ2lzLXBvc2l0aW9uZWQnICk7XG5cdFx0cGFuZWwuc3R5bGUucmVtb3ZlUHJvcGVydHkoICctLXdwYmMtbGlzdGluZy1kaXNwbGF5LXBhbmVsLW1heC1oZWlnaHQnICk7XG5cdFx0cGFuZWwuc3R5bGUucmVtb3ZlUHJvcGVydHkoICdsZWZ0JyApO1xuXHRcdHBhbmVsLnN0eWxlLnJlbW92ZVByb3BlcnR5KCAndG9wJyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIENsb3NlIG9uZSBjb2x1bW4gY3VzdG9taXplciBhbmQgb3B0aW9uYWxseSByZXR1cm4gZm9jdXMgdG8gaXRzIHN1bW1hcnkuXG5cdCAqXG5cdCAqIEtleWJvYXJkIGFuZCBleHBsaWNpdCBDbG9zZS1idXR0b24gZGlzbWlzc2FsIHJlc3RvcmUgZm9jdXMgdG8gdGhlIGNvbnRyb2xcblx0ICogdGhhdCBvcGVuZWQgdGhlIHBhbmVsLiBQb2ludGVyIGRpc21pc3NhbCBrZWVwcyB0aGUgcG9pbnRlcidzIG5hdHVyYWwgZm9jdXNcblx0ICogZGVzdGluYXRpb24gd2hpbGUgc2hhcmluZyB0aGUgc2FtZSBkZXRhaWxzLXRvZ2dsZSBjbGVhbnVwIHBhdGguXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTERldGFpbHNFbGVtZW50fG51bGx9IGN1c3RvbWl6ZXIgICAgQ29sdW1uIGN1c3RvbWl6ZXIgZGV0YWlscyBlbGVtZW50LlxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59ICAgICAgICAgICAgICAgICByZXN0b3JlX2ZvY3VzIFdoZXRoZXIgc3VtbWFyeSBmb2N1cyBpcyByZXN0b3JlZC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGNsb3NlX2Rpc3BsYXlfY3VzdG9taXplciggY3VzdG9taXplciwgcmVzdG9yZV9mb2N1cyApIHtcblx0XHR2YXIgc3VtbWFyeTtcblxuXHRcdGlmICggISBjdXN0b21pemVyIHx8ICEgY3VzdG9taXplci5vcGVuICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjdXN0b21pemVyLm9wZW4gPSBmYWxzZTtcblx0XHRpZiAoICEgcmVzdG9yZV9mb2N1cyApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0c3VtbWFyeSA9IGN1c3RvbWl6ZXIucXVlcnlTZWxlY3RvciggJ3N1bW1hcnknICk7XG5cdFx0aWYgKCBzdW1tYXJ5ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBzdW1tYXJ5LmZvY3VzICkge1xuXHRcdFx0c3VtbWFyeS5mb2N1cygpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBSZW5kZXIgYSBnZW5lcmljIHNhZmUgYnJvd3NlciBlcnJvci5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyAgUmVnaXN0ZXJlZCBicm93c2VyIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlIFNhZmUgbG9jYWxpemVkIGVycm9yIG1lc3NhZ2UuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiByZW5kZXJlZC5cblx0ICovXG5cdGZ1bmN0aW9uIHJlbmRlcl9lcnJvciggY29uZmlnLCBtZXNzYWdlICkge1xuXHRcdHZhciBpMThuID0gY29uZmlnLmkxOG4gfHwge307XG5cblx0XHRyZXR1cm4gcmVuZGVyX3RlbXBsYXRlKCBjb25maWcsICdlcnJvcicsIHtcblx0XHRcdHRpdGxlOiBpMThuLmVycm9yX3RpdGxlIHx8ICcnLFxuXHRcdFx0bWVzc2FnZTogbWVzc2FnZSB8fCBpMThuLmVycm9yX21lc3NhZ2UgfHwgJydcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogRGlzcGF0Y2ggb25lIHNoYXJlZCBjYXRhbG9nIGxpZmVjeWNsZSBldmVudCBmcm9tIHRoZSBjdXJyZW50IG1vdW50LlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnICAgICBSZWdpc3RlcmVkIGJyb3dzZXIgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50X25hbWUgU3RhYmxlIHNoYXJlZCBldmVudCBuYW1lLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gZGV0YWlsICAgICBKU09OLXNhZmUgZXZlbnQgZGV0YWlsLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIGV2ZW50IHdhcyBkaXNwYXRjaGVkLlxuXHQgKi9cblx0ZnVuY3Rpb24gZGlzcGF0Y2hfY2F0YWxvZ19ldmVudCggY29uZmlnLCBldmVudF9uYW1lLCBkZXRhaWwgKSB7XG5cdFx0dmFyIGNhdGFsb2dfZXZlbnQ7XG5cdFx0dmFyIGNhdGFsb2dfc3RhdGUgPSBnZXRfY2F0YWxvZ19zdGF0ZSggY29uZmlnLmNhdGFsb2dfaWQgKTtcblxuXHRcdGlmICggISBjYXRhbG9nX3N0YXRlIHx8ICEgY2F0YWxvZ19zdGF0ZS5jb250ZW50X2VsZW1lbnQgfHwgJ3N0cmluZycgIT09IHR5cGVvZiBldmVudF9uYW1lICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5DdXN0b21FdmVudCApIHtcblx0XHRcdGNhdGFsb2dfZXZlbnQgPSBuZXcgd2luZG93LkN1c3RvbUV2ZW50KCBldmVudF9uYW1lLCB7XG5cdFx0XHRcdGJ1YmJsZXM6IHRydWUsXG5cdFx0XHRcdGRldGFpbDogZGV0YWlsIHx8IHt9XG5cdFx0XHR9ICk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNhdGFsb2dfZXZlbnQgPSBkb2N1bWVudC5jcmVhdGVFdmVudCggJ0N1c3RvbUV2ZW50JyApO1xuXHRcdFx0Y2F0YWxvZ19ldmVudC5pbml0Q3VzdG9tRXZlbnQoIGV2ZW50X25hbWUsIHRydWUsIGZhbHNlLCBkZXRhaWwgfHwge30gKTtcblx0XHR9XG5cblx0XHRjYXRhbG9nX3N0YXRlLmNvbnRlbnRfZWxlbWVudC5kaXNwYXRjaEV2ZW50KCBjYXRhbG9nX2V2ZW50ICk7XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBcHBlbmQgb25lIG5vcm1hbGl6ZWQgcmVxdWVzdCB2YWx1ZSB0byBhIFVSTC1lbmNvZGVkIEFKQVggYm9keS5cblx0ICpcblx0ICogQHBhcmFtIHtVUkxTZWFyY2hQYXJhbXN9IHJlcXVlc3RfYm9keSAgUmVxdWVzdCBib2R5IHJlY2VpdmluZyB2YWx1ZXMuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICByZXF1ZXN0X2tleSAgIE5vcm1hbGl6ZWQgcmVxdWVzdCBrZXkuXG5cdCAqIEBwYXJhbSB7Kn0gICAgICAgICAgICAgICByZXF1ZXN0X3ZhbHVlIFNjYWxhciBvciBzY2FsYXItYXJyYXkgdmFsdWUuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBhcHBlbmRfcmVxdWVzdF92YWx1ZSggcmVxdWVzdF9ib2R5LCByZXF1ZXN0X2tleSwgcmVxdWVzdF92YWx1ZSApIHtcblx0XHRpZiAoIEFycmF5LmlzQXJyYXkoIHJlcXVlc3RfdmFsdWUgKSApIHtcblx0XHRcdHJlcXVlc3RfdmFsdWUuZm9yRWFjaCggZnVuY3Rpb24gKCBhcnJheV92YWx1ZSApIHtcblx0XHRcdFx0aWYgKCBudWxsICE9PSBhcnJheV92YWx1ZSAmJiAnb2JqZWN0JyAhPT0gdHlwZW9mIGFycmF5X3ZhbHVlICkge1xuXHRcdFx0XHRcdHJlcXVlc3RfYm9keS5hcHBlbmQoIHJlcXVlc3Rfa2V5ICsgJ1tdJywgU3RyaW5nKCBhcnJheV92YWx1ZSApICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIG51bGwgIT09IHJlcXVlc3RfdmFsdWUgJiYgJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiByZXF1ZXN0X3ZhbHVlICYmICdvYmplY3QnICE9PSB0eXBlb2YgcmVxdWVzdF92YWx1ZSApIHtcblx0XHRcdHJlcXVlc3RfYm9keS5hcHBlbmQoIHJlcXVlc3Rfa2V5LCBTdHJpbmcoIHJlcXVlc3RfdmFsdWUgKSApO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gb3JkZXJlZCBjb2x1bW4gSURzIGZyb20gdGhlIGN1cnJlbnQgZGlzcGxheSBjb250cm9scy5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbW91bnRfZWxlbWVudCBDYXRhbG9nIG1vdW50IGVsZW1lbnQuXG5cdCAqIEByZXR1cm4ge3N0cmluZ1tdfSBDdXJyZW50IGNvbHVtbiBvcmRlci5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9jb2x1bW5fb3JkZXIoIG1vdW50X2VsZW1lbnQgKSB7XG5cdFx0cmV0dXJuIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKCBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctY29sdW1uLWl0ZW1dJyApICkubWFwKCBmdW5jdGlvbiAoIGNvbHVtbl9pdGVtICkge1xuXHRcdFx0cmV0dXJuIGNvbHVtbl9pdGVtLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy11aS1jYXRhbG9nLWNvbHVtbi1pdGVtJyApIHx8ICcnO1xuXHRcdH0gKS5maWx0ZXIoIGZ1bmN0aW9uICggY29sdW1uX2lkICkge1xuXHRcdFx0cmV0dXJuICEhIGNvbHVtbl9pZDtcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIHZpc2libGUgY29sdW1uIElEcyBmcm9tIHRoZSBjdXJyZW50IGRpc3BsYXkgY29udHJvbHMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IG1vdW50X2VsZW1lbnQgQ2F0YWxvZyBtb3VudCBlbGVtZW50LlxuXHQgKiBAcmV0dXJuIHtzdHJpbmdbXX0gQ3VycmVudCB2aXNpYmxlIGNvbHVtbnMuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfdmlzaWJsZV9jb2x1bW5zKCBtb3VudF9lbGVtZW50ICkge1xuXHRcdHJldHVybiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCggbW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWNvbHVtbi12aXNpYmxlXScgKSApLmZpbHRlciggZnVuY3Rpb24gKCBjb2x1bW5fY29udHJvbCApIHtcblx0XHRcdHJldHVybiBjb2x1bW5fY29udHJvbC5jaGVja2VkO1xuXHRcdH0gKS5tYXAoIGZ1bmN0aW9uICggY29sdW1uX2NvbnRyb2wgKSB7XG5cdFx0XHRyZXR1cm4gY29sdW1uX2NvbnRyb2wudmFsdWU7XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlcXVlc3QgdGhlIGN1cnJlbnQgY29sdW1uIGNvbnRyb2xzIGFuZCBwZXJzaXN0IHRoZSB2YWxpZGF0ZWQgcmVzdWx0LlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBjb25maWcgICAgICAgIFJlZ2lzdGVyZWQgYnJvd3NlciBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBtb3VudF9lbGVtZW50IENhdGFsb2cgbW91bnQgZWxlbWVudC5cblx0ICogQHJldHVybiB7UHJvbWlzZTxib29sZWFuPn0gU2hhcmVkIHJlcXVlc3QgcmVzdWx0LlxuXHQgKi9cblx0ZnVuY3Rpb24gc2F2ZV9jb2x1bW5fY29udHJvbHMoIGNvbmZpZywgbW91bnRfZWxlbWVudCApIHtcblx0XHR2YXIgdmlld19jb250cm9sID0gbW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXZpZXddJyApO1xuXG5cdFx0aWYgKCB2aWV3X2NvbnRyb2wgKSB7XG5cdFx0XHR2aWV3X2NvbnRyb2wudmFsdWUgPSAnY3VzdG9tJztcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVxdWVzdF9jYXRhbG9nKCBjb25maWcsIHtcblx0XHRcdGNvbHVtbl9vcmRlcjogZ2V0X2NvbHVtbl9vcmRlciggbW91bnRfZWxlbWVudCApLFxuXHRcdFx0cGFnZV9udW1iZXI6IDEsXG5cdFx0XHRwcmVmZXJlbmNlX2FjdGlvbjogJ3NhdmUnLFxuXHRcdFx0dmlzaWJsZV9jb2x1bW5zOiBnZXRfdmlzaWJsZV9jb2x1bW5zKCBtb3VudF9lbGVtZW50IClcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogQW5ub3VuY2UgYSBjb21wbGV0ZWQgY29sdW1uLW9yZGVyIGNoYW5nZSB0byBhc3Npc3RpdmUgdGVjaG5vbG9neS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgY29uZmlnICAgICAgICBSZWdpc3RlcmVkIGJyb3dzZXIgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbW91bnRfZWxlbWVudCBDYXRhbG9nIG1vdW50IGVsZW1lbnQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBhbm5vdW5jZV9jb2x1bW5fbW92ZWQoIGNvbmZpZywgbW91bnRfZWxlbWVudCApIHtcblx0XHR2YXIgc3RhdHVzX2VsZW1lbnQgPSBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctY29sdW1uLXN0YXR1c10nICk7XG5cblx0XHRpZiAoICEgc3RhdHVzX2VsZW1lbnQgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHN0YXR1c19lbGVtZW50LnRleHRDb250ZW50ID0gJyc7XG5cdFx0d2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdHN0YXR1c19lbGVtZW50LnRleHRDb250ZW50ID0gY29uZmlnLmkxOG4gJiYgY29uZmlnLmkxOG4uY29sdW1uX21vdmVkID8gY29uZmlnLmkxOG4uY29sdW1uX21vdmVkIDogJyc7XG5cdFx0fSwgMCApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFN5bmNocm9uaXplIHRoZSBjdXJyZW50IGNhdGFsb2cgc3RhdGUgaW50byB0aGUgaW5pdGlhbCBVUkwgYWxpYXNlcy5cblx0ICpcblx0ICogU2VhcmNoIGFuZCBwYWdlIG51bWJlciByZW1haW4gcmVxdWVzdC1sb2NhbCBidXQgc3Vydml2ZSBhIG5vcm1hbCByZWZyZXNoXG5cdCAqIHRocm91Z2ggdGhlIFVSTC4gUGVyc2lzdGVkIHNldHRpbmdzIGFyZSBhbHNvIHJlZmxlY3RlZCBmb3Igc2hhcmVhYmxlIHN0YXRlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnICAgUmVnaXN0ZXJlZCBicm93c2VyIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSByZXNwb25zZSBOb3JtYWxpemVkIHN1Y2Nlc3NmdWwgcmVzcG9uc2UuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiB1cGRhdGVfdXJsX3N0YXRlKCBjb25maWcsIHJlc3BvbnNlICkge1xuXHRcdHZhciBmaWx0ZXJzID0gcmVzcG9uc2UuZmlsdGVycyB8fCB7fTtcblx0XHR2YXIgcGFyYW1ldGVycyA9IGNvbmZpZy51cmxfcGFyYW1ldGVycyB8fCB7fTtcblx0XHR2YXIgc3RhdGVfdmFsdWVzID0ge1xuXHRcdFx0cGFnZV9udW1iZXI6IHJlc3BvbnNlLnBhZ2luYXRpb24ucGFnZV9udW1iZXIsXG5cdFx0XHRpdGVtc19wZXJfcGFnZTogcmVzcG9uc2UucGFnaW5hdGlvbi5pdGVtc19wZXJfcGFnZSxcblx0XHRcdHNvcnRfYnk6IHJlc3BvbnNlLnNvcnRpbmcuc29ydF9ieSxcblx0XHRcdHNvcnRfb3JkZXI6IHJlc3BvbnNlLnNvcnRpbmcuc29ydF9vcmRlcixcblx0XHRcdHNlYXJjaDogZmlsdGVycy5zZWFyY2ggfHwgJycsXG5cdFx0XHR2aXNpYmxlX2NvbHVtbnM6IHJlc3BvbnNlLmRpc3BsYXkudmlzaWJsZV9jb2x1bW5zIHx8IFtdLFxuXHRcdFx0Y29sdW1uX29yZGVyOiByZXNwb25zZS5kaXNwbGF5LmNvbHVtbl9vcmRlciB8fCBbXSxcblx0XHRcdHRlbXBsYXRlX3BhY2s6IHJlc3BvbnNlLmRpc3BsYXkudGVtcGxhdGVfcGFjayB8fCAnJ1xuXHRcdH07XG5cdFx0dmFyIHBhZ2VfdXJsO1xuXG5cdFx0aWYgKCAhIHdpbmRvdy5oaXN0b3J5IHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiB3aW5kb3cuaGlzdG9yeS5yZXBsYWNlU3RhdGUgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy5VUkwgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cGFnZV91cmwgPSBuZXcgd2luZG93LlVSTCggd2luZG93LmxvY2F0aW9uLmhyZWYgKTtcblx0XHRPYmplY3Qua2V5cyggZmlsdGVycyApLmZvckVhY2goIGZ1bmN0aW9uICggZmlsdGVyX2tleSApIHtcblx0XHRcdHN0YXRlX3ZhbHVlc1sgZmlsdGVyX2tleSBdID0gZmlsdGVyc1sgZmlsdGVyX2tleSBdO1xuXHRcdH0gKTtcblx0XHRPYmplY3Qua2V5cyggcGFyYW1ldGVycyApLmZvckVhY2goIGZ1bmN0aW9uICggc3RhdGVfa2V5ICkge1xuXHRcdFx0dmFyIHBhcmFtZXRlcl9uYW1lID0gcGFyYW1ldGVyc1sgc3RhdGVfa2V5IF07XG5cdFx0XHR2YXIgc3RhdGVfdmFsdWUgPSBzdGF0ZV92YWx1ZXNbIHN0YXRlX2tleSBdO1xuXHRcdFx0aWYgKCAhIHBhcmFtZXRlcl9uYW1lICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIEFycmF5LmlzQXJyYXkoIHN0YXRlX3ZhbHVlICkgKSB7XG5cdFx0XHRcdHN0YXRlX3ZhbHVlID0gc3RhdGVfdmFsdWUuam9pbiggJywnICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICcnID09PSBzdGF0ZV92YWx1ZSB8fCBudWxsID09PSBzdGF0ZV92YWx1ZSB8fCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIHN0YXRlX3ZhbHVlICkge1xuXHRcdFx0XHRwYWdlX3VybC5zZWFyY2hQYXJhbXMuZGVsZXRlKCBwYXJhbWV0ZXJfbmFtZSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cGFnZV91cmwuc2VhcmNoUGFyYW1zLnNldCggcGFyYW1ldGVyX25hbWUsIFN0cmluZyggc3RhdGVfdmFsdWUgKSApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0XHR3aW5kb3cuaGlzdG9yeS5yZXBsYWNlU3RhdGUoIHt9LCBkb2N1bWVudC50aXRsZSwgcGFnZV91cmwudG9TdHJpbmcoKSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIEJpbmQgZG9tYWluLW5ldXRyYWwgZGVsZWdhdGVkIGNhdGFsb2cgY29udHJvbHMgb25jZSBwZXIgbW91bnQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGNvbmZpZyAgICAgICAgUmVnaXN0ZXJlZCBicm93c2VyIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IG1vdW50X2VsZW1lbnQgQ2F0YWxvZyBtb3VudCBlbGVtZW50LlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gYmluZF9jYXRhbG9nX2NvbnRyb2xzKCBjb25maWcsIG1vdW50X2VsZW1lbnQgKSB7XG5cdFx0dmFyIGNhdGFsb2dfc3RhdGUgPSBnZXRfY2F0YWxvZ19zdGF0ZSggY29uZmlnLmNhdGFsb2dfaWQgKTtcblxuXHRcdGlmICggISBjYXRhbG9nX3N0YXRlIHx8IG1vdW50X2VsZW1lbnQuX3dwYmNfdWlfY2F0YWxvZ19jb250cm9sc19ib3VuZCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0bW91bnRfZWxlbWVudC5fd3BiY191aV9jYXRhbG9nX2NvbnRyb2xzX2JvdW5kID0gdHJ1ZTtcblxuXHRcdG1vdW50X2VsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3N1Ym1pdCcsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHR2YXIgc2VhcmNoX2NvbnRyb2w7XG5cdFx0XHRpZiAoICEgZXZlbnQudGFyZ2V0Lm1hdGNoZXMoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctZmlsdGVyc10nICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRzZWFyY2hfY29udHJvbCA9IG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1zZWFyY2hdJyApO1xuXHRcdFx0cmVxdWVzdF9jYXRhbG9nKCBjb25maWcsIHsgcGFnZV9udW1iZXI6IDEsIHNlYXJjaDogc2VhcmNoX2NvbnRyb2wgPyBzZWFyY2hfY29udHJvbC52YWx1ZSA6ICcnIH0gKTtcblx0XHR9ICk7XG5cblx0XHRtb3VudF9lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHR2YXIgY2xlYXJfY29udHJvbDtcblx0XHRcdGlmICggISBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1zZWFyY2hdJyApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjbGVhcl9jb250cm9sID0gbW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXNlYXJjaC1jbGVhcl0nICk7XG5cdFx0XHRpZiAoIGNsZWFyX2NvbnRyb2wgKSB7XG5cdFx0XHRcdGNsZWFyX2NvbnRyb2wuaGlkZGVuID0gISBldmVudC50YXJnZXQudmFsdWU7XG5cdFx0XHR9XG5cdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KCBjYXRhbG9nX3N0YXRlLnNlYXJjaF90aW1lciApO1xuXHRcdFx0Y2F0YWxvZ19zdGF0ZS5zZWFyY2hfdGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXF1ZXN0X2NhdGFsb2coIGNvbmZpZywgeyBwYWdlX251bWJlcjogMSwgc2VhcmNoOiBldmVudC50YXJnZXQudmFsdWUgfHwgJycgfSApO1xuXHRcdFx0fSwgZ2V0X3NlYXJjaF9kZWJvdW5jZV9kZWxheSggY29uZmlnICkgKTtcblx0XHR9ICk7XG5cblx0XHRtb3VudF9lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0dmFyIGRlZmF1bHRfcmVxdWVzdCA9IGNvbmZpZy5kZWZhdWx0X3JlcXVlc3QgfHwge307XG5cdFx0XHR2YXIgZmlsdGVyX2tleTtcblx0XHRcdGlmICggZXZlbnQudGFyZ2V0Lm1hdGNoZXMoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaXRlbXMtcGVyLXBhZ2VdJyApICkge1xuXHRcdFx0XHRyZXF1ZXN0X2NhdGFsb2coIGNvbmZpZywgeyBpdGVtc19wZXJfcGFnZTogTnVtYmVyKCBldmVudC50YXJnZXQudmFsdWUgKSwgcGFnZV9udW1iZXI6IDEsIHByZWZlcmVuY2VfYWN0aW9uOiAnc2F2ZScgfSApO1xuXHRcdFx0fSBlbHNlIGlmICggZXZlbnQudGFyZ2V0Lm1hdGNoZXMoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctcGFnZS1udW1iZXJdJyApICkge1xuXHRcdFx0XHRyZXF1ZXN0X2NhdGFsb2coIGNvbmZpZywgeyBwYWdlX251bWJlcjogTnVtYmVyKCBldmVudC50YXJnZXQudmFsdWUgKSB8fCAxIH0gKTtcblx0XHRcdH0gZWxzZSBpZiAoIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXRlbXBsYXRlLXBhY2tdJyApICkge1xuXHRcdFx0XHRpZiAoIGNvbmZpZy50ZW1wbGF0ZV9wYWNrcyAmJiBjb25maWcudGVtcGxhdGVfcGFja3NbIGV2ZW50LnRhcmdldC52YWx1ZSBdICkge1xuXHRcdFx0XHRcdHJlcXVlc3RfY2F0YWxvZyggY29uZmlnLCB7XG5cdFx0XHRcdFx0XHRwYWdlX251bWJlcjogMSxcblx0XHRcdFx0XHRcdHByZWZlcmVuY2VfYWN0aW9uOiAnc2F2ZScsXG5cdFx0XHRcdFx0XHR0ZW1wbGF0ZV9wYWNrOiBldmVudC50YXJnZXQudmFsdWVcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWZpbHRlcl0nICkgKSB7XG5cdFx0XHRcdGZpbHRlcl9rZXkgPSBldmVudC50YXJnZXQuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctZmlsdGVyJyApIHx8ICcnO1xuXHRcdFx0XHRpZiAoIC9eW2EtejAtOV9dKyQvLnRlc3QoIGZpbHRlcl9rZXkgKSApIHtcblx0XHRcdFx0XHR2YXIgZmlsdGVyX3JlcXVlc3QgPSB7IHBhZ2VfbnVtYmVyOiAxLCBwcmVmZXJlbmNlX2FjdGlvbjogJ3NhdmUnIH07XG5cdFx0XHRcdFx0ZmlsdGVyX3JlcXVlc3RbIGZpbHRlcl9rZXkgXSA9IGV2ZW50LnRhcmdldC52YWx1ZTtcblx0XHRcdFx0XHRyZXF1ZXN0X2NhdGFsb2coIGNvbmZpZywgZmlsdGVyX3JlcXVlc3QgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmICggZXZlbnQudGFyZ2V0Lm1hdGNoZXMoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctY29sdW1uLXZpc2libGVdJyApICkge1xuXHRcdFx0XHRzYXZlX2NvbHVtbl9jb250cm9scyggY29uZmlnLCBtb3VudF9lbGVtZW50ICk7XG5cdFx0XHR9IGVsc2UgaWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy12aWV3XScgKSAmJiAnY3VzdG9tJyAhPT0gZXZlbnQudGFyZ2V0LnZhbHVlICkge1xuXHRcdFx0XHR2YXIgdmlld19kZWZpbml0aW9uID0gY29uZmlnLnZpZXdzICYmIGNvbmZpZy52aWV3cy5kZWZpbml0aW9ucyA/IGNvbmZpZy52aWV3cy5kZWZpbml0aW9uc1sgZXZlbnQudGFyZ2V0LnZhbHVlIF0gOiBudWxsO1xuXHRcdFx0XHRpZiAoIHZpZXdfZGVmaW5pdGlvbiAmJiBBcnJheS5pc0FycmF5KCB2aWV3X2RlZmluaXRpb24uZmllbGRzICkgKSB7XG5cdFx0XHRcdFx0cmVxdWVzdF9jYXRhbG9nKCBjb25maWcsIHtcblx0XHRcdFx0XHRcdHBhZ2VfbnVtYmVyOiAxLFxuXHRcdFx0XHRcdFx0cHJlZmVyZW5jZV9hY3Rpb246ICdzYXZlJyxcblx0XHRcdFx0XHRcdHZpc2libGVfY29sdW1uczogdmlld19kZWZpbml0aW9uLmZpZWxkc1xuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gKTtcblxuXHRcdG1vdW50X2VsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdHZhciBjbG9zZV9jb250cm9sID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctZGlzcGxheS1jbG9zZV0nICk7XG5cdFx0XHR2YXIgZGVmYXVsdF9yZXF1ZXN0ID0gY29uZmlnLmRlZmF1bHRfcmVxdWVzdCB8fCB7fTtcblx0XHRcdHZhciBwYWdlX2NvbnRyb2wgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1wYWdlXScgKTtcblx0XHRcdHZhciByZXNldF9jb250cm9sID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctcHJlZmVyZW5jZXMtcmVzZXRdJyApO1xuXHRcdFx0dmFyIHJlc2V0X29yZGVyX2NvbnRyb2wgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1jb2x1bW4tb3JkZXItcmVzZXRdJyApO1xuXHRcdFx0dmFyIHNlYXJjaF9jbGVhciA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXNlYXJjaC1jbGVhcl0nICk7XG5cdFx0XHR2YXIgc29ydF9jb250cm9sID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctc29ydF0nICk7XG5cdFx0XHR2YXIgc29ydF9rZXk7XG5cblx0XHRcdGlmICggc2VhcmNoX2NsZWFyICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR2YXIgc2VhcmNoX2NvbnRyb2wgPSBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctc2VhcmNoXScgKTtcblx0XHRcdFx0d2luZG93LmNsZWFyVGltZW91dCggY2F0YWxvZ19zdGF0ZS5zZWFyY2hfdGltZXIgKTtcblx0XHRcdFx0aWYgKCBzZWFyY2hfY29udHJvbCApIHtcblx0XHRcdFx0XHRzZWFyY2hfY29udHJvbC52YWx1ZSA9ICcnO1xuXHRcdFx0XHRcdHNlYXJjaF9jb250cm9sLmZvY3VzKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0c2VhcmNoX2NsZWFyLmhpZGRlbiA9IHRydWU7XG5cdFx0XHRcdGlmICggaXNfaW1tZWRpYXRlX3NlYXJjaF9jbGVhcl9lbmFibGVkKCBjb25maWcgKSApIHtcblx0XHRcdFx0XHRyZXF1ZXN0X2NhdGFsb2coIGNvbmZpZywgeyBwYWdlX251bWJlcjogMSwgc2VhcmNoOiAnJyB9ICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y2F0YWxvZ19zdGF0ZS5zZWFyY2hfdGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0cmVxdWVzdF9jYXRhbG9nKCBjb25maWcsIHsgcGFnZV9udW1iZXI6IDEsIHNlYXJjaDogJycgfSApO1xuXHRcdFx0XHRcdH0sIGdldF9zZWFyY2hfZGVib3VuY2VfZGVsYXkoIGNvbmZpZyApICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoIHNvcnRfY29udHJvbCApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0c29ydF9rZXkgPSBzb3J0X2NvbnRyb2wuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctc29ydCcgKSB8fCAnJztcblx0XHRcdFx0cmVxdWVzdF9jYXRhbG9nKCBjb25maWcsIHtcblx0XHRcdFx0XHRwYWdlX251bWJlcjogMSxcblx0XHRcdFx0XHRwcmVmZXJlbmNlX2FjdGlvbjogJ3NhdmUnLFxuXHRcdFx0XHRcdHNvcnRfYnk6IHNvcnRfa2V5LFxuXHRcdFx0XHRcdHNvcnRfb3JkZXI6IHNvcnRfa2V5ID09PSBjYXRhbG9nX3N0YXRlLnJlcXVlc3RfdmFsdWVzLnNvcnRfYnkgJiYgJ2FzYycgPT09IGNhdGFsb2dfc3RhdGUucmVxdWVzdF92YWx1ZXMuc29ydF9vcmRlciA/ICdkZXNjJyA6ICdhc2MnXG5cdFx0XHRcdH0gKTtcblx0XHRcdH0gZWxzZSBpZiAoIHBhZ2VfY29udHJvbCAmJiAhIHBhZ2VfY29udHJvbC5kaXNhYmxlZCApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0cmVxdWVzdF9jYXRhbG9nKCBjb25maWcsIHsgcGFnZV9udW1iZXI6IE51bWJlciggcGFnZV9jb250cm9sLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy11aS1jYXRhbG9nLXBhZ2UnICkgKSB8fCAxIH0gKTtcblx0XHRcdH0gZWxzZSBpZiAoIHJlc2V0X29yZGVyX2NvbnRyb2wgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHJlcXVlc3RfY2F0YWxvZyggY29uZmlnLCB7IGNvbHVtbl9vcmRlcjogZGVmYXVsdF9yZXF1ZXN0LmNvbHVtbl9vcmRlciB8fCBbXSwgcGFnZV9udW1iZXI6IDEsIHByZWZlcmVuY2VfYWN0aW9uOiAnc2F2ZScgfSApO1xuXHRcdFx0fSBlbHNlIGlmICggcmVzZXRfY29udHJvbCApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0cmVxdWVzdF9jYXRhbG9nKCBjb25maWcsIE9iamVjdC5hc3NpZ24oIHt9LCBkZWZhdWx0X3JlcXVlc3QsIHsgcHJlZmVyZW5jZV9hY3Rpb246ICdyZXNldCcgfSApICk7XG5cdFx0XHR9IGVsc2UgaWYgKCBjbG9zZV9jb250cm9sICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR2YXIgY3VzdG9taXplciA9IGNsb3NlX2NvbnRyb2wuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1kaXNwbGF5LWN1c3RvbWl6ZXJdJyApO1xuXHRcdFx0XHRjbG9zZV9kaXNwbGF5X2N1c3RvbWl6ZXIoIGN1c3RvbWl6ZXIsIHRydWUgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cblx0XHRtb3VudF9lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdHZhciBjdXN0b21pemVyID0gZXZlbnQudGFyZ2V0ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBldmVudC50YXJnZXQuY2xvc2VzdFxuXHRcdFx0XHQ/IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWRpc3BsYXktY3VzdG9taXplcl0nIClcblx0XHRcdFx0OiBudWxsO1xuXHRcdFx0aWYgKCAnRXNjYXBlJyAhPT0gZXZlbnQua2V5IHx8ICEgY3VzdG9taXplciB8fCAhIGN1c3RvbWl6ZXIub3BlbiApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGNsb3NlX2Rpc3BsYXlfY3VzdG9taXplciggY3VzdG9taXplciwgdHJ1ZSApO1xuXHRcdH0gKTtcblxuXHRcdG1vdW50X2VsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3RvZ2dsZScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHR2YXIgY3VzdG9taXplciA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWRpc3BsYXktY3VzdG9taXplcl0nICk7XG5cdFx0XHRpZiAoICEgY3VzdG9taXplciApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjdXN0b21pemVyLm9wZW4gKSB7XG5cdFx0XHRcdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRwb3NpdGlvbl9kaXNwbGF5X3BhbmVsKCBjdXN0b21pemVyICk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlc2V0X2Rpc3BsYXlfcGFuZWxfcG9zaXRpb24oIGN1c3RvbWl6ZXIgKTtcblx0XHRcdH1cblx0XHR9LCB0cnVlICk7XG5cblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0dmFyIGN1c3RvbWl6ZXIgPSBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctZGlzcGxheS1jdXN0b21pemVyXScgKTtcblx0XHRcdGlmICggY3VzdG9taXplciAmJiBjdXN0b21pemVyLm9wZW4gJiYgISBjdXN0b21pemVyLmNvbnRhaW5zKCBldmVudC50YXJnZXQgKSApIHtcblx0XHRcdFx0Y2xvc2VfZGlzcGxheV9jdXN0b21pemVyKCBjdXN0b21pemVyLCBmYWxzZSApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ3Jlc2l6ZScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdHBvc2l0aW9uX2Rpc3BsYXlfcGFuZWwoIG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1kaXNwbGF5LWN1c3RvbWl6ZXJdJyApICk7XG5cdFx0XHRzeW5jX2NhdGFsb2dfdGFibGVfbWluX3dpZHRoKCBjb25maWcgKTtcblx0XHR9ICk7XG5cdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICdzY3JvbGwnLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0dmFyIGN1c3RvbWl6ZXIgPSBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctZGlzcGxheS1jdXN0b21pemVyXScgKTtcblx0XHRcdGlmIChcblx0XHRcdFx0Y3VzdG9taXplclxuXHRcdFx0XHQmJiBjdXN0b21pemVyLm9wZW5cblx0XHRcdFx0JiYgKFxuXHRcdFx0XHRcdCEgZXZlbnQudGFyZ2V0XG5cdFx0XHRcdFx0fHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIGV2ZW50LnRhcmdldC5jbG9zZXN0XG5cdFx0XHRcdFx0fHwgISBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1kaXNwbGF5LWN1c3RvbWl6ZXJdJyApXG5cdFx0XHRcdClcblx0XHRcdCkge1xuXHRcdFx0XHRwb3NpdGlvbl9kaXNwbGF5X3BhbmVsKCBjdXN0b21pemVyICk7XG5cdFx0XHR9XG5cdFx0fSwgdHJ1ZSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIEluaXRpYWxpemUgcG9pbnRlciBhbmQga2V5Ym9hcmQgY29sdW1uIG9yZGVyaW5nIGFmdGVyIHRvb2xiYXIgcmVuZGVyaW5nLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnIFJlZ2lzdGVyZWQgYnJvd3NlciBjb25maWd1cmF0aW9uLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gcmVmcmVzaF9jYXRhbG9nX2NvbnRyb2xzKCBjb25maWcgKSB7XG5cdFx0dmFyIGNhdGFsb2dfc3RhdGUgPSBnZXRfY2F0YWxvZ19zdGF0ZSggY29uZmlnLmNhdGFsb2dfaWQgKTtcblx0XHR2YXIgbW91bnRfZWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBjb25maWcubW91bnRfaWQgKTtcblx0XHR2YXIgY29sdW1uX2xpc3QgPSBtb3VudF9lbGVtZW50ID8gbW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWNvbHVtbi1saXN0XScgKSA6IG51bGw7XG5cblx0XHRpZiAoICEgY2F0YWxvZ19zdGF0ZSB8fCAhIGNvbHVtbl9saXN0IHx8IGNvbHVtbl9saXN0Ll93cGJjX3VpX2NhdGFsb2dfaW5pdGlhbGl6ZWQgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbHVtbl9saXN0Ll93cGJjX3VpX2NhdGFsb2dfaW5pdGlhbGl6ZWQgPSB0cnVlO1xuXHRcdGNvbHVtbl9saXN0LmFkZEV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdHZhciBoYW5kbGUgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1jb2x1bW4tZHJhZy1oYW5kbGVdJyApO1xuXHRcdFx0dmFyIGl0ZW07XG5cdFx0XHR2YXIgc2libGluZztcblx0XHRcdGlmICggISBoYW5kbGUgfHwgKCAnQXJyb3dVcCcgIT09IGV2ZW50LmtleSAmJiAnQXJyb3dEb3duJyAhPT0gZXZlbnQua2V5ICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGl0ZW0gPSBoYW5kbGUuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1jb2x1bW4taXRlbV0nICk7XG5cdFx0XHRzaWJsaW5nID0gJ0Fycm93VXAnID09PSBldmVudC5rZXkgPyBpdGVtLnByZXZpb3VzRWxlbWVudFNpYmxpbmcgOiBpdGVtLm5leHRFbGVtZW50U2libGluZztcblx0XHRcdHdoaWxlICggc2libGluZyAmJiAnMScgIT09IHNpYmxpbmcuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctY29sdW1uLXJlb3JkZXJhYmxlJyApICkge1xuXHRcdFx0XHRzaWJsaW5nID0gJ0Fycm93VXAnID09PSBldmVudC5rZXkgPyBzaWJsaW5nLnByZXZpb3VzRWxlbWVudFNpYmxpbmcgOiBzaWJsaW5nLm5leHRFbGVtZW50U2libGluZztcblx0XHRcdH1cblx0XHRcdGlmICggISBzaWJsaW5nICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0aWYgKCAnQXJyb3dVcCcgPT09IGV2ZW50LmtleSApIHtcblx0XHRcdFx0Y29sdW1uX2xpc3QuaW5zZXJ0QmVmb3JlKCBpdGVtLCBzaWJsaW5nICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb2x1bW5fbGlzdC5pbnNlcnRCZWZvcmUoIHNpYmxpbmcsIGl0ZW0gKTtcblx0XHRcdH1cblx0XHRcdHNhdmVfY29sdW1uX2NvbnRyb2xzKCBjb25maWcsIG1vdW50X2VsZW1lbnQgKTtcblx0XHRcdGFubm91bmNlX2NvbHVtbl9tb3ZlZCggY29uZmlnLCBtb3VudF9lbGVtZW50ICk7XG5cdFx0XHRoYW5kbGUuZm9jdXMoKTtcblx0XHR9ICk7XG5cblx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cuU29ydGFibGUgKSB7XG5cdFx0XHRjYXRhbG9nX3N0YXRlLnNvcnRhYmxlID0gbmV3IHdpbmRvdy5Tb3J0YWJsZSggY29sdW1uX2xpc3QsIHtcblx0XHRcdFx0YW5pbWF0aW9uOiAxNTAsXG5cdFx0XHRcdGNob3NlbkNsYXNzOiAnaXMtZHJhZ2dpbmcnLFxuXHRcdFx0XHRkcmFnZ2FibGU6ICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctY29sdW1uLXJlb3JkZXJhYmxlPVwiMVwiXScsXG5cdFx0XHRcdGdob3N0Q2xhc3M6ICdpcy1kcmFnLXBsYWNlaG9sZGVyJyxcblx0XHRcdFx0aGFuZGxlOiAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWNvbHVtbi1kcmFnLWhhbmRsZV0nLFxuXHRcdFx0XHRvbkVuZDogZnVuY3Rpb24gKCBzb3J0X2V2ZW50ICkge1xuXHRcdFx0XHRcdGlmICggc29ydF9ldmVudC5vbGRJbmRleCAhPT0gc29ydF9ldmVudC5uZXdJbmRleCApIHtcblx0XHRcdFx0XHRcdHNhdmVfY29sdW1uX2NvbnRyb2xzKCBjb25maWcsIG1vdW50X2VsZW1lbnQgKTtcblx0XHRcdFx0XHRcdGFubm91bmNlX2NvbHVtbl9tb3ZlZCggY29uZmlnLCBtb3VudF9lbGVtZW50ICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFZhbGlkYXRlIGEgbm9ybWFsaXplZCBzZXJ2ZXIgcmVzcG9uc2UgYmVmb3JlIHJlbmRlcmluZy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyAgIFJlZ2lzdGVyZWQgYnJvd3NlciBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0geyp9ICAgICAgcmVzcG9uc2UgQ2FuZGlkYXRlIHJlc3BvbnNlLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIHJlc3BvbnNlIGNvbnRyYWN0IGlzIHN1cHBvcnRlZC5cblx0ICovXG5cdGZ1bmN0aW9uIHZhbGlkYXRlX3Jlc3BvbnNlKCBjb25maWcsIHJlc3BvbnNlICkge1xuXHRcdHZhciBjb25maWd1cmVkX3NjaGVtYV92ZXJzaW9uID0gY29uZmlnID8gbm9ybWFsaXplX3NjaGVtYV92ZXJzaW9uKCBjb25maWcuc2NoZW1hX3ZlcnNpb24gKSA6IG51bGw7XG5cdFx0dmFyIHJlc3BvbnNlX3NjaGVtYV92ZXJzaW9uID0gcmVzcG9uc2UgPyBub3JtYWxpemVfc2NoZW1hX3ZlcnNpb24oIHJlc3BvbnNlLnNjaGVtYV92ZXJzaW9uICkgOiBudWxsO1xuXG5cdFx0aWYgKFxuXHRcdFx0ISBjb25maWdcblx0XHRcdHx8ICEgcmVzcG9uc2Vcblx0XHRcdHx8ICdvYmplY3QnICE9PSB0eXBlb2YgcmVzcG9uc2Vcblx0XHRcdHx8IHJlc3BvbnNlLmNhdGFsb2dfaWQgIT09IGNvbmZpZy5jYXRhbG9nX2lkXG5cdFx0XHR8fCBudWxsID09PSBjb25maWd1cmVkX3NjaGVtYV92ZXJzaW9uXG5cdFx0XHR8fCByZXNwb25zZV9zY2hlbWFfdmVyc2lvbiAhPT0gY29uZmlndXJlZF9zY2hlbWFfdmVyc2lvblxuXHRcdFx0fHwgJ2Jvb2xlYW4nICE9PSB0eXBlb2YgcmVzcG9uc2Uuc3VjY2Vzc1xuXHRcdFx0fHwgbnVsbCA9PT0gbm9ybWFsaXplX3NlcXVlbmNlKCByZXNwb25zZS5yZXF1ZXN0X2lkIClcblx0XHQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoIGZhbHNlID09PSByZXNwb25zZS5zdWNjZXNzICkge1xuXHRcdFx0cmV0dXJuICEhIHJlc3BvbnNlLmVycm9yXG5cdFx0XHRcdCYmICdvYmplY3QnID09PSB0eXBlb2YgcmVzcG9uc2UuZXJyb3Jcblx0XHRcdFx0JiYgJ3N0cmluZycgPT09IHR5cGVvZiByZXNwb25zZS5lcnJvci5jb2RlXG5cdFx0XHRcdCYmICdzdHJpbmcnID09PSB0eXBlb2YgcmVzcG9uc2UuZXJyb3IubWVzc2FnZVxuXHRcdFx0XHQmJiAnYm9vbGVhbicgPT09IHR5cGVvZiByZXNwb25zZS5lcnJvci5yZXRyeWFibGU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIEFycmF5LmlzQXJyYXkoIHJlc3BvbnNlLml0ZW1zIClcblx0XHRcdCYmICEhIHJlc3BvbnNlLnBhZ2luYXRpb25cblx0XHRcdCYmICdvYmplY3QnID09PSB0eXBlb2YgcmVzcG9uc2UucGFnaW5hdGlvblxuXHRcdFx0JiYgISEgcmVzcG9uc2Uuc29ydGluZ1xuXHRcdFx0JiYgJ29iamVjdCcgPT09IHR5cGVvZiByZXNwb25zZS5zb3J0aW5nXG5cdFx0XHQmJiAhISByZXNwb25zZS5maWx0ZXJzXG5cdFx0XHQmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIHJlc3BvbnNlLmZpbHRlcnNcblx0XHRcdCYmICEhIHJlc3BvbnNlLmRpc3BsYXlcblx0XHRcdCYmICdvYmplY3QnID09PSB0eXBlb2YgcmVzcG9uc2UuZGlzcGxheVxuXHRcdFx0JiYgISEgcmVzcG9uc2UuaGllcmFyY2h5XG5cdFx0XHQmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIHJlc3BvbnNlLmhpZXJhcmNoeVxuXHRcdFx0JiYgISEgcmVzcG9uc2UuY2FwYWJpbGl0aWVzXG5cdFx0XHQmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIHJlc3BvbnNlLmNhcGFiaWxpdGllc1xuXHRcdFx0JiYgQXJyYXkuaXNBcnJheSggcmVzcG9uc2UubWVzc2FnZXMgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZWZyZXNoIG9wdGlvbmFsIHNoYXJlZCBoaWVyYXJjaHkgbWVjaGFuaWNzIGFmdGVyIGRvbWFpbiByb3dzIGFyZSBtb3VudGVkLlxuXHQgKlxuXHQgKiBUaGUgcmVuZGVyZWQgbGlmZWN5Y2xlIGV2ZW50IHJ1bnMgc3luY2hyb25vdXNseSBmaXJzdCBzbyBhIGRvbWFpbiBhZGFwdGVyXG5cdCAqIGNhbiBjb21wb3NlIGl0cyBXUCByb3cgdGVtcGxhdGVzIGJlZm9yZSB0aGUgY29udHJvbGxlciBpbmRleGVzIG5vZGUgRE9NLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnICAgUmVnaXN0ZXJlZCBicm93c2VyIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSByZXNwb25zZSBOb3JtYWxpemVkIGN1cnJlbnQgcmVzcG9uc2UuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFdoZXRoZXIgaGllcmFyY2h5IGJlaGF2aW9yIGlzIGFjdGl2ZS5cblx0ICovXG5cdGZ1bmN0aW9uIHJlZnJlc2hfY2F0YWxvZ19oaWVyYXJjaHkoIGNvbmZpZywgcmVzcG9uc2UgKSB7XG5cdFx0dmFyIGNhdGFsb2dfc3RhdGUgPSBjb25maWcgJiYgY29uZmlnLmNhdGFsb2dfaWQgPyBnZXRfY2F0YWxvZ19zdGF0ZSggY29uZmlnLmNhdGFsb2dfaWQgKSA6IG51bGw7XG5cblx0XHRyZXR1cm4gISEgKFxuXHRcdFx0Y2F0YWxvZ19zdGF0ZVxuXHRcdFx0JiYgY2F0YWxvZ19zdGF0ZS5oaWVyYXJjaHlfY29udHJvbGxlclxuXHRcdFx0JiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNhdGFsb2dfc3RhdGUuaGllcmFyY2h5X2NvbnRyb2xsZXIucmVmcmVzaFxuXHRcdFx0JiYgY2F0YWxvZ19zdGF0ZS5oaWVyYXJjaHlfY29udHJvbGxlci5yZWZyZXNoKCByZXNwb25zZSAmJiByZXNwb25zZS5oaWVyYXJjaHkgPyByZXNwb25zZS5oaWVyYXJjaHkgOiB7fSApXG5cdFx0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZW5kZXIgYSBjdXJyZW50IG5vcm1hbGl6ZWQgcmVzcG9uc2UgYW5kIGlnbm9yZSBzdGFsZSBzZXF1ZW5jZXMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgICAgICAgICAgIFJlZ2lzdGVyZWQgYnJvd3NlciBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0geyp9ICAgICAgcmVzcG9uc2UgICAgICAgICBDYW5kaWRhdGUgbm9ybWFsaXplZCByZXNwb25zZS5cblx0ICogQHBhcmFtIHsqfSAgICAgIHJlcXVlc3Rfc2VxdWVuY2UgU2VxdWVuY2UgYXNzaWduZWQgd2hlbiB0aGUgcmVxdWVzdCBiZWdhbi5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSByZXNwb25zZSBjaGFuZ2VkIHRoZSBjYXRhbG9nLlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVuZGVyX3Jlc3BvbnNlKCBjb25maWcsIHJlc3BvbnNlLCByZXF1ZXN0X3NlcXVlbmNlICkge1xuXHRcdHZhciBjYXRhbG9nX3N0YXRlO1xuXHRcdHZhciBpMThuO1xuXHRcdHZhciBpdGVtc190ZW1wbGF0ZV9kYXRhO1xuXHRcdHZhciByZXNwb25zZV9zZXF1ZW5jZSA9IHJlc3BvbnNlICYmIG5vcm1hbGl6ZV9zZXF1ZW5jZSggcmVzcG9uc2UucmVxdWVzdF9pZCApO1xuXHRcdHZhciBub3JtYWxpemVkX3NlcXVlbmNlID0gbm9ybWFsaXplX3NlcXVlbmNlKCByZXF1ZXN0X3NlcXVlbmNlICk7XG5cblx0XHRpZiAoICEgY29uZmlnIHx8ICEgY29uZmlnLmNhdGFsb2dfaWQgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y2F0YWxvZ19zdGF0ZSA9IGdldF9jYXRhbG9nX3N0YXRlKCBjb25maWcuY2F0YWxvZ19pZCApO1xuXHRcdGlmIChcblx0XHRcdCEgY2F0YWxvZ19zdGF0ZVxuXHRcdFx0fHwgbnVsbCA9PT0gbm9ybWFsaXplZF9zZXF1ZW5jZVxuXHRcdFx0fHwgbnVsbCA9PT0gcmVzcG9uc2Vfc2VxdWVuY2Vcblx0XHRcdHx8IHJlc3BvbnNlX3NlcXVlbmNlICE9PSBub3JtYWxpemVkX3NlcXVlbmNlXG5cdFx0XHR8fCBpc19zdGFsZV9yZXNwb25zZSggY29uZmlnLmNhdGFsb2dfaWQsIG5vcm1hbGl6ZWRfc2VxdWVuY2UgKVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICggISB2YWxpZGF0ZV9yZXNwb25zZSggY29uZmlnLCByZXNwb25zZSApICkge1xuXHRcdFx0cmV0dXJuIHJlbmRlcl9lcnJvciggY29uZmlnLCBjb25maWcuaTE4biAmJiBjb25maWcuaTE4bi5lcnJvcl9tZXNzYWdlID8gY29uZmlnLmkxOG4uZXJyb3JfbWVzc2FnZSA6ICcnICk7XG5cdFx0fVxuXG5cdFx0aWYgKCBmYWxzZSA9PT0gcmVzcG9uc2Uuc3VjY2VzcyApIHtcblx0XHRcdHJldHVybiByZW5kZXJfZXJyb3IoIGNvbmZpZywgcmVzcG9uc2UuZXJyb3IubWVzc2FnZSApO1xuXHRcdH1cblxuXHRcdHNldF9hY3RpdmVfdGVtcGxhdGVfcGFjayggY29uZmlnLCByZXNwb25zZS5kaXNwbGF5LnRlbXBsYXRlX3BhY2sgKTtcblxuXHRcdGkxOG4gPSBjb25maWcuaTE4biB8fCB7fTtcblx0XHRpZiAoIDAgPT09IHJlc3BvbnNlLml0ZW1zLmxlbmd0aCApIHtcblx0XHRcdHZhciBpc19lbXB0eV9yZW5kZXJlZCA9IHJlbmRlcl90ZW1wbGF0ZSggY29uZmlnLCAnZW1wdHknLCB7XG5cdFx0XHRcdHRpdGxlOiBpMThuLmVtcHR5X3RpdGxlIHx8ICcnLFxuXHRcdFx0XHRtZXNzYWdlOiBpMThuLmVtcHR5X21lc3NhZ2UgfHwgJydcblx0XHRcdH0gKTtcblx0XHRcdGlmICggaXNfZW1wdHlfcmVuZGVyZWQgKSB7XG5cdFx0XHRcdGRpc3BhdGNoX2NhdGFsb2dfZXZlbnQoIGNvbmZpZywgJ3dwYmM6dWktY2F0YWxvZy1yZW5kZXJlZCcsIHtcblx0XHRcdFx0XHRjYXRhbG9nX2lkOiBjb25maWcuY2F0YWxvZ19pZCxcblx0XHRcdFx0XHRyZXF1ZXN0X3NlcXVlbmNlOiBub3JtYWxpemVkX3NlcXVlbmNlLFxuXHRcdFx0XHRcdHJlc3BvbnNlOiByZXNwb25zZVxuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdHJlZnJlc2hfY2F0YWxvZ19oaWVyYXJjaHkoIGNvbmZpZywgcmVzcG9uc2UgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBpc19lbXB0eV9yZW5kZXJlZDtcblx0XHR9XG5cblx0XHRpdGVtc190ZW1wbGF0ZV9kYXRhID0gT2JqZWN0LmFzc2lnbigge30sIHJlc3BvbnNlLCB7IGkxOG46IGkxOG4gfSApO1xuXHRcdGlmICggISByZW5kZXJfdGVtcGxhdGUoIGNvbmZpZywgJ2l0ZW1zJywgaXRlbXNfdGVtcGxhdGVfZGF0YSApICkge1xuXHRcdFx0cmV0dXJuIHJlbmRlcl9lcnJvciggY29uZmlnLCBpMThuLmVycm9yX21lc3NhZ2UgfHwgJycgKTtcblx0XHR9XG5cdFx0ZGlzcGF0Y2hfY2F0YWxvZ19ldmVudCggY29uZmlnLCAnd3BiYzp1aS1jYXRhbG9nLXJlbmRlcmVkJywge1xuXHRcdFx0Y2F0YWxvZ19pZDogY29uZmlnLmNhdGFsb2dfaWQsXG5cdFx0XHRyZXF1ZXN0X3NlcXVlbmNlOiBub3JtYWxpemVkX3NlcXVlbmNlLFxuXHRcdFx0cmVzcG9uc2U6IHJlc3BvbnNlXG5cdFx0fSApO1xuXHRcdHJlZnJlc2hfY2F0YWxvZ19oaWVyYXJjaHkoIGNvbmZpZywgcmVzcG9uc2UgKTtcblx0XHRzeW5jX2NhdGFsb2dfdGFibGVfbWluX3dpZHRoKCBjb25maWcgKTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlcXVlc3QgYW5kIHJlbmRlciBvbmUgbm9ybWFsaXplZCBjYXRhbG9nIHJlc3BvbnNlLlxuXHQgKlxuXHQgKiBSZXF1ZXN0IGNhbmNlbGxhdGlvbiBhbmQgc2VxdWVuY2UgY2hlY2tzIGFyZSBzaGFyZWQgbWVjaGFuaWNzLiBDYXRhbG9nXG5cdCAqIHNjcmlwdHMgc3VwcGx5IG9ubHkgbm9ybWFsaXplZCByZXF1ZXN0IHZhbHVlcyBhbmQgcmVzcG9uZCB0byBsaWZlY3ljbGVcblx0ICogZXZlbnRzIGFmdGVyIHRoZSBhbGxvdy1saXN0ZWQgaXRlbXMgdGVtcGxhdGUgaXMgbW91bnRlZC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyAgICAgICAgIFJlZ2lzdGVyZWQgYnJvd3NlciBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gcmVxdWVzdF92YWx1ZXMgTm9ybWFsaXplZCByZXF1ZXN0IG92ZXJyaWRlcy5cblx0ICogQHJldHVybiB7UHJvbWlzZTxib29sZWFuPn0gV2hldGhlciBhIGN1cnJlbnQgcmVzcG9uc2Ugd2FzIHJlbmRlcmVkLlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVxdWVzdF9jYXRhbG9nKCBjb25maWcsIHJlcXVlc3RfdmFsdWVzICkge1xuXHRcdHZhciBjYXRhbG9nX3N0YXRlO1xuXHRcdHZhciBwZXJzaXN0ZW50X3JlcXVlc3RfdmFsdWVzO1xuXHRcdHZhciBwcmVmZXJlbmNlX2FjdGlvbjtcblx0XHR2YXIgcmVxdWVzdF9ib2R5O1xuXHRcdHZhciByZXF1ZXN0X3NlcXVlbmNlO1xuXHRcdHZhciByZXF1ZXN0X3VybDtcblxuXHRcdGlmIChcblx0XHRcdCEgY29uZmlnXG5cdFx0XHR8fCAhIGNvbmZpZy5jYXRhbG9nX2lkXG5cdFx0XHR8fCAhIGNvbmZpZy5hamF4X3VybFxuXHRcdFx0fHwgISBjb25maWcuYWN0aW9uXG5cdFx0XHR8fCAhIGNvbmZpZy5ub25jZVxuXHRcdFx0fHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy5mZXRjaFxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSggcmVuZGVyX2Vycm9yKCBjb25maWcgfHwge30sIGNvbmZpZyAmJiBjb25maWcuaTE4biA/IGNvbmZpZy5pMThuLmVycm9yX21lc3NhZ2UgOiAnJyApICk7XG5cdFx0fVxuXG5cdFx0Y2F0YWxvZ19zdGF0ZSA9IGdldF9jYXRhbG9nX3N0YXRlKCBjb25maWcuY2F0YWxvZ19pZCApO1xuXHRcdGlmICggISBjYXRhbG9nX3N0YXRlICkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSggZmFsc2UgKTtcblx0XHR9XG5cblx0XHRpZiAoIGNhdGFsb2dfc3RhdGUuYWJvcnRfY29udHJvbGxlciAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgY2F0YWxvZ19zdGF0ZS5hYm9ydF9jb250cm9sbGVyLmFib3J0ICkge1xuXHRcdFx0Y2F0YWxvZ19zdGF0ZS5hYm9ydF9jb250cm9sbGVyLmFib3J0KCk7XG5cdFx0fVxuXHRcdGNhdGFsb2dfc3RhdGUuYWJvcnRfY29udHJvbGxlciA9ICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cuQWJvcnRDb250cm9sbGVyID8gbmV3IHdpbmRvdy5BYm9ydENvbnRyb2xsZXIoKSA6IG51bGw7XG5cdFx0cGVyc2lzdGVudF9yZXF1ZXN0X3ZhbHVlcyA9IE9iamVjdC5hc3NpZ24oIHt9LCByZXF1ZXN0X3ZhbHVlcyB8fCB7fSApO1xuXHRcdHByZWZlcmVuY2VfYWN0aW9uID0gcGVyc2lzdGVudF9yZXF1ZXN0X3ZhbHVlcy5wcmVmZXJlbmNlX2FjdGlvbiB8fCAnJztcblx0XHRkZWxldGUgcGVyc2lzdGVudF9yZXF1ZXN0X3ZhbHVlcy5wcmVmZXJlbmNlX2FjdGlvbjtcblx0XHRjYXRhbG9nX3N0YXRlLnJlcXVlc3RfdmFsdWVzID0gT2JqZWN0LmFzc2lnbigge30sIGNvbmZpZy5pbml0aWFsX3JlcXVlc3QgfHwge30sIGNhdGFsb2dfc3RhdGUucmVxdWVzdF92YWx1ZXMgfHwge30sIHBlcnNpc3RlbnRfcmVxdWVzdF92YWx1ZXMgKTtcblx0XHRyZXF1ZXN0X3NlcXVlbmNlID0gbmV4dF9yZXF1ZXN0X3NlcXVlbmNlKCBjb25maWcuY2F0YWxvZ19pZCApO1xuXHRcdGNhdGFsb2dfc3RhdGUucmVxdWVzdF92YWx1ZXMucmVxdWVzdF9pZCA9IHJlcXVlc3Rfc2VxdWVuY2U7XG5cblx0XHRpZiAoICEgc2V0X2NhdGFsb2dfbG9hZGluZ19zdGF0ZSggY29uZmlnLCB0cnVlICkgKSB7XG5cdFx0XHRyZW5kZXJfdGVtcGxhdGUoIGNvbmZpZywgJ3NoZWxsJywge1xuXHRcdFx0XHRjYXRhbG9nX2lkOiBjb25maWcuY2F0YWxvZ19pZCxcblx0XHRcdFx0YXJpYV9sYWJlbDogY29uZmlnLmkxOG4gJiYgY29uZmlnLmkxOG4uY2F0YWxvZ19sYWJlbCA/IGNvbmZpZy5pMThuLmNhdGFsb2dfbGFiZWwgOiAnJyxcblx0XHRcdFx0bG9hZGluZ19tZXNzYWdlOiBjb25maWcuaTE4biAmJiBjb25maWcuaTE4bi5sb2FkaW5nID8gY29uZmlnLmkxOG4ubG9hZGluZyA6ICcnXG5cdFx0XHR9ICk7XG5cdFx0fVxuXHRcdGRpc3BhdGNoX2NhdGFsb2dfZXZlbnQoIGNvbmZpZywgJ3dwYmM6dWktY2F0YWxvZy1sb2FkaW5nJywge1xuXHRcdFx0Y2F0YWxvZ19pZDogY29uZmlnLmNhdGFsb2dfaWQsXG5cdFx0XHRyZXF1ZXN0X3NlcXVlbmNlOiByZXF1ZXN0X3NlcXVlbmNlXG5cdFx0fSApO1xuXG5cdFx0cmVxdWVzdF9ib2R5ID0gbmV3IHdpbmRvdy5VUkxTZWFyY2hQYXJhbXMoKTtcblx0XHRyZXF1ZXN0X2JvZHkuYXBwZW5kKCAnYWN0aW9uJywgY29uZmlnLmFjdGlvbiApO1xuXHRcdHJlcXVlc3RfYm9keS5hcHBlbmQoICdub25jZScsIGNvbmZpZy5ub25jZSApO1xuXHRcdGlmICggcHJlZmVyZW5jZV9hY3Rpb24gKSB7XG5cdFx0XHRjYXRhbG9nX3N0YXRlLnByZWZlcmVuY2VfcmV2aXNpb24gPSBNYXRoLm1heCggRGF0ZS5ub3coKSwgY2F0YWxvZ19zdGF0ZS5wcmVmZXJlbmNlX3JldmlzaW9uICsgMSApO1xuXHRcdFx0cmVxdWVzdF9ib2R5LmFwcGVuZCggJ3ByZWZlcmVuY2VfYWN0aW9uJywgcHJlZmVyZW5jZV9hY3Rpb24gKTtcblx0XHRcdHJlcXVlc3RfYm9keS5hcHBlbmQoICdwcmVmZXJlbmNlX3JldmlzaW9uJywgU3RyaW5nKCBjYXRhbG9nX3N0YXRlLnByZWZlcmVuY2VfcmV2aXNpb24gKSApO1xuXHRcdH1cblx0XHRPYmplY3Qua2V5cyggY2F0YWxvZ19zdGF0ZS5yZXF1ZXN0X3ZhbHVlcyApLmZvckVhY2goIGZ1bmN0aW9uICggcmVxdWVzdF9rZXkgKSB7XG5cdFx0XHRhcHBlbmRfcmVxdWVzdF92YWx1ZSggcmVxdWVzdF9ib2R5LCByZXF1ZXN0X2tleSwgY2F0YWxvZ19zdGF0ZS5yZXF1ZXN0X3ZhbHVlc1sgcmVxdWVzdF9rZXkgXSApO1xuXHRcdH0gKTtcblx0XHRyZXF1ZXN0X3VybCA9IFN0cmluZyggY29uZmlnLmFqYXhfdXJsICk7XG5cblx0XHRyZXR1cm4gd2luZG93LmZldGNoKCByZXF1ZXN0X3VybCwge1xuXHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRjcmVkZW50aWFsczogJ3NhbWUtb3JpZ2luJyxcblx0XHRcdGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQ7IGNoYXJzZXQ9VVRGLTgnIH0sXG5cdFx0XHRib2R5OiByZXF1ZXN0X2JvZHkudG9TdHJpbmcoKSxcblx0XHRcdHNpZ25hbDogY2F0YWxvZ19zdGF0ZS5hYm9ydF9jb250cm9sbGVyID8gY2F0YWxvZ19zdGF0ZS5hYm9ydF9jb250cm9sbGVyLnNpZ25hbCA6IHVuZGVmaW5lZFxuXHRcdH0gKS50aGVuKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0cmV0dXJuIHJlc3BvbnNlLnRleHQoKS50aGVuKCBmdW5jdGlvbiAoIHJlc3BvbnNlX3RleHQgKSB7XG5cdFx0XHRcdHZhciByZXNwb25zZV9wYXlsb2FkID0gbnVsbDtcblxuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdHJlc3BvbnNlX3BheWxvYWQgPSBKU09OLnBhcnNlKCByZXNwb25zZV90ZXh0ICk7XG5cdFx0XHRcdH0gY2F0Y2ggKCBlcnJvciApIHtcblx0XHRcdFx0XHRyZXNwb25zZV9wYXlsb2FkID0gbnVsbDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICggaXNfc3RhbGVfcmVzcG9uc2UoIGNvbmZpZy5jYXRhbG9nX2lkLCByZXF1ZXN0X3NlcXVlbmNlICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggISByZXNwb25zZV9wYXlsb2FkICkge1xuXHRcdFx0XHRcdHJldHVybiByZW5kZXJfZXJyb3IoIGNvbmZpZywgY29uZmlnLmkxOG4gJiYgY29uZmlnLmkxOG4uZXJyb3JfbWVzc2FnZSA/IGNvbmZpZy5pMThuLmVycm9yX21lc3NhZ2UgOiAnJyApO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dmFyIGlzX3JlbmRlcmVkID0gcmVuZGVyX3Jlc3BvbnNlKCBjb25maWcsIHJlc3BvbnNlX3BheWxvYWQsIHJlcXVlc3Rfc2VxdWVuY2UgKTtcblx0XHRcdFx0aWYgKCBpc19yZW5kZXJlZCAmJiByZXNwb25zZV9wYXlsb2FkLnN1Y2Nlc3MgKSB7XG5cdFx0XHRcdFx0Y2F0YWxvZ19zdGF0ZS5yZXF1ZXN0X3ZhbHVlcyA9IE9iamVjdC5hc3NpZ24oIHt9LCBjYXRhbG9nX3N0YXRlLnJlcXVlc3RfdmFsdWVzLCB7XG5cdFx0XHRcdFx0XHRwYWdlX251bWJlcjogcmVzcG9uc2VfcGF5bG9hZC5wYWdpbmF0aW9uLnBhZ2VfbnVtYmVyLFxuXHRcdFx0XHRcdFx0aXRlbXNfcGVyX3BhZ2U6IHJlc3BvbnNlX3BheWxvYWQucGFnaW5hdGlvbi5pdGVtc19wZXJfcGFnZSxcblx0XHRcdFx0XHRcdHNvcnRfYnk6IHJlc3BvbnNlX3BheWxvYWQuc29ydGluZy5zb3J0X2J5LFxuXHRcdFx0XHRcdFx0c29ydF9vcmRlcjogcmVzcG9uc2VfcGF5bG9hZC5zb3J0aW5nLnNvcnRfb3JkZXIsXG5cdFx0XHRcdFx0XHRzZWFyY2g6IHJlc3BvbnNlX3BheWxvYWQuZmlsdGVycy5zZWFyY2ggfHwgJycsXG5cdFx0XHRcdFx0XHR2aXNpYmxlX2NvbHVtbnM6IHJlc3BvbnNlX3BheWxvYWQuZGlzcGxheS52aXNpYmxlX2NvbHVtbnMgfHwgW10sXG5cdFx0XHRcdFx0XHRjb2x1bW5fb3JkZXI6IHJlc3BvbnNlX3BheWxvYWQuZGlzcGxheS5jb2x1bW5fb3JkZXIgfHwgW10sXG5cdFx0XHRcdFx0XHR0ZW1wbGF0ZV9wYWNrOiByZXNwb25zZV9wYXlsb2FkLmRpc3BsYXkudGVtcGxhdGVfcGFjayB8fCAnJ1xuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHRPYmplY3Qua2V5cyggcmVzcG9uc2VfcGF5bG9hZC5maWx0ZXJzIHx8IHt9ICkuZm9yRWFjaCggZnVuY3Rpb24gKCBmaWx0ZXJfa2V5ICkge1xuXHRcdFx0XHRcdFx0Y2F0YWxvZ19zdGF0ZS5yZXF1ZXN0X3ZhbHVlc1sgZmlsdGVyX2tleSBdID0gcmVzcG9uc2VfcGF5bG9hZC5maWx0ZXJzWyBmaWx0ZXJfa2V5IF07XG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdHVwZGF0ZV91cmxfc3RhdGUoIGNvbmZpZywgcmVzcG9uc2VfcGF5bG9hZCApO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIGlzX3JlbmRlcmVkO1xuXHRcdFx0fSApO1xuXHRcdH0gKS5jYXRjaCggZnVuY3Rpb24gKCBlcnJvciApIHtcblx0XHRcdGlmICggZXJyb3IgJiYgJ0Fib3J0RXJyb3InID09PSBlcnJvci5uYW1lICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGlzX3N0YWxlX3Jlc3BvbnNlKCBjb25maWcuY2F0YWxvZ19pZCwgcmVxdWVzdF9zZXF1ZW5jZSApICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiByZW5kZXJfZXJyb3IoIGNvbmZpZywgY29uZmlnLmkxOG4gJiYgY29uZmlnLmkxOG4uZXJyb3JfbWVzc2FnZSA/IGNvbmZpZy5pMThuLmVycm9yX21lc3NhZ2UgOiAnJyApO1xuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBQZXJzaXN0IHZhbGlkYXRlZCBwcmVzZW50YXRpb24gcHJlZmVyZW5jZXMgd2l0aG91dCByZWJ1aWxkaW5nIGNhdGFsb2cgcm93cy5cblx0ICpcblx0ICogRG9tYWluIGNhdGFsb2dzIG1heSBhZGQgdGhlaXIgb3duIHNjYWxhciBwcmVmZXJlbmNlIHZhbHVlcyB0byB0aGUgc2hhcmVkXG5cdCAqIHJlcXVlc3Qgc3RhdGUuIFRoZSBlbmRwb2ludCByZW1haW5zIHJlc3BvbnNpYmxlIGZvciB2YWxpZGF0aW9uIGFuZFxuXHQgKiBhdXRob3JpemF0aW9uLiBBIHNlcGFyYXRlIGFib3J0IHNsb3QgcHJldmVudHMgYSBkaXNjbG9zdXJlLXN0YXRlIHNhdmUgZnJvbVxuXHQgKiBjYW5jZWxsaW5nIGFuIGFjdGl2ZSBsaXN0IHJlcXVlc3Qgb3Igc2hvd2luZyB0aGUgY2F0YWxvZyBsb2FkaW5nIG92ZXJsYXkuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgICAgICAgICAgICBSZWdpc3RlcmVkIGJyb3dzZXIgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtPYmplY3R9IHByZWZlcmVuY2VfdmFsdWVzIFNoYXJlZCBvciBkb21haW4tb3duZWQgcmVxdWVzdCB2YWx1ZXMuXG5cdCAqIEByZXR1cm4ge1Byb21pc2U8Ym9vbGVhbj59IFdoZXRoZXIgdGhlIGN1cnJlbnQgcHJlZmVyZW5jZSByZXF1ZXN0IHN1Y2NlZWRlZC5cblx0ICovXG5cdGZ1bmN0aW9uIHNhdmVfY2F0YWxvZ19wcmVmZXJlbmNlcyggY29uZmlnLCBwcmVmZXJlbmNlX3ZhbHVlcyApIHtcblx0XHR2YXIgY2F0YWxvZ19zdGF0ZTtcblx0XHR2YXIgcmVxdWVzdF9ib2R5O1xuXHRcdHZhciByZXF1ZXN0X3JldmlzaW9uO1xuXG5cdFx0aWYgKCAhIGNvbmZpZyB8fCAhIGNvbmZpZy5jYXRhbG9nX2lkIHx8ICEgY29uZmlnLmFqYXhfdXJsIHx8ICEgY29uZmlnLmFjdGlvbiB8fCAhIGNvbmZpZy5ub25jZSB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93LmZldGNoICkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSggZmFsc2UgKTtcblx0XHR9XG5cdFx0Y2F0YWxvZ19zdGF0ZSA9IGdldF9jYXRhbG9nX3N0YXRlKCBjb25maWcuY2F0YWxvZ19pZCApO1xuXHRcdGlmICggISBjYXRhbG9nX3N0YXRlICkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSggZmFsc2UgKTtcblx0XHR9XG5cdFx0aWYgKCBjYXRhbG9nX3N0YXRlLnByZWZlcmVuY2VfYWJvcnRfY29udHJvbGxlciAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgY2F0YWxvZ19zdGF0ZS5wcmVmZXJlbmNlX2Fib3J0X2NvbnRyb2xsZXIuYWJvcnQgKSB7XG5cdFx0XHRjYXRhbG9nX3N0YXRlLnByZWZlcmVuY2VfYWJvcnRfY29udHJvbGxlci5hYm9ydCgpO1xuXHRcdH1cblx0XHRjYXRhbG9nX3N0YXRlLnByZWZlcmVuY2VfYWJvcnRfY29udHJvbGxlciA9ICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cuQWJvcnRDb250cm9sbGVyID8gbmV3IHdpbmRvdy5BYm9ydENvbnRyb2xsZXIoKSA6IG51bGw7XG5cdFx0Y2F0YWxvZ19zdGF0ZS5yZXF1ZXN0X3ZhbHVlcyA9IE9iamVjdC5hc3NpZ24oIHt9LCBjb25maWcuaW5pdGlhbF9yZXF1ZXN0IHx8IHt9LCBjYXRhbG9nX3N0YXRlLnJlcXVlc3RfdmFsdWVzIHx8IHt9LCBwcmVmZXJlbmNlX3ZhbHVlcyB8fCB7fSApO1xuXHRcdGNhdGFsb2dfc3RhdGUucHJlZmVyZW5jZV9yZXZpc2lvbiA9IE1hdGgubWF4KCBEYXRlLm5vdygpLCBjYXRhbG9nX3N0YXRlLnByZWZlcmVuY2VfcmV2aXNpb24gKyAxICk7XG5cdFx0cmVxdWVzdF9yZXZpc2lvbiA9IGNhdGFsb2dfc3RhdGUucHJlZmVyZW5jZV9yZXZpc2lvbjtcblxuXHRcdHJlcXVlc3RfYm9keSA9IG5ldyB3aW5kb3cuVVJMU2VhcmNoUGFyYW1zKCk7XG5cdFx0cmVxdWVzdF9ib2R5LmFwcGVuZCggJ2FjdGlvbicsIGNvbmZpZy5hY3Rpb24gKTtcblx0XHRyZXF1ZXN0X2JvZHkuYXBwZW5kKCAnbm9uY2UnLCBjb25maWcubm9uY2UgKTtcblx0XHRyZXF1ZXN0X2JvZHkuYXBwZW5kKCAncHJlZmVyZW5jZV9hY3Rpb24nLCAnc2F2ZScgKTtcblx0XHRyZXF1ZXN0X2JvZHkuYXBwZW5kKCAncHJlZmVyZW5jZV9yZXZpc2lvbicsIFN0cmluZyggcmVxdWVzdF9yZXZpc2lvbiApICk7XG5cdFx0cmVxdWVzdF9ib2R5LmFwcGVuZCggJ3ByZWZlcmVuY2VzX29ubHknLCAnMScgKTtcblx0XHRPYmplY3Qua2V5cyggY2F0YWxvZ19zdGF0ZS5yZXF1ZXN0X3ZhbHVlcyApLmZvckVhY2goIGZ1bmN0aW9uICggcmVxdWVzdF9rZXkgKSB7XG5cdFx0XHRhcHBlbmRfcmVxdWVzdF92YWx1ZSggcmVxdWVzdF9ib2R5LCByZXF1ZXN0X2tleSwgY2F0YWxvZ19zdGF0ZS5yZXF1ZXN0X3ZhbHVlc1sgcmVxdWVzdF9rZXkgXSApO1xuXHRcdH0gKTtcblxuXHRcdHJldHVybiB3aW5kb3cuZmV0Y2goIFN0cmluZyggY29uZmlnLmFqYXhfdXJsICksIHtcblx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0Y3JlZGVudGlhbHM6ICdzYW1lLW9yaWdpbicsXG5cdFx0XHRoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkOyBjaGFyc2V0PVVURi04JyB9LFxuXHRcdFx0Ym9keTogcmVxdWVzdF9ib2R5LnRvU3RyaW5nKCksXG5cdFx0XHRzaWduYWw6IGNhdGFsb2dfc3RhdGUucHJlZmVyZW5jZV9hYm9ydF9jb250cm9sbGVyID8gY2F0YWxvZ19zdGF0ZS5wcmVmZXJlbmNlX2Fib3J0X2NvbnRyb2xsZXIuc2lnbmFsIDogdW5kZWZpbmVkXG5cdFx0fSApLnRoZW4oIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRyZXR1cm4gcmVzcG9uc2UudGV4dCgpLnRoZW4oIGZ1bmN0aW9uICggcmVzcG9uc2VfdGV4dCApIHtcblx0XHRcdFx0dmFyIHJlc3BvbnNlX3BheWxvYWQgPSBudWxsO1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdHJlc3BvbnNlX3BheWxvYWQgPSBKU09OLnBhcnNlKCByZXNwb25zZV90ZXh0ICk7XG5cdFx0XHRcdH0gY2F0Y2ggKCBlcnJvciApIHtcblx0XHRcdFx0XHRyZXNwb25zZV9wYXlsb2FkID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcmVxdWVzdF9yZXZpc2lvbiA9PT0gY2F0YWxvZ19zdGF0ZS5wcmVmZXJlbmNlX3JldmlzaW9uXG5cdFx0XHRcdFx0JiYgcmVzcG9uc2Uub2tcblx0XHRcdFx0XHQmJiAhISByZXNwb25zZV9wYXlsb2FkXG5cdFx0XHRcdFx0JiYgdHJ1ZSA9PT0gcmVzcG9uc2VfcGF5bG9hZC5zdWNjZXNzO1xuXHRcdFx0fSApO1xuXHRcdH0gKS5jYXRjaCggZnVuY3Rpb24gKCBlcnJvciApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogUmVtb3ZlIHRoZSBrZXlib2FyZCBmb2N1cyBwcm94eSBwcmV2aW91c2x5IG93bmVkIGJ5IG9uZSBvdmVyZmxvdyB0b29sdGlwLlxuXHQgKlxuXHQgKiBPdmVyZmxvdyB0ZXh0IG1heSBsaXZlIGluc2lkZSBhbiBleGlzdGluZyBpbnRlcmFjdGl2ZSBjb250cm9sLiBUaGUgaGVscGVyXG5cdCAqIHJldXNlcyB0aGF0IGNvbnRyb2wncyBmb2N1cyBpbnN0ZWFkIG9mIGluc2VydGluZyBhIG5lc3RlZCB0YWIgc3RvcCwgYW5kIGl0XG5cdCAqIG11c3QgcmVsZWFzZSB0aGUgcHJveHkgYmVmb3JlIHJlYnVpbGRpbmcgb3IgZGVzdHJveWluZyB0aGUgVGlwcHkgaW5zdGFuY2UuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHRleHRfZWxlbWVudCBPdmVyZmxvdy10b29sdGlwIHRleHQgZWxlbWVudC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGNsZWFyX292ZXJmbG93X3Rvb2x0aXBfZm9jdXNfcHJveHkoIHRleHRfZWxlbWVudCApIHtcblx0XHR2YXIgZm9jdXNfcHJveHkgPSB0ZXh0X2VsZW1lbnQgJiYgdGV4dF9lbGVtZW50Ll93cGJjX3VpX2NhdGFsb2dfb3ZlcmZsb3dfZm9jdXNfcHJveHk7XG5cblx0XHRpZiAoICEgZm9jdXNfcHJveHkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGZvY3VzX3Byb3h5Lm93bmVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdmb2N1cycsIGZvY3VzX3Byb3h5LnNob3cgKTtcblx0XHRmb2N1c19wcm94eS5vd25lci5yZW1vdmVFdmVudExpc3RlbmVyKCAnYmx1cicsIGZvY3VzX3Byb3h5LmhpZGUgKTtcblx0XHRkZWxldGUgdGV4dF9lbGVtZW50Ll93cGJjX3VpX2NhdGFsb2dfb3ZlcmZsb3dfZm9jdXNfcHJveHk7XG5cdH1cblxuXHQvKipcblx0ICogRmluZCBhbiBleGlzdGluZyBpbnRlcmFjdGl2ZSBhbmNlc3RvciB0aGF0IGNhbiBvd24ga2V5Ym9hcmQgdG9vbHRpcCBmb2N1cy5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gdGV4dF9lbGVtZW50IE92ZXJmbG93LXRvb2x0aXAgdGV4dCBlbGVtZW50LlxuXHQgKiBAcmV0dXJuIHtIVE1MRWxlbWVudHxudWxsfSBFeGlzdGluZyBmb2N1cyBvd25lciwgb3IgbnVsbCB3aGVuIHRoZSBoZWxwZXJcblx0ICogICAgICAgICAgICAgICAgICAgICAgICAgICAgc2hvdWxkIG1ha2UgdGhlIHRleHQgaXRzZWxmIGtleWJvYXJkIGZvY3VzYWJsZS5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9vdmVyZmxvd190b29sdGlwX2ZvY3VzX293bmVyKCB0ZXh0X2VsZW1lbnQgKSB7XG5cdFx0dmFyIGZvY3VzX293bmVyO1xuXG5cdFx0aWYgKCAhIHRleHRfZWxlbWVudCB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgdGV4dF9lbGVtZW50LmNsb3Nlc3QgKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0Zm9jdXNfb3duZXIgPSB0ZXh0X2VsZW1lbnQuY2xvc2VzdChcblx0XHRcdFtcblx0XHRcdFx0J2FbaHJlZl0nLFxuXHRcdFx0XHQnYnV0dG9uOm5vdChbZGlzYWJsZWRdKScsXG5cdFx0XHRcdCdpbnB1dDpub3QoW2Rpc2FibGVkXSk6bm90KFt0eXBlPVwiaGlkZGVuXCJdKScsXG5cdFx0XHRcdCdzZWxlY3Q6bm90KFtkaXNhYmxlZF0pJyxcblx0XHRcdFx0J3RleHRhcmVhOm5vdChbZGlzYWJsZWRdKScsXG5cdFx0XHRcdCdzdW1tYXJ5Jyxcblx0XHRcdFx0J1tjb250ZW50ZWRpdGFibGU9XCJ0cnVlXCJdJyxcblx0XHRcdFx0J1t0YWJpbmRleF06bm90KFt0YWJpbmRleD1cIi0xXCJdKSdcblx0XHRcdF0uam9pbiggJywgJyApXG5cdFx0KTtcblxuXHRcdHJldHVybiBmb2N1c19vd25lciAmJiBmb2N1c19vd25lciAhPT0gdGV4dF9lbGVtZW50ID8gZm9jdXNfb3duZXIgOiBudWxsO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiB0aGUgYm91bmRlZCBwb2ludGVyIGRlbGF5IHJlcXVlc3RlZCBieSBvbmUgb3ZlcmZsb3ctdG9vbHRpcCBvd25lci5cblx0ICpcblx0ICogRm9yIGZvY3VzLWVuYWJsZWQgdG9vbHRpcHMsIGtleWJvYXJkIGZvY3VzIHJlbWFpbnMgaW1tZWRpYXRlLiBUaGUgdmFsdWVcblx0ICogY29uZmlndXJlcyBvbmx5IFRpcHB5J3MgcG9pbnRlci1ob3ZlciBkZWxheSBhbmQgaXMgYm91bmRlZCBzbyBhIG1hbGZvcm1lZFxuXHQgKiB0ZW1wbGF0ZSBhdHRyaWJ1dGUgY2Fubm90IG1ha2UgYXV0aG9yaXplZCB0ZXh0IGVmZmVjdGl2ZWx5IHVucmVhY2hhYmxlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSB0ZXh0X2VsZW1lbnQgT3ZlcmZsb3ctdG9vbHRpcCB0ZXh0IGVsZW1lbnQuXG5cdCAqIEByZXR1cm4ge251bWJlcn0gUG9pbnRlciBzaG93IGRlbGF5IGluIG1pbGxpc2Vjb25kcyBiZXR3ZWVuIHplcm8gYW5kIDIwMDAuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfb3ZlcmZsb3dfdG9vbHRpcF9wb2ludGVyX2RlbGF5KCB0ZXh0X2VsZW1lbnQgKSB7XG5cdFx0dmFyIGRlbGF5X2F0dHJpYnV0ZSA9IHRleHRfZWxlbWVudFxuXHRcdFx0PyB0ZXh0X2VsZW1lbnQuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctb3ZlcmZsb3ctdG9vbHRpcC1kZWxheS1tcycgKSB8fCAnJ1xuXHRcdFx0OiAnJztcblxuXHRcdGlmICggISAvXlxcZCskLy50ZXN0KCBkZWxheV9hdHRyaWJ1dGUgKSApIHtcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblxuXHRcdHJldHVybiBNYXRoLm1pbiggMjAwMCwgcGFyc2VJbnQoIGRlbGF5X2F0dHJpYnV0ZSwgMTAgKSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlcG9ydCB3aGV0aGVyIG9uZSBvdmVyZmxvdyB0b29sdGlwIGlzIGludGVudGlvbmFsbHkgcG9pbnRlci1vbmx5LlxuXHQgKlxuXHQgKiBTb21lIHRleHQgaXMgbmVzdGVkIGluIGEgY29udHJvbCB3aG9zZSBhY2Nlc3NpYmxlIG5hbWUgYWxyZWFkeSBleHBvc2VzIHRoZVxuXHQgKiBjb21wbGV0ZSB2YWx1ZS4gVGhvc2UgdGVtcGxhdGVzIGNhbiBrZWVwIHRoZSB2aXN1YWwgaG92ZXIgYWlkIHdpdGhvdXRcblx0ICogcmVvcGVuaW5nIGl0IHdoZW4gdGhlIG93bmluZyBjb250cm9sIHJlY2VpdmVzIGZvY3VzIGZvciBhbm90aGVyIGFjdGlvbi5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gdGV4dF9lbGVtZW50IE92ZXJmbG93LXRvb2x0aXAgdGV4dCBlbGVtZW50LlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4ga2V5Ym9hcmQgZm9jdXMgbXVzdCBub3QgYWN0aXZhdGUgdGhpcyB0b29sdGlwLlxuXHQgKi9cblx0ZnVuY3Rpb24gaXNfb3ZlcmZsb3dfdG9vbHRpcF9wb2ludGVyX29ubHkoIHRleHRfZWxlbWVudCApIHtcblx0XHRyZXR1cm4gQm9vbGVhbihcblx0XHRcdHRleHRfZWxlbWVudFxuXHRcdFx0JiYgJ3BvaW50ZXItb25seScgPT09IHRleHRfZWxlbWVudC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdWktY2F0YWxvZy1vdmVyZmxvdy10b29sdGlwLWZvY3VzJyApXG5cdFx0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXVzZSBhbiBleGlzdGluZyBpbnRlcmFjdGl2ZSBhbmNlc3RvciBmb3Iga2V5Ym9hcmQgdG9vbHRpcCBhY3RpdmF0aW9uLlxuXHQgKlxuXHQgKiBQb2ludGVyIGhvdmVyIHJlbWFpbnMgc2NvcGVkIHRvIHRoZSBjbGlwcGVkIHRleHQgaXRzZWxmLiBLZXlib2FyZCB1c2Vyc1xuXHQgKiByZWNlaXZlIHRoZSBzYW1lIGZ1bGwtdGV4dCBUaXBweSB3aGVuIHRoZSBleGlzdGluZyBvd25lciByZWNlaXZlcyBmb2N1cyxcblx0ICogd2l0aG91dCBpbnZhbGlkIG5lc3RlZCBjb250cm9scyBvciBhbiBleHRyYSBzdG9wIGluIHRoZSB0YWIgb3JkZXIuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHRleHRfZWxlbWVudCBPdmVyZmxvdy10b29sdGlwIHRleHQgZWxlbWVudC5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGFuIGFuY2VzdG9yIGZvY3VzIHByb3h5IHdhcyByZWdpc3RlcmVkLlxuXHQgKi9cblx0ZnVuY3Rpb24gYmluZF9vdmVyZmxvd190b29sdGlwX2ZvY3VzX3Byb3h5KCB0ZXh0X2VsZW1lbnQgKSB7XG5cdFx0dmFyIGZvY3VzX293bmVyID0gZ2V0X292ZXJmbG93X3Rvb2x0aXBfZm9jdXNfb3duZXIoIHRleHRfZWxlbWVudCApO1xuXHRcdHZhciBzaG93X3Rvb2x0aXA7XG5cdFx0dmFyIGhpZGVfdG9vbHRpcDtcblxuXHRcdGNsZWFyX292ZXJmbG93X3Rvb2x0aXBfZm9jdXNfcHJveHkoIHRleHRfZWxlbWVudCApO1xuXHRcdGlmICggaXNfb3ZlcmZsb3dfdG9vbHRpcF9wb2ludGVyX29ubHkoIHRleHRfZWxlbWVudCApIHx8ICEgZm9jdXNfb3duZXIgfHwgISB0ZXh0X2VsZW1lbnQuX3RpcHB5ICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRzaG93X3Rvb2x0aXAgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRpZiAoIHRleHRfZWxlbWVudC5fdGlwcHkgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHRleHRfZWxlbWVudC5fdGlwcHkuc2hvdyApIHtcblx0XHRcdFx0dGV4dF9lbGVtZW50Ll90aXBweS5zaG93KCk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRoaWRlX3Rvb2x0aXAgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRpZiAoIHRleHRfZWxlbWVudC5fdGlwcHkgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHRleHRfZWxlbWVudC5fdGlwcHkuaGlkZSApIHtcblx0XHRcdFx0dGV4dF9lbGVtZW50Ll90aXBweS5oaWRlKCk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRmb2N1c19vd25lci5hZGRFdmVudExpc3RlbmVyKCAnZm9jdXMnLCBzaG93X3Rvb2x0aXAgKTtcblx0XHRmb2N1c19vd25lci5hZGRFdmVudExpc3RlbmVyKCAnYmx1cicsIGhpZGVfdG9vbHRpcCApO1xuXHRcdHRleHRfZWxlbWVudC5fd3BiY191aV9jYXRhbG9nX292ZXJmbG93X2ZvY3VzX3Byb3h5ID0ge1xuXHRcdFx0b3duZXI6IGZvY3VzX293bmVyLFxuXHRcdFx0c2hvdzogc2hvd190b29sdGlwLFxuXHRcdFx0aGlkZTogaGlkZV90b29sdGlwXG5cdFx0fTtcblx0XHRpZiAoIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgPT09IGZvY3VzX293bmVyICkge1xuXHRcdFx0c2hvd190b29sdGlwKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHQvKipcblx0ICogQWRkIGZ1bGwtdGV4dCB0b29sdGlwcyBvbmx5IHRvIGNhdGFsb2cgdGV4dCB0aGF0IGlzIHZpc3VhbGx5IGNsaXBwZWQuXG5cdCAqXG5cdCAqIFRoZSBoZWxwZXIgb3ducyB0aGUgZG9tYWluLW5ldXRyYWwgb3ZlcmZsb3cgbWVhc3VyZW1lbnQsIGtleWJvYXJkIGZvY3VzLFxuXHQgKiBCb29raW5nIENhbGVuZGFyIHRvb2x0aXAgaW5pdGlhbGl6YXRpb24sIGFuZCBuYXRpdmUtdGl0bGUgZmFsbGJhY2suIERvbWFpblxuXHQgKiB0ZW1wbGF0ZXMgb3B0IGluIGJ5IHByb3ZpZGluZyBhdXRob3JpemVkIHBsYWluIHRleHQgdGhyb3VnaCB0aGVcblx0ICogYGRhdGEtd3BiYy11aS1jYXRhbG9nLW92ZXJmbG93LXRvb2x0aXBgIGF0dHJpYnV0ZS5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gY2F0YWxvZ19tb3VudCBDYXRhbG9nIG1vdW50IGVsZW1lbnQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzeW5jaHJvbml6ZV9vdmVyZmxvd190b29sdGlwcyggY2F0YWxvZ19tb3VudCApIHtcblx0XHR2YXIgaGFzX292ZXJmbG93aW5nX3RleHQgPSBmYWxzZTtcblx0XHR2YXIgdG9vbHRpcF9zZWxlY3RvcjtcblxuXHRcdGlmICggISBjYXRhbG9nX21vdW50ICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjYXRhbG9nX21vdW50LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctb3ZlcmZsb3ctdG9vbHRpcF0nICkuZm9yRWFjaCggZnVuY3Rpb24gKCB0ZXh0X2VsZW1lbnQgKSB7XG5cdFx0XHR2YXIgZnVsbF90ZXh0ID0gdGV4dF9lbGVtZW50LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy11aS1jYXRhbG9nLW92ZXJmbG93LXRvb2x0aXAnICkgfHwgJyc7XG5cdFx0XHR2YXIgc3RhdGljX3RpdGxlID0gdGV4dF9lbGVtZW50LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy11aS1jYXRhbG9nLXN0YXRpYy10aXRsZScgKSB8fCAnJztcblx0XHRcdHZhciBmb2N1c19vd25lcjtcblx0XHRcdHZhciBpc19vdmVyZmxvd2luZyA9IHRleHRfZWxlbWVudC5zY3JvbGxXaWR0aCA+IHRleHRfZWxlbWVudC5jbGllbnRXaWR0aCArIDFcblx0XHRcdFx0fHwgdGV4dF9lbGVtZW50LnNjcm9sbEhlaWdodCA+IHRleHRfZWxlbWVudC5jbGllbnRIZWlnaHQgKyAxO1xuXG5cdFx0XHRjbGVhcl9vdmVyZmxvd190b29sdGlwX2ZvY3VzX3Byb3h5KCB0ZXh0X2VsZW1lbnQgKTtcblx0XHRcdGlmICggdGV4dF9lbGVtZW50Ll90aXBweSAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgdGV4dF9lbGVtZW50Ll90aXBweS5kZXN0cm95ICkge1xuXHRcdFx0XHR0ZXh0X2VsZW1lbnQuX3RpcHB5LmRlc3Ryb3koKTtcblx0XHRcdH1cblx0XHRcdHRleHRfZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCAndG9vbHRpcF90b3AnLCAnd3BiY191aV9saXN0aW5nX19vdmVyZmxvd190b29sdGlwJyApO1xuXHRcdFx0dGV4dF9lbGVtZW50LnJlbW92ZUF0dHJpYnV0ZSggJ3RpdGxlJyApO1xuXHRcdFx0dGV4dF9lbGVtZW50LnJlbW92ZUF0dHJpYnV0ZSggJ2RhdGEtb3JpZ2luYWwtdGl0bGUnICk7XG5cdFx0XHRpZiAoICcxJyA9PT0gdGV4dF9lbGVtZW50LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy11aS1jYXRhbG9nLXRvb2x0aXAtdGFiaW5kZXgnICkgKSB7XG5cdFx0XHRcdHRleHRfZWxlbWVudC5yZW1vdmVBdHRyaWJ1dGUoICd0YWJpbmRleCcgKTtcblx0XHRcdFx0dGV4dF9lbGVtZW50LnJlbW92ZUF0dHJpYnV0ZSggJ2RhdGEtd3BiYy11aS1jYXRhbG9nLXRvb2x0aXAtdGFiaW5kZXgnICk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICggZnVsbF90ZXh0ICYmIGlzX292ZXJmbG93aW5nICkge1xuXHRcdFx0XHRmb2N1c19vd25lciA9IGdldF9vdmVyZmxvd190b29sdGlwX2ZvY3VzX293bmVyKCB0ZXh0X2VsZW1lbnQgKTtcblx0XHRcdFx0dGV4dF9lbGVtZW50LnNldEF0dHJpYnV0ZSggJ2RhdGEtb3JpZ2luYWwtdGl0bGUnLCBmdWxsX3RleHQgKTtcblx0XHRcdFx0dGV4dF9lbGVtZW50LmNsYXNzTGlzdC5hZGQoICd0b29sdGlwX3RvcCcsICd3cGJjX3VpX2xpc3RpbmdfX292ZXJmbG93X3Rvb2x0aXAnICk7XG5cdFx0XHRcdGlmICggISBpc19vdmVyZmxvd190b29sdGlwX3BvaW50ZXJfb25seSggdGV4dF9lbGVtZW50ICkgJiYgISBmb2N1c19vd25lciAmJiAhIHRleHRfZWxlbWVudC5oYXNBdHRyaWJ1dGUoICd0YWJpbmRleCcgKSApIHtcblx0XHRcdFx0XHR0ZXh0X2VsZW1lbnQuc2V0QXR0cmlidXRlKCAndGFiaW5kZXgnLCAnMCcgKTtcblx0XHRcdFx0XHR0ZXh0X2VsZW1lbnQuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctdG9vbHRpcC10YWJpbmRleCcsICcxJyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGhhc19vdmVyZmxvd2luZ190ZXh0ID0gdHJ1ZTtcblx0XHRcdH0gZWxzZSBpZiAoIHN0YXRpY190aXRsZSApIHtcblx0XHRcdFx0dGV4dF9lbGVtZW50LnNldEF0dHJpYnV0ZSggJ3RpdGxlJywgc3RhdGljX3RpdGxlICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXG5cdFx0dG9vbHRpcF9zZWxlY3RvciA9IGNhdGFsb2dfbW91bnQuaWQgPyAnIycgKyBjYXRhbG9nX21vdW50LmlkICsgJyAud3BiY191aV9saXN0aW5nX19vdmVyZmxvd190b29sdGlwJyA6ICcnO1xuXHRcdGlmICggaGFzX292ZXJmbG93aW5nX3RleHQgJiYgdG9vbHRpcF9zZWxlY3RvciAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfZGVmaW5lX3RpcHB5X3Rvb2x0aXBzICYmIHdpbmRvdy53cGJjX2RlZmluZV90aXBweV90b29sdGlwcyggdG9vbHRpcF9zZWxlY3RvciApICkge1xuXHRcdFx0Y2F0YWxvZ19tb3VudC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfdWlfbGlzdGluZ19fb3ZlcmZsb3dfdG9vbHRpcCcgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHRleHRfZWxlbWVudCApIHtcblx0XHRcdFx0dmFyIHBvaW50ZXJfZGVsYXkgPSBnZXRfb3ZlcmZsb3dfdG9vbHRpcF9wb2ludGVyX2RlbGF5KCB0ZXh0X2VsZW1lbnQgKTtcblxuXHRcdFx0XHRpZiAoIDAgPCBwb2ludGVyX2RlbGF5ICYmIHRleHRfZWxlbWVudC5fdGlwcHkgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHRleHRfZWxlbWVudC5fdGlwcHkuc2V0UHJvcHMgKSB7XG5cdFx0XHRcdFx0dGV4dF9lbGVtZW50Ll90aXBweS5zZXRQcm9wcyggeyBkZWxheTogWyBwb2ludGVyX2RlbGF5LCAwIF0gfSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJpbmRfb3ZlcmZsb3dfdG9vbHRpcF9mb2N1c19wcm94eSggdGV4dF9lbGVtZW50ICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNhdGFsb2dfbW91bnQucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX3VpX2xpc3RpbmdfX292ZXJmbG93X3Rvb2x0aXAnICkuZm9yRWFjaCggZnVuY3Rpb24gKCB0ZXh0X2VsZW1lbnQgKSB7XG5cdFx0XHR0ZXh0X2VsZW1lbnQuc2V0QXR0cmlidXRlKCAndGl0bGUnLCB0ZXh0X2VsZW1lbnQuZ2V0QXR0cmlidXRlKCAnZGF0YS1vcmlnaW5hbC10aXRsZScgKSB8fCAnJyApO1xuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGUgYSBkb21haW4tbmV1dHJhbCBuYXRpdmUgaW5zcGVjdG9yIHN0YXRlIHdvcmtmbG93LlxuXHQgKlxuXHQgKiBEb21haW5zIHN1cHBseSB0aGVpciBhbGxvdy1saXN0ZWQgc2hlbGwgcmVuZGVyZXIsIGhvc3QvZm9vdGVyIGJvdW5kYXJpZXMsXG5cdCAqIGxvY2FsaXplZCBzaGVsbCBkYXRhLCBhbmQgc2lkZWJhciBleHBhbnNpb24gY2FsbGJhY2suIFRoZSBzaGFyZWQgd29ya2Zsb3dcblx0ICogb3ducyBvbmx5IHNoZWxsIG1vdW50aW5nIGFuZCB0aGUgZW1wdHksIGxvYWRpbmcsIGVycm9yLCBhbmQgZm9ybSBzdGF0ZXMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBzZXR0aW5ncyBJbnNwZWN0b3IgYm91bmRhcnkgY2FsbGJhY2tzIGFuZCBzaGVsbCBkYXRhLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8ZmFsc2V9IEluc3BlY3RvciB3b3JrZmxvdyBjb250cm9sbGVyIG9yIGZhbHNlIHdoZW4gaW52YWxpZC5cblx0ICovXG5cdGZ1bmN0aW9uIGNyZWF0ZV9pbnNwZWN0b3Jfd29ya2Zsb3coIHNldHRpbmdzICkge1xuXHRcdHZhciBvcHRpb25zID0gT2JqZWN0LmFzc2lnbigge1xuXHRcdFx0ZXhwYW5kOiBudWxsLFxuXHRcdFx0Z2V0X2Zvb3RlcjogbnVsbCxcblx0XHRcdGdldF9ob3N0OiBudWxsLFxuXHRcdFx0cmVuZGVyX3NoZWxsOiBudWxsLFxuXHRcdFx0c2hlbGxfZGF0YToge31cblx0XHR9LCBzZXR0aW5ncyB8fCB7fSApO1xuXG5cdFx0aWYgKCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygb3B0aW9ucy5nZXRfaG9zdCB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygb3B0aW9ucy5yZW5kZXJfc2hlbGwgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBjdXJyZW50IGRvbWFpbi1vd25lZCBpbnNwZWN0b3IgaG9zdC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge0VsZW1lbnR8bnVsbH0gSW5zcGVjdG9yIGhvc3Qgb3IgbnVsbCB3aGVuIGl0IGlzIHVuYXZhaWxhYmxlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9ob3N0KCkge1xuXHRcdFx0dmFyIGhvc3QgPSBvcHRpb25zLmdldF9ob3N0KCk7XG5cblx0XHRcdHJldHVybiBob3N0ICYmIGhvc3QucXVlcnlTZWxlY3RvciA/IGhvc3QgOiBudWxsO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiB0aGUgY3VycmVudCBkb21haW4tb3duZWQgc3RpY2t5IGZvb3RlciB3aGVuIGNvbmZpZ3VyZWQuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtFbGVtZW50fG51bGx9IEluc3BlY3RvciBmb290ZXIgb3IgbnVsbCB3aGVuIGl0IGlzIHVuYXZhaWxhYmxlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9mb290ZXIoKSB7XG5cdFx0XHR2YXIgZm9vdGVyID0gJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIG9wdGlvbnMuZ2V0X2Zvb3RlciA/IG9wdGlvbnMuZ2V0X2Zvb3RlcigpIDogbnVsbDtcblxuXHRcdFx0cmV0dXJuIGZvb3RlciAmJiBmb290ZXIucXVlcnlTZWxlY3RvciA/IGZvb3RlciA6IG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTW91bnQgdGhlIGFsbG93LWxpc3RlZCBzaGFyZWQgc2hlbGwgaW5zaWRlIHRoZSBkb21haW4gaG9zdCBvbmNlLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBpbnNwZWN0b3Igc2hlbGwgaXMgYXZhaWxhYmxlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG1vdW50KCkge1xuXHRcdFx0dmFyIGhvc3QgPSBnZXRfaG9zdCgpO1xuXHRcdFx0dmFyIHJlbmRlcmVkX3NoZWxsO1xuXG5cdFx0XHRpZiAoICEgaG9zdCApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIGhvc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbnNwZWN0b3JdJyApICkge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdHJlbmRlcmVkX3NoZWxsID0gb3B0aW9ucy5yZW5kZXJfc2hlbGwoIE9iamVjdC5hc3NpZ24oIHt9LCBvcHRpb25zLnNoZWxsX2RhdGEgfHwge30gKSApO1xuXHRcdFx0XHR9IGNhdGNoICggZXJyb3IgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggJ3N0cmluZycgIT09IHR5cGVvZiByZW5kZXJlZF9zaGVsbCB8fCAhIHJlbmRlcmVkX3NoZWxsICkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRob3N0LmlubmVySFRNTCA9IHJlbmRlcmVkX3NoZWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gISEgaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvcl0nICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3luY2hyb25pemUgb25lIGFsbG93LWxpc3RlZCBpbnNwZWN0b3IgcHJlc2VudGF0aW9uIHN0YXRlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHN0YXRlICAgRW1wdHksIGxvYWRpbmcsIGVycm9yLCBvciBmb3JtLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlIE9wdGlvbmFsIHNhZmUgZXJyb3IgbWVzc2FnZS5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIG1vdW50ZWQgc2hlbGwgd2FzIHVwZGF0ZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2V0X3N0YXRlKCBzdGF0ZSwgbWVzc2FnZSApIHtcblx0XHRcdHZhciBlcnJvcjtcblx0XHRcdHZhciBlcnJvcl90ZXh0O1xuXHRcdFx0dmFyIGZvb3Rlcjtcblx0XHRcdHZhciBmb3JtX3RhcmdldDtcblx0XHRcdHZhciBob3N0O1xuXHRcdFx0dmFyIGxvYWRpbmc7XG5cdFx0XHR2YXIgZW1wdHk7XG5cblx0XHRcdGlmICggWyAnZW1wdHknLCAnbG9hZGluZycsICdlcnJvcicsICdmb3JtJyBdLmluZGV4T2YoIHN0YXRlICkgPCAwIHx8ICEgbW91bnQoKSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRob3N0ID0gZ2V0X2hvc3QoKTtcblx0XHRcdGZvb3RlciA9IGdldF9mb290ZXIoKTtcblx0XHRcdGVtcHR5ID0gaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1lbXB0eV0nICk7XG5cdFx0XHRsb2FkaW5nID0gaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1sb2FkaW5nXScgKTtcblx0XHRcdGVycm9yID0gaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1lcnJvcl0nICk7XG5cdFx0XHRmb3JtX3RhcmdldCA9IGhvc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbnNwZWN0b3ItZm9ybV0nICk7XG5cblx0XHRcdGlmICggZW1wdHkgKSB7IGVtcHR5LmhpZGRlbiA9ICdlbXB0eScgIT09IHN0YXRlOyB9XG5cdFx0XHRpZiAoIGxvYWRpbmcgKSB7IGxvYWRpbmcuaGlkZGVuID0gJ2xvYWRpbmcnICE9PSBzdGF0ZTsgfVxuXHRcdFx0aWYgKCBlcnJvciApIHtcblx0XHRcdFx0ZXJyb3IuaGlkZGVuID0gJ2Vycm9yJyAhPT0gc3RhdGU7XG5cdFx0XHRcdGVycm9yX3RleHQgPSBlcnJvci5xdWVyeVNlbGVjdG9yKCAncCcgKTtcblx0XHRcdFx0aWYgKCBlcnJvcl90ZXh0ICkgeyBlcnJvcl90ZXh0LnRleHRDb250ZW50ID0gU3RyaW5nKCBtZXNzYWdlIHx8ICcnICk7IH1cblx0XHRcdH1cblx0XHRcdGlmICggZm9ybV90YXJnZXQgJiYgJ2Zvcm0nICE9PSBzdGF0ZSApIHsgZm9ybV90YXJnZXQuaW5uZXJIVE1MID0gJyc7IH1cblx0XHRcdGlmICggZm9vdGVyICkgeyBmb290ZXIuaGlkZGVuID0gJ2Zvcm0nICE9PSBzdGF0ZTsgfVxuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBFeHBhbmQgdGhlIGNvbmZpZ3VyZWQgbmF0aXZlIHNpZGViYXIgYm91bmRhcnkuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGV4cGFuZCgpIHtcblx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIG9wdGlvbnMuZXhwYW5kICkge1xuXHRcdFx0XHRvcHRpb25zLmV4cGFuZCgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE1vdW50LCByZXZlYWwgbG9hZGluZyBzdGF0ZSwgYW5kIGltbWVkaWF0ZWx5IGV4cGFuZCB0aGUgaW5zcGVjdG9yLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBsb2FkaW5nIHN0YXRlIHdhcyBvcGVuZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gb3Blbl9sb2FkaW5nKCkge1xuXHRcdFx0aWYgKCAhIHNldF9zdGF0ZSggJ2xvYWRpbmcnLCAnJyApICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRleHBhbmQoKTtcblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBzaGVsbCBmb3JtIHRhcmdldCB1c2VkIGJ5IGRvbWFpbi1vd25lZCB0ZW1wbGF0ZXMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtFbGVtZW50fG51bGx9IEZvcm0gdGFyZ2V0IG9yIG51bGwgd2hlbiBtb3VudGluZyBmYWlsZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X2Zvcm1fdGFyZ2V0KCkge1xuXHRcdFx0dmFyIGhvc3QgPSBtb3VudCgpID8gZ2V0X2hvc3QoKSA6IG51bGw7XG5cblx0XHRcdHJldHVybiBob3N0ID8gaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1mb3JtXScgKSA6IG51bGw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGV4cGFuZDogZXhwYW5kLFxuXHRcdFx0Z2V0X2Zvcm1fdGFyZ2V0OiBnZXRfZm9ybV90YXJnZXQsXG5cdFx0XHRtb3VudDogbW91bnQsXG5cdFx0XHRvcGVuX2xvYWRpbmc6IG9wZW5fbG9hZGluZyxcblx0XHRcdHNldF9zdGF0ZTogc2V0X3N0YXRlXG5cdFx0fTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGUgYSBkb21haW4tbmV1dHJhbCBpbmxpbmUtZWRpdGluZyB3b3JrZmxvdyBjb250cm9sbGVyLlxuXHQgKlxuXHQgKiBEb21haW5zIHJldGFpbiBvd25lcnNoaXAgb2YgZWRpdGFibGUgZmllbGRzLCBkcmFmdCB2YWx1ZXMsIGF1dGhvcml6YXRpb24sXG5cdCAqIHJldmlldyBwYXlsb2FkcywgYW5kIG11dGF0aW9ucy4gVGhpcyBjb250cm9sbGVyIG9ubHkgc3luY2hyb25pemVzIHRoZVxuXHQgKiByZXBlYXRlZCBjYXRhbG9nIG1lY2hhbmljcyBhcm91bmQgYW4gYWN0aXZlIGlubGluZSB3b3JrZmxvdzogc3RpY2t5LWJhclxuXHQgKiByZWdpc3RyYXRpb24sIGJ1c3kgY29udHJvbHMsIG5hdmlnYXRpb24gbG9ja2luZywgY2hhbmdlZC1yb3cgcHJlc2VudGF0aW9uLFxuXHQgKiBhbmQgdGhlIHNoYXJlZCBhY3RpdmUtc3RhdGUgY2xhc3Nlcy5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxzdHJpbmd9IGNhdGFsb2dfbW91bnQgQ2F0YWxvZyBtb3VudCBlbGVtZW50IG9yIGl0cyBJRC5cblx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgICAgICAgIHNldHRpbmdzICAgICAgRG9tYWluIHNlbGVjdG9ycyBhbmQgcGFnZSBlbGVtZW50LlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8ZmFsc2V9IElubGluZSB3b3JrZmxvdyBjb250cm9sbGVyIG9yIGZhbHNlIHdoZW4gdW5hdmFpbGFibGUuXG5cdCAqL1xuXHRmdW5jdGlvbiBjcmVhdGVfaW5saW5lX2VkaXRpbmdfd29ya2Zsb3coIGNhdGFsb2dfbW91bnQsIHNldHRpbmdzICkge1xuXHRcdHZhciBvcHRpb25zO1xuXHRcdHZhciBtb3VudF9lbGVtZW50ID0gJ3N0cmluZycgPT09IHR5cGVvZiBjYXRhbG9nX21vdW50ID8gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIGNhdGFsb2dfbW91bnQgKSA6IGNhdGFsb2dfbW91bnQ7XG5cdFx0dmFyIGRlZmF1bHRfcHJvdGVjdGVkX3NlbGVjdG9yID0gW1xuXHRcdFx0J1tkYXRhLXdwYmMtdWktY2F0YWxvZy12aWV3XScsXG5cdFx0XHQnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXRlbXBsYXRlLXBhY2tdJyxcblx0XHRcdCdbZGF0YS13cGJjLXVpLWNhdGFsb2ctZGlzcGxheS1jdXN0b21pemVyXSBzdW1tYXJ5Jyxcblx0XHRcdCdbZGF0YS13cGJjLXVpLWNhdGFsb2ctc2VhcmNoXScsXG5cdFx0XHQnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWZpbHRlcl0nLFxuXHRcdFx0J1tkYXRhLXdwYmMtdWktY2F0YWxvZy1zZWxlY3QtaXRlbV0nLFxuXHRcdFx0J1tkYXRhLXdwYmMtdWktY2F0YWxvZy1zZWxlY3QtYWxsXScsXG5cdFx0XHQnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXNvcnRdJyxcblx0XHRcdCdbZGF0YS13cGJjLXVpLWNhdGFsb2ctcGFnZV0nLFxuXHRcdFx0J1tkYXRhLXdwYmMtdWktY2F0YWxvZy1wYWdlLW51bWJlcl0nLFxuXHRcdFx0J1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pdGVtcy1wZXItcGFnZV0nLFxuXHRcdFx0J1tkYXRhLXdwYmMtdWktY2F0YWxvZy1jb2x1bW4tdmlzaWJsZV0nLFxuXHRcdFx0J1tkYXRhLXdwYmMtdWktY2F0YWxvZy1jb2x1bW4tb3JkZXItcmVzZXRdJyxcblx0XHRcdCdbZGF0YS13cGJjLXVpLWNhdGFsb2ctcHJlZmVyZW5jZXMtcmVzZXRdJ1xuXHRcdF0uam9pbiggJywgJyApO1xuXG5cdFx0aWYgKCAhIG1vdW50X2VsZW1lbnQgfHwgISBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0b3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oIHtcblx0XHRcdGJhcl9zZWxlY3RvcjogJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbmxpbmUtYmFyXScsXG5cdFx0XHRjYW5jZWxfc2VsZWN0b3I6ICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5saW5lLWNhbmNlbF0nLFxuXHRcdFx0Y29udHJvbHNfcm9vdDogbW91bnRfZWxlbWVudCxcblx0XHRcdGNvdW50X3NlbGVjdG9yOiAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWlubGluZS1jb3VudF0nLFxuXHRcdFx0cGFnZV9lbGVtZW50OiBtb3VudF9lbGVtZW50LFxuXHRcdFx0cHJvdGVjdGVkX3NlbGVjdG9yOiAnJyxcblx0XHRcdHJldmlld19zZWxlY3RvcjogJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbmxpbmUtcmV2aWV3XScsXG5cdFx0XHR0b2dnbGVfbGFiZWxfc2VsZWN0b3I6ICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5saW5lLXRvZ2dsZS1sYWJlbF0nLFxuXHRcdFx0dG9nZ2xlX3NlbGVjdG9yOiAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWlubGluZS10b2dnbGVdJ1xuXHRcdH0sIHNldHRpbmdzIHx8IHt9ICk7XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gdGhlIGNvbmZpZ3VyZWQgcGFnZSBlbGVtZW50IHdpdGhvdXQgZXNjYXBpbmcgdGhlIGNhdGFsb2cgbW91bnQuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtIVE1MRWxlbWVudHxudWxsfSBDb25maWd1cmVkIHBhZ2Ugcm9vdCwgbW91bnQsIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3BhZ2VfZWxlbWVudCgpIHtcblx0XHRcdGlmICggb3B0aW9ucy5wYWdlX2VsZW1lbnQgJiYgb3B0aW9ucy5wYWdlX2VsZW1lbnQubm9kZVR5cGUgKSB7XG5cdFx0XHRcdHJldHVybiBvcHRpb25zLnBhZ2VfZWxlbWVudDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuICdzdHJpbmcnID09PSB0eXBlb2Ygb3B0aW9ucy5wYWdlX2VsZW1lbnRcblx0XHRcdFx0PyBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoIG9wdGlvbnMucGFnZV9lbGVtZW50IClcblx0XHRcdFx0OiBtb3VudF9lbGVtZW50O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiB0aGUgY29tcGxldGUgc2VsZWN0b3IgZm9yIGNvbnRyb2xzIGxvY2tlZCBieSBhY3RpdmUgZHJhZnRzLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfSBTaGFyZWQgc2VsZWN0b3JzIHBsdXMgdGhlIHRydXN0ZWQgZG9tYWluIGV4dGVuc2lvbi5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfcHJvdGVjdGVkX3NlbGVjdG9yKCkge1xuXHRcdFx0cmV0dXJuIG9wdGlvbnMucHJvdGVjdGVkX3NlbGVjdG9yXG5cdFx0XHRcdD8gZGVmYXVsdF9wcm90ZWN0ZWRfc2VsZWN0b3IgKyAnLCAnICsgb3B0aW9ucy5wcm90ZWN0ZWRfc2VsZWN0b3Jcblx0XHRcdFx0OiBkZWZhdWx0X3Byb3RlY3RlZF9zZWxlY3Rvcjtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBQcmVzZXJ2ZSBhbmQgcmVzdG9yZSBhIGNvbnRyb2wncyBwcmUtd29ya2Zsb3cgZGlzYWJsZWQgc3RhdGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBjb250cm9sICAgICAgICAgQ2F0YWxvZyBjb250cm9sIHRvIHN5bmNocm9uaXplLlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gICAgIGNvbnRyb2xzX2xvY2tlZCBXaGV0aGVyIGlubGluZSBuYXZpZ2F0aW9uIGlzIGxvY2tlZC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHN5bmNocm9uaXplX3Byb3RlY3RlZF9jb250cm9sKCBjb250cm9sLCBjb250cm9sc19sb2NrZWQgKSB7XG5cdFx0XHR2YXIgcHJpb3JfZGlzYWJsZWQ7XG5cblx0XHRcdGlmICggY29udHJvbHNfbG9ja2VkICkge1xuXHRcdFx0XHRpZiAoICEgY29udHJvbC5oYXNBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdWktY2F0YWxvZy1pbmxpbmUtd2FzLWRpc2FibGVkJyApICkge1xuXHRcdFx0XHRcdGNvbnRyb2wuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5saW5lLXdhcy1kaXNhYmxlZCcsIGNvbnRyb2wuZGlzYWJsZWQgPyAnMScgOiAnMCcgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb250cm9sLmRpc2FibGVkID0gdHJ1ZTtcblx0XHRcdFx0Y29udHJvbC5zZXRBdHRyaWJ1dGUoICdhcmlhLWRpc2FibGVkJywgJ3RydWUnICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCAhIGNvbnRyb2wuaGFzQXR0cmlidXRlKCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5saW5lLXdhcy1kaXNhYmxlZCcgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cHJpb3JfZGlzYWJsZWQgPSAnMScgPT09IGNvbnRyb2wuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5saW5lLXdhcy1kaXNhYmxlZCcgKTtcblx0XHRcdGNvbnRyb2wuZGlzYWJsZWQgPSBwcmlvcl9kaXNhYmxlZDtcblx0XHRcdGNvbnRyb2wucmVtb3ZlQXR0cmlidXRlKCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5saW5lLXdhcy1kaXNhYmxlZCcgKTtcblx0XHRcdGlmICggISBwcmlvcl9kaXNhYmxlZCApIHtcblx0XHRcdFx0Y29udHJvbC5yZW1vdmVBdHRyaWJ1dGUoICdhcmlhLWRpc2FibGVkJyApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlZ2lzdGVyIHRoZSBjdXJyZW50IGlubGluZSBiYXIgd2l0aCB0aGUgc2hhcmVkIHZpZXdwb3J0IGNvbnRyb2xsZXIuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlZ2lzdGVyX3N0aWNreV9iYXIoKSB7XG5cdFx0XHR2YXIgaW5saW5lX2JhciA9IG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3Rvciggb3B0aW9ucy5iYXJfc2VsZWN0b3IgKTtcblx0XHRcdHZhciBzZWxlY3Rpb25fY29udHJvbGxlciA9IG1vdW50X2VsZW1lbnQuX3dwYmNfdWlfY2F0YWxvZ19zZWxlY3Rpb25fY29udHJvbGxlcjtcblxuXHRcdFx0aWYgKCBpbmxpbmVfYmFyICYmIHNlbGVjdGlvbl9jb250cm9sbGVyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBzZWxlY3Rpb25fY29udHJvbGxlci5yZWdpc3Rlcl92aWV3cG9ydF9zdGlja3kgKSB7XG5cdFx0XHRcdHNlbGVjdGlvbl9jb250cm9sbGVyLnJlZ2lzdGVyX3ZpZXdwb3J0X3N0aWNreSggaW5saW5lX2JhciApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbW92ZSBzaGFyZWQgY2hhbmdlZC1yb3cgcHJlc2VudGF0aW9uIGFmdGVyIGlubGluZSBtb2RlIGVuZHMuXG5cdFx0ICpcblx0XHQgKiBEb21haW4gZHJhZnRzIGFuZCB2YWx1ZXMgcmVtYWluIGRvbWFpbi1vd25lZC4gVGhpcyBjbGVhbnVwIHJlbW92ZXMgb25seVxuXHRcdCAqIHRoZSBzaGFyZWQgY2xhc3MgYW5kIGJhZGdlIHRoYXQgdGhpcyBjb250cm9sbGVyIHByZXZpb3VzbHkgYXBwbGllZC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY2xlYXJfY2hhbmdlZF9yb3dzKCkge1xuXHRcdFx0bW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfdWlfY2F0YWxvZ19pbmxpbmVfcm93LmlzLWlubGluZS1jaGFuZ2VkJyApLmZvckVhY2goIGZ1bmN0aW9uICggcm93X2VsZW1lbnQgKSB7XG5cdFx0XHRcdHNldF9yb3dfY2hhbmdlZCggcm93X2VsZW1lbnQsIGZhbHNlLCBudWxsLCAnJyApO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFN5bmNocm9uaXplIHNoYXJlZCBpbmxpbmUgd29ya2Zsb3cgcHJlc2VudGF0aW9uIGZyb20gZG9tYWluLW93bmVkIHN0YXRlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHdvcmtmbG93X3N0YXRlIE5vcm1hbGl6ZWQgYWN0aXZlLCBidXN5LCBjb3VudCwgYW5kIGxhYmVscy5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHN5bmNocm9uaXplKCB3b3JrZmxvd19zdGF0ZSApIHtcblx0XHRcdHZhciBhY3RpdmU7XG5cdFx0XHR2YXIgYnVzeTtcblx0XHRcdHZhciBjb250cm9sc19yb290O1xuXHRcdFx0dmFyIGNvbnRyb2xzX2xvY2tlZDtcblx0XHRcdHZhciBpbmxpbmVfYmFyO1xuXHRcdFx0dmFyIHBhZ2VfZWxlbWVudDtcblx0XHRcdHZhciB0b2dnbGVfYnV0dG9uO1xuXHRcdFx0dmFyIHRvZ2dsZV9sYWJlbDtcblxuXHRcdFx0d29ya2Zsb3dfc3RhdGUgPSB3b3JrZmxvd19zdGF0ZSB8fCB7fTtcblx0XHRcdGFjdGl2ZSA9IHRydWUgPT09IHdvcmtmbG93X3N0YXRlLmFjdGl2ZTtcblx0XHRcdGJ1c3kgPSB0cnVlID09PSB3b3JrZmxvd19zdGF0ZS5idXN5O1xuXHRcdFx0Y29udHJvbHNfcm9vdCA9IG9wdGlvbnMuY29udHJvbHNfcm9vdCAmJiBvcHRpb25zLmNvbnRyb2xzX3Jvb3QucXVlcnlTZWxlY3RvckFsbCA/IG9wdGlvbnMuY29udHJvbHNfcm9vdCA6IG1vdW50X2VsZW1lbnQ7XG5cdFx0XHRjb250cm9sc19sb2NrZWQgPSBhY3RpdmUgfHwgdHJ1ZSA9PT0gd29ya2Zsb3dfc3RhdGUubG9ja19jb250cm9scztcblx0XHRcdGlubGluZV9iYXIgPSBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoIG9wdGlvbnMuYmFyX3NlbGVjdG9yICk7XG5cdFx0XHRwYWdlX2VsZW1lbnQgPSBnZXRfcGFnZV9lbGVtZW50KCk7XG5cdFx0XHR0b2dnbGVfYnV0dG9uID0gbW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCBvcHRpb25zLnRvZ2dsZV9zZWxlY3RvciApO1xuXG5cdFx0XHRpZiAoIGlubGluZV9iYXIgKSB7XG5cdFx0XHRcdGlubGluZV9iYXIuaGlkZGVuID0gISBhY3RpdmU7XG5cdFx0XHRcdGlubGluZV9iYXIuc2V0QXR0cmlidXRlKCAnYXJpYS1idXN5JywgYnVzeSA/ICd0cnVlJyA6ICdmYWxzZScgKTtcblx0XHRcdFx0aWYgKCBpbmxpbmVfYmFyLnF1ZXJ5U2VsZWN0b3IoIG9wdGlvbnMuY291bnRfc2VsZWN0b3IgKSApIHtcblx0XHRcdFx0XHRpbmxpbmVfYmFyLnF1ZXJ5U2VsZWN0b3IoIG9wdGlvbnMuY291bnRfc2VsZWN0b3IgKS50ZXh0Q29udGVudCA9IFN0cmluZyggd29ya2Zsb3dfc3RhdGUuY291bnRfdGV4dCB8fCAnJyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggaW5saW5lX2Jhci5xdWVyeVNlbGVjdG9yKCBvcHRpb25zLnJldmlld19zZWxlY3RvciApICkge1xuXHRcdFx0XHRcdGlubGluZV9iYXIucXVlcnlTZWxlY3Rvciggb3B0aW9ucy5yZXZpZXdfc2VsZWN0b3IgKS5kaXNhYmxlZCA9IGJ1c3kgfHwgISBOdW1iZXIoIHdvcmtmbG93X3N0YXRlLmNoYW5nZWRfY291bnQgfHwgMCApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggaW5saW5lX2Jhci5xdWVyeVNlbGVjdG9yKCBvcHRpb25zLmNhbmNlbF9zZWxlY3RvciApICkge1xuXHRcdFx0XHRcdGlubGluZV9iYXIucXVlcnlTZWxlY3Rvciggb3B0aW9ucy5jYW5jZWxfc2VsZWN0b3IgKS5kaXNhYmxlZCA9IGJ1c3k7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKCB0b2dnbGVfYnV0dG9uICkge1xuXHRcdFx0XHR0b2dnbGVfYnV0dG9uLmNsYXNzTGlzdC50b2dnbGUoICdpcy1hY3RpdmUnLCBhY3RpdmUgKTtcblx0XHRcdFx0dG9nZ2xlX2J1dHRvbi5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtYnVzeScsIGJ1c3kgKTtcblx0XHRcdFx0dG9nZ2xlX2J1dHRvbi5kaXNhYmxlZCA9IGJ1c3lcblx0XHRcdFx0XHR8fCB0cnVlID09PSB3b3JrZmxvd19zdGF0ZS50b2dnbGVfZGlzYWJsZWRcblx0XHRcdFx0XHR8fCAoICEgYWN0aXZlICYmIGZhbHNlID09PSB3b3JrZmxvd19zdGF0ZS5oYXNfaXRlbXMgKTtcblx0XHRcdFx0dG9nZ2xlX2J1dHRvbi5zZXRBdHRyaWJ1dGUoICdhcmlhLXByZXNzZWQnLCBhY3RpdmUgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0XHRcdHRvZ2dsZV9idXR0b24uc2V0QXR0cmlidXRlKCAnYXJpYS1idXN5JywgYnVzeSA/ICd0cnVlJyA6ICdmYWxzZScgKTtcblx0XHRcdFx0dG9nZ2xlX2xhYmVsID0gdG9nZ2xlX2J1dHRvbi5xdWVyeVNlbGVjdG9yKCBvcHRpb25zLnRvZ2dsZV9sYWJlbF9zZWxlY3RvciApO1xuXHRcdFx0XHRpZiAoIHRvZ2dsZV9sYWJlbCApIHtcblx0XHRcdFx0XHR0b2dnbGVfbGFiZWwudGV4dENvbnRlbnQgPSBhY3RpdmVcblx0XHRcdFx0XHRcdD8gU3RyaW5nKCB3b3JrZmxvd19zdGF0ZS5hY3RpdmVfdG9nZ2xlX3RleHQgfHwgJycgKVxuXHRcdFx0XHRcdFx0OiBTdHJpbmcoIHdvcmtmbG93X3N0YXRlLmluYWN0aXZlX3RvZ2dsZV90ZXh0IHx8ICcnICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKCBwYWdlX2VsZW1lbnQgKSB7XG5cdFx0XHRcdHBhZ2VfZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtaW5saW5lLWVkaXRpbmcnLCBhY3RpdmUgKTtcblx0XHRcdH1cblx0XHRcdGlmICggISBhY3RpdmUgKSB7XG5cdFx0XHRcdGNsZWFyX2NoYW5nZWRfcm93cygpO1xuXHRcdFx0fVxuXHRcdFx0Y29udHJvbHNfcm9vdC5xdWVyeVNlbGVjdG9yQWxsKCBnZXRfcHJvdGVjdGVkX3NlbGVjdG9yKCkgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGNvbnRyb2wgKSB7XG5cdFx0XHRcdHN5bmNocm9uaXplX3Byb3RlY3RlZF9jb250cm9sKCBjb250cm9sLCBjb250cm9sc19sb2NrZWQgKTtcblx0XHRcdH0gKTtcblx0XHRcdHJlZ2lzdGVyX3N0aWNreV9iYXIoKTtcblx0XHRcdGlmIChcblx0XHRcdFx0bW91bnRfZWxlbWVudC5fd3BiY191aV9jYXRhbG9nX3NlbGVjdGlvbl9jb250cm9sbGVyXG5cdFx0XHRcdCYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBtb3VudF9lbGVtZW50Ll93cGJjX3VpX2NhdGFsb2dfc2VsZWN0aW9uX2NvbnRyb2xsZXIucmVmcmVzaF92aWV3cG9ydF9zdGlja3lcblx0XHRcdCkge1xuXHRcdFx0XHRtb3VudF9lbGVtZW50Ll93cGJjX3VpX2NhdGFsb2dfc2VsZWN0aW9uX2NvbnRyb2xsZXIucmVmcmVzaF92aWV3cG9ydF9zdGlja3koKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBCbG9jayBhIGNhcHR1cmVkIGV2ZW50IHRoYXQgdGFyZ2V0cyBhIGNvbnRyb2wgcHJvdGVjdGVkIGJ5IGFjdGl2ZSBkcmFmdHMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0V2ZW50fSAgIGV2ZW50ICAgICAgICAgICBDYXB0dXJlZCBicm93c2VyIGV2ZW50LlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gY29udHJvbHNfbG9ja2VkIFdoZXRoZXIgdGhlIGRvbWFpbiB3b3JrZmxvdyBpcyBhY3RpdmUuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBldmVudCB3YXMgYmxvY2tlZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBwcm90ZWN0X2V2ZW50KCBldmVudCwgY29udHJvbHNfbG9ja2VkICkge1xuXHRcdFx0aWYgKCAhIGNvbnRyb2xzX2xvY2tlZCB8fCAhIGV2ZW50LnRhcmdldCB8fCAhIGV2ZW50LnRhcmdldC5jbG9zZXN0ICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgZXZlbnQudGFyZ2V0LmNsb3Nlc3QoIGdldF9wcm90ZWN0ZWRfc2VsZWN0b3IoKSApICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFN5bmNocm9uaXplIG9uZSBjaGFuZ2VkIHJvdyBhbmQgaXRzIGFjY2Vzc2libGUgdGV4dCBiYWRnZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJvd19lbGVtZW50ICAgICAgIERvbWFpbiByb3cgb3IgY2FyZCBlbGVtZW50LlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gICAgIGNoYW5nZWQgICAgICAgICAgIFdoZXRoZXIgaXRzIGRyYWZ0IGRpZmZlcnMuXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gaW5kaWNhdG9yX2VsZW1lbnQgQmFja3dhcmQtY29tcGF0aWJsZSBmYWxsYmFjayBiYWRnZSBob3N0LlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgICAgIGNoYW5nZWRfbGFiZWwgICAgIExvY2FsaXplZCBiYWRnZSB0ZXh0LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2V0X3Jvd19jaGFuZ2VkKCByb3dfZWxlbWVudCwgY2hhbmdlZCwgaW5kaWNhdG9yX2VsZW1lbnQsIGNoYW5nZWRfbGFiZWwgKSB7XG5cdFx0XHR2YXIgaW5kaWNhdG9yO1xuXHRcdFx0dmFyIHByZWZlcnJlZF9pbmRpY2F0b3JfaG9zdDtcblxuXHRcdFx0aWYgKCAhIHJvd19lbGVtZW50ICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRyb3dfZWxlbWVudC5jbGFzc0xpc3QuYWRkKCAnd3BiY191aV9jYXRhbG9nX2lubGluZV9yb3cnICk7XG5cdFx0XHRyb3dfZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtaW5saW5lLWNoYW5nZWQnLCAhISBjaGFuZ2VkICk7XG5cdFx0XHRwcmVmZXJyZWRfaW5kaWNhdG9yX2hvc3QgPSByb3dfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWlubGluZS1jaGFuZ2VkLWhvc3RdJyApO1xuXHRcdFx0aW5kaWNhdG9yID0gcm93X2VsZW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbmxpbmUtY2hhbmdlZC1sYWJlbF0nICk7XG5cdFx0XHRpZiAoICEgY2hhbmdlZCApIHtcblx0XHRcdFx0aWYgKCBpbmRpY2F0b3IgKSB7XG5cdFx0XHRcdFx0aW5kaWNhdG9yLnJlbW92ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggaW5kaWNhdG9yICYmIHByZWZlcnJlZF9pbmRpY2F0b3JfaG9zdCAmJiBpbmRpY2F0b3IucGFyZW50RWxlbWVudCAhPT0gcHJlZmVycmVkX2luZGljYXRvcl9ob3N0ICkge1xuXHRcdFx0XHRwcmVmZXJyZWRfaW5kaWNhdG9yX2hvc3QuaW5zZXJ0QmVmb3JlKCBpbmRpY2F0b3IsIHByZWZlcnJlZF9pbmRpY2F0b3JfaG9zdC5maXJzdENoaWxkICk7XG5cdFx0XHR9XG5cdFx0XHRpbmRpY2F0b3JfZWxlbWVudCA9IHByZWZlcnJlZF9pbmRpY2F0b3JfaG9zdCB8fCBpbmRpY2F0b3JfZWxlbWVudDtcblx0XHRcdGlmICggISBpbmRpY2F0b3IgJiYgaW5kaWNhdG9yX2VsZW1lbnQgKSB7XG5cdFx0XHRcdGluZGljYXRvciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdzcGFuJyApO1xuXHRcdFx0XHRpbmRpY2F0b3IuY2xhc3NOYW1lID0gJ3dwYmNfdWlfY2F0YWxvZ19pbmxpbmVfY2hhbmdlZF9sYWJlbCc7XG5cdFx0XHRcdGluZGljYXRvci5zZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdWktY2F0YWxvZy1pbmxpbmUtY2hhbmdlZC1sYWJlbCcsICcnICk7XG5cdFx0XHRcdGlmICggcHJlZmVycmVkX2luZGljYXRvcl9ob3N0ICkge1xuXHRcdFx0XHRcdHByZWZlcnJlZF9pbmRpY2F0b3JfaG9zdC5pbnNlcnRCZWZvcmUoIGluZGljYXRvciwgcHJlZmVycmVkX2luZGljYXRvcl9ob3N0LmZpcnN0Q2hpbGQgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpbmRpY2F0b3JfZWxlbWVudC5hcHBlbmRDaGlsZCggaW5kaWNhdG9yICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggaW5kaWNhdG9yICkge1xuXHRcdFx0XHRpbmRpY2F0b3IudGV4dENvbnRlbnQgPSBTdHJpbmcoIGNoYW5nZWRfbGFiZWwgfHwgJycgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0cHJvdGVjdF9ldmVudDogcHJvdGVjdF9ldmVudCxcblx0XHRcdHJlZ2lzdGVyX3N0aWNreV9iYXI6IHJlZ2lzdGVyX3N0aWNreV9iYXIsXG5cdFx0XHRzZXRfcm93X2NoYW5nZWQ6IHNldF9yb3dfY2hhbmdlZCxcblx0XHRcdHN5bmNocm9uaXplOiBzeW5jaHJvbml6ZVxuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogQ3JlYXRlIGEgZG9tYWluLW5ldXRyYWwgc2lnbmVkLXJldmlldyBwcmVzZW50YXRpb24gY29udHJvbGxlci5cblx0ICpcblx0ICogRG9tYWlucyBvd24gcHJldmlldyBhbmQgYXBwbHkgcmVxdWVzdHMsIHNpZ25lZCBwbGFucywgcGVybWlzc2lvbnMsIGZpZWxkXG5cdCAqIHZhbGlkYXRpb24sIGFuZCBtdXRhdGlvbnMuIFRoaXMgY29udHJvbGxlciBhY2NlcHRzIG9ubHkgdGhlIG5vcm1hbGl6ZWRcblx0ICogcmV2aWV3IERUTyBhbmQgb3ducyB0aGUgcmVwZWF0ZWQgbW9kZWwgcHJlcGFyYXRpb24gYW5kIGJ1c3ktc3RhdGUgbG9ja2luZy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IHNldHRpbmdzIERPTSByb290cyBhbmQgZG9tYWluIGJ1dHRvbiBzZWxlY3RvcnMuXG5cdCAqIEByZXR1cm4ge09iamVjdH0gUmV2aWV3IHByZXNlbnRhdGlvbiBjb250cm9sbGVyLlxuXHQgKi9cblx0ZnVuY3Rpb24gY3JlYXRlX2lubGluZV9yZXZpZXdfd29ya2Zsb3coIHNldHRpbmdzICkge1xuXHRcdHZhciBvcHRpb25zID0gT2JqZWN0LmFzc2lnbigge1xuXHRcdFx0YXBwbHlfc2VsZWN0b3I6ICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5saW5lLXJldmlldy1hcHBseV0nLFxuXHRcdFx0Y2FuY2VsX3NlbGVjdG9yOiAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWlubGluZS1yZXZpZXctY2FuY2VsXScsXG5cdFx0XHRyb290OiBkb2N1bWVudFxuXHRcdH0sIHNldHRpbmdzIHx8IHt9ICk7XG5cblx0XHQvKipcblx0XHQgKiBOb3JtYWxpemUgb25lIHNlcnZlci1hdXRob3JpdGF0aXZlIHJldmlldyBEVE8gZm9yIGEgZG9tYWluIHRlbXBsYXRlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHJldmlldyAgICAgICBTZXJ2ZXIgcmV2aWV3IHdpdGggcm93cyBhbmQgZmllbGQgY2hhbmdlcy5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcHJlc2VudGF0aW9uIExvY2FsaXplZCBoZWFkaW5ncyBhbmQgZXhwbGFuYXRvcnkgdGV4dC5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IEV4ZWN1dGFibGUtZnJlZSB0ZW1wbGF0ZSBtb2RlbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBwcmVwYXJlKCByZXZpZXcsIHByZXNlbnRhdGlvbiApIHtcblx0XHRcdHZhciBub3JtYWxpemVkX3Jvd3MgPSBbXTtcblxuXHRcdFx0cmV2aWV3ID0gcmV2aWV3ICYmICdvYmplY3QnID09PSB0eXBlb2YgcmV2aWV3ID8gcmV2aWV3IDoge307XG5cdFx0XHRwcmVzZW50YXRpb24gPSBwcmVzZW50YXRpb24gJiYgJ29iamVjdCcgPT09IHR5cGVvZiBwcmVzZW50YXRpb24gPyBwcmVzZW50YXRpb24gOiB7fTtcblx0XHRcdCggQXJyYXkuaXNBcnJheSggcmV2aWV3LnJvd3MgKSA/IHJldmlldy5yb3dzIDogW10gKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHJvdyApIHtcblx0XHRcdFx0dmFyIG5vcm1hbGl6ZWRfZmllbGRzID0gW107XG5cdFx0XHRcdHZhciBub3JtYWxpemVkX25vdGVzID0gW107XG5cblx0XHRcdFx0aWYgKCAhIHJvdyB8fCAnb2JqZWN0JyAhPT0gdHlwZW9mIHJvdyApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0KCBBcnJheS5pc0FycmF5KCByb3cuZmllbGRzICkgPyByb3cuZmllbGRzIDogW10gKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGZpZWxkICkge1xuXHRcdFx0XHRcdGlmICggISBmaWVsZCB8fCAnb2JqZWN0JyAhPT0gdHlwZW9mIGZpZWxkICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRub3JtYWxpemVkX2ZpZWxkcy5wdXNoKCB7XG5cdFx0XHRcdFx0XHRhZnRlcjogU3RyaW5nKCB1bmRlZmluZWQgPT09IGZpZWxkLmFmdGVyID8gJycgOiBmaWVsZC5hZnRlciApLFxuXHRcdFx0XHRcdFx0YmVmb3JlOiBTdHJpbmcoIHVuZGVmaW5lZCA9PT0gZmllbGQuYmVmb3JlID8gJycgOiBmaWVsZC5iZWZvcmUgKSxcblx0XHRcdFx0XHRcdGtleTogU3RyaW5nKCBmaWVsZC5rZXkgfHwgJycgKSxcblx0XHRcdFx0XHRcdGxhYmVsOiBTdHJpbmcoIGZpZWxkLmxhYmVsIHx8IGZpZWxkLmtleSB8fCAnJyApXG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdCggQXJyYXkuaXNBcnJheSggcm93Lm5vdGVzICkgPyByb3cubm90ZXMgOiBbXSApLmZvckVhY2goIGZ1bmN0aW9uICggbm90ZSApIHtcblx0XHRcdFx0XHRpZiAoICdzdHJpbmcnID09PSB0eXBlb2Ygbm90ZSB8fCAnbnVtYmVyJyA9PT0gdHlwZW9mIG5vdGUgKSB7XG5cdFx0XHRcdFx0XHRub3JtYWxpemVkX25vdGVzLnB1c2goIFN0cmluZyggbm90ZSApICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdGlmICggbm9ybWFsaXplZF9maWVsZHMubGVuZ3RoICkge1xuXHRcdFx0XHRcdG5vcm1hbGl6ZWRfcm93cy5wdXNoKCB7XG5cdFx0XHRcdFx0XHRmaWVsZHM6IG5vcm1hbGl6ZWRfZmllbGRzLFxuXHRcdFx0XHRcdFx0aWQ6IE51bWJlciggcm93LmlkIHx8IDAgKSxcblx0XHRcdFx0XHRcdG5vdGVzOiBub3JtYWxpemVkX25vdGVzLFxuXHRcdFx0XHRcdFx0dGl0bGU6IFN0cmluZyggcm93LnRpdGxlIHx8ICcnIClcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0Y2hhbmdlZF9sYWJlbDogU3RyaW5nKCBwcmVzZW50YXRpb24uY2hhbmdlZF9sYWJlbCB8fCAnJyApLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogU3RyaW5nKCBwcmVzZW50YXRpb24uZGVzY3JpcHRpb24gfHwgJycgKSxcblx0XHRcdFx0Zm9ybV9pZDogU3RyaW5nKCBwcmVzZW50YXRpb24uZm9ybV9pZCB8fCAnJyApLFxuXHRcdFx0XHRtb2RlOiBTdHJpbmcoIHByZXNlbnRhdGlvbi5tb2RlIHx8ICdpbmxpbmVfcmV2aWV3JyApLFxuXHRcdFx0XHRwZW5kaW5nX21lc3NhZ2U6IFN0cmluZyggcHJlc2VudGF0aW9uLnBlbmRpbmdfbWVzc2FnZSB8fCAnJyApLFxuXHRcdFx0XHRyb3dzOiBub3JtYWxpemVkX3Jvd3MsXG5cdFx0XHRcdHRpdGxlOiBTdHJpbmcoIHByZXNlbnRhdGlvbi50aXRsZSB8fCAnJyApLFxuXHRcdFx0XHR3YXJuaW5nOiBTdHJpbmcoIHJldmlldy53YXJuaW5nIHx8IHByZXNlbnRhdGlvbi53YXJuaW5nIHx8ICcnIClcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTG9jayBvciB1bmxvY2sgcmV2aWV3IGFjdGlvbnMgd2hpbGUgYSBkb21haW4gcmVxdWVzdCBpcyBpbiBmbGlnaHQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcmV2aWV3X3N0YXRlIEJ1c3kgYW5kIGFwcGx5LXJlYWR5IGZsYWdzLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc3luY2hyb25pemUoIHJldmlld19zdGF0ZSApIHtcblx0XHRcdHZhciBidXN5O1xuXHRcdFx0dmFyIGNhbl9hcHBseTtcblx0XHRcdHZhciByb290ID0gb3B0aW9ucy5yb290ICYmIG9wdGlvbnMucm9vdC5xdWVyeVNlbGVjdG9yQWxsID8gb3B0aW9ucy5yb290IDogZG9jdW1lbnQ7XG5cblx0XHRcdHJldmlld19zdGF0ZSA9IHJldmlld19zdGF0ZSB8fCB7fTtcblx0XHRcdGJ1c3kgPSB0cnVlID09PSByZXZpZXdfc3RhdGUuYnVzeTtcblx0XHRcdGNhbl9hcHBseSA9IHRydWUgPT09IHJldmlld19zdGF0ZS5jYW5fYXBwbHk7XG5cdFx0XHRyb290LnF1ZXJ5U2VsZWN0b3JBbGwoIG9wdGlvbnMuYXBwbHlfc2VsZWN0b3IgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGNvbnRyb2wgKSB7XG5cdFx0XHRcdGNvbnRyb2wuZGlzYWJsZWQgPSBidXN5IHx8ICEgY2FuX2FwcGx5O1xuXHRcdFx0XHRjb250cm9sLmNsYXNzTGlzdC50b2dnbGUoICdpcy1idXN5JywgYnVzeSApO1xuXHRcdFx0XHRjb250cm9sLnNldEF0dHJpYnV0ZSggJ2FyaWEtYnVzeScsIGJ1c3kgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRyb290LnF1ZXJ5U2VsZWN0b3JBbGwoIG9wdGlvbnMuY2FuY2VsX3NlbGVjdG9yICkuZm9yRWFjaCggZnVuY3Rpb24gKCBjb250cm9sICkge1xuXHRcdFx0XHRjb250cm9sLmRpc2FibGVkID0gYnVzeTtcblx0XHRcdH0gKTtcblx0XHRcdHJvb3QucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbmxpbmUtcmV2aWV3LWZvcm1dJyApLmZvckVhY2goIGZ1bmN0aW9uICggZm9ybSApIHtcblx0XHRcdFx0Zm9ybS5zZXRBdHRyaWJ1dGUoICdhcmlhLWJ1c3knLCBidXN5ID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRwcmVwYXJlOiBwcmVwYXJlLFxuXHRcdFx0c3luY2hyb25pemU6IHN5bmNocm9uaXplXG5cdFx0fTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGUgYSBkb21haW4tbmV1dHJhbCBwZXJtYW5lbnQtZGVsZXRpb24gcmV2aWV3IGNvbnRyb2xsZXIuXG5cdCAqXG5cdCAqIERvbWFpbnMgcmVtYWluIHJlc3BvbnNpYmxlIGZvciBkZWNpZGluZyB3aGV0aGVyIGRlbGV0aW9uIGlzIGFsbG93ZWQsXG5cdCAqIHByb2R1Y2luZyB0aGUgc2lnbmVkIGltcGFjdCByZXZpZXcsIHJlbmRlcmluZyB0aGVpciBhbGxvdy1saXN0ZWQgdGVtcGxhdGUsXG5cdCAqIGFuZCBhcHBseWluZyB0aGUgbXV0YXRpb24uIFRoaXMgY29udHJvbGxlciBvd25zIG9ubHkgdGhlIHJlcGVhdGVkIGJyb3dzZXJcblx0ICogbWVjaGFuaWNzIGZvciBleHBsaWNpdCBhY2tub3dsZWRnZW1lbnQsIGRlc3RydWN0aXZlIGZvb3RlciBwcmVzZW50YXRpb24sXG5cdCAqIGJ1c3kgbG9ja2luZywgYW5kIHJlZHVjZWQtbW90aW9uLXNhZmUgYXR0ZW50aW9uIGZlZWRiYWNrLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gc2V0dGluZ3MgRE9NIHJvb3RzIGFuZCBkb21haW4gc2VsZWN0b3JzLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IERlbGV0aW9uLXJldmlldyBwcmVzZW50YXRpb24gY29udHJvbGxlci5cblx0ICovXG5cdGZ1bmN0aW9uIGNyZWF0ZV9kZWxldGVfcmV2aWV3X3dvcmtmbG93KCBzZXR0aW5ncyApIHtcblx0XHR2YXIgb3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oIHtcblx0XHRcdGFja25vd2xlZGdlbWVudF9zZWxlY3RvcjogJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1kZWxldGUtYWNrbm93bGVkZ2VtZW50XScsXG5cdFx0XHRhcHBseV9zZWxlY3RvcjogJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1kZWxldGUtYXBwbHldLCBbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5zcGVjdG9yLXNhdmVdJyxcblx0XHRcdGNhbmNlbF9zZWxlY3RvcjogJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1kZWxldGUtY2FuY2VsXSwgW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1jYW5jZWxdJyxcblx0XHRcdHJvb3Q6IGRvY3VtZW50XG5cdFx0fSwgc2V0dGluZ3MgfHwge30gKTtcblx0XHR2YXIgcmV2aWV3X3N0YXRlID0ge1xuXHRcdFx0YnVzeTogZmFsc2UsXG5cdFx0XHRjYW5fYXBwbHk6IGZhbHNlXG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiB0aGUgY29uZmlndXJlZCBxdWVyeSByb290LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7RG9jdW1lbnR8RWxlbWVudH0gUXVlcnktY2FwYWJsZSByb290LlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9yb290KCkge1xuXHRcdFx0cmV0dXJuIG9wdGlvbnMucm9vdCAmJiBvcHRpb25zLnJvb3QucXVlcnlTZWxlY3RvckFsbCA/IG9wdGlvbnMucm9vdCA6IGRvY3VtZW50O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiB0aGUgYWN0aXZlIGFja25vd2xlZGdlbWVudCBjaGVja2JveC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge0hUTUxJbnB1dEVsZW1lbnR8bnVsbH0gQ2hlY2tib3ggb3IgbnVsbCB3aGVuIHRoZSByZXZpZXcgaXMgYmxvY2tlZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfYWNrbm93bGVkZ2VtZW50KCkge1xuXHRcdFx0cmV0dXJuIGdldF9yb290KCkucXVlcnlTZWxlY3Rvciggb3B0aW9ucy5hY2tub3dsZWRnZW1lbnRfc2VsZWN0b3IgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXN0YXJ0IHRoZSBmaW5pdGUgYWNrbm93bGVkZ2VtZW50IGF0dGVudGlvbiBhbmltYXRpb24uXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHB1bHNlX2Fja25vd2xlZGdlbWVudCgpIHtcblx0XHRcdHZhciBhY2tub3dsZWRnZW1lbnQgPSBnZXRfYWNrbm93bGVkZ2VtZW50KCk7XG5cdFx0XHR2YXIgY29udGFpbmVyID0gYWNrbm93bGVkZ2VtZW50ID8gYWNrbm93bGVkZ2VtZW50LmNsb3Nlc3QoICcud3BiY191aV9jYXRhbG9nX2RlbGV0ZV9yZXZpZXdfX2Fja25vd2xlZGdlbWVudCcgKSA6IG51bGw7XG5cblx0XHRcdGlmICggISBjb250YWluZXIgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtYXR0ZW50aW9uJyApO1xuXHRcdFx0dm9pZCBjb250YWluZXIub2Zmc2V0V2lkdGg7XG5cdFx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCggJ2lzLWF0dGVudGlvbicgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTeW5jaHJvbml6ZSBkZXN0cnVjdGl2ZSByZXZpZXcgYWN0aW9ucyB3aXRoIHNlcnZlciBhbmQgdXNlciBzdGF0ZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBuZXh0X3N0YXRlIEJ1c3kgYW5kIHNlcnZlci1hdXRob3JpdGF0aXZlIGFwcGx5IGZsYWdzLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc3luY2hyb25pemUoIG5leHRfc3RhdGUgKSB7XG5cdFx0XHR2YXIgYWNrbm93bGVkZ2VtZW50O1xuXHRcdFx0dmFyIGFja25vd2xlZGdlZDtcblx0XHRcdHZhciByb290ID0gZ2V0X3Jvb3QoKTtcblxuXHRcdFx0bmV4dF9zdGF0ZSA9IG5leHRfc3RhdGUgfHwge307XG5cdFx0XHRpZiAoICdib29sZWFuJyA9PT0gdHlwZW9mIG5leHRfc3RhdGUuYnVzeSApIHtcblx0XHRcdFx0cmV2aWV3X3N0YXRlLmJ1c3kgPSBuZXh0X3N0YXRlLmJ1c3k7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICdib29sZWFuJyA9PT0gdHlwZW9mIG5leHRfc3RhdGUuY2FuX2FwcGx5ICkge1xuXHRcdFx0XHRyZXZpZXdfc3RhdGUuY2FuX2FwcGx5ID0gbmV4dF9zdGF0ZS5jYW5fYXBwbHk7XG5cdFx0XHR9XG5cdFx0XHRhY2tub3dsZWRnZW1lbnQgPSBnZXRfYWNrbm93bGVkZ2VtZW50KCk7XG5cdFx0XHRhY2tub3dsZWRnZWQgPSAhISBhY2tub3dsZWRnZW1lbnQgJiYgYWNrbm93bGVkZ2VtZW50LmNoZWNrZWQ7XG5cdFx0XHRyb290LnF1ZXJ5U2VsZWN0b3JBbGwoIG9wdGlvbnMuYXBwbHlfc2VsZWN0b3IgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGNvbnRyb2wgKSB7XG5cdFx0XHRcdGNvbnRyb2wuZGlzYWJsZWQgPSByZXZpZXdfc3RhdGUuYnVzeSB8fCAhIHJldmlld19zdGF0ZS5jYW5fYXBwbHkgfHwgISBhY2tub3dsZWRnZWQ7XG5cdFx0XHRcdGNvbnRyb2wuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWJ1c3knLCByZXZpZXdfc3RhdGUuYnVzeSApO1xuXHRcdFx0XHRjb250cm9sLnNldEF0dHJpYnV0ZSggJ2FyaWEtYnVzeScsIHJldmlld19zdGF0ZS5idXN5ID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xuXHRcdFx0fSApO1xuXHRcdFx0cm9vdC5xdWVyeVNlbGVjdG9yQWxsKCBvcHRpb25zLmNhbmNlbF9zZWxlY3RvciApLmZvckVhY2goIGZ1bmN0aW9uICggY29udHJvbCApIHtcblx0XHRcdFx0Y29udHJvbC5kaXNhYmxlZCA9IHJldmlld19zdGF0ZS5idXN5O1xuXHRcdFx0fSApO1xuXHRcdFx0cm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWRlbGV0ZS1yZXZpZXctZm9ybV0nICkuZm9yRWFjaCggZnVuY3Rpb24gKCBmb3JtICkge1xuXHRcdFx0XHRmb3JtLnNldEF0dHJpYnV0ZSggJ2FyaWEtYnVzeScsIHJldmlld19zdGF0ZS5idXN5ID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFwcGx5IHRoZSBzdGFuZGFyZCBkZXN0cnVjdGl2ZSBmb290ZXIgY29udHJhY3QgdG8gZG9tYWluLW93bmVkIGNvbnRyb2xzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGZvb3Rlcl9zZXR0aW5ncyBGb290ZXIgZWxlbWVudCwgZm9ybSBJRCwgYW5kIGxhYmVsLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY29uZmlndXJlX2Zvb3RlciggZm9vdGVyX3NldHRpbmdzICkge1xuXHRcdFx0dmFyIGZvb3Rlcl9vcHRpb25zID0gZm9vdGVyX3NldHRpbmdzIHx8IHt9O1xuXHRcdFx0dmFyIGZvb3RlciA9IGZvb3Rlcl9vcHRpb25zLmZvb3RlciAmJiBmb290ZXJfb3B0aW9ucy5mb290ZXIucXVlcnlTZWxlY3RvciA/IGZvb3Rlcl9vcHRpb25zLmZvb3RlciA6IG51bGw7XG5cdFx0XHR2YXIgYXBwbHlfYnV0dG9uID0gZm9vdGVyID8gZm9vdGVyLnF1ZXJ5U2VsZWN0b3IoIG9wdGlvbnMuYXBwbHlfc2VsZWN0b3IgKSA6IG51bGw7XG5cblx0XHRcdGlmICggISBhcHBseV9idXR0b24gKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGFwcGx5X2J1dHRvbi5jbGFzc0xpc3QucmVtb3ZlKCAnYnV0dG9uLXByaW1hcnknLCAnYnV0dG9uLWxpbmstZGVsZXRlJyApO1xuXHRcdFx0YXBwbHlfYnV0dG9uLmNsYXNzTGlzdC5hZGQoICdidXR0b24tc2Vjb25kYXJ5JywgJ3dwYmNfdWlfY2F0YWxvZ19kZWxldGVfcmV2aWV3X19hcHBseScgKTtcblx0XHRcdGFwcGx5X2J1dHRvbi50ZXh0Q29udGVudCA9IFN0cmluZyggZm9vdGVyX29wdGlvbnMubGFiZWwgfHwgJycgKTtcblx0XHRcdGlmICggZm9vdGVyX29wdGlvbnMuZm9ybV9pZCApIHtcblx0XHRcdFx0YXBwbHlfYnV0dG9uLnNldEF0dHJpYnV0ZSggJ2Zvcm0nLCBTdHJpbmcoIGZvb3Rlcl9vcHRpb25zLmZvcm1faWQgKSApO1xuXHRcdFx0fVxuXHRcdFx0cmV2aWV3X3N0YXRlLmNhbl9hcHBseSA9IHRydWUgPT09IGZvb3Rlcl9vcHRpb25zLmNhbl9hcHBseTtcblx0XHRcdHJldmlld19zdGF0ZS5idXN5ID0gZmFsc2U7XG5cdFx0XHRzeW5jaHJvbml6ZSgpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEhhbmRsZSBhIGRlbGVnYXRlZCBhY2tub3dsZWRnZW1lbnQgY2hhbmdlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnQgQnJvd3NlciBjaGFuZ2UgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBldmVudCBiZWxvbmdlZCB0byB0aGlzIHdvcmtmbG93LlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9jaGFuZ2UoIGV2ZW50ICkge1xuXHRcdFx0dmFyIHRhcmdldCA9IGV2ZW50ICYmIGV2ZW50LnRhcmdldDtcblxuXHRcdFx0aWYgKCAhIHRhcmdldCB8fCAhIHRhcmdldC5tYXRjaGVzIHx8ICEgdGFyZ2V0Lm1hdGNoZXMoIG9wdGlvbnMuYWNrbm93bGVkZ2VtZW50X3NlbGVjdG9yICkgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmICggdGFyZ2V0LmNoZWNrZWQgKSB7XG5cdFx0XHRcdHZhciBjb250YWluZXIgPSB0YXJnZXQuY2xvc2VzdCggJy53cGJjX3VpX2NhdGFsb2dfZGVsZXRlX3Jldmlld19fYWNrbm93bGVkZ2VtZW50JyApO1xuXHRcdFx0XHRpZiAoIGNvbnRhaW5lciApIHtcblx0XHRcdFx0XHRjb250YWluZXIuY2xhc3NMaXN0LnJlbW92ZSggJ2lzLWF0dGVudGlvbicgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cHVsc2VfYWNrbm93bGVkZ2VtZW50KCk7XG5cdFx0XHR9XG5cdFx0XHRzeW5jaHJvbml6ZSgpO1xuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0Y29uZmlndXJlX2Zvb3RlcjogY29uZmlndXJlX2Zvb3Rlcixcblx0XHRcdGhhbmRsZV9jaGFuZ2U6IGhhbmRsZV9jaGFuZ2UsXG5cdFx0XHRwdWxzZV9hY2tub3dsZWRnZW1lbnQ6IHB1bHNlX2Fja25vd2xlZGdlbWVudCxcblx0XHRcdHN5bmNocm9uaXplOiBzeW5jaHJvbml6ZVxuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogTW91bnQgb25lIHJlZ2lzdGVyZWQgY2F0YWxvZyBhbmQgcmVuZGVyIGl0cyBpbml0aWFsIHJlc3BvbnNlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnIFJlZ2lzdGVyZWQgYnJvd3NlciBjb25maWd1cmF0aW9uLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8ZmFsc2V9IENhdGFsb2cgY29udHJvbGxlciBvciBmYWxzZSB3aGVuIG1vdW50aW5nIGZhaWxzLlxuXHQgKi9cblx0ZnVuY3Rpb24gbW91bnRfY2F0YWxvZyggY29uZmlnICkge1xuXHRcdHZhciBjYXRhbG9nX3N0YXRlO1xuXHRcdHZhciBjYXRhbG9nX3RlbXBsYXRlO1xuXHRcdHZhciBjb250ZW50X2VsZW1lbnQ7XG5cdFx0dmFyIGluaXRpYWxfc2VxdWVuY2U7XG5cdFx0dmFyIG1vdW50X2VsZW1lbnQ7XG5cblx0XHRpZiAoICEgY29uZmlnIHx8ICEgY29uZmlnLmlkIHx8ICEgY29uZmlnLm1vdW50X2lkIHx8ICEgY29uZmlnLnRlbXBsYXRlcyB8fCAhIGNvbmZpZy50ZW1wbGF0ZXMuY2F0YWxvZyB8fCAhIGNvbmZpZy50ZW1wbGF0ZXMuc2hlbGwgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uZmlnLmNhdGFsb2dfaWQgPSBjb25maWcuaWQ7XG5cdFx0bW91bnRfZWxlbWVudCAgICAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggY29uZmlnLm1vdW50X2lkICk7XG5cdFx0Y2F0YWxvZ190ZW1wbGF0ZSAgPSBsb2FkX3RlbXBsYXRlKCBjb25maWcsICdjYXRhbG9nJyApO1xuXG5cdFx0aWYgKCAhIG1vdW50X2VsZW1lbnQgfHwgISBjYXRhbG9nX3RlbXBsYXRlICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdG1vdW50X2VsZW1lbnQuaW5uZXJIVE1MID0gY2F0YWxvZ190ZW1wbGF0ZSggT2JqZWN0LmFzc2lnbigge30sIGNvbmZpZywgeyBjYXRhbG9nX2lkOiBjb25maWcuY2F0YWxvZ19pZCB9ICkgKTtcblx0XHRjb250ZW50X2VsZW1lbnQgPSBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctY29udGVudF0nICk7XG5cdFx0aWYgKCAhIGNvbnRlbnRfZWxlbWVudCApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKCBjb25maWcuaTE4biAmJiBjb25maWcuaTE4bi5jYXRhbG9nX2xhYmVsICkge1xuXHRcdFx0Y29udGVudF9lbGVtZW50LnBhcmVudE5vZGUuc2V0QXR0cmlidXRlKCAnYXJpYS1sYWJlbCcsIGNvbmZpZy5pMThuLmNhdGFsb2dfbGFiZWwgKTtcblx0XHR9XG5cblx0XHRjYXRhbG9nX3N0YXRlICAgICAgICAgICAgICAgICA9IGdldF9jYXRhbG9nX3N0YXRlKCBjb25maWcuY2F0YWxvZ19pZCApO1xuXHRcdGNhdGFsb2dfc3RhdGUuY29uZmlnICAgICAgICAgID0gY29uZmlnO1xuXHRcdGNhdGFsb2dfc3RhdGUuY29udGVudF9lbGVtZW50ID0gY29udGVudF9lbGVtZW50O1xuXHRcdGNhdGFsb2dfc3RhdGUucmVzcG9uc2VfZWxlbWVudCA9IGNvbnRlbnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXJlc3BvbnNlXScgKSB8fCBjb250ZW50X2VsZW1lbnQ7XG5cdFx0Y2F0YWxvZ19zdGF0ZS5sb2FkaW5nX2VsZW1lbnQgPSBjb250ZW50X2VsZW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1sb2FkaW5nXScgKTtcblx0XHRjYXRhbG9nX3N0YXRlLmxhdGVzdF9zZXF1ZW5jZSA9IDA7XG5cdFx0Y2F0YWxvZ19zdGF0ZS5yZXF1ZXN0X3ZhbHVlcyA9IE9iamVjdC5hc3NpZ24oIHt9LCBjb25maWcuaW5pdGlhbF9yZXF1ZXN0IHx8IHt9ICk7XG5cdFx0YmluZF9jYXRhbG9nX2NvbnRyb2xzKCBjb25maWcsIG1vdW50X2VsZW1lbnQgKTtcblx0XHRpZiAoIHdpbmRvdy53cGJjX3VpX2NhdGFsb2dfYWN0aW9ucyAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfdWlfY2F0YWxvZ19hY3Rpb25zLmluaXRpYWxpemUgKSB7XG5cdFx0XHRjYXRhbG9nX3N0YXRlLmFjdGlvbnNfY29udHJvbGxlciA9IHdpbmRvdy53cGJjX3VpX2NhdGFsb2dfYWN0aW9ucy5pbml0aWFsaXplKCBtb3VudF9lbGVtZW50LCBjb25maWcgKTtcblx0XHR9XG5cdFx0aWYgKFxuXHRcdFx0Y29uZmlnLmZlYXR1cmVzXG5cdFx0XHQmJiBjb25maWcuZmVhdHVyZXMuaGllcmFyY2h5XG5cdFx0XHQmJiB3aW5kb3cud3BiY191aV9jYXRhbG9nX2hpZXJhcmNoeVxuXHRcdFx0JiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX3VpX2NhdGFsb2dfaGllcmFyY2h5LmluaXRpYWxpemVcblx0XHQpIHtcblx0XHRcdGNhdGFsb2dfc3RhdGUuaGllcmFyY2h5X2NvbnRyb2xsZXIgPSB3aW5kb3cud3BiY191aV9jYXRhbG9nX2hpZXJhcmNoeS5pbml0aWFsaXplKCBtb3VudF9lbGVtZW50LCBjb25maWcsIGZ1bmN0aW9uICggaGllcmFyY2h5X3N0YXRlICkge1xuXHRcdFx0XHR2YXIgaGllcmFyY2h5X2NvbmZpZ3VyYXRpb24gPSBjb25maWcuaGllcmFyY2h5IHx8IHt9O1xuXHRcdFx0XHR2YXIgcHJlZmVyZW5jZV9rZXkgPSBTdHJpbmcoIGhpZXJhcmNoeV9jb25maWd1cmF0aW9uLnByZWZlcmVuY2Vfa2V5IHx8ICcnICk7XG5cdFx0XHRcdHZhciBwcmVmZXJlbmNlX3ZhbHVlcyA9IHt9O1xuXG5cdFx0XHRcdGlmICggJ2dsb2JhbCcgIT09IGhpZXJhcmNoeV9jb25maWd1cmF0aW9uLnBlcnNpc3RlbmNlIHx8ICEgcHJlZmVyZW5jZV9rZXkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSggZmFsc2UgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRwcmVmZXJlbmNlX3ZhbHVlc1sgcHJlZmVyZW5jZV9rZXkgXSA9IEpTT04uc3RyaW5naWZ5KCBoaWVyYXJjaHlfc3RhdGUgfHwge30gKTtcblxuXHRcdFx0XHRyZXR1cm4gc2F2ZV9jYXRhbG9nX3ByZWZlcmVuY2VzKCBjb25maWcsIHByZWZlcmVuY2VfdmFsdWVzICk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXHRcdGlmIChcblx0XHRcdGNvbmZpZy5mZWF0dXJlc1xuXHRcdFx0JiYgY29uZmlnLmZlYXR1cmVzLnNlbGVjdGlvblxuXHRcdFx0JiYgd2luZG93LndwYmNfdWlfY2F0YWxvZ19zZWxlY3Rpb25cblx0XHRcdCYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY191aV9jYXRhbG9nX3NlbGVjdGlvbi5pbml0aWFsaXplXG5cdFx0KSB7XG5cdFx0XHRjYXRhbG9nX3N0YXRlLnNlbGVjdGlvbl9jb250cm9sbGVyID0gd2luZG93LndwYmNfdWlfY2F0YWxvZ19zZWxlY3Rpb24uaW5pdGlhbGl6ZSggbW91bnRfZWxlbWVudCwgY29uZmlnICk7XG5cdFx0fVxuXG5cdFx0aWYgKCAhIHNldF9jYXRhbG9nX2xvYWRpbmdfc3RhdGUoIGNvbmZpZywgdHJ1ZSApICkge1xuXHRcdFx0cmVuZGVyX3RlbXBsYXRlKCBjb25maWcsICdzaGVsbCcsIHtcblx0XHRcdFx0Y2F0YWxvZ19pZDogY29uZmlnLmNhdGFsb2dfaWQsXG5cdFx0XHRcdGFyaWFfbGFiZWw6IGNvbmZpZy5pMThuICYmIGNvbmZpZy5pMThuLmNhdGFsb2dfbGFiZWwgPyBjb25maWcuaTE4bi5jYXRhbG9nX2xhYmVsIDogJycsXG5cdFx0XHRcdGxvYWRpbmdfbWVzc2FnZTogY29uZmlnLmkxOG4gJiYgY29uZmlnLmkxOG4ubG9hZGluZyA/IGNvbmZpZy5pMThuLmxvYWRpbmcgOiAnJ1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdGlmICggY29uZmlnLmF1dG9fbG9hZCApIHtcblx0XHRcdHJlcXVlc3RfY2F0YWxvZyggY29uZmlnLCBjb25maWcuaW5pdGlhbF9yZXF1ZXN0IHx8IHt9ICk7XG5cdFx0XHRpbml0aWFsX3NlcXVlbmNlID0gY2F0YWxvZ19zdGF0ZS5sYXRlc3Rfc2VxdWVuY2U7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGluaXRpYWxfc2VxdWVuY2UgPSBuZXh0X3JlcXVlc3Rfc2VxdWVuY2UoIGNvbmZpZy5jYXRhbG9nX2lkICk7XG5cdFx0XHRpZiAoIGNvbmZpZy5pbml0aWFsX3Jlc3BvbnNlICkge1xuXHRcdFx0XHRyZW5kZXJfcmVzcG9uc2UoIGNvbmZpZywgY29uZmlnLmluaXRpYWxfcmVzcG9uc2UsIGluaXRpYWxfc2VxdWVuY2UgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0Y2F0YWxvZ19pZDogY29uZmlnLmNhdGFsb2dfaWQsXG5cdFx0XHRjbGVhcl9zZWxlY3Rpb246IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0aWYgKCBjYXRhbG9nX3N0YXRlLnNlbGVjdGlvbl9jb250cm9sbGVyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBjYXRhbG9nX3N0YXRlLnNlbGVjdGlvbl9jb250cm9sbGVyLmNsZWFyICkge1xuXHRcdFx0XHRcdGNhdGFsb2dfc3RhdGUuc2VsZWN0aW9uX2NvbnRyb2xsZXIuY2xlYXIoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGdldF9zZWxlY3RlZF9pZHM6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIGNhdGFsb2dfc3RhdGUuc2VsZWN0aW9uX2NvbnRyb2xsZXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNhdGFsb2dfc3RhdGUuc2VsZWN0aW9uX2NvbnRyb2xsZXIuZ2V0X3NlbGVjdGVkX2lkc1xuXHRcdFx0XHRcdD8gY2F0YWxvZ19zdGF0ZS5zZWxlY3Rpb25fY29udHJvbGxlci5nZXRfc2VsZWN0ZWRfaWRzKClcblx0XHRcdFx0XHQ6IFtdO1xuXHRcdFx0fSxcblx0XHRcdGdldF9oaWVyYXJjaHlfY29udHJvbGxlcjogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gY2F0YWxvZ19zdGF0ZS5oaWVyYXJjaHlfY29udHJvbGxlciB8fCBmYWxzZTtcblx0XHRcdH0sXG5cdFx0XHRzZXF1ZW5jZTogaW5pdGlhbF9zZXF1ZW5jZSxcblx0XHRcdGxvYWQ6IGZ1bmN0aW9uICggcmVxdWVzdF92YWx1ZXMgKSB7XG5cdFx0XHRcdHJldHVybiByZXF1ZXN0X2NhdGFsb2coIGNvbmZpZywgcmVxdWVzdF92YWx1ZXMgfHwge30gKTtcblx0XHRcdH0sXG5cdFx0XHRzYXZlX3ByZWZlcmVuY2VzOiBmdW5jdGlvbiAoIHByZWZlcmVuY2VfdmFsdWVzICkge1xuXHRcdFx0XHRyZXR1cm4gc2F2ZV9jYXRhbG9nX3ByZWZlcmVuY2VzKCBjb25maWcsIHByZWZlcmVuY2VfdmFsdWVzIHx8IHt9ICk7XG5cdFx0XHR9LFxuXHRcdFx0cmVmcmVzaF9jb250cm9sczogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZWZyZXNoX2NhdGFsb2dfY29udHJvbHMoIGNvbmZpZyApO1xuXHRcdFx0fSxcblx0XHRcdHN5bmNfdGFibGVfbWluX3dpZHRoOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHN5bmNfY2F0YWxvZ190YWJsZV9taW5fd2lkdGgoIGNvbmZpZyApO1xuXHRcdFx0fSxcblx0XHRcdG5leHRfc2VxdWVuY2U6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIG5leHRfcmVxdWVzdF9zZXF1ZW5jZSggY29uZmlnLmNhdGFsb2dfaWQgKTtcblx0XHRcdH0sXG5cdFx0XHRyZW5kZXJfcmVzcG9uc2U6IGZ1bmN0aW9uICggcmVzcG9uc2UsIHJlcXVlc3Rfc2VxdWVuY2UgKSB7XG5cdFx0XHRcdHJldHVybiByZW5kZXJfcmVzcG9uc2UoIGNvbmZpZywgcmVzcG9uc2UsIHJlcXVlc3Rfc2VxdWVuY2UgKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0d2luZG93LndwYmNfdWlfY2F0YWxvZyA9IHdpbmRvdy53cGJjX3VpX2NhdGFsb2cgfHwge307XG5cdHdpbmRvdy53cGJjX3VpX2NhdGFsb2cuY3JlYXRlX2luc3BlY3Rvcl93b3JrZmxvdyA9IGNyZWF0ZV9pbnNwZWN0b3Jfd29ya2Zsb3c7XG5cdHdpbmRvdy53cGJjX3VpX2NhdGFsb2cuY3JlYXRlX2lubGluZV9lZGl0aW5nX3dvcmtmbG93ID0gY3JlYXRlX2lubGluZV9lZGl0aW5nX3dvcmtmbG93O1xuXHR3aW5kb3cud3BiY191aV9jYXRhbG9nLmNyZWF0ZV9pbmxpbmVfcmV2aWV3X3dvcmtmbG93ID0gY3JlYXRlX2lubGluZV9yZXZpZXdfd29ya2Zsb3c7XG5cdHdpbmRvdy53cGJjX3VpX2NhdGFsb2cuY3JlYXRlX2RlbGV0ZV9yZXZpZXdfd29ya2Zsb3cgPSBjcmVhdGVfZGVsZXRlX3Jldmlld193b3JrZmxvdztcblx0d2luZG93LndwYmNfdWlfY2F0YWxvZy5pc19zdGFsZV9yZXNwb25zZSA9IGlzX3N0YWxlX3Jlc3BvbnNlO1xuXHR3aW5kb3cud3BiY191aV9jYXRhbG9nLmxvYWRfdGVtcGxhdGUgPSBsb2FkX3RlbXBsYXRlO1xuXHR3aW5kb3cud3BiY191aV9jYXRhbG9nLm1vdW50ID0gbW91bnRfY2F0YWxvZztcblx0d2luZG93LndwYmNfdWlfY2F0YWxvZy5uZXh0X3JlcXVlc3Rfc2VxdWVuY2UgPSBuZXh0X3JlcXVlc3Rfc2VxdWVuY2U7XG5cdHdpbmRvdy53cGJjX3VpX2NhdGFsb2cucmVuZGVyX3Jlc3BvbnNlID0gcmVuZGVyX3Jlc3BvbnNlO1xuXHR3aW5kb3cud3BiY191aV9jYXRhbG9nLnJlcXVlc3QgPSByZXF1ZXN0X2NhdGFsb2c7XG5cdHdpbmRvdy53cGJjX3VpX2NhdGFsb2cuc3luY190YWJsZV9taW5fd2lkdGggPSBzeW5jX2NhdGFsb2dfdGFibGVfbWluX3dpZHRoO1xuXHR3aW5kb3cud3BiY191aV9jYXRhbG9nLnN5bmNocm9uaXplX292ZXJmbG93X3Rvb2x0aXBzID0gc3luY2hyb25pemVfb3ZlcmZsb3dfdG9vbHRpcHM7XG5cdHdpbmRvdy53cGJjX3VpX2NhdGFsb2cudmFsaWRhdGVfcmVzcG9uc2UgPSB2YWxpZGF0ZV9yZXNwb25zZTtcbn0oIHdpbmRvdywgZG9jdW1lbnQgKSApO1xuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNFLFdBQVdBLE1BQU0sRUFBRUMsUUFBUSxFQUFHO0VBQy9CLFlBQVk7O0VBRVosSUFBSUMsY0FBYyxHQUFHLENBQUMsQ0FBQzs7RUFFdkI7QUFDRDtB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
