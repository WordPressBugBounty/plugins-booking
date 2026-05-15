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

/**
 * Parse "HH:MM - HH:MM" selected time into start/end values.
 *
 * @param {string} selected_time Time range.
 * @returns {{start_time:string,end_time:string}}
 */
function wpbc_boo_listing__parse_selected_time_range(selected_time) {
  var time_parts = String(selected_time || '').split(' - ');
  return {
    start_time: jQuery.trim(time_parts[0] || ''),
    end_time: jQuery.trim(time_parts[1] || '')
  };
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
  var selected_time = data.selected_time || '';
  var selected_dates_without_calendar = data.selected_dates_without_calendar || '';
  var is_time_override = !!parseInt(data.time_override_enabled || 0, 10);
  var apply_time;
  if (!resource_id) {
    return;
  }
  if (!is_time_override) {
    jQuery('#wpbc_modal__add_booking__section').find('[data-wpbc-add-booking-time-override-panel]').remove();
  }
  if (selected_date && !selected_dates_without_calendar && 'function' === typeof wpbc_auto_select_dates_in_calendar) {
    jQuery('body').off('wpbc_calendar_ajx__loaded_data.wpbc_add_booking_modal_date').one('wpbc_calendar_ajx__loaded_data.wpbc_add_booking_modal_date', function (event, loaded_resource_id) {
      if (parseInt(loaded_resource_id, 10) === resource_id) {
        wpbc_auto_select_dates_in_calendar(resource_id, selected_date, selected_date);
      }
    });
    window.setTimeout(function () {
      wpbc_auto_select_dates_in_calendar(resource_id, selected_date, selected_date);
    }, 300);
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
    $form_select.val(data.booking_form || 'standard');
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
    wpbc_boo_listing__click__add_booking_modal({
      mode: mode,
      booking_id: $modal.attr('data-wpbc-add-booking-id') || '',
      resource_id: $modal.find('#wpbc_modal__add_booking__resource_id').val() || '',
      booking_hash: $modal.attr('data-wpbc-add-booking-hash') || '',
      booking_form: $modal.find('#wpbc_modal__add_booking__booking_form').val() || '',
      allow_past: $modal.find('[data-wpbc-add-booking-allow-past]').first().is(':checked') ? 1 : 0,
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
  $modal.attr('data-wpbc-add-booking-selected-date', args.selected_date || '');
  $modal.attr('data-wpbc-add-booking-selected-time', args.selected_time || '');
  $modal.attr('data-wpbc-add-booking-time-override-enabled', args.time_override_enabled ? '1' : '0');
  $modal.attr('data-wpbc-add-booking-time-override-source', args.time_override_source || '');
  $modal.attr('data-wpbc-add-booking-time-override-start', args.time_override_start || '');
  $modal.attr('data-wpbc-add-booking-time-override-end', args.time_override_end || '');
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1ib29raW5ncy9fb3V0L2Jvb19saXN0aW5nX19hY3Rpb25zLmpzIiwibmFtZXMiOlsid3BiY19pc19tb2RhbF9hY2Nlc3NpYmxlIiwiaHRtbF9pZCIsImpRdWVyeSIsIndwYmNfbXlfbW9kYWwiLCJhbGVydCIsIndwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19hZGRfYm9va2luZ19tb2RhbF9mcm9tX3JvdyIsImJvb2tpbmdfaWQiLCJyZXNvdXJjZV9pZCIsImJvb2tpbmdfaGFzaCIsImJvb2tpbmdfZm9ybSIsIndwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19hZGRfYm9va2luZ19tb2RhbCIsIm1vZGUiLCJ3cGJjX2Jvb19saXN0aW5nX19zZXRfYWRkX2Jvb2tpbmdfbW9kYWxfYm9keV9odG1sIiwiJGJvZHkiLCJodG1sIiwiJGh0bWwiLCJhcHBlbmQiLCJwYXJzZUhUTUwiLCJkb2N1bWVudCIsIiRzY3JpcHRzIiwiZmluZCIsInJlbW92ZSIsImNvbnRlbnRzIiwiZWFjaCIsInR5cGUiLCJhdHRyIiwidG9Mb3dlckNhc2UiLCJzcmMiLCJjb2RlIiwidGV4dCIsInRleHRDb250ZW50IiwiaW5uZXJIVE1MIiwidGVzdCIsImFqYXgiLCJ1cmwiLCJkYXRhVHlwZSIsImNhY2hlIiwiYXN5bmMiLCJnbG9iYWxFdmFsIiwid3BiY19ib29fbGlzdGluZ19fZ2V0X2FkZF9ib29raW5nX21vZGFsX2xvYWRpbmdfaHRtbCIsIndwYmNfYm9vX2xpc3RpbmdfX25vcm1hbGl6ZV90aW1lX3ZhbHVlIiwidmFsdWUiLCJTdHJpbmciLCJyZXBsYWNlIiwid3BiY19ib29fbGlzdGluZ19fcGFyc2Vfc2VsZWN0ZWRfdGltZV9yYW5nZSIsInNlbGVjdGVkX3RpbWUiLCJ0aW1lX3BhcnRzIiwic3BsaXQiLCJzdGFydF90aW1lIiwidHJpbSIsImVuZF90aW1lIiwid3BiY19ib29fbGlzdGluZ19fZ2V0X2FkZF9ib29raW5nX21vZGFsX3RpbWVfZmllbGRzIiwiJGZvcm0iLCJzZWxlY3RvciIsImpvaW4iLCJmaWx0ZXIiLCIkZmllbGQiLCJjbG9zZXN0IiwibGVuZ3RoIiwidGFnTmFtZSIsIndwYmNfYm9vX2xpc3RpbmdfX3NlbGVjdF90aW1lX29wdGlvbiIsIiRzZWxlY3QiLCJleHBlY3RlZF92YWx1ZXMiLCJkaWRfc2VsZWN0Iiwibm9ybWFsaXplZF9leHBlY3RlZCIsImluZGV4IiwicHVzaCIsIiRvcHRpb24iLCJvcHRpb25fdmFsdWUiLCJ2YWwiLCJpbkFycmF5IiwicHJvcCIsInRyaWdnZXIiLCJ3cGJjX2Jvb19saXN0aW5nX19oYXNfYWRkX2Jvb2tpbmdfbW9kYWxfdGltZV9maWVsZHMiLCJ3cGJjX2Jvb19saXN0aW5nX19lbnN1cmVfYWRkX2Jvb2tpbmdfbW9kYWxfc2VsZWN0ZWRfdGltZV9maWVsZHMiLCIkd3JhcCIsIiRpbnNlcnRfYmVmb3JlIiwiZmlyc3QiLCJiZWZvcmUiLCJ3cGJjX2Jvb19saXN0aW5nX19lbnN1cmVfYWRkX2Jvb2tpbmdfbW9kYWxfdGltZV9vdmVycmlkZV9wYW5lbCIsImRhdGEiLCJwYXJzZWRfdGltZSIsInRpbWVfb3ZlcnJpZGVfc3RhcnQiLCJ0aW1lX292ZXJyaWRlX2VuZCIsIiRtb2RhbCIsIiRmb290ZXJfc2xvdCIsInRvZ2dsZV9pZCIsInByZXBlbmQiLCJ0aW1lX292ZXJyaWRlX3NvdXJjZSIsInRpbWVfb3ZlcnJpZGVfZW5hYmxlZCIsIndwYmNfYm9vX2xpc3RpbmdfX2FwcGx5X2FkZF9ib29raW5nX21vZGFsX3RpbWVfb3ZlcnJpZGVfc3RhdGUiLCIkZW5hYmxlZCIsImlzX2VuYWJsZWQiLCJpcyIsIiRvdmVycmlkZV9maWVsZHMiLCIkZm9ybV90aW1lX2ZpZWxkcyIsInRvZ2dsZUNsYXNzIiwiYWRkQ2xhc3MiLCJyZW1vdmVBdHRyIiwicmVtb3ZlQ2xhc3MiLCJ3cGJjX2Jvb19saXN0aW5nX19hcHBseV9hZGRfYm9va2luZ19tb2RhbF9zZWxlY3RlZF90aW1lIiwiaGFzX3RpbWVfZmllbGRzIiwibm90Iiwid3BiY19ib29fbGlzdGluZ19fcHJlbG9hZF9hZGRfYm9va2luZ19tb2RhbF9zZWxlY3Rpb24iLCJwYXJzZUludCIsInNlbGVjdGVkX2RhdGUiLCJzZWxlY3RlZF9kYXRlc193aXRob3V0X2NhbGVuZGFyIiwiaXNfdGltZV9vdmVycmlkZSIsImFwcGx5X3RpbWUiLCJ3cGJjX2F1dG9fc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyIiwib2ZmIiwib25lIiwiZXZlbnQiLCJsb2FkZWRfcmVzb3VyY2VfaWQiLCJ3aW5kb3ciLCJzZXRUaW1lb3V0IiwiaXNfY2FsZW5kYXJfZGF0YV9sb2FkZWQiLCJfd3BiYyIsImJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUiLCJ3cGJjX2Rpc2FibGVfdGltZV9maWVsZHNfaW5fYm9va2luZ19mb3JtIiwid3BiY19ib29fbGlzdGluZ19fc3luY19hZGRfYm9va2luZ19tb2RhbF9jb250cm9scyIsIiRyZXNvdXJjZV9jb250cm9sIiwiJHJlc291cmNlX3NlbGVjdCIsIiRmb3JtX3NlbGVjdCIsIiRmb3JtX2VkaXRfbGluayIsIiRhbGxvd19wYXN0X2NvbnRyb2wiLCIkYWxsb3dfcGFzdF90b2dnbGUiLCJjdXJyZW50X21vZGUiLCJoaWRlIiwic2hvdyIsIndwYmNfYm9vX2xpc3RpbmdfX3N5bmNfYWRkX2Jvb2tpbmdfbW9kYWxfZm9ybV9lZGl0X2xpbmsiLCJhbGxvd19wYXN0IiwiZm9ybV9uYW1lIiwiYmFzZV91cmwiLCJzZXBhcmF0b3IiLCJpbmRleE9mIiwiZW5jb2RlVVJJQ29tcG9uZW50Iiwid3BiY19ib29fbGlzdGluZ19faW5pdF9hZGRfYm9va2luZ19tb2RhbF9jb250cm9scyIsIm9uIiwicmVhZHkiLCJ3cGJjX2Jvb19saXN0aW5nX19wcmVwYXJlX2FkZF9ib29raW5nX21vZGFsX3RpbWVfb3ZlcnJpZGUiLCIkc3RhcnQiLCIkZW5kIiwid3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fd2FybmluZyIsImdldCIsImFyZ3MiLCJub25jZSIsInRpdGxlIiwicG9zdCIsIndwYmNfdXJsX2FqYXgiLCJhY3Rpb24iLCJyZXNwb25zZSIsInN1Y2Nlc3MiLCJtZXNzYWdlIiwiYnV0dG9uX3RpdGxlIiwid3BiY19ob29rX19pbml0X2Jvb2tpbmdfZm9ybV93aXphcmRfYnV0dG9ucyIsInNldF9vdGhlcl9wYXJhbSIsIndwYmNfYnNfamF2YXNjcmlwdF90b29sdGlwcyIsIndwYmNfYnNfamF2YXNjcmlwdF9wb3BvdmVyIiwiZmFpbCIsIndwYmNfYm9vX2xpc3RpbmdfX3JlbG9hZF9hZnRlcl9hZGRfYm9va2luZ19tb2RhbF9zdWJtaXQiLCJ3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMiLCJ3cGJjX2FqeF9ib29raW5nX2xpc3RpbmciLCJ3cGJjX2FqeF9ib29raW5nX19hY3R1YWxfbGlzdGluZ19fc2hvdyIsIndwYmNfYm9vX2xpc3RpbmdfX3N1Ym1pdF9fYWRkX2Jvb2tpbmdfbW9kYWwiLCJzdWJtaXRfZm9ybSIsImdldEVsZW1lbnRCeUlkIiwibG9jYWxlIiwiZ2V0X290aGVyX3BhcmFtIiwic3VibWl0X3Jlc3VsdCIsInN1Ym1pdHRlZF9yZXNvdXJjZV9pZCIsIndwYmNfYm9va2luZ19mb3JtX3N1Ym1pdCIsIndwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19zZXRfYm9va2luZ19jb3N0IiwiY29zdCIsIndwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19zZXRfcGF5bWVudF9zdGF0dXMiLCJzZWxlY3RlZF9wYXlfc3RhdHVzIiwialNlbGVjdCIsImlzTmFOIiwicGFyc2VGbG9hdCIsIndwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19zZW5kX3BheW1lbnRfcmVxdWVzdCIsInZpc2l0b3Jib29raW5ncGF5dXJsIiwid3BiY19ib29fbGlzdGluZ19fY2xpY2tfX3NldF9ib29raW5nX25vdGUiLCJub3RlX3RleHQiLCJzY3JvbGxUb3AiLCJ3cGJjX2Jvb19saXN0aW5nX19jbGlja19fY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2UiLCJmb2N1cyIsIndwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19zZXRfdW5hdmFpbGFibGVfdGltZXMiLCJkYXRlX3N0YXJ0IiwiZGF0ZV9lbmQiLCIkcGFnZSIsIndwYmNfYXZhaWxhYmlsaXR5X3RpbWVzbG90c19pbml0Iiwid3BiY19hdmFpbGFiaWxpdHlfdGltZXNsb3RzX3NldF9jb250ZXh0Iiwid3BiY19ib29fbGlzdGluZ19fY2xpY2tfX2R1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlIiwid3BiY19ib29fbGlzdGluZ19fY2xpY2tfX3NldF9ib29raW5nX2xvY2FsZSIsInNlbGVjdGVkX2xvY2FsZV92YWx1ZSIsIndwYmNfYm9vX2xpc3RpbmdfX2luaXRfaG9va19fc29ydF9ieSIsImVsX2lkIiwicGFyYW1ldGVyX3ZhbHVlIiwic2VhcmNoX2dldF9wYXJhbSIsImpfb3B0aW9uX2xpbmsiLCJ3cGJjX2Jvb19saXN0aW5nX19jbGlja19fZXhwYW5kX2FsbF9yb3dzIiwidG9nZ2xlIiwid3BiY19ib29fbGlzdGluZ19fY2xpY2tfX2NvbGFwc2VfYWxsX3Jvd3MiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWJvb2tpbmdzL19zcmMvYm9vX2xpc3RpbmdfX2FjdGlvbnMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIEJvb2tpbmcgQWN0aW9ucyBpbiBCb29raW5nIExpc3RpbmcuXHJcbiAqXHJcbiAqIEB2ZXJzaW9uICAgICAxLjBcclxuICogQHBhY2thZ2UgICAgIEJvb2tpbmcgQ2FsZW5kYXJcclxuICogQGF1dGhvciAgICAgIHdwZGV2ZWxvcFxyXG4gKlxyXG4gKiBAd2ViLXNpdGUgICAgaHR0cHM6Ly93cGJvb2tpbmdjYWxlbmRhci5jb20vXHJcbiAqIEBlbWFpbCAgICAgICBpbmZvQHdwYm9va2luZ2NhbGVuZGFyLmNvbVxyXG4gKiBAbW9kaWZpZWQgICAgMjAyNS0wNC0wOFxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBDaGVjayBpZiB3ZSBjYW4gb3BlbiBtb2RhbC5cclxuICpcclxuICogQHBhcmFtIGh0bWxfaWQgICAgICBJRCBvZiBtb2RhbCB3aW5kb3csIGUuZy46ICcjd3BiY19tb2RhbF9fcGF5bWVudF9zdGF0dXNfZWRpdF9fc2VjdGlvbidcclxuICpcclxuICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2lzX21vZGFsX2FjY2Vzc2libGUoIGh0bWxfaWQgKSB7XHJcblx0aWYgKCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgKGpRdWVyeSggaHRtbF9pZCApLndwYmNfbXlfbW9kYWwpICkge1xyXG5cdFx0YWxlcnQoICdXYXJuaW5nISB3cGJjX215X21vZGFsIG1vZHVsZSBoYXMgbm90IGZvdW5kLiBQbGVhc2UsIHJlY2hlY2sgYWJvdXQgYW55IGNvbmZsaWN0cyBieSBkZWFjdGl2YXRpbmcgb3RoZXIgcGx1Z2lucy4nICk7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cdHJldHVybiB0cnVlO1xyXG59XHJcblxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vID09IEFjdGlvbnMsIHdoaWxlIGNsaWtpbmcgb24gb3B0aW9uIGRyb3Bkb3duID09XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIE9wZW4gQWRkL0VkaXQgQm9va2luZyBtb2RhbCBmcm9tIEJvb2tpbmcgTGlzdGluZyByb3cgdmFsdWVzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge3N0cmluZ3xudW1iZXJ9IGJvb2tpbmdfaWQgQm9va2luZyBJRC5cclxuICogQHBhcmFtIHtzdHJpbmd8bnVtYmVyfSByZXNvdXJjZV9pZCBSZXNvdXJjZSBJRC5cclxuICogQHBhcmFtIHtzdHJpbmd9IGJvb2tpbmdfaGFzaCBCb29raW5nIGhhc2guXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBib29raW5nX2Zvcm0gQ3VzdG9tIGJvb2tpbmcgZm9ybSBuYW1lLlxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbnx1bmRlZmluZWR9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19jbGlja19fYWRkX2Jvb2tpbmdfbW9kYWxfZnJvbV9yb3coIGJvb2tpbmdfaWQsIHJlc291cmNlX2lkLCBib29raW5nX2hhc2gsIGJvb2tpbmdfZm9ybSApe1xyXG5cclxuXHRpZiAoICEgYm9va2luZ19oYXNoICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHdwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19hZGRfYm9va2luZ19tb2RhbCgge1xyXG5cdFx0bW9kZSAgICAgICAgIDogJ2VkaXQnLFxyXG5cdFx0Ym9va2luZ19pZCAgIDogYm9va2luZ19pZCB8fCAnJyxcclxuXHRcdHJlc291cmNlX2lkICA6IHJlc291cmNlX2lkIHx8ICcnLFxyXG5cdFx0Ym9va2luZ19oYXNoIDogYm9va2luZ19oYXNoIHx8ICcnLFxyXG5cdFx0Ym9va2luZ19mb3JtIDogYm9va2luZ19mb3JtIHx8ICcnXHJcblx0fSApO1xyXG59XHJcblxyXG4vKipcclxuICogSW5zZXJ0IEFKQVgtcmVuZGVyZWQgQWRkL0VkaXQgQm9va2luZyBIVE1MIGFuZCBydW4gaXRzIGlubGluZSBsaWZlY3ljbGUgc2NyaXB0cyBvbmNlLlxyXG4gKlxyXG4gKiBAcGFyYW0ge09iamVjdH0gJGJvZHkgTW9kYWwgYm9keSBqUXVlcnkgb2JqZWN0LlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gaHRtbCBSZW5kZXJlZCBjb21wb25lbnQgSFRNTC5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX3NldF9hZGRfYm9va2luZ19tb2RhbF9ib2R5X2h0bWwoICRib2R5LCBodG1sICl7XHJcblxyXG5cdHZhciAkaHRtbCAgICA9IGpRdWVyeSggJzxkaXYgLz4nICkuYXBwZW5kKCBqUXVlcnkucGFyc2VIVE1MKCBodG1sIHx8ICcnLCBkb2N1bWVudCwgdHJ1ZSApICk7XHJcblx0dmFyICRzY3JpcHRzID0gJGh0bWwuZmluZCggJ3NjcmlwdCcgKS5yZW1vdmUoKTtcclxuXHJcblx0JGJvZHkuaHRtbCggJGh0bWwuY29udGVudHMoKSApO1xyXG5cclxuXHQkc2NyaXB0cy5lYWNoKCBmdW5jdGlvbigpe1xyXG5cdFx0dmFyIHR5cGUgPSAoIGpRdWVyeSggdGhpcyApLmF0dHIoICd0eXBlJyApIHx8ICcnICkudG9Mb3dlckNhc2UoKTtcclxuXHRcdHZhciBzcmMgID0galF1ZXJ5KCB0aGlzICkuYXR0ciggJ3NyYycgKTtcclxuXHRcdHZhciBjb2RlID0gdGhpcy50ZXh0IHx8IHRoaXMudGV4dENvbnRlbnQgfHwgdGhpcy5pbm5lckhUTUwgfHwgJyc7XHJcblxyXG5cdFx0aWYgKCB0eXBlICYmICEgL14odGV4dHxhcHBsaWNhdGlvbilcXC8oeC0pP2phdmFzY3JpcHQkLy50ZXN0KCB0eXBlICkgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIHNyYyApIHtcclxuXHRcdFx0alF1ZXJ5LmFqYXgoIHtcclxuXHRcdFx0XHR1cmwgICAgICA6IHNyYyxcclxuXHRcdFx0XHRkYXRhVHlwZSA6ICdzY3JpcHQnLFxyXG5cdFx0XHRcdGNhY2hlICAgIDogdHJ1ZSxcclxuXHRcdFx0XHRhc3luYyAgICA6IGZhbHNlXHJcblx0XHRcdH0gKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggY29kZSApIHtcclxuXHRcdFx0alF1ZXJ5Lmdsb2JhbEV2YWwoIGNvZGUgKTtcclxuXHRcdH1cclxuXHR9ICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBHZXQgbW9kYWwgbG9hZGluZyBzcGlubmVyIEhUTUwuXHJcbiAqXHJcbiAqIEByZXR1cm5zIHtzdHJpbmd9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19nZXRfYWRkX2Jvb2tpbmdfbW9kYWxfbG9hZGluZ19odG1sKCl7XHJcblx0cmV0dXJuICc8ZGl2IGNsYXNzPVwid3BiY19zcGluc19sb2FkaW5nX2NvbnRhaW5lclwiPidcclxuXHRcdCsgJzxkaXYgY2xhc3M9XCJ3cGJjX2Jvb2tpbmdfZm9ybV9zcGluX2xvYWRlclwiPidcclxuXHRcdCsgJzxkaXYgY2xhc3M9XCJ3cGJjX3NwaW5zX2xvYWRlcl93cmFwcGVyXCI+J1xyXG5cdFx0KyAnPGRpdiBjbGFzcz1cIndwYmNfc3Bpbl9sb2FkZXJfb25lX25ld1wiPjwvZGl2PidcclxuXHRcdCsgJzwvZGl2PidcclxuXHRcdCsgJzwvZGl2PidcclxuXHRcdCsgJzxzcGFuPkxvYWRpbmcuLi48L3NwYW4+J1xyXG5cdFx0KyAnPC9kaXY+JztcclxufVxyXG5cclxuLyoqXHJcbiAqIE5vcm1hbGl6ZSB0aW1lIG9wdGlvbiB2YWx1ZXMgZm9yIGNvbXBhcmlzb24uXHJcbiAqXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSB2YWx1ZSBUaW1lIG9yIHRpbWUtcmFuZ2UgdmFsdWUuXHJcbiAqIEByZXR1cm5zIHtzdHJpbmd9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19ub3JtYWxpemVfdGltZV92YWx1ZSggdmFsdWUgKXtcclxuXHRyZXR1cm4gU3RyaW5nKCB2YWx1ZSB8fCAnJyApLnJlcGxhY2UoIC9cXHMrL2csICcnICkudG9Mb3dlckNhc2UoKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFBhcnNlIFwiSEg6TU0gLSBISDpNTVwiIHNlbGVjdGVkIHRpbWUgaW50byBzdGFydC9lbmQgdmFsdWVzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gc2VsZWN0ZWRfdGltZSBUaW1lIHJhbmdlLlxyXG4gKiBAcmV0dXJucyB7e3N0YXJ0X3RpbWU6c3RyaW5nLGVuZF90aW1lOnN0cmluZ319XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19wYXJzZV9zZWxlY3RlZF90aW1lX3JhbmdlKCBzZWxlY3RlZF90aW1lICl7XHJcblxyXG5cdHZhciB0aW1lX3BhcnRzID0gU3RyaW5nKCBzZWxlY3RlZF90aW1lIHx8ICcnICkuc3BsaXQoICcgLSAnICk7XHJcblxyXG5cdHJldHVybiB7XHJcblx0XHRzdGFydF90aW1lOiBqUXVlcnkudHJpbSggdGltZV9wYXJ0c1swXSB8fCAnJyApLFxyXG5cdFx0ZW5kX3RpbWU6IGpRdWVyeS50cmltKCB0aW1lX3BhcnRzWzFdIHx8ICcnIClcclxuXHR9O1xyXG59XHJcblxyXG4vKipcclxuICogR2V0IGJvb2tpbmcgZm9ybSB0aW1lIGZpZWxkcyB0aGF0IGNhbiBjb25mbGljdCB3aXRoIGEgdGltZWxpbmUgb3ZlcnJpZGUuXHJcbiAqXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSAkZm9ybSBCb29raW5nIGZvcm0galF1ZXJ5IG9iamVjdC5cclxuICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkIEJvb2tpbmcgcmVzb3VyY2UgSUQuXHJcbiAqIEByZXR1cm5zIHtPYmplY3R9IGpRdWVyeSBjb2xsZWN0aW9uLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fZ2V0X2FkZF9ib29raW5nX21vZGFsX3RpbWVfZmllbGRzKCAkZm9ybSwgcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0dmFyIHNlbGVjdG9yID0gW1xyXG5cdFx0J3NlbGVjdFtuYW1lPVwicmFuZ2V0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHQnc2VsZWN0W25hbWU9XCJyYW5nZXRpbWUnICsgcmVzb3VyY2VfaWQgKyAnW11cIl0nLFxyXG5cdFx0J3NlbGVjdFtuYW1lPVwic3RhcnR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHQnc2VsZWN0W25hbWU9XCJzdGFydHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnW11cIl0nLFxyXG5cdFx0J3NlbGVjdFtuYW1lPVwiZW5kdGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nLFxyXG5cdFx0J3NlbGVjdFtuYW1lPVwiZW5kdGltZScgKyByZXNvdXJjZV9pZCArICdbXVwiXScsXHJcblx0XHQnc2VsZWN0W25hbWU9XCJkdXJhdGlvbnRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdJyxcclxuXHRcdCdzZWxlY3RbbmFtZT1cImR1cmF0aW9udGltZScgKyByZXNvdXJjZV9pZCArICdbXVwiXScsXHJcblx0XHQnaW5wdXRbbmFtZT1cInN0YXJ0dGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nLFxyXG5cdFx0J2lucHV0W25hbWU9XCJlbmR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXSdcclxuXHRdLmpvaW4oICcsICcgKTtcclxuXHJcblx0cmV0dXJuICRmb3JtLmZpbmQoIHNlbGVjdG9yICkuZmlsdGVyKCBmdW5jdGlvbigpe1xyXG5cdFx0dmFyICRmaWVsZCA9IGpRdWVyeSggdGhpcyApO1xyXG5cclxuXHRcdGlmICggJGZpZWxkLmNsb3Nlc3QoICcud3BiY19hZGRfYm9va2luZ19tb2RhbF9fc2VsZWN0ZWRfdGltZV9maWVsZHMnICkubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAnaW5wdXQnID09PSB0aGlzLnRhZ05hbWUudG9Mb3dlckNhc2UoKSAmJiAnaGlkZGVuJyA9PT0gU3RyaW5nKCAkZmllbGQuYXR0ciggJ3R5cGUnICkgfHwgJycgKS50b0xvd2VyQ2FzZSgpICkge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fSApO1xyXG59XHJcblxyXG4vKipcclxuICogU2VsZWN0IG1hdGNoaW5nIG9wdGlvbiBpbiBhIHRpbWUgc2VsZWN0IHdpdGhvdXQgZm9yY2luZyBkaXNhYmxlZCBjaG9pY2VzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge09iamVjdH0gJHNlbGVjdCBTZWxlY3QgZWxlbWVudC5cclxuICogQHBhcmFtIHtBcnJheX0gZXhwZWN0ZWRfdmFsdWVzIEFjY2VwdGFibGUgdmFsdWVzLlxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX3NlbGVjdF90aW1lX29wdGlvbiggJHNlbGVjdCwgZXhwZWN0ZWRfdmFsdWVzICl7XHJcblxyXG5cdHZhciBkaWRfc2VsZWN0ID0gZmFsc2U7XHJcblx0dmFyIG5vcm1hbGl6ZWRfZXhwZWN0ZWQgPSBbXTtcclxuXHJcblx0alF1ZXJ5LmVhY2goIGV4cGVjdGVkX3ZhbHVlcywgZnVuY3Rpb24oIGluZGV4LCB2YWx1ZSApe1xyXG5cdFx0bm9ybWFsaXplZF9leHBlY3RlZC5wdXNoKCB3cGJjX2Jvb19saXN0aW5nX19ub3JtYWxpemVfdGltZV92YWx1ZSggdmFsdWUgKSApO1xyXG5cdH0gKTtcclxuXHJcblx0JHNlbGVjdC5maW5kKCAnb3B0aW9uJyApLmVhY2goIGZ1bmN0aW9uKCl7XHJcblx0XHR2YXIgJG9wdGlvbiA9IGpRdWVyeSggdGhpcyApO1xyXG5cdFx0dmFyIG9wdGlvbl92YWx1ZSA9IHdwYmNfYm9vX2xpc3RpbmdfX25vcm1hbGl6ZV90aW1lX3ZhbHVlKCAkb3B0aW9uLnZhbCgpICk7XHJcblxyXG5cdFx0aWYgKCAtMSA9PT0galF1ZXJ5LmluQXJyYXkoIG9wdGlvbl92YWx1ZSwgbm9ybWFsaXplZF9leHBlY3RlZCApIHx8ICRvcHRpb24ucHJvcCggJ2Rpc2FibGVkJyApICkge1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICRzZWxlY3QucHJvcCggJ211bHRpcGxlJyApICkge1xyXG5cdFx0XHQkb3B0aW9uLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdCRzZWxlY3QudmFsKCAkb3B0aW9uLnZhbCgpICk7XHJcblx0XHR9XHJcblxyXG5cdFx0JHNlbGVjdC50cmlnZ2VyKCAnY2hhbmdlJyApO1xyXG5cdFx0ZGlkX3NlbGVjdCA9IHRydWU7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fSApO1xyXG5cclxuXHRyZXR1cm4gZGlkX3NlbGVjdDtcclxufVxyXG5cclxuLyoqXHJcbiAqIENoZWNrIHdoZXRoZXIgdGhlIHJlbmRlcmVkIGJvb2tpbmcgZm9ybSBhbHJlYWR5IGhhcyB1c2VyLWZhY2luZyB0aW1lIGZpZWxkcy5cclxuICpcclxuICogQHBhcmFtIHtPYmplY3R9ICRmb3JtIEJvb2tpbmcgZm9ybSBqUXVlcnkgb2JqZWN0LlxyXG4gKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWQgQm9va2luZyByZXNvdXJjZSBJRC5cclxuICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19oYXNfYWRkX2Jvb2tpbmdfbW9kYWxfdGltZV9maWVsZHMoICRmb3JtLCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRyZXR1cm4gd3BiY19ib29fbGlzdGluZ19fZ2V0X2FkZF9ib29raW5nX21vZGFsX3RpbWVfZmllbGRzKCAkZm9ybSwgcmVzb3VyY2VfaWQgKS5sZW5ndGggPiAwO1xyXG59XHJcblxyXG4vKipcclxuICogQWRkIHZpc2libGUgcmVhZC1vbmx5IHN0YXJ0L2VuZCB0aW1lIGZpZWxkcyB3aGVuIHRoZSBzZWxlY3RlZCBib29raW5nIGZvcm0gaGFzIG5vIHRpbWUgY29udHJvbHMuXHJcbiAqXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSAkZm9ybSBCb29raW5nIGZvcm0galF1ZXJ5IG9iamVjdC5cclxuICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkIEJvb2tpbmcgcmVzb3VyY2UgSUQuXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBzdGFydF90aW1lIFN0YXJ0IHRpbWUgaW4gMjRoIGZvcm1hdC5cclxuICogQHBhcmFtIHtzdHJpbmd9IGVuZF90aW1lIEVuZCB0aW1lIGluIDI0aCBmb3JtYXQuXHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fZW5zdXJlX2FkZF9ib29raW5nX21vZGFsX3NlbGVjdGVkX3RpbWVfZmllbGRzKCAkZm9ybSwgcmVzb3VyY2VfaWQsIHN0YXJ0X3RpbWUsIGVuZF90aW1lICl7XHJcblxyXG5cdHZhciAkd3JhcCA9ICRmb3JtLmZpbmQoICcud3BiY19hZGRfYm9va2luZ19tb2RhbF9fc2VsZWN0ZWRfdGltZV9maWVsZHMnICk7XHJcblx0dmFyIGh0bWw7XHJcblx0dmFyICRpbnNlcnRfYmVmb3JlO1xyXG5cclxuXHRpZiAoICEgc3RhcnRfdGltZSB8fCAhIGVuZF90aW1lICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0aWYgKCAhICR3cmFwLmxlbmd0aCApIHtcclxuXHRcdGh0bWwgPSAnPGRpdiBjbGFzcz1cIndwYmNfYWRkX2Jvb2tpbmdfbW9kYWxfX3NlbGVjdGVkX3RpbWVfZmllbGRzXCIgc3R5bGU9XCJtYXJnaW46MTJweCAwO3BhZGRpbmc6MTJweDtib3JkZXI6MXB4IHNvbGlkICNkY2RjZGU7YmFja2dyb3VuZDojZjZmN2Y3O2JvcmRlci1yYWRpdXM6NHB4O1wiPidcclxuXHRcdFx0KyAnPGRpdiBzdHlsZT1cImZvbnQtd2VpZ2h0OjYwMDttYXJnaW4tYm90dG9tOjhweDtcIj5TZWxlY3RlZCB0aW1lbGluZSBpbnRlcnZhbDwvZGl2PidcclxuXHRcdFx0KyAnPGRpdiBzdHlsZT1cImRpc3BsYXk6ZmxleDtnYXA6MTBweDtmbGV4LXdyYXA6d3JhcDthbGlnbi1pdGVtczpmbGV4LWVuZDtcIj4nXHJcblx0XHRcdCsgJzxsYWJlbCBzdHlsZT1cImRpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47Z2FwOjRweDttaW4td2lkdGg6MTIwcHg7XCI+J1xyXG5cdFx0XHQrICc8c3Bhbj5TdGFydCB0aW1lPC9zcGFuPidcclxuXHRcdFx0KyAnPGlucHV0IHR5cGU9XCJ0ZXh0XCIgY2xhc3M9XCJ3cGJjX3VpX2NvbnRyb2wgd3BiY191aV90ZXh0XCIgbmFtZT1cInN0YXJ0dGltZScgKyByZXNvdXJjZV9pZCArICdcIiB2YWx1ZT1cIlwiIHJlYWRvbmx5PVwicmVhZG9ubHlcIiAvPidcclxuXHRcdFx0KyAnPC9sYWJlbD4nXHJcblx0XHRcdCsgJzxsYWJlbCBzdHlsZT1cImRpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47Z2FwOjRweDttaW4td2lkdGg6MTIwcHg7XCI+J1xyXG5cdFx0XHQrICc8c3Bhbj5FbmQgdGltZTwvc3Bhbj4nXHJcblx0XHRcdCsgJzxpbnB1dCB0eXBlPVwidGV4dFwiIGNsYXNzPVwid3BiY191aV9jb250cm9sIHdwYmNfdWlfdGV4dFwiIG5hbWU9XCJlbmR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiIHZhbHVlPVwiXCIgcmVhZG9ubHk9XCJyZWFkb25seVwiIC8+J1xyXG5cdFx0XHQrICc8L2xhYmVsPidcclxuXHRcdFx0KyAnPC9kaXY+J1xyXG5cdFx0XHQrICc8L2Rpdj4nO1xyXG5cclxuXHRcdCR3cmFwID0galF1ZXJ5KCBodG1sICk7XHJcblx0XHQkaW5zZXJ0X2JlZm9yZSA9ICRmb3JtLmZpbmQoICcjYmtfdHlwZScgKyByZXNvdXJjZV9pZCApLmZpcnN0KCk7XHJcblxyXG5cdFx0aWYgKCAkaW5zZXJ0X2JlZm9yZS5sZW5ndGggKSB7XHJcblx0XHRcdCRpbnNlcnRfYmVmb3JlLmJlZm9yZSggJHdyYXAgKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdCRmb3JtLmZpbmQoICcjYm9va2luZ19mb3JtX2RpdicgKyByZXNvdXJjZV9pZCApLmFwcGVuZCggJHdyYXAgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdCR3cmFwLmZpbmQoICdpbnB1dFtuYW1lPVwic3RhcnR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScgKS52YWwoIHN0YXJ0X3RpbWUgKS50cmlnZ2VyKCAnaW5wdXQnICkudHJpZ2dlciggJ2NoYW5nZScgKTtcclxuXHQkd3JhcC5maW5kKCAnaW5wdXRbbmFtZT1cImVuZHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdJyApLnZhbCggZW5kX3RpbWUgKS50cmlnZ2VyKCAnaW5wdXQnICkudHJpZ2dlciggJ2NoYW5nZScgKTtcclxuXHJcblx0cmV0dXJuIHRydWU7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBZGQvdXBkYXRlIHRoZSBleHBsaWNpdCB0aW1lbGluZSBpbnRlcnZhbCBvdmVycmlkZSBwYW5lbC5cclxuICpcclxuICogQHBhcmFtIHtPYmplY3R9ICRmb3JtIEJvb2tpbmcgZm9ybSBqUXVlcnkgb2JqZWN0LlxyXG4gKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWQgQm9va2luZyByZXNvdXJjZSBJRC5cclxuICogQHBhcmFtIHtPYmplY3R9IGRhdGEgTW9kYWwgY29udGV4dC5cclxuICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19lbnN1cmVfYWRkX2Jvb2tpbmdfbW9kYWxfdGltZV9vdmVycmlkZV9wYW5lbCggJGZvcm0sIHJlc291cmNlX2lkLCBkYXRhICl7XHJcblxyXG5cdHZhciBzZWxlY3RlZF90aW1lID0gKCBkYXRhICYmIGRhdGEuc2VsZWN0ZWRfdGltZSApID8gZGF0YS5zZWxlY3RlZF90aW1lIDogJyc7XHJcblx0dmFyIHBhcnNlZF90aW1lID0gd3BiY19ib29fbGlzdGluZ19fcGFyc2Vfc2VsZWN0ZWRfdGltZV9yYW5nZSggc2VsZWN0ZWRfdGltZSApO1xyXG5cdHZhciBzdGFydF90aW1lID0gKCBkYXRhICYmIGRhdGEudGltZV9vdmVycmlkZV9zdGFydCApID8gZGF0YS50aW1lX292ZXJyaWRlX3N0YXJ0IDogcGFyc2VkX3RpbWUuc3RhcnRfdGltZTtcclxuXHR2YXIgZW5kX3RpbWUgPSAoIGRhdGEgJiYgZGF0YS50aW1lX292ZXJyaWRlX2VuZCApID8gZGF0YS50aW1lX292ZXJyaWRlX2VuZCA6IHBhcnNlZF90aW1lLmVuZF90aW1lO1xyXG5cdHZhciAkbW9kYWwgPSBqUXVlcnkoICcjd3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX3NlY3Rpb24nICk7XHJcblx0dmFyICRmb290ZXJfc2xvdCA9ICRtb2RhbC5maW5kKCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLWZvb3Rlcl0nICkuZmlyc3QoKTtcclxuXHR2YXIgdG9nZ2xlX2lkID0gJ3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX190aW1lX292ZXJyaWRlX2VuYWJsZWQnO1xyXG5cdHZhciAkd3JhcCA9ICRtb2RhbC5maW5kKCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLXBhbmVsXScgKS5maXJzdCgpO1xyXG5cdHZhciBodG1sO1xyXG5cclxuXHRpZiAoICEgc3RhcnRfdGltZSB8fCAhIGVuZF90aW1lICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0aWYgKCAhICR3cmFwLmxlbmd0aCApIHtcclxuXHRcdGh0bWwgPSAnPGRpdiBjbGFzcz1cIndwYmNfYWRkX2Jvb2tpbmdfbW9kYWxfX3NlbGVjdGVkX3RpbWVfZmllbGRzIHdwYmNfYWRkX2Jvb2tpbmdfbW9kYWxfX3RpbWVfb3ZlcnJpZGVcIiBkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1wYW5lbD1cIjFcIj4nXHJcblx0XHRcdCsgJzxzcGFuIGNsYXNzPVwid3BiY191aV9fdG9nZ2xlIHdwYmNfYWRkX2Jvb2tpbmdfbW9kYWxfX3RpbWVfb3ZlcnJpZGVfdG9nZ2xlXCI+J1xyXG5cdFx0XHQrICc8aW5wdXQgdHlwZT1cImNoZWNrYm94XCIgaWQ9XCInICsgdG9nZ2xlX2lkICsgJ1wiIHZhbHVlPVwiMVwiIGNsYXNzPVwid3BiY191aV9jaGVja2JveFwiIGRhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLWVuYWJsZWQ9XCIxXCIgZGF0YS13cGJjLWJvb2tpbmctc3VibWl0LWlnbm9yZT1cIjFcIiBjaGVja2VkPVwiY2hlY2tlZFwiIGF1dG9jb21wbGV0ZT1cIm9mZlwiIC8+J1xyXG5cdFx0XHQrICc8bGFiZWwgY2xhc3M9XCJ3cGJjX3VpX190b2dnbGVfaWNvbiB0b29sdGlwX3RvcFwiIGZvcj1cIicgKyB0b2dnbGVfaWQgKyAnXCIgZGF0YS1vcmlnaW5hbC10aXRsZT1cIlVzZSBzZWxlY3RlZCB0aW1lbGluZSBpbnRlcnZhbFwiPjwvbGFiZWw+J1xyXG5cdFx0XHQrICc8bGFiZWwgZm9yPVwiJyArIHRvZ2dsZV9pZCArICdcIiBjbGFzcz1cIndwYmNfdWlfY29udHJvbF9sYWJlbCB3cGJjX3VpX190b2dnbGVfbGFiZWxcIj5Vc2Ugc2VsZWN0ZWQgdGltZWxpbmUgaW50ZXJ2YWw8L2xhYmVsPidcclxuXHRcdFx0KyAnPGkgY2xhc3M9XCJ3cGJjX2hlbHBfdG9vbHRpcFwiPjwvaT4nXHJcblx0XHRcdCsgJzwvc3Bhbj4nXHJcblx0XHRcdCsgJzxkaXYgY2xhc3M9XCJ3cGJjX2FkZF9ib29raW5nX21vZGFsX190aW1lX292ZXJyaWRlX2ZpZWxkc1wiPidcclxuXHRcdFx0KyAnPGxhYmVsPjxzcGFuPlN0YXJ0IHRpbWU8L3NwYW4+PGlucHV0IHR5cGU9XCJ0ZXh0XCIgY2xhc3M9XCJ3cGJjX3VpX2NvbnRyb2wgd3BiY191aV90ZXh0XCIgbmFtZT1cInN0YXJ0dGltZScgKyByZXNvdXJjZV9pZCArICdcIiB2YWx1ZT1cIlwiIHJlYWRvbmx5PVwicmVhZG9ubHlcIiBkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1maWVsZD1cInN0YXJ0XCIgLz48L2xhYmVsPidcclxuXHRcdFx0KyAnPGxhYmVsPjxzcGFuPkVuZCB0aW1lPC9zcGFuPjxpbnB1dCB0eXBlPVwidGV4dFwiIGNsYXNzPVwid3BiY191aV9jb250cm9sIHdwYmNfdWlfdGV4dFwiIG5hbWU9XCJlbmR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiIHZhbHVlPVwiXCIgcmVhZG9ubHk9XCJyZWFkb25seVwiIGRhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLWZpZWxkPVwiZW5kXCIgLz48L2xhYmVsPidcclxuXHRcdFx0KyAnPC9kaXY+J1xyXG5cdFx0XHQrICc8ZGl2IGNsYXNzPVwid3BiY19hZGRfYm9va2luZ19tb2RhbF9fdGltZV9vdmVycmlkZV9ub3RlXCI+Rm9ybSB0aW1lIGZpZWxkcyBhcmUgaWdub3JlZCB3aGlsZSBlbmFibGVkLjwvZGl2PidcclxuXHRcdFx0KyAnPC9kaXY+JztcclxuXHJcblx0XHQkd3JhcCA9IGpRdWVyeSggaHRtbCApO1xyXG5cclxuXHRcdGlmICggJGZvb3Rlcl9zbG90Lmxlbmd0aCApIHtcclxuXHRcdFx0JGZvb3Rlcl9zbG90Lmh0bWwoICR3cmFwICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHQkbW9kYWwuZmluZCggJy5tb2RhbC1mb290ZXInICkucHJlcGVuZCggJHdyYXAgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdCR3cmFwLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1zb3VyY2UnLCAoIGRhdGEgJiYgZGF0YS50aW1lX292ZXJyaWRlX3NvdXJjZSApID8gZGF0YS50aW1lX292ZXJyaWRlX3NvdXJjZSA6ICcnICk7XHJcblx0JHdyYXAuZmluZCggJ1tkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1maWVsZD1cInN0YXJ0XCJdJyApLmF0dHIoICduYW1lJywgJ3N0YXJ0dGltZScgKyByZXNvdXJjZV9pZCApLnZhbCggc3RhcnRfdGltZSApLnRyaWdnZXIoICdpbnB1dCcgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xyXG5cdCR3cmFwLmZpbmQoICdbZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtZmllbGQ9XCJlbmRcIl0nICkuYXR0ciggJ25hbWUnLCAnZW5kdGltZScgKyByZXNvdXJjZV9pZCApLnZhbCggZW5kX3RpbWUgKS50cmlnZ2VyKCAnaW5wdXQnICkudHJpZ2dlciggJ2NoYW5nZScgKTtcclxuXHQkd3JhcC5maW5kKCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLWVuYWJsZWRdJyApLnByb3AoICdjaGVja2VkJywgISBkYXRhIHx8ICggJzAnICE9PSBTdHJpbmcoIGRhdGEudGltZV9vdmVycmlkZV9lbmFibGVkIHx8ICcxJyApICkgKTtcclxuXHJcblx0d3BiY19ib29fbGlzdGluZ19fYXBwbHlfYWRkX2Jvb2tpbmdfbW9kYWxfdGltZV9vdmVycmlkZV9zdGF0ZSggJGZvcm0sIHJlc291cmNlX2lkICk7XHJcblxyXG5cdHJldHVybiB0cnVlO1xyXG59XHJcblxyXG4vKipcclxuICogRW5hYmxlL2Rpc2FibGUgdGhlIHRpbWVsaW5lIGludGVydmFsIG92ZXJyaWRlIGFuZCBtYXJrIGNvbmZsaWN0aW5nIGZvcm0gZmllbGRzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge09iamVjdH0gJGZvcm0gQm9va2luZyBmb3JtIGpRdWVyeSBvYmplY3QuXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCBCb29raW5nIHJlc291cmNlIElELlxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX2FwcGx5X2FkZF9ib29raW5nX21vZGFsX3RpbWVfb3ZlcnJpZGVfc3RhdGUoICRmb3JtLCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHR2YXIgJG1vZGFsID0galF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19zZWN0aW9uJyApO1xyXG5cdHZhciAkd3JhcCA9ICRtb2RhbC5maW5kKCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLXBhbmVsXScgKS5maXJzdCgpO1xyXG5cdHZhciAkZW5hYmxlZCA9ICR3cmFwLmZpbmQoICdbZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtZW5hYmxlZF0nICkuZmlyc3QoKTtcclxuXHR2YXIgaXNfZW5hYmxlZCA9ICRlbmFibGVkLmxlbmd0aCA/ICRlbmFibGVkLmlzKCAnOmNoZWNrZWQnICkgOiBmYWxzZTtcclxuXHR2YXIgJG92ZXJyaWRlX2ZpZWxkcyA9ICR3cmFwLmZpbmQoICdbZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtZmllbGRdJyApO1xyXG5cdHZhciAkZm9ybV90aW1lX2ZpZWxkcyA9IHdwYmNfYm9vX2xpc3RpbmdfX2dldF9hZGRfYm9va2luZ19tb2RhbF90aW1lX2ZpZWxkcyggJGZvcm0sIHJlc291cmNlX2lkICk7XHJcblxyXG5cdGlmICggISAkd3JhcC5sZW5ndGggKSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHQkd3JhcC50b2dnbGVDbGFzcyggJ2lzLWVuYWJsZWQnLCBpc19lbmFibGVkICk7XHJcblx0JG92ZXJyaWRlX2ZpZWxkcy5hdHRyKCAnZGF0YS13cGJjLWJvb2tpbmctc3VibWl0LWlnbm9yZScsIGlzX2VuYWJsZWQgPyAnMCcgOiAnMScgKTtcclxuXHJcblx0JGZvcm1fdGltZV9maWVsZHMuZWFjaCggZnVuY3Rpb24oKXtcclxuXHRcdHZhciAkZmllbGQgPSBqUXVlcnkoIHRoaXMgKTtcclxuXHJcblx0XHRpZiAoIGlzX2VuYWJsZWQgKSB7XHJcblx0XHRcdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAkZmllbGQuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLW9yaWdpbmFsLWRpc2FibGVkJyApICkge1xyXG5cdFx0XHRcdCRmaWVsZC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtb3JpZ2luYWwtZGlzYWJsZWQnLCAkZmllbGQucHJvcCggJ2Rpc2FibGVkJyApID8gJzEnIDogJzAnICk7XHJcblx0XHRcdH1cclxuXHRcdFx0JGZpZWxkXHJcblx0XHRcdFx0LmF0dHIoICdkYXRhLXdwYmMtYm9va2luZy1zdWJtaXQtaWdub3JlJywgJzEnIClcclxuXHRcdFx0XHQucHJvcCggJ2Rpc2FibGVkJywgdHJ1ZSApXHJcblx0XHRcdFx0LmFkZENsYXNzKCAnd3BiY19hZGRfYm9va2luZ19tb2RhbF9fdGltZV9maWVsZF9vdmVycmlkZGVuJyApO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0JGZpZWxkXHJcblx0XHRcdFx0LnJlbW92ZUF0dHIoICdkYXRhLXdwYmMtYm9va2luZy1zdWJtaXQtaWdub3JlJyApXHJcblx0XHRcdFx0LnByb3AoICdkaXNhYmxlZCcsICcxJyA9PT0gJGZpZWxkLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1vcmlnaW5hbC1kaXNhYmxlZCcgKSApXHJcblx0XHRcdFx0LnJlbW92ZUF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1vcmlnaW5hbC1kaXNhYmxlZCcgKVxyXG5cdFx0XHRcdC5yZW1vdmVDbGFzcyggJ3dwYmNfYWRkX2Jvb2tpbmdfbW9kYWxfX3RpbWVfZmllbGRfb3ZlcnJpZGRlbicgKTtcclxuXHRcdH1cclxuXHR9ICk7XHJcblxyXG5cdHJldHVybiBpc19lbmFibGVkO1xyXG59XHJcblxyXG4vKipcclxuICogQXBwbHkgYSBwcmVzZWxlY3RlZCB0aW1lIHJhbmdlIHRvIHRoZSByZW5kZXJlZCBBZGQgQm9va2luZyBmb3JtLlxyXG4gKlxyXG4gKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWQgQm9va2luZyByZXNvdXJjZSBJRC5cclxuICogQHBhcmFtIHtzdHJpbmd9IHNlbGVjdGVkX3RpbWUgVGltZSByYW5nZSwgZS5nLiBcIjA5OjAwIC0gMTE6MDBcIi5cclxuICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19hcHBseV9hZGRfYm9va2luZ19tb2RhbF9zZWxlY3RlZF90aW1lKCByZXNvdXJjZV9pZCwgc2VsZWN0ZWRfdGltZSApe1xyXG5cclxuXHR2YXIgJGZvcm0gPSBqUXVlcnkoICcjYm9va2luZ19mb3JtJyArIHJlc291cmNlX2lkICk7XHJcblx0dmFyIHRpbWVfcGFydHM7XHJcblx0dmFyIHN0YXJ0X3RpbWU7XHJcblx0dmFyIGVuZF90aW1lO1xyXG5cdHZhciBkaWRfc2VsZWN0ID0gZmFsc2U7XHJcblx0dmFyIGhhc190aW1lX2ZpZWxkcztcclxuXHJcblx0aWYgKCAhICRmb3JtLmxlbmd0aCB8fCAhIHNlbGVjdGVkX3RpbWUgKSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHR0aW1lX3BhcnRzID0gd3BiY19ib29fbGlzdGluZ19fcGFyc2Vfc2VsZWN0ZWRfdGltZV9yYW5nZSggc2VsZWN0ZWRfdGltZSApO1xyXG5cdHN0YXJ0X3RpbWUgPSB0aW1lX3BhcnRzLnN0YXJ0X3RpbWU7XHJcblx0ZW5kX3RpbWUgPSB0aW1lX3BhcnRzLmVuZF90aW1lO1xyXG5cdGhhc190aW1lX2ZpZWxkcyA9IHdwYmNfYm9vX2xpc3RpbmdfX2hhc19hZGRfYm9va2luZ19tb2RhbF90aW1lX2ZpZWxkcyggJGZvcm0sIHJlc291cmNlX2lkICk7XHJcblxyXG5cdGlmICggISBoYXNfdGltZV9maWVsZHMgKSB7XHJcblx0XHRyZXR1cm4gd3BiY19ib29fbGlzdGluZ19fZW5zdXJlX2FkZF9ib29raW5nX21vZGFsX3NlbGVjdGVkX3RpbWVfZmllbGRzKCAkZm9ybSwgcmVzb3VyY2VfaWQsIHN0YXJ0X3RpbWUsIGVuZF90aW1lICk7XHJcblx0fVxyXG5cclxuXHQkZm9ybS5maW5kKCAnc2VsZWN0W25hbWU9XCJyYW5nZXRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdLCBzZWxlY3RbbmFtZT1cInJhbmdldGltZScgKyByZXNvdXJjZV9pZCArICdbXVwiXScgKS5lYWNoKCBmdW5jdGlvbigpe1xyXG5cdFx0ZGlkX3NlbGVjdCA9IHdwYmNfYm9vX2xpc3RpbmdfX3NlbGVjdF90aW1lX29wdGlvbiggalF1ZXJ5KCB0aGlzICksIFsgc2VsZWN0ZWRfdGltZSBdICkgfHwgZGlkX3NlbGVjdDtcclxuXHR9ICk7XHJcblxyXG5cdGlmICggc3RhcnRfdGltZSApIHtcclxuXHRcdCRmb3JtLmZpbmQoICdzZWxlY3RbbmFtZT1cInN0YXJ0dGltZScgKyByZXNvdXJjZV9pZCArICdcIl0sIHNlbGVjdFtuYW1lPVwic3RhcnR0aW1lJyArIHJlc291cmNlX2lkICsgJ1tdXCJdJyApLmVhY2goIGZ1bmN0aW9uKCl7XHJcblx0XHRcdGRpZF9zZWxlY3QgPSB3cGJjX2Jvb19saXN0aW5nX19zZWxlY3RfdGltZV9vcHRpb24oIGpRdWVyeSggdGhpcyApLCBbIHN0YXJ0X3RpbWUgXSApIHx8IGRpZF9zZWxlY3Q7XHJcblx0XHR9ICk7XHJcblx0XHRpZiAoICRmb3JtLmZpbmQoICdpbnB1dFtuYW1lPVwic3RhcnR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScgKS5ub3QoICdbdHlwZT1cImhpZGRlblwiXScgKS52YWwoIHN0YXJ0X3RpbWUgKS50cmlnZ2VyKCAnaW5wdXQnICkudHJpZ2dlciggJ2NoYW5nZScgKS5sZW5ndGggKSB7XHJcblx0XHRcdGRpZF9zZWxlY3QgPSB0cnVlO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0aWYgKCBlbmRfdGltZSApIHtcclxuXHRcdCRmb3JtLmZpbmQoICdzZWxlY3RbbmFtZT1cImVuZHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdLCBzZWxlY3RbbmFtZT1cImVuZHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnW11cIl0nICkuZWFjaCggZnVuY3Rpb24oKXtcclxuXHRcdFx0ZGlkX3NlbGVjdCA9IHdwYmNfYm9vX2xpc3RpbmdfX3NlbGVjdF90aW1lX29wdGlvbiggalF1ZXJ5KCB0aGlzICksIFsgZW5kX3RpbWUgXSApIHx8IGRpZF9zZWxlY3Q7XHJcblx0XHR9ICk7XHJcblx0XHRpZiAoICRmb3JtLmZpbmQoICdpbnB1dFtuYW1lPVwiZW5kdGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nICkubm90KCAnW3R5cGU9XCJoaWRkZW5cIl0nICkudmFsKCBlbmRfdGltZSApLnRyaWdnZXIoICdpbnB1dCcgKS50cmlnZ2VyKCAnY2hhbmdlJyApLmxlbmd0aCApIHtcclxuXHRcdFx0ZGlkX3NlbGVjdCA9IHRydWU7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gZGlkX3NlbGVjdDtcclxufVxyXG5cclxuLyoqXHJcbiAqIEFwcGx5IEFkZCBCb29raW5nIG1vZGFsIGRhdGUvdGltZSBjb250ZXh0IGFmdGVyIEFKQVgtcmVuZGVyZWQgZm9ybSBsaWZlY3ljbGUgc2NyaXB0cyBydW4uXHJcbiAqXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhIEFKQVggcmVzcG9uc2UgZGF0YS5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX3ByZWxvYWRfYWRkX2Jvb2tpbmdfbW9kYWxfc2VsZWN0aW9uKCBkYXRhICl7XHJcblxyXG5cdGRhdGEgPSBkYXRhIHx8IHt9O1xyXG5cclxuXHR2YXIgcmVzb3VyY2VfaWQgPSBwYXJzZUludCggZGF0YS5yZXNvdXJjZV9pZCwgMTAgKTtcclxuXHR2YXIgc2VsZWN0ZWRfZGF0ZSA9IGRhdGEuc2VsZWN0ZWRfZGF0ZSB8fCAnJztcclxuXHR2YXIgc2VsZWN0ZWRfdGltZSA9IGRhdGEuc2VsZWN0ZWRfdGltZSB8fCAnJztcclxuXHR2YXIgc2VsZWN0ZWRfZGF0ZXNfd2l0aG91dF9jYWxlbmRhciA9IGRhdGEuc2VsZWN0ZWRfZGF0ZXNfd2l0aG91dF9jYWxlbmRhciB8fCAnJztcclxuXHR2YXIgaXNfdGltZV9vdmVycmlkZSA9ICEhIHBhcnNlSW50KCBkYXRhLnRpbWVfb3ZlcnJpZGVfZW5hYmxlZCB8fCAwLCAxMCApO1xyXG5cdHZhciBhcHBseV90aW1lO1xyXG5cclxuXHRpZiAoICEgcmVzb3VyY2VfaWQgKSB7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHRpZiAoICEgaXNfdGltZV9vdmVycmlkZSApIHtcclxuXHRcdGpRdWVyeSggJyN3cGJjX21vZGFsX19hZGRfYm9va2luZ19fc2VjdGlvbicgKS5maW5kKCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLXBhbmVsXScgKS5yZW1vdmUoKTtcclxuXHR9XHJcblxyXG5cdGlmIChcclxuXHRcdCAgIHNlbGVjdGVkX2RhdGVcclxuXHRcdCYmICEgc2VsZWN0ZWRfZGF0ZXNfd2l0aG91dF9jYWxlbmRhclxyXG5cdFx0JiYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd3BiY19hdXRvX3NlbGVjdF9kYXRlc19pbl9jYWxlbmRhciApXHJcblx0KSB7XHJcblx0XHRqUXVlcnkoICdib2R5JyApLm9mZiggJ3dwYmNfY2FsZW5kYXJfYWp4X19sb2FkZWRfZGF0YS53cGJjX2FkZF9ib29raW5nX21vZGFsX2RhdGUnICkub25lKCAnd3BiY19jYWxlbmRhcl9hanhfX2xvYWRlZF9kYXRhLndwYmNfYWRkX2Jvb2tpbmdfbW9kYWxfZGF0ZScsIGZ1bmN0aW9uKCBldmVudCwgbG9hZGVkX3Jlc291cmNlX2lkICl7XHJcblx0XHRcdGlmICggcGFyc2VJbnQoIGxvYWRlZF9yZXNvdXJjZV9pZCwgMTAgKSA9PT0gcmVzb3VyY2VfaWQgKSB7XHJcblx0XHRcdFx0d3BiY19hdXRvX3NlbGVjdF9kYXRlc19pbl9jYWxlbmRhciggcmVzb3VyY2VfaWQsIHNlbGVjdGVkX2RhdGUsIHNlbGVjdGVkX2RhdGUgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cdFx0d2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uKCl7XHJcblx0XHRcdHdwYmNfYXV0b19zZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXIoIHJlc291cmNlX2lkLCBzZWxlY3RlZF9kYXRlLCBzZWxlY3RlZF9kYXRlICk7XHJcblx0XHR9LCAzMDAgKTtcclxuXHR9XHJcblxyXG5cdGlmICggISBzZWxlY3RlZF90aW1lICkge1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0YXBwbHlfdGltZSA9IGZ1bmN0aW9uKCl7XHJcblx0XHR2YXIgaXNfY2FsZW5kYXJfZGF0YV9sb2FkZWQgPSAoXHJcblx0XHRcdCAgICEgc2VsZWN0ZWRfZGF0ZVxyXG5cdFx0XHR8fCAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgX3dwYmMgKVxyXG5cdFx0XHR8fCAoICdmdW5jdGlvbicgIT09IHR5cGVvZiBfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlIClcclxuXHRcdFx0fHwgKCBmYWxzZSAhPT0gX3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSggcmVzb3VyY2VfaWQsIHNlbGVjdGVkX2RhdGUgKSApXHJcblx0XHQpO1xyXG5cclxuXHRcdGlmICggaXNfY2FsZW5kYXJfZGF0YV9sb2FkZWQgJiYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd3BiY19kaXNhYmxlX3RpbWVfZmllbGRzX2luX2Jvb2tpbmdfZm9ybSApICkge1xyXG5cdFx0XHR3cGJjX2Rpc2FibGVfdGltZV9maWVsZHNfaW5fYm9va2luZ19mb3JtKCByZXNvdXJjZV9pZCApO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCBpc190aW1lX292ZXJyaWRlICkge1xyXG5cdFx0XHR3cGJjX2Jvb19saXN0aW5nX19lbnN1cmVfYWRkX2Jvb2tpbmdfbW9kYWxfdGltZV9vdmVycmlkZV9wYW5lbCggalF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCApLCByZXNvdXJjZV9pZCwgZGF0YSApO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHR3cGJjX2Jvb19saXN0aW5nX19hcHBseV9hZGRfYm9va2luZ19tb2RhbF9zZWxlY3RlZF90aW1lKCByZXNvdXJjZV9pZCwgc2VsZWN0ZWRfdGltZSApO1xyXG5cdH07XHJcblxyXG5cdGpRdWVyeSggJy5ib29raW5nX2Zvcm1fZGl2JyApLm9mZiggJ3dwYmNfaG9va190aW1lc2xvdHNfZGlzYWJsZWQud3BiY19hZGRfYm9va2luZ19tb2RhbF90aW1lJyApLm9uZSggJ3dwYmNfaG9va190aW1lc2xvdHNfZGlzYWJsZWQud3BiY19hZGRfYm9va2luZ19tb2RhbF90aW1lJywgZnVuY3Rpb24oIGV2ZW50LCBsb2FkZWRfcmVzb3VyY2VfaWQgKXtcclxuXHRcdGlmICggcGFyc2VJbnQoIGxvYWRlZF9yZXNvdXJjZV9pZCwgMTAgKSA9PT0gcmVzb3VyY2VfaWQgKSB7XHJcblx0XHRcdHdpbmRvdy5zZXRUaW1lb3V0KCBhcHBseV90aW1lLCAwICk7XHJcblx0XHR9XHJcblx0fSApO1xyXG5cclxuXHRqUXVlcnkoICdib2R5JyApLm9mZiggJ3dwYmNfY2FsZW5kYXJfYWp4X19sb2FkZWRfZGF0YS53cGJjX2FkZF9ib29raW5nX21vZGFsX3RpbWUnICkub25lKCAnd3BiY19jYWxlbmRhcl9hanhfX2xvYWRlZF9kYXRhLndwYmNfYWRkX2Jvb2tpbmdfbW9kYWxfdGltZScsIGZ1bmN0aW9uKCBldmVudCwgbG9hZGVkX3Jlc291cmNlX2lkICl7XHJcblx0XHRpZiAoIHBhcnNlSW50KCBsb2FkZWRfcmVzb3VyY2VfaWQsIDEwICkgPT09IHJlc291cmNlX2lkICkge1xyXG5cdFx0XHR3aW5kb3cuc2V0VGltZW91dCggYXBwbHlfdGltZSwgODAgKTtcclxuXHRcdH1cclxuXHR9ICk7XHJcblxyXG5cdHdpbmRvdy5zZXRUaW1lb3V0KCBhcHBseV90aW1lLCAzNTAgKTtcclxuXHR3aW5kb3cuc2V0VGltZW91dCggYXBwbHlfdGltZSwgMTAwMCApO1xyXG59XHJcblxyXG4vKipcclxuICogUmVmcmVzaCBtb2RhbCBmb290ZXIgY29udHJvbHMgYWZ0ZXIgQWRkL0VkaXQgQm9va2luZyBjb250ZXh0IGNoYW5nZXMuXHJcbiAqXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSAkbW9kYWwgTW9kYWwgalF1ZXJ5IG9iamVjdC5cclxuICogQHBhcmFtIHtPYmplY3R9IGRhdGEgQUpBWCByZXNwb25zZSBkYXRhLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbW9kZSBDdXJyZW50IG1vZGFsIG1vZGUuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19zeW5jX2FkZF9ib29raW5nX21vZGFsX2NvbnRyb2xzKCAkbW9kYWwsIGRhdGEsIG1vZGUgKXtcclxuXHJcblx0ZGF0YSA9IGRhdGEgfHwge307XHJcblxyXG5cdCRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLW1vZGUnLCBtb2RlIHx8IGRhdGEubW9kZSB8fCAnYWRkJyApO1xyXG5cclxuXHR2YXIgJHJlc291cmNlX2NvbnRyb2wgPSAkbW9kYWwuZmluZCggJy53cGJjX21vZGFsX19hZGRfYm9va2luZ19fcmVzb3VyY2VfY29udHJvbCcgKTtcclxuXHR2YXIgJHJlc291cmNlX3NlbGVjdCAgPSAkbW9kYWwuZmluZCggJyN3cGJjX21vZGFsX19hZGRfYm9va2luZ19fcmVzb3VyY2VfaWQnICk7XHJcblx0dmFyICRmb3JtX3NlbGVjdCAgICAgID0gJG1vZGFsLmZpbmQoICcjd3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX2Jvb2tpbmdfZm9ybScgKTtcclxuXHR2YXIgJGZvcm1fZWRpdF9saW5rICAgPSAkbW9kYWwuZmluZCggJy53cGJjX21vZGFsX19hZGRfYm9va2luZ19fZWRpdF9mb3JtX2xpbmsnICk7XHJcblx0dmFyICRhbGxvd19wYXN0X2NvbnRyb2wgPSAkbW9kYWwuZmluZCggJy53cGJjX21vZGFsX19hZGRfYm9va2luZ19fYWxsb3dfcGFzdF9jb250cm9sJyApO1xyXG5cdHZhciAkYWxsb3dfcGFzdF90b2dnbGUgID0gJG1vZGFsLmZpbmQoICdbZGF0YS13cGJjLWFkZC1ib29raW5nLWFsbG93LXBhc3RdJyApLmZpcnN0KCk7XHJcblx0dmFyIGN1cnJlbnRfbW9kZSAgICAgICAgPSBtb2RlIHx8IGRhdGEubW9kZSB8fCAnYWRkJztcclxuXHJcblx0aWYgKCAnZWRpdCcgPT09IGN1cnJlbnRfbW9kZSApIHtcclxuXHRcdCRyZXNvdXJjZV9jb250cm9sLmhpZGUoKTtcclxuXHRcdCRhbGxvd19wYXN0X2NvbnRyb2wuaGlkZSgpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHQkcmVzb3VyY2VfY29udHJvbC5zaG93KCk7XHJcblx0XHQkYWxsb3dfcGFzdF9jb250cm9sLnNob3coKTtcclxuXHR9XHJcblxyXG5cdGlmICggZGF0YS5yZXNvdXJjZV9pZCAmJiAkcmVzb3VyY2Vfc2VsZWN0Lmxlbmd0aCApIHtcclxuXHRcdCRyZXNvdXJjZV9zZWxlY3QudmFsKCBTdHJpbmcoIGRhdGEucmVzb3VyY2VfaWQgKSApO1xyXG5cdH1cclxuXHJcblx0aWYgKCAkZm9ybV9zZWxlY3QubGVuZ3RoICkge1xyXG5cdFx0JGZvcm1fc2VsZWN0LnZhbCggZGF0YS5ib29raW5nX2Zvcm0gfHwgJ3N0YW5kYXJkJyApO1xyXG5cdH1cclxuXHJcblx0aWYgKCAkZm9ybV9lZGl0X2xpbmsubGVuZ3RoICkge1xyXG5cdFx0d3BiY19ib29fbGlzdGluZ19fc3luY19hZGRfYm9va2luZ19tb2RhbF9mb3JtX2VkaXRfbGluayggJG1vZGFsICk7XHJcblx0fVxyXG5cclxuXHRpZiAoICRhbGxvd19wYXN0X3RvZ2dsZS5sZW5ndGggKSB7XHJcblx0XHQkYWxsb3dfcGFzdF90b2dnbGUucHJvcCggJ2NoZWNrZWQnLCAhISBwYXJzZUludCggZGF0YS5hbGxvd19wYXN0IHx8IDAsIDEwICkgKTtcclxuXHR9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTeW5jIEZvcm1zIEJ1aWxkZXIgZWRpdCBsaW5rIHdpdGggc2VsZWN0ZWQgY3VzdG9tIGJvb2tpbmcgZm9ybS5cclxuICpcclxuICogQHBhcmFtIHtPYmplY3R9ICRtb2RhbCBNb2RhbCBqUXVlcnkgb2JqZWN0LlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fc3luY19hZGRfYm9va2luZ19tb2RhbF9mb3JtX2VkaXRfbGluayggJG1vZGFsICl7XHJcblxyXG5cdHZhciAkZm9ybV9zZWxlY3QgICAgPSAkbW9kYWwuZmluZCggJyN3cGJjX21vZGFsX19hZGRfYm9va2luZ19fYm9va2luZ19mb3JtJyApO1xyXG5cdHZhciAkZm9ybV9lZGl0X2xpbmsgPSAkbW9kYWwuZmluZCggJy53cGJjX21vZGFsX19hZGRfYm9va2luZ19fZWRpdF9mb3JtX2xpbmsnICk7XHJcblxyXG5cdGlmICggISAkZm9ybV9zZWxlY3QubGVuZ3RoIHx8ICEgJGZvcm1fZWRpdF9saW5rLmxlbmd0aCApIHtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdHZhciBmb3JtX25hbWUgPSAkZm9ybV9zZWxlY3QudmFsKCkgfHwgJ3N0YW5kYXJkJztcclxuXHR2YXIgYmFzZV91cmwgID0gJGZvcm1fZWRpdF9saW5rLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctZm9ybS1idWlsZGVyLXVybCcgKSB8fCAkZm9ybV9lZGl0X2xpbmsuYXR0ciggJ2hyZWYnICkgfHwgJyc7XHJcblxyXG5cdGlmICggISBiYXNlX3VybCApIHtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdHZhciBzZXBhcmF0b3IgPSAoIC0xID09PSBiYXNlX3VybC5pbmRleE9mKCAnPycgKSApID8gJz8nIDogJyYnO1xyXG5cdCRmb3JtX2VkaXRfbGluay5hdHRyKCAnaHJlZicsIGJhc2VfdXJsICsgc2VwYXJhdG9yICsgJ2Zvcm1fbmFtZT0nICsgZW5jb2RlVVJJQ29tcG9uZW50KCBmb3JtX25hbWUgKSApO1xyXG59XHJcblxyXG4vKipcclxuICogSW5pdCBtb2RhbCBmb290ZXIgY29udHJvbHMuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19pbml0X2FkZF9ib29raW5nX21vZGFsX2NvbnRyb2xzKCl7XHJcblxyXG5cdGpRdWVyeSggZG9jdW1lbnQgKS5vZmYoICdjaGFuZ2Uud3BiY19hZGRfYm9va2luZ19tb2RhbCcsICcjd3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX3Jlc291cmNlX2lkLCAjd3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX2Jvb2tpbmdfZm9ybSwgI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19hbGxvd19wYXN0JyApLm9uKFxyXG5cdFx0J2NoYW5nZS53cGJjX2FkZF9ib29raW5nX21vZGFsJyxcclxuXHRcdCcjd3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX3Jlc291cmNlX2lkLCAjd3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX2Jvb2tpbmdfZm9ybSwgI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19hbGxvd19wYXN0JyxcclxuXHRcdGZ1bmN0aW9uKCl7XHJcblx0XHRcdHZhciAkbW9kYWwgPSBqUXVlcnkoICcjd3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX3NlY3Rpb24nICk7XHJcblx0XHRcdHZhciBtb2RlICAgPSAkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1tb2RlJyApIHx8ICdhZGQnO1xyXG5cclxuXHRcdFx0d3BiY19ib29fbGlzdGluZ19fY2xpY2tfX2FkZF9ib29raW5nX21vZGFsKCB7XHJcblx0XHRcdFx0bW9kZSAgICAgICAgIDogbW9kZSxcclxuXHRcdFx0XHRib29raW5nX2lkICAgOiAkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1pZCcgKSB8fCAnJyxcclxuXHRcdFx0XHRyZXNvdXJjZV9pZCAgOiAkbW9kYWwuZmluZCggJyN3cGJjX21vZGFsX19hZGRfYm9va2luZ19fcmVzb3VyY2VfaWQnICkudmFsKCkgfHwgJycsXHJcblx0XHRcdFx0Ym9va2luZ19oYXNoIDogJG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctaGFzaCcgKSB8fCAnJyxcclxuXHRcdFx0XHRib29raW5nX2Zvcm0gOiAkbW9kYWwuZmluZCggJyN3cGJjX21vZGFsX19hZGRfYm9va2luZ19fYm9va2luZ19mb3JtJyApLnZhbCgpIHx8ICcnLFxyXG5cdFx0XHRcdGFsbG93X3Bhc3QgICA6ICRtb2RhbC5maW5kKCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy1hbGxvdy1wYXN0XScgKS5maXJzdCgpLmlzKCAnOmNoZWNrZWQnICkgPyAxIDogMCxcclxuXHRcdFx0XHRzZWxlY3RlZF9kYXRlIDogJG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctc2VsZWN0ZWQtZGF0ZScgKSB8fCAnJyxcclxuXHRcdFx0XHRzZWxlY3RlZF90aW1lIDogJG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctc2VsZWN0ZWQtdGltZScgKSB8fCAnJyxcclxuXHRcdFx0XHR0aW1lX292ZXJyaWRlX2VuYWJsZWQgOiAkbW9kYWwuZmluZCggJ1tkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1lbmFibGVkXScgKS5maXJzdCgpLmxlbmd0aFxyXG5cdFx0XHRcdFx0PyAoICRtb2RhbC5maW5kKCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLWVuYWJsZWRdJyApLmZpcnN0KCkuaXMoICc6Y2hlY2tlZCcgKSA/IDEgOiAwIClcclxuXHRcdFx0XHRcdDogKCAkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLWVuYWJsZWQnICkgfHwgMCApLFxyXG5cdFx0XHRcdHRpbWVfb3ZlcnJpZGVfc291cmNlIDogJG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1zb3VyY2UnICkgfHwgJycsXHJcblx0XHRcdFx0dGltZV9vdmVycmlkZV9zdGFydCA6ICRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtc3RhcnQnICkgfHwgJycsXHJcblx0XHRcdFx0dGltZV9vdmVycmlkZV9lbmQgOiAkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLWVuZCcgKSB8fCAnJ1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblx0KTtcclxuXHJcblx0alF1ZXJ5KCBkb2N1bWVudCApLm9mZiggJ2NoYW5nZS53cGJjX2FkZF9ib29raW5nX21vZGFsX3RpbWVfb3ZlcnJpZGUnLCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLWVuYWJsZWRdJyApLm9uKFxyXG5cdFx0J2NoYW5nZS53cGJjX2FkZF9ib29raW5nX21vZGFsX3RpbWVfb3ZlcnJpZGUnLFxyXG5cdFx0J1tkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1lbmFibGVkXScsXHJcblx0XHRmdW5jdGlvbigpe1xyXG5cdFx0XHR2YXIgJG1vZGFsID0galF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19zZWN0aW9uJyApO1xyXG5cdFx0XHR2YXIgcmVzb3VyY2VfaWQgPSBwYXJzZUludCggJG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctcmVzb3VyY2UtaWQnICkgfHwgMCwgMTAgKTtcclxuXHRcdFx0dmFyICRmb3JtID0galF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdFx0aWYgKCByZXNvdXJjZV9pZCAmJiAkZm9ybS5sZW5ndGggKSB7XHJcblx0XHRcdFx0d3BiY19ib29fbGlzdGluZ19fYXBwbHlfYWRkX2Jvb2tpbmdfbW9kYWxfdGltZV9vdmVycmlkZV9zdGF0ZSggJGZvcm0sIHJlc291cmNlX2lkICk7XHJcblx0XHRcdFx0JG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1lbmFibGVkJywgalF1ZXJ5KCB0aGlzICkuaXMoICc6Y2hlY2tlZCcgKSA/ICcxJyA6ICcwJyApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0KTtcclxufVxyXG5qUXVlcnkoIGRvY3VtZW50ICkucmVhZHkoIGZ1bmN0aW9uKCl7XHJcblx0d3BiY19ib29fbGlzdGluZ19faW5pdF9hZGRfYm9va2luZ19tb2RhbF9jb250cm9scygpO1xyXG59ICk7XHJcblxyXG4vKipcclxuICogUHJlcGFyZSBzZWxlY3RlZCB0aW1lbGluZSBpbnRlcnZhbCBiZWZvcmUgQWRkIEJvb2tpbmcgbW9kYWwgc3VibWl0LlxyXG4gKlxyXG4gKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWQgQm9va2luZyByZXNvdXJjZSBJRC5cclxuICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19wcmVwYXJlX2FkZF9ib29raW5nX21vZGFsX3RpbWVfb3ZlcnJpZGUoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdHZhciAkbW9kYWwgPSBqUXVlcnkoICcjd3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX3NlY3Rpb24nICk7XHJcblx0dmFyICRmb3JtID0galF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCApO1xyXG5cdHZhciAkd3JhcCA9ICRtb2RhbC5maW5kKCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLXBhbmVsXScgKS5maXJzdCgpO1xyXG5cdHZhciAkZW5hYmxlZCA9ICR3cmFwLmZpbmQoICdbZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtZW5hYmxlZF0nICkuZmlyc3QoKTtcclxuXHR2YXIgJHN0YXJ0O1xyXG5cdHZhciAkZW5kO1xyXG5cclxuXHRpZiAoICEgJG1vZGFsLmlzKCAnOnZpc2libGUnICkgfHwgISAkd3JhcC5sZW5ndGggfHwgISAkZW5hYmxlZC5pcyggJzpjaGVja2VkJyApICkge1xyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fVxyXG5cclxuXHR3cGJjX2Jvb19saXN0aW5nX19hcHBseV9hZGRfYm9va2luZ19tb2RhbF90aW1lX292ZXJyaWRlX3N0YXRlKCAkZm9ybSwgcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0JHN0YXJ0ID0gJHdyYXAuZmluZCggJ1tkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1maWVsZD1cInN0YXJ0XCJdJyApLmZpcnN0KCk7XHJcblx0JGVuZCA9ICR3cmFwLmZpbmQoICdbZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtZmllbGQ9XCJlbmRcIl0nICkuZmlyc3QoKTtcclxuXHJcblx0aWYgKCAhICRzdGFydC52YWwoKSB8fCAhICRlbmQudmFsKCkgKSB7XHJcblx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX193YXJuaW5nICkge1xyXG5cdFx0XHR3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX193YXJuaW5nKCAkd3JhcC5nZXQoIDAgKSwgJ1NlbGVjdGVkIHRpbWVsaW5lIGludGVydmFsIGlzIG5vdCBjb21wbGV0ZS4nICk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHQkbW9kYWxcclxuXHRcdC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtZW5hYmxlZCcsICcxJyApXHJcblx0XHQuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLXN0YXJ0JywgJHN0YXJ0LnZhbCgpIClcclxuXHRcdC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtZW5kJywgJGVuZC52YWwoKSApO1xyXG5cclxuXHRyZXR1cm4gdHJ1ZTtcclxufVxyXG5cclxuLyoqXHJcbiAqIE9wZW4gQWRkL0VkaXQgQm9va2luZyBtb2RhbC5cclxuICpcclxuICogQHBhcmFtIHtPYmplY3R9IGFyZ3MgTW9kYWwgY29udGV4dC5cclxuICogQHJldHVybnMge2Jvb2xlYW58dW5kZWZpbmVkfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fY2xpY2tfX2FkZF9ib29raW5nX21vZGFsKCBhcmdzICl7XHJcblxyXG5cdGlmICggISB3cGJjX2lzX21vZGFsX2FjY2Vzc2libGUoICcjd3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX3NlY3Rpb24nICkgKSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHRhcmdzID0gYXJncyB8fCB7fTtcclxuXHJcblx0dmFyICRtb2RhbCA9IGpRdWVyeSggJyN3cGJjX21vZGFsX19hZGRfYm9va2luZ19fc2VjdGlvbicgKTtcclxuXHR2YXIgJGJvZHkgPSBqUXVlcnkoICcjd3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX2JvZHknICk7XHJcblx0dmFyIG5vbmNlID0gJG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctbm9uY2UnICk7XHJcblx0dmFyIG1vZGUgPSBhcmdzLm1vZGUgfHwgKCBhcmdzLmJvb2tpbmdfaGFzaCA/ICdlZGl0JyA6ICdhZGQnICk7XHJcblx0dmFyIHRpdGxlID0gKCAnZWRpdCcgPT09IG1vZGUgKSA/ICdFZGl0IGJvb2tpbmcnIDogJ0FkZCBib29raW5nJztcclxuXHR2YXIgYWxsb3dfcGFzdCA9IGFyZ3MuYWxsb3dfcGFzdCA/IDEgOiAwO1xyXG5cclxuXHRpZiAoICEgYWxsb3dfcGFzdCAmJiAkbW9kYWwuZmluZCggJ1tkYXRhLXdwYmMtYWRkLWJvb2tpbmctYWxsb3ctcGFzdF0nICkuZmlyc3QoKS5pcyggJzpjaGVja2VkJyApICkge1xyXG5cdFx0YWxsb3dfcGFzdCA9IDE7XHJcblx0fVxyXG5cclxuXHRpZiAoICdlZGl0JyA9PT0gbW9kZSApIHtcclxuXHRcdGFsbG93X3Bhc3QgPSAxO1xyXG5cdH1cclxuXHJcblx0JG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctcmVzb3VyY2UtaWQnLCAnJyApO1xyXG5cdCRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLWhhc2gnLCBhcmdzLmJvb2tpbmdfaGFzaCB8fCAnJyApO1xyXG5cdCRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLWlkJywgYXJncy5ib29raW5nX2lkIHx8ICcnICk7XHJcblx0JG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctbW9kZScsIG1vZGUgKTtcclxuXHQkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1hbGxvdy1wYXN0JywgYWxsb3dfcGFzdCA/ICcxJyA6ICcwJyApO1xyXG5cdCRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLXNlbGVjdGVkLWRhdGUnLCBhcmdzLnNlbGVjdGVkX2RhdGUgfHwgJycgKTtcclxuXHQkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1zZWxlY3RlZC10aW1lJywgYXJncy5zZWxlY3RlZF90aW1lIHx8ICcnICk7XHJcblx0JG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1lbmFibGVkJywgYXJncy50aW1lX292ZXJyaWRlX2VuYWJsZWQgPyAnMScgOiAnMCcgKTtcclxuXHQkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLXNvdXJjZScsIGFyZ3MudGltZV9vdmVycmlkZV9zb3VyY2UgfHwgJycgKTtcclxuXHQkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLXN0YXJ0JywgYXJncy50aW1lX292ZXJyaWRlX3N0YXJ0IHx8ICcnICk7XHJcblx0JG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1lbmQnLCBhcmdzLnRpbWVfb3ZlcnJpZGVfZW5kIHx8ICcnICk7XHJcblx0aWYgKCAhIGFyZ3MudGltZV9vdmVycmlkZV9lbmFibGVkICkge1xyXG5cdFx0JG1vZGFsLmZpbmQoICdbZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtcGFuZWxdJyApLnJlbW92ZSgpO1xyXG5cdH1cclxuXHRhcmdzLmFsbG93X3Bhc3QgPSBhbGxvd19wYXN0O1xyXG5cdHdwYmNfYm9vX2xpc3RpbmdfX3N5bmNfYWRkX2Jvb2tpbmdfbW9kYWxfY29udHJvbHMoICRtb2RhbCwgYXJncywgbW9kZSApO1xyXG5cdCRtb2RhbC5maW5kKCAnLndwYmNfbW9kYWxfX2FkZF9ib29raW5nX190aXRsZScgKS50ZXh0KCB0aXRsZSApO1xyXG5cdCRtb2RhbC5maW5kKCAnLndwYmNfbW9kYWxfX2FkZF9ib29raW5nX19ib29raW5nX2lkJyApLmh0bWwoIGFyZ3MuYm9va2luZ19pZCA/ICggJ0lEOiAnICsgYXJncy5ib29raW5nX2lkICkgOiAnJyApO1xyXG5cdCRtb2RhbC5maW5kKCAnI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19idXR0b25fc2VuZCcgKS50ZXh0KCAoICdlZGl0JyA9PT0gbW9kZSApID8gJ1NhdmUgYm9va2luZycgOiAnQWRkIGJvb2tpbmcnICk7XHJcblx0JGJvZHkuaHRtbCggd3BiY19ib29fbGlzdGluZ19fZ2V0X2FkZF9ib29raW5nX21vZGFsX2xvYWRpbmdfaHRtbCgpICk7XHJcblxyXG5cdCRtb2RhbC53cGJjX215X21vZGFsKCAnc2hvdycgKTtcclxuXHJcblx0alF1ZXJ5LnBvc3QoXHJcblx0XHR3cGJjX3VybF9hamF4LFxyXG5cdFx0e1xyXG5cdFx0XHRhY3Rpb24gICAgICAgOiAnV1BCQ19BSlhfQUREX0JPT0tJTkdfTU9EQUwnLFxyXG5cdFx0XHRub25jZSAgICAgICAgOiBub25jZSxcclxuXHRcdFx0bW9kZSAgICAgICAgIDogbW9kZSxcclxuXHRcdFx0Ym9va2luZ19pZCAgIDogYXJncy5ib29raW5nX2lkIHx8ICcnLFxyXG5cdFx0XHRyZXNvdXJjZV9pZCAgOiBhcmdzLnJlc291cmNlX2lkIHx8ICcnLFxyXG5cdFx0XHRib29raW5nX2hhc2ggOiBhcmdzLmJvb2tpbmdfaGFzaCB8fCAnJyxcclxuXHRcdFx0Ym9va2luZ19mb3JtIDogYXJncy5ib29raW5nX2Zvcm0gfHwgJycsXHJcblx0XHRcdGFsbG93X3Bhc3QgICA6IGFsbG93X3Bhc3QsXHJcblx0XHRcdHNlbGVjdGVkX2RhdGVzX3dpdGhvdXRfY2FsZW5kYXIgOiBhcmdzLnNlbGVjdGVkX2RhdGVzX3dpdGhvdXRfY2FsZW5kYXIgfHwgJycsXHJcblx0XHRcdHNlbGVjdGVkX2RhdGUgOiBhcmdzLnNlbGVjdGVkX2RhdGUgfHwgJycsXHJcblx0XHRcdHNlbGVjdGVkX3RpbWUgOiBhcmdzLnNlbGVjdGVkX3RpbWUgfHwgJycsXHJcblx0XHRcdHRpbWVfb3ZlcnJpZGVfZW5hYmxlZCA6IGFyZ3MudGltZV9vdmVycmlkZV9lbmFibGVkID8gMSA6IDAsXHJcblx0XHRcdHRpbWVfb3ZlcnJpZGVfc291cmNlIDogYXJncy50aW1lX292ZXJyaWRlX3NvdXJjZSB8fCAnJyxcclxuXHRcdFx0dGltZV9vdmVycmlkZV9zdGFydCA6IGFyZ3MudGltZV9vdmVycmlkZV9zdGFydCB8fCAnJyxcclxuXHRcdFx0dGltZV9vdmVycmlkZV9lbmQgOiBhcmdzLnRpbWVfb3ZlcnJpZGVfZW5kIHx8ICcnXHJcblx0XHR9LFxyXG5cdFx0ZnVuY3Rpb24oIHJlc3BvbnNlICl7XHJcblxyXG5cdFx0XHRpZiAoICEgcmVzcG9uc2UgfHwgISByZXNwb25zZS5zdWNjZXNzICkge1xyXG5cdFx0XHRcdHZhciBtZXNzYWdlID0gKCByZXNwb25zZSAmJiByZXNwb25zZS5kYXRhICYmIHJlc3BvbnNlLmRhdGEubWVzc2FnZSApID8gcmVzcG9uc2UuZGF0YS5tZXNzYWdlIDogJ1VuYWJsZSB0byBsb2FkIGJvb2tpbmcgZm9ybS4nO1xyXG5cdFx0XHRcdCRib2R5Lmh0bWwoICc8ZGl2IGNsYXNzPVwid3BiYy1zZXR0aW5ncy1ub3RpY2Ugbm90aWNlLXdhcm5pbmdcIiBzdHlsZT1cInRleHQtYWxpZ246bGVmdFwiPicgKyBtZXNzYWdlICsgJzwvZGl2PicgKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdCRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLXJlc291cmNlLWlkJywgcmVzcG9uc2UuZGF0YS5yZXNvdXJjZV9pZCB8fCAnJyApO1xyXG5cdFx0XHQkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1oYXNoJywgcmVzcG9uc2UuZGF0YS5ib29raW5nX2hhc2ggfHwgJycgKTtcclxuXHRcdFx0JG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctaWQnLCByZXNwb25zZS5kYXRhLmJvb2tpbmdfaWQgfHwgJycgKTtcclxuXHRcdFx0JG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctbW9kZScsIHJlc3BvbnNlLmRhdGEubW9kZSB8fCBtb2RlICk7XHJcblx0XHRcdCRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLWFsbG93LXBhc3QnLCByZXNwb25zZS5kYXRhLmFsbG93X3Bhc3QgPyAnMScgOiAnMCcgKTtcclxuXHRcdFx0JG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctc2VsZWN0ZWQtZGF0ZScsIHJlc3BvbnNlLmRhdGEuc2VsZWN0ZWRfZGF0ZSB8fCAnJyApO1xyXG5cdFx0XHQkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1zZWxlY3RlZC10aW1lJywgcmVzcG9uc2UuZGF0YS5zZWxlY3RlZF90aW1lIHx8ICcnICk7XHJcblx0XHRcdCRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtZW5hYmxlZCcsIHJlc3BvbnNlLmRhdGEudGltZV9vdmVycmlkZV9lbmFibGVkID8gJzEnIDogJzAnICk7XHJcblx0XHRcdCRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtc291cmNlJywgcmVzcG9uc2UuZGF0YS50aW1lX292ZXJyaWRlX3NvdXJjZSB8fCAnJyApO1xyXG5cdFx0XHQkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLXN0YXJ0JywgcmVzcG9uc2UuZGF0YS50aW1lX292ZXJyaWRlX3N0YXJ0IHx8ICcnICk7XHJcblx0XHRcdCRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtZW5kJywgcmVzcG9uc2UuZGF0YS50aW1lX292ZXJyaWRlX2VuZCB8fCAnJyApO1xyXG5cdFx0XHR3cGJjX2Jvb19saXN0aW5nX19zeW5jX2FkZF9ib29raW5nX21vZGFsX2NvbnRyb2xzKCAkbW9kYWwsIHJlc3BvbnNlLmRhdGEsIHJlc3BvbnNlLmRhdGEubW9kZSB8fCBtb2RlICk7XHJcblx0XHRcdCRtb2RhbC5maW5kKCAnLndwYmNfbW9kYWxfX2FkZF9ib29raW5nX190aXRsZScgKS50ZXh0KCByZXNwb25zZS5kYXRhLnRpdGxlIHx8IHRpdGxlICk7XHJcblx0XHRcdCRtb2RhbC5maW5kKCAnLndwYmNfbW9kYWxfX2FkZF9ib29raW5nX19ib29raW5nX2lkJyApLmh0bWwoIHJlc3BvbnNlLmRhdGEuYm9va2luZ19pZCA/ICggJ0lEOiAnICsgcmVzcG9uc2UuZGF0YS5ib29raW5nX2lkICkgOiAnJyApO1xyXG5cdFx0XHQkbW9kYWwuZmluZCggJyN3cGJjX21vZGFsX19hZGRfYm9va2luZ19fYnV0dG9uX3NlbmQnICkudGV4dCggcmVzcG9uc2UuZGF0YS5idXR0b25fdGl0bGUgfHwgKCAoICdlZGl0JyA9PT0gbW9kZSApID8gJ1NhdmUgYm9va2luZycgOiAnQWRkIGJvb2tpbmcnICkgKTtcclxuXHRcdFx0d3BiY19ib29fbGlzdGluZ19fc2V0X2FkZF9ib29raW5nX21vZGFsX2JvZHlfaHRtbCggJGJvZHksIHJlc3BvbnNlLmRhdGEuaHRtbCB8fCAnJyApO1xyXG5cclxuXHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd3BiY19ob29rX19pbml0X2Jvb2tpbmdfZm9ybV93aXphcmRfYnV0dG9ucyApIHtcclxuXHRcdFx0XHR3cGJjX2hvb2tfX2luaXRfYm9va2luZ19mb3JtX3dpemFyZF9idXR0b25zKCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBfd3BiYyApIHtcclxuXHRcdFx0XHRfd3BiYy5zZXRfb3RoZXJfcGFyYW0oICd0aGlzX3BhZ2VfYm9va2luZ19oYXNoJywgcmVzcG9uc2UuZGF0YS5ib29raW5nX2hhc2ggfHwgJycgKTtcclxuXHRcdFx0XHRfd3BiYy5zZXRfb3RoZXJfcGFyYW0oICd0aGlzX3BhZ2VfYWxsb3dfcGFzdCcsIHJlc3BvbnNlLmRhdGEuYWxsb3dfcGFzdCA/IDEgOiAwICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdwYmNfYnNfamF2YXNjcmlwdF90b29sdGlwcyApIHtcclxuXHRcdFx0XHR3cGJjX2JzX2phdmFzY3JpcHRfdG9vbHRpcHMoKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3cGJjX2JzX2phdmFzY3JpcHRfcG9wb3ZlciApIHtcclxuXHRcdFx0XHR3cGJjX2JzX2phdmFzY3JpcHRfcG9wb3ZlcigpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR3cGJjX2Jvb19saXN0aW5nX19wcmVsb2FkX2FkZF9ib29raW5nX21vZGFsX3NlbGVjdGlvbiggcmVzcG9uc2UuZGF0YSApO1xyXG5cdFx0fVxyXG5cdCkuZmFpbCggZnVuY3Rpb24oKXtcclxuXHRcdCRib2R5Lmh0bWwoICc8ZGl2IGNsYXNzPVwid3BiYy1zZXR0aW5ncy1ub3RpY2Ugbm90aWNlLXdhcm5pbmdcIiBzdHlsZT1cInRleHQtYWxpZ246bGVmdFwiPlVuYWJsZSB0byBsb2FkIGJvb2tpbmcgZm9ybS48L2Rpdj4nICk7XHJcblx0fSApO1xyXG59XHJcblxyXG4vKipcclxuICogUmVsb2FkIEJvb2tpbmcgTGlzdGluZyBhZnRlciBBZGQvRWRpdCBCb29raW5nIG1vZGFsIHNhdmVkIHN1Y2Nlc3NmdWxseS5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX3JlbG9hZF9hZnRlcl9hZGRfYm9va2luZ19tb2RhbF9zdWJtaXQoKXtcclxuXHJcblx0dmFyICRtb2RhbCA9IGpRdWVyeSggJyN3cGJjX21vZGFsX19hZGRfYm9va2luZ19fc2VjdGlvbicgKTtcclxuXHJcblx0aWYgKCAkbW9kYWwubGVuZ3RoICYmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mICRtb2RhbC53cGJjX215X21vZGFsICkgKSB7XHJcblx0XHQkbW9kYWwud3BiY19teV9tb2RhbCggJ2hpZGUnICk7XHJcblx0fVxyXG5cclxuXHRpZiAoXHJcblx0XHQgICAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zIClcclxuXHRcdCYmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiB3aW5kb3cud3BiY19hanhfYm9va2luZ19saXN0aW5nIClcclxuXHQpIHtcclxuXHRcdHdpbmRvdy53cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHt9ICk7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19hanhfYm9va2luZ19fYWN0dWFsX2xpc3RpbmdfX3Nob3cgKSB7XHJcblx0XHR3aW5kb3cud3BiY19hanhfYm9va2luZ19fYWN0dWFsX2xpc3RpbmdfX3Nob3coKTtcclxuXHR9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTdWJtaXQgQWRkL0VkaXQgQm9va2luZyBtb2RhbCBmb3JtLlxyXG4gKlxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbnx1bmRlZmluZWR9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19zdWJtaXRfX2FkZF9ib29raW5nX21vZGFsKCl7XHJcblxyXG5cdHZhciAkbW9kYWwgPSBqUXVlcnkoICcjd3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX3NlY3Rpb24nICk7XHJcblx0dmFyICRmb3JtID0gJG1vZGFsLmZpbmQoICdmb3JtLmJvb2tpbmdfZm9ybScgKS5maXJzdCgpO1xyXG5cdHZhciByZXNvdXJjZV9pZCA9IDA7XHJcblxyXG5cdGlmICggJGZvcm0ubGVuZ3RoICkge1xyXG5cdFx0cmVzb3VyY2VfaWQgPSBwYXJzZUludCggKCAkZm9ybS5hdHRyKCAnaWQnICkgfHwgJycgKS5yZXBsYWNlKCAnYm9va2luZ19mb3JtJywgJycgKSwgMTAgKTtcclxuXHR9XHJcblxyXG5cdGlmICggISByZXNvdXJjZV9pZCApIHtcclxuXHRcdHJlc291cmNlX2lkID0gcGFyc2VJbnQoICRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLXJlc291cmNlLWlkJyApLCAxMCApO1xyXG5cdH1cclxuXHJcblx0aWYgKCAhIHJlc291cmNlX2lkICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0dmFyIHN1Ym1pdF9mb3JtID0gJGZvcm0ubGVuZ3RoID8gJGZvcm0uZ2V0KCAwICkgOiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCApO1xyXG5cdHZhciBsb2NhbGUgPSAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YgX3dwYmMgKSA/IF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ2xvY2FsZV9hY3RpdmUnICkgOiAnJztcclxuXHR2YXIgc3VibWl0X3Jlc3VsdDtcclxuXHJcblx0aWYgKCAhIHdwYmNfYm9vX2xpc3RpbmdfX3ByZXBhcmVfYWRkX2Jvb2tpbmdfbW9kYWxfdGltZV9vdmVycmlkZSggcmVzb3VyY2VfaWQgKSApIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cdGpRdWVyeSggJ2JvZHknICkub2ZmKCAnd3BiY19ib29raW5nX2Zvcm1fc3VibWl0X3N1Y2Nlc3Mud3BiY19hZGRfYm9va2luZ19tb2RhbF9yZWxvYWQnIClcclxuXHRcdC5vbiggJ3dwYmNfYm9va2luZ19mb3JtX3N1Ym1pdF9zdWNjZXNzLndwYmNfYWRkX2Jvb2tpbmdfbW9kYWxfcmVsb2FkJywgZnVuY3Rpb24oIGV2ZW50LCBzdWJtaXR0ZWRfcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0XHRcdGlmICggcGFyc2VJbnQoIHN1Ym1pdHRlZF9yZXNvdXJjZV9pZCwgMTAgKSAhPT0gcmVzb3VyY2VfaWQgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRqUXVlcnkoICdib2R5JyApLm9mZiggJ3dwYmNfYm9va2luZ19mb3JtX3N1Ym1pdF9zdWNjZXNzLndwYmNfYWRkX2Jvb2tpbmdfbW9kYWxfcmVsb2FkJyApO1xyXG5cclxuXHRcdFx0aWYgKCAhIGpRdWVyeSggJyN3cGJjX21vZGFsX19hZGRfYm9va2luZ19fc2VjdGlvbicgKS5pcyggJzp2aXNpYmxlJyApICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0d3BiY19ib29fbGlzdGluZ19fcmVsb2FkX2FmdGVyX2FkZF9ib29raW5nX21vZGFsX3N1Ym1pdCgpO1xyXG5cdFx0fSApO1xyXG5cclxuXHRzdWJtaXRfcmVzdWx0ID0gd3BiY19ib29raW5nX2Zvcm1fc3VibWl0KCBzdWJtaXRfZm9ybSwgcmVzb3VyY2VfaWQsIGxvY2FsZSApO1xyXG5cclxuXHRpZiAoIGZhbHNlID09PSBzdWJtaXRfcmVzdWx0ICkge1xyXG5cdFx0alF1ZXJ5KCAnYm9keScgKS5vZmYoICd3cGJjX2Jvb2tpbmdfZm9ybV9zdWJtaXRfc3VjY2Vzcy53cGJjX2FkZF9ib29raW5nX21vZGFsX3JlbG9hZCcgKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiBzdWJtaXRfcmVzdWx0O1xyXG59XHJcblxyXG4vKipcclxuICogQ2hhbmdlIHBheW1lbnQgQ29zdC5cclxuICpcclxuICogQHBhcmFtIGJvb2tpbmdfaWRcdFx0XHQtIElEIG9mIGJvb2tpbmcuXHJcbiAqIEBwYXJhbSBjb3N0XHQgICAgICAgICAgICAgICAgLSBwYXltZW50IGNvc3QuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19jbGlja19fc2V0X2Jvb2tpbmdfY29zdCggYm9va2luZ19pZCwgY29zdCApIHtcclxuXHJcblx0aWYgKCAhIHdwYmNfaXNfbW9kYWxfYWNjZXNzaWJsZSggJyN3cGJjX21vZGFsX19ib29raW5nX2Nvc3RfZWRpdF9fc2VjdGlvbicgKSApIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cdC8vIFNldCBib29raW5nIGNvc3QuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2Jvb2tpbmdfY29zdF9lZGl0X192YWx1ZScgKS52YWwoIGNvc3QgKTtcclxuXHJcblx0Ly8gU2V0IGJvb2tpbmcgSUQuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2Jvb2tpbmdfY29zdF9lZGl0X19ib29raW5nX2lkJyApLnZhbCggYm9va2luZ19pZCApO1xyXG5cclxuXHQvLyBJRCB0aXRsZS5cclxuXHRqUXVlcnkoICcud3BiY19tb2RhbF9fYm9va2luZ19jb3N0X2VkaXRfX2Jvb2tpbmdfaWQnICkuaHRtbCggJ0lEOiAnICsgYm9va2luZ19pZCApO1xyXG5cclxuXHQvLyBTaG93IE1vZGFsLlxyXG5cdGpRdWVyeSggJyN3cGJjX21vZGFsX19ib29raW5nX2Nvc3RfZWRpdF9fc2VjdGlvbicgKS53cGJjX215X21vZGFsKCAnc2hvdycgKTtcclxuXHJcblx0Ly8gU2V0IGZvY3VzIHRvIGlucHV0LlxyXG5cdGpRdWVyeSggJyN3cGJjX21vZGFsX19ib29raW5nX2Nvc3RfZWRpdF9fdmFsdWUnICkudHJpZ2dlciggJ2ZvY3VzJyApO1xyXG59XHJcblxyXG4vKipcclxuICogQ2hhbmdlIHBheW1lbnQgU3RhdHVzLlxyXG4gKlxyXG4gKiBAcGFyYW0gYm9va2luZ19pZFx0XHRcdC0gSUQgb2YgYm9va2luZy5cclxuICogQHBhcmFtIHNlbGVjdGVkX3BheV9zdGF0dXNcdC0gcGF5bWVudCBzdGF0dXMuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19jbGlja19fc2V0X3BheW1lbnRfc3RhdHVzKCBib29raW5nX2lkLCBzZWxlY3RlZF9wYXlfc3RhdHVzICkge1xyXG5cclxuXHRpZiAoICEgd3BiY19pc19tb2RhbF9hY2Nlc3NpYmxlKCAnI3dwYmNfbW9kYWxfX3BheW1lbnRfc3RhdHVzX2VkaXRfX3NlY3Rpb24nICkgKSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHR2YXIgalNlbGVjdCA9IGpRdWVyeSggJyN3cGJjX21vZGFsX19wYXltZW50X3N0YXR1c19lZGl0X192YWx1ZScgKTtcclxuXHJcblx0Ly8gU2VsZWN0IFN0YXR1cy5cclxuXHRpZiAoICggISBpc05hTiggcGFyc2VGbG9hdCggc2VsZWN0ZWRfcGF5X3N0YXR1cyApICkpIHx8ICgnJyA9PT0gc2VsZWN0ZWRfcGF5X3N0YXR1cykgKSB7XHRcdC8vIElzIGl0IGZsb2F0IC0gdGhlbiAgaXQncyB1bmtub3duLlxyXG5cdFx0alNlbGVjdC5maW5kKCAnb3B0aW9uW3ZhbHVlPVwiMVwiXScgKS5wcm9wKCAnc2VsZWN0ZWQnLCB0cnVlICk7XHRcdFx0XHRcdFx0XHRcdC8vIFVua25vd24gIHZhbHVlIGlzICcxJyBpbiBzZWxlY3QgYm94LlxyXG5cdH0gZWxzZSB7XHJcblx0XHRqU2VsZWN0LmZpbmQoICdvcHRpb25bdmFsdWU9XCInICsgc2VsZWN0ZWRfcGF5X3N0YXR1cyArICdcIl0nICkucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApO1x0XHQvLyBPdGhlcndpc2Uga25vd24gcGF5bWVudCBzdGF0dXMuXHJcblx0fVxyXG5cdC8vIFNldCBib29raW5nIElELlxyXG5cdGpRdWVyeSggJyN3cGJjX21vZGFsX19wYXltZW50X3N0YXR1c19lZGl0X19ib29raW5nX2lkJyApLnZhbCggYm9va2luZ19pZCApO1xyXG5cclxuXHQvLyBJRCB0aXRsZS5cclxuXHRqUXVlcnkoICcud3BiY19tb2RhbF9fcGF5bWVudF9zdGF0dXNfZWRpdF9fYm9va2luZ19pZCcgKS5odG1sKCAnSUQ6ICcgKyBib29raW5nX2lkICk7XHJcblxyXG5cdC8vIFNob3cgTW9kYWwuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3BheW1lbnRfc3RhdHVzX2VkaXRfX3NlY3Rpb24nICkud3BiY19teV9tb2RhbCggJ3Nob3cnICk7XHJcblxyXG5cdC8vIFNldCBmb2N1cyB0byBpbnB1dC5cclxuXHRqUXVlcnkoICcjd3BiY19tb2RhbF9fcGF5bWVudF9zdGF0dXNfZWRpdF9fdmFsdWUnICkudHJpZ2dlciggJ2ZvY3VzJyApO1xyXG59XHJcblxyXG4vKipcclxuICogU2VuZCBwYXltZW50IHJlcXVlc3RcclxuICpcclxuICogQHBhcmFtIGJvb2tpbmdfaWRcclxuICogQHBhcmFtIHZpc2l0b3Jib29raW5ncGF5dXJsXHJcbiAqIEBwYXJhbSBjb3N0XHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fY2xpY2tfX3NlbmRfcGF5bWVudF9yZXF1ZXN0KCBib29raW5nX2lkLCB2aXNpdG9yYm9va2luZ3BheXVybCwgY29zdCApe1xyXG5cclxuXHRpZiAoICEgd3BiY19pc19tb2RhbF9hY2Nlc3NpYmxlKCAnI3dwYmNfbW9kYWxfX3NlbmRfcGF5bWVudF9yZXF1ZXN0X19zZWN0aW9uJyApICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0Ly8gU2V0IGJvb2tpbmcgY29zdC5cclxuXHRqUXVlcnkoICcjd3BiY19tb2RhbF9fc2VuZF9wYXltZW50X3JlcXVlc3RfX3VybCcgKS52YWwoIHZpc2l0b3Jib29raW5ncGF5dXJsICk7XHJcblxyXG5cdC8vIFNldCBib29raW5nIElELlxyXG5cdGpRdWVyeSggJyN3cGJjX21vZGFsX19zZW5kX3BheW1lbnRfcmVxdWVzdF9fYm9va2luZ19pZCcgKS52YWwoIGJvb2tpbmdfaWQgKTtcclxuXHJcblx0Ly8gSUQgdGl0bGUuXHJcblx0alF1ZXJ5KCAnLndwYmNfbW9kYWxfX3NlbmRfcGF5bWVudF9yZXF1ZXN0X19ib29raW5nX2lkJyApLmh0bWwoICdJRDogJyArIGJvb2tpbmdfaWQgKTtcclxuXHJcblx0Ly8gQ29zdC5cclxuXHRqUXVlcnkoICcud3BiY19tb2RhbF9fc2VuZF9wYXltZW50X3JlcXVlc3RfX2Nvc3QnICkuaHRtbCggY29zdCApO1xyXG5cclxuXHQvLyBTaG93IE1vZGFsLlxyXG5cdGpRdWVyeSggJyN3cGJjX21vZGFsX19zZW5kX3BheW1lbnRfcmVxdWVzdF9fc2VjdGlvbicgKS53cGJjX215X21vZGFsKCAnc2hvdycgKTtcclxuXHJcblx0Ly8gU2V0IGZvY3VzIHRvIGlucHV0LlxyXG5cdGpRdWVyeSggJyN3cGJjX21vZGFsX19zZW5kX3BheW1lbnRfcmVxdWVzdF9fdmFsdWUnICkudHJpZ2dlciggJ2ZvY3VzJyApO1xyXG5cclxufVxyXG5cclxuLyoqXHJcbiAqIFNhdmUgTm90ZXNcclxuICpcclxuICogQHBhcmFtIGJvb2tpbmdfaWRcclxuICogQHBhcmFtIG5vdGVfdGV4dFxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19zZXRfYm9va2luZ19ub3RlKCBib29raW5nX2lkLCBub3RlX3RleHQgKXtcclxuXHJcblx0aWYgKCAhIHdwYmNfaXNfbW9kYWxfYWNjZXNzaWJsZSggJyN3cGJjX21vZGFsX19zZXRfYm9va2luZ19ub3RlX19zZWN0aW9uJyApICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0Ly8gU2V0IE5vdGUuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3NldF9ib29raW5nX25vdGVfX3ZhbHVlJyApLnZhbCggbm90ZV90ZXh0ICk7XHJcblxyXG5cdC8vIFNldCBib29raW5nIElELlxyXG5cdGpRdWVyeSggJyN3cGJjX21vZGFsX19zZXRfYm9va2luZ19ub3RlX19ib29raW5nX2lkJyApLnZhbCggYm9va2luZ19pZCApO1xyXG5cclxuXHQvLyBJRCB0aXRsZS5cclxuXHRqUXVlcnkoICcud3BiY19tb2RhbF9fc2V0X2Jvb2tpbmdfbm90ZV9fYm9va2luZ19pZCcgKS5odG1sKCAnSUQ6ICcgKyBib29raW5nX2lkICk7XHJcblxyXG5cdC8vIFNob3cgTW9kYWwuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3NldF9ib29raW5nX25vdGVfX3NlY3Rpb24nICkud3BiY19teV9tb2RhbCggJ3Nob3cnICk7XHJcblxyXG5cdC8vIFNldCBmb2N1cyB0byBpbnB1dC4gLy8galF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3NldF9ib29raW5nX25vdGVfX3ZhbHVlJyApLnRyaWdnZXIoICdmb2N1cycgKTsgLlxyXG5cdGpRdWVyeSggJyN3cGJjX21vZGFsX19zZXRfYm9va2luZ19ub3RlX192YWx1ZScgKS5zY3JvbGxUb3AoIDAgKTtcclxuXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDaGFuZ2UgUmVzb3VyY2UgZm9yIEJvb2tpbmdcclxuICpcclxuICogQHBhcmFtIGJvb2tpbmdfaWRcdFx0XHQtIElEIG9mIGJvb2tpbmcuXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZCAgICAgICAgICAgLSBJRCBvZiBib29raW5nIHJlc291cmNlLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fY2xpY2tfX2NoYW5nZV9ib29raW5nX3Jlc291cmNlKCBib29raW5nX2lkLCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRpZiAoICEgd3BiY19pc19tb2RhbF9hY2Nlc3NpYmxlKCAnI3dwYmNfbW9kYWxfX2NoYW5nZV9ib29raW5nX3Jlc291cmNlX19zZWN0aW9uJyApICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0Ly8gU2VsZWN0IGJvb2tpbmcgcmVzb3VyY2UgIHRoYXQgYmVsb25nIHRvICBib29raW5nLlxyXG5cdGpRdWVyeSggJyN3cGJjX21vZGFsX19jaGFuZ2VfYm9va2luZ19yZXNvdXJjZV9fcmVzb3VyY2VfaWQnICkudmFsKCByZXNvdXJjZV9pZCApLnRyaWdnZXIoICdjaGFuZ2UnICk7XHJcblxyXG5cdC8vIFNldCBib29raW5nIElELlxyXG5cdGpRdWVyeSggJyN3cGJjX21vZGFsX19jaGFuZ2VfYm9va2luZ19yZXNvdXJjZV9fYm9va2luZ19pZCcgKS52YWwoIGJvb2tpbmdfaWQgKTtcclxuXHQvLyBJRCB0aXRsZS5cclxuXHRqUXVlcnkoICcud3BiY19tb2RhbF9fY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2VfX2Jvb2tpbmdfaWQnICkuaHRtbCggJ0lEOiAnICsgYm9va2luZ19pZCApO1xyXG5cclxuXHQvLyBTaG93IE1vZGFsLlxyXG5cdGpRdWVyeSggJyN3cGJjX21vZGFsX19jaGFuZ2VfYm9va2luZ19yZXNvdXJjZV9fc2VjdGlvbicgKS53cGJjX215X21vZGFsKCAnc2hvdycgKTtcclxuXHJcblx0Ly8gU2V0IGZvY3VzIHRvIGlucHV0LlxyXG5cdGpRdWVyeSggJyN3cGJjX21vZGFsX19jaGFuZ2VfYm9va2luZ19yZXNvdXJjZV9fcmVzb3VyY2VfaWQnICkuZm9jdXMoKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFNldCB1bmF2YWlsYWJsZSB0aW1lcyBmb3IgYm9va2luZyByZXNvdXJjZSBhbmQgZGF0ZXMuXHJcbiAqXHJcbiAqIEBwYXJhbSBib29raW5nX2lkICAgIElEIG9mIGJvb2tpbmcuXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZCAgIElEIG9mIGJvb2tpbmcgcmVzb3VyY2UuXHJcbiAqIEBwYXJhbSBkYXRlX3N0YXJ0ICAgIEJvb2tpbmcgc3RhcnQgZGF0ZS5cclxuICogQHBhcmFtIGRhdGVfZW5kICAgICAgQm9va2luZyBlbmQgZGF0ZS5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19zZXRfdW5hdmFpbGFibGVfdGltZXMoIGJvb2tpbmdfaWQsIHJlc291cmNlX2lkLCBkYXRlX3N0YXJ0LCBkYXRlX2VuZCApe1xyXG5cclxuXHRpZiAoICEgd3BiY19pc19tb2RhbF9hY2Nlc3NpYmxlKCAnI3dwYmNfbW9kYWxfX3NldF91bmF2YWlsYWJsZV90aW1lc19fc2VjdGlvbicgKSApIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cdHZhciAkbW9kYWwgPSBqUXVlcnkoICcjd3BiY19tb2RhbF9fc2V0X3VuYXZhaWxhYmxlX3RpbWVzX19zZWN0aW9uJyApO1xyXG5cdHZhciAkcGFnZSA9ICRtb2RhbC5maW5kKCAnLndwYmNfdHNfcGFnZScgKS5maXJzdCgpO1xyXG5cclxuXHRpZiAoIGJvb2tpbmdfaWQgKSB7XHJcblx0XHRqUXVlcnkoICcud3BiY19tb2RhbF9fc2V0X3VuYXZhaWxhYmxlX3RpbWVzX19ib29raW5nX2lkJyApLmh0bWwoICdJRDogJyArIGJvb2tpbmdfaWQgKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0alF1ZXJ5KCAnLndwYmNfbW9kYWxfX3NldF91bmF2YWlsYWJsZV90aW1lc19fYm9va2luZ19pZCcgKS5odG1sKCAnJyApO1xyXG5cdH1cclxuXHJcblx0JG1vZGFsLndwYmNfbXlfbW9kYWwoICdzaG93JyApO1xyXG5cclxuXHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19hdmFpbGFiaWxpdHlfdGltZXNsb3RzX2luaXQgKSB7XHJcblx0XHR3aW5kb3cud3BiY19hdmFpbGFiaWxpdHlfdGltZXNsb3RzX2luaXQoICRwYWdlICk7XHJcblx0fVxyXG5cclxuXHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19hdmFpbGFiaWxpdHlfdGltZXNsb3RzX3NldF9jb250ZXh0ICkge1xyXG5cdFx0d2luZG93LndwYmNfYXZhaWxhYmlsaXR5X3RpbWVzbG90c19zZXRfY29udGV4dChcclxuXHRcdFx0JHBhZ2UsXHJcblx0XHRcdHtcclxuXHRcdFx0XHRyZXNvdXJjZV9pZDogcmVzb3VyY2VfaWQsXHJcblx0XHRcdFx0ZGF0ZV9zdGFydDogZGF0ZV9zdGFydCxcclxuXHRcdFx0XHRkYXRlX2VuZDogZGF0ZV9lbmRcclxuXHRcdFx0fVxyXG5cdFx0KTtcclxuXHR9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBEdXBsaWNhdGUgQm9va2luZyBpbnRvIGFub3RoZXIgcmVzb3VyY2UuXHJcbiAqXHJcbiAqIEBwYXJhbSBib29raW5nX2lkXHRcdFx0LSBJRCBvZiBib29raW5nLlxyXG4gKiBAcGFyYW0gcmVzb3VyY2VfaWQgICAgICAgICAgIC0gSUQgb2YgYm9va2luZyByZXNvdXJjZS5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19kdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZSggYm9va2luZ19pZCwgcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0aWYgKCAhIHdwYmNfaXNfbW9kYWxfYWNjZXNzaWJsZSggJyN3cGJjX21vZGFsX19kdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZV9fc2VjdGlvbicgKSApIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cdC8vIFNlbGVjdCBib29raW5nIHJlc291cmNlICB0aGF0IGJlbG9uZyB0byAgYm9va2luZy5cclxuXHRqUXVlcnkoICcjd3BiY19tb2RhbF9fZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2VfX3Jlc291cmNlX2lkJyApLnZhbCggcmVzb3VyY2VfaWQgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xyXG5cclxuXHQvLyBTZXQgYm9va2luZyBJRC5cclxuXHRqUXVlcnkoICcjd3BiY19tb2RhbF9fZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2VfX2Jvb2tpbmdfaWQnICkudmFsKCBib29raW5nX2lkICk7XHJcblx0Ly8gSUQgdGl0bGUuXHJcblx0alF1ZXJ5KCAnLndwYmNfbW9kYWxfX2R1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlX19ib29raW5nX2lkJyApLmh0bWwoICdJRDogJyArIGJvb2tpbmdfaWQgKTtcclxuXHJcblx0Ly8gU2hvdyBNb2RhbC5cclxuXHRqUXVlcnkoICcjd3BiY19tb2RhbF9fZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2VfX3NlY3Rpb24nICkud3BiY19teV9tb2RhbCggJ3Nob3cnICk7XHJcblxyXG5cdC8vIFNldCBmb2N1cyB0byBpbnB1dC5cclxuXHRqUXVlcnkoICcjd3BiY19tb2RhbF9fZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2VfX3Jlc291cmNlX2lkJyApLmZvY3VzKCk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDaGFuZ2UgTG9jYWxlIG9mIEJvb2tpbmcuXHJcbiAqXHJcbiAqIEBwYXJhbSBib29raW5nX2lkXHRcdFx0LSBJRCBvZiBib29raW5nLlxyXG4gKiBAcGFyYW0gcmVzb3VyY2VfaWQgICAgICAgICAgIC0gSUQgb2YgYm9va2luZyByZXNvdXJjZS5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19zZXRfYm9va2luZ19sb2NhbGUoIGJvb2tpbmdfaWQsIHNlbGVjdGVkX2xvY2FsZV92YWx1ZSApe1xyXG5cclxuXHRpZiAoICEgd3BiY19pc19tb2RhbF9hY2Nlc3NpYmxlKCAnI3dwYmNfbW9kYWxfX3NldF9ib29raW5nX2xvY2FsZV9fc2VjdGlvbicgKSApIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cdC8vIFNlbGVjdCBib29raW5nIExvY2FsZSAgdGhhdCBiZWxvbmcgdG8gIGJvb2tpbmcuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3NldF9ib29raW5nX2xvY2FsZScgKS52YWwoIHNlbGVjdGVkX2xvY2FsZV92YWx1ZSApLnRyaWdnZXIoICdjaGFuZ2UnICk7XHJcblxyXG5cdC8vIHZhciBqU2VsZWN0ID0galF1ZXJ5KCAnI3NldF9ib29raW5nX2xvY2FsZV9fcmVzb3VyY2Vfc2VsZWN0JyApO1xyXG5cdC8vIGpTZWxlY3QuZmluZCggJ29wdGlvblt2YWx1ZT1cIicgKyByZXNvdXJjZV9pZCArICdcIl0nICkucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApO1x0XHQvLyBPdGhlcndpc2Uga25vd24gcGF5bWVudCBzdGF0dXMuXHJcblxyXG5cdC8vIFNldCBib29raW5nIElELlxyXG5cdGpRdWVyeSggJyN3cGJjX21vZGFsX19zZXRfYm9va2luZ19sb2NhbGVfX2Jvb2tpbmdfaWQnICkudmFsKCBib29raW5nX2lkICk7XHJcblx0Ly8gSUQgdGl0bGUuXHJcblx0alF1ZXJ5KCAnLndwYmNfbW9kYWxfX3NldF9ib29raW5nX2xvY2FsZV9fYm9va2luZ19pZCcgKS5odG1sKCAnSUQ6ICcgKyBib29raW5nX2lkICk7XHJcblxyXG5cdC8vIFNob3cgTW9kYWwuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3NldF9ib29raW5nX2xvY2FsZV9fc2VjdGlvbicgKS53cGJjX215X21vZGFsKCAnc2hvdycgKTtcclxuXHJcblx0Ly8gU2V0IGZvY3VzIHRvIGlucHV0LlxyXG5cdGpRdWVyeSggJyN3cGJjX21vZGFsX19zZXRfYm9va2luZ19sb2NhbGUnICkuZm9jdXMoKTtcclxufVxyXG5cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyA9PSBGaWx0ZXIgVG9vbGJhciA9PVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLyoqXHJcbiAqID09IFwiU29ydCBCeVwiIEJ1dHRvbiA9PVxyXG4gKiBUaGlzIGZ1bmN0aW9uIHVwZGF0ZSBUaXRsZSBpbiBEcm9wZG93biBtZW51LlxyXG4gKiBJdCBleGVjdXRlZCwgYWZ0ZXIgcmVjZXZpbmcgQWpheCByZXNwb25zZS5cclxuICogQW5kIGJhc2VkIG9uIHBhcmFtZXRlcnMgb2YgdGhpcyByZXNwb25zZSwgd2UgZ2V0IG9wdGlvbiB0aXRsZSBmcm9tIGRyb3Bkb3duIGxpc3Qgb3B0aW9ucyBhbmQgc2hvdyBpdCBpbiB0b2dnbGUgdGl0bGUuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19pbml0X2hvb2tfX3NvcnRfYnkoKSB7XHJcblxyXG5cdHZhciBlbF9pZCA9ICd3aF9zb3J0JztcclxuXHJcblx0dmFyIHBhcmFtZXRlcl92YWx1ZSA9IHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5zZWFyY2hfZ2V0X3BhcmFtKCBlbF9pZCApO1xyXG5cclxuXHR2YXIgal9vcHRpb25fbGluayA9IGpRdWVyeSggJy51bF9kcm9wZG93bl9tZW51X2xpX18nICsgZWxfaWQgKyAnX18nICsgcGFyYW1ldGVyX3ZhbHVlICk7XHJcblx0aWYgKCBqX29wdGlvbl9saW5rLmxlbmd0aCApIHtcclxuXHRcdGpRdWVyeSggJy51bF9kcm9wZG93bl9tZW51X18nICsgZWxfaWQgKyAnIC51bF9kcm9wZG93bl9tZW51X3RvZ2dsZSAuc2VsZWN0ZWRfdmFsdWUnICkuaHRtbCggal9vcHRpb25fbGluay5odG1sKCkgKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0alF1ZXJ5KCAnLnVsX2Ryb3Bkb3duX21lbnVfXycgKyBlbF9pZCArICcgLnVsX2Ryb3Bkb3duX21lbnVfdG9nZ2xlIC5zZWxlY3RlZF92YWx1ZScgKS5odG1sKCAnLS0tJyApO1xyXG5cdH1cclxufVxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vID09IExpc3RpbmcgSGVhZGVyIFRhYmxlID09XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vKipcclxuICogPT0gXCJFeHBhbmQgQWxsIFJvd3NcIiBCdXR0b24gPT1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19leHBhbmRfYWxsX3Jvd3MoKSB7XHJcblx0alF1ZXJ5KCAnLndwYmNfcm93X3dyYXAnICkucmVtb3ZlQ2xhc3MoICdtYXhfaGVpZ2h0X2EnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfcm93X3dyYXAgLndwYmNfaWNuX2V4cGFuZF9sZXNzJyApLnNob3coKTtcclxuXHRqUXVlcnkoICcud3BiY19yb3dfd3JhcCAud3BiY19pY25fZXhwYW5kX21vcmUnICkuaGlkZSgpO1xyXG5cdGpRdWVyeSggJy53cGJjX2J0bl9leHBhbmRfY29sYXBzZV9hbGwnICkudG9nZ2xlKCk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogPT0gXCJDb2xwYXNlIEFsbCBSb3dzXCIgQnV0dG9uID09XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19jbGlja19fY29sYXBzZV9hbGxfcm93cygpIHtcclxuXHRqUXVlcnkoICcud3BiY19yb3dfd3JhcCcgKS5hZGRDbGFzcyggJ21heF9oZWlnaHRfYScgKTtcclxuXHRqUXVlcnkoICcud3BiY19yb3dfd3JhcCAud3BiY19pY25fZXhwYW5kX2xlc3MnICkuaGlkZSgpO1xyXG5cdGpRdWVyeSggJy53cGJjX3Jvd193cmFwIC53cGJjX2ljbl9leHBhbmRfbW9yZScgKS5zaG93KCk7XHJcblx0alF1ZXJ5KCAnLndwYmNfYnRuX2V4cGFuZF9jb2xhcHNlX2FsbCcgKS50b2dnbGUoKTtcclxufVxyXG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNBLHdCQUF3QkEsQ0FBRUMsT0FBTyxFQUFHO0VBQzVDLElBQUssVUFBVSxLQUFLLE9BQVFDLE1BQU0sQ0FBRUQsT0FBUSxDQUFDLENBQUNFLGFBQWMsRUFBRztJQUM5REMsS0FBSyxDQUFFLGlIQUFrSCxDQUFDO0lBQzFILE9BQU8sS0FBSztFQUNiO0VBQ0EsT0FBTyxJQUFJO0FBQ1o7O0FBR0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNDLG1EQUFtREEsQ0FBRUMsVUFBVSxFQUFFQyxX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QTJDLENBQUMsQ0FBQ0MsYUFBYSxDQUFFLE1BQU8sQ0FBQzs7RUFFNUU7RUFDQUQsTUFBTSxDQUFFLGlDQUFrQyxDQUFDLENBQUN1TCxLQUFLLENBQUMsQ0FBQztBQUNwRDs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTVSxvQ0FBb0NBLENBQUEsRUFBRztFQUUvQyxJQUFJQyxLQUFLLEdBQUcsU0FBUztFQUVyQixJQUFJQyxlQUFlLEdBQUduQyx3QkFBd0IsQ0FBQ29DLGdCQUFnQixDQUFFRixLQUFNLENBQUM7RUFFeEUsSUFBSUcsYUFBYSxHQUFHck0sTUFBTSxDQUFFLHdCQUF3QixHQUFHa00sS0FBSyxHQUFHLElBQUksR0FBR0MsZUFBZ0IsQ0FBQztFQUN2RixJQUFLRSxhQUFhLENBQUM3SSxNQUFNLEVBQUc7SUFDM0J4RCxNQUFNLENBQUUscUJBQXFCLEdBQUdrTSxLQUFLLEdBQUcsMkNBQTRDLENBQUMsQ0FBQ3RMLElBQUksQ0FBRXlMLGFBQWEsQ0FBQ3pMLElBQUksQ0FBQyxDQUFFLENBQUM7RUFDbkgsQ0FBQyxNQUFNO0lBQ05aLE1BQU0sQ0FBRSxxQkFBcUIsR0FBR2tNLEtBQUssR0FBRywyQ0FBNEMsQ0FBQyxDQUFDdEwsSUFBSSxDQUFFLEtBQU0sQ0FBQztFQUNwRztBQUNEOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVMwTCx3Q0FBd0NBLENBQUEsRUFBRztFQUNuRHRNLE1BQU0sQ0FBRSxnQkFBaUIsQ0FBQyxDQUFDaUcsV0FBVyxDQUFFLGNBQWUsQ0FBQztFQUN4RGpHLE1BQU0sQ0FBRSxzQ0FBdUMsQ0FBQyxDQUFDK0gsSUFBSSxDQUFDLENBQUM7RUFDdkQvSCxNQUFNLENBQUUsc0NBQXVDLENBQUMsQ0FBQzhILElBQUksQ0FBQyxDQUFDO0VBQ3ZEOUgsTUFBTSxDQUFFLDhCQUErQixDQUFDLENBQUN1TSxNQUFNLENBQUMsQ0FBQztBQUNsRDs7QUFHQTtBQUNBO0FBQ0E7QUFDQSxTQUFTQyx5Q0FBeUNBLENBQUEsRUFBRztFQUNwRHhNLE1BQU0sQ0FBRSxnQkFBaUIsQ0FBQyxDQUFDK0YsUUFBUSxDQUFFLGNBQWUsQ0FBQztFQUNyRC9GLE1BQU0sQ0FBRSxzQ0FBdUMsQ0FBQyxDQUFDOEgsSUFBSSxDQUFDLENBQUM7RUFDdkQ5SCxNQUFNLENBQUUsc0NBQXVDLENBQUMsQ0FBQytILElBQUksQ0FBQyxDQUFDO0VBQ3ZEL0gsTUFBTSxDQUFFLDhCQUErQixDQUFDLENBQUN1TSxNQUFNLENBQUMsQ0FBQztBQUNsRCIsImlnbm9yZUxpc3QiOltdfQ==
