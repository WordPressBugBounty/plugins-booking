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
     * @param {HTMLElement} indicator_element Element receiving the badge.
     * @param {string}      changed_label     Localized badge text.
     * @return {void}
     */
    function set_row_changed(row_element, changed, indicator_element, changed_label) {
      var indicator;
      if (!row_element) {
        return;
      }
      row_element.classList.add('wpbc_ui_catalog_inline_row');
      row_element.classList.toggle('is-inline-changed', !!changed);
      indicator = row_element.querySelector('[data-wpbc-ui-catalog-inline-changed-label]');
      if (!changed) {
        if (indicator) {
          indicator.remove();
        }
        return;
      }
      if (!indicator && indicator_element) {
        indicator = document.createElement('span');
        indicator.className = 'wpbc_ui_catalog_inline_changed_label';
        indicator.setAttribute('data-wpbc-ui-catalog-inline-changed-label', '');
        indicator_element.appendChild(indicator);
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvX3NoYXJlZC11aS1jYXRhbG9nL19vdXQvd3BiY191aV9jYXRhbG9nLmpzIiwibmFtZXMiOlsid2luZG93IiwiZG9jdW1lbnQiLCJjYXRhbG9nX3N0YXRlcyIsIm5vcm1hbGl6ZV9zZXF1ZW5jZSIsInNlcXVlbmNlIiwibm9ybWFsaXplZF9zZXF1ZW5jZSIsImlzRmluaXRlIiwiTWF0aCIsImZsb29yIiwidGVzdCIsInBhcnNlSW50Iiwibm9ybWFsaXplX3NjaGVtYV92ZXJzaW9uIiwic2NoZW1hX3ZlcnNpb24iLCJub3JtYWxpemVkX3ZlcnNpb24iLCJnZXRfY2F0YWxvZ19zdGF0ZSIsImNhdGFsb2dfaWQiLCJhY3Rpb25zX2NvbnRyb2xsZXIiLCJhYm9ydF9jb250cm9sbGVyIiwiY29uZmlnIiwiY29udGVudF9lbGVtZW50IiwibGF0ZXN0X3NlcXVlbmNlIiwicHJlZmVyZW5jZV9hYm9ydF9jb250cm9sbGVyIiwicHJlZmVyZW5jZV9yZXZpc2lvbiIsInJlcXVlc3RfdmFsdWVzIiwic2VhcmNoX3RpbWVyIiwic2VsZWN0aW9uX2NvbnRyb2xsZXIiLCJzb3J0YWJsZSIsImdldF9zZWFyY2hfZGVib3VuY2VfZGVsYXkiLCJzZWFyY2hfY29uZmlnIiwic2VhcmNoIiwiZGVib3VuY2VfZGVsYXkiLCJOdW1iZXIiLCJkZWJvdW5jZV9kZWxheV9tcyIsIm1pbiIsImlzX2ltbWVkaWF0ZV9zZWFyY2hfY2xlYXJfZW5hYmxlZCIsImltbWVkaWF0ZV9jbGVhciIsIm5leHRfcmVxdWVzdF9zZXF1ZW5jZSIsImNhdGFsb2dfc3RhdGUiLCJpc19zdGFsZV9yZXNwb25zZSIsImdldF90ZW1wbGF0ZV9pZCIsInRlbXBsYXRlX3JvbGUiLCJpbml0aWFsX3JlcXVlc3QiLCJ0ZW1wbGF0ZV9pZCIsInRlbXBsYXRlX3BhY2siLCJ0ZW1wbGF0ZV9wYWNrX2lkIiwidGVtcGxhdGVzIiwiaWQiLCJ0ZW1wbGF0ZV9wYWNrcyIsInNldF9hY3RpdmVfdGVtcGxhdGVfcGFjayIsImNhdGFsb2dfcm9vdCIsIm5vcm1hbGl6ZWRfcGFja19pZCIsImRlZmF1bHRfdGVtcGxhdGVfcGFjayIsImNsb3Nlc3QiLCJzZXRBdHRyaWJ1dGUiLCJsb2FkX3RlbXBsYXRlIiwid3AiLCJ0ZW1wbGF0ZSIsImVycm9yIiwicmVuZGVyX3RlbXBsYXRlIiwidGVtcGxhdGVfZGF0YSIsInJlbmRlcl90YXJnZXQiLCJyZW5kZXJlZF9odG1sIiwicmVzcG9uc2VfZWxlbWVudCIsImRpc3BhdGNoX2NhdGFsb2dfZXZlbnQiLCJpbm5lckhUTUwiLCJwYXJlbnROb2RlIiwic2V0X2NhdGFsb2dfbG9hZGluZ19zdGF0ZSIsImlzX2xvYWRpbmciLCJsb2FkaW5nX2VsZW1lbnQiLCJjbGFzc0xpc3QiLCJ0b2dnbGUiLCJzeW5jX2NhdGFsb2dfdGFibGVfbWluX3dpZHRoIiwibW91bnRfZWxlbWVudCIsIm1vdW50X2lkIiwiZ2V0RWxlbWVudEJ5SWQiLCJ0YWJsZSIsInF1ZXJ5U2VsZWN0b3IiLCJoZWFkZXJfY2VsbHMiLCJ0YWJsZV9taW5fd2lkdGgiLCJnZXRDb21wdXRlZFN0eWxlIiwiQXJyYXkiLCJwcm90b3R5cGUiLCJmaWx0ZXIiLCJjYWxsIiwicXVlcnlTZWxlY3RvckFsbCIsImhlYWRlcl9jZWxsIiwiaGlkZGVuIiwiZm9yRWFjaCIsImNvbHVtbl9taW5fd2lkdGgiLCJwYXJzZUZsb2F0IiwiZ2V0UHJvcGVydHlWYWx1ZSIsInN0eWxlIiwic2V0UHJvcGVydHkiLCJjZWlsIiwicG9zaXRpb25fZGlzcGxheV9wYW5lbCIsImN1c3RvbWl6ZXIiLCJwYW5lbCIsInN1bW1hcnkiLCJmaWVsZF9saXN0Iiwic3VtbWFyeV9yZWN0IiwicGFuZWxfcmVjdCIsInZpZXdwb3J0X3dpZHRoIiwidmlld3BvcnRfaGVpZ2h0IiwibWFyZ2luIiwiZ2FwIiwic3BhY2VfYWJvdmUiLCJzcGFjZV9iZWxvdyIsIm5hdHVyYWxfaGVpZ2h0Iiwib3Blbl9hYm92ZSIsImF2YWlsYWJsZV9oZWlnaHQiLCJyZW5kZXJlZF9oZWlnaHQiLCJwYW5lbF9sZWZ0IiwicGFuZWxfdG9wIiwib3BlbiIsInJlbW92ZSIsInJlbW92ZVByb3BlcnR5IiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0IiwiZG9jdW1lbnRFbGVtZW50IiwiY2xpZW50V2lkdGgiLCJpbm5lcldpZHRoIiwiaW5uZXJIZWlnaHQiLCJjbGllbnRIZWlnaHQiLCJtYXgiLCJ0b3AiLCJib3R0b20iLCJzY3JvbGxIZWlnaHQiLCJoZWlnaHQiLCJyaWdodCIsIndpZHRoIiwicm91bmQiLCJhZGQiLCJyZXNldF9kaXNwbGF5X3BhbmVsX3Bvc2l0aW9uIiwiY2xvc2VfZGlzcGxheV9jdXN0b21pemVyIiwicmVzdG9yZV9mb2N1cyIsImZvY3VzIiwicmVuZGVyX2Vycm9yIiwibWVzc2FnZSIsImkxOG4iLCJ0aXRsZSIsImVycm9yX3RpdGxlIiwiZXJyb3JfbWVzc2FnZSIsImV2ZW50X25hbWUiLCJkZXRhaWwiLCJjYXRhbG9nX2V2ZW50IiwiQ3VzdG9tRXZlbnQiLCJidWJibGVzIiwiY3JlYXRlRXZlbnQiLCJpbml0Q3VzdG9tRXZlbnQiLCJkaXNwYXRjaEV2ZW50IiwiYXBwZW5kX3JlcXVlc3RfdmFsdWUiLCJyZXF1ZXN0X2JvZHkiLCJyZXF1ZXN0X2tleSIsInJlcXVlc3RfdmFsdWUiLCJpc0FycmF5IiwiYXJyYXlfdmFsdWUiLCJhcHBlbmQiLCJTdHJpbmciLCJnZXRfY29sdW1uX29yZGVyIiwic2xpY2UiLCJtYXAiLCJjb2x1bW5faXRlbSIsImdldEF0dHJpYnV0ZSIsImNvbHVtbl9pZCIsImdldF92aXNpYmxlX2NvbHVtbnMiLCJjb2x1bW5fY29udHJvbCIsImNoZWNrZWQiLCJ2YWx1ZSIsInNhdmVfY29sdW1uX2NvbnRyb2xzIiwidmlld19jb250cm9sIiwicmVxdWVzdF9jYXRhbG9nIiwiY29sdW1uX29yZGVyIiwicGFnZV9udW1iZXIiLCJwcmVmZXJlbmNlX2FjdGlvbiIsInZpc2libGVfY29sdW1ucyIsImFubm91bmNlX2NvbHVtbl9tb3ZlZCIsInN0YXR1c19lbGVtZW50IiwidGV4dENvbnRlbnQiLCJzZXRUaW1lb3V0IiwiY29sdW1uX21vdmVkIiwidXBkYXRlX3VybF9zdGF0ZSIsInJlc3BvbnNlIiwiZmlsdGVycyIsInBhcmFtZXRlcnMiLCJ1cmxfcGFyYW1ldGVycyIsInN0YXRlX3ZhbHVlcyIsInBhZ2luYXRpb24iLCJpdGVtc19wZXJfcGFnZSIsInNvcnRfYnkiLCJzb3J0aW5nIiwic29ydF9vcmRlciIsImRpc3BsYXkiLCJwYWdlX3VybCIsImhpc3RvcnkiLCJyZXBsYWNlU3RhdGUiLCJVUkwiLCJsb2NhdGlvbiIsImhyZWYiLCJPYmplY3QiLCJrZXlzIiwiZmlsdGVyX2tleSIsInN0YXRlX2tleSIsInBhcmFtZXRlcl9uYW1lIiwic3RhdGVfdmFsdWUiLCJqb2luIiwic2VhcmNoUGFyYW1zIiwiZGVsZXRlIiwic2V0IiwidG9TdHJpbmciLCJiaW5kX2NhdGFsb2dfY29udHJvbHMiLCJfd3BiY191aV9jYXRhbG9nX2NvbnRyb2xzX2JvdW5kIiwiYWRkRXZlbnRMaXN0ZW5lciIsImV2ZW50Iiwic2VhcmNoX2NvbnRyb2wiLCJ0YXJnZXQiLCJtYXRjaGVzIiwicHJldmVudERlZmF1bHQiLCJjbGVhcl9jb250cm9sIiwiY2xlYXJUaW1lb3V0IiwiZGVmYXVsdF9yZXF1ZXN0IiwiZmlsdGVyX3JlcXVlc3QiLCJ2aWV3X2RlZmluaXRpb24iLCJ2aWV3cyIsImRlZmluaXRpb25zIiwiZmllbGRzIiwiY2xvc2VfY29udHJvbCIsInBhZ2VfY29udHJvbCIsInJlc2V0X2NvbnRyb2wiLCJyZXNldF9vcmRlcl9jb250cm9sIiwic2VhcmNoX2NsZWFyIiwic29ydF9jb250cm9sIiwic29ydF9rZXkiLCJkaXNhYmxlZCIsImFzc2lnbiIsImtleSIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsImNvbnRhaW5zIiwicmVmcmVzaF9jYXRhbG9nX2NvbnRyb2xzIiwiY29sdW1uX2xpc3QiLCJfd3BiY191aV9jYXRhbG9nX2luaXRpYWxpemVkIiwiaGFuZGxlIiwiaXRlbSIsInNpYmxpbmciLCJwcmV2aW91c0VsZW1lbnRTaWJsaW5nIiwibmV4dEVsZW1lbnRTaWJsaW5nIiwiaW5zZXJ0QmVmb3JlIiwiU29ydGFibGUiLCJhbmltYXRpb24iLCJjaG9zZW5DbGFzcyIsImRyYWdnYWJsZSIsImdob3N0Q2xhc3MiLCJvbkVuZCIsInNvcnRfZXZlbnQiLCJvbGRJbmRleCIsIm5ld0luZGV4IiwidmFsaWRhdGVfcmVzcG9uc2UiLCJjb25maWd1cmVkX3NjaGVtYV92ZXJzaW9uIiwicmVzcG9uc2Vfc2NoZW1hX3ZlcnNpb24iLCJzdWNjZXNzIiwicmVxdWVzdF9pZCIsImNvZGUiLCJyZXRyeWFibGUiLCJpdGVtcyIsImhpZXJhcmNoeSIsImNhcGFiaWxpdGllcyIsIm1lc3NhZ2VzIiwicmVmcmVzaF9jYXRhbG9nX2hpZXJhcmNoeSIsImhpZXJhcmNoeV9jb250cm9sbGVyIiwicmVmcmVzaCIsInJlbmRlcl9yZXNwb25zZSIsInJlcXVlc3Rfc2VxdWVuY2UiLCJpdGVtc190ZW1wbGF0ZV9kYXRhIiwicmVzcG9uc2Vfc2VxdWVuY2UiLCJsZW5ndGgiLCJpc19lbXB0eV9yZW5kZXJlZCIsImVtcHR5X3RpdGxlIiwiZW1wdHlfbWVzc2FnZSIsInBlcnNpc3RlbnRfcmVxdWVzdF92YWx1ZXMiLCJyZXF1ZXN0X3VybCIsImFqYXhfdXJsIiwiYWN0aW9uIiwibm9uY2UiLCJmZXRjaCIsIlByb21pc2UiLCJyZXNvbHZlIiwiYWJvcnQiLCJBYm9ydENvbnRyb2xsZXIiLCJhcmlhX2xhYmVsIiwiY2F0YWxvZ19sYWJlbCIsImxvYWRpbmdfbWVzc2FnZSIsImxvYWRpbmciLCJVUkxTZWFyY2hQYXJhbXMiLCJEYXRlIiwibm93IiwibWV0aG9kIiwiY3JlZGVudGlhbHMiLCJoZWFkZXJzIiwiYm9keSIsInNpZ25hbCIsInVuZGVmaW5lZCIsInRoZW4iLCJ0ZXh0IiwicmVzcG9uc2VfdGV4dCIsInJlc3BvbnNlX3BheWxvYWQiLCJKU09OIiwicGFyc2UiLCJpc19yZW5kZXJlZCIsImNhdGNoIiwibmFtZSIsInNhdmVfY2F0YWxvZ19wcmVmZXJlbmNlcyIsInByZWZlcmVuY2VfdmFsdWVzIiwicmVxdWVzdF9yZXZpc2lvbiIsIm9rIiwic3luY2hyb25pemVfb3ZlcmZsb3dfdG9vbHRpcHMiLCJjYXRhbG9nX21vdW50IiwiaGFzX292ZXJmbG93aW5nX3RleHQiLCJ0b29sdGlwX3NlbGVjdG9yIiwidGV4dF9lbGVtZW50IiwiZnVsbF90ZXh0Iiwic3RhdGljX3RpdGxlIiwiaXNfb3ZlcmZsb3dpbmciLCJzY3JvbGxXaWR0aCIsIl90aXBweSIsImRlc3Ryb3kiLCJyZW1vdmVBdHRyaWJ1dGUiLCJoYXNBdHRyaWJ1dGUiLCJ3cGJjX2RlZmluZV90aXBweV90b29sdGlwcyIsImNyZWF0ZV9pbnNwZWN0b3Jfd29ya2Zsb3ciLCJzZXR0aW5ncyIsIm9wdGlvbnMiLCJleHBhbmQiLCJnZXRfZm9vdGVyIiwiZ2V0X2hvc3QiLCJyZW5kZXJfc2hlbGwiLCJzaGVsbF9kYXRhIiwiaG9zdCIsImZvb3RlciIsIm1vdW50IiwicmVuZGVyZWRfc2hlbGwiLCJzZXRfc3RhdGUiLCJzdGF0ZSIsImVycm9yX3RleHQiLCJmb3JtX3RhcmdldCIsImVtcHR5IiwiaW5kZXhPZiIsIm9wZW5fbG9hZGluZyIsImdldF9mb3JtX3RhcmdldCIsImNyZWF0ZV9pbmxpbmVfZWRpdGluZ193b3JrZmxvdyIsImRlZmF1bHRfcHJvdGVjdGVkX3NlbGVjdG9yIiwiYmFyX3NlbGVjdG9yIiwiY2FuY2VsX3NlbGVjdG9yIiwiY29udHJvbHNfcm9vdCIsImNvdW50X3NlbGVjdG9yIiwicGFnZV9lbGVtZW50IiwicHJvdGVjdGVkX3NlbGVjdG9yIiwicmV2aWV3X3NlbGVjdG9yIiwidG9nZ2xlX2xhYmVsX3NlbGVjdG9yIiwidG9nZ2xlX3NlbGVjdG9yIiwiZ2V0X3BhZ2VfZWxlbWVudCIsIm5vZGVUeXBlIiwiZ2V0X3Byb3RlY3RlZF9zZWxlY3RvciIsInN5bmNocm9uaXplX3Byb3RlY3RlZF9jb250cm9sIiwiY29udHJvbCIsImNvbnRyb2xzX2xvY2tlZCIsInByaW9yX2Rpc2FibGVkIiwicmVnaXN0ZXJfc3RpY2t5X2JhciIsImlubGluZV9iYXIiLCJfd3BiY191aV9jYXRhbG9nX3NlbGVjdGlvbl9jb250cm9sbGVyIiwicmVnaXN0ZXJfdmlld3BvcnRfc3RpY2t5IiwiY2xlYXJfY2hhbmdlZF9yb3dzIiwicm93X2VsZW1lbnQiLCJzZXRfcm93X2NoYW5nZWQiLCJzeW5jaHJvbml6ZSIsIndvcmtmbG93X3N0YXRlIiwiYWN0aXZlIiwiYnVzeSIsInRvZ2dsZV9idXR0b24iLCJ0b2dnbGVfbGFiZWwiLCJsb2NrX2NvbnRyb2xzIiwiY291bnRfdGV4dCIsImNoYW5nZWRfY291bnQiLCJ0b2dnbGVfZGlzYWJsZWQiLCJoYXNfaXRlbXMiLCJhY3RpdmVfdG9nZ2xlX3RleHQiLCJpbmFjdGl2ZV90b2dnbGVfdGV4dCIsInJlZnJlc2hfdmlld3BvcnRfc3RpY2t5IiwicHJvdGVjdF9ldmVudCIsInN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbiIsImNoYW5nZWQiLCJpbmRpY2F0b3JfZWxlbWVudCIsImNoYW5nZWRfbGFiZWwiLCJpbmRpY2F0b3IiLCJjcmVhdGVFbGVtZW50IiwiY2xhc3NOYW1lIiwiYXBwZW5kQ2hpbGQiLCJjcmVhdGVfaW5saW5lX3Jldmlld193b3JrZmxvdyIsImFwcGx5X3NlbGVjdG9yIiwicm9vdCIsInByZXBhcmUiLCJyZXZpZXciLCJwcmVzZW50YXRpb24iLCJub3JtYWxpemVkX3Jvd3MiLCJyb3dzIiwicm93Iiwibm9ybWFsaXplZF9maWVsZHMiLCJub3JtYWxpemVkX25vdGVzIiwiZmllbGQiLCJwdXNoIiwiYWZ0ZXIiLCJiZWZvcmUiLCJsYWJlbCIsIm5vdGVzIiwibm90ZSIsImRlc2NyaXB0aW9uIiwiZm9ybV9pZCIsIm1vZGUiLCJwZW5kaW5nX21lc3NhZ2UiLCJ3YXJuaW5nIiwicmV2aWV3X3N0YXRlIiwiY2FuX2FwcGx5IiwiZm9ybSIsImNyZWF0ZV9kZWxldGVfcmV2aWV3X3dvcmtmbG93IiwiYWNrbm93bGVkZ2VtZW50X3NlbGVjdG9yIiwiZ2V0X3Jvb3QiLCJnZXRfYWNrbm93bGVkZ2VtZW50IiwicHVsc2VfYWNrbm93bGVkZ2VtZW50IiwiYWNrbm93bGVkZ2VtZW50IiwiY29udGFpbmVyIiwib2Zmc2V0V2lkdGgiLCJuZXh0X3N0YXRlIiwiYWNrbm93bGVkZ2VkIiwiY29uZmlndXJlX2Zvb3RlciIsImZvb3Rlcl9zZXR0aW5ncyIsImZvb3Rlcl9vcHRpb25zIiwiYXBwbHlfYnV0dG9uIiwiaGFuZGxlX2NoYW5nZSIsIm1vdW50X2NhdGFsb2ciLCJjYXRhbG9nX3RlbXBsYXRlIiwiaW5pdGlhbF9zZXF1ZW5jZSIsImNhdGFsb2ciLCJzaGVsbCIsIndwYmNfdWlfY2F0YWxvZ19hY3Rpb25zIiwiaW5pdGlhbGl6ZSIsImZlYXR1cmVzIiwid3BiY191aV9jYXRhbG9nX2hpZXJhcmNoeSIsImhpZXJhcmNoeV9zdGF0ZSIsImhpZXJhcmNoeV9jb25maWd1cmF0aW9uIiwicHJlZmVyZW5jZV9rZXkiLCJwZXJzaXN0ZW5jZSIsInN0cmluZ2lmeSIsInNlbGVjdGlvbiIsIndwYmNfdWlfY2F0YWxvZ19zZWxlY3Rpb24iLCJhdXRvX2xvYWQiLCJpbml0aWFsX3Jlc3BvbnNlIiwiY2xlYXJfc2VsZWN0aW9uIiwiY2xlYXIiLCJnZXRfc2VsZWN0ZWRfaWRzIiwiZ2V0X2hpZXJhcmNoeV9jb250cm9sbGVyIiwibG9hZCIsInNhdmVfcHJlZmVyZW5jZXMiLCJyZWZyZXNoX2NvbnRyb2xzIiwic3luY190YWJsZV9taW5fd2lkdGgiLCJuZXh0X3NlcXVlbmNlIiwid3BiY191aV9jYXRhbG9nIiwicmVxdWVzdCJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL19zaGFyZWQtdWktY2F0YWxvZy9fc3JjL3dwYmNfdWlfY2F0YWxvZy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENvbnRyb2wgc2hhcmVkIHJlcXVlc3Qgc2VxdWVuY2VzIGFuZCByZW5kZXIgbm9ybWFsaXplZCBjYXRhbG9nIHJlc3BvbnNlcy5cbiAqXG4gKiBEb21haW4gc2NyaXB0cyBwcm92aWRlIGNvbmZpZ3VyYXRpb24gYW5kIGRvbWFpbi1zcGVjaWZpYyBpbnRlcmFjdGlvbnMuIFRoaXNcbiAqIGNvbnRyb2xsZXIgb3ducyBvbmx5IGFsbG93LWxpc3RlZCBXUCB0ZW1wbGF0ZXMsIHNoYXJlZCByZXNwb25zZSB2YWxpZGF0aW9uLFxuICogbG9hZGluZywgZW1wdHksIHBvcHVsYXRlZCwgZXJyb3IsIGFuZCBzdGFsZS1yZXNwb25zZSBtZWNoYW5pY3MuXG4gKlxuICogQHNpbmNlIDExLjYuMFxuICovXG4oIGZ1bmN0aW9uICggd2luZG93LCBkb2N1bWVudCApIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdHZhciBjYXRhbG9nX3N0YXRlcyA9IHt9O1xuXG5cdC8qKlxuXHQgKiBSZXR1cm4gYSBub3JtYWxpemVkIG5vbi1uZWdhdGl2ZSByZXF1ZXN0IHNlcXVlbmNlLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IHNlcXVlbmNlIENhbmRpZGF0ZSByZXF1ZXN0IHNlcXVlbmNlLlxuXHQgKiBAcmV0dXJuIHtudW1iZXJ8bnVsbH0gU2VxdWVuY2Ugb3IgbnVsbCB3aGVuIG1hbGZvcm1lZC5cblx0ICovXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9zZXF1ZW5jZSggc2VxdWVuY2UgKSB7XG5cdFx0dmFyIG5vcm1hbGl6ZWRfc2VxdWVuY2U7XG5cblx0XHRpZiAoICdudW1iZXInID09PSB0eXBlb2Ygc2VxdWVuY2UgJiYgaXNGaW5pdGUoIHNlcXVlbmNlICkgJiYgTWF0aC5mbG9vciggc2VxdWVuY2UgKSA9PT0gc2VxdWVuY2UgKSB7XG5cdFx0XHRub3JtYWxpemVkX3NlcXVlbmNlID0gc2VxdWVuY2U7XG5cdFx0fSBlbHNlIGlmICggJ3N0cmluZycgPT09IHR5cGVvZiBzZXF1ZW5jZSAmJiAvXlxcZCskLy50ZXN0KCBzZXF1ZW5jZSApICkge1xuXHRcdFx0bm9ybWFsaXplZF9zZXF1ZW5jZSA9IHBhcnNlSW50KCBzZXF1ZW5jZSwgMTAgKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIDAgPD0gbm9ybWFsaXplZF9zZXF1ZW5jZSA/IG5vcm1hbGl6ZWRfc2VxdWVuY2UgOiBudWxsO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiBhIHN1cHBvcnRlZCBwb3NpdGl2ZSByZXNwb25zZSBzY2hlbWEgdmVyc2lvbi5cblx0ICpcblx0ICogV29yZFByZXNzIGxvY2FsaXplcyB0b3AtbGV2ZWwgc2NhbGFyIHZhbHVlcyBhcyBzdHJpbmdzLCBzbyB0aGUgcmVnaXN0ZXJlZFxuXHQgKiBjb25maWd1cmF0aW9uIG1heSBjb250YWluIFwiMVwiIHdoaWxlIHRoZSBuZXN0ZWQgcmVzcG9uc2UgcmV0YWlucyBudW1iZXIgMS5cblx0ICpcblx0ICogQHBhcmFtIHsqfSBzY2hlbWFfdmVyc2lvbiBDYW5kaWRhdGUgc2NoZW1hIHZlcnNpb24uXG5cdCAqIEByZXR1cm4ge251bWJlcnxudWxsfSBTdXBwb3J0ZWQgdmVyc2lvbiBvciBudWxsLlxuXHQgKi9cblx0ZnVuY3Rpb24gbm9ybWFsaXplX3NjaGVtYV92ZXJzaW9uKCBzY2hlbWFfdmVyc2lvbiApIHtcblx0XHR2YXIgbm9ybWFsaXplZF92ZXJzaW9uID0gbm9ybWFsaXplX3NlcXVlbmNlKCBzY2hlbWFfdmVyc2lvbiApO1xuXG5cdFx0cmV0dXJuIDEgPT09IG5vcm1hbGl6ZWRfdmVyc2lvbiA/IG5vcm1hbGl6ZWRfdmVyc2lvbiA6IG51bGw7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIG9uZSBjYXRhbG9nJ3MgcmVxdWVzdCBzdGF0ZS5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IGNhdGFsb2dfaWQgUmVnaXN0ZXJlZCBjYXRhbG9nIGlkZW50aWZpZXIuXG5cdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBNdXRhYmxlIGNhdGFsb2cgc3RhdGUgb3IgbnVsbC5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9jYXRhbG9nX3N0YXRlKCBjYXRhbG9nX2lkICkge1xuXHRcdGlmICggISBjYXRhbG9nX2lkIHx8ICdzdHJpbmcnICE9PSB0eXBlb2YgY2F0YWxvZ19pZCApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGlmICggISBjYXRhbG9nX3N0YXRlc1sgY2F0YWxvZ19pZCBdICkge1xuXHRcdFx0Y2F0YWxvZ19zdGF0ZXNbIGNhdGFsb2dfaWQgXSA9IHtcblx0XHRcdFx0YWN0aW9uc19jb250cm9sbGVyOiBudWxsLFxuXHRcdFx0XHRhYm9ydF9jb250cm9sbGVyOiBudWxsLFxuXHRcdFx0XHRjb25maWc6IG51bGwsXG5cdFx0XHRcdGNvbnRlbnRfZWxlbWVudDogbnVsbCxcblx0XHRcdFx0bGF0ZXN0X3NlcXVlbmNlOiAwLFxuXHRcdFx0XHRwcmVmZXJlbmNlX2Fib3J0X2NvbnRyb2xsZXI6IG51bGwsXG5cdFx0XHRcdHByZWZlcmVuY2VfcmV2aXNpb246IDAsXG5cdFx0XHRcdHJlcXVlc3RfdmFsdWVzOiB7fSxcblx0XHRcdFx0c2VhcmNoX3RpbWVyOiAwLFxuXHRcdFx0XHRzZWxlY3Rpb25fY29udHJvbGxlcjogbnVsbCxcblx0XHRcdFx0c29ydGFibGU6IG51bGxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGNhdGFsb2dfc3RhdGVzWyBjYXRhbG9nX2lkIF07XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIHRoZSByZWdpc3RlcmVkLCBib3VuZGVkIGRlbGF5IGZvciBhbiBpbmNyZW1lbnRhbCBzZWFyY2ggcmVxdWVzdC5cblx0ICpcblx0ICogU2VhcmNoIHRpbWluZyBpcyBhIGRvbWFpbi1uZXV0cmFsIGludGVyYWN0aW9uIG1lY2hhbmljLiBDYXRhbG9ncyBtYXkgdHVuZVxuXHQgKiB0aGUgZGVsYXkgdGhyb3VnaCB0aGVpciBzZXJ2ZXItbm9ybWFsaXplZCBjb25maWd1cmF0aW9uIHdpdGhvdXQgcmVwbGFjaW5nXG5cdCAqIHRoZSBzaGFyZWQgcmVxdWVzdCBjb250cm9sbGVyLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnIFJlZ2lzdGVyZWQgYnJvd3NlciBjb25maWd1cmF0aW9uLlxuXHQgKiBAcmV0dXJuIHtudW1iZXJ9IERlbGF5IGluIG1pbGxpc2Vjb25kcyBiZXR3ZWVuIHplcm8gYW5kIDIwMDAuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfc2VhcmNoX2RlYm91bmNlX2RlbGF5KCBjb25maWcgKSB7XG5cdFx0dmFyIHNlYXJjaF9jb25maWcgPSBjb25maWcgJiYgY29uZmlnLnNlYXJjaCAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIGNvbmZpZy5zZWFyY2ggPyBjb25maWcuc2VhcmNoIDoge307XG5cdFx0dmFyIGRlYm91bmNlX2RlbGF5ID0gTnVtYmVyKCBzZWFyY2hfY29uZmlnLmRlYm91bmNlX2RlbGF5X21zICk7XG5cblx0XHRpZiAoICEgaXNGaW5pdGUoIGRlYm91bmNlX2RlbGF5ICkgfHwgZGVib3VuY2VfZGVsYXkgPCAwICkge1xuXHRcdFx0cmV0dXJuIDMwMDtcblx0XHR9XG5cblx0XHRyZXR1cm4gTWF0aC5taW4oIDIwMDAsIE1hdGguZmxvb3IoIGRlYm91bmNlX2RlbGF5ICkgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBEZXRlcm1pbmUgd2hldGhlciBjbGVhcmluZyBzZWFyY2ggYnlwYXNzZXMgdGhlIGluY3JlbWVudGFsLXNlYXJjaCBkZWxheS5cblx0ICpcblx0ICogSW1tZWRpYXRlIGNsZWFyIHJlbWFpbnMgdGhlIGNvbXBhdGliaWxpdHkgZGVmYXVsdC4gQSBjYXRhbG9nIG1heSBkaXNhYmxlXG5cdCAqIGl0IG9ubHkgdGhyb3VnaCBzZXJ2ZXItbm9ybWFsaXplZCwgZG9tYWluLW5ldXRyYWwgc2VhcmNoIGNvbmZpZ3VyYXRpb24uXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgUmVnaXN0ZXJlZCBicm93c2VyIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBDbGVhciBtdXN0IHJlcXVlc3QgdW5maWx0ZXJlZCByZXN1bHRzIG5vdy5cblx0ICovXG5cdGZ1bmN0aW9uIGlzX2ltbWVkaWF0ZV9zZWFyY2hfY2xlYXJfZW5hYmxlZCggY29uZmlnICkge1xuXHRcdHJldHVybiAhIGNvbmZpZyB8fCAhIGNvbmZpZy5zZWFyY2ggfHwgZmFsc2UgIT09IGNvbmZpZy5zZWFyY2guaW1tZWRpYXRlX2NsZWFyO1xuXHR9XG5cblx0LyoqXG5cdCAqIFN0YXJ0IGEgbmV3IHJlcXVlc3Qgc2VxdWVuY2UgZm9yIG9uZSBjYXRhbG9nLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gY2F0YWxvZ19pZCBSZWdpc3RlcmVkIGNhdGFsb2cgaWRlbnRpZmllci5cblx0ICogQHJldHVybiB7bnVtYmVyfSBOZXcgc2VxdWVuY2UsIG9yIHplcm8gZm9yIGFuIGludmFsaWQgY2F0YWxvZy5cblx0ICovXG5cdGZ1bmN0aW9uIG5leHRfcmVxdWVzdF9zZXF1ZW5jZSggY2F0YWxvZ19pZCApIHtcblx0XHR2YXIgY2F0YWxvZ19zdGF0ZSA9IGdldF9jYXRhbG9nX3N0YXRlKCBjYXRhbG9nX2lkICk7XG5cblx0XHRpZiAoICEgY2F0YWxvZ19zdGF0ZSApIHtcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblxuXHRcdGNhdGFsb2dfc3RhdGUubGF0ZXN0X3NlcXVlbmNlICs9IDE7XG5cblx0XHRyZXR1cm4gY2F0YWxvZ19zdGF0ZS5sYXRlc3Rfc2VxdWVuY2U7XG5cdH1cblxuXHQvKipcblx0ICogRGV0ZXJtaW5lIHdoZXRoZXIgYSByZXNwb25zZSBiZWxvbmdzIHRvIGFuIG9sZGVyIHJlcXVlc3QuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBjYXRhbG9nX2lkIFJlZ2lzdGVyZWQgY2F0YWxvZyBpZGVudGlmaWVyLlxuXHQgKiBAcGFyYW0geyp9ICAgICAgc2VxdWVuY2UgICBSZXNwb25zZSByZXF1ZXN0IHNlcXVlbmNlLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIHJlc3BvbnNlIG11c3Qgbm90IHJlbmRlci5cblx0ICovXG5cdGZ1bmN0aW9uIGlzX3N0YWxlX3Jlc3BvbnNlKCBjYXRhbG9nX2lkLCBzZXF1ZW5jZSApIHtcblx0XHR2YXIgY2F0YWxvZ19zdGF0ZSA9IGdldF9jYXRhbG9nX3N0YXRlKCBjYXRhbG9nX2lkICk7XG5cdFx0dmFyIG5vcm1hbGl6ZWRfc2VxdWVuY2UgPSBub3JtYWxpemVfc2VxdWVuY2UoIHNlcXVlbmNlICk7XG5cblx0XHRyZXR1cm4gISBjYXRhbG9nX3N0YXRlIHx8IG51bGwgPT09IG5vcm1hbGl6ZWRfc2VxdWVuY2UgfHwgbm9ybWFsaXplZF9zZXF1ZW5jZSA8IGNhdGFsb2dfc3RhdGUubGF0ZXN0X3NlcXVlbmNlO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlc29sdmUgb25lIGFsbG93LWxpc3RlZCB0ZW1wbGF0ZSBpZGVudGlmaWVyIGZyb20gdGhlIGNvbmZpZ3VyYXRpb24uXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgICAgICAgIFJlZ2lzdGVyZWQgYnJvd3NlciBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGVfcm9sZSBUZW1wbGF0ZSByb2xlIHN1Y2ggYXMgZW1wdHkgb3IgZXJyb3IuXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gVGVtcGxhdGUgaWRlbnRpZmllciBvciBhbiBlbXB0eSBzdHJpbmcuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfdGVtcGxhdGVfaWQoIGNvbmZpZywgdGVtcGxhdGVfcm9sZSApIHtcblx0XHR2YXIgY2F0YWxvZ19zdGF0ZTtcblx0XHR2YXIgaW5pdGlhbF9yZXF1ZXN0O1xuXHRcdHZhciB0ZW1wbGF0ZV9pZCA9ICcnO1xuXHRcdHZhciB0ZW1wbGF0ZV9wYWNrO1xuXHRcdHZhciB0ZW1wbGF0ZV9wYWNrX2lkO1xuXG5cdFx0aWYgKCAhIGNvbmZpZyB8fCAhIGNvbmZpZy50ZW1wbGF0ZXMgfHwgJ3N0cmluZycgIT09IHR5cGVvZiB0ZW1wbGF0ZV9yb2xlICkge1xuXHRcdFx0cmV0dXJuICcnO1xuXHRcdH1cblxuXHRcdGlmICggJ3N0cmluZycgPT09IHR5cGVvZiBjb25maWcudGVtcGxhdGVzWyB0ZW1wbGF0ZV9yb2xlIF0gKSB7XG5cdFx0XHR0ZW1wbGF0ZV9pZCA9IGNvbmZpZy50ZW1wbGF0ZXNbIHRlbXBsYXRlX3JvbGUgXTtcblx0XHR9XG5cblx0XHRjYXRhbG9nX3N0YXRlICAgID0gKCBjb25maWcuY2F0YWxvZ19pZCB8fCBjb25maWcuaWQgKSA/IGdldF9jYXRhbG9nX3N0YXRlKCBjb25maWcuY2F0YWxvZ19pZCB8fCBjb25maWcuaWQgKSA6IG51bGw7XG5cdFx0aW5pdGlhbF9yZXF1ZXN0ICA9IGNvbmZpZy5pbml0aWFsX3JlcXVlc3QgfHwge307XG5cdFx0dGVtcGxhdGVfcGFja19pZCA9IGNhdGFsb2dfc3RhdGUgJiYgY2F0YWxvZ19zdGF0ZS5yZXF1ZXN0X3ZhbHVlcy50ZW1wbGF0ZV9wYWNrXG5cdFx0XHQ/IGNhdGFsb2dfc3RhdGUucmVxdWVzdF92YWx1ZXMudGVtcGxhdGVfcGFja1xuXHRcdFx0OiBpbml0aWFsX3JlcXVlc3QudGVtcGxhdGVfcGFjaztcblx0XHR0ZW1wbGF0ZV9wYWNrICAgID0gY29uZmlnLnRlbXBsYXRlX3BhY2tzICYmIGNvbmZpZy50ZW1wbGF0ZV9wYWNrc1sgdGVtcGxhdGVfcGFja19pZCBdO1xuXG5cdFx0aWYgKCB0ZW1wbGF0ZV9wYWNrICYmICdzdHJpbmcnID09PSB0eXBlb2YgdGVtcGxhdGVfcGFja1sgdGVtcGxhdGVfcm9sZSBdICkge1xuXHRcdFx0dGVtcGxhdGVfaWQgPSB0ZW1wbGF0ZV9wYWNrWyB0ZW1wbGF0ZV9yb2xlIF07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIC9eW2EtejAtOV8tXSskLy50ZXN0KCB0ZW1wbGF0ZV9pZCApID8gdGVtcGxhdGVfaWQgOiAnJztcblx0fVxuXG5cdC8qKlxuXHQgKiBTeW5jaHJvbml6ZSBvbmUgc2VydmVyLWF1dGhvcml0YXRpdmUgYWxsb3ctbGlzdGVkIHByZXNlbnRhdGlvbiBwYWNrLlxuXHQgKlxuXHQgKiBUaGUgYWN0aXZlIHBhY2sgaXMgc2hhcmVkIHByZXNlbnRhdGlvbiBzdGF0ZSBvbmx5LiBVcGRhdGluZyBpdCBiZWZvcmUgYW5cblx0ICogaXRlbXMgdGVtcGxhdGUgaXMgcmVzb2x2ZWQgYWxsb3dzIGFuIEFKQVggcmVzcG9uc2UgdG8gc3dpdGNoIG1hcmt1cCB3aGlsZVxuXHQgKiBsZWF2aW5nIHRoZSBwcm92aWRlciwgRFRPLCBhdXRob3JpemF0aW9uLCBhbmQgbXV0YXRpb24gcGF0aHMgdW5jaGFuZ2VkLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnICAgICAgICAgICBSZWdpc3RlcmVkIGJyb3dzZXIgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHsqfSAgICAgIHRlbXBsYXRlX3BhY2tfaWQgQ2FuZGlkYXRlIHBhY2sgaWRlbnRpZmllciBmcm9tIGEgcmVzcG9uc2UuXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gQWN0aXZlIGFsbG93LWxpc3RlZCBwYWNrIGlkZW50aWZpZXIuXG5cdCAqL1xuXHRmdW5jdGlvbiBzZXRfYWN0aXZlX3RlbXBsYXRlX3BhY2soIGNvbmZpZywgdGVtcGxhdGVfcGFja19pZCApIHtcblx0XHR2YXIgY2F0YWxvZ19yb290O1xuXHRcdHZhciBjYXRhbG9nX3N0YXRlID0gY29uZmlnICYmIGNvbmZpZy5jYXRhbG9nX2lkID8gZ2V0X2NhdGFsb2dfc3RhdGUoIGNvbmZpZy5jYXRhbG9nX2lkICkgOiBudWxsO1xuXHRcdHZhciBub3JtYWxpemVkX3BhY2tfaWQgPSAnc3RyaW5nJyA9PT0gdHlwZW9mIHRlbXBsYXRlX3BhY2tfaWQgPyB0ZW1wbGF0ZV9wYWNrX2lkIDogJyc7XG5cblx0XHRpZiAoICEgY2F0YWxvZ19zdGF0ZSB8fCAhIGNvbmZpZy50ZW1wbGF0ZV9wYWNrcyB8fCAhIGNvbmZpZy50ZW1wbGF0ZV9wYWNrc1sgbm9ybWFsaXplZF9wYWNrX2lkIF0gKSB7XG5cdFx0XHRub3JtYWxpemVkX3BhY2tfaWQgPSBjb25maWcgJiYgY29uZmlnLmRlZmF1bHRfdGVtcGxhdGVfcGFjayAmJiBjb25maWcudGVtcGxhdGVfcGFja3Ncblx0XHRcdFx0JiYgY29uZmlnLnRlbXBsYXRlX3BhY2tzWyBjb25maWcuZGVmYXVsdF90ZW1wbGF0ZV9wYWNrIF1cblx0XHRcdFx0PyBjb25maWcuZGVmYXVsdF90ZW1wbGF0ZV9wYWNrXG5cdFx0XHRcdDogJyc7XG5cdFx0fVxuXHRcdGlmICggISBub3JtYWxpemVkX3BhY2tfaWQgKSB7XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXG5cdFx0Y2F0YWxvZ19zdGF0ZS5yZXF1ZXN0X3ZhbHVlcy50ZW1wbGF0ZV9wYWNrID0gbm9ybWFsaXplZF9wYWNrX2lkO1xuXHRcdGNhdGFsb2dfcm9vdCA9IGNhdGFsb2dfc3RhdGUuY29udGVudF9lbGVtZW50XG5cdFx0XHQ/IGNhdGFsb2dfc3RhdGUuY29udGVudF9lbGVtZW50LmNsb3Nlc3QoICdbZGF0YS13cGJjLWNhdGFsb2ctaWRdJyApXG5cdFx0XHQ6IG51bGw7XG5cdFx0aWYgKCBjYXRhbG9nX3Jvb3QgKSB7XG5cdFx0XHRjYXRhbG9nX3Jvb3Quc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRlbXBsYXRlLXBhY2snLCBub3JtYWxpemVkX3BhY2tfaWQgKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbm9ybWFsaXplZF9wYWNrX2lkO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbXBpbGUgb25lIGFsbG93LWxpc3RlZCBXb3JkUHJlc3MgdGVtcGxhdGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgICAgICAgIFJlZ2lzdGVyZWQgYnJvd3NlciBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGVfcm9sZSBUZW1wbGF0ZSByb2xlLlxuXHQgKiBAcmV0dXJuIHtGdW5jdGlvbnxudWxsfSBDb21waWxlZCB0ZW1wbGF0ZSBvciBudWxsLlxuXHQgKi9cblx0ZnVuY3Rpb24gbG9hZF90ZW1wbGF0ZSggY29uZmlnLCB0ZW1wbGF0ZV9yb2xlICkge1xuXHRcdHZhciB0ZW1wbGF0ZV9pZCA9IGdldF90ZW1wbGF0ZV9pZCggY29uZmlnLCB0ZW1wbGF0ZV9yb2xlICk7XG5cblx0XHRpZiAoICEgdGVtcGxhdGVfaWQgfHwgISB3aW5kb3cud3AgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy53cC50ZW1wbGF0ZSApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gd2luZG93LndwLnRlbXBsYXRlKCB0ZW1wbGF0ZV9pZCApO1xuXHRcdH0gY2F0Y2ggKCBlcnJvciApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBSZXBsYWNlIG9uZSBjYXRhbG9nJ3MgY3VycmVudCBwcmVzZW50YXRpb24gd2l0aCByZW5kZXJlZCB0ZW1wbGF0ZSBvdXRwdXQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgICAgICAgIFJlZ2lzdGVyZWQgYnJvd3NlciBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGVfcm9sZSBBbGxvdy1saXN0ZWQgdGVtcGxhdGUgcm9sZS5cblx0ICogQHBhcmFtIHtPYmplY3R9IHRlbXBsYXRlX2RhdGEgTm9ybWFsaXplZCB0ZW1wbGF0ZSBkYXRhLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gcmVuZGVyZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiByZW5kZXJfdGVtcGxhdGUoIGNvbmZpZywgdGVtcGxhdGVfcm9sZSwgdGVtcGxhdGVfZGF0YSApIHtcblx0XHR2YXIgY2F0YWxvZ19yb290O1xuXHRcdHZhciBjYXRhbG9nX3N0YXRlID0gZ2V0X2NhdGFsb2dfc3RhdGUoIGNvbmZpZy5jYXRhbG9nX2lkICk7XG5cdFx0dmFyIHJlbmRlcl90YXJnZXQ7XG5cdFx0dmFyIHJlbmRlcmVkX2h0bWw7XG5cdFx0dmFyIHRlbXBsYXRlID0gbG9hZF90ZW1wbGF0ZSggY29uZmlnLCB0ZW1wbGF0ZV9yb2xlICk7XG5cblx0XHRpZiAoICEgY2F0YWxvZ19zdGF0ZSB8fCAhIGNhdGFsb2dfc3RhdGUuY29udGVudF9lbGVtZW50IHx8ICEgdGVtcGxhdGUgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdHJlbmRlcmVkX2h0bWwgPSB0ZW1wbGF0ZSggdGVtcGxhdGVfZGF0YSB8fCB7fSApO1xuXHRcdH0gY2F0Y2ggKCBlcnJvciApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZW5kZXJfdGFyZ2V0ID0gY2F0YWxvZ19zdGF0ZS5yZXNwb25zZV9lbGVtZW50IHx8IGNhdGFsb2dfc3RhdGUuY29udGVudF9lbGVtZW50O1xuXHRcdGRpc3BhdGNoX2NhdGFsb2dfZXZlbnQoIGNvbmZpZywgJ3dwYmM6dWktY2F0YWxvZy1iZWZvcmUtcmVuZGVyJywge1xuXHRcdFx0Y2F0YWxvZ19pZDogY29uZmlnLmNhdGFsb2dfaWQsXG5cdFx0XHR0ZW1wbGF0ZV9yb2xlOiB0ZW1wbGF0ZV9yb2xlXG5cdFx0fSApO1xuXHRcdHJlbmRlcl90YXJnZXQuaW5uZXJIVE1MID0gcmVuZGVyZWRfaHRtbDtcblx0XHRjYXRhbG9nX3Jvb3QgPSBjYXRhbG9nX3N0YXRlLmNvbnRlbnRfZWxlbWVudC5wYXJlbnROb2RlO1xuXHRcdGlmICggY2F0YWxvZ19yb290ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBjYXRhbG9nX3Jvb3Quc2V0QXR0cmlidXRlICkge1xuXHRcdFx0Y2F0YWxvZ19yb290LnNldEF0dHJpYnV0ZSggJ2FyaWEtYnVzeScsICdzaGVsbCcgPT09IHRlbXBsYXRlX3JvbGUgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0fVxuXHRcdGlmICggJ3NoZWxsJyAhPT0gdGVtcGxhdGVfcm9sZSApIHtcblx0XHRcdHNldF9jYXRhbG9nX2xvYWRpbmdfc3RhdGUoIGNvbmZpZywgZmFsc2UgKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBUb2dnbGUgYSBwZXJzaXN0ZW50IGNhdGFsb2cgb3ZlcmxheSB3aXRob3V0IHJlbW92aW5nIHRoZSBjdXJyZW50IHJvd3MuXG5cdCAqXG5cdCAqIENhdGFsb2dzIHdpdGggYSBkZWRpY2F0ZWQgb3ZlcmxheSBrZWVwIHRoZWlyIGV4aXN0aW5nIHRhYmxlIHZpc2libGUgYmVuZWF0aFxuXHQgKiB0aGUgQm9va2luZyBDYWxlbmRhciBzcGlubmVyLiBHZW5lcmljIGNhdGFsb2dzIHJldGFpbiB0aGUgc2hlbGwtdGVtcGxhdGVcblx0ICogZmFsbGJhY2sgd2hlbiBubyBvdmVybGF5IGlzIGRlY2xhcmVkLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gIGNvbmZpZyAgICAgUmVnaXN0ZXJlZCBicm93c2VyIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfbG9hZGluZyBXaGV0aGVyIGEgcmVxdWVzdCBpcyBhY3RpdmUuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBhIHBlcnNpc3RlbnQgb3ZlcmxheSB3YXMgdXBkYXRlZC5cblx0ICovXG5cdGZ1bmN0aW9uIHNldF9jYXRhbG9nX2xvYWRpbmdfc3RhdGUoIGNvbmZpZywgaXNfbG9hZGluZyApIHtcblx0XHR2YXIgY2F0YWxvZ19zdGF0ZSA9IGNvbmZpZyAmJiBjb25maWcuY2F0YWxvZ19pZCA/IGdldF9jYXRhbG9nX3N0YXRlKCBjb25maWcuY2F0YWxvZ19pZCApIDogbnVsbDtcblx0XHR2YXIgbG9hZGluZ19lbGVtZW50ID0gY2F0YWxvZ19zdGF0ZSA/IGNhdGFsb2dfc3RhdGUubG9hZGluZ19lbGVtZW50IDogbnVsbDtcblxuXHRcdGlmICggY2F0YWxvZ19zdGF0ZSAmJiBjYXRhbG9nX3N0YXRlLmNvbnRlbnRfZWxlbWVudCApIHtcblx0XHRcdGNhdGFsb2dfc3RhdGUuY29udGVudF9lbGVtZW50LnNldEF0dHJpYnV0ZSggJ2FyaWEtYnVzeScsIGlzX2xvYWRpbmcgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0fVxuXHRcdGlmICggISBsb2FkaW5nX2VsZW1lbnQgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0bG9hZGluZ19lbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoICdpcy12aXNpYmxlJywgISEgaXNfbG9hZGluZyApO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0LyoqXG5cdCAqIFNldCB0aGUgdGFibGUgbWluaW11bSB3aWR0aCBmcm9tIGN1cnJlbnRseSB2aXNpYmxlIGhlYWRlciBjb250cmFjdHMuXG5cdCAqXG5cdCAqIERvbWFpbiBzdHlsZXMgZGVjbGFyZSBgLS13cGJjLWxpc3RpbmctY29sdW1uLW1pbi13aWR0aGAgcGVyIGNvbHVtbi4gVGhlXG5cdCAqIHNoYXJlZCBjb250cm9sbGVyIHN1bXMgb25seSByZW5kZXJlZCBoZWFkZXJzIHNvIHdpZGUvY3VzdG9tIHZpZXdzIHNjcm9sbFxuXHQgKiBob3Jpem9udGFsbHkgd2hpbGUgc2hvcnQgcHJlc2V0cyBjb250aW51ZSBmaWxsaW5nIHRoZSBhdmFpbGFibGUgcGFuZWwuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgUmVnaXN0ZXJlZCBicm93c2VyIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzeW5jX2NhdGFsb2dfdGFibGVfbWluX3dpZHRoKCBjb25maWcgKSB7XG5cdFx0dmFyIG1vdW50X2VsZW1lbnQgPSBjb25maWcgJiYgY29uZmlnLm1vdW50X2lkID8gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIGNvbmZpZy5tb3VudF9pZCApIDogbnVsbDtcblx0XHR2YXIgdGFibGUgPSBtb3VudF9lbGVtZW50ID8gbW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfdWlfbGlzdGluZ19fdGFibGUtLWNhdGFsb2cnICkgOiBudWxsO1xuXHRcdHZhciBoZWFkZXJfY2VsbHM7XG5cdFx0dmFyIHRhYmxlX21pbl93aWR0aCA9IDA7XG5cblx0XHRpZiAoICEgdGFibGUgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRoZWFkZXJfY2VsbHMgPSBBcnJheS5wcm90b3R5cGUuZmlsdGVyLmNhbGwoIHRhYmxlLnF1ZXJ5U2VsZWN0b3JBbGwoICd0aGVhZCA+IHRyID4gdGgnICksIGZ1bmN0aW9uICggaGVhZGVyX2NlbGwgKSB7XG5cdFx0XHRyZXR1cm4gISBoZWFkZXJfY2VsbC5oaWRkZW47XG5cdFx0fSApO1xuXHRcdGhlYWRlcl9jZWxscy5mb3JFYWNoKCBmdW5jdGlvbiAoIGhlYWRlcl9jZWxsICkge1xuXHRcdFx0dmFyIGNvbHVtbl9taW5fd2lkdGggPSBwYXJzZUZsb2F0KFxuXHRcdFx0XHR3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSggaGVhZGVyX2NlbGwgKS5nZXRQcm9wZXJ0eVZhbHVlKCAnLS13cGJjLWxpc3RpbmctY29sdW1uLW1pbi13aWR0aCcgKVxuXHRcdFx0KTtcblx0XHRcdGlmICggaXNGaW5pdGUoIGNvbHVtbl9taW5fd2lkdGggKSAmJiAwIDwgY29sdW1uX21pbl93aWR0aCApIHtcblx0XHRcdFx0dGFibGVfbWluX3dpZHRoICs9IGNvbHVtbl9taW5fd2lkdGg7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHRcdGlmICggMCA8IHRhYmxlX21pbl93aWR0aCApIHtcblx0XHRcdHRhYmxlLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjLWxpc3RpbmctdGFibGUtbWluLXdpZHRoJywgTWF0aC5jZWlsKCB0YWJsZV9taW5fd2lkdGggKSArICdweCcgKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogS2VlcCB0aGUgb3BlbiBjb2x1bW4gY3VzdG9taXplciBpbnNpZGUgdGhlIHVzYWJsZSBicm93c2VyIHZpZXdwb3J0LlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxEZXRhaWxzRWxlbWVudH0gY3VzdG9taXplciBDb2x1bW4gY3VzdG9taXplciBkZXRhaWxzIGVsZW1lbnQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBwb3NpdGlvbl9kaXNwbGF5X3BhbmVsKCBjdXN0b21pemVyICkge1xuXHRcdHZhciBwYW5lbCA9IGN1c3RvbWl6ZXIgPyBjdXN0b21pemVyLnF1ZXJ5U2VsZWN0b3IoICcud3BiY191aV9saXN0aW5nX19kaXNwbGF5X3BhbmVsJyApIDogbnVsbDtcblx0XHR2YXIgc3VtbWFyeSA9IGN1c3RvbWl6ZXIgPyBjdXN0b21pemVyLnF1ZXJ5U2VsZWN0b3IoICdzdW1tYXJ5JyApIDogbnVsbDtcblx0XHR2YXIgZmllbGRfbGlzdCA9IGN1c3RvbWl6ZXIgPyBjdXN0b21pemVyLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctY29sdW1uLWxpc3RdJyApIDogbnVsbDtcblx0XHR2YXIgc3VtbWFyeV9yZWN0O1xuXHRcdHZhciBwYW5lbF9yZWN0O1xuXHRcdHZhciB2aWV3cG9ydF93aWR0aDtcblx0XHR2YXIgdmlld3BvcnRfaGVpZ2h0O1xuXHRcdHZhciBtYXJnaW4gPSAxMjtcblx0XHR2YXIgZ2FwID0gNjtcblx0XHR2YXIgc3BhY2VfYWJvdmU7XG5cdFx0dmFyIHNwYWNlX2JlbG93O1xuXHRcdHZhciBuYXR1cmFsX2hlaWdodDtcblx0XHR2YXIgb3Blbl9hYm92ZTtcblx0XHR2YXIgYXZhaWxhYmxlX2hlaWdodDtcblx0XHR2YXIgcmVuZGVyZWRfaGVpZ2h0O1xuXHRcdHZhciBwYW5lbF9sZWZ0O1xuXHRcdHZhciBwYW5lbF90b3A7XG5cblx0XHRpZiAoICEgY3VzdG9taXplciB8fCAhIGN1c3RvbWl6ZXIub3BlbiB8fCAhIHBhbmVsIHx8ICEgc3VtbWFyeSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjdXN0b21pemVyLmNsYXNzTGlzdC5yZW1vdmUoICdpcy1wb3NpdGlvbmVkJyApO1xuXHRcdHBhbmVsLnN0eWxlLnJlbW92ZVByb3BlcnR5KCAnLS13cGJjLWxpc3RpbmctZGlzcGxheS1wYW5lbC1tYXgtaGVpZ2h0JyApO1xuXHRcdHBhbmVsLnN0eWxlLnJlbW92ZVByb3BlcnR5KCAnbGVmdCcgKTtcblx0XHRwYW5lbC5zdHlsZS5yZW1vdmVQcm9wZXJ0eSggJ3RvcCcgKTtcblx0XHRzdW1tYXJ5X3JlY3QgPSBzdW1tYXJ5LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdHBhbmVsX3JlY3QgPSBwYW5lbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHR2aWV3cG9ydF93aWR0aCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRXaWR0aCB8fCB3aW5kb3cuaW5uZXJXaWR0aCB8fCAwO1xuXHRcdHZpZXdwb3J0X2hlaWdodCA9IHdpbmRvdy5pbm5lckhlaWdodCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50SGVpZ2h0IHx8IDA7XG5cdFx0c3BhY2VfYWJvdmUgPSBNYXRoLm1heCggMCwgc3VtbWFyeV9yZWN0LnRvcCAtIG1hcmdpbiAtIGdhcCApO1xuXHRcdHNwYWNlX2JlbG93ID0gTWF0aC5tYXgoIDAsIHZpZXdwb3J0X2hlaWdodCAtIHN1bW1hcnlfcmVjdC5ib3R0b20gLSBtYXJnaW4gLSBnYXAgKTtcblx0XHRuYXR1cmFsX2hlaWdodCA9IHBhbmVsLnNjcm9sbEhlaWdodDtcblx0XHRpZiAoIGZpZWxkX2xpc3QgKSB7XG5cdFx0XHRuYXR1cmFsX2hlaWdodCArPSBNYXRoLm1heCggMCwgZmllbGRfbGlzdC5zY3JvbGxIZWlnaHQgLSBmaWVsZF9saXN0LmNsaWVudEhlaWdodCApO1xuXHRcdH1cblx0XHRvcGVuX2Fib3ZlID0gc3BhY2VfYmVsb3cgPCBuYXR1cmFsX2hlaWdodCAmJiBzcGFjZV9hYm92ZSA+IHNwYWNlX2JlbG93O1xuXHRcdGF2YWlsYWJsZV9oZWlnaHQgPSBvcGVuX2Fib3ZlID8gc3BhY2VfYWJvdmUgOiBzcGFjZV9iZWxvdztcblx0XHRjdXN0b21pemVyLmNsYXNzTGlzdC50b2dnbGUoICdpcy1vcGVuLWFib3ZlJywgb3Blbl9hYm92ZSApO1xuXHRcdHBhbmVsLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjLWxpc3RpbmctZGlzcGxheS1wYW5lbC1tYXgtaGVpZ2h0JywgTWF0aC5mbG9vciggYXZhaWxhYmxlX2hlaWdodCApICsgJ3B4JyApO1xuXHRcdHJlbmRlcmVkX2hlaWdodCA9IHBhbmVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmhlaWdodDtcblx0XHRwYW5lbF9sZWZ0ID0gTWF0aC5tYXgoIG1hcmdpbiwgTWF0aC5taW4oIHN1bW1hcnlfcmVjdC5yaWdodCAtIHBhbmVsX3JlY3Qud2lkdGgsIHZpZXdwb3J0X3dpZHRoIC0gcGFuZWxfcmVjdC53aWR0aCAtIG1hcmdpbiApICk7XG5cdFx0cGFuZWxfdG9wID0gb3Blbl9hYm92ZSA/IHN1bW1hcnlfcmVjdC50b3AgLSBnYXAgLSByZW5kZXJlZF9oZWlnaHQgOiBzdW1tYXJ5X3JlY3QuYm90dG9tICsgZ2FwO1xuXHRcdHBhbmVsX3RvcCA9IE1hdGgubWF4KCBtYXJnaW4sIE1hdGgubWluKCBwYW5lbF90b3AsIHZpZXdwb3J0X2hlaWdodCAtIHJlbmRlcmVkX2hlaWdodCAtIG1hcmdpbiApICk7XG5cdFx0cGFuZWwuc3R5bGUuc2V0UHJvcGVydHkoICdsZWZ0JywgTWF0aC5yb3VuZCggcGFuZWxfbGVmdCApICsgJ3B4JyApO1xuXHRcdHBhbmVsLnN0eWxlLnNldFByb3BlcnR5KCAndG9wJywgTWF0aC5yb3VuZCggcGFuZWxfdG9wICkgKyAncHgnICk7XG5cdFx0Y3VzdG9taXplci5jbGFzc0xpc3QuYWRkKCAnaXMtcG9zaXRpb25lZCcgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDbGVhciBmaXhlZCBjb2x1bW4tcGFuZWwgY29vcmRpbmF0ZXMgYWZ0ZXIgdGhlIGN1c3RvbWl6ZXIgY2xvc2VzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxEZXRhaWxzRWxlbWVudH0gY3VzdG9taXplciBDb2x1bW4gY3VzdG9taXplciBkZXRhaWxzIGVsZW1lbnQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiByZXNldF9kaXNwbGF5X3BhbmVsX3Bvc2l0aW9uKCBjdXN0b21pemVyICkge1xuXHRcdHZhciBwYW5lbCA9IGN1c3RvbWl6ZXIgPyBjdXN0b21pemVyLnF1ZXJ5U2VsZWN0b3IoICcud3BiY191aV9saXN0aW5nX19kaXNwbGF5X3BhbmVsJyApIDogbnVsbDtcblxuXHRcdGlmICggISBjdXN0b21pemVyIHx8ICEgcGFuZWwgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGN1c3RvbWl6ZXIuY2xhc3NMaXN0LnJlbW92ZSggJ2lzLW9wZW4tYWJvdmUnLCAnaXMtcG9zaXRpb25lZCcgKTtcblx0XHRwYW5lbC5zdHlsZS5yZW1vdmVQcm9wZXJ0eSggJy0td3BiYy1saXN0aW5nLWRpc3BsYXktcGFuZWwtbWF4LWhlaWdodCcgKTtcblx0XHRwYW5lbC5zdHlsZS5yZW1vdmVQcm9wZXJ0eSggJ2xlZnQnICk7XG5cdFx0cGFuZWwuc3R5bGUucmVtb3ZlUHJvcGVydHkoICd0b3AnICk7XG5cdH1cblxuXHQvKipcblx0ICogQ2xvc2Ugb25lIGNvbHVtbiBjdXN0b21pemVyIGFuZCBvcHRpb25hbGx5IHJldHVybiBmb2N1cyB0byBpdHMgc3VtbWFyeS5cblx0ICpcblx0ICogS2V5Ym9hcmQgYW5kIGV4cGxpY2l0IENsb3NlLWJ1dHRvbiBkaXNtaXNzYWwgcmVzdG9yZSBmb2N1cyB0byB0aGUgY29udHJvbFxuXHQgKiB0aGF0IG9wZW5lZCB0aGUgcGFuZWwuIFBvaW50ZXIgZGlzbWlzc2FsIGtlZXBzIHRoZSBwb2ludGVyJ3MgbmF0dXJhbCBmb2N1c1xuXHQgKiBkZXN0aW5hdGlvbiB3aGlsZSBzaGFyaW5nIHRoZSBzYW1lIGRldGFpbHMtdG9nZ2xlIGNsZWFudXAgcGF0aC5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRGV0YWlsc0VsZW1lbnR8bnVsbH0gY3VzdG9taXplciAgICBDb2x1bW4gY3VzdG9taXplciBkZXRhaWxzIGVsZW1lbnQuXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gICAgICAgICAgICAgICAgIHJlc3RvcmVfZm9jdXMgV2hldGhlciBzdW1tYXJ5IGZvY3VzIGlzIHJlc3RvcmVkLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gY2xvc2VfZGlzcGxheV9jdXN0b21pemVyKCBjdXN0b21pemVyLCByZXN0b3JlX2ZvY3VzICkge1xuXHRcdHZhciBzdW1tYXJ5O1xuXG5cdFx0aWYgKCAhIGN1c3RvbWl6ZXIgfHwgISBjdXN0b21pemVyLm9wZW4gKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGN1c3RvbWl6ZXIub3BlbiA9IGZhbHNlO1xuXHRcdGlmICggISByZXN0b3JlX2ZvY3VzICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRzdW1tYXJ5ID0gY3VzdG9taXplci5xdWVyeVNlbGVjdG9yKCAnc3VtbWFyeScgKTtcblx0XHRpZiAoIHN1bW1hcnkgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHN1bW1hcnkuZm9jdXMgKSB7XG5cdFx0XHRzdW1tYXJ5LmZvY3VzKCk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFJlbmRlciBhIGdlbmVyaWMgc2FmZSBicm93c2VyIGVycm9yLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnICBSZWdpc3RlcmVkIGJyb3dzZXIgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgU2FmZSBsb2NhbGl6ZWQgZXJyb3IgbWVzc2FnZS5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHJlbmRlcmVkLlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVuZGVyX2Vycm9yKCBjb25maWcsIG1lc3NhZ2UgKSB7XG5cdFx0dmFyIGkxOG4gPSBjb25maWcuaTE4biB8fCB7fTtcblxuXHRcdHJldHVybiByZW5kZXJfdGVtcGxhdGUoIGNvbmZpZywgJ2Vycm9yJywge1xuXHRcdFx0dGl0bGU6IGkxOG4uZXJyb3JfdGl0bGUgfHwgJycsXG5cdFx0XHRtZXNzYWdlOiBtZXNzYWdlIHx8IGkxOG4uZXJyb3JfbWVzc2FnZSB8fCAnJ1xuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBEaXNwYXRjaCBvbmUgc2hhcmVkIGNhdGFsb2cgbGlmZWN5Y2xlIGV2ZW50IGZyb20gdGhlIGN1cnJlbnQgbW91bnQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgICAgIFJlZ2lzdGVyZWQgYnJvd3NlciBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnRfbmFtZSBTdGFibGUgc2hhcmVkIGV2ZW50IG5hbWUuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBkZXRhaWwgICAgIEpTT04tc2FmZSBldmVudCBkZXRhaWwuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgZXZlbnQgd2FzIGRpc3BhdGNoZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiBkaXNwYXRjaF9jYXRhbG9nX2V2ZW50KCBjb25maWcsIGV2ZW50X25hbWUsIGRldGFpbCApIHtcblx0XHR2YXIgY2F0YWxvZ19ldmVudDtcblx0XHR2YXIgY2F0YWxvZ19zdGF0ZSA9IGdldF9jYXRhbG9nX3N0YXRlKCBjb25maWcuY2F0YWxvZ19pZCApO1xuXG5cdFx0aWYgKCAhIGNhdGFsb2dfc3RhdGUgfHwgISBjYXRhbG9nX3N0YXRlLmNvbnRlbnRfZWxlbWVudCB8fCAnc3RyaW5nJyAhPT0gdHlwZW9mIGV2ZW50X25hbWUgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LkN1c3RvbUV2ZW50ICkge1xuXHRcdFx0Y2F0YWxvZ19ldmVudCA9IG5ldyB3aW5kb3cuQ3VzdG9tRXZlbnQoIGV2ZW50X25hbWUsIHtcblx0XHRcdFx0YnViYmxlczogdHJ1ZSxcblx0XHRcdFx0ZGV0YWlsOiBkZXRhaWwgfHwge31cblx0XHRcdH0gKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y2F0YWxvZ19ldmVudCA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCAnQ3VzdG9tRXZlbnQnICk7XG5cdFx0XHRjYXRhbG9nX2V2ZW50LmluaXRDdXN0b21FdmVudCggZXZlbnRfbmFtZSwgdHJ1ZSwgZmFsc2UsIGRldGFpbCB8fCB7fSApO1xuXHRcdH1cblxuXHRcdGNhdGFsb2dfc3RhdGUuY29udGVudF9lbGVtZW50LmRpc3BhdGNoRXZlbnQoIGNhdGFsb2dfZXZlbnQgKTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFwcGVuZCBvbmUgbm9ybWFsaXplZCByZXF1ZXN0IHZhbHVlIHRvIGEgVVJMLWVuY29kZWQgQUpBWCBib2R5LlxuXHQgKlxuXHQgKiBAcGFyYW0ge1VSTFNlYXJjaFBhcmFtc30gcmVxdWVzdF9ib2R5ICBSZXF1ZXN0IGJvZHkgcmVjZWl2aW5nIHZhbHVlcy5cblx0ICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgIHJlcXVlc3Rfa2V5ICAgTm9ybWFsaXplZCByZXF1ZXN0IGtleS5cblx0ICogQHBhcmFtIHsqfSAgICAgICAgICAgICAgIHJlcXVlc3RfdmFsdWUgU2NhbGFyIG9yIHNjYWxhci1hcnJheSB2YWx1ZS5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGFwcGVuZF9yZXF1ZXN0X3ZhbHVlKCByZXF1ZXN0X2JvZHksIHJlcXVlc3Rfa2V5LCByZXF1ZXN0X3ZhbHVlICkge1xuXHRcdGlmICggQXJyYXkuaXNBcnJheSggcmVxdWVzdF92YWx1ZSApICkge1xuXHRcdFx0cmVxdWVzdF92YWx1ZS5mb3JFYWNoKCBmdW5jdGlvbiAoIGFycmF5X3ZhbHVlICkge1xuXHRcdFx0XHRpZiAoIG51bGwgIT09IGFycmF5X3ZhbHVlICYmICdvYmplY3QnICE9PSB0eXBlb2YgYXJyYXlfdmFsdWUgKSB7XG5cdFx0XHRcdFx0cmVxdWVzdF9ib2R5LmFwcGVuZCggcmVxdWVzdF9rZXkgKyAnW10nLCBTdHJpbmcoIGFycmF5X3ZhbHVlICkgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICggbnVsbCAhPT0gcmVxdWVzdF92YWx1ZSAmJiAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHJlcXVlc3RfdmFsdWUgJiYgJ29iamVjdCcgIT09IHR5cGVvZiByZXF1ZXN0X3ZhbHVlICkge1xuXHRcdFx0cmVxdWVzdF9ib2R5LmFwcGVuZCggcmVxdWVzdF9rZXksIFN0cmluZyggcmVxdWVzdF92YWx1ZSApICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiBvcmRlcmVkIGNvbHVtbiBJRHMgZnJvbSB0aGUgY3VycmVudCBkaXNwbGF5IGNvbnRyb2xzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBtb3VudF9lbGVtZW50IENhdGFsb2cgbW91bnQgZWxlbWVudC5cblx0ICogQHJldHVybiB7c3RyaW5nW119IEN1cnJlbnQgY29sdW1uIG9yZGVyLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X2NvbHVtbl9vcmRlciggbW91bnRfZWxlbWVudCApIHtcblx0XHRyZXR1cm4gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoIG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1jb2x1bW4taXRlbV0nICkgKS5tYXAoIGZ1bmN0aW9uICggY29sdW1uX2l0ZW0gKSB7XG5cdFx0XHRyZXR1cm4gY29sdW1uX2l0ZW0uZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctY29sdW1uLWl0ZW0nICkgfHwgJyc7XG5cdFx0fSApLmZpbHRlciggZnVuY3Rpb24gKCBjb2x1bW5faWQgKSB7XG5cdFx0XHRyZXR1cm4gISEgY29sdW1uX2lkO1xuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gdmlzaWJsZSBjb2x1bW4gSURzIGZyb20gdGhlIGN1cnJlbnQgZGlzcGxheSBjb250cm9scy5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbW91bnRfZWxlbWVudCBDYXRhbG9nIG1vdW50IGVsZW1lbnQuXG5cdCAqIEByZXR1cm4ge3N0cmluZ1tdfSBDdXJyZW50IHZpc2libGUgY29sdW1ucy5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF92aXNpYmxlX2NvbHVtbnMoIG1vdW50X2VsZW1lbnQgKSB7XG5cdFx0cmV0dXJuIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKCBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctY29sdW1uLXZpc2libGVdJyApICkuZmlsdGVyKCBmdW5jdGlvbiAoIGNvbHVtbl9jb250cm9sICkge1xuXHRcdFx0cmV0dXJuIGNvbHVtbl9jb250cm9sLmNoZWNrZWQ7XG5cdFx0fSApLm1hcCggZnVuY3Rpb24gKCBjb2x1bW5fY29udHJvbCApIHtcblx0XHRcdHJldHVybiBjb2x1bW5fY29udHJvbC52YWx1ZTtcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogUmVxdWVzdCB0aGUgY3VycmVudCBjb2x1bW4gY29udHJvbHMgYW5kIHBlcnNpc3QgdGhlIHZhbGlkYXRlZCByZXN1bHQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGNvbmZpZyAgICAgICAgUmVnaXN0ZXJlZCBicm93c2VyIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IG1vdW50X2VsZW1lbnQgQ2F0YWxvZyBtb3VudCBlbGVtZW50LlxuXHQgKiBAcmV0dXJuIHtQcm9taXNlPGJvb2xlYW4+fSBTaGFyZWQgcmVxdWVzdCByZXN1bHQuXG5cdCAqL1xuXHRmdW5jdGlvbiBzYXZlX2NvbHVtbl9jb250cm9scyggY29uZmlnLCBtb3VudF9lbGVtZW50ICkge1xuXHRcdHZhciB2aWV3X2NvbnRyb2wgPSBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctdmlld10nICk7XG5cblx0XHRpZiAoIHZpZXdfY29udHJvbCApIHtcblx0XHRcdHZpZXdfY29udHJvbC52YWx1ZSA9ICdjdXN0b20nO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXF1ZXN0X2NhdGFsb2coIGNvbmZpZywge1xuXHRcdFx0Y29sdW1uX29yZGVyOiBnZXRfY29sdW1uX29yZGVyKCBtb3VudF9lbGVtZW50ICksXG5cdFx0XHRwYWdlX251bWJlcjogMSxcblx0XHRcdHByZWZlcmVuY2VfYWN0aW9uOiAnc2F2ZScsXG5cdFx0XHR2aXNpYmxlX2NvbHVtbnM6IGdldF92aXNpYmxlX2NvbHVtbnMoIG1vdW50X2VsZW1lbnQgKVxuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBbm5vdW5jZSBhIGNvbXBsZXRlZCBjb2x1bW4tb3JkZXIgY2hhbmdlIHRvIGFzc2lzdGl2ZSB0ZWNobm9sb2d5LlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBjb25maWcgICAgICAgIFJlZ2lzdGVyZWQgYnJvd3NlciBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBtb3VudF9lbGVtZW50IENhdGFsb2cgbW91bnQgZWxlbWVudC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGFubm91bmNlX2NvbHVtbl9tb3ZlZCggY29uZmlnLCBtb3VudF9lbGVtZW50ICkge1xuXHRcdHZhciBzdGF0dXNfZWxlbWVudCA9IG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1jb2x1bW4tc3RhdHVzXScgKTtcblxuXHRcdGlmICggISBzdGF0dXNfZWxlbWVudCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0c3RhdHVzX2VsZW1lbnQudGV4dENvbnRlbnQgPSAnJztcblx0XHR3aW5kb3cuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xuXHRcdFx0c3RhdHVzX2VsZW1lbnQudGV4dENvbnRlbnQgPSBjb25maWcuaTE4biAmJiBjb25maWcuaTE4bi5jb2x1bW5fbW92ZWQgPyBjb25maWcuaTE4bi5jb2x1bW5fbW92ZWQgOiAnJztcblx0XHR9LCAwICk7XG5cdH1cblxuXHQvKipcblx0ICogU3luY2hyb25pemUgdGhlIGN1cnJlbnQgY2F0YWxvZyBzdGF0ZSBpbnRvIHRoZSBpbml0aWFsIFVSTCBhbGlhc2VzLlxuXHQgKlxuXHQgKiBTZWFyY2ggYW5kIHBhZ2UgbnVtYmVyIHJlbWFpbiByZXF1ZXN0LWxvY2FsIGJ1dCBzdXJ2aXZlIGEgbm9ybWFsIHJlZnJlc2hcblx0ICogdGhyb3VnaCB0aGUgVVJMLiBQZXJzaXN0ZWQgc2V0dGluZ3MgYXJlIGFsc28gcmVmbGVjdGVkIGZvciBzaGFyZWFibGUgc3RhdGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgICBSZWdpc3RlcmVkIGJyb3dzZXIgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtPYmplY3R9IHJlc3BvbnNlIE5vcm1hbGl6ZWQgc3VjY2Vzc2Z1bCByZXNwb25zZS5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHVwZGF0ZV91cmxfc3RhdGUoIGNvbmZpZywgcmVzcG9uc2UgKSB7XG5cdFx0dmFyIGZpbHRlcnMgPSByZXNwb25zZS5maWx0ZXJzIHx8IHt9O1xuXHRcdHZhciBwYXJhbWV0ZXJzID0gY29uZmlnLnVybF9wYXJhbWV0ZXJzIHx8IHt9O1xuXHRcdHZhciBzdGF0ZV92YWx1ZXMgPSB7XG5cdFx0XHRwYWdlX251bWJlcjogcmVzcG9uc2UucGFnaW5hdGlvbi5wYWdlX251bWJlcixcblx0XHRcdGl0ZW1zX3Blcl9wYWdlOiByZXNwb25zZS5wYWdpbmF0aW9uLml0ZW1zX3Blcl9wYWdlLFxuXHRcdFx0c29ydF9ieTogcmVzcG9uc2Uuc29ydGluZy5zb3J0X2J5LFxuXHRcdFx0c29ydF9vcmRlcjogcmVzcG9uc2Uuc29ydGluZy5zb3J0X29yZGVyLFxuXHRcdFx0c2VhcmNoOiBmaWx0ZXJzLnNlYXJjaCB8fCAnJyxcblx0XHRcdHZpc2libGVfY29sdW1uczogcmVzcG9uc2UuZGlzcGxheS52aXNpYmxlX2NvbHVtbnMgfHwgW10sXG5cdFx0XHRjb2x1bW5fb3JkZXI6IHJlc3BvbnNlLmRpc3BsYXkuY29sdW1uX29yZGVyIHx8IFtdLFxuXHRcdFx0dGVtcGxhdGVfcGFjazogcmVzcG9uc2UuZGlzcGxheS50ZW1wbGF0ZV9wYWNrIHx8ICcnXG5cdFx0fTtcblx0XHR2YXIgcGFnZV91cmw7XG5cblx0XHRpZiAoICEgd2luZG93Lmhpc3RvcnkgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy5oaXN0b3J5LnJlcGxhY2VTdGF0ZSB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93LlVSTCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRwYWdlX3VybCA9IG5ldyB3aW5kb3cuVVJMKCB3aW5kb3cubG9jYXRpb24uaHJlZiApO1xuXHRcdE9iamVjdC5rZXlzKCBmaWx0ZXJzICkuZm9yRWFjaCggZnVuY3Rpb24gKCBmaWx0ZXJfa2V5ICkge1xuXHRcdFx0c3RhdGVfdmFsdWVzWyBmaWx0ZXJfa2V5IF0gPSBmaWx0ZXJzWyBmaWx0ZXJfa2V5IF07XG5cdFx0fSApO1xuXHRcdE9iamVjdC5rZXlzKCBwYXJhbWV0ZXJzICkuZm9yRWFjaCggZnVuY3Rpb24gKCBzdGF0ZV9rZXkgKSB7XG5cdFx0XHR2YXIgcGFyYW1ldGVyX25hbWUgPSBwYXJhbWV0ZXJzWyBzdGF0ZV9rZXkgXTtcblx0XHRcdHZhciBzdGF0ZV92YWx1ZSA9IHN0YXRlX3ZhbHVlc1sgc3RhdGVfa2V5IF07XG5cdFx0XHRpZiAoICEgcGFyYW1ldGVyX25hbWUgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggQXJyYXkuaXNBcnJheSggc3RhdGVfdmFsdWUgKSApIHtcblx0XHRcdFx0c3RhdGVfdmFsdWUgPSBzdGF0ZV92YWx1ZS5qb2luKCAnLCcgKTtcblx0XHRcdH1cblx0XHRcdGlmICggJycgPT09IHN0YXRlX3ZhbHVlIHx8IG51bGwgPT09IHN0YXRlX3ZhbHVlIHx8ICd1bmRlZmluZWQnID09PSB0eXBlb2Ygc3RhdGVfdmFsdWUgKSB7XG5cdFx0XHRcdHBhZ2VfdXJsLnNlYXJjaFBhcmFtcy5kZWxldGUoIHBhcmFtZXRlcl9uYW1lICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRwYWdlX3VybC5zZWFyY2hQYXJhbXMuc2V0KCBwYXJhbWV0ZXJfbmFtZSwgU3RyaW5nKCBzdGF0ZV92YWx1ZSApICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHRcdHdpbmRvdy5oaXN0b3J5LnJlcGxhY2VTdGF0ZSgge30sIGRvY3VtZW50LnRpdGxlLCBwYWdlX3VybC50b1N0cmluZygpICk7XG5cdH1cblxuXHQvKipcblx0ICogQmluZCBkb21haW4tbmV1dHJhbCBkZWxlZ2F0ZWQgY2F0YWxvZyBjb250cm9scyBvbmNlIHBlciBtb3VudC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgY29uZmlnICAgICAgICBSZWdpc3RlcmVkIGJyb3dzZXIgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbW91bnRfZWxlbWVudCBDYXRhbG9nIG1vdW50IGVsZW1lbnQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBiaW5kX2NhdGFsb2dfY29udHJvbHMoIGNvbmZpZywgbW91bnRfZWxlbWVudCApIHtcblx0XHR2YXIgY2F0YWxvZ19zdGF0ZSA9IGdldF9jYXRhbG9nX3N0YXRlKCBjb25maWcuY2F0YWxvZ19pZCApO1xuXG5cdFx0aWYgKCAhIGNhdGFsb2dfc3RhdGUgfHwgbW91bnRfZWxlbWVudC5fd3BiY191aV9jYXRhbG9nX2NvbnRyb2xzX2JvdW5kICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRtb3VudF9lbGVtZW50Ll93cGJjX3VpX2NhdGFsb2dfY29udHJvbHNfYm91bmQgPSB0cnVlO1xuXG5cdFx0bW91bnRfZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAnc3VibWl0JywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdHZhciBzZWFyY2hfY29udHJvbDtcblx0XHRcdGlmICggISBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1maWx0ZXJzXScgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHNlYXJjaF9jb250cm9sID0gbW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXNlYXJjaF0nICk7XG5cdFx0XHRyZXF1ZXN0X2NhdGFsb2coIGNvbmZpZywgeyBwYWdlX251bWJlcjogMSwgc2VhcmNoOiBzZWFyY2hfY29udHJvbCA/IHNlYXJjaF9jb250cm9sLnZhbHVlIDogJycgfSApO1xuXHRcdH0gKTtcblxuXHRcdG1vdW50X2VsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdHZhciBjbGVhcl9jb250cm9sO1xuXHRcdFx0aWYgKCAhIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXNlYXJjaF0nICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNsZWFyX2NvbnRyb2wgPSBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctc2VhcmNoLWNsZWFyXScgKTtcblx0XHRcdGlmICggY2xlYXJfY29udHJvbCApIHtcblx0XHRcdFx0Y2xlYXJfY29udHJvbC5oaWRkZW4gPSAhIGV2ZW50LnRhcmdldC52YWx1ZTtcblx0XHRcdH1cblx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIGNhdGFsb2dfc3RhdGUuc2VhcmNoX3RpbWVyICk7XG5cdFx0XHRjYXRhbG9nX3N0YXRlLnNlYXJjaF90aW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJlcXVlc3RfY2F0YWxvZyggY29uZmlnLCB7IHBhZ2VfbnVtYmVyOiAxLCBzZWFyY2g6IGV2ZW50LnRhcmdldC52YWx1ZSB8fCAnJyB9ICk7XG5cdFx0XHR9LCBnZXRfc2VhcmNoX2RlYm91bmNlX2RlbGF5KCBjb25maWcgKSApO1xuXHRcdH0gKTtcblxuXHRcdG1vdW50X2VsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHR2YXIgZGVmYXVsdF9yZXF1ZXN0ID0gY29uZmlnLmRlZmF1bHRfcmVxdWVzdCB8fCB7fTtcblx0XHRcdHZhciBmaWx0ZXJfa2V5O1xuXHRcdFx0aWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pdGVtcy1wZXItcGFnZV0nICkgKSB7XG5cdFx0XHRcdHJlcXVlc3RfY2F0YWxvZyggY29uZmlnLCB7IGl0ZW1zX3Blcl9wYWdlOiBOdW1iZXIoIGV2ZW50LnRhcmdldC52YWx1ZSApLCBwYWdlX251bWJlcjogMSwgcHJlZmVyZW5jZV9hY3Rpb246ICdzYXZlJyB9ICk7XG5cdFx0XHR9IGVsc2UgaWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1wYWdlLW51bWJlcl0nICkgKSB7XG5cdFx0XHRcdHJlcXVlc3RfY2F0YWxvZyggY29uZmlnLCB7IHBhZ2VfbnVtYmVyOiBOdW1iZXIoIGV2ZW50LnRhcmdldC52YWx1ZSApIHx8IDEgfSApO1xuXHRcdFx0fSBlbHNlIGlmICggZXZlbnQudGFyZ2V0Lm1hdGNoZXMoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctdGVtcGxhdGUtcGFja10nICkgKSB7XG5cdFx0XHRcdGlmICggY29uZmlnLnRlbXBsYXRlX3BhY2tzICYmIGNvbmZpZy50ZW1wbGF0ZV9wYWNrc1sgZXZlbnQudGFyZ2V0LnZhbHVlIF0gKSB7XG5cdFx0XHRcdFx0cmVxdWVzdF9jYXRhbG9nKCBjb25maWcsIHtcblx0XHRcdFx0XHRcdHBhZ2VfbnVtYmVyOiAxLFxuXHRcdFx0XHRcdFx0cHJlZmVyZW5jZV9hY3Rpb246ICdzYXZlJyxcblx0XHRcdFx0XHRcdHRlbXBsYXRlX3BhY2s6IGV2ZW50LnRhcmdldC52YWx1ZVxuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmICggZXZlbnQudGFyZ2V0Lm1hdGNoZXMoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctZmlsdGVyXScgKSApIHtcblx0XHRcdFx0ZmlsdGVyX2tleSA9IGV2ZW50LnRhcmdldC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdWktY2F0YWxvZy1maWx0ZXInICkgfHwgJyc7XG5cdFx0XHRcdGlmICggL15bYS16MC05X10rJC8udGVzdCggZmlsdGVyX2tleSApICkge1xuXHRcdFx0XHRcdHZhciBmaWx0ZXJfcmVxdWVzdCA9IHsgcGFnZV9udW1iZXI6IDEsIHByZWZlcmVuY2VfYWN0aW9uOiAnc2F2ZScgfTtcblx0XHRcdFx0XHRmaWx0ZXJfcmVxdWVzdFsgZmlsdGVyX2tleSBdID0gZXZlbnQudGFyZ2V0LnZhbHVlO1xuXHRcdFx0XHRcdHJlcXVlc3RfY2F0YWxvZyggY29uZmlnLCBmaWx0ZXJfcmVxdWVzdCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1jb2x1bW4tdmlzaWJsZV0nICkgKSB7XG5cdFx0XHRcdHNhdmVfY29sdW1uX2NvbnRyb2xzKCBjb25maWcsIG1vdW50X2VsZW1lbnQgKTtcblx0XHRcdH0gZWxzZSBpZiAoIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXZpZXddJyApICYmICdjdXN0b20nICE9PSBldmVudC50YXJnZXQudmFsdWUgKSB7XG5cdFx0XHRcdHZhciB2aWV3X2RlZmluaXRpb24gPSBjb25maWcudmlld3MgJiYgY29uZmlnLnZpZXdzLmRlZmluaXRpb25zID8gY29uZmlnLnZpZXdzLmRlZmluaXRpb25zWyBldmVudC50YXJnZXQudmFsdWUgXSA6IG51bGw7XG5cdFx0XHRcdGlmICggdmlld19kZWZpbml0aW9uICYmIEFycmF5LmlzQXJyYXkoIHZpZXdfZGVmaW5pdGlvbi5maWVsZHMgKSApIHtcblx0XHRcdFx0XHRyZXF1ZXN0X2NhdGFsb2coIGNvbmZpZywge1xuXHRcdFx0XHRcdFx0cGFnZV9udW1iZXI6IDEsXG5cdFx0XHRcdFx0XHRwcmVmZXJlbmNlX2FjdGlvbjogJ3NhdmUnLFxuXHRcdFx0XHRcdFx0dmlzaWJsZV9jb2x1bW5zOiB2aWV3X2RlZmluaXRpb24uZmllbGRzXG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSApO1xuXG5cdFx0bW91bnRfZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0dmFyIGNsb3NlX2NvbnRyb2wgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1kaXNwbGF5LWNsb3NlXScgKTtcblx0XHRcdHZhciBkZWZhdWx0X3JlcXVlc3QgPSBjb25maWcuZGVmYXVsdF9yZXF1ZXN0IHx8IHt9O1xuXHRcdFx0dmFyIHBhZ2VfY29udHJvbCA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXBhZ2VdJyApO1xuXHRcdFx0dmFyIHJlc2V0X2NvbnRyb2wgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1wcmVmZXJlbmNlcy1yZXNldF0nICk7XG5cdFx0XHR2YXIgcmVzZXRfb3JkZXJfY29udHJvbCA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWNvbHVtbi1vcmRlci1yZXNldF0nICk7XG5cdFx0XHR2YXIgc2VhcmNoX2NsZWFyID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctc2VhcmNoLWNsZWFyXScgKTtcblx0XHRcdHZhciBzb3J0X2NvbnRyb2wgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1zb3J0XScgKTtcblx0XHRcdHZhciBzb3J0X2tleTtcblxuXHRcdFx0aWYgKCBzZWFyY2hfY2xlYXIgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHZhciBzZWFyY2hfY29udHJvbCA9IG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1zZWFyY2hdJyApO1xuXHRcdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KCBjYXRhbG9nX3N0YXRlLnNlYXJjaF90aW1lciApO1xuXHRcdFx0XHRpZiAoIHNlYXJjaF9jb250cm9sICkge1xuXHRcdFx0XHRcdHNlYXJjaF9jb250cm9sLnZhbHVlID0gJyc7XG5cdFx0XHRcdFx0c2VhcmNoX2NvbnRyb2wuZm9jdXMoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzZWFyY2hfY2xlYXIuaGlkZGVuID0gdHJ1ZTtcblx0XHRcdFx0aWYgKCBpc19pbW1lZGlhdGVfc2VhcmNoX2NsZWFyX2VuYWJsZWQoIGNvbmZpZyApICkge1xuXHRcdFx0XHRcdHJlcXVlc3RfY2F0YWxvZyggY29uZmlnLCB7IHBhZ2VfbnVtYmVyOiAxLCBzZWFyY2g6ICcnIH0gKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjYXRhbG9nX3N0YXRlLnNlYXJjaF90aW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRyZXF1ZXN0X2NhdGFsb2coIGNvbmZpZywgeyBwYWdlX251bWJlcjogMSwgc2VhcmNoOiAnJyB9ICk7XG5cdFx0XHRcdFx0fSwgZ2V0X3NlYXJjaF9kZWJvdW5jZV9kZWxheSggY29uZmlnICkgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmICggc29ydF9jb250cm9sICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRzb3J0X2tleSA9IHNvcnRfY29udHJvbC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdWktY2F0YWxvZy1zb3J0JyApIHx8ICcnO1xuXHRcdFx0XHRyZXF1ZXN0X2NhdGFsb2coIGNvbmZpZywge1xuXHRcdFx0XHRcdHBhZ2VfbnVtYmVyOiAxLFxuXHRcdFx0XHRcdHByZWZlcmVuY2VfYWN0aW9uOiAnc2F2ZScsXG5cdFx0XHRcdFx0c29ydF9ieTogc29ydF9rZXksXG5cdFx0XHRcdFx0c29ydF9vcmRlcjogc29ydF9rZXkgPT09IGNhdGFsb2dfc3RhdGUucmVxdWVzdF92YWx1ZXMuc29ydF9ieSAmJiAnYXNjJyA9PT0gY2F0YWxvZ19zdGF0ZS5yZXF1ZXN0X3ZhbHVlcy5zb3J0X29yZGVyID8gJ2Rlc2MnIDogJ2FzYydcblx0XHRcdFx0fSApO1xuXHRcdFx0fSBlbHNlIGlmICggcGFnZV9jb250cm9sICYmICEgcGFnZV9jb250cm9sLmRpc2FibGVkICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRyZXF1ZXN0X2NhdGFsb2coIGNvbmZpZywgeyBwYWdlX251bWJlcjogTnVtYmVyKCBwYWdlX2NvbnRyb2wuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctcGFnZScgKSApIHx8IDEgfSApO1xuXHRcdFx0fSBlbHNlIGlmICggcmVzZXRfb3JkZXJfY29udHJvbCApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0cmVxdWVzdF9jYXRhbG9nKCBjb25maWcsIHsgY29sdW1uX29yZGVyOiBkZWZhdWx0X3JlcXVlc3QuY29sdW1uX29yZGVyIHx8IFtdLCBwYWdlX251bWJlcjogMSwgcHJlZmVyZW5jZV9hY3Rpb246ICdzYXZlJyB9ICk7XG5cdFx0XHR9IGVsc2UgaWYgKCByZXNldF9jb250cm9sICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRyZXF1ZXN0X2NhdGFsb2coIGNvbmZpZywgT2JqZWN0LmFzc2lnbigge30sIGRlZmF1bHRfcmVxdWVzdCwgeyBwcmVmZXJlbmNlX2FjdGlvbjogJ3Jlc2V0JyB9ICkgKTtcblx0XHRcdH0gZWxzZSBpZiAoIGNsb3NlX2NvbnRyb2wgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHZhciBjdXN0b21pemVyID0gY2xvc2VfY29udHJvbC5jbG9zZXN0KCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWRpc3BsYXktY3VzdG9taXplcl0nICk7XG5cdFx0XHRcdGNsb3NlX2Rpc3BsYXlfY3VzdG9taXplciggY3VzdG9taXplciwgdHJ1ZSApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblxuXHRcdG1vdW50X2VsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ2tleWRvd24nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0dmFyIGN1c3RvbWl6ZXIgPSBldmVudC50YXJnZXQgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGV2ZW50LnRhcmdldC5jbG9zZXN0XG5cdFx0XHRcdD8gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctZGlzcGxheS1jdXN0b21pemVyXScgKVxuXHRcdFx0XHQ6IG51bGw7XG5cdFx0XHRpZiAoICdFc2NhcGUnICE9PSBldmVudC5rZXkgfHwgISBjdXN0b21pemVyIHx8ICEgY3VzdG9taXplci5vcGVuICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0Y2xvc2VfZGlzcGxheV9jdXN0b21pemVyKCBjdXN0b21pemVyLCB0cnVlICk7XG5cdFx0fSApO1xuXG5cdFx0bW91bnRfZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAndG9nZ2xlJywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdHZhciBjdXN0b21pemVyID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctZGlzcGxheS1jdXN0b21pemVyXScgKTtcblx0XHRcdGlmICggISBjdXN0b21pemVyICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGN1c3RvbWl6ZXIub3BlbiApIHtcblx0XHRcdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdHBvc2l0aW9uX2Rpc3BsYXlfcGFuZWwoIGN1c3RvbWl6ZXIgKTtcblx0XHRcdFx0fSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzZXRfZGlzcGxheV9wYW5lbF9wb3NpdGlvbiggY3VzdG9taXplciApO1xuXHRcdFx0fVxuXHRcdH0sIHRydWUgKTtcblxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHR2YXIgY3VzdG9taXplciA9IG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1kaXNwbGF5LWN1c3RvbWl6ZXJdJyApO1xuXHRcdFx0aWYgKCBjdXN0b21pemVyICYmIGN1c3RvbWl6ZXIub3BlbiAmJiAhIGN1c3RvbWl6ZXIuY29udGFpbnMoIGV2ZW50LnRhcmdldCApICkge1xuXHRcdFx0XHRjbG9zZV9kaXNwbGF5X2N1c3RvbWl6ZXIoIGN1c3RvbWl6ZXIsIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAncmVzaXplJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0cG9zaXRpb25fZGlzcGxheV9wYW5lbCggbW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWRpc3BsYXktY3VzdG9taXplcl0nICkgKTtcblx0XHRcdHN5bmNfY2F0YWxvZ190YWJsZV9taW5fd2lkdGgoIGNvbmZpZyApO1xuXHRcdH0gKTtcblx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ3Njcm9sbCcsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHR2YXIgY3VzdG9taXplciA9IG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1kaXNwbGF5LWN1c3RvbWl6ZXJdJyApO1xuXHRcdFx0aWYgKFxuXHRcdFx0XHRjdXN0b21pemVyXG5cdFx0XHRcdCYmIGN1c3RvbWl6ZXIub3BlblxuXHRcdFx0XHQmJiAoXG5cdFx0XHRcdFx0ISBldmVudC50YXJnZXRcblx0XHRcdFx0XHR8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgZXZlbnQudGFyZ2V0LmNsb3Nlc3Rcblx0XHRcdFx0XHR8fCAhIGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWRpc3BsYXktY3VzdG9taXplcl0nIClcblx0XHRcdFx0KVxuXHRcdFx0KSB7XG5cdFx0XHRcdHBvc2l0aW9uX2Rpc3BsYXlfcGFuZWwoIGN1c3RvbWl6ZXIgKTtcblx0XHRcdH1cblx0XHR9LCB0cnVlICk7XG5cdH1cblxuXHQvKipcblx0ICogSW5pdGlhbGl6ZSBwb2ludGVyIGFuZCBrZXlib2FyZCBjb2x1bW4gb3JkZXJpbmcgYWZ0ZXIgdG9vbGJhciByZW5kZXJpbmcuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgUmVnaXN0ZXJlZCBicm93c2VyIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiByZWZyZXNoX2NhdGFsb2dfY29udHJvbHMoIGNvbmZpZyApIHtcblx0XHR2YXIgY2F0YWxvZ19zdGF0ZSA9IGdldF9jYXRhbG9nX3N0YXRlKCBjb25maWcuY2F0YWxvZ19pZCApO1xuXHRcdHZhciBtb3VudF9lbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIGNvbmZpZy5tb3VudF9pZCApO1xuXHRcdHZhciBjb2x1bW5fbGlzdCA9IG1vdW50X2VsZW1lbnQgPyBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctY29sdW1uLWxpc3RdJyApIDogbnVsbDtcblxuXHRcdGlmICggISBjYXRhbG9nX3N0YXRlIHx8ICEgY29sdW1uX2xpc3QgfHwgY29sdW1uX2xpc3QuX3dwYmNfdWlfY2F0YWxvZ19pbml0aWFsaXplZCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29sdW1uX2xpc3QuX3dwYmNfdWlfY2F0YWxvZ19pbml0aWFsaXplZCA9IHRydWU7XG5cdFx0Y29sdW1uX2xpc3QuYWRkRXZlbnRMaXN0ZW5lciggJ2tleWRvd24nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0dmFyIGhhbmRsZSA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWNvbHVtbi1kcmFnLWhhbmRsZV0nICk7XG5cdFx0XHR2YXIgaXRlbTtcblx0XHRcdHZhciBzaWJsaW5nO1xuXHRcdFx0aWYgKCAhIGhhbmRsZSB8fCAoICdBcnJvd1VwJyAhPT0gZXZlbnQua2V5ICYmICdBcnJvd0Rvd24nICE9PSBldmVudC5rZXkgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aXRlbSA9IGhhbmRsZS5jbG9zZXN0KCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWNvbHVtbi1pdGVtXScgKTtcblx0XHRcdHNpYmxpbmcgPSAnQXJyb3dVcCcgPT09IGV2ZW50LmtleSA/IGl0ZW0ucHJldmlvdXNFbGVtZW50U2libGluZyA6IGl0ZW0ubmV4dEVsZW1lbnRTaWJsaW5nO1xuXHRcdFx0d2hpbGUgKCBzaWJsaW5nICYmICcxJyAhPT0gc2libGluZy5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdWktY2F0YWxvZy1jb2x1bW4tcmVvcmRlcmFibGUnICkgKSB7XG5cdFx0XHRcdHNpYmxpbmcgPSAnQXJyb3dVcCcgPT09IGV2ZW50LmtleSA/IHNpYmxpbmcucHJldmlvdXNFbGVtZW50U2libGluZyA6IHNpYmxpbmcubmV4dEVsZW1lbnRTaWJsaW5nO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHNpYmxpbmcgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRpZiAoICdBcnJvd1VwJyA9PT0gZXZlbnQua2V5ICkge1xuXHRcdFx0XHRjb2x1bW5fbGlzdC5pbnNlcnRCZWZvcmUoIGl0ZW0sIHNpYmxpbmcgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbHVtbl9saXN0Lmluc2VydEJlZm9yZSggc2libGluZywgaXRlbSApO1xuXHRcdFx0fVxuXHRcdFx0c2F2ZV9jb2x1bW5fY29udHJvbHMoIGNvbmZpZywgbW91bnRfZWxlbWVudCApO1xuXHRcdFx0YW5ub3VuY2VfY29sdW1uX21vdmVkKCBjb25maWcsIG1vdW50X2VsZW1lbnQgKTtcblx0XHRcdGhhbmRsZS5mb2N1cygpO1xuXHRcdH0gKTtcblxuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5Tb3J0YWJsZSApIHtcblx0XHRcdGNhdGFsb2dfc3RhdGUuc29ydGFibGUgPSBuZXcgd2luZG93LlNvcnRhYmxlKCBjb2x1bW5fbGlzdCwge1xuXHRcdFx0XHRhbmltYXRpb246IDE1MCxcblx0XHRcdFx0Y2hvc2VuQ2xhc3M6ICdpcy1kcmFnZ2luZycsXG5cdFx0XHRcdGRyYWdnYWJsZTogJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1jb2x1bW4tcmVvcmRlcmFibGU9XCIxXCJdJyxcblx0XHRcdFx0Z2hvc3RDbGFzczogJ2lzLWRyYWctcGxhY2Vob2xkZXInLFxuXHRcdFx0XHRoYW5kbGU6ICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctY29sdW1uLWRyYWctaGFuZGxlXScsXG5cdFx0XHRcdG9uRW5kOiBmdW5jdGlvbiAoIHNvcnRfZXZlbnQgKSB7XG5cdFx0XHRcdFx0aWYgKCBzb3J0X2V2ZW50Lm9sZEluZGV4ICE9PSBzb3J0X2V2ZW50Lm5ld0luZGV4ICkge1xuXHRcdFx0XHRcdFx0c2F2ZV9jb2x1bW5fY29udHJvbHMoIGNvbmZpZywgbW91bnRfZWxlbWVudCApO1xuXHRcdFx0XHRcdFx0YW5ub3VuY2VfY29sdW1uX21vdmVkKCBjb25maWcsIG1vdW50X2VsZW1lbnQgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogVmFsaWRhdGUgYSBub3JtYWxpemVkIHNlcnZlciByZXNwb25zZSBiZWZvcmUgcmVuZGVyaW5nLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnICAgUmVnaXN0ZXJlZCBicm93c2VyIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7Kn0gICAgICByZXNwb25zZSBDYW5kaWRhdGUgcmVzcG9uc2UuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgcmVzcG9uc2UgY29udHJhY3QgaXMgc3VwcG9ydGVkLlxuXHQgKi9cblx0ZnVuY3Rpb24gdmFsaWRhdGVfcmVzcG9uc2UoIGNvbmZpZywgcmVzcG9uc2UgKSB7XG5cdFx0dmFyIGNvbmZpZ3VyZWRfc2NoZW1hX3ZlcnNpb24gPSBjb25maWcgPyBub3JtYWxpemVfc2NoZW1hX3ZlcnNpb24oIGNvbmZpZy5zY2hlbWFfdmVyc2lvbiApIDogbnVsbDtcblx0XHR2YXIgcmVzcG9uc2Vfc2NoZW1hX3ZlcnNpb24gPSByZXNwb25zZSA/IG5vcm1hbGl6ZV9zY2hlbWFfdmVyc2lvbiggcmVzcG9uc2Uuc2NoZW1hX3ZlcnNpb24gKSA6IG51bGw7XG5cblx0XHRpZiAoXG5cdFx0XHQhIGNvbmZpZ1xuXHRcdFx0fHwgISByZXNwb25zZVxuXHRcdFx0fHwgJ29iamVjdCcgIT09IHR5cGVvZiByZXNwb25zZVxuXHRcdFx0fHwgcmVzcG9uc2UuY2F0YWxvZ19pZCAhPT0gY29uZmlnLmNhdGFsb2dfaWRcblx0XHRcdHx8IG51bGwgPT09IGNvbmZpZ3VyZWRfc2NoZW1hX3ZlcnNpb25cblx0XHRcdHx8IHJlc3BvbnNlX3NjaGVtYV92ZXJzaW9uICE9PSBjb25maWd1cmVkX3NjaGVtYV92ZXJzaW9uXG5cdFx0XHR8fCAnYm9vbGVhbicgIT09IHR5cGVvZiByZXNwb25zZS5zdWNjZXNzXG5cdFx0XHR8fCBudWxsID09PSBub3JtYWxpemVfc2VxdWVuY2UoIHJlc3BvbnNlLnJlcXVlc3RfaWQgKVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICggZmFsc2UgPT09IHJlc3BvbnNlLnN1Y2Nlc3MgKSB7XG5cdFx0XHRyZXR1cm4gISEgcmVzcG9uc2UuZXJyb3Jcblx0XHRcdFx0JiYgJ29iamVjdCcgPT09IHR5cGVvZiByZXNwb25zZS5lcnJvclxuXHRcdFx0XHQmJiAnc3RyaW5nJyA9PT0gdHlwZW9mIHJlc3BvbnNlLmVycm9yLmNvZGVcblx0XHRcdFx0JiYgJ3N0cmluZycgPT09IHR5cGVvZiByZXNwb25zZS5lcnJvci5tZXNzYWdlXG5cdFx0XHRcdCYmICdib29sZWFuJyA9PT0gdHlwZW9mIHJlc3BvbnNlLmVycm9yLnJldHJ5YWJsZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gQXJyYXkuaXNBcnJheSggcmVzcG9uc2UuaXRlbXMgKVxuXHRcdFx0JiYgISEgcmVzcG9uc2UucGFnaW5hdGlvblxuXHRcdFx0JiYgJ29iamVjdCcgPT09IHR5cGVvZiByZXNwb25zZS5wYWdpbmF0aW9uXG5cdFx0XHQmJiAhISByZXNwb25zZS5zb3J0aW5nXG5cdFx0XHQmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIHJlc3BvbnNlLnNvcnRpbmdcblx0XHRcdCYmICEhIHJlc3BvbnNlLmZpbHRlcnNcblx0XHRcdCYmICdvYmplY3QnID09PSB0eXBlb2YgcmVzcG9uc2UuZmlsdGVyc1xuXHRcdFx0JiYgISEgcmVzcG9uc2UuZGlzcGxheVxuXHRcdFx0JiYgJ29iamVjdCcgPT09IHR5cGVvZiByZXNwb25zZS5kaXNwbGF5XG5cdFx0XHQmJiAhISByZXNwb25zZS5oaWVyYXJjaHlcblx0XHRcdCYmICdvYmplY3QnID09PSB0eXBlb2YgcmVzcG9uc2UuaGllcmFyY2h5XG5cdFx0XHQmJiAhISByZXNwb25zZS5jYXBhYmlsaXRpZXNcblx0XHRcdCYmICdvYmplY3QnID09PSB0eXBlb2YgcmVzcG9uc2UuY2FwYWJpbGl0aWVzXG5cdFx0XHQmJiBBcnJheS5pc0FycmF5KCByZXNwb25zZS5tZXNzYWdlcyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlZnJlc2ggb3B0aW9uYWwgc2hhcmVkIGhpZXJhcmNoeSBtZWNoYW5pY3MgYWZ0ZXIgZG9tYWluIHJvd3MgYXJlIG1vdW50ZWQuXG5cdCAqXG5cdCAqIFRoZSByZW5kZXJlZCBsaWZlY3ljbGUgZXZlbnQgcnVucyBzeW5jaHJvbm91c2x5IGZpcnN0IHNvIGEgZG9tYWluIGFkYXB0ZXJcblx0ICogY2FuIGNvbXBvc2UgaXRzIFdQIHJvdyB0ZW1wbGF0ZXMgYmVmb3JlIHRoZSBjb250cm9sbGVyIGluZGV4ZXMgbm9kZSBET00uXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgICBSZWdpc3RlcmVkIGJyb3dzZXIgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtPYmplY3R9IHJlc3BvbnNlIE5vcm1hbGl6ZWQgY3VycmVudCByZXNwb25zZS5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gV2hldGhlciBoaWVyYXJjaHkgYmVoYXZpb3IgaXMgYWN0aXZlLlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVmcmVzaF9jYXRhbG9nX2hpZXJhcmNoeSggY29uZmlnLCByZXNwb25zZSApIHtcblx0XHR2YXIgY2F0YWxvZ19zdGF0ZSA9IGNvbmZpZyAmJiBjb25maWcuY2F0YWxvZ19pZCA/IGdldF9jYXRhbG9nX3N0YXRlKCBjb25maWcuY2F0YWxvZ19pZCApIDogbnVsbDtcblxuXHRcdHJldHVybiAhISAoXG5cdFx0XHRjYXRhbG9nX3N0YXRlXG5cdFx0XHQmJiBjYXRhbG9nX3N0YXRlLmhpZXJhcmNoeV9jb250cm9sbGVyXG5cdFx0XHQmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgY2F0YWxvZ19zdGF0ZS5oaWVyYXJjaHlfY29udHJvbGxlci5yZWZyZXNoXG5cdFx0XHQmJiBjYXRhbG9nX3N0YXRlLmhpZXJhcmNoeV9jb250cm9sbGVyLnJlZnJlc2goIHJlc3BvbnNlICYmIHJlc3BvbnNlLmhpZXJhcmNoeSA/IHJlc3BvbnNlLmhpZXJhcmNoeSA6IHt9IClcblx0XHQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlbmRlciBhIGN1cnJlbnQgbm9ybWFsaXplZCByZXNwb25zZSBhbmQgaWdub3JlIHN0YWxlIHNlcXVlbmNlcy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyAgICAgICAgICAgUmVnaXN0ZXJlZCBicm93c2VyIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7Kn0gICAgICByZXNwb25zZSAgICAgICAgIENhbmRpZGF0ZSBub3JtYWxpemVkIHJlc3BvbnNlLlxuXHQgKiBAcGFyYW0geyp9ICAgICAgcmVxdWVzdF9zZXF1ZW5jZSBTZXF1ZW5jZSBhc3NpZ25lZCB3aGVuIHRoZSByZXF1ZXN0IGJlZ2FuLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIHJlc3BvbnNlIGNoYW5nZWQgdGhlIGNhdGFsb2cuXG5cdCAqL1xuXHRmdW5jdGlvbiByZW5kZXJfcmVzcG9uc2UoIGNvbmZpZywgcmVzcG9uc2UsIHJlcXVlc3Rfc2VxdWVuY2UgKSB7XG5cdFx0dmFyIGNhdGFsb2dfc3RhdGU7XG5cdFx0dmFyIGkxOG47XG5cdFx0dmFyIGl0ZW1zX3RlbXBsYXRlX2RhdGE7XG5cdFx0dmFyIHJlc3BvbnNlX3NlcXVlbmNlID0gcmVzcG9uc2UgJiYgbm9ybWFsaXplX3NlcXVlbmNlKCByZXNwb25zZS5yZXF1ZXN0X2lkICk7XG5cdFx0dmFyIG5vcm1hbGl6ZWRfc2VxdWVuY2UgPSBub3JtYWxpemVfc2VxdWVuY2UoIHJlcXVlc3Rfc2VxdWVuY2UgKTtcblxuXHRcdGlmICggISBjb25maWcgfHwgISBjb25maWcuY2F0YWxvZ19pZCApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjYXRhbG9nX3N0YXRlID0gZ2V0X2NhdGFsb2dfc3RhdGUoIGNvbmZpZy5jYXRhbG9nX2lkICk7XG5cdFx0aWYgKFxuXHRcdFx0ISBjYXRhbG9nX3N0YXRlXG5cdFx0XHR8fCBudWxsID09PSBub3JtYWxpemVkX3NlcXVlbmNlXG5cdFx0XHR8fCBudWxsID09PSByZXNwb25zZV9zZXF1ZW5jZVxuXHRcdFx0fHwgcmVzcG9uc2Vfc2VxdWVuY2UgIT09IG5vcm1hbGl6ZWRfc2VxdWVuY2Vcblx0XHRcdHx8IGlzX3N0YWxlX3Jlc3BvbnNlKCBjb25maWcuY2F0YWxvZ19pZCwgbm9ybWFsaXplZF9zZXF1ZW5jZSApXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKCAhIHZhbGlkYXRlX3Jlc3BvbnNlKCBjb25maWcsIHJlc3BvbnNlICkgKSB7XG5cdFx0XHRyZXR1cm4gcmVuZGVyX2Vycm9yKCBjb25maWcsIGNvbmZpZy5pMThuICYmIGNvbmZpZy5pMThuLmVycm9yX21lc3NhZ2UgPyBjb25maWcuaTE4bi5lcnJvcl9tZXNzYWdlIDogJycgKTtcblx0XHR9XG5cblx0XHRpZiAoIGZhbHNlID09PSByZXNwb25zZS5zdWNjZXNzICkge1xuXHRcdFx0cmV0dXJuIHJlbmRlcl9lcnJvciggY29uZmlnLCByZXNwb25zZS5lcnJvci5tZXNzYWdlICk7XG5cdFx0fVxuXG5cdFx0c2V0X2FjdGl2ZV90ZW1wbGF0ZV9wYWNrKCBjb25maWcsIHJlc3BvbnNlLmRpc3BsYXkudGVtcGxhdGVfcGFjayApO1xuXG5cdFx0aTE4biA9IGNvbmZpZy5pMThuIHx8IHt9O1xuXHRcdGlmICggMCA9PT0gcmVzcG9uc2UuaXRlbXMubGVuZ3RoICkge1xuXHRcdFx0dmFyIGlzX2VtcHR5X3JlbmRlcmVkID0gcmVuZGVyX3RlbXBsYXRlKCBjb25maWcsICdlbXB0eScsIHtcblx0XHRcdFx0dGl0bGU6IGkxOG4uZW1wdHlfdGl0bGUgfHwgJycsXG5cdFx0XHRcdG1lc3NhZ2U6IGkxOG4uZW1wdHlfbWVzc2FnZSB8fCAnJ1xuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCBpc19lbXB0eV9yZW5kZXJlZCApIHtcblx0XHRcdFx0ZGlzcGF0Y2hfY2F0YWxvZ19ldmVudCggY29uZmlnLCAnd3BiYzp1aS1jYXRhbG9nLXJlbmRlcmVkJywge1xuXHRcdFx0XHRcdGNhdGFsb2dfaWQ6IGNvbmZpZy5jYXRhbG9nX2lkLFxuXHRcdFx0XHRcdHJlcXVlc3Rfc2VxdWVuY2U6IG5vcm1hbGl6ZWRfc2VxdWVuY2UsXG5cdFx0XHRcdFx0cmVzcG9uc2U6IHJlc3BvbnNlXG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0cmVmcmVzaF9jYXRhbG9nX2hpZXJhcmNoeSggY29uZmlnLCByZXNwb25zZSApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGlzX2VtcHR5X3JlbmRlcmVkO1xuXHRcdH1cblxuXHRcdGl0ZW1zX3RlbXBsYXRlX2RhdGEgPSBPYmplY3QuYXNzaWduKCB7fSwgcmVzcG9uc2UsIHsgaTE4bjogaTE4biB9ICk7XG5cdFx0aWYgKCAhIHJlbmRlcl90ZW1wbGF0ZSggY29uZmlnLCAnaXRlbXMnLCBpdGVtc190ZW1wbGF0ZV9kYXRhICkgKSB7XG5cdFx0XHRyZXR1cm4gcmVuZGVyX2Vycm9yKCBjb25maWcsIGkxOG4uZXJyb3JfbWVzc2FnZSB8fCAnJyApO1xuXHRcdH1cblx0XHRkaXNwYXRjaF9jYXRhbG9nX2V2ZW50KCBjb25maWcsICd3cGJjOnVpLWNhdGFsb2ctcmVuZGVyZWQnLCB7XG5cdFx0XHRjYXRhbG9nX2lkOiBjb25maWcuY2F0YWxvZ19pZCxcblx0XHRcdHJlcXVlc3Rfc2VxdWVuY2U6IG5vcm1hbGl6ZWRfc2VxdWVuY2UsXG5cdFx0XHRyZXNwb25zZTogcmVzcG9uc2Vcblx0XHR9ICk7XG5cdFx0cmVmcmVzaF9jYXRhbG9nX2hpZXJhcmNoeSggY29uZmlnLCByZXNwb25zZSApO1xuXHRcdHN5bmNfY2F0YWxvZ190YWJsZV9taW5fd2lkdGgoIGNvbmZpZyApO1xuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHQvKipcblx0ICogUmVxdWVzdCBhbmQgcmVuZGVyIG9uZSBub3JtYWxpemVkIGNhdGFsb2cgcmVzcG9uc2UuXG5cdCAqXG5cdCAqIFJlcXVlc3QgY2FuY2VsbGF0aW9uIGFuZCBzZXF1ZW5jZSBjaGVja3MgYXJlIHNoYXJlZCBtZWNoYW5pY3MuIENhdGFsb2dcblx0ICogc2NyaXB0cyBzdXBwbHkgb25seSBub3JtYWxpemVkIHJlcXVlc3QgdmFsdWVzIGFuZCByZXNwb25kIHRvIGxpZmVjeWNsZVxuXHQgKiBldmVudHMgYWZ0ZXIgdGhlIGFsbG93LWxpc3RlZCBpdGVtcyB0ZW1wbGF0ZSBpcyBtb3VudGVkLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnICAgICAgICAgUmVnaXN0ZXJlZCBicm93c2VyIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSByZXF1ZXN0X3ZhbHVlcyBOb3JtYWxpemVkIHJlcXVlc3Qgb3ZlcnJpZGVzLlxuXHQgKiBAcmV0dXJuIHtQcm9taXNlPGJvb2xlYW4+fSBXaGV0aGVyIGEgY3VycmVudCByZXNwb25zZSB3YXMgcmVuZGVyZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiByZXF1ZXN0X2NhdGFsb2coIGNvbmZpZywgcmVxdWVzdF92YWx1ZXMgKSB7XG5cdFx0dmFyIGNhdGFsb2dfc3RhdGU7XG5cdFx0dmFyIHBlcnNpc3RlbnRfcmVxdWVzdF92YWx1ZXM7XG5cdFx0dmFyIHByZWZlcmVuY2VfYWN0aW9uO1xuXHRcdHZhciByZXF1ZXN0X2JvZHk7XG5cdFx0dmFyIHJlcXVlc3Rfc2VxdWVuY2U7XG5cdFx0dmFyIHJlcXVlc3RfdXJsO1xuXG5cdFx0aWYgKFxuXHRcdFx0ISBjb25maWdcblx0XHRcdHx8ICEgY29uZmlnLmNhdGFsb2dfaWRcblx0XHRcdHx8ICEgY29uZmlnLmFqYXhfdXJsXG5cdFx0XHR8fCAhIGNvbmZpZy5hY3Rpb25cblx0XHRcdHx8ICEgY29uZmlnLm5vbmNlXG5cdFx0XHR8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93LmZldGNoXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCByZW5kZXJfZXJyb3IoIGNvbmZpZyB8fCB7fSwgY29uZmlnICYmIGNvbmZpZy5pMThuID8gY29uZmlnLmkxOG4uZXJyb3JfbWVzc2FnZSA6ICcnICkgKTtcblx0XHR9XG5cblx0XHRjYXRhbG9nX3N0YXRlID0gZ2V0X2NhdGFsb2dfc3RhdGUoIGNvbmZpZy5jYXRhbG9nX2lkICk7XG5cdFx0aWYgKCAhIGNhdGFsb2dfc3RhdGUgKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCBmYWxzZSApO1xuXHRcdH1cblxuXHRcdGlmICggY2F0YWxvZ19zdGF0ZS5hYm9ydF9jb250cm9sbGVyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBjYXRhbG9nX3N0YXRlLmFib3J0X2NvbnRyb2xsZXIuYWJvcnQgKSB7XG5cdFx0XHRjYXRhbG9nX3N0YXRlLmFib3J0X2NvbnRyb2xsZXIuYWJvcnQoKTtcblx0XHR9XG5cdFx0Y2F0YWxvZ19zdGF0ZS5hYm9ydF9jb250cm9sbGVyID0gJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5BYm9ydENvbnRyb2xsZXIgPyBuZXcgd2luZG93LkFib3J0Q29udHJvbGxlcigpIDogbnVsbDtcblx0XHRwZXJzaXN0ZW50X3JlcXVlc3RfdmFsdWVzID0gT2JqZWN0LmFzc2lnbigge30sIHJlcXVlc3RfdmFsdWVzIHx8IHt9ICk7XG5cdFx0cHJlZmVyZW5jZV9hY3Rpb24gPSBwZXJzaXN0ZW50X3JlcXVlc3RfdmFsdWVzLnByZWZlcmVuY2VfYWN0aW9uIHx8ICcnO1xuXHRcdGRlbGV0ZSBwZXJzaXN0ZW50X3JlcXVlc3RfdmFsdWVzLnByZWZlcmVuY2VfYWN0aW9uO1xuXHRcdGNhdGFsb2dfc3RhdGUucmVxdWVzdF92YWx1ZXMgPSBPYmplY3QuYXNzaWduKCB7fSwgY29uZmlnLmluaXRpYWxfcmVxdWVzdCB8fCB7fSwgY2F0YWxvZ19zdGF0ZS5yZXF1ZXN0X3ZhbHVlcyB8fCB7fSwgcGVyc2lzdGVudF9yZXF1ZXN0X3ZhbHVlcyApO1xuXHRcdHJlcXVlc3Rfc2VxdWVuY2UgPSBuZXh0X3JlcXVlc3Rfc2VxdWVuY2UoIGNvbmZpZy5jYXRhbG9nX2lkICk7XG5cdFx0Y2F0YWxvZ19zdGF0ZS5yZXF1ZXN0X3ZhbHVlcy5yZXF1ZXN0X2lkID0gcmVxdWVzdF9zZXF1ZW5jZTtcblxuXHRcdGlmICggISBzZXRfY2F0YWxvZ19sb2FkaW5nX3N0YXRlKCBjb25maWcsIHRydWUgKSApIHtcblx0XHRcdHJlbmRlcl90ZW1wbGF0ZSggY29uZmlnLCAnc2hlbGwnLCB7XG5cdFx0XHRcdGNhdGFsb2dfaWQ6IGNvbmZpZy5jYXRhbG9nX2lkLFxuXHRcdFx0XHRhcmlhX2xhYmVsOiBjb25maWcuaTE4biAmJiBjb25maWcuaTE4bi5jYXRhbG9nX2xhYmVsID8gY29uZmlnLmkxOG4uY2F0YWxvZ19sYWJlbCA6ICcnLFxuXHRcdFx0XHRsb2FkaW5nX21lc3NhZ2U6IGNvbmZpZy5pMThuICYmIGNvbmZpZy5pMThuLmxvYWRpbmcgPyBjb25maWcuaTE4bi5sb2FkaW5nIDogJydcblx0XHRcdH0gKTtcblx0XHR9XG5cdFx0ZGlzcGF0Y2hfY2F0YWxvZ19ldmVudCggY29uZmlnLCAnd3BiYzp1aS1jYXRhbG9nLWxvYWRpbmcnLCB7XG5cdFx0XHRjYXRhbG9nX2lkOiBjb25maWcuY2F0YWxvZ19pZCxcblx0XHRcdHJlcXVlc3Rfc2VxdWVuY2U6IHJlcXVlc3Rfc2VxdWVuY2Vcblx0XHR9ICk7XG5cblx0XHRyZXF1ZXN0X2JvZHkgPSBuZXcgd2luZG93LlVSTFNlYXJjaFBhcmFtcygpO1xuXHRcdHJlcXVlc3RfYm9keS5hcHBlbmQoICdhY3Rpb24nLCBjb25maWcuYWN0aW9uICk7XG5cdFx0cmVxdWVzdF9ib2R5LmFwcGVuZCggJ25vbmNlJywgY29uZmlnLm5vbmNlICk7XG5cdFx0aWYgKCBwcmVmZXJlbmNlX2FjdGlvbiApIHtcblx0XHRcdGNhdGFsb2dfc3RhdGUucHJlZmVyZW5jZV9yZXZpc2lvbiA9IE1hdGgubWF4KCBEYXRlLm5vdygpLCBjYXRhbG9nX3N0YXRlLnByZWZlcmVuY2VfcmV2aXNpb24gKyAxICk7XG5cdFx0XHRyZXF1ZXN0X2JvZHkuYXBwZW5kKCAncHJlZmVyZW5jZV9hY3Rpb24nLCBwcmVmZXJlbmNlX2FjdGlvbiApO1xuXHRcdFx0cmVxdWVzdF9ib2R5LmFwcGVuZCggJ3ByZWZlcmVuY2VfcmV2aXNpb24nLCBTdHJpbmcoIGNhdGFsb2dfc3RhdGUucHJlZmVyZW5jZV9yZXZpc2lvbiApICk7XG5cdFx0fVxuXHRcdE9iamVjdC5rZXlzKCBjYXRhbG9nX3N0YXRlLnJlcXVlc3RfdmFsdWVzICkuZm9yRWFjaCggZnVuY3Rpb24gKCByZXF1ZXN0X2tleSApIHtcblx0XHRcdGFwcGVuZF9yZXF1ZXN0X3ZhbHVlKCByZXF1ZXN0X2JvZHksIHJlcXVlc3Rfa2V5LCBjYXRhbG9nX3N0YXRlLnJlcXVlc3RfdmFsdWVzWyByZXF1ZXN0X2tleSBdICk7XG5cdFx0fSApO1xuXHRcdHJlcXVlc3RfdXJsID0gU3RyaW5nKCBjb25maWcuYWpheF91cmwgKTtcblxuXHRcdHJldHVybiB3aW5kb3cuZmV0Y2goIHJlcXVlc3RfdXJsLCB7XG5cdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdGNyZWRlbnRpYWxzOiAnc2FtZS1vcmlnaW4nLFxuXHRcdFx0aGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZDsgY2hhcnNldD1VVEYtOCcgfSxcblx0XHRcdGJvZHk6IHJlcXVlc3RfYm9keS50b1N0cmluZygpLFxuXHRcdFx0c2lnbmFsOiBjYXRhbG9nX3N0YXRlLmFib3J0X2NvbnRyb2xsZXIgPyBjYXRhbG9nX3N0YXRlLmFib3J0X2NvbnRyb2xsZXIuc2lnbmFsIDogdW5kZWZpbmVkXG5cdFx0fSApLnRoZW4oIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRyZXR1cm4gcmVzcG9uc2UudGV4dCgpLnRoZW4oIGZ1bmN0aW9uICggcmVzcG9uc2VfdGV4dCApIHtcblx0XHRcdFx0dmFyIHJlc3BvbnNlX3BheWxvYWQgPSBudWxsO1xuXG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0cmVzcG9uc2VfcGF5bG9hZCA9IEpTT04ucGFyc2UoIHJlc3BvbnNlX3RleHQgKTtcblx0XHRcdFx0fSBjYXRjaCAoIGVycm9yICkge1xuXHRcdFx0XHRcdHJlc3BvbnNlX3BheWxvYWQgPSBudWxsO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKCBpc19zdGFsZV9yZXNwb25zZSggY29uZmlnLmNhdGFsb2dfaWQsIHJlcXVlc3Rfc2VxdWVuY2UgKSApIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAhIHJlc3BvbnNlX3BheWxvYWQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHJlbmRlcl9lcnJvciggY29uZmlnLCBjb25maWcuaTE4biAmJiBjb25maWcuaTE4bi5lcnJvcl9tZXNzYWdlID8gY29uZmlnLmkxOG4uZXJyb3JfbWVzc2FnZSA6ICcnICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR2YXIgaXNfcmVuZGVyZWQgPSByZW5kZXJfcmVzcG9uc2UoIGNvbmZpZywgcmVzcG9uc2VfcGF5bG9hZCwgcmVxdWVzdF9zZXF1ZW5jZSApO1xuXHRcdFx0XHRpZiAoIGlzX3JlbmRlcmVkICYmIHJlc3BvbnNlX3BheWxvYWQuc3VjY2VzcyApIHtcblx0XHRcdFx0XHRjYXRhbG9nX3N0YXRlLnJlcXVlc3RfdmFsdWVzID0gT2JqZWN0LmFzc2lnbigge30sIGNhdGFsb2dfc3RhdGUucmVxdWVzdF92YWx1ZXMsIHtcblx0XHRcdFx0XHRcdHBhZ2VfbnVtYmVyOiByZXNwb25zZV9wYXlsb2FkLnBhZ2luYXRpb24ucGFnZV9udW1iZXIsXG5cdFx0XHRcdFx0XHRpdGVtc19wZXJfcGFnZTogcmVzcG9uc2VfcGF5bG9hZC5wYWdpbmF0aW9uLml0ZW1zX3Blcl9wYWdlLFxuXHRcdFx0XHRcdFx0c29ydF9ieTogcmVzcG9uc2VfcGF5bG9hZC5zb3J0aW5nLnNvcnRfYnksXG5cdFx0XHRcdFx0XHRzb3J0X29yZGVyOiByZXNwb25zZV9wYXlsb2FkLnNvcnRpbmcuc29ydF9vcmRlcixcblx0XHRcdFx0XHRcdHNlYXJjaDogcmVzcG9uc2VfcGF5bG9hZC5maWx0ZXJzLnNlYXJjaCB8fCAnJyxcblx0XHRcdFx0XHRcdHZpc2libGVfY29sdW1uczogcmVzcG9uc2VfcGF5bG9hZC5kaXNwbGF5LnZpc2libGVfY29sdW1ucyB8fCBbXSxcblx0XHRcdFx0XHRcdGNvbHVtbl9vcmRlcjogcmVzcG9uc2VfcGF5bG9hZC5kaXNwbGF5LmNvbHVtbl9vcmRlciB8fCBbXSxcblx0XHRcdFx0XHRcdHRlbXBsYXRlX3BhY2s6IHJlc3BvbnNlX3BheWxvYWQuZGlzcGxheS50ZW1wbGF0ZV9wYWNrIHx8ICcnXG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdE9iamVjdC5rZXlzKCByZXNwb25zZV9wYXlsb2FkLmZpbHRlcnMgfHwge30gKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGZpbHRlcl9rZXkgKSB7XG5cdFx0XHRcdFx0XHRjYXRhbG9nX3N0YXRlLnJlcXVlc3RfdmFsdWVzWyBmaWx0ZXJfa2V5IF0gPSByZXNwb25zZV9wYXlsb2FkLmZpbHRlcnNbIGZpbHRlcl9rZXkgXTtcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0dXBkYXRlX3VybF9zdGF0ZSggY29uZmlnLCByZXNwb25zZV9wYXlsb2FkICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gaXNfcmVuZGVyZWQ7XG5cdFx0XHR9ICk7XG5cdFx0fSApLmNhdGNoKCBmdW5jdGlvbiAoIGVycm9yICkge1xuXHRcdFx0aWYgKCBlcnJvciAmJiAnQWJvcnRFcnJvcicgPT09IGVycm9yLm5hbWUgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmICggaXNfc3RhbGVfcmVzcG9uc2UoIGNvbmZpZy5jYXRhbG9nX2lkLCByZXF1ZXN0X3NlcXVlbmNlICkgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHJlbmRlcl9lcnJvciggY29uZmlnLCBjb25maWcuaTE4biAmJiBjb25maWcuaTE4bi5lcnJvcl9tZXNzYWdlID8gY29uZmlnLmkxOG4uZXJyb3JfbWVzc2FnZSA6ICcnICk7XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFBlcnNpc3QgdmFsaWRhdGVkIHByZXNlbnRhdGlvbiBwcmVmZXJlbmNlcyB3aXRob3V0IHJlYnVpbGRpbmcgY2F0YWxvZyByb3dzLlxuXHQgKlxuXHQgKiBEb21haW4gY2F0YWxvZ3MgbWF5IGFkZCB0aGVpciBvd24gc2NhbGFyIHByZWZlcmVuY2UgdmFsdWVzIHRvIHRoZSBzaGFyZWRcblx0ICogcmVxdWVzdCBzdGF0ZS4gVGhlIGVuZHBvaW50IHJlbWFpbnMgcmVzcG9uc2libGUgZm9yIHZhbGlkYXRpb24gYW5kXG5cdCAqIGF1dGhvcml6YXRpb24uIEEgc2VwYXJhdGUgYWJvcnQgc2xvdCBwcmV2ZW50cyBhIGRpc2Nsb3N1cmUtc3RhdGUgc2F2ZSBmcm9tXG5cdCAqIGNhbmNlbGxpbmcgYW4gYWN0aXZlIGxpc3QgcmVxdWVzdCBvciBzaG93aW5nIHRoZSBjYXRhbG9nIGxvYWRpbmcgb3ZlcmxheS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyAgICAgICAgICAgIFJlZ2lzdGVyZWQgYnJvd3NlciBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gcHJlZmVyZW5jZV92YWx1ZXMgU2hhcmVkIG9yIGRvbWFpbi1vd25lZCByZXF1ZXN0IHZhbHVlcy5cblx0ICogQHJldHVybiB7UHJvbWlzZTxib29sZWFuPn0gV2hldGhlciB0aGUgY3VycmVudCBwcmVmZXJlbmNlIHJlcXVlc3Qgc3VjY2VlZGVkLlxuXHQgKi9cblx0ZnVuY3Rpb24gc2F2ZV9jYXRhbG9nX3ByZWZlcmVuY2VzKCBjb25maWcsIHByZWZlcmVuY2VfdmFsdWVzICkge1xuXHRcdHZhciBjYXRhbG9nX3N0YXRlO1xuXHRcdHZhciByZXF1ZXN0X2JvZHk7XG5cdFx0dmFyIHJlcXVlc3RfcmV2aXNpb247XG5cblx0XHRpZiAoICEgY29uZmlnIHx8ICEgY29uZmlnLmNhdGFsb2dfaWQgfHwgISBjb25maWcuYWpheF91cmwgfHwgISBjb25maWcuYWN0aW9uIHx8ICEgY29uZmlnLm5vbmNlIHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiB3aW5kb3cuZmV0Y2ggKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCBmYWxzZSApO1xuXHRcdH1cblx0XHRjYXRhbG9nX3N0YXRlID0gZ2V0X2NhdGFsb2dfc3RhdGUoIGNvbmZpZy5jYXRhbG9nX2lkICk7XG5cdFx0aWYgKCAhIGNhdGFsb2dfc3RhdGUgKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCBmYWxzZSApO1xuXHRcdH1cblx0XHRpZiAoIGNhdGFsb2dfc3RhdGUucHJlZmVyZW5jZV9hYm9ydF9jb250cm9sbGVyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBjYXRhbG9nX3N0YXRlLnByZWZlcmVuY2VfYWJvcnRfY29udHJvbGxlci5hYm9ydCApIHtcblx0XHRcdGNhdGFsb2dfc3RhdGUucHJlZmVyZW5jZV9hYm9ydF9jb250cm9sbGVyLmFib3J0KCk7XG5cdFx0fVxuXHRcdGNhdGFsb2dfc3RhdGUucHJlZmVyZW5jZV9hYm9ydF9jb250cm9sbGVyID0gJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5BYm9ydENvbnRyb2xsZXIgPyBuZXcgd2luZG93LkFib3J0Q29udHJvbGxlcigpIDogbnVsbDtcblx0XHRjYXRhbG9nX3N0YXRlLnJlcXVlc3RfdmFsdWVzID0gT2JqZWN0LmFzc2lnbigge30sIGNvbmZpZy5pbml0aWFsX3JlcXVlc3QgfHwge30sIGNhdGFsb2dfc3RhdGUucmVxdWVzdF92YWx1ZXMgfHwge30sIHByZWZlcmVuY2VfdmFsdWVzIHx8IHt9ICk7XG5cdFx0Y2F0YWxvZ19zdGF0ZS5wcmVmZXJlbmNlX3JldmlzaW9uID0gTWF0aC5tYXgoIERhdGUubm93KCksIGNhdGFsb2dfc3RhdGUucHJlZmVyZW5jZV9yZXZpc2lvbiArIDEgKTtcblx0XHRyZXF1ZXN0X3JldmlzaW9uID0gY2F0YWxvZ19zdGF0ZS5wcmVmZXJlbmNlX3JldmlzaW9uO1xuXG5cdFx0cmVxdWVzdF9ib2R5ID0gbmV3IHdpbmRvdy5VUkxTZWFyY2hQYXJhbXMoKTtcblx0XHRyZXF1ZXN0X2JvZHkuYXBwZW5kKCAnYWN0aW9uJywgY29uZmlnLmFjdGlvbiApO1xuXHRcdHJlcXVlc3RfYm9keS5hcHBlbmQoICdub25jZScsIGNvbmZpZy5ub25jZSApO1xuXHRcdHJlcXVlc3RfYm9keS5hcHBlbmQoICdwcmVmZXJlbmNlX2FjdGlvbicsICdzYXZlJyApO1xuXHRcdHJlcXVlc3RfYm9keS5hcHBlbmQoICdwcmVmZXJlbmNlX3JldmlzaW9uJywgU3RyaW5nKCByZXF1ZXN0X3JldmlzaW9uICkgKTtcblx0XHRyZXF1ZXN0X2JvZHkuYXBwZW5kKCAncHJlZmVyZW5jZXNfb25seScsICcxJyApO1xuXHRcdE9iamVjdC5rZXlzKCBjYXRhbG9nX3N0YXRlLnJlcXVlc3RfdmFsdWVzICkuZm9yRWFjaCggZnVuY3Rpb24gKCByZXF1ZXN0X2tleSApIHtcblx0XHRcdGFwcGVuZF9yZXF1ZXN0X3ZhbHVlKCByZXF1ZXN0X2JvZHksIHJlcXVlc3Rfa2V5LCBjYXRhbG9nX3N0YXRlLnJlcXVlc3RfdmFsdWVzWyByZXF1ZXN0X2tleSBdICk7XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIHdpbmRvdy5mZXRjaCggU3RyaW5nKCBjb25maWcuYWpheF91cmwgKSwge1xuXHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRjcmVkZW50aWFsczogJ3NhbWUtb3JpZ2luJyxcblx0XHRcdGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQ7IGNoYXJzZXQ9VVRGLTgnIH0sXG5cdFx0XHRib2R5OiByZXF1ZXN0X2JvZHkudG9TdHJpbmcoKSxcblx0XHRcdHNpZ25hbDogY2F0YWxvZ19zdGF0ZS5wcmVmZXJlbmNlX2Fib3J0X2NvbnRyb2xsZXIgPyBjYXRhbG9nX3N0YXRlLnByZWZlcmVuY2VfYWJvcnRfY29udHJvbGxlci5zaWduYWwgOiB1bmRlZmluZWRcblx0XHR9ICkudGhlbiggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdHJldHVybiByZXNwb25zZS50ZXh0KCkudGhlbiggZnVuY3Rpb24gKCByZXNwb25zZV90ZXh0ICkge1xuXHRcdFx0XHR2YXIgcmVzcG9uc2VfcGF5bG9hZCA9IG51bGw7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0cmVzcG9uc2VfcGF5bG9hZCA9IEpTT04ucGFyc2UoIHJlc3BvbnNlX3RleHQgKTtcblx0XHRcdFx0fSBjYXRjaCAoIGVycm9yICkge1xuXHRcdFx0XHRcdHJlc3BvbnNlX3BheWxvYWQgPSBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiByZXF1ZXN0X3JldmlzaW9uID09PSBjYXRhbG9nX3N0YXRlLnByZWZlcmVuY2VfcmV2aXNpb25cblx0XHRcdFx0XHQmJiByZXNwb25zZS5va1xuXHRcdFx0XHRcdCYmICEhIHJlc3BvbnNlX3BheWxvYWRcblx0XHRcdFx0XHQmJiB0cnVlID09PSByZXNwb25zZV9wYXlsb2FkLnN1Y2Nlc3M7XG5cdFx0XHR9ICk7XG5cdFx0fSApLmNhdGNoKCBmdW5jdGlvbiAoIGVycm9yICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBZGQgZnVsbC10ZXh0IHRvb2x0aXBzIG9ubHkgdG8gY2F0YWxvZyB0ZXh0IHRoYXQgaXMgdmlzdWFsbHkgY2xpcHBlZC5cblx0ICpcblx0ICogVGhlIGhlbHBlciBvd25zIHRoZSBkb21haW4tbmV1dHJhbCBvdmVyZmxvdyBtZWFzdXJlbWVudCwga2V5Ym9hcmQgZm9jdXMsXG5cdCAqIEJvb2tpbmcgQ2FsZW5kYXIgdG9vbHRpcCBpbml0aWFsaXphdGlvbiwgYW5kIG5hdGl2ZS10aXRsZSBmYWxsYmFjay4gRG9tYWluXG5cdCAqIHRlbXBsYXRlcyBvcHQgaW4gYnkgcHJvdmlkaW5nIGF1dGhvcml6ZWQgcGxhaW4gdGV4dCB0aHJvdWdoIHRoZVxuXHQgKiBgZGF0YS13cGJjLXVpLWNhdGFsb2ctb3ZlcmZsb3ctdG9vbHRpcGAgYXR0cmlidXRlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBjYXRhbG9nX21vdW50IENhdGFsb2cgbW91bnQgZWxlbWVudC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHN5bmNocm9uaXplX292ZXJmbG93X3Rvb2x0aXBzKCBjYXRhbG9nX21vdW50ICkge1xuXHRcdHZhciBoYXNfb3ZlcmZsb3dpbmdfdGV4dCA9IGZhbHNlO1xuXHRcdHZhciB0b29sdGlwX3NlbGVjdG9yO1xuXG5cdFx0aWYgKCAhIGNhdGFsb2dfbW91bnQgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNhdGFsb2dfbW91bnQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1vdmVyZmxvdy10b29sdGlwXScgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHRleHRfZWxlbWVudCApIHtcblx0XHRcdHZhciBmdWxsX3RleHQgPSB0ZXh0X2VsZW1lbnQuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctb3ZlcmZsb3ctdG9vbHRpcCcgKSB8fCAnJztcblx0XHRcdHZhciBzdGF0aWNfdGl0bGUgPSB0ZXh0X2VsZW1lbnQuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctc3RhdGljLXRpdGxlJyApIHx8ICcnO1xuXHRcdFx0dmFyIGlzX292ZXJmbG93aW5nID0gdGV4dF9lbGVtZW50LnNjcm9sbFdpZHRoID4gdGV4dF9lbGVtZW50LmNsaWVudFdpZHRoICsgMVxuXHRcdFx0XHR8fCB0ZXh0X2VsZW1lbnQuc2Nyb2xsSGVpZ2h0ID4gdGV4dF9lbGVtZW50LmNsaWVudEhlaWdodCArIDE7XG5cblx0XHRcdGlmICggdGV4dF9lbGVtZW50Ll90aXBweSAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgdGV4dF9lbGVtZW50Ll90aXBweS5kZXN0cm95ICkge1xuXHRcdFx0XHR0ZXh0X2VsZW1lbnQuX3RpcHB5LmRlc3Ryb3koKTtcblx0XHRcdH1cblx0XHRcdHRleHRfZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCAndG9vbHRpcF90b3AnLCAnd3BiY191aV9saXN0aW5nX19vdmVyZmxvd190b29sdGlwJyApO1xuXHRcdFx0dGV4dF9lbGVtZW50LnJlbW92ZUF0dHJpYnV0ZSggJ3RpdGxlJyApO1xuXHRcdFx0dGV4dF9lbGVtZW50LnJlbW92ZUF0dHJpYnV0ZSggJ2RhdGEtb3JpZ2luYWwtdGl0bGUnICk7XG5cdFx0XHRpZiAoICcxJyA9PT0gdGV4dF9lbGVtZW50LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy11aS1jYXRhbG9nLXRvb2x0aXAtdGFiaW5kZXgnICkgKSB7XG5cdFx0XHRcdHRleHRfZWxlbWVudC5yZW1vdmVBdHRyaWJ1dGUoICd0YWJpbmRleCcgKTtcblx0XHRcdFx0dGV4dF9lbGVtZW50LnJlbW92ZUF0dHJpYnV0ZSggJ2RhdGEtd3BiYy11aS1jYXRhbG9nLXRvb2x0aXAtdGFiaW5kZXgnICk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICggZnVsbF90ZXh0ICYmIGlzX292ZXJmbG93aW5nICkge1xuXHRcdFx0XHR0ZXh0X2VsZW1lbnQuc2V0QXR0cmlidXRlKCAnZGF0YS1vcmlnaW5hbC10aXRsZScsIGZ1bGxfdGV4dCApO1xuXHRcdFx0XHR0ZXh0X2VsZW1lbnQuY2xhc3NMaXN0LmFkZCggJ3Rvb2x0aXBfdG9wJywgJ3dwYmNfdWlfbGlzdGluZ19fb3ZlcmZsb3dfdG9vbHRpcCcgKTtcblx0XHRcdFx0aWYgKCAhIHRleHRfZWxlbWVudC5oYXNBdHRyaWJ1dGUoICd0YWJpbmRleCcgKSApIHtcblx0XHRcdFx0XHR0ZXh0X2VsZW1lbnQuc2V0QXR0cmlidXRlKCAndGFiaW5kZXgnLCAnMCcgKTtcblx0XHRcdFx0XHR0ZXh0X2VsZW1lbnQuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctdG9vbHRpcC10YWJpbmRleCcsICcxJyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGhhc19vdmVyZmxvd2luZ190ZXh0ID0gdHJ1ZTtcblx0XHRcdH0gZWxzZSBpZiAoIHN0YXRpY190aXRsZSApIHtcblx0XHRcdFx0dGV4dF9lbGVtZW50LnNldEF0dHJpYnV0ZSggJ3RpdGxlJywgc3RhdGljX3RpdGxlICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXG5cdFx0dG9vbHRpcF9zZWxlY3RvciA9IGNhdGFsb2dfbW91bnQuaWQgPyAnIycgKyBjYXRhbG9nX21vdW50LmlkICsgJyAud3BiY191aV9saXN0aW5nX19vdmVyZmxvd190b29sdGlwJyA6ICcnO1xuXHRcdGlmICggaGFzX292ZXJmbG93aW5nX3RleHQgJiYgdG9vbHRpcF9zZWxlY3RvciAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfZGVmaW5lX3RpcHB5X3Rvb2x0aXBzICYmIHdpbmRvdy53cGJjX2RlZmluZV90aXBweV90b29sdGlwcyggdG9vbHRpcF9zZWxlY3RvciApICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjYXRhbG9nX21vdW50LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY191aV9saXN0aW5nX19vdmVyZmxvd190b29sdGlwJyApLmZvckVhY2goIGZ1bmN0aW9uICggdGV4dF9lbGVtZW50ICkge1xuXHRcdFx0dGV4dF9lbGVtZW50LnNldEF0dHJpYnV0ZSggJ3RpdGxlJywgdGV4dF9lbGVtZW50LmdldEF0dHJpYnV0ZSggJ2RhdGEtb3JpZ2luYWwtdGl0bGUnICkgfHwgJycgKTtcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogQ3JlYXRlIGEgZG9tYWluLW5ldXRyYWwgbmF0aXZlIGluc3BlY3RvciBzdGF0ZSB3b3JrZmxvdy5cblx0ICpcblx0ICogRG9tYWlucyBzdXBwbHkgdGhlaXIgYWxsb3ctbGlzdGVkIHNoZWxsIHJlbmRlcmVyLCBob3N0L2Zvb3RlciBib3VuZGFyaWVzLFxuXHQgKiBsb2NhbGl6ZWQgc2hlbGwgZGF0YSwgYW5kIHNpZGViYXIgZXhwYW5zaW9uIGNhbGxiYWNrLiBUaGUgc2hhcmVkIHdvcmtmbG93XG5cdCAqIG93bnMgb25seSBzaGVsbCBtb3VudGluZyBhbmQgdGhlIGVtcHR5LCBsb2FkaW5nLCBlcnJvciwgYW5kIGZvcm0gc3RhdGVzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gc2V0dGluZ3MgSW5zcGVjdG9yIGJvdW5kYXJ5IGNhbGxiYWNrcyBhbmQgc2hlbGwgZGF0YS5cblx0ICogQHJldHVybiB7T2JqZWN0fGZhbHNlfSBJbnNwZWN0b3Igd29ya2Zsb3cgY29udHJvbGxlciBvciBmYWxzZSB3aGVuIGludmFsaWQuXG5cdCAqL1xuXHRmdW5jdGlvbiBjcmVhdGVfaW5zcGVjdG9yX3dvcmtmbG93KCBzZXR0aW5ncyApIHtcblx0XHR2YXIgb3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oIHtcblx0XHRcdGV4cGFuZDogbnVsbCxcblx0XHRcdGdldF9mb290ZXI6IG51bGwsXG5cdFx0XHRnZXRfaG9zdDogbnVsbCxcblx0XHRcdHJlbmRlcl9zaGVsbDogbnVsbCxcblx0XHRcdHNoZWxsX2RhdGE6IHt9XG5cdFx0fSwgc2V0dGluZ3MgfHwge30gKTtcblxuXHRcdGlmICggJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIG9wdGlvbnMuZ2V0X2hvc3QgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIG9wdGlvbnMucmVuZGVyX3NoZWxsICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiB0aGUgY3VycmVudCBkb21haW4tb3duZWQgaW5zcGVjdG9yIGhvc3QuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtFbGVtZW50fG51bGx9IEluc3BlY3RvciBob3N0IG9yIG51bGwgd2hlbiBpdCBpcyB1bmF2YWlsYWJsZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfaG9zdCgpIHtcblx0XHRcdHZhciBob3N0ID0gb3B0aW9ucy5nZXRfaG9zdCgpO1xuXG5cdFx0XHRyZXR1cm4gaG9zdCAmJiBob3N0LnF1ZXJ5U2VsZWN0b3IgPyBob3N0IDogbnVsbDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gdGhlIGN1cnJlbnQgZG9tYWluLW93bmVkIHN0aWNreSBmb290ZXIgd2hlbiBjb25maWd1cmVkLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7RWxlbWVudHxudWxsfSBJbnNwZWN0b3IgZm9vdGVyIG9yIG51bGwgd2hlbiBpdCBpcyB1bmF2YWlsYWJsZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfZm9vdGVyKCkge1xuXHRcdFx0dmFyIGZvb3RlciA9ICdmdW5jdGlvbicgPT09IHR5cGVvZiBvcHRpb25zLmdldF9mb290ZXIgPyBvcHRpb25zLmdldF9mb290ZXIoKSA6IG51bGw7XG5cblx0XHRcdHJldHVybiBmb290ZXIgJiYgZm9vdGVyLnF1ZXJ5U2VsZWN0b3IgPyBmb290ZXIgOiBudWxsO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE1vdW50IHRoZSBhbGxvdy1saXN0ZWQgc2hhcmVkIHNoZWxsIGluc2lkZSB0aGUgZG9tYWluIGhvc3Qgb25jZS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgaW5zcGVjdG9yIHNoZWxsIGlzIGF2YWlsYWJsZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBtb3VudCgpIHtcblx0XHRcdHZhciBob3N0ID0gZ2V0X2hvc3QoKTtcblx0XHRcdHZhciByZW5kZXJlZF9zaGVsbDtcblxuXHRcdFx0aWYgKCAhIGhvc3QgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmICggISBob3N0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5zcGVjdG9yXScgKSApIHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRyZW5kZXJlZF9zaGVsbCA9IG9wdGlvbnMucmVuZGVyX3NoZWxsKCBPYmplY3QuYXNzaWduKCB7fSwgb3B0aW9ucy5zaGVsbF9kYXRhIHx8IHt9ICkgKTtcblx0XHRcdFx0fSBjYXRjaCAoIGVycm9yICkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICdzdHJpbmcnICE9PSB0eXBlb2YgcmVuZGVyZWRfc2hlbGwgfHwgISByZW5kZXJlZF9zaGVsbCApIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0aG9zdC5pbm5lckhUTUwgPSByZW5kZXJlZF9zaGVsbDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuICEhIGhvc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbnNwZWN0b3JdJyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFN5bmNocm9uaXplIG9uZSBhbGxvdy1saXN0ZWQgaW5zcGVjdG9yIHByZXNlbnRhdGlvbiBzdGF0ZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBzdGF0ZSAgIEVtcHR5LCBsb2FkaW5nLCBlcnJvciwgb3IgZm9ybS5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSBPcHRpb25hbCBzYWZlIGVycm9yIG1lc3NhZ2UuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBtb3VudGVkIHNoZWxsIHdhcyB1cGRhdGVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNldF9zdGF0ZSggc3RhdGUsIG1lc3NhZ2UgKSB7XG5cdFx0XHR2YXIgZXJyb3I7XG5cdFx0XHR2YXIgZXJyb3JfdGV4dDtcblx0XHRcdHZhciBmb290ZXI7XG5cdFx0XHR2YXIgZm9ybV90YXJnZXQ7XG5cdFx0XHR2YXIgaG9zdDtcblx0XHRcdHZhciBsb2FkaW5nO1xuXHRcdFx0dmFyIGVtcHR5O1xuXG5cdFx0XHRpZiAoIFsgJ2VtcHR5JywgJ2xvYWRpbmcnLCAnZXJyb3InLCAnZm9ybScgXS5pbmRleE9mKCBzdGF0ZSApIDwgMCB8fCAhIG1vdW50KCkgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0aG9zdCA9IGdldF9ob3N0KCk7XG5cdFx0XHRmb290ZXIgPSBnZXRfZm9vdGVyKCk7XG5cdFx0XHRlbXB0eSA9IGhvc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbnNwZWN0b3ItZW1wdHldJyApO1xuXHRcdFx0bG9hZGluZyA9IGhvc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbnNwZWN0b3ItbG9hZGluZ10nICk7XG5cdFx0XHRlcnJvciA9IGhvc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbnNwZWN0b3ItZXJyb3JdJyApO1xuXHRcdFx0Zm9ybV90YXJnZXQgPSBob3N0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5zcGVjdG9yLWZvcm1dJyApO1xuXG5cdFx0XHRpZiAoIGVtcHR5ICkgeyBlbXB0eS5oaWRkZW4gPSAnZW1wdHknICE9PSBzdGF0ZTsgfVxuXHRcdFx0aWYgKCBsb2FkaW5nICkgeyBsb2FkaW5nLmhpZGRlbiA9ICdsb2FkaW5nJyAhPT0gc3RhdGU7IH1cblx0XHRcdGlmICggZXJyb3IgKSB7XG5cdFx0XHRcdGVycm9yLmhpZGRlbiA9ICdlcnJvcicgIT09IHN0YXRlO1xuXHRcdFx0XHRlcnJvcl90ZXh0ID0gZXJyb3IucXVlcnlTZWxlY3RvciggJ3AnICk7XG5cdFx0XHRcdGlmICggZXJyb3JfdGV4dCApIHsgZXJyb3JfdGV4dC50ZXh0Q29udGVudCA9IFN0cmluZyggbWVzc2FnZSB8fCAnJyApOyB9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGZvcm1fdGFyZ2V0ICYmICdmb3JtJyAhPT0gc3RhdGUgKSB7IGZvcm1fdGFyZ2V0LmlubmVySFRNTCA9ICcnOyB9XG5cdFx0XHRpZiAoIGZvb3RlciApIHsgZm9vdGVyLmhpZGRlbiA9ICdmb3JtJyAhPT0gc3RhdGU7IH1cblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRXhwYW5kIHRoZSBjb25maWd1cmVkIG5hdGl2ZSBzaWRlYmFyIGJvdW5kYXJ5LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBleHBhbmQoKSB7XG5cdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiBvcHRpb25zLmV4cGFuZCApIHtcblx0XHRcdFx0b3B0aW9ucy5leHBhbmQoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBNb3VudCwgcmV2ZWFsIGxvYWRpbmcgc3RhdGUsIGFuZCBpbW1lZGlhdGVseSBleHBhbmQgdGhlIGluc3BlY3Rvci5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgbG9hZGluZyBzdGF0ZSB3YXMgb3BlbmVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG9wZW5fbG9hZGluZygpIHtcblx0XHRcdGlmICggISBzZXRfc3RhdGUoICdsb2FkaW5nJywgJycgKSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0ZXhwYW5kKCk7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiB0aGUgc2hlbGwgZm9ybSB0YXJnZXQgdXNlZCBieSBkb21haW4tb3duZWQgdGVtcGxhdGVzLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7RWxlbWVudHxudWxsfSBGb3JtIHRhcmdldCBvciBudWxsIHdoZW4gbW91bnRpbmcgZmFpbGVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9mb3JtX3RhcmdldCgpIHtcblx0XHRcdHZhciBob3N0ID0gbW91bnQoKSA/IGdldF9ob3N0KCkgOiBudWxsO1xuXG5cdFx0XHRyZXR1cm4gaG9zdCA/IGhvc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbnNwZWN0b3ItZm9ybV0nICkgOiBudWxsO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRleHBhbmQ6IGV4cGFuZCxcblx0XHRcdGdldF9mb3JtX3RhcmdldDogZ2V0X2Zvcm1fdGFyZ2V0LFxuXHRcdFx0bW91bnQ6IG1vdW50LFxuXHRcdFx0b3Blbl9sb2FkaW5nOiBvcGVuX2xvYWRpbmcsXG5cdFx0XHRzZXRfc3RhdGU6IHNldF9zdGF0ZVxuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogQ3JlYXRlIGEgZG9tYWluLW5ldXRyYWwgaW5saW5lLWVkaXRpbmcgd29ya2Zsb3cgY29udHJvbGxlci5cblx0ICpcblx0ICogRG9tYWlucyByZXRhaW4gb3duZXJzaGlwIG9mIGVkaXRhYmxlIGZpZWxkcywgZHJhZnQgdmFsdWVzLCBhdXRob3JpemF0aW9uLFxuXHQgKiByZXZpZXcgcGF5bG9hZHMsIGFuZCBtdXRhdGlvbnMuIFRoaXMgY29udHJvbGxlciBvbmx5IHN5bmNocm9uaXplcyB0aGVcblx0ICogcmVwZWF0ZWQgY2F0YWxvZyBtZWNoYW5pY3MgYXJvdW5kIGFuIGFjdGl2ZSBpbmxpbmUgd29ya2Zsb3c6IHN0aWNreS1iYXJcblx0ICogcmVnaXN0cmF0aW9uLCBidXN5IGNvbnRyb2xzLCBuYXZpZ2F0aW9uIGxvY2tpbmcsIGNoYW5nZWQtcm93IHByZXNlbnRhdGlvbixcblx0ICogYW5kIHRoZSBzaGFyZWQgYWN0aXZlLXN0YXRlIGNsYXNzZXMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8c3RyaW5nfSBjYXRhbG9nX21vdW50IENhdGFsb2cgbW91bnQgZWxlbWVudCBvciBpdHMgSUQuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgICAgICAgICBzZXR0aW5ncyAgICAgIERvbWFpbiBzZWxlY3RvcnMgYW5kIHBhZ2UgZWxlbWVudC5cblx0ICogQHJldHVybiB7T2JqZWN0fGZhbHNlfSBJbmxpbmUgd29ya2Zsb3cgY29udHJvbGxlciBvciBmYWxzZSB3aGVuIHVuYXZhaWxhYmxlLlxuXHQgKi9cblx0ZnVuY3Rpb24gY3JlYXRlX2lubGluZV9lZGl0aW5nX3dvcmtmbG93KCBjYXRhbG9nX21vdW50LCBzZXR0aW5ncyApIHtcblx0XHR2YXIgb3B0aW9ucztcblx0XHR2YXIgbW91bnRfZWxlbWVudCA9ICdzdHJpbmcnID09PSB0eXBlb2YgY2F0YWxvZ19tb3VudCA/IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBjYXRhbG9nX21vdW50ICkgOiBjYXRhbG9nX21vdW50O1xuXHRcdHZhciBkZWZhdWx0X3Byb3RlY3RlZF9zZWxlY3RvciA9IFtcblx0XHRcdCdbZGF0YS13cGJjLXVpLWNhdGFsb2ctdmlld10nLFxuXHRcdFx0J1tkYXRhLXdwYmMtdWktY2F0YWxvZy10ZW1wbGF0ZS1wYWNrXScsXG5cdFx0XHQnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWRpc3BsYXktY3VzdG9taXplcl0gc3VtbWFyeScsXG5cdFx0XHQnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXNlYXJjaF0nLFxuXHRcdFx0J1tkYXRhLXdwYmMtdWktY2F0YWxvZy1maWx0ZXJdJyxcblx0XHRcdCdbZGF0YS13cGJjLXVpLWNhdGFsb2ctc2VsZWN0LWl0ZW1dJyxcblx0XHRcdCdbZGF0YS13cGJjLXVpLWNhdGFsb2ctc2VsZWN0LWFsbF0nLFxuXHRcdFx0J1tkYXRhLXdwYmMtdWktY2F0YWxvZy1zb3J0XScsXG5cdFx0XHQnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXBhZ2VdJyxcblx0XHRcdCdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaXRlbXMtcGVyLXBhZ2VdJyxcblx0XHRcdCdbZGF0YS13cGJjLXVpLWNhdGFsb2ctY29sdW1uLXZpc2libGVdJyxcblx0XHRcdCdbZGF0YS13cGJjLXVpLWNhdGFsb2ctY29sdW1uLW9yZGVyLXJlc2V0XScsXG5cdFx0XHQnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXByZWZlcmVuY2VzLXJlc2V0XSdcblx0XHRdLmpvaW4oICcsICcgKTtcblxuXHRcdGlmICggISBtb3VudF9lbGVtZW50IHx8ICEgbW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKCB7XG5cdFx0XHRiYXJfc2VsZWN0b3I6ICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5saW5lLWJhcl0nLFxuXHRcdFx0Y2FuY2VsX3NlbGVjdG9yOiAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWlubGluZS1jYW5jZWxdJyxcblx0XHRcdGNvbnRyb2xzX3Jvb3Q6IG1vdW50X2VsZW1lbnQsXG5cdFx0XHRjb3VudF9zZWxlY3RvcjogJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbmxpbmUtY291bnRdJyxcblx0XHRcdHBhZ2VfZWxlbWVudDogbW91bnRfZWxlbWVudCxcblx0XHRcdHByb3RlY3RlZF9zZWxlY3RvcjogJycsXG5cdFx0XHRyZXZpZXdfc2VsZWN0b3I6ICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5saW5lLXJldmlld10nLFxuXHRcdFx0dG9nZ2xlX2xhYmVsX3NlbGVjdG9yOiAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWlubGluZS10b2dnbGUtbGFiZWxdJyxcblx0XHRcdHRvZ2dsZV9zZWxlY3RvcjogJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbmxpbmUtdG9nZ2xlXSdcblx0XHR9LCBzZXR0aW5ncyB8fCB7fSApO1xuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBjb25maWd1cmVkIHBhZ2UgZWxlbWVudCB3aXRob3V0IGVzY2FwaW5nIHRoZSBjYXRhbG9nIG1vdW50LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7SFRNTEVsZW1lbnR8bnVsbH0gQ29uZmlndXJlZCBwYWdlIHJvb3QsIG1vdW50LCBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9wYWdlX2VsZW1lbnQoKSB7XG5cdFx0XHRpZiAoIG9wdGlvbnMucGFnZV9lbGVtZW50ICYmIG9wdGlvbnMucGFnZV9lbGVtZW50Lm5vZGVUeXBlICkge1xuXHRcdFx0XHRyZXR1cm4gb3B0aW9ucy5wYWdlX2VsZW1lbnQ7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiAnc3RyaW5nJyA9PT0gdHlwZW9mIG9wdGlvbnMucGFnZV9lbGVtZW50XG5cdFx0XHRcdD8gbW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCBvcHRpb25zLnBhZ2VfZWxlbWVudCApXG5cdFx0XHRcdDogbW91bnRfZWxlbWVudDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gdGhlIGNvbXBsZXRlIHNlbGVjdG9yIGZvciBjb250cm9scyBsb2NrZWQgYnkgYWN0aXZlIGRyYWZ0cy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gU2hhcmVkIHNlbGVjdG9ycyBwbHVzIHRoZSB0cnVzdGVkIGRvbWFpbiBleHRlbnNpb24uXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3Byb3RlY3RlZF9zZWxlY3RvcigpIHtcblx0XHRcdHJldHVybiBvcHRpb25zLnByb3RlY3RlZF9zZWxlY3RvclxuXHRcdFx0XHQ/IGRlZmF1bHRfcHJvdGVjdGVkX3NlbGVjdG9yICsgJywgJyArIG9wdGlvbnMucHJvdGVjdGVkX3NlbGVjdG9yXG5cdFx0XHRcdDogZGVmYXVsdF9wcm90ZWN0ZWRfc2VsZWN0b3I7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUHJlc2VydmUgYW5kIHJlc3RvcmUgYSBjb250cm9sJ3MgcHJlLXdvcmtmbG93IGRpc2FibGVkIHN0YXRlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gY29udHJvbCAgICAgICAgIENhdGFsb2cgY29udHJvbCB0byBzeW5jaHJvbml6ZS5cblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59ICAgICBjb250cm9sc19sb2NrZWQgV2hldGhlciBpbmxpbmUgbmF2aWdhdGlvbiBpcyBsb2NrZWQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzeW5jaHJvbml6ZV9wcm90ZWN0ZWRfY29udHJvbCggY29udHJvbCwgY29udHJvbHNfbG9ja2VkICkge1xuXHRcdFx0dmFyIHByaW9yX2Rpc2FibGVkO1xuXG5cdFx0XHRpZiAoIGNvbnRyb2xzX2xvY2tlZCApIHtcblx0XHRcdFx0aWYgKCAhIGNvbnRyb2wuaGFzQXR0cmlidXRlKCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5saW5lLXdhcy1kaXNhYmxlZCcgKSApIHtcblx0XHRcdFx0XHRjb250cm9sLnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy11aS1jYXRhbG9nLWlubGluZS13YXMtZGlzYWJsZWQnLCBjb250cm9sLmRpc2FibGVkID8gJzEnIDogJzAnICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29udHJvbC5kaXNhYmxlZCA9IHRydWU7XG5cdFx0XHRcdGNvbnRyb2wuc2V0QXR0cmlidXRlKCAnYXJpYS1kaXNhYmxlZCcsICd0cnVlJyApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICggISBjb250cm9sLmhhc0F0dHJpYnV0ZSggJ2RhdGEtd3BiYy11aS1jYXRhbG9nLWlubGluZS13YXMtZGlzYWJsZWQnICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHByaW9yX2Rpc2FibGVkID0gJzEnID09PSBjb250cm9sLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy11aS1jYXRhbG9nLWlubGluZS13YXMtZGlzYWJsZWQnICk7XG5cdFx0XHRjb250cm9sLmRpc2FibGVkID0gcHJpb3JfZGlzYWJsZWQ7XG5cdFx0XHRjb250cm9sLnJlbW92ZUF0dHJpYnV0ZSggJ2RhdGEtd3BiYy11aS1jYXRhbG9nLWlubGluZS13YXMtZGlzYWJsZWQnICk7XG5cdFx0XHRpZiAoICEgcHJpb3JfZGlzYWJsZWQgKSB7XG5cdFx0XHRcdGNvbnRyb2wucmVtb3ZlQXR0cmlidXRlKCAnYXJpYS1kaXNhYmxlZCcgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWdpc3RlciB0aGUgY3VycmVudCBpbmxpbmUgYmFyIHdpdGggdGhlIHNoYXJlZCB2aWV3cG9ydCBjb250cm9sbGVyLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZWdpc3Rlcl9zdGlja3lfYmFyKCkge1xuXHRcdFx0dmFyIGlubGluZV9iYXIgPSBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoIG9wdGlvbnMuYmFyX3NlbGVjdG9yICk7XG5cdFx0XHR2YXIgc2VsZWN0aW9uX2NvbnRyb2xsZXIgPSBtb3VudF9lbGVtZW50Ll93cGJjX3VpX2NhdGFsb2dfc2VsZWN0aW9uX2NvbnRyb2xsZXI7XG5cblx0XHRcdGlmICggaW5saW5lX2JhciAmJiBzZWxlY3Rpb25fY29udHJvbGxlciAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygc2VsZWN0aW9uX2NvbnRyb2xsZXIucmVnaXN0ZXJfdmlld3BvcnRfc3RpY2t5ICkge1xuXHRcdFx0XHRzZWxlY3Rpb25fY29udHJvbGxlci5yZWdpc3Rlcl92aWV3cG9ydF9zdGlja3koIGlubGluZV9iYXIgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW1vdmUgc2hhcmVkIGNoYW5nZWQtcm93IHByZXNlbnRhdGlvbiBhZnRlciBpbmxpbmUgbW9kZSBlbmRzLlxuXHRcdCAqXG5cdFx0ICogRG9tYWluIGRyYWZ0cyBhbmQgdmFsdWVzIHJlbWFpbiBkb21haW4tb3duZWQuIFRoaXMgY2xlYW51cCByZW1vdmVzIG9ubHlcblx0XHQgKiB0aGUgc2hhcmVkIGNsYXNzIGFuZCBiYWRnZSB0aGF0IHRoaXMgY29udHJvbGxlciBwcmV2aW91c2x5IGFwcGxpZWQuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNsZWFyX2NoYW5nZWRfcm93cygpIHtcblx0XHRcdG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX3VpX2NhdGFsb2dfaW5saW5lX3Jvdy5pcy1pbmxpbmUtY2hhbmdlZCcgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHJvd19lbGVtZW50ICkge1xuXHRcdFx0XHRzZXRfcm93X2NoYW5nZWQoIHJvd19lbGVtZW50LCBmYWxzZSwgbnVsbCwgJycgKTtcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTeW5jaHJvbml6ZSBzaGFyZWQgaW5saW5lIHdvcmtmbG93IHByZXNlbnRhdGlvbiBmcm9tIGRvbWFpbi1vd25lZCBzdGF0ZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSB3b3JrZmxvd19zdGF0ZSBOb3JtYWxpemVkIGFjdGl2ZSwgYnVzeSwgY291bnQsIGFuZCBsYWJlbHMuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzeW5jaHJvbml6ZSggd29ya2Zsb3dfc3RhdGUgKSB7XG5cdFx0XHR2YXIgYWN0aXZlO1xuXHRcdFx0dmFyIGJ1c3k7XG5cdFx0XHR2YXIgY29udHJvbHNfcm9vdDtcblx0XHRcdHZhciBjb250cm9sc19sb2NrZWQ7XG5cdFx0XHR2YXIgaW5saW5lX2Jhcjtcblx0XHRcdHZhciBwYWdlX2VsZW1lbnQ7XG5cdFx0XHR2YXIgdG9nZ2xlX2J1dHRvbjtcblx0XHRcdHZhciB0b2dnbGVfbGFiZWw7XG5cblx0XHRcdHdvcmtmbG93X3N0YXRlID0gd29ya2Zsb3dfc3RhdGUgfHwge307XG5cdFx0XHRhY3RpdmUgPSB0cnVlID09PSB3b3JrZmxvd19zdGF0ZS5hY3RpdmU7XG5cdFx0XHRidXN5ID0gdHJ1ZSA9PT0gd29ya2Zsb3dfc3RhdGUuYnVzeTtcblx0XHRcdGNvbnRyb2xzX3Jvb3QgPSBvcHRpb25zLmNvbnRyb2xzX3Jvb3QgJiYgb3B0aW9ucy5jb250cm9sc19yb290LnF1ZXJ5U2VsZWN0b3JBbGwgPyBvcHRpb25zLmNvbnRyb2xzX3Jvb3QgOiBtb3VudF9lbGVtZW50O1xuXHRcdFx0Y29udHJvbHNfbG9ja2VkID0gYWN0aXZlIHx8IHRydWUgPT09IHdvcmtmbG93X3N0YXRlLmxvY2tfY29udHJvbHM7XG5cdFx0XHRpbmxpbmVfYmFyID0gbW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCBvcHRpb25zLmJhcl9zZWxlY3RvciApO1xuXHRcdFx0cGFnZV9lbGVtZW50ID0gZ2V0X3BhZ2VfZWxlbWVudCgpO1xuXHRcdFx0dG9nZ2xlX2J1dHRvbiA9IG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3Rvciggb3B0aW9ucy50b2dnbGVfc2VsZWN0b3IgKTtcblxuXHRcdFx0aWYgKCBpbmxpbmVfYmFyICkge1xuXHRcdFx0XHRpbmxpbmVfYmFyLmhpZGRlbiA9ICEgYWN0aXZlO1xuXHRcdFx0XHRpbmxpbmVfYmFyLnNldEF0dHJpYnV0ZSggJ2FyaWEtYnVzeScsIGJ1c3kgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0XHRcdGlmICggaW5saW5lX2Jhci5xdWVyeVNlbGVjdG9yKCBvcHRpb25zLmNvdW50X3NlbGVjdG9yICkgKSB7XG5cdFx0XHRcdFx0aW5saW5lX2Jhci5xdWVyeVNlbGVjdG9yKCBvcHRpb25zLmNvdW50X3NlbGVjdG9yICkudGV4dENvbnRlbnQgPSBTdHJpbmcoIHdvcmtmbG93X3N0YXRlLmNvdW50X3RleHQgfHwgJycgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIGlubGluZV9iYXIucXVlcnlTZWxlY3Rvciggb3B0aW9ucy5yZXZpZXdfc2VsZWN0b3IgKSApIHtcblx0XHRcdFx0XHRpbmxpbmVfYmFyLnF1ZXJ5U2VsZWN0b3IoIG9wdGlvbnMucmV2aWV3X3NlbGVjdG9yICkuZGlzYWJsZWQgPSBidXN5IHx8ICEgTnVtYmVyKCB3b3JrZmxvd19zdGF0ZS5jaGFuZ2VkX2NvdW50IHx8IDAgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIGlubGluZV9iYXIucXVlcnlTZWxlY3Rvciggb3B0aW9ucy5jYW5jZWxfc2VsZWN0b3IgKSApIHtcblx0XHRcdFx0XHRpbmxpbmVfYmFyLnF1ZXJ5U2VsZWN0b3IoIG9wdGlvbnMuY2FuY2VsX3NlbGVjdG9yICkuZGlzYWJsZWQgPSBidXN5O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmICggdG9nZ2xlX2J1dHRvbiApIHtcblx0XHRcdFx0dG9nZ2xlX2J1dHRvbi5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtYWN0aXZlJywgYWN0aXZlICk7XG5cdFx0XHRcdHRvZ2dsZV9idXR0b24uY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWJ1c3knLCBidXN5ICk7XG5cdFx0XHRcdHRvZ2dsZV9idXR0b24uZGlzYWJsZWQgPSBidXN5XG5cdFx0XHRcdFx0fHwgdHJ1ZSA9PT0gd29ya2Zsb3dfc3RhdGUudG9nZ2xlX2Rpc2FibGVkXG5cdFx0XHRcdFx0fHwgKCAhIGFjdGl2ZSAmJiBmYWxzZSA9PT0gd29ya2Zsb3dfc3RhdGUuaGFzX2l0ZW1zICk7XG5cdFx0XHRcdHRvZ2dsZV9idXR0b24uc2V0QXR0cmlidXRlKCAnYXJpYS1wcmVzc2VkJywgYWN0aXZlID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xuXHRcdFx0XHR0b2dnbGVfYnV0dG9uLnNldEF0dHJpYnV0ZSggJ2FyaWEtYnVzeScsIGJ1c3kgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0XHRcdHRvZ2dsZV9sYWJlbCA9IHRvZ2dsZV9idXR0b24ucXVlcnlTZWxlY3Rvciggb3B0aW9ucy50b2dnbGVfbGFiZWxfc2VsZWN0b3IgKTtcblx0XHRcdFx0aWYgKCB0b2dnbGVfbGFiZWwgKSB7XG5cdFx0XHRcdFx0dG9nZ2xlX2xhYmVsLnRleHRDb250ZW50ID0gYWN0aXZlXG5cdFx0XHRcdFx0XHQ/IFN0cmluZyggd29ya2Zsb3dfc3RhdGUuYWN0aXZlX3RvZ2dsZV90ZXh0IHx8ICcnIClcblx0XHRcdFx0XHRcdDogU3RyaW5nKCB3b3JrZmxvd19zdGF0ZS5pbmFjdGl2ZV90b2dnbGVfdGV4dCB8fCAnJyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmICggcGFnZV9lbGVtZW50ICkge1xuXHRcdFx0XHRwYWdlX2VsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWlubGluZS1lZGl0aW5nJywgYWN0aXZlICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgYWN0aXZlICkge1xuXHRcdFx0XHRjbGVhcl9jaGFuZ2VkX3Jvd3MoKTtcblx0XHRcdH1cblx0XHRcdGNvbnRyb2xzX3Jvb3QucXVlcnlTZWxlY3RvckFsbCggZ2V0X3Byb3RlY3RlZF9zZWxlY3RvcigpICkuZm9yRWFjaCggZnVuY3Rpb24gKCBjb250cm9sICkge1xuXHRcdFx0XHRzeW5jaHJvbml6ZV9wcm90ZWN0ZWRfY29udHJvbCggY29udHJvbCwgY29udHJvbHNfbG9ja2VkICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRyZWdpc3Rlcl9zdGlja3lfYmFyKCk7XG5cdFx0XHRpZiAoXG5cdFx0XHRcdG1vdW50X2VsZW1lbnQuX3dwYmNfdWlfY2F0YWxvZ19zZWxlY3Rpb25fY29udHJvbGxlclxuXHRcdFx0XHQmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgbW91bnRfZWxlbWVudC5fd3BiY191aV9jYXRhbG9nX3NlbGVjdGlvbl9jb250cm9sbGVyLnJlZnJlc2hfdmlld3BvcnRfc3RpY2t5XG5cdFx0XHQpIHtcblx0XHRcdFx0bW91bnRfZWxlbWVudC5fd3BiY191aV9jYXRhbG9nX3NlbGVjdGlvbl9jb250cm9sbGVyLnJlZnJlc2hfdmlld3BvcnRfc3RpY2t5KCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQmxvY2sgYSBjYXB0dXJlZCBldmVudCB0aGF0IHRhcmdldHMgYSBjb250cm9sIHByb3RlY3RlZCBieSBhY3RpdmUgZHJhZnRzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtFdmVudH0gICBldmVudCAgICAgICAgICAgQ2FwdHVyZWQgYnJvd3NlciBldmVudC5cblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IGNvbnRyb2xzX2xvY2tlZCBXaGV0aGVyIHRoZSBkb21haW4gd29ya2Zsb3cgaXMgYWN0aXZlLlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgZXZlbnQgd2FzIGJsb2NrZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcHJvdGVjdF9ldmVudCggZXZlbnQsIGNvbnRyb2xzX2xvY2tlZCApIHtcblx0XHRcdGlmICggISBjb250cm9sc19sb2NrZWQgfHwgISBldmVudC50YXJnZXQgfHwgISBldmVudC50YXJnZXQuY2xvc2VzdCApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIGV2ZW50LnRhcmdldC5jbG9zZXN0KCBnZXRfcHJvdGVjdGVkX3NlbGVjdG9yKCkgKSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0ZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTeW5jaHJvbml6ZSBvbmUgY2hhbmdlZCByb3cgYW5kIGl0cyBhY2Nlc3NpYmxlIHRleHQgYmFkZ2UuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSByb3dfZWxlbWVudCAgICAgICBEb21haW4gcm93IG9yIGNhcmQgZWxlbWVudC5cblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59ICAgICBjaGFuZ2VkICAgICAgICAgICBXaGV0aGVyIGl0cyBkcmFmdCBkaWZmZXJzLlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGluZGljYXRvcl9lbGVtZW50IEVsZW1lbnQgcmVjZWl2aW5nIHRoZSBiYWRnZS5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICBjaGFuZ2VkX2xhYmVsICAgICBMb2NhbGl6ZWQgYmFkZ2UgdGV4dC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNldF9yb3dfY2hhbmdlZCggcm93X2VsZW1lbnQsIGNoYW5nZWQsIGluZGljYXRvcl9lbGVtZW50LCBjaGFuZ2VkX2xhYmVsICkge1xuXHRcdFx0dmFyIGluZGljYXRvcjtcblxuXHRcdFx0aWYgKCAhIHJvd19lbGVtZW50ICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRyb3dfZWxlbWVudC5jbGFzc0xpc3QuYWRkKCAnd3BiY191aV9jYXRhbG9nX2lubGluZV9yb3cnICk7XG5cdFx0XHRyb3dfZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtaW5saW5lLWNoYW5nZWQnLCAhISBjaGFuZ2VkICk7XG5cdFx0XHRpbmRpY2F0b3IgPSByb3dfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWlubGluZS1jaGFuZ2VkLWxhYmVsXScgKTtcblx0XHRcdGlmICggISBjaGFuZ2VkICkge1xuXHRcdFx0XHRpZiAoIGluZGljYXRvciApIHtcblx0XHRcdFx0XHRpbmRpY2F0b3IucmVtb3ZlKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIGluZGljYXRvciAmJiBpbmRpY2F0b3JfZWxlbWVudCApIHtcblx0XHRcdFx0aW5kaWNhdG9yID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ3NwYW4nICk7XG5cdFx0XHRcdGluZGljYXRvci5jbGFzc05hbWUgPSAnd3BiY191aV9jYXRhbG9nX2lubGluZV9jaGFuZ2VkX2xhYmVsJztcblx0XHRcdFx0aW5kaWNhdG9yLnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy11aS1jYXRhbG9nLWlubGluZS1jaGFuZ2VkLWxhYmVsJywgJycgKTtcblx0XHRcdFx0aW5kaWNhdG9yX2VsZW1lbnQuYXBwZW5kQ2hpbGQoIGluZGljYXRvciApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBpbmRpY2F0b3IgKSB7XG5cdFx0XHRcdGluZGljYXRvci50ZXh0Q29udGVudCA9IFN0cmluZyggY2hhbmdlZF9sYWJlbCB8fCAnJyApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRwcm90ZWN0X2V2ZW50OiBwcm90ZWN0X2V2ZW50LFxuXHRcdFx0cmVnaXN0ZXJfc3RpY2t5X2JhcjogcmVnaXN0ZXJfc3RpY2t5X2Jhcixcblx0XHRcdHNldF9yb3dfY2hhbmdlZDogc2V0X3Jvd19jaGFuZ2VkLFxuXHRcdFx0c3luY2hyb25pemU6IHN5bmNocm9uaXplXG5cdFx0fTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGUgYSBkb21haW4tbmV1dHJhbCBzaWduZWQtcmV2aWV3IHByZXNlbnRhdGlvbiBjb250cm9sbGVyLlxuXHQgKlxuXHQgKiBEb21haW5zIG93biBwcmV2aWV3IGFuZCBhcHBseSByZXF1ZXN0cywgc2lnbmVkIHBsYW5zLCBwZXJtaXNzaW9ucywgZmllbGRcblx0ICogdmFsaWRhdGlvbiwgYW5kIG11dGF0aW9ucy4gVGhpcyBjb250cm9sbGVyIGFjY2VwdHMgb25seSB0aGUgbm9ybWFsaXplZFxuXHQgKiByZXZpZXcgRFRPIGFuZCBvd25zIHRoZSByZXBlYXRlZCBtb2RlbCBwcmVwYXJhdGlvbiBhbmQgYnVzeS1zdGF0ZSBsb2NraW5nLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gc2V0dGluZ3MgRE9NIHJvb3RzIGFuZCBkb21haW4gYnV0dG9uIHNlbGVjdG9ycy5cblx0ICogQHJldHVybiB7T2JqZWN0fSBSZXZpZXcgcHJlc2VudGF0aW9uIGNvbnRyb2xsZXIuXG5cdCAqL1xuXHRmdW5jdGlvbiBjcmVhdGVfaW5saW5lX3Jldmlld193b3JrZmxvdyggc2V0dGluZ3MgKSB7XG5cdFx0dmFyIG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKCB7XG5cdFx0XHRhcHBseV9zZWxlY3RvcjogJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbmxpbmUtcmV2aWV3LWFwcGx5XScsXG5cdFx0XHRjYW5jZWxfc2VsZWN0b3I6ICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5saW5lLXJldmlldy1jYW5jZWxdJyxcblx0XHRcdHJvb3Q6IGRvY3VtZW50XG5cdFx0fSwgc2V0dGluZ3MgfHwge30gKTtcblxuXHRcdC8qKlxuXHRcdCAqIE5vcm1hbGl6ZSBvbmUgc2VydmVyLWF1dGhvcml0YXRpdmUgcmV2aWV3IERUTyBmb3IgYSBkb21haW4gdGVtcGxhdGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcmV2aWV3ICAgICAgIFNlcnZlciByZXZpZXcgd2l0aCByb3dzIGFuZCBmaWVsZCBjaGFuZ2VzLlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBwcmVzZW50YXRpb24gTG9jYWxpemVkIGhlYWRpbmdzIGFuZCBleHBsYW5hdG9yeSB0ZXh0LlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gRXhlY3V0YWJsZS1mcmVlIHRlbXBsYXRlIG1vZGVsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHByZXBhcmUoIHJldmlldywgcHJlc2VudGF0aW9uICkge1xuXHRcdFx0dmFyIG5vcm1hbGl6ZWRfcm93cyA9IFtdO1xuXG5cdFx0XHRyZXZpZXcgPSByZXZpZXcgJiYgJ29iamVjdCcgPT09IHR5cGVvZiByZXZpZXcgPyByZXZpZXcgOiB7fTtcblx0XHRcdHByZXNlbnRhdGlvbiA9IHByZXNlbnRhdGlvbiAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIHByZXNlbnRhdGlvbiA/IHByZXNlbnRhdGlvbiA6IHt9O1xuXHRcdFx0KCBBcnJheS5pc0FycmF5KCByZXZpZXcucm93cyApID8gcmV2aWV3LnJvd3MgOiBbXSApLmZvckVhY2goIGZ1bmN0aW9uICggcm93ICkge1xuXHRcdFx0XHR2YXIgbm9ybWFsaXplZF9maWVsZHMgPSBbXTtcblx0XHRcdFx0dmFyIG5vcm1hbGl6ZWRfbm90ZXMgPSBbXTtcblxuXHRcdFx0XHRpZiAoICEgcm93IHx8ICdvYmplY3QnICE9PSB0eXBlb2Ygcm93ICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHQoIEFycmF5LmlzQXJyYXkoIHJvdy5maWVsZHMgKSA/IHJvdy5maWVsZHMgOiBbXSApLmZvckVhY2goIGZ1bmN0aW9uICggZmllbGQgKSB7XG5cdFx0XHRcdFx0aWYgKCAhIGZpZWxkIHx8ICdvYmplY3QnICE9PSB0eXBlb2YgZmllbGQgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG5vcm1hbGl6ZWRfZmllbGRzLnB1c2goIHtcblx0XHRcdFx0XHRcdGFmdGVyOiBTdHJpbmcoIHVuZGVmaW5lZCA9PT0gZmllbGQuYWZ0ZXIgPyAnJyA6IGZpZWxkLmFmdGVyICksXG5cdFx0XHRcdFx0XHRiZWZvcmU6IFN0cmluZyggdW5kZWZpbmVkID09PSBmaWVsZC5iZWZvcmUgPyAnJyA6IGZpZWxkLmJlZm9yZSApLFxuXHRcdFx0XHRcdFx0a2V5OiBTdHJpbmcoIGZpZWxkLmtleSB8fCAnJyApLFxuXHRcdFx0XHRcdFx0bGFiZWw6IFN0cmluZyggZmllbGQubGFiZWwgfHwgZmllbGQua2V5IHx8ICcnIClcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0KCBBcnJheS5pc0FycmF5KCByb3cubm90ZXMgKSA/IHJvdy5ub3RlcyA6IFtdICkuZm9yRWFjaCggZnVuY3Rpb24gKCBub3RlICkge1xuXHRcdFx0XHRcdGlmICggJ3N0cmluZycgPT09IHR5cGVvZiBub3RlIHx8ICdudW1iZXInID09PSB0eXBlb2Ygbm90ZSApIHtcblx0XHRcdFx0XHRcdG5vcm1hbGl6ZWRfbm90ZXMucHVzaCggU3RyaW5nKCBub3RlICkgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0aWYgKCBub3JtYWxpemVkX2ZpZWxkcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0bm9ybWFsaXplZF9yb3dzLnB1c2goIHtcblx0XHRcdFx0XHRcdGZpZWxkczogbm9ybWFsaXplZF9maWVsZHMsXG5cdFx0XHRcdFx0XHRpZDogTnVtYmVyKCByb3cuaWQgfHwgMCApLFxuXHRcdFx0XHRcdFx0bm90ZXM6IG5vcm1hbGl6ZWRfbm90ZXMsXG5cdFx0XHRcdFx0XHR0aXRsZTogU3RyaW5nKCByb3cudGl0bGUgfHwgJycgKVxuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRjaGFuZ2VkX2xhYmVsOiBTdHJpbmcoIHByZXNlbnRhdGlvbi5jaGFuZ2VkX2xhYmVsIHx8ICcnICksXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBTdHJpbmcoIHByZXNlbnRhdGlvbi5kZXNjcmlwdGlvbiB8fCAnJyApLFxuXHRcdFx0XHRmb3JtX2lkOiBTdHJpbmcoIHByZXNlbnRhdGlvbi5mb3JtX2lkIHx8ICcnICksXG5cdFx0XHRcdG1vZGU6IFN0cmluZyggcHJlc2VudGF0aW9uLm1vZGUgfHwgJ2lubGluZV9yZXZpZXcnICksXG5cdFx0XHRcdHBlbmRpbmdfbWVzc2FnZTogU3RyaW5nKCBwcmVzZW50YXRpb24ucGVuZGluZ19tZXNzYWdlIHx8ICcnICksXG5cdFx0XHRcdHJvd3M6IG5vcm1hbGl6ZWRfcm93cyxcblx0XHRcdFx0dGl0bGU6IFN0cmluZyggcHJlc2VudGF0aW9uLnRpdGxlIHx8ICcnICksXG5cdFx0XHRcdHdhcm5pbmc6IFN0cmluZyggcmV2aWV3Lndhcm5pbmcgfHwgcHJlc2VudGF0aW9uLndhcm5pbmcgfHwgJycgKVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBMb2NrIG9yIHVubG9jayByZXZpZXcgYWN0aW9ucyB3aGlsZSBhIGRvbWFpbiByZXF1ZXN0IGlzIGluIGZsaWdodC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZXZpZXdfc3RhdGUgQnVzeSBhbmQgYXBwbHktcmVhZHkgZmxhZ3MuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzeW5jaHJvbml6ZSggcmV2aWV3X3N0YXRlICkge1xuXHRcdFx0dmFyIGJ1c3k7XG5cdFx0XHR2YXIgY2FuX2FwcGx5O1xuXHRcdFx0dmFyIHJvb3QgPSBvcHRpb25zLnJvb3QgJiYgb3B0aW9ucy5yb290LnF1ZXJ5U2VsZWN0b3JBbGwgPyBvcHRpb25zLnJvb3QgOiBkb2N1bWVudDtcblxuXHRcdFx0cmV2aWV3X3N0YXRlID0gcmV2aWV3X3N0YXRlIHx8IHt9O1xuXHRcdFx0YnVzeSA9IHRydWUgPT09IHJldmlld19zdGF0ZS5idXN5O1xuXHRcdFx0Y2FuX2FwcGx5ID0gdHJ1ZSA9PT0gcmV2aWV3X3N0YXRlLmNhbl9hcHBseTtcblx0XHRcdHJvb3QucXVlcnlTZWxlY3RvckFsbCggb3B0aW9ucy5hcHBseV9zZWxlY3RvciApLmZvckVhY2goIGZ1bmN0aW9uICggY29udHJvbCApIHtcblx0XHRcdFx0Y29udHJvbC5kaXNhYmxlZCA9IGJ1c3kgfHwgISBjYW5fYXBwbHk7XG5cdFx0XHRcdGNvbnRyb2wuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWJ1c3knLCBidXN5ICk7XG5cdFx0XHRcdGNvbnRyb2wuc2V0QXR0cmlidXRlKCAnYXJpYS1idXN5JywgYnVzeSA/ICd0cnVlJyA6ICdmYWxzZScgKTtcblx0XHRcdH0gKTtcblx0XHRcdHJvb3QucXVlcnlTZWxlY3RvckFsbCggb3B0aW9ucy5jYW5jZWxfc2VsZWN0b3IgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGNvbnRyb2wgKSB7XG5cdFx0XHRcdGNvbnRyb2wuZGlzYWJsZWQgPSBidXN5O1xuXHRcdFx0fSApO1xuXHRcdFx0cm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWlubGluZS1yZXZpZXctZm9ybV0nICkuZm9yRWFjaCggZnVuY3Rpb24gKCBmb3JtICkge1xuXHRcdFx0XHRmb3JtLnNldEF0dHJpYnV0ZSggJ2FyaWEtYnVzeScsIGJ1c3kgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHByZXBhcmU6IHByZXBhcmUsXG5cdFx0XHRzeW5jaHJvbml6ZTogc3luY2hyb25pemVcblx0XHR9O1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZSBhIGRvbWFpbi1uZXV0cmFsIHBlcm1hbmVudC1kZWxldGlvbiByZXZpZXcgY29udHJvbGxlci5cblx0ICpcblx0ICogRG9tYWlucyByZW1haW4gcmVzcG9uc2libGUgZm9yIGRlY2lkaW5nIHdoZXRoZXIgZGVsZXRpb24gaXMgYWxsb3dlZCxcblx0ICogcHJvZHVjaW5nIHRoZSBzaWduZWQgaW1wYWN0IHJldmlldywgcmVuZGVyaW5nIHRoZWlyIGFsbG93LWxpc3RlZCB0ZW1wbGF0ZSxcblx0ICogYW5kIGFwcGx5aW5nIHRoZSBtdXRhdGlvbi4gVGhpcyBjb250cm9sbGVyIG93bnMgb25seSB0aGUgcmVwZWF0ZWQgYnJvd3NlclxuXHQgKiBtZWNoYW5pY3MgZm9yIGV4cGxpY2l0IGFja25vd2xlZGdlbWVudCwgZGVzdHJ1Y3RpdmUgZm9vdGVyIHByZXNlbnRhdGlvbixcblx0ICogYnVzeSBsb2NraW5nLCBhbmQgcmVkdWNlZC1tb3Rpb24tc2FmZSBhdHRlbnRpb24gZmVlZGJhY2suXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBzZXR0aW5ncyBET00gcm9vdHMgYW5kIGRvbWFpbiBzZWxlY3RvcnMuXG5cdCAqIEByZXR1cm4ge09iamVjdH0gRGVsZXRpb24tcmV2aWV3IHByZXNlbnRhdGlvbiBjb250cm9sbGVyLlxuXHQgKi9cblx0ZnVuY3Rpb24gY3JlYXRlX2RlbGV0ZV9yZXZpZXdfd29ya2Zsb3coIHNldHRpbmdzICkge1xuXHRcdHZhciBvcHRpb25zID0gT2JqZWN0LmFzc2lnbigge1xuXHRcdFx0YWNrbm93bGVkZ2VtZW50X3NlbGVjdG9yOiAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWRlbGV0ZS1hY2tub3dsZWRnZW1lbnRdJyxcblx0XHRcdGFwcGx5X3NlbGVjdG9yOiAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWRlbGV0ZS1hcHBseV0sIFtkYXRhLXdwYmMtdWktY2F0YWxvZy1pbnNwZWN0b3Itc2F2ZV0nLFxuXHRcdFx0Y2FuY2VsX3NlbGVjdG9yOiAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWRlbGV0ZS1jYW5jZWxdLCBbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5zcGVjdG9yLWNhbmNlbF0nLFxuXHRcdFx0cm9vdDogZG9jdW1lbnRcblx0XHR9LCBzZXR0aW5ncyB8fCB7fSApO1xuXHRcdHZhciByZXZpZXdfc3RhdGUgPSB7XG5cdFx0XHRidXN5OiBmYWxzZSxcblx0XHRcdGNhbl9hcHBseTogZmFsc2Vcblx0XHR9O1xuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBjb25maWd1cmVkIHF1ZXJ5IHJvb3QuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtEb2N1bWVudHxFbGVtZW50fSBRdWVyeS1jYXBhYmxlIHJvb3QuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3Jvb3QoKSB7XG5cdFx0XHRyZXR1cm4gb3B0aW9ucy5yb290ICYmIG9wdGlvbnMucm9vdC5xdWVyeVNlbGVjdG9yQWxsID8gb3B0aW9ucy5yb290IDogZG9jdW1lbnQ7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBhY3RpdmUgYWNrbm93bGVkZ2VtZW50IGNoZWNrYm94LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7SFRNTElucHV0RWxlbWVudHxudWxsfSBDaGVja2JveCBvciBudWxsIHdoZW4gdGhlIHJldmlldyBpcyBibG9ja2VkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9hY2tub3dsZWRnZW1lbnQoKSB7XG5cdFx0XHRyZXR1cm4gZ2V0X3Jvb3QoKS5xdWVyeVNlbGVjdG9yKCBvcHRpb25zLmFja25vd2xlZGdlbWVudF9zZWxlY3RvciApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc3RhcnQgdGhlIGZpbml0ZSBhY2tub3dsZWRnZW1lbnQgYXR0ZW50aW9uIGFuaW1hdGlvbi5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcHVsc2VfYWNrbm93bGVkZ2VtZW50KCkge1xuXHRcdFx0dmFyIGFja25vd2xlZGdlbWVudCA9IGdldF9hY2tub3dsZWRnZW1lbnQoKTtcblx0XHRcdHZhciBjb250YWluZXIgPSBhY2tub3dsZWRnZW1lbnQgPyBhY2tub3dsZWRnZW1lbnQuY2xvc2VzdCggJy53cGJjX3VpX2NhdGFsb2dfZGVsZXRlX3Jldmlld19fYWNrbm93bGVkZ2VtZW50JyApIDogbnVsbDtcblxuXHRcdFx0aWYgKCAhIGNvbnRhaW5lciApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoICdpcy1hdHRlbnRpb24nICk7XG5cdFx0XHR2b2lkIGNvbnRhaW5lci5vZmZzZXRXaWR0aDtcblx0XHRcdGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCAnaXMtYXR0ZW50aW9uJyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFN5bmNocm9uaXplIGRlc3RydWN0aXZlIHJldmlldyBhY3Rpb25zIHdpdGggc2VydmVyIGFuZCB1c2VyIHN0YXRlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IG5leHRfc3RhdGUgQnVzeSBhbmQgc2VydmVyLWF1dGhvcml0YXRpdmUgYXBwbHkgZmxhZ3MuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzeW5jaHJvbml6ZSggbmV4dF9zdGF0ZSApIHtcblx0XHRcdHZhciBhY2tub3dsZWRnZW1lbnQ7XG5cdFx0XHR2YXIgYWNrbm93bGVkZ2VkO1xuXHRcdFx0dmFyIHJvb3QgPSBnZXRfcm9vdCgpO1xuXG5cdFx0XHRuZXh0X3N0YXRlID0gbmV4dF9zdGF0ZSB8fCB7fTtcblx0XHRcdGlmICggJ2Jvb2xlYW4nID09PSB0eXBlb2YgbmV4dF9zdGF0ZS5idXN5ICkge1xuXHRcdFx0XHRyZXZpZXdfc3RhdGUuYnVzeSA9IG5leHRfc3RhdGUuYnVzeTtcblx0XHRcdH1cblx0XHRcdGlmICggJ2Jvb2xlYW4nID09PSB0eXBlb2YgbmV4dF9zdGF0ZS5jYW5fYXBwbHkgKSB7XG5cdFx0XHRcdHJldmlld19zdGF0ZS5jYW5fYXBwbHkgPSBuZXh0X3N0YXRlLmNhbl9hcHBseTtcblx0XHRcdH1cblx0XHRcdGFja25vd2xlZGdlbWVudCA9IGdldF9hY2tub3dsZWRnZW1lbnQoKTtcblx0XHRcdGFja25vd2xlZGdlZCA9ICEhIGFja25vd2xlZGdlbWVudCAmJiBhY2tub3dsZWRnZW1lbnQuY2hlY2tlZDtcblx0XHRcdHJvb3QucXVlcnlTZWxlY3RvckFsbCggb3B0aW9ucy5hcHBseV9zZWxlY3RvciApLmZvckVhY2goIGZ1bmN0aW9uICggY29udHJvbCApIHtcblx0XHRcdFx0Y29udHJvbC5kaXNhYmxlZCA9IHJldmlld19zdGF0ZS5idXN5IHx8ICEgcmV2aWV3X3N0YXRlLmNhbl9hcHBseSB8fCAhIGFja25vd2xlZGdlZDtcblx0XHRcdFx0Y29udHJvbC5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtYnVzeScsIHJldmlld19zdGF0ZS5idXN5ICk7XG5cdFx0XHRcdGNvbnRyb2wuc2V0QXR0cmlidXRlKCAnYXJpYS1idXN5JywgcmV2aWV3X3N0YXRlLmJ1c3kgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRyb290LnF1ZXJ5U2VsZWN0b3JBbGwoIG9wdGlvbnMuY2FuY2VsX3NlbGVjdG9yICkuZm9yRWFjaCggZnVuY3Rpb24gKCBjb250cm9sICkge1xuXHRcdFx0XHRjb250cm9sLmRpc2FibGVkID0gcmV2aWV3X3N0YXRlLmJ1c3k7XG5cdFx0XHR9ICk7XG5cdFx0XHRyb290LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctZGVsZXRlLXJldmlldy1mb3JtXScgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGZvcm0gKSB7XG5cdFx0XHRcdGZvcm0uc2V0QXR0cmlidXRlKCAnYXJpYS1idXN5JywgcmV2aWV3X3N0YXRlLmJ1c3kgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQXBwbHkgdGhlIHN0YW5kYXJkIGRlc3RydWN0aXZlIGZvb3RlciBjb250cmFjdCB0byBkb21haW4tb3duZWQgY29udHJvbHMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZm9vdGVyX3NldHRpbmdzIEZvb3RlciBlbGVtZW50LCBmb3JtIElELCBhbmQgbGFiZWwuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjb25maWd1cmVfZm9vdGVyKCBmb290ZXJfc2V0dGluZ3MgKSB7XG5cdFx0XHR2YXIgZm9vdGVyX29wdGlvbnMgPSBmb290ZXJfc2V0dGluZ3MgfHwge307XG5cdFx0XHR2YXIgZm9vdGVyID0gZm9vdGVyX29wdGlvbnMuZm9vdGVyICYmIGZvb3Rlcl9vcHRpb25zLmZvb3Rlci5xdWVyeVNlbGVjdG9yID8gZm9vdGVyX29wdGlvbnMuZm9vdGVyIDogbnVsbDtcblx0XHRcdHZhciBhcHBseV9idXR0b24gPSBmb290ZXIgPyBmb290ZXIucXVlcnlTZWxlY3Rvciggb3B0aW9ucy5hcHBseV9zZWxlY3RvciApIDogbnVsbDtcblxuXHRcdFx0aWYgKCAhIGFwcGx5X2J1dHRvbiApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0YXBwbHlfYnV0dG9uLmNsYXNzTGlzdC5yZW1vdmUoICdidXR0b24tcHJpbWFyeScsICdidXR0b24tbGluay1kZWxldGUnICk7XG5cdFx0XHRhcHBseV9idXR0b24uY2xhc3NMaXN0LmFkZCggJ2J1dHRvbi1zZWNvbmRhcnknLCAnd3BiY191aV9jYXRhbG9nX2RlbGV0ZV9yZXZpZXdfX2FwcGx5JyApO1xuXHRcdFx0YXBwbHlfYnV0dG9uLnRleHRDb250ZW50ID0gU3RyaW5nKCBmb290ZXJfb3B0aW9ucy5sYWJlbCB8fCAnJyApO1xuXHRcdFx0aWYgKCBmb290ZXJfb3B0aW9ucy5mb3JtX2lkICkge1xuXHRcdFx0XHRhcHBseV9idXR0b24uc2V0QXR0cmlidXRlKCAnZm9ybScsIFN0cmluZyggZm9vdGVyX29wdGlvbnMuZm9ybV9pZCApICk7XG5cdFx0XHR9XG5cdFx0XHRyZXZpZXdfc3RhdGUuY2FuX2FwcGx5ID0gdHJ1ZSA9PT0gZm9vdGVyX29wdGlvbnMuY2FuX2FwcGx5O1xuXHRcdFx0cmV2aWV3X3N0YXRlLmJ1c3kgPSBmYWxzZTtcblx0XHRcdHN5bmNocm9uaXplKCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSGFuZGxlIGEgZGVsZWdhdGVkIGFja25vd2xlZGdlbWVudCBjaGFuZ2UuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudCBCcm93c2VyIGNoYW5nZSBldmVudC5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIGV2ZW50IGJlbG9uZ2VkIHRvIHRoaXMgd29ya2Zsb3cuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX2NoYW5nZSggZXZlbnQgKSB7XG5cdFx0XHR2YXIgdGFyZ2V0ID0gZXZlbnQgJiYgZXZlbnQudGFyZ2V0O1xuXG5cdFx0XHRpZiAoICEgdGFyZ2V0IHx8ICEgdGFyZ2V0Lm1hdGNoZXMgfHwgISB0YXJnZXQubWF0Y2hlcyggb3B0aW9ucy5hY2tub3dsZWRnZW1lbnRfc2VsZWN0b3IgKSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0YXJnZXQuY2hlY2tlZCApIHtcblx0XHRcdFx0dmFyIGNvbnRhaW5lciA9IHRhcmdldC5jbG9zZXN0KCAnLndwYmNfdWlfY2F0YWxvZ19kZWxldGVfcmV2aWV3X19hY2tub3dsZWRnZW1lbnQnICk7XG5cdFx0XHRcdGlmICggY29udGFpbmVyICkge1xuXHRcdFx0XHRcdGNvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtYXR0ZW50aW9uJyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRwdWxzZV9hY2tub3dsZWRnZW1lbnQoKTtcblx0XHRcdH1cblx0XHRcdHN5bmNocm9uaXplKCk7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRjb25maWd1cmVfZm9vdGVyOiBjb25maWd1cmVfZm9vdGVyLFxuXHRcdFx0aGFuZGxlX2NoYW5nZTogaGFuZGxlX2NoYW5nZSxcblx0XHRcdHB1bHNlX2Fja25vd2xlZGdlbWVudDogcHVsc2VfYWNrbm93bGVkZ2VtZW50LFxuXHRcdFx0c3luY2hyb25pemU6IHN5bmNocm9uaXplXG5cdFx0fTtcblx0fVxuXG5cdC8qKlxuXHQgKiBNb3VudCBvbmUgcmVnaXN0ZXJlZCBjYXRhbG9nIGFuZCByZW5kZXIgaXRzIGluaXRpYWwgcmVzcG9uc2UuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgUmVnaXN0ZXJlZCBicm93c2VyIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEByZXR1cm4ge09iamVjdHxmYWxzZX0gQ2F0YWxvZyBjb250cm9sbGVyIG9yIGZhbHNlIHdoZW4gbW91bnRpbmcgZmFpbHMuXG5cdCAqL1xuXHRmdW5jdGlvbiBtb3VudF9jYXRhbG9nKCBjb25maWcgKSB7XG5cdFx0dmFyIGNhdGFsb2dfc3RhdGU7XG5cdFx0dmFyIGNhdGFsb2dfdGVtcGxhdGU7XG5cdFx0dmFyIGNvbnRlbnRfZWxlbWVudDtcblx0XHR2YXIgaW5pdGlhbF9zZXF1ZW5jZTtcblx0XHR2YXIgbW91bnRfZWxlbWVudDtcblxuXHRcdGlmICggISBjb25maWcgfHwgISBjb25maWcuaWQgfHwgISBjb25maWcubW91bnRfaWQgfHwgISBjb25maWcudGVtcGxhdGVzIHx8ICEgY29uZmlnLnRlbXBsYXRlcy5jYXRhbG9nIHx8ICEgY29uZmlnLnRlbXBsYXRlcy5zaGVsbCApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25maWcuY2F0YWxvZ19pZCA9IGNvbmZpZy5pZDtcblx0XHRtb3VudF9lbGVtZW50ICAgICA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBjb25maWcubW91bnRfaWQgKTtcblx0XHRjYXRhbG9nX3RlbXBsYXRlICA9IGxvYWRfdGVtcGxhdGUoIGNvbmZpZywgJ2NhdGFsb2cnICk7XG5cblx0XHRpZiAoICEgbW91bnRfZWxlbWVudCB8fCAhIGNhdGFsb2dfdGVtcGxhdGUgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0bW91bnRfZWxlbWVudC5pbm5lckhUTUwgPSBjYXRhbG9nX3RlbXBsYXRlKCBPYmplY3QuYXNzaWduKCB7fSwgY29uZmlnLCB7IGNhdGFsb2dfaWQ6IGNvbmZpZy5jYXRhbG9nX2lkIH0gKSApO1xuXHRcdGNvbnRlbnRfZWxlbWVudCA9IG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1jb250ZW50XScgKTtcblx0XHRpZiAoICEgY29udGVudF9lbGVtZW50ICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoIGNvbmZpZy5pMThuICYmIGNvbmZpZy5pMThuLmNhdGFsb2dfbGFiZWwgKSB7XG5cdFx0XHRjb250ZW50X2VsZW1lbnQucGFyZW50Tm9kZS5zZXRBdHRyaWJ1dGUoICdhcmlhLWxhYmVsJywgY29uZmlnLmkxOG4uY2F0YWxvZ19sYWJlbCApO1xuXHRcdH1cblxuXHRcdGNhdGFsb2dfc3RhdGUgICAgICAgICAgICAgICAgID0gZ2V0X2NhdGFsb2dfc3RhdGUoIGNvbmZpZy5jYXRhbG9nX2lkICk7XG5cdFx0Y2F0YWxvZ19zdGF0ZS5jb25maWcgICAgICAgICAgPSBjb25maWc7XG5cdFx0Y2F0YWxvZ19zdGF0ZS5jb250ZW50X2VsZW1lbnQgPSBjb250ZW50X2VsZW1lbnQ7XG5cdFx0Y2F0YWxvZ19zdGF0ZS5yZXNwb25zZV9lbGVtZW50ID0gY29udGVudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctcmVzcG9uc2VdJyApIHx8IGNvbnRlbnRfZWxlbWVudDtcblx0XHRjYXRhbG9nX3N0YXRlLmxvYWRpbmdfZWxlbWVudCA9IGNvbnRlbnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWxvYWRpbmddJyApO1xuXHRcdGNhdGFsb2dfc3RhdGUubGF0ZXN0X3NlcXVlbmNlID0gMDtcblx0XHRjYXRhbG9nX3N0YXRlLnJlcXVlc3RfdmFsdWVzID0gT2JqZWN0LmFzc2lnbigge30sIGNvbmZpZy5pbml0aWFsX3JlcXVlc3QgfHwge30gKTtcblx0XHRiaW5kX2NhdGFsb2dfY29udHJvbHMoIGNvbmZpZywgbW91bnRfZWxlbWVudCApO1xuXHRcdGlmICggd2luZG93LndwYmNfdWlfY2F0YWxvZ19hY3Rpb25zICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY191aV9jYXRhbG9nX2FjdGlvbnMuaW5pdGlhbGl6ZSApIHtcblx0XHRcdGNhdGFsb2dfc3RhdGUuYWN0aW9uc19jb250cm9sbGVyID0gd2luZG93LndwYmNfdWlfY2F0YWxvZ19hY3Rpb25zLmluaXRpYWxpemUoIG1vdW50X2VsZW1lbnQsIGNvbmZpZyApO1xuXHRcdH1cblx0XHRpZiAoXG5cdFx0XHRjb25maWcuZmVhdHVyZXNcblx0XHRcdCYmIGNvbmZpZy5mZWF0dXJlcy5oaWVyYXJjaHlcblx0XHRcdCYmIHdpbmRvdy53cGJjX3VpX2NhdGFsb2dfaGllcmFyY2h5XG5cdFx0XHQmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfdWlfY2F0YWxvZ19oaWVyYXJjaHkuaW5pdGlhbGl6ZVxuXHRcdCkge1xuXHRcdFx0Y2F0YWxvZ19zdGF0ZS5oaWVyYXJjaHlfY29udHJvbGxlciA9IHdpbmRvdy53cGJjX3VpX2NhdGFsb2dfaGllcmFyY2h5LmluaXRpYWxpemUoIG1vdW50X2VsZW1lbnQsIGNvbmZpZywgZnVuY3Rpb24gKCBoaWVyYXJjaHlfc3RhdGUgKSB7XG5cdFx0XHRcdHZhciBoaWVyYXJjaHlfY29uZmlndXJhdGlvbiA9IGNvbmZpZy5oaWVyYXJjaHkgfHwge307XG5cdFx0XHRcdHZhciBwcmVmZXJlbmNlX2tleSA9IFN0cmluZyggaGllcmFyY2h5X2NvbmZpZ3VyYXRpb24ucHJlZmVyZW5jZV9rZXkgfHwgJycgKTtcblx0XHRcdFx0dmFyIHByZWZlcmVuY2VfdmFsdWVzID0ge307XG5cblx0XHRcdFx0aWYgKCAnZ2xvYmFsJyAhPT0gaGllcmFyY2h5X2NvbmZpZ3VyYXRpb24ucGVyc2lzdGVuY2UgfHwgISBwcmVmZXJlbmNlX2tleSApIHtcblx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCBmYWxzZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHByZWZlcmVuY2VfdmFsdWVzWyBwcmVmZXJlbmNlX2tleSBdID0gSlNPTi5zdHJpbmdpZnkoIGhpZXJhcmNoeV9zdGF0ZSB8fCB7fSApO1xuXG5cdFx0XHRcdHJldHVybiBzYXZlX2NhdGFsb2dfcHJlZmVyZW5jZXMoIGNvbmZpZywgcHJlZmVyZW5jZV92YWx1ZXMgKTtcblx0XHRcdH0gKTtcblx0XHR9XG5cdFx0aWYgKFxuXHRcdFx0Y29uZmlnLmZlYXR1cmVzXG5cdFx0XHQmJiBjb25maWcuZmVhdHVyZXMuc2VsZWN0aW9uXG5cdFx0XHQmJiB3aW5kb3cud3BiY191aV9jYXRhbG9nX3NlbGVjdGlvblxuXHRcdFx0JiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX3VpX2NhdGFsb2dfc2VsZWN0aW9uLmluaXRpYWxpemVcblx0XHQpIHtcblx0XHRcdGNhdGFsb2dfc3RhdGUuc2VsZWN0aW9uX2NvbnRyb2xsZXIgPSB3aW5kb3cud3BiY191aV9jYXRhbG9nX3NlbGVjdGlvbi5pbml0aWFsaXplKCBtb3VudF9lbGVtZW50LCBjb25maWcgKTtcblx0XHR9XG5cblx0XHRpZiAoICEgc2V0X2NhdGFsb2dfbG9hZGluZ19zdGF0ZSggY29uZmlnLCB0cnVlICkgKSB7XG5cdFx0XHRyZW5kZXJfdGVtcGxhdGUoIGNvbmZpZywgJ3NoZWxsJywge1xuXHRcdFx0XHRjYXRhbG9nX2lkOiBjb25maWcuY2F0YWxvZ19pZCxcblx0XHRcdFx0YXJpYV9sYWJlbDogY29uZmlnLmkxOG4gJiYgY29uZmlnLmkxOG4uY2F0YWxvZ19sYWJlbCA/IGNvbmZpZy5pMThuLmNhdGFsb2dfbGFiZWwgOiAnJyxcblx0XHRcdFx0bG9hZGluZ19tZXNzYWdlOiBjb25maWcuaTE4biAmJiBjb25maWcuaTE4bi5sb2FkaW5nID8gY29uZmlnLmkxOG4ubG9hZGluZyA6ICcnXG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0aWYgKCBjb25maWcuYXV0b19sb2FkICkge1xuXHRcdFx0cmVxdWVzdF9jYXRhbG9nKCBjb25maWcsIGNvbmZpZy5pbml0aWFsX3JlcXVlc3QgfHwge30gKTtcblx0XHRcdGluaXRpYWxfc2VxdWVuY2UgPSBjYXRhbG9nX3N0YXRlLmxhdGVzdF9zZXF1ZW5jZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aW5pdGlhbF9zZXF1ZW5jZSA9IG5leHRfcmVxdWVzdF9zZXF1ZW5jZSggY29uZmlnLmNhdGFsb2dfaWQgKTtcblx0XHRcdGlmICggY29uZmlnLmluaXRpYWxfcmVzcG9uc2UgKSB7XG5cdFx0XHRcdHJlbmRlcl9yZXNwb25zZSggY29uZmlnLCBjb25maWcuaW5pdGlhbF9yZXNwb25zZSwgaW5pdGlhbF9zZXF1ZW5jZSApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRjYXRhbG9nX2lkOiBjb25maWcuY2F0YWxvZ19pZCxcblx0XHRcdGNsZWFyX3NlbGVjdGlvbjogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRpZiAoIGNhdGFsb2dfc3RhdGUuc2VsZWN0aW9uX2NvbnRyb2xsZXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNhdGFsb2dfc3RhdGUuc2VsZWN0aW9uX2NvbnRyb2xsZXIuY2xlYXIgKSB7XG5cdFx0XHRcdFx0Y2F0YWxvZ19zdGF0ZS5zZWxlY3Rpb25fY29udHJvbGxlci5jbGVhcigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0Z2V0X3NlbGVjdGVkX2lkczogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gY2F0YWxvZ19zdGF0ZS5zZWxlY3Rpb25fY29udHJvbGxlciAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgY2F0YWxvZ19zdGF0ZS5zZWxlY3Rpb25fY29udHJvbGxlci5nZXRfc2VsZWN0ZWRfaWRzXG5cdFx0XHRcdFx0PyBjYXRhbG9nX3N0YXRlLnNlbGVjdGlvbl9jb250cm9sbGVyLmdldF9zZWxlY3RlZF9pZHMoKVxuXHRcdFx0XHRcdDogW107XG5cdFx0XHR9LFxuXHRcdFx0Z2V0X2hpZXJhcmNoeV9jb250cm9sbGVyOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBjYXRhbG9nX3N0YXRlLmhpZXJhcmNoeV9jb250cm9sbGVyIHx8IGZhbHNlO1xuXHRcdFx0fSxcblx0XHRcdHNlcXVlbmNlOiBpbml0aWFsX3NlcXVlbmNlLFxuXHRcdFx0bG9hZDogZnVuY3Rpb24gKCByZXF1ZXN0X3ZhbHVlcyApIHtcblx0XHRcdFx0cmV0dXJuIHJlcXVlc3RfY2F0YWxvZyggY29uZmlnLCByZXF1ZXN0X3ZhbHVlcyB8fCB7fSApO1xuXHRcdFx0fSxcblx0XHRcdHNhdmVfcHJlZmVyZW5jZXM6IGZ1bmN0aW9uICggcHJlZmVyZW5jZV92YWx1ZXMgKSB7XG5cdFx0XHRcdHJldHVybiBzYXZlX2NhdGFsb2dfcHJlZmVyZW5jZXMoIGNvbmZpZywgcHJlZmVyZW5jZV92YWx1ZXMgfHwge30gKTtcblx0XHRcdH0sXG5cdFx0XHRyZWZyZXNoX2NvbnRyb2xzOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJlZnJlc2hfY2F0YWxvZ19jb250cm9scyggY29uZmlnICk7XG5cdFx0XHR9LFxuXHRcdFx0c3luY190YWJsZV9taW5fd2lkdGg6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0c3luY19jYXRhbG9nX3RhYmxlX21pbl93aWR0aCggY29uZmlnICk7XG5cdFx0XHR9LFxuXHRcdFx0bmV4dF9zZXF1ZW5jZTogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gbmV4dF9yZXF1ZXN0X3NlcXVlbmNlKCBjb25maWcuY2F0YWxvZ19pZCApO1xuXHRcdFx0fSxcblx0XHRcdHJlbmRlcl9yZXNwb25zZTogZnVuY3Rpb24gKCByZXNwb25zZSwgcmVxdWVzdF9zZXF1ZW5jZSApIHtcblx0XHRcdFx0cmV0dXJuIHJlbmRlcl9yZXNwb25zZSggY29uZmlnLCByZXNwb25zZSwgcmVxdWVzdF9zZXF1ZW5jZSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHR3aW5kb3cud3BiY191aV9jYXRhbG9nID0gd2luZG93LndwYmNfdWlfY2F0YWxvZyB8fCB7fTtcblx0d2luZG93LndwYmNfdWlfY2F0YWxvZy5jcmVhdGVfaW5zcGVjdG9yX3dvcmtmbG93ID0gY3JlYXRlX2luc3BlY3Rvcl93b3JrZmxvdztcblx0d2luZG93LndwYmNfdWlfY2F0YWxvZy5jcmVhdGVfaW5saW5lX2VkaXRpbmdfd29ya2Zsb3cgPSBjcmVhdGVfaW5saW5lX2VkaXRpbmdfd29ya2Zsb3c7XG5cdHdpbmRvdy53cGJjX3VpX2NhdGFsb2cuY3JlYXRlX2lubGluZV9yZXZpZXdfd29ya2Zsb3cgPSBjcmVhdGVfaW5saW5lX3Jldmlld193b3JrZmxvdztcblx0d2luZG93LndwYmNfdWlfY2F0YWxvZy5jcmVhdGVfZGVsZXRlX3Jldmlld193b3JrZmxvdyA9IGNyZWF0ZV9kZWxldGVfcmV2aWV3X3dvcmtmbG93O1xuXHR3aW5kb3cud3BiY191aV9jYXRhbG9nLmlzX3N0YWxlX3Jlc3BvbnNlID0gaXNfc3RhbGVfcmVzcG9uc2U7XG5cdHdpbmRvdy53cGJjX3VpX2NhdGFsb2cubG9hZF90ZW1wbGF0ZSA9IGxvYWRfdGVtcGxhdGU7XG5cdHdpbmRvdy53cGJjX3VpX2NhdGFsb2cubW91bnQgPSBtb3VudF9jYXRhbG9nO1xuXHR3aW5kb3cud3BiY191aV9jYXRhbG9nLm5leHRfcmVxdWVzdF9zZXF1ZW5jZSA9IG5leHRfcmVxdWVzdF9zZXF1ZW5jZTtcblx0d2luZG93LndwYmNfdWlfY2F0YWxvZy5yZW5kZXJfcmVzcG9uc2UgPSByZW5kZXJfcmVzcG9uc2U7XG5cdHdpbmRvdy53cGJjX3VpX2NhdGFsb2cucmVxdWVzdCA9IHJlcXVlc3RfY2F0YWxvZztcblx0d2luZG93LndwYmNfdWlfY2F0YWxvZy5zeW5jX3RhYmxlX21pbl93aWR0aCA9IHN5bmNfY2F0YWxvZ190YWJsZV9taW5fd2lkdGg7XG5cdHdpbmRvdy53cGJjX3VpX2NhdGFsb2cuc3luY2hyb25pemVfb3ZlcmZsb3dfdG9vbHRpcHMgPSBzeW5jaHJvbml6ZV9vdmVyZmxvd190b29sdGlwcztcblx0d2luZG93LndwYmNfdWlfY2F0YWxvZy52YWxpZGF0ZV9yZXNwb25zZSA9IHZhbGlkYXRlX3Jlc3BvbnNlO1xufSggd2luZG93LCBkb2N1bWVudCApICk7XG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0UsV0FBV0EsTUFBTSxFQUFFQyxRQUFRLEVBQUc7RUFDL0IsWUFBWTs7RUFFWixJQUFJQyxjQUFjLEdBQUcsQ0FBQyxDQUFDOztFQUV2QjtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTQyxrQkFBa0JBLENBQUVDLFFBQVEsRUFBRztJQUN2QyxJQUFJQyxtQkFBbUI7SUFFdkIsSUFBSyxRQUFRLEtBQUssT0FBT0QsUUFBUSxJQUFJRSxRQUFRLENBQUVGLFFBQVMsQ0FBQyxJQUFJRyxJQUFJLENBQUNDLEtBQUssQ0FBRUosUUFBUyxDQUFDLEtBQUtBLFFBQVEsRUFBRztNQUNsR0MsbUJBQW1CLEdBQUdELFFBQVE7SUFDL0IsQ0FBQyxNQUFNLElBQUssUUFBUSxLQUFLLE9BQU9BLFFBQVEsSUFBSSxPQUFPLENBQUNLLElBQUksQ0FBRUwsUUFBUyxDQUFDLEVBQUc7TUFDdEVDLG1CQUFtQixHQUFHSyxRQUFRLENBQUVOLFFBQVEsRUFBRSxFQUFHLENBQUM7SUFDL0MsQ0FBQyxNQUFNO01BQ04sT0FBTyxJQUFJO0lBQ1o7SUFFQSxPQUFPLENBQUMsSUFBSUMsbUJBQW1CLEdBQUdBLG1CQUFtQixHQUFHLElBQUk7RUFDN0Q7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU00sd0JBQXdC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
