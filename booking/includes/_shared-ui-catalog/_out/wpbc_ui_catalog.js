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
      var is_overflowing = text_element.scrollWidth > text_element.clientWidth + 1 || text_element.scrollHeight > text_element.clientHeight + 1;
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
        text_element.setAttribute('data-original-title', full_text);
        text_element.classList.add('tooltip_top', 'wpbc_ui_listing__overflow_tooltip');
        if (!text_element.hasAttribute('tabindex')) {
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
    var default_protected_selector = ['[data-wpbc-ui-catalog-view]', '[data-wpbc-ui-catalog-template-pack]', '[data-wpbc-ui-catalog-display-customizer] summary', '[data-wpbc-ui-catalog-search]', '[data-wpbc-ui-catalog-filter]', '[data-wpbc-ui-catalog-select-item]', '[data-wpbc-ui-catalog-select-all]', '[data-wpbc-ui-catalog-sort]', '[data-wpbc-ui-catalog-page]', '[data-wpbc-ui-catalog-items-per-page]', '[data-wpbc-ui-catalog-column-visible]', '[data-wpbc-ui-catalog-column-order-reset]', '[data-wpbc-ui-catalog-preferences-reset]'].join(', ');
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvX3NoYXJlZC11aS1jYXRhbG9nL19vdXQvd3BiY191aV9jYXRhbG9nLmpzIiwibmFtZXMiOlsid2luZG93IiwiZG9jdW1lbnQiLCJjYXRhbG9nX3N0YXRlcyIsIm5vcm1hbGl6ZV9zZXF1ZW5jZSIsInNlcXVlbmNlIiwibm9ybWFsaXplZF9zZXF1ZW5jZSIsImlzRmluaXRlIiwiTWF0aCIsImZsb29yIiwidGVzdCIsInBhcnNlSW50Iiwibm9ybWFsaXplX3NjaGVtYV92ZXJzaW9uIiwic2NoZW1hX3ZlcnNpb24iLCJub3JtYWxpemVkX3ZlcnNpb24iLCJnZXRfY2F0YWxvZ19zdGF0ZSIsImNhdGFsb2dfaWQiLCJhY3Rpb25zX2NvbnRyb2xsZXIiLCJhYm9ydF9jb250cm9sbGVyIiwiY29uZmlnIiwiY29udGVudF9lbGVtZW50IiwibGF0ZXN0X3NlcXVlbmNlIiwicHJlZmVyZW5jZV9hYm9ydF9jb250cm9sbGVyIiwicHJlZmVyZW5jZV9yZXZpc2lvbiIsInJlcXVlc3RfdmFsdWVzIiwic2VhcmNoX3RpbWVyIiwic2VsZWN0aW9uX2NvbnRyb2xsZXIiLCJzb3J0YWJsZSIsImdldF9zZWFyY2hfZGVib3VuY2VfZGVsYXkiLCJzZWFyY2hfY29uZmlnIiwic2VhcmNoIiwiZGVib3VuY2VfZGVsYXkiLCJOdW1iZXIiLCJkZWJvdW5jZV9kZWxheV9tcyIsIm1pbiIsImlzX2ltbWVkaWF0ZV9zZWFyY2hfY2xlYXJfZW5hYmxlZCIsImltbWVkaWF0ZV9jbGVhciIsIm5leHRfcmVxdWVzdF9zZXF1ZW5jZSIsImNhdGFsb2dfc3RhdGUiLCJpc19zdGFsZV9yZXNwb25zZSIsImdldF90ZW1wbGF0ZV9pZCIsInRlbXBsYXRlX3JvbGUiLCJpbml0aWFsX3JlcXVlc3QiLCJ0ZW1wbGF0ZV9pZCIsInRlbXBsYXRlX3BhY2siLCJ0ZW1wbGF0ZV9wYWNrX2lkIiwidGVtcGxhdGVzIiwiaWQiLCJ0ZW1wbGF0ZV9wYWNrcyIsInNldF9hY3RpdmVfdGVtcGxhdGVfcGFjayIsImNhdGFsb2dfcm9vdCIsIm5vcm1hbGl6ZWRfcGFja19pZCIsImRlZmF1bHRfdGVtcGxhdGVfcGFjayIsImNsb3Nlc3QiLCJzZXRBdHRyaWJ1dGUiLCJsb2FkX3RlbXBsYXRlIiwid3AiLCJ0ZW1wbGF0ZSIsImVycm9yIiwicmVuZGVyX3RlbXBsYXRlIiwidGVtcGxhdGVfZGF0YSIsInJlbmRlcl90YXJnZXQiLCJyZW5kZXJlZF9odG1sIiwicmVzcG9uc2VfZWxlbWVudCIsImRpc3BhdGNoX2NhdGFsb2dfZXZlbnQiLCJpbm5lckhUTUwiLCJwYXJlbnROb2RlIiwic2V0X2NhdGFsb2dfbG9hZGluZ19zdGF0ZSIsImlzX2xvYWRpbmciLCJsb2FkaW5nX2VsZW1lbnQiLCJjbGFzc0xpc3QiLCJ0b2dnbGUiLCJzeW5jX2NhdGFsb2dfdGFibGVfbWluX3dpZHRoIiwibW91bnRfZWxlbWVudCIsIm1vdW50X2lkIiwiZ2V0RWxlbWVudEJ5SWQiLCJ0YWJsZSIsInF1ZXJ5U2VsZWN0b3IiLCJoZWFkZXJfY2VsbHMiLCJ0YWJsZV9taW5fd2lkdGgiLCJnZXRDb21wdXRlZFN0eWxlIiwiQXJyYXkiLCJwcm90b3R5cGUiLCJmaWx0ZXIiLCJjYWxsIiwicXVlcnlTZWxlY3RvckFsbCIsImhlYWRlcl9jZWxsIiwiaGlkZGVuIiwiZm9yRWFjaCIsImNvbHVtbl9taW5fd2lkdGgiLCJwYXJzZUZsb2F0IiwiZ2V0UHJvcGVydHlWYWx1ZSIsInN0eWxlIiwic2V0UHJvcGVydHkiLCJjZWlsIiwicG9zaXRpb25fZGlzcGxheV9wYW5lbCIsImN1c3RvbWl6ZXIiLCJwYW5lbCIsInN1bW1hcnkiLCJmaWVsZF9saXN0Iiwic3VtbWFyeV9yZWN0IiwicGFuZWxfcmVjdCIsInZpZXdwb3J0X3dpZHRoIiwidmlld3BvcnRfaGVpZ2h0IiwibWFyZ2luIiwiZ2FwIiwic3BhY2VfYWJvdmUiLCJzcGFjZV9iZWxvdyIsIm5hdHVyYWxfaGVpZ2h0Iiwib3Blbl9hYm92ZSIsImF2YWlsYWJsZV9oZWlnaHQiLCJyZW5kZXJlZF9oZWlnaHQiLCJwYW5lbF9sZWZ0IiwicGFuZWxfdG9wIiwib3BlbiIsInJlbW92ZSIsInJlbW92ZVByb3BlcnR5IiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0IiwiZG9jdW1lbnRFbGVtZW50IiwiY2xpZW50V2lkdGgiLCJpbm5lcldpZHRoIiwiaW5uZXJIZWlnaHQiLCJjbGllbnRIZWlnaHQiLCJtYXgiLCJ0b3AiLCJib3R0b20iLCJzY3JvbGxIZWlnaHQiLCJoZWlnaHQiLCJyaWdodCIsIndpZHRoIiwicm91bmQiLCJhZGQiLCJyZXNldF9kaXNwbGF5X3BhbmVsX3Bvc2l0aW9uIiwiY2xvc2VfZGlzcGxheV9jdXN0b21pemVyIiwicmVzdG9yZV9mb2N1cyIsImZvY3VzIiwicmVuZGVyX2Vycm9yIiwibWVzc2FnZSIsImkxOG4iLCJ0aXRsZSIsImVycm9yX3RpdGxlIiwiZXJyb3JfbWVzc2FnZSIsImV2ZW50X25hbWUiLCJkZXRhaWwiLCJjYXRhbG9nX2V2ZW50IiwiQ3VzdG9tRXZlbnQiLCJidWJibGVzIiwiY3JlYXRlRXZlbnQiLCJpbml0Q3VzdG9tRXZlbnQiLCJkaXNwYXRjaEV2ZW50IiwiYXBwZW5kX3JlcXVlc3RfdmFsdWUiLCJyZXF1ZXN0X2JvZHkiLCJyZXF1ZXN0X2tleSIsInJlcXVlc3RfdmFsdWUiLCJpc0FycmF5IiwiYXJyYXlfdmFsdWUiLCJhcHBlbmQiLCJTdHJpbmciLCJnZXRfY29sdW1uX29yZGVyIiwic2xpY2UiLCJtYXAiLCJjb2x1bW5faXRlbSIsImdldEF0dHJpYnV0ZSIsImNvbHVtbl9pZCIsImdldF92aXNpYmxlX2NvbHVtbnMiLCJjb2x1bW5fY29udHJvbCIsImNoZWNrZWQiLCJ2YWx1ZSIsInNhdmVfY29sdW1uX2NvbnRyb2xzIiwidmlld19jb250cm9sIiwicmVxdWVzdF9jYXRhbG9nIiwiY29sdW1uX29yZGVyIiwicGFnZV9udW1iZXIiLCJwcmVmZXJlbmNlX2FjdGlvbiIsInZpc2libGVfY29sdW1ucyIsImFubm91bmNlX2NvbHVtbl9tb3ZlZCIsInN0YXR1c19lbGVtZW50IiwidGV4dENvbnRlbnQiLCJzZXRUaW1lb3V0IiwiY29sdW1uX21vdmVkIiwidXBkYXRlX3VybF9zdGF0ZSIsInJlc3BvbnNlIiwiZmlsdGVycyIsInBhcmFtZXRlcnMiLCJ1cmxfcGFyYW1ldGVycyIsInN0YXRlX3ZhbHVlcyIsInBhZ2luYXRpb24iLCJpdGVtc19wZXJfcGFnZSIsInNvcnRfYnkiLCJzb3J0aW5nIiwic29ydF9vcmRlciIsImRpc3BsYXkiLCJwYWdlX3VybCIsImhpc3RvcnkiLCJyZXBsYWNlU3RhdGUiLCJVUkwiLCJsb2NhdGlvbiIsImhyZWYiLCJPYmplY3QiLCJrZXlzIiwiZmlsdGVyX2tleSIsInN0YXRlX2tleSIsInBhcmFtZXRlcl9uYW1lIiwic3RhdGVfdmFsdWUiLCJqb2luIiwic2VhcmNoUGFyYW1zIiwiZGVsZXRlIiwic2V0IiwidG9TdHJpbmciLCJiaW5kX2NhdGFsb2dfY29udHJvbHMiLCJfd3BiY191aV9jYXRhbG9nX2NvbnRyb2xzX2JvdW5kIiwiYWRkRXZlbnRMaXN0ZW5lciIsImV2ZW50Iiwic2VhcmNoX2NvbnRyb2wiLCJ0YXJnZXQiLCJtYXRjaGVzIiwicHJldmVudERlZmF1bHQiLCJjbGVhcl9jb250cm9sIiwiY2xlYXJUaW1lb3V0IiwiZGVmYXVsdF9yZXF1ZXN0IiwiZmlsdGVyX3JlcXVlc3QiLCJ2aWV3X2RlZmluaXRpb24iLCJ2aWV3cyIsImRlZmluaXRpb25zIiwiZmllbGRzIiwiY2xvc2VfY29udHJvbCIsInBhZ2VfY29udHJvbCIsInJlc2V0X2NvbnRyb2wiLCJyZXNldF9vcmRlcl9jb250cm9sIiwic2VhcmNoX2NsZWFyIiwic29ydF9jb250cm9sIiwic29ydF9rZXkiLCJkaXNhYmxlZCIsImFzc2lnbiIsImtleSIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsImNvbnRhaW5zIiwicmVmcmVzaF9jYXRhbG9nX2NvbnRyb2xzIiwiY29sdW1uX2xpc3QiLCJfd3BiY191aV9jYXRhbG9nX2luaXRpYWxpemVkIiwiaGFuZGxlIiwiaXRlbSIsInNpYmxpbmciLCJwcmV2aW91c0VsZW1lbnRTaWJsaW5nIiwibmV4dEVsZW1lbnRTaWJsaW5nIiwiaW5zZXJ0QmVmb3JlIiwiU29ydGFibGUiLCJhbmltYXRpb24iLCJjaG9zZW5DbGFzcyIsImRyYWdnYWJsZSIsImdob3N0Q2xhc3MiLCJvbkVuZCIsInNvcnRfZXZlbnQiLCJvbGRJbmRleCIsIm5ld0luZGV4IiwidmFsaWRhdGVfcmVzcG9uc2UiLCJjb25maWd1cmVkX3NjaGVtYV92ZXJzaW9uIiwicmVzcG9uc2Vfc2NoZW1hX3ZlcnNpb24iLCJzdWNjZXNzIiwicmVxdWVzdF9pZCIsImNvZGUiLCJyZXRyeWFibGUiLCJpdGVtcyIsImhpZXJhcmNoeSIsImNhcGFiaWxpdGllcyIsIm1lc3NhZ2VzIiwicmVmcmVzaF9jYXRhbG9nX2hpZXJhcmNoeSIsImhpZXJhcmNoeV9jb250cm9sbGVyIiwicmVmcmVzaCIsInJlbmRlcl9yZXNwb25zZSIsInJlcXVlc3Rfc2VxdWVuY2UiLCJpdGVtc190ZW1wbGF0ZV9kYXRhIiwicmVzcG9uc2Vfc2VxdWVuY2UiLCJsZW5ndGgiLCJpc19lbXB0eV9yZW5kZXJlZCIsImVtcHR5X3RpdGxlIiwiZW1wdHlfbWVzc2FnZSIsInBlcnNpc3RlbnRfcmVxdWVzdF92YWx1ZXMiLCJyZXF1ZXN0X3VybCIsImFqYXhfdXJsIiwiYWN0aW9uIiwibm9uY2UiLCJmZXRjaCIsIlByb21pc2UiLCJyZXNvbHZlIiwiYWJvcnQiLCJBYm9ydENvbnRyb2xsZXIiLCJhcmlhX2xhYmVsIiwiY2F0YWxvZ19sYWJlbCIsImxvYWRpbmdfbWVzc2FnZSIsImxvYWRpbmciLCJVUkxTZWFyY2hQYXJhbXMiLCJEYXRlIiwibm93IiwibWV0aG9kIiwiY3JlZGVudGlhbHMiLCJoZWFkZXJzIiwiYm9keSIsInNpZ25hbCIsInVuZGVmaW5lZCIsInRoZW4iLCJ0ZXh0IiwicmVzcG9uc2VfdGV4dCIsInJlc3BvbnNlX3BheWxvYWQiLCJKU09OIiwicGFyc2UiLCJpc19yZW5kZXJlZCIsImNhdGNoIiwibmFtZSIsInNhdmVfY2F0YWxvZ19wcmVmZXJlbmNlcyIsInByZWZlcmVuY2VfdmFsdWVzIiwicmVxdWVzdF9yZXZpc2lvbiIsIm9rIiwic3luY2hyb25pemVfb3ZlcmZsb3dfdG9vbHRpcHMiLCJjYXRhbG9nX21vdW50IiwiaGFzX292ZXJmbG93aW5nX3RleHQiLCJ0b29sdGlwX3NlbGVjdG9yIiwidGV4dF9lbGVtZW50IiwiZnVsbF90ZXh0Iiwic3RhdGljX3RpdGxlIiwiaXNfb3ZlcmZsb3dpbmciLCJzY3JvbGxXaWR0aCIsIl90aXBweSIsImRlc3Ryb3kiLCJyZW1vdmVBdHRyaWJ1dGUiLCJoYXNBdHRyaWJ1dGUiLCJ3cGJjX2RlZmluZV90aXBweV90b29sdGlwcyIsImNyZWF0ZV9pbnNwZWN0b3Jfd29ya2Zsb3ciLCJzZXR0aW5ncyIsIm9wdGlvbnMiLCJleHBhbmQiLCJnZXRfZm9vdGVyIiwiZ2V0X2hvc3QiLCJyZW5kZXJfc2hlbGwiLCJzaGVsbF9kYXRhIiwiaG9zdCIsImZvb3RlciIsIm1vdW50IiwicmVuZGVyZWRfc2hlbGwiLCJzZXRfc3RhdGUiLCJzdGF0ZSIsImVycm9yX3RleHQiLCJmb3JtX3RhcmdldCIsImVtcHR5IiwiaW5kZXhPZiIsIm9wZW5fbG9hZGluZyIsImdldF9mb3JtX3RhcmdldCIsImNyZWF0ZV9pbmxpbmVfZWRpdGluZ193b3JrZmxvdyIsImRlZmF1bHRfcHJvdGVjdGVkX3NlbGVjdG9yIiwiYmFyX3NlbGVjdG9yIiwiY2FuY2VsX3NlbGVjdG9yIiwiY29udHJvbHNfcm9vdCIsImNvdW50X3NlbGVjdG9yIiwicGFnZV9lbGVtZW50IiwicHJvdGVjdGVkX3NlbGVjdG9yIiwicmV2aWV3X3NlbGVjdG9yIiwidG9nZ2xlX2xhYmVsX3NlbGVjdG9yIiwidG9nZ2xlX3NlbGVjdG9yIiwiZ2V0X3BhZ2VfZWxlbWVudCIsIm5vZGVUeXBlIiwiZ2V0X3Byb3RlY3RlZF9zZWxlY3RvciIsInN5bmNocm9uaXplX3Byb3RlY3RlZF9jb250cm9sIiwiY29udHJvbCIsImNvbnRyb2xzX2xvY2tlZCIsInByaW9yX2Rpc2FibGVkIiwicmVnaXN0ZXJfc3RpY2t5X2JhciIsImlubGluZV9iYXIiLCJfd3BiY191aV9jYXRhbG9nX3NlbGVjdGlvbl9jb250cm9sbGVyIiwicmVnaXN0ZXJfdmlld3BvcnRfc3RpY2t5IiwiY2xlYXJfY2hhbmdlZF9yb3dzIiwicm93X2VsZW1lbnQiLCJzZXRfcm93X2NoYW5nZWQiLCJzeW5jaHJvbml6ZSIsIndvcmtmbG93X3N0YXRlIiwiYWN0aXZlIiwiYnVzeSIsInRvZ2dsZV9idXR0b24iLCJ0b2dnbGVfbGFiZWwiLCJsb2NrX2NvbnRyb2xzIiwiY291bnRfdGV4dCIsImNoYW5nZWRfY291bnQiLCJ0b2dnbGVfZGlzYWJsZWQiLCJoYXNfaXRlbXMiLCJhY3RpdmVfdG9nZ2xlX3RleHQiLCJpbmFjdGl2ZV90b2dnbGVfdGV4dCIsInJlZnJlc2hfdmlld3BvcnRfc3RpY2t5IiwicHJvdGVjdF9ldmVudCIsInN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbiIsImNoYW5nZWQiLCJpbmRpY2F0b3JfZWxlbWVudCIsImNoYW5nZWRfbGFiZWwiLCJpbmRpY2F0b3IiLCJwcmVmZXJyZWRfaW5kaWNhdG9yX2hvc3QiLCJwYXJlbnRFbGVtZW50IiwiZmlyc3RDaGlsZCIsImNyZWF0ZUVsZW1lbnQiLCJjbGFzc05hbWUiLCJhcHBlbmRDaGlsZCIsImNyZWF0ZV9pbmxpbmVfcmV2aWV3X3dvcmtmbG93IiwiYXBwbHlfc2VsZWN0b3IiLCJyb290IiwicHJlcGFyZSIsInJldmlldyIsInByZXNlbnRhdGlvbiIsIm5vcm1hbGl6ZWRfcm93cyIsInJvd3MiLCJyb3ciLCJub3JtYWxpemVkX2ZpZWxkcyIsIm5vcm1hbGl6ZWRfbm90ZXMiLCJmaWVsZCIsInB1c2giLCJhZnRlciIsImJlZm9yZSIsImxhYmVsIiwibm90ZXMiLCJub3RlIiwiZGVzY3JpcHRpb24iLCJmb3JtX2lkIiwibW9kZSIsInBlbmRpbmdfbWVzc2FnZSIsIndhcm5pbmciLCJyZXZpZXdfc3RhdGUiLCJjYW5fYXBwbHkiLCJmb3JtIiwiY3JlYXRlX2RlbGV0ZV9yZXZpZXdfd29ya2Zsb3ciLCJhY2tub3dsZWRnZW1lbnRfc2VsZWN0b3IiLCJnZXRfcm9vdCIsImdldF9hY2tub3dsZWRnZW1lbnQiLCJwdWxzZV9hY2tub3dsZWRnZW1lbnQiLCJhY2tub3dsZWRnZW1lbnQiLCJjb250YWluZXIiLCJvZmZzZXRXaWR0aCIsIm5leHRfc3RhdGUiLCJhY2tub3dsZWRnZWQiLCJjb25maWd1cmVfZm9vdGVyIiwiZm9vdGVyX3NldHRpbmdzIiwiZm9vdGVyX29wdGlvbnMiLCJhcHBseV9idXR0b24iLCJoYW5kbGVfY2hhbmdlIiwibW91bnRfY2F0YWxvZyIsImNhdGFsb2dfdGVtcGxhdGUiLCJpbml0aWFsX3NlcXVlbmNlIiwiY2F0YWxvZyIsInNoZWxsIiwid3BiY191aV9jYXRhbG9nX2FjdGlvbnMiLCJpbml0aWFsaXplIiwiZmVhdHVyZXMiLCJ3cGJjX3VpX2NhdGFsb2dfaGllcmFyY2h5IiwiaGllcmFyY2h5X3N0YXRlIiwiaGllcmFyY2h5X2NvbmZpZ3VyYXRpb24iLCJwcmVmZXJlbmNlX2tleSIsInBlcnNpc3RlbmNlIiwic3RyaW5naWZ5Iiwic2VsZWN0aW9uIiwid3BiY191aV9jYXRhbG9nX3NlbGVjdGlvbiIsImF1dG9fbG9hZCIsImluaXRpYWxfcmVzcG9uc2UiLCJjbGVhcl9zZWxlY3Rpb24iLCJjbGVhciIsImdldF9zZWxlY3RlZF9pZHMiLCJnZXRfaGllcmFyY2h5X2NvbnRyb2xsZXIiLCJsb2FkIiwic2F2ZV9wcmVmZXJlbmNlcyIsInJlZnJlc2hfY29udHJvbHMiLCJzeW5jX3RhYmxlX21pbl93aWR0aCIsIm5leHRfc2VxdWVuY2UiLCJ3cGJjX3VpX2NhdGFsb2ciLCJyZXF1ZXN0Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvX3NoYXJlZC11aS1jYXRhbG9nL19zcmMvd3BiY191aV9jYXRhbG9nLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ29udHJvbCBzaGFyZWQgcmVxdWVzdCBzZXF1ZW5jZXMgYW5kIHJlbmRlciBub3JtYWxpemVkIGNhdGFsb2cgcmVzcG9uc2VzLlxuICpcbiAqIERvbWFpbiBzY3JpcHRzIHByb3ZpZGUgY29uZmlndXJhdGlvbiBhbmQgZG9tYWluLXNwZWNpZmljIGludGVyYWN0aW9ucy4gVGhpc1xuICogY29udHJvbGxlciBvd25zIG9ubHkgYWxsb3ctbGlzdGVkIFdQIHRlbXBsYXRlcywgc2hhcmVkIHJlc3BvbnNlIHZhbGlkYXRpb24sXG4gKiBsb2FkaW5nLCBlbXB0eSwgcG9wdWxhdGVkLCBlcnJvciwgYW5kIHN0YWxlLXJlc3BvbnNlIG1lY2hhbmljcy5cbiAqXG4gKiBAc2luY2UgMTEuNi4wXG4gKi9cbiggZnVuY3Rpb24gKCB3aW5kb3csIGRvY3VtZW50ICkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0dmFyIGNhdGFsb2dfc3RhdGVzID0ge307XG5cblx0LyoqXG5cdCAqIFJldHVybiBhIG5vcm1hbGl6ZWQgbm9uLW5lZ2F0aXZlIHJlcXVlc3Qgc2VxdWVuY2UuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gc2VxdWVuY2UgQ2FuZGlkYXRlIHJlcXVlc3Qgc2VxdWVuY2UuXG5cdCAqIEByZXR1cm4ge251bWJlcnxudWxsfSBTZXF1ZW5jZSBvciBudWxsIHdoZW4gbWFsZm9ybWVkLlxuXHQgKi9cblx0ZnVuY3Rpb24gbm9ybWFsaXplX3NlcXVlbmNlKCBzZXF1ZW5jZSApIHtcblx0XHR2YXIgbm9ybWFsaXplZF9zZXF1ZW5jZTtcblxuXHRcdGlmICggJ251bWJlcicgPT09IHR5cGVvZiBzZXF1ZW5jZSAmJiBpc0Zpbml0ZSggc2VxdWVuY2UgKSAmJiBNYXRoLmZsb29yKCBzZXF1ZW5jZSApID09PSBzZXF1ZW5jZSApIHtcblx0XHRcdG5vcm1hbGl6ZWRfc2VxdWVuY2UgPSBzZXF1ZW5jZTtcblx0XHR9IGVsc2UgaWYgKCAnc3RyaW5nJyA9PT0gdHlwZW9mIHNlcXVlbmNlICYmIC9eXFxkKyQvLnRlc3QoIHNlcXVlbmNlICkgKSB7XG5cdFx0XHRub3JtYWxpemVkX3NlcXVlbmNlID0gcGFyc2VJbnQoIHNlcXVlbmNlLCAxMCApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRyZXR1cm4gMCA8PSBub3JtYWxpemVkX3NlcXVlbmNlID8gbm9ybWFsaXplZF9zZXF1ZW5jZSA6IG51bGw7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIGEgc3VwcG9ydGVkIHBvc2l0aXZlIHJlc3BvbnNlIHNjaGVtYSB2ZXJzaW9uLlxuXHQgKlxuXHQgKiBXb3JkUHJlc3MgbG9jYWxpemVzIHRvcC1sZXZlbCBzY2FsYXIgdmFsdWVzIGFzIHN0cmluZ3MsIHNvIHRoZSByZWdpc3RlcmVkXG5cdCAqIGNvbmZpZ3VyYXRpb24gbWF5IGNvbnRhaW4gXCIxXCIgd2hpbGUgdGhlIG5lc3RlZCByZXNwb25zZSByZXRhaW5zIG51bWJlciAxLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IHNjaGVtYV92ZXJzaW9uIENhbmRpZGF0ZSBzY2hlbWEgdmVyc2lvbi5cblx0ICogQHJldHVybiB7bnVtYmVyfG51bGx9IFN1cHBvcnRlZCB2ZXJzaW9uIG9yIG51bGwuXG5cdCAqL1xuXHRmdW5jdGlvbiBub3JtYWxpemVfc2NoZW1hX3ZlcnNpb24oIHNjaGVtYV92ZXJzaW9uICkge1xuXHRcdHZhciBub3JtYWxpemVkX3ZlcnNpb24gPSBub3JtYWxpemVfc2VxdWVuY2UoIHNjaGVtYV92ZXJzaW9uICk7XG5cblx0XHRyZXR1cm4gMSA9PT0gbm9ybWFsaXplZF92ZXJzaW9uID8gbm9ybWFsaXplZF92ZXJzaW9uIDogbnVsbDtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gb25lIGNhdGFsb2cncyByZXF1ZXN0IHN0YXRlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gY2F0YWxvZ19pZCBSZWdpc3RlcmVkIGNhdGFsb2cgaWRlbnRpZmllci5cblx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IE11dGFibGUgY2F0YWxvZyBzdGF0ZSBvciBudWxsLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X2NhdGFsb2dfc3RhdGUoIGNhdGFsb2dfaWQgKSB7XG5cdFx0aWYgKCAhIGNhdGFsb2dfaWQgfHwgJ3N0cmluZycgIT09IHR5cGVvZiBjYXRhbG9nX2lkICkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0aWYgKCAhIGNhdGFsb2dfc3RhdGVzWyBjYXRhbG9nX2lkIF0gKSB7XG5cdFx0XHRjYXRhbG9nX3N0YXRlc1sgY2F0YWxvZ19pZCBdID0ge1xuXHRcdFx0XHRhY3Rpb25zX2NvbnRyb2xsZXI6IG51bGwsXG5cdFx0XHRcdGFib3J0X2NvbnRyb2xsZXI6IG51bGwsXG5cdFx0XHRcdGNvbmZpZzogbnVsbCxcblx0XHRcdFx0Y29udGVudF9lbGVtZW50OiBudWxsLFxuXHRcdFx0XHRsYXRlc3Rfc2VxdWVuY2U6IDAsXG5cdFx0XHRcdHByZWZlcmVuY2VfYWJvcnRfY29udHJvbGxlcjogbnVsbCxcblx0XHRcdFx0cHJlZmVyZW5jZV9yZXZpc2lvbjogMCxcblx0XHRcdFx0cmVxdWVzdF92YWx1ZXM6IHt9LFxuXHRcdFx0XHRzZWFyY2hfdGltZXI6IDAsXG5cdFx0XHRcdHNlbGVjdGlvbl9jb250cm9sbGVyOiBudWxsLFxuXHRcdFx0XHRzb3J0YWJsZTogbnVsbFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRyZXR1cm4gY2F0YWxvZ19zdGF0ZXNbIGNhdGFsb2dfaWQgXTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gdGhlIHJlZ2lzdGVyZWQsIGJvdW5kZWQgZGVsYXkgZm9yIGFuIGluY3JlbWVudGFsIHNlYXJjaCByZXF1ZXN0LlxuXHQgKlxuXHQgKiBTZWFyY2ggdGltaW5nIGlzIGEgZG9tYWluLW5ldXRyYWwgaW50ZXJhY3Rpb24gbWVjaGFuaWMuIENhdGFsb2dzIG1heSB0dW5lXG5cdCAqIHRoZSBkZWxheSB0aHJvdWdoIHRoZWlyIHNlcnZlci1ub3JtYWxpemVkIGNvbmZpZ3VyYXRpb24gd2l0aG91dCByZXBsYWNpbmdcblx0ICogdGhlIHNoYXJlZCByZXF1ZXN0IGNvbnRyb2xsZXIuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgUmVnaXN0ZXJlZCBicm93c2VyIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEByZXR1cm4ge251bWJlcn0gRGVsYXkgaW4gbWlsbGlzZWNvbmRzIGJldHdlZW4gemVybyBhbmQgMjAwMC5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9zZWFyY2hfZGVib3VuY2VfZGVsYXkoIGNvbmZpZyApIHtcblx0XHR2YXIgc2VhcmNoX2NvbmZpZyA9IGNvbmZpZyAmJiBjb25maWcuc2VhcmNoICYmICdvYmplY3QnID09PSB0eXBlb2YgY29uZmlnLnNlYXJjaCA/IGNvbmZpZy5zZWFyY2ggOiB7fTtcblx0XHR2YXIgZGVib3VuY2VfZGVsYXkgPSBOdW1iZXIoIHNlYXJjaF9jb25maWcuZGVib3VuY2VfZGVsYXlfbXMgKTtcblxuXHRcdGlmICggISBpc0Zpbml0ZSggZGVib3VuY2VfZGVsYXkgKSB8fCBkZWJvdW5jZV9kZWxheSA8IDAgKSB7XG5cdFx0XHRyZXR1cm4gMzAwO1xuXHRcdH1cblxuXHRcdHJldHVybiBNYXRoLm1pbiggMjAwMCwgTWF0aC5mbG9vciggZGVib3VuY2VfZGVsYXkgKSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIERldGVybWluZSB3aGV0aGVyIGNsZWFyaW5nIHNlYXJjaCBieXBhc3NlcyB0aGUgaW5jcmVtZW50YWwtc2VhcmNoIGRlbGF5LlxuXHQgKlxuXHQgKiBJbW1lZGlhdGUgY2xlYXIgcmVtYWlucyB0aGUgY29tcGF0aWJpbGl0eSBkZWZhdWx0LiBBIGNhdGFsb2cgbWF5IGRpc2FibGVcblx0ICogaXQgb25seSB0aHJvdWdoIHNlcnZlci1ub3JtYWxpemVkLCBkb21haW4tbmV1dHJhbCBzZWFyY2ggY29uZmlndXJhdGlvbi5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBSZWdpc3RlcmVkIGJyb3dzZXIgY29uZmlndXJhdGlvbi5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIENsZWFyIG11c3QgcmVxdWVzdCB1bmZpbHRlcmVkIHJlc3VsdHMgbm93LlxuXHQgKi9cblx0ZnVuY3Rpb24gaXNfaW1tZWRpYXRlX3NlYXJjaF9jbGVhcl9lbmFibGVkKCBjb25maWcgKSB7XG5cdFx0cmV0dXJuICEgY29uZmlnIHx8ICEgY29uZmlnLnNlYXJjaCB8fCBmYWxzZSAhPT0gY29uZmlnLnNlYXJjaC5pbW1lZGlhdGVfY2xlYXI7XG5cdH1cblxuXHQvKipcblx0ICogU3RhcnQgYSBuZXcgcmVxdWVzdCBzZXF1ZW5jZSBmb3Igb25lIGNhdGFsb2cuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBjYXRhbG9nX2lkIFJlZ2lzdGVyZWQgY2F0YWxvZyBpZGVudGlmaWVyLlxuXHQgKiBAcmV0dXJuIHtudW1iZXJ9IE5ldyBzZXF1ZW5jZSwgb3IgemVybyBmb3IgYW4gaW52YWxpZCBjYXRhbG9nLlxuXHQgKi9cblx0ZnVuY3Rpb24gbmV4dF9yZXF1ZXN0X3NlcXVlbmNlKCBjYXRhbG9nX2lkICkge1xuXHRcdHZhciBjYXRhbG9nX3N0YXRlID0gZ2V0X2NhdGFsb2dfc3RhdGUoIGNhdGFsb2dfaWQgKTtcblxuXHRcdGlmICggISBjYXRhbG9nX3N0YXRlICkge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXG5cdFx0Y2F0YWxvZ19zdGF0ZS5sYXRlc3Rfc2VxdWVuY2UgKz0gMTtcblxuXHRcdHJldHVybiBjYXRhbG9nX3N0YXRlLmxhdGVzdF9zZXF1ZW5jZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBEZXRlcm1pbmUgd2hldGhlciBhIHJlc3BvbnNlIGJlbG9uZ3MgdG8gYW4gb2xkZXIgcmVxdWVzdC5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IGNhdGFsb2dfaWQgUmVnaXN0ZXJlZCBjYXRhbG9nIGlkZW50aWZpZXIuXG5cdCAqIEBwYXJhbSB7Kn0gICAgICBzZXF1ZW5jZSAgIFJlc3BvbnNlIHJlcXVlc3Qgc2VxdWVuY2UuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgcmVzcG9uc2UgbXVzdCBub3QgcmVuZGVyLlxuXHQgKi9cblx0ZnVuY3Rpb24gaXNfc3RhbGVfcmVzcG9uc2UoIGNhdGFsb2dfaWQsIHNlcXVlbmNlICkge1xuXHRcdHZhciBjYXRhbG9nX3N0YXRlID0gZ2V0X2NhdGFsb2dfc3RhdGUoIGNhdGFsb2dfaWQgKTtcblx0XHR2YXIgbm9ybWFsaXplZF9zZXF1ZW5jZSA9IG5vcm1hbGl6ZV9zZXF1ZW5jZSggc2VxdWVuY2UgKTtcblxuXHRcdHJldHVybiAhIGNhdGFsb2dfc3RhdGUgfHwgbnVsbCA9PT0gbm9ybWFsaXplZF9zZXF1ZW5jZSB8fCBub3JtYWxpemVkX3NlcXVlbmNlIDwgY2F0YWxvZ19zdGF0ZS5sYXRlc3Rfc2VxdWVuY2U7XG5cdH1cblxuXHQvKipcblx0ICogUmVzb2x2ZSBvbmUgYWxsb3ctbGlzdGVkIHRlbXBsYXRlIGlkZW50aWZpZXIgZnJvbSB0aGUgY29uZmlndXJhdGlvbi5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyAgICAgICAgUmVnaXN0ZXJlZCBicm93c2VyIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZW1wbGF0ZV9yb2xlIFRlbXBsYXRlIHJvbGUgc3VjaCBhcyBlbXB0eSBvciBlcnJvci5cblx0ICogQHJldHVybiB7c3RyaW5nfSBUZW1wbGF0ZSBpZGVudGlmaWVyIG9yIGFuIGVtcHR5IHN0cmluZy5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF90ZW1wbGF0ZV9pZCggY29uZmlnLCB0ZW1wbGF0ZV9yb2xlICkge1xuXHRcdHZhciBjYXRhbG9nX3N0YXRlO1xuXHRcdHZhciBpbml0aWFsX3JlcXVlc3Q7XG5cdFx0dmFyIHRlbXBsYXRlX2lkID0gJyc7XG5cdFx0dmFyIHRlbXBsYXRlX3BhY2s7XG5cdFx0dmFyIHRlbXBsYXRlX3BhY2tfaWQ7XG5cblx0XHRpZiAoICEgY29uZmlnIHx8ICEgY29uZmlnLnRlbXBsYXRlcyB8fCAnc3RyaW5nJyAhPT0gdHlwZW9mIHRlbXBsYXRlX3JvbGUgKSB7XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXG5cdFx0aWYgKCAnc3RyaW5nJyA9PT0gdHlwZW9mIGNvbmZpZy50ZW1wbGF0ZXNbIHRlbXBsYXRlX3JvbGUgXSApIHtcblx0XHRcdHRlbXBsYXRlX2lkID0gY29uZmlnLnRlbXBsYXRlc1sgdGVtcGxhdGVfcm9sZSBdO1xuXHRcdH1cblxuXHRcdGNhdGFsb2dfc3RhdGUgICAgPSAoIGNvbmZpZy5jYXRhbG9nX2lkIHx8IGNvbmZpZy5pZCApID8gZ2V0X2NhdGFsb2dfc3RhdGUoIGNvbmZpZy5jYXRhbG9nX2lkIHx8IGNvbmZpZy5pZCApIDogbnVsbDtcblx0XHRpbml0aWFsX3JlcXVlc3QgID0gY29uZmlnLmluaXRpYWxfcmVxdWVzdCB8fCB7fTtcblx0XHR0ZW1wbGF0ZV9wYWNrX2lkID0gY2F0YWxvZ19zdGF0ZSAmJiBjYXRhbG9nX3N0YXRlLnJlcXVlc3RfdmFsdWVzLnRlbXBsYXRlX3BhY2tcblx0XHRcdD8gY2F0YWxvZ19zdGF0ZS5yZXF1ZXN0X3ZhbHVlcy50ZW1wbGF0ZV9wYWNrXG5cdFx0XHQ6IGluaXRpYWxfcmVxdWVzdC50ZW1wbGF0ZV9wYWNrO1xuXHRcdHRlbXBsYXRlX3BhY2sgICAgPSBjb25maWcudGVtcGxhdGVfcGFja3MgJiYgY29uZmlnLnRlbXBsYXRlX3BhY2tzWyB0ZW1wbGF0ZV9wYWNrX2lkIF07XG5cblx0XHRpZiAoIHRlbXBsYXRlX3BhY2sgJiYgJ3N0cmluZycgPT09IHR5cGVvZiB0ZW1wbGF0ZV9wYWNrWyB0ZW1wbGF0ZV9yb2xlIF0gKSB7XG5cdFx0XHR0ZW1wbGF0ZV9pZCA9IHRlbXBsYXRlX3BhY2tbIHRlbXBsYXRlX3JvbGUgXTtcblx0XHR9XG5cblx0XHRyZXR1cm4gL15bYS16MC05Xy1dKyQvLnRlc3QoIHRlbXBsYXRlX2lkICkgPyB0ZW1wbGF0ZV9pZCA6ICcnO1xuXHR9XG5cblx0LyoqXG5cdCAqIFN5bmNocm9uaXplIG9uZSBzZXJ2ZXItYXV0aG9yaXRhdGl2ZSBhbGxvdy1saXN0ZWQgcHJlc2VudGF0aW9uIHBhY2suXG5cdCAqXG5cdCAqIFRoZSBhY3RpdmUgcGFjayBpcyBzaGFyZWQgcHJlc2VudGF0aW9uIHN0YXRlIG9ubHkuIFVwZGF0aW5nIGl0IGJlZm9yZSBhblxuXHQgKiBpdGVtcyB0ZW1wbGF0ZSBpcyByZXNvbHZlZCBhbGxvd3MgYW4gQUpBWCByZXNwb25zZSB0byBzd2l0Y2ggbWFya3VwIHdoaWxlXG5cdCAqIGxlYXZpbmcgdGhlIHByb3ZpZGVyLCBEVE8sIGF1dGhvcml6YXRpb24sIGFuZCBtdXRhdGlvbiBwYXRocyB1bmNoYW5nZWQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgICAgICAgICAgIFJlZ2lzdGVyZWQgYnJvd3NlciBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0geyp9ICAgICAgdGVtcGxhdGVfcGFja19pZCBDYW5kaWRhdGUgcGFjayBpZGVudGlmaWVyIGZyb20gYSByZXNwb25zZS5cblx0ICogQHJldHVybiB7c3RyaW5nfSBBY3RpdmUgYWxsb3ctbGlzdGVkIHBhY2sgaWRlbnRpZmllci5cblx0ICovXG5cdGZ1bmN0aW9uIHNldF9hY3RpdmVfdGVtcGxhdGVfcGFjayggY29uZmlnLCB0ZW1wbGF0ZV9wYWNrX2lkICkge1xuXHRcdHZhciBjYXRhbG9nX3Jvb3Q7XG5cdFx0dmFyIGNhdGFsb2dfc3RhdGUgPSBjb25maWcgJiYgY29uZmlnLmNhdGFsb2dfaWQgPyBnZXRfY2F0YWxvZ19zdGF0ZSggY29uZmlnLmNhdGFsb2dfaWQgKSA6IG51bGw7XG5cdFx0dmFyIG5vcm1hbGl6ZWRfcGFja19pZCA9ICdzdHJpbmcnID09PSB0eXBlb2YgdGVtcGxhdGVfcGFja19pZCA/IHRlbXBsYXRlX3BhY2tfaWQgOiAnJztcblxuXHRcdGlmICggISBjYXRhbG9nX3N0YXRlIHx8ICEgY29uZmlnLnRlbXBsYXRlX3BhY2tzIHx8ICEgY29uZmlnLnRlbXBsYXRlX3BhY2tzWyBub3JtYWxpemVkX3BhY2tfaWQgXSApIHtcblx0XHRcdG5vcm1hbGl6ZWRfcGFja19pZCA9IGNvbmZpZyAmJiBjb25maWcuZGVmYXVsdF90ZW1wbGF0ZV9wYWNrICYmIGNvbmZpZy50ZW1wbGF0ZV9wYWNrc1xuXHRcdFx0XHQmJiBjb25maWcudGVtcGxhdGVfcGFja3NbIGNvbmZpZy5kZWZhdWx0X3RlbXBsYXRlX3BhY2sgXVxuXHRcdFx0XHQ/IGNvbmZpZy5kZWZhdWx0X3RlbXBsYXRlX3BhY2tcblx0XHRcdFx0OiAnJztcblx0XHR9XG5cdFx0aWYgKCAhIG5vcm1hbGl6ZWRfcGFja19pZCApIHtcblx0XHRcdHJldHVybiAnJztcblx0XHR9XG5cblx0XHRjYXRhbG9nX3N0YXRlLnJlcXVlc3RfdmFsdWVzLnRlbXBsYXRlX3BhY2sgPSBub3JtYWxpemVkX3BhY2tfaWQ7XG5cdFx0Y2F0YWxvZ19yb290ID0gY2F0YWxvZ19zdGF0ZS5jb250ZW50X2VsZW1lbnRcblx0XHRcdD8gY2F0YWxvZ19zdGF0ZS5jb250ZW50X2VsZW1lbnQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtY2F0YWxvZy1pZF0nIClcblx0XHRcdDogbnVsbDtcblx0XHRpZiAoIGNhdGFsb2dfcm9vdCApIHtcblx0XHRcdGNhdGFsb2dfcm9vdC5zZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGVtcGxhdGUtcGFjaycsIG5vcm1hbGl6ZWRfcGFja19pZCApO1xuXHRcdH1cblxuXHRcdHJldHVybiBub3JtYWxpemVkX3BhY2tfaWQ7XG5cdH1cblxuXHQvKipcblx0ICogQ29tcGlsZSBvbmUgYWxsb3ctbGlzdGVkIFdvcmRQcmVzcyB0ZW1wbGF0ZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyAgICAgICAgUmVnaXN0ZXJlZCBicm93c2VyIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZW1wbGF0ZV9yb2xlIFRlbXBsYXRlIHJvbGUuXG5cdCAqIEByZXR1cm4ge0Z1bmN0aW9ufG51bGx9IENvbXBpbGVkIHRlbXBsYXRlIG9yIG51bGwuXG5cdCAqL1xuXHRmdW5jdGlvbiBsb2FkX3RlbXBsYXRlKCBjb25maWcsIHRlbXBsYXRlX3JvbGUgKSB7XG5cdFx0dmFyIHRlbXBsYXRlX2lkID0gZ2V0X3RlbXBsYXRlX2lkKCBjb25maWcsIHRlbXBsYXRlX3JvbGUgKTtcblxuXHRcdGlmICggISB0ZW1wbGF0ZV9pZCB8fCAhIHdpbmRvdy53cCB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93LndwLnRlbXBsYXRlICkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiB3aW5kb3cud3AudGVtcGxhdGUoIHRlbXBsYXRlX2lkICk7XG5cdFx0fSBjYXRjaCAoIGVycm9yICkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFJlcGxhY2Ugb25lIGNhdGFsb2cncyBjdXJyZW50IHByZXNlbnRhdGlvbiB3aXRoIHJlbmRlcmVkIHRlbXBsYXRlIG91dHB1dC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyAgICAgICAgUmVnaXN0ZXJlZCBicm93c2VyIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZW1wbGF0ZV9yb2xlIEFsbG93LWxpc3RlZCB0ZW1wbGF0ZSByb2xlLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gdGVtcGxhdGVfZGF0YSBOb3JtYWxpemVkIHRlbXBsYXRlIGRhdGEuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiByZW5kZXJlZC5cblx0ICovXG5cdGZ1bmN0aW9uIHJlbmRlcl90ZW1wbGF0ZSggY29uZmlnLCB0ZW1wbGF0ZV9yb2xlLCB0ZW1wbGF0ZV9kYXRhICkge1xuXHRcdHZhciBjYXRhbG9nX3Jvb3Q7XG5cdFx0dmFyIGNhdGFsb2dfc3RhdGUgPSBnZXRfY2F0YWxvZ19zdGF0ZSggY29uZmlnLmNhdGFsb2dfaWQgKTtcblx0XHR2YXIgcmVuZGVyX3RhcmdldDtcblx0XHR2YXIgcmVuZGVyZWRfaHRtbDtcblx0XHR2YXIgdGVtcGxhdGUgPSBsb2FkX3RlbXBsYXRlKCBjb25maWcsIHRlbXBsYXRlX3JvbGUgKTtcblxuXHRcdGlmICggISBjYXRhbG9nX3N0YXRlIHx8ICEgY2F0YWxvZ19zdGF0ZS5jb250ZW50X2VsZW1lbnQgfHwgISB0ZW1wbGF0ZSApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0cmVuZGVyZWRfaHRtbCA9IHRlbXBsYXRlKCB0ZW1wbGF0ZV9kYXRhIHx8IHt9ICk7XG5cdFx0fSBjYXRjaCAoIGVycm9yICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJlbmRlcl90YXJnZXQgPSBjYXRhbG9nX3N0YXRlLnJlc3BvbnNlX2VsZW1lbnQgfHwgY2F0YWxvZ19zdGF0ZS5jb250ZW50X2VsZW1lbnQ7XG5cdFx0ZGlzcGF0Y2hfY2F0YWxvZ19ldmVudCggY29uZmlnLCAnd3BiYzp1aS1jYXRhbG9nLWJlZm9yZS1yZW5kZXInLCB7XG5cdFx0XHRjYXRhbG9nX2lkOiBjb25maWcuY2F0YWxvZ19pZCxcblx0XHRcdHRlbXBsYXRlX3JvbGU6IHRlbXBsYXRlX3JvbGVcblx0XHR9ICk7XG5cdFx0cmVuZGVyX3RhcmdldC5pbm5lckhUTUwgPSByZW5kZXJlZF9odG1sO1xuXHRcdGNhdGFsb2dfcm9vdCA9IGNhdGFsb2dfc3RhdGUuY29udGVudF9lbGVtZW50LnBhcmVudE5vZGU7XG5cdFx0aWYgKCBjYXRhbG9nX3Jvb3QgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNhdGFsb2dfcm9vdC5zZXRBdHRyaWJ1dGUgKSB7XG5cdFx0XHRjYXRhbG9nX3Jvb3Quc2V0QXR0cmlidXRlKCAnYXJpYS1idXN5JywgJ3NoZWxsJyA9PT0gdGVtcGxhdGVfcm9sZSA/ICd0cnVlJyA6ICdmYWxzZScgKTtcblx0XHR9XG5cdFx0aWYgKCAnc2hlbGwnICE9PSB0ZW1wbGF0ZV9yb2xlICkge1xuXHRcdFx0c2V0X2NhdGFsb2dfbG9hZGluZ19zdGF0ZSggY29uZmlnLCBmYWxzZSApO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0LyoqXG5cdCAqIFRvZ2dsZSBhIHBlcnNpc3RlbnQgY2F0YWxvZyBvdmVybGF5IHdpdGhvdXQgcmVtb3ZpbmcgdGhlIGN1cnJlbnQgcm93cy5cblx0ICpcblx0ICogQ2F0YWxvZ3Mgd2l0aCBhIGRlZGljYXRlZCBvdmVybGF5IGtlZXAgdGhlaXIgZXhpc3RpbmcgdGFibGUgdmlzaWJsZSBiZW5lYXRoXG5cdCAqIHRoZSBCb29raW5nIENhbGVuZGFyIHNwaW5uZXIuIEdlbmVyaWMgY2F0YWxvZ3MgcmV0YWluIHRoZSBzaGVsbC10ZW1wbGF0ZVxuXHQgKiBmYWxsYmFjayB3aGVuIG5vIG92ZXJsYXkgaXMgZGVjbGFyZWQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgY29uZmlnICAgICBSZWdpc3RlcmVkIGJyb3dzZXIgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtib29sZWFufSBpc19sb2FkaW5nIFdoZXRoZXIgYSByZXF1ZXN0IGlzIGFjdGl2ZS5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGEgcGVyc2lzdGVudCBvdmVybGF5IHdhcyB1cGRhdGVkLlxuXHQgKi9cblx0ZnVuY3Rpb24gc2V0X2NhdGFsb2dfbG9hZGluZ19zdGF0ZSggY29uZmlnLCBpc19sb2FkaW5nICkge1xuXHRcdHZhciBjYXRhbG9nX3N0YXRlID0gY29uZmlnICYmIGNvbmZpZy5jYXRhbG9nX2lkID8gZ2V0X2NhdGFsb2dfc3RhdGUoIGNvbmZpZy5jYXRhbG9nX2lkICkgOiBudWxsO1xuXHRcdHZhciBsb2FkaW5nX2VsZW1lbnQgPSBjYXRhbG9nX3N0YXRlID8gY2F0YWxvZ19zdGF0ZS5sb2FkaW5nX2VsZW1lbnQgOiBudWxsO1xuXG5cdFx0aWYgKCBjYXRhbG9nX3N0YXRlICYmIGNhdGFsb2dfc3RhdGUuY29udGVudF9lbGVtZW50ICkge1xuXHRcdFx0Y2F0YWxvZ19zdGF0ZS5jb250ZW50X2VsZW1lbnQuc2V0QXR0cmlidXRlKCAnYXJpYS1idXN5JywgaXNfbG9hZGluZyA/ICd0cnVlJyA6ICdmYWxzZScgKTtcblx0XHR9XG5cdFx0aWYgKCAhIGxvYWRpbmdfZWxlbWVudCApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRsb2FkaW5nX2VsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLXZpc2libGUnLCAhISBpc19sb2FkaW5nICk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHQvKipcblx0ICogU2V0IHRoZSB0YWJsZSBtaW5pbXVtIHdpZHRoIGZyb20gY3VycmVudGx5IHZpc2libGUgaGVhZGVyIGNvbnRyYWN0cy5cblx0ICpcblx0ICogRG9tYWluIHN0eWxlcyBkZWNsYXJlIGAtLXdwYmMtbGlzdGluZy1jb2x1bW4tbWluLXdpZHRoYCBwZXIgY29sdW1uLiBUaGVcblx0ICogc2hhcmVkIGNvbnRyb2xsZXIgc3VtcyBvbmx5IHJlbmRlcmVkIGhlYWRlcnMgc28gd2lkZS9jdXN0b20gdmlld3Mgc2Nyb2xsXG5cdCAqIGhvcml6b250YWxseSB3aGlsZSBzaG9ydCBwcmVzZXRzIGNvbnRpbnVlIGZpbGxpbmcgdGhlIGF2YWlsYWJsZSBwYW5lbC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBSZWdpc3RlcmVkIGJyb3dzZXIgY29uZmlndXJhdGlvbi5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHN5bmNfY2F0YWxvZ190YWJsZV9taW5fd2lkdGgoIGNvbmZpZyApIHtcblx0XHR2YXIgbW91bnRfZWxlbWVudCA9IGNvbmZpZyAmJiBjb25maWcubW91bnRfaWQgPyBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggY29uZmlnLm1vdW50X2lkICkgOiBudWxsO1xuXHRcdHZhciB0YWJsZSA9IG1vdW50X2VsZW1lbnQgPyBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICcud3BiY191aV9saXN0aW5nX190YWJsZS0tY2F0YWxvZycgKSA6IG51bGw7XG5cdFx0dmFyIGhlYWRlcl9jZWxscztcblx0XHR2YXIgdGFibGVfbWluX3dpZHRoID0gMDtcblxuXHRcdGlmICggISB0YWJsZSB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93LmdldENvbXB1dGVkU3R5bGUgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGhlYWRlcl9jZWxscyA9IEFycmF5LnByb3RvdHlwZS5maWx0ZXIuY2FsbCggdGFibGUucXVlcnlTZWxlY3RvckFsbCggJ3RoZWFkID4gdHIgPiB0aCcgKSwgZnVuY3Rpb24gKCBoZWFkZXJfY2VsbCApIHtcblx0XHRcdHJldHVybiAhIGhlYWRlcl9jZWxsLmhpZGRlbjtcblx0XHR9ICk7XG5cdFx0aGVhZGVyX2NlbGxzLmZvckVhY2goIGZ1bmN0aW9uICggaGVhZGVyX2NlbGwgKSB7XG5cdFx0XHR2YXIgY29sdW1uX21pbl93aWR0aCA9IHBhcnNlRmxvYXQoXG5cdFx0XHRcdHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKCBoZWFkZXJfY2VsbCApLmdldFByb3BlcnR5VmFsdWUoICctLXdwYmMtbGlzdGluZy1jb2x1bW4tbWluLXdpZHRoJyApXG5cdFx0XHQpO1xuXHRcdFx0aWYgKCBpc0Zpbml0ZSggY29sdW1uX21pbl93aWR0aCApICYmIDAgPCBjb2x1bW5fbWluX3dpZHRoICkge1xuXHRcdFx0XHR0YWJsZV9taW5fd2lkdGggKz0gY29sdW1uX21pbl93aWR0aDtcblx0XHRcdH1cblx0XHR9ICk7XG5cdFx0aWYgKCAwIDwgdGFibGVfbWluX3dpZHRoICkge1xuXHRcdFx0dGFibGUuc3R5bGUuc2V0UHJvcGVydHkoICctLXdwYmMtbGlzdGluZy10YWJsZS1taW4td2lkdGgnLCBNYXRoLmNlaWwoIHRhYmxlX21pbl93aWR0aCApICsgJ3B4JyApO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBLZWVwIHRoZSBvcGVuIGNvbHVtbiBjdXN0b21pemVyIGluc2lkZSB0aGUgdXNhYmxlIGJyb3dzZXIgdmlld3BvcnQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTERldGFpbHNFbGVtZW50fSBjdXN0b21pemVyIENvbHVtbiBjdXN0b21pemVyIGRldGFpbHMgZWxlbWVudC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHBvc2l0aW9uX2Rpc3BsYXlfcGFuZWwoIGN1c3RvbWl6ZXIgKSB7XG5cdFx0dmFyIHBhbmVsID0gY3VzdG9taXplciA/IGN1c3RvbWl6ZXIucXVlcnlTZWxlY3RvciggJy53cGJjX3VpX2xpc3RpbmdfX2Rpc3BsYXlfcGFuZWwnICkgOiBudWxsO1xuXHRcdHZhciBzdW1tYXJ5ID0gY3VzdG9taXplciA/IGN1c3RvbWl6ZXIucXVlcnlTZWxlY3RvciggJ3N1bW1hcnknICkgOiBudWxsO1xuXHRcdHZhciBmaWVsZF9saXN0ID0gY3VzdG9taXplciA/IGN1c3RvbWl6ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1jb2x1bW4tbGlzdF0nICkgOiBudWxsO1xuXHRcdHZhciBzdW1tYXJ5X3JlY3Q7XG5cdFx0dmFyIHBhbmVsX3JlY3Q7XG5cdFx0dmFyIHZpZXdwb3J0X3dpZHRoO1xuXHRcdHZhciB2aWV3cG9ydF9oZWlnaHQ7XG5cdFx0dmFyIG1hcmdpbiA9IDEyO1xuXHRcdHZhciBnYXAgPSA2O1xuXHRcdHZhciBzcGFjZV9hYm92ZTtcblx0XHR2YXIgc3BhY2VfYmVsb3c7XG5cdFx0dmFyIG5hdHVyYWxfaGVpZ2h0O1xuXHRcdHZhciBvcGVuX2Fib3ZlO1xuXHRcdHZhciBhdmFpbGFibGVfaGVpZ2h0O1xuXHRcdHZhciByZW5kZXJlZF9oZWlnaHQ7XG5cdFx0dmFyIHBhbmVsX2xlZnQ7XG5cdFx0dmFyIHBhbmVsX3RvcDtcblxuXHRcdGlmICggISBjdXN0b21pemVyIHx8ICEgY3VzdG9taXplci5vcGVuIHx8ICEgcGFuZWwgfHwgISBzdW1tYXJ5ICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGN1c3RvbWl6ZXIuY2xhc3NMaXN0LnJlbW92ZSggJ2lzLXBvc2l0aW9uZWQnICk7XG5cdFx0cGFuZWwuc3R5bGUucmVtb3ZlUHJvcGVydHkoICctLXdwYmMtbGlzdGluZy1kaXNwbGF5LXBhbmVsLW1heC1oZWlnaHQnICk7XG5cdFx0cGFuZWwuc3R5bGUucmVtb3ZlUHJvcGVydHkoICdsZWZ0JyApO1xuXHRcdHBhbmVsLnN0eWxlLnJlbW92ZVByb3BlcnR5KCAndG9wJyApO1xuXHRcdHN1bW1hcnlfcmVjdCA9IHN1bW1hcnkuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0cGFuZWxfcmVjdCA9IHBhbmVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdHZpZXdwb3J0X3dpZHRoID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudFdpZHRoIHx8IHdpbmRvdy5pbm5lcldpZHRoIHx8IDA7XG5cdFx0dmlld3BvcnRfaGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0IHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRIZWlnaHQgfHwgMDtcblx0XHRzcGFjZV9hYm92ZSA9IE1hdGgubWF4KCAwLCBzdW1tYXJ5X3JlY3QudG9wIC0gbWFyZ2luIC0gZ2FwICk7XG5cdFx0c3BhY2VfYmVsb3cgPSBNYXRoLm1heCggMCwgdmlld3BvcnRfaGVpZ2h0IC0gc3VtbWFyeV9yZWN0LmJvdHRvbSAtIG1hcmdpbiAtIGdhcCApO1xuXHRcdG5hdHVyYWxfaGVpZ2h0ID0gcGFuZWwuc2Nyb2xsSGVpZ2h0O1xuXHRcdGlmICggZmllbGRfbGlzdCApIHtcblx0XHRcdG5hdHVyYWxfaGVpZ2h0ICs9IE1hdGgubWF4KCAwLCBmaWVsZF9saXN0LnNjcm9sbEhlaWdodCAtIGZpZWxkX2xpc3QuY2xpZW50SGVpZ2h0ICk7XG5cdFx0fVxuXHRcdG9wZW5fYWJvdmUgPSBzcGFjZV9iZWxvdyA8IG5hdHVyYWxfaGVpZ2h0ICYmIHNwYWNlX2Fib3ZlID4gc3BhY2VfYmVsb3c7XG5cdFx0YXZhaWxhYmxlX2hlaWdodCA9IG9wZW5fYWJvdmUgPyBzcGFjZV9hYm92ZSA6IHNwYWNlX2JlbG93O1xuXHRcdGN1c3RvbWl6ZXIuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLW9wZW4tYWJvdmUnLCBvcGVuX2Fib3ZlICk7XG5cdFx0cGFuZWwuc3R5bGUuc2V0UHJvcGVydHkoICctLXdwYmMtbGlzdGluZy1kaXNwbGF5LXBhbmVsLW1heC1oZWlnaHQnLCBNYXRoLmZsb29yKCBhdmFpbGFibGVfaGVpZ2h0ICkgKyAncHgnICk7XG5cdFx0cmVuZGVyZWRfaGVpZ2h0ID0gcGFuZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuaGVpZ2h0O1xuXHRcdHBhbmVsX2xlZnQgPSBNYXRoLm1heCggbWFyZ2luLCBNYXRoLm1pbiggc3VtbWFyeV9yZWN0LnJpZ2h0IC0gcGFuZWxfcmVjdC53aWR0aCwgdmlld3BvcnRfd2lkdGggLSBwYW5lbF9yZWN0LndpZHRoIC0gbWFyZ2luICkgKTtcblx0XHRwYW5lbF90b3AgPSBvcGVuX2Fib3ZlID8gc3VtbWFyeV9yZWN0LnRvcCAtIGdhcCAtIHJlbmRlcmVkX2hlaWdodCA6IHN1bW1hcnlfcmVjdC5ib3R0b20gKyBnYXA7XG5cdFx0cGFuZWxfdG9wID0gTWF0aC5tYXgoIG1hcmdpbiwgTWF0aC5taW4oIHBhbmVsX3RvcCwgdmlld3BvcnRfaGVpZ2h0IC0gcmVuZGVyZWRfaGVpZ2h0IC0gbWFyZ2luICkgKTtcblx0XHRwYW5lbC5zdHlsZS5zZXRQcm9wZXJ0eSggJ2xlZnQnLCBNYXRoLnJvdW5kKCBwYW5lbF9sZWZ0ICkgKyAncHgnICk7XG5cdFx0cGFuZWwuc3R5bGUuc2V0UHJvcGVydHkoICd0b3AnLCBNYXRoLnJvdW5kKCBwYW5lbF90b3AgKSArICdweCcgKTtcblx0XHRjdXN0b21pemVyLmNsYXNzTGlzdC5hZGQoICdpcy1wb3NpdGlvbmVkJyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIENsZWFyIGZpeGVkIGNvbHVtbi1wYW5lbCBjb29yZGluYXRlcyBhZnRlciB0aGUgY3VzdG9taXplciBjbG9zZXMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTERldGFpbHNFbGVtZW50fSBjdXN0b21pemVyIENvbHVtbiBjdXN0b21pemVyIGRldGFpbHMgZWxlbWVudC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHJlc2V0X2Rpc3BsYXlfcGFuZWxfcG9zaXRpb24oIGN1c3RvbWl6ZXIgKSB7XG5cdFx0dmFyIHBhbmVsID0gY3VzdG9taXplciA/IGN1c3RvbWl6ZXIucXVlcnlTZWxlY3RvciggJy53cGJjX3VpX2xpc3RpbmdfX2Rpc3BsYXlfcGFuZWwnICkgOiBudWxsO1xuXG5cdFx0aWYgKCAhIGN1c3RvbWl6ZXIgfHwgISBwYW5lbCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y3VzdG9taXplci5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtb3Blbi1hYm92ZScsICdpcy1wb3NpdGlvbmVkJyApO1xuXHRcdHBhbmVsLnN0eWxlLnJlbW92ZVByb3BlcnR5KCAnLS13cGJjLWxpc3RpbmctZGlzcGxheS1wYW5lbC1tYXgtaGVpZ2h0JyApO1xuXHRcdHBhbmVsLnN0eWxlLnJlbW92ZVByb3BlcnR5KCAnbGVmdCcgKTtcblx0XHRwYW5lbC5zdHlsZS5yZW1vdmVQcm9wZXJ0eSggJ3RvcCcgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDbG9zZSBvbmUgY29sdW1uIGN1c3RvbWl6ZXIgYW5kIG9wdGlvbmFsbHkgcmV0dXJuIGZvY3VzIHRvIGl0cyBzdW1tYXJ5LlxuXHQgKlxuXHQgKiBLZXlib2FyZCBhbmQgZXhwbGljaXQgQ2xvc2UtYnV0dG9uIGRpc21pc3NhbCByZXN0b3JlIGZvY3VzIHRvIHRoZSBjb250cm9sXG5cdCAqIHRoYXQgb3BlbmVkIHRoZSBwYW5lbC4gUG9pbnRlciBkaXNtaXNzYWwga2VlcHMgdGhlIHBvaW50ZXIncyBuYXR1cmFsIGZvY3VzXG5cdCAqIGRlc3RpbmF0aW9uIHdoaWxlIHNoYXJpbmcgdGhlIHNhbWUgZGV0YWlscy10b2dnbGUgY2xlYW51cCBwYXRoLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxEZXRhaWxzRWxlbWVudHxudWxsfSBjdXN0b21pemVyICAgIENvbHVtbiBjdXN0b21pemVyIGRldGFpbHMgZWxlbWVudC5cblx0ICogQHBhcmFtIHtib29sZWFufSAgICAgICAgICAgICAgICAgcmVzdG9yZV9mb2N1cyBXaGV0aGVyIHN1bW1hcnkgZm9jdXMgaXMgcmVzdG9yZWQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBjbG9zZV9kaXNwbGF5X2N1c3RvbWl6ZXIoIGN1c3RvbWl6ZXIsIHJlc3RvcmVfZm9jdXMgKSB7XG5cdFx0dmFyIHN1bW1hcnk7XG5cblx0XHRpZiAoICEgY3VzdG9taXplciB8fCAhIGN1c3RvbWl6ZXIub3BlbiApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y3VzdG9taXplci5vcGVuID0gZmFsc2U7XG5cdFx0aWYgKCAhIHJlc3RvcmVfZm9jdXMgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHN1bW1hcnkgPSBjdXN0b21pemVyLnF1ZXJ5U2VsZWN0b3IoICdzdW1tYXJ5JyApO1xuXHRcdGlmICggc3VtbWFyeSAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygc3VtbWFyeS5mb2N1cyApIHtcblx0XHRcdHN1bW1hcnkuZm9jdXMoKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogUmVuZGVyIGEgZ2VuZXJpYyBzYWZlIGJyb3dzZXIgZXJyb3IuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgIFJlZ2lzdGVyZWQgYnJvd3NlciBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSBTYWZlIGxvY2FsaXplZCBlcnJvciBtZXNzYWdlLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gcmVuZGVyZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiByZW5kZXJfZXJyb3IoIGNvbmZpZywgbWVzc2FnZSApIHtcblx0XHR2YXIgaTE4biA9IGNvbmZpZy5pMThuIHx8IHt9O1xuXG5cdFx0cmV0dXJuIHJlbmRlcl90ZW1wbGF0ZSggY29uZmlnLCAnZXJyb3InLCB7XG5cdFx0XHR0aXRsZTogaTE4bi5lcnJvcl90aXRsZSB8fCAnJyxcblx0XHRcdG1lc3NhZ2U6IG1lc3NhZ2UgfHwgaTE4bi5lcnJvcl9tZXNzYWdlIHx8ICcnXG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIERpc3BhdGNoIG9uZSBzaGFyZWQgY2F0YWxvZyBsaWZlY3ljbGUgZXZlbnQgZnJvbSB0aGUgY3VycmVudCBtb3VudC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyAgICAgUmVnaXN0ZXJlZCBicm93c2VyIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBldmVudF9uYW1lIFN0YWJsZSBzaGFyZWQgZXZlbnQgbmFtZS5cblx0ICogQHBhcmFtIHtPYmplY3R9IGRldGFpbCAgICAgSlNPTi1zYWZlIGV2ZW50IGRldGFpbC5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBldmVudCB3YXMgZGlzcGF0Y2hlZC5cblx0ICovXG5cdGZ1bmN0aW9uIGRpc3BhdGNoX2NhdGFsb2dfZXZlbnQoIGNvbmZpZywgZXZlbnRfbmFtZSwgZGV0YWlsICkge1xuXHRcdHZhciBjYXRhbG9nX2V2ZW50O1xuXHRcdHZhciBjYXRhbG9nX3N0YXRlID0gZ2V0X2NhdGFsb2dfc3RhdGUoIGNvbmZpZy5jYXRhbG9nX2lkICk7XG5cblx0XHRpZiAoICEgY2F0YWxvZ19zdGF0ZSB8fCAhIGNhdGFsb2dfc3RhdGUuY29udGVudF9lbGVtZW50IHx8ICdzdHJpbmcnICE9PSB0eXBlb2YgZXZlbnRfbmFtZSApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cuQ3VzdG9tRXZlbnQgKSB7XG5cdFx0XHRjYXRhbG9nX2V2ZW50ID0gbmV3IHdpbmRvdy5DdXN0b21FdmVudCggZXZlbnRfbmFtZSwge1xuXHRcdFx0XHRidWJibGVzOiB0cnVlLFxuXHRcdFx0XHRkZXRhaWw6IGRldGFpbCB8fCB7fVxuXHRcdFx0fSApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjYXRhbG9nX2V2ZW50ID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoICdDdXN0b21FdmVudCcgKTtcblx0XHRcdGNhdGFsb2dfZXZlbnQuaW5pdEN1c3RvbUV2ZW50KCBldmVudF9uYW1lLCB0cnVlLCBmYWxzZSwgZGV0YWlsIHx8IHt9ICk7XG5cdFx0fVxuXG5cdFx0Y2F0YWxvZ19zdGF0ZS5jb250ZW50X2VsZW1lbnQuZGlzcGF0Y2hFdmVudCggY2F0YWxvZ19ldmVudCApO1xuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHQvKipcblx0ICogQXBwZW5kIG9uZSBub3JtYWxpemVkIHJlcXVlc3QgdmFsdWUgdG8gYSBVUkwtZW5jb2RlZCBBSkFYIGJvZHkuXG5cdCAqXG5cdCAqIEBwYXJhbSB7VVJMU2VhcmNoUGFyYW1zfSByZXF1ZXN0X2JvZHkgIFJlcXVlc3QgYm9keSByZWNlaXZpbmcgdmFsdWVzLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgcmVxdWVzdF9rZXkgICBOb3JtYWxpemVkIHJlcXVlc3Qga2V5LlxuXHQgKiBAcGFyYW0geyp9ICAgICAgICAgICAgICAgcmVxdWVzdF92YWx1ZSBTY2FsYXIgb3Igc2NhbGFyLWFycmF5IHZhbHVlLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gYXBwZW5kX3JlcXVlc3RfdmFsdWUoIHJlcXVlc3RfYm9keSwgcmVxdWVzdF9rZXksIHJlcXVlc3RfdmFsdWUgKSB7XG5cdFx0aWYgKCBBcnJheS5pc0FycmF5KCByZXF1ZXN0X3ZhbHVlICkgKSB7XG5cdFx0XHRyZXF1ZXN0X3ZhbHVlLmZvckVhY2goIGZ1bmN0aW9uICggYXJyYXlfdmFsdWUgKSB7XG5cdFx0XHRcdGlmICggbnVsbCAhPT0gYXJyYXlfdmFsdWUgJiYgJ29iamVjdCcgIT09IHR5cGVvZiBhcnJheV92YWx1ZSApIHtcblx0XHRcdFx0XHRyZXF1ZXN0X2JvZHkuYXBwZW5kKCByZXF1ZXN0X2tleSArICdbXScsIFN0cmluZyggYXJyYXlfdmFsdWUgKSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCBudWxsICE9PSByZXF1ZXN0X3ZhbHVlICYmICd1bmRlZmluZWQnICE9PSB0eXBlb2YgcmVxdWVzdF92YWx1ZSAmJiAnb2JqZWN0JyAhPT0gdHlwZW9mIHJlcXVlc3RfdmFsdWUgKSB7XG5cdFx0XHRyZXF1ZXN0X2JvZHkuYXBwZW5kKCByZXF1ZXN0X2tleSwgU3RyaW5nKCByZXF1ZXN0X3ZhbHVlICkgKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIG9yZGVyZWQgY29sdW1uIElEcyBmcm9tIHRoZSBjdXJyZW50IGRpc3BsYXkgY29udHJvbHMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IG1vdW50X2VsZW1lbnQgQ2F0YWxvZyBtb3VudCBlbGVtZW50LlxuXHQgKiBAcmV0dXJuIHtzdHJpbmdbXX0gQ3VycmVudCBjb2x1bW4gb3JkZXIuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfY29sdW1uX29yZGVyKCBtb3VudF9lbGVtZW50ICkge1xuXHRcdHJldHVybiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCggbW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWNvbHVtbi1pdGVtXScgKSApLm1hcCggZnVuY3Rpb24gKCBjb2x1bW5faXRlbSApIHtcblx0XHRcdHJldHVybiBjb2x1bW5faXRlbS5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdWktY2F0YWxvZy1jb2x1bW4taXRlbScgKSB8fCAnJztcblx0XHR9ICkuZmlsdGVyKCBmdW5jdGlvbiAoIGNvbHVtbl9pZCApIHtcblx0XHRcdHJldHVybiAhISBjb2x1bW5faWQ7XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiB2aXNpYmxlIGNvbHVtbiBJRHMgZnJvbSB0aGUgY3VycmVudCBkaXNwbGF5IGNvbnRyb2xzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBtb3VudF9lbGVtZW50IENhdGFsb2cgbW91bnQgZWxlbWVudC5cblx0ICogQHJldHVybiB7c3RyaW5nW119IEN1cnJlbnQgdmlzaWJsZSBjb2x1bW5zLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X3Zpc2libGVfY29sdW1ucyggbW91bnRfZWxlbWVudCApIHtcblx0XHRyZXR1cm4gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoIG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1jb2x1bW4tdmlzaWJsZV0nICkgKS5maWx0ZXIoIGZ1bmN0aW9uICggY29sdW1uX2NvbnRyb2wgKSB7XG5cdFx0XHRyZXR1cm4gY29sdW1uX2NvbnRyb2wuY2hlY2tlZDtcblx0XHR9ICkubWFwKCBmdW5jdGlvbiAoIGNvbHVtbl9jb250cm9sICkge1xuXHRcdFx0cmV0dXJuIGNvbHVtbl9jb250cm9sLnZhbHVlO1xuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXF1ZXN0IHRoZSBjdXJyZW50IGNvbHVtbiBjb250cm9scyBhbmQgcGVyc2lzdCB0aGUgdmFsaWRhdGVkIHJlc3VsdC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgY29uZmlnICAgICAgICBSZWdpc3RlcmVkIGJyb3dzZXIgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbW91bnRfZWxlbWVudCBDYXRhbG9nIG1vdW50IGVsZW1lbnQuXG5cdCAqIEByZXR1cm4ge1Byb21pc2U8Ym9vbGVhbj59IFNoYXJlZCByZXF1ZXN0IHJlc3VsdC5cblx0ICovXG5cdGZ1bmN0aW9uIHNhdmVfY29sdW1uX2NvbnRyb2xzKCBjb25maWcsIG1vdW50X2VsZW1lbnQgKSB7XG5cdFx0dmFyIHZpZXdfY29udHJvbCA9IG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy12aWV3XScgKTtcblxuXHRcdGlmICggdmlld19jb250cm9sICkge1xuXHRcdFx0dmlld19jb250cm9sLnZhbHVlID0gJ2N1c3RvbSc7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlcXVlc3RfY2F0YWxvZyggY29uZmlnLCB7XG5cdFx0XHRjb2x1bW5fb3JkZXI6IGdldF9jb2x1bW5fb3JkZXIoIG1vdW50X2VsZW1lbnQgKSxcblx0XHRcdHBhZ2VfbnVtYmVyOiAxLFxuXHRcdFx0cHJlZmVyZW5jZV9hY3Rpb246ICdzYXZlJyxcblx0XHRcdHZpc2libGVfY29sdW1uczogZ2V0X3Zpc2libGVfY29sdW1ucyggbW91bnRfZWxlbWVudCApXG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFubm91bmNlIGEgY29tcGxldGVkIGNvbHVtbi1vcmRlciBjaGFuZ2UgdG8gYXNzaXN0aXZlIHRlY2hub2xvZ3kuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGNvbmZpZyAgICAgICAgUmVnaXN0ZXJlZCBicm93c2VyIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IG1vdW50X2VsZW1lbnQgQ2F0YWxvZyBtb3VudCBlbGVtZW50LlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gYW5ub3VuY2VfY29sdW1uX21vdmVkKCBjb25maWcsIG1vdW50X2VsZW1lbnQgKSB7XG5cdFx0dmFyIHN0YXR1c19lbGVtZW50ID0gbW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWNvbHVtbi1zdGF0dXNdJyApO1xuXG5cdFx0aWYgKCAhIHN0YXR1c19lbGVtZW50ICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRzdGF0dXNfZWxlbWVudC50ZXh0Q29udGVudCA9ICcnO1xuXHRcdHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRzdGF0dXNfZWxlbWVudC50ZXh0Q29udGVudCA9IGNvbmZpZy5pMThuICYmIGNvbmZpZy5pMThuLmNvbHVtbl9tb3ZlZCA/IGNvbmZpZy5pMThuLmNvbHVtbl9tb3ZlZCA6ICcnO1xuXHRcdH0sIDAgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTeW5jaHJvbml6ZSB0aGUgY3VycmVudCBjYXRhbG9nIHN0YXRlIGludG8gdGhlIGluaXRpYWwgVVJMIGFsaWFzZXMuXG5cdCAqXG5cdCAqIFNlYXJjaCBhbmQgcGFnZSBudW1iZXIgcmVtYWluIHJlcXVlc3QtbG9jYWwgYnV0IHN1cnZpdmUgYSBub3JtYWwgcmVmcmVzaFxuXHQgKiB0aHJvdWdoIHRoZSBVUkwuIFBlcnNpc3RlZCBzZXR0aW5ncyBhcmUgYWxzbyByZWZsZWN0ZWQgZm9yIHNoYXJlYWJsZSBzdGF0ZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyAgIFJlZ2lzdGVyZWQgYnJvd3NlciBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gcmVzcG9uc2UgTm9ybWFsaXplZCBzdWNjZXNzZnVsIHJlc3BvbnNlLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gdXBkYXRlX3VybF9zdGF0ZSggY29uZmlnLCByZXNwb25zZSApIHtcblx0XHR2YXIgZmlsdGVycyA9IHJlc3BvbnNlLmZpbHRlcnMgfHwge307XG5cdFx0dmFyIHBhcmFtZXRlcnMgPSBjb25maWcudXJsX3BhcmFtZXRlcnMgfHwge307XG5cdFx0dmFyIHN0YXRlX3ZhbHVlcyA9IHtcblx0XHRcdHBhZ2VfbnVtYmVyOiByZXNwb25zZS5wYWdpbmF0aW9uLnBhZ2VfbnVtYmVyLFxuXHRcdFx0aXRlbXNfcGVyX3BhZ2U6IHJlc3BvbnNlLnBhZ2luYXRpb24uaXRlbXNfcGVyX3BhZ2UsXG5cdFx0XHRzb3J0X2J5OiByZXNwb25zZS5zb3J0aW5nLnNvcnRfYnksXG5cdFx0XHRzb3J0X29yZGVyOiByZXNwb25zZS5zb3J0aW5nLnNvcnRfb3JkZXIsXG5cdFx0XHRzZWFyY2g6IGZpbHRlcnMuc2VhcmNoIHx8ICcnLFxuXHRcdFx0dmlzaWJsZV9jb2x1bW5zOiByZXNwb25zZS5kaXNwbGF5LnZpc2libGVfY29sdW1ucyB8fCBbXSxcblx0XHRcdGNvbHVtbl9vcmRlcjogcmVzcG9uc2UuZGlzcGxheS5jb2x1bW5fb3JkZXIgfHwgW10sXG5cdFx0XHR0ZW1wbGF0ZV9wYWNrOiByZXNwb25zZS5kaXNwbGF5LnRlbXBsYXRlX3BhY2sgfHwgJydcblx0XHR9O1xuXHRcdHZhciBwYWdlX3VybDtcblxuXHRcdGlmICggISB3aW5kb3cuaGlzdG9yeSB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93Lmhpc3RvcnkucmVwbGFjZVN0YXRlIHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiB3aW5kb3cuVVJMICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHBhZ2VfdXJsID0gbmV3IHdpbmRvdy5VUkwoIHdpbmRvdy5sb2NhdGlvbi5ocmVmICk7XG5cdFx0T2JqZWN0LmtleXMoIGZpbHRlcnMgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGZpbHRlcl9rZXkgKSB7XG5cdFx0XHRzdGF0ZV92YWx1ZXNbIGZpbHRlcl9rZXkgXSA9IGZpbHRlcnNbIGZpbHRlcl9rZXkgXTtcblx0XHR9ICk7XG5cdFx0T2JqZWN0LmtleXMoIHBhcmFtZXRlcnMgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHN0YXRlX2tleSApIHtcblx0XHRcdHZhciBwYXJhbWV0ZXJfbmFtZSA9IHBhcmFtZXRlcnNbIHN0YXRlX2tleSBdO1xuXHRcdFx0dmFyIHN0YXRlX3ZhbHVlID0gc3RhdGVfdmFsdWVzWyBzdGF0ZV9rZXkgXTtcblx0XHRcdGlmICggISBwYXJhbWV0ZXJfbmFtZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBBcnJheS5pc0FycmF5KCBzdGF0ZV92YWx1ZSApICkge1xuXHRcdFx0XHRzdGF0ZV92YWx1ZSA9IHN0YXRlX3ZhbHVlLmpvaW4oICcsJyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAnJyA9PT0gc3RhdGVfdmFsdWUgfHwgbnVsbCA9PT0gc3RhdGVfdmFsdWUgfHwgJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiBzdGF0ZV92YWx1ZSApIHtcblx0XHRcdFx0cGFnZV91cmwuc2VhcmNoUGFyYW1zLmRlbGV0ZSggcGFyYW1ldGVyX25hbWUgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHBhZ2VfdXJsLnNlYXJjaFBhcmFtcy5zZXQoIHBhcmFtZXRlcl9uYW1lLCBTdHJpbmcoIHN0YXRlX3ZhbHVlICkgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdFx0d2luZG93Lmhpc3RvcnkucmVwbGFjZVN0YXRlKCB7fSwgZG9jdW1lbnQudGl0bGUsIHBhZ2VfdXJsLnRvU3RyaW5nKCkgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBCaW5kIGRvbWFpbi1uZXV0cmFsIGRlbGVnYXRlZCBjYXRhbG9nIGNvbnRyb2xzIG9uY2UgcGVyIG1vdW50LlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBjb25maWcgICAgICAgIFJlZ2lzdGVyZWQgYnJvd3NlciBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBtb3VudF9lbGVtZW50IENhdGFsb2cgbW91bnQgZWxlbWVudC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGJpbmRfY2F0YWxvZ19jb250cm9scyggY29uZmlnLCBtb3VudF9lbGVtZW50ICkge1xuXHRcdHZhciBjYXRhbG9nX3N0YXRlID0gZ2V0X2NhdGFsb2dfc3RhdGUoIGNvbmZpZy5jYXRhbG9nX2lkICk7XG5cblx0XHRpZiAoICEgY2F0YWxvZ19zdGF0ZSB8fCBtb3VudF9lbGVtZW50Ll93cGJjX3VpX2NhdGFsb2dfY29udHJvbHNfYm91bmQgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdG1vdW50X2VsZW1lbnQuX3dwYmNfdWlfY2F0YWxvZ19jb250cm9sc19ib3VuZCA9IHRydWU7XG5cblx0XHRtb3VudF9lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdzdWJtaXQnLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0dmFyIHNlYXJjaF9jb250cm9sO1xuXHRcdFx0aWYgKCAhIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWZpbHRlcnNdJyApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0c2VhcmNoX2NvbnRyb2wgPSBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctc2VhcmNoXScgKTtcblx0XHRcdHJlcXVlc3RfY2F0YWxvZyggY29uZmlnLCB7IHBhZ2VfbnVtYmVyOiAxLCBzZWFyY2g6IHNlYXJjaF9jb250cm9sID8gc2VhcmNoX2NvbnRyb2wudmFsdWUgOiAnJyB9ICk7XG5cdFx0fSApO1xuXG5cdFx0bW91bnRfZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAnaW5wdXQnLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0dmFyIGNsZWFyX2NvbnRyb2w7XG5cdFx0XHRpZiAoICEgZXZlbnQudGFyZ2V0Lm1hdGNoZXMoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctc2VhcmNoXScgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y2xlYXJfY29udHJvbCA9IG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1zZWFyY2gtY2xlYXJdJyApO1xuXHRcdFx0aWYgKCBjbGVhcl9jb250cm9sICkge1xuXHRcdFx0XHRjbGVhcl9jb250cm9sLmhpZGRlbiA9ICEgZXZlbnQudGFyZ2V0LnZhbHVlO1xuXHRcdFx0fVxuXHRcdFx0d2luZG93LmNsZWFyVGltZW91dCggY2F0YWxvZ19zdGF0ZS5zZWFyY2hfdGltZXIgKTtcblx0XHRcdGNhdGFsb2dfc3RhdGUuc2VhcmNoX3RpbWVyID0gd2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmVxdWVzdF9jYXRhbG9nKCBjb25maWcsIHsgcGFnZV9udW1iZXI6IDEsIHNlYXJjaDogZXZlbnQudGFyZ2V0LnZhbHVlIHx8ICcnIH0gKTtcblx0XHRcdH0sIGdldF9zZWFyY2hfZGVib3VuY2VfZGVsYXkoIGNvbmZpZyApICk7XG5cdFx0fSApO1xuXG5cdFx0bW91bnRfZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdHZhciBkZWZhdWx0X3JlcXVlc3QgPSBjb25maWcuZGVmYXVsdF9yZXF1ZXN0IHx8IHt9O1xuXHRcdFx0dmFyIGZpbHRlcl9rZXk7XG5cdFx0XHRpZiAoIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWl0ZW1zLXBlci1wYWdlXScgKSApIHtcblx0XHRcdFx0cmVxdWVzdF9jYXRhbG9nKCBjb25maWcsIHsgaXRlbXNfcGVyX3BhZ2U6IE51bWJlciggZXZlbnQudGFyZ2V0LnZhbHVlICksIHBhZ2VfbnVtYmVyOiAxLCBwcmVmZXJlbmNlX2FjdGlvbjogJ3NhdmUnIH0gKTtcblx0XHRcdH0gZWxzZSBpZiAoIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXBhZ2UtbnVtYmVyXScgKSApIHtcblx0XHRcdFx0cmVxdWVzdF9jYXRhbG9nKCBjb25maWcsIHsgcGFnZV9udW1iZXI6IE51bWJlciggZXZlbnQudGFyZ2V0LnZhbHVlICkgfHwgMSB9ICk7XG5cdFx0XHR9IGVsc2UgaWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy10ZW1wbGF0ZS1wYWNrXScgKSApIHtcblx0XHRcdFx0aWYgKCBjb25maWcudGVtcGxhdGVfcGFja3MgJiYgY29uZmlnLnRlbXBsYXRlX3BhY2tzWyBldmVudC50YXJnZXQudmFsdWUgXSApIHtcblx0XHRcdFx0XHRyZXF1ZXN0X2NhdGFsb2coIGNvbmZpZywge1xuXHRcdFx0XHRcdFx0cGFnZV9udW1iZXI6IDEsXG5cdFx0XHRcdFx0XHRwcmVmZXJlbmNlX2FjdGlvbjogJ3NhdmUnLFxuXHRcdFx0XHRcdFx0dGVtcGxhdGVfcGFjazogZXZlbnQudGFyZ2V0LnZhbHVlXG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1maWx0ZXJdJyApICkge1xuXHRcdFx0XHRmaWx0ZXJfa2V5ID0gZXZlbnQudGFyZ2V0LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy11aS1jYXRhbG9nLWZpbHRlcicgKSB8fCAnJztcblx0XHRcdFx0aWYgKCAvXlthLXowLTlfXSskLy50ZXN0KCBmaWx0ZXJfa2V5ICkgKSB7XG5cdFx0XHRcdFx0dmFyIGZpbHRlcl9yZXF1ZXN0ID0geyBwYWdlX251bWJlcjogMSwgcHJlZmVyZW5jZV9hY3Rpb246ICdzYXZlJyB9O1xuXHRcdFx0XHRcdGZpbHRlcl9yZXF1ZXN0WyBmaWx0ZXJfa2V5IF0gPSBldmVudC50YXJnZXQudmFsdWU7XG5cdFx0XHRcdFx0cmVxdWVzdF9jYXRhbG9nKCBjb25maWcsIGZpbHRlcl9yZXF1ZXN0ICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWNvbHVtbi12aXNpYmxlXScgKSApIHtcblx0XHRcdFx0c2F2ZV9jb2x1bW5fY29udHJvbHMoIGNvbmZpZywgbW91bnRfZWxlbWVudCApO1xuXHRcdFx0fSBlbHNlIGlmICggZXZlbnQudGFyZ2V0Lm1hdGNoZXMoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctdmlld10nICkgJiYgJ2N1c3RvbScgIT09IGV2ZW50LnRhcmdldC52YWx1ZSApIHtcblx0XHRcdFx0dmFyIHZpZXdfZGVmaW5pdGlvbiA9IGNvbmZpZy52aWV3cyAmJiBjb25maWcudmlld3MuZGVmaW5pdGlvbnMgPyBjb25maWcudmlld3MuZGVmaW5pdGlvbnNbIGV2ZW50LnRhcmdldC52YWx1ZSBdIDogbnVsbDtcblx0XHRcdFx0aWYgKCB2aWV3X2RlZmluaXRpb24gJiYgQXJyYXkuaXNBcnJheSggdmlld19kZWZpbml0aW9uLmZpZWxkcyApICkge1xuXHRcdFx0XHRcdHJlcXVlc3RfY2F0YWxvZyggY29uZmlnLCB7XG5cdFx0XHRcdFx0XHRwYWdlX251bWJlcjogMSxcblx0XHRcdFx0XHRcdHByZWZlcmVuY2VfYWN0aW9uOiAnc2F2ZScsXG5cdFx0XHRcdFx0XHR2aXNpYmxlX2NvbHVtbnM6IHZpZXdfZGVmaW5pdGlvbi5maWVsZHNcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9ICk7XG5cblx0XHRtb3VudF9lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHR2YXIgY2xvc2VfY29udHJvbCA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWRpc3BsYXktY2xvc2VdJyApO1xuXHRcdFx0dmFyIGRlZmF1bHRfcmVxdWVzdCA9IGNvbmZpZy5kZWZhdWx0X3JlcXVlc3QgfHwge307XG5cdFx0XHR2YXIgcGFnZV9jb250cm9sID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctcGFnZV0nICk7XG5cdFx0XHR2YXIgcmVzZXRfY29udHJvbCA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXByZWZlcmVuY2VzLXJlc2V0XScgKTtcblx0XHRcdHZhciByZXNldF9vcmRlcl9jb250cm9sID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctY29sdW1uLW9yZGVyLXJlc2V0XScgKTtcblx0XHRcdHZhciBzZWFyY2hfY2xlYXIgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1zZWFyY2gtY2xlYXJdJyApO1xuXHRcdFx0dmFyIHNvcnRfY29udHJvbCA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXNvcnRdJyApO1xuXHRcdFx0dmFyIHNvcnRfa2V5O1xuXG5cdFx0XHRpZiAoIHNlYXJjaF9jbGVhciApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0dmFyIHNlYXJjaF9jb250cm9sID0gbW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXNlYXJjaF0nICk7XG5cdFx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIGNhdGFsb2dfc3RhdGUuc2VhcmNoX3RpbWVyICk7XG5cdFx0XHRcdGlmICggc2VhcmNoX2NvbnRyb2wgKSB7XG5cdFx0XHRcdFx0c2VhcmNoX2NvbnRyb2wudmFsdWUgPSAnJztcblx0XHRcdFx0XHRzZWFyY2hfY29udHJvbC5mb2N1cygpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNlYXJjaF9jbGVhci5oaWRkZW4gPSB0cnVlO1xuXHRcdFx0XHRpZiAoIGlzX2ltbWVkaWF0ZV9zZWFyY2hfY2xlYXJfZW5hYmxlZCggY29uZmlnICkgKSB7XG5cdFx0XHRcdFx0cmVxdWVzdF9jYXRhbG9nKCBjb25maWcsIHsgcGFnZV9udW1iZXI6IDEsIHNlYXJjaDogJycgfSApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNhdGFsb2dfc3RhdGUuc2VhcmNoX3RpbWVyID0gd2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdHJlcXVlc3RfY2F0YWxvZyggY29uZmlnLCB7IHBhZ2VfbnVtYmVyOiAxLCBzZWFyY2g6ICcnIH0gKTtcblx0XHRcdFx0XHR9LCBnZXRfc2VhcmNoX2RlYm91bmNlX2RlbGF5KCBjb25maWcgKSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKCBzb3J0X2NvbnRyb2wgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHNvcnRfa2V5ID0gc29ydF9jb250cm9sLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy11aS1jYXRhbG9nLXNvcnQnICkgfHwgJyc7XG5cdFx0XHRcdHJlcXVlc3RfY2F0YWxvZyggY29uZmlnLCB7XG5cdFx0XHRcdFx0cGFnZV9udW1iZXI6IDEsXG5cdFx0XHRcdFx0cHJlZmVyZW5jZV9hY3Rpb246ICdzYXZlJyxcblx0XHRcdFx0XHRzb3J0X2J5OiBzb3J0X2tleSxcblx0XHRcdFx0XHRzb3J0X29yZGVyOiBzb3J0X2tleSA9PT0gY2F0YWxvZ19zdGF0ZS5yZXF1ZXN0X3ZhbHVlcy5zb3J0X2J5ICYmICdhc2MnID09PSBjYXRhbG9nX3N0YXRlLnJlcXVlc3RfdmFsdWVzLnNvcnRfb3JkZXIgPyAnZGVzYycgOiAnYXNjJ1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9IGVsc2UgaWYgKCBwYWdlX2NvbnRyb2wgJiYgISBwYWdlX2NvbnRyb2wuZGlzYWJsZWQgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHJlcXVlc3RfY2F0YWxvZyggY29uZmlnLCB7IHBhZ2VfbnVtYmVyOiBOdW1iZXIoIHBhZ2VfY29udHJvbC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdWktY2F0YWxvZy1wYWdlJyApICkgfHwgMSB9ICk7XG5cdFx0XHR9IGVsc2UgaWYgKCByZXNldF9vcmRlcl9jb250cm9sICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRyZXF1ZXN0X2NhdGFsb2coIGNvbmZpZywgeyBjb2x1bW5fb3JkZXI6IGRlZmF1bHRfcmVxdWVzdC5jb2x1bW5fb3JkZXIgfHwgW10sIHBhZ2VfbnVtYmVyOiAxLCBwcmVmZXJlbmNlX2FjdGlvbjogJ3NhdmUnIH0gKTtcblx0XHRcdH0gZWxzZSBpZiAoIHJlc2V0X2NvbnRyb2wgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHJlcXVlc3RfY2F0YWxvZyggY29uZmlnLCBPYmplY3QuYXNzaWduKCB7fSwgZGVmYXVsdF9yZXF1ZXN0LCB7IHByZWZlcmVuY2VfYWN0aW9uOiAncmVzZXQnIH0gKSApO1xuXHRcdFx0fSBlbHNlIGlmICggY2xvc2VfY29udHJvbCApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0dmFyIGN1c3RvbWl6ZXIgPSBjbG9zZV9jb250cm9sLmNsb3Nlc3QoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctZGlzcGxheS1jdXN0b21pemVyXScgKTtcblx0XHRcdFx0Y2xvc2VfZGlzcGxheV9jdXN0b21pemVyKCBjdXN0b21pemVyLCB0cnVlICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXG5cdFx0bW91bnRfZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHR2YXIgY3VzdG9taXplciA9IGV2ZW50LnRhcmdldCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgZXZlbnQudGFyZ2V0LmNsb3Nlc3Rcblx0XHRcdFx0PyBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1kaXNwbGF5LWN1c3RvbWl6ZXJdJyApXG5cdFx0XHRcdDogbnVsbDtcblx0XHRcdGlmICggJ0VzY2FwZScgIT09IGV2ZW50LmtleSB8fCAhIGN1c3RvbWl6ZXIgfHwgISBjdXN0b21pemVyLm9wZW4gKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRjbG9zZV9kaXNwbGF5X2N1c3RvbWl6ZXIoIGN1c3RvbWl6ZXIsIHRydWUgKTtcblx0XHR9ICk7XG5cblx0XHRtb3VudF9lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd0b2dnbGUnLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0dmFyIGN1c3RvbWl6ZXIgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1kaXNwbGF5LWN1c3RvbWl6ZXJdJyApO1xuXHRcdFx0aWYgKCAhIGN1c3RvbWl6ZXIgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggY3VzdG9taXplci5vcGVuICkge1xuXHRcdFx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0cG9zaXRpb25fZGlzcGxheV9wYW5lbCggY3VzdG9taXplciApO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXNldF9kaXNwbGF5X3BhbmVsX3Bvc2l0aW9uKCBjdXN0b21pemVyICk7XG5cdFx0XHR9XG5cdFx0fSwgdHJ1ZSApO1xuXG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdHZhciBjdXN0b21pemVyID0gbW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWRpc3BsYXktY3VzdG9taXplcl0nICk7XG5cdFx0XHRpZiAoIGN1c3RvbWl6ZXIgJiYgY3VzdG9taXplci5vcGVuICYmICEgY3VzdG9taXplci5jb250YWlucyggZXZlbnQudGFyZ2V0ICkgKSB7XG5cdFx0XHRcdGNsb3NlX2Rpc3BsYXlfY3VzdG9taXplciggY3VzdG9taXplciwgZmFsc2UgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICdyZXNpemUnLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRwb3NpdGlvbl9kaXNwbGF5X3BhbmVsKCBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctZGlzcGxheS1jdXN0b21pemVyXScgKSApO1xuXHRcdFx0c3luY19jYXRhbG9nX3RhYmxlX21pbl93aWR0aCggY29uZmlnICk7XG5cdFx0fSApO1xuXHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAnc2Nyb2xsJywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdHZhciBjdXN0b21pemVyID0gbW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWRpc3BsYXktY3VzdG9taXplcl0nICk7XG5cdFx0XHRpZiAoXG5cdFx0XHRcdGN1c3RvbWl6ZXJcblx0XHRcdFx0JiYgY3VzdG9taXplci5vcGVuXG5cdFx0XHRcdCYmIChcblx0XHRcdFx0XHQhIGV2ZW50LnRhcmdldFxuXHRcdFx0XHRcdHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiBldmVudC50YXJnZXQuY2xvc2VzdFxuXHRcdFx0XHRcdHx8ICEgZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctZGlzcGxheS1jdXN0b21pemVyXScgKVxuXHRcdFx0XHQpXG5cdFx0XHQpIHtcblx0XHRcdFx0cG9zaXRpb25fZGlzcGxheV9wYW5lbCggY3VzdG9taXplciApO1xuXHRcdFx0fVxuXHRcdH0sIHRydWUgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBJbml0aWFsaXplIHBvaW50ZXIgYW5kIGtleWJvYXJkIGNvbHVtbiBvcmRlcmluZyBhZnRlciB0b29sYmFyIHJlbmRlcmluZy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBSZWdpc3RlcmVkIGJyb3dzZXIgY29uZmlndXJhdGlvbi5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHJlZnJlc2hfY2F0YWxvZ19jb250cm9scyggY29uZmlnICkge1xuXHRcdHZhciBjYXRhbG9nX3N0YXRlID0gZ2V0X2NhdGFsb2dfc3RhdGUoIGNvbmZpZy5jYXRhbG9nX2lkICk7XG5cdFx0dmFyIG1vdW50X2VsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggY29uZmlnLm1vdW50X2lkICk7XG5cdFx0dmFyIGNvbHVtbl9saXN0ID0gbW91bnRfZWxlbWVudCA/IG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1jb2x1bW4tbGlzdF0nICkgOiBudWxsO1xuXG5cdFx0aWYgKCAhIGNhdGFsb2dfc3RhdGUgfHwgISBjb2x1bW5fbGlzdCB8fCBjb2x1bW5fbGlzdC5fd3BiY191aV9jYXRhbG9nX2luaXRpYWxpemVkICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb2x1bW5fbGlzdC5fd3BiY191aV9jYXRhbG9nX2luaXRpYWxpemVkID0gdHJ1ZTtcblx0XHRjb2x1bW5fbGlzdC5hZGRFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHR2YXIgaGFuZGxlID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctY29sdW1uLWRyYWctaGFuZGxlXScgKTtcblx0XHRcdHZhciBpdGVtO1xuXHRcdFx0dmFyIHNpYmxpbmc7XG5cdFx0XHRpZiAoICEgaGFuZGxlIHx8ICggJ0Fycm93VXAnICE9PSBldmVudC5rZXkgJiYgJ0Fycm93RG93bicgIT09IGV2ZW50LmtleSApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpdGVtID0gaGFuZGxlLmNsb3Nlc3QoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctY29sdW1uLWl0ZW1dJyApO1xuXHRcdFx0c2libGluZyA9ICdBcnJvd1VwJyA9PT0gZXZlbnQua2V5ID8gaXRlbS5wcmV2aW91c0VsZW1lbnRTaWJsaW5nIDogaXRlbS5uZXh0RWxlbWVudFNpYmxpbmc7XG5cdFx0XHR3aGlsZSAoIHNpYmxpbmcgJiYgJzEnICE9PSBzaWJsaW5nLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy11aS1jYXRhbG9nLWNvbHVtbi1yZW9yZGVyYWJsZScgKSApIHtcblx0XHRcdFx0c2libGluZyA9ICdBcnJvd1VwJyA9PT0gZXZlbnQua2V5ID8gc2libGluZy5wcmV2aW91c0VsZW1lbnRTaWJsaW5nIDogc2libGluZy5uZXh0RWxlbWVudFNpYmxpbmc7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgc2libGluZyApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGlmICggJ0Fycm93VXAnID09PSBldmVudC5rZXkgKSB7XG5cdFx0XHRcdGNvbHVtbl9saXN0Lmluc2VydEJlZm9yZSggaXRlbSwgc2libGluZyApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29sdW1uX2xpc3QuaW5zZXJ0QmVmb3JlKCBzaWJsaW5nLCBpdGVtICk7XG5cdFx0XHR9XG5cdFx0XHRzYXZlX2NvbHVtbl9jb250cm9scyggY29uZmlnLCBtb3VudF9lbGVtZW50ICk7XG5cdFx0XHRhbm5vdW5jZV9jb2x1bW5fbW92ZWQoIGNvbmZpZywgbW91bnRfZWxlbWVudCApO1xuXHRcdFx0aGFuZGxlLmZvY3VzKCk7XG5cdFx0fSApO1xuXG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LlNvcnRhYmxlICkge1xuXHRcdFx0Y2F0YWxvZ19zdGF0ZS5zb3J0YWJsZSA9IG5ldyB3aW5kb3cuU29ydGFibGUoIGNvbHVtbl9saXN0LCB7XG5cdFx0XHRcdGFuaW1hdGlvbjogMTUwLFxuXHRcdFx0XHRjaG9zZW5DbGFzczogJ2lzLWRyYWdnaW5nJyxcblx0XHRcdFx0ZHJhZ2dhYmxlOiAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWNvbHVtbi1yZW9yZGVyYWJsZT1cIjFcIl0nLFxuXHRcdFx0XHRnaG9zdENsYXNzOiAnaXMtZHJhZy1wbGFjZWhvbGRlcicsXG5cdFx0XHRcdGhhbmRsZTogJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1jb2x1bW4tZHJhZy1oYW5kbGVdJyxcblx0XHRcdFx0b25FbmQ6IGZ1bmN0aW9uICggc29ydF9ldmVudCApIHtcblx0XHRcdFx0XHRpZiAoIHNvcnRfZXZlbnQub2xkSW5kZXggIT09IHNvcnRfZXZlbnQubmV3SW5kZXggKSB7XG5cdFx0XHRcdFx0XHRzYXZlX2NvbHVtbl9jb250cm9scyggY29uZmlnLCBtb3VudF9lbGVtZW50ICk7XG5cdFx0XHRcdFx0XHRhbm5vdW5jZV9jb2x1bW5fbW92ZWQoIGNvbmZpZywgbW91bnRfZWxlbWVudCApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBWYWxpZGF0ZSBhIG5vcm1hbGl6ZWQgc2VydmVyIHJlc3BvbnNlIGJlZm9yZSByZW5kZXJpbmcuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgICBSZWdpc3RlcmVkIGJyb3dzZXIgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHsqfSAgICAgIHJlc3BvbnNlIENhbmRpZGF0ZSByZXNwb25zZS5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSByZXNwb25zZSBjb250cmFjdCBpcyBzdXBwb3J0ZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiB2YWxpZGF0ZV9yZXNwb25zZSggY29uZmlnLCByZXNwb25zZSApIHtcblx0XHR2YXIgY29uZmlndXJlZF9zY2hlbWFfdmVyc2lvbiA9IGNvbmZpZyA/IG5vcm1hbGl6ZV9zY2hlbWFfdmVyc2lvbiggY29uZmlnLnNjaGVtYV92ZXJzaW9uICkgOiBudWxsO1xuXHRcdHZhciByZXNwb25zZV9zY2hlbWFfdmVyc2lvbiA9IHJlc3BvbnNlID8gbm9ybWFsaXplX3NjaGVtYV92ZXJzaW9uKCByZXNwb25zZS5zY2hlbWFfdmVyc2lvbiApIDogbnVsbDtcblxuXHRcdGlmIChcblx0XHRcdCEgY29uZmlnXG5cdFx0XHR8fCAhIHJlc3BvbnNlXG5cdFx0XHR8fCAnb2JqZWN0JyAhPT0gdHlwZW9mIHJlc3BvbnNlXG5cdFx0XHR8fCByZXNwb25zZS5jYXRhbG9nX2lkICE9PSBjb25maWcuY2F0YWxvZ19pZFxuXHRcdFx0fHwgbnVsbCA9PT0gY29uZmlndXJlZF9zY2hlbWFfdmVyc2lvblxuXHRcdFx0fHwgcmVzcG9uc2Vfc2NoZW1hX3ZlcnNpb24gIT09IGNvbmZpZ3VyZWRfc2NoZW1hX3ZlcnNpb25cblx0XHRcdHx8ICdib29sZWFuJyAhPT0gdHlwZW9mIHJlc3BvbnNlLnN1Y2Nlc3Ncblx0XHRcdHx8IG51bGwgPT09IG5vcm1hbGl6ZV9zZXF1ZW5jZSggcmVzcG9uc2UucmVxdWVzdF9pZCApXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKCBmYWxzZSA9PT0gcmVzcG9uc2Uuc3VjY2VzcyApIHtcblx0XHRcdHJldHVybiAhISByZXNwb25zZS5lcnJvclxuXHRcdFx0XHQmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIHJlc3BvbnNlLmVycm9yXG5cdFx0XHRcdCYmICdzdHJpbmcnID09PSB0eXBlb2YgcmVzcG9uc2UuZXJyb3IuY29kZVxuXHRcdFx0XHQmJiAnc3RyaW5nJyA9PT0gdHlwZW9mIHJlc3BvbnNlLmVycm9yLm1lc3NhZ2Vcblx0XHRcdFx0JiYgJ2Jvb2xlYW4nID09PSB0eXBlb2YgcmVzcG9uc2UuZXJyb3IucmV0cnlhYmxlO1xuXHRcdH1cblxuXHRcdHJldHVybiBBcnJheS5pc0FycmF5KCByZXNwb25zZS5pdGVtcyApXG5cdFx0XHQmJiAhISByZXNwb25zZS5wYWdpbmF0aW9uXG5cdFx0XHQmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIHJlc3BvbnNlLnBhZ2luYXRpb25cblx0XHRcdCYmICEhIHJlc3BvbnNlLnNvcnRpbmdcblx0XHRcdCYmICdvYmplY3QnID09PSB0eXBlb2YgcmVzcG9uc2Uuc29ydGluZ1xuXHRcdFx0JiYgISEgcmVzcG9uc2UuZmlsdGVyc1xuXHRcdFx0JiYgJ29iamVjdCcgPT09IHR5cGVvZiByZXNwb25zZS5maWx0ZXJzXG5cdFx0XHQmJiAhISByZXNwb25zZS5kaXNwbGF5XG5cdFx0XHQmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIHJlc3BvbnNlLmRpc3BsYXlcblx0XHRcdCYmICEhIHJlc3BvbnNlLmhpZXJhcmNoeVxuXHRcdFx0JiYgJ29iamVjdCcgPT09IHR5cGVvZiByZXNwb25zZS5oaWVyYXJjaHlcblx0XHRcdCYmICEhIHJlc3BvbnNlLmNhcGFiaWxpdGllc1xuXHRcdFx0JiYgJ29iamVjdCcgPT09IHR5cGVvZiByZXNwb25zZS5jYXBhYmlsaXRpZXNcblx0XHRcdCYmIEFycmF5LmlzQXJyYXkoIHJlc3BvbnNlLm1lc3NhZ2VzICk7XG5cdH1cblxuXHQvKipcblx0ICogUmVmcmVzaCBvcHRpb25hbCBzaGFyZWQgaGllcmFyY2h5IG1lY2hhbmljcyBhZnRlciBkb21haW4gcm93cyBhcmUgbW91bnRlZC5cblx0ICpcblx0ICogVGhlIHJlbmRlcmVkIGxpZmVjeWNsZSBldmVudCBydW5zIHN5bmNocm9ub3VzbHkgZmlyc3Qgc28gYSBkb21haW4gYWRhcHRlclxuXHQgKiBjYW4gY29tcG9zZSBpdHMgV1Agcm93IHRlbXBsYXRlcyBiZWZvcmUgdGhlIGNvbnRyb2xsZXIgaW5kZXhlcyBub2RlIERPTS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyAgIFJlZ2lzdGVyZWQgYnJvd3NlciBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gcmVzcG9uc2UgTm9ybWFsaXplZCBjdXJyZW50IHJlc3BvbnNlLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBXaGV0aGVyIGhpZXJhcmNoeSBiZWhhdmlvciBpcyBhY3RpdmUuXG5cdCAqL1xuXHRmdW5jdGlvbiByZWZyZXNoX2NhdGFsb2dfaGllcmFyY2h5KCBjb25maWcsIHJlc3BvbnNlICkge1xuXHRcdHZhciBjYXRhbG9nX3N0YXRlID0gY29uZmlnICYmIGNvbmZpZy5jYXRhbG9nX2lkID8gZ2V0X2NhdGFsb2dfc3RhdGUoIGNvbmZpZy5jYXRhbG9nX2lkICkgOiBudWxsO1xuXG5cdFx0cmV0dXJuICEhIChcblx0XHRcdGNhdGFsb2dfc3RhdGVcblx0XHRcdCYmIGNhdGFsb2dfc3RhdGUuaGllcmFyY2h5X2NvbnRyb2xsZXJcblx0XHRcdCYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBjYXRhbG9nX3N0YXRlLmhpZXJhcmNoeV9jb250cm9sbGVyLnJlZnJlc2hcblx0XHRcdCYmIGNhdGFsb2dfc3RhdGUuaGllcmFyY2h5X2NvbnRyb2xsZXIucmVmcmVzaCggcmVzcG9uc2UgJiYgcmVzcG9uc2UuaGllcmFyY2h5ID8gcmVzcG9uc2UuaGllcmFyY2h5IDoge30gKVxuXHRcdCk7XG5cdH1cblxuXHQvKipcblx0ICogUmVuZGVyIGEgY3VycmVudCBub3JtYWxpemVkIHJlc3BvbnNlIGFuZCBpZ25vcmUgc3RhbGUgc2VxdWVuY2VzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnICAgICAgICAgICBSZWdpc3RlcmVkIGJyb3dzZXIgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHsqfSAgICAgIHJlc3BvbnNlICAgICAgICAgQ2FuZGlkYXRlIG5vcm1hbGl6ZWQgcmVzcG9uc2UuXG5cdCAqIEBwYXJhbSB7Kn0gICAgICByZXF1ZXN0X3NlcXVlbmNlIFNlcXVlbmNlIGFzc2lnbmVkIHdoZW4gdGhlIHJlcXVlc3QgYmVnYW4uXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgcmVzcG9uc2UgY2hhbmdlZCB0aGUgY2F0YWxvZy5cblx0ICovXG5cdGZ1bmN0aW9uIHJlbmRlcl9yZXNwb25zZSggY29uZmlnLCByZXNwb25zZSwgcmVxdWVzdF9zZXF1ZW5jZSApIHtcblx0XHR2YXIgY2F0YWxvZ19zdGF0ZTtcblx0XHR2YXIgaTE4bjtcblx0XHR2YXIgaXRlbXNfdGVtcGxhdGVfZGF0YTtcblx0XHR2YXIgcmVzcG9uc2Vfc2VxdWVuY2UgPSByZXNwb25zZSAmJiBub3JtYWxpemVfc2VxdWVuY2UoIHJlc3BvbnNlLnJlcXVlc3RfaWQgKTtcblx0XHR2YXIgbm9ybWFsaXplZF9zZXF1ZW5jZSA9IG5vcm1hbGl6ZV9zZXF1ZW5jZSggcmVxdWVzdF9zZXF1ZW5jZSApO1xuXG5cdFx0aWYgKCAhIGNvbmZpZyB8fCAhIGNvbmZpZy5jYXRhbG9nX2lkICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNhdGFsb2dfc3RhdGUgPSBnZXRfY2F0YWxvZ19zdGF0ZSggY29uZmlnLmNhdGFsb2dfaWQgKTtcblx0XHRpZiAoXG5cdFx0XHQhIGNhdGFsb2dfc3RhdGVcblx0XHRcdHx8IG51bGwgPT09IG5vcm1hbGl6ZWRfc2VxdWVuY2Vcblx0XHRcdHx8IG51bGwgPT09IHJlc3BvbnNlX3NlcXVlbmNlXG5cdFx0XHR8fCByZXNwb25zZV9zZXF1ZW5jZSAhPT0gbm9ybWFsaXplZF9zZXF1ZW5jZVxuXHRcdFx0fHwgaXNfc3RhbGVfcmVzcG9uc2UoIGNvbmZpZy5jYXRhbG9nX2lkLCBub3JtYWxpemVkX3NlcXVlbmNlIClcblx0XHQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoICEgdmFsaWRhdGVfcmVzcG9uc2UoIGNvbmZpZywgcmVzcG9uc2UgKSApIHtcblx0XHRcdHJldHVybiByZW5kZXJfZXJyb3IoIGNvbmZpZywgY29uZmlnLmkxOG4gJiYgY29uZmlnLmkxOG4uZXJyb3JfbWVzc2FnZSA/IGNvbmZpZy5pMThuLmVycm9yX21lc3NhZ2UgOiAnJyApO1xuXHRcdH1cblxuXHRcdGlmICggZmFsc2UgPT09IHJlc3BvbnNlLnN1Y2Nlc3MgKSB7XG5cdFx0XHRyZXR1cm4gcmVuZGVyX2Vycm9yKCBjb25maWcsIHJlc3BvbnNlLmVycm9yLm1lc3NhZ2UgKTtcblx0XHR9XG5cblx0XHRzZXRfYWN0aXZlX3RlbXBsYXRlX3BhY2soIGNvbmZpZywgcmVzcG9uc2UuZGlzcGxheS50ZW1wbGF0ZV9wYWNrICk7XG5cblx0XHRpMThuID0gY29uZmlnLmkxOG4gfHwge307XG5cdFx0aWYgKCAwID09PSByZXNwb25zZS5pdGVtcy5sZW5ndGggKSB7XG5cdFx0XHR2YXIgaXNfZW1wdHlfcmVuZGVyZWQgPSByZW5kZXJfdGVtcGxhdGUoIGNvbmZpZywgJ2VtcHR5Jywge1xuXHRcdFx0XHR0aXRsZTogaTE4bi5lbXB0eV90aXRsZSB8fCAnJyxcblx0XHRcdFx0bWVzc2FnZTogaTE4bi5lbXB0eV9tZXNzYWdlIHx8ICcnXG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoIGlzX2VtcHR5X3JlbmRlcmVkICkge1xuXHRcdFx0XHRkaXNwYXRjaF9jYXRhbG9nX2V2ZW50KCBjb25maWcsICd3cGJjOnVpLWNhdGFsb2ctcmVuZGVyZWQnLCB7XG5cdFx0XHRcdFx0Y2F0YWxvZ19pZDogY29uZmlnLmNhdGFsb2dfaWQsXG5cdFx0XHRcdFx0cmVxdWVzdF9zZXF1ZW5jZTogbm9ybWFsaXplZF9zZXF1ZW5jZSxcblx0XHRcdFx0XHRyZXNwb25zZTogcmVzcG9uc2Vcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRyZWZyZXNoX2NhdGFsb2dfaGllcmFyY2h5KCBjb25maWcsIHJlc3BvbnNlICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gaXNfZW1wdHlfcmVuZGVyZWQ7XG5cdFx0fVxuXG5cdFx0aXRlbXNfdGVtcGxhdGVfZGF0YSA9IE9iamVjdC5hc3NpZ24oIHt9LCByZXNwb25zZSwgeyBpMThuOiBpMThuIH0gKTtcblx0XHRpZiAoICEgcmVuZGVyX3RlbXBsYXRlKCBjb25maWcsICdpdGVtcycsIGl0ZW1zX3RlbXBsYXRlX2RhdGEgKSApIHtcblx0XHRcdHJldHVybiByZW5kZXJfZXJyb3IoIGNvbmZpZywgaTE4bi5lcnJvcl9tZXNzYWdlIHx8ICcnICk7XG5cdFx0fVxuXHRcdGRpc3BhdGNoX2NhdGFsb2dfZXZlbnQoIGNvbmZpZywgJ3dwYmM6dWktY2F0YWxvZy1yZW5kZXJlZCcsIHtcblx0XHRcdGNhdGFsb2dfaWQ6IGNvbmZpZy5jYXRhbG9nX2lkLFxuXHRcdFx0cmVxdWVzdF9zZXF1ZW5jZTogbm9ybWFsaXplZF9zZXF1ZW5jZSxcblx0XHRcdHJlc3BvbnNlOiByZXNwb25zZVxuXHRcdH0gKTtcblx0XHRyZWZyZXNoX2NhdGFsb2dfaGllcmFyY2h5KCBjb25maWcsIHJlc3BvbnNlICk7XG5cdFx0c3luY19jYXRhbG9nX3RhYmxlX21pbl93aWR0aCggY29uZmlnICk7XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXF1ZXN0IGFuZCByZW5kZXIgb25lIG5vcm1hbGl6ZWQgY2F0YWxvZyByZXNwb25zZS5cblx0ICpcblx0ICogUmVxdWVzdCBjYW5jZWxsYXRpb24gYW5kIHNlcXVlbmNlIGNoZWNrcyBhcmUgc2hhcmVkIG1lY2hhbmljcy4gQ2F0YWxvZ1xuXHQgKiBzY3JpcHRzIHN1cHBseSBvbmx5IG5vcm1hbGl6ZWQgcmVxdWVzdCB2YWx1ZXMgYW5kIHJlc3BvbmQgdG8gbGlmZWN5Y2xlXG5cdCAqIGV2ZW50cyBhZnRlciB0aGUgYWxsb3ctbGlzdGVkIGl0ZW1zIHRlbXBsYXRlIGlzIG1vdW50ZWQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgICAgICAgICBSZWdpc3RlcmVkIGJyb3dzZXIgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtPYmplY3R9IHJlcXVlc3RfdmFsdWVzIE5vcm1hbGl6ZWQgcmVxdWVzdCBvdmVycmlkZXMuXG5cdCAqIEByZXR1cm4ge1Byb21pc2U8Ym9vbGVhbj59IFdoZXRoZXIgYSBjdXJyZW50IHJlc3BvbnNlIHdhcyByZW5kZXJlZC5cblx0ICovXG5cdGZ1bmN0aW9uIHJlcXVlc3RfY2F0YWxvZyggY29uZmlnLCByZXF1ZXN0X3ZhbHVlcyApIHtcblx0XHR2YXIgY2F0YWxvZ19zdGF0ZTtcblx0XHR2YXIgcGVyc2lzdGVudF9yZXF1ZXN0X3ZhbHVlcztcblx0XHR2YXIgcHJlZmVyZW5jZV9hY3Rpb247XG5cdFx0dmFyIHJlcXVlc3RfYm9keTtcblx0XHR2YXIgcmVxdWVzdF9zZXF1ZW5jZTtcblx0XHR2YXIgcmVxdWVzdF91cmw7XG5cblx0XHRpZiAoXG5cdFx0XHQhIGNvbmZpZ1xuXHRcdFx0fHwgISBjb25maWcuY2F0YWxvZ19pZFxuXHRcdFx0fHwgISBjb25maWcuYWpheF91cmxcblx0XHRcdHx8ICEgY29uZmlnLmFjdGlvblxuXHRcdFx0fHwgISBjb25maWcubm9uY2Vcblx0XHRcdHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiB3aW5kb3cuZmV0Y2hcblx0XHQpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoIHJlbmRlcl9lcnJvciggY29uZmlnIHx8IHt9LCBjb25maWcgJiYgY29uZmlnLmkxOG4gPyBjb25maWcuaTE4bi5lcnJvcl9tZXNzYWdlIDogJycgKSApO1xuXHRcdH1cblxuXHRcdGNhdGFsb2dfc3RhdGUgPSBnZXRfY2F0YWxvZ19zdGF0ZSggY29uZmlnLmNhdGFsb2dfaWQgKTtcblx0XHRpZiAoICEgY2F0YWxvZ19zdGF0ZSApIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoIGZhbHNlICk7XG5cdFx0fVxuXG5cdFx0aWYgKCBjYXRhbG9nX3N0YXRlLmFib3J0X2NvbnRyb2xsZXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNhdGFsb2dfc3RhdGUuYWJvcnRfY29udHJvbGxlci5hYm9ydCApIHtcblx0XHRcdGNhdGFsb2dfc3RhdGUuYWJvcnRfY29udHJvbGxlci5hYm9ydCgpO1xuXHRcdH1cblx0XHRjYXRhbG9nX3N0YXRlLmFib3J0X2NvbnRyb2xsZXIgPSAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LkFib3J0Q29udHJvbGxlciA/IG5ldyB3aW5kb3cuQWJvcnRDb250cm9sbGVyKCkgOiBudWxsO1xuXHRcdHBlcnNpc3RlbnRfcmVxdWVzdF92YWx1ZXMgPSBPYmplY3QuYXNzaWduKCB7fSwgcmVxdWVzdF92YWx1ZXMgfHwge30gKTtcblx0XHRwcmVmZXJlbmNlX2FjdGlvbiA9IHBlcnNpc3RlbnRfcmVxdWVzdF92YWx1ZXMucHJlZmVyZW5jZV9hY3Rpb24gfHwgJyc7XG5cdFx0ZGVsZXRlIHBlcnNpc3RlbnRfcmVxdWVzdF92YWx1ZXMucHJlZmVyZW5jZV9hY3Rpb247XG5cdFx0Y2F0YWxvZ19zdGF0ZS5yZXF1ZXN0X3ZhbHVlcyA9IE9iamVjdC5hc3NpZ24oIHt9LCBjb25maWcuaW5pdGlhbF9yZXF1ZXN0IHx8IHt9LCBjYXRhbG9nX3N0YXRlLnJlcXVlc3RfdmFsdWVzIHx8IHt9LCBwZXJzaXN0ZW50X3JlcXVlc3RfdmFsdWVzICk7XG5cdFx0cmVxdWVzdF9zZXF1ZW5jZSA9IG5leHRfcmVxdWVzdF9zZXF1ZW5jZSggY29uZmlnLmNhdGFsb2dfaWQgKTtcblx0XHRjYXRhbG9nX3N0YXRlLnJlcXVlc3RfdmFsdWVzLnJlcXVlc3RfaWQgPSByZXF1ZXN0X3NlcXVlbmNlO1xuXG5cdFx0aWYgKCAhIHNldF9jYXRhbG9nX2xvYWRpbmdfc3RhdGUoIGNvbmZpZywgdHJ1ZSApICkge1xuXHRcdFx0cmVuZGVyX3RlbXBsYXRlKCBjb25maWcsICdzaGVsbCcsIHtcblx0XHRcdFx0Y2F0YWxvZ19pZDogY29uZmlnLmNhdGFsb2dfaWQsXG5cdFx0XHRcdGFyaWFfbGFiZWw6IGNvbmZpZy5pMThuICYmIGNvbmZpZy5pMThuLmNhdGFsb2dfbGFiZWwgPyBjb25maWcuaTE4bi5jYXRhbG9nX2xhYmVsIDogJycsXG5cdFx0XHRcdGxvYWRpbmdfbWVzc2FnZTogY29uZmlnLmkxOG4gJiYgY29uZmlnLmkxOG4ubG9hZGluZyA/IGNvbmZpZy5pMThuLmxvYWRpbmcgOiAnJ1xuXHRcdFx0fSApO1xuXHRcdH1cblx0XHRkaXNwYXRjaF9jYXRhbG9nX2V2ZW50KCBjb25maWcsICd3cGJjOnVpLWNhdGFsb2ctbG9hZGluZycsIHtcblx0XHRcdGNhdGFsb2dfaWQ6IGNvbmZpZy5jYXRhbG9nX2lkLFxuXHRcdFx0cmVxdWVzdF9zZXF1ZW5jZTogcmVxdWVzdF9zZXF1ZW5jZVxuXHRcdH0gKTtcblxuXHRcdHJlcXVlc3RfYm9keSA9IG5ldyB3aW5kb3cuVVJMU2VhcmNoUGFyYW1zKCk7XG5cdFx0cmVxdWVzdF9ib2R5LmFwcGVuZCggJ2FjdGlvbicsIGNvbmZpZy5hY3Rpb24gKTtcblx0XHRyZXF1ZXN0X2JvZHkuYXBwZW5kKCAnbm9uY2UnLCBjb25maWcubm9uY2UgKTtcblx0XHRpZiAoIHByZWZlcmVuY2VfYWN0aW9uICkge1xuXHRcdFx0Y2F0YWxvZ19zdGF0ZS5wcmVmZXJlbmNlX3JldmlzaW9uID0gTWF0aC5tYXgoIERhdGUubm93KCksIGNhdGFsb2dfc3RhdGUucHJlZmVyZW5jZV9yZXZpc2lvbiArIDEgKTtcblx0XHRcdHJlcXVlc3RfYm9keS5hcHBlbmQoICdwcmVmZXJlbmNlX2FjdGlvbicsIHByZWZlcmVuY2VfYWN0aW9uICk7XG5cdFx0XHRyZXF1ZXN0X2JvZHkuYXBwZW5kKCAncHJlZmVyZW5jZV9yZXZpc2lvbicsIFN0cmluZyggY2F0YWxvZ19zdGF0ZS5wcmVmZXJlbmNlX3JldmlzaW9uICkgKTtcblx0XHR9XG5cdFx0T2JqZWN0LmtleXMoIGNhdGFsb2dfc3RhdGUucmVxdWVzdF92YWx1ZXMgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHJlcXVlc3Rfa2V5ICkge1xuXHRcdFx0YXBwZW5kX3JlcXVlc3RfdmFsdWUoIHJlcXVlc3RfYm9keSwgcmVxdWVzdF9rZXksIGNhdGFsb2dfc3RhdGUucmVxdWVzdF92YWx1ZXNbIHJlcXVlc3Rfa2V5IF0gKTtcblx0XHR9ICk7XG5cdFx0cmVxdWVzdF91cmwgPSBTdHJpbmcoIGNvbmZpZy5hamF4X3VybCApO1xuXG5cdFx0cmV0dXJuIHdpbmRvdy5mZXRjaCggcmVxdWVzdF91cmwsIHtcblx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0Y3JlZGVudGlhbHM6ICdzYW1lLW9yaWdpbicsXG5cdFx0XHRoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkOyBjaGFyc2V0PVVURi04JyB9LFxuXHRcdFx0Ym9keTogcmVxdWVzdF9ib2R5LnRvU3RyaW5nKCksXG5cdFx0XHRzaWduYWw6IGNhdGFsb2dfc3RhdGUuYWJvcnRfY29udHJvbGxlciA/IGNhdGFsb2dfc3RhdGUuYWJvcnRfY29udHJvbGxlci5zaWduYWwgOiB1bmRlZmluZWRcblx0XHR9ICkudGhlbiggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdHJldHVybiByZXNwb25zZS50ZXh0KCkudGhlbiggZnVuY3Rpb24gKCByZXNwb25zZV90ZXh0ICkge1xuXHRcdFx0XHR2YXIgcmVzcG9uc2VfcGF5bG9hZCA9IG51bGw7XG5cblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRyZXNwb25zZV9wYXlsb2FkID0gSlNPTi5wYXJzZSggcmVzcG9uc2VfdGV4dCApO1xuXHRcdFx0XHR9IGNhdGNoICggZXJyb3IgKSB7XG5cdFx0XHRcdFx0cmVzcG9uc2VfcGF5bG9hZCA9IG51bGw7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoIGlzX3N0YWxlX3Jlc3BvbnNlKCBjb25maWcuY2F0YWxvZ19pZCwgcmVxdWVzdF9zZXF1ZW5jZSApICkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICEgcmVzcG9uc2VfcGF5bG9hZCApIHtcblx0XHRcdFx0XHRyZXR1cm4gcmVuZGVyX2Vycm9yKCBjb25maWcsIGNvbmZpZy5pMThuICYmIGNvbmZpZy5pMThuLmVycm9yX21lc3NhZ2UgPyBjb25maWcuaTE4bi5lcnJvcl9tZXNzYWdlIDogJycgKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHZhciBpc19yZW5kZXJlZCA9IHJlbmRlcl9yZXNwb25zZSggY29uZmlnLCByZXNwb25zZV9wYXlsb2FkLCByZXF1ZXN0X3NlcXVlbmNlICk7XG5cdFx0XHRcdGlmICggaXNfcmVuZGVyZWQgJiYgcmVzcG9uc2VfcGF5bG9hZC5zdWNjZXNzICkge1xuXHRcdFx0XHRcdGNhdGFsb2dfc3RhdGUucmVxdWVzdF92YWx1ZXMgPSBPYmplY3QuYXNzaWduKCB7fSwgY2F0YWxvZ19zdGF0ZS5yZXF1ZXN0X3ZhbHVlcywge1xuXHRcdFx0XHRcdFx0cGFnZV9udW1iZXI6IHJlc3BvbnNlX3BheWxvYWQucGFnaW5hdGlvbi5wYWdlX251bWJlcixcblx0XHRcdFx0XHRcdGl0ZW1zX3Blcl9wYWdlOiByZXNwb25zZV9wYXlsb2FkLnBhZ2luYXRpb24uaXRlbXNfcGVyX3BhZ2UsXG5cdFx0XHRcdFx0XHRzb3J0X2J5OiByZXNwb25zZV9wYXlsb2FkLnNvcnRpbmcuc29ydF9ieSxcblx0XHRcdFx0XHRcdHNvcnRfb3JkZXI6IHJlc3BvbnNlX3BheWxvYWQuc29ydGluZy5zb3J0X29yZGVyLFxuXHRcdFx0XHRcdFx0c2VhcmNoOiByZXNwb25zZV9wYXlsb2FkLmZpbHRlcnMuc2VhcmNoIHx8ICcnLFxuXHRcdFx0XHRcdFx0dmlzaWJsZV9jb2x1bW5zOiByZXNwb25zZV9wYXlsb2FkLmRpc3BsYXkudmlzaWJsZV9jb2x1bW5zIHx8IFtdLFxuXHRcdFx0XHRcdFx0Y29sdW1uX29yZGVyOiByZXNwb25zZV9wYXlsb2FkLmRpc3BsYXkuY29sdW1uX29yZGVyIHx8IFtdLFxuXHRcdFx0XHRcdFx0dGVtcGxhdGVfcGFjazogcmVzcG9uc2VfcGF5bG9hZC5kaXNwbGF5LnRlbXBsYXRlX3BhY2sgfHwgJydcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0T2JqZWN0LmtleXMoIHJlc3BvbnNlX3BheWxvYWQuZmlsdGVycyB8fCB7fSApLmZvckVhY2goIGZ1bmN0aW9uICggZmlsdGVyX2tleSApIHtcblx0XHRcdFx0XHRcdGNhdGFsb2dfc3RhdGUucmVxdWVzdF92YWx1ZXNbIGZpbHRlcl9rZXkgXSA9IHJlc3BvbnNlX3BheWxvYWQuZmlsdGVyc1sgZmlsdGVyX2tleSBdO1xuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHR1cGRhdGVfdXJsX3N0YXRlKCBjb25maWcsIHJlc3BvbnNlX3BheWxvYWQgKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBpc19yZW5kZXJlZDtcblx0XHRcdH0gKTtcblx0XHR9ICkuY2F0Y2goIGZ1bmN0aW9uICggZXJyb3IgKSB7XG5cdFx0XHRpZiAoIGVycm9yICYmICdBYm9ydEVycm9yJyA9PT0gZXJyb3IubmFtZSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBpc19zdGFsZV9yZXNwb25zZSggY29uZmlnLmNhdGFsb2dfaWQsIHJlcXVlc3Rfc2VxdWVuY2UgKSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcmVuZGVyX2Vycm9yKCBjb25maWcsIGNvbmZpZy5pMThuICYmIGNvbmZpZy5pMThuLmVycm9yX21lc3NhZ2UgPyBjb25maWcuaTE4bi5lcnJvcl9tZXNzYWdlIDogJycgKTtcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogUGVyc2lzdCB2YWxpZGF0ZWQgcHJlc2VudGF0aW9uIHByZWZlcmVuY2VzIHdpdGhvdXQgcmVidWlsZGluZyBjYXRhbG9nIHJvd3MuXG5cdCAqXG5cdCAqIERvbWFpbiBjYXRhbG9ncyBtYXkgYWRkIHRoZWlyIG93biBzY2FsYXIgcHJlZmVyZW5jZSB2YWx1ZXMgdG8gdGhlIHNoYXJlZFxuXHQgKiByZXF1ZXN0IHN0YXRlLiBUaGUgZW5kcG9pbnQgcmVtYWlucyByZXNwb25zaWJsZSBmb3IgdmFsaWRhdGlvbiBhbmRcblx0ICogYXV0aG9yaXphdGlvbi4gQSBzZXBhcmF0ZSBhYm9ydCBzbG90IHByZXZlbnRzIGEgZGlzY2xvc3VyZS1zdGF0ZSBzYXZlIGZyb21cblx0ICogY2FuY2VsbGluZyBhbiBhY3RpdmUgbGlzdCByZXF1ZXN0IG9yIHNob3dpbmcgdGhlIGNhdGFsb2cgbG9hZGluZyBvdmVybGF5LlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnICAgICAgICAgICAgUmVnaXN0ZXJlZCBicm93c2VyIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBwcmVmZXJlbmNlX3ZhbHVlcyBTaGFyZWQgb3IgZG9tYWluLW93bmVkIHJlcXVlc3QgdmFsdWVzLlxuXHQgKiBAcmV0dXJuIHtQcm9taXNlPGJvb2xlYW4+fSBXaGV0aGVyIHRoZSBjdXJyZW50IHByZWZlcmVuY2UgcmVxdWVzdCBzdWNjZWVkZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiBzYXZlX2NhdGFsb2dfcHJlZmVyZW5jZXMoIGNvbmZpZywgcHJlZmVyZW5jZV92YWx1ZXMgKSB7XG5cdFx0dmFyIGNhdGFsb2dfc3RhdGU7XG5cdFx0dmFyIHJlcXVlc3RfYm9keTtcblx0XHR2YXIgcmVxdWVzdF9yZXZpc2lvbjtcblxuXHRcdGlmICggISBjb25maWcgfHwgISBjb25maWcuY2F0YWxvZ19pZCB8fCAhIGNvbmZpZy5hamF4X3VybCB8fCAhIGNvbmZpZy5hY3Rpb24gfHwgISBjb25maWcubm9uY2UgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy5mZXRjaCApIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoIGZhbHNlICk7XG5cdFx0fVxuXHRcdGNhdGFsb2dfc3RhdGUgPSBnZXRfY2F0YWxvZ19zdGF0ZSggY29uZmlnLmNhdGFsb2dfaWQgKTtcblx0XHRpZiAoICEgY2F0YWxvZ19zdGF0ZSApIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoIGZhbHNlICk7XG5cdFx0fVxuXHRcdGlmICggY2F0YWxvZ19zdGF0ZS5wcmVmZXJlbmNlX2Fib3J0X2NvbnRyb2xsZXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNhdGFsb2dfc3RhdGUucHJlZmVyZW5jZV9hYm9ydF9jb250cm9sbGVyLmFib3J0ICkge1xuXHRcdFx0Y2F0YWxvZ19zdGF0ZS5wcmVmZXJlbmNlX2Fib3J0X2NvbnRyb2xsZXIuYWJvcnQoKTtcblx0XHR9XG5cdFx0Y2F0YWxvZ19zdGF0ZS5wcmVmZXJlbmNlX2Fib3J0X2NvbnRyb2xsZXIgPSAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LkFib3J0Q29udHJvbGxlciA/IG5ldyB3aW5kb3cuQWJvcnRDb250cm9sbGVyKCkgOiBudWxsO1xuXHRcdGNhdGFsb2dfc3RhdGUucmVxdWVzdF92YWx1ZXMgPSBPYmplY3QuYXNzaWduKCB7fSwgY29uZmlnLmluaXRpYWxfcmVxdWVzdCB8fCB7fSwgY2F0YWxvZ19zdGF0ZS5yZXF1ZXN0X3ZhbHVlcyB8fCB7fSwgcHJlZmVyZW5jZV92YWx1ZXMgfHwge30gKTtcblx0XHRjYXRhbG9nX3N0YXRlLnByZWZlcmVuY2VfcmV2aXNpb24gPSBNYXRoLm1heCggRGF0ZS5ub3coKSwgY2F0YWxvZ19zdGF0ZS5wcmVmZXJlbmNlX3JldmlzaW9uICsgMSApO1xuXHRcdHJlcXVlc3RfcmV2aXNpb24gPSBjYXRhbG9nX3N0YXRlLnByZWZlcmVuY2VfcmV2aXNpb247XG5cblx0XHRyZXF1ZXN0X2JvZHkgPSBuZXcgd2luZG93LlVSTFNlYXJjaFBhcmFtcygpO1xuXHRcdHJlcXVlc3RfYm9keS5hcHBlbmQoICdhY3Rpb24nLCBjb25maWcuYWN0aW9uICk7XG5cdFx0cmVxdWVzdF9ib2R5LmFwcGVuZCggJ25vbmNlJywgY29uZmlnLm5vbmNlICk7XG5cdFx0cmVxdWVzdF9ib2R5LmFwcGVuZCggJ3ByZWZlcmVuY2VfYWN0aW9uJywgJ3NhdmUnICk7XG5cdFx0cmVxdWVzdF9ib2R5LmFwcGVuZCggJ3ByZWZlcmVuY2VfcmV2aXNpb24nLCBTdHJpbmcoIHJlcXVlc3RfcmV2aXNpb24gKSApO1xuXHRcdHJlcXVlc3RfYm9keS5hcHBlbmQoICdwcmVmZXJlbmNlc19vbmx5JywgJzEnICk7XG5cdFx0T2JqZWN0LmtleXMoIGNhdGFsb2dfc3RhdGUucmVxdWVzdF92YWx1ZXMgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHJlcXVlc3Rfa2V5ICkge1xuXHRcdFx0YXBwZW5kX3JlcXVlc3RfdmFsdWUoIHJlcXVlc3RfYm9keSwgcmVxdWVzdF9rZXksIGNhdGFsb2dfc3RhdGUucmVxdWVzdF92YWx1ZXNbIHJlcXVlc3Rfa2V5IF0gKTtcblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gd2luZG93LmZldGNoKCBTdHJpbmcoIGNvbmZpZy5hamF4X3VybCApLCB7XG5cdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdGNyZWRlbnRpYWxzOiAnc2FtZS1vcmlnaW4nLFxuXHRcdFx0aGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZDsgY2hhcnNldD1VVEYtOCcgfSxcblx0XHRcdGJvZHk6IHJlcXVlc3RfYm9keS50b1N0cmluZygpLFxuXHRcdFx0c2lnbmFsOiBjYXRhbG9nX3N0YXRlLnByZWZlcmVuY2VfYWJvcnRfY29udHJvbGxlciA/IGNhdGFsb2dfc3RhdGUucHJlZmVyZW5jZV9hYm9ydF9jb250cm9sbGVyLnNpZ25hbCA6IHVuZGVmaW5lZFxuXHRcdH0gKS50aGVuKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0cmV0dXJuIHJlc3BvbnNlLnRleHQoKS50aGVuKCBmdW5jdGlvbiAoIHJlc3BvbnNlX3RleHQgKSB7XG5cdFx0XHRcdHZhciByZXNwb25zZV9wYXlsb2FkID0gbnVsbDtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRyZXNwb25zZV9wYXlsb2FkID0gSlNPTi5wYXJzZSggcmVzcG9uc2VfdGV4dCApO1xuXHRcdFx0XHR9IGNhdGNoICggZXJyb3IgKSB7XG5cdFx0XHRcdFx0cmVzcG9uc2VfcGF5bG9hZCA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHJlcXVlc3RfcmV2aXNpb24gPT09IGNhdGFsb2dfc3RhdGUucHJlZmVyZW5jZV9yZXZpc2lvblxuXHRcdFx0XHRcdCYmIHJlc3BvbnNlLm9rXG5cdFx0XHRcdFx0JiYgISEgcmVzcG9uc2VfcGF5bG9hZFxuXHRcdFx0XHRcdCYmIHRydWUgPT09IHJlc3BvbnNlX3BheWxvYWQuc3VjY2Vzcztcblx0XHRcdH0gKTtcblx0XHR9ICkuY2F0Y2goIGZ1bmN0aW9uICggZXJyb3IgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFkZCBmdWxsLXRleHQgdG9vbHRpcHMgb25seSB0byBjYXRhbG9nIHRleHQgdGhhdCBpcyB2aXN1YWxseSBjbGlwcGVkLlxuXHQgKlxuXHQgKiBUaGUgaGVscGVyIG93bnMgdGhlIGRvbWFpbi1uZXV0cmFsIG92ZXJmbG93IG1lYXN1cmVtZW50LCBrZXlib2FyZCBmb2N1cyxcblx0ICogQm9va2luZyBDYWxlbmRhciB0b29sdGlwIGluaXRpYWxpemF0aW9uLCBhbmQgbmF0aXZlLXRpdGxlIGZhbGxiYWNrLiBEb21haW5cblx0ICogdGVtcGxhdGVzIG9wdCBpbiBieSBwcm92aWRpbmcgYXV0aG9yaXplZCBwbGFpbiB0ZXh0IHRocm91Z2ggdGhlXG5cdCAqIGBkYXRhLXdwYmMtdWktY2F0YWxvZy1vdmVyZmxvdy10b29sdGlwYCBhdHRyaWJ1dGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGNhdGFsb2dfbW91bnQgQ2F0YWxvZyBtb3VudCBlbGVtZW50LlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3luY2hyb25pemVfb3ZlcmZsb3dfdG9vbHRpcHMoIGNhdGFsb2dfbW91bnQgKSB7XG5cdFx0dmFyIGhhc19vdmVyZmxvd2luZ190ZXh0ID0gZmFsc2U7XG5cdFx0dmFyIHRvb2x0aXBfc2VsZWN0b3I7XG5cblx0XHRpZiAoICEgY2F0YWxvZ19tb3VudCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y2F0YWxvZ19tb3VudC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLW92ZXJmbG93LXRvb2x0aXBdJyApLmZvckVhY2goIGZ1bmN0aW9uICggdGV4dF9lbGVtZW50ICkge1xuXHRcdFx0dmFyIGZ1bGxfdGV4dCA9IHRleHRfZWxlbWVudC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdWktY2F0YWxvZy1vdmVyZmxvdy10b29sdGlwJyApIHx8ICcnO1xuXHRcdFx0dmFyIHN0YXRpY190aXRsZSA9IHRleHRfZWxlbWVudC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdWktY2F0YWxvZy1zdGF0aWMtdGl0bGUnICkgfHwgJyc7XG5cdFx0XHR2YXIgaXNfb3ZlcmZsb3dpbmcgPSB0ZXh0X2VsZW1lbnQuc2Nyb2xsV2lkdGggPiB0ZXh0X2VsZW1lbnQuY2xpZW50V2lkdGggKyAxXG5cdFx0XHRcdHx8IHRleHRfZWxlbWVudC5zY3JvbGxIZWlnaHQgPiB0ZXh0X2VsZW1lbnQuY2xpZW50SGVpZ2h0ICsgMTtcblxuXHRcdFx0aWYgKCB0ZXh0X2VsZW1lbnQuX3RpcHB5ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB0ZXh0X2VsZW1lbnQuX3RpcHB5LmRlc3Ryb3kgKSB7XG5cdFx0XHRcdHRleHRfZWxlbWVudC5fdGlwcHkuZGVzdHJveSgpO1xuXHRcdFx0fVxuXHRcdFx0dGV4dF9lbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoICd0b29sdGlwX3RvcCcsICd3cGJjX3VpX2xpc3RpbmdfX292ZXJmbG93X3Rvb2x0aXAnICk7XG5cdFx0XHR0ZXh0X2VsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCAndGl0bGUnICk7XG5cdFx0XHR0ZXh0X2VsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCAnZGF0YS1vcmlnaW5hbC10aXRsZScgKTtcblx0XHRcdGlmICggJzEnID09PSB0ZXh0X2VsZW1lbnQuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctdG9vbHRpcC10YWJpbmRleCcgKSApIHtcblx0XHRcdFx0dGV4dF9lbGVtZW50LnJlbW92ZUF0dHJpYnV0ZSggJ3RhYmluZGV4JyApO1xuXHRcdFx0XHR0ZXh0X2VsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctdG9vbHRpcC10YWJpbmRleCcgKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCBmdWxsX3RleHQgJiYgaXNfb3ZlcmZsb3dpbmcgKSB7XG5cdFx0XHRcdHRleHRfZWxlbWVudC5zZXRBdHRyaWJ1dGUoICdkYXRhLW9yaWdpbmFsLXRpdGxlJywgZnVsbF90ZXh0ICk7XG5cdFx0XHRcdHRleHRfZWxlbWVudC5jbGFzc0xpc3QuYWRkKCAndG9vbHRpcF90b3AnLCAnd3BiY191aV9saXN0aW5nX19vdmVyZmxvd190b29sdGlwJyApO1xuXHRcdFx0XHRpZiAoICEgdGV4dF9lbGVtZW50Lmhhc0F0dHJpYnV0ZSggJ3RhYmluZGV4JyApICkge1xuXHRcdFx0XHRcdHRleHRfZWxlbWVudC5zZXRBdHRyaWJ1dGUoICd0YWJpbmRleCcsICcwJyApO1xuXHRcdFx0XHRcdHRleHRfZWxlbWVudC5zZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdWktY2F0YWxvZy10b29sdGlwLXRhYmluZGV4JywgJzEnICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aGFzX292ZXJmbG93aW5nX3RleHQgPSB0cnVlO1xuXHRcdFx0fSBlbHNlIGlmICggc3RhdGljX3RpdGxlICkge1xuXHRcdFx0XHR0ZXh0X2VsZW1lbnQuc2V0QXR0cmlidXRlKCAndGl0bGUnLCBzdGF0aWNfdGl0bGUgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cblx0XHR0b29sdGlwX3NlbGVjdG9yID0gY2F0YWxvZ19tb3VudC5pZCA/ICcjJyArIGNhdGFsb2dfbW91bnQuaWQgKyAnIC53cGJjX3VpX2xpc3RpbmdfX292ZXJmbG93X3Rvb2x0aXAnIDogJyc7XG5cdFx0aWYgKCBoYXNfb3ZlcmZsb3dpbmdfdGV4dCAmJiB0b29sdGlwX3NlbGVjdG9yICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19kZWZpbmVfdGlwcHlfdG9vbHRpcHMgJiYgd2luZG93LndwYmNfZGVmaW5lX3RpcHB5X3Rvb2x0aXBzKCB0b29sdGlwX3NlbGVjdG9yICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNhdGFsb2dfbW91bnQucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX3VpX2xpc3RpbmdfX292ZXJmbG93X3Rvb2x0aXAnICkuZm9yRWFjaCggZnVuY3Rpb24gKCB0ZXh0X2VsZW1lbnQgKSB7XG5cdFx0XHR0ZXh0X2VsZW1lbnQuc2V0QXR0cmlidXRlKCAndGl0bGUnLCB0ZXh0X2VsZW1lbnQuZ2V0QXR0cmlidXRlKCAnZGF0YS1vcmlnaW5hbC10aXRsZScgKSB8fCAnJyApO1xuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGUgYSBkb21haW4tbmV1dHJhbCBuYXRpdmUgaW5zcGVjdG9yIHN0YXRlIHdvcmtmbG93LlxuXHQgKlxuXHQgKiBEb21haW5zIHN1cHBseSB0aGVpciBhbGxvdy1saXN0ZWQgc2hlbGwgcmVuZGVyZXIsIGhvc3QvZm9vdGVyIGJvdW5kYXJpZXMsXG5cdCAqIGxvY2FsaXplZCBzaGVsbCBkYXRhLCBhbmQgc2lkZWJhciBleHBhbnNpb24gY2FsbGJhY2suIFRoZSBzaGFyZWQgd29ya2Zsb3dcblx0ICogb3ducyBvbmx5IHNoZWxsIG1vdW50aW5nIGFuZCB0aGUgZW1wdHksIGxvYWRpbmcsIGVycm9yLCBhbmQgZm9ybSBzdGF0ZXMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBzZXR0aW5ncyBJbnNwZWN0b3IgYm91bmRhcnkgY2FsbGJhY2tzIGFuZCBzaGVsbCBkYXRhLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8ZmFsc2V9IEluc3BlY3RvciB3b3JrZmxvdyBjb250cm9sbGVyIG9yIGZhbHNlIHdoZW4gaW52YWxpZC5cblx0ICovXG5cdGZ1bmN0aW9uIGNyZWF0ZV9pbnNwZWN0b3Jfd29ya2Zsb3coIHNldHRpbmdzICkge1xuXHRcdHZhciBvcHRpb25zID0gT2JqZWN0LmFzc2lnbigge1xuXHRcdFx0ZXhwYW5kOiBudWxsLFxuXHRcdFx0Z2V0X2Zvb3RlcjogbnVsbCxcblx0XHRcdGdldF9ob3N0OiBudWxsLFxuXHRcdFx0cmVuZGVyX3NoZWxsOiBudWxsLFxuXHRcdFx0c2hlbGxfZGF0YToge31cblx0XHR9LCBzZXR0aW5ncyB8fCB7fSApO1xuXG5cdFx0aWYgKCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygb3B0aW9ucy5nZXRfaG9zdCB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygb3B0aW9ucy5yZW5kZXJfc2hlbGwgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBjdXJyZW50IGRvbWFpbi1vd25lZCBpbnNwZWN0b3IgaG9zdC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge0VsZW1lbnR8bnVsbH0gSW5zcGVjdG9yIGhvc3Qgb3IgbnVsbCB3aGVuIGl0IGlzIHVuYXZhaWxhYmxlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9ob3N0KCkge1xuXHRcdFx0dmFyIGhvc3QgPSBvcHRpb25zLmdldF9ob3N0KCk7XG5cblx0XHRcdHJldHVybiBob3N0ICYmIGhvc3QucXVlcnlTZWxlY3RvciA/IGhvc3QgOiBudWxsO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiB0aGUgY3VycmVudCBkb21haW4tb3duZWQgc3RpY2t5IGZvb3RlciB3aGVuIGNvbmZpZ3VyZWQuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtFbGVtZW50fG51bGx9IEluc3BlY3RvciBmb290ZXIgb3IgbnVsbCB3aGVuIGl0IGlzIHVuYXZhaWxhYmxlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9mb290ZXIoKSB7XG5cdFx0XHR2YXIgZm9vdGVyID0gJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIG9wdGlvbnMuZ2V0X2Zvb3RlciA/IG9wdGlvbnMuZ2V0X2Zvb3RlcigpIDogbnVsbDtcblxuXHRcdFx0cmV0dXJuIGZvb3RlciAmJiBmb290ZXIucXVlcnlTZWxlY3RvciA/IGZvb3RlciA6IG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTW91bnQgdGhlIGFsbG93LWxpc3RlZCBzaGFyZWQgc2hlbGwgaW5zaWRlIHRoZSBkb21haW4gaG9zdCBvbmNlLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBpbnNwZWN0b3Igc2hlbGwgaXMgYXZhaWxhYmxlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG1vdW50KCkge1xuXHRcdFx0dmFyIGhvc3QgPSBnZXRfaG9zdCgpO1xuXHRcdFx0dmFyIHJlbmRlcmVkX3NoZWxsO1xuXG5cdFx0XHRpZiAoICEgaG9zdCApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIGhvc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbnNwZWN0b3JdJyApICkge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdHJlbmRlcmVkX3NoZWxsID0gb3B0aW9ucy5yZW5kZXJfc2hlbGwoIE9iamVjdC5hc3NpZ24oIHt9LCBvcHRpb25zLnNoZWxsX2RhdGEgfHwge30gKSApO1xuXHRcdFx0XHR9IGNhdGNoICggZXJyb3IgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggJ3N0cmluZycgIT09IHR5cGVvZiByZW5kZXJlZF9zaGVsbCB8fCAhIHJlbmRlcmVkX3NoZWxsICkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRob3N0LmlubmVySFRNTCA9IHJlbmRlcmVkX3NoZWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gISEgaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvcl0nICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3luY2hyb25pemUgb25lIGFsbG93LWxpc3RlZCBpbnNwZWN0b3IgcHJlc2VudGF0aW9uIHN0YXRlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHN0YXRlICAgRW1wdHksIGxvYWRpbmcsIGVycm9yLCBvciBmb3JtLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlIE9wdGlvbmFsIHNhZmUgZXJyb3IgbWVzc2FnZS5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIG1vdW50ZWQgc2hlbGwgd2FzIHVwZGF0ZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2V0X3N0YXRlKCBzdGF0ZSwgbWVzc2FnZSApIHtcblx0XHRcdHZhciBlcnJvcjtcblx0XHRcdHZhciBlcnJvcl90ZXh0O1xuXHRcdFx0dmFyIGZvb3Rlcjtcblx0XHRcdHZhciBmb3JtX3RhcmdldDtcblx0XHRcdHZhciBob3N0O1xuXHRcdFx0dmFyIGxvYWRpbmc7XG5cdFx0XHR2YXIgZW1wdHk7XG5cblx0XHRcdGlmICggWyAnZW1wdHknLCAnbG9hZGluZycsICdlcnJvcicsICdmb3JtJyBdLmluZGV4T2YoIHN0YXRlICkgPCAwIHx8ICEgbW91bnQoKSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRob3N0ID0gZ2V0X2hvc3QoKTtcblx0XHRcdGZvb3RlciA9IGdldF9mb290ZXIoKTtcblx0XHRcdGVtcHR5ID0gaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1lbXB0eV0nICk7XG5cdFx0XHRsb2FkaW5nID0gaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1sb2FkaW5nXScgKTtcblx0XHRcdGVycm9yID0gaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1lcnJvcl0nICk7XG5cdFx0XHRmb3JtX3RhcmdldCA9IGhvc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbnNwZWN0b3ItZm9ybV0nICk7XG5cblx0XHRcdGlmICggZW1wdHkgKSB7IGVtcHR5LmhpZGRlbiA9ICdlbXB0eScgIT09IHN0YXRlOyB9XG5cdFx0XHRpZiAoIGxvYWRpbmcgKSB7IGxvYWRpbmcuaGlkZGVuID0gJ2xvYWRpbmcnICE9PSBzdGF0ZTsgfVxuXHRcdFx0aWYgKCBlcnJvciApIHtcblx0XHRcdFx0ZXJyb3IuaGlkZGVuID0gJ2Vycm9yJyAhPT0gc3RhdGU7XG5cdFx0XHRcdGVycm9yX3RleHQgPSBlcnJvci5xdWVyeVNlbGVjdG9yKCAncCcgKTtcblx0XHRcdFx0aWYgKCBlcnJvcl90ZXh0ICkgeyBlcnJvcl90ZXh0LnRleHRDb250ZW50ID0gU3RyaW5nKCBtZXNzYWdlIHx8ICcnICk7IH1cblx0XHRcdH1cblx0XHRcdGlmICggZm9ybV90YXJnZXQgJiYgJ2Zvcm0nICE9PSBzdGF0ZSApIHsgZm9ybV90YXJnZXQuaW5uZXJIVE1MID0gJyc7IH1cblx0XHRcdGlmICggZm9vdGVyICkgeyBmb290ZXIuaGlkZGVuID0gJ2Zvcm0nICE9PSBzdGF0ZTsgfVxuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBFeHBhbmQgdGhlIGNvbmZpZ3VyZWQgbmF0aXZlIHNpZGViYXIgYm91bmRhcnkuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGV4cGFuZCgpIHtcblx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIG9wdGlvbnMuZXhwYW5kICkge1xuXHRcdFx0XHRvcHRpb25zLmV4cGFuZCgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE1vdW50LCByZXZlYWwgbG9hZGluZyBzdGF0ZSwgYW5kIGltbWVkaWF0ZWx5IGV4cGFuZCB0aGUgaW5zcGVjdG9yLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBsb2FkaW5nIHN0YXRlIHdhcyBvcGVuZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gb3Blbl9sb2FkaW5nKCkge1xuXHRcdFx0aWYgKCAhIHNldF9zdGF0ZSggJ2xvYWRpbmcnLCAnJyApICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRleHBhbmQoKTtcblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBzaGVsbCBmb3JtIHRhcmdldCB1c2VkIGJ5IGRvbWFpbi1vd25lZCB0ZW1wbGF0ZXMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtFbGVtZW50fG51bGx9IEZvcm0gdGFyZ2V0IG9yIG51bGwgd2hlbiBtb3VudGluZyBmYWlsZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X2Zvcm1fdGFyZ2V0KCkge1xuXHRcdFx0dmFyIGhvc3QgPSBtb3VudCgpID8gZ2V0X2hvc3QoKSA6IG51bGw7XG5cblx0XHRcdHJldHVybiBob3N0ID8gaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1mb3JtXScgKSA6IG51bGw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGV4cGFuZDogZXhwYW5kLFxuXHRcdFx0Z2V0X2Zvcm1fdGFyZ2V0OiBnZXRfZm9ybV90YXJnZXQsXG5cdFx0XHRtb3VudDogbW91bnQsXG5cdFx0XHRvcGVuX2xvYWRpbmc6IG9wZW5fbG9hZGluZyxcblx0XHRcdHNldF9zdGF0ZTogc2V0X3N0YXRlXG5cdFx0fTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGUgYSBkb21haW4tbmV1dHJhbCBpbmxpbmUtZWRpdGluZyB3b3JrZmxvdyBjb250cm9sbGVyLlxuXHQgKlxuXHQgKiBEb21haW5zIHJldGFpbiBvd25lcnNoaXAgb2YgZWRpdGFibGUgZmllbGRzLCBkcmFmdCB2YWx1ZXMsIGF1dGhvcml6YXRpb24sXG5cdCAqIHJldmlldyBwYXlsb2FkcywgYW5kIG11dGF0aW9ucy4gVGhpcyBjb250cm9sbGVyIG9ubHkgc3luY2hyb25pemVzIHRoZVxuXHQgKiByZXBlYXRlZCBjYXRhbG9nIG1lY2hhbmljcyBhcm91bmQgYW4gYWN0aXZlIGlubGluZSB3b3JrZmxvdzogc3RpY2t5LWJhclxuXHQgKiByZWdpc3RyYXRpb24sIGJ1c3kgY29udHJvbHMsIG5hdmlnYXRpb24gbG9ja2luZywgY2hhbmdlZC1yb3cgcHJlc2VudGF0aW9uLFxuXHQgKiBhbmQgdGhlIHNoYXJlZCBhY3RpdmUtc3RhdGUgY2xhc3Nlcy5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxzdHJpbmd9IGNhdGFsb2dfbW91bnQgQ2F0YWxvZyBtb3VudCBlbGVtZW50IG9yIGl0cyBJRC5cblx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgICAgICAgIHNldHRpbmdzICAgICAgRG9tYWluIHNlbGVjdG9ycyBhbmQgcGFnZSBlbGVtZW50LlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8ZmFsc2V9IElubGluZSB3b3JrZmxvdyBjb250cm9sbGVyIG9yIGZhbHNlIHdoZW4gdW5hdmFpbGFibGUuXG5cdCAqL1xuXHRmdW5jdGlvbiBjcmVhdGVfaW5saW5lX2VkaXRpbmdfd29ya2Zsb3coIGNhdGFsb2dfbW91bnQsIHNldHRpbmdzICkge1xuXHRcdHZhciBvcHRpb25zO1xuXHRcdHZhciBtb3VudF9lbGVtZW50ID0gJ3N0cmluZycgPT09IHR5cGVvZiBjYXRhbG9nX21vdW50ID8gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIGNhdGFsb2dfbW91bnQgKSA6IGNhdGFsb2dfbW91bnQ7XG5cdFx0dmFyIGRlZmF1bHRfcHJvdGVjdGVkX3NlbGVjdG9yID0gW1xuXHRcdFx0J1tkYXRhLXdwYmMtdWktY2F0YWxvZy12aWV3XScsXG5cdFx0XHQnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXRlbXBsYXRlLXBhY2tdJyxcblx0XHRcdCdbZGF0YS13cGJjLXVpLWNhdGFsb2ctZGlzcGxheS1jdXN0b21pemVyXSBzdW1tYXJ5Jyxcblx0XHRcdCdbZGF0YS13cGJjLXVpLWNhdGFsb2ctc2VhcmNoXScsXG5cdFx0XHQnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWZpbHRlcl0nLFxuXHRcdFx0J1tkYXRhLXdwYmMtdWktY2F0YWxvZy1zZWxlY3QtaXRlbV0nLFxuXHRcdFx0J1tkYXRhLXdwYmMtdWktY2F0YWxvZy1zZWxlY3QtYWxsXScsXG5cdFx0XHQnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXNvcnRdJyxcblx0XHRcdCdbZGF0YS13cGJjLXVpLWNhdGFsb2ctcGFnZV0nLFxuXHRcdFx0J1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pdGVtcy1wZXItcGFnZV0nLFxuXHRcdFx0J1tkYXRhLXdwYmMtdWktY2F0YWxvZy1jb2x1bW4tdmlzaWJsZV0nLFxuXHRcdFx0J1tkYXRhLXdwYmMtdWktY2F0YWxvZy1jb2x1bW4tb3JkZXItcmVzZXRdJyxcblx0XHRcdCdbZGF0YS13cGJjLXVpLWNhdGFsb2ctcHJlZmVyZW5jZXMtcmVzZXRdJ1xuXHRcdF0uam9pbiggJywgJyApO1xuXG5cdFx0aWYgKCAhIG1vdW50X2VsZW1lbnQgfHwgISBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0b3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oIHtcblx0XHRcdGJhcl9zZWxlY3RvcjogJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbmxpbmUtYmFyXScsXG5cdFx0XHRjYW5jZWxfc2VsZWN0b3I6ICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5saW5lLWNhbmNlbF0nLFxuXHRcdFx0Y29udHJvbHNfcm9vdDogbW91bnRfZWxlbWVudCxcblx0XHRcdGNvdW50X3NlbGVjdG9yOiAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWlubGluZS1jb3VudF0nLFxuXHRcdFx0cGFnZV9lbGVtZW50OiBtb3VudF9lbGVtZW50LFxuXHRcdFx0cHJvdGVjdGVkX3NlbGVjdG9yOiAnJyxcblx0XHRcdHJldmlld19zZWxlY3RvcjogJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbmxpbmUtcmV2aWV3XScsXG5cdFx0XHR0b2dnbGVfbGFiZWxfc2VsZWN0b3I6ICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5saW5lLXRvZ2dsZS1sYWJlbF0nLFxuXHRcdFx0dG9nZ2xlX3NlbGVjdG9yOiAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWlubGluZS10b2dnbGVdJ1xuXHRcdH0sIHNldHRpbmdzIHx8IHt9ICk7XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gdGhlIGNvbmZpZ3VyZWQgcGFnZSBlbGVtZW50IHdpdGhvdXQgZXNjYXBpbmcgdGhlIGNhdGFsb2cgbW91bnQuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtIVE1MRWxlbWVudHxudWxsfSBDb25maWd1cmVkIHBhZ2Ugcm9vdCwgbW91bnQsIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3BhZ2VfZWxlbWVudCgpIHtcblx0XHRcdGlmICggb3B0aW9ucy5wYWdlX2VsZW1lbnQgJiYgb3B0aW9ucy5wYWdlX2VsZW1lbnQubm9kZVR5cGUgKSB7XG5cdFx0XHRcdHJldHVybiBvcHRpb25zLnBhZ2VfZWxlbWVudDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuICdzdHJpbmcnID09PSB0eXBlb2Ygb3B0aW9ucy5wYWdlX2VsZW1lbnRcblx0XHRcdFx0PyBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoIG9wdGlvbnMucGFnZV9lbGVtZW50IClcblx0XHRcdFx0OiBtb3VudF9lbGVtZW50O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiB0aGUgY29tcGxldGUgc2VsZWN0b3IgZm9yIGNvbnRyb2xzIGxvY2tlZCBieSBhY3RpdmUgZHJhZnRzLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfSBTaGFyZWQgc2VsZWN0b3JzIHBsdXMgdGhlIHRydXN0ZWQgZG9tYWluIGV4dGVuc2lvbi5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfcHJvdGVjdGVkX3NlbGVjdG9yKCkge1xuXHRcdFx0cmV0dXJuIG9wdGlvbnMucHJvdGVjdGVkX3NlbGVjdG9yXG5cdFx0XHRcdD8gZGVmYXVsdF9wcm90ZWN0ZWRfc2VsZWN0b3IgKyAnLCAnICsgb3B0aW9ucy5wcm90ZWN0ZWRfc2VsZWN0b3Jcblx0XHRcdFx0OiBkZWZhdWx0X3Byb3RlY3RlZF9zZWxlY3Rvcjtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBQcmVzZXJ2ZSBhbmQgcmVzdG9yZSBhIGNvbnRyb2wncyBwcmUtd29ya2Zsb3cgZGlzYWJsZWQgc3RhdGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBjb250cm9sICAgICAgICAgQ2F0YWxvZyBjb250cm9sIHRvIHN5bmNocm9uaXplLlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gICAgIGNvbnRyb2xzX2xvY2tlZCBXaGV0aGVyIGlubGluZSBuYXZpZ2F0aW9uIGlzIGxvY2tlZC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHN5bmNocm9uaXplX3Byb3RlY3RlZF9jb250cm9sKCBjb250cm9sLCBjb250cm9sc19sb2NrZWQgKSB7XG5cdFx0XHR2YXIgcHJpb3JfZGlzYWJsZWQ7XG5cblx0XHRcdGlmICggY29udHJvbHNfbG9ja2VkICkge1xuXHRcdFx0XHRpZiAoICEgY29udHJvbC5oYXNBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdWktY2F0YWxvZy1pbmxpbmUtd2FzLWRpc2FibGVkJyApICkge1xuXHRcdFx0XHRcdGNvbnRyb2wuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5saW5lLXdhcy1kaXNhYmxlZCcsIGNvbnRyb2wuZGlzYWJsZWQgPyAnMScgOiAnMCcgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb250cm9sLmRpc2FibGVkID0gdHJ1ZTtcblx0XHRcdFx0Y29udHJvbC5zZXRBdHRyaWJ1dGUoICdhcmlhLWRpc2FibGVkJywgJ3RydWUnICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCAhIGNvbnRyb2wuaGFzQXR0cmlidXRlKCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5saW5lLXdhcy1kaXNhYmxlZCcgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cHJpb3JfZGlzYWJsZWQgPSAnMScgPT09IGNvbnRyb2wuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5saW5lLXdhcy1kaXNhYmxlZCcgKTtcblx0XHRcdGNvbnRyb2wuZGlzYWJsZWQgPSBwcmlvcl9kaXNhYmxlZDtcblx0XHRcdGNvbnRyb2wucmVtb3ZlQXR0cmlidXRlKCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5saW5lLXdhcy1kaXNhYmxlZCcgKTtcblx0XHRcdGlmICggISBwcmlvcl9kaXNhYmxlZCApIHtcblx0XHRcdFx0Y29udHJvbC5yZW1vdmVBdHRyaWJ1dGUoICdhcmlhLWRpc2FibGVkJyApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlZ2lzdGVyIHRoZSBjdXJyZW50IGlubGluZSBiYXIgd2l0aCB0aGUgc2hhcmVkIHZpZXdwb3J0IGNvbnRyb2xsZXIuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlZ2lzdGVyX3N0aWNreV9iYXIoKSB7XG5cdFx0XHR2YXIgaW5saW5lX2JhciA9IG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3Rvciggb3B0aW9ucy5iYXJfc2VsZWN0b3IgKTtcblx0XHRcdHZhciBzZWxlY3Rpb25fY29udHJvbGxlciA9IG1vdW50X2VsZW1lbnQuX3dwYmNfdWlfY2F0YWxvZ19zZWxlY3Rpb25fY29udHJvbGxlcjtcblxuXHRcdFx0aWYgKCBpbmxpbmVfYmFyICYmIHNlbGVjdGlvbl9jb250cm9sbGVyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBzZWxlY3Rpb25fY29udHJvbGxlci5yZWdpc3Rlcl92aWV3cG9ydF9zdGlja3kgKSB7XG5cdFx0XHRcdHNlbGVjdGlvbl9jb250cm9sbGVyLnJlZ2lzdGVyX3ZpZXdwb3J0X3N0aWNreSggaW5saW5lX2JhciApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbW92ZSBzaGFyZWQgY2hhbmdlZC1yb3cgcHJlc2VudGF0aW9uIGFmdGVyIGlubGluZSBtb2RlIGVuZHMuXG5cdFx0ICpcblx0XHQgKiBEb21haW4gZHJhZnRzIGFuZCB2YWx1ZXMgcmVtYWluIGRvbWFpbi1vd25lZC4gVGhpcyBjbGVhbnVwIHJlbW92ZXMgb25seVxuXHRcdCAqIHRoZSBzaGFyZWQgY2xhc3MgYW5kIGJhZGdlIHRoYXQgdGhpcyBjb250cm9sbGVyIHByZXZpb3VzbHkgYXBwbGllZC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY2xlYXJfY2hhbmdlZF9yb3dzKCkge1xuXHRcdFx0bW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfdWlfY2F0YWxvZ19pbmxpbmVfcm93LmlzLWlubGluZS1jaGFuZ2VkJyApLmZvckVhY2goIGZ1bmN0aW9uICggcm93X2VsZW1lbnQgKSB7XG5cdFx0XHRcdHNldF9yb3dfY2hhbmdlZCggcm93X2VsZW1lbnQsIGZhbHNlLCBudWxsLCAnJyApO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFN5bmNocm9uaXplIHNoYXJlZCBpbmxpbmUgd29ya2Zsb3cgcHJlc2VudGF0aW9uIGZyb20gZG9tYWluLW93bmVkIHN0YXRlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHdvcmtmbG93X3N0YXRlIE5vcm1hbGl6ZWQgYWN0aXZlLCBidXN5LCBjb3VudCwgYW5kIGxhYmVscy5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHN5bmNocm9uaXplKCB3b3JrZmxvd19zdGF0ZSApIHtcblx0XHRcdHZhciBhY3RpdmU7XG5cdFx0XHR2YXIgYnVzeTtcblx0XHRcdHZhciBjb250cm9sc19yb290O1xuXHRcdFx0dmFyIGNvbnRyb2xzX2xvY2tlZDtcblx0XHRcdHZhciBpbmxpbmVfYmFyO1xuXHRcdFx0dmFyIHBhZ2VfZWxlbWVudDtcblx0XHRcdHZhciB0b2dnbGVfYnV0dG9uO1xuXHRcdFx0dmFyIHRvZ2dsZV9sYWJlbDtcblxuXHRcdFx0d29ya2Zsb3dfc3RhdGUgPSB3b3JrZmxvd19zdGF0ZSB8fCB7fTtcblx0XHRcdGFjdGl2ZSA9IHRydWUgPT09IHdvcmtmbG93X3N0YXRlLmFjdGl2ZTtcblx0XHRcdGJ1c3kgPSB0cnVlID09PSB3b3JrZmxvd19zdGF0ZS5idXN5O1xuXHRcdFx0Y29udHJvbHNfcm9vdCA9IG9wdGlvbnMuY29udHJvbHNfcm9vdCAmJiBvcHRpb25zLmNvbnRyb2xzX3Jvb3QucXVlcnlTZWxlY3RvckFsbCA/IG9wdGlvbnMuY29udHJvbHNfcm9vdCA6IG1vdW50X2VsZW1lbnQ7XG5cdFx0XHRjb250cm9sc19sb2NrZWQgPSBhY3RpdmUgfHwgdHJ1ZSA9PT0gd29ya2Zsb3dfc3RhdGUubG9ja19jb250cm9scztcblx0XHRcdGlubGluZV9iYXIgPSBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoIG9wdGlvbnMuYmFyX3NlbGVjdG9yICk7XG5cdFx0XHRwYWdlX2VsZW1lbnQgPSBnZXRfcGFnZV9lbGVtZW50KCk7XG5cdFx0XHR0b2dnbGVfYnV0dG9uID0gbW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCBvcHRpb25zLnRvZ2dsZV9zZWxlY3RvciApO1xuXG5cdFx0XHRpZiAoIGlubGluZV9iYXIgKSB7XG5cdFx0XHRcdGlubGluZV9iYXIuaGlkZGVuID0gISBhY3RpdmU7XG5cdFx0XHRcdGlubGluZV9iYXIuc2V0QXR0cmlidXRlKCAnYXJpYS1idXN5JywgYnVzeSA/ICd0cnVlJyA6ICdmYWxzZScgKTtcblx0XHRcdFx0aWYgKCBpbmxpbmVfYmFyLnF1ZXJ5U2VsZWN0b3IoIG9wdGlvbnMuY291bnRfc2VsZWN0b3IgKSApIHtcblx0XHRcdFx0XHRpbmxpbmVfYmFyLnF1ZXJ5U2VsZWN0b3IoIG9wdGlvbnMuY291bnRfc2VsZWN0b3IgKS50ZXh0Q29udGVudCA9IFN0cmluZyggd29ya2Zsb3dfc3RhdGUuY291bnRfdGV4dCB8fCAnJyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggaW5saW5lX2Jhci5xdWVyeVNlbGVjdG9yKCBvcHRpb25zLnJldmlld19zZWxlY3RvciApICkge1xuXHRcdFx0XHRcdGlubGluZV9iYXIucXVlcnlTZWxlY3Rvciggb3B0aW9ucy5yZXZpZXdfc2VsZWN0b3IgKS5kaXNhYmxlZCA9IGJ1c3kgfHwgISBOdW1iZXIoIHdvcmtmbG93X3N0YXRlLmNoYW5nZWRfY291bnQgfHwgMCApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggaW5saW5lX2Jhci5xdWVyeVNlbGVjdG9yKCBvcHRpb25zLmNhbmNlbF9zZWxlY3RvciApICkge1xuXHRcdFx0XHRcdGlubGluZV9iYXIucXVlcnlTZWxlY3Rvciggb3B0aW9ucy5jYW5jZWxfc2VsZWN0b3IgKS5kaXNhYmxlZCA9IGJ1c3k7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKCB0b2dnbGVfYnV0dG9uICkge1xuXHRcdFx0XHR0b2dnbGVfYnV0dG9uLmNsYXNzTGlzdC50b2dnbGUoICdpcy1hY3RpdmUnLCBhY3RpdmUgKTtcblx0XHRcdFx0dG9nZ2xlX2J1dHRvbi5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtYnVzeScsIGJ1c3kgKTtcblx0XHRcdFx0dG9nZ2xlX2J1dHRvbi5kaXNhYmxlZCA9IGJ1c3lcblx0XHRcdFx0XHR8fCB0cnVlID09PSB3b3JrZmxvd19zdGF0ZS50b2dnbGVfZGlzYWJsZWRcblx0XHRcdFx0XHR8fCAoICEgYWN0aXZlICYmIGZhbHNlID09PSB3b3JrZmxvd19zdGF0ZS5oYXNfaXRlbXMgKTtcblx0XHRcdFx0dG9nZ2xlX2J1dHRvbi5zZXRBdHRyaWJ1dGUoICdhcmlhLXByZXNzZWQnLCBhY3RpdmUgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0XHRcdHRvZ2dsZV9idXR0b24uc2V0QXR0cmlidXRlKCAnYXJpYS1idXN5JywgYnVzeSA/ICd0cnVlJyA6ICdmYWxzZScgKTtcblx0XHRcdFx0dG9nZ2xlX2xhYmVsID0gdG9nZ2xlX2J1dHRvbi5xdWVyeVNlbGVjdG9yKCBvcHRpb25zLnRvZ2dsZV9sYWJlbF9zZWxlY3RvciApO1xuXHRcdFx0XHRpZiAoIHRvZ2dsZV9sYWJlbCApIHtcblx0XHRcdFx0XHR0b2dnbGVfbGFiZWwudGV4dENvbnRlbnQgPSBhY3RpdmVcblx0XHRcdFx0XHRcdD8gU3RyaW5nKCB3b3JrZmxvd19zdGF0ZS5hY3RpdmVfdG9nZ2xlX3RleHQgfHwgJycgKVxuXHRcdFx0XHRcdFx0OiBTdHJpbmcoIHdvcmtmbG93X3N0YXRlLmluYWN0aXZlX3RvZ2dsZV90ZXh0IHx8ICcnICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKCBwYWdlX2VsZW1lbnQgKSB7XG5cdFx0XHRcdHBhZ2VfZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtaW5saW5lLWVkaXRpbmcnLCBhY3RpdmUgKTtcblx0XHRcdH1cblx0XHRcdGlmICggISBhY3RpdmUgKSB7XG5cdFx0XHRcdGNsZWFyX2NoYW5nZWRfcm93cygpO1xuXHRcdFx0fVxuXHRcdFx0Y29udHJvbHNfcm9vdC5xdWVyeVNlbGVjdG9yQWxsKCBnZXRfcHJvdGVjdGVkX3NlbGVjdG9yKCkgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGNvbnRyb2wgKSB7XG5cdFx0XHRcdHN5bmNocm9uaXplX3Byb3RlY3RlZF9jb250cm9sKCBjb250cm9sLCBjb250cm9sc19sb2NrZWQgKTtcblx0XHRcdH0gKTtcblx0XHRcdHJlZ2lzdGVyX3N0aWNreV9iYXIoKTtcblx0XHRcdGlmIChcblx0XHRcdFx0bW91bnRfZWxlbWVudC5fd3BiY191aV9jYXRhbG9nX3NlbGVjdGlvbl9jb250cm9sbGVyXG5cdFx0XHRcdCYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBtb3VudF9lbGVtZW50Ll93cGJjX3VpX2NhdGFsb2dfc2VsZWN0aW9uX2NvbnRyb2xsZXIucmVmcmVzaF92aWV3cG9ydF9zdGlja3lcblx0XHRcdCkge1xuXHRcdFx0XHRtb3VudF9lbGVtZW50Ll93cGJjX3VpX2NhdGFsb2dfc2VsZWN0aW9uX2NvbnRyb2xsZXIucmVmcmVzaF92aWV3cG9ydF9zdGlja3koKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBCbG9jayBhIGNhcHR1cmVkIGV2ZW50IHRoYXQgdGFyZ2V0cyBhIGNvbnRyb2wgcHJvdGVjdGVkIGJ5IGFjdGl2ZSBkcmFmdHMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0V2ZW50fSAgIGV2ZW50ICAgICAgICAgICBDYXB0dXJlZCBicm93c2VyIGV2ZW50LlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gY29udHJvbHNfbG9ja2VkIFdoZXRoZXIgdGhlIGRvbWFpbiB3b3JrZmxvdyBpcyBhY3RpdmUuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBldmVudCB3YXMgYmxvY2tlZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBwcm90ZWN0X2V2ZW50KCBldmVudCwgY29udHJvbHNfbG9ja2VkICkge1xuXHRcdFx0aWYgKCAhIGNvbnRyb2xzX2xvY2tlZCB8fCAhIGV2ZW50LnRhcmdldCB8fCAhIGV2ZW50LnRhcmdldC5jbG9zZXN0ICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgZXZlbnQudGFyZ2V0LmNsb3Nlc3QoIGdldF9wcm90ZWN0ZWRfc2VsZWN0b3IoKSApICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFN5bmNocm9uaXplIG9uZSBjaGFuZ2VkIHJvdyBhbmQgaXRzIGFjY2Vzc2libGUgdGV4dCBiYWRnZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJvd19lbGVtZW50ICAgICAgIERvbWFpbiByb3cgb3IgY2FyZCBlbGVtZW50LlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gICAgIGNoYW5nZWQgICAgICAgICAgIFdoZXRoZXIgaXRzIGRyYWZ0IGRpZmZlcnMuXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gaW5kaWNhdG9yX2VsZW1lbnQgQmFja3dhcmQtY29tcGF0aWJsZSBmYWxsYmFjayBiYWRnZSBob3N0LlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgICAgIGNoYW5nZWRfbGFiZWwgICAgIExvY2FsaXplZCBiYWRnZSB0ZXh0LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2V0X3Jvd19jaGFuZ2VkKCByb3dfZWxlbWVudCwgY2hhbmdlZCwgaW5kaWNhdG9yX2VsZW1lbnQsIGNoYW5nZWRfbGFiZWwgKSB7XG5cdFx0XHR2YXIgaW5kaWNhdG9yO1xuXHRcdFx0dmFyIHByZWZlcnJlZF9pbmRpY2F0b3JfaG9zdDtcblxuXHRcdFx0aWYgKCAhIHJvd19lbGVtZW50ICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRyb3dfZWxlbWVudC5jbGFzc0xpc3QuYWRkKCAnd3BiY191aV9jYXRhbG9nX2lubGluZV9yb3cnICk7XG5cdFx0XHRyb3dfZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtaW5saW5lLWNoYW5nZWQnLCAhISBjaGFuZ2VkICk7XG5cdFx0XHRwcmVmZXJyZWRfaW5kaWNhdG9yX2hvc3QgPSByb3dfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWlubGluZS1jaGFuZ2VkLWhvc3RdJyApO1xuXHRcdFx0aW5kaWNhdG9yID0gcm93X2VsZW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbmxpbmUtY2hhbmdlZC1sYWJlbF0nICk7XG5cdFx0XHRpZiAoICEgY2hhbmdlZCApIHtcblx0XHRcdFx0aWYgKCBpbmRpY2F0b3IgKSB7XG5cdFx0XHRcdFx0aW5kaWNhdG9yLnJlbW92ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggaW5kaWNhdG9yICYmIHByZWZlcnJlZF9pbmRpY2F0b3JfaG9zdCAmJiBpbmRpY2F0b3IucGFyZW50RWxlbWVudCAhPT0gcHJlZmVycmVkX2luZGljYXRvcl9ob3N0ICkge1xuXHRcdFx0XHRwcmVmZXJyZWRfaW5kaWNhdG9yX2hvc3QuaW5zZXJ0QmVmb3JlKCBpbmRpY2F0b3IsIHByZWZlcnJlZF9pbmRpY2F0b3JfaG9zdC5maXJzdENoaWxkICk7XG5cdFx0XHR9XG5cdFx0XHRpbmRpY2F0b3JfZWxlbWVudCA9IHByZWZlcnJlZF9pbmRpY2F0b3JfaG9zdCB8fCBpbmRpY2F0b3JfZWxlbWVudDtcblx0XHRcdGlmICggISBpbmRpY2F0b3IgJiYgaW5kaWNhdG9yX2VsZW1lbnQgKSB7XG5cdFx0XHRcdGluZGljYXRvciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdzcGFuJyApO1xuXHRcdFx0XHRpbmRpY2F0b3IuY2xhc3NOYW1lID0gJ3dwYmNfdWlfY2F0YWxvZ19pbmxpbmVfY2hhbmdlZF9sYWJlbCc7XG5cdFx0XHRcdGluZGljYXRvci5zZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdWktY2F0YWxvZy1pbmxpbmUtY2hhbmdlZC1sYWJlbCcsICcnICk7XG5cdFx0XHRcdGlmICggcHJlZmVycmVkX2luZGljYXRvcl9ob3N0ICkge1xuXHRcdFx0XHRcdHByZWZlcnJlZF9pbmRpY2F0b3JfaG9zdC5pbnNlcnRCZWZvcmUoIGluZGljYXRvciwgcHJlZmVycmVkX2luZGljYXRvcl9ob3N0LmZpcnN0Q2hpbGQgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpbmRpY2F0b3JfZWxlbWVudC5hcHBlbmRDaGlsZCggaW5kaWNhdG9yICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggaW5kaWNhdG9yICkge1xuXHRcdFx0XHRpbmRpY2F0b3IudGV4dENvbnRlbnQgPSBTdHJpbmcoIGNoYW5nZWRfbGFiZWwgfHwgJycgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0cHJvdGVjdF9ldmVudDogcHJvdGVjdF9ldmVudCxcblx0XHRcdHJlZ2lzdGVyX3N0aWNreV9iYXI6IHJlZ2lzdGVyX3N0aWNreV9iYXIsXG5cdFx0XHRzZXRfcm93X2NoYW5nZWQ6IHNldF9yb3dfY2hhbmdlZCxcblx0XHRcdHN5bmNocm9uaXplOiBzeW5jaHJvbml6ZVxuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogQ3JlYXRlIGEgZG9tYWluLW5ldXRyYWwgc2lnbmVkLXJldmlldyBwcmVzZW50YXRpb24gY29udHJvbGxlci5cblx0ICpcblx0ICogRG9tYWlucyBvd24gcHJldmlldyBhbmQgYXBwbHkgcmVxdWVzdHMsIHNpZ25lZCBwbGFucywgcGVybWlzc2lvbnMsIGZpZWxkXG5cdCAqIHZhbGlkYXRpb24sIGFuZCBtdXRhdGlvbnMuIFRoaXMgY29udHJvbGxlciBhY2NlcHRzIG9ubHkgdGhlIG5vcm1hbGl6ZWRcblx0ICogcmV2aWV3IERUTyBhbmQgb3ducyB0aGUgcmVwZWF0ZWQgbW9kZWwgcHJlcGFyYXRpb24gYW5kIGJ1c3ktc3RhdGUgbG9ja2luZy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IHNldHRpbmdzIERPTSByb290cyBhbmQgZG9tYWluIGJ1dHRvbiBzZWxlY3RvcnMuXG5cdCAqIEByZXR1cm4ge09iamVjdH0gUmV2aWV3IHByZXNlbnRhdGlvbiBjb250cm9sbGVyLlxuXHQgKi9cblx0ZnVuY3Rpb24gY3JlYXRlX2lubGluZV9yZXZpZXdfd29ya2Zsb3coIHNldHRpbmdzICkge1xuXHRcdHZhciBvcHRpb25zID0gT2JqZWN0LmFzc2lnbigge1xuXHRcdFx0YXBwbHlfc2VsZWN0b3I6ICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5saW5lLXJldmlldy1hcHBseV0nLFxuXHRcdFx0Y2FuY2VsX3NlbGVjdG9yOiAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWlubGluZS1yZXZpZXctY2FuY2VsXScsXG5cdFx0XHRyb290OiBkb2N1bWVudFxuXHRcdH0sIHNldHRpbmdzIHx8IHt9ICk7XG5cblx0XHQvKipcblx0XHQgKiBOb3JtYWxpemUgb25lIHNlcnZlci1hdXRob3JpdGF0aXZlIHJldmlldyBEVE8gZm9yIGEgZG9tYWluIHRlbXBsYXRlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHJldmlldyAgICAgICBTZXJ2ZXIgcmV2aWV3IHdpdGggcm93cyBhbmQgZmllbGQgY2hhbmdlcy5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcHJlc2VudGF0aW9uIExvY2FsaXplZCBoZWFkaW5ncyBhbmQgZXhwbGFuYXRvcnkgdGV4dC5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IEV4ZWN1dGFibGUtZnJlZSB0ZW1wbGF0ZSBtb2RlbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBwcmVwYXJlKCByZXZpZXcsIHByZXNlbnRhdGlvbiApIHtcblx0XHRcdHZhciBub3JtYWxpemVkX3Jvd3MgPSBbXTtcblxuXHRcdFx0cmV2aWV3ID0gcmV2aWV3ICYmICdvYmplY3QnID09PSB0eXBlb2YgcmV2aWV3ID8gcmV2aWV3IDoge307XG5cdFx0XHRwcmVzZW50YXRpb24gPSBwcmVzZW50YXRpb24gJiYgJ29iamVjdCcgPT09IHR5cGVvZiBwcmVzZW50YXRpb24gPyBwcmVzZW50YXRpb24gOiB7fTtcblx0XHRcdCggQXJyYXkuaXNBcnJheSggcmV2aWV3LnJvd3MgKSA/IHJldmlldy5yb3dzIDogW10gKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHJvdyApIHtcblx0XHRcdFx0dmFyIG5vcm1hbGl6ZWRfZmllbGRzID0gW107XG5cdFx0XHRcdHZhciBub3JtYWxpemVkX25vdGVzID0gW107XG5cblx0XHRcdFx0aWYgKCAhIHJvdyB8fCAnb2JqZWN0JyAhPT0gdHlwZW9mIHJvdyApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0KCBBcnJheS5pc0FycmF5KCByb3cuZmllbGRzICkgPyByb3cuZmllbGRzIDogW10gKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGZpZWxkICkge1xuXHRcdFx0XHRcdGlmICggISBmaWVsZCB8fCAnb2JqZWN0JyAhPT0gdHlwZW9mIGZpZWxkICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRub3JtYWxpemVkX2ZpZWxkcy5wdXNoKCB7XG5cdFx0XHRcdFx0XHRhZnRlcjogU3RyaW5nKCB1bmRlZmluZWQgPT09IGZpZWxkLmFmdGVyID8gJycgOiBmaWVsZC5hZnRlciApLFxuXHRcdFx0XHRcdFx0YmVmb3JlOiBTdHJpbmcoIHVuZGVmaW5lZCA9PT0gZmllbGQuYmVmb3JlID8gJycgOiBmaWVsZC5iZWZvcmUgKSxcblx0XHRcdFx0XHRcdGtleTogU3RyaW5nKCBmaWVsZC5rZXkgfHwgJycgKSxcblx0XHRcdFx0XHRcdGxhYmVsOiBTdHJpbmcoIGZpZWxkLmxhYmVsIHx8IGZpZWxkLmtleSB8fCAnJyApXG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdCggQXJyYXkuaXNBcnJheSggcm93Lm5vdGVzICkgPyByb3cubm90ZXMgOiBbXSApLmZvckVhY2goIGZ1bmN0aW9uICggbm90ZSApIHtcblx0XHRcdFx0XHRpZiAoICdzdHJpbmcnID09PSB0eXBlb2Ygbm90ZSB8fCAnbnVtYmVyJyA9PT0gdHlwZW9mIG5vdGUgKSB7XG5cdFx0XHRcdFx0XHRub3JtYWxpemVkX25vdGVzLnB1c2goIFN0cmluZyggbm90ZSApICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdGlmICggbm9ybWFsaXplZF9maWVsZHMubGVuZ3RoICkge1xuXHRcdFx0XHRcdG5vcm1hbGl6ZWRfcm93cy5wdXNoKCB7XG5cdFx0XHRcdFx0XHRmaWVsZHM6IG5vcm1hbGl6ZWRfZmllbGRzLFxuXHRcdFx0XHRcdFx0aWQ6IE51bWJlciggcm93LmlkIHx8IDAgKSxcblx0XHRcdFx0XHRcdG5vdGVzOiBub3JtYWxpemVkX25vdGVzLFxuXHRcdFx0XHRcdFx0dGl0bGU6IFN0cmluZyggcm93LnRpdGxlIHx8ICcnIClcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0Y2hhbmdlZF9sYWJlbDogU3RyaW5nKCBwcmVzZW50YXRpb24uY2hhbmdlZF9sYWJlbCB8fCAnJyApLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogU3RyaW5nKCBwcmVzZW50YXRpb24uZGVzY3JpcHRpb24gfHwgJycgKSxcblx0XHRcdFx0Zm9ybV9pZDogU3RyaW5nKCBwcmVzZW50YXRpb24uZm9ybV9pZCB8fCAnJyApLFxuXHRcdFx0XHRtb2RlOiBTdHJpbmcoIHByZXNlbnRhdGlvbi5tb2RlIHx8ICdpbmxpbmVfcmV2aWV3JyApLFxuXHRcdFx0XHRwZW5kaW5nX21lc3NhZ2U6IFN0cmluZyggcHJlc2VudGF0aW9uLnBlbmRpbmdfbWVzc2FnZSB8fCAnJyApLFxuXHRcdFx0XHRyb3dzOiBub3JtYWxpemVkX3Jvd3MsXG5cdFx0XHRcdHRpdGxlOiBTdHJpbmcoIHByZXNlbnRhdGlvbi50aXRsZSB8fCAnJyApLFxuXHRcdFx0XHR3YXJuaW5nOiBTdHJpbmcoIHJldmlldy53YXJuaW5nIHx8IHByZXNlbnRhdGlvbi53YXJuaW5nIHx8ICcnIClcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTG9jayBvciB1bmxvY2sgcmV2aWV3IGFjdGlvbnMgd2hpbGUgYSBkb21haW4gcmVxdWVzdCBpcyBpbiBmbGlnaHQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcmV2aWV3X3N0YXRlIEJ1c3kgYW5kIGFwcGx5LXJlYWR5IGZsYWdzLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc3luY2hyb25pemUoIHJldmlld19zdGF0ZSApIHtcblx0XHRcdHZhciBidXN5O1xuXHRcdFx0dmFyIGNhbl9hcHBseTtcblx0XHRcdHZhciByb290ID0gb3B0aW9ucy5yb290ICYmIG9wdGlvbnMucm9vdC5xdWVyeVNlbGVjdG9yQWxsID8gb3B0aW9ucy5yb290IDogZG9jdW1lbnQ7XG5cblx0XHRcdHJldmlld19zdGF0ZSA9IHJldmlld19zdGF0ZSB8fCB7fTtcblx0XHRcdGJ1c3kgPSB0cnVlID09PSByZXZpZXdfc3RhdGUuYnVzeTtcblx0XHRcdGNhbl9hcHBseSA9IHRydWUgPT09IHJldmlld19zdGF0ZS5jYW5fYXBwbHk7XG5cdFx0XHRyb290LnF1ZXJ5U2VsZWN0b3JBbGwoIG9wdGlvbnMuYXBwbHlfc2VsZWN0b3IgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGNvbnRyb2wgKSB7XG5cdFx0XHRcdGNvbnRyb2wuZGlzYWJsZWQgPSBidXN5IHx8ICEgY2FuX2FwcGx5O1xuXHRcdFx0XHRjb250cm9sLmNsYXNzTGlzdC50b2dnbGUoICdpcy1idXN5JywgYnVzeSApO1xuXHRcdFx0XHRjb250cm9sLnNldEF0dHJpYnV0ZSggJ2FyaWEtYnVzeScsIGJ1c3kgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRyb290LnF1ZXJ5U2VsZWN0b3JBbGwoIG9wdGlvbnMuY2FuY2VsX3NlbGVjdG9yICkuZm9yRWFjaCggZnVuY3Rpb24gKCBjb250cm9sICkge1xuXHRcdFx0XHRjb250cm9sLmRpc2FibGVkID0gYnVzeTtcblx0XHRcdH0gKTtcblx0XHRcdHJvb3QucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbmxpbmUtcmV2aWV3LWZvcm1dJyApLmZvckVhY2goIGZ1bmN0aW9uICggZm9ybSApIHtcblx0XHRcdFx0Zm9ybS5zZXRBdHRyaWJ1dGUoICdhcmlhLWJ1c3knLCBidXN5ID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRwcmVwYXJlOiBwcmVwYXJlLFxuXHRcdFx0c3luY2hyb25pemU6IHN5bmNocm9uaXplXG5cdFx0fTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGUgYSBkb21haW4tbmV1dHJhbCBwZXJtYW5lbnQtZGVsZXRpb24gcmV2aWV3IGNvbnRyb2xsZXIuXG5cdCAqXG5cdCAqIERvbWFpbnMgcmVtYWluIHJlc3BvbnNpYmxlIGZvciBkZWNpZGluZyB3aGV0aGVyIGRlbGV0aW9uIGlzIGFsbG93ZWQsXG5cdCAqIHByb2R1Y2luZyB0aGUgc2lnbmVkIGltcGFjdCByZXZpZXcsIHJlbmRlcmluZyB0aGVpciBhbGxvdy1saXN0ZWQgdGVtcGxhdGUsXG5cdCAqIGFuZCBhcHBseWluZyB0aGUgbXV0YXRpb24uIFRoaXMgY29udHJvbGxlciBvd25zIG9ubHkgdGhlIHJlcGVhdGVkIGJyb3dzZXJcblx0ICogbWVjaGFuaWNzIGZvciBleHBsaWNpdCBhY2tub3dsZWRnZW1lbnQsIGRlc3RydWN0aXZlIGZvb3RlciBwcmVzZW50YXRpb24sXG5cdCAqIGJ1c3kgbG9ja2luZywgYW5kIHJlZHVjZWQtbW90aW9uLXNhZmUgYXR0ZW50aW9uIGZlZWRiYWNrLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gc2V0dGluZ3MgRE9NIHJvb3RzIGFuZCBkb21haW4gc2VsZWN0b3JzLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IERlbGV0aW9uLXJldmlldyBwcmVzZW50YXRpb24gY29udHJvbGxlci5cblx0ICovXG5cdGZ1bmN0aW9uIGNyZWF0ZV9kZWxldGVfcmV2aWV3X3dvcmtmbG93KCBzZXR0aW5ncyApIHtcblx0XHR2YXIgb3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oIHtcblx0XHRcdGFja25vd2xlZGdlbWVudF9zZWxlY3RvcjogJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1kZWxldGUtYWNrbm93bGVkZ2VtZW50XScsXG5cdFx0XHRhcHBseV9zZWxlY3RvcjogJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1kZWxldGUtYXBwbHldLCBbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5zcGVjdG9yLXNhdmVdJyxcblx0XHRcdGNhbmNlbF9zZWxlY3RvcjogJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1kZWxldGUtY2FuY2VsXSwgW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1jYW5jZWxdJyxcblx0XHRcdHJvb3Q6IGRvY3VtZW50XG5cdFx0fSwgc2V0dGluZ3MgfHwge30gKTtcblx0XHR2YXIgcmV2aWV3X3N0YXRlID0ge1xuXHRcdFx0YnVzeTogZmFsc2UsXG5cdFx0XHRjYW5fYXBwbHk6IGZhbHNlXG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiB0aGUgY29uZmlndXJlZCBxdWVyeSByb290LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7RG9jdW1lbnR8RWxlbWVudH0gUXVlcnktY2FwYWJsZSByb290LlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9yb290KCkge1xuXHRcdFx0cmV0dXJuIG9wdGlvbnMucm9vdCAmJiBvcHRpb25zLnJvb3QucXVlcnlTZWxlY3RvckFsbCA/IG9wdGlvbnMucm9vdCA6IGRvY3VtZW50O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiB0aGUgYWN0aXZlIGFja25vd2xlZGdlbWVudCBjaGVja2JveC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge0hUTUxJbnB1dEVsZW1lbnR8bnVsbH0gQ2hlY2tib3ggb3IgbnVsbCB3aGVuIHRoZSByZXZpZXcgaXMgYmxvY2tlZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfYWNrbm93bGVkZ2VtZW50KCkge1xuXHRcdFx0cmV0dXJuIGdldF9yb290KCkucXVlcnlTZWxlY3Rvciggb3B0aW9ucy5hY2tub3dsZWRnZW1lbnRfc2VsZWN0b3IgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXN0YXJ0IHRoZSBmaW5pdGUgYWNrbm93bGVkZ2VtZW50IGF0dGVudGlvbiBhbmltYXRpb24uXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHB1bHNlX2Fja25vd2xlZGdlbWVudCgpIHtcblx0XHRcdHZhciBhY2tub3dsZWRnZW1lbnQgPSBnZXRfYWNrbm93bGVkZ2VtZW50KCk7XG5cdFx0XHR2YXIgY29udGFpbmVyID0gYWNrbm93bGVkZ2VtZW50ID8gYWNrbm93bGVkZ2VtZW50LmNsb3Nlc3QoICcud3BiY191aV9jYXRhbG9nX2RlbGV0ZV9yZXZpZXdfX2Fja25vd2xlZGdlbWVudCcgKSA6IG51bGw7XG5cblx0XHRcdGlmICggISBjb250YWluZXIgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtYXR0ZW50aW9uJyApO1xuXHRcdFx0dm9pZCBjb250YWluZXIub2Zmc2V0V2lkdGg7XG5cdFx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCggJ2lzLWF0dGVudGlvbicgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTeW5jaHJvbml6ZSBkZXN0cnVjdGl2ZSByZXZpZXcgYWN0aW9ucyB3aXRoIHNlcnZlciBhbmQgdXNlciBzdGF0ZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBuZXh0X3N0YXRlIEJ1c3kgYW5kIHNlcnZlci1hdXRob3JpdGF0aXZlIGFwcGx5IGZsYWdzLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc3luY2hyb25pemUoIG5leHRfc3RhdGUgKSB7XG5cdFx0XHR2YXIgYWNrbm93bGVkZ2VtZW50O1xuXHRcdFx0dmFyIGFja25vd2xlZGdlZDtcblx0XHRcdHZhciByb290ID0gZ2V0X3Jvb3QoKTtcblxuXHRcdFx0bmV4dF9zdGF0ZSA9IG5leHRfc3RhdGUgfHwge307XG5cdFx0XHRpZiAoICdib29sZWFuJyA9PT0gdHlwZW9mIG5leHRfc3RhdGUuYnVzeSApIHtcblx0XHRcdFx0cmV2aWV3X3N0YXRlLmJ1c3kgPSBuZXh0X3N0YXRlLmJ1c3k7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICdib29sZWFuJyA9PT0gdHlwZW9mIG5leHRfc3RhdGUuY2FuX2FwcGx5ICkge1xuXHRcdFx0XHRyZXZpZXdfc3RhdGUuY2FuX2FwcGx5ID0gbmV4dF9zdGF0ZS5jYW5fYXBwbHk7XG5cdFx0XHR9XG5cdFx0XHRhY2tub3dsZWRnZW1lbnQgPSBnZXRfYWNrbm93bGVkZ2VtZW50KCk7XG5cdFx0XHRhY2tub3dsZWRnZWQgPSAhISBhY2tub3dsZWRnZW1lbnQgJiYgYWNrbm93bGVkZ2VtZW50LmNoZWNrZWQ7XG5cdFx0XHRyb290LnF1ZXJ5U2VsZWN0b3JBbGwoIG9wdGlvbnMuYXBwbHlfc2VsZWN0b3IgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGNvbnRyb2wgKSB7XG5cdFx0XHRcdGNvbnRyb2wuZGlzYWJsZWQgPSByZXZpZXdfc3RhdGUuYnVzeSB8fCAhIHJldmlld19zdGF0ZS5jYW5fYXBwbHkgfHwgISBhY2tub3dsZWRnZWQ7XG5cdFx0XHRcdGNvbnRyb2wuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWJ1c3knLCByZXZpZXdfc3RhdGUuYnVzeSApO1xuXHRcdFx0XHRjb250cm9sLnNldEF0dHJpYnV0ZSggJ2FyaWEtYnVzeScsIHJldmlld19zdGF0ZS5idXN5ID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xuXHRcdFx0fSApO1xuXHRcdFx0cm9vdC5xdWVyeVNlbGVjdG9yQWxsKCBvcHRpb25zLmNhbmNlbF9zZWxlY3RvciApLmZvckVhY2goIGZ1bmN0aW9uICggY29udHJvbCApIHtcblx0XHRcdFx0Y29udHJvbC5kaXNhYmxlZCA9IHJldmlld19zdGF0ZS5idXN5O1xuXHRcdFx0fSApO1xuXHRcdFx0cm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWRlbGV0ZS1yZXZpZXctZm9ybV0nICkuZm9yRWFjaCggZnVuY3Rpb24gKCBmb3JtICkge1xuXHRcdFx0XHRmb3JtLnNldEF0dHJpYnV0ZSggJ2FyaWEtYnVzeScsIHJldmlld19zdGF0ZS5idXN5ID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFwcGx5IHRoZSBzdGFuZGFyZCBkZXN0cnVjdGl2ZSBmb290ZXIgY29udHJhY3QgdG8gZG9tYWluLW93bmVkIGNvbnRyb2xzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGZvb3Rlcl9zZXR0aW5ncyBGb290ZXIgZWxlbWVudCwgZm9ybSBJRCwgYW5kIGxhYmVsLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY29uZmlndXJlX2Zvb3RlciggZm9vdGVyX3NldHRpbmdzICkge1xuXHRcdFx0dmFyIGZvb3Rlcl9vcHRpb25zID0gZm9vdGVyX3NldHRpbmdzIHx8IHt9O1xuXHRcdFx0dmFyIGZvb3RlciA9IGZvb3Rlcl9vcHRpb25zLmZvb3RlciAmJiBmb290ZXJfb3B0aW9ucy5mb290ZXIucXVlcnlTZWxlY3RvciA/IGZvb3Rlcl9vcHRpb25zLmZvb3RlciA6IG51bGw7XG5cdFx0XHR2YXIgYXBwbHlfYnV0dG9uID0gZm9vdGVyID8gZm9vdGVyLnF1ZXJ5U2VsZWN0b3IoIG9wdGlvbnMuYXBwbHlfc2VsZWN0b3IgKSA6IG51bGw7XG5cblx0XHRcdGlmICggISBhcHBseV9idXR0b24gKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGFwcGx5X2J1dHRvbi5jbGFzc0xpc3QucmVtb3ZlKCAnYnV0dG9uLXByaW1hcnknLCAnYnV0dG9uLWxpbmstZGVsZXRlJyApO1xuXHRcdFx0YXBwbHlfYnV0dG9uLmNsYXNzTGlzdC5hZGQoICdidXR0b24tc2Vjb25kYXJ5JywgJ3dwYmNfdWlfY2F0YWxvZ19kZWxldGVfcmV2aWV3X19hcHBseScgKTtcblx0XHRcdGFwcGx5X2J1dHRvbi50ZXh0Q29udGVudCA9IFN0cmluZyggZm9vdGVyX29wdGlvbnMubGFiZWwgfHwgJycgKTtcblx0XHRcdGlmICggZm9vdGVyX29wdGlvbnMuZm9ybV9pZCApIHtcblx0XHRcdFx0YXBwbHlfYnV0dG9uLnNldEF0dHJpYnV0ZSggJ2Zvcm0nLCBTdHJpbmcoIGZvb3Rlcl9vcHRpb25zLmZvcm1faWQgKSApO1xuXHRcdFx0fVxuXHRcdFx0cmV2aWV3X3N0YXRlLmNhbl9hcHBseSA9IHRydWUgPT09IGZvb3Rlcl9vcHRpb25zLmNhbl9hcHBseTtcblx0XHRcdHJldmlld19zdGF0ZS5idXN5ID0gZmFsc2U7XG5cdFx0XHRzeW5jaHJvbml6ZSgpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEhhbmRsZSBhIGRlbGVnYXRlZCBhY2tub3dsZWRnZW1lbnQgY2hhbmdlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnQgQnJvd3NlciBjaGFuZ2UgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBldmVudCBiZWxvbmdlZCB0byB0aGlzIHdvcmtmbG93LlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9jaGFuZ2UoIGV2ZW50ICkge1xuXHRcdFx0dmFyIHRhcmdldCA9IGV2ZW50ICYmIGV2ZW50LnRhcmdldDtcblxuXHRcdFx0aWYgKCAhIHRhcmdldCB8fCAhIHRhcmdldC5tYXRjaGVzIHx8ICEgdGFyZ2V0Lm1hdGNoZXMoIG9wdGlvbnMuYWNrbm93bGVkZ2VtZW50X3NlbGVjdG9yICkgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmICggdGFyZ2V0LmNoZWNrZWQgKSB7XG5cdFx0XHRcdHZhciBjb250YWluZXIgPSB0YXJnZXQuY2xvc2VzdCggJy53cGJjX3VpX2NhdGFsb2dfZGVsZXRlX3Jldmlld19fYWNrbm93bGVkZ2VtZW50JyApO1xuXHRcdFx0XHRpZiAoIGNvbnRhaW5lciApIHtcblx0XHRcdFx0XHRjb250YWluZXIuY2xhc3NMaXN0LnJlbW92ZSggJ2lzLWF0dGVudGlvbicgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cHVsc2VfYWNrbm93bGVkZ2VtZW50KCk7XG5cdFx0XHR9XG5cdFx0XHRzeW5jaHJvbml6ZSgpO1xuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0Y29uZmlndXJlX2Zvb3RlcjogY29uZmlndXJlX2Zvb3Rlcixcblx0XHRcdGhhbmRsZV9jaGFuZ2U6IGhhbmRsZV9jaGFuZ2UsXG5cdFx0XHRwdWxzZV9hY2tub3dsZWRnZW1lbnQ6IHB1bHNlX2Fja25vd2xlZGdlbWVudCxcblx0XHRcdHN5bmNocm9uaXplOiBzeW5jaHJvbml6ZVxuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogTW91bnQgb25lIHJlZ2lzdGVyZWQgY2F0YWxvZyBhbmQgcmVuZGVyIGl0cyBpbml0aWFsIHJlc3BvbnNlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnIFJlZ2lzdGVyZWQgYnJvd3NlciBjb25maWd1cmF0aW9uLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8ZmFsc2V9IENhdGFsb2cgY29udHJvbGxlciBvciBmYWxzZSB3aGVuIG1vdW50aW5nIGZhaWxzLlxuXHQgKi9cblx0ZnVuY3Rpb24gbW91bnRfY2F0YWxvZyggY29uZmlnICkge1xuXHRcdHZhciBjYXRhbG9nX3N0YXRlO1xuXHRcdHZhciBjYXRhbG9nX3RlbXBsYXRlO1xuXHRcdHZhciBjb250ZW50X2VsZW1lbnQ7XG5cdFx0dmFyIGluaXRpYWxfc2VxdWVuY2U7XG5cdFx0dmFyIG1vdW50X2VsZW1lbnQ7XG5cblx0XHRpZiAoICEgY29uZmlnIHx8ICEgY29uZmlnLmlkIHx8ICEgY29uZmlnLm1vdW50X2lkIHx8ICEgY29uZmlnLnRlbXBsYXRlcyB8fCAhIGNvbmZpZy50ZW1wbGF0ZXMuY2F0YWxvZyB8fCAhIGNvbmZpZy50ZW1wbGF0ZXMuc2hlbGwgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uZmlnLmNhdGFsb2dfaWQgPSBjb25maWcuaWQ7XG5cdFx0bW91bnRfZWxlbWVudCAgICAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggY29uZmlnLm1vdW50X2lkICk7XG5cdFx0Y2F0YWxvZ190ZW1wbGF0ZSAgPSBsb2FkX3RlbXBsYXRlKCBjb25maWcsICdjYXRhbG9nJyApO1xuXG5cdFx0aWYgKCAhIG1vdW50X2VsZW1lbnQgfHwgISBjYXRhbG9nX3RlbXBsYXRlICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdG1vdW50X2VsZW1lbnQuaW5uZXJIVE1MID0gY2F0YWxvZ190ZW1wbGF0ZSggT2JqZWN0LmFzc2lnbigge30sIGNvbmZpZywgeyBjYXRhbG9nX2lkOiBjb25maWcuY2F0YWxvZ19pZCB9ICkgKTtcblx0XHRjb250ZW50X2VsZW1lbnQgPSBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctY29udGVudF0nICk7XG5cdFx0aWYgKCAhIGNvbnRlbnRfZWxlbWVudCApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKCBjb25maWcuaTE4biAmJiBjb25maWcuaTE4bi5jYXRhbG9nX2xhYmVsICkge1xuXHRcdFx0Y29udGVudF9lbGVtZW50LnBhcmVudE5vZGUuc2V0QXR0cmlidXRlKCAnYXJpYS1sYWJlbCcsIGNvbmZpZy5pMThuLmNhdGFsb2dfbGFiZWwgKTtcblx0XHR9XG5cblx0XHRjYXRhbG9nX3N0YXRlICAgICAgICAgICAgICAgICA9IGdldF9jYXRhbG9nX3N0YXRlKCBjb25maWcuY2F0YWxvZ19pZCApO1xuXHRcdGNhdGFsb2dfc3RhdGUuY29uZmlnICAgICAgICAgID0gY29uZmlnO1xuXHRcdGNhdGFsb2dfc3RhdGUuY29udGVudF9lbGVtZW50ID0gY29udGVudF9lbGVtZW50O1xuXHRcdGNhdGFsb2dfc3RhdGUucmVzcG9uc2VfZWxlbWVudCA9IGNvbnRlbnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXJlc3BvbnNlXScgKSB8fCBjb250ZW50X2VsZW1lbnQ7XG5cdFx0Y2F0YWxvZ19zdGF0ZS5sb2FkaW5nX2VsZW1lbnQgPSBjb250ZW50X2VsZW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1sb2FkaW5nXScgKTtcblx0XHRjYXRhbG9nX3N0YXRlLmxhdGVzdF9zZXF1ZW5jZSA9IDA7XG5cdFx0Y2F0YWxvZ19zdGF0ZS5yZXF1ZXN0X3ZhbHVlcyA9IE9iamVjdC5hc3NpZ24oIHt9LCBjb25maWcuaW5pdGlhbF9yZXF1ZXN0IHx8IHt9ICk7XG5cdFx0YmluZF9jYXRhbG9nX2NvbnRyb2xzKCBjb25maWcsIG1vdW50X2VsZW1lbnQgKTtcblx0XHRpZiAoIHdpbmRvdy53cGJjX3VpX2NhdGFsb2dfYWN0aW9ucyAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfdWlfY2F0YWxvZ19hY3Rpb25zLmluaXRpYWxpemUgKSB7XG5cdFx0XHRjYXRhbG9nX3N0YXRlLmFjdGlvbnNfY29udHJvbGxlciA9IHdpbmRvdy53cGJjX3VpX2NhdGFsb2dfYWN0aW9ucy5pbml0aWFsaXplKCBtb3VudF9lbGVtZW50LCBjb25maWcgKTtcblx0XHR9XG5cdFx0aWYgKFxuXHRcdFx0Y29uZmlnLmZlYXR1cmVzXG5cdFx0XHQmJiBjb25maWcuZmVhdHVyZXMuaGllcmFyY2h5XG5cdFx0XHQmJiB3aW5kb3cud3BiY191aV9jYXRhbG9nX2hpZXJhcmNoeVxuXHRcdFx0JiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX3VpX2NhdGFsb2dfaGllcmFyY2h5LmluaXRpYWxpemVcblx0XHQpIHtcblx0XHRcdGNhdGFsb2dfc3RhdGUuaGllcmFyY2h5X2NvbnRyb2xsZXIgPSB3aW5kb3cud3BiY191aV9jYXRhbG9nX2hpZXJhcmNoeS5pbml0aWFsaXplKCBtb3VudF9lbGVtZW50LCBjb25maWcsIGZ1bmN0aW9uICggaGllcmFyY2h5X3N0YXRlICkge1xuXHRcdFx0XHR2YXIgaGllcmFyY2h5X2NvbmZpZ3VyYXRpb24gPSBjb25maWcuaGllcmFyY2h5IHx8IHt9O1xuXHRcdFx0XHR2YXIgcHJlZmVyZW5jZV9rZXkgPSBTdHJpbmcoIGhpZXJhcmNoeV9jb25maWd1cmF0aW9uLnByZWZlcmVuY2Vfa2V5IHx8ICcnICk7XG5cdFx0XHRcdHZhciBwcmVmZXJlbmNlX3ZhbHVlcyA9IHt9O1xuXG5cdFx0XHRcdGlmICggJ2dsb2JhbCcgIT09IGhpZXJhcmNoeV9jb25maWd1cmF0aW9uLnBlcnNpc3RlbmNlIHx8ICEgcHJlZmVyZW5jZV9rZXkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSggZmFsc2UgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRwcmVmZXJlbmNlX3ZhbHVlc1sgcHJlZmVyZW5jZV9rZXkgXSA9IEpTT04uc3RyaW5naWZ5KCBoaWVyYXJjaHlfc3RhdGUgfHwge30gKTtcblxuXHRcdFx0XHRyZXR1cm4gc2F2ZV9jYXRhbG9nX3ByZWZlcmVuY2VzKCBjb25maWcsIHByZWZlcmVuY2VfdmFsdWVzICk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXHRcdGlmIChcblx0XHRcdGNvbmZpZy5mZWF0dXJlc1xuXHRcdFx0JiYgY29uZmlnLmZlYXR1cmVzLnNlbGVjdGlvblxuXHRcdFx0JiYgd2luZG93LndwYmNfdWlfY2F0YWxvZ19zZWxlY3Rpb25cblx0XHRcdCYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY191aV9jYXRhbG9nX3NlbGVjdGlvbi5pbml0aWFsaXplXG5cdFx0KSB7XG5cdFx0XHRjYXRhbG9nX3N0YXRlLnNlbGVjdGlvbl9jb250cm9sbGVyID0gd2luZG93LndwYmNfdWlfY2F0YWxvZ19zZWxlY3Rpb24uaW5pdGlhbGl6ZSggbW91bnRfZWxlbWVudCwgY29uZmlnICk7XG5cdFx0fVxuXG5cdFx0aWYgKCAhIHNldF9jYXRhbG9nX2xvYWRpbmdfc3RhdGUoIGNvbmZpZywgdHJ1ZSApICkge1xuXHRcdFx0cmVuZGVyX3RlbXBsYXRlKCBjb25maWcsICdzaGVsbCcsIHtcblx0XHRcdFx0Y2F0YWxvZ19pZDogY29uZmlnLmNhdGFsb2dfaWQsXG5cdFx0XHRcdGFyaWFfbGFiZWw6IGNvbmZpZy5pMThuICYmIGNvbmZpZy5pMThuLmNhdGFsb2dfbGFiZWwgPyBjb25maWcuaTE4bi5jYXRhbG9nX2xhYmVsIDogJycsXG5cdFx0XHRcdGxvYWRpbmdfbWVzc2FnZTogY29uZmlnLmkxOG4gJiYgY29uZmlnLmkxOG4ubG9hZGluZyA/IGNvbmZpZy5pMThuLmxvYWRpbmcgOiAnJ1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdGlmICggY29uZmlnLmF1dG9fbG9hZCApIHtcblx0XHRcdHJlcXVlc3RfY2F0YWxvZyggY29uZmlnLCBjb25maWcuaW5pdGlhbF9yZXF1ZXN0IHx8IHt9ICk7XG5cdFx0XHRpbml0aWFsX3NlcXVlbmNlID0gY2F0YWxvZ19zdGF0ZS5sYXRlc3Rfc2VxdWVuY2U7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGluaXRpYWxfc2VxdWVuY2UgPSBuZXh0X3JlcXVlc3Rfc2VxdWVuY2UoIGNvbmZpZy5jYXRhbG9nX2lkICk7XG5cdFx0XHRpZiAoIGNvbmZpZy5pbml0aWFsX3Jlc3BvbnNlICkge1xuXHRcdFx0XHRyZW5kZXJfcmVzcG9uc2UoIGNvbmZpZywgY29uZmlnLmluaXRpYWxfcmVzcG9uc2UsIGluaXRpYWxfc2VxdWVuY2UgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0Y2F0YWxvZ19pZDogY29uZmlnLmNhdGFsb2dfaWQsXG5cdFx0XHRjbGVhcl9zZWxlY3Rpb246IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0aWYgKCBjYXRhbG9nX3N0YXRlLnNlbGVjdGlvbl9jb250cm9sbGVyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBjYXRhbG9nX3N0YXRlLnNlbGVjdGlvbl9jb250cm9sbGVyLmNsZWFyICkge1xuXHRcdFx0XHRcdGNhdGFsb2dfc3RhdGUuc2VsZWN0aW9uX2NvbnRyb2xsZXIuY2xlYXIoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGdldF9zZWxlY3RlZF9pZHM6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIGNhdGFsb2dfc3RhdGUuc2VsZWN0aW9uX2NvbnRyb2xsZXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNhdGFsb2dfc3RhdGUuc2VsZWN0aW9uX2NvbnRyb2xsZXIuZ2V0X3NlbGVjdGVkX2lkc1xuXHRcdFx0XHRcdD8gY2F0YWxvZ19zdGF0ZS5zZWxlY3Rpb25fY29udHJvbGxlci5nZXRfc2VsZWN0ZWRfaWRzKClcblx0XHRcdFx0XHQ6IFtdO1xuXHRcdFx0fSxcblx0XHRcdGdldF9oaWVyYXJjaHlfY29udHJvbGxlcjogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gY2F0YWxvZ19zdGF0ZS5oaWVyYXJjaHlfY29udHJvbGxlciB8fCBmYWxzZTtcblx0XHRcdH0sXG5cdFx0XHRzZXF1ZW5jZTogaW5pdGlhbF9zZXF1ZW5jZSxcblx0XHRcdGxvYWQ6IGZ1bmN0aW9uICggcmVxdWVzdF92YWx1ZXMgKSB7XG5cdFx0XHRcdHJldHVybiByZXF1ZXN0X2NhdGFsb2coIGNvbmZpZywgcmVxdWVzdF92YWx1ZXMgfHwge30gKTtcblx0XHRcdH0sXG5cdFx0XHRzYXZlX3ByZWZlcmVuY2VzOiBmdW5jdGlvbiAoIHByZWZlcmVuY2VfdmFsdWVzICkge1xuXHRcdFx0XHRyZXR1cm4gc2F2ZV9jYXRhbG9nX3ByZWZlcmVuY2VzKCBjb25maWcsIHByZWZlcmVuY2VfdmFsdWVzIHx8IHt9ICk7XG5cdFx0XHR9LFxuXHRcdFx0cmVmcmVzaF9jb250cm9sczogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZWZyZXNoX2NhdGFsb2dfY29udHJvbHMoIGNvbmZpZyApO1xuXHRcdFx0fSxcblx0XHRcdHN5bmNfdGFibGVfbWluX3dpZHRoOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHN5bmNfY2F0YWxvZ190YWJsZV9taW5fd2lkdGgoIGNvbmZpZyApO1xuXHRcdFx0fSxcblx0XHRcdG5leHRfc2VxdWVuY2U6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIG5leHRfcmVxdWVzdF9zZXF1ZW5jZSggY29uZmlnLmNhdGFsb2dfaWQgKTtcblx0XHRcdH0sXG5cdFx0XHRyZW5kZXJfcmVzcG9uc2U6IGZ1bmN0aW9uICggcmVzcG9uc2UsIHJlcXVlc3Rfc2VxdWVuY2UgKSB7XG5cdFx0XHRcdHJldHVybiByZW5kZXJfcmVzcG9uc2UoIGNvbmZpZywgcmVzcG9uc2UsIHJlcXVlc3Rfc2VxdWVuY2UgKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0d2luZG93LndwYmNfdWlfY2F0YWxvZyA9IHdpbmRvdy53cGJjX3VpX2NhdGFsb2cgfHwge307XG5cdHdpbmRvdy53cGJjX3VpX2NhdGFsb2cuY3JlYXRlX2luc3BlY3Rvcl93b3JrZmxvdyA9IGNyZWF0ZV9pbnNwZWN0b3Jfd29ya2Zsb3c7XG5cdHdpbmRvdy53cGJjX3VpX2NhdGFsb2cuY3JlYXRlX2lubGluZV9lZGl0aW5nX3dvcmtmbG93ID0gY3JlYXRlX2lubGluZV9lZGl0aW5nX3dvcmtmbG93O1xuXHR3aW5kb3cud3BiY191aV9jYXRhbG9nLmNyZWF0ZV9pbmxpbmVfcmV2aWV3X3dvcmtmbG93ID0gY3JlYXRlX2lubGluZV9yZXZpZXdfd29ya2Zsb3c7XG5cdHdpbmRvdy53cGJjX3VpX2NhdGFsb2cuY3JlYXRlX2RlbGV0ZV9yZXZpZXdfd29ya2Zsb3cgPSBjcmVhdGVfZGVsZXRlX3Jldmlld193b3JrZmxvdztcblx0d2luZG93LndwYmNfdWlfY2F0YWxvZy5pc19zdGFsZV9yZXNwb25zZSA9IGlzX3N0YWxlX3Jlc3BvbnNlO1xuXHR3aW5kb3cud3BiY191aV9jYXRhbG9nLmxvYWRfdGVtcGxhdGUgPSBsb2FkX3RlbXBsYXRlO1xuXHR3aW5kb3cud3BiY191aV9jYXRhbG9nLm1vdW50ID0gbW91bnRfY2F0YWxvZztcblx0d2luZG93LndwYmNfdWlfY2F0YWxvZy5uZXh0X3JlcXVlc3Rfc2VxdWVuY2UgPSBuZXh0X3JlcXVlc3Rfc2VxdWVuY2U7XG5cdHdpbmRvdy53cGJjX3VpX2NhdGFsb2cucmVuZGVyX3Jlc3BvbnNlID0gcmVuZGVyX3Jlc3BvbnNlO1xuXHR3aW5kb3cud3BiY191aV9jYXRhbG9nLnJlcXVlc3QgPSByZXF1ZXN0X2NhdGFsb2c7XG5cdHdpbmRvdy53cGJjX3VpX2NhdGFsb2cuc3luY190YWJsZV9taW5fd2lkdGggPSBzeW5jX2NhdGFsb2dfdGFibGVfbWluX3dpZHRoO1xuXHR3aW5kb3cud3BiY191aV9jYXRhbG9nLnN5bmNocm9uaXplX292ZXJmbG93X3Rvb2x0aXBzID0gc3luY2hyb25pemVfb3ZlcmZsb3dfdG9vbHRpcHM7XG5cdHdpbmRvdy53cGJjX3VpX2NhdGFsb2cudmFsaWRhdGVfcmVzcG9uc2UgPSB2YWxpZGF0ZV9yZXNwb25zZTtc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
