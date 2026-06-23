"use strict";

/**
 * Booking Actions in Booking Listing.
 *
 * @version     1.0
 * @package     Booking Calendar
 * @author      wpdevelop
 *
 * @web-site    https://wpbookingcalendar.com/
 * @email       info@wpbookingcalendar.com
 * @modified    2025-04-08
 */

/**
 * Check if we can open modal.
 *
 * @param html_id      ID of modal window, e.g.: '#wpbc_modal__payment_status_edit__section'
 *
 * @returns {boolean}
 */
function wpbc_is_modal_accessible(html_id) {
  if ('function' !== typeof jQuery(html_id).wpbc_my_modal) {
    alert('Warning! wpbc_my_modal module has not found. Please, recheck about any conflicts by deactivating other plugins.');
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------------------------------------------------
// == Actions, while cliking on option dropdown ==
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Open Add/Edit Booking modal from Booking Listing row values.
 *
 * @param {string|number} booking_id Booking ID.
 * @param {string|number} resource_id Resource ID.
 * @param {string} booking_hash Booking hash.
 * @param {string} booking_form Custom booking form name.
 * @returns {boolean|undefined}
 */
function wpbc_boo_listing__click__add_booking_modal_from_row(booking_id, resource_id, booking_hash, booking_form) {
  if (!booking_hash) {
    return false;
  }
  return wpbc_boo_listing__click__add_booking_modal({
    mode: 'edit',
    booking_id: booking_id || '',
    resource_id: resource_id || '',
    booking_hash: booking_hash || '',
    booking_form: booking_form || ''
  });
}

/**
 * Insert AJAX-rendered Add/Edit Booking HTML and run its inline lifecycle scripts once.
 *
 * @param {Object} $body Modal body jQuery object.
 * @param {string} html Rendered component HTML.
 */
function wpbc_boo_listing__set_add_booking_modal_body_html($body, html) {
  var $html = jQuery('<div />').append(jQuery.parseHTML(html || '', document, true));
  var $scripts = $html.find('script').remove();
  $body.html($html.contents());
  $scripts.each(function () {
    var type = (jQuery(this).attr('type') || '').toLowerCase();
    var src = jQuery(this).attr('src');
    var code = this.text || this.textContent || this.innerHTML || '';
    if (type && !/^(text|application)\/(x-)?javascript$/.test(type)) {
      return;
    }
    if (src) {
      jQuery.ajax({
        url: src,
        dataType: 'script',
        cache: true,
        async: false
      });
      return;
    }
    if (code) {
      jQuery.globalEval(code);
    }
  });
}

/**
 * Get modal loading spinner HTML.
 *
 * @returns {string}
 */
function wpbc_boo_listing__get_add_booking_modal_loading_html() {
  return '<div class="wpbc_spins_loading_container">' + '<div class="wpbc_booking_form_spin_loader">' + '<div class="wpbc_spins_loader_wrapper">' + '<div class="wpbc_spin_loader_one_new"></div>' + '</div>' + '</div>' + '<span>Loading...</span>' + '</div>';
}

/**
 * Normalize time option values for comparison.
 *
 * @param {string} value Time or time-range value.
 * @returns {string}
 */
function wpbc_boo_listing__normalize_time_value(value) {
  return String(value || '').replace(/\s+/g, '').toLowerCase();
}
function wpbc_boo_listing__trim_text(value) {
  return String(value || '').replace(/^\s+|\s+$/g, '');
}

/**
 * Parse "HH:MM - HH:MM" selected time into start/end values.
 *
 * @param {string} selected_time Time range.
 * @returns {{start_time:string,end_time:string}}
 */
function wpbc_boo_listing__parse_selected_time_range(selected_time) {
  var time_parts = String(selected_time || '').split(' - ');
  return {
    start_time: wpbc_boo_listing__trim_text(time_parts[0]),
    end_time: wpbc_boo_listing__trim_text(time_parts[1])
  };
}
function wpbc_boo_listing__parse_selected_dates(selected_dates) {
  var dates = [];
  var seen = {};
  if (Array.isArray(selected_dates)) {
    dates = selected_dates;
  } else {
    dates = String(selected_dates || '').split(',');
  }
  dates = jQuery.map(dates, function (date) {
    date = wpbc_boo_listing__trim_text(date);
    if (!date || seen[date]) {
      return null;
    }
    seen[date] = true;
    return date;
  });
  return dates;
}
function wpbc_boo_listing__set_modal_days_select_mode_override(resource_id, is_forced) {
  var $modal = jQuery('#wpbc_modal__add_booking__section');
  var originalValue;
  if (!is_forced || !resource_id || 'undefined' === typeof _wpbc || 'function' !== typeof _wpbc.calendar__get_param_value || 'function' !== typeof _wpbc.calendar__set_param_value) {
    return;
  }
  if ('undefined' === typeof $modal.attr('data-wpbc-add-booking-original-days-select-mode')) {
    originalValue = _wpbc.calendar__get_param_value(resource_id, 'days_select_mode');
    $modal.attr('data-wpbc-add-booking-original-days-select-mode', String(originalValue || ''));
    $modal.attr('data-wpbc-add-booking-original-days-select-resource-id', String(resource_id));
  }
  $modal.off('hidden.wpbc.modal.wpbc_add_booking_days_select_mode hidden.bs.modal.wpbc_add_booking_days_select_mode').on('hidden.wpbc.modal.wpbc_add_booking_days_select_mode hidden.bs.modal.wpbc_add_booking_days_select_mode', function () {
    var restoreResourceId = parseInt($modal.attr('data-wpbc-add-booking-original-days-select-resource-id') || 0, 10);
    var restoreValue = $modal.attr('data-wpbc-add-booking-original-days-select-mode');
    if (restoreResourceId && 'undefined' !== typeof restoreValue && 'undefined' !== typeof _wpbc && 'function' === typeof _wpbc.calendar__set_param_value) {
      _wpbc.calendar__set_param_value(restoreResourceId, 'days_select_mode', restoreValue || '');
    }
    $modal.removeAttr('data-wpbc-add-booking-original-days-select-mode').removeAttr('data-wpbc-add-booking-original-days-select-resource-id');
  });
}
function wpbc_boo_listing__ymd_to_ddmmyyyy(ymd_date) {
  var dateParts = String(ymd_date || '').split('-');
  if (3 !== dateParts.length) {
    return '';
  }
  return dateParts[2] + '.' + dateParts[1] + '.' + dateParts[0];
}
function wpbc_boo_listing__sync_selected_dates_to_booking_form(resource_id, selected_dates) {
  var formatted_dates = jQuery.map(selected_dates, function (date) {
    return wpbc_boo_listing__ymd_to_ddmmyyyy(date);
  });
  var dateValue = formatted_dates.join(', ');
  jQuery('#date_booking' + resource_id).val(dateValue);
  if ('function' === typeof wpbc_disable_time_fields_in_booking_form) {
    wpbc_disable_time_fields_in_booking_form(resource_id);
  }
  jQuery('.booking_form_div').trigger('date_selected', [resource_id, dateValue, selected_dates]);
}
function wpbc_boo_listing__auto_select_dates_in_calendar(resource_id, selected_dates, is_force_multiple) {
  var attempts = 0;
  var maxAttempts = 10;
  var eventName = 'wpbc_calendar_ajx__loaded_data.wpbc_add_booking_modal_date';
  var applySelection;
  if (!selected_dates.length || 'function' !== typeof wpbc_auto_select_dates_in_calendar) {
    return;
  }
  applySelection = function () {
    var selectedCount;
    attempts++;
    if (is_force_multiple && 'undefined' !== typeof _wpbc && 'function' === typeof _wpbc.calendar__get_param_value && 'multiple' !== _wpbc.calendar__get_param_value(resource_id, 'days_select_mode')) {
      wpbc_boo_listing__set_modal_days_select_mode_override(resource_id, true);
      if ('function' === typeof _wpbc.calendar__set_param_value) {
        _wpbc.calendar__set_param_value(resource_id, 'days_select_mode', 'multiple');
      }
    }
    selectedCount = wpbc_auto_select_dates_in_calendar(resource_id, selected_dates);
    if (selectedCount >= selected_dates.length) {
      wpbc_boo_listing__sync_selected_dates_to_booking_form(resource_id, selected_dates);
      jQuery('body').off(eventName);
      return true;
    }
    return false;
  };
  jQuery('body').off(eventName).on(eventName, function (event, loaded_resource_id) {
    if (parseInt(loaded_resource_id, 10) === resource_id) {
      applySelection();
    }
  });
  window.setTimeout(function retrySelection() {
    if (applySelection()) {
      return;
    }
    if (attempts < maxAttempts) {
      window.setTimeout(retrySelection, 300);
    }
  }, 300);
}
function wpbc_boo_listing__should_force_recurrent_time(data, selected_dates) {
  return data && (selected_dates || []).length > 1 && !!parseInt(data.time_override_enabled || 0, 10) && 'times_availability' === String(data.time_override_source || '');
}
function wpbc_boo_listing__set_modal_recurrent_time_override(resource_id, is_forced) {
  var $modal = jQuery('#wpbc_modal__add_booking__section');
  var originalValue;
  $modal.attr('data-wpbc-add-booking-force-recurrent-time', is_forced ? '1' : '0');
  if (!is_forced || !resource_id || 'undefined' === typeof _wpbc || 'function' !== typeof _wpbc.calendar__get_param_value || 'function' !== typeof _wpbc.calendar__set_param_value) {
    return;
  }
  if ('undefined' === typeof $modal.attr('data-wpbc-add-booking-original-recurrent-time')) {
    originalValue = _wpbc.calendar__get_param_value(resource_id, 'booking_recurrent_time');
    $modal.attr('data-wpbc-add-booking-original-recurrent-time', String(originalValue || ''));
    $modal.attr('data-wpbc-add-booking-original-recurrent-resource-id', String(resource_id));
  }
  _wpbc.calendar__set_param_value(resource_id, 'booking_recurrent_time', 'On');
  $modal.off('hidden.wpbc.modal.wpbc_add_booking_recurrent_time hidden.bs.modal.wpbc_add_booking_recurrent_time').on('hidden.wpbc.modal.wpbc_add_booking_recurrent_time hidden.bs.modal.wpbc_add_booking_recurrent_time', function () {
    var restoreResourceId = parseInt($modal.attr('data-wpbc-add-booking-original-recurrent-resource-id') || 0, 10);
    var restoreValue = $modal.attr('data-wpbc-add-booking-original-recurrent-time');
    if (restoreResourceId && 'undefined' !== typeof restoreValue && 'undefined' !== typeof _wpbc && 'function' === typeof _wpbc.calendar__set_param_value) {
      _wpbc.calendar__set_param_value(restoreResourceId, 'booking_recurrent_time', restoreValue || 'Off');
    }
    $modal.removeAttr('data-wpbc-add-booking-original-recurrent-time').removeAttr('data-wpbc-add-booking-original-recurrent-resource-id').attr('data-wpbc-add-booking-force-recurrent-time', '0');
  });
}

/**
 * Get booking form time fields that can conflict with a timeline override.
 *
 * @param {Object} $form Booking form jQuery object.
 * @param {number} resource_id Booking resource ID.
 * @returns {Object} jQuery collection.
 */
function wpbc_boo_listing__get_add_booking_modal_time_fields($form, resource_id) {
  var selector = ['select[name="rangetime' + resource_id + '"]', 'select[name="rangetime' + resource_id + '[]"]', 'select[name="starttime' + resource_id + '"]', 'select[name="starttime' + resource_id + '[]"]', 'select[name="endtime' + resource_id + '"]', 'select[name="endtime' + resource_id + '[]"]', 'select[name="durationtime' + resource_id + '"]', 'select[name="durationtime' + resource_id + '[]"]', 'input[name="starttime' + resource_id + '"]', 'input[name="endtime' + resource_id + '"]'].join(', ');
  return $form.find(selector).filter(function () {
    var $field = jQuery(this);
    if ($field.closest('.wpbc_add_booking_modal__selected_time_fields').length) {
      return false;
    }
    if ('input' === this.tagName.toLowerCase() && 'hidden' === String($field.attr('type') || '').toLowerCase()) {
      return false;
    }
    return true;
  });
}

/**
 * Select matching option in a time select without forcing disabled choices.
 *
 * @param {Object} $select Select element.
 * @param {Array} expected_values Acceptable values.
 * @returns {boolean}
 */
function wpbc_boo_listing__select_time_option($select, expected_values) {
  var did_select = false;
  var normalized_expected = [];
  jQuery.each(expected_values, function (index, value) {
    normalized_expected.push(wpbc_boo_listing__normalize_time_value(value));
  });
  $select.find('option').each(function () {
    var $option = jQuery(this);
    var option_value = wpbc_boo_listing__normalize_time_value($option.val());
    if (-1 === jQuery.inArray(option_value, normalized_expected) || $option.prop('disabled')) {
      return true;
    }
    if ($select.prop('multiple')) {
      $option.prop('selected', true);
    } else {
      $select.val($option.val());
    }
    $select.trigger('change');
    did_select = true;
    return false;
  });
  return did_select;
}

/**
 * Check whether the rendered booking form already has user-facing time fields.
 *
 * @param {Object} $form Booking form jQuery object.
 * @param {number} resource_id Booking resource ID.
 * @returns {boolean}
 */
function wpbc_boo_listing__has_add_booking_modal_time_fields($form, resource_id) {
  return wpbc_boo_listing__get_add_booking_modal_time_fields($form, resource_id).length > 0;
}

/**
 * Add visible read-only start/end time fields when the selected booking form has no time controls.
 *
 * @param {Object} $form Booking form jQuery object.
 * @param {number} resource_id Booking resource ID.
 * @param {string} start_time Start time in 24h format.
 * @param {string} end_time End time in 24h format.
 * @returns {boolean}
 */
function wpbc_boo_listing__ensure_add_booking_modal_selected_time_fields($form, resource_id, start_time, end_time) {
  var $wrap = $form.find('.wpbc_add_booking_modal__selected_time_fields');
  var html;
  var $insert_before;
  if (!start_time || !end_time) {
    return false;
  }
  if (!$wrap.length) {
    html = '<div class="wpbc_add_booking_modal__selected_time_fields" style="margin:12px 0;padding:12px;border:1px solid #dcdcde;background:#f6f7f7;border-radius:4px;">' + '<div style="font-weight:600;margin-bottom:8px;">Selected timeline interval</div>' + '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">' + '<label style="display:flex;flex-direction:column;gap:4px;min-width:120px;">' + '<span>Start time</span>' + '<input type="text" class="wpbc_ui_control wpbc_ui_text" name="starttime' + resource_id + '" value="" readonly="readonly" />' + '</label>' + '<label style="display:flex;flex-direction:column;gap:4px;min-width:120px;">' + '<span>End time</span>' + '<input type="text" class="wpbc_ui_control wpbc_ui_text" name="endtime' + resource_id + '" value="" readonly="readonly" />' + '</label>' + '</div>' + '</div>';
    $wrap = jQuery(html);
    $insert_before = $form.find('#bk_type' + resource_id).first();
    if ($insert_before.length) {
      $insert_before.before($wrap);
    } else {
      $form.find('#booking_form_div' + resource_id).append($wrap);
    }
  }
  $wrap.find('input[name="starttime' + resource_id + '"]').val(start_time).trigger('input').trigger('change');
  $wrap.find('input[name="endtime' + resource_id + '"]').val(end_time).trigger('input').trigger('change');
  return true;
}

/**
 * Add/update the explicit timeline interval override panel.
 *
 * @param {Object} $form Booking form jQuery object.
 * @param {number} resource_id Booking resource ID.
 * @param {Object} data Modal context.
 * @returns {boolean}
 */
function wpbc_boo_listing__ensure_add_booking_modal_time_override_panel($form, resource_id, data) {
  var selected_time = data && data.selected_time ? data.selected_time : '';
  var parsed_time = wpbc_boo_listing__parse_selected_time_range(selected_time);
  var start_time = data && data.time_override_start ? data.time_override_start : parsed_time.start_time;
  var end_time = data && data.time_override_end ? data.time_override_end : parsed_time.end_time;
  var $modal = jQuery('#wpbc_modal__add_booking__section');
  var $footer_slot = $modal.find('[data-wpbc-add-booking-time-override-footer]').first();
  var toggle_id = 'wpbc_modal__add_booking__time_override_enabled';
  var $wrap = $modal.find('[data-wpbc-add-booking-time-override-panel]').first();
  var html;
  if (!start_time || !end_time) {
    return false;
  }
  if (!$wrap.length) {
    html = '<div class="wpbc_add_booking_modal__selected_time_fields wpbc_add_booking_modal__time_override" data-wpbc-add-booking-time-override-panel="1">' + '<span class="wpbc_ui__toggle wpbc_add_booking_modal__time_override_toggle">' + '<input type="checkbox" id="' + toggle_id + '" value="1" class="wpbc_ui_checkbox" data-wpbc-add-booking-time-override-enabled="1" data-wpbc-booking-submit-ignore="1" checked="checked" autocomplete="off" />' + '<label class="wpbc_ui__toggle_icon tooltip_top" for="' + toggle_id + '" data-original-title="Use selected timeline interval"></label>' + '<label for="' + toggle_id + '" class="wpbc_ui_control_label wpbc_ui__toggle_label">Use selected timeline interval</label>' + '<i class="wpbc_help_tooltip"></i>' + '</span>' + '<div class="wpbc_add_booking_modal__time_override_fields">' + '<label><span>Start time</span><input type="text" class="wpbc_ui_control wpbc_ui_text" name="starttime' + resource_id + '" value="" readonly="readonly" data-wpbc-add-booking-time-override-field="start" /></label>' + '<label><span>End time</span><input type="text" class="wpbc_ui_control wpbc_ui_text" name="endtime' + resource_id + '" value="" readonly="readonly" data-wpbc-add-booking-time-override-field="end" /></label>' + '</div>' + '<div class="wpbc_add_booking_modal__time_override_note">Form time fields are ignored while enabled.</div>' + '</div>';
    $wrap = jQuery(html);
    if ($footer_slot.length) {
      $footer_slot.html($wrap);
    } else {
      $modal.find('.modal-footer').prepend($wrap);
    }
  }
  $wrap.attr('data-wpbc-add-booking-time-override-source', data && data.time_override_source ? data.time_override_source : '');
  $wrap.find('[data-wpbc-add-booking-time-override-field="start"]').attr('name', 'starttime' + resource_id).val(start_time).trigger('input').trigger('change');
  $wrap.find('[data-wpbc-add-booking-time-override-field="end"]').attr('name', 'endtime' + resource_id).val(end_time).trigger('input').trigger('change');
  $wrap.find('[data-wpbc-add-booking-time-override-enabled]').prop('checked', !data || '0' !== String(data.time_override_enabled || '1'));
  wpbc_boo_listing__apply_add_booking_modal_time_override_state($form, resource_id);
  return true;
}

/**
 * Enable/disable the timeline interval override and mark conflicting form fields.
 *
 * @param {Object} $form Booking form jQuery object.
 * @param {number} resource_id Booking resource ID.
 * @returns {boolean}
 */
function wpbc_boo_listing__apply_add_booking_modal_time_override_state($form, resource_id) {
  var $modal = jQuery('#wpbc_modal__add_booking__section');
  var $wrap = $modal.find('[data-wpbc-add-booking-time-override-panel]').first();
  var $enabled = $wrap.find('[data-wpbc-add-booking-time-override-enabled]').first();
  var is_enabled = $enabled.length ? $enabled.is(':checked') : false;
  var $override_fields = $wrap.find('[data-wpbc-add-booking-time-override-field]');
  var $form_time_fields = wpbc_boo_listing__get_add_booking_modal_time_fields($form, resource_id);
  if (!$wrap.length) {
    return false;
  }
  $wrap.toggleClass('is-enabled', is_enabled);
  $override_fields.attr('data-wpbc-booking-submit-ignore', is_enabled ? '0' : '1');
  $form_time_fields.each(function () {
    var $field = jQuery(this);
    if (is_enabled) {
      if ('undefined' === typeof $field.attr('data-wpbc-add-booking-time-override-original-disabled')) {
        $field.attr('data-wpbc-add-booking-time-override-original-disabled', $field.prop('disabled') ? '1' : '0');
      }
      $field.attr('data-wpbc-booking-submit-ignore', '1').prop('disabled', true).addClass('wpbc_add_booking_modal__time_field_overridden');
    } else {
      $field.removeAttr('data-wpbc-booking-submit-ignore').prop('disabled', '1' === $field.attr('data-wpbc-add-booking-time-override-original-disabled')).removeAttr('data-wpbc-add-booking-time-override-original-disabled').removeClass('wpbc_add_booking_modal__time_field_overridden');
    }
  });
  return is_enabled;
}

/**
 * Apply a preselected time range to the rendered Add Booking form.
 *
 * @param {number} resource_id Booking resource ID.
 * @param {string} selected_time Time range, e.g. "09:00 - 11:00".
 * @returns {boolean}
 */
function wpbc_boo_listing__apply_add_booking_modal_selected_time(resource_id, selected_time) {
  var $form = jQuery('#booking_form' + resource_id);
  var time_parts;
  var start_time;
  var end_time;
  var did_select = false;
  var has_time_fields;
  if (!$form.length || !selected_time) {
    return false;
  }
  time_parts = wpbc_boo_listing__parse_selected_time_range(selected_time);
  start_time = time_parts.start_time;
  end_time = time_parts.end_time;
  has_time_fields = wpbc_boo_listing__has_add_booking_modal_time_fields($form, resource_id);
  if (!has_time_fields) {
    return wpbc_boo_listing__ensure_add_booking_modal_selected_time_fields($form, resource_id, start_time, end_time);
  }
  $form.find('select[name="rangetime' + resource_id + '"], select[name="rangetime' + resource_id + '[]"]').each(function () {
    did_select = wpbc_boo_listing__select_time_option(jQuery(this), [selected_time]) || did_select;
  });
  if (start_time) {
    $form.find('select[name="starttime' + resource_id + '"], select[name="starttime' + resource_id + '[]"]').each(function () {
      did_select = wpbc_boo_listing__select_time_option(jQuery(this), [start_time]) || did_select;
    });
    if ($form.find('input[name="starttime' + resource_id + '"]').not('[type="hidden"]').val(start_time).trigger('input').trigger('change').length) {
      did_select = true;
    }
  }
  if (end_time) {
    $form.find('select[name="endtime' + resource_id + '"], select[name="endtime' + resource_id + '[]"]').each(function () {
      did_select = wpbc_boo_listing__select_time_option(jQuery(this), [end_time]) || did_select;
    });
    if ($form.find('input[name="endtime' + resource_id + '"]').not('[type="hidden"]').val(end_time).trigger('input').trigger('change').length) {
      did_select = true;
    }
  }
  return did_select;
}

/**
 * Apply Add Booking modal date/time context after AJAX-rendered form lifecycle scripts run.
 *
 * @param {Object} data AJAX response data.
 */
function wpbc_boo_listing__preload_add_booking_modal_selection(data) {
  data = data || {};
  var resource_id = parseInt(data.resource_id, 10);
  var selected_date = data.selected_date || '';
  var selected_dates = wpbc_boo_listing__parse_selected_dates(data.selected_dates || selected_date);
  var selected_time = data.selected_time || '';
  var selected_dates_without_calendar = data.selected_dates_without_calendar || '';
  var is_time_override = !!parseInt(data.time_override_enabled || 0, 10);
  var is_force_recurrent_time = wpbc_boo_listing__should_force_recurrent_time(data, selected_dates);
  var apply_time;
  if (!resource_id) {
    return;
  }
  wpbc_boo_listing__set_modal_recurrent_time_override(resource_id, is_force_recurrent_time);
  if (!is_time_override) {
    jQuery('#wpbc_modal__add_booking__section').find('[data-wpbc-add-booking-time-override-panel]').remove();
  }
  if (selected_dates.length && !selected_dates_without_calendar) {
    wpbc_boo_listing__auto_select_dates_in_calendar(resource_id, selected_dates, is_force_recurrent_time);
  }
  if (!selected_time) {
    return;
  }
  apply_time = function () {
    var is_calendar_data_loaded = !selected_date || 'undefined' === typeof _wpbc || 'function' !== typeof _wpbc.bookings_in_calendar__get_for_date || false !== _wpbc.bookings_in_calendar__get_for_date(resource_id, selected_date);
    if (is_calendar_data_loaded && 'function' === typeof wpbc_disable_time_fields_in_booking_form) {
      wpbc_disable_time_fields_in_booking_form(resource_id);
    }
    if (is_time_override) {
      wpbc_boo_listing__ensure_add_booking_modal_time_override_panel(jQuery('#booking_form' + resource_id), resource_id, data);
      return;
    }
    wpbc_boo_listing__apply_add_booking_modal_selected_time(resource_id, selected_time);
  };
  jQuery('.booking_form_div').off('wpbc_hook_timeslots_disabled.wpbc_add_booking_modal_time').one('wpbc_hook_timeslots_disabled.wpbc_add_booking_modal_time', function (event, loaded_resource_id) {
    if (parseInt(loaded_resource_id, 10) === resource_id) {
      window.setTimeout(apply_time, 0);
    }
  });
  jQuery('body').off('wpbc_calendar_ajx__loaded_data.wpbc_add_booking_modal_time').one('wpbc_calendar_ajx__loaded_data.wpbc_add_booking_modal_time', function (event, loaded_resource_id) {
    if (parseInt(loaded_resource_id, 10) === resource_id) {
      window.setTimeout(apply_time, 80);
    }
  });
  window.setTimeout(apply_time, 350);
  window.setTimeout(apply_time, 1000);
}

/**
 * Refresh modal footer controls after Add/Edit Booking context changes.
 *
 * @param {Object} $modal Modal jQuery object.
 * @param {Object} data AJAX response data.
 * @param {string} mode Current modal mode.
 */
function wpbc_boo_listing__sync_add_booking_modal_controls($modal, data, mode) {
  data = data || {};
  $modal.attr('data-wpbc-add-booking-mode', mode || data.mode || 'add');
  var $resource_control = $modal.find('.wpbc_modal__add_booking__resource_control');
  var $resource_select = $modal.find('#wpbc_modal__add_booking__resource_id');
  var $form_select = $modal.find('#wpbc_modal__add_booking__booking_form');
  var $form_edit_link = $modal.find('.wpbc_modal__add_booking__edit_form_link');
  var $allow_past_control = $modal.find('.wpbc_modal__add_booking__allow_past_control');
  var $allow_past_toggle = $modal.find('[data-wpbc-add-booking-allow-past]').first();
  var current_mode = mode || data.mode || 'add';
  if ('edit' === current_mode) {
    $resource_control.hide();
    $allow_past_control.hide();
  } else {
    $resource_control.show();
    $allow_past_control.show();
  }
  if (data.resource_id && $resource_select.length) {
    $resource_select.val(String(data.resource_id));
  }
  if ($form_select.length) {
    var booking_form = data.booking_form || 'standard';
    if (booking_form && !$form_select.find('option').filter(function () {
      return jQuery(this).val() === booking_form;
    }).length) {
      $form_select.append(jQuery('<option />').val(booking_form).text(booking_form));
    }
    $form_select.val(booking_form);
  }
  if ($form_edit_link.length) {
    wpbc_boo_listing__sync_add_booking_modal_form_edit_link($modal);
  }
  if ($allow_past_toggle.length) {
    $allow_past_toggle.prop('checked', !!parseInt(data.allow_past || 0, 10));
  }
}

/**
 * Sync Forms Builder edit link with selected custom booking form.
 *
 * @param {Object} $modal Modal jQuery object.
 */
function wpbc_boo_listing__sync_add_booking_modal_form_edit_link($modal) {
  var $form_select = $modal.find('#wpbc_modal__add_booking__booking_form');
  var $form_edit_link = $modal.find('.wpbc_modal__add_booking__edit_form_link');
  if (!$form_select.length || !$form_edit_link.length) {
    return;
  }
  var form_name = $form_select.val() || 'standard';
  var base_url = $form_edit_link.attr('data-wpbc-add-booking-form-builder-url') || $form_edit_link.attr('href') || '';
  if (!base_url) {
    return;
  }
  var separator = -1 === base_url.indexOf('?') ? '?' : '&';
  $form_edit_link.attr('href', base_url + separator + 'form_name=' + encodeURIComponent(form_name));
}

/**
 * Init modal footer controls.
 */
function wpbc_boo_listing__init_add_booking_modal_controls() {
  jQuery(document).off('change.wpbc_add_booking_modal', '#wpbc_modal__add_booking__resource_id, #wpbc_modal__add_booking__booking_form, #wpbc_modal__add_booking__allow_past').on('change.wpbc_add_booking_modal', '#wpbc_modal__add_booking__resource_id, #wpbc_modal__add_booking__booking_form, #wpbc_modal__add_booking__allow_past', function () {
    var $modal = jQuery('#wpbc_modal__add_booking__section');
    var mode = $modal.attr('data-wpbc-add-booking-mode') || 'add';
    var changed_id = jQuery(this).attr('id') || '';
    var booking_form = $modal.find('#wpbc_modal__add_booking__booking_form').val() || '';
    if ('wpbc_modal__add_booking__resource_id' === changed_id) {
      booking_form = '';
    }
    wpbc_boo_listing__click__add_booking_modal({
      mode: mode,
      booking_id: $modal.attr('data-wpbc-add-booking-id') || '',
      resource_id: $modal.find('#wpbc_modal__add_booking__resource_id').val() || '',
      booking_hash: $modal.attr('data-wpbc-add-booking-hash') || '',
      booking_form: booking_form,
      allow_past: $modal.find('[data-wpbc-add-booking-allow-past]').first().is(':checked') ? 1 : 0,
      selected_dates_without_calendar: $modal.attr('data-wpbc-add-booking-selected-dates-without-calendar') || '',
      selected_dates: $modal.attr('data-wpbc-add-booking-selected-dates') || '',
      selected_date: $modal.attr('data-wpbc-add-booking-selected-date') || '',
      selected_time: $modal.attr('data-wpbc-add-booking-selected-time') || '',
      time_override_enabled: $modal.find('[data-wpbc-add-booking-time-override-enabled]').first().length ? $modal.find('[data-wpbc-add-booking-time-override-enabled]').first().is(':checked') ? 1 : 0 : $modal.attr('data-wpbc-add-booking-time-override-enabled') || 0,
      time_override_source: $modal.attr('data-wpbc-add-booking-time-override-source') || '',
      time_override_start: $modal.attr('data-wpbc-add-booking-time-override-start') || '',
      time_override_end: $modal.attr('data-wpbc-add-booking-time-override-end') || ''
    });
  });
  jQuery(document).off('change.wpbc_add_booking_modal_time_override', '[data-wpbc-add-booking-time-override-enabled]').on('change.wpbc_add_booking_modal_time_override', '[data-wpbc-add-booking-time-override-enabled]', function () {
    var $modal = jQuery('#wpbc_modal__add_booking__section');
    var resource_id = parseInt($modal.attr('data-wpbc-add-booking-resource-id') || 0, 10);
    var $form = jQuery('#booking_form' + resource_id);
    if (resource_id && $form.length) {
      wpbc_boo_listing__apply_add_booking_modal_time_override_state($form, resource_id);
      $modal.attr('data-wpbc-add-booking-time-override-enabled', jQuery(this).is(':checked') ? '1' : '0');
    }
  });
}
jQuery(document).ready(function () {
  wpbc_boo_listing__init_add_booking_modal_controls();
});

/**
 * Prepare selected timeline interval before Add Booking modal submit.
 *
 * @param {number} resource_id Booking resource ID.
 * @returns {boolean}
 */
function wpbc_boo_listing__prepare_add_booking_modal_time_override(resource_id) {
  var $modal = jQuery('#wpbc_modal__add_booking__section');
  var $form = jQuery('#booking_form' + resource_id);
  var $wrap = $modal.find('[data-wpbc-add-booking-time-override-panel]').first();
  var $enabled = $wrap.find('[data-wpbc-add-booking-time-override-enabled]').first();
  var $start;
  var $end;
  if (!$modal.is(':visible') || !$wrap.length || !$enabled.is(':checked')) {
    return true;
  }
  wpbc_boo_listing__apply_add_booking_modal_time_override_state($form, resource_id);
  $start = $wrap.find('[data-wpbc-add-booking-time-override-field="start"]').first();
  $end = $wrap.find('[data-wpbc-add-booking-time-override-field="end"]').first();
  if (!$start.val() || !$end.val()) {
    if ('function' === typeof wpbc_front_end__show_message__warning) {
      wpbc_front_end__show_message__warning($wrap.get(0), 'Selected timeline interval is not complete.');
    }
    return false;
  }
  $modal.attr('data-wpbc-add-booking-time-override-enabled', '1').attr('data-wpbc-add-booking-time-override-start', $start.val()).attr('data-wpbc-add-booking-time-override-end', $end.val());
  return true;
}

/**
 * Open Add/Edit Booking modal.
 *
 * @param {Object} args Modal context.
 * @returns {boolean|undefined}
 */
function wpbc_boo_listing__click__add_booking_modal(args) {
  if (!wpbc_is_modal_accessible('#wpbc_modal__add_booking__section')) {
    return false;
  }
  args = args || {};
  var $modal = jQuery('#wpbc_modal__add_booking__section');
  var $body = jQuery('#wpbc_modal__add_booking__body');
  var nonce = $modal.attr('data-wpbc-add-booking-nonce');
  var mode = args.mode || (args.booking_hash ? 'edit' : 'add');
  var title = 'edit' === mode ? 'Edit booking' : 'Add booking';
  var allow_past = args.allow_past ? 1 : 0;
  if (!allow_past && $modal.find('[data-wpbc-add-booking-allow-past]').first().is(':checked')) {
    allow_past = 1;
  }
  if ('edit' === mode) {
    allow_past = 1;
  }
  $modal.attr('data-wpbc-add-booking-resource-id', '');
  $modal.attr('data-wpbc-add-booking-hash', args.booking_hash || '');
  $modal.attr('data-wpbc-add-booking-id', args.booking_id || '');
  $modal.attr('data-wpbc-add-booking-mode', mode);
  $modal.attr('data-wpbc-add-booking-allow-past', allow_past ? '1' : '0');
  $modal.attr('data-wpbc-add-booking-selected-dates-without-calendar', args.selected_dates_without_calendar || '');
  $modal.attr('data-wpbc-add-booking-selected-dates', args.selected_dates || args.selected_date || '');
  $modal.attr('data-wpbc-add-booking-selected-date', args.selected_date || '');
  $modal.attr('data-wpbc-add-booking-selected-time', args.selected_time || '');
  $modal.attr('data-wpbc-add-booking-time-override-enabled', args.time_override_enabled ? '1' : '0');
  $modal.attr('data-wpbc-add-booking-time-override-source', args.time_override_source || '');
  $modal.attr('data-wpbc-add-booking-time-override-start', args.time_override_start || '');
  $modal.attr('data-wpbc-add-booking-time-override-end', args.time_override_end || '');
  $modal.attr('data-wpbc-add-booking-force-recurrent-time', wpbc_boo_listing__should_force_recurrent_time(args, wpbc_boo_listing__parse_selected_dates(args.selected_dates || args.selected_date)) ? '1' : '0');
  if (!args.time_override_enabled) {
    $modal.find('[data-wpbc-add-booking-time-override-panel]').remove();
  }
  args.allow_past = allow_past;
  wpbc_boo_listing__sync_add_booking_modal_controls($modal, args, mode);
  $modal.find('.wpbc_modal__add_booking__title').text(title);
  $modal.find('.wpbc_modal__add_booking__booking_id').html(args.booking_id ? 'ID: ' + args.booking_id : '');
  $modal.find('#wpbc_modal__add_booking__button_send').text('edit' === mode ? 'Save booking' : 'Add booking');
  $body.html(wpbc_boo_listing__get_add_booking_modal_loading_html());
  $modal.wpbc_my_modal('show');
  jQuery.post(wpbc_url_ajax, {
    action: 'WPBC_AJX_ADD_BOOKING_MODAL',
    nonce: nonce,
    mode: mode,
    booking_id: args.booking_id || '',
    resource_id: args.resource_id || '',
    booking_hash: args.booking_hash || '',
    booking_form: args.booking_form || '',
    allow_past: allow_past,
    selected_dates_without_calendar: args.selected_dates_without_calendar || '',
    selected_dates: args.selected_dates || args.selected_date || '',
    selected_date: args.selected_date || '',
    selected_time: args.selected_time || '',
    time_override_enabled: args.time_override_enabled ? 1 : 0,
    time_override_source: args.time_override_source || '',
    time_override_start: args.time_override_start || '',
    time_override_end: args.time_override_end || ''
  }, function (response) {
    if (!response || !response.success) {
      var message = response && response.data && response.data.message ? response.data.message : 'Unable to load booking form.';
      $body.html('<div class="wpbc-settings-notice notice-warning" style="text-align:left">' + message + '</div>');
      return;
    }
    $modal.attr('data-wpbc-add-booking-resource-id', response.data.resource_id || '');
    $modal.attr('data-wpbc-add-booking-hash', response.data.booking_hash || '');
    $modal.attr('data-wpbc-add-booking-id', response.data.booking_id || '');
    $modal.attr('data-wpbc-add-booking-mode', response.data.mode || mode);
    $modal.attr('data-wpbc-add-booking-allow-past', response.data.allow_past ? '1' : '0');
    $modal.attr('data-wpbc-add-booking-selected-dates-without-calendar', response.data.selected_dates_without_calendar || '');
    $modal.attr('data-wpbc-add-booking-selected-dates', response.data.selected_dates || response.data.selected_date || '');
    $modal.attr('data-wpbc-add-booking-selected-date', response.data.selected_date || '');
    $modal.attr('data-wpbc-add-booking-selected-time', response.data.selected_time || '');
    $modal.attr('data-wpbc-add-booking-time-override-enabled', response.data.time_override_enabled ? '1' : '0');
    $modal.attr('data-wpbc-add-booking-time-override-source', response.data.time_override_source || '');
    $modal.attr('data-wpbc-add-booking-time-override-start', response.data.time_override_start || '');
    $modal.attr('data-wpbc-add-booking-time-override-end', response.data.time_override_end || '');
    wpbc_boo_listing__sync_add_booking_modal_controls($modal, response.data, response.data.mode || mode);
    $modal.find('.wpbc_modal__add_booking__title').text(response.data.title || title);
    $modal.find('.wpbc_modal__add_booking__booking_id').html(response.data.booking_id ? 'ID: ' + response.data.booking_id : '');
    $modal.find('#wpbc_modal__add_booking__button_send').text(response.data.button_title || ('edit' === mode ? 'Save booking' : 'Add booking'));
    wpbc_boo_listing__set_add_booking_modal_body_html($body, response.data.html || '');
    if ('function' === typeof wpbc_hook__init_booking_form_wizard_buttons) {
      wpbc_hook__init_booking_form_wizard_buttons();
    }
    if ('undefined' !== typeof _wpbc) {
      _wpbc.set_other_param('this_page_booking_hash', response.data.booking_hash || '');
      _wpbc.set_other_param('this_page_allow_past', response.data.allow_past ? 1 : 0);
    }
    if ('function' === typeof wpbc_bs_javascript_tooltips) {
      wpbc_bs_javascript_tooltips();
    }
    if ('function' === typeof wpbc_bs_javascript_popover) {
      wpbc_bs_javascript_popover();
    }
    wpbc_boo_listing__preload_add_booking_modal_selection(response.data);
  }).fail(function () {
    $body.html('<div class="wpbc-settings-notice notice-warning" style="text-align:left">Unable to load booking form.</div>');
  });
}

/**
 * Reload Booking Listing after Add/Edit Booking modal saved successfully.
 */
function wpbc_boo_listing__reload_after_add_booking_modal_submit() {
  var $modal = jQuery('#wpbc_modal__add_booking__section');
  if ($modal.length && 'function' === typeof $modal.wpbc_my_modal) {
    $modal.wpbc_my_modal('hide');
  }
  if ('function' === typeof window.wpbc_ajx_booking_send_search_request_with_params && 'undefined' !== typeof window.wpbc_ajx_booking_listing) {
    window.wpbc_ajx_booking_send_search_request_with_params({});
    return;
  }
  if ('function' === typeof window.wpbc_ajx_booking__actual_listing__show) {
    window.wpbc_ajx_booking__actual_listing__show();
  }
}

/**
 * Submit Add/Edit Booking modal form.
 *
 * @returns {boolean|undefined}
 */
function wpbc_boo_listing__submit__add_booking_modal() {
  var $modal = jQuery('#wpbc_modal__add_booking__section');
  var $form = $modal.find('form.booking_form').first();
  var resource_id = 0;
  if ($form.length) {
    resource_id = parseInt(($form.attr('id') || '').replace('booking_form', ''), 10);
  }
  if (!resource_id) {
    resource_id = parseInt($modal.attr('data-wpbc-add-booking-resource-id'), 10);
  }
  if (!resource_id) {
    return false;
  }
  var submit_form = $form.length ? $form.get(0) : document.getElementById('booking_form' + resource_id);
  var locale = 'undefined' !== typeof _wpbc ? _wpbc.get_other_param('locale_active') : '';
  var submit_result;
  if (!wpbc_boo_listing__prepare_add_booking_modal_time_override(resource_id)) {
    return false;
  }
  jQuery('body').off('wpbc_booking_form_submit_success.wpbc_add_booking_modal_reload').on('wpbc_booking_form_submit_success.wpbc_add_booking_modal_reload', function (event, submitted_resource_id) {
    if (parseInt(submitted_resource_id, 10) !== resource_id) {
      return;
    }
    jQuery('body').off('wpbc_booking_form_submit_success.wpbc_add_booking_modal_reload');
    if (!jQuery('#wpbc_modal__add_booking__section').is(':visible')) {
      return;
    }
    wpbc_boo_listing__reload_after_add_booking_modal_submit();
  });
  submit_result = wpbc_booking_form_submit(submit_form, resource_id, locale);
  if (false === submit_result) {
    jQuery('body').off('wpbc_booking_form_submit_success.wpbc_add_booking_modal_reload');
  }
  return submit_result;
}

/**
 * Change payment Cost.
 *
 * @param booking_id			- ID of booking.
 * @param cost	                - payment cost.
 */
function wpbc_boo_listing__click__set_booking_cost(booking_id, cost) {
  if (!wpbc_is_modal_accessible('#wpbc_modal__booking_cost_edit__section')) {
    return false;
  }

  // Set booking cost.
  jQuery('#wpbc_modal__booking_cost_edit__value').val(cost);

  // Set booking ID.
  jQuery('#wpbc_modal__booking_cost_edit__booking_id').val(booking_id);

  // ID title.
  jQuery('.wpbc_modal__booking_cost_edit__booking_id').html('ID: ' + booking_id);

  // Show Modal.
  jQuery('#wpbc_modal__booking_cost_edit__section').wpbc_my_modal('show');

  // Set focus to input.
  jQuery('#wpbc_modal__booking_cost_edit__value').trigger('focus');
}

/**
 * Change payment Status.
 *
 * @param booking_id			- ID of booking.
 * @param selected_pay_status	- payment status.
 */
function wpbc_boo_listing__click__set_payment_status(booking_id, selected_pay_status) {
  if (!wpbc_is_modal_accessible('#wpbc_modal__payment_status_edit__section')) {
    return false;
  }
  var jSelect = jQuery('#wpbc_modal__payment_status_edit__value');

  // Select Status.
  if (!isNaN(parseFloat(selected_pay_status)) || '' === selected_pay_status) {
    // Is it float - then  it's unknown.
    jSelect.find('option[value="1"]').prop('selected', true); // Unknown  value is '1' in select box.
  } else {
    jSelect.find('option[value="' + selected_pay_status + '"]').prop('selected', true); // Otherwise known payment status.
  }
  // Set booking ID.
  jQuery('#wpbc_modal__payment_status_edit__booking_id').val(booking_id);

  // ID title.
  jQuery('.wpbc_modal__payment_status_edit__booking_id').html('ID: ' + booking_id);

  // Show Modal.
  jQuery('#wpbc_modal__payment_status_edit__section').wpbc_my_modal('show');

  // Set focus to input.
  jQuery('#wpbc_modal__payment_status_edit__value').trigger('focus');
}

/**
 * Send payment request
 *
 * @param booking_id
 * @param visitorbookingpayurl
 * @param cost
 * @returns {boolean}
 */
function wpbc_boo_listing__click__send_payment_request(booking_id, visitorbookingpayurl, cost) {
  if (!wpbc_is_modal_accessible('#wpbc_modal__send_payment_request__section')) {
    return false;
  }

  // Set booking cost.
  jQuery('#wpbc_modal__send_payment_request__url').val(visitorbookingpayurl);

  // Set booking ID.
  jQuery('#wpbc_modal__send_payment_request__booking_id').val(booking_id);

  // ID title.
  jQuery('.wpbc_modal__send_payment_request__booking_id').html('ID: ' + booking_id);

  // Cost.
  jQuery('.wpbc_modal__send_payment_request__cost').html(cost);

  // Show Modal.
  jQuery('#wpbc_modal__send_payment_request__section').wpbc_my_modal('show');

  // Set focus to input.
  jQuery('#wpbc_modal__send_payment_request__value').trigger('focus');
}

/**
 * Save Notes
 *
 * @param booking_id
 * @param note_text
 * @returns {boolean}
 */
function wpbc_boo_listing__click__set_booking_note(booking_id, note_text) {
  if (!wpbc_is_modal_accessible('#wpbc_modal__set_booking_note__section')) {
    return false;
  }

  // Set Note.
  jQuery('#wpbc_modal__set_booking_note__value').val(note_text);

  // Set booking ID.
  jQuery('#wpbc_modal__set_booking_note__booking_id').val(booking_id);

  // ID title.
  jQuery('.wpbc_modal__set_booking_note__booking_id').html('ID: ' + booking_id);

  // Show Modal.
  jQuery('#wpbc_modal__set_booking_note__section').wpbc_my_modal('show');

  // Set focus to input. // jQuery( '#wpbc_modal__set_booking_note__value' ).trigger( 'focus' ); .
  jQuery('#wpbc_modal__set_booking_note__value').scrollTop(0);
}

/**
 * Change Resource for Booking
 *
 * @param booking_id			- ID of booking.
 * @param resource_id           - ID of booking resource.
 */
function wpbc_boo_listing__click__change_booking_resource(booking_id, resource_id) {
  if (!wpbc_is_modal_accessible('#wpbc_modal__change_booking_resource__section')) {
    return false;
  }

  // Select booking resource  that belong to  booking.
  jQuery('#wpbc_modal__change_booking_resource__resource_id').val(resource_id).trigger('change');

  // Set booking ID.
  jQuery('#wpbc_modal__change_booking_resource__booking_id').val(booking_id);
  // ID title.
  jQuery('.wpbc_modal__change_booking_resource__booking_id').html('ID: ' + booking_id);

  // Show Modal.
  jQuery('#wpbc_modal__change_booking_resource__section').wpbc_my_modal('show');

  // Set focus to input.
  jQuery('#wpbc_modal__change_booking_resource__resource_id').focus();
}

/**
 * Set unavailable times for booking resource and dates.
 *
 * @param booking_id    ID of booking.
 * @param resource_id   ID of booking resource.
 * @param date_start    Booking start date.
 * @param date_end      Booking end date.
 */
function wpbc_boo_listing__click__set_unavailable_times(booking_id, resource_id, date_start, date_end) {
  if (!wpbc_is_modal_accessible('#wpbc_modal__set_unavailable_times__section')) {
    return false;
  }
  var $modal = jQuery('#wpbc_modal__set_unavailable_times__section');
  var $page = $modal.find('.wpbc_ts_page').first();
  if (booking_id) {
    jQuery('.wpbc_modal__set_unavailable_times__booking_id').html('ID: ' + booking_id);
  } else {
    jQuery('.wpbc_modal__set_unavailable_times__booking_id').html('');
  }
  $modal.wpbc_my_modal('show');
  if ('function' === typeof window.wpbc_availability_timeslots_init) {
    window.wpbc_availability_timeslots_init($page);
  }
  if ('function' === typeof window.wpbc_availability_timeslots_set_context) {
    window.wpbc_availability_timeslots_set_context($page, {
      resource_id: resource_id,
      date_start: date_start,
      date_end: date_end
    });
  }
}

/**
 * Duplicate Booking into another resource.
 *
 * @param booking_id			- ID of booking.
 * @param resource_id           - ID of booking resource.
 */
function wpbc_boo_listing__click__duplicate_booking_to_other_resource(booking_id, resource_id) {
  if (!wpbc_is_modal_accessible('#wpbc_modal__duplicate_booking_to_other_resource__section')) {
    return false;
  }

  // Select booking resource  that belong to  booking.
  jQuery('#wpbc_modal__duplicate_booking_to_other_resource__resource_id').val(resource_id).trigger('change');

  // Set booking ID.
  jQuery('#wpbc_modal__duplicate_booking_to_other_resource__booking_id').val(booking_id);
  // ID title.
  jQuery('.wpbc_modal__duplicate_booking_to_other_resource__booking_id').html('ID: ' + booking_id);

  // Show Modal.
  jQuery('#wpbc_modal__duplicate_booking_to_other_resource__section').wpbc_my_modal('show');

  // Set focus to input.
  jQuery('#wpbc_modal__duplicate_booking_to_other_resource__resource_id').focus();
}

/**
 * Change Locale of Booking.
 *
 * @param booking_id			- ID of booking.
 * @param resource_id           - ID of booking resource.
 */
function wpbc_boo_listing__click__set_booking_locale(booking_id, selected_locale_value) {
  if (!wpbc_is_modal_accessible('#wpbc_modal__set_booking_locale__section')) {
    return false;
  }

  // Select booking Locale  that belong to  booking.
  jQuery('#wpbc_modal__set_booking_locale').val(selected_locale_value).trigger('change');

  // var jSelect = jQuery( '#set_booking_locale__resource_select' );
  // jSelect.find( 'option[value="' + resource_id + '"]' ).prop( 'selected', true );		// Otherwise known payment status.

  // Set booking ID.
  jQuery('#wpbc_modal__set_booking_locale__booking_id').val(booking_id);
  // ID title.
  jQuery('.wpbc_modal__set_booking_locale__booking_id').html('ID: ' + booking_id);

  // Show Modal.
  jQuery('#wpbc_modal__set_booking_locale__section').wpbc_my_modal('show');

  // Set focus to input.
  jQuery('#wpbc_modal__set_booking_locale').focus();
}

// ---------------------------------------------------------------------------------------------------------------------
// == Filter Toolbar ==
// ---------------------------------------------------------------------------------------------------------------------
/**
 * == "Sort By" Button ==
 * This function update Title in Dropdown menu.
 * It executed, after receving Ajax response.
 * And based on parameters of this response, we get option title from dropdown list options and show it in toggle title.
 */
function wpbc_boo_listing__init_hook__sort_by() {
  var el_id = 'wh_sort';
  var parameter_value = wpbc_ajx_booking_listing.search_get_param(el_id);
  var j_option_link = jQuery('.ul_dropdown_menu_li__' + el_id + '__' + parameter_value);
  if (j_option_link.length) {
    jQuery('.ul_dropdown_menu__' + el_id + ' .ul_dropdown_menu_toggle .selected_value').html(j_option_link.html());
  } else {
    jQuery('.ul_dropdown_menu__' + el_id + ' .ul_dropdown_menu_toggle .selected_value').html('---');
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// == Listing Header Table ==
// ---------------------------------------------------------------------------------------------------------------------
/**
 * == "Expand All Rows" Button ==
 */
function wpbc_boo_listing__click__expand_all_rows() {
  jQuery('.wpbc_row_wrap').removeClass('max_height_a');
  jQuery('.wpbc_row_wrap .wpbc_icn_expand_less').show();
  jQuery('.wpbc_row_wrap .wpbc_icn_expand_more').hide();
  jQuery('.wpbc_btn_expand_colapse_all').toggle();
}

/**
 * == "Colpase All Rows" Button ==
 */
function wpbc_boo_listing__click__colapse_all_rows() {
  jQuery('.wpbc_row_wrap').addClass('max_height_a');
  jQuery('.wpbc_row_wrap .wpbc_icn_expand_less').hide();
  jQuery('.wpbc_row_wrap .wpbc_icn_expand_more').show();
  jQuery('.wpbc_btn_expand_colapse_all').toggle();
}
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1ib29raW5ncy9fb3V0L2Jvb19saXN0aW5nX19hY3Rpb25zLmpzIiwibmFtZXMiOlsid3BiY19pc19tb2RhbF9hY2Nlc3NpYmxlIiwiaHRtbF9pZCIsImpRdWVyeSIsIndwYmNfbXlfbW9kYWwiLCJhbGVydCIsIndwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19hZGRfYm9va2luZ19tb2RhbF9mcm9tX3JvdyIsImJvb2tpbmdfaWQiLCJyZXNvdXJjZV9pZCIsImJvb2tpbmdfaGFzaCIsImJvb2tpbmdfZm9ybSIsIndwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19hZGRfYm9va2luZ19tb2RhbCIsIm1vZGUiLCJ3cGJjX2Jvb19saXN0aW5nX19zZXRfYWRkX2Jvb2tpbmdfbW9kYWxfYm9keV9odG1sIiwiJGJvZHkiLCJodG1sIiwiJGh0bWwiLCJhcHBlbmQiLCJwYXJzZUhUTUwiLCJkb2N1bWVudCIsIiRzY3JpcHRzIiwiZmluZCIsInJlbW92ZSIsImNvbnRlbnRzIiwiZWFjaCIsInR5cGUiLCJhdHRyIiwidG9Mb3dlckNhc2UiLCJzcmMiLCJjb2RlIiwidGV4dCIsInRleHRDb250ZW50IiwiaW5uZXJIVE1MIiwidGVzdCIsImFqYXgiLCJ1cmwiLCJkYXRhVHlwZSIsImNhY2hlIiwiYXN5bmMiLCJnbG9iYWxFdmFsIiwid3BiY19ib29fbGlzdGluZ19fZ2V0X2FkZF9ib29raW5nX21vZGFsX2xvYWRpbmdfaHRtbCIsIndwYmNfYm9vX2xpc3RpbmdfX25vcm1hbGl6ZV90aW1lX3ZhbHVlIiwidmFsdWUiLCJTdHJpbmciLCJyZXBsYWNlIiwid3BiY19ib29fbGlzdGluZ19fdHJpbV90ZXh0Iiwid3BiY19ib29fbGlzdGluZ19fcGFyc2Vfc2VsZWN0ZWRfdGltZV9yYW5nZSIsInNlbGVjdGVkX3RpbWUiLCJ0aW1lX3BhcnRzIiwic3BsaXQiLCJzdGFydF90aW1lIiwiZW5kX3RpbWUiLCJ3cGJjX2Jvb19saXN0aW5nX19wYXJzZV9zZWxlY3RlZF9kYXRlcyIsInNlbGVjdGVkX2RhdGVzIiwiZGF0ZXMiLCJzZWVuIiwiQXJyYXkiLCJpc0FycmF5IiwibWFwIiwiZGF0ZSIsIndwYmNfYm9vX2xpc3RpbmdfX3NldF9tb2RhbF9kYXlzX3NlbGVjdF9tb2RlX292ZXJyaWRlIiwiaXNfZm9yY2VkIiwiJG1vZGFsIiwib3JpZ2luYWxWYWx1ZSIsIl93cGJjIiwiY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSIsImNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUiLCJvZmYiLCJvbiIsInJlc3RvcmVSZXNvdXJjZUlkIiwicGFyc2VJbnQiLCJyZXN0b3JlVmFsdWUiLCJyZW1vdmVBdHRyIiwid3BiY19ib29fbGlzdGluZ19feW1kX3RvX2RkbW15eXl5IiwieW1kX2RhdGUiLCJkYXRlUGFydHMiLCJsZW5ndGgiLCJ3cGJjX2Jvb19saXN0aW5nX19zeW5jX3NlbGVjdGVkX2RhdGVzX3RvX2Jvb2tpbmdfZm9ybSIsImZvcm1hdHRlZF9kYXRlcyIsImRhdGVWYWx1ZSIsImpvaW4iLCJ2YWwiLCJ3cGJjX2Rpc2FibGVfdGltZV9maWVsZHNfaW5fYm9va2luZ19mb3JtIiwidHJpZ2dlciIsIndwYmNfYm9vX2xpc3RpbmdfX2F1dG9fc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyIiwiaXNfZm9yY2VfbXVsdGlwbGUiLCJhdHRlbXB0cyIsIm1heEF0dGVtcHRzIiwiZXZlbnROYW1lIiwiYXBwbHlTZWxlY3Rpb24iLCJ3cGJjX2F1dG9fc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyIiwic2VsZWN0ZWRDb3VudCIsImV2ZW50IiwibG9hZGVkX3Jlc291cmNlX2lkIiwid2luZG93Iiwic2V0VGltZW91dCIsInJldHJ5U2VsZWN0aW9uIiwid3BiY19ib29fbGlzdGluZ19fc2hvdWxkX2ZvcmNlX3JlY3VycmVudF90aW1lIiwiZGF0YSIsInRpbWVfb3ZlcnJpZGVfZW5hYmxlZCIsInRpbWVfb3ZlcnJpZGVfc291cmNlIiwid3BiY19ib29fbGlzdGluZ19fc2V0X21vZGFsX3JlY3VycmVudF90aW1lX292ZXJyaWRlIiwid3BiY19ib29fbGlzdGluZ19fZ2V0X2FkZF9ib29raW5nX21vZGFsX3RpbWVfZmllbGRzIiwiJGZvcm0iLCJzZWxlY3RvciIsImZpbHRlciIsIiRmaWVsZCIsImNsb3Nlc3QiLCJ0YWdOYW1lIiwid3BiY19ib29fbGlzdGluZ19fc2VsZWN0X3RpbWVfb3B0aW9uIiwiJHNlbGVjdCIsImV4cGVjdGVkX3ZhbHVlcyIsImRpZF9zZWxlY3QiLCJub3JtYWxpemVkX2V4cGVjdGVkIiwiaW5kZXgiLCJwdXNoIiwiJG9wdGlvbiIsIm9wdGlvbl92YWx1ZSIsImluQXJyYXkiLCJwcm9wIiwid3BiY19ib29fbGlzdGluZ19faGFzX2FkZF9ib29raW5nX21vZGFsX3RpbWVfZmllbGRzIiwid3BiY19ib29fbGlzdGluZ19fZW5zdXJlX2FkZF9ib29raW5nX21vZGFsX3NlbGVjdGVkX3RpbWVfZmllbGRzIiwiJHdyYXAiLCIkaW5zZXJ0X2JlZm9yZSIsImZpcnN0IiwiYmVmb3JlIiwid3BiY19ib29fbGlzdGluZ19fZW5zdXJlX2FkZF9ib29raW5nX21vZGFsX3RpbWVfb3ZlcnJpZGVfcGFuZWwiLCJwYXJzZWRfdGltZSIsInRpbWVfb3ZlcnJpZGVfc3RhcnQiLCJ0aW1lX292ZXJyaWRlX2VuZCIsIiRmb290ZXJfc2xvdCIsInRvZ2dsZV9pZCIsInByZXBlbmQiLCJ3cGJjX2Jvb19saXN0aW5nX19hcHBseV9hZGRfYm9va2luZ19tb2RhbF90aW1lX292ZXJyaWRlX3N0YXRlIiwiJGVuYWJsZWQiLCJpc19lbmFibGVkIiwiaXMiLCIkb3ZlcnJpZGVfZmllbGRzIiwiJGZvcm1fdGltZV9maWVsZHMiLCJ0b2dnbGVDbGFzcyIsImFkZENsYXNzIiwicmVtb3ZlQ2xhc3MiLCJ3cGJjX2Jvb19saXN0aW5nX19hcHBseV9hZGRfYm9va2luZ19tb2RhbF9zZWxlY3RlZF90aW1lIiwiaGFzX3RpbWVfZmllbGRzIiwibm90Iiwid3BiY19ib29fbGlzdGluZ19fcHJlbG9hZF9hZGRfYm9va2luZ19tb2RhbF9zZWxlY3Rpb24iLCJzZWxlY3RlZF9kYXRlIiwic2VsZWN0ZWRfZGF0ZXNfd2l0aG91dF9jYWxlbmRhciIsImlzX3RpbWVfb3ZlcnJpZGUiLCJpc19mb3JjZV9yZWN1cnJlbnRfdGltZSIsImFwcGx5X3RpbWUiLCJpc19jYWxlbmRhcl9kYXRhX2xvYWRlZCIsImJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUiLCJvbmUiLCJ3cGJjX2Jvb19saXN0aW5nX19zeW5jX2FkZF9ib29raW5nX21vZGFsX2NvbnRyb2xzIiwiJHJlc291cmNlX2NvbnRyb2wiLCIkcmVzb3VyY2Vfc2VsZWN0IiwiJGZvcm1fc2VsZWN0IiwiJGZvcm1fZWRpdF9saW5rIiwiJGFsbG93X3Bhc3RfY29udHJvbCIsIiRhbGxvd19wYXN0X3RvZ2dsZSIsImN1cnJlbnRfbW9kZSIsImhpZGUiLCJzaG93Iiwid3BiY19ib29fbGlzdGluZ19fc3luY19hZGRfYm9va2luZ19tb2RhbF9mb3JtX2VkaXRfbGluayIsImFsbG93X3Bhc3QiLCJmb3JtX25hbWUiLCJiYXNlX3VybCIsInNlcGFyYXRvciIsImluZGV4T2YiLCJlbmNvZGVVUklDb21wb25lbnQiLCJ3cGJjX2Jvb19saXN0aW5nX19pbml0X2FkZF9ib29raW5nX21vZGFsX2NvbnRyb2xzIiwiY2hhbmdlZF9pZCIsInJlYWR5Iiwid3BiY19ib29fbGlzdGluZ19fcHJlcGFyZV9hZGRfYm9va2luZ19tb2RhbF90aW1lX292ZXJyaWRlIiwiJHN0YXJ0IiwiJGVuZCIsIndwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX3dhcm5pbmciLCJnZXQiLCJhcmdzIiwibm9uY2UiLCJ0aXRsZSIsInBvc3QiLCJ3cGJjX3VybF9hamF4IiwiYWN0aW9uIiwicmVzcG9uc2UiLCJzdWNjZXNzIiwibWVzc2FnZSIsImJ1dHRvbl90aXRsZSIsIndwYmNfaG9va19faW5pdF9ib29raW5nX2Zvcm1fd2l6YXJkX2J1dHRvbnMiLCJzZXRfb3RoZXJfcGFyYW0iLCJ3cGJjX2JzX2phdmFzY3JpcHRfdG9vbHRpcHMiLCJ3cGJjX2JzX2phdmFzY3JpcHRfcG9wb3ZlciIsImZhaWwiLCJ3cGJjX2Jvb19saXN0aW5nX19yZWxvYWRfYWZ0ZXJfYWRkX2Jvb2tpbmdfbW9kYWxfc3VibWl0Iiwid3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zIiwid3BiY19hanhfYm9va2luZ19saXN0aW5nIiwid3BiY19hanhfYm9va2luZ19fYWN0dWFsX2xpc3RpbmdfX3Nob3ciLCJ3cGJjX2Jvb19saXN0aW5nX19zdWJtaXRfX2FkZF9ib29raW5nX21vZGFsIiwic3VibWl0X2Zvcm0iLCJnZXRFbGVtZW50QnlJZCIsImxvY2FsZSIsImdldF9vdGhlcl9wYXJhbSIsInN1Ym1pdF9yZXN1bHQiLCJzdWJtaXR0ZWRfcmVzb3VyY2VfaWQiLCJ3cGJjX2Jvb2tpbmdfZm9ybV9zdWJtaXQiLCJ3cGJjX2Jvb19saXN0aW5nX19jbGlja19fc2V0X2Jvb2tpbmdfY29zdCIsImNvc3QiLCJ3cGJjX2Jvb19saXN0aW5nX19jbGlja19fc2V0X3BheW1lbnRfc3RhdHVzIiwic2VsZWN0ZWRfcGF5X3N0YXR1cyIsImpTZWxlY3QiLCJpc05hTiIsInBhcnNlRmxvYXQiLCJ3cGJjX2Jvb19saXN0aW5nX19jbGlja19fc2VuZF9wYXltZW50X3JlcXVlc3QiLCJ2aXNpdG9yYm9va2luZ3BheXVybCIsIndwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19zZXRfYm9va2luZ19ub3RlIiwibm90ZV90ZXh0Iiwic2Nyb2xsVG9wIiwid3BiY19ib29fbGlzdGluZ19fY2xpY2tfX2NoYW5nZV9ib29raW5nX3Jlc291cmNlIiwiZm9jdXMiLCJ3cGJjX2Jvb19saXN0aW5nX19jbGlja19fc2V0X3VuYXZhaWxhYmxlX3RpbWVzIiwiZGF0ZV9zdGFydCIsImRhdGVfZW5kIiwiJHBhZ2UiLCJ3cGJjX2F2YWlsYWJpbGl0eV90aW1lc2xvdHNfaW5pdCIsIndwYmNfYXZhaWxhYmlsaXR5X3RpbWVzbG90c19zZXRfY29udGV4dCIsIndwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19kdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZSIsIndwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19zZXRfYm9va2luZ19sb2NhbGUiLCJzZWxlY3RlZF9sb2NhbGVfdmFsdWUiLCJ3cGJjX2Jvb19saXN0aW5nX19pbml0X2hvb2tfX3NvcnRfYnkiLCJlbF9pZCIsInBhcmFtZXRlcl92YWx1ZSIsInNlYXJjaF9nZXRfcGFyYW0iLCJqX29wdGlvbl9saW5rIiwid3BiY19ib29fbGlzdGluZ19fY2xpY2tfX2V4cGFuZF9hbGxfcm93cyIsInRvZ2dsZSIsIndwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19jb2xhcHNlX2FsbF9yb3dzIl0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1ib29raW5ncy9fc3JjL2Jvb19saXN0aW5nX19hY3Rpb25zLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBCb29raW5nIEFjdGlvbnMgaW4gQm9va2luZyBMaXN0aW5nLlxyXG4gKlxyXG4gKiBAdmVyc2lvbiAgICAgMS4wXHJcbiAqIEBwYWNrYWdlICAgICBCb29raW5nIENhbGVuZGFyXHJcbiAqIEBhdXRob3IgICAgICB3cGRldmVsb3BcclxuICpcclxuICogQHdlYi1zaXRlICAgIGh0dHBzOi8vd3Bib29raW5nY2FsZW5kYXIuY29tL1xyXG4gKiBAZW1haWwgICAgICAgaW5mb0B3cGJvb2tpbmdjYWxlbmRhci5jb21cclxuICogQG1vZGlmaWVkICAgIDIwMjUtMDQtMDhcclxuICovXHJcblxyXG4vKipcclxuICogQ2hlY2sgaWYgd2UgY2FuIG9wZW4gbW9kYWwuXHJcbiAqXHJcbiAqIEBwYXJhbSBodG1sX2lkICAgICAgSUQgb2YgbW9kYWwgd2luZG93LCBlLmcuOiAnI3dwYmNfbW9kYWxfX3BheW1lbnRfc3RhdHVzX2VkaXRfX3NlY3Rpb24nXHJcbiAqXHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19pc19tb2RhbF9hY2Nlc3NpYmxlKCBodG1sX2lkICkge1xyXG5cdGlmICggJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIChqUXVlcnkoIGh0bWxfaWQgKS53cGJjX215X21vZGFsKSApIHtcclxuXHRcdGFsZXJ0KCAnV2FybmluZyEgd3BiY19teV9tb2RhbCBtb2R1bGUgaGFzIG5vdCBmb3VuZC4gUGxlYXNlLCByZWNoZWNrIGFib3V0IGFueSBjb25mbGljdHMgYnkgZGVhY3RpdmF0aW5nIG90aGVyIHBsdWdpbnMuJyApO1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHRyZXR1cm4gdHJ1ZTtcclxufVxyXG5cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyA9PSBBY3Rpb25zLCB3aGlsZSBjbGlraW5nIG9uIG9wdGlvbiBkcm9wZG93biA9PVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBPcGVuIEFkZC9FZGl0IEJvb2tpbmcgbW9kYWwgZnJvbSBCb29raW5nIExpc3Rpbmcgcm93IHZhbHVlcy5cclxuICpcclxuICogQHBhcmFtIHtzdHJpbmd8bnVtYmVyfSBib29raW5nX2lkIEJvb2tpbmcgSUQuXHJcbiAqIEBwYXJhbSB7c3RyaW5nfG51bWJlcn0gcmVzb3VyY2VfaWQgUmVzb3VyY2UgSUQuXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBib29raW5nX2hhc2ggQm9va2luZyBoYXNoLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gYm9va2luZ19mb3JtIEN1c3RvbSBib29raW5nIGZvcm0gbmFtZS5cclxuICogQHJldHVybnMge2Jvb2xlYW58dW5kZWZpbmVkfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fY2xpY2tfX2FkZF9ib29raW5nX21vZGFsX2Zyb21fcm93KCBib29raW5nX2lkLCByZXNvdXJjZV9pZCwgYm9va2luZ19oYXNoLCBib29raW5nX2Zvcm0gKXtcclxuXHJcblx0aWYgKCAhIGJvb2tpbmdfaGFzaCApIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cdHJldHVybiB3cGJjX2Jvb19saXN0aW5nX19jbGlja19fYWRkX2Jvb2tpbmdfbW9kYWwoIHtcclxuXHRcdG1vZGUgICAgICAgICA6ICdlZGl0JyxcclxuXHRcdGJvb2tpbmdfaWQgICA6IGJvb2tpbmdfaWQgfHwgJycsXHJcblx0XHRyZXNvdXJjZV9pZCAgOiByZXNvdXJjZV9pZCB8fCAnJyxcclxuXHRcdGJvb2tpbmdfaGFzaCA6IGJvb2tpbmdfaGFzaCB8fCAnJyxcclxuXHRcdGJvb2tpbmdfZm9ybSA6IGJvb2tpbmdfZm9ybSB8fCAnJ1xyXG5cdH0gKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEluc2VydCBBSkFYLXJlbmRlcmVkIEFkZC9FZGl0IEJvb2tpbmcgSFRNTCBhbmQgcnVuIGl0cyBpbmxpbmUgbGlmZWN5Y2xlIHNjcmlwdHMgb25jZS5cclxuICpcclxuICogQHBhcmFtIHtPYmplY3R9ICRib2R5IE1vZGFsIGJvZHkgalF1ZXJ5IG9iamVjdC5cclxuICogQHBhcmFtIHtzdHJpbmd9IGh0bWwgUmVuZGVyZWQgY29tcG9uZW50IEhUTUwuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19zZXRfYWRkX2Jvb2tpbmdfbW9kYWxfYm9keV9odG1sKCAkYm9keSwgaHRtbCApe1xyXG5cclxuXHR2YXIgJGh0bWwgICAgPSBqUXVlcnkoICc8ZGl2IC8+JyApLmFwcGVuZCggalF1ZXJ5LnBhcnNlSFRNTCggaHRtbCB8fCAnJywgZG9jdW1lbnQsIHRydWUgKSApO1xyXG5cdHZhciAkc2NyaXB0cyA9ICRodG1sLmZpbmQoICdzY3JpcHQnICkucmVtb3ZlKCk7XHJcblxyXG5cdCRib2R5Lmh0bWwoICRodG1sLmNvbnRlbnRzKCkgKTtcclxuXHJcblx0JHNjcmlwdHMuZWFjaCggZnVuY3Rpb24oKXtcclxuXHRcdHZhciB0eXBlID0gKCBqUXVlcnkoIHRoaXMgKS5hdHRyKCAndHlwZScgKSB8fCAnJyApLnRvTG93ZXJDYXNlKCk7XHJcblx0XHR2YXIgc3JjICA9IGpRdWVyeSggdGhpcyApLmF0dHIoICdzcmMnICk7XHJcblx0XHR2YXIgY29kZSA9IHRoaXMudGV4dCB8fCB0aGlzLnRleHRDb250ZW50IHx8IHRoaXMuaW5uZXJIVE1MIHx8ICcnO1xyXG5cclxuXHRcdGlmICggdHlwZSAmJiAhIC9eKHRleHR8YXBwbGljYXRpb24pXFwvKHgtKT9qYXZhc2NyaXB0JC8udGVzdCggdHlwZSApICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBzcmMgKSB7XHJcblx0XHRcdGpRdWVyeS5hamF4KCB7XHJcblx0XHRcdFx0dXJsICAgICAgOiBzcmMsXHJcblx0XHRcdFx0ZGF0YVR5cGUgOiAnc2NyaXB0JyxcclxuXHRcdFx0XHRjYWNoZSAgICA6IHRydWUsXHJcblx0XHRcdFx0YXN5bmMgICAgOiBmYWxzZVxyXG5cdFx0XHR9ICk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIGNvZGUgKSB7XHJcblx0XHRcdGpRdWVyeS5nbG9iYWxFdmFsKCBjb2RlICk7XHJcblx0XHR9XHJcblx0fSApO1xyXG59XHJcblxyXG4vKipcclxuICogR2V0IG1vZGFsIGxvYWRpbmcgc3Bpbm5lciBIVE1MLlxyXG4gKlxyXG4gKiBAcmV0dXJucyB7c3RyaW5nfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fZ2V0X2FkZF9ib29raW5nX21vZGFsX2xvYWRpbmdfaHRtbCgpe1xyXG5cdHJldHVybiAnPGRpdiBjbGFzcz1cIndwYmNfc3BpbnNfbG9hZGluZ19jb250YWluZXJcIj4nXHJcblx0XHQrICc8ZGl2IGNsYXNzPVwid3BiY19ib29raW5nX2Zvcm1fc3Bpbl9sb2FkZXJcIj4nXHJcblx0XHQrICc8ZGl2IGNsYXNzPVwid3BiY19zcGluc19sb2FkZXJfd3JhcHBlclwiPidcclxuXHRcdCsgJzxkaXYgY2xhc3M9XCJ3cGJjX3NwaW5fbG9hZGVyX29uZV9uZXdcIj48L2Rpdj4nXHJcblx0XHQrICc8L2Rpdj4nXHJcblx0XHQrICc8L2Rpdj4nXHJcblx0XHQrICc8c3Bhbj5Mb2FkaW5nLi4uPC9zcGFuPidcclxuXHRcdCsgJzwvZGl2Pic7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBOb3JtYWxpemUgdGltZSBvcHRpb24gdmFsdWVzIGZvciBjb21wYXJpc29uLlxyXG4gKlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gdmFsdWUgVGltZSBvciB0aW1lLXJhbmdlIHZhbHVlLlxyXG4gKiBAcmV0dXJucyB7c3RyaW5nfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fbm9ybWFsaXplX3RpbWVfdmFsdWUoIHZhbHVlICl7XHJcblx0cmV0dXJuIFN0cmluZyggdmFsdWUgfHwgJycgKS5yZXBsYWNlKCAvXFxzKy9nLCAnJyApLnRvTG93ZXJDYXNlKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX3RyaW1fdGV4dCggdmFsdWUgKXtcclxuXHRyZXR1cm4gU3RyaW5nKCB2YWx1ZSB8fCAnJyApLnJlcGxhY2UoIC9eXFxzK3xcXHMrJC9nLCAnJyApO1xyXG59XHJcblxyXG4vKipcclxuICogUGFyc2UgXCJISDpNTSAtIEhIOk1NXCIgc2VsZWN0ZWQgdGltZSBpbnRvIHN0YXJ0L2VuZCB2YWx1ZXMuXHJcbiAqXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBzZWxlY3RlZF90aW1lIFRpbWUgcmFuZ2UuXHJcbiAqIEByZXR1cm5zIHt7c3RhcnRfdGltZTpzdHJpbmcsZW5kX3RpbWU6c3RyaW5nfX1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX3BhcnNlX3NlbGVjdGVkX3RpbWVfcmFuZ2UoIHNlbGVjdGVkX3RpbWUgKXtcclxuXHJcblx0dmFyIHRpbWVfcGFydHMgPSBTdHJpbmcoIHNlbGVjdGVkX3RpbWUgfHwgJycgKS5zcGxpdCggJyAtICcgKTtcclxuXHJcblx0cmV0dXJuIHtcclxuXHRcdHN0YXJ0X3RpbWU6IHdwYmNfYm9vX2xpc3RpbmdfX3RyaW1fdGV4dCggdGltZV9wYXJ0c1swXSApLFxyXG5cdFx0ZW5kX3RpbWU6IHdwYmNfYm9vX2xpc3RpbmdfX3RyaW1fdGV4dCggdGltZV9wYXJ0c1sxXSApXHJcblx0fTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fcGFyc2Vfc2VsZWN0ZWRfZGF0ZXMoIHNlbGVjdGVkX2RhdGVzICl7XHJcblxyXG5cdHZhciBkYXRlcyA9IFtdO1xyXG5cdHZhciBzZWVuID0ge307XHJcblxyXG5cdGlmICggQXJyYXkuaXNBcnJheSggc2VsZWN0ZWRfZGF0ZXMgKSApIHtcclxuXHRcdGRhdGVzID0gc2VsZWN0ZWRfZGF0ZXM7XHJcblx0fSBlbHNlIHtcclxuXHRcdGRhdGVzID0gU3RyaW5nKCBzZWxlY3RlZF9kYXRlcyB8fCAnJyApLnNwbGl0KCAnLCcgKTtcclxuXHR9XHJcblxyXG5cdGRhdGVzID0galF1ZXJ5Lm1hcCggZGF0ZXMsIGZ1bmN0aW9uKCBkYXRlICl7XHJcblx0XHRkYXRlID0gd3BiY19ib29fbGlzdGluZ19fdHJpbV90ZXh0KCBkYXRlICk7XHJcblx0XHRpZiAoICEgZGF0ZSB8fCBzZWVuWyBkYXRlIF0gKSB7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cdFx0c2VlblsgZGF0ZSBdID0gdHJ1ZTtcclxuXHRcdHJldHVybiBkYXRlO1xyXG5cdH0gKTtcclxuXHJcblx0cmV0dXJuIGRhdGVzO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19zZXRfbW9kYWxfZGF5c19zZWxlY3RfbW9kZV9vdmVycmlkZSggcmVzb3VyY2VfaWQsIGlzX2ZvcmNlZCApe1xyXG5cdHZhciAkbW9kYWwgPSBqUXVlcnkoICcjd3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX3NlY3Rpb24nICk7XHJcblx0dmFyIG9yaWdpbmFsVmFsdWU7XHJcblxyXG5cdGlmIChcclxuXHRcdCAgICEgaXNfZm9yY2VkXHJcblx0XHR8fCAhIHJlc291cmNlX2lkXHJcblx0XHR8fCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIF93cGJjXHJcblx0XHR8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZVxyXG5cdFx0fHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWVcclxuXHQpIHtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1vcmlnaW5hbC1kYXlzLXNlbGVjdC1tb2RlJyApICkge1xyXG5cdFx0b3JpZ2luYWxWYWx1ZSA9IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKTtcclxuXHRcdCRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLW9yaWdpbmFsLWRheXMtc2VsZWN0LW1vZGUnLCBTdHJpbmcoIG9yaWdpbmFsVmFsdWUgfHwgJycgKSApO1xyXG5cdFx0JG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctb3JpZ2luYWwtZGF5cy1zZWxlY3QtcmVzb3VyY2UtaWQnLCBTdHJpbmcoIHJlc291cmNlX2lkICkgKTtcclxuXHR9XHJcblxyXG5cdCRtb2RhbC5vZmYoICdoaWRkZW4ud3BiYy5tb2RhbC53cGJjX2FkZF9ib29raW5nX2RheXNfc2VsZWN0X21vZGUgaGlkZGVuLmJzLm1vZGFsLndwYmNfYWRkX2Jvb2tpbmdfZGF5c19zZWxlY3RfbW9kZScgKS5vbihcclxuXHRcdCdoaWRkZW4ud3BiYy5tb2RhbC53cGJjX2FkZF9ib29raW5nX2RheXNfc2VsZWN0X21vZGUgaGlkZGVuLmJzLm1vZGFsLndwYmNfYWRkX2Jvb2tpbmdfZGF5c19zZWxlY3RfbW9kZScsXHJcblx0XHRmdW5jdGlvbigpe1xyXG5cdFx0XHR2YXIgcmVzdG9yZVJlc291cmNlSWQgPSBwYXJzZUludCggJG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctb3JpZ2luYWwtZGF5cy1zZWxlY3QtcmVzb3VyY2UtaWQnICkgfHwgMCwgMTAgKTtcclxuXHRcdFx0dmFyIHJlc3RvcmVWYWx1ZSA9ICRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLW9yaWdpbmFsLWRheXMtc2VsZWN0LW1vZGUnICk7XHJcblxyXG5cdFx0XHRpZiAoXHJcblx0XHRcdFx0ICAgcmVzdG9yZVJlc291cmNlSWRcclxuXHRcdFx0XHQmJiAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHJlc3RvcmVWYWx1ZVxyXG5cdFx0XHRcdCYmICd1bmRlZmluZWQnICE9PSB0eXBlb2YgX3dwYmNcclxuXHRcdFx0XHQmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgX3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZVxyXG5cdFx0XHQpIHtcclxuXHRcdFx0XHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtX3ZhbHVlKCByZXN0b3JlUmVzb3VyY2VJZCwgJ2RheXNfc2VsZWN0X21vZGUnLCByZXN0b3JlVmFsdWUgfHwgJycgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0JG1vZGFsXHJcblx0XHRcdFx0LnJlbW92ZUF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctb3JpZ2luYWwtZGF5cy1zZWxlY3QtbW9kZScgKVxyXG5cdFx0XHRcdC5yZW1vdmVBdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLW9yaWdpbmFsLWRheXMtc2VsZWN0LXJlc291cmNlLWlkJyApO1xyXG5cdFx0fVxyXG5cdCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX3ltZF90b19kZG1teXl5eSggeW1kX2RhdGUgKXtcclxuXHR2YXIgZGF0ZVBhcnRzID0gU3RyaW5nKCB5bWRfZGF0ZSB8fCAnJyApLnNwbGl0KCAnLScgKTtcclxuXHJcblx0aWYgKCAzICE9PSBkYXRlUGFydHMubGVuZ3RoICkge1xyXG5cdFx0cmV0dXJuICcnO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIGRhdGVQYXJ0c1syXSArICcuJyArIGRhdGVQYXJ0c1sxXSArICcuJyArIGRhdGVQYXJ0c1swXTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fc3luY19zZWxlY3RlZF9kYXRlc190b19ib29raW5nX2Zvcm0oIHJlc291cmNlX2lkLCBzZWxlY3RlZF9kYXRlcyApe1xyXG5cdHZhciBmb3JtYXR0ZWRfZGF0ZXMgPSBqUXVlcnkubWFwKCBzZWxlY3RlZF9kYXRlcywgZnVuY3Rpb24oIGRhdGUgKXtcclxuXHRcdHJldHVybiB3cGJjX2Jvb19saXN0aW5nX195bWRfdG9fZGRtbXl5eXkoIGRhdGUgKTtcclxuXHR9ICk7XHJcblx0dmFyIGRhdGVWYWx1ZSA9IGZvcm1hdHRlZF9kYXRlcy5qb2luKCAnLCAnICk7XHJcblxyXG5cdGpRdWVyeSggJyNkYXRlX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS52YWwoIGRhdGVWYWx1ZSApO1xyXG5cclxuXHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3cGJjX2Rpc2FibGVfdGltZV9maWVsZHNfaW5fYm9va2luZ19mb3JtICkge1xyXG5cdFx0d3BiY19kaXNhYmxlX3RpbWVfZmllbGRzX2luX2Jvb2tpbmdfZm9ybSggcmVzb3VyY2VfaWQgKTtcclxuXHR9XHJcblxyXG5cdGpRdWVyeSggJy5ib29raW5nX2Zvcm1fZGl2JyApLnRyaWdnZXIoICdkYXRlX3NlbGVjdGVkJywgWyByZXNvdXJjZV9pZCwgZGF0ZVZhbHVlLCBzZWxlY3RlZF9kYXRlcyBdICk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX2F1dG9fc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyKCByZXNvdXJjZV9pZCwgc2VsZWN0ZWRfZGF0ZXMsIGlzX2ZvcmNlX211bHRpcGxlICl7XHJcblx0dmFyIGF0dGVtcHRzID0gMDtcclxuXHR2YXIgbWF4QXR0ZW1wdHMgPSAxMDtcclxuXHR2YXIgZXZlbnROYW1lID0gJ3dwYmNfY2FsZW5kYXJfYWp4X19sb2FkZWRfZGF0YS53cGJjX2FkZF9ib29raW5nX21vZGFsX2RhdGUnO1xyXG5cdHZhciBhcHBseVNlbGVjdGlvbjtcclxuXHJcblx0aWYgKFxyXG5cdFx0ICAgISBzZWxlY3RlZF9kYXRlcy5sZW5ndGhcclxuXHRcdHx8ICggJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdwYmNfYXV0b19zZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXIgKVxyXG5cdCkge1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0YXBwbHlTZWxlY3Rpb24gPSBmdW5jdGlvbigpe1xyXG5cdFx0dmFyIHNlbGVjdGVkQ291bnQ7XHJcblxyXG5cdFx0YXR0ZW1wdHMrKztcclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgIGlzX2ZvcmNlX211bHRpcGxlXHJcblx0XHRcdCYmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBfd3BiYyApXHJcblx0XHRcdCYmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUgKVxyXG5cdFx0XHQmJiAoICdtdWx0aXBsZScgIT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSApXHJcblx0XHQpIHtcclxuXHRcdFx0d3BiY19ib29fbGlzdGluZ19fc2V0X21vZGFsX2RheXNfc2VsZWN0X21vZGVfb3ZlcnJpZGUoIHJlc291cmNlX2lkLCB0cnVlICk7XHJcblx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUgKSB7XHJcblx0XHRcdFx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJywgJ211bHRpcGxlJyApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0c2VsZWN0ZWRDb3VudCA9IHdwYmNfYXV0b19zZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXIoIHJlc291cmNlX2lkLCBzZWxlY3RlZF9kYXRlcyApO1xyXG5cdFx0aWYgKCBzZWxlY3RlZENvdW50ID49IHNlbGVjdGVkX2RhdGVzLmxlbmd0aCApIHtcclxuXHRcdFx0d3BiY19ib29fbGlzdGluZ19fc3luY19zZWxlY3RlZF9kYXRlc190b19ib29raW5nX2Zvcm0oIHJlc291cmNlX2lkLCBzZWxlY3RlZF9kYXRlcyApO1xyXG5cdFx0XHRqUXVlcnkoICdib2R5JyApLm9mZiggZXZlbnROYW1lICk7XHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9O1xyXG5cclxuXHRqUXVlcnkoICdib2R5JyApLm9mZiggZXZlbnROYW1lICkub24oIGV2ZW50TmFtZSwgZnVuY3Rpb24oIGV2ZW50LCBsb2FkZWRfcmVzb3VyY2VfaWQgKXtcclxuXHRcdGlmICggcGFyc2VJbnQoIGxvYWRlZF9yZXNvdXJjZV9pZCwgMTAgKSA9PT0gcmVzb3VyY2VfaWQgKSB7XHJcblx0XHRcdGFwcGx5U2VsZWN0aW9uKCk7XHJcblx0XHR9XHJcblx0fSApO1xyXG5cclxuXHR3aW5kb3cuc2V0VGltZW91dCggZnVuY3Rpb24gcmV0cnlTZWxlY3Rpb24oKXtcclxuXHRcdGlmICggYXBwbHlTZWxlY3Rpb24oKSApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCBhdHRlbXB0cyA8IG1heEF0dGVtcHRzICkge1xyXG5cdFx0XHR3aW5kb3cuc2V0VGltZW91dCggcmV0cnlTZWxlY3Rpb24sIDMwMCApO1xyXG5cdFx0fVxyXG5cdH0sIDMwMCApO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19zaG91bGRfZm9yY2VfcmVjdXJyZW50X3RpbWUoIGRhdGEsIHNlbGVjdGVkX2RhdGVzICl7XHJcblx0cmV0dXJuIChcclxuXHRcdCAgIGRhdGFcclxuXHRcdCYmICggc2VsZWN0ZWRfZGF0ZXMgfHwgW10gKS5sZW5ndGggPiAxXHJcblx0XHQmJiAhISBwYXJzZUludCggZGF0YS50aW1lX292ZXJyaWRlX2VuYWJsZWQgfHwgMCwgMTAgKVxyXG5cdFx0JiYgJ3RpbWVzX2F2YWlsYWJpbGl0eScgPT09IFN0cmluZyggZGF0YS50aW1lX292ZXJyaWRlX3NvdXJjZSB8fCAnJyApXHJcblx0KTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fc2V0X21vZGFsX3JlY3VycmVudF90aW1lX292ZXJyaWRlKCByZXNvdXJjZV9pZCwgaXNfZm9yY2VkICl7XHJcblx0dmFyICRtb2RhbCA9IGpRdWVyeSggJyN3cGJjX21vZGFsX19hZGRfYm9va2luZ19fc2VjdGlvbicgKTtcclxuXHR2YXIgb3JpZ2luYWxWYWx1ZTtcclxuXHJcblx0JG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctZm9yY2UtcmVjdXJyZW50LXRpbWUnLCBpc19mb3JjZWQgPyAnMScgOiAnMCcgKTtcclxuXHJcblx0aWYgKFxyXG5cdFx0ICAgISBpc19mb3JjZWRcclxuXHRcdHx8ICEgcmVzb3VyY2VfaWRcclxuXHRcdHx8ICd1bmRlZmluZWQnID09PSB0eXBlb2YgX3dwYmNcclxuXHRcdHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlXHJcblx0XHR8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgX3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZVxyXG5cdCkge1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mICRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLW9yaWdpbmFsLXJlY3VycmVudC10aW1lJyApICkge1xyXG5cdFx0b3JpZ2luYWxWYWx1ZSA9IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnYm9va2luZ19yZWN1cnJlbnRfdGltZScgKTtcclxuXHRcdCRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLW9yaWdpbmFsLXJlY3VycmVudC10aW1lJywgU3RyaW5nKCBvcmlnaW5hbFZhbHVlIHx8ICcnICkgKTtcclxuXHRcdCRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLW9yaWdpbmFsLXJlY3VycmVudC1yZXNvdXJjZS1pZCcsIFN0cmluZyggcmVzb3VyY2VfaWQgKSApO1xyXG5cdH1cclxuXHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdib29raW5nX3JlY3VycmVudF90aW1lJywgJ09uJyApO1xyXG5cclxuXHQkbW9kYWwub2ZmKCAnaGlkZGVuLndwYmMubW9kYWwud3BiY19hZGRfYm9va2luZ19yZWN1cnJlbnRfdGltZSBoaWRkZW4uYnMubW9kYWwud3BiY19hZGRfYm9va2luZ19yZWN1cnJlbnRfdGltZScgKS5vbihcclxuXHRcdCdoaWRkZW4ud3BiYy5tb2RhbC53cGJjX2FkZF9ib29raW5nX3JlY3VycmVudF90aW1lIGhpZGRlbi5icy5tb2RhbC53cGJjX2FkZF9ib29raW5nX3JlY3VycmVudF90aW1lJyxcclxuXHRcdGZ1bmN0aW9uKCl7XHJcblx0XHRcdHZhciByZXN0b3JlUmVzb3VyY2VJZCA9IHBhcnNlSW50KCAkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1vcmlnaW5hbC1yZWN1cnJlbnQtcmVzb3VyY2UtaWQnICkgfHwgMCwgMTAgKTtcclxuXHRcdFx0dmFyIHJlc3RvcmVWYWx1ZSA9ICRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLW9yaWdpbmFsLXJlY3VycmVudC10aW1lJyApO1xyXG5cclxuXHRcdFx0aWYgKFxyXG5cdFx0XHRcdCAgIHJlc3RvcmVSZXNvdXJjZUlkXHJcblx0XHRcdFx0JiYgJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiByZXN0b3JlVmFsdWVcclxuXHRcdFx0XHQmJiAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIF93cGJjXHJcblx0XHRcdFx0JiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWVcclxuXHRcdFx0KSB7XHJcblx0XHRcdFx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSggcmVzdG9yZVJlc291cmNlSWQsICdib29raW5nX3JlY3VycmVudF90aW1lJywgcmVzdG9yZVZhbHVlIHx8ICdPZmYnICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdCRtb2RhbFxyXG5cdFx0XHRcdC5yZW1vdmVBdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLW9yaWdpbmFsLXJlY3VycmVudC10aW1lJyApXHJcblx0XHRcdFx0LnJlbW92ZUF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctb3JpZ2luYWwtcmVjdXJyZW50LXJlc291cmNlLWlkJyApXHJcblx0XHRcdFx0LmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctZm9yY2UtcmVjdXJyZW50LXRpbWUnLCAnMCcgKTtcclxuXHRcdH1cclxuXHQpO1xyXG59XHJcblxyXG4vKipcclxuICogR2V0IGJvb2tpbmcgZm9ybSB0aW1lIGZpZWxkcyB0aGF0IGNhbiBjb25mbGljdCB3aXRoIGEgdGltZWxpbmUgb3ZlcnJpZGUuXHJcbiAqXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSAkZm9ybSBCb29raW5nIGZvcm0galF1ZXJ5IG9iamVjdC5cclxuICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkIEJvb2tpbmcgcmVzb3VyY2UgSUQuXHJcbiAqIEByZXR1cm5zIHtPYmplY3R9IGpRdWVyeSBjb2xsZWN0aW9uLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fZ2V0X2FkZF9ib29raW5nX21vZGFsX3RpbWVfZmllbGRzKCAkZm9ybSwgcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0dmFyIHNlbGVjdG9yID0gW1xyXG5cdFx0J3NlbGVjdFtuYW1lPVwicmFuZ2V0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHQnc2VsZWN0W25hbWU9XCJyYW5nZXRpbWUnICsgcmVzb3VyY2VfaWQgKyAnW11cIl0nLFxyXG5cdFx0J3NlbGVjdFtuYW1lPVwic3RhcnR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHQnc2VsZWN0W25hbWU9XCJzdGFydHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnW11cIl0nLFxyXG5cdFx0J3NlbGVjdFtuYW1lPVwiZW5kdGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nLFxyXG5cdFx0J3NlbGVjdFtuYW1lPVwiZW5kdGltZScgKyByZXNvdXJjZV9pZCArICdbXVwiXScsXHJcblx0XHQnc2VsZWN0W25hbWU9XCJkdXJhdGlvbnRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdJyxcclxuXHRcdCdzZWxlY3RbbmFtZT1cImR1cmF0aW9udGltZScgKyByZXNvdXJjZV9pZCArICdbXVwiXScsXHJcblx0XHQnaW5wdXRbbmFtZT1cInN0YXJ0dGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nLFxyXG5cdFx0J2lucHV0W25hbWU9XCJlbmR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXSdcclxuXHRdLmpvaW4oICcsICcgKTtcclxuXHJcblx0cmV0dXJuICRmb3JtLmZpbmQoIHNlbGVjdG9yICkuZmlsdGVyKCBmdW5jdGlvbigpe1xyXG5cdFx0dmFyICRmaWVsZCA9IGpRdWVyeSggdGhpcyApO1xyXG5cclxuXHRcdGlmICggJGZpZWxkLmNsb3Nlc3QoICcud3BiY19hZGRfYm9va2luZ19tb2RhbF9fc2VsZWN0ZWRfdGltZV9maWVsZHMnICkubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAnaW5wdXQnID09PSB0aGlzLnRhZ05hbWUudG9Mb3dlckNhc2UoKSAmJiAnaGlkZGVuJyA9PT0gU3RyaW5nKCAkZmllbGQuYXR0ciggJ3R5cGUnICkgfHwgJycgKS50b0xvd2VyQ2FzZSgpICkge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fSApO1xyXG59XHJcblxyXG4vKipcclxuICogU2VsZWN0IG1hdGNoaW5nIG9wdGlvbiBpbiBhIHRpbWUgc2VsZWN0IHdpdGhvdXQgZm9yY2luZyBkaXNhYmxlZCBjaG9pY2VzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge09iamVjdH0gJHNlbGVjdCBTZWxlY3QgZWxlbWVudC5cclxuICogQHBhcmFtIHtBcnJheX0gZXhwZWN0ZWRfdmFsdWVzIEFjY2VwdGFibGUgdmFsdWVzLlxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX3NlbGVjdF90aW1lX29wdGlvbiggJHNlbGVjdCwgZXhwZWN0ZWRfdmFsdWVzICl7XHJcblxyXG5cdHZhciBkaWRfc2VsZWN0ID0gZmFsc2U7XHJcblx0dmFyIG5vcm1hbGl6ZWRfZXhwZWN0ZWQgPSBbXTtcclxuXHJcblx0alF1ZXJ5LmVhY2goIGV4cGVjdGVkX3ZhbHVlcywgZnVuY3Rpb24oIGluZGV4LCB2YWx1ZSApe1xyXG5cdFx0bm9ybWFsaXplZF9leHBlY3RlZC5wdXNoKCB3cGJjX2Jvb19saXN0aW5nX19ub3JtYWxpemVfdGltZV92YWx1ZSggdmFsdWUgKSApO1xyXG5cdH0gKTtcclxuXHJcblx0JHNlbGVjdC5maW5kKCAnb3B0aW9uJyApLmVhY2goIGZ1bmN0aW9uKCl7XHJcblx0XHR2YXIgJG9wdGlvbiA9IGpRdWVyeSggdGhpcyApO1xyXG5cdFx0dmFyIG9wdGlvbl92YWx1ZSA9IHdwYmNfYm9vX2xpc3RpbmdfX25vcm1hbGl6ZV90aW1lX3ZhbHVlKCAkb3B0aW9uLnZhbCgpICk7XHJcblxyXG5cdFx0aWYgKCAtMSA9PT0galF1ZXJ5LmluQXJyYXkoIG9wdGlvbl92YWx1ZSwgbm9ybWFsaXplZF9leHBlY3RlZCApIHx8ICRvcHRpb24ucHJvcCggJ2Rpc2FibGVkJyApICkge1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICRzZWxlY3QucHJvcCggJ211bHRpcGxlJyApICkge1xyXG5cdFx0XHQkb3B0aW9uLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdCRzZWxlY3QudmFsKCAkb3B0aW9uLnZhbCgpICk7XHJcblx0XHR9XHJcblxyXG5cdFx0JHNlbGVjdC50cmlnZ2VyKCAnY2hhbmdlJyApO1xyXG5cdFx0ZGlkX3NlbGVjdCA9IHRydWU7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fSApO1xyXG5cclxuXHRyZXR1cm4gZGlkX3NlbGVjdDtcclxufVxyXG5cclxuLyoqXHJcbiAqIENoZWNrIHdoZXRoZXIgdGhlIHJlbmRlcmVkIGJvb2tpbmcgZm9ybSBhbHJlYWR5IGhhcyB1c2VyLWZhY2luZyB0aW1lIGZpZWxkcy5cclxuICpcclxuICogQHBhcmFtIHtPYmplY3R9ICRmb3JtIEJvb2tpbmcgZm9ybSBqUXVlcnkgb2JqZWN0LlxyXG4gKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWQgQm9va2luZyByZXNvdXJjZSBJRC5cclxuICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19oYXNfYWRkX2Jvb2tpbmdfbW9kYWxfdGltZV9maWVsZHMoICRmb3JtLCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRyZXR1cm4gd3BiY19ib29fbGlzdGluZ19fZ2V0X2FkZF9ib29raW5nX21vZGFsX3RpbWVfZmllbGRzKCAkZm9ybSwgcmVzb3VyY2VfaWQgKS5sZW5ndGggPiAwO1xyXG59XHJcblxyXG4vKipcclxuICogQWRkIHZpc2libGUgcmVhZC1vbmx5IHN0YXJ0L2VuZCB0aW1lIGZpZWxkcyB3aGVuIHRoZSBzZWxlY3RlZCBib29raW5nIGZvcm0gaGFzIG5vIHRpbWUgY29udHJvbHMuXHJcbiAqXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSAkZm9ybSBCb29raW5nIGZvcm0galF1ZXJ5IG9iamVjdC5cclxuICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkIEJvb2tpbmcgcmVzb3VyY2UgSUQuXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBzdGFydF90aW1lIFN0YXJ0IHRpbWUgaW4gMjRoIGZvcm1hdC5cclxuICogQHBhcmFtIHtzdHJpbmd9IGVuZF90aW1lIEVuZCB0aW1lIGluIDI0aCBmb3JtYXQuXHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fZW5zdXJlX2FkZF9ib29raW5nX21vZGFsX3NlbGVjdGVkX3RpbWVfZmllbGRzKCAkZm9ybSwgcmVzb3VyY2VfaWQsIHN0YXJ0X3RpbWUsIGVuZF90aW1lICl7XHJcblxyXG5cdHZhciAkd3JhcCA9ICRmb3JtLmZpbmQoICcud3BiY19hZGRfYm9va2luZ19tb2RhbF9fc2VsZWN0ZWRfdGltZV9maWVsZHMnICk7XHJcblx0dmFyIGh0bWw7XHJcblx0dmFyICRpbnNlcnRfYmVmb3JlO1xyXG5cclxuXHRpZiAoICEgc3RhcnRfdGltZSB8fCAhIGVuZF90aW1lICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0aWYgKCAhICR3cmFwLmxlbmd0aCApIHtcclxuXHRcdGh0bWwgPSAnPGRpdiBjbGFzcz1cIndwYmNfYWRkX2Jvb2tpbmdfbW9kYWxfX3NlbGVjdGVkX3RpbWVfZmllbGRzXCIgc3R5bGU9XCJtYXJnaW46MTJweCAwO3BhZGRpbmc6MTJweDtib3JkZXI6MXB4IHNvbGlkICNkY2RjZGU7YmFja2dyb3VuZDojZjZmN2Y3O2JvcmRlci1yYWRpdXM6NHB4O1wiPidcclxuXHRcdFx0KyAnPGRpdiBzdHlsZT1cImZvbnQtd2VpZ2h0OjYwMDttYXJnaW4tYm90dG9tOjhweDtcIj5TZWxlY3RlZCB0aW1lbGluZSBpbnRlcnZhbDwvZGl2PidcclxuXHRcdFx0KyAnPGRpdiBzdHlsZT1cImRpc3BsYXk6ZmxleDtnYXA6MTBweDtmbGV4LXdyYXA6d3JhcDthbGlnbi1pdGVtczpmbGV4LWVuZDtcIj4nXHJcblx0XHRcdCsgJzxsYWJlbCBzdHlsZT1cImRpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47Z2FwOjRweDttaW4td2lkdGg6MTIwcHg7XCI+J1xyXG5cdFx0XHQrICc8c3Bhbj5TdGFydCB0aW1lPC9zcGFuPidcclxuXHRcdFx0KyAnPGlucHV0IHR5cGU9XCJ0ZXh0XCIgY2xhc3M9XCJ3cGJjX3VpX2NvbnRyb2wgd3BiY191aV90ZXh0XCIgbmFtZT1cInN0YXJ0dGltZScgKyByZXNvdXJjZV9pZCArICdcIiB2YWx1ZT1cIlwiIHJlYWRvbmx5PVwicmVhZG9ubHlcIiAvPidcclxuXHRcdFx0KyAnPC9sYWJlbD4nXHJcblx0XHRcdCsgJzxsYWJlbCBzdHlsZT1cImRpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47Z2FwOjRweDttaW4td2lkdGg6MTIwcHg7XCI+J1xyXG5cdFx0XHQrICc8c3Bhbj5FbmQgdGltZTwvc3Bhbj4nXHJcblx0XHRcdCsgJzxpbnB1dCB0eXBlPVwidGV4dFwiIGNsYXNzPVwid3BiY191aV9jb250cm9sIHdwYmNfdWlfdGV4dFwiIG5hbWU9XCJlbmR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiIHZhbHVlPVwiXCIgcmVhZG9ubHk9XCJyZWFkb25seVwiIC8+J1xyXG5cdFx0XHQrICc8L2xhYmVsPidcclxuXHRcdFx0KyAnPC9kaXY+J1xyXG5cdFx0XHQrICc8L2Rpdj4nO1xyXG5cclxuXHRcdCR3cmFwID0galF1ZXJ5KCBodG1sICk7XHJcblx0XHQkaW5zZXJ0X2JlZm9yZSA9ICRmb3JtLmZpbmQoICcjYmtfdHlwZScgKyByZXNvdXJjZV9pZCApLmZpcnN0KCk7XHJcblxyXG5cdFx0aWYgKCAkaW5zZXJ0X2JlZm9yZS5sZW5ndGggKSB7XHJcblx0XHRcdCRpbnNlcnRfYmVmb3JlLmJlZm9yZSggJHdyYXAgKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdCRmb3JtLmZpbmQoICcjYm9va2luZ19mb3JtX2RpdicgKyByZXNvdXJjZV9pZCApLmFwcGVuZCggJHdyYXAgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdCR3cmFwLmZpbmQoICdpbnB1dFtuYW1lPVwic3RhcnR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScgKS52YWwoIHN0YXJ0X3RpbWUgKS50cmlnZ2VyKCAnaW5wdXQnICkudHJpZ2dlciggJ2NoYW5nZScgKTtcclxuXHQkd3JhcC5maW5kKCAnaW5wdXRbbmFtZT1cImVuZHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdJyApLnZhbCggZW5kX3RpbWUgKS50cmlnZ2VyKCAnaW5wdXQnICkudHJpZ2dlciggJ2NoYW5nZScgKTtcclxuXHJcblx0cmV0dXJuIHRydWU7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBZGQvdXBkYXRlIHRoZSBleHBsaWNpdCB0aW1lbGluZSBpbnRlcnZhbCBvdmVycmlkZSBwYW5lbC5cclxuICpcclxuICogQHBhcmFtIHtPYmplY3R9ICRmb3JtIEJvb2tpbmcgZm9ybSBqUXVlcnkgb2JqZWN0LlxyXG4gKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWQgQm9va2luZyByZXNvdXJjZSBJRC5cclxuICogQHBhcmFtIHtPYmplY3R9IGRhdGEgTW9kYWwgY29udGV4dC5cclxuICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19lbnN1cmVfYWRkX2Jvb2tpbmdfbW9kYWxfdGltZV9vdmVycmlkZV9wYW5lbCggJGZvcm0sIHJlc291cmNlX2lkLCBkYXRhICl7XHJcblxyXG5cdHZhciBzZWxlY3RlZF90aW1lID0gKCBkYXRhICYmIGRhdGEuc2VsZWN0ZWRfdGltZSApID8gZGF0YS5zZWxlY3RlZF90aW1lIDogJyc7XHJcblx0dmFyIHBhcnNlZF90aW1lID0gd3BiY19ib29fbGlzdGluZ19fcGFyc2Vfc2VsZWN0ZWRfdGltZV9yYW5nZSggc2VsZWN0ZWRfdGltZSApO1xyXG5cdHZhciBzdGFydF90aW1lID0gKCBkYXRhICYmIGRhdGEudGltZV9vdmVycmlkZV9zdGFydCApID8gZGF0YS50aW1lX292ZXJyaWRlX3N0YXJ0IDogcGFyc2VkX3RpbWUuc3RhcnRfdGltZTtcclxuXHR2YXIgZW5kX3RpbWUgPSAoIGRhdGEgJiYgZGF0YS50aW1lX292ZXJyaWRlX2VuZCApID8gZGF0YS50aW1lX292ZXJyaWRlX2VuZCA6IHBhcnNlZF90aW1lLmVuZF90aW1lO1xyXG5cdHZhciAkbW9kYWwgPSBqUXVlcnkoICcjd3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX3NlY3Rpb24nICk7XHJcblx0dmFyICRmb290ZXJfc2xvdCA9ICRtb2RhbC5maW5kKCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLWZvb3Rlcl0nICkuZmlyc3QoKTtcclxuXHR2YXIgdG9nZ2xlX2lkID0gJ3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX190aW1lX292ZXJyaWRlX2VuYWJsZWQnO1xyXG5cdHZhciAkd3JhcCA9ICRtb2RhbC5maW5kKCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLXBhbmVsXScgKS5maXJzdCgpO1xyXG5cdHZhciBodG1sO1xyXG5cclxuXHRpZiAoICEgc3RhcnRfdGltZSB8fCAhIGVuZF90aW1lICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0aWYgKCAhICR3cmFwLmxlbmd0aCApIHtcclxuXHRcdGh0bWwgPSAnPGRpdiBjbGFzcz1cIndwYmNfYWRkX2Jvb2tpbmdfbW9kYWxfX3NlbGVjdGVkX3RpbWVfZmllbGRzIHdwYmNfYWRkX2Jvb2tpbmdfbW9kYWxfX3RpbWVfb3ZlcnJpZGVcIiBkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1wYW5lbD1cIjFcIj4nXHJcblx0XHRcdCsgJzxzcGFuIGNsYXNzPVwid3BiY191aV9fdG9nZ2xlIHdwYmNfYWRkX2Jvb2tpbmdfbW9kYWxfX3RpbWVfb3ZlcnJpZGVfdG9nZ2xlXCI+J1xyXG5cdFx0XHQrICc8aW5wdXQgdHlwZT1cImNoZWNrYm94XCIgaWQ9XCInICsgdG9nZ2xlX2lkICsgJ1wiIHZhbHVlPVwiMVwiIGNsYXNzPVwid3BiY191aV9jaGVja2JveFwiIGRhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLWVuYWJsZWQ9XCIxXCIgZGF0YS13cGJjLWJvb2tpbmctc3VibWl0LWlnbm9yZT1cIjFcIiBjaGVja2VkPVwiY2hlY2tlZFwiIGF1dG9jb21wbGV0ZT1cIm9mZlwiIC8+J1xyXG5cdFx0XHQrICc8bGFiZWwgY2xhc3M9XCJ3cGJjX3VpX190b2dnbGVfaWNvbiB0b29sdGlwX3RvcFwiIGZvcj1cIicgKyB0b2dnbGVfaWQgKyAnXCIgZGF0YS1vcmlnaW5hbC10aXRsZT1cIlVzZSBzZWxlY3RlZCB0aW1lbGluZSBpbnRlcnZhbFwiPjwvbGFiZWw+J1xyXG5cdFx0XHQrICc8bGFiZWwgZm9yPVwiJyArIHRvZ2dsZV9pZCArICdcIiBjbGFzcz1cIndwYmNfdWlfY29udHJvbF9sYWJlbCB3cGJjX3VpX190b2dnbGVfbGFiZWxcIj5Vc2Ugc2VsZWN0ZWQgdGltZWxpbmUgaW50ZXJ2YWw8L2xhYmVsPidcclxuXHRcdFx0KyAnPGkgY2xhc3M9XCJ3cGJjX2hlbHBfdG9vbHRpcFwiPjwvaT4nXHJcblx0XHRcdCsgJzwvc3Bhbj4nXHJcblx0XHRcdCsgJzxkaXYgY2xhc3M9XCJ3cGJjX2FkZF9ib29raW5nX21vZGFsX190aW1lX292ZXJyaWRlX2ZpZWxkc1wiPidcclxuXHRcdFx0KyAnPGxhYmVsPjxzcGFuPlN0YXJ0IHRpbWU8L3NwYW4+PGlucHV0IHR5cGU9XCJ0ZXh0XCIgY2xhc3M9XCJ3cGJjX3VpX2NvbnRyb2wgd3BiY191aV90ZXh0XCIgbmFtZT1cInN0YXJ0dGltZScgKyByZXNvdXJjZV9pZCArICdcIiB2YWx1ZT1cIlwiIHJlYWRvbmx5PVwicmVhZG9ubHlcIiBkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1maWVsZD1cInN0YXJ0XCIgLz48L2xhYmVsPidcclxuXHRcdFx0KyAnPGxhYmVsPjxzcGFuPkVuZCB0aW1lPC9zcGFuPjxpbnB1dCB0eXBlPVwidGV4dFwiIGNsYXNzPVwid3BiY191aV9jb250cm9sIHdwYmNfdWlfdGV4dFwiIG5hbWU9XCJlbmR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiIHZhbHVlPVwiXCIgcmVhZG9ubHk9XCJyZWFkb25seVwiIGRhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLWZpZWxkPVwiZW5kXCIgLz48L2xhYmVsPidcclxuXHRcdFx0KyAnPC9kaXY+J1xyXG5cdFx0XHQrICc8ZGl2IGNsYXNzPVwid3BiY19hZGRfYm9va2luZ19tb2RhbF9fdGltZV9vdmVycmlkZV9ub3RlXCI+Rm9ybSB0aW1lIGZpZWxkcyBhcmUgaWdub3JlZCB3aGlsZSBlbmFibGVkLjwvZGl2PidcclxuXHRcdFx0KyAnPC9kaXY+JztcclxuXHJcblx0XHQkd3JhcCA9IGpRdWVyeSggaHRtbCApO1xyXG5cclxuXHRcdGlmICggJGZvb3Rlcl9zbG90Lmxlbmd0aCApIHtcclxuXHRcdFx0JGZvb3Rlcl9zbG90Lmh0bWwoICR3cmFwICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHQkbW9kYWwuZmluZCggJy5tb2RhbC1mb290ZXInICkucHJlcGVuZCggJHdyYXAgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdCR3cmFwLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1zb3VyY2UnLCAoIGRhdGEgJiYgZGF0YS50aW1lX292ZXJyaWRlX3NvdXJjZSApID8gZGF0YS50aW1lX292ZXJyaWRlX3NvdXJjZSA6ICcnICk7XHJcblx0JHdyYXAuZmluZCggJ1tkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1maWVsZD1cInN0YXJ0XCJdJyApLmF0dHIoICduYW1lJywgJ3N0YXJ0dGltZScgKyByZXNvdXJjZV9pZCApLnZhbCggc3RhcnRfdGltZSApLnRyaWdnZXIoICdpbnB1dCcgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xyXG5cdCR3cmFwLmZpbmQoICdbZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtZmllbGQ9XCJlbmRcIl0nICkuYXR0ciggJ25hbWUnLCAnZW5kdGltZScgKyByZXNvdXJjZV9pZCApLnZhbCggZW5kX3RpbWUgKS50cmlnZ2VyKCAnaW5wdXQnICkudHJpZ2dlciggJ2NoYW5nZScgKTtcclxuXHQkd3JhcC5maW5kKCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLWVuYWJsZWRdJyApLnByb3AoICdjaGVja2VkJywgISBkYXRhIHx8ICggJzAnICE9PSBTdHJpbmcoIGRhdGEudGltZV9vdmVycmlkZV9lbmFibGVkIHx8ICcxJyApICkgKTtcclxuXHJcblx0d3BiY19ib29fbGlzdGluZ19fYXBwbHlfYWRkX2Jvb2tpbmdfbW9kYWxfdGltZV9vdmVycmlkZV9zdGF0ZSggJGZvcm0sIHJlc291cmNlX2lkICk7XHJcblxyXG5cdHJldHVybiB0cnVlO1xyXG59XHJcblxyXG4vKipcclxuICogRW5hYmxlL2Rpc2FibGUgdGhlIHRpbWVsaW5lIGludGVydmFsIG92ZXJyaWRlIGFuZCBtYXJrIGNvbmZsaWN0aW5nIGZvcm0gZmllbGRzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge09iamVjdH0gJGZvcm0gQm9va2luZyBmb3JtIGpRdWVyeSBvYmplY3QuXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCBCb29raW5nIHJlc291cmNlIElELlxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX2FwcGx5X2FkZF9ib29raW5nX21vZGFsX3RpbWVfb3ZlcnJpZGVfc3RhdGUoICRmb3JtLCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHR2YXIgJG1vZGFsID0galF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19zZWN0aW9uJyApO1xyXG5cdHZhciAkd3JhcCA9ICRtb2RhbC5maW5kKCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLXBhbmVsXScgKS5maXJzdCgpO1xyXG5cdHZhciAkZW5hYmxlZCA9ICR3cmFwLmZpbmQoICdbZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtZW5hYmxlZF0nICkuZmlyc3QoKTtcclxuXHR2YXIgaXNfZW5hYmxlZCA9ICRlbmFibGVkLmxlbmd0aCA/ICRlbmFibGVkLmlzKCAnOmNoZWNrZWQnICkgOiBmYWxzZTtcclxuXHR2YXIgJG92ZXJyaWRlX2ZpZWxkcyA9ICR3cmFwLmZpbmQoICdbZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtZmllbGRdJyApO1xyXG5cdHZhciAkZm9ybV90aW1lX2ZpZWxkcyA9IHdwYmNfYm9vX2xpc3RpbmdfX2dldF9hZGRfYm9va2luZ19tb2RhbF90aW1lX2ZpZWxkcyggJGZvcm0sIHJlc291cmNlX2lkICk7XHJcblxyXG5cdGlmICggISAkd3JhcC5sZW5ndGggKSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHQkd3JhcC50b2dnbGVDbGFzcyggJ2lzLWVuYWJsZWQnLCBpc19lbmFibGVkICk7XHJcblx0JG92ZXJyaWRlX2ZpZWxkcy5hdHRyKCAnZGF0YS13cGJjLWJvb2tpbmctc3VibWl0LWlnbm9yZScsIGlzX2VuYWJsZWQgPyAnMCcgOiAnMScgKTtcclxuXHJcblx0JGZvcm1fdGltZV9maWVsZHMuZWFjaCggZnVuY3Rpb24oKXtcclxuXHRcdHZhciAkZmllbGQgPSBqUXVlcnkoIHRoaXMgKTtcclxuXHJcblx0XHRpZiAoIGlzX2VuYWJsZWQgKSB7XHJcblx0XHRcdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAkZmllbGQuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLW9yaWdpbmFsLWRpc2FibGVkJyApICkge1xyXG5cdFx0XHRcdCRmaWVsZC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtb3JpZ2luYWwtZGlzYWJsZWQnLCAkZmllbGQucHJvcCggJ2Rpc2FibGVkJyApID8gJzEnIDogJzAnICk7XHJcblx0XHRcdH1cclxuXHRcdFx0JGZpZWxkXHJcblx0XHRcdFx0LmF0dHIoICdkYXRhLXdwYmMtYm9va2luZy1zdWJtaXQtaWdub3JlJywgJzEnIClcclxuXHRcdFx0XHQucHJvcCggJ2Rpc2FibGVkJywgdHJ1ZSApXHJcblx0XHRcdFx0LmFkZENsYXNzKCAnd3BiY19hZGRfYm9va2luZ19tb2RhbF9fdGltZV9maWVsZF9vdmVycmlkZGVuJyApO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0JGZpZWxkXHJcblx0XHRcdFx0LnJlbW92ZUF0dHIoICdkYXRhLXdwYmMtYm9va2luZy1zdWJtaXQtaWdub3JlJyApXHJcblx0XHRcdFx0LnByb3AoICdkaXNhYmxlZCcsICcxJyA9PT0gJGZpZWxkLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1vcmlnaW5hbC1kaXNhYmxlZCcgKSApXHJcblx0XHRcdFx0LnJlbW92ZUF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1vcmlnaW5hbC1kaXNhYmxlZCcgKVxyXG5cdFx0XHRcdC5yZW1vdmVDbGFzcyggJ3dwYmNfYWRkX2Jvb2tpbmdfbW9kYWxfX3RpbWVfZmllbGRfb3ZlcnJpZGRlbicgKTtcclxuXHRcdH1cclxuXHR9ICk7XHJcblxyXG5cdHJldHVybiBpc19lbmFibGVkO1xyXG59XHJcblxyXG4vKipcclxuICogQXBwbHkgYSBwcmVzZWxlY3RlZCB0aW1lIHJhbmdlIHRvIHRoZSByZW5kZXJlZCBBZGQgQm9va2luZyBmb3JtLlxyXG4gKlxyXG4gKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWQgQm9va2luZyByZXNvdXJjZSBJRC5cclxuICogQHBhcmFtIHtzdHJpbmd9IHNlbGVjdGVkX3RpbWUgVGltZSByYW5nZSwgZS5nLiBcIjA5OjAwIC0gMTE6MDBcIi5cclxuICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19hcHBseV9hZGRfYm9va2luZ19tb2RhbF9zZWxlY3RlZF90aW1lKCByZXNvdXJjZV9pZCwgc2VsZWN0ZWRfdGltZSApe1xyXG5cclxuXHR2YXIgJGZvcm0gPSBqUXVlcnkoICcjYm9va2luZ19mb3JtJyArIHJlc291cmNlX2lkICk7XHJcblx0dmFyIHRpbWVfcGFydHM7XHJcblx0dmFyIHN0YXJ0X3RpbWU7XHJcblx0dmFyIGVuZF90aW1lO1xyXG5cdHZhciBkaWRfc2VsZWN0ID0gZmFsc2U7XHJcblx0dmFyIGhhc190aW1lX2ZpZWxkcztcclxuXHJcblx0aWYgKCAhICRmb3JtLmxlbmd0aCB8fCAhIHNlbGVjdGVkX3RpbWUgKSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHR0aW1lX3BhcnRzID0gd3BiY19ib29fbGlzdGluZ19fcGFyc2Vfc2VsZWN0ZWRfdGltZV9yYW5nZSggc2VsZWN0ZWRfdGltZSApO1xyXG5cdHN0YXJ0X3RpbWUgPSB0aW1lX3BhcnRzLnN0YXJ0X3RpbWU7XHJcblx0ZW5kX3RpbWUgPSB0aW1lX3BhcnRzLmVuZF90aW1lO1xyXG5cdGhhc190aW1lX2ZpZWxkcyA9IHdwYmNfYm9vX2xpc3RpbmdfX2hhc19hZGRfYm9va2luZ19tb2RhbF90aW1lX2ZpZWxkcyggJGZvcm0sIHJlc291cmNlX2lkICk7XHJcblxyXG5cdGlmICggISBoYXNfdGltZV9maWVsZHMgKSB7XHJcblx0XHRyZXR1cm4gd3BiY19ib29fbGlzdGluZ19fZW5zdXJlX2FkZF9ib29raW5nX21vZGFsX3NlbGVjdGVkX3RpbWVfZmllbGRzKCAkZm9ybSwgcmVzb3VyY2VfaWQsIHN0YXJ0X3RpbWUsIGVuZF90aW1lICk7XHJcblx0fVxyXG5cclxuXHQkZm9ybS5maW5kKCAnc2VsZWN0W25hbWU9XCJyYW5nZXRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdLCBzZWxlY3RbbmFtZT1cInJhbmdldGltZScgKyByZXNvdXJjZV9pZCArICdbXVwiXScgKS5lYWNoKCBmdW5jdGlvbigpe1xyXG5cdFx0ZGlkX3NlbGVjdCA9IHdwYmNfYm9vX2xpc3RpbmdfX3NlbGVjdF90aW1lX29wdGlvbiggalF1ZXJ5KCB0aGlzICksIFsgc2VsZWN0ZWRfdGltZSBdICkgfHwgZGlkX3NlbGVjdDtcclxuXHR9ICk7XHJcblxyXG5cdGlmICggc3RhcnRfdGltZSApIHtcclxuXHRcdCRmb3JtLmZpbmQoICdzZWxlY3RbbmFtZT1cInN0YXJ0dGltZScgKyByZXNvdXJjZV9pZCArICdcIl0sIHNlbGVjdFtuYW1lPVwic3RhcnR0aW1lJyArIHJlc291cmNlX2lkICsgJ1tdXCJdJyApLmVhY2goIGZ1bmN0aW9uKCl7XHJcblx0XHRcdGRpZF9zZWxlY3QgPSB3cGJjX2Jvb19saXN0aW5nX19zZWxlY3RfdGltZV9vcHRpb24oIGpRdWVyeSggdGhpcyApLCBbIHN0YXJ0X3RpbWUgXSApIHx8IGRpZF9zZWxlY3Q7XHJcblx0XHR9ICk7XHJcblx0XHRpZiAoICRmb3JtLmZpbmQoICdpbnB1dFtuYW1lPVwic3RhcnR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScgKS5ub3QoICdbdHlwZT1cImhpZGRlblwiXScgKS52YWwoIHN0YXJ0X3RpbWUgKS50cmlnZ2VyKCAnaW5wdXQnICkudHJpZ2dlciggJ2NoYW5nZScgKS5sZW5ndGggKSB7XHJcblx0XHRcdGRpZF9zZWxlY3QgPSB0cnVlO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0aWYgKCBlbmRfdGltZSApIHtcclxuXHRcdCRmb3JtLmZpbmQoICdzZWxlY3RbbmFtZT1cImVuZHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdLCBzZWxlY3RbbmFtZT1cImVuZHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnW11cIl0nICkuZWFjaCggZnVuY3Rpb24oKXtcclxuXHRcdFx0ZGlkX3NlbGVjdCA9IHdwYmNfYm9vX2xpc3RpbmdfX3NlbGVjdF90aW1lX29wdGlvbiggalF1ZXJ5KCB0aGlzICksIFsgZW5kX3RpbWUgXSApIHx8IGRpZF9zZWxlY3Q7XHJcblx0XHR9ICk7XHJcblx0XHRpZiAoICRmb3JtLmZpbmQoICdpbnB1dFtuYW1lPVwiZW5kdGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nICkubm90KCAnW3R5cGU9XCJoaWRkZW5cIl0nICkudmFsKCBlbmRfdGltZSApLnRyaWdnZXIoICdpbnB1dCcgKS50cmlnZ2VyKCAnY2hhbmdlJyApLmxlbmd0aCApIHtcclxuXHRcdFx0ZGlkX3NlbGVjdCA9IHRydWU7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gZGlkX3NlbGVjdDtcclxufVxyXG5cclxuLyoqXHJcbiAqIEFwcGx5IEFkZCBCb29raW5nIG1vZGFsIGRhdGUvdGltZSBjb250ZXh0IGFmdGVyIEFKQVgtcmVuZGVyZWQgZm9ybSBsaWZlY3ljbGUgc2NyaXB0cyBydW4uXHJcbiAqXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhIEFKQVggcmVzcG9uc2UgZGF0YS5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX3ByZWxvYWRfYWRkX2Jvb2tpbmdfbW9kYWxfc2VsZWN0aW9uKCBkYXRhICl7XHJcblxyXG5cdGRhdGEgPSBkYXRhIHx8IHt9O1xyXG5cclxuXHR2YXIgcmVzb3VyY2VfaWQgPSBwYXJzZUludCggZGF0YS5yZXNvdXJjZV9pZCwgMTAgKTtcclxuXHR2YXIgc2VsZWN0ZWRfZGF0ZSA9IGRhdGEuc2VsZWN0ZWRfZGF0ZSB8fCAnJztcclxuXHR2YXIgc2VsZWN0ZWRfZGF0ZXMgPSB3cGJjX2Jvb19saXN0aW5nX19wYXJzZV9zZWxlY3RlZF9kYXRlcyggZGF0YS5zZWxlY3RlZF9kYXRlcyB8fCBzZWxlY3RlZF9kYXRlICk7XHJcblx0dmFyIHNlbGVjdGVkX3RpbWUgPSBkYXRhLnNlbGVjdGVkX3RpbWUgfHwgJyc7XHJcblx0dmFyIHNlbGVjdGVkX2RhdGVzX3dpdGhvdXRfY2FsZW5kYXIgPSBkYXRhLnNlbGVjdGVkX2RhdGVzX3dpdGhvdXRfY2FsZW5kYXIgfHwgJyc7XHJcblx0dmFyIGlzX3RpbWVfb3ZlcnJpZGUgPSAhISBwYXJzZUludCggZGF0YS50aW1lX292ZXJyaWRlX2VuYWJsZWQgfHwgMCwgMTAgKTtcclxuXHR2YXIgaXNfZm9yY2VfcmVjdXJyZW50X3RpbWUgPSB3cGJjX2Jvb19saXN0aW5nX19zaG91bGRfZm9yY2VfcmVjdXJyZW50X3RpbWUoIGRhdGEsIHNlbGVjdGVkX2RhdGVzICk7XHJcblx0dmFyIGFwcGx5X3RpbWU7XHJcblxyXG5cdGlmICggISByZXNvdXJjZV9pZCApIHtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdHdwYmNfYm9vX2xpc3RpbmdfX3NldF9tb2RhbF9yZWN1cnJlbnRfdGltZV9vdmVycmlkZSggcmVzb3VyY2VfaWQsIGlzX2ZvcmNlX3JlY3VycmVudF90aW1lICk7XHJcblxyXG5cdGlmICggISBpc190aW1lX292ZXJyaWRlICkge1xyXG5cdFx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19zZWN0aW9uJyApLmZpbmQoICdbZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtcGFuZWxdJyApLnJlbW92ZSgpO1xyXG5cdH1cclxuXHJcblx0aWYgKFxyXG5cdFx0ICAgc2VsZWN0ZWRfZGF0ZXMubGVuZ3RoXHJcblx0XHQmJiAhIHNlbGVjdGVkX2RhdGVzX3dpdGhvdXRfY2FsZW5kYXJcclxuXHQpIHtcclxuXHRcdHdwYmNfYm9vX2xpc3RpbmdfX2F1dG9fc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyKCByZXNvdXJjZV9pZCwgc2VsZWN0ZWRfZGF0ZXMsIGlzX2ZvcmNlX3JlY3VycmVudF90aW1lICk7XHJcblx0fVxyXG5cclxuXHRpZiAoICEgc2VsZWN0ZWRfdGltZSApIHtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdGFwcGx5X3RpbWUgPSBmdW5jdGlvbigpe1xyXG5cdFx0dmFyIGlzX2NhbGVuZGFyX2RhdGFfbG9hZGVkID0gKFxyXG5cdFx0XHQgICAhIHNlbGVjdGVkX2RhdGVcclxuXHRcdFx0fHwgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIF93cGJjIClcclxuXHRcdFx0fHwgKCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgX3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSApXHJcblx0XHRcdHx8ICggZmFsc2UgIT09IF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoIHJlc291cmNlX2lkLCBzZWxlY3RlZF9kYXRlICkgKVxyXG5cdFx0KTtcclxuXHJcblx0XHRpZiAoIGlzX2NhbGVuZGFyX2RhdGFfbG9hZGVkICYmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdwYmNfZGlzYWJsZV90aW1lX2ZpZWxkc19pbl9ib29raW5nX2Zvcm0gKSApIHtcclxuXHRcdFx0d3BiY19kaXNhYmxlX3RpbWVfZmllbGRzX2luX2Jvb2tpbmdfZm9ybSggcmVzb3VyY2VfaWQgKTtcclxuXHRcdH1cclxuXHRcdGlmICggaXNfdGltZV9vdmVycmlkZSApIHtcclxuXHRcdFx0d3BiY19ib29fbGlzdGluZ19fZW5zdXJlX2FkZF9ib29raW5nX21vZGFsX3RpbWVfb3ZlcnJpZGVfcGFuZWwoIGpRdWVyeSggJyNib29raW5nX2Zvcm0nICsgcmVzb3VyY2VfaWQgKSwgcmVzb3VyY2VfaWQsIGRhdGEgKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0d3BiY19ib29fbGlzdGluZ19fYXBwbHlfYWRkX2Jvb2tpbmdfbW9kYWxfc2VsZWN0ZWRfdGltZSggcmVzb3VyY2VfaWQsIHNlbGVjdGVkX3RpbWUgKTtcclxuXHR9O1xyXG5cclxuXHRqUXVlcnkoICcuYm9va2luZ19mb3JtX2RpdicgKS5vZmYoICd3cGJjX2hvb2tfdGltZXNsb3RzX2Rpc2FibGVkLndwYmNfYWRkX2Jvb2tpbmdfbW9kYWxfdGltZScgKS5vbmUoICd3cGJjX2hvb2tfdGltZXNsb3RzX2Rpc2FibGVkLndwYmNfYWRkX2Jvb2tpbmdfbW9kYWxfdGltZScsIGZ1bmN0aW9uKCBldmVudCwgbG9hZGVkX3Jlc291cmNlX2lkICl7XHJcblx0XHRpZiAoIHBhcnNlSW50KCBsb2FkZWRfcmVzb3VyY2VfaWQsIDEwICkgPT09IHJlc291cmNlX2lkICkge1xyXG5cdFx0XHR3aW5kb3cuc2V0VGltZW91dCggYXBwbHlfdGltZSwgMCApO1xyXG5cdFx0fVxyXG5cdH0gKTtcclxuXHJcblx0alF1ZXJ5KCAnYm9keScgKS5vZmYoICd3cGJjX2NhbGVuZGFyX2FqeF9fbG9hZGVkX2RhdGEud3BiY19hZGRfYm9va2luZ19tb2RhbF90aW1lJyApLm9uZSggJ3dwYmNfY2FsZW5kYXJfYWp4X19sb2FkZWRfZGF0YS53cGJjX2FkZF9ib29raW5nX21vZGFsX3RpbWUnLCBmdW5jdGlvbiggZXZlbnQsIGxvYWRlZF9yZXNvdXJjZV9pZCApe1xyXG5cdFx0aWYgKCBwYXJzZUludCggbG9hZGVkX3Jlc291cmNlX2lkLCAxMCApID09PSByZXNvdXJjZV9pZCApIHtcclxuXHRcdFx0d2luZG93LnNldFRpbWVvdXQoIGFwcGx5X3RpbWUsIDgwICk7XHJcblx0XHR9XHJcblx0fSApO1xyXG5cclxuXHR3aW5kb3cuc2V0VGltZW91dCggYXBwbHlfdGltZSwgMzUwICk7XHJcblx0d2luZG93LnNldFRpbWVvdXQoIGFwcGx5X3RpbWUsIDEwMDAgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJlZnJlc2ggbW9kYWwgZm9vdGVyIGNvbnRyb2xzIGFmdGVyIEFkZC9FZGl0IEJvb2tpbmcgY29udGV4dCBjaGFuZ2VzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge09iamVjdH0gJG1vZGFsIE1vZGFsIGpRdWVyeSBvYmplY3QuXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhIEFKQVggcmVzcG9uc2UgZGF0YS5cclxuICogQHBhcmFtIHtzdHJpbmd9IG1vZGUgQ3VycmVudCBtb2RhbCBtb2RlLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fc3luY19hZGRfYm9va2luZ19tb2RhbF9jb250cm9scyggJG1vZGFsLCBkYXRhLCBtb2RlICl7XHJcblxyXG5cdGRhdGEgPSBkYXRhIHx8IHt9O1xyXG5cclxuXHQkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1tb2RlJywgbW9kZSB8fCBkYXRhLm1vZGUgfHwgJ2FkZCcgKTtcclxuXHJcblx0dmFyICRyZXNvdXJjZV9jb250cm9sID0gJG1vZGFsLmZpbmQoICcud3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX3Jlc291cmNlX2NvbnRyb2wnICk7XHJcblx0dmFyICRyZXNvdXJjZV9zZWxlY3QgID0gJG1vZGFsLmZpbmQoICcjd3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX3Jlc291cmNlX2lkJyApO1xyXG5cdHZhciAkZm9ybV9zZWxlY3QgICAgICA9ICRtb2RhbC5maW5kKCAnI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19ib29raW5nX2Zvcm0nICk7XHJcblx0dmFyICRmb3JtX2VkaXRfbGluayAgID0gJG1vZGFsLmZpbmQoICcud3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX2VkaXRfZm9ybV9saW5rJyApO1xyXG5cdHZhciAkYWxsb3dfcGFzdF9jb250cm9sID0gJG1vZGFsLmZpbmQoICcud3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX2FsbG93X3Bhc3RfY29udHJvbCcgKTtcclxuXHR2YXIgJGFsbG93X3Bhc3RfdG9nZ2xlICA9ICRtb2RhbC5maW5kKCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy1hbGxvdy1wYXN0XScgKS5maXJzdCgpO1xyXG5cdHZhciBjdXJyZW50X21vZGUgICAgICAgID0gbW9kZSB8fCBkYXRhLm1vZGUgfHwgJ2FkZCc7XHJcblxyXG5cdGlmICggJ2VkaXQnID09PSBjdXJyZW50X21vZGUgKSB7XHJcblx0XHQkcmVzb3VyY2VfY29udHJvbC5oaWRlKCk7XHJcblx0XHQkYWxsb3dfcGFzdF9jb250cm9sLmhpZGUoKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0JHJlc291cmNlX2NvbnRyb2wuc2hvdygpO1xyXG5cdFx0JGFsbG93X3Bhc3RfY29udHJvbC5zaG93KCk7XHJcblx0fVxyXG5cclxuXHRpZiAoIGRhdGEucmVzb3VyY2VfaWQgJiYgJHJlc291cmNlX3NlbGVjdC5sZW5ndGggKSB7XHJcblx0XHQkcmVzb3VyY2Vfc2VsZWN0LnZhbCggU3RyaW5nKCBkYXRhLnJlc291cmNlX2lkICkgKTtcclxuXHR9XHJcblxyXG5cdGlmICggJGZvcm1fc2VsZWN0Lmxlbmd0aCApIHtcclxuXHRcdHZhciBib29raW5nX2Zvcm0gPSBkYXRhLmJvb2tpbmdfZm9ybSB8fCAnc3RhbmRhcmQnO1xyXG5cdFx0aWYgKCBib29raW5nX2Zvcm0gJiYgISAkZm9ybV9zZWxlY3QuZmluZCggJ29wdGlvbicgKS5maWx0ZXIoIGZ1bmN0aW9uKCl7XHJcblx0XHRcdHJldHVybiBqUXVlcnkoIHRoaXMgKS52YWwoKSA9PT0gYm9va2luZ19mb3JtO1xyXG5cdFx0fSApLmxlbmd0aCApIHtcclxuXHRcdFx0JGZvcm1fc2VsZWN0LmFwcGVuZCggalF1ZXJ5KCAnPG9wdGlvbiAvPicgKS52YWwoIGJvb2tpbmdfZm9ybSApLnRleHQoIGJvb2tpbmdfZm9ybSApICk7XHJcblx0XHR9XHJcblx0XHQkZm9ybV9zZWxlY3QudmFsKCBib29raW5nX2Zvcm0gKTtcclxuXHR9XHJcblxyXG5cdGlmICggJGZvcm1fZWRpdF9saW5rLmxlbmd0aCApIHtcclxuXHRcdHdwYmNfYm9vX2xpc3RpbmdfX3N5bmNfYWRkX2Jvb2tpbmdfbW9kYWxfZm9ybV9lZGl0X2xpbmsoICRtb2RhbCApO1xyXG5cdH1cclxuXHJcblx0aWYgKCAkYWxsb3dfcGFzdF90b2dnbGUubGVuZ3RoICkge1xyXG5cdFx0JGFsbG93X3Bhc3RfdG9nZ2xlLnByb3AoICdjaGVja2VkJywgISEgcGFyc2VJbnQoIGRhdGEuYWxsb3dfcGFzdCB8fCAwLCAxMCApICk7XHJcblx0fVxyXG59XHJcblxyXG4vKipcclxuICogU3luYyBGb3JtcyBCdWlsZGVyIGVkaXQgbGluayB3aXRoIHNlbGVjdGVkIGN1c3RvbSBib29raW5nIGZvcm0uXHJcbiAqXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSAkbW9kYWwgTW9kYWwgalF1ZXJ5IG9iamVjdC5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX3N5bmNfYWRkX2Jvb2tpbmdfbW9kYWxfZm9ybV9lZGl0X2xpbmsoICRtb2RhbCApe1xyXG5cclxuXHR2YXIgJGZvcm1fc2VsZWN0ICAgID0gJG1vZGFsLmZpbmQoICcjd3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX2Jvb2tpbmdfZm9ybScgKTtcclxuXHR2YXIgJGZvcm1fZWRpdF9saW5rID0gJG1vZGFsLmZpbmQoICcud3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX2VkaXRfZm9ybV9saW5rJyApO1xyXG5cclxuXHRpZiAoICEgJGZvcm1fc2VsZWN0Lmxlbmd0aCB8fCAhICRmb3JtX2VkaXRfbGluay5sZW5ndGggKSB7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHR2YXIgZm9ybV9uYW1lID0gJGZvcm1fc2VsZWN0LnZhbCgpIHx8ICdzdGFuZGFyZCc7XHJcblx0dmFyIGJhc2VfdXJsICA9ICRmb3JtX2VkaXRfbGluay5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLWZvcm0tYnVpbGRlci11cmwnICkgfHwgJGZvcm1fZWRpdF9saW5rLmF0dHIoICdocmVmJyApIHx8ICcnO1xyXG5cclxuXHRpZiAoICEgYmFzZV91cmwgKSB7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHR2YXIgc2VwYXJhdG9yID0gKCAtMSA9PT0gYmFzZV91cmwuaW5kZXhPZiggJz8nICkgKSA/ICc/JyA6ICcmJztcclxuXHQkZm9ybV9lZGl0X2xpbmsuYXR0ciggJ2hyZWYnLCBiYXNlX3VybCArIHNlcGFyYXRvciArICdmb3JtX25hbWU9JyArIGVuY29kZVVSSUNvbXBvbmVudCggZm9ybV9uYW1lICkgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEluaXQgbW9kYWwgZm9vdGVyIGNvbnRyb2xzLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19faW5pdF9hZGRfYm9va2luZ19tb2RhbF9jb250cm9scygpe1xyXG5cclxuXHRqUXVlcnkoIGRvY3VtZW50ICkub2ZmKCAnY2hhbmdlLndwYmNfYWRkX2Jvb2tpbmdfbW9kYWwnLCAnI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19yZXNvdXJjZV9pZCwgI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19ib29raW5nX2Zvcm0sICN3cGJjX21vZGFsX19hZGRfYm9va2luZ19fYWxsb3dfcGFzdCcgKS5vbihcclxuXHRcdCdjaGFuZ2Uud3BiY19hZGRfYm9va2luZ19tb2RhbCcsXHJcblx0XHQnI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19yZXNvdXJjZV9pZCwgI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19ib29raW5nX2Zvcm0sICN3cGJjX21vZGFsX19hZGRfYm9va2luZ19fYWxsb3dfcGFzdCcsXHJcblx0XHRmdW5jdGlvbigpe1xyXG5cdFx0XHR2YXIgJG1vZGFsID0galF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19zZWN0aW9uJyApO1xyXG5cdFx0XHR2YXIgbW9kZSAgID0gJG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctbW9kZScgKSB8fCAnYWRkJztcclxuXHRcdFx0dmFyIGNoYW5nZWRfaWQgICA9IGpRdWVyeSggdGhpcyApLmF0dHIoICdpZCcgKSB8fCAnJztcclxuXHRcdFx0dmFyIGJvb2tpbmdfZm9ybSA9ICRtb2RhbC5maW5kKCAnI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19ib29raW5nX2Zvcm0nICkudmFsKCkgfHwgJyc7XHJcblxyXG5cdFx0XHRpZiAoICd3cGJjX21vZGFsX19hZGRfYm9va2luZ19fcmVzb3VyY2VfaWQnID09PSBjaGFuZ2VkX2lkICkge1xyXG5cdFx0XHRcdGJvb2tpbmdfZm9ybSA9ICcnO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR3cGJjX2Jvb19saXN0aW5nX19jbGlja19fYWRkX2Jvb2tpbmdfbW9kYWwoIHtcclxuXHRcdFx0XHRtb2RlICAgICAgICAgOiBtb2RlLFxyXG5cdFx0XHRcdGJvb2tpbmdfaWQgICA6ICRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLWlkJyApIHx8ICcnLFxyXG5cdFx0XHRcdHJlc291cmNlX2lkICA6ICRtb2RhbC5maW5kKCAnI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19yZXNvdXJjZV9pZCcgKS52YWwoKSB8fCAnJyxcclxuXHRcdFx0XHRib29raW5nX2hhc2ggOiAkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1oYXNoJyApIHx8ICcnLFxyXG5cdFx0XHRcdGJvb2tpbmdfZm9ybSA6IGJvb2tpbmdfZm9ybSxcclxuXHRcdFx0XHRhbGxvd19wYXN0ICAgOiAkbW9kYWwuZmluZCggJ1tkYXRhLXdwYmMtYWRkLWJvb2tpbmctYWxsb3ctcGFzdF0nICkuZmlyc3QoKS5pcyggJzpjaGVja2VkJyApID8gMSA6IDAsXHJcblx0XHRcdFx0c2VsZWN0ZWRfZGF0ZXNfd2l0aG91dF9jYWxlbmRhciA6ICRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLXNlbGVjdGVkLWRhdGVzLXdpdGhvdXQtY2FsZW5kYXInICkgfHwgJycsXHJcblx0XHRcdFx0c2VsZWN0ZWRfZGF0ZXMgOiAkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1zZWxlY3RlZC1kYXRlcycgKSB8fCAnJyxcclxuXHRcdFx0XHRzZWxlY3RlZF9kYXRlIDogJG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctc2VsZWN0ZWQtZGF0ZScgKSB8fCAnJyxcclxuXHRcdFx0XHRzZWxlY3RlZF90aW1lIDogJG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctc2VsZWN0ZWQtdGltZScgKSB8fCAnJyxcclxuXHRcdFx0XHR0aW1lX292ZXJyaWRlX2VuYWJsZWQgOiAkbW9kYWwuZmluZCggJ1tkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1lbmFibGVkXScgKS5maXJzdCgpLmxlbmd0aFxyXG5cdFx0XHRcdFx0PyAoICRtb2RhbC5maW5kKCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLWVuYWJsZWRdJyApLmZpcnN0KCkuaXMoICc6Y2hlY2tlZCcgKSA/IDEgOiAwIClcclxuXHRcdFx0XHRcdDogKCAkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLWVuYWJsZWQnICkgfHwgMCApLFxyXG5cdFx0XHRcdHRpbWVfb3ZlcnJpZGVfc291cmNlIDogJG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1zb3VyY2UnICkgfHwgJycsXHJcblx0XHRcdFx0dGltZV9vdmVycmlkZV9zdGFydCA6ICRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtc3RhcnQnICkgfHwgJycsXHJcblx0XHRcdFx0dGltZV9vdmVycmlkZV9lbmQgOiAkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLWVuZCcgKSB8fCAnJ1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblx0KTtcclxuXHJcblx0alF1ZXJ5KCBkb2N1bWVudCApLm9mZiggJ2NoYW5nZS53cGJjX2FkZF9ib29raW5nX21vZGFsX3RpbWVfb3ZlcnJpZGUnLCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLWVuYWJsZWRdJyApLm9uKFxyXG5cdFx0J2NoYW5nZS53cGJjX2FkZF9ib29raW5nX21vZGFsX3RpbWVfb3ZlcnJpZGUnLFxyXG5cdFx0J1tkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1lbmFibGVkXScsXHJcblx0XHRmdW5jdGlvbigpe1xyXG5cdFx0XHR2YXIgJG1vZGFsID0galF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19zZWN0aW9uJyApO1xyXG5cdFx0XHR2YXIgcmVzb3VyY2VfaWQgPSBwYXJzZUludCggJG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctcmVzb3VyY2UtaWQnICkgfHwgMCwgMTAgKTtcclxuXHRcdFx0dmFyICRmb3JtID0galF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdFx0aWYgKCByZXNvdXJjZV9pZCAmJiAkZm9ybS5sZW5ndGggKSB7XHJcblx0XHRcdFx0d3BiY19ib29fbGlzdGluZ19fYXBwbHlfYWRkX2Jvb2tpbmdfbW9kYWxfdGltZV9vdmVycmlkZV9zdGF0ZSggJGZvcm0sIHJlc291cmNlX2lkICk7XHJcblx0XHRcdFx0JG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1lbmFibGVkJywgalF1ZXJ5KCB0aGlzICkuaXMoICc6Y2hlY2tlZCcgKSA/ICcxJyA6ICcwJyApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0KTtcclxufVxyXG5qUXVlcnkoIGRvY3VtZW50ICkucmVhZHkoIGZ1bmN0aW9uKCl7XHJcblx0d3BiY19ib29fbGlzdGluZ19faW5pdF9hZGRfYm9va2luZ19tb2RhbF9jb250cm9scygpO1xyXG59ICk7XHJcblxyXG4vKipcclxuICogUHJlcGFyZSBzZWxlY3RlZCB0aW1lbGluZSBpbnRlcnZhbCBiZWZvcmUgQWRkIEJvb2tpbmcgbW9kYWwgc3VibWl0LlxyXG4gKlxyXG4gKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWQgQm9va2luZyByZXNvdXJjZSBJRC5cclxuICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19wcmVwYXJlX2FkZF9ib29raW5nX21vZGFsX3RpbWVfb3ZlcnJpZGUoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdHZhciAkbW9kYWwgPSBqUXVlcnkoICcjd3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX3NlY3Rpb24nICk7XHJcblx0dmFyICRmb3JtID0galF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCApO1xyXG5cdHZhciAkd3JhcCA9ICRtb2RhbC5maW5kKCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLXBhbmVsXScgKS5maXJzdCgpO1xyXG5cdHZhciAkZW5hYmxlZCA9ICR3cmFwLmZpbmQoICdbZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtZW5hYmxlZF0nICkuZmlyc3QoKTtcclxuXHR2YXIgJHN0YXJ0O1xyXG5cdHZhciAkZW5kO1xyXG5cclxuXHRpZiAoICEgJG1vZGFsLmlzKCAnOnZpc2libGUnICkgfHwgISAkd3JhcC5sZW5ndGggfHwgISAkZW5hYmxlZC5pcyggJzpjaGVja2VkJyApICkge1xyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fVxyXG5cclxuXHR3cGJjX2Jvb19saXN0aW5nX19hcHBseV9hZGRfYm9va2luZ19tb2RhbF90aW1lX292ZXJyaWRlX3N0YXRlKCAkZm9ybSwgcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0JHN0YXJ0ID0gJHdyYXAuZmluZCggJ1tkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1maWVsZD1cInN0YXJ0XCJdJyApLmZpcnN0KCk7XHJcblx0JGVuZCA9ICR3cmFwLmZpbmQoICdbZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtZmllbGQ9XCJlbmRcIl0nICkuZmlyc3QoKTtcclxuXHJcblx0aWYgKCAhICRzdGFydC52YWwoKSB8fCAhICRlbmQudmFsKCkgKSB7XHJcblx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX193YXJuaW5nICkge1xyXG5cdFx0XHR3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX193YXJuaW5nKCAkd3JhcC5nZXQoIDAgKSwgJ1NlbGVjdGVkIHRpbWVsaW5lIGludGVydmFsIGlzIG5vdCBjb21wbGV0ZS4nICk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHQkbW9kYWxcclxuXHRcdC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtZW5hYmxlZCcsICcxJyApXHJcblx0XHQuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLXN0YXJ0JywgJHN0YXJ0LnZhbCgpIClcclxuXHRcdC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtZW5kJywgJGVuZC52YWwoKSApO1xyXG5cclxuXHRyZXR1cm4gdHJ1ZTtcclxufVxyXG5cclxuLyoqXHJcbiAqIE9wZW4gQWRkL0VkaXQgQm9va2luZyBtb2RhbC5cclxuICpcclxuICogQHBhcmFtIHtPYmplY3R9IGFyZ3MgTW9kYWwgY29udGV4dC5cclxuICogQHJldHVybnMge2Jvb2xlYW58dW5kZWZpbmVkfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fY2xpY2tfX2FkZF9ib29raW5nX21vZGFsKCBhcmdzICl7XHJcblxyXG5cdGlmICggISB3cGJjX2lzX21vZGFsX2FjY2Vzc2libGUoICcjd3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX3NlY3Rpb24nICkgKSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHRhcmdzID0gYXJncyB8fCB7fTtcclxuXHJcblx0dmFyICRtb2RhbCA9IGpRdWVyeSggJyN3cGJjX21vZGFsX19hZGRfYm9va2luZ19fc2VjdGlvbicgKTtcclxuXHR2YXIgJGJvZHkgPSBqUXVlcnkoICcjd3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX2JvZHknICk7XHJcblx0dmFyIG5vbmNlID0gJG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctbm9uY2UnICk7XHJcblx0dmFyIG1vZGUgPSBhcmdzLm1vZGUgfHwgKCBhcmdzLmJvb2tpbmdfaGFzaCA/ICdlZGl0JyA6ICdhZGQnICk7XHJcblx0dmFyIHRpdGxlID0gKCAnZWRpdCcgPT09IG1vZGUgKSA/ICdFZGl0IGJvb2tpbmcnIDogJ0FkZCBib29raW5nJztcclxuXHR2YXIgYWxsb3dfcGFzdCA9IGFyZ3MuYWxsb3dfcGFzdCA/IDEgOiAwO1xyXG5cclxuXHRpZiAoICEgYWxsb3dfcGFzdCAmJiAkbW9kYWwuZmluZCggJ1tkYXRhLXdwYmMtYWRkLWJvb2tpbmctYWxsb3ctcGFzdF0nICkuZmlyc3QoKS5pcyggJzpjaGVja2VkJyApICkge1xyXG5cdFx0YWxsb3dfcGFzdCA9IDE7XHJcblx0fVxyXG5cclxuXHRpZiAoICdlZGl0JyA9PT0gbW9kZSApIHtcclxuXHRcdGFsbG93X3Bhc3QgPSAxO1xyXG5cdH1cclxuXHJcblx0JG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctcmVzb3VyY2UtaWQnLCAnJyApO1xyXG5cdCRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLWhhc2gnLCBhcmdzLmJvb2tpbmdfaGFzaCB8fCAnJyApO1xyXG5cdCRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLWlkJywgYXJncy5ib29raW5nX2lkIHx8ICcnICk7XHJcblx0JG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctbW9kZScsIG1vZGUgKTtcclxuXHQkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1hbGxvdy1wYXN0JywgYWxsb3dfcGFzdCA/ICcxJyA6ICcwJyApO1xyXG5cdCRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLXNlbGVjdGVkLWRhdGVzLXdpdGhvdXQtY2FsZW5kYXInLCBhcmdzLnNlbGVjdGVkX2RhdGVzX3dpdGhvdXRfY2FsZW5kYXIgfHwgJycgKTtcclxuXHQkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1zZWxlY3RlZC1kYXRlcycsIGFyZ3Muc2VsZWN0ZWRfZGF0ZXMgfHwgYXJncy5zZWxlY3RlZF9kYXRlIHx8ICcnICk7XHJcblx0JG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctc2VsZWN0ZWQtZGF0ZScsIGFyZ3Muc2VsZWN0ZWRfZGF0ZSB8fCAnJyApO1xyXG5cdCRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLXNlbGVjdGVkLXRpbWUnLCBhcmdzLnNlbGVjdGVkX3RpbWUgfHwgJycgKTtcclxuXHQkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLWVuYWJsZWQnLCBhcmdzLnRpbWVfb3ZlcnJpZGVfZW5hYmxlZCA/ICcxJyA6ICcwJyApO1xyXG5cdCRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtc291cmNlJywgYXJncy50aW1lX292ZXJyaWRlX3NvdXJjZSB8fCAnJyApO1xyXG5cdCRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtc3RhcnQnLCBhcmdzLnRpbWVfb3ZlcnJpZGVfc3RhcnQgfHwgJycgKTtcclxuXHQkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLWVuZCcsIGFyZ3MudGltZV9vdmVycmlkZV9lbmQgfHwgJycgKTtcclxuXHQkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1mb3JjZS1yZWN1cnJlbnQtdGltZScsIHdwYmNfYm9vX2xpc3RpbmdfX3Nob3VsZF9mb3JjZV9yZWN1cnJlbnRfdGltZSggYXJncywgd3BiY19ib29fbGlzdGluZ19fcGFyc2Vfc2VsZWN0ZWRfZGF0ZXMoIGFyZ3Muc2VsZWN0ZWRfZGF0ZXMgfHwgYXJncy5zZWxlY3RlZF9kYXRlICkgKSA/ICcxJyA6ICcwJyApO1xyXG5cdGlmICggISBhcmdzLnRpbWVfb3ZlcnJpZGVfZW5hYmxlZCApIHtcclxuXHRcdCRtb2RhbC5maW5kKCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLXBhbmVsXScgKS5yZW1vdmUoKTtcclxuXHR9XHJcblx0YXJncy5hbGxvd19wYXN0ID0gYWxsb3dfcGFzdDtcclxuXHR3cGJjX2Jvb19saXN0aW5nX19zeW5jX2FkZF9ib29raW5nX21vZGFsX2NvbnRyb2xzKCAkbW9kYWwsIGFyZ3MsIG1vZGUgKTtcclxuXHQkbW9kYWwuZmluZCggJy53cGJjX21vZGFsX19hZGRfYm9va2luZ19fdGl0bGUnICkudGV4dCggdGl0bGUgKTtcclxuXHQkbW9kYWwuZmluZCggJy53cGJjX21vZGFsX19hZGRfYm9va2luZ19fYm9va2luZ19pZCcgKS5odG1sKCBhcmdzLmJvb2tpbmdfaWQgPyAoICdJRDogJyArIGFyZ3MuYm9va2luZ19pZCApIDogJycgKTtcclxuXHQkbW9kYWwuZmluZCggJyN3cGJjX21vZGFsX19hZGRfYm9va2luZ19fYnV0dG9uX3NlbmQnICkudGV4dCggKCAnZWRpdCcgPT09IG1vZGUgKSA/ICdTYXZlIGJvb2tpbmcnIDogJ0FkZCBib29raW5nJyApO1xyXG5cdCRib2R5Lmh0bWwoIHdwYmNfYm9vX2xpc3RpbmdfX2dldF9hZGRfYm9va2luZ19tb2RhbF9sb2FkaW5nX2h0bWwoKSApO1xyXG5cclxuXHQkbW9kYWwud3BiY19teV9tb2RhbCggJ3Nob3cnICk7XHJcblxyXG5cdGpRdWVyeS5wb3N0KFxyXG5cdFx0d3BiY191cmxfYWpheCxcclxuXHRcdHtcclxuXHRcdFx0YWN0aW9uICAgICAgIDogJ1dQQkNfQUpYX0FERF9CT09LSU5HX01PREFMJyxcclxuXHRcdFx0bm9uY2UgICAgICAgIDogbm9uY2UsXHJcblx0XHRcdG1vZGUgICAgICAgICA6IG1vZGUsXHJcblx0XHRcdGJvb2tpbmdfaWQgICA6IGFyZ3MuYm9va2luZ19pZCB8fCAnJyxcclxuXHRcdFx0cmVzb3VyY2VfaWQgIDogYXJncy5yZXNvdXJjZV9pZCB8fCAnJyxcclxuXHRcdFx0Ym9va2luZ19oYXNoIDogYXJncy5ib29raW5nX2hhc2ggfHwgJycsXHJcblx0XHRcdGJvb2tpbmdfZm9ybSA6IGFyZ3MuYm9va2luZ19mb3JtIHx8ICcnLFxyXG5cdFx0XHRhbGxvd19wYXN0ICAgOiBhbGxvd19wYXN0LFxyXG5cdFx0XHRzZWxlY3RlZF9kYXRlc193aXRob3V0X2NhbGVuZGFyIDogYXJncy5zZWxlY3RlZF9kYXRlc193aXRob3V0X2NhbGVuZGFyIHx8ICcnLFxyXG5cdFx0XHRzZWxlY3RlZF9kYXRlcyA6IGFyZ3Muc2VsZWN0ZWRfZGF0ZXMgfHwgYXJncy5zZWxlY3RlZF9kYXRlIHx8ICcnLFxyXG5cdFx0XHRzZWxlY3RlZF9kYXRlIDogYXJncy5zZWxlY3RlZF9kYXRlIHx8ICcnLFxyXG5cdFx0XHRzZWxlY3RlZF90aW1lIDogYXJncy5zZWxlY3RlZF90aW1lIHx8ICcnLFxyXG5cdFx0XHR0aW1lX292ZXJyaWRlX2VuYWJsZWQgOiBhcmdzLnRpbWVfb3ZlcnJpZGVfZW5hYmxlZCA/IDEgOiAwLFxyXG5cdFx0XHR0aW1lX292ZXJyaWRlX3NvdXJjZSA6IGFyZ3MudGltZV9vdmVycmlkZV9zb3VyY2UgfHwgJycsXHJcblx0XHRcdHRpbWVfb3ZlcnJpZGVfc3RhcnQgOiBhcmdzLnRpbWVfb3ZlcnJpZGVfc3RhcnQgfHwgJycsXHJcblx0XHRcdHRpbWVfb3ZlcnJpZGVfZW5kIDogYXJncy50aW1lX292ZXJyaWRlX2VuZCB8fCAnJ1xyXG5cdFx0fSxcclxuXHRcdGZ1bmN0aW9uKCByZXNwb25zZSApe1xyXG5cclxuXHRcdFx0aWYgKCAhIHJlc3BvbnNlIHx8ICEgcmVzcG9uc2Uuc3VjY2VzcyApIHtcclxuXHRcdFx0XHR2YXIgbWVzc2FnZSA9ICggcmVzcG9uc2UgJiYgcmVzcG9uc2UuZGF0YSAmJiByZXNwb25zZS5kYXRhLm1lc3NhZ2UgKSA/IHJlc3BvbnNlLmRhdGEubWVzc2FnZSA6ICdVbmFibGUgdG8gbG9hZCBib29raW5nIGZvcm0uJztcclxuXHRcdFx0XHQkYm9keS5odG1sKCAnPGRpdiBjbGFzcz1cIndwYmMtc2V0dGluZ3Mtbm90aWNlIG5vdGljZS13YXJuaW5nXCIgc3R5bGU9XCJ0ZXh0LWFsaWduOmxlZnRcIj4nICsgbWVzc2FnZSArICc8L2Rpdj4nICk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1yZXNvdXJjZS1pZCcsIHJlc3BvbnNlLmRhdGEucmVzb3VyY2VfaWQgfHwgJycgKTtcclxuXHRcdFx0JG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctaGFzaCcsIHJlc3BvbnNlLmRhdGEuYm9va2luZ19oYXNoIHx8ICcnICk7XHJcblx0XHRcdCRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLWlkJywgcmVzcG9uc2UuZGF0YS5ib29raW5nX2lkIHx8ICcnICk7XHJcblx0XHRcdCRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLW1vZGUnLCByZXNwb25zZS5kYXRhLm1vZGUgfHwgbW9kZSApO1xyXG5cdFx0XHQkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1hbGxvdy1wYXN0JywgcmVzcG9uc2UuZGF0YS5hbGxvd19wYXN0ID8gJzEnIDogJzAnICk7XHJcblx0XHRcdCRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLXNlbGVjdGVkLWRhdGVzLXdpdGhvdXQtY2FsZW5kYXInLCByZXNwb25zZS5kYXRhLnNlbGVjdGVkX2RhdGVzX3dpdGhvdXRfY2FsZW5kYXIgfHwgJycgKTtcclxuXHRcdFx0JG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctc2VsZWN0ZWQtZGF0ZXMnLCByZXNwb25zZS5kYXRhLnNlbGVjdGVkX2RhdGVzIHx8IHJlc3BvbnNlLmRhdGEuc2VsZWN0ZWRfZGF0ZSB8fCAnJyApO1xyXG5cdFx0XHQkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1zZWxlY3RlZC1kYXRlJywgcmVzcG9uc2UuZGF0YS5zZWxlY3RlZF9kYXRlIHx8ICcnICk7XHJcblx0XHRcdCRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLXNlbGVjdGVkLXRpbWUnLCByZXNwb25zZS5kYXRhLnNlbGVjdGVkX3RpbWUgfHwgJycgKTtcclxuXHRcdFx0JG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1lbmFibGVkJywgcmVzcG9uc2UuZGF0YS50aW1lX292ZXJyaWRlX2VuYWJsZWQgPyAnMScgOiAnMCcgKTtcclxuXHRcdFx0JG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1zb3VyY2UnLCByZXNwb25zZS5kYXRhLnRpbWVfb3ZlcnJpZGVfc291cmNlIHx8ICcnICk7XHJcblx0XHRcdCRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtc3RhcnQnLCByZXNwb25zZS5kYXRhLnRpbWVfb3ZlcnJpZGVfc3RhcnQgfHwgJycgKTtcclxuXHRcdFx0JG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1lbmQnLCByZXNwb25zZS5kYXRhLnRpbWVfb3ZlcnJpZGVfZW5kIHx8ICcnICk7XHJcblx0XHRcdHdwYmNfYm9vX2xpc3RpbmdfX3N5bmNfYWRkX2Jvb2tpbmdfbW9kYWxfY29udHJvbHMoICRtb2RhbCwgcmVzcG9uc2UuZGF0YSwgcmVzcG9uc2UuZGF0YS5tb2RlIHx8IG1vZGUgKTtcclxuXHRcdFx0JG1vZGFsLmZpbmQoICcud3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX3RpdGxlJyApLnRleHQoIHJlc3BvbnNlLmRhdGEudGl0bGUgfHwgdGl0bGUgKTtcclxuXHRcdFx0JG1vZGFsLmZpbmQoICcud3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX2Jvb2tpbmdfaWQnICkuaHRtbCggcmVzcG9uc2UuZGF0YS5ib29raW5nX2lkID8gKCAnSUQ6ICcgKyByZXNwb25zZS5kYXRhLmJvb2tpbmdfaWQgKSA6ICcnICk7XHJcblx0XHRcdCRtb2RhbC5maW5kKCAnI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19idXR0b25fc2VuZCcgKS50ZXh0KCByZXNwb25zZS5kYXRhLmJ1dHRvbl90aXRsZSB8fCAoICggJ2VkaXQnID09PSBtb2RlICkgPyAnU2F2ZSBib29raW5nJyA6ICdBZGQgYm9va2luZycgKSApO1xyXG5cdFx0XHR3cGJjX2Jvb19saXN0aW5nX19zZXRfYWRkX2Jvb2tpbmdfbW9kYWxfYm9keV9odG1sKCAkYm9keSwgcmVzcG9uc2UuZGF0YS5odG1sIHx8ICcnICk7XHJcblxyXG5cdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3cGJjX2hvb2tfX2luaXRfYm9va2luZ19mb3JtX3dpemFyZF9idXR0b25zICkge1xyXG5cdFx0XHRcdHdwYmNfaG9va19faW5pdF9ib29raW5nX2Zvcm1fd2l6YXJkX2J1dHRvbnMoKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIF93cGJjICkge1xyXG5cdFx0XHRcdF93cGJjLnNldF9vdGhlcl9wYXJhbSggJ3RoaXNfcGFnZV9ib29raW5nX2hhc2gnLCByZXNwb25zZS5kYXRhLmJvb2tpbmdfaGFzaCB8fCAnJyApO1xyXG5cdFx0XHRcdF93cGJjLnNldF9vdGhlcl9wYXJhbSggJ3RoaXNfcGFnZV9hbGxvd19wYXN0JywgcmVzcG9uc2UuZGF0YS5hbGxvd19wYXN0ID8gMSA6IDAgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd3BiY19ic19qYXZhc2NyaXB0X3Rvb2x0aXBzICkge1xyXG5cdFx0XHRcdHdwYmNfYnNfamF2YXNjcmlwdF90b29sdGlwcygpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdwYmNfYnNfamF2YXNjcmlwdF9wb3BvdmVyICkge1xyXG5cdFx0XHRcdHdwYmNfYnNfamF2YXNjcmlwdF9wb3BvdmVyKCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHdwYmNfYm9vX2xpc3RpbmdfX3ByZWxvYWRfYWRkX2Jvb2tpbmdfbW9kYWxfc2VsZWN0aW9uKCByZXNwb25zZS5kYXRhICk7XHJcblx0XHR9XHJcblx0KS5mYWlsKCBmdW5jdGlvbigpe1xyXG5cdFx0JGJvZHkuaHRtbCggJzxkaXYgY2xhc3M9XCJ3cGJjLXNldHRpbmdzLW5vdGljZSBub3RpY2Utd2FybmluZ1wiIHN0eWxlPVwidGV4dC1hbGlnbjpsZWZ0XCI+VW5hYmxlIHRvIGxvYWQgYm9va2luZyBmb3JtLjwvZGl2PicgKTtcclxuXHR9ICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZWxvYWQgQm9va2luZyBMaXN0aW5nIGFmdGVyIEFkZC9FZGl0IEJvb2tpbmcgbW9kYWwgc2F2ZWQgc3VjY2Vzc2Z1bGx5LlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fcmVsb2FkX2FmdGVyX2FkZF9ib29raW5nX21vZGFsX3N1Ym1pdCgpe1xyXG5cclxuXHR2YXIgJG1vZGFsID0galF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19zZWN0aW9uJyApO1xyXG5cclxuXHRpZiAoICRtb2RhbC5sZW5ndGggJiYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgJG1vZGFsLndwYmNfbXlfbW9kYWwgKSApIHtcclxuXHRcdCRtb2RhbC53cGJjX215X21vZGFsKCAnaGlkZScgKTtcclxuXHR9XHJcblxyXG5cdGlmIChcclxuXHRcdCAgICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMgKVxyXG5cdFx0JiYgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHdpbmRvdy53cGJjX2FqeF9ib29raW5nX2xpc3RpbmcgKVxyXG5cdCkge1xyXG5cdFx0d2luZG93LndwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtcygge30gKTtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX2FqeF9ib29raW5nX19hY3R1YWxfbGlzdGluZ19fc2hvdyApIHtcclxuXHRcdHdpbmRvdy53cGJjX2FqeF9ib29raW5nX19hY3R1YWxfbGlzdGluZ19fc2hvdygpO1xyXG5cdH1cclxufVxyXG5cclxuLyoqXHJcbiAqIFN1Ym1pdCBBZGQvRWRpdCBCb29raW5nIG1vZGFsIGZvcm0uXHJcbiAqXHJcbiAqIEByZXR1cm5zIHtib29sZWFufHVuZGVmaW5lZH1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX3N1Ym1pdF9fYWRkX2Jvb2tpbmdfbW9kYWwoKXtcclxuXHJcblx0dmFyICRtb2RhbCA9IGpRdWVyeSggJyN3cGJjX21vZGFsX19hZGRfYm9va2luZ19fc2VjdGlvbicgKTtcclxuXHR2YXIgJGZvcm0gPSAkbW9kYWwuZmluZCggJ2Zvcm0uYm9va2luZ19mb3JtJyApLmZpcnN0KCk7XHJcblx0dmFyIHJlc291cmNlX2lkID0gMDtcclxuXHJcblx0aWYgKCAkZm9ybS5sZW5ndGggKSB7XHJcblx0XHRyZXNvdXJjZV9pZCA9IHBhcnNlSW50KCAoICRmb3JtLmF0dHIoICdpZCcgKSB8fCAnJyApLnJlcGxhY2UoICdib29raW5nX2Zvcm0nLCAnJyApLCAxMCApO1xyXG5cdH1cclxuXHJcblx0aWYgKCAhIHJlc291cmNlX2lkICkge1xyXG5cdFx0cmVzb3VyY2VfaWQgPSBwYXJzZUludCggJG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctcmVzb3VyY2UtaWQnICksIDEwICk7XHJcblx0fVxyXG5cclxuXHRpZiAoICEgcmVzb3VyY2VfaWQgKSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHR2YXIgc3VibWl0X2Zvcm0gPSAkZm9ybS5sZW5ndGggPyAkZm9ybS5nZXQoIDAgKSA6IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnYm9va2luZ19mb3JtJyArIHJlc291cmNlX2lkICk7XHJcblx0dmFyIGxvY2FsZSA9ICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBfd3BiYyApID8gX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAnbG9jYWxlX2FjdGl2ZScgKSA6ICcnO1xyXG5cdHZhciBzdWJtaXRfcmVzdWx0O1xyXG5cclxuXHRpZiAoICEgd3BiY19ib29fbGlzdGluZ19fcHJlcGFyZV9hZGRfYm9va2luZ19tb2RhbF90aW1lX292ZXJyaWRlKCByZXNvdXJjZV9pZCApICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0alF1ZXJ5KCAnYm9keScgKS5vZmYoICd3cGJjX2Jvb2tpbmdfZm9ybV9zdWJtaXRfc3VjY2Vzcy53cGJjX2FkZF9ib29raW5nX21vZGFsX3JlbG9hZCcgKVxyXG5cdFx0Lm9uKCAnd3BiY19ib29raW5nX2Zvcm1fc3VibWl0X3N1Y2Nlc3Mud3BiY19hZGRfYm9va2luZ19tb2RhbF9yZWxvYWQnLCBmdW5jdGlvbiggZXZlbnQsIHN1Ym1pdHRlZF9yZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdFx0aWYgKCBwYXJzZUludCggc3VibWl0dGVkX3Jlc291cmNlX2lkLCAxMCApICE9PSByZXNvdXJjZV9pZCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGpRdWVyeSggJ2JvZHknICkub2ZmKCAnd3BiY19ib29raW5nX2Zvcm1fc3VibWl0X3N1Y2Nlc3Mud3BiY19hZGRfYm9va2luZ19tb2RhbF9yZWxvYWQnICk7XHJcblxyXG5cdFx0XHRpZiAoICEgalF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19zZWN0aW9uJyApLmlzKCAnOnZpc2libGUnICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR3cGJjX2Jvb19saXN0aW5nX19yZWxvYWRfYWZ0ZXJfYWRkX2Jvb2tpbmdfbW9kYWxfc3VibWl0KCk7XHJcblx0XHR9ICk7XHJcblxyXG5cdHN1Ym1pdF9yZXN1bHQgPSB3cGJjX2Jvb2tpbmdfZm9ybV9zdWJtaXQoIHN1Ym1pdF9mb3JtLCByZXNvdXJjZV9pZCwgbG9jYWxlICk7XHJcblxyXG5cdGlmICggZmFsc2UgPT09IHN1Ym1pdF9yZXN1bHQgKSB7XHJcblx0XHRqUXVlcnkoICdib2R5JyApLm9mZiggJ3dwYmNfYm9va2luZ19mb3JtX3N1Ym1pdF9zdWNjZXNzLndwYmNfYWRkX2Jvb2tpbmdfbW9kYWxfcmVsb2FkJyApO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHN1Ym1pdF9yZXN1bHQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDaGFuZ2UgcGF5bWVudCBDb3N0LlxyXG4gKlxyXG4gKiBAcGFyYW0gYm9va2luZ19pZFx0XHRcdC0gSUQgb2YgYm9va2luZy5cclxuICogQHBhcmFtIGNvc3RcdCAgICAgICAgICAgICAgICAtIHBheW1lbnQgY29zdC5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19zZXRfYm9va2luZ19jb3N0KCBib29raW5nX2lkLCBjb3N0ICkge1xyXG5cclxuXHRpZiAoICEgd3BiY19pc19tb2RhbF9hY2Nlc3NpYmxlKCAnI3dwYmNfbW9kYWxfX2Jvb2tpbmdfY29zdF9lZGl0X19zZWN0aW9uJyApICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0Ly8gU2V0IGJvb2tpbmcgY29zdC5cclxuXHRqUXVlcnkoICcjd3BiY19tb2RhbF9fYm9va2luZ19jb3N0X2VkaXRfX3ZhbHVlJyApLnZhbCggY29zdCApO1xyXG5cclxuXHQvLyBTZXQgYm9va2luZyBJRC5cclxuXHRqUXVlcnkoICcjd3BiY19tb2RhbF9fYm9va2luZ19jb3N0X2VkaXRfX2Jvb2tpbmdfaWQnICkudmFsKCBib29raW5nX2lkICk7XHJcblxyXG5cdC8vIElEIHRpdGxlLlxyXG5cdGpRdWVyeSggJy53cGJjX21vZGFsX19ib29raW5nX2Nvc3RfZWRpdF9fYm9va2luZ19pZCcgKS5odG1sKCAnSUQ6ICcgKyBib29raW5nX2lkICk7XHJcblxyXG5cdC8vIFNob3cgTW9kYWwuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2Jvb2tpbmdfY29zdF9lZGl0X19zZWN0aW9uJyApLndwYmNfbXlfbW9kYWwoICdzaG93JyApO1xyXG5cclxuXHQvLyBTZXQgZm9jdXMgdG8gaW5wdXQuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2Jvb2tpbmdfY29zdF9lZGl0X192YWx1ZScgKS50cmlnZ2VyKCAnZm9jdXMnICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDaGFuZ2UgcGF5bWVudCBTdGF0dXMuXHJcbiAqXHJcbiAqIEBwYXJhbSBib29raW5nX2lkXHRcdFx0LSBJRCBvZiBib29raW5nLlxyXG4gKiBAcGFyYW0gc2VsZWN0ZWRfcGF5X3N0YXR1c1x0LSBwYXltZW50IHN0YXR1cy5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19zZXRfcGF5bWVudF9zdGF0dXMoIGJvb2tpbmdfaWQsIHNlbGVjdGVkX3BheV9zdGF0dXMgKSB7XHJcblxyXG5cdGlmICggISB3cGJjX2lzX21vZGFsX2FjY2Vzc2libGUoICcjd3BiY19tb2RhbF9fcGF5bWVudF9zdGF0dXNfZWRpdF9fc2VjdGlvbicgKSApIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cdHZhciBqU2VsZWN0ID0galF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3BheW1lbnRfc3RhdHVzX2VkaXRfX3ZhbHVlJyApO1xyXG5cclxuXHQvLyBTZWxlY3QgU3RhdHVzLlxyXG5cdGlmICggKCAhIGlzTmFOKCBwYXJzZUZsb2F0KCBzZWxlY3RlZF9wYXlfc3RhdHVzICkgKSkgfHwgKCcnID09PSBzZWxlY3RlZF9wYXlfc3RhdHVzKSApIHtcdFx0Ly8gSXMgaXQgZmxvYXQgLSB0aGVuICBpdCdzIHVua25vd24uXHJcblx0XHRqU2VsZWN0LmZpbmQoICdvcHRpb25bdmFsdWU9XCIxXCJdJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKTtcdFx0XHRcdFx0XHRcdFx0Ly8gVW5rbm93biAgdmFsdWUgaXMgJzEnIGluIHNlbGVjdCBib3guXHJcblx0fSBlbHNlIHtcclxuXHRcdGpTZWxlY3QuZmluZCggJ29wdGlvblt2YWx1ZT1cIicgKyBzZWxlY3RlZF9wYXlfc3RhdHVzICsgJ1wiXScgKS5wcm9wKCAnc2VsZWN0ZWQnLCB0cnVlICk7XHRcdC8vIE90aGVyd2lzZSBrbm93biBwYXltZW50IHN0YXR1cy5cclxuXHR9XHJcblx0Ly8gU2V0IGJvb2tpbmcgSUQuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3BheW1lbnRfc3RhdHVzX2VkaXRfX2Jvb2tpbmdfaWQnICkudmFsKCBib29raW5nX2lkICk7XHJcblxyXG5cdC8vIElEIHRpdGxlLlxyXG5cdGpRdWVyeSggJy53cGJjX21vZGFsX19wYXltZW50X3N0YXR1c19lZGl0X19ib29raW5nX2lkJyApLmh0bWwoICdJRDogJyArIGJvb2tpbmdfaWQgKTtcclxuXHJcblx0Ly8gU2hvdyBNb2RhbC5cclxuXHRqUXVlcnkoICcjd3BiY19tb2RhbF9fcGF5bWVudF9zdGF0dXNfZWRpdF9fc2VjdGlvbicgKS53cGJjX215X21vZGFsKCAnc2hvdycgKTtcclxuXHJcblx0Ly8gU2V0IGZvY3VzIHRvIGlucHV0LlxyXG5cdGpRdWVyeSggJyN3cGJjX21vZGFsX19wYXltZW50X3N0YXR1c19lZGl0X192YWx1ZScgKS50cmlnZ2VyKCAnZm9jdXMnICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTZW5kIHBheW1lbnQgcmVxdWVzdFxyXG4gKlxyXG4gKiBAcGFyYW0gYm9va2luZ19pZFxyXG4gKiBAcGFyYW0gdmlzaXRvcmJvb2tpbmdwYXl1cmxcclxuICogQHBhcmFtIGNvc3RcclxuICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19jbGlja19fc2VuZF9wYXltZW50X3JlcXVlc3QoIGJvb2tpbmdfaWQsIHZpc2l0b3Jib29raW5ncGF5dXJsLCBjb3N0ICl7XHJcblxyXG5cdGlmICggISB3cGJjX2lzX21vZGFsX2FjY2Vzc2libGUoICcjd3BiY19tb2RhbF9fc2VuZF9wYXltZW50X3JlcXVlc3RfX3NlY3Rpb24nICkgKSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHQvLyBTZXQgYm9va2luZyBjb3N0LlxyXG5cdGpRdWVyeSggJyN3cGJjX21vZGFsX19zZW5kX3BheW1lbnRfcmVxdWVzdF9fdXJsJyApLnZhbCggdmlzaXRvcmJvb2tpbmdwYXl1cmwgKTtcclxuXHJcblx0Ly8gU2V0IGJvb2tpbmcgSUQuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3NlbmRfcGF5bWVudF9yZXF1ZXN0X19ib29raW5nX2lkJyApLnZhbCggYm9va2luZ19pZCApO1xyXG5cclxuXHQvLyBJRCB0aXRsZS5cclxuXHRqUXVlcnkoICcud3BiY19tb2RhbF9fc2VuZF9wYXltZW50X3JlcXVlc3RfX2Jvb2tpbmdfaWQnICkuaHRtbCggJ0lEOiAnICsgYm9va2luZ19pZCApO1xyXG5cclxuXHQvLyBDb3N0LlxyXG5cdGpRdWVyeSggJy53cGJjX21vZGFsX19zZW5kX3BheW1lbnRfcmVxdWVzdF9fY29zdCcgKS5odG1sKCBjb3N0ICk7XHJcblxyXG5cdC8vIFNob3cgTW9kYWwuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3NlbmRfcGF5bWVudF9yZXF1ZXN0X19zZWN0aW9uJyApLndwYmNfbXlfbW9kYWwoICdzaG93JyApO1xyXG5cclxuXHQvLyBTZXQgZm9jdXMgdG8gaW5wdXQuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3NlbmRfcGF5bWVudF9yZXF1ZXN0X192YWx1ZScgKS50cmlnZ2VyKCAnZm9jdXMnICk7XHJcblxyXG59XHJcblxyXG4vKipcclxuICogU2F2ZSBOb3Rlc1xyXG4gKlxyXG4gKiBAcGFyYW0gYm9va2luZ19pZFxyXG4gKiBAcGFyYW0gbm90ZV90ZXh0XHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fY2xpY2tfX3NldF9ib29raW5nX25vdGUoIGJvb2tpbmdfaWQsIG5vdGVfdGV4dCApe1xyXG5cclxuXHRpZiAoICEgd3BiY19pc19tb2RhbF9hY2Nlc3NpYmxlKCAnI3dwYmNfbW9kYWxfX3NldF9ib29raW5nX25vdGVfX3NlY3Rpb24nICkgKSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHQvLyBTZXQgTm90ZS5cclxuXHRqUXVlcnkoICcjd3BiY19tb2RhbF9fc2V0X2Jvb2tpbmdfbm90ZV9fdmFsdWUnICkudmFsKCBub3RlX3RleHQgKTtcclxuXHJcblx0Ly8gU2V0IGJvb2tpbmcgSUQuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3NldF9ib29raW5nX25vdGVfX2Jvb2tpbmdfaWQnICkudmFsKCBib29raW5nX2lkICk7XHJcblxyXG5cdC8vIElEIHRpdGxlLlxyXG5cdGpRdWVyeSggJy53cGJjX21vZGFsX19zZXRfYm9va2luZ19ub3RlX19ib29raW5nX2lkJyApLmh0bWwoICdJRDogJyArIGJvb2tpbmdfaWQgKTtcclxuXHJcblx0Ly8gU2hvdyBNb2RhbC5cclxuXHRqUXVlcnkoICcjd3BiY19tb2RhbF9fc2V0X2Jvb2tpbmdfbm90ZV9fc2VjdGlvbicgKS53cGJjX215X21vZGFsKCAnc2hvdycgKTtcclxuXHJcblx0Ly8gU2V0IGZvY3VzIHRvIGlucHV0LiAvLyBqUXVlcnkoICcjd3BiY19tb2RhbF9fc2V0X2Jvb2tpbmdfbm90ZV9fdmFsdWUnICkudHJpZ2dlciggJ2ZvY3VzJyApOyAuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3NldF9ib29raW5nX25vdGVfX3ZhbHVlJyApLnNjcm9sbFRvcCggMCApO1xyXG5cclxufVxyXG5cclxuLyoqXHJcbiAqIENoYW5nZSBSZXNvdXJjZSBmb3IgQm9va2luZ1xyXG4gKlxyXG4gKiBAcGFyYW0gYm9va2luZ19pZFx0XHRcdC0gSUQgb2YgYm9va2luZy5cclxuICogQHBhcmFtIHJlc291cmNlX2lkICAgICAgICAgICAtIElEIG9mIGJvb2tpbmcgcmVzb3VyY2UuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19jbGlja19fY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2UoIGJvb2tpbmdfaWQsIHJlc291cmNlX2lkICl7XHJcblxyXG5cdGlmICggISB3cGJjX2lzX21vZGFsX2FjY2Vzc2libGUoICcjd3BiY19tb2RhbF9fY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2VfX3NlY3Rpb24nICkgKSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHQvLyBTZWxlY3QgYm9va2luZyByZXNvdXJjZSAgdGhhdCBiZWxvbmcgdG8gIGJvb2tpbmcuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2NoYW5nZV9ib29raW5nX3Jlc291cmNlX19yZXNvdXJjZV9pZCcgKS52YWwoIHJlc291cmNlX2lkICkudHJpZ2dlciggJ2NoYW5nZScgKTtcclxuXHJcblx0Ly8gU2V0IGJvb2tpbmcgSUQuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2NoYW5nZV9ib29raW5nX3Jlc291cmNlX19ib29raW5nX2lkJyApLnZhbCggYm9va2luZ19pZCApO1xyXG5cdC8vIElEIHRpdGxlLlxyXG5cdGpRdWVyeSggJy53cGJjX21vZGFsX19jaGFuZ2VfYm9va2luZ19yZXNvdXJjZV9fYm9va2luZ19pZCcgKS5odG1sKCAnSUQ6ICcgKyBib29raW5nX2lkICk7XHJcblxyXG5cdC8vIFNob3cgTW9kYWwuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2NoYW5nZV9ib29raW5nX3Jlc291cmNlX19zZWN0aW9uJyApLndwYmNfbXlfbW9kYWwoICdzaG93JyApO1xyXG5cclxuXHQvLyBTZXQgZm9jdXMgdG8gaW5wdXQuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2NoYW5nZV9ib29raW5nX3Jlc291cmNlX19yZXNvdXJjZV9pZCcgKS5mb2N1cygpO1xyXG59XHJcblxyXG4vKipcclxuICogU2V0IHVuYXZhaWxhYmxlIHRpbWVzIGZvciBib29raW5nIHJlc291cmNlIGFuZCBkYXRlcy5cclxuICpcclxuICogQHBhcmFtIGJvb2tpbmdfaWQgICAgSUQgb2YgYm9va2luZy5cclxuICogQHBhcmFtIHJlc291cmNlX2lkICAgSUQgb2YgYm9va2luZyByZXNvdXJjZS5cclxuICogQHBhcmFtIGRhdGVfc3RhcnQgICAgQm9va2luZyBzdGFydCBkYXRlLlxyXG4gKiBAcGFyYW0gZGF0ZV9lbmQgICAgICBCb29raW5nIGVuZCBkYXRlLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fY2xpY2tfX3NldF91bmF2YWlsYWJsZV90aW1lcyggYm9va2luZ19pZCwgcmVzb3VyY2VfaWQsIGRhdGVfc3RhcnQsIGRhdGVfZW5kICl7XHJcblxyXG5cdGlmICggISB3cGJjX2lzX21vZGFsX2FjY2Vzc2libGUoICcjd3BiY19tb2RhbF9fc2V0X3VuYXZhaWxhYmxlX3RpbWVzX19zZWN0aW9uJyApICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0dmFyICRtb2RhbCA9IGpRdWVyeSggJyN3cGJjX21vZGFsX19zZXRfdW5hdmFpbGFibGVfdGltZXNfX3NlY3Rpb24nICk7XHJcblx0dmFyICRwYWdlID0gJG1vZGFsLmZpbmQoICcud3BiY190c19wYWdlJyApLmZpcnN0KCk7XHJcblxyXG5cdGlmICggYm9va2luZ19pZCApIHtcclxuXHRcdGpRdWVyeSggJy53cGJjX21vZGFsX19zZXRfdW5hdmFpbGFibGVfdGltZXNfX2Jvb2tpbmdfaWQnICkuaHRtbCggJ0lEOiAnICsgYm9va2luZ19pZCApO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRqUXVlcnkoICcud3BiY19tb2RhbF9fc2V0X3VuYXZhaWxhYmxlX3RpbWVzX19ib29raW5nX2lkJyApLmh0bWwoICcnICk7XHJcblx0fVxyXG5cclxuXHQkbW9kYWwud3BiY19teV9tb2RhbCggJ3Nob3cnICk7XHJcblxyXG5cdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX2F2YWlsYWJpbGl0eV90aW1lc2xvdHNfaW5pdCApIHtcclxuXHRcdHdpbmRvdy53cGJjX2F2YWlsYWJpbGl0eV90aW1lc2xvdHNfaW5pdCggJHBhZ2UgKTtcclxuXHR9XHJcblxyXG5cdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX2F2YWlsYWJpbGl0eV90aW1lc2xvdHNfc2V0X2NvbnRleHQgKSB7XHJcblx0XHR3aW5kb3cud3BiY19hdmFpbGFiaWxpdHlfdGltZXNsb3RzX3NldF9jb250ZXh0KFxyXG5cdFx0XHQkcGFnZSxcclxuXHRcdFx0e1xyXG5cdFx0XHRcdHJlc291cmNlX2lkOiByZXNvdXJjZV9pZCxcclxuXHRcdFx0XHRkYXRlX3N0YXJ0OiBkYXRlX3N0YXJ0LFxyXG5cdFx0XHRcdGRhdGVfZW5kOiBkYXRlX2VuZFxyXG5cdFx0XHR9XHJcblx0XHQpO1xyXG5cdH1cclxufVxyXG5cclxuLyoqXHJcbiAqIER1cGxpY2F0ZSBCb29raW5nIGludG8gYW5vdGhlciByZXNvdXJjZS5cclxuICpcclxuICogQHBhcmFtIGJvb2tpbmdfaWRcdFx0XHQtIElEIG9mIGJvb2tpbmcuXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZCAgICAgICAgICAgLSBJRCBvZiBib29raW5nIHJlc291cmNlLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fY2xpY2tfX2R1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlKCBib29raW5nX2lkLCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRpZiAoICEgd3BiY19pc19tb2RhbF9hY2Nlc3NpYmxlKCAnI3dwYmNfbW9kYWxfX2R1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlX19zZWN0aW9uJyApICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0Ly8gU2VsZWN0IGJvb2tpbmcgcmVzb3VyY2UgIHRoYXQgYmVsb25nIHRvICBib29raW5nLlxyXG5cdGpRdWVyeSggJyN3cGJjX21vZGFsX19kdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZV9fcmVzb3VyY2VfaWQnICkudmFsKCByZXNvdXJjZV9pZCApLnRyaWdnZXIoICdjaGFuZ2UnICk7XHJcblxyXG5cdC8vIFNldCBib29raW5nIElELlxyXG5cdGpRdWVyeSggJyN3cGJjX21vZGFsX19kdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZV9fYm9va2luZ19pZCcgKS52YWwoIGJvb2tpbmdfaWQgKTtcclxuXHQvLyBJRCB0aXRsZS5cclxuXHRqUXVlcnkoICcud3BiY19tb2RhbF9fZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2VfX2Jvb2tpbmdfaWQnICkuaHRtbCggJ0lEOiAnICsgYm9va2luZ19pZCApO1xyXG5cclxuXHQvLyBTaG93IE1vZGFsLlxyXG5cdGpRdWVyeSggJyN3cGJjX21vZGFsX19kdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZV9fc2VjdGlvbicgKS53cGJjX215X21vZGFsKCAnc2hvdycgKTtcclxuXHJcblx0Ly8gU2V0IGZvY3VzIHRvIGlucHV0LlxyXG5cdGpRdWVyeSggJyN3cGJjX21vZGFsX19kdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZV9fcmVzb3VyY2VfaWQnICkuZm9jdXMoKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENoYW5nZSBMb2NhbGUgb2YgQm9va2luZy5cclxuICpcclxuICogQHBhcmFtIGJvb2tpbmdfaWRcdFx0XHQtIElEIG9mIGJvb2tpbmcuXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZCAgICAgICAgICAgLSBJRCBvZiBib29raW5nIHJlc291cmNlLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fY2xpY2tfX3NldF9ib29raW5nX2xvY2FsZSggYm9va2luZ19pZCwgc2VsZWN0ZWRfbG9jYWxlX3ZhbHVlICl7XHJcblxyXG5cdGlmICggISB3cGJjX2lzX21vZGFsX2FjY2Vzc2libGUoICcjd3BiY19tb2RhbF9fc2V0X2Jvb2tpbmdfbG9jYWxlX19zZWN0aW9uJyApICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0Ly8gU2VsZWN0IGJvb2tpbmcgTG9jYWxlICB0aGF0IGJlbG9uZyB0byAgYm9va2luZy5cclxuXHRqUXVlcnkoICcjd3BiY19tb2RhbF9fc2V0X2Jvb2tpbmdfbG9jYWxlJyApLnZhbCggc2VsZWN0ZWRfbG9jYWxlX3ZhbHVlICkudHJpZ2dlciggJ2NoYW5nZScgKTtcclxuXHJcblx0Ly8gdmFyIGpTZWxlY3QgPSBqUXVlcnkoICcjc2V0X2Jvb2tpbmdfbG9jYWxlX19yZXNvdXJjZV9zZWxlY3QnICk7XHJcblx0Ly8galNlbGVjdC5maW5kKCAnb3B0aW9uW3ZhbHVlPVwiJyArIHJlc291cmNlX2lkICsgJ1wiXScgKS5wcm9wKCAnc2VsZWN0ZWQnLCB0cnVlICk7XHRcdC8vIE90aGVyd2lzZSBrbm93biBwYXltZW50IHN0YXR1cy5cclxuXHJcblx0Ly8gU2V0IGJvb2tpbmcgSUQuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3NldF9ib29raW5nX2xvY2FsZV9fYm9va2luZ19pZCcgKS52YWwoIGJvb2tpbmdfaWQgKTtcclxuXHQvLyBJRCB0aXRsZS5cclxuXHRqUXVlcnkoICcud3BiY19tb2RhbF9fc2V0X2Jvb2tpbmdfbG9jYWxlX19ib29raW5nX2lkJyApLmh0bWwoICdJRDogJyArIGJvb2tpbmdfaWQgKTtcclxuXHJcblx0Ly8gU2hvdyBNb2RhbC5cclxuXHRqUXVlcnkoICcjd3BiY19tb2RhbF9fc2V0X2Jvb2tpbmdfbG9jYWxlX19zZWN0aW9uJyApLndwYmNfbXlfbW9kYWwoICdzaG93JyApO1xyXG5cclxuXHQvLyBTZXQgZm9jdXMgdG8gaW5wdXQuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3NldF9ib29raW5nX2xvY2FsZScgKS5mb2N1cygpO1xyXG59XHJcblxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vID09IEZpbHRlciBUb29sYmFyID09XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vKipcclxuICogPT0gXCJTb3J0IEJ5XCIgQnV0dG9uID09XHJcbiAqIFRoaXMgZnVuY3Rpb24gdXBkYXRlIFRpdGxlIGluIERyb3Bkb3duIG1lbnUuXHJcbiAqIEl0IGV4ZWN1dGVkLCBhZnRlciByZWNldmluZyBBamF4IHJlc3BvbnNlLlxyXG4gKiBBbmQgYmFzZWQgb24gcGFyYW1ldGVycyBvZiB0aGlzIHJlc3BvbnNlLCB3ZSBnZXQgb3B0aW9uIHRpdGxlIGZyb20gZHJvcGRvd24gbGlzdCBvcHRpb25zIGFuZCBzaG93IGl0IGluIHRvZ2dsZSB0aXRsZS5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX2luaXRfaG9va19fc29ydF9ieSgpIHtcclxuXHJcblx0dmFyIGVsX2lkID0gJ3doX3NvcnQnO1xyXG5cclxuXHR2YXIgcGFyYW1ldGVyX3ZhbHVlID0gd3BiY19hanhfYm9va2luZ19saXN0aW5nLnNlYXJjaF9nZXRfcGFyYW0oIGVsX2lkICk7XHJcblxyXG5cdHZhciBqX29wdGlvbl9saW5rID0galF1ZXJ5KCAnLnVsX2Ryb3Bkb3duX21lbnVfbGlfXycgKyBlbF9pZCArICdfXycgKyBwYXJhbWV0ZXJfdmFsdWUgKTtcclxuXHRpZiAoIGpfb3B0aW9uX2xpbmsubGVuZ3RoICkge1xyXG5cdFx0alF1ZXJ5KCAnLnVsX2Ryb3Bkb3duX21lbnVfXycgKyBlbF9pZCArICcgLnVsX2Ryb3Bkb3duX21lbnVfdG9nZ2xlIC5zZWxlY3RlZF92YWx1ZScgKS5odG1sKCBqX29wdGlvbl9saW5rLmh0bWwoKSApO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRqUXVlcnkoICcudWxfZHJvcGRvd25fbWVudV9fJyArIGVsX2lkICsgJyAudWxfZHJvcGRvd25fbWVudV90b2dnbGUgLnNlbGVjdGVkX3ZhbHVlJyApLmh0bWwoICctLS0nICk7XHJcblx0fVxyXG59XHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLy8gPT0gTGlzdGluZyBIZWFkZXIgVGFibGUgPT1cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8qKlxyXG4gKiA9PSBcIkV4cGFuZCBBbGwgUm93c1wiIEJ1dHRvbiA9PVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fY2xpY2tfX2V4cGFuZF9hbGxfcm93cygpIHtcclxuXHRqUXVlcnkoICcud3BiY19yb3dfd3JhcCcgKS5yZW1vdmVDbGFzcyggJ21heF9oZWlnaHRfYScgKTtcclxuXHRqUXVlcnkoICcud3BiY19yb3dfd3JhcCAud3BiY19pY25fZXhwYW5kX2xlc3MnICkuc2hvdygpO1xyXG5cdGpRdWVyeSggJy53cGJjX3Jvd193cmFwIC53cGJjX2ljbl9leHBhbmRfbW9yZScgKS5oaWRlKCk7XHJcblx0alF1ZXJ5KCAnLndwYmNfYnRuX2V4cGFuZF9jb2xhcHNlX2FsbCcgKS50b2dnbGUoKTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiA9PSBcIkNvbHBhc2UgQWxsIFJvd3NcIiBCdXR0b24gPT1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19jb2xhcHNlX2FsbF9yb3dzKCkge1xyXG5cdGpRdWVyeSggJy53cGJjX3Jvd193cmFwJyApLmFkZENsYXNzKCAnbWF4X2hlaWdodF9hJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3Jvd193cmFwIC53cGJjX2ljbl9leHBhbmRfbGVzcycgKS5oaWRlKCk7XHJcblx0alF1ZXJ5KCAnLndwYmNfcm93X3dyYXAgLndwYmNfaWNuX2V4cGFuZF9tb3JlJyApLnNob3coKTtcclxuXHRqUXVlcnkoICcud3BiY19idG5fZXhwYW5kX2NvbGFwc2VfYWxsJyApLnRvZ2dsZSgpO1xyXG59XHJcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0Esd0JBQXdCQSxDQUFFQyxPQUFPLEVBQUc7RUFDNUMsSUFBSyxVQUFVLEtBQUssT0FBUUMsTUFBTSxDQUFFRCxPQUFRLENBQUMsQ0FBQ0UsYUFBYyxFQUFHO0lBQzlEQyxLQUFLLENBQUUsaUhBQWtILENBQUM7SUFDMUgsT0FBTyxLQUFLO0VBQ2I7RUFDQSxPQUFPLElBQUk7QUFDWjs7QUFHQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0MsbURBQW1EQSxDQUFFQyxVQUFVLEVBQUVDLFdBQVcsRUFBRUMsWUFBWSxFQUFFQyxZQUFZLEVBQUU7RUFFbEgsSUFBSyxDQUFFRCxZQUFZLEVBQUc7SUFDckIsT0FBTyxLQUFLO0VBQ2I7RUFFQSxPQUFPRSwwQ0FBMEMsQ0FBRTtJQUNsREMsSUFBSSxFQUFXLE1BQU07SUFDckJMLFVBQVUsRUFBS0EsVUFBVSxJQUFJLEVBQUU7SUFDL0JDLFdBQVcsRUFBSUEsV0FBVyxJQUFJLEVBQUU7SUFDaENDLFlBQVksRUFBR0EsWUFBWSxJQUFJLEVBQUU7SUFDakNDLFlBQVksRUFBR0EsWUFBWSxJQUFJO0VBQ2hDLENBQUUsQ0FBQztBQUNKOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNHLGlEQUFpREEsQ0FBRUMsS0FBSyxFQUFFQyxJQUFJLEVBQUU7RUFFeEUsSUFBSUMsS0FBSyxHQUFNYixNQUFNLENBQUUsU0FBVSxDQUFDLENBQUNjLE1BQU0sQ0FBRWQsTUFBTSxDQUFDZSxTQUFTLENBQUVILElBQUksSUFBSSxFQUFFLEVBQUVJLFFBQVEsRUFBRSxJQUFLLENBQUUsQ0FBQztFQUMzRixJQUFJQyxRQUFRLEdBQUdKLEtBQUssQ0FBQ0ssSUFBSSxDQUFFLFFBQVMsQ0FBQyxDQUFDQyxNQUFNLENBQUMsQ0FBQztFQUU5Q1IsS0FBSyxDQUFDQyxJQUFJLENBQUVDLEtBQUssQ0FBQ08sUUFBUSxDQUFDLENBQUUsQ0FBQztFQUU5QkgsUUFBUSxDQUFDSSxJQUFJLENBQUUsWUFBVTtJQUN4QixJQUFJQyxJQUFJLEdBQUcsQ0FBRXRCLE1BQU0sQ0FBRSxJQUFLLENBQUMsQ0FBQ3VCLElBQUksQ0FBRSxNQUFPLENBQUMsSUFBSSxFQUFFLEVBQUdDLFdBQVcsQ0FBQyxDQUFDO0lBQ2hFLElBQUlDLEdBQUcsR0FBSXpCLE1BQU0sQ0FBRSxJQUFLLENBQUMsQ0FBQ3VCLElBQUksQ0FBRSxLQUFNLENBQUM7SUFDdkMsSUFBSUcsSUFBSSxHQUFHLElBQUksQ0FBQ0MsSUFBSSxJQUFJLElBQUksQ0FBQ0MsV0FBVyxJQUFJLElBQUksQ0FBQ0MsU0FBUyxJQUFJLEVBQUU7SUFFaEUsSUFBS1AsSUFBSSxJQUFJLENBQUUsdUNBQXVDLENBQUNRLElBQUksQ0FBRVIsSUFBSyxDQUFDLEVBQUc7TUFDckU7SUFDRDtJQUVBLElBQUtHLEdBQUcsRUFBRztNQUNWekIsTUFBTSxDQUFDK0IsSUFBSSxDQUFFO1FBQ1pDLEdBQUcsRUFBUVAsR0FBRztRQUNkUSxRQUFRLEVBQUcsUUFBUTtRQUNuQkMsS0FBSyxFQUFNLElBQUk7UUFDZkMsS0FBSyxFQUFNO01BQ1osQ0FBRSxDQUFDO01BQ0g7SUFDRDtJQUVBLElBQUtULElBQUksRUFBRztNQUNYMUIsTUFBTSxDQUFDb0MsVUFBVSxDQUFFVixJQUFLLENBQUM7SUFDMUI7RUFDRCxDQUFFLENBQUM7QUFDSjs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU1csb0RBQW9EQSxDQUFBLEVBQUU7RUFDOUQsT0FBTyw0Q0FBNEMsR0FDaEQsNkNBQTZDLEdBQzdDLHlDQUF5QyxHQUN6Qyw4Q0FBOEMsR0FDOUMsUUFBUSxHQUNSLFFBQVEsR0FDUix5QkFBeUIsR0FDekIsUUFBUTtBQUNaOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNDLHNDQUFzQ0EsQ0FBRUMsS0FBSyxFQUFFO0VBQ3ZELE9BQU9DLE1BQU0sQ0FBRUQsS0FBSyxJQUFJLEVBQUcsQ0FBQyxDQUFDRSxPQUFPLENBQUUsTUFBTSxFQUFFLEVBQUcsQ0FBQyxDQUFDakIsV0FBVyxDQUFDLENBQUM7QUFDakU7QUFFQSxTQUFTa0IsMkJBQTJCQSxDQUFFSCxLQUFLLEVBQUU7RUFDNUMsT0FBT0MsTUFBTSxDQUFFRCxLQUFLLElBQUksRUFBRyxDQUFDLENBQUNFLE9BQU8sQ0FBRSxZQUFZLEVBQUUsRUFBRyxDQUFDO0FBQ3pEOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNFLDJDQUEyQ0EsQ0FBRUMsYUFBYSxFQUFFO0VBRXBFLElBQUlDLFVBQVUsR0FBR0wsTUFBTSxDQUFFSSxhQUFhLElBQUksRUFBRyxDQUFDLENBQUNFLEtBQUssQ0FBRSxLQUFNLENBQUM7RUFFN0QsT0FBTztJQUNOQyxVQUFVLEVBQUVMLDJCQUEyQixDQUFFRyxVQUFVLENBQUMsQ0FBQyxDQUFFLENBQUM7SUFDeERHLFFBQVEsRUFBRU4sMkJBQTJCLENBQUVHLFVBQVUsQ0FBQyxDQUFDLENBQUU7RUFDdEQsQ0FBQztBQUNGO0FBRUEsU0FBU0ksc0NBQXNDQSxDQUFFQyxjQUFjLEVBQUU7RUFFaEUsSUFBSUMsS0FBSyxHQUFHLEVBQUU7RUFDZCxJQUFJQyxJQUFJLEdBQUcsQ0FBQyxDQUFDO0VBRWIsSUFBS0MsS0FBSyxDQUFDQyxPQUFPLENBQUVKLGNBQWUsQ0FBQyxFQUFHO0lBQ3RDQyxLQUFLLEdBQUdELGNBQWM7RUFDdkIsQ0FBQyxNQUFNO0lBQ05DLEtBQUssR0FBR1gsTUFBTSxDQUFFVSxjQUFjLElBQUksRUFBRyxDQUFDLENBQUNKLEtBQUssQ0FBRSxHQUFJLENBQUM7RUFDcEQ7RUFFQUssS0FBSyxHQUFHbkQsTUFBTSxDQUFDdUQsR0FBRyxDQUFFSixLQUFLLEVBQUUsVUFBVUssSUFBSSxFQUFFO0lBQzFDQSxJQUFJLEdBQUdkLDJCQUEyQixDQUFFYyxJQUFLLENBQUM7SUFDMUMsSUFBSyxDQUFFQSxJQUFJLElBQUlKLElBQUksQ0FBRUksSUFBSSxDQUFFLEVBQUc7TUFDN0IsT0FBTyxJQUFJO0lBQ1o7SUFDQUosSUFBSSxDQUFFSSxJQUFJLENBQUUsR0FBRyxJQUFJO0lBQ25CLE9BQU9BLElBQUk7RUFDWixDQUFFLENBQUM7RUFFSCxPQUFPTCxLQUFLO0FBQ2I7QUFFQSxTQUFTTSxxREFBcURBLENBQUVwRCxXQUFXLEVBQUVxRCxTQUFTLEVBQUU7RUFDdkYsSUFBSUMsTUFBTSxHQUFHM0QsTUFBTSxDQUFFLG1DQUFvQyxDQUFDO0VBQzFELElBQUk0RCxhQUFhO0VBRWpCLElBQ0ksQ0FBRUYsU0FBUyxJQUNYLENBQUVyRCxXQUFXLElBQ2IsV0FBVyxLQUFLLE9BQU93RCxLQUFLLElBQzVCLFVBQVUsS0FBSyxPQUFPQSxLQUFLLENBQUNDLHlCQUF5QixJQUNyRCxVQUFVLEtBQUssT0FBT0QsS0FBSyxDQUFDRSx5QkFBeUIsRUFDdkQ7SUFDRDtFQUNEO0VBRUEsSUFBSyxXQUFXLEtBQUssT0FBT0osTUFBTSxDQUFDcEMsSUFBSSxDQUFFLGlEQUFrRCxDQUFDLEVBQUc7SUFDOUZxQyxhQUFhLEdBQUdDLEtBQUssQ0FBQ0MseUJBQXlCLENBQUV6RCxXQUFXLEVBQUUsa0JBQW1CLENBQUM7SUFDbEZzRCxNQUFNLENBQUNwQyxJQUFJLENBQUUsaURBQWlELEVBQUVpQixNQUFNLENBQUVvQixhQUFhLElBQUksRUFBRyxDQUFFLENBQUM7SUFDL0ZELE1BQU0sQ0FBQ3BDLElBQUksQ0FBRSx3REFBd0QsRUFBRWlCLE1BQU0sQ0FBRW5DLFdBQVksQ0FBRSxDQUFDO0VBQy9GO0VBRUFzRCxNQUFNLENBQUNLLEdBQUcsQ0FBRSx1R0FBd0csQ0FBQyxDQUFDQyxFQUFFLENBQ3ZILHVHQUF1RyxFQUN2RyxZQUFVO0lBQ1QsSUFBSUMsaUJBQWlCLEdBQUdDLFFBQVEsQ0FBRVIsTUFBTSxDQUFDcEMsSUFBSSxDQUFFLHdEQUF5RCxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUcsQ0FBQztJQUNwSCxJQUFJNkMsWUFBWSxHQUFHVCxNQUFNLENBQUNwQyxJQUFJLENBQUUsaURBQWtELENBQUM7SUFFbkYsSUFDSTJDLGlCQUFpQixJQUNqQixXQUFXLEtBQUssT0FBT0UsWUFBWSxJQUNuQyxXQUFXLEtBQUssT0FBT1AsS0FBSyxJQUM1QixVQUFVLEtBQUssT0FBT0EsS0FBSyxDQUFDRSx5QkFBeUIsRUFDdkQ7TUFDREYsS0FBSyxDQUFDRSx5QkFBeUIsQ0FBRUcsaUJBQWlCLEVBQUUsa0JBQWtCLEVBQUVFLFlBQVksSUFBSSxFQUFHLENBQUM7SUFDN0Y7SUFFQVQsTUFBTSxDQUNKVSxVQUFVLENBQUUsaURBQWtELENBQUMsQ0FDL0RBLFVBQVUsQ0FBRSx3REFBeUQsQ0FBQztFQUN6RSxDQUNELENBQUM7QUFDRjtBQUVBLFNBQVNDLGlDQUFpQ0EsQ0FBRUMsUUFBUSxFQUFFO0VBQ3JELElBQUlDLFNBQVMsR0FBR2hDLE1BQU0sQ0FBRStCLFFBQVEsSUFBSSxFQUFHLENBQUMsQ0FBQ3pCLEtBQUssQ0FBRSxHQUFJLENBQUM7RUFFckQsSUFBSyxDQUFDLEtBQUswQixTQUFTLENBQUNDLE1BQU0sRUFBRztJQUM3QixPQUFPLEVBQUU7RUFDVjtFQUVBLE9BQU9ELFNBQVMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLEdBQUdBLFNBQVMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLEdBQUdBLFNBQVMsQ0FBQyxDQUFDLENBQUM7QUFDOUQ7QUFFQSxTQUFTRSxxREFBcURBLENBQUVyRSxXQUFXLEVBQUU2QyxjQUFjLEVBQUU7RUFDNUYsSUFBSXlCLGVBQWUsR0FBRzNFLE1BQU0sQ0FBQ3VELEdBQUcsQ0FBRUwsY0FBYyxFQUFFLFVBQVVNLElBQUksRUFBRTtJQUNqRSxPQUFPYyxpQ0FBaUMsQ0FBRWQsSUFBSyxDQUFDO0VBQ2pELENBQUUsQ0FBQztFQUNILElBQUlvQixTQUFTLEdBQUdELGVBQWUsQ0FBQ0UsSUFBSSxDQUFFLElBQUssQ0FBQztFQUU1QzdFLE1BQU0sQ0FBRSxlQUFlLEdBQUdLLFdBQVksQ0FBQyxDQUFDeUUsR0FBRyxDQUFFRixTQUFVLENBQUM7RUFFeEQsSUFBSyxVQUFVLEtBQUssT0FBT0csd0NBQXdDLEVBQUc7SUFDckVBLHdDQUF3QyxDQUFFMUUsV0FBWSxDQUFDO0VBQ3hEO0VBRUFMLE1BQU0sQ0FBRSxtQkFBb0IsQ0FBQyxDQUFDZ0YsT0FBTyxDQUFFLGVBQWUsRUFBRSxDQUFFM0UsV0FBVyxFQUFFdUUsU0FBUyxFQUFFMUIsY0FBYyxDQUFHLENBQUM7QUFDckc7QUFFQSxTQUFTK0IsK0NBQStDQSxDQUFFNUUsV0FBVyxFQUFFNkMsY0FBYyxFQUFFZ0MsaUJBQWlCLEVBQUU7RUFDekcsSUFBSUMsUUFBUSxHQUFHLENBQUM7RUFDaEIsSUFBSUMsV0FBVyxHQUFHLEVBQUU7RUFDcEIsSUFBSUMsU0FBUyxHQUFHLDREQUE0RDtFQUM1RSxJQUFJQyxjQUFjO0VBRWxCLElBQ0ksQ0FBRXBDLGNBQWMsQ0FBQ3VCLE1BQU0sSUFDckIsVUFBVSxLQUFLLE9BQU9jLGtDQUFvQyxFQUM5RDtJQUNEO0VBQ0Q7RUFFQUQsY0FBYyxHQUFHLFNBQUFBLENBQUEsRUFBVTtJQUMxQixJQUFJRSxhQUFhO0lBRWpCTCxRQUFRLEVBQUU7SUFFVixJQUNJRCxpQkFBaUIsSUFDZixXQUFXLEtBQUssT0FBT3JCLEtBQU8sSUFDOUIsVUFBVSxLQUFLLE9BQU9BLEtBQUssQ0FBQ0MseUJBQTJCLElBQ3ZELFVBQVUsS0FBS0QsS0FBSyxDQUFDQyx5QkFBeUIsQ0FBRXpELFdBQVcsRUFBRSxrQkFBbUIsQ0FBRyxFQUN2RjtNQUNEb0QscURBQXFELENBQUVwRCxXQUFXLEVBQUUsSUFBSyxDQUFDO01BQzFFLElBQUssVUFBVSxLQUFLLE9BQU93RCxLQUFLLENBQUNFLHlCQUF5QixFQUFHO1FBQzVERixLQUFLLENBQUNFLHlCQUF5QixDQUFFMUQsV0FBVyxFQUFFLGtCQUFrQixFQUFFLFVBQVcsQ0FBQztNQUMvRTtJQUNEO0lBRUFtRixhQUFhLEdBQUdELGtDQUFrQyxDQUFFbEYsV0FBVyxFQUFFNkMsY0FBZSxDQUFDO0lBQ2pGLElBQUtzQyxhQUFhLElBQUl0QyxjQUFjLENBQUN1QixNQUFNLEVBQUc7TUFDN0NDLHFEQUFxRCxDQUFFckUsV0FBVyxFQUFFNkMsY0FBZSxDQUFDO01BQ3BGbEQsTUFBTSxDQUFFLE1BQU8sQ0FBQyxDQUFDZ0UsR0FBRyxDQUFFcUIsU0FBVSxDQUFDO01BQ2pDLE9BQU8sSUFBSTtJQUNaO0lBRUEsT0FBTyxLQUFLO0VBQ2IsQ0FBQztFQUVEckYsTUFBTSxDQUFFLE1BQU8sQ0FBQyxDQUFDZ0UsR0FBRyxDQUFFcUIsU0FBVSxDQUFDLENBQUNwQixFQUFFLENBQUVvQixTQUFTLEVBQUUsVUFBVUksS0FBSyxFQUFFQyxrQkFBa0IsRUFBRTtJQUNyRixJQUFLdkIsUUFBUSxDQUFFdUIsa0JBQWtCLEVBQUUsRUFBRyxDQUFDLEtBQUtyRixXQUFXLEVBQUc7TUFDekRpRixjQUFjLENBQUMsQ0FBQztJQUNqQjtFQUNELENBQUUsQ0FBQztFQUVISyxNQUFNLENBQUNDLFVBQVUsQ0FBRSxTQUFTQyxjQUFjQSxDQUFBLEVBQUU7SUFDM0MsSUFBS1AsY0FBYyxDQUFDLENBQUMsRUFBRztNQUN2QjtJQUNEO0lBQ0EsSUFBS0gsUUFBUSxHQUFHQyxXQUFXLEVBQUc7TUFDN0JPLE1BQU0sQ0FBQ0MsVUFBVSxDQUFFQyxjQUFjLEVBQUUsR0FBSSxDQUFDO0lBQ3pDO0VBQ0QsQ0FBQyxFQUFFLEdBQUksQ0FBQztBQUNUO0FBRUEsU0FBU0MsNkNBQTZDQSxDQUFFQyxJQUFJLEVBQUU3QyxjQUFjLEVBQUU7RUFDN0UsT0FDSTZDLElBQUksSUFDSixDQUFFN0MsY0FBYyxJQUFJLEVBQUUsRUFBR3VCLE1BQU0sR0FBRyxDQUFDLElBQ25DLENBQUMsQ0FBRU4sUUFBUSxDQUFFNEIsSUFBSSxDQUFDQyxxQkFBcUIsSUFBSSxDQUFDLEVBQUUsRUFBRyxDQUFDLElBQ2xELG9CQUFvQixLQUFLeEQsTUFBTSxDQUFFdUQsSUFBSSxDQUFDRSxvQkFBb0IsSUFBSSxFQUFHLENBQUM7QUFFdkU7QUFFQSxTQUFTQyxtREFBbURBLENBQUU3RixXQUFXLEVBQUVxRCxTQUFTLEVBQUU7RUFDckYsSUFBSUMsTUFBTSxHQUFHM0QsTUFBTSxDQUFFLG1DQUFvQyxDQUFDO0VBQzFELElBQUk0RCxhQUFhO0VBRWpCRCxNQUFNLENBQUNwQyxJQUFJLENBQUUsNENBQTRDLEVBQUVtQyxTQUFTLEdBQUcsR0FBRyxHQUFHLEdBQUksQ0FBQztFQUVsRixJQUNJLENBQUVBLFNBQVMsSUFDWCxDQUFFckQsV0FBVyxJQUNiLFdBQVcsS0FBSyxPQUFPd0QsS0FBSyxJQUM1QixVQUFVLEtBQUssT0FBT0EsS0FBSyxDQUFDQyx5QkFBeUIsSUFDckQsVUFBVSxLQUFLLE9BQU9ELEtBQUssQ0FBQ0UseUJBQXlCLEVBQ3ZEO0lBQ0Q7RUFDRDtFQUVBLElBQUssV0FBVyxLQUFLLE9BQU9KLE1BQU0sQ0FBQ3BDLElBQUksQ0FBRSwrQ0FBZ0QsQ0FBQyxFQUFHO0lBQzVGcUMsYUFBYSxHQUFHQyxLQUFLLENBQUNDLHlCQUF5QixDQUFFekQsV0FBVyxFQUFFLHdCQUF5QixDQUFDO0lBQ3hGc0QsTUFBTSxDQUFDcEMsSUFBSSxDQUFFLCtDQUErQyxFQUFFaUIsTUFBTSxDQUFFb0IsYUFBYSxJQUFJLEVBQUcsQ0FBRSxDQUFDO0lBQzdGRCxNQUFNLENBQUNwQyxJQUFJLENBQUUsc0RBQXNELEVBQUVpQixNQUFNLENBQUVuQyxXQUFZLENBQUUsQ0FBQztFQUM3RjtFQUVBd0QsS0FBSyxDQUFDRSx5QkFBeUIsQ0FBRTFELFdBQVcsRUFBRSx3QkFBd0IsRUFBRSxJQUFLLENBQUM7RUFFOUVzRCxNQUFNLENBQUNLLEdBQUcsQ0FBRSxtR0FBb0csQ0FBQyxDQUFDQyxFQUFFLENBQ25ILG1HQUFtRyxFQUNuRyxZQUFVO0lBQ1QsSUFBSUMsaUJBQWlCLEdBQUdDLFFBQVEsQ0FBRVIsTUFBTSxDQUFDcEMsSUFBSSxDQUFFLHNEQUF1RCxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUcsQ0FBQztJQUNsSCxJQUFJNkMsWUFBWSxHQUFHVCxNQUFNLENBQUNwQyxJQUFJLENBQUUsK0NBQWdELENBQUM7SUFFakYsSUFDSTJDLGlCQUFpQixJQUNqQixXQUFXLEtBQUssT0FBT0UsWUFBWSxJQUNuQyxXQUFXLEtBQUssT0FBT1AsS0FBSyxJQUM1QixVQUFVLEtBQUssT0FBT0EsS0FBSyxDQUFDRSx5QkFBeUIsRUFDdkQ7TUFDREYsS0FBSyxDQUFDRSx5QkFBeUIsQ0FBRUcsaUJBQWlCLEVBQUUsd0JBQXdCLEVBQUVFLFlBQVksSUFBSSxLQUFNLENBQUM7SUFDdEc7SUFFQVQsTUFBTSxDQUNKVSxVQUFVLENBQUUsK0NBQWdELENBQUMsQ0FDN0RBLFVBQVUsQ0FBRSxzREFBdUQsQ0FBQyxDQUNwRTlDLElBQUksQ0FBRSw0Q0FBNEMsRUFBRSxHQUFJLENBQUM7RUFDNUQsQ0FDRCxDQUFDO0FBQ0Y7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTNEUsbURBQW1EQSxDQUFFQyxLQUFLLEVBQUUvRixXQUFXLEVBQUU7RUFFakYsSUFBSWdHLFFBQVEsR0FBRyxDQUNkLHdCQUF3QixHQUFHaEcsV0FBVyxHQUFHLElBQUksRUFDN0Msd0JBQXdCLEdBQUdBLFdBQVcsR0FBRyxNQUFNLEVBQy9DLHdCQUF3QixHQUFHQSxXQUFXLEdBQUcsSUFBSSxFQUM3Qyx3QkFBd0IsR0FBR0EsV0FBVyxHQUFHLE1BQU0sRUFDL0Msc0JBQXNCLEdBQUdBLFdBQVcsR0FBRyxJQUFJLEVBQzNDLHNCQUFzQixHQUFHQSxXQUFXLEdBQUcsTUFBTSxFQUM3QywyQkFBMkIsR0FBR0EsV0FBVyxHQUFHLElBQUksRUFDaEQsMkJBQTJCLEdBQUdBLFdBQVcsR0FBRyxNQUFNLEVBQ2xELHVCQUF1QixHQUFHQSxXQUFXLEdBQUcsSUFBSSxFQUM1QyxxQkFBcUIsR0FBR0EsV0FBVyxHQUFHLElBQUksQ0FDMUMsQ0FBQ3dFLElBQUksQ0FBRSxJQUFLLENBQUM7RUFFZCxPQUFPdUIsS0FBSyxDQUFDbEYsSUFBSSxDQUFFbUYsUUFBUyxDQUFDLENBQUNDLE1BQU0sQ0FBRSxZQUFVO0lBQy9DLElBQUlDLE1BQU0sR0FBR3ZHLE1BQU0sQ0FBRSxJQUFLLENBQUM7SUFFM0IsSUFBS3VHLE1BQU0sQ0FBQ0MsT0FBTyxDQUFFLCtDQUFnRCxDQUFDLENBQUMvQixNQUFNLEVBQUc7TUFDL0UsT0FBTyxLQUFLO0lBQ2I7SUFFQSxJQUFLLE9BQU8sS0FBSyxJQUFJLENBQUNnQyxPQUFPLENBQUNqRixXQUFXLENBQUMsQ0FBQyxJQUFJLFFBQVEsS0FBS2dCLE1BQU0sQ0FBRStELE1BQU0sQ0FBQ2hGLElBQUksQ0FBRSxNQUFPLENBQUMsSUFBSSxFQUFHLENBQUMsQ0FBQ0MsV0FBVyxDQUFDLENBQUMsRUFBRztNQUNqSCxPQUFPLEtBQUs7SUFDYjtJQUVBLE9BQU8sSUFBSTtFQUNaLENBQUUsQ0FBQztBQUNKOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU2tGLG9DQUFvQ0EsQ0FBRUMsT0FBTyxFQUFFQyxlQUFlLEVBQUU7RUFFeEUsSUFBSUMsVUFBVSxHQUFHLEtBQUs7RUFDdEIsSUFBSUMsbUJBQW1CLEdBQUcsRUFBRTtFQUU1QjlHLE1BQU0sQ0FBQ3FCLElBQUksQ0FBRXVGLGVBQWUsRUFBRSxVQUFVRyxLQUFLLEVBQUV4RSxLQUFLLEVBQUU7SUFDckR1RSxtQkFBbUIsQ0FBQ0UsSUFBSSxDQUFFMUUsc0NBQXNDLENBQUVDLEtBQU0sQ0FBRSxDQUFDO0VBQzVFLENBQUUsQ0FBQztFQUVIb0UsT0FBTyxDQUFDekYsSUFBSSxDQUFFLFFBQVMsQ0FBQyxDQUFDRyxJQUFJLENBQUUsWUFBVTtJQUN4QyxJQUFJNEYsT0FBTyxHQUFHakgsTUFBTSxDQUFFLElBQUssQ0FBQztJQUM1QixJQUFJa0gsWUFBWSxHQUFHNUUsc0NBQXNDLENBQUUyRSxPQUFPLENBQUNuQyxHQUFHLENBQUMsQ0FBRSxDQUFDO0lBRTFFLElBQUssQ0FBQyxDQUFDLEtBQUs5RSxNQUFNLENBQUNtSCxPQUFPLENBQUVELFlBQVksRUFBRUosbUJBQW9CLENBQUMsSUFBSUcsT0FBTyxDQUFDRyxJQUFJLENBQUUsVUFBVyxDQUFDLEVBQUc7TUFDL0YsT0FBTyxJQUFJO0lBQ1o7SUFFQSxJQUFLVCxPQUFPLENBQUNTLElBQUksQ0FBRSxVQUFXLENBQUMsRUFBRztNQUNqQ0gsT0FBTyxDQUFDRyxJQUFJLENBQUUsVUFBVSxFQUFFLElBQUssQ0FBQztJQUNqQyxDQUFDLE1BQU07TUFDTlQsT0FBTyxDQUFDN0IsR0FBRyxDQUFFbUMsT0FBTyxDQUFDbkMsR0FBRyxDQUFDLENBQUUsQ0FBQztJQUM3QjtJQUVBNkIsT0FBTyxDQUFDM0IsT0FBTyxDQUFFLFFBQVMsQ0FBQztJQUMzQjZCLFVBQVUsR0FBRyxJQUFJO0lBQ2pCLE9BQU8sS0FBSztFQUNiLENBQUUsQ0FBQztFQUVILE9BQU9BLFVBQVU7QUFDbEI7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTUSxtREFBbURBLENBQUVqQixLQUFLLEVBQUUvRixXQUFXLEVBQUU7RUFFakYsT0FBTzhGLG1EQUFtRCxDQUFFQyxLQUFLLEVBQUUvRixXQUFZLENBQUMsQ0FBQ29FLE1BQU0sR0FBRyxDQUFDO0FBQzVGOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVM2QywrREFBK0RBLENBQUVsQixLQUFLLEVBQUUvRixXQUFXLEVBQUUwQyxVQUFVLEVBQUVDLFFBQVEsRUFBRTtFQUVuSCxJQUFJdUUsS0FBSyxHQUFHbkIsS0FBSyxDQUFDbEYsSUFBSSxDQUFFLCtDQUFnRCxDQUFDO0VBQ3pFLElBQUlOLElBQUk7RUFDUixJQUFJNEcsY0FBYztFQUVsQixJQUFLLENBQUV6RSxVQUFVLElBQUksQ0FBRUMsUUFBUSxFQUFHO0lBQ2pDLE9BQU8sS0FBSztFQUNiO0VBRUEsSUFBSyxDQUFFdUUsS0FBSyxDQUFDOUMsTUFBTSxFQUFHO0lBQ3JCN0QsSUFBSSxHQUFHLDhKQUE4SixHQUNsSyxrRkFBa0YsR0FDbEYsMEVBQTBFLEdBQzFFLDZFQUE2RSxHQUM3RSx5QkFBeUIsR0FDekIseUVBQXlFLEdBQUdQLFdBQVcsR0FBRyxtQ0FBbUMsR0FDN0gsVUFBVSxHQUNWLDZFQUE2RSxHQUM3RSx1QkFBdUIsR0FDdkIsdUVBQXVFLEdBQUdBLFdBQVcsR0FBRyxtQ0FBbUMsR0FDM0gsVUFBVSxHQUNWLFFBQVEsR0FDUixRQUFRO0lBRVhrSCxLQUFLLEdBQUd2SCxNQUFNLENBQUVZLElBQUssQ0FBQztJQUN0QjRHLGNBQWMsR0FBR3BCLEtBQUssQ0FBQ2xGLElBQUksQ0FBRSxVQUFVLEdBQUdiLFdBQVksQ0FBQyxDQUFDb0gsS0FBSyxDQUFDLENBQUM7SUFFL0QsSUFBS0QsY0FBYyxDQUFDL0MsTUFBTSxFQUFHO01BQzVCK0MsY0FBYyxDQUFDRSxNQUFNLENBQUVILEtBQU0sQ0FBQztJQUMvQixDQUFDLE1BQU07TUFDTm5CLEtBQUssQ0FBQ2xGLElBQUksQ0FBRSxtQkFBbUIsR0FBR2IsV0FBWSxDQUFDLENBQUNTLE1BQU0sQ0FBRXlHLEtBQU0sQ0FBQztJQUNoRTtFQUNEO0VBRUFBLEtBQUssQ0FBQ3JHLElBQUksQ0FBRSx1QkFBdUIsR0FBR2IsV0FBVyxHQUFHLElBQUssQ0FBQyxDQUFDeUUsR0FBRyxDQUFFL0IsVUFBVyxDQUFDLENBQUNpQyxPQUFPLENBQUUsT0FBUSxDQUFDLENBQUNBLE9BQU8sQ0FBRSxRQUFTLENBQUM7RUFDbkh1QyxLQUFLLENBQUNyRyxJQUFJLENBQUUscUJBQXFCLEdBQUdiLFdBQVcsR0FBRyxJQUFLLENBQUMsQ0FBQ3lFLEdBQUcsQ0FBRTlCLFFBQVMsQ0FBQyxDQUFDZ0MsT0FBTyxDQUFFLE9BQVEsQ0FBQyxDQUFDQSxPQUFPLENBQUUsUUFBUyxDQUFDO0VBRS9HLE9BQU8sSUFBSTtBQUNaOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTMkMsOERBQThEQSxDQUFFdkIsS0FBSyxFQUFFL0YsV0FBVyxFQUFFMEYsSUFBSSxFQUFFO0VBRWxHLElBQUluRCxhQUFhLEdBQUttRCxJQUFJLElBQUlBLElBQUksQ0FBQ25ELGFBQWEsR0FBS21ELElBQUksQ0FBQ25ELGFBQWEsR0FBRyxFQUFFO0VBQzVFLElBQUlnRixXQUFXLEdBQUdqRiwyQ0FBMkMsQ0FBRUMsYUFBYyxDQUFDO0VBQzlFLElBQUlHLFVBQVUsR0FBS2dELElBQUksSUFBSUEsSUFBSSxDQUFDOEIsbUJBQW1CLEdBQUs5QixJQUFJLENBQUM4QixtQkFBbUIsR0FBR0QsV0FBVyxDQUFDN0UsVUFBVTtFQUN6RyxJQUFJQyxRQUFRLEdBQUsrQyxJQUFJLElBQUlBLElBQUksQ0FBQytCLGlCQUFpQixHQUFLL0IsSUFBSSxDQUFDK0IsaUJBQWlCLEdBQUdGLFdBQVcsQ0FBQzVFLFFBQVE7RUFDakcsSUFBSVcsTUFBTSxHQUFHM0QsTUFBTSxDQUFFLG1DQUFvQyxDQUFDO0VBQzFELElBQUkrSCxZQUFZLEdBQUdwRSxNQUFNLENBQUN6QyxJQUFJLENBQUUsOENBQStDLENBQUMsQ0FBQ3VHLEtBQUssQ0FBQyxDQUFDO0VBQ3hGLElBQUlPLFNBQVMsR0FBRyxnREFBZ0Q7RUFDaEUsSUFBSVQsS0FBSyxHQUFHNUQsTUFBTSxDQUFDekMsSUFBSSxDQUFFLDZDQUE4QyxDQUFDLENBQUN1RyxLQUFLLENBQUMsQ0FBQztFQUNoRixJQUFJN0csSUFBSTtFQUVSLElBQUssQ0FBRW1DLFVBQVUsSUFBSSxDQUFFQyxRQUFRLEVBQUc7SUFDakMsT0FBTyxLQUFLO0VBQ2I7RUFFQSxJQUFLLENBQUV1RSxLQUFLLENBQUM5QyxNQUFNLEVBQUc7SUFDckI3RCxJQUFJLEdBQUcsZ0pBQWdKLEdBQ3BKLDZFQUE2RSxHQUM3RSw2QkFBNkIsR0FBR29ILFNBQVMsR0FBRyxrS0FBa0ssR0FDOU0sdURBQXVELEdBQUdBLFNBQVMsR0FBRyxpRUFBaUUsR0FDdkksY0FBYyxHQUFHQSxTQUFTLEdBQUcsOEZBQThGLEdBQzNILG1DQUFtQyxHQUNuQyxTQUFTLEdBQ1QsNERBQTRELEdBQzVELHVHQUF1RyxHQUFHM0gsV0FBVyxHQUFHLDZGQUE2RixHQUNyTixtR0FBbUcsR0FBR0EsV0FBVyxHQUFHLDJGQUEyRixHQUMvTSxRQUFRLEdBQ1IsMkdBQTJHLEdBQzNHLFFBQVE7SUFFWGtILEtBQUssR0FBR3ZILE1BQU0sQ0FBRVksSUFBSyxDQUFDO0lBRXRCLElBQUttSCxZQUFZLENBQUN0RCxNQUFNLEVBQUc7TUFDMUJzRCxZQUFZLENBQUNuSCxJQUFJLENBQUUyRyxLQUFNLENBQUM7SUFDM0IsQ0FBQyxNQUFNO01BQ041RCxNQUFNLENBQUN6QyxJQUFJLENBQUUsZUFBZ0IsQ0FBQyxDQUFDK0csT0FBTyxDQUFFVixLQUFNLENBQUM7SUFDaEQ7RUFDRDtFQUVBQSxLQUFLLENBQUNoRyxJQUFJLENBQUUsNENBQTRDLEVBQUl3RSxJQUFJLElBQUlBLElBQUksQ0FBQ0Usb0JBQW9CLEdBQUtGLElBQUksQ0FBQ0Usb0JBQW9CLEdBQUcsRUFBRyxDQUFDO0VBQ2xJc0IsS0FBSyxDQUFDckcsSUFBSSxDQUFFLHFEQUFzRCxDQUFDLENBQUNLLElBQUksQ0FBRSxNQUFNLEVBQUUsV0FBVyxHQUFHbEIsV0FBWSxDQUFDLENBQUN5RSxHQUFHLENBQUUvQixVQUFXLENBQUMsQ0FBQ2lDLE9BQU8sQ0FBRSxPQUFRLENBQUMsQ0FBQ0EsT0FBTyxDQUFFLFFBQVMsQ0FBQztFQUN0S3VDLEtBQUssQ0FBQ3JHLElBQUksQ0FBRSxtREFBb0QsQ0FBQyxDQUFDSyxJQUFJLENBQUUsTUFBTSxFQUFFLFNBQVMsR0FBR2xCLFdBQVksQ0FBQyxDQUFDeUUsR0FBRyxDQUFFOUIsUUFBUyxDQUFDLENBQUNnQyxPQUFPLENBQUUsT0FBUSxDQUFDLENBQUNBLE9BQU8sQ0FBRSxRQUFTLENBQUM7RUFDaEt1QyxLQUFLLENBQUNyRyxJQUFJLENBQUUsK0NBQWdELENBQUMsQ0FBQ2tHLElBQUksQ0FBRSxTQUFTLEVBQUUsQ0FBRXJCLElBQUksSUFBTSxHQUFHLEtBQUt2RCxNQUFNLENBQUV1RCxJQUFJLENBQUNDLHFCQUFxQixJQUFJLEdBQUksQ0FBSSxDQUFDO0VBRWxKa0MsNkRBQTZELENBQUU5QixLQUFLLEVBQUUvRixXQUFZLENBQUM7RUFFbkYsT0FBTyxJQUFJO0FBQ1o7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTNkgsNkRBQTZEQSxDQUFFOUIsS0FBSyxFQUFFL0YsV0FBVyxFQUFFO0VBRTNGLElBQUlzRCxNQUFNLEdBQUczRCxNQUFNLENBQUUsbUNBQW9DLENBQUM7RUFDMUQsSUFBSXVILEtBQUssR0FBRzVELE1BQU0sQ0FBQ3pDLElBQUksQ0FBRSw2Q0FBOEMsQ0FBQyxDQUFDdUcsS0FBSyxDQUFDLENBQUM7RUFDaEYsSUFBSVUsUUFBUSxHQUFHWixLQUFLLENBQUNyRyxJQUFJLENBQUUsK0NBQWdELENBQUMsQ0FBQ3VHLEtBQUssQ0FBQyxDQUFDO0VBQ3BGLElBQUlXLFVBQVUsR0FBR0QsUUFBUSxDQUFDMUQsTUFBTSxHQUFHMEQsUUFBUSxDQUFDRSxFQUFFLENBQUUsVUFBVyxDQUFDLEdBQUcsS0FBSztFQUNwRSxJQUFJQyxnQkFBZ0IsR0FBR2YsS0FBSyxDQUFDckcsSUFBSSxDQUFFLDZDQUE4QyxDQUFDO0VBQ2xGLElBQUlxSCxpQkFBaUIsR0FBR3BDLG1EQUFtRCxDQUFFQyxLQUFLLEVBQUUvRixXQUFZLENBQUM7RUFFakcsSUFBSyxDQUFFa0gsS0FBSyxDQUFDOUMsTUFBTSxFQUFHO0lBQ3JCLE9BQU8sS0FBSztFQUNiO0VBRUE4QyxLQUFLLENBQUNpQixXQUFXLENBQUUsWUFBWSxFQUFFSixVQUFXLENBQUM7RUFDN0NFLGdCQUFnQixDQUFDL0csSUFBSSxDQUFFLGlDQUFpQyxFQUFFNkcsVUFBVSxHQUFHLEdBQUcsR0FBRyxHQUFJLENBQUM7RUFFbEZHLGlCQUFpQixDQUFDbEgsSUFBSSxDQUFFLFlBQVU7SUFDakMsSUFBSWtGLE1BQU0sR0FBR3ZHLE1BQU0sQ0FBRSxJQUFLLENBQUM7SUFFM0IsSUFBS29JLFVBQVUsRUFBRztNQUNqQixJQUFLLFdBQVcsS0FBSyxPQUFPN0IsTUFBTSxDQUFDaEYsSUFBSSxDQUFFLHVEQUF3RCxDQUFDLEVBQUc7UUFDcEdnRixNQUFNLENBQUNoRixJQUFJLENBQUUsdURBQXVELEVBQUVnRixNQUFNLENBQUNhLElBQUksQ0FBRSxVQUFXLENBQUMsR0FBRyxHQUFHLEdBQUcsR0FBSSxDQUFDO01BQzlHO01BQ0FiLE1BQU0sQ0FDSmhGLElBQUksQ0FBRSxpQ0FBaUMsRUFBRSxHQUFJLENBQUMsQ0FDOUM2RixJQUFJLENBQUUsVUFBVSxFQUFFLElBQUssQ0FBQyxDQUN4QnFCLFFBQVEsQ0FBRSwrQ0FBZ0QsQ0FBQztJQUM5RCxDQUFDLE1BQU07TUFDTmxDLE1BQU0sQ0FDSmxDLFVBQVUsQ0FBRSxpQ0FBa0MsQ0FBQyxDQUMvQytDLElBQUksQ0FBRSxVQUFVLEVBQUUsR0FBRyxLQUFLYixNQUFNLENBQUNoRixJQUFJLENBQUUsdURBQXdELENBQUUsQ0FBQyxDQUNsRzhDLFVBQVUsQ0FBRSx1REFBd0QsQ0FBQyxDQUNyRXFFLFdBQVcsQ0FBRSwrQ0FBZ0QsQ0FBQztJQUNqRTtFQUNELENBQUUsQ0FBQztFQUVILE9BQU9OLFVBQVU7QUFDbEI7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTTyx1REFBdURBLENBQUV0SSxXQUFXLEVBQUV1QyxhQUFhLEVBQUU7RUFFN0YsSUFBSXdELEtBQUssR0FBR3BHLE1BQU0sQ0FBRSxlQUFlLEdBQUdLLFdBQVksQ0FBQztFQUNuRCxJQUFJd0MsVUFBVTtFQUNkLElBQUlFLFVBQVU7RUFDZCxJQUFJQyxRQUFRO0VBQ1osSUFBSTZELFVBQVUsR0FBRyxLQUFLO0VBQ3RCLElBQUkrQixlQUFlO0VBRW5CLElBQUssQ0FBRXhDLEtBQUssQ0FBQzNCLE1BQU0sSUFBSSxDQUFFN0IsYUFBYSxFQUFHO0lBQ3hDLE9BQU8sS0FBSztFQUNiO0VBRUFDLFVBQVUsR0FBR0YsMkNBQTJDLENBQUVDLGFBQWMsQ0FBQztFQUN6RUcsVUFBVSxHQUFHRixVQUFVLENBQUNFLFVBQVU7RUFDbENDLFFBQVEsR0FBR0gsVUFBVSxDQUFDRyxRQUFRO0VBQzlCNEYsZUFBZSxHQUFHdkIsbURBQW1ELENBQUVqQixLQUFLLEVBQUUvRixXQUFZLENBQUM7RUFFM0YsSUFBSyxDQUFFdUksZUFBZSxFQUFHO0lBQ3hCLE9BQU90QiwrREFBK0QsQ0FBRWxCLEtBQUssRUFBRS9GLFdBQVcsRUFBRTBDLFVBQVUsRUFBRUMsUUFBUyxDQUFDO0VBQ25IO0VBRUFvRCxLQUFLLENBQUNsRixJQUFJLENBQUUsd0JBQXdCLEdBQUdiLFdBQVcsR0FBRyw0QkFBNEIsR0FBR0EsV0FBVyxHQUFHLE1BQU8sQ0FBQyxDQUFDZ0IsSUFBSSxDQUFFLFlBQVU7SUFDMUh3RixVQUFVLEdBQUdILG9DQUFvQyxDQUFFMUcsTUFBTSxDQUFFLElBQUssQ0FBQyxFQUFFLENBQUU0QyxhQUFhLENBQUcsQ0FBQyxJQUFJaUUsVUFBVTtFQUNyRyxDQUFFLENBQUM7RUFFSCxJQUFLOUQsVUFBVSxFQUFHO0lBQ2pCcUQsS0FBSyxDQUFDbEYsSUFBSSxDQUFFLHdCQUF3QixHQUFHYixXQUFXLEdBQUcsNEJBQTRCLEdBQUdBLFdBQVcsR0FBRyxNQUFPLENBQUMsQ0FBQ2dCLElBQUksQ0FBRSxZQUFVO01BQzFId0YsVUFBVSxHQUFHSCxvQ0FBb0MsQ0FBRTFHLE1BQU0sQ0FBRSxJQUFLLENBQUMsRUFBRSxDQUFFK0MsVUFBVSxDQUFHLENBQUMsSUFBSThELFVBQVU7SUFDbEcsQ0FBRSxDQUFDO0lBQ0gsSUFBS1QsS0FBSyxDQUFDbEYsSUFBSSxDQUFFLHVCQUF1QixHQUFHYixXQUFXLEdBQUcsSUFBSyxDQUFDLENBQUN3SSxHQUFHLENBQUUsaUJBQWtCLENBQUMsQ0FBQy9ELEdBQUcsQ0FBRS9CLFVBQVcsQ0FBQyxDQUFDaUMsT0FBTyxDQUFFLE9BQVEsQ0FBQyxDQUFDQSxPQUFPLENBQUUsUUFBUyxDQUFDLENBQUNQLE1BQU0sRUFBRztNQUMxSm9DLFVBQVUsR0FBRyxJQUFJO0lBQ2xCO0VBQ0Q7RUFFQSxJQUFLN0QsUUFBUSxFQUFHO0lBQ2ZvRCxLQUFLLENBQUNsRixJQUFJLENBQUUsc0JBQXNCLEdBQUdiLFdBQVcsR0FBRywwQkFBMEIsR0FBR0EsV0FBVyxHQUFHLE1BQU8sQ0FBQyxDQUFDZ0IsSUFBSSxDQUFFLFlBQVU7TUFDdEh3RixVQUFVLEdBQUdILG9DQUFvQyxDQUFFMUcsTUFBTSxDQUFFLElBQUssQ0FBQyxFQUFFLENBQUVnRCxRQUFRLENBQUcsQ0FBQyxJQUFJNkQsVUFBVTtJQUNoRyxDQUFFLENBQUM7SUFDSCxJQUFLVCxLQUFLLENBQUNsRixJQUFJLENBQUUscUJBQXFCLEdBQUdiLFdBQVcsR0FBRyxJQUFLLENBQUMsQ0FBQ3dJLEdBQUcsQ0FBRSxpQkFBa0IsQ0FBQyxDQUFDL0QsR0FBRyxDQUFFOUIsUUFBUyxDQUFDLENBQUNnQyxPQUFPLENBQUUsT0FBUSxDQUFDLENBQUNBLE9BQU8sQ0FBRSxRQUFTLENBQUMsQ0FBQ1AsTUFBTSxFQUFHO01BQ3RKb0MsVUFBVSxHQUFHLElBQUk7SUFDbEI7RUFDRDtFQUVBLE9BQU9BLFVBQVU7QUFDbEI7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNpQyxxREFBcURBLENBQUUvQyxJQUFJLEVBQUU7RUFFckVBLElBQUksR0FBR0EsSUFBSSxJQUFJLENBQUMsQ0FBQztFQUVqQixJQUFJMUYsV0FBVyxHQUFHOEQsUUFBUSxDQUFFNEIsSUFBSSxDQUFDMUYsV0FBVyxFQUFFLEVBQUcsQ0FBQztFQUNsRCxJQUFJMEksYUFBYSxHQUFHaEQsSUFBSSxDQUFDZ0QsYUFBYSxJQUFJLEVBQUU7RUFDNUMsSUFBSTdGLGNBQWMsR0FBR0Qsc0NBQXNDLENBQUU4QyxJQUFJLENBQUM3QyxjQUFjLElBQUk2RixhQUFjLENBQUM7RUFDbkcsSUFBSW5HLGFBQWEsR0FBR21ELElBQUksQ0FBQ25ELGFBQWEsSUFBSSxFQUFFO0VBQzVDLElBQUlvRywrQkFBK0IsR0FBR2pELElBQUksQ0FBQ2lELCtCQUErQixJQUFJLEVBQUU7RUFDaEYsSUFBSUMsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFFOUUsUUFBUSxDQUFFNEIsSUFBSSxDQUFDQyxxQkFBcUIsSUFBSSxDQUFDLEVBQUUsRUFBRyxDQUFDO0VBQ3pFLElBQUlrRCx1QkFBdUIsR0FBR3BELDZDQUE2QyxDQUFFQyxJQUFJLEVBQUU3QyxjQUFlLENBQUM7RUFDbkcsSUFBSWlHLFVBQVU7RUFFZCxJQUFLLENBQUU5SSxXQUFXLEVBQUc7SUFDcEI7RUFDRDtFQUVBNkYsbURBQW1ELENBQUU3RixXQUFXLEVBQUU2SSx1QkFBd0IsQ0FBQztFQUUzRixJQUFLLENBQUVELGdCQUFnQixFQUFHO0lBQ3pCakosTUFBTSxDQUFFLG1DQUFvQyxDQUFDLENBQUNrQixJQUFJLENBQUUsNkNBQThDLENBQUMsQ0FBQ0MsTUFBTSxDQUFDLENBQUM7RUFDN0c7RUFFQSxJQUNJK0IsY0FBYyxDQUFDdUIsTUFBTSxJQUNyQixDQUFFdUUsK0JBQStCLEVBQ25DO0lBQ0QvRCwrQ0FBK0MsQ0FBRTVFLFdBQVcsRUFBRTZDLGNBQWMsRUFBRWdHLHVCQUF3QixDQUFDO0VBQ3hHO0VBRUEsSUFBSyxDQUFFdEcsYUFBYSxFQUFHO0lBQ3RCO0VBQ0Q7RUFFQXVHLFVBQVUsR0FBRyxTQUFBQSxDQUFBLEVBQVU7SUFDdEIsSUFBSUMsdUJBQXVCLEdBQ3ZCLENBQUVMLGFBQWEsSUFDYixXQUFXLEtBQUssT0FBT2xGLEtBQU8sSUFDOUIsVUFBVSxLQUFLLE9BQU9BLEtBQUssQ0FBQ3dGLGtDQUFvQyxJQUNoRSxLQUFLLEtBQUt4RixLQUFLLENBQUN3RixrQ0FBa0MsQ0FBRWhKLFdBQVcsRUFBRTBJLGFBQWMsQ0FDcEY7SUFFRCxJQUFLSyx1QkFBdUIsSUFBTSxVQUFVLEtBQUssT0FBT3JFLHdDQUEwQyxFQUFHO01BQ3BHQSx3Q0FBd0MsQ0FBRTFFLFdBQVksQ0FBQztJQUN4RDtJQUNBLElBQUs0SSxnQkFBZ0IsRUFBRztNQUN2QnRCLDhEQUE4RCxDQUFFM0gsTUFBTSxDQUFFLGVBQWUsR0FBR0ssV0FBWSxDQUFDLEVBQUVBLFdBQVcsRUFBRTBGLElBQUssQ0FBQztNQUM1SDtJQUNEO0lBQ0E0Qyx1REFBdUQsQ0FBRXRJLFdBQVcsRUFBRXVDLGFBQWMsQ0FBQztFQUN0RixDQUFDO0VBRUQ1QyxNQUFNLENBQUUsbUJBQW9CLENBQUMsQ0FBQ2dFLEdBQUcsQ0FBRSwwREFBMkQsQ0FBQyxDQUFDc0YsR0FBRyxDQUFFLDBEQUEwRCxFQUFFLFVBQVU3RCxLQUFLLEVBQUVDLGtCQUFrQixFQUFFO0lBQ3JNLElBQUt2QixRQUFRLENBQUV1QixrQkFBa0IsRUFBRSxFQUFHLENBQUMsS0FBS3JGLFdBQVcsRUFBRztNQUN6RHNGLE1BQU0sQ0FBQ0MsVUFBVSxDQUFFdUQsVUFBVSxFQUFFLENBQUUsQ0FBQztJQUNuQztFQUNELENBQUUsQ0FBQztFQUVIbkosTUFBTSxDQUFFLE1BQU8sQ0FBQyxDQUFDZ0UsR0FBRyxDQUFFLDREQUE2RCxDQUFDLENBQUNzRixHQUFHLENBQUUsNERBQTRELEVBQUUsVUFBVTdELEtBQUssRUFBRUMsa0JBQWtCLEVBQUU7SUFDNUwsSUFBS3ZCLFFBQVEsQ0FBRXVCLGtCQUFrQixFQUFFLEVBQUcsQ0FBQyxLQUFLckYsV0FBVyxFQUFHO01BQ3pEc0YsTUFBTSxDQUFDQyxVQUFVLENBQUV1RCxVQUFVLEVBQUUsRUFBRyxDQUFDO0lBQ3BDO0VBQ0QsQ0FBRSxDQUFDO0VBRUh4RCxNQUFNLENBQUNDLFVBQVUsQ0FBRXVELFVBQVUsRUFBRSxHQUFJLENBQUM7RUFDcEN4RCxNQUFNLENBQUNDLFVBQVUsQ0FBRXVELFVBQVUsRUFBRSxJQUFLLENBQUM7QUFDdEM7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTSSxpREFBaURBLENBQUU1RixNQUFNLEVBQUVvQyxJQUFJLEVBQUV0RixJQUFJLEVBQUU7RUFFL0VzRixJQUFJLEdBQUdBLElBQUksSUFBSSxDQUFDLENBQUM7RUFFakJwQyxNQUFNLENBQUNwQyxJQUFJLENBQUUsNEJBQTRCLEVBQUVkLElBQUksSUFBSXNGLElBQUksQ0FBQ3RGLElBQUksSUFBSSxLQUFNLENBQUM7RUFFdkUsSUFBSStJLGlCQUFpQixHQUFHN0YsTUFBTSxDQUFDekMsSUFBSSxDQUFFLDRDQUE2QyxDQUFDO0VBQ25GLElBQUl1SSxnQkFBZ0IsR0FBSTlGLE1BQU0sQ0FBQ3pDLElBQUksQ0FBRSx1Q0FBd0MsQ0FBQztFQUM5RSxJQUFJd0ksWUFBWSxHQUFRL0YsTUFBTSxDQUFDekMsSUFBSSxDQUFFLHdDQUF5QyxDQUFDO0VBQy9FLElBQUl5SSxlQUFlLEdBQUtoRyxNQUFNLENBQUN6QyxJQUFJLENBQUUsMENBQTJDLENBQUM7RUFDakYsSUFBSTBJLG1CQUFtQixHQUFHakcsTUFBTSxDQUFDekMsSUFBSSxDQUFFLDhDQUErQyxDQUFDO0VBQ3ZGLElBQUkySSxrQkFBa0IsR0FBSWxHLE1BQU0sQ0FBQ3pDLElBQUksQ0FBRSxvQ0FBcUMsQ0FBQyxDQUFDdUcsS0FBSyxDQUFDLENBQUM7RUFDckYsSUFBSXFDLFlBQVksR0FBVXJKLElBQUksSUFBSXNGLElBQUksQ0FBQ3RGLElBQUksSUFBSSxLQUFLO0VBRXBELElBQUssTUFBTSxLQUFLcUosWUFBWSxFQUFHO0lBQzlCTixpQkFBaUIsQ0FBQ08sSUFBSSxDQUFDLENBQUM7SUFDeEJILG1CQUFtQixDQUFDRyxJQUFJLENBQUMsQ0FBQztFQUMzQixDQUFDLE1BQU07SUFDTlAsaUJBQWlCLENBQUNRLElBQUksQ0FBQyxDQUFDO0lBQ3hCSixtQkFBbUIsQ0FBQ0ksSUFBSSxDQUFDLENBQUM7RUFDM0I7RUFFQSxJQUFLakUsSUFBSSxDQUFDMUYsV0FBVyxJQUFJb0osZ0JBQWdCLENBQUNoRixNQUFNLEVBQUc7SUFDbERnRixnQkFBZ0IsQ0FBQzNFLEdBQUcsQ0FBRXRDLE1BQU0sQ0FBRXVELElBQUksQ0FBQzFGLFdBQVksQ0FBRSxDQUFDO0VBQ25EO0VBRUEsSUFBS3FKLFlBQVksQ0FBQ2pGLE1BQU0sRUFBRztJQUMxQixJQUFJbEUsWUFBWSxHQUFHd0YsSUFBSSxDQUFDeEYsWUFBWSxJQUFJLFVBQVU7SUFDbEQsSUFBS0EsWUFBWSxJQUFJLENBQUVtSixZQUFZLENBQUN4SSxJQUFJLENBQUUsUUFBUyxDQUFDLENBQUNvRixNQUFNLENBQUUsWUFBVTtNQUN0RSxPQUFPdEcsTUFBTSxDQUFFLElBQUssQ0FBQyxDQUFDOEUsR0FBRyxDQUFDLENBQUMsS0FBS3ZFLFlBQVk7SUFDN0MsQ0FBRSxDQUFDLENBQUNrRSxNQUFNLEVBQUc7TUFDWmlGLFlBQVksQ0FBQzVJLE1BQU0sQ0FBRWQsTUFBTSxDQUFFLFlBQWEsQ0FBQyxDQUFDOEUsR0FBRyxDQUFFdkUsWUFBYSxDQUFDLENBQUNvQixJQUFJLENBQUVwQixZQUFhLENBQUUsQ0FBQztJQUN2RjtJQUNBbUosWUFBWSxDQUFDNUUsR0FBRyxDQUFFdkUsWUFBYSxDQUFDO0VBQ2pDO0VBRUEsSUFBS29KLGVBQWUsQ0FBQ2xGLE1BQU0sRUFBRztJQUM3QndGLHVEQUF1RCxDQUFFdEcsTUFBTyxDQUFDO0VBQ2xFO0VBRUEsSUFBS2tHLGtCQUFrQixDQUFDcEYsTUFBTSxFQUFHO0lBQ2hDb0Ysa0JBQWtCLENBQUN6QyxJQUFJLENBQUUsU0FBUyxFQUFFLENBQUMsQ0FBRWpELFFBQVEsQ0FBRTRCLElBQUksQ0FBQ21FLFVBQVUsSUFBSSxDQUFDLEVBQUUsRUFBRyxDQUFFLENBQUM7RUFDOUU7QUFDRDs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0QsdURBQXVEQSxDQUFFdEcsTUFBTSxFQUFFO0VBRXpFLElBQUkrRixZQUFZLEdBQU0vRixNQUFNLENBQUN6QyxJQUFJLENBQUUsd0NBQXlDLENBQUM7RUFDN0UsSUFBSXlJLGVBQWUsR0FBR2hHLE1BQU0sQ0FBQ3pDLElBQUksQ0FBRSwwQ0FBMkMsQ0FBQztFQUUvRSxJQUFLLENBQUV3SSxZQUFZLENBQUNqRixNQUFNLElBQUksQ0FBRWtGLGVBQWUsQ0FBQ2xGLE1BQU0sRUFBRztJQUN4RDtFQUNEO0VBRUEsSUFBSTBGLFNBQVMsR0FBR1QsWUFBWSxDQUFDNUUsR0FBRyxDQUFDLENBQUMsSUFBSSxVQUFVO0VBQ2hELElBQUlzRixRQUFRLEdBQUlULGVBQWUsQ0FBQ3BJLElBQUksQ0FBRSx3Q0FBeUMsQ0FBQyxJQUFJb0ksZUFBZSxDQUFDcEksSUFBSSxDQUFFLE1BQU8sQ0FBQyxJQUFJLEVBQUU7RUFFeEgsSUFBSyxDQUFFNkksUUFBUSxFQUFHO0lBQ2pCO0VBQ0Q7RUFFQSxJQUFJQyxTQUFTLEdBQUssQ0FBQyxDQUFDLEtBQUtELFFBQVEsQ0FBQ0UsT0FBTyxDQUFFLEdBQUksQ0FBQyxHQUFLLEdBQUcsR0FBRyxHQUFHO0VBQzlEWCxlQUFlLENBQUNwSSxJQUFJLENBQUUsTUFBTSxFQUFFNkksUUFBUSxHQUFHQyxTQUFTLEdBQUcsWUFBWSxHQUFHRSxrQkFBa0IsQ0FBRUosU0FBVSxDQUFFLENBQUM7QUFDdEc7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsU0FBU0ssaURBQWlEQSxDQUFBLEVBQUU7RUFFM0R4SyxNQUFNLENBQUVnQixRQUFTLENBQUMsQ0FBQ2dELEdBQUcsQ0FBRSwrQkFBK0IsRUFBRSxxSEFBc0gsQ0FBQyxDQUFDQyxFQUFFLENBQ2xMLCtCQUErQixFQUMvQixxSEFBcUgsRUFDckgsWUFBVTtJQUNULElBQUlOLE1BQU0sR0FBRzNELE1BQU0sQ0FBRSxtQ0FBb0MsQ0FBQztJQUMxRCxJQUFJUyxJQUFJLEdBQUtrRCxNQUFNLENBQUNwQyxJQUFJLENBQUUsNEJBQTZCLENBQUMsSUFBSSxLQUFLO0lBQ2pFLElBQUlrSixVQUFVLEdBQUt6SyxNQUFNLENBQUUsSUFBSyxDQUFDLENBQUN1QixJQUFJLENBQUUsSUFBSyxDQUFDLElBQUksRUFBRTtJQUNwRCxJQUFJaEIsWUFBWSxHQUFHb0QsTUFBTSxDQUFDekMsSUFBSSxDQUFFLHdDQUF5QyxDQUFDLENBQUM0RCxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUU7SUFFdEYsSUFBSyxzQ0FBc0MsS0FBSzJGLFVBQVUsRUFBRztNQUM1RGxLLFlBQVksR0FBRyxFQUFFO0lBQ2xCO0lBRUFDLDBDQUEwQyxDQUFFO01BQzNDQyxJQUFJLEVBQVdBLElBQUk7TUFDbkJMLFVBQVUsRUFBS3VELE1BQU0sQ0FBQ3BDLElBQUksQ0FBRSwwQkFBMkIsQ0FBQyxJQUFJLEVBQUU7TUFDOURsQixXQUFXLEVBQUlzRCxNQUFNLENBQUN6QyxJQUFJLENBQUUsdUNBQXdDLENBQUMsQ0FBQzRELEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRTtNQUNqRnhFLFlBQVksRUFBR3FELE1BQU0sQ0FBQ3BDLElBQUksQ0FBRSw0QkFBNkIsQ0FBQyxJQUFJLEVBQUU7TUFDaEVoQixZQUFZLEVBQUdBLFlBQVk7TUFDM0IySixVQUFVLEVBQUt2RyxNQUFNLENBQUN6QyxJQUFJLENBQUUsb0NBQXFDLENBQUMsQ0FBQ3VHLEtBQUssQ0FBQyxDQUFDLENBQUNZLEVBQUUsQ0FBRSxVQUFXLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQztNQUNuR1csK0JBQStCLEVBQUdyRixNQUFNLENBQUNwQyxJQUFJLENBQUUsdURBQXdELENBQUMsSUFBSSxFQUFFO01BQzlHMkIsY0FBYyxFQUFHUyxNQUFNLENBQUNwQyxJQUFJLENBQUUsc0NBQXVDLENBQUMsSUFBSSxFQUFFO01BQzVFd0gsYUFBYSxFQUFHcEYsTUFBTSxDQUFDcEMsSUFBSSxDQUFFLHFDQUFzQyxDQUFDLElBQUksRUFBRTtNQUMxRXFCLGFBQWEsRUFBR2UsTUFBTSxDQUFDcEMsSUFBSSxDQUFFLHFDQUFzQyxDQUFDLElBQUksRUFBRTtNQUMxRXlFLHFCQUFxQixFQUFHckMsTUFBTSxDQUFDekMsSUFBSSxDQUFFLCtDQUFnRCxDQUFDLENBQUN1RyxLQUFLLENBQUMsQ0FBQyxDQUFDaEQsTUFBTSxHQUNoR2QsTUFBTSxDQUFDekMsSUFBSSxDQUFFLCtDQUFnRCxDQUFDLENBQUN1RyxLQUFLLENBQUMsQ0FBQyxDQUFDWSxFQUFFLENBQUUsVUFBVyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FDL0YxRSxNQUFNLENBQUNwQyxJQUFJLENBQUUsNkNBQThDLENBQUMsSUFBSSxDQUFHO01BQ3hFMEUsb0JBQW9CLEVBQUd0QyxNQUFNLENBQUNwQyxJQUFJLENBQUUsNENBQTZDLENBQUMsSUFBSSxFQUFFO01BQ3hGc0csbUJBQW1CLEVBQUdsRSxNQUFNLENBQUNwQyxJQUFJLENBQUUsMkNBQTRDLENBQUMsSUFBSSxFQUFFO01BQ3RGdUcsaUJBQWlCLEVBQUduRSxNQUFNLENBQUNwQyxJQUFJLENBQUUseUNBQTBDLENBQUMsSUFBSTtJQUNqRixDQUFFLENBQUM7RUFDSixDQUNELENBQUM7RUFFRHZCLE1BQU0sQ0FBRWdCLFFBQVMsQ0FBQyxDQUFDZ0QsR0FBRyxDQUFFLDZDQUE2QyxFQUFFLCtDQUFnRCxDQUFDLENBQUNDLEVBQUUsQ0FDMUgsNkNBQTZDLEVBQzdDLCtDQUErQyxFQUMvQyxZQUFVO0lBQ1QsSUFBSU4sTUFBTSxHQUFHM0QsTUFBTSxDQUFFLG1DQUFvQyxDQUFDO0lBQzFELElBQUlLLFdBQVcsR0FBRzhELFFBQVEsQ0FBRVIsTUFBTSxDQUFDcEMsSUFBSSxDQUFFLG1DQUFvQyxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUcsQ0FBQztJQUN6RixJQUFJNkUsS0FBSyxHQUFHcEcsTUFBTSxDQUFFLGVBQWUsR0FBR0ssV0FBWSxDQUFDO0lBRW5ELElBQUtBLFdBQVcsSUFBSStGLEtBQUssQ0FBQzNCLE1BQU0sRUFBRztNQUNsQ3lELDZEQUE2RCxDQUFFOUIsS0FBSyxFQUFFL0YsV0FBWSxDQUFDO01BQ25Gc0QsTUFBTSxDQUFDcEMsSUFBSSxDQUFFLDZDQUE2QyxFQUFFdkIsTUFBTSxDQUFFLElBQUssQ0FBQyxDQUFDcUksRUFBRSxDQUFFLFVBQVcsQ0FBQyxHQUFHLEdBQUcsR0FBRyxHQUFJLENBQUM7SUFDMUc7RUFDRCxDQUNELENBQUM7QUFDRjtBQUNBckksTUFBTSxDQUFFZ0IsUUFBUyxDQUFDLENBQUMwSixLQUFLLENBQUUsWUFBVTtFQUNuQ0YsaURBQWlELENBQUMsQ0FBQztBQUNwRCxDQUFFLENBQUM7O0FBRUg7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0cseURBQXlEQSxDQUFFdEssV0FBVyxFQUFFO0VBRWhGLElBQUlzRCxNQUFNLEdBQUczRCxNQUFNLENBQUUsbUNBQW9DLENBQUM7RUFDMUQsSUFBSW9HLEtBQUssR0FBR3BHLE1BQU0sQ0FBRSxlQUFlLEdBQUdLLFdBQVksQ0FBQztFQUNuRCxJQUFJa0gsS0FBSyxHQUFHNUQsTUFBTSxDQUFDekMsSUFBSSxDQUFFLDZDQUE4QyxDQUFDLENBQUN1RyxLQUFLLENBQUMsQ0FBQztFQUNoRixJQUFJVSxRQUFRLEdBQUdaLEtBQUssQ0FBQ3JHLElBQUksQ0FBRSwrQ0FBZ0QsQ0FBQyxDQUFDdUcsS0FBSyxDQUFDLENBQUM7RUFDcEYsSUFBSW1ELE1BQU07RUFDVixJQUFJQyxJQUFJO0VBRVIsSUFBSyxDQUFFbEgsTUFBTSxDQUFDMEUsRUFBRSxDQUFFLFVBQVcsQ0FBQyxJQUFJLENBQUVkLEtBQUssQ0FBQzlDLE1BQU0sSUFBSSxDQUFFMEQsUUFBUSxDQUFDRSxFQUFFLENBQUUsVUFBVyxDQUFDLEVBQUc7SUFDakYsT0FBTyxJQUFJO0VBQ1o7RUFFQUgsNkRBQTZELENBQUU5QixLQUFLLEVBQUUvRixXQUFZLENBQUM7RUFFbkZ1SyxNQUFNLEdBQUdyRCxLQUFLLENBQUNyRyxJQUFJLENBQUUscURBQXNELENBQUMsQ0FBQ3VHLEtBQUssQ0FBQyxDQUFDO0VBQ3BGb0QsSUFBSSxHQUFHdEQsS0FBSyxDQUFDckcsSUFBSSxDQUFFLG1EQUFvRCxDQUFDLENBQUN1RyxLQUFLLENBQUMsQ0FBQztFQUVoRixJQUFLLENBQUVtRCxNQUFNLENBQUM5RixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUUrRixJQUFJLENBQUMvRixHQUFHLENBQUMsQ0FBQyxFQUFHO0lBQ3JDLElBQUssVUFBVSxLQUFLLE9BQU9nRyxxQ0FBcUMsRUFBRztNQUNsRUEscUNBQXFDLENBQUV2RCxLQUFLLENBQUN3RCxHQUFHLENBQUUsQ0FBRSxDQUFDLEVBQUUsNkNBQThDLENBQUM7SUFDdkc7SUFDQSxPQUFPLEtBQUs7RUFDYjtFQUVBcEgsTUFBTSxDQUNKcEMsSUFBSSxDQUFFLDZDQUE2QyxFQUFFLEdBQUksQ0FBQyxDQUMxREEsSUFBSSxDQUFFLDJDQUEyQyxFQUFFcUosTUFBTSxDQUFDOUYsR0FBRyxDQUFDLENBQUUsQ0FBQyxDQUNqRXZELElBQUksQ0FBRSx5Q0FBeUMsRUFBRXNKLElBQUksQ0FBQy9GLEdBQUcsQ0FBQyxDQUFFLENBQUM7RUFFL0QsT0FBTyxJQUFJO0FBQ1o7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU3RFLDBDQUEwQ0EsQ0FBRXdLLElBQUksRUFBRTtFQUUxRCxJQUFLLENBQUVsTCx3QkFBd0IsQ0FBRSxtQ0FBb0MsQ0FBQyxFQUFHO0lBQ3hFLE9BQU8sS0FBSztFQUNiO0VBRUFrTCxJQUFJLEdBQUdBLElBQUksSUFBSSxDQUFDLENBQUM7RUFFakIsSUFBSXJILE1BQU0sR0FBRzNELE1BQU0sQ0FBRSxtQ0FBb0MsQ0FBQztFQUMxRCxJQUFJVyxLQUFLLEdBQUdYLE1BQU0sQ0FBRSxnQ0FBaUMsQ0FBQztFQUN0RCxJQUFJaUwsS0FBSyxHQUFHdEgsTUFBTSxDQUFDcEMsSUFBSSxDQUFFLDZCQUE4QixDQUFDO0VBQ3hELElBQUlkLElBQUksR0FBR3VLLElBQUksQ0FBQ3ZLLElBQUksS0FBTXVLLElBQUksQ0FBQzFLLFlBQVksR0FBRyxNQUFNLEdBQUcsS0FBSyxDQUFFO0VBQzlELElBQUk0SyxLQUFLLEdBQUssTUFBTSxLQUFLekssSUFBSSxHQUFLLGNBQWMsR0FBRyxhQUFhO0VBQ2hFLElBQUl5SixVQUFVLEdBQUdjLElBQUksQ0FBQ2QsVUFBVSxHQUFHLENBQUMsR0FBRyxDQUFDO0VBRXhDLElBQUssQ0FBRUEsVUFBVSxJQUFJdkcsTUFBTSxDQUFDekMsSUFBSSxDQUFFLG9DQUFxQyxDQUFDLENBQUN1RyxLQUFLLENBQUMsQ0FBQyxDQUFDWSxFQUFFLENBQUUsVUFBVyxDQUFDLEVBQUc7SUFDbkc2QixVQUFVLEdBQUcsQ0FBQztFQUNmO0VBRUEsSUFBSyxNQUFNLEtBQUt6SixJQUFJLEVBQUc7SUFDdEJ5SixVQUFVLEdBQUcsQ0FBQztFQUNmO0VBRUF2RyxNQUFNLENBQUNwQyxJQUFJLENBQUUsbUNBQW1DLEVBQUUsRUFBRyxDQUFDO0VBQ3REb0MsTUFBTSxDQUFDcEMsSUFBSSxDQUFFLDRCQUE0QixFQUFFeUosSUFBSSxDQUFDMUssWUFBWSxJQUFJLEVBQUcsQ0FBQztFQUNwRXFELE1BQU0sQ0FBQ3BDLElBQUksQ0FBRSwwQkFBMEIsRUFBRXlKLElBQUksQ0FBQzVLLFVBQVUsSUFBSSxFQUFHLENBQUM7RUFDaEV1RCxNQUFNLENBQUNwQyxJQUFJLENBQUUsNEJBQTRCLEVBQUVkLElBQUssQ0FBQztFQUNqRGtELE1BQU0sQ0FBQ3BDLElBQUksQ0FBRSxrQ0FBa0MsRUFBRTJJLFVBQVUsR0FBRyxHQUFHLEdBQUcsR0FBSSxDQUFDO0VBQ3pFdkcsTUFBTSxDQUFDcEMsSUFBSSxDQUFFLHVEQUF1RCxFQUFFeUosSUFBSSxDQUFDaEMsK0JBQStCLElBQUksRUFBRyxDQUFDO0VBQ2xIckYsTUFBTSxDQUFDcEMsSUFBSSxDQUFFLHNDQUFzQyxFQUFFeUosSUFBSSxDQUFDOUgsY0FBYyxJQUFJOEgsSUFBSSxDQUFDakMsYUFBYSxJQUFJLEVBQUcsQ0FBQztFQUN0R3BGLE1BQU0sQ0FBQ3BDLElBQUksQ0FBRSxxQ0FBcUMsRUFBRXlKLElBQUksQ0FBQ2pDLGFBQWEsSUFBSSxFQUFHLENBQUM7RUFDOUVwRixNQUFNLENBQUNwQyxJQUFJLENBQUUscUNBQXFDLEVBQUV5SixJQUFJLENBQUNwSSxhQUFhLElBQUksRUFBRyxDQUFDO0VBQzlFZSxNQUFNLENBQUNwQyxJQUFJLENBQUUsNkNBQTZDLEVBQUV5SixJQUFJLENBQUNoRixxQkFBcUIsR0FBRyxHQUFHLEdBQUcsR0FBSSxDQUFDO0VBQ3BHckMsTUFBTSxDQUFDcEMsSUFBSSxDQUFFLDRDQUE0QyxFQUFFeUosSUFBSSxDQUFDL0Usb0JBQW9CLElBQUksRUFBRyxDQUFDO0VBQzVGdEMsTUFBTSxDQUFDcEMsSUFBSSxDQUFFLDJDQUEyQyxFQUFFeUosSUFBSSxDQUFDbkQsbUJBQW1CLElBQUksRUFBRyxDQUFDO0VBQzFGbEUsTUFBTSxDQUFDcEMsSUFBSSxDQUFFLHlDQUF5QyxFQUFFeUosSUFBSSxDQUFDbEQsaUJBQWlCLElBQUksRUFBRyxDQUFDO0VBQ3RGbkUsTUFBTSxDQUFDcEMsSUFBSSxDQUFFLDRDQUE0QyxFQUFFdUUsNkNBQTZDLENBQUVrRixJQUFJLEVBQUUvSCxzQ0FBc0MsQ0FBRStILElBQUksQ0FBQzlILGNBQWMsSUFBSThILElBQUksQ0FBQ2pDLGFBQWMsQ0FBRSxDQUFDLEdBQUcsR0FBRyxHQUFHLEdBQUksQ0FBQztFQUNuTixJQUFLLENBQUVpQyxJQUFJLENBQUNoRixxQkFBcUIsRUFBRztJQUNuQ3JDLE1BQU0sQ0FBQ3pDLElBQUksQ0FBRSw2Q0FBOEMsQ0FBQyxDQUFDQyxNQUFNLENBQUMsQ0FBQztFQUN0RTtFQUNBNkosSUFBSSxDQUFDZCxVQUFVLEdBQUdBLFVBQVU7RUFDNUJYLGlEQUFpRCxDQUFFNUYsTUFBTSxFQUFFcUgsSUFBSSxFQUFFdkssSUFBSyxDQUFDO0VBQ3ZFa0QsTUFBTSxDQUFDekMsSUFBSSxDQUFFLGlDQUFrQyxDQUFDLENBQUNTLElBQUksQ0FBRXVKLEtBQU0sQ0FBQztFQUM5RHZILE1BQU0sQ0FBQ3pDLElBQUksQ0FBRSxzQ0FBdUMsQ0FBQyxDQUFDTixJQUFJLENBQUVvSyxJQUFJLENBQUM1SyxVQUFVLEdBQUssTUFBTSxHQUFHNEssSUFBSSxDQUFDNUssVUFBVSxHQUFLLEVBQUcsQ0FBQztFQUNqSHVELE1BQU0sQ0FBQ3pDLElBQUksQ0FBRSx1Q0FBd0MsQ0FBQyxDQUFDUyxJQUFJLENBQUksTUFBTSxLQUFLbEIsSUFBSSxHQUFLLGNBQWMsR0FBRyxhQUFjLENBQUM7RUFDbkhFLEtBQUssQ0FBQ0MsSUFBSSxDQUFFeUIsb0RBQW9ELENBQUMsQ0FBRSxDQUFDO0VBRXBFc0IsTUFBTSxDQUFDMUQsYUFBYSxDQUFFLE1BQU8sQ0FBQztFQUU5QkQsTUFBTSxDQUFDbUwsSUFBSSxDQUNWQyxhQUFhLEVBQ2I7SUFDQ0MsTUFBTSxFQUFTLDRCQUE0QjtJQUMzQ0osS0FBSyxFQUFVQSxLQUFLO0lBQ3BCeEssSUFBSSxFQUFXQSxJQUFJO0lBQ25CTCxVQUFVLEVBQUs0SyxJQUFJLENBQUM1SyxVQUFVLElBQUksRUFBRTtJQUNwQ0MsV0FBVyxFQUFJMkssSUFBSSxDQUFDM0ssV0FBVyxJQUFJLEVBQUU7SUFDckNDLFlBQVksRUFBRzBLLElBQUksQ0FBQzFLLFlBQVksSUFBSSxFQUFFO0lBQ3RDQyxZQUFZLEVBQUd5SyxJQUFJLENBQUN6SyxZQUFZLElBQUksRUFBRTtJQUN0QzJKLFVBQVUsRUFBS0EsVUFBVTtJQUN6QmxCLCtCQUErQixFQUFHZ0MsSUFBSSxDQUFDaEMsK0JBQStCLElBQUksRUFBRTtJQUM1RTlGLGNBQWMsRUFBRzhILElBQUksQ0FBQzlILGNBQWMsSUFBSThILElBQUksQ0FBQ2pDLGFBQWEsSUFBSSxFQUFFO0lBQ2hFQSxhQUFhLEVBQUdpQyxJQUFJLENBQUNqQyxhQUFhLElBQUksRUFBRTtJQUN4Q25HLGFBQWEsRUFBR29JLElBQUksQ0FBQ3BJLGFBQWEsSUFBSSxFQUFFO0lBQ3hDb0QscUJBQXFCLEVBQUdnRixJQUFJLENBQUNoRixxQkFBcUIsR0FBRyxDQUFDLEdBQUcsQ0FBQztJQUMxREMsb0JBQW9CLEVBQUcrRSxJQUFJLENBQUMvRSxvQkFBb0IsSUFBSSxFQUFFO0lBQ3RENEIsbUJBQW1CLEVBQUdtRCxJQUFJLENBQUNuRCxtQkFBbUIsSUFBSSxFQUFFO0lBQ3BEQyxpQkFBaUIsRUFBR2tELElBQUksQ0FBQ2xELGlCQUFpQixJQUFJO0VBQy9DLENBQUMsRUFDRCxVQUFVd0QsUUFBUSxFQUFFO0lBRW5CLElBQUssQ0FBRUEsUUFBUSxJQUFJLENBQUVBLFFBQVEsQ0FBQ0MsT0FBTyxFQUFHO01BQ3ZDLElBQUlDLE9BQU8sR0FBS0YsUUFBUSxJQUFJQSxRQUFRLENBQUN2RixJQUFJLElBQUl1RixRQUFRLENBQUN2RixJQUFJLENBQUN5RixPQUFPLEdBQUtGLFFBQVEsQ0FBQ3ZGLElBQUksQ0FBQ3lGLE9BQU8sR0FBRyw4QkFBOEI7TUFDN0g3SyxLQUFLLENBQUNDLElBQUksQ0FBRSwyRUFBMkUsR0FBRzRLLE9BQU8sR0FBRyxRQUFTLENBQUM7TUFDOUc7SUFDRDtJQUVBN0gsTUFBTSxDQUFDcEMsSUFBSSxDQUFFLG1DQUFtQyxFQUFFK0osUUFBUSxDQUFDdkYsSUFBSSxDQUFDMUYsV0FBVyxJQUFJLEVBQUcsQ0FBQztJQUNuRnNELE1BQU0sQ0FBQ3BDLElBQUksQ0FBRSw0QkFBNEIsRUFBRStKLFFBQVEsQ0FBQ3ZGLElBQUksQ0FBQ3pGLFlBQVksSUFBSSxFQUFHLENBQUM7SUFDN0VxRCxNQUFNLENBQUNwQyxJQUFJLENBQUUsMEJBQTBCLEVBQUUrSixRQUFRLENBQUN2RixJQUFJLENBQUMzRixVQUFVLElBQUksRUFBRyxDQUFDO0lBQ3pFdUQsTUFBTSxDQUFDcEMsSUFBSSxDQUFFLDRCQUE0QixFQUFFK0osUUFBUSxDQUFDdkYsSUFBSSxDQUFDdEYsSUFBSSxJQUFJQSxJQUFLLENBQUM7SUFDdkVrRCxNQUFNLENBQUNwQyxJQUFJLENBQUUsa0NBQWtDLEVBQUUrSixRQUFRLENBQUN2RixJQUFJLENBQUNtRSxVQUFVLEdBQUcsR0FBRyxHQUFHLEdBQUksQ0FBQztJQUN2RnZHLE1BQU0sQ0FBQ3BDLElBQUksQ0FBRSx1REFBdUQsRUFBRStKLFFBQVEsQ0FBQ3ZGLElBQUksQ0FBQ2lELCtCQUErQixJQUFJLEVBQUcsQ0FBQztJQUMzSHJGLE1BQU0sQ0FBQ3BDLElBQUksQ0FBRSxzQ0FBc0MsRUFBRStKLFFBQVEsQ0FBQ3ZGLElBQUksQ0FBQzdDLGNBQWMsSUFBSW9JLFFBQVEsQ0FBQ3ZGLElBQUksQ0FBQ2dELGFBQWEsSUFBSSxFQUFHLENBQUM7SUFDeEhwRixNQUFNLENBQUNwQyxJQUFJLENBQUUscUNBQXFDLEVBQUUrSixRQUFRLENBQUN2RixJQUFJLENBQUNnRCxhQUFhLElBQUksRUFBRyxDQUFDO0lBQ3ZGcEYsTUFBTSxDQUFDcEMsSUFBSSxDQUFFLHFDQUFxQyxFQUFFK0osUUFBUSxDQUFDdkYsSUFBSSxDQUFDbkQsYUFBYSxJQUFJLEVBQUcsQ0FBQztJQUN2RmUsTUFBTSxDQUFDcEMsSUFBSSxDQUFFLDZDQUE2QyxFQUFFK0osUUFBUSxDQUFDdkYsSUFBSSxDQUFDQyxxQkFBcUIsR0FBRyxHQUFHLEdBQUcsR0FBSSxDQUFDO0lBQzdHckMsTUFBTSxDQUFDcEMsSUFBSSxDQUFFLDRDQUE0QyxFQUFFK0osUUFBUSxDQUFDdkYsSUFBSSxDQUFDRSxvQkFBb0IsSUFBSSxFQUFHLENBQUM7SUFDckd0QyxNQUFNLENBQUNwQyxJQUFJLENBQUUsMkNBQTJDLEVBQUUrSixRQUFRLENBQUN2RixJQUFJLENBQUM4QixtQkFBbUIsSUFBSSxFQUFHLENBQUM7SUFDbkdsRSxNQUFNLENBQUNwQyxJQUFJLENBQUUseUNBQXlDLEVBQUUrSixRQUFRLENBQUN2RixJQUFJLENBQUMrQixpQkFBaUIsSUFBSSxFQUFHLENBQUM7SUFDL0Z5QixpREFBaUQsQ0FBRTVGLE1BQU0sRUFBRTJILFFBQVEsQ0FBQ3ZGLElBQUksRUFBRXVGLFFBQVEsQ0FBQ3ZGLElBQUksQ0FBQ3RGLElBQUksSUFBSUEsSUFBSyxDQUFDO0lBQ3RHa0QsTUFBTSxDQUFDekMsSUFBSSxDQUFFLGlDQUFrQyxDQUFDLENBQUNTLElBQUksQ0FBRTJKLFFBQVEsQ0FBQ3ZGLElBQUksQ0FBQ21GLEtBQUssSUFBSUEsS0FBTSxDQUFDO0lBQ3JGdkgsTUFBTSxDQUFDekMsSUFBSSxDQUFFLHNDQUF1QyxDQUFDLENBQUNOLElBQUksQ0FBRTBLLFFBQVEsQ0FBQ3ZGLElBQUksQ0FBQzNGLFVBQVUsR0FBSyxNQUFNLEdBQUdrTCxRQUFRLENBQUN2RixJQUFJLENBQUMzRixVQUFVLEdBQUssRUFBRyxDQUFDO0lBQ25JdUQsTUFBTSxDQUFDekMsSUFBSSxDQUFFLHVDQUF3QyxDQUFDLENBQUNTLElBQUksQ0FBRTJKLFFBQVEsQ0FBQ3ZGLElBQUksQ0FBQzBGLFlBQVksS0FBUSxNQUFNLEtBQUtoTCxJQUFJLEdBQUssY0FBYyxHQUFHLGFBQWEsQ0FBRyxDQUFDO0lBQ3JKQyxpREFBaUQsQ0FBRUMsS0FBSyxFQUFFMkssUUFBUSxDQUFDdkYsSUFBSSxDQUFDbkYsSUFBSSxJQUFJLEVBQUcsQ0FBQztJQUVwRixJQUFLLFVBQVUsS0FBSyxPQUFPOEssMkNBQTJDLEVBQUc7TUFDeEVBLDJDQUEyQyxDQUFDLENBQUM7SUFDOUM7SUFFQSxJQUFLLFdBQVcsS0FBSyxPQUFPN0gsS0FBSyxFQUFHO01BQ25DQSxLQUFLLENBQUM4SCxlQUFlLENBQUUsd0JBQXdCLEVBQUVMLFFBQVEsQ0FBQ3ZGLElBQUksQ0FBQ3pGLFlBQVksSUFBSSxFQUFHLENBQUM7TUFDbkZ1RCxLQUFLLENBQUM4SCxlQUFlLENBQUUsc0JBQXNCLEVBQUVMLFFBQVEsQ0FBQ3ZGLElBQUksQ0FBQ21FLFVBQVUsR0FBRyxDQUFDLEdBQUcsQ0FBRSxDQUFDO0lBQ2xGO0lBRUEsSUFBSyxVQUFVLEtBQUssT0FBTzBCLDJCQUEyQixFQUFHO01BQ3hEQSwyQkFBMkIsQ0FBQyxDQUFDO0lBQzlCO0lBQ0EsSUFBSyxVQUFVLEtBQUssT0FBT0MsMEJBQTBCLEVBQUc7TUFDdkRBLDBCQUEwQixDQUFDLENBQUM7SUFDN0I7SUFFQS9DLHFEQUFxRCxDQUFFd0MsUUFBUSxDQUFDdkYsSUFBSyxDQUFDO0VBQ3ZFLENBQ0QsQ0FBQyxDQUFDK0YsSUFBSSxDQUFFLFlBQVU7SUFDakJuTCxLQUFLLENBQUNDLElBQUksQ0FBRSw2R0FBOEcsQ0FBQztFQUM1SCxDQUFFLENBQUM7QUFDSjs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxTQUFTbUwsdURBQXVEQSxDQUFBLEVBQUU7RUFFakUsSUFBSXBJLE1BQU0sR0FBRzNELE1BQU0sQ0FBRSxtQ0FBb0MsQ0FBQztFQUUxRCxJQUFLMkQsTUFBTSxDQUFDYyxNQUFNLElBQU0sVUFBVSxLQUFLLE9BQU9kLE1BQU0sQ0FBQzFELGFBQWUsRUFBRztJQUN0RTBELE1BQU0sQ0FBQzFELGFBQWEsQ0FBRSxNQUFPLENBQUM7RUFDL0I7RUFFQSxJQUNNLFVBQVUsS0FBSyxPQUFPMEYsTUFBTSxDQUFDcUcsZ0RBQWdELElBQzdFLFdBQVcsS0FBSyxPQUFPckcsTUFBTSxDQUFDc0csd0JBQTBCLEVBQzVEO0lBQ0R0RyxNQUFNLENBQUNxRyxnREFBZ0QsQ0FBRSxDQUFDLENBQUUsQ0FBQztJQUM3RDtFQUNEO0VBRUEsSUFBSyxVQUFVLEtBQUssT0FBT3JHLE1BQU0sQ0FBQ3VHLHNDQUFzQyxFQUFHO0lBQzFFdkcsTUFBTSxDQUFDdUcsc0NBQXNDLENBQUMsQ0FBQztFQUNoRDtBQUNEOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTQywyQ0FBMkNBLENBQUEsRUFBRTtFQUVyRCxJQUFJeEksTUFBTSxHQUFHM0QsTUFBTSxDQUFFLG1DQUFvQyxDQUFDO0VBQzFELElBQUlvRyxLQUFLLEdBQUd6QyxNQUFNLENBQUN6QyxJQUFJLENBQUUsbUJBQW9CLENBQUMsQ0FBQ3VHLEtBQUssQ0FBQyxDQUFDO0VBQ3RELElBQUlwSCxXQUFXLEdBQUcsQ0FBQztFQUVuQixJQUFLK0YsS0FBSyxDQUFDM0IsTUFBTSxFQUFHO0lBQ25CcEUsV0FBVyxHQUFHOEQsUUFBUSxDQUFFLENBQUVpQyxLQUFLLENBQUM3RSxJQUFJLENBQUUsSUFBSyxDQUFDLElBQUksRUFBRSxFQUFHa0IsT0FBTyxDQUFFLGNBQWMsRUFBRSxFQUFHLENBQUMsRUFBRSxFQUFHLENBQUM7RUFDekY7RUFFQSxJQUFLLENBQUVwQyxXQUFXLEVBQUc7SUFDcEJBLFdBQVcsR0FBRzhELFFBQVEsQ0FBRVIsTUFBTSxDQUFDcEMsSUFBSSxDQUFFLG1DQUFvQyxDQUFDLEVBQUUsRUFBRyxDQUFDO0VBQ2pGO0VBRUEsSUFBSyxDQUFFbEIsV0FBVyxFQUFHO0lBQ3BCLE9BQU8sS0FBSztFQUNiO0VBRUEsSUFBSStMLFdBQVcsR0FBR2hHLEtBQUssQ0FBQzNCLE1BQU0sR0FBRzJCLEtBQUssQ0FBQzJFLEdBQUcsQ0FBRSxDQUFFLENBQUMsR0FBRy9KLFFBQVEsQ0FBQ3FMLGNBQWMsQ0FBRSxjQUFjLEdBQUdoTSxXQUFZLENBQUM7RUFDekcsSUFBSWlNLE1BQU0sR0FBSyxXQUFXLEtBQUssT0FBT3pJLEtBQUssR0FBS0EsS0FBSyxDQUFDMEksZUFBZSxDQUFFLGVBQWdCLENBQUMsR0FBRyxFQUFFO0VBQzdGLElBQUlDLGFBQWE7RUFFakIsSUFBSyxDQUFFN0IseURBQXlELENBQUV0SyxXQUFZLENBQUMsRUFBRztJQUNqRixPQUFPLEtBQUs7RUFDYjtFQUVBTCxNQUFNLENBQUUsTUFBTyxDQUFDLENBQUNnRSxHQUFHLENBQUUsZ0VBQWlFLENBQUMsQ0FDdEZDLEVBQUUsQ0FBRSxnRUFBZ0UsRUFBRSxVQUFVd0IsS0FBSyxFQUFFZ0gscUJBQXFCLEVBQUU7SUFFOUcsSUFBS3RJLFFBQVEsQ0FBRXNJLHFCQUFxQixFQUFFLEVBQUcsQ0FBQyxLQUFLcE0sV0FBVyxFQUFHO01BQzVEO0lBQ0Q7SUFFQUwsTUFBTSxDQUFFLE1BQU8sQ0FBQyxDQUFDZ0UsR0FBRyxDQUFFLGdFQUFpRSxDQUFDO0lBRXhGLElBQUssQ0FBRWhFLE1BQU0sQ0FBRSxtQ0FBb0MsQ0FBQyxDQUFDcUksRUFBRSxDQUFFLFVBQVcsQ0FBQyxFQUFHO01BQ3ZFO0lBQ0Q7SUFFQTBELHVEQUF1RCxDQUFDLENBQUM7RUFDMUQsQ0FBRSxDQUFDO0VBRUpTLGFBQWEsR0FBR0Usd0JBQXdCLENBQUVOLFdBQVcsRUFBRS9MLFdBQVcsRUFBRWlNLE1BQU8sQ0FBQztFQUU1RSxJQUFLLEtBQUssS0FBS0UsYUFBYSxFQUFHO0lBQzlCeE0sTUFBTSxDQUFFLE1BQU8sQ0FBQyxDQUFDZ0UsR0FBRyxDQUFFLGdFQUFpRSxDQUFDO0VBQ3pGO0VBRUEsT0FBT3dJLGFBQWE7QUFDckI7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0cseUNBQXlDQSxDQUFFdk0sVUFBVSxFQUFFd00sSUFBSSxFQUFHO0VBRXRFLElBQUssQ0FBRTlNLHdCQUF3QixDQUFFLHlDQUEwQyxDQUFDLEVBQUc7SUFDOUUsT0FBTyxLQUFLO0VBQ2I7O0VBRUE7RUFDQUUsTUFBTSxDQUFFLHVDQUF3QyxDQUFDLENBQUM4RSxHQUFHLENBQUU4SCxJQUFLLENBQUM7O0VBRTdEO0VBQ0E1TSxNQUFNLENBQUUsNENBQTZDLENBQUMsQ0FBQzhFLEdBQUcsQ0FBRTFFLFVBQVcsQ0FBQzs7RUFFeEU7RUFDQUosTUFBTSxDQUFFLDRDQUE2QyxDQUFDLENBQUNZLElBQUksQ0FBRSxNQUFNLEdBQUdSLFVBQVcsQ0FBQzs7RUFFbEY7RUFDQUosTUFBTSxDQUFFLHlDQUEwQyxDQUFDLENBQUNDLGFBQWEsQ0FBRSxNQUFPLENBQUM7O0VBRTNFO0VBQ0FELE1BQU0sQ0FBRSx1Q0FBd0MsQ0FBQyxDQUFDZ0YsT0FBTyxDQUFFLE9BQVEsQ0FBQztBQUNyRTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTNkgsMkNBQTJDQSxDQUFFek0sVUFBVSxFQUFFME0sbUJBQW1CLEVBQUc7RUFFdkYsSUFBSyxDQUFFaE4sd0JBQXdCLENBQUUsMkNBQTRDLENBQUMsRUFBRztJQUNoRixPQUFPLEtBQUs7RUFDYjtFQUVBLElBQUlpTixPQUFPLEdBQUcvTSxNQUFNLENBQUUseUNBQTBDLENBQUM7O0VBRWpFO0VBQ0EsSUFBTyxDQUFFZ04sS0FBSyxDQUFFQyxVQUFVLENBQUVILG1CQUFvQixDQUFFLENBQUMsSUFBTSxFQUFFLEtBQUtBLG1CQUFvQixFQUFHO0lBQUc7SUFDekZDLE9BQU8sQ0FBQzdMLElBQUksQ0FBRSxtQkFBb0IsQ0FBQyxDQUFDa0csSUFBSSxDQUFFLFVBQVUsRUFBRSxJQUFLLENBQUMsQ0FBQyxDQUFRO0VBQ3RFLENBQUMsTUFBTTtJQUNOMkYsT0FBTyxDQUFDN0wsSUFBSSxDQUFFLGdCQUFnQixHQUFHNEwsbUJBQW1CLEdBQUcsSUFBSyxDQUFDLENBQUMxRixJQUFJLENBQUUsVUFBVSxFQUFFLElBQUssQ0FBQyxDQUFDLENBQUU7RUFDMUY7RUFDQTtFQUNBcEgsTUFBTSxDQUFFLDhDQUErQyxDQUFDLENBQUM4RSxHQUFHLENBQUUxRSxVQUFXLENBQUM7O0VBRTFFO0VBQ0FKLE1BQU0sQ0FBRSw4Q0FBK0MsQ0FBQyxDQUFDWSxJQUFJLENBQUUsTUFBTSxHQUFHUixVQUFXLENBQUM7O0VBRXBGO0VBQ0FKLE1BQU0sQ0FBRSwyQ0FBNEMsQ0FBQyxDQUFDQyxhQUFhLENBQUUsTUFBTyxDQUFDOztFQUU3RTtFQUNBRCxNQUFNLENBQUUseUNBQTBDLENBQUMsQ0FBQ2dGLE9BQU8sQ0FBRSxPQUFRLENBQUM7QUFDdkU7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNrSSw2Q0FBNkNBLENBQUU5TSxVQUFVLEVBQUUrTSxvQkFBb0IsRUFBRVAsSUFBSSxFQUFFO0VBRS9GLElBQUssQ0FBRTlNLHdCQUF3QixDQUFFLDRDQUE2QyxDQUFDLEVBQUc7SUFDakYsT0FBTyxLQUFLO0VBQ2I7O0VBRUE7RUFDQUUsTUFBTSxDQUFFLHdDQUF5QyxDQUFDLENBQUM4RSxHQUFHLENBQUVxSSxvQkFBcUIsQ0FBQzs7RUFFOUU7RUFDQW5OLE1BQU0sQ0FBRSwrQ0FBZ0QsQ0FBQyxDQUFDOEUsR0FBRyxDQUFFMUUsVUFBVyxDQUFDOztFQUUzRTtFQUNBSixNQUFNLENBQUUsK0NBQWdELENBQUMsQ0FBQ1ksSUFBSSxDQUFFLE1BQU0sR0FBR1IsVUFBVyxDQUFDOztFQUVyRjtFQUNBSixNQUFNLENBQUUseUNBQTBDLENBQUMsQ0FBQ1ksSUFBSSxDQUFFZ00sSUFBSyxDQUFDOztFQUVoRTtFQUNBNU0sTUFBTSxDQUFFLDRDQUE2QyxDQUFDLENBQUNDLGFBQWEsQ0FBRSxNQUFPLENBQUM7O0VBRTlFO0VBQ0FELE1BQU0sQ0FBRSwwQ0FBMkMsQ0FBQyxDQUFDZ0YsT0FBTyxDQUFFLE9BQVEsQ0FBQztBQUV4RTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNvSSx5Q0FBeUNBLENBQUVoTixVQUFVLEVBQUVpTixTQUFTLEVBQUU7RUFFMUUsSUFBSyxDQUFFdk4sd0JBQXdCLENBQUUsd0NBQXlDLENBQUMsRUFBRztJQUM3RSxPQUFPLEtBQUs7RUFDYjs7RUFFQTtFQUNBRSxNQUFNLENBQUUsc0NBQXVDLENBQUMsQ0FBQzhFLEdBQUcsQ0FBRXVJLFNBQVUsQ0FBQzs7RUFFakU7RUFDQXJOLE1BQU0sQ0FBRSwyQ0FBNEMsQ0FBQyxDQUFDOEUsR0FBRyxDQUFFMUUsVUFBVyxDQUFDOztFQUV2RTtFQUNBSixNQUFNLENBQUUsMkNBQTRDLENBQUMsQ0FBQ1ksSUFBSSxDQUFFLE1BQU0sR0FBR1IsVUFBVyxDQUFDOztFQUVqRjtFQUNBSixNQUFNLENBQUUsd0NBQXlDLENBQUMsQ0FBQ0MsYUFBYSxDQUFFLE1BQU8sQ0FBQzs7RUFFMUU7RUFDQUQsTUFBTSxDQUFFLHNDQUF1QyxDQUFDLENBQUNzTixTQUFTLENBQUUsQ0FBRSxDQUFDO0FBRWhFOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNDLGdEQUFnREEsQ0FBRW5OLFVBQVUsRUFBRUMsV0FBVyxFQUFFO0VBRW5GLElBQUssQ0FBRVAsd0JBQXdCLENBQUUsK0NBQWdELENBQUMsRUFBRztJQUNwRixPQUFPLEtBQUs7RUFDYjs7RUFFQTtFQUNBRSxNQUFNLENBQUUsbURBQW9ELENBQUMsQ0FBQzhFLEdBQUcsQ0FBRXpFLFdBQVksQ0FBQyxDQUFDMkUsT0FBTyxDQUFFLFFBQVMsQ0FBQzs7RUFFcEc7RUFDQWhGLE1BQU0sQ0FBRSxrREFBbUQsQ0FBQyxDQUFDOEUsR0FBRyxDQUFFMUUsVUFBVyxDQUFDO0VBQzlFO0VBQ0FKLE1BQU0sQ0FBRSxrREFBbUQsQ0FBQyxDQUFDWSxJQUFJLENBQUUsTUFBTSxHQUFHUixVQUFXLENBQUM7O0VBRXhGO0VBQ0FKLE1BQU0sQ0FBRSwrQ0FBZ0QsQ0FBQyxDQUFDQyxhQUFhLENBQUUsTUFBTyxDQUFDOztFQUVqRjtFQUNBRCxNQUFNLENBQUUsbURBQW9ELENBQUMsQ0FBQ3dOLEtBQUssQ0FBQyxDQUFDO0FBQ3RFOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTQyw4Q0FBOENBLENBQUVyTixVQUFVLEVBQUVDLFdBQVcsRUFBRXFOLFVBQVUsRUFBRUMsUUFBUSxFQUFFO0VBRXZHLElBQUssQ0FBRTdOLHdCQUF3QixDQUFFLDZDQUE4QyxDQUFDLEVBQUc7SUFDbEYsT0FBTyxLQUFLO0VBQ2I7RUFFQSxJQUFJNkQsTUFBTSxHQUFHM0QsTUFBTSxDQUFFLDZDQUE4QyxDQUFDO0VBQ3BFLElBQUk0TixLQUFLLEdBQUdqSyxNQUFNLENBQUN6QyxJQUFJLENBQUUsZUFBZ0IsQ0FBQyxDQUFDdUcsS0FBSyxDQUFDLENBQUM7RUFFbEQsSUFBS3JILFVBQVUsRUFBRztJQUNqQkosTUFBTSxDQUFFLGdEQUFpRCxDQUFDLENBQUNZLElBQUksQ0FBRSxNQUFNLEdBQUdSLFVBQVcsQ0FBQztFQUN2RixDQUFDLE1BQU07SUFDTkosTUFBTSxDQUFFLGdEQUFpRCxDQUFDLENBQUNZLElBQUksQ0FBRSxFQUFHLENBQUM7RUFDdEU7RUFFQStDLE1BQU0sQ0FBQzFELGFBQWEsQ0FBRSxNQUFPLENBQUM7RUFFOUIsSUFBSyxVQUFVLEtBQUssT0FBTzBGLE1BQU0sQ0FBQ2tJLGdDQUFnQyxFQUFHO0lBQ3BFbEksTUFBTSxDQUFDa0ksZ0NBQWdDLENBQUVELEtBQU0sQ0FBQztFQUNqRDtFQUVBLElBQUssVUFBVSxLQUFLLE9BQU9qSSxNQUFNLENBQUNtSSx1Q0FBdUMsRUFBRztJQUMzRW5JLE1BQU0sQ0FBQ21JLHVDQUF1QyxDQUM3Q0YsS0FBSyxFQUNMO01BQ0N2TixXQUFXLEVBQUVBLFdBQVc7TUFDeEJxTixVQUFVLEVBQUVBLFVBQVU7TUFDdEJDLFFBQVEsRUFBRUE7SUFDWCxDQUNELENBQUM7RUFDRjtBQUNEOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNJLDREQUE0REEsQ0FBRTNOLFVBQVUsRUFBRUMsV0FBVyxFQUFFO0VBRS9GLElBQUssQ0FBRVAsd0JBQXdCLENBQUUsMkRBQTRELENBQUMsRUFBRztJQUNoRyxPQUFPLEtBQUs7RUFDYjs7RUFFQTtFQUNBRSxNQUFNLENBQUUsK0RBQWdFLENBQUMsQ0FBQzhFLEdBQUcsQ0FBRXpFLFdBQVksQ0FBQyxDQUFDMkUsT0FBTyxDQUFFLFFBQVMsQ0FBQzs7RUFFaEg7RUFDQWhGLE1BQU0sQ0FBRSw4REFBK0QsQ0FBQyxDQUFDOEUsR0FBRyxDQUFFMUUsVUFBVyxDQUFDO0VBQzFGO0VBQ0FKLE1BQU0sQ0FBRSw4REFBK0QsQ0FBQyxDQUFDWSxJQUFJLENBQUUsTUFBTSxHQUFHUixVQUFXLENBQUM7O0VBRXBHO0VBQ0FKLE1BQU0sQ0FBRSwyREFBNEQsQ0FBQyxDQUFDQyxhQUFhLENBQUUsTUFBTyxDQUFDOztFQUU3RjtFQUNBRCxNQUFNLENBQUUsK0RBQWdFLENBQUMsQ0FBQ3dOLEtBQUssQ0FBQyxDQUFDO0FBQ2xGOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNRLDJDQUEyQ0EsQ0FBRTVOLFVBQVUsRUFBRTZOLHFCQUFxQixFQUFFO0VBRXhGLElBQUssQ0FBRW5PLHdCQUF3QixDQUFFLDBDQUEyQyxDQUFDLEVBQUc7SUFDL0UsT0FBTyxLQUFLO0VBQ2I7O0VBRUE7RUFDQUUsTUFBTSxDQUFFLGlDQUFrQyxDQUFDLENBQUM4RSxHQUFHLENBQUVtSixxQkFBc0IsQ0FBQyxDQUFDakosT0FBTyxDQUFFLFFBQVMsQ0FBQzs7RUFFNUY7RUFDQTs7RUFFQTtFQUNBaEYsTUFBTSxDQUFFLDZDQUE4QyxDQUFDLENBQUM4RSxHQUFHLENBQUUxRSxVQUFXLENBQUM7RUFDekU7RUFDQUosTUFBTSxDQUFFLDZDQUE4QyxDQUFDLENBQUNZLElBQUksQ0FBRSxNQUFNLEdBQUdSLFVBQVcsQ0FBQzs7RUFFbkY7RUFDQUosTUFBTSxDQUFFLDBDQUEyQyxDQUFDLENBQUNDLGFBQWEsQ0FBRSxNQUFPLENBQUM7O0VBRTVFO0VBQ0FELE1BQU0sQ0FBRSxpQ0FBa0MsQ0FBQyxDQUFDd04sS0FBSyxDQUFDLENBQUM7QUFDcEQ7O0FBR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU1Usb0NBQW9DQSxDQUFBLEVBQUc7RUFFL0MsSUFBSUMsS0FBSyxHQUFHLFNBQVM7RUFFckIsSUFBSUMsZUFBZSxHQUFHbkMsd0JBQXdCLENBQUNvQyxnQkFBZ0IsQ0FBRUYsS0FBTSxDQUFDO0VBRXhFLElBQUlHLGFBQWEsR0FBR3RPLE1BQU0sQ0FBRSx3QkFBd0IsR0FBR21PLEtBQUssR0FBRyxJQUFJLEdBQUdDLGVBQWdCLENBQUM7RUFDdkYsSUFBS0UsYUFBYSxDQUFDN0osTUFBTSxFQUFHO0lBQzNCekUsTUFBTSxDQUFFLHFCQUFxQixHQUFHbU8sS0FBSyxHQUFHLDJDQUE0QyxDQUFDLENBQUN2TixJQUFJLENBQUUwTixhQUFhLENBQUMxTixJQUFJLENBQUMsQ0FBRSxDQUFDO0VBQ25ILENBQUMsTUFBTTtJQUNOWixNQUFNLENBQUUscUJBQXFCLEdBQUdtTyxLQUFLLEdBQUcsMkNBQTRDLENBQUMsQ0FBQ3ZOLElBQUksQ0FBRSxLQUFNLENBQUM7RUFDcEc7QUFDRDs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTMk4sd0NBQXdDQSxDQUFBLEVBQUc7RUFDbkR2TyxNQUFNLENBQUUsZ0JBQWlCLENBQUMsQ0FBQzBJLFdBQVcsQ0FBRSxjQUFlLENBQUM7RUFDeEQxSSxNQUFNLENBQUUsc0NBQXVDLENBQUMsQ0FBQ2dLLElBQUksQ0FBQyxDQUFDO0VBQ3ZEaEssTUFBTSxDQUFFLHNDQUF1QyxDQUFDLENBQUMrSixJQUFJLENBQUMsQ0FBQztFQUN2RC9KLE1BQU0sQ0FBRSw4QkFBK0IsQ0FBQyxDQUFDd08sTUFBTSxDQUFDLENBQUM7QUFDbEQ7O0FBR0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0MseUNBQXlDQSxDQUFBLEVBQUc7RUFDcER6TyxNQUFNLENBQUUsZ0JBQWlCLENBQUMsQ0FBQ3lJLFFBQVEsQ0FBRSxjQUFlLENBQUM7RUFDckR6SSxNQUFNLENBQUUsc0NBQXVDLENBQUMsQ0FBQytKLElBQUksQ0FBQyxDQUFDO0VBQ3ZEL0osTUFBTSxDQUFFLHNDQUF1QyxDQUFDLENBQUNnSyxJQUFJLENBQUMsQ0FBQztFQUN2RGhLLE1BQU0sQ0FBRSw4QkFBK0IsQ0FBQyxDQUFDd08sTUFBTSxDQUFDLENBQUM7QUFDbEQiLCJpZ25vcmVMaXN0IjpbXX0=
