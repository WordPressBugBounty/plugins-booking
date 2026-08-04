"use strict";

(function (w, $) {
  'use strict';

  var config = w.wpbc_appointment_services_config || {};
  var state = {
    storageReady: false,
    selectedId: Number(config.selected_id || 0),
    requested_focus: String(config.focus_section || ''),
    focus_handled: false,
    busy: false,
    status: 'all',
    services: [],
    providers: {},
    providerCount: 0,
    editor_snapshot: '',
    page: 1,
    page_size: Number(config.listing && config.listing.items_per_page ? config.listing.items_per_page : 10),
    total_items: 0,
    total_pages: 0,
    sort_by: String(config.listing && config.listing.sort_by ? config.listing.sort_by : 'service_id'),
    sort_order: String(config.listing && config.listing.sort_order ? config.listing.sort_order : 'desc')
  };
  var searchTimer = 0;
  var weekdayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

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
   * Every request uses the shared administrator Processing notice and removes
   * only its own notice after the request settles.
   *
   * @param {string} action WordPress AJAX action name.
   * @param {Object} data Request-specific payload.
   * @return {jqXHR} jQuery AJAX promise for the request.
   */
  function request(action, data) {
    var $processing_notice = show_processing_notice();
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
  /** Toggle the loading overlay without hiding the existing Service table. */
  function setLoading(isLoading) {
    $('.wpbc_appointment_services__loading').toggleClass('is-visible', isLoading).attr('aria-hidden', isLoading ? 'false' : 'true');
    $('.wpbc_appointment_services__content').attr('aria-busy', isLoading ? 'true' : 'false');
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
   * The slider expands to represent an existing value above its normal visual
   * range without clamping or rewriting that stored value.
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
    range_max = value > default_max ? default_min + Math.ceil((value - default_min) / step) * step : default_max;
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
    var hasPicture = !!String($('[data-service-field="picture_url"]').val() || '').trim();
    var show_save = open && 'true' === $('#wpbc_tab_service_settings').attr('aria-selected');
    $('.wpbc_appointment_services__add').prop('hidden', false).prop('disabled', !state.storageReady || state.busy);
    $('.wpbc_appointment_services__right_sidebar_footer, .wpbc_appointment_services__top_actions').prop('hidden', !show_save);
    $('.wpbc_appointment_services__save').prop('hidden', !show_save).prop('disabled', !open || state.busy);
    $('.wpbc_appointment_services__duplicate, .wpbc_appointment_services__archive').prop('disabled', !open || !state.selectedId || state.busy);
    $('.wpbc_appointment_services__media_preview, .wpbc_appointment_services__select_image').prop('disabled', !open || state.busy);
    $('.wpbc_appointment_services__remove_image').prop('disabled', !open || !hasPicture || state.busy);
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
      resource_ids: []
    };
  }
  /** Populate the inspector from a normalized Service response. */
  function fillEditor(service) {
    service = $.extend(blankService(), service || {});
    state.selectedId = Number(service.service_id || 0);
    $.each(service, function (key, value) {
      $('[data-service-field="' + key + '"]').val(value);
    });
    sync_status_radios();
    sync_all_numeric_ranges();
    updateMediaPreview();
    setFieldsEnabled(state.storageReady);
    $('.wpbc_appointment_services__item').removeClass('is-selected').attr('aria-current', 'false');
    $('.wpbc_appointment_services__item[data-service-id="' + state.selectedId + '"]').addClass('is-selected').attr('aria-current', 'true');
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
  /** Render the empty or storage-unavailable state in the central workspace. */
  function renderEmpty(message, storageNotice) {
    var $empty = $('.wpbc_appointment_services__empty');
    var noProviders = !storageNotice && !message && 0 === state.providerCount;
    $('.wpbc_appointment_services__list').prop('hidden', true);
    $empty.prop('hidden', false).toggleClass('is-storage-notice', !!storageNotice);
    $empty.find('h2').text(storageNotice ? config.i18n.not_connected || 'Services storage is not connected' : noProviders ? config.i18n.no_providers || 'No Providers available' : config.i18n.empty || 'No Services yet');
    $empty.find('p').text(message || (noProviders ? config.i18n.no_providers_help : config.i18n.empty_help) || '');
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
      'class': 'wpbc_appointment_services__service_thumbnail tooltip_top',
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
    var listing_selector = '#wpbc_ui_listing_appointment_services_catalog ';
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
    var format = config.i18n.showing || 'Showing %1$s–%2$s of %3$s Services';
    return format.replace('%1$s', from).replace('%2$s', to).replace('%3$s', total);
  }
  /**
   * Apply the server-authoritative listing preference to state and controls.
   *
   * @param {Object} listing_settings Shared listing client settings.
   * @return {void}
   */
  function sync_listing_settings(listing_settings) {
    var page_size = Number(listing_settings && listing_settings.items_per_page ? listing_settings.items_per_page : state.page_size);
    if (!isFinite(page_size) || page_size < 1) {
      return;
    }
    state.page_size = page_size;
    $('[data-wpbc-listing-items-per-page-control="appointment_services_catalog"]').val(String(page_size));
  }
  /**
   * Synchronize sortable table headers with the server-authoritative ordering.
   *
   * @param {Object} sorting Normalized sort key and direction.
   * @return {void}
   */
  function sync_sorting_controls(sorting) {
    state.sort_by = String(sorting && sorting.sort_by ? sorting.sort_by : state.sort_by);
    state.sort_order = 'desc' === String(sorting && sorting.sort_order ? sorting.sort_order : state.sort_order) ? 'desc' : 'asc';
    $('[data-wpbc-listing-sort="appointment_services_catalog"]').each(function () {
      var $sort_link = $(this);
      var is_active = String($sort_link.data('wpbc-listing-sort-key') || '') === state.sort_by;
      var $sort_icon = $sort_link.find('.wpbc_ui_listing__sort_icon');
      $sort_link.toggleClass('is-active', is_active);
      $sort_icon.removeClass('wpbc_icn_import_export wpbc-bi-arrow-down wpbc-bi-arrow-up').addClass(is_active ? 'desc' === state.sort_order ? 'wpbc-bi-arrow-down' : 'wpbc-bi-arrow-up' : 'wpbc_icn_import_export');
    });
    $('.wpbc_appointment_services__table th').each(function () {
      var $column = $(this);
      if (!$column.find('.wpbc_ui_listing__sort_link').length) {
        return;
      }
      var has_active_sort = $column.find('.wpbc_ui_listing__sort_link.is-active').length > 0;
      $column.attr('aria-sort', has_active_sort ? 'desc' === state.sort_order ? 'descending' : 'ascending' : 'none');
    });
  }
  /**
   * Synchronize direct-page and previous/next controls with the server response.
   *
   * @param {Object} pagination Server-authoritative pagination metadata.
   * @return {void}
   */
  function sync_pagination_controls(pagination) {
    var total_pages = Math.max(0, Number(pagination && pagination.total_pages ? pagination.total_pages : 0));
    var maximum_page = Math.max(1, total_pages);
    var $page_control = $('[data-wpbc-listing-page-number-control="appointment_services_catalog"]');
    $page_control.attr('max', maximum_page).val(state.page).prop('disabled', total_pages <= 1);
    $('[data-wpbc-listing-page-total="appointment_services_catalog"]').text(total_pages);
  }
  /**
   * Request the valid page entered in the shared direct-page control.
   *
   * @param {jQuery} $page_control Direct-page number input.
   * @return {void}
   */
  function request_selected_page($page_control) {
    var requested_page = Number($page_control.val());
    requested_page = Math.min(Math.max(1, isFinite(requested_page) ? requested_page : state.page), Math.max(1, state.total_pages));
    $page_control.val(requested_page);
    if (requested_page === state.page) {
      return;
    }
    state.page = requested_page;
    loadList();
  }
  /**
   * Render one server-selected page of Services in the management table.
   *
   * @param {Array}  services   Services returned for the requested page only.
   * @param {Object} pagination Server-authoritative pagination metadata.
   * @return {void}
   */
  function renderList(services, pagination) {
    var $list = $('.wpbc_appointment_services__list');
    var $tbody = $('.wpbc_appointment_services__table tbody');
    var items_from;
    var items_to;
    var page_items;
    destroy_service_thumbnail_tooltips();
    $tbody.empty();
    pagination = pagination || {};
    state.services = services || [];
    state.page = Math.max(1, Number(pagination.page_number || state.page || 1));
    state.total_items = Math.max(0, Number(pagination.total_items || 0));
    state.total_pages = Math.max(0, Number(pagination.total_pages || 0));
    sync_pagination_controls(pagination);
    $('.wpbc_appointment_services__empty').prop('hidden', true);
    if (!state.services.length) {
      renderEmpty('', false);
      return;
    }
    items_from = Math.max(1, Number(pagination.items_from || (state.page - 1) * state.page_size + 1));
    items_to = Math.max(items_from, Number(pagination.items_to || items_from + state.services.length - 1));
    page_items = state.services;
    $list.prop('hidden', false);
    $.each(page_items, function (index, service) {
      var id = Number(service.service_id || 0);
      var title = service.title || config.i18n.untitled || 'Untitled Service';
      var description = String(service.description || '#' + id);
      var status = String(service.status || 'active');
      var $row = $('<tr>', {
        'class': 'wpbc_appointment_services__item',
        'data-service-id': id,
        tabindex: '0',
        'aria-current': id === state.selectedId ? 'true' : 'false'
      });
      var $serviceCell = $('<td>', {
        'class': 'column-service',
        'data-label': config.i18n.column_service || 'Service'
      }).appendTo($row);
      $row.toggleClass('is-selected', id === state.selectedId);
      var $serviceIdentity = $('<div>', {
        'class': 'wpbc_appointment_services__service_identity'
      }).appendTo($serviceCell);
      var $serviceCopy = $('<span>', {
        'class': 'wpbc_appointment_services__service_copy'
      }).appendTo($serviceIdentity);
      serviceThumbnailNode(service).prependTo($serviceIdentity);
      $('<strong>', {
        text: title
      }).appendTo($serviceCopy);
      $('<span>', {
        text: description
      }).appendTo($serviceCopy);
      $('<td>', {
        'class': 'column-duration',
        'data-label': config.i18n.column_duration || 'Duration'
      }).append(service_duration_node(service)).appendTo($row);
      if (config.pricing_available) {
        $('<td>', {
          'class': 'column-price',
          'data-label': config.i18n.column_price || 'Price',
          text: formatCost(service.base_cost)
        }).appendTo($row);
      }
      $('<td>', {
        'class': 'column-providers',
        'data-label': config.i18n.column_providers || 'Providers'
      }).append(providerNodes(service)).appendTo($row);
      var $availabilityCell = $('<td>', {
        'class': 'column-weekdays',
        'data-label': config.i18n.column_weekly_availability || 'Weekly Availability'
      }).appendTo($row);
      var $availabilityWeek = $('<div>', {
        'class': 'wpbc_appointment_services__availability_week'
      }).appendTo($availabilityCell);
      var hasWeeklyAvailability = false;
      $.each(weekdayKeys, function (dayIndex, day) {
        var available_providers = providers_available_on(service, day);
        var available = available_providers.length > 0;
        if (available) {
          hasWeeklyAvailability = true;
        }
        var dayTitle = config.weekdays && config.weekdays[dayIndex] ? config.weekdays[dayIndex] : day;
        var provider_titles = $.map(available_providers, function (provider) {
          return provider.title || '';
        }).filter(function (title) {
          return !!title;
        });
        var availability_title = available ? String(config.i18n.available_providers || 'Available Providers: %s').replace('%s', provider_titles.join(', ')) : config.i18n.no_available_providers || 'No assigned Providers are available';
        $('<span>', {
          'class': 'wpbc_appointment_services__availability' + (available ? ' is-available' : ''),
          title: dayTitle + ': ' + availability_title,
          'aria-label': dayTitle + ': ' + availability_title
        }).appendTo($availabilityWeek);
      });
      $availabilityCell.append(availability_edit_links(service));
      if (service.resource_ids && service.resource_ids.length && !hasWeeklyAvailability) {
        $('<span>', {
          'class': 'wpbc_appointment_services__availability_empty',
          text: config.i18n.no_availability || 'No weekly availability'
        }).appendTo($availabilityCell);
      }
      var $status_cell = $('<td>', {
        'class': 'column-status',
        'data-label': config.i18n.column_status || 'Status'
      }).appendTo($row);
      var $status_identity = $('<div>', {
        'class': 'wpbc_appointment_services__status_identity'
      }).appendTo($status_cell);
      $('<span>', {
        'class': 'wpbc_appointment_services__status status-' + status,
        text: statusLabel(status)
      }).appendTo($status_identity);
      $('<span>', {
        'class': 'wpbc_appointment_services__id',
        text: (config.i18n.column_id || 'ID') + ': ' + id
      }).appendTo($status_identity);
      var $actions = $('<td>', {
        'class': 'column-actions',
        'data-label': config.i18n.column_actions || 'Actions'
      }).appendTo($row);
      $('<button>', {
        type: 'button',
        'class': 'button-link wpbc_appointment_services__row_edit wpbc_icn_edit',
        'data-service-id': id,
        title: config.i18n.edit || 'Edit Service',
        'aria-label': config.i18n.edit || 'Edit Service'
      }).appendTo($actions);
      if ('archived' !== status) {
        $('<button>', {
          type: 'button',
          'class': 'button-link wpbc_appointment_services__row_archive wpbc_icn_open_in_browser wpbc_icn_rotate_180 ',
          'data-service-id': id,
          title: config.i18n.archive || 'Archive Service',
          'aria-label': config.i18n.archive || 'Archive Service'
        }).appendTo($actions);
      }
      $tbody.append($row);
    });
    refresh_service_thumbnail_tooltips();
    $('.wpbc_appointment_services__list_footer').prop('hidden', false);
    $('.wpbc_appointment_services__result_count').text(showingText(items_from, items_to, state.total_items));
    $('.wpbc_appointment_services__page_prev').prop('disabled', state.page <= 1);
    $('.wpbc_appointment_services__page_next').prop('disabled', state.total_pages < 1 || state.page >= state.total_pages);
  }
  /** Load one Service and open it in the right inspector. */
  function loadOne(serviceId) {
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
    setBusy(true);
    request(config.actions.load, {
      service_id: serviceId
    }).done(function (response) {
      if (response && response.success && response.data && response.data.service) {
        fillEditor(response.data.service);
        updateUrl(state.selectedId);
        expand_service_inspector();
        focus_requested_service_section();
        return;
      }
      notify(messageFrom(response, config.i18n.load_failed), 'error');
    }).fail(function (xhr) {
      notify(messageFrom(xhr.responseJSON, config.i18n.load_failed), 'error');
    }).always(function () {
      setBusy(false);
    });
  }
  /** Reload Services and Provider presentation data for the active filters. */
  function loadList(save_items_per_page) {
    var request_data = {
      search: $('#wpbc_service_search').val() || '',
      status: state.status,
      resource_id: $('#wpbc_service_provider_filter').val() || 0,
      page_number: state.page,
      items_per_page: state.page_size,
      sort_by: state.sort_by,
      sort_order: state.sort_order
    };
    if (save_items_per_page) {
      request_data.save_items_per_page = 1;
    }
    setLoading(true);
    request(config.actions.list, request_data).done(function (response) {
      if (!response || !response.success || !response.data) {
        renderEmpty(messageFrom(response, config.i18n.load_failed), false);
        return;
      }
      state.storageReady = !!response.data.storage_ready;
      if (!state.storageReady) {
        $('.wpbc_appointment_services__table tbody').empty();
        setFieldsEnabled(false);
        renderEmpty(response.data.message || config.i18n.not_connected, true);
        return;
      }
      sync_listing_settings(response.data.listing || config.listing || {});
      sync_sorting_controls(response.data.sorting || {});
      indexProviders(response.data.providers || []);
      updateSummary(response.data.counts, response.data.provider_count);
      renderList(response.data.services || [], response.data.pagination || {});
      updateControls();
      if (state.selectedId) {
        loadOne(state.selectedId);
      }
    }).fail(function (xhr) {
      state.storageReady = false;
      setFieldsEnabled(false);
      renderEmpty(messageFrom(xhr.responseJSON, config.i18n.load_failed), false);
    }).always(function () {
      setLoading(false);
    });
  }
  /** Archive one Service after confirmation, then refresh the list. */
  function archiveService(serviceId) {
    if (!serviceId || state.busy || !w.confirm(config.i18n.confirm_archive || 'Archive this Service?')) {
      return;
    }
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
    if (!$(event.target).closest('button, a').length) {
      loadOne(Number($(this).data('service-id') || 0));
    }
  });
  $(document).on('keydown', '.wpbc_appointment_services__item', function (event) {
    if (!$(event.target).closest('button, a').length && ('Enter' === event.key || ' ' === event.key)) {
      event.preventDefault();
      loadOne(Number($(this).data('service-id') || 0));
    }
  });
  $(document).on('click', '.wpbc_appointment_services__row_edit', function () {
    loadOne(Number($(this).data('service-id') || 0));
  });
  $(document).on('click', '.wpbc_appointment_services__row_archive', function () {
    archiveService(Number($(this).data('service-id') || 0));
  });
  $(document).on('click', '.wpbc_appointment_services__status_filter', function () {
    state.status = String($(this).data('service-status') || 'all');
    state.page = 1;
    $('.wpbc_appointment_services__status_filter').removeClass('is-active').attr('aria-pressed', 'false');
    $(this).addClass('is-active').attr('aria-pressed', 'true');
    loadList();
  });
  $(document).on('click', '.wpbc_appointment_services__page_prev', function () {
    if (state.page > 1) {
      state.page--;
      loadList();
    }
  });
  $(document).on('click', '.wpbc_appointment_services__page_next', function () {
    if (state.page < state.total_pages) {
      state.page++;
      loadList();
    }
  });
  $(document).on('click', '[data-wpbc-listing-sort="appointment_services_catalog"]', function (event) {
    var sort_by = String($(this).data('wpbc-listing-sort-key') || '');
    event.preventDefault();
    if (!sort_by) {
      return;
    }
    state.sort_order = sort_by === state.sort_by && 'asc' === state.sort_order ? 'desc' : 'asc';
    state.sort_by = sort_by;
    state.page = 1;
    loadList();
  });
  $(document).on('change', '[data-wpbc-listing-page-number-control="appointment_services_catalog"]', function () {
    request_selected_page($(this));
  });
  $(document).on('keydown', '[data-wpbc-listing-page-number-control="appointment_services_catalog"]', function (event) {
    if ('Enter' === event.key) {
      event.preventDefault();
      request_selected_page($(this));
    }
  });
  $(document).on('change', '[data-wpbc-listing-items-per-page-control="appointment_services_catalog"]', function () {
    var page_size = Number($(this).val());
    if (!isFinite(page_size) || page_size < 1 || page_size === state.page_size) {
      return;
    }
    state.page_size = page_size;
    state.page = 1;
    loadList(true);
  });
  $(document).on('click', '.wpbc_appointment_services__add', function () {
    if (!state.storageReady || state.busy || !can_replace_editor()) {
      return;
    }
    fillEditor(blankService());
    updateUrl(0);
    open_add_service_inspector();
  });
  $(document).on('click', '.wpbc_appointment_services__save', function () {
    if (!state.storageReady || state.busy) {
      return;
    }
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
      setBusy(false);
    });
  });
  $(document).on('click', '.wpbc_appointment_services__duplicate', function () {
    if (!state.selectedId || state.busy) {
      return;
    }
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
      setBusy(false);
    });
  });
  $(document).on('click', '.wpbc_appointment_services__archive', function () {
    archiveService(state.selectedId);
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
    searchTimer = w.setTimeout(loadList, 250);
  });
  $(document).on('change', '#wpbc_service_provider_filter', function () {
    state.page = 1;
    loadList();
  });
  $(function () {
    if ($('[data-wpbc-appointment-services-page="1"]').length) {
      loadList();
    }
  });
})(window, jQuery);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1hcHBvaW50bWVudC1zZXJ2aWNlcy9fb3V0L2FwcG9pbnRtZW50X3NlcnZpY2VzX3BhZ2UuanMiLCJuYW1lcyI6WyJ3IiwiJCIsImNvbmZpZyIsIndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfY29uZmlnIiwic3RhdGUiLCJzdG9yYWdlUmVhZHkiLCJzZWxlY3RlZElkIiwiTnVtYmVyIiwic2VsZWN0ZWRfaWQiLCJyZXF1ZXN0ZWRfZm9jdXMiLCJTdHJpbmciLCJmb2N1c19zZWN0aW9uIiwiZm9jdXNfaGFuZGxlZCIsImJ1c3kiLCJzdGF0dXMiLCJzZXJ2aWNlcyIsInByb3ZpZGVycyIsInByb3ZpZGVyQ291bnQiLCJlZGl0b3Jfc25hcHNob3QiLCJwYWdlIiwicGFnZV9zaXplIiwibGlzdGluZyIsIml0ZW1zX3Blcl9wYWdlIiwidG90YWxfaXRlbXMiLCJ0b3RhbF9wYWdlcyIsInNvcnRfYnkiLCJzb3J0X29yZGVyIiwic2VhcmNoVGltZXIiLCJ3ZWVrZGF5S2V5cyIsIm1lc3NhZ2VGcm9tIiwicmVzcG9uc2UiLCJmYWxsYmFjayIsImRhdGEiLCJtZXNzYWdlIiwibm90aWZ5IiwidHlwZSIsIndwYmNfYWRtaW5fc2hvd19tZXNzYWdlIiwic2hvd19wcm9jZXNzaW5nX25vdGljZSIsIndwYmNfYWRtaW5fc2hvd19tZXNzYWdlX3Byb2Nlc3NpbmciLCJsYXN0IiwiY2xvc2VzdCIsImhpZGVfcHJvY2Vzc2luZ19ub3RpY2UiLCIkcHJvY2Vzc2luZ19ub3RpY2UiLCJsZW5ndGgiLCJzdG9wIiwiaGlkZSIsInJlcXVlc3QiLCJhY3Rpb24iLCJhamF4IiwidXJsIiwiYWpheF91cmwiLCJkYXRhVHlwZSIsImV4dGVuZCIsIm5vbmNlIiwiYWx3YXlzIiwic2V0TG9hZGluZyIsImlzTG9hZGluZyIsInRvZ2dsZUNsYXNzIiwiYXR0ciIsInN3aXRjaFJpZ2h0UGFuZWwiLCIkdGFiIiwicGFuZWxJZCIsInBhbmVsIiwiZG9jdW1lbnQiLCJnZXRFbGVtZW50QnlJZCIsIiR0YWJzIiwiZmluZCIsIiRwYW5lbHMiLCJwcm9wIiwidXBkYXRlQ29udHJvbHMiLCJub3RpZnlfc2V0dXBfd2l6YXJkX2xheW91dF9jaGFuZ2VkIiwidHJpZ2dlciIsInNldFRpbWVvdXQiLCJleHBhbmRfc2VydmljZV9pbnNwZWN0b3IiLCIkc2V0dGluZ3NfdGFiIiwid3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fZG9fbWF4Iiwib3Blbl9zZXJ2aWNlX2luc3BlY3Rvcl9ncm91cCIsImZpZWxkc19zZWxlY3RvciIsImZvY3VzX3NlbGVjdG9yIiwiJGdyb3VwX2ZpZWxkcyIsIiRncm91cCIsIiRncm91cF9oZWFkZXIiLCJjaGlsZHJlbiIsImdyb3VwX2VsZW1lbnQiLCJnZXQiLCJmb2N1c19lbGVtZW50IiwicXVlcnlTZWxlY3RvciIsImFkZENsYXNzIiwicmVtb3ZlQ2xhc3MiLCJvZmZzZXRXaWR0aCIsInNjcm9sbEludG9WaWV3IiwiYmVoYXZpb3IiLCJibG9jayIsImlubGluZSIsImVycm9yIiwiZm9jdXMiLCJwcmV2ZW50U2Nyb2xsIiwib3Blbl9hZGRfc2VydmljZV9pbnNwZWN0b3IiLCJmb2N1c19yZXF1ZXN0ZWRfc2VydmljZV9zZWN0aW9uIiwiaGlzdG9yeSIsIlVSTCIsImxvY2F0aW9uIiwiaHJlZiIsInNlYXJjaFBhcmFtcyIsImRlbGV0ZSIsInJlcGxhY2VTdGF0ZSIsInRvU3RyaW5nIiwidG9nZ2xlSW5zcGVjdG9yR3JvdXAiLCIkYnV0dG9uIiwiJGZpZWxkcyIsImlzT3BlbiIsImhhc0NsYXNzIiwiZWRpdG9ySXNPcGVuIiwic3luY19udW1lcmljX3JhbmdlIiwiZmllbGRfaWQiLCIkZmllbGQiLCIkcmFuZ2UiLCJ2YWx1ZSIsInZhbCIsImRlZmF1bHRfbWluIiwiZGVmYXVsdF9tYXgiLCJzdGVwIiwicmFuZ2VfbWF4IiwiaXNGaW5pdGUiLCJNYXRoIiwiY2VpbCIsIm1pbiIsIm1heCIsInN5bmNfYWxsX251bWVyaWNfcmFuZ2VzIiwiZWFjaCIsInN5bmNfc3RhdHVzX3JhZGlvcyIsInVwZGF0ZU1lZGlhUHJldmlldyIsInBpY3R1cmVVcmwiLCJ0cmltIiwiJGltYWdlIiwicmVtb3ZlQXR0ciIsIm9wZW4iLCJoYXNQaWN0dXJlIiwic2hvd19zYXZlIiwic2V0QnVzeSIsInNldEZpZWxkc0VuYWJsZWQiLCJlbmFibGVkIiwiYmxhbmtTZXJ2aWNlIiwic2VydmljZV9pZCIsInRpdGxlIiwiZGVzY3JpcHRpb24iLCJwaWN0dXJlX3VybCIsImR1cmF0aW9uX21pbnV0ZXMiLCJidWZmZXJfYmVmb3JlX21pbnV0ZXMiLCJidWZmZXJfYWZ0ZXJfbWludXRlcyIsImJhc2VfY29zdCIsImJvb2tpbmdfZm9ybV9pZCIsInJlc291cmNlX2lkcyIsImZpbGxFZGl0b3IiLCJzZXJ2aWNlIiwia2V5IiwiY2FwdHVyZV9lZGl0b3Jfc25hcHNob3QiLCJjb2xsZWN0RWRpdG9yIiwiSlNPTiIsInN0cmluZ2lmeSIsImlzX2VkaXRvcl9kaXJ0eSIsImNhbl9yZXBsYWNlX2VkaXRvciIsImNvbmZpcm0iLCJpMThuIiwiY29uZmlybV9kaXNjYXJkIiwidXBkYXRlVXJsIiwic2VydmljZUlkIiwic2V0IiwicmVuZGVyRW1wdHkiLCJzdG9yYWdlTm90aWNlIiwiJGVtcHR5Iiwibm9Qcm92aWRlcnMiLCJ0ZXh0Iiwibm90X2Nvbm5lY3RlZCIsIm5vX3Byb3ZpZGVycyIsImVtcHR5Iiwibm9fcHJvdmlkZXJzX2hlbHAiLCJlbXB0eV9oZWxwIiwiaW5kZXhQcm92aWRlcnMiLCJpbmRleCIsInByb3ZpZGVyIiwiaWQiLCJ1cGRhdGVTdW1tYXJ5IiwiY291bnRzIiwiYWxsIiwiYWN0aXZlIiwiaW5hY3RpdmUiLCJhcmNoaXZlZCIsImNvdW50IiwiZm9ybWF0Q29zdCIsImNvc3QiLCJhbW91bnQiLCJzeW1ib2wiLCJjdXJyZW5jeV9zeW1ib2wiLCJ0b0ZpeGVkIiwicHJvdmlkZXJOb2RlcyIsImlkcyIsIm1hcCIsIiRzdGFjayIsIm5vX3Byb3ZpZGVyIiwic2xpY2UiLCJpbml0aWFscyIsImF2YXRhcl91cmwiLCJoYXNfYXZhaWxhYmlsaXR5IiwiaGFzX3dlZWtseV9hdmFpbGFiaWxpdHkiLCJwcm92aWRlcl90aXRsZSIsImF2YXRhcl90aXRsZSIsImF2YXRhcl9hdHRyaWJ1dGVzIiwiJGF2YXRhciIsIm5vX2F2YWlsYWJpbGl0eSIsImF2YWlsYWJpbGl0eV91cmwiLCJlZGl0X2F2YWlsYWJpbGl0eSIsInJlcGxhY2UiLCJzcmMiLCJhbHQiLCJsb2FkaW5nIiwiYXBwZW5kVG8iLCJhcHBlbmQiLCJtb3JlX3Byb3ZpZGVycyIsInNlcnZpY2VUaHVtYm5haWxOb2RlIiwic2VydmljZV90aXRsZSIsInVudGl0bGVkIiwic2VydmljZV9kZXNjcmlwdGlvbiIsIm5vX2Rlc2NyaXB0aW9uIiwidG9vbHRpcF9mb3JtYXQiLCJzZXJ2aWNlX3RodW1ibmFpbF90b29sdGlwIiwidG9vbHRpcF90ZXh0IiwiJHRodW1ibmFpbCIsInJvbGUiLCJ0YWJpbmRleCIsImRlY29kaW5nIiwiZGVzdHJveV9zZXJ2aWNlX3RodW1ibmFpbF90b29sdGlwcyIsIl90aXBweSIsImRlc3Ryb3kiLCJyZWZyZXNoX3NlcnZpY2VfdGh1bWJuYWlsX3Rvb2x0aXBzIiwibGlzdGluZ19zZWxlY3RvciIsIiR0aHVtYm5haWxzIiwidG9vbHRpcHNfaW5pdGlhbGl6ZWQiLCJ3cGJjX2RlZmluZV90aXBweV90b29sdGlwcyIsInNlcnZpY2VfZHVyYXRpb25fbm9kZSIsImR1cmF0aW9uX2Zvcm1hdCIsImJ1ZmZlcnNfZm9ybWF0IiwiYnVmZmVyc19zdW1tYXJ5IiwiYnVmZmVyc190b29sdGlwX2Zvcm1hdCIsImJ1ZmZlcnNfdG9vbHRpcCIsIiRkdXJhdGlvbl9kZXRhaWxzIiwicHJvdmlkZXJzX2F2YWlsYWJsZV9vbiIsImRheSIsImF2YWlsYWJsZV9wcm92aWRlcnMiLCJ3ZWVrZGF5cyIsInB1c2giLCJhdmFpbGFiaWxpdHlfZWRpdF9saW5rcyIsIiRsaW5rcyIsImVkaXRfcHJvdmlkZXJfYXZhaWxhYmlsaXR5IiwibGlua190aXRsZSIsInN0YXR1c0xhYmVsIiwiZHJhZnQiLCJzaG93aW5nVGV4dCIsImZyb20iLCJ0byIsInRvdGFsIiwiZm9ybWF0Iiwic2hvd2luZyIsInN5bmNfbGlzdGluZ19zZXR0aW5ncyIsImxpc3Rpbmdfc2V0dGluZ3MiLCJzeW5jX3NvcnRpbmdfY29udHJvbHMiLCJzb3J0aW5nIiwiJHNvcnRfbGluayIsImlzX2FjdGl2ZSIsIiRzb3J0X2ljb24iLCIkY29sdW1uIiwiaGFzX2FjdGl2ZV9zb3J0Iiwic3luY19wYWdpbmF0aW9uX2NvbnRyb2xzIiwicGFnaW5hdGlvbiIsIm1heGltdW1fcGFnZSIsIiRwYWdlX2NvbnRyb2wiLCJyZXF1ZXN0X3NlbGVjdGVkX3BhZ2UiLCJyZXF1ZXN0ZWRfcGFnZSIsImxvYWRMaXN0IiwicmVuZGVyTGlzdCIsIiRsaXN0IiwiJHRib2R5IiwiaXRlbXNfZnJvbSIsIml0ZW1zX3RvIiwicGFnZV9pdGVtcyIsInBhZ2VfbnVtYmVyIiwiJHJvdyIsIiRzZXJ2aWNlQ2VsbCIsImNvbHVtbl9zZXJ2aWNlIiwiJHNlcnZpY2VJZGVudGl0eSIsIiRzZXJ2aWNlQ29weSIsInByZXBlbmRUbyIsImNvbHVtbl9kdXJhdGlvbiIsInByaWNpbmdfYXZhaWxhYmxlIiwiY29sdW1uX3ByaWNlIiwiY29sdW1uX3Byb3ZpZGVycyIsIiRhdmFpbGFiaWxpdHlDZWxsIiwiY29sdW1uX3dlZWtseV9hdmFpbGFiaWxpdHkiLCIkYXZhaWxhYmlsaXR5V2VlayIsImhhc1dlZWtseUF2YWlsYWJpbGl0eSIsImRheUluZGV4IiwiYXZhaWxhYmxlIiwiZGF5VGl0bGUiLCJwcm92aWRlcl90aXRsZXMiLCJmaWx0ZXIiLCJhdmFpbGFiaWxpdHlfdGl0bGUiLCJqb2luIiwibm9fYXZhaWxhYmxlX3Byb3ZpZGVycyIsIiRzdGF0dXNfY2VsbCIsImNvbHVtbl9zdGF0dXMiLCIkc3RhdHVzX2lkZW50aXR5IiwiY29sdW1uX2lkIiwiJGFjdGlvbnMiLCJjb2x1bW5fYWN0aW9ucyIsImVkaXQiLCJhcmNoaXZlIiwibG9hZE9uZSIsImFjdGlvbnMiLCJsb2FkIiwiZG9uZSIsInN1Y2Nlc3MiLCJsb2FkX2ZhaWxlZCIsImZhaWwiLCJ4aHIiLCJyZXNwb25zZUpTT04iLCJzYXZlX2l0ZW1zX3Blcl9wYWdlIiwicmVxdWVzdF9kYXRhIiwic2VhcmNoIiwicmVzb3VyY2VfaWQiLCJsaXN0Iiwic3RvcmFnZV9yZWFkeSIsInByb3ZpZGVyX2NvdW50IiwiYXJjaGl2ZVNlcnZpY2UiLCJjb25maXJtX2FyY2hpdmUiLCJhcmNoaXZlX2ZhaWxlZCIsIm9uIiwiZXZlbnQiLCJwcmV2ZW50RGVmYXVsdCIsInRhcmdldCIsInNhdmUiLCJzYXZlX2ZhaWxlZCIsImR1cGxpY2F0ZSIsImR1cGxpY2F0ZV9mYWlsZWQiLCJjaGVja2VkIiwiY2xlYXJUaW1lb3V0Iiwid2luZG93IiwialF1ZXJ5Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1hcHBvaW50bWVudC1zZXJ2aWNlcy9fc3JjL2FwcG9pbnRtZW50X3NlcnZpY2VzX3BhZ2UuanMiXSwic291cmNlc0NvbnRlbnQiOlsiKCBmdW5jdGlvbiAoIHcsICQgKSB7XG5cdCd1c2Ugc3RyaWN0Jztcblx0dmFyIGNvbmZpZyA9IHcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19jb25maWcgfHwge307XG5cdHZhciBzdGF0ZSA9IHtcblx0XHRzdG9yYWdlUmVhZHk6IGZhbHNlLFxuXHRcdHNlbGVjdGVkSWQ6IE51bWJlciggY29uZmlnLnNlbGVjdGVkX2lkIHx8IDAgKSxcblx0XHRyZXF1ZXN0ZWRfZm9jdXM6IFN0cmluZyggY29uZmlnLmZvY3VzX3NlY3Rpb24gfHwgJycgKSxcblx0XHRmb2N1c19oYW5kbGVkOiBmYWxzZSxcblx0XHRidXN5OiBmYWxzZSxcblx0XHRzdGF0dXM6ICdhbGwnLFxuXHRcdHNlcnZpY2VzOiBbXSxcblx0XHRwcm92aWRlcnM6IHt9LFxuXHRcdHByb3ZpZGVyQ291bnQ6IDAsXG5cdFx0ZWRpdG9yX3NuYXBzaG90OiAnJyxcblx0XHRwYWdlOiAxLFxuXHRcdHBhZ2Vfc2l6ZTogTnVtYmVyKCBjb25maWcubGlzdGluZyAmJiBjb25maWcubGlzdGluZy5pdGVtc19wZXJfcGFnZSA/IGNvbmZpZy5saXN0aW5nLml0ZW1zX3Blcl9wYWdlIDogMTAgKSxcblx0XHR0b3RhbF9pdGVtczogMCxcblx0XHR0b3RhbF9wYWdlczogMCxcblx0XHRzb3J0X2J5OiBTdHJpbmcoIGNvbmZpZy5saXN0aW5nICYmIGNvbmZpZy5saXN0aW5nLnNvcnRfYnkgPyBjb25maWcubGlzdGluZy5zb3J0X2J5IDogJ3NlcnZpY2VfaWQnICksXG5cdFx0c29ydF9vcmRlcjogU3RyaW5nKCBjb25maWcubGlzdGluZyAmJiBjb25maWcubGlzdGluZy5zb3J0X29yZGVyID8gY29uZmlnLmxpc3Rpbmcuc29ydF9vcmRlciA6ICdkZXNjJyApXG5cdH07XG5cdHZhciBzZWFyY2hUaW1lciA9IDA7XG5cdHZhciB3ZWVrZGF5S2V5cyA9IFsgJ21vbicsICd0dWUnLCAnd2VkJywgJ3RodScsICdmcmknLCAnc2F0JywgJ3N1bicgXTtcblxuXHQvKiogRXh0cmFjdCBhbiBBUEkgbWVzc2FnZSB3aGlsZSBwcmVzZXJ2aW5nIGEgY2FsbGVyLXByb3ZpZGVkIGZhbGxiYWNrLiAqL1xuXHRmdW5jdGlvbiBtZXNzYWdlRnJvbSggcmVzcG9uc2UsIGZhbGxiYWNrICkgeyByZXR1cm4gcmVzcG9uc2UgJiYgcmVzcG9uc2UuZGF0YSAmJiByZXNwb25zZS5kYXRhLm1lc3NhZ2UgPyByZXNwb25zZS5kYXRhLm1lc3NhZ2UgOiBmYWxsYmFjazsgfVxuXHQvKiogRGlzcGxheSBhIHNoYXJlZCBCb29raW5nIENhbGVuZGFyIGFkbWluaXN0cmF0b3Igbm90aWNlLiAqL1xuXHRmdW5jdGlvbiBub3RpZnkoIG1lc3NhZ2UsIHR5cGUgKSB7XG5cdFx0aWYgKCBtZXNzYWdlICYmIHR5cGVvZiB3LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlID09PSAnZnVuY3Rpb24nICkgeyB3LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCBtZXNzYWdlLCB0eXBlIHx8ICdpbmZvJywgNTAwMCwgZmFsc2UgKTsgfVxuXHR9XG5cdC8qKlxuXHQgKiBTaG93IHRoZSBuYXRpdmUgQm9va2luZyBDYWxlbmRhciBQcm9jZXNzaW5nIG5vdGljZS5cblx0ICpcblx0ICogVGhlIHJldHVybmVkIGVsZW1lbnQgaWRlbnRpZmllcyB0aGlzIHNwZWNpZmljIHJlcXVlc3QncyBub3RpY2Ugc29cblx0ICogb3ZlcmxhcHBpbmcgcmVxdWVzdHMgY2Fubm90IGRpc21pc3MgZWFjaCBvdGhlcidzIGZlZWRiYWNrLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtqUXVlcnl9IFByb2Nlc3Npbmcgbm90aWNlIHdyYXBwZXIsIG9yIGFuIGVtcHR5IGNvbGxlY3Rpb24uXG5cdCAqL1xuXHRmdW5jdGlvbiBzaG93X3Byb2Nlc3Npbmdfbm90aWNlKCkge1xuXHRcdGlmICggJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHcud3BiY19hZG1pbl9zaG93X21lc3NhZ2VfcHJvY2Vzc2luZyApIHtcblx0XHRcdHJldHVybiAkKCk7XG5cdFx0fVxuXG5cdFx0dy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZV9wcm9jZXNzaW5nKCAnJyApO1xuXG5cdFx0cmV0dXJuICQoICcjYWpheF93b3JraW5nIC53cGJjX3Byb2Nlc3Npbmcud3BiY19zcGluJyApLmxhc3QoKS5jbG9zZXN0KCAnW2lkXj1cIndwYmNfbm90aWNlX1wiXScgKTtcblx0fVxuXHQvKipcblx0ICogSGlkZSB0aGUgUHJvY2Vzc2luZyBub3RpY2UgY3JlYXRlZCBmb3Igb25lIGNvbXBsZXRlZCByZXF1ZXN0LlxuXHQgKlxuXHQgKiBAcGFyYW0ge2pRdWVyeX0gJHByb2Nlc3Npbmdfbm90aWNlIE5vdGljZSB3cmFwcGVyIHJldHVybmVkIGJ5IHNob3dfcHJvY2Vzc2luZ19ub3RpY2UoKS5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGhpZGVfcHJvY2Vzc2luZ19ub3RpY2UoICRwcm9jZXNzaW5nX25vdGljZSApIHtcblx0XHRpZiAoICRwcm9jZXNzaW5nX25vdGljZSAmJiAkcHJvY2Vzc2luZ19ub3RpY2UubGVuZ3RoICkge1xuXHRcdFx0JHByb2Nlc3Npbmdfbm90aWNlLnN0b3AoIHRydWUsIHRydWUgKS5oaWRlKCk7XG5cdFx0fVxuXHR9XG5cdC8qKlxuXHQgKiBTZW5kIGFuIGF1dGhlbnRpY2F0ZWQgQXBwb2ludG1lbnQgU2VydmljZXMgQUpBWCByZXF1ZXN0LlxuXHQgKlxuXHQgKiBFdmVyeSByZXF1ZXN0IHVzZXMgdGhlIHNoYXJlZCBhZG1pbmlzdHJhdG9yIFByb2Nlc3Npbmcgbm90aWNlIGFuZCByZW1vdmVzXG5cdCAqIG9ubHkgaXRzIG93biBub3RpY2UgYWZ0ZXIgdGhlIHJlcXVlc3Qgc2V0dGxlcy5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IGFjdGlvbiBXb3JkUHJlc3MgQUpBWCBhY3Rpb24gbmFtZS5cblx0ICogQHBhcmFtIHtPYmplY3R9IGRhdGEgUmVxdWVzdC1zcGVjaWZpYyBwYXlsb2FkLlxuXHQgKiBAcmV0dXJuIHtqcVhIUn0galF1ZXJ5IEFKQVggcHJvbWlzZSBmb3IgdGhlIHJlcXVlc3QuXG5cdCAqL1xuXHRmdW5jdGlvbiByZXF1ZXN0KCBhY3Rpb24sIGRhdGEgKSB7XG5cdFx0dmFyICRwcm9jZXNzaW5nX25vdGljZSA9IHNob3dfcHJvY2Vzc2luZ19ub3RpY2UoKTtcblxuXHRcdHJldHVybiAkLmFqYXgoIHsgdXJsOiBjb25maWcuYWpheF91cmwsIHR5cGU6ICdQT1NUJywgZGF0YVR5cGU6ICdqc29uJywgZGF0YTogJC5leHRlbmQoIHsgYWN0aW9uOiBhY3Rpb24sIG5vbmNlOiBjb25maWcubm9uY2UgfSwgZGF0YSB8fCB7fSApIH0gKVxuXHRcdFx0LmFsd2F5cyggZnVuY3Rpb24gKCkgeyBoaWRlX3Byb2Nlc3Npbmdfbm90aWNlKCAkcHJvY2Vzc2luZ19ub3RpY2UgKTsgfSApO1xuXHR9XG5cdC8qKiBUb2dnbGUgdGhlIGxvYWRpbmcgb3ZlcmxheSB3aXRob3V0IGhpZGluZyB0aGUgZXhpc3RpbmcgU2VydmljZSB0YWJsZS4gKi9cblx0ZnVuY3Rpb24gc2V0TG9hZGluZyggaXNMb2FkaW5nICkge1xuXHRcdCQoICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fbG9hZGluZycgKS50b2dnbGVDbGFzcyggJ2lzLXZpc2libGUnLCBpc0xvYWRpbmcgKS5hdHRyKCAnYXJpYS1oaWRkZW4nLCBpc0xvYWRpbmcgPyAnZmFsc2UnIDogJ3RydWUnICk7XG5cdFx0JCggJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19jb250ZW50JyApLmF0dHIoICdhcmlhLWJ1c3knLCBpc0xvYWRpbmcgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdH1cblx0LyoqIEFjdGl2YXRlIHRoZSBTZXR0aW5ncyBvciBIZWxwIHBhbmVsIHNlbGVjdGVkIGluIHRoZSByaWdodCBzaWRlYmFyLiAqL1xuXHRmdW5jdGlvbiBzd2l0Y2hSaWdodFBhbmVsKCAkdGFiICkge1xuXHRcdHZhciBwYW5lbElkID0gJHRhYi5hdHRyKCAnYXJpYS1jb250cm9scycgKTtcblx0XHR2YXIgcGFuZWwgPSBwYW5lbElkID8gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIHBhbmVsSWQgKSA6IG51bGw7XG5cdFx0dmFyICR0YWJzID0gJHRhYi5jbG9zZXN0KCAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX3JpZ2h0YmFyX3RhYnMnICkuZmluZCggJ1tyb2xlPVwidGFiXCJdJyApO1xuXHRcdHZhciAkcGFuZWxzID0gJCggJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19yaWdodGJhciBbcm9sZT1cInRhYnBhbmVsXCJdJyApO1xuXHRcdGlmICggISBwYW5lbCApIHsgcmV0dXJuOyB9XG5cdFx0JHRhYnMuYXR0ciggJ2FyaWEtc2VsZWN0ZWQnLCAnZmFsc2UnICk7XG5cdFx0JHRhYi5hdHRyKCAnYXJpYS1zZWxlY3RlZCcsICd0cnVlJyApO1xuXHRcdCRwYW5lbHMucHJvcCggJ2hpZGRlbicsIHRydWUgKS5hdHRyKCAnYXJpYS1oaWRkZW4nLCAndHJ1ZScgKTtcblx0XHQkKCBwYW5lbCApLnByb3AoICdoaWRkZW4nLCBmYWxzZSApLmF0dHIoICdhcmlhLWhpZGRlbicsICdmYWxzZScgKTtcblx0XHR1cGRhdGVDb250cm9scygpO1xuXHR9XG5cdC8qKlxuXHQgKiBUZWxsIHRoZSBhY3RpdmUgU2V0dXAgV2l6YXJkIGJhciB0aGF0IHRoZSBwYWdlIHdvcmtzcGFjZSBjaGFuZ2VkIHdpZHRoLlxuXHQgKlxuXHQgKiBUaGUgZGVsYXllZCBub3RpZmljYXRpb24gcnVucyBhZnRlciB0aGUgc2hhcmVkIHNpZGViYXIgdHJhbnNpdGlvbiBzbyB0aGVcblx0ICogc2V0dXAgYmFyIGNhbiBtZWFzdXJlIHRoZSBmaW5hbCBpbnNwZWN0b3IgYm91bmRhcnkuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBub3RpZnlfc2V0dXBfd2l6YXJkX2xheW91dF9jaGFuZ2VkKCkge1xuXHRcdCQoIGRvY3VtZW50ICkudHJpZ2dlciggJ3dwYmNfc2V0dXBfd2l6YXJkX2xheW91dF9jaGFuZ2VkJyApO1xuXHRcdHcuc2V0VGltZW91dCggZnVuY3Rpb24gKCkgeyAkKCBkb2N1bWVudCApLnRyaWdnZXIoICd3cGJjX3NldHVwX3dpemFyZF9sYXlvdXRfY2hhbmdlZCcgKTsgfSwgMzAwICk7XG5cdH1cblx0LyoqXG5cdCAqIEV4cGFuZCB0aGUgcmlnaHQgc2lkZWJhciBhbmQgZGlzcGxheSB0aGUgU2VydmljZSBTZXR0aW5ncyBpbnNwZWN0b3IuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBleHBhbmRfc2VydmljZV9pbnNwZWN0b3IoKSB7XG5cdFx0dmFyICRzZXR0aW5nc190YWIgPSAkKCAnI3dwYmNfdGFiX3NlcnZpY2Vfc2V0dGluZ3MnICk7XG5cblx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3LndwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX2RvX21heCApIHtcblx0XHRcdHcud3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fZG9fbWF4KCk7XG5cdFx0fVxuXHRcdGlmICggJHNldHRpbmdzX3RhYi5sZW5ndGggKSB7XG5cdFx0XHRzd2l0Y2hSaWdodFBhbmVsKCAkc2V0dGluZ3NfdGFiICk7XG5cdFx0fVxuXHRcdG5vdGlmeV9zZXR1cF93aXphcmRfbGF5b3V0X2NoYW5nZWQoKTtcblx0fVxuXHQvKipcblx0ICogUmV2ZWFsLCBleHBhbmQsIGhpZ2hsaWdodCwgYW5kIG9wdGlvbmFsbHkgZm9jdXMgb25lIFNlcnZpY2UgZWRpdG9yIGdyb3VwLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gZmllbGRzX3NlbGVjdG9yIEdyb3VwIGZpZWxkcyBzZWxlY3RvciBmcm9tIHRoZSBmaXhlZCBlZGl0b3IgbWFya3VwLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gZm9jdXNfc2VsZWN0b3IgIE9wdGlvbmFsIGNvbnRyb2wgc2VsZWN0b3IgdG8gZm9jdXMgYWZ0ZXIgc2Nyb2xsaW5nLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIHJlcXVlc3RlZCBpbnNwZWN0b3IgZ3JvdXAgd2FzIGZvdW5kLlxuXHQgKi9cblx0ZnVuY3Rpb24gb3Blbl9zZXJ2aWNlX2luc3BlY3Rvcl9ncm91cCggZmllbGRzX3NlbGVjdG9yLCBmb2N1c19zZWxlY3RvciApIHtcblx0XHR2YXIgJGdyb3VwX2ZpZWxkcyA9ICQoIGZpZWxkc19zZWxlY3RvciApO1xuXHRcdHZhciAkZ3JvdXAgPSAkZ3JvdXBfZmllbGRzLmNsb3Nlc3QoICcud3BiY191aV9fY29sbGFwc2libGVfZ3JvdXAnICk7XG5cdFx0dmFyICRncm91cF9oZWFkZXIgPSAkZ3JvdXAuY2hpbGRyZW4oICcuZ3JvdXBfX2hlYWRlcicgKTtcblx0XHR2YXIgZ3JvdXBfZWxlbWVudCA9ICRncm91cC5nZXQoIDAgKTtcblx0XHR2YXIgZm9jdXNfZWxlbWVudCA9IGZvY3VzX3NlbGVjdG9yID8gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggZm9jdXNfc2VsZWN0b3IgKSA6IG51bGw7XG5cblx0XHRleHBhbmRfc2VydmljZV9pbnNwZWN0b3IoKTtcblx0XHRpZiAoICEgJGdyb3VwLmxlbmd0aCApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQkZ3JvdXAuYWRkQ2xhc3MoICdpcy1vcGVuJyApO1xuXHRcdCRncm91cF9oZWFkZXIuYXR0ciggJ2FyaWEtZXhwYW5kZWQnLCAndHJ1ZScgKTtcblx0XHQkZ3JvdXBfZmllbGRzLnByb3AoICdoaWRkZW4nLCBmYWxzZSApLmF0dHIoICdhcmlhLWhpZGRlbicsICdmYWxzZScgKTtcblx0XHQkZ3JvdXAucmVtb3ZlQ2xhc3MoICd3cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19mb2N1c19wdWxzZScgKTtcblx0XHRpZiAoIGdyb3VwX2VsZW1lbnQgKSB7XG5cdFx0XHR2b2lkIGdyb3VwX2VsZW1lbnQub2Zmc2V0V2lkdGg7XG5cdFx0XHQkZ3JvdXAuYWRkQ2xhc3MoICd3cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19mb2N1c19wdWxzZScgKTtcblx0XHRcdHRyeSB7IGdyb3VwX2VsZW1lbnQuc2Nyb2xsSW50b1ZpZXcoIHsgYmVoYXZpb3I6ICdzbW9vdGgnLCBibG9jazogJ3N0YXJ0JywgaW5saW5lOiAnbmVhcmVzdCcgfSApOyB9XG5cdFx0XHRjYXRjaCAoIGVycm9yICkgeyBncm91cF9lbGVtZW50LnNjcm9sbEludG9WaWV3KCB0cnVlICk7IH1cblx0XHRcdHcuc2V0VGltZW91dCggZnVuY3Rpb24gKCkgeyAkZ3JvdXAucmVtb3ZlQ2xhc3MoICd3cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19mb2N1c19wdWxzZScgKTsgfSwgOTAwICk7XG5cdFx0fVxuXHRcdGlmICggZm9jdXNfZWxlbWVudCAmJiB0eXBlb2YgZm9jdXNfZWxlbWVudC5mb2N1cyA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdHRyeSB7IGZvY3VzX2VsZW1lbnQuZm9jdXMoIHsgcHJldmVudFNjcm9sbDogdHJ1ZSB9ICk7IH1cblx0XHRcdGNhdGNoICggZXJyb3IgKSB7IGZvY3VzX2VsZW1lbnQuZm9jdXMoKTsgfVxuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdC8qKlxuXHQgKiBPcGVuLCByZXZlYWwsIGFuZCBoaWdobGlnaHQgdGhlIEdlbmVyYWwgU2VydmljZSBlZGl0b3Igc2VjdGlvbi5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIG9wZW5fYWRkX3NlcnZpY2VfaW5zcGVjdG9yKCkge1xuXHRcdG9wZW5fc2VydmljZV9pbnNwZWN0b3JfZ3JvdXAoICcjd3BiY19zZXJ2aWNlX2dlbmVyYWwnLCAnW2RhdGEtc2VydmljZS1maWVsZD1cInRpdGxlXCJdJyApO1xuXHR9XG5cdC8qKlxuXHQgKiBBcHBseSB0aGUgb25lLXRpbWUgaW5zcGVjdG9yIGZvY3VzIHJlcXVlc3RlZCBieSBhbiBhZG1pbmlzdHJhdGlvbiBsaW5rLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gZm9jdXNfcmVxdWVzdGVkX3NlcnZpY2Vfc2VjdGlvbigpIHtcblx0XHRpZiAoIHN0YXRlLmZvY3VzX2hhbmRsZWQgfHwgJ2Jvb2tpbmdfZm9ybScgIT09IHN0YXRlLnJlcXVlc3RlZF9mb2N1cyApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIG9wZW5fc2VydmljZV9pbnNwZWN0b3JfZ3JvdXAoICcjd3BiY19zZXJ2aWNlX2Zvcm0nLCAnW2RhdGEtc2VydmljZS1maWVsZD1cImJvb2tpbmdfZm9ybV9pZFwiXScgKSApIHtcblx0XHRcdHN0YXRlLmZvY3VzX2hhbmRsZWQgPSB0cnVlO1xuXHRcdFx0aWYgKCB3Lmhpc3RvcnkgJiYgdy5VUkwgKSB7XG5cdFx0XHRcdHZhciB1cmwgPSBuZXcgdy5VUkwoIHcubG9jYXRpb24uaHJlZiApO1xuXHRcdFx0XHR1cmwuc2VhcmNoUGFyYW1zLmRlbGV0ZSggJ3dwYmNfc2VydmljZV9mb2N1cycgKTtcblx0XHRcdFx0dy5oaXN0b3J5LnJlcGxhY2VTdGF0ZSgge30sICcnLCB1cmwudG9TdHJpbmcoKSApO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHQvKiogRXhwYW5kIG9yIGNvbGxhcHNlIG9uZSBpbnNwZWN0b3IgZmllbGQgZ3JvdXAuICovXG5cdGZ1bmN0aW9uIHRvZ2dsZUluc3BlY3Rvckdyb3VwKCAkYnV0dG9uICkge1xuXHRcdHZhciAkZ3JvdXAgPSAkYnV0dG9uLmNsb3Nlc3QoICcud3BiY191aV9fY29sbGFwc2libGVfZ3JvdXAnICk7XG5cdFx0dmFyICRmaWVsZHMgPSAkZ3JvdXAuZmluZCggJz4gLmdyb3VwX19maWVsZHMnICk7XG5cdFx0dmFyIGlzT3BlbiA9ICRncm91cC5oYXNDbGFzcyggJ2lzLW9wZW4nICk7XG5cdFx0JGdyb3VwLnRvZ2dsZUNsYXNzKCAnaXMtb3BlbicsICEgaXNPcGVuICk7XG5cdFx0JGJ1dHRvbi5hdHRyKCAnYXJpYS1leHBhbmRlZCcsIGlzT3BlbiA/ICdmYWxzZScgOiAndHJ1ZScgKTtcblx0XHQkZmllbGRzLnByb3AoICdoaWRkZW4nLCBpc09wZW4gKS5hdHRyKCAnYXJpYS1oaWRkZW4nLCBpc09wZW4gPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdH1cblx0LyoqIERldGVybWluZSB3aGV0aGVyIGEgU2VydmljZSBpcyBjdXJyZW50bHkgbG9hZGVkIGludG8gdGhlIGVkaXRvci4gKi9cblx0ZnVuY3Rpb24gZWRpdG9ySXNPcGVuKCkgeyByZXR1cm4gISAkKCAnW2RhdGEtc2VydmljZS1maWVsZD1cInRpdGxlXCJdJyApLnByb3AoICdkaXNhYmxlZCcgKTsgfVxuXHQvKipcblx0ICogU3luY2hyb25pemUgb25lIG51bWVyaWMgU2VydmljZSBmaWVsZCB3aXRoIGl0cyByYW5nZSBjb250cm9sLlxuXHQgKlxuXHQgKiBUaGUgc2xpZGVyIGV4cGFuZHMgdG8gcmVwcmVzZW50IGFuIGV4aXN0aW5nIHZhbHVlIGFib3ZlIGl0cyBub3JtYWwgdmlzdWFsXG5cdCAqIHJhbmdlIHdpdGhvdXQgY2xhbXBpbmcgb3IgcmV3cml0aW5nIHRoYXQgc3RvcmVkIHZhbHVlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gZmllbGRfaWQgU2VydmljZSBmaWVsZCBpZGVudGlmaWVyLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3luY19udW1lcmljX3JhbmdlKCBmaWVsZF9pZCApIHtcblx0XHR2YXIgJGZpZWxkID0gJCggJ1tkYXRhLXNlcnZpY2UtZmllbGQ9XCInICsgZmllbGRfaWQgKyAnXCJdJyApO1xuXHRcdHZhciAkcmFuZ2UgPSAkKCAnW2RhdGEtc2VydmljZS1yYW5nZS1maWVsZD1cIicgKyBmaWVsZF9pZCArICdcIl0nICk7XG5cdFx0dmFyIHZhbHVlID0gTnVtYmVyKCAkZmllbGQudmFsKCkgKTtcblx0XHR2YXIgZGVmYXVsdF9taW4gPSBOdW1iZXIoICRyYW5nZS5kYXRhKCAnc2VydmljZS1yYW5nZS1kZWZhdWx0LW1pbicgKSApO1xuXHRcdHZhciBkZWZhdWx0X21heCA9IE51bWJlciggJHJhbmdlLmRhdGEoICdzZXJ2aWNlLXJhbmdlLWRlZmF1bHQtbWF4JyApICk7XG5cdFx0dmFyIHN0ZXAgPSBOdW1iZXIoICRyYW5nZS5hdHRyKCAnc3RlcCcgKSB8fCAxICk7XG5cdFx0dmFyIHJhbmdlX21heDtcblxuXHRcdGlmICggISAkZmllbGQubGVuZ3RoIHx8ICEgJHJhbmdlLmxlbmd0aCB8fCAhIGlzRmluaXRlKCB2YWx1ZSApICkgeyByZXR1cm47IH1cblx0XHRkZWZhdWx0X21pbiA9IGlzRmluaXRlKCBkZWZhdWx0X21pbiApID8gZGVmYXVsdF9taW4gOiAwO1xuXHRcdGRlZmF1bHRfbWF4ID0gaXNGaW5pdGUoIGRlZmF1bHRfbWF4ICkgPyBkZWZhdWx0X21heCA6IDEwMDtcblx0XHRzdGVwID0gaXNGaW5pdGUoIHN0ZXAgKSAmJiBzdGVwID4gMCA/IHN0ZXAgOiAxO1xuXHRcdHJhbmdlX21heCA9IHZhbHVlID4gZGVmYXVsdF9tYXggPyBkZWZhdWx0X21pbiArICggTWF0aC5jZWlsKCAoIHZhbHVlIC0gZGVmYXVsdF9taW4gKSAvIHN0ZXAgKSAqIHN0ZXAgKSA6IGRlZmF1bHRfbWF4O1xuXHRcdCRyYW5nZS5hdHRyKCB7IG1pbjogZGVmYXVsdF9taW4sIG1heDogcmFuZ2VfbWF4IH0gKS52YWwoIHZhbHVlICk7XG5cdH1cblx0LyoqXG5cdCAqIFN5bmNocm9uaXplIGV2ZXJ5IG51bWVyaWMgU2VydmljZSBmaWVsZCB3aXRoIGl0cyByYW5nZSBjb250cm9sLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3luY19hbGxfbnVtZXJpY19yYW5nZXMoKSB7XG5cdFx0JCggJ1tkYXRhLXNlcnZpY2UtcmFuZ2UtZmllbGRdJyApLmVhY2goIGZ1bmN0aW9uICgpIHsgc3luY19udW1lcmljX3JhbmdlKCBTdHJpbmcoICQoIHRoaXMgKS5kYXRhKCAnc2VydmljZS1yYW5nZS1maWVsZCcgKSB8fCAnJyApICk7IH0gKTtcblx0fVxuXHQvKipcblx0ICogU3luY2hyb25pemUgdGhlIHZpc2libGUgU3RhdHVzIHJhZGlvcyB3aXRoIHRoZSBzdG9yZWQgU2VydmljZSBzdGF0dXMgZmllbGQuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzeW5jX3N0YXR1c19yYWRpb3MoKSB7XG5cdFx0dmFyIHN0YXR1cyA9IFN0cmluZyggJCggJ1tkYXRhLXNlcnZpY2UtZmllbGQ9XCJzdGF0dXNcIl0nICkudmFsKCkgfHwgJ2FjdGl2ZScgKTtcblx0XHQkKCAnW2RhdGEtc2VydmljZS1zdGF0dXMtY2hvaWNlXScgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHQkKCB0aGlzICkucHJvcCggJ2NoZWNrZWQnLCBTdHJpbmcoICQoIHRoaXMgKS52YWwoKSApID09PSBzdGF0dXMgKTtcblx0XHR9ICk7XG5cdH1cblx0LyoqXG5cdCAqIFN5bmNocm9uaXplIHRoZSBTZXJ2aWNlIGltYWdlIHByZXZpZXcgd2l0aCB0aGUgcmVhZG9ubHkgVVJMIGZpZWxkLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gdXBkYXRlTWVkaWFQcmV2aWV3KCkge1xuXHRcdHZhciBwaWN0dXJlVXJsID0gU3RyaW5nKCAkKCAnW2RhdGEtc2VydmljZS1maWVsZD1cInBpY3R1cmVfdXJsXCJdJyApLnZhbCgpIHx8ICcnICkudHJpbSgpO1xuXHRcdHZhciAkaW1hZ2UgPSAkKCAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX21lZGlhX2ltYWdlJyApO1xuXHRcdGlmICggcGljdHVyZVVybCApIHsgJGltYWdlLmF0dHIoICdzcmMnLCBwaWN0dXJlVXJsICk7IH0gZWxzZSB7ICRpbWFnZS5yZW1vdmVBdHRyKCAnc3JjJyApOyB9XG5cdFx0JGltYWdlLnByb3AoICdoaWRkZW4nLCAhIHBpY3R1cmVVcmwgKTtcblx0XHQkKCAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX21lZGlhX3BsYWNlaG9sZGVyJyApLnByb3AoICdoaWRkZW4nLCAhISBwaWN0dXJlVXJsICk7XG5cdH1cblx0LyoqIFN5bmNocm9uaXplIHRvb2xiYXIgYW5kIGluc3BlY3RvciBhY3Rpb24gc3RhdGVzIHdpdGggdGhlIHBhZ2Ugc3RhdGUuICovXG5cdGZ1bmN0aW9uIHVwZGF0ZUNvbnRyb2xzKCkge1xuXHRcdHZhciBvcGVuID0gc3RhdGUuc3RvcmFnZVJlYWR5ICYmIGVkaXRvcklzT3BlbigpO1xuXHRcdHZhciBoYXNQaWN0dXJlID0gISEgU3RyaW5nKCAkKCAnW2RhdGEtc2VydmljZS1maWVsZD1cInBpY3R1cmVfdXJsXCJdJyApLnZhbCgpIHx8ICcnICkudHJpbSgpO1xuXHRcdHZhciBzaG93X3NhdmUgPSBvcGVuICYmICd0cnVlJyA9PT0gJCggJyN3cGJjX3RhYl9zZXJ2aWNlX3NldHRpbmdzJyApLmF0dHIoICdhcmlhLXNlbGVjdGVkJyApO1xuXHRcdCQoICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fYWRkJyApLnByb3AoICdoaWRkZW4nLCBmYWxzZSApLnByb3AoICdkaXNhYmxlZCcsICEgc3RhdGUuc3RvcmFnZVJlYWR5IHx8IHN0YXRlLmJ1c3kgKTtcblx0XHQkKCAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX3JpZ2h0X3NpZGViYXJfZm9vdGVyLCAud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fdG9wX2FjdGlvbnMnICkucHJvcCggJ2hpZGRlbicsICEgc2hvd19zYXZlICk7XG5cdFx0JCggJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19zYXZlJyApLnByb3AoICdoaWRkZW4nLCAhIHNob3dfc2F2ZSApLnByb3AoICdkaXNhYmxlZCcsICEgb3BlbiB8fCBzdGF0ZS5idXN5ICk7XG5cdFx0JCggJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19kdXBsaWNhdGUsIC53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19hcmNoaXZlJyApLnByb3AoICdkaXNhYmxlZCcsICEgb3BlbiB8fCAhIHN0YXRlLnNlbGVjdGVkSWQgfHwgc3RhdGUuYnVzeSApO1xuXHRcdCQoICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fbWVkaWFfcHJldmlldywgLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX3NlbGVjdF9pbWFnZScgKS5wcm9wKCAnZGlzYWJsZWQnLCAhIG9wZW4gfHwgc3RhdGUuYnVzeSApO1xuXHRcdCQoICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fcmVtb3ZlX2ltYWdlJyApLnByb3AoICdkaXNhYmxlZCcsICEgb3BlbiB8fCAhIGhhc1BpY3R1cmUgfHwgc3RhdGUuYnVzeSApO1xuXHR9XG5cdC8qKiBNYXJrIHRoZSBwYWdlIGJ1c3kgZHVyaW5nIGEgbXV0YXRpbmcgcmVxdWVzdCBhbmQgcmVmcmVzaCBjb250cm9scy4gKi9cblx0ZnVuY3Rpb24gc2V0QnVzeSggdmFsdWUgKSB7IHN0YXRlLmJ1c3kgPSB2YWx1ZTsgJCggJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX3BhZ2UnICkudG9nZ2xlQ2xhc3MoICdpcy1idXN5JywgdmFsdWUgKTsgdXBkYXRlQ29udHJvbHMoKTsgfVxuXHQvKiogRW5hYmxlIG9yIGRpc2FibGUgYWxsIGZpZWxkcyBpbiB0aGUgU2VydmljZSBpbnNwZWN0b3IuICovXG5cdGZ1bmN0aW9uIHNldEZpZWxkc0VuYWJsZWQoIGVuYWJsZWQgKSB7ICQoICdbZGF0YS1zZXJ2aWNlLWZpZWxkXSwgW2RhdGEtc2VydmljZS1yYW5nZS1maWVsZF0sIFtkYXRhLXNlcnZpY2Utc3RhdHVzLWNob2ljZV0nICkucHJvcCggJ2Rpc2FibGVkJywgISBlbmFibGVkICk7IHVwZGF0ZUNvbnRyb2xzKCk7IH1cblx0LyoqIFJldHVybiBkZWZhdWx0cyBmb3IgYSBuZXcgdW5zYXZlZCBTZXJ2aWNlLiAqL1xuXHRmdW5jdGlvbiBibGFua1NlcnZpY2UoKSB7XG5cdFx0cmV0dXJuIHsgc2VydmljZV9pZDogMCwgdGl0bGU6ICcnLCBkZXNjcmlwdGlvbjogJycsIHBpY3R1cmVfdXJsOiAnJywgc3RhdHVzOiAnYWN0aXZlJywgZHVyYXRpb25fbWludXRlczogMzAsIGJ1ZmZlcl9iZWZvcmVfbWludXRlczogMCwgYnVmZmVyX2FmdGVyX21pbnV0ZXM6IDAsIGJhc2VfY29zdDogJzAuMDAnLCBib29raW5nX2Zvcm1faWQ6IDAsIHJlc291cmNlX2lkczogW10gfTtcblx0fVxuXHQvKiogUG9wdWxhdGUgdGhlIGluc3BlY3RvciBmcm9tIGEgbm9ybWFsaXplZCBTZXJ2aWNlIHJlc3BvbnNlLiAqL1xuXHRmdW5jdGlvbiBmaWxsRWRpdG9yKCBzZXJ2aWNlICkge1xuXHRcdHNlcnZpY2UgPSAkLmV4dGVuZCggYmxhbmtTZXJ2aWNlKCksIHNlcnZpY2UgfHwge30gKTtcblx0XHRzdGF0ZS5zZWxlY3RlZElkID0gTnVtYmVyKCBzZXJ2aWNlLnNlcnZpY2VfaWQgfHwgMCApO1xuXHRcdCQuZWFjaCggc2VydmljZSwgZnVuY3Rpb24gKCBrZXksIHZhbHVlICkgeyAkKCAnW2RhdGEtc2VydmljZS1maWVsZD1cIicgKyBrZXkgKyAnXCJdJyApLnZhbCggdmFsdWUgKTsgfSApO1xuXHRcdHN5bmNfc3RhdHVzX3JhZGlvcygpO1xuXHRcdHN5bmNfYWxsX251bWVyaWNfcmFuZ2VzKCk7XG5cdFx0dXBkYXRlTWVkaWFQcmV2aWV3KCk7XG5cdFx0c2V0RmllbGRzRW5hYmxlZCggc3RhdGUuc3RvcmFnZVJlYWR5ICk7XG5cdFx0JCggJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19pdGVtJyApLnJlbW92ZUNsYXNzKCAnaXMtc2VsZWN0ZWQnICkuYXR0ciggJ2FyaWEtY3VycmVudCcsICdmYWxzZScgKTtcblx0XHQkKCAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX2l0ZW1bZGF0YS1zZXJ2aWNlLWlkPVwiJyArIHN0YXRlLnNlbGVjdGVkSWQgKyAnXCJdJyApLmFkZENsYXNzKCAnaXMtc2VsZWN0ZWQnICkuYXR0ciggJ2FyaWEtY3VycmVudCcsICd0cnVlJyApO1xuXHRcdGNhcHR1cmVfZWRpdG9yX3NuYXBzaG90KCk7XG5cdH1cblx0LyoqIENvbGxlY3QgdGhlIGN1cnJlbnQgU2VydmljZSBpbnNwZWN0b3IgdmFsdWVzIGZvciBzYXZpbmcuICovXG5cdGZ1bmN0aW9uIGNvbGxlY3RFZGl0b3IoKSB7XG5cdFx0dmFyIHNlcnZpY2UgPSB7IHNlcnZpY2VfaWQ6IHN0YXRlLnNlbGVjdGVkSWQgfTtcblx0XHQkKCAnW2RhdGEtc2VydmljZS1maWVsZF0nICkuZWFjaCggZnVuY3Rpb24gKCkgeyBzZXJ2aWNlWyAkKCB0aGlzICkuZGF0YSggJ3NlcnZpY2UtZmllbGQnICkgXSA9ICQoIHRoaXMgKS52YWwoKTsgfSApO1xuXHRcdHJldHVybiBzZXJ2aWNlO1xuXHR9XG5cdC8qKlxuXHQgKiBTdG9yZSB0aGUgY3VycmVudCBlZGl0b3IgdmFsdWVzIGFzIHRoZSBsYXN0IGxvYWRlZCBvciBzYXZlZCBzdGF0ZS5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGNhcHR1cmVfZWRpdG9yX3NuYXBzaG90KCkge1xuXHRcdHN0YXRlLmVkaXRvcl9zbmFwc2hvdCA9IEpTT04uc3RyaW5naWZ5KCBjb2xsZWN0RWRpdG9yKCkgKTtcblx0fVxuXHQvKipcblx0ICogRGV0ZXJtaW5lIHdoZXRoZXIgdGhlIG9wZW4gU2VydmljZSBlZGl0b3IgY29udGFpbnMgdW5zYXZlZCBjaGFuZ2VzLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gY3VycmVudCBmaWVsZHMgZGlmZmVyIGZyb20gdGhlIGNhcHR1cmVkIHN0YXRlLlxuXHQgKi9cblx0ZnVuY3Rpb24gaXNfZWRpdG9yX2RpcnR5KCkge1xuXHRcdHJldHVybiBlZGl0b3JJc09wZW4oKSAmJiBzdGF0ZS5lZGl0b3Jfc25hcHNob3QgIT09IEpTT04uc3RyaW5naWZ5KCBjb2xsZWN0RWRpdG9yKCkgKTtcblx0fVxuXHQvKipcblx0ICogQ29uZmlybSBiZWZvcmUgcmVwbGFjaW5nIGFuIGVkaXRvciB0aGF0IGNvbnRhaW5zIHVuc2F2ZWQgU2VydmljZSBjaGFuZ2VzLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gcmVwbGFjaW5nIHRoZSBjdXJyZW50IGVkaXRvciBtYXkgY29udGludWUuXG5cdCAqL1xuXHRmdW5jdGlvbiBjYW5fcmVwbGFjZV9lZGl0b3IoKSB7XG5cdFx0cmV0dXJuICEgaXNfZWRpdG9yX2RpcnR5KCkgfHwgdy5jb25maXJtKCBjb25maWcuaTE4bi5jb25maXJtX2Rpc2NhcmQgfHwgJ0Rpc2NhcmQgdW5zYXZlZCBTZXJ2aWNlIGNoYW5nZXM/JyApO1xuXHR9XG5cdC8qKiBSZWZsZWN0IHRoZSBzZWxlY3RlZCBTZXJ2aWNlIGluIHRoZSBhZG1pbiBVUkwgd2l0aG91dCByZWxvYWRpbmcuICovXG5cdGZ1bmN0aW9uIHVwZGF0ZVVybCggc2VydmljZUlkICkge1xuXHRcdGlmICggISB3Lmhpc3RvcnkgfHwgISB3LlVSTCApIHsgcmV0dXJuOyB9XG5cdFx0dmFyIHVybCA9IG5ldyB3LlVSTCggdy5sb2NhdGlvbi5ocmVmICk7XG5cdFx0aWYgKCBzZXJ2aWNlSWQgKSB7IHVybC5zZWFyY2hQYXJhbXMuc2V0KCAnc2VydmljZV9pZCcsIHNlcnZpY2VJZCApOyB9IGVsc2UgeyB1cmwuc2VhcmNoUGFyYW1zLmRlbGV0ZSggJ3NlcnZpY2VfaWQnICk7IH1cblx0XHR3Lmhpc3RvcnkucmVwbGFjZVN0YXRlKCB7fSwgJycsIHVybC50b1N0cmluZygpICk7XG5cdH1cblx0LyoqIFJlbmRlciB0aGUgZW1wdHkgb3Igc3RvcmFnZS11bmF2YWlsYWJsZSBzdGF0ZSBpbiB0aGUgY2VudHJhbCB3b3Jrc3BhY2UuICovXG5cdGZ1bmN0aW9uIHJlbmRlckVtcHR5KCBtZXNzYWdlLCBzdG9yYWdlTm90aWNlICkge1xuXHRcdHZhciAkZW1wdHkgPSAkKCAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX2VtcHR5JyApO1xuXHRcdHZhciBub1Byb3ZpZGVycyA9ICEgc3RvcmFnZU5vdGljZSAmJiAhIG1lc3NhZ2UgJiYgMCA9PT0gc3RhdGUucHJvdmlkZXJDb3VudDtcblx0XHQkKCAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX2xpc3QnICkucHJvcCggJ2hpZGRlbicsIHRydWUgKTtcblx0XHQkZW1wdHkucHJvcCggJ2hpZGRlbicsIGZhbHNlICkudG9nZ2xlQ2xhc3MoICdpcy1zdG9yYWdlLW5vdGljZScsICEhIHN0b3JhZ2VOb3RpY2UgKTtcblx0XHQkZW1wdHkuZmluZCggJ2gyJyApLnRleHQoIHN0b3JhZ2VOb3RpY2UgPyAoIGNvbmZpZy5pMThuLm5vdF9jb25uZWN0ZWQgfHwgJ1NlcnZpY2VzIHN0b3JhZ2UgaXMgbm90IGNvbm5lY3RlZCcgKSA6ICggbm9Qcm92aWRlcnMgPyAoIGNvbmZpZy5pMThuLm5vX3Byb3ZpZGVycyB8fCAnTm8gUHJvdmlkZXJzIGF2YWlsYWJsZScgKSA6ICggY29uZmlnLmkxOG4uZW1wdHkgfHwgJ05vIFNlcnZpY2VzIHlldCcgKSApICk7XG5cdFx0JGVtcHR5LmZpbmQoICdwJyApLnRleHQoIG1lc3NhZ2UgfHwgKCBub1Byb3ZpZGVycyA/IGNvbmZpZy5pMThuLm5vX3Byb3ZpZGVyc19oZWxwIDogY29uZmlnLmkxOG4uZW1wdHlfaGVscCApIHx8ICcnICk7XG5cdH1cblx0LyoqIEluZGV4IFByb3ZpZGVyIHByZXNlbnRhdGlvbiByZWNvcmRzIGJ5IGJvb2tpbmcgcmVzb3VyY2UgSUQuICovXG5cdGZ1bmN0aW9uIGluZGV4UHJvdmlkZXJzKCBwcm92aWRlcnMgKSB7XG5cdFx0c3RhdGUucHJvdmlkZXJzID0ge307XG5cdFx0JC5lYWNoKCBwcm92aWRlcnMgfHwgW10sIGZ1bmN0aW9uICggaW5kZXgsIHByb3ZpZGVyICkgeyBzdGF0ZS5wcm92aWRlcnNbIFN0cmluZyggcHJvdmlkZXIuaWQgKSBdID0gcHJvdmlkZXI7IH0gKTtcblx0fVxuXHQvKiogVXBkYXRlIHN0YXR1cyBhbmQgUHJvdmlkZXIgY291bnRlcnMgYWJvdmUgdGhlIFNlcnZpY2UgdGFibGUuICovXG5cdGZ1bmN0aW9uIHVwZGF0ZVN1bW1hcnkoIGNvdW50cywgcHJvdmlkZXJDb3VudCApIHtcblx0XHRjb3VudHMgPSAkLmV4dGVuZCggeyBhbGw6IDAsIGFjdGl2ZTogMCwgaW5hY3RpdmU6IDAsIGFyY2hpdmVkOiAwIH0sIGNvdW50cyB8fCB7fSApO1xuXHRcdHN0YXRlLnByb3ZpZGVyQ291bnQgPSBOdW1iZXIoIHByb3ZpZGVyQ291bnQgfHwgMCApO1xuXHRcdCQuZWFjaCggY291bnRzLCBmdW5jdGlvbiAoIHN0YXR1cywgY291bnQgKSB7ICQoICdbZGF0YS1zZXJ2aWNlLWNvdW50PVwiJyArIHN0YXR1cyArICdcIl0nICkudGV4dCggTnVtYmVyKCBjb3VudCB8fCAwICkgKTsgfSApO1xuXHRcdCQoICdbZGF0YS1wcm92aWRlci1jb3VudF0nICkudGV4dCggc3RhdGUucHJvdmlkZXJDb3VudCApO1xuXHRcdCQoICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fcHJvdmlkZXJfbm90aWNlJyApLnByb3AoICdoaWRkZW4nLCAwICE9PSBzdGF0ZS5wcm92aWRlckNvdW50ICk7XG5cdH1cblx0LyoqIEZvcm1hdCBhIG5vcm1hbGl6ZWQgU2VydmljZSBjb3N0IHVzaW5nIHRoZSBjb25maWd1cmVkIGN1cnJlbmN5IHN5bWJvbC4gKi9cblx0ZnVuY3Rpb24gZm9ybWF0Q29zdCggY29zdCApIHtcblx0XHR2YXIgYW1vdW50ID0gTnVtYmVyKCBjb3N0IHx8IDAgKTtcblx0XHR2YXIgc3ltYm9sID0gY29uZmlnLmN1cnJlbmN5X3N5bWJvbCB8fCAnJCc7XG5cdFx0cmV0dXJuIHN5bWJvbCArIGFtb3VudC50b0ZpeGVkKCAyICk7XG5cdH1cblx0LyoqIEJ1aWxkIGNvbXBhY3QgUHJvdmlkZXIgYXZhdGFyIG5vZGVzIGZvciBvbmUgU2VydmljZSByb3cuICovXG5cdGZ1bmN0aW9uIHByb3ZpZGVyTm9kZXMoIHNlcnZpY2UgKSB7XG5cdFx0dmFyIGlkcyA9ICQubWFwKCBzZXJ2aWNlLnJlc291cmNlX2lkcyB8fCBbXSwgZnVuY3Rpb24gKCB2YWx1ZSApIHsgcmV0dXJuIE51bWJlciggdmFsdWUgfHwgMCApOyB9ICk7XG5cdFx0dmFyICRzdGFjayA9ICQoICc8ZGl2PicsIHsgJ2NsYXNzJzogJ3dwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX3Byb3ZpZGVyX3N0YWNrJyB9ICk7XG5cdFx0aWYgKCAhIGlkcy5sZW5ndGggKSB7IHJldHVybiAkKCAnPHNwYW4+JywgeyAnY2xhc3MnOiAnd3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fbm9fcHJvdmlkZXInLCB0ZXh0OiBjb25maWcuaTE4bi5ub19wcm92aWRlciB8fCAnTm8gUHJvdmlkZXJzIGFzc2lnbmVkJyB9ICk7IH1cblx0XHQkLmVhY2goIGlkcy5zbGljZSggMCwgMyApLCBmdW5jdGlvbiAoIGluZGV4LCBpZCApIHtcblx0XHRcdHZhciBwcm92aWRlciA9IHN0YXRlLnByb3ZpZGVyc1sgU3RyaW5nKCBpZCApIF0gfHwgeyBpZDogaWQsIHRpdGxlOiAnUHJvdmlkZXIgIycgKyBpZCwgaW5pdGlhbHM6ICdQJywgYXZhdGFyX3VybDogJycgfTtcblx0XHRcdHZhciBoYXNfYXZhaWxhYmlsaXR5ID0gZmFsc2UgIT09IHByb3ZpZGVyLmhhc193ZWVrbHlfYXZhaWxhYmlsaXR5O1xuXHRcdFx0dmFyIHByb3ZpZGVyX3RpdGxlID0gcHJvdmlkZXIudGl0bGUgfHwgJ1Byb3ZpZGVyICMnICsgaWQ7XG5cdFx0XHR2YXIgYXZhdGFyX3RpdGxlID0gcHJvdmlkZXJfdGl0bGU7XG5cdFx0XHR2YXIgYXZhdGFyX2F0dHJpYnV0ZXM7XG5cdFx0XHR2YXIgJGF2YXRhcjtcblxuXHRcdFx0aWYgKCAhIGhhc19hdmFpbGFiaWxpdHkgKSB7IGF2YXRhcl90aXRsZSArPSAnIOKAlCAnICsgKCBjb25maWcuaTE4bi5ub19hdmFpbGFiaWxpdHkgfHwgJ05vIHdlZWtseSBhdmFpbGFiaWxpdHknICk7IH1cblx0XHRcdGF2YXRhcl9hdHRyaWJ1dGVzID0ge1xuXHRcdFx0XHQnY2xhc3MnOiAnd3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fcHJvdmlkZXJfYXZhdGFyJyArICggaGFzX2F2YWlsYWJpbGl0eSA/ICcnIDogJyBoYXMtbm8tYXZhaWxhYmlsaXR5JyApLFxuXHRcdFx0XHR0aXRsZTogYXZhdGFyX3RpdGxlXG5cdFx0XHR9O1xuXHRcdFx0aWYgKCBwcm92aWRlci5hdmFpbGFiaWxpdHlfdXJsICkge1xuXHRcdFx0XHRhdmF0YXJfdGl0bGUgPSBTdHJpbmcoIGNvbmZpZy5pMThuLmVkaXRfYXZhaWxhYmlsaXR5IHx8ICdFZGl0IGF2YWlsYWJpbGl0eSBmb3IgJXMnICkucmVwbGFjZSggJyVzJywgcHJvdmlkZXJfdGl0bGUgKTtcblx0XHRcdFx0YXZhdGFyX2F0dHJpYnV0ZXMuaHJlZiA9IHByb3ZpZGVyLmF2YWlsYWJpbGl0eV91cmw7XG5cdFx0XHRcdGF2YXRhcl9hdHRyaWJ1dGVzLnRpdGxlID0gYXZhdGFyX3RpdGxlO1xuXHRcdFx0XHRhdmF0YXJfYXR0cmlidXRlc1sgJ2FyaWEtbGFiZWwnIF0gPSBhdmF0YXJfdGl0bGU7XG5cdFx0XHRcdCRhdmF0YXIgPSAkKCAnPGE+JywgYXZhdGFyX2F0dHJpYnV0ZXMgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdCRhdmF0YXIgPSAkKCAnPHNwYW4+JywgYXZhdGFyX2F0dHJpYnV0ZXMgKTtcblx0XHRcdH1cblx0XHRcdGlmICggcHJvdmlkZXIuYXZhdGFyX3VybCApIHsgJCggJzxpbWc+JywgeyBzcmM6IHByb3ZpZGVyLmF2YXRhcl91cmwsIGFsdDogJycsIGxvYWRpbmc6ICdsYXp5JyB9ICkuYXBwZW5kVG8oICRhdmF0YXIgKTsgfVxuXHRcdFx0ZWxzZSB7ICRhdmF0YXIudGV4dCggcHJvdmlkZXIuaW5pdGlhbHMgfHwgJ1AnICk7IH1cblx0XHRcdCRzdGFjay5hcHBlbmQoICRhdmF0YXIgKTtcblx0XHR9ICk7XG5cdFx0aWYgKCBpZHMubGVuZ3RoID4gMyApIHsgJCggJzxzcGFuPicsIHsgJ2NsYXNzJzogJ3dwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX3Byb3ZpZGVyX21vcmUnLCB0ZXh0OiAnKycgKyAoIGlkcy5sZW5ndGggLSAzICksIHRpdGxlOiAoIGlkcy5sZW5ndGggLSAzICkgKyAnICcgKyAoIGNvbmZpZy5pMThuLm1vcmVfcHJvdmlkZXJzIHx8ICdtb3JlIFByb3ZpZGVycycgKSB9ICkuYXBwZW5kVG8oICRzdGFjayApOyB9XG5cdFx0cmV0dXJuICRzdGFjaztcblx0fVxuXHQvKipcblx0ICogQnVpbGQgdGhlIFNlcnZpY2UgdGh1bWJuYWlsIHVzZWQgaW4gdGhlIG1hbmFnZW1lbnQgdGFibGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBzZXJ2aWNlIE5vcm1hbGl6ZWQgU2VydmljZSByZXNwb25zZS5cblx0ICogQHJldHVybiB7alF1ZXJ5fSBUaHVtYm5haWwgd3JhcHBlciBjb250YWluaW5nIGFuIGltYWdlIG9yIHBsYWNlaG9sZGVyIGljb24uXG5cdCAqL1xuXHRmdW5jdGlvbiBzZXJ2aWNlVGh1bWJuYWlsTm9kZSggc2VydmljZSApIHtcblx0XHR2YXIgcGljdHVyZVVybCA9IFN0cmluZyggc2VydmljZS5waWN0dXJlX3VybCB8fCAnJyApLnRyaW0oKTtcblx0XHR2YXIgc2VydmljZV90aXRsZSA9IFN0cmluZyggc2VydmljZS50aXRsZSB8fCBjb25maWcuaTE4bi51bnRpdGxlZCB8fCAnVW50aXRsZWQgU2VydmljZScgKTtcblx0XHR2YXIgc2VydmljZV9kZXNjcmlwdGlvbiA9IFN0cmluZyggc2VydmljZS5kZXNjcmlwdGlvbiB8fCAnJyApLnRyaW0oKSB8fCBjb25maWcuaTE4bi5ub19kZXNjcmlwdGlvbiB8fCAnTm8gZGVzY3JpcHRpb24nO1xuXHRcdHZhciB0b29sdGlwX2Zvcm1hdCA9IFN0cmluZyggY29uZmlnLmkxOG4uc2VydmljZV90aHVtYm5haWxfdG9vbHRpcCB8fCAnVGl0bGU6ICUxJHNcXG5EZXNjcmlwdGlvbjogJTIkcycgKTtcblx0XHR2YXIgdG9vbHRpcF90ZXh0ID0gdG9vbHRpcF9mb3JtYXQucmVwbGFjZSggJyUxJHMnLCBzZXJ2aWNlX3RpdGxlICkucmVwbGFjZSggJyUyJHMnLCBzZXJ2aWNlX2Rlc2NyaXB0aW9uICk7XG5cdFx0dmFyICR0aHVtYm5haWwgPSAkKCAnPHNwYW4+Jywge1xuXHRcdFx0J2NsYXNzJzogJ3dwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX3NlcnZpY2VfdGh1bWJuYWlsIHRvb2x0aXBfdG9wJyxcblx0XHRcdCdkYXRhLW9yaWdpbmFsLXRpdGxlJzogdG9vbHRpcF90ZXh0LFxuXHRcdFx0J2FyaWEtbGFiZWwnOiB0b29sdGlwX3RleHQsXG5cdFx0XHRyb2xlOiAnaW1nJyxcblx0XHRcdHRhYmluZGV4OiAnMCdcblx0XHR9ICk7XG5cdFx0aWYgKCBwaWN0dXJlVXJsICkge1xuXHRcdFx0JCggJzxpbWc+JywgeyBzcmM6IHBpY3R1cmVVcmwsIGFsdDogJycsIGxvYWRpbmc6ICdsYXp5JywgZGVjb2Rpbmc6ICdhc3luYycgfSApLmFwcGVuZFRvKCAkdGh1bWJuYWlsICk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdCQoICc8aT4nLCB7ICdjbGFzcyc6ICdtZW51X2ljb24gaWNvbi0xeCB3cGJjLWJpLWltYWdlLWZpbGwnLCAnYXJpYS1oaWRkZW4nOiAndHJ1ZScgfSApLmFwcGVuZFRvKCAkdGh1bWJuYWlsICk7XG5cdFx0fVxuXHRcdHJldHVybiAkdGh1bWJuYWlsO1xuXHR9XG5cdC8qKlxuXHQgKiBEZXN0cm95IFNlcnZpY2UgdGh1bWJuYWlsIHRvb2x0aXBzIGJlZm9yZSBBSkFYIHJlcGxhY2VzIHRoZWlyIGVsZW1lbnRzLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gZGVzdHJveV9zZXJ2aWNlX3RodW1ibmFpbF90b29sdGlwcygpIHtcblx0XHQkKCAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX3NlcnZpY2VfdGh1bWJuYWlsJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdGlmICggdGhpcy5fdGlwcHkgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHRoaXMuX3RpcHB5LmRlc3Ryb3kgKSB7XG5cdFx0XHRcdHRoaXMuX3RpcHB5LmRlc3Ryb3koKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdH1cblx0LyoqXG5cdCAqIEluaXRpYWxpemUgU2VydmljZSB0aHVtYm5haWwgdG9vbHRpcHMgYWZ0ZXIgYW4gQUpBWCBsaXN0aW5nIHJlbmRlci5cblx0ICpcblx0ICogVGhlIG5hdGl2ZSB0aXRsZSBhdHRyaWJ1dGUgaXMgdXNlZCBvbmx5IHdoZW4gdGhlIEJvb2tpbmcgQ2FsZW5kYXIgVGlwcHlcblx0ICogaGVscGVyIGlzIHVuYXZhaWxhYmxlLCBhdm9pZGluZyBkdXBsaWNhdGUgYnJvd3NlciBhbmQgVGlwcHkgdG9vbHRpcHMuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiByZWZyZXNoX3NlcnZpY2VfdGh1bWJuYWlsX3Rvb2x0aXBzKCkge1xuXHRcdHZhciBsaXN0aW5nX3NlbGVjdG9yID0gJyN3cGJjX3VpX2xpc3RpbmdfYXBwb2ludG1lbnRfc2VydmljZXNfY2F0YWxvZyAnO1xuXHRcdHZhciAkdGh1bWJuYWlscyA9ICQoIGxpc3Rpbmdfc2VsZWN0b3IgKyAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX3NlcnZpY2VfdGh1bWJuYWlsJyApO1xuXHRcdHZhciB0b29sdGlwc19pbml0aWFsaXplZCA9IGZhbHNlO1xuXG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygdy53cGJjX2RlZmluZV90aXBweV90b29sdGlwcyApIHtcblx0XHRcdHRvb2x0aXBzX2luaXRpYWxpemVkID0gdy53cGJjX2RlZmluZV90aXBweV90b29sdGlwcyggbGlzdGluZ19zZWxlY3RvciApO1xuXHRcdH1cblx0XHRpZiAoIHRvb2x0aXBzX2luaXRpYWxpemVkICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHQkdGh1bWJuYWlscy5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHQkKCB0aGlzICkuYXR0ciggJ3RpdGxlJywgJCggdGhpcyApLmF0dHIoICdkYXRhLW9yaWdpbmFsLXRpdGxlJyApIHx8ICcnICk7XG5cdFx0fSApO1xuXHR9XG5cdC8qKlxuXHQgKiBCdWlsZCB0aGUgY29tcGFjdCBkdXJhdGlvbiBhbmQgYmVmb3JlL2FmdGVyIGJ1ZmZlciBzdW1tYXJ5IGZvciBvbmUgU2VydmljZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IHNlcnZpY2UgTm9ybWFsaXplZCBTZXJ2aWNlIHJlc3BvbnNlLlxuXHQgKiBAcmV0dXJuIHtqUXVlcnl9IER1cmF0aW9uIGRldGFpbHMgd3JhcHBlciBmb3IgdGhlIGxpc3RpbmcgY29sdW1uLlxuXHQgKi9cblx0ZnVuY3Rpb24gc2VydmljZV9kdXJhdGlvbl9ub2RlKCBzZXJ2aWNlICkge1xuXHRcdHZhciBkdXJhdGlvbl9taW51dGVzID0gTWF0aC5tYXgoIDAsIE51bWJlciggc2VydmljZS5kdXJhdGlvbl9taW51dGVzIHx8IDAgKSApO1xuXHRcdHZhciBidWZmZXJfYmVmb3JlX21pbnV0ZXMgPSBNYXRoLm1heCggMCwgTnVtYmVyKCBzZXJ2aWNlLmJ1ZmZlcl9iZWZvcmVfbWludXRlcyB8fCAwICkgKTtcblx0XHR2YXIgYnVmZmVyX2FmdGVyX21pbnV0ZXMgPSBNYXRoLm1heCggMCwgTnVtYmVyKCBzZXJ2aWNlLmJ1ZmZlcl9hZnRlcl9taW51dGVzIHx8IDAgKSApO1xuXHRcdHZhciBkdXJhdGlvbl9mb3JtYXQgPSBTdHJpbmcoIGNvbmZpZy5pMThuLmR1cmF0aW9uX21pbnV0ZXMgfHwgJyVzIG1pbicgKTtcblx0XHR2YXIgYnVmZmVyc19mb3JtYXQgPSBTdHJpbmcoIGNvbmZpZy5pMThuLmJ1ZmZlcnNfc3VtbWFyeSB8fCAnQnVmZmVyczogJTEkcyAvICUyJHMgbWluJyApO1xuXHRcdHZhciBidWZmZXJzX3Rvb2x0aXBfZm9ybWF0ID0gU3RyaW5nKCBjb25maWcuaTE4bi5idWZmZXJzX3Rvb2x0aXAgfHwgJ0J1ZmZlciBiZWZvcmU6ICUxJHMgbWluOyBCdWZmZXIgYWZ0ZXI6ICUyJHMgbWluJyApO1xuXHRcdHZhciBidWZmZXJzX3N1bW1hcnkgPSBidWZmZXJzX2Zvcm1hdC5yZXBsYWNlKCAnJTEkcycsIGJ1ZmZlcl9iZWZvcmVfbWludXRlcyApLnJlcGxhY2UoICclMiRzJywgYnVmZmVyX2FmdGVyX21pbnV0ZXMgKTtcblx0XHR2YXIgYnVmZmVyc190b29sdGlwID0gYnVmZmVyc190b29sdGlwX2Zvcm1hdC5yZXBsYWNlKCAnJTEkcycsIGJ1ZmZlcl9iZWZvcmVfbWludXRlcyApLnJlcGxhY2UoICclMiRzJywgYnVmZmVyX2FmdGVyX21pbnV0ZXMgKTtcblx0XHR2YXIgJGR1cmF0aW9uX2RldGFpbHMgPSAkKCAnPHNwYW4+JywgeyAnY2xhc3MnOiAnd3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fZHVyYXRpb25fZGV0YWlscycgfSApO1xuXG5cdFx0JCggJzxzdHJvbmc+Jywge1xuXHRcdFx0J2NsYXNzJzogJ3dwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX2R1cmF0aW9uX3ZhbHVlJyxcblx0XHRcdHRleHQ6IGR1cmF0aW9uX2Zvcm1hdC5yZXBsYWNlKCAnJXMnLCBkdXJhdGlvbl9taW51dGVzIClcblx0XHR9ICkuYXBwZW5kVG8oICRkdXJhdGlvbl9kZXRhaWxzICk7XG5cdFx0JCggJzxzcGFuPicsIHtcblx0XHRcdCdjbGFzcyc6ICd3cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19idWZmZXJzX3N1bW1hcnknLFxuXHRcdFx0dGV4dDogYnVmZmVyc19zdW1tYXJ5LFxuXHRcdFx0dGl0bGU6IGJ1ZmZlcnNfdG9vbHRpcCxcblx0XHRcdCdhcmlhLWxhYmVsJzogYnVmZmVyc190b29sdGlwXG5cdFx0fSApLmFwcGVuZFRvKCAkZHVyYXRpb25fZGV0YWlscyApO1xuXG5cdFx0cmV0dXJuICRkdXJhdGlvbl9kZXRhaWxzO1xuXHR9XG5cdC8qKlxuXHQgKiBSZXR1cm4gYXNzaWduZWQgUHJvdmlkZXJzIHdpdGggcmVjdXJyaW5nIGF2YWlsYWJpbGl0eSBvbiBvbmUgd2Vla2RheS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IHNlcnZpY2UgTm9ybWFsaXplZCBTZXJ2aWNlIHJlc3BvbnNlLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gZGF5IFdlZWtkYXkga2V5IGZyb20gbW9uIHRocm91Z2ggc3VuLlxuXHQgKiBAcmV0dXJuIHtBcnJheTxPYmplY3Q+fSBNYXRjaGluZyBQcm92aWRlciBwcmVzZW50YXRpb24gcmVjb3Jkcy5cblx0ICovXG5cdGZ1bmN0aW9uIHByb3ZpZGVyc19hdmFpbGFibGVfb24oIHNlcnZpY2UsIGRheSApIHtcblx0XHR2YXIgYXZhaWxhYmxlX3Byb3ZpZGVycyA9IFtdO1xuXHRcdCQuZWFjaCggc2VydmljZS5yZXNvdXJjZV9pZHMgfHwgW10sIGZ1bmN0aW9uICggaW5kZXgsIGlkICkge1xuXHRcdFx0dmFyIHByb3ZpZGVyID0gc3RhdGUucHJvdmlkZXJzWyBTdHJpbmcoIE51bWJlciggaWQgfHwgMCApICkgXTtcblx0XHRcdGlmICggcHJvdmlkZXIgJiYgcHJvdmlkZXIud2Vla2RheXMgJiYgcHJvdmlkZXIud2Vla2RheXNbIGRheSBdICkge1xuXHRcdFx0XHRhdmFpbGFibGVfcHJvdmlkZXJzLnB1c2goIHByb3ZpZGVyICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIGF2YWlsYWJsZV9wcm92aWRlcnM7XG5cdH1cblx0LyoqXG5cdCAqIEJ1aWxkIGNvbXBhY3QgUHJvdmlkZXItc3BlY2lmaWMgbGlua3MgYmVsb3cgdGhlIHdlZWtseSBhdmFpbGFiaWxpdHkgZG90cy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IHNlcnZpY2UgTm9ybWFsaXplZCBTZXJ2aWNlIHJlc3BvbnNlLlxuXHQgKiBAcmV0dXJuIHtqUXVlcnl9IEF2YWlsYWJpbGl0eSBsaW5rcywgb3IgYW4gZW1wdHkgY29sbGVjdGlvbiB3aGVuIHVuYXZhaWxhYmxlLlxuXHQgKi9cblx0ZnVuY3Rpb24gYXZhaWxhYmlsaXR5X2VkaXRfbGlua3MoIHNlcnZpY2UgKSB7XG5cdFx0dmFyICRsaW5rcyA9ICQoICc8ZGl2PicsIHtcblx0XHRcdCdjbGFzcyc6ICd3cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19hdmFpbGFiaWxpdHlfbGlua3MnLFxuXHRcdFx0J2FyaWEtbGFiZWwnOiBjb25maWcuaTE4bi5lZGl0X3Byb3ZpZGVyX2F2YWlsYWJpbGl0eSB8fCAnRWRpdCBQcm92aWRlciBhdmFpbGFiaWxpdHknXG5cdFx0fSApO1xuXG5cdFx0JC5lYWNoKCBzZXJ2aWNlLnJlc291cmNlX2lkcyB8fCBbXSwgZnVuY3Rpb24gKCBpbmRleCwgaWQgKSB7XG5cdFx0XHR2YXIgcHJvdmlkZXIgPSBzdGF0ZS5wcm92aWRlcnNbIFN0cmluZyggTnVtYmVyKCBpZCB8fCAwICkgKSBdO1xuXHRcdFx0dmFyIHByb3ZpZGVyX3RpdGxlO1xuXHRcdFx0dmFyIGxpbmtfdGl0bGU7XG5cblx0XHRcdGlmICggISBwcm92aWRlciB8fCAhIHByb3ZpZGVyLmF2YWlsYWJpbGl0eV91cmwgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHByb3ZpZGVyX3RpdGxlID0gcHJvdmlkZXIudGl0bGUgfHwgJ1Byb3ZpZGVyICMnICsgTnVtYmVyKCBpZCB8fCAwICk7XG5cdFx0XHRsaW5rX3RpdGxlID0gU3RyaW5nKCBjb25maWcuaTE4bi5lZGl0X2F2YWlsYWJpbGl0eSB8fCAnRWRpdCBhdmFpbGFiaWxpdHkgZm9yICVzJyApLnJlcGxhY2UoICclcycsIHByb3ZpZGVyX3RpdGxlICk7XG5cdFx0XHQkKCAnPGE+Jywge1xuXHRcdFx0XHQnY2xhc3MnOiAnd3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fYXZhaWxhYmlsaXR5X2xpbmsnLFxuXHRcdFx0XHRocmVmOiBwcm92aWRlci5hdmFpbGFiaWxpdHlfdXJsLFxuXHRcdFx0XHR0ZXh0OiBwcm92aWRlci5pbml0aWFscyB8fCAnUCcsXG5cdFx0XHRcdHRpdGxlOiBsaW5rX3RpdGxlLFxuXHRcdFx0XHQnYXJpYS1sYWJlbCc6IGxpbmtfdGl0bGVcblx0XHRcdH0gKS5hcHBlbmRUbyggJGxpbmtzICk7XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuICRsaW5rcy5jaGlsZHJlbigpLmxlbmd0aCA/ICRsaW5rcyA6ICQoKTtcblx0fVxuXHQvKiogQ29udmVydCBhIHN0b3JlZCBTZXJ2aWNlIHN0YXR1cyB0byBpdHMgdHJhbnNsYXRlZCBVSSBsYWJlbC4gKi9cblx0ZnVuY3Rpb24gc3RhdHVzTGFiZWwoIHN0YXR1cyApIHtcblx0XHRpZiAoICdpbmFjdGl2ZScgPT09IHN0YXR1cyApIHsgcmV0dXJuIGNvbmZpZy5pMThuLmRyYWZ0IHx8ICdEcmFmdCc7IH1cblx0XHRpZiAoICdhcmNoaXZlZCcgPT09IHN0YXR1cyApIHsgcmV0dXJuIGNvbmZpZy5pMThuLmFyY2hpdmVkIHx8ICdBcmNoaXZlZCc7IH1cblx0XHRyZXR1cm4gY29uZmlnLmkxOG4uYWN0aXZlIHx8ICdBY3RpdmUnO1xuXHR9XG5cdC8qKiBGb3JtYXQgdGhlIHRyYW5zbGF0ZWQgdGFibGUgcGFnaW5hdGlvbiBzdW1tYXJ5LiAqL1xuXHRmdW5jdGlvbiBzaG93aW5nVGV4dCggZnJvbSwgdG8sIHRvdGFsICkge1xuXHRcdHZhciBmb3JtYXQgPSBjb25maWcuaTE4bi5zaG93aW5nIHx8ICdTaG93aW5nICUxJHPigJMlMiRzIG9mICUzJHMgU2VydmljZXMnO1xuXHRcdHJldHVybiBmb3JtYXQucmVwbGFjZSggJyUxJHMnLCBmcm9tICkucmVwbGFjZSggJyUyJHMnLCB0byApLnJlcGxhY2UoICclMyRzJywgdG90YWwgKTtcblx0fVxuXHQvKipcblx0ICogQXBwbHkgdGhlIHNlcnZlci1hdXRob3JpdGF0aXZlIGxpc3RpbmcgcHJlZmVyZW5jZSB0byBzdGF0ZSBhbmQgY29udHJvbHMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBsaXN0aW5nX3NldHRpbmdzIFNoYXJlZCBsaXN0aW5nIGNsaWVudCBzZXR0aW5ncy5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHN5bmNfbGlzdGluZ19zZXR0aW5ncyggbGlzdGluZ19zZXR0aW5ncyApIHtcblx0XHR2YXIgcGFnZV9zaXplID0gTnVtYmVyKCBsaXN0aW5nX3NldHRpbmdzICYmIGxpc3Rpbmdfc2V0dGluZ3MuaXRlbXNfcGVyX3BhZ2UgPyBsaXN0aW5nX3NldHRpbmdzLml0ZW1zX3Blcl9wYWdlIDogc3RhdGUucGFnZV9zaXplICk7XG5cdFx0aWYgKCAhIGlzRmluaXRlKCBwYWdlX3NpemUgKSB8fCBwYWdlX3NpemUgPCAxICkgeyByZXR1cm47IH1cblx0XHRzdGF0ZS5wYWdlX3NpemUgPSBwYWdlX3NpemU7XG5cdFx0JCggJ1tkYXRhLXdwYmMtbGlzdGluZy1pdGVtcy1wZXItcGFnZS1jb250cm9sPVwiYXBwb2ludG1lbnRfc2VydmljZXNfY2F0YWxvZ1wiXScgKS52YWwoIFN0cmluZyggcGFnZV9zaXplICkgKTtcblx0fVxuXHQvKipcblx0ICogU3luY2hyb25pemUgc29ydGFibGUgdGFibGUgaGVhZGVycyB3aXRoIHRoZSBzZXJ2ZXItYXV0aG9yaXRhdGl2ZSBvcmRlcmluZy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IHNvcnRpbmcgTm9ybWFsaXplZCBzb3J0IGtleSBhbmQgZGlyZWN0aW9uLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3luY19zb3J0aW5nX2NvbnRyb2xzKCBzb3J0aW5nICkge1xuXHRcdHN0YXRlLnNvcnRfYnkgPSBTdHJpbmcoIHNvcnRpbmcgJiYgc29ydGluZy5zb3J0X2J5ID8gc29ydGluZy5zb3J0X2J5IDogc3RhdGUuc29ydF9ieSApO1xuXHRcdHN0YXRlLnNvcnRfb3JkZXIgPSAnZGVzYycgPT09IFN0cmluZyggc29ydGluZyAmJiBzb3J0aW5nLnNvcnRfb3JkZXIgPyBzb3J0aW5nLnNvcnRfb3JkZXIgOiBzdGF0ZS5zb3J0X29yZGVyICkgPyAnZGVzYycgOiAnYXNjJztcblxuXHRcdCQoICdbZGF0YS13cGJjLWxpc3Rpbmctc29ydD1cImFwcG9pbnRtZW50X3NlcnZpY2VzX2NhdGFsb2dcIl0nICkuZWFjaCggZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyICRzb3J0X2xpbmsgPSAkKCB0aGlzICk7XG5cdFx0XHR2YXIgaXNfYWN0aXZlID0gU3RyaW5nKCAkc29ydF9saW5rLmRhdGEoICd3cGJjLWxpc3Rpbmctc29ydC1rZXknICkgfHwgJycgKSA9PT0gc3RhdGUuc29ydF9ieTtcblx0XHRcdHZhciAkc29ydF9pY29uID0gJHNvcnRfbGluay5maW5kKCAnLndwYmNfdWlfbGlzdGluZ19fc29ydF9pY29uJyApO1xuXG5cdFx0XHQkc29ydF9saW5rLnRvZ2dsZUNsYXNzKCAnaXMtYWN0aXZlJywgaXNfYWN0aXZlICk7XG5cdFx0XHQkc29ydF9pY29uLnJlbW92ZUNsYXNzKCAnd3BiY19pY25faW1wb3J0X2V4cG9ydCB3cGJjLWJpLWFycm93LWRvd24gd3BiYy1iaS1hcnJvdy11cCcgKVxuXHRcdFx0XHQuYWRkQ2xhc3MoIGlzX2FjdGl2ZSA/ICggJ2Rlc2MnID09PSBzdGF0ZS5zb3J0X29yZGVyID8gJ3dwYmMtYmktYXJyb3ctZG93bicgOiAnd3BiYy1iaS1hcnJvdy11cCcgKSA6ICd3cGJjX2ljbl9pbXBvcnRfZXhwb3J0JyApO1xuXHRcdH0gKTtcblx0XHQkKCAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX3RhYmxlIHRoJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciAkY29sdW1uID0gJCggdGhpcyApO1xuXHRcdFx0aWYgKCAhICRjb2x1bW4uZmluZCggJy53cGJjX3VpX2xpc3RpbmdfX3NvcnRfbGluaycgKS5sZW5ndGggKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHZhciBoYXNfYWN0aXZlX3NvcnQgPSAkY29sdW1uLmZpbmQoICcud3BiY191aV9saXN0aW5nX19zb3J0X2xpbmsuaXMtYWN0aXZlJyApLmxlbmd0aCA+IDA7XG5cdFx0XHQkY29sdW1uLmF0dHIoICdhcmlhLXNvcnQnLCBoYXNfYWN0aXZlX3NvcnQgPyAoICdkZXNjJyA9PT0gc3RhdGUuc29ydF9vcmRlciA/ICdkZXNjZW5kaW5nJyA6ICdhc2NlbmRpbmcnICkgOiAnbm9uZScgKTtcblx0XHR9ICk7XG5cdH1cblx0LyoqXG5cdCAqIFN5bmNocm9uaXplIGRpcmVjdC1wYWdlIGFuZCBwcmV2aW91cy9uZXh0IGNvbnRyb2xzIHdpdGggdGhlIHNlcnZlciByZXNwb25zZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IHBhZ2luYXRpb24gU2VydmVyLWF1dGhvcml0YXRpdmUgcGFnaW5hdGlvbiBtZXRhZGF0YS5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHN5bmNfcGFnaW5hdGlvbl9jb250cm9scyggcGFnaW5hdGlvbiApIHtcblx0XHR2YXIgdG90YWxfcGFnZXMgPSBNYXRoLm1heCggMCwgTnVtYmVyKCBwYWdpbmF0aW9uICYmIHBhZ2luYXRpb24udG90YWxfcGFnZXMgPyBwYWdpbmF0aW9uLnRvdGFsX3BhZ2VzIDogMCApICk7XG5cdFx0dmFyIG1heGltdW1fcGFnZSA9IE1hdGgubWF4KCAxLCB0b3RhbF9wYWdlcyApO1xuXHRcdHZhciAkcGFnZV9jb250cm9sID0gJCggJ1tkYXRhLXdwYmMtbGlzdGluZy1wYWdlLW51bWJlci1jb250cm9sPVwiYXBwb2ludG1lbnRfc2VydmljZXNfY2F0YWxvZ1wiXScgKTtcblx0XHQkcGFnZV9jb250cm9sLmF0dHIoICdtYXgnLCBtYXhpbXVtX3BhZ2UgKS52YWwoIHN0YXRlLnBhZ2UgKS5wcm9wKCAnZGlzYWJsZWQnLCB0b3RhbF9wYWdlcyA8PSAxICk7XG5cdFx0JCggJ1tkYXRhLXdwYmMtbGlzdGluZy1wYWdlLXRvdGFsPVwiYXBwb2ludG1lbnRfc2VydmljZXNfY2F0YWxvZ1wiXScgKS50ZXh0KCB0b3RhbF9wYWdlcyApO1xuXHR9XG5cdC8qKlxuXHQgKiBSZXF1ZXN0IHRoZSB2YWxpZCBwYWdlIGVudGVyZWQgaW4gdGhlIHNoYXJlZCBkaXJlY3QtcGFnZSBjb250cm9sLlxuXHQgKlxuXHQgKiBAcGFyYW0ge2pRdWVyeX0gJHBhZ2VfY29udHJvbCBEaXJlY3QtcGFnZSBudW1iZXIgaW5wdXQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiByZXF1ZXN0X3NlbGVjdGVkX3BhZ2UoICRwYWdlX2NvbnRyb2wgKSB7XG5cdFx0dmFyIHJlcXVlc3RlZF9wYWdlID0gTnVtYmVyKCAkcGFnZV9jb250cm9sLnZhbCgpICk7XG5cdFx0cmVxdWVzdGVkX3BhZ2UgPSBNYXRoLm1pbiggTWF0aC5tYXgoIDEsIGlzRmluaXRlKCByZXF1ZXN0ZWRfcGFnZSApID8gcmVxdWVzdGVkX3BhZ2UgOiBzdGF0ZS5wYWdlICksIE1hdGgubWF4KCAxLCBzdGF0ZS50b3RhbF9wYWdlcyApICk7XG5cdFx0JHBhZ2VfY29udHJvbC52YWwoIHJlcXVlc3RlZF9wYWdlICk7XG5cdFx0aWYgKCByZXF1ZXN0ZWRfcGFnZSA9PT0gc3RhdGUucGFnZSApIHsgcmV0dXJuOyB9XG5cdFx0c3RhdGUucGFnZSA9IHJlcXVlc3RlZF9wYWdlO1xuXHRcdGxvYWRMaXN0KCk7XG5cdH1cblx0LyoqXG5cdCAqIFJlbmRlciBvbmUgc2VydmVyLXNlbGVjdGVkIHBhZ2Ugb2YgU2VydmljZXMgaW4gdGhlIG1hbmFnZW1lbnQgdGFibGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7QXJyYXl9ICBzZXJ2aWNlcyAgIFNlcnZpY2VzIHJldHVybmVkIGZvciB0aGUgcmVxdWVzdGVkIHBhZ2Ugb25seS5cblx0ICogQHBhcmFtIHtPYmplY3R9IHBhZ2luYXRpb24gU2VydmVyLWF1dGhvcml0YXRpdmUgcGFnaW5hdGlvbiBtZXRhZGF0YS5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHJlbmRlckxpc3QoIHNlcnZpY2VzLCBwYWdpbmF0aW9uICkge1xuXHRcdHZhciAkbGlzdCA9ICQoICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fbGlzdCcgKTtcblx0XHR2YXIgJHRib2R5ID0gJCggJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX190YWJsZSB0Ym9keScgKTtcblx0XHR2YXIgaXRlbXNfZnJvbTtcblx0XHR2YXIgaXRlbXNfdG87XG5cdFx0dmFyIHBhZ2VfaXRlbXM7XG5cdFx0ZGVzdHJveV9zZXJ2aWNlX3RodW1ibmFpbF90b29sdGlwcygpO1xuXHRcdCR0Ym9keS5lbXB0eSgpO1xuXHRcdHBhZ2luYXRpb24gPSBwYWdpbmF0aW9uIHx8IHt9O1xuXHRcdHN0YXRlLnNlcnZpY2VzID0gc2VydmljZXMgfHwgW107XG5cdFx0c3RhdGUucGFnZSA9IE1hdGgubWF4KCAxLCBOdW1iZXIoIHBhZ2luYXRpb24ucGFnZV9udW1iZXIgfHwgc3RhdGUucGFnZSB8fCAxICkgKTtcblx0XHRzdGF0ZS50b3RhbF9pdGVtcyA9IE1hdGgubWF4KCAwLCBOdW1iZXIoIHBhZ2luYXRpb24udG90YWxfaXRlbXMgfHwgMCApICk7XG5cdFx0c3RhdGUudG90YWxfcGFnZXMgPSBNYXRoLm1heCggMCwgTnVtYmVyKCBwYWdpbmF0aW9uLnRvdGFsX3BhZ2VzIHx8IDAgKSApO1xuXHRcdHN5bmNfcGFnaW5hdGlvbl9jb250cm9scyggcGFnaW5hdGlvbiApO1xuXHRcdCQoICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fZW1wdHknICkucHJvcCggJ2hpZGRlbicsIHRydWUgKTtcblx0XHRpZiAoICEgc3RhdGUuc2VydmljZXMubGVuZ3RoICkgeyByZW5kZXJFbXB0eSggJycsIGZhbHNlICk7IHJldHVybjsgfVxuXHRcdGl0ZW1zX2Zyb20gPSBNYXRoLm1heCggMSwgTnVtYmVyKCBwYWdpbmF0aW9uLml0ZW1zX2Zyb20gfHwgKCAoIHN0YXRlLnBhZ2UgLSAxICkgKiBzdGF0ZS5wYWdlX3NpemUgKSArIDEgKSApO1xuXHRcdGl0ZW1zX3RvID0gTWF0aC5tYXgoIGl0ZW1zX2Zyb20sIE51bWJlciggcGFnaW5hdGlvbi5pdGVtc190byB8fCAoIGl0ZW1zX2Zyb20gKyBzdGF0ZS5zZXJ2aWNlcy5sZW5ndGggLSAxICkgKSApO1xuXHRcdHBhZ2VfaXRlbXMgPSBzdGF0ZS5zZXJ2aWNlcztcblx0XHQkbGlzdC5wcm9wKCAnaGlkZGVuJywgZmFsc2UgKTtcblxuXHRcdCQuZWFjaCggcGFnZV9pdGVtcywgZnVuY3Rpb24gKCBpbmRleCwgc2VydmljZSApIHtcblx0XHRcdHZhciBpZCA9IE51bWJlciggc2VydmljZS5zZXJ2aWNlX2lkIHx8IDAgKTtcblx0XHRcdHZhciB0aXRsZSA9IHNlcnZpY2UudGl0bGUgfHwgY29uZmlnLmkxOG4udW50aXRsZWQgfHwgJ1VudGl0bGVkIFNlcnZpY2UnO1xuXHRcdFx0dmFyIGRlc2NyaXB0aW9uID0gU3RyaW5nKCBzZXJ2aWNlLmRlc2NyaXB0aW9uIHx8ICcjJyArIGlkICk7XG5cdFx0XHR2YXIgc3RhdHVzID0gU3RyaW5nKCBzZXJ2aWNlLnN0YXR1cyB8fCAnYWN0aXZlJyApO1xuXHRcdFx0dmFyICRyb3cgPSAkKCAnPHRyPicsIHsgJ2NsYXNzJzogJ3dwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX2l0ZW0nLCAnZGF0YS1zZXJ2aWNlLWlkJzogaWQsIHRhYmluZGV4OiAnMCcsICdhcmlhLWN1cnJlbnQnOiBpZCA9PT0gc3RhdGUuc2VsZWN0ZWRJZCA/ICd0cnVlJyA6ICdmYWxzZScgfSApO1xuXHRcdFx0dmFyICRzZXJ2aWNlQ2VsbCA9ICQoICc8dGQ+JywgeyAnY2xhc3MnOiAnY29sdW1uLXNlcnZpY2UnLCAnZGF0YS1sYWJlbCc6IGNvbmZpZy5pMThuLmNvbHVtbl9zZXJ2aWNlIHx8ICdTZXJ2aWNlJyB9ICkuYXBwZW5kVG8oICRyb3cgKTtcblx0XHRcdCRyb3cudG9nZ2xlQ2xhc3MoICdpcy1zZWxlY3RlZCcsIGlkID09PSBzdGF0ZS5zZWxlY3RlZElkICk7XG5cdFx0XHR2YXIgJHNlcnZpY2VJZGVudGl0eSA9ICQoICc8ZGl2PicsIHsgJ2NsYXNzJzogJ3dwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX3NlcnZpY2VfaWRlbnRpdHknIH0gKS5hcHBlbmRUbyggJHNlcnZpY2VDZWxsICk7XG5cdFx0XHR2YXIgJHNlcnZpY2VDb3B5ID0gJCggJzxzcGFuPicsIHsgJ2NsYXNzJzogJ3dwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX3NlcnZpY2VfY29weScgfSApLmFwcGVuZFRvKCAkc2VydmljZUlkZW50aXR5ICk7XG5cdFx0XHRzZXJ2aWNlVGh1bWJuYWlsTm9kZSggc2VydmljZSApLnByZXBlbmRUbyggJHNlcnZpY2VJZGVudGl0eSApO1xuXHRcdFx0JCggJzxzdHJvbmc+JywgeyB0ZXh0OiB0aXRsZSB9ICkuYXBwZW5kVG8oICRzZXJ2aWNlQ29weSApO1xuXHRcdFx0JCggJzxzcGFuPicsIHsgdGV4dDogZGVzY3JpcHRpb24gfSApLmFwcGVuZFRvKCAkc2VydmljZUNvcHkgKTtcblx0XHRcdCQoICc8dGQ+JywgeyAnY2xhc3MnOiAnY29sdW1uLWR1cmF0aW9uJywgJ2RhdGEtbGFiZWwnOiBjb25maWcuaTE4bi5jb2x1bW5fZHVyYXRpb24gfHwgJ0R1cmF0aW9uJyB9ICkuYXBwZW5kKCBzZXJ2aWNlX2R1cmF0aW9uX25vZGUoIHNlcnZpY2UgKSApLmFwcGVuZFRvKCAkcm93ICk7XG5cdFx0XHRpZiAoIGNvbmZpZy5wcmljaW5nX2F2YWlsYWJsZSApIHtcblx0XHRcdFx0JCggJzx0ZD4nLCB7ICdjbGFzcyc6ICdjb2x1bW4tcHJpY2UnLCAnZGF0YS1sYWJlbCc6IGNvbmZpZy5pMThuLmNvbHVtbl9wcmljZSB8fCAnUHJpY2UnLCB0ZXh0OiBmb3JtYXRDb3N0KCBzZXJ2aWNlLmJhc2VfY29zdCApIH0gKS5hcHBlbmRUbyggJHJvdyApO1xuXHRcdFx0fVxuXHRcdFx0JCggJzx0ZD4nLCB7ICdjbGFzcyc6ICdjb2x1bW4tcHJvdmlkZXJzJywgJ2RhdGEtbGFiZWwnOiBjb25maWcuaTE4bi5jb2x1bW5fcHJvdmlkZXJzIHx8ICdQcm92aWRlcnMnIH0gKS5hcHBlbmQoIHByb3ZpZGVyTm9kZXMoIHNlcnZpY2UgKSApLmFwcGVuZFRvKCAkcm93ICk7XG5cdFx0XHR2YXIgJGF2YWlsYWJpbGl0eUNlbGwgPSAkKCAnPHRkPicsIHsgJ2NsYXNzJzogJ2NvbHVtbi13ZWVrZGF5cycsICdkYXRhLWxhYmVsJzogY29uZmlnLmkxOG4uY29sdW1uX3dlZWtseV9hdmFpbGFiaWxpdHkgfHwgJ1dlZWtseSBBdmFpbGFiaWxpdHknIH0gKS5hcHBlbmRUbyggJHJvdyApO1xuXHRcdFx0dmFyICRhdmFpbGFiaWxpdHlXZWVrID0gJCggJzxkaXY+JywgeyAnY2xhc3MnOiAnd3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fYXZhaWxhYmlsaXR5X3dlZWsnIH0gKS5hcHBlbmRUbyggJGF2YWlsYWJpbGl0eUNlbGwgKTtcblx0XHRcdHZhciBoYXNXZWVrbHlBdmFpbGFiaWxpdHkgPSBmYWxzZTtcblx0XHRcdCQuZWFjaCggd2Vla2RheUtleXMsIGZ1bmN0aW9uICggZGF5SW5kZXgsIGRheSApIHtcblx0XHRcdFx0dmFyIGF2YWlsYWJsZV9wcm92aWRlcnMgPSBwcm92aWRlcnNfYXZhaWxhYmxlX29uKCBzZXJ2aWNlLCBkYXkgKTtcblx0XHRcdFx0dmFyIGF2YWlsYWJsZSA9IGF2YWlsYWJsZV9wcm92aWRlcnMubGVuZ3RoID4gMDtcblx0XHRcdFx0aWYgKCBhdmFpbGFibGUgKSB7IGhhc1dlZWtseUF2YWlsYWJpbGl0eSA9IHRydWU7IH1cblx0XHRcdFx0dmFyIGRheVRpdGxlID0gY29uZmlnLndlZWtkYXlzICYmIGNvbmZpZy53ZWVrZGF5c1sgZGF5SW5kZXggXSA/IGNvbmZpZy53ZWVrZGF5c1sgZGF5SW5kZXggXSA6IGRheTtcblx0XHRcdFx0dmFyIHByb3ZpZGVyX3RpdGxlcyA9ICQubWFwKCBhdmFpbGFibGVfcHJvdmlkZXJzLCBmdW5jdGlvbiAoIHByb3ZpZGVyICkgeyByZXR1cm4gcHJvdmlkZXIudGl0bGUgfHwgJyc7IH0gKS5maWx0ZXIoIGZ1bmN0aW9uICggdGl0bGUgKSB7IHJldHVybiAhISB0aXRsZTsgfSApO1xuXHRcdFx0XHR2YXIgYXZhaWxhYmlsaXR5X3RpdGxlID0gYXZhaWxhYmxlXG5cdFx0XHRcdFx0PyBTdHJpbmcoIGNvbmZpZy5pMThuLmF2YWlsYWJsZV9wcm92aWRlcnMgfHwgJ0F2YWlsYWJsZSBQcm92aWRlcnM6ICVzJyApLnJlcGxhY2UoICclcycsIHByb3ZpZGVyX3RpdGxlcy5qb2luKCAnLCAnICkgKVxuXHRcdFx0XHRcdDogKCBjb25maWcuaTE4bi5ub19hdmFpbGFibGVfcHJvdmlkZXJzIHx8ICdObyBhc3NpZ25lZCBQcm92aWRlcnMgYXJlIGF2YWlsYWJsZScgKTtcblx0XHRcdFx0JCggJzxzcGFuPicsIHsgJ2NsYXNzJzogJ3dwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX2F2YWlsYWJpbGl0eScgKyAoIGF2YWlsYWJsZSA/ICcgaXMtYXZhaWxhYmxlJyA6ICcnICksIHRpdGxlOiBkYXlUaXRsZSArICc6ICcgKyBhdmFpbGFiaWxpdHlfdGl0bGUsICdhcmlhLWxhYmVsJzogZGF5VGl0bGUgKyAnOiAnICsgYXZhaWxhYmlsaXR5X3RpdGxlIH0gKS5hcHBlbmRUbyggJGF2YWlsYWJpbGl0eVdlZWsgKTtcblx0XHRcdH0gKTtcblx0XHRcdCRhdmFpbGFiaWxpdHlDZWxsLmFwcGVuZCggYXZhaWxhYmlsaXR5X2VkaXRfbGlua3MoIHNlcnZpY2UgKSApO1xuXHRcdFx0aWYgKCBzZXJ2aWNlLnJlc291cmNlX2lkcyAmJiBzZXJ2aWNlLnJlc291cmNlX2lkcy5sZW5ndGggJiYgISBoYXNXZWVrbHlBdmFpbGFiaWxpdHkgKSB7XG5cdFx0XHRcdCQoICc8c3Bhbj4nLCB7ICdjbGFzcyc6ICd3cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19hdmFpbGFiaWxpdHlfZW1wdHknLCB0ZXh0OiBjb25maWcuaTE4bi5ub19hdmFpbGFiaWxpdHkgfHwgJ05vIHdlZWtseSBhdmFpbGFiaWxpdHknIH0gKS5hcHBlbmRUbyggJGF2YWlsYWJpbGl0eUNlbGwgKTtcblx0XHRcdH1cblx0XHRcdHZhciAkc3RhdHVzX2NlbGwgPSAkKCAnPHRkPicsIHsgJ2NsYXNzJzogJ2NvbHVtbi1zdGF0dXMnLCAnZGF0YS1sYWJlbCc6IGNvbmZpZy5pMThuLmNvbHVtbl9zdGF0dXMgfHwgJ1N0YXR1cycgfSApLmFwcGVuZFRvKCAkcm93ICk7XG5cdFx0XHR2YXIgJHN0YXR1c19pZGVudGl0eSA9ICQoICc8ZGl2PicsIHsgJ2NsYXNzJzogJ3dwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX3N0YXR1c19pZGVudGl0eScgfSApLmFwcGVuZFRvKCAkc3RhdHVzX2NlbGwgKTtcblx0XHRcdCQoICc8c3Bhbj4nLCB7ICdjbGFzcyc6ICd3cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19zdGF0dXMgc3RhdHVzLScgKyBzdGF0dXMsIHRleHQ6IHN0YXR1c0xhYmVsKCBzdGF0dXMgKSB9ICkuYXBwZW5kVG8oICRzdGF0dXNfaWRlbnRpdHkgKTtcblx0XHRcdCQoICc8c3Bhbj4nLCB7ICdjbGFzcyc6ICd3cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19pZCcsIHRleHQ6ICggY29uZmlnLmkxOG4uY29sdW1uX2lkIHx8ICdJRCcgKSArICc6ICcgKyBpZCB9ICkuYXBwZW5kVG8oICRzdGF0dXNfaWRlbnRpdHkgKTtcblx0XHRcdHZhciAkYWN0aW9ucyA9ICQoICc8dGQ+JywgeyAnY2xhc3MnOiAnY29sdW1uLWFjdGlvbnMnLCAnZGF0YS1sYWJlbCc6IGNvbmZpZy5pMThuLmNvbHVtbl9hY3Rpb25zIHx8ICdBY3Rpb25zJyB9ICkuYXBwZW5kVG8oICRyb3cgKTtcblx0XHRcdCQoICc8YnV0dG9uPicsIHsgdHlwZTogJ2J1dHRvbicsICdjbGFzcyc6ICdidXR0b24tbGluayB3cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19yb3dfZWRpdCB3cGJjX2ljbl9lZGl0JywgJ2RhdGEtc2VydmljZS1pZCc6IGlkLCB0aXRsZTogY29uZmlnLmkxOG4uZWRpdCB8fCAnRWRpdCBTZXJ2aWNlJywgJ2FyaWEtbGFiZWwnOiBjb25maWcuaTE4bi5lZGl0IHx8ICdFZGl0IFNlcnZpY2UnIH0gKS5hcHBlbmRUbyggJGFjdGlvbnMgKTtcblx0XHRcdGlmICggJ2FyY2hpdmVkJyAhPT0gc3RhdHVzICkgeyAkKCAnPGJ1dHRvbj4nLCB7IHR5cGU6ICdidXR0b24nLCAnY2xhc3MnOiAnYnV0dG9uLWxpbmsgd3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fcm93X2FyY2hpdmUgd3BiY19pY25fb3Blbl9pbl9icm93c2VyIHdwYmNfaWNuX3JvdGF0ZV8xODAgJywgJ2RhdGEtc2VydmljZS1pZCc6IGlkLCB0aXRsZTogY29uZmlnLmkxOG4uYXJjaGl2ZSB8fCAnQXJjaGl2ZSBTZXJ2aWNlJywgJ2FyaWEtbGFiZWwnOiBjb25maWcuaTE4bi5hcmNoaXZlIHx8ICdBcmNoaXZlIFNlcnZpY2UnIH0gKS5hcHBlbmRUbyggJGFjdGlvbnMgKTsgfVxuXHRcdFx0JHRib2R5LmFwcGVuZCggJHJvdyApO1xuXHRcdH0gKTtcblxuXHRcdHJlZnJlc2hfc2VydmljZV90aHVtYm5haWxfdG9vbHRpcHMoKTtcblx0XHQkKCAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX2xpc3RfZm9vdGVyJyApLnByb3AoICdoaWRkZW4nLCBmYWxzZSApO1xuXHRcdCQoICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fcmVzdWx0X2NvdW50JyApLnRleHQoIHNob3dpbmdUZXh0KCBpdGVtc19mcm9tLCBpdGVtc190bywgc3RhdGUudG90YWxfaXRlbXMgKSApO1xuXHRcdCQoICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fcGFnZV9wcmV2JyApLnByb3AoICdkaXNhYmxlZCcsIHN0YXRlLnBhZ2UgPD0gMSApO1xuXHRcdCQoICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fcGFnZV9uZXh0JyApLnByb3AoICdkaXNhYmxlZCcsIHN0YXRlLnRvdGFsX3BhZ2VzIDwgMSB8fCBzdGF0ZS5wYWdlID49IHN0YXRlLnRvdGFsX3BhZ2VzICk7XG5cdH1cblx0LyoqIExvYWQgb25lIFNlcnZpY2UgYW5kIG9wZW4gaXQgaW4gdGhlIHJpZ2h0IGluc3BlY3Rvci4gKi9cblx0ZnVuY3Rpb24gbG9hZE9uZSggc2VydmljZUlkICkge1xuXHRcdGlmICggISBzZXJ2aWNlSWQgfHwgc3RhdGUuYnVzeSApIHsgcmV0dXJuOyB9XG5cdFx0aWYgKCBlZGl0b3JJc09wZW4oKSAmJiBzdGF0ZS5zZWxlY3RlZElkID09PSBzZXJ2aWNlSWQgKSB7IGV4cGFuZF9zZXJ2aWNlX2luc3BlY3RvcigpOyBmb2N1c19yZXF1ZXN0ZWRfc2VydmljZV9zZWN0aW9uKCk7IHJldHVybjsgfVxuXHRcdGlmICggISBjYW5fcmVwbGFjZV9lZGl0b3IoKSApIHsgcmV0dXJuOyB9XG5cdFx0c2V0QnVzeSggdHJ1ZSApO1xuXHRcdHJlcXVlc3QoIGNvbmZpZy5hY3Rpb25zLmxvYWQsIHsgc2VydmljZV9pZDogc2VydmljZUlkIH0gKS5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0aWYgKCByZXNwb25zZSAmJiByZXNwb25zZS5zdWNjZXNzICYmIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5zZXJ2aWNlICkgeyBmaWxsRWRpdG9yKCByZXNwb25zZS5kYXRhLnNlcnZpY2UgKTsgdXBkYXRlVXJsKCBzdGF0ZS5zZWxlY3RlZElkICk7IGV4cGFuZF9zZXJ2aWNlX2luc3BlY3RvcigpOyBmb2N1c19yZXF1ZXN0ZWRfc2VydmljZV9zZWN0aW9uKCk7IHJldHVybjsgfVxuXHRcdFx0bm90aWZ5KCBtZXNzYWdlRnJvbSggcmVzcG9uc2UsIGNvbmZpZy5pMThuLmxvYWRfZmFpbGVkICksICdlcnJvcicgKTtcblx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCB4aHIgKSB7IG5vdGlmeSggbWVzc2FnZUZyb20oIHhoci5yZXNwb25zZUpTT04sIGNvbmZpZy5pMThuLmxvYWRfZmFpbGVkICksICdlcnJvcicgKTsgfSApLmFsd2F5cyggZnVuY3Rpb24gKCkgeyBzZXRCdXN5KCBmYWxzZSApOyB9ICk7XG5cdH1cblx0LyoqIFJlbG9hZCBTZXJ2aWNlcyBhbmQgUHJvdmlkZXIgcHJlc2VudGF0aW9uIGRhdGEgZm9yIHRoZSBhY3RpdmUgZmlsdGVycy4gKi9cblx0ZnVuY3Rpb24gbG9hZExpc3QoIHNhdmVfaXRlbXNfcGVyX3BhZ2UgKSB7XG5cdFx0dmFyIHJlcXVlc3RfZGF0YSA9IHtcblx0XHRcdHNlYXJjaDogJCggJyN3cGJjX3NlcnZpY2Vfc2VhcmNoJyApLnZhbCgpIHx8ICcnLFxuXHRcdFx0c3RhdHVzOiBzdGF0ZS5zdGF0dXMsXG5cdFx0XHRyZXNvdXJjZV9pZDogJCggJyN3cGJjX3NlcnZpY2VfcHJvdmlkZXJfZmlsdGVyJyApLnZhbCgpIHx8IDAsXG5cdFx0XHRwYWdlX251bWJlcjogc3RhdGUucGFnZSxcblx0XHRcdGl0ZW1zX3Blcl9wYWdlOiBzdGF0ZS5wYWdlX3NpemUsXG5cdFx0XHRzb3J0X2J5OiBzdGF0ZS5zb3J0X2J5LFxuXHRcdFx0c29ydF9vcmRlcjogc3RhdGUuc29ydF9vcmRlclxuXHRcdH07XG5cdFx0aWYgKCBzYXZlX2l0ZW1zX3Blcl9wYWdlICkgeyByZXF1ZXN0X2RhdGEuc2F2ZV9pdGVtc19wZXJfcGFnZSA9IDE7IH1cblx0XHRzZXRMb2FkaW5nKCB0cnVlICk7XG5cdFx0cmVxdWVzdCggY29uZmlnLmFjdGlvbnMubGlzdCwgcmVxdWVzdF9kYXRhICkuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdGlmICggISByZXNwb25zZSB8fCAhIHJlc3BvbnNlLnN1Y2Nlc3MgfHwgISByZXNwb25zZS5kYXRhICkgeyByZW5kZXJFbXB0eSggbWVzc2FnZUZyb20oIHJlc3BvbnNlLCBjb25maWcuaTE4bi5sb2FkX2ZhaWxlZCApLCBmYWxzZSApOyByZXR1cm47IH1cblx0XHRcdHN0YXRlLnN0b3JhZ2VSZWFkeSA9ICEhIHJlc3BvbnNlLmRhdGEuc3RvcmFnZV9yZWFkeTtcblx0XHRcdGlmICggISBzdGF0ZS5zdG9yYWdlUmVhZHkgKSB7ICQoICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fdGFibGUgdGJvZHknICkuZW1wdHkoKTsgc2V0RmllbGRzRW5hYmxlZCggZmFsc2UgKTsgcmVuZGVyRW1wdHkoIHJlc3BvbnNlLmRhdGEubWVzc2FnZSB8fCBjb25maWcuaTE4bi5ub3RfY29ubmVjdGVkLCB0cnVlICk7IHJldHVybjsgfVxuXHRcdFx0c3luY19saXN0aW5nX3NldHRpbmdzKCByZXNwb25zZS5kYXRhLmxpc3RpbmcgfHwgY29uZmlnLmxpc3RpbmcgfHwge30gKTtcblx0XHRcdHN5bmNfc29ydGluZ19jb250cm9scyggcmVzcG9uc2UuZGF0YS5zb3J0aW5nIHx8IHt9ICk7XG5cdFx0XHRpbmRleFByb3ZpZGVycyggcmVzcG9uc2UuZGF0YS5wcm92aWRlcnMgfHwgW10gKTtcblx0XHRcdHVwZGF0ZVN1bW1hcnkoIHJlc3BvbnNlLmRhdGEuY291bnRzLCByZXNwb25zZS5kYXRhLnByb3ZpZGVyX2NvdW50ICk7XG5cdFx0XHRyZW5kZXJMaXN0KCByZXNwb25zZS5kYXRhLnNlcnZpY2VzIHx8IFtdLCByZXNwb25zZS5kYXRhLnBhZ2luYXRpb24gfHwge30gKTtcblx0XHRcdHVwZGF0ZUNvbnRyb2xzKCk7XG5cdFx0XHRpZiAoIHN0YXRlLnNlbGVjdGVkSWQgKSB7IGxvYWRPbmUoIHN0YXRlLnNlbGVjdGVkSWQgKTsgfVxuXHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoIHhociApIHtcblx0XHRcdHN0YXRlLnN0b3JhZ2VSZWFkeSA9IGZhbHNlO1xuXHRcdFx0c2V0RmllbGRzRW5hYmxlZCggZmFsc2UgKTtcblx0XHRcdHJlbmRlckVtcHR5KCBtZXNzYWdlRnJvbSggeGhyLnJlc3BvbnNlSlNPTiwgY29uZmlnLmkxOG4ubG9hZF9mYWlsZWQgKSwgZmFsc2UgKTtcblx0XHR9ICkuYWx3YXlzKCBmdW5jdGlvbiAoKSB7IHNldExvYWRpbmcoIGZhbHNlICk7IH0gKTtcblx0fVxuXHQvKiogQXJjaGl2ZSBvbmUgU2VydmljZSBhZnRlciBjb25maXJtYXRpb24sIHRoZW4gcmVmcmVzaCB0aGUgbGlzdC4gKi9cblx0ZnVuY3Rpb24gYXJjaGl2ZVNlcnZpY2UoIHNlcnZpY2VJZCApIHtcblx0XHRpZiAoICEgc2VydmljZUlkIHx8IHN0YXRlLmJ1c3kgfHwgISB3LmNvbmZpcm0oIGNvbmZpZy5pMThuLmNvbmZpcm1fYXJjaGl2ZSB8fCAnQXJjaGl2ZSB0aGlzIFNlcnZpY2U/JyApICkgeyByZXR1cm47IH1cblx0XHRzZXRCdXN5KCB0cnVlICk7XG5cdFx0cmVxdWVzdCggY29uZmlnLmFjdGlvbnMuYXJjaGl2ZSwgeyBzZXJ2aWNlX2lkOiBzZXJ2aWNlSWQgfSApLmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRpZiAoIHJlc3BvbnNlICYmIHJlc3BvbnNlLnN1Y2Nlc3MgKSB7XG5cdFx0XHRcdGlmICggc3RhdGUuc2VsZWN0ZWRJZCA9PT0gc2VydmljZUlkICkgeyBzdGF0ZS5zZWxlY3RlZElkID0gMDsgc2V0RmllbGRzRW5hYmxlZCggZmFsc2UgKTsgdXBkYXRlVXJsKCAwICk7IH1cblx0XHRcdFx0bm90aWZ5KCByZXNwb25zZS5kYXRhLm1lc3NhZ2UsICdzdWNjZXNzJyApOyBsb2FkTGlzdCgpOyByZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRub3RpZnkoIG1lc3NhZ2VGcm9tKCByZXNwb25zZSwgY29uZmlnLmkxOG4uYXJjaGl2ZV9mYWlsZWQgKSwgJ2Vycm9yJyApO1xuXHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoIHhociApIHsgbm90aWZ5KCBtZXNzYWdlRnJvbSggeGhyLnJlc3BvbnNlSlNPTiwgY29uZmlnLmkxOG4uYXJjaGl2ZV9mYWlsZWQgKSwgJ2Vycm9yJyApOyB9ICkuYWx3YXlzKCBmdW5jdGlvbiAoKSB7IHNldEJ1c3koIGZhbHNlICk7IH0gKTtcblx0fVxuXG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fcmlnaHRiYXJfdGFicyBbcm9sZT1cInRhYlwiXScsIGZ1bmN0aW9uICggZXZlbnQgKSB7IGV2ZW50LnByZXZlbnREZWZhdWx0KCk7IHN3aXRjaFJpZ2h0UGFuZWwoICQoIHRoaXMgKSApOyB9ICk7XG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fcmlnaHRiYXIgLndwYmNfdWlfX2NvbGxhcHNpYmxlX2dyb3VwID4gLmdyb3VwX19oZWFkZXInLCBmdW5jdGlvbiAoIGV2ZW50ICkgeyBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyB0b2dnbGVJbnNwZWN0b3JHcm91cCggJCggdGhpcyApICk7IH0gKTtcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19pdGVtJywgZnVuY3Rpb24gKCBldmVudCApIHsgaWYgKCAhICQoIGV2ZW50LnRhcmdldCApLmNsb3Nlc3QoICdidXR0b24sIGEnICkubGVuZ3RoICkgeyBsb2FkT25lKCBOdW1iZXIoICQoIHRoaXMgKS5kYXRhKCAnc2VydmljZS1pZCcgKSB8fCAwICkgKTsgfSB9ICk7XG5cdCQoIGRvY3VtZW50ICkub24oICdrZXlkb3duJywgJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19pdGVtJywgZnVuY3Rpb24gKCBldmVudCApIHsgaWYgKCAhICQoIGV2ZW50LnRhcmdldCApLmNsb3Nlc3QoICdidXR0b24sIGEnICkubGVuZ3RoICYmICggJ0VudGVyJyA9PT0gZXZlbnQua2V5IHx8ICcgJyA9PT0gZXZlbnQua2V5ICkgKSB7IGV2ZW50LnByZXZlbnREZWZhdWx0KCk7IGxvYWRPbmUoIE51bWJlciggJCggdGhpcyApLmRhdGEoICdzZXJ2aWNlLWlkJyApIHx8IDAgKSApOyB9IH0gKTtcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19yb3dfZWRpdCcsIGZ1bmN0aW9uICgpIHsgbG9hZE9uZSggTnVtYmVyKCAkKCB0aGlzICkuZGF0YSggJ3NlcnZpY2UtaWQnICkgfHwgMCApICk7IH0gKTtcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19yb3dfYXJjaGl2ZScsIGZ1bmN0aW9uICgpIHsgYXJjaGl2ZVNlcnZpY2UoIE51bWJlciggJCggdGhpcyApLmRhdGEoICdzZXJ2aWNlLWlkJyApIHx8IDAgKSApOyB9ICk7XG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fc3RhdHVzX2ZpbHRlcicsIGZ1bmN0aW9uICgpIHtcblx0XHRzdGF0ZS5zdGF0dXMgPSBTdHJpbmcoICQoIHRoaXMgKS5kYXRhKCAnc2VydmljZS1zdGF0dXMnICkgfHwgJ2FsbCcgKTtcblx0XHRzdGF0ZS5wYWdlID0gMTtcblx0XHQkKCAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX3N0YXR1c19maWx0ZXInICkucmVtb3ZlQ2xhc3MoICdpcy1hY3RpdmUnICkuYXR0ciggJ2FyaWEtcHJlc3NlZCcsICdmYWxzZScgKTtcblx0XHQkKCB0aGlzICkuYWRkQ2xhc3MoICdpcy1hY3RpdmUnICkuYXR0ciggJ2FyaWEtcHJlc3NlZCcsICd0cnVlJyApO1xuXHRcdGxvYWRMaXN0KCk7XG5cdH0gKTtcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19wYWdlX3ByZXYnLCBmdW5jdGlvbiAoKSB7IGlmICggc3RhdGUucGFnZSA+IDEgKSB7IHN0YXRlLnBhZ2UtLTsgbG9hZExpc3QoKTsgfSB9ICk7XG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fcGFnZV9uZXh0JywgZnVuY3Rpb24gKCkgeyBpZiAoIHN0YXRlLnBhZ2UgPCBzdGF0ZS50b3RhbF9wYWdlcyApIHsgc3RhdGUucGFnZSsrOyBsb2FkTGlzdCgpOyB9IH0gKTtcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJ1tkYXRhLXdwYmMtbGlzdGluZy1zb3J0PVwiYXBwb2ludG1lbnRfc2VydmljZXNfY2F0YWxvZ1wiXScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0dmFyIHNvcnRfYnkgPSBTdHJpbmcoICQoIHRoaXMgKS5kYXRhKCAnd3BiYy1saXN0aW5nLXNvcnQta2V5JyApIHx8ICcnICk7XG5cblx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdGlmICggISBzb3J0X2J5ICkgeyByZXR1cm47IH1cblx0XHRzdGF0ZS5zb3J0X29yZGVyID0gc29ydF9ieSA9PT0gc3RhdGUuc29ydF9ieSAmJiAnYXNjJyA9PT0gc3RhdGUuc29ydF9vcmRlciA/ICdkZXNjJyA6ICdhc2MnO1xuXHRcdHN0YXRlLnNvcnRfYnkgPSBzb3J0X2J5O1xuXHRcdHN0YXRlLnBhZ2UgPSAxO1xuXHRcdGxvYWRMaXN0KCk7XG5cdH0gKTtcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICdbZGF0YS13cGJjLWxpc3RpbmctcGFnZS1udW1iZXItY29udHJvbD1cImFwcG9pbnRtZW50X3NlcnZpY2VzX2NhdGFsb2dcIl0nLCBmdW5jdGlvbiAoKSB7IHJlcXVlc3Rfc2VsZWN0ZWRfcGFnZSggJCggdGhpcyApICk7IH0gKTtcblx0JCggZG9jdW1lbnQgKS5vbiggJ2tleWRvd24nLCAnW2RhdGEtd3BiYy1saXN0aW5nLXBhZ2UtbnVtYmVyLWNvbnRyb2w9XCJhcHBvaW50bWVudF9zZXJ2aWNlc19jYXRhbG9nXCJdJywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRpZiAoICdFbnRlcicgPT09IGV2ZW50LmtleSApIHsgZXZlbnQucHJldmVudERlZmF1bHQoKTsgcmVxdWVzdF9zZWxlY3RlZF9wYWdlKCAkKCB0aGlzICkgKTsgfVxuXHR9ICk7XG5cdCQoIGRvY3VtZW50ICkub24oICdjaGFuZ2UnLCAnW2RhdGEtd3BiYy1saXN0aW5nLWl0ZW1zLXBlci1wYWdlLWNvbnRyb2w9XCJhcHBvaW50bWVudF9zZXJ2aWNlc19jYXRhbG9nXCJdJywgZnVuY3Rpb24gKCkge1xuXHRcdHZhciBwYWdlX3NpemUgPSBOdW1iZXIoICQoIHRoaXMgKS52YWwoKSApO1xuXHRcdGlmICggISBpc0Zpbml0ZSggcGFnZV9zaXplICkgfHwgcGFnZV9zaXplIDwgMSB8fCBwYWdlX3NpemUgPT09IHN0YXRlLnBhZ2Vfc2l6ZSApIHsgcmV0dXJuOyB9XG5cdFx0c3RhdGUucGFnZV9zaXplID0gcGFnZV9zaXplO1xuXHRcdHN0YXRlLnBhZ2UgPSAxO1xuXHRcdGxvYWRMaXN0KCB0cnVlICk7XG5cdH0gKTtcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJy53cGJjX2FwcG9pbnRtZW50X3NlcnZpY2VzX19hZGQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0aWYgKCAhIHN0YXRlLnN0b3JhZ2VSZWFkeSB8fCBzdGF0ZS5idXN5IHx8ICEgY2FuX3JlcGxhY2VfZWRpdG9yKCkgKSB7IHJldHVybjsgfVxuXHRcdGZpbGxFZGl0b3IoIGJsYW5rU2VydmljZSgpICk7XG5cdFx0dXBkYXRlVXJsKCAwICk7XG5cdFx0b3Blbl9hZGRfc2VydmljZV9pbnNwZWN0b3IoKTtcblx0fSApO1xuXHQkKCBkb2N1bWVudCApLm9uKCAnY2xpY2snLCAnLndwYmNfYXBwb2ludG1lbnRfc2VydmljZXNfX3NhdmUnLCBmdW5jdGlvbiAoKSB7XG5cdFx0aWYgKCAhIHN0YXRlLnN0b3JhZ2VSZWFkeSB8fCBzdGF0ZS5idXN5ICkgeyByZXR1cm47IH1cblx0XHRzZXRCdXN5KCB0cnVlICk7XG5cdFx0cmVxdWVzdCggY29uZmlnLmFjdGlvbnMuc2F2ZSwgeyBzZXJ2aWNlOiBjb2xsZWN0RWRpdG9yKCkgfSApLmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRpZiAoIHJlc3BvbnNlICYmIHJlc3BvbnNlLnN1Y2Nlc3MgJiYgcmVzcG9uc2UuZGF0YSAmJiByZXNwb25zZS5kYXRhLnNlcnZpY2UgKSB7IGZpbGxFZGl0b3IoIHJlc3BvbnNlLmRhdGEuc2VydmljZSApOyB1cGRhdGVVcmwoIHN0YXRlLnNlbGVjdGVkSWQgKTsgbm90aWZ5KCByZXNwb25zZS5kYXRhLm1lc3NhZ2UsICdzdWNjZXNzJyApOyBsb2FkTGlzdCgpOyByZXR1cm47IH1cblx0XHRcdG5vdGlmeSggbWVzc2FnZUZyb20oIHJlc3BvbnNlLCBjb25maWcuaTE4bi5zYXZlX2ZhaWxlZCApLCAnZXJyb3InICk7XG5cdFx0fSApLmZhaWwoIGZ1bmN0aW9uICggeGhyICkgeyBub3RpZnkoIG1lc3NhZ2VGcm9tKCB4aHIucmVzcG9uc2VKU09OLCBjb25maWcuaTE4bi5zYXZlX2ZhaWxlZCApLCAnZXJyb3InICk7IH0gKS5hbHdheXMoIGZ1bmN0aW9uICgpIHsgc2V0QnVzeSggZmFsc2UgKTsgfSApO1xuXHR9ICk7XG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fZHVwbGljYXRlJywgZnVuY3Rpb24gKCkge1xuXHRcdGlmICggISBzdGF0ZS5zZWxlY3RlZElkIHx8IHN0YXRlLmJ1c3kgKSB7IHJldHVybjsgfVxuXHRcdHNldEJ1c3koIHRydWUgKTtcblx0XHRyZXF1ZXN0KCBjb25maWcuYWN0aW9ucy5kdXBsaWNhdGUsIHsgc2VydmljZV9pZDogc3RhdGUuc2VsZWN0ZWRJZCB9ICkuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdGlmICggcmVzcG9uc2UgJiYgcmVzcG9uc2Uuc3VjY2VzcyAmJiByZXNwb25zZS5kYXRhICYmIHJlc3BvbnNlLmRhdGEuc2VydmljZSApIHsgZmlsbEVkaXRvciggcmVzcG9uc2UuZGF0YS5zZXJ2aWNlICk7IHVwZGF0ZVVybCggc3RhdGUuc2VsZWN0ZWRJZCApOyBub3RpZnkoIHJlc3BvbnNlLmRhdGEubWVzc2FnZSwgJ3N1Y2Nlc3MnICk7IGxvYWRMaXN0KCk7IHJldHVybjsgfVxuXHRcdFx0bm90aWZ5KCBtZXNzYWdlRnJvbSggcmVzcG9uc2UsIGNvbmZpZy5pMThuLmR1cGxpY2F0ZV9mYWlsZWQgKSwgJ2Vycm9yJyApO1xuXHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoIHhociApIHsgbm90aWZ5KCBtZXNzYWdlRnJvbSggeGhyLnJlc3BvbnNlSlNPTiwgY29uZmlnLmkxOG4uZHVwbGljYXRlX2ZhaWxlZCApLCAnZXJyb3InICk7IH0gKS5hbHdheXMoIGZ1bmN0aW9uICgpIHsgc2V0QnVzeSggZmFsc2UgKTsgfSApO1xuXHR9ICk7XG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fYXJjaGl2ZScsIGZ1bmN0aW9uICgpIHsgYXJjaGl2ZVNlcnZpY2UoIHN0YXRlLnNlbGVjdGVkSWQgKTsgfSApO1xuXHQkKCBkb2N1bWVudCApLm9uKCAnaW5wdXQgY2hhbmdlJywgJ1tkYXRhLXNlcnZpY2UtcmFuZ2UtZmllbGRdJywgZnVuY3Rpb24gKCkge1xuXHRcdHZhciBmaWVsZF9pZCA9IFN0cmluZyggJCggdGhpcyApLmRhdGEoICdzZXJ2aWNlLXJhbmdlLWZpZWxkJyApIHx8ICcnICk7XG5cdFx0aWYgKCBmaWVsZF9pZCApIHsgJCggJ1tkYXRhLXNlcnZpY2UtZmllbGQ9XCInICsgZmllbGRfaWQgKyAnXCJdJyApLnZhbCggJCggdGhpcyApLnZhbCgpICkudHJpZ2dlciggJ2lucHV0JyApOyB9XG5cdH0gKTtcblx0JCggZG9jdW1lbnQgKS5vbiggJ2lucHV0IGNoYW5nZScsICdpbnB1dFt0eXBlPVwibnVtYmVyXCJdW2RhdGEtc2VydmljZS1maWVsZF0nLCBmdW5jdGlvbiAoKSB7IHN5bmNfbnVtZXJpY19yYW5nZSggU3RyaW5nKCAkKCB0aGlzICkuZGF0YSggJ3NlcnZpY2UtZmllbGQnICkgfHwgJycgKSApOyB9ICk7XG5cdCQoIGRvY3VtZW50ICkub24oICdjaGFuZ2UnLCAnW2RhdGEtc2VydmljZS1zdGF0dXMtY2hvaWNlXScsIGZ1bmN0aW9uICgpIHtcblx0XHRpZiAoIHRoaXMuY2hlY2tlZCApIHsgJCggJ1tkYXRhLXNlcnZpY2UtZmllbGQ9XCJzdGF0dXNcIl0nICkudmFsKCB0aGlzLnZhbHVlICkudHJpZ2dlciggJ2NoYW5nZScgKTsgfVxuXHR9ICk7XG5cdCQoIGRvY3VtZW50ICkub24oICdpbnB1dCBjaGFuZ2Ugd3BiY19tZWRpYV91cGxvYWRfdXJsX3NldCcsICdbZGF0YS1zZXJ2aWNlLWZpZWxkPVwicGljdHVyZV91cmxcIl0nLCBmdW5jdGlvbiAoKSB7IHVwZGF0ZU1lZGlhUHJldmlldygpOyB1cGRhdGVDb250cm9scygpOyB9ICk7XG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY19hcHBvaW50bWVudF9zZXJ2aWNlc19fcmVtb3ZlX2ltYWdlJywgZnVuY3Rpb24gKCkge1xuXHRcdGlmICggJCggdGhpcyApLnByb3AoICdkaXNhYmxlZCcgKSApIHsgcmV0dXJuOyB9XG5cdFx0JCggJ1tkYXRhLXNlcnZpY2UtZmllbGQ9XCJwaWN0dXJlX3VybFwiXScgKS52YWwoICcnICkudHJpZ2dlciggJ2lucHV0JyApLnRyaWdnZXIoICdjaGFuZ2UnICk7XG5cdH0gKTtcblx0JCggZG9jdW1lbnQgKS5vbiggJ2lucHV0JywgJyN3cGJjX3NlcnZpY2Vfc2VhcmNoJywgZnVuY3Rpb24gKCkgeyB3LmNsZWFyVGltZW91dCggc2VhcmNoVGltZXIgKTsgc3RhdGUucGFnZSA9IDE7IHNlYXJjaFRpbWVyID0gdy5zZXRUaW1lb3V0KCBsb2FkTGlzdCwgMjUwICk7IH0gKTtcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICcjd3BiY19zZXJ2aWNlX3Byb3ZpZGVyX2ZpbHRlcicsIGZ1bmN0aW9uICgpIHsgc3RhdGUucGFnZSA9IDE7IGxvYWRMaXN0KCk7IH0gKTtcblx0JCggZnVuY3Rpb24gKCkgeyBpZiAoICQoICdbZGF0YS13cGJjLWFwcG9pbnRtZW50LXNlcnZpY2VzLXBhZ2U9XCIxXCJdJyApLmxlbmd0aCApIHsgbG9hZExpc3QoKTsgfSB9ICk7XG59ICkoIHdpbmRvdywgalF1ZXJ5ICk7XG4iXSwibWFwcGluZ3MiOiI7O0FBQUEsQ0FBRSxVQUFXQSxDQUFDLEVBQUVDLENBQUMsRUFBRztFQUNuQixZQUFZOztFQUNaLElBQUlDLE1BQU0sR0FBR0YsQ0FBQyxDQUFDRyxnQ0FBZ0MsSUFBSSxDQUFDLENBQUM7RUFDckQsSUFBSUMsS0FBSyxHQUFHO0lBQ1hDLFlBQVksRUFBRSxLQUFLO0lBQ25CQyxVQUFVLEVBQUVDLE1BQU0sQ0FBRUwsTUFBTSxDQUFDTSxXQUFXLElBQUksQ0FBRSxDQUFDO0lBQzdDQyxlQUFlLEVBQUVDLE1BQU0sQ0FBRVIsTUFBTSxDQUFDUyxhQUFhLElBQUksRUFBRyxDQUFDO0lBQ3JEQyxhQUFhLEVBQUUsS0FBSztJQUNwQkMsSUFBSSxFQUFFLEtBQUs7SUFDWEMsTUFBTSxFQUFFLEtBQUs7SUFDYkMsUUFBUSxFQUFFLEVBQUU7SUFDWkMsU0FBUyxFQUFFLENBQUMsQ0FBQztJQUNiQyxhQUFhLEVBQUUsQ0FBQztJQUNoQkMsZUFBZSxFQUFFLEVBQUU7SUFDbkJDLElBQUksRUFBRSxDQUFDO0lBQ1BDLFNBQVMsRUFBRWIsTUFBTSxDQUFFTCxNQUFNLENBQUNtQixPQUFPLElBQUluQixNQUFNLENBQUNtQixPQUFPLENBQUNDLGNBQWMsR0FBR3BCLE1BQU0sQ0FBQ21CLE9BQU8sQ0FBQ0MsY0FBYyxHQUFHLEVBQUcsQ0FBQztJQUN6R0MsV0FBVyxFQUFFLENBQUM7SUFDZEMsV0FBVyxFQUFFLENBQUM7SUFDZEMsT0FBTyxFQUFFZixNQUFNLENBQUVSLE1BQU0sQ0FBQ21CLE9BQU8sSUFBSW5CLE1BQU0sQ0FBQ21CLE9BQU8sQ0FBQ0ksT0FBTyxHQUFHdkIsTUFBTSxDQUFDbUIsT0FBTyxDQUFDSSxPQUFPLEdBQUcsWUFBYSxDQUFDO0lBQ25HQyxVQUFVLEVBQUVoQixNQUFNLENBQUVSLE1BQU0sQ0FBQ21CLE9BQU8sSUFBSW5CLE1BQU0sQ0FBQ21CLE9BQU8sQ0FBQ0ssVUFBVSxHQUFHeEIsTUFBTSxDQUFDbUIsT0FBTyxDQUFDSyxVQUFVLEdBQUcsTUFBTztFQUN0RyxDQUFDO0VBQ0QsSUFBSUMsV0FBVyxHQUFHLENBQUM7RUFDbkIsSUFBSUMsV0FBVyxHQUFHLENBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFFOztFQUVyRTtFQUNBLFNBQVNDLFdBQVdBLENBQUVDLFFBQVEsRUFBRUMsUUFBUSxFQUFHO0lBQUUsT0FBT0QsUUFBUSxJQUFJQSxRQUFRLENBQUNFLElBQUksSUFBSUYsUUFBUSxDQUFDRSxJQUFJLENBQUNDLE9BQU8sR0FBR0gsUUFBUSxDQUFDRSxJQUFJLENBQUNDLE9BQU8sR0FBR0YsUUFBUTtFQUFFO0VBQzNJO0VBQ0EsU0FBU0csTUFBTUEsQ0FBRUQsT0FBTyxFQUFFRSxJQUFJLEVBQUc7SUFDaEMsSUFBS0YsT0FBTyxJQUFJLE9BQU9qQyxDQUFDLENBQUNvQyx1QkFBdUIsS0FBSyxVQUFVLEVBQUc7TUFBRXBDLENBQUMsQ0FBQ29DLHVCQUF1QixDQUFFSCxPQUFPLEVBQUVFLElBQUksSUFBSSxNQUFNLEVBQUUsSUFBSSxFQUFFLEtBQU0sQ0FBQztJQUFFO0VBQ3hJO0VBQ0E7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNFLHNCQUFzQkEsQ0FBQSxFQUFHO0lBQ2pDLElBQUssVUFBVSxLQUFLLE9BQU9yQyxDQUFDLENBQUNzQyxrQ0FBa0MsRUFBRztNQUNqRSxPQUFPckMsQ0FBQyxDQUFDLENBQUM7SUFDWDtJQUVBRCxDQUFDLENBQUNzQyxrQ0FBa0MsQ0FBRSxFQUFHLENBQUM7SUFFMUMsT0FBT3JDLENBQUMsQ0FBRSwwQ0FBMkMsQ0FBQyxDQUFDc0MsSUFBSSxDQUFDLENBQUMsQ0FBQ0MsT0FBTyxDQUFFLHNCQUF1QixDQUFDO0VBQ2hHO0VBQ0E7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU0Msc0JBQXNCQSxDQUFFQyxrQkFBa0IsRUFBRztJQUNyRCxJQUFLQSxrQkFBa0IsSUFBSUEsa0JBQWtCLENBQUNDLE1BQU0sRUFBRztNQUN0REQsa0JBQWtCLENBQUNFLElBQUksQ0FBRSxJQUFJLEVBQUUsSUFBSyxDQUFDLENBQUNDLElBQUksQ0FBQyxDQUFDO0lBQzdDO0VBQ0Q7RUFDQTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNDLE9BQU9BLENBQUVDLE1BQU0sRUFBRWYsSUFBSSxFQUFHO0lBQ2hDLElBQUlVLGtCQUFrQixHQUFHTCxzQkFBc0IsQ0FBQyxDQUFDO0lBRWpELE9BQU9wQyxDQUFDLENBQUMrQyxJQUFJLENBQUU7TUFBRUMsR0FBRyxFQUFFL0MsTUFBTSxDQUFDZ0QsUUFBUTtNQUFFZixJQUFJLEVBQUUsTUFBTTtNQUFFZ0IsUUFBUSxFQUFFLE1BQU07TUFBRW5CLElBQUksRUFBRS9CLENBQUMsQ0FBQ21ELE1BQU0sQ0FBRTtRQUFFTCxNQUFNLEVBQUVBLE1BQU07UUFBRU0sS0FBSyxFQUFFbkQsTUFBTSxDQUFDbUQ7TUFBTSxDQUFDLEVBQUVyQixJQUFJLElBQUksQ0FBQyxDQUFFO0lBQUUsQ0FBRSxDQUFDLENBQzlJc0IsTUFBTSxDQUFFLFlBQVk7TUFBRWIsc0JBQXNCLENBQUVDLGtCQUFtQixDQUFDO0lBQUUsQ0FBRSxDQUFDO0VBQzFFO0VBQ0E7RUFDQSxTQUFTYSxVQUFVQSxDQUFFQyxTQUFTLEVBQUc7SUFDaEN2RCxDQUFDLENBQUUscUNBQXNDLENBQUMsQ0FBQ3dELFdBQVcsQ0FBRSxZQUFZLEVBQUVELFNBQVUsQ0FBQyxDQUFDRSxJQUFJLENBQUUsYUFBYSxFQUFFRixTQUFTLEdBQUcsT0FBTyxHQUFHLE1BQU8sQ0FBQztJQUNySXZELENBQUMsQ0FBRSxxQ0FBc0MsQ0FBQyxDQUFDeUQsSUFBSSxDQUFFLFdBQVcsRUFBRUYsU0FBUyxHQUFHLE1BQU0sR0FBRyxPQUFRLENBQUM7RUFDN0Y7RUFDQTtFQUNBLFNBQVNHLGdCQUFnQkEsQ0FBRUMsSUFBSSxFQUFHO0lBQ2pDLElBQUlDLE9BQU8sR0FBR0QsSUFBSSxDQUFDRixJQUFJLENBQUUsZUFBZ0IsQ0FBQztJQUMxQyxJQUFJSSxLQUFLLEdBQUdELE9BQU8sR0FBR0UsUUFBUSxDQUFDQyxjQUFjLENBQUVILE9BQVEsQ0FBQyxHQUFHLElBQUk7SUFDL0QsSUFBSUksS0FBSyxHQUFHTCxJQUFJLENBQUNwQixPQUFPLENBQUUsMkNBQTRDLENBQUMsQ0FBQzBCLElBQUksQ0FBRSxjQUFlLENBQUM7SUFDOUYsSUFBSUMsT0FBTyxHQUFHbEUsQ0FBQyxDQUFFLHdEQUF5RCxDQUFDO0lBQzNFLElBQUssQ0FBRTZELEtBQUssRUFBRztNQUFFO0lBQVE7SUFDekJHLEtBQUssQ0FBQ1AsSUFBSSxDQUFFLGVBQWUsRUFBRSxPQUFRLENBQUM7SUFDdENFLElBQUksQ0FBQ0YsSUFBSSxDQUFFLGVBQWUsRUFBRSxNQUFPLENBQUM7SUFDcENTLE9BQU8sQ0FBQ0MsSUFBSSxDQUFFLFFBQVEsRUFBRSxJQUFLLENBQUMsQ0FBQ1YsSUFBSSxDQUFFLGFBQWEsRUFBRSxNQUFPLENBQUM7SUFDNUR6RCxDQUFDLENBQUU2RCxLQUFNLENBQUMsQ0FBQ00sSUFBSSxDQUFFLFFBQVEsRUFBRSxLQUFNLENBQUMsQ0FBQ1YsSUFBSSxDQUFFLGFBQWEsRUFBRSxPQUFRLENBQUM7SUFDakVXLGNBQWMsQ0FBQyxDQUFDO0VBQ2pCO0VBQ0E7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNDLGtDQUFrQ0EsQ0FBQSxFQUFHO0lBQzdDckUsQ0FBQyxDQUFFOEQsUUFBUyxDQUFDLENBQUNRLE9BQU8sQ0FBRSxrQ0FBbUMsQ0FBQztJQUMzRHZFLENBQUMsQ0FBQ3dFLFVBQVUsQ0FBRSxZQUFZO01BQUV2RSxDQUFDLENBQUU4RCxRQUFTLENBQUMsQ0FBQ1EsT0FBTyxDQUFFLGtDQUFtQyxDQUFDO0lBQUUsQ0FBQyxFQUFFLEdBQUksQ0FBQztFQUNsRztFQUNBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTRSx3QkFBd0JBLENBQUEsRUFBRztJQUNuQyxJQUFJQyxhQUFhLEdBQUd6RSxDQUFDLENBQUUsNEJBQTZCLENBQUM7SUFFckQsSUFBSyxVQUFVLEtBQUssT0FBT0QsQ0FBQyxDQUFDMkUsb0NBQW9DLEVBQUc7TUFDbkUzRSxDQUFDLENBQUMyRSxvQ0FBb0MsQ0FBQyxDQUFDO0lBQ3pDO0lBQ0EsSUFBS0QsYUFBYSxDQUFDL0IsTUFBTSxFQUFHO01BQzNCZ0IsZ0JBQWdCLENBQUVlLGFBQWMsQ0FBQztJQUNsQztJQUNBSixrQ0FBa0MsQ0FBQyxDQUFDO0VBQ3JDO0VBQ0E7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTTSw0QkFBNEJBLENBQUVDLGVBQWUsRUFBRUMsY0FBYyxFQUFHO0lBQ3hFLElBQUlDLGFBQWEsR0FBRzlFLENBQUMsQ0FBRTRFLGVBQWdCLENBQUM7SUFDeEMsSUFBSUcsTUFBTSxHQUFHRCxhQUFhLENBQUN2QyxPQUFPLENBQUUsNkJBQThCLENBQUM7SUFDbkUsSUFBSXlDLGFBQWEsR0FBR0QsTUFBTSxDQUFDRSxRQUFRLENBQUUsZ0JBQWlCLENBQUM7SUFDdkQsSUFBSUMsYUFBYSxHQUFHSCxNQUFNLENBQUNJLEdBQUcsQ0FBRSxDQUFFLENBQUM7SUFDbkMsSUFBSUMsYUFBYSxHQUFHUCxjQUFjLEdBQUdmLFFBQVEsQ0FBQ3VCLGFBQWEsQ0FBRVIsY0FBZSxDQUFDLEdBQUcsSUFBSTtJQUVwRkwsd0JBQXdCLENBQUMsQ0FBQztJQUMxQixJQUFLLENBQUVPLE1BQU0sQ0FBQ3JDLE1BQU0sRUFBRztNQUN0QixPQUFPLEtBQUs7SUFDYjtJQUVBcUMsTUFBTSxDQUFDTyxRQUFRLENBQUUsU0FBVSxDQUFDO0lBQzVCTixhQUFhLENBQUN2QixJQUFJLENBQUUsZUFBZSxFQUFFLE1BQU8sQ0FBQztJQUM3Q3FCLGFBQWEsQ0FBQ1gsSUFBSSxDQUFFLFFBQVEsRUFBRSxLQUFNLENBQUMsQ0FBQ1YsSUFBSSxDQUFFLGFBQWEsRUFBRSxPQUFRLENBQUM7SUFDcEVzQixNQUFNLENBQUNRLFdBQVcsQ0FBRSx3Q0FBeUMsQ0FBQztJQUM5RCxJQUFLTCxhQUFhLEVBQUc7TUFDcEIsS0FBS0EsYUFBYSxDQUFDTSxXQUFXO01BQzlCVCxNQUFNLENBQUNPLFFBQVEsQ0FBRSx3Q0FBeUMsQ0FBQztNQUMzRCxJQUFJO1FBQUVKLGFBQWEsQ0FBQ08sY0FBYyxDQUFFO1VBQUVDLFFBQVEsRUFBRSxRQUFRO1VBQUVDLEtBQUssRUFBRSxPQUFPO1VBQUVDLE1BQU0sRUFBRTtRQUFVLENBQUUsQ0FBQztNQUFFLENBQUMsQ0FDbEcsT0FBUUMsS0FBSyxFQUFHO1FBQUVYLGFBQWEsQ0FBQ08sY0FBYyxDQUFFLElBQUssQ0FBQztNQUFFO01BQ3hEMUYsQ0FBQyxDQUFDd0UsVUFBVSxDQUFFLFlBQVk7UUFBRVEsTUFBTSxDQUFDUSxXQUFXLENBQUUsd0NBQXlDLENBQUM7TUFBRSxDQUFDLEVBQUUsR0FBSSxDQUFDO0lBQ3JHO0lBQ0EsSUFBS0gsYUFBYSxJQUFJLE9BQU9BLGFBQWEsQ0FBQ1UsS0FBSyxLQUFLLFVBQVUsRUFBRztNQUNqRSxJQUFJO1FBQUVWLGFBQWEsQ0FBQ1UsS0FBSyxDQUFFO1VBQUVDLGFBQWEsRUFBRTtRQUFLLENBQUUsQ0FBQztNQUFFLENBQUMsQ0FDdkQsT0FBUUYsS0FBSyxFQUFHO1FBQUVULGFBQWEsQ0FBQ1UsS0FBSyxDQUFDLENBQUM7TUFBRTtJQUMxQztJQUVBLE9BQU8sSUFBSTtFQUNaO0VBQ0E7QUFDRDtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNFLDBCQUEwQkEsQ0FBQSxFQUFHO0lBQ3JDckIsNEJBQTRCLENBQUUsdUJBQXVCLEVBQUUsOEJBQStCLENBQUM7RUFDeEY7RUFDQTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU3NCLCtCQUErQkEsQ0FBQSxFQUFHO0lBQzFDLElBQUs5RixLQUFLLENBQUNRLGFBQWEsSUFBSSxjQUFjLEtBQUtSLEtBQUssQ0FBQ0ssZUFBZSxFQUFHO01BQ3RFO0lBQ0Q7SUFFQSxJQUFLbUUsNEJBQTRCLENBQUUsb0JBQW9CLEVBQUUsd0NBQXlDLENBQUMsRUFBRztNQUNyR3hFLEtBQUssQ0FBQ1EsYUFBYSxHQUFHLElBQUk7TUFDMUIsSUFBS1osQ0FBQyxDQUFDbUcsT0FBTyxJQUFJbkcsQ0FBQyxDQUFDb0csR0FBRyxFQUFHO1FBQ3pCLElBQUluRCxHQUFHLEdBQUcsSUFBSWpELENBQUMsQ0FBQ29HLEdBQUcsQ0FBRXBHLENBQUMsQ0FBQ3FHLFFBQVEsQ0FBQ0MsSUFBSyxDQUFDO1FBQ3RDckQsR0FBRyxDQUFDc0QsWUFBWSxDQUFDQyxNQUFNLENBQUUsb0JBQXFCLENBQUM7UUFDL0N4RyxDQUFDLENBQUNtRyxPQUFPLENBQUNNLFlBQVksQ0FBRSxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUV4RCxHQUFHLENBQUN5RCxRQUFRLENBQUMsQ0FBRSxDQUFDO01BQ2pEO0lBQ0Q7RUFDRDtFQUNBO0VBQ0EsU0FBU0Msb0JBQW9CQSxDQUFFQyxPQUFPLEVBQUc7SUFDeEMsSUFBSTVCLE1BQU0sR0FBRzRCLE9BQU8sQ0FBQ3BFLE9BQU8sQ0FBRSw2QkFBOEIsQ0FBQztJQUM3RCxJQUFJcUUsT0FBTyxHQUFHN0IsTUFBTSxDQUFDZCxJQUFJLENBQUUsa0JBQW1CLENBQUM7SUFDL0MsSUFBSTRDLE1BQU0sR0FBRzlCLE1BQU0sQ0FBQytCLFFBQVEsQ0FBRSxTQUFVLENBQUM7SUFDekMvQixNQUFNLENBQUN2QixXQUFXLENBQUUsU0FBUyxFQUFFLENBQUVxRCxNQUFPLENBQUM7SUFDekNGLE9BQU8sQ0FBQ2xELElBQUksQ0FBRSxlQUFlLEVBQUVvRCxNQUFNLEdBQUcsT0FBTyxHQUFHLE1BQU8sQ0FBQztJQUMxREQsT0FBTyxDQUFDekMsSUFBSSxDQUFFLFFBQVEsRUFBRTBDLE1BQU8sQ0FBQyxDQUFDcEQsSUFBSSxDQUFFLGFBQWEsRUFBRW9ELE1BQU0sR0FBRyxNQUFNLEdBQUcsT0FBUSxDQUFDO0VBQ2xGO0VBQ0E7RUFDQSxTQUFTRSxZQUFZQSxDQUFBLEVBQUc7SUFBRSxPQUFPLENBQUUvRyxDQUFDLENBQUUsOEJBQStCLENBQUMsQ0FBQ21FLElBQUksQ0FBRSxVQUFXLENBQUM7RUFBRTtFQUMzRjtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTNkMsa0JBQWtCQSxDQUFFQyxRQUFRLEVBQUc7SUFDdkMsSUFBSUMsTUFBTSxHQUFHbEgsQ0FBQyxDQUFFLHVCQUF1QixHQUFHaUgsUUFBUSxHQUFHLElBQUssQ0FBQztJQUMzRCxJQUFJRSxNQUFNLEdBQUduSCxDQUFDLENBQUUsNkJBQTZCLEdBQUdpSCxRQUFRLEdBQUcsSUFBSyxDQUFDO0lBQ2pFLElBQUlHLEtBQUssR0FBRzlHLE1BQU0sQ0FBRTRHLE1BQU0sQ0FBQ0csR0FBRyxDQUFDLENBQUUsQ0FBQztJQUNsQyxJQUFJQyxXQUFXLEdBQUdoSCxNQUFNLENBQUU2RyxNQUFNLENBQUNwRixJQUFJLENBQUUsMkJBQTRCLENBQUUsQ0FBQztJQUN0RSxJQUFJd0YsV0FBVyxHQUFHakgsTUFBTSxDQUFFNkcsTUFBTSxDQUFDcEYsSUFBSSxDQUFFLDJCQUE0QixDQUFFLENBQUM7SUFDdEUsSUFBSXlGLElBQUksR0FBR2xILE1BQU0sQ0FBRTZHLE1BQU0sQ0FBQzFELElBQUksQ0FBRSxNQUFPLENBQUMsSUFBSSxDQUFFLENBQUM7SUFDL0MsSUFBSWdFLFNBQVM7SUFFYixJQUFLLENBQUVQLE1BQU0sQ0FBQ3hFLE1BQU0sSUFBSSxDQUFFeUUsTUFBTSxDQUFDekUsTUFBTSxJQUFJLENBQUVnRixRQUFRLENBQUVOLEtBQU0sQ0FBQyxFQUFHO01BQUU7SUFBUTtJQUMzRUUsV0FBVyxHQUFHSSxRQUFRLENBQUVKLFdBQVksQ0FBQyxHQUFHQSxXQUFXLEdBQUcsQ0FBQztJQUN2REMsV0FBVyxHQUFHRyxRQUFRLENBQUVILFdBQVksQ0FBQyxHQUFHQSxXQUFXLEdBQUcsR0FBRztJQUN6REMsSUFBSSxHQUFHRSxRQUFRLENBQUVGLElBQUssQ0FBQyxJQUFJQSxJQUFJLEdBQUcsQ0FBQyxHQUFHQSxJQUFJLEdBQUcsQ0FBQztJQUM5Q0MsU0FBUyxHQUFHTCxLQUFLLEdBQUdHLFdBQVcsR0FBR0QsV0FBVyxHQUFLSyxJQUFJLENBQUNDLElBQUksQ0FBRSxDQUFFUixLQUFLLEdBQUdFLFdBQVcsSUFBS0UsSUFBSyxDQUFDLEdBQUdBLElBQU0sR0FBR0QsV0FBVztJQUNwSEosTUFBTSxDQUFDMUQsSUFBSSxDQUFFO01BQUVvRSxHQUFHLEVBQUVQLFdBQVc7TUFBRVEsR0FBRyxFQUFFTDtJQUFVLENBQUUsQ0FBQyxDQUFDSixHQUFHLENBQUVELEtBQU0sQ0FBQztFQUNqRTtFQUNBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTVyx1QkFBdUJBLENBQUEsRUFBRztJQUNsQy9ILENBQUMsQ0FBRSw0QkFBNkIsQ0FBQyxDQUFDZ0ksSUFBSSxDQUFFLFlBQVk7TUFBRWhCLGtCQUFrQixDQUFFdkcsTUFBTSxDQUFFVCxDQUFDLENBQUUsSUFBSyxDQUFDLENBQUMrQixJQUFJLENBQUUscUJBQXNCLENBQUMsSUFBSSxFQUFHLENBQUUsQ0FBQztJQUFFLENBQUUsQ0FBQztFQUN6STtFQUNBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTa0csa0JBQWtCQSxDQUFBLEVBQUc7SUFDN0IsSUFBSXBILE1BQU0sR0FBR0osTUFBTSxDQUFFVCxDQUFDLENBQUUsK0JBQWdDLENBQUMsQ0FBQ3FILEdBQUcsQ0FBQyxDQUFDLElBQUksUUFBUyxDQUFDO0lBQzdFckgsQ0FBQyxDQUFFLDhCQUErQixDQUFDLENBQUNnSSxJQUFJLENBQUUsWUFBWTtNQUNyRGhJLENBQUMsQ0FBRSxJQUFLLENBQUMsQ0FBQ21FLElBQUksQ0FBRSxTQUFTLEVBQUUxRCxNQUFNLENBQUVULENBQUMsQ0FBRSxJQUFLLENBQUMsQ0FBQ3FILEdBQUcsQ0FBQyxDQUFFLENBQUMsS0FBS3hHLE1BQU8sQ0FBQztJQUNsRSxDQUFFLENBQUM7RUFDSjtFQUNBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTcUgsa0JBQWtCQSxDQUFBLEVBQUc7SUFDN0IsSUFBSUMsVUFBVSxHQUFHMUgsTUFBTSxDQUFFVCxDQUFDLENBQUUsb0NBQXFDLENBQUMsQ0FBQ3FILEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRyxDQUFDLENBQUNlLElBQUksQ0FBQyxDQUFDO0lBQ3ZGLElBQUlDLE1BQU0sR0FBR3JJLENBQUMsQ0FBRSx5Q0FBMEMsQ0FBQztJQUMzRCxJQUFLbUksVUFBVSxFQUFHO01BQUVFLE1BQU0sQ0FBQzVFLElBQUksQ0FBRSxLQUFLLEVBQUUwRSxVQUFXLENBQUM7SUFBRSxDQUFDLE1BQU07TUFBRUUsTUFBTSxDQUFDQyxVQUFVLENBQUUsS0FBTSxDQUFDO0lBQUU7SUFDM0ZELE1BQU0sQ0FBQ2xFLElBQUksQ0FBRSxRQUFRLEVBQUUsQ0FBRWdFLFVBQVcsQ0FBQztJQUNyQ25JLENBQUMsQ0FBRSwrQ0FBZ0QsQ0FBQyxDQUFDbUUsSUFBSSxDQUFFLFFBQVEsRUFBRSxDQUFDLENBQUVnRSxVQUFXLENBQUM7RUFDckY7RUFDQTtFQUNBLFNBQVMvRCxjQUFjQSxDQUFBLEVBQUc7SUFDekIsSUFBSW1FLElBQUksR0FBR3BJLEtBQUssQ0FBQ0MsWUFBWSxJQUFJMkcsWUFBWSxDQUFDLENBQUM7SUFDL0MsSUFBSXlCLFVBQVUsR0FBRyxDQUFDLENBQUUvSCxNQUFNLENBQUVULENBQUMsQ0FBRSxvQ0FBcUMsQ0FBQyxDQUFDcUgsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFHLENBQUMsQ0FBQ2UsSUFBSSxDQUFDLENBQUM7SUFDMUYsSUFBSUssU0FBUyxHQUFHRixJQUFJLElBQUksTUFBTSxLQUFLdkksQ0FBQyxDQUFFLDRCQUE2QixDQUFDLENBQUN5RCxJQUFJLENBQUUsZUFBZ0IsQ0FBQztJQUM1RnpELENBQUMsQ0FBRSxpQ0FBa0MsQ0FBQyxDQUFDbUUsSUFBSSxDQUFFLFFBQVEsRUFBRSxLQUFNLENBQUMsQ0FBQ0EsSUFBSSxDQUFFLFVBQVUsRUFBRSxDQUFFaEUsS0FBSyxDQUFDQyxZQUFZLElBQUlELEtBQUssQ0FBQ1MsSUFBSyxDQUFDO0lBQ3JIWixDQUFDLENBQUUsMkZBQTRGLENBQUMsQ0FBQ21FLElBQUksQ0FBRSxRQUFRLEVBQUUsQ0FBRXNFLFNBQVUsQ0FBQztJQUM5SHpJLENBQUMsQ0FBRSxrQ0FBbUMsQ0FBQyxDQUFDbUUsSUFBSSxDQUFFLFFBQVEsRUFBRSxDQUFFc0UsU0FBVSxDQUFDLENBQUN0RSxJQUFJLENBQUUsVUFBVSxFQUFFLENBQUVvRSxJQUFJLElBQUlwSSxLQUFLLENBQUNTLElBQUssQ0FBQztJQUM5R1osQ0FBQyxDQUFFLDRFQUE2RSxDQUFDLENBQUNtRSxJQUFJLENBQUUsVUFBVSxFQUFFLENBQUVvRSxJQUFJLElBQUksQ0FBRXBJLEtBQUssQ0FBQ0UsVUFBVSxJQUFJRixLQUFLLENBQUNTLElBQUssQ0FBQztJQUNoSlosQ0FBQyxDQUFFLHFGQUFzRixDQUFDLENBQUNtRSxJQUFJLENBQUUsVUFBVSxFQUFFLENBQUVvRSxJQUFJLElBQUlwSSxLQUFLLENBQUNTLElBQUssQ0FBQztJQUNuSVosQ0FBQyxDQUFFLDBDQUEyQyxDQUFDLENBQUNtRSxJQUFJLENBQUUsVUFBVSxFQUFFLENBQUVvRSxJQUFJLElBQUksQ0FBRUMsVUFBVSxJQUFJckksS0FBSyxDQUFDUyxJQUFLLENBQUM7RUFDekc7RUFDQTtFQUNBLFNBQVM4SCxPQUFPQSxDQUFFdEIsS0FBSyxFQUFHO0lBQUVqSCxLQUFLLENBQUNTLElBQUksR0FBR3dHLEtBQUs7SUFBRXBILENBQUMsQ0FBRSxpQ0FBa0MsQ0FBQyxDQUFDd0QsV0FBVyxDQUFFLFNBQVMsRUFBRTRELEtBQU0sQ0FBQztJQUFFaEQsY0FBYyxDQUFDLENBQUM7RUFBRTtFQUMxSTtFQUNBLFNBQVN1RSxnQkFBZ0JBLENBQUVDLE9BQU8sRUFBRztJQUFFNUksQ0FBQyxDQUFFLGdGQUFpRixDQUFDLENBQUNtRSxJQUFJLENBQUUsVUFBVSxFQUFFLENBQUV5RSxPQUFRLENBQUM7SUFBRXhFLGNBQWMsQ0FBQyxDQUFDO0VBQUU7RUFDOUs7RUFDQSxTQUFTeUUsWUFBWUEsQ0FBQSxFQUFHO0lBQ3ZCLE9BQU87TUFBRUMsVUFBVSxFQUFFLENBQUM7TUFBRUMsS0FBSyxFQUFFLEVBQUU7TUFBRUMsV0FBVyxFQUFFLEVBQUU7TUFBRUMsV0FBVyxFQUFFLEVBQUU7TUFBRXBJLE1BQU0sRUFBRSxRQUFRO01BQUVxSSxnQkFBZ0IsRUFBRSxFQUFFO01BQUVDLHFCQUFxQixFQUFFLENBQUM7TUFBRUMsb0JBQW9CLEVBQUUsQ0FBQztNQUFFQyxTQUFTLEVBQUUsTUFBTTtNQUFFQyxlQUFlLEVBQUUsQ0FBQztNQUFFQyxZQUFZLEVBQUU7SUFBRyxDQUFDO0VBQzFOO0VBQ0E7RUFDQSxTQUFTQyxVQUFVQSxDQUFFQyxPQUFPLEVBQUc7SUFDOUJBLE9BQU8sR0FBR3pKLENBQUMsQ0FBQ21ELE1BQU0sQ0FBRTBGLFlBQVksQ0FBQyxDQUFDLEVBQUVZLE9BQU8sSUFBSSxDQUFDLENBQUUsQ0FBQztJQUNuRHRKLEtBQUssQ0FBQ0UsVUFBVSxHQUFHQyxNQUFNLENBQUVtSixPQUFPLENBQUNYLFVBQVUsSUFBSSxDQUFFLENBQUM7SUFDcEQ5SSxDQUFDLENBQUNnSSxJQUFJLENBQUV5QixPQUFPLEVBQUUsVUFBV0MsR0FBRyxFQUFFdEMsS0FBSyxFQUFHO01BQUVwSCxDQUFDLENBQUUsdUJBQXVCLEdBQUcwSixHQUFHLEdBQUcsSUFBSyxDQUFDLENBQUNyQyxHQUFHLENBQUVELEtBQU0sQ0FBQztJQUFFLENBQUUsQ0FBQztJQUN0R2Esa0JBQWtCLENBQUMsQ0FBQztJQUNwQkYsdUJBQXVCLENBQUMsQ0FBQztJQUN6Qkcsa0JBQWtCLENBQUMsQ0FBQztJQUNwQlMsZ0JBQWdCLENBQUV4SSxLQUFLLENBQUNDLFlBQWEsQ0FBQztJQUN0Q0osQ0FBQyxDQUFFLGtDQUFtQyxDQUFDLENBQUN1RixXQUFXLENBQUUsYUFBYyxDQUFDLENBQUM5QixJQUFJLENBQUUsY0FBYyxFQUFFLE9BQVEsQ0FBQztJQUNwR3pELENBQUMsQ0FBRSxvREFBb0QsR0FBR0csS0FBSyxDQUFDRSxVQUFVLEdBQUcsSUFBSyxDQUFDLENBQUNpRixRQUFRLENBQUUsYUFBYyxDQUFDLENBQUM3QixJQUFJLENBQUUsY0FBYyxFQUFFLE1BQU8sQ0FBQztJQUM1SWtHLHVCQUF1QixDQUFDLENBQUM7RUFDMUI7RUFDQTtFQUNBLFNBQVNDLGFBQWFBLENBQUEsRUFBRztJQUN4QixJQUFJSCxPQUFPLEdBQUc7TUFBRVgsVUFBVSxFQUFFM0ksS0FBSyxDQUFDRTtJQUFXLENBQUM7SUFDOUNMLENBQUMsQ0FBRSxzQkFBdUIsQ0FBQyxDQUFDZ0ksSUFBSSxDQUFFLFlBQVk7TUFBRXlCLE9BQU8sQ0FBRXpKLENBQUMsQ0FBRSxJQUFLLENBQUMsQ0FBQytCLElBQUksQ0FBRSxlQUFnQixDQUFDLENBQUUsR0FBRy9CLENBQUMsQ0FBRSxJQUFLLENBQUMsQ0FBQ3FILEdBQUcsQ0FBQyxDQUFDO0lBQUUsQ0FBRSxDQUFDO0lBQ25ILE9BQU9vQyxPQUFPO0VBQ2Y7RUFDQTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU0UsdUJBQXVCQSxDQUFBLEVBQUc7SUFDbEN4SixLQUFLLENBQUNjLGVBQWUsR0FBRzRJLElBQUksQ0FBQ0MsU0FBUyxDQUFFRixhQUFhLENBQUMsQ0FBRSxDQUFDO0VBQzFEO0VBQ0E7QUFDRDtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNHLGVBQWVBLENBQUEsRUFBRztJQUMxQixPQUFPaEQsWUFBWSxDQUFDLENBQUMsSUFBSTVHLEtBQUssQ0FBQ2MsZUFBZSxLQUFLNEksSUFBSSxDQUFDQyxTQUFTLENBQUVGLGFBQWEsQ0FBQyxDQUFFLENBQUM7RUFDckY7RUFDQTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU0ksa0JBQWtCQSxDQUFBLEVBQUc7SUFDN0IsT0FBTyxDQUFFRCxlQUFlLENBQUMsQ0FBQyxJQUFJaEssQ0FBQyxDQUFDa0ssT0FBTyxDQUFFaEssTUFBTSxDQUFDaUssSUFBSSxDQUFDQyxlQUFlLElBQUksa0NBQW1DLENBQUM7RUFDN0c7RUFDQTtFQUNBLFNBQVNDLFNBQVNBLENBQUVDLFNBQVMsRUFBRztJQUMvQixJQUFLLENBQUV0SyxDQUFDLENBQUNtRyxPQUFPLElBQUksQ0FBRW5HLENBQUMsQ0FBQ29HLEdBQUcsRUFBRztNQUFFO0lBQVE7SUFDeEMsSUFBSW5ELEdBQUcsR0FBRyxJQUFJakQsQ0FBQyxDQUFDb0csR0FBRyxDQUFFcEcsQ0FBQyxDQUFDcUcsUUFBUSxDQUFDQyxJQUFLLENBQUM7SUFDdEMsSUFBS2dFLFNBQVMsRUFBRztNQUFFckgsR0FBRyxDQUFDc0QsWUFBWSxDQUFDZ0UsR0FBRyxDQUFFLFlBQVksRUFBRUQsU0FBVSxDQUFDO0lBQUUsQ0FBQyxNQUFNO01BQUVySCxHQUFHLENBQUNzRCxZQUFZLENBQUNDLE1BQU0sQ0FBRSxZQUFhLENBQUM7SUFBRTtJQUN0SHhHLENBQUMsQ0FBQ21HLE9BQU8sQ0FBQ00sWUFBWSxDQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRXhELEdBQUcsQ0FBQ3lELFFBQVEsQ0FBQyxDQUFFLENBQUM7RUFDakQ7RUFDQTtFQUNBLFNBQVM4RCxXQUFXQSxDQUFFdkksT0FBTyxFQUFFd0ksYUFBYSxFQUFHO0lBQzlDLElBQUlDLE1BQU0sR0FBR3pLLENBQUMsQ0FBRSxtQ0FBb0MsQ0FBQztJQUNyRCxJQUFJMEssV0FBVyxHQUFHLENBQUVGLGFBQWEsSUFBSSxDQUFFeEksT0FBTyxJQUFJLENBQUMsS0FBSzdCLEtBQUssQ0FBQ2EsYUFBYTtJQUMzRWhCLENBQUMsQ0FBRSxrQ0FBbUMsQ0FBQyxDQUFDbUUsSUFBSSxDQUFFLFFBQVEsRUFBRSxJQUFLLENBQUM7SUFDOURzRyxNQUFNLENBQUN0RyxJQUFJLENBQUUsUUFBUSxFQUFFLEtBQU0sQ0FBQyxDQUFDWCxXQUFXLENBQUUsbUJBQW1CLEVBQUUsQ0FBQyxDQUFFZ0gsYUFBYyxDQUFDO0lBQ25GQyxNQUFNLENBQUN4RyxJQUFJLENBQUUsSUFBSyxDQUFDLENBQUMwRyxJQUFJLENBQUVILGFBQWEsR0FBS3ZLLE1BQU0sQ0FBQ2lLLElBQUksQ0FBQ1UsYUFBYSxJQUFJLG1DQUFtQyxHQUFPRixXQUFXLEdBQUt6SyxNQUFNLENBQUNpSyxJQUFJLENBQUNXLFlBQVksSUFBSSx3QkFBd0IsR0FBTzVLLE1BQU0sQ0FBQ2lLLElBQUksQ0FBQ1ksS0FBSyxJQUFJLGlCQUFzQixDQUFDO0lBQzFPTCxNQUFNLENBQUN4RyxJQUFJLENBQUUsR0FBSSxDQUFDLENBQUMwRyxJQUFJLENBQUUzSSxPQUFPLEtBQU0wSSxXQUFXLEdBQUd6SyxNQUFNLENBQUNpSyxJQUFJLENBQUNhLGlCQUFpQixHQUFHOUssTUFBTSxDQUFDaUssSUFBSSxDQUFDYyxVQUFVLENBQUUsSUFBSSxFQUFHLENBQUM7RUFDckg7RUFDQTtFQUNBLFNBQVNDLGNBQWNBLENBQUVsSyxTQUFTLEVBQUc7SUFDcENaLEtBQUssQ0FBQ1ksU0FBUyxHQUFHLENBQUMsQ0FBQztJQUNwQmYsQ0FBQyxDQUFDZ0ksSUFBSSxDQUFFakgsU0FBUyxJQUFJLEVBQUUsRUFBRSxVQUFXbUssS0FBSyxFQUFFQyxRQUFRLEVBQUc7TUFBRWhMLEtBQUssQ0FBQ1ksU0FBUyxDQUFFTixNQUFNLENBQUUwSyxRQUFRLENBQUNDLEVBQUcsQ0FBQyxDQUFFLEdBQUdELFFBQVE7SUFBRSxDQUFFLENBQUM7RUFDakg7RUFDQTtFQUNBLFNBQVNFLGFBQWFBLENBQUVDLE1BQU0sRUFBRXRLLGFBQWEsRUFBRztJQUMvQ3NLLE1BQU0sR0FBR3RMLENBQUMsQ0FBQ21ELE1BQU0sQ0FBRTtNQUFFb0ksR0FBRyxFQUFFLENBQUM7TUFBRUMsTUFBTSxFQUFFLENBQUM7TUFBRUMsUUFBUSxFQUFFLENBQUM7TUFBRUMsUUFBUSxFQUFFO0lBQUUsQ0FBQyxFQUFFSixNQUFNLElBQUksQ0FBQyxDQUFFLENBQUM7SUFDbEZuTCxLQUFLLENBQUNhLGFBQWEsR0FBR1YsTUFBTSxDQUFFVSxhQUFhLElBQUksQ0FBRSxDQUFDO0lBQ2xEaEIsQ0FBQyxDQUFDZ0ksSUFBSSxDQUFFc0QsTUFBTSxFQUFFLFVBQVd6SyxNQUFNLEVBQUU4SyxLQUFLLEVBQUc7TUFBRTNMLENBQUMsQ0FBRSx1QkFBdUIsR0FBR2EsTUFBTSxHQUFHLElBQUssQ0FBQyxDQUFDOEosSUFBSSxDQUFFckssTUFBTSxDQUFFcUwsS0FBSyxJQUFJLENBQUUsQ0FBRSxDQUFDO0lBQUUsQ0FBRSxDQUFDO0lBQzNIM0wsQ0FBQyxDQUFFLHVCQUF3QixDQUFDLENBQUMySyxJQUFJLENBQUV4SyxLQUFLLENBQUNhLGFBQWMsQ0FBQztJQUN4RGhCLENBQUMsQ0FBRSw2Q0FBOEMsQ0FBQyxDQUFDbUUsSUFBSSxDQUFFLFFBQVEsRUFBRSxDQUFDLEtBQUtoRSxLQUFLLENBQUNhLGFBQWMsQ0FBQztFQUMvRjtFQUNBO0VBQ0EsU0FBUzRLLFVBQVVBLENBQUVDLElBQUksRUFBRztJQUMzQixJQUFJQyxNQUFNLEdBQUd4TCxNQUFNLENBQUV1TCxJQUFJLElBQUksQ0FBRSxDQUFDO0lBQ2hDLElBQUlFLE1BQU0sR0FBRzlMLE1BQU0sQ0FBQytMLGVBQWUsSUFBSSxHQUFHO0lBQzFDLE9BQU9ELE1BQU0sR0FBR0QsTUFBTSxDQUFDRyxPQUFPLENBQUUsQ0FBRSxDQUFDO0VBQ3BDO0VBQ0E7RUFDQSxTQUFTQyxhQUFhQSxDQUFFekMsT0FBTyxFQUFHO0lBQ2pDLElBQUkwQyxHQUFHLEdBQUduTSxDQUFDLENBQUNvTSxHQUFHLENBQUUzQyxPQUFPLENBQUNGLFlBQVksSUFBSSxFQUFFLEVBQUUsVUFBV25DLEtBQUssRUFBRztNQUFFLE9BQU85RyxNQUFNLENBQUU4RyxLQUFLLElBQUksQ0FBRSxDQUFDO0lBQUUsQ0FBRSxDQUFDO0lBQ2xHLElBQUlpRixNQUFNLEdBQUdyTSxDQUFDLENBQUUsT0FBTyxFQUFFO01BQUUsT0FBTyxFQUFFO0lBQTRDLENBQUUsQ0FBQztJQUNuRixJQUFLLENBQUVtTSxHQUFHLENBQUN6SixNQUFNLEVBQUc7TUFBRSxPQUFPMUMsQ0FBQyxDQUFFLFFBQVEsRUFBRTtRQUFFLE9BQU8sRUFBRSx3Q0FBd0M7UUFBRTJLLElBQUksRUFBRTFLLE1BQU0sQ0FBQ2lLLElBQUksQ0FBQ29DLFdBQVcsSUFBSTtNQUF3QixDQUFFLENBQUM7SUFBRTtJQUM3SnRNLENBQUMsQ0FBQ2dJLElBQUksQ0FBRW1FLEdBQUcsQ0FBQ0ksS0FBSyxDQUFFLENBQUMsRUFBRSxDQUFFLENBQUMsRUFBRSxVQUFXckIsS0FBSyxFQUFFRSxFQUFFLEVBQUc7TUFDakQsSUFBSUQsUUFBUSxHQUFHaEwsS0FBSyxDQUFDWSxTQUFTLENBQUVOLE1BQU0sQ0FBRTJLLEVBQUcsQ0FBQyxDQUFFLElBQUk7UUFBRUEsRUFBRSxFQUFFQSxFQUFFO1FBQUVyQyxLQUFLLEVBQUUsWUFBWSxHQUFHcUMsRUFBRTtRQUFFb0IsUUFBUSxFQUFFLEdBQUc7UUFBRUMsVUFBVSxFQUFFO01BQUcsQ0FBQztNQUNySCxJQUFJQyxnQkFBZ0IsR0FBRyxLQUFLLEtBQUt2QixRQUFRLENBQUN3Qix1QkFBdUI7TUFDakUsSUFBSUMsY0FBYyxHQUFHekIsUUFBUSxDQUFDcEMsS0FBSyxJQUFJLFlBQVksR0FBR3FDLEVBQUU7TUFDeEQsSUFBSXlCLFlBQVksR0FBR0QsY0FBYztNQUNqQyxJQUFJRSxpQkFBaUI7TUFDckIsSUFBSUMsT0FBTztNQUVYLElBQUssQ0FBRUwsZ0JBQWdCLEVBQUc7UUFBRUcsWUFBWSxJQUFJLEtBQUssSUFBSzVNLE1BQU0sQ0FBQ2lLLElBQUksQ0FBQzhDLGVBQWUsSUFBSSx3QkFBd0IsQ0FBRTtNQUFFO01BQ2pIRixpQkFBaUIsR0FBRztRQUNuQixPQUFPLEVBQUUsNENBQTRDLElBQUtKLGdCQUFnQixHQUFHLEVBQUUsR0FBRyxzQkFBc0IsQ0FBRTtRQUMxRzNELEtBQUssRUFBRThEO01BQ1IsQ0FBQztNQUNELElBQUsxQixRQUFRLENBQUM4QixnQkFBZ0IsRUFBRztRQUNoQ0osWUFBWSxHQUFHcE0sTUFBTSxDQUFFUixNQUFNLENBQUNpSyxJQUFJLENBQUNnRCxpQkFBaUIsSUFBSSwwQkFBMkIsQ0FBQyxDQUFDQyxPQUFPLENBQUUsSUFBSSxFQUFFUCxjQUFlLENBQUM7UUFDcEhFLGlCQUFpQixDQUFDekcsSUFBSSxHQUFHOEUsUUFBUSxDQUFDOEIsZ0JBQWdCO1FBQ2xESCxpQkFBaUIsQ0FBQy9ELEtBQUssR0FBRzhELFlBQVk7UUFDdENDLGlCQUFpQixDQUFFLFlBQVksQ0FBRSxHQUFHRCxZQUFZO1FBQ2hERSxPQUFPLEdBQUcvTSxDQUFDLENBQUUsS0FBSyxFQUFFOE0saUJBQWtCLENBQUM7TUFDeEMsQ0FBQyxNQUFNO1FBQ05DLE9BQU8sR0FBRy9NLENBQUMsQ0FBRSxRQUFRLEVBQUU4TSxpQkFBa0IsQ0FBQztNQUMzQztNQUNBLElBQUszQixRQUFRLENBQUNzQixVQUFVLEVBQUc7UUFBRXpNLENBQUMsQ0FBRSxPQUFPLEVBQUU7VUFBRW9OLEdBQUcsRUFBRWpDLFFBQVEsQ0FBQ3NCLFVBQVU7VUFBRVksR0FBRyxFQUFFLEVBQUU7VUFBRUMsT0FBTyxFQUFFO1FBQU8sQ0FBRSxDQUFDLENBQUNDLFFBQVEsQ0FBRVIsT0FBUSxDQUFDO01BQUUsQ0FBQyxNQUNuSDtRQUFFQSxPQUFPLENBQUNwQyxJQUFJLENBQUVRLFFBQVEsQ0FBQ3FCLFFBQVEsSUFBSSxHQUFJLENBQUM7TUFBRTtNQUNqREgsTUFBTSxDQUFDbUIsTUFBTSxDQUFFVCxPQUFRLENBQUM7SUFDekIsQ0FBRSxDQUFDO0lBQ0gsSUFBS1osR0FBRyxDQUFDekosTUFBTSxHQUFHLENBQUMsRUFBRztNQUFFMUMsQ0FBQyxDQUFFLFFBQVEsRUFBRTtRQUFFLE9BQU8sRUFBRSwwQ0FBMEM7UUFBRTJLLElBQUksRUFBRSxHQUFHLElBQUt3QixHQUFHLENBQUN6SixNQUFNLEdBQUcsQ0FBQyxDQUFFO1FBQUVxRyxLQUFLLEVBQUlvRCxHQUFHLENBQUN6SixNQUFNLEdBQUcsQ0FBQyxHQUFLLEdBQUcsSUFBS3pDLE1BQU0sQ0FBQ2lLLElBQUksQ0FBQ3VELGNBQWMsSUFBSSxnQkFBZ0I7TUFBRyxDQUFFLENBQUMsQ0FBQ0YsUUFBUSxDQUFFbEIsTUFBTyxDQUFDO0lBQUU7SUFDek8sT0FBT0EsTUFBTTtFQUNkO0VBQ0E7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU3FCLG9CQUFvQkEsQ0FBRWpFLE9BQU8sRUFBRztJQUN4QyxJQUFJdEIsVUFBVSxHQUFHMUgsTUFBTSxDQUFFZ0osT0FBTyxDQUFDUixXQUFXLElBQUksRUFBRyxDQUFDLENBQUNiLElBQUksQ0FBQyxDQUFDO0lBQzNELElBQUl1RixhQUFhLEdBQUdsTixNQUFNLENBQUVnSixPQUFPLENBQUNWLEtBQUssSUFBSTlJLE1BQU0sQ0FBQ2lLLElBQUksQ0FBQzBELFFBQVEsSUFBSSxrQkFBbUIsQ0FBQztJQUN6RixJQUFJQyxtQkFBbUIsR0FBR3BOLE1BQU0sQ0FBRWdKLE9BQU8sQ0FBQ1QsV0FBVyxJQUFJLEVBQUcsQ0FBQyxDQUFDWixJQUFJLENBQUMsQ0FBQyxJQUFJbkksTUFBTSxDQUFDaUssSUFBSSxDQUFDNEQsY0FBYyxJQUFJLGdCQUFnQjtJQUN0SCxJQUFJQyxjQUFjLEdBQUd0TixNQUFNLENBQUVSLE1BQU0sQ0FBQ2lLLElBQUksQ0FBQzhELHlCQUF5QixJQUFJLGdDQUFpQyxDQUFDO0lBQ3hHLElBQUlDLFlBQVksR0FBR0YsY0FBYyxDQUFDWixPQUFPLENBQUUsTUFBTSxFQUFFUSxhQUFjLENBQUMsQ0FBQ1IsT0FBTyxDQUFFLE1BQU0sRUFBRVUsbUJBQW9CLENBQUM7SUFDekcsSUFBSUssVUFBVSxHQUFHbE8sQ0FBQyxDQUFFLFFBQVEsRUFBRTtNQUM3QixPQUFPLEVBQUUsMERBQTBEO01BQ25FLHFCQUFxQixFQUFFaU8sWUFBWTtNQUNuQyxZQUFZLEVBQUVBLFlBQVk7TUFDMUJFLElBQUksRUFBRSxLQUFLO01BQ1hDLFFBQVEsRUFBRTtJQUNYLENBQUUsQ0FBQztJQUNILElBQUtqRyxVQUFVLEVBQUc7TUFDakJuSSxDQUFDLENBQUUsT0FBTyxFQUFFO1FBQUVvTixHQUFHLEVBQUVqRixVQUFVO1FBQUVrRixHQUFHLEVBQUUsRUFBRTtRQUFFQyxPQUFPLEVBQUUsTUFBTTtRQUFFZSxRQUFRLEVBQUU7TUFBUSxDQUFFLENBQUMsQ0FBQ2QsUUFBUSxDQUFFVyxVQUFXLENBQUM7SUFDdEcsQ0FBQyxNQUFNO01BQ05sTyxDQUFDLENBQUUsS0FBSyxFQUFFO1FBQUUsT0FBTyxFQUFFLHNDQUFzQztRQUFFLGFBQWEsRUFBRTtNQUFPLENBQUUsQ0FBQyxDQUFDdU4sUUFBUSxDQUFFVyxVQUFXLENBQUM7SUFDOUc7SUFDQSxPQUFPQSxVQUFVO0VBQ2xCO0VBQ0E7QUFDRDtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNJLGtDQUFrQ0EsQ0FBQSxFQUFHO0lBQzdDdE8sQ0FBQyxDQUFFLCtDQUFnRCxDQUFDLENBQUNnSSxJQUFJLENBQUUsWUFBWTtNQUN0RSxJQUFLLElBQUksQ0FBQ3VHLE1BQU0sSUFBSSxVQUFVLEtBQUssT0FBTyxJQUFJLENBQUNBLE1BQU0sQ0FBQ0MsT0FBTyxFQUFHO1FBQy9ELElBQUksQ0FBQ0QsTUFBTSxDQUFDQyxPQUFPLENBQUMsQ0FBQztNQUN0QjtJQUNELENBQUUsQ0FBQztFQUNKO0VBQ0E7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNDLGtDQUFrQ0EsQ0FBQSxFQUFHO0lBQzdDLElBQUlDLGdCQUFnQixHQUFHLGdEQUFnRDtJQUN2RSxJQUFJQyxXQUFXLEdBQUczTyxDQUFDLENBQUUwTyxnQkFBZ0IsR0FBRywrQ0FBZ0QsQ0FBQztJQUN6RixJQUFJRSxvQkFBb0IsR0FBRyxLQUFLO0lBRWhDLElBQUssVUFBVSxLQUFLLE9BQU83TyxDQUFDLENBQUM4TywwQkFBMEIsRUFBRztNQUN6REQsb0JBQW9CLEdBQUc3TyxDQUFDLENBQUM4TywwQkFBMEIsQ0FBRUgsZ0JBQWlCLENBQUM7SUFDeEU7SUFDQSxJQUFLRSxvQkFBb0IsRUFBRztNQUMzQjtJQUNEO0lBQ0FELFdBQVcsQ0FBQzNHLElBQUksQ0FBRSxZQUFZO01BQzdCaEksQ0FBQyxDQUFFLElBQUssQ0FBQyxDQUFDeUQsSUFBSSxDQUFFLE9BQU8sRUFBRXpELENBQUMsQ0FBRSxJQUFLLENBQUMsQ0FBQ3lELElBQUksQ0FBRSxxQkFBc0IsQ0FBQyxJQUFJLEVBQUcsQ0FBQztJQUN6RSxDQUFFLENBQUM7RUFDSjtFQUNBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNxTCxxQkFBcUJBLENBQUVyRixPQUFPLEVBQUc7SUFDekMsSUFBSVAsZ0JBQWdCLEdBQUd2QixJQUFJLENBQUNHLEdBQUcsQ0FBRSxDQUFDLEVBQUV4SCxNQUFNLENBQUVtSixPQUFPLENBQUNQLGdCQUFnQixJQUFJLENBQUUsQ0FBRSxDQUFDO0lBQzdFLElBQUlDLHFCQUFxQixHQUFHeEIsSUFBSSxDQUFDRyxHQUFHLENBQUUsQ0FBQyxFQUFFeEgsTUFBTSxDQUFFbUosT0FBTyxDQUFDTixxQkFBcUIsSUFBSSxDQUFFLENBQUUsQ0FBQztJQUN2RixJQUFJQyxvQkFBb0IsR0FBR3pCLElBQUksQ0FBQ0csR0FBRyxDQUFFLENBQUMsRUFBRXhILE1BQU0sQ0FBRW1KLE9BQU8sQ0FBQ0wsb0JBQW9CLElBQUksQ0FBRSxDQUFFLENBQUM7SUFDckYsSUFBSTJGLGVBQWUsR0FBR3RPLE1BQU0sQ0FBRVIsTUFBTSxDQUFDaUssSUFBSSxDQUFDaEIsZ0JBQWdCLElBQUksUUFBUyxDQUFDO0lBQ3hFLElBQUk4RixjQUFjLEdBQUd2TyxNQUFNLENBQUVSLE1BQU0sQ0FBQ2lLLElBQUksQ0FBQytFLGVBQWUsSUFBSSwwQkFBMkIsQ0FBQztJQUN4RixJQUFJQyxzQkFBc0IsR0FBR3pPLE1BQU0sQ0FBRVIsTUFBTSxDQUFDaUssSUFBSSxDQUFDaUYsZUFBZSxJQUFJLGlEQUFrRCxDQUFDO0lBQ3ZILElBQUlGLGVBQWUsR0FBR0QsY0FBYyxDQUFDN0IsT0FBTyxDQUFFLE1BQU0sRUFBRWhFLHFCQUFzQixDQUFDLENBQUNnRSxPQUFPLENBQUUsTUFBTSxFQUFFL0Qsb0JBQXFCLENBQUM7SUFDckgsSUFBSStGLGVBQWUsR0FBR0Qsc0JBQXNCLENBQUMvQixPQUFPLENBQUUsTUFBTSxFQUFFaEUscUJBQXNCLENBQUMsQ0FBQ2dFLE9BQU8sQ0FBRSxNQUFNLEVBQUUvRCxvQkFBcUIsQ0FBQztJQUM3SCxJQUFJZ0csaUJBQWlCLEdBQUdwUCxDQUFDLENBQUUsUUFBUSxFQUFFO01BQUUsT0FBTyxFQUFFO0lBQThDLENBQUUsQ0FBQztJQUVqR0EsQ0FBQyxDQUFFLFVBQVUsRUFBRTtNQUNkLE9BQU8sRUFBRSwyQ0FBMkM7TUFDcEQySyxJQUFJLEVBQUVvRSxlQUFlLENBQUM1QixPQUFPLENBQUUsSUFBSSxFQUFFakUsZ0JBQWlCO0lBQ3ZELENBQUUsQ0FBQyxDQUFDcUUsUUFBUSxDQUFFNkIsaUJBQWtCLENBQUM7SUFDakNwUCxDQUFDLENBQUUsUUFBUSxFQUFFO01BQ1osT0FBTyxFQUFFLDRDQUE0QztNQUNyRDJLLElBQUksRUFBRXNFLGVBQWU7TUFDckJsRyxLQUFLLEVBQUVvRyxlQUFlO01BQ3RCLFlBQVksRUFBRUE7SUFDZixDQUFFLENBQUMsQ0FBQzVCLFFBQVEsQ0FBRTZCLGlCQUFrQixDQUFDO0lBRWpDLE9BQU9BLGlCQUFpQjtFQUN6QjtFQUNBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU0Msc0JBQXNCQSxDQUFFNUYsT0FBTyxFQUFFNkYsR0FBRyxFQUFHO0lBQy9DLElBQUlDLG1CQUFtQixHQUFHLEVBQUU7SUFDNUJ2UCxDQUFDLENBQUNnSSxJQUFJLENBQUV5QixPQUFPLENBQUNGLFlBQVksSUFBSSxFQUFFLEVBQUUsVUFBVzJCLEtBQUssRUFBRUUsRUFBRSxFQUFHO01BQzFELElBQUlELFFBQVEsR0FBR2hMLEtBQUssQ0FBQ1ksU0FBUyxDQUFFTixNQUFNLENBQUVILE1BQU0sQ0FBRThLLEVBQUUsSUFBSSxDQUFFLENBQUUsQ0FBQyxDQUFFO01BQzdELElBQUtELFFBQVEsSUFBSUEsUUFBUSxDQUFDcUUsUUFBUSxJQUFJckUsUUFBUSxDQUFDcUUsUUFBUSxDQUFFRixHQUFHLENBQUUsRUFBRztRQUNoRUMsbUJBQW1CLENBQUNFLElBQUksQ0FBRXRFLFFBQVMsQ0FBQztNQUNyQztJQUNELENBQUUsQ0FBQztJQUVILE9BQU9vRSxtQkFBbUI7RUFDM0I7RUFDQTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTRyx1QkFBdUJBLENBQUVqRyxPQUFPLEVBQUc7SUFDM0MsSUFBSWtHLE1BQU0sR0FBRzNQLENBQUMsQ0FBRSxPQUFPLEVBQUU7TUFDeEIsT0FBTyxFQUFFLCtDQUErQztNQUN4RCxZQUFZLEVBQUVDLE1BQU0sQ0FBQ2lLLElBQUksQ0FBQzBGLDBCQUEwQixJQUFJO0lBQ3pELENBQUUsQ0FBQztJQUVINVAsQ0FBQyxDQUFDZ0ksSUFBSSxDQUFFeUIsT0FBTyxDQUFDRixZQUFZLElBQUksRUFBRSxFQUFFLFVBQVcyQixLQUFLLEVBQUVFLEVBQUUsRUFBRztNQUMxRCxJQUFJRCxRQUFRLEdBQUdoTCxLQUFLLENBQUNZLFNBQVMsQ0FBRU4sTUFBTSxDQUFFSCxNQUFNLENBQUU4SyxFQUFFLElBQUksQ0FBRSxDQUFFLENBQUMsQ0FBRTtNQUM3RCxJQUFJd0IsY0FBYztNQUNsQixJQUFJaUQsVUFBVTtNQUVkLElBQUssQ0FBRTFFLFFBQVEsSUFBSSxDQUFFQSxRQUFRLENBQUM4QixnQkFBZ0IsRUFBRztRQUNoRDtNQUNEO01BQ0FMLGNBQWMsR0FBR3pCLFFBQVEsQ0FBQ3BDLEtBQUssSUFBSSxZQUFZLEdBQUd6SSxNQUFNLENBQUU4SyxFQUFFLElBQUksQ0FBRSxDQUFDO01BQ25FeUUsVUFBVSxHQUFHcFAsTUFBTSxDQUFFUixNQUFNLENBQUNpSyxJQUFJLENBQUNnRCxpQkFBaUIsSUFBSSwwQkFBMkIsQ0FBQyxDQUFDQyxPQUFPLENBQUUsSUFBSSxFQUFFUCxjQUFlLENBQUM7TUFDbEg1TSxDQUFDLENBQUUsS0FBSyxFQUFFO1FBQ1QsT0FBTyxFQUFFLDhDQUE4QztRQUN2RHFHLElBQUksRUFBRThFLFFBQVEsQ0FBQzhCLGdCQUFnQjtRQUMvQnRDLElBQUksRUFBRVEsUUFBUSxDQUFDcUIsUUFBUSxJQUFJLEdBQUc7UUFDOUJ6RCxLQUFLLEVBQUU4RyxVQUFVO1FBQ2pCLFlBQVksRUFBRUE7TUFDZixDQUFFLENBQUMsQ0FBQ3RDLFFBQVEsQ0FBRW9DLE1BQU8sQ0FBQztJQUN2QixDQUFFLENBQUM7SUFFSCxPQUFPQSxNQUFNLENBQUMxSyxRQUFRLENBQUMsQ0FBQyxDQUFDdkMsTUFBTSxHQUFHaU4sTUFBTSxHQUFHM1AsQ0FBQyxDQUFDLENBQUM7RUFDL0M7RUFDQTtFQUNBLFNBQVM4UCxXQUFXQSxDQUFFalAsTUFBTSxFQUFHO0lBQzlCLElBQUssVUFBVSxLQUFLQSxNQUFNLEVBQUc7TUFBRSxPQUFPWixNQUFNLENBQUNpSyxJQUFJLENBQUM2RixLQUFLLElBQUksT0FBTztJQUFFO0lBQ3BFLElBQUssVUFBVSxLQUFLbFAsTUFBTSxFQUFHO01BQUUsT0FBT1osTUFBTSxDQUFDaUssSUFBSSxDQUFDd0IsUUFBUSxJQUFJLFVBQVU7SUFBRTtJQUMxRSxPQUFPekwsTUFBTSxDQUFDaUssSUFBSSxDQUFDc0IsTUFBTSxJQUFJLFFBQVE7RUFDdEM7RUFDQTtFQUNBLFNBQVN3RSxXQUFXQSxDQUFFQyxJQUFJLEVBQUVDLEVBQUUsRUFBRUMsS0FBSyxFQUFHO0lBQ3ZDLElBQUlDLE1BQU0sR0FBR25RLE1BQU0sQ0FBQ2lLLElBQUksQ0FBQ21HLE9BQU8sSUFBSSxvQ0FBb0M7SUFDeEUsT0FBT0QsTUFBTSxDQUFDakQsT0FBTyxDQUFFLE1BQU0sRUFBRThDLElBQUssQ0FBQyxDQUFDOUMsT0FBTyxDQUFFLE1BQU0sRUFBRStDLEVBQUcsQ0FBQyxDQUFDL0MsT0FBTyxDQUFFLE1BQU0sRUFBRWdELEtBQU0sQ0FBQztFQUNyRjtFQUNBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNHLHFCQUFxQkEsQ0FBRUMsZ0JBQWdCLEVBQUc7SUFDbEQsSUFBSXBQLFNBQVMsR0FBR2IsTUFBTSxDQUFFaVEsZ0JBQWdCLElBQUlBLGdCQUFnQixDQUFDbFAsY0FBYyxHQUFHa1AsZ0JBQWdCLENBQUNsUCxjQUFjLEdBQUdsQixLQUFLLENBQUNnQixTQUFVLENBQUM7SUFDakksSUFBSyxDQUFFdUcsUUFBUSxDQUFFdkcsU0FBVSxDQUFDLElBQUlBLFNBQVMsR0FBRyxDQUFDLEVBQUc7TUFBRTtJQUFRO0lBQzFEaEIsS0FBSyxDQUFDZ0IsU0FBUyxHQUFHQSxTQUFTO0lBQzNCbkIsQ0FBQyxDQUFFLDJFQUE0RSxDQUFDLENBQUNxSCxHQUFHLENBQUU1RyxNQUFNLENBQUVVLFNBQVUsQ0FBRSxDQUFDO0VBQzVHO0VBQ0E7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU3FQLHFCQUFxQkEsQ0FBRUMsT0FBTyxFQUFHO0lBQ3pDdFEsS0FBSyxDQUFDcUIsT0FBTyxHQUFHZixNQUFNLENBQUVnUSxPQUFPLElBQUlBLE9BQU8sQ0FBQ2pQLE9BQU8sR0FBR2lQLE9BQU8sQ0FBQ2pQLE9BQU8sR0FBR3JCLEtBQUssQ0FBQ3FCLE9BQVEsQ0FBQztJQUN0RnJCLEtBQUssQ0FBQ3NCLFVBQVUsR0FBRyxNQUFNLEtBQUtoQixNQUFNLENBQUVnUSxPQUFPLElBQUlBLE9BQU8sQ0FBQ2hQLFVBQVUsR0FBR2dQLE9BQU8sQ0FBQ2hQLFVBQVUsR0FBR3RCLEtBQUssQ0FBQ3NCLFVBQVcsQ0FBQyxHQUFHLE1BQU0sR0FBRyxLQUFLO0lBRTlIekIsQ0FBQyxDQUFFLHlEQUEwRCxDQUFDLENBQUNnSSxJQUFJLENBQUUsWUFBWTtNQUNoRixJQUFJMEksVUFBVSxHQUFHMVEsQ0FBQyxDQUFFLElBQUssQ0FBQztNQUMxQixJQUFJMlEsU0FBUyxHQUFHbFEsTUFBTSxDQUFFaVEsVUFBVSxDQUFDM08sSUFBSSxDQUFFLHVCQUF3QixDQUFDLElBQUksRUFBRyxDQUFDLEtBQUs1QixLQUFLLENBQUNxQixPQUFPO01BQzVGLElBQUlvUCxVQUFVLEdBQUdGLFVBQVUsQ0FBQ3pNLElBQUksQ0FBRSw2QkFBOEIsQ0FBQztNQUVqRXlNLFVBQVUsQ0FBQ2xOLFdBQVcsQ0FBRSxXQUFXLEVBQUVtTixTQUFVLENBQUM7TUFDaERDLFVBQVUsQ0FBQ3JMLFdBQVcsQ0FBRSw0REFBNkQsQ0FBQyxDQUNwRkQsUUFBUSxDQUFFcUwsU0FBUyxHQUFLLE1BQU0sS0FBS3hRLEtBQUssQ0FBQ3NCLFVBQVUsR0FBRyxvQkFBb0IsR0FBRyxrQkFBa0IsR0FBSyx3QkFBeUIsQ0FBQztJQUNqSSxDQUFFLENBQUM7SUFDSHpCLENBQUMsQ0FBRSxzQ0FBdUMsQ0FBQyxDQUFDZ0ksSUFBSSxDQUFFLFlBQVk7TUFDN0QsSUFBSTZJLE9BQU8sR0FBRzdRLENBQUMsQ0FBRSxJQUFLLENBQUM7TUFDdkIsSUFBSyxDQUFFNlEsT0FBTyxDQUFDNU0sSUFBSSxDQUFFLDZCQUE4QixDQUFDLENBQUN2QixNQUFNLEVBQUc7UUFDN0Q7TUFDRDtNQUNBLElBQUlvTyxlQUFlLEdBQUdELE9BQU8sQ0FBQzVNLElBQUksQ0FBRSx1Q0FBd0MsQ0FBQyxDQUFDdkIsTUFBTSxHQUFHLENBQUM7TUFDeEZtTyxPQUFPLENBQUNwTixJQUFJLENBQUUsV0FBVyxFQUFFcU4sZUFBZSxHQUFLLE1BQU0sS0FBSzNRLEtBQUssQ0FBQ3NCLFVBQVUsR0FBRyxZQUFZLEdBQUcsV0FBVyxHQUFLLE1BQU8sQ0FBQztJQUNySCxDQUFFLENBQUM7RUFDSjtFQUNBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNzUCx3QkFBd0JBLENBQUVDLFVBQVUsRUFBRztJQUMvQyxJQUFJelAsV0FBVyxHQUFHb0csSUFBSSxDQUFDRyxHQUFHLENBQUUsQ0FBQyxFQUFFeEgsTUFBTSxDQUFFMFEsVUFBVSxJQUFJQSxVQUFVLENBQUN6UCxXQUFXLEdBQUd5UCxVQUFVLENBQUN6UCxXQUFXLEdBQUcsQ0FBRSxDQUFFLENBQUM7SUFDNUcsSUFBSTBQLFlBQVksR0FBR3RKLElBQUksQ0FBQ0csR0FBRyxDQUFFLENBQUMsRUFBRXZHLFdBQVksQ0FBQztJQUM3QyxJQUFJMlAsYUFBYSxHQUFHbFIsQ0FBQyxDQUFFLHdFQUF5RSxDQUFDO0lBQ2pHa1IsYUFBYSxDQUFDek4sSUFBSSxDQUFFLEtBQUssRUFBRXdOLFlBQWEsQ0FBQyxDQUFDNUosR0FBRyxDQUFFbEgsS0FBSyxDQUFDZSxJQUFLLENBQUMsQ0FBQ2lELElBQUksQ0FBRSxVQUFVLEVBQUU1QyxXQUFXLElBQUksQ0FBRSxDQUFDO0lBQ2hHdkIsQ0FBQyxDQUFFLCtEQUFnRSxDQUFDLENBQUMySyxJQUFJLENBQUVwSixXQUFZLENBQUM7RUFDekY7RUFDQTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTNFAscUJBQXFCQSxDQUFFRCxhQUFhLEVBQUc7SUFDL0MsSUFBSUUsY0FBYyxHQUFHOVEsTUFBTSxDQUFFNFEsYUFBYSxDQUFDN0osR0FBRyxDQUFDLENBQUUsQ0FBQztJQUNsRCtKLGNBQWMsR0FBR3pKLElBQUksQ0FBQ0UsR0FBRyxDQUFFRixJQUFJLENBQUNHLEdBQUcsQ0FBRSxDQUFDLEVBQUVKLFFBQVEsQ0FBRTBKLGNBQWUsQ0FBQyxHQUFHQSxjQUFjLEdBQUdqUixLQUFLLENBQUNlLElBQUssQ0FBQyxFQUFFeUcsSUFBSSxDQUFDRyxHQUFHLENBQUUsQ0FBQyxFQUFFM0gsS0FBSyxDQUFDb0IsV0FBWSxDQUFFLENBQUM7SUFDdEkyUCxhQUFhLENBQUM3SixHQUFHLENBQUUrSixjQUFlLENBQUM7SUFDbkMsSUFBS0EsY0FBYyxLQUFLalIsS0FBSyxDQUFDZSxJQUFJLEVBQUc7TUFBRTtJQUFRO0lBQy9DZixLQUFLLENBQUNlLElBQUksR0FBR2tRLGNBQWM7SUFDM0JDLFFBQVEsQ0FBQyxDQUFDO0VBQ1g7RUFDQTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNDLFVBQVVBLENBQUV4USxRQUFRLEVBQUVrUSxVQUFVLEVBQUc7SUFDM0MsSUFBSU8sS0FBSyxHQUFHdlIsQ0FBQyxDQUFFLGtDQUFtQyxDQUFDO0lBQ25ELElBQUl3UixNQUFNLEdBQUd4UixDQUFDLENBQUUseUNBQTBDLENBQUM7SUFDM0QsSUFBSXlSLFVBQVU7SUFDZCxJQUFJQyxRQUFRO0lBQ1osSUFBSUMsVUFBVTtJQUNkckQsa0NBQWtDLENBQUMsQ0FBQztJQUNwQ2tELE1BQU0sQ0FBQzFHLEtBQUssQ0FBQyxDQUFDO0lBQ2RrRyxVQUFVLEdBQUdBLFVBQVUsSUFBSSxDQUFDLENBQUM7SUFDN0I3USxLQUFLLENBQUNXLFFBQVEsR0FBR0EsUUFBUSxJQUFJLEVBQUU7SUFDL0JYLEtBQUssQ0FBQ2UsSUFBSSxHQUFHeUcsSUFBSSxDQUFDRyxHQUFHLENBQUUsQ0FBQyxFQUFFeEgsTUFBTSxDQUFFMFEsVUFBVSxDQUFDWSxXQUFXLElBQUl6UixLQUFLLENBQUNlLElBQUksSUFBSSxDQUFFLENBQUUsQ0FBQztJQUMvRWYsS0FBSyxDQUFDbUIsV0FBVyxHQUFHcUcsSUFBSSxDQUFDRyxHQUFHLENBQUUsQ0FBQyxFQUFFeEgsTUFBTSxDQUFFMFEsVUFBVSxDQUFDMVAsV0FBVyxJQUFJLENBQUUsQ0FBRSxDQUFDO0lBQ3hFbkIsS0FBSyxDQUFDb0IsV0FBVyxHQUFHb0csSUFBSSxDQUFDRyxHQUFHLENBQUUsQ0FBQyxFQUFFeEgsTUFBTSxDQUFFMFEsVUFBVSxDQUFDelAsV0FBVyxJQUFJLENBQUUsQ0FBRSxDQUFDO0lBQ3hFd1Asd0JBQXdCLENBQUVDLFVBQVcsQ0FBQztJQUN0Q2hSLENBQUMsQ0FBRSxtQ0FBb0MsQ0FBQyxDQUFDbUUsSUFBSSxDQUFFLFFBQVEsRUFBRSxJQUFLLENBQUM7SUFDL0QsSUFBSyxDQUFFaEUsS0FBSyxDQUFDVyxRQUFRLENBQUM0QixNQUFNLEVBQUc7TUFBRTZILFdBQVcsQ0FBRSxFQUFFLEVBQUUsS0FBTSxDQUFDO01BQUU7SUFBUTtJQUNuRWtILFVBQVUsR0FBRzlKLElBQUksQ0FBQ0csR0FBRyxDQUFFLENBQUMsRUFBRXhILE1BQU0sQ0FBRTBRLFVBQVUsQ0FBQ1MsVUFBVSxJQUFNLENBQUV0UixLQUFLLENBQUNlLElBQUksR0FBRyxDQUFDLElBQUtmLEtBQUssQ0FBQ2dCLFNBQVMsR0FBSyxDQUFFLENBQUUsQ0FBQztJQUMzR3VRLFFBQVEsR0FBRy9KLElBQUksQ0FBQ0csR0FBRyxDQUFFMkosVUFBVSxFQUFFblIsTUFBTSxDQUFFMFEsVUFBVSxDQUFDVSxRQUFRLElBQU1ELFVBQVUsR0FBR3RSLEtBQUssQ0FBQ1csUUFBUSxDQUFDNEIsTUFBTSxHQUFHLENBQUksQ0FBRSxDQUFDO0lBQzlHaVAsVUFBVSxHQUFHeFIsS0FBSyxDQUFDVyxRQUFRO0lBQzNCeVEsS0FBSyxDQUFDcE4sSUFBSSxDQUFFLFFBQVEsRUFBRSxLQUFNLENBQUM7SUFFN0JuRSxDQUFDLENBQUNnSSxJQUFJLENBQUUySixVQUFVLEVBQUUsVUFBV3pHLEtBQUssRUFBRXpCLE9BQU8sRUFBRztNQUMvQyxJQUFJMkIsRUFBRSxHQUFHOUssTUFBTSxDQUFFbUosT0FBTyxDQUFDWCxVQUFVLElBQUksQ0FBRSxDQUFDO01BQzFDLElBQUlDLEtBQUssR0FBR1UsT0FBTyxDQUFDVixLQUFLLElBQUk5SSxNQUFNLENBQUNpSyxJQUFJLENBQUMwRCxRQUFRLElBQUksa0JBQWtCO01BQ3ZFLElBQUk1RSxXQUFXLEdBQUd2SSxNQUFNLENBQUVnSixPQUFPLENBQUNULFdBQVcsSUFBSSxHQUFHLEdBQUdvQyxFQUFHLENBQUM7TUFDM0QsSUFBSXZLLE1BQU0sR0FBR0osTUFBTSxDQUFFZ0osT0FBTyxDQUFDNUksTUFBTSxJQUFJLFFBQVMsQ0FBQztNQUNqRCxJQUFJZ1IsSUFBSSxHQUFHN1IsQ0FBQyxDQUFFLE1BQU0sRUFBRTtRQUFFLE9BQU8sRUFBRSxpQ0FBaUM7UUFBRSxpQkFBaUIsRUFBRW9MLEVBQUU7UUFBRWdELFFBQVEsRUFBRSxHQUFHO1FBQUUsY0FBYyxFQUFFaEQsRUFBRSxLQUFLakwsS0FBSyxDQUFDRSxVQUFVLEdBQUcsTUFBTSxHQUFHO01BQVEsQ0FBRSxDQUFDO01BQ3hLLElBQUl5UixZQUFZLEdBQUc5UixDQUFDLENBQUUsTUFBTSxFQUFFO1FBQUUsT0FBTyxFQUFFLGdCQUFnQjtRQUFFLFlBQVksRUFBRUMsTUFBTSxDQUFDaUssSUFBSSxDQUFDNkgsY0FBYyxJQUFJO01BQVUsQ0FBRSxDQUFDLENBQUN4RSxRQUFRLENBQUVzRSxJQUFLLENBQUM7TUFDcklBLElBQUksQ0FBQ3JPLFdBQVcsQ0FBRSxhQUFhLEVBQUU0SCxFQUFFLEtBQUtqTCxLQUFLLENBQUNFLFVBQVcsQ0FBQztNQUMxRCxJQUFJMlIsZ0JBQWdCLEdBQUdoUyxDQUFDLENBQUUsT0FBTyxFQUFFO1FBQUUsT0FBTyxFQUFFO01BQThDLENBQUUsQ0FBQyxDQUFDdU4sUUFBUSxDQUFFdUUsWUFBYSxDQUFDO01BQ3hILElBQUlHLFlBQVksR0FBR2pTLENBQUMsQ0FBRSxRQUFRLEVBQUU7UUFBRSxPQUFPLEVBQUU7TUFBMEMsQ0FBRSxDQUFDLENBQUN1TixRQUFRLENBQUV5RSxnQkFBaUIsQ0FBQztNQUNySHRFLG9CQUFvQixDQUFFakUsT0FBUSxDQUFDLENBQUN5SSxTQUFTLENBQUVGLGdCQUFpQixDQUFDO01BQzdEaFMsQ0FBQyxDQUFFLFVBQVUsRUFBRTtRQUFFMkssSUFBSSxFQUFFNUI7TUFBTSxDQUFFLENBQUMsQ0FBQ3dFLFFBQVEsQ0FBRTBFLFlBQWEsQ0FBQztNQUN6RGpTLENBQUMsQ0FBRSxRQUFRLEVBQUU7UUFBRTJLLElBQUksRUFBRTNCO01BQVksQ0FBRSxDQUFDLENBQUN1RSxRQUFRLENBQUUwRSxZQUFhLENBQUM7TUFDN0RqUyxDQUFDLENBQUUsTUFBTSxFQUFFO1FBQUUsT0FBTyxFQUFFLGlCQUFpQjtRQUFFLFlBQVksRUFBRUMsTUFBTSxDQUFDaUssSUFBSSxDQUFDaUksZUFBZSxJQUFJO01BQVcsQ0FBRSxDQUFDLENBQUMzRSxNQUFNLENBQUVzQixxQkFBcUIsQ0FBRXJGLE9BQVEsQ0FBRSxDQUFDLENBQUM4RCxRQUFRLENBQUVzRSxJQUFLLENBQUM7TUFDaEssSUFBSzVSLE1BQU0sQ0FBQ21TLGlCQUFpQixFQUFHO1FBQy9CcFMsQ0FBQyxDQUFFLE1BQU0sRUFBRTtVQUFFLE9BQU8sRUFBRSxjQUFjO1VBQUUsWUFBWSxFQUFFQyxNQUFNLENBQUNpSyxJQUFJLENBQUNtSSxZQUFZLElBQUksT0FBTztVQUFFMUgsSUFBSSxFQUFFaUIsVUFBVSxDQUFFbkMsT0FBTyxDQUFDSixTQUFVO1FBQUUsQ0FBRSxDQUFDLENBQUNrRSxRQUFRLENBQUVzRSxJQUFLLENBQUM7TUFDcEo7TUFDQTdSLENBQUMsQ0FBRSxNQUFNLEVBQUU7UUFBRSxPQUFPLEVBQUUsa0JBQWtCO1FBQUUsWUFBWSxFQUFFQyxNQUFNLENBQUNpSyxJQUFJLENBQUNvSSxnQkFBZ0IsSUFBSTtNQUFZLENBQUUsQ0FBQyxDQUFDOUUsTUFBTSxDQUFFdEIsYUFBYSxDQUFFekMsT0FBUSxDQUFFLENBQUMsQ0FBQzhELFFBQVEsQ0FBRXNFLElBQUssQ0FBQztNQUMzSixJQUFJVSxpQkFBaUIsR0FBR3ZTLENBQUMsQ0FBRSxNQUFNLEVBQUU7UUFBRSxPQUFPLEVBQUUsaUJBQWlCO1FBQUUsWUFBWSxFQUFFQyxNQUFNLENBQUNpSyxJQUFJLENBQUNzSSwwQkFBMEIsSUFBSTtNQUFzQixDQUFFLENBQUMsQ0FBQ2pGLFFBQVEsQ0FBRXNFLElBQUssQ0FBQztNQUNuSyxJQUFJWSxpQkFBaUIsR0FBR3pTLENBQUMsQ0FBRSxPQUFPLEVBQUU7UUFBRSxPQUFPLEVBQUU7TUFBK0MsQ0FBRSxDQUFDLENBQUN1TixRQUFRLENBQUVnRixpQkFBa0IsQ0FBQztNQUMvSCxJQUFJRyxxQkFBcUIsR0FBRyxLQUFLO01BQ2pDMVMsQ0FBQyxDQUFDZ0ksSUFBSSxDQUFFckcsV0FBVyxFQUFFLFVBQVdnUixRQUFRLEVBQUVyRCxHQUFHLEVBQUc7UUFDL0MsSUFBSUMsbUJBQW1CLEdBQUdGLHNCQUFzQixDQUFFNUYsT0FBTyxFQUFFNkYsR0FBSSxDQUFDO1FBQ2hFLElBQUlzRCxTQUFTLEdBQUdyRCxtQkFBbUIsQ0FBQzdNLE1BQU0sR0FBRyxDQUFDO1FBQzlDLElBQUtrUSxTQUFTLEVBQUc7VUFBRUYscUJBQXFCLEdBQUcsSUFBSTtRQUFFO1FBQ2pELElBQUlHLFFBQVEsR0FBRzVTLE1BQU0sQ0FBQ3VQLFFBQVEsSUFBSXZQLE1BQU0sQ0FBQ3VQLFFBQVEsQ0FBRW1ELFFBQVEsQ0FBRSxHQUFHMVMsTUFBTSxDQUFDdVAsUUFBUSxDQUFFbUQsUUFBUSxDQUFFLEdBQUdyRCxHQUFHO1FBQ2pHLElBQUl3RCxlQUFlLEdBQUc5UyxDQUFDLENBQUNvTSxHQUFHLENBQUVtRCxtQkFBbUIsRUFBRSxVQUFXcEUsUUFBUSxFQUFHO1VBQUUsT0FBT0EsUUFBUSxDQUFDcEMsS0FBSyxJQUFJLEVBQUU7UUFBRSxDQUFFLENBQUMsQ0FBQ2dLLE1BQU0sQ0FBRSxVQUFXaEssS0FBSyxFQUFHO1VBQUUsT0FBTyxDQUFDLENBQUVBLEtBQUs7UUFBRSxDQUFFLENBQUM7UUFDNUosSUFBSWlLLGtCQUFrQixHQUFHSixTQUFTLEdBQy9CblMsTUFBTSxDQUFFUixNQUFNLENBQUNpSyxJQUFJLENBQUNxRixtQkFBbUIsSUFBSSx5QkFBMEIsQ0FBQyxDQUFDcEMsT0FBTyxDQUFFLElBQUksRUFBRTJGLGVBQWUsQ0FBQ0csSUFBSSxDQUFFLElBQUssQ0FBRSxDQUFDLEdBQ2xIaFQsTUFBTSxDQUFDaUssSUFBSSxDQUFDZ0osc0JBQXNCLElBQUkscUNBQXVDO1FBQ2xGbFQsQ0FBQyxDQUFFLFFBQVEsRUFBRTtVQUFFLE9BQU8sRUFBRSx5Q0FBeUMsSUFBSzRTLFNBQVMsR0FBRyxlQUFlLEdBQUcsRUFBRSxDQUFFO1VBQUU3SixLQUFLLEVBQUU4SixRQUFRLEdBQUcsSUFBSSxHQUFHRyxrQkFBa0I7VUFBRSxZQUFZLEVBQUVILFFBQVEsR0FBRyxJQUFJLEdBQUdHO1FBQW1CLENBQUUsQ0FBQyxDQUFDekYsUUFBUSxDQUFFa0YsaUJBQWtCLENBQUM7TUFDNU8sQ0FBRSxDQUFDO01BQ0hGLGlCQUFpQixDQUFDL0UsTUFBTSxDQUFFa0MsdUJBQXVCLENBQUVqRyxPQUFRLENBQUUsQ0FBQztNQUM5RCxJQUFLQSxPQUFPLENBQUNGLFlBQVksSUFBSUUsT0FBTyxDQUFDRixZQUFZLENBQUM3RyxNQUFNLElBQUksQ0FBRWdRLHFCQUFxQixFQUFHO1FBQ3JGMVMsQ0FBQyxDQUFFLFFBQVEsRUFBRTtVQUFFLE9BQU8sRUFBRSwrQ0FBK0M7VUFBRTJLLElBQUksRUFBRTFLLE1BQU0sQ0FBQ2lLLElBQUksQ0FBQzhDLGVBQWUsSUFBSTtRQUF5QixDQUFFLENBQUMsQ0FBQ08sUUFBUSxDQUFFZ0YsaUJBQWtCLENBQUM7TUFDeks7TUFDQSxJQUFJWSxZQUFZLEdBQUduVCxDQUFDLENBQUUsTUFBTSxFQUFFO1FBQUUsT0FBTyxFQUFFLGVBQWU7UUFBRSxZQUFZLEVBQUVDLE1BQU0sQ0FBQ2lLLElBQUksQ0FBQ2tKLGFBQWEsSUFBSTtNQUFTLENBQUUsQ0FBQyxDQUFDN0YsUUFBUSxDQUFFc0UsSUFBSyxDQUFDO01BQ2xJLElBQUl3QixnQkFBZ0IsR0FBR3JULENBQUMsQ0FBRSxPQUFPLEVBQUU7UUFBRSxPQUFPLEVBQUU7TUFBNkMsQ0FBRSxDQUFDLENBQUN1TixRQUFRLENBQUU0RixZQUFhLENBQUM7TUFDdkhuVCxDQUFDLENBQUUsUUFBUSxFQUFFO1FBQUUsT0FBTyxFQUFFLDJDQUEyQyxHQUFHYSxNQUFNO1FBQUU4SixJQUFJLEVBQUVtRixXQUFXLENBQUVqUCxNQUFPO01BQUUsQ0FBRSxDQUFDLENBQUMwTSxRQUFRLENBQUU4RixnQkFBaUIsQ0FBQztNQUMxSXJULENBQUMsQ0FBRSxRQUFRLEVBQUU7UUFBRSxPQUFPLEVBQUUsK0JBQStCO1FBQUUySyxJQUFJLEVBQUUsQ0FBRTFLLE1BQU0sQ0FBQ2lLLElBQUksQ0FBQ29KLFNBQVMsSUFBSSxJQUFJLElBQUssSUFBSSxHQUFHbEk7TUFBRyxDQUFFLENBQUMsQ0FBQ21DLFFBQVEsQ0FBRThGLGdCQUFpQixDQUFDO01BQzdJLElBQUlFLFFBQVEsR0FBR3ZULENBQUMsQ0FBRSxNQUFNLEVBQUU7UUFBRSxPQUFPLEVBQUUsZ0JBQWdCO1FBQUUsWUFBWSxFQUFFQyxNQUFNLENBQUNpSyxJQUFJLENBQUNzSixjQUFjLElBQUk7TUFBVSxDQUFFLENBQUMsQ0FBQ2pHLFFBQVEsQ0FBRXNFLElBQUssQ0FBQztNQUNqSTdSLENBQUMsQ0FBRSxVQUFVLEVBQUU7UUFBRWtDLElBQUksRUFBRSxRQUFRO1FBQUUsT0FBTyxFQUFFLCtEQUErRDtRQUFFLGlCQUFpQixFQUFFa0osRUFBRTtRQUFFckMsS0FBSyxFQUFFOUksTUFBTSxDQUFDaUssSUFBSSxDQUFDdUosSUFBSSxJQUFJLGNBQWM7UUFBRSxZQUFZLEVBQUV4VCxNQUFNLENBQUNpSyxJQUFJLENBQUN1SixJQUFJLElBQUk7TUFBZSxDQUFFLENBQUMsQ0FBQ2xHLFFBQVEsQ0FBRWdHLFFBQVMsQ0FBQztNQUN0UCxJQUFLLFVBQVUsS0FBSzFTLE1BQU0sRUFBRztRQUFFYixDQUFDLENBQUUsVUFBVSxFQUFFO1VBQUVrQyxJQUFJLEVBQUUsUUFBUTtVQUFFLE9BQU8sRUFBRSxrR0FBa0c7VUFBRSxpQkFBaUIsRUFBRWtKLEVBQUU7VUFBRXJDLEtBQUssRUFBRTlJLE1BQU0sQ0FBQ2lLLElBQUksQ0FBQ3dKLE9BQU8sSUFBSSxpQkFBaUI7VUFBRSxZQUFZLEVBQUV6VCxNQUFNLENBQUNpSyxJQUFJLENBQUN3SixPQUFPLElBQUk7UUFBa0IsQ0FBRSxDQUFDLENBQUNuRyxRQUFRLENBQUVnRyxRQUFTLENBQUM7TUFBRTtNQUN0VS9CLE1BQU0sQ0FBQ2hFLE1BQU0sQ0FBRXFFLElBQUssQ0FBQztJQUN0QixDQUFFLENBQUM7SUFFSHBELGtDQUFrQyxDQUFDLENBQUM7SUFDcEN6TyxDQUFDLENBQUUseUNBQTBDLENBQUMsQ0FBQ21FLElBQUksQ0FBRSxRQUFRLEVBQUUsS0FBTSxDQUFDO0lBQ3RFbkUsQ0FBQyxDQUFFLDBDQUEyQyxDQUFDLENBQUMySyxJQUFJLENBQUVxRixXQUFXLENBQUV5QixVQUFVLEVBQUVDLFFBQVEsRUFBRXZSLEtBQUssQ0FBQ21CLFdBQVksQ0FBRSxDQUFDO0lBQzlHdEIsQ0FBQyxDQUFFLHVDQUF3QyxDQUFDLENBQUNtRSxJQUFJLENBQUUsVUFBVSxFQUFFaEUsS0FBSyxDQUFDZSxJQUFJLElBQUksQ0FBRSxDQUFDO0lBQ2hGbEIsQ0FBQyxDQUFFLHVDQUF3QyxDQUFDLENBQUNtRSxJQUFJLENBQUUsVUFBVSxFQUFFaEUsS0FBSyxDQUFDb0IsV0FBVyxHQUFHLENBQUMsSUFBSXBCLEtBQUssQ0FBQ2UsSUFBSSxJQUFJZixLQUFLLENBQUNvQixXQUFZLENBQUM7RUFDMUg7RUFDQTtFQUNBLFNBQVNvUyxPQUFPQSxDQUFFdEosU0FBUyxFQUFHO0lBQzdCLElBQUssQ0FBRUEsU0FBUyxJQUFJbEssS0FBSyxDQUFDUyxJQUFJLEVBQUc7TUFBRTtJQUFRO0lBQzNDLElBQUttRyxZQUFZLENBQUMsQ0FBQyxJQUFJNUcsS0FBSyxDQUFDRSxVQUFVLEtBQUtnSyxTQUFTLEVBQUc7TUFBRTdGLHdCQUF3QixDQUFDLENBQUM7TUFBRXlCLCtCQUErQixDQUFDLENBQUM7TUFBRTtJQUFRO0lBQ2pJLElBQUssQ0FBRStELGtCQUFrQixDQUFDLENBQUMsRUFBRztNQUFFO0lBQVE7SUFDeEN0QixPQUFPLENBQUUsSUFBSyxDQUFDO0lBQ2Y3RixPQUFPLENBQUU1QyxNQUFNLENBQUMyVCxPQUFPLENBQUNDLElBQUksRUFBRTtNQUFFL0ssVUFBVSxFQUFFdUI7SUFBVSxDQUFFLENBQUMsQ0FBQ3lKLElBQUksQ0FBRSxVQUFXalMsUUFBUSxFQUFHO01BQ3JGLElBQUtBLFFBQVEsSUFBSUEsUUFBUSxDQUFDa1MsT0FBTyxJQUFJbFMsUUFBUSxDQUFDRSxJQUFJLElBQUlGLFFBQVEsQ0FBQ0UsSUFBSSxDQUFDMEgsT0FBTyxFQUFHO1FBQUVELFVBQVUsQ0FBRTNILFFBQVEsQ0FBQ0UsSUFBSSxDQUFDMEgsT0FBUSxDQUFDO1FBQUVXLFNBQVMsQ0FBRWpLLEtBQUssQ0FBQ0UsVUFBVyxDQUFDO1FBQUVtRSx3QkFBd0IsQ0FBQyxDQUFDO1FBQUV5QiwrQkFBK0IsQ0FBQyxDQUFDO1FBQUU7TUFBUTtNQUMzTmhFLE1BQU0sQ0FBRUwsV0FBVyxDQUFFQyxRQUFRLEVBQUU1QixNQUFNLENBQUNpSyxJQUFJLENBQUM4SixXQUFZLENBQUMsRUFBRSxPQUFRLENBQUM7SUFDcEUsQ0FBRSxDQUFDLENBQUNDLElBQUksQ0FBRSxVQUFXQyxHQUFHLEVBQUc7TUFBRWpTLE1BQU0sQ0FBRUwsV0FBVyxDQUFFc1MsR0FBRyxDQUFDQyxZQUFZLEVBQUVsVSxNQUFNLENBQUNpSyxJQUFJLENBQUM4SixXQUFZLENBQUMsRUFBRSxPQUFRLENBQUM7SUFBRSxDQUFFLENBQUMsQ0FBQzNRLE1BQU0sQ0FBRSxZQUFZO01BQUVxRixPQUFPLENBQUUsS0FBTSxDQUFDO0lBQUUsQ0FBRSxDQUFDO0VBQzFKO0VBQ0E7RUFDQSxTQUFTMkksUUFBUUEsQ0FBRStDLG1CQUFtQixFQUFHO0lBQ3hDLElBQUlDLFlBQVksR0FBRztNQUNsQkMsTUFBTSxFQUFFdFUsQ0FBQyxDQUFFLHNCQUF1QixDQUFDLENBQUNxSCxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUU7TUFDL0N4RyxNQUFNLEVBQUVWLEtBQUssQ0FBQ1UsTUFBTTtNQUNwQjBULFdBQVcsRUFBRXZVLENBQUMsQ0FBRSwrQkFBZ0MsQ0FBQyxDQUFDcUgsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDO01BQzVEdUssV0FBVyxFQUFFelIsS0FBSyxDQUFDZSxJQUFJO01BQ3ZCRyxjQUFjLEVBQUVsQixLQUFLLENBQUNnQixTQUFTO01BQy9CSyxPQUFPLEVBQUVyQixLQUFLLENBQUNxQixPQUFPO01BQ3RCQyxVQUFVLEVBQUV0QixLQUFLLENBQUNzQjtJQUNuQixDQUFDO0lBQ0QsSUFBSzJTLG1CQUFtQixFQUFHO01BQUVDLFlBQVksQ0FBQ0QsbUJBQW1CLEdBQUcsQ0FBQztJQUFFO0lBQ25FOVEsVUFBVSxDQUFFLElBQUssQ0FBQztJQUNsQlQsT0FBTyxDQUFFNUMsTUFBTSxDQUFDMlQsT0FBTyxDQUFDWSxJQUFJLEVBQUVILFlBQWEsQ0FBQyxDQUFDUCxJQUFJLENBQUUsVUFBV2pTLFFBQVEsRUFBRztNQUN4RSxJQUFLLENBQUVBLFFBQVEsSUFBSSxDQUFFQSxRQUFRLENBQUNrUyxPQUFPLElBQUksQ0FBRWxTLFFBQVEsQ0FBQ0UsSUFBSSxFQUFHO1FBQUV3SSxXQUFXLENBQUUzSSxXQUFXLENBQUVDLFFBQVEsRUFBRTVCLE1BQU0sQ0FBQ2lLLElBQUksQ0FBQzhKLFdBQVksQ0FBQyxFQUFFLEtBQU0sQ0FBQztRQUFFO01BQVE7TUFDN0k3VCxLQUFLLENBQUNDLFlBQVksR0FBRyxDQUFDLENBQUV5QixRQUFRLENBQUNFLElBQUksQ0FBQzBTLGFBQWE7TUFDbkQsSUFBSyxDQUFFdFUsS0FBSyxDQUFDQyxZQUFZLEVBQUc7UUFBRUosQ0FBQyxDQUFFLHlDQUEwQyxDQUFDLENBQUM4SyxLQUFLLENBQUMsQ0FBQztRQUFFbkMsZ0JBQWdCLENBQUUsS0FBTSxDQUFDO1FBQUU0QixXQUFXLENBQUUxSSxRQUFRLENBQUNFLElBQUksQ0FBQ0MsT0FBTyxJQUFJL0IsTUFBTSxDQUFDaUssSUFBSSxDQUFDVSxhQUFhLEVBQUUsSUFBSyxDQUFDO1FBQUU7TUFBUTtNQUNsTTBGLHFCQUFxQixDQUFFek8sUUFBUSxDQUFDRSxJQUFJLENBQUNYLE9BQU8sSUFBSW5CLE1BQU0sQ0FBQ21CLE9BQU8sSUFBSSxDQUFDLENBQUUsQ0FBQztNQUN0RW9QLHFCQUFxQixDQUFFM08sUUFBUSxDQUFDRSxJQUFJLENBQUMwTyxPQUFPLElBQUksQ0FBQyxDQUFFLENBQUM7TUFDcER4RixjQUFjLENBQUVwSixRQUFRLENBQUNFLElBQUksQ0FBQ2hCLFNBQVMsSUFBSSxFQUFHLENBQUM7TUFDL0NzSyxhQUFhLENBQUV4SixRQUFRLENBQUNFLElBQUksQ0FBQ3VKLE1BQU0sRUFBRXpKLFFBQVEsQ0FBQ0UsSUFBSSxDQUFDMlMsY0FBZSxDQUFDO01BQ25FcEQsVUFBVSxDQUFFelAsUUFBUSxDQUFDRSxJQUFJLENBQUNqQixRQUFRLElBQUksRUFBRSxFQUFFZSxRQUFRLENBQUNFLElBQUksQ0FBQ2lQLFVBQVUsSUFBSSxDQUFDLENBQUUsQ0FBQztNQUMxRTVNLGNBQWMsQ0FBQyxDQUFDO01BQ2hCLElBQUtqRSxLQUFLLENBQUNFLFVBQVUsRUFBRztRQUFFc1QsT0FBTyxDQUFFeFQsS0FBSyxDQUFDRSxVQUFXLENBQUM7TUFBRTtJQUN4RCxDQUFFLENBQUMsQ0FBQzRULElBQUksQ0FBRSxVQUFXQyxHQUFHLEVBQUc7TUFDMUIvVCxLQUFLLENBQUNDLFlBQVksR0FBRyxLQUFLO01BQzFCdUksZ0JBQWdCLENBQUUsS0FBTSxDQUFDO01BQ3pCNEIsV0FBVyxDQUFFM0ksV0FBVyxDQUFFc1MsR0FBRyxDQUFDQyxZQUFZLEVBQUVsVSxNQUFNLENBQUNpSyxJQUFJLENBQUM4SixXQUFZLENBQUMsRUFBRSxLQUFNLENBQUM7SUFDL0UsQ0FBRSxDQUFDLENBQUMzUSxNQUFNLENBQUUsWUFBWTtNQUFFQyxVQUFVLENBQUUsS0FBTSxDQUFDO0lBQUUsQ0FBRSxDQUFDO0VBQ25EO0VBQ0E7RUFDQSxTQUFTcVIsY0FBY0EsQ0FBRXRLLFNBQVMsRUFBRztJQUNwQyxJQUFLLENBQUVBLFNBQVMsSUFBSWxLLEtBQUssQ0FBQ1MsSUFBSSxJQUFJLENBQUViLENBQUMsQ0FBQ2tLLE9BQU8sQ0FBRWhLLE1BQU0sQ0FBQ2lLLElBQUksQ0FBQzBLLGVBQWUsSUFBSSx1QkFBd0IsQ0FBQyxFQUFHO01BQUU7SUFBUTtJQUNwSGxNLE9BQU8sQ0FBRSxJQUFLLENBQUM7SUFDZjdGLE9BQU8sQ0FBRTVDLE1BQU0sQ0FBQzJULE9BQU8sQ0FBQ0YsT0FBTyxFQUFFO01BQUU1SyxVQUFVLEVBQUV1QjtJQUFVLENBQUUsQ0FBQyxDQUFDeUosSUFBSSxDQUFFLFVBQVdqUyxRQUFRLEVBQUc7TUFDeEYsSUFBS0EsUUFBUSxJQUFJQSxRQUFRLENBQUNrUyxPQUFPLEVBQUc7UUFDbkMsSUFBSzVULEtBQUssQ0FBQ0UsVUFBVSxLQUFLZ0ssU0FBUyxFQUFHO1VBQUVsSyxLQUFLLENBQUNFLFVBQVUsR0FBRyxDQUFDO1VBQUVzSSxnQkFBZ0IsQ0FBRSxLQUFNLENBQUM7VUFBRXlCLFNBQVMsQ0FBRSxDQUFFLENBQUM7UUFBRTtRQUN6R25JLE1BQU0sQ0FBRUosUUFBUSxDQUFDRSxJQUFJLENBQUNDLE9BQU8sRUFBRSxTQUFVLENBQUM7UUFBRXFQLFFBQVEsQ0FBQyxDQUFDO1FBQUU7TUFDekQ7TUFDQXBQLE1BQU0sQ0FBRUwsV0FBVyxDQUFFQyxRQUFRLEVBQUU1QixNQUFNLENBQUNpSyxJQUFJLENBQUMySyxjQUFlLENBQUMsRUFBRSxPQUFRLENBQUM7SUFDdkUsQ0FBRSxDQUFDLENBQUNaLElBQUksQ0FBRSxVQUFXQyxHQUFHLEVBQUc7TUFBRWpTLE1BQU0sQ0FBRUwsV0FBVyxDQUFFc1MsR0FBRyxDQUFDQyxZQUFZLEVBQUVsVSxNQUFNLENBQUNpSyxJQUFJLENBQUMySyxjQUFlLENBQUMsRUFBRSxPQUFRLENBQUM7SUFBRSxDQUFFLENBQUMsQ0FBQ3hSLE1BQU0sQ0FBRSxZQUFZO01BQUVxRixPQUFPLENBQUUsS0FBTSxDQUFDO0lBQUUsQ0FBRSxDQUFDO0VBQzdKO0VBRUExSSxDQUFDLENBQUU4RCxRQUFTLENBQUMsQ0FBQ2dSLEVBQUUsQ0FBRSxPQUFPLEVBQUUsd0RBQXdELEVBQUUsVUFBV0MsS0FBSyxFQUFHO0lBQUVBLEtBQUssQ0FBQ0MsY0FBYyxDQUFDLENBQUM7SUFBRXRSLGdCQUFnQixDQUFFMUQsQ0FBQyxDQUFFLElBQUssQ0FBRSxDQUFDO0VBQUUsQ0FBRSxDQUFDO0VBQ3BLQSxDQUFDLENBQUU4RCxRQUFTLENBQUMsQ0FBQ2dSLEVBQUUsQ0FBRSxPQUFPLEVBQUUsbUZBQW1GLEVBQUUsVUFBV0MsS0FBSyxFQUFHO0lBQUVBLEtBQUssQ0FBQ0MsY0FBYyxDQUFDLENBQUM7SUFBRXRPLG9CQUFvQixDQUFFMUcsQ0FBQyxDQUFFLElBQUssQ0FBRSxDQUFDO0VBQUUsQ0FBRSxDQUFDO0VBQ25NQSxDQUFDLENBQUU4RCxRQUFTLENBQUMsQ0FBQ2dSLEVBQUUsQ0FBRSxPQUFPLEVBQUUsa0NBQWtDLEVBQUUsVUFBV0MsS0FBSyxFQUFHO0lBQUUsSUFBSyxDQUFFL1UsQ0FBQyxDQUFFK1UsS0FBSyxDQUFDRSxNQUFPLENBQUMsQ0FBQzFTLE9BQU8sQ0FBRSxXQUFZLENBQUMsQ0FBQ0csTUFBTSxFQUFHO01BQUVpUixPQUFPLENBQUVyVCxNQUFNLENBQUVOLENBQUMsQ0FBRSxJQUFLLENBQUMsQ0FBQytCLElBQUksQ0FBRSxZQUFhLENBQUMsSUFBSSxDQUFFLENBQUUsQ0FBQztJQUFFO0VBQUUsQ0FBRSxDQUFDO0VBQzlNL0IsQ0FBQyxDQUFFOEQsUUFBUyxDQUFDLENBQUNnUixFQUFFLENBQUUsU0FBUyxFQUFFLGtDQUFrQyxFQUFFLFVBQVdDLEtBQUssRUFBRztJQUFFLElBQUssQ0FBRS9VLENBQUMsQ0FBRStVLEtBQUssQ0FBQ0UsTUFBTyxDQUFDLENBQUMxUyxPQUFPLENBQUUsV0FBWSxDQUFDLENBQUNHLE1BQU0sS0FBTSxPQUFPLEtBQUtxUyxLQUFLLENBQUNyTCxHQUFHLElBQUksR0FBRyxLQUFLcUwsS0FBSyxDQUFDckwsR0FBRyxDQUFFLEVBQUc7TUFBRXFMLEtBQUssQ0FBQ0MsY0FBYyxDQUFDLENBQUM7TUFBRXJCLE9BQU8sQ0FBRXJULE1BQU0sQ0FBRU4sQ0FBQyxDQUFFLElBQUssQ0FBQyxDQUFDK0IsSUFBSSxDQUFFLFlBQWEsQ0FBQyxJQUFJLENBQUUsQ0FBRSxDQUFDO0lBQUU7RUFBRSxDQUFFLENBQUM7RUFDMVIvQixDQUFDLENBQUU4RCxRQUFTLENBQUMsQ0FBQ2dSLEVBQUUsQ0FBRSxPQUFPLEVBQUUsc0NBQXNDLEVBQUUsWUFBWTtJQUFFbkIsT0FBTyxDQUFFclQsTUFBTSxDQUFFTixDQUFDLENBQUUsSUFBSyxDQUFDLENBQUMrQixJQUFJLENBQUUsWUFBYSxDQUFDLElBQUksQ0FBRSxDQUFFLENBQUM7RUFBRSxDQUFFLENBQUM7RUFDOUkvQixDQUFDLENBQUU4RCxRQUFTLENBQUMsQ0FBQ2dSLEVBQUUsQ0FBRSxPQUFPLEVBQUUseUNBQXlDLEVBQUUsWUFBWTtJQUFFSCxjQUFjLENBQUVyVSxNQUFNLENBQUVOLENBQUMsQ0FBRSxJQUFLLENBQUMsQ0FBQytCLElBQUksQ0FBRSxZQUFhLENBQUMsSUFBSSxDQUFFLENBQUUsQ0FBQztFQUFFLENBQUUsQ0FBQztFQUN4Si9CLENBQUMsQ0FBRThELFFBQVMsQ0FBQyxDQUFDZ1IsRUFBRSxDQUFFLE9BQU8sRUFBRSwyQ0FBMkMsRUFBRSxZQUFZO0lBQ25GM1UsS0FBSyxDQUFDVSxNQUFNLEdBQUdKLE1BQU0sQ0FBRVQsQ0FBQyxDQUFFLElBQUssQ0FBQyxDQUFDK0IsSUFBSSxDQUFFLGdCQUFpQixDQUFDLElBQUksS0FBTSxDQUFDO0lBQ3BFNUIsS0FBSyxDQUFDZSxJQUFJLEdBQUcsQ0FBQztJQUNkbEIsQ0FBQyxDQUFFLDJDQUE0QyxDQUFDLENBQUN1RixXQUFXLENBQUUsV0FBWSxDQUFDLENBQUM5QixJQUFJLENBQUUsY0FBYyxFQUFFLE9BQVEsQ0FBQztJQUMzR3pELENBQUMsQ0FBRSxJQUFLLENBQUMsQ0FBQ3NGLFFBQVEsQ0FBRSxXQUFZLENBQUMsQ0FBQzdCLElBQUksQ0FBRSxjQUFjLEVBQUUsTUFBTyxDQUFDO0lBQ2hFNE4sUUFBUSxDQUFDLENBQUM7RUFDWCxDQUFFLENBQUM7RUFDSHJSLENBQUMsQ0FBRThELFFBQVMsQ0FBQyxDQUFDZ1IsRUFBRSxDQUFFLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxZQUFZO0lBQUUsSUFBSzNVLEtBQUssQ0FBQ2UsSUFBSSxHQUFHLENBQUMsRUFBRztNQUFFZixLQUFLLENBQUNlLElBQUksRUFBRTtNQUFFbVEsUUFBUSxDQUFDLENBQUM7SUFBRTtFQUFFLENBQUUsQ0FBQztFQUN6SXJSLENBQUMsQ0FBRThELFFBQVMsQ0FBQyxDQUFDZ1IsRUFBRSxDQUFFLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxZQUFZO0lBQUUsSUFBSzNVLEtBQUssQ0FBQ2UsSUFBSSxHQUFHZixLQUFLLENBQUNvQixXQUFXLEVBQUc7TUFBRXBCLEtBQUssQ0FBQ2UsSUFBSSxFQUFFO01BQUVtUSxRQUFRLENBQUMsQ0FBQztJQUFFO0VBQUUsQ0FBRSxDQUFDO0VBQ3pKclIsQ0FBQyxDQUFFOEQsUUFBUyxDQUFDLENBQUNnUixFQUFFLENBQUUsT0FBTyxFQUFFLHlEQUF5RCxFQUFFLFVBQVdDLEtBQUssRUFBRztJQUN4RyxJQUFJdlQsT0FBTyxHQUFHZixNQUFNLENBQUVULENBQUMsQ0FBRSxJQUFLLENBQUMsQ0FBQytCLElBQUksQ0FBRSx1QkFBd0IsQ0FBQyxJQUFJLEVBQUcsQ0FBQztJQUV2RWdULEtBQUssQ0FBQ0MsY0FBYyxDQUFDLENBQUM7SUFDdEIsSUFBSyxDQUFFeFQsT0FBTyxFQUFHO01BQUU7SUFBUTtJQUMzQnJCLEtBQUssQ0FBQ3NCLFVBQVUsR0FBR0QsT0FBTyxLQUFLckIsS0FBSyxDQUFDcUIsT0FBTyxJQUFJLEtBQUssS0FBS3JCLEtBQUssQ0FBQ3NCLFVBQVUsR0FBRyxNQUFNLEdBQUcsS0FBSztJQUMzRnRCLEtBQUssQ0FBQ3FCLE9BQU8sR0FBR0EsT0FBTztJQUN2QnJCLEtBQUssQ0FBQ2UsSUFBSSxHQUFHLENBQUM7SUFDZG1RLFFBQVEsQ0FBQyxDQUFDO0VBQ1gsQ0FBRSxDQUFDO0VBQ0hyUixDQUFDLENBQUU4RCxRQUFTLENBQUMsQ0FBQ2dSLEVBQUUsQ0FBRSxRQUFRLEVBQUUsd0VBQXdFLEVBQUUsWUFBWTtJQUFFM0QscUJBQXFCLENBQUVuUixDQUFDLENBQUUsSUFBSyxDQUFFLENBQUM7RUFBRSxDQUFFLENBQUM7RUFDM0pBLENBQUMsQ0FBRThELFFBQVMsQ0FBQyxDQUFDZ1IsRUFBRSxDQUFFLFNBQVMsRUFBRSx3RUFBd0UsRUFBRSxVQUFXQyxLQUFLLEVBQUc7SUFDekgsSUFBSyxPQUFPLEtBQUtBLEtBQUssQ0FBQ3JMLEdBQUcsRUFBRztNQUFFcUwsS0FBSyxDQUFDQyxjQUFjLENBQUMsQ0FBQztNQUFFN0QscUJBQXFCLENBQUVuUixDQUFDLENBQUUsSUFBSyxDQUFFLENBQUM7SUFBRTtFQUM1RixDQUFFLENBQUM7RUFDSEEsQ0FBQyxDQUFFOEQsUUFBUyxDQUFDLENBQUNnUixFQUFFLENBQUUsUUFBUSxFQUFFLDJFQUEyRSxFQUFFLFlBQVk7SUFDcEgsSUFBSTNULFNBQVMsR0FBR2IsTUFBTSxDQUFFTixDQUFDLENBQUUsSUFBSyxDQUFDLENBQUNxSCxHQUFHLENBQUMsQ0FBRSxDQUFDO0lBQ3pDLElBQUssQ0FBRUssUUFBUSxDQUFFdkcsU0FBVSxDQUFDLElBQUlBLFNBQVMsR0FBRyxDQUFDLElBQUlBLFNBQVMsS0FBS2hCLEtBQUssQ0FBQ2dCLFNBQVMsRUFBRztNQUFFO0lBQVE7SUFDM0ZoQixLQUFLLENBQUNnQixTQUFTLEdBQUdBLFNBQVM7SUFDM0JoQixLQUFLLENBQUNlLElBQUksR0FBRyxDQUFDO0lBQ2RtUSxRQUFRLENBQUUsSUFBSyxDQUFDO0VBQ2pCLENBQUUsQ0FBQztFQUNIclIsQ0FBQyxDQUFFOEQsUUFBUyxDQUFDLENBQUNnUixFQUFFLENBQUUsT0FBTyxFQUFFLGlDQUFpQyxFQUFFLFlBQVk7SUFDekUsSUFBSyxDQUFFM1UsS0FBSyxDQUFDQyxZQUFZLElBQUlELEtBQUssQ0FBQ1MsSUFBSSxJQUFJLENBQUVvSixrQkFBa0IsQ0FBQyxDQUFDLEVBQUc7TUFBRTtJQUFRO0lBQzlFUixVQUFVLENBQUVYLFlBQVksQ0FBQyxDQUFFLENBQUM7SUFDNUJ1QixTQUFTLENBQUUsQ0FBRSxDQUFDO0lBQ2RwRSwwQkFBMEIsQ0FBQyxDQUFDO0VBQzdCLENBQUUsQ0FBQztFQUNIaEcsQ0FBQyxDQUFFOEQsUUFBUyxDQUFDLENBQUNnUixFQUFFLENBQUUsT0FBTyxFQUFFLGtDQUFrQyxFQUFFLFlBQVk7SUFDMUUsSUFBSyxDQUFFM1UsS0FBSyxDQUFDQyxZQUFZLElBQUlELEtBQUssQ0FBQ1MsSUFBSSxFQUFHO01BQUU7SUFBUTtJQUNwRDhILE9BQU8sQ0FBRSxJQUFLLENBQUM7SUFDZjdGLE9BQU8sQ0FBRTVDLE1BQU0sQ0FBQzJULE9BQU8sQ0FBQ3NCLElBQUksRUFBRTtNQUFFekwsT0FBTyxFQUFFRyxhQUFhLENBQUM7SUFBRSxDQUFFLENBQUMsQ0FBQ2tLLElBQUksQ0FBRSxVQUFXalMsUUFBUSxFQUFHO01BQ3hGLElBQUtBLFFBQVEsSUFBSUEsUUFBUSxDQUFDa1MsT0FBTyxJQUFJbFMsUUFBUSxDQUFDRSxJQUFJLElBQUlGLFFBQVEsQ0FBQ0UsSUFBSSxDQUFDMEgsT0FBTyxFQUFHO1FBQUVELFVBQVUsQ0FBRTNILFFBQVEsQ0FBQ0UsSUFBSSxDQUFDMEgsT0FBUSxDQUFDO1FBQUVXLFNBQVMsQ0FBRWpLLEtBQUssQ0FBQ0UsVUFBVyxDQUFDO1FBQUU0QixNQUFNLENBQUVKLFFBQVEsQ0FBQ0UsSUFBSSxDQUFDQyxPQUFPLEVBQUUsU0FBVSxDQUFDO1FBQUVxUCxRQUFRLENBQUMsQ0FBQztRQUFFO01BQVE7TUFDcE5wUCxNQUFNLENBQUVMLFdBQVcsQ0FBRUMsUUFBUSxFQUFFNUIsTUFBTSxDQUFDaUssSUFBSSxDQUFDaUwsV0FBWSxDQUFDLEVBQUUsT0FBUSxDQUFDO0lBQ3BFLENBQUUsQ0FBQyxDQUFDbEIsSUFBSSxDQUFFLFVBQVdDLEdBQUcsRUFBRztNQUFFalMsTUFBTSxDQUFFTCxXQUFXLENBQUVzUyxHQUFHLENBQUNDLFlBQVksRUFBRWxVLE1BQU0sQ0FBQ2lLLElBQUksQ0FBQ2lMLFdBQVksQ0FBQyxFQUFFLE9BQVEsQ0FBQztJQUFFLENBQUUsQ0FBQyxDQUFDOVIsTUFBTSxDQUFFLFlBQVk7TUFBRXFGLE9BQU8sQ0FBRSxLQUFNLENBQUM7SUFBRSxDQUFFLENBQUM7RUFDMUosQ0FBRSxDQUFDO0VBQ0gxSSxDQUFDLENBQUU4RCxRQUFTLENBQUMsQ0FBQ2dSLEVBQUUsQ0FBRSxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsWUFBWTtJQUMvRSxJQUFLLENBQUUzVSxLQUFLLENBQUNFLFVBQVUsSUFBSUYsS0FBSyxDQUFDUyxJQUFJLEVBQUc7TUFBRTtJQUFRO0lBQ2xEOEgsT0FBTyxDQUFFLElBQUssQ0FBQztJQUNmN0YsT0FBTyxDQUFFNUMsTUFBTSxDQUFDMlQsT0FBTyxDQUFDd0IsU0FBUyxFQUFFO01BQUV0TSxVQUFVLEVBQUUzSSxLQUFLLENBQUNFO0lBQVcsQ0FBRSxDQUFDLENBQUN5VCxJQUFJLENBQUUsVUFBV2pTLFFBQVEsRUFBRztNQUNqRyxJQUFLQSxRQUFRLElBQUlBLFFBQVEsQ0FBQ2tTLE9BQU8sSUFBSWxTLFFBQVEsQ0FBQ0UsSUFBSSxJQUFJRixRQUFRLENBQUNFLElBQUksQ0FBQzBILE9BQU8sRUFBRztRQUFFRCxVQUFVLENBQUUzSCxRQUFRLENBQUNFLElBQUksQ0FBQzBILE9BQVEsQ0FBQztRQUFFVyxTQUFTLENBQUVqSyxLQUFLLENBQUNFLFVBQVcsQ0FBQztRQUFFNEIsTUFBTSxDQUFFSixRQUFRLENBQUNFLElBQUksQ0FBQ0MsT0FBTyxFQUFFLFNBQVUsQ0FBQztRQUFFcVAsUUFBUSxDQUFDLENBQUM7UUFBRTtNQUFRO01BQ3BOcFAsTUFBTSxDQUFFTCxXQUFXLENBQUVDLFFBQVEsRUFBRTVCLE1BQU0sQ0FBQ2lLLElBQUksQ0FBQ21MLGdCQUFpQixDQUFDLEVBQUUsT0FBUSxDQUFDO0lBQ3pFLENBQUUsQ0FBQyxDQUFDcEIsSUFBSSxDQUFFLFVBQVdDLEdBQUcsRUFBRztNQUFFalMsTUFBTSxDQUFFTCxXQUFXLENBQUVzUyxHQUFHLENBQUNDLFlBQVksRUFBRWxVLE1BQU0sQ0FBQ2lLLElBQUksQ0FBQ21MLGdCQUFpQixDQUFDLEVBQUUsT0FBUSxDQUFDO0lBQUUsQ0FBRSxDQUFDLENBQUNoUyxNQUFNLENBQUUsWUFBWTtNQUFFcUYsT0FBTyxDQUFFLEtBQU0sQ0FBQztJQUFFLENBQUUsQ0FBQztFQUMvSixDQUFFLENBQUM7RUFDSDFJLENBQUMsQ0FBRThELFFBQVMsQ0FBQyxDQUFDZ1IsRUFBRSxDQUFFLE9BQU8sRUFBRSxxQ0FBcUMsRUFBRSxZQUFZO0lBQUVILGNBQWMsQ0FBRXhVLEtBQUssQ0FBQ0UsVUFBVyxDQUFDO0VBQUUsQ0FBRSxDQUFDO0VBQ3ZITCxDQUFDLENBQUU4RCxRQUFTLENBQUMsQ0FBQ2dSLEVBQUUsQ0FBRSxjQUFjLEVBQUUsNEJBQTRCLEVBQUUsWUFBWTtJQUMzRSxJQUFJN04sUUFBUSxHQUFHeEcsTUFBTSxDQUFFVCxDQUFDLENBQUUsSUFBSyxDQUFDLENBQUMrQixJQUFJLENBQUUscUJBQXNCLENBQUMsSUFBSSxFQUFHLENBQUM7SUFDdEUsSUFBS2tGLFFBQVEsRUFBRztNQUFFakgsQ0FBQyxDQUFFLHVCQUF1QixHQUFHaUgsUUFBUSxHQUFHLElBQUssQ0FBQyxDQUFDSSxHQUFHLENBQUVySCxDQUFDLENBQUUsSUFBSyxDQUFDLENBQUNxSCxHQUFHLENBQUMsQ0FBRSxDQUFDLENBQUMvQyxPQUFPLENBQUUsT0FBUSxDQUFDO0lBQUU7RUFDN0csQ0FBRSxDQUFDO0VBQ0h0RSxDQUFDLENBQUU4RCxRQUFTLENBQUMsQ0FBQ2dSLEVBQUUsQ0FBRSxjQUFjLEVBQUUsMENBQTBDLEVBQUUsWUFBWTtJQUFFOU4sa0JBQWtCLENBQUV2RyxNQUFNLENBQUVULENBQUMsQ0FBRSxJQUFLLENBQUMsQ0FBQytCLElBQUksQ0FBRSxlQUFnQixDQUFDLElBQUksRUFBRyxDQUFFLENBQUM7RUFBRSxDQUFFLENBQUM7RUFDeEsvQixDQUFDLENBQUU4RCxRQUFTLENBQUMsQ0FBQ2dSLEVBQUUsQ0FBRSxRQUFRLEVBQUUsOEJBQThCLEVBQUUsWUFBWTtJQUN2RSxJQUFLLElBQUksQ0FBQ1EsT0FBTyxFQUFHO01BQUV0VixDQUFDLENBQUUsK0JBQWdDLENBQUMsQ0FBQ3FILEdBQUcsQ0FBRSxJQUFJLENBQUNELEtBQU0sQ0FBQyxDQUFDOUMsT0FBTyxDQUFFLFFBQVMsQ0FBQztJQUFFO0VBQ25HLENBQUUsQ0FBQztFQUNIdEUsQ0FBQyxDQUFFOEQsUUFBUyxDQUFDLENBQUNnUixFQUFFLENBQUUsd0NBQXdDLEVBQUUsb0NBQW9DLEVBQUUsWUFBWTtJQUFFNU0sa0JBQWtCLENBQUMsQ0FBQztJQUFFOUQsY0FBYyxDQUFDLENBQUM7RUFBRSxDQUFFLENBQUM7RUFDM0pwRSxDQUFDLENBQUU4RCxRQUFTLENBQUMsQ0FBQ2dSLEVBQUUsQ0FBRSxPQUFPLEVBQUUsMENBQTBDLEVBQUUsWUFBWTtJQUNsRixJQUFLOVUsQ0FBQyxDQUFFLElBQUssQ0FBQyxDQUFDbUUsSUFBSSxDQUFFLFVBQVcsQ0FBQyxFQUFHO01BQUU7SUFBUTtJQUM5Q25FLENBQUMsQ0FBRSxvQ0FBcUMsQ0FBQyxDQUFDcUgsR0FBRyxDQUFFLEVBQUcsQ0FBQyxDQUFDL0MsT0FBTyxDQUFFLE9BQVEsQ0FBQyxDQUFDQSxPQUFPLENBQUUsUUFBUyxDQUFDO0VBQzNGLENBQUUsQ0FBQztFQUNIdEUsQ0FBQyxDQUFFOEQsUUFBUyxDQUFDLENBQUNnUixFQUFFLENBQUUsT0FBTyxFQUFFLHNCQUFzQixFQUFFLFlBQVk7SUFBRS9VLENBQUMsQ0FBQ3dWLFlBQVksQ0FBRTdULFdBQVksQ0FBQztJQUFFdkIsS0FBSyxDQUFDZSxJQUFJLEdBQUcsQ0FBQztJQUFFUSxXQUFXLEdBQUczQixDQUFDLENBQUN3RSxVQUFVLENBQUU4TSxRQUFRLEVBQUUsR0FBSSxDQUFDO0VBQUUsQ0FBRSxDQUFDO0VBQ2hLclIsQ0FBQyxDQUFFOEQsUUFBUyxDQUFDLENBQUNnUixFQUFFLENBQUUsUUFBUSxFQUFFLCtCQUErQixFQUFFLFlBQVk7SUFBRTNVLEtBQUssQ0FBQ2UsSUFBSSxHQUFHLENBQUM7SUFBRW1RLFFBQVEsQ0FBQyxDQUFDO0VBQUUsQ0FBRSxDQUFDO0VBQzFHclIsQ0FBQyxDQUFFLFlBQVk7SUFBRSxJQUFLQSxDQUFDLENBQUUsMkNBQTRDLENBQUMsQ0FBQzBDLE1BQU0sRUFBRztNQUFFMk8sUUFBUSxDQUFDLENBQUM7SUFBRTtFQUFFLENBQUUsQ0FBQztBQUNwRyxDQUFDLEVBQUltRSxNQUFNLEVBQUVDLE1BQU8sQ0FBQyIsImlnbm9yZUxpc3QiOltdfQ==
