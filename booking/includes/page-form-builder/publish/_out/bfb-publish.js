"use strict";

/**
 * BFB Publish modal controller.
 *
 * Responsibilities:
 * - Open Publish modal from toolbar button.
 * - Support legacy inline call: wpbc_modal_dialog__show__resource_publish( resource_id ).
 * - Keep shortcode in sync with current form name.
 * - Ask user to save current form before publishing.
 * - Publish shortcode into existing/new page via AJAX.
 * - Show success/error message without page reload.
 *
 * @package     Booking Calendar
 * @subpackage  Booking Form Builder
 * @since       11.0.0
 * @file        ../includes/page-form-builder/publish/_out/bfb-publish.js
 */
(function ($, window, document) {
  'use strict';

  var publish_api = {
    /**
     * Init module.
     *
     * @return void
     */
    init: function () {
      this.bind_events();
      this.bind_form_ajax_loaded_events();
      this.register_global_helpers();
      this.refresh_publish_button_shortcodes(this.get_current_form_name());
    },
    /**
     * Get localized vars.
     *
     * @return {Object}
     */
    get_vars: function () {
      return window.wpbc_bfb_publish_vars || {};
    },
    /**
     * Get i18n vars.
     *
     * @return {Object}
     */
    get_i18n: function () {
      var vars = this.get_vars();
      return vars.i18n || {};
    },
    /**
     * Get modal jQuery object.
     *
     * @return {jQuery}
     */
    get_modal: function () {
      var vars = this.get_vars();
      var selector = vars.modal_selector || '#wpbc_bfb_modal__publish';
      return $(selector);
    },
    /**
     * Sanitize form name similar to WP sanitize_key().
     *
     * @param {string} form_name Form name.
     *
     * @return {string}
     */
    sanitize_form_name: function (form_name) {
      form_name = String(form_name || '').toLowerCase();
      form_name = form_name.replace(/[^a-z0-9_-]/g, '');
      if (!form_name) {
        form_name = this.get_vars().default_form_name || 'standard';
      }
      return form_name;
    },
    /**
     * Normalize resource ID.
     *
     * @param {number|string} resource_id Resource ID.
     *
     * @return {number}
     */
    normalize_resource_id: function (resource_id) {
      resource_id = parseInt(resource_id, 10);
      if (!resource_id || resource_id < 1) {
        resource_id = parseInt(this.get_vars().default_resource_id || 1, 10);
      }
      if (!resource_id || resource_id < 1) {
        resource_id = 1;
      }
      return resource_id;
    },
    /**
     * Get current BFB form name.
     *
     * @return {string}
     */
    get_current_form_name: function () {
      var vars = this.get_vars();
      var form_name = '';
      if (window.WPBC_BFB_Ajax && window.WPBC_BFB_Ajax.form_name) {
        form_name = window.WPBC_BFB_Ajax.form_name;
      }
      if (!form_name && vars.default_form_name) {
        form_name = vars.default_form_name;
      }
      return this.sanitize_form_name(form_name || 'standard');
    },
    /**
     * Build default shortcode raw.
     *
     * @param {number|string} resource_id Resource ID.
     * @param {string}        form_name   Form name.
     *
     * @return {string}
     */
    build_default_shortcode_raw: function (resource_id, form_name) {
      resource_id = this.normalize_resource_id(resource_id);
      form_name = this.sanitize_form_name(form_name);
      return "[booking resource_id=" + resource_id + " form_type='" + form_name + "']";
    },
    /**
     * Upsert one shortcode attribute.
     *
     * @param {string} shortcode_raw Shortcode.
     * @param {string} attr_name     Attribute name.
     * @param {string} attr_value    Attribute value.
     * @param {string} quote_char    Quote char.
     *
     * @return {string}
     */
    upsert_shortcode_attr: function (shortcode_raw, attr_name, attr_value, quote_char) {
      var escaped_attr_name, pattern, replacement_value, replacement;
      shortcode_raw = trim_string(shortcode_raw);
      attr_name = String(attr_name || '');
      attr_value = String(attr_value || '');
      quote_char = String(quote_char || '');
      if (!attr_name) {
        return shortcode_raw;
      }
      replacement_value = attr_value;
      if (quote_char) {
        replacement_value = quote_char + attr_value + quote_char;
      }
      replacement = attr_name + '=' + replacement_value;
      escaped_attr_name = attr_name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      pattern = new RegExp("\\b" + escaped_attr_name + "\\s*=\\s*(?:\"[^\"]*\"|'[^']*'|[^\\s\\]]+)", 'i');
      if (pattern.test(shortcode_raw)) {
        return shortcode_raw.replace(pattern, replacement);
      }
      if (/\]$/.test(shortcode_raw)) {
        return shortcode_raw.replace(/\]$/, ' ' + replacement + ']');
      }
      return shortcode_raw + ' ' + replacement;
    },
    /**
     * Normalize shortcode to current resource + form type.
     *
     * @param {string}        shortcode_raw Shortcode.
     * @param {number|string} resource_id   Resource ID.
     * @param {string}        form_name     Form name.
     *
     * @return {string}
     */
    normalize_shortcode_raw: function (shortcode_raw, resource_id, form_name) {
      resource_id = this.normalize_resource_id(resource_id);
      form_name = this.sanitize_form_name(form_name);
      shortcode_raw = trim_string(shortcode_raw);
      if (!shortcode_raw || 0 !== shortcode_raw.indexOf('[booking')) {
        return this.build_default_shortcode_raw(resource_id, form_name);
      }
      shortcode_raw = this.upsert_shortcode_attr(shortcode_raw, 'resource_id', String(resource_id), '');
      shortcode_raw = this.upsert_shortcode_attr(shortcode_raw, 'form_type', form_name, '\'');
      return trim_string(shortcode_raw);
    },
    /**
     * Refresh toolbar button shortcode attributes.
     *
     * @param {string} form_name Form name.
     *
     * @return void
     */
    refresh_publish_button_shortcodes: function (form_name) {
      var self = this;
      var vars = this.get_vars();
      var $buttons = $('[data-wpbc-bfb-top-publish-btn="1"]');
      form_name = this.sanitize_form_name(form_name);
      $buttons.each(function () {
        var $button = $(this);
        var resource_id = self.normalize_resource_id($button.attr('data-wpbc-bfb-resource-id') || vars.default_resource_id || 1);
        var shortcode_raw = $button.attr('data-wpbc-bfb-shortcode-raw') || vars.default_shortcode_raw || '';
        shortcode_raw = self.normalize_shortcode_raw(shortcode_raw, resource_id, form_name);
        $button.attr('data-wpbc-bfb-shortcode-raw', shortcode_raw);
        $button.attr('data-wpbc-bfb-form-name', form_name);
      });
    },
    /**
     * Keep publish shortcode in sync after AJAX form load.
     *
     * @return void
     */
    bind_form_ajax_loaded_events: function () {
      var self = this;
      if (window.__wpbc_bfb_publish__form_ajax_loaded_bound === '1') {
        return;
      }
      window.__wpbc_bfb_publish__form_ajax_loaded_bound = '1';
      document.addEventListener('wpbc:bfb:form:ajax_loaded', function (ev) {
        var detail = ev && ev.detail ? ev.detail : {};
        var form_name = self.sanitize_form_name(detail.form_name || self.get_current_form_name());
        var $modal = self.get_modal();
        var resource_id, shortcode_raw;
        window.WPBC_BFB_Ajax = window.WPBC_BFB_Ajax || {};
        window.WPBC_BFB_Ajax.form_name = form_name;
        self.refresh_publish_button_shortcodes(form_name);
        if ($modal.length) {
          resource_id = $modal.find('#wpbc_bfb_publish__resource_id').val() || self.get_vars().default_resource_id || 1;
          shortcode_raw = $modal.find('#wpbc_bfb_publish__shortcode_raw').val() || self.get_vars().default_shortcode_raw || '';
          $modal.find('#wpbc_bfb_publish__form_name').val(form_name);
          $modal.find('#wpbc_bfb_publish__shortcode_raw').val(self.normalize_shortcode_raw(shortcode_raw, resource_id, form_name));
        }
      }, {
        passive: true
      });
    },
    /**
     * Bind DOM events.
     *
     * @return void
     */
    bind_events: function () {
      var self = this;
      $(document).on('click', '[data-wpbc-bfb-top-publish-btn="1"]', function (event) {
        self.open_from_button(event, $(this));
      });
      $(document).on('click', '[data-wpbc-bfb-publish-save-step="save"]', function (event) {
        self.start_save_and_continue(event, $(this));
      });
      $(document).on('click', '[data-wpbc-bfb-publish-save-step="skip"]', function (event) {
        event.preventDefault();
        self.show_chooser_step();
      });
      $(document).on('click', '[data-wpbc-bfb-publish-mode]', function (event) {
        self.open_mode_panel(event, $(this).attr('data-wpbc-bfb-publish-mode'));
      });
      $(document).on('click', '[data-wpbc-bfb-publish-submit]', function (event) {
        self.submit_publish(event, $(this).attr('data-wpbc-bfb-publish-submit'));
      });
      $(document).on('click', '[data-wpbc-bfb-publish-back="1"]', function (event) {
        self.go_back(event);
      });
    },
    /**
     * Register global helpers for backward compatibility.
     *
     * @return void
     */
    register_global_helpers: function () {
      var self = this;
      window.wpbc_bfb_publish__open = function (resource_id, shortcode_raw) {
        self.open_modal(resource_id, shortcode_raw);
      };
      window.wpbc_modal_dialog__show__resource_publish = function (resource_id) {
        self.open_modal(resource_id, '');
      };
    },
    /**
     * Reset modal to default state.
     *
     * @return void
     */
    reset_modal: function () {
      var $modal = this.get_modal();
      if (!$modal.length) {
        return;
      }
      $modal.find('.wpbc_bfb_publish__notice').html('');
      $modal.find('.wpbc_bfb_publish__save_step').hide();
      $modal.find('.wpbc_bfb_publish__chooser').hide();
      $modal.find('.wpbc_bfb_publish__panel').hide();
      $modal.find('.modal-footer').hide();
      $modal.find('.wpbc_bfb_publish__result_actions').hide();
      $modal.find('[data-wpbc-bfb-publish-open-page="1"]').hide().attr('href', '#');
      $modal.find('[data-wpbc-bfb-publish-edit-page="1"]').hide().attr('href', '#');
    },
    /**
     * Show initial save step.
     *
     * @return void
     */
    show_save_step: function () {
      var $modal = this.get_modal();
      if (!$modal.length) {
        return;
      }
      $modal.find('.wpbc_bfb_publish__chooser').hide();
      $modal.find('.wpbc_bfb_publish__panel').hide();
      $modal.find('.wpbc_bfb_publish__result_actions').hide();
      $modal.find('.wpbc_bfb_publish__save_step').show();
      $modal.find('.modal-footer').hide();
    },
    /**
     * Show chooser step.
     *
     * @return void
     */
    show_chooser_step: function () {
      var $modal = this.get_modal();
      if (!$modal.length) {
        return;
      }
      $modal.find('.wpbc_bfb_publish__notice').html('');
      $modal.find('.wpbc_bfb_publish__save_step').hide();
      $modal.find('.wpbc_bfb_publish__panel').hide();
      $modal.find('.wpbc_bfb_publish__result_actions').hide();
      $modal.find('.wpbc_bfb_publish__chooser').show();
      $modal.find('.modal-footer').show();
    },
    /**
     * Open modal from toolbar button.
     *
     * @param {Object} event   Click event.
     * @param {jQuery} $button Button.
     *
     * @return void
     */
    open_from_button: function (event, $button) {
      var vars = this.get_vars();
      var resource_id;
      var shortcode_raw;
      var form_name;
      event.preventDefault();
      resource_id = $button.attr('data-wpbc-bfb-resource-id') || vars.default_resource_id || 1;
      form_name = this.get_current_form_name();
      shortcode_raw = $button.attr('data-wpbc-bfb-shortcode-raw') || vars.default_shortcode_raw || '';
      shortcode_raw = this.normalize_shortcode_raw(shortcode_raw, resource_id, form_name);
      $button.attr('data-wpbc-bfb-shortcode-raw', shortcode_raw);
      $button.attr('data-wpbc-bfb-form-name', form_name);
      this.open_modal(resource_id, shortcode_raw);
    },
    /**
     * Open modal.
     *
     * @param {number|string} resource_id  Resource ID.
     * @param {string}        shortcode_raw Shortcode.
     *
     * @return void
     */
    open_modal: function (resource_id, shortcode_raw) {
      var $modal = this.get_modal();
      var vars = this.get_vars();
      var form_name;
      if (!$modal.length) {
        return;
      }
      resource_id = this.normalize_resource_id(resource_id || vars.default_resource_id || 1);
      form_name = this.get_current_form_name();
      shortcode_raw = this.normalize_shortcode_raw(shortcode_raw || vars.default_shortcode_raw || '', resource_id, form_name);
      this.reset_modal();
      $modal.find('#wpbc_bfb_publish__resource_id').val(resource_id);
      $modal.find('#wpbc_bfb_publish__form_name').val(form_name);
      $modal.find('#wpbc_bfb_publish__shortcode_raw').val(shortcode_raw);
      $modal.find('#wpbc_bfb_publish_page_title').val('');
      $modal.find('#wpbc_bfb_publish_page_id').val('0');
      if (typeof $modal.wpbc_my_modal === 'function') {
        $modal.wpbc_my_modal('show');
      } else {
        $modal.show();
      }
      if (parseInt(vars.is_demo || 0, 10) !== 1) {
        this.show_save_step();
      }
    },
    /**
     * Open selected mode panel.
     *
     * @param {Object} event Click event.
     * @param {string} mode  Mode.
     *
     * @return void
     */
    open_mode_panel: function (event, mode) {
      var $modal = this.get_modal();
      event.preventDefault();
      if (!$modal.length) {
        return;
      }
      $modal.find('.wpbc_bfb_publish__notice').html('');
      $modal.find('.wpbc_bfb_publish__save_step').hide();
      $modal.find('.wpbc_bfb_publish__chooser').hide();
      $modal.find('.wpbc_bfb_publish__panel').hide();
      $modal.find('.wpbc_bfb_publish__panel--' + mode).show();
      $modal.find('.modal-footer').show();
      $modal.find('.wpbc_bfb_publish__result_actions').hide();
    },
    /**
     * Return from current step.
     *
     * @param {Object} event Click event.
     *
     * @return void
     */
    go_back: function (event) {
      var $modal = this.get_modal();
      event.preventDefault();
      if (!$modal.length) {
        return;
      }
      $modal.find('.wpbc_bfb_publish__notice').html('');
      $modal.find('.wpbc_bfb_publish__result_actions').hide();
      if ($modal.find('.wpbc_bfb_publish__panel:visible').length) {
        this.show_chooser_step();
        return;
      }
      if ($modal.find('.wpbc_bfb_publish__chooser:visible').length) {
        this.show_save_step();
        return;
      }
      this.show_save_step();
    },
    /**
     * Render notice inside modal.
     *
     * @param {string} type    success | error | info
     * @param {string} message Message HTML.
     *
     * @return void
     */
    render_notice: function (type, message) {
      var $modal = this.get_modal();
      var css_class = 'notice-info';
      if (!$modal.length) {
        return;
      }
      if ('success' === type) {
        css_class = 'notice-success';
      } else if ('error' === type) {
        css_class = 'notice-error';
      }
      $modal.find('.wpbc_bfb_publish__notice').html('<div class="wpbc-settings-notice notice ' + css_class + '" style="text-align:left;font-size:1rem;margin-top:0;">' + message + '</div>');
    },
    /**
     * Start save flow and continue to chooser after save.
     *
     * @param {Object} event       Click event.
     * @param {jQuery} $save_button Save button.
     *
     * @return void
     */
    start_save_and_continue: function (event, $save_button) {
      var self = this;
      var vars = this.get_vars();
      var i18n = this.get_i18n();
      var save_fn = window.wpbc_bfb__ajax_save_current_form;
      var save_result = null;
      var has_async_handle = false;
      var finished = false;
      var busy_seen = false;
      var poll_id = null;
      var quick_id = null;
      var timeout_id = null;
      var event_names, event_handlers;
      event.preventDefault();
      if (parseInt(vars.is_demo || 0, 10) === 1) {
        this.render_notice('error', i18n.demo_error || 'This operation is restricted in the demo version.');
        return;
      }
      if ('function' !== typeof save_fn) {
        this.render_notice('error', i18n.save_fn_missing || 'Save function is not available. You can use Skip to continue without saving.');
        return;
      }
      this.render_notice('info', i18n.saving_form || 'Saving booking form...');
      $save_button.prop('disabled', true).addClass('disabled');
      event_names = array_or_list_to_array(['wpbc:bfb:form:ajax_saved', 'wpbc:bfb:form:saved', 'wpbc:bfb:save:done', 'wpbc:bfb:ajax_saved']);
      event_handlers = [];
      function cleanup() {
        var i;
        if (poll_id) {
          window.clearInterval(poll_id);
        }
        if (quick_id) {
          window.clearTimeout(quick_id);
        }
        if (timeout_id) {
          window.clearTimeout(timeout_id);
        }
        for (i = 0; i < event_names.length; i++) {
          if (event_handlers[i]) {
            document.removeEventListener(event_names[i], event_handlers[i]);
          }
        }
        $save_button.prop('disabled', false).removeClass('disabled');
      }
      function finish_success() {
        if (finished) {
          return;
        }
        finished = true;
        cleanup();
        self.refresh_publish_button_shortcodes(self.get_current_form_name());
        self.render_notice('success', i18n.save_success || 'Booking form has been saved. Continue with publishing.');
        self.show_chooser_step();
      }
      function finish_error(message) {
        if (finished) {
          return;
        }
        finished = true;
        cleanup();
        self.render_notice('error', message || i18n.save_failed || 'Unable to confirm that the booking form was saved.');
      }
      try {
        save_result = save_fn($save_button.get(0));
      } catch (err) {
        finish_error(i18n.save_failed || 'Unable to confirm that the booking form was saved.');
        return;
      }
      if (true === save_result) {
        finish_success();
        return;
      }
      if (false === save_result) {
        finish_error(i18n.save_failed || 'Unable to confirm that the booking form was saved.');
        return;
      }
      if (save_result && 'function' === typeof save_result.then) {
        has_async_handle = true;
        save_result.then(function () {
          finish_success();
        }, function () {
          finish_error(i18n.save_failed || 'Unable to confirm that the booking form was saved.');
        });
      } else if (save_result && 'function' === typeof save_result.done && 'function' === typeof save_result.fail) {
        has_async_handle = true;
        save_result.done(function () {
          finish_success();
        }).fail(function () {
          finish_error(i18n.save_failed || 'Unable to confirm that the booking form was saved.');
        });
      }
      event_names.forEach(function (event_name, index) {
        event_handlers[index] = function () {
          finish_success();
        };
        document.addEventListener(event_name, event_handlers[index]);
      });
      poll_id = window.setInterval(function () {
        if (finished) {
          return;
        }
        if ($save_button.hasClass('wpbc-is-busy')) {
          busy_seen = true;
          return;
        }
        if (busy_seen) {
          finish_success();
        }
      }, 250);
      quick_id = window.setTimeout(function () {
        if (finished) {
          return;
        }
        if (!has_async_handle && !busy_seen) {
          finish_success();
        }
      }, 1000);
      timeout_id = window.setTimeout(function () {
        if (finished) {
          return;
        }
        finish_error(i18n.save_timeout || 'Saving is taking longer than expected. You can wait a little longer or use Skip to continue without waiting.');
      }, 20000);
    },
    /**
     * Show success action buttons.
     *
     * @param {Object} response_data AJAX success data.
     *
     * @return void
     */
    show_result_actions: function (response_data) {
      var i18n = this.get_i18n();
      var $modal = this.get_modal();
      var $wrap = $modal.find('.wpbc_bfb_publish__result_actions');
      var $view = $modal.find('[data-wpbc-bfb-publish-open-page="1"]');
      var $edit = $modal.find('[data-wpbc-bfb-publish-edit-page="1"]');
      if (!$modal.length) {
        return;
      }
      $view.hide();
      $edit.hide();
      if (response_data.view_url) {
        $view.attr('href', response_data.view_url).text(i18n.view_page || 'Open Page').show();
      }
      if (response_data.edit_url) {
        $edit.attr('href', response_data.edit_url).text(i18n.edit_page || 'Edit Page').show();
      }
      if (response_data.view_url || response_data.edit_url) {
        $wrap.css('display', 'flex');
      } else {
        $wrap.hide();
      }
    },
    /**
     * Submit publish request.
     *
     * @param {Object} event Click event.
     * @param {string} mode  Mode.
     *
     * @return void
     */
    submit_publish: function (event, mode) {
      var self = this;
      var vars = this.get_vars();
      var i18n = this.get_i18n();
      var $modal = this.get_modal();
      var resource_id;
      var form_name;
      var shortcode_raw;
      var page_id;
      var page_title;
      var $submit_button;
      event.preventDefault();
      if (!$modal.length) {
        return;
      }
      if (parseInt(vars.is_demo || 0, 10) === 1) {
        this.render_notice('error', i18n.demo_error || 'This operation is restricted in the demo version.');
        return;
      }
      resource_id = this.normalize_resource_id($modal.find('#wpbc_bfb_publish__resource_id').val() || vars.default_resource_id || 1);
      form_name = this.sanitize_form_name($modal.find('#wpbc_bfb_publish__form_name').val() || this.get_current_form_name());
      shortcode_raw = this.normalize_shortcode_raw($modal.find('#wpbc_bfb_publish__shortcode_raw').val() || vars.default_shortcode_raw || '', resource_id, form_name);
      page_id = $modal.find('#wpbc_bfb_publish_page_id').val() || '';
      page_title = trim_string($modal.find('#wpbc_bfb_publish_page_title').val() || '');
      $submit_button = $modal.find('[data-wpbc-bfb-publish-submit="' + mode + '"]');
      $modal.find('#wpbc_bfb_publish__form_name').val(form_name);
      $modal.find('#wpbc_bfb_publish__shortcode_raw').val(shortcode_raw);
      if ('edit' === mode && (!page_id || '0' === page_id)) {
        this.render_notice('error', i18n.select_page || 'Please select an existing page.');
        return;
      }
      if ('create' === mode && !page_title) {
        this.render_notice('error', i18n.enter_page_title || 'Please enter a page title.');
        return;
      }
      this.render_notice('info', i18n.loading || 'Publishing booking form...');
      $modal.find('.wpbc_bfb_publish__result_actions').hide();
      $submit_button.prop('disabled', true).addClass('disabled');
      $.ajax({
        url: vars.ajax_url,
        type: 'POST',
        dataType: 'json',
        data: {
          action: vars.action,
          nonce: vars.nonce,
          publish_mode: mode,
          resource_id: resource_id,
          form_name: form_name,
          shortcode_raw: shortcode_raw,
          page_id: page_id,
          page_title: page_title
        }
      }).done(function (response) {
        if (response && response.success && response.data) {
          self.render_notice('success', response.data.message || '');
          self.show_result_actions(response.data);
          if (response.data.form_name) {
            window.WPBC_BFB_Ajax = window.WPBC_BFB_Ajax || {};
            window.WPBC_BFB_Ajax.form_name = self.sanitize_form_name(response.data.form_name);
            self.refresh_publish_button_shortcodes(response.data.form_name);
          }
        } else if (response && response.data && response.data.message) {
          self.render_notice('error', response.data.message);
        } else {
          self.render_notice('error', i18n.generic_error || 'An unexpected error occurred while publishing the booking form.');
        }
      }).fail(function () {
        self.render_notice('error', i18n.generic_error || 'An unexpected error occurred while publishing the booking form.');
      }).always(function () {
        $submit_button.prop('disabled', false).removeClass('disabled');
      });
    }
  };

  /**
   * Trim string without using jQuery.trim().
   *
   * @param {*} value Raw value.
   *
   * @return {string}
   */
  function trim_string(value) {
    return String(value == null ? '' : value).trim();
  }

  /**
   * Normalize list helper.
   *
   * @param {*} input List-like input.
   *
   * @return {Array}
   */
  function array_or_list_to_array(input) {
    if (Array.isArray(input)) {
      return input;
    }
    return [];
  }
  $(function () {
    publish_api.init();
  });
})(jQuery, window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvcHVibGlzaC9fb3V0L2JmYi1wdWJsaXNoLmpzIiwibmFtZXMiOlsiJCIsIndpbmRvdyIsImRvY3VtZW50IiwicHVibGlzaF9hcGkiLCJpbml0IiwiYmluZF9ldmVudHMiLCJiaW5kX2Zvcm1fYWpheF9sb2FkZWRfZXZlbnRzIiwicmVnaXN0ZXJfZ2xvYmFsX2hlbHBlcnMiLCJyZWZyZXNoX3B1Ymxpc2hfYnV0dG9uX3Nob3J0Y29kZXMiLCJnZXRfY3VycmVudF9mb3JtX25hbWUiLCJnZXRfdmFycyIsIndwYmNfYmZiX3B1Ymxpc2hfdmFycyIsImdldF9pMThuIiwidmFycyIsImkxOG4iLCJnZXRfbW9kYWwiLCJzZWxlY3RvciIsIm1vZGFsX3NlbGVjdG9yIiwic2FuaXRpemVfZm9ybV9uYW1lIiwiZm9ybV9uYW1lIiwiU3RyaW5nIiwidG9Mb3dlckNhc2UiLCJyZXBsYWNlIiwiZGVmYXVsdF9mb3JtX25hbWUiLCJub3JtYWxpemVfcmVzb3VyY2VfaWQiLCJyZXNvdXJjZV9pZCIsInBhcnNlSW50IiwiZGVmYXVsdF9yZXNvdXJjZV9pZCIsIldQQkNfQkZCX0FqYXgiLCJidWlsZF9kZWZhdWx0X3Nob3J0Y29kZV9yYXciLCJ1cHNlcnRfc2hvcnRjb2RlX2F0dHIiLCJzaG9ydGNvZGVfcmF3IiwiYXR0cl9uYW1lIiwiYXR0cl92YWx1ZSIsInF1b3RlX2NoYXIiLCJlc2NhcGVkX2F0dHJfbmFtZSIsInBhdHRlcm4iLCJyZXBsYWNlbWVudF92YWx1ZSIsInJlcGxhY2VtZW50IiwidHJpbV9zdHJpbmciLCJSZWdFeHAiLCJ0ZXN0Iiwibm9ybWFsaXplX3Nob3J0Y29kZV9yYXciLCJpbmRleE9mIiwic2VsZiIsIiRidXR0b25zIiwiZWFjaCIsIiRidXR0b24iLCJhdHRyIiwiZGVmYXVsdF9zaG9ydGNvZGVfcmF3IiwiX193cGJjX2JmYl9wdWJsaXNoX19mb3JtX2FqYXhfbG9hZGVkX2JvdW5kIiwiYWRkRXZlbnRMaXN0ZW5lciIsImV2IiwiZGV0YWlsIiwiJG1vZGFsIiwibGVuZ3RoIiwiZmluZCIsInZhbCIsInBhc3NpdmUiLCJvbiIsImV2ZW50Iiwib3Blbl9mcm9tX2J1dHRvbiIsInN0YXJ0X3NhdmVfYW5kX2NvbnRpbnVlIiwicHJldmVudERlZmF1bHQiLCJzaG93X2Nob29zZXJfc3RlcCIsIm9wZW5fbW9kZV9wYW5lbCIsInN1Ym1pdF9wdWJsaXNoIiwiZ29fYmFjayIsIndwYmNfYmZiX3B1Ymxpc2hfX29wZW4iLCJvcGVuX21vZGFsIiwid3BiY19tb2RhbF9kaWFsb2dfX3Nob3dfX3Jlc291cmNlX3B1Ymxpc2giLCJyZXNldF9tb2RhbCIsImh0bWwiLCJoaWRlIiwic2hvd19zYXZlX3N0ZXAiLCJzaG93Iiwid3BiY19teV9tb2RhbCIsImlzX2RlbW8iLCJtb2RlIiwicmVuZGVyX25vdGljZSIsInR5cGUiLCJtZXNzYWdlIiwiY3NzX2NsYXNzIiwiJHNhdmVfYnV0dG9uIiwic2F2ZV9mbiIsIndwYmNfYmZiX19hamF4X3NhdmVfY3VycmVudF9mb3JtIiwic2F2ZV9yZXN1bHQiLCJoYXNfYXN5bmNfaGFuZGxlIiwiZmluaXNoZWQiLCJidXN5X3NlZW4iLCJwb2xsX2lkIiwicXVpY2tfaWQiLCJ0aW1lb3V0X2lkIiwiZXZlbnRfbmFtZXMiLCJldmVudF9oYW5kbGVycyIsImRlbW9fZXJyb3IiLCJzYXZlX2ZuX21pc3NpbmciLCJzYXZpbmdfZm9ybSIsInByb3AiLCJhZGRDbGFzcyIsImFycmF5X29yX2xpc3RfdG9fYXJyYXkiLCJjbGVhbnVwIiwiaSIsImNsZWFySW50ZXJ2YWwiLCJjbGVhclRpbWVvdXQiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwicmVtb3ZlQ2xhc3MiLCJmaW5pc2hfc3VjY2VzcyIsInNhdmVfc3VjY2VzcyIsImZpbmlzaF9lcnJvciIsInNhdmVfZmFpbGVkIiwiZ2V0IiwiZXJyIiwidGhlbiIsImRvbmUiLCJmYWlsIiwiZm9yRWFjaCIsImV2ZW50X25hbWUiLCJpbmRleCIsInNldEludGVydmFsIiwiaGFzQ2xhc3MiLCJzZXRUaW1lb3V0Iiwic2F2ZV90aW1lb3V0Iiwic2hvd19yZXN1bHRfYWN0aW9ucyIsInJlc3BvbnNlX2RhdGEiLCIkd3JhcCIsIiR2aWV3IiwiJGVkaXQiLCJ2aWV3X3VybCIsInRleHQiLCJ2aWV3X3BhZ2UiLCJlZGl0X3VybCIsImVkaXRfcGFnZSIsImNzcyIsInBhZ2VfaWQiLCJwYWdlX3RpdGxlIiwiJHN1Ym1pdF9idXR0b24iLCJzZWxlY3RfcGFnZSIsImVudGVyX3BhZ2VfdGl0bGUiLCJsb2FkaW5nIiwiYWpheCIsInVybCIsImFqYXhfdXJsIiwiZGF0YVR5cGUiLCJkYXRhIiwiYWN0aW9uIiwibm9uY2UiLCJwdWJsaXNoX21vZGUiLCJyZXNwb25zZSIsInN1Y2Nlc3MiLCJnZW5lcmljX2Vycm9yIiwiYWx3YXlzIiwidmFsdWUiLCJ0cmltIiwiaW5wdXQiLCJBcnJheSIsImlzQXJyYXkiLCJqUXVlcnkiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9wdWJsaXNoL19zcmMvYmZiLXB1Ymxpc2guanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIEJGQiBQdWJsaXNoIG1vZGFsIGNvbnRyb2xsZXIuXHJcbiAqXHJcbiAqIFJlc3BvbnNpYmlsaXRpZXM6XHJcbiAqIC0gT3BlbiBQdWJsaXNoIG1vZGFsIGZyb20gdG9vbGJhciBidXR0b24uXHJcbiAqIC0gU3VwcG9ydCBsZWdhY3kgaW5saW5lIGNhbGw6IHdwYmNfbW9kYWxfZGlhbG9nX19zaG93X19yZXNvdXJjZV9wdWJsaXNoKCByZXNvdXJjZV9pZCApLlxyXG4gKiAtIEtlZXAgc2hvcnRjb2RlIGluIHN5bmMgd2l0aCBjdXJyZW50IGZvcm0gbmFtZS5cclxuICogLSBBc2sgdXNlciB0byBzYXZlIGN1cnJlbnQgZm9ybSBiZWZvcmUgcHVibGlzaGluZy5cclxuICogLSBQdWJsaXNoIHNob3J0Y29kZSBpbnRvIGV4aXN0aW5nL25ldyBwYWdlIHZpYSBBSkFYLlxyXG4gKiAtIFNob3cgc3VjY2Vzcy9lcnJvciBtZXNzYWdlIHdpdGhvdXQgcGFnZSByZWxvYWQuXHJcbiAqXHJcbiAqIEBwYWNrYWdlICAgICBCb29raW5nIENhbGVuZGFyXHJcbiAqIEBzdWJwYWNrYWdlICBCb29raW5nIEZvcm0gQnVpbGRlclxyXG4gKiBAc2luY2UgICAgICAgMTEuMC4wXHJcbiAqIEBmaWxlICAgICAgICAuLi9pbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9wdWJsaXNoL19vdXQvYmZiLXB1Ymxpc2guanNcclxuICovXHJcbihmdW5jdGlvbiAoICQsIHdpbmRvdywgZG9jdW1lbnQgKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHR2YXIgcHVibGlzaF9hcGkgPSB7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBJbml0IG1vZHVsZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHZvaWRcclxuXHRcdCAqL1xyXG5cdFx0aW5pdDogZnVuY3Rpb24oKSB7XHJcblx0XHRcdHRoaXMuYmluZF9ldmVudHMoKTtcclxuXHRcdFx0dGhpcy5iaW5kX2Zvcm1fYWpheF9sb2FkZWRfZXZlbnRzKCk7XHJcblx0XHRcdHRoaXMucmVnaXN0ZXJfZ2xvYmFsX2hlbHBlcnMoKTtcclxuXHRcdFx0dGhpcy5yZWZyZXNoX3B1Ymxpc2hfYnV0dG9uX3Nob3J0Y29kZXMoIHRoaXMuZ2V0X2N1cnJlbnRfZm9ybV9uYW1lKCkgKTtcclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBHZXQgbG9jYWxpemVkIHZhcnMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fVxyXG5cdFx0ICovXHJcblx0XHRnZXRfdmFyczogZnVuY3Rpb24oKSB7XHJcblx0XHRcdHJldHVybiB3aW5kb3cud3BiY19iZmJfcHVibGlzaF92YXJzIHx8IHt9O1xyXG5cdFx0fSxcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEdldCBpMThuIHZhcnMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fVxyXG5cdFx0ICovXHJcblx0XHRnZXRfaTE4bjogZnVuY3Rpb24oKSB7XHJcblx0XHRcdHZhciB2YXJzID0gdGhpcy5nZXRfdmFycygpO1xyXG5cclxuXHRcdFx0cmV0dXJuIHZhcnMuaTE4biB8fCB7fTtcclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBHZXQgbW9kYWwgalF1ZXJ5IG9iamVjdC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHtqUXVlcnl9XHJcblx0XHQgKi9cclxuXHRcdGdldF9tb2RhbDogZnVuY3Rpb24oKSB7XHJcblx0XHRcdHZhciB2YXJzID0gdGhpcy5nZXRfdmFycygpO1xyXG5cdFx0XHR2YXIgc2VsZWN0b3IgPSB2YXJzLm1vZGFsX3NlbGVjdG9yIHx8ICcjd3BiY19iZmJfbW9kYWxfX3B1Ymxpc2gnO1xyXG5cclxuXHRcdFx0cmV0dXJuICQoIHNlbGVjdG9yICk7XHJcblx0XHR9LFxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU2FuaXRpemUgZm9ybSBuYW1lIHNpbWlsYXIgdG8gV1Agc2FuaXRpemVfa2V5KCkuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGZvcm1fbmFtZSBGb3JtIG5hbWUuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfVxyXG5cdFx0ICovXHJcblx0XHRzYW5pdGl6ZV9mb3JtX25hbWU6IGZ1bmN0aW9uKCBmb3JtX25hbWUgKSB7XHJcblx0XHRcdGZvcm1fbmFtZSA9IFN0cmluZyggZm9ybV9uYW1lIHx8ICcnICkudG9Mb3dlckNhc2UoKTtcclxuXHRcdFx0Zm9ybV9uYW1lID0gZm9ybV9uYW1lLnJlcGxhY2UoIC9bXmEtejAtOV8tXS9nLCAnJyApO1xyXG5cclxuXHRcdFx0aWYgKCAhIGZvcm1fbmFtZSApIHtcclxuXHRcdFx0XHRmb3JtX25hbWUgPSB0aGlzLmdldF92YXJzKCkuZGVmYXVsdF9mb3JtX25hbWUgfHwgJ3N0YW5kYXJkJztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIGZvcm1fbmFtZTtcclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBOb3JtYWxpemUgcmVzb3VyY2UgSUQuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ8c3RyaW5nfSByZXNvdXJjZV9pZCBSZXNvdXJjZSBJRC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHtudW1iZXJ9XHJcblx0XHQgKi9cclxuXHRcdG5vcm1hbGl6ZV9yZXNvdXJjZV9pZDogZnVuY3Rpb24oIHJlc291cmNlX2lkICkge1xyXG5cdFx0XHRyZXNvdXJjZV9pZCA9IHBhcnNlSW50KCByZXNvdXJjZV9pZCwgMTAgKTtcclxuXHJcblx0XHRcdGlmICggISByZXNvdXJjZV9pZCB8fCByZXNvdXJjZV9pZCA8IDEgKSB7XHJcblx0XHRcdFx0cmVzb3VyY2VfaWQgPSBwYXJzZUludCggdGhpcy5nZXRfdmFycygpLmRlZmF1bHRfcmVzb3VyY2VfaWQgfHwgMSwgMTAgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCAhIHJlc291cmNlX2lkIHx8IHJlc291cmNlX2lkIDwgMSApIHtcclxuXHRcdFx0XHRyZXNvdXJjZV9pZCA9IDE7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiByZXNvdXJjZV9pZDtcclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBHZXQgY3VycmVudCBCRkIgZm9ybSBuYW1lLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ31cclxuXHRcdCAqL1xyXG5cdFx0Z2V0X2N1cnJlbnRfZm9ybV9uYW1lOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0dmFyIHZhcnMgPSB0aGlzLmdldF92YXJzKCk7XHJcblx0XHRcdHZhciBmb3JtX25hbWUgPSAnJztcclxuXHJcblx0XHRcdGlmICggd2luZG93LldQQkNfQkZCX0FqYXggJiYgd2luZG93LldQQkNfQkZCX0FqYXguZm9ybV9uYW1lICkge1xyXG5cdFx0XHRcdGZvcm1fbmFtZSA9IHdpbmRvdy5XUEJDX0JGQl9BamF4LmZvcm1fbmFtZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCAhIGZvcm1fbmFtZSAmJiB2YXJzLmRlZmF1bHRfZm9ybV9uYW1lICkge1xyXG5cdFx0XHRcdGZvcm1fbmFtZSA9IHZhcnMuZGVmYXVsdF9mb3JtX25hbWU7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiB0aGlzLnNhbml0aXplX2Zvcm1fbmFtZSggZm9ybV9uYW1lIHx8ICdzdGFuZGFyZCcgKTtcclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBCdWlsZCBkZWZhdWx0IHNob3J0Y29kZSByYXcuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ8c3RyaW5nfSByZXNvdXJjZV9pZCBSZXNvdXJjZSBJRC5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgZm9ybV9uYW1lICAgRm9ybSBuYW1lLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ31cclxuXHRcdCAqL1xyXG5cdFx0YnVpbGRfZGVmYXVsdF9zaG9ydGNvZGVfcmF3OiBmdW5jdGlvbiggcmVzb3VyY2VfaWQsIGZvcm1fbmFtZSApIHtcclxuXHRcdFx0cmVzb3VyY2VfaWQgPSB0aGlzLm5vcm1hbGl6ZV9yZXNvdXJjZV9pZCggcmVzb3VyY2VfaWQgKTtcclxuXHRcdFx0Zm9ybV9uYW1lICAgPSB0aGlzLnNhbml0aXplX2Zvcm1fbmFtZSggZm9ybV9uYW1lICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gXCJbYm9va2luZyByZXNvdXJjZV9pZD1cIiArIHJlc291cmNlX2lkICsgXCIgZm9ybV90eXBlPSdcIiArIGZvcm1fbmFtZSArIFwiJ11cIjtcclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBVcHNlcnQgb25lIHNob3J0Y29kZSBhdHRyaWJ1dGUuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHNob3J0Y29kZV9yYXcgU2hvcnRjb2RlLlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGF0dHJfbmFtZSAgICAgQXR0cmlidXRlIG5hbWUuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gYXR0cl92YWx1ZSAgICBBdHRyaWJ1dGUgdmFsdWUuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gcXVvdGVfY2hhciAgICBRdW90ZSBjaGFyLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ31cclxuXHRcdCAqL1xyXG5cdFx0dXBzZXJ0X3Nob3J0Y29kZV9hdHRyOiBmdW5jdGlvbiggc2hvcnRjb2RlX3JhdywgYXR0cl9uYW1lLCBhdHRyX3ZhbHVlLCBxdW90ZV9jaGFyICkge1xyXG5cdFx0XHR2YXIgZXNjYXBlZF9hdHRyX25hbWUsIHBhdHRlcm4sIHJlcGxhY2VtZW50X3ZhbHVlLCByZXBsYWNlbWVudDtcclxuXHJcblx0XHRcdHNob3J0Y29kZV9yYXcgPSB0cmltX3N0cmluZyggc2hvcnRjb2RlX3JhdyApO1xyXG5cdFx0XHRhdHRyX25hbWUgICAgID0gU3RyaW5nKCBhdHRyX25hbWUgfHwgJycgKTtcclxuXHRcdFx0YXR0cl92YWx1ZSAgICA9IFN0cmluZyggYXR0cl92YWx1ZSB8fCAnJyApO1xyXG5cdFx0XHRxdW90ZV9jaGFyICAgID0gU3RyaW5nKCBxdW90ZV9jaGFyIHx8ICcnICk7XHJcblxyXG5cdFx0XHRpZiAoICEgYXR0cl9uYW1lICkge1xyXG5cdFx0XHRcdHJldHVybiBzaG9ydGNvZGVfcmF3O1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXBsYWNlbWVudF92YWx1ZSA9IGF0dHJfdmFsdWU7XHJcblx0XHRcdGlmICggcXVvdGVfY2hhciApIHtcclxuXHRcdFx0XHRyZXBsYWNlbWVudF92YWx1ZSA9IHF1b3RlX2NoYXIgKyBhdHRyX3ZhbHVlICsgcXVvdGVfY2hhcjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmVwbGFjZW1lbnQgICAgICAgPSBhdHRyX25hbWUgKyAnPScgKyByZXBsYWNlbWVudF92YWx1ZTtcclxuXHRcdFx0ZXNjYXBlZF9hdHRyX25hbWUgPSBhdHRyX25hbWUucmVwbGFjZSggL1stXFwvXFxcXF4kKis/LigpfFtcXF17fV0vZywgJ1xcXFwkJicgKTtcclxuXHRcdFx0cGF0dGVybiAgICAgICAgICAgPSBuZXcgUmVnRXhwKCBcIlxcXFxiXCIgKyBlc2NhcGVkX2F0dHJfbmFtZSArIFwiXFxcXHMqPVxcXFxzKig/OlxcXCJbXlxcXCJdKlxcXCJ8J1teJ10qJ3xbXlxcXFxzXFxcXF1dKylcIiwgJ2knICk7XHJcblxyXG5cdFx0XHRpZiAoIHBhdHRlcm4udGVzdCggc2hvcnRjb2RlX3JhdyApICkge1xyXG5cdFx0XHRcdHJldHVybiBzaG9ydGNvZGVfcmF3LnJlcGxhY2UoIHBhdHRlcm4sIHJlcGxhY2VtZW50ICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggL1xcXSQvLnRlc3QoIHNob3J0Y29kZV9yYXcgKSApIHtcclxuXHRcdFx0XHRyZXR1cm4gc2hvcnRjb2RlX3Jhdy5yZXBsYWNlKCAvXFxdJC8sICcgJyArIHJlcGxhY2VtZW50ICsgJ10nICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiBzaG9ydGNvZGVfcmF3ICsgJyAnICsgcmVwbGFjZW1lbnQ7XHJcblx0XHR9LFxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogTm9ybWFsaXplIHNob3J0Y29kZSB0byBjdXJyZW50IHJlc291cmNlICsgZm9ybSB0eXBlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgc2hvcnRjb2RlX3JhdyBTaG9ydGNvZGUuXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcnxzdHJpbmd9IHJlc291cmNlX2lkICAgUmVzb3VyY2UgSUQuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICAgIGZvcm1fbmFtZSAgICAgRm9ybSBuYW1lLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ31cclxuXHRcdCAqL1xyXG5cdFx0bm9ybWFsaXplX3Nob3J0Y29kZV9yYXc6IGZ1bmN0aW9uKCBzaG9ydGNvZGVfcmF3LCByZXNvdXJjZV9pZCwgZm9ybV9uYW1lICkge1xyXG5cdFx0XHRyZXNvdXJjZV9pZCAgID0gdGhpcy5ub3JtYWxpemVfcmVzb3VyY2VfaWQoIHJlc291cmNlX2lkICk7XHJcblx0XHRcdGZvcm1fbmFtZSAgICAgPSB0aGlzLnNhbml0aXplX2Zvcm1fbmFtZSggZm9ybV9uYW1lICk7XHJcblx0XHRcdHNob3J0Y29kZV9yYXcgPSB0cmltX3N0cmluZyggc2hvcnRjb2RlX3JhdyApO1xyXG5cclxuXHRcdFx0aWYgKCAoICEgc2hvcnRjb2RlX3JhdyB8fCAwICE9PSBzaG9ydGNvZGVfcmF3LmluZGV4T2YoICdbYm9va2luZycgKSApICkge1xyXG5cdFx0XHRcdHJldHVybiB0aGlzLmJ1aWxkX2RlZmF1bHRfc2hvcnRjb2RlX3JhdyggcmVzb3VyY2VfaWQsIGZvcm1fbmFtZSApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRzaG9ydGNvZGVfcmF3ID0gdGhpcy51cHNlcnRfc2hvcnRjb2RlX2F0dHIoIHNob3J0Y29kZV9yYXcsICdyZXNvdXJjZV9pZCcsIFN0cmluZyggcmVzb3VyY2VfaWQgKSwgJycgKTtcclxuXHRcdFx0c2hvcnRjb2RlX3JhdyA9IHRoaXMudXBzZXJ0X3Nob3J0Y29kZV9hdHRyKCBzaG9ydGNvZGVfcmF3LCAnZm9ybV90eXBlJywgZm9ybV9uYW1lLCAnXFwnJyApO1xyXG5cclxuXHRcdFx0cmV0dXJuIHRyaW1fc3RyaW5nKCBzaG9ydGNvZGVfcmF3ICk7XHJcblx0XHR9LFxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVmcmVzaCB0b29sYmFyIGJ1dHRvbiBzaG9ydGNvZGUgYXR0cmlidXRlcy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gZm9ybV9uYW1lIEZvcm0gbmFtZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHZvaWRcclxuXHRcdCAqL1xyXG5cdFx0cmVmcmVzaF9wdWJsaXNoX2J1dHRvbl9zaG9ydGNvZGVzOiBmdW5jdGlvbiggZm9ybV9uYW1lICkge1xyXG5cdFx0XHR2YXIgc2VsZiAgICAgPSB0aGlzO1xyXG5cdFx0XHR2YXIgdmFycyAgICAgPSB0aGlzLmdldF92YXJzKCk7XHJcblx0XHRcdHZhciAkYnV0dG9ucyA9ICQoICdbZGF0YS13cGJjLWJmYi10b3AtcHVibGlzaC1idG49XCIxXCJdJyApO1xyXG5cclxuXHRcdFx0Zm9ybV9uYW1lID0gdGhpcy5zYW5pdGl6ZV9mb3JtX25hbWUoIGZvcm1fbmFtZSApO1xyXG5cclxuXHRcdFx0JGJ1dHRvbnMuZWFjaChcclxuXHRcdFx0XHRmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRcdHZhciAkYnV0dG9uICAgICAgID0gJCggdGhpcyApO1xyXG5cdFx0XHRcdFx0dmFyIHJlc291cmNlX2lkICAgPSBzZWxmLm5vcm1hbGl6ZV9yZXNvdXJjZV9pZCggJGJ1dHRvbi5hdHRyKCAnZGF0YS13cGJjLWJmYi1yZXNvdXJjZS1pZCcgKSB8fCB2YXJzLmRlZmF1bHRfcmVzb3VyY2VfaWQgfHwgMSApO1xyXG5cdFx0XHRcdFx0dmFyIHNob3J0Y29kZV9yYXcgPSAkYnV0dG9uLmF0dHIoICdkYXRhLXdwYmMtYmZiLXNob3J0Y29kZS1yYXcnICkgfHwgdmFycy5kZWZhdWx0X3Nob3J0Y29kZV9yYXcgfHwgJyc7XHJcblxyXG5cdFx0XHRcdFx0c2hvcnRjb2RlX3JhdyA9IHNlbGYubm9ybWFsaXplX3Nob3J0Y29kZV9yYXcoIHNob3J0Y29kZV9yYXcsIHJlc291cmNlX2lkLCBmb3JtX25hbWUgKTtcclxuXHJcblx0XHRcdFx0XHQkYnV0dG9uLmF0dHIoICdkYXRhLXdwYmMtYmZiLXNob3J0Y29kZS1yYXcnLCBzaG9ydGNvZGVfcmF3ICk7XHJcblx0XHRcdFx0XHQkYnV0dG9uLmF0dHIoICdkYXRhLXdwYmMtYmZiLWZvcm0tbmFtZScsIGZvcm1fbmFtZSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0KTtcclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBLZWVwIHB1Ymxpc2ggc2hvcnRjb2RlIGluIHN5bmMgYWZ0ZXIgQUpBWCBmb3JtIGxvYWQuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB2b2lkXHJcblx0XHQgKi9cclxuXHRcdGJpbmRfZm9ybV9hamF4X2xvYWRlZF9ldmVudHM6IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHR2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG5cdFx0XHRpZiAoIHdpbmRvdy5fX3dwYmNfYmZiX3B1Ymxpc2hfX2Zvcm1fYWpheF9sb2FkZWRfYm91bmQgPT09ICcxJyApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0d2luZG93Ll9fd3BiY19iZmJfcHVibGlzaF9fZm9ybV9hamF4X2xvYWRlZF9ib3VuZCA9ICcxJztcclxuXHJcblx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXHJcblx0XHRcdFx0J3dwYmM6YmZiOmZvcm06YWpheF9sb2FkZWQnLFxyXG5cdFx0XHRcdGZ1bmN0aW9uKCBldiApIHtcclxuXHRcdFx0XHRcdHZhciBkZXRhaWwgICAgICAgPSAoIGV2ICYmIGV2LmRldGFpbCApID8gZXYuZGV0YWlsIDoge307XHJcblx0XHRcdFx0XHR2YXIgZm9ybV9uYW1lICAgID0gc2VsZi5zYW5pdGl6ZV9mb3JtX25hbWUoIGRldGFpbC5mb3JtX25hbWUgfHwgc2VsZi5nZXRfY3VycmVudF9mb3JtX25hbWUoKSApO1xyXG5cdFx0XHRcdFx0dmFyICRtb2RhbCAgICAgICA9IHNlbGYuZ2V0X21vZGFsKCk7XHJcblx0XHRcdFx0XHR2YXIgcmVzb3VyY2VfaWQsIHNob3J0Y29kZV9yYXc7XHJcblxyXG5cdFx0XHRcdFx0d2luZG93LldQQkNfQkZCX0FqYXggICAgICAgICAgID0gd2luZG93LldQQkNfQkZCX0FqYXggfHwge307XHJcblx0XHRcdFx0XHR3aW5kb3cuV1BCQ19CRkJfQWpheC5mb3JtX25hbWUgPSBmb3JtX25hbWU7XHJcblxyXG5cdFx0XHRcdFx0c2VsZi5yZWZyZXNoX3B1Ymxpc2hfYnV0dG9uX3Nob3J0Y29kZXMoIGZvcm1fbmFtZSApO1xyXG5cclxuXHRcdFx0XHRcdGlmICggJG1vZGFsLmxlbmd0aCApIHtcclxuXHRcdFx0XHRcdFx0cmVzb3VyY2VfaWQgICA9ICRtb2RhbC5maW5kKCAnI3dwYmNfYmZiX3B1Ymxpc2hfX3Jlc291cmNlX2lkJyApLnZhbCgpIHx8IHNlbGYuZ2V0X3ZhcnMoKS5kZWZhdWx0X3Jlc291cmNlX2lkIHx8IDE7XHJcblx0XHRcdFx0XHRcdHNob3J0Y29kZV9yYXcgPSAkbW9kYWwuZmluZCggJyN3cGJjX2JmYl9wdWJsaXNoX19zaG9ydGNvZGVfcmF3JyApLnZhbCgpIHx8IHNlbGYuZ2V0X3ZhcnMoKS5kZWZhdWx0X3Nob3J0Y29kZV9yYXcgfHwgJyc7XHJcblxyXG5cdFx0XHRcdFx0XHQkbW9kYWwuZmluZCggJyN3cGJjX2JmYl9wdWJsaXNoX19mb3JtX25hbWUnICkudmFsKCBmb3JtX25hbWUgKTtcclxuXHRcdFx0XHRcdFx0JG1vZGFsLmZpbmQoICcjd3BiY19iZmJfcHVibGlzaF9fc2hvcnRjb2RlX3JhdycgKS52YWwoXHJcblx0XHRcdFx0XHRcdFx0c2VsZi5ub3JtYWxpemVfc2hvcnRjb2RlX3Jhdyggc2hvcnRjb2RlX3JhdywgcmVzb3VyY2VfaWQsIGZvcm1fbmFtZSApXHJcblx0XHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHR7IHBhc3NpdmU6IHRydWUgfVxyXG5cdFx0XHQpO1xyXG5cdFx0fSxcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEJpbmQgRE9NIGV2ZW50cy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHZvaWRcclxuXHRcdCAqL1xyXG5cdFx0YmluZF9ldmVudHM6IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHR2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG5cdFx0XHQkKCBkb2N1bWVudCApLm9uKFxyXG5cdFx0XHRcdCdjbGljaycsXHJcblx0XHRcdFx0J1tkYXRhLXdwYmMtYmZiLXRvcC1wdWJsaXNoLWJ0bj1cIjFcIl0nLFxyXG5cdFx0XHRcdGZ1bmN0aW9uKCBldmVudCApIHtcclxuXHRcdFx0XHRcdHNlbGYub3Blbl9mcm9tX2J1dHRvbiggZXZlbnQsICQoIHRoaXMgKSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0KTtcclxuXHJcblx0XHRcdCQoIGRvY3VtZW50ICkub24oXHJcblx0XHRcdFx0J2NsaWNrJyxcclxuXHRcdFx0XHQnW2RhdGEtd3BiYy1iZmItcHVibGlzaC1zYXZlLXN0ZXA9XCJzYXZlXCJdJyxcclxuXHRcdFx0XHRmdW5jdGlvbiggZXZlbnQgKSB7XHJcblx0XHRcdFx0XHRzZWxmLnN0YXJ0X3NhdmVfYW5kX2NvbnRpbnVlKCBldmVudCwgJCggdGhpcyApICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHQpO1xyXG5cclxuXHRcdFx0JCggZG9jdW1lbnQgKS5vbihcclxuXHRcdFx0XHQnY2xpY2snLFxyXG5cdFx0XHRcdCdbZGF0YS13cGJjLWJmYi1wdWJsaXNoLXNhdmUtc3RlcD1cInNraXBcIl0nLFxyXG5cdFx0XHRcdGZ1bmN0aW9uKCBldmVudCApIHtcclxuXHRcdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0XHRzZWxmLnNob3dfY2hvb3Nlcl9zdGVwKCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHQpO1xyXG5cclxuXHRcdFx0JCggZG9jdW1lbnQgKS5vbihcclxuXHRcdFx0XHQnY2xpY2snLFxyXG5cdFx0XHRcdCdbZGF0YS13cGJjLWJmYi1wdWJsaXNoLW1vZGVdJyxcclxuXHRcdFx0XHRmdW5jdGlvbiggZXZlbnQgKSB7XHJcblx0XHRcdFx0XHRzZWxmLm9wZW5fbW9kZV9wYW5lbCggZXZlbnQsICQoIHRoaXMgKS5hdHRyKCAnZGF0YS13cGJjLWJmYi1wdWJsaXNoLW1vZGUnICkgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdCk7XHJcblxyXG5cdFx0XHQkKCBkb2N1bWVudCApLm9uKFxyXG5cdFx0XHRcdCdjbGljaycsXHJcblx0XHRcdFx0J1tkYXRhLXdwYmMtYmZiLXB1Ymxpc2gtc3VibWl0XScsXHJcblx0XHRcdFx0ZnVuY3Rpb24oIGV2ZW50ICkge1xyXG5cdFx0XHRcdFx0c2VsZi5zdWJtaXRfcHVibGlzaCggZXZlbnQsICQoIHRoaXMgKS5hdHRyKCAnZGF0YS13cGJjLWJmYi1wdWJsaXNoLXN1Ym1pdCcgKSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0KTtcclxuXHJcblx0XHRcdCQoIGRvY3VtZW50ICkub24oXHJcblx0XHRcdFx0J2NsaWNrJyxcclxuXHRcdFx0XHQnW2RhdGEtd3BiYy1iZmItcHVibGlzaC1iYWNrPVwiMVwiXScsXHJcblx0XHRcdFx0ZnVuY3Rpb24oIGV2ZW50ICkge1xyXG5cdFx0XHRcdFx0c2VsZi5nb19iYWNrKCBldmVudCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0KTtcclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZWdpc3RlciBnbG9iYWwgaGVscGVycyBmb3IgYmFja3dhcmQgY29tcGF0aWJpbGl0eS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHZvaWRcclxuXHRcdCAqL1xyXG5cdFx0cmVnaXN0ZXJfZ2xvYmFsX2hlbHBlcnM6IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHR2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG5cdFx0XHR3aW5kb3cud3BiY19iZmJfcHVibGlzaF9fb3BlbiA9IGZ1bmN0aW9uKCByZXNvdXJjZV9pZCwgc2hvcnRjb2RlX3JhdyApIHtcclxuXHRcdFx0XHRzZWxmLm9wZW5fbW9kYWwoIHJlc291cmNlX2lkLCBzaG9ydGNvZGVfcmF3ICk7XHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHR3aW5kb3cud3BiY19tb2RhbF9kaWFsb2dfX3Nob3dfX3Jlc291cmNlX3B1Ymxpc2ggPSBmdW5jdGlvbiggcmVzb3VyY2VfaWQgKSB7XHJcblx0XHRcdFx0c2VsZi5vcGVuX21vZGFsKCByZXNvdXJjZV9pZCwgJycgKTtcclxuXHRcdFx0fTtcclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZXNldCBtb2RhbCB0byBkZWZhdWx0IHN0YXRlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4gdm9pZFxyXG5cdFx0ICovXHJcblx0XHRyZXNldF9tb2RhbDogZnVuY3Rpb24oKSB7XHJcblx0XHRcdHZhciAkbW9kYWwgPSB0aGlzLmdldF9tb2RhbCgpO1xyXG5cclxuXHRcdFx0aWYgKCAhICRtb2RhbC5sZW5ndGggKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQkbW9kYWwuZmluZCggJy53cGJjX2JmYl9wdWJsaXNoX19ub3RpY2UnICkuaHRtbCggJycgKTtcclxuXHRcdFx0JG1vZGFsLmZpbmQoICcud3BiY19iZmJfcHVibGlzaF9fc2F2ZV9zdGVwJyApLmhpZGUoKTtcclxuXHRcdFx0JG1vZGFsLmZpbmQoICcud3BiY19iZmJfcHVibGlzaF9fY2hvb3NlcicgKS5oaWRlKCk7XHJcblx0XHRcdCRtb2RhbC5maW5kKCAnLndwYmNfYmZiX3B1Ymxpc2hfX3BhbmVsJyApLmhpZGUoKTtcclxuXHRcdFx0JG1vZGFsLmZpbmQoICcubW9kYWwtZm9vdGVyJyApLmhpZGUoKTtcclxuXHRcdFx0JG1vZGFsLmZpbmQoICcud3BiY19iZmJfcHVibGlzaF9fcmVzdWx0X2FjdGlvbnMnICkuaGlkZSgpO1xyXG5cclxuXHRcdFx0JG1vZGFsLmZpbmQoICdbZGF0YS13cGJjLWJmYi1wdWJsaXNoLW9wZW4tcGFnZT1cIjFcIl0nICkuaGlkZSgpLmF0dHIoICdocmVmJywgJyMnICk7XHJcblx0XHRcdCRtb2RhbC5maW5kKCAnW2RhdGEtd3BiYy1iZmItcHVibGlzaC1lZGl0LXBhZ2U9XCIxXCJdJyApLmhpZGUoKS5hdHRyKCAnaHJlZicsICcjJyApO1xyXG5cdFx0fSxcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFNob3cgaW5pdGlhbCBzYXZlIHN0ZXAuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB2b2lkXHJcblx0XHQgKi9cclxuXHRcdHNob3dfc2F2ZV9zdGVwOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0dmFyICRtb2RhbCA9IHRoaXMuZ2V0X21vZGFsKCk7XHJcblxyXG5cdFx0XHRpZiAoICEgJG1vZGFsLmxlbmd0aCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdCRtb2RhbC5maW5kKCAnLndwYmNfYmZiX3B1Ymxpc2hfX2Nob29zZXInICkuaGlkZSgpO1xyXG5cdFx0XHQkbW9kYWwuZmluZCggJy53cGJjX2JmYl9wdWJsaXNoX19wYW5lbCcgKS5oaWRlKCk7XHJcblx0XHRcdCRtb2RhbC5maW5kKCAnLndwYmNfYmZiX3B1Ymxpc2hfX3Jlc3VsdF9hY3Rpb25zJyApLmhpZGUoKTtcclxuXHRcdFx0JG1vZGFsLmZpbmQoICcud3BiY19iZmJfcHVibGlzaF9fc2F2ZV9zdGVwJyApLnNob3coKTtcclxuXHRcdFx0JG1vZGFsLmZpbmQoICcubW9kYWwtZm9vdGVyJyApLmhpZGUoKTtcclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTaG93IGNob29zZXIgc3RlcC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHZvaWRcclxuXHRcdCAqL1xyXG5cdFx0c2hvd19jaG9vc2VyX3N0ZXA6IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHR2YXIgJG1vZGFsID0gdGhpcy5nZXRfbW9kYWwoKTtcclxuXHJcblx0XHRcdGlmICggISAkbW9kYWwubGVuZ3RoICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0JG1vZGFsLmZpbmQoICcud3BiY19iZmJfcHVibGlzaF9fbm90aWNlJyApLmh0bWwoICcnICk7XHJcblx0XHRcdCRtb2RhbC5maW5kKCAnLndwYmNfYmZiX3B1Ymxpc2hfX3NhdmVfc3RlcCcgKS5oaWRlKCk7XHJcblx0XHRcdCRtb2RhbC5maW5kKCAnLndwYmNfYmZiX3B1Ymxpc2hfX3BhbmVsJyApLmhpZGUoKTtcclxuXHRcdFx0JG1vZGFsLmZpbmQoICcud3BiY19iZmJfcHVibGlzaF9fcmVzdWx0X2FjdGlvbnMnICkuaGlkZSgpO1xyXG5cdFx0XHQkbW9kYWwuZmluZCggJy53cGJjX2JmYl9wdWJsaXNoX19jaG9vc2VyJyApLnNob3coKTtcclxuXHRcdFx0JG1vZGFsLmZpbmQoICcubW9kYWwtZm9vdGVyJyApLnNob3coKTtcclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBPcGVuIG1vZGFsIGZyb20gdG9vbGJhciBidXR0b24uXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGV2ZW50ICAgQ2xpY2sgZXZlbnQuXHJcblx0XHQgKiBAcGFyYW0ge2pRdWVyeX0gJGJ1dHRvbiBCdXR0b24uXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB2b2lkXHJcblx0XHQgKi9cclxuXHRcdG9wZW5fZnJvbV9idXR0b246IGZ1bmN0aW9uKCBldmVudCwgJGJ1dHRvbiApIHtcclxuXHRcdFx0dmFyIHZhcnMgICAgICAgICA9IHRoaXMuZ2V0X3ZhcnMoKTtcclxuXHRcdFx0dmFyIHJlc291cmNlX2lkO1xyXG5cdFx0XHR2YXIgc2hvcnRjb2RlX3JhdztcclxuXHRcdFx0dmFyIGZvcm1fbmFtZTtcclxuXHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG5cdFx0XHRyZXNvdXJjZV9pZCAgID0gJGJ1dHRvbi5hdHRyKCAnZGF0YS13cGJjLWJmYi1yZXNvdXJjZS1pZCcgKSB8fCB2YXJzLmRlZmF1bHRfcmVzb3VyY2VfaWQgfHwgMTtcclxuXHRcdFx0Zm9ybV9uYW1lICAgICA9IHRoaXMuZ2V0X2N1cnJlbnRfZm9ybV9uYW1lKCk7XHJcblx0XHRcdHNob3J0Y29kZV9yYXcgPSAkYnV0dG9uLmF0dHIoICdkYXRhLXdwYmMtYmZiLXNob3J0Y29kZS1yYXcnICkgfHwgdmFycy5kZWZhdWx0X3Nob3J0Y29kZV9yYXcgfHwgJyc7XHJcblxyXG5cdFx0XHRzaG9ydGNvZGVfcmF3ID0gdGhpcy5ub3JtYWxpemVfc2hvcnRjb2RlX3Jhdyggc2hvcnRjb2RlX3JhdywgcmVzb3VyY2VfaWQsIGZvcm1fbmFtZSApO1xyXG5cclxuXHRcdFx0JGJ1dHRvbi5hdHRyKCAnZGF0YS13cGJjLWJmYi1zaG9ydGNvZGUtcmF3Jywgc2hvcnRjb2RlX3JhdyApO1xyXG5cdFx0XHQkYnV0dG9uLmF0dHIoICdkYXRhLXdwYmMtYmZiLWZvcm0tbmFtZScsIGZvcm1fbmFtZSApO1xyXG5cclxuXHRcdFx0dGhpcy5vcGVuX21vZGFsKCByZXNvdXJjZV9pZCwgc2hvcnRjb2RlX3JhdyApO1xyXG5cdFx0fSxcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE9wZW4gbW9kYWwuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ8c3RyaW5nfSByZXNvdXJjZV9pZCAgUmVzb3VyY2UgSUQuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICAgIHNob3J0Y29kZV9yYXcgU2hvcnRjb2RlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4gdm9pZFxyXG5cdFx0ICovXHJcblx0XHRvcGVuX21vZGFsOiBmdW5jdGlvbiggcmVzb3VyY2VfaWQsIHNob3J0Y29kZV9yYXcgKSB7XHJcblx0XHRcdHZhciAkbW9kYWwgPSB0aGlzLmdldF9tb2RhbCgpO1xyXG5cdFx0XHR2YXIgdmFycyAgID0gdGhpcy5nZXRfdmFycygpO1xyXG5cdFx0XHR2YXIgZm9ybV9uYW1lO1xyXG5cclxuXHRcdFx0aWYgKCAhICRtb2RhbC5sZW5ndGggKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXNvdXJjZV9pZCAgID0gdGhpcy5ub3JtYWxpemVfcmVzb3VyY2VfaWQoIHJlc291cmNlX2lkIHx8IHZhcnMuZGVmYXVsdF9yZXNvdXJjZV9pZCB8fCAxICk7XHJcblx0XHRcdGZvcm1fbmFtZSAgICAgPSB0aGlzLmdldF9jdXJyZW50X2Zvcm1fbmFtZSgpO1xyXG5cdFx0XHRzaG9ydGNvZGVfcmF3ID0gdGhpcy5ub3JtYWxpemVfc2hvcnRjb2RlX3Jhdyggc2hvcnRjb2RlX3JhdyB8fCB2YXJzLmRlZmF1bHRfc2hvcnRjb2RlX3JhdyB8fCAnJywgcmVzb3VyY2VfaWQsIGZvcm1fbmFtZSApO1xyXG5cclxuXHRcdFx0dGhpcy5yZXNldF9tb2RhbCgpO1xyXG5cclxuXHRcdFx0JG1vZGFsLmZpbmQoICcjd3BiY19iZmJfcHVibGlzaF9fcmVzb3VyY2VfaWQnICkudmFsKCByZXNvdXJjZV9pZCApO1xyXG5cdFx0XHQkbW9kYWwuZmluZCggJyN3cGJjX2JmYl9wdWJsaXNoX19mb3JtX25hbWUnICkudmFsKCBmb3JtX25hbWUgKTtcclxuXHRcdFx0JG1vZGFsLmZpbmQoICcjd3BiY19iZmJfcHVibGlzaF9fc2hvcnRjb2RlX3JhdycgKS52YWwoIHNob3J0Y29kZV9yYXcgKTtcclxuXHRcdFx0JG1vZGFsLmZpbmQoICcjd3BiY19iZmJfcHVibGlzaF9wYWdlX3RpdGxlJyApLnZhbCggJycgKTtcclxuXHRcdFx0JG1vZGFsLmZpbmQoICcjd3BiY19iZmJfcHVibGlzaF9wYWdlX2lkJyApLnZhbCggJzAnICk7XHJcblxyXG5cdFx0XHRpZiAoIHR5cGVvZiAkbW9kYWwud3BiY19teV9tb2RhbCA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHQkbW9kYWwud3BiY19teV9tb2RhbCggJ3Nob3cnICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0JG1vZGFsLnNob3coKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCBwYXJzZUludCggdmFycy5pc19kZW1vIHx8IDAsIDEwICkgIT09IDEgKSB7XHJcblx0XHRcdFx0dGhpcy5zaG93X3NhdmVfc3RlcCgpO1xyXG5cdFx0XHR9XHJcblx0XHR9LFxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogT3BlbiBzZWxlY3RlZCBtb2RlIHBhbmVsLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBldmVudCBDbGljayBldmVudC5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBtb2RlICBNb2RlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4gdm9pZFxyXG5cdFx0ICovXHJcblx0XHRvcGVuX21vZGVfcGFuZWw6IGZ1bmN0aW9uKCBldmVudCwgbW9kZSApIHtcclxuXHRcdFx0dmFyICRtb2RhbCA9IHRoaXMuZ2V0X21vZGFsKCk7XHJcblxyXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cclxuXHRcdFx0aWYgKCAhICRtb2RhbC5sZW5ndGggKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQkbW9kYWwuZmluZCggJy53cGJjX2JmYl9wdWJsaXNoX19ub3RpY2UnICkuaHRtbCggJycgKTtcclxuXHRcdFx0JG1vZGFsLmZpbmQoICcud3BiY19iZmJfcHVibGlzaF9fc2F2ZV9zdGVwJyApLmhpZGUoKTtcclxuXHRcdFx0JG1vZGFsLmZpbmQoICcud3BiY19iZmJfcHVibGlzaF9fY2hvb3NlcicgKS5oaWRlKCk7XHJcblx0XHRcdCRtb2RhbC5maW5kKCAnLndwYmNfYmZiX3B1Ymxpc2hfX3BhbmVsJyApLmhpZGUoKTtcclxuXHRcdFx0JG1vZGFsLmZpbmQoICcud3BiY19iZmJfcHVibGlzaF9fcGFuZWwtLScgKyBtb2RlICkuc2hvdygpO1xyXG5cdFx0XHQkbW9kYWwuZmluZCggJy5tb2RhbC1mb290ZXInICkuc2hvdygpO1xyXG5cdFx0XHQkbW9kYWwuZmluZCggJy53cGJjX2JmYl9wdWJsaXNoX19yZXN1bHRfYWN0aW9ucycgKS5oaWRlKCk7XHJcblx0XHR9LFxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmV0dXJuIGZyb20gY3VycmVudCBzdGVwLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBldmVudCBDbGljayBldmVudC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHZvaWRcclxuXHRcdCAqL1xyXG5cdFx0Z29fYmFjazogZnVuY3Rpb24oIGV2ZW50ICkge1xyXG5cdFx0XHR2YXIgJG1vZGFsID0gdGhpcy5nZXRfbW9kYWwoKTtcclxuXHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG5cdFx0XHRpZiAoICEgJG1vZGFsLmxlbmd0aCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdCRtb2RhbC5maW5kKCAnLndwYmNfYmZiX3B1Ymxpc2hfX25vdGljZScgKS5odG1sKCAnJyApO1xyXG5cdFx0XHQkbW9kYWwuZmluZCggJy53cGJjX2JmYl9wdWJsaXNoX19yZXN1bHRfYWN0aW9ucycgKS5oaWRlKCk7XHJcblxyXG5cdFx0XHRpZiAoICRtb2RhbC5maW5kKCAnLndwYmNfYmZiX3B1Ymxpc2hfX3BhbmVsOnZpc2libGUnICkubGVuZ3RoICkge1xyXG5cdFx0XHRcdHRoaXMuc2hvd19jaG9vc2VyX3N0ZXAoKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggJG1vZGFsLmZpbmQoICcud3BiY19iZmJfcHVibGlzaF9fY2hvb3Nlcjp2aXNpYmxlJyApLmxlbmd0aCApIHtcclxuXHRcdFx0XHR0aGlzLnNob3dfc2F2ZV9zdGVwKCk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLnNob3dfc2F2ZV9zdGVwKCk7XHJcblx0XHR9LFxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVuZGVyIG5vdGljZSBpbnNpZGUgbW9kYWwuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgICAgc3VjY2VzcyB8IGVycm9yIHwgaW5mb1xyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgTWVzc2FnZSBIVE1MLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4gdm9pZFxyXG5cdFx0ICovXHJcblx0XHRyZW5kZXJfbm90aWNlOiBmdW5jdGlvbiggdHlwZSwgbWVzc2FnZSApIHtcclxuXHRcdFx0dmFyICRtb2RhbCAgICAgPSB0aGlzLmdldF9tb2RhbCgpO1xyXG5cdFx0XHR2YXIgY3NzX2NsYXNzICA9ICdub3RpY2UtaW5mbyc7XHJcblxyXG5cdFx0XHRpZiAoICEgJG1vZGFsLmxlbmd0aCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggJ3N1Y2Nlc3MnID09PSB0eXBlICkge1xyXG5cdFx0XHRcdGNzc19jbGFzcyA9ICdub3RpY2Utc3VjY2Vzcyc7XHJcblx0XHRcdH0gZWxzZSBpZiAoICdlcnJvcicgPT09IHR5cGUgKSB7XHJcblx0XHRcdFx0Y3NzX2NsYXNzID0gJ25vdGljZS1lcnJvcic7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdCRtb2RhbC5maW5kKCAnLndwYmNfYmZiX3B1Ymxpc2hfX25vdGljZScgKS5odG1sKFxyXG5cdFx0XHRcdCc8ZGl2IGNsYXNzPVwid3BiYy1zZXR0aW5ncy1ub3RpY2Ugbm90aWNlICcgKyBjc3NfY2xhc3MgKyAnXCIgc3R5bGU9XCJ0ZXh0LWFsaWduOmxlZnQ7Zm9udC1zaXplOjFyZW07bWFyZ2luLXRvcDowO1wiPicgK1xyXG5cdFx0XHRcdFx0bWVzc2FnZSArXHJcblx0XHRcdFx0JzwvZGl2PidcclxuXHRcdFx0KTtcclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTdGFydCBzYXZlIGZsb3cgYW5kIGNvbnRpbnVlIHRvIGNob29zZXIgYWZ0ZXIgc2F2ZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZXZlbnQgICAgICAgQ2xpY2sgZXZlbnQuXHJcblx0XHQgKiBAcGFyYW0ge2pRdWVyeX0gJHNhdmVfYnV0dG9uIFNhdmUgYnV0dG9uLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4gdm9pZFxyXG5cdFx0ICovXHJcblx0XHRzdGFydF9zYXZlX2FuZF9jb250aW51ZTogZnVuY3Rpb24oIGV2ZW50LCAkc2F2ZV9idXR0b24gKSB7XHJcblx0XHRcdHZhciBzZWxmICAgICAgICA9IHRoaXM7XHJcblx0XHRcdHZhciB2YXJzICAgICAgICA9IHRoaXMuZ2V0X3ZhcnMoKTtcclxuXHRcdFx0dmFyIGkxOG4gICAgICAgID0gdGhpcy5nZXRfaTE4bigpO1xyXG5cdFx0XHR2YXIgc2F2ZV9mbiAgICAgPSB3aW5kb3cud3BiY19iZmJfX2FqYXhfc2F2ZV9jdXJyZW50X2Zvcm07XHJcblx0XHRcdHZhciBzYXZlX3Jlc3VsdCA9IG51bGw7XHJcblx0XHRcdHZhciBoYXNfYXN5bmNfaGFuZGxlID0gZmFsc2U7XHJcblx0XHRcdHZhciBmaW5pc2hlZCAgICA9IGZhbHNlO1xyXG5cdFx0XHR2YXIgYnVzeV9zZWVuICAgPSBmYWxzZTtcclxuXHRcdFx0dmFyIHBvbGxfaWQgICAgID0gbnVsbDtcclxuXHRcdFx0dmFyIHF1aWNrX2lkICAgID0gbnVsbDtcclxuXHRcdFx0dmFyIHRpbWVvdXRfaWQgID0gbnVsbDtcclxuXHRcdFx0dmFyIGV2ZW50X25hbWVzLCBldmVudF9oYW5kbGVycztcclxuXHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG5cdFx0XHRpZiAoIHBhcnNlSW50KCB2YXJzLmlzX2RlbW8gfHwgMCwgMTAgKSA9PT0gMSApIHtcclxuXHRcdFx0XHR0aGlzLnJlbmRlcl9ub3RpY2UoICdlcnJvcicsIGkxOG4uZGVtb19lcnJvciB8fCAnVGhpcyBvcGVyYXRpb24gaXMgcmVzdHJpY3RlZCBpbiB0aGUgZGVtbyB2ZXJzaW9uLicgKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHNhdmVfZm4gKSB7XHJcblx0XHRcdFx0dGhpcy5yZW5kZXJfbm90aWNlKCAnZXJyb3InLCBpMThuLnNhdmVfZm5fbWlzc2luZyB8fCAnU2F2ZSBmdW5jdGlvbiBpcyBub3QgYXZhaWxhYmxlLiBZb3UgY2FuIHVzZSBTa2lwIHRvIGNvbnRpbnVlIHdpdGhvdXQgc2F2aW5nLicgKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMucmVuZGVyX25vdGljZSggJ2luZm8nLCBpMThuLnNhdmluZ19mb3JtIHx8ICdTYXZpbmcgYm9va2luZyBmb3JtLi4uJyApO1xyXG5cdFx0XHQkc2F2ZV9idXR0b24ucHJvcCggJ2Rpc2FibGVkJywgdHJ1ZSApLmFkZENsYXNzKCAnZGlzYWJsZWQnICk7XHJcblxyXG5cdFx0XHRldmVudF9uYW1lcyA9IGFycmF5X29yX2xpc3RfdG9fYXJyYXkoIFtcclxuXHRcdFx0XHQnd3BiYzpiZmI6Zm9ybTphamF4X3NhdmVkJyxcclxuXHRcdFx0XHQnd3BiYzpiZmI6Zm9ybTpzYXZlZCcsXHJcblx0XHRcdFx0J3dwYmM6YmZiOnNhdmU6ZG9uZScsXHJcblx0XHRcdFx0J3dwYmM6YmZiOmFqYXhfc2F2ZWQnXHJcblx0XHRcdF0gKTtcclxuXHRcdFx0ZXZlbnRfaGFuZGxlcnMgPSBbXTtcclxuXHJcblx0XHRcdGZ1bmN0aW9uIGNsZWFudXAoKSB7XHJcblx0XHRcdFx0dmFyIGk7XHJcblxyXG5cdFx0XHRcdGlmICggcG9sbF9pZCApIHtcclxuXHRcdFx0XHRcdHdpbmRvdy5jbGVhckludGVydmFsKCBwb2xsX2lkICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmICggcXVpY2tfaWQgKSB7XHJcblx0XHRcdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KCBxdWlja19pZCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRpZiAoIHRpbWVvdXRfaWQgKSB7XHJcblx0XHRcdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KCB0aW1lb3V0X2lkICk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRmb3IgKCBpID0gMDsgaSA8IGV2ZW50X25hbWVzLmxlbmd0aDsgaSsrICkge1xyXG5cdFx0XHRcdFx0aWYgKCBldmVudF9oYW5kbGVyc1tpXSApIHtcclxuXHRcdFx0XHRcdFx0ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggZXZlbnRfbmFtZXNbaV0sIGV2ZW50X2hhbmRsZXJzW2ldICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQkc2F2ZV9idXR0b24ucHJvcCggJ2Rpc2FibGVkJywgZmFsc2UgKS5yZW1vdmVDbGFzcyggJ2Rpc2FibGVkJyApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRmdW5jdGlvbiBmaW5pc2hfc3VjY2VzcygpIHtcclxuXHRcdFx0XHRpZiAoIGZpbmlzaGVkICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRmaW5pc2hlZCA9IHRydWU7XHJcblxyXG5cdFx0XHRcdGNsZWFudXAoKTtcclxuXHJcblx0XHRcdFx0c2VsZi5yZWZyZXNoX3B1Ymxpc2hfYnV0dG9uX3Nob3J0Y29kZXMoIHNlbGYuZ2V0X2N1cnJlbnRfZm9ybV9uYW1lKCkgKTtcclxuXHRcdFx0XHRzZWxmLnJlbmRlcl9ub3RpY2UoICdzdWNjZXNzJywgaTE4bi5zYXZlX3N1Y2Nlc3MgfHwgJ0Jvb2tpbmcgZm9ybSBoYXMgYmVlbiBzYXZlZC4gQ29udGludWUgd2l0aCBwdWJsaXNoaW5nLicgKTtcclxuXHRcdFx0XHRzZWxmLnNob3dfY2hvb3Nlcl9zdGVwKCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGZ1bmN0aW9uIGZpbmlzaF9lcnJvciggbWVzc2FnZSApIHtcclxuXHRcdFx0XHRpZiAoIGZpbmlzaGVkICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRmaW5pc2hlZCA9IHRydWU7XHJcblxyXG5cdFx0XHRcdGNsZWFudXAoKTtcclxuXHJcblx0XHRcdFx0c2VsZi5yZW5kZXJfbm90aWNlKCAnZXJyb3InLCBtZXNzYWdlIHx8IGkxOG4uc2F2ZV9mYWlsZWQgfHwgJ1VuYWJsZSB0byBjb25maXJtIHRoYXQgdGhlIGJvb2tpbmcgZm9ybSB3YXMgc2F2ZWQuJyApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdHNhdmVfcmVzdWx0ID0gc2F2ZV9mbiggJHNhdmVfYnV0dG9uLmdldCggMCApICk7XHJcblx0XHRcdH0gY2F0Y2ggKCBlcnIgKSB7XHJcblx0XHRcdFx0ZmluaXNoX2Vycm9yKCBpMThuLnNhdmVfZmFpbGVkIHx8ICdVbmFibGUgdG8gY29uZmlybSB0aGF0IHRoZSBib29raW5nIGZvcm0gd2FzIHNhdmVkLicgKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggdHJ1ZSA9PT0gc2F2ZV9yZXN1bHQgKSB7XHJcblx0XHRcdFx0ZmluaXNoX3N1Y2Nlc3MoKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggZmFsc2UgPT09IHNhdmVfcmVzdWx0ICkge1xyXG5cdFx0XHRcdGZpbmlzaF9lcnJvciggaTE4bi5zYXZlX2ZhaWxlZCB8fCAnVW5hYmxlIHRvIGNvbmZpcm0gdGhhdCB0aGUgYm9va2luZyBmb3JtIHdhcyBzYXZlZC4nICk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIHNhdmVfcmVzdWx0ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBzYXZlX3Jlc3VsdC50aGVuICkge1xyXG5cdFx0XHRcdGhhc19hc3luY19oYW5kbGUgPSB0cnVlO1xyXG5cdFx0XHRcdHNhdmVfcmVzdWx0LnRoZW4oXHJcblx0XHRcdFx0XHRmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRcdFx0ZmluaXNoX3N1Y2Nlc3MoKTtcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRcdFx0ZmluaXNoX2Vycm9yKCBpMThuLnNhdmVfZmFpbGVkIHx8ICdVbmFibGUgdG8gY29uZmlybSB0aGF0IHRoZSBib29raW5nIGZvcm0gd2FzIHNhdmVkLicgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHQpO1xyXG5cdFx0XHR9IGVsc2UgaWYgKCBzYXZlX3Jlc3VsdCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygc2F2ZV9yZXN1bHQuZG9uZSAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygc2F2ZV9yZXN1bHQuZmFpbCApIHtcclxuXHRcdFx0XHRoYXNfYXN5bmNfaGFuZGxlID0gdHJ1ZTtcclxuXHRcdFx0XHRzYXZlX3Jlc3VsdFxyXG5cdFx0XHRcdFx0LmRvbmUoXHJcblx0XHRcdFx0XHRcdGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdFx0XHRcdGZpbmlzaF9zdWNjZXNzKCk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdClcclxuXHRcdFx0XHRcdC5mYWlsKFxyXG5cdFx0XHRcdFx0XHRmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRcdFx0XHRmaW5pc2hfZXJyb3IoIGkxOG4uc2F2ZV9mYWlsZWQgfHwgJ1VuYWJsZSB0byBjb25maXJtIHRoYXQgdGhlIGJvb2tpbmcgZm9ybSB3YXMgc2F2ZWQuJyApO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHQpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRldmVudF9uYW1lcy5mb3JFYWNoKFxyXG5cdFx0XHRcdGZ1bmN0aW9uKCBldmVudF9uYW1lLCBpbmRleCApIHtcclxuXHRcdFx0XHRcdGV2ZW50X2hhbmRsZXJzW2luZGV4XSA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdFx0XHRmaW5pc2hfc3VjY2VzcygpO1xyXG5cdFx0XHRcdFx0fTtcclxuXHRcdFx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoIGV2ZW50X25hbWUsIGV2ZW50X2hhbmRsZXJzW2luZGV4XSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0KTtcclxuXHJcblx0XHRcdHBvbGxfaWQgPSB3aW5kb3cuc2V0SW50ZXJ2YWwoXHJcblx0XHRcdFx0ZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0XHRpZiAoIGZpbmlzaGVkICkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYgKCAkc2F2ZV9idXR0b24uaGFzQ2xhc3MoICd3cGJjLWlzLWJ1c3knICkgKSB7XHJcblx0XHRcdFx0XHRcdGJ1c3lfc2VlbiA9IHRydWU7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRpZiAoIGJ1c3lfc2VlbiApIHtcclxuXHRcdFx0XHRcdFx0ZmluaXNoX3N1Y2Nlc3MoKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdDI1MFxyXG5cdFx0XHQpO1xyXG5cclxuXHRcdFx0cXVpY2tfaWQgPSB3aW5kb3cuc2V0VGltZW91dChcclxuXHRcdFx0XHRmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRcdGlmICggZmluaXNoZWQgKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRpZiAoICEgaGFzX2FzeW5jX2hhbmRsZSAmJiAhIGJ1c3lfc2VlbiApIHtcclxuXHRcdFx0XHRcdFx0ZmluaXNoX3N1Y2Nlc3MoKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdDEwMDBcclxuXHRcdFx0KTtcclxuXHJcblx0XHRcdHRpbWVvdXRfaWQgPSB3aW5kb3cuc2V0VGltZW91dChcclxuXHRcdFx0XHRmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRcdGlmICggZmluaXNoZWQgKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRmaW5pc2hfZXJyb3IoIGkxOG4uc2F2ZV90aW1lb3V0IHx8ICdTYXZpbmcgaXMgdGFraW5nIGxvbmdlciB0aGFuIGV4cGVjdGVkLiBZb3UgY2FuIHdhaXQgYSBsaXR0bGUgbG9uZ2VyIG9yIHVzZSBTa2lwIHRvIGNvbnRpbnVlIHdpdGhvdXQgd2FpdGluZy4nICk7XHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHQyMDAwMFxyXG5cdFx0XHQpO1xyXG5cdFx0fSxcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFNob3cgc3VjY2VzcyBhY3Rpb24gYnV0dG9ucy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcmVzcG9uc2VfZGF0YSBBSkFYIHN1Y2Nlc3MgZGF0YS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHZvaWRcclxuXHRcdCAqL1xyXG5cdFx0c2hvd19yZXN1bHRfYWN0aW9uczogZnVuY3Rpb24oIHJlc3BvbnNlX2RhdGEgKSB7XHJcblx0XHRcdHZhciBpMThuICA9IHRoaXMuZ2V0X2kxOG4oKTtcclxuXHRcdFx0dmFyICRtb2RhbCA9IHRoaXMuZ2V0X21vZGFsKCk7XHJcblx0XHRcdHZhciAkd3JhcCA9ICRtb2RhbC5maW5kKCAnLndwYmNfYmZiX3B1Ymxpc2hfX3Jlc3VsdF9hY3Rpb25zJyApO1xyXG5cdFx0XHR2YXIgJHZpZXcgPSAkbW9kYWwuZmluZCggJ1tkYXRhLXdwYmMtYmZiLXB1Ymxpc2gtb3Blbi1wYWdlPVwiMVwiXScgKTtcclxuXHRcdFx0dmFyICRlZGl0ID0gJG1vZGFsLmZpbmQoICdbZGF0YS13cGJjLWJmYi1wdWJsaXNoLWVkaXQtcGFnZT1cIjFcIl0nICk7XHJcblxyXG5cdFx0XHRpZiAoICEgJG1vZGFsLmxlbmd0aCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdCR2aWV3LmhpZGUoKTtcclxuXHRcdFx0JGVkaXQuaGlkZSgpO1xyXG5cclxuXHRcdFx0aWYgKCByZXNwb25zZV9kYXRhLnZpZXdfdXJsICkge1xyXG5cdFx0XHRcdCR2aWV3LmF0dHIoICdocmVmJywgcmVzcG9uc2VfZGF0YS52aWV3X3VybCApLnRleHQoIGkxOG4udmlld19wYWdlIHx8ICdPcGVuIFBhZ2UnICkuc2hvdygpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIHJlc3BvbnNlX2RhdGEuZWRpdF91cmwgKSB7XHJcblx0XHRcdFx0JGVkaXQuYXR0ciggJ2hyZWYnLCByZXNwb25zZV9kYXRhLmVkaXRfdXJsICkudGV4dCggaTE4bi5lZGl0X3BhZ2UgfHwgJ0VkaXQgUGFnZScgKS5zaG93KCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggcmVzcG9uc2VfZGF0YS52aWV3X3VybCB8fCByZXNwb25zZV9kYXRhLmVkaXRfdXJsICkge1xyXG5cdFx0XHRcdCR3cmFwLmNzcyggJ2Rpc3BsYXknLCAnZmxleCcgKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHQkd3JhcC5oaWRlKCk7XHJcblx0XHRcdH1cclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTdWJtaXQgcHVibGlzaCByZXF1ZXN0LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBldmVudCBDbGljayBldmVudC5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBtb2RlICBNb2RlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4gdm9pZFxyXG5cdFx0ICovXHJcblx0XHRzdWJtaXRfcHVibGlzaDogZnVuY3Rpb24oIGV2ZW50LCBtb2RlICkge1xyXG5cdFx0XHR2YXIgc2VsZiAgICAgICAgICA9IHRoaXM7XHJcblx0XHRcdHZhciB2YXJzICAgICAgICAgID0gdGhpcy5nZXRfdmFycygpO1xyXG5cdFx0XHR2YXIgaTE4biAgICAgICAgICA9IHRoaXMuZ2V0X2kxOG4oKTtcclxuXHRcdFx0dmFyICRtb2RhbCAgICAgICAgPSB0aGlzLmdldF9tb2RhbCgpO1xyXG5cdFx0XHR2YXIgcmVzb3VyY2VfaWQ7XHJcblx0XHRcdHZhciBmb3JtX25hbWU7XHJcblx0XHRcdHZhciBzaG9ydGNvZGVfcmF3O1xyXG5cdFx0XHR2YXIgcGFnZV9pZDtcclxuXHRcdFx0dmFyIHBhZ2VfdGl0bGU7XHJcblx0XHRcdHZhciAkc3VibWl0X2J1dHRvbjtcclxuXHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG5cdFx0XHRpZiAoICEgJG1vZGFsLmxlbmd0aCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggcGFyc2VJbnQoIHZhcnMuaXNfZGVtbyB8fCAwLCAxMCApID09PSAxICkge1xyXG5cdFx0XHRcdHRoaXMucmVuZGVyX25vdGljZSggJ2Vycm9yJywgaTE4bi5kZW1vX2Vycm9yIHx8ICdUaGlzIG9wZXJhdGlvbiBpcyByZXN0cmljdGVkIGluIHRoZSBkZW1vIHZlcnNpb24uJyApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmVzb3VyY2VfaWQgICA9IHRoaXMubm9ybWFsaXplX3Jlc291cmNlX2lkKCAkbW9kYWwuZmluZCggJyN3cGJjX2JmYl9wdWJsaXNoX19yZXNvdXJjZV9pZCcgKS52YWwoKSB8fCB2YXJzLmRlZmF1bHRfcmVzb3VyY2VfaWQgfHwgMSApO1xyXG5cdFx0XHRmb3JtX25hbWUgICAgID0gdGhpcy5zYW5pdGl6ZV9mb3JtX25hbWUoICRtb2RhbC5maW5kKCAnI3dwYmNfYmZiX3B1Ymxpc2hfX2Zvcm1fbmFtZScgKS52YWwoKSB8fCB0aGlzLmdldF9jdXJyZW50X2Zvcm1fbmFtZSgpICk7XHJcblx0XHRcdHNob3J0Y29kZV9yYXcgPSB0aGlzLm5vcm1hbGl6ZV9zaG9ydGNvZGVfcmF3KFxyXG5cdFx0XHRcdCRtb2RhbC5maW5kKCAnI3dwYmNfYmZiX3B1Ymxpc2hfX3Nob3J0Y29kZV9yYXcnICkudmFsKCkgfHwgdmFycy5kZWZhdWx0X3Nob3J0Y29kZV9yYXcgfHwgJycsXHJcblx0XHRcdFx0cmVzb3VyY2VfaWQsXHJcblx0XHRcdFx0Zm9ybV9uYW1lXHJcblx0XHRcdCk7XHJcblx0XHRcdHBhZ2VfaWQgICAgICAgPSAkbW9kYWwuZmluZCggJyN3cGJjX2JmYl9wdWJsaXNoX3BhZ2VfaWQnICkudmFsKCkgfHwgJyc7XHJcblx0XHRcdHBhZ2VfdGl0bGUgICAgPSB0cmltX3N0cmluZyggJG1vZGFsLmZpbmQoICcjd3BiY19iZmJfcHVibGlzaF9wYWdlX3RpdGxlJyApLnZhbCgpIHx8ICcnICk7XHJcblx0XHRcdCRzdWJtaXRfYnV0dG9uID0gJG1vZGFsLmZpbmQoICdbZGF0YS13cGJjLWJmYi1wdWJsaXNoLXN1Ym1pdD1cIicgKyBtb2RlICsgJ1wiXScgKTtcclxuXHJcblx0XHRcdCRtb2RhbC5maW5kKCAnI3dwYmNfYmZiX3B1Ymxpc2hfX2Zvcm1fbmFtZScgKS52YWwoIGZvcm1fbmFtZSApO1xyXG5cdFx0XHQkbW9kYWwuZmluZCggJyN3cGJjX2JmYl9wdWJsaXNoX19zaG9ydGNvZGVfcmF3JyApLnZhbCggc2hvcnRjb2RlX3JhdyApO1xyXG5cclxuXHRcdFx0aWYgKCAnZWRpdCcgPT09IG1vZGUgJiYgKCAhIHBhZ2VfaWQgfHwgJzAnID09PSBwYWdlX2lkICkgKSB7XHJcblx0XHRcdFx0dGhpcy5yZW5kZXJfbm90aWNlKCAnZXJyb3InLCBpMThuLnNlbGVjdF9wYWdlIHx8ICdQbGVhc2Ugc2VsZWN0IGFuIGV4aXN0aW5nIHBhZ2UuJyApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCAnY3JlYXRlJyA9PT0gbW9kZSAmJiAhIHBhZ2VfdGl0bGUgKSB7XHJcblx0XHRcdFx0dGhpcy5yZW5kZXJfbm90aWNlKCAnZXJyb3InLCBpMThuLmVudGVyX3BhZ2VfdGl0bGUgfHwgJ1BsZWFzZSBlbnRlciBhIHBhZ2UgdGl0bGUuJyApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5yZW5kZXJfbm90aWNlKCAnaW5mbycsIGkxOG4ubG9hZGluZyB8fCAnUHVibGlzaGluZyBib29raW5nIGZvcm0uLi4nICk7XHJcblx0XHRcdCRtb2RhbC5maW5kKCAnLndwYmNfYmZiX3B1Ymxpc2hfX3Jlc3VsdF9hY3Rpb25zJyApLmhpZGUoKTtcclxuXHJcblx0XHRcdCRzdWJtaXRfYnV0dG9uLnByb3AoICdkaXNhYmxlZCcsIHRydWUgKS5hZGRDbGFzcyggJ2Rpc2FibGVkJyApO1xyXG5cclxuXHRcdFx0JC5hamF4KFxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdHVybDogdmFycy5hamF4X3VybCxcclxuXHRcdFx0XHRcdHR5cGU6ICdQT1NUJyxcclxuXHRcdFx0XHRcdGRhdGFUeXBlOiAnanNvbicsXHJcblx0XHRcdFx0XHRkYXRhOiB7XHJcblx0XHRcdFx0XHRcdGFjdGlvbjogdmFycy5hY3Rpb24sXHJcblx0XHRcdFx0XHRcdG5vbmNlOiB2YXJzLm5vbmNlLFxyXG5cdFx0XHRcdFx0XHRwdWJsaXNoX21vZGU6IG1vZGUsXHJcblx0XHRcdFx0XHRcdHJlc291cmNlX2lkOiByZXNvdXJjZV9pZCxcclxuXHRcdFx0XHRcdFx0Zm9ybV9uYW1lOiBmb3JtX25hbWUsXHJcblx0XHRcdFx0XHRcdHNob3J0Y29kZV9yYXc6IHNob3J0Y29kZV9yYXcsXHJcblx0XHRcdFx0XHRcdHBhZ2VfaWQ6IHBhZ2VfaWQsXHJcblx0XHRcdFx0XHRcdHBhZ2VfdGl0bGU6IHBhZ2VfdGl0bGVcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdClcclxuXHRcdFx0XHQuZG9uZShcclxuXHRcdFx0XHRcdGZ1bmN0aW9uKCByZXNwb25zZSApIHtcclxuXHRcdFx0XHRcdFx0aWYgKCByZXNwb25zZSAmJiByZXNwb25zZS5zdWNjZXNzICYmIHJlc3BvbnNlLmRhdGEgKSB7XHJcblx0XHRcdFx0XHRcdFx0c2VsZi5yZW5kZXJfbm90aWNlKCAnc3VjY2VzcycsIHJlc3BvbnNlLmRhdGEubWVzc2FnZSB8fCAnJyApO1xyXG5cdFx0XHRcdFx0XHRcdHNlbGYuc2hvd19yZXN1bHRfYWN0aW9ucyggcmVzcG9uc2UuZGF0YSApO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRpZiAoIHJlc3BvbnNlLmRhdGEuZm9ybV9uYW1lICkge1xyXG5cdFx0XHRcdFx0XHRcdFx0d2luZG93LldQQkNfQkZCX0FqYXggICAgICAgICAgID0gd2luZG93LldQQkNfQkZCX0FqYXggfHwge307XHJcblx0XHRcdFx0XHRcdFx0XHR3aW5kb3cuV1BCQ19CRkJfQWpheC5mb3JtX25hbWUgPSBzZWxmLnNhbml0aXplX2Zvcm1fbmFtZSggcmVzcG9uc2UuZGF0YS5mb3JtX25hbWUgKTtcclxuXHRcdFx0XHRcdFx0XHRcdHNlbGYucmVmcmVzaF9wdWJsaXNoX2J1dHRvbl9zaG9ydGNvZGVzKCByZXNwb25zZS5kYXRhLmZvcm1fbmFtZSApO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0fSBlbHNlIGlmICggcmVzcG9uc2UgJiYgcmVzcG9uc2UuZGF0YSAmJiByZXNwb25zZS5kYXRhLm1lc3NhZ2UgKSB7XHJcblx0XHRcdFx0XHRcdFx0c2VsZi5yZW5kZXJfbm90aWNlKCAnZXJyb3InLCByZXNwb25zZS5kYXRhLm1lc3NhZ2UgKTtcclxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHRzZWxmLnJlbmRlcl9ub3RpY2UoICdlcnJvcicsIGkxOG4uZ2VuZXJpY19lcnJvciB8fCAnQW4gdW5leHBlY3RlZCBlcnJvciBvY2N1cnJlZCB3aGlsZSBwdWJsaXNoaW5nIHRoZSBib29raW5nIGZvcm0uJyApO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0KVxyXG5cdFx0XHRcdC5mYWlsKFxyXG5cdFx0XHRcdFx0ZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0XHRcdHNlbGYucmVuZGVyX25vdGljZSggJ2Vycm9yJywgaTE4bi5nZW5lcmljX2Vycm9yIHx8ICdBbiB1bmV4cGVjdGVkIGVycm9yIG9jY3VycmVkIHdoaWxlIHB1Ymxpc2hpbmcgdGhlIGJvb2tpbmcgZm9ybS4nICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0KVxyXG5cdFx0XHRcdC5hbHdheXMoXHJcblx0XHRcdFx0XHRmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRcdFx0JHN1Ym1pdF9idXR0b24ucHJvcCggJ2Rpc2FibGVkJywgZmFsc2UgKS5yZW1vdmVDbGFzcyggJ2Rpc2FibGVkJyApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdCk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogVHJpbSBzdHJpbmcgd2l0aG91dCB1c2luZyBqUXVlcnkudHJpbSgpLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHsqfSB2YWx1ZSBSYXcgdmFsdWUuXHJcblx0ICpcclxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gdHJpbV9zdHJpbmcoIHZhbHVlICkge1xyXG5cdFx0cmV0dXJuIFN0cmluZyggdmFsdWUgPT0gbnVsbCA/ICcnIDogdmFsdWUgKS50cmltKCk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBOb3JtYWxpemUgbGlzdCBoZWxwZXIuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0geyp9IGlucHV0IExpc3QtbGlrZSBpbnB1dC5cclxuXHQgKlxyXG5cdCAqIEByZXR1cm4ge0FycmF5fVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGFycmF5X29yX2xpc3RfdG9fYXJyYXkoIGlucHV0ICkge1xyXG5cdFx0aWYgKCBBcnJheS5pc0FycmF5KCBpbnB1dCApICkge1xyXG5cdFx0XHRyZXR1cm4gaW5wdXQ7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIFtdO1xyXG5cdH1cclxuXHJcblx0JCggZnVuY3Rpb24oKSB7XHJcblx0XHRwdWJsaXNoX2FwaS5pbml0KCk7XHJcblx0fSApO1xyXG5cclxufSkoIGpRdWVyeSwgd2luZG93LCBkb2N1bWVudCApOyJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUMsVUFBV0EsQ0FBQyxFQUFFQyxNQUFNLEVBQUVDLFFBQVEsRUFBRztFQUNqQyxZQUFZOztFQUVaLElBQUlDLFdBQVcsR0FBRztJQUVqQjtBQUNGO0FBQ0E7QUFDQTtBQUNBO0lBQ0VDLElBQUksRUFBRSxTQUFBQSxDQUFBLEVBQVc7TUFDaEIsSUFBSSxDQUFDQyxXQUFXLENBQUMsQ0FBQztNQUNsQixJQUFJLENBQUNDLDRCQUE0QixDQUFDLENBQUM7TUFDbkMsSUFBSSxDQUFDQyx1QkFBdUIsQ0FBQyxDQUFDO01BQzlCLElB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
