"use strict";

/**
 * Neutral Booking Form publishing modal controller.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */
(function ($, window, document) {
  'use strict';

  var last_trigger = null;
  var pages_request = null;

  /**
   * Return localized publishing configuration.
   *
   * @return {Object} Publishing configuration.
   */
  function get_config() {
    return window.wpbc_publish_booking_form_vars || {};
  }

  /**
   * Normalize a localized WordPress flag to a strict boolean.
   *
   * wp_localize_script() serializes scalar configuration values as strings,
   * so the disabled value arrives as "0", which is otherwise truthy in
   * JavaScript.
   *
   * @param {*} flag_value Localized flag value.
   *
   * @return {boolean} True only for an explicitly enabled flag.
   */
  function is_true_flag(flag_value) {
    return true === flag_value || 1 === flag_value || '1' === flag_value || 'true' === String(flag_value).toLowerCase();
  }

  /**
   * Return the native publishing modal.
   *
   * @return {jQuery} Modal element.
   */
  function get_modal() {
    return $(get_config().modal_selector || '#wpbc_publish_booking_form__modal');
  }

  /**
   * Escape plain text before inserting it into status markup.
   *
   * @param {string} message Plain text.
   *
   * @return {string} Escaped text.
   */
  function escape_html(message) {
    return $('<div>').text(String(message || '')).html();
  }

  /**
   * Extract a sanitized Booking Form name from a shortcode.
   *
   * @param {string} shortcode_raw Raw Booking shortcode.
   *
   * @return {string} Sanitized form name.
   */
  function get_form_name(shortcode_raw) {
    var match = String(shortcode_raw || '').match(/\bform_type\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+))/i);
    var form_name = match ? match[1] || match[2] || match[3] || '' : '';
    form_name = String(form_name).toLowerCase().replace(/[^a-z0-9_-]/g, '');
    return form_name || 'standard';
  }

  /**
   * Reset the modal to its initial chooser state.
   *
   * @return {void}
   */
  function reset_modal() {
    var $modal = get_modal();
    var $page_list = $modal.find('[data-wpbc-publish-booking-form-page-list]');
    if (pages_request && 'function' === typeof pages_request.abort) {
      pages_request.abort();
    }
    pages_request = null;
    $modal.find('.wpbc_publish_booking_form__notice').empty();
    $modal.find('.wpbc_publish_booking_form__panel').hide();
    $modal.find('.wpbc_publish_booking_form__result_actions').hide();
    $modal.find('[data-wpbc-publish-booking-form-open-page], [data-wpbc-publish-booking-form-edit-page]').hide().attr('href', '#');
    $modal.find('.wpbc_publish_booking_form__chooser').show();
    $modal.find('.modal-footer').hide();
    $page_list.find('option:not(:first)').remove();
    $page_list.val('0').prop('disabled', true);
    $modal.find('#wpbc_publish_booking_form_page_title').val('');
    set_busy(false);
  }

  /**
   * Toggle all publishing controls while a request is active.
   *
   * @param {boolean} is_busy Whether publishing is active.
   *
   * @return {void}
   */
  function set_busy(is_busy) {
    get_modal().find('[data-wpbc-publish-booking-form-mode], [data-wpbc-publish-booking-form-submit], [data-wpbc-publish-booking-form-back]').prop('disabled', Boolean(is_busy)).attr('aria-disabled', is_busy ? 'true' : 'false');
  }

  /**
   * Render a plain error inside the native modal.
   *
   * @param {string} message Error message.
   *
   * @return {void}
   */
  function show_error(message) {
    get_modal().find('.wpbc_publish_booking_form__notice').html('<div class="wpbc-settings-notice notice-error">' + escape_html(message) + '</div>');
  }

  /**
   * Show the Booking Calendar mini spinner and loading label.
   *
   * @return {void}
   */
  function show_loading(loading_message) {
    var i18n = get_config().i18n || {};
    get_modal().find('.wpbc_publish_booking_form__notice').html('<div class="wpbc_spins_loading_container wpbc_publish_booking_form__loading" role="status">' + '<div class="wpbc_booking_form_spin_loader" aria-hidden="true"><div class="wpbc_spins_loader_wrapper"><div class="wpbc_one_spin_loader_mini2"></div></div></div>' + '<span>' + escape_html(loading_message || i18n.loading || 'Publishing booking form') + '...</span>' + '</div>');
  }

  /**
   * Load the editable WordPress pages through the authorized endpoint.
   *
   * Page titles are intentionally absent from the initial catalog markup. The
   * live-demo guard runs before this request on the client and again before the
   * page query on the server.
   *
   * @return {void}
   */
  function load_publishable_pages() {
    var config = get_config();
    var i18n = config.i18n || {};
    var $modal = get_modal();
    var $page_list = $modal.find('[data-wpbc-publish-booking-form-page-list]');
    if (is_true_flag(config.is_demo)) {
      show_error(i18n.demo_error || 'In the demo versions this operation is not allowed.');
      return;
    }
    set_busy(true);
    show_loading(i18n.loading_pages || 'Loading pages');
    pages_request = $.ajax({
      url: config.ajax_url || window.ajaxurl || '',
      method: 'POST',
      dataType: 'json',
      data: {
        action: config.pages_action || 'WPBC_AJX_GET_PUBLISHABLE_PAGES',
        nonce: config.nonce || ''
      }
    }).done(function (response) {
      var result = response && response.data ? response.data : {};
      var pages = $.isArray(result.pages) ? result.pages : [];
      if (!response || !response.success) {
        show_error(result.message || i18n.generic_error || 'Unable to load pages.');
        return;
      }
      $page_list.find('option:not(:first)').remove();
      $.each(pages, function (index, page) {
        $('<option>').val(parseInt(page.id, 10) || 0).text(String(page.title || '')).appendTo($page_list);
      });
      $modal.find('.wpbc_publish_booking_form__notice').empty();
      $page_list.prop('disabled', !pages.length);
      if (pages.length) {
        $page_list.trigger('focus');
      } else {
        show_error(i18n.no_pages || 'No editable pages are available.');
      }
    }).fail(function (xhr, request_status) {
      var response = xhr && xhr.responseJSON ? xhr.responseJSON : {};
      var result = response && response.data ? response.data : {};
      if ('abort' !== request_status) {
        show_error(result.message || i18n.generic_error || 'Unable to load pages.');
      }
    }).always(function () {
      pages_request = null;
      set_busy(false);
    });
  }

  /**
   * Open one create or edit panel.
   *
   * @param {string} publish_mode Create or edit.
   *
   * @return {void}
   */
  function open_mode(publish_mode) {
    var $modal = get_modal();
    var $panel;
    if ('create' !== publish_mode && 'edit' !== publish_mode) {
      return;
    }
    $modal.find('.wpbc_publish_booking_form__notice').empty();
    $modal.find('.wpbc_publish_booking_form__chooser, .wpbc_publish_booking_form__panel, .wpbc_publish_booking_form__result_actions').hide();
    $panel = $modal.find('.wpbc_publish_booking_form__panel--' + publish_mode).show();
    $modal.find('.modal-footer').show();
    if ('edit' === publish_mode) {
      load_publishable_pages();
    } else {
      $panel.find('select, input, button').filter(':visible').first().trigger('focus');
    }
  }

  /**
   * Return the chooser without closing the modal.
   *
   * @return {void}
   */
  function go_back() {
    reset_modal();
    get_modal().find('[data-wpbc-publish-booking-form-mode="edit"]').trigger('focus');
  }

  /**
   * Publish the current Resource shortcode through the neutral endpoint.
   *
   * @param {string} publish_mode Create or edit.
   *
   * @return {void}
   */
  function submit_publish(publish_mode) {
    var config = get_config();
    var i18n = config.i18n || {};
    var $modal = get_modal();
    var request_data = {
      action: config.action || 'WPBC_AJX_PUBLISH_BOOKING_FORM',
      nonce: config.nonce || '',
      publish_mode: publish_mode,
      resource_id: $modal.find('[data-wpbc-publish-booking-form-resource-id]').val() || 0,
      form_name: $modal.find('[data-wpbc-publish-booking-form-form-name]').val() || 'standard',
      shortcode_raw: $modal.find('[data-wpbc-publish-booking-form-shortcode]').val() || '',
      page_id: $modal.find('#wpbc_publish_booking_form_page_id').val() || 0,
      page_title: $modal.find('#wpbc_publish_booking_form_page_title').val() || ''
    };
    if (is_true_flag(config.is_demo)) {
      show_error(i18n.demo_error || 'In the demo versions this operation is not allowed.');
      return;
    }
    if ('edit' === publish_mode && !parseInt(request_data.page_id, 10)) {
      show_error(i18n.select_page || 'Please select an existing page.');
      return;
    }
    if ('create' === publish_mode && !$.trim(request_data.page_title)) {
      show_error(i18n.enter_page_title || 'Please enter a page title.');
      return;
    }
    set_busy(true);
    show_loading(i18n.loading || 'Publishing booking form');
    $.ajax({
      url: config.ajax_url || window.ajaxurl || '',
      method: 'POST',
      dataType: 'json',
      data: request_data
    }).done(function (response) {
      var result = response && response.data ? response.data : {};
      if (!response || !response.success) {
        show_error(result.message || i18n.generic_error || 'Unable to publish the booking form.');
        return;
      }
      $modal.find('.wpbc_publish_booking_form__notice').html('<div class="wpbc-settings-notice notice-success">' + (result.message || '') + '</div>');
      $modal.find('.wpbc_publish_booking_form__chooser, .wpbc_publish_booking_form__panel').hide();
      $modal.find('.modal-footer').hide();
      if (result.view_url) {
        $modal.find('[data-wpbc-publish-booking-form-open-page]').attr('href', result.view_url).show();
      }
      if (result.edit_url) {
        $modal.find('[data-wpbc-publish-booking-form-edit-page]').attr('href', result.edit_url).show();
      }
      $modal.find('.wpbc_publish_booking_form__result_actions').show().find('a:visible').first().trigger('focus');
    }).fail(function (xhr) {
      var response = xhr && xhr.responseJSON ? xhr.responseJSON : {};
      var result = response && response.data ? response.data : {};
      show_error(result.message || i18n.generic_error || 'Unable to publish the booking form.');
    }).always(function () {
      set_busy(false);
    });
  }

  /**
   * Open the neutral publishing modal for one Booking Resource.
   *
   * @param {number|string} resource_id   Booking Resource ID.
   * @param {string}        shortcode_raw Raw Booking shortcode.
   * @param {HTMLElement}   trigger       Optional opening control.
   *
   * @return {void}
   */
  function open_modal(resource_id, shortcode_raw, trigger) {
    var config = get_config();
    var i18n = config.i18n || {};
    var $modal = get_modal();
    if (!$modal.length || 'function' !== typeof $modal.wpbc_my_modal) {
      window.alert(i18n.generic_error || 'Publishing dialog is not available.');
      return;
    }
    last_trigger = trigger && document.contains(trigger) ? trigger : document.activeElement;
    reset_modal();
    $modal.find('[data-wpbc-publish-booking-form-resource-id]').val(parseInt(resource_id, 10) || 0);
    $modal.find('[data-wpbc-publish-booking-form-form-name]').val(get_form_name(shortcode_raw));
    $modal.find('[data-wpbc-publish-booking-form-shortcode]').val(String(shortcode_raw || ''));
    $modal.off('hidden.wpbc.modal.wpbcPublishBookingForm hidden.bs.modal.wpbcPublishBookingForm').one('hidden.wpbc.modal.wpbcPublishBookingForm hidden.bs.modal.wpbcPublishBookingForm', function () {
      if (last_trigger && document.contains(last_trigger)) {
        last_trigger.focus();
      }
      last_trigger = null;
    });
    $modal.wpbc_my_modal('show');
    window.setTimeout(function () {
      $modal.find('[data-wpbc-publish-booking-form-mode="edit"]').trigger('focus');
    }, 0);
  }
  $(document).on('click', '[data-wpbc-publish-booking-form-mode]', function () {
    open_mode($(this).attr('data-wpbc-publish-booking-form-mode') || '');
  });
  $(document).on('click', '[data-wpbc-publish-booking-form-submit]', function () {
    submit_publish($(this).attr('data-wpbc-publish-booking-form-submit') || '');
  });
  $(document).on('click', '[data-wpbc-publish-booking-form-back]', function () {
    go_back();
  });
  window.wpbc_publish_booking_form__open = open_modal;
})(jQuery, window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcHVibGlzaC9fb3V0L3dwYmMtcHVibGlzaC1ib29raW5nLWZvcm0uanMiLCJuYW1lcyI6WyIkIiwid2luZG93IiwiZG9jdW1lbnQiLCJsYXN0X3RyaWdnZXIiLCJwYWdlc19yZXF1ZXN0IiwiZ2V0X2NvbmZpZyIsIndwYmNfcHVibGlzaF9ib29raW5nX2Zvcm1fdmFycyIsImlzX3RydWVfZmxhZyIsImZsYWdfdmFsdWUiLCJTdHJpbmciLCJ0b0xvd2VyQ2FzZSIsImdldF9tb2RhbCIsIm1vZGFsX3NlbGVjdG9yIiwiZXNjYXBlX2h0bWwiLCJtZXNzYWdlIiwidGV4dCIsImh0bWwiLCJnZXRfZm9ybV9uYW1lIiwic2hvcnRjb2RlX3JhdyIsIm1hdGNoIiwiZm9ybV9uYW1lIiwicmVwbGFjZSIsInJlc2V0X21vZGFsIiwiJG1vZGFsIiwiJHBhZ2VfbGlzdCIsImZpbmQiLCJhYm9ydCIsImVtcHR5IiwiaGlkZSIsImF0dHIiLCJzaG93IiwicmVtb3ZlIiwidmFsIiwicHJvcCIsInNldF9idXN5IiwiaXNfYnVzeSIsIkJvb2xlYW4iLCJzaG93X2Vycm9yIiwic2hvd19sb2FkaW5nIiwibG9hZGluZ19tZXNzYWdlIiwiaTE4biIsImxvYWRpbmciLCJsb2FkX3B1Ymxpc2hhYmxlX3BhZ2VzIiwiY29uZmlnIiwiaXNfZGVtbyIsImRlbW9fZXJyb3IiLCJsb2FkaW5nX3BhZ2VzIiwiYWpheCIsInVybCIsImFqYXhfdXJsIiwiYWpheHVybCIsIm1ldGhvZCIsImRhdGFUeXBlIiwiZGF0YSIsImFjdGlvbiIsInBhZ2VzX2FjdGlvbiIsIm5vbmNlIiwiZG9uZSIsInJlc3BvbnNlIiwicmVzdWx0IiwicGFnZXMiLCJpc0FycmF5Iiwic3VjY2VzcyIsImdlbmVyaWNfZXJyb3IiLCJlYWNoIiwiaW5kZXgiLCJwYWdlIiwicGFyc2VJbnQiLCJpZCIsInRpdGxlIiwiYXBwZW5kVG8iLCJsZW5ndGgiLCJ0cmlnZ2VyIiwibm9fcGFnZXMiLCJmYWlsIiwieGhyIiwicmVxdWVzdF9zdGF0dXMiLCJyZXNwb25zZUpTT04iLCJhbHdheXMiLCJvcGVuX21vZGUiLCJwdWJsaXNoX21vZGUiLCIkcGFuZWwiLCJmaWx0ZXIiLCJmaXJzdCIsImdvX2JhY2siLCJzdWJtaXRfcHVibGlzaCIsInJlcXVlc3RfZGF0YSIsInJlc291cmNlX2lkIiwicGFnZV9pZCIsInBhZ2VfdGl0bGUiLCJzZWxlY3RfcGFnZSIsInRyaW0iLCJlbnRlcl9wYWdlX3RpdGxlIiwidmlld191cmwiLCJlZGl0X3VybCIsIm9wZW5fbW9kYWwiLCJ3cGJjX215X21vZGFsIiwiYWxlcnQiLCJjb250YWlucyIsImFjdGl2ZUVsZW1lbnQiLCJvZmYiLCJvbmUiLCJmb2N1cyIsInNldFRpbWVvdXQiLCJvbiIsIndwYmNfcHVibGlzaF9ib29raW5nX2Zvcm1fX29wZW4iLCJqUXVlcnkiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wdWJsaXNoL19zcmMvd3BiYy1wdWJsaXNoLWJvb2tpbmctZm9ybS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIE5ldXRyYWwgQm9va2luZyBGb3JtIHB1Ymxpc2hpbmcgbW9kYWwgY29udHJvbGxlci5cbiAqXG4gKiBAcGFja2FnZSBCb29raW5nIENhbGVuZGFyXG4gKiBAc2luY2UgICAxMS42LjBcbiAqL1xuKCBmdW5jdGlvbiggJCwgd2luZG93LCBkb2N1bWVudCApIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdHZhciBsYXN0X3RyaWdnZXIgPSBudWxsO1xuXHR2YXIgcGFnZXNfcmVxdWVzdCA9IG51bGw7XG5cblx0LyoqXG5cdCAqIFJldHVybiBsb2NhbGl6ZWQgcHVibGlzaGluZyBjb25maWd1cmF0aW9uLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IFB1Ymxpc2hpbmcgY29uZmlndXJhdGlvbi5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9jb25maWcoKSB7XG5cdFx0cmV0dXJuIHdpbmRvdy53cGJjX3B1Ymxpc2hfYm9va2luZ19mb3JtX3ZhcnMgfHwge307XG5cdH1cblxuXHQvKipcblx0ICogTm9ybWFsaXplIGEgbG9jYWxpemVkIFdvcmRQcmVzcyBmbGFnIHRvIGEgc3RyaWN0IGJvb2xlYW4uXG5cdCAqXG5cdCAqIHdwX2xvY2FsaXplX3NjcmlwdCgpIHNlcmlhbGl6ZXMgc2NhbGFyIGNvbmZpZ3VyYXRpb24gdmFsdWVzIGFzIHN0cmluZ3MsXG5cdCAqIHNvIHRoZSBkaXNhYmxlZCB2YWx1ZSBhcnJpdmVzIGFzIFwiMFwiLCB3aGljaCBpcyBvdGhlcndpc2UgdHJ1dGh5IGluXG5cdCAqIEphdmFTY3JpcHQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gZmxhZ192YWx1ZSBMb2NhbGl6ZWQgZmxhZyB2YWx1ZS5cblx0ICpcblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSBvbmx5IGZvciBhbiBleHBsaWNpdGx5IGVuYWJsZWQgZmxhZy5cblx0ICovXG5cdGZ1bmN0aW9uIGlzX3RydWVfZmxhZyggZmxhZ192YWx1ZSApIHtcblx0XHRyZXR1cm4gdHJ1ZSA9PT0gZmxhZ192YWx1ZSB8fCAxID09PSBmbGFnX3ZhbHVlIHx8ICcxJyA9PT0gZmxhZ192YWx1ZSB8fCAndHJ1ZScgPT09IFN0cmluZyggZmxhZ192YWx1ZSApLnRvTG93ZXJDYXNlKCk7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIHRoZSBuYXRpdmUgcHVibGlzaGluZyBtb2RhbC5cblx0ICpcblx0ICogQHJldHVybiB7alF1ZXJ5fSBNb2RhbCBlbGVtZW50LlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X21vZGFsKCkge1xuXHRcdHJldHVybiAkKCBnZXRfY29uZmlnKCkubW9kYWxfc2VsZWN0b3IgfHwgJyN3cGJjX3B1Ymxpc2hfYm9va2luZ19mb3JtX19tb2RhbCcgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBFc2NhcGUgcGxhaW4gdGV4dCBiZWZvcmUgaW5zZXJ0aW5nIGl0IGludG8gc3RhdHVzIG1hcmt1cC5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgUGxhaW4gdGV4dC5cblx0ICpcblx0ICogQHJldHVybiB7c3RyaW5nfSBFc2NhcGVkIHRleHQuXG5cdCAqL1xuXHRmdW5jdGlvbiBlc2NhcGVfaHRtbCggbWVzc2FnZSApIHtcblx0XHRyZXR1cm4gJCggJzxkaXY+JyApLnRleHQoIFN0cmluZyggbWVzc2FnZSB8fCAnJyApICkuaHRtbCgpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEV4dHJhY3QgYSBzYW5pdGl6ZWQgQm9va2luZyBGb3JtIG5hbWUgZnJvbSBhIHNob3J0Y29kZS5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IHNob3J0Y29kZV9yYXcgUmF3IEJvb2tpbmcgc2hvcnRjb2RlLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IFNhbml0aXplZCBmb3JtIG5hbWUuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfZm9ybV9uYW1lKCBzaG9ydGNvZGVfcmF3ICkge1xuXHRcdHZhciBtYXRjaCA9IFN0cmluZyggc2hvcnRjb2RlX3JhdyB8fCAnJyApLm1hdGNoKCAvXFxiZm9ybV90eXBlXFxzKj1cXHMqKD86XCIoW15cIl0qKVwifCcoW14nXSopJ3woW15cXHNcXF1dKykpL2kgKTtcblx0XHR2YXIgZm9ybV9uYW1lID0gbWF0Y2ggPyAoIG1hdGNoWyAxIF0gfHwgbWF0Y2hbIDIgXSB8fCBtYXRjaFsgMyBdIHx8ICcnICkgOiAnJztcblxuXHRcdGZvcm1fbmFtZSA9IFN0cmluZyggZm9ybV9uYW1lICkudG9Mb3dlckNhc2UoKS5yZXBsYWNlKCAvW15hLXowLTlfLV0vZywgJycgKTtcblxuXHRcdHJldHVybiBmb3JtX25hbWUgfHwgJ3N0YW5kYXJkJztcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXNldCB0aGUgbW9kYWwgdG8gaXRzIGluaXRpYWwgY2hvb3NlciBzdGF0ZS5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHJlc2V0X21vZGFsKCkge1xuXHRcdHZhciAkbW9kYWwgPSBnZXRfbW9kYWwoKTtcblx0XHR2YXIgJHBhZ2VfbGlzdCA9ICRtb2RhbC5maW5kKCAnW2RhdGEtd3BiYy1wdWJsaXNoLWJvb2tpbmctZm9ybS1wYWdlLWxpc3RdJyApO1xuXG5cdFx0aWYgKCBwYWdlc19yZXF1ZXN0ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBwYWdlc19yZXF1ZXN0LmFib3J0ICkge1xuXHRcdFx0cGFnZXNfcmVxdWVzdC5hYm9ydCgpO1xuXHRcdH1cblx0XHRwYWdlc19yZXF1ZXN0ID0gbnVsbDtcblxuXHRcdCRtb2RhbC5maW5kKCAnLndwYmNfcHVibGlzaF9ib29raW5nX2Zvcm1fX25vdGljZScgKS5lbXB0eSgpO1xuXHRcdCRtb2RhbC5maW5kKCAnLndwYmNfcHVibGlzaF9ib29raW5nX2Zvcm1fX3BhbmVsJyApLmhpZGUoKTtcblx0XHQkbW9kYWwuZmluZCggJy53cGJjX3B1Ymxpc2hfYm9va2luZ19mb3JtX19yZXN1bHRfYWN0aW9ucycgKS5oaWRlKCk7XG5cdFx0JG1vZGFsLmZpbmQoICdbZGF0YS13cGJjLXB1Ymxpc2gtYm9va2luZy1mb3JtLW9wZW4tcGFnZV0sIFtkYXRhLXdwYmMtcHVibGlzaC1ib29raW5nLWZvcm0tZWRpdC1wYWdlXScgKS5oaWRlKCkuYXR0ciggJ2hyZWYnLCAnIycgKTtcblx0XHQkbW9kYWwuZmluZCggJy53cGJjX3B1Ymxpc2hfYm9va2luZ19mb3JtX19jaG9vc2VyJyApLnNob3coKTtcblx0XHQkbW9kYWwuZmluZCggJy5tb2RhbC1mb290ZXInICkuaGlkZSgpO1xuXHRcdCRwYWdlX2xpc3QuZmluZCggJ29wdGlvbjpub3QoOmZpcnN0KScgKS5yZW1vdmUoKTtcblx0XHQkcGFnZV9saXN0LnZhbCggJzAnICkucHJvcCggJ2Rpc2FibGVkJywgdHJ1ZSApO1xuXHRcdCRtb2RhbC5maW5kKCAnI3dwYmNfcHVibGlzaF9ib29raW5nX2Zvcm1fcGFnZV90aXRsZScgKS52YWwoICcnICk7XG5cdFx0c2V0X2J1c3koIGZhbHNlICk7XG5cdH1cblxuXHQvKipcblx0ICogVG9nZ2xlIGFsbCBwdWJsaXNoaW5nIGNvbnRyb2xzIHdoaWxlIGEgcmVxdWVzdCBpcyBhY3RpdmUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfYnVzeSBXaGV0aGVyIHB1Ymxpc2hpbmcgaXMgYWN0aXZlLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc2V0X2J1c3koIGlzX2J1c3kgKSB7XG5cdFx0Z2V0X21vZGFsKCkuZmluZCggJ1tkYXRhLXdwYmMtcHVibGlzaC1ib29raW5nLWZvcm0tbW9kZV0sIFtkYXRhLXdwYmMtcHVibGlzaC1ib29raW5nLWZvcm0tc3VibWl0XSwgW2RhdGEtd3BiYy1wdWJsaXNoLWJvb2tpbmctZm9ybS1iYWNrXScgKVxuXHRcdFx0LnByb3AoICdkaXNhYmxlZCcsIEJvb2xlYW4oIGlzX2J1c3kgKSApXG5cdFx0XHQuYXR0ciggJ2FyaWEtZGlzYWJsZWQnLCBpc19idXN5ID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlbmRlciBhIHBsYWluIGVycm9yIGluc2lkZSB0aGUgbmF0aXZlIG1vZGFsLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSBFcnJvciBtZXNzYWdlLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc2hvd19lcnJvciggbWVzc2FnZSApIHtcblx0XHRnZXRfbW9kYWwoKS5maW5kKCAnLndwYmNfcHVibGlzaF9ib29raW5nX2Zvcm1fX25vdGljZScgKS5odG1sKFxuXHRcdFx0JzxkaXYgY2xhc3M9XCJ3cGJjLXNldHRpbmdzLW5vdGljZSBub3RpY2UtZXJyb3JcIj4nICsgZXNjYXBlX2h0bWwoIG1lc3NhZ2UgKSArICc8L2Rpdj4nXG5cdFx0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTaG93IHRoZSBCb29raW5nIENhbGVuZGFyIG1pbmkgc3Bpbm5lciBhbmQgbG9hZGluZyBsYWJlbC5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHNob3dfbG9hZGluZyggbG9hZGluZ19tZXNzYWdlICkge1xuXHRcdHZhciBpMThuID0gZ2V0X2NvbmZpZygpLmkxOG4gfHwge307XG5cblx0XHRnZXRfbW9kYWwoKS5maW5kKCAnLndwYmNfcHVibGlzaF9ib29raW5nX2Zvcm1fX25vdGljZScgKS5odG1sKFxuXHRcdFx0JzxkaXYgY2xhc3M9XCJ3cGJjX3NwaW5zX2xvYWRpbmdfY29udGFpbmVyIHdwYmNfcHVibGlzaF9ib29raW5nX2Zvcm1fX2xvYWRpbmdcIiByb2xlPVwic3RhdHVzXCI+JyArXG5cdFx0XHRcdCc8ZGl2IGNsYXNzPVwid3BiY19ib29raW5nX2Zvcm1fc3Bpbl9sb2FkZXJcIiBhcmlhLWhpZGRlbj1cInRydWVcIj48ZGl2IGNsYXNzPVwid3BiY19zcGluc19sb2FkZXJfd3JhcHBlclwiPjxkaXYgY2xhc3M9XCJ3cGJjX29uZV9zcGluX2xvYWRlcl9taW5pMlwiPjwvZGl2PjwvZGl2PjwvZGl2PicgK1xuXHRcdFx0XHQnPHNwYW4+JyArIGVzY2FwZV9odG1sKCBsb2FkaW5nX21lc3NhZ2UgfHwgaTE4bi5sb2FkaW5nIHx8ICdQdWJsaXNoaW5nIGJvb2tpbmcgZm9ybScgKSArICcuLi48L3NwYW4+JyArXG5cdFx0XHQnPC9kaXY+J1xuXHRcdCk7XG5cdH1cblxuXHQvKipcblx0ICogTG9hZCB0aGUgZWRpdGFibGUgV29yZFByZXNzIHBhZ2VzIHRocm91Z2ggdGhlIGF1dGhvcml6ZWQgZW5kcG9pbnQuXG5cdCAqXG5cdCAqIFBhZ2UgdGl0bGVzIGFyZSBpbnRlbnRpb25hbGx5IGFic2VudCBmcm9tIHRoZSBpbml0aWFsIGNhdGFsb2cgbWFya3VwLiBUaGVcblx0ICogbGl2ZS1kZW1vIGd1YXJkIHJ1bnMgYmVmb3JlIHRoaXMgcmVxdWVzdCBvbiB0aGUgY2xpZW50IGFuZCBhZ2FpbiBiZWZvcmUgdGhlXG5cdCAqIHBhZ2UgcXVlcnkgb24gdGhlIHNlcnZlci5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGxvYWRfcHVibGlzaGFibGVfcGFnZXMoKSB7XG5cdFx0dmFyIGNvbmZpZyA9IGdldF9jb25maWcoKTtcblx0XHR2YXIgaTE4biA9IGNvbmZpZy5pMThuIHx8IHt9O1xuXHRcdHZhciAkbW9kYWwgPSBnZXRfbW9kYWwoKTtcblx0XHR2YXIgJHBhZ2VfbGlzdCA9ICRtb2RhbC5maW5kKCAnW2RhdGEtd3BiYy1wdWJsaXNoLWJvb2tpbmctZm9ybS1wYWdlLWxpc3RdJyApO1xuXG5cdFx0aWYgKCBpc190cnVlX2ZsYWcoIGNvbmZpZy5pc19kZW1vICkgKSB7XG5cdFx0XHRzaG93X2Vycm9yKCBpMThuLmRlbW9fZXJyb3IgfHwgJ0luIHRoZSBkZW1vIHZlcnNpb25zIHRoaXMgb3BlcmF0aW9uIGlzIG5vdCBhbGxvd2VkLicgKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRzZXRfYnVzeSggdHJ1ZSApO1xuXHRcdHNob3dfbG9hZGluZyggaTE4bi5sb2FkaW5nX3BhZ2VzIHx8ICdMb2FkaW5nIHBhZ2VzJyApO1xuXG5cdFx0cGFnZXNfcmVxdWVzdCA9ICQuYWpheChcblx0XHRcdHtcblx0XHRcdFx0dXJsOiBjb25maWcuYWpheF91cmwgfHwgd2luZG93LmFqYXh1cmwgfHwgJycsXG5cdFx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0XHRkYXRhVHlwZTogJ2pzb24nLFxuXHRcdFx0XHRkYXRhOiB7XG5cdFx0XHRcdFx0YWN0aW9uOiBjb25maWcucGFnZXNfYWN0aW9uIHx8ICdXUEJDX0FKWF9HRVRfUFVCTElTSEFCTEVfUEFHRVMnLFxuXHRcdFx0XHRcdG5vbmNlOiBjb25maWcubm9uY2UgfHwgJydcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdCkuZG9uZShcblx0XHRcdGZ1bmN0aW9uKCByZXNwb25zZSApIHtcblx0XHRcdFx0dmFyIHJlc3VsdCA9IHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgPyByZXNwb25zZS5kYXRhIDoge307XG5cdFx0XHRcdHZhciBwYWdlcyA9ICQuaXNBcnJheSggcmVzdWx0LnBhZ2VzICkgPyByZXN1bHQucGFnZXMgOiBbXTtcblxuXHRcdFx0XHRpZiAoICEgcmVzcG9uc2UgfHwgISByZXNwb25zZS5zdWNjZXNzICkge1xuXHRcdFx0XHRcdHNob3dfZXJyb3IoIHJlc3VsdC5tZXNzYWdlIHx8IGkxOG4uZ2VuZXJpY19lcnJvciB8fCAnVW5hYmxlIHRvIGxvYWQgcGFnZXMuJyApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdCRwYWdlX2xpc3QuZmluZCggJ29wdGlvbjpub3QoOmZpcnN0KScgKS5yZW1vdmUoKTtcblx0XHRcdFx0JC5lYWNoKFxuXHRcdFx0XHRcdHBhZ2VzLFxuXHRcdFx0XHRcdGZ1bmN0aW9uKCBpbmRleCwgcGFnZSApIHtcblx0XHRcdFx0XHRcdCQoICc8b3B0aW9uPicgKS52YWwoIHBhcnNlSW50KCBwYWdlLmlkLCAxMCApIHx8IDAgKS50ZXh0KCBTdHJpbmcoIHBhZ2UudGl0bGUgfHwgJycgKSApLmFwcGVuZFRvKCAkcGFnZV9saXN0ICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHQpO1xuXG5cdFx0XHRcdCRtb2RhbC5maW5kKCAnLndwYmNfcHVibGlzaF9ib29raW5nX2Zvcm1fX25vdGljZScgKS5lbXB0eSgpO1xuXHRcdFx0XHQkcGFnZV9saXN0LnByb3AoICdkaXNhYmxlZCcsICEgcGFnZXMubGVuZ3RoICk7XG5cdFx0XHRcdGlmICggcGFnZXMubGVuZ3RoICkge1xuXHRcdFx0XHRcdCRwYWdlX2xpc3QudHJpZ2dlciggJ2ZvY3VzJyApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHNob3dfZXJyb3IoIGkxOG4ubm9fcGFnZXMgfHwgJ05vIGVkaXRhYmxlIHBhZ2VzIGFyZSBhdmFpbGFibGUuJyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0KS5mYWlsKFxuXHRcdFx0ZnVuY3Rpb24oIHhociwgcmVxdWVzdF9zdGF0dXMgKSB7XG5cdFx0XHRcdHZhciByZXNwb25zZSA9IHhociAmJiB4aHIucmVzcG9uc2VKU09OID8geGhyLnJlc3BvbnNlSlNPTiA6IHt9O1xuXHRcdFx0XHR2YXIgcmVzdWx0ID0gcmVzcG9uc2UgJiYgcmVzcG9uc2UuZGF0YSA/IHJlc3BvbnNlLmRhdGEgOiB7fTtcblxuXHRcdFx0XHRpZiAoICdhYm9ydCcgIT09IHJlcXVlc3Rfc3RhdHVzICkge1xuXHRcdFx0XHRcdHNob3dfZXJyb3IoIHJlc3VsdC5tZXNzYWdlIHx8IGkxOG4uZ2VuZXJpY19lcnJvciB8fCAnVW5hYmxlIHRvIGxvYWQgcGFnZXMuJyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0KS5hbHdheXMoXG5cdFx0XHRmdW5jdGlvbigpIHtcblx0XHRcdFx0cGFnZXNfcmVxdWVzdCA9IG51bGw7XG5cdFx0XHRcdHNldF9idXN5KCBmYWxzZSApO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH1cblxuXHQvKipcblx0ICogT3BlbiBvbmUgY3JlYXRlIG9yIGVkaXQgcGFuZWwuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBwdWJsaXNoX21vZGUgQ3JlYXRlIG9yIGVkaXQuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBvcGVuX21vZGUoIHB1Ymxpc2hfbW9kZSApIHtcblx0XHR2YXIgJG1vZGFsID0gZ2V0X21vZGFsKCk7XG5cdFx0dmFyICRwYW5lbDtcblxuXHRcdGlmICggJ2NyZWF0ZScgIT09IHB1Ymxpc2hfbW9kZSAmJiAnZWRpdCcgIT09IHB1Ymxpc2hfbW9kZSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQkbW9kYWwuZmluZCggJy53cGJjX3B1Ymxpc2hfYm9va2luZ19mb3JtX19ub3RpY2UnICkuZW1wdHkoKTtcblx0XHQkbW9kYWwuZmluZCggJy53cGJjX3B1Ymxpc2hfYm9va2luZ19mb3JtX19jaG9vc2VyLCAud3BiY19wdWJsaXNoX2Jvb2tpbmdfZm9ybV9fcGFuZWwsIC53cGJjX3B1Ymxpc2hfYm9va2luZ19mb3JtX19yZXN1bHRfYWN0aW9ucycgKS5oaWRlKCk7XG5cdFx0JHBhbmVsID0gJG1vZGFsLmZpbmQoICcud3BiY19wdWJsaXNoX2Jvb2tpbmdfZm9ybV9fcGFuZWwtLScgKyBwdWJsaXNoX21vZGUgKS5zaG93KCk7XG5cdFx0JG1vZGFsLmZpbmQoICcubW9kYWwtZm9vdGVyJyApLnNob3coKTtcblx0XHRpZiAoICdlZGl0JyA9PT0gcHVibGlzaF9tb2RlICkge1xuXHRcdFx0bG9hZF9wdWJsaXNoYWJsZV9wYWdlcygpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQkcGFuZWwuZmluZCggJ3NlbGVjdCwgaW5wdXQsIGJ1dHRvbicgKS5maWx0ZXIoICc6dmlzaWJsZScgKS5maXJzdCgpLnRyaWdnZXIoICdmb2N1cycgKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIHRoZSBjaG9vc2VyIHdpdGhvdXQgY2xvc2luZyB0aGUgbW9kYWwuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBnb19iYWNrKCkge1xuXHRcdHJlc2V0X21vZGFsKCk7XG5cdFx0Z2V0X21vZGFsKCkuZmluZCggJ1tkYXRhLXdwYmMtcHVibGlzaC1ib29raW5nLWZvcm0tbW9kZT1cImVkaXRcIl0nICkudHJpZ2dlciggJ2ZvY3VzJyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFB1Ymxpc2ggdGhlIGN1cnJlbnQgUmVzb3VyY2Ugc2hvcnRjb2RlIHRocm91Z2ggdGhlIG5ldXRyYWwgZW5kcG9pbnQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBwdWJsaXNoX21vZGUgQ3JlYXRlIG9yIGVkaXQuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzdWJtaXRfcHVibGlzaCggcHVibGlzaF9tb2RlICkge1xuXHRcdHZhciBjb25maWcgPSBnZXRfY29uZmlnKCk7XG5cdFx0dmFyIGkxOG4gPSBjb25maWcuaTE4biB8fCB7fTtcblx0XHR2YXIgJG1vZGFsID0gZ2V0X21vZGFsKCk7XG5cdFx0dmFyIHJlcXVlc3RfZGF0YSA9IHtcblx0XHRcdGFjdGlvbjogY29uZmlnLmFjdGlvbiB8fCAnV1BCQ19BSlhfUFVCTElTSF9CT09LSU5HX0ZPUk0nLFxuXHRcdFx0bm9uY2U6IGNvbmZpZy5ub25jZSB8fCAnJyxcblx0XHRcdHB1Ymxpc2hfbW9kZTogcHVibGlzaF9tb2RlLFxuXHRcdFx0cmVzb3VyY2VfaWQ6ICRtb2RhbC5maW5kKCAnW2RhdGEtd3BiYy1wdWJsaXNoLWJvb2tpbmctZm9ybS1yZXNvdXJjZS1pZF0nICkudmFsKCkgfHwgMCxcblx0XHRcdGZvcm1fbmFtZTogJG1vZGFsLmZpbmQoICdbZGF0YS13cGJjLXB1Ymxpc2gtYm9va2luZy1mb3JtLWZvcm0tbmFtZV0nICkudmFsKCkgfHwgJ3N0YW5kYXJkJyxcblx0XHRcdHNob3J0Y29kZV9yYXc6ICRtb2RhbC5maW5kKCAnW2RhdGEtd3BiYy1wdWJsaXNoLWJvb2tpbmctZm9ybS1zaG9ydGNvZGVdJyApLnZhbCgpIHx8ICcnLFxuXHRcdFx0cGFnZV9pZDogJG1vZGFsLmZpbmQoICcjd3BiY19wdWJsaXNoX2Jvb2tpbmdfZm9ybV9wYWdlX2lkJyApLnZhbCgpIHx8IDAsXG5cdFx0XHRwYWdlX3RpdGxlOiAkbW9kYWwuZmluZCggJyN3cGJjX3B1Ymxpc2hfYm9va2luZ19mb3JtX3BhZ2VfdGl0bGUnICkudmFsKCkgfHwgJydcblx0XHR9O1xuXG5cdFx0aWYgKCBpc190cnVlX2ZsYWcoIGNvbmZpZy5pc19kZW1vICkgKSB7XG5cdFx0XHRzaG93X2Vycm9yKCBpMThuLmRlbW9fZXJyb3IgfHwgJ0luIHRoZSBkZW1vIHZlcnNpb25zIHRoaXMgb3BlcmF0aW9uIGlzIG5vdCBhbGxvd2VkLicgKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCAnZWRpdCcgPT09IHB1Ymxpc2hfbW9kZSAmJiAhIHBhcnNlSW50KCByZXF1ZXN0X2RhdGEucGFnZV9pZCwgMTAgKSApIHtcblx0XHRcdHNob3dfZXJyb3IoIGkxOG4uc2VsZWN0X3BhZ2UgfHwgJ1BsZWFzZSBzZWxlY3QgYW4gZXhpc3RpbmcgcGFnZS4nICk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICggJ2NyZWF0ZScgPT09IHB1Ymxpc2hfbW9kZSAmJiAhICQudHJpbSggcmVxdWVzdF9kYXRhLnBhZ2VfdGl0bGUgKSApIHtcblx0XHRcdHNob3dfZXJyb3IoIGkxOG4uZW50ZXJfcGFnZV90aXRsZSB8fCAnUGxlYXNlIGVudGVyIGEgcGFnZSB0aXRsZS4nICk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0c2V0X2J1c3koIHRydWUgKTtcblx0XHRzaG93X2xvYWRpbmcoIGkxOG4ubG9hZGluZyB8fCAnUHVibGlzaGluZyBib29raW5nIGZvcm0nICk7XG5cblx0XHQkLmFqYXgoXG5cdFx0XHR7XG5cdFx0XHRcdHVybDogY29uZmlnLmFqYXhfdXJsIHx8IHdpbmRvdy5hamF4dXJsIHx8ICcnLFxuXHRcdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdFx0ZGF0YVR5cGU6ICdqc29uJyxcblx0XHRcdFx0ZGF0YTogcmVxdWVzdF9kYXRhXG5cdFx0XHR9XG5cdFx0KS5kb25lKFxuXHRcdFx0ZnVuY3Rpb24oIHJlc3BvbnNlICkge1xuXHRcdFx0XHR2YXIgcmVzdWx0ID0gcmVzcG9uc2UgJiYgcmVzcG9uc2UuZGF0YSA/IHJlc3BvbnNlLmRhdGEgOiB7fTtcblxuXHRcdFx0XHRpZiAoICEgcmVzcG9uc2UgfHwgISByZXNwb25zZS5zdWNjZXNzICkge1xuXHRcdFx0XHRcdHNob3dfZXJyb3IoIHJlc3VsdC5tZXNzYWdlIHx8IGkxOG4uZ2VuZXJpY19lcnJvciB8fCAnVW5hYmxlIHRvIHB1Ymxpc2ggdGhlIGJvb2tpbmcgZm9ybS4nICk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0JG1vZGFsLmZpbmQoICcud3BiY19wdWJsaXNoX2Jvb2tpbmdfZm9ybV9fbm90aWNlJyApLmh0bWwoXG5cdFx0XHRcdFx0JzxkaXYgY2xhc3M9XCJ3cGJjLXNldHRpbmdzLW5vdGljZSBub3RpY2Utc3VjY2Vzc1wiPicgKyAoIHJlc3VsdC5tZXNzYWdlIHx8ICcnICkgKyAnPC9kaXY+J1xuXHRcdFx0XHQpO1xuXHRcdFx0XHQkbW9kYWwuZmluZCggJy53cGJjX3B1Ymxpc2hfYm9va2luZ19mb3JtX19jaG9vc2VyLCAud3BiY19wdWJsaXNoX2Jvb2tpbmdfZm9ybV9fcGFuZWwnICkuaGlkZSgpO1xuXHRcdFx0XHQkbW9kYWwuZmluZCggJy5tb2RhbC1mb290ZXInICkuaGlkZSgpO1xuXG5cdFx0XHRcdGlmICggcmVzdWx0LnZpZXdfdXJsICkge1xuXHRcdFx0XHRcdCRtb2RhbC5maW5kKCAnW2RhdGEtd3BiYy1wdWJsaXNoLWJvb2tpbmctZm9ybS1vcGVuLXBhZ2VdJyApLmF0dHIoICdocmVmJywgcmVzdWx0LnZpZXdfdXJsICkuc2hvdygpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggcmVzdWx0LmVkaXRfdXJsICkge1xuXHRcdFx0XHRcdCRtb2RhbC5maW5kKCAnW2RhdGEtd3BiYy1wdWJsaXNoLWJvb2tpbmctZm9ybS1lZGl0LXBhZ2VdJyApLmF0dHIoICdocmVmJywgcmVzdWx0LmVkaXRfdXJsICkuc2hvdygpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdCRtb2RhbC5maW5kKCAnLndwYmNfcHVibGlzaF9ib29raW5nX2Zvcm1fX3Jlc3VsdF9hY3Rpb25zJyApLnNob3coKS5maW5kKCAnYTp2aXNpYmxlJyApLmZpcnN0KCkudHJpZ2dlciggJ2ZvY3VzJyApO1xuXHRcdFx0fVxuXHRcdCkuZmFpbChcblx0XHRcdGZ1bmN0aW9uKCB4aHIgKSB7XG5cdFx0XHRcdHZhciByZXNwb25zZSA9IHhociAmJiB4aHIucmVzcG9uc2VKU09OID8geGhyLnJlc3BvbnNlSlNPTiA6IHt9O1xuXHRcdFx0XHR2YXIgcmVzdWx0ID0gcmVzcG9uc2UgJiYgcmVzcG9uc2UuZGF0YSA/IHJlc3BvbnNlLmRhdGEgOiB7fTtcblxuXHRcdFx0XHRzaG93X2Vycm9yKCByZXN1bHQubWVzc2FnZSB8fCBpMThuLmdlbmVyaWNfZXJyb3IgfHwgJ1VuYWJsZSB0byBwdWJsaXNoIHRoZSBib29raW5nIGZvcm0uJyApO1xuXHRcdFx0fVxuXHRcdCkuYWx3YXlzKFxuXHRcdFx0ZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHNldF9idXN5KCBmYWxzZSApO1xuXHRcdFx0fVxuXHRcdCk7XG5cdH1cblxuXHQvKipcblx0ICogT3BlbiB0aGUgbmV1dHJhbCBwdWJsaXNoaW5nIG1vZGFsIGZvciBvbmUgQm9va2luZyBSZXNvdXJjZS5cblx0ICpcblx0ICogQHBhcmFtIHtudW1iZXJ8c3RyaW5nfSByZXNvdXJjZV9pZCAgIEJvb2tpbmcgUmVzb3VyY2UgSUQuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgc2hvcnRjb2RlX3JhdyBSYXcgQm9va2luZyBzaG9ydGNvZGUuXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9ICAgdHJpZ2dlciAgICAgICBPcHRpb25hbCBvcGVuaW5nIGNvbnRyb2wuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBvcGVuX21vZGFsKCByZXNvdXJjZV9pZCwgc2hvcnRjb2RlX3JhdywgdHJpZ2dlciApIHtcblx0XHR2YXIgY29uZmlnID0gZ2V0X2NvbmZpZygpO1xuXHRcdHZhciBpMThuID0gY29uZmlnLmkxOG4gfHwge307XG5cdFx0dmFyICRtb2RhbCA9IGdldF9tb2RhbCgpO1xuXG5cdFx0aWYgKCAhICRtb2RhbC5sZW5ndGggfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mICRtb2RhbC53cGJjX215X21vZGFsICkge1xuXHRcdFx0d2luZG93LmFsZXJ0KCBpMThuLmdlbmVyaWNfZXJyb3IgfHwgJ1B1Ymxpc2hpbmcgZGlhbG9nIGlzIG5vdCBhdmFpbGFibGUuJyApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxhc3RfdHJpZ2dlciA9IHRyaWdnZXIgJiYgZG9jdW1lbnQuY29udGFpbnMoIHRyaWdnZXIgKSA/IHRyaWdnZXIgOiBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuXHRcdHJlc2V0X21vZGFsKCk7XG5cdFx0JG1vZGFsLmZpbmQoICdbZGF0YS13cGJjLXB1Ymxpc2gtYm9va2luZy1mb3JtLXJlc291cmNlLWlkXScgKS52YWwoIHBhcnNlSW50KCByZXNvdXJjZV9pZCwgMTAgKSB8fCAwICk7XG5cdFx0JG1vZGFsLmZpbmQoICdbZGF0YS13cGJjLXB1Ymxpc2gtYm9va2luZy1mb3JtLWZvcm0tbmFtZV0nICkudmFsKCBnZXRfZm9ybV9uYW1lKCBzaG9ydGNvZGVfcmF3ICkgKTtcblx0XHQkbW9kYWwuZmluZCggJ1tkYXRhLXdwYmMtcHVibGlzaC1ib29raW5nLWZvcm0tc2hvcnRjb2RlXScgKS52YWwoIFN0cmluZyggc2hvcnRjb2RlX3JhdyB8fCAnJyApICk7XG5cblx0XHQkbW9kYWwub2ZmKCAnaGlkZGVuLndwYmMubW9kYWwud3BiY1B1Ymxpc2hCb29raW5nRm9ybSBoaWRkZW4uYnMubW9kYWwud3BiY1B1Ymxpc2hCb29raW5nRm9ybScgKVxuXHRcdFx0Lm9uZShcblx0XHRcdFx0J2hpZGRlbi53cGJjLm1vZGFsLndwYmNQdWJsaXNoQm9va2luZ0Zvcm0gaGlkZGVuLmJzLm1vZGFsLndwYmNQdWJsaXNoQm9va2luZ0Zvcm0nLFxuXHRcdFx0XHRmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRpZiAoIGxhc3RfdHJpZ2dlciAmJiBkb2N1bWVudC5jb250YWlucyggbGFzdF90cmlnZ2VyICkgKSB7XG5cdFx0XHRcdFx0XHRsYXN0X3RyaWdnZXIuZm9jdXMoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bGFzdF90cmlnZ2VyID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0KTtcblxuXHRcdCRtb2RhbC53cGJjX215X21vZGFsKCAnc2hvdycgKTtcblx0XHR3aW5kb3cuc2V0VGltZW91dChcblx0XHRcdGZ1bmN0aW9uKCkge1xuXHRcdFx0XHQkbW9kYWwuZmluZCggJ1tkYXRhLXdwYmMtcHVibGlzaC1ib29raW5nLWZvcm0tbW9kZT1cImVkaXRcIl0nICkudHJpZ2dlciggJ2ZvY3VzJyApO1xuXHRcdFx0fSxcblx0XHRcdDBcblx0XHQpO1xuXHR9XG5cblx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJ1tkYXRhLXdwYmMtcHVibGlzaC1ib29raW5nLWZvcm0tbW9kZV0nLCBmdW5jdGlvbigpIHtcblx0XHRvcGVuX21vZGUoICQoIHRoaXMgKS5hdHRyKCAnZGF0YS13cGJjLXB1Ymxpc2gtYm9va2luZy1mb3JtLW1vZGUnICkgfHwgJycgKTtcblx0fSApO1xuXHQkKCBkb2N1bWVudCApLm9uKCAnY2xpY2snLCAnW2RhdGEtd3BiYy1wdWJsaXNoLWJvb2tpbmctZm9ybS1zdWJtaXRdJywgZnVuY3Rpb24oKSB7XG5cdFx0c3VibWl0X3B1Ymxpc2goICQoIHRoaXMgKS5hdHRyKCAnZGF0YS13cGJjLXB1Ymxpc2gtYm9va2luZy1mb3JtLXN1Ym1pdCcgKSB8fCAnJyApO1xuXHR9ICk7XG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICdbZGF0YS13cGJjLXB1Ymxpc2gtYm9va2luZy1mb3JtLWJhY2tdJywgZnVuY3Rpb24oKSB7XG5cdFx0Z29fYmFjaygpO1xuXHR9ICk7XG5cblx0d2luZG93LndwYmNfcHVibGlzaF9ib29raW5nX2Zvcm1fX29wZW4gPSBvcGVuX21vZGFsO1xufSggalF1ZXJ5LCB3aW5kb3csIGRvY3VtZW50ICkgKTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDRSxXQUFVQSxDQUFDLEVBQUVDLE1BQU0sRUFBRUMsUUFBUSxFQUFHO0VBQ2pDLFlBQVk7O0VBRVosSUFBSUMsWUFBWSxHQUFHLElBQUk7RUFDdkIsSUFBSUMsYUFBYSxHQUFHLElBQUk7O0VBRXhCO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTQyxVQUFVQSxDQUFBLEVBQUc7SUFDckIsT0FBT0osTUFBTSxDQUFDSyw4QkFBOEIsSUFBSSxDQUFDLENBQUM7RUFDbkQ7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7QUFDQTtB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
