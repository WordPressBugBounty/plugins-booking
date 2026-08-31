"use strict";

/**
 * Render normalized Booking Resource DTOs through identifiable WP templates.
 *
 * @since 11.6.0
 */
(function (window, document) {
  'use strict';

  var catalog_controller = null;
  var inline_workflow_controller = null;
  var inline_review_workflow_controller = null;
  var delete_review_workflow_controller = null;
  var inspector_workflow_controller = null;
  var catalog_response = null;
  var details_abort_controller = null;
  var details_request_sequence = 0;
  var details_resource_id = 0;
  var details_toggle_button = null;
  var pending_focus_direction = '';
  var inspector_dirty = false;
  var inspector_focus_target = null;
  var inspector_mode = '';
  var inspector_mutation_in_progress = false;
  var inspector_mutation_request_sequence = 0;
  var inspector_original_fields = '';
  var inspector_request_sequence = 0;
  var inspector_resource_id = 0;
  var inspector_resource_ids = [];
  var inspector_bulk_operations = {};
  var inspector_review_token = '';
  var inspector_selection_stale = false;
  var inspector_tracks_selection = false;
  var inspector_capacity_context = null;
  var inspector_capacity_detach_ids = [];
  var inspector_capacity_decrease_action = 'detach';
  var inspector_capacity_target = 0;
  var pending_highlight_ids = [];
  var inline_state = {
    active: false,
    changed_rows: [],
    loading: false,
    request_sequence: 0,
    review_token: ''
  };

  /**
   * Normalize a localized WordPress flag to a strict boolean.
   *
   * @param {*} flag_value Localized flag value.
   * @return {boolean} True only for an explicitly enabled flag.
   */
  function is_true_flag(flag_value) {
    return true === flag_value || 1 === flag_value || '1' === flag_value || 'true' === String(flag_value).toLowerCase();
  }

  /**
   * Format a localized positional-placeholder string.
   *
   * @param {string} template Localized string containing `%1$s` placeholders.
   * @param {Array<*>} values Scalar replacement values.
   * @return {string} Formatted plain text.
   */
  function format_message(template, values) {
    var message = String(template || '');
    values.forEach(function (replacement, replacement_index) {
      var placeholder = new RegExp('%' + (replacement_index + 1) + '\\$s', 'g');
      message = message.replace(placeholder, String(replacement));
    });
    return message;
  }

  /**
   * Return the shared signed-review presentation controller.
   *
   * @return {Object|false} Shared review controller or false when unavailable.
   */
  function get_inline_review_workflow() {
    if (inline_review_workflow_controller) {
      return inline_review_workflow_controller;
    }
    if (!window.wpbc_ui_catalog || 'function' !== typeof window.wpbc_ui_catalog.create_inline_review_workflow) {
      return false;
    }
    inline_review_workflow_controller = window.wpbc_ui_catalog.create_inline_review_workflow({
      apply_selector: '[data-wpbc-ui-catalog-inspector-save]',
      cancel_selector: '[data-wpbc-ui-catalog-inspector-cancel]',
      root: document
    });
    return inline_review_workflow_controller;
  }

  /**
   * Return the shared permanent-deletion presentation controller.
   *
   * @return {Object|false} Shared deletion controller or false when unavailable.
   */
  function get_delete_review_workflow() {
    if (delete_review_workflow_controller) {
      return delete_review_workflow_controller;
    }
    if (!window.wpbc_ui_catalog || 'function' !== typeof window.wpbc_ui_catalog.create_delete_review_workflow) {
      return false;
    }
    delete_review_workflow_controller = window.wpbc_ui_catalog.create_delete_review_workflow({
      acknowledgement_selector: '[data-wpbc-catalog-resource-delete-acknowledgement]',
      apply_selector: '[data-wpbc-ui-catalog-inspector-save]',
      cancel_selector: '[data-wpbc-ui-catalog-inspector-cancel]',
      root: document
    });
    return delete_review_workflow_controller;
  }

  /**
   * Return the localized count shown in a collapsed child-group summary.
   *
   * The DTO label remains authoritative because PHP applies WordPress locale
   * plural rules. The numeric fallback consumes the shared direct-child count
   * when an older or custom domain DTO does not include the prepared label.
   *
   * @param {Object} parent_resource Parent Booking Resource DTO.
   * @param {Object} i18n            Localized catalog strings.
   * @return {string} Localized child-count label.
   */
  function get_children_summary_label(parent_resource, i18n) {
    var hierarchy = parent_resource && parent_resource.hierarchy ? parent_resource.hierarchy : {};
    var server_label = String(hierarchy.children_label || '').trim();
    var child_count = Math.max(0, Number(hierarchy.rendered_children_count) || 0);
    var label_template;
    if (server_label) {
      return server_label;
    }
    label_template = 1 === child_count ? i18n.child_count_singular || '%1$s child resource' : i18n.child_count_plural || '%1$s child resources';
    return format_message(label_template, [child_count]);
  }

  /**
   * Render one allow-listed Resource presentation template.
   *
   * @param {Object} config        Registered catalog configuration.
   * @param {string} template_role Registered template role.
   * @param {Object} template_data Normalized DTO or presentation data.
   * @return {string} Escaped template HTML or an empty string.
   */
  function render_component(config, template_role, template_data) {
    var component_template = window.wpbc_ui_catalog.load_template(config, template_role);
    if (!component_template) {
      return '';
    }
    try {
      return component_template(template_data || {});
    } catch (error) {
      return '';
    }
  }

  /**
   * Return complete column presentation records in the active order.
   *
   * @param {Object} config         Registered catalog configuration.
   * @param {Object} display_state  Normalized display request or response.
   * @param {boolean} visible_only  Whether hidden columns must be omitted.
   * @param {Object} sorting_state  Normalized sorting response.
   * @return {Array<Object>} Ordered presentation-only column records.
   */
  function get_columns(config, display_state, visible_only, sorting_state) {
    var column_config = config.columns || {};
    var definitions = column_config.definitions || {};
    var default_order = Array.isArray(column_config.default_order) ? column_config.default_order : [];
    var order = display_state && Array.isArray(display_state.column_order) ? display_state.column_order.slice() : default_order.slice();
    var visible_columns = display_state && Array.isArray(display_state.visible_columns) ? display_state.visible_columns : column_config.default_visible || [];
    default_order.forEach(function (column_id) {
      if (-1 === order.indexOf(column_id)) {
        order.push(column_id);
      }
    });
    return order.filter(function (column_id) {
      return definitions[column_id] && (!visible_only || -1 !== visible_columns.indexOf(column_id));
    }).map(function (column_id, column_index) {
      var definition = definitions[column_id];
      var is_sorted = !!definition.sort_key && sorting_state && definition.sort_key === sorting_state.sort_by;
      return {
        aria_sort: is_sorted ? 'desc' === sorting_state.sort_order ? 'descending' : 'ascending' : 'none',
        class_name: definition.class || 'column-' + column_id,
        default_index: default_order.indexOf(column_id),
        id: column_id,
        is_sorted: is_sorted,
        label: definition.label || column_id,
        move_label: format_message(config.i18n.move_column || '', [definition.label || column_id]),
        reorderable: false !== definition.reorderable,
        required: !!definition.required,
        sort_icon: is_sorted ? 'desc' === sorting_state.sort_order ? 'wpbc-bi-arrow-down' : 'wpbc-bi-arrow-up' : 'wpbc_icn_import_export',
        sort_key: definition.sort_key || '',
        visible: -1 !== visible_columns.indexOf(column_id)
      };
    });
  }

  /**
   * Determine whether display values match the Overview defaults.
   *
   * @param {Object} config        Registered catalog configuration.
   * @param {Object} display_state Current normalized display state.
   * @return {string} overview or custom.
   */
  function get_active_view(config, display_state) {
    var view_definitions = config.views && config.views.definitions ? config.views.definitions : {};
    var current_visible = display_state && Array.isArray(display_state.visible_columns) ? display_state.visible_columns : [];
    var matching_view = '';
    Object.keys(view_definitions).some(function (view_id) {
      var view_fields = Array.isArray(view_definitions[view_id].fields) ? view_definitions[view_id].fields : [];
      if (JSON.stringify(current_visible) === JSON.stringify(view_fields)) {
        matching_view = view_id;
        return true;
      }
      return false;
    });
    return matching_view || 'custom';
  }

  /**
   * Return ordered view presets declared by the independent PHP configuration.
   *
   * @param {Object} config Registered catalog configuration.
   * @return {Array<Object>} Browser-safe view definitions.
   */
  function get_view_definitions(config) {
    var definitions = config.views && config.views.definitions ? config.views.definitions : {};
    return Object.keys(definitions).map(function (view_id) {
      return definitions[view_id];
    });
  }

  /**
   * Return the allow-listed presentation packs declared by PHP.
   *
   * Labels remain domain-owned while the shared controller validates and
   * persists only pack identifiers registered in the catalog configuration.
   *
   * @param {Object} config Registered catalog configuration.
   * @return {Array<Object>} Ordered browser-safe pack options.
   */
  function get_template_pack_definitions(config) {
    var labels = {
      cards: config.i18n.layout_cards || '',
      compact: config.i18n.layout_compact || '',
      table: config.i18n.layout_table || ''
    };
    var template_packs = config.template_packs || {};
    return Object.keys(template_packs).map(function (template_pack_id) {
      return {
        id: template_pack_id,
        label: labels[template_pack_id] || template_pack_id
      };
    });
  }

  /**
   * Render the established Resource filters above the bordered listing.
   *
   * Free editions intentionally render no filter form, matching the existing
   * page where a single default Resource makes these controls unnecessary.
   *
   * @param {Object} config Registered catalog configuration.
   * @return {boolean} True when the filters target was found.
   */
  function render_booking_resources_filters(config) {
    var initial_request = config.initial_request || {};
    var mount_element = document.getElementById(config.mount_id);
    var filters_target = mount_element ? mount_element.querySelector('[data-wpbc-booking-resources-filters]') : null;
    if (!filters_target) {
      return false;
    }
    filters_target.innerHTML = render_component(config, 'filters', {
      i18n: config.i18n || {},
      resource_type: initial_request.resource_type || 'all',
      search: initial_request.search || '',
      show_filters: !!(config.features && config.features.resource_filters),
      show_resource_type_filter: !!(config.features && config.features.resource_type_filter)
    });
    return true;
  }

  /**
   * Render persistent filters and display controls outside response content.
   *
   * @param {Object} config Registered catalog configuration.
   * @return {boolean} True when the toolbar target was populated.
   */
  function render_booking_resources_toolbar(config) {
    var initial_request = config.initial_request || {};
    var mount_element = document.getElementById(config.mount_id);
    var toolbar_target = mount_element ? mount_element.querySelector('[data-wpbc-booking-resources-toolbar]') : null;
    if (!toolbar_target) {
      return false;
    }
    toolbar_target.innerHTML = render_component(config, 'toolbar', {
      active_template_pack: initial_request.template_pack || config.default_template_pack || 'table',
      active_view: get_active_view(config, initial_request),
      columns: get_columns(config, initial_request, false, initial_request),
      i18n: config.i18n || {},
      template_packs: get_template_pack_definitions(config),
      views: get_view_definitions(config)
    });
    if (catalog_controller && 'function' === typeof catalog_controller.refresh_controls) {
      catalog_controller.refresh_controls();
    }
    return !!toolbar_target.firstElementChild;
  }

  /**
   * Add full-text tooltips only to elements whose rendered text is clipped.
   *
   * Native title text remains available without a JavaScript tooltip library;
   * the established tooltip attributes are also supplied for Booking Calendar
   * admin themes that initialize them globally.
   *
   * @param {HTMLElement} catalog_mount Catalog mount element.
   * @return {void}
   */
  function synchronize_overflow_tooltips(catalog_mount) {
    if (!window.wpbc_ui_catalog || 'function' !== typeof window.wpbc_ui_catalog.synchronize_overflow_tooltips) {
      return;
    }
    window.wpbc_ui_catalog.synchronize_overflow_tooltips(catalog_mount);
  }

  /**
   * Initialize tooltips for compact controls inserted by a lazy details render.
   *
   * The native title remains as a fallback when the established Booking
   * Calendar tooltip helper is unavailable.
   *
   * @param {HTMLElement} catalog_mount Catalog mount element.
   * @return {void}
   */
  function initialize_details_tooltips(catalog_mount) {
    var tooltip_selector;
    if (!catalog_mount || !catalog_mount.id || 'function' !== typeof window.wpbc_define_tippy_tooltips) {
      return;
    }
    tooltip_selector = '#' + catalog_mount.id + ' [data-wpbc-ui-catalog-details-tooltip]';
    window.wpbc_define_tippy_tooltips(tooltip_selector);
  }

  /**
   * Synchronize persistent controls with server-authoritative response state.
   *
   * @param {Object} config   Registered catalog configuration.
   * @param {Object} response Normalized catalog response.
   * @return {void}
   */
  function synchronize_booking_resources_toolbar(config, response) {
    var columns = get_columns(config, response.display || {}, false, response.sorting || {});
    var mount_element = document.getElementById(config.mount_id);
    var column_list = mount_element ? mount_element.querySelector('[data-wpbc-ui-catalog-column-list]') : null;
    var search_control = mount_element ? mount_element.querySelector('[data-wpbc-ui-catalog-search]') : null;
    var template_pack_control = mount_element ? mount_element.querySelector('[data-wpbc-ui-catalog-template-pack]') : null;
    var type_control = mount_element ? mount_element.querySelector('[data-wpbc-ui-catalog-filter="resource_type"]') : null;
    var view_control = mount_element ? mount_element.querySelector('[data-wpbc-ui-catalog-view]') : null;
    if (search_control && document.activeElement !== search_control) {
      search_control.value = response.filters.search || '';
    }
    if (type_control) {
      type_control.value = response.filters.resource_type || 'all';
    }
    if (template_pack_control && response.display && response.display.template_pack) {
      template_pack_control.value = response.display.template_pack;
    }
    columns.forEach(function (column) {
      var column_control = mount_element.querySelector('[data-wpbc-ui-catalog-column-visible][value="' + column.id + '"]');
      var column_item = mount_element.querySelector('[data-wpbc-ui-catalog-column-item="' + column.id + '"]');
      if (column_control) {
        column_control.checked = column.visible;
      }
      if (column_list && column_item) {
        column_list.appendChild(column_item);
      }
    });
    if (view_control) {
      view_control.value = get_active_view(config, response.display || {});
    }
  }

  /**
   * Render the persistent inline-edit status bar from its registered template.
   *
   * @param {Object} config Catalog configuration.
   * @return {void}
   */
  function render_inline_bar(config) {
    var mount_element = document.getElementById(config.mount_id);
    var inline_host = mount_element ? mount_element.querySelector('[data-wpbc-catalog-inline-bar-host]') : null;
    if (inline_host && !inline_host.firstElementChild) {
      inline_host.innerHTML = render_component(config, 'inline_bar', {
        i18n: config.i18n || {}
      });
    }
    if (inline_workflow_controller) {
      inline_workflow_controller.register_sticky_bar();
    }
  }

  /**
   * Synchronize inline activation, changed count, and disabled navigation.
   *
   * @param {Object} config Catalog configuration.
   * @return {void}
   */
  function synchronize_inline_controls(config) {
    var mount_element = document.getElementById(config.mount_id);
    var changed_count = inline_state.changed_rows.length;
    var count_label = 1 === changed_count ? config.i18n.inline_changed_row : config.i18n.inline_changed_rows;
    if (!mount_element || !inline_workflow_controller) {
      return;
    }
    inline_workflow_controller.synchronize({
      active: inline_state.active,
      active_toggle_text: config.i18n.inline_editing_rows || '',
      busy: inline_state.loading,
      changed_count: changed_count,
      count_text: inline_state.loading ? config.i18n.inline_loading || '' : format_message(count_label || '%1$s changed rows', [changed_count]),
      has_items: !!mount_element.querySelector('[data-wpbc-booking-resource-id]'),
      inactive_toggle_text: config.i18n.edit_rows || ''
    });
  }

  /**
   * Block page-changing catalog controls before shared handlers can discard drafts.
   *
   * Native summary elements do not honor a disabled property, so this capture
   * guard complements the visual disabled state while inline editing is active.
   *
   * @param {Event} event Captured catalog event.
   * @return {void}
   */
  function protect_inline_drafts_from_catalog_controls(event) {
    if (inline_workflow_controller) {
      inline_workflow_controller.protect_event(event, inline_state.active);
    }
  }

  /**
   * Show or clear an inline workflow error.
   *
   * @param {Object} config Catalog configuration.
   * @param {string} message Safe message or empty string.
   * @return {void}
   */
  function show_inline_message(config, message) {
    var mount_element = document.getElementById(config.mount_id);
    var notice = mount_element ? mount_element.querySelector('[data-wpbc-catalog-inline-message]') : null;
    if (notice) {
      notice.hidden = !message;
      var text = notice.querySelector('p');
      if (text) {
        text.textContent = message || '';
      }
    }
  }

  /**
   * Render one server-declared field through the inline WP template.
   *
   * @param {Object} config Catalog configuration.
   * @param {Object} row_schema Row schema.
   * @return {void}
   */
  function render_inline_row(config, row_schema) {
    var mount_element = document.getElementById(config.mount_id);
    var resource_id = Number(row_schema.resource_id) || 0;
    var row = mount_element ? mount_element.querySelector('[data-wpbc-booking-resource-id="' + resource_id + '"]') : null;
    var resource_fields = [];
    if (!row) {
      return;
    }
    (row_schema.fields || []).forEach(function (field) {
      var cell = row.querySelector('[data-wpbc-ui-catalog-field="' + String(field.column || '') + '"]');
      if (!cell || cell.hidden) {
        return;
      }
      if ('resource' === field.column) {
        resource_fields.push(field);
        return;
      }
      cell.innerHTML = render_component(config, 'inline_field', {
        field: field,
        resource_id: resource_id
      });
    });
    if (resource_fields.length) {
      var copy = row.querySelector('[data-wpbc-ui-catalog-field="resource"] .wpbc_ui_listing__item_copy');
      if (copy) {
        var wrapper = document.createElement('span');
        wrapper.className = 'wpbc_booking_resources__inline_identity_fields';
        resource_fields.forEach(function (field) {
          wrapper.insertAdjacentHTML('beforeend', render_component(config, 'inline_field', {
            field: field,
            resource_id: resource_id
          }));
        });
        copy.replaceWith(wrapper);
      }
    }
  }

  /**
   * Collect only changed row fields while preserving visible catalog order.
   *
   * @param {Object} config Catalog configuration.
   * @return {Array<Object>} Changed row envelopes.
   */
  function collect_inline_drafts(config) {
    var mount_element = document.getElementById(config.mount_id);
    var changed_rows = [];
    if (!mount_element) {
      return changed_rows;
    }
    mount_element.querySelectorAll('.wpbc_booking_resources__item[data-wpbc-booking-resource-id]').forEach(function (row) {
      var fields = {};
      var has_changes;
      var indicator_host;
      row.querySelectorAll('[data-wpbc-catalog-inline-field]').forEach(function (control) {
        var field_key = control.getAttribute('data-wpbc-catalog-inline-field') || '';
        if (field_key && String(control.value || '') !== String(control.getAttribute('data-wpbc-catalog-inline-original') || '')) {
          fields[field_key] = control.value;
        }
      });
      has_changes = 0 < Object.keys(fields).length;
      indicator_host = row.querySelector('[data-wpbc-ui-catalog-field="resource"]');
      row.classList.toggle('is-inline-dirty', has_changes);
      if (inline_workflow_controller) {
        inline_workflow_controller.set_row_changed(row, has_changes, indicator_host, config.i18n.inline_changed || '');
      }
      if (has_changes) {
        changed_rows.push({
          resource_id: Number(row.getAttribute('data-wpbc-booking-resource-id')),
          fields: fields
        });
      }
    });
    return changed_rows;
  }

  /**
   * Invalidate a prior review and synchronize draft state.
   *
   * @param {Object} config Catalog configuration.
   * @return {void}
   */
  function synchronize_inline_drafts(config) {
    inline_state.changed_rows = collect_inline_drafts(config);
    inline_state.review_token = '';
    show_inline_message(config, '');
    synchronize_inline_controls(config);
  }

  /**
   * Exit inline mode and optionally reload canonical rows.
   *
   * @param {Object} config Catalog configuration.
   * @param {boolean} reload Whether to reload the catalog.
   * @param {string} message Optional success message.
   * @return {void}
   */
  function leave_inline_mode(config, reload, message) {
    inline_state.request_sequence += 1;
    inline_state.active = false;
    inline_state.loading = false;
    inline_state.changed_rows = [];
    inline_state.review_token = '';
    if ('inline_review' === inspector_mode) {
      close_inspector(config, false);
    }
    synchronize_inline_controls(config);
    if (message) {
      show_admin_message(message, 'success', 4000);
    }
    if (reload && catalog_controller) {
      catalog_controller.load();
    }
  }

  /**
   * Start row editing for the current visible Resource page.
   *
   * @param {Object} config Catalog configuration.
   * @return {void}
   */
  function start_inline_mode(config) {
    var mount_element = document.getElementById(config.mount_id);
    var resource_ids = [];
    var request_sequence;
    if (inline_state.active) {
      synchronize_inline_drafts(config);
      if (!inline_state.changed_rows.length || window.confirm(config.i18n.inline_discard || '')) {
        leave_inline_mode(config, true, '');
      }
      return;
    }
    mount_element.querySelectorAll('.wpbc_booking_resources__item[data-wpbc-booking-resource-id]').forEach(function (row) {
      resource_ids.push(Number(row.getAttribute('data-wpbc-booking-resource-id')));
    });
    if (!resource_ids.length) {
      return;
    }
    if (!can_discard_inspector(config)) {
      return;
    }
    close_inspector(config, false);
    mount_element.querySelectorAll('[data-wpbc-ui-catalog-display-customizer][open]').forEach(function (customizer) {
      customizer.removeAttribute('open');
    });
    inline_state.active = true;
    inline_state.loading = true;
    inline_state.changed_rows = [];
    request_sequence = ++inline_state.request_sequence;
    close_details_row(false);
    synchronize_inline_controls(config);
    request_inspector(config, config.inline_schema_action, {
      resource_ids: JSON.stringify(resource_ids)
    }).then(function (response) {
      if (request_sequence !== inline_state.request_sequence || !inline_state.active || !response || !response.success || !response.data || !response.data.schema) {
        throw new Error(get_inspector_response_message(response, config.i18n.inline_load_failed));
      }
      (response.data.schema.rows || []).forEach(function (row_schema) {
        render_inline_row(config, row_schema);
      });
      var first_field = mount_element.querySelector('[data-wpbc-catalog-inline-field]');
      if (first_field) {
        first_field.focus();
      }
    }).catch(function (error) {
      if (request_sequence === inline_state.request_sequence) {
        show_admin_message(error.message || config.i18n.inline_load_failed || '', 'error', 5000);
        inline_state.active = false;
        if (catalog_controller) {
          catalog_controller.load();
        }
      }
    }).then(function () {
      if (request_sequence === inline_state.request_sequence) {
        inline_state.loading = false;
        synchronize_inline_controls(config);
      }
    });
  }

  /**
   * Preview current inline drafts and open their signed review inspector.
   *
   * @param {Object} config Catalog configuration.
   * @param {HTMLElement} focus_target Review trigger for focus restoration.
   * @return {void}
   */
  function preview_inline_changes(config, focus_target) {
    var inspector_workflow;
    var request_sequence;
    synchronize_inline_drafts(config);
    inspector_workflow = get_inspector_workflow(config);
    if (!inline_state.changed_rows.length || inline_state.loading || !inspector_workflow || !inspector_workflow.mount()) {
      return;
    }
    inline_state.loading = true;
    request_sequence = ++inline_state.request_sequence;
    inspector_focus_target = focus_target;
    inspector_mode = 'inline_review';
    inspector_dirty = true;
    if (!inspector_workflow.open_loading()) {
      inline_state.loading = false;
      return;
    }
    synchronize_inline_controls(config);
    request_inspector(config, config.inline_preview_action, {
      rows: JSON.stringify(inline_state.changed_rows)
    }).then(function (response) {
      var review_workflow;
      var review_model;
      var target;
      if (request_sequence !== inline_state.request_sequence) {
        return;
      }
      if (!response || !response.success || !response.data || !response.data.preview) {
        throw new Error(get_inspector_response_message(response, config.i18n.inline_review_failed));
      }
      inline_state.review_token = String(response.data.preview.review_token || '');
      target = get_inspector_host().querySelector('[data-wpbc-ui-catalog-inspector-form]');
      review_workflow = get_inline_review_workflow();
      review_model = review_workflow ? review_workflow.prepare(response.data.preview.review || {}, {
        changed_label: format_message(1 === inline_state.changed_rows.length ? config.i18n.inline_changed_row : config.i18n.inline_changed_rows, [inline_state.changed_rows.length]),
        description: config.i18n.inline_review_description || '',
        form_id: 'wpbc_catalog_booking_resources_inline_review_form',
        mode: 'inline_review',
        pending_message: config.i18n.review_changes_help || '',
        title: config.i18n.inline_review_title || ''
      }) : {};
      target.innerHTML = render_component(config, 'inspector_inline_review', review_model);
      set_inspector_state('form', '');
      configure_inspector_footer('wpbc_catalog_booking_resources_inline_review_form', config.i18n.apply_changes || '', false, !inline_state.review_token);
      if (review_workflow) {
        review_workflow.synchronize({
          busy: false,
          can_apply: !!inline_state.review_token
        });
      }
      focus_inspector_heading(target.querySelector('[data-wpbc-catalog-inline-review-form]'));
    }).catch(function (error) {
      if (request_sequence !== inline_state.request_sequence) {
        return;
      }
      inline_state.review_token = '';
      inspector_dirty = false;
      show_admin_message(error.message || config.i18n.inline_review_failed || '', 'error', 5000);
      close_inspector(config, false);
    }).then(function () {
      if (request_sequence === inline_state.request_sequence) {
        inline_state.loading = false;
        synchronize_inline_controls(config);
      }
    });
  }

  /**
   * Apply the reviewed inline plan and retain the catalog selection.
   *
   * @param {SubmitEvent} event Review form submit event.
   * @param {Object} config Catalog configuration.
   * @return {void}
   */
  function apply_inline_changes(event, config) {
    var form = event.target;
    var save_button = document.querySelector('[data-wpbc-ui-catalog-inspector-save]');
    var request_sequence;
    event.preventDefault();
    if (inline_state.loading || !inline_state.review_token || save_button && save_button.disabled) {
      return;
    }
    inline_state.loading = true;
    inspector_mutation_in_progress = true;
    if (get_inline_review_workflow()) {
      get_inline_review_workflow().synchronize({
        busy: true,
        can_apply: true
      });
    }
    request_sequence = ++inspector_mutation_request_sequence;
    if (save_button) {
      save_button.disabled = true;
      save_button.classList.add('is-busy');
    }
    request_inspector(config, config.inline_apply_action, {
      rows: JSON.stringify(inline_state.changed_rows),
      review_token: inline_state.review_token
    }).then(function (response) {
      if (request_sequence !== inspector_mutation_request_sequence || !response || !response.success || !response.data) {
        throw new Error(get_inspector_response_message(response, config.i18n.inline_apply_failed));
      }
      pending_highlight_ids = (response.data.updated_ids || []).map(String);
      inspector_mutation_in_progress = false;
      leave_inline_mode(config, true, get_inspector_response_message(response, ''));
    }).catch(function (error) {
      inspector_mutation_in_progress = false;
      inline_state.review_token = '';
      if (get_inline_review_workflow()) {
        get_inline_review_workflow().synchronize({
          busy: false,
          can_apply: false
        });
      }
      if (document.documentElement.contains(form)) {
        show_inspector_message(form, error.message || config.i18n.inline_apply_failed || '', true);
      } else {
        show_admin_message(error.message || config.i18n.inline_apply_failed || '', 'error', 5000);
      }
      if (save_button) {
        save_button.disabled = true;
        save_button.classList.remove('is-busy');
      }
    }).then(function () {
      inline_state.loading = false;
      synchronize_inline_controls(config);
    });
  }

  /**
   * Render the header, complete Resource rows, partials, and pagination.
   *
   * @param {Object} config   Registered catalog configuration.
   * @param {Object} response Normalized catalog response.
   * @return {boolean} True when every required presentation target exists.
   */
  function render_booking_resources_response(config, response) {
    var catalog_heading;
    var catalog_mount = document.getElementById(config.mount_id);
    var card_groups = {};
    var children_by_parent = {};
    var columns;
    var header_element;
    var hierarchy_enabled;
    var hierarchy_is_expanded;
    var is_cards_pack;
    var parent_resources = {};
    var pagination;
    var pagination_element;
    var rows_element;
    if (!catalog_mount || !response || !Array.isArray(response.items)) {
      return false;
    }
    header_element = catalog_mount.querySelector('[data-wpbc-booking-resources-header]');
    rows_element = catalog_mount.querySelector('[data-wpbc-booking-resources-rows]');
    pagination_element = catalog_mount.querySelector('[data-wpbc-booking-resources-pagination]');
    if (!header_element || !rows_element || !pagination_element) {
      return false;
    }
    columns = get_columns(config, response.display || {}, true, response.sorting || {});
    is_cards_pack = 'cards' === String(response.display && response.display.template_pack || '');
    hierarchy_enabled = !!(response.hierarchy && response.hierarchy.enabled);
    hierarchy_is_expanded = hierarchy_enabled && window.wpbc_ui_catalog_hierarchy && 'function' === typeof window.wpbc_ui_catalog_hierarchy.get_initial_expanded && window.wpbc_ui_catalog_hierarchy.get_initial_expanded(response.hierarchy || {});
    header_element.innerHTML = render_component(config, 'header', {
      all_expanded: hierarchy_is_expanded,
      columns: columns,
      hierarchy_enabled: hierarchy_enabled,
      i18n: config.i18n || {},
      selection_enabled: !!(config.features && config.features.selection)
    });
    rows_element.innerHTML = '';
    if (hierarchy_enabled) {
      response.items.forEach(function (resource) {
        if (resource.hierarchy && 'parent' === resource.hierarchy.type) {
          parent_resources[String(resource.id)] = resource;
        } else if (resource.hierarchy && 'child' === resource.hierarchy.type) {
          var parent_id = String(resource.hierarchy.parent_id || '');
          children_by_parent[parent_id] = children_by_parent[parent_id] || [];
          children_by_parent[parent_id].push(resource);
        }
      });
    }
    response.items.forEach(function (resource) {
      var action_target;
      var classic_label_classes = {
        child: 'wpbc_label_resource_child',
        cost: 'wpbc_label_cost',
        'default-form': 'wpbc_label_resource_default_form',
        owner: 'wpbc_label_user_owner',
        parent: 'wpbc_label_resource_parent',
        single: 'wpbc_label_resource_single'
      };
      var label_target;
      var price_target;
      var description = resource.description || config.i18n.no_description || '';
      var hierarchy = Object.assign({}, resource.hierarchy || {});
      var parent_context_label = '';
      var row_variant = hierarchy_enabled && ('parent' === hierarchy.type || 'child' === hierarchy.type) ? hierarchy.type : 'single';
      var row_template_role = 'parent' === row_variant ? 'parent_row' : 'child' === row_variant ? 'child_row' : 'row';
      var type_badge_label = config.i18n.independent_label || '';
      hierarchy.expandable = !!(hierarchy_enabled && hierarchy.expandable);
      if (hierarchy.parent_title) {
        parent_context_label = format_message(config.i18n.child_of || '', [hierarchy.parent_title]);
      }
      if ('parent' === row_variant) {
        var rendered_child_count = Math.max(0, Number(hierarchy.rendered_children_count) || 0);
        var parent_children_template = 1 === rendered_child_count ? config.i18n.parent_child_label || '%1$s · %2$s child' : config.i18n.parent_children_label || '%1$s · %2$s children';
        type_badge_label = format_message(parent_children_template, [config.i18n.parent_label || '', rendered_child_count]);
      } else if ('child' === row_variant) {
        type_badge_label = config.i18n.child_label || '';
      }
      var resource_row_data = Object.assign({}, resource, {
        parent_context_label: parent_context_label,
        collapse_label: format_message(config.i18n.collapse_children_for || config.i18n.collapse_children || '', [resource.title || '']),
        columns: columns,
        expand_label: format_message(config.i18n.expand_children_for || config.i18n.expand_children || '', [resource.title || '']),
        hierarchy: hierarchy,
        i18n: config.i18n || {},
        is_expanded: hierarchy_is_expanded,
        parent_label: config.i18n.parent_label || '',
        row_variant: row_variant,
        selection_label: format_message(config.i18n.select_resource || '', [resource.title || '']),
        selection_enabled: !!(config.features && config.features.selection),
        thumbnail_label: format_message(config.i18n.thumbnail_tooltip || '', [resource.title || '', description]),
        type_badge_label: type_badge_label
      });
      var resource_row_html = render_component(config, row_template_role, resource_row_data);
      var resource_row;
      if (!resource_row_html) {
        return;
      }
      if (is_cards_pack && 'parent' === row_variant) {
        var child_resources = children_by_parent[String(resource.id)] || [];
        var child_count = Math.max(child_resources.length, Number(hierarchy.rendered_children_count) || 0);
        var card_group_html = render_component(config, 'card_group', {
          children_description: format_message(config.i18n.children_belong_to || '', [resource.title || '']),
          children_heading: format_message(config.i18n.children_of_count || '', [resource.title || '', child_count]),
          collapse_label: resource_row_data.collapse_label,
          expand_label: resource_row_data.expand_label,
          is_expanded: hierarchy_is_expanded,
          parent_id: resource.id,
          parent_node_id: hierarchy.node_id,
          stack_items: child_resources.slice(0, 3)
        });
        if (!card_group_html) {
          return;
        }
        rows_element.insertAdjacentHTML('beforeend', card_group_html);
        card_groups[String(resource.id)] = rows_element.lastElementChild;
        var parent_slot = card_groups[String(resource.id)].querySelector('[data-wpbc-booking-resource-card-parent-slot]');
        parent_slot.insertAdjacentHTML('beforeend', resource_row_html);
        resource_row = parent_slot.lastElementChild;
      } else if (is_cards_pack && 'child' === row_variant && card_groups[String(hierarchy.parent_id)]) {
        var children_slot = card_groups[String(hierarchy.parent_id)].querySelector('[data-wpbc-booking-resource-card-children-slot]');
        children_slot.insertAdjacentHTML('beforeend', resource_row_html);
        resource_row = children_slot.lastElementChild;
      } else {
        rows_element.insertAdjacentHTML('beforeend', resource_row_html);
        resource_row = rows_element.lastElementChild;
      }
      if (!resource_row) {
        return;
      }
      label_target = resource_row.querySelector('[data-wpbc-booking-resource-labels]');
      price_target = resource_row.querySelector('[data-wpbc-booking-resource-price]');
      action_target = resource_row.querySelector('[data-wpbc-booking-resource-actions]');
      if (label_target) {
        label_target.innerHTML = render_component(config, 'labels', {
          aria_label: config.i18n.column_labels || '',
          empty_label: config.i18n.no_labels || '',
          labels: Array.isArray(resource.labels) ? resource.labels.map(function (label) {
            return Object.assign({}, label, {
              class_name: classic_label_classes[label.kind] || ''
            });
          }) : []
        });
      }
      if (price_target) {
        price_target.innerHTML = render_component(config, 'price', {
          empty_label: config.i18n.price_unavailable || '',
          price: resource.price || {}
        });
      }
      if (action_target) {
        action_target.innerHTML = render_component(config, 'action_menu', {
          actions: Array.isArray(resource.action_items) ? resource.action_items.map(function (action) {
            var action_classes = {
              adjust_capacity: 'capacity',
              delete_resource: 'delete',
              edit_resource: 'edit',
              publish_resource: 'publish'
            };
            var action_id = String(action.id || '');
            return Object.assign({}, action, {
              class_name: 'wpbc_booking_resources__action_' + (action_classes[action_id] || action_id)
            });
          }) : [],
          aria_label: format_message(config.i18n.actions_for || '', [resource.title || '']),
          empty_label: config.i18n.no_actions || '',
          menu_id: 'wpbc_' + config.id + '_actions_' + String(resource.id),
          resource_id: resource.id
        });
      }
      if (hierarchy_enabled && 'child' === row_variant && hierarchy.is_last_sibling) {
        var parent_resource = parent_resources[String(hierarchy.parent_id)];
        if (parent_resource) {
          var summary_target = is_cards_pack && card_groups[String(hierarchy.parent_id)] ? card_groups[String(hierarchy.parent_id)].querySelector('[data-wpbc-booking-resource-card-parent-slot]') : rows_element;
          summary_target.insertAdjacentHTML('beforeend', render_component(config, 'child_summary', {
            children_label: get_children_summary_label(parent_resource, config.i18n || {}),
            collapse_label: format_message(config.i18n.collapse_children_for || config.i18n.collapse_children || '', [parent_resource.title || '']),
            columns: columns,
            expand_label: format_message(config.i18n.expand_children_for || config.i18n.expand_children || '', [parent_resource.title || '']),
            is_expanded: hierarchy_is_expanded,
            parent_id: hierarchy.parent_id,
            parent_node_id: parent_resource.hierarchy.node_id,
            selection_enabled: !!(config.features && config.features.selection)
          }));
        }
      }
    });
    synchronize_overflow_tooltips(catalog_mount);
    pagination = response.pagination || {};
    pagination_element.innerHTML = render_component(config, 'pagination', {
      aria_label: config.i18n.pagination_label || '',
      has_next: Number(pagination.page_number) < Number(pagination.total_pages),
      has_previous: 1 < Number(pagination.page_number),
      items_per_page: Number(pagination.items_per_page),
      items_per_page_options: config.items_per_page && Array.isArray(config.items_per_page.options) ? config.items_per_page.options : [],
      next_label: config.i18n.next_page || '',
      next_page: Math.min(Number(pagination.total_pages), Number(pagination.page_number) + 1),
      page_number: Number(pagination.page_number),
      page_number_label: config.i18n.page_number || '',
      per_page_label: config.i18n.per_page || '',
      previous_label: config.i18n.previous_page || '',
      previous_page: Math.max(1, Number(pagination.page_number) - 1),
      results_status: format_message(config.i18n.results_status || '', [pagination.items_from, pagination.items_to, pagination.total_items]),
      show_label: config.i18n.show || '',
      total_pages: Math.max(1, Number(pagination.total_pages))
    });
    synchronize_booking_resources_toolbar(config, response);
    if (pending_focus_direction) {
      catalog_heading = catalog_mount.querySelector('[data-wpbc-catalog-heading]');
      pending_focus_direction = '';
      if (catalog_heading && 'function' === typeof catalog_heading.focus) {
        catalog_heading.focus();
      }
    }
    return rows_element.querySelectorAll('[data-wpbc-ui-catalog-selectable-row][data-wpbc-booking-resource-id]').length === response.items.length;
  }

  /**
   * Return the number of currently visible cells in one Resource row.
   *
   * @param {HTMLElement} resource_row Rendered Resource table row.
   * @return {number} Safe details-row colspan.
   */
  function get_details_colspan(resource_row) {
    var visible_cells = 0;
    if (resource_row && 'TR' === resource_row.tagName) {
      Array.prototype.forEach.call(resource_row.cells || [], function (cell) {
        if (!cell.hidden && 'none' !== window.getComputedStyle(cell).display) {
          visible_cells += 1;
        }
      });
    }
    return Math.max(1, visible_cells);
  }

  /**
   * Resolve the rendered Resource container that owns an interactive control.
   *
   * Resource controls repeat the Resource ID for event dispatch. Limiting this
   * lookup to selectable row/card containers prevents lazy templates from being
   * inserted beside the control itself.
   *
   * @param {Element|null} source_element Element inside a Resource row or card.
   * @return {HTMLElement|null} Owning Resource row/card, or null when unavailable.
   */
  function get_resource_item_container(source_element) {
    if (!source_element || 'function' !== typeof source_element.closest) {
      return null;
    }
    return source_element.closest('[data-wpbc-ui-catalog-selectable-row][data-wpbc-booking-resource-id]');
  }

  /**
   * Synchronize Cards-pack parent stages with shared hierarchy visibility.
   *
   * Child cards remain normal shared hierarchy nodes. This adapter only mirrors
   * their computed visibility onto the presentation-only tray wrapper.
   *
   * @param {HTMLElement} catalog_mount Mounted Booking Resources catalog.
   * @return {void}
   */
  function synchronize_card_group_panels(catalog_mount) {
    var catalog_root;
    if (!catalog_mount) {
      return;
    }
    catalog_root = catalog_mount.hasAttribute('data-wpbc-catalog-id') ? catalog_mount : catalog_mount.querySelector('[data-wpbc-catalog-id]');

    // The shared controller owns the active-pack attribute on the inner catalog root.
    if (!catalog_root || 'cards' !== catalog_root.getAttribute('data-wpbc-template-pack')) {
      return;
    }
    catalog_root.querySelectorAll('[data-wpbc-booking-resource-card-group]').forEach(function (card_group) {
      var children_panel = card_group.querySelector('[data-wpbc-booking-resource-card-children-panel]');
      var visible_child = card_group.querySelector('[data-wpbc-booking-resource-card-children-slot] [data-wpbc-ui-catalog-parent-node-id]:not([hidden])');
      if (children_panel) {
        children_panel.hidden = !visible_child;
        card_group.classList.toggle('is-expanded', !!visible_child);
      }
    });
  }

  /**
   * Synchronize one details disclosure button.
   *
   * @param {HTMLElement|null} toggle_button Disclosure button.
   * @param {boolean}          is_expanded   Whether its details row is open.
   * @return {void}
   */
  function set_details_toggle_state(toggle_button, is_expanded) {
    var icon;
    var label;
    if (!toggle_button) {
      return;
    }
    label = toggle_button.getAttribute(is_expanded ? 'data-hide-label' : 'data-show-label') || '';
    toggle_button.setAttribute('aria-expanded', is_expanded ? 'true' : 'false');
    toggle_button.setAttribute('aria-label', label);
    toggle_button.setAttribute('title', label);
    icon = toggle_button.querySelector('span[aria-hidden="true"]');
    if (icon) {
      icon.className = is_expanded ? 'wpbc-bi-chevron-up' : 'wpbc-bi-chevron-down';
    }
  }

  /**
   * Close the active details row and cancel its lazy request.
   *
   * @param {boolean} restore_focus Whether to return focus to the disclosure.
   * @return {void}
   */
  function close_details_row(restore_focus) {
    var active_row = document.querySelector('[data-wpbc-booking-resource-details-row]');
    var focus_target = details_toggle_button;
    details_request_sequence += 1;
    if (details_abort_controller && 'function' === typeof details_abort_controller.abort) {
      details_abort_controller.abort();
    }
    details_abort_controller = null;
    if (active_row && active_row.parentNode) {
      active_row.parentNode.removeChild(active_row);
    }
    set_details_toggle_state(details_toggle_button, false);
    if (details_toggle_button) {
      var source_row = get_resource_item_container(details_toggle_button);
      if (source_row) {
        source_row.classList.remove('is-details-expanded');
      }
    }
    details_resource_id = 0;
    details_toggle_button = null;
    if (restore_focus && focus_target && document.documentElement.contains(focus_target) && 'function' === typeof focus_target.focus) {
      focus_target.focus();
    }
  }

  /**
   * Replace the active details row through the registered WP template.
   *
   * @param {Object}      config       Catalog configuration.
   * @param {HTMLElement} resource_row Source Resource row.
   * @param {Object}      template_data Presentation-only template state.
   * @return {HTMLElement|null} Rendered details row.
   */
  function render_details_row(config, resource_row, template_data) {
    var active_row = document.querySelector('[data-wpbc-booking-resource-details-row]');
    var card_group = resource_row ? resource_row.closest('[data-wpbc-booking-resource-card-group]') : null;
    var details_html = render_component(config, 'details', template_data);
    var insertion_target = card_group || resource_row;
    if (!details_html || !insertion_target || !insertion_target.parentNode) {
      return null;
    }
    if (active_row && active_row.parentNode) {
      active_row.parentNode.removeChild(active_row);
    }
    insertion_target.insertAdjacentHTML('afterend', details_html);
    return insertion_target.nextElementSibling;
  }

  /**
   * Return a safe message from a normalized details error response.
   *
   * @param {Object} response Normalized endpoint response.
   * @param {string} fallback Localized fallback message.
   * @return {string} Safe plain-text message.
   */
  function get_details_error_message(response, fallback) {
    return response && response.error && response.error.message ? String(response.error.message) : String(fallback || '');
  }

  /**
   * Open one details row and lazily request its authorized DTO.
   *
   * @param {Object}      config        Catalog configuration.
   * @param {HTMLElement} toggle_button Details disclosure button.
   * @param {HTMLElement} resource_row  Source Resource row.
   * @param {number}      resource_id   Booking Resource ID.
   * @return {void}
   */
  function open_details_row(config, toggle_button, resource_row, resource_id) {
    var details_request_id;
    var request_body;
    var resource_title_element = resource_row.querySelector('.wpbc_ui_listing__item_title');
    var resource_title = resource_title_element ? resource_title_element.textContent.trim() : '';
    var template_base;
    close_details_row(false);
    details_resource_id = resource_id;
    details_toggle_button = toggle_button;
    details_request_id = ++details_request_sequence;
    set_details_toggle_state(toggle_button, true);
    resource_row.classList.add('is-details-expanded');
    template_base = {
      colspan: get_details_colspan(resource_row),
      resource_id: resource_id,
      title: resource_title
    };
    render_details_row(config, resource_row, Object.assign({}, template_base, {
      loading_label: config.i18n.details_loading || config.i18n.loading || '',
      state: 'loading'
    }));
    request_body = new window.URLSearchParams();
    request_body.append('action', config.details_action);
    request_body.append('nonce', config.nonce || '');
    request_body.append('request_id', String(details_request_id));
    request_body.append('resource_id', String(resource_id));
    details_abort_controller = 'function' === typeof window.AbortController ? new window.AbortController() : null;
    window.fetch(config.ajax_url, {
      body: request_body.toString(),
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      method: 'POST',
      signal: details_abort_controller ? details_abort_controller.signal : undefined
    }).then(function (response) {
      return response.json();
    }).then(function (response) {
      if (details_request_id !== details_request_sequence || resource_id !== details_resource_id) {
        return;
      }
      if (!response || true !== response.success || Number(response.request_id) !== details_request_id || Number(response.resource_id) !== resource_id || !response.details || !Array.isArray(response.details.sections)) {
        render_details_row(config, resource_row, Object.assign({}, template_base, {
          error_message: get_details_error_message(response, config.i18n.details_load_failed),
          state: 'error'
        }));
        return;
      }
      render_details_row(config, resource_row, Object.assign({}, template_base, response.details, {
        colspan: get_details_colspan(resource_row),
        state: 'ready'
      }));
      var catalog_mount = document.getElementById(config.mount_id);
      synchronize_overflow_tooltips(catalog_mount);
      initialize_details_tooltips(catalog_mount);
    }).catch(function (error) {
      if (error && 'AbortError' === error.name) {
        return;
      }
      if (details_request_id === details_request_sequence && resource_id === details_resource_id) {
        render_details_row(config, resource_row, Object.assign({}, template_base, {
          error_message: config.i18n.details_load_failed || '',
          state: 'error'
        }));
      }
    }).then(function () {
      if (details_request_id === details_request_sequence) {
        details_abort_controller = null;
      }
    });
  }

  /**
   * Copy one details value without navigating or mutating Resource state.
   *
   * @param {string}      copy_value    Plain text to copy.
   * @param {HTMLElement} action_button Copy button used to locate status text.
   * @param {Object}      config        Catalog configuration.
   * @return {void}
   */
  function copy_details_value(copy_value, action_button, config) {
    var details_row = action_button.closest('[data-wpbc-booking-resource-details-row]');
    var resource_id = Number(action_button.getAttribute('data-wpbc-booking-resource-id') || 0);
    var status_element = details_row ? details_row.querySelector('[data-wpbc-booking-resource-copy-status]') : document.querySelector('[data-wpbc-booking-resource-copy-status="' + String(resource_id) + '"]');
    var copy_promise;
    if (window.navigator.clipboard && 'function' === typeof window.navigator.clipboard.writeText) {
      copy_promise = window.navigator.clipboard.writeText(copy_value);
    } else {
      copy_promise = new window.Promise(function (resolve, reject) {
        var copy_input = document.createElement('textarea');
        copy_input.value = copy_value;
        copy_input.setAttribute('readonly', 'readonly');
        copy_input.style.position = 'fixed';
        copy_input.style.opacity = '0';
        document.body.appendChild(copy_input);
        copy_input.select();
        if (document.execCommand('copy')) {
          resolve();
        } else {
          reject();
        }
        document.body.removeChild(copy_input);
      });
    }
    copy_promise.then(function () {
      if (status_element) {
        status_element.classList.remove('has-error');
        status_element.textContent = config.i18n.shortcode_copied || '';
      }
    }).catch(function () {
      if (status_element) {
        status_element.classList.add('has-error');
        status_element.textContent = config.i18n.shortcode_copy_failed || '';
      }
    });
  }

  /**
   * Return the current effective shortcode for one Resource.
   *
   * The active inspector wins so unsaved customizer changes are used by Copy
   * and Publish. A hidden compatibility input is the fallback required by the
   * shared Booking Calendar publish wizard.
   *
   * @param {number}      resource_id  Booking Resource ID.
   * @param {HTMLElement} action_button Optional initiating action.
   * @return {string} Current effective shortcode.
   */
  function get_booking_resource_shortcode(resource_id, action_button) {
    var inspector_shortcode = resource_id === inspector_resource_id ? document.querySelector('[data-wpbc-catalog-resource-inspector-form] .wpbc_catalog_booking_resources__editor_code') : null;
    var hidden_shortcode = document.getElementById('booking_resource_shortcode_' + String(resource_id));
    if (inspector_shortcode) {
      return String(inspector_shortcode.value || '');
    }
    if (action_button && action_button.getAttribute('data-wpbc-booking-resource-shortcode')) {
      return String(action_button.getAttribute('data-wpbc-booking-resource-shortcode') || '');
    }
    return hidden_shortcode ? String(hidden_shortcode.value || '') : '';
  }

  /**
   * Create or update the hidden input consumed by the shared publish wizard.
   *
   * @param {number} resource_id Booking Resource ID.
   * @param {string} shortcode   Effective Booking shortcode.
   * @return {HTMLInputElement|null} Compatibility input or null.
   */
  function synchronize_booking_resource_shortcode_input(resource_id, shortcode) {
    var input;
    if (!resource_id) {
      return null;
    }
    input = document.getElementById('booking_resource_shortcode_' + String(resource_id));
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.id = 'booking_resource_shortcode_' + String(resource_id);
      input.setAttribute('data-wpbc-catalog-shortcode-compatibility', String(resource_id));
      document.body.appendChild(input);
    }
    input.value = String(shortcode || '');
    return input;
  }

  /**
   * Open the shared Booking Calendar shortcode customizer for one Resource.
   *
   * @param {number} resource_id Booking Resource ID.
   * @param {string} shortcode   Current shortcode.
   * @return {void}
   */
  function customize_booking_resource_shortcode(resource_id, shortcode) {
    synchronize_booking_resource_shortcode_input(resource_id, shortcode);
    if ('function' === typeof window.wpbc_resource_page_btn_click) {
      window.wpbc_resource_page_btn_click(resource_id, shortcode);
    }
  }

  /**
   * Open the shared Booking Calendar embed/create-page wizard.
   *
   * @param {number} resource_id Booking Resource ID.
   * @param {string} shortcode   Current shortcode.
   * @return {void}
   */
  function publish_booking_resource_shortcode(resource_id, shortcode, trigger_button) {
    synchronize_booking_resource_shortcode_input(resource_id, shortcode);
    if ('function' === typeof window.wpbc_publish_booking_form__open) {
      window.wpbc_publish_booking_form__open(resource_id, shortcode, trigger_button);
    }
  }

  /**
   * Open the informational Free-edition Booking Resource upgrade dialog.
   *
   * @param {HTMLElement} trigger_button Button that opened the dialog.
   * @return {void}
   */
  function open_booking_resource_upgrade_dialog(trigger_button) {
    var modal_element = document.getElementById('wpbc_catalog_booking_resources__upgrade_modal');
    var upgrade_url = trigger_button ? trigger_button.getAttribute('data-wpbc-catalog-booking-resource-upgrade-url') : '';
    if (modal_element && window.jQuery && 'function' === typeof window.jQuery(modal_element).wpbc_my_modal) {
      window.jQuery(modal_element).off('hidden.wpbc.modal.wpbcCatalogResourceUpgrade hidden.bs.modal.wpbcCatalogResourceUpgrade').one('hidden.wpbc.modal.wpbcCatalogResourceUpgrade hidden.bs.modal.wpbcCatalogResourceUpgrade', function () {
        if (trigger_button && document.contains(trigger_button)) {
          trigger_button.focus();
        }
      }).wpbc_my_modal('show');
      return;
    }
    if (upgrade_url) {
      window.open(upgrade_url, '_blank', 'noopener');
    }
  }

  /**
   * Open the reusable native catalog message dialog.
   *
   * Message content is assigned with textContent so translated or server-provided
   * text cannot become dialog markup. The browser alert remains a resilience
   * fallback when the Booking Calendar modal runtime is unavailable.
   *
   * @param {string}      message        Message shown in the dialog body.
   * @param {string}      title          Optional dialog heading.
   * @param {HTMLElement} trigger_button Control that opened the dialog.
   * @return {boolean} True when the native dialog opened; otherwise false.
   */
  function open_booking_resource_message_dialog(message, title, trigger_button) {
    var modal_element = document.getElementById('wpbc_catalog_booking_resources__message_modal');
    var title_element = document.getElementById('wpbc_catalog_booking_resources__message_modal_title');
    var description_element = document.getElementById('wpbc_catalog_booking_resources__message_modal_description');
    if (message && modal_element && description_element && window.jQuery && 'function' === typeof window.jQuery(modal_element).wpbc_my_modal) {
      description_element.textContent = message;
      if (title_element) {
        title_element.textContent = title || title_element.getAttribute('data-wpbc-default-title') || '';
      }
      window.jQuery(modal_element).off('hidden.wpbc.modal.wpbcCatalogResourceMessage hidden.bs.modal.wpbcCatalogResourceMessage').one('hidden.wpbc.modal.wpbcCatalogResourceMessage hidden.bs.modal.wpbcCatalogResourceMessage', function () {
        if (trigger_button && document.contains(trigger_button)) {
          trigger_button.focus();
        }
      }).wpbc_my_modal('show');
      return true;
    }
    if (message && 'function' === typeof window.alert) {
      window.alert(message);
    }
    return false;
  }

  /**
   * Return the template-driven inspector host.
   *
   * @return {HTMLElement|null} Inspector host or null.
   */
  function get_inspector_host() {
    return document.querySelector('[data-wpbc-catalog-booking-resources-inspector-host]');
  }

  /**
   * Return the sticky native-sidebar footer.
   *
   * @return {HTMLElement|null} Footer element or null.
   */
  function get_inspector_footer() {
    return document.querySelector('[data-wpbc-ui-catalog-inspector-footer]');
  }

  /**
   * Return the shared native inspector state workflow.
   *
   * @param {Object} config Catalog configuration.
   * @return {Object|false} Shared inspector workflow or false.
   */
  function get_inspector_workflow(config) {
    if (inspector_workflow_controller) {
      return inspector_workflow_controller;
    }
    if (!window.wpbc_ui_catalog || 'function' !== typeof window.wpbc_ui_catalog.create_inspector_workflow) {
      return false;
    }
    inspector_workflow_controller = window.wpbc_ui_catalog.create_inspector_workflow({
      expand: expand_inspector_sidebar,
      get_footer: get_inspector_footer,
      get_host: get_inspector_host,
      render_shell: function (shell_data) {
        return render_component(config, 'inspector', shell_data);
      },
      shell_data: {
        catalog_id: config.id,
        empty_icon: 'wpbc-bi-pencil-square',
        empty_message: config.i18n.inspector_empty_message || '',
        empty_title: config.i18n.inspector_empty_title || '',
        loading_label: config.i18n.inspector_loading || config.i18n.loading || ''
      }
    });
    return inspector_workflow_controller;
  }

  /**
   * Render the shared inspector fallback-state shell once.
   *
   * @param {Object} config Catalog configuration.
   * @return {boolean} True when the shell is available.
   */
  function mount_inspector_shell(config) {
    var inspector_workflow = get_inspector_workflow(config);
    return !!inspector_workflow && inspector_workflow.mount();
  }

  /**
   * Expand the native right sidebar after an explicit editor action.
   *
   * @return {void}
   */
  function expand_inspector_sidebar() {
    synchronize_inspector_width();
    if ('function' === typeof window.wpbc_admin_ui__sidebar_right__do_max) {
      window.wpbc_admin_ui__sidebar_right__do_max();
    }
    document.dispatchEvent(new CustomEvent('wpbc_setup_wizard_layout_changed'));
  }

  /**
   * Apply the established wider sidebar only while creating Resources.
   *
   * The new catalog owns its class and styling so it does not depend on the old
   * listing assets while retaining the same native-sidebar width contract.
   *
   * @return {void}
   */
  function synchronize_inspector_width() {
    var host = get_inspector_host();
    var sidebar = host ? host.closest('.wpbc_ui_el__vert_right_bar__wrapper') : null;
    if (sidebar) {
      sidebar.classList.toggle('wpbc_catalog_booking_resources__inspector_width--wide', 'create' === inspector_mode);
    }
  }

  /**
   * Mark only the Resource currently owned by the inspector.
   *
   * @param {number} resource_id Resource ID or zero to clear highlighting.
   * @return {void}
   */
  function mark_inspector_resource_row(resource_id) {
    document.querySelectorAll('[data-wpbc-booking-resource-id].is-editor-active').forEach(function (row) {
      row.classList.remove('is-editor-active');
    });
    if (resource_id) {
      var row = document.querySelector('[data-wpbc-booking-resource-id="' + String(resource_id) + '"]');
      if (row) {
        row.classList.add('is-editor-active');
        row.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }

  /**
   * Synchronize shared empty, loading, error, form, and footer states.
   *
   * @param {string} state Empty, loading, error, or form.
   * @param {string} message Optional safe error message.
   * @return {void}
   */
  function set_inspector_state(state, message) {
    if (inspector_workflow_controller) {
      inspector_workflow_controller.set_state(state, message);
    }
  }

  /**
   * Serialize current editable field values for dirty-state comparison.
   *
   * @return {string} Stable JSON field snapshot.
   */
  function serialize_inspector_fields() {
    var fields = {};
    document.querySelectorAll('[data-wpbc-catalog-resource-inspector-form] [data-wpbc-catalog-resource-radio-field]:checked').forEach(function (field) {
      fields[field.getAttribute('data-wpbc-catalog-resource-radio-field') || ''] = field.value;
    });
    document.querySelectorAll('[data-wpbc-catalog-resource-inspector-form] [data-wpbc-catalog-resource-field]').forEach(function (field) {
      fields[field.getAttribute('data-wpbc-catalog-resource-field') || ''] = field.value;
    });
    return JSON.stringify(fields);
  }

  /**
   * Return the currently selected Resource creation mode.
   *
   * @return {string} Independent or children.
   */
  function get_inspector_creation_mode() {
    var selected_mode = document.querySelector('[data-wpbc-catalog-resource-radio-field="creation_mode"]:checked');
    var hidden_mode = document.querySelector('[data-wpbc-catalog-resource-field="creation_mode"]');
    return String(selected_mode ? selected_mode.value : hidden_mode ? hidden_mode.value : 'independent');
  }

  /**
   * Synchronize create-only conditional fields and radio-card presentation.
   *
   * These controls improve clarity only. The create service independently
   * authorizes the selected parent and derives all inherited values.
   *
   * @return {void}
   */
  function synchronize_create_inspector_controls() {
    if ('create' !== inspector_mode) {
      return;
    }
    var creation_mode = get_inspector_creation_mode();
    var parent_wrap = document.querySelector('[data-wpbc-catalog-resource-field-wrap="parent_id"]');
    document.querySelectorAll('[data-wpbc-catalog-resource-radio-field="creation_mode"]').forEach(function (radio) {
      var choice = radio.closest('label');
      if (choice) {
        choice.classList.toggle('is-selected', radio.checked);
      }
    });
    if (parent_wrap) {
      parent_wrap.hidden = 'children' !== creation_mode;
      parent_wrap.classList.toggle('is-conditionally-hidden', 'children' !== creation_mode);
    }
    ['base_cost', 'default_form', 'owner_user_id'].forEach(function (field_key) {
      var field_wrap = document.querySelector('[data-wpbc-catalog-resource-field-wrap="' + field_key + '"]');
      if (field_wrap) {
        field_wrap.hidden = 'children' === creation_mode;
        field_wrap.classList.toggle('is-conditionally-hidden', 'children' === creation_mode);
      }
    });
  }

  /**
   * Synchronize dirty state and the sticky primary action.
   *
   * @return {void}
   */
  function synchronize_inspector_dirty_state() {
    var save_button = document.querySelector('[data-wpbc-ui-catalog-inspector-save]');
    var form = document.querySelector('[data-wpbc-catalog-resource-inspector-form]');
    var save_is_busy = !!save_button && save_button.classList.contains('is-busy');
    inspector_dirty = !!form && serialize_inspector_fields() !== inspector_original_fields;
    if (save_button) {
      var title_field = form ? form.querySelector('[data-wpbc-catalog-resource-field="title"]') : null;
      var parent_field = form ? form.querySelector('[data-wpbc-catalog-resource-field="parent_id"]') : null;
      var create_is_valid = 'create' !== inspector_mode || form && 'true' === form.getAttribute('data-can-create') && title_field && '' !== String(title_field.value || '').trim() && ('children' !== get_inspector_creation_mode() || parent_field && Number(parent_field.value) > 0);
      save_button.disabled = save_is_busy || !form || !inspector_dirty || !create_is_valid;
    }
  }

  /**
   * Confirm whether the active inspector may be replaced or closed.
   *
   * @param {Object} config Catalog configuration.
   * @return {boolean} True when navigation may continue.
   */
  function can_discard_inspector(config) {
    if (inspector_mutation_in_progress) {
      return false;
    }
    return !inspector_dirty || window.confirm(config.i18n.inspector_discard || '');
  }

  /**
   * Close the inspector without changing catalog checkbox selection.
   *
   * @param {Object}  config         Catalog configuration.
   * @param {boolean} confirm_discard Whether dirty state needs confirmation.
   * @return {boolean} True when closed.
   */
  function close_inspector(config, confirm_discard) {
    if (confirm_discard && !can_discard_inspector(config)) {
      return false;
    }
    inspector_request_sequence += 1;
    inspector_dirty = false;
    inspector_mode = '';
    inspector_original_fields = '';
    inspector_resource_id = 0;
    inspector_resource_ids = [];
    inspector_bulk_operations = {};
    inspector_review_token = '';
    inspector_selection_stale = false;
    inspector_tracks_selection = false;
    inspector_capacity_context = null;
    inspector_capacity_detach_ids = [];
    inspector_capacity_decrease_action = 'detach';
    inspector_capacity_target = 0;
    synchronize_inspector_width();
    set_inspector_state('empty', '');
    mark_inspector_resource_row(0);
    if ('function' === typeof window.wpbc_admin_ui__sidebar_right__do_hide) {
      window.wpbc_admin_ui__sidebar_right__do_hide();
    }
    document.dispatchEvent(new CustomEvent('wpbc_setup_wizard_layout_changed'));
    if (inspector_focus_target && document.documentElement.contains(inspector_focus_target) && 'function' === typeof inspector_focus_target.focus) {
      inspector_focus_target.focus();
    }
    inspector_focus_target = null;
    return true;
  }

  /**
   * Post one authenticated inspector request.
   *
   * @param {Object} config Catalog configuration.
   * @param {string} action AJAX action.
   * @param {Object} values Request values.
   * @return {Promise<Object>} Parsed WordPress response.
   */
  function request_inspector(config, action, values) {
    var body = new window.URLSearchParams();
    body.append('action', action);
    body.append('nonce', config.nonce || '');
    Object.keys(values || {}).forEach(function (key) {
      body.append(key, String(values[key]));
    });
    return window.fetch(config.ajax_url, {
      body: body.toString(),
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      method: 'POST'
    }).then(function (response) {
      return response.json();
    });
  }

  /**
   * Return the explicit selection owned by the shared catalog controller.
   *
   * @param {Object} config Catalog configuration.
   * @return {Array<number>} Selected positive Resource IDs.
   */
  function get_selected_resource_ids(config) {
    var mount = document.getElementById(config.mount_id);
    var selection = mount && mount._wpbc_ui_catalog_selection_controller;
    var selected_ids = selection && 'function' === typeof selection.get_selected_ids ? selection.get_selected_ids() : [];
    return selected_ids.map(Number).filter(function (resource_id) {
      return resource_id > 0;
    });
  }

  /**
   * Compare two Resource-ID selections without relying on event ordering.
   *
   * @param {Array<number|string>} first_ids  First ID list.
   * @param {Array<number|string>} second_ids Second ID list.
   * @return {boolean} True when both lists contain the same Resource IDs.
   */
  function resource_id_lists_match(first_ids, second_ids) {
    var normalize_ids = function (resource_ids) {
      return (resource_ids || []).map(Number).filter(function (resource_id) {
        return resource_id > 0;
      }).sort(function (first_id, second_id) {
        return first_id - second_id;
      });
    };
    return JSON.stringify(normalize_ids(first_ids)) === JSON.stringify(normalize_ids(second_ids));
  }

  /**
   * Return a localized selection-count label.
   *
   * @param {Object} config Catalog configuration.
   * @param {number} count  Number of selected Resources.
   * @return {string} Count and localized noun.
   */
  function get_selection_count_label(config, count) {
    return String(count) + ' ' + (1 === Number(count) ? config.i18n.resource_selected || '' : config.i18n.resources_selected || '');
  }

  /**
   * Configure the native sticky footer for the active inspector workflow.
   *
   * @param {string} form_id      Form receiving the submit action.
   * @param {string} button_label Localized primary label.
   * @param {boolean} destructive Whether the action permanently deletes data.
   * @param {boolean} disabled    Whether submission starts disabled.
   * @return {void}
   */
  function configure_inspector_footer(form_id, button_label, destructive, disabled) {
    var footer = get_inspector_footer();
    var save_button = footer ? footer.querySelector('[data-wpbc-ui-catalog-inspector-save]') : null;
    var cancel_button = footer ? footer.querySelector('[data-wpbc-ui-catalog-inspector-cancel]') : null;
    var delete_workflow;
    if (save_button) {
      save_button.classList.remove('is-busy', 'button-link-delete', 'wpbc_catalog_booking_resources__delete_submit', 'wpbc_ui_listing__inspector_action--destructive', 'wpbc_booking_resources__delete_confirm_button', 'wpbc_ui_catalog_delete_review__apply');
      save_button.classList.toggle('button-primary', !destructive);
      save_button.classList.toggle('button-secondary', !!destructive);
      save_button.classList.toggle('wpbc_ui_listing__inspector_action--destructive', !!destructive);
      save_button.classList.toggle('wpbc_booking_resources__delete_confirm_button', !!destructive);
      save_button.textContent = button_label || '';
      save_button.setAttribute('form', form_id);
      save_button.disabled = !!disabled;
    }
    if (cancel_button) {
      cancel_button.textContent = window.wpbc_catalog_booking_resources_config && window.wpbc_catalog_booking_resources_config.i18n ? window.wpbc_catalog_booking_resources_config.i18n.cancel || cancel_button.textContent : cancel_button.textContent;
      cancel_button.disabled = false;
    }
    if (destructive && 'wpbc_catalog_booking_resources_delete_form' === form_id) {
      delete_workflow = get_delete_review_workflow();
      if (delete_workflow) {
        delete_workflow.configure_footer({
          can_apply: true,
          footer: footer,
          form_id: form_id,
          label: button_label
        });
      }
    }
  }

  /**
   * Emphasize the permanent-deletion acknowledgement.
   *
   * Restarting the finite animation mirrors the established Booking Resource
   * editor behavior when a deletion review opens or acknowledgement is cleared.
   *
   * @param {HTMLElement|null} acknowledgement Deletion acknowledgement label.
   * @return {void}
   */
  function pulse_delete_acknowledgement(acknowledgement) {
    var delete_workflow = get_delete_review_workflow();
    if (acknowledgement && acknowledgement.matches('.wpbc_ui_catalog_delete_review__acknowledgement') && delete_workflow) {
      delete_workflow.pulse_acknowledgement();
      return;
    }
    if (!acknowledgement) {
      return;
    }
    acknowledgement.classList.remove('wpbc_booking_resources__delete_acknowledgement--attention');
    void acknowledgement.offsetWidth;
    acknowledgement.classList.add('wpbc_booking_resources__delete_acknowledgement--attention');
  }

  /**
   * Return a safe message from a WordPress inspector response.
   *
   * @param {Object} response Response payload.
   * @param {string} fallback Fallback message.
   * @return {string} Plain message.
   */
  function get_inspector_response_message(response, fallback) {
    return response && response.data && response.data.message ? String(response.data.message) : String(fallback || '');
  }

  /**
   * Show a success or error notice in the active inspector.
   *
   * @param {HTMLFormElement} form     Inspector form.
   * @param {string}          message  Safe server or localized message.
   * @param {boolean}         is_error Whether the notice represents an error.
   * @return {void}
   */
  function show_inspector_message(form, message, is_error) {
    var notice = form ? form.querySelector('[data-wpbc-catalog-resource-inspector-message]') : null;
    if (!notice) {
      return;
    }
    notice.classList.toggle('notice-error', !!is_error);
    notice.classList.toggle('notice-success', !is_error);
    notice.hidden = !message;
    var notice_text = notice.querySelector('p');
    if (notice_text) {
      notice_text.textContent = message || '';
    }
  }

  /**
   * Move keyboard focus to the heading of a newly rendered reviewed inspector.
   *
   * @param {HTMLFormElement|null} form Rendered inspector form.
   * @return {void}
   */
  function focus_inspector_heading(form) {
    var heading = form ? form.querySelector('[data-wpbc-catalog-resource-inspector-heading]') : null;
    if (!heading) {
      return;
    }
    window.setTimeout(function () {
      if (document.documentElement.contains(heading) && 'function' === typeof heading.focus) {
        heading.focus();
      }
    }, 0);
  }

  /**
   * Show a standard Booking Calendar administration notice.
   *
   * Successful mutations use the shared top-right notice area used by the
   * Booking Calendar settings pages. The boolean return lets callers retain
   * an inline fallback when that shared helper is unavailable.
   *
   * @param {string} message      Safe server or localized message.
   * @param {string} message_type Notice type accepted by the shared helper.
   * @param {number} delay        Notice visibility duration in milliseconds.
   * @return {boolean} True when the message was displayed.
   */
  function show_admin_message(message, message_type, delay) {
    var config;
    var mount_element;
    var notice;
    var notice_text;
    if (!message) {
      return false;
    }
    if ('function' === typeof window.wpbc_admin_show_message) {
      window.wpbc_admin_show_message(message, message_type || 'info', delay || 4000, false);
      return true;
    }
    config = window.wpbc_catalog_booking_resources_config || {};
    mount_element = config.mount_id ? document.getElementById(config.mount_id) : null;
    mount_element = mount_element && mount_element.parentNode ? mount_element.parentNode : document.getElementById('wpbody-content') || document.body;
    if (!mount_element) {
      return false;
    }
    notice = document.createElement('div');
    notice.className = 'notice notice-' + ('error' === message_type ? 'error' : 'success') + ' wpbc_catalog_booking_resources__mutation_notice';
    notice.setAttribute('role', 'error' === message_type ? 'alert' : 'status');
    notice.setAttribute('aria-live', 'error' === message_type ? 'assertive' : 'polite');
    notice_text = document.createElement('p');
    notice_text.textContent = message;
    notice.appendChild(notice_text);
    mount_element.insertBefore(notice, mount_element.firstChild);
    window.setTimeout(function () {
      if (notice.parentNode) {
        notice.parentNode.removeChild(notice);
      }
    }, delay || 4000);
    return true;
  }

  /**
   * Open and focus one server-defined edit-inspector section.
   *
   * The shared collapsible controller keeps exclusive group state and ARIA
   * attributes synchronized. The header click is retained as a compatibility
   * fallback for older administration bundles.
   *
   * @param {string} section_id Inspector section identifier.
   * @return {boolean} True when the requested section exists.
   */
  function activate_inspector_section(section_id) {
    var form;
    var group;
    var root;
    var controller;
    var header;
    section_id = String(section_id || '');
    if (!/^[a-z0-9_]+$/.test(section_id)) {
      return false;
    }
    form = document.querySelector('[data-wpbc-catalog-resource-inspector-form][data-mode="edit"]');
    group = form ? form.querySelector('[data-group="catalog-booking-resource-' + section_id + '"]') : null;
    header = group ? group.querySelector('.group__header') : null;
    if (!group || !header) {
      return false;
    }
    root = group.closest('.wpbc_collapsible');
    controller = root && root.__wpbc_collapsible_instance ? root.__wpbc_collapsible_instance : null;
    if (controller && 'function' === typeof controller.expand) {
      controller.expand(group);
    } else if (!group.classList.contains('is-open')) {
      header.click();
    }
    window.setTimeout(function () {
      group.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
      header.focus();
    }, 120);
    return true;
  }

  /**
   * Render one server-authoritative create or edit schema.
   *
   * @param {Object} config Catalog configuration.
   * @param {Object} schema Inspector schema.
   * @param {boolean} focus_title Whether the title control receives focus.
   * @return {boolean} True when rendered.
   */
  function render_inspector_schema(config, schema, focus_title) {
    var host = get_inspector_host();
    var form_target = host ? host.querySelector('[data-wpbc-ui-catalog-inspector-form]') : null;
    var footer = get_inspector_footer();
    var save_button = footer ? footer.querySelector('[data-wpbc-ui-catalog-inspector-save]') : null;
    var template_role = 'create' === schema.mode ? 'inspector_create' : 'inspector_edit';
    if (!form_target) {
      return false;
    }
    form_target.innerHTML = render_component(config, template_role, {
      i18n: config.i18n || {},
      schema: schema
    });
    var form = form_target.querySelector('[data-wpbc-catalog-resource-inspector-form]');
    if (!form) {
      return false;
    }
    if ('create' === schema.mode) {
      form.setAttribute('data-can-create', schema.can_create ? 'true' : 'false');
    }
    inspector_mode = schema.mode;
    inspector_resource_id = Number(schema.resource_id) || 0;
    if (inspector_resource_id) {
      var shortcode_field = form.querySelector('.wpbc_catalog_booking_resources__editor_code');
      if (shortcode_field) {
        synchronize_booking_resource_shortcode_input(inspector_resource_id, shortcode_field.value);
      }
    }
    set_inspector_state('form', '');
    if (save_button) {
      configure_inspector_footer('wpbc_catalog_booking_resource_inspector_form', 'create' === inspector_mode ? config.i18n.add_resource || '' : config.i18n.save_changes || '', false, true);
    }
    var cancel_button = footer ? footer.querySelector('[data-wpbc-ui-catalog-inspector-cancel]') : null;
    if (cancel_button) {
      cancel_button.disabled = false;
    }
    if ('function' === typeof window.WPBC_Collapsible_AutoInit) {
      window.WPBC_Collapsible_AutoInit();
    }
    synchronize_all_inspector_numeric_ranges();
    synchronize_create_inspector_controls();
    inspector_original_fields = serialize_inspector_fields();
    inspector_dirty = false;
    synchronize_inspector_dirty_state();
    mark_inspector_resource_row(inspector_resource_id);
    if (false !== focus_title) {
      window.setTimeout(function () {
        var title_field = form.querySelector('[data-wpbc-catalog-resource-field="title"]');
        if (title_field && 'function' === typeof title_field.focus) {
          title_field.focus();
        }
      }, 120);
    }
    return true;
  }

  /**
   * Load and open one create or edit inspector.
   *
   * @param {Object}      config       Catalog configuration.
   * @param {string}      mode         Create or edit.
   * @param {number}      resource_id  Resource ID for edit.
   * @param {HTMLElement} focus_target Initiating control.
   * @param {string}      section_id   Optional edit section to open and focus.
   * @return {void}
   */
  function open_inspector(config, mode, resource_id, focus_target, section_id) {
    var request_sequence;
    var action;
    resource_id = Number(resource_id) || 0;
    if ('edit' === mode && resource_id === inspector_resource_id && document.querySelector('[data-wpbc-catalog-resource-inspector-form][data-mode="edit"]')) {
      expand_inspector_sidebar();
      mark_inspector_resource_row(resource_id);
      if (section_id) {
        activate_inspector_section(section_id);
      }
      return;
    }
    if (!can_discard_inspector(config) || !mount_inspector_shell(config)) {
      return;
    }
    close_details_row(false);
    inspector_focus_target = focus_target || document.activeElement;
    request_sequence = ++inspector_request_sequence;
    inspector_dirty = false;
    inspector_mode = mode;
    inspector_resource_id = resource_id;
    synchronize_inspector_width();
    action = 'create' === mode ? config.inspector_create_schema_action : config.inspector_edit_schema_action;
    set_inspector_state('loading', '');
    mark_inspector_resource_row(inspector_resource_id);
    expand_inspector_sidebar();
    request_inspector(config, action, 'edit' === mode ? {
      resource_id: inspector_resource_id
    } : {}).then(function (response) {
      if (request_sequence !== inspector_request_sequence) {
        return;
      }
      if (!response || true !== response.success || !response.data || !response.data.schema || !render_inspector_schema(config, response.data.schema, !section_id)) {
        set_inspector_state('error', get_inspector_response_message(response, config.i18n.inspector_load_failed));
      } else if (section_id) {
        activate_inspector_section(section_id);
      }
    }).catch(function () {
      if (request_sequence === inspector_request_sequence) {
        set_inspector_state('error', config.i18n.inspector_load_failed || '');
      }
    });
  }

  /**
   * Render the server-generated common-field bulk editor.
   *
   * @param {Object} config Catalog configuration.
   * @param {Object} schema Authorized bulk schema.
   * @return {boolean} True when the form rendered.
   */
  function render_bulk_editor(config, schema) {
    var host = get_inspector_host();
    var target = host ? host.querySelector('[data-wpbc-ui-catalog-inspector-form]') : null;
    if (!target) {
      return false;
    }
    target.innerHTML = render_component(config, 'inspector_bulk_edit', {
      i18n: config.i18n || {},
      schema: schema,
      selection_label: get_selection_count_label(config, schema.selection_count)
    });
    if (!target.querySelector('[data-wpbc-catalog-resource-bulk-form]')) {
      return false;
    }
    inspector_mode = 'bulk_edit';
    inspector_resource_id = 0;
    inspector_resource_ids = (schema.resource_ids || []).map(Number);
    inspector_bulk_operations = {};
    inspector_review_token = '';
    inspector_selection_stale = false;
    inspector_tracks_selection = true;
    inspector_dirty = false;
    set_inspector_state('form', '');
    configure_inspector_footer('wpbc_catalog_booking_resources_bulk_form', config.i18n.review_changes_button || '', false, true);
    if ('function' === typeof window.WPBC_Collapsible_AutoInit) {
      window.WPBC_Collapsible_AutoInit();
    }
    mark_inspector_resource_row(0);
    focus_inspector_heading(target.querySelector('[data-wpbc-catalog-resource-bulk-form]'));
    return true;
  }

  /**
   * Open a bulk editor for the current explicit selection.
   *
   * @param {Object}      config       Catalog configuration.
   * @param {HTMLElement} focus_target Initiating control.
   * @return {void}
   */
  function open_bulk_editor(config, focus_target) {
    var resource_ids = get_selected_resource_ids(config);
    var request_sequence;
    if (!resource_ids.length || !can_discard_inspector(config) || !mount_inspector_shell(config)) {
      return;
    }
    close_details_row(false);
    inspector_focus_target = focus_target || document.activeElement;
    request_sequence = ++inspector_request_sequence;
    inspector_mode = 'bulk_edit';
    inspector_resource_ids = resource_ids.slice();
    inspector_dirty = false;
    inspector_tracks_selection = true;
    synchronize_inspector_width();
    set_inspector_state('loading', '');
    expand_inspector_sidebar();
    request_inspector(config, config.bulk_schema_action, {
      resource_ids: JSON.stringify(resource_ids)
    }).then(function (response) {
      if (request_sequence !== inspector_request_sequence) {
        return;
      }
      if (!response || true !== response.success || !response.data || !response.data.schema || !render_bulk_editor(config, response.data.schema)) {
        set_inspector_state('error', get_inspector_response_message(response, config.i18n.bulk_load_failed));
      } else if (!resource_id_lists_match(inspector_resource_ids, get_selected_resource_ids(config))) {
        handle_inspector_selection_change(null, config);
      }
    }).catch(function () {
      if (request_sequence === inspector_request_sequence) {
        set_inspector_state('error', config.i18n.bulk_load_failed || '');
      }
    });
  }

  /**
   * Return only explicitly enabled bulk operations.
   *
   * @return {Object} Operation envelope keyed by field.
   */
  function collect_bulk_operations() {
    var operations = {};
    document.querySelectorAll('[data-wpbc-catalog-resource-bulk-enable]:checked').forEach(function (enabled_control) {
      var field_key = enabled_control.getAttribute('data-wpbc-catalog-resource-bulk-enable') || '';
      var operation = document.querySelector('[data-wpbc-catalog-resource-bulk-operation="' + field_key + '"]');
      var field_value = document.querySelector('[data-wpbc-catalog-resource-bulk-value="' + field_key + '"]');
      if (field_key && operation && field_value) {
        operations[field_key] = {
          operation: operation.value,
          value: field_value.value
        };
      }
    });
    return operations;
  }

  /**
   * Synchronize one optional bulk field and the review action.
   *
   * @param {HTMLElement|null} changed_control Control that changed, when available.
   * @return {void}
   */
  function synchronize_bulk_editor(changed_control) {
    var field_wrap = changed_control ? changed_control.closest('[data-wpbc-catalog-resource-bulk-field]') : null;
    var save_button = document.querySelector('[data-wpbc-ui-catalog-inspector-save]');
    if (field_wrap) {
      var enabled_control = field_wrap.querySelector('[data-wpbc-catalog-resource-bulk-enable]');
      var operation_control = field_wrap.querySelector('[data-wpbc-catalog-resource-bulk-operation]');
      var prefix_element = field_wrap.querySelector('[data-wpbc-catalog-resource-bulk-prefix]');
      var suffix_element = field_wrap.querySelector('[data-wpbc-catalog-resource-bulk-suffix]');
      var enabled = !!enabled_control && enabled_control.checked;
      var operation_id = operation_control ? String(operation_control.value || '') : '';
      var is_percent = -1 !== operation_id.indexOf('percent');
      field_wrap.classList.toggle('is-enabled', enabled);
      field_wrap.querySelectorAll('[data-wpbc-catalog-resource-bulk-operation], [data-wpbc-catalog-resource-bulk-value], [data-wpbc-catalog-resource-bulk-range]').forEach(function (control) {
        control.disabled = !enabled;
      });
      if (prefix_element) {
        prefix_element.textContent = is_percent ? '' : field_wrap.getAttribute('data-wpbc-catalog-resource-bulk-prefix') || '';
      }
      if (suffix_element) {
        suffix_element.textContent = is_percent ? '%' : field_wrap.getAttribute('data-wpbc-catalog-resource-bulk-suffix') || '';
      }
      if (changed_control && changed_control.matches('[data-wpbc-catalog-resource-bulk-range]')) {
        var number_control = field_wrap.querySelector('[data-wpbc-catalog-resource-bulk-value]');
        if (number_control) {
          number_control.value = changed_control.value;
        }
      } else {
        var range_control = field_wrap.querySelector('[data-wpbc-catalog-resource-bulk-range]');
        var field_value_control = field_wrap.querySelector('[data-wpbc-catalog-resource-bulk-value]');
        if (range_control && field_value_control && '' !== field_value_control.value) {
          range_control.value = field_value_control.value;
        }
      }
    }
    inspector_bulk_operations = collect_bulk_operations();
    inspector_dirty = Object.keys(inspector_bulk_operations).length > 0;
    if (save_button) {
      save_button.disabled = inspector_selection_stale || !inspector_dirty;
    }
  }

  /**
   * Render a signed bulk-edit review without performing a mutation.
   *
   * @param {Object} config  Catalog configuration.
   * @param {Object} preview Server-authoritative preview.
   * @return {boolean} True when rendered.
   */
  function render_bulk_review(config, preview) {
    var host = get_inspector_host();
    var review_workflow = get_inline_review_workflow();
    var review_model;
    var target = host ? host.querySelector('[data-wpbc-ui-catalog-inspector-form]') : null;
    if (!target) {
      return false;
    }
    review_model = review_workflow ? review_workflow.prepare(preview.review || {}, {
      changed_label: get_selection_count_label(config, preview.schema.resource_ids.length),
      description: config.i18n.inline_review_description || '',
      form_id: 'wpbc_catalog_booking_resources_bulk_review_form',
      mode: 'bulk_review',
      pending_message: config.i18n.review_changes_help || '',
      title: config.i18n.review_changes || config.i18n.edit_booking_resources || ''
    }) : {};
    target.innerHTML = render_component(config, 'inspector_bulk_review', review_model);
    if (!target.querySelector('[data-wpbc-catalog-resource-bulk-review-form]')) {
      return false;
    }
    inspector_mode = 'bulk_review';
    inspector_review_token = String(preview.review_token || '');
    inspector_dirty = true;
    set_inspector_state('form', '');
    configure_inspector_footer('wpbc_catalog_booking_resources_bulk_review_form', config.i18n.apply_changes || '', false, inspector_selection_stale);
    if (review_workflow) {
      review_workflow.synchronize({
        busy: false,
        can_apply: !inspector_selection_stale && !!inspector_review_token
      });
    }
    focus_inspector_heading(target.querySelector('[data-wpbc-catalog-resource-bulk-review-form]'));
    return true;
  }

  /**
   * Render the signed deletion impact and explicit acknowledgement.
   *
   * @param {Object} config  Catalog configuration.
   * @param {Object} preview Server-authoritative deletion preview.
   * @return {boolean} True when rendered.
   */
  function render_delete_review(config, preview) {
    var host = get_inspector_host();
    var target = host ? host.querySelector('[data-wpbc-ui-catalog-inspector-form]') : null;
    var acknowledgement;
    if (!target) {
      return false;
    }
    var delete_i18n = preview.i18n || {};
    target.innerHTML = render_component(config, 'inspector_delete', {
      delete_i18n: {
        acknowledgement: delete_i18n.acknowledgement || config.i18n.delete_acknowledgement || '',
        actions_heading: delete_i18n.actions_heading || '',
        bookings_retained_warning: delete_i18n.bookings_retained_warning || config.i18n.bookings_retained_warning || '',
        resources_to_delete: delete_i18n.resources_to_delete || config.i18n.resources_to_delete || '',
        review_help: delete_i18n.review_help || config.i18n.delete_review_help || '',
        title: delete_i18n.title || config.i18n.delete_booking_resources || '',
        warning: delete_i18n.warning || config.i18n.delete_warning || ''
      },
      i18n: config.i18n || {},
      preview: preview,
      selection_label: delete_i18n.selection_label || get_selection_count_label(config, preview.selection_count)
    });
    if (!target.querySelector('[data-wpbc-catalog-resource-delete-form]')) {
      return false;
    }
    inspector_mode = 'delete_review';
    inspector_resource_ids = (preview.resources || []).map(function (resource) {
      return Number(resource.id);
    });
    inspector_resource_id = !inspector_tracks_selection && 1 === inspector_resource_ids.length ? inspector_resource_ids[0] : 0;
    inspector_review_token = String(preview.review_token || '');
    inspector_selection_stale = false;
    inspector_dirty = false;
    set_inspector_state('form', '');
    configure_inspector_footer('wpbc_catalog_booking_resources_delete_form', delete_i18n.delete_button || format_message(1 === Number(preview.selection_count) ? config.i18n.delete_resource || '' : config.i18n.delete_resources || '', [preview.selection_count]), true, true);
    acknowledgement = target.querySelector('.wpbc_booking_resources__delete_acknowledgement');
    pulse_delete_acknowledgement(acknowledgement);
    mark_inspector_resource_row(inspector_resource_id);
    focus_inspector_heading(target.querySelector('[data-wpbc-catalog-resource-delete-form]'));
    return true;
  }

  /**
   * Open the independent deletion review for explicit Resource IDs.
   *
   * @param {Object}        config       Catalog configuration.
   * @param {Array<number>} resource_ids Resource IDs selected for deletion.
   * @param {HTMLElement}   focus_target Initiating control.
   * @param {boolean}       track_selection Whether deletion owns the checkbox selection.
   * @return {void}
   */
  function open_delete_review(config, resource_ids, focus_target, track_selection) {
    var request_sequence;
    resource_ids = (resource_ids || []).map(Number).filter(function (resource_id) {
      return resource_id > 0;
    });
    if (!resource_ids.length || !can_discard_inspector(config) || !mount_inspector_shell(config)) {
      return;
    }
    close_details_row(false);
    inspector_focus_target = focus_target || document.activeElement;
    request_sequence = ++inspector_request_sequence;
    inspector_mode = 'delete_review';
    inspector_resource_ids = resource_ids.slice();
    inspector_resource_id = !track_selection && 1 === inspector_resource_ids.length ? inspector_resource_ids[0] : 0;
    inspector_dirty = false;
    inspector_tracks_selection = !!track_selection;
    synchronize_inspector_width();
    set_inspector_state('loading', '');
    mark_inspector_resource_row(inspector_resource_id);
    expand_inspector_sidebar();
    request_inspector(config, config.delete_preview_action, {
      resource_ids: JSON.stringify(resource_ids)
    }).then(function (response) {
      if (request_sequence !== inspector_request_sequence) {
        return;
      }
      if (!response || true !== response.success || !response.data || !response.data.preview || !render_delete_review(config, response.data.preview)) {
        set_inspector_state('error', get_inspector_response_message(response, config.i18n.delete_load_failed));
      } else if (inspector_tracks_selection && !resource_id_lists_match(inspector_resource_ids, get_selected_resource_ids(config))) {
        handle_inspector_selection_change(null, config);
      }
    }).catch(function () {
      if (request_sequence === inspector_request_sequence) {
        set_inspector_state('error', config.i18n.delete_load_failed || '');
      }
    });
  }

  /**
   * Return one localized capacity count label.
   *
   * @param {Object} config       Catalog configuration.
   * @param {string} singular_key Singular translation key.
   * @param {string} plural_key   Plural translation key.
   * @param {number} count        Non-negative count.
   * @return {string} Localized label.
   */
  function get_capacity_count_label(config, singular_key, plural_key, count) {
    var template = 1 === Number(count) ? config.i18n[singular_key] : config.i18n[plural_key];
    return format_message(template || '', [count]);
  }

  /**
   * Build presentation-only data for the capacity WP template.
   *
   * @param {Object} config  Catalog configuration.
   * @param {Object} context Server-authoritative capacity context.
   * @return {Object} Template view data.
   */
  function get_capacity_editor_view(config, context) {
    var current_capacity = Number(context.current_capacity) || 1;
    var target_capacity = inspector_capacity_target || current_capacity;
    var operation = target_capacity > current_capacity ? 'increase' : target_capacity < current_capacity ? 'decrease' : 'unchanged';
    var keep_count = 'decrease' === operation ? target_capacity : current_capacity;
    var create_count = Math.max(0, target_capacity - current_capacity);
    var decrease_count = Math.max(0, current_capacity - target_capacity);
    var delete_action = 'decrease' === operation && 'delete' === inspector_capacity_decrease_action;
    return {
      children: (context.children || []).map(function (child) {
        child = Object.assign({}, child);
        child.selected = -1 !== inspector_capacity_detach_ids.indexOf(Number(child.id));
        return child;
      }),
      context_label: (config.i18n.resource_id || 'ID') + ': ' + String(context.resource_id),
      current_capacity: current_capacity,
      decrease_action: inspector_capacity_decrease_action,
      decrease_heading: get_capacity_count_label(config, delete_action ? 'choose_delete_unit' : 'choose_detach_unit', delete_action ? 'choose_delete_units' : 'choose_detach_units', decrease_count),
      decrease_help: delete_action ? config.i18n.delete_units_help || '' : config.i18n.select_detach_help || '',
      decrease_outcome_label: delete_action ? config.i18n.will_be_deleted || '' : config.i18n.make_independent || '',
      description: config.i18n.capacity_description || '',
      create_label: get_capacity_count_label(config, 'create_new_unit', 'create_new_units', create_count),
      keep_label: get_capacity_count_label(config, 'keep_existing_unit', 'keep_existing_units', keep_count),
      maximum_capacity: Number(context.maximum_capacity) || current_capacity,
      minimum_capacity: Number(context.minimum_capacity) || 1,
      mode: 'capacity',
      operation: operation,
      target_capacity: target_capacity,
      title: config.i18n.adjust_capacity || ''
    };
  }

  /**
   * Synchronize the live capacity plan without replacing focused controls.
   *
   * @param {Object} config Catalog configuration.
   * @return {void}
   */
  function synchronize_capacity_editor(config) {
    var form = document.querySelector('[data-wpbc-catalog-resource-capacity-form][data-mode="capacity"]');
    var save_button = document.querySelector('[data-wpbc-ui-catalog-inspector-save]');
    var context = inspector_capacity_context || {};
    var current_capacity = Number(context.current_capacity) || 1;
    var target_capacity = inspector_capacity_target || current_capacity;
    var operation = target_capacity > current_capacity ? 'increase' : target_capacity < current_capacity ? 'decrease' : 'unchanged';
    var required_detach_count = Math.max(0, current_capacity - target_capacity);
    var target_number = form ? form.querySelector('[data-wpbc-catalog-capacity-target]') : null;
    var target_range = form ? form.querySelector('[data-wpbc-catalog-capacity-range]') : null;
    if (!form) {
      return;
    }
    if ('decrease' !== operation) {
      inspector_capacity_detach_ids = [];
      inspector_capacity_decrease_action = 'detach';
    } else if (inspector_capacity_detach_ids.length > required_detach_count) {
      inspector_capacity_detach_ids = inspector_capacity_detach_ids.slice(0, required_detach_count);
    }
    if (target_number) {
      target_number.value = String(target_capacity);
    }
    if (target_range) {
      target_range.value = String(target_capacity);
    }
    var after_value = form.querySelector('[data-wpbc-catalog-capacity-after]');
    var keep_label = form.querySelector('[data-wpbc-catalog-capacity-keep-label]');
    var create_label = form.querySelector('[data-wpbc-catalog-capacity-create-label]');
    var increase_row = form.querySelector('[data-wpbc-catalog-capacity-increase-row]');
    var decrease_panel = form.querySelector('[data-wpbc-catalog-capacity-decrease]');
    var decrease_heading = form.querySelector('[data-wpbc-catalog-capacity-decrease-heading]');
    var decrease_help = form.querySelector('[data-wpbc-catalog-capacity-decrease-help]');
    var delete_action = 'decrease' === operation && 'delete' === inspector_capacity_decrease_action;
    if (after_value) {
      after_value.textContent = String(target_capacity);
    }
    if (keep_label) {
      keep_label.textContent = get_capacity_count_label(config, 'keep_existing_unit', 'keep_existing_units', 'decrease' === operation ? target_capacity : current_capacity);
    }
    if (create_label) {
      create_label.textContent = get_capacity_count_label(config, 'create_new_unit', 'create_new_units', Math.max(0, target_capacity - current_capacity));
    }
    if (increase_row) {
      increase_row.hidden = 'increase' !== operation;
    }
    if (decrease_panel) {
      decrease_panel.hidden = 'decrease' !== operation;
    }
    if (decrease_heading) {
      decrease_heading.textContent = get_capacity_count_label(config, delete_action ? 'choose_delete_unit' : 'choose_detach_unit', delete_action ? 'choose_delete_units' : 'choose_detach_units', required_detach_count);
    }
    if (decrease_help) {
      decrease_help.textContent = delete_action ? config.i18n.delete_units_help || '' : config.i18n.select_detach_help || '';
    }
    form.querySelectorAll('[data-wpbc-catalog-capacity-decrease-action]').forEach(function (action_control) {
      var action_selected = action_control.value === inspector_capacity_decrease_action;
      action_control.checked = action_selected;
      if (action_control.closest('label')) {
        action_control.closest('label').classList.toggle('is-selected', action_selected);
      }
    });
    form.querySelectorAll('[data-wpbc-catalog-capacity-detach]').forEach(function (checkbox) {
      var selected = -1 !== inspector_capacity_detach_ids.indexOf(Number(checkbox.value));
      var unit = checkbox.closest('.wpbc_booking_resources__capacity_unit');
      var outcome = unit ? unit.querySelector('.wpbc_booking_resources__capacity_unit_outcome') : null;
      checkbox.checked = selected;
      checkbox.disabled = !selected && inspector_capacity_detach_ids.length >= required_detach_count;
      if (unit) {
        unit.classList.toggle('is-selected', selected);
      }
      if (outcome) {
        outcome.hidden = !selected;
        outcome.textContent = delete_action ? config.i18n.will_be_deleted || '' : config.i18n.make_independent || '';
        outcome.classList.toggle('is-destructive', delete_action);
      }
    });
    inspector_dirty = target_capacity !== current_capacity;
    if (save_button) {
      save_button.disabled = 'unchanged' === operation || 'decrease' === operation && inspector_capacity_detach_ids.length !== required_detach_count;
    }
  }

  /**
   * Render an authorized capacity editor context.
   *
   * @param {Object} config  Catalog configuration.
   * @param {Object} context Server capacity context.
   * @return {boolean} True when the template rendered.
   */
  function render_capacity_editor(config, context) {
    var host = get_inspector_host();
    var target = host ? host.querySelector('[data-wpbc-ui-catalog-inspector-form]') : null;
    if (!target) {
      return false;
    }
    inspector_capacity_context = context;
    inspector_capacity_target = Number(context.current_capacity) || 1;
    inspector_capacity_detach_ids = [];
    inspector_capacity_decrease_action = 'detach';
    target.innerHTML = render_component(config, 'inspector_capacity', {
      i18n: config.i18n || {},
      view: get_capacity_editor_view(config, context)
    });
    if (!target.querySelector('[data-wpbc-catalog-resource-capacity-form]')) {
      return false;
    }
    inspector_mode = 'capacity';
    inspector_resource_id = Number(context.resource_id) || 0;
    inspector_review_token = '';
    inspector_dirty = false;
    set_inspector_state('form', '');
    configure_inspector_footer('wpbc_catalog_booking_resource_capacity_form', config.i18n.review_capacity_change || '', false, true);
    mark_inspector_resource_row(inspector_resource_id);
    focus_inspector_heading(target.querySelector('[data-wpbc-catalog-resource-capacity-form]'));
    return true;
  }

  /**
   * Open capacity context from either row action entry point.
   *
   * @param {Object}      config       Catalog configuration.
   * @param {number}      resource_id  Root or child Resource ID.
   * @param {HTMLElement} focus_target Initiating control.
   * @return {void}
   */
  function open_capacity_editor(config, resource_id, focus_target) {
    var request_sequence;
    if (!resource_id || !can_discard_inspector(config) || !mount_inspector_shell(config)) {
      return;
    }
    close_details_row(false);
    inspector_focus_target = focus_target || document.activeElement;
    request_sequence = ++inspector_request_sequence;
    inspector_mode = 'capacity';
    inspector_resource_id = resource_id;
    inspector_dirty = false;
    inspector_tracks_selection = false;
    synchronize_inspector_width();
    set_inspector_state('loading', '');
    mark_inspector_resource_row(resource_id);
    expand_inspector_sidebar();
    request_inspector(config, config.capacity_context_action, {
      resource_id: resource_id
    }).then(function (response) {
      if (request_sequence !== inspector_request_sequence) {
        return;
      }
      if (!response || true !== response.success || !response.data || !response.data.context || !render_capacity_editor(config, response.data.context)) {
        set_inspector_state('error', get_inspector_response_message(response, config.i18n.capacity_load_failed));
      }
    }).catch(function () {
      if (request_sequence === inspector_request_sequence) {
        set_inspector_state('error', config.i18n.capacity_load_failed || '');
      }
    });
  }

  /**
   * Render a signed capacity review returned by the domain service.
   *
   * @param {Object} config  Catalog configuration.
   * @param {Object} preview Signed preview.
   * @return {boolean} True when rendered.
   */
  function render_capacity_review(config, preview) {
    var host = get_inspector_host();
    var target = host ? host.querySelector('[data-wpbc-ui-catalog-inspector-form]') : null;
    var increase = 'increase' === preview.operation;
    var delete_action = 'delete' === preview.decrease_action;
    var view;
    if (!target) {
      return false;
    }
    view = {
      context_label: (config.i18n.resource_id || 'ID') + ': ' + String(preview.resource_id),
      current_capacity: Number(preview.current_capacity),
      decrease_action: preview.decrease_action || 'detach',
      delete_has_bookings: true === preview.delete_has_bookings,
      description: config.i18n.review_capacity_help || '',
      mode: 'capacity_review',
      operation: preview.operation,
      operation_help: increase ? config.i18n.create_units_help || '' : delete_action ? config.i18n.delete_units_help || '' : config.i18n.select_detach_help || '',
      operation_label: increase ? get_capacity_count_label(config, 'create_new_unit', 'create_new_units', Number(preview.create_count)) : get_capacity_count_label(config, 'keep_existing_unit', 'keep_existing_units', Number(preview.target_capacity)),
      resources: increase ? preview.create_resources || [] : preview.detach_resources || [],
      target_capacity: Number(preview.target_capacity),
      title: config.i18n.review_capacity_title || ''
    };
    target.innerHTML = render_component(config, 'inspector_capacity', {
      i18n: config.i18n || {},
      view: view
    });
    if (!target.querySelector('[data-wpbc-catalog-resource-capacity-form]')) {
      return false;
    }
    inspector_mode = 'capacity_review';
    inspector_resource_id = Number(preview.resource_id) || 0;
    inspector_review_token = String(preview.review_token || '');
    inspector_capacity_decrease_action = preview.decrease_action || 'detach';
    inspector_dirty = true;
    set_inspector_state('form', '');
    configure_inspector_footer('wpbc_catalog_booking_resource_capacity_form', config.i18n.apply_capacity_change || '', delete_action, delete_action);
    if (delete_action) {
      var acknowledgement = target.querySelector('[data-wpbc-catalog-capacity-delete-acknowledgement]');
      pulse_delete_acknowledgement(acknowledgement ? acknowledgement.closest('.wpbc_booking_resources__delete_acknowledgement') : null);
    }
    var cancel_button = document.querySelector('[data-wpbc-ui-catalog-inspector-cancel]');
    if (cancel_button) {
      cancel_button.textContent = config.i18n.back || '';
    }
    focus_inspector_heading(target.querySelector('[data-wpbc-catalog-resource-capacity-form]'));
    return true;
  }

  /**
   * Synchronize the Resource image preview after Media Library changes.
   *
   * @param {HTMLElement} field Picture URL field.
   * @return {void}
   */
  function synchronize_inspector_image(field) {
    var field_wrap = field ? field.closest('[data-wpbc-catalog-resource-field-wrap]') : null;
    var preview = field_wrap ? field_wrap.querySelector('[data-wpbc-catalog-resource-image-preview]') : null;
    var placeholder = field_wrap ? field_wrap.querySelector('[data-wpbc-catalog-resource-image-placeholder]') : null;
    var remove_button = field_wrap ? field_wrap.querySelector('[data-wpbc-catalog-resource-remove-image]') : null;
    var picture_url = field ? String(field.value || '').trim() : '';
    if (preview) {
      preview.src = picture_url;
      preview.hidden = !picture_url;
    }
    if (placeholder) {
      placeholder.hidden = !!picture_url;
    }
    if (remove_button) {
      remove_button.disabled = !picture_url;
    }
  }

  /**
   * Synchronize one numeric slider with its precise number field.
   *
   * Suggested slider bounds remain convenient for ordinary values. Price keeps
   * its product-defined 0-1000 slider while the authoritative number field can
   * still preserve a legacy price above 1000. Other numeric controls can expand
   * to represent stored values outside their suggested range.
   *
   * @param {string} field_key Numeric inspector field key.
   * @return {void}
   */
  function synchronize_inspector_numeric_range(field_key) {
    var number_field = document.querySelector('[data-wpbc-catalog-resource-field="' + field_key + '"][type="number"]');
    var range = document.querySelector('[data-wpbc-catalog-resource-range="' + field_key + '"]');
    var number_value;
    var default_min;
    var default_max;
    var hard_min;
    var hard_max;
    var range_min;
    var range_max;
    if (!number_field || !range) {
      return;
    }
    number_value = Number(number_field.value);
    if (!isFinite(number_value)) {
      return;
    }
    default_min = Number(range.getAttribute('data-wpbc-catalog-resource-range-default-min'));
    default_max = Number(range.getAttribute('data-wpbc-catalog-resource-range-default-max'));
    hard_min = '' === String(number_field.getAttribute('min') || '') ? null : Number(number_field.getAttribute('min'));
    hard_max = '' === String(number_field.getAttribute('max') || '') ? null : Number(number_field.getAttribute('max'));
    if ('base_cost' === field_key) {
      range_min = isFinite(default_min) ? default_min : 0;
      range_max = isFinite(default_max) ? default_max : 1000;
    } else {
      range_min = null !== hard_min && isFinite(hard_min) ? hard_min : Math.min(isFinite(default_min) ? default_min : number_value, number_value);
      range_max = null !== hard_max && isFinite(hard_max) ? hard_max : Math.max(isFinite(default_max) ? default_max : number_value, number_value);
    }
    range.min = String(range_min);
    range.max = String(range_max);
    range.value = String(number_value);
  }

  /**
   * Synchronize every rendered inspector numeric slider.
   *
   * @return {void}
   */
  function synchronize_all_inspector_numeric_ranges() {
    document.querySelectorAll('[data-wpbc-catalog-resource-range]').forEach(function (range) {
      synchronize_inspector_numeric_range(range.getAttribute('data-wpbc-catalog-resource-range') || '');
    });
  }

  /**
   * Copy a slider value into its authoritative number field.
   *
   * The number field remains the only serialized control and emits one native
   * input event so validation and dirty-state behavior stay centralized.
   *
   * @param {HTMLElement} range Numeric range control.
   * @return {void}
   */
  function synchronize_inspector_number_from_range(range) {
    var field_key = range ? range.getAttribute('data-wpbc-catalog-resource-range') || '' : '';
    var number_field = field_key ? document.querySelector('[data-wpbc-catalog-resource-field="' + field_key + '"][type="number"]') : null;
    if (!number_field) {
      return;
    }
    number_field.value = range.value;
    number_field.dispatchEvent(new Event('input', {
      bubbles: true
    }));
  }

  /**
   * Confirm that a form submit originated from the inspector save action.
   *
   * WordPress Media Library controls may temporarily coexist with the sidebar
   * form. Rejecting their submitters prevents an image insertion from starting
   * a Resource mutation. The active inspector field fallback preserves native
   * Enter-key submission in browsers without SubmitEvent.submitter support.
   *
   * @param {SubmitEvent} event Form submission.
   * @param {HTMLElement} form  Active inspector form.
   * @return {boolean} True only for an intentional inspector submission.
   */
  function is_expected_inspector_submit(event, form) {
    var submitter = event.submitter || document.activeElement;
    if (submitter && submitter.matches && submitter.matches('[data-wpbc-ui-catalog-inspector-save]')) {
      return true;
    }
    return !event.submitter && submitter && form.contains(submitter) && submitter.matches && submitter.matches('input:not([type="button"]):not([type="submit"]), select');
  }

  /**
   * Report inspector validity without rejecting an existing decimal price.
   *
   * Price controls intentionally use a one-unit spinner step. Existing prices
   * may still contain decimals, so their step constraint is relaxed only while
   * native form validity is evaluated. Server-side price validation remains the
   * authoritative boundary.
   *
   * @param {HTMLFormElement} form Inspector form.
   * @return {boolean} True when the form passes native validity checks.
   */
  function report_inspector_validity(form) {
    var price_fields = form.querySelectorAll('[data-wpbc-catalog-resource-field="base_cost"], [data-wpbc-catalog-resource-bulk-value="base_cost"]');
    var price_steps = [];
    var is_valid;
    price_fields.forEach(function (price_field) {
      price_steps.push({
        field: price_field,
        step: price_field.getAttribute('step')
      });
      price_field.setAttribute('step', 'any');
    });
    is_valid = form.reportValidity();
    price_steps.forEach(function (price_step) {
      if (null === price_step.step) {
        price_step.field.removeAttribute('step');
      } else {
        price_step.field.setAttribute('step', price_step.step);
      }
    });
    return is_valid;
  }

  /**
   * Save the active inspector through its independent mutation endpoint.
   *
   * @param {SubmitEvent} event Form submission.
   * @param {Object}      config Catalog configuration.
   * @return {void}
   */
  function submit_inspector(event, config) {
    var form = event.target;
    var save_button = document.querySelector('[data-wpbc-ui-catalog-inspector-save]');
    var cancel_button = document.querySelector('[data-wpbc-ui-catalog-inspector-cancel]');
    var mutation_request_sequence;
    var fields;
    var action;
    var submitted_mode;
    var request_values;
    var control_disabled_states = [];
    var success_message;
    var success_message_is_global;
    var submitted_form_is_active;
    event.preventDefault();
    if (!is_expected_inspector_submit(event, form) || save_button && save_button.classList.contains('is-busy') || !report_inspector_validity(form)) {
      return;
    }
    mutation_request_sequence = ++inspector_mutation_request_sequence;
    inspector_mutation_in_progress = true;
    fields = JSON.parse(serialize_inspector_fields() || '{}');
    action = 'create' === inspector_mode ? config.inspector_create_action : config.inspector_update_action;
    submitted_mode = inspector_mode;
    request_values = {
      fields: JSON.stringify(fields)
    };
    if ('edit' === inspector_mode) {
      request_values.resource_id = inspector_resource_id;
    }
    if (save_button) {
      save_button.disabled = true;
      save_button.classList.add('is-busy');
    }
    if (cancel_button) {
      cancel_button.disabled = true;
    }
    form.classList.add('is-saving');
    form.setAttribute('aria-busy', 'true');
    form.querySelectorAll('input, select, textarea, button').forEach(function (control) {
      control_disabled_states.push({
        control: control,
        disabled: control.disabled
      });
      control.disabled = true;
    });
    request_inspector(config, action, request_values).then(function (response) {
      if (mutation_request_sequence !== inspector_mutation_request_sequence) {
        return;
      }
      if (!response || true !== response.success || !response.data) {
        throw new Error(get_inspector_response_message(response, config.i18n.inspector_save_failed));
      }
      pending_highlight_ids = Array.isArray(response.data.resource_ids) ? response.data.resource_ids.map(String) : [];
      inspector_dirty = false;
      success_message = get_inspector_response_message(response, '');
      success_message_is_global = show_admin_message(success_message, 'success', 3000);
      submitted_form_is_active = document.documentElement.contains(form);
      if ('create' === submitted_mode) {
        inspector_mutation_in_progress = false;
        if (submitted_form_is_active) {
          close_inspector(config, false);
        }
        if (catalog_controller) {
          catalog_controller.load({
            page_number: 1
          });
        }
        return;
      }
      if (!submitted_form_is_active) {
        if (catalog_controller) {
          catalog_controller.load();
        }
        inspector_mutation_in_progress = false;
        return;
      }
      if (response.data.schema && render_inspector_schema(config, response.data.schema, false)) {
        form = document.querySelector('[data-wpbc-catalog-resource-inspector-form]');
        show_inspector_message(form, success_message_is_global ? '' : success_message, false);
      } else {
        form.classList.remove('is-saving');
        form.removeAttribute('aria-busy');
        control_disabled_states.forEach(function (control_state) {
          if (document.documentElement.contains(control_state.control)) {
            control_state.control.disabled = control_state.disabled;
          }
        });
        if (save_button) {
          save_button.classList.remove('is-busy');
        }
        if (cancel_button) {
          cancel_button.disabled = false;
        }
        inspector_original_fields = serialize_inspector_fields();
        synchronize_inspector_dirty_state();
        show_inspector_message(form, success_message_is_global ? '' : success_message, false);
      }
      if (catalog_controller) {
        catalog_controller.load();
      }
      inspector_mutation_in_progress = false;
    }).catch(function (error) {
      if (mutation_request_sequence !== inspector_mutation_request_sequence) {
        return;
      }
      inspector_mutation_in_progress = false;
      var message = error && error.message ? error.message : config.i18n.inspector_save_failed || '';
      if (!document.documentElement.contains(form)) {
        show_admin_message(message, 'error', 5000);
        return;
      }
      form.classList.remove('is-saving');
      form.removeAttribute('aria-busy');
      show_inspector_message(form, message, true);
      control_disabled_states.forEach(function (control_state) {
        if (document.documentElement.contains(control_state.control)) {
          control_state.control.disabled = control_state.disabled;
        }
      });
      if (save_button) {
        save_button.classList.remove('is-busy');
      }
      if (cancel_button) {
        cancel_button.disabled = false;
      }
      synchronize_inspector_dirty_state();
    });
  }

  /**
   * Submit bulk, permanent-delete, and capacity review inspector states.
   *
   * Mutations remain impossible from selection alone: bulk editing requires a
   * signed preview, and deletion additionally requires explicit acknowledgement.
   *
   * @param {SubmitEvent} event  Inspector form submission.
   * @param {Object}      config Catalog configuration.
   * @return {void}
   */
  function submit_reviewed_inspector(event, config) {
    var form = event.target;
    var save_button = document.querySelector('[data-wpbc-ui-catalog-inspector-save]');
    var cancel_button = document.querySelector('[data-wpbc-ui-catalog-inspector-cancel]');
    var request_sequence;
    var action;
    var values;
    var fallback;
    var is_mutation;
    var submitted_mode;
    var submitted_resource_ids;
    var submitted_tracks_selection;
    event.preventDefault();
    if (inspector_selection_stale || !is_expected_inspector_submit(event, form) || save_button && (save_button.disabled || save_button.classList.contains('is-busy')) || !report_inspector_validity(form)) {
      return;
    }
    submitted_mode = inspector_mode;
    submitted_resource_ids = inspector_resource_ids.slice();
    submitted_tracks_selection = inspector_tracks_selection;
    if ('bulk_edit' === submitted_mode) {
      inspector_bulk_operations = collect_bulk_operations();
      action = config.bulk_preview_action;
      values = {
        resource_ids: JSON.stringify(inspector_resource_ids),
        operations: JSON.stringify(inspector_bulk_operations)
      };
      fallback = config.i18n.bulk_review_failed;
    } else if ('bulk_review' === submitted_mode) {
      action = config.bulk_apply_action;
      values = {
        resource_ids: JSON.stringify(inspector_resource_ids),
        operations: JSON.stringify(inspector_bulk_operations),
        review_token: inspector_review_token
      };
      fallback = config.i18n.bulk_apply_failed;
    } else if ('delete_review' === submitted_mode) {
      action = config.delete_apply_action;
      values = {
        acknowledged: '1',
        resource_ids: JSON.stringify(inspector_resource_ids),
        review_token: inspector_review_token
      };
      fallback = config.i18n.delete_apply_failed;
    } else if ('capacity' === submitted_mode) {
      action = config.capacity_preview_action;
      values = {
        resource_id: inspector_resource_id,
        target_capacity: inspector_capacity_target,
        detach_resource_ids: JSON.stringify(inspector_capacity_detach_ids),
        decrease_action: inspector_capacity_decrease_action
      };
      fallback = config.i18n.capacity_review_failed;
    } else if ('capacity_review' === submitted_mode) {
      action = config.capacity_apply_action;
      var capacity_acknowledgement = form.querySelector('[data-wpbc-catalog-capacity-delete-acknowledgement]');
      values = {
        resource_id: inspector_resource_id,
        target_capacity: inspector_capacity_target,
        detach_resource_ids: JSON.stringify(inspector_capacity_detach_ids),
        decrease_action: inspector_capacity_decrease_action,
        acknowledged: capacity_acknowledgement && capacity_acknowledgement.checked ? '1' : '0',
        review_token: inspector_review_token
      };
      fallback = config.i18n.capacity_apply_failed;
    } else {
      return;
    }
    is_mutation = 'bulk_review' === submitted_mode || 'delete_review' === submitted_mode || 'capacity_review' === submitted_mode;
    request_sequence = is_mutation ? ++inspector_mutation_request_sequence : ++inspector_request_sequence;
    if (is_mutation) {
      inspector_mutation_in_progress = true;
    }
    if ('bulk_review' === submitted_mode && get_inline_review_workflow()) {
      get_inline_review_workflow().synchronize({
        busy: true,
        can_apply: true
      });
    }
    if ('delete_review' === submitted_mode && get_delete_review_workflow()) {
      get_delete_review_workflow().synchronize({
        busy: true,
        can_apply: true
      });
    }
    if (save_button) {
      save_button.disabled = true;
      save_button.classList.add('is-busy');
    }
    if (cancel_button) {
      cancel_button.disabled = true;
    }
    form.classList.add('is-saving');
    form.setAttribute('aria-busy', 'true');
    request_inspector(config, action, values).then(function (response) {
      if (request_sequence !== (is_mutation ? inspector_mutation_request_sequence : inspector_request_sequence)) {
        return;
      }
      if (!response || true !== response.success || !response.data) {
        throw new Error(get_inspector_response_message(response, fallback));
      }
      if ('bulk_edit' === submitted_mode) {
        if (!response.data.preview || !render_bulk_review(config, response.data.preview)) {
          throw new Error(fallback || '');
        }
        return;
      }
      if ('capacity' === submitted_mode) {
        if (!response.data.preview || !render_capacity_review(config, response.data.preview)) {
          throw new Error(fallback || '');
        }
        return;
      }
      if ('bulk_review' === submitted_mode) {
        pending_highlight_ids = Array.isArray(response.data.updated_ids) ? response.data.updated_ids.map(String) : [];
      } else if ('capacity_review' === submitted_mode) {
        pending_highlight_ids = Array.isArray(response.data.affected_ids) ? response.data.affected_ids.map(String) : [];
      } else {
        var mount = document.getElementById(config.mount_id);
        var selection = mount && mount._wpbc_ui_catalog_selection_controller;
        var selected_resource_ids = get_selected_resource_ids(config);
        var deleted_selected_resource = submitted_resource_ids.some(function (resource_id) {
          return -1 !== selected_resource_ids.indexOf(Number(resource_id));
        });
        if (selection && 'function' === typeof selection.clear && (submitted_tracks_selection || deleted_selected_resource)) {
          selection.clear();
        }
      }
      show_admin_message(get_inspector_response_message(response, ''), 'success', 4000);
      inspector_dirty = false;
      inspector_mutation_in_progress = false;
      if (document.documentElement.contains(form)) {
        close_inspector(config, false);
      }
      if (catalog_controller) {
        catalog_controller.load();
      }
    }).catch(function (error) {
      if (request_sequence !== (is_mutation ? inspector_mutation_request_sequence : inspector_request_sequence)) {
        return;
      }
      if (is_mutation) {
        inspector_mutation_in_progress = false;
      }
      if (!document.documentElement.contains(form)) {
        show_admin_message(error && error.message ? error.message : fallback || '', 'error', 5000);
        return;
      }
      form.classList.remove('is-saving');
      form.removeAttribute('aria-busy');
      show_inspector_message(form, error && error.message ? error.message : fallback || '', true);
      if (save_button) {
        save_button.classList.remove('is-busy');
        save_button.disabled = inspector_selection_stale || 'delete_review' === inspector_mode && !form.querySelector('[data-wpbc-catalog-resource-delete-acknowledgement]:checked');
      }
      if (cancel_button) {
        cancel_button.disabled = false;
      }
      if ('bulk_review' === submitted_mode && get_inline_review_workflow()) {
        get_inline_review_workflow().synchronize({
          busy: false,
          can_apply: !inspector_selection_stale
        });
      }
      if ('delete_review' === submitted_mode && get_delete_review_workflow()) {
        get_delete_review_workflow().synchronize({
          busy: false,
          can_apply: !inspector_selection_stale
        });
      }
    });
  }

  /**
   * Invalidate an open selection-owned inspector when its selection changes.
   *
   * @param {CustomEvent} event  Shared selection lifecycle event.
   * @param {Object}      config Catalog configuration.
   * @return {void}
   */
  function handle_inspector_selection_change(event, config) {
    var selected_ids = event && event.detail && Array.isArray(event.detail.selected_ids) ? event.detail.selected_ids : get_selected_resource_ids(config);
    var form;
    var save_button;
    if (!inspector_tracks_selection || -1 === ['bulk_edit', 'bulk_review', 'delete_review'].indexOf(inspector_mode)) {
      return;
    }
    form = document.querySelector('[data-wpbc-catalog-resource-bulk-form], [data-wpbc-catalog-resource-bulk-review-form], [data-wpbc-catalog-resource-delete-form]');
    save_button = document.querySelector('[data-wpbc-ui-catalog-inspector-save]');
    if (resource_id_lists_match(inspector_resource_ids, selected_ids)) {
      if (!inspector_selection_stale) {
        return;
      }
      inspector_selection_stale = false;
      show_inspector_message(form, '', false);
      if ('delete_review' === inspector_mode && get_delete_review_workflow()) {
        get_delete_review_workflow().synchronize({
          busy: false,
          can_apply: true
        });
      }
      if ('bulk_edit' === inspector_mode) {
        synchronize_bulk_editor(null);
      } else if (save_button) {
        var acknowledgement = form ? form.querySelector('[data-wpbc-catalog-resource-delete-acknowledgement]') : null;
        save_button.disabled = 'delete_review' === inspector_mode && (!acknowledgement || !acknowledgement.checked);
      }
      return;
    }
    inspector_selection_stale = true;
    show_inspector_message(form, config.i18n.selection_changed || '', true);
    if ('delete_review' === inspector_mode && get_delete_review_workflow()) {
      get_delete_review_workflow().synchronize({
        busy: false,
        can_apply: false
      });
    }
    if (save_button) {
      save_button.disabled = true;
    }
  }

  /**
   * Apply the post-mutation highlight after an AJAX catalog refresh.
   *
   * @return {void}
   */
  function apply_pending_highlights() {
    var first_row = null;
    pending_highlight_ids.forEach(function (resource_id) {
      var row = document.querySelector('[data-wpbc-booking-resource-id="' + resource_id + '"]');
      if (row) {
        row.classList.add('is-recently-saved');
        first_row = first_row || row;
      }
    });
    if (first_row) {
      first_row.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
    window.setTimeout(function () {
      document.querySelectorAll('.wpbc_booking_resources__item.is-recently-saved').forEach(function (row) {
        row.classList.remove('is-recently-saved');
      });
    }, 5000);
    pending_highlight_ids = [];
  }

  /**
   * Handle completed shared renders for this Resource catalog only.
   *
   * @param {CustomEvent} event Shared catalog lifecycle event.
   * @return {void}
   */
  function handle_catalog_rendered(event) {
    var config = window.wpbc_catalog_booking_resources_config;
    var event_detail = event && event.detail ? event.detail : {};
    if (!config || event_detail.catalog_id !== config.id || !event_detail.response) {
      return;
    }
    catalog_response = event_detail.response;
    synchronize_booking_resources_toolbar(config, catalog_response);
    render_booking_resources_response(config, catalog_response);
    render_inline_bar(config);
    synchronize_inline_controls(config);
    if (inspector_resource_id) {
      mark_inspector_resource_row(inspector_resource_id);
    }
    apply_pending_highlights();
  }

  /**
   * Request a selected pagination page through the shared controller.
   *
   * @param {MouseEvent} event Catalog click event.
   * @return {void}
   */
  function handle_catalog_click(event) {
    var action_button = event.target.closest('[data-wpbc-booking-resource-action]');
    var action_details;
    var catalog_mount;
    var config = window.wpbc_catalog_booking_resources_config;
    var page_button = event.target.closest('[data-wpbc-ui-catalog-page]');
    var resource_action_event;
    if (inline_state.active && action_button) {
      event.preventDefault();
      return;
    }
    if (page_button && !page_button.disabled) {
      pending_focus_direction = page_button.getAttribute('data-wpbc-ui-catalog-page-direction') || 'page';
    }
    if (!action_button || !config) {
      return;
    }
    var action_id = action_button.getAttribute('data-wpbc-booking-resource-action') || '';
    if ('toggle_details' === action_id) {
      var resource_id = Number(action_button.getAttribute('data-wpbc-booking-resource-id') || 0);
      var resource_row = get_resource_item_container(action_button);
      event.preventDefault();
      if (resource_id && resource_row && config.details_action) {
        if (resource_id === details_resource_id) {
          close_details_row(true);
        } else {
          open_details_row(config, action_button, resource_row, resource_id);
        }
      }
      return;
    }
    if ('copy_details_value' === action_id) {
      event.preventDefault();
      copy_details_value(action_button.getAttribute('data-wpbc-booking-resource-copy-value') || '', action_button, config);
      return;
    }
    action_details = action_button.closest('details');
    if (action_details) {
      action_details.removeAttribute('open');
    }
    catalog_mount = document.getElementById(config.mount_id);
    if (catalog_mount) {
      if ('function' === typeof window.CustomEvent) {
        resource_action_event = new window.CustomEvent('wpbc:booking-resource-action', {
          bubbles: true,
          detail: {
            action: action_button.getAttribute('data-wpbc-booking-resource-action') || '',
            resource_id: Number(action_button.getAttribute('data-wpbc-booking-resource-id') || 0)
          }
        });
      } else {
        resource_action_event = document.createEvent('CustomEvent');
        resource_action_event.initCustomEvent('wpbc:booking-resource-action', true, false, {
          action: action_button.getAttribute('data-wpbc-booking-resource-action') || '',
          resource_id: Number(action_button.getAttribute('data-wpbc-booking-resource-id') || 0)
        });
      }
      catalog_mount.dispatchEvent(resource_action_event);
    }
  }

  /**
   * Close expanded details with Escape and restore disclosure focus.
   *
   * @param {KeyboardEvent} event Catalog keyboard event.
   * @return {void}
   */
  function handle_catalog_keydown(event) {
    var config = window.wpbc_catalog_booking_resources_config;
    if ('Escape' === event.key && inline_state.active && 'inline_review' !== inspector_mode) {
      synchronize_inline_drafts(config);
      if (!inline_state.changed_rows.length || window.confirm(config.i18n.inline_discard || '')) {
        event.preventDefault();
        leave_inline_mode(config, true, '');
      }
      return;
    }
    if ('Escape' === event.key && event.target.closest('[data-wpbc-booking-resource-details-row]')) {
      event.preventDefault();
      close_details_row(true);
    }
  }

  /**
   * Block Booking Resource image changes in public demo installations.
   *
   * This capture-phase guard runs before the shared delegated media-uploader
   * handler, preventing the WordPress media modal from opening. Server-side
   * create validation independently rejects a forged picture URL.
   *
   * @param {MouseEvent} event  Browser click event.
   * @param {Object}     config Catalog configuration.
   * @return {void}
   */
  function protect_demo_resource_image_change(event, config) {
    var media_button;
    var inspector_form;
    var message;
    var message_title;
    if (!config || !is_true_flag(config.is_demo) || !event.target || 'function' !== typeof event.target.closest) {
      return;
    }
    media_button = event.target.closest('.wpbc_media_upload_button, [data-wpbc-catalog-resource-remove-image]');
    inspector_form = media_button ? media_button.closest('[data-wpbc-catalog-resource-inspector-form]') : null;
    if (!media_button || !inspector_form) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if ('function' === typeof event.stopImmediatePropagation) {
      event.stopImmediatePropagation();
    }
    message = config.i18n && config.i18n.demo_image_change_unavailable ? config.i18n.demo_image_change_unavailable : '';
    message_title = config.i18n && config.i18n.demo_image_change_unavailable_title ? config.i18n.demo_image_change_unavailable_title : '';
    open_booking_resource_message_dialog(message, message_title, media_button);
  }

  /**
   * Mount the localized catalog configuration after the document is ready.
   *
   * @return {void}
   */
  function mount_booking_resources_catalog() {
    var config = window.wpbc_catalog_booking_resources_config;
    var mount_element;
    if (!config || !window.wpbc_ui_catalog || 'function' !== typeof window.wpbc_ui_catalog.mount) {
      return;
    }
    mount_element = document.getElementById(config.mount_id);
    if (!mount_element) {
      return;
    }
    mount_element.addEventListener('wpbc:ui-catalog-rendered', handle_catalog_rendered);
    mount_element.addEventListener('wpbc:ui-catalog-before-render', function () {
      close_details_row(false);
    });
    mount_element.addEventListener('wpbc:ui-catalog-hierarchy-change', function () {
      close_details_row(false);
      synchronize_card_group_panels(mount_element);
    });
    mount_element.addEventListener('wpbc:ui-catalog-selection-change', function (event) {
      handle_inspector_selection_change(event, config);
    });
    mount_element.addEventListener('wpbc:ui-catalog-selection-restored', function (event) {
      handle_inspector_selection_change(event, config);
    });
    mount_element.addEventListener('click', protect_inline_drafts_from_catalog_controls, true);
    mount_element.addEventListener('change', protect_inline_drafts_from_catalog_controls, true);
    mount_element.addEventListener('input', protect_inline_drafts_from_catalog_controls, true);
    mount_element.addEventListener('click', handle_catalog_click);
    mount_element.addEventListener('keydown', handle_catalog_keydown);
    window.addEventListener('resize', function () {
      synchronize_overflow_tooltips(mount_element);
    });
    catalog_controller = window.wpbc_ui_catalog.mount(config);
    if (catalog_controller) {
      if ('function' === typeof window.wpbc_ui_catalog.create_inline_editing_workflow) {
        inline_workflow_controller = window.wpbc_ui_catalog.create_inline_editing_workflow(mount_element, {
          bar_selector: '[data-wpbc-catalog-inline-bar]',
          cancel_selector: '[data-wpbc-catalog-inline-cancel]',
          controls_root: document,
          count_selector: '[data-wpbc-catalog-inline-count]',
          page_element: mount_element.matches('.wpbc_booking_resources_page') ? mount_element : mount_element.querySelector('.wpbc_booking_resources_page'),
          protected_selector: '[data-wpbc-catalog-booking-resource-create]',
          review_selector: '[data-wpbc-catalog-inline-review]',
          toggle_label_selector: '[data-wpbc-catalog-inline-toggle-label]',
          toggle_selector: '[data-wpbc-catalog-inline-toggle]'
        });
      }
      render_booking_resources_filters(config);
      render_booking_resources_toolbar(config);
      render_inline_bar(config);
      synchronize_inline_controls(config);
      mount_inspector_shell(config);
    }
    if ('function' === typeof window.wpbc_define_tippy_tooltips) {
      window.wpbc_define_tippy_tooltips('[data-wpbc-catalog-booking-resource-upgrade]');
    }
    document.addEventListener('wpbc:booking-resource-action', function (event) {
      var detail = event && event.detail ? event.detail : {};
      if ('edit_resource' === detail.action) {
        open_inspector(config, 'edit', Number(detail.resource_id) || 0, document.activeElement);
      } else if ('publish_resource' === detail.action) {
        open_inspector(config, 'edit', Number(detail.resource_id) || 0, document.activeElement, 'shortcode_publishing');
      } else if ('adjust_capacity' === detail.action) {
        open_capacity_editor(config, Number(detail.resource_id) || 0, document.activeElement);
      } else if ('delete_resource' === detail.action) {
        open_delete_review(config, [Number(detail.resource_id) || 0], document.activeElement, false);
      }
    });
    document.addEventListener('click', function (event) {
      protect_demo_resource_image_change(event, config);
    }, true);
    document.addEventListener('click', function (event) {
      var inline_toggle = event.target.closest('[data-wpbc-catalog-inline-toggle]');
      var inline_cancel = event.target.closest('[data-wpbc-catalog-inline-cancel]');
      var inline_review = event.target.closest('[data-wpbc-catalog-inline-review]');
      var create_button = event.target.closest('[data-wpbc-catalog-booking-resource-create]');
      var upgrade_button = event.target.closest('[data-wpbc-catalog-booking-resource-upgrade]');
      var cancel_button = event.target.closest('[data-wpbc-ui-catalog-inspector-cancel]');
      var remove_image_button = event.target.closest('[data-wpbc-catalog-resource-remove-image]');
      var shortcode_button = event.target.closest('[data-wpbc-booking-resource-shortcode-command]');
      var resource_row = get_resource_item_container(event.target);
      var selection_action = event.target.closest('[data-wpbc-catalog-selection-action]');
      if (inline_toggle) {
        event.preventDefault();
        start_inline_mode(config);
        return;
      }
      if (inline_cancel) {
        event.preventDefault();
        synchronize_inline_drafts(config);
        if (!inline_state.changed_rows.length || window.confirm(config.i18n.inline_discard || '')) {
          leave_inline_mode(config, true, '');
        }
        return;
      }
      if (inline_review) {
        event.preventDefault();
        preview_inline_changes(config, inline_review);
        return;
      }
      if (selection_action) {
        event.preventDefault();
        if ('bulk_edit' === selection_action.getAttribute('data-wpbc-catalog-selection-action')) {
          open_bulk_editor(config, selection_action);
        } else {
          open_delete_review(config, get_selected_resource_ids(config), selection_action, true);
        }
        return;
      }
      if (shortcode_button) {
        event.preventDefault();
        var shortcode_resource_id = Number(shortcode_button.getAttribute('data-wpbc-booking-resource-id') || 0);
        var shortcode_command = shortcode_button.getAttribute('data-wpbc-booking-resource-shortcode-command') || '';
        var shortcode_value = get_booking_resource_shortcode(shortcode_resource_id, shortcode_button);
        if ('copy' === shortcode_command) {
          copy_details_value(shortcode_value, shortcode_button, config);
        } else if ('customize' === shortcode_command) {
          customize_booking_resource_shortcode(shortcode_resource_id, shortcode_value);
        } else if ('publish' === shortcode_command) {
          publish_booking_resource_shortcode(shortcode_resource_id, shortcode_value, shortcode_button);
        }
        return;
      }
      if (create_button) {
        event.preventDefault();
        open_inspector(config, 'create', 0, create_button);
        return;
      }
      if (upgrade_button) {
        event.preventDefault();
        open_booking_resource_upgrade_dialog(upgrade_button);
        return;
      }
      if (cancel_button) {
        event.preventDefault();
        if ('inline_review' === inspector_mode) {
          inspector_dirty = false;
          close_inspector(config, false);
          inline_state.review_token = '';
          synchronize_inline_controls(config);
        } else if ('capacity_review' === inspector_mode && inspector_capacity_context) {
          var reviewed_target_capacity = inspector_capacity_target;
          var reviewed_detach_ids = inspector_capacity_detach_ids.slice();
          var reviewed_decrease_action = inspector_capacity_decrease_action;
          inspector_dirty = false;
          render_capacity_editor(config, inspector_capacity_context);
          inspector_capacity_target = reviewed_target_capacity;
          inspector_capacity_detach_ids = reviewed_detach_ids;
          inspector_capacity_decrease_action = reviewed_decrease_action;
          synchronize_capacity_editor(config);
        } else {
          close_inspector(config, true);
        }
        return;
      }
      if (remove_image_button) {
        event.preventDefault();
        var image_field = remove_image_button.closest('[data-wpbc-catalog-resource-field-wrap]').querySelector('[data-wpbc-catalog-resource-field="picture_url"]');
        if (image_field) {
          image_field.value = '';
          synchronize_inspector_image(image_field);
          synchronize_inspector_dirty_state();
        }
        return;
      }
      if (!inline_state.active && resource_row && !event.target.closest('a, button, input, select, textarea, summary, details, label')) {
        open_inspector(config, 'edit', Number(resource_row.getAttribute('data-wpbc-booking-resource-id')) || 0, resource_row);
      }
    });
    document.addEventListener('input', function (event) {
      if (event.target.matches('[data-wpbc-catalog-capacity-target], [data-wpbc-catalog-capacity-range]')) {
        var context = inspector_capacity_context || {};
        var minimum = Number(context.minimum_capacity) || 1;
        var maximum = Number(context.maximum_capacity) || minimum;
        var requested_capacity = Math.round(Number(event.target.value) || minimum);
        inspector_capacity_target = Math.max(minimum, Math.min(maximum, requested_capacity));
        synchronize_capacity_editor(config);
        return;
      }
      if (event.target.matches('[data-wpbc-catalog-inline-field]')) {
        synchronize_inline_drafts(config);
        return;
      }
      if (event.target.matches('[data-wpbc-catalog-resource-bulk-value], [data-wpbc-catalog-resource-bulk-range]')) {
        synchronize_bulk_editor(event.target);
        return;
      }
      if (event.target.matches('[data-wpbc-catalog-resource-range]')) {
        synchronize_inspector_number_from_range(event.target);
        return;
      }
      if (event.target.matches('[data-wpbc-catalog-resource-inspector-form] [data-wpbc-catalog-resource-field]')) {
        if ('picture_url' === event.target.getAttribute('data-wpbc-catalog-resource-field')) {
          synchronize_inspector_image(event.target);
        }
        if ('number' === event.target.type) {
          synchronize_inspector_numeric_range(event.target.getAttribute('data-wpbc-catalog-resource-field') || '');
        }
        synchronize_inspector_dirty_state();
      }
    });
    document.addEventListener('change', function (event) {
      if (get_delete_review_workflow() && get_delete_review_workflow().handle_change(event)) {
        return;
      }
      if (event.target.matches('[data-wpbc-catalog-capacity-decrease-action]')) {
        inspector_capacity_decrease_action = 'delete' === event.target.value ? 'delete' : 'detach';
        synchronize_capacity_editor(config);
        return;
      }
      if (event.target.matches('[data-wpbc-catalog-capacity-detach]')) {
        var detach_id = Number(event.target.value) || 0;
        if (event.target.checked) {
          if (-1 === inspector_capacity_detach_ids.indexOf(detach_id)) {
            inspector_capacity_detach_ids.push(detach_id);
          }
        } else {
          inspector_capacity_detach_ids = inspector_capacity_detach_ids.filter(function (resource_id) {
            return resource_id !== detach_id;
          });
        }
        synchronize_capacity_editor(config);
        return;
      }
      if (event.target.matches('[data-wpbc-catalog-inline-field]')) {
        synchronize_inline_drafts(config);
        return;
      }
      if (event.target.matches('[data-wpbc-catalog-resource-bulk-enable], [data-wpbc-catalog-resource-bulk-operation], [data-wpbc-catalog-resource-bulk-value], [data-wpbc-catalog-resource-bulk-range]')) {
        synchronize_bulk_editor(event.target);
        return;
      }
      if (event.target.matches('[data-wpbc-catalog-capacity-delete-acknowledgement]')) {
        var capacity_delete_button = document.querySelector('[data-wpbc-ui-catalog-inspector-save]');
        var capacity_acknowledgement = event.target.closest('.wpbc_booking_resources__delete_acknowledgement');
        if (event.target.checked && capacity_acknowledgement) {
          capacity_acknowledgement.classList.remove('wpbc_booking_resources__delete_acknowledgement--attention');
        } else {
          pulse_delete_acknowledgement(capacity_acknowledgement);
        }
        if (capacity_delete_button) {
          capacity_delete_button.disabled = !event.target.checked;
        }
        return;
      }
      if (event.target.matches('[data-wpbc-catalog-resource-range]')) {
        synchronize_inspector_number_from_range(event.target);
        return;
      }
      if (event.target.matches('[data-wpbc-catalog-resource-radio-field="creation_mode"]')) {
        synchronize_create_inspector_controls();
        synchronize_inspector_dirty_state();
        return;
      }
      if (event.target.matches('[data-wpbc-catalog-resource-inspector-form] [data-wpbc-catalog-resource-field]')) {
        if ('create' === inspector_mode) {
          synchronize_create_inspector_controls();
        }
        synchronize_inspector_dirty_state();
      }
    });
    if (window.jQuery) {
      window.jQuery('.wpbc_settings_page_wrapper').on('wpbc:right-sidebar-before-content-collapse.wpbcCatalogBookingResources', function (event) {
        var closing_mode = inspector_mode;
        if (inspector_mode && !close_inspector(config, true)) {
          event.preventDefault();
          return;
        }
        if ('inline_review' === closing_mode) {
          inline_state.review_token = '';
          synchronize_inline_controls(config);
        }
      });
      window.jQuery(document).on('wpbc_media_upload_url_set', '[data-wpbc-catalog-resource-field="picture_url"]', function () {
        synchronize_inspector_image(this);
        synchronize_inspector_dirty_state();
      });
      window.jQuery(document).on('wpbc:resource-shortcode-selected', function (event, selection) {
        var selected_resource_id = Number(selection && selection.resource_id ? selection.resource_id : 0);
        var selected_shortcode = String(selection && selection.shortcode ? selection.shortcode : '');
        var inspector_shortcode;
        if (!selected_resource_id) {
          return;
        }
        synchronize_booking_resource_shortcode_input(selected_resource_id, selected_shortcode);
        document.querySelectorAll('[data-wpbc-booking-resource-id="' + String(selected_resource_id) + '"][data-wpbc-booking-resource-shortcode-command]').forEach(function (action_button) {
          action_button.setAttribute('data-wpbc-booking-resource-shortcode', selected_shortcode);
        });
        var details_row = document.querySelector('[data-wpbc-booking-resource-details-row="' + String(selected_resource_id) + '"]');
        var details_code = details_row ? details_row.querySelector('[data-wpbc-booking-resource-details-section="booking_page"] code') : null;
        if (details_code) {
          details_code.textContent = selected_shortcode;
          details_code.setAttribute('data-wpbc-ui-catalog-overflow-tooltip', selected_shortcode);
          synchronize_overflow_tooltips(document.getElementById(config.mount_id));
        }
        if (selected_resource_id === inspector_resource_id) {
          inspector_shortcode = document.querySelector('[data-wpbc-catalog-resource-inspector-form] .wpbc_catalog_booking_resources__editor_code');
          if (inspector_shortcode) {
            inspector_shortcode.value = selected_shortcode;
            synchronize_inspector_dirty_state();
          }
        }
      });
    }
    document.addEventListener('submit', function (event) {
      if (event.target.matches('[data-wpbc-catalog-inline-review-form]')) {
        apply_inline_changes(event, config);
      } else if (event.target.matches('[data-wpbc-catalog-resource-inspector-form]')) {
        submit_inspector(event, config);
      } else if (event.target.matches('[data-wpbc-catalog-resource-bulk-form], [data-wpbc-catalog-resource-bulk-review-form], [data-wpbc-catalog-resource-delete-form], [data-wpbc-catalog-resource-capacity-form]')) {
        submit_reviewed_inspector(event, config);
      }
    });
    window.addEventListener('beforeunload', function (event) {
      if (inspector_dirty || inspector_mutation_in_progress || inline_state.active && inline_state.changed_rows.length) {
        event.preventDefault();
        event.returnValue = '';
      }
    });
  }
  if ('loading' === document.readyState) {
    document.addEventListener('DOMContentLoaded', mount_booking_resources_catalog);
  } else {
    mount_booking_resources_catalog();
  }
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1jYXRhbG9nLWJvb2tpbmctcmVzb3VyY2VzL19vdXQvYm9va2luZ19yZXNvdXJjZXNfY2F0YWxvZy5qcyIsIm5hbWVzIjpbIndpbmRvdyIsImRvY3VtZW50IiwiY2F0YWxvZ19jb250cm9sbGVyIiwiaW5saW5lX3dvcmtmbG93X2NvbnRyb2xsZXIiLCJpbmxpbmVfcmV2aWV3X3dvcmtmbG93X2NvbnRyb2xsZXIiLCJkZWxldGVfcmV2aWV3X3dvcmtmbG93X2NvbnRyb2xsZXIiLCJpbnNwZWN0b3Jfd29ya2Zsb3dfY29udHJvbGxlciIsImNhdGFsb2dfcmVzcG9uc2UiLCJkZXRhaWxzX2Fib3J0X2NvbnRyb2xsZXIiLCJkZXRhaWxzX3JlcXVlc3Rfc2VxdWVuY2UiLCJkZXRhaWxzX3Jlc291cmNlX2lkIiwiZGV0YWlsc190b2dnbGVfYnV0dG9uIiwicGVuZGluZ19mb2N1c19kaXJlY3Rpb24iLCJpbnNwZWN0b3JfZGlydHkiLCJpbnNwZWN0b3JfZm9jdXNfdGFyZ2V0IiwiaW5zcGVjdG9yX21vZGUiLCJpbnNwZWN0b3JfbXV0YXRpb25faW5fcHJvZ3Jlc3MiLCJpbnNwZWN0b3JfbXV0YXRpb25fcmVxdWVzdF9zZXF1ZW5jZSIsImluc3BlY3Rvcl9vcmlnaW5hbF9maWVsZHMiLCJpbnNwZWN0b3JfcmVxdWVzdF9zZXF1ZW5jZSIsImluc3BlY3Rvcl9yZXNvdXJjZV9pZCIsImluc3BlY3Rvcl9yZXNvdXJjZV9pZHMiLCJpbnNwZWN0b3JfYnVsa19vcGVyYXRpb25zIiwiaW5zcGVjdG9yX3Jldmlld190b2tlbiIsImluc3BlY3Rvcl9zZWxlY3Rpb25fc3RhbGUiLCJpbnNwZWN0b3JfdHJhY2tzX3NlbGVjdGlvbiIsImluc3BlY3Rvcl9jYXBhY2l0eV9jb250ZXh0IiwiaW5zcGVjdG9yX2NhcGFjaXR5X2RldGFjaF9pZHMiLCJpbnNwZWN0b3JfY2FwYWNpdHlfZGVjcmVhc2VfYWN0aW9uIiwiaW5zcGVjdG9yX2NhcGFjaXR5X3RhcmdldCIsInBlbmRpbmdfaGlnaGxpZ2h0X2lkcyIsImlubGluZV9zdGF0ZSIsImFjdGl2ZSIsImNoYW5nZWRfcm93cyIsImxvYWRpbmciLCJyZXF1ZXN0X3NlcXVlbmNlIiwicmV2aWV3X3Rva2VuIiwiaXNfdHJ1ZV9mbGFnIiwiZmxhZ192YWx1ZSIsIlN0cmluZyIsInRvTG93ZXJDYXNlIiwiZm9ybWF0X21lc3NhZ2UiLCJ0ZW1wbGF0ZSIsInZhbHVlcyIsIm1lc3NhZ2UiLCJmb3JFYWNoIiwicmVwbGFjZW1lbnQiLCJyZXBsYWNlbWVudF9pbmRleCIsInBsYWNlaG9sZGVyIiwiUmVnRXhwIiwicmVwbGFjZSIsImdldF9pbmxpbmVfcmV2aWV3X3dvcmtmbG93Iiwid3BiY191aV9jYXRhbG9nIiwiY3JlYXRlX2lubGluZV9yZXZpZXdfd29ya2Zsb3ciLCJhcHBseV9zZWxlY3RvciIsImNhbmNlbF9zZWxlY3RvciIsInJvb3QiLCJnZXRfZGVsZXRlX3Jldmlld193b3JrZmxvdyIsImNyZWF0ZV9kZWxldGVfcmV2aWV3X3dvcmtmbG93IiwiYWNrbm93bGVkZ2VtZW50X3NlbGVjdG9yIiwiZ2V0X2NoaWxkcmVuX3N1bW1hcnlfbGFiZWwiLCJwYXJlbnRfcmVzb3VyY2UiLCJpMThuIiwiaGllcmFyY2h5Iiwic2VydmVyX2xhYmVsIiwiY2hpbGRyZW5fbGFiZWwiLCJ0cmltIiwiY2hpbGRfY291bnQiLCJNYXRoIiwibWF4IiwiTnVtYmVyIiwicmVuZGVyZWRfY2hpbGRyZW5fY291bnQiLCJsYWJlbF90ZW1wbGF0ZSIsImNoaWxkX2NvdW50X3Npbmd1bGFyIiwiY2hpbGRfY291bnRfcGx1cmFsIiwicmVuZGVyX2NvbXBvbmVudCIsImNvbmZpZyIsInRlbXBsYXRlX3JvbGUiLCJ0ZW1wbGF0ZV9kYXRhIiwiY29tcG9uZW50X3RlbXBsYXRlIiwibG9hZF90ZW1wbGF0ZSIsImVycm9yIiwiZ2V0X2NvbHVtbnMiLCJkaXNwbGF5X3N0YXRlIiwidmlzaWJsZV9vbmx5Iiwic29ydGluZ19zdGF0ZSIsImNvbHVtbl9jb25maWciLCJjb2x1bW5zIiwiZGVmaW5pdGlvbnMiLCJkZWZhdWx0X29yZGVyIiwiQXJyYXkiLCJpc0FycmF5Iiwib3JkZXIiLCJjb2x1bW5fb3JkZXIiLCJzbGljZSIsInZpc2libGVfY29sdW1ucyIsImRlZmF1bHRfdmlzaWJsZSIsImNvbHVtbl9pZCIsImluZGV4T2YiLCJwdXNoIiwiZmlsdGVyIiwibWFwIiwiY29sdW1uX2luZGV4IiwiZGVmaW5pdGlvbiIsImlzX3NvcnRlZCIsInNvcnRfa2V5Iiwic29ydF9ieSIsImFyaWFfc29ydCIsInNvcnRfb3JkZXIiLCJjbGFzc19uYW1lIiwiY2xhc3MiLCJkZWZhdWx0X2luZGV4IiwiaWQiLCJsYWJlbCIsIm1vdmVfbGFiZWwiLCJtb3ZlX2NvbHVtbiIsInJlb3JkZXJhYmxlIiwicmVxdWlyZWQiLCJzb3J0X2ljb24iLCJ2aXNpYmxlIiwiZ2V0X2FjdGl2ZV92aWV3Iiwidmlld19kZWZpbml0aW9ucyIsInZpZXdzIiwiY3VycmVudF92aXNpYmxlIiwibWF0Y2hpbmdfdmlldyIsIk9iamVjdCIsImtleXMiLCJzb21lIiwidmlld19pZCIsInZpZXdfZmllbGRzIiwiZmllbGRzIiwiSlNPTiIsInN0cmluZ2lmeSIsImdldF92aWV3X2RlZmluaXRpb25zIiwiZ2V0X3RlbXBsYXRlX3BhY2tfZGVmaW5pdGlvbnMiLCJsYWJlbHMiLCJjYXJkcyIsImxheW91dF9jYXJkcyIsImNvbXBhY3QiLCJsYXlvdXRfY29tcGFjdCIsInRhYmxlIiwibGF5b3V0X3RhYmxlIiwidGVtcGxhdGVfcGFja3MiLCJ0ZW1wbGF0ZV9wYWNrX2lkIiwicmVuZGVyX2Jvb2tpbmdfcmVzb3VyY2VzX2ZpbHRlcnMiLCJpbml0aWFsX3JlcXVlc3QiLCJtb3VudF9lbGVtZW50IiwiZ2V0RWxlbWVudEJ5SWQiLCJtb3VudF9pZCIsImZpbHRlcnNfdGFyZ2V0IiwicXVlcnlTZWxlY3RvciIsImlubmVySFRNTCIsInJlc291cmNlX3R5cGUiLCJzZWFyY2giLCJzaG93X2ZpbHRlcnMiLCJmZWF0dXJlcyIsInJlc291cmNlX2ZpbHRlcnMiLCJzaG93X3Jlc291cmNlX3R5cGVfZmlsdGVyIiwicmVzb3VyY2VfdHlwZV9maWx0ZXIiLCJyZW5kZXJfYm9va2luZ19yZXNvdXJjZXNfdG9vbGJhciIsInRvb2xiYXJfdGFyZ2V0IiwiYWN0aXZlX3RlbXBsYXRlX3BhY2siLCJ0ZW1wbGF0ZV9wYWNrIiwiZGVmYXVsdF90ZW1wbGF0ZV9wYWNrIiwiYWN0aXZlX3ZpZXciLCJyZWZyZXNoX2NvbnRyb2xzIiwiZmlyc3RFbGVtZW50Q2hpbGQiLCJzeW5jaHJvbml6ZV9vdmVyZmxvd190b29sdGlwcyIsImNhdGFsb2dfbW91bnQiLCJpbml0aWFsaXplX2RldGFpbHNfdG9vbHRpcHMiLCJ0b29sdGlwX3NlbGVjdG9yIiwid3BiY19kZWZpbmVfdGlwcHlfdG9vbHRpcHMiLCJzeW5jaHJvbml6ZV9ib29raW5nX3Jlc291cmNlc190b29sYmFyIiwicmVzcG9uc2UiLCJkaXNwbGF5Iiwic29ydGluZyIsImNvbHVtbl9saXN0Iiwic2VhcmNoX2NvbnRyb2wiLCJ0ZW1wbGF0ZV9wYWNrX2NvbnRyb2wiLCJ0eXBlX2NvbnRyb2wiLCJ2aWV3X2NvbnRyb2wiLCJhY3RpdmVFbGVtZW50IiwidmFsdWUiLCJmaWx0ZXJzIiwiY29sdW1uIiwiY29sdW1uX2NvbnRyb2wiLCJjb2x1bW5faXRlbSIsImNoZWNrZWQiLCJhcHBlbmRDaGlsZCIsInJlbmRlcl9pbmxpbmVfYmFyIiwiaW5saW5lX2hvc3QiLCJyZWdpc3Rlcl9zdGlja3lfYmFyIiwic3luY2hyb25pemVfaW5saW5lX2NvbnRyb2xzIiwiY2hhbmdlZF9jb3VudCIsImxlbmd0aCIsImNvdW50X2xhYmVsIiwiaW5saW5lX2NoYW5nZWRfcm93IiwiaW5saW5lX2NoYW5nZWRfcm93cyIsInN5bmNocm9uaXplIiwiYWN0aXZlX3RvZ2dsZV90ZXh0IiwiaW5saW5lX2VkaXRpbmdfcm93cyIsImJ1c3kiLCJjb3VudF90ZXh0IiwiaW5saW5lX2xvYWRpbmciLCJoYXNfaXRlbXMiLCJpbmFjdGl2ZV90b2dnbGVfdGV4dCIsImVkaXRfcm93cyIsInByb3RlY3RfaW5saW5lX2RyYWZ0c19mcm9tX2NhdGFsb2dfY29udHJvbHMiLCJldmVudCIsInByb3RlY3RfZXZlbnQiLCJzaG93X2lubGluZV9tZXNzYWdlIiwibm90aWNlIiwiaGlkZGVuIiwidGV4dCIsInRleHRDb250ZW50IiwicmVuZGVyX2lubGluZV9yb3ciLCJyb3dfc2NoZW1hIiwicmVzb3VyY2VfaWQiLCJyb3ciLCJyZXNvdXJjZV9maWVsZHMiLCJmaWVsZCIsImNlbGwiLCJjb3B5Iiwid3JhcHBlciIsImNyZWF0ZUVsZW1lbnQiLCJjbGFzc05hbWUiLCJpbnNlcnRBZGphY2VudEhUTUwiLCJyZXBsYWNlV2l0aCIsImNvbGxlY3RfaW5saW5lX2RyYWZ0cyIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJoYXNfY2hhbmdlcyIsImluZGljYXRvcl9ob3N0IiwiY29udHJvbCIsImZpZWxkX2tleSIsImdldEF0dHJpYnV0ZSIsImNsYXNzTGlzdCIsInRvZ2dsZSIsInNldF9yb3dfY2hhbmdlZCIsImlubGluZV9jaGFuZ2VkIiwic3luY2hyb25pemVfaW5saW5lX2RyYWZ0cyIsImxlYXZlX2lubGluZV9tb2RlIiwicmVsb2FkIiwiY2xvc2VfaW5zcGVjdG9yIiwic2hvd19hZG1pbl9tZXNzYWdlIiwibG9hZCIsInN0YXJ0X2lubGluZV9tb2RlIiwicmVzb3VyY2VfaWRzIiwiY29uZmlybSIsImlubGluZV9kaXNjYXJkIiwiY2FuX2Rpc2NhcmRfaW5zcGVjdG9yIiwiY3VzdG9taXplciIsInJlbW92ZUF0dHJpYnV0ZSIsImNsb3NlX2RldGFpbHNfcm93IiwicmVxdWVzdF9pbnNwZWN0b3IiLCJpbmxpbmVfc2NoZW1hX2FjdGlvbiIsInRoZW4iLCJzdWNjZXNzIiwiZGF0YSIsInNjaGVtYSIsIkVycm9yIiwiZ2V0X2luc3BlY3Rvcl9yZXNwb25zZV9tZXNzYWdlIiwiaW5saW5lX2xvYWRfZmFpbGVkIiwicm93cyIsImZpcnN0X2ZpZWxkIiwiZm9jdXMiLCJjYXRjaCIsInByZXZpZXdfaW5saW5lX2NoYW5nZXMiLCJmb2N1c190YXJnZXQiLCJpbnNwZWN0b3Jfd29ya2Zsb3ciLCJnZXRfaW5zcGVjdG9yX3dvcmtmbG93IiwibW91bnQiLCJvcGVuX2xvYWRpbmciLCJpbmxpbmVfcHJldmlld19hY3Rpb24iLCJyZXZpZXdfd29ya2Zsb3ciLCJyZXZpZXdfbW9kZWwiLCJ0YXJnZXQiLCJwcmV2aWV3IiwiaW5saW5lX3Jldmlld19mYWlsZWQiLCJnZXRfaW5zcGVjdG9yX2hvc3QiLCJwcmVwYXJlIiwicmV2aWV3IiwiY2hhbmdlZF9sYWJlbCIsImRlc2NyaXB0aW9uIiwiaW5saW5lX3Jldmlld19kZXNjcmlwdGlvbiIsImZvcm1faWQiLCJtb2RlIiwicGVuZGluZ19tZXNzYWdlIiwicmV2aWV3X2NoYW5nZXNfaGVscCIsInRpdGxlIiwiaW5saW5lX3Jldmlld190aXRsZSIsInNldF9pbnNwZWN0b3Jfc3RhdGUiLCJjb25maWd1cmVfaW5zcGVjdG9yX2Zvb3RlciIsImFwcGx5X2NoYW5nZXMiLCJjYW5fYXBwbHkiLCJmb2N1c19pbnNwZWN0b3JfaGVhZGluZyIsImFwcGx5X2lubGluZV9jaGFuZ2VzIiwiZm9ybSIsInNhdmVfYnV0dG9uIiwicHJldmVudERlZmF1bHQiLCJkaXNhYmxlZCIsImFkZCIsImlubGluZV9hcHBseV9hY3Rpb24iLCJpbmxpbmVfYXBwbHlfZmFpbGVkIiwidXBkYXRlZF9pZHMiLCJkb2N1bWVudEVsZW1lbnQiLCJjb250YWlucyIsInNob3dfaW5zcGVjdG9yX21lc3NhZ2UiLCJyZW1vdmUiLCJyZW5kZXJfYm9va2luZ19yZXNvdXJjZXNfcmVzcG9uc2UiLCJjYXRhbG9nX2hlYWRpbmciLCJjYXJkX2dyb3VwcyIsImNoaWxkcmVuX2J5X3BhcmVudCIsImhlYWRlcl9lbGVtZW50IiwiaGllcmFyY2h5X2VuYWJsZWQiLCJoaWVyYXJjaHlfaXNfZXhwYW5kZWQiLCJpc19jYXJkc19wYWNrIiwicGFyZW50X3Jlc291cmNlcyIsInBhZ2luYXRpb24iLCJwYWdpbmF0aW9uX2VsZW1lbnQiLCJyb3dzX2VsZW1lbnQiLCJpdGVtcyIsImVuYWJsZWQiLCJ3cGJjX3VpX2NhdGFsb2dfaGllcmFyY2h5IiwiZ2V0X2luaXRpYWxfZXhwYW5kZWQiLCJhbGxfZXhwYW5kZWQiLCJzZWxlY3Rpb25fZW5hYmxlZCIsInNlbGVjdGlvbiIsInJlc291cmNlIiwidHlwZSIsInBhcmVudF9pZCIsImFjdGlvbl90YXJnZXQiLCJjbGFzc2ljX2xhYmVsX2NsYXNzZXMiLCJjaGlsZCIsImNvc3QiLCJvd25lciIsInBhcmVudCIsInNpbmdsZSIsImxhYmVsX3RhcmdldCIsInByaWNlX3RhcmdldCIsIm5vX2Rlc2NyaXB0aW9uIiwiYXNzaWduIiwicGFyZW50X2NvbnRleHRfbGFiZWwiLCJyb3dfdmFyaWFudCIsInJvd190ZW1wbGF0ZV9yb2xlIiwidHlwZV9iYWRnZV9sYWJlbCIsImluZGVwZW5kZW50X2xhYmVsIiwiZXhwYW5kYWJsZSIsInBhcmVudF90aXRsZSIsImNoaWxkX29mIiwicmVuZGVyZWRfY2hpbGRfY291bnQiLCJwYXJlbnRfY2hpbGRyZW5fdGVtcGxhdGUiLCJwYXJlbnRfY2hpbGRfbGFiZWwiLCJwYXJlbnRfY2hpbGRyZW5fbGFiZWwiLCJwYXJlbnRfbGFiZWwiLCJjaGlsZF9sYWJlbCIsInJlc291cmNlX3Jvd19kYXRhIiwiY29sbGFwc2VfbGFiZWwiLCJjb2xsYXBzZV9jaGlsZHJlbl9mb3IiLCJjb2xsYXBzZV9jaGlsZHJlbiIsImV4cGFuZF9sYWJlbCIsImV4cGFuZF9jaGlsZHJlbl9mb3IiLCJleHBhbmRfY2hpbGRyZW4iLCJpc19leHBhbmRlZCIsInNlbGVjdGlvbl9sYWJlbCIsInNlbGVjdF9yZXNvdXJjZSIsInRodW1ibmFpbF9sYWJlbCIsInRodW1ibmFpbF90b29sdGlwIiwicmVzb3VyY2Vfcm93X2h0bWwiLCJyZXNvdXJjZV9yb3ciLCJjaGlsZF9yZXNvdXJjZXMiLCJjYXJkX2dyb3VwX2h0bWwiLCJjaGlsZHJlbl9kZXNjcmlwdGlvbiIsImNoaWxkcmVuX2JlbG9uZ190byIsImNoaWxkcmVuX2hlYWRpbmciLCJjaGlsZHJlbl9vZl9jb3VudCIsInBhcmVudF9ub2RlX2lkIiwibm9kZV9pZCIsInN0YWNrX2l0ZW1zIiwibGFzdEVsZW1lbnRDaGlsZCIsInBhcmVudF9zbG90IiwiY2hpbGRyZW5fc2xvdCIsImFyaWFfbGFiZWwiLCJjb2x1bW5fbGFiZWxzIiwiZW1wdHlfbGFiZWwiLCJub19sYWJlbHMiLCJraW5kIiwicHJpY2VfdW5hdmFpbGFibGUiLCJwcmljZSIsImFjdGlvbnMiLCJhY3Rpb25faXRlbXMiLCJhY3Rpb24iLCJhY3Rpb25fY2xhc3NlcyIsImFkanVzdF9jYXBhY2l0eSIsImRlbGV0ZV9yZXNvdXJjZSIsImVkaXRfcmVzb3VyY2UiLCJwdWJsaXNoX3Jlc291cmNlIiwiYWN0aW9uX2lkIiwiYWN0aW9uc19mb3IiLCJub19hY3Rpb25zIiwibWVudV9pZCIsImlzX2xhc3Rfc2libGluZyIsInN1bW1hcnlfdGFyZ2V0IiwicGFnaW5hdGlvbl9sYWJlbCIsImhhc19uZXh0IiwicGFnZV9udW1iZXIiLCJ0b3RhbF9wYWdlcyIsImhhc19wcmV2aW91cyIsIml0ZW1zX3Blcl9wYWdlIiwiaXRlbXNfcGVyX3BhZ2Vfb3B0aW9ucyIsIm9wdGlvbnMiLCJuZXh0X2xhYmVsIiwibmV4dF9wYWdlIiwibWluIiwicGFnZV9udW1iZXJfbGFiZWwiLCJwZXJfcGFnZV9sYWJlbCIsInBlcl9wYWdlIiwicHJldmlvdXNfbGFiZWwiLCJwcmV2aW91c19wYWdlIiwicmVzdWx0c19zdGF0dXMiLCJpdGVtc19mcm9tIiwiaXRlbXNfdG8iLCJ0b3RhbF9pdGVtcyIsInNob3dfbGFiZWwiLCJzaG93IiwiZ2V0X2RldGFpbHNfY29sc3BhbiIsInZpc2libGVfY2VsbHMiLCJ0YWdOYW1lIiwicHJvdG90eXBlIiwiY2FsbCIsImNlbGxzIiwiZ2V0Q29tcHV0ZWRTdHlsZSIsImdldF9yZXNvdXJjZV9pdGVtX2NvbnRhaW5lciIsInNvdXJjZV9lbGVtZW50IiwiY2xvc2VzdCIsInN5bmNocm9uaXplX2NhcmRfZ3JvdXBfcGFuZWxzIiwiY2F0YWxvZ19yb290IiwiaGFzQXR0cmlidXRlIiwiY2FyZF9ncm91cCIsImNoaWxkcmVuX3BhbmVsIiwidmlzaWJsZV9jaGlsZCIsInNldF9kZXRhaWxzX3RvZ2dsZV9zdGF0ZSIsInRvZ2dsZV9idXR0b24iLCJpY29uIiwic2V0QXR0cmlidXRlIiwicmVzdG9yZV9mb2N1cyIsImFjdGl2ZV9yb3ciLCJhYm9ydCIsInBhcmVudE5vZGUiLCJyZW1vdmVDaGlsZCIsInNvdXJjZV9yb3ciLCJyZW5kZXJfZGV0YWlsc19yb3ciLCJkZXRhaWxzX2h0bWwiLCJpbnNlcnRpb25fdGFyZ2V0IiwibmV4dEVsZW1lbnRTaWJsaW5nIiwiZ2V0X2RldGFpbHNfZXJyb3JfbWVzc2FnZSIsImZhbGxiYWNrIiwib3Blbl9kZXRhaWxzX3JvdyIsImRldGFpbHNfcmVxdWVzdF9pZCIsInJlcXVlc3RfYm9keSIsInJlc291cmNlX3RpdGxlX2VsZW1lbnQiLCJyZXNvdXJjZV90aXRsZSIsInRlbXBsYXRlX2Jhc2UiLCJjb2xzcGFuIiwibG9hZGluZ19sYWJlbCIsImRldGFpbHNfbG9hZGluZyIsInN0YXRlIiwiVVJMU2VhcmNoUGFyYW1zIiwiYXBwZW5kIiwiZGV0YWlsc19hY3Rpb24iLCJub25jZSIsIkFib3J0Q29udHJvbGxlciIsImZldGNoIiwiYWpheF91cmwiLCJib2R5IiwidG9TdHJpbmciLCJjcmVkZW50aWFscyIsImhlYWRlcnMiLCJtZXRob2QiLCJzaWduYWwiLCJ1bmRlZmluZWQiLCJqc29uIiwicmVxdWVzdF9pZCIsImRldGFpbHMiLCJzZWN0aW9ucyIsImVycm9yX21lc3NhZ2UiLCJkZXRhaWxzX2xvYWRfZmFpbGVkIiwibmFtZSIsImNvcHlfZGV0YWlsc192YWx1ZSIsImNvcHlfdmFsdWUiLCJhY3Rpb25fYnV0dG9uIiwiZGV0YWlsc19yb3ciLCJzdGF0dXNfZWxlbWVudCIsImNvcHlfcHJvbWlzZSIsIm5hdmlnYXRvciIsImNsaXBib2FyZCIsIndyaXRlVGV4dCIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiY29weV9pbnB1dCIsInN0eWxlIiwicG9zaXRpb24iLCJvcGFjaXR5Iiwic2VsZWN0IiwiZXhlY0NvbW1hbmQiLCJzaG9ydGNvZGVfY29waWVkIiwic2hvcnRjb2RlX2NvcHlfZmFpbGVkIiwiZ2V0X2Jvb2tpbmdfcmVzb3VyY2Vfc2hvcnRjb2RlIiwiaW5zcGVjdG9yX3Nob3J0Y29kZSIsImhpZGRlbl9zaG9ydGNvZGUiLCJzeW5jaHJvbml6ZV9ib29raW5nX3Jlc291cmNlX3Nob3J0Y29kZV9pbnB1dCIsInNob3J0Y29kZSIsImlucHV0IiwiY3VzdG9taXplX2Jvb2tpbmdfcmVzb3VyY2Vfc2hvcnRjb2RlIiwid3BiY19yZXNvdXJjZV9wYWdlX2J0bl9jbGljayIsInB1Ymxpc2hfYm9va2luZ19yZXNvdXJjZV9zaG9ydGNvZGUiLCJ0cmlnZ2VyX2J1dHRvbiIsIndwYmNfcHVibGlzaF9ib29raW5nX2Zvcm1fX29wZW4iLCJvcGVuX2Jvb2tpbmdfcmVzb3VyY2VfdXBncmFkZV9kaWFsb2ciLCJtb2RhbF9lbGVtZW50IiwidXBncmFkZV91cmwiLCJqUXVlcnkiLCJ3cGJjX215X21vZGFsIiwib2ZmIiwib25lIiwib3BlbiIsIm9wZW5fYm9va2luZ19yZXNvdXJjZV9tZXNzYWdlX2RpYWxvZyIsInRpdGxlX2VsZW1lbnQiLCJkZXNjcmlwdGlvbl9lbGVtZW50IiwiYWxlcnQiLCJnZXRfaW5zcGVjdG9yX2Zvb3RlciIsImNyZWF0ZV9pbnNwZWN0b3Jfd29ya2Zsb3ciLCJleHBhbmQiLCJleHBhbmRfaW5zcGVjdG9yX3NpZGViYXIiLCJnZXRfZm9vdGVyIiwiZ2V0X2hvc3QiLCJyZW5kZXJfc2hlbGwiLCJzaGVsbF9kYXRhIiwiY2F0YWxvZ19pZCIsImVtcHR5X2ljb24iLCJlbXB0eV9tZXNzYWdlIiwiaW5zcGVjdG9yX2VtcHR5X21lc3NhZ2UiLCJlbXB0eV90aXRsZSIsImluc3BlY3Rvcl9lbXB0eV90aXRsZSIsImluc3BlY3Rvcl9sb2FkaW5nIiwibW91bnRfaW5zcGVjdG9yX3NoZWxsIiwic3luY2hyb25pemVfaW5zcGVjdG9yX3dpZHRoIiwid3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fZG9fbWF4IiwiZGlzcGF0Y2hFdmVudCIsIkN1c3RvbUV2ZW50IiwiaG9zdCIsInNpZGViYXIiLCJtYXJrX2luc3BlY3Rvcl9yZXNvdXJjZV9yb3ciLCJzY3JvbGxJbnRvVmlldyIsImJsb2NrIiwiYmVoYXZpb3IiLCJzZXRfc3RhdGUiLCJzZXJpYWxpemVfaW5zcGVjdG9yX2ZpZWxkcyIsImdldF9pbnNwZWN0b3JfY3JlYXRpb25fbW9kZSIsInNlbGVjdGVkX21vZGUiLCJoaWRkZW5fbW9kZSIsInN5bmNocm9uaXplX2NyZWF0ZV9pbnNwZWN0b3JfY29udHJvbHMiLCJjcmVhdGlvbl9tb2RlIiwicGFyZW50X3dyYXAiLCJyYWRpbyIsImNob2ljZSIsImZpZWxkX3dyYXAiLCJzeW5jaHJvbml6ZV9pbnNwZWN0b3JfZGlydHlfc3RhdGUiLCJzYXZlX2lzX2J1c3kiLCJ0aXRsZV9maWVsZCIsInBhcmVudF9maWVsZCIsImNyZWF0ZV9pc192YWxpZCIsImluc3BlY3Rvcl9kaXNjYXJkIiwiY29uZmlybV9kaXNjYXJkIiwid3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fZG9faGlkZSIsImtleSIsImdldF9zZWxlY3RlZF9yZXNvdXJjZV9pZHMiLCJfd3BiY191aV9jYXRhbG9nX3NlbGVjdGlvbl9jb250cm9sbGVyIiwic2VsZWN0ZWRfaWRzIiwiZ2V0X3NlbGVjdGVkX2lkcyIsInJlc291cmNlX2lkX2xpc3RzX21hdGNoIiwiZmlyc3RfaWRzIiwic2Vjb25kX2lkcyIsIm5vcm1hbGl6ZV9pZHMiLCJzb3J0IiwiZmlyc3RfaWQiLCJzZWNvbmRfaWQiLCJnZXRfc2VsZWN0aW9uX2NvdW50X2xhYmVsIiwiY291bnQiLCJyZXNvdXJjZV9zZWxlY3RlZCIsInJlc291cmNlc19zZWxlY3RlZCIsImJ1dHRvbl9sYWJlbCIsImRlc3RydWN0aXZlIiwiZm9vdGVyIiwiY2FuY2VsX2J1dHRvbiIsImRlbGV0ZV93b3JrZmxvdyIsIndwYmNfY2F0YWxvZ19ib29raW5nX3Jlc291cmNlc19jb25maWciLCJjYW5jZWwiLCJjb25maWd1cmVfZm9vdGVyIiwicHVsc2VfZGVsZXRlX2Fja25vd2xlZGdlbWVudCIsImFja25vd2xlZGdlbWVudCIsIm1hdGNoZXMiLCJwdWxzZV9hY2tub3dsZWRnZW1lbnQiLCJvZmZzZXRXaWR0aCIsImlzX2Vycm9yIiwibm90aWNlX3RleHQiLCJoZWFkaW5nIiwic2V0VGltZW91dCIsIm1lc3NhZ2VfdHlwZSIsImRlbGF5Iiwid3BiY19hZG1pbl9zaG93X21lc3NhZ2UiLCJpbnNlcnRCZWZvcmUiLCJmaXJzdENoaWxkIiwiYWN0aXZhdGVfaW5zcGVjdG9yX3NlY3Rpb24iLCJzZWN0aW9uX2lkIiwiZ3JvdXAiLCJjb250cm9sbGVyIiwiaGVhZGVyIiwidGVzdCIsIl9fd3BiY19jb2xsYXBzaWJsZV9pbnN0YW5jZSIsImNsaWNrIiwicmVuZGVyX2luc3BlY3Rvcl9zY2hlbWEiLCJmb2N1c190aXRsZSIsImZvcm1fdGFyZ2V0IiwiY2FuX2NyZWF0ZSIsInNob3J0Y29kZV9maWVsZCIsImFkZF9yZXNvdXJjZSIsInNhdmVfY2hhbmdlcyIsIldQQkNfQ29sbGFwc2libGVfQXV0b0luaXQiLCJzeW5jaHJvbml6ZV9hbGxfaW5zcGVjdG9yX251bWVyaWNfcmFuZ2VzIiwib3Blbl9pbnNwZWN0b3IiLCJpbnNwZWN0b3JfY3JlYXRlX3NjaGVtYV9hY3Rpb24iLCJpbnNwZWN0b3JfZWRpdF9zY2hlbWFfYWN0aW9uIiwiaW5zcGVjdG9yX2xvYWRfZmFpbGVkIiwicmVuZGVyX2J1bGtfZWRpdG9yIiwic2VsZWN0aW9uX2NvdW50IiwicmV2aWV3X2NoYW5nZXNfYnV0dG9uIiwib3Blbl9idWxrX2VkaXRvciIsImJ1bGtfc2NoZW1hX2FjdGlvbiIsImJ1bGtfbG9hZF9mYWlsZWQiLCJoYW5kbGVfaW5zcGVjdG9yX3NlbGVjdGlvbl9jaGFuZ2UiLCJjb2xsZWN0X2J1bGtfb3BlcmF0aW9ucyIsIm9wZXJhdGlvbnMiLCJlbmFibGVkX2NvbnRyb2wiLCJvcGVyYXRpb24iLCJmaWVsZF92YWx1ZSIsInN5bmNocm9uaXplX2J1bGtfZWRpdG9yIiwiY2hhbmdlZF9jb250cm9sIiwib3BlcmF0aW9uX2NvbnRyb2wiLCJwcmVmaXhfZWxlbWVudCIsInN1ZmZpeF9lbGVtZW50Iiwib3BlcmF0aW9uX2lkIiwiaXNfcGVyY2VudCIsIm51bWJlcl9jb250cm9sIiwicmFuZ2VfY29udHJvbCIsImZpZWxkX3ZhbHVlX2NvbnRyb2wiLCJyZW5kZXJfYnVsa19yZXZpZXciLCJyZXZpZXdfY2hhbmdlcyIsImVkaXRfYm9va2luZ19yZXNvdXJjZXMiLCJyZW5kZXJfZGVsZXRlX3JldmlldyIsImRlbGV0ZV9pMThuIiwiZGVsZXRlX2Fja25vd2xlZGdlbWVudCIsImFjdGlvbnNfaGVhZGluZyIsImJvb2tpbmdzX3JldGFpbmVkX3dhcm5pbmciLCJyZXNvdXJjZXNfdG9fZGVsZXRlIiwicmV2aWV3X2hlbHAiLCJkZWxldGVfcmV2aWV3X2hlbHAiLCJkZWxldGVfYm9va2luZ19yZXNvdXJjZXMiLCJ3YXJuaW5nIiwiZGVsZXRlX3dhcm5pbmciLCJyZXNvdXJjZXMiLCJkZWxldGVfYnV0dG9uIiwiZGVsZXRlX3Jlc291cmNlcyIsIm9wZW5fZGVsZXRlX3JldmlldyIsInRyYWNrX3NlbGVjdGlvbiIsImRlbGV0ZV9wcmV2aWV3X2FjdGlvbiIsImRlbGV0ZV9sb2FkX2ZhaWxlZCIsImdldF9jYXBhY2l0eV9jb3VudF9sYWJlbCIsInNpbmd1bGFyX2tleSIsInBsdXJhbF9rZXkiLCJnZXRfY2FwYWNpdHlfZWRpdG9yX3ZpZXciLCJjb250ZXh0IiwiY3VycmVudF9jYXBhY2l0eSIsInRhcmdldF9jYXBhY2l0eSIsImtlZXBfY291bnQiLCJjcmVhdGVfY291bnQiLCJkZWNyZWFzZV9jb3VudCIsImRlbGV0ZV9hY3Rpb24iLCJjaGlsZHJlbiIsInNlbGVjdGVkIiwiY29udGV4dF9sYWJlbCIsImRlY3JlYXNlX2FjdGlvbiIsImRlY3JlYXNlX2hlYWRpbmciLCJkZWNyZWFzZV9oZWxwIiwiZGVsZXRlX3VuaXRzX2hlbHAiLCJzZWxlY3RfZGV0YWNoX2hlbHAiLCJkZWNyZWFzZV9vdXRjb21lX2xhYmVsIiwid2lsbF9iZV9kZWxldGVkIiwibWFrZV9pbmRlcGVuZGVudCIsImNhcGFjaXR5X2Rlc2NyaXB0aW9uIiwiY3JlYXRlX2xhYmVsIiwia2VlcF9sYWJlbCIsIm1heGltdW1fY2FwYWNpdHkiLCJtaW5pbXVtX2NhcGFjaXR5Iiwic3luY2hyb25pemVfY2FwYWNpdHlfZWRpdG9yIiwicmVxdWlyZWRfZGV0YWNoX2NvdW50IiwidGFyZ2V0X251bWJlciIsInRhcmdldF9yYW5nZSIsImFmdGVyX3ZhbHVlIiwiaW5jcmVhc2Vfcm93IiwiZGVjcmVhc2VfcGFuZWwiLCJhY3Rpb25fY29udHJvbCIsImFjdGlvbl9zZWxlY3RlZCIsImNoZWNrYm94IiwidW5pdCIsIm91dGNvbWUiLCJyZW5kZXJfY2FwYWNpdHlfZWRpdG9yIiwidmlldyIsInJldmlld19jYXBhY2l0eV9jaGFuZ2UiLCJvcGVuX2NhcGFjaXR5X2VkaXRvciIsImNhcGFjaXR5X2NvbnRleHRfYWN0aW9uIiwiY2FwYWNpdHlfbG9hZF9mYWlsZWQiLCJyZW5kZXJfY2FwYWNpdHlfcmV2aWV3IiwiaW5jcmVhc2UiLCJkZWxldGVfaGFzX2Jvb2tpbmdzIiwicmV2aWV3X2NhcGFjaXR5X2hlbHAiLCJvcGVyYXRpb25faGVscCIsImNyZWF0ZV91bml0c19oZWxwIiwib3BlcmF0aW9uX2xhYmVsIiwiY3JlYXRlX3Jlc291cmNlcyIsImRldGFjaF9yZXNvdXJjZXMiLCJyZXZpZXdfY2FwYWNpdHlfdGl0bGUiLCJhcHBseV9jYXBhY2l0eV9jaGFuZ2UiLCJiYWNrIiwic3luY2hyb25pemVfaW5zcGVjdG9yX2ltYWdlIiwicmVtb3ZlX2J1dHRvbiIsInBpY3R1cmVfdXJsIiwic3JjIiwic3luY2hyb25pemVfaW5zcGVjdG9yX251bWVyaWNfcmFuZ2UiLCJudW1iZXJfZmllbGQiLCJyYW5nZSIsIm51bWJlcl92YWx1ZSIsImRlZmF1bHRfbWluIiwiZGVmYXVsdF9tYXgiLCJoYXJkX21pbiIsImhhcmRfbWF4IiwicmFuZ2VfbWluIiwicmFuZ2VfbWF4IiwiaXNGaW5pdGUiLCJzeW5jaHJvbml6ZV9pbnNwZWN0b3JfbnVtYmVyX2Zyb21fcmFuZ2UiLCJFdmVudCIsImJ1YmJsZXMiLCJpc19leHBlY3RlZF9pbnNwZWN0b3Jfc3VibWl0Iiwic3VibWl0dGVyIiwicmVwb3J0X2luc3BlY3Rvcl92YWxpZGl0eSIsInByaWNlX2ZpZWxkcyIsInByaWNlX3N0ZXBzIiwiaXNfdmFsaWQiLCJwcmljZV9maWVsZCIsInN0ZXAiLCJyZXBvcnRWYWxpZGl0eSIsInByaWNlX3N0ZXAiLCJzdWJtaXRfaW5zcGVjdG9yIiwibXV0YXRpb25fcmVxdWVzdF9zZXF1ZW5jZSIsInN1Ym1pdHRlZF9tb2RlIiwicmVxdWVzdF92YWx1ZXMiLCJjb250cm9sX2Rpc2FibGVkX3N0YXRlcyIsInN1Y2Nlc3NfbWVzc2FnZSIsInN1Y2Nlc3NfbWVzc2FnZV9pc19nbG9iYWwiLCJzdWJtaXR0ZWRfZm9ybV9pc19hY3RpdmUiLCJwYXJzZSIsImluc3BlY3Rvcl9jcmVhdGVfYWN0aW9uIiwiaW5zcGVjdG9yX3VwZGF0ZV9hY3Rpb24iLCJpbnNwZWN0b3Jfc2F2ZV9mYWlsZWQiLCJjb250cm9sX3N0YXRlIiwic3VibWl0X3Jldmlld2VkX2luc3BlY3RvciIsImlzX211dGF0aW9uIiwic3VibWl0dGVkX3Jlc291cmNlX2lkcyIsInN1Ym1pdHRlZF90cmFja3Nfc2VsZWN0aW9uIiwiYnVsa19wcmV2aWV3X2FjdGlvbiIsImJ1bGtfcmV2aWV3X2ZhaWxlZCIsImJ1bGtfYXBwbHlfYWN0aW9uIiwiYnVsa19hcHBseV9mYWlsZWQiLCJkZWxldGVfYXBwbHlfYWN0aW9uIiwiYWNrbm93bGVkZ2VkIiwiZGVsZXRlX2FwcGx5X2ZhaWxlZCIsImNhcGFjaXR5X3ByZXZpZXdfYWN0aW9uIiwiZGV0YWNoX3Jlc291cmNlX2lkcyIsImNhcGFjaXR5X3Jldmlld19mYWlsZWQiLCJjYXBhY2l0eV9hcHBseV9hY3Rpb24iLCJjYXBhY2l0eV9hY2tub3dsZWRnZW1lbnQiLCJjYXBhY2l0eV9hcHBseV9mYWlsZWQiLCJhZmZlY3RlZF9pZHMiLCJzZWxlY3RlZF9yZXNvdXJjZV9pZHMiLCJkZWxldGVkX3NlbGVjdGVkX3Jlc291cmNlIiwiY2xlYXIiLCJkZXRhaWwiLCJzZWxlY3Rpb25fY2hhbmdlZCIsImFwcGx5X3BlbmRpbmdfaGlnaGxpZ2h0cyIsImZpcnN0X3JvdyIsImhhbmRsZV9jYXRhbG9nX3JlbmRlcmVkIiwiZXZlbnRfZGV0YWlsIiwiaGFuZGxlX2NhdGFsb2dfY2xpY2siLCJhY3Rpb25fZGV0YWlscyIsInBhZ2VfYnV0dG9uIiwicmVzb3VyY2VfYWN0aW9uX2V2ZW50IiwiY3JlYXRlRXZlbnQiLCJpbml0Q3VzdG9tRXZlbnQiLCJoYW5kbGVfY2F0YWxvZ19rZXlkb3duIiwicHJvdGVjdF9kZW1vX3Jlc291cmNlX2ltYWdlX2NoYW5nZSIsIm1lZGlhX2J1dHRvbiIsImluc3BlY3Rvcl9mb3JtIiwibWVzc2FnZV90aXRsZSIsImlzX2RlbW8iLCJzdG9wUHJvcGFnYXRpb24iLCJzdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24iLCJkZW1vX2ltYWdlX2NoYW5nZV91bmF2YWlsYWJsZSIsImRlbW9faW1hZ2VfY2hhbmdlX3VuYXZhaWxhYmxlX3RpdGxlIiwibW91bnRfYm9va2luZ19yZXNvdXJjZXNfY2F0YWxvZyIsImFkZEV2ZW50TGlzdGVuZXIiLCJjcmVhdGVfaW5saW5lX2VkaXRpbmdfd29ya2Zsb3ciLCJiYXJfc2VsZWN0b3IiLCJjb250cm9sc19yb290IiwiY291bnRfc2VsZWN0b3IiLCJwYWdlX2VsZW1lbnQiLCJwcm90ZWN0ZWRfc2VsZWN0b3IiLCJyZXZpZXdfc2VsZWN0b3IiLCJ0b2dnbGVfbGFiZWxfc2VsZWN0b3IiLCJ0b2dnbGVfc2VsZWN0b3IiLCJpbmxpbmVfdG9nZ2xlIiwiaW5saW5lX2NhbmNlbCIsImlubGluZV9yZXZpZXciLCJjcmVhdGVfYnV0dG9uIiwidXBncmFkZV9idXR0b24iLCJyZW1vdmVfaW1hZ2VfYnV0dG9uIiwic2hvcnRjb2RlX2J1dHRvbiIsInNlbGVjdGlvbl9hY3Rpb24iLCJzaG9ydGNvZGVfcmVzb3VyY2VfaWQiLCJzaG9ydGNvZGVfY29tbWFuZCIsInNob3J0Y29kZV92YWx1ZSIsInJldmlld2VkX3RhcmdldF9jYXBhY2l0eSIsInJldmlld2VkX2RldGFjaF9pZHMiLCJyZXZpZXdlZF9kZWNyZWFzZV9hY3Rpb24iLCJpbWFnZV9maWVsZCIsIm1pbmltdW0iLCJtYXhpbXVtIiwicmVxdWVzdGVkX2NhcGFjaXR5Iiwicm91bmQiLCJoYW5kbGVfY2hhbmdlIiwiZGV0YWNoX2lkIiwiY2FwYWNpdHlfZGVsZXRlX2J1dHRvbiIsIm9uIiwiY2xvc2luZ19tb2RlIiwic2VsZWN0ZWRfcmVzb3VyY2VfaWQiLCJzZWxlY3RlZF9zaG9ydGNvZGUiLCJkZXRhaWxzX2NvZGUiLCJyZXR1cm5WYWx1ZSIsInJlYWR5U3RhdGUiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWNhdGFsb2ctYm9va2luZy1yZXNvdXJjZXMvX3NyYy9ib29raW5nX3Jlc291cmNlc19jYXRhbG9nLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUmVuZGVyIG5vcm1hbGl6ZWQgQm9va2luZyBSZXNvdXJjZSBEVE9zIHRocm91Z2ggaWRlbnRpZmlhYmxlIFdQIHRlbXBsYXRlcy5cbiAqXG4gKiBAc2luY2UgMTEuNi4wXG4gKi9cbiggZnVuY3Rpb24gKCB3aW5kb3csIGRvY3VtZW50ICkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0dmFyIGNhdGFsb2dfY29udHJvbGxlciA9IG51bGw7XG5cdHZhciBpbmxpbmVfd29ya2Zsb3dfY29udHJvbGxlciA9IG51bGw7XG5cdHZhciBpbmxpbmVfcmV2aWV3X3dvcmtmbG93X2NvbnRyb2xsZXIgPSBudWxsO1xuXHR2YXIgZGVsZXRlX3Jldmlld193b3JrZmxvd19jb250cm9sbGVyID0gbnVsbDtcblx0dmFyIGluc3BlY3Rvcl93b3JrZmxvd19jb250cm9sbGVyID0gbnVsbDtcblx0dmFyIGNhdGFsb2dfcmVzcG9uc2UgPSBudWxsO1xuXHR2YXIgZGV0YWlsc19hYm9ydF9jb250cm9sbGVyID0gbnVsbDtcblx0dmFyIGRldGFpbHNfcmVxdWVzdF9zZXF1ZW5jZSA9IDA7XG5cdHZhciBkZXRhaWxzX3Jlc291cmNlX2lkID0gMDtcblx0dmFyIGRldGFpbHNfdG9nZ2xlX2J1dHRvbiA9IG51bGw7XG5cdHZhciBwZW5kaW5nX2ZvY3VzX2RpcmVjdGlvbiA9ICcnO1xuXHR2YXIgaW5zcGVjdG9yX2RpcnR5ID0gZmFsc2U7XG5cdHZhciBpbnNwZWN0b3JfZm9jdXNfdGFyZ2V0ID0gbnVsbDtcblx0dmFyIGluc3BlY3Rvcl9tb2RlID0gJyc7XG5cdHZhciBpbnNwZWN0b3JfbXV0YXRpb25faW5fcHJvZ3Jlc3MgPSBmYWxzZTtcblx0dmFyIGluc3BlY3Rvcl9tdXRhdGlvbl9yZXF1ZXN0X3NlcXVlbmNlID0gMDtcblx0dmFyIGluc3BlY3Rvcl9vcmlnaW5hbF9maWVsZHMgPSAnJztcblx0dmFyIGluc3BlY3Rvcl9yZXF1ZXN0X3NlcXVlbmNlID0gMDtcblx0dmFyIGluc3BlY3Rvcl9yZXNvdXJjZV9pZCA9IDA7XG5cdHZhciBpbnNwZWN0b3JfcmVzb3VyY2VfaWRzID0gW107XG5cdHZhciBpbnNwZWN0b3JfYnVsa19vcGVyYXRpb25zID0ge307XG5cdHZhciBpbnNwZWN0b3JfcmV2aWV3X3Rva2VuID0gJyc7XG5cdHZhciBpbnNwZWN0b3Jfc2VsZWN0aW9uX3N0YWxlID0gZmFsc2U7XG5cdHZhciBpbnNwZWN0b3JfdHJhY2tzX3NlbGVjdGlvbiA9IGZhbHNlO1xuXHR2YXIgaW5zcGVjdG9yX2NhcGFjaXR5X2NvbnRleHQgPSBudWxsO1xuXHR2YXIgaW5zcGVjdG9yX2NhcGFjaXR5X2RldGFjaF9pZHMgPSBbXTtcblx0dmFyIGluc3BlY3Rvcl9jYXBhY2l0eV9kZWNyZWFzZV9hY3Rpb24gPSAnZGV0YWNoJztcblx0dmFyIGluc3BlY3Rvcl9jYXBhY2l0eV90YXJnZXQgPSAwO1xuXHR2YXIgcGVuZGluZ19oaWdobGlnaHRfaWRzID0gW107XG5cdHZhciBpbmxpbmVfc3RhdGUgPSB7XG5cdFx0YWN0aXZlOiBmYWxzZSxcblx0XHRjaGFuZ2VkX3Jvd3M6IFtdLFxuXHRcdGxvYWRpbmc6IGZhbHNlLFxuXHRcdHJlcXVlc3Rfc2VxdWVuY2U6IDAsXG5cdFx0cmV2aWV3X3Rva2VuOiAnJ1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBOb3JtYWxpemUgYSBsb2NhbGl6ZWQgV29yZFByZXNzIGZsYWcgdG8gYSBzdHJpY3QgYm9vbGVhbi5cblx0ICpcblx0ICogQHBhcmFtIHsqfSBmbGFnX3ZhbHVlIExvY2FsaXplZCBmbGFnIHZhbHVlLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIG9ubHkgZm9yIGFuIGV4cGxpY2l0bHkgZW5hYmxlZCBmbGFnLlxuXHQgKi9cblx0ZnVuY3Rpb24gaXNfdHJ1ZV9mbGFnKCBmbGFnX3ZhbHVlICkge1xuXHRcdHJldHVybiB0cnVlID09PSBmbGFnX3ZhbHVlIHx8IDEgPT09IGZsYWdfdmFsdWUgfHwgJzEnID09PSBmbGFnX3ZhbHVlIHx8ICd0cnVlJyA9PT0gU3RyaW5nKCBmbGFnX3ZhbHVlICkudG9Mb3dlckNhc2UoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBGb3JtYXQgYSBsb2NhbGl6ZWQgcG9zaXRpb25hbC1wbGFjZWhvbGRlciBzdHJpbmcuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZW1wbGF0ZSBMb2NhbGl6ZWQgc3RyaW5nIGNvbnRhaW5pbmcgYCUxJHNgIHBsYWNlaG9sZGVycy5cblx0ICogQHBhcmFtIHtBcnJheTwqPn0gdmFsdWVzIFNjYWxhciByZXBsYWNlbWVudCB2YWx1ZXMuXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gRm9ybWF0dGVkIHBsYWluIHRleHQuXG5cdCAqL1xuXHRmdW5jdGlvbiBmb3JtYXRfbWVzc2FnZSggdGVtcGxhdGUsIHZhbHVlcyApIHtcblx0XHR2YXIgbWVzc2FnZSA9IFN0cmluZyggdGVtcGxhdGUgfHwgJycgKTtcblxuXHRcdHZhbHVlcy5mb3JFYWNoKCBmdW5jdGlvbiAoIHJlcGxhY2VtZW50LCByZXBsYWNlbWVudF9pbmRleCApIHtcblx0XHRcdHZhciBwbGFjZWhvbGRlciA9IG5ldyBSZWdFeHAoICclJyArICggcmVwbGFjZW1lbnRfaW5kZXggKyAxICkgKyAnXFxcXCRzJywgJ2cnICk7XG5cdFx0XHRtZXNzYWdlID0gbWVzc2FnZS5yZXBsYWNlKCBwbGFjZWhvbGRlciwgU3RyaW5nKCByZXBsYWNlbWVudCApICk7XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIG1lc3NhZ2U7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIHRoZSBzaGFyZWQgc2lnbmVkLXJldmlldyBwcmVzZW50YXRpb24gY29udHJvbGxlci5cblx0ICpcblx0ICogQHJldHVybiB7T2JqZWN0fGZhbHNlfSBTaGFyZWQgcmV2aWV3IGNvbnRyb2xsZXIgb3IgZmFsc2Ugd2hlbiB1bmF2YWlsYWJsZS5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9pbmxpbmVfcmV2aWV3X3dvcmtmbG93KCkge1xuXHRcdGlmICggaW5saW5lX3Jldmlld193b3JrZmxvd19jb250cm9sbGVyICkge1xuXHRcdFx0cmV0dXJuIGlubGluZV9yZXZpZXdfd29ya2Zsb3dfY29udHJvbGxlcjtcblx0XHR9XG5cdFx0aWYgKCAhIHdpbmRvdy53cGJjX3VpX2NhdGFsb2cgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy53cGJjX3VpX2NhdGFsb2cuY3JlYXRlX2lubGluZV9yZXZpZXdfd29ya2Zsb3cgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlubGluZV9yZXZpZXdfd29ya2Zsb3dfY29udHJvbGxlciA9IHdpbmRvdy53cGJjX3VpX2NhdGFsb2cuY3JlYXRlX2lubGluZV9yZXZpZXdfd29ya2Zsb3coIHtcblx0XHRcdGFwcGx5X3NlbGVjdG9yOiAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1zYXZlXScsXG5cdFx0XHRjYW5jZWxfc2VsZWN0b3I6ICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5zcGVjdG9yLWNhbmNlbF0nLFxuXHRcdFx0cm9vdDogZG9jdW1lbnRcblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gaW5saW5lX3Jldmlld193b3JrZmxvd19jb250cm9sbGVyO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiB0aGUgc2hhcmVkIHBlcm1hbmVudC1kZWxldGlvbiBwcmVzZW50YXRpb24gY29udHJvbGxlci5cblx0ICpcblx0ICogQHJldHVybiB7T2JqZWN0fGZhbHNlfSBTaGFyZWQgZGVsZXRpb24gY29udHJvbGxlciBvciBmYWxzZSB3aGVuIHVuYXZhaWxhYmxlLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X2RlbGV0ZV9yZXZpZXdfd29ya2Zsb3coKSB7XG5cdFx0aWYgKCBkZWxldGVfcmV2aWV3X3dvcmtmbG93X2NvbnRyb2xsZXIgKSB7XG5cdFx0XHRyZXR1cm4gZGVsZXRlX3Jldmlld193b3JrZmxvd19jb250cm9sbGVyO1xuXHRcdH1cblx0XHRpZiAoICEgd2luZG93LndwYmNfdWlfY2F0YWxvZyB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93LndwYmNfdWlfY2F0YWxvZy5jcmVhdGVfZGVsZXRlX3Jldmlld193b3JrZmxvdyApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0ZGVsZXRlX3Jldmlld193b3JrZmxvd19jb250cm9sbGVyID0gd2luZG93LndwYmNfdWlfY2F0YWxvZy5jcmVhdGVfZGVsZXRlX3Jldmlld193b3JrZmxvdygge1xuXHRcdFx0YWNrbm93bGVkZ2VtZW50X3NlbGVjdG9yOiAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWRlbGV0ZS1hY2tub3dsZWRnZW1lbnRdJyxcblx0XHRcdGFwcGx5X3NlbGVjdG9yOiAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1zYXZlXScsXG5cdFx0XHRjYW5jZWxfc2VsZWN0b3I6ICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5zcGVjdG9yLWNhbmNlbF0nLFxuXHRcdFx0cm9vdDogZG9jdW1lbnRcblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gZGVsZXRlX3Jldmlld193b3JrZmxvd19jb250cm9sbGVyO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiB0aGUgbG9jYWxpemVkIGNvdW50IHNob3duIGluIGEgY29sbGFwc2VkIGNoaWxkLWdyb3VwIHN1bW1hcnkuXG5cdCAqXG5cdCAqIFRoZSBEVE8gbGFiZWwgcmVtYWlucyBhdXRob3JpdGF0aXZlIGJlY2F1c2UgUEhQIGFwcGxpZXMgV29yZFByZXNzIGxvY2FsZVxuXHQgKiBwbHVyYWwgcnVsZXMuIFRoZSBudW1lcmljIGZhbGxiYWNrIGNvbnN1bWVzIHRoZSBzaGFyZWQgZGlyZWN0LWNoaWxkIGNvdW50XG5cdCAqIHdoZW4gYW4gb2xkZXIgb3IgY3VzdG9tIGRvbWFpbiBEVE8gZG9lcyBub3QgaW5jbHVkZSB0aGUgcHJlcGFyZWQgbGFiZWwuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBwYXJlbnRfcmVzb3VyY2UgUGFyZW50IEJvb2tpbmcgUmVzb3VyY2UgRFRPLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gaTE4biAgICAgICAgICAgIExvY2FsaXplZCBjYXRhbG9nIHN0cmluZ3MuXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gTG9jYWxpemVkIGNoaWxkLWNvdW50IGxhYmVsLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X2NoaWxkcmVuX3N1bW1hcnlfbGFiZWwoIHBhcmVudF9yZXNvdXJjZSwgaTE4biApIHtcblx0XHR2YXIgaGllcmFyY2h5ID0gcGFyZW50X3Jlc291cmNlICYmIHBhcmVudF9yZXNvdXJjZS5oaWVyYXJjaHkgPyBwYXJlbnRfcmVzb3VyY2UuaGllcmFyY2h5IDoge307XG5cdFx0dmFyIHNlcnZlcl9sYWJlbCA9IFN0cmluZyggaGllcmFyY2h5LmNoaWxkcmVuX2xhYmVsIHx8ICcnICkudHJpbSgpO1xuXHRcdHZhciBjaGlsZF9jb3VudCA9IE1hdGgubWF4KCAwLCBOdW1iZXIoIGhpZXJhcmNoeS5yZW5kZXJlZF9jaGlsZHJlbl9jb3VudCApIHx8IDAgKTtcblx0XHR2YXIgbGFiZWxfdGVtcGxhdGU7XG5cblx0XHRpZiAoIHNlcnZlcl9sYWJlbCApIHtcblx0XHRcdHJldHVybiBzZXJ2ZXJfbGFiZWw7XG5cdFx0fVxuXG5cdFx0bGFiZWxfdGVtcGxhdGUgPSAxID09PSBjaGlsZF9jb3VudFxuXHRcdFx0PyBpMThuLmNoaWxkX2NvdW50X3Npbmd1bGFyIHx8ICclMSRzIGNoaWxkIHJlc291cmNlJ1xuXHRcdFx0OiBpMThuLmNoaWxkX2NvdW50X3BsdXJhbCB8fCAnJTEkcyBjaGlsZCByZXNvdXJjZXMnO1xuXG5cdFx0cmV0dXJuIGZvcm1hdF9tZXNzYWdlKCBsYWJlbF90ZW1wbGF0ZSwgWyBjaGlsZF9jb3VudCBdICk7XG5cdH1cblxuXHQvKipcblx0ICogUmVuZGVyIG9uZSBhbGxvdy1saXN0ZWQgUmVzb3VyY2UgcHJlc2VudGF0aW9uIHRlbXBsYXRlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnICAgICAgICBSZWdpc3RlcmVkIGNhdGFsb2cgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtzdHJpbmd9IHRlbXBsYXRlX3JvbGUgUmVnaXN0ZXJlZCB0ZW1wbGF0ZSByb2xlLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gdGVtcGxhdGVfZGF0YSBOb3JtYWxpemVkIERUTyBvciBwcmVzZW50YXRpb24gZGF0YS5cblx0ICogQHJldHVybiB7c3RyaW5nfSBFc2NhcGVkIHRlbXBsYXRlIEhUTUwgb3IgYW4gZW1wdHkgc3RyaW5nLlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVuZGVyX2NvbXBvbmVudCggY29uZmlnLCB0ZW1wbGF0ZV9yb2xlLCB0ZW1wbGF0ZV9kYXRhICkge1xuXHRcdHZhciBjb21wb25lbnRfdGVtcGxhdGUgPSB3aW5kb3cud3BiY191aV9jYXRhbG9nLmxvYWRfdGVtcGxhdGUoIGNvbmZpZywgdGVtcGxhdGVfcm9sZSApO1xuXG5cdFx0aWYgKCAhIGNvbXBvbmVudF90ZW1wbGF0ZSApIHtcblx0XHRcdHJldHVybiAnJztcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuIGNvbXBvbmVudF90ZW1wbGF0ZSggdGVtcGxhdGVfZGF0YSB8fCB7fSApO1xuXHRcdH0gY2F0Y2ggKCBlcnJvciApIHtcblx0XHRcdHJldHVybiAnJztcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIGNvbXBsZXRlIGNvbHVtbiBwcmVzZW50YXRpb24gcmVjb3JkcyBpbiB0aGUgYWN0aXZlIG9yZGVyLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnICAgICAgICAgUmVnaXN0ZXJlZCBjYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBkaXNwbGF5X3N0YXRlICBOb3JtYWxpemVkIGRpc3BsYXkgcmVxdWVzdCBvciByZXNwb25zZS5cblx0ICogQHBhcmFtIHtib29sZWFufSB2aXNpYmxlX29ubHkgIFdoZXRoZXIgaGlkZGVuIGNvbHVtbnMgbXVzdCBiZSBvbWl0dGVkLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gc29ydGluZ19zdGF0ZSAgTm9ybWFsaXplZCBzb3J0aW5nIHJlc3BvbnNlLlxuXHQgKiBAcmV0dXJuIHtBcnJheTxPYmplY3Q+fSBPcmRlcmVkIHByZXNlbnRhdGlvbi1vbmx5IGNvbHVtbiByZWNvcmRzLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X2NvbHVtbnMoIGNvbmZpZywgZGlzcGxheV9zdGF0ZSwgdmlzaWJsZV9vbmx5LCBzb3J0aW5nX3N0YXRlICkge1xuXHRcdHZhciBjb2x1bW5fY29uZmlnID0gY29uZmlnLmNvbHVtbnMgfHwge307XG5cdFx0dmFyIGRlZmluaXRpb25zID0gY29sdW1uX2NvbmZpZy5kZWZpbml0aW9ucyB8fCB7fTtcblx0XHR2YXIgZGVmYXVsdF9vcmRlciA9IEFycmF5LmlzQXJyYXkoIGNvbHVtbl9jb25maWcuZGVmYXVsdF9vcmRlciApID8gY29sdW1uX2NvbmZpZy5kZWZhdWx0X29yZGVyIDogW107XG5cdFx0dmFyIG9yZGVyID0gZGlzcGxheV9zdGF0ZSAmJiBBcnJheS5pc0FycmF5KCBkaXNwbGF5X3N0YXRlLmNvbHVtbl9vcmRlciApID8gZGlzcGxheV9zdGF0ZS5jb2x1bW5fb3JkZXIuc2xpY2UoKSA6IGRlZmF1bHRfb3JkZXIuc2xpY2UoKTtcblx0XHR2YXIgdmlzaWJsZV9jb2x1bW5zID0gZGlzcGxheV9zdGF0ZSAmJiBBcnJheS5pc0FycmF5KCBkaXNwbGF5X3N0YXRlLnZpc2libGVfY29sdW1ucyApID8gZGlzcGxheV9zdGF0ZS52aXNpYmxlX2NvbHVtbnMgOiBjb2x1bW5fY29uZmlnLmRlZmF1bHRfdmlzaWJsZSB8fCBbXTtcblxuXHRcdGRlZmF1bHRfb3JkZXIuZm9yRWFjaCggZnVuY3Rpb24gKCBjb2x1bW5faWQgKSB7XG5cdFx0XHRpZiAoIC0xID09PSBvcmRlci5pbmRleE9mKCBjb2x1bW5faWQgKSApIHtcblx0XHRcdFx0b3JkZXIucHVzaCggY29sdW1uX2lkICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIG9yZGVyLmZpbHRlciggZnVuY3Rpb24gKCBjb2x1bW5faWQgKSB7XG5cdFx0XHRyZXR1cm4gZGVmaW5pdGlvbnNbIGNvbHVtbl9pZCBdICYmICggISB2aXNpYmxlX29ubHkgfHwgLTEgIT09IHZpc2libGVfY29sdW1ucy5pbmRleE9mKCBjb2x1bW5faWQgKSApO1xuXHRcdH0gKS5tYXAoIGZ1bmN0aW9uICggY29sdW1uX2lkLCBjb2x1bW5faW5kZXggKSB7XG5cdFx0XHR2YXIgZGVmaW5pdGlvbiA9IGRlZmluaXRpb25zWyBjb2x1bW5faWQgXTtcblx0XHRcdHZhciBpc19zb3J0ZWQgPSAhISBkZWZpbml0aW9uLnNvcnRfa2V5ICYmIHNvcnRpbmdfc3RhdGUgJiYgZGVmaW5pdGlvbi5zb3J0X2tleSA9PT0gc29ydGluZ19zdGF0ZS5zb3J0X2J5O1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0YXJpYV9zb3J0OiBpc19zb3J0ZWQgPyAoICdkZXNjJyA9PT0gc29ydGluZ19zdGF0ZS5zb3J0X29yZGVyID8gJ2Rlc2NlbmRpbmcnIDogJ2FzY2VuZGluZycgKSA6ICdub25lJyxcblx0XHRcdFx0Y2xhc3NfbmFtZTogZGVmaW5pdGlvbi5jbGFzcyB8fCAnY29sdW1uLScgKyBjb2x1bW5faWQsXG5cdFx0XHRcdGRlZmF1bHRfaW5kZXg6IGRlZmF1bHRfb3JkZXIuaW5kZXhPZiggY29sdW1uX2lkICksXG5cdFx0XHRcdGlkOiBjb2x1bW5faWQsXG5cdFx0XHRcdGlzX3NvcnRlZDogaXNfc29ydGVkLFxuXHRcdFx0XHRsYWJlbDogZGVmaW5pdGlvbi5sYWJlbCB8fCBjb2x1bW5faWQsXG5cdFx0XHRcdG1vdmVfbGFiZWw6IGZvcm1hdF9tZXNzYWdlKCBjb25maWcuaTE4bi5tb3ZlX2NvbHVtbiB8fCAnJywgWyBkZWZpbml0aW9uLmxhYmVsIHx8IGNvbHVtbl9pZCBdICksXG5cdFx0XHRcdHJlb3JkZXJhYmxlOiBmYWxzZSAhPT0gZGVmaW5pdGlvbi5yZW9yZGVyYWJsZSxcblx0XHRcdFx0cmVxdWlyZWQ6ICEhIGRlZmluaXRpb24ucmVxdWlyZWQsXG5cdFx0XHRcdHNvcnRfaWNvbjogaXNfc29ydGVkID8gKCAnZGVzYycgPT09IHNvcnRpbmdfc3RhdGUuc29ydF9vcmRlciA/ICd3cGJjLWJpLWFycm93LWRvd24nIDogJ3dwYmMtYmktYXJyb3ctdXAnICkgOiAnd3BiY19pY25faW1wb3J0X2V4cG9ydCcsXG5cdFx0XHRcdHNvcnRfa2V5OiBkZWZpbml0aW9uLnNvcnRfa2V5IHx8ICcnLFxuXHRcdFx0XHR2aXNpYmxlOiAtMSAhPT0gdmlzaWJsZV9jb2x1bW5zLmluZGV4T2YoIGNvbHVtbl9pZCApXG5cdFx0XHR9O1xuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBEZXRlcm1pbmUgd2hldGhlciBkaXNwbGF5IHZhbHVlcyBtYXRjaCB0aGUgT3ZlcnZpZXcgZGVmYXVsdHMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgICAgICAgIFJlZ2lzdGVyZWQgY2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gZGlzcGxheV9zdGF0ZSBDdXJyZW50IG5vcm1hbGl6ZWQgZGlzcGxheSBzdGF0ZS5cblx0ICogQHJldHVybiB7c3RyaW5nfSBvdmVydmlldyBvciBjdXN0b20uXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfYWN0aXZlX3ZpZXcoIGNvbmZpZywgZGlzcGxheV9zdGF0ZSApIHtcblx0XHR2YXIgdmlld19kZWZpbml0aW9ucyA9IGNvbmZpZy52aWV3cyAmJiBjb25maWcudmlld3MuZGVmaW5pdGlvbnMgPyBjb25maWcudmlld3MuZGVmaW5pdGlvbnMgOiB7fTtcblx0XHR2YXIgY3VycmVudF92aXNpYmxlID0gZGlzcGxheV9zdGF0ZSAmJiBBcnJheS5pc0FycmF5KCBkaXNwbGF5X3N0YXRlLnZpc2libGVfY29sdW1ucyApID8gZGlzcGxheV9zdGF0ZS52aXNpYmxlX2NvbHVtbnMgOiBbXTtcblx0XHR2YXIgbWF0Y2hpbmdfdmlldyA9ICcnO1xuXG5cdFx0T2JqZWN0LmtleXMoIHZpZXdfZGVmaW5pdGlvbnMgKS5zb21lKCBmdW5jdGlvbiAoIHZpZXdfaWQgKSB7XG5cdFx0XHR2YXIgdmlld19maWVsZHMgPSBBcnJheS5pc0FycmF5KCB2aWV3X2RlZmluaXRpb25zWyB2aWV3X2lkIF0uZmllbGRzICkgPyB2aWV3X2RlZmluaXRpb25zWyB2aWV3X2lkIF0uZmllbGRzIDogW107XG5cdFx0XHRpZiAoIEpTT04uc3RyaW5naWZ5KCBjdXJyZW50X3Zpc2libGUgKSA9PT0gSlNPTi5zdHJpbmdpZnkoIHZpZXdfZmllbGRzICkgKSB7XG5cdFx0XHRcdG1hdGNoaW5nX3ZpZXcgPSB2aWV3X2lkO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gbWF0Y2hpbmdfdmlldyB8fCAnY3VzdG9tJztcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gb3JkZXJlZCB2aWV3IHByZXNldHMgZGVjbGFyZWQgYnkgdGhlIGluZGVwZW5kZW50IFBIUCBjb25maWd1cmF0aW9uLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnIFJlZ2lzdGVyZWQgY2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcmV0dXJuIHtBcnJheTxPYmplY3Q+fSBCcm93c2VyLXNhZmUgdmlldyBkZWZpbml0aW9ucy5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF92aWV3X2RlZmluaXRpb25zKCBjb25maWcgKSB7XG5cdFx0dmFyIGRlZmluaXRpb25zID0gY29uZmlnLnZpZXdzICYmIGNvbmZpZy52aWV3cy5kZWZpbml0aW9ucyA/IGNvbmZpZy52aWV3cy5kZWZpbml0aW9ucyA6IHt9O1xuXG5cdFx0cmV0dXJuIE9iamVjdC5rZXlzKCBkZWZpbml0aW9ucyApLm1hcCggZnVuY3Rpb24gKCB2aWV3X2lkICkge1xuXHRcdFx0cmV0dXJuIGRlZmluaXRpb25zWyB2aWV3X2lkIF07XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiB0aGUgYWxsb3ctbGlzdGVkIHByZXNlbnRhdGlvbiBwYWNrcyBkZWNsYXJlZCBieSBQSFAuXG5cdCAqXG5cdCAqIExhYmVscyByZW1haW4gZG9tYWluLW93bmVkIHdoaWxlIHRoZSBzaGFyZWQgY29udHJvbGxlciB2YWxpZGF0ZXMgYW5kXG5cdCAqIHBlcnNpc3RzIG9ubHkgcGFjayBpZGVudGlmaWVycyByZWdpc3RlcmVkIGluIHRoZSBjYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgUmVnaXN0ZXJlZCBjYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEByZXR1cm4ge0FycmF5PE9iamVjdD59IE9yZGVyZWQgYnJvd3Nlci1zYWZlIHBhY2sgb3B0aW9ucy5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF90ZW1wbGF0ZV9wYWNrX2RlZmluaXRpb25zKCBjb25maWcgKSB7XG5cdFx0dmFyIGxhYmVscyA9IHtcblx0XHRcdGNhcmRzOiBjb25maWcuaTE4bi5sYXlvdXRfY2FyZHMgfHwgJycsXG5cdFx0XHRjb21wYWN0OiBjb25maWcuaTE4bi5sYXlvdXRfY29tcGFjdCB8fCAnJyxcblx0XHRcdHRhYmxlOiBjb25maWcuaTE4bi5sYXlvdXRfdGFibGUgfHwgJydcblx0XHR9O1xuXHRcdHZhciB0ZW1wbGF0ZV9wYWNrcyA9IGNvbmZpZy50ZW1wbGF0ZV9wYWNrcyB8fCB7fTtcblxuXHRcdHJldHVybiBPYmplY3Qua2V5cyggdGVtcGxhdGVfcGFja3MgKS5tYXAoIGZ1bmN0aW9uICggdGVtcGxhdGVfcGFja19pZCApIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGlkOiB0ZW1wbGF0ZV9wYWNrX2lkLFxuXHRcdFx0XHRsYWJlbDogbGFiZWxzWyB0ZW1wbGF0ZV9wYWNrX2lkIF0gfHwgdGVtcGxhdGVfcGFja19pZFxuXHRcdFx0fTtcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogUmVuZGVyIHRoZSBlc3RhYmxpc2hlZCBSZXNvdXJjZSBmaWx0ZXJzIGFib3ZlIHRoZSBib3JkZXJlZCBsaXN0aW5nLlxuXHQgKlxuXHQgKiBGcmVlIGVkaXRpb25zIGludGVudGlvbmFsbHkgcmVuZGVyIG5vIGZpbHRlciBmb3JtLCBtYXRjaGluZyB0aGUgZXhpc3Rpbmdcblx0ICogcGFnZSB3aGVyZSBhIHNpbmdsZSBkZWZhdWx0IFJlc291cmNlIG1ha2VzIHRoZXNlIGNvbnRyb2xzIHVubmVjZXNzYXJ5LlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnIFJlZ2lzdGVyZWQgY2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIGZpbHRlcnMgdGFyZ2V0IHdhcyBmb3VuZC5cblx0ICovXG5cdGZ1bmN0aW9uIHJlbmRlcl9ib29raW5nX3Jlc291cmNlc19maWx0ZXJzKCBjb25maWcgKSB7XG5cdFx0dmFyIGluaXRpYWxfcmVxdWVzdCA9IGNvbmZpZy5pbml0aWFsX3JlcXVlc3QgfHwge307XG5cdFx0dmFyIG1vdW50X2VsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggY29uZmlnLm1vdW50X2lkICk7XG5cdFx0dmFyIGZpbHRlcnNfdGFyZ2V0ID0gbW91bnRfZWxlbWVudCA/IG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZXMtZmlsdGVyc10nICkgOiBudWxsO1xuXG5cdFx0aWYgKCAhIGZpbHRlcnNfdGFyZ2V0ICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRmaWx0ZXJzX3RhcmdldC5pbm5lckhUTUwgPSByZW5kZXJfY29tcG9uZW50KCBjb25maWcsICdmaWx0ZXJzJywge1xuXHRcdFx0aTE4bjogY29uZmlnLmkxOG4gfHwge30sXG5cdFx0XHRyZXNvdXJjZV90eXBlOiBpbml0aWFsX3JlcXVlc3QucmVzb3VyY2VfdHlwZSB8fCAnYWxsJyxcblx0XHRcdHNlYXJjaDogaW5pdGlhbF9yZXF1ZXN0LnNlYXJjaCB8fCAnJyxcblx0XHRcdHNob3dfZmlsdGVyczogISEgKCBjb25maWcuZmVhdHVyZXMgJiYgY29uZmlnLmZlYXR1cmVzLnJlc291cmNlX2ZpbHRlcnMgKSxcblx0XHRcdHNob3dfcmVzb3VyY2VfdHlwZV9maWx0ZXI6ICEhICggY29uZmlnLmZlYXR1cmVzICYmIGNvbmZpZy5mZWF0dXJlcy5yZXNvdXJjZV90eXBlX2ZpbHRlciApXG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHQvKipcblx0ICogUmVuZGVyIHBlcnNpc3RlbnQgZmlsdGVycyBhbmQgZGlzcGxheSBjb250cm9scyBvdXRzaWRlIHJlc3BvbnNlIGNvbnRlbnQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgUmVnaXN0ZXJlZCBjYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgdG9vbGJhciB0YXJnZXQgd2FzIHBvcHVsYXRlZC5cblx0ICovXG5cdGZ1bmN0aW9uIHJlbmRlcl9ib29raW5nX3Jlc291cmNlc190b29sYmFyKCBjb25maWcgKSB7XG5cdFx0dmFyIGluaXRpYWxfcmVxdWVzdCA9IGNvbmZpZy5pbml0aWFsX3JlcXVlc3QgfHwge307XG5cdFx0dmFyIG1vdW50X2VsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggY29uZmlnLm1vdW50X2lkICk7XG5cdFx0dmFyIHRvb2xiYXJfdGFyZ2V0ID0gbW91bnRfZWxlbWVudCA/IG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZXMtdG9vbGJhcl0nICkgOiBudWxsO1xuXG5cdFx0aWYgKCAhIHRvb2xiYXJfdGFyZ2V0ICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHR0b29sYmFyX3RhcmdldC5pbm5lckhUTUwgPSByZW5kZXJfY29tcG9uZW50KCBjb25maWcsICd0b29sYmFyJywge1xuXHRcdFx0YWN0aXZlX3RlbXBsYXRlX3BhY2s6IGluaXRpYWxfcmVxdWVzdC50ZW1wbGF0ZV9wYWNrIHx8IGNvbmZpZy5kZWZhdWx0X3RlbXBsYXRlX3BhY2sgfHwgJ3RhYmxlJyxcblx0XHRcdGFjdGl2ZV92aWV3OiBnZXRfYWN0aXZlX3ZpZXcoIGNvbmZpZywgaW5pdGlhbF9yZXF1ZXN0ICksXG5cdFx0XHRjb2x1bW5zOiBnZXRfY29sdW1ucyggY29uZmlnLCBpbml0aWFsX3JlcXVlc3QsIGZhbHNlLCBpbml0aWFsX3JlcXVlc3QgKSxcblx0XHRcdGkxOG46IGNvbmZpZy5pMThuIHx8IHt9LFxuXHRcdFx0dGVtcGxhdGVfcGFja3M6IGdldF90ZW1wbGF0ZV9wYWNrX2RlZmluaXRpb25zKCBjb25maWcgKSxcblx0XHRcdHZpZXdzOiBnZXRfdmlld19kZWZpbml0aW9ucyggY29uZmlnIClcblx0XHR9ICk7XG5cdFx0aWYgKCBjYXRhbG9nX2NvbnRyb2xsZXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNhdGFsb2dfY29udHJvbGxlci5yZWZyZXNoX2NvbnRyb2xzICkge1xuXHRcdFx0Y2F0YWxvZ19jb250cm9sbGVyLnJlZnJlc2hfY29udHJvbHMoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gISEgdG9vbGJhcl90YXJnZXQuZmlyc3RFbGVtZW50Q2hpbGQ7XG5cdH1cblxuXHQvKipcblx0ICogQWRkIGZ1bGwtdGV4dCB0b29sdGlwcyBvbmx5IHRvIGVsZW1lbnRzIHdob3NlIHJlbmRlcmVkIHRleHQgaXMgY2xpcHBlZC5cblx0ICpcblx0ICogTmF0aXZlIHRpdGxlIHRleHQgcmVtYWlucyBhdmFpbGFibGUgd2l0aG91dCBhIEphdmFTY3JpcHQgdG9vbHRpcCBsaWJyYXJ5O1xuXHQgKiB0aGUgZXN0YWJsaXNoZWQgdG9vbHRpcCBhdHRyaWJ1dGVzIGFyZSBhbHNvIHN1cHBsaWVkIGZvciBCb29raW5nIENhbGVuZGFyXG5cdCAqIGFkbWluIHRoZW1lcyB0aGF0IGluaXRpYWxpemUgdGhlbSBnbG9iYWxseS5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gY2F0YWxvZ19tb3VudCBDYXRhbG9nIG1vdW50IGVsZW1lbnQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzeW5jaHJvbml6ZV9vdmVyZmxvd190b29sdGlwcyggY2F0YWxvZ19tb3VudCApIHtcblx0XHRpZiAoICEgd2luZG93LndwYmNfdWlfY2F0YWxvZyB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93LndwYmNfdWlfY2F0YWxvZy5zeW5jaHJvbml6ZV9vdmVyZmxvd190b29sdGlwcyApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR3aW5kb3cud3BiY191aV9jYXRhbG9nLnN5bmNocm9uaXplX292ZXJmbG93X3Rvb2x0aXBzKCBjYXRhbG9nX21vdW50ICk7XG5cdH1cblxuXHQvKipcblx0ICogSW5pdGlhbGl6ZSB0b29sdGlwcyBmb3IgY29tcGFjdCBjb250cm9scyBpbnNlcnRlZCBieSBhIGxhenkgZGV0YWlscyByZW5kZXIuXG5cdCAqXG5cdCAqIFRoZSBuYXRpdmUgdGl0bGUgcmVtYWlucyBhcyBhIGZhbGxiYWNrIHdoZW4gdGhlIGVzdGFibGlzaGVkIEJvb2tpbmdcblx0ICogQ2FsZW5kYXIgdG9vbHRpcCBoZWxwZXIgaXMgdW5hdmFpbGFibGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGNhdGFsb2dfbW91bnQgQ2F0YWxvZyBtb3VudCBlbGVtZW50LlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gaW5pdGlhbGl6ZV9kZXRhaWxzX3Rvb2x0aXBzKCBjYXRhbG9nX21vdW50ICkge1xuXHRcdHZhciB0b29sdGlwX3NlbGVjdG9yO1xuXG5cdFx0aWYgKCAhIGNhdGFsb2dfbW91bnQgfHwgISBjYXRhbG9nX21vdW50LmlkIHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiB3aW5kb3cud3BiY19kZWZpbmVfdGlwcHlfdG9vbHRpcHMgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRvb2x0aXBfc2VsZWN0b3IgPSAnIycgKyBjYXRhbG9nX21vdW50LmlkICsgJyBbZGF0YS13cGJjLXVpLWNhdGFsb2ctZGV0YWlscy10b29sdGlwXSc7XG5cdFx0d2luZG93LndwYmNfZGVmaW5lX3RpcHB5X3Rvb2x0aXBzKCB0b29sdGlwX3NlbGVjdG9yICk7XG5cdH1cblxuXHQvKipcblx0ICogU3luY2hyb25pemUgcGVyc2lzdGVudCBjb250cm9scyB3aXRoIHNlcnZlci1hdXRob3JpdGF0aXZlIHJlc3BvbnNlIHN0YXRlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnICAgUmVnaXN0ZXJlZCBjYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSByZXNwb25zZSBOb3JtYWxpemVkIGNhdGFsb2cgcmVzcG9uc2UuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzeW5jaHJvbml6ZV9ib29raW5nX3Jlc291cmNlc190b29sYmFyKCBjb25maWcsIHJlc3BvbnNlICkge1xuXHRcdHZhciBjb2x1bW5zID0gZ2V0X2NvbHVtbnMoIGNvbmZpZywgcmVzcG9uc2UuZGlzcGxheSB8fCB7fSwgZmFsc2UsIHJlc3BvbnNlLnNvcnRpbmcgfHwge30gKTtcblx0XHR2YXIgbW91bnRfZWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBjb25maWcubW91bnRfaWQgKTtcblx0XHR2YXIgY29sdW1uX2xpc3QgPSBtb3VudF9lbGVtZW50ID8gbW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWNvbHVtbi1saXN0XScgKSA6IG51bGw7XG5cdFx0dmFyIHNlYXJjaF9jb250cm9sID0gbW91bnRfZWxlbWVudCA/IG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1zZWFyY2hdJyApIDogbnVsbDtcblx0XHR2YXIgdGVtcGxhdGVfcGFja19jb250cm9sID0gbW91bnRfZWxlbWVudCA/IG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy10ZW1wbGF0ZS1wYWNrXScgKSA6IG51bGw7XG5cdFx0dmFyIHR5cGVfY29udHJvbCA9IG1vdW50X2VsZW1lbnQgPyBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctZmlsdGVyPVwicmVzb3VyY2VfdHlwZVwiXScgKSA6IG51bGw7XG5cdFx0dmFyIHZpZXdfY29udHJvbCA9IG1vdW50X2VsZW1lbnQgPyBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctdmlld10nICkgOiBudWxsO1xuXG5cdFx0aWYgKCBzZWFyY2hfY29udHJvbCAmJiBkb2N1bWVudC5hY3RpdmVFbGVtZW50ICE9PSBzZWFyY2hfY29udHJvbCApIHtcblx0XHRcdHNlYXJjaF9jb250cm9sLnZhbHVlID0gcmVzcG9uc2UuZmlsdGVycy5zZWFyY2ggfHwgJyc7XG5cdFx0fVxuXHRcdGlmICggdHlwZV9jb250cm9sICkge1xuXHRcdFx0dHlwZV9jb250cm9sLnZhbHVlID0gcmVzcG9uc2UuZmlsdGVycy5yZXNvdXJjZV90eXBlIHx8ICdhbGwnO1xuXHRcdH1cblx0XHRpZiAoIHRlbXBsYXRlX3BhY2tfY29udHJvbCAmJiByZXNwb25zZS5kaXNwbGF5ICYmIHJlc3BvbnNlLmRpc3BsYXkudGVtcGxhdGVfcGFjayApIHtcblx0XHRcdHRlbXBsYXRlX3BhY2tfY29udHJvbC52YWx1ZSA9IHJlc3BvbnNlLmRpc3BsYXkudGVtcGxhdGVfcGFjaztcblx0XHR9XG5cdFx0Y29sdW1ucy5mb3JFYWNoKCBmdW5jdGlvbiAoIGNvbHVtbiApIHtcblx0XHRcdHZhciBjb2x1bW5fY29udHJvbCA9IG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1jb2x1bW4tdmlzaWJsZV1bdmFsdWU9XCInICsgY29sdW1uLmlkICsgJ1wiXScgKTtcblx0XHRcdHZhciBjb2x1bW5faXRlbSA9IG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1jb2x1bW4taXRlbT1cIicgKyBjb2x1bW4uaWQgKyAnXCJdJyApO1xuXHRcdFx0aWYgKCBjb2x1bW5fY29udHJvbCApIHtcblx0XHRcdFx0Y29sdW1uX2NvbnRyb2wuY2hlY2tlZCA9IGNvbHVtbi52aXNpYmxlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjb2x1bW5fbGlzdCAmJiBjb2x1bW5faXRlbSApIHtcblx0XHRcdFx0Y29sdW1uX2xpc3QuYXBwZW5kQ2hpbGQoIGNvbHVtbl9pdGVtICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHRcdGlmICggdmlld19jb250cm9sICkge1xuXHRcdFx0dmlld19jb250cm9sLnZhbHVlID0gZ2V0X2FjdGl2ZV92aWV3KCBjb25maWcsIHJlc3BvbnNlLmRpc3BsYXkgfHwge30gKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogUmVuZGVyIHRoZSBwZXJzaXN0ZW50IGlubGluZS1lZGl0IHN0YXR1cyBiYXIgZnJvbSBpdHMgcmVnaXN0ZXJlZCB0ZW1wbGF0ZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiByZW5kZXJfaW5saW5lX2JhciggY29uZmlnICkge1xuXHRcdHZhciBtb3VudF9lbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIGNvbmZpZy5tb3VudF9pZCApO1xuXHRcdHZhciBpbmxpbmVfaG9zdCA9IG1vdW50X2VsZW1lbnQgPyBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctaW5saW5lLWJhci1ob3N0XScgKSA6IG51bGw7XG5cblx0XHRpZiAoIGlubGluZV9ob3N0ICYmICEgaW5saW5lX2hvc3QuZmlyc3RFbGVtZW50Q2hpbGQgKSB7XG5cdFx0XHRpbmxpbmVfaG9zdC5pbm5lckhUTUwgPSByZW5kZXJfY29tcG9uZW50KCBjb25maWcsICdpbmxpbmVfYmFyJywgeyBpMThuOiBjb25maWcuaTE4biB8fCB7fSB9ICk7XG5cdFx0fVxuXHRcdGlmICggaW5saW5lX3dvcmtmbG93X2NvbnRyb2xsZXIgKSB7XG5cdFx0XHRpbmxpbmVfd29ya2Zsb3dfY29udHJvbGxlci5yZWdpc3Rlcl9zdGlja3lfYmFyKCk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFN5bmNocm9uaXplIGlubGluZSBhY3RpdmF0aW9uLCBjaGFuZ2VkIGNvdW50LCBhbmQgZGlzYWJsZWQgbmF2aWdhdGlvbi5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzeW5jaHJvbml6ZV9pbmxpbmVfY29udHJvbHMoIGNvbmZpZyApIHtcblx0XHR2YXIgbW91bnRfZWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBjb25maWcubW91bnRfaWQgKTtcblx0XHR2YXIgY2hhbmdlZF9jb3VudCA9IGlubGluZV9zdGF0ZS5jaGFuZ2VkX3Jvd3MubGVuZ3RoO1xuXHRcdHZhciBjb3VudF9sYWJlbCA9IDEgPT09IGNoYW5nZWRfY291bnQgPyBjb25maWcuaTE4bi5pbmxpbmVfY2hhbmdlZF9yb3cgOiBjb25maWcuaTE4bi5pbmxpbmVfY2hhbmdlZF9yb3dzO1xuXG5cdFx0aWYgKCAhIG1vdW50X2VsZW1lbnQgfHwgISBpbmxpbmVfd29ya2Zsb3dfY29udHJvbGxlciApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpbmxpbmVfd29ya2Zsb3dfY29udHJvbGxlci5zeW5jaHJvbml6ZSgge1xuXHRcdFx0YWN0aXZlOiBpbmxpbmVfc3RhdGUuYWN0aXZlLFxuXHRcdFx0YWN0aXZlX3RvZ2dsZV90ZXh0OiBjb25maWcuaTE4bi5pbmxpbmVfZWRpdGluZ19yb3dzIHx8ICcnLFxuXHRcdFx0YnVzeTogaW5saW5lX3N0YXRlLmxvYWRpbmcsXG5cdFx0XHRjaGFuZ2VkX2NvdW50OiBjaGFuZ2VkX2NvdW50LFxuXHRcdFx0Y291bnRfdGV4dDogaW5saW5lX3N0YXRlLmxvYWRpbmdcblx0XHRcdFx0PyBjb25maWcuaTE4bi5pbmxpbmVfbG9hZGluZyB8fCAnJ1xuXHRcdFx0XHQ6IGZvcm1hdF9tZXNzYWdlKCBjb3VudF9sYWJlbCB8fCAnJTEkcyBjaGFuZ2VkIHJvd3MnLCBbIGNoYW5nZWRfY291bnQgXSApLFxuXHRcdFx0aGFzX2l0ZW1zOiAhISBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtaWRdJyApLFxuXHRcdFx0aW5hY3RpdmVfdG9nZ2xlX3RleHQ6IGNvbmZpZy5pMThuLmVkaXRfcm93cyB8fCAnJ1xuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBCbG9jayBwYWdlLWNoYW5naW5nIGNhdGFsb2cgY29udHJvbHMgYmVmb3JlIHNoYXJlZCBoYW5kbGVycyBjYW4gZGlzY2FyZCBkcmFmdHMuXG5cdCAqXG5cdCAqIE5hdGl2ZSBzdW1tYXJ5IGVsZW1lbnRzIGRvIG5vdCBob25vciBhIGRpc2FibGVkIHByb3BlcnR5LCBzbyB0aGlzIGNhcHR1cmVcblx0ICogZ3VhcmQgY29tcGxlbWVudHMgdGhlIHZpc3VhbCBkaXNhYmxlZCBzdGF0ZSB3aGlsZSBpbmxpbmUgZWRpdGluZyBpcyBhY3RpdmUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50IENhcHR1cmVkIGNhdGFsb2cgZXZlbnQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBwcm90ZWN0X2lubGluZV9kcmFmdHNfZnJvbV9jYXRhbG9nX2NvbnRyb2xzKCBldmVudCApIHtcblx0XHRpZiAoIGlubGluZV93b3JrZmxvd19jb250cm9sbGVyICkge1xuXHRcdFx0aW5saW5lX3dvcmtmbG93X2NvbnRyb2xsZXIucHJvdGVjdF9ldmVudCggZXZlbnQsIGlubGluZV9zdGF0ZS5hY3RpdmUgKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogU2hvdyBvciBjbGVhciBhbiBpbmxpbmUgd29ya2Zsb3cgZXJyb3IuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgQ2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSBTYWZlIG1lc3NhZ2Ugb3IgZW1wdHkgc3RyaW5nLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc2hvd19pbmxpbmVfbWVzc2FnZSggY29uZmlnLCBtZXNzYWdlICkge1xuXHRcdHZhciBtb3VudF9lbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIGNvbmZpZy5tb3VudF9pZCApO1xuXHRcdHZhciBub3RpY2UgPSBtb3VudF9lbGVtZW50ID8gbW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLWlubGluZS1tZXNzYWdlXScgKSA6IG51bGw7XG5cblx0XHRpZiAoIG5vdGljZSApIHtcblx0XHRcdG5vdGljZS5oaWRkZW4gPSAhIG1lc3NhZ2U7XG5cdFx0XHR2YXIgdGV4dCA9IG5vdGljZS5xdWVyeVNlbGVjdG9yKCAncCcgKTtcblx0XHRcdGlmICggdGV4dCApIHtcblx0XHRcdFx0dGV4dC50ZXh0Q29udGVudCA9IG1lc3NhZ2UgfHwgJyc7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFJlbmRlciBvbmUgc2VydmVyLWRlY2xhcmVkIGZpZWxkIHRocm91Z2ggdGhlIGlubGluZSBXUCB0ZW1wbGF0ZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSByb3dfc2NoZW1hIFJvdyBzY2hlbWEuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiByZW5kZXJfaW5saW5lX3JvdyggY29uZmlnLCByb3dfc2NoZW1hICkge1xuXHRcdHZhciBtb3VudF9lbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIGNvbmZpZy5tb3VudF9pZCApO1xuXHRcdHZhciByZXNvdXJjZV9pZCA9IE51bWJlciggcm93X3NjaGVtYS5yZXNvdXJjZV9pZCApIHx8IDA7XG5cdFx0dmFyIHJvdyA9IG1vdW50X2VsZW1lbnQgPyBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtaWQ9XCInICsgcmVzb3VyY2VfaWQgKyAnXCJdJyApIDogbnVsbDtcblx0XHR2YXIgcmVzb3VyY2VfZmllbGRzID0gW107XG5cblx0XHRpZiAoICEgcm93ICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHQoIHJvd19zY2hlbWEuZmllbGRzIHx8IFtdICkuZm9yRWFjaCggZnVuY3Rpb24gKCBmaWVsZCApIHtcblx0XHRcdHZhciBjZWxsID0gcm93LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctZmllbGQ9XCInICsgU3RyaW5nKCBmaWVsZC5jb2x1bW4gfHwgJycgKSArICdcIl0nICk7XG5cdFx0XHRpZiAoICEgY2VsbCB8fCBjZWxsLmhpZGRlbiApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAncmVzb3VyY2UnID09PSBmaWVsZC5jb2x1bW4gKSB7XG5cdFx0XHRcdHJlc291cmNlX2ZpZWxkcy5wdXNoKCBmaWVsZCApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjZWxsLmlubmVySFRNTCA9IHJlbmRlcl9jb21wb25lbnQoIGNvbmZpZywgJ2lubGluZV9maWVsZCcsIHsgZmllbGQ6IGZpZWxkLCByZXNvdXJjZV9pZDogcmVzb3VyY2VfaWQgfSApO1xuXHRcdH0gKTtcblx0XHRpZiAoIHJlc291cmNlX2ZpZWxkcy5sZW5ndGggKSB7XG5cdFx0XHR2YXIgY29weSA9IHJvdy5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWZpZWxkPVwicmVzb3VyY2VcIl0gLndwYmNfdWlfbGlzdGluZ19faXRlbV9jb3B5JyApO1xuXHRcdFx0aWYgKCBjb3B5ICkge1xuXHRcdFx0XHR2YXIgd3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdzcGFuJyApO1xuXHRcdFx0XHR3cmFwcGVyLmNsYXNzTmFtZSA9ICd3cGJjX2Jvb2tpbmdfcmVzb3VyY2VzX19pbmxpbmVfaWRlbnRpdHlfZmllbGRzJztcblx0XHRcdFx0cmVzb3VyY2VfZmllbGRzLmZvckVhY2goIGZ1bmN0aW9uICggZmllbGQgKSB7XG5cdFx0XHRcdFx0d3JhcHBlci5pbnNlcnRBZGphY2VudEhUTUwoICdiZWZvcmVlbmQnLCByZW5kZXJfY29tcG9uZW50KCBjb25maWcsICdpbmxpbmVfZmllbGQnLCB7IGZpZWxkOiBmaWVsZCwgcmVzb3VyY2VfaWQ6IHJlc291cmNlX2lkIH0gKSApO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdGNvcHkucmVwbGFjZVdpdGgoIHdyYXBwZXIgKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQ29sbGVjdCBvbmx5IGNoYW5nZWQgcm93IGZpZWxkcyB3aGlsZSBwcmVzZXJ2aW5nIHZpc2libGUgY2F0YWxvZyBvcmRlci5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEByZXR1cm4ge0FycmF5PE9iamVjdD59IENoYW5nZWQgcm93IGVudmVsb3Blcy5cblx0ICovXG5cdGZ1bmN0aW9uIGNvbGxlY3RfaW5saW5lX2RyYWZ0cyggY29uZmlnICkge1xuXHRcdHZhciBtb3VudF9lbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIGNvbmZpZy5tb3VudF9pZCApO1xuXHRcdHZhciBjaGFuZ2VkX3Jvd3MgPSBbXTtcblxuXHRcdGlmICggISBtb3VudF9lbGVtZW50ICkge1xuXHRcdFx0cmV0dXJuIGNoYW5nZWRfcm93cztcblx0XHR9XG5cdFx0bW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYm9va2luZ19yZXNvdXJjZXNfX2l0ZW1bZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtaWRdJyApLmZvckVhY2goIGZ1bmN0aW9uICggcm93ICkge1xuXHRcdFx0dmFyIGZpZWxkcyA9IHt9O1xuXHRcdFx0dmFyIGhhc19jaGFuZ2VzO1xuXHRcdFx0dmFyIGluZGljYXRvcl9ob3N0O1xuXG5cdFx0XHRyb3cucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtY2F0YWxvZy1pbmxpbmUtZmllbGRdJyApLmZvckVhY2goIGZ1bmN0aW9uICggY29udHJvbCApIHtcblx0XHRcdFx0dmFyIGZpZWxkX2tleSA9IGNvbnRyb2wuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWNhdGFsb2ctaW5saW5lLWZpZWxkJyApIHx8ICcnO1xuXHRcdFx0XHRpZiAoIGZpZWxkX2tleSAmJiBTdHJpbmcoIGNvbnRyb2wudmFsdWUgfHwgJycgKSAhPT0gU3RyaW5nKCBjb250cm9sLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1jYXRhbG9nLWlubGluZS1vcmlnaW5hbCcgKSB8fCAnJyApICkge1xuXHRcdFx0XHRcdGZpZWxkc1sgZmllbGRfa2V5IF0gPSBjb250cm9sLnZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRoYXNfY2hhbmdlcyA9IDAgPCBPYmplY3Qua2V5cyggZmllbGRzICkubGVuZ3RoO1xuXHRcdFx0aW5kaWNhdG9yX2hvc3QgPSByb3cucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1maWVsZD1cInJlc291cmNlXCJdJyApO1xuXHRcdFx0cm93LmNsYXNzTGlzdC50b2dnbGUoICdpcy1pbmxpbmUtZGlydHknLCBoYXNfY2hhbmdlcyApO1xuXHRcdFx0aWYgKCBpbmxpbmVfd29ya2Zsb3dfY29udHJvbGxlciApIHtcblx0XHRcdFx0aW5saW5lX3dvcmtmbG93X2NvbnRyb2xsZXIuc2V0X3Jvd19jaGFuZ2VkKCByb3csIGhhc19jaGFuZ2VzLCBpbmRpY2F0b3JfaG9zdCwgY29uZmlnLmkxOG4uaW5saW5lX2NoYW5nZWQgfHwgJycgKTtcblx0XHRcdH1cblx0XHRcdGlmICggaGFzX2NoYW5nZXMgKSB7XG5cdFx0XHRcdGNoYW5nZWRfcm93cy5wdXNoKCB7IHJlc291cmNlX2lkOiBOdW1iZXIoIHJvdy5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1pZCcgKSApLCBmaWVsZHM6IGZpZWxkcyB9ICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIGNoYW5nZWRfcm93cztcblx0fVxuXG5cdC8qKlxuXHQgKiBJbnZhbGlkYXRlIGEgcHJpb3IgcmV2aWV3IGFuZCBzeW5jaHJvbml6ZSBkcmFmdCBzdGF0ZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzeW5jaHJvbml6ZV9pbmxpbmVfZHJhZnRzKCBjb25maWcgKSB7XG5cdFx0aW5saW5lX3N0YXRlLmNoYW5nZWRfcm93cyA9IGNvbGxlY3RfaW5saW5lX2RyYWZ0cyggY29uZmlnICk7XG5cdFx0aW5saW5lX3N0YXRlLnJldmlld190b2tlbiA9ICcnO1xuXHRcdHNob3dfaW5saW5lX21lc3NhZ2UoIGNvbmZpZywgJycgKTtcblx0XHRzeW5jaHJvbml6ZV9pbmxpbmVfY29udHJvbHMoIGNvbmZpZyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIEV4aXQgaW5saW5lIG1vZGUgYW5kIG9wdGlvbmFsbHkgcmVsb2FkIGNhbm9uaWNhbCByb3dzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnIENhdGFsb2cgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtib29sZWFufSByZWxvYWQgV2hldGhlciB0byByZWxvYWQgdGhlIGNhdGFsb2cuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlIE9wdGlvbmFsIHN1Y2Nlc3MgbWVzc2FnZS5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGxlYXZlX2lubGluZV9tb2RlKCBjb25maWcsIHJlbG9hZCwgbWVzc2FnZSApIHtcblx0XHRpbmxpbmVfc3RhdGUucmVxdWVzdF9zZXF1ZW5jZSArPSAxO1xuXHRcdGlubGluZV9zdGF0ZS5hY3RpdmUgPSBmYWxzZTtcblx0XHRpbmxpbmVfc3RhdGUubG9hZGluZyA9IGZhbHNlO1xuXHRcdGlubGluZV9zdGF0ZS5jaGFuZ2VkX3Jvd3MgPSBbXTtcblx0XHRpbmxpbmVfc3RhdGUucmV2aWV3X3Rva2VuID0gJyc7XG5cdFx0aWYgKCAnaW5saW5lX3JldmlldycgPT09IGluc3BlY3Rvcl9tb2RlICkge1xuXHRcdFx0Y2xvc2VfaW5zcGVjdG9yKCBjb25maWcsIGZhbHNlICk7XG5cdFx0fVxuXHRcdHN5bmNocm9uaXplX2lubGluZV9jb250cm9scyggY29uZmlnICk7XG5cdFx0aWYgKCBtZXNzYWdlICkge1xuXHRcdFx0c2hvd19hZG1pbl9tZXNzYWdlKCBtZXNzYWdlLCAnc3VjY2VzcycsIDQwMDAgKTtcblx0XHR9XG5cdFx0aWYgKCByZWxvYWQgJiYgY2F0YWxvZ19jb250cm9sbGVyICkge1xuXHRcdFx0Y2F0YWxvZ19jb250cm9sbGVyLmxvYWQoKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogU3RhcnQgcm93IGVkaXRpbmcgZm9yIHRoZSBjdXJyZW50IHZpc2libGUgUmVzb3VyY2UgcGFnZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzdGFydF9pbmxpbmVfbW9kZSggY29uZmlnICkge1xuXHRcdHZhciBtb3VudF9lbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIGNvbmZpZy5tb3VudF9pZCApO1xuXHRcdHZhciByZXNvdXJjZV9pZHMgPSBbXTtcblx0XHR2YXIgcmVxdWVzdF9zZXF1ZW5jZTtcblxuXHRcdGlmICggaW5saW5lX3N0YXRlLmFjdGl2ZSApIHtcblx0XHRcdHN5bmNocm9uaXplX2lubGluZV9kcmFmdHMoIGNvbmZpZyApO1xuXHRcdFx0aWYgKCAhIGlubGluZV9zdGF0ZS5jaGFuZ2VkX3Jvd3MubGVuZ3RoIHx8IHdpbmRvdy5jb25maXJtKCBjb25maWcuaTE4bi5pbmxpbmVfZGlzY2FyZCB8fCAnJyApICkge1xuXHRcdFx0XHRsZWF2ZV9pbmxpbmVfbW9kZSggY29uZmlnLCB0cnVlLCAnJyApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19ib29raW5nX3Jlc291cmNlc19faXRlbVtkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1pZF0nICkuZm9yRWFjaCggZnVuY3Rpb24gKCByb3cgKSB7XG5cdFx0XHRyZXNvdXJjZV9pZHMucHVzaCggTnVtYmVyKCByb3cuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtaWQnICkgKSApO1xuXHRcdH0gKTtcblx0XHRpZiAoICEgcmVzb3VyY2VfaWRzLmxlbmd0aCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCAhIGNhbl9kaXNjYXJkX2luc3BlY3RvciggY29uZmlnICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNsb3NlX2luc3BlY3RvciggY29uZmlnLCBmYWxzZSApO1xuXHRcdG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1kaXNwbGF5LWN1c3RvbWl6ZXJdW29wZW5dJyApLmZvckVhY2goIGZ1bmN0aW9uICggY3VzdG9taXplciApIHtcblx0XHRcdGN1c3RvbWl6ZXIucmVtb3ZlQXR0cmlidXRlKCAnb3BlbicgKTtcblx0XHR9ICk7XG5cdFx0aW5saW5lX3N0YXRlLmFjdGl2ZSA9IHRydWU7XG5cdFx0aW5saW5lX3N0YXRlLmxvYWRpbmcgPSB0cnVlO1xuXHRcdGlubGluZV9zdGF0ZS5jaGFuZ2VkX3Jvd3MgPSBbXTtcblx0XHRyZXF1ZXN0X3NlcXVlbmNlID0gKytpbmxpbmVfc3RhdGUucmVxdWVzdF9zZXF1ZW5jZTtcblx0XHRjbG9zZV9kZXRhaWxzX3JvdyggZmFsc2UgKTtcblx0XHRzeW5jaHJvbml6ZV9pbmxpbmVfY29udHJvbHMoIGNvbmZpZyApO1xuXHRcdHJlcXVlc3RfaW5zcGVjdG9yKCBjb25maWcsIGNvbmZpZy5pbmxpbmVfc2NoZW1hX2FjdGlvbiwgeyByZXNvdXJjZV9pZHM6IEpTT04uc3RyaW5naWZ5KCByZXNvdXJjZV9pZHMgKSB9ICkudGhlbiggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdGlmICggcmVxdWVzdF9zZXF1ZW5jZSAhPT0gaW5saW5lX3N0YXRlLnJlcXVlc3Rfc2VxdWVuY2UgfHwgISBpbmxpbmVfc3RhdGUuYWN0aXZlIHx8ICEgcmVzcG9uc2UgfHwgISByZXNwb25zZS5zdWNjZXNzIHx8ICEgcmVzcG9uc2UuZGF0YSB8fCAhIHJlc3BvbnNlLmRhdGEuc2NoZW1hICkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoIGdldF9pbnNwZWN0b3JfcmVzcG9uc2VfbWVzc2FnZSggcmVzcG9uc2UsIGNvbmZpZy5pMThuLmlubGluZV9sb2FkX2ZhaWxlZCApICk7XG5cdFx0XHR9XG5cdFx0XHQoIHJlc3BvbnNlLmRhdGEuc2NoZW1hLnJvd3MgfHwgW10gKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHJvd19zY2hlbWEgKSB7XG5cdFx0XHRcdHJlbmRlcl9pbmxpbmVfcm93KCBjb25maWcsIHJvd19zY2hlbWEgKTtcblx0XHRcdH0gKTtcblx0XHRcdHZhciBmaXJzdF9maWVsZCA9IG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1pbmxpbmUtZmllbGRdJyApO1xuXHRcdFx0aWYgKCBmaXJzdF9maWVsZCApIHtcblx0XHRcdFx0Zmlyc3RfZmllbGQuZm9jdXMoKTtcblx0XHRcdH1cblx0XHR9ICkuY2F0Y2goIGZ1bmN0aW9uICggZXJyb3IgKSB7XG5cdFx0XHRpZiAoIHJlcXVlc3Rfc2VxdWVuY2UgPT09IGlubGluZV9zdGF0ZS5yZXF1ZXN0X3NlcXVlbmNlICkge1xuXHRcdFx0XHRzaG93X2FkbWluX21lc3NhZ2UoIGVycm9yLm1lc3NhZ2UgfHwgY29uZmlnLmkxOG4uaW5saW5lX2xvYWRfZmFpbGVkIHx8ICcnLCAnZXJyb3InLCA1MDAwICk7XG5cdFx0XHRcdGlubGluZV9zdGF0ZS5hY3RpdmUgPSBmYWxzZTtcblx0XHRcdFx0aWYgKCBjYXRhbG9nX2NvbnRyb2xsZXIgKSB7XG5cdFx0XHRcdFx0Y2F0YWxvZ19jb250cm9sbGVyLmxvYWQoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gKS50aGVuKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRpZiAoIHJlcXVlc3Rfc2VxdWVuY2UgPT09IGlubGluZV9zdGF0ZS5yZXF1ZXN0X3NlcXVlbmNlICkge1xuXHRcdFx0XHRpbmxpbmVfc3RhdGUubG9hZGluZyA9IGZhbHNlO1xuXHRcdFx0XHRzeW5jaHJvbml6ZV9pbmxpbmVfY29udHJvbHMoIGNvbmZpZyApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBQcmV2aWV3IGN1cnJlbnQgaW5saW5lIGRyYWZ0cyBhbmQgb3BlbiB0aGVpciBzaWduZWQgcmV2aWV3IGluc3BlY3Rvci5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGZvY3VzX3RhcmdldCBSZXZpZXcgdHJpZ2dlciBmb3IgZm9jdXMgcmVzdG9yYXRpb24uXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBwcmV2aWV3X2lubGluZV9jaGFuZ2VzKCBjb25maWcsIGZvY3VzX3RhcmdldCApIHtcblx0XHR2YXIgaW5zcGVjdG9yX3dvcmtmbG93O1xuXHRcdHZhciByZXF1ZXN0X3NlcXVlbmNlO1xuXG5cdFx0c3luY2hyb25pemVfaW5saW5lX2RyYWZ0cyggY29uZmlnICk7XG5cdFx0aW5zcGVjdG9yX3dvcmtmbG93ID0gZ2V0X2luc3BlY3Rvcl93b3JrZmxvdyggY29uZmlnICk7XG5cdFx0aWYgKCAhIGlubGluZV9zdGF0ZS5jaGFuZ2VkX3Jvd3MubGVuZ3RoIHx8IGlubGluZV9zdGF0ZS5sb2FkaW5nIHx8ICEgaW5zcGVjdG9yX3dvcmtmbG93IHx8ICEgaW5zcGVjdG9yX3dvcmtmbG93Lm1vdW50KCkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlubGluZV9zdGF0ZS5sb2FkaW5nID0gdHJ1ZTtcblx0XHRyZXF1ZXN0X3NlcXVlbmNlID0gKytpbmxpbmVfc3RhdGUucmVxdWVzdF9zZXF1ZW5jZTtcblx0XHRpbnNwZWN0b3JfZm9jdXNfdGFyZ2V0ID0gZm9jdXNfdGFyZ2V0O1xuXHRcdGluc3BlY3Rvcl9tb2RlID0gJ2lubGluZV9yZXZpZXcnO1xuXHRcdGluc3BlY3Rvcl9kaXJ0eSA9IHRydWU7XG5cdFx0aWYgKCAhIGluc3BlY3Rvcl93b3JrZmxvdy5vcGVuX2xvYWRpbmcoKSApIHtcblx0XHRcdGlubGluZV9zdGF0ZS5sb2FkaW5nID0gZmFsc2U7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHN5bmNocm9uaXplX2lubGluZV9jb250cm9scyggY29uZmlnICk7XG5cdFx0cmVxdWVzdF9pbnNwZWN0b3IoIGNvbmZpZywgY29uZmlnLmlubGluZV9wcmV2aWV3X2FjdGlvbiwgeyByb3dzOiBKU09OLnN0cmluZ2lmeSggaW5saW5lX3N0YXRlLmNoYW5nZWRfcm93cyApIH0gKS50aGVuKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0dmFyIHJldmlld193b3JrZmxvdztcblx0XHRcdHZhciByZXZpZXdfbW9kZWw7XG5cdFx0XHR2YXIgdGFyZ2V0O1xuXHRcdFx0aWYgKCByZXF1ZXN0X3NlcXVlbmNlICE9PSBpbmxpbmVfc3RhdGUucmVxdWVzdF9zZXF1ZW5jZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHJlc3BvbnNlIHx8ICEgcmVzcG9uc2Uuc3VjY2VzcyB8fCAhIHJlc3BvbnNlLmRhdGEgfHwgISByZXNwb25zZS5kYXRhLnByZXZpZXcgKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvciggZ2V0X2luc3BlY3Rvcl9yZXNwb25zZV9tZXNzYWdlKCByZXNwb25zZSwgY29uZmlnLmkxOG4uaW5saW5lX3Jldmlld19mYWlsZWQgKSApO1xuXHRcdFx0fVxuXHRcdFx0aW5saW5lX3N0YXRlLnJldmlld190b2tlbiA9IFN0cmluZyggcmVzcG9uc2UuZGF0YS5wcmV2aWV3LnJldmlld190b2tlbiB8fCAnJyApO1xuXHRcdFx0dGFyZ2V0ID0gZ2V0X2luc3BlY3Rvcl9ob3N0KCkucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbnNwZWN0b3ItZm9ybV0nICk7XG5cdFx0XHRyZXZpZXdfd29ya2Zsb3cgPSBnZXRfaW5saW5lX3Jldmlld193b3JrZmxvdygpO1xuXHRcdFx0cmV2aWV3X21vZGVsID0gcmV2aWV3X3dvcmtmbG93ID8gcmV2aWV3X3dvcmtmbG93LnByZXBhcmUoIHJlc3BvbnNlLmRhdGEucHJldmlldy5yZXZpZXcgfHwge30sIHtcblx0XHRcdFx0Y2hhbmdlZF9sYWJlbDogZm9ybWF0X21lc3NhZ2UoIDEgPT09IGlubGluZV9zdGF0ZS5jaGFuZ2VkX3Jvd3MubGVuZ3RoID8gY29uZmlnLmkxOG4uaW5saW5lX2NoYW5nZWRfcm93IDogY29uZmlnLmkxOG4uaW5saW5lX2NoYW5nZWRfcm93cywgWyBpbmxpbmVfc3RhdGUuY2hhbmdlZF9yb3dzLmxlbmd0aCBdICksXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBjb25maWcuaTE4bi5pbmxpbmVfcmV2aWV3X2Rlc2NyaXB0aW9uIHx8ICcnLFxuXHRcdFx0XHRmb3JtX2lkOiAnd3BiY19jYXRhbG9nX2Jvb2tpbmdfcmVzb3VyY2VzX2lubGluZV9yZXZpZXdfZm9ybScsXG5cdFx0XHRcdG1vZGU6ICdpbmxpbmVfcmV2aWV3Jyxcblx0XHRcdFx0cGVuZGluZ19tZXNzYWdlOiBjb25maWcuaTE4bi5yZXZpZXdfY2hhbmdlc19oZWxwIHx8ICcnLFxuXHRcdFx0XHR0aXRsZTogY29uZmlnLmkxOG4uaW5saW5lX3Jldmlld190aXRsZSB8fCAnJ1xuXHRcdFx0fSApIDoge307XG5cdFx0XHR0YXJnZXQuaW5uZXJIVE1MID0gcmVuZGVyX2NvbXBvbmVudCggY29uZmlnLCAnaW5zcGVjdG9yX2lubGluZV9yZXZpZXcnLCByZXZpZXdfbW9kZWwgKTtcblx0XHRcdHNldF9pbnNwZWN0b3Jfc3RhdGUoICdmb3JtJywgJycgKTtcblx0XHRcdGNvbmZpZ3VyZV9pbnNwZWN0b3JfZm9vdGVyKCAnd3BiY19jYXRhbG9nX2Jvb2tpbmdfcmVzb3VyY2VzX2lubGluZV9yZXZpZXdfZm9ybScsIGNvbmZpZy5pMThuLmFwcGx5X2NoYW5nZXMgfHwgJycsIGZhbHNlLCAhIGlubGluZV9zdGF0ZS5yZXZpZXdfdG9rZW4gKTtcblx0XHRcdGlmICggcmV2aWV3X3dvcmtmbG93ICkge1xuXHRcdFx0XHRyZXZpZXdfd29ya2Zsb3cuc3luY2hyb25pemUoIHsgYnVzeTogZmFsc2UsIGNhbl9hcHBseTogISEgaW5saW5lX3N0YXRlLnJldmlld190b2tlbiB9ICk7XG5cdFx0XHR9XG5cdFx0XHRmb2N1c19pbnNwZWN0b3JfaGVhZGluZyggdGFyZ2V0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctaW5saW5lLXJldmlldy1mb3JtXScgKSApO1xuXHRcdH0gKS5jYXRjaCggZnVuY3Rpb24gKCBlcnJvciApIHtcblx0XHRcdGlmICggcmVxdWVzdF9zZXF1ZW5jZSAhPT0gaW5saW5lX3N0YXRlLnJlcXVlc3Rfc2VxdWVuY2UgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlubGluZV9zdGF0ZS5yZXZpZXdfdG9rZW4gPSAnJztcblx0XHRcdGluc3BlY3Rvcl9kaXJ0eSA9IGZhbHNlO1xuXHRcdFx0c2hvd19hZG1pbl9tZXNzYWdlKCBlcnJvci5tZXNzYWdlIHx8IGNvbmZpZy5pMThuLmlubGluZV9yZXZpZXdfZmFpbGVkIHx8ICcnLCAnZXJyb3InLCA1MDAwICk7XG5cdFx0XHRjbG9zZV9pbnNwZWN0b3IoIGNvbmZpZywgZmFsc2UgKTtcblx0XHR9ICkudGhlbiggZnVuY3Rpb24gKCkge1xuXHRcdFx0aWYgKCByZXF1ZXN0X3NlcXVlbmNlID09PSBpbmxpbmVfc3RhdGUucmVxdWVzdF9zZXF1ZW5jZSApIHtcblx0XHRcdFx0aW5saW5lX3N0YXRlLmxvYWRpbmcgPSBmYWxzZTtcblx0XHRcdFx0c3luY2hyb25pemVfaW5saW5lX2NvbnRyb2xzKCBjb25maWcgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogQXBwbHkgdGhlIHJldmlld2VkIGlubGluZSBwbGFuIGFuZCByZXRhaW4gdGhlIGNhdGFsb2cgc2VsZWN0aW9uLlxuXHQgKlxuXHQgKiBAcGFyYW0ge1N1Ym1pdEV2ZW50fSBldmVudCBSZXZpZXcgZm9ybSBzdWJtaXQgZXZlbnQuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgQ2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gYXBwbHlfaW5saW5lX2NoYW5nZXMoIGV2ZW50LCBjb25maWcgKSB7XG5cdFx0dmFyIGZvcm0gPSBldmVudC50YXJnZXQ7XG5cdFx0dmFyIHNhdmVfYnV0dG9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbnNwZWN0b3Itc2F2ZV0nICk7XG5cdFx0dmFyIHJlcXVlc3Rfc2VxdWVuY2U7XG5cblx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdGlmICggaW5saW5lX3N0YXRlLmxvYWRpbmcgfHwgISBpbmxpbmVfc3RhdGUucmV2aWV3X3Rva2VuIHx8ICggc2F2ZV9idXR0b24gJiYgc2F2ZV9idXR0b24uZGlzYWJsZWQgKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aW5saW5lX3N0YXRlLmxvYWRpbmcgPSB0cnVlO1xuXHRcdGluc3BlY3Rvcl9tdXRhdGlvbl9pbl9wcm9ncmVzcyA9IHRydWU7XG5cdFx0aWYgKCBnZXRfaW5saW5lX3Jldmlld193b3JrZmxvdygpICkge1xuXHRcdFx0Z2V0X2lubGluZV9yZXZpZXdfd29ya2Zsb3coKS5zeW5jaHJvbml6ZSggeyBidXN5OiB0cnVlLCBjYW5fYXBwbHk6IHRydWUgfSApO1xuXHRcdH1cblx0XHRyZXF1ZXN0X3NlcXVlbmNlID0gKytpbnNwZWN0b3JfbXV0YXRpb25fcmVxdWVzdF9zZXF1ZW5jZTtcblx0XHRpZiAoIHNhdmVfYnV0dG9uICkge1xuXHRcdFx0c2F2ZV9idXR0b24uZGlzYWJsZWQgPSB0cnVlO1xuXHRcdFx0c2F2ZV9idXR0b24uY2xhc3NMaXN0LmFkZCggJ2lzLWJ1c3knICk7XG5cdFx0fVxuXHRcdHJlcXVlc3RfaW5zcGVjdG9yKCBjb25maWcsIGNvbmZpZy5pbmxpbmVfYXBwbHlfYWN0aW9uLCB7IHJvd3M6IEpTT04uc3RyaW5naWZ5KCBpbmxpbmVfc3RhdGUuY2hhbmdlZF9yb3dzICksIHJldmlld190b2tlbjogaW5saW5lX3N0YXRlLnJldmlld190b2tlbiB9ICkudGhlbiggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdGlmICggcmVxdWVzdF9zZXF1ZW5jZSAhPT0gaW5zcGVjdG9yX211dGF0aW9uX3JlcXVlc3Rfc2VxdWVuY2UgfHwgISByZXNwb25zZSB8fCAhIHJlc3BvbnNlLnN1Y2Nlc3MgfHwgISByZXNwb25zZS5kYXRhICkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoIGdldF9pbnNwZWN0b3JfcmVzcG9uc2VfbWVzc2FnZSggcmVzcG9uc2UsIGNvbmZpZy5pMThuLmlubGluZV9hcHBseV9mYWlsZWQgKSApO1xuXHRcdFx0fVxuXHRcdFx0cGVuZGluZ19oaWdobGlnaHRfaWRzID0gKCByZXNwb25zZS5kYXRhLnVwZGF0ZWRfaWRzIHx8IFtdICkubWFwKCBTdHJpbmcgKTtcblx0XHRcdGluc3BlY3Rvcl9tdXRhdGlvbl9pbl9wcm9ncmVzcyA9IGZhbHNlO1xuXHRcdFx0bGVhdmVfaW5saW5lX21vZGUoIGNvbmZpZywgdHJ1ZSwgZ2V0X2luc3BlY3Rvcl9yZXNwb25zZV9tZXNzYWdlKCByZXNwb25zZSwgJycgKSApO1xuXHRcdH0gKS5jYXRjaCggZnVuY3Rpb24gKCBlcnJvciApIHtcblx0XHRcdGluc3BlY3Rvcl9tdXRhdGlvbl9pbl9wcm9ncmVzcyA9IGZhbHNlO1xuXHRcdFx0aW5saW5lX3N0YXRlLnJldmlld190b2tlbiA9ICcnO1xuXHRcdFx0aWYgKCBnZXRfaW5saW5lX3Jldmlld193b3JrZmxvdygpICkge1xuXHRcdFx0XHRnZXRfaW5saW5lX3Jldmlld193b3JrZmxvdygpLnN5bmNocm9uaXplKCB7IGJ1c3k6IGZhbHNlLCBjYW5fYXBwbHk6IGZhbHNlIH0gKTtcblx0XHRcdH1cblx0XHRcdGlmICggZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNvbnRhaW5zKCBmb3JtICkgKSB7XG5cdFx0XHRcdHNob3dfaW5zcGVjdG9yX21lc3NhZ2UoIGZvcm0sIGVycm9yLm1lc3NhZ2UgfHwgY29uZmlnLmkxOG4uaW5saW5lX2FwcGx5X2ZhaWxlZCB8fCAnJywgdHJ1ZSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c2hvd19hZG1pbl9tZXNzYWdlKCBlcnJvci5tZXNzYWdlIHx8IGNvbmZpZy5pMThuLmlubGluZV9hcHBseV9mYWlsZWQgfHwgJycsICdlcnJvcicsIDUwMDAgKTtcblx0XHRcdH1cblx0XHRcdGlmICggc2F2ZV9idXR0b24gKSB7XG5cdFx0XHRcdHNhdmVfYnV0dG9uLmRpc2FibGVkID0gdHJ1ZTtcblx0XHRcdFx0c2F2ZV9idXR0b24uY2xhc3NMaXN0LnJlbW92ZSggJ2lzLWJ1c3knICk7XG5cdFx0XHR9XG5cdFx0fSApLnRoZW4oIGZ1bmN0aW9uICgpIHtcblx0XHRcdGlubGluZV9zdGF0ZS5sb2FkaW5nID0gZmFsc2U7XG5cdFx0XHRzeW5jaHJvbml6ZV9pbmxpbmVfY29udHJvbHMoIGNvbmZpZyApO1xuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZW5kZXIgdGhlIGhlYWRlciwgY29tcGxldGUgUmVzb3VyY2Ugcm93cywgcGFydGlhbHMsIGFuZCBwYWdpbmF0aW9uLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnICAgUmVnaXN0ZXJlZCBjYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSByZXNwb25zZSBOb3JtYWxpemVkIGNhdGFsb2cgcmVzcG9uc2UuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBldmVyeSByZXF1aXJlZCBwcmVzZW50YXRpb24gdGFyZ2V0IGV4aXN0cy5cblx0ICovXG5cdGZ1bmN0aW9uIHJlbmRlcl9ib29raW5nX3Jlc291cmNlc19yZXNwb25zZSggY29uZmlnLCByZXNwb25zZSApIHtcblx0XHR2YXIgY2F0YWxvZ19oZWFkaW5nO1xuXHRcdHZhciBjYXRhbG9nX21vdW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIGNvbmZpZy5tb3VudF9pZCApO1xuXHRcdHZhciBjYXJkX2dyb3VwcyA9IHt9O1xuXHRcdHZhciBjaGlsZHJlbl9ieV9wYXJlbnQgPSB7fTtcblx0XHR2YXIgY29sdW1ucztcblx0XHR2YXIgaGVhZGVyX2VsZW1lbnQ7XG5cdFx0dmFyIGhpZXJhcmNoeV9lbmFibGVkO1xuXHRcdHZhciBoaWVyYXJjaHlfaXNfZXhwYW5kZWQ7XG5cdFx0dmFyIGlzX2NhcmRzX3BhY2s7XG5cdFx0dmFyIHBhcmVudF9yZXNvdXJjZXMgPSB7fTtcblx0XHR2YXIgcGFnaW5hdGlvbjtcblx0XHR2YXIgcGFnaW5hdGlvbl9lbGVtZW50O1xuXHRcdHZhciByb3dzX2VsZW1lbnQ7XG5cblx0XHRpZiAoICEgY2F0YWxvZ19tb3VudCB8fCAhIHJlc3BvbnNlIHx8ICEgQXJyYXkuaXNBcnJheSggcmVzcG9uc2UuaXRlbXMgKSApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRoZWFkZXJfZWxlbWVudCA9IGNhdGFsb2dfbW91bnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZXMtaGVhZGVyXScgKTtcblx0XHRyb3dzX2VsZW1lbnQgPSBjYXRhbG9nX21vdW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2VzLXJvd3NdJyApO1xuXHRcdHBhZ2luYXRpb25fZWxlbWVudCA9IGNhdGFsb2dfbW91bnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZXMtcGFnaW5hdGlvbl0nICk7XG5cdFx0aWYgKCAhIGhlYWRlcl9lbGVtZW50IHx8ICEgcm93c19lbGVtZW50IHx8ICEgcGFnaW5hdGlvbl9lbGVtZW50ICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbHVtbnMgPSBnZXRfY29sdW1ucyggY29uZmlnLCByZXNwb25zZS5kaXNwbGF5IHx8IHt9LCB0cnVlLCByZXNwb25zZS5zb3J0aW5nIHx8IHt9ICk7XG5cdFx0aXNfY2FyZHNfcGFjayA9ICdjYXJkcycgPT09IFN0cmluZyggcmVzcG9uc2UuZGlzcGxheSAmJiByZXNwb25zZS5kaXNwbGF5LnRlbXBsYXRlX3BhY2sgfHwgJycgKTtcblx0XHRoaWVyYXJjaHlfZW5hYmxlZCA9ICEhICggcmVzcG9uc2UuaGllcmFyY2h5ICYmIHJlc3BvbnNlLmhpZXJhcmNoeS5lbmFibGVkICk7XG5cdFx0aGllcmFyY2h5X2lzX2V4cGFuZGVkID0gaGllcmFyY2h5X2VuYWJsZWRcblx0XHRcdCYmIHdpbmRvdy53cGJjX3VpX2NhdGFsb2dfaGllcmFyY2h5XG5cdFx0XHQmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfdWlfY2F0YWxvZ19oaWVyYXJjaHkuZ2V0X2luaXRpYWxfZXhwYW5kZWRcblx0XHRcdCYmIHdpbmRvdy53cGJjX3VpX2NhdGFsb2dfaGllcmFyY2h5LmdldF9pbml0aWFsX2V4cGFuZGVkKCByZXNwb25zZS5oaWVyYXJjaHkgfHwge30gKTtcblx0XHRoZWFkZXJfZWxlbWVudC5pbm5lckhUTUwgPSByZW5kZXJfY29tcG9uZW50KCBjb25maWcsICdoZWFkZXInLCB7XG5cdFx0XHRhbGxfZXhwYW5kZWQ6IGhpZXJhcmNoeV9pc19leHBhbmRlZCxcblx0XHRcdGNvbHVtbnM6IGNvbHVtbnMsXG5cdFx0XHRoaWVyYXJjaHlfZW5hYmxlZDogaGllcmFyY2h5X2VuYWJsZWQsXG5cdFx0XHRpMThuOiBjb25maWcuaTE4biB8fCB7fSxcblx0XHRcdHNlbGVjdGlvbl9lbmFibGVkOiAhISAoIGNvbmZpZy5mZWF0dXJlcyAmJiBjb25maWcuZmVhdHVyZXMuc2VsZWN0aW9uIClcblx0XHR9ICk7XG5cdFx0cm93c19lbGVtZW50LmlubmVySFRNTCA9ICcnO1xuXHRcdGlmICggaGllcmFyY2h5X2VuYWJsZWQgKSB7XG5cdFx0XHRyZXNwb25zZS5pdGVtcy5mb3JFYWNoKCBmdW5jdGlvbiAoIHJlc291cmNlICkge1xuXHRcdFx0XHRpZiAoIHJlc291cmNlLmhpZXJhcmNoeSAmJiAncGFyZW50JyA9PT0gcmVzb3VyY2UuaGllcmFyY2h5LnR5cGUgKSB7XG5cdFx0XHRcdFx0cGFyZW50X3Jlc291cmNlc1sgU3RyaW5nKCByZXNvdXJjZS5pZCApIF0gPSByZXNvdXJjZTtcblx0XHRcdFx0fSBlbHNlIGlmICggcmVzb3VyY2UuaGllcmFyY2h5ICYmICdjaGlsZCcgPT09IHJlc291cmNlLmhpZXJhcmNoeS50eXBlICkge1xuXHRcdFx0XHRcdHZhciBwYXJlbnRfaWQgPSBTdHJpbmcoIHJlc291cmNlLmhpZXJhcmNoeS5wYXJlbnRfaWQgfHwgJycgKTtcblx0XHRcdFx0XHRjaGlsZHJlbl9ieV9wYXJlbnRbIHBhcmVudF9pZCBdID0gY2hpbGRyZW5fYnlfcGFyZW50WyBwYXJlbnRfaWQgXSB8fCBbXTtcblx0XHRcdFx0XHRjaGlsZHJlbl9ieV9wYXJlbnRbIHBhcmVudF9pZCBdLnB1c2goIHJlc291cmNlICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHR9XG5cdFx0cmVzcG9uc2UuaXRlbXMuZm9yRWFjaCggZnVuY3Rpb24gKCByZXNvdXJjZSApIHtcblx0XHRcdHZhciBhY3Rpb25fdGFyZ2V0O1xuXHRcdFx0dmFyIGNsYXNzaWNfbGFiZWxfY2xhc3NlcyA9IHtcblx0XHRcdFx0Y2hpbGQ6ICd3cGJjX2xhYmVsX3Jlc291cmNlX2NoaWxkJyxcblx0XHRcdFx0Y29zdDogJ3dwYmNfbGFiZWxfY29zdCcsXG5cdFx0XHRcdCdkZWZhdWx0LWZvcm0nOiAnd3BiY19sYWJlbF9yZXNvdXJjZV9kZWZhdWx0X2Zvcm0nLFxuXHRcdFx0XHRvd25lcjogJ3dwYmNfbGFiZWxfdXNlcl9vd25lcicsXG5cdFx0XHRcdHBhcmVudDogJ3dwYmNfbGFiZWxfcmVzb3VyY2VfcGFyZW50Jyxcblx0XHRcdFx0c2luZ2xlOiAnd3BiY19sYWJlbF9yZXNvdXJjZV9zaW5nbGUnXG5cdFx0XHR9O1xuXHRcdFx0dmFyIGxhYmVsX3RhcmdldDtcblx0XHRcdHZhciBwcmljZV90YXJnZXQ7XG5cdFx0XHR2YXIgZGVzY3JpcHRpb24gPSByZXNvdXJjZS5kZXNjcmlwdGlvbiB8fCBjb25maWcuaTE4bi5ub19kZXNjcmlwdGlvbiB8fCAnJztcblx0XHRcdHZhciBoaWVyYXJjaHkgPSBPYmplY3QuYXNzaWduKCB7fSwgcmVzb3VyY2UuaGllcmFyY2h5IHx8IHt9ICk7XG5cdFx0XHR2YXIgcGFyZW50X2NvbnRleHRfbGFiZWwgPSAnJztcblx0XHRcdHZhciByb3dfdmFyaWFudCA9IGhpZXJhcmNoeV9lbmFibGVkICYmICggJ3BhcmVudCcgPT09IGhpZXJhcmNoeS50eXBlIHx8ICdjaGlsZCcgPT09IGhpZXJhcmNoeS50eXBlICkgPyBoaWVyYXJjaHkudHlwZSA6ICdzaW5nbGUnO1xuXHRcdFx0dmFyIHJvd190ZW1wbGF0ZV9yb2xlID0gJ3BhcmVudCcgPT09IHJvd192YXJpYW50ID8gJ3BhcmVudF9yb3cnIDogKCAnY2hpbGQnID09PSByb3dfdmFyaWFudCA/ICdjaGlsZF9yb3cnIDogJ3JvdycgKTtcblx0XHRcdHZhciB0eXBlX2JhZGdlX2xhYmVsID0gY29uZmlnLmkxOG4uaW5kZXBlbmRlbnRfbGFiZWwgfHwgJyc7XG5cdFx0XHRoaWVyYXJjaHkuZXhwYW5kYWJsZSA9ICEhICggaGllcmFyY2h5X2VuYWJsZWQgJiYgaGllcmFyY2h5LmV4cGFuZGFibGUgKTtcblx0XHRcdGlmICggaGllcmFyY2h5LnBhcmVudF90aXRsZSApIHtcblx0XHRcdFx0cGFyZW50X2NvbnRleHRfbGFiZWwgPSBmb3JtYXRfbWVzc2FnZSggY29uZmlnLmkxOG4uY2hpbGRfb2YgfHwgJycsIFsgaGllcmFyY2h5LnBhcmVudF90aXRsZSBdICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICdwYXJlbnQnID09PSByb3dfdmFyaWFudCApIHtcblx0XHRcdFx0dmFyIHJlbmRlcmVkX2NoaWxkX2NvdW50ID0gTWF0aC5tYXgoIDAsIE51bWJlciggaGllcmFyY2h5LnJlbmRlcmVkX2NoaWxkcmVuX2NvdW50ICkgfHwgMCApO1xuXHRcdFx0XHR2YXIgcGFyZW50X2NoaWxkcmVuX3RlbXBsYXRlID0gMSA9PT0gcmVuZGVyZWRfY2hpbGRfY291bnRcblx0XHRcdFx0XHQ/IGNvbmZpZy5pMThuLnBhcmVudF9jaGlsZF9sYWJlbCB8fCAnJTEkcyDCtyAlMiRzIGNoaWxkJ1xuXHRcdFx0XHRcdDogY29uZmlnLmkxOG4ucGFyZW50X2NoaWxkcmVuX2xhYmVsIHx8ICclMSRzIMK3ICUyJHMgY2hpbGRyZW4nO1xuXHRcdFx0XHR0eXBlX2JhZGdlX2xhYmVsID0gZm9ybWF0X21lc3NhZ2UoIHBhcmVudF9jaGlsZHJlbl90ZW1wbGF0ZSwgW1xuXHRcdFx0XHRcdGNvbmZpZy5pMThuLnBhcmVudF9sYWJlbCB8fCAnJyxcblx0XHRcdFx0XHRyZW5kZXJlZF9jaGlsZF9jb3VudFxuXHRcdFx0XHRdICk7XG5cdFx0XHR9IGVsc2UgaWYgKCAnY2hpbGQnID09PSByb3dfdmFyaWFudCApIHtcblx0XHRcdFx0dHlwZV9iYWRnZV9sYWJlbCA9IGNvbmZpZy5pMThuLmNoaWxkX2xhYmVsIHx8ICcnO1xuXHRcdFx0fVxuXHRcdFx0dmFyIHJlc291cmNlX3Jvd19kYXRhID0gT2JqZWN0LmFzc2lnbigge30sIHJlc291cmNlLCB7XG5cdFx0XHRcdHBhcmVudF9jb250ZXh0X2xhYmVsOiBwYXJlbnRfY29udGV4dF9sYWJlbCxcblx0XHRcdFx0Y29sbGFwc2VfbGFiZWw6IGZvcm1hdF9tZXNzYWdlKCBjb25maWcuaTE4bi5jb2xsYXBzZV9jaGlsZHJlbl9mb3IgfHwgY29uZmlnLmkxOG4uY29sbGFwc2VfY2hpbGRyZW4gfHwgJycsIFsgcmVzb3VyY2UudGl0bGUgfHwgJycgXSApLFxuXHRcdFx0XHRjb2x1bW5zOiBjb2x1bW5zLFxuXHRcdFx0XHRleHBhbmRfbGFiZWw6IGZvcm1hdF9tZXNzYWdlKCBjb25maWcuaTE4bi5leHBhbmRfY2hpbGRyZW5fZm9yIHx8IGNvbmZpZy5pMThuLmV4cGFuZF9jaGlsZHJlbiB8fCAnJywgWyByZXNvdXJjZS50aXRsZSB8fCAnJyBdICksXG5cdFx0XHRcdGhpZXJhcmNoeTogaGllcmFyY2h5LFxuXHRcdFx0XHRpMThuOiBjb25maWcuaTE4biB8fCB7fSxcblx0XHRcdFx0aXNfZXhwYW5kZWQ6IGhpZXJhcmNoeV9pc19leHBhbmRlZCxcblx0XHRcdFx0cGFyZW50X2xhYmVsOiBjb25maWcuaTE4bi5wYXJlbnRfbGFiZWwgfHwgJycsXG5cdFx0XHRcdHJvd192YXJpYW50OiByb3dfdmFyaWFudCxcblx0XHRcdFx0c2VsZWN0aW9uX2xhYmVsOiBmb3JtYXRfbWVzc2FnZSggY29uZmlnLmkxOG4uc2VsZWN0X3Jlc291cmNlIHx8ICcnLCBbIHJlc291cmNlLnRpdGxlIHx8ICcnIF0gKSxcblx0XHRcdFx0c2VsZWN0aW9uX2VuYWJsZWQ6ICEhICggY29uZmlnLmZlYXR1cmVzICYmIGNvbmZpZy5mZWF0dXJlcy5zZWxlY3Rpb24gKSxcblx0XHRcdFx0dGh1bWJuYWlsX2xhYmVsOiBmb3JtYXRfbWVzc2FnZSggY29uZmlnLmkxOG4udGh1bWJuYWlsX3Rvb2x0aXAgfHwgJycsIFsgcmVzb3VyY2UudGl0bGUgfHwgJycsIGRlc2NyaXB0aW9uIF0gKSxcblx0XHRcdFx0dHlwZV9iYWRnZV9sYWJlbDogdHlwZV9iYWRnZV9sYWJlbFxuXHRcdFx0fSApO1xuXHRcdFx0dmFyIHJlc291cmNlX3Jvd19odG1sID0gcmVuZGVyX2NvbXBvbmVudCggY29uZmlnLCByb3dfdGVtcGxhdGVfcm9sZSwgcmVzb3VyY2Vfcm93X2RhdGEgKTtcblx0XHRcdHZhciByZXNvdXJjZV9yb3c7XG5cblx0XHRcdGlmICggISByZXNvdXJjZV9yb3dfaHRtbCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIGlzX2NhcmRzX3BhY2sgJiYgJ3BhcmVudCcgPT09IHJvd192YXJpYW50ICkge1xuXHRcdFx0XHR2YXIgY2hpbGRfcmVzb3VyY2VzID0gY2hpbGRyZW5fYnlfcGFyZW50WyBTdHJpbmcoIHJlc291cmNlLmlkICkgXSB8fCBbXTtcblx0XHRcdFx0dmFyIGNoaWxkX2NvdW50ID0gTWF0aC5tYXgoIGNoaWxkX3Jlc291cmNlcy5sZW5ndGgsIE51bWJlciggaGllcmFyY2h5LnJlbmRlcmVkX2NoaWxkcmVuX2NvdW50ICkgfHwgMCApO1xuXHRcdFx0XHR2YXIgY2FyZF9ncm91cF9odG1sID0gcmVuZGVyX2NvbXBvbmVudCggY29uZmlnLCAnY2FyZF9ncm91cCcsIHtcblx0XHRcdFx0XHRjaGlsZHJlbl9kZXNjcmlwdGlvbjogZm9ybWF0X21lc3NhZ2UoIGNvbmZpZy5pMThuLmNoaWxkcmVuX2JlbG9uZ190byB8fCAnJywgWyByZXNvdXJjZS50aXRsZSB8fCAnJyBdICksXG5cdFx0XHRcdFx0Y2hpbGRyZW5faGVhZGluZzogZm9ybWF0X21lc3NhZ2UoIGNvbmZpZy5pMThuLmNoaWxkcmVuX29mX2NvdW50IHx8ICcnLCBbIHJlc291cmNlLnRpdGxlIHx8ICcnLCBjaGlsZF9jb3VudCBdICksXG5cdFx0XHRcdFx0Y29sbGFwc2VfbGFiZWw6IHJlc291cmNlX3Jvd19kYXRhLmNvbGxhcHNlX2xhYmVsLFxuXHRcdFx0XHRcdGV4cGFuZF9sYWJlbDogcmVzb3VyY2Vfcm93X2RhdGEuZXhwYW5kX2xhYmVsLFxuXHRcdFx0XHRcdGlzX2V4cGFuZGVkOiBoaWVyYXJjaHlfaXNfZXhwYW5kZWQsXG5cdFx0XHRcdFx0cGFyZW50X2lkOiByZXNvdXJjZS5pZCxcblx0XHRcdFx0XHRwYXJlbnRfbm9kZV9pZDogaGllcmFyY2h5Lm5vZGVfaWQsXG5cdFx0XHRcdFx0c3RhY2tfaXRlbXM6IGNoaWxkX3Jlc291cmNlcy5zbGljZSggMCwgMyApXG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0aWYgKCAhIGNhcmRfZ3JvdXBfaHRtbCApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cm93c19lbGVtZW50Lmluc2VydEFkamFjZW50SFRNTCggJ2JlZm9yZWVuZCcsIGNhcmRfZ3JvdXBfaHRtbCApO1xuXHRcdFx0XHRjYXJkX2dyb3Vwc1sgU3RyaW5nKCByZXNvdXJjZS5pZCApIF0gPSByb3dzX2VsZW1lbnQubGFzdEVsZW1lbnRDaGlsZDtcblx0XHRcdFx0dmFyIHBhcmVudF9zbG90ID0gY2FyZF9ncm91cHNbIFN0cmluZyggcmVzb3VyY2UuaWQgKSBdLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtY2FyZC1wYXJlbnQtc2xvdF0nICk7XG5cdFx0XHRcdHBhcmVudF9zbG90Lmluc2VydEFkamFjZW50SFRNTCggJ2JlZm9yZWVuZCcsIHJlc291cmNlX3Jvd19odG1sICk7XG5cdFx0XHRcdHJlc291cmNlX3JvdyA9IHBhcmVudF9zbG90Lmxhc3RFbGVtZW50Q2hpbGQ7XG5cdFx0XHR9IGVsc2UgaWYgKCBpc19jYXJkc19wYWNrICYmICdjaGlsZCcgPT09IHJvd192YXJpYW50ICYmIGNhcmRfZ3JvdXBzWyBTdHJpbmcoIGhpZXJhcmNoeS5wYXJlbnRfaWQgKSBdICkge1xuXHRcdFx0XHR2YXIgY2hpbGRyZW5fc2xvdCA9IGNhcmRfZ3JvdXBzWyBTdHJpbmcoIGhpZXJhcmNoeS5wYXJlbnRfaWQgKSBdLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtY2FyZC1jaGlsZHJlbi1zbG90XScgKTtcblx0XHRcdFx0Y2hpbGRyZW5fc2xvdC5pbnNlcnRBZGphY2VudEhUTUwoICdiZWZvcmVlbmQnLCByZXNvdXJjZV9yb3dfaHRtbCApO1xuXHRcdFx0XHRyZXNvdXJjZV9yb3cgPSBjaGlsZHJlbl9zbG90Lmxhc3RFbGVtZW50Q2hpbGQ7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyb3dzX2VsZW1lbnQuaW5zZXJ0QWRqYWNlbnRIVE1MKCAnYmVmb3JlZW5kJywgcmVzb3VyY2Vfcm93X2h0bWwgKTtcblx0XHRcdFx0cmVzb3VyY2Vfcm93ID0gcm93c19lbGVtZW50Lmxhc3RFbGVtZW50Q2hpbGQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgcmVzb3VyY2Vfcm93ICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGxhYmVsX3RhcmdldCA9IHJlc291cmNlX3Jvdy5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWxhYmVsc10nICk7XG5cdFx0XHRwcmljZV90YXJnZXQgPSByZXNvdXJjZV9yb3cucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1wcmljZV0nICk7XG5cdFx0XHRhY3Rpb25fdGFyZ2V0ID0gcmVzb3VyY2Vfcm93LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtYWN0aW9uc10nICk7XG5cdFx0XHRpZiAoIGxhYmVsX3RhcmdldCApIHtcblx0XHRcdFx0bGFiZWxfdGFyZ2V0LmlubmVySFRNTCA9IHJlbmRlcl9jb21wb25lbnQoIGNvbmZpZywgJ2xhYmVscycsIHtcblx0XHRcdFx0XHRhcmlhX2xhYmVsOiBjb25maWcuaTE4bi5jb2x1bW5fbGFiZWxzIHx8ICcnLFxuXHRcdFx0XHRcdGVtcHR5X2xhYmVsOiBjb25maWcuaTE4bi5ub19sYWJlbHMgfHwgJycsXG5cdFx0XHRcdFx0bGFiZWxzOiBBcnJheS5pc0FycmF5KCByZXNvdXJjZS5sYWJlbHMgKSA/IHJlc291cmNlLmxhYmVscy5tYXAoIGZ1bmN0aW9uICggbGFiZWwgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gT2JqZWN0LmFzc2lnbigge30sIGxhYmVsLCB7IGNsYXNzX25hbWU6IGNsYXNzaWNfbGFiZWxfY2xhc3Nlc1sgbGFiZWwua2luZCBdIHx8ICcnIH0gKTtcblx0XHRcdFx0XHR9ICkgOiBbXVxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHByaWNlX3RhcmdldCApIHtcblx0XHRcdFx0cHJpY2VfdGFyZ2V0LmlubmVySFRNTCA9IHJlbmRlcl9jb21wb25lbnQoIGNvbmZpZywgJ3ByaWNlJywge1xuXHRcdFx0XHRcdGVtcHR5X2xhYmVsOiBjb25maWcuaTE4bi5wcmljZV91bmF2YWlsYWJsZSB8fCAnJyxcblx0XHRcdFx0XHRwcmljZTogcmVzb3VyY2UucHJpY2UgfHwge31cblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBhY3Rpb25fdGFyZ2V0ICkge1xuXHRcdFx0XHRhY3Rpb25fdGFyZ2V0LmlubmVySFRNTCA9IHJlbmRlcl9jb21wb25lbnQoIGNvbmZpZywgJ2FjdGlvbl9tZW51Jywge1xuXHRcdFx0XHRcdGFjdGlvbnM6IEFycmF5LmlzQXJyYXkoIHJlc291cmNlLmFjdGlvbl9pdGVtcyApID8gcmVzb3VyY2UuYWN0aW9uX2l0ZW1zLm1hcCggZnVuY3Rpb24gKCBhY3Rpb24gKSB7XG5cdFx0XHRcdFx0XHR2YXIgYWN0aW9uX2NsYXNzZXMgPSB7IGFkanVzdF9jYXBhY2l0eTogJ2NhcGFjaXR5JywgZGVsZXRlX3Jlc291cmNlOiAnZGVsZXRlJywgZWRpdF9yZXNvdXJjZTogJ2VkaXQnLCBwdWJsaXNoX3Jlc291cmNlOiAncHVibGlzaCcgfTtcblx0XHRcdFx0XHRcdHZhciBhY3Rpb25faWQgPSBTdHJpbmcoIGFjdGlvbi5pZCB8fCAnJyApO1xuXHRcdFx0XHRcdFx0cmV0dXJuIE9iamVjdC5hc3NpZ24oIHt9LCBhY3Rpb24sIHsgY2xhc3NfbmFtZTogJ3dwYmNfYm9va2luZ19yZXNvdXJjZXNfX2FjdGlvbl8nICsgKCBhY3Rpb25fY2xhc3Nlc1sgYWN0aW9uX2lkIF0gfHwgYWN0aW9uX2lkICkgfSApO1xuXHRcdFx0XHRcdH0gKSA6IFtdLFxuXHRcdFx0XHRcdGFyaWFfbGFiZWw6IGZvcm1hdF9tZXNzYWdlKCBjb25maWcuaTE4bi5hY3Rpb25zX2ZvciB8fCAnJywgWyByZXNvdXJjZS50aXRsZSB8fCAnJyBdICksXG5cdFx0XHRcdFx0ZW1wdHlfbGFiZWw6IGNvbmZpZy5pMThuLm5vX2FjdGlvbnMgfHwgJycsXG5cdFx0XHRcdFx0bWVudV9pZDogJ3dwYmNfJyArIGNvbmZpZy5pZCArICdfYWN0aW9uc18nICsgU3RyaW5nKCByZXNvdXJjZS5pZCApLFxuXHRcdFx0XHRcdHJlc291cmNlX2lkOiByZXNvdXJjZS5pZFxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGhpZXJhcmNoeV9lbmFibGVkICYmICdjaGlsZCcgPT09IHJvd192YXJpYW50ICYmIGhpZXJhcmNoeS5pc19sYXN0X3NpYmxpbmcgKSB7XG5cdFx0XHRcdHZhciBwYXJlbnRfcmVzb3VyY2UgPSBwYXJlbnRfcmVzb3VyY2VzWyBTdHJpbmcoIGhpZXJhcmNoeS5wYXJlbnRfaWQgKSBdO1xuXHRcdFx0XHRpZiAoIHBhcmVudF9yZXNvdXJjZSApIHtcblx0XHRcdFx0XHR2YXIgc3VtbWFyeV90YXJnZXQgPSBpc19jYXJkc19wYWNrICYmIGNhcmRfZ3JvdXBzWyBTdHJpbmcoIGhpZXJhcmNoeS5wYXJlbnRfaWQgKSBdXG5cdFx0XHRcdFx0XHQ/IGNhcmRfZ3JvdXBzWyBTdHJpbmcoIGhpZXJhcmNoeS5wYXJlbnRfaWQgKSBdLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtY2FyZC1wYXJlbnQtc2xvdF0nIClcblx0XHRcdFx0XHRcdDogcm93c19lbGVtZW50O1xuXHRcdFx0XHRcdHN1bW1hcnlfdGFyZ2V0Lmluc2VydEFkamFjZW50SFRNTCggJ2JlZm9yZWVuZCcsIHJlbmRlcl9jb21wb25lbnQoIGNvbmZpZywgJ2NoaWxkX3N1bW1hcnknLCB7XG5cdFx0XHRcdFx0XHRjaGlsZHJlbl9sYWJlbDogZ2V0X2NoaWxkcmVuX3N1bW1hcnlfbGFiZWwoIHBhcmVudF9yZXNvdXJjZSwgY29uZmlnLmkxOG4gfHwge30gKSxcblx0XHRcdFx0XHRcdGNvbGxhcHNlX2xhYmVsOiBmb3JtYXRfbWVzc2FnZSggY29uZmlnLmkxOG4uY29sbGFwc2VfY2hpbGRyZW5fZm9yIHx8IGNvbmZpZy5pMThuLmNvbGxhcHNlX2NoaWxkcmVuIHx8ICcnLCBbIHBhcmVudF9yZXNvdXJjZS50aXRsZSB8fCAnJyBdICksXG5cdFx0XHRcdFx0XHRjb2x1bW5zOiBjb2x1bW5zLFxuXHRcdFx0XHRcdFx0ZXhwYW5kX2xhYmVsOiBmb3JtYXRfbWVzc2FnZSggY29uZmlnLmkxOG4uZXhwYW5kX2NoaWxkcmVuX2ZvciB8fCBjb25maWcuaTE4bi5leHBhbmRfY2hpbGRyZW4gfHwgJycsIFsgcGFyZW50X3Jlc291cmNlLnRpdGxlIHx8ICcnIF0gKSxcblx0XHRcdFx0XHRcdGlzX2V4cGFuZGVkOiBoaWVyYXJjaHlfaXNfZXhwYW5kZWQsXG5cdFx0XHRcdFx0XHRwYXJlbnRfaWQ6IGhpZXJhcmNoeS5wYXJlbnRfaWQsXG5cdFx0XHRcdFx0XHRwYXJlbnRfbm9kZV9pZDogcGFyZW50X3Jlc291cmNlLmhpZXJhcmNoeS5ub2RlX2lkLFxuXHRcdFx0XHRcdFx0c2VsZWN0aW9uX2VuYWJsZWQ6ICEhICggY29uZmlnLmZlYXR1cmVzICYmIGNvbmZpZy5mZWF0dXJlcy5zZWxlY3Rpb24gKVxuXHRcdFx0XHRcdH0gKSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSApO1xuXHRcdHN5bmNocm9uaXplX292ZXJmbG93X3Rvb2x0aXBzKCBjYXRhbG9nX21vdW50ICk7XG5cblx0XHRwYWdpbmF0aW9uID0gcmVzcG9uc2UucGFnaW5hdGlvbiB8fCB7fTtcblx0XHRwYWdpbmF0aW9uX2VsZW1lbnQuaW5uZXJIVE1MID0gcmVuZGVyX2NvbXBvbmVudCggY29uZmlnLCAncGFnaW5hdGlvbicsIHtcblx0XHRcdGFyaWFfbGFiZWw6IGNvbmZpZy5pMThuLnBhZ2luYXRpb25fbGFiZWwgfHwgJycsXG5cdFx0XHRoYXNfbmV4dDogTnVtYmVyKCBwYWdpbmF0aW9uLnBhZ2VfbnVtYmVyICkgPCBOdW1iZXIoIHBhZ2luYXRpb24udG90YWxfcGFnZXMgKSxcblx0XHRcdGhhc19wcmV2aW91czogMSA8IE51bWJlciggcGFnaW5hdGlvbi5wYWdlX251bWJlciApLFxuXHRcdFx0aXRlbXNfcGVyX3BhZ2U6IE51bWJlciggcGFnaW5hdGlvbi5pdGVtc19wZXJfcGFnZSApLFxuXHRcdFx0aXRlbXNfcGVyX3BhZ2Vfb3B0aW9uczogY29uZmlnLml0ZW1zX3Blcl9wYWdlICYmIEFycmF5LmlzQXJyYXkoIGNvbmZpZy5pdGVtc19wZXJfcGFnZS5vcHRpb25zICkgPyBjb25maWcuaXRlbXNfcGVyX3BhZ2Uub3B0aW9ucyA6IFtdLFxuXHRcdFx0bmV4dF9sYWJlbDogY29uZmlnLmkxOG4ubmV4dF9wYWdlIHx8ICcnLFxuXHRcdFx0bmV4dF9wYWdlOiBNYXRoLm1pbiggTnVtYmVyKCBwYWdpbmF0aW9uLnRvdGFsX3BhZ2VzICksIE51bWJlciggcGFnaW5hdGlvbi5wYWdlX251bWJlciApICsgMSApLFxuXHRcdFx0cGFnZV9udW1iZXI6IE51bWJlciggcGFnaW5hdGlvbi5wYWdlX251bWJlciApLFxuXHRcdFx0cGFnZV9udW1iZXJfbGFiZWw6IGNvbmZpZy5pMThuLnBhZ2VfbnVtYmVyIHx8ICcnLFxuXHRcdFx0cGVyX3BhZ2VfbGFiZWw6IGNvbmZpZy5pMThuLnBlcl9wYWdlIHx8ICcnLFxuXHRcdFx0cHJldmlvdXNfbGFiZWw6IGNvbmZpZy5pMThuLnByZXZpb3VzX3BhZ2UgfHwgJycsXG5cdFx0XHRwcmV2aW91c19wYWdlOiBNYXRoLm1heCggMSwgTnVtYmVyKCBwYWdpbmF0aW9uLnBhZ2VfbnVtYmVyICkgLSAxICksXG5cdFx0XHRyZXN1bHRzX3N0YXR1czogZm9ybWF0X21lc3NhZ2UoIGNvbmZpZy5pMThuLnJlc3VsdHNfc3RhdHVzIHx8ICcnLCBbIHBhZ2luYXRpb24uaXRlbXNfZnJvbSwgcGFnaW5hdGlvbi5pdGVtc190bywgcGFnaW5hdGlvbi50b3RhbF9pdGVtcyBdICksXG5cdFx0XHRzaG93X2xhYmVsOiBjb25maWcuaTE4bi5zaG93IHx8ICcnLFxuXHRcdFx0dG90YWxfcGFnZXM6IE1hdGgubWF4KCAxLCBOdW1iZXIoIHBhZ2luYXRpb24udG90YWxfcGFnZXMgKSApXG5cdFx0fSApO1xuXHRcdHN5bmNocm9uaXplX2Jvb2tpbmdfcmVzb3VyY2VzX3Rvb2xiYXIoIGNvbmZpZywgcmVzcG9uc2UgKTtcblxuXHRcdGlmICggcGVuZGluZ19mb2N1c19kaXJlY3Rpb24gKSB7XG5cdFx0XHRjYXRhbG9nX2hlYWRpbmcgPSBjYXRhbG9nX21vdW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctaGVhZGluZ10nICk7XG5cdFx0XHRwZW5kaW5nX2ZvY3VzX2RpcmVjdGlvbiA9ICcnO1xuXHRcdFx0aWYgKCBjYXRhbG9nX2hlYWRpbmcgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNhdGFsb2dfaGVhZGluZy5mb2N1cyApIHtcblx0XHRcdFx0Y2F0YWxvZ19oZWFkaW5nLmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJvd3NfZWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXNlbGVjdGFibGUtcm93XVtkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1pZF0nICkubGVuZ3RoID09PSByZXNwb25zZS5pdGVtcy5sZW5ndGg7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIHRoZSBudW1iZXIgb2YgY3VycmVudGx5IHZpc2libGUgY2VsbHMgaW4gb25lIFJlc291cmNlIHJvdy5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcmVzb3VyY2Vfcm93IFJlbmRlcmVkIFJlc291cmNlIHRhYmxlIHJvdy5cblx0ICogQHJldHVybiB7bnVtYmVyfSBTYWZlIGRldGFpbHMtcm93IGNvbHNwYW4uXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfZGV0YWlsc19jb2xzcGFuKCByZXNvdXJjZV9yb3cgKSB7XG5cdFx0dmFyIHZpc2libGVfY2VsbHMgPSAwO1xuXG5cdFx0aWYgKCByZXNvdXJjZV9yb3cgJiYgJ1RSJyA9PT0gcmVzb3VyY2Vfcm93LnRhZ05hbWUgKSB7XG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCByZXNvdXJjZV9yb3cuY2VsbHMgfHwgW10sIGZ1bmN0aW9uICggY2VsbCApIHtcblx0XHRcdFx0aWYgKCAhIGNlbGwuaGlkZGVuICYmICdub25lJyAhPT0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoIGNlbGwgKS5kaXNwbGF5ICkge1xuXHRcdFx0XHRcdHZpc2libGVfY2VsbHMgKz0gMTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdHJldHVybiBNYXRoLm1heCggMSwgdmlzaWJsZV9jZWxscyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlc29sdmUgdGhlIHJlbmRlcmVkIFJlc291cmNlIGNvbnRhaW5lciB0aGF0IG93bnMgYW4gaW50ZXJhY3RpdmUgY29udHJvbC5cblx0ICpcblx0ICogUmVzb3VyY2UgY29udHJvbHMgcmVwZWF0IHRoZSBSZXNvdXJjZSBJRCBmb3IgZXZlbnQgZGlzcGF0Y2guIExpbWl0aW5nIHRoaXNcblx0ICogbG9va3VwIHRvIHNlbGVjdGFibGUgcm93L2NhcmQgY29udGFpbmVycyBwcmV2ZW50cyBsYXp5IHRlbXBsYXRlcyBmcm9tIGJlaW5nXG5cdCAqIGluc2VydGVkIGJlc2lkZSB0aGUgY29udHJvbCBpdHNlbGYuXG5cdCAqXG5cdCAqIEBwYXJhbSB7RWxlbWVudHxudWxsfSBzb3VyY2VfZWxlbWVudCBFbGVtZW50IGluc2lkZSBhIFJlc291cmNlIHJvdyBvciBjYXJkLlxuXHQgKiBAcmV0dXJuIHtIVE1MRWxlbWVudHxudWxsfSBPd25pbmcgUmVzb3VyY2Ugcm93L2NhcmQsIG9yIG51bGwgd2hlbiB1bmF2YWlsYWJsZS5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9yZXNvdXJjZV9pdGVtX2NvbnRhaW5lciggc291cmNlX2VsZW1lbnQgKSB7XG5cdFx0aWYgKCAhIHNvdXJjZV9lbGVtZW50IHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiBzb3VyY2VfZWxlbWVudC5jbG9zZXN0ICkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHNvdXJjZV9lbGVtZW50LmNsb3Nlc3QoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctc2VsZWN0YWJsZS1yb3ddW2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWlkXScgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTeW5jaHJvbml6ZSBDYXJkcy1wYWNrIHBhcmVudCBzdGFnZXMgd2l0aCBzaGFyZWQgaGllcmFyY2h5IHZpc2liaWxpdHkuXG5cdCAqXG5cdCAqIENoaWxkIGNhcmRzIHJlbWFpbiBub3JtYWwgc2hhcmVkIGhpZXJhcmNoeSBub2Rlcy4gVGhpcyBhZGFwdGVyIG9ubHkgbWlycm9yc1xuXHQgKiB0aGVpciBjb21wdXRlZCB2aXNpYmlsaXR5IG9udG8gdGhlIHByZXNlbnRhdGlvbi1vbmx5IHRyYXkgd3JhcHBlci5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gY2F0YWxvZ19tb3VudCBNb3VudGVkIEJvb2tpbmcgUmVzb3VyY2VzIGNhdGFsb2cuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzeW5jaHJvbml6ZV9jYXJkX2dyb3VwX3BhbmVscyggY2F0YWxvZ19tb3VudCApIHtcblx0XHR2YXIgY2F0YWxvZ19yb290O1xuXG5cdFx0aWYgKCAhIGNhdGFsb2dfbW91bnQgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y2F0YWxvZ19yb290ID0gY2F0YWxvZ19tb3VudC5oYXNBdHRyaWJ1dGUoICdkYXRhLXdwYmMtY2F0YWxvZy1pZCcgKVxuXHRcdFx0PyBjYXRhbG9nX21vdW50XG5cdFx0XHQ6IGNhdGFsb2dfbW91bnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1pZF0nICk7XG5cblx0XHQvLyBUaGUgc2hhcmVkIGNvbnRyb2xsZXIgb3ducyB0aGUgYWN0aXZlLXBhY2sgYXR0cmlidXRlIG9uIHRoZSBpbm5lciBjYXRhbG9nIHJvb3QuXG5cdFx0aWYgKCAhIGNhdGFsb2dfcm9vdCB8fCAnY2FyZHMnICE9PSBjYXRhbG9nX3Jvb3QuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRlbXBsYXRlLXBhY2snICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y2F0YWxvZ19yb290LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtY2FyZC1ncm91cF0nICkuZm9yRWFjaCggZnVuY3Rpb24gKCBjYXJkX2dyb3VwICkge1xuXHRcdFx0dmFyIGNoaWxkcmVuX3BhbmVsID0gY2FyZF9ncm91cC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWNhcmQtY2hpbGRyZW4tcGFuZWxdJyApO1xuXHRcdFx0dmFyIHZpc2libGVfY2hpbGQgPSBjYXJkX2dyb3VwLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtY2FyZC1jaGlsZHJlbi1zbG90XSBbZGF0YS13cGJjLXVpLWNhdGFsb2ctcGFyZW50LW5vZGUtaWRdOm5vdChbaGlkZGVuXSknICk7XG5cblx0XHRcdGlmICggY2hpbGRyZW5fcGFuZWwgKSB7XG5cdFx0XHRcdGNoaWxkcmVuX3BhbmVsLmhpZGRlbiA9ICEgdmlzaWJsZV9jaGlsZDtcblx0XHRcdFx0Y2FyZF9ncm91cC5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtZXhwYW5kZWQnLCAhISB2aXNpYmxlX2NoaWxkICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFN5bmNocm9uaXplIG9uZSBkZXRhaWxzIGRpc2Nsb3N1cmUgYnV0dG9uLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fG51bGx9IHRvZ2dsZV9idXR0b24gRGlzY2xvc3VyZSBidXR0b24uXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gICAgICAgICAgaXNfZXhwYW5kZWQgICBXaGV0aGVyIGl0cyBkZXRhaWxzIHJvdyBpcyBvcGVuLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc2V0X2RldGFpbHNfdG9nZ2xlX3N0YXRlKCB0b2dnbGVfYnV0dG9uLCBpc19leHBhbmRlZCApIHtcblx0XHR2YXIgaWNvbjtcblx0XHR2YXIgbGFiZWw7XG5cblx0XHRpZiAoICEgdG9nZ2xlX2J1dHRvbiApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsYWJlbCA9IHRvZ2dsZV9idXR0b24uZ2V0QXR0cmlidXRlKCBpc19leHBhbmRlZCA/ICdkYXRhLWhpZGUtbGFiZWwnIDogJ2RhdGEtc2hvdy1sYWJlbCcgKSB8fCAnJztcblx0XHR0b2dnbGVfYnV0dG9uLnNldEF0dHJpYnV0ZSggJ2FyaWEtZXhwYW5kZWQnLCBpc19leHBhbmRlZCA/ICd0cnVlJyA6ICdmYWxzZScgKTtcblx0XHR0b2dnbGVfYnV0dG9uLnNldEF0dHJpYnV0ZSggJ2FyaWEtbGFiZWwnLCBsYWJlbCApO1xuXHRcdHRvZ2dsZV9idXR0b24uc2V0QXR0cmlidXRlKCAndGl0bGUnLCBsYWJlbCApO1xuXHRcdGljb24gPSB0b2dnbGVfYnV0dG9uLnF1ZXJ5U2VsZWN0b3IoICdzcGFuW2FyaWEtaGlkZGVuPVwidHJ1ZVwiXScgKTtcblx0XHRpZiAoIGljb24gKSB7XG5cdFx0XHRpY29uLmNsYXNzTmFtZSA9IGlzX2V4cGFuZGVkID8gJ3dwYmMtYmktY2hldnJvbi11cCcgOiAnd3BiYy1iaS1jaGV2cm9uLWRvd24nO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBDbG9zZSB0aGUgYWN0aXZlIGRldGFpbHMgcm93IGFuZCBjYW5jZWwgaXRzIGxhenkgcmVxdWVzdC5cblx0ICpcblx0ICogQHBhcmFtIHtib29sZWFufSByZXN0b3JlX2ZvY3VzIFdoZXRoZXIgdG8gcmV0dXJuIGZvY3VzIHRvIHRoZSBkaXNjbG9zdXJlLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gY2xvc2VfZGV0YWlsc19yb3coIHJlc3RvcmVfZm9jdXMgKSB7XG5cdFx0dmFyIGFjdGl2ZV9yb3cgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWRldGFpbHMtcm93XScgKTtcblx0XHR2YXIgZm9jdXNfdGFyZ2V0ID0gZGV0YWlsc190b2dnbGVfYnV0dG9uO1xuXG5cdFx0ZGV0YWlsc19yZXF1ZXN0X3NlcXVlbmNlICs9IDE7XG5cdFx0aWYgKCBkZXRhaWxzX2Fib3J0X2NvbnRyb2xsZXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGRldGFpbHNfYWJvcnRfY29udHJvbGxlci5hYm9ydCApIHtcblx0XHRcdGRldGFpbHNfYWJvcnRfY29udHJvbGxlci5hYm9ydCgpO1xuXHRcdH1cblx0XHRkZXRhaWxzX2Fib3J0X2NvbnRyb2xsZXIgPSBudWxsO1xuXHRcdGlmICggYWN0aXZlX3JvdyAmJiBhY3RpdmVfcm93LnBhcmVudE5vZGUgKSB7XG5cdFx0XHRhY3RpdmVfcm93LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoIGFjdGl2ZV9yb3cgKTtcblx0XHR9XG5cdFx0c2V0X2RldGFpbHNfdG9nZ2xlX3N0YXRlKCBkZXRhaWxzX3RvZ2dsZV9idXR0b24sIGZhbHNlICk7XG5cdFx0aWYgKCBkZXRhaWxzX3RvZ2dsZV9idXR0b24gKSB7XG5cdFx0XHR2YXIgc291cmNlX3JvdyA9IGdldF9yZXNvdXJjZV9pdGVtX2NvbnRhaW5lciggZGV0YWlsc190b2dnbGVfYnV0dG9uICk7XG5cdFx0XHRpZiAoIHNvdXJjZV9yb3cgKSB7XG5cdFx0XHRcdHNvdXJjZV9yb3cuY2xhc3NMaXN0LnJlbW92ZSggJ2lzLWRldGFpbHMtZXhwYW5kZWQnICk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGRldGFpbHNfcmVzb3VyY2VfaWQgPSAwO1xuXHRcdGRldGFpbHNfdG9nZ2xlX2J1dHRvbiA9IG51bGw7XG5cblx0XHRpZiAoIHJlc3RvcmVfZm9jdXMgJiYgZm9jdXNfdGFyZ2V0ICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jb250YWlucyggZm9jdXNfdGFyZ2V0ICkgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGZvY3VzX3RhcmdldC5mb2N1cyApIHtcblx0XHRcdGZvY3VzX3RhcmdldC5mb2N1cygpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBSZXBsYWNlIHRoZSBhY3RpdmUgZGV0YWlscyByb3cgdGhyb3VnaCB0aGUgcmVnaXN0ZXJlZCBXUCB0ZW1wbGF0ZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgY29uZmlnICAgICAgIENhdGFsb2cgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcmVzb3VyY2Vfcm93IFNvdXJjZSBSZXNvdXJjZSByb3cuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIHRlbXBsYXRlX2RhdGEgUHJlc2VudGF0aW9uLW9ubHkgdGVtcGxhdGUgc3RhdGUuXG5cdCAqIEByZXR1cm4ge0hUTUxFbGVtZW50fG51bGx9IFJlbmRlcmVkIGRldGFpbHMgcm93LlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVuZGVyX2RldGFpbHNfcm93KCBjb25maWcsIHJlc291cmNlX3JvdywgdGVtcGxhdGVfZGF0YSApIHtcblx0XHR2YXIgYWN0aXZlX3JvdyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtZGV0YWlscy1yb3ddJyApO1xuXHRcdHZhciBjYXJkX2dyb3VwID0gcmVzb3VyY2Vfcm93ID8gcmVzb3VyY2Vfcm93LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtY2FyZC1ncm91cF0nICkgOiBudWxsO1xuXHRcdHZhciBkZXRhaWxzX2h0bWwgPSByZW5kZXJfY29tcG9uZW50KCBjb25maWcsICdkZXRhaWxzJywgdGVtcGxhdGVfZGF0YSApO1xuXHRcdHZhciBpbnNlcnRpb25fdGFyZ2V0ID0gY2FyZF9ncm91cCB8fCByZXNvdXJjZV9yb3c7XG5cblx0XHRpZiAoICEgZGV0YWlsc19odG1sIHx8ICEgaW5zZXJ0aW9uX3RhcmdldCB8fCAhIGluc2VydGlvbl90YXJnZXQucGFyZW50Tm9kZSApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRpZiAoIGFjdGl2ZV9yb3cgJiYgYWN0aXZlX3Jvdy5wYXJlbnROb2RlICkge1xuXHRcdFx0YWN0aXZlX3Jvdy5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKCBhY3RpdmVfcm93ICk7XG5cdFx0fVxuXHRcdGluc2VydGlvbl90YXJnZXQuaW5zZXJ0QWRqYWNlbnRIVE1MKCAnYWZ0ZXJlbmQnLCBkZXRhaWxzX2h0bWwgKTtcblxuXHRcdHJldHVybiBpbnNlcnRpb25fdGFyZ2V0Lm5leHRFbGVtZW50U2libGluZztcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gYSBzYWZlIG1lc3NhZ2UgZnJvbSBhIG5vcm1hbGl6ZWQgZGV0YWlscyBlcnJvciByZXNwb25zZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IHJlc3BvbnNlIE5vcm1hbGl6ZWQgZW5kcG9pbnQgcmVzcG9uc2UuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBmYWxsYmFjayBMb2NhbGl6ZWQgZmFsbGJhY2sgbWVzc2FnZS5cblx0ICogQHJldHVybiB7c3RyaW5nfSBTYWZlIHBsYWluLXRleHQgbWVzc2FnZS5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9kZXRhaWxzX2Vycm9yX21lc3NhZ2UoIHJlc3BvbnNlLCBmYWxsYmFjayApIHtcblx0XHRyZXR1cm4gcmVzcG9uc2UgJiYgcmVzcG9uc2UuZXJyb3IgJiYgcmVzcG9uc2UuZXJyb3IubWVzc2FnZVxuXHRcdFx0PyBTdHJpbmcoIHJlc3BvbnNlLmVycm9yLm1lc3NhZ2UgKVxuXHRcdFx0OiBTdHJpbmcoIGZhbGxiYWNrIHx8ICcnICk7XG5cdH1cblxuXHQvKipcblx0ICogT3BlbiBvbmUgZGV0YWlscyByb3cgYW5kIGxhemlseSByZXF1ZXN0IGl0cyBhdXRob3JpemVkIERUTy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgY29uZmlnICAgICAgICBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHRvZ2dsZV9idXR0b24gRGV0YWlscyBkaXNjbG9zdXJlIGJ1dHRvbi5cblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcmVzb3VyY2Vfcm93ICBTb3VyY2UgUmVzb3VyY2Ugcm93LlxuXHQgKiBAcGFyYW0ge251bWJlcn0gICAgICByZXNvdXJjZV9pZCAgIEJvb2tpbmcgUmVzb3VyY2UgSUQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBvcGVuX2RldGFpbHNfcm93KCBjb25maWcsIHRvZ2dsZV9idXR0b24sIHJlc291cmNlX3JvdywgcmVzb3VyY2VfaWQgKSB7XG5cdFx0dmFyIGRldGFpbHNfcmVxdWVzdF9pZDtcblx0XHR2YXIgcmVxdWVzdF9ib2R5O1xuXHRcdHZhciByZXNvdXJjZV90aXRsZV9lbGVtZW50ID0gcmVzb3VyY2Vfcm93LnF1ZXJ5U2VsZWN0b3IoICcud3BiY191aV9saXN0aW5nX19pdGVtX3RpdGxlJyApO1xuXHRcdHZhciByZXNvdXJjZV90aXRsZSA9IHJlc291cmNlX3RpdGxlX2VsZW1lbnQgPyByZXNvdXJjZV90aXRsZV9lbGVtZW50LnRleHRDb250ZW50LnRyaW0oKSA6ICcnO1xuXHRcdHZhciB0ZW1wbGF0ZV9iYXNlO1xuXG5cdFx0Y2xvc2VfZGV0YWlsc19yb3coIGZhbHNlICk7XG5cdFx0ZGV0YWlsc19yZXNvdXJjZV9pZCA9IHJlc291cmNlX2lkO1xuXHRcdGRldGFpbHNfdG9nZ2xlX2J1dHRvbiA9IHRvZ2dsZV9idXR0b247XG5cdFx0ZGV0YWlsc19yZXF1ZXN0X2lkID0gKytkZXRhaWxzX3JlcXVlc3Rfc2VxdWVuY2U7XG5cdFx0c2V0X2RldGFpbHNfdG9nZ2xlX3N0YXRlKCB0b2dnbGVfYnV0dG9uLCB0cnVlICk7XG5cdFx0cmVzb3VyY2Vfcm93LmNsYXNzTGlzdC5hZGQoICdpcy1kZXRhaWxzLWV4cGFuZGVkJyApO1xuXHRcdHRlbXBsYXRlX2Jhc2UgPSB7XG5cdFx0XHRjb2xzcGFuOiBnZXRfZGV0YWlsc19jb2xzcGFuKCByZXNvdXJjZV9yb3cgKSxcblx0XHRcdHJlc291cmNlX2lkOiByZXNvdXJjZV9pZCxcblx0XHRcdHRpdGxlOiByZXNvdXJjZV90aXRsZVxuXHRcdH07XG5cdFx0cmVuZGVyX2RldGFpbHNfcm93KCBjb25maWcsIHJlc291cmNlX3JvdywgT2JqZWN0LmFzc2lnbigge30sIHRlbXBsYXRlX2Jhc2UsIHtcblx0XHRcdGxvYWRpbmdfbGFiZWw6IGNvbmZpZy5pMThuLmRldGFpbHNfbG9hZGluZyB8fCBjb25maWcuaTE4bi5sb2FkaW5nIHx8ICcnLFxuXHRcdFx0c3RhdGU6ICdsb2FkaW5nJ1xuXHRcdH0gKSApO1xuXG5cdFx0cmVxdWVzdF9ib2R5ID0gbmV3IHdpbmRvdy5VUkxTZWFyY2hQYXJhbXMoKTtcblx0XHRyZXF1ZXN0X2JvZHkuYXBwZW5kKCAnYWN0aW9uJywgY29uZmlnLmRldGFpbHNfYWN0aW9uICk7XG5cdFx0cmVxdWVzdF9ib2R5LmFwcGVuZCggJ25vbmNlJywgY29uZmlnLm5vbmNlIHx8ICcnICk7XG5cdFx0cmVxdWVzdF9ib2R5LmFwcGVuZCggJ3JlcXVlc3RfaWQnLCBTdHJpbmcoIGRldGFpbHNfcmVxdWVzdF9pZCApICk7XG5cdFx0cmVxdWVzdF9ib2R5LmFwcGVuZCggJ3Jlc291cmNlX2lkJywgU3RyaW5nKCByZXNvdXJjZV9pZCApICk7XG5cdFx0ZGV0YWlsc19hYm9ydF9jb250cm9sbGVyID0gJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5BYm9ydENvbnRyb2xsZXIgPyBuZXcgd2luZG93LkFib3J0Q29udHJvbGxlcigpIDogbnVsbDtcblxuXHRcdHdpbmRvdy5mZXRjaCggY29uZmlnLmFqYXhfdXJsLCB7XG5cdFx0XHRib2R5OiByZXF1ZXN0X2JvZHkudG9TdHJpbmcoKSxcblx0XHRcdGNyZWRlbnRpYWxzOiAnc2FtZS1vcmlnaW4nLFxuXHRcdFx0aGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZDsgY2hhcnNldD1VVEYtOCcgfSxcblx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0c2lnbmFsOiBkZXRhaWxzX2Fib3J0X2NvbnRyb2xsZXIgPyBkZXRhaWxzX2Fib3J0X2NvbnRyb2xsZXIuc2lnbmFsIDogdW5kZWZpbmVkXG5cdFx0fSApLnRoZW4oIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRyZXR1cm4gcmVzcG9uc2UuanNvbigpO1xuXHRcdH0gKS50aGVuKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0aWYgKCBkZXRhaWxzX3JlcXVlc3RfaWQgIT09IGRldGFpbHNfcmVxdWVzdF9zZXF1ZW5jZSB8fCByZXNvdXJjZV9pZCAhPT0gZGV0YWlsc19yZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHJlc3BvbnNlIHx8IHRydWUgIT09IHJlc3BvbnNlLnN1Y2Nlc3MgfHwgTnVtYmVyKCByZXNwb25zZS5yZXF1ZXN0X2lkICkgIT09IGRldGFpbHNfcmVxdWVzdF9pZCB8fCBOdW1iZXIoIHJlc3BvbnNlLnJlc291cmNlX2lkICkgIT09IHJlc291cmNlX2lkIHx8ICEgcmVzcG9uc2UuZGV0YWlscyB8fCAhIEFycmF5LmlzQXJyYXkoIHJlc3BvbnNlLmRldGFpbHMuc2VjdGlvbnMgKSApIHtcblx0XHRcdFx0cmVuZGVyX2RldGFpbHNfcm93KCBjb25maWcsIHJlc291cmNlX3JvdywgT2JqZWN0LmFzc2lnbigge30sIHRlbXBsYXRlX2Jhc2UsIHtcblx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlOiBnZXRfZGV0YWlsc19lcnJvcl9tZXNzYWdlKCByZXNwb25zZSwgY29uZmlnLmkxOG4uZGV0YWlsc19sb2FkX2ZhaWxlZCApLFxuXHRcdFx0XHRcdHN0YXRlOiAnZXJyb3InXG5cdFx0XHRcdH0gKSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRyZW5kZXJfZGV0YWlsc19yb3coIGNvbmZpZywgcmVzb3VyY2Vfcm93LCBPYmplY3QuYXNzaWduKCB7fSwgdGVtcGxhdGVfYmFzZSwgcmVzcG9uc2UuZGV0YWlscywge1xuXHRcdFx0XHRjb2xzcGFuOiBnZXRfZGV0YWlsc19jb2xzcGFuKCByZXNvdXJjZV9yb3cgKSxcblx0XHRcdFx0c3RhdGU6ICdyZWFkeSdcblx0XHRcdH0gKSApO1xuXHRcdFx0dmFyIGNhdGFsb2dfbW91bnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggY29uZmlnLm1vdW50X2lkICk7XG5cdFx0XHRzeW5jaHJvbml6ZV9vdmVyZmxvd190b29sdGlwcyggY2F0YWxvZ19tb3VudCApO1xuXHRcdFx0aW5pdGlhbGl6ZV9kZXRhaWxzX3Rvb2x0aXBzKCBjYXRhbG9nX21vdW50ICk7XG5cdFx0fSApLmNhdGNoKCBmdW5jdGlvbiAoIGVycm9yICkge1xuXHRcdFx0aWYgKCBlcnJvciAmJiAnQWJvcnRFcnJvcicgPT09IGVycm9yLm5hbWUgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggZGV0YWlsc19yZXF1ZXN0X2lkID09PSBkZXRhaWxzX3JlcXVlc3Rfc2VxdWVuY2UgJiYgcmVzb3VyY2VfaWQgPT09IGRldGFpbHNfcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdHJlbmRlcl9kZXRhaWxzX3JvdyggY29uZmlnLCByZXNvdXJjZV9yb3csIE9iamVjdC5hc3NpZ24oIHt9LCB0ZW1wbGF0ZV9iYXNlLCB7XG5cdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZTogY29uZmlnLmkxOG4uZGV0YWlsc19sb2FkX2ZhaWxlZCB8fCAnJyxcblx0XHRcdFx0XHRzdGF0ZTogJ2Vycm9yJ1xuXHRcdFx0XHR9ICkgKTtcblx0XHRcdH1cblx0XHR9ICkudGhlbiggZnVuY3Rpb24gKCkge1xuXHRcdFx0aWYgKCBkZXRhaWxzX3JlcXVlc3RfaWQgPT09IGRldGFpbHNfcmVxdWVzdF9zZXF1ZW5jZSApIHtcblx0XHRcdFx0ZGV0YWlsc19hYm9ydF9jb250cm9sbGVyID0gbnVsbDtcblx0XHRcdH1cblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogQ29weSBvbmUgZGV0YWlscyB2YWx1ZSB3aXRob3V0IG5hdmlnYXRpbmcgb3IgbXV0YXRpbmcgUmVzb3VyY2Ugc3RhdGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSAgICAgIGNvcHlfdmFsdWUgICAgUGxhaW4gdGV4dCB0byBjb3B5LlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBhY3Rpb25fYnV0dG9uIENvcHkgYnV0dG9uIHVzZWQgdG8gbG9jYXRlIHN0YXR1cyB0ZXh0LlxuXHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBjb25maWcgICAgICAgIENhdGFsb2cgY29uZmlndXJhdGlvbi5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGNvcHlfZGV0YWlsc192YWx1ZSggY29weV92YWx1ZSwgYWN0aW9uX2J1dHRvbiwgY29uZmlnICkge1xuXHRcdHZhciBkZXRhaWxzX3JvdyA9IGFjdGlvbl9idXR0b24uY2xvc2VzdCggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1kZXRhaWxzLXJvd10nICk7XG5cdFx0dmFyIHJlc291cmNlX2lkID0gTnVtYmVyKCBhY3Rpb25fYnV0dG9uLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWlkJyApIHx8IDAgKTtcblx0XHR2YXIgc3RhdHVzX2VsZW1lbnQgPSBkZXRhaWxzX3Jvd1xuXHRcdFx0PyBkZXRhaWxzX3Jvdy5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWNvcHktc3RhdHVzXScgKVxuXHRcdFx0OiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWNvcHktc3RhdHVzPVwiJyArIFN0cmluZyggcmVzb3VyY2VfaWQgKSArICdcIl0nICk7XG5cdFx0dmFyIGNvcHlfcHJvbWlzZTtcblxuXHRcdGlmICggd2luZG93Lm5hdmlnYXRvci5jbGlwYm9hcmQgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5uYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dCApIHtcblx0XHRcdGNvcHlfcHJvbWlzZSA9IHdpbmRvdy5uYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dCggY29weV92YWx1ZSApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb3B5X3Byb21pc2UgPSBuZXcgd2luZG93LlByb21pc2UoIGZ1bmN0aW9uICggcmVzb2x2ZSwgcmVqZWN0ICkge1xuXHRcdFx0XHR2YXIgY29weV9pbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICd0ZXh0YXJlYScgKTtcblx0XHRcdFx0Y29weV9pbnB1dC52YWx1ZSA9IGNvcHlfdmFsdWU7XG5cdFx0XHRcdGNvcHlfaW5wdXQuc2V0QXR0cmlidXRlKCAncmVhZG9ubHknLCAncmVhZG9ubHknICk7XG5cdFx0XHRcdGNvcHlfaW5wdXQuc3R5bGUucG9zaXRpb24gPSAnZml4ZWQnO1xuXHRcdFx0XHRjb3B5X2lucHV0LnN0eWxlLm9wYWNpdHkgPSAnMCc7XG5cdFx0XHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoIGNvcHlfaW5wdXQgKTtcblx0XHRcdFx0Y29weV9pbnB1dC5zZWxlY3QoKTtcblx0XHRcdFx0aWYgKCBkb2N1bWVudC5leGVjQ29tbWFuZCggJ2NvcHknICkgKSB7XG5cdFx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlamVjdCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoIGNvcHlfaW5wdXQgKTtcblx0XHRcdH0gKTtcblx0XHR9XG5cdFx0Y29weV9wcm9taXNlLnRoZW4oIGZ1bmN0aW9uICgpIHtcblx0XHRcdGlmICggc3RhdHVzX2VsZW1lbnQgKSB7XG5cdFx0XHRcdHN0YXR1c19lbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoICdoYXMtZXJyb3InICk7XG5cdFx0XHRcdHN0YXR1c19lbGVtZW50LnRleHRDb250ZW50ID0gY29uZmlnLmkxOG4uc2hvcnRjb2RlX2NvcGllZCB8fCAnJztcblx0XHRcdH1cblx0XHR9ICkuY2F0Y2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdGlmICggc3RhdHVzX2VsZW1lbnQgKSB7XG5cdFx0XHRcdHN0YXR1c19lbGVtZW50LmNsYXNzTGlzdC5hZGQoICdoYXMtZXJyb3InICk7XG5cdFx0XHRcdHN0YXR1c19lbGVtZW50LnRleHRDb250ZW50ID0gY29uZmlnLmkxOG4uc2hvcnRjb2RlX2NvcHlfZmFpbGVkIHx8ICcnO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gdGhlIGN1cnJlbnQgZWZmZWN0aXZlIHNob3J0Y29kZSBmb3Igb25lIFJlc291cmNlLlxuXHQgKlxuXHQgKiBUaGUgYWN0aXZlIGluc3BlY3RvciB3aW5zIHNvIHVuc2F2ZWQgY3VzdG9taXplciBjaGFuZ2VzIGFyZSB1c2VkIGJ5IENvcHlcblx0ICogYW5kIFB1Ymxpc2guIEEgaGlkZGVuIGNvbXBhdGliaWxpdHkgaW5wdXQgaXMgdGhlIGZhbGxiYWNrIHJlcXVpcmVkIGJ5IHRoZVxuXHQgKiBzaGFyZWQgQm9va2luZyBDYWxlbmRhciBwdWJsaXNoIHdpemFyZC5cblx0ICpcblx0ICogQHBhcmFtIHtudW1iZXJ9ICAgICAgcmVzb3VyY2VfaWQgIEJvb2tpbmcgUmVzb3VyY2UgSUQuXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGFjdGlvbl9idXR0b24gT3B0aW9uYWwgaW5pdGlhdGluZyBhY3Rpb24uXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gQ3VycmVudCBlZmZlY3RpdmUgc2hvcnRjb2RlLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X2Jvb2tpbmdfcmVzb3VyY2Vfc2hvcnRjb2RlKCByZXNvdXJjZV9pZCwgYWN0aW9uX2J1dHRvbiApIHtcblx0XHR2YXIgaW5zcGVjdG9yX3Nob3J0Y29kZSA9IHJlc291cmNlX2lkID09PSBpbnNwZWN0b3JfcmVzb3VyY2VfaWRcblx0XHRcdD8gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1pbnNwZWN0b3ItZm9ybV0gLndwYmNfY2F0YWxvZ19ib29raW5nX3Jlc291cmNlc19fZWRpdG9yX2NvZGUnIClcblx0XHRcdDogbnVsbDtcblx0XHR2YXIgaGlkZGVuX3Nob3J0Y29kZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnYm9va2luZ19yZXNvdXJjZV9zaG9ydGNvZGVfJyArIFN0cmluZyggcmVzb3VyY2VfaWQgKSApO1xuXG5cdFx0aWYgKCBpbnNwZWN0b3Jfc2hvcnRjb2RlICkge1xuXHRcdFx0cmV0dXJuIFN0cmluZyggaW5zcGVjdG9yX3Nob3J0Y29kZS52YWx1ZSB8fCAnJyApO1xuXHRcdH1cblx0XHRpZiAoIGFjdGlvbl9idXR0b24gJiYgYWN0aW9uX2J1dHRvbi5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1zaG9ydGNvZGUnICkgKSB7XG5cdFx0XHRyZXR1cm4gU3RyaW5nKCBhY3Rpb25fYnV0dG9uLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLXNob3J0Y29kZScgKSB8fCAnJyApO1xuXHRcdH1cblxuXHRcdHJldHVybiBoaWRkZW5fc2hvcnRjb2RlID8gU3RyaW5nKCBoaWRkZW5fc2hvcnRjb2RlLnZhbHVlIHx8ICcnICkgOiAnJztcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGUgb3IgdXBkYXRlIHRoZSBoaWRkZW4gaW5wdXQgY29uc3VtZWQgYnkgdGhlIHNoYXJlZCBwdWJsaXNoIHdpemFyZC5cblx0ICpcblx0ICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkIEJvb2tpbmcgUmVzb3VyY2UgSUQuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBzaG9ydGNvZGUgICBFZmZlY3RpdmUgQm9va2luZyBzaG9ydGNvZGUuXG5cdCAqIEByZXR1cm4ge0hUTUxJbnB1dEVsZW1lbnR8bnVsbH0gQ29tcGF0aWJpbGl0eSBpbnB1dCBvciBudWxsLlxuXHQgKi9cblx0ZnVuY3Rpb24gc3luY2hyb25pemVfYm9va2luZ19yZXNvdXJjZV9zaG9ydGNvZGVfaW5wdXQoIHJlc291cmNlX2lkLCBzaG9ydGNvZGUgKSB7XG5cdFx0dmFyIGlucHV0O1xuXG5cdFx0aWYgKCAhIHJlc291cmNlX2lkICkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGlucHV0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICdib29raW5nX3Jlc291cmNlX3Nob3J0Y29kZV8nICsgU3RyaW5nKCByZXNvdXJjZV9pZCApICk7XG5cdFx0aWYgKCAhIGlucHV0ICkge1xuXHRcdFx0aW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnaW5wdXQnICk7XG5cdFx0XHRpbnB1dC50eXBlID0gJ2hpZGRlbic7XG5cdFx0XHRpbnB1dC5pZCA9ICdib29raW5nX3Jlc291cmNlX3Nob3J0Y29kZV8nICsgU3RyaW5nKCByZXNvdXJjZV9pZCApO1xuXHRcdFx0aW5wdXQuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWNhdGFsb2ctc2hvcnRjb2RlLWNvbXBhdGliaWxpdHknLCBTdHJpbmcoIHJlc291cmNlX2lkICkgKTtcblx0XHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoIGlucHV0ICk7XG5cdFx0fVxuXHRcdGlucHV0LnZhbHVlID0gU3RyaW5nKCBzaG9ydGNvZGUgfHwgJycgKTtcblxuXHRcdHJldHVybiBpbnB1dDtcblx0fVxuXG5cdC8qKlxuXHQgKiBPcGVuIHRoZSBzaGFyZWQgQm9va2luZyBDYWxlbmRhciBzaG9ydGNvZGUgY3VzdG9taXplciBmb3Igb25lIFJlc291cmNlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWQgQm9va2luZyBSZXNvdXJjZSBJRC5cblx0ICogQHBhcmFtIHtzdHJpbmd9IHNob3J0Y29kZSAgIEN1cnJlbnQgc2hvcnRjb2RlLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gY3VzdG9taXplX2Jvb2tpbmdfcmVzb3VyY2Vfc2hvcnRjb2RlKCByZXNvdXJjZV9pZCwgc2hvcnRjb2RlICkge1xuXHRcdHN5bmNocm9uaXplX2Jvb2tpbmdfcmVzb3VyY2Vfc2hvcnRjb2RlX2lucHV0KCByZXNvdXJjZV9pZCwgc2hvcnRjb2RlICk7XG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfcmVzb3VyY2VfcGFnZV9idG5fY2xpY2sgKSB7XG5cdFx0XHR3aW5kb3cud3BiY19yZXNvdXJjZV9wYWdlX2J0bl9jbGljayggcmVzb3VyY2VfaWQsIHNob3J0Y29kZSApO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBPcGVuIHRoZSBzaGFyZWQgQm9va2luZyBDYWxlbmRhciBlbWJlZC9jcmVhdGUtcGFnZSB3aXphcmQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCBCb29raW5nIFJlc291cmNlIElELlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gc2hvcnRjb2RlICAgQ3VycmVudCBzaG9ydGNvZGUuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBwdWJsaXNoX2Jvb2tpbmdfcmVzb3VyY2Vfc2hvcnRjb2RlKCByZXNvdXJjZV9pZCwgc2hvcnRjb2RlLCB0cmlnZ2VyX2J1dHRvbiApIHtcblx0XHRzeW5jaHJvbml6ZV9ib29raW5nX3Jlc291cmNlX3Nob3J0Y29kZV9pbnB1dCggcmVzb3VyY2VfaWQsIHNob3J0Y29kZSApO1xuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX3B1Ymxpc2hfYm9va2luZ19mb3JtX19vcGVuICkge1xuXHRcdFx0d2luZG93LndwYmNfcHVibGlzaF9ib29raW5nX2Zvcm1fX29wZW4oIHJlc291cmNlX2lkLCBzaG9ydGNvZGUsIHRyaWdnZXJfYnV0dG9uICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIE9wZW4gdGhlIGluZm9ybWF0aW9uYWwgRnJlZS1lZGl0aW9uIEJvb2tpbmcgUmVzb3VyY2UgdXBncmFkZSBkaWFsb2cuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHRyaWdnZXJfYnV0dG9uIEJ1dHRvbiB0aGF0IG9wZW5lZCB0aGUgZGlhbG9nLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gb3Blbl9ib29raW5nX3Jlc291cmNlX3VwZ3JhZGVfZGlhbG9nKCB0cmlnZ2VyX2J1dHRvbiApIHtcblx0XHR2YXIgbW9kYWxfZWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19jYXRhbG9nX2Jvb2tpbmdfcmVzb3VyY2VzX191cGdyYWRlX21vZGFsJyApO1xuXHRcdHZhciB1cGdyYWRlX3VybCA9IHRyaWdnZXJfYnV0dG9uID8gdHJpZ2dlcl9idXR0b24uZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWNhdGFsb2ctYm9va2luZy1yZXNvdXJjZS11cGdyYWRlLXVybCcgKSA6ICcnO1xuXG5cdFx0aWYgKCBtb2RhbF9lbGVtZW50ICYmIHdpbmRvdy5qUXVlcnkgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5qUXVlcnkoIG1vZGFsX2VsZW1lbnQgKS53cGJjX215X21vZGFsICkge1xuXHRcdFx0d2luZG93LmpRdWVyeSggbW9kYWxfZWxlbWVudCApXG5cdFx0XHRcdC5vZmYoICdoaWRkZW4ud3BiYy5tb2RhbC53cGJjQ2F0YWxvZ1Jlc291cmNlVXBncmFkZSBoaWRkZW4uYnMubW9kYWwud3BiY0NhdGFsb2dSZXNvdXJjZVVwZ3JhZGUnIClcblx0XHRcdFx0Lm9uZSggJ2hpZGRlbi53cGJjLm1vZGFsLndwYmNDYXRhbG9nUmVzb3VyY2VVcGdyYWRlIGhpZGRlbi5icy5tb2RhbC53cGJjQ2F0YWxvZ1Jlc291cmNlVXBncmFkZScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRpZiAoIHRyaWdnZXJfYnV0dG9uICYmIGRvY3VtZW50LmNvbnRhaW5zKCB0cmlnZ2VyX2J1dHRvbiApICkge1xuXHRcdFx0XHRcdFx0dHJpZ2dlcl9idXR0b24uZm9jdXMoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKVxuXHRcdFx0XHQud3BiY19teV9tb2RhbCggJ3Nob3cnICk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCB1cGdyYWRlX3VybCApIHtcblx0XHRcdHdpbmRvdy5vcGVuKCB1cGdyYWRlX3VybCwgJ19ibGFuaycsICdub29wZW5lcicgKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogT3BlbiB0aGUgcmV1c2FibGUgbmF0aXZlIGNhdGFsb2cgbWVzc2FnZSBkaWFsb2cuXG5cdCAqXG5cdCAqIE1lc3NhZ2UgY29udGVudCBpcyBhc3NpZ25lZCB3aXRoIHRleHRDb250ZW50IHNvIHRyYW5zbGF0ZWQgb3Igc2VydmVyLXByb3ZpZGVkXG5cdCAqIHRleHQgY2Fubm90IGJlY29tZSBkaWFsb2cgbWFya3VwLiBUaGUgYnJvd3NlciBhbGVydCByZW1haW5zIGEgcmVzaWxpZW5jZVxuXHQgKiBmYWxsYmFjayB3aGVuIHRoZSBCb29raW5nIENhbGVuZGFyIG1vZGFsIHJ1bnRpbWUgaXMgdW5hdmFpbGFibGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSAgICAgIG1lc3NhZ2UgICAgICAgIE1lc3NhZ2Ugc2hvd24gaW4gdGhlIGRpYWxvZyBib2R5LlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICB0aXRsZSAgICAgICAgICBPcHRpb25hbCBkaWFsb2cgaGVhZGluZy5cblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gdHJpZ2dlcl9idXR0b24gQ29udHJvbCB0aGF0IG9wZW5lZCB0aGUgZGlhbG9nLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIG5hdGl2ZSBkaWFsb2cgb3BlbmVkOyBvdGhlcndpc2UgZmFsc2UuXG5cdCAqL1xuXHRmdW5jdGlvbiBvcGVuX2Jvb2tpbmdfcmVzb3VyY2VfbWVzc2FnZV9kaWFsb2coIG1lc3NhZ2UsIHRpdGxlLCB0cmlnZ2VyX2J1dHRvbiApIHtcblx0XHR2YXIgbW9kYWxfZWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19jYXRhbG9nX2Jvb2tpbmdfcmVzb3VyY2VzX19tZXNzYWdlX21vZGFsJyApO1xuXHRcdHZhciB0aXRsZV9lbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2NhdGFsb2dfYm9va2luZ19yZXNvdXJjZXNfX21lc3NhZ2VfbW9kYWxfdGl0bGUnICk7XG5cdFx0dmFyIGRlc2NyaXB0aW9uX2VsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfY2F0YWxvZ19ib29raW5nX3Jlc291cmNlc19fbWVzc2FnZV9tb2RhbF9kZXNjcmlwdGlvbicgKTtcblxuXHRcdGlmICggbWVzc2FnZSAmJiBtb2RhbF9lbGVtZW50ICYmIGRlc2NyaXB0aW9uX2VsZW1lbnQgJiYgd2luZG93LmpRdWVyeSAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LmpRdWVyeSggbW9kYWxfZWxlbWVudCApLndwYmNfbXlfbW9kYWwgKSB7XG5cdFx0XHRkZXNjcmlwdGlvbl9lbGVtZW50LnRleHRDb250ZW50ID0gbWVzc2FnZTtcblx0XHRcdGlmICggdGl0bGVfZWxlbWVudCApIHtcblx0XHRcdFx0dGl0bGVfZWxlbWVudC50ZXh0Q29udGVudCA9IHRpdGxlIHx8IHRpdGxlX2VsZW1lbnQuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWRlZmF1bHQtdGl0bGUnICkgfHwgJyc7XG5cdFx0XHR9XG5cdFx0XHR3aW5kb3cualF1ZXJ5KCBtb2RhbF9lbGVtZW50IClcblx0XHRcdFx0Lm9mZiggJ2hpZGRlbi53cGJjLm1vZGFsLndwYmNDYXRhbG9nUmVzb3VyY2VNZXNzYWdlIGhpZGRlbi5icy5tb2RhbC53cGJjQ2F0YWxvZ1Jlc291cmNlTWVzc2FnZScgKVxuXHRcdFx0XHQub25lKCAnaGlkZGVuLndwYmMubW9kYWwud3BiY0NhdGFsb2dSZXNvdXJjZU1lc3NhZ2UgaGlkZGVuLmJzLm1vZGFsLndwYmNDYXRhbG9nUmVzb3VyY2VNZXNzYWdlJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdGlmICggdHJpZ2dlcl9idXR0b24gJiYgZG9jdW1lbnQuY29udGFpbnMoIHRyaWdnZXJfYnV0dG9uICkgKSB7XG5cdFx0XHRcdFx0XHR0cmlnZ2VyX2J1dHRvbi5mb2N1cygpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSApXG5cdFx0XHRcdC53cGJjX215X21vZGFsKCAnc2hvdycgKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdGlmICggbWVzc2FnZSAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LmFsZXJ0ICkge1xuXHRcdFx0d2luZG93LmFsZXJ0KCBtZXNzYWdlICk7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gdGhlIHRlbXBsYXRlLWRyaXZlbiBpbnNwZWN0b3IgaG9zdC5cblx0ICpcblx0ICogQHJldHVybiB7SFRNTEVsZW1lbnR8bnVsbH0gSW5zcGVjdG9yIGhvc3Qgb3IgbnVsbC5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9pbnNwZWN0b3JfaG9zdCgpIHtcblx0XHRyZXR1cm4gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1ib29raW5nLXJlc291cmNlcy1pbnNwZWN0b3ItaG9zdF0nICk7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIHRoZSBzdGlja3kgbmF0aXZlLXNpZGViYXIgZm9vdGVyLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtIVE1MRWxlbWVudHxudWxsfSBGb290ZXIgZWxlbWVudCBvciBudWxsLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X2luc3BlY3Rvcl9mb290ZXIoKSB7XG5cdFx0cmV0dXJuIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5zcGVjdG9yLWZvb3Rlcl0nICk7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIHRoZSBzaGFyZWQgbmF0aXZlIGluc3BlY3RvciBzdGF0ZSB3b3JrZmxvdy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEByZXR1cm4ge09iamVjdHxmYWxzZX0gU2hhcmVkIGluc3BlY3RvciB3b3JrZmxvdyBvciBmYWxzZS5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9pbnNwZWN0b3Jfd29ya2Zsb3coIGNvbmZpZyApIHtcblx0XHRpZiAoIGluc3BlY3Rvcl93b3JrZmxvd19jb250cm9sbGVyICkge1xuXHRcdFx0cmV0dXJuIGluc3BlY3Rvcl93b3JrZmxvd19jb250cm9sbGVyO1xuXHRcdH1cblx0XHRpZiAoICEgd2luZG93LndwYmNfdWlfY2F0YWxvZyB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93LndwYmNfdWlfY2F0YWxvZy5jcmVhdGVfaW5zcGVjdG9yX3dvcmtmbG93ICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGluc3BlY3Rvcl93b3JrZmxvd19jb250cm9sbGVyID0gd2luZG93LndwYmNfdWlfY2F0YWxvZy5jcmVhdGVfaW5zcGVjdG9yX3dvcmtmbG93KCB7XG5cdFx0XHRleHBhbmQ6IGV4cGFuZF9pbnNwZWN0b3Jfc2lkZWJhcixcblx0XHRcdGdldF9mb290ZXI6IGdldF9pbnNwZWN0b3JfZm9vdGVyLFxuXHRcdFx0Z2V0X2hvc3Q6IGdldF9pbnNwZWN0b3JfaG9zdCxcblx0XHRcdHJlbmRlcl9zaGVsbDogZnVuY3Rpb24gKCBzaGVsbF9kYXRhICkgeyByZXR1cm4gcmVuZGVyX2NvbXBvbmVudCggY29uZmlnLCAnaW5zcGVjdG9yJywgc2hlbGxfZGF0YSApOyB9LFxuXHRcdFx0c2hlbGxfZGF0YToge1xuXHRcdFx0XHRjYXRhbG9nX2lkOiBjb25maWcuaWQsXG5cdFx0XHRcdGVtcHR5X2ljb246ICd3cGJjLWJpLXBlbmNpbC1zcXVhcmUnLFxuXHRcdFx0XHRlbXB0eV9tZXNzYWdlOiBjb25maWcuaTE4bi5pbnNwZWN0b3JfZW1wdHlfbWVzc2FnZSB8fCAnJyxcblx0XHRcdFx0ZW1wdHlfdGl0bGU6IGNvbmZpZy5pMThuLmluc3BlY3Rvcl9lbXB0eV90aXRsZSB8fCAnJyxcblx0XHRcdFx0bG9hZGluZ19sYWJlbDogY29uZmlnLmkxOG4uaW5zcGVjdG9yX2xvYWRpbmcgfHwgY29uZmlnLmkxOG4ubG9hZGluZyB8fCAnJ1xuXHRcdFx0fVxuXHRcdH0gKTtcblxuXHRcdHJldHVybiBpbnNwZWN0b3Jfd29ya2Zsb3dfY29udHJvbGxlcjtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZW5kZXIgdGhlIHNoYXJlZCBpbnNwZWN0b3IgZmFsbGJhY2stc3RhdGUgc2hlbGwgb25jZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgc2hlbGwgaXMgYXZhaWxhYmxlLlxuXHQgKi9cblx0ZnVuY3Rpb24gbW91bnRfaW5zcGVjdG9yX3NoZWxsKCBjb25maWcgKSB7XG5cdFx0dmFyIGluc3BlY3Rvcl93b3JrZmxvdyA9IGdldF9pbnNwZWN0b3Jfd29ya2Zsb3coIGNvbmZpZyApO1xuXG5cdFx0cmV0dXJuICEhIGluc3BlY3Rvcl93b3JrZmxvdyAmJiBpbnNwZWN0b3Jfd29ya2Zsb3cubW91bnQoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBFeHBhbmQgdGhlIG5hdGl2ZSByaWdodCBzaWRlYmFyIGFmdGVyIGFuIGV4cGxpY2l0IGVkaXRvciBhY3Rpb24uXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBleHBhbmRfaW5zcGVjdG9yX3NpZGViYXIoKSB7XG5cdFx0c3luY2hyb25pemVfaW5zcGVjdG9yX3dpZHRoKCk7XG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX2RvX21heCApIHtcblx0XHRcdHdpbmRvdy53cGJjX2FkbWluX3VpX19zaWRlYmFyX3JpZ2h0X19kb19tYXgoKTtcblx0XHR9XG5cdFx0ZG9jdW1lbnQuZGlzcGF0Y2hFdmVudCggbmV3IEN1c3RvbUV2ZW50KCAnd3BiY19zZXR1cF93aXphcmRfbGF5b3V0X2NoYW5nZWQnICkgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBcHBseSB0aGUgZXN0YWJsaXNoZWQgd2lkZXIgc2lkZWJhciBvbmx5IHdoaWxlIGNyZWF0aW5nIFJlc291cmNlcy5cblx0ICpcblx0ICogVGhlIG5ldyBjYXRhbG9nIG93bnMgaXRzIGNsYXNzIGFuZCBzdHlsaW5nIHNvIGl0IGRvZXMgbm90IGRlcGVuZCBvbiB0aGUgb2xkXG5cdCAqIGxpc3RpbmcgYXNzZXRzIHdoaWxlIHJldGFpbmluZyB0aGUgc2FtZSBuYXRpdmUtc2lkZWJhciB3aWR0aCBjb250cmFjdC5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHN5bmNocm9uaXplX2luc3BlY3Rvcl93aWR0aCgpIHtcblx0XHR2YXIgaG9zdCA9IGdldF9pbnNwZWN0b3JfaG9zdCgpO1xuXHRcdHZhciBzaWRlYmFyID0gaG9zdCA/IGhvc3QuY2xvc2VzdCggJy53cGJjX3VpX2VsX192ZXJ0X3JpZ2h0X2Jhcl9fd3JhcHBlcicgKSA6IG51bGw7XG5cblx0XHRpZiAoIHNpZGViYXIgKSB7XG5cdFx0XHRzaWRlYmFyLmNsYXNzTGlzdC50b2dnbGUoICd3cGJjX2NhdGFsb2dfYm9va2luZ19yZXNvdXJjZXNfX2luc3BlY3Rvcl93aWR0aC0td2lkZScsICdjcmVhdGUnID09PSBpbnNwZWN0b3JfbW9kZSApO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBNYXJrIG9ubHkgdGhlIFJlc291cmNlIGN1cnJlbnRseSBvd25lZCBieSB0aGUgaW5zcGVjdG9yLlxuXHQgKlxuXHQgKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWQgUmVzb3VyY2UgSUQgb3IgemVybyB0byBjbGVhciBoaWdobGlnaHRpbmcuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBtYXJrX2luc3BlY3Rvcl9yZXNvdXJjZV9yb3coIHJlc291cmNlX2lkICkge1xuXHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtaWRdLmlzLWVkaXRvci1hY3RpdmUnICkuZm9yRWFjaCggZnVuY3Rpb24gKCByb3cgKSB7XG5cdFx0XHRyb3cuY2xhc3NMaXN0LnJlbW92ZSggJ2lzLWVkaXRvci1hY3RpdmUnICk7XG5cdFx0fSApO1xuXHRcdGlmICggcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHR2YXIgcm93ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1pZD1cIicgKyBTdHJpbmcoIHJlc291cmNlX2lkICkgKyAnXCJdJyApO1xuXHRcdFx0aWYgKCByb3cgKSB7XG5cdFx0XHRcdHJvdy5jbGFzc0xpc3QuYWRkKCAnaXMtZWRpdG9yLWFjdGl2ZScgKTtcblx0XHRcdFx0cm93LnNjcm9sbEludG9WaWV3KCB7IGJsb2NrOiAnbmVhcmVzdCcsIGJlaGF2aW9yOiAnc21vb3RoJyB9ICk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFN5bmNocm9uaXplIHNoYXJlZCBlbXB0eSwgbG9hZGluZywgZXJyb3IsIGZvcm0sIGFuZCBmb290ZXIgc3RhdGVzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gc3RhdGUgRW1wdHksIGxvYWRpbmcsIGVycm9yLCBvciBmb3JtLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSBPcHRpb25hbCBzYWZlIGVycm9yIG1lc3NhZ2UuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzZXRfaW5zcGVjdG9yX3N0YXRlKCBzdGF0ZSwgbWVzc2FnZSApIHtcblx0XHRpZiAoIGluc3BlY3Rvcl93b3JrZmxvd19jb250cm9sbGVyICkge1xuXHRcdFx0aW5zcGVjdG9yX3dvcmtmbG93X2NvbnRyb2xsZXIuc2V0X3N0YXRlKCBzdGF0ZSwgbWVzc2FnZSApO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBTZXJpYWxpemUgY3VycmVudCBlZGl0YWJsZSBmaWVsZCB2YWx1ZXMgZm9yIGRpcnR5LXN0YXRlIGNvbXBhcmlzb24uXG5cdCAqXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gU3RhYmxlIEpTT04gZmllbGQgc25hcHNob3QuXG5cdCAqL1xuXHRmdW5jdGlvbiBzZXJpYWxpemVfaW5zcGVjdG9yX2ZpZWxkcygpIHtcblx0XHR2YXIgZmllbGRzID0ge307XG5cdFx0ZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1pbnNwZWN0b3ItZm9ybV0gW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLXJhZGlvLWZpZWxkXTpjaGVja2VkJyApLmZvckVhY2goIGZ1bmN0aW9uICggZmllbGQgKSB7XG5cdFx0XHRmaWVsZHNbIGZpZWxkLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLXJhZGlvLWZpZWxkJyApIHx8ICcnIF0gPSBmaWVsZC52YWx1ZTtcblx0XHR9ICk7XG5cdFx0ZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1pbnNwZWN0b3ItZm9ybV0gW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWZpZWxkXScgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGZpZWxkICkge1xuXHRcdFx0ZmllbGRzWyBmaWVsZC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1maWVsZCcgKSB8fCAnJyBdID0gZmllbGQudmFsdWU7XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KCBmaWVsZHMgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gdGhlIGN1cnJlbnRseSBzZWxlY3RlZCBSZXNvdXJjZSBjcmVhdGlvbiBtb2RlLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IEluZGVwZW5kZW50IG9yIGNoaWxkcmVuLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X2luc3BlY3Rvcl9jcmVhdGlvbl9tb2RlKCkge1xuXHRcdHZhciBzZWxlY3RlZF9tb2RlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1yYWRpby1maWVsZD1cImNyZWF0aW9uX21vZGVcIl06Y2hlY2tlZCcgKTtcblx0XHR2YXIgaGlkZGVuX21vZGUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWZpZWxkPVwiY3JlYXRpb25fbW9kZVwiXScgKTtcblxuXHRcdHJldHVybiBTdHJpbmcoIHNlbGVjdGVkX21vZGUgPyBzZWxlY3RlZF9tb2RlLnZhbHVlIDogaGlkZGVuX21vZGUgPyBoaWRkZW5fbW9kZS52YWx1ZSA6ICdpbmRlcGVuZGVudCcgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTeW5jaHJvbml6ZSBjcmVhdGUtb25seSBjb25kaXRpb25hbCBmaWVsZHMgYW5kIHJhZGlvLWNhcmQgcHJlc2VudGF0aW9uLlxuXHQgKlxuXHQgKiBUaGVzZSBjb250cm9scyBpbXByb3ZlIGNsYXJpdHkgb25seS4gVGhlIGNyZWF0ZSBzZXJ2aWNlIGluZGVwZW5kZW50bHlcblx0ICogYXV0aG9yaXplcyB0aGUgc2VsZWN0ZWQgcGFyZW50IGFuZCBkZXJpdmVzIGFsbCBpbmhlcml0ZWQgdmFsdWVzLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3luY2hyb25pemVfY3JlYXRlX2luc3BlY3Rvcl9jb250cm9scygpIHtcblx0XHRpZiAoICdjcmVhdGUnICE9PSBpbnNwZWN0b3JfbW9kZSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR2YXIgY3JlYXRpb25fbW9kZSA9IGdldF9pbnNwZWN0b3JfY3JlYXRpb25fbW9kZSgpO1xuXHRcdHZhciBwYXJlbnRfd3JhcCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtZmllbGQtd3JhcD1cInBhcmVudF9pZFwiXScgKTtcblxuXHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtcmFkaW8tZmllbGQ9XCJjcmVhdGlvbl9tb2RlXCJdJyApLmZvckVhY2goIGZ1bmN0aW9uICggcmFkaW8gKSB7XG5cdFx0XHR2YXIgY2hvaWNlID0gcmFkaW8uY2xvc2VzdCggJ2xhYmVsJyApO1xuXHRcdFx0aWYgKCBjaG9pY2UgKSB7XG5cdFx0XHRcdGNob2ljZS5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtc2VsZWN0ZWQnLCByYWRpby5jaGVja2VkICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHRcdGlmICggcGFyZW50X3dyYXAgKSB7XG5cdFx0XHRwYXJlbnRfd3JhcC5oaWRkZW4gPSAnY2hpbGRyZW4nICE9PSBjcmVhdGlvbl9tb2RlO1xuXHRcdFx0cGFyZW50X3dyYXAuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWNvbmRpdGlvbmFsbHktaGlkZGVuJywgJ2NoaWxkcmVuJyAhPT0gY3JlYXRpb25fbW9kZSApO1xuXHRcdH1cblx0XHRbICdiYXNlX2Nvc3QnLCAnZGVmYXVsdF9mb3JtJywgJ293bmVyX3VzZXJfaWQnIF0uZm9yRWFjaCggZnVuY3Rpb24gKCBmaWVsZF9rZXkgKSB7XG5cdFx0XHR2YXIgZmllbGRfd3JhcCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtZmllbGQtd3JhcD1cIicgKyBmaWVsZF9rZXkgKyAnXCJdJyApO1xuXHRcdFx0aWYgKCBmaWVsZF93cmFwICkge1xuXHRcdFx0XHRmaWVsZF93cmFwLmhpZGRlbiA9ICdjaGlsZHJlbicgPT09IGNyZWF0aW9uX21vZGU7XG5cdFx0XHRcdGZpZWxkX3dyYXAuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWNvbmRpdGlvbmFsbHktaGlkZGVuJywgJ2NoaWxkcmVuJyA9PT0gY3JlYXRpb25fbW9kZSApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTeW5jaHJvbml6ZSBkaXJ0eSBzdGF0ZSBhbmQgdGhlIHN0aWNreSBwcmltYXJ5IGFjdGlvbi5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHN5bmNocm9uaXplX2luc3BlY3Rvcl9kaXJ0eV9zdGF0ZSgpIHtcblx0XHR2YXIgc2F2ZV9idXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1zYXZlXScgKTtcblx0XHR2YXIgZm9ybSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtaW5zcGVjdG9yLWZvcm1dJyApO1xuXHRcdHZhciBzYXZlX2lzX2J1c3kgPSAhISBzYXZlX2J1dHRvbiAmJiBzYXZlX2J1dHRvbi5jbGFzc0xpc3QuY29udGFpbnMoICdpcy1idXN5JyApO1xuXG5cdFx0aW5zcGVjdG9yX2RpcnR5ID0gISEgZm9ybSAmJiBzZXJpYWxpemVfaW5zcGVjdG9yX2ZpZWxkcygpICE9PSBpbnNwZWN0b3Jfb3JpZ2luYWxfZmllbGRzO1xuXHRcdGlmICggc2F2ZV9idXR0b24gKSB7XG5cdFx0XHR2YXIgdGl0bGVfZmllbGQgPSBmb3JtID8gZm9ybS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWZpZWxkPVwidGl0bGVcIl0nICkgOiBudWxsO1xuXHRcdFx0dmFyIHBhcmVudF9maWVsZCA9IGZvcm0gPyBmb3JtLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtZmllbGQ9XCJwYXJlbnRfaWRcIl0nICkgOiBudWxsO1xuXHRcdFx0dmFyIGNyZWF0ZV9pc192YWxpZCA9ICdjcmVhdGUnICE9PSBpbnNwZWN0b3JfbW9kZVxuXHRcdFx0XHR8fCAoIGZvcm1cblx0XHRcdFx0XHQmJiAndHJ1ZScgPT09IGZvcm0uZ2V0QXR0cmlidXRlKCAnZGF0YS1jYW4tY3JlYXRlJyApXG5cdFx0XHRcdFx0JiYgdGl0bGVfZmllbGRcblx0XHRcdFx0XHQmJiAnJyAhPT0gU3RyaW5nKCB0aXRsZV9maWVsZC52YWx1ZSB8fCAnJyApLnRyaW0oKVxuXHRcdFx0XHRcdCYmICggJ2NoaWxkcmVuJyAhPT0gZ2V0X2luc3BlY3Rvcl9jcmVhdGlvbl9tb2RlKCkgfHwgKCBwYXJlbnRfZmllbGQgJiYgTnVtYmVyKCBwYXJlbnRfZmllbGQudmFsdWUgKSA+IDAgKSApICk7XG5cblx0XHRcdHNhdmVfYnV0dG9uLmRpc2FibGVkID0gc2F2ZV9pc19idXN5IHx8ICEgZm9ybSB8fCAhIGluc3BlY3Rvcl9kaXJ0eSB8fCAhIGNyZWF0ZV9pc192YWxpZDtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQ29uZmlybSB3aGV0aGVyIHRoZSBhY3RpdmUgaW5zcGVjdG9yIG1heSBiZSByZXBsYWNlZCBvciBjbG9zZWQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgQ2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gbmF2aWdhdGlvbiBtYXkgY29udGludWUuXG5cdCAqL1xuXHRmdW5jdGlvbiBjYW5fZGlzY2FyZF9pbnNwZWN0b3IoIGNvbmZpZyApIHtcblx0XHRpZiAoIGluc3BlY3Rvcl9tdXRhdGlvbl9pbl9wcm9ncmVzcyApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gISBpbnNwZWN0b3JfZGlydHkgfHwgd2luZG93LmNvbmZpcm0oIGNvbmZpZy5pMThuLmluc3BlY3Rvcl9kaXNjYXJkIHx8ICcnICk7XG5cdH1cblxuXHQvKipcblx0ICogQ2xvc2UgdGhlIGluc3BlY3RvciB3aXRob3V0IGNoYW5naW5nIGNhdGFsb2cgY2hlY2tib3ggc2VsZWN0aW9uLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gIGNvbmZpZyAgICAgICAgIENhdGFsb2cgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtib29sZWFufSBjb25maXJtX2Rpc2NhcmQgV2hldGhlciBkaXJ0eSBzdGF0ZSBuZWVkcyBjb25maXJtYXRpb24uXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBjbG9zZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiBjbG9zZV9pbnNwZWN0b3IoIGNvbmZpZywgY29uZmlybV9kaXNjYXJkICkge1xuXHRcdGlmICggY29uZmlybV9kaXNjYXJkICYmICEgY2FuX2Rpc2NhcmRfaW5zcGVjdG9yKCBjb25maWcgKSApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpbnNwZWN0b3JfcmVxdWVzdF9zZXF1ZW5jZSArPSAxO1xuXHRcdGluc3BlY3Rvcl9kaXJ0eSA9IGZhbHNlO1xuXHRcdGluc3BlY3Rvcl9tb2RlID0gJyc7XG5cdFx0aW5zcGVjdG9yX29yaWdpbmFsX2ZpZWxkcyA9ICcnO1xuXHRcdGluc3BlY3Rvcl9yZXNvdXJjZV9pZCA9IDA7XG5cdFx0aW5zcGVjdG9yX3Jlc291cmNlX2lkcyA9IFtdO1xuXHRcdGluc3BlY3Rvcl9idWxrX29wZXJhdGlvbnMgPSB7fTtcblx0XHRpbnNwZWN0b3JfcmV2aWV3X3Rva2VuID0gJyc7XG5cdFx0aW5zcGVjdG9yX3NlbGVjdGlvbl9zdGFsZSA9IGZhbHNlO1xuXHRcdGluc3BlY3Rvcl90cmFja3Nfc2VsZWN0aW9uID0gZmFsc2U7XG5cdFx0aW5zcGVjdG9yX2NhcGFjaXR5X2NvbnRleHQgPSBudWxsO1xuXHRcdGluc3BlY3Rvcl9jYXBhY2l0eV9kZXRhY2hfaWRzID0gW107XG5cdFx0aW5zcGVjdG9yX2NhcGFjaXR5X2RlY3JlYXNlX2FjdGlvbiA9ICdkZXRhY2gnO1xuXHRcdGluc3BlY3Rvcl9jYXBhY2l0eV90YXJnZXQgPSAwO1xuXHRcdHN5bmNocm9uaXplX2luc3BlY3Rvcl93aWR0aCgpO1xuXHRcdHNldF9pbnNwZWN0b3Jfc3RhdGUoICdlbXB0eScsICcnICk7XG5cdFx0bWFya19pbnNwZWN0b3JfcmVzb3VyY2Vfcm93KCAwICk7XG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX2RvX2hpZGUgKSB7XG5cdFx0XHR3aW5kb3cud3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fZG9faGlkZSgpO1xuXHRcdH1cblx0XHRkb2N1bWVudC5kaXNwYXRjaEV2ZW50KCBuZXcgQ3VzdG9tRXZlbnQoICd3cGJjX3NldHVwX3dpemFyZF9sYXlvdXRfY2hhbmdlZCcgKSApO1xuXHRcdGlmICggaW5zcGVjdG9yX2ZvY3VzX3RhcmdldCAmJiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY29udGFpbnMoIGluc3BlY3Rvcl9mb2N1c190YXJnZXQgKSAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgaW5zcGVjdG9yX2ZvY3VzX3RhcmdldC5mb2N1cyApIHtcblx0XHRcdGluc3BlY3Rvcl9mb2N1c190YXJnZXQuZm9jdXMoKTtcblx0XHR9XG5cdFx0aW5zcGVjdG9yX2ZvY3VzX3RhcmdldCA9IG51bGw7XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBQb3N0IG9uZSBhdXRoZW50aWNhdGVkIGluc3BlY3RvciByZXF1ZXN0LlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnIENhdGFsb2cgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtzdHJpbmd9IGFjdGlvbiBBSkFYIGFjdGlvbi5cblx0ICogQHBhcmFtIHtPYmplY3R9IHZhbHVlcyBSZXF1ZXN0IHZhbHVlcy5cblx0ICogQHJldHVybiB7UHJvbWlzZTxPYmplY3Q+fSBQYXJzZWQgV29yZFByZXNzIHJlc3BvbnNlLlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVxdWVzdF9pbnNwZWN0b3IoIGNvbmZpZywgYWN0aW9uLCB2YWx1ZXMgKSB7XG5cdFx0dmFyIGJvZHkgPSBuZXcgd2luZG93LlVSTFNlYXJjaFBhcmFtcygpO1xuXG5cdFx0Ym9keS5hcHBlbmQoICdhY3Rpb24nLCBhY3Rpb24gKTtcblx0XHRib2R5LmFwcGVuZCggJ25vbmNlJywgY29uZmlnLm5vbmNlIHx8ICcnICk7XG5cdFx0T2JqZWN0LmtleXMoIHZhbHVlcyB8fCB7fSApLmZvckVhY2goIGZ1bmN0aW9uICgga2V5ICkge1xuXHRcdFx0Ym9keS5hcHBlbmQoIGtleSwgU3RyaW5nKCB2YWx1ZXNbIGtleSBdICkgKTtcblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gd2luZG93LmZldGNoKCBjb25maWcuYWpheF91cmwsIHtcblx0XHRcdGJvZHk6IGJvZHkudG9TdHJpbmcoKSxcblx0XHRcdGNyZWRlbnRpYWxzOiAnc2FtZS1vcmlnaW4nLFxuXHRcdFx0aGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZDsgY2hhcnNldD1VVEYtOCcgfSxcblx0XHRcdG1ldGhvZDogJ1BPU1QnXG5cdFx0fSApLnRoZW4oIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRyZXR1cm4gcmVzcG9uc2UuanNvbigpO1xuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gdGhlIGV4cGxpY2l0IHNlbGVjdGlvbiBvd25lZCBieSB0aGUgc2hhcmVkIGNhdGFsb2cgY29udHJvbGxlci5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEByZXR1cm4ge0FycmF5PG51bWJlcj59IFNlbGVjdGVkIHBvc2l0aXZlIFJlc291cmNlIElEcy5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9zZWxlY3RlZF9yZXNvdXJjZV9pZHMoIGNvbmZpZyApIHtcblx0XHR2YXIgbW91bnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggY29uZmlnLm1vdW50X2lkICk7XG5cdFx0dmFyIHNlbGVjdGlvbiA9IG1vdW50ICYmIG1vdW50Ll93cGJjX3VpX2NhdGFsb2dfc2VsZWN0aW9uX2NvbnRyb2xsZXI7XG5cdFx0dmFyIHNlbGVjdGVkX2lkcyA9IHNlbGVjdGlvbiAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygc2VsZWN0aW9uLmdldF9zZWxlY3RlZF9pZHMgPyBzZWxlY3Rpb24uZ2V0X3NlbGVjdGVkX2lkcygpIDogW107XG5cblx0XHRyZXR1cm4gc2VsZWN0ZWRfaWRzLm1hcCggTnVtYmVyICkuZmlsdGVyKCBmdW5jdGlvbiAoIHJlc291cmNlX2lkICkge1xuXHRcdFx0cmV0dXJuIHJlc291cmNlX2lkID4gMDtcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogQ29tcGFyZSB0d28gUmVzb3VyY2UtSUQgc2VsZWN0aW9ucyB3aXRob3V0IHJlbHlpbmcgb24gZXZlbnQgb3JkZXJpbmcuXG5cdCAqXG5cdCAqIEBwYXJhbSB7QXJyYXk8bnVtYmVyfHN0cmluZz59IGZpcnN0X2lkcyAgRmlyc3QgSUQgbGlzdC5cblx0ICogQHBhcmFtIHtBcnJheTxudW1iZXJ8c3RyaW5nPn0gc2Vjb25kX2lkcyBTZWNvbmQgSUQgbGlzdC5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGJvdGggbGlzdHMgY29udGFpbiB0aGUgc2FtZSBSZXNvdXJjZSBJRHMuXG5cdCAqL1xuXHRmdW5jdGlvbiByZXNvdXJjZV9pZF9saXN0c19tYXRjaCggZmlyc3RfaWRzLCBzZWNvbmRfaWRzICkge1xuXHRcdHZhciBub3JtYWxpemVfaWRzID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZHMgKSB7XG5cdFx0XHRyZXR1cm4gKCByZXNvdXJjZV9pZHMgfHwgW10gKS5tYXAoIE51bWJlciApLmZpbHRlciggZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0cmV0dXJuIHJlc291cmNlX2lkID4gMDtcblx0XHRcdH0gKS5zb3J0KCBmdW5jdGlvbiAoIGZpcnN0X2lkLCBzZWNvbmRfaWQgKSB7XG5cdFx0XHRcdHJldHVybiBmaXJzdF9pZCAtIHNlY29uZF9pZDtcblx0XHRcdH0gKTtcblx0XHR9O1xuXG5cdFx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KCBub3JtYWxpemVfaWRzKCBmaXJzdF9pZHMgKSApID09PSBKU09OLnN0cmluZ2lmeSggbm9ybWFsaXplX2lkcyggc2Vjb25kX2lkcyApICk7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIGEgbG9jYWxpemVkIHNlbGVjdGlvbi1jb3VudCBsYWJlbC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBjb3VudCAgTnVtYmVyIG9mIHNlbGVjdGVkIFJlc291cmNlcy5cblx0ICogQHJldHVybiB7c3RyaW5nfSBDb3VudCBhbmQgbG9jYWxpemVkIG5vdW4uXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfc2VsZWN0aW9uX2NvdW50X2xhYmVsKCBjb25maWcsIGNvdW50ICkge1xuXHRcdHJldHVybiBTdHJpbmcoIGNvdW50ICkgKyAnICcgKyAoIDEgPT09IE51bWJlciggY291bnQgKSA/IGNvbmZpZy5pMThuLnJlc291cmNlX3NlbGVjdGVkIHx8ICcnIDogY29uZmlnLmkxOG4ucmVzb3VyY2VzX3NlbGVjdGVkIHx8ICcnICk7XG5cdH1cblxuXHQvKipcblx0ICogQ29uZmlndXJlIHRoZSBuYXRpdmUgc3RpY2t5IGZvb3RlciBmb3IgdGhlIGFjdGl2ZSBpbnNwZWN0b3Igd29ya2Zsb3cuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBmb3JtX2lkICAgICAgRm9ybSByZWNlaXZpbmcgdGhlIHN1Ym1pdCBhY3Rpb24uXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBidXR0b25fbGFiZWwgTG9jYWxpemVkIHByaW1hcnkgbGFiZWwuXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gZGVzdHJ1Y3RpdmUgV2hldGhlciB0aGUgYWN0aW9uIHBlcm1hbmVudGx5IGRlbGV0ZXMgZGF0YS5cblx0ICogQHBhcmFtIHtib29sZWFufSBkaXNhYmxlZCAgICBXaGV0aGVyIHN1Ym1pc3Npb24gc3RhcnRzIGRpc2FibGVkLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gY29uZmlndXJlX2luc3BlY3Rvcl9mb290ZXIoIGZvcm1faWQsIGJ1dHRvbl9sYWJlbCwgZGVzdHJ1Y3RpdmUsIGRpc2FibGVkICkge1xuXHRcdHZhciBmb290ZXIgPSBnZXRfaW5zcGVjdG9yX2Zvb3RlcigpO1xuXHRcdHZhciBzYXZlX2J1dHRvbiA9IGZvb3RlciA/IGZvb3Rlci5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1zYXZlXScgKSA6IG51bGw7XG5cdFx0dmFyIGNhbmNlbF9idXR0b24gPSBmb290ZXIgPyBmb290ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbnNwZWN0b3ItY2FuY2VsXScgKSA6IG51bGw7XG5cdFx0dmFyIGRlbGV0ZV93b3JrZmxvdztcblxuXHRcdGlmICggc2F2ZV9idXR0b24gKSB7XG5cdFx0XHRzYXZlX2J1dHRvbi5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtYnVzeScsICdidXR0b24tbGluay1kZWxldGUnLCAnd3BiY19jYXRhbG9nX2Jvb2tpbmdfcmVzb3VyY2VzX19kZWxldGVfc3VibWl0JywgJ3dwYmNfdWlfbGlzdGluZ19faW5zcGVjdG9yX2FjdGlvbi0tZGVzdHJ1Y3RpdmUnLCAnd3BiY19ib29raW5nX3Jlc291cmNlc19fZGVsZXRlX2NvbmZpcm1fYnV0dG9uJywgJ3dwYmNfdWlfY2F0YWxvZ19kZWxldGVfcmV2aWV3X19hcHBseScgKTtcblx0XHRcdHNhdmVfYnV0dG9uLmNsYXNzTGlzdC50b2dnbGUoICdidXR0b24tcHJpbWFyeScsICEgZGVzdHJ1Y3RpdmUgKTtcblx0XHRcdHNhdmVfYnV0dG9uLmNsYXNzTGlzdC50b2dnbGUoICdidXR0b24tc2Vjb25kYXJ5JywgISEgZGVzdHJ1Y3RpdmUgKTtcblx0XHRcdHNhdmVfYnV0dG9uLmNsYXNzTGlzdC50b2dnbGUoICd3cGJjX3VpX2xpc3RpbmdfX2luc3BlY3Rvcl9hY3Rpb24tLWRlc3RydWN0aXZlJywgISEgZGVzdHJ1Y3RpdmUgKTtcblx0XHRcdHNhdmVfYnV0dG9uLmNsYXNzTGlzdC50b2dnbGUoICd3cGJjX2Jvb2tpbmdfcmVzb3VyY2VzX19kZWxldGVfY29uZmlybV9idXR0b24nLCAhISBkZXN0cnVjdGl2ZSApO1xuXHRcdFx0c2F2ZV9idXR0b24udGV4dENvbnRlbnQgPSBidXR0b25fbGFiZWwgfHwgJyc7XG5cdFx0XHRzYXZlX2J1dHRvbi5zZXRBdHRyaWJ1dGUoICdmb3JtJywgZm9ybV9pZCApO1xuXHRcdFx0c2F2ZV9idXR0b24uZGlzYWJsZWQgPSAhISBkaXNhYmxlZDtcblx0XHR9XG5cdFx0aWYgKCBjYW5jZWxfYnV0dG9uICkge1xuXHRcdFx0Y2FuY2VsX2J1dHRvbi50ZXh0Q29udGVudCA9IHdpbmRvdy53cGJjX2NhdGFsb2dfYm9va2luZ19yZXNvdXJjZXNfY29uZmlnICYmIHdpbmRvdy53cGJjX2NhdGFsb2dfYm9va2luZ19yZXNvdXJjZXNfY29uZmlnLmkxOG5cblx0XHRcdFx0PyB3aW5kb3cud3BiY19jYXRhbG9nX2Jvb2tpbmdfcmVzb3VyY2VzX2NvbmZpZy5pMThuLmNhbmNlbCB8fCBjYW5jZWxfYnV0dG9uLnRleHRDb250ZW50XG5cdFx0XHRcdDogY2FuY2VsX2J1dHRvbi50ZXh0Q29udGVudDtcblx0XHRcdGNhbmNlbF9idXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKCBkZXN0cnVjdGl2ZSAmJiAnd3BiY19jYXRhbG9nX2Jvb2tpbmdfcmVzb3VyY2VzX2RlbGV0ZV9mb3JtJyA9PT0gZm9ybV9pZCApIHtcblx0XHRcdGRlbGV0ZV93b3JrZmxvdyA9IGdldF9kZWxldGVfcmV2aWV3X3dvcmtmbG93KCk7XG5cdFx0XHRpZiAoIGRlbGV0ZV93b3JrZmxvdyApIHtcblx0XHRcdFx0ZGVsZXRlX3dvcmtmbG93LmNvbmZpZ3VyZV9mb290ZXIoIHtcblx0XHRcdFx0XHRjYW5fYXBwbHk6IHRydWUsXG5cdFx0XHRcdFx0Zm9vdGVyOiBmb290ZXIsXG5cdFx0XHRcdFx0Zm9ybV9pZDogZm9ybV9pZCxcblx0XHRcdFx0XHRsYWJlbDogYnV0dG9uX2xhYmVsXG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogRW1waGFzaXplIHRoZSBwZXJtYW5lbnQtZGVsZXRpb24gYWNrbm93bGVkZ2VtZW50LlxuXHQgKlxuXHQgKiBSZXN0YXJ0aW5nIHRoZSBmaW5pdGUgYW5pbWF0aW9uIG1pcnJvcnMgdGhlIGVzdGFibGlzaGVkIEJvb2tpbmcgUmVzb3VyY2Vcblx0ICogZWRpdG9yIGJlaGF2aW9yIHdoZW4gYSBkZWxldGlvbiByZXZpZXcgb3BlbnMgb3IgYWNrbm93bGVkZ2VtZW50IGlzIGNsZWFyZWQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8bnVsbH0gYWNrbm93bGVkZ2VtZW50IERlbGV0aW9uIGFja25vd2xlZGdlbWVudCBsYWJlbC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHB1bHNlX2RlbGV0ZV9hY2tub3dsZWRnZW1lbnQoIGFja25vd2xlZGdlbWVudCApIHtcblx0XHR2YXIgZGVsZXRlX3dvcmtmbG93ID0gZ2V0X2RlbGV0ZV9yZXZpZXdfd29ya2Zsb3coKTtcblxuXHRcdGlmICggYWNrbm93bGVkZ2VtZW50ICYmIGFja25vd2xlZGdlbWVudC5tYXRjaGVzKCAnLndwYmNfdWlfY2F0YWxvZ19kZWxldGVfcmV2aWV3X19hY2tub3dsZWRnZW1lbnQnICkgJiYgZGVsZXRlX3dvcmtmbG93ICkge1xuXHRcdFx0ZGVsZXRlX3dvcmtmbG93LnB1bHNlX2Fja25vd2xlZGdlbWVudCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoICEgYWNrbm93bGVkZ2VtZW50ICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGFja25vd2xlZGdlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCAnd3BiY19ib29raW5nX3Jlc291cmNlc19fZGVsZXRlX2Fja25vd2xlZGdlbWVudC0tYXR0ZW50aW9uJyApO1xuXHRcdHZvaWQgYWNrbm93bGVkZ2VtZW50Lm9mZnNldFdpZHRoO1xuXHRcdGFja25vd2xlZGdlbWVudC5jbGFzc0xpc3QuYWRkKCAnd3BiY19ib29raW5nX3Jlc291cmNlc19fZGVsZXRlX2Fja25vd2xlZGdlbWVudC0tYXR0ZW50aW9uJyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiBhIHNhZmUgbWVzc2FnZSBmcm9tIGEgV29yZFByZXNzIGluc3BlY3RvciByZXNwb25zZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IHJlc3BvbnNlIFJlc3BvbnNlIHBheWxvYWQuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBmYWxsYmFjayBGYWxsYmFjayBtZXNzYWdlLlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IFBsYWluIG1lc3NhZ2UuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfaW5zcGVjdG9yX3Jlc3BvbnNlX21lc3NhZ2UoIHJlc3BvbnNlLCBmYWxsYmFjayApIHtcblx0XHRyZXR1cm4gcmVzcG9uc2UgJiYgcmVzcG9uc2UuZGF0YSAmJiByZXNwb25zZS5kYXRhLm1lc3NhZ2UgPyBTdHJpbmcoIHJlc3BvbnNlLmRhdGEubWVzc2FnZSApIDogU3RyaW5nKCBmYWxsYmFjayB8fCAnJyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFNob3cgYSBzdWNjZXNzIG9yIGVycm9yIG5vdGljZSBpbiB0aGUgYWN0aXZlIGluc3BlY3Rvci5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRm9ybUVsZW1lbnR9IGZvcm0gICAgIEluc3BlY3RvciBmb3JtLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgbWVzc2FnZSAgU2FmZSBzZXJ2ZXIgb3IgbG9jYWxpemVkIG1lc3NhZ2UuXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gICAgICAgICBpc19lcnJvciBXaGV0aGVyIHRoZSBub3RpY2UgcmVwcmVzZW50cyBhbiBlcnJvci5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHNob3dfaW5zcGVjdG9yX21lc3NhZ2UoIGZvcm0sIG1lc3NhZ2UsIGlzX2Vycm9yICkge1xuXHRcdHZhciBub3RpY2UgPSBmb3JtID8gZm9ybS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWluc3BlY3Rvci1tZXNzYWdlXScgKSA6IG51bGw7XG5cblx0XHRpZiAoICEgbm90aWNlICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRub3RpY2UuY2xhc3NMaXN0LnRvZ2dsZSggJ25vdGljZS1lcnJvcicsICEhIGlzX2Vycm9yICk7XG5cdFx0bm90aWNlLmNsYXNzTGlzdC50b2dnbGUoICdub3RpY2Utc3VjY2VzcycsICEgaXNfZXJyb3IgKTtcblx0XHRub3RpY2UuaGlkZGVuID0gISBtZXNzYWdlO1xuXHRcdHZhciBub3RpY2VfdGV4dCA9IG5vdGljZS5xdWVyeVNlbGVjdG9yKCAncCcgKTtcblx0XHRpZiAoIG5vdGljZV90ZXh0ICkge1xuXHRcdFx0bm90aWNlX3RleHQudGV4dENvbnRlbnQgPSBtZXNzYWdlIHx8ICcnO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBNb3ZlIGtleWJvYXJkIGZvY3VzIHRvIHRoZSBoZWFkaW5nIG9mIGEgbmV3bHkgcmVuZGVyZWQgcmV2aWV3ZWQgaW5zcGVjdG9yLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxGb3JtRWxlbWVudHxudWxsfSBmb3JtIFJlbmRlcmVkIGluc3BlY3RvciBmb3JtLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gZm9jdXNfaW5zcGVjdG9yX2hlYWRpbmcoIGZvcm0gKSB7XG5cdFx0dmFyIGhlYWRpbmcgPSBmb3JtID8gZm9ybS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWluc3BlY3Rvci1oZWFkaW5nXScgKSA6IG51bGw7XG5cblx0XHRpZiAoICEgaGVhZGluZyApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0d2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdGlmICggZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNvbnRhaW5zKCBoZWFkaW5nICkgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGhlYWRpbmcuZm9jdXMgKSB7XG5cdFx0XHRcdGhlYWRpbmcuZm9jdXMoKTtcblx0XHRcdH1cblx0XHR9LCAwICk7XG5cdH1cblxuXHQvKipcblx0ICogU2hvdyBhIHN0YW5kYXJkIEJvb2tpbmcgQ2FsZW5kYXIgYWRtaW5pc3RyYXRpb24gbm90aWNlLlxuXHQgKlxuXHQgKiBTdWNjZXNzZnVsIG11dGF0aW9ucyB1c2UgdGhlIHNoYXJlZCB0b3AtcmlnaHQgbm90aWNlIGFyZWEgdXNlZCBieSB0aGVcblx0ICogQm9va2luZyBDYWxlbmRhciBzZXR0aW5ncyBwYWdlcy4gVGhlIGJvb2xlYW4gcmV0dXJuIGxldHMgY2FsbGVycyByZXRhaW5cblx0ICogYW4gaW5saW5lIGZhbGxiYWNrIHdoZW4gdGhhdCBzaGFyZWQgaGVscGVyIGlzIHVuYXZhaWxhYmxlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSAgICAgIFNhZmUgc2VydmVyIG9yIGxvY2FsaXplZCBtZXNzYWdlLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZV90eXBlIE5vdGljZSB0eXBlIGFjY2VwdGVkIGJ5IHRoZSBzaGFyZWQgaGVscGVyLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gZGVsYXkgICAgICAgIE5vdGljZSB2aXNpYmlsaXR5IGR1cmF0aW9uIGluIG1pbGxpc2Vjb25kcy5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBtZXNzYWdlIHdhcyBkaXNwbGF5ZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiBzaG93X2FkbWluX21lc3NhZ2UoIG1lc3NhZ2UsIG1lc3NhZ2VfdHlwZSwgZGVsYXkgKSB7XG5cdFx0dmFyIGNvbmZpZztcblx0XHR2YXIgbW91bnRfZWxlbWVudDtcblx0XHR2YXIgbm90aWNlO1xuXHRcdHZhciBub3RpY2VfdGV4dDtcblxuXHRcdGlmICggISBtZXNzYWdlICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19hZG1pbl9zaG93X21lc3NhZ2UgKSB7XG5cdFx0XHR3aW5kb3cud3BiY19hZG1pbl9zaG93X21lc3NhZ2UoIG1lc3NhZ2UsIG1lc3NhZ2VfdHlwZSB8fCAnaW5mbycsIGRlbGF5IHx8IDQwMDAsIGZhbHNlICk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRjb25maWcgPSB3aW5kb3cud3BiY19jYXRhbG9nX2Jvb2tpbmdfcmVzb3VyY2VzX2NvbmZpZyB8fCB7fTtcblx0XHRtb3VudF9lbGVtZW50ID0gY29uZmlnLm1vdW50X2lkID8gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIGNvbmZpZy5tb3VudF9pZCApIDogbnVsbDtcblx0XHRtb3VudF9lbGVtZW50ID0gbW91bnRfZWxlbWVudCAmJiBtb3VudF9lbGVtZW50LnBhcmVudE5vZGUgPyBtb3VudF9lbGVtZW50LnBhcmVudE5vZGUgOiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYm9keS1jb250ZW50JyApIHx8IGRvY3VtZW50LmJvZHk7XG5cdFx0aWYgKCAhIG1vdW50X2VsZW1lbnQgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0bm90aWNlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0XHRub3RpY2UuY2xhc3NOYW1lID0gJ25vdGljZSBub3RpY2UtJyArICggJ2Vycm9yJyA9PT0gbWVzc2FnZV90eXBlID8gJ2Vycm9yJyA6ICdzdWNjZXNzJyApICsgJyB3cGJjX2NhdGFsb2dfYm9va2luZ19yZXNvdXJjZXNfX211dGF0aW9uX25vdGljZSc7XG5cdFx0bm90aWNlLnNldEF0dHJpYnV0ZSggJ3JvbGUnLCAnZXJyb3InID09PSBtZXNzYWdlX3R5cGUgPyAnYWxlcnQnIDogJ3N0YXR1cycgKTtcblx0XHRub3RpY2Uuc2V0QXR0cmlidXRlKCAnYXJpYS1saXZlJywgJ2Vycm9yJyA9PT0gbWVzc2FnZV90eXBlID8gJ2Fzc2VydGl2ZScgOiAncG9saXRlJyApO1xuXHRcdG5vdGljZV90ZXh0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ3AnICk7XG5cdFx0bm90aWNlX3RleHQudGV4dENvbnRlbnQgPSBtZXNzYWdlO1xuXHRcdG5vdGljZS5hcHBlbmRDaGlsZCggbm90aWNlX3RleHQgKTtcblx0XHRtb3VudF9lbGVtZW50Lmluc2VydEJlZm9yZSggbm90aWNlLCBtb3VudF9lbGVtZW50LmZpcnN0Q2hpbGQgKTtcblx0XHR3aW5kb3cuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xuXHRcdFx0aWYgKCBub3RpY2UucGFyZW50Tm9kZSApIHtcblx0XHRcdFx0bm90aWNlLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoIG5vdGljZSApO1xuXHRcdFx0fVxuXHRcdH0sIGRlbGF5IHx8IDQwMDAgKTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0LyoqXG5cdCAqIE9wZW4gYW5kIGZvY3VzIG9uZSBzZXJ2ZXItZGVmaW5lZCBlZGl0LWluc3BlY3RvciBzZWN0aW9uLlxuXHQgKlxuXHQgKiBUaGUgc2hhcmVkIGNvbGxhcHNpYmxlIGNvbnRyb2xsZXIga2VlcHMgZXhjbHVzaXZlIGdyb3VwIHN0YXRlIGFuZCBBUklBXG5cdCAqIGF0dHJpYnV0ZXMgc3luY2hyb25pemVkLiBUaGUgaGVhZGVyIGNsaWNrIGlzIHJldGFpbmVkIGFzIGEgY29tcGF0aWJpbGl0eVxuXHQgKiBmYWxsYmFjayBmb3Igb2xkZXIgYWRtaW5pc3RyYXRpb24gYnVuZGxlcy5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IHNlY3Rpb25faWQgSW5zcGVjdG9yIHNlY3Rpb24gaWRlbnRpZmllci5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSByZXF1ZXN0ZWQgc2VjdGlvbiBleGlzdHMuXG5cdCAqL1xuXHRmdW5jdGlvbiBhY3RpdmF0ZV9pbnNwZWN0b3Jfc2VjdGlvbiggc2VjdGlvbl9pZCApIHtcblx0XHR2YXIgZm9ybTtcblx0XHR2YXIgZ3JvdXA7XG5cdFx0dmFyIHJvb3Q7XG5cdFx0dmFyIGNvbnRyb2xsZXI7XG5cdFx0dmFyIGhlYWRlcjtcblxuXHRcdHNlY3Rpb25faWQgPSBTdHJpbmcoIHNlY3Rpb25faWQgfHwgJycgKTtcblx0XHRpZiAoICEgL15bYS16MC05X10rJC8udGVzdCggc2VjdGlvbl9pZCApICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGZvcm0gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWluc3BlY3Rvci1mb3JtXVtkYXRhLW1vZGU9XCJlZGl0XCJdJyApO1xuXHRcdGdyb3VwID0gZm9ybSA/IGZvcm0ucXVlcnlTZWxlY3RvciggJ1tkYXRhLWdyb3VwPVwiY2F0YWxvZy1ib29raW5nLXJlc291cmNlLScgKyBzZWN0aW9uX2lkICsgJ1wiXScgKSA6IG51bGw7XG5cdFx0aGVhZGVyID0gZ3JvdXAgPyBncm91cC5xdWVyeVNlbGVjdG9yKCAnLmdyb3VwX19oZWFkZXInICkgOiBudWxsO1xuXHRcdGlmICggISBncm91cCB8fCAhIGhlYWRlciApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyb290ID0gZ3JvdXAuY2xvc2VzdCggJy53cGJjX2NvbGxhcHNpYmxlJyApO1xuXHRcdGNvbnRyb2xsZXIgPSByb290ICYmIHJvb3QuX193cGJjX2NvbGxhcHNpYmxlX2luc3RhbmNlID8gcm9vdC5fX3dwYmNfY29sbGFwc2libGVfaW5zdGFuY2UgOiBudWxsO1xuXHRcdGlmICggY29udHJvbGxlciAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgY29udHJvbGxlci5leHBhbmQgKSB7XG5cdFx0XHRjb250cm9sbGVyLmV4cGFuZCggZ3JvdXAgKTtcblx0XHR9IGVsc2UgaWYgKCAhIGdyb3VwLmNsYXNzTGlzdC5jb250YWlucyggJ2lzLW9wZW4nICkgKSB7XG5cdFx0XHRoZWFkZXIuY2xpY2soKTtcblx0XHR9XG5cblx0XHR3aW5kb3cuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xuXHRcdFx0Z3JvdXAuc2Nyb2xsSW50b1ZpZXcoIHsgYmVoYXZpb3I6ICdzbW9vdGgnLCBibG9jazogJ3N0YXJ0JyB9ICk7XG5cdFx0XHRoZWFkZXIuZm9jdXMoKTtcblx0XHR9LCAxMjAgKTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlbmRlciBvbmUgc2VydmVyLWF1dGhvcml0YXRpdmUgY3JlYXRlIG9yIGVkaXQgc2NoZW1hLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnIENhdGFsb2cgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtPYmplY3R9IHNjaGVtYSBJbnNwZWN0b3Igc2NoZW1hLlxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IGZvY3VzX3RpdGxlIFdoZXRoZXIgdGhlIHRpdGxlIGNvbnRyb2wgcmVjZWl2ZXMgZm9jdXMuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiByZW5kZXJlZC5cblx0ICovXG5cdGZ1bmN0aW9uIHJlbmRlcl9pbnNwZWN0b3Jfc2NoZW1hKCBjb25maWcsIHNjaGVtYSwgZm9jdXNfdGl0bGUgKSB7XG5cdFx0dmFyIGhvc3QgPSBnZXRfaW5zcGVjdG9yX2hvc3QoKTtcblx0XHR2YXIgZm9ybV90YXJnZXQgPSBob3N0ID8gaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1mb3JtXScgKSA6IG51bGw7XG5cdFx0dmFyIGZvb3RlciA9IGdldF9pbnNwZWN0b3JfZm9vdGVyKCk7XG5cdFx0dmFyIHNhdmVfYnV0dG9uID0gZm9vdGVyID8gZm9vdGVyLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5zcGVjdG9yLXNhdmVdJyApIDogbnVsbDtcblx0XHR2YXIgdGVtcGxhdGVfcm9sZSA9ICdjcmVhdGUnID09PSBzY2hlbWEubW9kZSA/ICdpbnNwZWN0b3JfY3JlYXRlJyA6ICdpbnNwZWN0b3JfZWRpdCc7XG5cblx0XHRpZiAoICEgZm9ybV90YXJnZXQgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGZvcm1fdGFyZ2V0LmlubmVySFRNTCA9IHJlbmRlcl9jb21wb25lbnQoIGNvbmZpZywgdGVtcGxhdGVfcm9sZSwgeyBpMThuOiBjb25maWcuaTE4biB8fCB7fSwgc2NoZW1hOiBzY2hlbWEgfSApO1xuXHRcdHZhciBmb3JtID0gZm9ybV90YXJnZXQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1pbnNwZWN0b3ItZm9ybV0nICk7XG5cdFx0aWYgKCAhIGZvcm0gKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmICggJ2NyZWF0ZScgPT09IHNjaGVtYS5tb2RlICkge1xuXHRcdFx0Zm9ybS5zZXRBdHRyaWJ1dGUoICdkYXRhLWNhbi1jcmVhdGUnLCBzY2hlbWEuY2FuX2NyZWF0ZSA/ICd0cnVlJyA6ICdmYWxzZScgKTtcblx0XHR9XG5cdFx0aW5zcGVjdG9yX21vZGUgPSBzY2hlbWEubW9kZTtcblx0XHRpbnNwZWN0b3JfcmVzb3VyY2VfaWQgPSBOdW1iZXIoIHNjaGVtYS5yZXNvdXJjZV9pZCApIHx8IDA7XG5cdFx0aWYgKCBpbnNwZWN0b3JfcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHR2YXIgc2hvcnRjb2RlX2ZpZWxkID0gZm9ybS5xdWVyeVNlbGVjdG9yKCAnLndwYmNfY2F0YWxvZ19ib29raW5nX3Jlc291cmNlc19fZWRpdG9yX2NvZGUnICk7XG5cdFx0XHRpZiAoIHNob3J0Y29kZV9maWVsZCApIHtcblx0XHRcdFx0c3luY2hyb25pemVfYm9va2luZ19yZXNvdXJjZV9zaG9ydGNvZGVfaW5wdXQoIGluc3BlY3Rvcl9yZXNvdXJjZV9pZCwgc2hvcnRjb2RlX2ZpZWxkLnZhbHVlICk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHNldF9pbnNwZWN0b3Jfc3RhdGUoICdmb3JtJywgJycgKTtcblx0XHRpZiAoIHNhdmVfYnV0dG9uICkge1xuXHRcdFx0Y29uZmlndXJlX2luc3BlY3Rvcl9mb290ZXIoICd3cGJjX2NhdGFsb2dfYm9va2luZ19yZXNvdXJjZV9pbnNwZWN0b3JfZm9ybScsICdjcmVhdGUnID09PSBpbnNwZWN0b3JfbW9kZSA/IGNvbmZpZy5pMThuLmFkZF9yZXNvdXJjZSB8fCAnJyA6IGNvbmZpZy5pMThuLnNhdmVfY2hhbmdlcyB8fCAnJywgZmFsc2UsIHRydWUgKTtcblx0XHR9XG5cdFx0dmFyIGNhbmNlbF9idXR0b24gPSBmb290ZXIgPyBmb290ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbnNwZWN0b3ItY2FuY2VsXScgKSA6IG51bGw7XG5cdFx0aWYgKCBjYW5jZWxfYnV0dG9uICkge1xuXHRcdFx0Y2FuY2VsX2J1dHRvbi5kaXNhYmxlZCA9IGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cuV1BCQ19Db2xsYXBzaWJsZV9BdXRvSW5pdCApIHtcblx0XHRcdHdpbmRvdy5XUEJDX0NvbGxhcHNpYmxlX0F1dG9Jbml0KCk7XG5cdFx0fVxuXHRcdHN5bmNocm9uaXplX2FsbF9pbnNwZWN0b3JfbnVtZXJpY19yYW5nZXMoKTtcblx0XHRzeW5jaHJvbml6ZV9jcmVhdGVfaW5zcGVjdG9yX2NvbnRyb2xzKCk7XG5cdFx0aW5zcGVjdG9yX29yaWdpbmFsX2ZpZWxkcyA9IHNlcmlhbGl6ZV9pbnNwZWN0b3JfZmllbGRzKCk7XG5cdFx0aW5zcGVjdG9yX2RpcnR5ID0gZmFsc2U7XG5cdFx0c3luY2hyb25pemVfaW5zcGVjdG9yX2RpcnR5X3N0YXRlKCk7XG5cdFx0bWFya19pbnNwZWN0b3JfcmVzb3VyY2Vfcm93KCBpbnNwZWN0b3JfcmVzb3VyY2VfaWQgKTtcblx0XHRpZiAoIGZhbHNlICE9PSBmb2N1c190aXRsZSApIHtcblx0XHRcdHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHZhciB0aXRsZV9maWVsZCA9IGZvcm0ucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1maWVsZD1cInRpdGxlXCJdJyApO1xuXHRcdFx0XHRpZiAoIHRpdGxlX2ZpZWxkICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB0aXRsZV9maWVsZC5mb2N1cyApIHtcblx0XHRcdFx0XHR0aXRsZV9maWVsZC5mb2N1cygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCAxMjAgKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBMb2FkIGFuZCBvcGVuIG9uZSBjcmVhdGUgb3IgZWRpdCBpbnNwZWN0b3IuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGNvbmZpZyAgICAgICBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSAgICAgIG1vZGUgICAgICAgICBDcmVhdGUgb3IgZWRpdC5cblx0ICogQHBhcmFtIHtudW1iZXJ9ICAgICAgcmVzb3VyY2VfaWQgIFJlc291cmNlIElEIGZvciBlZGl0LlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBmb2N1c190YXJnZXQgSW5pdGlhdGluZyBjb250cm9sLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICBzZWN0aW9uX2lkICAgT3B0aW9uYWwgZWRpdCBzZWN0aW9uIHRvIG9wZW4gYW5kIGZvY3VzLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gb3Blbl9pbnNwZWN0b3IoIGNvbmZpZywgbW9kZSwgcmVzb3VyY2VfaWQsIGZvY3VzX3RhcmdldCwgc2VjdGlvbl9pZCApIHtcblx0XHR2YXIgcmVxdWVzdF9zZXF1ZW5jZTtcblx0XHR2YXIgYWN0aW9uO1xuXG5cdFx0cmVzb3VyY2VfaWQgPSBOdW1iZXIoIHJlc291cmNlX2lkICkgfHwgMDtcblx0XHRpZiAoICdlZGl0JyA9PT0gbW9kZSAmJiByZXNvdXJjZV9pZCA9PT0gaW5zcGVjdG9yX3Jlc291cmNlX2lkICYmIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtaW5zcGVjdG9yLWZvcm1dW2RhdGEtbW9kZT1cImVkaXRcIl0nICkgKSB7XG5cdFx0XHRleHBhbmRfaW5zcGVjdG9yX3NpZGViYXIoKTtcblx0XHRcdG1hcmtfaW5zcGVjdG9yX3Jlc291cmNlX3JvdyggcmVzb3VyY2VfaWQgKTtcblx0XHRcdGlmICggc2VjdGlvbl9pZCApIHtcblx0XHRcdFx0YWN0aXZhdGVfaW5zcGVjdG9yX3NlY3Rpb24oIHNlY3Rpb25faWQgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCAhIGNhbl9kaXNjYXJkX2luc3BlY3RvciggY29uZmlnICkgfHwgISBtb3VudF9pbnNwZWN0b3Jfc2hlbGwoIGNvbmZpZyApICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjbG9zZV9kZXRhaWxzX3JvdyggZmFsc2UgKTtcblx0XHRpbnNwZWN0b3JfZm9jdXNfdGFyZ2V0ID0gZm9jdXNfdGFyZ2V0IHx8IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG5cdFx0cmVxdWVzdF9zZXF1ZW5jZSA9ICsraW5zcGVjdG9yX3JlcXVlc3Rfc2VxdWVuY2U7XG5cdFx0aW5zcGVjdG9yX2RpcnR5ID0gZmFsc2U7XG5cdFx0aW5zcGVjdG9yX21vZGUgPSBtb2RlO1xuXHRcdGluc3BlY3Rvcl9yZXNvdXJjZV9pZCA9IHJlc291cmNlX2lkO1xuXHRcdHN5bmNocm9uaXplX2luc3BlY3Rvcl93aWR0aCgpO1xuXHRcdGFjdGlvbiA9ICdjcmVhdGUnID09PSBtb2RlID8gY29uZmlnLmluc3BlY3Rvcl9jcmVhdGVfc2NoZW1hX2FjdGlvbiA6IGNvbmZpZy5pbnNwZWN0b3JfZWRpdF9zY2hlbWFfYWN0aW9uO1xuXHRcdHNldF9pbnNwZWN0b3Jfc3RhdGUoICdsb2FkaW5nJywgJycgKTtcblx0XHRtYXJrX2luc3BlY3Rvcl9yZXNvdXJjZV9yb3coIGluc3BlY3Rvcl9yZXNvdXJjZV9pZCApO1xuXHRcdGV4cGFuZF9pbnNwZWN0b3Jfc2lkZWJhcigpO1xuXG5cdFx0cmVxdWVzdF9pbnNwZWN0b3IoIGNvbmZpZywgYWN0aW9uLCAnZWRpdCcgPT09IG1vZGUgPyB7IHJlc291cmNlX2lkOiBpbnNwZWN0b3JfcmVzb3VyY2VfaWQgfSA6IHt9ICkudGhlbiggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdGlmICggcmVxdWVzdF9zZXF1ZW5jZSAhPT0gaW5zcGVjdG9yX3JlcXVlc3Rfc2VxdWVuY2UgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggISByZXNwb25zZSB8fCB0cnVlICE9PSByZXNwb25zZS5zdWNjZXNzIHx8ICEgcmVzcG9uc2UuZGF0YSB8fCAhIHJlc3BvbnNlLmRhdGEuc2NoZW1hIHx8ICEgcmVuZGVyX2luc3BlY3Rvcl9zY2hlbWEoIGNvbmZpZywgcmVzcG9uc2UuZGF0YS5zY2hlbWEsICEgc2VjdGlvbl9pZCApICkge1xuXHRcdFx0XHRzZXRfaW5zcGVjdG9yX3N0YXRlKCAnZXJyb3InLCBnZXRfaW5zcGVjdG9yX3Jlc3BvbnNlX21lc3NhZ2UoIHJlc3BvbnNlLCBjb25maWcuaTE4bi5pbnNwZWN0b3JfbG9hZF9mYWlsZWQgKSApO1xuXHRcdFx0fSBlbHNlIGlmICggc2VjdGlvbl9pZCApIHtcblx0XHRcdFx0YWN0aXZhdGVfaW5zcGVjdG9yX3NlY3Rpb24oIHNlY3Rpb25faWQgKTtcblx0XHRcdH1cblx0XHR9ICkuY2F0Y2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdGlmICggcmVxdWVzdF9zZXF1ZW5jZSA9PT0gaW5zcGVjdG9yX3JlcXVlc3Rfc2VxdWVuY2UgKSB7XG5cdFx0XHRcdHNldF9pbnNwZWN0b3Jfc3RhdGUoICdlcnJvcicsIGNvbmZpZy5pMThuLmluc3BlY3Rvcl9sb2FkX2ZhaWxlZCB8fCAnJyApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZW5kZXIgdGhlIHNlcnZlci1nZW5lcmF0ZWQgY29tbW9uLWZpZWxkIGJ1bGsgZWRpdG9yLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnIENhdGFsb2cgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtPYmplY3R9IHNjaGVtYSBBdXRob3JpemVkIGJ1bGsgc2NoZW1hLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIGZvcm0gcmVuZGVyZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiByZW5kZXJfYnVsa19lZGl0b3IoIGNvbmZpZywgc2NoZW1hICkge1xuXHRcdHZhciBob3N0ID0gZ2V0X2luc3BlY3Rvcl9ob3N0KCk7XG5cdFx0dmFyIHRhcmdldCA9IGhvc3QgPyBob3N0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5zcGVjdG9yLWZvcm1dJyApIDogbnVsbDtcblxuXHRcdGlmICggISB0YXJnZXQgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHRhcmdldC5pbm5lckhUTUwgPSByZW5kZXJfY29tcG9uZW50KCBjb25maWcsICdpbnNwZWN0b3JfYnVsa19lZGl0JywgeyBpMThuOiBjb25maWcuaTE4biB8fCB7fSwgc2NoZW1hOiBzY2hlbWEsIHNlbGVjdGlvbl9sYWJlbDogZ2V0X3NlbGVjdGlvbl9jb3VudF9sYWJlbCggY29uZmlnLCBzY2hlbWEuc2VsZWN0aW9uX2NvdW50ICkgfSApO1xuXHRcdGlmICggISB0YXJnZXQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1idWxrLWZvcm1dJyApICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpbnNwZWN0b3JfbW9kZSA9ICdidWxrX2VkaXQnO1xuXHRcdGluc3BlY3Rvcl9yZXNvdXJjZV9pZCA9IDA7XG5cdFx0aW5zcGVjdG9yX3Jlc291cmNlX2lkcyA9ICggc2NoZW1hLnJlc291cmNlX2lkcyB8fCBbXSApLm1hcCggTnVtYmVyICk7XG5cdFx0aW5zcGVjdG9yX2J1bGtfb3BlcmF0aW9ucyA9IHt9O1xuXHRcdGluc3BlY3Rvcl9yZXZpZXdfdG9rZW4gPSAnJztcblx0XHRpbnNwZWN0b3Jfc2VsZWN0aW9uX3N0YWxlID0gZmFsc2U7XG5cdFx0aW5zcGVjdG9yX3RyYWNrc19zZWxlY3Rpb24gPSB0cnVlO1xuXHRcdGluc3BlY3Rvcl9kaXJ0eSA9IGZhbHNlO1xuXHRcdHNldF9pbnNwZWN0b3Jfc3RhdGUoICdmb3JtJywgJycgKTtcblx0XHRjb25maWd1cmVfaW5zcGVjdG9yX2Zvb3RlciggJ3dwYmNfY2F0YWxvZ19ib29raW5nX3Jlc291cmNlc19idWxrX2Zvcm0nLCBjb25maWcuaTE4bi5yZXZpZXdfY2hhbmdlc19idXR0b24gfHwgJycsIGZhbHNlLCB0cnVlICk7XG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LldQQkNfQ29sbGFwc2libGVfQXV0b0luaXQgKSB7XG5cdFx0XHR3aW5kb3cuV1BCQ19Db2xsYXBzaWJsZV9BdXRvSW5pdCgpO1xuXHRcdH1cblx0XHRtYXJrX2luc3BlY3Rvcl9yZXNvdXJjZV9yb3coIDAgKTtcblx0XHRmb2N1c19pbnNwZWN0b3JfaGVhZGluZyggdGFyZ2V0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtYnVsay1mb3JtXScgKSApO1xuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHQvKipcblx0ICogT3BlbiBhIGJ1bGsgZWRpdG9yIGZvciB0aGUgY3VycmVudCBleHBsaWNpdCBzZWxlY3Rpb24uXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGNvbmZpZyAgICAgICBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGZvY3VzX3RhcmdldCBJbml0aWF0aW5nIGNvbnRyb2wuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBvcGVuX2J1bGtfZWRpdG9yKCBjb25maWcsIGZvY3VzX3RhcmdldCApIHtcblx0XHR2YXIgcmVzb3VyY2VfaWRzID0gZ2V0X3NlbGVjdGVkX3Jlc291cmNlX2lkcyggY29uZmlnICk7XG5cdFx0dmFyIHJlcXVlc3Rfc2VxdWVuY2U7XG5cblx0XHRpZiAoICEgcmVzb3VyY2VfaWRzLmxlbmd0aCB8fCAhIGNhbl9kaXNjYXJkX2luc3BlY3RvciggY29uZmlnICkgfHwgISBtb3VudF9pbnNwZWN0b3Jfc2hlbGwoIGNvbmZpZyApICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjbG9zZV9kZXRhaWxzX3JvdyggZmFsc2UgKTtcblx0XHRpbnNwZWN0b3JfZm9jdXNfdGFyZ2V0ID0gZm9jdXNfdGFyZ2V0IHx8IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG5cdFx0cmVxdWVzdF9zZXF1ZW5jZSA9ICsraW5zcGVjdG9yX3JlcXVlc3Rfc2VxdWVuY2U7XG5cdFx0aW5zcGVjdG9yX21vZGUgPSAnYnVsa19lZGl0Jztcblx0XHRpbnNwZWN0b3JfcmVzb3VyY2VfaWRzID0gcmVzb3VyY2VfaWRzLnNsaWNlKCk7XG5cdFx0aW5zcGVjdG9yX2RpcnR5ID0gZmFsc2U7XG5cdFx0aW5zcGVjdG9yX3RyYWNrc19zZWxlY3Rpb24gPSB0cnVlO1xuXHRcdHN5bmNocm9uaXplX2luc3BlY3Rvcl93aWR0aCgpO1xuXHRcdHNldF9pbnNwZWN0b3Jfc3RhdGUoICdsb2FkaW5nJywgJycgKTtcblx0XHRleHBhbmRfaW5zcGVjdG9yX3NpZGViYXIoKTtcblxuXHRcdHJlcXVlc3RfaW5zcGVjdG9yKCBjb25maWcsIGNvbmZpZy5idWxrX3NjaGVtYV9hY3Rpb24sIHsgcmVzb3VyY2VfaWRzOiBKU09OLnN0cmluZ2lmeSggcmVzb3VyY2VfaWRzICkgfSApLnRoZW4oIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRpZiAoIHJlcXVlc3Rfc2VxdWVuY2UgIT09IGluc3BlY3Rvcl9yZXF1ZXN0X3NlcXVlbmNlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgcmVzcG9uc2UgfHwgdHJ1ZSAhPT0gcmVzcG9uc2Uuc3VjY2VzcyB8fCAhIHJlc3BvbnNlLmRhdGEgfHwgISByZXNwb25zZS5kYXRhLnNjaGVtYSB8fCAhIHJlbmRlcl9idWxrX2VkaXRvciggY29uZmlnLCByZXNwb25zZS5kYXRhLnNjaGVtYSApICkge1xuXHRcdFx0XHRzZXRfaW5zcGVjdG9yX3N0YXRlKCAnZXJyb3InLCBnZXRfaW5zcGVjdG9yX3Jlc3BvbnNlX21lc3NhZ2UoIHJlc3BvbnNlLCBjb25maWcuaTE4bi5idWxrX2xvYWRfZmFpbGVkICkgKTtcblx0XHRcdH0gZWxzZSBpZiAoICEgcmVzb3VyY2VfaWRfbGlzdHNfbWF0Y2goIGluc3BlY3Rvcl9yZXNvdXJjZV9pZHMsIGdldF9zZWxlY3RlZF9yZXNvdXJjZV9pZHMoIGNvbmZpZyApICkgKSB7XG5cdFx0XHRcdGhhbmRsZV9pbnNwZWN0b3Jfc2VsZWN0aW9uX2NoYW5nZSggbnVsbCwgY29uZmlnICk7XG5cdFx0XHR9XG5cdFx0fSApLmNhdGNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRpZiAoIHJlcXVlc3Rfc2VxdWVuY2UgPT09IGluc3BlY3Rvcl9yZXF1ZXN0X3NlcXVlbmNlICkge1xuXHRcdFx0XHRzZXRfaW5zcGVjdG9yX3N0YXRlKCAnZXJyb3InLCBjb25maWcuaTE4bi5idWxrX2xvYWRfZmFpbGVkIHx8ICcnICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiBvbmx5IGV4cGxpY2l0bHkgZW5hYmxlZCBidWxrIG9wZXJhdGlvbnMuXG5cdCAqXG5cdCAqIEByZXR1cm4ge09iamVjdH0gT3BlcmF0aW9uIGVudmVsb3BlIGtleWVkIGJ5IGZpZWxkLlxuXHQgKi9cblx0ZnVuY3Rpb24gY29sbGVjdF9idWxrX29wZXJhdGlvbnMoKSB7XG5cdFx0dmFyIG9wZXJhdGlvbnMgPSB7fTtcblxuXHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtYnVsay1lbmFibGVdOmNoZWNrZWQnICkuZm9yRWFjaCggZnVuY3Rpb24gKCBlbmFibGVkX2NvbnRyb2wgKSB7XG5cdFx0XHR2YXIgZmllbGRfa2V5ID0gZW5hYmxlZF9jb250cm9sLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWJ1bGstZW5hYmxlJyApIHx8ICcnO1xuXHRcdFx0dmFyIG9wZXJhdGlvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtYnVsay1vcGVyYXRpb249XCInICsgZmllbGRfa2V5ICsgJ1wiXScgKTtcblx0XHRcdHZhciBmaWVsZF92YWx1ZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtYnVsay12YWx1ZT1cIicgKyBmaWVsZF9rZXkgKyAnXCJdJyApO1xuXG5cdFx0XHRpZiAoIGZpZWxkX2tleSAmJiBvcGVyYXRpb24gJiYgZmllbGRfdmFsdWUgKSB7XG5cdFx0XHRcdG9wZXJhdGlvbnNbIGZpZWxkX2tleSBdID0geyBvcGVyYXRpb246IG9wZXJhdGlvbi52YWx1ZSwgdmFsdWU6IGZpZWxkX3ZhbHVlLnZhbHVlIH07XG5cdFx0XHR9XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIG9wZXJhdGlvbnM7XG5cdH1cblxuXHQvKipcblx0ICogU3luY2hyb25pemUgb25lIG9wdGlvbmFsIGJ1bGsgZmllbGQgYW5kIHRoZSByZXZpZXcgYWN0aW9uLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fG51bGx9IGNoYW5nZWRfY29udHJvbCBDb250cm9sIHRoYXQgY2hhbmdlZCwgd2hlbiBhdmFpbGFibGUuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzeW5jaHJvbml6ZV9idWxrX2VkaXRvciggY2hhbmdlZF9jb250cm9sICkge1xuXHRcdHZhciBmaWVsZF93cmFwID0gY2hhbmdlZF9jb250cm9sID8gY2hhbmdlZF9jb250cm9sLmNsb3Nlc3QoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtYnVsay1maWVsZF0nICkgOiBudWxsO1xuXHRcdHZhciBzYXZlX2J1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5zcGVjdG9yLXNhdmVdJyApO1xuXG5cdFx0aWYgKCBmaWVsZF93cmFwICkge1xuXHRcdFx0dmFyIGVuYWJsZWRfY29udHJvbCA9IGZpZWxkX3dyYXAucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1idWxrLWVuYWJsZV0nICk7XG5cdFx0XHR2YXIgb3BlcmF0aW9uX2NvbnRyb2wgPSBmaWVsZF93cmFwLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtYnVsay1vcGVyYXRpb25dJyApO1xuXHRcdFx0dmFyIHByZWZpeF9lbGVtZW50ID0gZmllbGRfd3JhcC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWJ1bGstcHJlZml4XScgKTtcblx0XHRcdHZhciBzdWZmaXhfZWxlbWVudCA9IGZpZWxkX3dyYXAucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1idWxrLXN1ZmZpeF0nICk7XG5cdFx0XHR2YXIgZW5hYmxlZCA9ICEhIGVuYWJsZWRfY29udHJvbCAmJiBlbmFibGVkX2NvbnRyb2wuY2hlY2tlZDtcblx0XHRcdHZhciBvcGVyYXRpb25faWQgPSBvcGVyYXRpb25fY29udHJvbCA/IFN0cmluZyggb3BlcmF0aW9uX2NvbnRyb2wudmFsdWUgfHwgJycgKSA6ICcnO1xuXHRcdFx0dmFyIGlzX3BlcmNlbnQgPSAtMSAhPT0gb3BlcmF0aW9uX2lkLmluZGV4T2YoICdwZXJjZW50JyApO1xuXHRcdFx0ZmllbGRfd3JhcC5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtZW5hYmxlZCcsIGVuYWJsZWQgKTtcblx0XHRcdGZpZWxkX3dyYXAucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1idWxrLW9wZXJhdGlvbl0sIFtkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1idWxrLXZhbHVlXSwgW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWJ1bGstcmFuZ2VdJyApLmZvckVhY2goIGZ1bmN0aW9uICggY29udHJvbCApIHtcblx0XHRcdFx0Y29udHJvbC5kaXNhYmxlZCA9ICEgZW5hYmxlZDtcblx0XHRcdH0gKTtcblx0XHRcdGlmICggcHJlZml4X2VsZW1lbnQgKSB7XG5cdFx0XHRcdHByZWZpeF9lbGVtZW50LnRleHRDb250ZW50ID0gaXNfcGVyY2VudCA/ICcnIDogZmllbGRfd3JhcC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1idWxrLXByZWZpeCcgKSB8fCAnJztcblx0XHRcdH1cblx0XHRcdGlmICggc3VmZml4X2VsZW1lbnQgKSB7XG5cdFx0XHRcdHN1ZmZpeF9lbGVtZW50LnRleHRDb250ZW50ID0gaXNfcGVyY2VudCA/ICclJyA6IGZpZWxkX3dyYXAuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtYnVsay1zdWZmaXgnICkgfHwgJyc7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGNoYW5nZWRfY29udHJvbCAmJiBjaGFuZ2VkX2NvbnRyb2wubWF0Y2hlcyggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1idWxrLXJhbmdlXScgKSApIHtcblx0XHRcdFx0dmFyIG51bWJlcl9jb250cm9sID0gZmllbGRfd3JhcC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWJ1bGstdmFsdWVdJyApO1xuXHRcdFx0XHRpZiAoIG51bWJlcl9jb250cm9sICkge1xuXHRcdFx0XHRcdG51bWJlcl9jb250cm9sLnZhbHVlID0gY2hhbmdlZF9jb250cm9sLnZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR2YXIgcmFuZ2VfY29udHJvbCA9IGZpZWxkX3dyYXAucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1idWxrLXJhbmdlXScgKTtcblx0XHRcdFx0dmFyIGZpZWxkX3ZhbHVlX2NvbnRyb2wgPSBmaWVsZF93cmFwLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtYnVsay12YWx1ZV0nICk7XG5cdFx0XHRcdGlmICggcmFuZ2VfY29udHJvbCAmJiBmaWVsZF92YWx1ZV9jb250cm9sICYmICcnICE9PSBmaWVsZF92YWx1ZV9jb250cm9sLnZhbHVlICkge1xuXHRcdFx0XHRcdHJhbmdlX2NvbnRyb2wudmFsdWUgPSBmaWVsZF92YWx1ZV9jb250cm9sLnZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGluc3BlY3Rvcl9idWxrX29wZXJhdGlvbnMgPSBjb2xsZWN0X2J1bGtfb3BlcmF0aW9ucygpO1xuXHRcdGluc3BlY3Rvcl9kaXJ0eSA9IE9iamVjdC5rZXlzKCBpbnNwZWN0b3JfYnVsa19vcGVyYXRpb25zICkubGVuZ3RoID4gMDtcblx0XHRpZiAoIHNhdmVfYnV0dG9uICkge1xuXHRcdFx0c2F2ZV9idXR0b24uZGlzYWJsZWQgPSBpbnNwZWN0b3Jfc2VsZWN0aW9uX3N0YWxlIHx8ICEgaW5zcGVjdG9yX2RpcnR5O1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBSZW5kZXIgYSBzaWduZWQgYnVsay1lZGl0IHJldmlldyB3aXRob3V0IHBlcmZvcm1pbmcgYSBtdXRhdGlvbi5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyAgQ2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gcHJldmlldyBTZXJ2ZXItYXV0aG9yaXRhdGl2ZSBwcmV2aWV3LlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gcmVuZGVyZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiByZW5kZXJfYnVsa19yZXZpZXcoIGNvbmZpZywgcHJldmlldyApIHtcblx0XHR2YXIgaG9zdCA9IGdldF9pbnNwZWN0b3JfaG9zdCgpO1xuXHRcdHZhciByZXZpZXdfd29ya2Zsb3cgPSBnZXRfaW5saW5lX3Jldmlld193b3JrZmxvdygpO1xuXHRcdHZhciByZXZpZXdfbW9kZWw7XG5cdFx0dmFyIHRhcmdldCA9IGhvc3QgPyBob3N0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5zcGVjdG9yLWZvcm1dJyApIDogbnVsbDtcblxuXHRcdGlmICggISB0YXJnZXQgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldmlld19tb2RlbCA9IHJldmlld193b3JrZmxvdyA/IHJldmlld193b3JrZmxvdy5wcmVwYXJlKCBwcmV2aWV3LnJldmlldyB8fCB7fSwge1xuXHRcdFx0Y2hhbmdlZF9sYWJlbDogZ2V0X3NlbGVjdGlvbl9jb3VudF9sYWJlbCggY29uZmlnLCBwcmV2aWV3LnNjaGVtYS5yZXNvdXJjZV9pZHMubGVuZ3RoICksXG5cdFx0XHRkZXNjcmlwdGlvbjogY29uZmlnLmkxOG4uaW5saW5lX3Jldmlld19kZXNjcmlwdGlvbiB8fCAnJyxcblx0XHRcdGZvcm1faWQ6ICd3cGJjX2NhdGFsb2dfYm9va2luZ19yZXNvdXJjZXNfYnVsa19yZXZpZXdfZm9ybScsXG5cdFx0XHRtb2RlOiAnYnVsa19yZXZpZXcnLFxuXHRcdFx0cGVuZGluZ19tZXNzYWdlOiBjb25maWcuaTE4bi5yZXZpZXdfY2hhbmdlc19oZWxwIHx8ICcnLFxuXHRcdFx0dGl0bGU6IGNvbmZpZy5pMThuLnJldmlld19jaGFuZ2VzIHx8IGNvbmZpZy5pMThuLmVkaXRfYm9va2luZ19yZXNvdXJjZXMgfHwgJydcblx0XHR9ICkgOiB7fTtcblx0XHR0YXJnZXQuaW5uZXJIVE1MID0gcmVuZGVyX2NvbXBvbmVudCggY29uZmlnLCAnaW5zcGVjdG9yX2J1bGtfcmV2aWV3JywgcmV2aWV3X21vZGVsICk7XG5cdFx0aWYgKCAhIHRhcmdldC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWJ1bGstcmV2aWV3LWZvcm1dJyApICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpbnNwZWN0b3JfbW9kZSA9ICdidWxrX3Jldmlldyc7XG5cdFx0aW5zcGVjdG9yX3Jldmlld190b2tlbiA9IFN0cmluZyggcHJldmlldy5yZXZpZXdfdG9rZW4gfHwgJycgKTtcblx0XHRpbnNwZWN0b3JfZGlydHkgPSB0cnVlO1xuXHRcdHNldF9pbnNwZWN0b3Jfc3RhdGUoICdmb3JtJywgJycgKTtcblx0XHRjb25maWd1cmVfaW5zcGVjdG9yX2Zvb3RlciggJ3dwYmNfY2F0YWxvZ19ib29raW5nX3Jlc291cmNlc19idWxrX3Jldmlld19mb3JtJywgY29uZmlnLmkxOG4uYXBwbHlfY2hhbmdlcyB8fCAnJywgZmFsc2UsIGluc3BlY3Rvcl9zZWxlY3Rpb25fc3RhbGUgKTtcblx0XHRpZiAoIHJldmlld193b3JrZmxvdyApIHtcblx0XHRcdHJldmlld193b3JrZmxvdy5zeW5jaHJvbml6ZSggeyBidXN5OiBmYWxzZSwgY2FuX2FwcGx5OiAhIGluc3BlY3Rvcl9zZWxlY3Rpb25fc3RhbGUgJiYgISEgaW5zcGVjdG9yX3Jldmlld190b2tlbiB9ICk7XG5cdFx0fVxuXHRcdGZvY3VzX2luc3BlY3Rvcl9oZWFkaW5nKCB0YXJnZXQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1idWxrLXJldmlldy1mb3JtXScgKSApO1xuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHQvKipcblx0ICogUmVuZGVyIHRoZSBzaWduZWQgZGVsZXRpb24gaW1wYWN0IGFuZCBleHBsaWNpdCBhY2tub3dsZWRnZW1lbnQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgIENhdGFsb2cgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtPYmplY3R9IHByZXZpZXcgU2VydmVyLWF1dGhvcml0YXRpdmUgZGVsZXRpb24gcHJldmlldy5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHJlbmRlcmVkLlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVuZGVyX2RlbGV0ZV9yZXZpZXcoIGNvbmZpZywgcHJldmlldyApIHtcblx0XHR2YXIgaG9zdCA9IGdldF9pbnNwZWN0b3JfaG9zdCgpO1xuXHRcdHZhciB0YXJnZXQgPSBob3N0ID8gaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1mb3JtXScgKSA6IG51bGw7XG5cdFx0dmFyIGFja25vd2xlZGdlbWVudDtcblxuXHRcdGlmICggISB0YXJnZXQgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHZhciBkZWxldGVfaTE4biA9IHByZXZpZXcuaTE4biB8fCB7fTtcblxuXHRcdHRhcmdldC5pbm5lckhUTUwgPSByZW5kZXJfY29tcG9uZW50KCBjb25maWcsICdpbnNwZWN0b3JfZGVsZXRlJywge1xuXHRcdFx0ZGVsZXRlX2kxOG46IHtcblx0XHRcdFx0YWNrbm93bGVkZ2VtZW50OiBkZWxldGVfaTE4bi5hY2tub3dsZWRnZW1lbnQgfHwgY29uZmlnLmkxOG4uZGVsZXRlX2Fja25vd2xlZGdlbWVudCB8fCAnJyxcblx0XHRcdFx0YWN0aW9uc19oZWFkaW5nOiBkZWxldGVfaTE4bi5hY3Rpb25zX2hlYWRpbmcgfHwgJycsXG5cdFx0XHRcdGJvb2tpbmdzX3JldGFpbmVkX3dhcm5pbmc6IGRlbGV0ZV9pMThuLmJvb2tpbmdzX3JldGFpbmVkX3dhcm5pbmcgfHwgY29uZmlnLmkxOG4uYm9va2luZ3NfcmV0YWluZWRfd2FybmluZyB8fCAnJyxcblx0XHRcdFx0cmVzb3VyY2VzX3RvX2RlbGV0ZTogZGVsZXRlX2kxOG4ucmVzb3VyY2VzX3RvX2RlbGV0ZSB8fCBjb25maWcuaTE4bi5yZXNvdXJjZXNfdG9fZGVsZXRlIHx8ICcnLFxuXHRcdFx0XHRyZXZpZXdfaGVscDogZGVsZXRlX2kxOG4ucmV2aWV3X2hlbHAgfHwgY29uZmlnLmkxOG4uZGVsZXRlX3Jldmlld19oZWxwIHx8ICcnLFxuXHRcdFx0XHR0aXRsZTogZGVsZXRlX2kxOG4udGl0bGUgfHwgY29uZmlnLmkxOG4uZGVsZXRlX2Jvb2tpbmdfcmVzb3VyY2VzIHx8ICcnLFxuXHRcdFx0XHR3YXJuaW5nOiBkZWxldGVfaTE4bi53YXJuaW5nIHx8IGNvbmZpZy5pMThuLmRlbGV0ZV93YXJuaW5nIHx8ICcnXG5cdFx0XHR9LFxuXHRcdFx0aTE4bjogY29uZmlnLmkxOG4gfHwge30sXG5cdFx0XHRwcmV2aWV3OiBwcmV2aWV3LFxuXHRcdFx0c2VsZWN0aW9uX2xhYmVsOiBkZWxldGVfaTE4bi5zZWxlY3Rpb25fbGFiZWwgfHwgZ2V0X3NlbGVjdGlvbl9jb3VudF9sYWJlbCggY29uZmlnLCBwcmV2aWV3LnNlbGVjdGlvbl9jb3VudCApXG5cdFx0fSApO1xuXHRcdGlmICggISB0YXJnZXQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1kZWxldGUtZm9ybV0nICkgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGluc3BlY3Rvcl9tb2RlID0gJ2RlbGV0ZV9yZXZpZXcnO1xuXHRcdGluc3BlY3Rvcl9yZXNvdXJjZV9pZHMgPSAoIHByZXZpZXcucmVzb3VyY2VzIHx8IFtdICkubWFwKCBmdW5jdGlvbiAoIHJlc291cmNlICkgeyByZXR1cm4gTnVtYmVyKCByZXNvdXJjZS5pZCApOyB9ICk7XG5cdFx0aW5zcGVjdG9yX3Jlc291cmNlX2lkID0gISBpbnNwZWN0b3JfdHJhY2tzX3NlbGVjdGlvbiAmJiAxID09PSBpbnNwZWN0b3JfcmVzb3VyY2VfaWRzLmxlbmd0aCA/IGluc3BlY3Rvcl9yZXNvdXJjZV9pZHNbMF0gOiAwO1xuXHRcdGluc3BlY3Rvcl9yZXZpZXdfdG9rZW4gPSBTdHJpbmcoIHByZXZpZXcucmV2aWV3X3Rva2VuIHx8ICcnICk7XG5cdFx0aW5zcGVjdG9yX3NlbGVjdGlvbl9zdGFsZSA9IGZhbHNlO1xuXHRcdGluc3BlY3Rvcl9kaXJ0eSA9IGZhbHNlO1xuXHRcdHNldF9pbnNwZWN0b3Jfc3RhdGUoICdmb3JtJywgJycgKTtcblx0XHRjb25maWd1cmVfaW5zcGVjdG9yX2Zvb3Rlcihcblx0XHRcdCd3cGJjX2NhdGFsb2dfYm9va2luZ19yZXNvdXJjZXNfZGVsZXRlX2Zvcm0nLFxuXHRcdFx0ZGVsZXRlX2kxOG4uZGVsZXRlX2J1dHRvbiB8fCBmb3JtYXRfbWVzc2FnZSggMSA9PT0gTnVtYmVyKCBwcmV2aWV3LnNlbGVjdGlvbl9jb3VudCApID8gY29uZmlnLmkxOG4uZGVsZXRlX3Jlc291cmNlIHx8ICcnIDogY29uZmlnLmkxOG4uZGVsZXRlX3Jlc291cmNlcyB8fCAnJywgWyBwcmV2aWV3LnNlbGVjdGlvbl9jb3VudCBdICksXG5cdFx0XHR0cnVlLFxuXHRcdFx0dHJ1ZVxuXHRcdCk7XG5cdFx0YWNrbm93bGVkZ2VtZW50ID0gdGFyZ2V0LnF1ZXJ5U2VsZWN0b3IoICcud3BiY19ib29raW5nX3Jlc291cmNlc19fZGVsZXRlX2Fja25vd2xlZGdlbWVudCcgKTtcblx0XHRwdWxzZV9kZWxldGVfYWNrbm93bGVkZ2VtZW50KCBhY2tub3dsZWRnZW1lbnQgKTtcblx0XHRtYXJrX2luc3BlY3Rvcl9yZXNvdXJjZV9yb3coIGluc3BlY3Rvcl9yZXNvdXJjZV9pZCApO1xuXHRcdGZvY3VzX2luc3BlY3Rvcl9oZWFkaW5nKCB0YXJnZXQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1kZWxldGUtZm9ybV0nICkgKTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0LyoqXG5cdCAqIE9wZW4gdGhlIGluZGVwZW5kZW50IGRlbGV0aW9uIHJldmlldyBmb3IgZXhwbGljaXQgUmVzb3VyY2UgSURzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gICAgICAgIGNvbmZpZyAgICAgICBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7QXJyYXk8bnVtYmVyPn0gcmVzb3VyY2VfaWRzIFJlc291cmNlIElEcyBzZWxlY3RlZCBmb3IgZGVsZXRpb24uXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9ICAgZm9jdXNfdGFyZ2V0IEluaXRpYXRpbmcgY29udHJvbC5cblx0ICogQHBhcmFtIHtib29sZWFufSAgICAgICB0cmFja19zZWxlY3Rpb24gV2hldGhlciBkZWxldGlvbiBvd25zIHRoZSBjaGVja2JveCBzZWxlY3Rpb24uXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBvcGVuX2RlbGV0ZV9yZXZpZXcoIGNvbmZpZywgcmVzb3VyY2VfaWRzLCBmb2N1c190YXJnZXQsIHRyYWNrX3NlbGVjdGlvbiApIHtcblx0XHR2YXIgcmVxdWVzdF9zZXF1ZW5jZTtcblxuXHRcdHJlc291cmNlX2lkcyA9ICggcmVzb3VyY2VfaWRzIHx8IFtdICkubWFwKCBOdW1iZXIgKS5maWx0ZXIoIGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7IHJldHVybiByZXNvdXJjZV9pZCA+IDA7IH0gKTtcblx0XHRpZiAoICEgcmVzb3VyY2VfaWRzLmxlbmd0aCB8fCAhIGNhbl9kaXNjYXJkX2luc3BlY3RvciggY29uZmlnICkgfHwgISBtb3VudF9pbnNwZWN0b3Jfc2hlbGwoIGNvbmZpZyApICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjbG9zZV9kZXRhaWxzX3JvdyggZmFsc2UgKTtcblx0XHRpbnNwZWN0b3JfZm9jdXNfdGFyZ2V0ID0gZm9jdXNfdGFyZ2V0IHx8IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG5cdFx0cmVxdWVzdF9zZXF1ZW5jZSA9ICsraW5zcGVjdG9yX3JlcXVlc3Rfc2VxdWVuY2U7XG5cdFx0aW5zcGVjdG9yX21vZGUgPSAnZGVsZXRlX3Jldmlldyc7XG5cdFx0aW5zcGVjdG9yX3Jlc291cmNlX2lkcyA9IHJlc291cmNlX2lkcy5zbGljZSgpO1xuXHRcdGluc3BlY3Rvcl9yZXNvdXJjZV9pZCA9ICEgdHJhY2tfc2VsZWN0aW9uICYmIDEgPT09IGluc3BlY3Rvcl9yZXNvdXJjZV9pZHMubGVuZ3RoID8gaW5zcGVjdG9yX3Jlc291cmNlX2lkc1swXSA6IDA7XG5cdFx0aW5zcGVjdG9yX2RpcnR5ID0gZmFsc2U7XG5cdFx0aW5zcGVjdG9yX3RyYWNrc19zZWxlY3Rpb24gPSAhISB0cmFja19zZWxlY3Rpb247XG5cdFx0c3luY2hyb25pemVfaW5zcGVjdG9yX3dpZHRoKCk7XG5cdFx0c2V0X2luc3BlY3Rvcl9zdGF0ZSggJ2xvYWRpbmcnLCAnJyApO1xuXHRcdG1hcmtfaW5zcGVjdG9yX3Jlc291cmNlX3JvdyggaW5zcGVjdG9yX3Jlc291cmNlX2lkICk7XG5cdFx0ZXhwYW5kX2luc3BlY3Rvcl9zaWRlYmFyKCk7XG5cblx0XHRyZXF1ZXN0X2luc3BlY3RvciggY29uZmlnLCBjb25maWcuZGVsZXRlX3ByZXZpZXdfYWN0aW9uLCB7IHJlc291cmNlX2lkczogSlNPTi5zdHJpbmdpZnkoIHJlc291cmNlX2lkcyApIH0gKS50aGVuKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0aWYgKCByZXF1ZXN0X3NlcXVlbmNlICE9PSBpbnNwZWN0b3JfcmVxdWVzdF9zZXF1ZW5jZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHJlc3BvbnNlIHx8IHRydWUgIT09IHJlc3BvbnNlLnN1Y2Nlc3MgfHwgISByZXNwb25zZS5kYXRhIHx8ICEgcmVzcG9uc2UuZGF0YS5wcmV2aWV3IHx8ICEgcmVuZGVyX2RlbGV0ZV9yZXZpZXcoIGNvbmZpZywgcmVzcG9uc2UuZGF0YS5wcmV2aWV3ICkgKSB7XG5cdFx0XHRcdHNldF9pbnNwZWN0b3Jfc3RhdGUoICdlcnJvcicsIGdldF9pbnNwZWN0b3JfcmVzcG9uc2VfbWVzc2FnZSggcmVzcG9uc2UsIGNvbmZpZy5pMThuLmRlbGV0ZV9sb2FkX2ZhaWxlZCApICk7XG5cdFx0XHR9IGVsc2UgaWYgKCBpbnNwZWN0b3JfdHJhY2tzX3NlbGVjdGlvbiAmJiAhIHJlc291cmNlX2lkX2xpc3RzX21hdGNoKCBpbnNwZWN0b3JfcmVzb3VyY2VfaWRzLCBnZXRfc2VsZWN0ZWRfcmVzb3VyY2VfaWRzKCBjb25maWcgKSApICkge1xuXHRcdFx0XHRoYW5kbGVfaW5zcGVjdG9yX3NlbGVjdGlvbl9jaGFuZ2UoIG51bGwsIGNvbmZpZyApO1xuXHRcdFx0fVxuXHRcdH0gKS5jYXRjaCggZnVuY3Rpb24gKCkge1xuXHRcdFx0aWYgKCByZXF1ZXN0X3NlcXVlbmNlID09PSBpbnNwZWN0b3JfcmVxdWVzdF9zZXF1ZW5jZSApIHtcblx0XHRcdFx0c2V0X2luc3BlY3Rvcl9zdGF0ZSggJ2Vycm9yJywgY29uZmlnLmkxOG4uZGVsZXRlX2xvYWRfZmFpbGVkIHx8ICcnICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiBvbmUgbG9jYWxpemVkIGNhcGFjaXR5IGNvdW50IGxhYmVsLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnICAgICAgIENhdGFsb2cgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtzdHJpbmd9IHNpbmd1bGFyX2tleSBTaW5ndWxhciB0cmFuc2xhdGlvbiBrZXkuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBwbHVyYWxfa2V5ICAgUGx1cmFsIHRyYW5zbGF0aW9uIGtleS5cblx0ICogQHBhcmFtIHtudW1iZXJ9IGNvdW50ICAgICAgICBOb24tbmVnYXRpdmUgY291bnQuXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gTG9jYWxpemVkIGxhYmVsLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X2NhcGFjaXR5X2NvdW50X2xhYmVsKCBjb25maWcsIHNpbmd1bGFyX2tleSwgcGx1cmFsX2tleSwgY291bnQgKSB7XG5cdFx0dmFyIHRlbXBsYXRlID0gMSA9PT0gTnVtYmVyKCBjb3VudCApID8gY29uZmlnLmkxOG5bIHNpbmd1bGFyX2tleSBdIDogY29uZmlnLmkxOG5bIHBsdXJhbF9rZXkgXTtcblxuXHRcdHJldHVybiBmb3JtYXRfbWVzc2FnZSggdGVtcGxhdGUgfHwgJycsIFsgY291bnQgXSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIEJ1aWxkIHByZXNlbnRhdGlvbi1vbmx5IGRhdGEgZm9yIHRoZSBjYXBhY2l0eSBXUCB0ZW1wbGF0ZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyAgQ2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29udGV4dCBTZXJ2ZXItYXV0aG9yaXRhdGl2ZSBjYXBhY2l0eSBjb250ZXh0LlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IFRlbXBsYXRlIHZpZXcgZGF0YS5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9jYXBhY2l0eV9lZGl0b3JfdmlldyggY29uZmlnLCBjb250ZXh0ICkge1xuXHRcdHZhciBjdXJyZW50X2NhcGFjaXR5ID0gTnVtYmVyKCBjb250ZXh0LmN1cnJlbnRfY2FwYWNpdHkgKSB8fCAxO1xuXHRcdHZhciB0YXJnZXRfY2FwYWNpdHkgPSBpbnNwZWN0b3JfY2FwYWNpdHlfdGFyZ2V0IHx8IGN1cnJlbnRfY2FwYWNpdHk7XG5cdFx0dmFyIG9wZXJhdGlvbiA9IHRhcmdldF9jYXBhY2l0eSA+IGN1cnJlbnRfY2FwYWNpdHkgPyAnaW5jcmVhc2UnIDogKCB0YXJnZXRfY2FwYWNpdHkgPCBjdXJyZW50X2NhcGFjaXR5ID8gJ2RlY3JlYXNlJyA6ICd1bmNoYW5nZWQnICk7XG5cdFx0dmFyIGtlZXBfY291bnQgPSAnZGVjcmVhc2UnID09PSBvcGVyYXRpb24gPyB0YXJnZXRfY2FwYWNpdHkgOiBjdXJyZW50X2NhcGFjaXR5O1xuXHRcdHZhciBjcmVhdGVfY291bnQgPSBNYXRoLm1heCggMCwgdGFyZ2V0X2NhcGFjaXR5IC0gY3VycmVudF9jYXBhY2l0eSApO1xuXHRcdHZhciBkZWNyZWFzZV9jb3VudCA9IE1hdGgubWF4KCAwLCBjdXJyZW50X2NhcGFjaXR5IC0gdGFyZ2V0X2NhcGFjaXR5ICk7XG5cdFx0dmFyIGRlbGV0ZV9hY3Rpb24gPSAnZGVjcmVhc2UnID09PSBvcGVyYXRpb24gJiYgJ2RlbGV0ZScgPT09IGluc3BlY3Rvcl9jYXBhY2l0eV9kZWNyZWFzZV9hY3Rpb247XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0Y2hpbGRyZW46ICggY29udGV4dC5jaGlsZHJlbiB8fCBbXSApLm1hcCggZnVuY3Rpb24gKCBjaGlsZCApIHtcblx0XHRcdFx0Y2hpbGQgPSBPYmplY3QuYXNzaWduKCB7fSwgY2hpbGQgKTtcblx0XHRcdFx0Y2hpbGQuc2VsZWN0ZWQgPSAtMSAhPT0gaW5zcGVjdG9yX2NhcGFjaXR5X2RldGFjaF9pZHMuaW5kZXhPZiggTnVtYmVyKCBjaGlsZC5pZCApICk7XG5cdFx0XHRcdHJldHVybiBjaGlsZDtcblx0XHRcdH0gKSxcblx0XHRcdGNvbnRleHRfbGFiZWw6ICggY29uZmlnLmkxOG4ucmVzb3VyY2VfaWQgfHwgJ0lEJyApICsgJzogJyArIFN0cmluZyggY29udGV4dC5yZXNvdXJjZV9pZCApLFxuXHRcdFx0Y3VycmVudF9jYXBhY2l0eTogY3VycmVudF9jYXBhY2l0eSxcblx0XHRcdGRlY3JlYXNlX2FjdGlvbjogaW5zcGVjdG9yX2NhcGFjaXR5X2RlY3JlYXNlX2FjdGlvbixcblx0XHRcdGRlY3JlYXNlX2hlYWRpbmc6IGdldF9jYXBhY2l0eV9jb3VudF9sYWJlbCggY29uZmlnLCBkZWxldGVfYWN0aW9uID8gJ2Nob29zZV9kZWxldGVfdW5pdCcgOiAnY2hvb3NlX2RldGFjaF91bml0JywgZGVsZXRlX2FjdGlvbiA/ICdjaG9vc2VfZGVsZXRlX3VuaXRzJyA6ICdjaG9vc2VfZGV0YWNoX3VuaXRzJywgZGVjcmVhc2VfY291bnQgKSxcblx0XHRcdGRlY3JlYXNlX2hlbHA6IGRlbGV0ZV9hY3Rpb24gPyBjb25maWcuaTE4bi5kZWxldGVfdW5pdHNfaGVscCB8fCAnJyA6IGNvbmZpZy5pMThuLnNlbGVjdF9kZXRhY2hfaGVscCB8fCAnJyxcblx0XHRcdGRlY3JlYXNlX291dGNvbWVfbGFiZWw6IGRlbGV0ZV9hY3Rpb24gPyBjb25maWcuaTE4bi53aWxsX2JlX2RlbGV0ZWQgfHwgJycgOiBjb25maWcuaTE4bi5tYWtlX2luZGVwZW5kZW50IHx8ICcnLFxuXHRcdFx0ZGVzY3JpcHRpb246IGNvbmZpZy5pMThuLmNhcGFjaXR5X2Rlc2NyaXB0aW9uIHx8ICcnLFxuXHRcdFx0Y3JlYXRlX2xhYmVsOiBnZXRfY2FwYWNpdHlfY291bnRfbGFiZWwoIGNvbmZpZywgJ2NyZWF0ZV9uZXdfdW5pdCcsICdjcmVhdGVfbmV3X3VuaXRzJywgY3JlYXRlX2NvdW50ICksXG5cdFx0XHRrZWVwX2xhYmVsOiBnZXRfY2FwYWNpdHlfY291bnRfbGFiZWwoIGNvbmZpZywgJ2tlZXBfZXhpc3RpbmdfdW5pdCcsICdrZWVwX2V4aXN0aW5nX3VuaXRzJywga2VlcF9jb3VudCApLFxuXHRcdFx0bWF4aW11bV9jYXBhY2l0eTogTnVtYmVyKCBjb250ZXh0Lm1heGltdW1fY2FwYWNpdHkgKSB8fCBjdXJyZW50X2NhcGFjaXR5LFxuXHRcdFx0bWluaW11bV9jYXBhY2l0eTogTnVtYmVyKCBjb250ZXh0Lm1pbmltdW1fY2FwYWNpdHkgKSB8fCAxLFxuXHRcdFx0bW9kZTogJ2NhcGFjaXR5Jyxcblx0XHRcdG9wZXJhdGlvbjogb3BlcmF0aW9uLFxuXHRcdFx0dGFyZ2V0X2NhcGFjaXR5OiB0YXJnZXRfY2FwYWNpdHksXG5cdFx0XHR0aXRsZTogY29uZmlnLmkxOG4uYWRqdXN0X2NhcGFjaXR5IHx8ICcnXG5cdFx0fTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTeW5jaHJvbml6ZSB0aGUgbGl2ZSBjYXBhY2l0eSBwbGFuIHdpdGhvdXQgcmVwbGFjaW5nIGZvY3VzZWQgY29udHJvbHMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgQ2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3luY2hyb25pemVfY2FwYWNpdHlfZWRpdG9yKCBjb25maWcgKSB7XG5cdFx0dmFyIGZvcm0gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWNhcGFjaXR5LWZvcm1dW2RhdGEtbW9kZT1cImNhcGFjaXR5XCJdJyApO1xuXHRcdHZhciBzYXZlX2J1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5zcGVjdG9yLXNhdmVdJyApO1xuXHRcdHZhciBjb250ZXh0ID0gaW5zcGVjdG9yX2NhcGFjaXR5X2NvbnRleHQgfHwge307XG5cdFx0dmFyIGN1cnJlbnRfY2FwYWNpdHkgPSBOdW1iZXIoIGNvbnRleHQuY3VycmVudF9jYXBhY2l0eSApIHx8IDE7XG5cdFx0dmFyIHRhcmdldF9jYXBhY2l0eSA9IGluc3BlY3Rvcl9jYXBhY2l0eV90YXJnZXQgfHwgY3VycmVudF9jYXBhY2l0eTtcblx0XHR2YXIgb3BlcmF0aW9uID0gdGFyZ2V0X2NhcGFjaXR5ID4gY3VycmVudF9jYXBhY2l0eSA/ICdpbmNyZWFzZScgOiAoIHRhcmdldF9jYXBhY2l0eSA8IGN1cnJlbnRfY2FwYWNpdHkgPyAnZGVjcmVhc2UnIDogJ3VuY2hhbmdlZCcgKTtcblx0XHR2YXIgcmVxdWlyZWRfZGV0YWNoX2NvdW50ID0gTWF0aC5tYXgoIDAsIGN1cnJlbnRfY2FwYWNpdHkgLSB0YXJnZXRfY2FwYWNpdHkgKTtcblx0XHR2YXIgdGFyZ2V0X251bWJlciA9IGZvcm0gPyBmb3JtLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctY2FwYWNpdHktdGFyZ2V0XScgKSA6IG51bGw7XG5cdFx0dmFyIHRhcmdldF9yYW5nZSA9IGZvcm0gPyBmb3JtLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctY2FwYWNpdHktcmFuZ2VdJyApIDogbnVsbDtcblxuXHRcdGlmICggISBmb3JtICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoICdkZWNyZWFzZScgIT09IG9wZXJhdGlvbiApIHtcblx0XHRcdGluc3BlY3Rvcl9jYXBhY2l0eV9kZXRhY2hfaWRzID0gW107XG5cdFx0XHRpbnNwZWN0b3JfY2FwYWNpdHlfZGVjcmVhc2VfYWN0aW9uID0gJ2RldGFjaCc7XG5cdFx0fSBlbHNlIGlmICggaW5zcGVjdG9yX2NhcGFjaXR5X2RldGFjaF9pZHMubGVuZ3RoID4gcmVxdWlyZWRfZGV0YWNoX2NvdW50ICkge1xuXHRcdFx0aW5zcGVjdG9yX2NhcGFjaXR5X2RldGFjaF9pZHMgPSBpbnNwZWN0b3JfY2FwYWNpdHlfZGV0YWNoX2lkcy5zbGljZSggMCwgcmVxdWlyZWRfZGV0YWNoX2NvdW50ICk7XG5cdFx0fVxuXHRcdGlmICggdGFyZ2V0X251bWJlciApIHtcblx0XHRcdHRhcmdldF9udW1iZXIudmFsdWUgPSBTdHJpbmcoIHRhcmdldF9jYXBhY2l0eSApO1xuXHRcdH1cblx0XHRpZiAoIHRhcmdldF9yYW5nZSApIHtcblx0XHRcdHRhcmdldF9yYW5nZS52YWx1ZSA9IFN0cmluZyggdGFyZ2V0X2NhcGFjaXR5ICk7XG5cdFx0fVxuXHRcdHZhciBhZnRlcl92YWx1ZSA9IGZvcm0ucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1jYXBhY2l0eS1hZnRlcl0nICk7XG5cdFx0dmFyIGtlZXBfbGFiZWwgPSBmb3JtLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctY2FwYWNpdHkta2VlcC1sYWJlbF0nICk7XG5cdFx0dmFyIGNyZWF0ZV9sYWJlbCA9IGZvcm0ucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1jYXBhY2l0eS1jcmVhdGUtbGFiZWxdJyApO1xuXHRcdHZhciBpbmNyZWFzZV9yb3cgPSBmb3JtLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctY2FwYWNpdHktaW5jcmVhc2Utcm93XScgKTtcblx0XHR2YXIgZGVjcmVhc2VfcGFuZWwgPSBmb3JtLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctY2FwYWNpdHktZGVjcmVhc2VdJyApO1xuXHRcdHZhciBkZWNyZWFzZV9oZWFkaW5nID0gZm9ybS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLWNhcGFjaXR5LWRlY3JlYXNlLWhlYWRpbmddJyApO1xuXHRcdHZhciBkZWNyZWFzZV9oZWxwID0gZm9ybS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLWNhcGFjaXR5LWRlY3JlYXNlLWhlbHBdJyApO1xuXHRcdHZhciBkZWxldGVfYWN0aW9uID0gJ2RlY3JlYXNlJyA9PT0gb3BlcmF0aW9uICYmICdkZWxldGUnID09PSBpbnNwZWN0b3JfY2FwYWNpdHlfZGVjcmVhc2VfYWN0aW9uO1xuXHRcdGlmICggYWZ0ZXJfdmFsdWUgKSB7XG5cdFx0XHRhZnRlcl92YWx1ZS50ZXh0Q29udGVudCA9IFN0cmluZyggdGFyZ2V0X2NhcGFjaXR5ICk7XG5cdFx0fVxuXHRcdGlmICgga2VlcF9sYWJlbCApIHtcblx0XHRcdGtlZXBfbGFiZWwudGV4dENvbnRlbnQgPSBnZXRfY2FwYWNpdHlfY291bnRfbGFiZWwoIGNvbmZpZywgJ2tlZXBfZXhpc3RpbmdfdW5pdCcsICdrZWVwX2V4aXN0aW5nX3VuaXRzJywgJ2RlY3JlYXNlJyA9PT0gb3BlcmF0aW9uID8gdGFyZ2V0X2NhcGFjaXR5IDogY3VycmVudF9jYXBhY2l0eSApO1xuXHRcdH1cblx0XHRpZiAoIGNyZWF0ZV9sYWJlbCApIHtcblx0XHRcdGNyZWF0ZV9sYWJlbC50ZXh0Q29udGVudCA9IGdldF9jYXBhY2l0eV9jb3VudF9sYWJlbCggY29uZmlnLCAnY3JlYXRlX25ld191bml0JywgJ2NyZWF0ZV9uZXdfdW5pdHMnLCBNYXRoLm1heCggMCwgdGFyZ2V0X2NhcGFjaXR5IC0gY3VycmVudF9jYXBhY2l0eSApICk7XG5cdFx0fVxuXHRcdGlmICggaW5jcmVhc2Vfcm93ICkge1xuXHRcdFx0aW5jcmVhc2Vfcm93LmhpZGRlbiA9ICdpbmNyZWFzZScgIT09IG9wZXJhdGlvbjtcblx0XHR9XG5cdFx0aWYgKCBkZWNyZWFzZV9wYW5lbCApIHtcblx0XHRcdGRlY3JlYXNlX3BhbmVsLmhpZGRlbiA9ICdkZWNyZWFzZScgIT09IG9wZXJhdGlvbjtcblx0XHR9XG5cdFx0aWYgKCBkZWNyZWFzZV9oZWFkaW5nICkge1xuXHRcdFx0ZGVjcmVhc2VfaGVhZGluZy50ZXh0Q29udGVudCA9IGdldF9jYXBhY2l0eV9jb3VudF9sYWJlbCggY29uZmlnLCBkZWxldGVfYWN0aW9uID8gJ2Nob29zZV9kZWxldGVfdW5pdCcgOiAnY2hvb3NlX2RldGFjaF91bml0JywgZGVsZXRlX2FjdGlvbiA/ICdjaG9vc2VfZGVsZXRlX3VuaXRzJyA6ICdjaG9vc2VfZGV0YWNoX3VuaXRzJywgcmVxdWlyZWRfZGV0YWNoX2NvdW50ICk7XG5cdFx0fVxuXHRcdGlmICggZGVjcmVhc2VfaGVscCApIHtcblx0XHRcdGRlY3JlYXNlX2hlbHAudGV4dENvbnRlbnQgPSBkZWxldGVfYWN0aW9uID8gY29uZmlnLmkxOG4uZGVsZXRlX3VuaXRzX2hlbHAgfHwgJycgOiBjb25maWcuaTE4bi5zZWxlY3RfZGV0YWNoX2hlbHAgfHwgJyc7XG5cdFx0fVxuXHRcdGZvcm0ucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtY2F0YWxvZy1jYXBhY2l0eS1kZWNyZWFzZS1hY3Rpb25dJyApLmZvckVhY2goIGZ1bmN0aW9uICggYWN0aW9uX2NvbnRyb2wgKSB7XG5cdFx0XHR2YXIgYWN0aW9uX3NlbGVjdGVkID0gYWN0aW9uX2NvbnRyb2wudmFsdWUgPT09IGluc3BlY3Rvcl9jYXBhY2l0eV9kZWNyZWFzZV9hY3Rpb247XG5cdFx0XHRhY3Rpb25fY29udHJvbC5jaGVja2VkID0gYWN0aW9uX3NlbGVjdGVkO1xuXHRcdFx0aWYgKCBhY3Rpb25fY29udHJvbC5jbG9zZXN0KCAnbGFiZWwnICkgKSB7XG5cdFx0XHRcdGFjdGlvbl9jb250cm9sLmNsb3Nlc3QoICdsYWJlbCcgKS5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtc2VsZWN0ZWQnLCBhY3Rpb25fc2VsZWN0ZWQgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdFx0Zm9ybS5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy1jYXRhbG9nLWNhcGFjaXR5LWRldGFjaF0nICkuZm9yRWFjaCggZnVuY3Rpb24gKCBjaGVja2JveCApIHtcblx0XHRcdHZhciBzZWxlY3RlZCA9IC0xICE9PSBpbnNwZWN0b3JfY2FwYWNpdHlfZGV0YWNoX2lkcy5pbmRleE9mKCBOdW1iZXIoIGNoZWNrYm94LnZhbHVlICkgKTtcblx0XHRcdHZhciB1bml0ID0gY2hlY2tib3guY2xvc2VzdCggJy53cGJjX2Jvb2tpbmdfcmVzb3VyY2VzX19jYXBhY2l0eV91bml0JyApO1xuXHRcdFx0dmFyIG91dGNvbWUgPSB1bml0ID8gdW5pdC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYm9va2luZ19yZXNvdXJjZXNfX2NhcGFjaXR5X3VuaXRfb3V0Y29tZScgKSA6IG51bGw7XG5cdFx0XHRjaGVja2JveC5jaGVja2VkID0gc2VsZWN0ZWQ7XG5cdFx0XHRjaGVja2JveC5kaXNhYmxlZCA9ICEgc2VsZWN0ZWQgJiYgaW5zcGVjdG9yX2NhcGFjaXR5X2RldGFjaF9pZHMubGVuZ3RoID49IHJlcXVpcmVkX2RldGFjaF9jb3VudDtcblx0XHRcdGlmICggdW5pdCApIHtcblx0XHRcdFx0dW5pdC5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtc2VsZWN0ZWQnLCBzZWxlY3RlZCApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBvdXRjb21lICkge1xuXHRcdFx0XHRvdXRjb21lLmhpZGRlbiA9ICEgc2VsZWN0ZWQ7XG5cdFx0XHRcdG91dGNvbWUudGV4dENvbnRlbnQgPSBkZWxldGVfYWN0aW9uID8gY29uZmlnLmkxOG4ud2lsbF9iZV9kZWxldGVkIHx8ICcnIDogY29uZmlnLmkxOG4ubWFrZV9pbmRlcGVuZGVudCB8fCAnJztcblx0XHRcdFx0b3V0Y29tZS5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtZGVzdHJ1Y3RpdmUnLCBkZWxldGVfYWN0aW9uICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHRcdGluc3BlY3Rvcl9kaXJ0eSA9IHRhcmdldF9jYXBhY2l0eSAhPT0gY3VycmVudF9jYXBhY2l0eTtcblx0XHRpZiAoIHNhdmVfYnV0dG9uICkge1xuXHRcdFx0c2F2ZV9idXR0b24uZGlzYWJsZWQgPSAndW5jaGFuZ2VkJyA9PT0gb3BlcmF0aW9uIHx8ICggJ2RlY3JlYXNlJyA9PT0gb3BlcmF0aW9uICYmIGluc3BlY3Rvcl9jYXBhY2l0eV9kZXRhY2hfaWRzLmxlbmd0aCAhPT0gcmVxdWlyZWRfZGV0YWNoX2NvdW50ICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFJlbmRlciBhbiBhdXRob3JpemVkIGNhcGFjaXR5IGVkaXRvciBjb250ZXh0LlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnICBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0IFNlcnZlciBjYXBhY2l0eSBjb250ZXh0LlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIHRlbXBsYXRlIHJlbmRlcmVkLlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVuZGVyX2NhcGFjaXR5X2VkaXRvciggY29uZmlnLCBjb250ZXh0ICkge1xuXHRcdHZhciBob3N0ID0gZ2V0X2luc3BlY3Rvcl9ob3N0KCk7XG5cdFx0dmFyIHRhcmdldCA9IGhvc3QgPyBob3N0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5zcGVjdG9yLWZvcm1dJyApIDogbnVsbDtcblxuXHRcdGlmICggISB0YXJnZXQgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGluc3BlY3Rvcl9jYXBhY2l0eV9jb250ZXh0ID0gY29udGV4dDtcblx0XHRpbnNwZWN0b3JfY2FwYWNpdHlfdGFyZ2V0ID0gTnVtYmVyKCBjb250ZXh0LmN1cnJlbnRfY2FwYWNpdHkgKSB8fCAxO1xuXHRcdGluc3BlY3Rvcl9jYXBhY2l0eV9kZXRhY2hfaWRzID0gW107XG5cdFx0aW5zcGVjdG9yX2NhcGFjaXR5X2RlY3JlYXNlX2FjdGlvbiA9ICdkZXRhY2gnO1xuXHRcdHRhcmdldC5pbm5lckhUTUwgPSByZW5kZXJfY29tcG9uZW50KCBjb25maWcsICdpbnNwZWN0b3JfY2FwYWNpdHknLCB7XG5cdFx0XHRpMThuOiBjb25maWcuaTE4biB8fCB7fSxcblx0XHRcdHZpZXc6IGdldF9jYXBhY2l0eV9lZGl0b3JfdmlldyggY29uZmlnLCBjb250ZXh0IClcblx0XHR9ICk7XG5cdFx0aWYgKCAhIHRhcmdldC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWNhcGFjaXR5LWZvcm1dJyApICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpbnNwZWN0b3JfbW9kZSA9ICdjYXBhY2l0eSc7XG5cdFx0aW5zcGVjdG9yX3Jlc291cmNlX2lkID0gTnVtYmVyKCBjb250ZXh0LnJlc291cmNlX2lkICkgfHwgMDtcblx0XHRpbnNwZWN0b3JfcmV2aWV3X3Rva2VuID0gJyc7XG5cdFx0aW5zcGVjdG9yX2RpcnR5ID0gZmFsc2U7XG5cdFx0c2V0X2luc3BlY3Rvcl9zdGF0ZSggJ2Zvcm0nLCAnJyApO1xuXHRcdGNvbmZpZ3VyZV9pbnNwZWN0b3JfZm9vdGVyKCAnd3BiY19jYXRhbG9nX2Jvb2tpbmdfcmVzb3VyY2VfY2FwYWNpdHlfZm9ybScsIGNvbmZpZy5pMThuLnJldmlld19jYXBhY2l0eV9jaGFuZ2UgfHwgJycsIGZhbHNlLCB0cnVlICk7XG5cdFx0bWFya19pbnNwZWN0b3JfcmVzb3VyY2Vfcm93KCBpbnNwZWN0b3JfcmVzb3VyY2VfaWQgKTtcblx0XHRmb2N1c19pbnNwZWN0b3JfaGVhZGluZyggdGFyZ2V0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtY2FwYWNpdHktZm9ybV0nICkgKTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0LyoqXG5cdCAqIE9wZW4gY2FwYWNpdHkgY29udGV4dCBmcm9tIGVpdGhlciByb3cgYWN0aW9uIGVudHJ5IHBvaW50LlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBjb25maWcgICAgICAgQ2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gICAgICByZXNvdXJjZV9pZCAgUm9vdCBvciBjaGlsZCBSZXNvdXJjZSBJRC5cblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZm9jdXNfdGFyZ2V0IEluaXRpYXRpbmcgY29udHJvbC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIG9wZW5fY2FwYWNpdHlfZWRpdG9yKCBjb25maWcsIHJlc291cmNlX2lkLCBmb2N1c190YXJnZXQgKSB7XG5cdFx0dmFyIHJlcXVlc3Rfc2VxdWVuY2U7XG5cblx0XHRpZiAoICEgcmVzb3VyY2VfaWQgfHwgISBjYW5fZGlzY2FyZF9pbnNwZWN0b3IoIGNvbmZpZyApIHx8ICEgbW91bnRfaW5zcGVjdG9yX3NoZWxsKCBjb25maWcgKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y2xvc2VfZGV0YWlsc19yb3coIGZhbHNlICk7XG5cdFx0aW5zcGVjdG9yX2ZvY3VzX3RhcmdldCA9IGZvY3VzX3RhcmdldCB8fCBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuXHRcdHJlcXVlc3Rfc2VxdWVuY2UgPSArK2luc3BlY3Rvcl9yZXF1ZXN0X3NlcXVlbmNlO1xuXHRcdGluc3BlY3Rvcl9tb2RlID0gJ2NhcGFjaXR5Jztcblx0XHRpbnNwZWN0b3JfcmVzb3VyY2VfaWQgPSByZXNvdXJjZV9pZDtcblx0XHRpbnNwZWN0b3JfZGlydHkgPSBmYWxzZTtcblx0XHRpbnNwZWN0b3JfdHJhY2tzX3NlbGVjdGlvbiA9IGZhbHNlO1xuXHRcdHN5bmNocm9uaXplX2luc3BlY3Rvcl93aWR0aCgpO1xuXHRcdHNldF9pbnNwZWN0b3Jfc3RhdGUoICdsb2FkaW5nJywgJycgKTtcblx0XHRtYXJrX2luc3BlY3Rvcl9yZXNvdXJjZV9yb3coIHJlc291cmNlX2lkICk7XG5cdFx0ZXhwYW5kX2luc3BlY3Rvcl9zaWRlYmFyKCk7XG5cblx0XHRyZXF1ZXN0X2luc3BlY3RvciggY29uZmlnLCBjb25maWcuY2FwYWNpdHlfY29udGV4dF9hY3Rpb24sIHsgcmVzb3VyY2VfaWQ6IHJlc291cmNlX2lkIH0gKS50aGVuKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0aWYgKCByZXF1ZXN0X3NlcXVlbmNlICE9PSBpbnNwZWN0b3JfcmVxdWVzdF9zZXF1ZW5jZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHJlc3BvbnNlIHx8IHRydWUgIT09IHJlc3BvbnNlLnN1Y2Nlc3MgfHwgISByZXNwb25zZS5kYXRhIHx8ICEgcmVzcG9uc2UuZGF0YS5jb250ZXh0IHx8ICEgcmVuZGVyX2NhcGFjaXR5X2VkaXRvciggY29uZmlnLCByZXNwb25zZS5kYXRhLmNvbnRleHQgKSApIHtcblx0XHRcdFx0c2V0X2luc3BlY3Rvcl9zdGF0ZSggJ2Vycm9yJywgZ2V0X2luc3BlY3Rvcl9yZXNwb25zZV9tZXNzYWdlKCByZXNwb25zZSwgY29uZmlnLmkxOG4uY2FwYWNpdHlfbG9hZF9mYWlsZWQgKSApO1xuXHRcdFx0fVxuXHRcdH0gKS5jYXRjaCggZnVuY3Rpb24gKCkge1xuXHRcdFx0aWYgKCByZXF1ZXN0X3NlcXVlbmNlID09PSBpbnNwZWN0b3JfcmVxdWVzdF9zZXF1ZW5jZSApIHtcblx0XHRcdFx0c2V0X2luc3BlY3Rvcl9zdGF0ZSggJ2Vycm9yJywgY29uZmlnLmkxOG4uY2FwYWNpdHlfbG9hZF9mYWlsZWQgfHwgJycgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogUmVuZGVyIGEgc2lnbmVkIGNhcGFjaXR5IHJldmlldyByZXR1cm5lZCBieSB0aGUgZG9tYWluIHNlcnZpY2UuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgIENhdGFsb2cgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtPYmplY3R9IHByZXZpZXcgU2lnbmVkIHByZXZpZXcuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiByZW5kZXJlZC5cblx0ICovXG5cdGZ1bmN0aW9uIHJlbmRlcl9jYXBhY2l0eV9yZXZpZXcoIGNvbmZpZywgcHJldmlldyApIHtcblx0XHR2YXIgaG9zdCA9IGdldF9pbnNwZWN0b3JfaG9zdCgpO1xuXHRcdHZhciB0YXJnZXQgPSBob3N0ID8gaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1mb3JtXScgKSA6IG51bGw7XG5cdFx0dmFyIGluY3JlYXNlID0gJ2luY3JlYXNlJyA9PT0gcHJldmlldy5vcGVyYXRpb247XG5cdFx0dmFyIGRlbGV0ZV9hY3Rpb24gPSAnZGVsZXRlJyA9PT0gcHJldmlldy5kZWNyZWFzZV9hY3Rpb247XG5cdFx0dmFyIHZpZXc7XG5cblx0XHRpZiAoICEgdGFyZ2V0ICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHR2aWV3ID0ge1xuXHRcdFx0Y29udGV4dF9sYWJlbDogKCBjb25maWcuaTE4bi5yZXNvdXJjZV9pZCB8fCAnSUQnICkgKyAnOiAnICsgU3RyaW5nKCBwcmV2aWV3LnJlc291cmNlX2lkICksXG5cdFx0XHRjdXJyZW50X2NhcGFjaXR5OiBOdW1iZXIoIHByZXZpZXcuY3VycmVudF9jYXBhY2l0eSApLFxuXHRcdFx0ZGVjcmVhc2VfYWN0aW9uOiBwcmV2aWV3LmRlY3JlYXNlX2FjdGlvbiB8fCAnZGV0YWNoJyxcblx0XHRcdGRlbGV0ZV9oYXNfYm9va2luZ3M6IHRydWUgPT09IHByZXZpZXcuZGVsZXRlX2hhc19ib29raW5ncyxcblx0XHRcdGRlc2NyaXB0aW9uOiBjb25maWcuaTE4bi5yZXZpZXdfY2FwYWNpdHlfaGVscCB8fCAnJyxcblx0XHRcdG1vZGU6ICdjYXBhY2l0eV9yZXZpZXcnLFxuXHRcdFx0b3BlcmF0aW9uOiBwcmV2aWV3Lm9wZXJhdGlvbixcblx0XHRcdG9wZXJhdGlvbl9oZWxwOiBpbmNyZWFzZSA/IGNvbmZpZy5pMThuLmNyZWF0ZV91bml0c19oZWxwIHx8ICcnIDogKCBkZWxldGVfYWN0aW9uID8gY29uZmlnLmkxOG4uZGVsZXRlX3VuaXRzX2hlbHAgfHwgJycgOiBjb25maWcuaTE4bi5zZWxlY3RfZGV0YWNoX2hlbHAgfHwgJycgKSxcblx0XHRcdG9wZXJhdGlvbl9sYWJlbDogaW5jcmVhc2Vcblx0XHRcdFx0PyBnZXRfY2FwYWNpdHlfY291bnRfbGFiZWwoIGNvbmZpZywgJ2NyZWF0ZV9uZXdfdW5pdCcsICdjcmVhdGVfbmV3X3VuaXRzJywgTnVtYmVyKCBwcmV2aWV3LmNyZWF0ZV9jb3VudCApIClcblx0XHRcdFx0OiBnZXRfY2FwYWNpdHlfY291bnRfbGFiZWwoIGNvbmZpZywgJ2tlZXBfZXhpc3RpbmdfdW5pdCcsICdrZWVwX2V4aXN0aW5nX3VuaXRzJywgTnVtYmVyKCBwcmV2aWV3LnRhcmdldF9jYXBhY2l0eSApICksXG5cdFx0XHRyZXNvdXJjZXM6IGluY3JlYXNlID8gcHJldmlldy5jcmVhdGVfcmVzb3VyY2VzIHx8IFtdIDogcHJldmlldy5kZXRhY2hfcmVzb3VyY2VzIHx8IFtdLFxuXHRcdFx0dGFyZ2V0X2NhcGFjaXR5OiBOdW1iZXIoIHByZXZpZXcudGFyZ2V0X2NhcGFjaXR5ICksXG5cdFx0XHR0aXRsZTogY29uZmlnLmkxOG4ucmV2aWV3X2NhcGFjaXR5X3RpdGxlIHx8ICcnXG5cdFx0fTtcblx0XHR0YXJnZXQuaW5uZXJIVE1MID0gcmVuZGVyX2NvbXBvbmVudCggY29uZmlnLCAnaW5zcGVjdG9yX2NhcGFjaXR5JywgeyBpMThuOiBjb25maWcuaTE4biB8fCB7fSwgdmlldzogdmlldyB9ICk7XG5cdFx0aWYgKCAhIHRhcmdldC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWNhcGFjaXR5LWZvcm1dJyApICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpbnNwZWN0b3JfbW9kZSA9ICdjYXBhY2l0eV9yZXZpZXcnO1xuXHRcdGluc3BlY3Rvcl9yZXNvdXJjZV9pZCA9IE51bWJlciggcHJldmlldy5yZXNvdXJjZV9pZCApIHx8IDA7XG5cdFx0aW5zcGVjdG9yX3Jldmlld190b2tlbiA9IFN0cmluZyggcHJldmlldy5yZXZpZXdfdG9rZW4gfHwgJycgKTtcblx0XHRpbnNwZWN0b3JfY2FwYWNpdHlfZGVjcmVhc2VfYWN0aW9uID0gcHJldmlldy5kZWNyZWFzZV9hY3Rpb24gfHwgJ2RldGFjaCc7XG5cdFx0aW5zcGVjdG9yX2RpcnR5ID0gdHJ1ZTtcblx0XHRzZXRfaW5zcGVjdG9yX3N0YXRlKCAnZm9ybScsICcnICk7XG5cdFx0Y29uZmlndXJlX2luc3BlY3Rvcl9mb290ZXIoICd3cGJjX2NhdGFsb2dfYm9va2luZ19yZXNvdXJjZV9jYXBhY2l0eV9mb3JtJywgY29uZmlnLmkxOG4uYXBwbHlfY2FwYWNpdHlfY2hhbmdlIHx8ICcnLCBkZWxldGVfYWN0aW9uLCBkZWxldGVfYWN0aW9uICk7XG5cdFx0aWYgKCBkZWxldGVfYWN0aW9uICkge1xuXHRcdFx0dmFyIGFja25vd2xlZGdlbWVudCA9IHRhcmdldC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLWNhcGFjaXR5LWRlbGV0ZS1hY2tub3dsZWRnZW1lbnRdJyApO1xuXHRcdFx0cHVsc2VfZGVsZXRlX2Fja25vd2xlZGdlbWVudCggYWNrbm93bGVkZ2VtZW50ID8gYWNrbm93bGVkZ2VtZW50LmNsb3Nlc3QoICcud3BiY19ib29raW5nX3Jlc291cmNlc19fZGVsZXRlX2Fja25vd2xlZGdlbWVudCcgKSA6IG51bGwgKTtcblx0XHR9XG5cdFx0dmFyIGNhbmNlbF9idXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1jYW5jZWxdJyApO1xuXHRcdGlmICggY2FuY2VsX2J1dHRvbiApIHtcblx0XHRcdGNhbmNlbF9idXR0b24udGV4dENvbnRlbnQgPSBjb25maWcuaTE4bi5iYWNrIHx8ICcnO1xuXHRcdH1cblx0XHRmb2N1c19pbnNwZWN0b3JfaGVhZGluZyggdGFyZ2V0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtY2FwYWNpdHktZm9ybV0nICkgKTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0LyoqXG5cdCAqIFN5bmNocm9uaXplIHRoZSBSZXNvdXJjZSBpbWFnZSBwcmV2aWV3IGFmdGVyIE1lZGlhIExpYnJhcnkgY2hhbmdlcy5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZmllbGQgUGljdHVyZSBVUkwgZmllbGQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzeW5jaHJvbml6ZV9pbnNwZWN0b3JfaW1hZ2UoIGZpZWxkICkge1xuXHRcdHZhciBmaWVsZF93cmFwID0gZmllbGQgPyBmaWVsZC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWZpZWxkLXdyYXBdJyApIDogbnVsbDtcblx0XHR2YXIgcHJldmlldyA9IGZpZWxkX3dyYXAgPyBmaWVsZF93cmFwLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtaW1hZ2UtcHJldmlld10nICkgOiBudWxsO1xuXHRcdHZhciBwbGFjZWhvbGRlciA9IGZpZWxkX3dyYXAgPyBmaWVsZF93cmFwLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtaW1hZ2UtcGxhY2Vob2xkZXJdJyApIDogbnVsbDtcblx0XHR2YXIgcmVtb3ZlX2J1dHRvbiA9IGZpZWxkX3dyYXAgPyBmaWVsZF93cmFwLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtcmVtb3ZlLWltYWdlXScgKSA6IG51bGw7XG5cdFx0dmFyIHBpY3R1cmVfdXJsID0gZmllbGQgPyBTdHJpbmcoIGZpZWxkLnZhbHVlIHx8ICcnICkudHJpbSgpIDogJyc7XG5cblx0XHRpZiAoIHByZXZpZXcgKSB7XG5cdFx0XHRwcmV2aWV3LnNyYyA9IHBpY3R1cmVfdXJsO1xuXHRcdFx0cHJldmlldy5oaWRkZW4gPSAhIHBpY3R1cmVfdXJsO1xuXHRcdH1cblx0XHRpZiAoIHBsYWNlaG9sZGVyICkge1xuXHRcdFx0cGxhY2Vob2xkZXIuaGlkZGVuID0gISEgcGljdHVyZV91cmw7XG5cdFx0fVxuXHRcdGlmICggcmVtb3ZlX2J1dHRvbiApIHtcblx0XHRcdHJlbW92ZV9idXR0b24uZGlzYWJsZWQgPSAhIHBpY3R1cmVfdXJsO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBTeW5jaHJvbml6ZSBvbmUgbnVtZXJpYyBzbGlkZXIgd2l0aCBpdHMgcHJlY2lzZSBudW1iZXIgZmllbGQuXG5cdCAqXG5cdCAqIFN1Z2dlc3RlZCBzbGlkZXIgYm91bmRzIHJlbWFpbiBjb252ZW5pZW50IGZvciBvcmRpbmFyeSB2YWx1ZXMuIFByaWNlIGtlZXBzXG5cdCAqIGl0cyBwcm9kdWN0LWRlZmluZWQgMC0xMDAwIHNsaWRlciB3aGlsZSB0aGUgYXV0aG9yaXRhdGl2ZSBudW1iZXIgZmllbGQgY2FuXG5cdCAqIHN0aWxsIHByZXNlcnZlIGEgbGVnYWN5IHByaWNlIGFib3ZlIDEwMDAuIE90aGVyIG51bWVyaWMgY29udHJvbHMgY2FuIGV4cGFuZFxuXHQgKiB0byByZXByZXNlbnQgc3RvcmVkIHZhbHVlcyBvdXRzaWRlIHRoZWlyIHN1Z2dlc3RlZCByYW5nZS5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IGZpZWxkX2tleSBOdW1lcmljIGluc3BlY3RvciBmaWVsZCBrZXkuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzeW5jaHJvbml6ZV9pbnNwZWN0b3JfbnVtZXJpY19yYW5nZSggZmllbGRfa2V5ICkge1xuXHRcdHZhciBudW1iZXJfZmllbGQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWZpZWxkPVwiJyArIGZpZWxkX2tleSArICdcIl1bdHlwZT1cIm51bWJlclwiXScgKTtcblx0XHR2YXIgcmFuZ2UgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLXJhbmdlPVwiJyArIGZpZWxkX2tleSArICdcIl0nICk7XG5cdFx0dmFyIG51bWJlcl92YWx1ZTtcblx0XHR2YXIgZGVmYXVsdF9taW47XG5cdFx0dmFyIGRlZmF1bHRfbWF4O1xuXHRcdHZhciBoYXJkX21pbjtcblx0XHR2YXIgaGFyZF9tYXg7XG5cdFx0dmFyIHJhbmdlX21pbjtcblx0XHR2YXIgcmFuZ2VfbWF4O1xuXG5cdFx0aWYgKCAhIG51bWJlcl9maWVsZCB8fCAhIHJhbmdlICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdG51bWJlcl92YWx1ZSA9IE51bWJlciggbnVtYmVyX2ZpZWxkLnZhbHVlICk7XG5cdFx0aWYgKCAhIGlzRmluaXRlKCBudW1iZXJfdmFsdWUgKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRkZWZhdWx0X21pbiA9IE51bWJlciggcmFuZ2UuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtcmFuZ2UtZGVmYXVsdC1taW4nICkgKTtcblx0XHRkZWZhdWx0X21heCA9IE51bWJlciggcmFuZ2UuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtcmFuZ2UtZGVmYXVsdC1tYXgnICkgKTtcblx0XHRoYXJkX21pbiA9ICcnID09PSBTdHJpbmcoIG51bWJlcl9maWVsZC5nZXRBdHRyaWJ1dGUoICdtaW4nICkgfHwgJycgKSA/IG51bGwgOiBOdW1iZXIoIG51bWJlcl9maWVsZC5nZXRBdHRyaWJ1dGUoICdtaW4nICkgKTtcblx0XHRoYXJkX21heCA9ICcnID09PSBTdHJpbmcoIG51bWJlcl9maWVsZC5nZXRBdHRyaWJ1dGUoICdtYXgnICkgfHwgJycgKSA/IG51bGwgOiBOdW1iZXIoIG51bWJlcl9maWVsZC5nZXRBdHRyaWJ1dGUoICdtYXgnICkgKTtcblx0XHRpZiAoICdiYXNlX2Nvc3QnID09PSBmaWVsZF9rZXkgKSB7XG5cdFx0XHRyYW5nZV9taW4gPSBpc0Zpbml0ZSggZGVmYXVsdF9taW4gKSA/IGRlZmF1bHRfbWluIDogMDtcblx0XHRcdHJhbmdlX21heCA9IGlzRmluaXRlKCBkZWZhdWx0X21heCApID8gZGVmYXVsdF9tYXggOiAxMDAwO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyYW5nZV9taW4gPSBudWxsICE9PSBoYXJkX21pbiAmJiBpc0Zpbml0ZSggaGFyZF9taW4gKVxuXHRcdFx0XHQ/IGhhcmRfbWluXG5cdFx0XHRcdDogTWF0aC5taW4oIGlzRmluaXRlKCBkZWZhdWx0X21pbiApID8gZGVmYXVsdF9taW4gOiBudW1iZXJfdmFsdWUsIG51bWJlcl92YWx1ZSApO1xuXHRcdFx0cmFuZ2VfbWF4ID0gbnVsbCAhPT0gaGFyZF9tYXggJiYgaXNGaW5pdGUoIGhhcmRfbWF4IClcblx0XHRcdFx0PyBoYXJkX21heFxuXHRcdFx0XHQ6IE1hdGgubWF4KCBpc0Zpbml0ZSggZGVmYXVsdF9tYXggKSA/IGRlZmF1bHRfbWF4IDogbnVtYmVyX3ZhbHVlLCBudW1iZXJfdmFsdWUgKTtcblx0XHR9XG5cblx0XHRyYW5nZS5taW4gPSBTdHJpbmcoIHJhbmdlX21pbiApO1xuXHRcdHJhbmdlLm1heCA9IFN0cmluZyggcmFuZ2VfbWF4ICk7XG5cdFx0cmFuZ2UudmFsdWUgPSBTdHJpbmcoIG51bWJlcl92YWx1ZSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFN5bmNocm9uaXplIGV2ZXJ5IHJlbmRlcmVkIGluc3BlY3RvciBudW1lcmljIHNsaWRlci5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHN5bmNocm9uaXplX2FsbF9pbnNwZWN0b3JfbnVtZXJpY19yYW5nZXMoKSB7XG5cdFx0ZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1yYW5nZV0nICkuZm9yRWFjaCggZnVuY3Rpb24gKCByYW5nZSApIHtcblx0XHRcdHN5bmNocm9uaXplX2luc3BlY3Rvcl9udW1lcmljX3JhbmdlKCByYW5nZS5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1yYW5nZScgKSB8fCAnJyApO1xuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb3B5IGEgc2xpZGVyIHZhbHVlIGludG8gaXRzIGF1dGhvcml0YXRpdmUgbnVtYmVyIGZpZWxkLlxuXHQgKlxuXHQgKiBUaGUgbnVtYmVyIGZpZWxkIHJlbWFpbnMgdGhlIG9ubHkgc2VyaWFsaXplZCBjb250cm9sIGFuZCBlbWl0cyBvbmUgbmF0aXZlXG5cdCAqIGlucHV0IGV2ZW50IHNvIHZhbGlkYXRpb24gYW5kIGRpcnR5LXN0YXRlIGJlaGF2aW9yIHN0YXkgY2VudHJhbGl6ZWQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJhbmdlIE51bWVyaWMgcmFuZ2UgY29udHJvbC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHN5bmNocm9uaXplX2luc3BlY3Rvcl9udW1iZXJfZnJvbV9yYW5nZSggcmFuZ2UgKSB7XG5cdFx0dmFyIGZpZWxkX2tleSA9IHJhbmdlID8gcmFuZ2UuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtcmFuZ2UnICkgfHwgJycgOiAnJztcblx0XHR2YXIgbnVtYmVyX2ZpZWxkID0gZmllbGRfa2V5ID8gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1maWVsZD1cIicgKyBmaWVsZF9rZXkgKyAnXCJdW3R5cGU9XCJudW1iZXJcIl0nICkgOiBudWxsO1xuXG5cdFx0aWYgKCAhIG51bWJlcl9maWVsZCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0bnVtYmVyX2ZpZWxkLnZhbHVlID0gcmFuZ2UudmFsdWU7XG5cdFx0bnVtYmVyX2ZpZWxkLmRpc3BhdGNoRXZlbnQoIG5ldyBFdmVudCggJ2lucHV0JywgeyBidWJibGVzOiB0cnVlIH0gKSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbmZpcm0gdGhhdCBhIGZvcm0gc3VibWl0IG9yaWdpbmF0ZWQgZnJvbSB0aGUgaW5zcGVjdG9yIHNhdmUgYWN0aW9uLlxuXHQgKlxuXHQgKiBXb3JkUHJlc3MgTWVkaWEgTGlicmFyeSBjb250cm9scyBtYXkgdGVtcG9yYXJpbHkgY29leGlzdCB3aXRoIHRoZSBzaWRlYmFyXG5cdCAqIGZvcm0uIFJlamVjdGluZyB0aGVpciBzdWJtaXR0ZXJzIHByZXZlbnRzIGFuIGltYWdlIGluc2VydGlvbiBmcm9tIHN0YXJ0aW5nXG5cdCAqIGEgUmVzb3VyY2UgbXV0YXRpb24uIFRoZSBhY3RpdmUgaW5zcGVjdG9yIGZpZWxkIGZhbGxiYWNrIHByZXNlcnZlcyBuYXRpdmVcblx0ICogRW50ZXIta2V5IHN1Ym1pc3Npb24gaW4gYnJvd3NlcnMgd2l0aG91dCBTdWJtaXRFdmVudC5zdWJtaXR0ZXIgc3VwcG9ydC5cblx0ICpcblx0ICogQHBhcmFtIHtTdWJtaXRFdmVudH0gZXZlbnQgRm9ybSBzdWJtaXNzaW9uLlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBmb3JtICBBY3RpdmUgaW5zcGVjdG9yIGZvcm0uXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgb25seSBmb3IgYW4gaW50ZW50aW9uYWwgaW5zcGVjdG9yIHN1Ym1pc3Npb24uXG5cdCAqL1xuXHRmdW5jdGlvbiBpc19leHBlY3RlZF9pbnNwZWN0b3Jfc3VibWl0KCBldmVudCwgZm9ybSApIHtcblx0XHR2YXIgc3VibWl0dGVyID0gZXZlbnQuc3VibWl0dGVyIHx8IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG5cblx0XHRpZiAoIHN1Ym1pdHRlciAmJiBzdWJtaXR0ZXIubWF0Y2hlcyAmJiBzdWJtaXR0ZXIubWF0Y2hlcyggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbnNwZWN0b3Itc2F2ZV0nICkgKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gISBldmVudC5zdWJtaXR0ZXJcblx0XHRcdCYmIHN1Ym1pdHRlclxuXHRcdFx0JiYgZm9ybS5jb250YWlucyggc3VibWl0dGVyIClcblx0XHRcdCYmIHN1Ym1pdHRlci5tYXRjaGVzXG5cdFx0XHQmJiBzdWJtaXR0ZXIubWF0Y2hlcyggJ2lucHV0Om5vdChbdHlwZT1cImJ1dHRvblwiXSk6bm90KFt0eXBlPVwic3VibWl0XCJdKSwgc2VsZWN0JyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlcG9ydCBpbnNwZWN0b3IgdmFsaWRpdHkgd2l0aG91dCByZWplY3RpbmcgYW4gZXhpc3RpbmcgZGVjaW1hbCBwcmljZS5cblx0ICpcblx0ICogUHJpY2UgY29udHJvbHMgaW50ZW50aW9uYWxseSB1c2UgYSBvbmUtdW5pdCBzcGlubmVyIHN0ZXAuIEV4aXN0aW5nIHByaWNlc1xuXHQgKiBtYXkgc3RpbGwgY29udGFpbiBkZWNpbWFscywgc28gdGhlaXIgc3RlcCBjb25zdHJhaW50IGlzIHJlbGF4ZWQgb25seSB3aGlsZVxuXHQgKiBuYXRpdmUgZm9ybSB2YWxpZGl0eSBpcyBldmFsdWF0ZWQuIFNlcnZlci1zaWRlIHByaWNlIHZhbGlkYXRpb24gcmVtYWlucyB0aGVcblx0ICogYXV0aG9yaXRhdGl2ZSBib3VuZGFyeS5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRm9ybUVsZW1lbnR9IGZvcm0gSW5zcGVjdG9yIGZvcm0uXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgZm9ybSBwYXNzZXMgbmF0aXZlIHZhbGlkaXR5IGNoZWNrcy5cblx0ICovXG5cdGZ1bmN0aW9uIHJlcG9ydF9pbnNwZWN0b3JfdmFsaWRpdHkoIGZvcm0gKSB7XG5cdFx0dmFyIHByaWNlX2ZpZWxkcyA9IGZvcm0ucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1maWVsZD1cImJhc2VfY29zdFwiXSwgW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWJ1bGstdmFsdWU9XCJiYXNlX2Nvc3RcIl0nICk7XG5cdFx0dmFyIHByaWNlX3N0ZXBzID0gW107XG5cdFx0dmFyIGlzX3ZhbGlkO1xuXG5cdFx0cHJpY2VfZmllbGRzLmZvckVhY2goIGZ1bmN0aW9uICggcHJpY2VfZmllbGQgKSB7XG5cdFx0XHRwcmljZV9zdGVwcy5wdXNoKCB7XG5cdFx0XHRcdGZpZWxkOiBwcmljZV9maWVsZCxcblx0XHRcdFx0c3RlcDogcHJpY2VfZmllbGQuZ2V0QXR0cmlidXRlKCAnc3RlcCcgKVxuXHRcdFx0fSApO1xuXHRcdFx0cHJpY2VfZmllbGQuc2V0QXR0cmlidXRlKCAnc3RlcCcsICdhbnknICk7XG5cdFx0fSApO1xuXG5cdFx0aXNfdmFsaWQgPSBmb3JtLnJlcG9ydFZhbGlkaXR5KCk7XG5cdFx0cHJpY2Vfc3RlcHMuZm9yRWFjaCggZnVuY3Rpb24gKCBwcmljZV9zdGVwICkge1xuXHRcdFx0aWYgKCBudWxsID09PSBwcmljZV9zdGVwLnN0ZXAgKSB7XG5cdFx0XHRcdHByaWNlX3N0ZXAuZmllbGQucmVtb3ZlQXR0cmlidXRlKCAnc3RlcCcgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHByaWNlX3N0ZXAuZmllbGQuc2V0QXR0cmlidXRlKCAnc3RlcCcsIHByaWNlX3N0ZXAuc3RlcCApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblxuXHRcdHJldHVybiBpc192YWxpZDtcblx0fVxuXG5cdC8qKlxuXHQgKiBTYXZlIHRoZSBhY3RpdmUgaW5zcGVjdG9yIHRocm91Z2ggaXRzIGluZGVwZW5kZW50IG11dGF0aW9uIGVuZHBvaW50LlxuXHQgKlxuXHQgKiBAcGFyYW0ge1N1Ym1pdEV2ZW50fSBldmVudCBGb3JtIHN1Ym1pc3Npb24uXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGNvbmZpZyBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzdWJtaXRfaW5zcGVjdG9yKCBldmVudCwgY29uZmlnICkge1xuXHRcdHZhciBmb3JtID0gZXZlbnQudGFyZ2V0O1xuXHRcdHZhciBzYXZlX2J1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5zcGVjdG9yLXNhdmVdJyApO1xuXHRcdHZhciBjYW5jZWxfYnV0dG9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbnNwZWN0b3ItY2FuY2VsXScgKTtcblx0XHR2YXIgbXV0YXRpb25fcmVxdWVzdF9zZXF1ZW5jZTtcblx0XHR2YXIgZmllbGRzO1xuXHRcdHZhciBhY3Rpb247XG5cdFx0dmFyIHN1Ym1pdHRlZF9tb2RlO1xuXHRcdHZhciByZXF1ZXN0X3ZhbHVlcztcblx0XHR2YXIgY29udHJvbF9kaXNhYmxlZF9zdGF0ZXMgPSBbXTtcblx0XHR2YXIgc3VjY2Vzc19tZXNzYWdlO1xuXHRcdHZhciBzdWNjZXNzX21lc3NhZ2VfaXNfZ2xvYmFsO1xuXHRcdHZhciBzdWJtaXR0ZWRfZm9ybV9pc19hY3RpdmU7XG5cblx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdGlmICggISBpc19leHBlY3RlZF9pbnNwZWN0b3Jfc3VibWl0KCBldmVudCwgZm9ybSApIHx8ICggc2F2ZV9idXR0b24gJiYgc2F2ZV9idXR0b24uY2xhc3NMaXN0LmNvbnRhaW5zKCAnaXMtYnVzeScgKSApIHx8ICEgcmVwb3J0X2luc3BlY3Rvcl92YWxpZGl0eSggZm9ybSApICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRtdXRhdGlvbl9yZXF1ZXN0X3NlcXVlbmNlID0gKytpbnNwZWN0b3JfbXV0YXRpb25fcmVxdWVzdF9zZXF1ZW5jZTtcblx0XHRpbnNwZWN0b3JfbXV0YXRpb25faW5fcHJvZ3Jlc3MgPSB0cnVlO1xuXHRcdGZpZWxkcyA9IEpTT04ucGFyc2UoIHNlcmlhbGl6ZV9pbnNwZWN0b3JfZmllbGRzKCkgfHwgJ3t9JyApO1xuXHRcdGFjdGlvbiA9ICdjcmVhdGUnID09PSBpbnNwZWN0b3JfbW9kZSA/IGNvbmZpZy5pbnNwZWN0b3JfY3JlYXRlX2FjdGlvbiA6IGNvbmZpZy5pbnNwZWN0b3JfdXBkYXRlX2FjdGlvbjtcblx0XHRzdWJtaXR0ZWRfbW9kZSA9IGluc3BlY3Rvcl9tb2RlO1xuXHRcdHJlcXVlc3RfdmFsdWVzID0geyBmaWVsZHM6IEpTT04uc3RyaW5naWZ5KCBmaWVsZHMgKSB9O1xuXHRcdGlmICggJ2VkaXQnID09PSBpbnNwZWN0b3JfbW9kZSApIHtcblx0XHRcdHJlcXVlc3RfdmFsdWVzLnJlc291cmNlX2lkID0gaW5zcGVjdG9yX3Jlc291cmNlX2lkO1xuXHRcdH1cblx0XHRpZiAoIHNhdmVfYnV0dG9uICkge1xuXHRcdFx0c2F2ZV9idXR0b24uZGlzYWJsZWQgPSB0cnVlO1xuXHRcdFx0c2F2ZV9idXR0b24uY2xhc3NMaXN0LmFkZCggJ2lzLWJ1c3knICk7XG5cdFx0fVxuXHRcdGlmICggY2FuY2VsX2J1dHRvbiApIHtcblx0XHRcdGNhbmNlbF9idXR0b24uZGlzYWJsZWQgPSB0cnVlO1xuXHRcdH1cblx0XHRmb3JtLmNsYXNzTGlzdC5hZGQoICdpcy1zYXZpbmcnICk7XG5cdFx0Zm9ybS5zZXRBdHRyaWJ1dGUoICdhcmlhLWJ1c3knLCAndHJ1ZScgKTtcblx0XHRmb3JtLnF1ZXJ5U2VsZWN0b3JBbGwoICdpbnB1dCwgc2VsZWN0LCB0ZXh0YXJlYSwgYnV0dG9uJyApLmZvckVhY2goIGZ1bmN0aW9uICggY29udHJvbCApIHtcblx0XHRcdGNvbnRyb2xfZGlzYWJsZWRfc3RhdGVzLnB1c2goIHsgY29udHJvbDogY29udHJvbCwgZGlzYWJsZWQ6IGNvbnRyb2wuZGlzYWJsZWQgfSApO1xuXHRcdFx0Y29udHJvbC5kaXNhYmxlZCA9IHRydWU7XG5cdFx0fSApO1xuXG5cdFx0cmVxdWVzdF9pbnNwZWN0b3IoIGNvbmZpZywgYWN0aW9uLCByZXF1ZXN0X3ZhbHVlcyApLnRoZW4oIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRpZiAoIG11dGF0aW9uX3JlcXVlc3Rfc2VxdWVuY2UgIT09IGluc3BlY3Rvcl9tdXRhdGlvbl9yZXF1ZXN0X3NlcXVlbmNlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgcmVzcG9uc2UgfHwgdHJ1ZSAhPT0gcmVzcG9uc2Uuc3VjY2VzcyB8fCAhIHJlc3BvbnNlLmRhdGEgKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvciggZ2V0X2luc3BlY3Rvcl9yZXNwb25zZV9tZXNzYWdlKCByZXNwb25zZSwgY29uZmlnLmkxOG4uaW5zcGVjdG9yX3NhdmVfZmFpbGVkICkgKTtcblx0XHRcdH1cblx0XHRcdHBlbmRpbmdfaGlnaGxpZ2h0X2lkcyA9IEFycmF5LmlzQXJyYXkoIHJlc3BvbnNlLmRhdGEucmVzb3VyY2VfaWRzICkgPyByZXNwb25zZS5kYXRhLnJlc291cmNlX2lkcy5tYXAoIFN0cmluZyApIDogW107XG5cdFx0XHRpbnNwZWN0b3JfZGlydHkgPSBmYWxzZTtcblx0XHRcdHN1Y2Nlc3NfbWVzc2FnZSA9IGdldF9pbnNwZWN0b3JfcmVzcG9uc2VfbWVzc2FnZSggcmVzcG9uc2UsICcnICk7XG5cdFx0XHRzdWNjZXNzX21lc3NhZ2VfaXNfZ2xvYmFsID0gc2hvd19hZG1pbl9tZXNzYWdlKCBzdWNjZXNzX21lc3NhZ2UsICdzdWNjZXNzJywgMzAwMCApO1xuXHRcdFx0c3VibWl0dGVkX2Zvcm1faXNfYWN0aXZlID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNvbnRhaW5zKCBmb3JtICk7XG5cdFx0XHRpZiAoICdjcmVhdGUnID09PSBzdWJtaXR0ZWRfbW9kZSApIHtcblx0XHRcdFx0aW5zcGVjdG9yX211dGF0aW9uX2luX3Byb2dyZXNzID0gZmFsc2U7XG5cdFx0XHRcdGlmICggc3VibWl0dGVkX2Zvcm1faXNfYWN0aXZlICkge1xuXHRcdFx0XHRcdGNsb3NlX2luc3BlY3RvciggY29uZmlnLCBmYWxzZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggY2F0YWxvZ19jb250cm9sbGVyICkge1xuXHRcdFx0XHRcdGNhdGFsb2dfY29udHJvbGxlci5sb2FkKCB7IHBhZ2VfbnVtYmVyOiAxIH0gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgc3VibWl0dGVkX2Zvcm1faXNfYWN0aXZlICkge1xuXHRcdFx0XHRpZiAoIGNhdGFsb2dfY29udHJvbGxlciApIHtcblx0XHRcdFx0XHRjYXRhbG9nX2NvbnRyb2xsZXIubG9hZCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGluc3BlY3Rvcl9tdXRhdGlvbl9pbl9wcm9ncmVzcyA9IGZhbHNlO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHJlc3BvbnNlLmRhdGEuc2NoZW1hICYmIHJlbmRlcl9pbnNwZWN0b3Jfc2NoZW1hKCBjb25maWcsIHJlc3BvbnNlLmRhdGEuc2NoZW1hLCBmYWxzZSApICkge1xuXHRcdFx0XHRmb3JtID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1pbnNwZWN0b3ItZm9ybV0nICk7XG5cdFx0XHRcdHNob3dfaW5zcGVjdG9yX21lc3NhZ2UoIGZvcm0sIHN1Y2Nlc3NfbWVzc2FnZV9pc19nbG9iYWwgPyAnJyA6IHN1Y2Nlc3NfbWVzc2FnZSwgZmFsc2UgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGZvcm0uY2xhc3NMaXN0LnJlbW92ZSggJ2lzLXNhdmluZycgKTtcblx0XHRcdFx0Zm9ybS5yZW1vdmVBdHRyaWJ1dGUoICdhcmlhLWJ1c3knICk7XG5cdFx0XHRcdGNvbnRyb2xfZGlzYWJsZWRfc3RhdGVzLmZvckVhY2goIGZ1bmN0aW9uICggY29udHJvbF9zdGF0ZSApIHtcblx0XHRcdFx0XHRpZiAoIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jb250YWlucyggY29udHJvbF9zdGF0ZS5jb250cm9sICkgKSB7XG5cdFx0XHRcdFx0XHRjb250cm9sX3N0YXRlLmNvbnRyb2wuZGlzYWJsZWQgPSBjb250cm9sX3N0YXRlLmRpc2FibGVkO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSApO1xuXHRcdFx0XHRpZiAoIHNhdmVfYnV0dG9uICkge1xuXHRcdFx0XHRcdHNhdmVfYnV0dG9uLmNsYXNzTGlzdC5yZW1vdmUoICdpcy1idXN5JyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggY2FuY2VsX2J1dHRvbiApIHtcblx0XHRcdFx0XHRjYW5jZWxfYnV0dG9uLmRpc2FibGVkID0gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0aW5zcGVjdG9yX29yaWdpbmFsX2ZpZWxkcyA9IHNlcmlhbGl6ZV9pbnNwZWN0b3JfZmllbGRzKCk7XG5cdFx0XHRcdHN5bmNocm9uaXplX2luc3BlY3Rvcl9kaXJ0eV9zdGF0ZSgpO1xuXHRcdFx0XHRzaG93X2luc3BlY3Rvcl9tZXNzYWdlKCBmb3JtLCBzdWNjZXNzX21lc3NhZ2VfaXNfZ2xvYmFsID8gJycgOiBzdWNjZXNzX21lc3NhZ2UsIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGNhdGFsb2dfY29udHJvbGxlciApIHtcblx0XHRcdFx0Y2F0YWxvZ19jb250cm9sbGVyLmxvYWQoKTtcblx0XHRcdH1cblx0XHRcdGluc3BlY3Rvcl9tdXRhdGlvbl9pbl9wcm9ncmVzcyA9IGZhbHNlO1xuXHRcdH0gKS5jYXRjaCggZnVuY3Rpb24gKCBlcnJvciApIHtcblx0XHRcdGlmICggbXV0YXRpb25fcmVxdWVzdF9zZXF1ZW5jZSAhPT0gaW5zcGVjdG9yX211dGF0aW9uX3JlcXVlc3Rfc2VxdWVuY2UgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGluc3BlY3Rvcl9tdXRhdGlvbl9pbl9wcm9ncmVzcyA9IGZhbHNlO1xuXHRcdFx0dmFyIG1lc3NhZ2UgPSBlcnJvciAmJiBlcnJvci5tZXNzYWdlID8gZXJyb3IubWVzc2FnZSA6IGNvbmZpZy5pMThuLmluc3BlY3Rvcl9zYXZlX2ZhaWxlZCB8fCAnJztcblx0XHRcdGlmICggISBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY29udGFpbnMoIGZvcm0gKSApIHtcblx0XHRcdFx0c2hvd19hZG1pbl9tZXNzYWdlKCBtZXNzYWdlLCAnZXJyb3InLCA1MDAwICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGZvcm0uY2xhc3NMaXN0LnJlbW92ZSggJ2lzLXNhdmluZycgKTtcblx0XHRcdGZvcm0ucmVtb3ZlQXR0cmlidXRlKCAnYXJpYS1idXN5JyApO1xuXHRcdFx0c2hvd19pbnNwZWN0b3JfbWVzc2FnZSggZm9ybSwgbWVzc2FnZSwgdHJ1ZSApO1xuXHRcdFx0Y29udHJvbF9kaXNhYmxlZF9zdGF0ZXMuZm9yRWFjaCggZnVuY3Rpb24gKCBjb250cm9sX3N0YXRlICkge1xuXHRcdFx0XHRpZiAoIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jb250YWlucyggY29udHJvbF9zdGF0ZS5jb250cm9sICkgKSB7XG5cdFx0XHRcdFx0Y29udHJvbF9zdGF0ZS5jb250cm9sLmRpc2FibGVkID0gY29udHJvbF9zdGF0ZS5kaXNhYmxlZDtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCBzYXZlX2J1dHRvbiApIHtcblx0XHRcdFx0c2F2ZV9idXR0b24uY2xhc3NMaXN0LnJlbW92ZSggJ2lzLWJ1c3knICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGNhbmNlbF9idXR0b24gKSB7XG5cdFx0XHRcdGNhbmNlbF9idXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHN5bmNocm9uaXplX2luc3BlY3Rvcl9kaXJ0eV9zdGF0ZSgpO1xuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTdWJtaXQgYnVsaywgcGVybWFuZW50LWRlbGV0ZSwgYW5kIGNhcGFjaXR5IHJldmlldyBpbnNwZWN0b3Igc3RhdGVzLlxuXHQgKlxuXHQgKiBNdXRhdGlvbnMgcmVtYWluIGltcG9zc2libGUgZnJvbSBzZWxlY3Rpb24gYWxvbmU6IGJ1bGsgZWRpdGluZyByZXF1aXJlcyBhXG5cdCAqIHNpZ25lZCBwcmV2aWV3LCBhbmQgZGVsZXRpb24gYWRkaXRpb25hbGx5IHJlcXVpcmVzIGV4cGxpY2l0IGFja25vd2xlZGdlbWVudC5cblx0ICpcblx0ICogQHBhcmFtIHtTdWJtaXRFdmVudH0gZXZlbnQgIEluc3BlY3RvciBmb3JtIHN1Ym1pc3Npb24uXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGNvbmZpZyBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzdWJtaXRfcmV2aWV3ZWRfaW5zcGVjdG9yKCBldmVudCwgY29uZmlnICkge1xuXHRcdHZhciBmb3JtID0gZXZlbnQudGFyZ2V0O1xuXHRcdHZhciBzYXZlX2J1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5zcGVjdG9yLXNhdmVdJyApO1xuXHRcdHZhciBjYW5jZWxfYnV0dG9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbnNwZWN0b3ItY2FuY2VsXScgKTtcblx0XHR2YXIgcmVxdWVzdF9zZXF1ZW5jZTtcblx0XHR2YXIgYWN0aW9uO1xuXHRcdHZhciB2YWx1ZXM7XG5cdFx0dmFyIGZhbGxiYWNrO1xuXHRcdHZhciBpc19tdXRhdGlvbjtcblx0XHR2YXIgc3VibWl0dGVkX21vZGU7XG5cdFx0dmFyIHN1Ym1pdHRlZF9yZXNvdXJjZV9pZHM7XG5cdFx0dmFyIHN1Ym1pdHRlZF90cmFja3Nfc2VsZWN0aW9uO1xuXG5cdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRpZiAoIGluc3BlY3Rvcl9zZWxlY3Rpb25fc3RhbGUgfHwgISBpc19leHBlY3RlZF9pbnNwZWN0b3Jfc3VibWl0KCBldmVudCwgZm9ybSApIHx8ICggc2F2ZV9idXR0b24gJiYgKCBzYXZlX2J1dHRvbi5kaXNhYmxlZCB8fCBzYXZlX2J1dHRvbi5jbGFzc0xpc3QuY29udGFpbnMoICdpcy1idXN5JyApICkgKSB8fCAhIHJlcG9ydF9pbnNwZWN0b3JfdmFsaWRpdHkoIGZvcm0gKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0c3VibWl0dGVkX21vZGUgPSBpbnNwZWN0b3JfbW9kZTtcblx0XHRzdWJtaXR0ZWRfcmVzb3VyY2VfaWRzID0gaW5zcGVjdG9yX3Jlc291cmNlX2lkcy5zbGljZSgpO1xuXHRcdHN1Ym1pdHRlZF90cmFja3Nfc2VsZWN0aW9uID0gaW5zcGVjdG9yX3RyYWNrc19zZWxlY3Rpb247XG5cdFx0aWYgKCAnYnVsa19lZGl0JyA9PT0gc3VibWl0dGVkX21vZGUgKSB7XG5cdFx0XHRpbnNwZWN0b3JfYnVsa19vcGVyYXRpb25zID0gY29sbGVjdF9idWxrX29wZXJhdGlvbnMoKTtcblx0XHRcdGFjdGlvbiA9IGNvbmZpZy5idWxrX3ByZXZpZXdfYWN0aW9uO1xuXHRcdFx0dmFsdWVzID0geyByZXNvdXJjZV9pZHM6IEpTT04uc3RyaW5naWZ5KCBpbnNwZWN0b3JfcmVzb3VyY2VfaWRzICksIG9wZXJhdGlvbnM6IEpTT04uc3RyaW5naWZ5KCBpbnNwZWN0b3JfYnVsa19vcGVyYXRpb25zICkgfTtcblx0XHRcdGZhbGxiYWNrID0gY29uZmlnLmkxOG4uYnVsa19yZXZpZXdfZmFpbGVkO1xuXHRcdH0gZWxzZSBpZiAoICdidWxrX3JldmlldycgPT09IHN1Ym1pdHRlZF9tb2RlICkge1xuXHRcdFx0YWN0aW9uID0gY29uZmlnLmJ1bGtfYXBwbHlfYWN0aW9uO1xuXHRcdFx0dmFsdWVzID0geyByZXNvdXJjZV9pZHM6IEpTT04uc3RyaW5naWZ5KCBpbnNwZWN0b3JfcmVzb3VyY2VfaWRzICksIG9wZXJhdGlvbnM6IEpTT04uc3RyaW5naWZ5KCBpbnNwZWN0b3JfYnVsa19vcGVyYXRpb25zICksIHJldmlld190b2tlbjogaW5zcGVjdG9yX3Jldmlld190b2tlbiB9O1xuXHRcdFx0ZmFsbGJhY2sgPSBjb25maWcuaTE4bi5idWxrX2FwcGx5X2ZhaWxlZDtcblx0XHR9IGVsc2UgaWYgKCAnZGVsZXRlX3JldmlldycgPT09IHN1Ym1pdHRlZF9tb2RlICkge1xuXHRcdFx0YWN0aW9uID0gY29uZmlnLmRlbGV0ZV9hcHBseV9hY3Rpb247XG5cdFx0XHR2YWx1ZXMgPSB7IGFja25vd2xlZGdlZDogJzEnLCByZXNvdXJjZV9pZHM6IEpTT04uc3RyaW5naWZ5KCBpbnNwZWN0b3JfcmVzb3VyY2VfaWRzICksIHJldmlld190b2tlbjogaW5zcGVjdG9yX3Jldmlld190b2tlbiB9O1xuXHRcdFx0ZmFsbGJhY2sgPSBjb25maWcuaTE4bi5kZWxldGVfYXBwbHlfZmFpbGVkO1xuXHRcdH0gZWxzZSBpZiAoICdjYXBhY2l0eScgPT09IHN1Ym1pdHRlZF9tb2RlICkge1xuXHRcdFx0YWN0aW9uID0gY29uZmlnLmNhcGFjaXR5X3ByZXZpZXdfYWN0aW9uO1xuXHRcdFx0dmFsdWVzID0geyByZXNvdXJjZV9pZDogaW5zcGVjdG9yX3Jlc291cmNlX2lkLCB0YXJnZXRfY2FwYWNpdHk6IGluc3BlY3Rvcl9jYXBhY2l0eV90YXJnZXQsIGRldGFjaF9yZXNvdXJjZV9pZHM6IEpTT04uc3RyaW5naWZ5KCBpbnNwZWN0b3JfY2FwYWNpdHlfZGV0YWNoX2lkcyApLCBkZWNyZWFzZV9hY3Rpb246IGluc3BlY3Rvcl9jYXBhY2l0eV9kZWNyZWFzZV9hY3Rpb24gfTtcblx0XHRcdGZhbGxiYWNrID0gY29uZmlnLmkxOG4uY2FwYWNpdHlfcmV2aWV3X2ZhaWxlZDtcblx0XHR9IGVsc2UgaWYgKCAnY2FwYWNpdHlfcmV2aWV3JyA9PT0gc3VibWl0dGVkX21vZGUgKSB7XG5cdFx0XHRhY3Rpb24gPSBjb25maWcuY2FwYWNpdHlfYXBwbHlfYWN0aW9uO1xuXHRcdFx0dmFyIGNhcGFjaXR5X2Fja25vd2xlZGdlbWVudCA9IGZvcm0ucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1jYXBhY2l0eS1kZWxldGUtYWNrbm93bGVkZ2VtZW50XScgKTtcblx0XHRcdHZhbHVlcyA9IHsgcmVzb3VyY2VfaWQ6IGluc3BlY3Rvcl9yZXNvdXJjZV9pZCwgdGFyZ2V0X2NhcGFjaXR5OiBpbnNwZWN0b3JfY2FwYWNpdHlfdGFyZ2V0LCBkZXRhY2hfcmVzb3VyY2VfaWRzOiBKU09OLnN0cmluZ2lmeSggaW5zcGVjdG9yX2NhcGFjaXR5X2RldGFjaF9pZHMgKSwgZGVjcmVhc2VfYWN0aW9uOiBpbnNwZWN0b3JfY2FwYWNpdHlfZGVjcmVhc2VfYWN0aW9uLCBhY2tub3dsZWRnZWQ6IGNhcGFjaXR5X2Fja25vd2xlZGdlbWVudCAmJiBjYXBhY2l0eV9hY2tub3dsZWRnZW1lbnQuY2hlY2tlZCA/ICcxJyA6ICcwJywgcmV2aWV3X3Rva2VuOiBpbnNwZWN0b3JfcmV2aWV3X3Rva2VuIH07XG5cdFx0XHRmYWxsYmFjayA9IGNvbmZpZy5pMThuLmNhcGFjaXR5X2FwcGx5X2ZhaWxlZDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlzX211dGF0aW9uID0gJ2J1bGtfcmV2aWV3JyA9PT0gc3VibWl0dGVkX21vZGUgfHwgJ2RlbGV0ZV9yZXZpZXcnID09PSBzdWJtaXR0ZWRfbW9kZSB8fCAnY2FwYWNpdHlfcmV2aWV3JyA9PT0gc3VibWl0dGVkX21vZGU7XG5cdFx0cmVxdWVzdF9zZXF1ZW5jZSA9IGlzX211dGF0aW9uID8gKytpbnNwZWN0b3JfbXV0YXRpb25fcmVxdWVzdF9zZXF1ZW5jZSA6ICsraW5zcGVjdG9yX3JlcXVlc3Rfc2VxdWVuY2U7XG5cdFx0aWYgKCBpc19tdXRhdGlvbiApIHtcblx0XHRcdGluc3BlY3Rvcl9tdXRhdGlvbl9pbl9wcm9ncmVzcyA9IHRydWU7XG5cdFx0fVxuXHRcdGlmICggJ2J1bGtfcmV2aWV3JyA9PT0gc3VibWl0dGVkX21vZGUgJiYgZ2V0X2lubGluZV9yZXZpZXdfd29ya2Zsb3coKSApIHtcblx0XHRcdGdldF9pbmxpbmVfcmV2aWV3X3dvcmtmbG93KCkuc3luY2hyb25pemUoIHsgYnVzeTogdHJ1ZSwgY2FuX2FwcGx5OiB0cnVlIH0gKTtcblx0XHR9XG5cdFx0aWYgKCAnZGVsZXRlX3JldmlldycgPT09IHN1Ym1pdHRlZF9tb2RlICYmIGdldF9kZWxldGVfcmV2aWV3X3dvcmtmbG93KCkgKSB7XG5cdFx0XHRnZXRfZGVsZXRlX3Jldmlld193b3JrZmxvdygpLnN5bmNocm9uaXplKCB7IGJ1c3k6IHRydWUsIGNhbl9hcHBseTogdHJ1ZSB9ICk7XG5cdFx0fVxuXHRcdGlmICggc2F2ZV9idXR0b24gKSB7XG5cdFx0XHRzYXZlX2J1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG5cdFx0XHRzYXZlX2J1dHRvbi5jbGFzc0xpc3QuYWRkKCAnaXMtYnVzeScgKTtcblx0XHR9XG5cdFx0aWYgKCBjYW5jZWxfYnV0dG9uICkge1xuXHRcdFx0Y2FuY2VsX2J1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG5cdFx0fVxuXHRcdGZvcm0uY2xhc3NMaXN0LmFkZCggJ2lzLXNhdmluZycgKTtcblx0XHRmb3JtLnNldEF0dHJpYnV0ZSggJ2FyaWEtYnVzeScsICd0cnVlJyApO1xuXG5cdFx0cmVxdWVzdF9pbnNwZWN0b3IoIGNvbmZpZywgYWN0aW9uLCB2YWx1ZXMgKS50aGVuKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0aWYgKCByZXF1ZXN0X3NlcXVlbmNlICE9PSAoIGlzX211dGF0aW9uID8gaW5zcGVjdG9yX211dGF0aW9uX3JlcXVlc3Rfc2VxdWVuY2UgOiBpbnNwZWN0b3JfcmVxdWVzdF9zZXF1ZW5jZSApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgcmVzcG9uc2UgfHwgdHJ1ZSAhPT0gcmVzcG9uc2Uuc3VjY2VzcyB8fCAhIHJlc3BvbnNlLmRhdGEgKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvciggZ2V0X2luc3BlY3Rvcl9yZXNwb25zZV9tZXNzYWdlKCByZXNwb25zZSwgZmFsbGJhY2sgKSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAnYnVsa19lZGl0JyA9PT0gc3VibWl0dGVkX21vZGUgKSB7XG5cdFx0XHRcdGlmICggISByZXNwb25zZS5kYXRhLnByZXZpZXcgfHwgISByZW5kZXJfYnVsa19yZXZpZXcoIGNvbmZpZywgcmVzcG9uc2UuZGF0YS5wcmV2aWV3ICkgKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCBmYWxsYmFjayB8fCAnJyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggJ2NhcGFjaXR5JyA9PT0gc3VibWl0dGVkX21vZGUgKSB7XG5cdFx0XHRcdGlmICggISByZXNwb25zZS5kYXRhLnByZXZpZXcgfHwgISByZW5kZXJfY2FwYWNpdHlfcmV2aWV3KCBjb25maWcsIHJlc3BvbnNlLmRhdGEucHJldmlldyApICkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggZmFsbGJhY2sgfHwgJycgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICdidWxrX3JldmlldycgPT09IHN1Ym1pdHRlZF9tb2RlICkge1xuXHRcdFx0XHRwZW5kaW5nX2hpZ2hsaWdodF9pZHMgPSBBcnJheS5pc0FycmF5KCByZXNwb25zZS5kYXRhLnVwZGF0ZWRfaWRzICkgPyByZXNwb25zZS5kYXRhLnVwZGF0ZWRfaWRzLm1hcCggU3RyaW5nICkgOiBbXTtcblx0XHRcdH0gZWxzZSBpZiAoICdjYXBhY2l0eV9yZXZpZXcnID09PSBzdWJtaXR0ZWRfbW9kZSApIHtcblx0XHRcdFx0cGVuZGluZ19oaWdobGlnaHRfaWRzID0gQXJyYXkuaXNBcnJheSggcmVzcG9uc2UuZGF0YS5hZmZlY3RlZF9pZHMgKSA/IHJlc3BvbnNlLmRhdGEuYWZmZWN0ZWRfaWRzLm1hcCggU3RyaW5nICkgOiBbXTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHZhciBtb3VudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBjb25maWcubW91bnRfaWQgKTtcblx0XHRcdFx0dmFyIHNlbGVjdGlvbiA9IG1vdW50ICYmIG1vdW50Ll93cGJjX3VpX2NhdGFsb2dfc2VsZWN0aW9uX2NvbnRyb2xsZXI7XG5cdFx0XHRcdHZhciBzZWxlY3RlZF9yZXNvdXJjZV9pZHMgPSBnZXRfc2VsZWN0ZWRfcmVzb3VyY2VfaWRzKCBjb25maWcgKTtcblx0XHRcdFx0dmFyIGRlbGV0ZWRfc2VsZWN0ZWRfcmVzb3VyY2UgPSBzdWJtaXR0ZWRfcmVzb3VyY2VfaWRzLnNvbWUoIGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIC0xICE9PSBzZWxlY3RlZF9yZXNvdXJjZV9pZHMuaW5kZXhPZiggTnVtYmVyKCByZXNvdXJjZV9pZCApICk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0aWYgKCBzZWxlY3Rpb24gJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHNlbGVjdGlvbi5jbGVhciAmJiAoIHN1Ym1pdHRlZF90cmFja3Nfc2VsZWN0aW9uIHx8IGRlbGV0ZWRfc2VsZWN0ZWRfcmVzb3VyY2UgKSApIHtcblx0XHRcdFx0XHRzZWxlY3Rpb24uY2xlYXIoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0c2hvd19hZG1pbl9tZXNzYWdlKCBnZXRfaW5zcGVjdG9yX3Jlc3BvbnNlX21lc3NhZ2UoIHJlc3BvbnNlLCAnJyApLCAnc3VjY2VzcycsIDQwMDAgKTtcblx0XHRcdGluc3BlY3Rvcl9kaXJ0eSA9IGZhbHNlO1xuXHRcdFx0aW5zcGVjdG9yX211dGF0aW9uX2luX3Byb2dyZXNzID0gZmFsc2U7XG5cdFx0XHRpZiAoIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jb250YWlucyggZm9ybSApICkge1xuXHRcdFx0XHRjbG9zZV9pbnNwZWN0b3IoIGNvbmZpZywgZmFsc2UgKTtcblx0XHRcdH1cblx0XHRcdGlmICggY2F0YWxvZ19jb250cm9sbGVyICkge1xuXHRcdFx0XHRjYXRhbG9nX2NvbnRyb2xsZXIubG9hZCgpO1xuXHRcdFx0fVxuXHRcdH0gKS5jYXRjaCggZnVuY3Rpb24gKCBlcnJvciApIHtcblx0XHRcdGlmICggcmVxdWVzdF9zZXF1ZW5jZSAhPT0gKCBpc19tdXRhdGlvbiA/IGluc3BlY3Rvcl9tdXRhdGlvbl9yZXF1ZXN0X3NlcXVlbmNlIDogaW5zcGVjdG9yX3JlcXVlc3Rfc2VxdWVuY2UgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBpc19tdXRhdGlvbiApIHtcblx0XHRcdFx0aW5zcGVjdG9yX211dGF0aW9uX2luX3Byb2dyZXNzID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNvbnRhaW5zKCBmb3JtICkgKSB7XG5cdFx0XHRcdHNob3dfYWRtaW5fbWVzc2FnZSggZXJyb3IgJiYgZXJyb3IubWVzc2FnZSA/IGVycm9yLm1lc3NhZ2UgOiBmYWxsYmFjayB8fCAnJywgJ2Vycm9yJywgNTAwMCApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRmb3JtLmNsYXNzTGlzdC5yZW1vdmUoICdpcy1zYXZpbmcnICk7XG5cdFx0XHRmb3JtLnJlbW92ZUF0dHJpYnV0ZSggJ2FyaWEtYnVzeScgKTtcblx0XHRcdHNob3dfaW5zcGVjdG9yX21lc3NhZ2UoIGZvcm0sIGVycm9yICYmIGVycm9yLm1lc3NhZ2UgPyBlcnJvci5tZXNzYWdlIDogZmFsbGJhY2sgfHwgJycsIHRydWUgKTtcblx0XHRcdGlmICggc2F2ZV9idXR0b24gKSB7XG5cdFx0XHRcdHNhdmVfYnV0dG9uLmNsYXNzTGlzdC5yZW1vdmUoICdpcy1idXN5JyApO1xuXHRcdFx0XHRzYXZlX2J1dHRvbi5kaXNhYmxlZCA9IGluc3BlY3Rvcl9zZWxlY3Rpb25fc3RhbGUgfHwgKCAnZGVsZXRlX3JldmlldycgPT09IGluc3BlY3Rvcl9tb2RlICYmICEgZm9ybS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWRlbGV0ZS1hY2tub3dsZWRnZW1lbnRdOmNoZWNrZWQnICkgKTtcblx0XHRcdH1cblx0XHRcdGlmICggY2FuY2VsX2J1dHRvbiApIHtcblx0XHRcdFx0Y2FuY2VsX2J1dHRvbi5kaXNhYmxlZCA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAnYnVsa19yZXZpZXcnID09PSBzdWJtaXR0ZWRfbW9kZSAmJiBnZXRfaW5saW5lX3Jldmlld193b3JrZmxvdygpICkge1xuXHRcdFx0XHRnZXRfaW5saW5lX3Jldmlld193b3JrZmxvdygpLnN5bmNocm9uaXplKCB7IGJ1c3k6IGZhbHNlLCBjYW5fYXBwbHk6ICEgaW5zcGVjdG9yX3NlbGVjdGlvbl9zdGFsZSB9ICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICdkZWxldGVfcmV2aWV3JyA9PT0gc3VibWl0dGVkX21vZGUgJiYgZ2V0X2RlbGV0ZV9yZXZpZXdfd29ya2Zsb3coKSApIHtcblx0XHRcdFx0Z2V0X2RlbGV0ZV9yZXZpZXdfd29ya2Zsb3coKS5zeW5jaHJvbml6ZSggeyBidXN5OiBmYWxzZSwgY2FuX2FwcGx5OiAhIGluc3BlY3Rvcl9zZWxlY3Rpb25fc3RhbGUgfSApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBJbnZhbGlkYXRlIGFuIG9wZW4gc2VsZWN0aW9uLW93bmVkIGluc3BlY3RvciB3aGVuIGl0cyBzZWxlY3Rpb24gY2hhbmdlcy5cblx0ICpcblx0ICogQHBhcmFtIHtDdXN0b21FdmVudH0gZXZlbnQgIFNoYXJlZCBzZWxlY3Rpb24gbGlmZWN5Y2xlIGV2ZW50LlxuXHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBjb25maWcgQ2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gaGFuZGxlX2luc3BlY3Rvcl9zZWxlY3Rpb25fY2hhbmdlKCBldmVudCwgY29uZmlnICkge1xuXHRcdHZhciBzZWxlY3RlZF9pZHMgPSBldmVudCAmJiBldmVudC5kZXRhaWwgJiYgQXJyYXkuaXNBcnJheSggZXZlbnQuZGV0YWlsLnNlbGVjdGVkX2lkcyApID8gZXZlbnQuZGV0YWlsLnNlbGVjdGVkX2lkcyA6IGdldF9zZWxlY3RlZF9yZXNvdXJjZV9pZHMoIGNvbmZpZyApO1xuXHRcdHZhciBmb3JtO1xuXHRcdHZhciBzYXZlX2J1dHRvbjtcblxuXHRcdGlmICggISBpbnNwZWN0b3JfdHJhY2tzX3NlbGVjdGlvbiB8fCAtMSA9PT0gWyAnYnVsa19lZGl0JywgJ2J1bGtfcmV2aWV3JywgJ2RlbGV0ZV9yZXZpZXcnIF0uaW5kZXhPZiggaW5zcGVjdG9yX21vZGUgKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Zm9ybSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtYnVsay1mb3JtXSwgW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWJ1bGstcmV2aWV3LWZvcm1dLCBbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtZGVsZXRlLWZvcm1dJyApO1xuXHRcdHNhdmVfYnV0dG9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbnNwZWN0b3Itc2F2ZV0nICk7XG5cdFx0aWYgKCByZXNvdXJjZV9pZF9saXN0c19tYXRjaCggaW5zcGVjdG9yX3Jlc291cmNlX2lkcywgc2VsZWN0ZWRfaWRzICkgKSB7XG5cdFx0XHRpZiAoICEgaW5zcGVjdG9yX3NlbGVjdGlvbl9zdGFsZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aW5zcGVjdG9yX3NlbGVjdGlvbl9zdGFsZSA9IGZhbHNlO1xuXHRcdFx0c2hvd19pbnNwZWN0b3JfbWVzc2FnZSggZm9ybSwgJycsIGZhbHNlICk7XG5cdFx0XHRpZiAoICdkZWxldGVfcmV2aWV3JyA9PT0gaW5zcGVjdG9yX21vZGUgJiYgZ2V0X2RlbGV0ZV9yZXZpZXdfd29ya2Zsb3coKSApIHtcblx0XHRcdFx0Z2V0X2RlbGV0ZV9yZXZpZXdfd29ya2Zsb3coKS5zeW5jaHJvbml6ZSggeyBidXN5OiBmYWxzZSwgY2FuX2FwcGx5OiB0cnVlIH0gKTtcblx0XHRcdH1cblx0XHRcdGlmICggJ2J1bGtfZWRpdCcgPT09IGluc3BlY3Rvcl9tb2RlICkge1xuXHRcdFx0XHRzeW5jaHJvbml6ZV9idWxrX2VkaXRvciggbnVsbCApO1xuXHRcdFx0fSBlbHNlIGlmICggc2F2ZV9idXR0b24gKSB7XG5cdFx0XHRcdHZhciBhY2tub3dsZWRnZW1lbnQgPSBmb3JtID8gZm9ybS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWRlbGV0ZS1hY2tub3dsZWRnZW1lbnRdJyApIDogbnVsbDtcblx0XHRcdFx0c2F2ZV9idXR0b24uZGlzYWJsZWQgPSAnZGVsZXRlX3JldmlldycgPT09IGluc3BlY3Rvcl9tb2RlICYmICggISBhY2tub3dsZWRnZW1lbnQgfHwgISBhY2tub3dsZWRnZW1lbnQuY2hlY2tlZCApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpbnNwZWN0b3Jfc2VsZWN0aW9uX3N0YWxlID0gdHJ1ZTtcblx0XHRzaG93X2luc3BlY3Rvcl9tZXNzYWdlKCBmb3JtLCBjb25maWcuaTE4bi5zZWxlY3Rpb25fY2hhbmdlZCB8fCAnJywgdHJ1ZSApO1xuXHRcdGlmICggJ2RlbGV0ZV9yZXZpZXcnID09PSBpbnNwZWN0b3JfbW9kZSAmJiBnZXRfZGVsZXRlX3Jldmlld193b3JrZmxvdygpICkge1xuXHRcdFx0Z2V0X2RlbGV0ZV9yZXZpZXdfd29ya2Zsb3coKS5zeW5jaHJvbml6ZSggeyBidXN5OiBmYWxzZSwgY2FuX2FwcGx5OiBmYWxzZSB9ICk7XG5cdFx0fVxuXHRcdGlmICggc2F2ZV9idXR0b24gKSB7XG5cdFx0XHRzYXZlX2J1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEFwcGx5IHRoZSBwb3N0LW11dGF0aW9uIGhpZ2hsaWdodCBhZnRlciBhbiBBSkFYIGNhdGFsb2cgcmVmcmVzaC5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGFwcGx5X3BlbmRpbmdfaGlnaGxpZ2h0cygpIHtcblx0XHR2YXIgZmlyc3Rfcm93ID0gbnVsbDtcblxuXHRcdHBlbmRpbmdfaGlnaGxpZ2h0X2lkcy5mb3JFYWNoKCBmdW5jdGlvbiAoIHJlc291cmNlX2lkICkge1xuXHRcdFx0dmFyIHJvdyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtaWQ9XCInICsgcmVzb3VyY2VfaWQgKyAnXCJdJyApO1xuXHRcdFx0aWYgKCByb3cgKSB7XG5cdFx0XHRcdHJvdy5jbGFzc0xpc3QuYWRkKCAnaXMtcmVjZW50bHktc2F2ZWQnICk7XG5cdFx0XHRcdGZpcnN0X3JvdyA9IGZpcnN0X3JvdyB8fCByb3c7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHRcdGlmICggZmlyc3Rfcm93ICkge1xuXHRcdFx0Zmlyc3Rfcm93LnNjcm9sbEludG9WaWV3KCB7IGJsb2NrOiAnbmVhcmVzdCcsIGJlaGF2aW9yOiAnc21vb3RoJyB9ICk7XG5cdFx0fVxuXHRcdHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYm9va2luZ19yZXNvdXJjZXNfX2l0ZW0uaXMtcmVjZW50bHktc2F2ZWQnICkuZm9yRWFjaCggZnVuY3Rpb24gKCByb3cgKSB7XG5cdFx0XHRcdHJvdy5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtcmVjZW50bHktc2F2ZWQnICk7XG5cdFx0XHR9ICk7XG5cdFx0fSwgNTAwMCApO1xuXHRcdHBlbmRpbmdfaGlnaGxpZ2h0X2lkcyA9IFtdO1xuXHR9XG5cblx0LyoqXG5cdCAqIEhhbmRsZSBjb21wbGV0ZWQgc2hhcmVkIHJlbmRlcnMgZm9yIHRoaXMgUmVzb3VyY2UgY2F0YWxvZyBvbmx5LlxuXHQgKlxuXHQgKiBAcGFyYW0ge0N1c3RvbUV2ZW50fSBldmVudCBTaGFyZWQgY2F0YWxvZyBsaWZlY3ljbGUgZXZlbnQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBoYW5kbGVfY2F0YWxvZ19yZW5kZXJlZCggZXZlbnQgKSB7XG5cdFx0dmFyIGNvbmZpZyA9IHdpbmRvdy53cGJjX2NhdGFsb2dfYm9va2luZ19yZXNvdXJjZXNfY29uZmlnO1xuXHRcdHZhciBldmVudF9kZXRhaWwgPSBldmVudCAmJiBldmVudC5kZXRhaWwgPyBldmVudC5kZXRhaWwgOiB7fTtcblxuXHRcdGlmICggISBjb25maWcgfHwgZXZlbnRfZGV0YWlsLmNhdGFsb2dfaWQgIT09IGNvbmZpZy5pZCB8fCAhIGV2ZW50X2RldGFpbC5yZXNwb25zZSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjYXRhbG9nX3Jlc3BvbnNlID0gZXZlbnRfZGV0YWlsLnJlc3BvbnNlO1xuXHRcdHN5bmNocm9uaXplX2Jvb2tpbmdfcmVzb3VyY2VzX3Rvb2xiYXIoIGNvbmZpZywgY2F0YWxvZ19yZXNwb25zZSApO1xuXHRcdHJlbmRlcl9ib29raW5nX3Jlc291cmNlc19yZXNwb25zZSggY29uZmlnLCBjYXRhbG9nX3Jlc3BvbnNlICk7XG5cdFx0cmVuZGVyX2lubGluZV9iYXIoIGNvbmZpZyApO1xuXHRcdHN5bmNocm9uaXplX2lubGluZV9jb250cm9scyggY29uZmlnICk7XG5cdFx0aWYgKCBpbnNwZWN0b3JfcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRtYXJrX2luc3BlY3Rvcl9yZXNvdXJjZV9yb3coIGluc3BlY3Rvcl9yZXNvdXJjZV9pZCApO1xuXHRcdH1cblx0XHRhcHBseV9wZW5kaW5nX2hpZ2hsaWdodHMoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXF1ZXN0IGEgc2VsZWN0ZWQgcGFnaW5hdGlvbiBwYWdlIHRocm91Z2ggdGhlIHNoYXJlZCBjb250cm9sbGVyLlxuXHQgKlxuXHQgKiBAcGFyYW0ge01vdXNlRXZlbnR9IGV2ZW50IENhdGFsb2cgY2xpY2sgZXZlbnQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBoYW5kbGVfY2F0YWxvZ19jbGljayggZXZlbnQgKSB7XG5cdFx0dmFyIGFjdGlvbl9idXR0b24gPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1hY3Rpb25dJyApO1xuXHRcdHZhciBhY3Rpb25fZGV0YWlscztcblx0XHR2YXIgY2F0YWxvZ19tb3VudDtcblx0XHR2YXIgY29uZmlnID0gd2luZG93LndwYmNfY2F0YWxvZ19ib29raW5nX3Jlc291cmNlc19jb25maWc7XG5cdFx0dmFyIHBhZ2VfYnV0dG9uID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctcGFnZV0nICk7XG5cdFx0dmFyIHJlc291cmNlX2FjdGlvbl9ldmVudDtcblxuXHRcdGlmICggaW5saW5lX3N0YXRlLmFjdGl2ZSAmJiBhY3Rpb25fYnV0dG9uICkge1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIHBhZ2VfYnV0dG9uICYmICEgcGFnZV9idXR0b24uZGlzYWJsZWQgKSB7XG5cdFx0XHRwZW5kaW5nX2ZvY3VzX2RpcmVjdGlvbiA9IHBhZ2VfYnV0dG9uLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy11aS1jYXRhbG9nLXBhZ2UtZGlyZWN0aW9uJyApIHx8ICdwYWdlJztcblx0XHR9XG5cblx0XHRpZiAoICEgYWN0aW9uX2J1dHRvbiB8fCAhIGNvbmZpZyApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dmFyIGFjdGlvbl9pZCA9IGFjdGlvbl9idXR0b24uZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtYWN0aW9uJyApIHx8ICcnO1xuXHRcdGlmICggJ3RvZ2dsZV9kZXRhaWxzJyA9PT0gYWN0aW9uX2lkICkge1xuXHRcdFx0dmFyIHJlc291cmNlX2lkID0gTnVtYmVyKCBhY3Rpb25fYnV0dG9uLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWlkJyApIHx8IDAgKTtcblx0XHRcdHZhciByZXNvdXJjZV9yb3cgPSBnZXRfcmVzb3VyY2VfaXRlbV9jb250YWluZXIoIGFjdGlvbl9idXR0b24gKTtcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRpZiAoIHJlc291cmNlX2lkICYmIHJlc291cmNlX3JvdyAmJiBjb25maWcuZGV0YWlsc19hY3Rpb24gKSB7XG5cdFx0XHRcdGlmICggcmVzb3VyY2VfaWQgPT09IGRldGFpbHNfcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdFx0Y2xvc2VfZGV0YWlsc19yb3coIHRydWUgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRvcGVuX2RldGFpbHNfcm93KCBjb25maWcsIGFjdGlvbl9idXR0b24sIHJlc291cmNlX3JvdywgcmVzb3VyY2VfaWQgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoICdjb3B5X2RldGFpbHNfdmFsdWUnID09PSBhY3Rpb25faWQgKSB7XG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0Y29weV9kZXRhaWxzX3ZhbHVlKCBhY3Rpb25fYnV0dG9uLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWNvcHktdmFsdWUnICkgfHwgJycsIGFjdGlvbl9idXR0b24sIGNvbmZpZyApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRhY3Rpb25fZGV0YWlscyA9IGFjdGlvbl9idXR0b24uY2xvc2VzdCggJ2RldGFpbHMnICk7XG5cdFx0aWYgKCBhY3Rpb25fZGV0YWlscyApIHtcblx0XHRcdGFjdGlvbl9kZXRhaWxzLnJlbW92ZUF0dHJpYnV0ZSggJ29wZW4nICk7XG5cdFx0fVxuXG5cdFx0Y2F0YWxvZ19tb3VudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBjb25maWcubW91bnRfaWQgKTtcblx0XHRpZiAoIGNhdGFsb2dfbW91bnQgKSB7XG5cdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cuQ3VzdG9tRXZlbnQgKSB7XG5cdFx0XHRcdHJlc291cmNlX2FjdGlvbl9ldmVudCA9IG5ldyB3aW5kb3cuQ3VzdG9tRXZlbnQoICd3cGJjOmJvb2tpbmctcmVzb3VyY2UtYWN0aW9uJywge1xuXHRcdFx0XHRcdGJ1YmJsZXM6IHRydWUsXG5cdFx0XHRcdFx0ZGV0YWlsOiB7XG5cdFx0XHRcdFx0XHRhY3Rpb246IGFjdGlvbl9idXR0b24uZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtYWN0aW9uJyApIHx8ICcnLFxuXHRcdFx0XHRcdFx0cmVzb3VyY2VfaWQ6IE51bWJlciggYWN0aW9uX2J1dHRvbi5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1pZCcgKSB8fCAwIClcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlc291cmNlX2FjdGlvbl9ldmVudCA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCAnQ3VzdG9tRXZlbnQnICk7XG5cdFx0XHRcdHJlc291cmNlX2FjdGlvbl9ldmVudC5pbml0Q3VzdG9tRXZlbnQoICd3cGJjOmJvb2tpbmctcmVzb3VyY2UtYWN0aW9uJywgdHJ1ZSwgZmFsc2UsIHtcblx0XHRcdFx0XHRhY3Rpb246IGFjdGlvbl9idXR0b24uZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtYWN0aW9uJyApIHx8ICcnLFxuXHRcdFx0XHRcdHJlc291cmNlX2lkOiBOdW1iZXIoIGFjdGlvbl9idXR0b24uZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtaWQnICkgfHwgMCApXG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblx0XHRcdGNhdGFsb2dfbW91bnQuZGlzcGF0Y2hFdmVudCggcmVzb3VyY2VfYWN0aW9uX2V2ZW50ICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIENsb3NlIGV4cGFuZGVkIGRldGFpbHMgd2l0aCBFc2NhcGUgYW5kIHJlc3RvcmUgZGlzY2xvc3VyZSBmb2N1cy5cblx0ICpcblx0ICogQHBhcmFtIHtLZXlib2FyZEV2ZW50fSBldmVudCBDYXRhbG9nIGtleWJvYXJkIGV2ZW50LlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gaGFuZGxlX2NhdGFsb2dfa2V5ZG93biggZXZlbnQgKSB7XG5cdFx0dmFyIGNvbmZpZyA9IHdpbmRvdy53cGJjX2NhdGFsb2dfYm9va2luZ19yZXNvdXJjZXNfY29uZmlnO1xuXG5cdFx0aWYgKCAnRXNjYXBlJyA9PT0gZXZlbnQua2V5ICYmIGlubGluZV9zdGF0ZS5hY3RpdmUgJiYgJ2lubGluZV9yZXZpZXcnICE9PSBpbnNwZWN0b3JfbW9kZSApIHtcblx0XHRcdHN5bmNocm9uaXplX2lubGluZV9kcmFmdHMoIGNvbmZpZyApO1xuXHRcdFx0aWYgKCAhIGlubGluZV9zdGF0ZS5jaGFuZ2VkX3Jvd3MubGVuZ3RoIHx8IHdpbmRvdy5jb25maXJtKCBjb25maWcuaTE4bi5pbmxpbmVfZGlzY2FyZCB8fCAnJyApICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRsZWF2ZV9pbmxpbmVfbW9kZSggY29uZmlnLCB0cnVlLCAnJyApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoICdFc2NhcGUnID09PSBldmVudC5rZXkgJiYgZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtZGV0YWlscy1yb3ddJyApICkge1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGNsb3NlX2RldGFpbHNfcm93KCB0cnVlICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEJsb2NrIEJvb2tpbmcgUmVzb3VyY2UgaW1hZ2UgY2hhbmdlcyBpbiBwdWJsaWMgZGVtbyBpbnN0YWxsYXRpb25zLlxuXHQgKlxuXHQgKiBUaGlzIGNhcHR1cmUtcGhhc2UgZ3VhcmQgcnVucyBiZWZvcmUgdGhlIHNoYXJlZCBkZWxlZ2F0ZWQgbWVkaWEtdXBsb2FkZXJcblx0ICogaGFuZGxlciwgcHJldmVudGluZyB0aGUgV29yZFByZXNzIG1lZGlhIG1vZGFsIGZyb20gb3BlbmluZy4gU2VydmVyLXNpZGVcblx0ICogY3JlYXRlIHZhbGlkYXRpb24gaW5kZXBlbmRlbnRseSByZWplY3RzIGEgZm9yZ2VkIHBpY3R1cmUgVVJMLlxuXHQgKlxuXHQgKiBAcGFyYW0ge01vdXNlRXZlbnR9IGV2ZW50ICBCcm93c2VyIGNsaWNrIGV2ZW50LlxuXHQgKiBAcGFyYW0ge09iamVjdH0gICAgIGNvbmZpZyBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBwcm90ZWN0X2RlbW9fcmVzb3VyY2VfaW1hZ2VfY2hhbmdlKCBldmVudCwgY29uZmlnICkge1xuXHRcdHZhciBtZWRpYV9idXR0b247XG5cdFx0dmFyIGluc3BlY3Rvcl9mb3JtO1xuXHRcdHZhciBtZXNzYWdlO1xuXHRcdHZhciBtZXNzYWdlX3RpdGxlO1xuXG5cdFx0aWYgKCAhIGNvbmZpZyB8fCAhIGlzX3RydWVfZmxhZyggY29uZmlnLmlzX2RlbW8gKSB8fCAhIGV2ZW50LnRhcmdldCB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgZXZlbnQudGFyZ2V0LmNsb3Nlc3QgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bWVkaWFfYnV0dG9uID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICcud3BiY19tZWRpYV91cGxvYWRfYnV0dG9uLCBbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtcmVtb3ZlLWltYWdlXScgKTtcblx0XHRpbnNwZWN0b3JfZm9ybSA9IG1lZGlhX2J1dHRvbiA/IG1lZGlhX2J1dHRvbi5jbG9zZXN0KCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWluc3BlY3Rvci1mb3JtXScgKSA6IG51bGw7XG5cdFx0aWYgKCAhIG1lZGlhX2J1dHRvbiB8fCAhIGluc3BlY3Rvcl9mb3JtICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uICkge1xuXHRcdFx0ZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG5cdFx0fVxuXHRcdG1lc3NhZ2UgPSBjb25maWcuaTE4biAmJiBjb25maWcuaTE4bi5kZW1vX2ltYWdlX2NoYW5nZV91bmF2YWlsYWJsZSA/IGNvbmZpZy5pMThuLmRlbW9faW1hZ2VfY2hhbmdlX3VuYXZhaWxhYmxlIDogJyc7XG5cdFx0bWVzc2FnZV90aXRsZSA9IGNvbmZpZy5pMThuICYmIGNvbmZpZy5pMThuLmRlbW9faW1hZ2VfY2hhbmdlX3VuYXZhaWxhYmxlX3RpdGxlID8gY29uZmlnLmkxOG4uZGVtb19pbWFnZV9jaGFuZ2VfdW5hdmFpbGFibGVfdGl0bGUgOiAnJztcblx0XHRvcGVuX2Jvb2tpbmdfcmVzb3VyY2VfbWVzc2FnZV9kaWFsb2coIG1lc3NhZ2UsIG1lc3NhZ2VfdGl0bGUsIG1lZGlhX2J1dHRvbiApO1xuXHR9XG5cblx0LyoqXG5cdCAqIE1vdW50IHRoZSBsb2NhbGl6ZWQgY2F0YWxvZyBjb25maWd1cmF0aW9uIGFmdGVyIHRoZSBkb2N1bWVudCBpcyByZWFkeS5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIG1vdW50X2Jvb2tpbmdfcmVzb3VyY2VzX2NhdGFsb2coKSB7XG5cdFx0dmFyIGNvbmZpZyA9IHdpbmRvdy53cGJjX2NhdGFsb2dfYm9va2luZ19yZXNvdXJjZXNfY29uZmlnO1xuXHRcdHZhciBtb3VudF9lbGVtZW50O1xuXG5cdFx0aWYgKCAhIGNvbmZpZyB8fCAhIHdpbmRvdy53cGJjX3VpX2NhdGFsb2cgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy53cGJjX3VpX2NhdGFsb2cubW91bnQgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bW91bnRfZWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBjb25maWcubW91bnRfaWQgKTtcblx0XHRpZiAoICEgbW91bnRfZWxlbWVudCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRtb3VudF9lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOnVpLWNhdGFsb2ctcmVuZGVyZWQnLCBoYW5kbGVfY2F0YWxvZ19yZW5kZXJlZCApO1xuXHRcdG1vdW50X2VsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6dWktY2F0YWxvZy1iZWZvcmUtcmVuZGVyJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0Y2xvc2VfZGV0YWlsc19yb3coIGZhbHNlICk7XG5cdFx0fSApO1xuXHRcdG1vdW50X2VsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6dWktY2F0YWxvZy1oaWVyYXJjaHktY2hhbmdlJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0Y2xvc2VfZGV0YWlsc19yb3coIGZhbHNlICk7XG5cdFx0XHRzeW5jaHJvbml6ZV9jYXJkX2dyb3VwX3BhbmVscyggbW91bnRfZWxlbWVudCApO1xuXHRcdH0gKTtcblx0XHRtb3VudF9lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOnVpLWNhdGFsb2ctc2VsZWN0aW9uLWNoYW5nZScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHRoYW5kbGVfaW5zcGVjdG9yX3NlbGVjdGlvbl9jaGFuZ2UoIGV2ZW50LCBjb25maWcgKTtcblx0XHR9ICk7XG5cdFx0bW91bnRfZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzp1aS1jYXRhbG9nLXNlbGVjdGlvbi1yZXN0b3JlZCcsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHRoYW5kbGVfaW5zcGVjdG9yX3NlbGVjdGlvbl9jaGFuZ2UoIGV2ZW50LCBjb25maWcgKTtcblx0XHR9ICk7XG5cdFx0bW91bnRfZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBwcm90ZWN0X2lubGluZV9kcmFmdHNfZnJvbV9jYXRhbG9nX2NvbnRyb2xzLCB0cnVlICk7XG5cdFx0bW91bnRfZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgcHJvdGVjdF9pbmxpbmVfZHJhZnRzX2Zyb21fY2F0YWxvZ19jb250cm9scywgdHJ1ZSApO1xuXHRcdG1vdW50X2VsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgcHJvdGVjdF9pbmxpbmVfZHJhZnRzX2Zyb21fY2F0YWxvZ19jb250cm9scywgdHJ1ZSApO1xuXHRcdG1vdW50X2VsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgaGFuZGxlX2NhdGFsb2dfY2xpY2sgKTtcblx0XHRtb3VudF9lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywgaGFuZGxlX2NhdGFsb2dfa2V5ZG93biApO1xuXHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAncmVzaXplJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0c3luY2hyb25pemVfb3ZlcmZsb3dfdG9vbHRpcHMoIG1vdW50X2VsZW1lbnQgKTtcblx0XHR9ICk7XG5cdFx0Y2F0YWxvZ19jb250cm9sbGVyID0gd2luZG93LndwYmNfdWlfY2F0YWxvZy5tb3VudCggY29uZmlnICk7XG5cdFx0aWYgKCBjYXRhbG9nX2NvbnRyb2xsZXIgKSB7XG5cdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY191aV9jYXRhbG9nLmNyZWF0ZV9pbmxpbmVfZWRpdGluZ193b3JrZmxvdyApIHtcblx0XHRcdFx0aW5saW5lX3dvcmtmbG93X2NvbnRyb2xsZXIgPSB3aW5kb3cud3BiY191aV9jYXRhbG9nLmNyZWF0ZV9pbmxpbmVfZWRpdGluZ193b3JrZmxvdyggbW91bnRfZWxlbWVudCwge1xuXHRcdFx0XHRcdGJhcl9zZWxlY3RvcjogJ1tkYXRhLXdwYmMtY2F0YWxvZy1pbmxpbmUtYmFyXScsXG5cdFx0XHRcdFx0Y2FuY2VsX3NlbGVjdG9yOiAnW2RhdGEtd3BiYy1jYXRhbG9nLWlubGluZS1jYW5jZWxdJyxcblx0XHRcdFx0XHRjb250cm9sc19yb290OiBkb2N1bWVudCxcblx0XHRcdFx0XHRjb3VudF9zZWxlY3RvcjogJ1tkYXRhLXdwYmMtY2F0YWxvZy1pbmxpbmUtY291bnRdJyxcblx0XHRcdFx0XHRwYWdlX2VsZW1lbnQ6IG1vdW50X2VsZW1lbnQubWF0Y2hlcyggJy53cGJjX2Jvb2tpbmdfcmVzb3VyY2VzX3BhZ2UnICkgPyBtb3VudF9lbGVtZW50IDogbW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYm9va2luZ19yZXNvdXJjZXNfcGFnZScgKSxcblx0XHRcdFx0XHRwcm90ZWN0ZWRfc2VsZWN0b3I6ICdbZGF0YS13cGJjLWNhdGFsb2ctYm9va2luZy1yZXNvdXJjZS1jcmVhdGVdJyxcblx0XHRcdFx0XHRyZXZpZXdfc2VsZWN0b3I6ICdbZGF0YS13cGJjLWNhdGFsb2ctaW5saW5lLXJldmlld10nLFxuXHRcdFx0XHRcdHRvZ2dsZV9sYWJlbF9zZWxlY3RvcjogJ1tkYXRhLXdwYmMtY2F0YWxvZy1pbmxpbmUtdG9nZ2xlLWxhYmVsXScsXG5cdFx0XHRcdFx0dG9nZ2xlX3NlbGVjdG9yOiAnW2RhdGEtd3BiYy1jYXRhbG9nLWlubGluZS10b2dnbGVdJ1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cdFx0XHRyZW5kZXJfYm9va2luZ19yZXNvdXJjZXNfZmlsdGVycyggY29uZmlnICk7XG5cdFx0XHRyZW5kZXJfYm9va2luZ19yZXNvdXJjZXNfdG9vbGJhciggY29uZmlnICk7XG5cdFx0XHRyZW5kZXJfaW5saW5lX2JhciggY29uZmlnICk7XG5cdFx0XHRzeW5jaHJvbml6ZV9pbmxpbmVfY29udHJvbHMoIGNvbmZpZyApO1xuXHRcdFx0bW91bnRfaW5zcGVjdG9yX3NoZWxsKCBjb25maWcgKTtcblx0XHR9XG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfZGVmaW5lX3RpcHB5X3Rvb2x0aXBzICkge1xuXHRcdFx0d2luZG93LndwYmNfZGVmaW5lX3RpcHB5X3Rvb2x0aXBzKCAnW2RhdGEtd3BiYy1jYXRhbG9nLWJvb2tpbmctcmVzb3VyY2UtdXBncmFkZV0nICk7XG5cdFx0fVxuXG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6Ym9va2luZy1yZXNvdXJjZS1hY3Rpb24nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0dmFyIGRldGFpbCA9IGV2ZW50ICYmIGV2ZW50LmRldGFpbCA/IGV2ZW50LmRldGFpbCA6IHt9O1xuXHRcdFx0aWYgKCAnZWRpdF9yZXNvdXJjZScgPT09IGRldGFpbC5hY3Rpb24gKSB7XG5cdFx0XHRcdG9wZW5faW5zcGVjdG9yKCBjb25maWcsICdlZGl0JywgTnVtYmVyKCBkZXRhaWwucmVzb3VyY2VfaWQgKSB8fCAwLCBkb2N1bWVudC5hY3RpdmVFbGVtZW50ICk7XG5cdFx0XHR9IGVsc2UgaWYgKCAncHVibGlzaF9yZXNvdXJjZScgPT09IGRldGFpbC5hY3Rpb24gKSB7XG5cdFx0XHRcdG9wZW5faW5zcGVjdG9yKCBjb25maWcsICdlZGl0JywgTnVtYmVyKCBkZXRhaWwucmVzb3VyY2VfaWQgKSB8fCAwLCBkb2N1bWVudC5hY3RpdmVFbGVtZW50LCAnc2hvcnRjb2RlX3B1Ymxpc2hpbmcnICk7XG5cdFx0XHR9IGVsc2UgaWYgKCAnYWRqdXN0X2NhcGFjaXR5JyA9PT0gZGV0YWlsLmFjdGlvbiApIHtcblx0XHRcdFx0b3Blbl9jYXBhY2l0eV9lZGl0b3IoIGNvbmZpZywgTnVtYmVyKCBkZXRhaWwucmVzb3VyY2VfaWQgKSB8fCAwLCBkb2N1bWVudC5hY3RpdmVFbGVtZW50ICk7XG5cdFx0XHR9IGVsc2UgaWYgKCAnZGVsZXRlX3Jlc291cmNlJyA9PT0gZGV0YWlsLmFjdGlvbiApIHtcblx0XHRcdFx0b3Blbl9kZWxldGVfcmV2aWV3KCBjb25maWcsIFsgTnVtYmVyKCBkZXRhaWwucmVzb3VyY2VfaWQgKSB8fCAwIF0sIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQsIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHRwcm90ZWN0X2RlbW9fcmVzb3VyY2VfaW1hZ2VfY2hhbmdlKCBldmVudCwgY29uZmlnICk7XG5cdFx0fSwgdHJ1ZSApO1xuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHR2YXIgaW5saW5lX3RvZ2dsZSA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1jYXRhbG9nLWlubGluZS10b2dnbGVdJyApO1xuXHRcdFx0dmFyIGlubGluZV9jYW5jZWwgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtY2F0YWxvZy1pbmxpbmUtY2FuY2VsXScgKTtcblx0XHRcdHZhciBpbmxpbmVfcmV2aWV3ID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWNhdGFsb2ctaW5saW5lLXJldmlld10nICk7XG5cdFx0XHR2YXIgY3JlYXRlX2J1dHRvbiA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1jYXRhbG9nLWJvb2tpbmctcmVzb3VyY2UtY3JlYXRlXScgKTtcblx0XHRcdHZhciB1cGdyYWRlX2J1dHRvbiA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1jYXRhbG9nLWJvb2tpbmctcmVzb3VyY2UtdXBncmFkZV0nICk7XG5cdFx0XHR2YXIgY2FuY2VsX2J1dHRvbiA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1jYW5jZWxdJyApO1xuXHRcdFx0dmFyIHJlbW92ZV9pbWFnZV9idXR0b24gPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1yZW1vdmUtaW1hZ2VdJyApO1xuXHRcdFx0dmFyIHNob3J0Y29kZV9idXR0b24gPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1zaG9ydGNvZGUtY29tbWFuZF0nICk7XG5cdFx0XHR2YXIgcmVzb3VyY2Vfcm93ID0gZ2V0X3Jlc291cmNlX2l0ZW1fY29udGFpbmVyKCBldmVudC50YXJnZXQgKTtcblx0XHRcdHZhciBzZWxlY3Rpb25fYWN0aW9uID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWNhdGFsb2ctc2VsZWN0aW9uLWFjdGlvbl0nICk7XG5cdFx0XHRpZiAoIGlubGluZV90b2dnbGUgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHN0YXJ0X2lubGluZV9tb2RlKCBjb25maWcgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBpbmxpbmVfY2FuY2VsICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRzeW5jaHJvbml6ZV9pbmxpbmVfZHJhZnRzKCBjb25maWcgKTtcblx0XHRcdFx0aWYgKCAhIGlubGluZV9zdGF0ZS5jaGFuZ2VkX3Jvd3MubGVuZ3RoIHx8IHdpbmRvdy5jb25maXJtKCBjb25maWcuaTE4bi5pbmxpbmVfZGlzY2FyZCB8fCAnJyApICkge1xuXHRcdFx0XHRcdGxlYXZlX2lubGluZV9tb2RlKCBjb25maWcsIHRydWUsICcnICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBpbmxpbmVfcmV2aWV3ICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRwcmV2aWV3X2lubGluZV9jaGFuZ2VzKCBjb25maWcsIGlubGluZV9yZXZpZXcgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBzZWxlY3Rpb25fYWN0aW9uICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRpZiAoICdidWxrX2VkaXQnID09PSBzZWxlY3Rpb25fYWN0aW9uLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1jYXRhbG9nLXNlbGVjdGlvbi1hY3Rpb24nICkgKSB7XG5cdFx0XHRcdFx0b3Blbl9idWxrX2VkaXRvciggY29uZmlnLCBzZWxlY3Rpb25fYWN0aW9uICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0b3Blbl9kZWxldGVfcmV2aWV3KCBjb25maWcsIGdldF9zZWxlY3RlZF9yZXNvdXJjZV9pZHMoIGNvbmZpZyApLCBzZWxlY3Rpb25fYWN0aW9uLCB0cnVlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBzaG9ydGNvZGVfYnV0dG9uICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR2YXIgc2hvcnRjb2RlX3Jlc291cmNlX2lkID0gTnVtYmVyKCBzaG9ydGNvZGVfYnV0dG9uLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWlkJyApIHx8IDAgKTtcblx0XHRcdFx0dmFyIHNob3J0Y29kZV9jb21tYW5kID0gc2hvcnRjb2RlX2J1dHRvbi5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1zaG9ydGNvZGUtY29tbWFuZCcgKSB8fCAnJztcblx0XHRcdFx0dmFyIHNob3J0Y29kZV92YWx1ZSA9IGdldF9ib29raW5nX3Jlc291cmNlX3Nob3J0Y29kZSggc2hvcnRjb2RlX3Jlc291cmNlX2lkLCBzaG9ydGNvZGVfYnV0dG9uICk7XG5cdFx0XHRcdGlmICggJ2NvcHknID09PSBzaG9ydGNvZGVfY29tbWFuZCApIHtcblx0XHRcdFx0XHRjb3B5X2RldGFpbHNfdmFsdWUoIHNob3J0Y29kZV92YWx1ZSwgc2hvcnRjb2RlX2J1dHRvbiwgY29uZmlnICk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoICdjdXN0b21pemUnID09PSBzaG9ydGNvZGVfY29tbWFuZCApIHtcblx0XHRcdFx0XHRjdXN0b21pemVfYm9va2luZ19yZXNvdXJjZV9zaG9ydGNvZGUoIHNob3J0Y29kZV9yZXNvdXJjZV9pZCwgc2hvcnRjb2RlX3ZhbHVlICk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoICdwdWJsaXNoJyA9PT0gc2hvcnRjb2RlX2NvbW1hbmQgKSB7XG5cdFx0XHRcdFx0cHVibGlzaF9ib29raW5nX3Jlc291cmNlX3Nob3J0Y29kZSggc2hvcnRjb2RlX3Jlc291cmNlX2lkLCBzaG9ydGNvZGVfdmFsdWUsIHNob3J0Y29kZV9idXR0b24gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGNyZWF0ZV9idXR0b24gKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdG9wZW5faW5zcGVjdG9yKCBjb25maWcsICdjcmVhdGUnLCAwLCBjcmVhdGVfYnV0dG9uICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggdXBncmFkZV9idXR0b24gKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdG9wZW5fYm9va2luZ19yZXNvdXJjZV91cGdyYWRlX2RpYWxvZyggdXBncmFkZV9idXR0b24gKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjYW5jZWxfYnV0dG9uICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRpZiAoICdpbmxpbmVfcmV2aWV3JyA9PT0gaW5zcGVjdG9yX21vZGUgKSB7XG5cdFx0XHRcdFx0aW5zcGVjdG9yX2RpcnR5ID0gZmFsc2U7XG5cdFx0XHRcdFx0Y2xvc2VfaW5zcGVjdG9yKCBjb25maWcsIGZhbHNlICk7XG5cdFx0XHRcdFx0aW5saW5lX3N0YXRlLnJldmlld190b2tlbiA9ICcnO1xuXHRcdFx0XHRcdHN5bmNocm9uaXplX2lubGluZV9jb250cm9scyggY29uZmlnICk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoICdjYXBhY2l0eV9yZXZpZXcnID09PSBpbnNwZWN0b3JfbW9kZSAmJiBpbnNwZWN0b3JfY2FwYWNpdHlfY29udGV4dCApIHtcblx0XHRcdFx0XHR2YXIgcmV2aWV3ZWRfdGFyZ2V0X2NhcGFjaXR5ID0gaW5zcGVjdG9yX2NhcGFjaXR5X3RhcmdldDtcblx0XHRcdFx0XHR2YXIgcmV2aWV3ZWRfZGV0YWNoX2lkcyA9IGluc3BlY3Rvcl9jYXBhY2l0eV9kZXRhY2hfaWRzLnNsaWNlKCk7XG5cdFx0XHRcdFx0dmFyIHJldmlld2VkX2RlY3JlYXNlX2FjdGlvbiA9IGluc3BlY3Rvcl9jYXBhY2l0eV9kZWNyZWFzZV9hY3Rpb247XG5cdFx0XHRcdFx0aW5zcGVjdG9yX2RpcnR5ID0gZmFsc2U7XG5cdFx0XHRcdFx0cmVuZGVyX2NhcGFjaXR5X2VkaXRvciggY29uZmlnLCBpbnNwZWN0b3JfY2FwYWNpdHlfY29udGV4dCApO1xuXHRcdFx0XHRcdGluc3BlY3Rvcl9jYXBhY2l0eV90YXJnZXQgPSByZXZpZXdlZF90YXJnZXRfY2FwYWNpdHk7XG5cdFx0XHRcdFx0aW5zcGVjdG9yX2NhcGFjaXR5X2RldGFjaF9pZHMgPSByZXZpZXdlZF9kZXRhY2hfaWRzO1xuXHRcdFx0XHRcdGluc3BlY3Rvcl9jYXBhY2l0eV9kZWNyZWFzZV9hY3Rpb24gPSByZXZpZXdlZF9kZWNyZWFzZV9hY3Rpb247XG5cdFx0XHRcdFx0c3luY2hyb25pemVfY2FwYWNpdHlfZWRpdG9yKCBjb25maWcgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjbG9zZV9pbnNwZWN0b3IoIGNvbmZpZywgdHJ1ZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggcmVtb3ZlX2ltYWdlX2J1dHRvbiApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0dmFyIGltYWdlX2ZpZWxkID0gcmVtb3ZlX2ltYWdlX2J1dHRvbi5jbG9zZXN0KCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWZpZWxkLXdyYXBdJyApLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtZmllbGQ9XCJwaWN0dXJlX3VybFwiXScgKTtcblx0XHRcdFx0aWYgKCBpbWFnZV9maWVsZCApIHtcblx0XHRcdFx0XHRpbWFnZV9maWVsZC52YWx1ZSA9ICcnO1xuXHRcdFx0XHRcdHN5bmNocm9uaXplX2luc3BlY3Rvcl9pbWFnZSggaW1hZ2VfZmllbGQgKTtcblx0XHRcdFx0XHRzeW5jaHJvbml6ZV9pbnNwZWN0b3JfZGlydHlfc3RhdGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgaW5saW5lX3N0YXRlLmFjdGl2ZSAmJiByZXNvdXJjZV9yb3cgJiYgISBldmVudC50YXJnZXQuY2xvc2VzdCggJ2EsIGJ1dHRvbiwgaW5wdXQsIHNlbGVjdCwgdGV4dGFyZWEsIHN1bW1hcnksIGRldGFpbHMsIGxhYmVsJyApICkge1xuXHRcdFx0XHRvcGVuX2luc3BlY3RvciggY29uZmlnLCAnZWRpdCcsIE51bWJlciggcmVzb3VyY2Vfcm93LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWlkJyApICkgfHwgMCwgcmVzb3VyY2Vfcm93ICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHRpZiAoIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy1jYXRhbG9nLWNhcGFjaXR5LXRhcmdldF0sIFtkYXRhLXdwYmMtY2F0YWxvZy1jYXBhY2l0eS1yYW5nZV0nICkgKSB7XG5cdFx0XHRcdHZhciBjb250ZXh0ID0gaW5zcGVjdG9yX2NhcGFjaXR5X2NvbnRleHQgfHwge307XG5cdFx0XHRcdHZhciBtaW5pbXVtID0gTnVtYmVyKCBjb250ZXh0Lm1pbmltdW1fY2FwYWNpdHkgKSB8fCAxO1xuXHRcdFx0XHR2YXIgbWF4aW11bSA9IE51bWJlciggY29udGV4dC5tYXhpbXVtX2NhcGFjaXR5ICkgfHwgbWluaW11bTtcblx0XHRcdFx0dmFyIHJlcXVlc3RlZF9jYXBhY2l0eSA9IE1hdGgucm91bmQoIE51bWJlciggZXZlbnQudGFyZ2V0LnZhbHVlICkgfHwgbWluaW11bSApO1xuXG5cdFx0XHRcdGluc3BlY3Rvcl9jYXBhY2l0eV90YXJnZXQgPSBNYXRoLm1heCggbWluaW11bSwgTWF0aC5taW4oIG1heGltdW0sIHJlcXVlc3RlZF9jYXBhY2l0eSApICk7XG5cdFx0XHRcdHN5bmNocm9uaXplX2NhcGFjaXR5X2VkaXRvciggY29uZmlnICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggZXZlbnQudGFyZ2V0Lm1hdGNoZXMoICdbZGF0YS13cGJjLWNhdGFsb2ctaW5saW5lLWZpZWxkXScgKSApIHtcblx0XHRcdFx0c3luY2hyb25pemVfaW5saW5lX2RyYWZ0cyggY29uZmlnICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggZXZlbnQudGFyZ2V0Lm1hdGNoZXMoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtYnVsay12YWx1ZV0sIFtkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1idWxrLXJhbmdlXScgKSApIHtcblx0XHRcdFx0c3luY2hyb25pemVfYnVsa19lZGl0b3IoIGV2ZW50LnRhcmdldCApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLXJhbmdlXScgKSApIHtcblx0XHRcdFx0c3luY2hyb25pemVfaW5zcGVjdG9yX251bWJlcl9mcm9tX3JhbmdlKCBldmVudC50YXJnZXQgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1pbnNwZWN0b3ItZm9ybV0gW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWZpZWxkXScgKSApIHtcblx0XHRcdFx0aWYgKCAncGljdHVyZV91cmwnID09PSBldmVudC50YXJnZXQuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtZmllbGQnICkgKSB7XG5cdFx0XHRcdFx0c3luY2hyb25pemVfaW5zcGVjdG9yX2ltYWdlKCBldmVudC50YXJnZXQgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICdudW1iZXInID09PSBldmVudC50YXJnZXQudHlwZSApIHtcblx0XHRcdFx0XHRzeW5jaHJvbml6ZV9pbnNwZWN0b3JfbnVtZXJpY19yYW5nZSggZXZlbnQudGFyZ2V0LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWZpZWxkJyApIHx8ICcnICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0c3luY2hyb25pemVfaW5zcGVjdG9yX2RpcnR5X3N0YXRlKCk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0aWYgKCBnZXRfZGVsZXRlX3Jldmlld193b3JrZmxvdygpICYmIGdldF9kZWxldGVfcmV2aWV3X3dvcmtmbG93KCkuaGFuZGxlX2NoYW5nZSggZXZlbnQgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtY2F0YWxvZy1jYXBhY2l0eS1kZWNyZWFzZS1hY3Rpb25dJyApICkge1xuXHRcdFx0XHRpbnNwZWN0b3JfY2FwYWNpdHlfZGVjcmVhc2VfYWN0aW9uID0gJ2RlbGV0ZScgPT09IGV2ZW50LnRhcmdldC52YWx1ZSA/ICdkZWxldGUnIDogJ2RldGFjaCc7XG5cdFx0XHRcdHN5bmNocm9uaXplX2NhcGFjaXR5X2VkaXRvciggY29uZmlnICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggZXZlbnQudGFyZ2V0Lm1hdGNoZXMoICdbZGF0YS13cGJjLWNhdGFsb2ctY2FwYWNpdHktZGV0YWNoXScgKSApIHtcblx0XHRcdFx0dmFyIGRldGFjaF9pZCA9IE51bWJlciggZXZlbnQudGFyZ2V0LnZhbHVlICkgfHwgMDtcblx0XHRcdFx0aWYgKCBldmVudC50YXJnZXQuY2hlY2tlZCApIHtcblx0XHRcdFx0XHRpZiAoIC0xID09PSBpbnNwZWN0b3JfY2FwYWNpdHlfZGV0YWNoX2lkcy5pbmRleE9mKCBkZXRhY2hfaWQgKSApIHtcblx0XHRcdFx0XHRcdGluc3BlY3Rvcl9jYXBhY2l0eV9kZXRhY2hfaWRzLnB1c2goIGRldGFjaF9pZCApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpbnNwZWN0b3JfY2FwYWNpdHlfZGV0YWNoX2lkcyA9IGluc3BlY3Rvcl9jYXBhY2l0eV9kZXRhY2hfaWRzLmZpbHRlciggZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHsgcmV0dXJuIHJlc291cmNlX2lkICE9PSBkZXRhY2hfaWQ7IH0gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzeW5jaHJvbml6ZV9jYXBhY2l0eV9lZGl0b3IoIGNvbmZpZyApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy1jYXRhbG9nLWlubGluZS1maWVsZF0nICkgKSB7XG5cdFx0XHRcdHN5bmNocm9uaXplX2lubGluZV9kcmFmdHMoIGNvbmZpZyApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWJ1bGstZW5hYmxlXSwgW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWJ1bGstb3BlcmF0aW9uXSwgW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWJ1bGstdmFsdWVdLCBbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtYnVsay1yYW5nZV0nICkgKSB7XG5cdFx0XHRcdHN5bmNocm9uaXplX2J1bGtfZWRpdG9yKCBldmVudC50YXJnZXQgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtY2F0YWxvZy1jYXBhY2l0eS1kZWxldGUtYWNrbm93bGVkZ2VtZW50XScgKSApIHtcblx0XHRcdFx0dmFyIGNhcGFjaXR5X2RlbGV0ZV9idXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1zYXZlXScgKTtcblx0XHRcdFx0dmFyIGNhcGFjaXR5X2Fja25vd2xlZGdlbWVudCA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnLndwYmNfYm9va2luZ19yZXNvdXJjZXNfX2RlbGV0ZV9hY2tub3dsZWRnZW1lbnQnICk7XG5cblx0XHRcdFx0aWYgKCBldmVudC50YXJnZXQuY2hlY2tlZCAmJiBjYXBhY2l0eV9hY2tub3dsZWRnZW1lbnQgKSB7XG5cdFx0XHRcdFx0Y2FwYWNpdHlfYWNrbm93bGVkZ2VtZW50LmNsYXNzTGlzdC5yZW1vdmUoICd3cGJjX2Jvb2tpbmdfcmVzb3VyY2VzX19kZWxldGVfYWNrbm93bGVkZ2VtZW50LS1hdHRlbnRpb24nICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cHVsc2VfZGVsZXRlX2Fja25vd2xlZGdlbWVudCggY2FwYWNpdHlfYWNrbm93bGVkZ2VtZW50ICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBjYXBhY2l0eV9kZWxldGVfYnV0dG9uICkge1xuXHRcdFx0XHRcdGNhcGFjaXR5X2RlbGV0ZV9idXR0b24uZGlzYWJsZWQgPSAhIGV2ZW50LnRhcmdldC5jaGVja2VkO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggZXZlbnQudGFyZ2V0Lm1hdGNoZXMoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtcmFuZ2VdJyApICkge1xuXHRcdFx0XHRzeW5jaHJvbml6ZV9pbnNwZWN0b3JfbnVtYmVyX2Zyb21fcmFuZ2UoIGV2ZW50LnRhcmdldCApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLXJhZGlvLWZpZWxkPVwiY3JlYXRpb25fbW9kZVwiXScgKSApIHtcblx0XHRcdFx0c3luY2hyb25pemVfY3JlYXRlX2luc3BlY3Rvcl9jb250cm9scygpO1xuXHRcdFx0XHRzeW5jaHJvbml6ZV9pbnNwZWN0b3JfZGlydHlfc3RhdGUoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1pbnNwZWN0b3ItZm9ybV0gW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWZpZWxkXScgKSApIHtcblx0XHRcdFx0aWYgKCAnY3JlYXRlJyA9PT0gaW5zcGVjdG9yX21vZGUgKSB7XG5cdFx0XHRcdFx0c3luY2hyb25pemVfY3JlYXRlX2luc3BlY3Rvcl9jb250cm9scygpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHN5bmNocm9uaXplX2luc3BlY3Rvcl9kaXJ0eV9zdGF0ZSgpO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0XHRpZiAoIHdpbmRvdy5qUXVlcnkgKSB7XG5cdFx0XHR3aW5kb3cualF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLm9uKCAnd3BiYzpyaWdodC1zaWRlYmFyLWJlZm9yZS1jb250ZW50LWNvbGxhcHNlLndwYmNDYXRhbG9nQm9va2luZ1Jlc291cmNlcycsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHRcdHZhciBjbG9zaW5nX21vZGUgPSBpbnNwZWN0b3JfbW9kZTtcblxuXHRcdFx0XHRpZiAoIGluc3BlY3Rvcl9tb2RlICYmICEgY2xvc2VfaW5zcGVjdG9yKCBjb25maWcsIHRydWUgKSApIHtcblx0XHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICdpbmxpbmVfcmV2aWV3JyA9PT0gY2xvc2luZ19tb2RlICkge1xuXHRcdFx0XHRcdGlubGluZV9zdGF0ZS5yZXZpZXdfdG9rZW4gPSAnJztcblx0XHRcdFx0XHRzeW5jaHJvbml6ZV9pbmxpbmVfY29udHJvbHMoIGNvbmZpZyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHR3aW5kb3cualF1ZXJ5KCBkb2N1bWVudCApLm9uKCAnd3BiY19tZWRpYV91cGxvYWRfdXJsX3NldCcsICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtZmllbGQ9XCJwaWN0dXJlX3VybFwiXScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0c3luY2hyb25pemVfaW5zcGVjdG9yX2ltYWdlKCB0aGlzICk7XG5cdFx0XHRcdHN5bmNocm9uaXplX2luc3BlY3Rvcl9kaXJ0eV9zdGF0ZSgpO1xuXHRcdFx0fSApO1xuXHRcdFx0d2luZG93LmpRdWVyeSggZG9jdW1lbnQgKS5vbiggJ3dwYmM6cmVzb3VyY2Utc2hvcnRjb2RlLXNlbGVjdGVkJywgZnVuY3Rpb24gKCBldmVudCwgc2VsZWN0aW9uICkge1xuXHRcdFx0XHR2YXIgc2VsZWN0ZWRfcmVzb3VyY2VfaWQgPSBOdW1iZXIoIHNlbGVjdGlvbiAmJiBzZWxlY3Rpb24ucmVzb3VyY2VfaWQgPyBzZWxlY3Rpb24ucmVzb3VyY2VfaWQgOiAwICk7XG5cdFx0XHRcdHZhciBzZWxlY3RlZF9zaG9ydGNvZGUgPSBTdHJpbmcoIHNlbGVjdGlvbiAmJiBzZWxlY3Rpb24uc2hvcnRjb2RlID8gc2VsZWN0aW9uLnNob3J0Y29kZSA6ICcnICk7XG5cdFx0XHRcdHZhciBpbnNwZWN0b3Jfc2hvcnRjb2RlO1xuXG5cdFx0XHRcdGlmICggISBzZWxlY3RlZF9yZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0c3luY2hyb25pemVfYm9va2luZ19yZXNvdXJjZV9zaG9ydGNvZGVfaW5wdXQoIHNlbGVjdGVkX3Jlc291cmNlX2lkLCBzZWxlY3RlZF9zaG9ydGNvZGUgKTtcblx0XHRcdFx0ZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1pZD1cIicgKyBTdHJpbmcoIHNlbGVjdGVkX3Jlc291cmNlX2lkICkgKyAnXCJdW2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLXNob3J0Y29kZS1jb21tYW5kXScgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGFjdGlvbl9idXR0b24gKSB7XG5cdFx0XHRcdFx0YWN0aW9uX2J1dHRvbi5zZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1zaG9ydGNvZGUnLCBzZWxlY3RlZF9zaG9ydGNvZGUgKTtcblx0XHRcdFx0fSApO1xuXHRcdFx0XHR2YXIgZGV0YWlsc19yb3cgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWRldGFpbHMtcm93PVwiJyArIFN0cmluZyggc2VsZWN0ZWRfcmVzb3VyY2VfaWQgKSArICdcIl0nICk7XG5cdFx0XHRcdHZhciBkZXRhaWxzX2NvZGUgPSBkZXRhaWxzX3JvdyA/IGRldGFpbHNfcm93LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtZGV0YWlscy1zZWN0aW9uPVwiYm9va2luZ19wYWdlXCJdIGNvZGUnICkgOiBudWxsO1xuXHRcdFx0XHRpZiAoIGRldGFpbHNfY29kZSApIHtcblx0XHRcdFx0XHRkZXRhaWxzX2NvZGUudGV4dENvbnRlbnQgPSBzZWxlY3RlZF9zaG9ydGNvZGU7XG5cdFx0XHRcdFx0ZGV0YWlsc19jb2RlLnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy11aS1jYXRhbG9nLW92ZXJmbG93LXRvb2x0aXAnLCBzZWxlY3RlZF9zaG9ydGNvZGUgKTtcblx0XHRcdFx0XHRzeW5jaHJvbml6ZV9vdmVyZmxvd190b29sdGlwcyggZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIGNvbmZpZy5tb3VudF9pZCApICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBzZWxlY3RlZF9yZXNvdXJjZV9pZCA9PT0gaW5zcGVjdG9yX3Jlc291cmNlX2lkICkge1xuXHRcdFx0XHRcdGluc3BlY3Rvcl9zaG9ydGNvZGUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWluc3BlY3Rvci1mb3JtXSAud3BiY19jYXRhbG9nX2Jvb2tpbmdfcmVzb3VyY2VzX19lZGl0b3JfY29kZScgKTtcblx0XHRcdFx0XHRpZiAoIGluc3BlY3Rvcl9zaG9ydGNvZGUgKSB7XG5cdFx0XHRcdFx0XHRpbnNwZWN0b3Jfc2hvcnRjb2RlLnZhbHVlID0gc2VsZWN0ZWRfc2hvcnRjb2RlO1xuXHRcdFx0XHRcdFx0c3luY2hyb25pemVfaW5zcGVjdG9yX2RpcnR5X3N0YXRlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fVxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdzdWJtaXQnLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0aWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtY2F0YWxvZy1pbmxpbmUtcmV2aWV3LWZvcm1dJyApICkge1xuXHRcdFx0XHRhcHBseV9pbmxpbmVfY2hhbmdlcyggZXZlbnQsIGNvbmZpZyApO1xuXHRcdFx0fSBlbHNlIGlmICggZXZlbnQudGFyZ2V0Lm1hdGNoZXMoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtaW5zcGVjdG9yLWZvcm1dJyApICkge1xuXHRcdFx0XHRzdWJtaXRfaW5zcGVjdG9yKCBldmVudCwgY29uZmlnICk7XG5cdFx0XHR9IGVsc2UgaWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1idWxrLWZvcm1dLCBbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtYnVsay1yZXZpZXctZm9ybV0sIFtkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1kZWxldGUtZm9ybV0sIFtkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1jYXBhY2l0eS1mb3JtXScgKSApIHtcblx0XHRcdFx0c3VibWl0X3Jldmlld2VkX2luc3BlY3RvciggZXZlbnQsIGNvbmZpZyApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ2JlZm9yZXVubG9hZCcsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHRpZiAoIGluc3BlY3Rvcl9kaXJ0eSB8fCBpbnNwZWN0b3JfbXV0YXRpb25faW5fcHJvZ3Jlc3MgfHwgKCBpbmxpbmVfc3RhdGUuYWN0aXZlICYmIGlubGluZV9zdGF0ZS5jaGFuZ2VkX3Jvd3MubGVuZ3RoICkgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGV2ZW50LnJldHVyblZhbHVlID0gJyc7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHR9XG5cblx0aWYgKCAnbG9hZGluZycgPT09IGRvY3VtZW50LnJlYWR5U3RhdGUgKSB7XG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ0RPTUNvbnRlbnRMb2FkZWQnLCBtb3VudF9ib29raW5nX3Jlc291cmNlc19jYXRhbG9nICk7XG5cdH0gZWxzZSB7XG5cdFx0bW91bnRfYm9va2luZ19yZXNvdXJjZXNfY2F0YWxvZygpO1xuXHR9XG59KCB3aW5kb3csIGRvY3VtZW50ICkgKTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0UsV0FBV0EsTUFBTSxFQUFFQyxRQUFRLEVBQUc7RUFDL0IsWUFBWTs7RUFFWixJQUFJQyxrQkFBa0IsR0FBRyxJQUFJO0VBQzdCLElBQUlDLDBCQUEwQixHQUFHLElBQUk7RUFDckMsSUFBSUMsaUNBQWlDLEdBQUcsSUFBSTtFQUM1QyxJQUFJQyxpQ0FBaUMsR0FBRyxJQUFJO0VBQzVDLElBQUlDLDZCQUE2QixHQUFHLElBQUk7RUFDeEMsSUFBSUMsZ0JBQWdCLEdBQUcsSUFBSTtFQUMzQixJQUFJQyx3QkFBd0IsR0FBRyxJQUFJO0VBQ25DLElBQUlDLHdCQUF3QixHQUFHLENBQUM7RUFDaEMsSUFBSUMsbUJBQW1CLEdBQUcsQ0FBQztFQUMzQixJQUFJQyxxQkFBcUIsR0FBRyxJQUFJO0VBQ2hDLElBQUlDLHVCQUF1QixHQUFHLEVBQUU7RUFDaEMsSUFBSUMsZUFBZSxHQUFHLEtBQUs7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
