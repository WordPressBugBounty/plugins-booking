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
  var selector = ['select[name="rangetime' + resource_id + '"]', 'select[name="rangetime' + resource_id + '[]"]', 'select[name="starttime' + resource_id + '"]', 'select[name="starttime' + resource_id + '[]"]', 'select[name="endtime' + resource_id + '"]', 'select[name="endtime' + resource_id + '[]"]', 'input[name="starttime' + resource_id + '"]', 'input[name="endtime' + resource_id + '"]'].join(', ');
  return $form.find(selector).filter(function () {
    var $field = jQuery(this);
    if ($field.closest('.wpbc_add_booking_modal__selected_time_fields').length) {
      return false;
    }
    if ('input' === this.tagName.toLowerCase() && 'hidden' === String($field.attr('type') || '').toLowerCase()) {
      return false;
    }
    return true;
  }).length > 0;
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
    html = '<div class="wpbc_add_booking_modal__selected_time_fields" style="margin:12px 0;padding:12px;border:1px solid #dcdcde;background:#f6f7f7;border-radius:4px;">' + '<div style="font-weight:600;margin-bottom:8px;">Time selected from availability timeline</div>' + '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">' + '<label style="display:flex;flex-direction:column;gap:4px;min-width:120px;">' + '<span>Start time</span>' + '<input type="text" class="wpbc_ui_control wpbc_ui_text" name="starttime' + resource_id + '" value="" readonly="readonly" />' + '</label>' + '<label style="display:flex;flex-direction:column;gap:4px;min-width:120px;">' + '<span>End time</span>' + '<input type="text" class="wpbc_ui_control wpbc_ui_text" name="endtime' + resource_id + '" value="" readonly="readonly" />' + '</label>' + '</div>' + '</div>';
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
  time_parts = String(selected_time).split(' - ');
  start_time = jQuery.trim(time_parts[0] || '');
  end_time = jQuery.trim(time_parts[1] || '');
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
  var apply_time;
  if (!resource_id) {
    return;
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
  if ('edit' === (mode || data.mode)) {
    $resource_control.hide();
  } else {
    $resource_control.show();
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
  jQuery(document).off('change.wpbc_add_booking_modal', '#wpbc_modal__add_booking__resource_id, #wpbc_modal__add_booking__booking_form').on('change.wpbc_add_booking_modal', '#wpbc_modal__add_booking__resource_id, #wpbc_modal__add_booking__booking_form', function () {
    var $modal = jQuery('#wpbc_modal__add_booking__section');
    var mode = $modal.attr('data-wpbc-add-booking-mode') || 'add';
    wpbc_boo_listing__click__add_booking_modal({
      mode: mode,
      booking_id: $modal.attr('data-wpbc-add-booking-id') || '',
      resource_id: $modal.find('#wpbc_modal__add_booking__resource_id').val() || '',
      booking_hash: $modal.attr('data-wpbc-add-booking-hash') || '',
      booking_form: $modal.find('#wpbc_modal__add_booking__booking_form').val() || ''
    });
  });
}
jQuery(document).ready(function () {
  wpbc_boo_listing__init_add_booking_modal_controls();
});

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
  $modal.attr('data-wpbc-add-booking-resource-id', '');
  $modal.attr('data-wpbc-add-booking-hash', args.booking_hash || '');
  $modal.attr('data-wpbc-add-booking-id', args.booking_id || '');
  $modal.attr('data-wpbc-add-booking-mode', mode);
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
    selected_dates_without_calendar: args.selected_dates_without_calendar || '',
    selected_date: args.selected_date || '',
    selected_time: args.selected_time || ''
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1ib29raW5ncy9fb3V0L2Jvb19saXN0aW5nX19hY3Rpb25zLmpzIiwibmFtZXMiOlsid3BiY19pc19tb2RhbF9hY2Nlc3NpYmxlIiwiaHRtbF9pZCIsImpRdWVyeSIsIndwYmNfbXlfbW9kYWwiLCJhbGVydCIsIndwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19hZGRfYm9va2luZ19tb2RhbF9mcm9tX3JvdyIsImJvb2tpbmdfaWQiLCJyZXNvdXJjZV9pZCIsImJvb2tpbmdfaGFzaCIsImJvb2tpbmdfZm9ybSIsIndwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19hZGRfYm9va2luZ19tb2RhbCIsIm1vZGUiLCJ3cGJjX2Jvb19saXN0aW5nX19zZXRfYWRkX2Jvb2tpbmdfbW9kYWxfYm9keV9odG1sIiwiJGJvZHkiLCJodG1sIiwiJGh0bWwiLCJhcHBlbmQiLCJwYXJzZUhUTUwiLCJkb2N1bWVudCIsIiRzY3JpcHRzIiwiZmluZCIsInJlbW92ZSIsImNvbnRlbnRzIiwiZWFjaCIsInR5cGUiLCJhdHRyIiwidG9Mb3dlckNhc2UiLCJzcmMiLCJjb2RlIiwidGV4dCIsInRleHRDb250ZW50IiwiaW5uZXJIVE1MIiwidGVzdCIsImFqYXgiLCJ1cmwiLCJkYXRhVHlwZSIsImNhY2hlIiwiYXN5bmMiLCJnbG9iYWxFdmFsIiwid3BiY19ib29fbGlzdGluZ19fZ2V0X2FkZF9ib29raW5nX21vZGFsX2xvYWRpbmdfaHRtbCIsIndwYmNfYm9vX2xpc3RpbmdfX25vcm1hbGl6ZV90aW1lX3ZhbHVlIiwidmFsdWUiLCJTdHJpbmciLCJyZXBsYWNlIiwid3BiY19ib29fbGlzdGluZ19fc2VsZWN0X3RpbWVfb3B0aW9uIiwiJHNlbGVjdCIsImV4cGVjdGVkX3ZhbHVlcyIsImRpZF9zZWxlY3QiLCJub3JtYWxpemVkX2V4cGVjdGVkIiwiaW5kZXgiLCJwdXNoIiwiJG9wdGlvbiIsIm9wdGlvbl92YWx1ZSIsInZhbCIsImluQXJyYXkiLCJwcm9wIiwidHJpZ2dlciIsIndwYmNfYm9vX2xpc3RpbmdfX2hhc19hZGRfYm9va2luZ19tb2RhbF90aW1lX2ZpZWxkcyIsIiRmb3JtIiwic2VsZWN0b3IiLCJqb2luIiwiZmlsdGVyIiwiJGZpZWxkIiwiY2xvc2VzdCIsImxlbmd0aCIsInRhZ05hbWUiLCJ3cGJjX2Jvb19saXN0aW5nX19lbnN1cmVfYWRkX2Jvb2tpbmdfbW9kYWxfc2VsZWN0ZWRfdGltZV9maWVsZHMiLCJzdGFydF90aW1lIiwiZW5kX3RpbWUiLCIkd3JhcCIsIiRpbnNlcnRfYmVmb3JlIiwiZmlyc3QiLCJiZWZvcmUiLCJ3cGJjX2Jvb19saXN0aW5nX19hcHBseV9hZGRfYm9va2luZ19tb2RhbF9zZWxlY3RlZF90aW1lIiwic2VsZWN0ZWRfdGltZSIsInRpbWVfcGFydHMiLCJoYXNfdGltZV9maWVsZHMiLCJzcGxpdCIsInRyaW0iLCJub3QiLCJ3cGJjX2Jvb19saXN0aW5nX19wcmVsb2FkX2FkZF9ib29raW5nX21vZGFsX3NlbGVjdGlvbiIsImRhdGEiLCJwYXJzZUludCIsInNlbGVjdGVkX2RhdGUiLCJzZWxlY3RlZF9kYXRlc193aXRob3V0X2NhbGVuZGFyIiwiYXBwbHlfdGltZSIsIndwYmNfYXV0b19zZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXIiLCJvZmYiLCJvbmUiLCJldmVudCIsImxvYWRlZF9yZXNvdXJjZV9pZCIsIndpbmRvdyIsInNldFRpbWVvdXQiLCJpc19jYWxlbmRhcl9kYXRhX2xvYWRlZCIsIl93cGJjIiwiYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSIsIndwYmNfZGlzYWJsZV90aW1lX2ZpZWxkc19pbl9ib29raW5nX2Zvcm0iLCJ3cGJjX2Jvb19saXN0aW5nX19zeW5jX2FkZF9ib29raW5nX21vZGFsX2NvbnRyb2xzIiwiJG1vZGFsIiwiJHJlc291cmNlX2NvbnRyb2wiLCIkcmVzb3VyY2Vfc2VsZWN0IiwiJGZvcm1fc2VsZWN0IiwiJGZvcm1fZWRpdF9saW5rIiwiaGlkZSIsInNob3ciLCJ3cGJjX2Jvb19saXN0aW5nX19zeW5jX2FkZF9ib29raW5nX21vZGFsX2Zvcm1fZWRpdF9saW5rIiwiZm9ybV9uYW1lIiwiYmFzZV91cmwiLCJzZXBhcmF0b3IiLCJpbmRleE9mIiwiZW5jb2RlVVJJQ29tcG9uZW50Iiwid3BiY19ib29fbGlzdGluZ19faW5pdF9hZGRfYm9va2luZ19tb2RhbF9jb250cm9scyIsIm9uIiwicmVhZHkiLCJhcmdzIiwibm9uY2UiLCJ0aXRsZSIsInBvc3QiLCJ3cGJjX3VybF9hamF4IiwiYWN0aW9uIiwicmVzcG9uc2UiLCJzdWNjZXNzIiwibWVzc2FnZSIsImJ1dHRvbl90aXRsZSIsIndwYmNfaG9va19faW5pdF9ib29raW5nX2Zvcm1fd2l6YXJkX2J1dHRvbnMiLCJzZXRfb3RoZXJfcGFyYW0iLCJ3cGJjX2JzX2phdmFzY3JpcHRfdG9vbHRpcHMiLCJ3cGJjX2JzX2phdmFzY3JpcHRfcG9wb3ZlciIsImZhaWwiLCJ3cGJjX2Jvb19saXN0aW5nX19yZWxvYWRfYWZ0ZXJfYWRkX2Jvb2tpbmdfbW9kYWxfc3VibWl0Iiwid3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zIiwid3BiY19hanhfYm9va2luZ19saXN0aW5nIiwid3BiY19hanhfYm9va2luZ19fYWN0dWFsX2xpc3RpbmdfX3Nob3ciLCJ3cGJjX2Jvb19saXN0aW5nX19zdWJtaXRfX2FkZF9ib29raW5nX21vZGFsIiwic3VibWl0X2Zvcm0iLCJnZXQiLCJnZXRFbGVtZW50QnlJZCIsImxvY2FsZSIsImdldF9vdGhlcl9wYXJhbSIsInN1Ym1pdF9yZXN1bHQiLCJzdWJtaXR0ZWRfcmVzb3VyY2VfaWQiLCJpcyIsIndwYmNfYm9va2luZ19mb3JtX3N1Ym1pdCIsIndwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19zZXRfYm9va2luZ19jb3N0IiwiY29zdCIsIndwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19zZXRfcGF5bWVudF9zdGF0dXMiLCJzZWxlY3RlZF9wYXlfc3RhdHVzIiwialNlbGVjdCIsImlzTmFOIiwicGFyc2VGbG9hdCIsIndwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19zZW5kX3BheW1lbnRfcmVxdWVzdCIsInZpc2l0b3Jib29raW5ncGF5dXJsIiwid3BiY19ib29fbGlzdGluZ19fY2xpY2tfX3NldF9ib29raW5nX25vdGUiLCJub3RlX3RleHQiLCJzY3JvbGxUb3AiLCJ3cGJjX2Jvb19saXN0aW5nX19jbGlja19fY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2UiLCJmb2N1cyIsIndwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19zZXRfdW5hdmFpbGFibGVfdGltZXMiLCJkYXRlX3N0YXJ0IiwiZGF0ZV9lbmQiLCIkcGFnZSIsIndwYmNfYXZhaWxhYmlsaXR5X3RpbWVzbG90c19pbml0Iiwid3BiY19hdmFpbGFiaWxpdHlfdGltZXNsb3RzX3NldF9jb250ZXh0Iiwid3BiY19ib29fbGlzdGluZ19fY2xpY2tfX2R1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlIiwid3BiY19ib29fbGlzdGluZ19fY2xpY2tfX3NldF9ib29raW5nX2xvY2FsZSIsInNlbGVjdGVkX2xvY2FsZV92YWx1ZSIsIndwYmNfYm9vX2xpc3RpbmdfX2luaXRfaG9va19fc29ydF9ieSIsImVsX2lkIiwicGFyYW1ldGVyX3ZhbHVlIiwic2VhcmNoX2dldF9wYXJhbSIsImpfb3B0aW9uX2xpbmsiLCJ3cGJjX2Jvb19saXN0aW5nX19jbGlja19fZXhwYW5kX2FsbF9yb3dzIiwicmVtb3ZlQ2xhc3MiLCJ0b2dnbGUiLCJ3cGJjX2Jvb19saXN0aW5nX19jbGlja19fY29sYXBzZV9hbGxfcm93cyIsImFkZENsYXNzIl0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1ib29raW5ncy9fc3JjL2Jvb19saXN0aW5nX19hY3Rpb25zLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBCb29raW5nIEFjdGlvbnMgaW4gQm9va2luZyBMaXN0aW5nLlxyXG4gKlxyXG4gKiBAdmVyc2lvbiAgICAgMS4wXHJcbiAqIEBwYWNrYWdlICAgICBCb29raW5nIENhbGVuZGFyXHJcbiAqIEBhdXRob3IgICAgICB3cGRldmVsb3BcclxuICpcclxuICogQHdlYi1zaXRlICAgIGh0dHBzOi8vd3Bib29raW5nY2FsZW5kYXIuY29tL1xyXG4gKiBAZW1haWwgICAgICAgaW5mb0B3cGJvb2tpbmdjYWxlbmRhci5jb21cclxuICogQG1vZGlmaWVkICAgIDIwMjUtMDQtMDhcclxuICovXHJcblxyXG4vKipcclxuICogQ2hlY2sgaWYgd2UgY2FuIG9wZW4gbW9kYWwuXHJcbiAqXHJcbiAqIEBwYXJhbSBodG1sX2lkICAgICAgSUQgb2YgbW9kYWwgd2luZG93LCBlLmcuOiAnI3dwYmNfbW9kYWxfX3BheW1lbnRfc3RhdHVzX2VkaXRfX3NlY3Rpb24nXHJcbiAqXHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19pc19tb2RhbF9hY2Nlc3NpYmxlKCBodG1sX2lkICkge1xyXG5cdGlmICggJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIChqUXVlcnkoIGh0bWxfaWQgKS53cGJjX215X21vZGFsKSApIHtcclxuXHRcdGFsZXJ0KCAnV2FybmluZyEgd3BiY19teV9tb2RhbCBtb2R1bGUgaGFzIG5vdCBmb3VuZC4gUGxlYXNlLCByZWNoZWNrIGFib3V0IGFueSBjb25mbGljdHMgYnkgZGVhY3RpdmF0aW5nIG90aGVyIHBsdWdpbnMuJyApO1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHRyZXR1cm4gdHJ1ZTtcclxufVxyXG5cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyA9PSBBY3Rpb25zLCB3aGlsZSBjbGlraW5nIG9uIG9wdGlvbiBkcm9wZG93biA9PVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBPcGVuIEFkZC9FZGl0IEJvb2tpbmcgbW9kYWwgZnJvbSBCb29raW5nIExpc3Rpbmcgcm93IHZhbHVlcy5cclxuICpcclxuICogQHBhcmFtIHtzdHJpbmd8bnVtYmVyfSBib29raW5nX2lkIEJvb2tpbmcgSUQuXHJcbiAqIEBwYXJhbSB7c3RyaW5nfG51bWJlcn0gcmVzb3VyY2VfaWQgUmVzb3VyY2UgSUQuXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBib29raW5nX2hhc2ggQm9va2luZyBoYXNoLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gYm9va2luZ19mb3JtIEN1c3RvbSBib29raW5nIGZvcm0gbmFtZS5cclxuICogQHJldHVybnMge2Jvb2xlYW58dW5kZWZpbmVkfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fY2xpY2tfX2FkZF9ib29raW5nX21vZGFsX2Zyb21fcm93KCBib29raW5nX2lkLCByZXNvdXJjZV9pZCwgYm9va2luZ19oYXNoLCBib29raW5nX2Zvcm0gKXtcclxuXHJcblx0aWYgKCAhIGJvb2tpbmdfaGFzaCApIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cdHJldHVybiB3cGJjX2Jvb19saXN0aW5nX19jbGlja19fYWRkX2Jvb2tpbmdfbW9kYWwoIHtcclxuXHRcdG1vZGUgICAgICAgICA6ICdlZGl0JyxcclxuXHRcdGJvb2tpbmdfaWQgICA6IGJvb2tpbmdfaWQgfHwgJycsXHJcblx0XHRyZXNvdXJjZV9pZCAgOiByZXNvdXJjZV9pZCB8fCAnJyxcclxuXHRcdGJvb2tpbmdfaGFzaCA6IGJvb2tpbmdfaGFzaCB8fCAnJyxcclxuXHRcdGJvb2tpbmdfZm9ybSA6IGJvb2tpbmdfZm9ybSB8fCAnJ1xyXG5cdH0gKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEluc2VydCBBSkFYLXJlbmRlcmVkIEFkZC9FZGl0IEJvb2tpbmcgSFRNTCBhbmQgcnVuIGl0cyBpbmxpbmUgbGlmZWN5Y2xlIHNjcmlwdHMgb25jZS5cclxuICpcclxuICogQHBhcmFtIHtPYmplY3R9ICRib2R5IE1vZGFsIGJvZHkgalF1ZXJ5IG9iamVjdC5cclxuICogQHBhcmFtIHtzdHJpbmd9IGh0bWwgUmVuZGVyZWQgY29tcG9uZW50IEhUTUwuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19zZXRfYWRkX2Jvb2tpbmdfbW9kYWxfYm9keV9odG1sKCAkYm9keSwgaHRtbCApe1xyXG5cclxuXHR2YXIgJGh0bWwgICAgPSBqUXVlcnkoICc8ZGl2IC8+JyApLmFwcGVuZCggalF1ZXJ5LnBhcnNlSFRNTCggaHRtbCB8fCAnJywgZG9jdW1lbnQsIHRydWUgKSApO1xyXG5cdHZhciAkc2NyaXB0cyA9ICRodG1sLmZpbmQoICdzY3JpcHQnICkucmVtb3ZlKCk7XHJcblxyXG5cdCRib2R5Lmh0bWwoICRodG1sLmNvbnRlbnRzKCkgKTtcclxuXHJcblx0JHNjcmlwdHMuZWFjaCggZnVuY3Rpb24oKXtcclxuXHRcdHZhciB0eXBlID0gKCBqUXVlcnkoIHRoaXMgKS5hdHRyKCAndHlwZScgKSB8fCAnJyApLnRvTG93ZXJDYXNlKCk7XHJcblx0XHR2YXIgc3JjICA9IGpRdWVyeSggdGhpcyApLmF0dHIoICdzcmMnICk7XHJcblx0XHR2YXIgY29kZSA9IHRoaXMudGV4dCB8fCB0aGlzLnRleHRDb250ZW50IHx8IHRoaXMuaW5uZXJIVE1MIHx8ICcnO1xyXG5cclxuXHRcdGlmICggdHlwZSAmJiAhIC9eKHRleHR8YXBwbGljYXRpb24pXFwvKHgtKT9qYXZhc2NyaXB0JC8udGVzdCggdHlwZSApICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBzcmMgKSB7XHJcblx0XHRcdGpRdWVyeS5hamF4KCB7XHJcblx0XHRcdFx0dXJsICAgICAgOiBzcmMsXHJcblx0XHRcdFx0ZGF0YVR5cGUgOiAnc2NyaXB0JyxcclxuXHRcdFx0XHRjYWNoZSAgICA6IHRydWUsXHJcblx0XHRcdFx0YXN5bmMgICAgOiBmYWxzZVxyXG5cdFx0XHR9ICk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIGNvZGUgKSB7XHJcblx0XHRcdGpRdWVyeS5nbG9iYWxFdmFsKCBjb2RlICk7XHJcblx0XHR9XHJcblx0fSApO1xyXG59XHJcblxyXG4vKipcclxuICogR2V0IG1vZGFsIGxvYWRpbmcgc3Bpbm5lciBIVE1MLlxyXG4gKlxyXG4gKiBAcmV0dXJucyB7c3RyaW5nfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fZ2V0X2FkZF9ib29raW5nX21vZGFsX2xvYWRpbmdfaHRtbCgpe1xyXG5cdHJldHVybiAnPGRpdiBjbGFzcz1cIndwYmNfc3BpbnNfbG9hZGluZ19jb250YWluZXJcIj4nXHJcblx0XHQrICc8ZGl2IGNsYXNzPVwid3BiY19ib29raW5nX2Zvcm1fc3Bpbl9sb2FkZXJcIj4nXHJcblx0XHQrICc8ZGl2IGNsYXNzPVwid3BiY19zcGluc19sb2FkZXJfd3JhcHBlclwiPidcclxuXHRcdCsgJzxkaXYgY2xhc3M9XCJ3cGJjX3NwaW5fbG9hZGVyX29uZV9uZXdcIj48L2Rpdj4nXHJcblx0XHQrICc8L2Rpdj4nXHJcblx0XHQrICc8L2Rpdj4nXHJcblx0XHQrICc8c3Bhbj5Mb2FkaW5nLi4uPC9zcGFuPidcclxuXHRcdCsgJzwvZGl2Pic7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBOb3JtYWxpemUgdGltZSBvcHRpb24gdmFsdWVzIGZvciBjb21wYXJpc29uLlxyXG4gKlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gdmFsdWUgVGltZSBvciB0aW1lLXJhbmdlIHZhbHVlLlxyXG4gKiBAcmV0dXJucyB7c3RyaW5nfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fbm9ybWFsaXplX3RpbWVfdmFsdWUoIHZhbHVlICl7XHJcblx0cmV0dXJuIFN0cmluZyggdmFsdWUgfHwgJycgKS5yZXBsYWNlKCAvXFxzKy9nLCAnJyApLnRvTG93ZXJDYXNlKCk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTZWxlY3QgbWF0Y2hpbmcgb3B0aW9uIGluIGEgdGltZSBzZWxlY3Qgd2l0aG91dCBmb3JjaW5nIGRpc2FibGVkIGNob2ljZXMuXHJcbiAqXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSAkc2VsZWN0IFNlbGVjdCBlbGVtZW50LlxyXG4gKiBAcGFyYW0ge0FycmF5fSBleHBlY3RlZF92YWx1ZXMgQWNjZXB0YWJsZSB2YWx1ZXMuXHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fc2VsZWN0X3RpbWVfb3B0aW9uKCAkc2VsZWN0LCBleHBlY3RlZF92YWx1ZXMgKXtcclxuXHJcblx0dmFyIGRpZF9zZWxlY3QgPSBmYWxzZTtcclxuXHR2YXIgbm9ybWFsaXplZF9leHBlY3RlZCA9IFtdO1xyXG5cclxuXHRqUXVlcnkuZWFjaCggZXhwZWN0ZWRfdmFsdWVzLCBmdW5jdGlvbiggaW5kZXgsIHZhbHVlICl7XHJcblx0XHRub3JtYWxpemVkX2V4cGVjdGVkLnB1c2goIHdwYmNfYm9vX2xpc3RpbmdfX25vcm1hbGl6ZV90aW1lX3ZhbHVlKCB2YWx1ZSApICk7XHJcblx0fSApO1xyXG5cclxuXHQkc2VsZWN0LmZpbmQoICdvcHRpb24nICkuZWFjaCggZnVuY3Rpb24oKXtcclxuXHRcdHZhciAkb3B0aW9uID0galF1ZXJ5KCB0aGlzICk7XHJcblx0XHR2YXIgb3B0aW9uX3ZhbHVlID0gd3BiY19ib29fbGlzdGluZ19fbm9ybWFsaXplX3RpbWVfdmFsdWUoICRvcHRpb24udmFsKCkgKTtcclxuXHJcblx0XHRpZiAoIC0xID09PSBqUXVlcnkuaW5BcnJheSggb3B0aW9uX3ZhbHVlLCBub3JtYWxpemVkX2V4cGVjdGVkICkgfHwgJG9wdGlvbi5wcm9wKCAnZGlzYWJsZWQnICkgKSB7XHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggJHNlbGVjdC5wcm9wKCAnbXVsdGlwbGUnICkgKSB7XHJcblx0XHRcdCRvcHRpb24ucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0JHNlbGVjdC52YWwoICRvcHRpb24udmFsKCkgKTtcclxuXHRcdH1cclxuXHJcblx0XHQkc2VsZWN0LnRyaWdnZXIoICdjaGFuZ2UnICk7XHJcblx0XHRkaWRfc2VsZWN0ID0gdHJ1ZTtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9ICk7XHJcblxyXG5cdHJldHVybiBkaWRfc2VsZWN0O1xyXG59XHJcblxyXG4vKipcclxuICogQ2hlY2sgd2hldGhlciB0aGUgcmVuZGVyZWQgYm9va2luZyBmb3JtIGFscmVhZHkgaGFzIHVzZXItZmFjaW5nIHRpbWUgZmllbGRzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge09iamVjdH0gJGZvcm0gQm9va2luZyBmb3JtIGpRdWVyeSBvYmplY3QuXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCBCb29raW5nIHJlc291cmNlIElELlxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX2hhc19hZGRfYm9va2luZ19tb2RhbF90aW1lX2ZpZWxkcyggJGZvcm0sIHJlc291cmNlX2lkICl7XHJcblxyXG5cdHZhciBzZWxlY3RvciA9IFtcclxuXHRcdCdzZWxlY3RbbmFtZT1cInJhbmdldGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nLFxyXG5cdFx0J3NlbGVjdFtuYW1lPVwicmFuZ2V0aW1lJyArIHJlc291cmNlX2lkICsgJ1tdXCJdJyxcclxuXHRcdCdzZWxlY3RbbmFtZT1cInN0YXJ0dGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nLFxyXG5cdFx0J3NlbGVjdFtuYW1lPVwic3RhcnR0aW1lJyArIHJlc291cmNlX2lkICsgJ1tdXCJdJyxcclxuXHRcdCdzZWxlY3RbbmFtZT1cImVuZHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdJyxcclxuXHRcdCdzZWxlY3RbbmFtZT1cImVuZHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnW11cIl0nLFxyXG5cdFx0J2lucHV0W25hbWU9XCJzdGFydHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdJyxcclxuXHRcdCdpbnB1dFtuYW1lPVwiZW5kdGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nXHJcblx0XS5qb2luKCAnLCAnICk7XHJcblxyXG5cdHJldHVybiAkZm9ybS5maW5kKCBzZWxlY3RvciApLmZpbHRlciggZnVuY3Rpb24oKXtcclxuXHRcdHZhciAkZmllbGQgPSBqUXVlcnkoIHRoaXMgKTtcclxuXHJcblx0XHRpZiAoICRmaWVsZC5jbG9zZXN0KCAnLndwYmNfYWRkX2Jvb2tpbmdfbW9kYWxfX3NlbGVjdGVkX3RpbWVfZmllbGRzJyApLmxlbmd0aCApIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggJ2lucHV0JyA9PT0gdGhpcy50YWdOYW1lLnRvTG93ZXJDYXNlKCkgJiYgJ2hpZGRlbicgPT09IFN0cmluZyggJGZpZWxkLmF0dHIoICd0eXBlJyApIHx8ICcnICkudG9Mb3dlckNhc2UoKSApIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0cnVlO1xyXG5cdH0gKS5sZW5ndGggPiAwO1xyXG59XHJcblxyXG4vKipcclxuICogQWRkIHZpc2libGUgcmVhZC1vbmx5IHN0YXJ0L2VuZCB0aW1lIGZpZWxkcyB3aGVuIHRoZSBzZWxlY3RlZCBib29raW5nIGZvcm0gaGFzIG5vIHRpbWUgY29udHJvbHMuXHJcbiAqXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSAkZm9ybSBCb29raW5nIGZvcm0galF1ZXJ5IG9iamVjdC5cclxuICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkIEJvb2tpbmcgcmVzb3VyY2UgSUQuXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBzdGFydF90aW1lIFN0YXJ0IHRpbWUgaW4gMjRoIGZvcm1hdC5cclxuICogQHBhcmFtIHtzdHJpbmd9IGVuZF90aW1lIEVuZCB0aW1lIGluIDI0aCBmb3JtYXQuXHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fZW5zdXJlX2FkZF9ib29raW5nX21vZGFsX3NlbGVjdGVkX3RpbWVfZmllbGRzKCAkZm9ybSwgcmVzb3VyY2VfaWQsIHN0YXJ0X3RpbWUsIGVuZF90aW1lICl7XHJcblxyXG5cdHZhciAkd3JhcCA9ICRmb3JtLmZpbmQoICcud3BiY19hZGRfYm9va2luZ19tb2RhbF9fc2VsZWN0ZWRfdGltZV9maWVsZHMnICk7XHJcblx0dmFyIGh0bWw7XHJcblx0dmFyICRpbnNlcnRfYmVmb3JlO1xyXG5cclxuXHRpZiAoICEgc3RhcnRfdGltZSB8fCAhIGVuZF90aW1lICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0aWYgKCAhICR3cmFwLmxlbmd0aCApIHtcclxuXHRcdGh0bWwgPSAnPGRpdiBjbGFzcz1cIndwYmNfYWRkX2Jvb2tpbmdfbW9kYWxfX3NlbGVjdGVkX3RpbWVfZmllbGRzXCIgc3R5bGU9XCJtYXJnaW46MTJweCAwO3BhZGRpbmc6MTJweDtib3JkZXI6MXB4IHNvbGlkICNkY2RjZGU7YmFja2dyb3VuZDojZjZmN2Y3O2JvcmRlci1yYWRpdXM6NHB4O1wiPidcclxuXHRcdFx0KyAnPGRpdiBzdHlsZT1cImZvbnQtd2VpZ2h0OjYwMDttYXJnaW4tYm90dG9tOjhweDtcIj5UaW1lIHNlbGVjdGVkIGZyb20gYXZhaWxhYmlsaXR5IHRpbWVsaW5lPC9kaXY+J1xyXG5cdFx0XHQrICc8ZGl2IHN0eWxlPVwiZGlzcGxheTpmbGV4O2dhcDoxMHB4O2ZsZXgtd3JhcDp3cmFwO2FsaWduLWl0ZW1zOmZsZXgtZW5kO1wiPidcclxuXHRcdFx0KyAnPGxhYmVsIHN0eWxlPVwiZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtnYXA6NHB4O21pbi13aWR0aDoxMjBweDtcIj4nXHJcblx0XHRcdCsgJzxzcGFuPlN0YXJ0IHRpbWU8L3NwYW4+J1xyXG5cdFx0XHQrICc8aW5wdXQgdHlwZT1cInRleHRcIiBjbGFzcz1cIndwYmNfdWlfY29udHJvbCB3cGJjX3VpX3RleHRcIiBuYW1lPVwic3RhcnR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiIHZhbHVlPVwiXCIgcmVhZG9ubHk9XCJyZWFkb25seVwiIC8+J1xyXG5cdFx0XHQrICc8L2xhYmVsPidcclxuXHRcdFx0KyAnPGxhYmVsIHN0eWxlPVwiZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtnYXA6NHB4O21pbi13aWR0aDoxMjBweDtcIj4nXHJcblx0XHRcdCsgJzxzcGFuPkVuZCB0aW1lPC9zcGFuPidcclxuXHRcdFx0KyAnPGlucHV0IHR5cGU9XCJ0ZXh0XCIgY2xhc3M9XCJ3cGJjX3VpX2NvbnRyb2wgd3BiY191aV90ZXh0XCIgbmFtZT1cImVuZHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCIgdmFsdWU9XCJcIiByZWFkb25seT1cInJlYWRvbmx5XCIgLz4nXHJcblx0XHRcdCsgJzwvbGFiZWw+J1xyXG5cdFx0XHQrICc8L2Rpdj4nXHJcblx0XHRcdCsgJzwvZGl2Pic7XHJcblxyXG5cdFx0JHdyYXAgPSBqUXVlcnkoIGh0bWwgKTtcclxuXHRcdCRpbnNlcnRfYmVmb3JlID0gJGZvcm0uZmluZCggJyNia190eXBlJyArIHJlc291cmNlX2lkICkuZmlyc3QoKTtcclxuXHJcblx0XHRpZiAoICRpbnNlcnRfYmVmb3JlLmxlbmd0aCApIHtcclxuXHRcdFx0JGluc2VydF9iZWZvcmUuYmVmb3JlKCAkd3JhcCApO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0JGZvcm0uZmluZCggJyNib29raW5nX2Zvcm1fZGl2JyArIHJlc291cmNlX2lkICkuYXBwZW5kKCAkd3JhcCApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0JHdyYXAuZmluZCggJ2lucHV0W25hbWU9XCJzdGFydHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdJyApLnZhbCggc3RhcnRfdGltZSApLnRyaWdnZXIoICdpbnB1dCcgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xyXG5cdCR3cmFwLmZpbmQoICdpbnB1dFtuYW1lPVwiZW5kdGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nICkudmFsKCBlbmRfdGltZSApLnRyaWdnZXIoICdpbnB1dCcgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xyXG5cclxuXHRyZXR1cm4gdHJ1ZTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEFwcGx5IGEgcHJlc2VsZWN0ZWQgdGltZSByYW5nZSB0byB0aGUgcmVuZGVyZWQgQWRkIEJvb2tpbmcgZm9ybS5cclxuICpcclxuICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkIEJvb2tpbmcgcmVzb3VyY2UgSUQuXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBzZWxlY3RlZF90aW1lIFRpbWUgcmFuZ2UsIGUuZy4gXCIwOTowMCAtIDExOjAwXCIuXHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fYXBwbHlfYWRkX2Jvb2tpbmdfbW9kYWxfc2VsZWN0ZWRfdGltZSggcmVzb3VyY2VfaWQsIHNlbGVjdGVkX3RpbWUgKXtcclxuXHJcblx0dmFyICRmb3JtID0galF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCApO1xyXG5cdHZhciB0aW1lX3BhcnRzO1xyXG5cdHZhciBzdGFydF90aW1lO1xyXG5cdHZhciBlbmRfdGltZTtcclxuXHR2YXIgZGlkX3NlbGVjdCA9IGZhbHNlO1xyXG5cdHZhciBoYXNfdGltZV9maWVsZHM7XHJcblxyXG5cdGlmICggISAkZm9ybS5sZW5ndGggfHwgISBzZWxlY3RlZF90aW1lICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0dGltZV9wYXJ0cyA9IFN0cmluZyggc2VsZWN0ZWRfdGltZSApLnNwbGl0KCAnIC0gJyApO1xyXG5cdHN0YXJ0X3RpbWUgPSBqUXVlcnkudHJpbSggdGltZV9wYXJ0c1swXSB8fCAnJyApO1xyXG5cdGVuZF90aW1lID0galF1ZXJ5LnRyaW0oIHRpbWVfcGFydHNbMV0gfHwgJycgKTtcclxuXHRoYXNfdGltZV9maWVsZHMgPSB3cGJjX2Jvb19saXN0aW5nX19oYXNfYWRkX2Jvb2tpbmdfbW9kYWxfdGltZV9maWVsZHMoICRmb3JtLCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRpZiAoICEgaGFzX3RpbWVfZmllbGRzICkge1xyXG5cdFx0cmV0dXJuIHdwYmNfYm9vX2xpc3RpbmdfX2Vuc3VyZV9hZGRfYm9va2luZ19tb2RhbF9zZWxlY3RlZF90aW1lX2ZpZWxkcyggJGZvcm0sIHJlc291cmNlX2lkLCBzdGFydF90aW1lLCBlbmRfdGltZSApO1xyXG5cdH1cclxuXHJcblx0JGZvcm0uZmluZCggJ3NlbGVjdFtuYW1lPVwicmFuZ2V0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXSwgc2VsZWN0W25hbWU9XCJyYW5nZXRpbWUnICsgcmVzb3VyY2VfaWQgKyAnW11cIl0nICkuZWFjaCggZnVuY3Rpb24oKXtcclxuXHRcdGRpZF9zZWxlY3QgPSB3cGJjX2Jvb19saXN0aW5nX19zZWxlY3RfdGltZV9vcHRpb24oIGpRdWVyeSggdGhpcyApLCBbIHNlbGVjdGVkX3RpbWUgXSApIHx8IGRpZF9zZWxlY3Q7XHJcblx0fSApO1xyXG5cclxuXHRpZiAoIHN0YXJ0X3RpbWUgKSB7XHJcblx0XHQkZm9ybS5maW5kKCAnc2VsZWN0W25hbWU9XCJzdGFydHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdLCBzZWxlY3RbbmFtZT1cInN0YXJ0dGltZScgKyByZXNvdXJjZV9pZCArICdbXVwiXScgKS5lYWNoKCBmdW5jdGlvbigpe1xyXG5cdFx0XHRkaWRfc2VsZWN0ID0gd3BiY19ib29fbGlzdGluZ19fc2VsZWN0X3RpbWVfb3B0aW9uKCBqUXVlcnkoIHRoaXMgKSwgWyBzdGFydF90aW1lIF0gKSB8fCBkaWRfc2VsZWN0O1xyXG5cdFx0fSApO1xyXG5cdFx0aWYgKCAkZm9ybS5maW5kKCAnaW5wdXRbbmFtZT1cInN0YXJ0dGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nICkubm90KCAnW3R5cGU9XCJoaWRkZW5cIl0nICkudmFsKCBzdGFydF90aW1lICkudHJpZ2dlciggJ2lucHV0JyApLnRyaWdnZXIoICdjaGFuZ2UnICkubGVuZ3RoICkge1xyXG5cdFx0XHRkaWRfc2VsZWN0ID0gdHJ1ZTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGlmICggZW5kX3RpbWUgKSB7XHJcblx0XHQkZm9ybS5maW5kKCAnc2VsZWN0W25hbWU9XCJlbmR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXSwgc2VsZWN0W25hbWU9XCJlbmR0aW1lJyArIHJlc291cmNlX2lkICsgJ1tdXCJdJyApLmVhY2goIGZ1bmN0aW9uKCl7XHJcblx0XHRcdGRpZF9zZWxlY3QgPSB3cGJjX2Jvb19saXN0aW5nX19zZWxlY3RfdGltZV9vcHRpb24oIGpRdWVyeSggdGhpcyApLCBbIGVuZF90aW1lIF0gKSB8fCBkaWRfc2VsZWN0O1xyXG5cdFx0fSApO1xyXG5cdFx0aWYgKCAkZm9ybS5maW5kKCAnaW5wdXRbbmFtZT1cImVuZHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdJyApLm5vdCggJ1t0eXBlPVwiaGlkZGVuXCJdJyApLnZhbCggZW5kX3RpbWUgKS50cmlnZ2VyKCAnaW5wdXQnICkudHJpZ2dlciggJ2NoYW5nZScgKS5sZW5ndGggKSB7XHJcblx0XHRcdGRpZF9zZWxlY3QgPSB0cnVlO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIGRpZF9zZWxlY3Q7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBcHBseSBBZGQgQm9va2luZyBtb2RhbCBkYXRlL3RpbWUgY29udGV4dCBhZnRlciBBSkFYLXJlbmRlcmVkIGZvcm0gbGlmZWN5Y2xlIHNjcmlwdHMgcnVuLlxyXG4gKlxyXG4gKiBAcGFyYW0ge09iamVjdH0gZGF0YSBBSkFYIHJlc3BvbnNlIGRhdGEuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19wcmVsb2FkX2FkZF9ib29raW5nX21vZGFsX3NlbGVjdGlvbiggZGF0YSApe1xyXG5cclxuXHRkYXRhID0gZGF0YSB8fCB7fTtcclxuXHJcblx0dmFyIHJlc291cmNlX2lkID0gcGFyc2VJbnQoIGRhdGEucmVzb3VyY2VfaWQsIDEwICk7XHJcblx0dmFyIHNlbGVjdGVkX2RhdGUgPSBkYXRhLnNlbGVjdGVkX2RhdGUgfHwgJyc7XHJcblx0dmFyIHNlbGVjdGVkX3RpbWUgPSBkYXRhLnNlbGVjdGVkX3RpbWUgfHwgJyc7XHJcblx0dmFyIHNlbGVjdGVkX2RhdGVzX3dpdGhvdXRfY2FsZW5kYXIgPSBkYXRhLnNlbGVjdGVkX2RhdGVzX3dpdGhvdXRfY2FsZW5kYXIgfHwgJyc7XHJcblx0dmFyIGFwcGx5X3RpbWU7XHJcblxyXG5cdGlmICggISByZXNvdXJjZV9pZCApIHtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdGlmIChcclxuXHRcdCAgIHNlbGVjdGVkX2RhdGVcclxuXHRcdCYmICEgc2VsZWN0ZWRfZGF0ZXNfd2l0aG91dF9jYWxlbmRhclxyXG5cdFx0JiYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd3BiY19hdXRvX3NlbGVjdF9kYXRlc19pbl9jYWxlbmRhciApXHJcblx0KSB7XHJcblx0XHRqUXVlcnkoICdib2R5JyApLm9mZiggJ3dwYmNfY2FsZW5kYXJfYWp4X19sb2FkZWRfZGF0YS53cGJjX2FkZF9ib29raW5nX21vZGFsX2RhdGUnICkub25lKCAnd3BiY19jYWxlbmRhcl9hanhfX2xvYWRlZF9kYXRhLndwYmNfYWRkX2Jvb2tpbmdfbW9kYWxfZGF0ZScsIGZ1bmN0aW9uKCBldmVudCwgbG9hZGVkX3Jlc291cmNlX2lkICl7XHJcblx0XHRcdGlmICggcGFyc2VJbnQoIGxvYWRlZF9yZXNvdXJjZV9pZCwgMTAgKSA9PT0gcmVzb3VyY2VfaWQgKSB7XHJcblx0XHRcdFx0d3BiY19hdXRvX3NlbGVjdF9kYXRlc19pbl9jYWxlbmRhciggcmVzb3VyY2VfaWQsIHNlbGVjdGVkX2RhdGUsIHNlbGVjdGVkX2RhdGUgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cdFx0d2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uKCl7XHJcblx0XHRcdHdwYmNfYXV0b19zZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXIoIHJlc291cmNlX2lkLCBzZWxlY3RlZF9kYXRlLCBzZWxlY3RlZF9kYXRlICk7XHJcblx0XHR9LCAzMDAgKTtcclxuXHR9XHJcblxyXG5cdGlmICggISBzZWxlY3RlZF90aW1lICkge1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0YXBwbHlfdGltZSA9IGZ1bmN0aW9uKCl7XHJcblx0XHR2YXIgaXNfY2FsZW5kYXJfZGF0YV9sb2FkZWQgPSAoXHJcblx0XHRcdCAgICEgc2VsZWN0ZWRfZGF0ZVxyXG5cdFx0XHR8fCAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgX3dwYmMgKVxyXG5cdFx0XHR8fCAoICdmdW5jdGlvbicgIT09IHR5cGVvZiBfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlIClcclxuXHRcdFx0fHwgKCBmYWxzZSAhPT0gX3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSggcmVzb3VyY2VfaWQsIHNlbGVjdGVkX2RhdGUgKSApXHJcblx0XHQpO1xyXG5cclxuXHRcdGlmICggaXNfY2FsZW5kYXJfZGF0YV9sb2FkZWQgJiYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd3BiY19kaXNhYmxlX3RpbWVfZmllbGRzX2luX2Jvb2tpbmdfZm9ybSApICkge1xyXG5cdFx0XHR3cGJjX2Rpc2FibGVfdGltZV9maWVsZHNfaW5fYm9va2luZ19mb3JtKCByZXNvdXJjZV9pZCApO1xyXG5cdFx0fVxyXG5cdFx0d3BiY19ib29fbGlzdGluZ19fYXBwbHlfYWRkX2Jvb2tpbmdfbW9kYWxfc2VsZWN0ZWRfdGltZSggcmVzb3VyY2VfaWQsIHNlbGVjdGVkX3RpbWUgKTtcclxuXHR9O1xyXG5cclxuXHRqUXVlcnkoICcuYm9va2luZ19mb3JtX2RpdicgKS5vZmYoICd3cGJjX2hvb2tfdGltZXNsb3RzX2Rpc2FibGVkLndwYmNfYWRkX2Jvb2tpbmdfbW9kYWxfdGltZScgKS5vbmUoICd3cGJjX2hvb2tfdGltZXNsb3RzX2Rpc2FibGVkLndwYmNfYWRkX2Jvb2tpbmdfbW9kYWxfdGltZScsIGZ1bmN0aW9uKCBldmVudCwgbG9hZGVkX3Jlc291cmNlX2lkICl7XHJcblx0XHRpZiAoIHBhcnNlSW50KCBsb2FkZWRfcmVzb3VyY2VfaWQsIDEwICkgPT09IHJlc291cmNlX2lkICkge1xyXG5cdFx0XHR3aW5kb3cuc2V0VGltZW91dCggYXBwbHlfdGltZSwgMCApO1xyXG5cdFx0fVxyXG5cdH0gKTtcclxuXHJcblx0alF1ZXJ5KCAnYm9keScgKS5vZmYoICd3cGJjX2NhbGVuZGFyX2FqeF9fbG9hZGVkX2RhdGEud3BiY19hZGRfYm9va2luZ19tb2RhbF90aW1lJyApLm9uZSggJ3dwYmNfY2FsZW5kYXJfYWp4X19sb2FkZWRfZGF0YS53cGJjX2FkZF9ib29raW5nX21vZGFsX3RpbWUnLCBmdW5jdGlvbiggZXZlbnQsIGxvYWRlZF9yZXNvdXJjZV9pZCApe1xyXG5cdFx0aWYgKCBwYXJzZUludCggbG9hZGVkX3Jlc291cmNlX2lkLCAxMCApID09PSByZXNvdXJjZV9pZCApIHtcclxuXHRcdFx0d2luZG93LnNldFRpbWVvdXQoIGFwcGx5X3RpbWUsIDgwICk7XHJcblx0XHR9XHJcblx0fSApO1xyXG5cclxuXHR3aW5kb3cuc2V0VGltZW91dCggYXBwbHlfdGltZSwgMzUwICk7XHJcblx0d2luZG93LnNldFRpbWVvdXQoIGFwcGx5X3RpbWUsIDEwMDAgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJlZnJlc2ggbW9kYWwgZm9vdGVyIGNvbnRyb2xzIGFmdGVyIEFkZC9FZGl0IEJvb2tpbmcgY29udGV4dCBjaGFuZ2VzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge09iamVjdH0gJG1vZGFsIE1vZGFsIGpRdWVyeSBvYmplY3QuXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhIEFKQVggcmVzcG9uc2UgZGF0YS5cclxuICogQHBhcmFtIHtzdHJpbmd9IG1vZGUgQ3VycmVudCBtb2RhbCBtb2RlLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fc3luY19hZGRfYm9va2luZ19tb2RhbF9jb250cm9scyggJG1vZGFsLCBkYXRhLCBtb2RlICl7XHJcblxyXG5cdGRhdGEgPSBkYXRhIHx8IHt9O1xyXG5cclxuXHQkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1tb2RlJywgbW9kZSB8fCBkYXRhLm1vZGUgfHwgJ2FkZCcgKTtcclxuXHJcblx0dmFyICRyZXNvdXJjZV9jb250cm9sID0gJG1vZGFsLmZpbmQoICcud3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX3Jlc291cmNlX2NvbnRyb2wnICk7XHJcblx0dmFyICRyZXNvdXJjZV9zZWxlY3QgID0gJG1vZGFsLmZpbmQoICcjd3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX3Jlc291cmNlX2lkJyApO1xyXG5cdHZhciAkZm9ybV9zZWxlY3QgICAgICA9ICRtb2RhbC5maW5kKCAnI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19ib29raW5nX2Zvcm0nICk7XHJcblx0dmFyICRmb3JtX2VkaXRfbGluayAgID0gJG1vZGFsLmZpbmQoICcud3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX2VkaXRfZm9ybV9saW5rJyApO1xyXG5cclxuXHRpZiAoICdlZGl0JyA9PT0gKCBtb2RlIHx8IGRhdGEubW9kZSApICkge1xyXG5cdFx0JHJlc291cmNlX2NvbnRyb2wuaGlkZSgpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHQkcmVzb3VyY2VfY29udHJvbC5zaG93KCk7XHJcblx0fVxyXG5cclxuXHRpZiAoIGRhdGEucmVzb3VyY2VfaWQgJiYgJHJlc291cmNlX3NlbGVjdC5sZW5ndGggKSB7XHJcblx0XHQkcmVzb3VyY2Vfc2VsZWN0LnZhbCggU3RyaW5nKCBkYXRhLnJlc291cmNlX2lkICkgKTtcclxuXHR9XHJcblxyXG5cdGlmICggJGZvcm1fc2VsZWN0Lmxlbmd0aCApIHtcclxuXHRcdCRmb3JtX3NlbGVjdC52YWwoIGRhdGEuYm9va2luZ19mb3JtIHx8ICdzdGFuZGFyZCcgKTtcclxuXHR9XHJcblxyXG5cdGlmICggJGZvcm1fZWRpdF9saW5rLmxlbmd0aCApIHtcclxuXHRcdHdwYmNfYm9vX2xpc3RpbmdfX3N5bmNfYWRkX2Jvb2tpbmdfbW9kYWxfZm9ybV9lZGl0X2xpbmsoICRtb2RhbCApO1xyXG5cdH1cclxufVxyXG5cclxuLyoqXHJcbiAqIFN5bmMgRm9ybXMgQnVpbGRlciBlZGl0IGxpbmsgd2l0aCBzZWxlY3RlZCBjdXN0b20gYm9va2luZyBmb3JtLlxyXG4gKlxyXG4gKiBAcGFyYW0ge09iamVjdH0gJG1vZGFsIE1vZGFsIGpRdWVyeSBvYmplY3QuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19zeW5jX2FkZF9ib29raW5nX21vZGFsX2Zvcm1fZWRpdF9saW5rKCAkbW9kYWwgKXtcclxuXHJcblx0dmFyICRmb3JtX3NlbGVjdCAgICA9ICRtb2RhbC5maW5kKCAnI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19ib29raW5nX2Zvcm0nICk7XHJcblx0dmFyICRmb3JtX2VkaXRfbGluayA9ICRtb2RhbC5maW5kKCAnLndwYmNfbW9kYWxfX2FkZF9ib29raW5nX19lZGl0X2Zvcm1fbGluaycgKTtcclxuXHJcblx0aWYgKCAhICRmb3JtX3NlbGVjdC5sZW5ndGggfHwgISAkZm9ybV9lZGl0X2xpbmsubGVuZ3RoICkge1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0dmFyIGZvcm1fbmFtZSA9ICRmb3JtX3NlbGVjdC52YWwoKSB8fCAnc3RhbmRhcmQnO1xyXG5cdHZhciBiYXNlX3VybCAgPSAkZm9ybV9lZGl0X2xpbmsuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1mb3JtLWJ1aWxkZXItdXJsJyApIHx8ICRmb3JtX2VkaXRfbGluay5hdHRyKCAnaHJlZicgKSB8fCAnJztcclxuXHJcblx0aWYgKCAhIGJhc2VfdXJsICkge1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0dmFyIHNlcGFyYXRvciA9ICggLTEgPT09IGJhc2VfdXJsLmluZGV4T2YoICc/JyApICkgPyAnPycgOiAnJic7XHJcblx0JGZvcm1fZWRpdF9saW5rLmF0dHIoICdocmVmJywgYmFzZV91cmwgKyBzZXBhcmF0b3IgKyAnZm9ybV9uYW1lPScgKyBlbmNvZGVVUklDb21wb25lbnQoIGZvcm1fbmFtZSApICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBJbml0IG1vZGFsIGZvb3RlciBjb250cm9scy5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX2luaXRfYWRkX2Jvb2tpbmdfbW9kYWxfY29udHJvbHMoKXtcclxuXHJcblx0alF1ZXJ5KCBkb2N1bWVudCApLm9mZiggJ2NoYW5nZS53cGJjX2FkZF9ib29raW5nX21vZGFsJywgJyN3cGJjX21vZGFsX19hZGRfYm9va2luZ19fcmVzb3VyY2VfaWQsICN3cGJjX21vZGFsX19hZGRfYm9va2luZ19fYm9va2luZ19mb3JtJyApLm9uKFxyXG5cdFx0J2NoYW5nZS53cGJjX2FkZF9ib29raW5nX21vZGFsJyxcclxuXHRcdCcjd3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX3Jlc291cmNlX2lkLCAjd3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX2Jvb2tpbmdfZm9ybScsXHJcblx0XHRmdW5jdGlvbigpe1xyXG5cdFx0XHR2YXIgJG1vZGFsID0galF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19zZWN0aW9uJyApO1xyXG5cdFx0XHR2YXIgbW9kZSAgID0gJG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctbW9kZScgKSB8fCAnYWRkJztcclxuXHJcblx0XHRcdHdwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19hZGRfYm9va2luZ19tb2RhbCgge1xyXG5cdFx0XHRcdG1vZGUgICAgICAgICA6IG1vZGUsXHJcblx0XHRcdFx0Ym9va2luZ19pZCAgIDogJG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctaWQnICkgfHwgJycsXHJcblx0XHRcdFx0cmVzb3VyY2VfaWQgIDogJG1vZGFsLmZpbmQoICcjd3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX3Jlc291cmNlX2lkJyApLnZhbCgpIHx8ICcnLFxyXG5cdFx0XHRcdGJvb2tpbmdfaGFzaCA6ICRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLWhhc2gnICkgfHwgJycsXHJcblx0XHRcdFx0Ym9va2luZ19mb3JtIDogJG1vZGFsLmZpbmQoICcjd3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX2Jvb2tpbmdfZm9ybScgKS52YWwoKSB8fCAnJ1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblx0KTtcclxufVxyXG5qUXVlcnkoIGRvY3VtZW50ICkucmVhZHkoIGZ1bmN0aW9uKCl7XHJcblx0d3BiY19ib29fbGlzdGluZ19faW5pdF9hZGRfYm9va2luZ19tb2RhbF9jb250cm9scygpO1xyXG59ICk7XHJcblxyXG4vKipcclxuICogT3BlbiBBZGQvRWRpdCBCb29raW5nIG1vZGFsLlxyXG4gKlxyXG4gKiBAcGFyYW0ge09iamVjdH0gYXJncyBNb2RhbCBjb250ZXh0LlxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbnx1bmRlZmluZWR9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19jbGlja19fYWRkX2Jvb2tpbmdfbW9kYWwoIGFyZ3MgKXtcclxuXHJcblx0aWYgKCAhIHdwYmNfaXNfbW9kYWxfYWNjZXNzaWJsZSggJyN3cGJjX21vZGFsX19hZGRfYm9va2luZ19fc2VjdGlvbicgKSApIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cdGFyZ3MgPSBhcmdzIHx8IHt9O1xyXG5cclxuXHR2YXIgJG1vZGFsID0galF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19zZWN0aW9uJyApO1xyXG5cdHZhciAkYm9keSA9IGpRdWVyeSggJyN3cGJjX21vZGFsX19hZGRfYm9va2luZ19fYm9keScgKTtcclxuXHR2YXIgbm9uY2UgPSAkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1ub25jZScgKTtcclxuXHR2YXIgbW9kZSA9IGFyZ3MubW9kZSB8fCAoIGFyZ3MuYm9va2luZ19oYXNoID8gJ2VkaXQnIDogJ2FkZCcgKTtcclxuXHR2YXIgdGl0bGUgPSAoICdlZGl0JyA9PT0gbW9kZSApID8gJ0VkaXQgYm9va2luZycgOiAnQWRkIGJvb2tpbmcnO1xyXG5cclxuXHQkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1yZXNvdXJjZS1pZCcsICcnICk7XHJcblx0JG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctaGFzaCcsIGFyZ3MuYm9va2luZ19oYXNoIHx8ICcnICk7XHJcblx0JG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctaWQnLCBhcmdzLmJvb2tpbmdfaWQgfHwgJycgKTtcclxuXHQkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1tb2RlJywgbW9kZSApO1xyXG5cdHdwYmNfYm9vX2xpc3RpbmdfX3N5bmNfYWRkX2Jvb2tpbmdfbW9kYWxfY29udHJvbHMoICRtb2RhbCwgYXJncywgbW9kZSApO1xyXG5cdCRtb2RhbC5maW5kKCAnLndwYmNfbW9kYWxfX2FkZF9ib29raW5nX190aXRsZScgKS50ZXh0KCB0aXRsZSApO1xyXG5cdCRtb2RhbC5maW5kKCAnLndwYmNfbW9kYWxfX2FkZF9ib29raW5nX19ib29raW5nX2lkJyApLmh0bWwoIGFyZ3MuYm9va2luZ19pZCA/ICggJ0lEOiAnICsgYXJncy5ib29raW5nX2lkICkgOiAnJyApO1xyXG5cdCRtb2RhbC5maW5kKCAnI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19idXR0b25fc2VuZCcgKS50ZXh0KCAoICdlZGl0JyA9PT0gbW9kZSApID8gJ1NhdmUgYm9va2luZycgOiAnQWRkIGJvb2tpbmcnICk7XHJcblx0JGJvZHkuaHRtbCggd3BiY19ib29fbGlzdGluZ19fZ2V0X2FkZF9ib29raW5nX21vZGFsX2xvYWRpbmdfaHRtbCgpICk7XHJcblxyXG5cdCRtb2RhbC53cGJjX215X21vZGFsKCAnc2hvdycgKTtcclxuXHJcblx0alF1ZXJ5LnBvc3QoXHJcblx0XHR3cGJjX3VybF9hamF4LFxyXG5cdFx0e1xyXG5cdFx0XHRhY3Rpb24gICAgICAgOiAnV1BCQ19BSlhfQUREX0JPT0tJTkdfTU9EQUwnLFxyXG5cdFx0XHRub25jZSAgICAgICAgOiBub25jZSxcclxuXHRcdFx0bW9kZSAgICAgICAgIDogbW9kZSxcclxuXHRcdFx0Ym9va2luZ19pZCAgIDogYXJncy5ib29raW5nX2lkIHx8ICcnLFxyXG5cdFx0XHRyZXNvdXJjZV9pZCAgOiBhcmdzLnJlc291cmNlX2lkIHx8ICcnLFxyXG5cdFx0XHRib29raW5nX2hhc2ggOiBhcmdzLmJvb2tpbmdfaGFzaCB8fCAnJyxcclxuXHRcdFx0Ym9va2luZ19mb3JtIDogYXJncy5ib29raW5nX2Zvcm0gfHwgJycsXHJcblx0XHRcdHNlbGVjdGVkX2RhdGVzX3dpdGhvdXRfY2FsZW5kYXIgOiBhcmdzLnNlbGVjdGVkX2RhdGVzX3dpdGhvdXRfY2FsZW5kYXIgfHwgJycsXHJcblx0XHRcdHNlbGVjdGVkX2RhdGUgOiBhcmdzLnNlbGVjdGVkX2RhdGUgfHwgJycsXHJcblx0XHRcdHNlbGVjdGVkX3RpbWUgOiBhcmdzLnNlbGVjdGVkX3RpbWUgfHwgJydcclxuXHRcdH0sXHJcblx0XHRmdW5jdGlvbiggcmVzcG9uc2UgKXtcclxuXHJcblx0XHRcdGlmICggISByZXNwb25zZSB8fCAhIHJlc3BvbnNlLnN1Y2Nlc3MgKSB7XHJcblx0XHRcdFx0dmFyIG1lc3NhZ2UgPSAoIHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5tZXNzYWdlICkgPyByZXNwb25zZS5kYXRhLm1lc3NhZ2UgOiAnVW5hYmxlIHRvIGxvYWQgYm9va2luZyBmb3JtLic7XHJcblx0XHRcdFx0JGJvZHkuaHRtbCggJzxkaXYgY2xhc3M9XCJ3cGJjLXNldHRpbmdzLW5vdGljZSBub3RpY2Utd2FybmluZ1wiIHN0eWxlPVwidGV4dC1hbGlnbjpsZWZ0XCI+JyArIG1lc3NhZ2UgKyAnPC9kaXY+JyApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0JG1vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctcmVzb3VyY2UtaWQnLCByZXNwb25zZS5kYXRhLnJlc291cmNlX2lkIHx8ICcnICk7XHJcblx0XHRcdCRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLWhhc2gnLCByZXNwb25zZS5kYXRhLmJvb2tpbmdfaGFzaCB8fCAnJyApO1xyXG5cdFx0XHQkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1pZCcsIHJlc3BvbnNlLmRhdGEuYm9va2luZ19pZCB8fCAnJyApO1xyXG5cdFx0XHQkbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1tb2RlJywgcmVzcG9uc2UuZGF0YS5tb2RlIHx8IG1vZGUgKTtcclxuXHRcdFx0d3BiY19ib29fbGlzdGluZ19fc3luY19hZGRfYm9va2luZ19tb2RhbF9jb250cm9scyggJG1vZGFsLCByZXNwb25zZS5kYXRhLCByZXNwb25zZS5kYXRhLm1vZGUgfHwgbW9kZSApO1xyXG5cdFx0XHQkbW9kYWwuZmluZCggJy53cGJjX21vZGFsX19hZGRfYm9va2luZ19fdGl0bGUnICkudGV4dCggcmVzcG9uc2UuZGF0YS50aXRsZSB8fCB0aXRsZSApO1xyXG5cdFx0XHQkbW9kYWwuZmluZCggJy53cGJjX21vZGFsX19hZGRfYm9va2luZ19fYm9va2luZ19pZCcgKS5odG1sKCByZXNwb25zZS5kYXRhLmJvb2tpbmdfaWQgPyAoICdJRDogJyArIHJlc3BvbnNlLmRhdGEuYm9va2luZ19pZCApIDogJycgKTtcclxuXHRcdFx0JG1vZGFsLmZpbmQoICcjd3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX2J1dHRvbl9zZW5kJyApLnRleHQoIHJlc3BvbnNlLmRhdGEuYnV0dG9uX3RpdGxlIHx8ICggKCAnZWRpdCcgPT09IG1vZGUgKSA/ICdTYXZlIGJvb2tpbmcnIDogJ0FkZCBib29raW5nJyApICk7XHJcblx0XHRcdHdwYmNfYm9vX2xpc3RpbmdfX3NldF9hZGRfYm9va2luZ19tb2RhbF9ib2R5X2h0bWwoICRib2R5LCByZXNwb25zZS5kYXRhLmh0bWwgfHwgJycgKTtcclxuXHJcblx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdwYmNfaG9va19faW5pdF9ib29raW5nX2Zvcm1fd2l6YXJkX2J1dHRvbnMgKSB7XHJcblx0XHRcdFx0d3BiY19ob29rX19pbml0X2Jvb2tpbmdfZm9ybV93aXphcmRfYnV0dG9ucygpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YgX3dwYmMgKSB7XHJcblx0XHRcdFx0X3dwYmMuc2V0X290aGVyX3BhcmFtKCAndGhpc19wYWdlX2Jvb2tpbmdfaGFzaCcsIHJlc3BvbnNlLmRhdGEuYm9va2luZ19oYXNoIHx8ICcnICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdwYmNfYnNfamF2YXNjcmlwdF90b29sdGlwcyApIHtcclxuXHRcdFx0XHR3cGJjX2JzX2phdmFzY3JpcHRfdG9vbHRpcHMoKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3cGJjX2JzX2phdmFzY3JpcHRfcG9wb3ZlciApIHtcclxuXHRcdFx0XHR3cGJjX2JzX2phdmFzY3JpcHRfcG9wb3ZlcigpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR3cGJjX2Jvb19saXN0aW5nX19wcmVsb2FkX2FkZF9ib29raW5nX21vZGFsX3NlbGVjdGlvbiggcmVzcG9uc2UuZGF0YSApO1xyXG5cdFx0fVxyXG5cdCkuZmFpbCggZnVuY3Rpb24oKXtcclxuXHRcdCRib2R5Lmh0bWwoICc8ZGl2IGNsYXNzPVwid3BiYy1zZXR0aW5ncy1ub3RpY2Ugbm90aWNlLXdhcm5pbmdcIiBzdHlsZT1cInRleHQtYWxpZ246bGVmdFwiPlVuYWJsZSB0byBsb2FkIGJvb2tpbmcgZm9ybS48L2Rpdj4nICk7XHJcblx0fSApO1xyXG59XHJcblxyXG4vKipcclxuICogUmVsb2FkIEJvb2tpbmcgTGlzdGluZyBhZnRlciBBZGQvRWRpdCBCb29raW5nIG1vZGFsIHNhdmVkIHN1Y2Nlc3NmdWxseS5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX3JlbG9hZF9hZnRlcl9hZGRfYm9va2luZ19tb2RhbF9zdWJtaXQoKXtcclxuXHJcblx0dmFyICRtb2RhbCA9IGpRdWVyeSggJyN3cGJjX21vZGFsX19hZGRfYm9va2luZ19fc2VjdGlvbicgKTtcclxuXHJcblx0aWYgKCAkbW9kYWwubGVuZ3RoICYmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mICRtb2RhbC53cGJjX215X21vZGFsICkgKSB7XHJcblx0XHQkbW9kYWwud3BiY19teV9tb2RhbCggJ2hpZGUnICk7XHJcblx0fVxyXG5cclxuXHRpZiAoXHJcblx0XHQgICAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zIClcclxuXHRcdCYmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiB3aW5kb3cud3BiY19hanhfYm9va2luZ19saXN0aW5nIClcclxuXHQpIHtcclxuXHRcdHdpbmRvdy53cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHt9ICk7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19hanhfYm9va2luZ19fYWN0dWFsX2xpc3RpbmdfX3Nob3cgKSB7XHJcblx0XHR3aW5kb3cud3BiY19hanhfYm9va2luZ19fYWN0dWFsX2xpc3RpbmdfX3Nob3coKTtcclxuXHR9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTdWJtaXQgQWRkL0VkaXQgQm9va2luZyBtb2RhbCBmb3JtLlxyXG4gKlxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbnx1bmRlZmluZWR9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19zdWJtaXRfX2FkZF9ib29raW5nX21vZGFsKCl7XHJcblxyXG5cdHZhciAkbW9kYWwgPSBqUXVlcnkoICcjd3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX3NlY3Rpb24nICk7XHJcblx0dmFyICRmb3JtID0gJG1vZGFsLmZpbmQoICdmb3JtLmJvb2tpbmdfZm9ybScgKS5maXJzdCgpO1xyXG5cdHZhciByZXNvdXJjZV9pZCA9IDA7XHJcblxyXG5cdGlmICggJGZvcm0ubGVuZ3RoICkge1xyXG5cdFx0cmVzb3VyY2VfaWQgPSBwYXJzZUludCggKCAkZm9ybS5hdHRyKCAnaWQnICkgfHwgJycgKS5yZXBsYWNlKCAnYm9va2luZ19mb3JtJywgJycgKSwgMTAgKTtcclxuXHR9XHJcblxyXG5cdGlmICggISByZXNvdXJjZV9pZCApIHtcclxuXHRcdHJlc291cmNlX2lkID0gcGFyc2VJbnQoICRtb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLXJlc291cmNlLWlkJyApLCAxMCApO1xyXG5cdH1cclxuXHJcblx0aWYgKCAhIHJlc291cmNlX2lkICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0dmFyIHN1Ym1pdF9mb3JtID0gJGZvcm0ubGVuZ3RoID8gJGZvcm0uZ2V0KCAwICkgOiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCApO1xyXG5cdHZhciBsb2NhbGUgPSAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YgX3dwYmMgKSA/IF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ2xvY2FsZV9hY3RpdmUnICkgOiAnJztcclxuXHR2YXIgc3VibWl0X3Jlc3VsdDtcclxuXHJcblx0alF1ZXJ5KCAnYm9keScgKS5vZmYoICd3cGJjX2Jvb2tpbmdfZm9ybV9zdWJtaXRfc3VjY2Vzcy53cGJjX2FkZF9ib29raW5nX21vZGFsX3JlbG9hZCcgKVxyXG5cdFx0Lm9uKCAnd3BiY19ib29raW5nX2Zvcm1fc3VibWl0X3N1Y2Nlc3Mud3BiY19hZGRfYm9va2luZ19tb2RhbF9yZWxvYWQnLCBmdW5jdGlvbiggZXZlbnQsIHN1Ym1pdHRlZF9yZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdFx0aWYgKCBwYXJzZUludCggc3VibWl0dGVkX3Jlc291cmNlX2lkLCAxMCApICE9PSByZXNvdXJjZV9pZCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGpRdWVyeSggJ2JvZHknICkub2ZmKCAnd3BiY19ib29raW5nX2Zvcm1fc3VibWl0X3N1Y2Nlc3Mud3BiY19hZGRfYm9va2luZ19tb2RhbF9yZWxvYWQnICk7XHJcblxyXG5cdFx0XHRpZiAoICEgalF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19zZWN0aW9uJyApLmlzKCAnOnZpc2libGUnICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR3cGJjX2Jvb19saXN0aW5nX19yZWxvYWRfYWZ0ZXJfYWRkX2Jvb2tpbmdfbW9kYWxfc3VibWl0KCk7XHJcblx0XHR9ICk7XHJcblxyXG5cdHN1Ym1pdF9yZXN1bHQgPSB3cGJjX2Jvb2tpbmdfZm9ybV9zdWJtaXQoIHN1Ym1pdF9mb3JtLCByZXNvdXJjZV9pZCwgbG9jYWxlICk7XHJcblxyXG5cdGlmICggZmFsc2UgPT09IHN1Ym1pdF9yZXN1bHQgKSB7XHJcblx0XHRqUXVlcnkoICdib2R5JyApLm9mZiggJ3dwYmNfYm9va2luZ19mb3JtX3N1Ym1pdF9zdWNjZXNzLndwYmNfYWRkX2Jvb2tpbmdfbW9kYWxfcmVsb2FkJyApO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHN1Ym1pdF9yZXN1bHQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDaGFuZ2UgcGF5bWVudCBDb3N0LlxyXG4gKlxyXG4gKiBAcGFyYW0gYm9va2luZ19pZFx0XHRcdC0gSUQgb2YgYm9va2luZy5cclxuICogQHBhcmFtIGNvc3RcdCAgICAgICAgICAgICAgICAtIHBheW1lbnQgY29zdC5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19zZXRfYm9va2luZ19jb3N0KCBib29raW5nX2lkLCBjb3N0ICkge1xyXG5cclxuXHRpZiAoICEgd3BiY19pc19tb2RhbF9hY2Nlc3NpYmxlKCAnI3dwYmNfbW9kYWxfX2Jvb2tpbmdfY29zdF9lZGl0X19zZWN0aW9uJyApICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0Ly8gU2V0IGJvb2tpbmcgY29zdC5cclxuXHRqUXVlcnkoICcjd3BiY19tb2RhbF9fYm9va2luZ19jb3N0X2VkaXRfX3ZhbHVlJyApLnZhbCggY29zdCApO1xyXG5cclxuXHQvLyBTZXQgYm9va2luZyBJRC5cclxuXHRqUXVlcnkoICcjd3BiY19tb2RhbF9fYm9va2luZ19jb3N0X2VkaXRfX2Jvb2tpbmdfaWQnICkudmFsKCBib29raW5nX2lkICk7XHJcblxyXG5cdC8vIElEIHRpdGxlLlxyXG5cdGpRdWVyeSggJy53cGJjX21vZGFsX19ib29raW5nX2Nvc3RfZWRpdF9fYm9va2luZ19pZCcgKS5odG1sKCAnSUQ6ICcgKyBib29raW5nX2lkICk7XHJcblxyXG5cdC8vIFNob3cgTW9kYWwuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2Jvb2tpbmdfY29zdF9lZGl0X19zZWN0aW9uJyApLndwYmNfbXlfbW9kYWwoICdzaG93JyApO1xyXG5cclxuXHQvLyBTZXQgZm9jdXMgdG8gaW5wdXQuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2Jvb2tpbmdfY29zdF9lZGl0X192YWx1ZScgKS50cmlnZ2VyKCAnZm9jdXMnICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDaGFuZ2UgcGF5bWVudCBTdGF0dXMuXHJcbiAqXHJcbiAqIEBwYXJhbSBib29raW5nX2lkXHRcdFx0LSBJRCBvZiBib29raW5nLlxyXG4gKiBAcGFyYW0gc2VsZWN0ZWRfcGF5X3N0YXR1c1x0LSBwYXltZW50IHN0YXR1cy5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19zZXRfcGF5bWVudF9zdGF0dXMoIGJvb2tpbmdfaWQsIHNlbGVjdGVkX3BheV9zdGF0dXMgKSB7XHJcblxyXG5cdGlmICggISB3cGJjX2lzX21vZGFsX2FjY2Vzc2libGUoICcjd3BiY19tb2RhbF9fcGF5bWVudF9zdGF0dXNfZWRpdF9fc2VjdGlvbicgKSApIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cdHZhciBqU2VsZWN0ID0galF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3BheW1lbnRfc3RhdHVzX2VkaXRfX3ZhbHVlJyApO1xyXG5cclxuXHQvLyBTZWxlY3QgU3RhdHVzLlxyXG5cdGlmICggKCAhIGlzTmFOKCBwYXJzZUZsb2F0KCBzZWxlY3RlZF9wYXlfc3RhdHVzICkgKSkgfHwgKCcnID09PSBzZWxlY3RlZF9wYXlfc3RhdHVzKSApIHtcdFx0Ly8gSXMgaXQgZmxvYXQgLSB0aGVuICBpdCdzIHVua25vd24uXHJcblx0XHRqU2VsZWN0LmZpbmQoICdvcHRpb25bdmFsdWU9XCIxXCJdJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKTtcdFx0XHRcdFx0XHRcdFx0Ly8gVW5rbm93biAgdmFsdWUgaXMgJzEnIGluIHNlbGVjdCBib3guXHJcblx0fSBlbHNlIHtcclxuXHRcdGpTZWxlY3QuZmluZCggJ29wdGlvblt2YWx1ZT1cIicgKyBzZWxlY3RlZF9wYXlfc3RhdHVzICsgJ1wiXScgKS5wcm9wKCAnc2VsZWN0ZWQnLCB0cnVlICk7XHRcdC8vIE90aGVyd2lzZSBrbm93biBwYXltZW50IHN0YXR1cy5cclxuXHR9XHJcblx0Ly8gU2V0IGJvb2tpbmcgSUQuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3BheW1lbnRfc3RhdHVzX2VkaXRfX2Jvb2tpbmdfaWQnICkudmFsKCBib29raW5nX2lkICk7XHJcblxyXG5cdC8vIElEIHRpdGxlLlxyXG5cdGpRdWVyeSggJy53cGJjX21vZGFsX19wYXltZW50X3N0YXR1c19lZGl0X19ib29raW5nX2lkJyApLmh0bWwoICdJRDogJyArIGJvb2tpbmdfaWQgKTtcclxuXHJcblx0Ly8gU2hvdyBNb2RhbC5cclxuXHRqUXVlcnkoICcjd3BiY19tb2RhbF9fcGF5bWVudF9zdGF0dXNfZWRpdF9fc2VjdGlvbicgKS53cGJjX215X21vZGFsKCAnc2hvdycgKTtcclxuXHJcblx0Ly8gU2V0IGZvY3VzIHRvIGlucHV0LlxyXG5cdGpRdWVyeSggJyN3cGJjX21vZGFsX19wYXltZW50X3N0YXR1c19lZGl0X192YWx1ZScgKS50cmlnZ2VyKCAnZm9jdXMnICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTZW5kIHBheW1lbnQgcmVxdWVzdFxyXG4gKlxyXG4gKiBAcGFyYW0gYm9va2luZ19pZFxyXG4gKiBAcGFyYW0gdmlzaXRvcmJvb2tpbmdwYXl1cmxcclxuICogQHBhcmFtIGNvc3RcclxuICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19jbGlja19fc2VuZF9wYXltZW50X3JlcXVlc3QoIGJvb2tpbmdfaWQsIHZpc2l0b3Jib29raW5ncGF5dXJsLCBjb3N0ICl7XHJcblxyXG5cdGlmICggISB3cGJjX2lzX21vZGFsX2FjY2Vzc2libGUoICcjd3BiY19tb2RhbF9fc2VuZF9wYXltZW50X3JlcXVlc3RfX3NlY3Rpb24nICkgKSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHQvLyBTZXQgYm9va2luZyBjb3N0LlxyXG5cdGpRdWVyeSggJyN3cGJjX21vZGFsX19zZW5kX3BheW1lbnRfcmVxdWVzdF9fdXJsJyApLnZhbCggdmlzaXRvcmJvb2tpbmdwYXl1cmwgKTtcclxuXHJcblx0Ly8gU2V0IGJvb2tpbmcgSUQuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3NlbmRfcGF5bWVudF9yZXF1ZXN0X19ib29raW5nX2lkJyApLnZhbCggYm9va2luZ19pZCApO1xyXG5cclxuXHQvLyBJRCB0aXRsZS5cclxuXHRqUXVlcnkoICcud3BiY19tb2RhbF9fc2VuZF9wYXltZW50X3JlcXVlc3RfX2Jvb2tpbmdfaWQnICkuaHRtbCggJ0lEOiAnICsgYm9va2luZ19pZCApO1xyXG5cclxuXHQvLyBDb3N0LlxyXG5cdGpRdWVyeSggJy53cGJjX21vZGFsX19zZW5kX3BheW1lbnRfcmVxdWVzdF9fY29zdCcgKS5odG1sKCBjb3N0ICk7XHJcblxyXG5cdC8vIFNob3cgTW9kYWwuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3NlbmRfcGF5bWVudF9yZXF1ZXN0X19zZWN0aW9uJyApLndwYmNfbXlfbW9kYWwoICdzaG93JyApO1xyXG5cclxuXHQvLyBTZXQgZm9jdXMgdG8gaW5wdXQuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3NlbmRfcGF5bWVudF9yZXF1ZXN0X192YWx1ZScgKS50cmlnZ2VyKCAnZm9jdXMnICk7XHJcblxyXG59XHJcblxyXG4vKipcclxuICogU2F2ZSBOb3Rlc1xyXG4gKlxyXG4gKiBAcGFyYW0gYm9va2luZ19pZFxyXG4gKiBAcGFyYW0gbm90ZV90ZXh0XHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fY2xpY2tfX3NldF9ib29raW5nX25vdGUoIGJvb2tpbmdfaWQsIG5vdGVfdGV4dCApe1xyXG5cclxuXHRpZiAoICEgd3BiY19pc19tb2RhbF9hY2Nlc3NpYmxlKCAnI3dwYmNfbW9kYWxfX3NldF9ib29raW5nX25vdGVfX3NlY3Rpb24nICkgKSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHQvLyBTZXQgTm90ZS5cclxuXHRqUXVlcnkoICcjd3BiY19tb2RhbF9fc2V0X2Jvb2tpbmdfbm90ZV9fdmFsdWUnICkudmFsKCBub3RlX3RleHQgKTtcclxuXHJcblx0Ly8gU2V0IGJvb2tpbmcgSUQuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3NldF9ib29raW5nX25vdGVfX2Jvb2tpbmdfaWQnICkudmFsKCBib29raW5nX2lkICk7XHJcblxyXG5cdC8vIElEIHRpdGxlLlxyXG5cdGpRdWVyeSggJy53cGJjX21vZGFsX19zZXRfYm9va2luZ19ub3RlX19ib29raW5nX2lkJyApLmh0bWwoICdJRDogJyArIGJvb2tpbmdfaWQgKTtcclxuXHJcblx0Ly8gU2hvdyBNb2RhbC5cclxuXHRqUXVlcnkoICcjd3BiY19tb2RhbF9fc2V0X2Jvb2tpbmdfbm90ZV9fc2VjdGlvbicgKS53cGJjX215X21vZGFsKCAnc2hvdycgKTtcclxuXHJcblx0Ly8gU2V0IGZvY3VzIHRvIGlucHV0LiAvLyBqUXVlcnkoICcjd3BiY19tb2RhbF9fc2V0X2Jvb2tpbmdfbm90ZV9fdmFsdWUnICkudHJpZ2dlciggJ2ZvY3VzJyApOyAuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3NldF9ib29raW5nX25vdGVfX3ZhbHVlJyApLnNjcm9sbFRvcCggMCApO1xyXG5cclxufVxyXG5cclxuLyoqXHJcbiAqIENoYW5nZSBSZXNvdXJjZSBmb3IgQm9va2luZ1xyXG4gKlxyXG4gKiBAcGFyYW0gYm9va2luZ19pZFx0XHRcdC0gSUQgb2YgYm9va2luZy5cclxuICogQHBhcmFtIHJlc291cmNlX2lkICAgICAgICAgICAtIElEIG9mIGJvb2tpbmcgcmVzb3VyY2UuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb19saXN0aW5nX19jbGlja19fY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2UoIGJvb2tpbmdfaWQsIHJlc291cmNlX2lkICl7XHJcblxyXG5cdGlmICggISB3cGJjX2lzX21vZGFsX2FjY2Vzc2libGUoICcjd3BiY19tb2RhbF9fY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2VfX3NlY3Rpb24nICkgKSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHQvLyBTZWxlY3QgYm9va2luZyByZXNvdXJjZSAgdGhhdCBiZWxvbmcgdG8gIGJvb2tpbmcuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2NoYW5nZV9ib29raW5nX3Jlc291cmNlX19yZXNvdXJjZV9pZCcgKS52YWwoIHJlc291cmNlX2lkICkudHJpZ2dlciggJ2NoYW5nZScgKTtcclxuXHJcblx0Ly8gU2V0IGJvb2tpbmcgSUQuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2NoYW5nZV9ib29raW5nX3Jlc291cmNlX19ib29raW5nX2lkJyApLnZhbCggYm9va2luZ19pZCApO1xyXG5cdC8vIElEIHRpdGxlLlxyXG5cdGpRdWVyeSggJy53cGJjX21vZGFsX19jaGFuZ2VfYm9va2luZ19yZXNvdXJjZV9fYm9va2luZ19pZCcgKS5odG1sKCAnSUQ6ICcgKyBib29raW5nX2lkICk7XHJcblxyXG5cdC8vIFNob3cgTW9kYWwuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2NoYW5nZV9ib29raW5nX3Jlc291cmNlX19zZWN0aW9uJyApLndwYmNfbXlfbW9kYWwoICdzaG93JyApO1xyXG5cclxuXHQvLyBTZXQgZm9jdXMgdG8gaW5wdXQuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2NoYW5nZV9ib29raW5nX3Jlc291cmNlX19yZXNvdXJjZV9pZCcgKS5mb2N1cygpO1xyXG59XHJcblxyXG4vKipcclxuICogU2V0IHVuYXZhaWxhYmxlIHRpbWVzIGZvciBib29raW5nIHJlc291cmNlIGFuZCBkYXRlcy5cclxuICpcclxuICogQHBhcmFtIGJvb2tpbmdfaWQgICAgSUQgb2YgYm9va2luZy5cclxuICogQHBhcmFtIHJlc291cmNlX2lkICAgSUQgb2YgYm9va2luZyByZXNvdXJjZS5cclxuICogQHBhcmFtIGRhdGVfc3RhcnQgICAgQm9va2luZyBzdGFydCBkYXRlLlxyXG4gKiBAcGFyYW0gZGF0ZV9lbmQgICAgICBCb29raW5nIGVuZCBkYXRlLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fY2xpY2tfX3NldF91bmF2YWlsYWJsZV90aW1lcyggYm9va2luZ19pZCwgcmVzb3VyY2VfaWQsIGRhdGVfc3RhcnQsIGRhdGVfZW5kICl7XHJcblxyXG5cdGlmICggISB3cGJjX2lzX21vZGFsX2FjY2Vzc2libGUoICcjd3BiY19tb2RhbF9fc2V0X3VuYXZhaWxhYmxlX3RpbWVzX19zZWN0aW9uJyApICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0dmFyICRtb2RhbCA9IGpRdWVyeSggJyN3cGJjX21vZGFsX19zZXRfdW5hdmFpbGFibGVfdGltZXNfX3NlY3Rpb24nICk7XHJcblx0dmFyICRwYWdlID0gJG1vZGFsLmZpbmQoICcud3BiY190c19wYWdlJyApLmZpcnN0KCk7XHJcblxyXG5cdGlmICggYm9va2luZ19pZCApIHtcclxuXHRcdGpRdWVyeSggJy53cGJjX21vZGFsX19zZXRfdW5hdmFpbGFibGVfdGltZXNfX2Jvb2tpbmdfaWQnICkuaHRtbCggJ0lEOiAnICsgYm9va2luZ19pZCApO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRqUXVlcnkoICcud3BiY19tb2RhbF9fc2V0X3VuYXZhaWxhYmxlX3RpbWVzX19ib29raW5nX2lkJyApLmh0bWwoICcnICk7XHJcblx0fVxyXG5cclxuXHQkbW9kYWwud3BiY19teV9tb2RhbCggJ3Nob3cnICk7XHJcblxyXG5cdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX2F2YWlsYWJpbGl0eV90aW1lc2xvdHNfaW5pdCApIHtcclxuXHRcdHdpbmRvdy53cGJjX2F2YWlsYWJpbGl0eV90aW1lc2xvdHNfaW5pdCggJHBhZ2UgKTtcclxuXHR9XHJcblxyXG5cdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX2F2YWlsYWJpbGl0eV90aW1lc2xvdHNfc2V0X2NvbnRleHQgKSB7XHJcblx0XHR3aW5kb3cud3BiY19hdmFpbGFiaWxpdHlfdGltZXNsb3RzX3NldF9jb250ZXh0KFxyXG5cdFx0XHQkcGFnZSxcclxuXHRcdFx0e1xyXG5cdFx0XHRcdHJlc291cmNlX2lkOiByZXNvdXJjZV9pZCxcclxuXHRcdFx0XHRkYXRlX3N0YXJ0OiBkYXRlX3N0YXJ0LFxyXG5cdFx0XHRcdGRhdGVfZW5kOiBkYXRlX2VuZFxyXG5cdFx0XHR9XHJcblx0XHQpO1xyXG5cdH1cclxufVxyXG5cclxuLyoqXHJcbiAqIER1cGxpY2F0ZSBCb29raW5nIGludG8gYW5vdGhlciByZXNvdXJjZS5cclxuICpcclxuICogQHBhcmFtIGJvb2tpbmdfaWRcdFx0XHQtIElEIG9mIGJvb2tpbmcuXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZCAgICAgICAgICAgLSBJRCBvZiBib29raW5nIHJlc291cmNlLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fY2xpY2tfX2R1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlKCBib29raW5nX2lkLCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRpZiAoICEgd3BiY19pc19tb2RhbF9hY2Nlc3NpYmxlKCAnI3dwYmNfbW9kYWxfX2R1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlX19zZWN0aW9uJyApICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0Ly8gU2VsZWN0IGJvb2tpbmcgcmVzb3VyY2UgIHRoYXQgYmVsb25nIHRvICBib29raW5nLlxyXG5cdGpRdWVyeSggJyN3cGJjX21vZGFsX19kdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZV9fcmVzb3VyY2VfaWQnICkudmFsKCByZXNvdXJjZV9pZCApLnRyaWdnZXIoICdjaGFuZ2UnICk7XHJcblxyXG5cdC8vIFNldCBib29raW5nIElELlxyXG5cdGpRdWVyeSggJyN3cGJjX21vZGFsX19kdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZV9fYm9va2luZ19pZCcgKS52YWwoIGJvb2tpbmdfaWQgKTtcclxuXHQvLyBJRCB0aXRsZS5cclxuXHRqUXVlcnkoICcud3BiY19tb2RhbF9fZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2VfX2Jvb2tpbmdfaWQnICkuaHRtbCggJ0lEOiAnICsgYm9va2luZ19pZCApO1xyXG5cclxuXHQvLyBTaG93IE1vZGFsLlxyXG5cdGpRdWVyeSggJyN3cGJjX21vZGFsX19kdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZV9fc2VjdGlvbicgKS53cGJjX215X21vZGFsKCAnc2hvdycgKTtcclxuXHJcblx0Ly8gU2V0IGZvY3VzIHRvIGlucHV0LlxyXG5cdGpRdWVyeSggJyN3cGJjX21vZGFsX19kdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZV9fcmVzb3VyY2VfaWQnICkuZm9jdXMoKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENoYW5nZSBMb2NhbGUgb2YgQm9va2luZy5cclxuICpcclxuICogQHBhcmFtIGJvb2tpbmdfaWRcdFx0XHQtIElEIG9mIGJvb2tpbmcuXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZCAgICAgICAgICAgLSBJRCBvZiBib29raW5nIHJlc291cmNlLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fY2xpY2tfX3NldF9ib29raW5nX2xvY2FsZSggYm9va2luZ19pZCwgc2VsZWN0ZWRfbG9jYWxlX3ZhbHVlICl7XHJcblxyXG5cdGlmICggISB3cGJjX2lzX21vZGFsX2FjY2Vzc2libGUoICcjd3BiY19tb2RhbF9fc2V0X2Jvb2tpbmdfbG9jYWxlX19zZWN0aW9uJyApICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0Ly8gU2VsZWN0IGJvb2tpbmcgTG9jYWxlICB0aGF0IGJlbG9uZyB0byAgYm9va2luZy5cclxuXHRqUXVlcnkoICcjd3BiY19tb2RhbF9fc2V0X2Jvb2tpbmdfbG9jYWxlJyApLnZhbCggc2VsZWN0ZWRfbG9jYWxlX3ZhbHVlICkudHJpZ2dlciggJ2NoYW5nZScgKTtcclxuXHJcblx0Ly8gdmFyIGpTZWxlY3QgPSBqUXVlcnkoICcjc2V0X2Jvb2tpbmdfbG9jYWxlX19yZXNvdXJjZV9zZWxlY3QnICk7XHJcblx0Ly8galNlbGVjdC5maW5kKCAnb3B0aW9uW3ZhbHVlPVwiJyArIHJlc291cmNlX2lkICsgJ1wiXScgKS5wcm9wKCAnc2VsZWN0ZWQnLCB0cnVlICk7XHRcdC8vIE90aGVyd2lzZSBrbm93biBwYXltZW50IHN0YXR1cy5cclxuXHJcblx0Ly8gU2V0IGJvb2tpbmcgSUQuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3NldF9ib29raW5nX2xvY2FsZV9fYm9va2luZ19pZCcgKS52YWwoIGJvb2tpbmdfaWQgKTtcclxuXHQvLyBJRCB0aXRsZS5cclxuXHRqUXVlcnkoICcud3BiY19tb2RhbF9fc2V0X2Jvb2tpbmdfbG9jYWxlX19ib29raW5nX2lkJyApLmh0bWwoICdJRDogJyArIGJvb2tpbmdfaWQgKTtcclxuXHJcblx0Ly8gU2hvdyBNb2RhbC5cclxuXHRqUXVlcnkoICcjd3BiY19tb2RhbF9fc2V0X2Jvb2tpbmdfbG9jYWxlX19zZWN0aW9uJyApLndwYmNfbXlfbW9kYWwoICdzaG93JyApO1xyXG5cclxuXHQvLyBTZXQgZm9jdXMgdG8gaW5wdXQuXHJcblx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3NldF9ib29raW5nX2xvY2FsZScgKS5mb2N1cygpO1xyXG59XHJcblxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vID09IEZpbHRlciBUb29sYmFyID09XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vKipcclxuICogPT0gXCJTb3J0IEJ5XCIgQnV0dG9uID09XHJcbiAqIFRoaXMgZnVuY3Rpb24gdXBkYXRlIFRpdGxlIGluIERyb3Bkb3duIG1lbnUuXHJcbiAqIEl0IGV4ZWN1dGVkLCBhZnRlciByZWNldmluZyBBamF4IHJlc3BvbnNlLlxyXG4gKiBBbmQgYmFzZWQgb24gcGFyYW1ldGVycyBvZiB0aGlzIHJlc3BvbnNlLCB3ZSBnZXQgb3B0aW9uIHRpdGxlIGZyb20gZHJvcGRvd24gbGlzdCBvcHRpb25zIGFuZCBzaG93IGl0IGluIHRvZ2dsZSB0aXRsZS5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX2luaXRfaG9va19fc29ydF9ieSgpIHtcclxuXHJcblx0dmFyIGVsX2lkID0gJ3doX3NvcnQnO1xyXG5cclxuXHR2YXIgcGFyYW1ldGVyX3ZhbHVlID0gd3BiY19hanhfYm9va2luZ19saXN0aW5nLnNlYXJjaF9nZXRfcGFyYW0oIGVsX2lkICk7XHJcblxyXG5cdHZhciBqX29wdGlvbl9saW5rID0galF1ZXJ5KCAnLnVsX2Ryb3Bkb3duX21lbnVfbGlfXycgKyBlbF9pZCArICdfXycgKyBwYXJhbWV0ZXJfdmFsdWUgKTtcclxuXHRpZiAoIGpfb3B0aW9uX2xpbmsubGVuZ3RoICkge1xyXG5cdFx0alF1ZXJ5KCAnLnVsX2Ryb3Bkb3duX21lbnVfXycgKyBlbF9pZCArICcgLnVsX2Ryb3Bkb3duX21lbnVfdG9nZ2xlIC5zZWxlY3RlZF92YWx1ZScgKS5odG1sKCBqX29wdGlvbl9saW5rLmh0bWwoKSApO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRqUXVlcnkoICcudWxfZHJvcGRvd25fbWVudV9fJyArIGVsX2lkICsgJyAudWxfZHJvcGRvd25fbWVudV90b2dnbGUgLnNlbGVjdGVkX3ZhbHVlJyApLmh0bWwoICctLS0nICk7XHJcblx0fVxyXG59XHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLy8gPT0gTGlzdGluZyBIZWFkZXIgVGFibGUgPT1cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8qKlxyXG4gKiA9PSBcIkV4cGFuZCBBbGwgUm93c1wiIEJ1dHRvbiA9PVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29fbGlzdGluZ19fY2xpY2tfX2V4cGFuZF9hbGxfcm93cygpIHtcclxuXHRqUXVlcnkoICcud3BiY19yb3dfd3JhcCcgKS5yZW1vdmVDbGFzcyggJ21heF9oZWlnaHRfYScgKTtcclxuXHRqUXVlcnkoICcud3BiY19yb3dfd3JhcCAud3BiY19pY25fZXhwYW5kX2xlc3MnICkuc2hvdygpO1xyXG5cdGpRdWVyeSggJy53cGJjX3Jvd193cmFwIC53cGJjX2ljbl9leHBhbmRfbW9yZScgKS5oaWRlKCk7XHJcblx0alF1ZXJ5KCAnLndwYmNfYnRuX2V4cGFuZF9jb2xhcHNlX2FsbCcgKS50b2dnbGUoKTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiA9PSBcIkNvbHBhc2UgQWxsIFJvd3NcIiBCdXR0b24gPT1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19jb2xhcHNlX2FsbF9yb3dzKCkge1xyXG5cdGpRdWVyeSggJy53cGJjX3Jvd193cmFwJyApLmFkZENsYXNzKCAnbWF4X2hlaWdodF9hJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3Jvd193cmFwIC53cGJjX2ljbl9leHBhbmRfbGVzcycgKS5oaWRlKCk7XHJcblx0alF1ZXJ5KCAnLndwYmNfcm93X3dyYXAgLndwYmNfaWNuX2V4cGFuZF9tb3JlJyApLnNob3coKTtcclxuXHRqUXVlcnkoICcud3BiY19idG5fZXhwYW5kX2NvbGFwc2VfYWxsJyApLnRvZ2dsZSgpO1xyXG59XHJcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0Esd0JBQXdCQSxDQUFFQyxPQUFPLEVBQUc7RUFDNUMsSUFBSyxVQUFVLEtBQUssT0FBUUMsTUFBTSxDQUFFRCxPQUFRLENBQUMsQ0FBQ0UsYUFBYyxFQUFHO0lBQzlEQyxLQUFLLENBQUUsaUhBQWtILENBQUM7SUFDMUgsT0FBTyxLQUFLO0VBQ2I7RUFDQSxPQUFPLElBQUk7QUFDWjs7QUFHQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0MsbURBQW1EQSxDQUFFQyxVQUFVLEVBQUVDLFdBQVcsRUFBRUMsWUFBWSxFQUFFQyxZQUFZLEVBQUU7RUFFbEgsSUFBSyxDQUFFRCxZQUFZLEVBQUc7SUFDckIsT0FBTyxLQUFLO0VBQ2I7RUFFQSxPQUFPRSwwQ0FBMEMsQ0FBRTtJQUNsREMsSUFBSSxFQUFXLE1BQU07SUFDckJMLFVBQVUsRUFBS0EsVUFBVSxJQUFJLEVBQUU7SUFDL0JDLFdBQVcsRUFBSUEsV0FBVyxJQUFJLEVBQUU7SUFDaENDLFlBQVksRUFBR0EsWUFBWSxJQUFJLEVBQUU7SUFDakNDLFlBQVksRUFBR0EsWUFBWSxJQUFJO0VBQ2hDLENBQUUsQ0FBQztBQUNKOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNHLGlEQUFpREEsQ0FBRUMsS0FBSyxFQUFFQyxJQUFJLEVBQUU7RUFFeEUsSUFBSUMsS0FBSyxHQUFNYixNQUFNLENBQUUsU0FBVSxD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
