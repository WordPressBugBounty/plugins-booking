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
  var launch_intent_handled = false;
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
   * Remove a consumed read-only launch parameter without changing navigation.
   *
   * This prevents a normal reload from reopening the guided action menu. The catalog's
   * other request-local display arguments remain in place and no preference
   * save action is introduced.
   *
   * @param {Object} config Catalog configuration.
   * @return {void}
   */
  function consume_initial_launch_parameter(config) {
    var launch_intent = config && config.launch_intent ? config.launch_intent : {};
    var query_parameter = String(launch_intent.query_parameter || '');
    var current_url;
    if (!query_parameter || !window.history || 'function' !== typeof window.history.replaceState || 'function' !== typeof window.URL) {
      return;
    }
    try {
      current_url = new window.URL(window.location.href);
      current_url.searchParams.delete(query_parameter);
      window.history.replaceState(window.history.state, '', current_url.toString());
    } catch (error) {
      // A malformed administration URL must not prevent normal catalog use.
    }
  }

  /**
   * Determine whether one authorized Resource DTO exposes a named action.
   *
   * @param {Object} resource  Authorized Resource list DTO.
   * @param {string} action_id Stable domain action identifier.
   * @return {boolean} True when the server-authorized action is present.
   */
  function resource_exposes_action(resource, action_id) {
    var action_items = resource && Array.isArray(resource.action_items) ? resource.action_items : [];
    var action_index;
    for (action_index = 0; action_index < action_items.length; action_index += 1) {
      if (action_id === String(action_items[action_index].id || '')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Open one rendered Resource action menu and focus a named action.
   *
   * The shared controller owns menu mechanics. This domain adapter selects
   * only a Resource and action already authorized in the server response.
   *
   * @param {Object} config      Registered catalog configuration.
   * @param {number} resource_id Authorized Booking Resource ID.
   * @param {string} action_id   Authorized domain action identifier.
   * @return {boolean} True when the menu opened and the action received focus.
   */
  function open_resource_action_menu(config, resource_id, action_id) {
    var mount_element = config && config.mount_id ? document.getElementById(config.mount_id) : null;
    var actions_controller = mount_element && mount_element._wpbc_ui_catalog_actions_controller ? mount_element._wpbc_ui_catalog_actions_controller : null;
    if (!actions_controller || 'function' !== typeof actions_controller.open_item) {
      return false;
    }
    return actions_controller.open_item(String(resource_id), String(action_id || ''));
  }

  /**
   * Open the action menu for the first server-authorized Resource DTO.
   *
   * The URL carries presentation intent only. It never supplies a trusted
   * Resource ID. Activating the focused Publish action follows the normal
   * domain handler, which repeats capability and ownership checks before
   * opening publishing tools.
   *
   * @param {Object} config   Catalog configuration.
   * @param {Object} response Normalized authorized catalog response.
   * @return {void}
   */
  function open_initial_launch_intent(config, response) {
    var action_id = config && config.launch_intent ? String(config.launch_intent.action || '') : '';
    var resource;
    var resource_index;
    if (launch_intent_handled || 'publish_resource' !== action_id || !response || !Array.isArray(response.items)) {
      return;
    }
    launch_intent_handled = true;
    consume_initial_launch_parameter(config);
    for (resource_index = 0; resource_index < response.items.length; resource_index += 1) {
      if (resource_exposes_action(response.items[resource_index], action_id)) {
        resource = response.items[resource_index];
        break;
      }
    }
    if (!resource || !Number(resource.id)) {
      show_admin_message(config && config.i18n ? config.i18n.publishing_launch_unavailable || '' : '', 'error', 7000);
      return;
    }
    window.setTimeout(function () {
      if (!open_resource_action_menu(config, Number(resource.id), action_id)) {
        show_admin_message(config && config.i18n ? config.i18n.publishing_launch_unavailable || '' : '', 'error', 7000);
      }
    }, 0);
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
    open_initial_launch_intent(config, catalog_response);
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1jYXRhbG9nLWJvb2tpbmctcmVzb3VyY2VzL19vdXQvYm9va2luZ19yZXNvdXJjZXNfY2F0YWxvZy5qcyIsIm5hbWVzIjpbIndpbmRvdyIsImRvY3VtZW50IiwiY2F0YWxvZ19jb250cm9sbGVyIiwiaW5saW5lX3dvcmtmbG93X2NvbnRyb2xsZXIiLCJpbmxpbmVfcmV2aWV3X3dvcmtmbG93X2NvbnRyb2xsZXIiLCJkZWxldGVfcmV2aWV3X3dvcmtmbG93X2NvbnRyb2xsZXIiLCJpbnNwZWN0b3Jfd29ya2Zsb3dfY29udHJvbGxlciIsImNhdGFsb2dfcmVzcG9uc2UiLCJkZXRhaWxzX2Fib3J0X2NvbnRyb2xsZXIiLCJkZXRhaWxzX3JlcXVlc3Rfc2VxdWVuY2UiLCJkZXRhaWxzX3Jlc291cmNlX2lkIiwiZGV0YWlsc190b2dnbGVfYnV0dG9uIiwicGVuZGluZ19mb2N1c19kaXJlY3Rpb24iLCJpbnNwZWN0b3JfZGlydHkiLCJpbnNwZWN0b3JfZm9jdXNfdGFyZ2V0IiwiaW5zcGVjdG9yX21vZGUiLCJpbnNwZWN0b3JfbXV0YXRpb25faW5fcHJvZ3Jlc3MiLCJpbnNwZWN0b3JfbXV0YXRpb25fcmVxdWVzdF9zZXF1ZW5jZSIsImluc3BlY3Rvcl9vcmlnaW5hbF9maWVsZHMiLCJpbnNwZWN0b3JfcmVxdWVzdF9zZXF1ZW5jZSIsImluc3BlY3Rvcl9yZXNvdXJjZV9pZCIsImluc3BlY3Rvcl9yZXNvdXJjZV9pZHMiLCJpbnNwZWN0b3JfYnVsa19vcGVyYXRpb25zIiwiaW5zcGVjdG9yX3Jldmlld190b2tlbiIsImluc3BlY3Rvcl9zZWxlY3Rpb25fc3RhbGUiLCJpbnNwZWN0b3JfdHJhY2tzX3NlbGVjdGlvbiIsImluc3BlY3Rvcl9jYXBhY2l0eV9jb250ZXh0IiwiaW5zcGVjdG9yX2NhcGFjaXR5X2RldGFjaF9pZHMiLCJpbnNwZWN0b3JfY2FwYWNpdHlfZGVjcmVhc2VfYWN0aW9uIiwiaW5zcGVjdG9yX2NhcGFjaXR5X3RhcmdldCIsInBlbmRpbmdfaGlnaGxpZ2h0X2lkcyIsImxhdW5jaF9pbnRlbnRfaGFuZGxlZCIsImlubGluZV9zdGF0ZSIsImFjdGl2ZSIsImNoYW5nZWRfcm93cyIsImxvYWRpbmciLCJyZXF1ZXN0X3NlcXVlbmNlIiwicmV2aWV3X3Rva2VuIiwiaXNfdHJ1ZV9mbGFnIiwiZmxhZ192YWx1ZSIsIlN0cmluZyIsInRvTG93ZXJDYXNlIiwiZm9ybWF0X21lc3NhZ2UiLCJ0ZW1wbGF0ZSIsInZhbHVlcyIsIm1lc3NhZ2UiLCJmb3JFYWNoIiwicmVwbGFjZW1lbnQiLCJyZXBsYWNlbWVudF9pbmRleCIsInBsYWNlaG9sZGVyIiwiUmVnRXhwIiwicmVwbGFjZSIsImdldF9pbmxpbmVfcmV2aWV3X3dvcmtmbG93Iiwid3BiY191aV9jYXRhbG9nIiwiY3JlYXRlX2lubGluZV9yZXZpZXdfd29ya2Zsb3ciLCJhcHBseV9zZWxlY3RvciIsImNhbmNlbF9zZWxlY3RvciIsInJvb3QiLCJnZXRfZGVsZXRlX3Jldmlld193b3JrZmxvdyIsImNyZWF0ZV9kZWxldGVfcmV2aWV3X3dvcmtmbG93IiwiYWNrbm93bGVkZ2VtZW50X3NlbGVjdG9yIiwiZ2V0X2NoaWxkcmVuX3N1bW1hcnlfbGFiZWwiLCJwYXJlbnRfcmVzb3VyY2UiLCJpMThuIiwiaGllcmFyY2h5Iiwic2VydmVyX2xhYmVsIiwiY2hpbGRyZW5fbGFiZWwiLCJ0cmltIiwiY2hpbGRfY291bnQiLCJNYXRoIiwibWF4IiwiTnVtYmVyIiwicmVuZGVyZWRfY2hpbGRyZW5fY291bnQiLCJsYWJlbF90ZW1wbGF0ZSIsImNoaWxkX2NvdW50X3Npbmd1bGFyIiwiY2hpbGRfY291bnRfcGx1cmFsIiwicmVuZGVyX2NvbXBvbmVudCIsImNvbmZpZyIsInRlbXBsYXRlX3JvbGUiLCJ0ZW1wbGF0ZV9kYXRhIiwiY29tcG9uZW50X3RlbXBsYXRlIiwibG9hZF90ZW1wbGF0ZSIsImVycm9yIiwiZ2V0X2NvbHVtbnMiLCJkaXNwbGF5X3N0YXRlIiwidmlzaWJsZV9vbmx5Iiwic29ydGluZ19zdGF0ZSIsImNvbHVtbl9jb25maWciLCJjb2x1bW5zIiwiZGVmaW5pdGlvbnMiLCJkZWZhdWx0X29yZGVyIiwiQXJyYXkiLCJpc0FycmF5Iiwib3JkZXIiLCJjb2x1bW5fb3JkZXIiLCJzbGljZSIsInZpc2libGVfY29sdW1ucyIsImRlZmF1bHRfdmlzaWJsZSIsImNvbHVtbl9pZCIsImluZGV4T2YiLCJwdXNoIiwiZmlsdGVyIiwibWFwIiwiY29sdW1uX2luZGV4IiwiZGVmaW5pdGlvbiIsImlzX3NvcnRlZCIsInNvcnRfa2V5Iiwic29ydF9ieSIsImFyaWFfc29ydCIsInNvcnRfb3JkZXIiLCJjbGFzc19uYW1lIiwiY2xhc3MiLCJkZWZhdWx0X2luZGV4IiwiaWQiLCJsYWJlbCIsIm1vdmVfbGFiZWwiLCJtb3ZlX2NvbHVtbiIsInJlb3JkZXJhYmxlIiwicmVxdWlyZWQiLCJzb3J0X2ljb24iLCJ2aXNpYmxlIiwiZ2V0X2FjdGl2ZV92aWV3Iiwidmlld19kZWZpbml0aW9ucyIsInZpZXdzIiwiY3VycmVudF92aXNpYmxlIiwibWF0Y2hpbmdfdmlldyIsIk9iamVjdCIsImtleXMiLCJzb21lIiwidmlld19pZCIsInZpZXdfZmllbGRzIiwiZmllbGRzIiwiSlNPTiIsInN0cmluZ2lmeSIsImdldF92aWV3X2RlZmluaXRpb25zIiwiZ2V0X3RlbXBsYXRlX3BhY2tfZGVmaW5pdGlvbnMiLCJsYWJlbHMiLCJjYXJkcyIsImxheW91dF9jYXJkcyIsImNvbXBhY3QiLCJsYXlvdXRfY29tcGFjdCIsInRhYmxlIiwibGF5b3V0X3RhYmxlIiwidGVtcGxhdGVfcGFja3MiLCJ0ZW1wbGF0ZV9wYWNrX2lkIiwicmVuZGVyX2Jvb2tpbmdfcmVzb3VyY2VzX2ZpbHRlcnMiLCJpbml0aWFsX3JlcXVlc3QiLCJtb3VudF9lbGVtZW50IiwiZ2V0RWxlbWVudEJ5SWQiLCJtb3VudF9pZCIsImZpbHRlcnNfdGFyZ2V0IiwicXVlcnlTZWxlY3RvciIsImlubmVySFRNTCIsInJlc291cmNlX3R5cGUiLCJzZWFyY2giLCJzaG93X2ZpbHRlcnMiLCJmZWF0dXJlcyIsInJlc291cmNlX2ZpbHRlcnMiLCJzaG93X3Jlc291cmNlX3R5cGVfZmlsdGVyIiwicmVzb3VyY2VfdHlwZV9maWx0ZXIiLCJyZW5kZXJfYm9va2luZ19yZXNvdXJjZXNfdG9vbGJhciIsInRvb2xiYXJfdGFyZ2V0IiwiYWN0aXZlX3RlbXBsYXRlX3BhY2siLCJ0ZW1wbGF0ZV9wYWNrIiwiZGVmYXVsdF90ZW1wbGF0ZV9wYWNrIiwiYWN0aXZlX3ZpZXciLCJyZWZyZXNoX2NvbnRyb2xzIiwiZmlyc3RFbGVtZW50Q2hpbGQiLCJzeW5jaHJvbml6ZV9vdmVyZmxvd190b29sdGlwcyIsImNhdGFsb2dfbW91bnQiLCJpbml0aWFsaXplX2RldGFpbHNfdG9vbHRpcHMiLCJ0b29sdGlwX3NlbGVjdG9yIiwid3BiY19kZWZpbmVfdGlwcHlfdG9vbHRpcHMiLCJzeW5jaHJvbml6ZV9ib29raW5nX3Jlc291cmNlc190b29sYmFyIiwicmVzcG9uc2UiLCJkaXNwbGF5Iiwic29ydGluZyIsImNvbHVtbl9saXN0Iiwic2VhcmNoX2NvbnRyb2wiLCJ0ZW1wbGF0ZV9wYWNrX2NvbnRyb2wiLCJ0eXBlX2NvbnRyb2wiLCJ2aWV3X2NvbnRyb2wiLCJhY3RpdmVFbGVtZW50IiwidmFsdWUiLCJmaWx0ZXJzIiwiY29sdW1uIiwiY29sdW1uX2NvbnRyb2wiLCJjb2x1bW5faXRlbSIsImNoZWNrZWQiLCJhcHBlbmRDaGlsZCIsInJlbmRlcl9pbmxpbmVfYmFyIiwiaW5saW5lX2hvc3QiLCJyZWdpc3Rlcl9zdGlja3lfYmFyIiwic3luY2hyb25pemVfaW5saW5lX2NvbnRyb2xzIiwiY2hhbmdlZF9jb3VudCIsImxlbmd0aCIsImNvdW50X2xhYmVsIiwiaW5saW5lX2NoYW5nZWRfcm93IiwiaW5saW5lX2NoYW5nZWRfcm93cyIsInN5bmNocm9uaXplIiwiYWN0aXZlX3RvZ2dsZV90ZXh0IiwiaW5saW5lX2VkaXRpbmdfcm93cyIsImJ1c3kiLCJjb3VudF90ZXh0IiwiaW5saW5lX2xvYWRpbmciLCJoYXNfaXRlbXMiLCJpbmFjdGl2ZV90b2dnbGVfdGV4dCIsImVkaXRfcm93cyIsInByb3RlY3RfaW5saW5lX2RyYWZ0c19mcm9tX2NhdGFsb2dfY29udHJvbHMiLCJldmVudCIsInByb3RlY3RfZXZlbnQiLCJzaG93X2lubGluZV9tZXNzYWdlIiwibm90aWNlIiwiaGlkZGVuIiwidGV4dCIsInRleHRDb250ZW50IiwicmVuZGVyX2lubGluZV9yb3ciLCJyb3dfc2NoZW1hIiwicmVzb3VyY2VfaWQiLCJyb3ciLCJyZXNvdXJjZV9maWVsZHMiLCJmaWVsZCIsImNlbGwiLCJjb3B5Iiwid3JhcHBlciIsImNyZWF0ZUVsZW1lbnQiLCJjbGFzc05hbWUiLCJpbnNlcnRBZGphY2VudEhUTUwiLCJyZXBsYWNlV2l0aCIsImNvbGxlY3RfaW5saW5lX2RyYWZ0cyIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJoYXNfY2hhbmdlcyIsImluZGljYXRvcl9ob3N0IiwiY29udHJvbCIsImZpZWxkX2tleSIsImdldEF0dHJpYnV0ZSIsImNsYXNzTGlzdCIsInRvZ2dsZSIsInNldF9yb3dfY2hhbmdlZCIsImlubGluZV9jaGFuZ2VkIiwic3luY2hyb25pemVfaW5saW5lX2RyYWZ0cyIsImxlYXZlX2lubGluZV9tb2RlIiwicmVsb2FkIiwiY2xvc2VfaW5zcGVjdG9yIiwic2hvd19hZG1pbl9tZXNzYWdlIiwibG9hZCIsInN0YXJ0X2lubGluZV9tb2RlIiwicmVzb3VyY2VfaWRzIiwiY29uZmlybSIsImlubGluZV9kaXNjYXJkIiwiY2FuX2Rpc2NhcmRfaW5zcGVjdG9yIiwiY3VzdG9taXplciIsInJlbW92ZUF0dHJpYnV0ZSIsImNsb3NlX2RldGFpbHNfcm93IiwicmVxdWVzdF9pbnNwZWN0b3IiLCJpbmxpbmVfc2NoZW1hX2FjdGlvbiIsInRoZW4iLCJzdWNjZXNzIiwiZGF0YSIsInNjaGVtYSIsIkVycm9yIiwiZ2V0X2luc3BlY3Rvcl9yZXNwb25zZV9tZXNzYWdlIiwiaW5saW5lX2xvYWRfZmFpbGVkIiwicm93cyIsImZpcnN0X2ZpZWxkIiwiZm9jdXMiLCJjYXRjaCIsInByZXZpZXdfaW5saW5lX2NoYW5nZXMiLCJmb2N1c190YXJnZXQiLCJpbnNwZWN0b3Jfd29ya2Zsb3ciLCJnZXRfaW5zcGVjdG9yX3dvcmtmbG93IiwibW91bnQiLCJvcGVuX2xvYWRpbmciLCJpbmxpbmVfcHJldmlld19hY3Rpb24iLCJyZXZpZXdfd29ya2Zsb3ciLCJyZXZpZXdfbW9kZWwiLCJ0YXJnZXQiLCJwcmV2aWV3IiwiaW5saW5lX3Jldmlld19mYWlsZWQiLCJnZXRfaW5zcGVjdG9yX2hvc3QiLCJwcmVwYXJlIiwicmV2aWV3IiwiY2hhbmdlZF9sYWJlbCIsImRlc2NyaXB0aW9uIiwiaW5saW5lX3Jldmlld19kZXNjcmlwdGlvbiIsImZvcm1faWQiLCJtb2RlIiwicGVuZGluZ19tZXNzYWdlIiwicmV2aWV3X2NoYW5nZXNfaGVscCIsInRpdGxlIiwiaW5saW5lX3Jldmlld190aXRsZSIsInNldF9pbnNwZWN0b3Jfc3RhdGUiLCJjb25maWd1cmVfaW5zcGVjdG9yX2Zvb3RlciIsImFwcGx5X2NoYW5nZXMiLCJjYW5fYXBwbHkiLCJmb2N1c19pbnNwZWN0b3JfaGVhZGluZyIsImFwcGx5X2lubGluZV9jaGFuZ2VzIiwiZm9ybSIsInNhdmVfYnV0dG9uIiwicHJldmVudERlZmF1bHQiLCJkaXNhYmxlZCIsImFkZCIsImlubGluZV9hcHBseV9hY3Rpb24iLCJpbmxpbmVfYXBwbHlfZmFpbGVkIiwidXBkYXRlZF9pZHMiLCJkb2N1bWVudEVsZW1lbnQiLCJjb250YWlucyIsInNob3dfaW5zcGVjdG9yX21lc3NhZ2UiLCJyZW1vdmUiLCJyZW5kZXJfYm9va2luZ19yZXNvdXJjZXNfcmVzcG9uc2UiLCJjYXRhbG9nX2hlYWRpbmciLCJjYXJkX2dyb3VwcyIsImNoaWxkcmVuX2J5X3BhcmVudCIsImhlYWRlcl9lbGVtZW50IiwiaGllcmFyY2h5X2VuYWJsZWQiLCJoaWVyYXJjaHlfaXNfZXhwYW5kZWQiLCJpc19jYXJkc19wYWNrIiwicGFyZW50X3Jlc291cmNlcyIsInBhZ2luYXRpb24iLCJwYWdpbmF0aW9uX2VsZW1lbnQiLCJyb3dzX2VsZW1lbnQiLCJpdGVtcyIsImVuYWJsZWQiLCJ3cGJjX3VpX2NhdGFsb2dfaGllcmFyY2h5IiwiZ2V0X2luaXRpYWxfZXhwYW5kZWQiLCJhbGxfZXhwYW5kZWQiLCJzZWxlY3Rpb25fZW5hYmxlZCIsInNlbGVjdGlvbiIsInJlc291cmNlIiwidHlwZSIsInBhcmVudF9pZCIsImFjdGlvbl90YXJnZXQiLCJjbGFzc2ljX2xhYmVsX2NsYXNzZXMiLCJjaGlsZCIsImNvc3QiLCJvd25lciIsInBhcmVudCIsInNpbmdsZSIsImxhYmVsX3RhcmdldCIsInByaWNlX3RhcmdldCIsIm5vX2Rlc2NyaXB0aW9uIiwiYXNzaWduIiwicGFyZW50X2NvbnRleHRfbGFiZWwiLCJyb3dfdmFyaWFudCIsInJvd190ZW1wbGF0ZV9yb2xlIiwidHlwZV9iYWRnZV9sYWJlbCIsImluZGVwZW5kZW50X2xhYmVsIiwiZXhwYW5kYWJsZSIsInBhcmVudF90aXRsZSIsImNoaWxkX29mIiwicmVuZGVyZWRfY2hpbGRfY291bnQiLCJwYXJlbnRfY2hpbGRyZW5fdGVtcGxhdGUiLCJwYXJlbnRfY2hpbGRfbGFiZWwiLCJwYXJlbnRfY2hpbGRyZW5fbGFiZWwiLCJwYXJlbnRfbGFiZWwiLCJjaGlsZF9sYWJlbCIsInJlc291cmNlX3Jvd19kYXRhIiwiY29sbGFwc2VfbGFiZWwiLCJjb2xsYXBzZV9jaGlsZHJlbl9mb3IiLCJjb2xsYXBzZV9jaGlsZHJlbiIsImV4cGFuZF9sYWJlbCIsImV4cGFuZF9jaGlsZHJlbl9mb3IiLCJleHBhbmRfY2hpbGRyZW4iLCJpc19leHBhbmRlZCIsInNlbGVjdGlvbl9sYWJlbCIsInNlbGVjdF9yZXNvdXJjZSIsInRodW1ibmFpbF9sYWJlbCIsInRodW1ibmFpbF90b29sdGlwIiwicmVzb3VyY2Vfcm93X2h0bWwiLCJyZXNvdXJjZV9yb3ciLCJjaGlsZF9yZXNvdXJjZXMiLCJjYXJkX2dyb3VwX2h0bWwiLCJjaGlsZHJlbl9kZXNjcmlwdGlvbiIsImNoaWxkcmVuX2JlbG9uZ190byIsImNoaWxkcmVuX2hlYWRpbmciLCJjaGlsZHJlbl9vZl9jb3VudCIsInBhcmVudF9ub2RlX2lkIiwibm9kZV9pZCIsInN0YWNrX2l0ZW1zIiwibGFzdEVsZW1lbnRDaGlsZCIsInBhcmVudF9zbG90IiwiY2hpbGRyZW5fc2xvdCIsImFyaWFfbGFiZWwiLCJjb2x1bW5fbGFiZWxzIiwiZW1wdHlfbGFiZWwiLCJub19sYWJlbHMiLCJraW5kIiwicHJpY2VfdW5hdmFpbGFibGUiLCJwcmljZSIsImFjdGlvbnMiLCJhY3Rpb25faXRlbXMiLCJhY3Rpb24iLCJhY3Rpb25fY2xhc3NlcyIsImFkanVzdF9jYXBhY2l0eSIsImRlbGV0ZV9yZXNvdXJjZSIsImVkaXRfcmVzb3VyY2UiLCJwdWJsaXNoX3Jlc291cmNlIiwiYWN0aW9uX2lkIiwiYWN0aW9uc19mb3IiLCJub19hY3Rpb25zIiwibWVudV9pZCIsImlzX2xhc3Rfc2libGluZyIsInN1bW1hcnlfdGFyZ2V0IiwicGFnaW5hdGlvbl9sYWJlbCIsImhhc19uZXh0IiwicGFnZV9udW1iZXIiLCJ0b3RhbF9wYWdlcyIsImhhc19wcmV2aW91cyIsIml0ZW1zX3Blcl9wYWdlIiwiaXRlbXNfcGVyX3BhZ2Vfb3B0aW9ucyIsIm9wdGlvbnMiLCJuZXh0X2xhYmVsIiwibmV4dF9wYWdlIiwibWluIiwicGFnZV9udW1iZXJfbGFiZWwiLCJwZXJfcGFnZV9sYWJlbCIsInBlcl9wYWdlIiwicHJldmlvdXNfbGFiZWwiLCJwcmV2aW91c19wYWdlIiwicmVzdWx0c19zdGF0dXMiLCJpdGVtc19mcm9tIiwiaXRlbXNfdG8iLCJ0b3RhbF9pdGVtcyIsInNob3dfbGFiZWwiLCJzaG93IiwiZ2V0X2RldGFpbHNfY29sc3BhbiIsInZpc2libGVfY2VsbHMiLCJ0YWdOYW1lIiwicHJvdG90eXBlIiwiY2FsbCIsImNlbGxzIiwiZ2V0Q29tcHV0ZWRTdHlsZSIsImdldF9yZXNvdXJjZV9pdGVtX2NvbnRhaW5lciIsInNvdXJjZV9lbGVtZW50IiwiY2xvc2VzdCIsInN5bmNocm9uaXplX2NhcmRfZ3JvdXBfcGFuZWxzIiwiY2F0YWxvZ19yb290IiwiaGFzQXR0cmlidXRlIiwiY2FyZF9ncm91cCIsImNoaWxkcmVuX3BhbmVsIiwidmlzaWJsZV9jaGlsZCIsInNldF9kZXRhaWxzX3RvZ2dsZV9zdGF0ZSIsInRvZ2dsZV9idXR0b24iLCJpY29uIiwic2V0QXR0cmlidXRlIiwicmVzdG9yZV9mb2N1cyIsImFjdGl2ZV9yb3ciLCJhYm9ydCIsInBhcmVudE5vZGUiLCJyZW1vdmVDaGlsZCIsInNvdXJjZV9yb3ciLCJyZW5kZXJfZGV0YWlsc19yb3ciLCJkZXRhaWxzX2h0bWwiLCJpbnNlcnRpb25fdGFyZ2V0IiwibmV4dEVsZW1lbnRTaWJsaW5nIiwiZ2V0X2RldGFpbHNfZXJyb3JfbWVzc2FnZSIsImZhbGxiYWNrIiwib3Blbl9kZXRhaWxzX3JvdyIsImRldGFpbHNfcmVxdWVzdF9pZCIsInJlcXVlc3RfYm9keSIsInJlc291cmNlX3RpdGxlX2VsZW1lbnQiLCJyZXNvdXJjZV90aXRsZSIsInRlbXBsYXRlX2Jhc2UiLCJjb2xzcGFuIiwibG9hZGluZ19sYWJlbCIsImRldGFpbHNfbG9hZGluZyIsInN0YXRlIiwiVVJMU2VhcmNoUGFyYW1zIiwiYXBwZW5kIiwiZGV0YWlsc19hY3Rpb24iLCJub25jZSIsIkFib3J0Q29udHJvbGxlciIsImZldGNoIiwiYWpheF91cmwiLCJib2R5IiwidG9TdHJpbmciLCJjcmVkZW50aWFscyIsImhlYWRlcnMiLCJtZXRob2QiLCJzaWduYWwiLCJ1bmRlZmluZWQiLCJqc29uIiwicmVxdWVzdF9pZCIsImRldGFpbHMiLCJzZWN0aW9ucyIsImVycm9yX21lc3NhZ2UiLCJkZXRhaWxzX2xvYWRfZmFpbGVkIiwibmFtZSIsImNvcHlfZGV0YWlsc192YWx1ZSIsImNvcHlfdmFsdWUiLCJhY3Rpb25fYnV0dG9uIiwiZGV0YWlsc19yb3ciLCJzdGF0dXNfZWxlbWVudCIsImNvcHlfcHJvbWlzZSIsIm5hdmlnYXRvciIsImNsaXBib2FyZCIsIndyaXRlVGV4dCIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiY29weV9pbnB1dCIsInN0eWxlIiwicG9zaXRpb24iLCJvcGFjaXR5Iiwic2VsZWN0IiwiZXhlY0NvbW1hbmQiLCJzaG9ydGNvZGVfY29waWVkIiwic2hvcnRjb2RlX2NvcHlfZmFpbGVkIiwiZ2V0X2Jvb2tpbmdfcmVzb3VyY2Vfc2hvcnRjb2RlIiwiaW5zcGVjdG9yX3Nob3J0Y29kZSIsImhpZGRlbl9zaG9ydGNvZGUiLCJzeW5jaHJvbml6ZV9ib29raW5nX3Jlc291cmNlX3Nob3J0Y29kZV9pbnB1dCIsInNob3J0Y29kZSIsImlucHV0IiwiY3VzdG9taXplX2Jvb2tpbmdfcmVzb3VyY2Vfc2hvcnRjb2RlIiwid3BiY19yZXNvdXJjZV9wYWdlX2J0bl9jbGljayIsInB1Ymxpc2hfYm9va2luZ19yZXNvdXJjZV9zaG9ydGNvZGUiLCJ0cmlnZ2VyX2J1dHRvbiIsIndwYmNfcHVibGlzaF9ib29raW5nX2Zvcm1fX29wZW4iLCJvcGVuX2Jvb2tpbmdfcmVzb3VyY2VfdXBncmFkZV9kaWFsb2ciLCJtb2RhbF9lbGVtZW50IiwidXBncmFkZV91cmwiLCJqUXVlcnkiLCJ3cGJjX215X21vZGFsIiwib2ZmIiwib25lIiwib3BlbiIsIm9wZW5fYm9va2luZ19yZXNvdXJjZV9tZXNzYWdlX2RpYWxvZyIsInRpdGxlX2VsZW1lbnQiLCJkZXNjcmlwdGlvbl9lbGVtZW50IiwiYWxlcnQiLCJnZXRfaW5zcGVjdG9yX2Zvb3RlciIsImNyZWF0ZV9pbnNwZWN0b3Jfd29ya2Zsb3ciLCJleHBhbmQiLCJleHBhbmRfaW5zcGVjdG9yX3NpZGViYXIiLCJnZXRfZm9vdGVyIiwiZ2V0X2hvc3QiLCJyZW5kZXJfc2hlbGwiLCJzaGVsbF9kYXRhIiwiY2F0YWxvZ19pZCIsImVtcHR5X2ljb24iLCJlbXB0eV9tZXNzYWdlIiwiaW5zcGVjdG9yX2VtcHR5X21lc3NhZ2UiLCJlbXB0eV90aXRsZSIsImluc3BlY3Rvcl9lbXB0eV90aXRsZSIsImluc3BlY3Rvcl9sb2FkaW5nIiwibW91bnRfaW5zcGVjdG9yX3NoZWxsIiwic3luY2hyb25pemVfaW5zcGVjdG9yX3dpZHRoIiwid3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fZG9fbWF4IiwiZGlzcGF0Y2hFdmVudCIsIkN1c3RvbUV2ZW50IiwiaG9zdCIsInNpZGViYXIiLCJtYXJrX2luc3BlY3Rvcl9yZXNvdXJjZV9yb3ciLCJzY3JvbGxJbnRvVmlldyIsImJsb2NrIiwiYmVoYXZpb3IiLCJzZXRfc3RhdGUiLCJzZXJpYWxpemVfaW5zcGVjdG9yX2ZpZWxkcyIsImdldF9pbnNwZWN0b3JfY3JlYXRpb25fbW9kZSIsInNlbGVjdGVkX21vZGUiLCJoaWRkZW5fbW9kZSIsInN5bmNocm9uaXplX2NyZWF0ZV9pbnNwZWN0b3JfY29udHJvbHMiLCJjcmVhdGlvbl9tb2RlIiwicGFyZW50X3dyYXAiLCJyYWRpbyIsImNob2ljZSIsImZpZWxkX3dyYXAiLCJzeW5jaHJvbml6ZV9pbnNwZWN0b3JfZGlydHlfc3RhdGUiLCJzYXZlX2lzX2J1c3kiLCJ0aXRsZV9maWVsZCIsInBhcmVudF9maWVsZCIsImNyZWF0ZV9pc192YWxpZCIsImluc3BlY3Rvcl9kaXNjYXJkIiwiY29uZmlybV9kaXNjYXJkIiwid3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fZG9faGlkZSIsImtleSIsImdldF9zZWxlY3RlZF9yZXNvdXJjZV9pZHMiLCJfd3BiY191aV9jYXRhbG9nX3NlbGVjdGlvbl9jb250cm9sbGVyIiwic2VsZWN0ZWRfaWRzIiwiZ2V0X3NlbGVjdGVkX2lkcyIsInJlc291cmNlX2lkX2xpc3RzX21hdGNoIiwiZmlyc3RfaWRzIiwic2Vjb25kX2lkcyIsIm5vcm1hbGl6ZV9pZHMiLCJzb3J0IiwiZmlyc3RfaWQiLCJzZWNvbmRfaWQiLCJnZXRfc2VsZWN0aW9uX2NvdW50X2xhYmVsIiwiY291bnQiLCJyZXNvdXJjZV9zZWxlY3RlZCIsInJlc291cmNlc19zZWxlY3RlZCIsImJ1dHRvbl9sYWJlbCIsImRlc3RydWN0aXZlIiwiZm9vdGVyIiwiY2FuY2VsX2J1dHRvbiIsImRlbGV0ZV93b3JrZmxvdyIsIndwYmNfY2F0YWxvZ19ib29raW5nX3Jlc291cmNlc19jb25maWciLCJjYW5jZWwiLCJjb25maWd1cmVfZm9vdGVyIiwicHVsc2VfZGVsZXRlX2Fja25vd2xlZGdlbWVudCIsImFja25vd2xlZGdlbWVudCIsIm1hdGNoZXMiLCJwdWxzZV9hY2tub3dsZWRnZW1lbnQiLCJvZmZzZXRXaWR0aCIsImlzX2Vycm9yIiwibm90aWNlX3RleHQiLCJoZWFkaW5nIiwic2V0VGltZW91dCIsIm1lc3NhZ2VfdHlwZSIsImRlbGF5Iiwid3BiY19hZG1pbl9zaG93X21lc3NhZ2UiLCJpbnNlcnRCZWZvcmUiLCJmaXJzdENoaWxkIiwiYWN0aXZhdGVfaW5zcGVjdG9yX3NlY3Rpb24iLCJzZWN0aW9uX2lkIiwiZ3JvdXAiLCJjb250cm9sbGVyIiwiaGVhZGVyIiwidGVzdCIsIl9fd3BiY19jb2xsYXBzaWJsZV9pbnN0YW5jZSIsImNsaWNrIiwicmVuZGVyX2luc3BlY3Rvcl9zY2hlbWEiLCJmb2N1c190aXRsZSIsImZvcm1fdGFyZ2V0IiwiY2FuX2NyZWF0ZSIsInNob3J0Y29kZV9maWVsZCIsImFkZF9yZXNvdXJjZSIsInNhdmVfY2hhbmdlcyIsIldQQkNfQ29sbGFwc2libGVfQXV0b0luaXQiLCJzeW5jaHJvbml6ZV9hbGxfaW5zcGVjdG9yX251bWVyaWNfcmFuZ2VzIiwib3Blbl9pbnNwZWN0b3IiLCJpbnNwZWN0b3JfY3JlYXRlX3NjaGVtYV9hY3Rpb24iLCJpbnNwZWN0b3JfZWRpdF9zY2hlbWFfYWN0aW9uIiwiaW5zcGVjdG9yX2xvYWRfZmFpbGVkIiwicmVuZGVyX2J1bGtfZWRpdG9yIiwic2VsZWN0aW9uX2NvdW50IiwicmV2aWV3X2NoYW5nZXNfYnV0dG9uIiwib3Blbl9idWxrX2VkaXRvciIsImJ1bGtfc2NoZW1hX2FjdGlvbiIsImJ1bGtfbG9hZF9mYWlsZWQiLCJoYW5kbGVfaW5zcGVjdG9yX3NlbGVjdGlvbl9jaGFuZ2UiLCJjb2xsZWN0X2J1bGtfb3BlcmF0aW9ucyIsIm9wZXJhdGlvbnMiLCJlbmFibGVkX2NvbnRyb2wiLCJvcGVyYXRpb24iLCJmaWVsZF92YWx1ZSIsInN5bmNocm9uaXplX2J1bGtfZWRpdG9yIiwiY2hhbmdlZF9jb250cm9sIiwib3BlcmF0aW9uX2NvbnRyb2wiLCJwcmVmaXhfZWxlbWVudCIsInN1ZmZpeF9lbGVtZW50Iiwib3BlcmF0aW9uX2lkIiwiaXNfcGVyY2VudCIsIm51bWJlcl9jb250cm9sIiwicmFuZ2VfY29udHJvbCIsImZpZWxkX3ZhbHVlX2NvbnRyb2wiLCJyZW5kZXJfYnVsa19yZXZpZXciLCJyZXZpZXdfY2hhbmdlcyIsImVkaXRfYm9va2luZ19yZXNvdXJjZXMiLCJyZW5kZXJfZGVsZXRlX3JldmlldyIsImRlbGV0ZV9pMThuIiwiZGVsZXRlX2Fja25vd2xlZGdlbWVudCIsImFjdGlvbnNfaGVhZGluZyIsImJvb2tpbmdzX3JldGFpbmVkX3dhcm5pbmciLCJyZXNvdXJjZXNfdG9fZGVsZXRlIiwicmV2aWV3X2hlbHAiLCJkZWxldGVfcmV2aWV3X2hlbHAiLCJkZWxldGVfYm9va2luZ19yZXNvdXJjZXMiLCJ3YXJuaW5nIiwiZGVsZXRlX3dhcm5pbmciLCJyZXNvdXJjZXMiLCJkZWxldGVfYnV0dG9uIiwiZGVsZXRlX3Jlc291cmNlcyIsIm9wZW5fZGVsZXRlX3JldmlldyIsInRyYWNrX3NlbGVjdGlvbiIsImRlbGV0ZV9wcmV2aWV3X2FjdGlvbiIsImRlbGV0ZV9sb2FkX2ZhaWxlZCIsImdldF9jYXBhY2l0eV9jb3VudF9sYWJlbCIsInNpbmd1bGFyX2tleSIsInBsdXJhbF9rZXkiLCJnZXRfY2FwYWNpdHlfZWRpdG9yX3ZpZXciLCJjb250ZXh0IiwiY3VycmVudF9jYXBhY2l0eSIsInRhcmdldF9jYXBhY2l0eSIsImtlZXBfY291bnQiLCJjcmVhdGVfY291bnQiLCJkZWNyZWFzZV9jb3VudCIsImRlbGV0ZV9hY3Rpb24iLCJjaGlsZHJlbiIsInNlbGVjdGVkIiwiY29udGV4dF9sYWJlbCIsImRlY3JlYXNlX2FjdGlvbiIsImRlY3JlYXNlX2hlYWRpbmciLCJkZWNyZWFzZV9oZWxwIiwiZGVsZXRlX3VuaXRzX2hlbHAiLCJzZWxlY3RfZGV0YWNoX2hlbHAiLCJkZWNyZWFzZV9vdXRjb21lX2xhYmVsIiwid2lsbF9iZV9kZWxldGVkIiwibWFrZV9pbmRlcGVuZGVudCIsImNhcGFjaXR5X2Rlc2NyaXB0aW9uIiwiY3JlYXRlX2xhYmVsIiwia2VlcF9sYWJlbCIsIm1heGltdW1fY2FwYWNpdHkiLCJtaW5pbXVtX2NhcGFjaXR5Iiwic3luY2hyb25pemVfY2FwYWNpdHlfZWRpdG9yIiwicmVxdWlyZWRfZGV0YWNoX2NvdW50IiwidGFyZ2V0X251bWJlciIsInRhcmdldF9yYW5nZSIsImFmdGVyX3ZhbHVlIiwiaW5jcmVhc2Vfcm93IiwiZGVjcmVhc2VfcGFuZWwiLCJhY3Rpb25fY29udHJvbCIsImFjdGlvbl9zZWxlY3RlZCIsImNoZWNrYm94IiwidW5pdCIsIm91dGNvbWUiLCJyZW5kZXJfY2FwYWNpdHlfZWRpdG9yIiwidmlldyIsInJldmlld19jYXBhY2l0eV9jaGFuZ2UiLCJvcGVuX2NhcGFjaXR5X2VkaXRvciIsImNhcGFjaXR5X2NvbnRleHRfYWN0aW9uIiwiY2FwYWNpdHlfbG9hZF9mYWlsZWQiLCJyZW5kZXJfY2FwYWNpdHlfcmV2aWV3IiwiaW5jcmVhc2UiLCJkZWxldGVfaGFzX2Jvb2tpbmdzIiwicmV2aWV3X2NhcGFjaXR5X2hlbHAiLCJvcGVyYXRpb25faGVscCIsImNyZWF0ZV91bml0c19oZWxwIiwib3BlcmF0aW9uX2xhYmVsIiwiY3JlYXRlX3Jlc291cmNlcyIsImRldGFjaF9yZXNvdXJjZXMiLCJyZXZpZXdfY2FwYWNpdHlfdGl0bGUiLCJhcHBseV9jYXBhY2l0eV9jaGFuZ2UiLCJiYWNrIiwic3luY2hyb25pemVfaW5zcGVjdG9yX2ltYWdlIiwicmVtb3ZlX2J1dHRvbiIsInBpY3R1cmVfdXJsIiwic3JjIiwic3luY2hyb25pemVfaW5zcGVjdG9yX251bWVyaWNfcmFuZ2UiLCJudW1iZXJfZmllbGQiLCJyYW5nZSIsIm51bWJlcl92YWx1ZSIsImRlZmF1bHRfbWluIiwiZGVmYXVsdF9tYXgiLCJoYXJkX21pbiIsImhhcmRfbWF4IiwicmFuZ2VfbWluIiwicmFuZ2VfbWF4IiwiaXNGaW5pdGUiLCJzeW5jaHJvbml6ZV9pbnNwZWN0b3JfbnVtYmVyX2Zyb21fcmFuZ2UiLCJFdmVudCIsImJ1YmJsZXMiLCJpc19leHBlY3RlZF9pbnNwZWN0b3Jfc3VibWl0Iiwic3VibWl0dGVyIiwicmVwb3J0X2luc3BlY3Rvcl92YWxpZGl0eSIsInByaWNlX2ZpZWxkcyIsInByaWNlX3N0ZXBzIiwiaXNfdmFsaWQiLCJwcmljZV9maWVsZCIsInN0ZXAiLCJyZXBvcnRWYWxpZGl0eSIsInByaWNlX3N0ZXAiLCJzdWJtaXRfaW5zcGVjdG9yIiwibXV0YXRpb25fcmVxdWVzdF9zZXF1ZW5jZSIsInN1Ym1pdHRlZF9tb2RlIiwicmVxdWVzdF92YWx1ZXMiLCJjb250cm9sX2Rpc2FibGVkX3N0YXRlcyIsInN1Y2Nlc3NfbWVzc2FnZSIsInN1Y2Nlc3NfbWVzc2FnZV9pc19nbG9iYWwiLCJzdWJtaXR0ZWRfZm9ybV9pc19hY3RpdmUiLCJwYXJzZSIsImluc3BlY3Rvcl9jcmVhdGVfYWN0aW9uIiwiaW5zcGVjdG9yX3VwZGF0ZV9hY3Rpb24iLCJpbnNwZWN0b3Jfc2F2ZV9mYWlsZWQiLCJjb250cm9sX3N0YXRlIiwic3VibWl0X3Jldmlld2VkX2luc3BlY3RvciIsImlzX211dGF0aW9uIiwic3VibWl0dGVkX3Jlc291cmNlX2lkcyIsInN1Ym1pdHRlZF90cmFja3Nfc2VsZWN0aW9uIiwiYnVsa19wcmV2aWV3X2FjdGlvbiIsImJ1bGtfcmV2aWV3X2ZhaWxlZCIsImJ1bGtfYXBwbHlfYWN0aW9uIiwiYnVsa19hcHBseV9mYWlsZWQiLCJkZWxldGVfYXBwbHlfYWN0aW9uIiwiYWNrbm93bGVkZ2VkIiwiZGVsZXRlX2FwcGx5X2ZhaWxlZCIsImNhcGFjaXR5X3ByZXZpZXdfYWN0aW9uIiwiZGV0YWNoX3Jlc291cmNlX2lkcyIsImNhcGFjaXR5X3Jldmlld19mYWlsZWQiLCJjYXBhY2l0eV9hcHBseV9hY3Rpb24iLCJjYXBhY2l0eV9hY2tub3dsZWRnZW1lbnQiLCJjYXBhY2l0eV9hcHBseV9mYWlsZWQiLCJhZmZlY3RlZF9pZHMiLCJzZWxlY3RlZF9yZXNvdXJjZV9pZHMiLCJkZWxldGVkX3NlbGVjdGVkX3Jlc291cmNlIiwiY2xlYXIiLCJkZXRhaWwiLCJzZWxlY3Rpb25fY2hhbmdlZCIsImFwcGx5X3BlbmRpbmdfaGlnaGxpZ2h0cyIsImZpcnN0X3JvdyIsImNvbnN1bWVfaW5pdGlhbF9sYXVuY2hfcGFyYW1ldGVyIiwibGF1bmNoX2ludGVudCIsInF1ZXJ5X3BhcmFtZXRlciIsImN1cnJlbnRfdXJsIiwiaGlzdG9yeSIsInJlcGxhY2VTdGF0ZSIsIlVSTCIsImxvY2F0aW9uIiwiaHJlZiIsInNlYXJjaFBhcmFtcyIsImRlbGV0ZSIsInJlc291cmNlX2V4cG9zZXNfYWN0aW9uIiwiYWN0aW9uX2luZGV4Iiwib3Blbl9yZXNvdXJjZV9hY3Rpb25fbWVudSIsImFjdGlvbnNfY29udHJvbGxlciIsIl93cGJjX3VpX2NhdGFsb2dfYWN0aW9uc19jb250cm9sbGVyIiwib3Blbl9pdGVtIiwib3Blbl9pbml0aWFsX2xhdW5jaF9pbnRlbnQiLCJyZXNvdXJjZV9pbmRleCIsInB1Ymxpc2hpbmdfbGF1bmNoX3VuYXZhaWxhYmxlIiwiaGFuZGxlX2NhdGFsb2dfcmVuZGVyZWQiLCJldmVudF9kZXRhaWwiLCJoYW5kbGVfY2F0YWxvZ19jbGljayIsImFjdGlvbl9kZXRhaWxzIiwicGFnZV9idXR0b24iLCJyZXNvdXJjZV9hY3Rpb25fZXZlbnQiLCJjcmVhdGVFdmVudCIsImluaXRDdXN0b21FdmVudCIsImhhbmRsZV9jYXRhbG9nX2tleWRvd24iLCJwcm90ZWN0X2RlbW9fcmVzb3VyY2VfaW1hZ2VfY2hhbmdlIiwibWVkaWFfYnV0dG9uIiwiaW5zcGVjdG9yX2Zvcm0iLCJtZXNzYWdlX3RpdGxlIiwiaXNfZGVtbyIsInN0b3BQcm9wYWdhdGlvbiIsInN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbiIsImRlbW9faW1hZ2VfY2hhbmdlX3VuYXZhaWxhYmxlIiwiZGVtb19pbWFnZV9jaGFuZ2VfdW5hdmFpbGFibGVfdGl0bGUiLCJtb3VudF9ib29raW5nX3Jlc291cmNlc19jYXRhbG9nIiwiYWRkRXZlbnRMaXN0ZW5lciIsImNyZWF0ZV9pbmxpbmVfZWRpdGluZ193b3JrZmxvdyIsImJhcl9zZWxlY3RvciIsImNvbnRyb2xzX3Jvb3QiLCJjb3VudF9zZWxlY3RvciIsInBhZ2VfZWxlbWVudCIsInByb3RlY3RlZF9zZWxlY3RvciIsInJldmlld19zZWxlY3RvciIsInRvZ2dsZV9sYWJlbF9zZWxlY3RvciIsInRvZ2dsZV9zZWxlY3RvciIsImlubGluZV90b2dnbGUiLCJpbmxpbmVfY2FuY2VsIiwiaW5saW5lX3JldmlldyIsImNyZWF0ZV9idXR0b24iLCJ1cGdyYWRlX2J1dHRvbiIsInJlbW92ZV9pbWFnZV9idXR0b24iLCJzaG9ydGNvZGVfYnV0dG9uIiwic2VsZWN0aW9uX2FjdGlvbiIsInNob3J0Y29kZV9yZXNvdXJjZV9pZCIsInNob3J0Y29kZV9jb21tYW5kIiwic2hvcnRjb2RlX3ZhbHVlIiwicmV2aWV3ZWRfdGFyZ2V0X2NhcGFjaXR5IiwicmV2aWV3ZWRfZGV0YWNoX2lkcyIsInJldmlld2VkX2RlY3JlYXNlX2FjdGlvbiIsImltYWdlX2ZpZWxkIiwibWluaW11bSIsIm1heGltdW0iLCJyZXF1ZXN0ZWRfY2FwYWNpdHkiLCJyb3VuZCIsImhhbmRsZV9jaGFuZ2UiLCJkZXRhY2hfaWQiLCJjYXBhY2l0eV9kZWxldGVfYnV0dG9uIiwib24iLCJjbG9zaW5nX21vZGUiLCJzZWxlY3RlZF9yZXNvdXJjZV9pZCIsInNlbGVjdGVkX3Nob3J0Y29kZSIsImRldGFpbHNfY29kZSIsInJldHVyblZhbHVlIiwicmVhZHlTdGF0ZSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtY2F0YWxvZy1ib29raW5nLXJlc291cmNlcy9fc3JjL2Jvb2tpbmdfcmVzb3VyY2VzX2NhdGFsb2cuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBSZW5kZXIgbm9ybWFsaXplZCBCb29raW5nIFJlc291cmNlIERUT3MgdGhyb3VnaCBpZGVudGlmaWFibGUgV1AgdGVtcGxhdGVzLlxuICpcbiAqIEBzaW5jZSAxMS42LjBcbiAqL1xuKCBmdW5jdGlvbiAoIHdpbmRvdywgZG9jdW1lbnQgKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHR2YXIgY2F0YWxvZ19jb250cm9sbGVyID0gbnVsbDtcblx0dmFyIGlubGluZV93b3JrZmxvd19jb250cm9sbGVyID0gbnVsbDtcblx0dmFyIGlubGluZV9yZXZpZXdfd29ya2Zsb3dfY29udHJvbGxlciA9IG51bGw7XG5cdHZhciBkZWxldGVfcmV2aWV3X3dvcmtmbG93X2NvbnRyb2xsZXIgPSBudWxsO1xuXHR2YXIgaW5zcGVjdG9yX3dvcmtmbG93X2NvbnRyb2xsZXIgPSBudWxsO1xuXHR2YXIgY2F0YWxvZ19yZXNwb25zZSA9IG51bGw7XG5cdHZhciBkZXRhaWxzX2Fib3J0X2NvbnRyb2xsZXIgPSBudWxsO1xuXHR2YXIgZGV0YWlsc19yZXF1ZXN0X3NlcXVlbmNlID0gMDtcblx0dmFyIGRldGFpbHNfcmVzb3VyY2VfaWQgPSAwO1xuXHR2YXIgZGV0YWlsc190b2dnbGVfYnV0dG9uID0gbnVsbDtcblx0dmFyIHBlbmRpbmdfZm9jdXNfZGlyZWN0aW9uID0gJyc7XG5cdHZhciBpbnNwZWN0b3JfZGlydHkgPSBmYWxzZTtcblx0dmFyIGluc3BlY3Rvcl9mb2N1c190YXJnZXQgPSBudWxsO1xuXHR2YXIgaW5zcGVjdG9yX21vZGUgPSAnJztcblx0dmFyIGluc3BlY3Rvcl9tdXRhdGlvbl9pbl9wcm9ncmVzcyA9IGZhbHNlO1xuXHR2YXIgaW5zcGVjdG9yX211dGF0aW9uX3JlcXVlc3Rfc2VxdWVuY2UgPSAwO1xuXHR2YXIgaW5zcGVjdG9yX29yaWdpbmFsX2ZpZWxkcyA9ICcnO1xuXHR2YXIgaW5zcGVjdG9yX3JlcXVlc3Rfc2VxdWVuY2UgPSAwO1xuXHR2YXIgaW5zcGVjdG9yX3Jlc291cmNlX2lkID0gMDtcblx0dmFyIGluc3BlY3Rvcl9yZXNvdXJjZV9pZHMgPSBbXTtcblx0dmFyIGluc3BlY3Rvcl9idWxrX29wZXJhdGlvbnMgPSB7fTtcblx0dmFyIGluc3BlY3Rvcl9yZXZpZXdfdG9rZW4gPSAnJztcblx0dmFyIGluc3BlY3Rvcl9zZWxlY3Rpb25fc3RhbGUgPSBmYWxzZTtcblx0dmFyIGluc3BlY3Rvcl90cmFja3Nfc2VsZWN0aW9uID0gZmFsc2U7XG5cdHZhciBpbnNwZWN0b3JfY2FwYWNpdHlfY29udGV4dCA9IG51bGw7XG5cdHZhciBpbnNwZWN0b3JfY2FwYWNpdHlfZGV0YWNoX2lkcyA9IFtdO1xuXHR2YXIgaW5zcGVjdG9yX2NhcGFjaXR5X2RlY3JlYXNlX2FjdGlvbiA9ICdkZXRhY2gnO1xuXHR2YXIgaW5zcGVjdG9yX2NhcGFjaXR5X3RhcmdldCA9IDA7XG5cdHZhciBwZW5kaW5nX2hpZ2hsaWdodF9pZHMgPSBbXTtcblx0dmFyIGxhdW5jaF9pbnRlbnRfaGFuZGxlZCA9IGZhbHNlO1xuXHR2YXIgaW5saW5lX3N0YXRlID0ge1xuXHRcdGFjdGl2ZTogZmFsc2UsXG5cdFx0Y2hhbmdlZF9yb3dzOiBbXSxcblx0XHRsb2FkaW5nOiBmYWxzZSxcblx0XHRyZXF1ZXN0X3NlcXVlbmNlOiAwLFxuXHRcdHJldmlld190b2tlbjogJydcblx0fTtcblxuXHQvKipcblx0ICogTm9ybWFsaXplIGEgbG9jYWxpemVkIFdvcmRQcmVzcyBmbGFnIHRvIGEgc3RyaWN0IGJvb2xlYW4uXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gZmxhZ192YWx1ZSBMb2NhbGl6ZWQgZmxhZyB2YWx1ZS5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSBvbmx5IGZvciBhbiBleHBsaWNpdGx5IGVuYWJsZWQgZmxhZy5cblx0ICovXG5cdGZ1bmN0aW9uIGlzX3RydWVfZmxhZyggZmxhZ192YWx1ZSApIHtcblx0XHRyZXR1cm4gdHJ1ZSA9PT0gZmxhZ192YWx1ZSB8fCAxID09PSBmbGFnX3ZhbHVlIHx8ICcxJyA9PT0gZmxhZ192YWx1ZSB8fCAndHJ1ZScgPT09IFN0cmluZyggZmxhZ192YWx1ZSApLnRvTG93ZXJDYXNlKCk7XG5cdH1cblxuXHQvKipcblx0ICogRm9ybWF0IGEgbG9jYWxpemVkIHBvc2l0aW9uYWwtcGxhY2Vob2xkZXIgc3RyaW5nLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGUgTG9jYWxpemVkIHN0cmluZyBjb250YWluaW5nIGAlMSRzYCBwbGFjZWhvbGRlcnMuXG5cdCAqIEBwYXJhbSB7QXJyYXk8Kj59IHZhbHVlcyBTY2FsYXIgcmVwbGFjZW1lbnQgdmFsdWVzLlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IEZvcm1hdHRlZCBwbGFpbiB0ZXh0LlxuXHQgKi9cblx0ZnVuY3Rpb24gZm9ybWF0X21lc3NhZ2UoIHRlbXBsYXRlLCB2YWx1ZXMgKSB7XG5cdFx0dmFyIG1lc3NhZ2UgPSBTdHJpbmcoIHRlbXBsYXRlIHx8ICcnICk7XG5cblx0XHR2YWx1ZXMuZm9yRWFjaCggZnVuY3Rpb24gKCByZXBsYWNlbWVudCwgcmVwbGFjZW1lbnRfaW5kZXggKSB7XG5cdFx0XHR2YXIgcGxhY2Vob2xkZXIgPSBuZXcgUmVnRXhwKCAnJScgKyAoIHJlcGxhY2VtZW50X2luZGV4ICsgMSApICsgJ1xcXFwkcycsICdnJyApO1xuXHRcdFx0bWVzc2FnZSA9IG1lc3NhZ2UucmVwbGFjZSggcGxhY2Vob2xkZXIsIFN0cmluZyggcmVwbGFjZW1lbnQgKSApO1xuXHRcdH0gKTtcblxuXHRcdHJldHVybiBtZXNzYWdlO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiB0aGUgc2hhcmVkIHNpZ25lZC1yZXZpZXcgcHJlc2VudGF0aW9uIGNvbnRyb2xsZXIuXG5cdCAqXG5cdCAqIEByZXR1cm4ge09iamVjdHxmYWxzZX0gU2hhcmVkIHJldmlldyBjb250cm9sbGVyIG9yIGZhbHNlIHdoZW4gdW5hdmFpbGFibGUuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfaW5saW5lX3Jldmlld193b3JrZmxvdygpIHtcblx0XHRpZiAoIGlubGluZV9yZXZpZXdfd29ya2Zsb3dfY29udHJvbGxlciApIHtcblx0XHRcdHJldHVybiBpbmxpbmVfcmV2aWV3X3dvcmtmbG93X2NvbnRyb2xsZXI7XG5cdFx0fVxuXHRcdGlmICggISB3aW5kb3cud3BiY191aV9jYXRhbG9nIHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiB3aW5kb3cud3BiY191aV9jYXRhbG9nLmNyZWF0ZV9pbmxpbmVfcmV2aWV3X3dvcmtmbG93ICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpbmxpbmVfcmV2aWV3X3dvcmtmbG93X2NvbnRyb2xsZXIgPSB3aW5kb3cud3BiY191aV9jYXRhbG9nLmNyZWF0ZV9pbmxpbmVfcmV2aWV3X3dvcmtmbG93KCB7XG5cdFx0XHRhcHBseV9zZWxlY3RvcjogJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbnNwZWN0b3Itc2F2ZV0nLFxuXHRcdFx0Y2FuY2VsX3NlbGVjdG9yOiAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1jYW5jZWxdJyxcblx0XHRcdHJvb3Q6IGRvY3VtZW50XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIGlubGluZV9yZXZpZXdfd29ya2Zsb3dfY29udHJvbGxlcjtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gdGhlIHNoYXJlZCBwZXJtYW5lbnQtZGVsZXRpb24gcHJlc2VudGF0aW9uIGNvbnRyb2xsZXIuXG5cdCAqXG5cdCAqIEByZXR1cm4ge09iamVjdHxmYWxzZX0gU2hhcmVkIGRlbGV0aW9uIGNvbnRyb2xsZXIgb3IgZmFsc2Ugd2hlbiB1bmF2YWlsYWJsZS5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9kZWxldGVfcmV2aWV3X3dvcmtmbG93KCkge1xuXHRcdGlmICggZGVsZXRlX3Jldmlld193b3JrZmxvd19jb250cm9sbGVyICkge1xuXHRcdFx0cmV0dXJuIGRlbGV0ZV9yZXZpZXdfd29ya2Zsb3dfY29udHJvbGxlcjtcblx0XHR9XG5cdFx0aWYgKCAhIHdpbmRvdy53cGJjX3VpX2NhdGFsb2cgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy53cGJjX3VpX2NhdGFsb2cuY3JlYXRlX2RlbGV0ZV9yZXZpZXdfd29ya2Zsb3cgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGRlbGV0ZV9yZXZpZXdfd29ya2Zsb3dfY29udHJvbGxlciA9IHdpbmRvdy53cGJjX3VpX2NhdGFsb2cuY3JlYXRlX2RlbGV0ZV9yZXZpZXdfd29ya2Zsb3coIHtcblx0XHRcdGFja25vd2xlZGdlbWVudF9zZWxlY3RvcjogJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1kZWxldGUtYWNrbm93bGVkZ2VtZW50XScsXG5cdFx0XHRhcHBseV9zZWxlY3RvcjogJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbnNwZWN0b3Itc2F2ZV0nLFxuXHRcdFx0Y2FuY2VsX3NlbGVjdG9yOiAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1jYW5jZWxdJyxcblx0XHRcdHJvb3Q6IGRvY3VtZW50XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIGRlbGV0ZV9yZXZpZXdfd29ya2Zsb3dfY29udHJvbGxlcjtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gdGhlIGxvY2FsaXplZCBjb3VudCBzaG93biBpbiBhIGNvbGxhcHNlZCBjaGlsZC1ncm91cCBzdW1tYXJ5LlxuXHQgKlxuXHQgKiBUaGUgRFRPIGxhYmVsIHJlbWFpbnMgYXV0aG9yaXRhdGl2ZSBiZWNhdXNlIFBIUCBhcHBsaWVzIFdvcmRQcmVzcyBsb2NhbGVcblx0ICogcGx1cmFsIHJ1bGVzLiBUaGUgbnVtZXJpYyBmYWxsYmFjayBjb25zdW1lcyB0aGUgc2hhcmVkIGRpcmVjdC1jaGlsZCBjb3VudFxuXHQgKiB3aGVuIGFuIG9sZGVyIG9yIGN1c3RvbSBkb21haW4gRFRPIGRvZXMgbm90IGluY2x1ZGUgdGhlIHByZXBhcmVkIGxhYmVsLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gcGFyZW50X3Jlc291cmNlIFBhcmVudCBCb29raW5nIFJlc291cmNlIERUTy5cblx0ICogQHBhcmFtIHtPYmplY3R9IGkxOG4gICAgICAgICAgICBMb2NhbGl6ZWQgY2F0YWxvZyBzdHJpbmdzLlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IExvY2FsaXplZCBjaGlsZC1jb3VudCBsYWJlbC5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9jaGlsZHJlbl9zdW1tYXJ5X2xhYmVsKCBwYXJlbnRfcmVzb3VyY2UsIGkxOG4gKSB7XG5cdFx0dmFyIGhpZXJhcmNoeSA9IHBhcmVudF9yZXNvdXJjZSAmJiBwYXJlbnRfcmVzb3VyY2UuaGllcmFyY2h5ID8gcGFyZW50X3Jlc291cmNlLmhpZXJhcmNoeSA6IHt9O1xuXHRcdHZhciBzZXJ2ZXJfbGFiZWwgPSBTdHJpbmcoIGhpZXJhcmNoeS5jaGlsZHJlbl9sYWJlbCB8fCAnJyApLnRyaW0oKTtcblx0XHR2YXIgY2hpbGRfY291bnQgPSBNYXRoLm1heCggMCwgTnVtYmVyKCBoaWVyYXJjaHkucmVuZGVyZWRfY2hpbGRyZW5fY291bnQgKSB8fCAwICk7XG5cdFx0dmFyIGxhYmVsX3RlbXBsYXRlO1xuXG5cdFx0aWYgKCBzZXJ2ZXJfbGFiZWwgKSB7XG5cdFx0XHRyZXR1cm4gc2VydmVyX2xhYmVsO1xuXHRcdH1cblxuXHRcdGxhYmVsX3RlbXBsYXRlID0gMSA9PT0gY2hpbGRfY291bnRcblx0XHRcdD8gaTE4bi5jaGlsZF9jb3VudF9zaW5ndWxhciB8fCAnJTEkcyBjaGlsZCByZXNvdXJjZSdcblx0XHRcdDogaTE4bi5jaGlsZF9jb3VudF9wbHVyYWwgfHwgJyUxJHMgY2hpbGQgcmVzb3VyY2VzJztcblxuXHRcdHJldHVybiBmb3JtYXRfbWVzc2FnZSggbGFiZWxfdGVtcGxhdGUsIFsgY2hpbGRfY291bnQgXSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlbmRlciBvbmUgYWxsb3ctbGlzdGVkIFJlc291cmNlIHByZXNlbnRhdGlvbiB0ZW1wbGF0ZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyAgICAgICAgUmVnaXN0ZXJlZCBjYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZW1wbGF0ZV9yb2xlIFJlZ2lzdGVyZWQgdGVtcGxhdGUgcm9sZS5cblx0ICogQHBhcmFtIHtPYmplY3R9IHRlbXBsYXRlX2RhdGEgTm9ybWFsaXplZCBEVE8gb3IgcHJlc2VudGF0aW9uIGRhdGEuXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gRXNjYXBlZCB0ZW1wbGF0ZSBIVE1MIG9yIGFuIGVtcHR5IHN0cmluZy5cblx0ICovXG5cdGZ1bmN0aW9uIHJlbmRlcl9jb21wb25lbnQoIGNvbmZpZywgdGVtcGxhdGVfcm9sZSwgdGVtcGxhdGVfZGF0YSApIHtcblx0XHR2YXIgY29tcG9uZW50X3RlbXBsYXRlID0gd2luZG93LndwYmNfdWlfY2F0YWxvZy5sb2FkX3RlbXBsYXRlKCBjb25maWcsIHRlbXBsYXRlX3JvbGUgKTtcblxuXHRcdGlmICggISBjb21wb25lbnRfdGVtcGxhdGUgKSB7XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiBjb21wb25lbnRfdGVtcGxhdGUoIHRlbXBsYXRlX2RhdGEgfHwge30gKTtcblx0XHR9IGNhdGNoICggZXJyb3IgKSB7XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiBjb21wbGV0ZSBjb2x1bW4gcHJlc2VudGF0aW9uIHJlY29yZHMgaW4gdGhlIGFjdGl2ZSBvcmRlci5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyAgICAgICAgIFJlZ2lzdGVyZWQgY2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gZGlzcGxheV9zdGF0ZSAgTm9ybWFsaXplZCBkaXNwbGF5IHJlcXVlc3Qgb3IgcmVzcG9uc2UuXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gdmlzaWJsZV9vbmx5ICBXaGV0aGVyIGhpZGRlbiBjb2x1bW5zIG11c3QgYmUgb21pdHRlZC5cblx0ICogQHBhcmFtIHtPYmplY3R9IHNvcnRpbmdfc3RhdGUgIE5vcm1hbGl6ZWQgc29ydGluZyByZXNwb25zZS5cblx0ICogQHJldHVybiB7QXJyYXk8T2JqZWN0Pn0gT3JkZXJlZCBwcmVzZW50YXRpb24tb25seSBjb2x1bW4gcmVjb3Jkcy5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9jb2x1bW5zKCBjb25maWcsIGRpc3BsYXlfc3RhdGUsIHZpc2libGVfb25seSwgc29ydGluZ19zdGF0ZSApIHtcblx0XHR2YXIgY29sdW1uX2NvbmZpZyA9IGNvbmZpZy5jb2x1bW5zIHx8IHt9O1xuXHRcdHZhciBkZWZpbml0aW9ucyA9IGNvbHVtbl9jb25maWcuZGVmaW5pdGlvbnMgfHwge307XG5cdFx0dmFyIGRlZmF1bHRfb3JkZXIgPSBBcnJheS5pc0FycmF5KCBjb2x1bW5fY29uZmlnLmRlZmF1bHRfb3JkZXIgKSA/IGNvbHVtbl9jb25maWcuZGVmYXVsdF9vcmRlciA6IFtdO1xuXHRcdHZhciBvcmRlciA9IGRpc3BsYXlfc3RhdGUgJiYgQXJyYXkuaXNBcnJheSggZGlzcGxheV9zdGF0ZS5jb2x1bW5fb3JkZXIgKSA/IGRpc3BsYXlfc3RhdGUuY29sdW1uX29yZGVyLnNsaWNlKCkgOiBkZWZhdWx0X29yZGVyLnNsaWNlKCk7XG5cdFx0dmFyIHZpc2libGVfY29sdW1ucyA9IGRpc3BsYXlfc3RhdGUgJiYgQXJyYXkuaXNBcnJheSggZGlzcGxheV9zdGF0ZS52aXNpYmxlX2NvbHVtbnMgKSA/IGRpc3BsYXlfc3RhdGUudmlzaWJsZV9jb2x1bW5zIDogY29sdW1uX2NvbmZpZy5kZWZhdWx0X3Zpc2libGUgfHwgW107XG5cblx0XHRkZWZhdWx0X29yZGVyLmZvckVhY2goIGZ1bmN0aW9uICggY29sdW1uX2lkICkge1xuXHRcdFx0aWYgKCAtMSA9PT0gb3JkZXIuaW5kZXhPZiggY29sdW1uX2lkICkgKSB7XG5cdFx0XHRcdG9yZGVyLnB1c2goIGNvbHVtbl9pZCApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblxuXHRcdHJldHVybiBvcmRlci5maWx0ZXIoIGZ1bmN0aW9uICggY29sdW1uX2lkICkge1xuXHRcdFx0cmV0dXJuIGRlZmluaXRpb25zWyBjb2x1bW5faWQgXSAmJiAoICEgdmlzaWJsZV9vbmx5IHx8IC0xICE9PSB2aXNpYmxlX2NvbHVtbnMuaW5kZXhPZiggY29sdW1uX2lkICkgKTtcblx0XHR9ICkubWFwKCBmdW5jdGlvbiAoIGNvbHVtbl9pZCwgY29sdW1uX2luZGV4ICkge1xuXHRcdFx0dmFyIGRlZmluaXRpb24gPSBkZWZpbml0aW9uc1sgY29sdW1uX2lkIF07XG5cdFx0XHR2YXIgaXNfc29ydGVkID0gISEgZGVmaW5pdGlvbi5zb3J0X2tleSAmJiBzb3J0aW5nX3N0YXRlICYmIGRlZmluaXRpb24uc29ydF9rZXkgPT09IHNvcnRpbmdfc3RhdGUuc29ydF9ieTtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGFyaWFfc29ydDogaXNfc29ydGVkID8gKCAnZGVzYycgPT09IHNvcnRpbmdfc3RhdGUuc29ydF9vcmRlciA/ICdkZXNjZW5kaW5nJyA6ICdhc2NlbmRpbmcnICkgOiAnbm9uZScsXG5cdFx0XHRcdGNsYXNzX25hbWU6IGRlZmluaXRpb24uY2xhc3MgfHwgJ2NvbHVtbi0nICsgY29sdW1uX2lkLFxuXHRcdFx0XHRkZWZhdWx0X2luZGV4OiBkZWZhdWx0X29yZGVyLmluZGV4T2YoIGNvbHVtbl9pZCApLFxuXHRcdFx0XHRpZDogY29sdW1uX2lkLFxuXHRcdFx0XHRpc19zb3J0ZWQ6IGlzX3NvcnRlZCxcblx0XHRcdFx0bGFiZWw6IGRlZmluaXRpb24ubGFiZWwgfHwgY29sdW1uX2lkLFxuXHRcdFx0XHRtb3ZlX2xhYmVsOiBmb3JtYXRfbWVzc2FnZSggY29uZmlnLmkxOG4ubW92ZV9jb2x1bW4gfHwgJycsIFsgZGVmaW5pdGlvbi5sYWJlbCB8fCBjb2x1bW5faWQgXSApLFxuXHRcdFx0XHRyZW9yZGVyYWJsZTogZmFsc2UgIT09IGRlZmluaXRpb24ucmVvcmRlcmFibGUsXG5cdFx0XHRcdHJlcXVpcmVkOiAhISBkZWZpbml0aW9uLnJlcXVpcmVkLFxuXHRcdFx0XHRzb3J0X2ljb246IGlzX3NvcnRlZCA/ICggJ2Rlc2MnID09PSBzb3J0aW5nX3N0YXRlLnNvcnRfb3JkZXIgPyAnd3BiYy1iaS1hcnJvdy1kb3duJyA6ICd3cGJjLWJpLWFycm93LXVwJyApIDogJ3dwYmNfaWNuX2ltcG9ydF9leHBvcnQnLFxuXHRcdFx0XHRzb3J0X2tleTogZGVmaW5pdGlvbi5zb3J0X2tleSB8fCAnJyxcblx0XHRcdFx0dmlzaWJsZTogLTEgIT09IHZpc2libGVfY29sdW1ucy5pbmRleE9mKCBjb2x1bW5faWQgKVxuXHRcdFx0fTtcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogRGV0ZXJtaW5lIHdoZXRoZXIgZGlzcGxheSB2YWx1ZXMgbWF0Y2ggdGhlIE92ZXJ2aWV3IGRlZmF1bHRzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnICAgICAgICBSZWdpc3RlcmVkIGNhdGFsb2cgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtPYmplY3R9IGRpc3BsYXlfc3RhdGUgQ3VycmVudCBub3JtYWxpemVkIGRpc3BsYXkgc3RhdGUuXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gb3ZlcnZpZXcgb3IgY3VzdG9tLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X2FjdGl2ZV92aWV3KCBjb25maWcsIGRpc3BsYXlfc3RhdGUgKSB7XG5cdFx0dmFyIHZpZXdfZGVmaW5pdGlvbnMgPSBjb25maWcudmlld3MgJiYgY29uZmlnLnZpZXdzLmRlZmluaXRpb25zID8gY29uZmlnLnZpZXdzLmRlZmluaXRpb25zIDoge307XG5cdFx0dmFyIGN1cnJlbnRfdmlzaWJsZSA9IGRpc3BsYXlfc3RhdGUgJiYgQXJyYXkuaXNBcnJheSggZGlzcGxheV9zdGF0ZS52aXNpYmxlX2NvbHVtbnMgKSA/IGRpc3BsYXlfc3RhdGUudmlzaWJsZV9jb2x1bW5zIDogW107XG5cdFx0dmFyIG1hdGNoaW5nX3ZpZXcgPSAnJztcblxuXHRcdE9iamVjdC5rZXlzKCB2aWV3X2RlZmluaXRpb25zICkuc29tZSggZnVuY3Rpb24gKCB2aWV3X2lkICkge1xuXHRcdFx0dmFyIHZpZXdfZmllbGRzID0gQXJyYXkuaXNBcnJheSggdmlld19kZWZpbml0aW9uc1sgdmlld19pZCBdLmZpZWxkcyApID8gdmlld19kZWZpbml0aW9uc1sgdmlld19pZCBdLmZpZWxkcyA6IFtdO1xuXHRcdFx0aWYgKCBKU09OLnN0cmluZ2lmeSggY3VycmVudF92aXNpYmxlICkgPT09IEpTT04uc3RyaW5naWZ5KCB2aWV3X2ZpZWxkcyApICkge1xuXHRcdFx0XHRtYXRjaGluZ192aWV3ID0gdmlld19pZDtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIG1hdGNoaW5nX3ZpZXcgfHwgJ2N1c3RvbSc7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIG9yZGVyZWQgdmlldyBwcmVzZXRzIGRlY2xhcmVkIGJ5IHRoZSBpbmRlcGVuZGVudCBQSFAgY29uZmlndXJhdGlvbi5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBSZWdpc3RlcmVkIGNhdGFsb2cgY29uZmlndXJhdGlvbi5cblx0ICogQHJldHVybiB7QXJyYXk8T2JqZWN0Pn0gQnJvd3Nlci1zYWZlIHZpZXcgZGVmaW5pdGlvbnMuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfdmlld19kZWZpbml0aW9ucyggY29uZmlnICkge1xuXHRcdHZhciBkZWZpbml0aW9ucyA9IGNvbmZpZy52aWV3cyAmJiBjb25maWcudmlld3MuZGVmaW5pdGlvbnMgPyBjb25maWcudmlld3MuZGVmaW5pdGlvbnMgOiB7fTtcblxuXHRcdHJldHVybiBPYmplY3Qua2V5cyggZGVmaW5pdGlvbnMgKS5tYXAoIGZ1bmN0aW9uICggdmlld19pZCApIHtcblx0XHRcdHJldHVybiBkZWZpbml0aW9uc1sgdmlld19pZCBdO1xuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gdGhlIGFsbG93LWxpc3RlZCBwcmVzZW50YXRpb24gcGFja3MgZGVjbGFyZWQgYnkgUEhQLlxuXHQgKlxuXHQgKiBMYWJlbHMgcmVtYWluIGRvbWFpbi1vd25lZCB3aGlsZSB0aGUgc2hhcmVkIGNvbnRyb2xsZXIgdmFsaWRhdGVzIGFuZFxuXHQgKiBwZXJzaXN0cyBvbmx5IHBhY2sgaWRlbnRpZmllcnMgcmVnaXN0ZXJlZCBpbiB0aGUgY2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnIFJlZ2lzdGVyZWQgY2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcmV0dXJuIHtBcnJheTxPYmplY3Q+fSBPcmRlcmVkIGJyb3dzZXItc2FmZSBwYWNrIG9wdGlvbnMuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfdGVtcGxhdGVfcGFja19kZWZpbml0aW9ucyggY29uZmlnICkge1xuXHRcdHZhciBsYWJlbHMgPSB7XG5cdFx0XHRjYXJkczogY29uZmlnLmkxOG4ubGF5b3V0X2NhcmRzIHx8ICcnLFxuXHRcdFx0Y29tcGFjdDogY29uZmlnLmkxOG4ubGF5b3V0X2NvbXBhY3QgfHwgJycsXG5cdFx0XHR0YWJsZTogY29uZmlnLmkxOG4ubGF5b3V0X3RhYmxlIHx8ICcnXG5cdFx0fTtcblx0XHR2YXIgdGVtcGxhdGVfcGFja3MgPSBjb25maWcudGVtcGxhdGVfcGFja3MgfHwge307XG5cblx0XHRyZXR1cm4gT2JqZWN0LmtleXMoIHRlbXBsYXRlX3BhY2tzICkubWFwKCBmdW5jdGlvbiAoIHRlbXBsYXRlX3BhY2tfaWQgKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRpZDogdGVtcGxhdGVfcGFja19pZCxcblx0XHRcdFx0bGFiZWw6IGxhYmVsc1sgdGVtcGxhdGVfcGFja19pZCBdIHx8IHRlbXBsYXRlX3BhY2tfaWRcblx0XHRcdH07XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlbmRlciB0aGUgZXN0YWJsaXNoZWQgUmVzb3VyY2UgZmlsdGVycyBhYm92ZSB0aGUgYm9yZGVyZWQgbGlzdGluZy5cblx0ICpcblx0ICogRnJlZSBlZGl0aW9ucyBpbnRlbnRpb25hbGx5IHJlbmRlciBubyBmaWx0ZXIgZm9ybSwgbWF0Y2hpbmcgdGhlIGV4aXN0aW5nXG5cdCAqIHBhZ2Ugd2hlcmUgYSBzaW5nbGUgZGVmYXVsdCBSZXNvdXJjZSBtYWtlcyB0aGVzZSBjb250cm9scyB1bm5lY2Vzc2FyeS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBSZWdpc3RlcmVkIGNhdGFsb2cgY29uZmlndXJhdGlvbi5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBmaWx0ZXJzIHRhcmdldCB3YXMgZm91bmQuXG5cdCAqL1xuXHRmdW5jdGlvbiByZW5kZXJfYm9va2luZ19yZXNvdXJjZXNfZmlsdGVycyggY29uZmlnICkge1xuXHRcdHZhciBpbml0aWFsX3JlcXVlc3QgPSBjb25maWcuaW5pdGlhbF9yZXF1ZXN0IHx8IHt9O1xuXHRcdHZhciBtb3VudF9lbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIGNvbmZpZy5tb3VudF9pZCApO1xuXHRcdHZhciBmaWx0ZXJzX3RhcmdldCA9IG1vdW50X2VsZW1lbnQgPyBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2VzLWZpbHRlcnNdJyApIDogbnVsbDtcblxuXHRcdGlmICggISBmaWx0ZXJzX3RhcmdldCApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0ZmlsdGVyc190YXJnZXQuaW5uZXJIVE1MID0gcmVuZGVyX2NvbXBvbmVudCggY29uZmlnLCAnZmlsdGVycycsIHtcblx0XHRcdGkxOG46IGNvbmZpZy5pMThuIHx8IHt9LFxuXHRcdFx0cmVzb3VyY2VfdHlwZTogaW5pdGlhbF9yZXF1ZXN0LnJlc291cmNlX3R5cGUgfHwgJ2FsbCcsXG5cdFx0XHRzZWFyY2g6IGluaXRpYWxfcmVxdWVzdC5zZWFyY2ggfHwgJycsXG5cdFx0XHRzaG93X2ZpbHRlcnM6ICEhICggY29uZmlnLmZlYXR1cmVzICYmIGNvbmZpZy5mZWF0dXJlcy5yZXNvdXJjZV9maWx0ZXJzICksXG5cdFx0XHRzaG93X3Jlc291cmNlX3R5cGVfZmlsdGVyOiAhISAoIGNvbmZpZy5mZWF0dXJlcyAmJiBjb25maWcuZmVhdHVyZXMucmVzb3VyY2VfdHlwZV9maWx0ZXIgKVxuXHRcdH0gKTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlbmRlciBwZXJzaXN0ZW50IGZpbHRlcnMgYW5kIGRpc3BsYXkgY29udHJvbHMgb3V0c2lkZSByZXNwb25zZSBjb250ZW50LlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnIFJlZ2lzdGVyZWQgY2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIHRvb2xiYXIgdGFyZ2V0IHdhcyBwb3B1bGF0ZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiByZW5kZXJfYm9va2luZ19yZXNvdXJjZXNfdG9vbGJhciggY29uZmlnICkge1xuXHRcdHZhciBpbml0aWFsX3JlcXVlc3QgPSBjb25maWcuaW5pdGlhbF9yZXF1ZXN0IHx8IHt9O1xuXHRcdHZhciBtb3VudF9lbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIGNvbmZpZy5tb3VudF9pZCApO1xuXHRcdHZhciB0b29sYmFyX3RhcmdldCA9IG1vdW50X2VsZW1lbnQgPyBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2VzLXRvb2xiYXJdJyApIDogbnVsbDtcblxuXHRcdGlmICggISB0b29sYmFyX3RhcmdldCApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0dG9vbGJhcl90YXJnZXQuaW5uZXJIVE1MID0gcmVuZGVyX2NvbXBvbmVudCggY29uZmlnLCAndG9vbGJhcicsIHtcblx0XHRcdGFjdGl2ZV90ZW1wbGF0ZV9wYWNrOiBpbml0aWFsX3JlcXVlc3QudGVtcGxhdGVfcGFjayB8fCBjb25maWcuZGVmYXVsdF90ZW1wbGF0ZV9wYWNrIHx8ICd0YWJsZScsXG5cdFx0XHRhY3RpdmVfdmlldzogZ2V0X2FjdGl2ZV92aWV3KCBjb25maWcsIGluaXRpYWxfcmVxdWVzdCApLFxuXHRcdFx0Y29sdW1uczogZ2V0X2NvbHVtbnMoIGNvbmZpZywgaW5pdGlhbF9yZXF1ZXN0LCBmYWxzZSwgaW5pdGlhbF9yZXF1ZXN0ICksXG5cdFx0XHRpMThuOiBjb25maWcuaTE4biB8fCB7fSxcblx0XHRcdHRlbXBsYXRlX3BhY2tzOiBnZXRfdGVtcGxhdGVfcGFja19kZWZpbml0aW9ucyggY29uZmlnICksXG5cdFx0XHR2aWV3czogZ2V0X3ZpZXdfZGVmaW5pdGlvbnMoIGNvbmZpZyApXG5cdFx0fSApO1xuXHRcdGlmICggY2F0YWxvZ19jb250cm9sbGVyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBjYXRhbG9nX2NvbnRyb2xsZXIucmVmcmVzaF9jb250cm9scyApIHtcblx0XHRcdGNhdGFsb2dfY29udHJvbGxlci5yZWZyZXNoX2NvbnRyb2xzKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuICEhIHRvb2xiYXJfdGFyZ2V0LmZpcnN0RWxlbWVudENoaWxkO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFkZCBmdWxsLXRleHQgdG9vbHRpcHMgb25seSB0byBlbGVtZW50cyB3aG9zZSByZW5kZXJlZCB0ZXh0IGlzIGNsaXBwZWQuXG5cdCAqXG5cdCAqIE5hdGl2ZSB0aXRsZSB0ZXh0IHJlbWFpbnMgYXZhaWxhYmxlIHdpdGhvdXQgYSBKYXZhU2NyaXB0IHRvb2x0aXAgbGlicmFyeTtcblx0ICogdGhlIGVzdGFibGlzaGVkIHRvb2x0aXAgYXR0cmlidXRlcyBhcmUgYWxzbyBzdXBwbGllZCBmb3IgQm9va2luZyBDYWxlbmRhclxuXHQgKiBhZG1pbiB0aGVtZXMgdGhhdCBpbml0aWFsaXplIHRoZW0gZ2xvYmFsbHkuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGNhdGFsb2dfbW91bnQgQ2F0YWxvZyBtb3VudCBlbGVtZW50LlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3luY2hyb25pemVfb3ZlcmZsb3dfdG9vbHRpcHMoIGNhdGFsb2dfbW91bnQgKSB7XG5cdFx0aWYgKCAhIHdpbmRvdy53cGJjX3VpX2NhdGFsb2cgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy53cGJjX3VpX2NhdGFsb2cuc3luY2hyb25pemVfb3ZlcmZsb3dfdG9vbHRpcHMgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0d2luZG93LndwYmNfdWlfY2F0YWxvZy5zeW5jaHJvbml6ZV9vdmVyZmxvd190b29sdGlwcyggY2F0YWxvZ19tb3VudCApO1xuXHR9XG5cblx0LyoqXG5cdCAqIEluaXRpYWxpemUgdG9vbHRpcHMgZm9yIGNvbXBhY3QgY29udHJvbHMgaW5zZXJ0ZWQgYnkgYSBsYXp5IGRldGFpbHMgcmVuZGVyLlxuXHQgKlxuXHQgKiBUaGUgbmF0aXZlIHRpdGxlIHJlbWFpbnMgYXMgYSBmYWxsYmFjayB3aGVuIHRoZSBlc3RhYmxpc2hlZCBCb29raW5nXG5cdCAqIENhbGVuZGFyIHRvb2x0aXAgaGVscGVyIGlzIHVuYXZhaWxhYmxlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBjYXRhbG9nX21vdW50IENhdGFsb2cgbW91bnQgZWxlbWVudC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGluaXRpYWxpemVfZGV0YWlsc190b29sdGlwcyggY2F0YWxvZ19tb3VudCApIHtcblx0XHR2YXIgdG9vbHRpcF9zZWxlY3RvcjtcblxuXHRcdGlmICggISBjYXRhbG9nX21vdW50IHx8ICEgY2F0YWxvZ19tb3VudC5pZCB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93LndwYmNfZGVmaW5lX3RpcHB5X3Rvb2x0aXBzICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0b29sdGlwX3NlbGVjdG9yID0gJyMnICsgY2F0YWxvZ19tb3VudC5pZCArICcgW2RhdGEtd3BiYy11aS1jYXRhbG9nLWRldGFpbHMtdG9vbHRpcF0nO1xuXHRcdHdpbmRvdy53cGJjX2RlZmluZV90aXBweV90b29sdGlwcyggdG9vbHRpcF9zZWxlY3RvciApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFN5bmNocm9uaXplIHBlcnNpc3RlbnQgY29udHJvbHMgd2l0aCBzZXJ2ZXItYXV0aG9yaXRhdGl2ZSByZXNwb25zZSBzdGF0ZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyAgIFJlZ2lzdGVyZWQgY2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gcmVzcG9uc2UgTm9ybWFsaXplZCBjYXRhbG9nIHJlc3BvbnNlLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3luY2hyb25pemVfYm9va2luZ19yZXNvdXJjZXNfdG9vbGJhciggY29uZmlnLCByZXNwb25zZSApIHtcblx0XHR2YXIgY29sdW1ucyA9IGdldF9jb2x1bW5zKCBjb25maWcsIHJlc3BvbnNlLmRpc3BsYXkgfHwge30sIGZhbHNlLCByZXNwb25zZS5zb3J0aW5nIHx8IHt9ICk7XG5cdFx0dmFyIG1vdW50X2VsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggY29uZmlnLm1vdW50X2lkICk7XG5cdFx0dmFyIGNvbHVtbl9saXN0ID0gbW91bnRfZWxlbWVudCA/IG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1jb2x1bW4tbGlzdF0nICkgOiBudWxsO1xuXHRcdHZhciBzZWFyY2hfY29udHJvbCA9IG1vdW50X2VsZW1lbnQgPyBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctc2VhcmNoXScgKSA6IG51bGw7XG5cdFx0dmFyIHRlbXBsYXRlX3BhY2tfY29udHJvbCA9IG1vdW50X2VsZW1lbnQgPyBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctdGVtcGxhdGUtcGFja10nICkgOiBudWxsO1xuXHRcdHZhciB0eXBlX2NvbnRyb2wgPSBtb3VudF9lbGVtZW50ID8gbW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWZpbHRlcj1cInJlc291cmNlX3R5cGVcIl0nICkgOiBudWxsO1xuXHRcdHZhciB2aWV3X2NvbnRyb2wgPSBtb3VudF9lbGVtZW50ID8gbW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXZpZXddJyApIDogbnVsbDtcblxuXHRcdGlmICggc2VhcmNoX2NvbnRyb2wgJiYgZG9jdW1lbnQuYWN0aXZlRWxlbWVudCAhPT0gc2VhcmNoX2NvbnRyb2wgKSB7XG5cdFx0XHRzZWFyY2hfY29udHJvbC52YWx1ZSA9IHJlc3BvbnNlLmZpbHRlcnMuc2VhcmNoIHx8ICcnO1xuXHRcdH1cblx0XHRpZiAoIHR5cGVfY29udHJvbCApIHtcblx0XHRcdHR5cGVfY29udHJvbC52YWx1ZSA9IHJlc3BvbnNlLmZpbHRlcnMucmVzb3VyY2VfdHlwZSB8fCAnYWxsJztcblx0XHR9XG5cdFx0aWYgKCB0ZW1wbGF0ZV9wYWNrX2NvbnRyb2wgJiYgcmVzcG9uc2UuZGlzcGxheSAmJiByZXNwb25zZS5kaXNwbGF5LnRlbXBsYXRlX3BhY2sgKSB7XG5cdFx0XHR0ZW1wbGF0ZV9wYWNrX2NvbnRyb2wudmFsdWUgPSByZXNwb25zZS5kaXNwbGF5LnRlbXBsYXRlX3BhY2s7XG5cdFx0fVxuXHRcdGNvbHVtbnMuZm9yRWFjaCggZnVuY3Rpb24gKCBjb2x1bW4gKSB7XG5cdFx0XHR2YXIgY29sdW1uX2NvbnRyb2wgPSBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctY29sdW1uLXZpc2libGVdW3ZhbHVlPVwiJyArIGNvbHVtbi5pZCArICdcIl0nICk7XG5cdFx0XHR2YXIgY29sdW1uX2l0ZW0gPSBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctY29sdW1uLWl0ZW09XCInICsgY29sdW1uLmlkICsgJ1wiXScgKTtcblx0XHRcdGlmICggY29sdW1uX2NvbnRyb2wgKSB7XG5cdFx0XHRcdGNvbHVtbl9jb250cm9sLmNoZWNrZWQgPSBjb2x1bW4udmlzaWJsZTtcblx0XHRcdH1cblx0XHRcdGlmICggY29sdW1uX2xpc3QgJiYgY29sdW1uX2l0ZW0gKSB7XG5cdFx0XHRcdGNvbHVtbl9saXN0LmFwcGVuZENoaWxkKCBjb2x1bW5faXRlbSApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0XHRpZiAoIHZpZXdfY29udHJvbCApIHtcblx0XHRcdHZpZXdfY29udHJvbC52YWx1ZSA9IGdldF9hY3RpdmVfdmlldyggY29uZmlnLCByZXNwb25zZS5kaXNwbGF5IHx8IHt9ICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFJlbmRlciB0aGUgcGVyc2lzdGVudCBpbmxpbmUtZWRpdCBzdGF0dXMgYmFyIGZyb20gaXRzIHJlZ2lzdGVyZWQgdGVtcGxhdGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgQ2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gcmVuZGVyX2lubGluZV9iYXIoIGNvbmZpZyApIHtcblx0XHR2YXIgbW91bnRfZWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBjb25maWcubW91bnRfaWQgKTtcblx0XHR2YXIgaW5saW5lX2hvc3QgPSBtb3VudF9lbGVtZW50ID8gbW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLWlubGluZS1iYXItaG9zdF0nICkgOiBudWxsO1xuXG5cdFx0aWYgKCBpbmxpbmVfaG9zdCAmJiAhIGlubGluZV9ob3N0LmZpcnN0RWxlbWVudENoaWxkICkge1xuXHRcdFx0aW5saW5lX2hvc3QuaW5uZXJIVE1MID0gcmVuZGVyX2NvbXBvbmVudCggY29uZmlnLCAnaW5saW5lX2JhcicsIHsgaTE4bjogY29uZmlnLmkxOG4gfHwge30gfSApO1xuXHRcdH1cblx0XHRpZiAoIGlubGluZV93b3JrZmxvd19jb250cm9sbGVyICkge1xuXHRcdFx0aW5saW5lX3dvcmtmbG93X2NvbnRyb2xsZXIucmVnaXN0ZXJfc3RpY2t5X2JhcigpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBTeW5jaHJvbml6ZSBpbmxpbmUgYWN0aXZhdGlvbiwgY2hhbmdlZCBjb3VudCwgYW5kIGRpc2FibGVkIG5hdmlnYXRpb24uXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgQ2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3luY2hyb25pemVfaW5saW5lX2NvbnRyb2xzKCBjb25maWcgKSB7XG5cdFx0dmFyIG1vdW50X2VsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggY29uZmlnLm1vdW50X2lkICk7XG5cdFx0dmFyIGNoYW5nZWRfY291bnQgPSBpbmxpbmVfc3RhdGUuY2hhbmdlZF9yb3dzLmxlbmd0aDtcblx0XHR2YXIgY291bnRfbGFiZWwgPSAxID09PSBjaGFuZ2VkX2NvdW50ID8gY29uZmlnLmkxOG4uaW5saW5lX2NoYW5nZWRfcm93IDogY29uZmlnLmkxOG4uaW5saW5lX2NoYW5nZWRfcm93cztcblxuXHRcdGlmICggISBtb3VudF9lbGVtZW50IHx8ICEgaW5saW5lX3dvcmtmbG93X2NvbnRyb2xsZXIgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aW5saW5lX3dvcmtmbG93X2NvbnRyb2xsZXIuc3luY2hyb25pemUoIHtcblx0XHRcdGFjdGl2ZTogaW5saW5lX3N0YXRlLmFjdGl2ZSxcblx0XHRcdGFjdGl2ZV90b2dnbGVfdGV4dDogY29uZmlnLmkxOG4uaW5saW5lX2VkaXRpbmdfcm93cyB8fCAnJyxcblx0XHRcdGJ1c3k6IGlubGluZV9zdGF0ZS5sb2FkaW5nLFxuXHRcdFx0Y2hhbmdlZF9jb3VudDogY2hhbmdlZF9jb3VudCxcblx0XHRcdGNvdW50X3RleHQ6IGlubGluZV9zdGF0ZS5sb2FkaW5nXG5cdFx0XHRcdD8gY29uZmlnLmkxOG4uaW5saW5lX2xvYWRpbmcgfHwgJydcblx0XHRcdFx0OiBmb3JtYXRfbWVzc2FnZSggY291bnRfbGFiZWwgfHwgJyUxJHMgY2hhbmdlZCByb3dzJywgWyBjaGFuZ2VkX2NvdW50IF0gKSxcblx0XHRcdGhhc19pdGVtczogISEgbW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWlkXScgKSxcblx0XHRcdGluYWN0aXZlX3RvZ2dsZV90ZXh0OiBjb25maWcuaTE4bi5lZGl0X3Jvd3MgfHwgJydcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogQmxvY2sgcGFnZS1jaGFuZ2luZyBjYXRhbG9nIGNvbnRyb2xzIGJlZm9yZSBzaGFyZWQgaGFuZGxlcnMgY2FuIGRpc2NhcmQgZHJhZnRzLlxuXHQgKlxuXHQgKiBOYXRpdmUgc3VtbWFyeSBlbGVtZW50cyBkbyBub3QgaG9ub3IgYSBkaXNhYmxlZCBwcm9wZXJ0eSwgc28gdGhpcyBjYXB0dXJlXG5cdCAqIGd1YXJkIGNvbXBsZW1lbnRzIHRoZSB2aXN1YWwgZGlzYWJsZWQgc3RhdGUgd2hpbGUgaW5saW5lIGVkaXRpbmcgaXMgYWN0aXZlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudCBDYXB0dXJlZCBjYXRhbG9nIGV2ZW50LlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gcHJvdGVjdF9pbmxpbmVfZHJhZnRzX2Zyb21fY2F0YWxvZ19jb250cm9scyggZXZlbnQgKSB7XG5cdFx0aWYgKCBpbmxpbmVfd29ya2Zsb3dfY29udHJvbGxlciApIHtcblx0XHRcdGlubGluZV93b3JrZmxvd19jb250cm9sbGVyLnByb3RlY3RfZXZlbnQoIGV2ZW50LCBpbmxpbmVfc3RhdGUuYWN0aXZlICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFNob3cgb3IgY2xlYXIgYW4gaW5saW5lIHdvcmtmbG93IGVycm9yLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnIENhdGFsb2cgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgU2FmZSBtZXNzYWdlIG9yIGVtcHR5IHN0cmluZy5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHNob3dfaW5saW5lX21lc3NhZ2UoIGNvbmZpZywgbWVzc2FnZSApIHtcblx0XHR2YXIgbW91bnRfZWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBjb25maWcubW91bnRfaWQgKTtcblx0XHR2YXIgbm90aWNlID0gbW91bnRfZWxlbWVudCA/IG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1pbmxpbmUtbWVzc2FnZV0nICkgOiBudWxsO1xuXG5cdFx0aWYgKCBub3RpY2UgKSB7XG5cdFx0XHRub3RpY2UuaGlkZGVuID0gISBtZXNzYWdlO1xuXHRcdFx0dmFyIHRleHQgPSBub3RpY2UucXVlcnlTZWxlY3RvciggJ3AnICk7XG5cdFx0XHRpZiAoIHRleHQgKSB7XG5cdFx0XHRcdHRleHQudGV4dENvbnRlbnQgPSBtZXNzYWdlIHx8ICcnO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBSZW5kZXIgb25lIHNlcnZlci1kZWNsYXJlZCBmaWVsZCB0aHJvdWdoIHRoZSBpbmxpbmUgV1AgdGVtcGxhdGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgQ2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gcm93X3NjaGVtYSBSb3cgc2NoZW1hLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gcmVuZGVyX2lubGluZV9yb3coIGNvbmZpZywgcm93X3NjaGVtYSApIHtcblx0XHR2YXIgbW91bnRfZWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBjb25maWcubW91bnRfaWQgKTtcblx0XHR2YXIgcmVzb3VyY2VfaWQgPSBOdW1iZXIoIHJvd19zY2hlbWEucmVzb3VyY2VfaWQgKSB8fCAwO1xuXHRcdHZhciByb3cgPSBtb3VudF9lbGVtZW50ID8gbW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWlkPVwiJyArIHJlc291cmNlX2lkICsgJ1wiXScgKSA6IG51bGw7XG5cdFx0dmFyIHJlc291cmNlX2ZpZWxkcyA9IFtdO1xuXG5cdFx0aWYgKCAhIHJvdyApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0KCByb3dfc2NoZW1hLmZpZWxkcyB8fCBbXSApLmZvckVhY2goIGZ1bmN0aW9uICggZmllbGQgKSB7XG5cdFx0XHR2YXIgY2VsbCA9IHJvdy5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWZpZWxkPVwiJyArIFN0cmluZyggZmllbGQuY29sdW1uIHx8ICcnICkgKyAnXCJdJyApO1xuXHRcdFx0aWYgKCAhIGNlbGwgfHwgY2VsbC5oaWRkZW4gKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggJ3Jlc291cmNlJyA9PT0gZmllbGQuY29sdW1uICkge1xuXHRcdFx0XHRyZXNvdXJjZV9maWVsZHMucHVzaCggZmllbGQgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y2VsbC5pbm5lckhUTUwgPSByZW5kZXJfY29tcG9uZW50KCBjb25maWcsICdpbmxpbmVfZmllbGQnLCB7IGZpZWxkOiBmaWVsZCwgcmVzb3VyY2VfaWQ6IHJlc291cmNlX2lkIH0gKTtcblx0XHR9ICk7XG5cdFx0aWYgKCByZXNvdXJjZV9maWVsZHMubGVuZ3RoICkge1xuXHRcdFx0dmFyIGNvcHkgPSByb3cucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1maWVsZD1cInJlc291cmNlXCJdIC53cGJjX3VpX2xpc3RpbmdfX2l0ZW1fY29weScgKTtcblx0XHRcdGlmICggY29weSApIHtcblx0XHRcdFx0dmFyIHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnc3BhbicgKTtcblx0XHRcdFx0d3JhcHBlci5jbGFzc05hbWUgPSAnd3BiY19ib29raW5nX3Jlc291cmNlc19faW5saW5lX2lkZW50aXR5X2ZpZWxkcyc7XG5cdFx0XHRcdHJlc291cmNlX2ZpZWxkcy5mb3JFYWNoKCBmdW5jdGlvbiAoIGZpZWxkICkge1xuXHRcdFx0XHRcdHdyYXBwZXIuaW5zZXJ0QWRqYWNlbnRIVE1MKCAnYmVmb3JlZW5kJywgcmVuZGVyX2NvbXBvbmVudCggY29uZmlnLCAnaW5saW5lX2ZpZWxkJywgeyBmaWVsZDogZmllbGQsIHJlc291cmNlX2lkOiByZXNvdXJjZV9pZCB9ICkgKTtcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRjb3B5LnJlcGxhY2VXaXRoKCB3cmFwcGVyICk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIENvbGxlY3Qgb25seSBjaGFuZ2VkIHJvdyBmaWVsZHMgd2hpbGUgcHJlc2VydmluZyB2aXNpYmxlIGNhdGFsb2cgb3JkZXIuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgQ2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcmV0dXJuIHtBcnJheTxPYmplY3Q+fSBDaGFuZ2VkIHJvdyBlbnZlbG9wZXMuXG5cdCAqL1xuXHRmdW5jdGlvbiBjb2xsZWN0X2lubGluZV9kcmFmdHMoIGNvbmZpZyApIHtcblx0XHR2YXIgbW91bnRfZWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBjb25maWcubW91bnRfaWQgKTtcblx0XHR2YXIgY2hhbmdlZF9yb3dzID0gW107XG5cblx0XHRpZiAoICEgbW91bnRfZWxlbWVudCApIHtcblx0XHRcdHJldHVybiBjaGFuZ2VkX3Jvd3M7XG5cdFx0fVxuXHRcdG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2Jvb2tpbmdfcmVzb3VyY2VzX19pdGVtW2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWlkXScgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHJvdyApIHtcblx0XHRcdHZhciBmaWVsZHMgPSB7fTtcblx0XHRcdHZhciBoYXNfY2hhbmdlcztcblx0XHRcdHZhciBpbmRpY2F0b3JfaG9zdDtcblxuXHRcdFx0cm93LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLWNhdGFsb2ctaW5saW5lLWZpZWxkXScgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGNvbnRyb2wgKSB7XG5cdFx0XHRcdHZhciBmaWVsZF9rZXkgPSBjb250cm9sLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1jYXRhbG9nLWlubGluZS1maWVsZCcgKSB8fCAnJztcblx0XHRcdFx0aWYgKCBmaWVsZF9rZXkgJiYgU3RyaW5nKCBjb250cm9sLnZhbHVlIHx8ICcnICkgIT09IFN0cmluZyggY29udHJvbC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtY2F0YWxvZy1pbmxpbmUtb3JpZ2luYWwnICkgfHwgJycgKSApIHtcblx0XHRcdFx0XHRmaWVsZHNbIGZpZWxkX2tleSBdID0gY29udHJvbC52YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0aGFzX2NoYW5nZXMgPSAwIDwgT2JqZWN0LmtleXMoIGZpZWxkcyApLmxlbmd0aDtcblx0XHRcdGluZGljYXRvcl9ob3N0ID0gcm93LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctZmllbGQ9XCJyZXNvdXJjZVwiXScgKTtcblx0XHRcdHJvdy5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtaW5saW5lLWRpcnR5JywgaGFzX2NoYW5nZXMgKTtcblx0XHRcdGlmICggaW5saW5lX3dvcmtmbG93X2NvbnRyb2xsZXIgKSB7XG5cdFx0XHRcdGlubGluZV93b3JrZmxvd19jb250cm9sbGVyLnNldF9yb3dfY2hhbmdlZCggcm93LCBoYXNfY2hhbmdlcywgaW5kaWNhdG9yX2hvc3QsIGNvbmZpZy5pMThuLmlubGluZV9jaGFuZ2VkIHx8ICcnICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGhhc19jaGFuZ2VzICkge1xuXHRcdFx0XHRjaGFuZ2VkX3Jvd3MucHVzaCggeyByZXNvdXJjZV9pZDogTnVtYmVyKCByb3cuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtaWQnICkgKSwgZmllbGRzOiBmaWVsZHMgfSApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblxuXHRcdHJldHVybiBjaGFuZ2VkX3Jvd3M7XG5cdH1cblxuXHQvKipcblx0ICogSW52YWxpZGF0ZSBhIHByaW9yIHJldmlldyBhbmQgc3luY2hyb25pemUgZHJhZnQgc3RhdGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgQ2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3luY2hyb25pemVfaW5saW5lX2RyYWZ0cyggY29uZmlnICkge1xuXHRcdGlubGluZV9zdGF0ZS5jaGFuZ2VkX3Jvd3MgPSBjb2xsZWN0X2lubGluZV9kcmFmdHMoIGNvbmZpZyApO1xuXHRcdGlubGluZV9zdGF0ZS5yZXZpZXdfdG9rZW4gPSAnJztcblx0XHRzaG93X2lubGluZV9tZXNzYWdlKCBjb25maWcsICcnICk7XG5cdFx0c3luY2hyb25pemVfaW5saW5lX2NvbnRyb2xzKCBjb25maWcgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBFeGl0IGlubGluZSBtb2RlIGFuZCBvcHRpb25hbGx5IHJlbG9hZCBjYW5vbmljYWwgcm93cy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gcmVsb2FkIFdoZXRoZXIgdG8gcmVsb2FkIHRoZSBjYXRhbG9nLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSBPcHRpb25hbCBzdWNjZXNzIG1lc3NhZ2UuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBsZWF2ZV9pbmxpbmVfbW9kZSggY29uZmlnLCByZWxvYWQsIG1lc3NhZ2UgKSB7XG5cdFx0aW5saW5lX3N0YXRlLnJlcXVlc3Rfc2VxdWVuY2UgKz0gMTtcblx0XHRpbmxpbmVfc3RhdGUuYWN0aXZlID0gZmFsc2U7XG5cdFx0aW5saW5lX3N0YXRlLmxvYWRpbmcgPSBmYWxzZTtcblx0XHRpbmxpbmVfc3RhdGUuY2hhbmdlZF9yb3dzID0gW107XG5cdFx0aW5saW5lX3N0YXRlLnJldmlld190b2tlbiA9ICcnO1xuXHRcdGlmICggJ2lubGluZV9yZXZpZXcnID09PSBpbnNwZWN0b3JfbW9kZSApIHtcblx0XHRcdGNsb3NlX2luc3BlY3RvciggY29uZmlnLCBmYWxzZSApO1xuXHRcdH1cblx0XHRzeW5jaHJvbml6ZV9pbmxpbmVfY29udHJvbHMoIGNvbmZpZyApO1xuXHRcdGlmICggbWVzc2FnZSApIHtcblx0XHRcdHNob3dfYWRtaW5fbWVzc2FnZSggbWVzc2FnZSwgJ3N1Y2Nlc3MnLCA0MDAwICk7XG5cdFx0fVxuXHRcdGlmICggcmVsb2FkICYmIGNhdGFsb2dfY29udHJvbGxlciApIHtcblx0XHRcdGNhdGFsb2dfY29udHJvbGxlci5sb2FkKCk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFN0YXJ0IHJvdyBlZGl0aW5nIGZvciB0aGUgY3VycmVudCB2aXNpYmxlIFJlc291cmNlIHBhZ2UuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgQ2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3RhcnRfaW5saW5lX21vZGUoIGNvbmZpZyApIHtcblx0XHR2YXIgbW91bnRfZWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBjb25maWcubW91bnRfaWQgKTtcblx0XHR2YXIgcmVzb3VyY2VfaWRzID0gW107XG5cdFx0dmFyIHJlcXVlc3Rfc2VxdWVuY2U7XG5cblx0XHRpZiAoIGlubGluZV9zdGF0ZS5hY3RpdmUgKSB7XG5cdFx0XHRzeW5jaHJvbml6ZV9pbmxpbmVfZHJhZnRzKCBjb25maWcgKTtcblx0XHRcdGlmICggISBpbmxpbmVfc3RhdGUuY2hhbmdlZF9yb3dzLmxlbmd0aCB8fCB3aW5kb3cuY29uZmlybSggY29uZmlnLmkxOG4uaW5saW5lX2Rpc2NhcmQgfHwgJycgKSApIHtcblx0XHRcdFx0bGVhdmVfaW5saW5lX21vZGUoIGNvbmZpZywgdHJ1ZSwgJycgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0bW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYm9va2luZ19yZXNvdXJjZXNfX2l0ZW1bZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtaWRdJyApLmZvckVhY2goIGZ1bmN0aW9uICggcm93ICkge1xuXHRcdFx0cmVzb3VyY2VfaWRzLnB1c2goIE51bWJlciggcm93LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWlkJyApICkgKTtcblx0XHR9ICk7XG5cdFx0aWYgKCAhIHJlc291cmNlX2lkcy5sZW5ndGggKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICggISBjYW5fZGlzY2FyZF9pbnNwZWN0b3IoIGNvbmZpZyApICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjbG9zZV9pbnNwZWN0b3IoIGNvbmZpZywgZmFsc2UgKTtcblx0XHRtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctZGlzcGxheS1jdXN0b21pemVyXVtvcGVuXScgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGN1c3RvbWl6ZXIgKSB7XG5cdFx0XHRjdXN0b21pemVyLnJlbW92ZUF0dHJpYnV0ZSggJ29wZW4nICk7XG5cdFx0fSApO1xuXHRcdGlubGluZV9zdGF0ZS5hY3RpdmUgPSB0cnVlO1xuXHRcdGlubGluZV9zdGF0ZS5sb2FkaW5nID0gdHJ1ZTtcblx0XHRpbmxpbmVfc3RhdGUuY2hhbmdlZF9yb3dzID0gW107XG5cdFx0cmVxdWVzdF9zZXF1ZW5jZSA9ICsraW5saW5lX3N0YXRlLnJlcXVlc3Rfc2VxdWVuY2U7XG5cdFx0Y2xvc2VfZGV0YWlsc19yb3coIGZhbHNlICk7XG5cdFx0c3luY2hyb25pemVfaW5saW5lX2NvbnRyb2xzKCBjb25maWcgKTtcblx0XHRyZXF1ZXN0X2luc3BlY3RvciggY29uZmlnLCBjb25maWcuaW5saW5lX3NjaGVtYV9hY3Rpb24sIHsgcmVzb3VyY2VfaWRzOiBKU09OLnN0cmluZ2lmeSggcmVzb3VyY2VfaWRzICkgfSApLnRoZW4oIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRpZiAoIHJlcXVlc3Rfc2VxdWVuY2UgIT09IGlubGluZV9zdGF0ZS5yZXF1ZXN0X3NlcXVlbmNlIHx8ICEgaW5saW5lX3N0YXRlLmFjdGl2ZSB8fCAhIHJlc3BvbnNlIHx8ICEgcmVzcG9uc2Uuc3VjY2VzcyB8fCAhIHJlc3BvbnNlLmRhdGEgfHwgISByZXNwb25zZS5kYXRhLnNjaGVtYSApIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCBnZXRfaW5zcGVjdG9yX3Jlc3BvbnNlX21lc3NhZ2UoIHJlc3BvbnNlLCBjb25maWcuaTE4bi5pbmxpbmVfbG9hZF9mYWlsZWQgKSApO1xuXHRcdFx0fVxuXHRcdFx0KCByZXNwb25zZS5kYXRhLnNjaGVtYS5yb3dzIHx8IFtdICkuZm9yRWFjaCggZnVuY3Rpb24gKCByb3dfc2NoZW1hICkge1xuXHRcdFx0XHRyZW5kZXJfaW5saW5lX3JvdyggY29uZmlnLCByb3dfc2NoZW1hICk7XG5cdFx0XHR9ICk7XG5cdFx0XHR2YXIgZmlyc3RfZmllbGQgPSBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctaW5saW5lLWZpZWxkXScgKTtcblx0XHRcdGlmICggZmlyc3RfZmllbGQgKSB7XG5cdFx0XHRcdGZpcnN0X2ZpZWxkLmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fSApLmNhdGNoKCBmdW5jdGlvbiAoIGVycm9yICkge1xuXHRcdFx0aWYgKCByZXF1ZXN0X3NlcXVlbmNlID09PSBpbmxpbmVfc3RhdGUucmVxdWVzdF9zZXF1ZW5jZSApIHtcblx0XHRcdFx0c2hvd19hZG1pbl9tZXNzYWdlKCBlcnJvci5tZXNzYWdlIHx8IGNvbmZpZy5pMThuLmlubGluZV9sb2FkX2ZhaWxlZCB8fCAnJywgJ2Vycm9yJywgNTAwMCApO1xuXHRcdFx0XHRpbmxpbmVfc3RhdGUuYWN0aXZlID0gZmFsc2U7XG5cdFx0XHRcdGlmICggY2F0YWxvZ19jb250cm9sbGVyICkge1xuXHRcdFx0XHRcdGNhdGFsb2dfY29udHJvbGxlci5sb2FkKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9ICkudGhlbiggZnVuY3Rpb24gKCkge1xuXHRcdFx0aWYgKCByZXF1ZXN0X3NlcXVlbmNlID09PSBpbmxpbmVfc3RhdGUucmVxdWVzdF9zZXF1ZW5jZSApIHtcblx0XHRcdFx0aW5saW5lX3N0YXRlLmxvYWRpbmcgPSBmYWxzZTtcblx0XHRcdFx0c3luY2hyb25pemVfaW5saW5lX2NvbnRyb2xzKCBjb25maWcgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogUHJldmlldyBjdXJyZW50IGlubGluZSBkcmFmdHMgYW5kIG9wZW4gdGhlaXIgc2lnbmVkIHJldmlldyBpbnNwZWN0b3IuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgQ2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBmb2N1c190YXJnZXQgUmV2aWV3IHRyaWdnZXIgZm9yIGZvY3VzIHJlc3RvcmF0aW9uLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gcHJldmlld19pbmxpbmVfY2hhbmdlcyggY29uZmlnLCBmb2N1c190YXJnZXQgKSB7XG5cdFx0dmFyIGluc3BlY3Rvcl93b3JrZmxvdztcblx0XHR2YXIgcmVxdWVzdF9zZXF1ZW5jZTtcblxuXHRcdHN5bmNocm9uaXplX2lubGluZV9kcmFmdHMoIGNvbmZpZyApO1xuXHRcdGluc3BlY3Rvcl93b3JrZmxvdyA9IGdldF9pbnNwZWN0b3Jfd29ya2Zsb3coIGNvbmZpZyApO1xuXHRcdGlmICggISBpbmxpbmVfc3RhdGUuY2hhbmdlZF9yb3dzLmxlbmd0aCB8fCBpbmxpbmVfc3RhdGUubG9hZGluZyB8fCAhIGluc3BlY3Rvcl93b3JrZmxvdyB8fCAhIGluc3BlY3Rvcl93b3JrZmxvdy5tb3VudCgpICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpbmxpbmVfc3RhdGUubG9hZGluZyA9IHRydWU7XG5cdFx0cmVxdWVzdF9zZXF1ZW5jZSA9ICsraW5saW5lX3N0YXRlLnJlcXVlc3Rfc2VxdWVuY2U7XG5cdFx0aW5zcGVjdG9yX2ZvY3VzX3RhcmdldCA9IGZvY3VzX3RhcmdldDtcblx0XHRpbnNwZWN0b3JfbW9kZSA9ICdpbmxpbmVfcmV2aWV3Jztcblx0XHRpbnNwZWN0b3JfZGlydHkgPSB0cnVlO1xuXHRcdGlmICggISBpbnNwZWN0b3Jfd29ya2Zsb3cub3Blbl9sb2FkaW5nKCkgKSB7XG5cdFx0XHRpbmxpbmVfc3RhdGUubG9hZGluZyA9IGZhbHNlO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRzeW5jaHJvbml6ZV9pbmxpbmVfY29udHJvbHMoIGNvbmZpZyApO1xuXHRcdHJlcXVlc3RfaW5zcGVjdG9yKCBjb25maWcsIGNvbmZpZy5pbmxpbmVfcHJldmlld19hY3Rpb24sIHsgcm93czogSlNPTi5zdHJpbmdpZnkoIGlubGluZV9zdGF0ZS5jaGFuZ2VkX3Jvd3MgKSB9ICkudGhlbiggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdHZhciByZXZpZXdfd29ya2Zsb3c7XG5cdFx0XHR2YXIgcmV2aWV3X21vZGVsO1xuXHRcdFx0dmFyIHRhcmdldDtcblx0XHRcdGlmICggcmVxdWVzdF9zZXF1ZW5jZSAhPT0gaW5saW5lX3N0YXRlLnJlcXVlc3Rfc2VxdWVuY2UgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggISByZXNwb25zZSB8fCAhIHJlc3BvbnNlLnN1Y2Nlc3MgfHwgISByZXNwb25zZS5kYXRhIHx8ICEgcmVzcG9uc2UuZGF0YS5wcmV2aWV3ICkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoIGdldF9pbnNwZWN0b3JfcmVzcG9uc2VfbWVzc2FnZSggcmVzcG9uc2UsIGNvbmZpZy5pMThuLmlubGluZV9yZXZpZXdfZmFpbGVkICkgKTtcblx0XHRcdH1cblx0XHRcdGlubGluZV9zdGF0ZS5yZXZpZXdfdG9rZW4gPSBTdHJpbmcoIHJlc3BvbnNlLmRhdGEucHJldmlldy5yZXZpZXdfdG9rZW4gfHwgJycgKTtcblx0XHRcdHRhcmdldCA9IGdldF9pbnNwZWN0b3JfaG9zdCgpLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5zcGVjdG9yLWZvcm1dJyApO1xuXHRcdFx0cmV2aWV3X3dvcmtmbG93ID0gZ2V0X2lubGluZV9yZXZpZXdfd29ya2Zsb3coKTtcblx0XHRcdHJldmlld19tb2RlbCA9IHJldmlld193b3JrZmxvdyA/IHJldmlld193b3JrZmxvdy5wcmVwYXJlKCByZXNwb25zZS5kYXRhLnByZXZpZXcucmV2aWV3IHx8IHt9LCB7XG5cdFx0XHRcdGNoYW5nZWRfbGFiZWw6IGZvcm1hdF9tZXNzYWdlKCAxID09PSBpbmxpbmVfc3RhdGUuY2hhbmdlZF9yb3dzLmxlbmd0aCA/IGNvbmZpZy5pMThuLmlubGluZV9jaGFuZ2VkX3JvdyA6IGNvbmZpZy5pMThuLmlubGluZV9jaGFuZ2VkX3Jvd3MsIFsgaW5saW5lX3N0YXRlLmNoYW5nZWRfcm93cy5sZW5ndGggXSApLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogY29uZmlnLmkxOG4uaW5saW5lX3Jldmlld19kZXNjcmlwdGlvbiB8fCAnJyxcblx0XHRcdFx0Zm9ybV9pZDogJ3dwYmNfY2F0YWxvZ19ib29raW5nX3Jlc291cmNlc19pbmxpbmVfcmV2aWV3X2Zvcm0nLFxuXHRcdFx0XHRtb2RlOiAnaW5saW5lX3JldmlldycsXG5cdFx0XHRcdHBlbmRpbmdfbWVzc2FnZTogY29uZmlnLmkxOG4ucmV2aWV3X2NoYW5nZXNfaGVscCB8fCAnJyxcblx0XHRcdFx0dGl0bGU6IGNvbmZpZy5pMThuLmlubGluZV9yZXZpZXdfdGl0bGUgfHwgJydcblx0XHRcdH0gKSA6IHt9O1xuXHRcdFx0dGFyZ2V0LmlubmVySFRNTCA9IHJlbmRlcl9jb21wb25lbnQoIGNvbmZpZywgJ2luc3BlY3Rvcl9pbmxpbmVfcmV2aWV3JywgcmV2aWV3X21vZGVsICk7XG5cdFx0XHRzZXRfaW5zcGVjdG9yX3N0YXRlKCAnZm9ybScsICcnICk7XG5cdFx0XHRjb25maWd1cmVfaW5zcGVjdG9yX2Zvb3RlciggJ3dwYmNfY2F0YWxvZ19ib29raW5nX3Jlc291cmNlc19pbmxpbmVfcmV2aWV3X2Zvcm0nLCBjb25maWcuaTE4bi5hcHBseV9jaGFuZ2VzIHx8ICcnLCBmYWxzZSwgISBpbmxpbmVfc3RhdGUucmV2aWV3X3Rva2VuICk7XG5cdFx0XHRpZiAoIHJldmlld193b3JrZmxvdyApIHtcblx0XHRcdFx0cmV2aWV3X3dvcmtmbG93LnN5bmNocm9uaXplKCB7IGJ1c3k6IGZhbHNlLCBjYW5fYXBwbHk6ICEhIGlubGluZV9zdGF0ZS5yZXZpZXdfdG9rZW4gfSApO1xuXHRcdFx0fVxuXHRcdFx0Zm9jdXNfaW5zcGVjdG9yX2hlYWRpbmcoIHRhcmdldC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLWlubGluZS1yZXZpZXctZm9ybV0nICkgKTtcblx0XHR9ICkuY2F0Y2goIGZ1bmN0aW9uICggZXJyb3IgKSB7XG5cdFx0XHRpZiAoIHJlcXVlc3Rfc2VxdWVuY2UgIT09IGlubGluZV9zdGF0ZS5yZXF1ZXN0X3NlcXVlbmNlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpbmxpbmVfc3RhdGUucmV2aWV3X3Rva2VuID0gJyc7XG5cdFx0XHRpbnNwZWN0b3JfZGlydHkgPSBmYWxzZTtcblx0XHRcdHNob3dfYWRtaW5fbWVzc2FnZSggZXJyb3IubWVzc2FnZSB8fCBjb25maWcuaTE4bi5pbmxpbmVfcmV2aWV3X2ZhaWxlZCB8fCAnJywgJ2Vycm9yJywgNTAwMCApO1xuXHRcdFx0Y2xvc2VfaW5zcGVjdG9yKCBjb25maWcsIGZhbHNlICk7XG5cdFx0fSApLnRoZW4oIGZ1bmN0aW9uICgpIHtcblx0XHRcdGlmICggcmVxdWVzdF9zZXF1ZW5jZSA9PT0gaW5saW5lX3N0YXRlLnJlcXVlc3Rfc2VxdWVuY2UgKSB7XG5cdFx0XHRcdGlubGluZV9zdGF0ZS5sb2FkaW5nID0gZmFsc2U7XG5cdFx0XHRcdHN5bmNocm9uaXplX2lubGluZV9jb250cm9scyggY29uZmlnICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFwcGx5IHRoZSByZXZpZXdlZCBpbmxpbmUgcGxhbiBhbmQgcmV0YWluIHRoZSBjYXRhbG9nIHNlbGVjdGlvbi5cblx0ICpcblx0ICogQHBhcmFtIHtTdWJtaXRFdmVudH0gZXZlbnQgUmV2aWV3IGZvcm0gc3VibWl0IGV2ZW50LlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnIENhdGFsb2cgY29uZmlndXJhdGlvbi5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGFwcGx5X2lubGluZV9jaGFuZ2VzKCBldmVudCwgY29uZmlnICkge1xuXHRcdHZhciBmb3JtID0gZXZlbnQudGFyZ2V0O1xuXHRcdHZhciBzYXZlX2J1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5zcGVjdG9yLXNhdmVdJyApO1xuXHRcdHZhciByZXF1ZXN0X3NlcXVlbmNlO1xuXG5cdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRpZiAoIGlubGluZV9zdGF0ZS5sb2FkaW5nIHx8ICEgaW5saW5lX3N0YXRlLnJldmlld190b2tlbiB8fCAoIHNhdmVfYnV0dG9uICYmIHNhdmVfYnV0dG9uLmRpc2FibGVkICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlubGluZV9zdGF0ZS5sb2FkaW5nID0gdHJ1ZTtcblx0XHRpbnNwZWN0b3JfbXV0YXRpb25faW5fcHJvZ3Jlc3MgPSB0cnVlO1xuXHRcdGlmICggZ2V0X2lubGluZV9yZXZpZXdfd29ya2Zsb3coKSApIHtcblx0XHRcdGdldF9pbmxpbmVfcmV2aWV3X3dvcmtmbG93KCkuc3luY2hyb25pemUoIHsgYnVzeTogdHJ1ZSwgY2FuX2FwcGx5OiB0cnVlIH0gKTtcblx0XHR9XG5cdFx0cmVxdWVzdF9zZXF1ZW5jZSA9ICsraW5zcGVjdG9yX211dGF0aW9uX3JlcXVlc3Rfc2VxdWVuY2U7XG5cdFx0aWYgKCBzYXZlX2J1dHRvbiApIHtcblx0XHRcdHNhdmVfYnV0dG9uLmRpc2FibGVkID0gdHJ1ZTtcblx0XHRcdHNhdmVfYnV0dG9uLmNsYXNzTGlzdC5hZGQoICdpcy1idXN5JyApO1xuXHRcdH1cblx0XHRyZXF1ZXN0X2luc3BlY3RvciggY29uZmlnLCBjb25maWcuaW5saW5lX2FwcGx5X2FjdGlvbiwgeyByb3dzOiBKU09OLnN0cmluZ2lmeSggaW5saW5lX3N0YXRlLmNoYW5nZWRfcm93cyApLCByZXZpZXdfdG9rZW46IGlubGluZV9zdGF0ZS5yZXZpZXdfdG9rZW4gfSApLnRoZW4oIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRpZiAoIHJlcXVlc3Rfc2VxdWVuY2UgIT09IGluc3BlY3Rvcl9tdXRhdGlvbl9yZXF1ZXN0X3NlcXVlbmNlIHx8ICEgcmVzcG9uc2UgfHwgISByZXNwb25zZS5zdWNjZXNzIHx8ICEgcmVzcG9uc2UuZGF0YSApIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCBnZXRfaW5zcGVjdG9yX3Jlc3BvbnNlX21lc3NhZ2UoIHJlc3BvbnNlLCBjb25maWcuaTE4bi5pbmxpbmVfYXBwbHlfZmFpbGVkICkgKTtcblx0XHRcdH1cblx0XHRcdHBlbmRpbmdfaGlnaGxpZ2h0X2lkcyA9ICggcmVzcG9uc2UuZGF0YS51cGRhdGVkX2lkcyB8fCBbXSApLm1hcCggU3RyaW5nICk7XG5cdFx0XHRpbnNwZWN0b3JfbXV0YXRpb25faW5fcHJvZ3Jlc3MgPSBmYWxzZTtcblx0XHRcdGxlYXZlX2lubGluZV9tb2RlKCBjb25maWcsIHRydWUsIGdldF9pbnNwZWN0b3JfcmVzcG9uc2VfbWVzc2FnZSggcmVzcG9uc2UsICcnICkgKTtcblx0XHR9ICkuY2F0Y2goIGZ1bmN0aW9uICggZXJyb3IgKSB7XG5cdFx0XHRpbnNwZWN0b3JfbXV0YXRpb25faW5fcHJvZ3Jlc3MgPSBmYWxzZTtcblx0XHRcdGlubGluZV9zdGF0ZS5yZXZpZXdfdG9rZW4gPSAnJztcblx0XHRcdGlmICggZ2V0X2lubGluZV9yZXZpZXdfd29ya2Zsb3coKSApIHtcblx0XHRcdFx0Z2V0X2lubGluZV9yZXZpZXdfd29ya2Zsb3coKS5zeW5jaHJvbml6ZSggeyBidXN5OiBmYWxzZSwgY2FuX2FwcGx5OiBmYWxzZSB9ICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jb250YWlucyggZm9ybSApICkge1xuXHRcdFx0XHRzaG93X2luc3BlY3Rvcl9tZXNzYWdlKCBmb3JtLCBlcnJvci5tZXNzYWdlIHx8IGNvbmZpZy5pMThuLmlubGluZV9hcHBseV9mYWlsZWQgfHwgJycsIHRydWUgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHNob3dfYWRtaW5fbWVzc2FnZSggZXJyb3IubWVzc2FnZSB8fCBjb25maWcuaTE4bi5pbmxpbmVfYXBwbHlfZmFpbGVkIHx8ICcnLCAnZXJyb3InLCA1MDAwICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHNhdmVfYnV0dG9uICkge1xuXHRcdFx0XHRzYXZlX2J1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG5cdFx0XHRcdHNhdmVfYnV0dG9uLmNsYXNzTGlzdC5yZW1vdmUoICdpcy1idXN5JyApO1xuXHRcdFx0fVxuXHRcdH0gKS50aGVuKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRpbmxpbmVfc3RhdGUubG9hZGluZyA9IGZhbHNlO1xuXHRcdFx0c3luY2hyb25pemVfaW5saW5lX2NvbnRyb2xzKCBjb25maWcgKTtcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogUmVuZGVyIHRoZSBoZWFkZXIsIGNvbXBsZXRlIFJlc291cmNlIHJvd3MsIHBhcnRpYWxzLCBhbmQgcGFnaW5hdGlvbi5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyAgIFJlZ2lzdGVyZWQgY2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gcmVzcG9uc2UgTm9ybWFsaXplZCBjYXRhbG9nIHJlc3BvbnNlLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gZXZlcnkgcmVxdWlyZWQgcHJlc2VudGF0aW9uIHRhcmdldCBleGlzdHMuXG5cdCAqL1xuXHRmdW5jdGlvbiByZW5kZXJfYm9va2luZ19yZXNvdXJjZXNfcmVzcG9uc2UoIGNvbmZpZywgcmVzcG9uc2UgKSB7XG5cdFx0dmFyIGNhdGFsb2dfaGVhZGluZztcblx0XHR2YXIgY2F0YWxvZ19tb3VudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBjb25maWcubW91bnRfaWQgKTtcblx0XHR2YXIgY2FyZF9ncm91cHMgPSB7fTtcblx0XHR2YXIgY2hpbGRyZW5fYnlfcGFyZW50ID0ge307XG5cdFx0dmFyIGNvbHVtbnM7XG5cdFx0dmFyIGhlYWRlcl9lbGVtZW50O1xuXHRcdHZhciBoaWVyYXJjaHlfZW5hYmxlZDtcblx0XHR2YXIgaGllcmFyY2h5X2lzX2V4cGFuZGVkO1xuXHRcdHZhciBpc19jYXJkc19wYWNrO1xuXHRcdHZhciBwYXJlbnRfcmVzb3VyY2VzID0ge307XG5cdFx0dmFyIHBhZ2luYXRpb247XG5cdFx0dmFyIHBhZ2luYXRpb25fZWxlbWVudDtcblx0XHR2YXIgcm93c19lbGVtZW50O1xuXG5cdFx0aWYgKCAhIGNhdGFsb2dfbW91bnQgfHwgISByZXNwb25zZSB8fCAhIEFycmF5LmlzQXJyYXkoIHJlc3BvbnNlLml0ZW1zICkgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aGVhZGVyX2VsZW1lbnQgPSBjYXRhbG9nX21vdW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2VzLWhlYWRlcl0nICk7XG5cdFx0cm93c19lbGVtZW50ID0gY2F0YWxvZ19tb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlcy1yb3dzXScgKTtcblx0XHRwYWdpbmF0aW9uX2VsZW1lbnQgPSBjYXRhbG9nX21vdW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2VzLXBhZ2luYXRpb25dJyApO1xuXHRcdGlmICggISBoZWFkZXJfZWxlbWVudCB8fCAhIHJvd3NfZWxlbWVudCB8fCAhIHBhZ2luYXRpb25fZWxlbWVudCApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb2x1bW5zID0gZ2V0X2NvbHVtbnMoIGNvbmZpZywgcmVzcG9uc2UuZGlzcGxheSB8fCB7fSwgdHJ1ZSwgcmVzcG9uc2Uuc29ydGluZyB8fCB7fSApO1xuXHRcdGlzX2NhcmRzX3BhY2sgPSAnY2FyZHMnID09PSBTdHJpbmcoIHJlc3BvbnNlLmRpc3BsYXkgJiYgcmVzcG9uc2UuZGlzcGxheS50ZW1wbGF0ZV9wYWNrIHx8ICcnICk7XG5cdFx0aGllcmFyY2h5X2VuYWJsZWQgPSAhISAoIHJlc3BvbnNlLmhpZXJhcmNoeSAmJiByZXNwb25zZS5oaWVyYXJjaHkuZW5hYmxlZCApO1xuXHRcdGhpZXJhcmNoeV9pc19leHBhbmRlZCA9IGhpZXJhcmNoeV9lbmFibGVkXG5cdFx0XHQmJiB3aW5kb3cud3BiY191aV9jYXRhbG9nX2hpZXJhcmNoeVxuXHRcdFx0JiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX3VpX2NhdGFsb2dfaGllcmFyY2h5LmdldF9pbml0aWFsX2V4cGFuZGVkXG5cdFx0XHQmJiB3aW5kb3cud3BiY191aV9jYXRhbG9nX2hpZXJhcmNoeS5nZXRfaW5pdGlhbF9leHBhbmRlZCggcmVzcG9uc2UuaGllcmFyY2h5IHx8IHt9ICk7XG5cdFx0aGVhZGVyX2VsZW1lbnQuaW5uZXJIVE1MID0gcmVuZGVyX2NvbXBvbmVudCggY29uZmlnLCAnaGVhZGVyJywge1xuXHRcdFx0YWxsX2V4cGFuZGVkOiBoaWVyYXJjaHlfaXNfZXhwYW5kZWQsXG5cdFx0XHRjb2x1bW5zOiBjb2x1bW5zLFxuXHRcdFx0aGllcmFyY2h5X2VuYWJsZWQ6IGhpZXJhcmNoeV9lbmFibGVkLFxuXHRcdFx0aTE4bjogY29uZmlnLmkxOG4gfHwge30sXG5cdFx0XHRzZWxlY3Rpb25fZW5hYmxlZDogISEgKCBjb25maWcuZmVhdHVyZXMgJiYgY29uZmlnLmZlYXR1cmVzLnNlbGVjdGlvbiApXG5cdFx0fSApO1xuXHRcdHJvd3NfZWxlbWVudC5pbm5lckhUTUwgPSAnJztcblx0XHRpZiAoIGhpZXJhcmNoeV9lbmFibGVkICkge1xuXHRcdFx0cmVzcG9uc2UuaXRlbXMuZm9yRWFjaCggZnVuY3Rpb24gKCByZXNvdXJjZSApIHtcblx0XHRcdFx0aWYgKCByZXNvdXJjZS5oaWVyYXJjaHkgJiYgJ3BhcmVudCcgPT09IHJlc291cmNlLmhpZXJhcmNoeS50eXBlICkge1xuXHRcdFx0XHRcdHBhcmVudF9yZXNvdXJjZXNbIFN0cmluZyggcmVzb3VyY2UuaWQgKSBdID0gcmVzb3VyY2U7XG5cdFx0XHRcdH0gZWxzZSBpZiAoIHJlc291cmNlLmhpZXJhcmNoeSAmJiAnY2hpbGQnID09PSByZXNvdXJjZS5oaWVyYXJjaHkudHlwZSApIHtcblx0XHRcdFx0XHR2YXIgcGFyZW50X2lkID0gU3RyaW5nKCByZXNvdXJjZS5oaWVyYXJjaHkucGFyZW50X2lkIHx8ICcnICk7XG5cdFx0XHRcdFx0Y2hpbGRyZW5fYnlfcGFyZW50WyBwYXJlbnRfaWQgXSA9IGNoaWxkcmVuX2J5X3BhcmVudFsgcGFyZW50X2lkIF0gfHwgW107XG5cdFx0XHRcdFx0Y2hpbGRyZW5fYnlfcGFyZW50WyBwYXJlbnRfaWQgXS5wdXNoKCByZXNvdXJjZSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fVxuXHRcdHJlc3BvbnNlLml0ZW1zLmZvckVhY2goIGZ1bmN0aW9uICggcmVzb3VyY2UgKSB7XG5cdFx0XHR2YXIgYWN0aW9uX3RhcmdldDtcblx0XHRcdHZhciBjbGFzc2ljX2xhYmVsX2NsYXNzZXMgPSB7XG5cdFx0XHRcdGNoaWxkOiAnd3BiY19sYWJlbF9yZXNvdXJjZV9jaGlsZCcsXG5cdFx0XHRcdGNvc3Q6ICd3cGJjX2xhYmVsX2Nvc3QnLFxuXHRcdFx0XHQnZGVmYXVsdC1mb3JtJzogJ3dwYmNfbGFiZWxfcmVzb3VyY2VfZGVmYXVsdF9mb3JtJyxcblx0XHRcdFx0b3duZXI6ICd3cGJjX2xhYmVsX3VzZXJfb3duZXInLFxuXHRcdFx0XHRwYXJlbnQ6ICd3cGJjX2xhYmVsX3Jlc291cmNlX3BhcmVudCcsXG5cdFx0XHRcdHNpbmdsZTogJ3dwYmNfbGFiZWxfcmVzb3VyY2Vfc2luZ2xlJ1xuXHRcdFx0fTtcblx0XHRcdHZhciBsYWJlbF90YXJnZXQ7XG5cdFx0XHR2YXIgcHJpY2VfdGFyZ2V0O1xuXHRcdFx0dmFyIGRlc2NyaXB0aW9uID0gcmVzb3VyY2UuZGVzY3JpcHRpb24gfHwgY29uZmlnLmkxOG4ubm9fZGVzY3JpcHRpb24gfHwgJyc7XG5cdFx0XHR2YXIgaGllcmFyY2h5ID0gT2JqZWN0LmFzc2lnbigge30sIHJlc291cmNlLmhpZXJhcmNoeSB8fCB7fSApO1xuXHRcdFx0dmFyIHBhcmVudF9jb250ZXh0X2xhYmVsID0gJyc7XG5cdFx0XHR2YXIgcm93X3ZhcmlhbnQgPSBoaWVyYXJjaHlfZW5hYmxlZCAmJiAoICdwYXJlbnQnID09PSBoaWVyYXJjaHkudHlwZSB8fCAnY2hpbGQnID09PSBoaWVyYXJjaHkudHlwZSApID8gaGllcmFyY2h5LnR5cGUgOiAnc2luZ2xlJztcblx0XHRcdHZhciByb3dfdGVtcGxhdGVfcm9sZSA9ICdwYXJlbnQnID09PSByb3dfdmFyaWFudCA/ICdwYXJlbnRfcm93JyA6ICggJ2NoaWxkJyA9PT0gcm93X3ZhcmlhbnQgPyAnY2hpbGRfcm93JyA6ICdyb3cnICk7XG5cdFx0XHR2YXIgdHlwZV9iYWRnZV9sYWJlbCA9IGNvbmZpZy5pMThuLmluZGVwZW5kZW50X2xhYmVsIHx8ICcnO1xuXHRcdFx0aGllcmFyY2h5LmV4cGFuZGFibGUgPSAhISAoIGhpZXJhcmNoeV9lbmFibGVkICYmIGhpZXJhcmNoeS5leHBhbmRhYmxlICk7XG5cdFx0XHRpZiAoIGhpZXJhcmNoeS5wYXJlbnRfdGl0bGUgKSB7XG5cdFx0XHRcdHBhcmVudF9jb250ZXh0X2xhYmVsID0gZm9ybWF0X21lc3NhZ2UoIGNvbmZpZy5pMThuLmNoaWxkX29mIHx8ICcnLCBbIGhpZXJhcmNoeS5wYXJlbnRfdGl0bGUgXSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAncGFyZW50JyA9PT0gcm93X3ZhcmlhbnQgKSB7XG5cdFx0XHRcdHZhciByZW5kZXJlZF9jaGlsZF9jb3VudCA9IE1hdGgubWF4KCAwLCBOdW1iZXIoIGhpZXJhcmNoeS5yZW5kZXJlZF9jaGlsZHJlbl9jb3VudCApIHx8IDAgKTtcblx0XHRcdFx0dmFyIHBhcmVudF9jaGlsZHJlbl90ZW1wbGF0ZSA9IDEgPT09IHJlbmRlcmVkX2NoaWxkX2NvdW50XG5cdFx0XHRcdFx0PyBjb25maWcuaTE4bi5wYXJlbnRfY2hpbGRfbGFiZWwgfHwgJyUxJHMgwrcgJTIkcyBjaGlsZCdcblx0XHRcdFx0XHQ6IGNvbmZpZy5pMThuLnBhcmVudF9jaGlsZHJlbl9sYWJlbCB8fCAnJTEkcyDCtyAlMiRzIGNoaWxkcmVuJztcblx0XHRcdFx0dHlwZV9iYWRnZV9sYWJlbCA9IGZvcm1hdF9tZXNzYWdlKCBwYXJlbnRfY2hpbGRyZW5fdGVtcGxhdGUsIFtcblx0XHRcdFx0XHRjb25maWcuaTE4bi5wYXJlbnRfbGFiZWwgfHwgJycsXG5cdFx0XHRcdFx0cmVuZGVyZWRfY2hpbGRfY291bnRcblx0XHRcdFx0XSApO1xuXHRcdFx0fSBlbHNlIGlmICggJ2NoaWxkJyA9PT0gcm93X3ZhcmlhbnQgKSB7XG5cdFx0XHRcdHR5cGVfYmFkZ2VfbGFiZWwgPSBjb25maWcuaTE4bi5jaGlsZF9sYWJlbCB8fCAnJztcblx0XHRcdH1cblx0XHRcdHZhciByZXNvdXJjZV9yb3dfZGF0YSA9IE9iamVjdC5hc3NpZ24oIHt9LCByZXNvdXJjZSwge1xuXHRcdFx0XHRwYXJlbnRfY29udGV4dF9sYWJlbDogcGFyZW50X2NvbnRleHRfbGFiZWwsXG5cdFx0XHRcdGNvbGxhcHNlX2xhYmVsOiBmb3JtYXRfbWVzc2FnZSggY29uZmlnLmkxOG4uY29sbGFwc2VfY2hpbGRyZW5fZm9yIHx8IGNvbmZpZy5pMThuLmNvbGxhcHNlX2NoaWxkcmVuIHx8ICcnLCBbIHJlc291cmNlLnRpdGxlIHx8ICcnIF0gKSxcblx0XHRcdFx0Y29sdW1uczogY29sdW1ucyxcblx0XHRcdFx0ZXhwYW5kX2xhYmVsOiBmb3JtYXRfbWVzc2FnZSggY29uZmlnLmkxOG4uZXhwYW5kX2NoaWxkcmVuX2ZvciB8fCBjb25maWcuaTE4bi5leHBhbmRfY2hpbGRyZW4gfHwgJycsIFsgcmVzb3VyY2UudGl0bGUgfHwgJycgXSApLFxuXHRcdFx0XHRoaWVyYXJjaHk6IGhpZXJhcmNoeSxcblx0XHRcdFx0aTE4bjogY29uZmlnLmkxOG4gfHwge30sXG5cdFx0XHRcdGlzX2V4cGFuZGVkOiBoaWVyYXJjaHlfaXNfZXhwYW5kZWQsXG5cdFx0XHRcdHBhcmVudF9sYWJlbDogY29uZmlnLmkxOG4ucGFyZW50X2xhYmVsIHx8ICcnLFxuXHRcdFx0XHRyb3dfdmFyaWFudDogcm93X3ZhcmlhbnQsXG5cdFx0XHRcdHNlbGVjdGlvbl9sYWJlbDogZm9ybWF0X21lc3NhZ2UoIGNvbmZpZy5pMThuLnNlbGVjdF9yZXNvdXJjZSB8fCAnJywgWyByZXNvdXJjZS50aXRsZSB8fCAnJyBdICksXG5cdFx0XHRcdHNlbGVjdGlvbl9lbmFibGVkOiAhISAoIGNvbmZpZy5mZWF0dXJlcyAmJiBjb25maWcuZmVhdHVyZXMuc2VsZWN0aW9uICksXG5cdFx0XHRcdHRodW1ibmFpbF9sYWJlbDogZm9ybWF0X21lc3NhZ2UoIGNvbmZpZy5pMThuLnRodW1ibmFpbF90b29sdGlwIHx8ICcnLCBbIHJlc291cmNlLnRpdGxlIHx8ICcnLCBkZXNjcmlwdGlvbiBdICksXG5cdFx0XHRcdHR5cGVfYmFkZ2VfbGFiZWw6IHR5cGVfYmFkZ2VfbGFiZWxcblx0XHRcdH0gKTtcblx0XHRcdHZhciByZXNvdXJjZV9yb3dfaHRtbCA9IHJlbmRlcl9jb21wb25lbnQoIGNvbmZpZywgcm93X3RlbXBsYXRlX3JvbGUsIHJlc291cmNlX3Jvd19kYXRhICk7XG5cdFx0XHR2YXIgcmVzb3VyY2Vfcm93O1xuXG5cdFx0XHRpZiAoICEgcmVzb3VyY2Vfcm93X2h0bWwgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCBpc19jYXJkc19wYWNrICYmICdwYXJlbnQnID09PSByb3dfdmFyaWFudCApIHtcblx0XHRcdFx0dmFyIGNoaWxkX3Jlc291cmNlcyA9IGNoaWxkcmVuX2J5X3BhcmVudFsgU3RyaW5nKCByZXNvdXJjZS5pZCApIF0gfHwgW107XG5cdFx0XHRcdHZhciBjaGlsZF9jb3VudCA9IE1hdGgubWF4KCBjaGlsZF9yZXNvdXJjZXMubGVuZ3RoLCBOdW1iZXIoIGhpZXJhcmNoeS5yZW5kZXJlZF9jaGlsZHJlbl9jb3VudCApIHx8IDAgKTtcblx0XHRcdFx0dmFyIGNhcmRfZ3JvdXBfaHRtbCA9IHJlbmRlcl9jb21wb25lbnQoIGNvbmZpZywgJ2NhcmRfZ3JvdXAnLCB7XG5cdFx0XHRcdFx0Y2hpbGRyZW5fZGVzY3JpcHRpb246IGZvcm1hdF9tZXNzYWdlKCBjb25maWcuaTE4bi5jaGlsZHJlbl9iZWxvbmdfdG8gfHwgJycsIFsgcmVzb3VyY2UudGl0bGUgfHwgJycgXSApLFxuXHRcdFx0XHRcdGNoaWxkcmVuX2hlYWRpbmc6IGZvcm1hdF9tZXNzYWdlKCBjb25maWcuaTE4bi5jaGlsZHJlbl9vZl9jb3VudCB8fCAnJywgWyByZXNvdXJjZS50aXRsZSB8fCAnJywgY2hpbGRfY291bnQgXSApLFxuXHRcdFx0XHRcdGNvbGxhcHNlX2xhYmVsOiByZXNvdXJjZV9yb3dfZGF0YS5jb2xsYXBzZV9sYWJlbCxcblx0XHRcdFx0XHRleHBhbmRfbGFiZWw6IHJlc291cmNlX3Jvd19kYXRhLmV4cGFuZF9sYWJlbCxcblx0XHRcdFx0XHRpc19leHBhbmRlZDogaGllcmFyY2h5X2lzX2V4cGFuZGVkLFxuXHRcdFx0XHRcdHBhcmVudF9pZDogcmVzb3VyY2UuaWQsXG5cdFx0XHRcdFx0cGFyZW50X25vZGVfaWQ6IGhpZXJhcmNoeS5ub2RlX2lkLFxuXHRcdFx0XHRcdHN0YWNrX2l0ZW1zOiBjaGlsZF9yZXNvdXJjZXMuc2xpY2UoIDAsIDMgKVxuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdGlmICggISBjYXJkX2dyb3VwX2h0bWwgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJvd3NfZWxlbWVudC5pbnNlcnRBZGphY2VudEhUTUwoICdiZWZvcmVlbmQnLCBjYXJkX2dyb3VwX2h0bWwgKTtcblx0XHRcdFx0Y2FyZF9ncm91cHNbIFN0cmluZyggcmVzb3VyY2UuaWQgKSBdID0gcm93c19lbGVtZW50Lmxhc3RFbGVtZW50Q2hpbGQ7XG5cdFx0XHRcdHZhciBwYXJlbnRfc2xvdCA9IGNhcmRfZ3JvdXBzWyBTdHJpbmcoIHJlc291cmNlLmlkICkgXS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWNhcmQtcGFyZW50LXNsb3RdJyApO1xuXHRcdFx0XHRwYXJlbnRfc2xvdC5pbnNlcnRBZGphY2VudEhUTUwoICdiZWZvcmVlbmQnLCByZXNvdXJjZV9yb3dfaHRtbCApO1xuXHRcdFx0XHRyZXNvdXJjZV9yb3cgPSBwYXJlbnRfc2xvdC5sYXN0RWxlbWVudENoaWxkO1xuXHRcdFx0fSBlbHNlIGlmICggaXNfY2FyZHNfcGFjayAmJiAnY2hpbGQnID09PSByb3dfdmFyaWFudCAmJiBjYXJkX2dyb3Vwc1sgU3RyaW5nKCBoaWVyYXJjaHkucGFyZW50X2lkICkgXSApIHtcblx0XHRcdFx0dmFyIGNoaWxkcmVuX3Nsb3QgPSBjYXJkX2dyb3Vwc1sgU3RyaW5nKCBoaWVyYXJjaHkucGFyZW50X2lkICkgXS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWNhcmQtY2hpbGRyZW4tc2xvdF0nICk7XG5cdFx0XHRcdGNoaWxkcmVuX3Nsb3QuaW5zZXJ0QWRqYWNlbnRIVE1MKCAnYmVmb3JlZW5kJywgcmVzb3VyY2Vfcm93X2h0bWwgKTtcblx0XHRcdFx0cmVzb3VyY2Vfcm93ID0gY2hpbGRyZW5fc2xvdC5sYXN0RWxlbWVudENoaWxkO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cm93c19lbGVtZW50Lmluc2VydEFkamFjZW50SFRNTCggJ2JlZm9yZWVuZCcsIHJlc291cmNlX3Jvd19odG1sICk7XG5cdFx0XHRcdHJlc291cmNlX3JvdyA9IHJvd3NfZWxlbWVudC5sYXN0RWxlbWVudENoaWxkO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHJlc291cmNlX3JvdyApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRsYWJlbF90YXJnZXQgPSByZXNvdXJjZV9yb3cucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1sYWJlbHNdJyApO1xuXHRcdFx0cHJpY2VfdGFyZ2V0ID0gcmVzb3VyY2Vfcm93LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtcHJpY2VdJyApO1xuXHRcdFx0YWN0aW9uX3RhcmdldCA9IHJlc291cmNlX3Jvdy5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWFjdGlvbnNdJyApO1xuXHRcdFx0aWYgKCBsYWJlbF90YXJnZXQgKSB7XG5cdFx0XHRcdGxhYmVsX3RhcmdldC5pbm5lckhUTUwgPSByZW5kZXJfY29tcG9uZW50KCBjb25maWcsICdsYWJlbHMnLCB7XG5cdFx0XHRcdFx0YXJpYV9sYWJlbDogY29uZmlnLmkxOG4uY29sdW1uX2xhYmVscyB8fCAnJyxcblx0XHRcdFx0XHRlbXB0eV9sYWJlbDogY29uZmlnLmkxOG4ubm9fbGFiZWxzIHx8ICcnLFxuXHRcdFx0XHRcdGxhYmVsczogQXJyYXkuaXNBcnJheSggcmVzb3VyY2UubGFiZWxzICkgPyByZXNvdXJjZS5sYWJlbHMubWFwKCBmdW5jdGlvbiAoIGxhYmVsICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIE9iamVjdC5hc3NpZ24oIHt9LCBsYWJlbCwgeyBjbGFzc19uYW1lOiBjbGFzc2ljX2xhYmVsX2NsYXNzZXNbIGxhYmVsLmtpbmQgXSB8fCAnJyB9ICk7XG5cdFx0XHRcdFx0fSApIDogW11cblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBwcmljZV90YXJnZXQgKSB7XG5cdFx0XHRcdHByaWNlX3RhcmdldC5pbm5lckhUTUwgPSByZW5kZXJfY29tcG9uZW50KCBjb25maWcsICdwcmljZScsIHtcblx0XHRcdFx0XHRlbXB0eV9sYWJlbDogY29uZmlnLmkxOG4ucHJpY2VfdW5hdmFpbGFibGUgfHwgJycsXG5cdFx0XHRcdFx0cHJpY2U6IHJlc291cmNlLnByaWNlIHx8IHt9XG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblx0XHRcdGlmICggYWN0aW9uX3RhcmdldCApIHtcblx0XHRcdFx0YWN0aW9uX3RhcmdldC5pbm5lckhUTUwgPSByZW5kZXJfY29tcG9uZW50KCBjb25maWcsICdhY3Rpb25fbWVudScsIHtcblx0XHRcdFx0XHRhY3Rpb25zOiBBcnJheS5pc0FycmF5KCByZXNvdXJjZS5hY3Rpb25faXRlbXMgKSA/IHJlc291cmNlLmFjdGlvbl9pdGVtcy5tYXAoIGZ1bmN0aW9uICggYWN0aW9uICkge1xuXHRcdFx0XHRcdFx0dmFyIGFjdGlvbl9jbGFzc2VzID0geyBhZGp1c3RfY2FwYWNpdHk6ICdjYXBhY2l0eScsIGRlbGV0ZV9yZXNvdXJjZTogJ2RlbGV0ZScsIGVkaXRfcmVzb3VyY2U6ICdlZGl0JywgcHVibGlzaF9yZXNvdXJjZTogJ3B1Ymxpc2gnIH07XG5cdFx0XHRcdFx0XHR2YXIgYWN0aW9uX2lkID0gU3RyaW5nKCBhY3Rpb24uaWQgfHwgJycgKTtcblx0XHRcdFx0XHRcdHJldHVybiBPYmplY3QuYXNzaWduKCB7fSwgYWN0aW9uLCB7IGNsYXNzX25hbWU6ICd3cGJjX2Jvb2tpbmdfcmVzb3VyY2VzX19hY3Rpb25fJyArICggYWN0aW9uX2NsYXNzZXNbIGFjdGlvbl9pZCBdIHx8IGFjdGlvbl9pZCApIH0gKTtcblx0XHRcdFx0XHR9ICkgOiBbXSxcblx0XHRcdFx0XHRhcmlhX2xhYmVsOiBmb3JtYXRfbWVzc2FnZSggY29uZmlnLmkxOG4uYWN0aW9uc19mb3IgfHwgJycsIFsgcmVzb3VyY2UudGl0bGUgfHwgJycgXSApLFxuXHRcdFx0XHRcdGVtcHR5X2xhYmVsOiBjb25maWcuaTE4bi5ub19hY3Rpb25zIHx8ICcnLFxuXHRcdFx0XHRcdG1lbnVfaWQ6ICd3cGJjXycgKyBjb25maWcuaWQgKyAnX2FjdGlvbnNfJyArIFN0cmluZyggcmVzb3VyY2UuaWQgKSxcblx0XHRcdFx0XHRyZXNvdXJjZV9pZDogcmVzb3VyY2UuaWRcblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBoaWVyYXJjaHlfZW5hYmxlZCAmJiAnY2hpbGQnID09PSByb3dfdmFyaWFudCAmJiBoaWVyYXJjaHkuaXNfbGFzdF9zaWJsaW5nICkge1xuXHRcdFx0XHR2YXIgcGFyZW50X3Jlc291cmNlID0gcGFyZW50X3Jlc291cmNlc1sgU3RyaW5nKCBoaWVyYXJjaHkucGFyZW50X2lkICkgXTtcblx0XHRcdFx0aWYgKCBwYXJlbnRfcmVzb3VyY2UgKSB7XG5cdFx0XHRcdFx0dmFyIHN1bW1hcnlfdGFyZ2V0ID0gaXNfY2FyZHNfcGFjayAmJiBjYXJkX2dyb3Vwc1sgU3RyaW5nKCBoaWVyYXJjaHkucGFyZW50X2lkICkgXVxuXHRcdFx0XHRcdFx0PyBjYXJkX2dyb3Vwc1sgU3RyaW5nKCBoaWVyYXJjaHkucGFyZW50X2lkICkgXS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWNhcmQtcGFyZW50LXNsb3RdJyApXG5cdFx0XHRcdFx0XHQ6IHJvd3NfZWxlbWVudDtcblx0XHRcdFx0XHRzdW1tYXJ5X3RhcmdldC5pbnNlcnRBZGphY2VudEhUTUwoICdiZWZvcmVlbmQnLCByZW5kZXJfY29tcG9uZW50KCBjb25maWcsICdjaGlsZF9zdW1tYXJ5Jywge1xuXHRcdFx0XHRcdFx0Y2hpbGRyZW5fbGFiZWw6IGdldF9jaGlsZHJlbl9zdW1tYXJ5X2xhYmVsKCBwYXJlbnRfcmVzb3VyY2UsIGNvbmZpZy5pMThuIHx8IHt9ICksXG5cdFx0XHRcdFx0XHRjb2xsYXBzZV9sYWJlbDogZm9ybWF0X21lc3NhZ2UoIGNvbmZpZy5pMThuLmNvbGxhcHNlX2NoaWxkcmVuX2ZvciB8fCBjb25maWcuaTE4bi5jb2xsYXBzZV9jaGlsZHJlbiB8fCAnJywgWyBwYXJlbnRfcmVzb3VyY2UudGl0bGUgfHwgJycgXSApLFxuXHRcdFx0XHRcdFx0Y29sdW1uczogY29sdW1ucyxcblx0XHRcdFx0XHRcdGV4cGFuZF9sYWJlbDogZm9ybWF0X21lc3NhZ2UoIGNvbmZpZy5pMThuLmV4cGFuZF9jaGlsZHJlbl9mb3IgfHwgY29uZmlnLmkxOG4uZXhwYW5kX2NoaWxkcmVuIHx8ICcnLCBbIHBhcmVudF9yZXNvdXJjZS50aXRsZSB8fCAnJyBdICksXG5cdFx0XHRcdFx0XHRpc19leHBhbmRlZDogaGllcmFyY2h5X2lzX2V4cGFuZGVkLFxuXHRcdFx0XHRcdFx0cGFyZW50X2lkOiBoaWVyYXJjaHkucGFyZW50X2lkLFxuXHRcdFx0XHRcdFx0cGFyZW50X25vZGVfaWQ6IHBhcmVudF9yZXNvdXJjZS5oaWVyYXJjaHkubm9kZV9pZCxcblx0XHRcdFx0XHRcdHNlbGVjdGlvbl9lbmFibGVkOiAhISAoIGNvbmZpZy5mZWF0dXJlcyAmJiBjb25maWcuZmVhdHVyZXMuc2VsZWN0aW9uIClcblx0XHRcdFx0XHR9ICkgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gKTtcblx0XHRzeW5jaHJvbml6ZV9vdmVyZmxvd190b29sdGlwcyggY2F0YWxvZ19tb3VudCApO1xuXG5cdFx0cGFnaW5hdGlvbiA9IHJlc3BvbnNlLnBhZ2luYXRpb24gfHwge307XG5cdFx0cGFnaW5hdGlvbl9lbGVtZW50LmlubmVySFRNTCA9IHJlbmRlcl9jb21wb25lbnQoIGNvbmZpZywgJ3BhZ2luYXRpb24nLCB7XG5cdFx0XHRhcmlhX2xhYmVsOiBjb25maWcuaTE4bi5wYWdpbmF0aW9uX2xhYmVsIHx8ICcnLFxuXHRcdFx0aGFzX25leHQ6IE51bWJlciggcGFnaW5hdGlvbi5wYWdlX251bWJlciApIDwgTnVtYmVyKCBwYWdpbmF0aW9uLnRvdGFsX3BhZ2VzICksXG5cdFx0XHRoYXNfcHJldmlvdXM6IDEgPCBOdW1iZXIoIHBhZ2luYXRpb24ucGFnZV9udW1iZXIgKSxcblx0XHRcdGl0ZW1zX3Blcl9wYWdlOiBOdW1iZXIoIHBhZ2luYXRpb24uaXRlbXNfcGVyX3BhZ2UgKSxcblx0XHRcdGl0ZW1zX3Blcl9wYWdlX29wdGlvbnM6IGNvbmZpZy5pdGVtc19wZXJfcGFnZSAmJiBBcnJheS5pc0FycmF5KCBjb25maWcuaXRlbXNfcGVyX3BhZ2Uub3B0aW9ucyApID8gY29uZmlnLml0ZW1zX3Blcl9wYWdlLm9wdGlvbnMgOiBbXSxcblx0XHRcdG5leHRfbGFiZWw6IGNvbmZpZy5pMThuLm5leHRfcGFnZSB8fCAnJyxcblx0XHRcdG5leHRfcGFnZTogTWF0aC5taW4oIE51bWJlciggcGFnaW5hdGlvbi50b3RhbF9wYWdlcyApLCBOdW1iZXIoIHBhZ2luYXRpb24ucGFnZV9udW1iZXIgKSArIDEgKSxcblx0XHRcdHBhZ2VfbnVtYmVyOiBOdW1iZXIoIHBhZ2luYXRpb24ucGFnZV9udW1iZXIgKSxcblx0XHRcdHBhZ2VfbnVtYmVyX2xhYmVsOiBjb25maWcuaTE4bi5wYWdlX251bWJlciB8fCAnJyxcblx0XHRcdHBlcl9wYWdlX2xhYmVsOiBjb25maWcuaTE4bi5wZXJfcGFnZSB8fCAnJyxcblx0XHRcdHByZXZpb3VzX2xhYmVsOiBjb25maWcuaTE4bi5wcmV2aW91c19wYWdlIHx8ICcnLFxuXHRcdFx0cHJldmlvdXNfcGFnZTogTWF0aC5tYXgoIDEsIE51bWJlciggcGFnaW5hdGlvbi5wYWdlX251bWJlciApIC0gMSApLFxuXHRcdFx0cmVzdWx0c19zdGF0dXM6IGZvcm1hdF9tZXNzYWdlKCBjb25maWcuaTE4bi5yZXN1bHRzX3N0YXR1cyB8fCAnJywgWyBwYWdpbmF0aW9uLml0ZW1zX2Zyb20sIHBhZ2luYXRpb24uaXRlbXNfdG8sIHBhZ2luYXRpb24udG90YWxfaXRlbXMgXSApLFxuXHRcdFx0c2hvd19sYWJlbDogY29uZmlnLmkxOG4uc2hvdyB8fCAnJyxcblx0XHRcdHRvdGFsX3BhZ2VzOiBNYXRoLm1heCggMSwgTnVtYmVyKCBwYWdpbmF0aW9uLnRvdGFsX3BhZ2VzICkgKVxuXHRcdH0gKTtcblx0XHRzeW5jaHJvbml6ZV9ib29raW5nX3Jlc291cmNlc190b29sYmFyKCBjb25maWcsIHJlc3BvbnNlICk7XG5cblx0XHRpZiAoIHBlbmRpbmdfZm9jdXNfZGlyZWN0aW9uICkge1xuXHRcdFx0Y2F0YWxvZ19oZWFkaW5nID0gY2F0YWxvZ19tb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLWhlYWRpbmddJyApO1xuXHRcdFx0cGVuZGluZ19mb2N1c19kaXJlY3Rpb24gPSAnJztcblx0XHRcdGlmICggY2F0YWxvZ19oZWFkaW5nICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBjYXRhbG9nX2hlYWRpbmcuZm9jdXMgKSB7XG5cdFx0XHRcdGNhdGFsb2dfaGVhZGluZy5mb2N1cygpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiByb3dzX2VsZW1lbnQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1zZWxlY3RhYmxlLXJvd11bZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtaWRdJyApLmxlbmd0aCA9PT0gcmVzcG9uc2UuaXRlbXMubGVuZ3RoO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiB0aGUgbnVtYmVyIG9mIGN1cnJlbnRseSB2aXNpYmxlIGNlbGxzIGluIG9uZSBSZXNvdXJjZSByb3cuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJlc291cmNlX3JvdyBSZW5kZXJlZCBSZXNvdXJjZSB0YWJsZSByb3cuXG5cdCAqIEByZXR1cm4ge251bWJlcn0gU2FmZSBkZXRhaWxzLXJvdyBjb2xzcGFuLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X2RldGFpbHNfY29sc3BhbiggcmVzb3VyY2Vfcm93ICkge1xuXHRcdHZhciB2aXNpYmxlX2NlbGxzID0gMDtcblxuXHRcdGlmICggcmVzb3VyY2Vfcm93ICYmICdUUicgPT09IHJlc291cmNlX3Jvdy50YWdOYW1lICkge1xuXHRcdFx0QXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCggcmVzb3VyY2Vfcm93LmNlbGxzIHx8IFtdLCBmdW5jdGlvbiAoIGNlbGwgKSB7XG5cdFx0XHRcdGlmICggISBjZWxsLmhpZGRlbiAmJiAnbm9uZScgIT09IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKCBjZWxsICkuZGlzcGxheSApIHtcblx0XHRcdFx0XHR2aXNpYmxlX2NlbGxzICs9IDE7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gTWF0aC5tYXgoIDEsIHZpc2libGVfY2VsbHMgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXNvbHZlIHRoZSByZW5kZXJlZCBSZXNvdXJjZSBjb250YWluZXIgdGhhdCBvd25zIGFuIGludGVyYWN0aXZlIGNvbnRyb2wuXG5cdCAqXG5cdCAqIFJlc291cmNlIGNvbnRyb2xzIHJlcGVhdCB0aGUgUmVzb3VyY2UgSUQgZm9yIGV2ZW50IGRpc3BhdGNoLiBMaW1pdGluZyB0aGlzXG5cdCAqIGxvb2t1cCB0byBzZWxlY3RhYmxlIHJvdy9jYXJkIGNvbnRhaW5lcnMgcHJldmVudHMgbGF6eSB0ZW1wbGF0ZXMgZnJvbSBiZWluZ1xuXHQgKiBpbnNlcnRlZCBiZXNpZGUgdGhlIGNvbnRyb2wgaXRzZWxmLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0VsZW1lbnR8bnVsbH0gc291cmNlX2VsZW1lbnQgRWxlbWVudCBpbnNpZGUgYSBSZXNvdXJjZSByb3cgb3IgY2FyZC5cblx0ICogQHJldHVybiB7SFRNTEVsZW1lbnR8bnVsbH0gT3duaW5nIFJlc291cmNlIHJvdy9jYXJkLCBvciBudWxsIHdoZW4gdW5hdmFpbGFibGUuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfcmVzb3VyY2VfaXRlbV9jb250YWluZXIoIHNvdXJjZV9lbGVtZW50ICkge1xuXHRcdGlmICggISBzb3VyY2VfZWxlbWVudCB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygc291cmNlX2VsZW1lbnQuY2xvc2VzdCApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHJldHVybiBzb3VyY2VfZWxlbWVudC5jbG9zZXN0KCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXNlbGVjdGFibGUtcm93XVtkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1pZF0nICk7XG5cdH1cblxuXHQvKipcblx0ICogU3luY2hyb25pemUgQ2FyZHMtcGFjayBwYXJlbnQgc3RhZ2VzIHdpdGggc2hhcmVkIGhpZXJhcmNoeSB2aXNpYmlsaXR5LlxuXHQgKlxuXHQgKiBDaGlsZCBjYXJkcyByZW1haW4gbm9ybWFsIHNoYXJlZCBoaWVyYXJjaHkgbm9kZXMuIFRoaXMgYWRhcHRlciBvbmx5IG1pcnJvcnNcblx0ICogdGhlaXIgY29tcHV0ZWQgdmlzaWJpbGl0eSBvbnRvIHRoZSBwcmVzZW50YXRpb24tb25seSB0cmF5IHdyYXBwZXIuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGNhdGFsb2dfbW91bnQgTW91bnRlZCBCb29raW5nIFJlc291cmNlcyBjYXRhbG9nLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3luY2hyb25pemVfY2FyZF9ncm91cF9wYW5lbHMoIGNhdGFsb2dfbW91bnQgKSB7XG5cdFx0dmFyIGNhdGFsb2dfcm9vdDtcblxuXHRcdGlmICggISBjYXRhbG9nX21vdW50ICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNhdGFsb2dfcm9vdCA9IGNhdGFsb2dfbW91bnQuaGFzQXR0cmlidXRlKCAnZGF0YS13cGJjLWNhdGFsb2ctaWQnIClcblx0XHRcdD8gY2F0YWxvZ19tb3VudFxuXHRcdFx0OiBjYXRhbG9nX21vdW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctaWRdJyApO1xuXG5cdFx0Ly8gVGhlIHNoYXJlZCBjb250cm9sbGVyIG93bnMgdGhlIGFjdGl2ZS1wYWNrIGF0dHJpYnV0ZSBvbiB0aGUgaW5uZXIgY2F0YWxvZyByb290LlxuXHRcdGlmICggISBjYXRhbG9nX3Jvb3QgfHwgJ2NhcmRzJyAhPT0gY2F0YWxvZ19yb290LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10ZW1wbGF0ZS1wYWNrJyApICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNhdGFsb2dfcm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWNhcmQtZ3JvdXBdJyApLmZvckVhY2goIGZ1bmN0aW9uICggY2FyZF9ncm91cCApIHtcblx0XHRcdHZhciBjaGlsZHJlbl9wYW5lbCA9IGNhcmRfZ3JvdXAucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1jYXJkLWNoaWxkcmVuLXBhbmVsXScgKTtcblx0XHRcdHZhciB2aXNpYmxlX2NoaWxkID0gY2FyZF9ncm91cC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWNhcmQtY2hpbGRyZW4tc2xvdF0gW2RhdGEtd3BiYy11aS1jYXRhbG9nLXBhcmVudC1ub2RlLWlkXTpub3QoW2hpZGRlbl0pJyApO1xuXG5cdFx0XHRpZiAoIGNoaWxkcmVuX3BhbmVsICkge1xuXHRcdFx0XHRjaGlsZHJlbl9wYW5lbC5oaWRkZW4gPSAhIHZpc2libGVfY2hpbGQ7XG5cdFx0XHRcdGNhcmRfZ3JvdXAuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWV4cGFuZGVkJywgISEgdmlzaWJsZV9jaGlsZCApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTeW5jaHJvbml6ZSBvbmUgZGV0YWlscyBkaXNjbG9zdXJlIGJ1dHRvbi5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxudWxsfSB0b2dnbGVfYnV0dG9uIERpc2Nsb3N1cmUgYnV0dG9uLlxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59ICAgICAgICAgIGlzX2V4cGFuZGVkICAgV2hldGhlciBpdHMgZGV0YWlscyByb3cgaXMgb3Blbi5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHNldF9kZXRhaWxzX3RvZ2dsZV9zdGF0ZSggdG9nZ2xlX2J1dHRvbiwgaXNfZXhwYW5kZWQgKSB7XG5cdFx0dmFyIGljb247XG5cdFx0dmFyIGxhYmVsO1xuXG5cdFx0aWYgKCAhIHRvZ2dsZV9idXR0b24gKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGFiZWwgPSB0b2dnbGVfYnV0dG9uLmdldEF0dHJpYnV0ZSggaXNfZXhwYW5kZWQgPyAnZGF0YS1oaWRlLWxhYmVsJyA6ICdkYXRhLXNob3ctbGFiZWwnICkgfHwgJyc7XG5cdFx0dG9nZ2xlX2J1dHRvbi5zZXRBdHRyaWJ1dGUoICdhcmlhLWV4cGFuZGVkJywgaXNfZXhwYW5kZWQgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0dG9nZ2xlX2J1dHRvbi5zZXRBdHRyaWJ1dGUoICdhcmlhLWxhYmVsJywgbGFiZWwgKTtcblx0XHR0b2dnbGVfYnV0dG9uLnNldEF0dHJpYnV0ZSggJ3RpdGxlJywgbGFiZWwgKTtcblx0XHRpY29uID0gdG9nZ2xlX2J1dHRvbi5xdWVyeVNlbGVjdG9yKCAnc3BhblthcmlhLWhpZGRlbj1cInRydWVcIl0nICk7XG5cdFx0aWYgKCBpY29uICkge1xuXHRcdFx0aWNvbi5jbGFzc05hbWUgPSBpc19leHBhbmRlZCA/ICd3cGJjLWJpLWNoZXZyb24tdXAnIDogJ3dwYmMtYmktY2hldnJvbi1kb3duJztcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQ2xvc2UgdGhlIGFjdGl2ZSBkZXRhaWxzIHJvdyBhbmQgY2FuY2VsIGl0cyBsYXp5IHJlcXVlc3QuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gcmVzdG9yZV9mb2N1cyBXaGV0aGVyIHRvIHJldHVybiBmb2N1cyB0byB0aGUgZGlzY2xvc3VyZS5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGNsb3NlX2RldGFpbHNfcm93KCByZXN0b3JlX2ZvY3VzICkge1xuXHRcdHZhciBhY3RpdmVfcm93ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1kZXRhaWxzLXJvd10nICk7XG5cdFx0dmFyIGZvY3VzX3RhcmdldCA9IGRldGFpbHNfdG9nZ2xlX2J1dHRvbjtcblxuXHRcdGRldGFpbHNfcmVxdWVzdF9zZXF1ZW5jZSArPSAxO1xuXHRcdGlmICggZGV0YWlsc19hYm9ydF9jb250cm9sbGVyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBkZXRhaWxzX2Fib3J0X2NvbnRyb2xsZXIuYWJvcnQgKSB7XG5cdFx0XHRkZXRhaWxzX2Fib3J0X2NvbnRyb2xsZXIuYWJvcnQoKTtcblx0XHR9XG5cdFx0ZGV0YWlsc19hYm9ydF9jb250cm9sbGVyID0gbnVsbDtcblx0XHRpZiAoIGFjdGl2ZV9yb3cgJiYgYWN0aXZlX3Jvdy5wYXJlbnROb2RlICkge1xuXHRcdFx0YWN0aXZlX3Jvdy5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKCBhY3RpdmVfcm93ICk7XG5cdFx0fVxuXHRcdHNldF9kZXRhaWxzX3RvZ2dsZV9zdGF0ZSggZGV0YWlsc190b2dnbGVfYnV0dG9uLCBmYWxzZSApO1xuXHRcdGlmICggZGV0YWlsc190b2dnbGVfYnV0dG9uICkge1xuXHRcdFx0dmFyIHNvdXJjZV9yb3cgPSBnZXRfcmVzb3VyY2VfaXRlbV9jb250YWluZXIoIGRldGFpbHNfdG9nZ2xlX2J1dHRvbiApO1xuXHRcdFx0aWYgKCBzb3VyY2Vfcm93ICkge1xuXHRcdFx0XHRzb3VyY2Vfcm93LmNsYXNzTGlzdC5yZW1vdmUoICdpcy1kZXRhaWxzLWV4cGFuZGVkJyApO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRkZXRhaWxzX3Jlc291cmNlX2lkID0gMDtcblx0XHRkZXRhaWxzX3RvZ2dsZV9idXR0b24gPSBudWxsO1xuXG5cdFx0aWYgKCByZXN0b3JlX2ZvY3VzICYmIGZvY3VzX3RhcmdldCAmJiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY29udGFpbnMoIGZvY3VzX3RhcmdldCApICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBmb2N1c190YXJnZXQuZm9jdXMgKSB7XG5cdFx0XHRmb2N1c190YXJnZXQuZm9jdXMoKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogUmVwbGFjZSB0aGUgYWN0aXZlIGRldGFpbHMgcm93IHRocm91Z2ggdGhlIHJlZ2lzdGVyZWQgV1AgdGVtcGxhdGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGNvbmZpZyAgICAgICBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJlc291cmNlX3JvdyBTb3VyY2UgUmVzb3VyY2Ugcm93LlxuXHQgKiBAcGFyYW0ge09iamVjdH0gICAgICB0ZW1wbGF0ZV9kYXRhIFByZXNlbnRhdGlvbi1vbmx5IHRlbXBsYXRlIHN0YXRlLlxuXHQgKiBAcmV0dXJuIHtIVE1MRWxlbWVudHxudWxsfSBSZW5kZXJlZCBkZXRhaWxzIHJvdy5cblx0ICovXG5cdGZ1bmN0aW9uIHJlbmRlcl9kZXRhaWxzX3JvdyggY29uZmlnLCByZXNvdXJjZV9yb3csIHRlbXBsYXRlX2RhdGEgKSB7XG5cdFx0dmFyIGFjdGl2ZV9yb3cgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWRldGFpbHMtcm93XScgKTtcblx0XHR2YXIgY2FyZF9ncm91cCA9IHJlc291cmNlX3JvdyA/IHJlc291cmNlX3Jvdy5jbG9zZXN0KCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWNhcmQtZ3JvdXBdJyApIDogbnVsbDtcblx0XHR2YXIgZGV0YWlsc19odG1sID0gcmVuZGVyX2NvbXBvbmVudCggY29uZmlnLCAnZGV0YWlscycsIHRlbXBsYXRlX2RhdGEgKTtcblx0XHR2YXIgaW5zZXJ0aW9uX3RhcmdldCA9IGNhcmRfZ3JvdXAgfHwgcmVzb3VyY2Vfcm93O1xuXG5cdFx0aWYgKCAhIGRldGFpbHNfaHRtbCB8fCAhIGluc2VydGlvbl90YXJnZXQgfHwgISBpbnNlcnRpb25fdGFyZ2V0LnBhcmVudE5vZGUgKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0aWYgKCBhY3RpdmVfcm93ICYmIGFjdGl2ZV9yb3cucGFyZW50Tm9kZSApIHtcblx0XHRcdGFjdGl2ZV9yb3cucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCggYWN0aXZlX3JvdyApO1xuXHRcdH1cblx0XHRpbnNlcnRpb25fdGFyZ2V0Lmluc2VydEFkamFjZW50SFRNTCggJ2FmdGVyZW5kJywgZGV0YWlsc19odG1sICk7XG5cblx0XHRyZXR1cm4gaW5zZXJ0aW9uX3RhcmdldC5uZXh0RWxlbWVudFNpYmxpbmc7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIGEgc2FmZSBtZXNzYWdlIGZyb20gYSBub3JtYWxpemVkIGRldGFpbHMgZXJyb3IgcmVzcG9uc2UuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSByZXNwb25zZSBOb3JtYWxpemVkIGVuZHBvaW50IHJlc3BvbnNlLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gZmFsbGJhY2sgTG9jYWxpemVkIGZhbGxiYWNrIG1lc3NhZ2UuXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gU2FmZSBwbGFpbi10ZXh0IG1lc3NhZ2UuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfZGV0YWlsc19lcnJvcl9tZXNzYWdlKCByZXNwb25zZSwgZmFsbGJhY2sgKSB7XG5cdFx0cmV0dXJuIHJlc3BvbnNlICYmIHJlc3BvbnNlLmVycm9yICYmIHJlc3BvbnNlLmVycm9yLm1lc3NhZ2Vcblx0XHRcdD8gU3RyaW5nKCByZXNwb25zZS5lcnJvci5tZXNzYWdlIClcblx0XHRcdDogU3RyaW5nKCBmYWxsYmFjayB8fCAnJyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIE9wZW4gb25lIGRldGFpbHMgcm93IGFuZCBsYXppbHkgcmVxdWVzdCBpdHMgYXV0aG9yaXplZCBEVE8uXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGNvbmZpZyAgICAgICAgQ2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSB0b2dnbGVfYnV0dG9uIERldGFpbHMgZGlzY2xvc3VyZSBidXR0b24uXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJlc291cmNlX3JvdyAgU291cmNlIFJlc291cmNlIHJvdy5cblx0ICogQHBhcmFtIHtudW1iZXJ9ICAgICAgcmVzb3VyY2VfaWQgICBCb29raW5nIFJlc291cmNlIElELlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gb3Blbl9kZXRhaWxzX3JvdyggY29uZmlnLCB0b2dnbGVfYnV0dG9uLCByZXNvdXJjZV9yb3csIHJlc291cmNlX2lkICkge1xuXHRcdHZhciBkZXRhaWxzX3JlcXVlc3RfaWQ7XG5cdFx0dmFyIHJlcXVlc3RfYm9keTtcblx0XHR2YXIgcmVzb3VyY2VfdGl0bGVfZWxlbWVudCA9IHJlc291cmNlX3Jvdy5xdWVyeVNlbGVjdG9yKCAnLndwYmNfdWlfbGlzdGluZ19faXRlbV90aXRsZScgKTtcblx0XHR2YXIgcmVzb3VyY2VfdGl0bGUgPSByZXNvdXJjZV90aXRsZV9lbGVtZW50ID8gcmVzb3VyY2VfdGl0bGVfZWxlbWVudC50ZXh0Q29udGVudC50cmltKCkgOiAnJztcblx0XHR2YXIgdGVtcGxhdGVfYmFzZTtcblxuXHRcdGNsb3NlX2RldGFpbHNfcm93KCBmYWxzZSApO1xuXHRcdGRldGFpbHNfcmVzb3VyY2VfaWQgPSByZXNvdXJjZV9pZDtcblx0XHRkZXRhaWxzX3RvZ2dsZV9idXR0b24gPSB0b2dnbGVfYnV0dG9uO1xuXHRcdGRldGFpbHNfcmVxdWVzdF9pZCA9ICsrZGV0YWlsc19yZXF1ZXN0X3NlcXVlbmNlO1xuXHRcdHNldF9kZXRhaWxzX3RvZ2dsZV9zdGF0ZSggdG9nZ2xlX2J1dHRvbiwgdHJ1ZSApO1xuXHRcdHJlc291cmNlX3Jvdy5jbGFzc0xpc3QuYWRkKCAnaXMtZGV0YWlscy1leHBhbmRlZCcgKTtcblx0XHR0ZW1wbGF0ZV9iYXNlID0ge1xuXHRcdFx0Y29sc3BhbjogZ2V0X2RldGFpbHNfY29sc3BhbiggcmVzb3VyY2Vfcm93ICksXG5cdFx0XHRyZXNvdXJjZV9pZDogcmVzb3VyY2VfaWQsXG5cdFx0XHR0aXRsZTogcmVzb3VyY2VfdGl0bGVcblx0XHR9O1xuXHRcdHJlbmRlcl9kZXRhaWxzX3JvdyggY29uZmlnLCByZXNvdXJjZV9yb3csIE9iamVjdC5hc3NpZ24oIHt9LCB0ZW1wbGF0ZV9iYXNlLCB7XG5cdFx0XHRsb2FkaW5nX2xhYmVsOiBjb25maWcuaTE4bi5kZXRhaWxzX2xvYWRpbmcgfHwgY29uZmlnLmkxOG4ubG9hZGluZyB8fCAnJyxcblx0XHRcdHN0YXRlOiAnbG9hZGluZydcblx0XHR9ICkgKTtcblxuXHRcdHJlcXVlc3RfYm9keSA9IG5ldyB3aW5kb3cuVVJMU2VhcmNoUGFyYW1zKCk7XG5cdFx0cmVxdWVzdF9ib2R5LmFwcGVuZCggJ2FjdGlvbicsIGNvbmZpZy5kZXRhaWxzX2FjdGlvbiApO1xuXHRcdHJlcXVlc3RfYm9keS5hcHBlbmQoICdub25jZScsIGNvbmZpZy5ub25jZSB8fCAnJyApO1xuXHRcdHJlcXVlc3RfYm9keS5hcHBlbmQoICdyZXF1ZXN0X2lkJywgU3RyaW5nKCBkZXRhaWxzX3JlcXVlc3RfaWQgKSApO1xuXHRcdHJlcXVlc3RfYm9keS5hcHBlbmQoICdyZXNvdXJjZV9pZCcsIFN0cmluZyggcmVzb3VyY2VfaWQgKSApO1xuXHRcdGRldGFpbHNfYWJvcnRfY29udHJvbGxlciA9ICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cuQWJvcnRDb250cm9sbGVyID8gbmV3IHdpbmRvdy5BYm9ydENvbnRyb2xsZXIoKSA6IG51bGw7XG5cblx0XHR3aW5kb3cuZmV0Y2goIGNvbmZpZy5hamF4X3VybCwge1xuXHRcdFx0Ym9keTogcmVxdWVzdF9ib2R5LnRvU3RyaW5nKCksXG5cdFx0XHRjcmVkZW50aWFsczogJ3NhbWUtb3JpZ2luJyxcblx0XHRcdGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQ7IGNoYXJzZXQ9VVRGLTgnIH0sXG5cdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdHNpZ25hbDogZGV0YWlsc19hYm9ydF9jb250cm9sbGVyID8gZGV0YWlsc19hYm9ydF9jb250cm9sbGVyLnNpZ25hbCA6IHVuZGVmaW5lZFxuXHRcdH0gKS50aGVuKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0cmV0dXJuIHJlc3BvbnNlLmpzb24oKTtcblx0XHR9ICkudGhlbiggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdGlmICggZGV0YWlsc19yZXF1ZXN0X2lkICE9PSBkZXRhaWxzX3JlcXVlc3Rfc2VxdWVuY2UgfHwgcmVzb3VyY2VfaWQgIT09IGRldGFpbHNfcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggISByZXNwb25zZSB8fCB0cnVlICE9PSByZXNwb25zZS5zdWNjZXNzIHx8IE51bWJlciggcmVzcG9uc2UucmVxdWVzdF9pZCApICE9PSBkZXRhaWxzX3JlcXVlc3RfaWQgfHwgTnVtYmVyKCByZXNwb25zZS5yZXNvdXJjZV9pZCApICE9PSByZXNvdXJjZV9pZCB8fCAhIHJlc3BvbnNlLmRldGFpbHMgfHwgISBBcnJheS5pc0FycmF5KCByZXNwb25zZS5kZXRhaWxzLnNlY3Rpb25zICkgKSB7XG5cdFx0XHRcdHJlbmRlcl9kZXRhaWxzX3JvdyggY29uZmlnLCByZXNvdXJjZV9yb3csIE9iamVjdC5hc3NpZ24oIHt9LCB0ZW1wbGF0ZV9iYXNlLCB7XG5cdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZTogZ2V0X2RldGFpbHNfZXJyb3JfbWVzc2FnZSggcmVzcG9uc2UsIGNvbmZpZy5pMThuLmRldGFpbHNfbG9hZF9mYWlsZWQgKSxcblx0XHRcdFx0XHRzdGF0ZTogJ2Vycm9yJ1xuXHRcdFx0XHR9ICkgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cmVuZGVyX2RldGFpbHNfcm93KCBjb25maWcsIHJlc291cmNlX3JvdywgT2JqZWN0LmFzc2lnbigge30sIHRlbXBsYXRlX2Jhc2UsIHJlc3BvbnNlLmRldGFpbHMsIHtcblx0XHRcdFx0Y29sc3BhbjogZ2V0X2RldGFpbHNfY29sc3BhbiggcmVzb3VyY2Vfcm93ICksXG5cdFx0XHRcdHN0YXRlOiAncmVhZHknXG5cdFx0XHR9ICkgKTtcblx0XHRcdHZhciBjYXRhbG9nX21vdW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIGNvbmZpZy5tb3VudF9pZCApO1xuXHRcdFx0c3luY2hyb25pemVfb3ZlcmZsb3dfdG9vbHRpcHMoIGNhdGFsb2dfbW91bnQgKTtcblx0XHRcdGluaXRpYWxpemVfZGV0YWlsc190b29sdGlwcyggY2F0YWxvZ19tb3VudCApO1xuXHRcdH0gKS5jYXRjaCggZnVuY3Rpb24gKCBlcnJvciApIHtcblx0XHRcdGlmICggZXJyb3IgJiYgJ0Fib3J0RXJyb3InID09PSBlcnJvci5uYW1lICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGRldGFpbHNfcmVxdWVzdF9pZCA9PT0gZGV0YWlsc19yZXF1ZXN0X3NlcXVlbmNlICYmIHJlc291cmNlX2lkID09PSBkZXRhaWxzX3Jlc291cmNlX2lkICkge1xuXHRcdFx0XHRyZW5kZXJfZGV0YWlsc19yb3coIGNvbmZpZywgcmVzb3VyY2Vfcm93LCBPYmplY3QuYXNzaWduKCB7fSwgdGVtcGxhdGVfYmFzZSwge1xuXHRcdFx0XHRcdGVycm9yX21lc3NhZ2U6IGNvbmZpZy5pMThuLmRldGFpbHNfbG9hZF9mYWlsZWQgfHwgJycsXG5cdFx0XHRcdFx0c3RhdGU6ICdlcnJvcidcblx0XHRcdFx0fSApICk7XG5cdFx0XHR9XG5cdFx0fSApLnRoZW4oIGZ1bmN0aW9uICgpIHtcblx0XHRcdGlmICggZGV0YWlsc19yZXF1ZXN0X2lkID09PSBkZXRhaWxzX3JlcXVlc3Rfc2VxdWVuY2UgKSB7XG5cdFx0XHRcdGRldGFpbHNfYWJvcnRfY29udHJvbGxlciA9IG51bGw7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvcHkgb25lIGRldGFpbHMgdmFsdWUgd2l0aG91dCBuYXZpZ2F0aW5nIG9yIG11dGF0aW5nIFJlc291cmNlIHN0YXRlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICBjb3B5X3ZhbHVlICAgIFBsYWluIHRleHQgdG8gY29weS5cblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gYWN0aW9uX2J1dHRvbiBDb3B5IGJ1dHRvbiB1c2VkIHRvIGxvY2F0ZSBzdGF0dXMgdGV4dC5cblx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgY29uZmlnICAgICAgICBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBjb3B5X2RldGFpbHNfdmFsdWUoIGNvcHlfdmFsdWUsIGFjdGlvbl9idXR0b24sIGNvbmZpZyApIHtcblx0XHR2YXIgZGV0YWlsc19yb3cgPSBhY3Rpb25fYnV0dG9uLmNsb3Nlc3QoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtZGV0YWlscy1yb3ddJyApO1xuXHRcdHZhciByZXNvdXJjZV9pZCA9IE51bWJlciggYWN0aW9uX2J1dHRvbi5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1pZCcgKSB8fCAwICk7XG5cdFx0dmFyIHN0YXR1c19lbGVtZW50ID0gZGV0YWlsc19yb3dcblx0XHRcdD8gZGV0YWlsc19yb3cucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1jb3B5LXN0YXR1c10nIClcblx0XHRcdDogZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1jb3B5LXN0YXR1cz1cIicgKyBTdHJpbmcoIHJlc291cmNlX2lkICkgKyAnXCJdJyApO1xuXHRcdHZhciBjb3B5X3Byb21pc2U7XG5cblx0XHRpZiAoIHdpbmRvdy5uYXZpZ2F0b3IuY2xpcGJvYXJkICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cubmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQgKSB7XG5cdFx0XHRjb3B5X3Byb21pc2UgPSB3aW5kb3cubmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQoIGNvcHlfdmFsdWUgKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29weV9wcm9taXNlID0gbmV3IHdpbmRvdy5Qcm9taXNlKCBmdW5jdGlvbiAoIHJlc29sdmUsIHJlamVjdCApIHtcblx0XHRcdFx0dmFyIGNvcHlfaW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAndGV4dGFyZWEnICk7XG5cdFx0XHRcdGNvcHlfaW5wdXQudmFsdWUgPSBjb3B5X3ZhbHVlO1xuXHRcdFx0XHRjb3B5X2lucHV0LnNldEF0dHJpYnV0ZSggJ3JlYWRvbmx5JywgJ3JlYWRvbmx5JyApO1xuXHRcdFx0XHRjb3B5X2lucHV0LnN0eWxlLnBvc2l0aW9uID0gJ2ZpeGVkJztcblx0XHRcdFx0Y29weV9pbnB1dC5zdHlsZS5vcGFjaXR5ID0gJzAnO1xuXHRcdFx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKCBjb3B5X2lucHV0ICk7XG5cdFx0XHRcdGNvcHlfaW5wdXQuc2VsZWN0KCk7XG5cdFx0XHRcdGlmICggZG9jdW1lbnQuZXhlY0NvbW1hbmQoICdjb3B5JyApICkge1xuXHRcdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZWplY3QoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKCBjb3B5X2lucHV0ICk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXHRcdGNvcHlfcHJvbWlzZS50aGVuKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRpZiAoIHN0YXR1c19lbGVtZW50ICkge1xuXHRcdFx0XHRzdGF0dXNfZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCAnaGFzLWVycm9yJyApO1xuXHRcdFx0XHRzdGF0dXNfZWxlbWVudC50ZXh0Q29udGVudCA9IGNvbmZpZy5pMThuLnNob3J0Y29kZV9jb3BpZWQgfHwgJyc7XG5cdFx0XHR9XG5cdFx0fSApLmNhdGNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRpZiAoIHN0YXR1c19lbGVtZW50ICkge1xuXHRcdFx0XHRzdGF0dXNfZWxlbWVudC5jbGFzc0xpc3QuYWRkKCAnaGFzLWVycm9yJyApO1xuXHRcdFx0XHRzdGF0dXNfZWxlbWVudC50ZXh0Q29udGVudCA9IGNvbmZpZy5pMThuLnNob3J0Y29kZV9jb3B5X2ZhaWxlZCB8fCAnJztcblx0XHRcdH1cblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIHRoZSBjdXJyZW50IGVmZmVjdGl2ZSBzaG9ydGNvZGUgZm9yIG9uZSBSZXNvdXJjZS5cblx0ICpcblx0ICogVGhlIGFjdGl2ZSBpbnNwZWN0b3Igd2lucyBzbyB1bnNhdmVkIGN1c3RvbWl6ZXIgY2hhbmdlcyBhcmUgdXNlZCBieSBDb3B5XG5cdCAqIGFuZCBQdWJsaXNoLiBBIGhpZGRlbiBjb21wYXRpYmlsaXR5IGlucHV0IGlzIHRoZSBmYWxsYmFjayByZXF1aXJlZCBieSB0aGVcblx0ICogc2hhcmVkIEJvb2tpbmcgQ2FsZW5kYXIgcHVibGlzaCB3aXphcmQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSAgICAgIHJlc291cmNlX2lkICBCb29raW5nIFJlc291cmNlIElELlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBhY3Rpb25fYnV0dG9uIE9wdGlvbmFsIGluaXRpYXRpbmcgYWN0aW9uLlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IEN1cnJlbnQgZWZmZWN0aXZlIHNob3J0Y29kZS5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9ib29raW5nX3Jlc291cmNlX3Nob3J0Y29kZSggcmVzb3VyY2VfaWQsIGFjdGlvbl9idXR0b24gKSB7XG5cdFx0dmFyIGluc3BlY3Rvcl9zaG9ydGNvZGUgPSByZXNvdXJjZV9pZCA9PT0gaW5zcGVjdG9yX3Jlc291cmNlX2lkXG5cdFx0XHQ/IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtaW5zcGVjdG9yLWZvcm1dIC53cGJjX2NhdGFsb2dfYm9va2luZ19yZXNvdXJjZXNfX2VkaXRvcl9jb2RlJyApXG5cdFx0XHQ6IG51bGw7XG5cdFx0dmFyIGhpZGRlbl9zaG9ydGNvZGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ2Jvb2tpbmdfcmVzb3VyY2Vfc2hvcnRjb2RlXycgKyBTdHJpbmcoIHJlc291cmNlX2lkICkgKTtcblxuXHRcdGlmICggaW5zcGVjdG9yX3Nob3J0Y29kZSApIHtcblx0XHRcdHJldHVybiBTdHJpbmcoIGluc3BlY3Rvcl9zaG9ydGNvZGUudmFsdWUgfHwgJycgKTtcblx0XHR9XG5cdFx0aWYgKCBhY3Rpb25fYnV0dG9uICYmIGFjdGlvbl9idXR0b24uZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2Utc2hvcnRjb2RlJyApICkge1xuXHRcdFx0cmV0dXJuIFN0cmluZyggYWN0aW9uX2J1dHRvbi5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1zaG9ydGNvZGUnICkgfHwgJycgKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gaGlkZGVuX3Nob3J0Y29kZSA/IFN0cmluZyggaGlkZGVuX3Nob3J0Y29kZS52YWx1ZSB8fCAnJyApIDogJyc7XG5cdH1cblxuXHQvKipcblx0ICogQ3JlYXRlIG9yIHVwZGF0ZSB0aGUgaGlkZGVuIGlucHV0IGNvbnN1bWVkIGJ5IHRoZSBzaGFyZWQgcHVibGlzaCB3aXphcmQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCBCb29raW5nIFJlc291cmNlIElELlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gc2hvcnRjb2RlICAgRWZmZWN0aXZlIEJvb2tpbmcgc2hvcnRjb2RlLlxuXHQgKiBAcmV0dXJuIHtIVE1MSW5wdXRFbGVtZW50fG51bGx9IENvbXBhdGliaWxpdHkgaW5wdXQgb3IgbnVsbC5cblx0ICovXG5cdGZ1bmN0aW9uIHN5bmNocm9uaXplX2Jvb2tpbmdfcmVzb3VyY2Vfc2hvcnRjb2RlX2lucHV0KCByZXNvdXJjZV9pZCwgc2hvcnRjb2RlICkge1xuXHRcdHZhciBpbnB1dDtcblxuXHRcdGlmICggISByZXNvdXJjZV9pZCApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRpbnB1dCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnYm9va2luZ19yZXNvdXJjZV9zaG9ydGNvZGVfJyArIFN0cmluZyggcmVzb3VyY2VfaWQgKSApO1xuXHRcdGlmICggISBpbnB1dCApIHtcblx0XHRcdGlucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2lucHV0JyApO1xuXHRcdFx0aW5wdXQudHlwZSA9ICdoaWRkZW4nO1xuXHRcdFx0aW5wdXQuaWQgPSAnYm9va2luZ19yZXNvdXJjZV9zaG9ydGNvZGVfJyArIFN0cmluZyggcmVzb3VyY2VfaWQgKTtcblx0XHRcdGlucHV0LnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1jYXRhbG9nLXNob3J0Y29kZS1jb21wYXRpYmlsaXR5JywgU3RyaW5nKCByZXNvdXJjZV9pZCApICk7XG5cdFx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKCBpbnB1dCApO1xuXHRcdH1cblx0XHRpbnB1dC52YWx1ZSA9IFN0cmluZyggc2hvcnRjb2RlIHx8ICcnICk7XG5cblx0XHRyZXR1cm4gaW5wdXQ7XG5cdH1cblxuXHQvKipcblx0ICogT3BlbiB0aGUgc2hhcmVkIEJvb2tpbmcgQ2FsZW5kYXIgc2hvcnRjb2RlIGN1c3RvbWl6ZXIgZm9yIG9uZSBSZXNvdXJjZS5cblx0ICpcblx0ICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkIEJvb2tpbmcgUmVzb3VyY2UgSUQuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBzaG9ydGNvZGUgICBDdXJyZW50IHNob3J0Y29kZS5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGN1c3RvbWl6ZV9ib29raW5nX3Jlc291cmNlX3Nob3J0Y29kZSggcmVzb3VyY2VfaWQsIHNob3J0Y29kZSApIHtcblx0XHRzeW5jaHJvbml6ZV9ib29raW5nX3Jlc291cmNlX3Nob3J0Y29kZV9pbnB1dCggcmVzb3VyY2VfaWQsIHNob3J0Y29kZSApO1xuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX3Jlc291cmNlX3BhZ2VfYnRuX2NsaWNrICkge1xuXHRcdFx0d2luZG93LndwYmNfcmVzb3VyY2VfcGFnZV9idG5fY2xpY2soIHJlc291cmNlX2lkLCBzaG9ydGNvZGUgKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogT3BlbiB0aGUgc2hhcmVkIEJvb2tpbmcgQ2FsZW5kYXIgZW1iZWQvY3JlYXRlLXBhZ2Ugd2l6YXJkLlxuXHQgKlxuXHQgKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWQgQm9va2luZyBSZXNvdXJjZSBJRC5cblx0ICogQHBhcmFtIHtzdHJpbmd9IHNob3J0Y29kZSAgIEN1cnJlbnQgc2hvcnRjb2RlLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gcHVibGlzaF9ib29raW5nX3Jlc291cmNlX3Nob3J0Y29kZSggcmVzb3VyY2VfaWQsIHNob3J0Y29kZSwgdHJpZ2dlcl9idXR0b24gKSB7XG5cdFx0c3luY2hyb25pemVfYm9va2luZ19yZXNvdXJjZV9zaG9ydGNvZGVfaW5wdXQoIHJlc291cmNlX2lkLCBzaG9ydGNvZGUgKTtcblx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19wdWJsaXNoX2Jvb2tpbmdfZm9ybV9fb3BlbiApIHtcblx0XHRcdHdpbmRvdy53cGJjX3B1Ymxpc2hfYm9va2luZ19mb3JtX19vcGVuKCByZXNvdXJjZV9pZCwgc2hvcnRjb2RlLCB0cmlnZ2VyX2J1dHRvbiApO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBPcGVuIHRoZSBpbmZvcm1hdGlvbmFsIEZyZWUtZWRpdGlvbiBCb29raW5nIFJlc291cmNlIHVwZ3JhZGUgZGlhbG9nLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSB0cmlnZ2VyX2J1dHRvbiBCdXR0b24gdGhhdCBvcGVuZWQgdGhlIGRpYWxvZy5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIG9wZW5fYm9va2luZ19yZXNvdXJjZV91cGdyYWRlX2RpYWxvZyggdHJpZ2dlcl9idXR0b24gKSB7XG5cdFx0dmFyIG1vZGFsX2VsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfY2F0YWxvZ19ib29raW5nX3Jlc291cmNlc19fdXBncmFkZV9tb2RhbCcgKTtcblx0XHR2YXIgdXBncmFkZV91cmwgPSB0cmlnZ2VyX2J1dHRvbiA/IHRyaWdnZXJfYnV0dG9uLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1jYXRhbG9nLWJvb2tpbmctcmVzb3VyY2UtdXBncmFkZS11cmwnICkgOiAnJztcblxuXHRcdGlmICggbW9kYWxfZWxlbWVudCAmJiB3aW5kb3cualF1ZXJ5ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cualF1ZXJ5KCBtb2RhbF9lbGVtZW50ICkud3BiY19teV9tb2RhbCApIHtcblx0XHRcdHdpbmRvdy5qUXVlcnkoIG1vZGFsX2VsZW1lbnQgKVxuXHRcdFx0XHQub2ZmKCAnaGlkZGVuLndwYmMubW9kYWwud3BiY0NhdGFsb2dSZXNvdXJjZVVwZ3JhZGUgaGlkZGVuLmJzLm1vZGFsLndwYmNDYXRhbG9nUmVzb3VyY2VVcGdyYWRlJyApXG5cdFx0XHRcdC5vbmUoICdoaWRkZW4ud3BiYy5tb2RhbC53cGJjQ2F0YWxvZ1Jlc291cmNlVXBncmFkZSBoaWRkZW4uYnMubW9kYWwud3BiY0NhdGFsb2dSZXNvdXJjZVVwZ3JhZGUnLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0aWYgKCB0cmlnZ2VyX2J1dHRvbiAmJiBkb2N1bWVudC5jb250YWlucyggdHJpZ2dlcl9idXR0b24gKSApIHtcblx0XHRcdFx0XHRcdHRyaWdnZXJfYnV0dG9uLmZvY3VzKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IClcblx0XHRcdFx0LndwYmNfbXlfbW9kYWwoICdzaG93JyApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICggdXBncmFkZV91cmwgKSB7XG5cdFx0XHR3aW5kb3cub3BlbiggdXBncmFkZV91cmwsICdfYmxhbmsnLCAnbm9vcGVuZXInICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIE9wZW4gdGhlIHJldXNhYmxlIG5hdGl2ZSBjYXRhbG9nIG1lc3NhZ2UgZGlhbG9nLlxuXHQgKlxuXHQgKiBNZXNzYWdlIGNvbnRlbnQgaXMgYXNzaWduZWQgd2l0aCB0ZXh0Q29udGVudCBzbyB0cmFuc2xhdGVkIG9yIHNlcnZlci1wcm92aWRlZFxuXHQgKiB0ZXh0IGNhbm5vdCBiZWNvbWUgZGlhbG9nIG1hcmt1cC4gVGhlIGJyb3dzZXIgYWxlcnQgcmVtYWlucyBhIHJlc2lsaWVuY2Vcblx0ICogZmFsbGJhY2sgd2hlbiB0aGUgQm9va2luZyBDYWxlbmRhciBtb2RhbCBydW50aW1lIGlzIHVuYXZhaWxhYmxlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICBtZXNzYWdlICAgICAgICBNZXNzYWdlIHNob3duIGluIHRoZSBkaWFsb2cgYm9keS5cblx0ICogQHBhcmFtIHtzdHJpbmd9ICAgICAgdGl0bGUgICAgICAgICAgT3B0aW9uYWwgZGlhbG9nIGhlYWRpbmcuXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHRyaWdnZXJfYnV0dG9uIENvbnRyb2wgdGhhdCBvcGVuZWQgdGhlIGRpYWxvZy5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBuYXRpdmUgZGlhbG9nIG9wZW5lZDsgb3RoZXJ3aXNlIGZhbHNlLlxuXHQgKi9cblx0ZnVuY3Rpb24gb3Blbl9ib29raW5nX3Jlc291cmNlX21lc3NhZ2VfZGlhbG9nKCBtZXNzYWdlLCB0aXRsZSwgdHJpZ2dlcl9idXR0b24gKSB7XG5cdFx0dmFyIG1vZGFsX2VsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfY2F0YWxvZ19ib29raW5nX3Jlc291cmNlc19fbWVzc2FnZV9tb2RhbCcgKTtcblx0XHR2YXIgdGl0bGVfZWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19jYXRhbG9nX2Jvb2tpbmdfcmVzb3VyY2VzX19tZXNzYWdlX21vZGFsX3RpdGxlJyApO1xuXHRcdHZhciBkZXNjcmlwdGlvbl9lbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2NhdGFsb2dfYm9va2luZ19yZXNvdXJjZXNfX21lc3NhZ2VfbW9kYWxfZGVzY3JpcHRpb24nICk7XG5cblx0XHRpZiAoIG1lc3NhZ2UgJiYgbW9kYWxfZWxlbWVudCAmJiBkZXNjcmlwdGlvbl9lbGVtZW50ICYmIHdpbmRvdy5qUXVlcnkgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5qUXVlcnkoIG1vZGFsX2VsZW1lbnQgKS53cGJjX215X21vZGFsICkge1xuXHRcdFx0ZGVzY3JpcHRpb25fZWxlbWVudC50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XG5cdFx0XHRpZiAoIHRpdGxlX2VsZW1lbnQgKSB7XG5cdFx0XHRcdHRpdGxlX2VsZW1lbnQudGV4dENvbnRlbnQgPSB0aXRsZSB8fCB0aXRsZV9lbGVtZW50LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1kZWZhdWx0LXRpdGxlJyApIHx8ICcnO1xuXHRcdFx0fVxuXHRcdFx0d2luZG93LmpRdWVyeSggbW9kYWxfZWxlbWVudCApXG5cdFx0XHRcdC5vZmYoICdoaWRkZW4ud3BiYy5tb2RhbC53cGJjQ2F0YWxvZ1Jlc291cmNlTWVzc2FnZSBoaWRkZW4uYnMubW9kYWwud3BiY0NhdGFsb2dSZXNvdXJjZU1lc3NhZ2UnIClcblx0XHRcdFx0Lm9uZSggJ2hpZGRlbi53cGJjLm1vZGFsLndwYmNDYXRhbG9nUmVzb3VyY2VNZXNzYWdlIGhpZGRlbi5icy5tb2RhbC53cGJjQ2F0YWxvZ1Jlc291cmNlTWVzc2FnZScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRpZiAoIHRyaWdnZXJfYnV0dG9uICYmIGRvY3VtZW50LmNvbnRhaW5zKCB0cmlnZ2VyX2J1dHRvbiApICkge1xuXHRcdFx0XHRcdFx0dHJpZ2dlcl9idXR0b24uZm9jdXMoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKVxuXHRcdFx0XHQud3BiY19teV9tb2RhbCggJ3Nob3cnICk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAoIG1lc3NhZ2UgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5hbGVydCApIHtcblx0XHRcdHdpbmRvdy5hbGVydCggbWVzc2FnZSApO1xuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIHRoZSB0ZW1wbGF0ZS1kcml2ZW4gaW5zcGVjdG9yIGhvc3QuXG5cdCAqXG5cdCAqIEByZXR1cm4ge0hUTUxFbGVtZW50fG51bGx9IEluc3BlY3RvciBob3N0IG9yIG51bGwuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfaW5zcGVjdG9yX2hvc3QoKSB7XG5cdFx0cmV0dXJuIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctYm9va2luZy1yZXNvdXJjZXMtaW5zcGVjdG9yLWhvc3RdJyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiB0aGUgc3RpY2t5IG5hdGl2ZS1zaWRlYmFyIGZvb3Rlci5cblx0ICpcblx0ICogQHJldHVybiB7SFRNTEVsZW1lbnR8bnVsbH0gRm9vdGVyIGVsZW1lbnQgb3IgbnVsbC5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9pbnNwZWN0b3JfZm9vdGVyKCkge1xuXHRcdHJldHVybiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1mb290ZXJdJyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiB0aGUgc2hhcmVkIG5hdGl2ZSBpbnNwZWN0b3Igc3RhdGUgd29ya2Zsb3cuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgQ2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8ZmFsc2V9IFNoYXJlZCBpbnNwZWN0b3Igd29ya2Zsb3cgb3IgZmFsc2UuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfaW5zcGVjdG9yX3dvcmtmbG93KCBjb25maWcgKSB7XG5cdFx0aWYgKCBpbnNwZWN0b3Jfd29ya2Zsb3dfY29udHJvbGxlciApIHtcblx0XHRcdHJldHVybiBpbnNwZWN0b3Jfd29ya2Zsb3dfY29udHJvbGxlcjtcblx0XHR9XG5cdFx0aWYgKCAhIHdpbmRvdy53cGJjX3VpX2NhdGFsb2cgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy53cGJjX3VpX2NhdGFsb2cuY3JlYXRlX2luc3BlY3Rvcl93b3JrZmxvdyApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpbnNwZWN0b3Jfd29ya2Zsb3dfY29udHJvbGxlciA9IHdpbmRvdy53cGJjX3VpX2NhdGFsb2cuY3JlYXRlX2luc3BlY3Rvcl93b3JrZmxvdygge1xuXHRcdFx0ZXhwYW5kOiBleHBhbmRfaW5zcGVjdG9yX3NpZGViYXIsXG5cdFx0XHRnZXRfZm9vdGVyOiBnZXRfaW5zcGVjdG9yX2Zvb3Rlcixcblx0XHRcdGdldF9ob3N0OiBnZXRfaW5zcGVjdG9yX2hvc3QsXG5cdFx0XHRyZW5kZXJfc2hlbGw6IGZ1bmN0aW9uICggc2hlbGxfZGF0YSApIHsgcmV0dXJuIHJlbmRlcl9jb21wb25lbnQoIGNvbmZpZywgJ2luc3BlY3RvcicsIHNoZWxsX2RhdGEgKTsgfSxcblx0XHRcdHNoZWxsX2RhdGE6IHtcblx0XHRcdFx0Y2F0YWxvZ19pZDogY29uZmlnLmlkLFxuXHRcdFx0XHRlbXB0eV9pY29uOiAnd3BiYy1iaS1wZW5jaWwtc3F1YXJlJyxcblx0XHRcdFx0ZW1wdHlfbWVzc2FnZTogY29uZmlnLmkxOG4uaW5zcGVjdG9yX2VtcHR5X21lc3NhZ2UgfHwgJycsXG5cdFx0XHRcdGVtcHR5X3RpdGxlOiBjb25maWcuaTE4bi5pbnNwZWN0b3JfZW1wdHlfdGl0bGUgfHwgJycsXG5cdFx0XHRcdGxvYWRpbmdfbGFiZWw6IGNvbmZpZy5pMThuLmluc3BlY3Rvcl9sb2FkaW5nIHx8IGNvbmZpZy5pMThuLmxvYWRpbmcgfHwgJydcblx0XHRcdH1cblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gaW5zcGVjdG9yX3dvcmtmbG93X2NvbnRyb2xsZXI7XG5cdH1cblxuXHQvKipcblx0ICogUmVuZGVyIHRoZSBzaGFyZWQgaW5zcGVjdG9yIGZhbGxiYWNrLXN0YXRlIHNoZWxsIG9uY2UuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgQ2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIHNoZWxsIGlzIGF2YWlsYWJsZS5cblx0ICovXG5cdGZ1bmN0aW9uIG1vdW50X2luc3BlY3Rvcl9zaGVsbCggY29uZmlnICkge1xuXHRcdHZhciBpbnNwZWN0b3Jfd29ya2Zsb3cgPSBnZXRfaW5zcGVjdG9yX3dvcmtmbG93KCBjb25maWcgKTtcblxuXHRcdHJldHVybiAhISBpbnNwZWN0b3Jfd29ya2Zsb3cgJiYgaW5zcGVjdG9yX3dvcmtmbG93Lm1vdW50KCk7XG5cdH1cblxuXHQvKipcblx0ICogRXhwYW5kIHRoZSBuYXRpdmUgcmlnaHQgc2lkZWJhciBhZnRlciBhbiBleHBsaWNpdCBlZGl0b3IgYWN0aW9uLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gZXhwYW5kX2luc3BlY3Rvcl9zaWRlYmFyKCkge1xuXHRcdHN5bmNocm9uaXplX2luc3BlY3Rvcl93aWR0aCgpO1xuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX2FkbWluX3VpX19zaWRlYmFyX3JpZ2h0X19kb19tYXggKSB7XG5cdFx0XHR3aW5kb3cud3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fZG9fbWF4KCk7XG5cdFx0fVxuXHRcdGRvY3VtZW50LmRpc3BhdGNoRXZlbnQoIG5ldyBDdXN0b21FdmVudCggJ3dwYmNfc2V0dXBfd2l6YXJkX2xheW91dF9jaGFuZ2VkJyApICk7XG5cdH1cblxuXHQvKipcblx0ICogQXBwbHkgdGhlIGVzdGFibGlzaGVkIHdpZGVyIHNpZGViYXIgb25seSB3aGlsZSBjcmVhdGluZyBSZXNvdXJjZXMuXG5cdCAqXG5cdCAqIFRoZSBuZXcgY2F0YWxvZyBvd25zIGl0cyBjbGFzcyBhbmQgc3R5bGluZyBzbyBpdCBkb2VzIG5vdCBkZXBlbmQgb24gdGhlIG9sZFxuXHQgKiBsaXN0aW5nIGFzc2V0cyB3aGlsZSByZXRhaW5pbmcgdGhlIHNhbWUgbmF0aXZlLXNpZGViYXIgd2lkdGggY29udHJhY3QuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzeW5jaHJvbml6ZV9pbnNwZWN0b3Jfd2lkdGgoKSB7XG5cdFx0dmFyIGhvc3QgPSBnZXRfaW5zcGVjdG9yX2hvc3QoKTtcblx0XHR2YXIgc2lkZWJhciA9IGhvc3QgPyBob3N0LmNsb3Nlc3QoICcud3BiY191aV9lbF9fdmVydF9yaWdodF9iYXJfX3dyYXBwZXInICkgOiBudWxsO1xuXG5cdFx0aWYgKCBzaWRlYmFyICkge1xuXHRcdFx0c2lkZWJhci5jbGFzc0xpc3QudG9nZ2xlKCAnd3BiY19jYXRhbG9nX2Jvb2tpbmdfcmVzb3VyY2VzX19pbnNwZWN0b3Jfd2lkdGgtLXdpZGUnLCAnY3JlYXRlJyA9PT0gaW5zcGVjdG9yX21vZGUgKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogTWFyayBvbmx5IHRoZSBSZXNvdXJjZSBjdXJyZW50bHkgb3duZWQgYnkgdGhlIGluc3BlY3Rvci5cblx0ICpcblx0ICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkIFJlc291cmNlIElEIG9yIHplcm8gdG8gY2xlYXIgaGlnaGxpZ2h0aW5nLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gbWFya19pbnNwZWN0b3JfcmVzb3VyY2Vfcm93KCByZXNvdXJjZV9pZCApIHtcblx0XHRkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWlkXS5pcy1lZGl0b3ItYWN0aXZlJyApLmZvckVhY2goIGZ1bmN0aW9uICggcm93ICkge1xuXHRcdFx0cm93LmNsYXNzTGlzdC5yZW1vdmUoICdpcy1lZGl0b3ItYWN0aXZlJyApO1xuXHRcdH0gKTtcblx0XHRpZiAoIHJlc291cmNlX2lkICkge1xuXHRcdFx0dmFyIHJvdyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtaWQ9XCInICsgU3RyaW5nKCByZXNvdXJjZV9pZCApICsgJ1wiXScgKTtcblx0XHRcdGlmICggcm93ICkge1xuXHRcdFx0XHRyb3cuY2xhc3NMaXN0LmFkZCggJ2lzLWVkaXRvci1hY3RpdmUnICk7XG5cdFx0XHRcdHJvdy5zY3JvbGxJbnRvVmlldyggeyBibG9jazogJ25lYXJlc3QnLCBiZWhhdmlvcjogJ3Ntb290aCcgfSApO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBTeW5jaHJvbml6ZSBzaGFyZWQgZW1wdHksIGxvYWRpbmcsIGVycm9yLCBmb3JtLCBhbmQgZm9vdGVyIHN0YXRlcy5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IHN0YXRlIEVtcHR5LCBsb2FkaW5nLCBlcnJvciwgb3IgZm9ybS5cblx0ICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgT3B0aW9uYWwgc2FmZSBlcnJvciBtZXNzYWdlLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc2V0X2luc3BlY3Rvcl9zdGF0ZSggc3RhdGUsIG1lc3NhZ2UgKSB7XG5cdFx0aWYgKCBpbnNwZWN0b3Jfd29ya2Zsb3dfY29udHJvbGxlciApIHtcblx0XHRcdGluc3BlY3Rvcl93b3JrZmxvd19jb250cm9sbGVyLnNldF9zdGF0ZSggc3RhdGUsIG1lc3NhZ2UgKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogU2VyaWFsaXplIGN1cnJlbnQgZWRpdGFibGUgZmllbGQgdmFsdWVzIGZvciBkaXJ0eS1zdGF0ZSBjb21wYXJpc29uLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IFN0YWJsZSBKU09OIGZpZWxkIHNuYXBzaG90LlxuXHQgKi9cblx0ZnVuY3Rpb24gc2VyaWFsaXplX2luc3BlY3Rvcl9maWVsZHMoKSB7XG5cdFx0dmFyIGZpZWxkcyA9IHt9O1xuXHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtaW5zcGVjdG9yLWZvcm1dIFtkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1yYWRpby1maWVsZF06Y2hlY2tlZCcgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGZpZWxkICkge1xuXHRcdFx0ZmllbGRzWyBmaWVsZC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1yYWRpby1maWVsZCcgKSB8fCAnJyBdID0gZmllbGQudmFsdWU7XG5cdFx0fSApO1xuXHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtaW5zcGVjdG9yLWZvcm1dIFtkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1maWVsZF0nICkuZm9yRWFjaCggZnVuY3Rpb24gKCBmaWVsZCApIHtcblx0XHRcdGZpZWxkc1sgZmllbGQuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtZmllbGQnICkgfHwgJycgXSA9IGZpZWxkLnZhbHVlO1xuXHRcdH0gKTtcblxuXHRcdHJldHVybiBKU09OLnN0cmluZ2lmeSggZmllbGRzICk7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIHRoZSBjdXJyZW50bHkgc2VsZWN0ZWQgUmVzb3VyY2UgY3JlYXRpb24gbW9kZS5cblx0ICpcblx0ICogQHJldHVybiB7c3RyaW5nfSBJbmRlcGVuZGVudCBvciBjaGlsZHJlbi5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9pbnNwZWN0b3JfY3JlYXRpb25fbW9kZSgpIHtcblx0XHR2YXIgc2VsZWN0ZWRfbW9kZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtcmFkaW8tZmllbGQ9XCJjcmVhdGlvbl9tb2RlXCJdOmNoZWNrZWQnICk7XG5cdFx0dmFyIGhpZGRlbl9tb2RlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1maWVsZD1cImNyZWF0aW9uX21vZGVcIl0nICk7XG5cblx0XHRyZXR1cm4gU3RyaW5nKCBzZWxlY3RlZF9tb2RlID8gc2VsZWN0ZWRfbW9kZS52YWx1ZSA6IGhpZGRlbl9tb2RlID8gaGlkZGVuX21vZGUudmFsdWUgOiAnaW5kZXBlbmRlbnQnICk7XG5cdH1cblxuXHQvKipcblx0ICogU3luY2hyb25pemUgY3JlYXRlLW9ubHkgY29uZGl0aW9uYWwgZmllbGRzIGFuZCByYWRpby1jYXJkIHByZXNlbnRhdGlvbi5cblx0ICpcblx0ICogVGhlc2UgY29udHJvbHMgaW1wcm92ZSBjbGFyaXR5IG9ubHkuIFRoZSBjcmVhdGUgc2VydmljZSBpbmRlcGVuZGVudGx5XG5cdCAqIGF1dGhvcml6ZXMgdGhlIHNlbGVjdGVkIHBhcmVudCBhbmQgZGVyaXZlcyBhbGwgaW5oZXJpdGVkIHZhbHVlcy5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHN5bmNocm9uaXplX2NyZWF0ZV9pbnNwZWN0b3JfY29udHJvbHMoKSB7XG5cdFx0aWYgKCAnY3JlYXRlJyAhPT0gaW5zcGVjdG9yX21vZGUgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dmFyIGNyZWF0aW9uX21vZGUgPSBnZXRfaW5zcGVjdG9yX2NyZWF0aW9uX21vZGUoKTtcblx0XHR2YXIgcGFyZW50X3dyYXAgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWZpZWxkLXdyYXA9XCJwYXJlbnRfaWRcIl0nICk7XG5cblx0XHRkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLXJhZGlvLWZpZWxkPVwiY3JlYXRpb25fbW9kZVwiXScgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHJhZGlvICkge1xuXHRcdFx0dmFyIGNob2ljZSA9IHJhZGlvLmNsb3Nlc3QoICdsYWJlbCcgKTtcblx0XHRcdGlmICggY2hvaWNlICkge1xuXHRcdFx0XHRjaG9pY2UuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLXNlbGVjdGVkJywgcmFkaW8uY2hlY2tlZCApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0XHRpZiAoIHBhcmVudF93cmFwICkge1xuXHRcdFx0cGFyZW50X3dyYXAuaGlkZGVuID0gJ2NoaWxkcmVuJyAhPT0gY3JlYXRpb25fbW9kZTtcblx0XHRcdHBhcmVudF93cmFwLmNsYXNzTGlzdC50b2dnbGUoICdpcy1jb25kaXRpb25hbGx5LWhpZGRlbicsICdjaGlsZHJlbicgIT09IGNyZWF0aW9uX21vZGUgKTtcblx0XHR9XG5cdFx0WyAnYmFzZV9jb3N0JywgJ2RlZmF1bHRfZm9ybScsICdvd25lcl91c2VyX2lkJyBdLmZvckVhY2goIGZ1bmN0aW9uICggZmllbGRfa2V5ICkge1xuXHRcdFx0dmFyIGZpZWxkX3dyYXAgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWZpZWxkLXdyYXA9XCInICsgZmllbGRfa2V5ICsgJ1wiXScgKTtcblx0XHRcdGlmICggZmllbGRfd3JhcCApIHtcblx0XHRcdFx0ZmllbGRfd3JhcC5oaWRkZW4gPSAnY2hpbGRyZW4nID09PSBjcmVhdGlvbl9tb2RlO1xuXHRcdFx0XHRmaWVsZF93cmFwLmNsYXNzTGlzdC50b2dnbGUoICdpcy1jb25kaXRpb25hbGx5LWhpZGRlbicsICdjaGlsZHJlbicgPT09IGNyZWF0aW9uX21vZGUgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogU3luY2hyb25pemUgZGlydHkgc3RhdGUgYW5kIHRoZSBzdGlja3kgcHJpbWFyeSBhY3Rpb24uXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzeW5jaHJvbml6ZV9pbnNwZWN0b3JfZGlydHlfc3RhdGUoKSB7XG5cdFx0dmFyIHNhdmVfYnV0dG9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbnNwZWN0b3Itc2F2ZV0nICk7XG5cdFx0dmFyIGZvcm0gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWluc3BlY3Rvci1mb3JtXScgKTtcblx0XHR2YXIgc2F2ZV9pc19idXN5ID0gISEgc2F2ZV9idXR0b24gJiYgc2F2ZV9idXR0b24uY2xhc3NMaXN0LmNvbnRhaW5zKCAnaXMtYnVzeScgKTtcblxuXHRcdGluc3BlY3Rvcl9kaXJ0eSA9ICEhIGZvcm0gJiYgc2VyaWFsaXplX2luc3BlY3Rvcl9maWVsZHMoKSAhPT0gaW5zcGVjdG9yX29yaWdpbmFsX2ZpZWxkcztcblx0XHRpZiAoIHNhdmVfYnV0dG9uICkge1xuXHRcdFx0dmFyIHRpdGxlX2ZpZWxkID0gZm9ybSA/IGZvcm0ucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1maWVsZD1cInRpdGxlXCJdJyApIDogbnVsbDtcblx0XHRcdHZhciBwYXJlbnRfZmllbGQgPSBmb3JtID8gZm9ybS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWZpZWxkPVwicGFyZW50X2lkXCJdJyApIDogbnVsbDtcblx0XHRcdHZhciBjcmVhdGVfaXNfdmFsaWQgPSAnY3JlYXRlJyAhPT0gaW5zcGVjdG9yX21vZGVcblx0XHRcdFx0fHwgKCBmb3JtXG5cdFx0XHRcdFx0JiYgJ3RydWUnID09PSBmb3JtLmdldEF0dHJpYnV0ZSggJ2RhdGEtY2FuLWNyZWF0ZScgKVxuXHRcdFx0XHRcdCYmIHRpdGxlX2ZpZWxkXG5cdFx0XHRcdFx0JiYgJycgIT09IFN0cmluZyggdGl0bGVfZmllbGQudmFsdWUgfHwgJycgKS50cmltKClcblx0XHRcdFx0XHQmJiAoICdjaGlsZHJlbicgIT09IGdldF9pbnNwZWN0b3JfY3JlYXRpb25fbW9kZSgpIHx8ICggcGFyZW50X2ZpZWxkICYmIE51bWJlciggcGFyZW50X2ZpZWxkLnZhbHVlICkgPiAwICkgKSApO1xuXG5cdFx0XHRzYXZlX2J1dHRvbi5kaXNhYmxlZCA9IHNhdmVfaXNfYnVzeSB8fCAhIGZvcm0gfHwgISBpbnNwZWN0b3JfZGlydHkgfHwgISBjcmVhdGVfaXNfdmFsaWQ7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIENvbmZpcm0gd2hldGhlciB0aGUgYWN0aXZlIGluc3BlY3RvciBtYXkgYmUgcmVwbGFjZWQgb3IgY2xvc2VkLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnIENhdGFsb2cgY29uZmlndXJhdGlvbi5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIG5hdmlnYXRpb24gbWF5IGNvbnRpbnVlLlxuXHQgKi9cblx0ZnVuY3Rpb24gY2FuX2Rpc2NhcmRfaW5zcGVjdG9yKCBjb25maWcgKSB7XG5cdFx0aWYgKCBpbnNwZWN0b3JfbXV0YXRpb25faW5fcHJvZ3Jlc3MgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuICEgaW5zcGVjdG9yX2RpcnR5IHx8IHdpbmRvdy5jb25maXJtKCBjb25maWcuaTE4bi5pbnNwZWN0b3JfZGlzY2FyZCB8fCAnJyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIENsb3NlIHRoZSBpbnNwZWN0b3Igd2l0aG91dCBjaGFuZ2luZyBjYXRhbG9nIGNoZWNrYm94IHNlbGVjdGlvbi5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9ICBjb25maWcgICAgICAgICBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gY29uZmlybV9kaXNjYXJkIFdoZXRoZXIgZGlydHkgc3RhdGUgbmVlZHMgY29uZmlybWF0aW9uLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gY2xvc2VkLlxuXHQgKi9cblx0ZnVuY3Rpb24gY2xvc2VfaW5zcGVjdG9yKCBjb25maWcsIGNvbmZpcm1fZGlzY2FyZCApIHtcblx0XHRpZiAoIGNvbmZpcm1fZGlzY2FyZCAmJiAhIGNhbl9kaXNjYXJkX2luc3BlY3RvciggY29uZmlnICkgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aW5zcGVjdG9yX3JlcXVlc3Rfc2VxdWVuY2UgKz0gMTtcblx0XHRpbnNwZWN0b3JfZGlydHkgPSBmYWxzZTtcblx0XHRpbnNwZWN0b3JfbW9kZSA9ICcnO1xuXHRcdGluc3BlY3Rvcl9vcmlnaW5hbF9maWVsZHMgPSAnJztcblx0XHRpbnNwZWN0b3JfcmVzb3VyY2VfaWQgPSAwO1xuXHRcdGluc3BlY3Rvcl9yZXNvdXJjZV9pZHMgPSBbXTtcblx0XHRpbnNwZWN0b3JfYnVsa19vcGVyYXRpb25zID0ge307XG5cdFx0aW5zcGVjdG9yX3Jldmlld190b2tlbiA9ICcnO1xuXHRcdGluc3BlY3Rvcl9zZWxlY3Rpb25fc3RhbGUgPSBmYWxzZTtcblx0XHRpbnNwZWN0b3JfdHJhY2tzX3NlbGVjdGlvbiA9IGZhbHNlO1xuXHRcdGluc3BlY3Rvcl9jYXBhY2l0eV9jb250ZXh0ID0gbnVsbDtcblx0XHRpbnNwZWN0b3JfY2FwYWNpdHlfZGV0YWNoX2lkcyA9IFtdO1xuXHRcdGluc3BlY3Rvcl9jYXBhY2l0eV9kZWNyZWFzZV9hY3Rpb24gPSAnZGV0YWNoJztcblx0XHRpbnNwZWN0b3JfY2FwYWNpdHlfdGFyZ2V0ID0gMDtcblx0XHRzeW5jaHJvbml6ZV9pbnNwZWN0b3Jfd2lkdGgoKTtcblx0XHRzZXRfaW5zcGVjdG9yX3N0YXRlKCAnZW1wdHknLCAnJyApO1xuXHRcdG1hcmtfaW5zcGVjdG9yX3Jlc291cmNlX3JvdyggMCApO1xuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX2FkbWluX3VpX19zaWRlYmFyX3JpZ2h0X19kb19oaWRlICkge1xuXHRcdFx0d2luZG93LndwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX2RvX2hpZGUoKTtcblx0XHR9XG5cdFx0ZG9jdW1lbnQuZGlzcGF0Y2hFdmVudCggbmV3IEN1c3RvbUV2ZW50KCAnd3BiY19zZXR1cF93aXphcmRfbGF5b3V0X2NoYW5nZWQnICkgKTtcblx0XHRpZiAoIGluc3BlY3Rvcl9mb2N1c190YXJnZXQgJiYgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNvbnRhaW5zKCBpbnNwZWN0b3JfZm9jdXNfdGFyZ2V0ICkgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGluc3BlY3Rvcl9mb2N1c190YXJnZXQuZm9jdXMgKSB7XG5cdFx0XHRpbnNwZWN0b3JfZm9jdXNfdGFyZ2V0LmZvY3VzKCk7XG5cdFx0fVxuXHRcdGluc3BlY3Rvcl9mb2N1c190YXJnZXQgPSBudWxsO1xuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHQvKipcblx0ICogUG9zdCBvbmUgYXV0aGVudGljYXRlZCBpbnNwZWN0b3IgcmVxdWVzdC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBhY3Rpb24gQUpBWCBhY3Rpb24uXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSB2YWx1ZXMgUmVxdWVzdCB2YWx1ZXMuXG5cdCAqIEByZXR1cm4ge1Byb21pc2U8T2JqZWN0Pn0gUGFyc2VkIFdvcmRQcmVzcyByZXNwb25zZS5cblx0ICovXG5cdGZ1bmN0aW9uIHJlcXVlc3RfaW5zcGVjdG9yKCBjb25maWcsIGFjdGlvbiwgdmFsdWVzICkge1xuXHRcdHZhciBib2R5ID0gbmV3IHdpbmRvdy5VUkxTZWFyY2hQYXJhbXMoKTtcblxuXHRcdGJvZHkuYXBwZW5kKCAnYWN0aW9uJywgYWN0aW9uICk7XG5cdFx0Ym9keS5hcHBlbmQoICdub25jZScsIGNvbmZpZy5ub25jZSB8fCAnJyApO1xuXHRcdE9iamVjdC5rZXlzKCB2YWx1ZXMgfHwge30gKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGtleSApIHtcblx0XHRcdGJvZHkuYXBwZW5kKCBrZXksIFN0cmluZyggdmFsdWVzWyBrZXkgXSApICk7XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIHdpbmRvdy5mZXRjaCggY29uZmlnLmFqYXhfdXJsLCB7XG5cdFx0XHRib2R5OiBib2R5LnRvU3RyaW5nKCksXG5cdFx0XHRjcmVkZW50aWFsczogJ3NhbWUtb3JpZ2luJyxcblx0XHRcdGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQ7IGNoYXJzZXQ9VVRGLTgnIH0sXG5cdFx0XHRtZXRob2Q6ICdQT1NUJ1xuXHRcdH0gKS50aGVuKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0cmV0dXJuIHJlc3BvbnNlLmpzb24oKTtcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIHRoZSBleHBsaWNpdCBzZWxlY3Rpb24gb3duZWQgYnkgdGhlIHNoYXJlZCBjYXRhbG9nIGNvbnRyb2xsZXIuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgQ2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcmV0dXJuIHtBcnJheTxudW1iZXI+fSBTZWxlY3RlZCBwb3NpdGl2ZSBSZXNvdXJjZSBJRHMuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfc2VsZWN0ZWRfcmVzb3VyY2VfaWRzKCBjb25maWcgKSB7XG5cdFx0dmFyIG1vdW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIGNvbmZpZy5tb3VudF9pZCApO1xuXHRcdHZhciBzZWxlY3Rpb24gPSBtb3VudCAmJiBtb3VudC5fd3BiY191aV9jYXRhbG9nX3NlbGVjdGlvbl9jb250cm9sbGVyO1xuXHRcdHZhciBzZWxlY3RlZF9pZHMgPSBzZWxlY3Rpb24gJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHNlbGVjdGlvbi5nZXRfc2VsZWN0ZWRfaWRzID8gc2VsZWN0aW9uLmdldF9zZWxlY3RlZF9pZHMoKSA6IFtdO1xuXG5cdFx0cmV0dXJuIHNlbGVjdGVkX2lkcy5tYXAoIE51bWJlciApLmZpbHRlciggZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcblx0XHRcdHJldHVybiByZXNvdXJjZV9pZCA+IDA7XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbXBhcmUgdHdvIFJlc291cmNlLUlEIHNlbGVjdGlvbnMgd2l0aG91dCByZWx5aW5nIG9uIGV2ZW50IG9yZGVyaW5nLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0FycmF5PG51bWJlcnxzdHJpbmc+fSBmaXJzdF9pZHMgIEZpcnN0IElEIGxpc3QuXG5cdCAqIEBwYXJhbSB7QXJyYXk8bnVtYmVyfHN0cmluZz59IHNlY29uZF9pZHMgU2Vjb25kIElEIGxpc3QuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBib3RoIGxpc3RzIGNvbnRhaW4gdGhlIHNhbWUgUmVzb3VyY2UgSURzLlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVzb3VyY2VfaWRfbGlzdHNfbWF0Y2goIGZpcnN0X2lkcywgc2Vjb25kX2lkcyApIHtcblx0XHR2YXIgbm9ybWFsaXplX2lkcyA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWRzICkge1xuXHRcdFx0cmV0dXJuICggcmVzb3VyY2VfaWRzIHx8IFtdICkubWFwKCBOdW1iZXIgKS5maWx0ZXIoIGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdHJldHVybiByZXNvdXJjZV9pZCA+IDA7XG5cdFx0XHR9ICkuc29ydCggZnVuY3Rpb24gKCBmaXJzdF9pZCwgc2Vjb25kX2lkICkge1xuXHRcdFx0XHRyZXR1cm4gZmlyc3RfaWQgLSBzZWNvbmRfaWQ7XG5cdFx0XHR9ICk7XG5cdFx0fTtcblxuXHRcdHJldHVybiBKU09OLnN0cmluZ2lmeSggbm9ybWFsaXplX2lkcyggZmlyc3RfaWRzICkgKSA9PT0gSlNPTi5zdHJpbmdpZnkoIG5vcm1hbGl6ZV9pZHMoIHNlY29uZF9pZHMgKSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiBhIGxvY2FsaXplZCBzZWxlY3Rpb24tY291bnQgbGFiZWwuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgQ2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gY291bnQgIE51bWJlciBvZiBzZWxlY3RlZCBSZXNvdXJjZXMuXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gQ291bnQgYW5kIGxvY2FsaXplZCBub3VuLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X3NlbGVjdGlvbl9jb3VudF9sYWJlbCggY29uZmlnLCBjb3VudCApIHtcblx0XHRyZXR1cm4gU3RyaW5nKCBjb3VudCApICsgJyAnICsgKCAxID09PSBOdW1iZXIoIGNvdW50ICkgPyBjb25maWcuaTE4bi5yZXNvdXJjZV9zZWxlY3RlZCB8fCAnJyA6IGNvbmZpZy5pMThuLnJlc291cmNlc19zZWxlY3RlZCB8fCAnJyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbmZpZ3VyZSB0aGUgbmF0aXZlIHN0aWNreSBmb290ZXIgZm9yIHRoZSBhY3RpdmUgaW5zcGVjdG9yIHdvcmtmbG93LlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gZm9ybV9pZCAgICAgIEZvcm0gcmVjZWl2aW5nIHRoZSBzdWJtaXQgYWN0aW9uLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gYnV0dG9uX2xhYmVsIExvY2FsaXplZCBwcmltYXJ5IGxhYmVsLlxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IGRlc3RydWN0aXZlIFdoZXRoZXIgdGhlIGFjdGlvbiBwZXJtYW5lbnRseSBkZWxldGVzIGRhdGEuXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gZGlzYWJsZWQgICAgV2hldGhlciBzdWJtaXNzaW9uIHN0YXJ0cyBkaXNhYmxlZC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGNvbmZpZ3VyZV9pbnNwZWN0b3JfZm9vdGVyKCBmb3JtX2lkLCBidXR0b25fbGFiZWwsIGRlc3RydWN0aXZlLCBkaXNhYmxlZCApIHtcblx0XHR2YXIgZm9vdGVyID0gZ2V0X2luc3BlY3Rvcl9mb290ZXIoKTtcblx0XHR2YXIgc2F2ZV9idXR0b24gPSBmb290ZXIgPyBmb290ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbnNwZWN0b3Itc2F2ZV0nICkgOiBudWxsO1xuXHRcdHZhciBjYW5jZWxfYnV0dG9uID0gZm9vdGVyID8gZm9vdGVyLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5zcGVjdG9yLWNhbmNlbF0nICkgOiBudWxsO1xuXHRcdHZhciBkZWxldGVfd29ya2Zsb3c7XG5cblx0XHRpZiAoIHNhdmVfYnV0dG9uICkge1xuXHRcdFx0c2F2ZV9idXR0b24uY2xhc3NMaXN0LnJlbW92ZSggJ2lzLWJ1c3knLCAnYnV0dG9uLWxpbmstZGVsZXRlJywgJ3dwYmNfY2F0YWxvZ19ib29raW5nX3Jlc291cmNlc19fZGVsZXRlX3N1Ym1pdCcsICd3cGJjX3VpX2xpc3RpbmdfX2luc3BlY3Rvcl9hY3Rpb24tLWRlc3RydWN0aXZlJywgJ3dwYmNfYm9va2luZ19yZXNvdXJjZXNfX2RlbGV0ZV9jb25maXJtX2J1dHRvbicsICd3cGJjX3VpX2NhdGFsb2dfZGVsZXRlX3Jldmlld19fYXBwbHknICk7XG5cdFx0XHRzYXZlX2J1dHRvbi5jbGFzc0xpc3QudG9nZ2xlKCAnYnV0dG9uLXByaW1hcnknLCAhIGRlc3RydWN0aXZlICk7XG5cdFx0XHRzYXZlX2J1dHRvbi5jbGFzc0xpc3QudG9nZ2xlKCAnYnV0dG9uLXNlY29uZGFyeScsICEhIGRlc3RydWN0aXZlICk7XG5cdFx0XHRzYXZlX2J1dHRvbi5jbGFzc0xpc3QudG9nZ2xlKCAnd3BiY191aV9saXN0aW5nX19pbnNwZWN0b3JfYWN0aW9uLS1kZXN0cnVjdGl2ZScsICEhIGRlc3RydWN0aXZlICk7XG5cdFx0XHRzYXZlX2J1dHRvbi5jbGFzc0xpc3QudG9nZ2xlKCAnd3BiY19ib29raW5nX3Jlc291cmNlc19fZGVsZXRlX2NvbmZpcm1fYnV0dG9uJywgISEgZGVzdHJ1Y3RpdmUgKTtcblx0XHRcdHNhdmVfYnV0dG9uLnRleHRDb250ZW50ID0gYnV0dG9uX2xhYmVsIHx8ICcnO1xuXHRcdFx0c2F2ZV9idXR0b24uc2V0QXR0cmlidXRlKCAnZm9ybScsIGZvcm1faWQgKTtcblx0XHRcdHNhdmVfYnV0dG9uLmRpc2FibGVkID0gISEgZGlzYWJsZWQ7XG5cdFx0fVxuXHRcdGlmICggY2FuY2VsX2J1dHRvbiApIHtcblx0XHRcdGNhbmNlbF9idXR0b24udGV4dENvbnRlbnQgPSB3aW5kb3cud3BiY19jYXRhbG9nX2Jvb2tpbmdfcmVzb3VyY2VzX2NvbmZpZyAmJiB3aW5kb3cud3BiY19jYXRhbG9nX2Jvb2tpbmdfcmVzb3VyY2VzX2NvbmZpZy5pMThuXG5cdFx0XHRcdD8gd2luZG93LndwYmNfY2F0YWxvZ19ib29raW5nX3Jlc291cmNlc19jb25maWcuaTE4bi5jYW5jZWwgfHwgY2FuY2VsX2J1dHRvbi50ZXh0Q29udGVudFxuXHRcdFx0XHQ6IGNhbmNlbF9idXR0b24udGV4dENvbnRlbnQ7XG5cdFx0XHRjYW5jZWxfYnV0dG9uLmRpc2FibGVkID0gZmFsc2U7XG5cdFx0fVxuXHRcdGlmICggZGVzdHJ1Y3RpdmUgJiYgJ3dwYmNfY2F0YWxvZ19ib29raW5nX3Jlc291cmNlc19kZWxldGVfZm9ybScgPT09IGZvcm1faWQgKSB7XG5cdFx0XHRkZWxldGVfd29ya2Zsb3cgPSBnZXRfZGVsZXRlX3Jldmlld193b3JrZmxvdygpO1xuXHRcdFx0aWYgKCBkZWxldGVfd29ya2Zsb3cgKSB7XG5cdFx0XHRcdGRlbGV0ZV93b3JrZmxvdy5jb25maWd1cmVfZm9vdGVyKCB7XG5cdFx0XHRcdFx0Y2FuX2FwcGx5OiB0cnVlLFxuXHRcdFx0XHRcdGZvb3RlcjogZm9vdGVyLFxuXHRcdFx0XHRcdGZvcm1faWQ6IGZvcm1faWQsXG5cdFx0XHRcdFx0bGFiZWw6IGJ1dHRvbl9sYWJlbFxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEVtcGhhc2l6ZSB0aGUgcGVybWFuZW50LWRlbGV0aW9uIGFja25vd2xlZGdlbWVudC5cblx0ICpcblx0ICogUmVzdGFydGluZyB0aGUgZmluaXRlIGFuaW1hdGlvbiBtaXJyb3JzIHRoZSBlc3RhYmxpc2hlZCBCb29raW5nIFJlc291cmNlXG5cdCAqIGVkaXRvciBiZWhhdmlvciB3aGVuIGEgZGVsZXRpb24gcmV2aWV3IG9wZW5zIG9yIGFja25vd2xlZGdlbWVudCBpcyBjbGVhcmVkLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fG51bGx9IGFja25vd2xlZGdlbWVudCBEZWxldGlvbiBhY2tub3dsZWRnZW1lbnQgbGFiZWwuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBwdWxzZV9kZWxldGVfYWNrbm93bGVkZ2VtZW50KCBhY2tub3dsZWRnZW1lbnQgKSB7XG5cdFx0dmFyIGRlbGV0ZV93b3JrZmxvdyA9IGdldF9kZWxldGVfcmV2aWV3X3dvcmtmbG93KCk7XG5cblx0XHRpZiAoIGFja25vd2xlZGdlbWVudCAmJiBhY2tub3dsZWRnZW1lbnQubWF0Y2hlcyggJy53cGJjX3VpX2NhdGFsb2dfZGVsZXRlX3Jldmlld19fYWNrbm93bGVkZ2VtZW50JyApICYmIGRlbGV0ZV93b3JrZmxvdyApIHtcblx0XHRcdGRlbGV0ZV93b3JrZmxvdy5wdWxzZV9hY2tub3dsZWRnZW1lbnQoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCAhIGFja25vd2xlZGdlbWVudCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRhY2tub3dsZWRnZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSggJ3dwYmNfYm9va2luZ19yZXNvdXJjZXNfX2RlbGV0ZV9hY2tub3dsZWRnZW1lbnQtLWF0dGVudGlvbicgKTtcblx0XHR2b2lkIGFja25vd2xlZGdlbWVudC5vZmZzZXRXaWR0aDtcblx0XHRhY2tub3dsZWRnZW1lbnQuY2xhc3NMaXN0LmFkZCggJ3dwYmNfYm9va2luZ19yZXNvdXJjZXNfX2RlbGV0ZV9hY2tub3dsZWRnZW1lbnQtLWF0dGVudGlvbicgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gYSBzYWZlIG1lc3NhZ2UgZnJvbSBhIFdvcmRQcmVzcyBpbnNwZWN0b3IgcmVzcG9uc2UuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSByZXNwb25zZSBSZXNwb25zZSBwYXlsb2FkLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gZmFsbGJhY2sgRmFsbGJhY2sgbWVzc2FnZS5cblx0ICogQHJldHVybiB7c3RyaW5nfSBQbGFpbiBtZXNzYWdlLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X2luc3BlY3Rvcl9yZXNwb25zZV9tZXNzYWdlKCByZXNwb25zZSwgZmFsbGJhY2sgKSB7XG5cdFx0cmV0dXJuIHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5tZXNzYWdlID8gU3RyaW5nKCByZXNwb25zZS5kYXRhLm1lc3NhZ2UgKSA6IFN0cmluZyggZmFsbGJhY2sgfHwgJycgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTaG93IGEgc3VjY2VzcyBvciBlcnJvciBub3RpY2UgaW4gdGhlIGFjdGl2ZSBpbnNwZWN0b3IuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEZvcm1FbGVtZW50fSBmb3JtICAgICBJbnNwZWN0b3IgZm9ybS5cblx0ICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgIG1lc3NhZ2UgIFNhZmUgc2VydmVyIG9yIGxvY2FsaXplZCBtZXNzYWdlLlxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59ICAgICAgICAgaXNfZXJyb3IgV2hldGhlciB0aGUgbm90aWNlIHJlcHJlc2VudHMgYW4gZXJyb3IuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzaG93X2luc3BlY3Rvcl9tZXNzYWdlKCBmb3JtLCBtZXNzYWdlLCBpc19lcnJvciApIHtcblx0XHR2YXIgbm90aWNlID0gZm9ybSA/IGZvcm0ucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1pbnNwZWN0b3ItbWVzc2FnZV0nICkgOiBudWxsO1xuXG5cdFx0aWYgKCAhIG5vdGljZSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0bm90aWNlLmNsYXNzTGlzdC50b2dnbGUoICdub3RpY2UtZXJyb3InLCAhISBpc19lcnJvciApO1xuXHRcdG5vdGljZS5jbGFzc0xpc3QudG9nZ2xlKCAnbm90aWNlLXN1Y2Nlc3MnLCAhIGlzX2Vycm9yICk7XG5cdFx0bm90aWNlLmhpZGRlbiA9ICEgbWVzc2FnZTtcblx0XHR2YXIgbm90aWNlX3RleHQgPSBub3RpY2UucXVlcnlTZWxlY3RvciggJ3AnICk7XG5cdFx0aWYgKCBub3RpY2VfdGV4dCApIHtcblx0XHRcdG5vdGljZV90ZXh0LnRleHRDb250ZW50ID0gbWVzc2FnZSB8fCAnJztcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogTW92ZSBrZXlib2FyZCBmb2N1cyB0byB0aGUgaGVhZGluZyBvZiBhIG5ld2x5IHJlbmRlcmVkIHJldmlld2VkIGluc3BlY3Rvci5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRm9ybUVsZW1lbnR8bnVsbH0gZm9ybSBSZW5kZXJlZCBpbnNwZWN0b3IgZm9ybS5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGZvY3VzX2luc3BlY3Rvcl9oZWFkaW5nKCBmb3JtICkge1xuXHRcdHZhciBoZWFkaW5nID0gZm9ybSA/IGZvcm0ucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1pbnNwZWN0b3ItaGVhZGluZ10nICkgOiBudWxsO1xuXG5cdFx0aWYgKCAhIGhlYWRpbmcgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRpZiAoIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jb250YWlucyggaGVhZGluZyApICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBoZWFkaW5nLmZvY3VzICkge1xuXHRcdFx0XHRoZWFkaW5nLmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fSwgMCApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFNob3cgYSBzdGFuZGFyZCBCb29raW5nIENhbGVuZGFyIGFkbWluaXN0cmF0aW9uIG5vdGljZS5cblx0ICpcblx0ICogU3VjY2Vzc2Z1bCBtdXRhdGlvbnMgdXNlIHRoZSBzaGFyZWQgdG9wLXJpZ2h0IG5vdGljZSBhcmVhIHVzZWQgYnkgdGhlXG5cdCAqIEJvb2tpbmcgQ2FsZW5kYXIgc2V0dGluZ3MgcGFnZXMuIFRoZSBib29sZWFuIHJldHVybiBsZXRzIGNhbGxlcnMgcmV0YWluXG5cdCAqIGFuIGlubGluZSBmYWxsYmFjayB3aGVuIHRoYXQgc2hhcmVkIGhlbHBlciBpcyB1bmF2YWlsYWJsZS5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgICAgICBTYWZlIHNlcnZlciBvciBsb2NhbGl6ZWQgbWVzc2FnZS5cblx0ICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2VfdHlwZSBOb3RpY2UgdHlwZSBhY2NlcHRlZCBieSB0aGUgc2hhcmVkIGhlbHBlci5cblx0ICogQHBhcmFtIHtudW1iZXJ9IGRlbGF5ICAgICAgICBOb3RpY2UgdmlzaWJpbGl0eSBkdXJhdGlvbiBpbiBtaWxsaXNlY29uZHMuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgbWVzc2FnZSB3YXMgZGlzcGxheWVkLlxuXHQgKi9cblx0ZnVuY3Rpb24gc2hvd19hZG1pbl9tZXNzYWdlKCBtZXNzYWdlLCBtZXNzYWdlX3R5cGUsIGRlbGF5ICkge1xuXHRcdHZhciBjb25maWc7XG5cdFx0dmFyIG1vdW50X2VsZW1lbnQ7XG5cdFx0dmFyIG5vdGljZTtcblx0XHR2YXIgbm90aWNlX3RleHQ7XG5cblx0XHRpZiAoICEgbWVzc2FnZSApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlICkge1xuXHRcdFx0d2luZG93LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCBtZXNzYWdlLCBtZXNzYWdlX3R5cGUgfHwgJ2luZm8nLCBkZWxheSB8fCA0MDAwLCBmYWxzZSApO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0Y29uZmlnID0gd2luZG93LndwYmNfY2F0YWxvZ19ib29raW5nX3Jlc291cmNlc19jb25maWcgfHwge307XG5cdFx0bW91bnRfZWxlbWVudCA9IGNvbmZpZy5tb3VudF9pZCA/IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBjb25maWcubW91bnRfaWQgKSA6IG51bGw7XG5cdFx0bW91bnRfZWxlbWVudCA9IG1vdW50X2VsZW1lbnQgJiYgbW91bnRfZWxlbWVudC5wYXJlbnROb2RlID8gbW91bnRfZWxlbWVudC5wYXJlbnROb2RlIDogZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJvZHktY29udGVudCcgKSB8fCBkb2N1bWVudC5ib2R5O1xuXHRcdGlmICggISBtb3VudF9lbGVtZW50ICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdG5vdGljZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdFx0bm90aWNlLmNsYXNzTmFtZSA9ICdub3RpY2Ugbm90aWNlLScgKyAoICdlcnJvcicgPT09IG1lc3NhZ2VfdHlwZSA/ICdlcnJvcicgOiAnc3VjY2VzcycgKSArICcgd3BiY19jYXRhbG9nX2Jvb2tpbmdfcmVzb3VyY2VzX19tdXRhdGlvbl9ub3RpY2UnO1xuXHRcdG5vdGljZS5zZXRBdHRyaWJ1dGUoICdyb2xlJywgJ2Vycm9yJyA9PT0gbWVzc2FnZV90eXBlID8gJ2FsZXJ0JyA6ICdzdGF0dXMnICk7XG5cdFx0bm90aWNlLnNldEF0dHJpYnV0ZSggJ2FyaWEtbGl2ZScsICdlcnJvcicgPT09IG1lc3NhZ2VfdHlwZSA/ICdhc3NlcnRpdmUnIDogJ3BvbGl0ZScgKTtcblx0XHRub3RpY2VfdGV4dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdwJyApO1xuXHRcdG5vdGljZV90ZXh0LnRleHRDb250ZW50ID0gbWVzc2FnZTtcblx0XHRub3RpY2UuYXBwZW5kQ2hpbGQoIG5vdGljZV90ZXh0ICk7XG5cdFx0bW91bnRfZWxlbWVudC5pbnNlcnRCZWZvcmUoIG5vdGljZSwgbW91bnRfZWxlbWVudC5maXJzdENoaWxkICk7XG5cdFx0d2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdGlmICggbm90aWNlLnBhcmVudE5vZGUgKSB7XG5cdFx0XHRcdG5vdGljZS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKCBub3RpY2UgKTtcblx0XHRcdH1cblx0XHR9LCBkZWxheSB8fCA0MDAwICk7XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBPcGVuIGFuZCBmb2N1cyBvbmUgc2VydmVyLWRlZmluZWQgZWRpdC1pbnNwZWN0b3Igc2VjdGlvbi5cblx0ICpcblx0ICogVGhlIHNoYXJlZCBjb2xsYXBzaWJsZSBjb250cm9sbGVyIGtlZXBzIGV4Y2x1c2l2ZSBncm91cCBzdGF0ZSBhbmQgQVJJQVxuXHQgKiBhdHRyaWJ1dGVzIHN5bmNocm9uaXplZC4gVGhlIGhlYWRlciBjbGljayBpcyByZXRhaW5lZCBhcyBhIGNvbXBhdGliaWxpdHlcblx0ICogZmFsbGJhY2sgZm9yIG9sZGVyIGFkbWluaXN0cmF0aW9uIGJ1bmRsZXMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBzZWN0aW9uX2lkIEluc3BlY3RvciBzZWN0aW9uIGlkZW50aWZpZXIuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgcmVxdWVzdGVkIHNlY3Rpb24gZXhpc3RzLlxuXHQgKi9cblx0ZnVuY3Rpb24gYWN0aXZhdGVfaW5zcGVjdG9yX3NlY3Rpb24oIHNlY3Rpb25faWQgKSB7XG5cdFx0dmFyIGZvcm07XG5cdFx0dmFyIGdyb3VwO1xuXHRcdHZhciByb290O1xuXHRcdHZhciBjb250cm9sbGVyO1xuXHRcdHZhciBoZWFkZXI7XG5cblx0XHRzZWN0aW9uX2lkID0gU3RyaW5nKCBzZWN0aW9uX2lkIHx8ICcnICk7XG5cdFx0aWYgKCAhIC9eW2EtejAtOV9dKyQvLnRlc3QoIHNlY3Rpb25faWQgKSApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRmb3JtID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1pbnNwZWN0b3ItZm9ybV1bZGF0YS1tb2RlPVwiZWRpdFwiXScgKTtcblx0XHRncm91cCA9IGZvcm0gPyBmb3JtLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS1ncm91cD1cImNhdGFsb2ctYm9va2luZy1yZXNvdXJjZS0nICsgc2VjdGlvbl9pZCArICdcIl0nICkgOiBudWxsO1xuXHRcdGhlYWRlciA9IGdyb3VwID8gZ3JvdXAucXVlcnlTZWxlY3RvciggJy5ncm91cF9faGVhZGVyJyApIDogbnVsbDtcblx0XHRpZiAoICEgZ3JvdXAgfHwgISBoZWFkZXIgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cm9vdCA9IGdyb3VwLmNsb3Nlc3QoICcud3BiY19jb2xsYXBzaWJsZScgKTtcblx0XHRjb250cm9sbGVyID0gcm9vdCAmJiByb290Ll9fd3BiY19jb2xsYXBzaWJsZV9pbnN0YW5jZSA/IHJvb3QuX193cGJjX2NvbGxhcHNpYmxlX2luc3RhbmNlIDogbnVsbDtcblx0XHRpZiAoIGNvbnRyb2xsZXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNvbnRyb2xsZXIuZXhwYW5kICkge1xuXHRcdFx0Y29udHJvbGxlci5leHBhbmQoIGdyb3VwICk7XG5cdFx0fSBlbHNlIGlmICggISBncm91cC5jbGFzc0xpc3QuY29udGFpbnMoICdpcy1vcGVuJyApICkge1xuXHRcdFx0aGVhZGVyLmNsaWNrKCk7XG5cdFx0fVxuXG5cdFx0d2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdGdyb3VwLnNjcm9sbEludG9WaWV3KCB7IGJlaGF2aW9yOiAnc21vb3RoJywgYmxvY2s6ICdzdGFydCcgfSApO1xuXHRcdFx0aGVhZGVyLmZvY3VzKCk7XG5cdFx0fSwgMTIwICk7XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZW5kZXIgb25lIHNlcnZlci1hdXRob3JpdGF0aXZlIGNyZWF0ZSBvciBlZGl0IHNjaGVtYS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBzY2hlbWEgSW5zcGVjdG9yIHNjaGVtYS5cblx0ICogQHBhcmFtIHtib29sZWFufSBmb2N1c190aXRsZSBXaGV0aGVyIHRoZSB0aXRsZSBjb250cm9sIHJlY2VpdmVzIGZvY3VzLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gcmVuZGVyZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiByZW5kZXJfaW5zcGVjdG9yX3NjaGVtYSggY29uZmlnLCBzY2hlbWEsIGZvY3VzX3RpdGxlICkge1xuXHRcdHZhciBob3N0ID0gZ2V0X2luc3BlY3Rvcl9ob3N0KCk7XG5cdFx0dmFyIGZvcm1fdGFyZ2V0ID0gaG9zdCA/IGhvc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbnNwZWN0b3ItZm9ybV0nICkgOiBudWxsO1xuXHRcdHZhciBmb290ZXIgPSBnZXRfaW5zcGVjdG9yX2Zvb3RlcigpO1xuXHRcdHZhciBzYXZlX2J1dHRvbiA9IGZvb3RlciA/IGZvb3Rlci5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1zYXZlXScgKSA6IG51bGw7XG5cdFx0dmFyIHRlbXBsYXRlX3JvbGUgPSAnY3JlYXRlJyA9PT0gc2NoZW1hLm1vZGUgPyAnaW5zcGVjdG9yX2NyZWF0ZScgOiAnaW5zcGVjdG9yX2VkaXQnO1xuXG5cdFx0aWYgKCAhIGZvcm1fdGFyZ2V0ICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRmb3JtX3RhcmdldC5pbm5lckhUTUwgPSByZW5kZXJfY29tcG9uZW50KCBjb25maWcsIHRlbXBsYXRlX3JvbGUsIHsgaTE4bjogY29uZmlnLmkxOG4gfHwge30sIHNjaGVtYTogc2NoZW1hIH0gKTtcblx0XHR2YXIgZm9ybSA9IGZvcm1fdGFyZ2V0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtaW5zcGVjdG9yLWZvcm1dJyApO1xuXHRcdGlmICggISBmb3JtICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoICdjcmVhdGUnID09PSBzY2hlbWEubW9kZSApIHtcblx0XHRcdGZvcm0uc2V0QXR0cmlidXRlKCAnZGF0YS1jYW4tY3JlYXRlJywgc2NoZW1hLmNhbl9jcmVhdGUgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0fVxuXHRcdGluc3BlY3Rvcl9tb2RlID0gc2NoZW1hLm1vZGU7XG5cdFx0aW5zcGVjdG9yX3Jlc291cmNlX2lkID0gTnVtYmVyKCBzY2hlbWEucmVzb3VyY2VfaWQgKSB8fCAwO1xuXHRcdGlmICggaW5zcGVjdG9yX3Jlc291cmNlX2lkICkge1xuXHRcdFx0dmFyIHNob3J0Y29kZV9maWVsZCA9IGZvcm0ucXVlcnlTZWxlY3RvciggJy53cGJjX2NhdGFsb2dfYm9va2luZ19yZXNvdXJjZXNfX2VkaXRvcl9jb2RlJyApO1xuXHRcdFx0aWYgKCBzaG9ydGNvZGVfZmllbGQgKSB7XG5cdFx0XHRcdHN5bmNocm9uaXplX2Jvb2tpbmdfcmVzb3VyY2Vfc2hvcnRjb2RlX2lucHV0KCBpbnNwZWN0b3JfcmVzb3VyY2VfaWQsIHNob3J0Y29kZV9maWVsZC52YWx1ZSApO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRzZXRfaW5zcGVjdG9yX3N0YXRlKCAnZm9ybScsICcnICk7XG5cdFx0aWYgKCBzYXZlX2J1dHRvbiApIHtcblx0XHRcdGNvbmZpZ3VyZV9pbnNwZWN0b3JfZm9vdGVyKCAnd3BiY19jYXRhbG9nX2Jvb2tpbmdfcmVzb3VyY2VfaW5zcGVjdG9yX2Zvcm0nLCAnY3JlYXRlJyA9PT0gaW5zcGVjdG9yX21vZGUgPyBjb25maWcuaTE4bi5hZGRfcmVzb3VyY2UgfHwgJycgOiBjb25maWcuaTE4bi5zYXZlX2NoYW5nZXMgfHwgJycsIGZhbHNlLCB0cnVlICk7XG5cdFx0fVxuXHRcdHZhciBjYW5jZWxfYnV0dG9uID0gZm9vdGVyID8gZm9vdGVyLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5zcGVjdG9yLWNhbmNlbF0nICkgOiBudWxsO1xuXHRcdGlmICggY2FuY2VsX2J1dHRvbiApIHtcblx0XHRcdGNhbmNlbF9idXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LldQQkNfQ29sbGFwc2libGVfQXV0b0luaXQgKSB7XG5cdFx0XHR3aW5kb3cuV1BCQ19Db2xsYXBzaWJsZV9BdXRvSW5pdCgpO1xuXHRcdH1cblx0XHRzeW5jaHJvbml6ZV9hbGxfaW5zcGVjdG9yX251bWVyaWNfcmFuZ2VzKCk7XG5cdFx0c3luY2hyb25pemVfY3JlYXRlX2luc3BlY3Rvcl9jb250cm9scygpO1xuXHRcdGluc3BlY3Rvcl9vcmlnaW5hbF9maWVsZHMgPSBzZXJpYWxpemVfaW5zcGVjdG9yX2ZpZWxkcygpO1xuXHRcdGluc3BlY3Rvcl9kaXJ0eSA9IGZhbHNlO1xuXHRcdHN5bmNocm9uaXplX2luc3BlY3Rvcl9kaXJ0eV9zdGF0ZSgpO1xuXHRcdG1hcmtfaW5zcGVjdG9yX3Jlc291cmNlX3JvdyggaW5zcGVjdG9yX3Jlc291cmNlX2lkICk7XG5cdFx0aWYgKCBmYWxzZSAhPT0gZm9jdXNfdGl0bGUgKSB7XG5cdFx0XHR3aW5kb3cuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHR2YXIgdGl0bGVfZmllbGQgPSBmb3JtLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtZmllbGQ9XCJ0aXRsZVwiXScgKTtcblx0XHRcdFx0aWYgKCB0aXRsZV9maWVsZCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgdGl0bGVfZmllbGQuZm9jdXMgKSB7XG5cdFx0XHRcdFx0dGl0bGVfZmllbGQuZm9jdXMoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgMTIwICk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHQvKipcblx0ICogTG9hZCBhbmQgb3BlbiBvbmUgY3JlYXRlIG9yIGVkaXQgaW5zcGVjdG9yLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBjb25maWcgICAgICAgQ2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICBtb2RlICAgICAgICAgQ3JlYXRlIG9yIGVkaXQuXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSAgICAgIHJlc291cmNlX2lkICBSZXNvdXJjZSBJRCBmb3IgZWRpdC5cblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZm9jdXNfdGFyZ2V0IEluaXRpYXRpbmcgY29udHJvbC5cblx0ICogQHBhcmFtIHtzdHJpbmd9ICAgICAgc2VjdGlvbl9pZCAgIE9wdGlvbmFsIGVkaXQgc2VjdGlvbiB0byBvcGVuIGFuZCBmb2N1cy5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIG9wZW5faW5zcGVjdG9yKCBjb25maWcsIG1vZGUsIHJlc291cmNlX2lkLCBmb2N1c190YXJnZXQsIHNlY3Rpb25faWQgKSB7XG5cdFx0dmFyIHJlcXVlc3Rfc2VxdWVuY2U7XG5cdFx0dmFyIGFjdGlvbjtcblxuXHRcdHJlc291cmNlX2lkID0gTnVtYmVyKCByZXNvdXJjZV9pZCApIHx8IDA7XG5cdFx0aWYgKCAnZWRpdCcgPT09IG1vZGUgJiYgcmVzb3VyY2VfaWQgPT09IGluc3BlY3Rvcl9yZXNvdXJjZV9pZCAmJiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWluc3BlY3Rvci1mb3JtXVtkYXRhLW1vZGU9XCJlZGl0XCJdJyApICkge1xuXHRcdFx0ZXhwYW5kX2luc3BlY3Rvcl9zaWRlYmFyKCk7XG5cdFx0XHRtYXJrX2luc3BlY3Rvcl9yZXNvdXJjZV9yb3coIHJlc291cmNlX2lkICk7XG5cdFx0XHRpZiAoIHNlY3Rpb25faWQgKSB7XG5cdFx0XHRcdGFjdGl2YXRlX2luc3BlY3Rvcl9zZWN0aW9uKCBzZWN0aW9uX2lkICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICggISBjYW5fZGlzY2FyZF9pbnNwZWN0b3IoIGNvbmZpZyApIHx8ICEgbW91bnRfaW5zcGVjdG9yX3NoZWxsKCBjb25maWcgKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y2xvc2VfZGV0YWlsc19yb3coIGZhbHNlICk7XG5cdFx0aW5zcGVjdG9yX2ZvY3VzX3RhcmdldCA9IGZvY3VzX3RhcmdldCB8fCBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuXHRcdHJlcXVlc3Rfc2VxdWVuY2UgPSArK2luc3BlY3Rvcl9yZXF1ZXN0X3NlcXVlbmNlO1xuXHRcdGluc3BlY3Rvcl9kaXJ0eSA9IGZhbHNlO1xuXHRcdGluc3BlY3Rvcl9tb2RlID0gbW9kZTtcblx0XHRpbnNwZWN0b3JfcmVzb3VyY2VfaWQgPSByZXNvdXJjZV9pZDtcblx0XHRzeW5jaHJvbml6ZV9pbnNwZWN0b3Jfd2lkdGgoKTtcblx0XHRhY3Rpb24gPSAnY3JlYXRlJyA9PT0gbW9kZSA/IGNvbmZpZy5pbnNwZWN0b3JfY3JlYXRlX3NjaGVtYV9hY3Rpb24gOiBjb25maWcuaW5zcGVjdG9yX2VkaXRfc2NoZW1hX2FjdGlvbjtcblx0XHRzZXRfaW5zcGVjdG9yX3N0YXRlKCAnbG9hZGluZycsICcnICk7XG5cdFx0bWFya19pbnNwZWN0b3JfcmVzb3VyY2Vfcm93KCBpbnNwZWN0b3JfcmVzb3VyY2VfaWQgKTtcblx0XHRleHBhbmRfaW5zcGVjdG9yX3NpZGViYXIoKTtcblxuXHRcdHJlcXVlc3RfaW5zcGVjdG9yKCBjb25maWcsIGFjdGlvbiwgJ2VkaXQnID09PSBtb2RlID8geyByZXNvdXJjZV9pZDogaW5zcGVjdG9yX3Jlc291cmNlX2lkIH0gOiB7fSApLnRoZW4oIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRpZiAoIHJlcXVlc3Rfc2VxdWVuY2UgIT09IGluc3BlY3Rvcl9yZXF1ZXN0X3NlcXVlbmNlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgcmVzcG9uc2UgfHwgdHJ1ZSAhPT0gcmVzcG9uc2Uuc3VjY2VzcyB8fCAhIHJlc3BvbnNlLmRhdGEgfHwgISByZXNwb25zZS5kYXRhLnNjaGVtYSB8fCAhIHJlbmRlcl9pbnNwZWN0b3Jfc2NoZW1hKCBjb25maWcsIHJlc3BvbnNlLmRhdGEuc2NoZW1hLCAhIHNlY3Rpb25faWQgKSApIHtcblx0XHRcdFx0c2V0X2luc3BlY3Rvcl9zdGF0ZSggJ2Vycm9yJywgZ2V0X2luc3BlY3Rvcl9yZXNwb25zZV9tZXNzYWdlKCByZXNwb25zZSwgY29uZmlnLmkxOG4uaW5zcGVjdG9yX2xvYWRfZmFpbGVkICkgKTtcblx0XHRcdH0gZWxzZSBpZiAoIHNlY3Rpb25faWQgKSB7XG5cdFx0XHRcdGFjdGl2YXRlX2luc3BlY3Rvcl9zZWN0aW9uKCBzZWN0aW9uX2lkICk7XG5cdFx0XHR9XG5cdFx0fSApLmNhdGNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRpZiAoIHJlcXVlc3Rfc2VxdWVuY2UgPT09IGluc3BlY3Rvcl9yZXF1ZXN0X3NlcXVlbmNlICkge1xuXHRcdFx0XHRzZXRfaW5zcGVjdG9yX3N0YXRlKCAnZXJyb3InLCBjb25maWcuaTE4bi5pbnNwZWN0b3JfbG9hZF9mYWlsZWQgfHwgJycgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogUmVuZGVyIHRoZSBzZXJ2ZXItZ2VuZXJhdGVkIGNvbW1vbi1maWVsZCBidWxrIGVkaXRvci5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBzY2hlbWEgQXV0aG9yaXplZCBidWxrIHNjaGVtYS5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBmb3JtIHJlbmRlcmVkLlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVuZGVyX2J1bGtfZWRpdG9yKCBjb25maWcsIHNjaGVtYSApIHtcblx0XHR2YXIgaG9zdCA9IGdldF9pbnNwZWN0b3JfaG9zdCgpO1xuXHRcdHZhciB0YXJnZXQgPSBob3N0ID8gaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1mb3JtXScgKSA6IG51bGw7XG5cblx0XHRpZiAoICEgdGFyZ2V0ICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHR0YXJnZXQuaW5uZXJIVE1MID0gcmVuZGVyX2NvbXBvbmVudCggY29uZmlnLCAnaW5zcGVjdG9yX2J1bGtfZWRpdCcsIHsgaTE4bjogY29uZmlnLmkxOG4gfHwge30sIHNjaGVtYTogc2NoZW1hLCBzZWxlY3Rpb25fbGFiZWw6IGdldF9zZWxlY3Rpb25fY291bnRfbGFiZWwoIGNvbmZpZywgc2NoZW1hLnNlbGVjdGlvbl9jb3VudCApIH0gKTtcblx0XHRpZiAoICEgdGFyZ2V0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtYnVsay1mb3JtXScgKSApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aW5zcGVjdG9yX21vZGUgPSAnYnVsa19lZGl0Jztcblx0XHRpbnNwZWN0b3JfcmVzb3VyY2VfaWQgPSAwO1xuXHRcdGluc3BlY3Rvcl9yZXNvdXJjZV9pZHMgPSAoIHNjaGVtYS5yZXNvdXJjZV9pZHMgfHwgW10gKS5tYXAoIE51bWJlciApO1xuXHRcdGluc3BlY3Rvcl9idWxrX29wZXJhdGlvbnMgPSB7fTtcblx0XHRpbnNwZWN0b3JfcmV2aWV3X3Rva2VuID0gJyc7XG5cdFx0aW5zcGVjdG9yX3NlbGVjdGlvbl9zdGFsZSA9IGZhbHNlO1xuXHRcdGluc3BlY3Rvcl90cmFja3Nfc2VsZWN0aW9uID0gdHJ1ZTtcblx0XHRpbnNwZWN0b3JfZGlydHkgPSBmYWxzZTtcblx0XHRzZXRfaW5zcGVjdG9yX3N0YXRlKCAnZm9ybScsICcnICk7XG5cdFx0Y29uZmlndXJlX2luc3BlY3Rvcl9mb290ZXIoICd3cGJjX2NhdGFsb2dfYm9va2luZ19yZXNvdXJjZXNfYnVsa19mb3JtJywgY29uZmlnLmkxOG4ucmV2aWV3X2NoYW5nZXNfYnV0dG9uIHx8ICcnLCBmYWxzZSwgdHJ1ZSApO1xuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5XUEJDX0NvbGxhcHNpYmxlX0F1dG9Jbml0ICkge1xuXHRcdFx0d2luZG93LldQQkNfQ29sbGFwc2libGVfQXV0b0luaXQoKTtcblx0XHR9XG5cdFx0bWFya19pbnNwZWN0b3JfcmVzb3VyY2Vfcm93KCAwICk7XG5cdFx0Zm9jdXNfaW5zcGVjdG9yX2hlYWRpbmcoIHRhcmdldC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWJ1bGstZm9ybV0nICkgKTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0LyoqXG5cdCAqIE9wZW4gYSBidWxrIGVkaXRvciBmb3IgdGhlIGN1cnJlbnQgZXhwbGljaXQgc2VsZWN0aW9uLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBjb25maWcgICAgICAgQ2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBmb2N1c190YXJnZXQgSW5pdGlhdGluZyBjb250cm9sLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gb3Blbl9idWxrX2VkaXRvciggY29uZmlnLCBmb2N1c190YXJnZXQgKSB7XG5cdFx0dmFyIHJlc291cmNlX2lkcyA9IGdldF9zZWxlY3RlZF9yZXNvdXJjZV9pZHMoIGNvbmZpZyApO1xuXHRcdHZhciByZXF1ZXN0X3NlcXVlbmNlO1xuXG5cdFx0aWYgKCAhIHJlc291cmNlX2lkcy5sZW5ndGggfHwgISBjYW5fZGlzY2FyZF9pbnNwZWN0b3IoIGNvbmZpZyApIHx8ICEgbW91bnRfaW5zcGVjdG9yX3NoZWxsKCBjb25maWcgKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y2xvc2VfZGV0YWlsc19yb3coIGZhbHNlICk7XG5cdFx0aW5zcGVjdG9yX2ZvY3VzX3RhcmdldCA9IGZvY3VzX3RhcmdldCB8fCBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuXHRcdHJlcXVlc3Rfc2VxdWVuY2UgPSArK2luc3BlY3Rvcl9yZXF1ZXN0X3NlcXVlbmNlO1xuXHRcdGluc3BlY3Rvcl9tb2RlID0gJ2J1bGtfZWRpdCc7XG5cdFx0aW5zcGVjdG9yX3Jlc291cmNlX2lkcyA9IHJlc291cmNlX2lkcy5zbGljZSgpO1xuXHRcdGluc3BlY3Rvcl9kaXJ0eSA9IGZhbHNlO1xuXHRcdGluc3BlY3Rvcl90cmFja3Nfc2VsZWN0aW9uID0gdHJ1ZTtcblx0XHRzeW5jaHJvbml6ZV9pbnNwZWN0b3Jfd2lkdGgoKTtcblx0XHRzZXRfaW5zcGVjdG9yX3N0YXRlKCAnbG9hZGluZycsICcnICk7XG5cdFx0ZXhwYW5kX2luc3BlY3Rvcl9zaWRlYmFyKCk7XG5cblx0XHRyZXF1ZXN0X2luc3BlY3RvciggY29uZmlnLCBjb25maWcuYnVsa19zY2hlbWFfYWN0aW9uLCB7IHJlc291cmNlX2lkczogSlNPTi5zdHJpbmdpZnkoIHJlc291cmNlX2lkcyApIH0gKS50aGVuKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0aWYgKCByZXF1ZXN0X3NlcXVlbmNlICE9PSBpbnNwZWN0b3JfcmVxdWVzdF9zZXF1ZW5jZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHJlc3BvbnNlIHx8IHRydWUgIT09IHJlc3BvbnNlLnN1Y2Nlc3MgfHwgISByZXNwb25zZS5kYXRhIHx8ICEgcmVzcG9uc2UuZGF0YS5zY2hlbWEgfHwgISByZW5kZXJfYnVsa19lZGl0b3IoIGNvbmZpZywgcmVzcG9uc2UuZGF0YS5zY2hlbWEgKSApIHtcblx0XHRcdFx0c2V0X2luc3BlY3Rvcl9zdGF0ZSggJ2Vycm9yJywgZ2V0X2luc3BlY3Rvcl9yZXNwb25zZV9tZXNzYWdlKCByZXNwb25zZSwgY29uZmlnLmkxOG4uYnVsa19sb2FkX2ZhaWxlZCApICk7XG5cdFx0XHR9IGVsc2UgaWYgKCAhIHJlc291cmNlX2lkX2xpc3RzX21hdGNoKCBpbnNwZWN0b3JfcmVzb3VyY2VfaWRzLCBnZXRfc2VsZWN0ZWRfcmVzb3VyY2VfaWRzKCBjb25maWcgKSApICkge1xuXHRcdFx0XHRoYW5kbGVfaW5zcGVjdG9yX3NlbGVjdGlvbl9jaGFuZ2UoIG51bGwsIGNvbmZpZyApO1xuXHRcdFx0fVxuXHRcdH0gKS5jYXRjaCggZnVuY3Rpb24gKCkge1xuXHRcdFx0aWYgKCByZXF1ZXN0X3NlcXVlbmNlID09PSBpbnNwZWN0b3JfcmVxdWVzdF9zZXF1ZW5jZSApIHtcblx0XHRcdFx0c2V0X2luc3BlY3Rvcl9zdGF0ZSggJ2Vycm9yJywgY29uZmlnLmkxOG4uYnVsa19sb2FkX2ZhaWxlZCB8fCAnJyApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gb25seSBleHBsaWNpdGx5IGVuYWJsZWQgYnVsayBvcGVyYXRpb25zLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IE9wZXJhdGlvbiBlbnZlbG9wZSBrZXllZCBieSBmaWVsZC5cblx0ICovXG5cdGZ1bmN0aW9uIGNvbGxlY3RfYnVsa19vcGVyYXRpb25zKCkge1xuXHRcdHZhciBvcGVyYXRpb25zID0ge307XG5cblx0XHRkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWJ1bGstZW5hYmxlXTpjaGVja2VkJyApLmZvckVhY2goIGZ1bmN0aW9uICggZW5hYmxlZF9jb250cm9sICkge1xuXHRcdFx0dmFyIGZpZWxkX2tleSA9IGVuYWJsZWRfY29udHJvbC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1idWxrLWVuYWJsZScgKSB8fCAnJztcblx0XHRcdHZhciBvcGVyYXRpb24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWJ1bGstb3BlcmF0aW9uPVwiJyArIGZpZWxkX2tleSArICdcIl0nICk7XG5cdFx0XHR2YXIgZmllbGRfdmFsdWUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWJ1bGstdmFsdWU9XCInICsgZmllbGRfa2V5ICsgJ1wiXScgKTtcblxuXHRcdFx0aWYgKCBmaWVsZF9rZXkgJiYgb3BlcmF0aW9uICYmIGZpZWxkX3ZhbHVlICkge1xuXHRcdFx0XHRvcGVyYXRpb25zWyBmaWVsZF9rZXkgXSA9IHsgb3BlcmF0aW9uOiBvcGVyYXRpb24udmFsdWUsIHZhbHVlOiBmaWVsZF92YWx1ZS52YWx1ZSB9O1xuXHRcdFx0fVxuXHRcdH0gKTtcblxuXHRcdHJldHVybiBvcGVyYXRpb25zO1xuXHR9XG5cblx0LyoqXG5cdCAqIFN5bmNocm9uaXplIG9uZSBvcHRpb25hbCBidWxrIGZpZWxkIGFuZCB0aGUgcmV2aWV3IGFjdGlvbi5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxudWxsfSBjaGFuZ2VkX2NvbnRyb2wgQ29udHJvbCB0aGF0IGNoYW5nZWQsIHdoZW4gYXZhaWxhYmxlLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3luY2hyb25pemVfYnVsa19lZGl0b3IoIGNoYW5nZWRfY29udHJvbCApIHtcblx0XHR2YXIgZmllbGRfd3JhcCA9IGNoYW5nZWRfY29udHJvbCA/IGNoYW5nZWRfY29udHJvbC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWJ1bGstZmllbGRdJyApIDogbnVsbDtcblx0XHR2YXIgc2F2ZV9idXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1zYXZlXScgKTtcblxuXHRcdGlmICggZmllbGRfd3JhcCApIHtcblx0XHRcdHZhciBlbmFibGVkX2NvbnRyb2wgPSBmaWVsZF93cmFwLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtYnVsay1lbmFibGVdJyApO1xuXHRcdFx0dmFyIG9wZXJhdGlvbl9jb250cm9sID0gZmllbGRfd3JhcC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWJ1bGstb3BlcmF0aW9uXScgKTtcblx0XHRcdHZhciBwcmVmaXhfZWxlbWVudCA9IGZpZWxkX3dyYXAucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1idWxrLXByZWZpeF0nICk7XG5cdFx0XHR2YXIgc3VmZml4X2VsZW1lbnQgPSBmaWVsZF93cmFwLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtYnVsay1zdWZmaXhdJyApO1xuXHRcdFx0dmFyIGVuYWJsZWQgPSAhISBlbmFibGVkX2NvbnRyb2wgJiYgZW5hYmxlZF9jb250cm9sLmNoZWNrZWQ7XG5cdFx0XHR2YXIgb3BlcmF0aW9uX2lkID0gb3BlcmF0aW9uX2NvbnRyb2wgPyBTdHJpbmcoIG9wZXJhdGlvbl9jb250cm9sLnZhbHVlIHx8ICcnICkgOiAnJztcblx0XHRcdHZhciBpc19wZXJjZW50ID0gLTEgIT09IG9wZXJhdGlvbl9pZC5pbmRleE9mKCAncGVyY2VudCcgKTtcblx0XHRcdGZpZWxkX3dyYXAuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWVuYWJsZWQnLCBlbmFibGVkICk7XG5cdFx0XHRmaWVsZF93cmFwLnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtYnVsay1vcGVyYXRpb25dLCBbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtYnVsay12YWx1ZV0sIFtkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1idWxrLXJhbmdlXScgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGNvbnRyb2wgKSB7XG5cdFx0XHRcdGNvbnRyb2wuZGlzYWJsZWQgPSAhIGVuYWJsZWQ7XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoIHByZWZpeF9lbGVtZW50ICkge1xuXHRcdFx0XHRwcmVmaXhfZWxlbWVudC50ZXh0Q29udGVudCA9IGlzX3BlcmNlbnQgPyAnJyA6IGZpZWxkX3dyYXAuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtYnVsay1wcmVmaXgnICkgfHwgJyc7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHN1ZmZpeF9lbGVtZW50ICkge1xuXHRcdFx0XHRzdWZmaXhfZWxlbWVudC50ZXh0Q29udGVudCA9IGlzX3BlcmNlbnQgPyAnJScgOiBmaWVsZF93cmFwLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWJ1bGstc3VmZml4JyApIHx8ICcnO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjaGFuZ2VkX2NvbnRyb2wgJiYgY2hhbmdlZF9jb250cm9sLm1hdGNoZXMoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtYnVsay1yYW5nZV0nICkgKSB7XG5cdFx0XHRcdHZhciBudW1iZXJfY29udHJvbCA9IGZpZWxkX3dyYXAucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1idWxrLXZhbHVlXScgKTtcblx0XHRcdFx0aWYgKCBudW1iZXJfY29udHJvbCApIHtcblx0XHRcdFx0XHRudW1iZXJfY29udHJvbC52YWx1ZSA9IGNoYW5nZWRfY29udHJvbC52YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dmFyIHJhbmdlX2NvbnRyb2wgPSBmaWVsZF93cmFwLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtYnVsay1yYW5nZV0nICk7XG5cdFx0XHRcdHZhciBmaWVsZF92YWx1ZV9jb250cm9sID0gZmllbGRfd3JhcC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWJ1bGstdmFsdWVdJyApO1xuXHRcdFx0XHRpZiAoIHJhbmdlX2NvbnRyb2wgJiYgZmllbGRfdmFsdWVfY29udHJvbCAmJiAnJyAhPT0gZmllbGRfdmFsdWVfY29udHJvbC52YWx1ZSApIHtcblx0XHRcdFx0XHRyYW5nZV9jb250cm9sLnZhbHVlID0gZmllbGRfdmFsdWVfY29udHJvbC52YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRpbnNwZWN0b3JfYnVsa19vcGVyYXRpb25zID0gY29sbGVjdF9idWxrX29wZXJhdGlvbnMoKTtcblx0XHRpbnNwZWN0b3JfZGlydHkgPSBPYmplY3Qua2V5cyggaW5zcGVjdG9yX2J1bGtfb3BlcmF0aW9ucyApLmxlbmd0aCA+IDA7XG5cdFx0aWYgKCBzYXZlX2J1dHRvbiApIHtcblx0XHRcdHNhdmVfYnV0dG9uLmRpc2FibGVkID0gaW5zcGVjdG9yX3NlbGVjdGlvbl9zdGFsZSB8fCAhIGluc3BlY3Rvcl9kaXJ0eTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogUmVuZGVyIGEgc2lnbmVkIGJ1bGstZWRpdCByZXZpZXcgd2l0aG91dCBwZXJmb3JtaW5nIGEgbXV0YXRpb24uXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgIENhdGFsb2cgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtPYmplY3R9IHByZXZpZXcgU2VydmVyLWF1dGhvcml0YXRpdmUgcHJldmlldy5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHJlbmRlcmVkLlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVuZGVyX2J1bGtfcmV2aWV3KCBjb25maWcsIHByZXZpZXcgKSB7XG5cdFx0dmFyIGhvc3QgPSBnZXRfaW5zcGVjdG9yX2hvc3QoKTtcblx0XHR2YXIgcmV2aWV3X3dvcmtmbG93ID0gZ2V0X2lubGluZV9yZXZpZXdfd29ya2Zsb3coKTtcblx0XHR2YXIgcmV2aWV3X21vZGVsO1xuXHRcdHZhciB0YXJnZXQgPSBob3N0ID8gaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1mb3JtXScgKSA6IG51bGw7XG5cblx0XHRpZiAoICEgdGFyZ2V0ICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXZpZXdfbW9kZWwgPSByZXZpZXdfd29ya2Zsb3cgPyByZXZpZXdfd29ya2Zsb3cucHJlcGFyZSggcHJldmlldy5yZXZpZXcgfHwge30sIHtcblx0XHRcdGNoYW5nZWRfbGFiZWw6IGdldF9zZWxlY3Rpb25fY291bnRfbGFiZWwoIGNvbmZpZywgcHJldmlldy5zY2hlbWEucmVzb3VyY2VfaWRzLmxlbmd0aCApLFxuXHRcdFx0ZGVzY3JpcHRpb246IGNvbmZpZy5pMThuLmlubGluZV9yZXZpZXdfZGVzY3JpcHRpb24gfHwgJycsXG5cdFx0XHRmb3JtX2lkOiAnd3BiY19jYXRhbG9nX2Jvb2tpbmdfcmVzb3VyY2VzX2J1bGtfcmV2aWV3X2Zvcm0nLFxuXHRcdFx0bW9kZTogJ2J1bGtfcmV2aWV3Jyxcblx0XHRcdHBlbmRpbmdfbWVzc2FnZTogY29uZmlnLmkxOG4ucmV2aWV3X2NoYW5nZXNfaGVscCB8fCAnJyxcblx0XHRcdHRpdGxlOiBjb25maWcuaTE4bi5yZXZpZXdfY2hhbmdlcyB8fCBjb25maWcuaTE4bi5lZGl0X2Jvb2tpbmdfcmVzb3VyY2VzIHx8ICcnXG5cdFx0fSApIDoge307XG5cdFx0dGFyZ2V0LmlubmVySFRNTCA9IHJlbmRlcl9jb21wb25lbnQoIGNvbmZpZywgJ2luc3BlY3Rvcl9idWxrX3JldmlldycsIHJldmlld19tb2RlbCApO1xuXHRcdGlmICggISB0YXJnZXQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1idWxrLXJldmlldy1mb3JtXScgKSApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aW5zcGVjdG9yX21vZGUgPSAnYnVsa19yZXZpZXcnO1xuXHRcdGluc3BlY3Rvcl9yZXZpZXdfdG9rZW4gPSBTdHJpbmcoIHByZXZpZXcucmV2aWV3X3Rva2VuIHx8ICcnICk7XG5cdFx0aW5zcGVjdG9yX2RpcnR5ID0gdHJ1ZTtcblx0XHRzZXRfaW5zcGVjdG9yX3N0YXRlKCAnZm9ybScsICcnICk7XG5cdFx0Y29uZmlndXJlX2luc3BlY3Rvcl9mb290ZXIoICd3cGJjX2NhdGFsb2dfYm9va2luZ19yZXNvdXJjZXNfYnVsa19yZXZpZXdfZm9ybScsIGNvbmZpZy5pMThuLmFwcGx5X2NoYW5nZXMgfHwgJycsIGZhbHNlLCBpbnNwZWN0b3Jfc2VsZWN0aW9uX3N0YWxlICk7XG5cdFx0aWYgKCByZXZpZXdfd29ya2Zsb3cgKSB7XG5cdFx0XHRyZXZpZXdfd29ya2Zsb3cuc3luY2hyb25pemUoIHsgYnVzeTogZmFsc2UsIGNhbl9hcHBseTogISBpbnNwZWN0b3Jfc2VsZWN0aW9uX3N0YWxlICYmICEhIGluc3BlY3Rvcl9yZXZpZXdfdG9rZW4gfSApO1xuXHRcdH1cblx0XHRmb2N1c19pbnNwZWN0b3JfaGVhZGluZyggdGFyZ2V0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtYnVsay1yZXZpZXctZm9ybV0nICkgKTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlbmRlciB0aGUgc2lnbmVkIGRlbGV0aW9uIGltcGFjdCBhbmQgZXhwbGljaXQgYWNrbm93bGVkZ2VtZW50LlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnICBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBwcmV2aWV3IFNlcnZlci1hdXRob3JpdGF0aXZlIGRlbGV0aW9uIHByZXZpZXcuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiByZW5kZXJlZC5cblx0ICovXG5cdGZ1bmN0aW9uIHJlbmRlcl9kZWxldGVfcmV2aWV3KCBjb25maWcsIHByZXZpZXcgKSB7XG5cdFx0dmFyIGhvc3QgPSBnZXRfaW5zcGVjdG9yX2hvc3QoKTtcblx0XHR2YXIgdGFyZ2V0ID0gaG9zdCA/IGhvc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbnNwZWN0b3ItZm9ybV0nICkgOiBudWxsO1xuXHRcdHZhciBhY2tub3dsZWRnZW1lbnQ7XG5cblx0XHRpZiAoICEgdGFyZ2V0ICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHR2YXIgZGVsZXRlX2kxOG4gPSBwcmV2aWV3LmkxOG4gfHwge307XG5cblx0XHR0YXJnZXQuaW5uZXJIVE1MID0gcmVuZGVyX2NvbXBvbmVudCggY29uZmlnLCAnaW5zcGVjdG9yX2RlbGV0ZScsIHtcblx0XHRcdGRlbGV0ZV9pMThuOiB7XG5cdFx0XHRcdGFja25vd2xlZGdlbWVudDogZGVsZXRlX2kxOG4uYWNrbm93bGVkZ2VtZW50IHx8IGNvbmZpZy5pMThuLmRlbGV0ZV9hY2tub3dsZWRnZW1lbnQgfHwgJycsXG5cdFx0XHRcdGFjdGlvbnNfaGVhZGluZzogZGVsZXRlX2kxOG4uYWN0aW9uc19oZWFkaW5nIHx8ICcnLFxuXHRcdFx0XHRib29raW5nc19yZXRhaW5lZF93YXJuaW5nOiBkZWxldGVfaTE4bi5ib29raW5nc19yZXRhaW5lZF93YXJuaW5nIHx8IGNvbmZpZy5pMThuLmJvb2tpbmdzX3JldGFpbmVkX3dhcm5pbmcgfHwgJycsXG5cdFx0XHRcdHJlc291cmNlc190b19kZWxldGU6IGRlbGV0ZV9pMThuLnJlc291cmNlc190b19kZWxldGUgfHwgY29uZmlnLmkxOG4ucmVzb3VyY2VzX3RvX2RlbGV0ZSB8fCAnJyxcblx0XHRcdFx0cmV2aWV3X2hlbHA6IGRlbGV0ZV9pMThuLnJldmlld19oZWxwIHx8IGNvbmZpZy5pMThuLmRlbGV0ZV9yZXZpZXdfaGVscCB8fCAnJyxcblx0XHRcdFx0dGl0bGU6IGRlbGV0ZV9pMThuLnRpdGxlIHx8IGNvbmZpZy5pMThuLmRlbGV0ZV9ib29raW5nX3Jlc291cmNlcyB8fCAnJyxcblx0XHRcdFx0d2FybmluZzogZGVsZXRlX2kxOG4ud2FybmluZyB8fCBjb25maWcuaTE4bi5kZWxldGVfd2FybmluZyB8fCAnJ1xuXHRcdFx0fSxcblx0XHRcdGkxOG46IGNvbmZpZy5pMThuIHx8IHt9LFxuXHRcdFx0cHJldmlldzogcHJldmlldyxcblx0XHRcdHNlbGVjdGlvbl9sYWJlbDogZGVsZXRlX2kxOG4uc2VsZWN0aW9uX2xhYmVsIHx8IGdldF9zZWxlY3Rpb25fY291bnRfbGFiZWwoIGNvbmZpZywgcHJldmlldy5zZWxlY3Rpb25fY291bnQgKVxuXHRcdH0gKTtcblx0XHRpZiAoICEgdGFyZ2V0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtZGVsZXRlLWZvcm1dJyApICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpbnNwZWN0b3JfbW9kZSA9ICdkZWxldGVfcmV2aWV3Jztcblx0XHRpbnNwZWN0b3JfcmVzb3VyY2VfaWRzID0gKCBwcmV2aWV3LnJlc291cmNlcyB8fCBbXSApLm1hcCggZnVuY3Rpb24gKCByZXNvdXJjZSApIHsgcmV0dXJuIE51bWJlciggcmVzb3VyY2UuaWQgKTsgfSApO1xuXHRcdGluc3BlY3Rvcl9yZXNvdXJjZV9pZCA9ICEgaW5zcGVjdG9yX3RyYWNrc19zZWxlY3Rpb24gJiYgMSA9PT0gaW5zcGVjdG9yX3Jlc291cmNlX2lkcy5sZW5ndGggPyBpbnNwZWN0b3JfcmVzb3VyY2VfaWRzWzBdIDogMDtcblx0XHRpbnNwZWN0b3JfcmV2aWV3X3Rva2VuID0gU3RyaW5nKCBwcmV2aWV3LnJldmlld190b2tlbiB8fCAnJyApO1xuXHRcdGluc3BlY3Rvcl9zZWxlY3Rpb25fc3RhbGUgPSBmYWxzZTtcblx0XHRpbnNwZWN0b3JfZGlydHkgPSBmYWxzZTtcblx0XHRzZXRfaW5zcGVjdG9yX3N0YXRlKCAnZm9ybScsICcnICk7XG5cdFx0Y29uZmlndXJlX2luc3BlY3Rvcl9mb290ZXIoXG5cdFx0XHQnd3BiY19jYXRhbG9nX2Jvb2tpbmdfcmVzb3VyY2VzX2RlbGV0ZV9mb3JtJyxcblx0XHRcdGRlbGV0ZV9pMThuLmRlbGV0ZV9idXR0b24gfHwgZm9ybWF0X21lc3NhZ2UoIDEgPT09IE51bWJlciggcHJldmlldy5zZWxlY3Rpb25fY291bnQgKSA/IGNvbmZpZy5pMThuLmRlbGV0ZV9yZXNvdXJjZSB8fCAnJyA6IGNvbmZpZy5pMThuLmRlbGV0ZV9yZXNvdXJjZXMgfHwgJycsIFsgcHJldmlldy5zZWxlY3Rpb25fY291bnQgXSApLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdHRydWVcblx0XHQpO1xuXHRcdGFja25vd2xlZGdlbWVudCA9IHRhcmdldC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYm9va2luZ19yZXNvdXJjZXNfX2RlbGV0ZV9hY2tub3dsZWRnZW1lbnQnICk7XG5cdFx0cHVsc2VfZGVsZXRlX2Fja25vd2xlZGdlbWVudCggYWNrbm93bGVkZ2VtZW50ICk7XG5cdFx0bWFya19pbnNwZWN0b3JfcmVzb3VyY2Vfcm93KCBpbnNwZWN0b3JfcmVzb3VyY2VfaWQgKTtcblx0XHRmb2N1c19pbnNwZWN0b3JfaGVhZGluZyggdGFyZ2V0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtZGVsZXRlLWZvcm1dJyApICk7XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBPcGVuIHRoZSBpbmRlcGVuZGVudCBkZWxldGlvbiByZXZpZXcgZm9yIGV4cGxpY2l0IFJlc291cmNlIElEcy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgICBjb25maWcgICAgICAgQ2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge0FycmF5PG51bWJlcj59IHJlc291cmNlX2lkcyBSZXNvdXJjZSBJRHMgc2VsZWN0ZWQgZm9yIGRlbGV0aW9uLlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSAgIGZvY3VzX3RhcmdldCBJbml0aWF0aW5nIGNvbnRyb2wuXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gICAgICAgdHJhY2tfc2VsZWN0aW9uIFdoZXRoZXIgZGVsZXRpb24gb3ducyB0aGUgY2hlY2tib3ggc2VsZWN0aW9uLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gb3Blbl9kZWxldGVfcmV2aWV3KCBjb25maWcsIHJlc291cmNlX2lkcywgZm9jdXNfdGFyZ2V0LCB0cmFja19zZWxlY3Rpb24gKSB7XG5cdFx0dmFyIHJlcXVlc3Rfc2VxdWVuY2U7XG5cblx0XHRyZXNvdXJjZV9pZHMgPSAoIHJlc291cmNlX2lkcyB8fCBbXSApLm1hcCggTnVtYmVyICkuZmlsdGVyKCBmdW5jdGlvbiAoIHJlc291cmNlX2lkICkgeyByZXR1cm4gcmVzb3VyY2VfaWQgPiAwOyB9ICk7XG5cdFx0aWYgKCAhIHJlc291cmNlX2lkcy5sZW5ndGggfHwgISBjYW5fZGlzY2FyZF9pbnNwZWN0b3IoIGNvbmZpZyApIHx8ICEgbW91bnRfaW5zcGVjdG9yX3NoZWxsKCBjb25maWcgKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y2xvc2VfZGV0YWlsc19yb3coIGZhbHNlICk7XG5cdFx0aW5zcGVjdG9yX2ZvY3VzX3RhcmdldCA9IGZvY3VzX3RhcmdldCB8fCBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuXHRcdHJlcXVlc3Rfc2VxdWVuY2UgPSArK2luc3BlY3Rvcl9yZXF1ZXN0X3NlcXVlbmNlO1xuXHRcdGluc3BlY3Rvcl9tb2RlID0gJ2RlbGV0ZV9yZXZpZXcnO1xuXHRcdGluc3BlY3Rvcl9yZXNvdXJjZV9pZHMgPSByZXNvdXJjZV9pZHMuc2xpY2UoKTtcblx0XHRpbnNwZWN0b3JfcmVzb3VyY2VfaWQgPSAhIHRyYWNrX3NlbGVjdGlvbiAmJiAxID09PSBpbnNwZWN0b3JfcmVzb3VyY2VfaWRzLmxlbmd0aCA/IGluc3BlY3Rvcl9yZXNvdXJjZV9pZHNbMF0gOiAwO1xuXHRcdGluc3BlY3Rvcl9kaXJ0eSA9IGZhbHNlO1xuXHRcdGluc3BlY3Rvcl90cmFja3Nfc2VsZWN0aW9uID0gISEgdHJhY2tfc2VsZWN0aW9uO1xuXHRcdHN5bmNocm9uaXplX2luc3BlY3Rvcl93aWR0aCgpO1xuXHRcdHNldF9pbnNwZWN0b3Jfc3RhdGUoICdsb2FkaW5nJywgJycgKTtcblx0XHRtYXJrX2luc3BlY3Rvcl9yZXNvdXJjZV9yb3coIGluc3BlY3Rvcl9yZXNvdXJjZV9pZCApO1xuXHRcdGV4cGFuZF9pbnNwZWN0b3Jfc2lkZWJhcigpO1xuXG5cdFx0cmVxdWVzdF9pbnNwZWN0b3IoIGNvbmZpZywgY29uZmlnLmRlbGV0ZV9wcmV2aWV3X2FjdGlvbiwgeyByZXNvdXJjZV9pZHM6IEpTT04uc3RyaW5naWZ5KCByZXNvdXJjZV9pZHMgKSB9ICkudGhlbiggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdGlmICggcmVxdWVzdF9zZXF1ZW5jZSAhPT0gaW5zcGVjdG9yX3JlcXVlc3Rfc2VxdWVuY2UgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggISByZXNwb25zZSB8fCB0cnVlICE9PSByZXNwb25zZS5zdWNjZXNzIHx8ICEgcmVzcG9uc2UuZGF0YSB8fCAhIHJlc3BvbnNlLmRhdGEucHJldmlldyB8fCAhIHJlbmRlcl9kZWxldGVfcmV2aWV3KCBjb25maWcsIHJlc3BvbnNlLmRhdGEucHJldmlldyApICkge1xuXHRcdFx0XHRzZXRfaW5zcGVjdG9yX3N0YXRlKCAnZXJyb3InLCBnZXRfaW5zcGVjdG9yX3Jlc3BvbnNlX21lc3NhZ2UoIHJlc3BvbnNlLCBjb25maWcuaTE4bi5kZWxldGVfbG9hZF9mYWlsZWQgKSApO1xuXHRcdFx0fSBlbHNlIGlmICggaW5zcGVjdG9yX3RyYWNrc19zZWxlY3Rpb24gJiYgISByZXNvdXJjZV9pZF9saXN0c19tYXRjaCggaW5zcGVjdG9yX3Jlc291cmNlX2lkcywgZ2V0X3NlbGVjdGVkX3Jlc291cmNlX2lkcyggY29uZmlnICkgKSApIHtcblx0XHRcdFx0aGFuZGxlX2luc3BlY3Rvcl9zZWxlY3Rpb25fY2hhbmdlKCBudWxsLCBjb25maWcgKTtcblx0XHRcdH1cblx0XHR9ICkuY2F0Y2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdGlmICggcmVxdWVzdF9zZXF1ZW5jZSA9PT0gaW5zcGVjdG9yX3JlcXVlc3Rfc2VxdWVuY2UgKSB7XG5cdFx0XHRcdHNldF9pbnNwZWN0b3Jfc3RhdGUoICdlcnJvcicsIGNvbmZpZy5pMThuLmRlbGV0ZV9sb2FkX2ZhaWxlZCB8fCAnJyApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gb25lIGxvY2FsaXplZCBjYXBhY2l0eSBjb3VudCBsYWJlbC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyAgICAgICBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBzaW5ndWxhcl9rZXkgU2luZ3VsYXIgdHJhbnNsYXRpb24ga2V5LlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gcGx1cmFsX2tleSAgIFBsdXJhbCB0cmFuc2xhdGlvbiBrZXkuXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBjb3VudCAgICAgICAgTm9uLW5lZ2F0aXZlIGNvdW50LlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IExvY2FsaXplZCBsYWJlbC5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9jYXBhY2l0eV9jb3VudF9sYWJlbCggY29uZmlnLCBzaW5ndWxhcl9rZXksIHBsdXJhbF9rZXksIGNvdW50ICkge1xuXHRcdHZhciB0ZW1wbGF0ZSA9IDEgPT09IE51bWJlciggY291bnQgKSA/IGNvbmZpZy5pMThuWyBzaW5ndWxhcl9rZXkgXSA6IGNvbmZpZy5pMThuWyBwbHVyYWxfa2V5IF07XG5cblx0XHRyZXR1cm4gZm9ybWF0X21lc3NhZ2UoIHRlbXBsYXRlIHx8ICcnLCBbIGNvdW50IF0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBCdWlsZCBwcmVzZW50YXRpb24tb25seSBkYXRhIGZvciB0aGUgY2FwYWNpdHkgV1AgdGVtcGxhdGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgIENhdGFsb2cgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHQgU2VydmVyLWF1dGhvcml0YXRpdmUgY2FwYWNpdHkgY29udGV4dC5cblx0ICogQHJldHVybiB7T2JqZWN0fSBUZW1wbGF0ZSB2aWV3IGRhdGEuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfY2FwYWNpdHlfZWRpdG9yX3ZpZXcoIGNvbmZpZywgY29udGV4dCApIHtcblx0XHR2YXIgY3VycmVudF9jYXBhY2l0eSA9IE51bWJlciggY29udGV4dC5jdXJyZW50X2NhcGFjaXR5ICkgfHwgMTtcblx0XHR2YXIgdGFyZ2V0X2NhcGFjaXR5ID0gaW5zcGVjdG9yX2NhcGFjaXR5X3RhcmdldCB8fCBjdXJyZW50X2NhcGFjaXR5O1xuXHRcdHZhciBvcGVyYXRpb24gPSB0YXJnZXRfY2FwYWNpdHkgPiBjdXJyZW50X2NhcGFjaXR5ID8gJ2luY3JlYXNlJyA6ICggdGFyZ2V0X2NhcGFjaXR5IDwgY3VycmVudF9jYXBhY2l0eSA/ICdkZWNyZWFzZScgOiAndW5jaGFuZ2VkJyApO1xuXHRcdHZhciBrZWVwX2NvdW50ID0gJ2RlY3JlYXNlJyA9PT0gb3BlcmF0aW9uID8gdGFyZ2V0X2NhcGFjaXR5IDogY3VycmVudF9jYXBhY2l0eTtcblx0XHR2YXIgY3JlYXRlX2NvdW50ID0gTWF0aC5tYXgoIDAsIHRhcmdldF9jYXBhY2l0eSAtIGN1cnJlbnRfY2FwYWNpdHkgKTtcblx0XHR2YXIgZGVjcmVhc2VfY291bnQgPSBNYXRoLm1heCggMCwgY3VycmVudF9jYXBhY2l0eSAtIHRhcmdldF9jYXBhY2l0eSApO1xuXHRcdHZhciBkZWxldGVfYWN0aW9uID0gJ2RlY3JlYXNlJyA9PT0gb3BlcmF0aW9uICYmICdkZWxldGUnID09PSBpbnNwZWN0b3JfY2FwYWNpdHlfZGVjcmVhc2VfYWN0aW9uO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGNoaWxkcmVuOiAoIGNvbnRleHQuY2hpbGRyZW4gfHwgW10gKS5tYXAoIGZ1bmN0aW9uICggY2hpbGQgKSB7XG5cdFx0XHRcdGNoaWxkID0gT2JqZWN0LmFzc2lnbigge30sIGNoaWxkICk7XG5cdFx0XHRcdGNoaWxkLnNlbGVjdGVkID0gLTEgIT09IGluc3BlY3Rvcl9jYXBhY2l0eV9kZXRhY2hfaWRzLmluZGV4T2YoIE51bWJlciggY2hpbGQuaWQgKSApO1xuXHRcdFx0XHRyZXR1cm4gY2hpbGQ7XG5cdFx0XHR9ICksXG5cdFx0XHRjb250ZXh0X2xhYmVsOiAoIGNvbmZpZy5pMThuLnJlc291cmNlX2lkIHx8ICdJRCcgKSArICc6ICcgKyBTdHJpbmcoIGNvbnRleHQucmVzb3VyY2VfaWQgKSxcblx0XHRcdGN1cnJlbnRfY2FwYWNpdHk6IGN1cnJlbnRfY2FwYWNpdHksXG5cdFx0XHRkZWNyZWFzZV9hY3Rpb246IGluc3BlY3Rvcl9jYXBhY2l0eV9kZWNyZWFzZV9hY3Rpb24sXG5cdFx0XHRkZWNyZWFzZV9oZWFkaW5nOiBnZXRfY2FwYWNpdHlfY291bnRfbGFiZWwoIGNvbmZpZywgZGVsZXRlX2FjdGlvbiA/ICdjaG9vc2VfZGVsZXRlX3VuaXQnIDogJ2Nob29zZV9kZXRhY2hfdW5pdCcsIGRlbGV0ZV9hY3Rpb24gPyAnY2hvb3NlX2RlbGV0ZV91bml0cycgOiAnY2hvb3NlX2RldGFjaF91bml0cycsIGRlY3JlYXNlX2NvdW50ICksXG5cdFx0XHRkZWNyZWFzZV9oZWxwOiBkZWxldGVfYWN0aW9uID8gY29uZmlnLmkxOG4uZGVsZXRlX3VuaXRzX2hlbHAgfHwgJycgOiBjb25maWcuaTE4bi5zZWxlY3RfZGV0YWNoX2hlbHAgfHwgJycsXG5cdFx0XHRkZWNyZWFzZV9vdXRjb21lX2xhYmVsOiBkZWxldGVfYWN0aW9uID8gY29uZmlnLmkxOG4ud2lsbF9iZV9kZWxldGVkIHx8ICcnIDogY29uZmlnLmkxOG4ubWFrZV9pbmRlcGVuZGVudCB8fCAnJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBjb25maWcuaTE4bi5jYXBhY2l0eV9kZXNjcmlwdGlvbiB8fCAnJyxcblx0XHRcdGNyZWF0ZV9sYWJlbDogZ2V0X2NhcGFjaXR5X2NvdW50X2xhYmVsKCBjb25maWcsICdjcmVhdGVfbmV3X3VuaXQnLCAnY3JlYXRlX25ld191bml0cycsIGNyZWF0ZV9jb3VudCApLFxuXHRcdFx0a2VlcF9sYWJlbDogZ2V0X2NhcGFjaXR5X2NvdW50X2xhYmVsKCBjb25maWcsICdrZWVwX2V4aXN0aW5nX3VuaXQnLCAna2VlcF9leGlzdGluZ191bml0cycsIGtlZXBfY291bnQgKSxcblx0XHRcdG1heGltdW1fY2FwYWNpdHk6IE51bWJlciggY29udGV4dC5tYXhpbXVtX2NhcGFjaXR5ICkgfHwgY3VycmVudF9jYXBhY2l0eSxcblx0XHRcdG1pbmltdW1fY2FwYWNpdHk6IE51bWJlciggY29udGV4dC5taW5pbXVtX2NhcGFjaXR5ICkgfHwgMSxcblx0XHRcdG1vZGU6ICdjYXBhY2l0eScsXG5cdFx0XHRvcGVyYXRpb246IG9wZXJhdGlvbixcblx0XHRcdHRhcmdldF9jYXBhY2l0eTogdGFyZ2V0X2NhcGFjaXR5LFxuXHRcdFx0dGl0bGU6IGNvbmZpZy5pMThuLmFkanVzdF9jYXBhY2l0eSB8fCAnJ1xuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogU3luY2hyb25pemUgdGhlIGxpdmUgY2FwYWNpdHkgcGxhbiB3aXRob3V0IHJlcGxhY2luZyBmb2N1c2VkIGNvbnRyb2xzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnIENhdGFsb2cgY29uZmlndXJhdGlvbi5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHN5bmNocm9uaXplX2NhcGFjaXR5X2VkaXRvciggY29uZmlnICkge1xuXHRcdHZhciBmb3JtID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1jYXBhY2l0eS1mb3JtXVtkYXRhLW1vZGU9XCJjYXBhY2l0eVwiXScgKTtcblx0XHR2YXIgc2F2ZV9idXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1zYXZlXScgKTtcblx0XHR2YXIgY29udGV4dCA9IGluc3BlY3Rvcl9jYXBhY2l0eV9jb250ZXh0IHx8IHt9O1xuXHRcdHZhciBjdXJyZW50X2NhcGFjaXR5ID0gTnVtYmVyKCBjb250ZXh0LmN1cnJlbnRfY2FwYWNpdHkgKSB8fCAxO1xuXHRcdHZhciB0YXJnZXRfY2FwYWNpdHkgPSBpbnNwZWN0b3JfY2FwYWNpdHlfdGFyZ2V0IHx8IGN1cnJlbnRfY2FwYWNpdHk7XG5cdFx0dmFyIG9wZXJhdGlvbiA9IHRhcmdldF9jYXBhY2l0eSA+IGN1cnJlbnRfY2FwYWNpdHkgPyAnaW5jcmVhc2UnIDogKCB0YXJnZXRfY2FwYWNpdHkgPCBjdXJyZW50X2NhcGFjaXR5ID8gJ2RlY3JlYXNlJyA6ICd1bmNoYW5nZWQnICk7XG5cdFx0dmFyIHJlcXVpcmVkX2RldGFjaF9jb3VudCA9IE1hdGgubWF4KCAwLCBjdXJyZW50X2NhcGFjaXR5IC0gdGFyZ2V0X2NhcGFjaXR5ICk7XG5cdFx0dmFyIHRhcmdldF9udW1iZXIgPSBmb3JtID8gZm9ybS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLWNhcGFjaXR5LXRhcmdldF0nICkgOiBudWxsO1xuXHRcdHZhciB0YXJnZXRfcmFuZ2UgPSBmb3JtID8gZm9ybS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLWNhcGFjaXR5LXJhbmdlXScgKSA6IG51bGw7XG5cblx0XHRpZiAoICEgZm9ybSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCAnZGVjcmVhc2UnICE9PSBvcGVyYXRpb24gKSB7XG5cdFx0XHRpbnNwZWN0b3JfY2FwYWNpdHlfZGV0YWNoX2lkcyA9IFtdO1xuXHRcdFx0aW5zcGVjdG9yX2NhcGFjaXR5X2RlY3JlYXNlX2FjdGlvbiA9ICdkZXRhY2gnO1xuXHRcdH0gZWxzZSBpZiAoIGluc3BlY3Rvcl9jYXBhY2l0eV9kZXRhY2hfaWRzLmxlbmd0aCA+IHJlcXVpcmVkX2RldGFjaF9jb3VudCApIHtcblx0XHRcdGluc3BlY3Rvcl9jYXBhY2l0eV9kZXRhY2hfaWRzID0gaW5zcGVjdG9yX2NhcGFjaXR5X2RldGFjaF9pZHMuc2xpY2UoIDAsIHJlcXVpcmVkX2RldGFjaF9jb3VudCApO1xuXHRcdH1cblx0XHRpZiAoIHRhcmdldF9udW1iZXIgKSB7XG5cdFx0XHR0YXJnZXRfbnVtYmVyLnZhbHVlID0gU3RyaW5nKCB0YXJnZXRfY2FwYWNpdHkgKTtcblx0XHR9XG5cdFx0aWYgKCB0YXJnZXRfcmFuZ2UgKSB7XG5cdFx0XHR0YXJnZXRfcmFuZ2UudmFsdWUgPSBTdHJpbmcoIHRhcmdldF9jYXBhY2l0eSApO1xuXHRcdH1cblx0XHR2YXIgYWZ0ZXJfdmFsdWUgPSBmb3JtLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctY2FwYWNpdHktYWZ0ZXJdJyApO1xuXHRcdHZhciBrZWVwX2xhYmVsID0gZm9ybS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLWNhcGFjaXR5LWtlZXAtbGFiZWxdJyApO1xuXHRcdHZhciBjcmVhdGVfbGFiZWwgPSBmb3JtLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctY2FwYWNpdHktY3JlYXRlLWxhYmVsXScgKTtcblx0XHR2YXIgaW5jcmVhc2Vfcm93ID0gZm9ybS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLWNhcGFjaXR5LWluY3JlYXNlLXJvd10nICk7XG5cdFx0dmFyIGRlY3JlYXNlX3BhbmVsID0gZm9ybS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLWNhcGFjaXR5LWRlY3JlYXNlXScgKTtcblx0XHR2YXIgZGVjcmVhc2VfaGVhZGluZyA9IGZvcm0ucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1jYXBhY2l0eS1kZWNyZWFzZS1oZWFkaW5nXScgKTtcblx0XHR2YXIgZGVjcmVhc2VfaGVscCA9IGZvcm0ucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1jYXBhY2l0eS1kZWNyZWFzZS1oZWxwXScgKTtcblx0XHR2YXIgZGVsZXRlX2FjdGlvbiA9ICdkZWNyZWFzZScgPT09IG9wZXJhdGlvbiAmJiAnZGVsZXRlJyA9PT0gaW5zcGVjdG9yX2NhcGFjaXR5X2RlY3JlYXNlX2FjdGlvbjtcblx0XHRpZiAoIGFmdGVyX3ZhbHVlICkge1xuXHRcdFx0YWZ0ZXJfdmFsdWUudGV4dENvbnRlbnQgPSBTdHJpbmcoIHRhcmdldF9jYXBhY2l0eSApO1xuXHRcdH1cblx0XHRpZiAoIGtlZXBfbGFiZWwgKSB7XG5cdFx0XHRrZWVwX2xhYmVsLnRleHRDb250ZW50ID0gZ2V0X2NhcGFjaXR5X2NvdW50X2xhYmVsKCBjb25maWcsICdrZWVwX2V4aXN0aW5nX3VuaXQnLCAna2VlcF9leGlzdGluZ191bml0cycsICdkZWNyZWFzZScgPT09IG9wZXJhdGlvbiA/IHRhcmdldF9jYXBhY2l0eSA6IGN1cnJlbnRfY2FwYWNpdHkgKTtcblx0XHR9XG5cdFx0aWYgKCBjcmVhdGVfbGFiZWwgKSB7XG5cdFx0XHRjcmVhdGVfbGFiZWwudGV4dENvbnRlbnQgPSBnZXRfY2FwYWNpdHlfY291bnRfbGFiZWwoIGNvbmZpZywgJ2NyZWF0ZV9uZXdfdW5pdCcsICdjcmVhdGVfbmV3X3VuaXRzJywgTWF0aC5tYXgoIDAsIHRhcmdldF9jYXBhY2l0eSAtIGN1cnJlbnRfY2FwYWNpdHkgKSApO1xuXHRcdH1cblx0XHRpZiAoIGluY3JlYXNlX3JvdyApIHtcblx0XHRcdGluY3JlYXNlX3Jvdy5oaWRkZW4gPSAnaW5jcmVhc2UnICE9PSBvcGVyYXRpb247XG5cdFx0fVxuXHRcdGlmICggZGVjcmVhc2VfcGFuZWwgKSB7XG5cdFx0XHRkZWNyZWFzZV9wYW5lbC5oaWRkZW4gPSAnZGVjcmVhc2UnICE9PSBvcGVyYXRpb247XG5cdFx0fVxuXHRcdGlmICggZGVjcmVhc2VfaGVhZGluZyApIHtcblx0XHRcdGRlY3JlYXNlX2hlYWRpbmcudGV4dENvbnRlbnQgPSBnZXRfY2FwYWNpdHlfY291bnRfbGFiZWwoIGNvbmZpZywgZGVsZXRlX2FjdGlvbiA/ICdjaG9vc2VfZGVsZXRlX3VuaXQnIDogJ2Nob29zZV9kZXRhY2hfdW5pdCcsIGRlbGV0ZV9hY3Rpb24gPyAnY2hvb3NlX2RlbGV0ZV91bml0cycgOiAnY2hvb3NlX2RldGFjaF91bml0cycsIHJlcXVpcmVkX2RldGFjaF9jb3VudCApO1xuXHRcdH1cblx0XHRpZiAoIGRlY3JlYXNlX2hlbHAgKSB7XG5cdFx0XHRkZWNyZWFzZV9oZWxwLnRleHRDb250ZW50ID0gZGVsZXRlX2FjdGlvbiA/IGNvbmZpZy5pMThuLmRlbGV0ZV91bml0c19oZWxwIHx8ICcnIDogY29uZmlnLmkxOG4uc2VsZWN0X2RldGFjaF9oZWxwIHx8ICcnO1xuXHRcdH1cblx0XHRmb3JtLnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLWNhdGFsb2ctY2FwYWNpdHktZGVjcmVhc2UtYWN0aW9uXScgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGFjdGlvbl9jb250cm9sICkge1xuXHRcdFx0dmFyIGFjdGlvbl9zZWxlY3RlZCA9IGFjdGlvbl9jb250cm9sLnZhbHVlID09PSBpbnNwZWN0b3JfY2FwYWNpdHlfZGVjcmVhc2VfYWN0aW9uO1xuXHRcdFx0YWN0aW9uX2NvbnRyb2wuY2hlY2tlZCA9IGFjdGlvbl9zZWxlY3RlZDtcblx0XHRcdGlmICggYWN0aW9uX2NvbnRyb2wuY2xvc2VzdCggJ2xhYmVsJyApICkge1xuXHRcdFx0XHRhY3Rpb25fY29udHJvbC5jbG9zZXN0KCAnbGFiZWwnICkuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLXNlbGVjdGVkJywgYWN0aW9uX3NlbGVjdGVkICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHRcdGZvcm0ucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtY2F0YWxvZy1jYXBhY2l0eS1kZXRhY2hdJyApLmZvckVhY2goIGZ1bmN0aW9uICggY2hlY2tib3ggKSB7XG5cdFx0XHR2YXIgc2VsZWN0ZWQgPSAtMSAhPT0gaW5zcGVjdG9yX2NhcGFjaXR5X2RldGFjaF9pZHMuaW5kZXhPZiggTnVtYmVyKCBjaGVja2JveC52YWx1ZSApICk7XG5cdFx0XHR2YXIgdW5pdCA9IGNoZWNrYm94LmNsb3Nlc3QoICcud3BiY19ib29raW5nX3Jlc291cmNlc19fY2FwYWNpdHlfdW5pdCcgKTtcblx0XHRcdHZhciBvdXRjb21lID0gdW5pdCA/IHVuaXQucXVlcnlTZWxlY3RvciggJy53cGJjX2Jvb2tpbmdfcmVzb3VyY2VzX19jYXBhY2l0eV91bml0X291dGNvbWUnICkgOiBudWxsO1xuXHRcdFx0Y2hlY2tib3guY2hlY2tlZCA9IHNlbGVjdGVkO1xuXHRcdFx0Y2hlY2tib3guZGlzYWJsZWQgPSAhIHNlbGVjdGVkICYmIGluc3BlY3Rvcl9jYXBhY2l0eV9kZXRhY2hfaWRzLmxlbmd0aCA+PSByZXF1aXJlZF9kZXRhY2hfY291bnQ7XG5cdFx0XHRpZiAoIHVuaXQgKSB7XG5cdFx0XHRcdHVuaXQuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLXNlbGVjdGVkJywgc2VsZWN0ZWQgKTtcblx0XHRcdH1cblx0XHRcdGlmICggb3V0Y29tZSApIHtcblx0XHRcdFx0b3V0Y29tZS5oaWRkZW4gPSAhIHNlbGVjdGVkO1xuXHRcdFx0XHRvdXRjb21lLnRleHRDb250ZW50ID0gZGVsZXRlX2FjdGlvbiA/IGNvbmZpZy5pMThuLndpbGxfYmVfZGVsZXRlZCB8fCAnJyA6IGNvbmZpZy5pMThuLm1ha2VfaW5kZXBlbmRlbnQgfHwgJyc7XG5cdFx0XHRcdG91dGNvbWUuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWRlc3RydWN0aXZlJywgZGVsZXRlX2FjdGlvbiApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0XHRpbnNwZWN0b3JfZGlydHkgPSB0YXJnZXRfY2FwYWNpdHkgIT09IGN1cnJlbnRfY2FwYWNpdHk7XG5cdFx0aWYgKCBzYXZlX2J1dHRvbiApIHtcblx0XHRcdHNhdmVfYnV0dG9uLmRpc2FibGVkID0gJ3VuY2hhbmdlZCcgPT09IG9wZXJhdGlvbiB8fCAoICdkZWNyZWFzZScgPT09IG9wZXJhdGlvbiAmJiBpbnNwZWN0b3JfY2FwYWNpdHlfZGV0YWNoX2lkcy5sZW5ndGggIT09IHJlcXVpcmVkX2RldGFjaF9jb3VudCApO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBSZW5kZXIgYW4gYXV0aG9yaXplZCBjYXBhY2l0eSBlZGl0b3IgY29udGV4dC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyAgQ2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29udGV4dCBTZXJ2ZXIgY2FwYWNpdHkgY29udGV4dC5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSB0ZW1wbGF0ZSByZW5kZXJlZC5cblx0ICovXG5cdGZ1bmN0aW9uIHJlbmRlcl9jYXBhY2l0eV9lZGl0b3IoIGNvbmZpZywgY29udGV4dCApIHtcblx0XHR2YXIgaG9zdCA9IGdldF9pbnNwZWN0b3JfaG9zdCgpO1xuXHRcdHZhciB0YXJnZXQgPSBob3N0ID8gaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1mb3JtXScgKSA6IG51bGw7XG5cblx0XHRpZiAoICEgdGFyZ2V0ICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpbnNwZWN0b3JfY2FwYWNpdHlfY29udGV4dCA9IGNvbnRleHQ7XG5cdFx0aW5zcGVjdG9yX2NhcGFjaXR5X3RhcmdldCA9IE51bWJlciggY29udGV4dC5jdXJyZW50X2NhcGFjaXR5ICkgfHwgMTtcblx0XHRpbnNwZWN0b3JfY2FwYWNpdHlfZGV0YWNoX2lkcyA9IFtdO1xuXHRcdGluc3BlY3Rvcl9jYXBhY2l0eV9kZWNyZWFzZV9hY3Rpb24gPSAnZGV0YWNoJztcblx0XHR0YXJnZXQuaW5uZXJIVE1MID0gcmVuZGVyX2NvbXBvbmVudCggY29uZmlnLCAnaW5zcGVjdG9yX2NhcGFjaXR5Jywge1xuXHRcdFx0aTE4bjogY29uZmlnLmkxOG4gfHwge30sXG5cdFx0XHR2aWV3OiBnZXRfY2FwYWNpdHlfZWRpdG9yX3ZpZXcoIGNvbmZpZywgY29udGV4dCApXG5cdFx0fSApO1xuXHRcdGlmICggISB0YXJnZXQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1jYXBhY2l0eS1mb3JtXScgKSApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aW5zcGVjdG9yX21vZGUgPSAnY2FwYWNpdHknO1xuXHRcdGluc3BlY3Rvcl9yZXNvdXJjZV9pZCA9IE51bWJlciggY29udGV4dC5yZXNvdXJjZV9pZCApIHx8IDA7XG5cdFx0aW5zcGVjdG9yX3Jldmlld190b2tlbiA9ICcnO1xuXHRcdGluc3BlY3Rvcl9kaXJ0eSA9IGZhbHNlO1xuXHRcdHNldF9pbnNwZWN0b3Jfc3RhdGUoICdmb3JtJywgJycgKTtcblx0XHRjb25maWd1cmVfaW5zcGVjdG9yX2Zvb3RlciggJ3dwYmNfY2F0YWxvZ19ib29raW5nX3Jlc291cmNlX2NhcGFjaXR5X2Zvcm0nLCBjb25maWcuaTE4bi5yZXZpZXdfY2FwYWNpdHlfY2hhbmdlIHx8ICcnLCBmYWxzZSwgdHJ1ZSApO1xuXHRcdG1hcmtfaW5zcGVjdG9yX3Jlc291cmNlX3JvdyggaW5zcGVjdG9yX3Jlc291cmNlX2lkICk7XG5cdFx0Zm9jdXNfaW5zcGVjdG9yX2hlYWRpbmcoIHRhcmdldC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWNhcGFjaXR5LWZvcm1dJyApICk7XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBPcGVuIGNhcGFjaXR5IGNvbnRleHQgZnJvbSBlaXRoZXIgcm93IGFjdGlvbiBlbnRyeSBwb2ludC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgY29uZmlnICAgICAgIENhdGFsb2cgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtudW1iZXJ9ICAgICAgcmVzb3VyY2VfaWQgIFJvb3Qgb3IgY2hpbGQgUmVzb3VyY2UgSUQuXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGZvY3VzX3RhcmdldCBJbml0aWF0aW5nIGNvbnRyb2wuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBvcGVuX2NhcGFjaXR5X2VkaXRvciggY29uZmlnLCByZXNvdXJjZV9pZCwgZm9jdXNfdGFyZ2V0ICkge1xuXHRcdHZhciByZXF1ZXN0X3NlcXVlbmNlO1xuXG5cdFx0aWYgKCAhIHJlc291cmNlX2lkIHx8ICEgY2FuX2Rpc2NhcmRfaW5zcGVjdG9yKCBjb25maWcgKSB8fCAhIG1vdW50X2luc3BlY3Rvcl9zaGVsbCggY29uZmlnICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNsb3NlX2RldGFpbHNfcm93KCBmYWxzZSApO1xuXHRcdGluc3BlY3Rvcl9mb2N1c190YXJnZXQgPSBmb2N1c190YXJnZXQgfHwgZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcblx0XHRyZXF1ZXN0X3NlcXVlbmNlID0gKytpbnNwZWN0b3JfcmVxdWVzdF9zZXF1ZW5jZTtcblx0XHRpbnNwZWN0b3JfbW9kZSA9ICdjYXBhY2l0eSc7XG5cdFx0aW5zcGVjdG9yX3Jlc291cmNlX2lkID0gcmVzb3VyY2VfaWQ7XG5cdFx0aW5zcGVjdG9yX2RpcnR5ID0gZmFsc2U7XG5cdFx0aW5zcGVjdG9yX3RyYWNrc19zZWxlY3Rpb24gPSBmYWxzZTtcblx0XHRzeW5jaHJvbml6ZV9pbnNwZWN0b3Jfd2lkdGgoKTtcblx0XHRzZXRfaW5zcGVjdG9yX3N0YXRlKCAnbG9hZGluZycsICcnICk7XG5cdFx0bWFya19pbnNwZWN0b3JfcmVzb3VyY2Vfcm93KCByZXNvdXJjZV9pZCApO1xuXHRcdGV4cGFuZF9pbnNwZWN0b3Jfc2lkZWJhcigpO1xuXG5cdFx0cmVxdWVzdF9pbnNwZWN0b3IoIGNvbmZpZywgY29uZmlnLmNhcGFjaXR5X2NvbnRleHRfYWN0aW9uLCB7IHJlc291cmNlX2lkOiByZXNvdXJjZV9pZCB9ICkudGhlbiggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdGlmICggcmVxdWVzdF9zZXF1ZW5jZSAhPT0gaW5zcGVjdG9yX3JlcXVlc3Rfc2VxdWVuY2UgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggISByZXNwb25zZSB8fCB0cnVlICE9PSByZXNwb25zZS5zdWNjZXNzIHx8ICEgcmVzcG9uc2UuZGF0YSB8fCAhIHJlc3BvbnNlLmRhdGEuY29udGV4dCB8fCAhIHJlbmRlcl9jYXBhY2l0eV9lZGl0b3IoIGNvbmZpZywgcmVzcG9uc2UuZGF0YS5jb250ZXh0ICkgKSB7XG5cdFx0XHRcdHNldF9pbnNwZWN0b3Jfc3RhdGUoICdlcnJvcicsIGdldF9pbnNwZWN0b3JfcmVzcG9uc2VfbWVzc2FnZSggcmVzcG9uc2UsIGNvbmZpZy5pMThuLmNhcGFjaXR5X2xvYWRfZmFpbGVkICkgKTtcblx0XHRcdH1cblx0XHR9ICkuY2F0Y2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdGlmICggcmVxdWVzdF9zZXF1ZW5jZSA9PT0gaW5zcGVjdG9yX3JlcXVlc3Rfc2VxdWVuY2UgKSB7XG5cdFx0XHRcdHNldF9pbnNwZWN0b3Jfc3RhdGUoICdlcnJvcicsIGNvbmZpZy5pMThuLmNhcGFjaXR5X2xvYWRfZmFpbGVkIHx8ICcnICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlbmRlciBhIHNpZ25lZCBjYXBhY2l0eSByZXZpZXcgcmV0dXJuZWQgYnkgdGhlIGRvbWFpbiBzZXJ2aWNlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnICBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBwcmV2aWV3IFNpZ25lZCBwcmV2aWV3LlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gcmVuZGVyZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiByZW5kZXJfY2FwYWNpdHlfcmV2aWV3KCBjb25maWcsIHByZXZpZXcgKSB7XG5cdFx0dmFyIGhvc3QgPSBnZXRfaW5zcGVjdG9yX2hvc3QoKTtcblx0XHR2YXIgdGFyZ2V0ID0gaG9zdCA/IGhvc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbnNwZWN0b3ItZm9ybV0nICkgOiBudWxsO1xuXHRcdHZhciBpbmNyZWFzZSA9ICdpbmNyZWFzZScgPT09IHByZXZpZXcub3BlcmF0aW9uO1xuXHRcdHZhciBkZWxldGVfYWN0aW9uID0gJ2RlbGV0ZScgPT09IHByZXZpZXcuZGVjcmVhc2VfYWN0aW9uO1xuXHRcdHZhciB2aWV3O1xuXG5cdFx0aWYgKCAhIHRhcmdldCApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0dmlldyA9IHtcblx0XHRcdGNvbnRleHRfbGFiZWw6ICggY29uZmlnLmkxOG4ucmVzb3VyY2VfaWQgfHwgJ0lEJyApICsgJzogJyArIFN0cmluZyggcHJldmlldy5yZXNvdXJjZV9pZCApLFxuXHRcdFx0Y3VycmVudF9jYXBhY2l0eTogTnVtYmVyKCBwcmV2aWV3LmN1cnJlbnRfY2FwYWNpdHkgKSxcblx0XHRcdGRlY3JlYXNlX2FjdGlvbjogcHJldmlldy5kZWNyZWFzZV9hY3Rpb24gfHwgJ2RldGFjaCcsXG5cdFx0XHRkZWxldGVfaGFzX2Jvb2tpbmdzOiB0cnVlID09PSBwcmV2aWV3LmRlbGV0ZV9oYXNfYm9va2luZ3MsXG5cdFx0XHRkZXNjcmlwdGlvbjogY29uZmlnLmkxOG4ucmV2aWV3X2NhcGFjaXR5X2hlbHAgfHwgJycsXG5cdFx0XHRtb2RlOiAnY2FwYWNpdHlfcmV2aWV3Jyxcblx0XHRcdG9wZXJhdGlvbjogcHJldmlldy5vcGVyYXRpb24sXG5cdFx0XHRvcGVyYXRpb25faGVscDogaW5jcmVhc2UgPyBjb25maWcuaTE4bi5jcmVhdGVfdW5pdHNfaGVscCB8fCAnJyA6ICggZGVsZXRlX2FjdGlvbiA/IGNvbmZpZy5pMThuLmRlbGV0ZV91bml0c19oZWxwIHx8ICcnIDogY29uZmlnLmkxOG4uc2VsZWN0X2RldGFjaF9oZWxwIHx8ICcnICksXG5cdFx0XHRvcGVyYXRpb25fbGFiZWw6IGluY3JlYXNlXG5cdFx0XHRcdD8gZ2V0X2NhcGFjaXR5X2NvdW50X2xhYmVsKCBjb25maWcsICdjcmVhdGVfbmV3X3VuaXQnLCAnY3JlYXRlX25ld191bml0cycsIE51bWJlciggcHJldmlldy5jcmVhdGVfY291bnQgKSApXG5cdFx0XHRcdDogZ2V0X2NhcGFjaXR5X2NvdW50X2xhYmVsKCBjb25maWcsICdrZWVwX2V4aXN0aW5nX3VuaXQnLCAna2VlcF9leGlzdGluZ191bml0cycsIE51bWJlciggcHJldmlldy50YXJnZXRfY2FwYWNpdHkgKSApLFxuXHRcdFx0cmVzb3VyY2VzOiBpbmNyZWFzZSA/IHByZXZpZXcuY3JlYXRlX3Jlc291cmNlcyB8fCBbXSA6IHByZXZpZXcuZGV0YWNoX3Jlc291cmNlcyB8fCBbXSxcblx0XHRcdHRhcmdldF9jYXBhY2l0eTogTnVtYmVyKCBwcmV2aWV3LnRhcmdldF9jYXBhY2l0eSApLFxuXHRcdFx0dGl0bGU6IGNvbmZpZy5pMThuLnJldmlld19jYXBhY2l0eV90aXRsZSB8fCAnJ1xuXHRcdH07XG5cdFx0dGFyZ2V0LmlubmVySFRNTCA9IHJlbmRlcl9jb21wb25lbnQoIGNvbmZpZywgJ2luc3BlY3Rvcl9jYXBhY2l0eScsIHsgaTE4bjogY29uZmlnLmkxOG4gfHwge30sIHZpZXc6IHZpZXcgfSApO1xuXHRcdGlmICggISB0YXJnZXQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1jYXBhY2l0eS1mb3JtXScgKSApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aW5zcGVjdG9yX21vZGUgPSAnY2FwYWNpdHlfcmV2aWV3Jztcblx0XHRpbnNwZWN0b3JfcmVzb3VyY2VfaWQgPSBOdW1iZXIoIHByZXZpZXcucmVzb3VyY2VfaWQgKSB8fCAwO1xuXHRcdGluc3BlY3Rvcl9yZXZpZXdfdG9rZW4gPSBTdHJpbmcoIHByZXZpZXcucmV2aWV3X3Rva2VuIHx8ICcnICk7XG5cdFx0aW5zcGVjdG9yX2NhcGFjaXR5X2RlY3JlYXNlX2FjdGlvbiA9IHByZXZpZXcuZGVjcmVhc2VfYWN0aW9uIHx8ICdkZXRhY2gnO1xuXHRcdGluc3BlY3Rvcl9kaXJ0eSA9IHRydWU7XG5cdFx0c2V0X2luc3BlY3Rvcl9zdGF0ZSggJ2Zvcm0nLCAnJyApO1xuXHRcdGNvbmZpZ3VyZV9pbnNwZWN0b3JfZm9vdGVyKCAnd3BiY19jYXRhbG9nX2Jvb2tpbmdfcmVzb3VyY2VfY2FwYWNpdHlfZm9ybScsIGNvbmZpZy5pMThuLmFwcGx5X2NhcGFjaXR5X2NoYW5nZSB8fCAnJywgZGVsZXRlX2FjdGlvbiwgZGVsZXRlX2FjdGlvbiApO1xuXHRcdGlmICggZGVsZXRlX2FjdGlvbiApIHtcblx0XHRcdHZhciBhY2tub3dsZWRnZW1lbnQgPSB0YXJnZXQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1jYXBhY2l0eS1kZWxldGUtYWNrbm93bGVkZ2VtZW50XScgKTtcblx0XHRcdHB1bHNlX2RlbGV0ZV9hY2tub3dsZWRnZW1lbnQoIGFja25vd2xlZGdlbWVudCA/IGFja25vd2xlZGdlbWVudC5jbG9zZXN0KCAnLndwYmNfYm9va2luZ19yZXNvdXJjZXNfX2RlbGV0ZV9hY2tub3dsZWRnZW1lbnQnICkgOiBudWxsICk7XG5cdFx0fVxuXHRcdHZhciBjYW5jZWxfYnV0dG9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1pbnNwZWN0b3ItY2FuY2VsXScgKTtcblx0XHRpZiAoIGNhbmNlbF9idXR0b24gKSB7XG5cdFx0XHRjYW5jZWxfYnV0dG9uLnRleHRDb250ZW50ID0gY29uZmlnLmkxOG4uYmFjayB8fCAnJztcblx0XHR9XG5cdFx0Zm9jdXNfaW5zcGVjdG9yX2hlYWRpbmcoIHRhcmdldC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWNhcGFjaXR5LWZvcm1dJyApICk7XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTeW5jaHJvbml6ZSB0aGUgUmVzb3VyY2UgaW1hZ2UgcHJldmlldyBhZnRlciBNZWRpYSBMaWJyYXJ5IGNoYW5nZXMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGZpZWxkIFBpY3R1cmUgVVJMIGZpZWxkLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3luY2hyb25pemVfaW5zcGVjdG9yX2ltYWdlKCBmaWVsZCApIHtcblx0XHR2YXIgZmllbGRfd3JhcCA9IGZpZWxkID8gZmllbGQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1maWVsZC13cmFwXScgKSA6IG51bGw7XG5cdFx0dmFyIHByZXZpZXcgPSBmaWVsZF93cmFwID8gZmllbGRfd3JhcC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWltYWdlLXByZXZpZXddJyApIDogbnVsbDtcblx0XHR2YXIgcGxhY2Vob2xkZXIgPSBmaWVsZF93cmFwID8gZmllbGRfd3JhcC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWltYWdlLXBsYWNlaG9sZGVyXScgKSA6IG51bGw7XG5cdFx0dmFyIHJlbW92ZV9idXR0b24gPSBmaWVsZF93cmFwID8gZmllbGRfd3JhcC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLXJlbW92ZS1pbWFnZV0nICkgOiBudWxsO1xuXHRcdHZhciBwaWN0dXJlX3VybCA9IGZpZWxkID8gU3RyaW5nKCBmaWVsZC52YWx1ZSB8fCAnJyApLnRyaW0oKSA6ICcnO1xuXG5cdFx0aWYgKCBwcmV2aWV3ICkge1xuXHRcdFx0cHJldmlldy5zcmMgPSBwaWN0dXJlX3VybDtcblx0XHRcdHByZXZpZXcuaGlkZGVuID0gISBwaWN0dXJlX3VybDtcblx0XHR9XG5cdFx0aWYgKCBwbGFjZWhvbGRlciApIHtcblx0XHRcdHBsYWNlaG9sZGVyLmhpZGRlbiA9ICEhIHBpY3R1cmVfdXJsO1xuXHRcdH1cblx0XHRpZiAoIHJlbW92ZV9idXR0b24gKSB7XG5cdFx0XHRyZW1vdmVfYnV0dG9uLmRpc2FibGVkID0gISBwaWN0dXJlX3VybDtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogU3luY2hyb25pemUgb25lIG51bWVyaWMgc2xpZGVyIHdpdGggaXRzIHByZWNpc2UgbnVtYmVyIGZpZWxkLlxuXHQgKlxuXHQgKiBTdWdnZXN0ZWQgc2xpZGVyIGJvdW5kcyByZW1haW4gY29udmVuaWVudCBmb3Igb3JkaW5hcnkgdmFsdWVzLiBQcmljZSBrZWVwc1xuXHQgKiBpdHMgcHJvZHVjdC1kZWZpbmVkIDAtMTAwMCBzbGlkZXIgd2hpbGUgdGhlIGF1dGhvcml0YXRpdmUgbnVtYmVyIGZpZWxkIGNhblxuXHQgKiBzdGlsbCBwcmVzZXJ2ZSBhIGxlZ2FjeSBwcmljZSBhYm92ZSAxMDAwLiBPdGhlciBudW1lcmljIGNvbnRyb2xzIGNhbiBleHBhbmRcblx0ICogdG8gcmVwcmVzZW50IHN0b3JlZCB2YWx1ZXMgb3V0c2lkZSB0aGVpciBzdWdnZXN0ZWQgcmFuZ2UuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBmaWVsZF9rZXkgTnVtZXJpYyBpbnNwZWN0b3IgZmllbGQga2V5LlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3luY2hyb25pemVfaW5zcGVjdG9yX251bWVyaWNfcmFuZ2UoIGZpZWxkX2tleSApIHtcblx0XHR2YXIgbnVtYmVyX2ZpZWxkID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1maWVsZD1cIicgKyBmaWVsZF9rZXkgKyAnXCJdW3R5cGU9XCJudW1iZXJcIl0nICk7XG5cdFx0dmFyIHJhbmdlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1yYW5nZT1cIicgKyBmaWVsZF9rZXkgKyAnXCJdJyApO1xuXHRcdHZhciBudW1iZXJfdmFsdWU7XG5cdFx0dmFyIGRlZmF1bHRfbWluO1xuXHRcdHZhciBkZWZhdWx0X21heDtcblx0XHR2YXIgaGFyZF9taW47XG5cdFx0dmFyIGhhcmRfbWF4O1xuXHRcdHZhciByYW5nZV9taW47XG5cdFx0dmFyIHJhbmdlX21heDtcblxuXHRcdGlmICggISBudW1iZXJfZmllbGQgfHwgISByYW5nZSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRudW1iZXJfdmFsdWUgPSBOdW1iZXIoIG51bWJlcl9maWVsZC52YWx1ZSApO1xuXHRcdGlmICggISBpc0Zpbml0ZSggbnVtYmVyX3ZhbHVlICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0ZGVmYXVsdF9taW4gPSBOdW1iZXIoIHJhbmdlLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLXJhbmdlLWRlZmF1bHQtbWluJyApICk7XG5cdFx0ZGVmYXVsdF9tYXggPSBOdW1iZXIoIHJhbmdlLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLXJhbmdlLWRlZmF1bHQtbWF4JyApICk7XG5cdFx0aGFyZF9taW4gPSAnJyA9PT0gU3RyaW5nKCBudW1iZXJfZmllbGQuZ2V0QXR0cmlidXRlKCAnbWluJyApIHx8ICcnICkgPyBudWxsIDogTnVtYmVyKCBudW1iZXJfZmllbGQuZ2V0QXR0cmlidXRlKCAnbWluJyApICk7XG5cdFx0aGFyZF9tYXggPSAnJyA9PT0gU3RyaW5nKCBudW1iZXJfZmllbGQuZ2V0QXR0cmlidXRlKCAnbWF4JyApIHx8ICcnICkgPyBudWxsIDogTnVtYmVyKCBudW1iZXJfZmllbGQuZ2V0QXR0cmlidXRlKCAnbWF4JyApICk7XG5cdFx0aWYgKCAnYmFzZV9jb3N0JyA9PT0gZmllbGRfa2V5ICkge1xuXHRcdFx0cmFuZ2VfbWluID0gaXNGaW5pdGUoIGRlZmF1bHRfbWluICkgPyBkZWZhdWx0X21pbiA6IDA7XG5cdFx0XHRyYW5nZV9tYXggPSBpc0Zpbml0ZSggZGVmYXVsdF9tYXggKSA/IGRlZmF1bHRfbWF4IDogMTAwMDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmFuZ2VfbWluID0gbnVsbCAhPT0gaGFyZF9taW4gJiYgaXNGaW5pdGUoIGhhcmRfbWluIClcblx0XHRcdFx0PyBoYXJkX21pblxuXHRcdFx0XHQ6IE1hdGgubWluKCBpc0Zpbml0ZSggZGVmYXVsdF9taW4gKSA/IGRlZmF1bHRfbWluIDogbnVtYmVyX3ZhbHVlLCBudW1iZXJfdmFsdWUgKTtcblx0XHRcdHJhbmdlX21heCA9IG51bGwgIT09IGhhcmRfbWF4ICYmIGlzRmluaXRlKCBoYXJkX21heCApXG5cdFx0XHRcdD8gaGFyZF9tYXhcblx0XHRcdFx0OiBNYXRoLm1heCggaXNGaW5pdGUoIGRlZmF1bHRfbWF4ICkgPyBkZWZhdWx0X21heCA6IG51bWJlcl92YWx1ZSwgbnVtYmVyX3ZhbHVlICk7XG5cdFx0fVxuXG5cdFx0cmFuZ2UubWluID0gU3RyaW5nKCByYW5nZV9taW4gKTtcblx0XHRyYW5nZS5tYXggPSBTdHJpbmcoIHJhbmdlX21heCApO1xuXHRcdHJhbmdlLnZhbHVlID0gU3RyaW5nKCBudW1iZXJfdmFsdWUgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTeW5jaHJvbml6ZSBldmVyeSByZW5kZXJlZCBpbnNwZWN0b3IgbnVtZXJpYyBzbGlkZXIuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzeW5jaHJvbml6ZV9hbGxfaW5zcGVjdG9yX251bWVyaWNfcmFuZ2VzKCkge1xuXHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtcmFuZ2VdJyApLmZvckVhY2goIGZ1bmN0aW9uICggcmFuZ2UgKSB7XG5cdFx0XHRzeW5jaHJvbml6ZV9pbnNwZWN0b3JfbnVtZXJpY19yYW5nZSggcmFuZ2UuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtcmFuZ2UnICkgfHwgJycgKTtcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogQ29weSBhIHNsaWRlciB2YWx1ZSBpbnRvIGl0cyBhdXRob3JpdGF0aXZlIG51bWJlciBmaWVsZC5cblx0ICpcblx0ICogVGhlIG51bWJlciBmaWVsZCByZW1haW5zIHRoZSBvbmx5IHNlcmlhbGl6ZWQgY29udHJvbCBhbmQgZW1pdHMgb25lIG5hdGl2ZVxuXHQgKiBpbnB1dCBldmVudCBzbyB2YWxpZGF0aW9uIGFuZCBkaXJ0eS1zdGF0ZSBiZWhhdmlvciBzdGF5IGNlbnRyYWxpemVkLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSByYW5nZSBOdW1lcmljIHJhbmdlIGNvbnRyb2wuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzeW5jaHJvbml6ZV9pbnNwZWN0b3JfbnVtYmVyX2Zyb21fcmFuZ2UoIHJhbmdlICkge1xuXHRcdHZhciBmaWVsZF9rZXkgPSByYW5nZSA/IHJhbmdlLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLXJhbmdlJyApIHx8ICcnIDogJyc7XG5cdFx0dmFyIG51bWJlcl9maWVsZCA9IGZpZWxkX2tleSA/IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtZmllbGQ9XCInICsgZmllbGRfa2V5ICsgJ1wiXVt0eXBlPVwibnVtYmVyXCJdJyApIDogbnVsbDtcblxuXHRcdGlmICggISBudW1iZXJfZmllbGQgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdG51bWJlcl9maWVsZC52YWx1ZSA9IHJhbmdlLnZhbHVlO1xuXHRcdG51bWJlcl9maWVsZC5kaXNwYXRjaEV2ZW50KCBuZXcgRXZlbnQoICdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9ICkgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb25maXJtIHRoYXQgYSBmb3JtIHN1Ym1pdCBvcmlnaW5hdGVkIGZyb20gdGhlIGluc3BlY3RvciBzYXZlIGFjdGlvbi5cblx0ICpcblx0ICogV29yZFByZXNzIE1lZGlhIExpYnJhcnkgY29udHJvbHMgbWF5IHRlbXBvcmFyaWx5IGNvZXhpc3Qgd2l0aCB0aGUgc2lkZWJhclxuXHQgKiBmb3JtLiBSZWplY3RpbmcgdGhlaXIgc3VibWl0dGVycyBwcmV2ZW50cyBhbiBpbWFnZSBpbnNlcnRpb24gZnJvbSBzdGFydGluZ1xuXHQgKiBhIFJlc291cmNlIG11dGF0aW9uLiBUaGUgYWN0aXZlIGluc3BlY3RvciBmaWVsZCBmYWxsYmFjayBwcmVzZXJ2ZXMgbmF0aXZlXG5cdCAqIEVudGVyLWtleSBzdWJtaXNzaW9uIGluIGJyb3dzZXJzIHdpdGhvdXQgU3VibWl0RXZlbnQuc3VibWl0dGVyIHN1cHBvcnQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7U3VibWl0RXZlbnR9IGV2ZW50IEZvcm0gc3VibWlzc2lvbi5cblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZm9ybSAgQWN0aXZlIGluc3BlY3RvciBmb3JtLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIG9ubHkgZm9yIGFuIGludGVudGlvbmFsIGluc3BlY3RvciBzdWJtaXNzaW9uLlxuXHQgKi9cblx0ZnVuY3Rpb24gaXNfZXhwZWN0ZWRfaW5zcGVjdG9yX3N1Ym1pdCggZXZlbnQsIGZvcm0gKSB7XG5cdFx0dmFyIHN1Ym1pdHRlciA9IGV2ZW50LnN1Ym1pdHRlciB8fCBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuXG5cdFx0aWYgKCBzdWJtaXR0ZXIgJiYgc3VibWl0dGVyLm1hdGNoZXMgJiYgc3VibWl0dGVyLm1hdGNoZXMoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5zcGVjdG9yLXNhdmVdJyApICkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuICEgZXZlbnQuc3VibWl0dGVyXG5cdFx0XHQmJiBzdWJtaXR0ZXJcblx0XHRcdCYmIGZvcm0uY29udGFpbnMoIHN1Ym1pdHRlciApXG5cdFx0XHQmJiBzdWJtaXR0ZXIubWF0Y2hlc1xuXHRcdFx0JiYgc3VibWl0dGVyLm1hdGNoZXMoICdpbnB1dDpub3QoW3R5cGU9XCJidXR0b25cIl0pOm5vdChbdHlwZT1cInN1Ym1pdFwiXSksIHNlbGVjdCcgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXBvcnQgaW5zcGVjdG9yIHZhbGlkaXR5IHdpdGhvdXQgcmVqZWN0aW5nIGFuIGV4aXN0aW5nIGRlY2ltYWwgcHJpY2UuXG5cdCAqXG5cdCAqIFByaWNlIGNvbnRyb2xzIGludGVudGlvbmFsbHkgdXNlIGEgb25lLXVuaXQgc3Bpbm5lciBzdGVwLiBFeGlzdGluZyBwcmljZXNcblx0ICogbWF5IHN0aWxsIGNvbnRhaW4gZGVjaW1hbHMsIHNvIHRoZWlyIHN0ZXAgY29uc3RyYWludCBpcyByZWxheGVkIG9ubHkgd2hpbGVcblx0ICogbmF0aXZlIGZvcm0gdmFsaWRpdHkgaXMgZXZhbHVhdGVkLiBTZXJ2ZXItc2lkZSBwcmljZSB2YWxpZGF0aW9uIHJlbWFpbnMgdGhlXG5cdCAqIGF1dGhvcml0YXRpdmUgYm91bmRhcnkuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEZvcm1FbGVtZW50fSBmb3JtIEluc3BlY3RvciBmb3JtLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIGZvcm0gcGFzc2VzIG5hdGl2ZSB2YWxpZGl0eSBjaGVja3MuXG5cdCAqL1xuXHRmdW5jdGlvbiByZXBvcnRfaW5zcGVjdG9yX3ZhbGlkaXR5KCBmb3JtICkge1xuXHRcdHZhciBwcmljZV9maWVsZHMgPSBmb3JtLnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtZmllbGQ9XCJiYXNlX2Nvc3RcIl0sIFtkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1idWxrLXZhbHVlPVwiYmFzZV9jb3N0XCJdJyApO1xuXHRcdHZhciBwcmljZV9zdGVwcyA9IFtdO1xuXHRcdHZhciBpc192YWxpZDtcblxuXHRcdHByaWNlX2ZpZWxkcy5mb3JFYWNoKCBmdW5jdGlvbiAoIHByaWNlX2ZpZWxkICkge1xuXHRcdFx0cHJpY2Vfc3RlcHMucHVzaCgge1xuXHRcdFx0XHRmaWVsZDogcHJpY2VfZmllbGQsXG5cdFx0XHRcdHN0ZXA6IHByaWNlX2ZpZWxkLmdldEF0dHJpYnV0ZSggJ3N0ZXAnIClcblx0XHRcdH0gKTtcblx0XHRcdHByaWNlX2ZpZWxkLnNldEF0dHJpYnV0ZSggJ3N0ZXAnLCAnYW55JyApO1xuXHRcdH0gKTtcblxuXHRcdGlzX3ZhbGlkID0gZm9ybS5yZXBvcnRWYWxpZGl0eSgpO1xuXHRcdHByaWNlX3N0ZXBzLmZvckVhY2goIGZ1bmN0aW9uICggcHJpY2Vfc3RlcCApIHtcblx0XHRcdGlmICggbnVsbCA9PT0gcHJpY2Vfc3RlcC5zdGVwICkge1xuXHRcdFx0XHRwcmljZV9zdGVwLmZpZWxkLnJlbW92ZUF0dHJpYnV0ZSggJ3N0ZXAnICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRwcmljZV9zdGVwLmZpZWxkLnNldEF0dHJpYnV0ZSggJ3N0ZXAnLCBwcmljZV9zdGVwLnN0ZXAgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gaXNfdmFsaWQ7XG5cdH1cblxuXHQvKipcblx0ICogU2F2ZSB0aGUgYWN0aXZlIGluc3BlY3RvciB0aHJvdWdoIGl0cyBpbmRlcGVuZGVudCBtdXRhdGlvbiBlbmRwb2ludC5cblx0ICpcblx0ICogQHBhcmFtIHtTdWJtaXRFdmVudH0gZXZlbnQgRm9ybSBzdWJtaXNzaW9uLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBjb25maWcgQ2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3VibWl0X2luc3BlY3RvciggZXZlbnQsIGNvbmZpZyApIHtcblx0XHR2YXIgZm9ybSA9IGV2ZW50LnRhcmdldDtcblx0XHR2YXIgc2F2ZV9idXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1zYXZlXScgKTtcblx0XHR2YXIgY2FuY2VsX2J1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5zcGVjdG9yLWNhbmNlbF0nICk7XG5cdFx0dmFyIG11dGF0aW9uX3JlcXVlc3Rfc2VxdWVuY2U7XG5cdFx0dmFyIGZpZWxkcztcblx0XHR2YXIgYWN0aW9uO1xuXHRcdHZhciBzdWJtaXR0ZWRfbW9kZTtcblx0XHR2YXIgcmVxdWVzdF92YWx1ZXM7XG5cdFx0dmFyIGNvbnRyb2xfZGlzYWJsZWRfc3RhdGVzID0gW107XG5cdFx0dmFyIHN1Y2Nlc3NfbWVzc2FnZTtcblx0XHR2YXIgc3VjY2Vzc19tZXNzYWdlX2lzX2dsb2JhbDtcblx0XHR2YXIgc3VibWl0dGVkX2Zvcm1faXNfYWN0aXZlO1xuXG5cdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRpZiAoICEgaXNfZXhwZWN0ZWRfaW5zcGVjdG9yX3N1Ym1pdCggZXZlbnQsIGZvcm0gKSB8fCAoIHNhdmVfYnV0dG9uICYmIHNhdmVfYnV0dG9uLmNsYXNzTGlzdC5jb250YWlucyggJ2lzLWJ1c3knICkgKSB8fCAhIHJlcG9ydF9pbnNwZWN0b3JfdmFsaWRpdHkoIGZvcm0gKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0bXV0YXRpb25fcmVxdWVzdF9zZXF1ZW5jZSA9ICsraW5zcGVjdG9yX211dGF0aW9uX3JlcXVlc3Rfc2VxdWVuY2U7XG5cdFx0aW5zcGVjdG9yX211dGF0aW9uX2luX3Byb2dyZXNzID0gdHJ1ZTtcblx0XHRmaWVsZHMgPSBKU09OLnBhcnNlKCBzZXJpYWxpemVfaW5zcGVjdG9yX2ZpZWxkcygpIHx8ICd7fScgKTtcblx0XHRhY3Rpb24gPSAnY3JlYXRlJyA9PT0gaW5zcGVjdG9yX21vZGUgPyBjb25maWcuaW5zcGVjdG9yX2NyZWF0ZV9hY3Rpb24gOiBjb25maWcuaW5zcGVjdG9yX3VwZGF0ZV9hY3Rpb247XG5cdFx0c3VibWl0dGVkX21vZGUgPSBpbnNwZWN0b3JfbW9kZTtcblx0XHRyZXF1ZXN0X3ZhbHVlcyA9IHsgZmllbGRzOiBKU09OLnN0cmluZ2lmeSggZmllbGRzICkgfTtcblx0XHRpZiAoICdlZGl0JyA9PT0gaW5zcGVjdG9yX21vZGUgKSB7XG5cdFx0XHRyZXF1ZXN0X3ZhbHVlcy5yZXNvdXJjZV9pZCA9IGluc3BlY3Rvcl9yZXNvdXJjZV9pZDtcblx0XHR9XG5cdFx0aWYgKCBzYXZlX2J1dHRvbiApIHtcblx0XHRcdHNhdmVfYnV0dG9uLmRpc2FibGVkID0gdHJ1ZTtcblx0XHRcdHNhdmVfYnV0dG9uLmNsYXNzTGlzdC5hZGQoICdpcy1idXN5JyApO1xuXHRcdH1cblx0XHRpZiAoIGNhbmNlbF9idXR0b24gKSB7XG5cdFx0XHRjYW5jZWxfYnV0dG9uLmRpc2FibGVkID0gdHJ1ZTtcblx0XHR9XG5cdFx0Zm9ybS5jbGFzc0xpc3QuYWRkKCAnaXMtc2F2aW5nJyApO1xuXHRcdGZvcm0uc2V0QXR0cmlidXRlKCAnYXJpYS1idXN5JywgJ3RydWUnICk7XG5cdFx0Zm9ybS5xdWVyeVNlbGVjdG9yQWxsKCAnaW5wdXQsIHNlbGVjdCwgdGV4dGFyZWEsIGJ1dHRvbicgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGNvbnRyb2wgKSB7XG5cdFx0XHRjb250cm9sX2Rpc2FibGVkX3N0YXRlcy5wdXNoKCB7IGNvbnRyb2w6IGNvbnRyb2wsIGRpc2FibGVkOiBjb250cm9sLmRpc2FibGVkIH0gKTtcblx0XHRcdGNvbnRyb2wuZGlzYWJsZWQgPSB0cnVlO1xuXHRcdH0gKTtcblxuXHRcdHJlcXVlc3RfaW5zcGVjdG9yKCBjb25maWcsIGFjdGlvbiwgcmVxdWVzdF92YWx1ZXMgKS50aGVuKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0aWYgKCBtdXRhdGlvbl9yZXF1ZXN0X3NlcXVlbmNlICE9PSBpbnNwZWN0b3JfbXV0YXRpb25fcmVxdWVzdF9zZXF1ZW5jZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHJlc3BvbnNlIHx8IHRydWUgIT09IHJlc3BvbnNlLnN1Y2Nlc3MgfHwgISByZXNwb25zZS5kYXRhICkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoIGdldF9pbnNwZWN0b3JfcmVzcG9uc2VfbWVzc2FnZSggcmVzcG9uc2UsIGNvbmZpZy5pMThuLmluc3BlY3Rvcl9zYXZlX2ZhaWxlZCApICk7XG5cdFx0XHR9XG5cdFx0XHRwZW5kaW5nX2hpZ2hsaWdodF9pZHMgPSBBcnJheS5pc0FycmF5KCByZXNwb25zZS5kYXRhLnJlc291cmNlX2lkcyApID8gcmVzcG9uc2UuZGF0YS5yZXNvdXJjZV9pZHMubWFwKCBTdHJpbmcgKSA6IFtdO1xuXHRcdFx0aW5zcGVjdG9yX2RpcnR5ID0gZmFsc2U7XG5cdFx0XHRzdWNjZXNzX21lc3NhZ2UgPSBnZXRfaW5zcGVjdG9yX3Jlc3BvbnNlX21lc3NhZ2UoIHJlc3BvbnNlLCAnJyApO1xuXHRcdFx0c3VjY2Vzc19tZXNzYWdlX2lzX2dsb2JhbCA9IHNob3dfYWRtaW5fbWVzc2FnZSggc3VjY2Vzc19tZXNzYWdlLCAnc3VjY2VzcycsIDMwMDAgKTtcblx0XHRcdHN1Ym1pdHRlZF9mb3JtX2lzX2FjdGl2ZSA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jb250YWlucyggZm9ybSApO1xuXHRcdFx0aWYgKCAnY3JlYXRlJyA9PT0gc3VibWl0dGVkX21vZGUgKSB7XG5cdFx0XHRcdGluc3BlY3Rvcl9tdXRhdGlvbl9pbl9wcm9ncmVzcyA9IGZhbHNlO1xuXHRcdFx0XHRpZiAoIHN1Ym1pdHRlZF9mb3JtX2lzX2FjdGl2ZSApIHtcblx0XHRcdFx0XHRjbG9zZV9pbnNwZWN0b3IoIGNvbmZpZywgZmFsc2UgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIGNhdGFsb2dfY29udHJvbGxlciApIHtcblx0XHRcdFx0XHRjYXRhbG9nX2NvbnRyb2xsZXIubG9hZCggeyBwYWdlX251bWJlcjogMSB9ICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHN1Ym1pdHRlZF9mb3JtX2lzX2FjdGl2ZSApIHtcblx0XHRcdFx0aWYgKCBjYXRhbG9nX2NvbnRyb2xsZXIgKSB7XG5cdFx0XHRcdFx0Y2F0YWxvZ19jb250cm9sbGVyLmxvYWQoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpbnNwZWN0b3JfbXV0YXRpb25faW5fcHJvZ3Jlc3MgPSBmYWxzZTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCByZXNwb25zZS5kYXRhLnNjaGVtYSAmJiByZW5kZXJfaW5zcGVjdG9yX3NjaGVtYSggY29uZmlnLCByZXNwb25zZS5kYXRhLnNjaGVtYSwgZmFsc2UgKSApIHtcblx0XHRcdFx0Zm9ybSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtaW5zcGVjdG9yLWZvcm1dJyApO1xuXHRcdFx0XHRzaG93X2luc3BlY3Rvcl9tZXNzYWdlKCBmb3JtLCBzdWNjZXNzX21lc3NhZ2VfaXNfZ2xvYmFsID8gJycgOiBzdWNjZXNzX21lc3NhZ2UsIGZhbHNlICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRmb3JtLmNsYXNzTGlzdC5yZW1vdmUoICdpcy1zYXZpbmcnICk7XG5cdFx0XHRcdGZvcm0ucmVtb3ZlQXR0cmlidXRlKCAnYXJpYS1idXN5JyApO1xuXHRcdFx0XHRjb250cm9sX2Rpc2FibGVkX3N0YXRlcy5mb3JFYWNoKCBmdW5jdGlvbiAoIGNvbnRyb2xfc3RhdGUgKSB7XG5cdFx0XHRcdFx0aWYgKCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY29udGFpbnMoIGNvbnRyb2xfc3RhdGUuY29udHJvbCApICkge1xuXHRcdFx0XHRcdFx0Y29udHJvbF9zdGF0ZS5jb250cm9sLmRpc2FibGVkID0gY29udHJvbF9zdGF0ZS5kaXNhYmxlZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0aWYgKCBzYXZlX2J1dHRvbiApIHtcblx0XHRcdFx0XHRzYXZlX2J1dHRvbi5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtYnVzeScgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIGNhbmNlbF9idXR0b24gKSB7XG5cdFx0XHRcdFx0Y2FuY2VsX2J1dHRvbi5kaXNhYmxlZCA9IGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGluc3BlY3Rvcl9vcmlnaW5hbF9maWVsZHMgPSBzZXJpYWxpemVfaW5zcGVjdG9yX2ZpZWxkcygpO1xuXHRcdFx0XHRzeW5jaHJvbml6ZV9pbnNwZWN0b3JfZGlydHlfc3RhdGUoKTtcblx0XHRcdFx0c2hvd19pbnNwZWN0b3JfbWVzc2FnZSggZm9ybSwgc3VjY2Vzc19tZXNzYWdlX2lzX2dsb2JhbCA/ICcnIDogc3VjY2Vzc19tZXNzYWdlLCBmYWxzZSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjYXRhbG9nX2NvbnRyb2xsZXIgKSB7XG5cdFx0XHRcdGNhdGFsb2dfY29udHJvbGxlci5sb2FkKCk7XG5cdFx0XHR9XG5cdFx0XHRpbnNwZWN0b3JfbXV0YXRpb25faW5fcHJvZ3Jlc3MgPSBmYWxzZTtcblx0XHR9ICkuY2F0Y2goIGZ1bmN0aW9uICggZXJyb3IgKSB7XG5cdFx0XHRpZiAoIG11dGF0aW9uX3JlcXVlc3Rfc2VxdWVuY2UgIT09IGluc3BlY3Rvcl9tdXRhdGlvbl9yZXF1ZXN0X3NlcXVlbmNlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpbnNwZWN0b3JfbXV0YXRpb25faW5fcHJvZ3Jlc3MgPSBmYWxzZTtcblx0XHRcdHZhciBtZXNzYWdlID0gZXJyb3IgJiYgZXJyb3IubWVzc2FnZSA/IGVycm9yLm1lc3NhZ2UgOiBjb25maWcuaTE4bi5pbnNwZWN0b3Jfc2F2ZV9mYWlsZWQgfHwgJyc7XG5cdFx0XHRpZiAoICEgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNvbnRhaW5zKCBmb3JtICkgKSB7XG5cdFx0XHRcdHNob3dfYWRtaW5fbWVzc2FnZSggbWVzc2FnZSwgJ2Vycm9yJywgNTAwMCApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRmb3JtLmNsYXNzTGlzdC5yZW1vdmUoICdpcy1zYXZpbmcnICk7XG5cdFx0XHRmb3JtLnJlbW92ZUF0dHJpYnV0ZSggJ2FyaWEtYnVzeScgKTtcblx0XHRcdHNob3dfaW5zcGVjdG9yX21lc3NhZ2UoIGZvcm0sIG1lc3NhZ2UsIHRydWUgKTtcblx0XHRcdGNvbnRyb2xfZGlzYWJsZWRfc3RhdGVzLmZvckVhY2goIGZ1bmN0aW9uICggY29udHJvbF9zdGF0ZSApIHtcblx0XHRcdFx0aWYgKCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY29udGFpbnMoIGNvbnRyb2xfc3RhdGUuY29udHJvbCApICkge1xuXHRcdFx0XHRcdGNvbnRyb2xfc3RhdGUuY29udHJvbC5kaXNhYmxlZCA9IGNvbnRyb2xfc3RhdGUuZGlzYWJsZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdGlmICggc2F2ZV9idXR0b24gKSB7XG5cdFx0XHRcdHNhdmVfYnV0dG9uLmNsYXNzTGlzdC5yZW1vdmUoICdpcy1idXN5JyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjYW5jZWxfYnV0dG9uICkge1xuXHRcdFx0XHRjYW5jZWxfYnV0dG9uLmRpc2FibGVkID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRzeW5jaHJvbml6ZV9pbnNwZWN0b3JfZGlydHlfc3RhdGUoKTtcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogU3VibWl0IGJ1bGssIHBlcm1hbmVudC1kZWxldGUsIGFuZCBjYXBhY2l0eSByZXZpZXcgaW5zcGVjdG9yIHN0YXRlcy5cblx0ICpcblx0ICogTXV0YXRpb25zIHJlbWFpbiBpbXBvc3NpYmxlIGZyb20gc2VsZWN0aW9uIGFsb25lOiBidWxrIGVkaXRpbmcgcmVxdWlyZXMgYVxuXHQgKiBzaWduZWQgcHJldmlldywgYW5kIGRlbGV0aW9uIGFkZGl0aW9uYWxseSByZXF1aXJlcyBleHBsaWNpdCBhY2tub3dsZWRnZW1lbnQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7U3VibWl0RXZlbnR9IGV2ZW50ICBJbnNwZWN0b3IgZm9ybSBzdWJtaXNzaW9uLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBjb25maWcgQ2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3VibWl0X3Jldmlld2VkX2luc3BlY3RvciggZXZlbnQsIGNvbmZpZyApIHtcblx0XHR2YXIgZm9ybSA9IGV2ZW50LnRhcmdldDtcblx0XHR2YXIgc2F2ZV9idXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1zYXZlXScgKTtcblx0XHR2YXIgY2FuY2VsX2J1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5zcGVjdG9yLWNhbmNlbF0nICk7XG5cdFx0dmFyIHJlcXVlc3Rfc2VxdWVuY2U7XG5cdFx0dmFyIGFjdGlvbjtcblx0XHR2YXIgdmFsdWVzO1xuXHRcdHZhciBmYWxsYmFjaztcblx0XHR2YXIgaXNfbXV0YXRpb247XG5cdFx0dmFyIHN1Ym1pdHRlZF9tb2RlO1xuXHRcdHZhciBzdWJtaXR0ZWRfcmVzb3VyY2VfaWRzO1xuXHRcdHZhciBzdWJtaXR0ZWRfdHJhY2tzX3NlbGVjdGlvbjtcblxuXHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0aWYgKCBpbnNwZWN0b3Jfc2VsZWN0aW9uX3N0YWxlIHx8ICEgaXNfZXhwZWN0ZWRfaW5zcGVjdG9yX3N1Ym1pdCggZXZlbnQsIGZvcm0gKSB8fCAoIHNhdmVfYnV0dG9uICYmICggc2F2ZV9idXR0b24uZGlzYWJsZWQgfHwgc2F2ZV9idXR0b24uY2xhc3NMaXN0LmNvbnRhaW5zKCAnaXMtYnVzeScgKSApICkgfHwgISByZXBvcnRfaW5zcGVjdG9yX3ZhbGlkaXR5KCBmb3JtICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHN1Ym1pdHRlZF9tb2RlID0gaW5zcGVjdG9yX21vZGU7XG5cdFx0c3VibWl0dGVkX3Jlc291cmNlX2lkcyA9IGluc3BlY3Rvcl9yZXNvdXJjZV9pZHMuc2xpY2UoKTtcblx0XHRzdWJtaXR0ZWRfdHJhY2tzX3NlbGVjdGlvbiA9IGluc3BlY3Rvcl90cmFja3Nfc2VsZWN0aW9uO1xuXHRcdGlmICggJ2J1bGtfZWRpdCcgPT09IHN1Ym1pdHRlZF9tb2RlICkge1xuXHRcdFx0aW5zcGVjdG9yX2J1bGtfb3BlcmF0aW9ucyA9IGNvbGxlY3RfYnVsa19vcGVyYXRpb25zKCk7XG5cdFx0XHRhY3Rpb24gPSBjb25maWcuYnVsa19wcmV2aWV3X2FjdGlvbjtcblx0XHRcdHZhbHVlcyA9IHsgcmVzb3VyY2VfaWRzOiBKU09OLnN0cmluZ2lmeSggaW5zcGVjdG9yX3Jlc291cmNlX2lkcyApLCBvcGVyYXRpb25zOiBKU09OLnN0cmluZ2lmeSggaW5zcGVjdG9yX2J1bGtfb3BlcmF0aW9ucyApIH07XG5cdFx0XHRmYWxsYmFjayA9IGNvbmZpZy5pMThuLmJ1bGtfcmV2aWV3X2ZhaWxlZDtcblx0XHR9IGVsc2UgaWYgKCAnYnVsa19yZXZpZXcnID09PSBzdWJtaXR0ZWRfbW9kZSApIHtcblx0XHRcdGFjdGlvbiA9IGNvbmZpZy5idWxrX2FwcGx5X2FjdGlvbjtcblx0XHRcdHZhbHVlcyA9IHsgcmVzb3VyY2VfaWRzOiBKU09OLnN0cmluZ2lmeSggaW5zcGVjdG9yX3Jlc291cmNlX2lkcyApLCBvcGVyYXRpb25zOiBKU09OLnN0cmluZ2lmeSggaW5zcGVjdG9yX2J1bGtfb3BlcmF0aW9ucyApLCByZXZpZXdfdG9rZW46IGluc3BlY3Rvcl9yZXZpZXdfdG9rZW4gfTtcblx0XHRcdGZhbGxiYWNrID0gY29uZmlnLmkxOG4uYnVsa19hcHBseV9mYWlsZWQ7XG5cdFx0fSBlbHNlIGlmICggJ2RlbGV0ZV9yZXZpZXcnID09PSBzdWJtaXR0ZWRfbW9kZSApIHtcblx0XHRcdGFjdGlvbiA9IGNvbmZpZy5kZWxldGVfYXBwbHlfYWN0aW9uO1xuXHRcdFx0dmFsdWVzID0geyBhY2tub3dsZWRnZWQ6ICcxJywgcmVzb3VyY2VfaWRzOiBKU09OLnN0cmluZ2lmeSggaW5zcGVjdG9yX3Jlc291cmNlX2lkcyApLCByZXZpZXdfdG9rZW46IGluc3BlY3Rvcl9yZXZpZXdfdG9rZW4gfTtcblx0XHRcdGZhbGxiYWNrID0gY29uZmlnLmkxOG4uZGVsZXRlX2FwcGx5X2ZhaWxlZDtcblx0XHR9IGVsc2UgaWYgKCAnY2FwYWNpdHknID09PSBzdWJtaXR0ZWRfbW9kZSApIHtcblx0XHRcdGFjdGlvbiA9IGNvbmZpZy5jYXBhY2l0eV9wcmV2aWV3X2FjdGlvbjtcblx0XHRcdHZhbHVlcyA9IHsgcmVzb3VyY2VfaWQ6IGluc3BlY3Rvcl9yZXNvdXJjZV9pZCwgdGFyZ2V0X2NhcGFjaXR5OiBpbnNwZWN0b3JfY2FwYWNpdHlfdGFyZ2V0LCBkZXRhY2hfcmVzb3VyY2VfaWRzOiBKU09OLnN0cmluZ2lmeSggaW5zcGVjdG9yX2NhcGFjaXR5X2RldGFjaF9pZHMgKSwgZGVjcmVhc2VfYWN0aW9uOiBpbnNwZWN0b3JfY2FwYWNpdHlfZGVjcmVhc2VfYWN0aW9uIH07XG5cdFx0XHRmYWxsYmFjayA9IGNvbmZpZy5pMThuLmNhcGFjaXR5X3Jldmlld19mYWlsZWQ7XG5cdFx0fSBlbHNlIGlmICggJ2NhcGFjaXR5X3JldmlldycgPT09IHN1Ym1pdHRlZF9tb2RlICkge1xuXHRcdFx0YWN0aW9uID0gY29uZmlnLmNhcGFjaXR5X2FwcGx5X2FjdGlvbjtcblx0XHRcdHZhciBjYXBhY2l0eV9hY2tub3dsZWRnZW1lbnQgPSBmb3JtLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctY2FwYWNpdHktZGVsZXRlLWFja25vd2xlZGdlbWVudF0nICk7XG5cdFx0XHR2YWx1ZXMgPSB7IHJlc291cmNlX2lkOiBpbnNwZWN0b3JfcmVzb3VyY2VfaWQsIHRhcmdldF9jYXBhY2l0eTogaW5zcGVjdG9yX2NhcGFjaXR5X3RhcmdldCwgZGV0YWNoX3Jlc291cmNlX2lkczogSlNPTi5zdHJpbmdpZnkoIGluc3BlY3Rvcl9jYXBhY2l0eV9kZXRhY2hfaWRzICksIGRlY3JlYXNlX2FjdGlvbjogaW5zcGVjdG9yX2NhcGFjaXR5X2RlY3JlYXNlX2FjdGlvbiwgYWNrbm93bGVkZ2VkOiBjYXBhY2l0eV9hY2tub3dsZWRnZW1lbnQgJiYgY2FwYWNpdHlfYWNrbm93bGVkZ2VtZW50LmNoZWNrZWQgPyAnMScgOiAnMCcsIHJldmlld190b2tlbjogaW5zcGVjdG9yX3Jldmlld190b2tlbiB9O1xuXHRcdFx0ZmFsbGJhY2sgPSBjb25maWcuaTE4bi5jYXBhY2l0eV9hcHBseV9mYWlsZWQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpc19tdXRhdGlvbiA9ICdidWxrX3JldmlldycgPT09IHN1Ym1pdHRlZF9tb2RlIHx8ICdkZWxldGVfcmV2aWV3JyA9PT0gc3VibWl0dGVkX21vZGUgfHwgJ2NhcGFjaXR5X3JldmlldycgPT09IHN1Ym1pdHRlZF9tb2RlO1xuXHRcdHJlcXVlc3Rfc2VxdWVuY2UgPSBpc19tdXRhdGlvbiA/ICsraW5zcGVjdG9yX211dGF0aW9uX3JlcXVlc3Rfc2VxdWVuY2UgOiArK2luc3BlY3Rvcl9yZXF1ZXN0X3NlcXVlbmNlO1xuXHRcdGlmICggaXNfbXV0YXRpb24gKSB7XG5cdFx0XHRpbnNwZWN0b3JfbXV0YXRpb25faW5fcHJvZ3Jlc3MgPSB0cnVlO1xuXHRcdH1cblx0XHRpZiAoICdidWxrX3JldmlldycgPT09IHN1Ym1pdHRlZF9tb2RlICYmIGdldF9pbmxpbmVfcmV2aWV3X3dvcmtmbG93KCkgKSB7XG5cdFx0XHRnZXRfaW5saW5lX3Jldmlld193b3JrZmxvdygpLnN5bmNocm9uaXplKCB7IGJ1c3k6IHRydWUsIGNhbl9hcHBseTogdHJ1ZSB9ICk7XG5cdFx0fVxuXHRcdGlmICggJ2RlbGV0ZV9yZXZpZXcnID09PSBzdWJtaXR0ZWRfbW9kZSAmJiBnZXRfZGVsZXRlX3Jldmlld193b3JrZmxvdygpICkge1xuXHRcdFx0Z2V0X2RlbGV0ZV9yZXZpZXdfd29ya2Zsb3coKS5zeW5jaHJvbml6ZSggeyBidXN5OiB0cnVlLCBjYW5fYXBwbHk6IHRydWUgfSApO1xuXHRcdH1cblx0XHRpZiAoIHNhdmVfYnV0dG9uICkge1xuXHRcdFx0c2F2ZV9idXR0b24uZGlzYWJsZWQgPSB0cnVlO1xuXHRcdFx0c2F2ZV9idXR0b24uY2xhc3NMaXN0LmFkZCggJ2lzLWJ1c3knICk7XG5cdFx0fVxuXHRcdGlmICggY2FuY2VsX2J1dHRvbiApIHtcblx0XHRcdGNhbmNlbF9idXR0b24uZGlzYWJsZWQgPSB0cnVlO1xuXHRcdH1cblx0XHRmb3JtLmNsYXNzTGlzdC5hZGQoICdpcy1zYXZpbmcnICk7XG5cdFx0Zm9ybS5zZXRBdHRyaWJ1dGUoICdhcmlhLWJ1c3knLCAndHJ1ZScgKTtcblxuXHRcdHJlcXVlc3RfaW5zcGVjdG9yKCBjb25maWcsIGFjdGlvbiwgdmFsdWVzICkudGhlbiggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdGlmICggcmVxdWVzdF9zZXF1ZW5jZSAhPT0gKCBpc19tdXRhdGlvbiA/IGluc3BlY3Rvcl9tdXRhdGlvbl9yZXF1ZXN0X3NlcXVlbmNlIDogaW5zcGVjdG9yX3JlcXVlc3Rfc2VxdWVuY2UgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHJlc3BvbnNlIHx8IHRydWUgIT09IHJlc3BvbnNlLnN1Y2Nlc3MgfHwgISByZXNwb25zZS5kYXRhICkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoIGdldF9pbnNwZWN0b3JfcmVzcG9uc2VfbWVzc2FnZSggcmVzcG9uc2UsIGZhbGxiYWNrICkgKTtcblx0XHRcdH1cblx0XHRcdGlmICggJ2J1bGtfZWRpdCcgPT09IHN1Ym1pdHRlZF9tb2RlICkge1xuXHRcdFx0XHRpZiAoICEgcmVzcG9uc2UuZGF0YS5wcmV2aWV3IHx8ICEgcmVuZGVyX2J1bGtfcmV2aWV3KCBjb25maWcsIHJlc3BvbnNlLmRhdGEucHJldmlldyApICkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggZmFsbGJhY2sgfHwgJycgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICdjYXBhY2l0eScgPT09IHN1Ym1pdHRlZF9tb2RlICkge1xuXHRcdFx0XHRpZiAoICEgcmVzcG9uc2UuZGF0YS5wcmV2aWV3IHx8ICEgcmVuZGVyX2NhcGFjaXR5X3JldmlldyggY29uZmlnLCByZXNwb25zZS5kYXRhLnByZXZpZXcgKSApIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoIGZhbGxiYWNrIHx8ICcnICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAnYnVsa19yZXZpZXcnID09PSBzdWJtaXR0ZWRfbW9kZSApIHtcblx0XHRcdFx0cGVuZGluZ19oaWdobGlnaHRfaWRzID0gQXJyYXkuaXNBcnJheSggcmVzcG9uc2UuZGF0YS51cGRhdGVkX2lkcyApID8gcmVzcG9uc2UuZGF0YS51cGRhdGVkX2lkcy5tYXAoIFN0cmluZyApIDogW107XG5cdFx0XHR9IGVsc2UgaWYgKCAnY2FwYWNpdHlfcmV2aWV3JyA9PT0gc3VibWl0dGVkX21vZGUgKSB7XG5cdFx0XHRcdHBlbmRpbmdfaGlnaGxpZ2h0X2lkcyA9IEFycmF5LmlzQXJyYXkoIHJlc3BvbnNlLmRhdGEuYWZmZWN0ZWRfaWRzICkgPyByZXNwb25zZS5kYXRhLmFmZmVjdGVkX2lkcy5tYXAoIFN0cmluZyApIDogW107XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR2YXIgbW91bnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggY29uZmlnLm1vdW50X2lkICk7XG5cdFx0XHRcdHZhciBzZWxlY3Rpb24gPSBtb3VudCAmJiBtb3VudC5fd3BiY191aV9jYXRhbG9nX3NlbGVjdGlvbl9jb250cm9sbGVyO1xuXHRcdFx0XHR2YXIgc2VsZWN0ZWRfcmVzb3VyY2VfaWRzID0gZ2V0X3NlbGVjdGVkX3Jlc291cmNlX2lkcyggY29uZmlnICk7XG5cdFx0XHRcdHZhciBkZWxldGVkX3NlbGVjdGVkX3Jlc291cmNlID0gc3VibWl0dGVkX3Jlc291cmNlX2lkcy5zb21lKCBmdW5jdGlvbiAoIHJlc291cmNlX2lkICkge1xuXHRcdFx0XHRcdHJldHVybiAtMSAhPT0gc2VsZWN0ZWRfcmVzb3VyY2VfaWRzLmluZGV4T2YoIE51bWJlciggcmVzb3VyY2VfaWQgKSApO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdGlmICggc2VsZWN0aW9uICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBzZWxlY3Rpb24uY2xlYXIgJiYgKCBzdWJtaXR0ZWRfdHJhY2tzX3NlbGVjdGlvbiB8fCBkZWxldGVkX3NlbGVjdGVkX3Jlc291cmNlICkgKSB7XG5cdFx0XHRcdFx0c2VsZWN0aW9uLmNsZWFyKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHNob3dfYWRtaW5fbWVzc2FnZSggZ2V0X2luc3BlY3Rvcl9yZXNwb25zZV9tZXNzYWdlKCByZXNwb25zZSwgJycgKSwgJ3N1Y2Nlc3MnLCA0MDAwICk7XG5cdFx0XHRpbnNwZWN0b3JfZGlydHkgPSBmYWxzZTtcblx0XHRcdGluc3BlY3Rvcl9tdXRhdGlvbl9pbl9wcm9ncmVzcyA9IGZhbHNlO1xuXHRcdFx0aWYgKCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY29udGFpbnMoIGZvcm0gKSApIHtcblx0XHRcdFx0Y2xvc2VfaW5zcGVjdG9yKCBjb25maWcsIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGNhdGFsb2dfY29udHJvbGxlciApIHtcblx0XHRcdFx0Y2F0YWxvZ19jb250cm9sbGVyLmxvYWQoKTtcblx0XHRcdH1cblx0XHR9ICkuY2F0Y2goIGZ1bmN0aW9uICggZXJyb3IgKSB7XG5cdFx0XHRpZiAoIHJlcXVlc3Rfc2VxdWVuY2UgIT09ICggaXNfbXV0YXRpb24gPyBpbnNwZWN0b3JfbXV0YXRpb25fcmVxdWVzdF9zZXF1ZW5jZSA6IGluc3BlY3Rvcl9yZXF1ZXN0X3NlcXVlbmNlICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggaXNfbXV0YXRpb24gKSB7XG5cdFx0XHRcdGluc3BlY3Rvcl9tdXRhdGlvbl9pbl9wcm9ncmVzcyA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jb250YWlucyggZm9ybSApICkge1xuXHRcdFx0XHRzaG93X2FkbWluX21lc3NhZ2UoIGVycm9yICYmIGVycm9yLm1lc3NhZ2UgPyBlcnJvci5tZXNzYWdlIDogZmFsbGJhY2sgfHwgJycsICdlcnJvcicsIDUwMDAgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Zm9ybS5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtc2F2aW5nJyApO1xuXHRcdFx0Zm9ybS5yZW1vdmVBdHRyaWJ1dGUoICdhcmlhLWJ1c3knICk7XG5cdFx0XHRzaG93X2luc3BlY3Rvcl9tZXNzYWdlKCBmb3JtLCBlcnJvciAmJiBlcnJvci5tZXNzYWdlID8gZXJyb3IubWVzc2FnZSA6IGZhbGxiYWNrIHx8ICcnLCB0cnVlICk7XG5cdFx0XHRpZiAoIHNhdmVfYnV0dG9uICkge1xuXHRcdFx0XHRzYXZlX2J1dHRvbi5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtYnVzeScgKTtcblx0XHRcdFx0c2F2ZV9idXR0b24uZGlzYWJsZWQgPSBpbnNwZWN0b3Jfc2VsZWN0aW9uX3N0YWxlIHx8ICggJ2RlbGV0ZV9yZXZpZXcnID09PSBpbnNwZWN0b3JfbW9kZSAmJiAhIGZvcm0ucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1kZWxldGUtYWNrbm93bGVkZ2VtZW50XTpjaGVja2VkJyApICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGNhbmNlbF9idXR0b24gKSB7XG5cdFx0XHRcdGNhbmNlbF9idXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmICggJ2J1bGtfcmV2aWV3JyA9PT0gc3VibWl0dGVkX21vZGUgJiYgZ2V0X2lubGluZV9yZXZpZXdfd29ya2Zsb3coKSApIHtcblx0XHRcdFx0Z2V0X2lubGluZV9yZXZpZXdfd29ya2Zsb3coKS5zeW5jaHJvbml6ZSggeyBidXN5OiBmYWxzZSwgY2FuX2FwcGx5OiAhIGluc3BlY3Rvcl9zZWxlY3Rpb25fc3RhbGUgfSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAnZGVsZXRlX3JldmlldycgPT09IHN1Ym1pdHRlZF9tb2RlICYmIGdldF9kZWxldGVfcmV2aWV3X3dvcmtmbG93KCkgKSB7XG5cdFx0XHRcdGdldF9kZWxldGVfcmV2aWV3X3dvcmtmbG93KCkuc3luY2hyb25pemUoIHsgYnVzeTogZmFsc2UsIGNhbl9hcHBseTogISBpbnNwZWN0b3Jfc2VsZWN0aW9uX3N0YWxlIH0gKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogSW52YWxpZGF0ZSBhbiBvcGVuIHNlbGVjdGlvbi1vd25lZCBpbnNwZWN0b3Igd2hlbiBpdHMgc2VsZWN0aW9uIGNoYW5nZXMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Q3VzdG9tRXZlbnR9IGV2ZW50ICBTaGFyZWQgc2VsZWN0aW9uIGxpZmVjeWNsZSBldmVudC5cblx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgY29uZmlnIENhdGFsb2cgY29uZmlndXJhdGlvbi5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGhhbmRsZV9pbnNwZWN0b3Jfc2VsZWN0aW9uX2NoYW5nZSggZXZlbnQsIGNvbmZpZyApIHtcblx0XHR2YXIgc2VsZWN0ZWRfaWRzID0gZXZlbnQgJiYgZXZlbnQuZGV0YWlsICYmIEFycmF5LmlzQXJyYXkoIGV2ZW50LmRldGFpbC5zZWxlY3RlZF9pZHMgKSA/IGV2ZW50LmRldGFpbC5zZWxlY3RlZF9pZHMgOiBnZXRfc2VsZWN0ZWRfcmVzb3VyY2VfaWRzKCBjb25maWcgKTtcblx0XHR2YXIgZm9ybTtcblx0XHR2YXIgc2F2ZV9idXR0b247XG5cblx0XHRpZiAoICEgaW5zcGVjdG9yX3RyYWNrc19zZWxlY3Rpb24gfHwgLTEgPT09IFsgJ2J1bGtfZWRpdCcsICdidWxrX3JldmlldycsICdkZWxldGVfcmV2aWV3JyBdLmluZGV4T2YoIGluc3BlY3Rvcl9tb2RlICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGZvcm0gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWJ1bGstZm9ybV0sIFtkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1idWxrLXJldmlldy1mb3JtXSwgW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWRlbGV0ZS1mb3JtXScgKTtcblx0XHRzYXZlX2J1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5zcGVjdG9yLXNhdmVdJyApO1xuXHRcdGlmICggcmVzb3VyY2VfaWRfbGlzdHNfbWF0Y2goIGluc3BlY3Rvcl9yZXNvdXJjZV9pZHMsIHNlbGVjdGVkX2lkcyApICkge1xuXHRcdFx0aWYgKCAhIGluc3BlY3Rvcl9zZWxlY3Rpb25fc3RhbGUgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGluc3BlY3Rvcl9zZWxlY3Rpb25fc3RhbGUgPSBmYWxzZTtcblx0XHRcdHNob3dfaW5zcGVjdG9yX21lc3NhZ2UoIGZvcm0sICcnLCBmYWxzZSApO1xuXHRcdFx0aWYgKCAnZGVsZXRlX3JldmlldycgPT09IGluc3BlY3Rvcl9tb2RlICYmIGdldF9kZWxldGVfcmV2aWV3X3dvcmtmbG93KCkgKSB7XG5cdFx0XHRcdGdldF9kZWxldGVfcmV2aWV3X3dvcmtmbG93KCkuc3luY2hyb25pemUoIHsgYnVzeTogZmFsc2UsIGNhbl9hcHBseTogdHJ1ZSB9ICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICdidWxrX2VkaXQnID09PSBpbnNwZWN0b3JfbW9kZSApIHtcblx0XHRcdFx0c3luY2hyb25pemVfYnVsa19lZGl0b3IoIG51bGwgKTtcblx0XHRcdH0gZWxzZSBpZiAoIHNhdmVfYnV0dG9uICkge1xuXHRcdFx0XHR2YXIgYWNrbm93bGVkZ2VtZW50ID0gZm9ybSA/IGZvcm0ucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1kZWxldGUtYWNrbm93bGVkZ2VtZW50XScgKSA6IG51bGw7XG5cdFx0XHRcdHNhdmVfYnV0dG9uLmRpc2FibGVkID0gJ2RlbGV0ZV9yZXZpZXcnID09PSBpbnNwZWN0b3JfbW9kZSAmJiAoICEgYWNrbm93bGVkZ2VtZW50IHx8ICEgYWNrbm93bGVkZ2VtZW50LmNoZWNrZWQgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aW5zcGVjdG9yX3NlbGVjdGlvbl9zdGFsZSA9IHRydWU7XG5cdFx0c2hvd19pbnNwZWN0b3JfbWVzc2FnZSggZm9ybSwgY29uZmlnLmkxOG4uc2VsZWN0aW9uX2NoYW5nZWQgfHwgJycsIHRydWUgKTtcblx0XHRpZiAoICdkZWxldGVfcmV2aWV3JyA9PT0gaW5zcGVjdG9yX21vZGUgJiYgZ2V0X2RlbGV0ZV9yZXZpZXdfd29ya2Zsb3coKSApIHtcblx0XHRcdGdldF9kZWxldGVfcmV2aWV3X3dvcmtmbG93KCkuc3luY2hyb25pemUoIHsgYnVzeTogZmFsc2UsIGNhbl9hcHBseTogZmFsc2UgfSApO1xuXHRcdH1cblx0XHRpZiAoIHNhdmVfYnV0dG9uICkge1xuXHRcdFx0c2F2ZV9idXR0b24uZGlzYWJsZWQgPSB0cnVlO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBBcHBseSB0aGUgcG9zdC1tdXRhdGlvbiBoaWdobGlnaHQgYWZ0ZXIgYW4gQUpBWCBjYXRhbG9nIHJlZnJlc2guXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBhcHBseV9wZW5kaW5nX2hpZ2hsaWdodHMoKSB7XG5cdFx0dmFyIGZpcnN0X3JvdyA9IG51bGw7XG5cblx0XHRwZW5kaW5nX2hpZ2hsaWdodF9pZHMuZm9yRWFjaCggZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcblx0XHRcdHZhciByb3cgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWlkPVwiJyArIHJlc291cmNlX2lkICsgJ1wiXScgKTtcblx0XHRcdGlmICggcm93ICkge1xuXHRcdFx0XHRyb3cuY2xhc3NMaXN0LmFkZCggJ2lzLXJlY2VudGx5LXNhdmVkJyApO1xuXHRcdFx0XHRmaXJzdF9yb3cgPSBmaXJzdF9yb3cgfHwgcm93O1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0XHRpZiAoIGZpcnN0X3JvdyApIHtcblx0XHRcdGZpcnN0X3Jvdy5zY3JvbGxJbnRvVmlldyggeyBibG9jazogJ25lYXJlc3QnLCBiZWhhdmlvcjogJ3Ntb290aCcgfSApO1xuXHRcdH1cblx0XHR3aW5kb3cuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xuXHRcdFx0ZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2Jvb2tpbmdfcmVzb3VyY2VzX19pdGVtLmlzLXJlY2VudGx5LXNhdmVkJyApLmZvckVhY2goIGZ1bmN0aW9uICggcm93ICkge1xuXHRcdFx0XHRyb3cuY2xhc3NMaXN0LnJlbW92ZSggJ2lzLXJlY2VudGx5LXNhdmVkJyApO1xuXHRcdFx0fSApO1xuXHRcdH0sIDUwMDAgKTtcblx0XHRwZW5kaW5nX2hpZ2hsaWdodF9pZHMgPSBbXTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZW1vdmUgYSBjb25zdW1lZCByZWFkLW9ubHkgbGF1bmNoIHBhcmFtZXRlciB3aXRob3V0IGNoYW5naW5nIG5hdmlnYXRpb24uXG5cdCAqXG5cdCAqIFRoaXMgcHJldmVudHMgYSBub3JtYWwgcmVsb2FkIGZyb20gcmVvcGVuaW5nIHRoZSBndWlkZWQgYWN0aW9uIG1lbnUuIFRoZSBjYXRhbG9nJ3Ncblx0ICogb3RoZXIgcmVxdWVzdC1sb2NhbCBkaXNwbGF5IGFyZ3VtZW50cyByZW1haW4gaW4gcGxhY2UgYW5kIG5vIHByZWZlcmVuY2Vcblx0ICogc2F2ZSBhY3Rpb24gaXMgaW50cm9kdWNlZC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBjb25zdW1lX2luaXRpYWxfbGF1bmNoX3BhcmFtZXRlciggY29uZmlnICkge1xuXHRcdHZhciBsYXVuY2hfaW50ZW50ID0gY29uZmlnICYmIGNvbmZpZy5sYXVuY2hfaW50ZW50ID8gY29uZmlnLmxhdW5jaF9pbnRlbnQgOiB7fTtcblx0XHR2YXIgcXVlcnlfcGFyYW1ldGVyID0gU3RyaW5nKCBsYXVuY2hfaW50ZW50LnF1ZXJ5X3BhcmFtZXRlciB8fCAnJyApO1xuXHRcdHZhciBjdXJyZW50X3VybDtcblxuXHRcdGlmICggISBxdWVyeV9wYXJhbWV0ZXIgfHwgISB3aW5kb3cuaGlzdG9yeSB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93Lmhpc3RvcnkucmVwbGFjZVN0YXRlIHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiB3aW5kb3cuVVJMICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRjdXJyZW50X3VybCA9IG5ldyB3aW5kb3cuVVJMKCB3aW5kb3cubG9jYXRpb24uaHJlZiApO1xuXHRcdFx0Y3VycmVudF91cmwuc2VhcmNoUGFyYW1zLmRlbGV0ZSggcXVlcnlfcGFyYW1ldGVyICk7XG5cdFx0XHR3aW5kb3cuaGlzdG9yeS5yZXBsYWNlU3RhdGUoIHdpbmRvdy5oaXN0b3J5LnN0YXRlLCAnJywgY3VycmVudF91cmwudG9TdHJpbmcoKSApO1xuXHRcdH0gY2F0Y2ggKCBlcnJvciApIHtcblx0XHRcdC8vIEEgbWFsZm9ybWVkIGFkbWluaXN0cmF0aW9uIFVSTCBtdXN0IG5vdCBwcmV2ZW50IG5vcm1hbCBjYXRhbG9nIHVzZS5cblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogRGV0ZXJtaW5lIHdoZXRoZXIgb25lIGF1dGhvcml6ZWQgUmVzb3VyY2UgRFRPIGV4cG9zZXMgYSBuYW1lZCBhY3Rpb24uXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSByZXNvdXJjZSAgQXV0aG9yaXplZCBSZXNvdXJjZSBsaXN0IERUTy5cblx0ICogQHBhcmFtIHtzdHJpbmd9IGFjdGlvbl9pZCBTdGFibGUgZG9tYWluIGFjdGlvbiBpZGVudGlmaWVyLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIHNlcnZlci1hdXRob3JpemVkIGFjdGlvbiBpcyBwcmVzZW50LlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVzb3VyY2VfZXhwb3Nlc19hY3Rpb24oIHJlc291cmNlLCBhY3Rpb25faWQgKSB7XG5cdFx0dmFyIGFjdGlvbl9pdGVtcyA9IHJlc291cmNlICYmIEFycmF5LmlzQXJyYXkoIHJlc291cmNlLmFjdGlvbl9pdGVtcyApID8gcmVzb3VyY2UuYWN0aW9uX2l0ZW1zIDogW107XG5cdFx0dmFyIGFjdGlvbl9pbmRleDtcblxuXHRcdGZvciAoIGFjdGlvbl9pbmRleCA9IDA7IGFjdGlvbl9pbmRleCA8IGFjdGlvbl9pdGVtcy5sZW5ndGg7IGFjdGlvbl9pbmRleCArPSAxICkge1xuXHRcdFx0aWYgKCBhY3Rpb25faWQgPT09IFN0cmluZyggYWN0aW9uX2l0ZW1zWyBhY3Rpb25faW5kZXggXS5pZCB8fCAnJyApICkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHQvKipcblx0ICogT3BlbiBvbmUgcmVuZGVyZWQgUmVzb3VyY2UgYWN0aW9uIG1lbnUgYW5kIGZvY3VzIGEgbmFtZWQgYWN0aW9uLlxuXHQgKlxuXHQgKiBUaGUgc2hhcmVkIGNvbnRyb2xsZXIgb3ducyBtZW51IG1lY2hhbmljcy4gVGhpcyBkb21haW4gYWRhcHRlciBzZWxlY3RzXG5cdCAqIG9ubHkgYSBSZXNvdXJjZSBhbmQgYWN0aW9uIGFscmVhZHkgYXV0aG9yaXplZCBpbiB0aGUgc2VydmVyIHJlc3BvbnNlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnICAgICAgUmVnaXN0ZXJlZCBjYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCBBdXRob3JpemVkIEJvb2tpbmcgUmVzb3VyY2UgSUQuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBhY3Rpb25faWQgICBBdXRob3JpemVkIGRvbWFpbiBhY3Rpb24gaWRlbnRpZmllci5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBtZW51IG9wZW5lZCBhbmQgdGhlIGFjdGlvbiByZWNlaXZlZCBmb2N1cy5cblx0ICovXG5cdGZ1bmN0aW9uIG9wZW5fcmVzb3VyY2VfYWN0aW9uX21lbnUoIGNvbmZpZywgcmVzb3VyY2VfaWQsIGFjdGlvbl9pZCApIHtcblx0XHR2YXIgbW91bnRfZWxlbWVudCA9IGNvbmZpZyAmJiBjb25maWcubW91bnRfaWQgPyBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggY29uZmlnLm1vdW50X2lkICkgOiBudWxsO1xuXHRcdHZhciBhY3Rpb25zX2NvbnRyb2xsZXIgPSBtb3VudF9lbGVtZW50ICYmIG1vdW50X2VsZW1lbnQuX3dwYmNfdWlfY2F0YWxvZ19hY3Rpb25zX2NvbnRyb2xsZXJcblx0XHRcdD8gbW91bnRfZWxlbWVudC5fd3BiY191aV9jYXRhbG9nX2FjdGlvbnNfY29udHJvbGxlclxuXHRcdFx0OiBudWxsO1xuXG5cdFx0aWYgKCAhIGFjdGlvbnNfY29udHJvbGxlciB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgYWN0aW9uc19jb250cm9sbGVyLm9wZW5faXRlbSApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gYWN0aW9uc19jb250cm9sbGVyLm9wZW5faXRlbSggU3RyaW5nKCByZXNvdXJjZV9pZCApLCBTdHJpbmcoIGFjdGlvbl9pZCB8fCAnJyApICk7XG5cdH1cblxuXHQvKipcblx0ICogT3BlbiB0aGUgYWN0aW9uIG1lbnUgZm9yIHRoZSBmaXJzdCBzZXJ2ZXItYXV0aG9yaXplZCBSZXNvdXJjZSBEVE8uXG5cdCAqXG5cdCAqIFRoZSBVUkwgY2FycmllcyBwcmVzZW50YXRpb24gaW50ZW50IG9ubHkuIEl0IG5ldmVyIHN1cHBsaWVzIGEgdHJ1c3RlZFxuXHQgKiBSZXNvdXJjZSBJRC4gQWN0aXZhdGluZyB0aGUgZm9jdXNlZCBQdWJsaXNoIGFjdGlvbiBmb2xsb3dzIHRoZSBub3JtYWxcblx0ICogZG9tYWluIGhhbmRsZXIsIHdoaWNoIHJlcGVhdHMgY2FwYWJpbGl0eSBhbmQgb3duZXJzaGlwIGNoZWNrcyBiZWZvcmVcblx0ICogb3BlbmluZyBwdWJsaXNoaW5nIHRvb2xzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29uZmlnICAgQ2F0YWxvZyBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gcmVzcG9uc2UgTm9ybWFsaXplZCBhdXRob3JpemVkIGNhdGFsb2cgcmVzcG9uc2UuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBvcGVuX2luaXRpYWxfbGF1bmNoX2ludGVudCggY29uZmlnLCByZXNwb25zZSApIHtcblx0XHR2YXIgYWN0aW9uX2lkID0gY29uZmlnICYmIGNvbmZpZy5sYXVuY2hfaW50ZW50ID8gU3RyaW5nKCBjb25maWcubGF1bmNoX2ludGVudC5hY3Rpb24gfHwgJycgKSA6ICcnO1xuXHRcdHZhciByZXNvdXJjZTtcblx0XHR2YXIgcmVzb3VyY2VfaW5kZXg7XG5cblx0XHRpZiAoIGxhdW5jaF9pbnRlbnRfaGFuZGxlZCB8fCAncHVibGlzaF9yZXNvdXJjZScgIT09IGFjdGlvbl9pZCB8fCAhIHJlc3BvbnNlIHx8ICEgQXJyYXkuaXNBcnJheSggcmVzcG9uc2UuaXRlbXMgKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsYXVuY2hfaW50ZW50X2hhbmRsZWQgPSB0cnVlO1xuXHRcdGNvbnN1bWVfaW5pdGlhbF9sYXVuY2hfcGFyYW1ldGVyKCBjb25maWcgKTtcblxuXHRcdGZvciAoIHJlc291cmNlX2luZGV4ID0gMDsgcmVzb3VyY2VfaW5kZXggPCByZXNwb25zZS5pdGVtcy5sZW5ndGg7IHJlc291cmNlX2luZGV4ICs9IDEgKSB7XG5cdFx0XHRpZiAoIHJlc291cmNlX2V4cG9zZXNfYWN0aW9uKCByZXNwb25zZS5pdGVtc1sgcmVzb3VyY2VfaW5kZXggXSwgYWN0aW9uX2lkICkgKSB7XG5cdFx0XHRcdHJlc291cmNlID0gcmVzcG9uc2UuaXRlbXNbIHJlc291cmNlX2luZGV4IF07XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICggISByZXNvdXJjZSB8fCAhIE51bWJlciggcmVzb3VyY2UuaWQgKSApIHtcblx0XHRcdHNob3dfYWRtaW5fbWVzc2FnZSggY29uZmlnICYmIGNvbmZpZy5pMThuID8gY29uZmlnLmkxOG4ucHVibGlzaGluZ19sYXVuY2hfdW5hdmFpbGFibGUgfHwgJycgOiAnJywgJ2Vycm9yJywgNzAwMCApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRpZiAoICEgb3Blbl9yZXNvdXJjZV9hY3Rpb25fbWVudSggY29uZmlnLCBOdW1iZXIoIHJlc291cmNlLmlkICksIGFjdGlvbl9pZCApICkge1xuXHRcdFx0XHRzaG93X2FkbWluX21lc3NhZ2UoIGNvbmZpZyAmJiBjb25maWcuaTE4biA/IGNvbmZpZy5pMThuLnB1Ymxpc2hpbmdfbGF1bmNoX3VuYXZhaWxhYmxlIHx8ICcnIDogJycsICdlcnJvcicsIDcwMDAgKTtcblx0XHRcdH1cblx0XHR9LCAwICk7XG5cdH1cblxuXHQvKipcblx0ICogSGFuZGxlIGNvbXBsZXRlZCBzaGFyZWQgcmVuZGVycyBmb3IgdGhpcyBSZXNvdXJjZSBjYXRhbG9nIG9ubHkuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Q3VzdG9tRXZlbnR9IGV2ZW50IFNoYXJlZCBjYXRhbG9nIGxpZmVjeWNsZSBldmVudC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGhhbmRsZV9jYXRhbG9nX3JlbmRlcmVkKCBldmVudCApIHtcblx0XHR2YXIgY29uZmlnID0gd2luZG93LndwYmNfY2F0YWxvZ19ib29raW5nX3Jlc291cmNlc19jb25maWc7XG5cdFx0dmFyIGV2ZW50X2RldGFpbCA9IGV2ZW50ICYmIGV2ZW50LmRldGFpbCA/IGV2ZW50LmRldGFpbCA6IHt9O1xuXG5cdFx0aWYgKCAhIGNvbmZpZyB8fCBldmVudF9kZXRhaWwuY2F0YWxvZ19pZCAhPT0gY29uZmlnLmlkIHx8ICEgZXZlbnRfZGV0YWlsLnJlc3BvbnNlICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNhdGFsb2dfcmVzcG9uc2UgPSBldmVudF9kZXRhaWwucmVzcG9uc2U7XG5cdFx0c3luY2hyb25pemVfYm9va2luZ19yZXNvdXJjZXNfdG9vbGJhciggY29uZmlnLCBjYXRhbG9nX3Jlc3BvbnNlICk7XG5cdFx0cmVuZGVyX2Jvb2tpbmdfcmVzb3VyY2VzX3Jlc3BvbnNlKCBjb25maWcsIGNhdGFsb2dfcmVzcG9uc2UgKTtcblx0XHRyZW5kZXJfaW5saW5lX2JhciggY29uZmlnICk7XG5cdFx0c3luY2hyb25pemVfaW5saW5lX2NvbnRyb2xzKCBjb25maWcgKTtcblx0XHRvcGVuX2luaXRpYWxfbGF1bmNoX2ludGVudCggY29uZmlnLCBjYXRhbG9nX3Jlc3BvbnNlICk7XG5cdFx0aWYgKCBpbnNwZWN0b3JfcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRtYXJrX2luc3BlY3Rvcl9yZXNvdXJjZV9yb3coIGluc3BlY3Rvcl9yZXNvdXJjZV9pZCApO1xuXHRcdH1cblx0XHRhcHBseV9wZW5kaW5nX2hpZ2hsaWdodHMoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXF1ZXN0IGEgc2VsZWN0ZWQgcGFnaW5hdGlvbiBwYWdlIHRocm91Z2ggdGhlIHNoYXJlZCBjb250cm9sbGVyLlxuXHQgKlxuXHQgKiBAcGFyYW0ge01vdXNlRXZlbnR9IGV2ZW50IENhdGFsb2cgY2xpY2sgZXZlbnQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBoYW5kbGVfY2F0YWxvZ19jbGljayggZXZlbnQgKSB7XG5cdFx0dmFyIGFjdGlvbl9idXR0b24gPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1hY3Rpb25dJyApO1xuXHRcdHZhciBhY3Rpb25fZGV0YWlscztcblx0XHR2YXIgY2F0YWxvZ19tb3VudDtcblx0XHR2YXIgY29uZmlnID0gd2luZG93LndwYmNfY2F0YWxvZ19ib29raW5nX3Jlc291cmNlc19jb25maWc7XG5cdFx0dmFyIHBhZ2VfYnV0dG9uID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctcGFnZV0nICk7XG5cdFx0dmFyIHJlc291cmNlX2FjdGlvbl9ldmVudDtcblxuXHRcdGlmICggaW5saW5lX3N0YXRlLmFjdGl2ZSAmJiBhY3Rpb25fYnV0dG9uICkge1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIHBhZ2VfYnV0dG9uICYmICEgcGFnZV9idXR0b24uZGlzYWJsZWQgKSB7XG5cdFx0XHRwZW5kaW5nX2ZvY3VzX2RpcmVjdGlvbiA9IHBhZ2VfYnV0dG9uLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy11aS1jYXRhbG9nLXBhZ2UtZGlyZWN0aW9uJyApIHx8ICdwYWdlJztcblx0XHR9XG5cblx0XHRpZiAoICEgYWN0aW9uX2J1dHRvbiB8fCAhIGNvbmZpZyApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dmFyIGFjdGlvbl9pZCA9IGFjdGlvbl9idXR0b24uZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtYWN0aW9uJyApIHx8ICcnO1xuXHRcdGlmICggJ3RvZ2dsZV9kZXRhaWxzJyA9PT0gYWN0aW9uX2lkICkge1xuXHRcdFx0dmFyIHJlc291cmNlX2lkID0gTnVtYmVyKCBhY3Rpb25fYnV0dG9uLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWlkJyApIHx8IDAgKTtcblx0XHRcdHZhciByZXNvdXJjZV9yb3cgPSBnZXRfcmVzb3VyY2VfaXRlbV9jb250YWluZXIoIGFjdGlvbl9idXR0b24gKTtcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRpZiAoIHJlc291cmNlX2lkICYmIHJlc291cmNlX3JvdyAmJiBjb25maWcuZGV0YWlsc19hY3Rpb24gKSB7XG5cdFx0XHRcdGlmICggcmVzb3VyY2VfaWQgPT09IGRldGFpbHNfcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdFx0Y2xvc2VfZGV0YWlsc19yb3coIHRydWUgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRvcGVuX2RldGFpbHNfcm93KCBjb25maWcsIGFjdGlvbl9idXR0b24sIHJlc291cmNlX3JvdywgcmVzb3VyY2VfaWQgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoICdjb3B5X2RldGFpbHNfdmFsdWUnID09PSBhY3Rpb25faWQgKSB7XG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0Y29weV9kZXRhaWxzX3ZhbHVlKCBhY3Rpb25fYnV0dG9uLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWNvcHktdmFsdWUnICkgfHwgJycsIGFjdGlvbl9idXR0b24sIGNvbmZpZyApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRhY3Rpb25fZGV0YWlscyA9IGFjdGlvbl9idXR0b24uY2xvc2VzdCggJ2RldGFpbHMnICk7XG5cdFx0aWYgKCBhY3Rpb25fZGV0YWlscyApIHtcblx0XHRcdGFjdGlvbl9kZXRhaWxzLnJlbW92ZUF0dHJpYnV0ZSggJ29wZW4nICk7XG5cdFx0fVxuXG5cdFx0Y2F0YWxvZ19tb3VudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBjb25maWcubW91bnRfaWQgKTtcblx0XHRpZiAoIGNhdGFsb2dfbW91bnQgKSB7XG5cdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cuQ3VzdG9tRXZlbnQgKSB7XG5cdFx0XHRcdHJlc291cmNlX2FjdGlvbl9ldmVudCA9IG5ldyB3aW5kb3cuQ3VzdG9tRXZlbnQoICd3cGJjOmJvb2tpbmctcmVzb3VyY2UtYWN0aW9uJywge1xuXHRcdFx0XHRcdGJ1YmJsZXM6IHRydWUsXG5cdFx0XHRcdFx0ZGV0YWlsOiB7XG5cdFx0XHRcdFx0XHRhY3Rpb246IGFjdGlvbl9idXR0b24uZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtYWN0aW9uJyApIHx8ICcnLFxuXHRcdFx0XHRcdFx0cmVzb3VyY2VfaWQ6IE51bWJlciggYWN0aW9uX2J1dHRvbi5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1pZCcgKSB8fCAwIClcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlc291cmNlX2FjdGlvbl9ldmVudCA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCAnQ3VzdG9tRXZlbnQnICk7XG5cdFx0XHRcdHJlc291cmNlX2FjdGlvbl9ldmVudC5pbml0Q3VzdG9tRXZlbnQoICd3cGJjOmJvb2tpbmctcmVzb3VyY2UtYWN0aW9uJywgdHJ1ZSwgZmFsc2UsIHtcblx0XHRcdFx0XHRhY3Rpb246IGFjdGlvbl9idXR0b24uZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtYWN0aW9uJyApIHx8ICcnLFxuXHRcdFx0XHRcdHJlc291cmNlX2lkOiBOdW1iZXIoIGFjdGlvbl9idXR0b24uZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtaWQnICkgfHwgMCApXG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblx0XHRcdGNhdGFsb2dfbW91bnQuZGlzcGF0Y2hFdmVudCggcmVzb3VyY2VfYWN0aW9uX2V2ZW50ICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIENsb3NlIGV4cGFuZGVkIGRldGFpbHMgd2l0aCBFc2NhcGUgYW5kIHJlc3RvcmUgZGlzY2xvc3VyZSBmb2N1cy5cblx0ICpcblx0ICogQHBhcmFtIHtLZXlib2FyZEV2ZW50fSBldmVudCBDYXRhbG9nIGtleWJvYXJkIGV2ZW50LlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gaGFuZGxlX2NhdGFsb2dfa2V5ZG93biggZXZlbnQgKSB7XG5cdFx0dmFyIGNvbmZpZyA9IHdpbmRvdy53cGJjX2NhdGFsb2dfYm9va2luZ19yZXNvdXJjZXNfY29uZmlnO1xuXG5cdFx0aWYgKCAnRXNjYXBlJyA9PT0gZXZlbnQua2V5ICYmIGlubGluZV9zdGF0ZS5hY3RpdmUgJiYgJ2lubGluZV9yZXZpZXcnICE9PSBpbnNwZWN0b3JfbW9kZSApIHtcblx0XHRcdHN5bmNocm9uaXplX2lubGluZV9kcmFmdHMoIGNvbmZpZyApO1xuXHRcdFx0aWYgKCAhIGlubGluZV9zdGF0ZS5jaGFuZ2VkX3Jvd3MubGVuZ3RoIHx8IHdpbmRvdy5jb25maXJtKCBjb25maWcuaTE4bi5pbmxpbmVfZGlzY2FyZCB8fCAnJyApICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRsZWF2ZV9pbmxpbmVfbW9kZSggY29uZmlnLCB0cnVlLCAnJyApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoICdFc2NhcGUnID09PSBldmVudC5rZXkgJiYgZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtZGV0YWlscy1yb3ddJyApICkge1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGNsb3NlX2RldGFpbHNfcm93KCB0cnVlICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEJsb2NrIEJvb2tpbmcgUmVzb3VyY2UgaW1hZ2UgY2hhbmdlcyBpbiBwdWJsaWMgZGVtbyBpbnN0YWxsYXRpb25zLlxuXHQgKlxuXHQgKiBUaGlzIGNhcHR1cmUtcGhhc2UgZ3VhcmQgcnVucyBiZWZvcmUgdGhlIHNoYXJlZCBkZWxlZ2F0ZWQgbWVkaWEtdXBsb2FkZXJcblx0ICogaGFuZGxlciwgcHJldmVudGluZyB0aGUgV29yZFByZXNzIG1lZGlhIG1vZGFsIGZyb20gb3BlbmluZy4gU2VydmVyLXNpZGVcblx0ICogY3JlYXRlIHZhbGlkYXRpb24gaW5kZXBlbmRlbnRseSByZWplY3RzIGEgZm9yZ2VkIHBpY3R1cmUgVVJMLlxuXHQgKlxuXHQgKiBAcGFyYW0ge01vdXNlRXZlbnR9IGV2ZW50ICBCcm93c2VyIGNsaWNrIGV2ZW50LlxuXHQgKiBAcGFyYW0ge09iamVjdH0gICAgIGNvbmZpZyBDYXRhbG9nIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBwcm90ZWN0X2RlbW9fcmVzb3VyY2VfaW1hZ2VfY2hhbmdlKCBldmVudCwgY29uZmlnICkge1xuXHRcdHZhciBtZWRpYV9idXR0b247XG5cdFx0dmFyIGluc3BlY3Rvcl9mb3JtO1xuXHRcdHZhciBtZXNzYWdlO1xuXHRcdHZhciBtZXNzYWdlX3RpdGxlO1xuXG5cdFx0aWYgKCAhIGNvbmZpZyB8fCAhIGlzX3RydWVfZmxhZyggY29uZmlnLmlzX2RlbW8gKSB8fCAhIGV2ZW50LnRhcmdldCB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgZXZlbnQudGFyZ2V0LmNsb3Nlc3QgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bWVkaWFfYnV0dG9uID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICcud3BiY19tZWRpYV91cGxvYWRfYnV0dG9uLCBbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtcmVtb3ZlLWltYWdlXScgKTtcblx0XHRpbnNwZWN0b3JfZm9ybSA9IG1lZGlhX2J1dHRvbiA/IG1lZGlhX2J1dHRvbi5jbG9zZXN0KCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWluc3BlY3Rvci1mb3JtXScgKSA6IG51bGw7XG5cdFx0aWYgKCAhIG1lZGlhX2J1dHRvbiB8fCAhIGluc3BlY3Rvcl9mb3JtICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uICkge1xuXHRcdFx0ZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG5cdFx0fVxuXHRcdG1lc3NhZ2UgPSBjb25maWcuaTE4biAmJiBjb25maWcuaTE4bi5kZW1vX2ltYWdlX2NoYW5nZV91bmF2YWlsYWJsZSA/IGNvbmZpZy5pMThuLmRlbW9faW1hZ2VfY2hhbmdlX3VuYXZhaWxhYmxlIDogJyc7XG5cdFx0bWVzc2FnZV90aXRsZSA9IGNvbmZpZy5pMThuICYmIGNvbmZpZy5pMThuLmRlbW9faW1hZ2VfY2hhbmdlX3VuYXZhaWxhYmxlX3RpdGxlID8gY29uZmlnLmkxOG4uZGVtb19pbWFnZV9jaGFuZ2VfdW5hdmFpbGFibGVfdGl0bGUgOiAnJztcblx0XHRvcGVuX2Jvb2tpbmdfcmVzb3VyY2VfbWVzc2FnZV9kaWFsb2coIG1lc3NhZ2UsIG1lc3NhZ2VfdGl0bGUsIG1lZGlhX2J1dHRvbiApO1xuXHR9XG5cblx0LyoqXG5cdCAqIE1vdW50IHRoZSBsb2NhbGl6ZWQgY2F0YWxvZyBjb25maWd1cmF0aW9uIGFmdGVyIHRoZSBkb2N1bWVudCBpcyByZWFkeS5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIG1vdW50X2Jvb2tpbmdfcmVzb3VyY2VzX2NhdGFsb2coKSB7XG5cdFx0dmFyIGNvbmZpZyA9IHdpbmRvdy53cGJjX2NhdGFsb2dfYm9va2luZ19yZXNvdXJjZXNfY29uZmlnO1xuXHRcdHZhciBtb3VudF9lbGVtZW50O1xuXG5cdFx0aWYgKCAhIGNvbmZpZyB8fCAhIHdpbmRvdy53cGJjX3VpX2NhdGFsb2cgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy53cGJjX3VpX2NhdGFsb2cubW91bnQgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bW91bnRfZWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBjb25maWcubW91bnRfaWQgKTtcblx0XHRpZiAoICEgbW91bnRfZWxlbWVudCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRtb3VudF9lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOnVpLWNhdGFsb2ctcmVuZGVyZWQnLCBoYW5kbGVfY2F0YWxvZ19yZW5kZXJlZCApO1xuXHRcdG1vdW50X2VsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6dWktY2F0YWxvZy1iZWZvcmUtcmVuZGVyJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0Y2xvc2VfZGV0YWlsc19yb3coIGZhbHNlICk7XG5cdFx0fSApO1xuXHRcdG1vdW50X2VsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6dWktY2F0YWxvZy1oaWVyYXJjaHktY2hhbmdlJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0Y2xvc2VfZGV0YWlsc19yb3coIGZhbHNlICk7XG5cdFx0XHRzeW5jaHJvbml6ZV9jYXJkX2dyb3VwX3BhbmVscyggbW91bnRfZWxlbWVudCApO1xuXHRcdH0gKTtcblx0XHRtb3VudF9lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOnVpLWNhdGFsb2ctc2VsZWN0aW9uLWNoYW5nZScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHRoYW5kbGVfaW5zcGVjdG9yX3NlbGVjdGlvbl9jaGFuZ2UoIGV2ZW50LCBjb25maWcgKTtcblx0XHR9ICk7XG5cdFx0bW91bnRfZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzp1aS1jYXRhbG9nLXNlbGVjdGlvbi1yZXN0b3JlZCcsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHRoYW5kbGVfaW5zcGVjdG9yX3NlbGVjdGlvbl9jaGFuZ2UoIGV2ZW50LCBjb25maWcgKTtcblx0XHR9ICk7XG5cdFx0bW91bnRfZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBwcm90ZWN0X2lubGluZV9kcmFmdHNfZnJvbV9jYXRhbG9nX2NvbnRyb2xzLCB0cnVlICk7XG5cdFx0bW91bnRfZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgcHJvdGVjdF9pbmxpbmVfZHJhZnRzX2Zyb21fY2F0YWxvZ19jb250cm9scywgdHJ1ZSApO1xuXHRcdG1vdW50X2VsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgcHJvdGVjdF9pbmxpbmVfZHJhZnRzX2Zyb21fY2F0YWxvZ19jb250cm9scywgdHJ1ZSApO1xuXHRcdG1vdW50X2VsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgaGFuZGxlX2NhdGFsb2dfY2xpY2sgKTtcblx0XHRtb3VudF9lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywgaGFuZGxlX2NhdGFsb2dfa2V5ZG93biApO1xuXHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAncmVzaXplJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0c3luY2hyb25pemVfb3ZlcmZsb3dfdG9vbHRpcHMoIG1vdW50X2VsZW1lbnQgKTtcblx0XHR9ICk7XG5cdFx0Y2F0YWxvZ19jb250cm9sbGVyID0gd2luZG93LndwYmNfdWlfY2F0YWxvZy5tb3VudCggY29uZmlnICk7XG5cdFx0aWYgKCBjYXRhbG9nX2NvbnRyb2xsZXIgKSB7XG5cdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY191aV9jYXRhbG9nLmNyZWF0ZV9pbmxpbmVfZWRpdGluZ193b3JrZmxvdyApIHtcblx0XHRcdFx0aW5saW5lX3dvcmtmbG93X2NvbnRyb2xsZXIgPSB3aW5kb3cud3BiY191aV9jYXRhbG9nLmNyZWF0ZV9pbmxpbmVfZWRpdGluZ193b3JrZmxvdyggbW91bnRfZWxlbWVudCwge1xuXHRcdFx0XHRcdGJhcl9zZWxlY3RvcjogJ1tkYXRhLXdwYmMtY2F0YWxvZy1pbmxpbmUtYmFyXScsXG5cdFx0XHRcdFx0Y2FuY2VsX3NlbGVjdG9yOiAnW2RhdGEtd3BiYy1jYXRhbG9nLWlubGluZS1jYW5jZWxdJyxcblx0XHRcdFx0XHRjb250cm9sc19yb290OiBkb2N1bWVudCxcblx0XHRcdFx0XHRjb3VudF9zZWxlY3RvcjogJ1tkYXRhLXdwYmMtY2F0YWxvZy1pbmxpbmUtY291bnRdJyxcblx0XHRcdFx0XHRwYWdlX2VsZW1lbnQ6IG1vdW50X2VsZW1lbnQubWF0Y2hlcyggJy53cGJjX2Jvb2tpbmdfcmVzb3VyY2VzX3BhZ2UnICkgPyBtb3VudF9lbGVtZW50IDogbW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYm9va2luZ19yZXNvdXJjZXNfcGFnZScgKSxcblx0XHRcdFx0XHRwcm90ZWN0ZWRfc2VsZWN0b3I6ICdbZGF0YS13cGJjLWNhdGFsb2ctYm9va2luZy1yZXNvdXJjZS1jcmVhdGVdJyxcblx0XHRcdFx0XHRyZXZpZXdfc2VsZWN0b3I6ICdbZGF0YS13cGJjLWNhdGFsb2ctaW5saW5lLXJldmlld10nLFxuXHRcdFx0XHRcdHRvZ2dsZV9sYWJlbF9zZWxlY3RvcjogJ1tkYXRhLXdwYmMtY2F0YWxvZy1pbmxpbmUtdG9nZ2xlLWxhYmVsXScsXG5cdFx0XHRcdFx0dG9nZ2xlX3NlbGVjdG9yOiAnW2RhdGEtd3BiYy1jYXRhbG9nLWlubGluZS10b2dnbGVdJ1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cdFx0XHRyZW5kZXJfYm9va2luZ19yZXNvdXJjZXNfZmlsdGVycyggY29uZmlnICk7XG5cdFx0XHRyZW5kZXJfYm9va2luZ19yZXNvdXJjZXNfdG9vbGJhciggY29uZmlnICk7XG5cdFx0XHRyZW5kZXJfaW5saW5lX2JhciggY29uZmlnICk7XG5cdFx0XHRzeW5jaHJvbml6ZV9pbmxpbmVfY29udHJvbHMoIGNvbmZpZyApO1xuXHRcdFx0bW91bnRfaW5zcGVjdG9yX3NoZWxsKCBjb25maWcgKTtcblx0XHR9XG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfZGVmaW5lX3RpcHB5X3Rvb2x0aXBzICkge1xuXHRcdFx0d2luZG93LndwYmNfZGVmaW5lX3RpcHB5X3Rvb2x0aXBzKCAnW2RhdGEtd3BiYy1jYXRhbG9nLWJvb2tpbmctcmVzb3VyY2UtdXBncmFkZV0nICk7XG5cdFx0fVxuXG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6Ym9va2luZy1yZXNvdXJjZS1hY3Rpb24nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0dmFyIGRldGFpbCA9IGV2ZW50ICYmIGV2ZW50LmRldGFpbCA/IGV2ZW50LmRldGFpbCA6IHt9O1xuXHRcdFx0aWYgKCAnZWRpdF9yZXNvdXJjZScgPT09IGRldGFpbC5hY3Rpb24gKSB7XG5cdFx0XHRcdG9wZW5faW5zcGVjdG9yKCBjb25maWcsICdlZGl0JywgTnVtYmVyKCBkZXRhaWwucmVzb3VyY2VfaWQgKSB8fCAwLCBkb2N1bWVudC5hY3RpdmVFbGVtZW50ICk7XG5cdFx0XHR9IGVsc2UgaWYgKCAncHVibGlzaF9yZXNvdXJjZScgPT09IGRldGFpbC5hY3Rpb24gKSB7XG5cdFx0XHRcdG9wZW5faW5zcGVjdG9yKCBjb25maWcsICdlZGl0JywgTnVtYmVyKCBkZXRhaWwucmVzb3VyY2VfaWQgKSB8fCAwLCBkb2N1bWVudC5hY3RpdmVFbGVtZW50LCAnc2hvcnRjb2RlX3B1Ymxpc2hpbmcnICk7XG5cdFx0XHR9IGVsc2UgaWYgKCAnYWRqdXN0X2NhcGFjaXR5JyA9PT0gZGV0YWlsLmFjdGlvbiApIHtcblx0XHRcdFx0b3Blbl9jYXBhY2l0eV9lZGl0b3IoIGNvbmZpZywgTnVtYmVyKCBkZXRhaWwucmVzb3VyY2VfaWQgKSB8fCAwLCBkb2N1bWVudC5hY3RpdmVFbGVtZW50ICk7XG5cdFx0XHR9IGVsc2UgaWYgKCAnZGVsZXRlX3Jlc291cmNlJyA9PT0gZGV0YWlsLmFjdGlvbiApIHtcblx0XHRcdFx0b3Blbl9kZWxldGVfcmV2aWV3KCBjb25maWcsIFsgTnVtYmVyKCBkZXRhaWwucmVzb3VyY2VfaWQgKSB8fCAwIF0sIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQsIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHRwcm90ZWN0X2RlbW9fcmVzb3VyY2VfaW1hZ2VfY2hhbmdlKCBldmVudCwgY29uZmlnICk7XG5cdFx0fSwgdHJ1ZSApO1xuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHR2YXIgaW5saW5lX3RvZ2dsZSA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1jYXRhbG9nLWlubGluZS10b2dnbGVdJyApO1xuXHRcdFx0dmFyIGlubGluZV9jYW5jZWwgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtY2F0YWxvZy1pbmxpbmUtY2FuY2VsXScgKTtcblx0XHRcdHZhciBpbmxpbmVfcmV2aWV3ID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWNhdGFsb2ctaW5saW5lLXJldmlld10nICk7XG5cdFx0XHR2YXIgY3JlYXRlX2J1dHRvbiA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1jYXRhbG9nLWJvb2tpbmctcmVzb3VyY2UtY3JlYXRlXScgKTtcblx0XHRcdHZhciB1cGdyYWRlX2J1dHRvbiA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1jYXRhbG9nLWJvb2tpbmctcmVzb3VyY2UtdXBncmFkZV0nICk7XG5cdFx0XHR2YXIgY2FuY2VsX2J1dHRvbiA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1jYW5jZWxdJyApO1xuXHRcdFx0dmFyIHJlbW92ZV9pbWFnZV9idXR0b24gPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1yZW1vdmUtaW1hZ2VdJyApO1xuXHRcdFx0dmFyIHNob3J0Y29kZV9idXR0b24gPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1zaG9ydGNvZGUtY29tbWFuZF0nICk7XG5cdFx0XHR2YXIgcmVzb3VyY2Vfcm93ID0gZ2V0X3Jlc291cmNlX2l0ZW1fY29udGFpbmVyKCBldmVudC50YXJnZXQgKTtcblx0XHRcdHZhciBzZWxlY3Rpb25fYWN0aW9uID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWNhdGFsb2ctc2VsZWN0aW9uLWFjdGlvbl0nICk7XG5cdFx0XHRpZiAoIGlubGluZV90b2dnbGUgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHN0YXJ0X2lubGluZV9tb2RlKCBjb25maWcgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBpbmxpbmVfY2FuY2VsICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRzeW5jaHJvbml6ZV9pbmxpbmVfZHJhZnRzKCBjb25maWcgKTtcblx0XHRcdFx0aWYgKCAhIGlubGluZV9zdGF0ZS5jaGFuZ2VkX3Jvd3MubGVuZ3RoIHx8IHdpbmRvdy5jb25maXJtKCBjb25maWcuaTE4bi5pbmxpbmVfZGlzY2FyZCB8fCAnJyApICkge1xuXHRcdFx0XHRcdGxlYXZlX2lubGluZV9tb2RlKCBjb25maWcsIHRydWUsICcnICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBpbmxpbmVfcmV2aWV3ICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRwcmV2aWV3X2lubGluZV9jaGFuZ2VzKCBjb25maWcsIGlubGluZV9yZXZpZXcgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBzZWxlY3Rpb25fYWN0aW9uICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRpZiAoICdidWxrX2VkaXQnID09PSBzZWxlY3Rpb25fYWN0aW9uLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1jYXRhbG9nLXNlbGVjdGlvbi1hY3Rpb24nICkgKSB7XG5cdFx0XHRcdFx0b3Blbl9idWxrX2VkaXRvciggY29uZmlnLCBzZWxlY3Rpb25fYWN0aW9uICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0b3Blbl9kZWxldGVfcmV2aWV3KCBjb25maWcsIGdldF9zZWxlY3RlZF9yZXNvdXJjZV9pZHMoIGNvbmZpZyApLCBzZWxlY3Rpb25fYWN0aW9uLCB0cnVlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBzaG9ydGNvZGVfYnV0dG9uICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR2YXIgc2hvcnRjb2RlX3Jlc291cmNlX2lkID0gTnVtYmVyKCBzaG9ydGNvZGVfYnV0dG9uLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWlkJyApIHx8IDAgKTtcblx0XHRcdFx0dmFyIHNob3J0Y29kZV9jb21tYW5kID0gc2hvcnRjb2RlX2J1dHRvbi5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1zaG9ydGNvZGUtY29tbWFuZCcgKSB8fCAnJztcblx0XHRcdFx0dmFyIHNob3J0Y29kZV92YWx1ZSA9IGdldF9ib29raW5nX3Jlc291cmNlX3Nob3J0Y29kZSggc2hvcnRjb2RlX3Jlc291cmNlX2lkLCBzaG9ydGNvZGVfYnV0dG9uICk7XG5cdFx0XHRcdGlmICggJ2NvcHknID09PSBzaG9ydGNvZGVfY29tbWFuZCApIHtcblx0XHRcdFx0XHRjb3B5X2RldGFpbHNfdmFsdWUoIHNob3J0Y29kZV92YWx1ZSwgc2hvcnRjb2RlX2J1dHRvbiwgY29uZmlnICk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoICdjdXN0b21pemUnID09PSBzaG9ydGNvZGVfY29tbWFuZCApIHtcblx0XHRcdFx0XHRjdXN0b21pemVfYm9va2luZ19yZXNvdXJjZV9zaG9ydGNvZGUoIHNob3J0Y29kZV9yZXNvdXJjZV9pZCwgc2hvcnRjb2RlX3ZhbHVlICk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoICdwdWJsaXNoJyA9PT0gc2hvcnRjb2RlX2NvbW1hbmQgKSB7XG5cdFx0XHRcdFx0cHVibGlzaF9ib29raW5nX3Jlc291cmNlX3Nob3J0Y29kZSggc2hvcnRjb2RlX3Jlc291cmNlX2lkLCBzaG9ydGNvZGVfdmFsdWUsIHNob3J0Y29kZV9idXR0b24gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGNyZWF0ZV9idXR0b24gKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdG9wZW5faW5zcGVjdG9yKCBjb25maWcsICdjcmVhdGUnLCAwLCBjcmVhdGVfYnV0dG9uICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggdXBncmFkZV9idXR0b24gKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdG9wZW5fYm9va2luZ19yZXNvdXJjZV91cGdyYWRlX2RpYWxvZyggdXBncmFkZV9idXR0b24gKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjYW5jZWxfYnV0dG9uICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRpZiAoICdpbmxpbmVfcmV2aWV3JyA9PT0gaW5zcGVjdG9yX21vZGUgKSB7XG5cdFx0XHRcdFx0aW5zcGVjdG9yX2RpcnR5ID0gZmFsc2U7XG5cdFx0XHRcdFx0Y2xvc2VfaW5zcGVjdG9yKCBjb25maWcsIGZhbHNlICk7XG5cdFx0XHRcdFx0aW5saW5lX3N0YXRlLnJldmlld190b2tlbiA9ICcnO1xuXHRcdFx0XHRcdHN5bmNocm9uaXplX2lubGluZV9jb250cm9scyggY29uZmlnICk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoICdjYXBhY2l0eV9yZXZpZXcnID09PSBpbnNwZWN0b3JfbW9kZSAmJiBpbnNwZWN0b3JfY2FwYWNpdHlfY29udGV4dCApIHtcblx0XHRcdFx0XHR2YXIgcmV2aWV3ZWRfdGFyZ2V0X2NhcGFjaXR5ID0gaW5zcGVjdG9yX2NhcGFjaXR5X3RhcmdldDtcblx0XHRcdFx0XHR2YXIgcmV2aWV3ZWRfZGV0YWNoX2lkcyA9IGluc3BlY3Rvcl9jYXBhY2l0eV9kZXRhY2hfaWRzLnNsaWNlKCk7XG5cdFx0XHRcdFx0dmFyIHJldmlld2VkX2RlY3JlYXNlX2FjdGlvbiA9IGluc3BlY3Rvcl9jYXBhY2l0eV9kZWNyZWFzZV9hY3Rpb247XG5cdFx0XHRcdFx0aW5zcGVjdG9yX2RpcnR5ID0gZmFsc2U7XG5cdFx0XHRcdFx0cmVuZGVyX2NhcGFjaXR5X2VkaXRvciggY29uZmlnLCBpbnNwZWN0b3JfY2FwYWNpdHlfY29udGV4dCApO1xuXHRcdFx0XHRcdGluc3BlY3Rvcl9jYXBhY2l0eV90YXJnZXQgPSByZXZpZXdlZF90YXJnZXRfY2FwYWNpdHk7XG5cdFx0XHRcdFx0aW5zcGVjdG9yX2NhcGFjaXR5X2RldGFjaF9pZHMgPSByZXZpZXdlZF9kZXRhY2hfaWRzO1xuXHRcdFx0XHRcdGluc3BlY3Rvcl9jYXBhY2l0eV9kZWNyZWFzZV9hY3Rpb24gPSByZXZpZXdlZF9kZWNyZWFzZV9hY3Rpb247XG5cdFx0XHRcdFx0c3luY2hyb25pemVfY2FwYWNpdHlfZWRpdG9yKCBjb25maWcgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjbG9zZV9pbnNwZWN0b3IoIGNvbmZpZywgdHJ1ZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggcmVtb3ZlX2ltYWdlX2J1dHRvbiApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0dmFyIGltYWdlX2ZpZWxkID0gcmVtb3ZlX2ltYWdlX2J1dHRvbi5jbG9zZXN0KCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWZpZWxkLXdyYXBdJyApLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtZmllbGQ9XCJwaWN0dXJlX3VybFwiXScgKTtcblx0XHRcdFx0aWYgKCBpbWFnZV9maWVsZCApIHtcblx0XHRcdFx0XHRpbWFnZV9maWVsZC52YWx1ZSA9ICcnO1xuXHRcdFx0XHRcdHN5bmNocm9uaXplX2luc3BlY3Rvcl9pbWFnZSggaW1hZ2VfZmllbGQgKTtcblx0XHRcdFx0XHRzeW5jaHJvbml6ZV9pbnNwZWN0b3JfZGlydHlfc3RhdGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgaW5saW5lX3N0YXRlLmFjdGl2ZSAmJiByZXNvdXJjZV9yb3cgJiYgISBldmVudC50YXJnZXQuY2xvc2VzdCggJ2EsIGJ1dHRvbiwgaW5wdXQsIHNlbGVjdCwgdGV4dGFyZWEsIHN1bW1hcnksIGRldGFpbHMsIGxhYmVsJyApICkge1xuXHRcdFx0XHRvcGVuX2luc3BlY3RvciggY29uZmlnLCAnZWRpdCcsIE51bWJlciggcmVzb3VyY2Vfcm93LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWlkJyApICkgfHwgMCwgcmVzb3VyY2Vfcm93ICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHRpZiAoIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy1jYXRhbG9nLWNhcGFjaXR5LXRhcmdldF0sIFtkYXRhLXdwYmMtY2F0YWxvZy1jYXBhY2l0eS1yYW5nZV0nICkgKSB7XG5cdFx0XHRcdHZhciBjb250ZXh0ID0gaW5zcGVjdG9yX2NhcGFjaXR5X2NvbnRleHQgfHwge307XG5cdFx0XHRcdHZhciBtaW5pbXVtID0gTnVtYmVyKCBjb250ZXh0Lm1pbmltdW1fY2FwYWNpdHkgKSB8fCAxO1xuXHRcdFx0XHR2YXIgbWF4aW11bSA9IE51bWJlciggY29udGV4dC5tYXhpbXVtX2NhcGFjaXR5ICkgfHwgbWluaW11bTtcblx0XHRcdFx0dmFyIHJlcXVlc3RlZF9jYXBhY2l0eSA9IE1hdGgucm91bmQoIE51bWJlciggZXZlbnQudGFyZ2V0LnZhbHVlICkgfHwgbWluaW11bSApO1xuXG5cdFx0XHRcdGluc3BlY3Rvcl9jYXBhY2l0eV90YXJnZXQgPSBNYXRoLm1heCggbWluaW11bSwgTWF0aC5taW4oIG1heGltdW0sIHJlcXVlc3RlZF9jYXBhY2l0eSApICk7XG5cdFx0XHRcdHN5bmNocm9uaXplX2NhcGFjaXR5X2VkaXRvciggY29uZmlnICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggZXZlbnQudGFyZ2V0Lm1hdGNoZXMoICdbZGF0YS13cGJjLWNhdGFsb2ctaW5saW5lLWZpZWxkXScgKSApIHtcblx0XHRcdFx0c3luY2hyb25pemVfaW5saW5lX2RyYWZ0cyggY29uZmlnICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggZXZlbnQudGFyZ2V0Lm1hdGNoZXMoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtYnVsay12YWx1ZV0sIFtkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1idWxrLXJhbmdlXScgKSApIHtcblx0XHRcdFx0c3luY2hyb25pemVfYnVsa19lZGl0b3IoIGV2ZW50LnRhcmdldCApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLXJhbmdlXScgKSApIHtcblx0XHRcdFx0c3luY2hyb25pemVfaW5zcGVjdG9yX251bWJlcl9mcm9tX3JhbmdlKCBldmVudC50YXJnZXQgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1pbnNwZWN0b3ItZm9ybV0gW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWZpZWxkXScgKSApIHtcblx0XHRcdFx0aWYgKCAncGljdHVyZV91cmwnID09PSBldmVudC50YXJnZXQuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtZmllbGQnICkgKSB7XG5cdFx0XHRcdFx0c3luY2hyb25pemVfaW5zcGVjdG9yX2ltYWdlKCBldmVudC50YXJnZXQgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICdudW1iZXInID09PSBldmVudC50YXJnZXQudHlwZSApIHtcblx0XHRcdFx0XHRzeW5jaHJvbml6ZV9pbnNwZWN0b3JfbnVtZXJpY19yYW5nZSggZXZlbnQudGFyZ2V0LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWZpZWxkJyApIHx8ICcnICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0c3luY2hyb25pemVfaW5zcGVjdG9yX2RpcnR5X3N0YXRlKCk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0aWYgKCBnZXRfZGVsZXRlX3Jldmlld193b3JrZmxvdygpICYmIGdldF9kZWxldGVfcmV2aWV3X3dvcmtmbG93KCkuaGFuZGxlX2NoYW5nZSggZXZlbnQgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtY2F0YWxvZy1jYXBhY2l0eS1kZWNyZWFzZS1hY3Rpb25dJyApICkge1xuXHRcdFx0XHRpbnNwZWN0b3JfY2FwYWNpdHlfZGVjcmVhc2VfYWN0aW9uID0gJ2RlbGV0ZScgPT09IGV2ZW50LnRhcmdldC52YWx1ZSA/ICdkZWxldGUnIDogJ2RldGFjaCc7XG5cdFx0XHRcdHN5bmNocm9uaXplX2NhcGFjaXR5X2VkaXRvciggY29uZmlnICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggZXZlbnQudGFyZ2V0Lm1hdGNoZXMoICdbZGF0YS13cGJjLWNhdGFsb2ctY2FwYWNpdHktZGV0YWNoXScgKSApIHtcblx0XHRcdFx0dmFyIGRldGFjaF9pZCA9IE51bWJlciggZXZlbnQudGFyZ2V0LnZhbHVlICkgfHwgMDtcblx0XHRcdFx0aWYgKCBldmVudC50YXJnZXQuY2hlY2tlZCApIHtcblx0XHRcdFx0XHRpZiAoIC0xID09PSBpbnNwZWN0b3JfY2FwYWNpdHlfZGV0YWNoX2lkcy5pbmRleE9mKCBkZXRhY2hfaWQgKSApIHtcblx0XHRcdFx0XHRcdGluc3BlY3Rvcl9jYXBhY2l0eV9kZXRhY2hfaWRzLnB1c2goIGRldGFjaF9pZCApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpbnNwZWN0b3JfY2FwYWNpdHlfZGV0YWNoX2lkcyA9IGluc3BlY3Rvcl9jYXBhY2l0eV9kZXRhY2hfaWRzLmZpbHRlciggZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHsgcmV0dXJuIHJlc291cmNlX2lkICE9PSBkZXRhY2hfaWQ7IH0gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzeW5jaHJvbml6ZV9jYXBhY2l0eV9lZGl0b3IoIGNvbmZpZyApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy1jYXRhbG9nLWlubGluZS1maWVsZF0nICkgKSB7XG5cdFx0XHRcdHN5bmNocm9uaXplX2lubGluZV9kcmFmdHMoIGNvbmZpZyApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWJ1bGstZW5hYmxlXSwgW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWJ1bGstb3BlcmF0aW9uXSwgW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWJ1bGstdmFsdWVdLCBbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtYnVsay1yYW5nZV0nICkgKSB7XG5cdFx0XHRcdHN5bmNocm9uaXplX2J1bGtfZWRpdG9yKCBldmVudC50YXJnZXQgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtY2F0YWxvZy1jYXBhY2l0eS1kZWxldGUtYWNrbm93bGVkZ2VtZW50XScgKSApIHtcblx0XHRcdFx0dmFyIGNhcGFjaXR5X2RlbGV0ZV9idXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWluc3BlY3Rvci1zYXZlXScgKTtcblx0XHRcdFx0dmFyIGNhcGFjaXR5X2Fja25vd2xlZGdlbWVudCA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnLndwYmNfYm9va2luZ19yZXNvdXJjZXNfX2RlbGV0ZV9hY2tub3dsZWRnZW1lbnQnICk7XG5cblx0XHRcdFx0aWYgKCBldmVudC50YXJnZXQuY2hlY2tlZCAmJiBjYXBhY2l0eV9hY2tub3dsZWRnZW1lbnQgKSB7XG5cdFx0XHRcdFx0Y2FwYWNpdHlfYWNrbm93bGVkZ2VtZW50LmNsYXNzTGlzdC5yZW1vdmUoICd3cGJjX2Jvb2tpbmdfcmVzb3VyY2VzX19kZWxldGVfYWNrbm93bGVkZ2VtZW50LS1hdHRlbnRpb24nICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cHVsc2VfZGVsZXRlX2Fja25vd2xlZGdlbWVudCggY2FwYWNpdHlfYWNrbm93bGVkZ2VtZW50ICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBjYXBhY2l0eV9kZWxldGVfYnV0dG9uICkge1xuXHRcdFx0XHRcdGNhcGFjaXR5X2RlbGV0ZV9idXR0b24uZGlzYWJsZWQgPSAhIGV2ZW50LnRhcmdldC5jaGVja2VkO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggZXZlbnQudGFyZ2V0Lm1hdGNoZXMoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtcmFuZ2VdJyApICkge1xuXHRcdFx0XHRzeW5jaHJvbml6ZV9pbnNwZWN0b3JfbnVtYmVyX2Zyb21fcmFuZ2UoIGV2ZW50LnRhcmdldCApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLXJhZGlvLWZpZWxkPVwiY3JlYXRpb25fbW9kZVwiXScgKSApIHtcblx0XHRcdFx0c3luY2hyb25pemVfY3JlYXRlX2luc3BlY3Rvcl9jb250cm9scygpO1xuXHRcdFx0XHRzeW5jaHJvbml6ZV9pbnNwZWN0b3JfZGlydHlfc3RhdGUoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1pbnNwZWN0b3ItZm9ybV0gW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWZpZWxkXScgKSApIHtcblx0XHRcdFx0aWYgKCAnY3JlYXRlJyA9PT0gaW5zcGVjdG9yX21vZGUgKSB7XG5cdFx0XHRcdFx0c3luY2hyb25pemVfY3JlYXRlX2luc3BlY3Rvcl9jb250cm9scygpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHN5bmNocm9uaXplX2luc3BlY3Rvcl9kaXJ0eV9zdGF0ZSgpO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0XHRpZiAoIHdpbmRvdy5qUXVlcnkgKSB7XG5cdFx0XHR3aW5kb3cualF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLm9uKCAnd3BiYzpyaWdodC1zaWRlYmFyLWJlZm9yZS1jb250ZW50LWNvbGxhcHNlLndwYmNDYXRhbG9nQm9va2luZ1Jlc291cmNlcycsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHRcdHZhciBjbG9zaW5nX21vZGUgPSBpbnNwZWN0b3JfbW9kZTtcblxuXHRcdFx0XHRpZiAoIGluc3BlY3Rvcl9tb2RlICYmICEgY2xvc2VfaW5zcGVjdG9yKCBjb25maWcsIHRydWUgKSApIHtcblx0XHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICdpbmxpbmVfcmV2aWV3JyA9PT0gY2xvc2luZ19tb2RlICkge1xuXHRcdFx0XHRcdGlubGluZV9zdGF0ZS5yZXZpZXdfdG9rZW4gPSAnJztcblx0XHRcdFx0XHRzeW5jaHJvbml6ZV9pbmxpbmVfY29udHJvbHMoIGNvbmZpZyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHR3aW5kb3cualF1ZXJ5KCBkb2N1bWVudCApLm9uKCAnd3BiY19tZWRpYV91cGxvYWRfdXJsX3NldCcsICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtZmllbGQ9XCJwaWN0dXJlX3VybFwiXScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0c3luY2hyb25pemVfaW5zcGVjdG9yX2ltYWdlKCB0aGlzICk7XG5cdFx0XHRcdHN5bmNocm9uaXplX2luc3BlY3Rvcl9kaXJ0eV9zdGF0ZSgpO1xuXHRcdFx0fSApO1xuXHRcdFx0d2luZG93LmpRdWVyeSggZG9jdW1lbnQgKS5vbiggJ3dwYmM6cmVzb3VyY2Utc2hvcnRjb2RlLXNlbGVjdGVkJywgZnVuY3Rpb24gKCBldmVudCwgc2VsZWN0aW9uICkge1xuXHRcdFx0XHR2YXIgc2VsZWN0ZWRfcmVzb3VyY2VfaWQgPSBOdW1iZXIoIHNlbGVjdGlvbiAmJiBzZWxlY3Rpb24ucmVzb3VyY2VfaWQgPyBzZWxlY3Rpb24ucmVzb3VyY2VfaWQgOiAwICk7XG5cdFx0XHRcdHZhciBzZWxlY3RlZF9zaG9ydGNvZGUgPSBTdHJpbmcoIHNlbGVjdGlvbiAmJiBzZWxlY3Rpb24uc2hvcnRjb2RlID8gc2VsZWN0aW9uLnNob3J0Y29kZSA6ICcnICk7XG5cdFx0XHRcdHZhciBpbnNwZWN0b3Jfc2hvcnRjb2RlO1xuXG5cdFx0XHRcdGlmICggISBzZWxlY3RlZF9yZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0c3luY2hyb25pemVfYm9va2luZ19yZXNvdXJjZV9zaG9ydGNvZGVfaW5wdXQoIHNlbGVjdGVkX3Jlc291cmNlX2lkLCBzZWxlY3RlZF9zaG9ydGNvZGUgKTtcblx0XHRcdFx0ZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1pZD1cIicgKyBTdHJpbmcoIHNlbGVjdGVkX3Jlc291cmNlX2lkICkgKyAnXCJdW2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLXNob3J0Y29kZS1jb21tYW5kXScgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGFjdGlvbl9idXR0b24gKSB7XG5cdFx0XHRcdFx0YWN0aW9uX2J1dHRvbi5zZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1zaG9ydGNvZGUnLCBzZWxlY3RlZF9zaG9ydGNvZGUgKTtcblx0XHRcdFx0fSApO1xuXHRcdFx0XHR2YXIgZGV0YWlsc19yb3cgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc291cmNlLWRldGFpbHMtcm93PVwiJyArIFN0cmluZyggc2VsZWN0ZWRfcmVzb3VyY2VfaWQgKSArICdcIl0nICk7XG5cdFx0XHRcdHZhciBkZXRhaWxzX2NvZGUgPSBkZXRhaWxzX3JvdyA/IGRldGFpbHNfcm93LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzb3VyY2UtZGV0YWlscy1zZWN0aW9uPVwiYm9va2luZ19wYWdlXCJdIGNvZGUnICkgOiBudWxsO1xuXHRcdFx0XHRpZiAoIGRldGFpbHNfY29kZSApIHtcblx0XHRcdFx0XHRkZXRhaWxzX2NvZGUudGV4dENvbnRlbnQgPSBzZWxlY3RlZF9zaG9ydGNvZGU7XG5cdFx0XHRcdFx0ZGV0YWlsc19jb2RlLnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy11aS1jYXRhbG9nLW92ZXJmbG93LXRvb2x0aXAnLCBzZWxlY3RlZF9zaG9ydGNvZGUgKTtcblx0XHRcdFx0XHRzeW5jaHJvbml6ZV9vdmVyZmxvd190b29sdGlwcyggZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIGNvbmZpZy5tb3VudF9pZCApICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBzZWxlY3RlZF9yZXNvdXJjZV9pZCA9PT0gaW5zcGVjdG9yX3Jlc291cmNlX2lkICkge1xuXHRcdFx0XHRcdGluc3BlY3Rvcl9zaG9ydGNvZGUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLXJlc291cmNlLWluc3BlY3Rvci1mb3JtXSAud3BiY19jYXRhbG9nX2Jvb2tpbmdfcmVzb3VyY2VzX19lZGl0b3JfY29kZScgKTtcblx0XHRcdFx0XHRpZiAoIGluc3BlY3Rvcl9zaG9ydGNvZGUgKSB7XG5cdFx0XHRcdFx0XHRpbnNwZWN0b3Jfc2hvcnRjb2RlLnZhbHVlID0gc2VsZWN0ZWRfc2hvcnRjb2RlO1xuXHRcdFx0XHRcdFx0c3luY2hyb25pemVfaW5zcGVjdG9yX2RpcnR5X3N0YXRlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fVxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdzdWJtaXQnLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0aWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtY2F0YWxvZy1pbmxpbmUtcmV2aWV3LWZvcm1dJyApICkge1xuXHRcdFx0XHRhcHBseV9pbmxpbmVfY2hhbmdlcyggZXZlbnQsIGNvbmZpZyApO1xuXHRcdFx0fSBlbHNlIGlmICggZXZlbnQudGFyZ2V0Lm1hdGNoZXMoICdbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtaW5zcGVjdG9yLWZvcm1dJyApICkge1xuXHRcdFx0XHRzdWJtaXRfaW5zcGVjdG9yKCBldmVudCwgY29uZmlnICk7XG5cdFx0XHR9IGVsc2UgaWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1idWxrLWZvcm1dLCBbZGF0YS13cGJjLWNhdGFsb2ctcmVzb3VyY2UtYnVsay1yZXZpZXctZm9ybV0sIFtkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1kZWxldGUtZm9ybV0sIFtkYXRhLXdwYmMtY2F0YWxvZy1yZXNvdXJjZS1jYXBhY2l0eS1mb3JtXScgKSApIHtcblx0XHRcdFx0c3VibWl0X3Jldmlld2VkX2luc3BlY3RvciggZXZlbnQsIGNvbmZpZyApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ2JlZm9yZXVubG9hZCcsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHRpZiAoIGluc3BlY3Rvcl9kaXJ0eSB8fCBpbnNwZWN0b3JfbXV0YXRpb25faW5fcHJvZ3Jlc3MgfHwgKCBpbmxpbmVfc3RhdGUuYWN0aXZlICYmIGlubGluZV9zdGF0ZS5jaGFuZ2VkX3Jvd3MubGVuZ3RoICkgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGV2ZW50LnJldHVyblZhbHVlID0gJyc7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHR9XG5cblx0aWYgKCAnbG9hZGluZycgPT09IGRvY3VtZW50LnJlYWR5U3RhdGUgKSB7XG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ0RPTUNvbnRlbnRMb2FkZWQnLCBtb3VudF9ib29raW5nX3Jlc291cmNlc19jYXRhbG9nICk7XG5cdH0gZWxzZSB7XG5cdFx0bW91bnRfYm9va2luZ19yZXNvdXJjZXNfY2F0YWxvZygpO1xuXHR9XG59KCB3aW5kb3csIGRvY3VtZW50ICkgKTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0UsV0FBV0EsTUFBTSxFQUFFQyxRQUFRLEVBQUc7RUFDL0IsWUFBWTs7RUFFWixJQUFJQyxrQkFBa0IsR0FBRyxJQUFJO0VBQzdCLElBQUlDLDBCQUEwQixHQUFHLElBQUk7RUFDckMsSUFBSUMsaUNBQWlDLEdBQUcsSUFBSTtFQUM1QyxJQUFJQyxpQ0FBaUMsR0FBRyxJQUFJO0VBQzVDLElBQUlDLDZCQUE2QixHQUFHLElBQUk7RUFDeEMsSUFBSUMsZ0JBQWdCLEdBQUcsSUFBSTtFQUMzQixJQUFJQyx3QkFBd0IsR0FBRyxJQUFJO0VBQ25DLElBQUlDLHdCQUF3QixHQUFHLENBQUM7RUFDaEMsSUFBSUMsbUJBQW1CLEdBQUcsQ0FBQztFQUMzQixJQUFJQyxxQkFBcUIsR0FBRyxJQUFJO0VBQ2hDLElBQUlDLHVCQUF1QixHQUFHLEVBQUU7RUFDaEMsSUFBSUMsZUFBZSxHQUFHLEtBQUs7RUFDM0IsSUFBSUMsc0JBQXNCLEdBQUcsSUFBSTtFQUNqQyxJQUFJQyxjQUFjLEdBQUcsRUFBRTtFQUN2QixJQUFJQyw4QkFBOEIsR0FBRyxLQUFLO0VBQzFDLElBQUlDLG1DQUFtQyxHQUFHLENBQUM7RUFDM0MsSUFBSUMseUJBQXlCLEdBQUcsRUFBRTtFQUNsQyxJQUFJQywwQkFBMEIsR0FBRyxDQUFDO0VBQ2xDLElBQUlDLHFCQUFxQixHQUFHLENBQUM7RUFDN0IsSUFBSUMsc0JBQXNCLEdBQUcsRUFBRTtFQUMvQixJQUFJQyx5QkFBeUIsR0FBRyxDQUFDLENB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
