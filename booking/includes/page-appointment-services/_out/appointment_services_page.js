"use strict";

(function (w, $) {
  'use strict';

  var config = w.wpbc_appointment_services_config || {};
  var state = {
    storageReady: false,
    catalog_loading: true,
    selectedId: Number(config.selected_id || 0),
    requested_focus: String(config.focus_section || ''),
    focus_handled: false,
    busy: false,
    status: 'all',
    services: [],
    providers: {},
    providerCount: 0,
    editor_snapshot: '',
    editor_request_sequence: 0,
    initial_selection_pending: 0 < Number(config.selected_id || 0),
    inspector_focus_target: null,
    mutation_in_progress: false,
    operation_mode: '',
    operation_review: null,
    operation_request_sequence: 0,
    inline_editing: false,
    inline_drafts: {},
    inline_schema: {},
    inline_schema_loading: false,
    inline_request_sequence: 0,
    last_response: null,
    page: 1,
    page_size: Number(config.catalog && config.catalog.initial_request && config.catalog.initial_request.items_per_page ? config.catalog.initial_request.items_per_page : 10),
    total_items: 0,
    total_pages: 0,
    sort_by: String(config.catalog && config.catalog.initial_request && config.catalog.initial_request.sort_by ? config.catalog.initial_request.sort_by : 'service_id'),
    sort_order: String(config.catalog && config.catalog.initial_request && config.catalog.initial_request.sort_order ? config.catalog.initial_request.sort_order : 'desc')
  };
  var catalogController = false;
  var inlineWorkflowController = false;
  var inlineReviewWorkflowController = false;
  var deleteReviewWorkflowController = false;
  var inspectorWorkflowController = false;
  var searchTimer = 0;
  var weekdayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  var pending_highlight_ids = [];

  /** Extract an API message while preserving a caller-provided fallback. */
  function messageFrom(response, fallback) {
    return response && response.data && response.data.message ? response.data.message : fallback;
  }
  /** Display a shared Booking Calendar administrator notice. */
  function notify(message, type) {
    if (message && typeof w.wpbc_admin_show_message === 'function') {
      w.wpbc_admin_show_message(message, type || 'info', 5000, false);
    }
  }
  /**
   * Return the shared signed-review presentation controller.
   *
   * @return {Object|false} Shared review controller or false when unavailable.
   */
  function get_inline_review_workflow() {
    if (inlineReviewWorkflowController) {
      return inlineReviewWorkflowController;
    }
    if (!w.wpbc_ui_catalog || 'function' !== typeof w.wpbc_ui_catalog.create_inline_review_workflow) {
      return false;
    }
    inlineReviewWorkflowController = w.wpbc_ui_catalog.create_inline_review_workflow({
      apply_selector: '.wpbc_appointment_services__operation_apply',
      cancel_selector: '.wpbc_appointment_services__cancel',
      root: document
    });
    return inlineReviewWorkflowController;
  }
  /**
   * Return the shared permanent-deletion presentation controller.
   *
   * @return {Object|false} Shared deletion controller or false when unavailable.
   */
  function get_delete_review_workflow() {
    if (deleteReviewWorkflowController) {
      return deleteReviewWorkflowController;
    }
    if (!w.wpbc_ui_catalog || 'function' !== typeof w.wpbc_ui_catalog.create_delete_review_workflow) {
      return false;
    }
    deleteReviewWorkflowController = w.wpbc_ui_catalog.create_delete_review_workflow({
      acknowledgement_selector: '[data-wpbc-ui-catalog-delete-acknowledgement]',
      apply_selector: '.wpbc_appointment_services__operation_apply',
      cancel_selector: '.wpbc_appointment_services__cancel',
      root: document
    });
    return deleteReviewWorkflowController;
  }
  /**
   * Show the native Booking Calendar Processing notice.
   *
   * The returned element identifies this specific request's notice so
   * overlapping requests cannot dismiss each other's feedback.
   *
   * @return {jQuery} Processing notice wrapper, or an empty collection.
   */
  function show_processing_notice() {
    if ('function' !== typeof w.wpbc_admin_show_message_processing) {
      return $();
    }
    w.wpbc_admin_show_message_processing('');
    return $('#ajax_working .wpbc_processing.wpbc_spin').last().closest('[id^="wpbc_notice_"]');
  }
  /**
   * Hide the Processing notice created for one completed request.
   *
   * @param {jQuery} $processing_notice Notice wrapper returned by show_processing_notice().
   * @return {void}
   */
  function hide_processing_notice($processing_notice) {
    if ($processing_notice && $processing_notice.length) {
      $processing_notice.stop(true, true).hide();
    }
  }
  /**
   * Send an authenticated Appointment Services AJAX request.
   *
   * Requests normally use the shared administrator Processing notice and remove
   * only their own notice after settling. Inspector-loading requests may opt out
   * because the shared inspector already exposes equivalent progress feedback.
   *
   * @param {string} action WordPress AJAX action name.
   * @param {Object}  data                   Request-specific payload.
   * @param {boolean} use_processing_notice Whether to show the global notice.
   * @return {jqXHR} jQuery AJAX promise for the request.
   */
  function request(action, data, use_processing_notice) {
    var $processing_notice = false === use_processing_notice ? $() : show_processing_notice();
    return $.ajax({
      url: config.ajax_url,
      type: 'POST',
      dataType: 'json',
      data: $.extend({
        action: action,
        nonce: config.nonce
      }, data || {})
    }).always(function () {
      hide_processing_notice($processing_notice);
    });
  }
  /** Activate the Settings or Help panel selected in the right sidebar. */
  function switchRightPanel($tab) {
    var panelId = $tab.attr('aria-controls');
    var panel = panelId ? document.getElementById(panelId) : null;
    var $tabs = $tab.closest('.wpbc_appointment_services__rightbar_tabs').find('[role="tab"]');
    var $panels = $('.wpbc_appointment_services__rightbar [role="tabpanel"]');
    if (!panel) {
      return;
    }
    $tabs.attr('aria-selected', 'false');
    $tab.attr('aria-selected', 'true');
    $panels.prop('hidden', true).attr('aria-hidden', 'true');
    $(panel).prop('hidden', false).attr('aria-hidden', 'false');
    updateControls();
  }
  /**
   * Tell the active Setup Wizard bar that the page workspace changed width.
   *
   * The delayed notification runs after the shared sidebar transition so the
   * setup bar can measure the final inspector boundary.
   *
   * @return {void}
   */
  function notify_setup_wizard_layout_changed() {
    $(document).trigger('wpbc_setup_wizard_layout_changed');
    w.setTimeout(function () {
      $(document).trigger('wpbc_setup_wizard_layout_changed');
    }, 300);
  }
  /**
   * Expand the right sidebar and display the Service Settings inspector.
   *
   * @return {void}
   */
  function expand_service_inspector() {
    var $settings_tab = $('#wpbc_tab_service_settings');
    if ('function' === typeof w.wpbc_admin_ui__sidebar_right__do_max) {
      w.wpbc_admin_ui__sidebar_right__do_max();
    }
    if ($settings_tab.length) {
      switchRightPanel($settings_tab);
    }
    notify_setup_wizard_layout_changed();
  }
  /**
   * Reveal, expand, highlight, and optionally focus one Service editor group.
   *
   * @param {string} fields_selector Group fields selector from the fixed editor markup.
   * @param {string} focus_selector  Optional control selector to focus after scrolling.
   * @return {boolean} True when the requested inspector group was found.
   */
  function open_service_inspector_group(fields_selector, focus_selector) {
    var $group_fields = $(fields_selector);
    var $group = $group_fields.closest('.wpbc_ui__collapsible_group');
    var $group_header = $group.children('.group__header');
    var group_element = $group.get(0);
    var focus_element = focus_selector ? document.querySelector(focus_selector) : null;
    expand_service_inspector();
    if (!$group.length) {
      return false;
    }
    $group.addClass('is-open');
    $group_header.attr('aria-expanded', 'true');
    $group_fields.prop('hidden', false).attr('aria-hidden', 'false');
    $group.removeClass('wpbc_appointment_services__focus_pulse');
    if (group_element) {
      void group_element.offsetWidth;
      $group.addClass('wpbc_appointment_services__focus_pulse');
      try {
        group_element.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        });
      } catch (error) {
        group_element.scrollIntoView(true);
      }
      w.setTimeout(function () {
        $group.removeClass('wpbc_appointment_services__focus_pulse');
      }, 900);
    }
    if (focus_element && typeof focus_element.focus === 'function') {
      try {
        focus_element.focus({
          preventScroll: true
        });
      } catch (error) {
        focus_element.focus();
      }
    }
    return true;
  }
  /**
   * Open, reveal, and highlight the General Service editor section.
   *
   * @return {void}
   */
  function open_add_service_inspector() {
    open_service_inspector_group('#wpbc_service_general', '[data-service-field="title"]');
  }
  /**
   * Apply the one-time inspector focus requested by an administration link.
   *
   * @return {void}
   */
  function focus_requested_service_section() {
    if (state.focus_handled || 'booking_form' !== state.requested_focus) {
      return;
    }
    if (open_service_inspector_group('#wpbc_service_form', '[data-service-field="booking_form_id"]')) {
      state.focus_handled = true;
      if (w.history && w.URL) {
        var url = new w.URL(w.location.href);
        url.searchParams.delete('wpbc_service_focus');
        w.history.replaceState({}, '', url.toString());
      }
    }
  }
  /** Expand or collapse one inspector field group. */
  function toggleInspectorGroup($button) {
    var $group = $button.closest('.wpbc_ui__collapsible_group');
    var $fields = $group.find('> .group__fields');
    var isOpen = $group.hasClass('is-open');
    $group.toggleClass('is-open', !isOpen);
    $button.attr('aria-expanded', isOpen ? 'false' : 'true');
    $fields.prop('hidden', isOpen).attr('aria-hidden', isOpen ? 'true' : 'false');
  }
  /** Determine whether a Service is currently loaded into the editor. */
  function editorIsOpen() {
    return !$('[data-service-field="title"]').prop('disabled');
  }
  /**
   * Synchronize one numeric Service field with its range control.
   *
   * Non-price sliders expand to represent an existing value above their normal
   * visual range. The price slider remains the product-defined 0-1000 control;
   * its number field can still preserve and submit a legacy value above 1000.
   *
   * @param {string} field_id Service field identifier.
   * @return {void}
   */
  function sync_numeric_range(field_id) {
    var $field = $('[data-service-field="' + field_id + '"]');
    var $range = $('[data-service-range-field="' + field_id + '"]');
    var value = Number($field.val());
    var default_min = Number($range.data('service-range-default-min'));
    var default_max = Number($range.data('service-range-default-max'));
    var step = Number($range.attr('step') || 1);
    var range_max;
    if (!$field.length || !$range.length || !isFinite(value)) {
      return;
    }
    default_min = isFinite(default_min) ? default_min : 0;
    default_max = isFinite(default_max) ? default_max : 100;
    step = isFinite(step) && step > 0 ? step : 1;
    range_max = 'base_cost' === field_id || value <= default_max ? default_max : default_min + Math.ceil((value - default_min) / step) * step;
    $range.attr({
      min: default_min,
      max: range_max
    }).val(value);
  }
  /**
   * Synchronize every numeric Service field with its range control.
   *
   * @return {void}
   */
  function sync_all_numeric_ranges() {
    $('[data-service-range-field]').each(function () {
      sync_numeric_range(String($(this).data('service-range-field') || ''));
    });
  }
  /**
   * Synchronize the visible Status radios with the stored Service status field.
   *
   * @return {void}
   */
  function sync_status_radios() {
    var status = String($('[data-service-field="status"]').val() || 'active');
    $('[data-service-status-choice]').each(function () {
      $(this).prop('checked', String($(this).val()) === status);
    });
  }
  /**
   * Synchronize the Service image preview with the readonly URL field.
   *
   * @return {void}
   */
  function updateMediaPreview() {
    var pictureUrl = String($('[data-service-field="picture_url"]').val() || '').trim();
    var $image = $('.wpbc_appointment_services__media_image');
    if (pictureUrl) {
      $image.attr('src', pictureUrl);
    } else {
      $image.removeAttr('src');
    }
    $image.prop('hidden', !pictureUrl);
    $('.wpbc_appointment_services__media_placeholder').prop('hidden', !!pictureUrl);
  }
  /** Synchronize toolbar and inspector action states with the page state. */
  function updateControls() {
    var open = state.storageReady && editorIsOpen();
    var operation_open = !!state.operation_mode && 'loading' !== state.operation_mode;
    var operation_is_review = 'bulk_review' === state.operation_mode || 'inline_review' === state.operation_mode || 'delete_review' === state.operation_mode;
    var operation_is_delete_review = 'delete_review' === state.operation_mode;
    var hasPicture = !!String($('[data-service-field="picture_url"]').val() || '').trim();
    var show_save = (open || operation_open) && 'true' === $('#wpbc_tab_service_settings').attr('aria-selected');
    $('.wpbc_appointment_services__add').prop('hidden', false).prop('disabled', !state.storageReady || state.busy);
    $('.wpbc_appointment_services__right_sidebar_footer, .wpbc_appointment_services__top_actions').prop('hidden', !show_save);
    $('.wpbc_appointment_services__cancel').prop('hidden', !show_save).prop('disabled', !open && !operation_open || state.busy);
    $('.wpbc_appointment_services__save').prop('hidden', !show_save || operation_open).prop('disabled', !open || state.busy);
    $('.wpbc_appointment_services__operation_review').prop('hidden', 'bulk_edit' !== state.operation_mode).prop('disabled', 'bulk_edit' !== state.operation_mode || state.busy || !collect_bulk_changes());
    $('.wpbc_appointment_services__operation_apply').prop('hidden', !operation_is_review);
    if (!operation_is_delete_review) {
      $('.wpbc_appointment_services__operation_apply').prop('disabled', !operation_is_review || state.busy || !state.operation_review);
    }
    $('.wpbc_appointment_services__duplicate, .wpbc_appointment_services__archive').prop('disabled', !open || !state.selectedId || state.busy);
    $('.wpbc_appointment_services__media_preview, .wpbc_appointment_services__select_image').prop('disabled', !open || state.busy);
    $('.wpbc_appointment_services__remove_image').prop('disabled', !open || !hasPicture || state.busy);
    synchronize_inline_workflow();
  }

  /** Synchronize the shared inline workflow from Service-owned state. */
  function synchronize_inline_workflow() {
    var changed_count = get_inline_changed_count();
    if (!inlineWorkflowController) {
      return;
    }
    inlineWorkflowController.synchronize({
      active: state.inline_editing,
      busy: state.busy,
      changed_count: changed_count,
      count_text: String(config.i18n.changed_rows || '%s changed rows').replace('%s', changed_count),
      has_items: 0 < state.services.length,
      lock_controls: state.inline_schema_loading || !!state.operation_mode,
      toggle_disabled: state.catalog_loading || !state.storageReady || !!state.operation_mode,
      active_toggle_text: config.i18n.editing_rows,
      inactive_toggle_text: config.catalog && config.catalog.i18n ? config.catalog.i18n.edit_rows : ''
    });
  }
  /**
   * Stop page-changing catalog controls while a pending operation owns row state.
   *
   * Summary elements do not honor the disabled property, so this capture guard
   * complements the visual disabled state while Service inline or bulk editing is active.
   *
   * @param {Event} event Captured catalog event.
   * @return {void}
   */
  function protect_inline_drafts_from_catalog_controls(event) {
    var protected_control;
    if (inlineWorkflowController && inlineWorkflowController.protect_event(event, state.inline_editing || state.inline_schema_loading || !!state.operation_mode)) {
      return;
    }
    if (!state.inline_editing && !state.inline_schema_loading && !state.operation_mode || !event.target || !event.target.closest) {
      return;
    }
    protected_control = event.target.closest('.wpbc_appointment_services__status_filter, #wpbc_service_provider_filter, .wpbc_appointment_services__add');
    if (!protected_control) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  /** Mark the page busy during a mutating request and refresh controls. */
  function setBusy(value) {
    state.busy = value;
    $('.wpbc_appointment_services_page').toggleClass('is-busy', value);
    updateControls();
  }
  /** Enable or disable all fields in the Service inspector. */
  function setFieldsEnabled(enabled) {
    $('[data-service-field], [data-service-range-field], [data-service-status-choice]').prop('disabled', !enabled);
    updateControls();
  }
  /** Return defaults for a new unsaved Service. */
  function blankService() {
    return {
      service_id: 0,
      title: '',
      description: '',
      picture_url: '',
      status: 'active',
      duration_minutes: 30,
      buffer_before_minutes: 0,
      buffer_after_minutes: 0,
      base_cost: '0.00',
      booking_form_id: 0,
      resource_ids: (config.default_provider_ids || []).slice()
    };
  }
  /**
   * Render the Service-owned create or edit inspector header template.
   *
   * Existing Service fields remain in their native collapsible groups so the
   * template changes presentation without moving domain validation to shared code.
   *
   * @param {boolean} is_edit Whether an existing Service is being edited.
   * @return {void}
   */
  function render_inspector_header(is_edit) {
    var template_id = is_edit ? 'wpbc-appointment-service-inspector-edit' : 'wpbc-appointment-service-inspector-create';
    var template = catalogTemplate(template_id);
    var $header = $('[data-wpbc-appointment-service-inspector-header]');
    var context = is_edit ? String(config.i18n.inspector_context_id || 'ID: %d').replace('%d', String(state.selectedId)) : String(config.i18n.inspector_context_new || 'New');
    if (!template || !$header.length) {
      return;
    }
    $header.html(template({
      title: is_edit ? config.i18n.edit_service_title : config.i18n.create_service_title,
      context: context,
      description: is_edit ? config.i18n.edit_service_description : config.i18n.create_service_description
    }));
  }
  /** Populate the inspector from a normalized Service response. */
  function fillEditor(service) {
    service = $.extend(blankService(), service || {});
    state.selectedId = Number(service.service_id || 0);
    render_inspector_header(0 < state.selectedId);
    $.each(service, function (key, value) {
      $('[data-service-field="' + key + '"]').val(value);
    });
    sync_status_radios();
    sync_all_numeric_ranges();
    updateMediaPreview();
    setFieldsEnabled(state.storageReady);
    $('.wpbc_appointment_services__item').removeClass('is-inspector-selected').attr('aria-current', 'false');
    $('.wpbc_appointment_services__item[data-service-id="' + state.selectedId + '"]').addClass('is-inspector-selected').attr('aria-current', 'true');
    capture_editor_snapshot();
  }
  /** Collect the current Service inspector values for saving. */
  function collectEditor() {
    var service = {
      service_id: state.selectedId
    };
    $('[data-service-field]').each(function () {
      service[$(this).data('service-field')] = $(this).val();
    });
    return service;
  }
  /**
   * Store the current editor values as the last loaded or saved state.
   *
   * @return {void}
   */
  function capture_editor_snapshot() {
    state.editor_snapshot = JSON.stringify(collectEditor());
  }
  /**
   * Determine whether the open Service editor contains unsaved changes.
   *
   * @return {boolean} True when current fields differ from the captured state.
   */
  function is_editor_dirty() {
    return editorIsOpen() && state.editor_snapshot !== JSON.stringify(collectEditor());
  }
  /**
   * Confirm before replacing an editor that contains unsaved Service changes.
   *
   * @return {boolean} True when replacing the current editor may continue.
   */
  function can_replace_editor() {
    return !is_editor_dirty() || w.confirm(config.i18n.confirm_discard || 'Discard unsaved Service changes?');
  }
  /**
   * Determine whether the current Service operation contains unapplied values.
   *
   * Inline drafts and signed review screens remain dirty until they are
   * explicitly applied or discarded. This prevents an outside click from
   * silently replacing a reviewed mutation.
   *
   * @return {boolean} True when closing would discard pending changes.
   */
  function is_operation_dirty() {
    if ('bulk_edit' === state.operation_mode) {
      return !!collect_bulk_changes();
    }
    if ('inline_review' === state.operation_mode || 'bulk_review' === state.operation_mode || 'delete_review' === state.operation_mode) {
      return !!state.operation_review;
    }
    return state.inline_editing && 0 < get_inline_changed_count();
  }
  /**
   * Clear the Service editor after its native sidebar has been closed.
   *
   * Invalidating the request sequence prevents a late load response from
   * reopening an inspector that the user already dismissed.
   *
   * @return {void}
   */
  function reset_service_editor() {
    var service = blankService();
    state.editor_request_sequence += 1;
    state.selectedId = 0;
    state.requested_focus = '';
    state.focus_handled = true;
    render_inspector_header(false);
    $.each(service, function (key, value) {
      $('[data-service-field="' + key + '"]').val(value);
    });
    sync_status_radios();
    sync_all_numeric_ranges();
    updateMediaPreview();
    setFieldsEnabled(false);
    $('.wpbc_appointment_services__item').removeClass('is-inspector-selected').attr('aria-current', 'false');
    capture_editor_snapshot();
    updateUrl(0);
  }
  /**
   * Clear a Service inline or bulk operation without changing selection.
   *
   * @param {boolean} restore_inline Whether inline rows should return to presentation mode.
   * @return {void}
   */
  function reset_operation(restore_inline) {
    state.operation_request_sequence += 1;
    state.operation_mode = '';
    state.operation_review = null;
    $('[data-wpbc-appointment-services-operation-host]').empty().prop('hidden', true);
    $('[data-wpbc-appointment-services-native-inspector]').prop('hidden', false);
    $('.wpbc_appointment_services__operation_apply').removeClass('wpbc_ui_catalog_delete_review__apply button-secondary is-busy').addClass('button-primary').removeAttr('aria-busy form').text(config.i18n.apply_changes || 'Apply changes');
    if (restore_inline) {
      state.inline_editing = false;
      state.inline_drafts = {};
      state.inline_schema = {};
      state.inline_schema_loading = false;
      state.inline_request_sequence += 1;
      $('[data-wpbc-appointment-services-inline-bar-host]').empty();
      if (state.last_response) {
        renderCatalogResponse(state.last_response);
      }
    }
    setBusy(false);
  }
  /**
   * Close the Service inspector using the Booking Resources lifecycle.
   *
   * @param {boolean} confirm_discard Whether to confirm unsaved changes.
   * @param {boolean} hide_sidebar    Whether this function must hide the native sidebar.
   * @return {boolean} True when the inspector was closed.
   */
  function close_service_inspector(confirm_discard, hide_sidebar) {
    var focus_target = state.inspector_focus_target;
    if (state.mutation_in_progress) {
      return false;
    }
    if (state.operation_mode) {
      if (confirm_discard && is_operation_dirty() && !w.confirm(config.i18n.confirm_discard || 'Discard unsaved Service changes?')) {
        return false;
      }
      reset_operation(true);
      state.inspector_focus_target = null;
      if (hide_sidebar && 'function' === typeof w.wpbc_admin_ui__sidebar_right__do_hide) {
        w.wpbc_admin_ui__sidebar_right__do_hide();
      }
      notify_setup_wizard_layout_changed();
      if (hide_sidebar && focus_target && document.documentElement.contains(focus_target) && 'function' === typeof focus_target.focus) {
        focus_target.focus();
      }
      return true;
    }
    if (confirm_discard && !can_replace_editor()) {
      return false;
    }
    reset_service_editor();
    state.inspector_focus_target = null;
    if (hide_sidebar && 'function' === typeof w.wpbc_admin_ui__sidebar_right__do_hide) {
      w.wpbc_admin_ui__sidebar_right__do_hide();
    }
    notify_setup_wizard_layout_changed();
    if (hide_sidebar && focus_target && document.documentElement.contains(focus_target) && 'function' === typeof focus_target.focus) {
      focus_target.focus();
    }
    return true;
  }
  /** Reflect the selected Service in the admin URL without reloading. */
  function updateUrl(serviceId) {
    if (!w.history || !w.URL) {
      return;
    }
    var url = new w.URL(w.location.href);
    if (serviceId) {
      url.searchParams.set('service_id', serviceId);
    } else {
      url.searchParams.delete('service_id');
    }
    w.history.replaceState({}, '', url.toString());
  }
  /** Index Provider presentation records by booking resource ID. */
  function indexProviders(providers) {
    state.providers = {};
    $.each(providers || [], function (index, provider) {
      state.providers[String(provider.id)] = provider;
    });
  }
  /** Update status and Provider counters above the Service table. */
  function updateSummary(counts, providerCount) {
    counts = $.extend({
      all: 0,
      active: 0,
      inactive: 0,
      archived: 0
    }, counts || {});
    state.providerCount = Number(providerCount || 0);
    $.each(counts, function (status, count) {
      $('[data-service-count="' + status + '"]').text(Number(count || 0));
    });
    $('[data-provider-count]').text(state.providerCount);
    $('.wpbc_appointment_services__provider_notice').prop('hidden', 0 !== state.providerCount);
  }
  /** Format a normalized Service cost using the configured currency symbol. */
  function formatCost(cost) {
    var amount = Number(cost || 0);
    var symbol = config.currency_symbol || '$';
    return symbol + amount.toFixed(2);
  }
  /** Build compact Provider avatar nodes for one Service row. */
  function providerNodes(service) {
    var ids = $.map(service.resource_ids || [], function (value) {
      return Number(value || 0);
    });
    var $stack = $('<div>', {
      'class': 'wpbc_appointment_services__provider_stack'
    });
    if (!ids.length) {
      return $('<span>', {
        'class': 'wpbc_appointment_services__no_provider',
        text: config.i18n.no_provider || 'No Providers assigned'
      });
    }
    $.each(ids.slice(0, 3), function (index, id) {
      var provider = state.providers[String(id)] || {
        id: id,
        title: 'Provider #' + id,
        initials: 'P',
        avatar_url: ''
      };
      var has_availability = false !== provider.has_weekly_availability;
      var provider_title = provider.title || 'Provider #' + id;
      var avatar_title = provider_title;
      var avatar_attributes;
      var $avatar;
      if (!has_availability) {
        avatar_title += ' — ' + (config.i18n.no_availability || 'No weekly availability');
      }
      avatar_attributes = {
        'class': 'wpbc_appointment_services__provider_avatar' + (has_availability ? '' : ' has-no-availability'),
        title: avatar_title
      };
      if (provider.availability_url) {
        avatar_title = String(config.i18n.edit_availability || 'Edit availability for %s').replace('%s', provider_title);
        avatar_attributes.href = provider.availability_url;
        avatar_attributes.title = avatar_title;
        avatar_attributes['aria-label'] = avatar_title;
        $avatar = $('<a>', avatar_attributes);
      } else {
        $avatar = $('<span>', avatar_attributes);
      }
      if (provider.avatar_url) {
        $('<img>', {
          src: provider.avatar_url,
          alt: '',
          loading: 'lazy'
        }).appendTo($avatar);
      } else {
        $avatar.text(provider.initials || 'P');
      }
      $stack.append($avatar);
    });
    if (ids.length > 3) {
      $('<span>', {
        'class': 'wpbc_appointment_services__provider_more',
        text: '+' + (ids.length - 3),
        title: ids.length - 3 + ' ' + (config.i18n.more_providers || 'more Providers')
      }).appendTo($stack);
    }
    return $stack;
  }
  /**
   * Build the Service thumbnail used in the management table.
   *
   * @param {Object} service Normalized Service response.
   * @return {jQuery} Thumbnail wrapper containing an image or placeholder icon.
   */
  function serviceThumbnailNode(service) {
    var pictureUrl = String(service.picture_url || '').trim();
    var service_title = String(service.title || config.i18n.untitled || 'Untitled Service');
    var service_description = String(service.description || '').trim() || config.i18n.no_description || 'No description';
    var tooltip_format = String(config.i18n.service_thumbnail_tooltip || 'Title: %1$s\nDescription: %2$s');
    var tooltip_text = tooltip_format.replace('%1$s', service_title).replace('%2$s', service_description);
    var $thumbnail = $('<span>', {
      'class': 'wpbc_ui_listing__table_icon wpbc_appointment_services__service_thumbnail tooltip_top',
      'data-original-title': tooltip_text,
      'aria-label': tooltip_text,
      role: 'img',
      tabindex: '0'
    });
    if (pictureUrl) {
      $('<img>', {
        src: pictureUrl,
        alt: '',
        loading: 'lazy',
        decoding: 'async'
      }).appendTo($thumbnail);
    } else {
      $('<i>', {
        'class': 'menu_icon icon-1x wpbc-bi-image-fill',
        'aria-hidden': 'true'
      }).appendTo($thumbnail);
    }
    return $thumbnail;
  }
  /**
   * Destroy Service thumbnail tooltips before AJAX replaces their elements.
   *
   * @return {void}
   */
  function destroy_service_thumbnail_tooltips() {
    $('.wpbc_appointment_services__service_thumbnail').each(function () {
      if (this._tippy && 'function' === typeof this._tippy.destroy) {
        this._tippy.destroy();
      }
    });
  }
  /**
   * Initialize Service thumbnail tooltips after an AJAX listing render.
   *
   * The native title attribute is used only when the Booking Calendar Tippy
   * helper is unavailable, avoiding duplicate browser and Tippy tooltips.
   *
   * @return {void}
   */
  function refresh_service_thumbnail_tooltips() {
    var listing_selector = '#wpbc_appointment_services_catalog ';
    var $thumbnails = $(listing_selector + '.wpbc_appointment_services__service_thumbnail');
    var tooltips_initialized = false;
    if ('function' === typeof w.wpbc_define_tippy_tooltips) {
      tooltips_initialized = w.wpbc_define_tippy_tooltips(listing_selector);
    }
    if (tooltips_initialized) {
      return;
    }
    $thumbnails.each(function () {
      $(this).attr('title', $(this).attr('data-original-title') || '');
    });
  }
  /**
   * Build the compact duration and before/after buffer summary for one Service.
   *
   * @param {Object} service Normalized Service response.
   * @return {jQuery} Duration details wrapper for the listing column.
   */
  function service_duration_node(service) {
    var duration_minutes = Math.max(0, Number(service.duration_minutes || 0));
    var buffer_before_minutes = Math.max(0, Number(service.buffer_before_minutes || 0));
    var buffer_after_minutes = Math.max(0, Number(service.buffer_after_minutes || 0));
    var duration_format = String(config.i18n.duration_minutes || '%s min');
    var buffers_format = String(config.i18n.buffers_summary || 'Buffers: %1$s / %2$s min');
    var buffers_tooltip_format = String(config.i18n.buffers_tooltip || 'Buffer before: %1$s min; Buffer after: %2$s min');
    var buffers_summary = buffers_format.replace('%1$s', buffer_before_minutes).replace('%2$s', buffer_after_minutes);
    var buffers_tooltip = buffers_tooltip_format.replace('%1$s', buffer_before_minutes).replace('%2$s', buffer_after_minutes);
    var $duration_details = $('<span>', {
      'class': 'wpbc_appointment_services__duration_details'
    });
    $('<strong>', {
      'class': 'wpbc_appointment_services__duration_value',
      text: duration_format.replace('%s', duration_minutes)
    }).appendTo($duration_details);
    $('<span>', {
      'class': 'wpbc_appointment_services__buffers_summary',
      text: buffers_summary,
      title: buffers_tooltip,
      'aria-label': buffers_tooltip
    }).appendTo($duration_details);
    return $duration_details;
  }
  /**
   * Return assigned Providers with recurring availability on one weekday.
   *
   * @param {Object} service Normalized Service response.
   * @param {string} day Weekday key from mon through sun.
   * @return {Array<Object>} Matching Provider presentation records.
   */
  function providers_available_on(service, day) {
    var available_providers = [];
    $.each(service.resource_ids || [], function (index, id) {
      var provider = state.providers[String(Number(id || 0))];
      if (provider && provider.weekdays && provider.weekdays[day]) {
        available_providers.push(provider);
      }
    });
    return available_providers;
  }
  /**
   * Build compact Provider-specific links below the weekly availability dots.
   *
   * @param {Object} service Normalized Service response.
   * @return {jQuery} Availability links, or an empty collection when unavailable.
   */
  function availability_edit_links(service) {
    var $links = $('<div>', {
      'class': 'wpbc_appointment_services__availability_links',
      'aria-label': config.i18n.edit_provider_availability || 'Edit Provider availability'
    });
    $.each(service.resource_ids || [], function (index, id) {
      var provider = state.providers[String(Number(id || 0))];
      var provider_title;
      var link_title;
      if (!provider || !provider.availability_url) {
        return;
      }
      provider_title = provider.title || 'Provider #' + Number(id || 0);
      link_title = String(config.i18n.edit_availability || 'Edit availability for %s').replace('%s', provider_title);
      $('<a>', {
        'class': 'wpbc_appointment_services__availability_link',
        href: provider.availability_url,
        text: provider.initials || 'P',
        title: link_title,
        'aria-label': link_title
      }).appendTo($links);
    });
    return $links.children().length ? $links : $();
  }
  /** Convert a stored Service status to its translated UI label. */
  function statusLabel(status) {
    if ('inactive' === status) {
      return config.i18n.draft || 'Draft';
    }
    if ('archived' === status) {
      return config.i18n.archived || 'Archived';
    }
    return config.i18n.active || 'Active';
  }
  /** Format the translated table pagination summary. */
  function showingText(from, to, total) {
    var format = config.i18n.showing || 'Showing %1$s-%2$s of %3$s Services';
    return format.replace('%1$s', from).replace('%2$s', to).replace('%3$s', total);
  }
  /** Return one compiled, allow-listed WordPress template. */
  function catalogTemplate(templateId) {
    try {
      return templateId && w.wp && 'function' === typeof w.wp.template ? w.wp.template(templateId) : null;
    } catch (error) {
      return null;
    }
  }
  /**
   * Return the shared native inspector state workflow for Service operations.
   *
   * @return {Object|false} Shared inspector workflow or false.
   */
  function get_operation_inspector_workflow() {
    var template_id;
    if (inspectorWorkflowController) {
      return inspectorWorkflowController;
    }
    if (!w.wpbc_ui_catalog || 'function' !== typeof w.wpbc_ui_catalog.create_inspector_workflow) {
      return false;
    }
    template_id = config.catalog && config.catalog.templates ? config.catalog.templates.inspector : '';
    inspectorWorkflowController = w.wpbc_ui_catalog.create_inspector_workflow({
      expand: function () {
        $('[data-wpbc-appointment-services-operation-host]').prop('hidden', false);
        $('[data-wpbc-appointment-services-native-inspector]').prop('hidden', true);
        expand_service_inspector();
      },
      get_footer: function () {
        return document.querySelector('.wpbc_appointment_services__right_sidebar_footer');
      },
      get_host: function () {
        return document.querySelector('[data-wpbc-appointment-services-operation-host]');
      },
      render_shell: function (shell_data) {
        var shell_template = catalogTemplate(template_id);
        return shell_template ? shell_template(shell_data) : '';
      },
      shell_data: {
        catalog_id: config.catalog && config.catalog.id ? config.catalog.id : 'appointment_services_catalog',
        empty_icon: 'wpbc-bi-pencil-square',
        empty_message: '',
        empty_title: '',
        loading_label: config.i18n.loading || ''
      }
    });
    return inspectorWorkflowController;
  }
  /** Return safe HTML from a detached jQuery presentation node. */
  function nodeHtml($node) {
    return $node && $node.length ? $('<div>').append($node).html() : '';
  }
  /**
   * Return the shared selection controller mounted for the Services catalog.
   *
   * @return {Object|null} Shared selection controller, or null before mount.
   */
  function get_selection_controller() {
    var mount = document.getElementById('wpbc_appointment_services_catalog');
    return mount && mount._wpbc_ui_catalog_selection_controller ? mount._wpbc_ui_catalog_selection_controller : null;
  }
  /**
   * Return selected Service identifiers without exposing selection internals.
   *
   * @return {Array<number>} Persisted selected Service identifiers.
   */
  function get_selected_service_ids() {
    var selection = get_selection_controller();
    return selection && 'function' === typeof selection.get_selected_ids ? selection.get_selected_ids() : [];
  }
  /**
   * Return one Service from the last normalized catalog response.
   *
   * @param {number|string} service_id Service identifier to find.
   * @return {Object|null} Matching Service DTO, or null when not on this page.
   */
  function find_service(service_id) {
    var found = null;
    $.each(state.services, function (index, service) {
      if (Number(service.service_id || service.id || 0) === Number(service_id)) {
        found = service;
        return false;
      }
    });
    return found;
  }
  /**
   * Return the allow-listed initial inline draft for one Service.
   *
   * Provider assignments, status, and buffers are deliberately omitted because
   * they require the reviewed bulk inspector or the complete Service inspector.
   *
   * @param {Object} row_schema Server-authoritative row schema.
   * @return {Object} Editable row-specific draft.
   */
  function create_inline_draft(row_schema) {
    var draft = {};
    $.each(row_schema && Array.isArray(row_schema.fields) ? row_schema.fields : [], function (index, field) {
      var field_key = String(field && field.key ? field.key : '');
      if (field_key) {
        draft[field_key] = String(field.value);
      }
    });
    return draft;
  }
  /** Return one cached server-authoritative inline row schema. */
  function find_inline_schema(service_id) {
    return state.inline_schema[String(Number(service_id || 0))] || null;
  }
  /**
   * Return whether one inline draft differs from its current Service DTO.
   *
   * @param {Object|null} row_schema Current server-authoritative row schema.
   * @param {Object|null} draft   Row-specific inline draft.
   * @return {boolean} True when at least one allow-listed value changed.
   */
  function inline_draft_changed(row_schema, draft) {
    var changed = false;
    if (!row_schema || !draft) {
      return false;
    }
    $.each(Array.isArray(row_schema.fields) ? row_schema.fields : [], function (index, field) {
      if (String(field.value) !== String(draft[field.key])) {
        changed = true;
        return false;
      }
    });
    return changed;
  }
  /**
   * Return changed inline drafts keyed by Service ID.
   *
   * @return {Object<string,Object>} Changed drafts keyed by Service identifier.
   */
  function collect_inline_changes() {
    var changes = {};
    $.each(state.inline_drafts, function (service_id, draft) {
      var row_schema = find_inline_schema(service_id);
      var row_changes = {};
      $.each(row_schema && Array.isArray(row_schema.fields) ? row_schema.fields : [], function (index, field) {
        if (String(field.value) !== String(draft[field.key])) {
          row_changes[field.key] = draft[field.key];
        }
      });
      if (Object.keys(row_changes).length) {
        changes[service_id] = row_changes;
      }
    });
    return changes;
  }
  /**
   * Return the count of changed Service rows in inline mode.
   *
   * @return {number} Number of row drafts that differ from their DTOs.
   */
  function get_inline_changed_count() {
    return Object.keys(collect_inline_changes()).length;
  }
  /**
   * Render and register the sticky inline-editing status bar.
   *
   * Registration delegates viewport positioning to the shared selection
   * controller so the Service page follows the Resource catalog behavior.
   *
   * @return {void}
   */
  function render_inline_bar() {
    var template = catalogTemplate('wpbc-appointment-services-inline-bar');
    var changed_count = get_inline_changed_count();
    var $host = $('[data-wpbc-appointment-services-inline-bar-host]');
    if (!template || !$host.length) {
      return;
    }
    if (!$host.children().length) {
      $host.html(template({
        title: config.i18n.editing_rows,
        changed_label: String(config.i18n.changed_rows || '%s changed rows').replace('%s', changed_count),
        description: config.i18n.inline_help,
        cancel: config.i18n.cancel,
        review: config.i18n.review_changes,
        changed_count: changed_count
      }));
    }
    synchronize_inline_bar();
  }
  /**
   * Synchronize the inline bar without replacing its active controls.
   *
   * A focused inline field emits its final change event while the Review
   * button is being clicked. Replacing the bar from that change handler would
   * remove the pointer target before the click event can complete.
   *
   * @return {void}
   */
  function synchronize_inline_bar() {
    var changed_count = get_inline_changed_count();
    var $bar = $('[data-wpbc-appointment-services-inline-bar]');
    if (!$bar.length) {
      return;
    }
    $bar.find('[data-wpbc-appointment-services-inline-changed-label]').text(String(config.i18n.changed_rows || '%s changed rows').replace('%s', changed_count));
    synchronize_inline_workflow();
  }
  /**
   * Start row-specific inline editing for the current catalog page.
   *
   * Drafts intentionally cover the current page only. Page-changing controls
   * remain protected until the user cancels or completes the reviewed change.
   *
   * @return {void}
   */
  function start_inline_editing() {
    var request_sequence;
    var visible_ids;
    if (state.busy || state.catalog_loading || state.operation_mode) {
      return;
    }
    if (state.inline_editing) {
      cancel_inline_editing(true);
      return;
    }
    if (!state.services.length) {
      return;
    }
    if (!can_replace_editor()) {
      return;
    }
    if (editorIsOpen()) {
      reset_service_editor();
    }
    visible_ids = $.map(state.services, function (service) {
      return Number(service.service_id || service.id || 0);
    });
    request_sequence = ++state.inline_request_sequence;
    state.inline_editing = false;
    state.inline_drafts = {};
    state.inline_schema = {};
    state.inline_schema_loading = true;
    setBusy(true);
    request(config.actions.inline_schema, {
      ids: JSON.stringify(visible_ids)
    }).done(function (response) {
      var schema = response && response.success && response.data ? response.data.schema : null;
      if (request_sequence !== state.inline_request_sequence) {
        return;
      }
      if (!schema || !Array.isArray(schema.rows)) {
        notify(messageFrom(response, config.i18n.inline_schema_failed), 'error');
        return;
      }
      $.each(schema.rows, function (index, row_schema) {
        var service_id = String(Number(row_schema.service_id || 0));
        if ('0' === service_id || !Array.isArray(row_schema.fields) || !row_schema.fields.length) {
          return;
        }
        state.inline_schema[service_id] = row_schema;
        state.inline_drafts[service_id] = create_inline_draft(row_schema);
      });
      if (!Object.keys(state.inline_drafts).length) {
        notify(config.i18n.inline_schema_failed, 'error');
        return;
      }
      state.inline_editing = true;
      renderCatalogResponse(state.last_response);
      render_inline_bar();
      $('[data-wpbc-appointment-services-inline-field]').first().trigger('focus');
    }).fail(function (xhr) {
      if (request_sequence === state.inline_request_sequence) {
        notify(messageFrom(xhr.responseJSON, config.i18n.inline_schema_failed), 'error');
      }
    }).always(function () {
      if (request_sequence === state.inline_request_sequence) {
        state.inline_schema_loading = false;
        setBusy(false);
      }
    });
  }
  /**
   * Cancel Service inline editing and restore focus to its toolbar action.
   *
   * The stable shared data attribute is the interaction contract. Keeping the
   * cancellation in this domain adapter preserves ownership of Service drafts
   * while preventing surrounding page and sidebar click handlers from deciding
   * whether those drafts should be discarded.
   *
   * @param {boolean} confirm_discard Whether changed drafts need confirmation.
   * @return {boolean} True when inline editing was cancelled.
   */
  function cancel_inline_editing(confirm_discard) {
    var focus_target = document.querySelector('[data-wpbc-ui-catalog-inline-toggle]');
    if (state.mutation_in_progress) {
      return false;
    }
    if (confirm_discard && get_inline_changed_count() && !w.confirm(config.i18n.confirm_discard || 'Discard unsaved Service changes?')) {
      return false;
    }
    reset_operation(true);
    if (focus_target && document.documentElement.contains(focus_target) && 'function' === typeof focus_target.focus) {
      focus_target.focus();
    }
    return true;
  }
  /**
   * Return enabled values from the Service bulk editor.
   *
   * @return {Object<string,string>|null} Shared changes, or null when none enabled.
   */
  function collect_bulk_changes() {
    var changes = {};
    $('[data-wpbc-appointment-services-bulk-enable]:checked').each(function () {
      var field_id = String($(this).data('wpbc-appointment-services-bulk-enable') || '');
      var $field = $('[data-wpbc-appointment-services-bulk-value="' + field_id + '"]');
      if (field_id && $field.length) {
        changes[field_id] = $field.val();
      }
    });
    return Object.keys(changes).length ? changes : null;
  }
  /**
   * Open a Service-owned operation inside the native right inspector.
   *
   * @param {string}      mode          Operation state identifier.
   * @param {string}      template_id   Allow-listed WordPress template ID.
   * @param {Object}      template_data Presentation data for the template.
   * @param {HTMLElement} focus_target  Element that should regain focus on close.
   * @return {boolean} True when the operation template was opened.
   */
  function open_operation(mode, template_id, template_data, focus_target) {
    var inspector_workflow = get_operation_inspector_workflow();
    var template = catalogTemplate(template_id);
    var $host = $('[data-wpbc-appointment-services-operation-host]');
    var rendered_operation;
    var target;
    if (!template || !$host.length || !inspector_workflow || !inspector_workflow.mount()) {
      state.operation_mode = '';
      state.operation_review = null;
      updateControls();
      notify(config.i18n.operation_failed || config.i18n.load_failed, 'error');
      return false;
    }
    try {
      rendered_operation = template(template_data);
    } catch (error) {
      state.operation_mode = '';
      state.operation_review = null;
      $host.empty().prop('hidden', true);
      $('[data-wpbc-appointment-services-native-inspector]').prop('hidden', false);
      updateControls();
      notify(config.i18n.operation_failed || config.i18n.load_failed, 'error');
      return false;
    }
    state.operation_mode = mode;
    state.inspector_focus_target = focus_target || document.activeElement;
    target = inspector_workflow.get_form_target();
    if (!target) {
      state.operation_mode = '';
      state.operation_review = null;
      inspector_workflow.set_state('error', config.i18n.operation_failed || config.i18n.load_failed);
      updateControls();
      notify(config.i18n.operation_failed || config.i18n.load_failed, 'error');
      return false;
    }
    target.innerHTML = rendered_operation;
    inspector_workflow.set_state('form', '');
    $host.prop('hidden', false);
    $('[data-wpbc-appointment-services-native-inspector]').prop('hidden', true);
    expand_service_inspector();
    updateControls();
    $host.find('[data-wpbc-ui-catalog-delete-review-heading], [data-wpbc-ui-catalog-inline-review-heading], h2').first().attr('tabindex', '-1').trigger('focus');
    return true;
  }
  /**
   * Open bulk editing for the current persistent Service selection.
   *
   * @param {HTMLElement} focus_target Element that opened the bulk inspector.
   * @return {void}
   */
  function open_bulk_edit(focus_target) {
    var selected_ids = get_selected_service_ids();
    if (!selected_ids.length || state.busy || state.inline_editing) {
      return;
    }
    if (!can_replace_editor()) {
      return;
    }
    if (editorIsOpen()) {
      reset_service_editor();
    }
    setBusy(true);
    request(config.actions.bulk_contract, {
      ids: JSON.stringify(selected_ids)
    }).done(function (response) {
      var contract = response && response.success && response.data ? response.data.contract : null;
      if (!contract || !Array.isArray(contract.fields) || !contract.fields.length) {
        notify(messageFrom(response, config.i18n.bulk_contract_failed), 'error');
        return;
      }
      open_operation('bulk_edit', 'wpbc-appointment-services-bulk-edit', {
        title: config.i18n.bulk_edit_title,
        description: contract.message || config.i18n.bulk_edit_description,
        fields: contract.fields
      }, focus_target);
    }).fail(function (xhr) {
      notify(messageFrom(xhr.responseJSON, config.i18n.bulk_contract_failed), 'error');
    }).always(function () {
      setBusy(false);
    });
  }
  /**
   * Render a signed inline or bulk review in the Service inspector.
   *
   * The preview endpoint is non-mutating. Only the returned signed plan can be
   * submitted to the separate apply endpoint.
   *
   * @param {string}      mode         Either inline or bulk.
   * @param {Array<number>} ids        Service identifiers to review.
   * @param {Object}      changes      Row-specific or shared field changes.
   * @param {HTMLElement} focus_target Element that opened the review.
   * @return {void}
   */
  function preview_operation(mode, ids, changes, focus_target) {
    var inspector_workflow;
    var request_sequence;
    if (state.busy || !ids.length || !changes) {
      return;
    }
    inspector_workflow = get_operation_inspector_workflow();
    request_sequence = ++state.operation_request_sequence;
    state.operation_mode = 'loading';
    state.operation_review = null;
    state.inspector_focus_target = focus_target || document.activeElement;
    if (!inspector_workflow || !inspector_workflow.open_loading()) {
      reset_operation(false);
      notify(config.i18n.operation_failed || config.i18n.preview_failed, 'error');
      return;
    }
    setBusy(true);
    request(config.actions.preview, {
      mode: mode,
      ids: JSON.stringify(ids),
      changes: JSON.stringify(changes)
    }, false).done(function (response) {
      var review = response && response.success ? response.data : null;
      var review_workflow = get_inline_review_workflow();
      var review_rows;
      var review_model;
      var template_id = 'inline' === mode ? 'wpbc-appointment-services-inline-review' : 'wpbc-appointment-services-bulk-review';
      if (request_sequence !== state.operation_request_sequence) {
        return;
      }
      if (!review || !review.plan || !review.token) {
        var error_message = messageFrom(response, config.i18n.preview_failed);
        inspector_workflow.set_state('error', error_message);
        notify(error_message, 'error');
        return;
      }
      state.operation_review = review;
      review_rows = review.review && Array.isArray(review.review.rows) ? review.review.rows : [];
      review_model = review_workflow ? review_workflow.prepare(review.review || {}, {
        changed_label: String(config.i18n.changed_rows || '%s changed rows').replace('%s', String(review_rows.length)),
        description: config.i18n.review_confirmation || '',
        form_id: 'wpbc_appointment_services_' + mode + '_review_form',
        mode: mode + '_review',
        pending_message: config.i18n.review_description || '',
        title: 'inline' === mode ? config.i18n.inline_review_title : config.i18n.bulk_review_title
      }) : {};
      if (!open_operation(mode + '_review', template_id, review_model, focus_target)) {
        inspector_workflow.set_state('error', config.i18n.operation_failed || config.i18n.preview_failed);
        return;
      }
      if (review_workflow) {
        review_workflow.synchronize({
          busy: false,
          can_apply: true
        });
      }
    }).fail(function (xhr) {
      var error_message = messageFrom(xhr.responseJSON, config.i18n.preview_failed);
      if (request_sequence !== state.operation_request_sequence) {
        return;
      }
      state.operation_mode = 'loading';
      inspector_workflow.set_state('error', error_message);
      notify(error_message, 'error');
    }).always(function () {
      if (request_sequence === state.operation_request_sequence) {
        setBusy(false);
      }
    });
  }
  /**
   * Open a loading inspector immediately and request a signed deletion review.
   *
   * @param {Array<number>} ids          Selected Service identifiers.
   * @param {HTMLElement}   focus_target Control that opened the review.
   * @return {void}
   */
  function preview_deletion(ids, focus_target) {
    var inspector_workflow;
    var request_sequence;
    ids = Array.isArray(ids) ? ids.map(Number).filter(function (service_id) {
      return service_id > 0;
    }) : [];
    if (state.busy || !ids.length || state.inline_editing) {
      return;
    }
    if (!can_replace_editor()) {
      return;
    }
    if (editorIsOpen()) {
      reset_service_editor();
    }
    inspector_workflow = get_operation_inspector_workflow();
    request_sequence = ++state.operation_request_sequence;
    state.operation_mode = 'loading';
    state.operation_review = null;
    state.inspector_focus_target = focus_target || document.activeElement;
    if (!inspector_workflow || !inspector_workflow.open_loading()) {
      reset_operation(false);
      notify(config.i18n.operation_failed || config.i18n.delete_preview_failed, 'error');
      return;
    }
    setBusy(true);
    request(config.actions.delete_preview, {
      ids: JSON.stringify(ids)
    }, false).done(function (response) {
      var review = response && response.success ? response.data : null;
      var delete_review = review && review.delete_review ? review.delete_review : {};
      var delete_i18n = delete_review.i18n || {};
      var delete_workflow = get_delete_review_workflow();
      var review_model;
      if (request_sequence !== state.operation_request_sequence) {
        return;
      }
      if (!review || !review.plan || !review.token) {
        inspector_workflow.set_state('error', messageFrom(response, config.i18n.delete_preview_failed));
        return;
      }
      review_model = {
        acknowledgement: String(delete_i18n.acknowledgement || ''),
        actions_heading: String(delete_i18n.actions_heading || ''),
        can_apply: true === review.can_apply,
        description: String(delete_i18n.description || ''),
        id_label: String(delete_i18n.id_label || config.i18n.column_id || 'ID'),
        items: Array.isArray(delete_review.items) ? delete_review.items : [],
        items_heading: String(delete_i18n.items_heading || ''),
        pending_message: String(delete_i18n.pending_message || ''),
        selection_label: String(delete_i18n.selection_label || ''),
        title: String(delete_i18n.title || ''),
        warning: String(delete_review.warning || review.warning || '')
      };
      state.operation_review = review;
      if (!open_operation('delete_review', 'wpbc-appointment-services-delete-review', review_model, focus_target)) {
        inspector_workflow.set_state('error', config.i18n.delete_preview_failed);
        return;
      }
      if (delete_workflow) {
        delete_workflow.configure_footer({
          can_apply: true === review.can_apply,
          footer: document.querySelector('.wpbc_appointment_services__right_sidebar_footer'),
          form_id: 'wpbc_appointment_services_delete_review_form',
          label: String(delete_i18n.delete_button || '')
        });
        delete_workflow.synchronize({
          busy: false,
          can_apply: true === review.can_apply
        });
        if (true === review.can_apply) {
          delete_workflow.pulse_acknowledgement();
        }
      }
    }).fail(function (xhr) {
      var error_message = messageFrom(xhr.responseJSON, config.i18n.delete_preview_failed);
      if (request_sequence !== state.operation_request_sequence) {
        return;
      }
      state.operation_mode = 'loading';
      inspector_workflow.set_state('error', error_message);
      notify(error_message, 'error');
    }).always(function () {
      if (request_sequence === state.operation_request_sequence) {
        setBusy(false);
      }
    });
  }
  /**
   * Apply the current signed Service review, then refresh the active page.
   *
   * Selection remains owned by the shared controller and is therefore restored
   * after the AJAX refresh instead of being silently cleared by the mutation.
   *
   * @return {void}
   */
  function apply_operation() {
    var review = state.operation_review;
    var changed_ids;
    var is_delete = 'delete_review' === state.operation_mode;
    var acknowledgement;
    if (state.busy || !review || !review.plan || !review.token) {
      return;
    }
    if (is_delete) {
      acknowledgement = document.querySelector('[data-wpbc-ui-catalog-delete-acknowledgement]');
      if (true !== review.can_apply || !acknowledgement || !acknowledgement.checked) {
        if (get_delete_review_workflow()) {
          get_delete_review_workflow().pulse_acknowledgement();
        }
        return;
      }
    }
    state.mutation_in_progress = true;
    setBusy(true);
    if (is_delete && get_delete_review_workflow()) {
      get_delete_review_workflow().synchronize({
        busy: true,
        can_apply: true
      });
    } else if (get_inline_review_workflow()) {
      get_inline_review_workflow().synchronize({
        busy: true,
        can_apply: true
      });
    }
    request(is_delete ? config.actions.delete_apply : config.actions.apply, {
      acknowledged: is_delete ? '1' : '',
      plan: JSON.stringify(review.plan),
      token: review.token
    }).done(function (response) {
      if (!response || !response.success) {
        notify(messageFrom(response, is_delete ? config.i18n.delete_apply_failed : config.i18n.apply_failed), 'error');
        return;
      }
      changed_ids = response.data && Array.isArray(response.data.changed_ids) ? response.data.changed_ids.map(String) : [];
      notify(response.data.message, 'success');
      state.mutation_in_progress = false;
      close_service_inspector(false, true);
      pending_highlight_ids = is_delete ? [] : changed_ids;
      if (is_delete && catalogController && 'function' === typeof catalogController.clear_selection) {
        catalogController.clear_selection();
      }
      if (catalogController) {
        catalogController.load({
          page_number: state.page
        });
      }
    }).fail(function (xhr) {
      notify(messageFrom(xhr.responseJSON, is_delete ? config.i18n.delete_apply_failed : config.i18n.apply_failed), 'error');
    }).always(function () {
      state.mutation_in_progress = false;
      setBusy(false);
      if (is_delete && get_delete_review_workflow()) {
        get_delete_review_workflow().synchronize({
          busy: false,
          can_apply: !!state.operation_review && true === state.operation_review.can_apply
        });
      } else if (get_inline_review_workflow()) {
        get_inline_review_workflow().synchronize({
          busy: false,
          can_apply: !!state.operation_review
        });
      }
    });
  }
  /**
   * Highlight Services changed by the last reviewed mutation.
   *
   * The identifiers are retained until the refreshed catalog contains at least
   * one affected Service. This avoids consuming the highlight while closing an
   * operation re-renders the previous response.
   *
   * @return {void}
   */
  function apply_pending_highlights() {
    var first_service = null;
    pending_highlight_ids.forEach(function (service_id) {
      var service = document.querySelector('.wpbc_appointment_services__item[data-service-id="' + service_id + '"]');
      if (service) {
        service.classList.add('is-recently-saved');
        first_service = first_service || service;
      }
    });
    if (!first_service) {
      return;
    }
    first_service.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth'
    });
    window.setTimeout(function () {
      document.querySelectorAll('.wpbc_appointment_services__item.is-recently-saved').forEach(function (service) {
        service.classList.remove('is-recently-saved');
      });
    }, 5000);
    pending_highlight_ids = [];
  }
  /** Return the current ordered and visible Service column definitions. */
  function responseColumns(response) {
    var definitions = config.catalog && config.catalog.columns ? config.catalog.columns.definitions || {} : {};
    var visible = response.display && response.display.visible_columns ? response.display.visible_columns : [];
    var order = response.display && response.display.column_order ? response.display.column_order : [];
    return $.map(order, function (columnId) {
      var definition = definitions[columnId];
      var is_sorted;
      if (!definition || -1 === visible.indexOf(columnId)) {
        return null;
      }
      is_sorted = !!definition.sort_key && definition.sort_key === response.sorting.sort_by;
      return {
        aria_sort: is_sorted ? 'desc' === response.sorting.sort_order ? 'descending' : 'ascending' : 'none',
        id: columnId,
        label: definition.label || columnId,
        class_name: definition.class || 'column-' + columnId,
        is_sorted: is_sorted,
        sort_icon: is_sorted ? 'desc' === response.sorting.sort_order ? 'wpbc-bi-arrow-down' : 'wpbc-bi-arrow-up' : 'wpbc_icn_import_export',
        sort_key: definition.sort_key || ''
      };
    });
  }
  /**
   * Return sortable presentation records for the cards layout header.
   *
   * The table combines Status and Service ID in one column, so cards expand
   * that column into two independent sort controls without changing the DTO.
   *
   * @param {Object} response Normalized shared catalog response.
   * @return {Array<Object>} Visible, allow-listed cards sorting records.
   */
  function responseSortColumns(response) {
    var columns = [];
    $.each(responseColumns(response), function (columnIndex, column) {
      if ('status' === column.id) {
        columns.push({
          is_sorted: 'status' === response.sorting.sort_by,
          label: column.label,
          sort_icon: 'status' === response.sorting.sort_by ? 'desc' === response.sorting.sort_order ? 'wpbc-bi-arrow-down' : 'wpbc-bi-arrow-up' : 'wpbc_icn_import_export',
          sort_key: 'status'
        });
        columns.push({
          is_sorted: 'service_id' === response.sorting.sort_by,
          label: config.i18n.column_id || 'ID',
          sort_icon: 'service_id' === response.sorting.sort_by ? 'desc' === response.sorting.sort_order ? 'wpbc-bi-arrow-down' : 'wpbc-bi-arrow-up' : 'wpbc_icn_import_export',
          sort_key: 'service_id'
        });
        return;
      }
      if (!column.sort_key) {
        return;
      }
      columns.push({
        is_sorted: column.sort_key === response.sorting.sort_by,
        label: column.label,
        sort_icon: column.sort_key === response.sorting.sort_by ? 'desc' === response.sorting.sort_order ? 'wpbc-bi-arrow-down' : 'wpbc-bi-arrow-up' : 'wpbc_icn_import_export',
        sort_key: column.sort_key
      });
    });
    return columns;
  }
  /**
   * Build presentation cells for the Service-owned row and card templates.
   *
   * Inline drafts replace only the allow-listed editable controls. Provider,
   * availability, status, and action presentation stays read-only.
   *
   * @param {Object} service Normalized Service DTO.
   * @return {Object} Escaped HTML fragments keyed by catalog column ID.
   */
  function serviceCells(service) {
    var id = Number(service.service_id || service.id || 0);
    var draft = state.inline_editing ? state.inline_drafts[String(id)] : null;
    var row_schema = draft ? find_inline_schema(id) : null;
    var inline_field_template = catalogTemplate('wpbc-appointment-service-inline-field');
    var inline_cells = {};
    var title = service.title || config.i18n.untitled || 'Untitled Service';
    var description = String(service.description || '#' + id);
    var status = String(service.status || 'active');
    var $identity = $('<div>', {
      'class': 'wpbc_appointment_services__service_identity'
    });
    var identity_fields_class = draft ? 'wpbc_appointment_services__inline_identity_fields' : 'wpbc_ui_listing__item_copy wpbc_appointment_services__service_copy';
    var $copy = $('<span>', {
      'class': identity_fields_class
    }).appendTo($identity);
    var $availability = $('<div>');
    var $availabilityWeek = $('<div>', {
      'class': 'wpbc_appointment_services__availability_week'
    }).appendTo($availability);
    var hasWeeklyAvailability = false;
    var statusTemplate = catalogTemplate('wpbc-appointment-service-status-label');
    var providerTemplate = catalogTemplate('wpbc-appointment-service-provider-labels');
    var $actions = $('<div>', {
      'class': 'wpbc_appointment_services__actions'
    });
    if (row_schema && inline_field_template) {
      $.each(row_schema.fields || [], function (field_index, field) {
        var column_id = String(field.column || '');
        var field_key = String(field.key || '');
        var field_data;
        if (!column_id || !field_key || !Object.prototype.hasOwnProperty.call(draft, field_key)) {
          return;
        }
        field_data = $.extend({}, field, {
          original_value: field.value,
          value: draft[field_key]
        });
        inline_cells[column_id] = (inline_cells[column_id] || '') + inline_field_template({
          field: field_data,
          service_id: id
        });
      });
    }
    serviceThumbnailNode(service).prependTo($identity);
    if (draft && inline_cells.service) {
      $copy.append(inline_cells.service);
    } else {
      $('<strong>', {
        'class': 'wpbc_ui_listing__item_title wpbc_ui_listing__overflow_tooltip',
        'data-wpbc-ui-catalog-overflow-tooltip': title,
        title: title,
        text: title
      }).appendTo($copy);
      $('<span>', {
        'class': 'wpbc_ui_listing__item_description wpbc_ui_listing__overflow_tooltip',
        'data-wpbc-ui-catalog-overflow-tooltip': description,
        title: description,
        text: description
      }).appendTo($copy);
    }
    $.each(weekdayKeys, function (dayIndex, day) {
      var availableProviders = providers_available_on(service, day);
      var available = availableProviders.length > 0;
      var dayTitle = config.weekdays && config.weekdays[dayIndex] ? config.weekdays[dayIndex] : day;
      var providerTitles = $.map(availableProviders, function (provider) {
        return provider.title || '';
      }).filter(function (providerTitle) {
        return !!providerTitle;
      });
      var availabilityTitle = available ? String(config.i18n.available_providers || 'Available Providers: %s').replace('%s', providerTitles.join(', ')) : config.i18n.no_available_providers || 'No assigned Providers are available';
      if (available) {
        hasWeeklyAvailability = true;
      }
      $('<span>', {
        'class': 'wpbc_appointment_services__availability' + (available ? ' is-available' : ''),
        title: dayTitle + ': ' + availabilityTitle,
        'aria-label': dayTitle + ': ' + availabilityTitle
      }).appendTo($availabilityWeek);
    });
    $availability.append(availability_edit_links(service));
    if (service.resource_ids && service.resource_ids.length && !hasWeeklyAvailability) {
      $('<span>', {
        'class': 'wpbc_appointment_services__availability_empty',
        text: config.i18n.no_availability || 'No weekly availability'
      }).appendTo($availability);
    }
    $('<button>', {
      type: 'button',
      'class': 'button-link wpbc_appointment_services__row_edit wpbc_icn_edit',
      'data-service-id': id,
      title: config.i18n.edit || 'Edit Service',
      'aria-label': config.i18n.edit || 'Edit Service'
    }).appendTo($actions);
    if (service.actions && service.actions.archive) {
      $('<button>', {
        type: 'button',
        'class': 'button-link wpbc_appointment_services__row_archive wpbc_icn_open_in_browser wpbc_icn_rotate_180',
        'data-service-id': id,
        title: config.i18n.archive || 'Archive Service',
        'aria-label': config.i18n.archive || 'Archive Service'
      }).appendTo($actions);
    }
    return {
      service: nodeHtml($identity),
      duration: draft && inline_cells.duration ? inline_cells.duration : nodeHtml(service_duration_node(service)),
      price: draft && inline_cells.price ? inline_cells.price : nodeHtml($('<span>', {
        text: formatCost(service.base_cost)
      })),
      providers: providerTemplate ? providerTemplate({
        providers: service.providers || [],
        max_visible: 3,
        empty_label: config.i18n.no_provider || 'No Providers assigned',
        more_label: config.i18n.more_providers || 'more Providers'
      }) : nodeHtml(providerNodes(service)),
      availability: nodeHtml($availability),
      status: (statusTemplate ? statusTemplate({
        status: status,
        label: statusLabel(status)
      }) : '') + nodeHtml($('<span>', {
        'class': 'wpbc_appointment_services__id',
        text: (config.i18n.column_id || 'ID') + ': ' + id
      })),
      actions: nodeHtml($actions)
    };
  }
  /**
   * Render a normalized catalog response through Service-owned WP templates.
   *
   * @param {Object} response Normalized shared-catalog response.
   * @return {void}
   */
  function renderCatalogResponse(response) {
    if (!response) {
      return;
    }
    var columns = responseColumns(response);
    var rowTemplate = catalogTemplate('wpbc-appointment-service-row');
    var cardTemplate = catalogTemplate('wpbc-appointment-service-card');
    var headerTemplate = catalogTemplate('wpbc-appointment-services-header');
    var cardsHeaderTemplate = catalogTemplate('wpbc-appointment-services-cards-header');
    var paginationTemplate = catalogTemplate('wpbc-appointment-services-pagination');
    var isCards = 'cards' === response.display.template_pack;
    var $rowHost = $('[data-wpbc-appointment-services-rows]');
    var $cardHost = $('[data-wpbc-appointment-services-cards]');
    var pagination = response.pagination || {};
    var renderedItems = [];
    destroy_service_thumbnail_tooltips();
    state.last_response = response;
    state.services = response.items || [];
    state.page = Number(pagination.page_number || 1);
    state.page_size = Number(pagination.items_per_page || state.page_size);
    state.total_items = Number(pagination.total_items || 0);
    state.total_pages = Number(pagination.total_pages || 0);
    state.sort_by = String(response.sorting.sort_by || state.sort_by);
    state.sort_order = String(response.sorting.sort_order || state.sort_order);
    if (headerTemplate && $rowHost.length) {
      $('[data-wpbc-appointment-services-header]').html(headerTemplate({
        columns: columns,
        id_label: config.i18n.column_id || 'ID',
        sort_by: state.sort_by,
        sort_order: state.sort_order,
        select_all_label: config.i18n.select_all
      }));
    }
    if (cardsHeaderTemplate && $cardHost.length) {
      $('[data-wpbc-appointment-services-cards-header]').html(cardsHeaderTemplate({
        columns: responseSortColumns(response),
        i18n: config.catalog.i18n || {},
        select_all_label: config.i18n.select_all
      }));
    }
    $.each(state.services, function (index, service) {
      var template = isCards ? cardTemplate : rowTemplate;
      if (template) {
        var service_id = Number(service.service_id || service.id || 0);
        renderedItems.push(template({
          service_id: service_id,
          is_inspector_selected: service_id === state.selectedId,
          select_label: String(config.i18n.select_service || 'Select %s').replace('%s', service.title || config.i18n.untitled),
          picture_url: String(service.picture_url || ''),
          columns: columns,
          cells: serviceCells(service)
        }));
      }
    });
    (isCards ? $cardHost : $rowHost).html(renderedItems.join(''));
    if (paginationTemplate) {
      $('[data-wpbc-appointment-services-pagination]').html(paginationTemplate({
        results_status: showingText(pagination.items_from || 0, pagination.items_to || 0, pagination.total_items || 0),
        show_label: config.catalog.i18n.show_label,
        per_page_label: config.catalog.i18n.per_page_label,
        items_per_page_options: config.catalog.items_per_page.options || [],
        items_per_page: state.page_size,
        aria_label: config.catalog.i18n.pagination_label,
        page_number_label: config.catalog.i18n.page_number,
        page_number: state.page,
        total_pages: Math.max(1, state.total_pages),
        previous_page: Math.max(1, state.page - 1),
        next_page: Math.min(Math.max(1, state.total_pages), state.page + 1),
        previous_label: config.catalog.i18n.previous_page,
        next_label: config.catalog.i18n.next_page,
        has_previous: state.page > 1,
        has_next: state.total_pages > 0 && state.page < state.total_pages
      }));
    }
    refresh_service_thumbnail_tooltips();
    if (catalogController) {
      catalogController.refresh_controls();
      catalogController.sync_table_min_width();
    }
    var selection = get_selection_controller();
    if (selection && 'function' === typeof selection.synchronize) {
      selection.synchronize();
    }
    apply_pending_highlights();
    if (state.inline_editing) {
      render_inline_bar();
    }
  }
  /** Load one Service and open it in the right inspector. */
  function loadOne(serviceId, focus_target) {
    var request_sequence;
    if (!serviceId || state.busy) {
      return;
    }
    if (editorIsOpen() && state.selectedId === serviceId) {
      expand_service_inspector();
      focus_requested_service_section();
      return;
    }
    if (!can_replace_editor()) {
      return;
    }
    state.inspector_focus_target = focus_target || document.activeElement;
    request_sequence = ++state.editor_request_sequence;
    setBusy(true);
    request(config.actions.load, {
      service_id: serviceId
    }).done(function (response) {
      if (request_sequence !== state.editor_request_sequence) {
        return;
      }
      if (response && response.success && response.data && response.data.service) {
        fillEditor(response.data.service);
        updateUrl(state.selectedId);
        expand_service_inspector();
        focus_requested_service_section();
        return;
      }
      notify(messageFrom(response, config.i18n.load_failed), 'error');
    }).fail(function (xhr) {
      if (request_sequence === state.editor_request_sequence) {
        notify(messageFrom(xhr.responseJSON, config.i18n.load_failed), 'error');
      }
    }).always(function () {
      setBusy(false);
    });
  }
  /**
   * Reload Services and Provider presentation data for the active filters.
   *
   * @param {boolean} save_preferences Whether to persist the active Service filters.
   * @return {void}
   */
  function loadList(save_preferences) {
    var requestData = {
      search: $('#wpbc_service_search').val() || '',
      status: state.status,
      resource_id: $('#wpbc_service_provider_filter').val() || 0,
      page_number: 1
    };
    if (save_preferences) {
      requestData.preference_action = 'save';
    }
    return catalogController ? catalogController.load(requestData) : Promise.resolve(false);
  }
  /**
   * Keep the Service search clear control synchronized with the search value.
   *
   * The Service filters live outside the shared catalog mount, so this small
   * adapter mirrors the shared catalog clear-button visibility contract.
   *
   * @return {void}
   */
  function sync_search_clear_button() {
    var search_value = String($('#wpbc_service_search').val() || '');
    $('[data-wpbc-appointment-services-search-clear]').prop('hidden', !search_value);
  }
  /** Archive one Service after confirmation, then refresh the list. */
  function archiveService(serviceId) {
    if (!serviceId || state.busy || !w.confirm(config.i18n.confirm_archive || 'Archive this Service?')) {
      return;
    }
    state.mutation_in_progress = true;
    setBusy(true);
    request(config.actions.archive, {
      service_id: serviceId
    }).done(function (response) {
      if (response && response.success) {
        if (state.selectedId === serviceId) {
          state.selectedId = 0;
          setFieldsEnabled(false);
          updateUrl(0);
        }
        notify(response.data.message, 'success');
        loadList();
        return;
      }
      notify(messageFrom(response, config.i18n.archive_failed), 'error');
    }).fail(function (xhr) {
      notify(messageFrom(xhr.responseJSON, config.i18n.archive_failed), 'error');
    }).always(function () {
      state.mutation_in_progress = false;
      setBusy(false);
    });
  }
  $(document).on('click', '.wpbc_appointment_services__rightbar_tabs [role="tab"]', function (event) {
    event.preventDefault();
    switchRightPanel($(this));
  });
  $(document).on('click', '.wpbc_appointment_services__rightbar .wpbc_ui__collapsible_group > .group__header', function (event) {
    event.preventDefault();
    toggleInspectorGroup($(this));
  });
  $(document).on('click', '.wpbc_appointment_services__item', function (event) {
    if (!state.inline_editing && !$(event.target).closest('button, a, input, select, textarea, label').length) {
      loadOne(Number($(this).data('service-id') || 0), this);
    }
  });
  $(document).on('keydown', '.wpbc_appointment_services__item', function (event) {
    if (!state.inline_editing && !$(event.target).closest('button, a, input, select, textarea, label').length && ('Enter' === event.key || ' ' === event.key)) {
      event.preventDefault();
      loadOne(Number($(this).data('service-id') || 0), this);
    }
  });
  $(document).on('click', '.wpbc_appointment_services__row_edit', function () {
    loadOne(Number($(this).data('service-id') || 0), this);
  });
  $(document).on('click', '.wpbc_appointment_services__row_archive', function () {
    archiveService(Number($(this).data('service-id') || 0));
  });
  $(document).on('click', '.wpbc_appointment_services__status_filter', function () {
    state.status = String($(this).data('service-status') || 'all');
    state.page = 1;
    $('.wpbc_appointment_services__status_filter').removeClass('is-active').attr('aria-pressed', 'false');
    $(this).addClass('is-active').attr('aria-pressed', 'true');
    loadList(true);
  });
  $(document).on('click', '.wpbc_appointment_services__add', function () {
    if (!state.storageReady || state.busy || !can_replace_editor()) {
      return;
    }
    state.inspector_focus_target = this;
    fillEditor(blankService());
    updateUrl(0);
    open_add_service_inspector();
  });
  $(document).on('click', '[data-wpbc-appointment-services-cancel]', function (event) {
    event.preventDefault();
    event.stopPropagation();
    close_service_inspector(true, true);
  });
  $(document).on('click', '.wpbc_appointment_services__save', function () {
    if (!state.storageReady || state.busy) {
      return;
    }
    state.mutation_in_progress = true;
    setBusy(true);
    request(config.actions.save, {
      service: collectEditor()
    }).done(function (response) {
      if (response && response.success && response.data && response.data.service) {
        fillEditor(response.data.service);
        updateUrl(state.selectedId);
        notify(response.data.message, 'success');
        loadList();
        return;
      }
      notify(messageFrom(response, config.i18n.save_failed), 'error');
    }).fail(function (xhr) {
      notify(messageFrom(xhr.responseJSON, config.i18n.save_failed), 'error');
    }).always(function () {
      state.mutation_in_progress = false;
      setBusy(false);
    });
  });
  $(document).on('click', '.wpbc_appointment_services__duplicate', function () {
    if (!state.selectedId || state.busy) {
      return;
    }
    state.mutation_in_progress = true;
    setBusy(true);
    request(config.actions.duplicate, {
      service_id: state.selectedId
    }).done(function (response) {
      if (response && response.success && response.data && response.data.service) {
        fillEditor(response.data.service);
        updateUrl(state.selectedId);
        notify(response.data.message, 'success');
        loadList();
        return;
      }
      notify(messageFrom(response, config.i18n.duplicate_failed), 'error');
    }).fail(function (xhr) {
      notify(messageFrom(xhr.responseJSON, config.i18n.duplicate_failed), 'error');
    }).always(function () {
      state.mutation_in_progress = false;
      setBusy(false);
    });
  });
  $(document).on('click', '.wpbc_appointment_services__archive', function () {
    archiveService(state.selectedId);
  });
  $(document).on('click', '.wpbc_appointment_services__inline_toggle', function () {
    start_inline_editing();
  });
  $(document).on('click', '[data-wpbc-appointment-services-inline-bar] [data-wpbc-ui-catalog-inline-cancel]', function (event) {
    event.preventDefault();
    event.stopPropagation();
    cancel_inline_editing(true);
  });
  $(document).on('click', '.wpbc_appointment_services__inline_review', function () {
    var changes = collect_inline_changes();
    preview_operation('inline', $.map(Object.keys(changes), function (service_id) {
      return Number(service_id);
    }), changes, this);
  });
  $(document).on('input change', '[data-wpbc-appointment-services-inline-field]', function () {
    var service_id = String(Number($(this).data('service-id') || 0));
    var field_id = String($(this).data('wpbc-appointment-services-inline-field') || '');
    var row_element;
    var indicator_element;
    var changed;
    if (state.inline_drafts[service_id] && field_id) {
      state.inline_drafts[service_id][field_id] = $(this).val();
      row_element = $(this).closest('.wpbc_appointment_services__item').get(0);
      indicator_element = row_element ? row_element.querySelector('.wpbc_appointment_services__inline_identity_fields') : null;
      changed = inline_draft_changed(find_inline_schema(service_id), state.inline_drafts[service_id]);
      if (inlineWorkflowController) {
        inlineWorkflowController.set_row_changed(row_element, changed, indicator_element, config.i18n.changed);
      }
      synchronize_inline_bar();
    }
  });
  $(document).on('click', '.wpbc_appointment_services__bulk_edit', function () {
    open_bulk_edit(this);
  });
  $(document).on('click', '.wpbc_appointment_services__bulk_delete', function () {
    preview_deletion(get_selected_service_ids(), this);
  });
  $(document).on('change', '[data-wpbc-appointment-services-bulk-enable]', function () {
    var field_id = String($(this).data('wpbc-appointment-services-bulk-enable') || '');
    $('[data-wpbc-appointment-services-bulk-value="' + field_id + '"], [data-wpbc-appointment-services-bulk-range="' + field_id + '"]').prop('disabled', !this.checked);
    updateControls();
  });
  $(document).on('input change', '[data-wpbc-appointment-services-bulk-value]', function () {
    var field_id = String($(this).data('wpbc-appointment-services-bulk-value') || '');
    $('[data-wpbc-appointment-services-bulk-range="' + field_id + '"]').val($(this).val());
    updateControls();
  });
  $(document).on('input change', '[data-wpbc-appointment-services-bulk-range]', function () {
    var field_id = String($(this).data('wpbc-appointment-services-bulk-range') || '');
    $('[data-wpbc-appointment-services-bulk-value="' + field_id + '"]').val($(this).val());
    updateControls();
  });
  $(document).on('click', '.wpbc_appointment_services__operation_review', function () {
    preview_operation('bulk', get_selected_service_ids(), collect_bulk_changes(), this);
  });
  $(document).on('click', '.wpbc_appointment_services__operation_apply', apply_operation);
  $(document).on('submit', '[data-wpbc-ui-catalog-inline-review-form], [data-wpbc-ui-catalog-delete-review-form]', function (event) {
    event.preventDefault();
    apply_operation();
  });
  $(document).on('change', '[data-wpbc-ui-catalog-delete-acknowledgement]', function (event) {
    if (get_delete_review_workflow()) {
      get_delete_review_workflow().handle_change(event);
    }
  });
  $(document).on('input change', '[data-service-range-field]', function () {
    var field_id = String($(this).data('service-range-field') || '');
    if (field_id) {
      $('[data-service-field="' + field_id + '"]').val($(this).val()).trigger('input');
    }
  });
  $(document).on('input change', 'input[type="number"][data-service-field]', function () {
    sync_numeric_range(String($(this).data('service-field') || ''));
  });
  $(document).on('change', '[data-service-status-choice]', function () {
    if (this.checked) {
      $('[data-service-field="status"]').val(this.value).trigger('change');
    }
  });
  $(document).on('input change wpbc_media_upload_url_set', '[data-service-field="picture_url"]', function () {
    updateMediaPreview();
    updateControls();
  });
  $(document).on('click', '.wpbc_appointment_services__remove_image', function () {
    if ($(this).prop('disabled')) {
      return;
    }
    $('[data-service-field="picture_url"]').val('').trigger('input').trigger('change');
  });
  $(document).on('input', '#wpbc_service_search', function () {
    w.clearTimeout(searchTimer);
    state.page = 1;
    sync_search_clear_button();
    searchTimer = w.setTimeout(loadList, 250);
  });
  $(document).on('click', '[data-wpbc-appointment-services-search-clear]', function (event) {
    var $search_control = $('#wpbc_service_search');
    event.preventDefault();
    w.clearTimeout(searchTimer);
    $search_control.val('').trigger('focus');
    state.page = 1;
    sync_search_clear_button();
    loadList();
  });
  $(document).on('change', '#wpbc_service_provider_filter', function () {
    state.page = 1;
    loadList(true);
  });
  $(document).on('wpbc:ui-catalog-loading', '#wpbc_appointment_services_catalog', function (event) {
    var event_detail = event.originalEvent && event.originalEvent.detail ? event.originalEvent.detail : {};
    if (event_detail.catalog_id !== 'appointment_services_catalog') {
      return;
    }
    state.catalog_loading = true;
    updateControls();
  });
  $(document).on('wpbc:ui-catalog-rendered', '#wpbc_appointment_services_catalog', function (event) {
    var response = event.originalEvent && event.originalEvent.detail ? event.originalEvent.detail.response : null;
    var filters = response && response.filters ? response.filters : {};
    if (!response || response.catalog_id !== 'appointment_services_catalog') {
      return;
    }
    state.catalog_loading = false;
    state.storageReady = !!filters.storage_ready;
    state.status = String(filters.status || state.status);
    indexProviders(filters.providers || (response.items && response.items.length ? response.items[0].providers || [] : []));
    updateSummary(filters.status_counts || {}, filters.provider_count || 0);
    $('.wpbc_appointment_services__status_filter').removeClass('is-active').attr('aria-pressed', 'false').filter('[data-service-status="' + state.status + '"]').addClass('is-active').attr('aria-pressed', 'true');
    $('#wpbc_service_provider_filter').val(String(filters.resource_id || 0));
    renderCatalogResponse(response);
    updateControls();
    if (state.initial_selection_pending && state.selectedId) {
      state.initial_selection_pending = false;
      loadOne(state.selectedId);
    }
  });
  $(function () {
    var mount_element = document.getElementById('wpbc_appointment_services_catalog');
    var page_element = document.querySelector('.wpbc_appointment_services_page');
    var protected_events_root = page_element || mount_element;
    if (!$('[data-wpbc-appointment-services-page="1"]').length || !mount_element || !config.catalog || !w.wpbc_ui_catalog) {
      return;
    }
    state.status = String(config.catalog.initial_request && config.catalog.initial_request.status ? config.catalog.initial_request.status : 'all');
    $('#wpbc_service_search').val(String(config.catalog.initial_request && config.catalog.initial_request.search ? config.catalog.initial_request.search : ''));
    sync_search_clear_button();
    protected_events_root.addEventListener('click', protect_inline_drafts_from_catalog_controls, true);
    protected_events_root.addEventListener('change', protect_inline_drafts_from_catalog_controls, true);
    protected_events_root.addEventListener('input', protect_inline_drafts_from_catalog_controls, true);
    catalogController = w.wpbc_ui_catalog.mount(config.catalog);
    if (!catalogController) {
      notify(config.i18n.load_failed, 'error');
    } else if ('function' === typeof w.wpbc_ui_catalog.create_inline_editing_workflow) {
      inlineWorkflowController = w.wpbc_ui_catalog.create_inline_editing_workflow(mount_element, {
        controls_root: page_element || mount_element,
        page_element: page_element || mount_element,
        protected_selector: '.wpbc_appointment_services__status_filter, #wpbc_service_provider_filter, .wpbc_appointment_services__add'
      });
      synchronize_inline_workflow();
    }
    $('.wpbc_settings_page_wrapper').on('wpbc:right-sidebar-before-content-collapse.wpbcAppointmentServices', function (event) {
      if ((editorIsOpen() || state.operation_mode) && !close_service_inspector(true, false)) {
        event.preventDefault();
      }
    });
  });
})(window, jQuery);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1hcHBvaW50bWVudC1zZXJ2aWNlcy9fb3V0L2FwcG9pbnRtZW50X3NlcnZpY2VzX3BhZ2UuanMiLCJuYW1lcyI6WyJ3IiwiJCIsImNvbmZpZyIsIndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfY29uZmlnIiwic3RhdGUiLCJzdG9yYWdlUmVhZHkiLCJjYXRhbG9nX2xvYWRpbmciLCJzZWxlY3RlZElkIiwiTnVtYmVyIiwic2VsZWN0ZWRfaWQiLCJyZXF1ZXN0ZWRfZm9jdXMiLCJTdHJpbmciLCJmb2N1c19zZWN0aW9uIiwiZm9jdXNfaGFuZGxlZCIsImJ1c3kiLCJzdGF0dXMiLCJzZXJ2aWNlcyIsInByb3ZpZGVycyIsInByb3ZpZGVyQ291bnQiLCJlZGl0b3Jfc25hcHNob3QiLCJlZGl0b3JfcmVxdWVzdF9zZXF1ZW5jZSIsImluaXRpYWxfc2VsZWN0aW9uX3BlbmRpbmciLCJpbnNwZWN0b3JfZm9jdXNfdGFyZ2V0IiwibXV0YXRpb25faW5fcHJvZ3Jlc3MiLCJvcGVyYXRpb25fbW9kZSIsIm9wZXJhdGlvbl9yZXZpZXciLCJvcGVyYXRpb25fcmVxdWVzdF9zZXF1ZW5jZSIsImlubGluZV9lZGl0aW5nIiwiaW5saW5lX2RyYWZ0cyIsImlubGluZV9zY2hlbWEiLCJpbmxpbmVfc2NoZW1hX2xvYWRpbmciLCJpbmxpbmVfcmVxdWVzdF9zZXF1ZW5jZSIsImxhc3RfcmVzcG9uc2UiLCJwYWdlIiwicGFnZV9zaXplIiwiY2F0YWxvZyIsImluaXRpYWxfcmVxdWVzdCIsIml0ZW1zX3Blcl9wYWdlIiwidG90YWxfaXRlbXMiLCJ0b3RhbF9wYWdlcyIsInNvcnRfYnkiLCJzb3J0X29yZGVyIiwiY2F0YWxvZ0NvbnRyb2xsZXIiLCJpbmxpbmVXb3JrZmxvd0NvbnRyb2xsZXIiLCJpbmxpbmVSZXZpZXdXb3JrZmxvd0NvbnRyb2xsZXIiLCJkZWxldGVSZXZpZXdXb3JrZmxvd0NvbnRyb2xsZXIiLCJpbnNwZWN0b3JXb3JrZmxvd0NvbnRyb2xsZXIiLCJzZWFyY2hUaW1lciIsIndlZWtkYXlLZXlzIiwicGVuZGluZ19oaWdobGlnaHRfaWRzIiwibWVzc2FnZUZyb20iLCJyZXNwb25zZSIsImZhbGxiYWNrIiwiZGF0YSIsIm1lc3NhZ2UiLCJub3RpZnkiLCJ0eXBlIiwid3BiY19hZG1pbl9zaG93X21lc3NhZ2UiLCJnZXRfaW5saW5lX3Jldmlld193b3JrZmxvdyIsIndwYmNfdWlfY2F0YWxvZyIsImNyZWF0ZV9pbmxpbmVfcmV2aWV3X3dvcmtmbG93IiwiYXBwbHlfc2VsZWN0b3IiLCJjYW5jZWxfc2VsZWN0b3IiLCJyb290IiwiZG9jdW1lbnQiLCJnZXRfZGVsZXRlX3Jldmlld193b3JrZmxvdyIsImNyZWF0ZV9kZWxldGVfcmV2aWV3X3dvcmtmbG93IiwiYWNrbm93bGVkZ2VtZW50X3NlbGVjdG9yIiwic2hvd19wcm9jZXNzaW5nX25vdGljZSIsIndwYmNfYWRtaW5fc2hvd19tZXNzYWdlX3Byb2Nlc3NpbmciLCJsYXN0IiwiY2xvc2VzdCIsImhpZGVfcHJvY2Vzc2luZ19ub3RpY2UiLCIkcHJvY2Vzc2luZ19ub3RpY2UiLCJsZW5ndGgiLCJzdG9wIiwiaGlkZSIsInJlcXVlc3QiLCJhY3Rpb24iLCJ1c2VfcHJvY2Vzc2luZ19ub3RpY2UiLCJhamF4IiwidXJsIiwiYWpheF91cmwiLCJkYXRhVHlwZSIsImV4dGVuZCIsIm5vbmNlIiwiYWx3YXlzIiwic3dpdGNoUmlnaHRQYW5lbCIsIiR0YWIiLCJwYW5lbElkIiwiYXR0ciIsInBhbmVsIiwiZ2V0RWxlbWVudEJ5SWQiLCIkdGFicyIsImZpbmQiLCIkcGFuZWxzIiwicHJvcCIsInVwZGF0ZUNvbnRyb2xzIiwibm90aWZ5X3NldHVwX3dpemFyZF9sYXlvdXRfY2hhbmdlZCIsInRyaWdnZXIiLCJzZXRUaW1lb3V0IiwiZXhwYW5kX3NlcnZpY2VfaW5zcGVjdG9yIiwiJHNldHRpbmdzX3RhYiIsIndwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX2RvX21heCIsIm9wZW5fc2VydmljZV9pbnNwZWN0b3JfZ3JvdXAiLCJmaWVsZHNfc2VsZWN0b3IiLCJmb2N1c19zZWxlY3RvciIsIiRncm91cF9maWVsZHMiLCIkZ3JvdXAiLCIkZ3JvdXBfaGVhZGVyIiwiY2hpbGRyZW4iLCJncm91cF9lbGVtZW50IiwiZ2V0IiwiZm9jdXNfZWxlbWVudCIsInF1ZXJ5U2VsZWN0b3IiLCJhZGRDbGFzcyIsInJlbW92ZUNsYXNzIiwib2Zmc2V0V2lkdGgiLCJzY3JvbGxJbnRvVmlldyIsImJlaGF2aW9yIiwiYmxvY2siLCJpbmxpbmUiLCJlcnJvciIsImZvY3VzIiwicHJldmVudFNjcm9sbCIsIm9wZW5fYWRkX3NlcnZpY2VfaW5zcGVjdG9yIiwiZm9jdXNfcmVxdWVzdGVkX3NlcnZpY2Vfc2VjdGlvbiIsImhpc3RvcnkiLCJVUkwiLCJsb2NhdGlvbiIsImhyZWYiLCJzZWFyY2hQYXJhbXMiLCJkZWxldGUiLCJyZXBsYWNlU3RhdGUiLCJ0b1N0cmluZyIsInRvZ2dsZUluc3BlY3Rvckdyb3VwIiwiJGJ1dHRvbiIsIiRmaWVsZHMiLCJpc09wZW4iLCJoYXNDbGFzcyIsInRvZ2dsZUNsYXNzIiwiZWRpdG9ySXNPcGVuIiwic3luY19udW1lcmljX3JhbmdlIiwiZmllbGRfaWQiLCIkZmllbGQiLCIkcmFuZ2UiLCJ2YWx1ZSIsInZhbCIsImRlZmF1bHRfbWluIiwiZGVmYXVsdF9tYXgiLCJzdGVwIiwicmFuZ2VfbWF4IiwiaXNGaW5pdGUiLCJNYXRoIiwiY2VpbCIsIm1pbiIsIm1heCIsInN5bmNfYWxsX251bWVyaWNfcmFuZ2VzIiwiZWFjaCIsInN5bmNfc3RhdHVzX3JhZGlvcyIsInVwZGF0ZU1lZGlhUHJldmlldyIsInBpY3R1cmVVcmwiLCJ0cmltIiwiJGltYWdlIiwicmVtb3ZlQXR0ciIsIm9wZW4iLCJvcGVyYXRpb25fb3BlbiIsIm9wZXJhdGlvbl9pc19yZXZpZXciLCJvcGVyYXRpb25faXNfZGVsZXRlX3JldmlldyIsImhhc1BpY3R1cmUiLCJzaG93X3NhdmUiLCJjb2xsZWN0X2J1bGtfY2hhbmdlcyIsInN5bmNocm9uaXplX2lubGluZV93b3JrZmxvdyIsImNoYW5nZWRfY291bnQiLCJnZXRfaW5saW5lX2NoYW5nZWRfY291bnQiLCJzeW5jaHJvbml6ZSIsImFjdGl2ZSIsImNvdW50X3RleHQiLCJpMThuIiwiY2hhbmdlZF9yb3dzIiwicmVwbGFjZSIsImhhc19pdGVtcyIsImxvY2tfY29udHJvbHMiLCJ0b2dnbGVfZGlzYWJsZWQiLCJhY3RpdmVfdG9nZ2xlX3RleHQiLCJlZGl0aW5nX3Jvd3MiLCJpbmFjdGl2ZV90b2dnbGVfdGV4dCIsImVkaXRfcm93cyIsInByb3RlY3RfaW5saW5lX2RyYWZ0c19mcm9tX2NhdGFsb2dfY29udHJvbHMiLCJldmVudCIsInByb3RlY3RlZF9jb250cm9sIiwicHJvdGVjdF9ldmVudCIsInRhcmdldCIsInByZXZlbnREZWZhdWx0Iiwic3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uIiwic2V0QnVzeSIsInNldEZpZWxkc0VuYWJsZWQiLCJlbmFibGVkIiwiYmxhbmtTZXJ2aWNlIiwic2VydmljZV9pZCIsInRpdGxlIiwiZGVzY3JpcHRpb24iLCJwaWN0dXJlX3VybCIsImR1cmF0aW9uX21pbnV0ZXMiLCJidWZmZXJfYmVmb3JlX21pbnV0ZXMiLCJidWZmZXJfYWZ0ZXJfbWludXRlcyIsImJhc2VfY29zdCIsImJvb2tpbmdfZm9ybV9pZCIsInJlc291cmNlX2lkcyIsImRlZmF1bHRfcHJvdmlkZXJfaWRzIiwic2xpY2UiLCJyZW5kZXJfaW5zcGVjdG9yX2hlYWRlciIsImlzX2VkaXQiLCJ0ZW1wbGF0ZV9pZCIsInRlbXBsYXRlIiwiY2F0YWxvZ1RlbXBsYXRlIiwiJGhlYWRlciIsImNvbnRleHQiLCJpbnNwZWN0b3JfY29udGV4dF9pZCIsImluc3BlY3Rvcl9jb250ZXh0X25ldyIsImh0bWwiLCJlZGl0X3NlcnZpY2VfdGl0bGUiLCJjcmVhdGVfc2VydmljZV90aXRsZSIsImVkaXRfc2VydmljZV9kZXNjcmlwdGlvbiIsImNyZWF0ZV9zZXJ2aWNlX2Rlc2NyaXB0aW9uIiwiZmlsbEVkaXRvciIsInNlcnZpY2UiLCJrZXkiLCJjYXB0dXJlX2VkaXRvcl9zbmFwc2hvdCIsImNvbGxlY3RFZGl0b3IiLCJKU09OIiwic3RyaW5naWZ5IiwiaXNfZWRpdG9yX2RpcnR5IiwiY2FuX3JlcGxhY2VfZWRpdG9yIiwiY29uZmlybSIsImNvbmZpcm1fZGlzY2FyZCIsImlzX29wZXJhdGlvbl9kaXJ0eSIsInJlc2V0X3NlcnZpY2VfZWRpdG9yIiwidXBkYXRlVXJsIiwicmVzZXRfb3BlcmF0aW9uIiwicmVzdG9yZV9pbmxpbmUiLCJlbXB0eSIsInRleHQiLCJhcHBseV9jaGFuZ2VzIiwicmVuZGVyQ2F0YWxvZ1Jlc3BvbnNlIiwiY2xvc2Vfc2VydmljZV9pbnNwZWN0b3IiLCJoaWRlX3NpZGViYXIiLCJmb2N1c190YXJnZXQiLCJ3cGJjX2FkbWluX3VpX19zaWRlYmFyX3JpZ2h0X19kb19oaWRlIiwiZG9jdW1lbnRFbGVtZW50IiwiY29udGFpbnMiLCJzZXJ2aWNlSWQiLCJzZXQiLCJpbmRleFByb3ZpZGVycyIsImluZGV4IiwicHJvdmlkZXIiLCJpZCIsInVwZGF0ZVN1bW1hcnkiLCJjb3VudHMiLCJhbGwiLCJpbmFjdGl2ZSIsImFyY2hpdmVkIiwiY291bnQiLCJmb3JtYXRDb3N0IiwiY29zdCIsImFtb3VudCIsInN5bWJvbCIsImN1cnJlbmN5X3N5bWJvbCIsInRvRml4ZWQiLCJwcm92aWRlck5vZGVzIiwiaWRzIiwibWFwIiwiJHN0YWNrIiwibm9fcHJvdmlkZXIiLCJpbml0aWFscyIsImF2YXRhcl91cmwiLCJoYXNfYXZhaWxhYmlsaXR5IiwiaGFzX3dlZWtseV9hdmFpbGFiaWxpdHkiLCJwcm92aWRlcl90aXRsZSIsImF2YXRhcl90aXRsZSIsImF2YXRhcl9hdHRyaWJ1dGVzIiwiJGF2YXRhciIsIm5vX2F2YWlsYWJpbGl0eSIsImF2YWlsYWJpbGl0eV91cmwiLCJlZGl0X2F2YWlsYWJpbGl0eSIsInNyYyIsImFsdCIsImxvYWRpbmciLCJhcHBlbmRUbyIsImFwcGVuZCIsIm1vcmVfcHJvdmlkZXJzIiwic2VydmljZVRodW1ibmFpbE5vZGUiLCJzZXJ2aWNlX3RpdGxlIiwidW50aXRsZWQiLCJzZXJ2aWNlX2Rlc2NyaXB0aW9uIiwibm9fZGVzY3JpcHRpb24iLCJ0b29sdGlwX2Zvcm1hdCIsInNlcnZpY2VfdGh1bWJuYWlsX3Rvb2x0aXAiLCJ0b29sdGlwX3RleHQiLCIkdGh1bWJuYWlsIiwicm9sZSIsInRhYmluZGV4IiwiZGVjb2RpbmciLCJkZXN0cm95X3NlcnZpY2VfdGh1bWJuYWlsX3Rvb2x0aXBzIiwiX3RpcHB5IiwiZGVzdHJveSIsInJlZnJlc2hfc2VydmljZV90aHVtYm5haWxfdG9vbHRpcHMiLCJsaXN0aW5nX3NlbGVjdG9yIiwiJHRodW1ibmFpbHMiLCJ0b29sdGlwc19pbml0aWFsaXplZCIsIndwYmNfZGVmaW5lX3RpcHB5X3Rvb2x0aXBzIiwic2VydmljZV9kdXJhdGlvbl9ub2RlIiwiZHVyYXRpb25fZm9ybWF0IiwiYnVmZmVyc19mb3JtYXQiLCJidWZmZXJzX3N1bW1hcnkiLCJidWZmZXJzX3Rvb2x0aXBfZm9ybWF0IiwiYnVmZmVyc190b29sdGlwIiwiJGR1cmF0aW9uX2RldGFpbHMiLCJwcm92aWRlcnNfYXZhaWxhYmxlX29uIiwiZGF5IiwiYXZhaWxhYmxlX3Byb3ZpZGVycyIsIndlZWtkYXlzIiwicHVzaCIsImF2YWlsYWJpbGl0eV9lZGl0X2xpbmtzIiwiJGxpbmtzIiwiZWRpdF9wcm92aWRlcl9hdmFpbGFiaWxpdHkiLCJsaW5rX3RpdGxlIiwic3RhdHVzTGFiZWwiLCJkcmFmdCIsInNob3dpbmdUZXh0IiwiZnJvbSIsInRvIiwidG90YWwiLCJmb3JtYXQiLCJzaG93aW5nIiwidGVtcGxhdGVJZCIsIndwIiwiZ2V0X29wZXJhdGlvbl9pbnNwZWN0b3Jfd29ya2Zsb3ciLCJjcmVhdGVfaW5zcGVjdG9yX3dvcmtmbG93IiwidGVtcGxhdGVzIiwiaW5zcGVjdG9yIiwiZXhwYW5kIiwiZ2V0X2Zvb3RlciIsImdldF9ob3N0IiwicmVuZGVyX3NoZWxsIiwic2hlbGxfZGF0YSIsInNoZWxsX3RlbXBsYXRlIiwiY2F0YWxvZ19pZCIsImVtcHR5X2ljb24iLCJlbXB0eV9tZXNzYWdlIiwiZW1wdHlfdGl0bGUiLCJsb2FkaW5nX2xhYmVsIiwibm9kZUh0bWwiLCIkbm9kZSIsImdldF9zZWxlY3Rpb25fY29udHJvbGxlciIsIm1vdW50IiwiX3dwYmNfdWlfY2F0YWxvZ19zZWxlY3Rpb25fY29udHJvbGxlciIsImdldF9zZWxlY3RlZF9zZXJ2aWNlX2lkcyIsInNlbGVjdGlvbiIsImdldF9zZWxlY3RlZF9pZHMiLCJmaW5kX3NlcnZpY2UiLCJmb3VuZCIsImNyZWF0ZV9pbmxpbmVfZHJhZnQiLCJyb3dfc2NoZW1hIiwiQXJyYXkiLCJpc0FycmF5IiwiZmllbGRzIiwiZmllbGQiLCJmaWVsZF9rZXkiLCJmaW5kX2lubGluZV9zY2hlbWEiLCJpbmxpbmVfZHJhZnRfY2hhbmdlZCIsImNoYW5nZWQiLCJjb2xsZWN0X2lubGluZV9jaGFuZ2VzIiwiY2hhbmdlcyIsInJvd19jaGFuZ2VzIiwiT2JqZWN0Iiwia2V5cyIsInJlbmRlcl9pbmxpbmVfYmFyIiwiJGhvc3QiLCJjaGFuZ2VkX2xhYmVsIiwiaW5saW5lX2hlbHAiLCJjYW5jZWwiLCJyZXZpZXciLCJyZXZpZXdfY2hhbmdlcyIsInN5bmNocm9uaXplX2lubGluZV9iYXIiLCIkYmFyIiwic3RhcnRfaW5saW5lX2VkaXRpbmciLCJyZXF1ZXN0X3NlcXVlbmNlIiwidmlzaWJsZV9pZHMiLCJjYW5jZWxfaW5saW5lX2VkaXRpbmciLCJhY3Rpb25zIiwiZG9uZSIsInNjaGVtYSIsInN1Y2Nlc3MiLCJyb3dzIiwiaW5saW5lX3NjaGVtYV9mYWlsZWQiLCJmaXJzdCIsImZhaWwiLCJ4aHIiLCJyZXNwb25zZUpTT04iLCJvcGVuX29wZXJhdGlvbiIsIm1vZGUiLCJ0ZW1wbGF0ZV9kYXRhIiwiaW5zcGVjdG9yX3dvcmtmbG93IiwicmVuZGVyZWRfb3BlcmF0aW9uIiwib3BlcmF0aW9uX2ZhaWxlZCIsImxvYWRfZmFpbGVkIiwiYWN0aXZlRWxlbWVudCIsImdldF9mb3JtX3RhcmdldCIsInNldF9zdGF0ZSIsImlubmVySFRNTCIsIm9wZW5fYnVsa19lZGl0Iiwic2VsZWN0ZWRfaWRzIiwiYnVsa19jb250cmFjdCIsImNvbnRyYWN0IiwiYnVsa19jb250cmFjdF9mYWlsZWQiLCJidWxrX2VkaXRfdGl0bGUiLCJidWxrX2VkaXRfZGVzY3JpcHRpb24iLCJwcmV2aWV3X29wZXJhdGlvbiIsIm9wZW5fbG9hZGluZyIsInByZXZpZXdfZmFpbGVkIiwicHJldmlldyIsInJldmlld193b3JrZmxvdyIsInJldmlld19yb3dzIiwicmV2aWV3X21vZGVsIiwicGxhbiIsInRva2VuIiwiZXJyb3JfbWVzc2FnZSIsInByZXBhcmUiLCJyZXZpZXdfY29uZmlybWF0aW9uIiwiZm9ybV9pZCIsInBlbmRpbmdfbWVzc2FnZSIsInJldmlld19kZXNjcmlwdGlvbiIsImlubGluZV9yZXZpZXdfdGl0bGUiLCJidWxrX3Jldmlld190aXRsZSIsImNhbl9hcHBseSIsInByZXZpZXdfZGVsZXRpb24iLCJmaWx0ZXIiLCJkZWxldGVfcHJldmlld19mYWlsZWQiLCJkZWxldGVfcHJldmlldyIsImRlbGV0ZV9yZXZpZXciLCJkZWxldGVfaTE4biIsImRlbGV0ZV93b3JrZmxvdyIsImFja25vd2xlZGdlbWVudCIsImFjdGlvbnNfaGVhZGluZyIsImlkX2xhYmVsIiwiY29sdW1uX2lkIiwiaXRlbXMiLCJpdGVtc19oZWFkaW5nIiwic2VsZWN0aW9uX2xhYmVsIiwid2FybmluZyIsImNvbmZpZ3VyZV9mb290ZXIiLCJmb290ZXIiLCJsYWJlbCIsImRlbGV0ZV9idXR0b24iLCJwdWxzZV9hY2tub3dsZWRnZW1lbnQiLCJhcHBseV9vcGVyYXRpb24iLCJjaGFuZ2VkX2lkcyIsImlzX2RlbGV0ZSIsImNoZWNrZWQiLCJkZWxldGVfYXBwbHkiLCJhcHBseSIsImFja25vd2xlZGdlZCIsImRlbGV0ZV9hcHBseV9mYWlsZWQiLCJhcHBseV9mYWlsZWQiLCJjbGVhcl9zZWxlY3Rpb24iLCJsb2FkIiwicGFnZV9udW1iZXIiLCJhcHBseV9wZW5kaW5nX2hpZ2hsaWdodHMiLCJmaXJzdF9zZXJ2aWNlIiwiZm9yRWFjaCIsImNsYXNzTGlzdCIsImFkZCIsIndpbmRvdyIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJyZW1vdmUiLCJyZXNwb25zZUNvbHVtbnMiLCJkZWZpbml0aW9ucyIsImNvbHVtbnMiLCJ2aXNpYmxlIiwiZGlzcGxheSIsInZpc2libGVfY29sdW1ucyIsIm9yZGVyIiwiY29sdW1uX29yZGVyIiwiY29sdW1uSWQiLCJkZWZpbml0aW9uIiwiaXNfc29ydGVkIiwiaW5kZXhPZiIsInNvcnRfa2V5Iiwic29ydGluZyIsImFyaWFfc29ydCIsImNsYXNzX25hbWUiLCJjbGFzcyIsInNvcnRfaWNvbiIsInJlc3BvbnNlU29ydENvbHVtbnMiLCJjb2x1bW5JbmRleCIsImNvbHVtbiIsInNlcnZpY2VDZWxscyIsImlubGluZV9maWVsZF90ZW1wbGF0ZSIsImlubGluZV9jZWxscyIsIiRpZGVudGl0eSIsImlkZW50aXR5X2ZpZWxkc19jbGFzcyIsIiRjb3B5IiwiJGF2YWlsYWJpbGl0eSIsIiRhdmFpbGFiaWxpdHlXZWVrIiwiaGFzV2Vla2x5QXZhaWxhYmlsaXR5Iiwic3RhdHVzVGVtcGxhdGUiLCJwcm92aWRlclRlbXBsYXRlIiwiJGFjdGlvbnMiLCJmaWVsZF9pbmRleCIsImZpZWxkX2RhdGEiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImNhbGwiLCJvcmlnaW5hbF92YWx1ZSIsInByZXBlbmRUbyIsImRheUluZGV4IiwiYXZhaWxhYmxlUHJvdmlkZXJzIiwiYXZhaWxhYmxlIiwiZGF5VGl0bGUiLCJwcm92aWRlclRpdGxlcyIsInByb3ZpZGVyVGl0bGUiLCJhdmFpbGFiaWxpdHlUaXRsZSIsImpvaW4iLCJub19hdmFpbGFibGVfcHJvdmlkZXJzIiwiZWRpdCIsImFyY2hpdmUiLCJkdXJhdGlvbiIsInByaWNlIiwibWF4X3Zpc2libGUiLCJlbXB0eV9sYWJlbCIsIm1vcmVfbGFiZWwiLCJhdmFpbGFiaWxpdHkiLCJyb3dUZW1wbGF0ZSIsImNhcmRUZW1wbGF0ZSIsImhlYWRlclRlbXBsYXRlIiwiY2FyZHNIZWFkZXJUZW1wbGF0ZSIsInBhZ2luYXRpb25UZW1wbGF0ZSIsImlzQ2FyZHMiLCJ0ZW1wbGF0ZV9wYWNrIiwiJHJvd0hvc3QiLCIkY2FyZEhvc3QiLCJwYWdpbmF0aW9uIiwicmVuZGVyZWRJdGVtcyIsInNlbGVjdF9hbGxfbGFiZWwiLCJzZWxlY3RfYWxsIiwiaXNfaW5zcGVjdG9yX3NlbGVjdGVkIiwic2VsZWN0X2xhYmVsIiwic2VsZWN0X3NlcnZpY2UiLCJjZWxscyIsInJlc3VsdHNfc3RhdHVzIiwiaXRlbXNfZnJvbSIsIml0ZW1zX3RvIiwic2hvd19sYWJlbCIsInBlcl9wYWdlX2xhYmVsIiwiaXRlbXNfcGVyX3BhZ2Vfb3B0aW9ucyIsIm9wdGlvbnMiLCJhcmlhX2xhYmVsIiwicGFnaW5hdGlvbl9sYWJlbCIsInBhZ2VfbnVtYmVyX2xhYmVsIiwicHJldmlvdXNfcGFnZSIsIm5leHRfcGFnZSIsInByZXZpb3VzX2xhYmVsIiwibmV4dF9sYWJlbCIsImhhc19wcmV2aW91cyIsImhhc19uZXh0IiwicmVmcmVzaF9jb250cm9scyIsInN5bmNfdGFibGVfbWluX3dpZHRoIiwibG9hZE9uZSIsImxvYWRMaXN0Iiwic2F2ZV9wcmVmZXJlbmNlcyIsInJlcXVlc3REYXRhIiwic2VhcmNoIiwicmVzb3VyY2VfaWQiLCJwcmVmZXJlbmNlX2FjdGlvbiIsIlByb21pc2UiLCJyZXNvbHZlIiwic3luY19zZWFyY2hfY2xlYXJfYnV0dG9uIiwic2VhcmNoX3ZhbHVlIiwiYXJjaGl2ZVNlcnZpY2UiLCJjb25maXJtX2FyY2hpdmUiLCJhcmNoaXZlX2ZhaWxlZCIsIm9uIiwic3RvcFByb3BhZ2F0aW9uIiwic2F2ZSIsInNhdmVfZmFpbGVkIiwiZHVwbGljYXRlIiwiZHVwbGljYXRlX2ZhaWxlZCIsInJvd19lbGVtZW50IiwiaW5kaWNhdG9yX2VsZW1lbnQiLCJzZXRfcm93X2NoYW5nZWQiLCJoYW5kbGVfY2hhbmdlIiwiY2xlYXJUaW1lb3V0IiwiJHNlYXJjaF9jb250cm9sIiwiZXZlbnRfZGV0YWlsIiwib3JpZ2luYWxFdmVudCIsImRldGFpbCIsImZpbHRlcnMiLCJzdG9yYWdlX3JlYWR5Iiwic3RhdHVzX2NvdW50cyIsInByb3ZpZGVyX2NvdW50IiwibW91bnRfZWxlbWVudCIsInBhZ2VfZWxlbWVudCIsInByb3RlY3RlZF9ldmVudHNfcm9vdCIsImFkZEV2ZW50TGlzdGVuZXIiLCJjcmVhdGVfaW5saW5lX2VkaXRpbmdfd29ya2Zsb3ciLCJjb250cm9sc19yb290IiwicHJvdGVjdGVkX3NlbGVjdG9yIiwialF1ZXJ5Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1hcHBvaW50bWVudC1zZXJ2aWNlcy9fc3JjL2FwcG9pbnRtZW50X3NlcnZpY2VzX3BhZ2UuanMiXSwic291cmNlc0NvbnRlbnQiOlsiKCBmdW5jdGlvbiAoIHcsICQgKSB7XG5cdCd1c2Ugc3RyaWN0Jztcblx0dmFyIGNvbmZpZyA9IHcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19jb25maWcgfHwge307XG5cdHZhciBzdGF0ZSA9IHtcblx0XHRzdG9yYWdlUmVhZHk6IGZhbHNlLFxuXHRcdGNhdGFsb2dfbG9hZGluZzogdHJ1ZSxcblx0XHRzZWxlY3RlZElkOiBOdW1iZXIoIGNvbmZpZy5zZWxlY3RlZF9pZCB8fCAwICksXG5cdFx0cmVxdWVzdGVkX2ZvY3VzOiBTdHJpbmcoIGNvbmZpZy5mb2N1c19zZWN0aW9uIHx8ICcnICksXG5cdFx0Zm9jdXNfaGFuZGxlZDogZmFsc2UsXG5cdFx0YnVzeTogZmFsc2UsXG5cdFx0c3RhdHVzOiAnYWxsJyxcblx0XHRzZXJ2aWNlczogW10sXG5cdFx0cHJvdmlkZXJzOiB7fSxcblx0XHRwcm92aWRlckNvdW50OiAwLFxuXHRcdGVkaXRvcl9zbmFwc2hvdDogJycsXG5cdFx0ZWRpdG9yX3JlcXVlc3Rfc2VxdWVuY2U6IDAsXG5cdFx0aW5pdGlhbF9zZWxlY3Rpb25fcGVuZGluZzogMCA8IE51bWJlciggY29uZmlnLnNlbGVjdGVkX2lkIHx8IDAgKSxcblx0XHRpbnNwZWN0b3JfZm9jdXNfdGFyZ2V0OiBudWxsLFxuXHRcdG11dGF0aW9uX2luX3Byb2dyZXNzOiBmYWxzZSxcblx0XHRvcGVyYXRpb25fbW9kZTogJycsXG5cdFx0b3BlcmF0aW9uX3JldmlldzogbnVsbCxcblx0XHRvcGVyYXRpb25fcmVxdWVzdF9zZXF1ZW5jZTogMCxcblx0XHRpbmxpbmVfZWRpdGluZzogZmFsc2UsXG5cdFx0aW5saW5lX2RyYWZ0czoge30sXG5cdFx0aW5saW5lX3NjaGVtYToge30sXG5cdFx0aW5saW5lX3NjaGVtYV9sb2FkaW5nOiBmYWxzZSxcblx0XHRpbmxpbmVfcmVxdWVzdF9zZXF1ZW5jZTogMCxcblx0XHRsYXN0X3Jlc3BvbnNlOiBudWxsLFxuXHRcdHBhZ2U6IDEsXG5cdFx0cGFnZV9zaXplOiBOdW1iZXIoIGNvbmZpZy5jYXRhbG9nICYmIGNvbmZpZy5jYXRhbG9nLmluaXRpYWxfcmVxdWVzdCAmJiBjb25maWcuY2F0YWxvZy5pbml0aWFsX3JlcXVlc3QuaXRlbXNfcGVyX3BhZ2UgPyBjb25maWcuY2F0YWxvZy5pbml0aWFsX3JlcXVlc3QuaXRlbXNfcGVyX3BhZ2UgOiAxMCApLFxuXHRcdHRvdGFsX2l0ZW1zOiAwLFxuXHRcdHRvdGFsX3BhZ2VzOiAwLFxuXHRcdHNvcnRfYnk6IFN0cmluZyggY29uZmlnLmNhdGFsb2cgJiYgY29uZmlnLmNhdGFsb2cuaW5pdGlhbF9yZXF1ZXN0ICYmIGNvbmZpZy5jYXRhbG9nLmluaXRpYWxfcmVxdWVzdC5zb3J0X2J5ID8gY29uZmlnLmNhdGFsb2cuaW5pdGlhbF9yZXF1ZXN0LnNvcnRfYnkgOiAnc2VydmljZV9pZCcgKSxcblx0XHRzb3J0X29yZGVyOiBTdHJpbmcoIGNvbmZpZy5jYXRhbG9nICYmIGNvbmZpZy5jYXRhbG9nLmluaXRpYWxfcmVxdWVzdCAmJiBjb25maWcuY2F0YWxvZy5pbml0aWFsX3JlcXVlc3Quc29ydF9vcmRlciA/IGNvbmZpZy5jYXRhbG9nLmluaXRpYWxfcmVxdWVzdC5zb3J0X29yZGVyIDogJ2Rlc2MnIClcblx0fTtcblx0dmFyIGNhdGFsb2dDb250cm9sbGVyID0gZmFsc2U7XG5cdHZhciBpbmxpbmVXb3JrZmxvd0NvbnRyb2xsZXIgPSBmYWxzZTtcblx0dmFyIGlubGluZVJldmlld1dvcmtmbG93Q29udHJvbGxlciA9IGZhbHNlO1xuXHR2YXIgZGVsZXRlUmV2aWV3V29ya2Zsb3dDb250cm9sbGVyID0gZmFsc2U7XG5cdHZhciBpbnNwZWN0b3JXb3JrZmxvd0NvbnRyb2xsZXIgPSBmYWxzZTtcblx0dmFyIHNlYXJjaFRpbWVyID0gMDtcblx0dmFyIHdlZWtkYXlLZXlzID0gWyAnbW9uJywgJ3R1ZScsICd3ZWQnLCAndGh1JywgJ2ZyaScsICdzYXQnLCAnc3VuJyBdO1xuXHR2YXIgcGVuZGluZ19oaWdobGlnaHRfaWRzID0gW107XG5cblx0LyoqIEV4dHJhY3QgYW4gQVBJIG1lc3NhZ2Ugd2hpbGUgcHJlc2VydmluZyBhIGNhbGxlci1wcm92aWRlZCBmYWxsYmFjay4gKi9cblx0ZnVuY3Rpb24gbWVzc2FnZUZyb20oIHJlc3BvbnNlLCBmYWxsYmFjayApIHsgcmV0dXJuIHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5tZXNzYWdlID8gcmVzcG9uc2UuZGF0YS5tZXNzYWdlIDogZmFsbGJhY2s7IH1cblx0LyoqIERpc3BsYXkgYSBzaGFyZWQgQm9va2luZyBDYWxlbmRhciBhZG1pbmlzdHJhdG9yIG5vdGljZS4gKi9cblx0ZnVuY3Rpb24gbm90aWZ5KCBtZXNzYWdlLCB0eXBlICkge1xuXHRcdGlmICggbWVzc2FnZSAmJiB0eXBlb2Ygdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSA9PT0gJ2Z1bmN0aW9uJyApIHsgdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggbWVzc2FnZSwgdHlwZSB8fCAnaW5mbycsIDUwMDAsIGZhbHNlICk7IH1cblx0fVxuXHQvKipcblx0ICogUmV0dXJuIHRoZSBzaGFyZWQgc2lnbmVkLXJldmlldyBwcmVzZW50YXRpb24gY29udHJvbGxlci5cblx0ICpcblx0ICogQHJldHVybiB7T2JqZWN0fGZhbHNlfSBTaGFyZWQgcmV2aWV3IGNvbnRyb2xsZXIgb3IgZmFsc2Ugd2hlbiB1bmF2YWlsYWJsZS5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9pbmxpbmVfcmV2aWV3X3dvcmtmbG93KCkge1xuXHRcdGlmICggaW5saW5lUmV2aWV3V29ya2Zsb3dDb250cm9sbGVyICkgeyByZXR1cm4gaW5saW5lUmV2aWV3V29ya2Zsb3dDb250cm9sbGVyOyB9XG5cdFx0aWYgKCAhIHcud3BiY191aV9jYXRhbG9nIHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiB3LndwYmNfdWlfY2F0YWxvZy5jcmVhdGVfaW5saW5lX3Jldmlld193b3JrZmxvdyApIHsgcmV0dXJuIGZhbHNlOyB9XG5cdFx0aW5saW5lUmV2aWV3V29ya2Zsb3dDb250cm9sbGVyID0gdy53cGJjX3VpX2NhdGFsb2cuY3JlYXRlX2lubGluZV9yZXZpZXdfd29ya2Zsb3coIHtcblx0XHRcdGFwcGx5X3NlbGVjdG9yOiAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX29wZXJhdGlvbl9hcHBseScsXG5cdFx0XHRjYW5jZWxfc2VsZWN0b3I6ICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fY2FuY2VsJyxcblx0XHRcdHJvb3Q6IGRvY3VtZW50XG5cdFx0fSApO1xuXHRcdHJldHVybiBpbmxpbmVSZXZpZXdXb3JrZmxvd0NvbnRyb2xsZXI7XG5cdH1cblx0LyoqXG5cdCAqIFJldHVybiB0aGUgc2hhcmVkIHBlcm1hbmVudC1kZWxldGlvbiBwcmVzZW50YXRpb24gY29udHJvbGxlci5cblx0ICpcblx0ICogQHJldHVybiB7T2JqZWN0fGZhbHNlfSBTaGFyZWQgZGVsZXRpb24gY29udHJvbGxlciBvciBmYWxzZSB3aGVuIHVuYXZhaWxhYmxlLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X2RlbGV0ZV9yZXZpZXdfd29ya2Zsb3coKSB7XG5cdFx0aWYgKCBkZWxldGVSZXZpZXdXb3JrZmxvd0NvbnRyb2xsZXIgKSB7IHJldHVybiBkZWxldGVSZXZpZXdXb3JrZmxvd0NvbnRyb2xsZXI7IH1cblx0XHRpZiAoICEgdy53cGJjX3VpX2NhdGFsb2cgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHcud3BiY191aV9jYXRhbG9nLmNyZWF0ZV9kZWxldGVfcmV2aWV3X3dvcmtmbG93ICkgeyByZXR1cm4gZmFsc2U7IH1cblx0XHRkZWxldGVSZXZpZXdXb3JrZmxvd0NvbnRyb2xsZXIgPSB3LndwYmNfdWlfY2F0YWxvZy5jcmVhdGVfZGVsZXRlX3Jldmlld193b3JrZmxvdygge1xuXHRcdFx0YWNrbm93bGVkZ2VtZW50X3NlbGVjdG9yOiAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWRlbGV0ZS1hY2tub3dsZWRnZW1lbnRdJyxcblx0XHRcdGFwcGx5X3NlbGVjdG9yOiAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX29wZXJhdGlvbl9hcHBseScsXG5cdFx0XHRjYW5jZWxfc2VsZWN0b3I6ICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fY2FuY2VsJyxcblx0XHRcdHJvb3Q6IGRvY3VtZW50XG5cdFx0fSApO1xuXHRcdHJldHVybiBkZWxldGVSZXZpZXdXb3JrZmxvd0NvbnRyb2xsZXI7XG5cdH1cblx0LyoqXG5cdCAqIFNob3cgdGhlIG5hdGl2ZSBCb29raW5nIENhbGVuZGFyIFByb2Nlc3Npbmcgbm90aWNlLlxuXHQgKlxuXHQgKiBUaGUgcmV0dXJuZWQgZWxlbWVudCBpZGVudGlmaWVzIHRoaXMgc3BlY2lmaWMgcmVxdWVzdCdzIG5vdGljZSBzb1xuXHQgKiBvdmVybGFwcGluZyByZXF1ZXN0cyBjYW5ub3QgZGlzbWlzcyBlYWNoIG90aGVyJ3MgZmVlZGJhY2suXG5cdCAqXG5cdCAqIEByZXR1cm4ge2pRdWVyeX0gUHJvY2Vzc2luZyBub3RpY2Ugd3JhcHBlciwgb3IgYW4gZW1wdHkgY29sbGVjdGlvbi5cblx0ICovXG5cdGZ1bmN0aW9uIHNob3dfcHJvY2Vzc2luZ19ub3RpY2UoKSB7XG5cdFx0aWYgKCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZV9wcm9jZXNzaW5nICkge1xuXHRcdFx0cmV0dXJuICQoKTtcblx0XHR9XG5cblx0XHR3LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlX3Byb2Nlc3NpbmcoICcnICk7XG5cblx0XHRyZXR1cm4gJCggJyNhamF4X3dvcmtpbmcgLndwYmNfcHJvY2Vzc2luZy53cGJjX3NwaW4nICkubGFzdCgpLmNsb3Nlc3QoICdbaWRePVwid3BiY19ub3RpY2VfXCJdJyApO1xuXHR9XG5cdC8qKlxuXHQgKiBIaWRlIHRoZSBQcm9jZXNzaW5nIG5vdGljZSBjcmVhdGVkIGZvciBvbmUgY29tcGxldGVkIHJlcXVlc3QuXG5cdCAqXG5cdCAqIEBwYXJhbSB7alF1ZXJ5fSAkcHJvY2Vzc2luZ19ub3RpY2UgTm90aWNlIHdyYXBwZXIgcmV0dXJuZWQgYnkgc2hvd19wcm9jZXNzaW5nX25vdGljZSgpLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gaGlkZV9wcm9jZXNzaW5nX25vdGljZSggJHByb2Nlc3Npbmdfbm90aWNlICkge1xuXHRcdGlmICggJHByb2Nlc3Npbmdfbm90aWNlICYmICRwcm9jZXNzaW5nX25vdGljZS5sZW5ndGggKSB7XG5cdFx0XHQkcHJvY2Vzc2luZ19ub3RpY2Uuc3RvcCggdHJ1ZSwgdHJ1ZSApLmhpZGUoKTtcblx0XHR9XG5cdH1cblx0LyoqXG5cdCAqIFNlbmQgYW4gYXV0aGVudGljYXRlZCBBcHBvaW50bWVudCBTZXJ2aWNlcyBBSkFYIHJlcXVlc3QuXG5cdCAqXG5cdCAqIFJlcXVlc3RzIG5vcm1hbGx5IHVzZSB0aGUgc2hhcmVkIGFkbWluaXN0cmF0b3IgUHJvY2Vzc2luZyBub3RpY2UgYW5kIHJlbW92ZVxuXHQgKiBvbmx5IHRoZWlyIG93biBub3RpY2UgYWZ0ZXIgc2V0dGxpbmcuIEluc3BlY3Rvci1sb2FkaW5nIHJlcXVlc3RzIG1heSBvcHQgb3V0XG5cdCAqIGJlY2F1c2UgdGhlIHNoYXJlZCBpbnNwZWN0b3IgYWxyZWFkeSBleHBvc2VzIGVxdWl2YWxlbnQgcHJvZ3Jlc3MgZmVlZGJhY2suXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBhY3Rpb24gV29yZFByZXNzIEFKQVggYWN0aW9uIG5hbWUuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgZGF0YSAgICAgICAgICAgICAgICAgICBSZXF1ZXN0LXNwZWNpZmljIHBheWxvYWQuXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gdXNlX3Byb2Nlc3Npbmdfbm90aWNlIFdoZXRoZXIgdG8gc2hvdyB0aGUgZ2xvYmFsIG5vdGljZS5cblx0ICogQHJldHVybiB7anFYSFJ9IGpRdWVyeSBBSkFYIHByb21pc2UgZm9yIHRoZSByZXF1ZXN0LlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVxdWVzdCggYWN0aW9uLCBkYXRhLCB1c2VfcHJvY2Vzc2luZ19ub3RpY2UgKSB7XG5cdFx0dmFyICRwcm9jZXNzaW5nX25vdGljZSA9IGZhbHNlID09PSB1c2VfcHJvY2Vzc2luZ19ub3RpY2UgPyAkKCkgOiBzaG93X3Byb2Nlc3Npbmdfbm90aWNlKCk7XG5cblx0XHRyZXR1cm4gJC5hamF4KCB7IHVybDogY29uZmlnLmFqYXhfdXJsLCB0eXBlOiAnUE9TVCcsIGRhdGFUeXBlOiAnanNvbicsIGRhdGE6ICQuZXh0ZW5kKCB7IGFjdGlvbjogYWN0aW9uLCBub25jZTogY29uZmlnLm5vbmNlIH0sIGRhdGEgfHwge30gKSB9IClcblx0XHRcdC5hbHdheXMoIGZ1bmN0aW9uICgpIHsgaGlkZV9wcm9jZXNzaW5nX25vdGljZSggJHByb2Nlc3Npbmdfbm90aWNlICk7IH0gKTtcblx0fVxuXHQvKiogQWN0aXZhdGUgdGhlIFNldHRpbmdzIG9yIEhlbHAgcGFuZWwgc2VsZWN0ZWQgaW4gdGhlIHJpZ2h0IHNpZGViYXIuICovXG5cdGZ1bmN0aW9uIHN3aXRjaFJpZ2h0UGFuZWwoICR0YWIgKSB7XG5cdFx0dmFyIHBhbmVsSWQgPSAkdGFiLmF0dHIoICdhcmlhLWNvbnRyb2xzJyApO1xuXHRcdHZhciBwYW5lbCA9IHBhbmVsSWQgPyBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggcGFuZWxJZCApIDogbnVsbDtcblx0XHR2YXIgJHRhYnMgPSAkdGFiLmNsb3Nlc3QoICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fcmlnaHRiYXJfdGFicycgKS5maW5kKCAnW3JvbGU9XCJ0YWJcIl0nICk7XG5cdFx0dmFyICRwYW5lbHMgPSAkKCAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX3JpZ2h0YmFyIFtyb2xlPVwidGFicGFuZWxcIl0nICk7XG5cdFx0aWYgKCAhIHBhbmVsICkgeyByZXR1cm47IH1cblx0XHQkdGFicy5hdHRyKCAnYXJpYS1zZWxlY3RlZCcsICdmYWxzZScgKTtcblx0XHQkdGFiLmF0dHIoICdhcmlhLXNlbGVjdGVkJywgJ3RydWUnICk7XG5cdFx0JHBhbmVscy5wcm9wKCAnaGlkZGVuJywgdHJ1ZSApLmF0dHIoICdhcmlhLWhpZGRlbicsICd0cnVlJyApO1xuXHRcdCQoIHBhbmVsICkucHJvcCggJ2hpZGRlbicsIGZhbHNlICkuYXR0ciggJ2FyaWEtaGlkZGVuJywgJ2ZhbHNlJyApO1xuXHRcdHVwZGF0ZUNvbnRyb2xzKCk7XG5cdH1cblx0LyoqXG5cdCAqIFRlbGwgdGhlIGFjdGl2ZSBTZXR1cCBXaXphcmQgYmFyIHRoYXQgdGhlIHBhZ2Ugd29ya3NwYWNlIGNoYW5nZWQgd2lkdGguXG5cdCAqXG5cdCAqIFRoZSBkZWxheWVkIG5vdGlmaWNhdGlvbiBydW5zIGFmdGVyIHRoZSBzaGFyZWQgc2lkZWJhciB0cmFuc2l0aW9uIHNvIHRoZVxuXHQgKiBzZXR1cCBiYXIgY2FuIG1lYXN1cmUgdGhlIGZpbmFsIGluc3BlY3RvciBib3VuZGFyeS5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIG5vdGlmeV9zZXR1cF93aXphcmRfbGF5b3V0X2NoYW5nZWQoKSB7XG5cdFx0JCggZG9jdW1lbnQgKS50cmlnZ2VyKCAnd3BiY19zZXR1cF93aXphcmRfbGF5b3V0X2NoYW5nZWQnICk7XG5cdFx0dy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7ICQoIGRvY3VtZW50ICkudHJpZ2dlciggJ3dwYmNfc2V0dXBfd2l6YXJkX2xheW91dF9jaGFuZ2VkJyApOyB9LCAzMDAgKTtcblx0fVxuXHQvKipcblx0ICogRXhwYW5kIHRoZSByaWdodCBzaWRlYmFyIGFuZCBkaXNwbGF5IHRoZSBTZXJ2aWNlIFNldHRpbmdzIGluc3BlY3Rvci5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGV4cGFuZF9zZXJ2aWNlX2luc3BlY3RvcigpIHtcblx0XHR2YXIgJHNldHRpbmdzX3RhYiA9ICQoICcjd3BiY190YWJfc2VydmljZV9zZXR0aW5ncycgKTtcblxuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHcud3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fZG9fbWF4ICkge1xuXHRcdFx0dy53cGJjX2FkbWluX3VpX19zaWRlYmFyX3JpZ2h0X19kb19tYXgoKTtcblx0XHR9XG5cdFx0aWYgKCAkc2V0dGluZ3NfdGFiLmxlbmd0aCApIHtcblx0XHRcdHN3aXRjaFJpZ2h0UGFuZWwoICRzZXR0aW5nc190YWIgKTtcblx0XHR9XG5cdFx0bm90aWZ5X3NldHVwX3dpemFyZF9sYXlvdXRfY2hhbmdlZCgpO1xuXHR9XG5cdC8qKlxuXHQgKiBSZXZlYWwsIGV4cGFuZCwgaGlnaGxpZ2h0LCBhbmQgb3B0aW9uYWxseSBmb2N1cyBvbmUgU2VydmljZSBlZGl0b3IgZ3JvdXAuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBmaWVsZHNfc2VsZWN0b3IgR3JvdXAgZmllbGRzIHNlbGVjdG9yIGZyb20gdGhlIGZpeGVkIGVkaXRvciBtYXJrdXAuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBmb2N1c19zZWxlY3RvciAgT3B0aW9uYWwgY29udHJvbCBzZWxlY3RvciB0byBmb2N1cyBhZnRlciBzY3JvbGxpbmcuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgcmVxdWVzdGVkIGluc3BlY3RvciBncm91cCB3YXMgZm91bmQuXG5cdCAqL1xuXHRmdW5jdGlvbiBvcGVuX3NlcnZpY2VfaW5zcGVjdG9yX2dyb3VwKCBmaWVsZHNfc2VsZWN0b3IsIGZvY3VzX3NlbGVjdG9yICkge1xuXHRcdHZhciAkZ3JvdXBfZmllbGRzID0gJCggZmllbGRzX3NlbGVjdG9yICk7XG5cdFx0dmFyICRncm91cCA9ICRncm91cF9maWVsZHMuY2xvc2VzdCggJy53cGJjX3VpX19jb2xsYXBzaWJsZV9ncm91cCcgKTtcblx0XHR2YXIgJGdyb3VwX2hlYWRlciA9ICRncm91cC5jaGlsZHJlbiggJy5ncm91cF9faGVhZGVyJyApO1xuXHRcdHZhciBncm91cF9lbGVtZW50ID0gJGdyb3VwLmdldCggMCApO1xuXHRcdHZhciBmb2N1c19lbGVtZW50ID0gZm9jdXNfc2VsZWN0b3IgPyBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCBmb2N1c19zZWxlY3RvciApIDogbnVsbDtcblxuXHRcdGV4cGFuZF9zZXJ2aWNlX2luc3BlY3RvcigpO1xuXHRcdGlmICggISAkZ3JvdXAubGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdCRncm91cC5hZGRDbGFzcyggJ2lzLW9wZW4nICk7XG5cdFx0JGdyb3VwX2hlYWRlci5hdHRyKCAnYXJpYS1leHBhbmRlZCcsICd0cnVlJyApO1xuXHRcdCRncm91cF9maWVsZHMucHJvcCggJ2hpZGRlbicsIGZhbHNlICkuYXR0ciggJ2FyaWEtaGlkZGVuJywgJ2ZhbHNlJyApO1xuXHRcdCRncm91cC5yZW1vdmVDbGFzcyggJ3dwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX2ZvY3VzX3B1bHNlJyApO1xuXHRcdGlmICggZ3JvdXBfZWxlbWVudCApIHtcblx0XHRcdHZvaWQgZ3JvdXBfZWxlbWVudC5vZmZzZXRXaWR0aDtcblx0XHRcdCRncm91cC5hZGRDbGFzcyggJ3dwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX2ZvY3VzX3B1bHNlJyApO1xuXHRcdFx0dHJ5IHsgZ3JvdXBfZWxlbWVudC5zY3JvbGxJbnRvVmlldyggeyBiZWhhdmlvcjogJ3Ntb290aCcsIGJsb2NrOiAnc3RhcnQnLCBpbmxpbmU6ICduZWFyZXN0JyB9ICk7IH1cblx0XHRcdGNhdGNoICggZXJyb3IgKSB7IGdyb3VwX2VsZW1lbnQuc2Nyb2xsSW50b1ZpZXcoIHRydWUgKTsgfVxuXHRcdFx0dy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7ICRncm91cC5yZW1vdmVDbGFzcyggJ3dwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX2ZvY3VzX3B1bHNlJyApOyB9LCA5MDAgKTtcblx0XHR9XG5cdFx0aWYgKCBmb2N1c19lbGVtZW50ICYmIHR5cGVvZiBmb2N1c19lbGVtZW50LmZvY3VzID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0dHJ5IHsgZm9jdXNfZWxlbWVudC5mb2N1cyggeyBwcmV2ZW50U2Nyb2xsOiB0cnVlIH0gKTsgfVxuXHRcdFx0Y2F0Y2ggKCBlcnJvciApIHsgZm9jdXNfZWxlbWVudC5mb2N1cygpOyB9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblx0LyoqXG5cdCAqIE9wZW4sIHJldmVhbCwgYW5kIGhpZ2hsaWdodCB0aGUgR2VuZXJhbCBTZXJ2aWNlIGVkaXRvciBzZWN0aW9uLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gb3Blbl9hZGRfc2VydmljZV9pbnNwZWN0b3IoKSB7XG5cdFx0b3Blbl9zZXJ2aWNlX2luc3BlY3Rvcl9ncm91cCggJyN3cGJjX3NlcnZpY2VfZ2VuZXJhbCcsICdbZGF0YS1zZXJ2aWNlLWZpZWxkPVwidGl0bGVcIl0nICk7XG5cdH1cblx0LyoqXG5cdCAqIEFwcGx5IHRoZSBvbmUtdGltZSBpbnNwZWN0b3IgZm9jdXMgcmVxdWVzdGVkIGJ5IGFuIGFkbWluaXN0cmF0aW9uIGxpbmsuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBmb2N1c19yZXF1ZXN0ZWRfc2VydmljZV9zZWN0aW9uKCkge1xuXHRcdGlmICggc3RhdGUuZm9jdXNfaGFuZGxlZCB8fCAnYm9va2luZ19mb3JtJyAhPT0gc3RhdGUucmVxdWVzdGVkX2ZvY3VzICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICggb3Blbl9zZXJ2aWNlX2luc3BlY3Rvcl9ncm91cCggJyN3cGJjX3NlcnZpY2VfZm9ybScsICdbZGF0YS1zZXJ2aWNlLWZpZWxkPVwiYm9va2luZ19mb3JtX2lkXCJdJyApICkge1xuXHRcdFx0c3RhdGUuZm9jdXNfaGFuZGxlZCA9IHRydWU7XG5cdFx0XHRpZiAoIHcuaGlzdG9yeSAmJiB3LlVSTCApIHtcblx0XHRcdFx0dmFyIHVybCA9IG5ldyB3LlVSTCggdy5sb2NhdGlvbi5ocmVmICk7XG5cdFx0XHRcdHVybC5zZWFyY2hQYXJhbXMuZGVsZXRlKCAnd3BiY19zZXJ2aWNlX2ZvY3VzJyApO1xuXHRcdFx0XHR3Lmhpc3RvcnkucmVwbGFjZVN0YXRlKCB7fSwgJycsIHVybC50b1N0cmluZygpICk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdC8qKiBFeHBhbmQgb3IgY29sbGFwc2Ugb25lIGluc3BlY3RvciBmaWVsZCBncm91cC4gKi9cblx0ZnVuY3Rpb24gdG9nZ2xlSW5zcGVjdG9yR3JvdXAoICRidXR0b24gKSB7XG5cdFx0dmFyICRncm91cCA9ICRidXR0b24uY2xvc2VzdCggJy53cGJjX3VpX19jb2xsYXBzaWJsZV9ncm91cCcgKTtcblx0XHR2YXIgJGZpZWxkcyA9ICRncm91cC5maW5kKCAnPiAuZ3JvdXBfX2ZpZWxkcycgKTtcblx0XHR2YXIgaXNPcGVuID0gJGdyb3VwLmhhc0NsYXNzKCAnaXMtb3BlbicgKTtcblx0XHQkZ3JvdXAudG9nZ2xlQ2xhc3MoICdpcy1vcGVuJywgISBpc09wZW4gKTtcblx0XHQkYnV0dG9uLmF0dHIoICdhcmlhLWV4cGFuZGVkJywgaXNPcGVuID8gJ2ZhbHNlJyA6ICd0cnVlJyApO1xuXHRcdCRmaWVsZHMucHJvcCggJ2hpZGRlbicsIGlzT3BlbiApLmF0dHIoICdhcmlhLWhpZGRlbicsIGlzT3BlbiA/ICd0cnVlJyA6ICdmYWxzZScgKTtcblx0fVxuXHQvKiogRGV0ZXJtaW5lIHdoZXRoZXIgYSBTZXJ2aWNlIGlzIGN1cnJlbnRseSBsb2FkZWQgaW50byB0aGUgZWRpdG9yLiAqL1xuXHRmdW5jdGlvbiBlZGl0b3JJc09wZW4oKSB7IHJldHVybiAhICQoICdbZGF0YS1zZXJ2aWNlLWZpZWxkPVwidGl0bGVcIl0nICkucHJvcCggJ2Rpc2FibGVkJyApOyB9XG5cdC8qKlxuXHQgKiBTeW5jaHJvbml6ZSBvbmUgbnVtZXJpYyBTZXJ2aWNlIGZpZWxkIHdpdGggaXRzIHJhbmdlIGNvbnRyb2wuXG5cdCAqXG5cdCAqIE5vbi1wcmljZSBzbGlkZXJzIGV4cGFuZCB0byByZXByZXNlbnQgYW4gZXhpc3RpbmcgdmFsdWUgYWJvdmUgdGhlaXIgbm9ybWFsXG5cdCAqIHZpc3VhbCByYW5nZS4gVGhlIHByaWNlIHNsaWRlciByZW1haW5zIHRoZSBwcm9kdWN0LWRlZmluZWQgMC0xMDAwIGNvbnRyb2w7XG5cdCAqIGl0cyBudW1iZXIgZmllbGQgY2FuIHN0aWxsIHByZXNlcnZlIGFuZCBzdWJtaXQgYSBsZWdhY3kgdmFsdWUgYWJvdmUgMTAwMC5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IGZpZWxkX2lkIFNlcnZpY2UgZmllbGQgaWRlbnRpZmllci5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHN5bmNfbnVtZXJpY19yYW5nZSggZmllbGRfaWQgKSB7XG5cdFx0dmFyICRmaWVsZCA9ICQoICdbZGF0YS1zZXJ2aWNlLWZpZWxkPVwiJyArIGZpZWxkX2lkICsgJ1wiXScgKTtcblx0XHR2YXIgJHJhbmdlID0gJCggJ1tkYXRhLXNlcnZpY2UtcmFuZ2UtZmllbGQ9XCInICsgZmllbGRfaWQgKyAnXCJdJyApO1xuXHRcdHZhciB2YWx1ZSA9IE51bWJlciggJGZpZWxkLnZhbCgpICk7XG5cdFx0dmFyIGRlZmF1bHRfbWluID0gTnVtYmVyKCAkcmFuZ2UuZGF0YSggJ3NlcnZpY2UtcmFuZ2UtZGVmYXVsdC1taW4nICkgKTtcblx0XHR2YXIgZGVmYXVsdF9tYXggPSBOdW1iZXIoICRyYW5nZS5kYXRhKCAnc2VydmljZS1yYW5nZS1kZWZhdWx0LW1heCcgKSApO1xuXHRcdHZhciBzdGVwID0gTnVtYmVyKCAkcmFuZ2UuYXR0ciggJ3N0ZXAnICkgfHwgMSApO1xuXHRcdHZhciByYW5nZV9tYXg7XG5cblx0XHRpZiAoICEgJGZpZWxkLmxlbmd0aCB8fCAhICRyYW5nZS5sZW5ndGggfHwgISBpc0Zpbml0ZSggdmFsdWUgKSApIHsgcmV0dXJuOyB9XG5cdFx0ZGVmYXVsdF9taW4gPSBpc0Zpbml0ZSggZGVmYXVsdF9taW4gKSA/IGRlZmF1bHRfbWluIDogMDtcblx0XHRkZWZhdWx0X21heCA9IGlzRmluaXRlKCBkZWZhdWx0X21heCApID8gZGVmYXVsdF9tYXggOiAxMDA7XG5cdFx0c3RlcCA9IGlzRmluaXRlKCBzdGVwICkgJiYgc3RlcCA+IDAgPyBzdGVwIDogMTtcblx0XHRyYW5nZV9tYXggPSAnYmFzZV9jb3N0JyA9PT0gZmllbGRfaWQgfHwgdmFsdWUgPD0gZGVmYXVsdF9tYXhcblx0XHRcdD8gZGVmYXVsdF9tYXhcblx0XHRcdDogZGVmYXVsdF9taW4gKyAoIE1hdGguY2VpbCggKCB2YWx1ZSAtIGRlZmF1bHRfbWluICkgLyBzdGVwICkgKiBzdGVwICk7XG5cdFx0JHJhbmdlLmF0dHIoIHsgbWluOiBkZWZhdWx0X21pbiwgbWF4OiByYW5nZV9tYXggfSApLnZhbCggdmFsdWUgKTtcblx0fVxuXHQvKipcblx0ICogU3luY2hyb25pemUgZXZlcnkgbnVtZXJpYyBTZXJ2aWNlIGZpZWxkIHdpdGggaXRzIHJhbmdlIGNvbnRyb2wuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzeW5jX2FsbF9udW1lcmljX3JhbmdlcygpIHtcblx0XHQkKCAnW2RhdGEtc2VydmljZS1yYW5nZS1maWVsZF0nICkuZWFjaCggZnVuY3Rpb24gKCkgeyBzeW5jX251bWVyaWNfcmFuZ2UoIFN0cmluZyggJCggdGhpcyApLmRhdGEoICdzZXJ2aWNlLXJhbmdlLWZpZWxkJyApIHx8ICcnICkgKTsgfSApO1xuXHR9XG5cdC8qKlxuXHQgKiBTeW5jaHJvbml6ZSB0aGUgdmlzaWJsZSBTdGF0dXMgcmFkaW9zIHdpdGggdGhlIHN0b3JlZCBTZXJ2aWNlIHN0YXR1cyBmaWVsZC5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHN5bmNfc3RhdHVzX3JhZGlvcygpIHtcblx0XHR2YXIgc3RhdHVzID0gU3RyaW5nKCAkKCAnW2RhdGEtc2VydmljZS1maWVsZD1cInN0YXR1c1wiXScgKS52YWwoKSB8fCAnYWN0aXZlJyApO1xuXHRcdCQoICdbZGF0YS1zZXJ2aWNlLXN0YXR1cy1jaG9pY2VdJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdCQoIHRoaXMgKS5wcm9wKCAnY2hlY2tlZCcsIFN0cmluZyggJCggdGhpcyApLnZhbCgpICkgPT09IHN0YXR1cyApO1xuXHRcdH0gKTtcblx0fVxuXHQvKipcblx0ICogU3luY2hyb25pemUgdGhlIFNlcnZpY2UgaW1hZ2UgcHJldmlldyB3aXRoIHRoZSByZWFkb25seSBVUkwgZmllbGQuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiB1cGRhdGVNZWRpYVByZXZpZXcoKSB7XG5cdFx0dmFyIHBpY3R1cmVVcmwgPSBTdHJpbmcoICQoICdbZGF0YS1zZXJ2aWNlLWZpZWxkPVwicGljdHVyZV91cmxcIl0nICkudmFsKCkgfHwgJycgKS50cmltKCk7XG5cdFx0dmFyICRpbWFnZSA9ICQoICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fbWVkaWFfaW1hZ2UnICk7XG5cdFx0aWYgKCBwaWN0dXJlVXJsICkgeyAkaW1hZ2UuYXR0ciggJ3NyYycsIHBpY3R1cmVVcmwgKTsgfSBlbHNlIHsgJGltYWdlLnJlbW92ZUF0dHIoICdzcmMnICk7IH1cblx0XHQkaW1hZ2UucHJvcCggJ2hpZGRlbicsICEgcGljdHVyZVVybCApO1xuXHRcdCQoICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fbWVkaWFfcGxhY2Vob2xkZXInICkucHJvcCggJ2hpZGRlbicsICEhIHBpY3R1cmVVcmwgKTtcblx0fVxuXHQvKiogU3luY2hyb25pemUgdG9vbGJhciBhbmQgaW5zcGVjdG9yIGFjdGlvbiBzdGF0ZXMgd2l0aCB0aGUgcGFnZSBzdGF0ZS4gKi9cblx0ZnVuY3Rpb24gdXBkYXRlQ29udHJvbHMoKSB7XG5cdFx0dmFyIG9wZW4gPSBzdGF0ZS5zdG9yYWdlUmVhZHkgJiYgZWRpdG9ySXNPcGVuKCk7XG5cdFx0dmFyIG9wZXJhdGlvbl9vcGVuID0gISEgc3RhdGUub3BlcmF0aW9uX21vZGUgJiYgJ2xvYWRpbmcnICE9PSBzdGF0ZS5vcGVyYXRpb25fbW9kZTtcblx0XHR2YXIgb3BlcmF0aW9uX2lzX3JldmlldyA9ICdidWxrX3JldmlldycgPT09IHN0YXRlLm9wZXJhdGlvbl9tb2RlIHx8ICdpbmxpbmVfcmV2aWV3JyA9PT0gc3RhdGUub3BlcmF0aW9uX21vZGUgfHwgJ2RlbGV0ZV9yZXZpZXcnID09PSBzdGF0ZS5vcGVyYXRpb25fbW9kZTtcblx0XHR2YXIgb3BlcmF0aW9uX2lzX2RlbGV0ZV9yZXZpZXcgPSAnZGVsZXRlX3JldmlldycgPT09IHN0YXRlLm9wZXJhdGlvbl9tb2RlO1xuXHRcdHZhciBoYXNQaWN0dXJlID0gISEgU3RyaW5nKCAkKCAnW2RhdGEtc2VydmljZS1maWVsZD1cInBpY3R1cmVfdXJsXCJdJyApLnZhbCgpIHx8ICcnICkudHJpbSgpO1xuXHRcdHZhciBzaG93X3NhdmUgPSAoIG9wZW4gfHwgb3BlcmF0aW9uX29wZW4gKSAmJiAndHJ1ZScgPT09ICQoICcjd3BiY190YWJfc2VydmljZV9zZXR0aW5ncycgKS5hdHRyKCAnYXJpYS1zZWxlY3RlZCcgKTtcblx0XHQkKCAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX2FkZCcgKS5wcm9wKCAnaGlkZGVuJywgZmFsc2UgKS5wcm9wKCAnZGlzYWJsZWQnLCAhIHN0YXRlLnN0b3JhZ2VSZWFkeSB8fCBzdGF0ZS5idXN5ICk7XG5cdFx0JCggJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19yaWdodF9zaWRlYmFyX2Zvb3RlciwgLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX3RvcF9hY3Rpb25zJyApLnByb3AoICdoaWRkZW4nLCAhIHNob3dfc2F2ZSApO1xuXHRcdCQoICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fY2FuY2VsJyApLnByb3AoICdoaWRkZW4nLCAhIHNob3dfc2F2ZSApLnByb3AoICdkaXNhYmxlZCcsICggISBvcGVuICYmICEgb3BlcmF0aW9uX29wZW4gKSB8fCBzdGF0ZS5idXN5ICk7XG5cdFx0JCggJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19zYXZlJyApLnByb3AoICdoaWRkZW4nLCAhIHNob3dfc2F2ZSB8fCBvcGVyYXRpb25fb3BlbiApLnByb3AoICdkaXNhYmxlZCcsICEgb3BlbiB8fCBzdGF0ZS5idXN5ICk7XG5cdFx0JCggJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19vcGVyYXRpb25fcmV2aWV3JyApLnByb3AoICdoaWRkZW4nLCAnYnVsa19lZGl0JyAhPT0gc3RhdGUub3BlcmF0aW9uX21vZGUgKS5wcm9wKCAnZGlzYWJsZWQnLCAnYnVsa19lZGl0JyAhPT0gc3RhdGUub3BlcmF0aW9uX21vZGUgfHwgc3RhdGUuYnVzeSB8fCAhIGNvbGxlY3RfYnVsa19jaGFuZ2VzKCkgKTtcblx0XHQkKCAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX29wZXJhdGlvbl9hcHBseScgKS5wcm9wKCAnaGlkZGVuJywgISBvcGVyYXRpb25faXNfcmV2aWV3ICk7XG5cdFx0aWYgKCAhIG9wZXJhdGlvbl9pc19kZWxldGVfcmV2aWV3ICkge1xuXHRcdFx0JCggJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19vcGVyYXRpb25fYXBwbHknICkucHJvcCggJ2Rpc2FibGVkJywgISBvcGVyYXRpb25faXNfcmV2aWV3IHx8IHN0YXRlLmJ1c3kgfHwgISBzdGF0ZS5vcGVyYXRpb25fcmV2aWV3ICk7XG5cdFx0fVxuXHRcdCQoICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fZHVwbGljYXRlLCAud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fYXJjaGl2ZScgKS5wcm9wKCAnZGlzYWJsZWQnLCAhIG9wZW4gfHwgISBzdGF0ZS5zZWxlY3RlZElkIHx8IHN0YXRlLmJ1c3kgKTtcblx0XHQkKCAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX21lZGlhX3ByZXZpZXcsIC53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19zZWxlY3RfaW1hZ2UnICkucHJvcCggJ2Rpc2FibGVkJywgISBvcGVuIHx8IHN0YXRlLmJ1c3kgKTtcblx0XHQkKCAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX3JlbW92ZV9pbWFnZScgKS5wcm9wKCAnZGlzYWJsZWQnLCAhIG9wZW4gfHwgISBoYXNQaWN0dXJlIHx8IHN0YXRlLmJ1c3kgKTtcblx0XHRzeW5jaHJvbml6ZV9pbmxpbmVfd29ya2Zsb3coKTtcblx0fVxuXG5cdC8qKiBTeW5jaHJvbml6ZSB0aGUgc2hhcmVkIGlubGluZSB3b3JrZmxvdyBmcm9tIFNlcnZpY2Utb3duZWQgc3RhdGUuICovXG5cdGZ1bmN0aW9uIHN5bmNocm9uaXplX2lubGluZV93b3JrZmxvdygpIHtcblx0XHR2YXIgY2hhbmdlZF9jb3VudCA9IGdldF9pbmxpbmVfY2hhbmdlZF9jb3VudCgpO1xuXG5cdFx0aWYgKCAhIGlubGluZVdvcmtmbG93Q29udHJvbGxlciApIHsgcmV0dXJuOyB9XG5cdFx0aW5saW5lV29ya2Zsb3dDb250cm9sbGVyLnN5bmNocm9uaXplKCB7XG5cdFx0XHRhY3RpdmU6IHN0YXRlLmlubGluZV9lZGl0aW5nLFxuXHRcdFx0YnVzeTogc3RhdGUuYnVzeSxcblx0XHRcdGNoYW5nZWRfY291bnQ6IGNoYW5nZWRfY291bnQsXG5cdFx0XHRjb3VudF90ZXh0OiBTdHJpbmcoIGNvbmZpZy5pMThuLmNoYW5nZWRfcm93cyB8fCAnJXMgY2hhbmdlZCByb3dzJyApLnJlcGxhY2UoICclcycsIGNoYW5nZWRfY291bnQgKSxcblx0XHRcdGhhc19pdGVtczogMCA8IHN0YXRlLnNlcnZpY2VzLmxlbmd0aCxcblx0XHRcdGxvY2tfY29udHJvbHM6IHN0YXRlLmlubGluZV9zY2hlbWFfbG9hZGluZyB8fCAhISBzdGF0ZS5vcGVyYXRpb25fbW9kZSxcblx0XHRcdHRvZ2dsZV9kaXNhYmxlZDogc3RhdGUuY2F0YWxvZ19sb2FkaW5nIHx8ICEgc3RhdGUuc3RvcmFnZVJlYWR5IHx8ICEhIHN0YXRlLm9wZXJhdGlvbl9tb2RlLFxuXHRcdFx0YWN0aXZlX3RvZ2dsZV90ZXh0OiBjb25maWcuaTE4bi5lZGl0aW5nX3Jvd3MsXG5cdFx0XHRpbmFjdGl2ZV90b2dnbGVfdGV4dDogY29uZmlnLmNhdGFsb2cgJiYgY29uZmlnLmNhdGFsb2cuaTE4biA/IGNvbmZpZy5jYXRhbG9nLmkxOG4uZWRpdF9yb3dzIDogJydcblx0XHR9ICk7XG5cdH1cblx0LyoqXG5cdCAqIFN0b3AgcGFnZS1jaGFuZ2luZyBjYXRhbG9nIGNvbnRyb2xzIHdoaWxlIGEgcGVuZGluZyBvcGVyYXRpb24gb3ducyByb3cgc3RhdGUuXG5cdCAqXG5cdCAqIFN1bW1hcnkgZWxlbWVudHMgZG8gbm90IGhvbm9yIHRoZSBkaXNhYmxlZCBwcm9wZXJ0eSwgc28gdGhpcyBjYXB0dXJlIGd1YXJkXG5cdCAqIGNvbXBsZW1lbnRzIHRoZSB2aXN1YWwgZGlzYWJsZWQgc3RhdGUgd2hpbGUgU2VydmljZSBpbmxpbmUgb3IgYnVsayBlZGl0aW5nIGlzIGFjdGl2ZS5cblx0ICpcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnQgQ2FwdHVyZWQgY2F0YWxvZyBldmVudC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHByb3RlY3RfaW5saW5lX2RyYWZ0c19mcm9tX2NhdGFsb2dfY29udHJvbHMoIGV2ZW50ICkge1xuXHRcdHZhciBwcm90ZWN0ZWRfY29udHJvbDtcblxuXHRcdGlmICggaW5saW5lV29ya2Zsb3dDb250cm9sbGVyICYmIGlubGluZVdvcmtmbG93Q29udHJvbGxlci5wcm90ZWN0X2V2ZW50KCBldmVudCwgc3RhdGUuaW5saW5lX2VkaXRpbmcgfHwgc3RhdGUuaW5saW5lX3NjaGVtYV9sb2FkaW5nIHx8ICEhIHN0YXRlLm9wZXJhdGlvbl9tb2RlICkgKSB7IHJldHVybjsgfVxuXHRcdGlmICggKCAhIHN0YXRlLmlubGluZV9lZGl0aW5nICYmICEgc3RhdGUuaW5saW5lX3NjaGVtYV9sb2FkaW5nICYmICEgc3RhdGUub3BlcmF0aW9uX21vZGUgKSB8fCAhIGV2ZW50LnRhcmdldCB8fCAhIGV2ZW50LnRhcmdldC5jbG9zZXN0ICkgeyByZXR1cm47IH1cblx0XHRwcm90ZWN0ZWRfY29udHJvbCA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX3N0YXR1c19maWx0ZXIsICN3cGJjX3NlcnZpY2VfcHJvdmlkZXJfZmlsdGVyLCAud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fYWRkJyApO1xuXHRcdGlmICggISBwcm90ZWN0ZWRfY29udHJvbCApIHsgcmV0dXJuOyB9XG5cdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcblx0fVxuXHQvKiogTWFyayB0aGUgcGFnZSBidXN5IGR1cmluZyBhIG11dGF0aW5nIHJlcXVlc3QgYW5kIHJlZnJlc2ggY29udHJvbHMuICovXG5cdGZ1bmN0aW9uIHNldEJ1c3koIHZhbHVlICkgeyBzdGF0ZS5idXN5ID0gdmFsdWU7ICQoICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19wYWdlJyApLnRvZ2dsZUNsYXNzKCAnaXMtYnVzeScsIHZhbHVlICk7IHVwZGF0ZUNvbnRyb2xzKCk7IH1cblx0LyoqIEVuYWJsZSBvciBkaXNhYmxlIGFsbCBmaWVsZHMgaW4gdGhlIFNlcnZpY2UgaW5zcGVjdG9yLiAqL1xuXHRmdW5jdGlvbiBzZXRGaWVsZHNFbmFibGVkKCBlbmFibGVkICkgeyAkKCAnW2RhdGEtc2VydmljZS1maWVsZF0sIFtkYXRhLXNlcnZpY2UtcmFuZ2UtZmllbGRdLCBbZGF0YS1zZXJ2aWNlLXN0YXR1cy1jaG9pY2VdJyApLnByb3AoICdkaXNhYmxlZCcsICEgZW5hYmxlZCApOyB1cGRhdGVDb250cm9scygpOyB9XG5cdC8qKiBSZXR1cm4gZGVmYXVsdHMgZm9yIGEgbmV3IHVuc2F2ZWQgU2VydmljZS4gKi9cblx0ZnVuY3Rpb24gYmxhbmtTZXJ2aWNlKCkge1xuXHRcdHJldHVybiB7IHNlcnZpY2VfaWQ6IDAsIHRpdGxlOiAnJywgZGVzY3JpcHRpb246ICcnLCBwaWN0dXJlX3VybDogJycsIHN0YXR1czogJ2FjdGl2ZScsIGR1cmF0aW9uX21pbnV0ZXM6IDMwLCBidWZmZXJfYmVmb3JlX21pbnV0ZXM6IDAsIGJ1ZmZlcl9hZnRlcl9taW51dGVzOiAwLCBiYXNlX2Nvc3Q6ICcwLjAwJywgYm9va2luZ19mb3JtX2lkOiAwLCByZXNvdXJjZV9pZHM6ICggY29uZmlnLmRlZmF1bHRfcHJvdmlkZXJfaWRzIHx8IFtdICkuc2xpY2UoKSB9O1xuXHR9XG5cdC8qKlxuXHQgKiBSZW5kZXIgdGhlIFNlcnZpY2Utb3duZWQgY3JlYXRlIG9yIGVkaXQgaW5zcGVjdG9yIGhlYWRlciB0ZW1wbGF0ZS5cblx0ICpcblx0ICogRXhpc3RpbmcgU2VydmljZSBmaWVsZHMgcmVtYWluIGluIHRoZWlyIG5hdGl2ZSBjb2xsYXBzaWJsZSBncm91cHMgc28gdGhlXG5cdCAqIHRlbXBsYXRlIGNoYW5nZXMgcHJlc2VudGF0aW9uIHdpdGhvdXQgbW92aW5nIGRvbWFpbiB2YWxpZGF0aW9uIHRvIHNoYXJlZCBjb2RlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IGlzX2VkaXQgV2hldGhlciBhbiBleGlzdGluZyBTZXJ2aWNlIGlzIGJlaW5nIGVkaXRlZC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHJlbmRlcl9pbnNwZWN0b3JfaGVhZGVyKCBpc19lZGl0ICkge1xuXHRcdHZhciB0ZW1wbGF0ZV9pZCA9IGlzX2VkaXQgPyAnd3BiYy1hcHBvaW50bWVudC1zZXJ2aWNlLWluc3BlY3Rvci1lZGl0JyA6ICd3cGJjLWFwcG9pbnRtZW50LXNlcnZpY2UtaW5zcGVjdG9yLWNyZWF0ZSc7XG5cdFx0dmFyIHRlbXBsYXRlID0gY2F0YWxvZ1RlbXBsYXRlKCB0ZW1wbGF0ZV9pZCApO1xuXHRcdHZhciAkaGVhZGVyID0gJCggJ1tkYXRhLXdwYmMtYXBwb2ludG1lbnQtc2VydmljZS1pbnNwZWN0b3ItaGVhZGVyXScgKTtcblx0XHR2YXIgY29udGV4dCA9IGlzX2VkaXRcblx0XHRcdD8gU3RyaW5nKCBjb25maWcuaTE4bi5pbnNwZWN0b3JfY29udGV4dF9pZCB8fCAnSUQ6ICVkJyApLnJlcGxhY2UoICclZCcsIFN0cmluZyggc3RhdGUuc2VsZWN0ZWRJZCApIClcblx0XHRcdDogU3RyaW5nKCBjb25maWcuaTE4bi5pbnNwZWN0b3JfY29udGV4dF9uZXcgfHwgJ05ldycgKTtcblxuXHRcdGlmICggISB0ZW1wbGF0ZSB8fCAhICRoZWFkZXIubGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdCRoZWFkZXIuaHRtbCggdGVtcGxhdGUoIHtcblx0XHRcdHRpdGxlOiBpc19lZGl0ID8gY29uZmlnLmkxOG4uZWRpdF9zZXJ2aWNlX3RpdGxlIDogY29uZmlnLmkxOG4uY3JlYXRlX3NlcnZpY2VfdGl0bGUsXG5cdFx0XHRjb250ZXh0OiBjb250ZXh0LFxuXHRcdFx0ZGVzY3JpcHRpb246IGlzX2VkaXQgPyBjb25maWcuaTE4bi5lZGl0X3NlcnZpY2VfZGVzY3JpcHRpb24gOiBjb25maWcuaTE4bi5jcmVhdGVfc2VydmljZV9kZXNjcmlwdGlvblxuXHRcdH0gKSApO1xuXHR9XG5cdC8qKiBQb3B1bGF0ZSB0aGUgaW5zcGVjdG9yIGZyb20gYSBub3JtYWxpemVkIFNlcnZpY2UgcmVzcG9uc2UuICovXG5cdGZ1bmN0aW9uIGZpbGxFZGl0b3IoIHNlcnZpY2UgKSB7XG5cdFx0c2VydmljZSA9ICQuZXh0ZW5kKCBibGFua1NlcnZpY2UoKSwgc2VydmljZSB8fCB7fSApO1xuXHRcdHN0YXRlLnNlbGVjdGVkSWQgPSBOdW1iZXIoIHNlcnZpY2Uuc2VydmljZV9pZCB8fCAwICk7XG5cdFx0cmVuZGVyX2luc3BlY3Rvcl9oZWFkZXIoIDAgPCBzdGF0ZS5zZWxlY3RlZElkICk7XG5cdFx0JC5lYWNoKCBzZXJ2aWNlLCBmdW5jdGlvbiAoIGtleSwgdmFsdWUgKSB7ICQoICdbZGF0YS1zZXJ2aWNlLWZpZWxkPVwiJyArIGtleSArICdcIl0nICkudmFsKCB2YWx1ZSApOyB9ICk7XG5cdFx0c3luY19zdGF0dXNfcmFkaW9zKCk7XG5cdFx0c3luY19hbGxfbnVtZXJpY19yYW5nZXMoKTtcblx0XHR1cGRhdGVNZWRpYVByZXZpZXcoKTtcblx0XHRzZXRGaWVsZHNFbmFibGVkKCBzdGF0ZS5zdG9yYWdlUmVhZHkgKTtcblx0XHQkKCAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX2l0ZW0nICkucmVtb3ZlQ2xhc3MoICdpcy1pbnNwZWN0b3Itc2VsZWN0ZWQnICkuYXR0ciggJ2FyaWEtY3VycmVudCcsICdmYWxzZScgKTtcblx0XHQkKCAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX2l0ZW1bZGF0YS1zZXJ2aWNlLWlkPVwiJyArIHN0YXRlLnNlbGVjdGVkSWQgKyAnXCJdJyApLmFkZENsYXNzKCAnaXMtaW5zcGVjdG9yLXNlbGVjdGVkJyApLmF0dHIoICdhcmlhLWN1cnJlbnQnLCAndHJ1ZScgKTtcblx0XHRjYXB0dXJlX2VkaXRvcl9zbmFwc2hvdCgpO1xuXHR9XG5cdC8qKiBDb2xsZWN0IHRoZSBjdXJyZW50IFNlcnZpY2UgaW5zcGVjdG9yIHZhbHVlcyBmb3Igc2F2aW5nLiAqL1xuXHRmdW5jdGlvbiBjb2xsZWN0RWRpdG9yKCkge1xuXHRcdHZhciBzZXJ2aWNlID0geyBzZXJ2aWNlX2lkOiBzdGF0ZS5zZWxlY3RlZElkIH07XG5cdFx0JCggJ1tkYXRhLXNlcnZpY2UtZmllbGRdJyApLmVhY2goIGZ1bmN0aW9uICgpIHsgc2VydmljZVsgJCggdGhpcyApLmRhdGEoICdzZXJ2aWNlLWZpZWxkJyApIF0gPSAkKCB0aGlzICkudmFsKCk7IH0gKTtcblx0XHRyZXR1cm4gc2VydmljZTtcblx0fVxuXHQvKipcblx0ICogU3RvcmUgdGhlIGN1cnJlbnQgZWRpdG9yIHZhbHVlcyBhcyB0aGUgbGFzdCBsb2FkZWQgb3Igc2F2ZWQgc3RhdGUuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBjYXB0dXJlX2VkaXRvcl9zbmFwc2hvdCgpIHtcblx0XHRzdGF0ZS5lZGl0b3Jfc25hcHNob3QgPSBKU09OLnN0cmluZ2lmeSggY29sbGVjdEVkaXRvcigpICk7XG5cdH1cblx0LyoqXG5cdCAqIERldGVybWluZSB3aGV0aGVyIHRoZSBvcGVuIFNlcnZpY2UgZWRpdG9yIGNvbnRhaW5zIHVuc2F2ZWQgY2hhbmdlcy5cblx0ICpcblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGN1cnJlbnQgZmllbGRzIGRpZmZlciBmcm9tIHRoZSBjYXB0dXJlZCBzdGF0ZS5cblx0ICovXG5cdGZ1bmN0aW9uIGlzX2VkaXRvcl9kaXJ0eSgpIHtcblx0XHRyZXR1cm4gZWRpdG9ySXNPcGVuKCkgJiYgc3RhdGUuZWRpdG9yX3NuYXBzaG90ICE9PSBKU09OLnN0cmluZ2lmeSggY29sbGVjdEVkaXRvcigpICk7XG5cdH1cblx0LyoqXG5cdCAqIENvbmZpcm0gYmVmb3JlIHJlcGxhY2luZyBhbiBlZGl0b3IgdGhhdCBjb250YWlucyB1bnNhdmVkIFNlcnZpY2UgY2hhbmdlcy5cblx0ICpcblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHJlcGxhY2luZyB0aGUgY3VycmVudCBlZGl0b3IgbWF5IGNvbnRpbnVlLlxuXHQgKi9cblx0ZnVuY3Rpb24gY2FuX3JlcGxhY2VfZWRpdG9yKCkge1xuXHRcdHJldHVybiAhIGlzX2VkaXRvcl9kaXJ0eSgpIHx8IHcuY29uZmlybSggY29uZmlnLmkxOG4uY29uZmlybV9kaXNjYXJkIHx8ICdEaXNjYXJkIHVuc2F2ZWQgU2VydmljZSBjaGFuZ2VzPycgKTtcblx0fVxuXHQvKipcblx0ICogRGV0ZXJtaW5lIHdoZXRoZXIgdGhlIGN1cnJlbnQgU2VydmljZSBvcGVyYXRpb24gY29udGFpbnMgdW5hcHBsaWVkIHZhbHVlcy5cblx0ICpcblx0ICogSW5saW5lIGRyYWZ0cyBhbmQgc2lnbmVkIHJldmlldyBzY3JlZW5zIHJlbWFpbiBkaXJ0eSB1bnRpbCB0aGV5IGFyZVxuXHQgKiBleHBsaWNpdGx5IGFwcGxpZWQgb3IgZGlzY2FyZGVkLiBUaGlzIHByZXZlbnRzIGFuIG91dHNpZGUgY2xpY2sgZnJvbVxuXHQgKiBzaWxlbnRseSByZXBsYWNpbmcgYSByZXZpZXdlZCBtdXRhdGlvbi5cblx0ICpcblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGNsb3Npbmcgd291bGQgZGlzY2FyZCBwZW5kaW5nIGNoYW5nZXMuXG5cdCAqL1xuXHRmdW5jdGlvbiBpc19vcGVyYXRpb25fZGlydHkoKSB7XG5cdFx0aWYgKCAnYnVsa19lZGl0JyA9PT0gc3RhdGUub3BlcmF0aW9uX21vZGUgKSB7XG5cdFx0XHRyZXR1cm4gISEgY29sbGVjdF9idWxrX2NoYW5nZXMoKTtcblx0XHR9XG5cblx0XHRpZiAoICdpbmxpbmVfcmV2aWV3JyA9PT0gc3RhdGUub3BlcmF0aW9uX21vZGUgfHwgJ2J1bGtfcmV2aWV3JyA9PT0gc3RhdGUub3BlcmF0aW9uX21vZGUgfHwgJ2RlbGV0ZV9yZXZpZXcnID09PSBzdGF0ZS5vcGVyYXRpb25fbW9kZSApIHtcblx0XHRcdHJldHVybiAhISBzdGF0ZS5vcGVyYXRpb25fcmV2aWV3O1xuXHRcdH1cblxuXHRcdHJldHVybiBzdGF0ZS5pbmxpbmVfZWRpdGluZyAmJiAwIDwgZ2V0X2lubGluZV9jaGFuZ2VkX2NvdW50KCk7XG5cdH1cblx0LyoqXG5cdCAqIENsZWFyIHRoZSBTZXJ2aWNlIGVkaXRvciBhZnRlciBpdHMgbmF0aXZlIHNpZGViYXIgaGFzIGJlZW4gY2xvc2VkLlxuXHQgKlxuXHQgKiBJbnZhbGlkYXRpbmcgdGhlIHJlcXVlc3Qgc2VxdWVuY2UgcHJldmVudHMgYSBsYXRlIGxvYWQgcmVzcG9uc2UgZnJvbVxuXHQgKiByZW9wZW5pbmcgYW4gaW5zcGVjdG9yIHRoYXQgdGhlIHVzZXIgYWxyZWFkeSBkaXNtaXNzZWQuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiByZXNldF9zZXJ2aWNlX2VkaXRvcigpIHtcblx0XHR2YXIgc2VydmljZSA9IGJsYW5rU2VydmljZSgpO1xuXG5cdFx0c3RhdGUuZWRpdG9yX3JlcXVlc3Rfc2VxdWVuY2UgKz0gMTtcblx0XHRzdGF0ZS5zZWxlY3RlZElkID0gMDtcblx0XHRzdGF0ZS5yZXF1ZXN0ZWRfZm9jdXMgPSAnJztcblx0XHRzdGF0ZS5mb2N1c19oYW5kbGVkID0gdHJ1ZTtcblx0XHRyZW5kZXJfaW5zcGVjdG9yX2hlYWRlciggZmFsc2UgKTtcblx0XHQkLmVhY2goIHNlcnZpY2UsIGZ1bmN0aW9uICgga2V5LCB2YWx1ZSApIHsgJCggJ1tkYXRhLXNlcnZpY2UtZmllbGQ9XCInICsga2V5ICsgJ1wiXScgKS52YWwoIHZhbHVlICk7IH0gKTtcblx0XHRzeW5jX3N0YXR1c19yYWRpb3MoKTtcblx0XHRzeW5jX2FsbF9udW1lcmljX3JhbmdlcygpO1xuXHRcdHVwZGF0ZU1lZGlhUHJldmlldygpO1xuXHRcdHNldEZpZWxkc0VuYWJsZWQoIGZhbHNlICk7XG5cdFx0JCggJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19pdGVtJyApLnJlbW92ZUNsYXNzKCAnaXMtaW5zcGVjdG9yLXNlbGVjdGVkJyApLmF0dHIoICdhcmlhLWN1cnJlbnQnLCAnZmFsc2UnICk7XG5cdFx0Y2FwdHVyZV9lZGl0b3Jfc25hcHNob3QoKTtcblx0XHR1cGRhdGVVcmwoIDAgKTtcblx0fVxuXHQvKipcblx0ICogQ2xlYXIgYSBTZXJ2aWNlIGlubGluZSBvciBidWxrIG9wZXJhdGlvbiB3aXRob3V0IGNoYW5naW5nIHNlbGVjdGlvbi5cblx0ICpcblx0ICogQHBhcmFtIHtib29sZWFufSByZXN0b3JlX2lubGluZSBXaGV0aGVyIGlubGluZSByb3dzIHNob3VsZCByZXR1cm4gdG8gcHJlc2VudGF0aW9uIG1vZGUuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiByZXNldF9vcGVyYXRpb24oIHJlc3RvcmVfaW5saW5lICkge1xuXHRcdHN0YXRlLm9wZXJhdGlvbl9yZXF1ZXN0X3NlcXVlbmNlICs9IDE7XG5cdFx0c3RhdGUub3BlcmF0aW9uX21vZGUgPSAnJztcblx0XHRzdGF0ZS5vcGVyYXRpb25fcmV2aWV3ID0gbnVsbDtcblx0XHQkKCAnW2RhdGEtd3BiYy1hcHBvaW50bWVudC1zZXJ2aWNlcy1vcGVyYXRpb24taG9zdF0nICkuZW1wdHkoKS5wcm9wKCAnaGlkZGVuJywgdHJ1ZSApO1xuXHRcdCQoICdbZGF0YS13cGJjLWFwcG9pbnRtZW50LXNlcnZpY2VzLW5hdGl2ZS1pbnNwZWN0b3JdJyApLnByb3AoICdoaWRkZW4nLCBmYWxzZSApO1xuXHRcdCQoICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fb3BlcmF0aW9uX2FwcGx5JyApXG5cdFx0XHQucmVtb3ZlQ2xhc3MoICd3cGJjX3VpX2NhdGFsb2dfZGVsZXRlX3Jldmlld19fYXBwbHkgYnV0dG9uLXNlY29uZGFyeSBpcy1idXN5JyApXG5cdFx0XHQuYWRkQ2xhc3MoICdidXR0b24tcHJpbWFyeScgKVxuXHRcdFx0LnJlbW92ZUF0dHIoICdhcmlhLWJ1c3kgZm9ybScgKVxuXHRcdFx0LnRleHQoIGNvbmZpZy5pMThuLmFwcGx5X2NoYW5nZXMgfHwgJ0FwcGx5IGNoYW5nZXMnICk7XG5cdFx0aWYgKCByZXN0b3JlX2lubGluZSApIHtcblx0XHRcdHN0YXRlLmlubGluZV9lZGl0aW5nID0gZmFsc2U7XG5cdFx0XHRzdGF0ZS5pbmxpbmVfZHJhZnRzID0ge307XG5cdFx0XHRzdGF0ZS5pbmxpbmVfc2NoZW1hID0ge307XG5cdFx0XHRzdGF0ZS5pbmxpbmVfc2NoZW1hX2xvYWRpbmcgPSBmYWxzZTtcblx0XHRcdHN0YXRlLmlubGluZV9yZXF1ZXN0X3NlcXVlbmNlICs9IDE7XG5cdFx0XHQkKCAnW2RhdGEtd3BiYy1hcHBvaW50bWVudC1zZXJ2aWNlcy1pbmxpbmUtYmFyLWhvc3RdJyApLmVtcHR5KCk7XG5cdFx0XHRpZiAoIHN0YXRlLmxhc3RfcmVzcG9uc2UgKSB7XG5cdFx0XHRcdHJlbmRlckNhdGFsb2dSZXNwb25zZSggc3RhdGUubGFzdF9yZXNwb25zZSApO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRzZXRCdXN5KCBmYWxzZSApO1xuXHR9XG5cdC8qKlxuXHQgKiBDbG9zZSB0aGUgU2VydmljZSBpbnNwZWN0b3IgdXNpbmcgdGhlIEJvb2tpbmcgUmVzb3VyY2VzIGxpZmVjeWNsZS5cblx0ICpcblx0ICogQHBhcmFtIHtib29sZWFufSBjb25maXJtX2Rpc2NhcmQgV2hldGhlciB0byBjb25maXJtIHVuc2F2ZWQgY2hhbmdlcy5cblx0ICogQHBhcmFtIHtib29sZWFufSBoaWRlX3NpZGViYXIgICAgV2hldGhlciB0aGlzIGZ1bmN0aW9uIG11c3QgaGlkZSB0aGUgbmF0aXZlIHNpZGViYXIuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgaW5zcGVjdG9yIHdhcyBjbG9zZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiBjbG9zZV9zZXJ2aWNlX2luc3BlY3RvciggY29uZmlybV9kaXNjYXJkLCBoaWRlX3NpZGViYXIgKSB7XG5cdFx0dmFyIGZvY3VzX3RhcmdldCA9IHN0YXRlLmluc3BlY3Rvcl9mb2N1c190YXJnZXQ7XG5cblx0XHRpZiAoIHN0YXRlLm11dGF0aW9uX2luX3Byb2dyZXNzICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICggc3RhdGUub3BlcmF0aW9uX21vZGUgKSB7XG5cdFx0XHRpZiAoIGNvbmZpcm1fZGlzY2FyZCAmJiBpc19vcGVyYXRpb25fZGlydHkoKSAmJiAhIHcuY29uZmlybSggY29uZmlnLmkxOG4uY29uZmlybV9kaXNjYXJkIHx8ICdEaXNjYXJkIHVuc2F2ZWQgU2VydmljZSBjaGFuZ2VzPycgKSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0cmVzZXRfb3BlcmF0aW9uKCB0cnVlICk7XG5cdFx0XHRzdGF0ZS5pbnNwZWN0b3JfZm9jdXNfdGFyZ2V0ID0gbnVsbDtcblx0XHRcdGlmICggaGlkZV9zaWRlYmFyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3LndwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX2RvX2hpZGUgKSB7XG5cdFx0XHRcdHcud3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fZG9faGlkZSgpO1xuXHRcdFx0fVxuXHRcdFx0bm90aWZ5X3NldHVwX3dpemFyZF9sYXlvdXRfY2hhbmdlZCgpO1xuXHRcdFx0aWYgKCBoaWRlX3NpZGViYXIgJiYgZm9jdXNfdGFyZ2V0ICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jb250YWlucyggZm9jdXNfdGFyZ2V0ICkgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGZvY3VzX3RhcmdldC5mb2N1cyApIHtcblx0XHRcdFx0Zm9jdXNfdGFyZ2V0LmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAoIGNvbmZpcm1fZGlzY2FyZCAmJiAhIGNhbl9yZXBsYWNlX2VkaXRvcigpICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJlc2V0X3NlcnZpY2VfZWRpdG9yKCk7XG5cdFx0c3RhdGUuaW5zcGVjdG9yX2ZvY3VzX3RhcmdldCA9IG51bGw7XG5cdFx0aWYgKCBoaWRlX3NpZGViYXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHcud3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fZG9faGlkZSApIHtcblx0XHRcdHcud3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fZG9faGlkZSgpO1xuXHRcdH1cblx0XHRub3RpZnlfc2V0dXBfd2l6YXJkX2xheW91dF9jaGFuZ2VkKCk7XG5cdFx0aWYgKCBoaWRlX3NpZGViYXIgJiYgZm9jdXNfdGFyZ2V0ICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jb250YWlucyggZm9jdXNfdGFyZ2V0ICkgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGZvY3VzX3RhcmdldC5mb2N1cyApIHtcblx0XHRcdGZvY3VzX3RhcmdldC5mb2N1cygpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdC8qKiBSZWZsZWN0IHRoZSBzZWxlY3RlZCBTZXJ2aWNlIGluIHRoZSBhZG1pbiBVUkwgd2l0aG91dCByZWxvYWRpbmcuICovXG5cdGZ1bmN0aW9uIHVwZGF0ZVVybCggc2VydmljZUlkICkge1xuXHRcdGlmICggISB3Lmhpc3RvcnkgfHwgISB3LlVSTCApIHsgcmV0dXJuOyB9XG5cdFx0dmFyIHVybCA9IG5ldyB3LlVSTCggdy5sb2NhdGlvbi5ocmVmICk7XG5cdFx0aWYgKCBzZXJ2aWNlSWQgKSB7IHVybC5zZWFyY2hQYXJhbXMuc2V0KCAnc2VydmljZV9pZCcsIHNlcnZpY2VJZCApOyB9IGVsc2UgeyB1cmwuc2VhcmNoUGFyYW1zLmRlbGV0ZSggJ3NlcnZpY2VfaWQnICk7IH1cblx0XHR3Lmhpc3RvcnkucmVwbGFjZVN0YXRlKCB7fSwgJycsIHVybC50b1N0cmluZygpICk7XG5cdH1cblx0LyoqIEluZGV4IFByb3ZpZGVyIHByZXNlbnRhdGlvbiByZWNvcmRzIGJ5IGJvb2tpbmcgcmVzb3VyY2UgSUQuICovXG5cdGZ1bmN0aW9uIGluZGV4UHJvdmlkZXJzKCBwcm92aWRlcnMgKSB7XG5cdFx0c3RhdGUucHJvdmlkZXJzID0ge307XG5cdFx0JC5lYWNoKCBwcm92aWRlcnMgfHwgW10sIGZ1bmN0aW9uICggaW5kZXgsIHByb3ZpZGVyICkgeyBzdGF0ZS5wcm92aWRlcnNbIFN0cmluZyggcHJvdmlkZXIuaWQgKSBdID0gcHJvdmlkZXI7IH0gKTtcblx0fVxuXHQvKiogVXBkYXRlIHN0YXR1cyBhbmQgUHJvdmlkZXIgY291bnRlcnMgYWJvdmUgdGhlIFNlcnZpY2UgdGFibGUuICovXG5cdGZ1bmN0aW9uIHVwZGF0ZVN1bW1hcnkoIGNvdW50cywgcHJvdmlkZXJDb3VudCApIHtcblx0XHRjb3VudHMgPSAkLmV4dGVuZCggeyBhbGw6IDAsIGFjdGl2ZTogMCwgaW5hY3RpdmU6IDAsIGFyY2hpdmVkOiAwIH0sIGNvdW50cyB8fCB7fSApO1xuXHRcdHN0YXRlLnByb3ZpZGVyQ291bnQgPSBOdW1iZXIoIHByb3ZpZGVyQ291bnQgfHwgMCApO1xuXHRcdCQuZWFjaCggY291bnRzLCBmdW5jdGlvbiAoIHN0YXR1cywgY291bnQgKSB7ICQoICdbZGF0YS1zZXJ2aWNlLWNvdW50PVwiJyArIHN0YXR1cyArICdcIl0nICkudGV4dCggTnVtYmVyKCBjb3VudCB8fCAwICkgKTsgfSApO1xuXHRcdCQoICdbZGF0YS1wcm92aWRlci1jb3VudF0nICkudGV4dCggc3RhdGUucHJvdmlkZXJDb3VudCApO1xuXHRcdCQoICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fcHJvdmlkZXJfbm90aWNlJyApLnByb3AoICdoaWRkZW4nLCAwICE9PSBzdGF0ZS5wcm92aWRlckNvdW50ICk7XG5cdH1cblx0LyoqIEZvcm1hdCBhIG5vcm1hbGl6ZWQgU2VydmljZSBjb3N0IHVzaW5nIHRoZSBjb25maWd1cmVkIGN1cnJlbmN5IHN5bWJvbC4gKi9cblx0ZnVuY3Rpb24gZm9ybWF0Q29zdCggY29zdCApIHtcblx0XHR2YXIgYW1vdW50ID0gTnVtYmVyKCBjb3N0IHx8IDAgKTtcblx0XHR2YXIgc3ltYm9sID0gY29uZmlnLmN1cnJlbmN5X3N5bWJvbCB8fCAnJCc7XG5cdFx0cmV0dXJuIHN5bWJvbCArIGFtb3VudC50b0ZpeGVkKCAyICk7XG5cdH1cblx0LyoqIEJ1aWxkIGNvbXBhY3QgUHJvdmlkZXIgYXZhdGFyIG5vZGVzIGZvciBvbmUgU2VydmljZSByb3cuICovXG5cdGZ1bmN0aW9uIHByb3ZpZGVyTm9kZXMoIHNlcnZpY2UgKSB7XG5cdFx0dmFyIGlkcyA9ICQubWFwKCBzZXJ2aWNlLnJlc291cmNlX2lkcyB8fCBbXSwgZnVuY3Rpb24gKCB2YWx1ZSApIHsgcmV0dXJuIE51bWJlciggdmFsdWUgfHwgMCApOyB9ICk7XG5cdFx0dmFyICRzdGFjayA9ICQoICc8ZGl2PicsIHsgJ2NsYXNzJzogJ3dwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX3Byb3ZpZGVyX3N0YWNrJyB9ICk7XG5cdFx0aWYgKCAhIGlkcy5sZW5ndGggKSB7IHJldHVybiAkKCAnPHNwYW4+JywgeyAnY2xhc3MnOiAnd3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fbm9fcHJvdmlkZXInLCB0ZXh0OiBjb25maWcuaTE4bi5ub19wcm92aWRlciB8fCAnTm8gUHJvdmlkZXJzIGFzc2lnbmVkJyB9ICk7IH1cblx0XHQkLmVhY2goIGlkcy5zbGljZSggMCwgMyApLCBmdW5jdGlvbiAoIGluZGV4LCBpZCApIHtcblx0XHRcdHZhciBwcm92aWRlciA9IHN0YXRlLnByb3ZpZGVyc1sgU3RyaW5nKCBpZCApIF0gfHwgeyBpZDogaWQsIHRpdGxlOiAnUHJvdmlkZXIgIycgKyBpZCwgaW5pdGlhbHM6ICdQJywgYXZhdGFyX3VybDogJycgfTtcblx0XHRcdHZhciBoYXNfYXZhaWxhYmlsaXR5ID0gZmFsc2UgIT09IHByb3ZpZGVyLmhhc193ZWVrbHlfYXZhaWxhYmlsaXR5O1xuXHRcdFx0dmFyIHByb3ZpZGVyX3RpdGxlID0gcHJvdmlkZXIudGl0bGUgfHwgJ1Byb3ZpZGVyICMnICsgaWQ7XG5cdFx0XHR2YXIgYXZhdGFyX3RpdGxlID0gcHJvdmlkZXJfdGl0bGU7XG5cdFx0XHR2YXIgYXZhdGFyX2F0dHJpYnV0ZXM7XG5cdFx0XHR2YXIgJGF2YXRhcjtcblxuXHRcdFx0aWYgKCAhIGhhc19hdmFpbGFiaWxpdHkgKSB7IGF2YXRhcl90aXRsZSArPSAnIOKAlCAnICsgKCBjb25maWcuaTE4bi5ub19hdmFpbGFiaWxpdHkgfHwgJ05vIHdlZWtseSBhdmFpbGFiaWxpdHknICk7IH1cblx0XHRcdGF2YXRhcl9hdHRyaWJ1dGVzID0ge1xuXHRcdFx0XHQnY2xhc3MnOiAnd3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fcHJvdmlkZXJfYXZhdGFyJyArICggaGFzX2F2YWlsYWJpbGl0eSA/ICcnIDogJyBoYXMtbm8tYXZhaWxhYmlsaXR5JyApLFxuXHRcdFx0XHR0aXRsZTogYXZhdGFyX3RpdGxlXG5cdFx0XHR9O1xuXHRcdFx0aWYgKCBwcm92aWRlci5hdmFpbGFiaWxpdHlfdXJsICkge1xuXHRcdFx0XHRhdmF0YXJfdGl0bGUgPSBTdHJpbmcoIGNvbmZpZy5pMThuLmVkaXRfYXZhaWxhYmlsaXR5IHx8ICdFZGl0IGF2YWlsYWJpbGl0eSBmb3IgJXMnICkucmVwbGFjZSggJyVzJywgcHJvdmlkZXJfdGl0bGUgKTtcblx0XHRcdFx0YXZhdGFyX2F0dHJpYnV0ZXMuaHJlZiA9IHByb3ZpZGVyLmF2YWlsYWJpbGl0eV91cmw7XG5cdFx0XHRcdGF2YXRhcl9hdHRyaWJ1dGVzLnRpdGxlID0gYXZhdGFyX3RpdGxlO1xuXHRcdFx0XHRhdmF0YXJfYXR0cmlidXRlc1sgJ2FyaWEtbGFiZWwnIF0gPSBhdmF0YXJfdGl0bGU7XG5cdFx0XHRcdCRhdmF0YXIgPSAkKCAnPGE+JywgYXZhdGFyX2F0dHJpYnV0ZXMgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdCRhdmF0YXIgPSAkKCAnPHNwYW4+JywgYXZhdGFyX2F0dHJpYnV0ZXMgKTtcblx0XHRcdH1cblx0XHRcdGlmICggcHJvdmlkZXIuYXZhdGFyX3VybCApIHsgJCggJzxpbWc+JywgeyBzcmM6IHByb3ZpZGVyLmF2YXRhcl91cmwsIGFsdDogJycsIGxvYWRpbmc6ICdsYXp5JyB9ICkuYXBwZW5kVG8oICRhdmF0YXIgKTsgfVxuXHRcdFx0ZWxzZSB7ICRhdmF0YXIudGV4dCggcHJvdmlkZXIuaW5pdGlhbHMgfHwgJ1AnICk7IH1cblx0XHRcdCRzdGFjay5hcHBlbmQoICRhdmF0YXIgKTtcblx0XHR9ICk7XG5cdFx0aWYgKCBpZHMubGVuZ3RoID4gMyApIHsgJCggJzxzcGFuPicsIHsgJ2NsYXNzJzogJ3dwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX3Byb3ZpZGVyX21vcmUnLCB0ZXh0OiAnKycgKyAoIGlkcy5sZW5ndGggLSAzICksIHRpdGxlOiAoIGlkcy5sZW5ndGggLSAzICkgKyAnICcgKyAoIGNvbmZpZy5pMThuLm1vcmVfcHJvdmlkZXJzIHx8ICdtb3JlIFByb3ZpZGVycycgKSB9ICkuYXBwZW5kVG8oICRzdGFjayApOyB9XG5cdFx0cmV0dXJuICRzdGFjaztcblx0fVxuXHQvKipcblx0ICogQnVpbGQgdGhlIFNlcnZpY2UgdGh1bWJuYWlsIHVzZWQgaW4gdGhlIG1hbmFnZW1lbnQgdGFibGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBzZXJ2aWNlIE5vcm1hbGl6ZWQgU2VydmljZSByZXNwb25zZS5cblx0ICogQHJldHVybiB7alF1ZXJ5fSBUaHVtYm5haWwgd3JhcHBlciBjb250YWluaW5nIGFuIGltYWdlIG9yIHBsYWNlaG9sZGVyIGljb24uXG5cdCAqL1xuXHRmdW5jdGlvbiBzZXJ2aWNlVGh1bWJuYWlsTm9kZSggc2VydmljZSApIHtcblx0XHR2YXIgcGljdHVyZVVybCA9IFN0cmluZyggc2VydmljZS5waWN0dXJlX3VybCB8fCAnJyApLnRyaW0oKTtcblx0XHR2YXIgc2VydmljZV90aXRsZSA9IFN0cmluZyggc2VydmljZS50aXRsZSB8fCBjb25maWcuaTE4bi51bnRpdGxlZCB8fCAnVW50aXRsZWQgU2VydmljZScgKTtcblx0XHR2YXIgc2VydmljZV9kZXNjcmlwdGlvbiA9IFN0cmluZyggc2VydmljZS5kZXNjcmlwdGlvbiB8fCAnJyApLnRyaW0oKSB8fCBjb25maWcuaTE4bi5ub19kZXNjcmlwdGlvbiB8fCAnTm8gZGVzY3JpcHRpb24nO1xuXHRcdHZhciB0b29sdGlwX2Zvcm1hdCA9IFN0cmluZyggY29uZmlnLmkxOG4uc2VydmljZV90aHVtYm5haWxfdG9vbHRpcCB8fCAnVGl0bGU6ICUxJHNcXG5EZXNjcmlwdGlvbjogJTIkcycgKTtcblx0XHR2YXIgdG9vbHRpcF90ZXh0ID0gdG9vbHRpcF9mb3JtYXQucmVwbGFjZSggJyUxJHMnLCBzZXJ2aWNlX3RpdGxlICkucmVwbGFjZSggJyUyJHMnLCBzZXJ2aWNlX2Rlc2NyaXB0aW9uICk7XG5cdFx0dmFyICR0aHVtYm5haWwgPSAkKCAnPHNwYW4+Jywge1xuXHRcdFx0J2NsYXNzJzogJ3dwYmNfdWlfbGlzdGluZ19fdGFibGVfaWNvbiB3cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19zZXJ2aWNlX3RodW1ibmFpbCB0b29sdGlwX3RvcCcsXG5cdFx0XHQnZGF0YS1vcmlnaW5hbC10aXRsZSc6IHRvb2x0aXBfdGV4dCxcblx0XHRcdCdhcmlhLWxhYmVsJzogdG9vbHRpcF90ZXh0LFxuXHRcdFx0cm9sZTogJ2ltZycsXG5cdFx0XHR0YWJpbmRleDogJzAnXG5cdFx0fSApO1xuXHRcdGlmICggcGljdHVyZVVybCApIHtcblx0XHRcdCQoICc8aW1nPicsIHsgc3JjOiBwaWN0dXJlVXJsLCBhbHQ6ICcnLCBsb2FkaW5nOiAnbGF6eScsIGRlY29kaW5nOiAnYXN5bmMnIH0gKS5hcHBlbmRUbyggJHRodW1ibmFpbCApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQkKCAnPGk+JywgeyAnY2xhc3MnOiAnbWVudV9pY29uIGljb24tMXggd3BiYy1iaS1pbWFnZS1maWxsJywgJ2FyaWEtaGlkZGVuJzogJ3RydWUnIH0gKS5hcHBlbmRUbyggJHRodW1ibmFpbCApO1xuXHRcdH1cblx0XHRyZXR1cm4gJHRodW1ibmFpbDtcblx0fVxuXHQvKipcblx0ICogRGVzdHJveSBTZXJ2aWNlIHRodW1ibmFpbCB0b29sdGlwcyBiZWZvcmUgQUpBWCByZXBsYWNlcyB0aGVpciBlbGVtZW50cy5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGRlc3Ryb3lfc2VydmljZV90aHVtYm5haWxfdG9vbHRpcHMoKSB7XG5cdFx0JCggJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19zZXJ2aWNlX3RodW1ibmFpbCcgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRpZiAoIHRoaXMuX3RpcHB5ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB0aGlzLl90aXBweS5kZXN0cm95ICkge1xuXHRcdFx0XHR0aGlzLl90aXBweS5kZXN0cm95KCk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHR9XG5cdC8qKlxuXHQgKiBJbml0aWFsaXplIFNlcnZpY2UgdGh1bWJuYWlsIHRvb2x0aXBzIGFmdGVyIGFuIEFKQVggbGlzdGluZyByZW5kZXIuXG5cdCAqXG5cdCAqIFRoZSBuYXRpdmUgdGl0bGUgYXR0cmlidXRlIGlzIHVzZWQgb25seSB3aGVuIHRoZSBCb29raW5nIENhbGVuZGFyIFRpcHB5XG5cdCAqIGhlbHBlciBpcyB1bmF2YWlsYWJsZSwgYXZvaWRpbmcgZHVwbGljYXRlIGJyb3dzZXIgYW5kIFRpcHB5IHRvb2x0aXBzLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gcmVmcmVzaF9zZXJ2aWNlX3RodW1ibmFpbF90b29sdGlwcygpIHtcblx0XHR2YXIgbGlzdGluZ19zZWxlY3RvciA9ICcjd3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19jYXRhbG9nICc7XG5cdFx0dmFyICR0aHVtYm5haWxzID0gJCggbGlzdGluZ19zZWxlY3RvciArICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fc2VydmljZV90aHVtYm5haWwnICk7XG5cdFx0dmFyIHRvb2x0aXBzX2luaXRpYWxpemVkID0gZmFsc2U7XG5cblx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3LndwYmNfZGVmaW5lX3RpcHB5X3Rvb2x0aXBzICkge1xuXHRcdFx0dG9vbHRpcHNfaW5pdGlhbGl6ZWQgPSB3LndwYmNfZGVmaW5lX3RpcHB5X3Rvb2x0aXBzKCBsaXN0aW5nX3NlbGVjdG9yICk7XG5cdFx0fVxuXHRcdGlmICggdG9vbHRpcHNfaW5pdGlhbGl6ZWQgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdCR0aHVtYm5haWxzLmVhY2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdCQoIHRoaXMgKS5hdHRyKCAndGl0bGUnLCAkKCB0aGlzICkuYXR0ciggJ2RhdGEtb3JpZ2luYWwtdGl0bGUnICkgfHwgJycgKTtcblx0XHR9ICk7XG5cdH1cblx0LyoqXG5cdCAqIEJ1aWxkIHRoZSBjb21wYWN0IGR1cmF0aW9uIGFuZCBiZWZvcmUvYWZ0ZXIgYnVmZmVyIHN1bW1hcnkgZm9yIG9uZSBTZXJ2aWNlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gc2VydmljZSBOb3JtYWxpemVkIFNlcnZpY2UgcmVzcG9uc2UuXG5cdCAqIEByZXR1cm4ge2pRdWVyeX0gRHVyYXRpb24gZGV0YWlscyB3cmFwcGVyIGZvciB0aGUgbGlzdGluZyBjb2x1bW4uXG5cdCAqL1xuXHRmdW5jdGlvbiBzZXJ2aWNlX2R1cmF0aW9uX25vZGUoIHNlcnZpY2UgKSB7XG5cdFx0dmFyIGR1cmF0aW9uX21pbnV0ZXMgPSBNYXRoLm1heCggMCwgTnVtYmVyKCBzZXJ2aWNlLmR1cmF0aW9uX21pbnV0ZXMgfHwgMCApICk7XG5cdFx0dmFyIGJ1ZmZlcl9iZWZvcmVfbWludXRlcyA9IE1hdGgubWF4KCAwLCBOdW1iZXIoIHNlcnZpY2UuYnVmZmVyX2JlZm9yZV9taW51dGVzIHx8IDAgKSApO1xuXHRcdHZhciBidWZmZXJfYWZ0ZXJfbWludXRlcyA9IE1hdGgubWF4KCAwLCBOdW1iZXIoIHNlcnZpY2UuYnVmZmVyX2FmdGVyX21pbnV0ZXMgfHwgMCApICk7XG5cdFx0dmFyIGR1cmF0aW9uX2Zvcm1hdCA9IFN0cmluZyggY29uZmlnLmkxOG4uZHVyYXRpb25fbWludXRlcyB8fCAnJXMgbWluJyApO1xuXHRcdHZhciBidWZmZXJzX2Zvcm1hdCA9IFN0cmluZyggY29uZmlnLmkxOG4uYnVmZmVyc19zdW1tYXJ5IHx8ICdCdWZmZXJzOiAlMSRzIC8gJTIkcyBtaW4nICk7XG5cdFx0dmFyIGJ1ZmZlcnNfdG9vbHRpcF9mb3JtYXQgPSBTdHJpbmcoIGNvbmZpZy5pMThuLmJ1ZmZlcnNfdG9vbHRpcCB8fCAnQnVmZmVyIGJlZm9yZTogJTEkcyBtaW47IEJ1ZmZlciBhZnRlcjogJTIkcyBtaW4nICk7XG5cdFx0dmFyIGJ1ZmZlcnNfc3VtbWFyeSA9IGJ1ZmZlcnNfZm9ybWF0LnJlcGxhY2UoICclMSRzJywgYnVmZmVyX2JlZm9yZV9taW51dGVzICkucmVwbGFjZSggJyUyJHMnLCBidWZmZXJfYWZ0ZXJfbWludXRlcyApO1xuXHRcdHZhciBidWZmZXJzX3Rvb2x0aXAgPSBidWZmZXJzX3Rvb2x0aXBfZm9ybWF0LnJlcGxhY2UoICclMSRzJywgYnVmZmVyX2JlZm9yZV9taW51dGVzICkucmVwbGFjZSggJyUyJHMnLCBidWZmZXJfYWZ0ZXJfbWludXRlcyApO1xuXHRcdHZhciAkZHVyYXRpb25fZGV0YWlscyA9ICQoICc8c3Bhbj4nLCB7ICdjbGFzcyc6ICd3cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19kdXJhdGlvbl9kZXRhaWxzJyB9ICk7XG5cblx0XHQkKCAnPHN0cm9uZz4nLCB7XG5cdFx0XHQnY2xhc3MnOiAnd3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fZHVyYXRpb25fdmFsdWUnLFxuXHRcdFx0dGV4dDogZHVyYXRpb25fZm9ybWF0LnJlcGxhY2UoICclcycsIGR1cmF0aW9uX21pbnV0ZXMgKVxuXHRcdH0gKS5hcHBlbmRUbyggJGR1cmF0aW9uX2RldGFpbHMgKTtcblx0XHQkKCAnPHNwYW4+Jywge1xuXHRcdFx0J2NsYXNzJzogJ3dwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX2J1ZmZlcnNfc3VtbWFyeScsXG5cdFx0XHR0ZXh0OiBidWZmZXJzX3N1bW1hcnksXG5cdFx0XHR0aXRsZTogYnVmZmVyc190b29sdGlwLFxuXHRcdFx0J2FyaWEtbGFiZWwnOiBidWZmZXJzX3Rvb2x0aXBcblx0XHR9ICkuYXBwZW5kVG8oICRkdXJhdGlvbl9kZXRhaWxzICk7XG5cblx0XHRyZXR1cm4gJGR1cmF0aW9uX2RldGFpbHM7XG5cdH1cblx0LyoqXG5cdCAqIFJldHVybiBhc3NpZ25lZCBQcm92aWRlcnMgd2l0aCByZWN1cnJpbmcgYXZhaWxhYmlsaXR5IG9uIG9uZSB3ZWVrZGF5LlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gc2VydmljZSBOb3JtYWxpemVkIFNlcnZpY2UgcmVzcG9uc2UuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBkYXkgV2Vla2RheSBrZXkgZnJvbSBtb24gdGhyb3VnaCBzdW4uXG5cdCAqIEByZXR1cm4ge0FycmF5PE9iamVjdD59IE1hdGNoaW5nIFByb3ZpZGVyIHByZXNlbnRhdGlvbiByZWNvcmRzLlxuXHQgKi9cblx0ZnVuY3Rpb24gcHJvdmlkZXJzX2F2YWlsYWJsZV9vbiggc2VydmljZSwgZGF5ICkge1xuXHRcdHZhciBhdmFpbGFibGVfcHJvdmlkZXJzID0gW107XG5cdFx0JC5lYWNoKCBzZXJ2aWNlLnJlc291cmNlX2lkcyB8fCBbXSwgZnVuY3Rpb24gKCBpbmRleCwgaWQgKSB7XG5cdFx0XHR2YXIgcHJvdmlkZXIgPSBzdGF0ZS5wcm92aWRlcnNbIFN0cmluZyggTnVtYmVyKCBpZCB8fCAwICkgKSBdO1xuXHRcdFx0aWYgKCBwcm92aWRlciAmJiBwcm92aWRlci53ZWVrZGF5cyAmJiBwcm92aWRlci53ZWVrZGF5c1sgZGF5IF0gKSB7XG5cdFx0XHRcdGF2YWlsYWJsZV9wcm92aWRlcnMucHVzaCggcHJvdmlkZXIgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gYXZhaWxhYmxlX3Byb3ZpZGVycztcblx0fVxuXHQvKipcblx0ICogQnVpbGQgY29tcGFjdCBQcm92aWRlci1zcGVjaWZpYyBsaW5rcyBiZWxvdyB0aGUgd2Vla2x5IGF2YWlsYWJpbGl0eSBkb3RzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gc2VydmljZSBOb3JtYWxpemVkIFNlcnZpY2UgcmVzcG9uc2UuXG5cdCAqIEByZXR1cm4ge2pRdWVyeX0gQXZhaWxhYmlsaXR5IGxpbmtzLCBvciBhbiBlbXB0eSBjb2xsZWN0aW9uIHdoZW4gdW5hdmFpbGFibGUuXG5cdCAqL1xuXHRmdW5jdGlvbiBhdmFpbGFiaWxpdHlfZWRpdF9saW5rcyggc2VydmljZSApIHtcblx0XHR2YXIgJGxpbmtzID0gJCggJzxkaXY+Jywge1xuXHRcdFx0J2NsYXNzJzogJ3dwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX2F2YWlsYWJpbGl0eV9saW5rcycsXG5cdFx0XHQnYXJpYS1sYWJlbCc6IGNvbmZpZy5pMThuLmVkaXRfcHJvdmlkZXJfYXZhaWxhYmlsaXR5IHx8ICdFZGl0IFByb3ZpZGVyIGF2YWlsYWJpbGl0eSdcblx0XHR9ICk7XG5cblx0XHQkLmVhY2goIHNlcnZpY2UucmVzb3VyY2VfaWRzIHx8IFtdLCBmdW5jdGlvbiAoIGluZGV4LCBpZCApIHtcblx0XHRcdHZhciBwcm92aWRlciA9IHN0YXRlLnByb3ZpZGVyc1sgU3RyaW5nKCBOdW1iZXIoIGlkIHx8IDAgKSApIF07XG5cdFx0XHR2YXIgcHJvdmlkZXJfdGl0bGU7XG5cdFx0XHR2YXIgbGlua190aXRsZTtcblxuXHRcdFx0aWYgKCAhIHByb3ZpZGVyIHx8ICEgcHJvdmlkZXIuYXZhaWxhYmlsaXR5X3VybCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cHJvdmlkZXJfdGl0bGUgPSBwcm92aWRlci50aXRsZSB8fCAnUHJvdmlkZXIgIycgKyBOdW1iZXIoIGlkIHx8IDAgKTtcblx0XHRcdGxpbmtfdGl0bGUgPSBTdHJpbmcoIGNvbmZpZy5pMThuLmVkaXRfYXZhaWxhYmlsaXR5IHx8ICdFZGl0IGF2YWlsYWJpbGl0eSBmb3IgJXMnICkucmVwbGFjZSggJyVzJywgcHJvdmlkZXJfdGl0bGUgKTtcblx0XHRcdCQoICc8YT4nLCB7XG5cdFx0XHRcdCdjbGFzcyc6ICd3cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19hdmFpbGFiaWxpdHlfbGluaycsXG5cdFx0XHRcdGhyZWY6IHByb3ZpZGVyLmF2YWlsYWJpbGl0eV91cmwsXG5cdFx0XHRcdHRleHQ6IHByb3ZpZGVyLmluaXRpYWxzIHx8ICdQJyxcblx0XHRcdFx0dGl0bGU6IGxpbmtfdGl0bGUsXG5cdFx0XHRcdCdhcmlhLWxhYmVsJzogbGlua190aXRsZVxuXHRcdFx0fSApLmFwcGVuZFRvKCAkbGlua3MgKTtcblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gJGxpbmtzLmNoaWxkcmVuKCkubGVuZ3RoID8gJGxpbmtzIDogJCgpO1xuXHR9XG5cdC8qKiBDb252ZXJ0IGEgc3RvcmVkIFNlcnZpY2Ugc3RhdHVzIHRvIGl0cyB0cmFuc2xhdGVkIFVJIGxhYmVsLiAqL1xuXHRmdW5jdGlvbiBzdGF0dXNMYWJlbCggc3RhdHVzICkge1xuXHRcdGlmICggJ2luYWN0aXZlJyA9PT0gc3RhdHVzICkgeyByZXR1cm4gY29uZmlnLmkxOG4uZHJhZnQgfHwgJ0RyYWZ0JzsgfVxuXHRcdGlmICggJ2FyY2hpdmVkJyA9PT0gc3RhdHVzICkgeyByZXR1cm4gY29uZmlnLmkxOG4uYXJjaGl2ZWQgfHwgJ0FyY2hpdmVkJzsgfVxuXHRcdHJldHVybiBjb25maWcuaTE4bi5hY3RpdmUgfHwgJ0FjdGl2ZSc7XG5cdH1cblx0LyoqIEZvcm1hdCB0aGUgdHJhbnNsYXRlZCB0YWJsZSBwYWdpbmF0aW9uIHN1bW1hcnkuICovXG5cdGZ1bmN0aW9uIHNob3dpbmdUZXh0KCBmcm9tLCB0bywgdG90YWwgKSB7XG5cdFx0dmFyIGZvcm1hdCA9IGNvbmZpZy5pMThuLnNob3dpbmcgfHwgJ1Nob3dpbmcgJTEkcy0lMiRzIG9mICUzJHMgU2VydmljZXMnO1xuXHRcdHJldHVybiBmb3JtYXQucmVwbGFjZSggJyUxJHMnLCBmcm9tICkucmVwbGFjZSggJyUyJHMnLCB0byApLnJlcGxhY2UoICclMyRzJywgdG90YWwgKTtcblx0fVxuXHQvKiogUmV0dXJuIG9uZSBjb21waWxlZCwgYWxsb3ctbGlzdGVkIFdvcmRQcmVzcyB0ZW1wbGF0ZS4gKi9cblx0ZnVuY3Rpb24gY2F0YWxvZ1RlbXBsYXRlKCB0ZW1wbGF0ZUlkICkge1xuXHRcdHRyeSB7IHJldHVybiB0ZW1wbGF0ZUlkICYmIHcud3AgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHcud3AudGVtcGxhdGUgPyB3LndwLnRlbXBsYXRlKCB0ZW1wbGF0ZUlkICkgOiBudWxsOyB9XG5cdFx0Y2F0Y2ggKCBlcnJvciApIHsgcmV0dXJuIG51bGw7IH1cblx0fVxuXHQvKipcblx0ICogUmV0dXJuIHRoZSBzaGFyZWQgbmF0aXZlIGluc3BlY3RvciBzdGF0ZSB3b3JrZmxvdyBmb3IgU2VydmljZSBvcGVyYXRpb25zLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8ZmFsc2V9IFNoYXJlZCBpbnNwZWN0b3Igd29ya2Zsb3cgb3IgZmFsc2UuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfb3BlcmF0aW9uX2luc3BlY3Rvcl93b3JrZmxvdygpIHtcblx0XHR2YXIgdGVtcGxhdGVfaWQ7XG5cblx0XHRpZiAoIGluc3BlY3RvcldvcmtmbG93Q29udHJvbGxlciApIHsgcmV0dXJuIGluc3BlY3RvcldvcmtmbG93Q29udHJvbGxlcjsgfVxuXHRcdGlmICggISB3LndwYmNfdWlfY2F0YWxvZyB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygdy53cGJjX3VpX2NhdGFsb2cuY3JlYXRlX2luc3BlY3Rvcl93b3JrZmxvdyApIHsgcmV0dXJuIGZhbHNlOyB9XG5cdFx0dGVtcGxhdGVfaWQgPSBjb25maWcuY2F0YWxvZyAmJiBjb25maWcuY2F0YWxvZy50ZW1wbGF0ZXMgPyBjb25maWcuY2F0YWxvZy50ZW1wbGF0ZXMuaW5zcGVjdG9yIDogJyc7XG5cdFx0aW5zcGVjdG9yV29ya2Zsb3dDb250cm9sbGVyID0gdy53cGJjX3VpX2NhdGFsb2cuY3JlYXRlX2luc3BlY3Rvcl93b3JrZmxvdygge1xuXHRcdFx0ZXhwYW5kOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdCQoICdbZGF0YS13cGJjLWFwcG9pbnRtZW50LXNlcnZpY2VzLW9wZXJhdGlvbi1ob3N0XScgKS5wcm9wKCAnaGlkZGVuJywgZmFsc2UgKTtcblx0XHRcdFx0JCggJ1tkYXRhLXdwYmMtYXBwb2ludG1lbnQtc2VydmljZXMtbmF0aXZlLWluc3BlY3Rvcl0nICkucHJvcCggJ2hpZGRlbicsIHRydWUgKTtcblx0XHRcdFx0ZXhwYW5kX3NlcnZpY2VfaW5zcGVjdG9yKCk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0X2Zvb3RlcjogZnVuY3Rpb24gKCkgeyByZXR1cm4gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19yaWdodF9zaWRlYmFyX2Zvb3RlcicgKTsgfSxcblx0XHRcdGdldF9ob3N0OiBmdW5jdGlvbiAoKSB7IHJldHVybiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1hcHBvaW50bWVudC1zZXJ2aWNlcy1vcGVyYXRpb24taG9zdF0nICk7IH0sXG5cdFx0XHRyZW5kZXJfc2hlbGw6IGZ1bmN0aW9uICggc2hlbGxfZGF0YSApIHtcblx0XHRcdFx0dmFyIHNoZWxsX3RlbXBsYXRlID0gY2F0YWxvZ1RlbXBsYXRlKCB0ZW1wbGF0ZV9pZCApO1xuXG5cdFx0XHRcdHJldHVybiBzaGVsbF90ZW1wbGF0ZSA/IHNoZWxsX3RlbXBsYXRlKCBzaGVsbF9kYXRhICkgOiAnJztcblx0XHRcdH0sXG5cdFx0XHRzaGVsbF9kYXRhOiB7XG5cdFx0XHRcdGNhdGFsb2dfaWQ6IGNvbmZpZy5jYXRhbG9nICYmIGNvbmZpZy5jYXRhbG9nLmlkID8gY29uZmlnLmNhdGFsb2cuaWQgOiAnYXBwb2ludG1lbnRfc2VydmljZXNfY2F0YWxvZycsXG5cdFx0XHRcdGVtcHR5X2ljb246ICd3cGJjLWJpLXBlbmNpbC1zcXVhcmUnLFxuXHRcdFx0XHRlbXB0eV9tZXNzYWdlOiAnJyxcblx0XHRcdFx0ZW1wdHlfdGl0bGU6ICcnLFxuXHRcdFx0XHRsb2FkaW5nX2xhYmVsOiBjb25maWcuaTE4bi5sb2FkaW5nIHx8ICcnXG5cdFx0XHR9XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIGluc3BlY3RvcldvcmtmbG93Q29udHJvbGxlcjtcblx0fVxuXHQvKiogUmV0dXJuIHNhZmUgSFRNTCBmcm9tIGEgZGV0YWNoZWQgalF1ZXJ5IHByZXNlbnRhdGlvbiBub2RlLiAqL1xuXHRmdW5jdGlvbiBub2RlSHRtbCggJG5vZGUgKSB7IHJldHVybiAkbm9kZSAmJiAkbm9kZS5sZW5ndGggPyAkKCAnPGRpdj4nICkuYXBwZW5kKCAkbm9kZSApLmh0bWwoKSA6ICcnOyB9XG5cdC8qKlxuXHQgKiBSZXR1cm4gdGhlIHNoYXJlZCBzZWxlY3Rpb24gY29udHJvbGxlciBtb3VudGVkIGZvciB0aGUgU2VydmljZXMgY2F0YWxvZy5cblx0ICpcblx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IFNoYXJlZCBzZWxlY3Rpb24gY29udHJvbGxlciwgb3IgbnVsbCBiZWZvcmUgbW91bnQuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfc2VsZWN0aW9uX2NvbnRyb2xsZXIoKSB7XG5cdFx0dmFyIG1vdW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX2NhdGFsb2cnICk7XG5cblx0XHRyZXR1cm4gbW91bnQgJiYgbW91bnQuX3dwYmNfdWlfY2F0YWxvZ19zZWxlY3Rpb25fY29udHJvbGxlciA/IG1vdW50Ll93cGJjX3VpX2NhdGFsb2dfc2VsZWN0aW9uX2NvbnRyb2xsZXIgOiBudWxsO1xuXHR9XG5cdC8qKlxuXHQgKiBSZXR1cm4gc2VsZWN0ZWQgU2VydmljZSBpZGVudGlmaWVycyB3aXRob3V0IGV4cG9zaW5nIHNlbGVjdGlvbiBpbnRlcm5hbHMuXG5cdCAqXG5cdCAqIEByZXR1cm4ge0FycmF5PG51bWJlcj59IFBlcnNpc3RlZCBzZWxlY3RlZCBTZXJ2aWNlIGlkZW50aWZpZXJzLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X3NlbGVjdGVkX3NlcnZpY2VfaWRzKCkge1xuXHRcdHZhciBzZWxlY3Rpb24gPSBnZXRfc2VsZWN0aW9uX2NvbnRyb2xsZXIoKTtcblxuXHRcdHJldHVybiBzZWxlY3Rpb24gJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHNlbGVjdGlvbi5nZXRfc2VsZWN0ZWRfaWRzID8gc2VsZWN0aW9uLmdldF9zZWxlY3RlZF9pZHMoKSA6IFtdO1xuXHR9XG5cdC8qKlxuXHQgKiBSZXR1cm4gb25lIFNlcnZpY2UgZnJvbSB0aGUgbGFzdCBub3JtYWxpemVkIGNhdGFsb2cgcmVzcG9uc2UuXG5cdCAqXG5cdCAqIEBwYXJhbSB7bnVtYmVyfHN0cmluZ30gc2VydmljZV9pZCBTZXJ2aWNlIGlkZW50aWZpZXIgdG8gZmluZC5cblx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IE1hdGNoaW5nIFNlcnZpY2UgRFRPLCBvciBudWxsIHdoZW4gbm90IG9uIHRoaXMgcGFnZS5cblx0ICovXG5cdGZ1bmN0aW9uIGZpbmRfc2VydmljZSggc2VydmljZV9pZCApIHtcblx0XHR2YXIgZm91bmQgPSBudWxsO1xuXG5cdFx0JC5lYWNoKCBzdGF0ZS5zZXJ2aWNlcywgZnVuY3Rpb24gKCBpbmRleCwgc2VydmljZSApIHtcblx0XHRcdGlmICggTnVtYmVyKCBzZXJ2aWNlLnNlcnZpY2VfaWQgfHwgc2VydmljZS5pZCB8fCAwICkgPT09IE51bWJlciggc2VydmljZV9pZCApICkge1xuXHRcdFx0XHRmb3VuZCA9IHNlcnZpY2U7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gZm91bmQ7XG5cdH1cblx0LyoqXG5cdCAqIFJldHVybiB0aGUgYWxsb3ctbGlzdGVkIGluaXRpYWwgaW5saW5lIGRyYWZ0IGZvciBvbmUgU2VydmljZS5cblx0ICpcblx0ICogUHJvdmlkZXIgYXNzaWdubWVudHMsIHN0YXR1cywgYW5kIGJ1ZmZlcnMgYXJlIGRlbGliZXJhdGVseSBvbWl0dGVkIGJlY2F1c2Vcblx0ICogdGhleSByZXF1aXJlIHRoZSByZXZpZXdlZCBidWxrIGluc3BlY3RvciBvciB0aGUgY29tcGxldGUgU2VydmljZSBpbnNwZWN0b3IuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSByb3dfc2NoZW1hIFNlcnZlci1hdXRob3JpdGF0aXZlIHJvdyBzY2hlbWEuXG5cdCAqIEByZXR1cm4ge09iamVjdH0gRWRpdGFibGUgcm93LXNwZWNpZmljIGRyYWZ0LlxuXHQgKi9cblx0ZnVuY3Rpb24gY3JlYXRlX2lubGluZV9kcmFmdCggcm93X3NjaGVtYSApIHtcblx0XHR2YXIgZHJhZnQgPSB7fTtcblxuXHRcdCQuZWFjaCggcm93X3NjaGVtYSAmJiBBcnJheS5pc0FycmF5KCByb3dfc2NoZW1hLmZpZWxkcyApID8gcm93X3NjaGVtYS5maWVsZHMgOiBbXSwgZnVuY3Rpb24gKCBpbmRleCwgZmllbGQgKSB7XG5cdFx0XHR2YXIgZmllbGRfa2V5ID0gU3RyaW5nKCBmaWVsZCAmJiBmaWVsZC5rZXkgPyBmaWVsZC5rZXkgOiAnJyApO1xuXHRcdFx0aWYgKCBmaWVsZF9rZXkgKSB7IGRyYWZ0WyBmaWVsZF9rZXkgXSA9IFN0cmluZyggZmllbGQudmFsdWUgKTsgfVxuXHRcdH0gKTtcblxuXHRcdHJldHVybiBkcmFmdDtcblx0fVxuXHQvKiogUmV0dXJuIG9uZSBjYWNoZWQgc2VydmVyLWF1dGhvcml0YXRpdmUgaW5saW5lIHJvdyBzY2hlbWEuICovXG5cdGZ1bmN0aW9uIGZpbmRfaW5saW5lX3NjaGVtYSggc2VydmljZV9pZCApIHtcblx0XHRyZXR1cm4gc3RhdGUuaW5saW5lX3NjaGVtYVsgU3RyaW5nKCBOdW1iZXIoIHNlcnZpY2VfaWQgfHwgMCApICkgXSB8fCBudWxsO1xuXHR9XG5cdC8qKlxuXHQgKiBSZXR1cm4gd2hldGhlciBvbmUgaW5saW5lIGRyYWZ0IGRpZmZlcnMgZnJvbSBpdHMgY3VycmVudCBTZXJ2aWNlIERUTy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R8bnVsbH0gcm93X3NjaGVtYSBDdXJyZW50IHNlcnZlci1hdXRob3JpdGF0aXZlIHJvdyBzY2hlbWEuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fG51bGx9IGRyYWZ0ICAgUm93LXNwZWNpZmljIGlubGluZSBkcmFmdC5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGF0IGxlYXN0IG9uZSBhbGxvdy1saXN0ZWQgdmFsdWUgY2hhbmdlZC5cblx0ICovXG5cdGZ1bmN0aW9uIGlubGluZV9kcmFmdF9jaGFuZ2VkKCByb3dfc2NoZW1hLCBkcmFmdCApIHtcblx0XHR2YXIgY2hhbmdlZCA9IGZhbHNlO1xuXG5cdFx0aWYgKCAhIHJvd19zY2hlbWEgfHwgISBkcmFmdCApIHsgcmV0dXJuIGZhbHNlOyB9XG5cdFx0JC5lYWNoKCBBcnJheS5pc0FycmF5KCByb3dfc2NoZW1hLmZpZWxkcyApID8gcm93X3NjaGVtYS5maWVsZHMgOiBbXSwgZnVuY3Rpb24gKCBpbmRleCwgZmllbGQgKSB7XG5cdFx0XHRpZiAoIFN0cmluZyggZmllbGQudmFsdWUgKSAhPT0gU3RyaW5nKCBkcmFmdFsgZmllbGQua2V5IF0gKSApIHtcblx0XHRcdFx0Y2hhbmdlZCA9IHRydWU7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gY2hhbmdlZDtcblx0fVxuXHQvKipcblx0ICogUmV0dXJuIGNoYW5nZWQgaW5saW5lIGRyYWZ0cyBrZXllZCBieSBTZXJ2aWNlIElELlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtPYmplY3Q8c3RyaW5nLE9iamVjdD59IENoYW5nZWQgZHJhZnRzIGtleWVkIGJ5IFNlcnZpY2UgaWRlbnRpZmllci5cblx0ICovXG5cdGZ1bmN0aW9uIGNvbGxlY3RfaW5saW5lX2NoYW5nZXMoKSB7XG5cdFx0dmFyIGNoYW5nZXMgPSB7fTtcblxuXHRcdCQuZWFjaCggc3RhdGUuaW5saW5lX2RyYWZ0cywgZnVuY3Rpb24gKCBzZXJ2aWNlX2lkLCBkcmFmdCApIHtcblx0XHRcdHZhciByb3dfc2NoZW1hID0gZmluZF9pbmxpbmVfc2NoZW1hKCBzZXJ2aWNlX2lkICk7XG5cdFx0XHR2YXIgcm93X2NoYW5nZXMgPSB7fTtcblxuXHRcdFx0JC5lYWNoKCByb3dfc2NoZW1hICYmIEFycmF5LmlzQXJyYXkoIHJvd19zY2hlbWEuZmllbGRzICkgPyByb3dfc2NoZW1hLmZpZWxkcyA6IFtdLCBmdW5jdGlvbiAoIGluZGV4LCBmaWVsZCApIHtcblx0XHRcdFx0aWYgKCBTdHJpbmcoIGZpZWxkLnZhbHVlICkgIT09IFN0cmluZyggZHJhZnRbIGZpZWxkLmtleSBdICkgKSB7XG5cdFx0XHRcdFx0cm93X2NoYW5nZXNbIGZpZWxkLmtleSBdID0gZHJhZnRbIGZpZWxkLmtleSBdO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoIE9iamVjdC5rZXlzKCByb3dfY2hhbmdlcyApLmxlbmd0aCApIHtcblx0XHRcdFx0Y2hhbmdlc1sgc2VydmljZV9pZCBdID0gcm93X2NoYW5nZXM7XG5cdFx0XHR9XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIGNoYW5nZXM7XG5cdH1cblx0LyoqXG5cdCAqIFJldHVybiB0aGUgY291bnQgb2YgY2hhbmdlZCBTZXJ2aWNlIHJvd3MgaW4gaW5saW5lIG1vZGUuXG5cdCAqXG5cdCAqIEByZXR1cm4ge251bWJlcn0gTnVtYmVyIG9mIHJvdyBkcmFmdHMgdGhhdCBkaWZmZXIgZnJvbSB0aGVpciBEVE9zLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X2lubGluZV9jaGFuZ2VkX2NvdW50KCkgeyByZXR1cm4gT2JqZWN0LmtleXMoIGNvbGxlY3RfaW5saW5lX2NoYW5nZXMoKSApLmxlbmd0aDsgfVxuXHQvKipcblx0ICogUmVuZGVyIGFuZCByZWdpc3RlciB0aGUgc3RpY2t5IGlubGluZS1lZGl0aW5nIHN0YXR1cyBiYXIuXG5cdCAqXG5cdCAqIFJlZ2lzdHJhdGlvbiBkZWxlZ2F0ZXMgdmlld3BvcnQgcG9zaXRpb25pbmcgdG8gdGhlIHNoYXJlZCBzZWxlY3Rpb25cblx0ICogY29udHJvbGxlciBzbyB0aGUgU2VydmljZSBwYWdlIGZvbGxvd3MgdGhlIFJlc291cmNlIGNhdGFsb2cgYmVoYXZpb3IuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiByZW5kZXJfaW5saW5lX2JhcigpIHtcblx0XHR2YXIgdGVtcGxhdGUgPSBjYXRhbG9nVGVtcGxhdGUoICd3cGJjLWFwcG9pbnRtZW50LXNlcnZpY2VzLWlubGluZS1iYXInICk7XG5cdFx0dmFyIGNoYW5nZWRfY291bnQgPSBnZXRfaW5saW5lX2NoYW5nZWRfY291bnQoKTtcblx0XHR2YXIgJGhvc3QgPSAkKCAnW2RhdGEtd3BiYy1hcHBvaW50bWVudC1zZXJ2aWNlcy1pbmxpbmUtYmFyLWhvc3RdJyApO1xuXG5cdFx0aWYgKCAhIHRlbXBsYXRlIHx8ICEgJGhvc3QubGVuZ3RoICkgeyByZXR1cm47IH1cblx0XHRpZiAoICEgJGhvc3QuY2hpbGRyZW4oKS5sZW5ndGggKSB7XG5cdFx0XHQkaG9zdC5odG1sKCB0ZW1wbGF0ZSgge1xuXHRcdFx0XHR0aXRsZTogY29uZmlnLmkxOG4uZWRpdGluZ19yb3dzLFxuXHRcdFx0XHRjaGFuZ2VkX2xhYmVsOiBTdHJpbmcoIGNvbmZpZy5pMThuLmNoYW5nZWRfcm93cyB8fCAnJXMgY2hhbmdlZCByb3dzJyApLnJlcGxhY2UoICclcycsIGNoYW5nZWRfY291bnQgKSxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGNvbmZpZy5pMThuLmlubGluZV9oZWxwLFxuXHRcdFx0XHRjYW5jZWw6IGNvbmZpZy5pMThuLmNhbmNlbCxcblx0XHRcdFx0cmV2aWV3OiBjb25maWcuaTE4bi5yZXZpZXdfY2hhbmdlcyxcblx0XHRcdFx0Y2hhbmdlZF9jb3VudDogY2hhbmdlZF9jb3VudFxuXHRcdFx0fSApICk7XG5cdFx0fVxuXHRcdHN5bmNocm9uaXplX2lubGluZV9iYXIoKTtcblx0fVxuXHQvKipcblx0ICogU3luY2hyb25pemUgdGhlIGlubGluZSBiYXIgd2l0aG91dCByZXBsYWNpbmcgaXRzIGFjdGl2ZSBjb250cm9scy5cblx0ICpcblx0ICogQSBmb2N1c2VkIGlubGluZSBmaWVsZCBlbWl0cyBpdHMgZmluYWwgY2hhbmdlIGV2ZW50IHdoaWxlIHRoZSBSZXZpZXdcblx0ICogYnV0dG9uIGlzIGJlaW5nIGNsaWNrZWQuIFJlcGxhY2luZyB0aGUgYmFyIGZyb20gdGhhdCBjaGFuZ2UgaGFuZGxlciB3b3VsZFxuXHQgKiByZW1vdmUgdGhlIHBvaW50ZXIgdGFyZ2V0IGJlZm9yZSB0aGUgY2xpY2sgZXZlbnQgY2FuIGNvbXBsZXRlLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3luY2hyb25pemVfaW5saW5lX2JhcigpIHtcblx0XHR2YXIgY2hhbmdlZF9jb3VudCA9IGdldF9pbmxpbmVfY2hhbmdlZF9jb3VudCgpO1xuXHRcdHZhciAkYmFyID0gJCggJ1tkYXRhLXdwYmMtYXBwb2ludG1lbnQtc2VydmljZXMtaW5saW5lLWJhcl0nICk7XG5cblx0XHRpZiAoICEgJGJhci5sZW5ndGggKSB7IHJldHVybjsgfVxuXHRcdCRiYXIuZmluZCggJ1tkYXRhLXdwYmMtYXBwb2ludG1lbnQtc2VydmljZXMtaW5saW5lLWNoYW5nZWQtbGFiZWxdJyApLnRleHQoXG5cdFx0XHRTdHJpbmcoIGNvbmZpZy5pMThuLmNoYW5nZWRfcm93cyB8fCAnJXMgY2hhbmdlZCByb3dzJyApLnJlcGxhY2UoICclcycsIGNoYW5nZWRfY291bnQgKVxuXHRcdCk7XG5cdFx0c3luY2hyb25pemVfaW5saW5lX3dvcmtmbG93KCk7XG5cdH1cblx0LyoqXG5cdCAqIFN0YXJ0IHJvdy1zcGVjaWZpYyBpbmxpbmUgZWRpdGluZyBmb3IgdGhlIGN1cnJlbnQgY2F0YWxvZyBwYWdlLlxuXHQgKlxuXHQgKiBEcmFmdHMgaW50ZW50aW9uYWxseSBjb3ZlciB0aGUgY3VycmVudCBwYWdlIG9ubHkuIFBhZ2UtY2hhbmdpbmcgY29udHJvbHNcblx0ICogcmVtYWluIHByb3RlY3RlZCB1bnRpbCB0aGUgdXNlciBjYW5jZWxzIG9yIGNvbXBsZXRlcyB0aGUgcmV2aWV3ZWQgY2hhbmdlLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3RhcnRfaW5saW5lX2VkaXRpbmcoKSB7XG5cdFx0dmFyIHJlcXVlc3Rfc2VxdWVuY2U7XG5cdFx0dmFyIHZpc2libGVfaWRzO1xuXG5cdFx0aWYgKCBzdGF0ZS5idXN5IHx8IHN0YXRlLmNhdGFsb2dfbG9hZGluZyB8fCBzdGF0ZS5vcGVyYXRpb25fbW9kZSApIHsgcmV0dXJuOyB9XG5cdFx0aWYgKCBzdGF0ZS5pbmxpbmVfZWRpdGluZyApIHtcblx0XHRcdGNhbmNlbF9pbmxpbmVfZWRpdGluZyggdHJ1ZSApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoICEgc3RhdGUuc2VydmljZXMubGVuZ3RoICkgeyByZXR1cm47IH1cblx0XHRpZiAoICEgY2FuX3JlcGxhY2VfZWRpdG9yKCkgKSB7IHJldHVybjsgfVxuXHRcdGlmICggZWRpdG9ySXNPcGVuKCkgKSB7IHJlc2V0X3NlcnZpY2VfZWRpdG9yKCk7IH1cblx0XHR2aXNpYmxlX2lkcyA9ICQubWFwKCBzdGF0ZS5zZXJ2aWNlcywgZnVuY3Rpb24gKCBzZXJ2aWNlICkgeyByZXR1cm4gTnVtYmVyKCBzZXJ2aWNlLnNlcnZpY2VfaWQgfHwgc2VydmljZS5pZCB8fCAwICk7IH0gKTtcblx0XHRyZXF1ZXN0X3NlcXVlbmNlID0gKytzdGF0ZS5pbmxpbmVfcmVxdWVzdF9zZXF1ZW5jZTtcblx0XHRzdGF0ZS5pbmxpbmVfZWRpdGluZyA9IGZhbHNlO1xuXHRcdHN0YXRlLmlubGluZV9kcmFmdHMgPSB7fTtcblx0XHRzdGF0ZS5pbmxpbmVfc2NoZW1hID0ge307XG5cdFx0c3RhdGUuaW5saW5lX3NjaGVtYV9sb2FkaW5nID0gdHJ1ZTtcblx0XHRzZXRCdXN5KCB0cnVlICk7XG5cdFx0cmVxdWVzdCggY29uZmlnLmFjdGlvbnMuaW5saW5lX3NjaGVtYSwgeyBpZHM6IEpTT04uc3RyaW5naWZ5KCB2aXNpYmxlX2lkcyApIH0gKS5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0dmFyIHNjaGVtYSA9IHJlc3BvbnNlICYmIHJlc3BvbnNlLnN1Y2Nlc3MgJiYgcmVzcG9uc2UuZGF0YSA/IHJlc3BvbnNlLmRhdGEuc2NoZW1hIDogbnVsbDtcblxuXHRcdFx0aWYgKCByZXF1ZXN0X3NlcXVlbmNlICE9PSBzdGF0ZS5pbmxpbmVfcmVxdWVzdF9zZXF1ZW5jZSApIHsgcmV0dXJuOyB9XG5cdFx0XHRpZiAoICEgc2NoZW1hIHx8ICEgQXJyYXkuaXNBcnJheSggc2NoZW1hLnJvd3MgKSApIHtcblx0XHRcdFx0bm90aWZ5KCBtZXNzYWdlRnJvbSggcmVzcG9uc2UsIGNvbmZpZy5pMThuLmlubGluZV9zY2hlbWFfZmFpbGVkICksICdlcnJvcicgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0JC5lYWNoKCBzY2hlbWEucm93cywgZnVuY3Rpb24gKCBpbmRleCwgcm93X3NjaGVtYSApIHtcblx0XHRcdFx0dmFyIHNlcnZpY2VfaWQgPSBTdHJpbmcoIE51bWJlciggcm93X3NjaGVtYS5zZXJ2aWNlX2lkIHx8IDAgKSApO1xuXHRcdFx0XHRpZiAoICcwJyA9PT0gc2VydmljZV9pZCB8fCAhIEFycmF5LmlzQXJyYXkoIHJvd19zY2hlbWEuZmllbGRzICkgfHwgISByb3dfc2NoZW1hLmZpZWxkcy5sZW5ndGggKSB7IHJldHVybjsgfVxuXHRcdFx0XHRzdGF0ZS5pbmxpbmVfc2NoZW1hWyBzZXJ2aWNlX2lkIF0gPSByb3dfc2NoZW1hO1xuXHRcdFx0XHRzdGF0ZS5pbmxpbmVfZHJhZnRzWyBzZXJ2aWNlX2lkIF0gPSBjcmVhdGVfaW5saW5lX2RyYWZ0KCByb3dfc2NoZW1hICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoICEgT2JqZWN0LmtleXMoIHN0YXRlLmlubGluZV9kcmFmdHMgKS5sZW5ndGggKSB7XG5cdFx0XHRcdG5vdGlmeSggY29uZmlnLmkxOG4uaW5saW5lX3NjaGVtYV9mYWlsZWQsICdlcnJvcicgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0c3RhdGUuaW5saW5lX2VkaXRpbmcgPSB0cnVlO1xuXHRcdFx0cmVuZGVyQ2F0YWxvZ1Jlc3BvbnNlKCBzdGF0ZS5sYXN0X3Jlc3BvbnNlICk7XG5cdFx0XHRyZW5kZXJfaW5saW5lX2JhcigpO1xuXHRcdFx0JCggJ1tkYXRhLXdwYmMtYXBwb2ludG1lbnQtc2VydmljZXMtaW5saW5lLWZpZWxkXScgKS5maXJzdCgpLnRyaWdnZXIoICdmb2N1cycgKTtcblx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCB4aHIgKSB7XG5cdFx0XHRpZiAoIHJlcXVlc3Rfc2VxdWVuY2UgPT09IHN0YXRlLmlubGluZV9yZXF1ZXN0X3NlcXVlbmNlICkge1xuXHRcdFx0XHRub3RpZnkoIG1lc3NhZ2VGcm9tKCB4aHIucmVzcG9uc2VKU09OLCBjb25maWcuaTE4bi5pbmxpbmVfc2NoZW1hX2ZhaWxlZCApLCAnZXJyb3InICk7XG5cdFx0XHR9XG5cdFx0fSApLmFsd2F5cyggZnVuY3Rpb24gKCkge1xuXHRcdFx0aWYgKCByZXF1ZXN0X3NlcXVlbmNlID09PSBzdGF0ZS5pbmxpbmVfcmVxdWVzdF9zZXF1ZW5jZSApIHtcblx0XHRcdFx0c3RhdGUuaW5saW5lX3NjaGVtYV9sb2FkaW5nID0gZmFsc2U7XG5cdFx0XHRcdHNldEJ1c3koIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHR9XG5cdC8qKlxuXHQgKiBDYW5jZWwgU2VydmljZSBpbmxpbmUgZWRpdGluZyBhbmQgcmVzdG9yZSBmb2N1cyB0byBpdHMgdG9vbGJhciBhY3Rpb24uXG5cdCAqXG5cdCAqIFRoZSBzdGFibGUgc2hhcmVkIGRhdGEgYXR0cmlidXRlIGlzIHRoZSBpbnRlcmFjdGlvbiBjb250cmFjdC4gS2VlcGluZyB0aGVcblx0ICogY2FuY2VsbGF0aW9uIGluIHRoaXMgZG9tYWluIGFkYXB0ZXIgcHJlc2VydmVzIG93bmVyc2hpcCBvZiBTZXJ2aWNlIGRyYWZ0c1xuXHQgKiB3aGlsZSBwcmV2ZW50aW5nIHN1cnJvdW5kaW5nIHBhZ2UgYW5kIHNpZGViYXIgY2xpY2sgaGFuZGxlcnMgZnJvbSBkZWNpZGluZ1xuXHQgKiB3aGV0aGVyIHRob3NlIGRyYWZ0cyBzaG91bGQgYmUgZGlzY2FyZGVkLlxuXHQgKlxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IGNvbmZpcm1fZGlzY2FyZCBXaGV0aGVyIGNoYW5nZWQgZHJhZnRzIG5lZWQgY29uZmlybWF0aW9uLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gaW5saW5lIGVkaXRpbmcgd2FzIGNhbmNlbGxlZC5cblx0ICovXG5cdGZ1bmN0aW9uIGNhbmNlbF9pbmxpbmVfZWRpdGluZyggY29uZmlybV9kaXNjYXJkICkge1xuXHRcdHZhciBmb2N1c190YXJnZXQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWlubGluZS10b2dnbGVdJyApO1xuXG5cdFx0aWYgKCBzdGF0ZS5tdXRhdGlvbl9pbl9wcm9ncmVzcyApIHsgcmV0dXJuIGZhbHNlOyB9XG5cdFx0aWYgKCBjb25maXJtX2Rpc2NhcmQgJiYgZ2V0X2lubGluZV9jaGFuZ2VkX2NvdW50KCkgJiYgISB3LmNvbmZpcm0oIGNvbmZpZy5pMThuLmNvbmZpcm1fZGlzY2FyZCB8fCAnRGlzY2FyZCB1bnNhdmVkIFNlcnZpY2UgY2hhbmdlcz8nICkgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJlc2V0X29wZXJhdGlvbiggdHJ1ZSApO1xuXHRcdGlmICggZm9jdXNfdGFyZ2V0ICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jb250YWlucyggZm9jdXNfdGFyZ2V0ICkgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGZvY3VzX3RhcmdldC5mb2N1cyApIHtcblx0XHRcdGZvY3VzX3RhcmdldC5mb2N1cygpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdC8qKlxuXHQgKiBSZXR1cm4gZW5hYmxlZCB2YWx1ZXMgZnJvbSB0aGUgU2VydmljZSBidWxrIGVkaXRvci5cblx0ICpcblx0ICogQHJldHVybiB7T2JqZWN0PHN0cmluZyxzdHJpbmc+fG51bGx9IFNoYXJlZCBjaGFuZ2VzLCBvciBudWxsIHdoZW4gbm9uZSBlbmFibGVkLlxuXHQgKi9cblx0ZnVuY3Rpb24gY29sbGVjdF9idWxrX2NoYW5nZXMoKSB7XG5cdFx0dmFyIGNoYW5nZXMgPSB7fTtcblxuXHRcdCQoICdbZGF0YS13cGJjLWFwcG9pbnRtZW50LXNlcnZpY2VzLWJ1bGstZW5hYmxlXTpjaGVja2VkJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciBmaWVsZF9pZCA9IFN0cmluZyggJCggdGhpcyApLmRhdGEoICd3cGJjLWFwcG9pbnRtZW50LXNlcnZpY2VzLWJ1bGstZW5hYmxlJyApIHx8ICcnICk7XG5cdFx0XHR2YXIgJGZpZWxkID0gJCggJ1tkYXRhLXdwYmMtYXBwb2ludG1lbnQtc2VydmljZXMtYnVsay12YWx1ZT1cIicgKyBmaWVsZF9pZCArICdcIl0nICk7XG5cdFx0XHRpZiAoIGZpZWxkX2lkICYmICRmaWVsZC5sZW5ndGggKSB7IGNoYW5nZXNbIGZpZWxkX2lkIF0gPSAkZmllbGQudmFsKCk7IH1cblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gT2JqZWN0LmtleXMoIGNoYW5nZXMgKS5sZW5ndGggPyBjaGFuZ2VzIDogbnVsbDtcblx0fVxuXHQvKipcblx0ICogT3BlbiBhIFNlcnZpY2Utb3duZWQgb3BlcmF0aW9uIGluc2lkZSB0aGUgbmF0aXZlIHJpZ2h0IGluc3BlY3Rvci5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9ICAgICAgbW9kZSAgICAgICAgICBPcGVyYXRpb24gc3RhdGUgaWRlbnRpZmllci5cblx0ICogQHBhcmFtIHtzdHJpbmd9ICAgICAgdGVtcGxhdGVfaWQgICBBbGxvdy1saXN0ZWQgV29yZFByZXNzIHRlbXBsYXRlIElELlxuXHQgKiBAcGFyYW0ge09iamVjdH0gICAgICB0ZW1wbGF0ZV9kYXRhIFByZXNlbnRhdGlvbiBkYXRhIGZvciB0aGUgdGVtcGxhdGUuXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGZvY3VzX3RhcmdldCAgRWxlbWVudCB0aGF0IHNob3VsZCByZWdhaW4gZm9jdXMgb24gY2xvc2UuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgb3BlcmF0aW9uIHRlbXBsYXRlIHdhcyBvcGVuZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiBvcGVuX29wZXJhdGlvbiggbW9kZSwgdGVtcGxhdGVfaWQsIHRlbXBsYXRlX2RhdGEsIGZvY3VzX3RhcmdldCApIHtcblx0XHR2YXIgaW5zcGVjdG9yX3dvcmtmbG93ID0gZ2V0X29wZXJhdGlvbl9pbnNwZWN0b3Jfd29ya2Zsb3coKTtcblx0XHR2YXIgdGVtcGxhdGUgPSBjYXRhbG9nVGVtcGxhdGUoIHRlbXBsYXRlX2lkICk7XG5cdFx0dmFyICRob3N0ID0gJCggJ1tkYXRhLXdwYmMtYXBwb2ludG1lbnQtc2VydmljZXMtb3BlcmF0aW9uLWhvc3RdJyApO1xuXHRcdHZhciByZW5kZXJlZF9vcGVyYXRpb247XG5cdFx0dmFyIHRhcmdldDtcblxuXHRcdGlmICggISB0ZW1wbGF0ZSB8fCAhICRob3N0Lmxlbmd0aCB8fCAhIGluc3BlY3Rvcl93b3JrZmxvdyB8fCAhIGluc3BlY3Rvcl93b3JrZmxvdy5tb3VudCgpICkge1xuXHRcdFx0c3RhdGUub3BlcmF0aW9uX21vZGUgPSAnJztcblx0XHRcdHN0YXRlLm9wZXJhdGlvbl9yZXZpZXcgPSBudWxsO1xuXHRcdFx0dXBkYXRlQ29udHJvbHMoKTtcblx0XHRcdG5vdGlmeSggY29uZmlnLmkxOG4ub3BlcmF0aW9uX2ZhaWxlZCB8fCBjb25maWcuaTE4bi5sb2FkX2ZhaWxlZCwgJ2Vycm9yJyApO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRyZW5kZXJlZF9vcGVyYXRpb24gPSB0ZW1wbGF0ZSggdGVtcGxhdGVfZGF0YSApO1xuXHRcdH0gY2F0Y2ggKCBlcnJvciApIHtcblx0XHRcdHN0YXRlLm9wZXJhdGlvbl9tb2RlID0gJyc7XG5cdFx0XHRzdGF0ZS5vcGVyYXRpb25fcmV2aWV3ID0gbnVsbDtcblx0XHRcdCRob3N0LmVtcHR5KCkucHJvcCggJ2hpZGRlbicsIHRydWUgKTtcblx0XHRcdCQoICdbZGF0YS13cGJjLWFwcG9pbnRtZW50LXNlcnZpY2VzLW5hdGl2ZS1pbnNwZWN0b3JdJyApLnByb3AoICdoaWRkZW4nLCBmYWxzZSApO1xuXHRcdFx0dXBkYXRlQ29udHJvbHMoKTtcblx0XHRcdG5vdGlmeSggY29uZmlnLmkxOG4ub3BlcmF0aW9uX2ZhaWxlZCB8fCBjb25maWcuaTE4bi5sb2FkX2ZhaWxlZCwgJ2Vycm9yJyApO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHN0YXRlLm9wZXJhdGlvbl9tb2RlID0gbW9kZTtcblx0XHRzdGF0ZS5pbnNwZWN0b3JfZm9jdXNfdGFyZ2V0ID0gZm9jdXNfdGFyZ2V0IHx8IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG5cdFx0dGFyZ2V0ID0gaW5zcGVjdG9yX3dvcmtmbG93LmdldF9mb3JtX3RhcmdldCgpO1xuXHRcdGlmICggISB0YXJnZXQgKSB7XG5cdFx0XHRzdGF0ZS5vcGVyYXRpb25fbW9kZSA9ICcnO1xuXHRcdFx0c3RhdGUub3BlcmF0aW9uX3JldmlldyA9IG51bGw7XG5cdFx0XHRpbnNwZWN0b3Jfd29ya2Zsb3cuc2V0X3N0YXRlKCAnZXJyb3InLCBjb25maWcuaTE4bi5vcGVyYXRpb25fZmFpbGVkIHx8IGNvbmZpZy5pMThuLmxvYWRfZmFpbGVkICk7XG5cdFx0XHR1cGRhdGVDb250cm9scygpO1xuXHRcdFx0bm90aWZ5KCBjb25maWcuaTE4bi5vcGVyYXRpb25fZmFpbGVkIHx8IGNvbmZpZy5pMThuLmxvYWRfZmFpbGVkLCAnZXJyb3InICk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHRhcmdldC5pbm5lckhUTUwgPSByZW5kZXJlZF9vcGVyYXRpb247XG5cdFx0aW5zcGVjdG9yX3dvcmtmbG93LnNldF9zdGF0ZSggJ2Zvcm0nLCAnJyApO1xuXHRcdCRob3N0LnByb3AoICdoaWRkZW4nLCBmYWxzZSApO1xuXHRcdCQoICdbZGF0YS13cGJjLWFwcG9pbnRtZW50LXNlcnZpY2VzLW5hdGl2ZS1pbnNwZWN0b3JdJyApLnByb3AoICdoaWRkZW4nLCB0cnVlICk7XG5cdFx0ZXhwYW5kX3NlcnZpY2VfaW5zcGVjdG9yKCk7XG5cdFx0dXBkYXRlQ29udHJvbHMoKTtcblx0XHQkaG9zdC5maW5kKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWRlbGV0ZS1yZXZpZXctaGVhZGluZ10sIFtkYXRhLXdwYmMtdWktY2F0YWxvZy1pbmxpbmUtcmV2aWV3LWhlYWRpbmddLCBoMicgKS5maXJzdCgpLmF0dHIoICd0YWJpbmRleCcsICctMScgKS50cmlnZ2VyKCAnZm9jdXMnICk7XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHQvKipcblx0ICogT3BlbiBidWxrIGVkaXRpbmcgZm9yIHRoZSBjdXJyZW50IHBlcnNpc3RlbnQgU2VydmljZSBzZWxlY3Rpb24uXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGZvY3VzX3RhcmdldCBFbGVtZW50IHRoYXQgb3BlbmVkIHRoZSBidWxrIGluc3BlY3Rvci5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIG9wZW5fYnVsa19lZGl0KCBmb2N1c190YXJnZXQgKSB7XG5cdFx0dmFyIHNlbGVjdGVkX2lkcyA9IGdldF9zZWxlY3RlZF9zZXJ2aWNlX2lkcygpO1xuXG5cdFx0aWYgKCAhIHNlbGVjdGVkX2lkcy5sZW5ndGggfHwgc3RhdGUuYnVzeSB8fCBzdGF0ZS5pbmxpbmVfZWRpdGluZyApIHsgcmV0dXJuOyB9XG5cdFx0aWYgKCAhIGNhbl9yZXBsYWNlX2VkaXRvcigpICkgeyByZXR1cm47IH1cblx0XHRpZiAoIGVkaXRvcklzT3BlbigpICkgeyByZXNldF9zZXJ2aWNlX2VkaXRvcigpOyB9XG5cdFx0c2V0QnVzeSggdHJ1ZSApO1xuXHRcdHJlcXVlc3QoIGNvbmZpZy5hY3Rpb25zLmJ1bGtfY29udHJhY3QsIHsgaWRzOiBKU09OLnN0cmluZ2lmeSggc2VsZWN0ZWRfaWRzICkgfSApLmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHR2YXIgY29udHJhY3QgPSByZXNwb25zZSAmJiByZXNwb25zZS5zdWNjZXNzICYmIHJlc3BvbnNlLmRhdGEgPyByZXNwb25zZS5kYXRhLmNvbnRyYWN0IDogbnVsbDtcblxuXHRcdFx0aWYgKCAhIGNvbnRyYWN0IHx8ICEgQXJyYXkuaXNBcnJheSggY29udHJhY3QuZmllbGRzICkgfHwgISBjb250cmFjdC5maWVsZHMubGVuZ3RoICkge1xuXHRcdFx0XHRub3RpZnkoIG1lc3NhZ2VGcm9tKCByZXNwb25zZSwgY29uZmlnLmkxOG4uYnVsa19jb250cmFjdF9mYWlsZWQgKSwgJ2Vycm9yJyApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRvcGVuX29wZXJhdGlvbiggJ2J1bGtfZWRpdCcsICd3cGJjLWFwcG9pbnRtZW50LXNlcnZpY2VzLWJ1bGstZWRpdCcsIHtcblx0XHRcdFx0dGl0bGU6IGNvbmZpZy5pMThuLmJ1bGtfZWRpdF90aXRsZSxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGNvbnRyYWN0Lm1lc3NhZ2UgfHwgY29uZmlnLmkxOG4uYnVsa19lZGl0X2Rlc2NyaXB0aW9uLFxuXHRcdFx0XHRmaWVsZHM6IGNvbnRyYWN0LmZpZWxkc1xuXHRcdFx0fSwgZm9jdXNfdGFyZ2V0ICk7XG5cdFx0fSApLmZhaWwoIGZ1bmN0aW9uICggeGhyICkge1xuXHRcdFx0bm90aWZ5KCBtZXNzYWdlRnJvbSggeGhyLnJlc3BvbnNlSlNPTiwgY29uZmlnLmkxOG4uYnVsa19jb250cmFjdF9mYWlsZWQgKSwgJ2Vycm9yJyApO1xuXHRcdH0gKS5hbHdheXMoIGZ1bmN0aW9uICgpIHsgc2V0QnVzeSggZmFsc2UgKTsgfSApO1xuXHR9XG5cdC8qKlxuXHQgKiBSZW5kZXIgYSBzaWduZWQgaW5saW5lIG9yIGJ1bGsgcmV2aWV3IGluIHRoZSBTZXJ2aWNlIGluc3BlY3Rvci5cblx0ICpcblx0ICogVGhlIHByZXZpZXcgZW5kcG9pbnQgaXMgbm9uLW11dGF0aW5nLiBPbmx5IHRoZSByZXR1cm5lZCBzaWduZWQgcGxhbiBjYW4gYmVcblx0ICogc3VibWl0dGVkIHRvIHRoZSBzZXBhcmF0ZSBhcHBseSBlbmRwb2ludC5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9ICAgICAgbW9kZSAgICAgICAgIEVpdGhlciBpbmxpbmUgb3IgYnVsay5cblx0ICogQHBhcmFtIHtBcnJheTxudW1iZXI+fSBpZHMgICAgICAgIFNlcnZpY2UgaWRlbnRpZmllcnMgdG8gcmV2aWV3LlxuXHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBjaGFuZ2VzICAgICAgUm93LXNwZWNpZmljIG9yIHNoYXJlZCBmaWVsZCBjaGFuZ2VzLlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBmb2N1c190YXJnZXQgRWxlbWVudCB0aGF0IG9wZW5lZCB0aGUgcmV2aWV3LlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gcHJldmlld19vcGVyYXRpb24oIG1vZGUsIGlkcywgY2hhbmdlcywgZm9jdXNfdGFyZ2V0ICkge1xuXHRcdHZhciBpbnNwZWN0b3Jfd29ya2Zsb3c7XG5cdFx0dmFyIHJlcXVlc3Rfc2VxdWVuY2U7XG5cblx0XHRpZiAoIHN0YXRlLmJ1c3kgfHwgISBpZHMubGVuZ3RoIHx8ICEgY2hhbmdlcyApIHsgcmV0dXJuOyB9XG5cdFx0aW5zcGVjdG9yX3dvcmtmbG93ID0gZ2V0X29wZXJhdGlvbl9pbnNwZWN0b3Jfd29ya2Zsb3coKTtcblx0XHRyZXF1ZXN0X3NlcXVlbmNlID0gKytzdGF0ZS5vcGVyYXRpb25fcmVxdWVzdF9zZXF1ZW5jZTtcblx0XHRzdGF0ZS5vcGVyYXRpb25fbW9kZSA9ICdsb2FkaW5nJztcblx0XHRzdGF0ZS5vcGVyYXRpb25fcmV2aWV3ID0gbnVsbDtcblx0XHRzdGF0ZS5pbnNwZWN0b3JfZm9jdXNfdGFyZ2V0ID0gZm9jdXNfdGFyZ2V0IHx8IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG5cdFx0aWYgKCAhIGluc3BlY3Rvcl93b3JrZmxvdyB8fCAhIGluc3BlY3Rvcl93b3JrZmxvdy5vcGVuX2xvYWRpbmcoKSApIHtcblx0XHRcdHJlc2V0X29wZXJhdGlvbiggZmFsc2UgKTtcblx0XHRcdG5vdGlmeSggY29uZmlnLmkxOG4ub3BlcmF0aW9uX2ZhaWxlZCB8fCBjb25maWcuaTE4bi5wcmV2aWV3X2ZhaWxlZCwgJ2Vycm9yJyApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRzZXRCdXN5KCB0cnVlICk7XG5cdFx0cmVxdWVzdCggY29uZmlnLmFjdGlvbnMucHJldmlldywge1xuXHRcdFx0bW9kZTogbW9kZSxcblx0XHRcdGlkczogSlNPTi5zdHJpbmdpZnkoIGlkcyApLFxuXHRcdFx0Y2hhbmdlczogSlNPTi5zdHJpbmdpZnkoIGNoYW5nZXMgKVxuXHRcdH0sIGZhbHNlICkuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdHZhciByZXZpZXcgPSByZXNwb25zZSAmJiByZXNwb25zZS5zdWNjZXNzID8gcmVzcG9uc2UuZGF0YSA6IG51bGw7XG5cdFx0XHR2YXIgcmV2aWV3X3dvcmtmbG93ID0gZ2V0X2lubGluZV9yZXZpZXdfd29ya2Zsb3coKTtcblx0XHRcdHZhciByZXZpZXdfcm93cztcblx0XHRcdHZhciByZXZpZXdfbW9kZWw7XG5cdFx0XHR2YXIgdGVtcGxhdGVfaWQgPSAnaW5saW5lJyA9PT0gbW9kZSA/ICd3cGJjLWFwcG9pbnRtZW50LXNlcnZpY2VzLWlubGluZS1yZXZpZXcnIDogJ3dwYmMtYXBwb2ludG1lbnQtc2VydmljZXMtYnVsay1yZXZpZXcnO1xuXHRcdFx0aWYgKCByZXF1ZXN0X3NlcXVlbmNlICE9PSBzdGF0ZS5vcGVyYXRpb25fcmVxdWVzdF9zZXF1ZW5jZSApIHsgcmV0dXJuOyB9XG5cdFx0XHRpZiAoICEgcmV2aWV3IHx8ICEgcmV2aWV3LnBsYW4gfHwgISByZXZpZXcudG9rZW4gKSB7XG5cdFx0XHRcdHZhciBlcnJvcl9tZXNzYWdlID0gbWVzc2FnZUZyb20oIHJlc3BvbnNlLCBjb25maWcuaTE4bi5wcmV2aWV3X2ZhaWxlZCApO1xuXHRcdFx0XHRpbnNwZWN0b3Jfd29ya2Zsb3cuc2V0X3N0YXRlKCAnZXJyb3InLCBlcnJvcl9tZXNzYWdlICk7XG5cdFx0XHRcdG5vdGlmeSggZXJyb3JfbWVzc2FnZSwgJ2Vycm9yJyApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRzdGF0ZS5vcGVyYXRpb25fcmV2aWV3ID0gcmV2aWV3O1xuXHRcdFx0cmV2aWV3X3Jvd3MgPSByZXZpZXcucmV2aWV3ICYmIEFycmF5LmlzQXJyYXkoIHJldmlldy5yZXZpZXcucm93cyApID8gcmV2aWV3LnJldmlldy5yb3dzIDogW107XG5cdFx0XHRyZXZpZXdfbW9kZWwgPSByZXZpZXdfd29ya2Zsb3cgPyByZXZpZXdfd29ya2Zsb3cucHJlcGFyZSggcmV2aWV3LnJldmlldyB8fCB7fSwge1xuXHRcdFx0XHRjaGFuZ2VkX2xhYmVsOiBTdHJpbmcoIGNvbmZpZy5pMThuLmNoYW5nZWRfcm93cyB8fCAnJXMgY2hhbmdlZCByb3dzJyApLnJlcGxhY2UoICclcycsIFN0cmluZyggcmV2aWV3X3Jvd3MubGVuZ3RoICkgKSxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGNvbmZpZy5pMThuLnJldmlld19jb25maXJtYXRpb24gfHwgJycsXG5cdFx0XHRcdGZvcm1faWQ6ICd3cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzXycgKyBtb2RlICsgJ19yZXZpZXdfZm9ybScsXG5cdFx0XHRcdG1vZGU6IG1vZGUgKyAnX3JldmlldycsXG5cdFx0XHRcdHBlbmRpbmdfbWVzc2FnZTogY29uZmlnLmkxOG4ucmV2aWV3X2Rlc2NyaXB0aW9uIHx8ICcnLFxuXHRcdFx0XHR0aXRsZTogJ2lubGluZScgPT09IG1vZGUgPyBjb25maWcuaTE4bi5pbmxpbmVfcmV2aWV3X3RpdGxlIDogY29uZmlnLmkxOG4uYnVsa19yZXZpZXdfdGl0bGVcblx0XHRcdH0gKSA6IHt9O1xuXHRcdFx0aWYgKCAhIG9wZW5fb3BlcmF0aW9uKCBtb2RlICsgJ19yZXZpZXcnLCB0ZW1wbGF0ZV9pZCwgcmV2aWV3X21vZGVsLCBmb2N1c190YXJnZXQgKSApIHtcblx0XHRcdFx0aW5zcGVjdG9yX3dvcmtmbG93LnNldF9zdGF0ZSggJ2Vycm9yJywgY29uZmlnLmkxOG4ub3BlcmF0aW9uX2ZhaWxlZCB8fCBjb25maWcuaTE4bi5wcmV2aWV3X2ZhaWxlZCApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHJldmlld193b3JrZmxvdyApIHsgcmV2aWV3X3dvcmtmbG93LnN5bmNocm9uaXplKCB7IGJ1c3k6IGZhbHNlLCBjYW5fYXBwbHk6IHRydWUgfSApOyB9XG5cdFx0fSApLmZhaWwoIGZ1bmN0aW9uICggeGhyICkge1xuXHRcdFx0dmFyIGVycm9yX21lc3NhZ2UgPSBtZXNzYWdlRnJvbSggeGhyLnJlc3BvbnNlSlNPTiwgY29uZmlnLmkxOG4ucHJldmlld19mYWlsZWQgKTtcblx0XHRcdGlmICggcmVxdWVzdF9zZXF1ZW5jZSAhPT0gc3RhdGUub3BlcmF0aW9uX3JlcXVlc3Rfc2VxdWVuY2UgKSB7IHJldHVybjsgfVxuXHRcdFx0c3RhdGUub3BlcmF0aW9uX21vZGUgPSAnbG9hZGluZyc7XG5cdFx0XHRpbnNwZWN0b3Jfd29ya2Zsb3cuc2V0X3N0YXRlKCAnZXJyb3InLCBlcnJvcl9tZXNzYWdlICk7XG5cdFx0XHRub3RpZnkoIGVycm9yX21lc3NhZ2UsICdlcnJvcicgKTtcblx0XHR9ICkuYWx3YXlzKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRpZiAoIHJlcXVlc3Rfc2VxdWVuY2UgPT09IHN0YXRlLm9wZXJhdGlvbl9yZXF1ZXN0X3NlcXVlbmNlICkgeyBzZXRCdXN5KCBmYWxzZSApOyB9XG5cdFx0fSApO1xuXHR9XG5cdC8qKlxuXHQgKiBPcGVuIGEgbG9hZGluZyBpbnNwZWN0b3IgaW1tZWRpYXRlbHkgYW5kIHJlcXVlc3QgYSBzaWduZWQgZGVsZXRpb24gcmV2aWV3LlxuXHQgKlxuXHQgKiBAcGFyYW0ge0FycmF5PG51bWJlcj59IGlkcyAgICAgICAgICBTZWxlY3RlZCBTZXJ2aWNlIGlkZW50aWZpZXJzLlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSAgIGZvY3VzX3RhcmdldCBDb250cm9sIHRoYXQgb3BlbmVkIHRoZSByZXZpZXcuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBwcmV2aWV3X2RlbGV0aW9uKCBpZHMsIGZvY3VzX3RhcmdldCApIHtcblx0XHR2YXIgaW5zcGVjdG9yX3dvcmtmbG93O1xuXHRcdHZhciByZXF1ZXN0X3NlcXVlbmNlO1xuXG5cdFx0aWRzID0gQXJyYXkuaXNBcnJheSggaWRzICkgPyBpZHMubWFwKCBOdW1iZXIgKS5maWx0ZXIoIGZ1bmN0aW9uICggc2VydmljZV9pZCApIHsgcmV0dXJuIHNlcnZpY2VfaWQgPiAwOyB9ICkgOiBbXTtcblx0XHRpZiAoIHN0YXRlLmJ1c3kgfHwgISBpZHMubGVuZ3RoIHx8IHN0YXRlLmlubGluZV9lZGl0aW5nICkgeyByZXR1cm47IH1cblx0XHRpZiAoICEgY2FuX3JlcGxhY2VfZWRpdG9yKCkgKSB7IHJldHVybjsgfVxuXHRcdGlmICggZWRpdG9ySXNPcGVuKCkgKSB7IHJlc2V0X3NlcnZpY2VfZWRpdG9yKCk7IH1cblx0XHRpbnNwZWN0b3Jfd29ya2Zsb3cgPSBnZXRfb3BlcmF0aW9uX2luc3BlY3Rvcl93b3JrZmxvdygpO1xuXHRcdHJlcXVlc3Rfc2VxdWVuY2UgPSArK3N0YXRlLm9wZXJhdGlvbl9yZXF1ZXN0X3NlcXVlbmNlO1xuXHRcdHN0YXRlLm9wZXJhdGlvbl9tb2RlID0gJ2xvYWRpbmcnO1xuXHRcdHN0YXRlLm9wZXJhdGlvbl9yZXZpZXcgPSBudWxsO1xuXHRcdHN0YXRlLmluc3BlY3Rvcl9mb2N1c190YXJnZXQgPSBmb2N1c190YXJnZXQgfHwgZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcblx0XHRpZiAoICEgaW5zcGVjdG9yX3dvcmtmbG93IHx8ICEgaW5zcGVjdG9yX3dvcmtmbG93Lm9wZW5fbG9hZGluZygpICkge1xuXHRcdFx0cmVzZXRfb3BlcmF0aW9uKCBmYWxzZSApO1xuXHRcdFx0bm90aWZ5KCBjb25maWcuaTE4bi5vcGVyYXRpb25fZmFpbGVkIHx8IGNvbmZpZy5pMThuLmRlbGV0ZV9wcmV2aWV3X2ZhaWxlZCwgJ2Vycm9yJyApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRzZXRCdXN5KCB0cnVlICk7XG5cdFx0cmVxdWVzdCggY29uZmlnLmFjdGlvbnMuZGVsZXRlX3ByZXZpZXcsIHsgaWRzOiBKU09OLnN0cmluZ2lmeSggaWRzICkgfSwgZmFsc2UgKS5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0dmFyIHJldmlldyA9IHJlc3BvbnNlICYmIHJlc3BvbnNlLnN1Y2Nlc3MgPyByZXNwb25zZS5kYXRhIDogbnVsbDtcblx0XHRcdHZhciBkZWxldGVfcmV2aWV3ID0gcmV2aWV3ICYmIHJldmlldy5kZWxldGVfcmV2aWV3ID8gcmV2aWV3LmRlbGV0ZV9yZXZpZXcgOiB7fTtcblx0XHRcdHZhciBkZWxldGVfaTE4biA9IGRlbGV0ZV9yZXZpZXcuaTE4biB8fCB7fTtcblx0XHRcdHZhciBkZWxldGVfd29ya2Zsb3cgPSBnZXRfZGVsZXRlX3Jldmlld193b3JrZmxvdygpO1xuXHRcdFx0dmFyIHJldmlld19tb2RlbDtcblxuXHRcdFx0aWYgKCByZXF1ZXN0X3NlcXVlbmNlICE9PSBzdGF0ZS5vcGVyYXRpb25fcmVxdWVzdF9zZXF1ZW5jZSApIHsgcmV0dXJuOyB9XG5cdFx0XHRpZiAoICEgcmV2aWV3IHx8ICEgcmV2aWV3LnBsYW4gfHwgISByZXZpZXcudG9rZW4gKSB7XG5cdFx0XHRcdGluc3BlY3Rvcl93b3JrZmxvdy5zZXRfc3RhdGUoICdlcnJvcicsIG1lc3NhZ2VGcm9tKCByZXNwb25zZSwgY29uZmlnLmkxOG4uZGVsZXRlX3ByZXZpZXdfZmFpbGVkICkgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cmV2aWV3X21vZGVsID0ge1xuXHRcdFx0XHRhY2tub3dsZWRnZW1lbnQ6IFN0cmluZyggZGVsZXRlX2kxOG4uYWNrbm93bGVkZ2VtZW50IHx8ICcnICksXG5cdFx0XHRcdGFjdGlvbnNfaGVhZGluZzogU3RyaW5nKCBkZWxldGVfaTE4bi5hY3Rpb25zX2hlYWRpbmcgfHwgJycgKSxcblx0XHRcdFx0Y2FuX2FwcGx5OiB0cnVlID09PSByZXZpZXcuY2FuX2FwcGx5LFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogU3RyaW5nKCBkZWxldGVfaTE4bi5kZXNjcmlwdGlvbiB8fCAnJyApLFxuXHRcdFx0XHRpZF9sYWJlbDogU3RyaW5nKCBkZWxldGVfaTE4bi5pZF9sYWJlbCB8fCBjb25maWcuaTE4bi5jb2x1bW5faWQgfHwgJ0lEJyApLFxuXHRcdFx0XHRpdGVtczogQXJyYXkuaXNBcnJheSggZGVsZXRlX3Jldmlldy5pdGVtcyApID8gZGVsZXRlX3Jldmlldy5pdGVtcyA6IFtdLFxuXHRcdFx0XHRpdGVtc19oZWFkaW5nOiBTdHJpbmcoIGRlbGV0ZV9pMThuLml0ZW1zX2hlYWRpbmcgfHwgJycgKSxcblx0XHRcdFx0cGVuZGluZ19tZXNzYWdlOiBTdHJpbmcoIGRlbGV0ZV9pMThuLnBlbmRpbmdfbWVzc2FnZSB8fCAnJyApLFxuXHRcdFx0XHRzZWxlY3Rpb25fbGFiZWw6IFN0cmluZyggZGVsZXRlX2kxOG4uc2VsZWN0aW9uX2xhYmVsIHx8ICcnICksXG5cdFx0XHRcdHRpdGxlOiBTdHJpbmcoIGRlbGV0ZV9pMThuLnRpdGxlIHx8ICcnICksXG5cdFx0XHRcdHdhcm5pbmc6IFN0cmluZyggZGVsZXRlX3Jldmlldy53YXJuaW5nIHx8IHJldmlldy53YXJuaW5nIHx8ICcnIClcblx0XHRcdH07XG5cdFx0XHRzdGF0ZS5vcGVyYXRpb25fcmV2aWV3ID0gcmV2aWV3O1xuXHRcdFx0aWYgKCAhIG9wZW5fb3BlcmF0aW9uKCAnZGVsZXRlX3JldmlldycsICd3cGJjLWFwcG9pbnRtZW50LXNlcnZpY2VzLWRlbGV0ZS1yZXZpZXcnLCByZXZpZXdfbW9kZWwsIGZvY3VzX3RhcmdldCApICkge1xuXHRcdFx0XHRpbnNwZWN0b3Jfd29ya2Zsb3cuc2V0X3N0YXRlKCAnZXJyb3InLCBjb25maWcuaTE4bi5kZWxldGVfcHJldmlld19mYWlsZWQgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBkZWxldGVfd29ya2Zsb3cgKSB7XG5cdFx0XHRcdGRlbGV0ZV93b3JrZmxvdy5jb25maWd1cmVfZm9vdGVyKCB7XG5cdFx0XHRcdFx0Y2FuX2FwcGx5OiB0cnVlID09PSByZXZpZXcuY2FuX2FwcGx5LFxuXHRcdFx0XHRcdGZvb3RlcjogZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19yaWdodF9zaWRlYmFyX2Zvb3RlcicgKSxcblx0XHRcdFx0XHRmb3JtX2lkOiAnd3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19kZWxldGVfcmV2aWV3X2Zvcm0nLFxuXHRcdFx0XHRcdGxhYmVsOiBTdHJpbmcoIGRlbGV0ZV9pMThuLmRlbGV0ZV9idXR0b24gfHwgJycgKVxuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdGRlbGV0ZV93b3JrZmxvdy5zeW5jaHJvbml6ZSggeyBidXN5OiBmYWxzZSwgY2FuX2FwcGx5OiB0cnVlID09PSByZXZpZXcuY2FuX2FwcGx5IH0gKTtcblx0XHRcdFx0aWYgKCB0cnVlID09PSByZXZpZXcuY2FuX2FwcGx5ICkgeyBkZWxldGVfd29ya2Zsb3cucHVsc2VfYWNrbm93bGVkZ2VtZW50KCk7IH1cblx0XHRcdH1cblx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCB4aHIgKSB7XG5cdFx0XHR2YXIgZXJyb3JfbWVzc2FnZSA9IG1lc3NhZ2VGcm9tKCB4aHIucmVzcG9uc2VKU09OLCBjb25maWcuaTE4bi5kZWxldGVfcHJldmlld19mYWlsZWQgKTtcblx0XHRcdGlmICggcmVxdWVzdF9zZXF1ZW5jZSAhPT0gc3RhdGUub3BlcmF0aW9uX3JlcXVlc3Rfc2VxdWVuY2UgKSB7IHJldHVybjsgfVxuXHRcdFx0c3RhdGUub3BlcmF0aW9uX21vZGUgPSAnbG9hZGluZyc7XG5cdFx0XHRpbnNwZWN0b3Jfd29ya2Zsb3cuc2V0X3N0YXRlKCAnZXJyb3InLCBlcnJvcl9tZXNzYWdlICk7XG5cdFx0XHRub3RpZnkoIGVycm9yX21lc3NhZ2UsICdlcnJvcicgKTtcblx0XHR9ICkuYWx3YXlzKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRpZiAoIHJlcXVlc3Rfc2VxdWVuY2UgPT09IHN0YXRlLm9wZXJhdGlvbl9yZXF1ZXN0X3NlcXVlbmNlICkgeyBzZXRCdXN5KCBmYWxzZSApOyB9XG5cdFx0fSApO1xuXHR9XG5cdC8qKlxuXHQgKiBBcHBseSB0aGUgY3VycmVudCBzaWduZWQgU2VydmljZSByZXZpZXcsIHRoZW4gcmVmcmVzaCB0aGUgYWN0aXZlIHBhZ2UuXG5cdCAqXG5cdCAqIFNlbGVjdGlvbiByZW1haW5zIG93bmVkIGJ5IHRoZSBzaGFyZWQgY29udHJvbGxlciBhbmQgaXMgdGhlcmVmb3JlIHJlc3RvcmVkXG5cdCAqIGFmdGVyIHRoZSBBSkFYIHJlZnJlc2ggaW5zdGVhZCBvZiBiZWluZyBzaWxlbnRseSBjbGVhcmVkIGJ5IHRoZSBtdXRhdGlvbi5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGFwcGx5X29wZXJhdGlvbigpIHtcblx0XHR2YXIgcmV2aWV3ID0gc3RhdGUub3BlcmF0aW9uX3Jldmlldztcblx0XHR2YXIgY2hhbmdlZF9pZHM7XG5cdFx0dmFyIGlzX2RlbGV0ZSA9ICdkZWxldGVfcmV2aWV3JyA9PT0gc3RhdGUub3BlcmF0aW9uX21vZGU7XG5cdFx0dmFyIGFja25vd2xlZGdlbWVudDtcblxuXHRcdGlmICggc3RhdGUuYnVzeSB8fCAhIHJldmlldyB8fCAhIHJldmlldy5wbGFuIHx8ICEgcmV2aWV3LnRva2VuICkgeyByZXR1cm47IH1cblx0XHRpZiAoIGlzX2RlbGV0ZSApIHtcblx0XHRcdGFja25vd2xlZGdlbWVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctZGVsZXRlLWFja25vd2xlZGdlbWVudF0nICk7XG5cdFx0XHRpZiAoIHRydWUgIT09IHJldmlldy5jYW5fYXBwbHkgfHwgISBhY2tub3dsZWRnZW1lbnQgfHwgISBhY2tub3dsZWRnZW1lbnQuY2hlY2tlZCApIHtcblx0XHRcdFx0aWYgKCBnZXRfZGVsZXRlX3Jldmlld193b3JrZmxvdygpICkgeyBnZXRfZGVsZXRlX3Jldmlld193b3JrZmxvdygpLnB1bHNlX2Fja25vd2xlZGdlbWVudCgpOyB9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cdFx0c3RhdGUubXV0YXRpb25faW5fcHJvZ3Jlc3MgPSB0cnVlO1xuXHRcdHNldEJ1c3koIHRydWUgKTtcblx0XHRpZiAoIGlzX2RlbGV0ZSAmJiBnZXRfZGVsZXRlX3Jldmlld193b3JrZmxvdygpICkgeyBnZXRfZGVsZXRlX3Jldmlld193b3JrZmxvdygpLnN5bmNocm9uaXplKCB7IGJ1c3k6IHRydWUsIGNhbl9hcHBseTogdHJ1ZSB9ICk7IH1cblx0XHRlbHNlIGlmICggZ2V0X2lubGluZV9yZXZpZXdfd29ya2Zsb3coKSApIHsgZ2V0X2lubGluZV9yZXZpZXdfd29ya2Zsb3coKS5zeW5jaHJvbml6ZSggeyBidXN5OiB0cnVlLCBjYW5fYXBwbHk6IHRydWUgfSApOyB9XG5cdFx0cmVxdWVzdCggaXNfZGVsZXRlID8gY29uZmlnLmFjdGlvbnMuZGVsZXRlX2FwcGx5IDogY29uZmlnLmFjdGlvbnMuYXBwbHksIHsgYWNrbm93bGVkZ2VkOiBpc19kZWxldGUgPyAnMScgOiAnJywgcGxhbjogSlNPTi5zdHJpbmdpZnkoIHJldmlldy5wbGFuICksIHRva2VuOiByZXZpZXcudG9rZW4gfSApLmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRpZiAoICEgcmVzcG9uc2UgfHwgISByZXNwb25zZS5zdWNjZXNzICkge1xuXHRcdFx0XHRub3RpZnkoIG1lc3NhZ2VGcm9tKCByZXNwb25zZSwgaXNfZGVsZXRlID8gY29uZmlnLmkxOG4uZGVsZXRlX2FwcGx5X2ZhaWxlZCA6IGNvbmZpZy5pMThuLmFwcGx5X2ZhaWxlZCApLCAnZXJyb3InICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNoYW5nZWRfaWRzID0gcmVzcG9uc2UuZGF0YSAmJiBBcnJheS5pc0FycmF5KCByZXNwb25zZS5kYXRhLmNoYW5nZWRfaWRzICkgPyByZXNwb25zZS5kYXRhLmNoYW5nZWRfaWRzLm1hcCggU3RyaW5nICkgOiBbXTtcblx0XHRcdG5vdGlmeSggcmVzcG9uc2UuZGF0YS5tZXNzYWdlLCAnc3VjY2VzcycgKTtcblx0XHRcdHN0YXRlLm11dGF0aW9uX2luX3Byb2dyZXNzID0gZmFsc2U7XG5cdFx0XHRjbG9zZV9zZXJ2aWNlX2luc3BlY3RvciggZmFsc2UsIHRydWUgKTtcblx0XHRcdHBlbmRpbmdfaGlnaGxpZ2h0X2lkcyA9IGlzX2RlbGV0ZSA/IFtdIDogY2hhbmdlZF9pZHM7XG5cdFx0XHRpZiAoIGlzX2RlbGV0ZSAmJiBjYXRhbG9nQ29udHJvbGxlciAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgY2F0YWxvZ0NvbnRyb2xsZXIuY2xlYXJfc2VsZWN0aW9uICkgeyBjYXRhbG9nQ29udHJvbGxlci5jbGVhcl9zZWxlY3Rpb24oKTsgfVxuXHRcdFx0aWYgKCBjYXRhbG9nQ29udHJvbGxlciApIHsgY2F0YWxvZ0NvbnRyb2xsZXIubG9hZCggeyBwYWdlX251bWJlcjogc3RhdGUucGFnZSB9ICk7IH1cblx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCB4aHIgKSB7XG5cdFx0XHRub3RpZnkoIG1lc3NhZ2VGcm9tKCB4aHIucmVzcG9uc2VKU09OLCBpc19kZWxldGUgPyBjb25maWcuaTE4bi5kZWxldGVfYXBwbHlfZmFpbGVkIDogY29uZmlnLmkxOG4uYXBwbHlfZmFpbGVkICksICdlcnJvcicgKTtcblx0XHR9ICkuYWx3YXlzKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRzdGF0ZS5tdXRhdGlvbl9pbl9wcm9ncmVzcyA9IGZhbHNlO1xuXHRcdFx0c2V0QnVzeSggZmFsc2UgKTtcblx0XHRcdGlmICggaXNfZGVsZXRlICYmIGdldF9kZWxldGVfcmV2aWV3X3dvcmtmbG93KCkgKSB7IGdldF9kZWxldGVfcmV2aWV3X3dvcmtmbG93KCkuc3luY2hyb25pemUoIHsgYnVzeTogZmFsc2UsIGNhbl9hcHBseTogISEgc3RhdGUub3BlcmF0aW9uX3JldmlldyAmJiB0cnVlID09PSBzdGF0ZS5vcGVyYXRpb25fcmV2aWV3LmNhbl9hcHBseSB9ICk7IH1cblx0XHRcdGVsc2UgaWYgKCBnZXRfaW5saW5lX3Jldmlld193b3JrZmxvdygpICkgeyBnZXRfaW5saW5lX3Jldmlld193b3JrZmxvdygpLnN5bmNocm9uaXplKCB7IGJ1c3k6IGZhbHNlLCBjYW5fYXBwbHk6ICEhIHN0YXRlLm9wZXJhdGlvbl9yZXZpZXcgfSApOyB9XG5cdFx0fSApO1xuXHR9XG5cdC8qKlxuXHQgKiBIaWdobGlnaHQgU2VydmljZXMgY2hhbmdlZCBieSB0aGUgbGFzdCByZXZpZXdlZCBtdXRhdGlvbi5cblx0ICpcblx0ICogVGhlIGlkZW50aWZpZXJzIGFyZSByZXRhaW5lZCB1bnRpbCB0aGUgcmVmcmVzaGVkIGNhdGFsb2cgY29udGFpbnMgYXQgbGVhc3Rcblx0ICogb25lIGFmZmVjdGVkIFNlcnZpY2UuIFRoaXMgYXZvaWRzIGNvbnN1bWluZyB0aGUgaGlnaGxpZ2h0IHdoaWxlIGNsb3NpbmcgYW5cblx0ICogb3BlcmF0aW9uIHJlLXJlbmRlcnMgdGhlIHByZXZpb3VzIHJlc3BvbnNlLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gYXBwbHlfcGVuZGluZ19oaWdobGlnaHRzKCkge1xuXHRcdHZhciBmaXJzdF9zZXJ2aWNlID0gbnVsbDtcblxuXHRcdHBlbmRpbmdfaGlnaGxpZ2h0X2lkcy5mb3JFYWNoKCBmdW5jdGlvbiAoIHNlcnZpY2VfaWQgKSB7XG5cdFx0XHR2YXIgc2VydmljZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19faXRlbVtkYXRhLXNlcnZpY2UtaWQ9XCInICsgc2VydmljZV9pZCArICdcIl0nICk7XG5cblx0XHRcdGlmICggc2VydmljZSApIHtcblx0XHRcdFx0c2VydmljZS5jbGFzc0xpc3QuYWRkKCAnaXMtcmVjZW50bHktc2F2ZWQnICk7XG5cdFx0XHRcdGZpcnN0X3NlcnZpY2UgPSBmaXJzdF9zZXJ2aWNlIHx8IHNlcnZpY2U7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHRcdGlmICggISBmaXJzdF9zZXJ2aWNlICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRmaXJzdF9zZXJ2aWNlLnNjcm9sbEludG9WaWV3KCB7IGJsb2NrOiAnbmVhcmVzdCcsIGJlaGF2aW9yOiAnc21vb3RoJyB9ICk7XG5cdFx0d2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19faXRlbS5pcy1yZWNlbnRseS1zYXZlZCcgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHNlcnZpY2UgKSB7XG5cdFx0XHRcdHNlcnZpY2UuY2xhc3NMaXN0LnJlbW92ZSggJ2lzLXJlY2VudGx5LXNhdmVkJyApO1xuXHRcdFx0fSApO1xuXHRcdH0sIDUwMDAgKTtcblx0XHRwZW5kaW5nX2hpZ2hsaWdodF9pZHMgPSBbXTtcblx0fVxuXHQvKiogUmV0dXJuIHRoZSBjdXJyZW50IG9yZGVyZWQgYW5kIHZpc2libGUgU2VydmljZSBjb2x1bW4gZGVmaW5pdGlvbnMuICovXG5cdGZ1bmN0aW9uIHJlc3BvbnNlQ29sdW1ucyggcmVzcG9uc2UgKSB7XG5cdFx0dmFyIGRlZmluaXRpb25zID0gY29uZmlnLmNhdGFsb2cgJiYgY29uZmlnLmNhdGFsb2cuY29sdW1ucyA/IGNvbmZpZy5jYXRhbG9nLmNvbHVtbnMuZGVmaW5pdGlvbnMgfHwge30gOiB7fTtcblx0XHR2YXIgdmlzaWJsZSA9IHJlc3BvbnNlLmRpc3BsYXkgJiYgcmVzcG9uc2UuZGlzcGxheS52aXNpYmxlX2NvbHVtbnMgPyByZXNwb25zZS5kaXNwbGF5LnZpc2libGVfY29sdW1ucyA6IFtdO1xuXHRcdHZhciBvcmRlciA9IHJlc3BvbnNlLmRpc3BsYXkgJiYgcmVzcG9uc2UuZGlzcGxheS5jb2x1bW5fb3JkZXIgPyByZXNwb25zZS5kaXNwbGF5LmNvbHVtbl9vcmRlciA6IFtdO1xuXHRcdHJldHVybiAkLm1hcCggb3JkZXIsIGZ1bmN0aW9uICggY29sdW1uSWQgKSB7XG5cdFx0XHR2YXIgZGVmaW5pdGlvbiA9IGRlZmluaXRpb25zWyBjb2x1bW5JZCBdO1xuXHRcdFx0dmFyIGlzX3NvcnRlZDtcblx0XHRcdGlmICggISBkZWZpbml0aW9uIHx8IC0xID09PSB2aXNpYmxlLmluZGV4T2YoIGNvbHVtbklkICkgKSB7IHJldHVybiBudWxsOyB9XG5cdFx0XHRpc19zb3J0ZWQgPSAhISBkZWZpbml0aW9uLnNvcnRfa2V5ICYmIGRlZmluaXRpb24uc29ydF9rZXkgPT09IHJlc3BvbnNlLnNvcnRpbmcuc29ydF9ieTtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGFyaWFfc29ydDogaXNfc29ydGVkID8gKCAnZGVzYycgPT09IHJlc3BvbnNlLnNvcnRpbmcuc29ydF9vcmRlciA/ICdkZXNjZW5kaW5nJyA6ICdhc2NlbmRpbmcnICkgOiAnbm9uZScsXG5cdFx0XHRcdGlkOiBjb2x1bW5JZCxcblx0XHRcdFx0bGFiZWw6IGRlZmluaXRpb24ubGFiZWwgfHwgY29sdW1uSWQsXG5cdFx0XHRcdGNsYXNzX25hbWU6IGRlZmluaXRpb24uY2xhc3MgfHwgJ2NvbHVtbi0nICsgY29sdW1uSWQsXG5cdFx0XHRcdGlzX3NvcnRlZDogaXNfc29ydGVkLFxuXHRcdFx0XHRzb3J0X2ljb246IGlzX3NvcnRlZCA/ICggJ2Rlc2MnID09PSByZXNwb25zZS5zb3J0aW5nLnNvcnRfb3JkZXIgPyAnd3BiYy1iaS1hcnJvdy1kb3duJyA6ICd3cGJjLWJpLWFycm93LXVwJyApIDogJ3dwYmNfaWNuX2ltcG9ydF9leHBvcnQnLFxuXHRcdFx0XHRzb3J0X2tleTogZGVmaW5pdGlvbi5zb3J0X2tleSB8fCAnJ1xuXHRcdFx0fTtcblx0XHR9ICk7XG5cdH1cblx0LyoqXG5cdCAqIFJldHVybiBzb3J0YWJsZSBwcmVzZW50YXRpb24gcmVjb3JkcyBmb3IgdGhlIGNhcmRzIGxheW91dCBoZWFkZXIuXG5cdCAqXG5cdCAqIFRoZSB0YWJsZSBjb21iaW5lcyBTdGF0dXMgYW5kIFNlcnZpY2UgSUQgaW4gb25lIGNvbHVtbiwgc28gY2FyZHMgZXhwYW5kXG5cdCAqIHRoYXQgY29sdW1uIGludG8gdHdvIGluZGVwZW5kZW50IHNvcnQgY29udHJvbHMgd2l0aG91dCBjaGFuZ2luZyB0aGUgRFRPLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gcmVzcG9uc2UgTm9ybWFsaXplZCBzaGFyZWQgY2F0YWxvZyByZXNwb25zZS5cblx0ICogQHJldHVybiB7QXJyYXk8T2JqZWN0Pn0gVmlzaWJsZSwgYWxsb3ctbGlzdGVkIGNhcmRzIHNvcnRpbmcgcmVjb3Jkcy5cblx0ICovXG5cdGZ1bmN0aW9uIHJlc3BvbnNlU29ydENvbHVtbnMoIHJlc3BvbnNlICkge1xuXHRcdHZhciBjb2x1bW5zID0gW107XG5cdFx0JC5lYWNoKCByZXNwb25zZUNvbHVtbnMoIHJlc3BvbnNlICksIGZ1bmN0aW9uICggY29sdW1uSW5kZXgsIGNvbHVtbiApIHtcblx0XHRcdGlmICggJ3N0YXR1cycgPT09IGNvbHVtbi5pZCApIHtcblx0XHRcdFx0Y29sdW1ucy5wdXNoKCB7XG5cdFx0XHRcdFx0aXNfc29ydGVkOiAnc3RhdHVzJyA9PT0gcmVzcG9uc2Uuc29ydGluZy5zb3J0X2J5LFxuXHRcdFx0XHRcdGxhYmVsOiBjb2x1bW4ubGFiZWwsXG5cdFx0XHRcdFx0c29ydF9pY29uOiAnc3RhdHVzJyA9PT0gcmVzcG9uc2Uuc29ydGluZy5zb3J0X2J5ID8gKCAnZGVzYycgPT09IHJlc3BvbnNlLnNvcnRpbmcuc29ydF9vcmRlciA/ICd3cGJjLWJpLWFycm93LWRvd24nIDogJ3dwYmMtYmktYXJyb3ctdXAnICkgOiAnd3BiY19pY25faW1wb3J0X2V4cG9ydCcsXG5cdFx0XHRcdFx0c29ydF9rZXk6ICdzdGF0dXMnXG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0Y29sdW1ucy5wdXNoKCB7XG5cdFx0XHRcdFx0aXNfc29ydGVkOiAnc2VydmljZV9pZCcgPT09IHJlc3BvbnNlLnNvcnRpbmcuc29ydF9ieSxcblx0XHRcdFx0XHRsYWJlbDogY29uZmlnLmkxOG4uY29sdW1uX2lkIHx8ICdJRCcsXG5cdFx0XHRcdFx0c29ydF9pY29uOiAnc2VydmljZV9pZCcgPT09IHJlc3BvbnNlLnNvcnRpbmcuc29ydF9ieSA/ICggJ2Rlc2MnID09PSByZXNwb25zZS5zb3J0aW5nLnNvcnRfb3JkZXIgPyAnd3BiYy1iaS1hcnJvdy1kb3duJyA6ICd3cGJjLWJpLWFycm93LXVwJyApIDogJ3dwYmNfaWNuX2ltcG9ydF9leHBvcnQnLFxuXHRcdFx0XHRcdHNvcnRfa2V5OiAnc2VydmljZV9pZCdcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgY29sdW1uLnNvcnRfa2V5ICkgeyByZXR1cm47IH1cblx0XHRcdGNvbHVtbnMucHVzaCgge1xuXHRcdFx0XHRpc19zb3J0ZWQ6IGNvbHVtbi5zb3J0X2tleSA9PT0gcmVzcG9uc2Uuc29ydGluZy5zb3J0X2J5LFxuXHRcdFx0XHRsYWJlbDogY29sdW1uLmxhYmVsLFxuXHRcdFx0XHRzb3J0X2ljb246IGNvbHVtbi5zb3J0X2tleSA9PT0gcmVzcG9uc2Uuc29ydGluZy5zb3J0X2J5ID8gKCAnZGVzYycgPT09IHJlc3BvbnNlLnNvcnRpbmcuc29ydF9vcmRlciA/ICd3cGJjLWJpLWFycm93LWRvd24nIDogJ3dwYmMtYmktYXJyb3ctdXAnICkgOiAnd3BiY19pY25faW1wb3J0X2V4cG9ydCcsXG5cdFx0XHRcdHNvcnRfa2V5OiBjb2x1bW4uc29ydF9rZXlcblx0XHRcdH0gKTtcblx0XHR9ICk7XG5cdFx0cmV0dXJuIGNvbHVtbnM7XG5cdH1cblx0LyoqXG5cdCAqIEJ1aWxkIHByZXNlbnRhdGlvbiBjZWxscyBmb3IgdGhlIFNlcnZpY2Utb3duZWQgcm93IGFuZCBjYXJkIHRlbXBsYXRlcy5cblx0ICpcblx0ICogSW5saW5lIGRyYWZ0cyByZXBsYWNlIG9ubHkgdGhlIGFsbG93LWxpc3RlZCBlZGl0YWJsZSBjb250cm9scy4gUHJvdmlkZXIsXG5cdCAqIGF2YWlsYWJpbGl0eSwgc3RhdHVzLCBhbmQgYWN0aW9uIHByZXNlbnRhdGlvbiBzdGF5cyByZWFkLW9ubHkuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBzZXJ2aWNlIE5vcm1hbGl6ZWQgU2VydmljZSBEVE8uXG5cdCAqIEByZXR1cm4ge09iamVjdH0gRXNjYXBlZCBIVE1MIGZyYWdtZW50cyBrZXllZCBieSBjYXRhbG9nIGNvbHVtbiBJRC5cblx0ICovXG5cdGZ1bmN0aW9uIHNlcnZpY2VDZWxscyggc2VydmljZSApIHtcblx0XHR2YXIgaWQgPSBOdW1iZXIoIHNlcnZpY2Uuc2VydmljZV9pZCB8fCBzZXJ2aWNlLmlkIHx8IDAgKTtcblx0XHR2YXIgZHJhZnQgPSBzdGF0ZS5pbmxpbmVfZWRpdGluZyA/IHN0YXRlLmlubGluZV9kcmFmdHNbIFN0cmluZyggaWQgKSBdIDogbnVsbDtcblx0XHR2YXIgcm93X3NjaGVtYSA9IGRyYWZ0ID8gZmluZF9pbmxpbmVfc2NoZW1hKCBpZCApIDogbnVsbDtcblx0XHR2YXIgaW5saW5lX2ZpZWxkX3RlbXBsYXRlID0gY2F0YWxvZ1RlbXBsYXRlKCAnd3BiYy1hcHBvaW50bWVudC1zZXJ2aWNlLWlubGluZS1maWVsZCcgKTtcblx0XHR2YXIgaW5saW5lX2NlbGxzID0ge307XG5cdFx0dmFyIHRpdGxlID0gc2VydmljZS50aXRsZSB8fCBjb25maWcuaTE4bi51bnRpdGxlZCB8fCAnVW50aXRsZWQgU2VydmljZSc7XG5cdFx0dmFyIGRlc2NyaXB0aW9uID0gU3RyaW5nKCBzZXJ2aWNlLmRlc2NyaXB0aW9uIHx8ICcjJyArIGlkICk7XG5cdFx0dmFyIHN0YXR1cyA9IFN0cmluZyggc2VydmljZS5zdGF0dXMgfHwgJ2FjdGl2ZScgKTtcblx0XHR2YXIgJGlkZW50aXR5ID0gJCggJzxkaXY+JywgeyAnY2xhc3MnOiAnd3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fc2VydmljZV9pZGVudGl0eScgfSApO1xuXHRcdHZhciBpZGVudGl0eV9maWVsZHNfY2xhc3MgPSBkcmFmdFxuXHRcdFx0PyAnd3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19faW5saW5lX2lkZW50aXR5X2ZpZWxkcydcblx0XHRcdDogJ3dwYmNfdWlfbGlzdGluZ19faXRlbV9jb3B5IHdwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX3NlcnZpY2VfY29weSc7XG5cdFx0dmFyICRjb3B5ID0gJCggJzxzcGFuPicsIHsgJ2NsYXNzJzogaWRlbnRpdHlfZmllbGRzX2NsYXNzIH0gKS5hcHBlbmRUbyggJGlkZW50aXR5ICk7XG5cdFx0dmFyICRhdmFpbGFiaWxpdHkgPSAkKCAnPGRpdj4nICk7XG5cdFx0dmFyICRhdmFpbGFiaWxpdHlXZWVrID0gJCggJzxkaXY+JywgeyAnY2xhc3MnOiAnd3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fYXZhaWxhYmlsaXR5X3dlZWsnIH0gKS5hcHBlbmRUbyggJGF2YWlsYWJpbGl0eSApO1xuXHRcdHZhciBoYXNXZWVrbHlBdmFpbGFiaWxpdHkgPSBmYWxzZTtcblx0XHR2YXIgc3RhdHVzVGVtcGxhdGUgPSBjYXRhbG9nVGVtcGxhdGUoICd3cGJjLWFwcG9pbnRtZW50LXNlcnZpY2Utc3RhdHVzLWxhYmVsJyApO1xuXHRcdHZhciBwcm92aWRlclRlbXBsYXRlID0gY2F0YWxvZ1RlbXBsYXRlKCAnd3BiYy1hcHBvaW50bWVudC1zZXJ2aWNlLXByb3ZpZGVyLWxhYmVscycgKTtcblx0XHR2YXIgJGFjdGlvbnMgPSAkKCAnPGRpdj4nLCB7ICdjbGFzcyc6ICd3cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19hY3Rpb25zJyB9ICk7XG5cdFx0aWYgKCByb3dfc2NoZW1hICYmIGlubGluZV9maWVsZF90ZW1wbGF0ZSApIHtcblx0XHRcdCQuZWFjaCggcm93X3NjaGVtYS5maWVsZHMgfHwgW10sIGZ1bmN0aW9uICggZmllbGRfaW5kZXgsIGZpZWxkICkge1xuXHRcdFx0XHR2YXIgY29sdW1uX2lkID0gU3RyaW5nKCBmaWVsZC5jb2x1bW4gfHwgJycgKTtcblx0XHRcdFx0dmFyIGZpZWxkX2tleSA9IFN0cmluZyggZmllbGQua2V5IHx8ICcnICk7XG5cdFx0XHRcdHZhciBmaWVsZF9kYXRhO1xuXHRcdFx0XHRpZiAoICEgY29sdW1uX2lkIHx8ICEgZmllbGRfa2V5IHx8ICEgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBkcmFmdCwgZmllbGRfa2V5ICkgKSB7IHJldHVybjsgfVxuXHRcdFx0XHRmaWVsZF9kYXRhID0gJC5leHRlbmQoIHt9LCBmaWVsZCwgeyBvcmlnaW5hbF92YWx1ZTogZmllbGQudmFsdWUsIHZhbHVlOiBkcmFmdFsgZmllbGRfa2V5IF0gfSApO1xuXHRcdFx0XHRpbmxpbmVfY2VsbHNbIGNvbHVtbl9pZCBdID0gKCBpbmxpbmVfY2VsbHNbIGNvbHVtbl9pZCBdIHx8ICcnICkgKyBpbmxpbmVfZmllbGRfdGVtcGxhdGUoIHsgZmllbGQ6IGZpZWxkX2RhdGEsIHNlcnZpY2VfaWQ6IGlkIH0gKTtcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHRzZXJ2aWNlVGh1bWJuYWlsTm9kZSggc2VydmljZSApLnByZXBlbmRUbyggJGlkZW50aXR5ICk7XG5cdFx0aWYgKCBkcmFmdCAmJiBpbmxpbmVfY2VsbHMuc2VydmljZSApIHtcblx0XHRcdCRjb3B5LmFwcGVuZCggaW5saW5lX2NlbGxzLnNlcnZpY2UgKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0JCggJzxzdHJvbmc+JywgeyAnY2xhc3MnOiAnd3BiY191aV9saXN0aW5nX19pdGVtX3RpdGxlIHdwYmNfdWlfbGlzdGluZ19fb3ZlcmZsb3dfdG9vbHRpcCcsICdkYXRhLXdwYmMtdWktY2F0YWxvZy1vdmVyZmxvdy10b29sdGlwJzogdGl0bGUsIHRpdGxlOiB0aXRsZSwgdGV4dDogdGl0bGUgfSApLmFwcGVuZFRvKCAkY29weSApO1xuXHRcdFx0JCggJzxzcGFuPicsIHsgJ2NsYXNzJzogJ3dwYmNfdWlfbGlzdGluZ19faXRlbV9kZXNjcmlwdGlvbiB3cGJjX3VpX2xpc3RpbmdfX292ZXJmbG93X3Rvb2x0aXAnLCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctb3ZlcmZsb3ctdG9vbHRpcCc6IGRlc2NyaXB0aW9uLCB0aXRsZTogZGVzY3JpcHRpb24sIHRleHQ6IGRlc2NyaXB0aW9uIH0gKS5hcHBlbmRUbyggJGNvcHkgKTtcblx0XHR9XG5cdFx0JC5lYWNoKCB3ZWVrZGF5S2V5cywgZnVuY3Rpb24gKCBkYXlJbmRleCwgZGF5ICkge1xuXHRcdFx0dmFyIGF2YWlsYWJsZVByb3ZpZGVycyA9IHByb3ZpZGVyc19hdmFpbGFibGVfb24oIHNlcnZpY2UsIGRheSApO1xuXHRcdFx0dmFyIGF2YWlsYWJsZSA9IGF2YWlsYWJsZVByb3ZpZGVycy5sZW5ndGggPiAwO1xuXHRcdFx0dmFyIGRheVRpdGxlID0gY29uZmlnLndlZWtkYXlzICYmIGNvbmZpZy53ZWVrZGF5c1sgZGF5SW5kZXggXSA/IGNvbmZpZy53ZWVrZGF5c1sgZGF5SW5kZXggXSA6IGRheTtcblx0XHRcdHZhciBwcm92aWRlclRpdGxlcyA9ICQubWFwKCBhdmFpbGFibGVQcm92aWRlcnMsIGZ1bmN0aW9uICggcHJvdmlkZXIgKSB7IHJldHVybiBwcm92aWRlci50aXRsZSB8fCAnJzsgfSApLmZpbHRlciggZnVuY3Rpb24gKCBwcm92aWRlclRpdGxlICkgeyByZXR1cm4gISEgcHJvdmlkZXJUaXRsZTsgfSApO1xuXHRcdFx0dmFyIGF2YWlsYWJpbGl0eVRpdGxlID0gYXZhaWxhYmxlXG5cdFx0XHRcdD8gU3RyaW5nKCBjb25maWcuaTE4bi5hdmFpbGFibGVfcHJvdmlkZXJzIHx8ICdBdmFpbGFibGUgUHJvdmlkZXJzOiAlcycgKS5yZXBsYWNlKCAnJXMnLCBwcm92aWRlclRpdGxlcy5qb2luKCAnLCAnICkgKVxuXHRcdFx0XHQ6ICggY29uZmlnLmkxOG4ubm9fYXZhaWxhYmxlX3Byb3ZpZGVycyB8fCAnTm8gYXNzaWduZWQgUHJvdmlkZXJzIGFyZSBhdmFpbGFibGUnICk7XG5cdFx0XHRpZiAoIGF2YWlsYWJsZSApIHsgaGFzV2Vla2x5QXZhaWxhYmlsaXR5ID0gdHJ1ZTsgfVxuXHRcdFx0JCggJzxzcGFuPicsIHsgJ2NsYXNzJzogJ3dwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX2F2YWlsYWJpbGl0eScgKyAoIGF2YWlsYWJsZSA/ICcgaXMtYXZhaWxhYmxlJyA6ICcnICksIHRpdGxlOiBkYXlUaXRsZSArICc6ICcgKyBhdmFpbGFiaWxpdHlUaXRsZSwgJ2FyaWEtbGFiZWwnOiBkYXlUaXRsZSArICc6ICcgKyBhdmFpbGFiaWxpdHlUaXRsZSB9ICkuYXBwZW5kVG8oICRhdmFpbGFiaWxpdHlXZWVrICk7XG5cdFx0fSApO1xuXHRcdCRhdmFpbGFiaWxpdHkuYXBwZW5kKCBhdmFpbGFiaWxpdHlfZWRpdF9saW5rcyggc2VydmljZSApICk7XG5cdFx0aWYgKCBzZXJ2aWNlLnJlc291cmNlX2lkcyAmJiBzZXJ2aWNlLnJlc291cmNlX2lkcy5sZW5ndGggJiYgISBoYXNXZWVrbHlBdmFpbGFiaWxpdHkgKSB7XG5cdFx0XHQkKCAnPHNwYW4+JywgeyAnY2xhc3MnOiAnd3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fYXZhaWxhYmlsaXR5X2VtcHR5JywgdGV4dDogY29uZmlnLmkxOG4ubm9fYXZhaWxhYmlsaXR5IHx8ICdObyB3ZWVrbHkgYXZhaWxhYmlsaXR5JyB9ICkuYXBwZW5kVG8oICRhdmFpbGFiaWxpdHkgKTtcblx0XHR9XG5cdFx0JCggJzxidXR0b24+JywgeyB0eXBlOiAnYnV0dG9uJywgJ2NsYXNzJzogJ2J1dHRvbi1saW5rIHdwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX3Jvd19lZGl0IHdwYmNfaWNuX2VkaXQnLCAnZGF0YS1zZXJ2aWNlLWlkJzogaWQsIHRpdGxlOiBjb25maWcuaTE4bi5lZGl0IHx8ICdFZGl0IFNlcnZpY2UnLCAnYXJpYS1sYWJlbCc6IGNvbmZpZy5pMThuLmVkaXQgfHwgJ0VkaXQgU2VydmljZScgfSApLmFwcGVuZFRvKCAkYWN0aW9ucyApO1xuXHRcdGlmICggc2VydmljZS5hY3Rpb25zICYmIHNlcnZpY2UuYWN0aW9ucy5hcmNoaXZlICkge1xuXHRcdFx0JCggJzxidXR0b24+JywgeyB0eXBlOiAnYnV0dG9uJywgJ2NsYXNzJzogJ2J1dHRvbi1saW5rIHdwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX3Jvd19hcmNoaXZlIHdwYmNfaWNuX29wZW5faW5fYnJvd3NlciB3cGJjX2ljbl9yb3RhdGVfMTgwJywgJ2RhdGEtc2VydmljZS1pZCc6IGlkLCB0aXRsZTogY29uZmlnLmkxOG4uYXJjaGl2ZSB8fCAnQXJjaGl2ZSBTZXJ2aWNlJywgJ2FyaWEtbGFiZWwnOiBjb25maWcuaTE4bi5hcmNoaXZlIHx8ICdBcmNoaXZlIFNlcnZpY2UnIH0gKS5hcHBlbmRUbyggJGFjdGlvbnMgKTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0c2VydmljZTogbm9kZUh0bWwoICRpZGVudGl0eSApLFxuXHRcdFx0ZHVyYXRpb246IGRyYWZ0ICYmIGlubGluZV9jZWxscy5kdXJhdGlvbiA/IGlubGluZV9jZWxscy5kdXJhdGlvbiA6IG5vZGVIdG1sKCBzZXJ2aWNlX2R1cmF0aW9uX25vZGUoIHNlcnZpY2UgKSApLFxuXHRcdFx0cHJpY2U6IGRyYWZ0ICYmIGlubGluZV9jZWxscy5wcmljZSA/IGlubGluZV9jZWxscy5wcmljZSA6IG5vZGVIdG1sKCAkKCAnPHNwYW4+JywgeyB0ZXh0OiBmb3JtYXRDb3N0KCBzZXJ2aWNlLmJhc2VfY29zdCApIH0gKSApLFxuXHRcdFx0cHJvdmlkZXJzOiBwcm92aWRlclRlbXBsYXRlID8gcHJvdmlkZXJUZW1wbGF0ZSggeyBwcm92aWRlcnM6IHNlcnZpY2UucHJvdmlkZXJzIHx8IFtdLCBtYXhfdmlzaWJsZTogMywgZW1wdHlfbGFiZWw6IGNvbmZpZy5pMThuLm5vX3Byb3ZpZGVyIHx8ICdObyBQcm92aWRlcnMgYXNzaWduZWQnLCBtb3JlX2xhYmVsOiBjb25maWcuaTE4bi5tb3JlX3Byb3ZpZGVycyB8fCAnbW9yZSBQcm92aWRlcnMnIH0gKSA6IG5vZGVIdG1sKCBwcm92aWRlck5vZGVzKCBzZXJ2aWNlICkgKSxcblx0XHRcdGF2YWlsYWJpbGl0eTogbm9kZUh0bWwoICRhdmFpbGFiaWxpdHkgKSxcblx0XHRcdHN0YXR1czogKCBzdGF0dXNUZW1wbGF0ZSA/IHN0YXR1c1RlbXBsYXRlKCB7IHN0YXR1czogc3RhdHVzLCBsYWJlbDogc3RhdHVzTGFiZWwoIHN0YXR1cyApIH0gKSA6ICcnICkgKyBub2RlSHRtbCggJCggJzxzcGFuPicsIHsgJ2NsYXNzJzogJ3dwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX2lkJywgdGV4dDogKCBjb25maWcuaTE4bi5jb2x1bW5faWQgfHwgJ0lEJyApICsgJzogJyArIGlkIH0gKSApLFxuXHRcdFx0YWN0aW9uczogbm9kZUh0bWwoICRhY3Rpb25zIClcblx0XHR9O1xuXHR9XG5cdC8qKlxuXHQgKiBSZW5kZXIgYSBub3JtYWxpemVkIGNhdGFsb2cgcmVzcG9uc2UgdGhyb3VnaCBTZXJ2aWNlLW93bmVkIFdQIHRlbXBsYXRlcy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IHJlc3BvbnNlIE5vcm1hbGl6ZWQgc2hhcmVkLWNhdGFsb2cgcmVzcG9uc2UuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiByZW5kZXJDYXRhbG9nUmVzcG9uc2UoIHJlc3BvbnNlICkge1xuXHRcdGlmICggISByZXNwb25zZSApIHsgcmV0dXJuOyB9XG5cdFx0dmFyIGNvbHVtbnMgPSByZXNwb25zZUNvbHVtbnMoIHJlc3BvbnNlICk7XG5cdFx0dmFyIHJvd1RlbXBsYXRlID0gY2F0YWxvZ1RlbXBsYXRlKCAnd3BiYy1hcHBvaW50bWVudC1zZXJ2aWNlLXJvdycgKTtcblx0XHR2YXIgY2FyZFRlbXBsYXRlID0gY2F0YWxvZ1RlbXBsYXRlKCAnd3BiYy1hcHBvaW50bWVudC1zZXJ2aWNlLWNhcmQnICk7XG5cdFx0dmFyIGhlYWRlclRlbXBsYXRlID0gY2F0YWxvZ1RlbXBsYXRlKCAnd3BiYy1hcHBvaW50bWVudC1zZXJ2aWNlcy1oZWFkZXInICk7XG5cdFx0dmFyIGNhcmRzSGVhZGVyVGVtcGxhdGUgPSBjYXRhbG9nVGVtcGxhdGUoICd3cGJjLWFwcG9pbnRtZW50LXNlcnZpY2VzLWNhcmRzLWhlYWRlcicgKTtcblx0XHR2YXIgcGFnaW5hdGlvblRlbXBsYXRlID0gY2F0YWxvZ1RlbXBsYXRlKCAnd3BiYy1hcHBvaW50bWVudC1zZXJ2aWNlcy1wYWdpbmF0aW9uJyApO1xuXHRcdHZhciBpc0NhcmRzID0gJ2NhcmRzJyA9PT0gcmVzcG9uc2UuZGlzcGxheS50ZW1wbGF0ZV9wYWNrO1xuXHRcdHZhciAkcm93SG9zdCA9ICQoICdbZGF0YS13cGJjLWFwcG9pbnRtZW50LXNlcnZpY2VzLXJvd3NdJyApO1xuXHRcdHZhciAkY2FyZEhvc3QgPSAkKCAnW2RhdGEtd3BiYy1hcHBvaW50bWVudC1zZXJ2aWNlcy1jYXJkc10nICk7XG5cdFx0dmFyIHBhZ2luYXRpb24gPSByZXNwb25zZS5wYWdpbmF0aW9uIHx8IHt9O1xuXHRcdHZhciByZW5kZXJlZEl0ZW1zID0gW107XG5cblx0XHRkZXN0cm95X3NlcnZpY2VfdGh1bWJuYWlsX3Rvb2x0aXBzKCk7XG5cdFx0c3RhdGUubGFzdF9yZXNwb25zZSA9IHJlc3BvbnNlO1xuXHRcdHN0YXRlLnNlcnZpY2VzID0gcmVzcG9uc2UuaXRlbXMgfHwgW107XG5cdFx0c3RhdGUucGFnZSA9IE51bWJlciggcGFnaW5hdGlvbi5wYWdlX251bWJlciB8fCAxICk7XG5cdFx0c3RhdGUucGFnZV9zaXplID0gTnVtYmVyKCBwYWdpbmF0aW9uLml0ZW1zX3Blcl9wYWdlIHx8IHN0YXRlLnBhZ2Vfc2l6ZSApO1xuXHRcdHN0YXRlLnRvdGFsX2l0ZW1zID0gTnVtYmVyKCBwYWdpbmF0aW9uLnRvdGFsX2l0ZW1zIHx8IDAgKTtcblx0XHRzdGF0ZS50b3RhbF9wYWdlcyA9IE51bWJlciggcGFnaW5hdGlvbi50b3RhbF9wYWdlcyB8fCAwICk7XG5cdFx0c3RhdGUuc29ydF9ieSA9IFN0cmluZyggcmVzcG9uc2Uuc29ydGluZy5zb3J0X2J5IHx8IHN0YXRlLnNvcnRfYnkgKTtcblx0XHRzdGF0ZS5zb3J0X29yZGVyID0gU3RyaW5nKCByZXNwb25zZS5zb3J0aW5nLnNvcnRfb3JkZXIgfHwgc3RhdGUuc29ydF9vcmRlciApO1xuXG5cdFx0aWYgKCBoZWFkZXJUZW1wbGF0ZSAmJiAkcm93SG9zdC5sZW5ndGggKSB7XG5cdFx0XHQkKCAnW2RhdGEtd3BiYy1hcHBvaW50bWVudC1zZXJ2aWNlcy1oZWFkZXJdJyApLmh0bWwoIGhlYWRlclRlbXBsYXRlKCB7IGNvbHVtbnM6IGNvbHVtbnMsIGlkX2xhYmVsOiBjb25maWcuaTE4bi5jb2x1bW5faWQgfHwgJ0lEJywgc29ydF9ieTogc3RhdGUuc29ydF9ieSwgc29ydF9vcmRlcjogc3RhdGUuc29ydF9vcmRlciwgc2VsZWN0X2FsbF9sYWJlbDogY29uZmlnLmkxOG4uc2VsZWN0X2FsbCB9ICkgKTtcblx0XHR9XG5cdFx0aWYgKCBjYXJkc0hlYWRlclRlbXBsYXRlICYmICRjYXJkSG9zdC5sZW5ndGggKSB7XG5cdFx0XHQkKCAnW2RhdGEtd3BiYy1hcHBvaW50bWVudC1zZXJ2aWNlcy1jYXJkcy1oZWFkZXJdJyApLmh0bWwoIGNhcmRzSGVhZGVyVGVtcGxhdGUoIHsgY29sdW1uczogcmVzcG9uc2VTb3J0Q29sdW1ucyggcmVzcG9uc2UgKSwgaTE4bjogY29uZmlnLmNhdGFsb2cuaTE4biB8fCB7fSwgc2VsZWN0X2FsbF9sYWJlbDogY29uZmlnLmkxOG4uc2VsZWN0X2FsbCB9ICkgKTtcblx0XHR9XG5cdFx0JC5lYWNoKCBzdGF0ZS5zZXJ2aWNlcywgZnVuY3Rpb24gKCBpbmRleCwgc2VydmljZSApIHtcblx0XHRcdHZhciB0ZW1wbGF0ZSA9IGlzQ2FyZHMgPyBjYXJkVGVtcGxhdGUgOiByb3dUZW1wbGF0ZTtcblx0XHRcdGlmICggdGVtcGxhdGUgKSB7XG5cdFx0XHRcdHZhciBzZXJ2aWNlX2lkID0gTnVtYmVyKCBzZXJ2aWNlLnNlcnZpY2VfaWQgfHwgc2VydmljZS5pZCB8fCAwICk7XG5cdFx0XHRcdHJlbmRlcmVkSXRlbXMucHVzaCggdGVtcGxhdGUoIHtcblx0XHRcdFx0XHRzZXJ2aWNlX2lkOiBzZXJ2aWNlX2lkLFxuXHRcdFx0XHRcdGlzX2luc3BlY3Rvcl9zZWxlY3RlZDogc2VydmljZV9pZCA9PT0gc3RhdGUuc2VsZWN0ZWRJZCxcblx0XHRcdFx0XHRzZWxlY3RfbGFiZWw6IFN0cmluZyggY29uZmlnLmkxOG4uc2VsZWN0X3NlcnZpY2UgfHwgJ1NlbGVjdCAlcycgKS5yZXBsYWNlKCAnJXMnLCBzZXJ2aWNlLnRpdGxlIHx8IGNvbmZpZy5pMThuLnVudGl0bGVkICksXG5cdFx0XHRcdFx0cGljdHVyZV91cmw6IFN0cmluZyggc2VydmljZS5waWN0dXJlX3VybCB8fCAnJyApLFxuXHRcdFx0XHRcdGNvbHVtbnM6IGNvbHVtbnMsXG5cdFx0XHRcdFx0Y2VsbHM6IHNlcnZpY2VDZWxscyggc2VydmljZSApXG5cdFx0XHRcdH0gKSApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0XHQoIGlzQ2FyZHMgPyAkY2FyZEhvc3QgOiAkcm93SG9zdCApLmh0bWwoIHJlbmRlcmVkSXRlbXMuam9pbiggJycgKSApO1xuXHRcdGlmICggcGFnaW5hdGlvblRlbXBsYXRlICkge1xuXHRcdFx0JCggJ1tkYXRhLXdwYmMtYXBwb2ludG1lbnQtc2VydmljZXMtcGFnaW5hdGlvbl0nICkuaHRtbCggcGFnaW5hdGlvblRlbXBsYXRlKCB7XG5cdFx0XHRcdHJlc3VsdHNfc3RhdHVzOiBzaG93aW5nVGV4dCggcGFnaW5hdGlvbi5pdGVtc19mcm9tIHx8IDAsIHBhZ2luYXRpb24uaXRlbXNfdG8gfHwgMCwgcGFnaW5hdGlvbi50b3RhbF9pdGVtcyB8fCAwICksXG5cdFx0XHRcdHNob3dfbGFiZWw6IGNvbmZpZy5jYXRhbG9nLmkxOG4uc2hvd19sYWJlbCxcblx0XHRcdFx0cGVyX3BhZ2VfbGFiZWw6IGNvbmZpZy5jYXRhbG9nLmkxOG4ucGVyX3BhZ2VfbGFiZWwsXG5cdFx0XHRcdGl0ZW1zX3Blcl9wYWdlX29wdGlvbnM6IGNvbmZpZy5jYXRhbG9nLml0ZW1zX3Blcl9wYWdlLm9wdGlvbnMgfHwgW10sXG5cdFx0XHRcdGl0ZW1zX3Blcl9wYWdlOiBzdGF0ZS5wYWdlX3NpemUsXG5cdFx0XHRcdGFyaWFfbGFiZWw6IGNvbmZpZy5jYXRhbG9nLmkxOG4ucGFnaW5hdGlvbl9sYWJlbCxcblx0XHRcdFx0cGFnZV9udW1iZXJfbGFiZWw6IGNvbmZpZy5jYXRhbG9nLmkxOG4ucGFnZV9udW1iZXIsXG5cdFx0XHRcdHBhZ2VfbnVtYmVyOiBzdGF0ZS5wYWdlLFxuXHRcdFx0XHR0b3RhbF9wYWdlczogTWF0aC5tYXgoIDEsIHN0YXRlLnRvdGFsX3BhZ2VzICksXG5cdFx0XHRcdHByZXZpb3VzX3BhZ2U6IE1hdGgubWF4KCAxLCBzdGF0ZS5wYWdlIC0gMSApLFxuXHRcdFx0XHRuZXh0X3BhZ2U6IE1hdGgubWluKCBNYXRoLm1heCggMSwgc3RhdGUudG90YWxfcGFnZXMgKSwgc3RhdGUucGFnZSArIDEgKSxcblx0XHRcdFx0cHJldmlvdXNfbGFiZWw6IGNvbmZpZy5jYXRhbG9nLmkxOG4ucHJldmlvdXNfcGFnZSxcblx0XHRcdFx0bmV4dF9sYWJlbDogY29uZmlnLmNhdGFsb2cuaTE4bi5uZXh0X3BhZ2UsXG5cdFx0XHRcdGhhc19wcmV2aW91czogc3RhdGUucGFnZSA+IDEsXG5cdFx0XHRcdGhhc19uZXh0OiBzdGF0ZS50b3RhbF9wYWdlcyA+IDAgJiYgc3RhdGUucGFnZSA8IHN0YXRlLnRvdGFsX3BhZ2VzXG5cdFx0XHR9ICkgKTtcblx0XHR9XG5cdFx0cmVmcmVzaF9zZXJ2aWNlX3RodW1ibmFpbF90b29sdGlwcygpO1xuXHRcdGlmICggY2F0YWxvZ0NvbnRyb2xsZXIgKSB7IGNhdGFsb2dDb250cm9sbGVyLnJlZnJlc2hfY29udHJvbHMoKTsgY2F0YWxvZ0NvbnRyb2xsZXIuc3luY190YWJsZV9taW5fd2lkdGgoKTsgfVxuXHRcdHZhciBzZWxlY3Rpb24gPSBnZXRfc2VsZWN0aW9uX2NvbnRyb2xsZXIoKTtcblx0XHRpZiAoIHNlbGVjdGlvbiAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygc2VsZWN0aW9uLnN5bmNocm9uaXplICkge1xuXHRcdFx0c2VsZWN0aW9uLnN5bmNocm9uaXplKCk7XG5cdFx0fVxuXHRcdGFwcGx5X3BlbmRpbmdfaGlnaGxpZ2h0cygpO1xuXHRcdGlmICggc3RhdGUuaW5saW5lX2VkaXRpbmcgKSB7IHJlbmRlcl9pbmxpbmVfYmFyKCk7IH1cblx0fVxuXHQvKiogTG9hZCBvbmUgU2VydmljZSBhbmQgb3BlbiBpdCBpbiB0aGUgcmlnaHQgaW5zcGVjdG9yLiAqL1xuXHRmdW5jdGlvbiBsb2FkT25lKCBzZXJ2aWNlSWQsIGZvY3VzX3RhcmdldCApIHtcblx0XHR2YXIgcmVxdWVzdF9zZXF1ZW5jZTtcblxuXHRcdGlmICggISBzZXJ2aWNlSWQgfHwgc3RhdGUuYnVzeSApIHsgcmV0dXJuOyB9XG5cdFx0aWYgKCBlZGl0b3JJc09wZW4oKSAmJiBzdGF0ZS5zZWxlY3RlZElkID09PSBzZXJ2aWNlSWQgKSB7IGV4cGFuZF9zZXJ2aWNlX2luc3BlY3RvcigpOyBmb2N1c19yZXF1ZXN0ZWRfc2VydmljZV9zZWN0aW9uKCk7IHJldHVybjsgfVxuXHRcdGlmICggISBjYW5fcmVwbGFjZV9lZGl0b3IoKSApIHsgcmV0dXJuOyB9XG5cdFx0c3RhdGUuaW5zcGVjdG9yX2ZvY3VzX3RhcmdldCA9IGZvY3VzX3RhcmdldCB8fCBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuXHRcdHJlcXVlc3Rfc2VxdWVuY2UgPSArK3N0YXRlLmVkaXRvcl9yZXF1ZXN0X3NlcXVlbmNlO1xuXHRcdHNldEJ1c3koIHRydWUgKTtcblx0XHRyZXF1ZXN0KCBjb25maWcuYWN0aW9ucy5sb2FkLCB7IHNlcnZpY2VfaWQ6IHNlcnZpY2VJZCB9ICkuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdGlmICggcmVxdWVzdF9zZXF1ZW5jZSAhPT0gc3RhdGUuZWRpdG9yX3JlcXVlc3Rfc2VxdWVuY2UgKSB7IHJldHVybjsgfVxuXHRcdFx0aWYgKCByZXNwb25zZSAmJiByZXNwb25zZS5zdWNjZXNzICYmIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5zZXJ2aWNlICkgeyBmaWxsRWRpdG9yKCByZXNwb25zZS5kYXRhLnNlcnZpY2UgKTsgdXBkYXRlVXJsKCBzdGF0ZS5zZWxlY3RlZElkICk7IGV4cGFuZF9zZXJ2aWNlX2luc3BlY3RvcigpOyBmb2N1c19yZXF1ZXN0ZWRfc2VydmljZV9zZWN0aW9uKCk7IHJldHVybjsgfVxuXHRcdFx0bm90aWZ5KCBtZXNzYWdlRnJvbSggcmVzcG9uc2UsIGNvbmZpZy5pMThuLmxvYWRfZmFpbGVkICksICdlcnJvcicgKTtcblx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCB4aHIgKSB7XG5cdFx0XHRpZiAoIHJlcXVlc3Rfc2VxdWVuY2UgPT09IHN0YXRlLmVkaXRvcl9yZXF1ZXN0X3NlcXVlbmNlICkgeyBub3RpZnkoIG1lc3NhZ2VGcm9tKCB4aHIucmVzcG9uc2VKU09OLCBjb25maWcuaTE4bi5sb2FkX2ZhaWxlZCApLCAnZXJyb3InICk7IH1cblx0XHR9ICkuYWx3YXlzKCBmdW5jdGlvbiAoKSB7IHNldEJ1c3koIGZhbHNlICk7IH0gKTtcblx0fVxuXHQvKipcblx0ICogUmVsb2FkIFNlcnZpY2VzIGFuZCBQcm92aWRlciBwcmVzZW50YXRpb24gZGF0YSBmb3IgdGhlIGFjdGl2ZSBmaWx0ZXJzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IHNhdmVfcHJlZmVyZW5jZXMgV2hldGhlciB0byBwZXJzaXN0IHRoZSBhY3RpdmUgU2VydmljZSBmaWx0ZXJzLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gbG9hZExpc3QoIHNhdmVfcHJlZmVyZW5jZXMgKSB7XG5cdFx0dmFyIHJlcXVlc3REYXRhID0ge1xuXHRcdFx0c2VhcmNoOiAkKCAnI3dwYmNfc2VydmljZV9zZWFyY2gnICkudmFsKCkgfHwgJycsXG5cdFx0XHRzdGF0dXM6IHN0YXRlLnN0YXR1cyxcblx0XHRcdHJlc291cmNlX2lkOiAkKCAnI3dwYmNfc2VydmljZV9wcm92aWRlcl9maWx0ZXInICkudmFsKCkgfHwgMCxcblx0XHRcdHBhZ2VfbnVtYmVyOiAxXG5cdFx0fTtcblx0XHRpZiAoIHNhdmVfcHJlZmVyZW5jZXMgKSB7IHJlcXVlc3REYXRhLnByZWZlcmVuY2VfYWN0aW9uID0gJ3NhdmUnOyB9XG5cdFx0cmV0dXJuIGNhdGFsb2dDb250cm9sbGVyID8gY2F0YWxvZ0NvbnRyb2xsZXIubG9hZCggcmVxdWVzdERhdGEgKSA6IFByb21pc2UucmVzb2x2ZSggZmFsc2UgKTtcblx0fVxuXHQvKipcblx0ICogS2VlcCB0aGUgU2VydmljZSBzZWFyY2ggY2xlYXIgY29udHJvbCBzeW5jaHJvbml6ZWQgd2l0aCB0aGUgc2VhcmNoIHZhbHVlLlxuXHQgKlxuXHQgKiBUaGUgU2VydmljZSBmaWx0ZXJzIGxpdmUgb3V0c2lkZSB0aGUgc2hhcmVkIGNhdGFsb2cgbW91bnQsIHNvIHRoaXMgc21hbGxcblx0ICogYWRhcHRlciBtaXJyb3JzIHRoZSBzaGFyZWQgY2F0YWxvZyBjbGVhci1idXR0b24gdmlzaWJpbGl0eSBjb250cmFjdC5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHN5bmNfc2VhcmNoX2NsZWFyX2J1dHRvbigpIHtcblx0XHR2YXIgc2VhcmNoX3ZhbHVlID0gU3RyaW5nKCAkKCAnI3dwYmNfc2VydmljZV9zZWFyY2gnICkudmFsKCkgfHwgJycgKTtcblxuXHRcdCQoICdbZGF0YS13cGJjLWFwcG9pbnRtZW50LXNlcnZpY2VzLXNlYXJjaC1jbGVhcl0nICkucHJvcCggJ2hpZGRlbicsICEgc2VhcmNoX3ZhbHVlICk7XG5cdH1cblx0LyoqIEFyY2hpdmUgb25lIFNlcnZpY2UgYWZ0ZXIgY29uZmlybWF0aW9uLCB0aGVuIHJlZnJlc2ggdGhlIGxpc3QuICovXG5cdGZ1bmN0aW9uIGFyY2hpdmVTZXJ2aWNlKCBzZXJ2aWNlSWQgKSB7XG5cdFx0aWYgKCAhIHNlcnZpY2VJZCB8fCBzdGF0ZS5idXN5IHx8ICEgdy5jb25maXJtKCBjb25maWcuaTE4bi5jb25maXJtX2FyY2hpdmUgfHwgJ0FyY2hpdmUgdGhpcyBTZXJ2aWNlPycgKSApIHsgcmV0dXJuOyB9XG5cdFx0c3RhdGUubXV0YXRpb25faW5fcHJvZ3Jlc3MgPSB0cnVlO1xuXHRcdHNldEJ1c3koIHRydWUgKTtcblx0XHRyZXF1ZXN0KCBjb25maWcuYWN0aW9ucy5hcmNoaXZlLCB7IHNlcnZpY2VfaWQ6IHNlcnZpY2VJZCB9ICkuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdGlmICggcmVzcG9uc2UgJiYgcmVzcG9uc2Uuc3VjY2VzcyApIHtcblx0XHRcdFx0aWYgKCBzdGF0ZS5zZWxlY3RlZElkID09PSBzZXJ2aWNlSWQgKSB7IHN0YXRlLnNlbGVjdGVkSWQgPSAwOyBzZXRGaWVsZHNFbmFibGVkKCBmYWxzZSApOyB1cGRhdGVVcmwoIDAgKTsgfVxuXHRcdFx0XHRub3RpZnkoIHJlc3BvbnNlLmRhdGEubWVzc2FnZSwgJ3N1Y2Nlc3MnICk7IGxvYWRMaXN0KCk7IHJldHVybjtcblx0XHRcdH1cblx0XHRcdG5vdGlmeSggbWVzc2FnZUZyb20oIHJlc3BvbnNlLCBjb25maWcuaTE4bi5hcmNoaXZlX2ZhaWxlZCApLCAnZXJyb3InICk7XG5cdFx0fSApLmZhaWwoIGZ1bmN0aW9uICggeGhyICkgeyBub3RpZnkoIG1lc3NhZ2VGcm9tKCB4aHIucmVzcG9uc2VKU09OLCBjb25maWcuaTE4bi5hcmNoaXZlX2ZhaWxlZCApLCAnZXJyb3InICk7IH0gKS5hbHdheXMoIGZ1bmN0aW9uICgpIHsgc3RhdGUubXV0YXRpb25faW5fcHJvZ3Jlc3MgPSBmYWxzZTsgc2V0QnVzeSggZmFsc2UgKTsgfSApO1xuXHR9XG5cblx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19yaWdodGJhcl90YWJzIFtyb2xlPVwidGFiXCJdJywgZnVuY3Rpb24gKCBldmVudCApIHsgZXZlbnQucHJldmVudERlZmF1bHQoKTsgc3dpdGNoUmlnaHRQYW5lbCggJCggdGhpcyApICk7IH0gKTtcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19yaWdodGJhciAud3BiY191aV9fY29sbGFwc2libGVfZ3JvdXAgPiAuZ3JvdXBfX2hlYWRlcicsIGZ1bmN0aW9uICggZXZlbnQgKSB7IGV2ZW50LnByZXZlbnREZWZhdWx0KCk7IHRvZ2dsZUluc3BlY3Rvckdyb3VwKCAkKCB0aGlzICkgKTsgfSApO1xuXHQkKCBkb2N1bWVudCApLm9uKCAnY2xpY2snLCAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX2l0ZW0nLCBmdW5jdGlvbiAoIGV2ZW50ICkgeyBpZiAoICEgc3RhdGUuaW5saW5lX2VkaXRpbmcgJiYgISAkKCBldmVudC50YXJnZXQgKS5jbG9zZXN0KCAnYnV0dG9uLCBhLCBpbnB1dCwgc2VsZWN0LCB0ZXh0YXJlYSwgbGFiZWwnICkubGVuZ3RoICkgeyBsb2FkT25lKCBOdW1iZXIoICQoIHRoaXMgKS5kYXRhKCAnc2VydmljZS1pZCcgKSB8fCAwICksIHRoaXMgKTsgfSB9ICk7XG5cdCQoIGRvY3VtZW50ICkub24oICdrZXlkb3duJywgJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19pdGVtJywgZnVuY3Rpb24gKCBldmVudCApIHsgaWYgKCAhIHN0YXRlLmlubGluZV9lZGl0aW5nICYmICEgJCggZXZlbnQudGFyZ2V0ICkuY2xvc2VzdCggJ2J1dHRvbiwgYSwgaW5wdXQsIHNlbGVjdCwgdGV4dGFyZWEsIGxhYmVsJyApLmxlbmd0aCAmJiAoICdFbnRlcicgPT09IGV2ZW50LmtleSB8fCAnICcgPT09IGV2ZW50LmtleSApICkgeyBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyBsb2FkT25lKCBOdW1iZXIoICQoIHRoaXMgKS5kYXRhKCAnc2VydmljZS1pZCcgKSB8fCAwICksIHRoaXMgKTsgfSB9ICk7XG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fcm93X2VkaXQnLCBmdW5jdGlvbiAoKSB7IGxvYWRPbmUoIE51bWJlciggJCggdGhpcyApLmRhdGEoICdzZXJ2aWNlLWlkJyApIHx8IDAgKSwgdGhpcyApOyB9ICk7XG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fcm93X2FyY2hpdmUnLCBmdW5jdGlvbiAoKSB7IGFyY2hpdmVTZXJ2aWNlKCBOdW1iZXIoICQoIHRoaXMgKS5kYXRhKCAnc2VydmljZS1pZCcgKSB8fCAwICkgKTsgfSApO1xuXHQkKCBkb2N1bWVudCApLm9uKCAnY2xpY2snLCAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX3N0YXR1c19maWx0ZXInLCBmdW5jdGlvbiAoKSB7XG5cdFx0c3RhdGUuc3RhdHVzID0gU3RyaW5nKCAkKCB0aGlzICkuZGF0YSggJ3NlcnZpY2Utc3RhdHVzJyApIHx8ICdhbGwnICk7XG5cdFx0c3RhdGUucGFnZSA9IDE7XG5cdFx0JCggJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19zdGF0dXNfZmlsdGVyJyApLnJlbW92ZUNsYXNzKCAnaXMtYWN0aXZlJyApLmF0dHIoICdhcmlhLXByZXNzZWQnLCAnZmFsc2UnICk7XG5cdFx0JCggdGhpcyApLmFkZENsYXNzKCAnaXMtYWN0aXZlJyApLmF0dHIoICdhcmlhLXByZXNzZWQnLCAndHJ1ZScgKTtcblx0XHRsb2FkTGlzdCggdHJ1ZSApO1xuXHR9ICk7XG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fYWRkJywgZnVuY3Rpb24gKCkge1xuXHRcdGlmICggISBzdGF0ZS5zdG9yYWdlUmVhZHkgfHwgc3RhdGUuYnVzeSB8fCAhIGNhbl9yZXBsYWNlX2VkaXRvcigpICkgeyByZXR1cm47IH1cblx0XHRzdGF0ZS5pbnNwZWN0b3JfZm9jdXNfdGFyZ2V0ID0gdGhpcztcblx0XHRmaWxsRWRpdG9yKCBibGFua1NlcnZpY2UoKSApO1xuXHRcdHVwZGF0ZVVybCggMCApO1xuXHRcdG9wZW5fYWRkX3NlcnZpY2VfaW5zcGVjdG9yKCk7XG5cdH0gKTtcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJ1tkYXRhLXdwYmMtYXBwb2ludG1lbnQtc2VydmljZXMtY2FuY2VsXScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRjbG9zZV9zZXJ2aWNlX2luc3BlY3RvciggdHJ1ZSwgdHJ1ZSApO1xuXHR9ICk7XG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fc2F2ZScsIGZ1bmN0aW9uICgpIHtcblx0XHRpZiAoICEgc3RhdGUuc3RvcmFnZVJlYWR5IHx8IHN0YXRlLmJ1c3kgKSB7IHJldHVybjsgfVxuXHRcdHN0YXRlLm11dGF0aW9uX2luX3Byb2dyZXNzID0gdHJ1ZTtcblx0XHRzZXRCdXN5KCB0cnVlICk7XG5cdFx0cmVxdWVzdCggY29uZmlnLmFjdGlvbnMuc2F2ZSwgeyBzZXJ2aWNlOiBjb2xsZWN0RWRpdG9yKCkgfSApLmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRpZiAoIHJlc3BvbnNlICYmIHJlc3BvbnNlLnN1Y2Nlc3MgJiYgcmVzcG9uc2UuZGF0YSAmJiByZXNwb25zZS5kYXRhLnNlcnZpY2UgKSB7IGZpbGxFZGl0b3IoIHJlc3BvbnNlLmRhdGEuc2VydmljZSApOyB1cGRhdGVVcmwoIHN0YXRlLnNlbGVjdGVkSWQgKTsgbm90aWZ5KCByZXNwb25zZS5kYXRhLm1lc3NhZ2UsICdzdWNjZXNzJyApOyBsb2FkTGlzdCgpOyByZXR1cm47IH1cblx0XHRcdG5vdGlmeSggbWVzc2FnZUZyb20oIHJlc3BvbnNlLCBjb25maWcuaTE4bi5zYXZlX2ZhaWxlZCApLCAnZXJyb3InICk7XG5cdFx0fSApLmZhaWwoIGZ1bmN0aW9uICggeGhyICkgeyBub3RpZnkoIG1lc3NhZ2VGcm9tKCB4aHIucmVzcG9uc2VKU09OLCBjb25maWcuaTE4bi5zYXZlX2ZhaWxlZCApLCAnZXJyb3InICk7IH0gKS5hbHdheXMoIGZ1bmN0aW9uICgpIHsgc3RhdGUubXV0YXRpb25faW5fcHJvZ3Jlc3MgPSBmYWxzZTsgc2V0QnVzeSggZmFsc2UgKTsgfSApO1xuXHR9ICk7XG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fZHVwbGljYXRlJywgZnVuY3Rpb24gKCkge1xuXHRcdGlmICggISBzdGF0ZS5zZWxlY3RlZElkIHx8IHN0YXRlLmJ1c3kgKSB7IHJldHVybjsgfVxuXHRcdHN0YXRlLm11dGF0aW9uX2luX3Byb2dyZXNzID0gdHJ1ZTtcblx0XHRzZXRCdXN5KCB0cnVlICk7XG5cdFx0cmVxdWVzdCggY29uZmlnLmFjdGlvbnMuZHVwbGljYXRlLCB7IHNlcnZpY2VfaWQ6IHN0YXRlLnNlbGVjdGVkSWQgfSApLmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRpZiAoIHJlc3BvbnNlICYmIHJlc3BvbnNlLnN1Y2Nlc3MgJiYgcmVzcG9uc2UuZGF0YSAmJiByZXNwb25zZS5kYXRhLnNlcnZpY2UgKSB7IGZpbGxFZGl0b3IoIHJlc3BvbnNlLmRhdGEuc2VydmljZSApOyB1cGRhdGVVcmwoIHN0YXRlLnNlbGVjdGVkSWQgKTsgbm90aWZ5KCByZXNwb25zZS5kYXRhLm1lc3NhZ2UsICdzdWNjZXNzJyApOyBsb2FkTGlzdCgpOyByZXR1cm47IH1cblx0XHRcdG5vdGlmeSggbWVzc2FnZUZyb20oIHJlc3BvbnNlLCBjb25maWcuaTE4bi5kdXBsaWNhdGVfZmFpbGVkICksICdlcnJvcicgKTtcblx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCB4aHIgKSB7IG5vdGlmeSggbWVzc2FnZUZyb20oIHhoci5yZXNwb25zZUpTT04sIGNvbmZpZy5pMThuLmR1cGxpY2F0ZV9mYWlsZWQgKSwgJ2Vycm9yJyApOyB9ICkuYWx3YXlzKCBmdW5jdGlvbiAoKSB7IHN0YXRlLm11dGF0aW9uX2luX3Byb2dyZXNzID0gZmFsc2U7IHNldEJ1c3koIGZhbHNlICk7IH0gKTtcblx0fSApO1xuXHQkKCBkb2N1bWVudCApLm9uKCAnY2xpY2snLCAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX2FyY2hpdmUnLCBmdW5jdGlvbiAoKSB7IGFyY2hpdmVTZXJ2aWNlKCBzdGF0ZS5zZWxlY3RlZElkICk7IH0gKTtcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19pbmxpbmVfdG9nZ2xlJywgZnVuY3Rpb24gKCkgeyBzdGFydF9pbmxpbmVfZWRpdGluZygpOyB9ICk7XG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICdbZGF0YS13cGJjLWFwcG9pbnRtZW50LXNlcnZpY2VzLWlubGluZS1iYXJdIFtkYXRhLXdwYmMtdWktY2F0YWxvZy1pbmxpbmUtY2FuY2VsXScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRjYW5jZWxfaW5saW5lX2VkaXRpbmcoIHRydWUgKTtcblx0fSApO1xuXHQkKCBkb2N1bWVudCApLm9uKCAnY2xpY2snLCAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX2lubGluZV9yZXZpZXcnLCBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIGNoYW5nZXMgPSBjb2xsZWN0X2lubGluZV9jaGFuZ2VzKCk7XG5cblx0XHRwcmV2aWV3X29wZXJhdGlvbiggJ2lubGluZScsICQubWFwKCBPYmplY3Qua2V5cyggY2hhbmdlcyApLCBmdW5jdGlvbiAoIHNlcnZpY2VfaWQgKSB7IHJldHVybiBOdW1iZXIoIHNlcnZpY2VfaWQgKTsgfSApLCBjaGFuZ2VzLCB0aGlzICk7XG5cdH0gKTtcblx0JCggZG9jdW1lbnQgKS5vbiggJ2lucHV0IGNoYW5nZScsICdbZGF0YS13cGJjLWFwcG9pbnRtZW50LXNlcnZpY2VzLWlubGluZS1maWVsZF0nLCBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIHNlcnZpY2VfaWQgPSBTdHJpbmcoIE51bWJlciggJCggdGhpcyApLmRhdGEoICdzZXJ2aWNlLWlkJyApIHx8IDAgKSApO1xuXHRcdHZhciBmaWVsZF9pZCA9IFN0cmluZyggJCggdGhpcyApLmRhdGEoICd3cGJjLWFwcG9pbnRtZW50LXNlcnZpY2VzLWlubGluZS1maWVsZCcgKSB8fCAnJyApO1xuXHRcdHZhciByb3dfZWxlbWVudDtcblx0XHR2YXIgaW5kaWNhdG9yX2VsZW1lbnQ7XG5cdFx0dmFyIGNoYW5nZWQ7XG5cblx0XHRpZiAoIHN0YXRlLmlubGluZV9kcmFmdHNbIHNlcnZpY2VfaWQgXSAmJiBmaWVsZF9pZCApIHtcblx0XHRcdHN0YXRlLmlubGluZV9kcmFmdHNbIHNlcnZpY2VfaWQgXVsgZmllbGRfaWQgXSA9ICQoIHRoaXMgKS52YWwoKTtcblx0XHRcdHJvd19lbGVtZW50ID0gJCggdGhpcyApLmNsb3Nlc3QoICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19faXRlbScgKS5nZXQoIDAgKTtcblx0XHRcdGluZGljYXRvcl9lbGVtZW50ID0gcm93X2VsZW1lbnQgPyByb3dfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX2lubGluZV9pZGVudGl0eV9maWVsZHMnICkgOiBudWxsO1xuXHRcdFx0Y2hhbmdlZCA9IGlubGluZV9kcmFmdF9jaGFuZ2VkKCBmaW5kX2lubGluZV9zY2hlbWEoIHNlcnZpY2VfaWQgKSwgc3RhdGUuaW5saW5lX2RyYWZ0c1sgc2VydmljZV9pZCBdICk7XG5cdFx0XHRpZiAoIGlubGluZVdvcmtmbG93Q29udHJvbGxlciApIHtcblx0XHRcdFx0aW5saW5lV29ya2Zsb3dDb250cm9sbGVyLnNldF9yb3dfY2hhbmdlZCggcm93X2VsZW1lbnQsIGNoYW5nZWQsIGluZGljYXRvcl9lbGVtZW50LCBjb25maWcuaTE4bi5jaGFuZ2VkICk7XG5cdFx0XHR9XG5cdFx0XHRzeW5jaHJvbml6ZV9pbmxpbmVfYmFyKCk7XG5cdFx0fVxuXHR9ICk7XG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fYnVsa19lZGl0JywgZnVuY3Rpb24gKCkgeyBvcGVuX2J1bGtfZWRpdCggdGhpcyApOyB9ICk7XG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fYnVsa19kZWxldGUnLCBmdW5jdGlvbiAoKSB7IHByZXZpZXdfZGVsZXRpb24oIGdldF9zZWxlY3RlZF9zZXJ2aWNlX2lkcygpLCB0aGlzICk7IH0gKTtcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICdbZGF0YS13cGJjLWFwcG9pbnRtZW50LXNlcnZpY2VzLWJ1bGstZW5hYmxlXScsIGZ1bmN0aW9uICgpIHtcblx0XHR2YXIgZmllbGRfaWQgPSBTdHJpbmcoICQoIHRoaXMgKS5kYXRhKCAnd3BiYy1hcHBvaW50bWVudC1zZXJ2aWNlcy1idWxrLWVuYWJsZScgKSB8fCAnJyApO1xuXHRcdCQoICdbZGF0YS13cGJjLWFwcG9pbnRtZW50LXNlcnZpY2VzLWJ1bGstdmFsdWU9XCInICsgZmllbGRfaWQgKyAnXCJdLCBbZGF0YS13cGJjLWFwcG9pbnRtZW50LXNlcnZpY2VzLWJ1bGstcmFuZ2U9XCInICsgZmllbGRfaWQgKyAnXCJdJyApLnByb3AoICdkaXNhYmxlZCcsICEgdGhpcy5jaGVja2VkICk7XG5cdFx0dXBkYXRlQ29udHJvbHMoKTtcblx0fSApO1xuXHQkKCBkb2N1bWVudCApLm9uKCAnaW5wdXQgY2hhbmdlJywgJ1tkYXRhLXdwYmMtYXBwb2ludG1lbnQtc2VydmljZXMtYnVsay12YWx1ZV0nLCBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIGZpZWxkX2lkID0gU3RyaW5nKCAkKCB0aGlzICkuZGF0YSggJ3dwYmMtYXBwb2ludG1lbnQtc2VydmljZXMtYnVsay12YWx1ZScgKSB8fCAnJyApO1xuXG5cdFx0JCggJ1tkYXRhLXdwYmMtYXBwb2ludG1lbnQtc2VydmljZXMtYnVsay1yYW5nZT1cIicgKyBmaWVsZF9pZCArICdcIl0nICkudmFsKCAkKCB0aGlzICkudmFsKCkgKTtcblx0XHR1cGRhdGVDb250cm9scygpO1xuXHR9ICk7XG5cdCQoIGRvY3VtZW50ICkub24oICdpbnB1dCBjaGFuZ2UnLCAnW2RhdGEtd3BiYy1hcHBvaW50bWVudC1zZXJ2aWNlcy1idWxrLXJhbmdlXScsIGZ1bmN0aW9uICgpIHtcblx0XHR2YXIgZmllbGRfaWQgPSBTdHJpbmcoICQoIHRoaXMgKS5kYXRhKCAnd3BiYy1hcHBvaW50bWVudC1zZXJ2aWNlcy1idWxrLXJhbmdlJyApIHx8ICcnICk7XG5cblx0XHQkKCAnW2RhdGEtd3BiYy1hcHBvaW50bWVudC1zZXJ2aWNlcy1idWxrLXZhbHVlPVwiJyArIGZpZWxkX2lkICsgJ1wiXScgKS52YWwoICQoIHRoaXMgKS52YWwoKSApO1xuXHRcdHVwZGF0ZUNvbnRyb2xzKCk7XG5cdH0gKTtcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19vcGVyYXRpb25fcmV2aWV3JywgZnVuY3Rpb24gKCkge1xuXHRcdHByZXZpZXdfb3BlcmF0aW9uKCAnYnVsaycsIGdldF9zZWxlY3RlZF9zZXJ2aWNlX2lkcygpLCBjb2xsZWN0X2J1bGtfY2hhbmdlcygpLCB0aGlzICk7XG5cdH0gKTtcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19vcGVyYXRpb25fYXBwbHknLCBhcHBseV9vcGVyYXRpb24gKTtcblx0JCggZG9jdW1lbnQgKS5vbiggJ3N1Ym1pdCcsICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaW5saW5lLXJldmlldy1mb3JtXSwgW2RhdGEtd3BiYy11aS1jYXRhbG9nLWRlbGV0ZS1yZXZpZXctZm9ybV0nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0YXBwbHlfb3BlcmF0aW9uKCk7XG5cdH0gKTtcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctZGVsZXRlLWFja25vd2xlZGdlbWVudF0nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdGlmICggZ2V0X2RlbGV0ZV9yZXZpZXdfd29ya2Zsb3coKSApIHsgZ2V0X2RlbGV0ZV9yZXZpZXdfd29ya2Zsb3coKS5oYW5kbGVfY2hhbmdlKCBldmVudCApOyB9XG5cdH0gKTtcblx0JCggZG9jdW1lbnQgKS5vbiggJ2lucHV0IGNoYW5nZScsICdbZGF0YS1zZXJ2aWNlLXJhbmdlLWZpZWxkXScsIGZ1bmN0aW9uICgpIHtcblx0XHR2YXIgZmllbGRfaWQgPSBTdHJpbmcoICQoIHRoaXMgKS5kYXRhKCAnc2VydmljZS1yYW5nZS1maWVsZCcgKSB8fCAnJyApO1xuXHRcdGlmICggZmllbGRfaWQgKSB7ICQoICdbZGF0YS1zZXJ2aWNlLWZpZWxkPVwiJyArIGZpZWxkX2lkICsgJ1wiXScgKS52YWwoICQoIHRoaXMgKS52YWwoKSApLnRyaWdnZXIoICdpbnB1dCcgKTsgfVxuXHR9ICk7XG5cdCQoIGRvY3VtZW50ICkub24oICdpbnB1dCBjaGFuZ2UnLCAnaW5wdXRbdHlwZT1cIm51bWJlclwiXVtkYXRhLXNlcnZpY2UtZmllbGRdJywgZnVuY3Rpb24gKCkgeyBzeW5jX251bWVyaWNfcmFuZ2UoIFN0cmluZyggJCggdGhpcyApLmRhdGEoICdzZXJ2aWNlLWZpZWxkJyApIHx8ICcnICkgKTsgfSApO1xuXHQkKCBkb2N1bWVudCApLm9uKCAnY2hhbmdlJywgJ1tkYXRhLXNlcnZpY2Utc3RhdHVzLWNob2ljZV0nLCBmdW5jdGlvbiAoKSB7XG5cdFx0aWYgKCB0aGlzLmNoZWNrZWQgKSB7ICQoICdbZGF0YS1zZXJ2aWNlLWZpZWxkPVwic3RhdHVzXCJdJyApLnZhbCggdGhpcy52YWx1ZSApLnRyaWdnZXIoICdjaGFuZ2UnICk7IH1cblx0fSApO1xuXHQkKCBkb2N1bWVudCApLm9uKCAnaW5wdXQgY2hhbmdlIHdwYmNfbWVkaWFfdXBsb2FkX3VybF9zZXQnLCAnW2RhdGEtc2VydmljZS1maWVsZD1cInBpY3R1cmVfdXJsXCJdJywgZnVuY3Rpb24gKCkgeyB1cGRhdGVNZWRpYVByZXZpZXcoKTsgdXBkYXRlQ29udHJvbHMoKTsgfSApO1xuXHQkKCBkb2N1bWVudCApLm9uKCAnY2xpY2snLCAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX3JlbW92ZV9pbWFnZScsIGZ1bmN0aW9uICgpIHtcblx0XHRpZiAoICQoIHRoaXMgKS5wcm9wKCAnZGlzYWJsZWQnICkgKSB7IHJldHVybjsgfVxuXHRcdCQoICdbZGF0YS1zZXJ2aWNlLWZpZWxkPVwicGljdHVyZV91cmxcIl0nICkudmFsKCAnJyApLnRyaWdnZXIoICdpbnB1dCcgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xuXHR9ICk7XG5cdCQoIGRvY3VtZW50ICkub24oICdpbnB1dCcsICcjd3BiY19zZXJ2aWNlX3NlYXJjaCcsIGZ1bmN0aW9uICgpIHtcblx0XHR3LmNsZWFyVGltZW91dCggc2VhcmNoVGltZXIgKTtcblx0XHRzdGF0ZS5wYWdlID0gMTtcblx0XHRzeW5jX3NlYXJjaF9jbGVhcl9idXR0b24oKTtcblx0XHRzZWFyY2hUaW1lciA9IHcuc2V0VGltZW91dCggbG9hZExpc3QsIDI1MCApO1xuXHR9ICk7XG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICdbZGF0YS13cGJjLWFwcG9pbnRtZW50LXNlcnZpY2VzLXNlYXJjaC1jbGVhcl0nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdHZhciAkc2VhcmNoX2NvbnRyb2wgPSAkKCAnI3dwYmNfc2VydmljZV9zZWFyY2gnICk7XG5cblx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdHcuY2xlYXJUaW1lb3V0KCBzZWFyY2hUaW1lciApO1xuXHRcdCRzZWFyY2hfY29udHJvbC52YWwoICcnICkudHJpZ2dlciggJ2ZvY3VzJyApO1xuXHRcdHN0YXRlLnBhZ2UgPSAxO1xuXHRcdHN5bmNfc2VhcmNoX2NsZWFyX2J1dHRvbigpO1xuXHRcdGxvYWRMaXN0KCk7XG5cdH0gKTtcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICcjd3BiY19zZXJ2aWNlX3Byb3ZpZGVyX2ZpbHRlcicsIGZ1bmN0aW9uICgpIHsgc3RhdGUucGFnZSA9IDE7IGxvYWRMaXN0KCB0cnVlICk7IH0gKTtcblx0JCggZG9jdW1lbnQgKS5vbiggJ3dwYmM6dWktY2F0YWxvZy1sb2FkaW5nJywgJyN3cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX2NhdGFsb2cnLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdHZhciBldmVudF9kZXRhaWwgPSBldmVudC5vcmlnaW5hbEV2ZW50ICYmIGV2ZW50Lm9yaWdpbmFsRXZlbnQuZGV0YWlsID8gZXZlbnQub3JpZ2luYWxFdmVudC5kZXRhaWwgOiB7fTtcblxuXHRcdGlmICggZXZlbnRfZGV0YWlsLmNhdGFsb2dfaWQgIT09ICdhcHBvaW50bWVudF9zZXJ2aWNlc19jYXRhbG9nJyApIHsgcmV0dXJuOyB9XG5cdFx0c3RhdGUuY2F0YWxvZ19sb2FkaW5nID0gdHJ1ZTtcblx0XHR1cGRhdGVDb250cm9scygpO1xuXHR9ICk7XG5cdCQoIGRvY3VtZW50ICkub24oICd3cGJjOnVpLWNhdGFsb2ctcmVuZGVyZWQnLCAnI3dwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfY2F0YWxvZycsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0dmFyIHJlc3BvbnNlID0gZXZlbnQub3JpZ2luYWxFdmVudCAmJiBldmVudC5vcmlnaW5hbEV2ZW50LmRldGFpbCA/IGV2ZW50Lm9yaWdpbmFsRXZlbnQuZGV0YWlsLnJlc3BvbnNlIDogbnVsbDtcblx0XHR2YXIgZmlsdGVycyA9IHJlc3BvbnNlICYmIHJlc3BvbnNlLmZpbHRlcnMgPyByZXNwb25zZS5maWx0ZXJzIDoge307XG5cdFx0aWYgKCAhIHJlc3BvbnNlIHx8IHJlc3BvbnNlLmNhdGFsb2dfaWQgIT09ICdhcHBvaW50bWVudF9zZXJ2aWNlc19jYXRhbG9nJyApIHsgcmV0dXJuOyB9XG5cdFx0c3RhdGUuY2F0YWxvZ19sb2FkaW5nID0gZmFsc2U7XG5cdFx0c3RhdGUuc3RvcmFnZVJlYWR5ID0gISEgZmlsdGVycy5zdG9yYWdlX3JlYWR5O1xuXHRcdHN0YXRlLnN0YXR1cyA9IFN0cmluZyggZmlsdGVycy5zdGF0dXMgfHwgc3RhdGUuc3RhdHVzICk7XG5cdFx0aW5kZXhQcm92aWRlcnMoIGZpbHRlcnMucHJvdmlkZXJzIHx8ICggcmVzcG9uc2UuaXRlbXMgJiYgcmVzcG9uc2UuaXRlbXMubGVuZ3RoID8gcmVzcG9uc2UuaXRlbXNbMF0ucHJvdmlkZXJzIHx8IFtdIDogW10gKSApO1xuXHRcdHVwZGF0ZVN1bW1hcnkoIGZpbHRlcnMuc3RhdHVzX2NvdW50cyB8fCB7fSwgZmlsdGVycy5wcm92aWRlcl9jb3VudCB8fCAwICk7XG5cdFx0JCggJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19zdGF0dXNfZmlsdGVyJyApLnJlbW92ZUNsYXNzKCAnaXMtYWN0aXZlJyApLmF0dHIoICdhcmlhLXByZXNzZWQnLCAnZmFsc2UnIClcblx0XHRcdC5maWx0ZXIoICdbZGF0YS1zZXJ2aWNlLXN0YXR1cz1cIicgKyBzdGF0ZS5zdGF0dXMgKyAnXCJdJyApLmFkZENsYXNzKCAnaXMtYWN0aXZlJyApLmF0dHIoICdhcmlhLXByZXNzZWQnLCAndHJ1ZScgKTtcblx0XHQkKCAnI3dwYmNfc2VydmljZV9wcm92aWRlcl9maWx0ZXInICkudmFsKCBTdHJpbmcoIGZpbHRlcnMucmVzb3VyY2VfaWQgfHwgMCApICk7XG5cdFx0cmVuZGVyQ2F0YWxvZ1Jlc3BvbnNlKCByZXNwb25zZSApO1xuXHRcdHVwZGF0ZUNvbnRyb2xzKCk7XG5cdFx0aWYgKCBzdGF0ZS5pbml0aWFsX3NlbGVjdGlvbl9wZW5kaW5nICYmIHN0YXRlLnNlbGVjdGVkSWQgKSB7XG5cdFx0XHRzdGF0ZS5pbml0aWFsX3NlbGVjdGlvbl9wZW5kaW5nID0gZmFsc2U7XG5cdFx0XHRsb2FkT25lKCBzdGF0ZS5zZWxlY3RlZElkICk7XG5cdFx0fVxuXHR9ICk7XG5cdCQoIGZ1bmN0aW9uICgpIHtcblx0XHR2YXIgbW91bnRfZWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19jYXRhbG9nJyApO1xuXHRcdHZhciBwYWdlX2VsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfcGFnZScgKTtcblx0XHR2YXIgcHJvdGVjdGVkX2V2ZW50c19yb290ID0gcGFnZV9lbGVtZW50IHx8IG1vdW50X2VsZW1lbnQ7XG5cblx0XHRpZiAoICEgJCggJ1tkYXRhLXdwYmMtYXBwb2ludG1lbnQtc2VydmljZXMtcGFnZT1cIjFcIl0nICkubGVuZ3RoIHx8ICEgbW91bnRfZWxlbWVudCB8fCAhIGNvbmZpZy5jYXRhbG9nIHx8ICEgdy53cGJjX3VpX2NhdGFsb2cgKSB7IHJldHVybjsgfVxuXHRcdHN0YXRlLnN0YXR1cyA9IFN0cmluZyggY29uZmlnLmNhdGFsb2cuaW5pdGlhbF9yZXF1ZXN0ICYmIGNvbmZpZy5jYXRhbG9nLmluaXRpYWxfcmVxdWVzdC5zdGF0dXMgPyBjb25maWcuY2F0YWxvZy5pbml0aWFsX3JlcXVlc3Quc3RhdHVzIDogJ2FsbCcgKTtcblx0XHQkKCAnI3dwYmNfc2VydmljZV9zZWFyY2gnICkudmFsKCBTdHJpbmcoIGNvbmZpZy5jYXRhbG9nLmluaXRpYWxfcmVxdWVzdCAmJiBjb25maWcuY2F0YWxvZy5pbml0aWFsX3JlcXVlc3Quc2VhcmNoID8gY29uZmlnLmNhdGFsb2cuaW5pdGlhbF9yZXF1ZXN0LnNlYXJjaCA6ICcnICkgKTtcblx0XHRzeW5jX3NlYXJjaF9jbGVhcl9idXR0b24oKTtcblx0XHRwcm90ZWN0ZWRfZXZlbnRzX3Jvb3QuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgcHJvdGVjdF9pbmxpbmVfZHJhZnRzX2Zyb21fY2F0YWxvZ19jb250cm9scywgdHJ1ZSApO1xuXHRcdHByb3RlY3RlZF9ldmVudHNfcm9vdC5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgcHJvdGVjdF9pbmxpbmVfZHJhZnRzX2Zyb21fY2F0YWxvZ19jb250cm9scywgdHJ1ZSApO1xuXHRcdHByb3RlY3RlZF9ldmVudHNfcm9vdC5hZGRFdmVudExpc3RlbmVyKCAnaW5wdXQnLCBwcm90ZWN0X2lubGluZV9kcmFmdHNfZnJvbV9jYXRhbG9nX2NvbnRyb2xzLCB0cnVlICk7XG5cdFx0Y2F0YWxvZ0NvbnRyb2xsZXIgPSB3LndwYmNfdWlfY2F0YWxvZy5tb3VudCggY29uZmlnLmNhdGFsb2cgKTtcblx0XHRpZiAoICEgY2F0YWxvZ0NvbnRyb2xsZXIgKSB7XG5cdFx0XHRub3RpZnkoIGNvbmZpZy5pMThuLmxvYWRfZmFpbGVkLCAnZXJyb3InICk7XG5cdFx0fSBlbHNlIGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHcud3BiY191aV9jYXRhbG9nLmNyZWF0ZV9pbmxpbmVfZWRpdGluZ193b3JrZmxvdyApIHtcblx0XHRcdGlubGluZVdvcmtmbG93Q29udHJvbGxlciA9IHcud3BiY191aV9jYXRhbG9nLmNyZWF0ZV9pbmxpbmVfZWRpdGluZ193b3JrZmxvdyggbW91bnRfZWxlbWVudCwge1xuXHRcdFx0XHRjb250cm9sc19yb290OiBwYWdlX2VsZW1lbnQgfHwgbW91bnRfZWxlbWVudCxcblx0XHRcdFx0cGFnZV9lbGVtZW50OiBwYWdlX2VsZW1lbnQgfHwgbW91bnRfZWxlbWVudCxcblx0XHRcdFx0cHJvdGVjdGVkX3NlbGVjdG9yOiAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX3N0YXR1c19maWx0ZXIsICN3cGJjX3NlcnZpY2VfcHJvdmlkZXJfZmlsdGVyLCAud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fYWRkJ1xuXHRcdFx0fSApO1xuXHRcdFx0c3luY2hyb25pemVfaW5saW5lX3dvcmtmbG93KCk7XG5cdFx0fVxuXHRcdCQoICcud3BiY19zZXR0aW5nc19wYWdlX3dyYXBwZXInICkub24oICd3cGJjOnJpZ2h0LXNpZGViYXItYmVmb3JlLWNvbnRlbnQtY29sbGFwc2Uud3BiY0FwcG9pbnRtZW50U2VydmljZXMnLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0aWYgKCAoIGVkaXRvcklzT3BlbigpIHx8IHN0YXRlLm9wZXJhdGlvbl9tb2RlICkgJiYgISBjbG9zZV9zZXJ2aWNlX2luc3BlY3RvciggdHJ1ZSwgZmFsc2UgKSApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdH0gKTtcbn0gKSggd2luZG93LCBqUXVlcnkgKTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQSxDQUFFLFVBQVdBLENBQUMsRUFBRUMsQ0FBQyxF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Q0FBQ2tKLEdBQUcsQ0FBRXhJLE1BQU0sQ0FBRVQsTUFBTSxDQUFDaUMsT0FBTyxDQUFDQyxlQUFlLElBQUlsQyxNQUFNLENBQUNpQyxPQUFPLENBQUNDLGVBQWUsQ0FBQ3doQixNQUFNLEdBQUcxakIsTUFBTSxDQUFDaUMsT0FBTyxDQUFDQyxlQUFlLENBQUN3aEIsTUFBTSxHQUFHLEVBQUcsQ0FBRSxDQUFDO0lBQ2pLSyx3QkFBd0IsQ0FBQyxDQUFDO0lBQzFCMEIscUJBQXFCLENBQUNDLGdCQUFnQixDQUFFLE9BQU8sRUFBRWhhLDJDQUEyQyxFQUFFLElBQUssQ0FBQztJQUNwRytaLHFCQUFxQixDQUFDQyxnQkFBZ0IsQ0FBRSxRQUFRLEVBQUVoYSwyQ0FBMkMsRUFBRSxJQUFLLENBQUM7SUFDckcrWixxQkFBcUIsQ0FBQ0MsZ0JBQWdCLENBQUUsT0FBTyxFQUFFaGEsMkNBQTJDLEVBQUUsSUFBSyxDQUFDO0lBQ3BHbEosaUJBQWlCLEdBQUcxQyxDQUFDLENBQUMyRCxlQUFlLENBQUN3UyxLQUFLLENBQUVqVyxNQUFNLENBQUNpQyxPQUFRLENBQUM7SUFDN0QsSUFBSyxDQUFFTyxpQkFBaUIsRUFBRztNQUMxQmEsTUFBTSxDQUFFckQsTUFBTSxDQUFDZ0wsSUFBSSxDQUFDb08sV0FBVyxFQUFFLE9BQVEsQ0FBQztJQUMzQyxDQUFDLE1BQU0sSUFBSyxVQUFVLEtBQUssT0FBT3RaLENBQUMsQ0FBQzJELGVBQWUsQ0FBQ2tpQiw4QkFBOEIsRUFBRztNQUNwRmxqQix3QkFBd0IsR0FBRzNDLENBQUMsQ0FBQzJELGVBQWUsQ0FBQ2tpQiw4QkFBOEIsQ0FBRUosYUFBYSxFQUFFO1FBQzNGSyxhQUFhLEVBQUVKLFlBQVksSUFBSUQsYUFBYTtRQUM1Q0MsWUFBWSxFQUFFQSxZQUFZLElBQUlELGFBQWE7UUFDM0NNLGtCQUFrQixFQUFFO01BQ3JCLENBQUUsQ0FBQztNQUNIbmIsMkJBQTJCLENBQUMsQ0FBQztJQUM5QjtJQUNBM0ssQ0FBQyxDQUFFLDZCQUE4QixDQUFDLENBQUNxa0IsRUFBRSxDQUFFLG9FQUFvRSxFQUFFLFVBQVd6WSxLQUFLLEVBQUc7TUFDL0gsSUFBSyxDQUFFaEQsWUFBWSxDQUFDLENBQUMsSUFBSXpJLEtBQUssQ0FBQ29CLGNBQWMsS0FBTSxDQUFFNk4sdUJBQXVCLENBQUUsSUFBSSxFQUFFLEtBQU0sQ0FBQyxFQUFHO1FBQzdGeEQsS0FBSyxDQUFDSSxjQUFjLENBQUMsQ0FBQztNQUN2QjtJQUNELENBQUUsQ0FBQztFQUNKLENBQUUsQ0FBQztBQUNKLENBQUMsRUFBSXdSLE1BQU0sRUFBRXVJLE1BQU8sQ0FBQyIsImlnbm9yZUxpc3QiOltdfQ==
