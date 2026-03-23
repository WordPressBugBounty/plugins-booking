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
      shortcode_raw = $.trim(String(shortcode_raw || ''));
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
      shortcode_raw = $.trim(String(shortcode_raw || ''));
      if (!shortcode_raw || 0 !== $.trim(shortcode_raw).indexOf('[booking')) {
        return this.build_default_shortcode_raw(resource_id, form_name);
      }
      shortcode_raw = this.upsert_shortcode_attr(shortcode_raw, 'resource_id', String(resource_id), '');
      shortcode_raw = this.upsert_shortcode_attr(shortcode_raw, 'form_type', form_name, '\'');
      return $.trim(shortcode_raw);
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
      page_title = $.trim($modal.find('#wpbc_bfb_publish_page_title').val() || '');
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvcHVibGlzaC9fb3V0L2JmYi1wdWJsaXNoLmpzIiwibmFtZXMiOlsiJCIsIndpbmRvdyIsImRvY3VtZW50IiwicHVibGlzaF9hcGkiLCJpbml0IiwiYmluZF9ldmVudHMiLCJiaW5kX2Zvcm1fYWpheF9sb2FkZWRfZXZlbnRzIiwicmVnaXN0ZXJfZ2xvYmFsX2hlbHBlcnMiLCJyZWZyZXNoX3B1Ymxpc2hfYnV0dG9uX3Nob3J0Y29kZXMiLCJnZXRfY3VycmVudF9mb3JtX25hbWUiLCJnZXRfdmFycyIsIndwYmNfYmZiX3B1Ymxpc2hfdmFycyIsImdldF9pMThuIiwidmFycyIsImkxOG4iLCJnZXRfbW9kYWwiLCJzZWxlY3RvciIsIm1vZGFsX3NlbGVjdG9yIiwic2FuaXRpemVfZm9ybV9uYW1lIiwiZm9ybV9uYW1lIiwiU3RyaW5nIiwidG9Mb3dlckNhc2UiLCJyZXBsYWNlIiwiZGVmYXVsdF9mb3JtX25hbWUiLCJub3JtYWxpemVfcmVzb3VyY2VfaWQiLCJyZXNvdXJjZV9pZCIsInBhcnNlSW50IiwiZGVmYXVsdF9yZXNvdXJjZV9pZCIsIldQQkNfQkZCX0FqYXgiLCJidWlsZF9kZWZhdWx0X3Nob3J0Y29kZV9yYXciLCJ1cHNlcnRfc2hvcnRjb2RlX2F0dHIiLCJzaG9ydGNvZGVfcmF3IiwiYXR0cl9uYW1lIiwiYXR0cl92YWx1ZSIsInF1b3RlX2NoYXIiLCJlc2NhcGVkX2F0dHJfbmFtZSIsInBhdHRlcm4iLCJyZXBsYWNlbWVudF92YWx1ZSIsInJlcGxhY2VtZW50IiwidHJpbSIsIlJlZ0V4cCIsInRlc3QiLCJub3JtYWxpemVfc2hvcnRjb2RlX3JhdyIsImluZGV4T2YiLCJzZWxmIiwiJGJ1dHRvbnMiLCJlYWNoIiwiJGJ1dHRvbiIsImF0dHIiLCJkZWZhdWx0X3Nob3J0Y29kZV9yYXciLCJfX3dwYmNfYmZiX3B1Ymxpc2hfX2Zvcm1fYWpheF9sb2FkZWRfYm91bmQiLCJhZGRFdmVudExpc3RlbmVyIiwiZXYiLCJkZXRhaWwiLCIkbW9kYWwiLCJsZW5ndGgiLCJmaW5kIiwidmFsIiwicGFzc2l2ZSIsIm9uIiwiZXZlbnQiLCJvcGVuX2Zyb21fYnV0dG9uIiwic3RhcnRfc2F2ZV9hbmRfY29udGludWUiLCJwcmV2ZW50RGVmYXVsdCIsInNob3dfY2hvb3Nlcl9zdGVwIiwib3Blbl9tb2RlX3BhbmVsIiwic3VibWl0X3B1Ymxpc2giLCJnb19iYWNrIiwid3BiY19iZmJfcHVibGlzaF9fb3BlbiIsIm9wZW5fbW9kYWwiLCJ3cGJjX21vZGFsX2RpYWxvZ19fc2hvd19fcmVzb3VyY2VfcHVibGlzaCIsInJlc2V0X21vZGFsIiwiaHRtbCIsImhpZGUiLCJzaG93X3NhdmVfc3RlcCIsInNob3ciLCJ3cGJjX215X21vZGFsIiwiaXNfZGVtbyIsIm1vZGUiLCJyZW5kZXJfbm90aWNlIiwidHlwZSIsIm1lc3NhZ2UiLCJjc3NfY2xhc3MiLCIkc2F2ZV9idXR0b24iLCJzYXZlX2ZuIiwid3BiY19iZmJfX2FqYXhfc2F2ZV9jdXJyZW50X2Zvcm0iLCJzYXZlX3Jlc3VsdCIsImhhc19hc3luY19oYW5kbGUiLCJmaW5pc2hlZCIsImJ1c3lfc2VlbiIsInBvbGxfaWQiLCJxdWlja19pZCIsInRpbWVvdXRfaWQiLCJldmVudF9uYW1lcyIsImV2ZW50X2hhbmRsZXJzIiwiZGVtb19lcnJvciIsInNhdmVfZm5fbWlzc2luZyIsInNhdmluZ19mb3JtIiwicHJvcCIsImFkZENsYXNzIiwiYXJyYXlfb3JfbGlzdF90b19hcnJheSIsImNsZWFudXAiLCJpIiwiY2xlYXJJbnRlcnZhbCIsImNsZWFyVGltZW91dCIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJyZW1vdmVDbGFzcyIsImZpbmlzaF9zdWNjZXNzIiwic2F2ZV9zdWNjZXNzIiwiZmluaXNoX2Vycm9yIiwic2F2ZV9mYWlsZWQiLCJnZXQiLCJlcnIiLCJ0aGVuIiwiZG9uZSIsImZhaWwiLCJmb3JFYWNoIiwiZXZlbnRfbmFtZSIsImluZGV4Iiwic2V0SW50ZXJ2YWwiLCJoYXNDbGFzcyIsInNldFRpbWVvdXQiLCJzYXZlX3RpbWVvdXQiLCJzaG93X3Jlc3VsdF9hY3Rpb25zIiwicmVzcG9uc2VfZGF0YSIsIiR3cmFwIiwiJHZpZXciLCIkZWRpdCIsInZpZXdfdXJsIiwidGV4dCIsInZpZXdfcGFnZSIsImVkaXRfdXJsIiwiZWRpdF9wYWdlIiwiY3NzIiwicGFnZV9pZCIsInBhZ2VfdGl0bGUiLCIkc3VibWl0X2J1dHRvbiIsInNlbGVjdF9wYWdlIiwiZW50ZXJfcGFnZV90aXRsZSIsImxvYWRpbmciLCJhamF4IiwidXJsIiwiYWpheF91cmwiLCJkYXRhVHlwZSIsImRhdGEiLCJhY3Rpb24iLCJub25jZSIsInB1Ymxpc2hfbW9kZSIsInJlc3BvbnNlIiwic3VjY2VzcyIsImdlbmVyaWNfZXJyb3IiLCJhbHdheXMiLCJpbnB1dCIsIkFycmF5IiwiaXNBcnJheSIsImpRdWVyeSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL3B1Ymxpc2gvX3NyYy9iZmItcHVibGlzaC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogQkZCIFB1Ymxpc2ggbW9kYWwgY29udHJvbGxlci5cclxuICpcclxuICogUmVzcG9uc2liaWxpdGllczpcclxuICogLSBPcGVuIFB1Ymxpc2ggbW9kYWwgZnJvbSB0b29sYmFyIGJ1dHRvbi5cclxuICogLSBTdXBwb3J0IGxlZ2FjeSBpbmxpbmUgY2FsbDogd3BiY19tb2RhbF9kaWFsb2dfX3Nob3dfX3Jlc291cmNlX3B1Ymxpc2goIHJlc291cmNlX2lkICkuXHJcbiAqIC0gS2VlcCBzaG9ydGNvZGUgaW4gc3luYyB3aXRoIGN1cnJlbnQgZm9ybSBuYW1lLlxyXG4gKiAtIEFzayB1c2VyIHRvIHNhdmUgY3VycmVudCBmb3JtIGJlZm9yZSBwdWJsaXNoaW5nLlxyXG4gKiAtIFB1Ymxpc2ggc2hvcnRjb2RlIGludG8gZXhpc3RpbmcvbmV3IHBhZ2UgdmlhIEFKQVguXHJcbiAqIC0gU2hvdyBzdWNjZXNzL2Vycm9yIG1lc3NhZ2Ugd2l0aG91dCBwYWdlIHJlbG9hZC5cclxuICpcclxuICogQHBhY2thZ2UgICAgIEJvb2tpbmcgQ2FsZW5kYXJcclxuICogQHN1YnBhY2thZ2UgIEJvb2tpbmcgRm9ybSBCdWlsZGVyXHJcbiAqIEBzaW5jZSAgICAgICAxMS4wLjBcclxuICogQGZpbGUgICAgICAgIC4uL2luY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL3B1Ymxpc2gvX291dC9iZmItcHVibGlzaC5qc1xyXG4gKi9cclxuKGZ1bmN0aW9uICggJCwgd2luZG93LCBkb2N1bWVudCApIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdHZhciBwdWJsaXNoX2FwaSA9IHtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEluaXQgbW9kdWxlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4gdm9pZFxyXG5cdFx0ICovXHJcblx0XHRpbml0OiBmdW5jdGlvbigpIHtcclxuXHRcdFx0dGhpcy5iaW5kX2V2ZW50cygpO1xyXG5cdFx0XHR0aGlzLmJpbmRfZm9ybV9hamF4X2xvYWRlZF9ldmVudHMoKTtcclxuXHRcdFx0dGhpcy5yZWdpc3Rlcl9nbG9iYWxfaGVscGVycygpO1xyXG5cdFx0XHR0aGlzLnJlZnJlc2hfcHVibGlzaF9idXR0b25fc2hvcnRjb2RlcyggdGhpcy5nZXRfY3VycmVudF9mb3JtX25hbWUoKSApO1xyXG5cdFx0fSxcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEdldCBsb2NhbGl6ZWQgdmFycy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9XHJcblx0XHQgKi9cclxuXHRcdGdldF92YXJzOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0cmV0dXJuIHdpbmRvdy53cGJjX2JmYl9wdWJsaXNoX3ZhcnMgfHwge307XHJcblx0XHR9LFxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogR2V0IGkxOG4gdmFycy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9XHJcblx0XHQgKi9cclxuXHRcdGdldF9pMThuOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0dmFyIHZhcnMgPSB0aGlzLmdldF92YXJzKCk7XHJcblxyXG5cdFx0XHRyZXR1cm4gdmFycy5pMThuIHx8IHt9O1xyXG5cdFx0fSxcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEdldCBtb2RhbCBqUXVlcnkgb2JqZWN0LlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4ge2pRdWVyeX1cclxuXHRcdCAqL1xyXG5cdFx0Z2V0X21vZGFsOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0dmFyIHZhcnMgPSB0aGlzLmdldF92YXJzKCk7XHJcblx0XHRcdHZhciBzZWxlY3RvciA9IHZhcnMubW9kYWxfc2VsZWN0b3IgfHwgJyN3cGJjX2JmYl9tb2RhbF9fcHVibGlzaCc7XHJcblxyXG5cdFx0XHRyZXR1cm4gJCggc2VsZWN0b3IgKTtcclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTYW5pdGl6ZSBmb3JtIG5hbWUgc2ltaWxhciB0byBXUCBzYW5pdGl6ZV9rZXkoKS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gZm9ybV9uYW1lIEZvcm0gbmFtZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9XHJcblx0XHQgKi9cclxuXHRcdHNhbml0aXplX2Zvcm1fbmFtZTogZnVuY3Rpb24oIGZvcm1fbmFtZSApIHtcclxuXHRcdFx0Zm9ybV9uYW1lID0gU3RyaW5nKCBmb3JtX25hbWUgfHwgJycgKS50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0XHRmb3JtX25hbWUgPSBmb3JtX25hbWUucmVwbGFjZSggL1teYS16MC05Xy1dL2csICcnICk7XHJcblxyXG5cdFx0XHRpZiAoICEgZm9ybV9uYW1lICkge1xyXG5cdFx0XHRcdGZvcm1fbmFtZSA9IHRoaXMuZ2V0X3ZhcnMoKS5kZWZhdWx0X2Zvcm1fbmFtZSB8fCAnc3RhbmRhcmQnO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4gZm9ybV9uYW1lO1xyXG5cdFx0fSxcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE5vcm1hbGl6ZSByZXNvdXJjZSBJRC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcnxzdHJpbmd9IHJlc291cmNlX2lkIFJlc291cmNlIElELlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4ge251bWJlcn1cclxuXHRcdCAqL1xyXG5cdFx0bm9ybWFsaXplX3Jlc291cmNlX2lkOiBmdW5jdGlvbiggcmVzb3VyY2VfaWQgKSB7XHJcblx0XHRcdHJlc291cmNlX2lkID0gcGFyc2VJbnQoIHJlc291cmNlX2lkLCAxMCApO1xyXG5cclxuXHRcdFx0aWYgKCAhIHJlc291cmNlX2lkIHx8IHJlc291cmNlX2lkIDwgMSApIHtcclxuXHRcdFx0XHRyZXNvdXJjZV9pZCA9IHBhcnNlSW50KCB0aGlzLmdldF92YXJzKCkuZGVmYXVsdF9yZXNvdXJjZV9pZCB8fCAxLCAxMCApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoICEgcmVzb3VyY2VfaWQgfHwgcmVzb3VyY2VfaWQgPCAxICkge1xyXG5cdFx0XHRcdHJlc291cmNlX2lkID0gMTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIHJlc291cmNlX2lkO1xyXG5cdFx0fSxcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEdldCBjdXJyZW50IEJGQiBmb3JtIG5hbWUuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfVxyXG5cdFx0ICovXHJcblx0XHRnZXRfY3VycmVudF9mb3JtX25hbWU6IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHR2YXIgdmFycyA9IHRoaXMuZ2V0X3ZhcnMoKTtcclxuXHRcdFx0dmFyIGZvcm1fbmFtZSA9ICcnO1xyXG5cclxuXHRcdFx0aWYgKCB3aW5kb3cuV1BCQ19CRkJfQWpheCAmJiB3aW5kb3cuV1BCQ19CRkJfQWpheC5mb3JtX25hbWUgKSB7XHJcblx0XHRcdFx0Zm9ybV9uYW1lID0gd2luZG93LldQQkNfQkZCX0FqYXguZm9ybV9uYW1lO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoICEgZm9ybV9uYW1lICYmIHZhcnMuZGVmYXVsdF9mb3JtX25hbWUgKSB7XHJcblx0XHRcdFx0Zm9ybV9uYW1lID0gdmFycy5kZWZhdWx0X2Zvcm1fbmFtZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIHRoaXMuc2FuaXRpemVfZm9ybV9uYW1lKCBmb3JtX25hbWUgfHwgJ3N0YW5kYXJkJyApO1xyXG5cdFx0fSxcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEJ1aWxkIGRlZmF1bHQgc2hvcnRjb2RlIHJhdy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcnxzdHJpbmd9IHJlc291cmNlX2lkIFJlc291cmNlIElELlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICBmb3JtX25hbWUgICBGb3JtIG5hbWUuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfVxyXG5cdFx0ICovXHJcblx0XHRidWlsZF9kZWZhdWx0X3Nob3J0Y29kZV9yYXc6IGZ1bmN0aW9uKCByZXNvdXJjZV9pZCwgZm9ybV9uYW1lICkge1xyXG5cdFx0XHRyZXNvdXJjZV9pZCA9IHRoaXMubm9ybWFsaXplX3Jlc291cmNlX2lkKCByZXNvdXJjZV9pZCApO1xyXG5cdFx0XHRmb3JtX25hbWUgICA9IHRoaXMuc2FuaXRpemVfZm9ybV9uYW1lKCBmb3JtX25hbWUgKTtcclxuXHJcblx0XHRcdHJldHVybiBcIltib29raW5nIHJlc291cmNlX2lkPVwiICsgcmVzb3VyY2VfaWQgKyBcIiBmb3JtX3R5cGU9J1wiICsgZm9ybV9uYW1lICsgXCInXVwiO1xyXG5cdFx0fSxcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFVwc2VydCBvbmUgc2hvcnRjb2RlIGF0dHJpYnV0ZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gc2hvcnRjb2RlX3JhdyBTaG9ydGNvZGUuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gYXR0cl9uYW1lICAgICBBdHRyaWJ1dGUgbmFtZS5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBhdHRyX3ZhbHVlICAgIEF0dHJpYnV0ZSB2YWx1ZS5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBxdW90ZV9jaGFyICAgIFF1b3RlIGNoYXIuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfVxyXG5cdFx0ICovXHJcblx0XHR1cHNlcnRfc2hvcnRjb2RlX2F0dHI6IGZ1bmN0aW9uKCBzaG9ydGNvZGVfcmF3LCBhdHRyX25hbWUsIGF0dHJfdmFsdWUsIHF1b3RlX2NoYXIgKSB7XHJcblx0XHRcdHZhciBlc2NhcGVkX2F0dHJfbmFtZSwgcGF0dGVybiwgcmVwbGFjZW1lbnRfdmFsdWUsIHJlcGxhY2VtZW50O1xyXG5cclxuXHRcdFx0c2hvcnRjb2RlX3JhdyA9ICQudHJpbSggU3RyaW5nKCBzaG9ydGNvZGVfcmF3IHx8ICcnICkgKTtcclxuXHRcdFx0YXR0cl9uYW1lICAgICA9IFN0cmluZyggYXR0cl9uYW1lIHx8ICcnICk7XHJcblx0XHRcdGF0dHJfdmFsdWUgICAgPSBTdHJpbmcoIGF0dHJfdmFsdWUgfHwgJycgKTtcclxuXHRcdFx0cXVvdGVfY2hhciAgICA9IFN0cmluZyggcXVvdGVfY2hhciB8fCAnJyApO1xyXG5cclxuXHRcdFx0aWYgKCAhIGF0dHJfbmFtZSApIHtcclxuXHRcdFx0XHRyZXR1cm4gc2hvcnRjb2RlX3JhdztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmVwbGFjZW1lbnRfdmFsdWUgPSBhdHRyX3ZhbHVlO1xyXG5cdFx0XHRpZiAoIHF1b3RlX2NoYXIgKSB7XHJcblx0XHRcdFx0cmVwbGFjZW1lbnRfdmFsdWUgPSBxdW90ZV9jaGFyICsgYXR0cl92YWx1ZSArIHF1b3RlX2NoYXI7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJlcGxhY2VtZW50ICAgICAgID0gYXR0cl9uYW1lICsgJz0nICsgcmVwbGFjZW1lbnRfdmFsdWU7XHJcblx0XHRcdGVzY2FwZWRfYXR0cl9uYW1lID0gYXR0cl9uYW1lLnJlcGxhY2UoIC9bLVxcL1xcXFxeJCorPy4oKXxbXFxde31dL2csICdcXFxcJCYnICk7XHJcblx0XHRcdHBhdHRlcm4gICAgICAgICAgID0gbmV3IFJlZ0V4cCggXCJcXFxcYlwiICsgZXNjYXBlZF9hdHRyX25hbWUgKyBcIlxcXFxzKj1cXFxccyooPzpcXFwiW15cXFwiXSpcXFwifCdbXiddKid8W15cXFxcc1xcXFxdXSspXCIsICdpJyApO1xyXG5cclxuXHRcdFx0aWYgKCBwYXR0ZXJuLnRlc3QoIHNob3J0Y29kZV9yYXcgKSApIHtcclxuXHRcdFx0XHRyZXR1cm4gc2hvcnRjb2RlX3Jhdy5yZXBsYWNlKCBwYXR0ZXJuLCByZXBsYWNlbWVudCApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIC9cXF0kLy50ZXN0KCBzaG9ydGNvZGVfcmF3ICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuIHNob3J0Y29kZV9yYXcucmVwbGFjZSggL1xcXSQvLCAnICcgKyByZXBsYWNlbWVudCArICddJyApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4gc2hvcnRjb2RlX3JhdyArICcgJyArIHJlcGxhY2VtZW50O1xyXG5cdFx0fSxcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE5vcm1hbGl6ZSBzaG9ydGNvZGUgdG8gY3VycmVudCByZXNvdXJjZSArIGZvcm0gdHlwZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICAgIHNob3J0Y29kZV9yYXcgU2hvcnRjb2RlLlxyXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ8c3RyaW5nfSByZXNvdXJjZV9pZCAgIFJlc291cmNlIElELlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICBmb3JtX25hbWUgICAgIEZvcm0gbmFtZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9XHJcblx0XHQgKi9cclxuXHRcdG5vcm1hbGl6ZV9zaG9ydGNvZGVfcmF3OiBmdW5jdGlvbiggc2hvcnRjb2RlX3JhdywgcmVzb3VyY2VfaWQsIGZvcm1fbmFtZSApIHtcclxuXHRcdFx0cmVzb3VyY2VfaWQgICA9IHRoaXMubm9ybWFsaXplX3Jlc291cmNlX2lkKCByZXNvdXJjZV9pZCApO1xyXG5cdFx0XHRmb3JtX25hbWUgICAgID0gdGhpcy5zYW5pdGl6ZV9mb3JtX25hbWUoIGZvcm1fbmFtZSApO1xyXG5cdFx0XHRzaG9ydGNvZGVfcmF3ID0gJC50cmltKCBTdHJpbmcoIHNob3J0Y29kZV9yYXcgfHwgJycgKSApO1xyXG5cclxuXHRcdFx0aWYgKCAhIHNob3J0Y29kZV9yYXcgfHwgMCAhPT0gJC50cmltKCBzaG9ydGNvZGVfcmF3ICkuaW5kZXhPZiggJ1tib29raW5nJyApICkge1xyXG5cdFx0XHRcdHJldHVybiB0aGlzLmJ1aWxkX2RlZmF1bHRfc2hvcnRjb2RlX3JhdyggcmVzb3VyY2VfaWQsIGZvcm1fbmFtZSApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRzaG9ydGNvZGVfcmF3ID0gdGhpcy51cHNlcnRfc2hvcnRjb2RlX2F0dHIoIHNob3J0Y29kZV9yYXcsICdyZXNvdXJjZV9pZCcsIFN0cmluZyggcmVzb3VyY2VfaWQgKSwgJycgKTtcclxuXHRcdFx0c2hvcnRjb2RlX3JhdyA9IHRoaXMudXBzZXJ0X3Nob3J0Y29kZV9hdHRyKCBzaG9ydGNvZGVfcmF3LCAnZm9ybV90eXBlJywgZm9ybV9uYW1lLCAnXFwnJyApO1xyXG5cclxuXHRcdFx0cmV0dXJuICQudHJpbSggc2hvcnRjb2RlX3JhdyApO1xyXG5cdFx0fSxcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlZnJlc2ggdG9vbGJhciBidXR0b24gc2hvcnRjb2RlIGF0dHJpYnV0ZXMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGZvcm1fbmFtZSBGb3JtIG5hbWUuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB2b2lkXHJcblx0XHQgKi9cclxuXHRcdHJlZnJlc2hfcHVibGlzaF9idXR0b25fc2hvcnRjb2RlczogZnVuY3Rpb24oIGZvcm1fbmFtZSApIHtcclxuXHRcdFx0dmFyIHNlbGYgICAgID0gdGhpcztcclxuXHRcdFx0dmFyIHZhcnMgICAgID0gdGhpcy5nZXRfdmFycygpO1xyXG5cdFx0XHR2YXIgJGJ1dHRvbnMgPSAkKCAnW2RhdGEtd3BiYy1iZmItdG9wLXB1Ymxpc2gtYnRuPVwiMVwiXScgKTtcclxuXHJcblx0XHRcdGZvcm1fbmFtZSA9IHRoaXMuc2FuaXRpemVfZm9ybV9uYW1lKCBmb3JtX25hbWUgKTtcclxuXHJcblx0XHRcdCRidXR0b25zLmVhY2goXHJcblx0XHRcdFx0ZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0XHR2YXIgJGJ1dHRvbiAgICAgICA9ICQoIHRoaXMgKTtcclxuXHRcdFx0XHRcdHZhciByZXNvdXJjZV9pZCAgID0gc2VsZi5ub3JtYWxpemVfcmVzb3VyY2VfaWQoICRidXR0b24uYXR0ciggJ2RhdGEtd3BiYy1iZmItcmVzb3VyY2UtaWQnICkgfHwgdmFycy5kZWZhdWx0X3Jlc291cmNlX2lkIHx8IDEgKTtcclxuXHRcdFx0XHRcdHZhciBzaG9ydGNvZGVfcmF3ID0gJGJ1dHRvbi5hdHRyKCAnZGF0YS13cGJjLWJmYi1zaG9ydGNvZGUtcmF3JyApIHx8IHZhcnMuZGVmYXVsdF9zaG9ydGNvZGVfcmF3IHx8ICcnO1xyXG5cclxuXHRcdFx0XHRcdHNob3J0Y29kZV9yYXcgPSBzZWxmLm5vcm1hbGl6ZV9zaG9ydGNvZGVfcmF3KCBzaG9ydGNvZGVfcmF3LCByZXNvdXJjZV9pZCwgZm9ybV9uYW1lICk7XHJcblxyXG5cdFx0XHRcdFx0JGJ1dHRvbi5hdHRyKCAnZGF0YS13cGJjLWJmYi1zaG9ydGNvZGUtcmF3Jywgc2hvcnRjb2RlX3JhdyApO1xyXG5cdFx0XHRcdFx0JGJ1dHRvbi5hdHRyKCAnZGF0YS13cGJjLWJmYi1mb3JtLW5hbWUnLCBmb3JtX25hbWUgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdCk7XHJcblx0XHR9LFxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogS2VlcCBwdWJsaXNoIHNob3J0Y29kZSBpbiBzeW5jIGFmdGVyIEFKQVggZm9ybSBsb2FkLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4gdm9pZFxyXG5cdFx0ICovXHJcblx0XHRiaW5kX2Zvcm1fYWpheF9sb2FkZWRfZXZlbnRzOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuXHRcdFx0aWYgKCB3aW5kb3cuX193cGJjX2JmYl9wdWJsaXNoX19mb3JtX2FqYXhfbG9hZGVkX2JvdW5kID09PSAnMScgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdHdpbmRvdy5fX3dwYmNfYmZiX3B1Ymxpc2hfX2Zvcm1fYWpheF9sb2FkZWRfYm91bmQgPSAnMSc7XHJcblxyXG5cdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFxyXG5cdFx0XHRcdCd3cGJjOmJmYjpmb3JtOmFqYXhfbG9hZGVkJyxcclxuXHRcdFx0XHRmdW5jdGlvbiggZXYgKSB7XHJcblx0XHRcdFx0XHR2YXIgZGV0YWlsICAgICAgID0gKCBldiAmJiBldi5kZXRhaWwgKSA/IGV2LmRldGFpbCA6IHt9O1xyXG5cdFx0XHRcdFx0dmFyIGZvcm1fbmFtZSAgICA9IHNlbGYuc2FuaXRpemVfZm9ybV9uYW1lKCBkZXRhaWwuZm9ybV9uYW1lIHx8IHNlbGYuZ2V0X2N1cnJlbnRfZm9ybV9uYW1lKCkgKTtcclxuXHRcdFx0XHRcdHZhciAkbW9kYWwgICAgICAgPSBzZWxmLmdldF9tb2RhbCgpO1xyXG5cdFx0XHRcdFx0dmFyIHJlc291cmNlX2lkLCBzaG9ydGNvZGVfcmF3O1xyXG5cclxuXHRcdFx0XHRcdHdpbmRvdy5XUEJDX0JGQl9BamF4ICAgICAgICAgICA9IHdpbmRvdy5XUEJDX0JGQl9BamF4IHx8IHt9O1xyXG5cdFx0XHRcdFx0d2luZG93LldQQkNfQkZCX0FqYXguZm9ybV9uYW1lID0gZm9ybV9uYW1lO1xyXG5cclxuXHRcdFx0XHRcdHNlbGYucmVmcmVzaF9wdWJsaXNoX2J1dHRvbl9zaG9ydGNvZGVzKCBmb3JtX25hbWUgKTtcclxuXHJcblx0XHRcdFx0XHRpZiAoICRtb2RhbC5sZW5ndGggKSB7XHJcblx0XHRcdFx0XHRcdHJlc291cmNlX2lkICAgPSAkbW9kYWwuZmluZCggJyN3cGJjX2JmYl9wdWJsaXNoX19yZXNvdXJjZV9pZCcgKS52YWwoKSB8fCBzZWxmLmdldF92YXJzKCkuZGVmYXVsdF9yZXNvdXJjZV9pZCB8fCAxO1xyXG5cdFx0XHRcdFx0XHRzaG9ydGNvZGVfcmF3ID0gJG1vZGFsLmZpbmQoICcjd3BiY19iZmJfcHVibGlzaF9fc2hvcnRjb2RlX3JhdycgKS52YWwoKSB8fCBzZWxmLmdldF92YXJzKCkuZGVmYXVsdF9zaG9ydGNvZGVfcmF3IHx8ICcnO1xyXG5cclxuXHRcdFx0XHRcdFx0JG1vZGFsLmZpbmQoICcjd3BiY19iZmJfcHVibGlzaF9fZm9ybV9uYW1lJyApLnZhbCggZm9ybV9uYW1lICk7XHJcblx0XHRcdFx0XHRcdCRtb2RhbC5maW5kKCAnI3dwYmNfYmZiX3B1Ymxpc2hfX3Nob3J0Y29kZV9yYXcnICkudmFsKFxyXG5cdFx0XHRcdFx0XHRcdHNlbGYubm9ybWFsaXplX3Nob3J0Y29kZV9yYXcoIHNob3J0Y29kZV9yYXcsIHJlc291cmNlX2lkLCBmb3JtX25hbWUgKVxyXG5cdFx0XHRcdFx0XHQpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdFx0eyBwYXNzaXZlOiB0cnVlIH1cclxuXHRcdFx0KTtcclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBCaW5kIERPTSBldmVudHMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB2b2lkXHJcblx0XHQgKi9cclxuXHRcdGJpbmRfZXZlbnRzOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuXHRcdFx0JCggZG9jdW1lbnQgKS5vbihcclxuXHRcdFx0XHQnY2xpY2snLFxyXG5cdFx0XHRcdCdbZGF0YS13cGJjLWJmYi10b3AtcHVibGlzaC1idG49XCIxXCJdJyxcclxuXHRcdFx0XHRmdW5jdGlvbiggZXZlbnQgKSB7XHJcblx0XHRcdFx0XHRzZWxmLm9wZW5fZnJvbV9idXR0b24oIGV2ZW50LCAkKCB0aGlzICkgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdCk7XHJcblxyXG5cdFx0XHQkKCBkb2N1bWVudCApLm9uKFxyXG5cdFx0XHRcdCdjbGljaycsXHJcblx0XHRcdFx0J1tkYXRhLXdwYmMtYmZiLXB1Ymxpc2gtc2F2ZS1zdGVwPVwic2F2ZVwiXScsXHJcblx0XHRcdFx0ZnVuY3Rpb24oIGV2ZW50ICkge1xyXG5cdFx0XHRcdFx0c2VsZi5zdGFydF9zYXZlX2FuZF9jb250aW51ZSggZXZlbnQsICQoIHRoaXMgKSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0KTtcclxuXHJcblx0XHRcdCQoIGRvY3VtZW50ICkub24oXHJcblx0XHRcdFx0J2NsaWNrJyxcclxuXHRcdFx0XHQnW2RhdGEtd3BiYy1iZmItcHVibGlzaC1zYXZlLXN0ZXA9XCJza2lwXCJdJyxcclxuXHRcdFx0XHRmdW5jdGlvbiggZXZlbnQgKSB7XHJcblx0XHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdFx0c2VsZi5zaG93X2Nob29zZXJfc3RlcCgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0KTtcclxuXHJcblx0XHRcdCQoIGRvY3VtZW50ICkub24oXHJcblx0XHRcdFx0J2NsaWNrJyxcclxuXHRcdFx0XHQnW2RhdGEtd3BiYy1iZmItcHVibGlzaC1tb2RlXScsXHJcblx0XHRcdFx0ZnVuY3Rpb24oIGV2ZW50ICkge1xyXG5cdFx0XHRcdFx0c2VsZi5vcGVuX21vZGVfcGFuZWwoIGV2ZW50LCAkKCB0aGlzICkuYXR0ciggJ2RhdGEtd3BiYy1iZmItcHVibGlzaC1tb2RlJyApICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHQpO1xyXG5cclxuXHRcdFx0JCggZG9jdW1lbnQgKS5vbihcclxuXHRcdFx0XHQnY2xpY2snLFxyXG5cdFx0XHRcdCdbZGF0YS13cGJjLWJmYi1wdWJsaXNoLXN1Ym1pdF0nLFxyXG5cdFx0XHRcdGZ1bmN0aW9uKCBldmVudCApIHtcclxuXHRcdFx0XHRcdHNlbGYuc3VibWl0X3B1Ymxpc2goIGV2ZW50LCAkKCB0aGlzICkuYXR0ciggJ2RhdGEtd3BiYy1iZmItcHVibGlzaC1zdWJtaXQnICkgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdCk7XHJcblxyXG5cdFx0XHQkKCBkb2N1bWVudCApLm9uKFxyXG5cdFx0XHRcdCdjbGljaycsXHJcblx0XHRcdFx0J1tkYXRhLXdwYmMtYmZiLXB1Ymxpc2gtYmFjaz1cIjFcIl0nLFxyXG5cdFx0XHRcdGZ1bmN0aW9uKCBldmVudCApIHtcclxuXHRcdFx0XHRcdHNlbGYuZ29fYmFjayggZXZlbnQgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdCk7XHJcblx0XHR9LFxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVnaXN0ZXIgZ2xvYmFsIGhlbHBlcnMgZm9yIGJhY2t3YXJkIGNvbXBhdGliaWxpdHkuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB2b2lkXHJcblx0XHQgKi9cclxuXHRcdHJlZ2lzdGVyX2dsb2JhbF9oZWxwZXJzOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuXHRcdFx0d2luZG93LndwYmNfYmZiX3B1Ymxpc2hfX29wZW4gPSBmdW5jdGlvbiggcmVzb3VyY2VfaWQsIHNob3J0Y29kZV9yYXcgKSB7XHJcblx0XHRcdFx0c2VsZi5vcGVuX21vZGFsKCByZXNvdXJjZV9pZCwgc2hvcnRjb2RlX3JhdyApO1xyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0d2luZG93LndwYmNfbW9kYWxfZGlhbG9nX19zaG93X19yZXNvdXJjZV9wdWJsaXNoID0gZnVuY3Rpb24oIHJlc291cmNlX2lkICkge1xyXG5cdFx0XHRcdHNlbGYub3Blbl9tb2RhbCggcmVzb3VyY2VfaWQsICcnICk7XHJcblx0XHRcdH07XHJcblx0XHR9LFxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVzZXQgbW9kYWwgdG8gZGVmYXVsdCBzdGF0ZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHZvaWRcclxuXHRcdCAqL1xyXG5cdFx0cmVzZXRfbW9kYWw6IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHR2YXIgJG1vZGFsID0gdGhpcy5nZXRfbW9kYWwoKTtcclxuXHJcblx0XHRcdGlmICggISAkbW9kYWwubGVuZ3RoICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0JG1vZGFsLmZpbmQoICcud3BiY19iZmJfcHVibGlzaF9fbm90aWNlJyApLmh0bWwoICcnICk7XHJcblx0XHRcdCRtb2RhbC5maW5kKCAnLndwYmNfYmZiX3B1Ymxpc2hfX3NhdmVfc3RlcCcgKS5oaWRlKCk7XHJcblx0XHRcdCRtb2RhbC5maW5kKCAnLndwYmNfYmZiX3B1Ymxpc2hfX2Nob29zZXInICkuaGlkZSgpO1xyXG5cdFx0XHQkbW9kYWwuZmluZCggJy53cGJjX2JmYl9wdWJsaXNoX19wYW5lbCcgKS5oaWRlKCk7XHJcblx0XHRcdCRtb2RhbC5maW5kKCAnLm1vZGFsLWZvb3RlcicgKS5oaWRlKCk7XHJcblx0XHRcdCRtb2RhbC5maW5kKCAnLndwYmNfYmZiX3B1Ymxpc2hfX3Jlc3VsdF9hY3Rpb25zJyApLmhpZGUoKTtcclxuXHJcblx0XHRcdCRtb2RhbC5maW5kKCAnW2RhdGEtd3BiYy1iZmItcHVibGlzaC1vcGVuLXBhZ2U9XCIxXCJdJyApLmhpZGUoKS5hdHRyKCAnaHJlZicsICcjJyApO1xyXG5cdFx0XHQkbW9kYWwuZmluZCggJ1tkYXRhLXdwYmMtYmZiLXB1Ymxpc2gtZWRpdC1wYWdlPVwiMVwiXScgKS5oaWRlKCkuYXR0ciggJ2hyZWYnLCAnIycgKTtcclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTaG93IGluaXRpYWwgc2F2ZSBzdGVwLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4gdm9pZFxyXG5cdFx0ICovXHJcblx0XHRzaG93X3NhdmVfc3RlcDogZnVuY3Rpb24oKSB7XHJcblx0XHRcdHZhciAkbW9kYWwgPSB0aGlzLmdldF9tb2RhbCgpO1xyXG5cclxuXHRcdFx0aWYgKCAhICRtb2RhbC5sZW5ndGggKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQkbW9kYWwuZmluZCggJy53cGJjX2JmYl9wdWJsaXNoX19jaG9vc2VyJyApLmhpZGUoKTtcclxuXHRcdFx0JG1vZGFsLmZpbmQoICcud3BiY19iZmJfcHVibGlzaF9fcGFuZWwnICkuaGlkZSgpO1xyXG5cdFx0XHQkbW9kYWwuZmluZCggJy53cGJjX2JmYl9wdWJsaXNoX19yZXN1bHRfYWN0aW9ucycgKS5oaWRlKCk7XHJcblx0XHRcdCRtb2RhbC5maW5kKCAnLndwYmNfYmZiX3B1Ymxpc2hfX3NhdmVfc3RlcCcgKS5zaG93KCk7XHJcblx0XHRcdCRtb2RhbC5maW5kKCAnLm1vZGFsLWZvb3RlcicgKS5oaWRlKCk7XHJcblx0XHR9LFxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU2hvdyBjaG9vc2VyIHN0ZXAuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB2b2lkXHJcblx0XHQgKi9cclxuXHRcdHNob3dfY2hvb3Nlcl9zdGVwOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0dmFyICRtb2RhbCA9IHRoaXMuZ2V0X21vZGFsKCk7XHJcblxyXG5cdFx0XHRpZiAoICEgJG1vZGFsLmxlbmd0aCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdCRtb2RhbC5maW5kKCAnLndwYmNfYmZiX3B1Ymxpc2hfX25vdGljZScgKS5odG1sKCAnJyApO1xyXG5cdFx0XHQkbW9kYWwuZmluZCggJy53cGJjX2JmYl9wdWJsaXNoX19zYXZlX3N0ZXAnICkuaGlkZSgpO1xyXG5cdFx0XHQkbW9kYWwuZmluZCggJy53cGJjX2JmYl9wdWJsaXNoX19wYW5lbCcgKS5oaWRlKCk7XHJcblx0XHRcdCRtb2RhbC5maW5kKCAnLndwYmNfYmZiX3B1Ymxpc2hfX3Jlc3VsdF9hY3Rpb25zJyApLmhpZGUoKTtcclxuXHRcdFx0JG1vZGFsLmZpbmQoICcud3BiY19iZmJfcHVibGlzaF9fY2hvb3NlcicgKS5zaG93KCk7XHJcblx0XHRcdCRtb2RhbC5maW5kKCAnLm1vZGFsLWZvb3RlcicgKS5zaG93KCk7XHJcblx0XHR9LFxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogT3BlbiBtb2RhbCBmcm9tIHRvb2xiYXIgYnV0dG9uLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBldmVudCAgIENsaWNrIGV2ZW50LlxyXG5cdFx0ICogQHBhcmFtIHtqUXVlcnl9ICRidXR0b24gQnV0dG9uLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4gdm9pZFxyXG5cdFx0ICovXHJcblx0XHRvcGVuX2Zyb21fYnV0dG9uOiBmdW5jdGlvbiggZXZlbnQsICRidXR0b24gKSB7XHJcblx0XHRcdHZhciB2YXJzICAgICAgICAgPSB0aGlzLmdldF92YXJzKCk7XHJcblx0XHRcdHZhciByZXNvdXJjZV9pZDtcclxuXHRcdFx0dmFyIHNob3J0Y29kZV9yYXc7XHJcblx0XHRcdHZhciBmb3JtX25hbWU7XHJcblxyXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cclxuXHRcdFx0cmVzb3VyY2VfaWQgICA9ICRidXR0b24uYXR0ciggJ2RhdGEtd3BiYy1iZmItcmVzb3VyY2UtaWQnICkgfHwgdmFycy5kZWZhdWx0X3Jlc291cmNlX2lkIHx8IDE7XHJcblx0XHRcdGZvcm1fbmFtZSAgICAgPSB0aGlzLmdldF9jdXJyZW50X2Zvcm1fbmFtZSgpO1xyXG5cdFx0XHRzaG9ydGNvZGVfcmF3ID0gJGJ1dHRvbi5hdHRyKCAnZGF0YS13cGJjLWJmYi1zaG9ydGNvZGUtcmF3JyApIHx8IHZhcnMuZGVmYXVsdF9zaG9ydGNvZGVfcmF3IHx8ICcnO1xyXG5cclxuXHRcdFx0c2hvcnRjb2RlX3JhdyA9IHRoaXMubm9ybWFsaXplX3Nob3J0Y29kZV9yYXcoIHNob3J0Y29kZV9yYXcsIHJlc291cmNlX2lkLCBmb3JtX25hbWUgKTtcclxuXHJcblx0XHRcdCRidXR0b24uYXR0ciggJ2RhdGEtd3BiYy1iZmItc2hvcnRjb2RlLXJhdycsIHNob3J0Y29kZV9yYXcgKTtcclxuXHRcdFx0JGJ1dHRvbi5hdHRyKCAnZGF0YS13cGJjLWJmYi1mb3JtLW5hbWUnLCBmb3JtX25hbWUgKTtcclxuXHJcblx0XHRcdHRoaXMub3Blbl9tb2RhbCggcmVzb3VyY2VfaWQsIHNob3J0Y29kZV9yYXcgKTtcclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBPcGVuIG1vZGFsLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfHN0cmluZ30gcmVzb3VyY2VfaWQgIFJlc291cmNlIElELlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICBzaG9ydGNvZGVfcmF3IFNob3J0Y29kZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHZvaWRcclxuXHRcdCAqL1xyXG5cdFx0b3Blbl9tb2RhbDogZnVuY3Rpb24oIHJlc291cmNlX2lkLCBzaG9ydGNvZGVfcmF3ICkge1xyXG5cdFx0XHR2YXIgJG1vZGFsID0gdGhpcy5nZXRfbW9kYWwoKTtcclxuXHRcdFx0dmFyIHZhcnMgICA9IHRoaXMuZ2V0X3ZhcnMoKTtcclxuXHRcdFx0dmFyIGZvcm1fbmFtZTtcclxuXHJcblx0XHRcdGlmICggISAkbW9kYWwubGVuZ3RoICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmVzb3VyY2VfaWQgICA9IHRoaXMubm9ybWFsaXplX3Jlc291cmNlX2lkKCByZXNvdXJjZV9pZCB8fCB2YXJzLmRlZmF1bHRfcmVzb3VyY2VfaWQgfHwgMSApO1xyXG5cdFx0XHRmb3JtX25hbWUgICAgID0gdGhpcy5nZXRfY3VycmVudF9mb3JtX25hbWUoKTtcclxuXHRcdFx0c2hvcnRjb2RlX3JhdyA9IHRoaXMubm9ybWFsaXplX3Nob3J0Y29kZV9yYXcoIHNob3J0Y29kZV9yYXcgfHwgdmFycy5kZWZhdWx0X3Nob3J0Y29kZV9yYXcgfHwgJycsIHJlc291cmNlX2lkLCBmb3JtX25hbWUgKTtcclxuXHJcblx0XHRcdHRoaXMucmVzZXRfbW9kYWwoKTtcclxuXHJcblx0XHRcdCRtb2RhbC5maW5kKCAnI3dwYmNfYmZiX3B1Ymxpc2hfX3Jlc291cmNlX2lkJyApLnZhbCggcmVzb3VyY2VfaWQgKTtcclxuXHRcdFx0JG1vZGFsLmZpbmQoICcjd3BiY19iZmJfcHVibGlzaF9fZm9ybV9uYW1lJyApLnZhbCggZm9ybV9uYW1lICk7XHJcblx0XHRcdCRtb2RhbC5maW5kKCAnI3dwYmNfYmZiX3B1Ymxpc2hfX3Nob3J0Y29kZV9yYXcnICkudmFsKCBzaG9ydGNvZGVfcmF3ICk7XHJcblx0XHRcdCRtb2RhbC5maW5kKCAnI3dwYmNfYmZiX3B1Ymxpc2hfcGFnZV90aXRsZScgKS52YWwoICcnICk7XHJcblx0XHRcdCRtb2RhbC5maW5kKCAnI3dwYmNfYmZiX3B1Ymxpc2hfcGFnZV9pZCcgKS52YWwoICcwJyApO1xyXG5cclxuXHRcdFx0aWYgKCB0eXBlb2YgJG1vZGFsLndwYmNfbXlfbW9kYWwgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0JG1vZGFsLndwYmNfbXlfbW9kYWwoICdzaG93JyApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdCRtb2RhbC5zaG93KCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggcGFyc2VJbnQoIHZhcnMuaXNfZGVtbyB8fCAwLCAxMCApICE9PSAxICkge1xyXG5cdFx0XHRcdHRoaXMuc2hvd19zYXZlX3N0ZXAoKTtcclxuXHRcdFx0fVxyXG5cdFx0fSxcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE9wZW4gc2VsZWN0ZWQgbW9kZSBwYW5lbC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZXZlbnQgQ2xpY2sgZXZlbnQuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbW9kZSAgTW9kZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHZvaWRcclxuXHRcdCAqL1xyXG5cdFx0b3Blbl9tb2RlX3BhbmVsOiBmdW5jdGlvbiggZXZlbnQsIG1vZGUgKSB7XHJcblx0XHRcdHZhciAkbW9kYWwgPSB0aGlzLmdldF9tb2RhbCgpO1xyXG5cclxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHJcblx0XHRcdGlmICggISAkbW9kYWwubGVuZ3RoICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0JG1vZGFsLmZpbmQoICcud3BiY19iZmJfcHVibGlzaF9fbm90aWNlJyApLmh0bWwoICcnICk7XHJcblx0XHRcdCRtb2RhbC5maW5kKCAnLndwYmNfYmZiX3B1Ymxpc2hfX3NhdmVfc3RlcCcgKS5oaWRlKCk7XHJcblx0XHRcdCRtb2RhbC5maW5kKCAnLndwYmNfYmZiX3B1Ymxpc2hfX2Nob29zZXInICkuaGlkZSgpO1xyXG5cdFx0XHQkbW9kYWwuZmluZCggJy53cGJjX2JmYl9wdWJsaXNoX19wYW5lbCcgKS5oaWRlKCk7XHJcblx0XHRcdCRtb2RhbC5maW5kKCAnLndwYmNfYmZiX3B1Ymxpc2hfX3BhbmVsLS0nICsgbW9kZSApLnNob3coKTtcclxuXHRcdFx0JG1vZGFsLmZpbmQoICcubW9kYWwtZm9vdGVyJyApLnNob3coKTtcclxuXHRcdFx0JG1vZGFsLmZpbmQoICcud3BiY19iZmJfcHVibGlzaF9fcmVzdWx0X2FjdGlvbnMnICkuaGlkZSgpO1xyXG5cdFx0fSxcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJldHVybiBmcm9tIGN1cnJlbnQgc3RlcC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZXZlbnQgQ2xpY2sgZXZlbnQuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB2b2lkXHJcblx0XHQgKi9cclxuXHRcdGdvX2JhY2s6IGZ1bmN0aW9uKCBldmVudCApIHtcclxuXHRcdFx0dmFyICRtb2RhbCA9IHRoaXMuZ2V0X21vZGFsKCk7XHJcblxyXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cclxuXHRcdFx0aWYgKCAhICRtb2RhbC5sZW5ndGggKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQkbW9kYWwuZmluZCggJy53cGJjX2JmYl9wdWJsaXNoX19ub3RpY2UnICkuaHRtbCggJycgKTtcclxuXHRcdFx0JG1vZGFsLmZpbmQoICcud3BiY19iZmJfcHVibGlzaF9fcmVzdWx0X2FjdGlvbnMnICkuaGlkZSgpO1xyXG5cclxuXHRcdFx0aWYgKCAkbW9kYWwuZmluZCggJy53cGJjX2JmYl9wdWJsaXNoX19wYW5lbDp2aXNpYmxlJyApLmxlbmd0aCApIHtcclxuXHRcdFx0XHR0aGlzLnNob3dfY2hvb3Nlcl9zdGVwKCk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoICRtb2RhbC5maW5kKCAnLndwYmNfYmZiX3B1Ymxpc2hfX2Nob29zZXI6dmlzaWJsZScgKS5sZW5ndGggKSB7XHJcblx0XHRcdFx0dGhpcy5zaG93X3NhdmVfc3RlcCgpO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5zaG93X3NhdmVfc3RlcCgpO1xyXG5cdFx0fSxcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlbmRlciBub3RpY2UgaW5zaWRlIG1vZGFsLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlICAgIHN1Y2Nlc3MgfCBlcnJvciB8IGluZm9cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlIE1lc3NhZ2UgSFRNTC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHZvaWRcclxuXHRcdCAqL1xyXG5cdFx0cmVuZGVyX25vdGljZTogZnVuY3Rpb24oIHR5cGUsIG1lc3NhZ2UgKSB7XHJcblx0XHRcdHZhciAkbW9kYWwgICAgID0gdGhpcy5nZXRfbW9kYWwoKTtcclxuXHRcdFx0dmFyIGNzc19jbGFzcyAgPSAnbm90aWNlLWluZm8nO1xyXG5cclxuXHRcdFx0aWYgKCAhICRtb2RhbC5sZW5ndGggKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoICdzdWNjZXNzJyA9PT0gdHlwZSApIHtcclxuXHRcdFx0XHRjc3NfY2xhc3MgPSAnbm90aWNlLXN1Y2Nlc3MnO1xyXG5cdFx0XHR9IGVsc2UgaWYgKCAnZXJyb3InID09PSB0eXBlICkge1xyXG5cdFx0XHRcdGNzc19jbGFzcyA9ICdub3RpY2UtZXJyb3InO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQkbW9kYWwuZmluZCggJy53cGJjX2JmYl9wdWJsaXNoX19ub3RpY2UnICkuaHRtbChcclxuXHRcdFx0XHQnPGRpdiBjbGFzcz1cIndwYmMtc2V0dGluZ3Mtbm90aWNlIG5vdGljZSAnICsgY3NzX2NsYXNzICsgJ1wiIHN0eWxlPVwidGV4dC1hbGlnbjpsZWZ0O2ZvbnQtc2l6ZToxcmVtO21hcmdpbi10b3A6MDtcIj4nICtcclxuXHRcdFx0XHRcdG1lc3NhZ2UgK1xyXG5cdFx0XHRcdCc8L2Rpdj4nXHJcblx0XHRcdCk7XHJcblx0XHR9LFxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU3RhcnQgc2F2ZSBmbG93IGFuZCBjb250aW51ZSB0byBjaG9vc2VyIGFmdGVyIHNhdmUuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGV2ZW50ICAgICAgIENsaWNrIGV2ZW50LlxyXG5cdFx0ICogQHBhcmFtIHtqUXVlcnl9ICRzYXZlX2J1dHRvbiBTYXZlIGJ1dHRvbi5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHZvaWRcclxuXHRcdCAqL1xyXG5cdFx0c3RhcnRfc2F2ZV9hbmRfY29udGludWU6IGZ1bmN0aW9uKCBldmVudCwgJHNhdmVfYnV0dG9uICkge1xyXG5cdFx0XHR2YXIgc2VsZiAgICAgICAgPSB0aGlzO1xyXG5cdFx0XHR2YXIgdmFycyAgICAgICAgPSB0aGlzLmdldF92YXJzKCk7XHJcblx0XHRcdHZhciBpMThuICAgICAgICA9IHRoaXMuZ2V0X2kxOG4oKTtcclxuXHRcdFx0dmFyIHNhdmVfZm4gICAgID0gd2luZG93LndwYmNfYmZiX19hamF4X3NhdmVfY3VycmVudF9mb3JtO1xyXG5cdFx0XHR2YXIgc2F2ZV9yZXN1bHQgPSBudWxsO1xyXG5cdFx0XHR2YXIgaGFzX2FzeW5jX2hhbmRsZSA9IGZhbHNlO1xyXG5cdFx0XHR2YXIgZmluaXNoZWQgICAgPSBmYWxzZTtcclxuXHRcdFx0dmFyIGJ1c3lfc2VlbiAgID0gZmFsc2U7XHJcblx0XHRcdHZhciBwb2xsX2lkICAgICA9IG51bGw7XHJcblx0XHRcdHZhciBxdWlja19pZCAgICA9IG51bGw7XHJcblx0XHRcdHZhciB0aW1lb3V0X2lkICA9IG51bGw7XHJcblx0XHRcdHZhciBldmVudF9uYW1lcywgZXZlbnRfaGFuZGxlcnM7XHJcblxyXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cclxuXHRcdFx0aWYgKCBwYXJzZUludCggdmFycy5pc19kZW1vIHx8IDAsIDEwICkgPT09IDEgKSB7XHJcblx0XHRcdFx0dGhpcy5yZW5kZXJfbm90aWNlKCAnZXJyb3InLCBpMThuLmRlbW9fZXJyb3IgfHwgJ1RoaXMgb3BlcmF0aW9uIGlzIHJlc3RyaWN0ZWQgaW4gdGhlIGRlbW8gdmVyc2lvbi4nICk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoICdmdW5jdGlvbicgIT09IHR5cGVvZiBzYXZlX2ZuICkge1xyXG5cdFx0XHRcdHRoaXMucmVuZGVyX25vdGljZSggJ2Vycm9yJywgaTE4bi5zYXZlX2ZuX21pc3NpbmcgfHwgJ1NhdmUgZnVuY3Rpb24gaXMgbm90IGF2YWlsYWJsZS4gWW91IGNhbiB1c2UgU2tpcCB0byBjb250aW51ZSB3aXRob3V0IHNhdmluZy4nICk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLnJlbmRlcl9ub3RpY2UoICdpbmZvJywgaTE4bi5zYXZpbmdfZm9ybSB8fCAnU2F2aW5nIGJvb2tpbmcgZm9ybS4uLicgKTtcclxuXHRcdFx0JHNhdmVfYnV0dG9uLnByb3AoICdkaXNhYmxlZCcsIHRydWUgKS5hZGRDbGFzcyggJ2Rpc2FibGVkJyApO1xyXG5cclxuXHRcdFx0ZXZlbnRfbmFtZXMgPSBhcnJheV9vcl9saXN0X3RvX2FycmF5KCBbXHJcblx0XHRcdFx0J3dwYmM6YmZiOmZvcm06YWpheF9zYXZlZCcsXHJcblx0XHRcdFx0J3dwYmM6YmZiOmZvcm06c2F2ZWQnLFxyXG5cdFx0XHRcdCd3cGJjOmJmYjpzYXZlOmRvbmUnLFxyXG5cdFx0XHRcdCd3cGJjOmJmYjphamF4X3NhdmVkJ1xyXG5cdFx0XHRdICk7XHJcblx0XHRcdGV2ZW50X2hhbmRsZXJzID0gW107XHJcblxyXG5cdFx0XHRmdW5jdGlvbiBjbGVhbnVwKCkge1xyXG5cdFx0XHRcdHZhciBpO1xyXG5cclxuXHRcdFx0XHRpZiAoIHBvbGxfaWQgKSB7XHJcblx0XHRcdFx0XHR3aW5kb3cuY2xlYXJJbnRlcnZhbCggcG9sbF9pZCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRpZiAoIHF1aWNrX2lkICkge1xyXG5cdFx0XHRcdFx0d2luZG93LmNsZWFyVGltZW91dCggcXVpY2tfaWQgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCB0aW1lb3V0X2lkICkge1xyXG5cdFx0XHRcdFx0d2luZG93LmNsZWFyVGltZW91dCggdGltZW91dF9pZCApO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Zm9yICggaSA9IDA7IGkgPCBldmVudF9uYW1lcy5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0XHRcdGlmICggZXZlbnRfaGFuZGxlcnNbaV0gKSB7XHJcblx0XHRcdFx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoIGV2ZW50X25hbWVzW2ldLCBldmVudF9oYW5kbGVyc1tpXSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0JHNhdmVfYnV0dG9uLnByb3AoICdkaXNhYmxlZCcsIGZhbHNlICkucmVtb3ZlQ2xhc3MoICdkaXNhYmxlZCcgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0ZnVuY3Rpb24gZmluaXNoX3N1Y2Nlc3MoKSB7XHJcblx0XHRcdFx0aWYgKCBmaW5pc2hlZCApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0ZmluaXNoZWQgPSB0cnVlO1xyXG5cclxuXHRcdFx0XHRjbGVhbnVwKCk7XHJcblxyXG5cdFx0XHRcdHNlbGYucmVmcmVzaF9wdWJsaXNoX2J1dHRvbl9zaG9ydGNvZGVzKCBzZWxmLmdldF9jdXJyZW50X2Zvcm1fbmFtZSgpICk7XHJcblx0XHRcdFx0c2VsZi5yZW5kZXJfbm90aWNlKCAnc3VjY2VzcycsIGkxOG4uc2F2ZV9zdWNjZXNzIHx8ICdCb29raW5nIGZvcm0gaGFzIGJlZW4gc2F2ZWQuIENvbnRpbnVlIHdpdGggcHVibGlzaGluZy4nICk7XHJcblx0XHRcdFx0c2VsZi5zaG93X2Nob29zZXJfc3RlcCgpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRmdW5jdGlvbiBmaW5pc2hfZXJyb3IoIG1lc3NhZ2UgKSB7XHJcblx0XHRcdFx0aWYgKCBmaW5pc2hlZCApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0ZmluaXNoZWQgPSB0cnVlO1xyXG5cclxuXHRcdFx0XHRjbGVhbnVwKCk7XHJcblxyXG5cdFx0XHRcdHNlbGYucmVuZGVyX25vdGljZSggJ2Vycm9yJywgbWVzc2FnZSB8fCBpMThuLnNhdmVfZmFpbGVkIHx8ICdVbmFibGUgdG8gY29uZmlybSB0aGF0IHRoZSBib29raW5nIGZvcm0gd2FzIHNhdmVkLicgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRzYXZlX3Jlc3VsdCA9IHNhdmVfZm4oICRzYXZlX2J1dHRvbi5nZXQoIDAgKSApO1xyXG5cdFx0XHR9IGNhdGNoICggZXJyICkge1xyXG5cdFx0XHRcdGZpbmlzaF9lcnJvciggaTE4bi5zYXZlX2ZhaWxlZCB8fCAnVW5hYmxlIHRvIGNvbmZpcm0gdGhhdCB0aGUgYm9va2luZyBmb3JtIHdhcyBzYXZlZC4nICk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIHRydWUgPT09IHNhdmVfcmVzdWx0ICkge1xyXG5cdFx0XHRcdGZpbmlzaF9zdWNjZXNzKCk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIGZhbHNlID09PSBzYXZlX3Jlc3VsdCApIHtcclxuXHRcdFx0XHRmaW5pc2hfZXJyb3IoIGkxOG4uc2F2ZV9mYWlsZWQgfHwgJ1VuYWJsZSB0byBjb25maXJtIHRoYXQgdGhlIGJvb2tpbmcgZm9ybSB3YXMgc2F2ZWQuJyApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCBzYXZlX3Jlc3VsdCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygc2F2ZV9yZXN1bHQudGhlbiApIHtcclxuXHRcdFx0XHRoYXNfYXN5bmNfaGFuZGxlID0gdHJ1ZTtcclxuXHRcdFx0XHRzYXZlX3Jlc3VsdC50aGVuKFxyXG5cdFx0XHRcdFx0ZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0XHRcdGZpbmlzaF9zdWNjZXNzKCk7XHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0ZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0XHRcdGZpbmlzaF9lcnJvciggaTE4bi5zYXZlX2ZhaWxlZCB8fCAnVW5hYmxlIHRvIGNvbmZpcm0gdGhhdCB0aGUgYm9va2luZyBmb3JtIHdhcyBzYXZlZC4nICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0KTtcclxuXHRcdFx0fSBlbHNlIGlmICggc2F2ZV9yZXN1bHQgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHNhdmVfcmVzdWx0LmRvbmUgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHNhdmVfcmVzdWx0LmZhaWwgKSB7XHJcblx0XHRcdFx0aGFzX2FzeW5jX2hhbmRsZSA9IHRydWU7XHJcblx0XHRcdFx0c2F2ZV9yZXN1bHRcclxuXHRcdFx0XHRcdC5kb25lKFxyXG5cdFx0XHRcdFx0XHRmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRcdFx0XHRmaW5pc2hfc3VjY2VzcygpO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHQpXHJcblx0XHRcdFx0XHQuZmFpbChcclxuXHRcdFx0XHRcdFx0ZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0XHRcdFx0ZmluaXNoX2Vycm9yKCBpMThuLnNhdmVfZmFpbGVkIHx8ICdVbmFibGUgdG8gY29uZmlybSB0aGF0IHRoZSBib29raW5nIGZvcm0gd2FzIHNhdmVkLicgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0KTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0ZXZlbnRfbmFtZXMuZm9yRWFjaChcclxuXHRcdFx0XHRmdW5jdGlvbiggZXZlbnRfbmFtZSwgaW5kZXggKSB7XHJcblx0XHRcdFx0XHRldmVudF9oYW5kbGVyc1tpbmRleF0gPSBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRcdFx0ZmluaXNoX3N1Y2Nlc3MoKTtcclxuXHRcdFx0XHRcdH07XHJcblx0XHRcdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCBldmVudF9uYW1lLCBldmVudF9oYW5kbGVyc1tpbmRleF0gKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdCk7XHJcblxyXG5cdFx0XHRwb2xsX2lkID0gd2luZG93LnNldEludGVydmFsKFxyXG5cdFx0XHRcdGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdFx0aWYgKCBmaW5pc2hlZCApIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGlmICggJHNhdmVfYnV0dG9uLmhhc0NsYXNzKCAnd3BiYy1pcy1idXN5JyApICkge1xyXG5cdFx0XHRcdFx0XHRidXN5X3NlZW4gPSB0cnVlO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYgKCBidXN5X3NlZW4gKSB7XHJcblx0XHRcdFx0XHRcdGZpbmlzaF9zdWNjZXNzKCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHQyNTBcclxuXHRcdFx0KTtcclxuXHJcblx0XHRcdHF1aWNrX2lkID0gd2luZG93LnNldFRpbWVvdXQoXHJcblx0XHRcdFx0ZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0XHRpZiAoIGZpbmlzaGVkICkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYgKCAhIGhhc19hc3luY19oYW5kbGUgJiYgISBidXN5X3NlZW4gKSB7XHJcblx0XHRcdFx0XHRcdGZpbmlzaF9zdWNjZXNzKCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHQxMDAwXHJcblx0XHRcdCk7XHJcblxyXG5cdFx0XHR0aW1lb3V0X2lkID0gd2luZG93LnNldFRpbWVvdXQoXHJcblx0XHRcdFx0ZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0XHRpZiAoIGZpbmlzaGVkICkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0ZmluaXNoX2Vycm9yKCBpMThuLnNhdmVfdGltZW91dCB8fCAnU2F2aW5nIGlzIHRha2luZyBsb25nZXIgdGhhbiBleHBlY3RlZC4gWW91IGNhbiB3YWl0IGEgbGl0dGxlIGxvbmdlciBvciB1c2UgU2tpcCB0byBjb250aW51ZSB3aXRob3V0IHdhaXRpbmcuJyApO1xyXG5cdFx0XHRcdH0sXHJcblx0XHRcdFx0MjAwMDBcclxuXHRcdFx0KTtcclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTaG93IHN1Y2Nlc3MgYWN0aW9uIGJ1dHRvbnMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHJlc3BvbnNlX2RhdGEgQUpBWCBzdWNjZXNzIGRhdGEuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB2b2lkXHJcblx0XHQgKi9cclxuXHRcdHNob3dfcmVzdWx0X2FjdGlvbnM6IGZ1bmN0aW9uKCByZXNwb25zZV9kYXRhICkge1xyXG5cdFx0XHR2YXIgaTE4biAgPSB0aGlzLmdldF9pMThuKCk7XHJcblx0XHRcdHZhciAkbW9kYWwgPSB0aGlzLmdldF9tb2RhbCgpO1xyXG5cdFx0XHR2YXIgJHdyYXAgPSAkbW9kYWwuZmluZCggJy53cGJjX2JmYl9wdWJsaXNoX19yZXN1bHRfYWN0aW9ucycgKTtcclxuXHRcdFx0dmFyICR2aWV3ID0gJG1vZGFsLmZpbmQoICdbZGF0YS13cGJjLWJmYi1wdWJsaXNoLW9wZW4tcGFnZT1cIjFcIl0nICk7XHJcblx0XHRcdHZhciAkZWRpdCA9ICRtb2RhbC5maW5kKCAnW2RhdGEtd3BiYy1iZmItcHVibGlzaC1lZGl0LXBhZ2U9XCIxXCJdJyApO1xyXG5cclxuXHRcdFx0aWYgKCAhICRtb2RhbC5sZW5ndGggKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQkdmlldy5oaWRlKCk7XHJcblx0XHRcdCRlZGl0LmhpZGUoKTtcclxuXHJcblx0XHRcdGlmICggcmVzcG9uc2VfZGF0YS52aWV3X3VybCApIHtcclxuXHRcdFx0XHQkdmlldy5hdHRyKCAnaHJlZicsIHJlc3BvbnNlX2RhdGEudmlld191cmwgKS50ZXh0KCBpMThuLnZpZXdfcGFnZSB8fCAnT3BlbiBQYWdlJyApLnNob3coKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCByZXNwb25zZV9kYXRhLmVkaXRfdXJsICkge1xyXG5cdFx0XHRcdCRlZGl0LmF0dHIoICdocmVmJywgcmVzcG9uc2VfZGF0YS5lZGl0X3VybCApLnRleHQoIGkxOG4uZWRpdF9wYWdlIHx8ICdFZGl0IFBhZ2UnICkuc2hvdygpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIHJlc3BvbnNlX2RhdGEudmlld191cmwgfHwgcmVzcG9uc2VfZGF0YS5lZGl0X3VybCApIHtcclxuXHRcdFx0XHQkd3JhcC5jc3MoICdkaXNwbGF5JywgJ2ZsZXgnICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0JHdyYXAuaGlkZSgpO1xyXG5cdFx0XHR9XHJcblx0XHR9LFxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU3VibWl0IHB1Ymxpc2ggcmVxdWVzdC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZXZlbnQgQ2xpY2sgZXZlbnQuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbW9kZSAgTW9kZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHZvaWRcclxuXHRcdCAqL1xyXG5cdFx0c3VibWl0X3B1Ymxpc2g6IGZ1bmN0aW9uKCBldmVudCwgbW9kZSApIHtcclxuXHRcdFx0dmFyIHNlbGYgICAgICAgICAgPSB0aGlzO1xyXG5cdFx0XHR2YXIgdmFycyAgICAgICAgICA9IHRoaXMuZ2V0X3ZhcnMoKTtcclxuXHRcdFx0dmFyIGkxOG4gICAgICAgICAgPSB0aGlzLmdldF9pMThuKCk7XHJcblx0XHRcdHZhciAkbW9kYWwgICAgICAgID0gdGhpcy5nZXRfbW9kYWwoKTtcclxuXHRcdFx0dmFyIHJlc291cmNlX2lkO1xyXG5cdFx0XHR2YXIgZm9ybV9uYW1lO1xyXG5cdFx0XHR2YXIgc2hvcnRjb2RlX3JhdztcclxuXHRcdFx0dmFyIHBhZ2VfaWQ7XHJcblx0XHRcdHZhciBwYWdlX3RpdGxlO1xyXG5cdFx0XHR2YXIgJHN1Ym1pdF9idXR0b247XHJcblxyXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cclxuXHRcdFx0aWYgKCAhICRtb2RhbC5sZW5ndGggKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIHBhcnNlSW50KCB2YXJzLmlzX2RlbW8gfHwgMCwgMTAgKSA9PT0gMSApIHtcclxuXHRcdFx0XHR0aGlzLnJlbmRlcl9ub3RpY2UoICdlcnJvcicsIGkxOG4uZGVtb19lcnJvciB8fCAnVGhpcyBvcGVyYXRpb24gaXMgcmVzdHJpY3RlZCBpbiB0aGUgZGVtbyB2ZXJzaW9uLicgKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJlc291cmNlX2lkICAgPSB0aGlzLm5vcm1hbGl6ZV9yZXNvdXJjZV9pZCggJG1vZGFsLmZpbmQoICcjd3BiY19iZmJfcHVibGlzaF9fcmVzb3VyY2VfaWQnICkudmFsKCkgfHwgdmFycy5kZWZhdWx0X3Jlc291cmNlX2lkIHx8IDEgKTtcclxuXHRcdFx0Zm9ybV9uYW1lICAgICA9IHRoaXMuc2FuaXRpemVfZm9ybV9uYW1lKCAkbW9kYWwuZmluZCggJyN3cGJjX2JmYl9wdWJsaXNoX19mb3JtX25hbWUnICkudmFsKCkgfHwgdGhpcy5nZXRfY3VycmVudF9mb3JtX25hbWUoKSApO1xyXG5cdFx0XHRzaG9ydGNvZGVfcmF3ID0gdGhpcy5ub3JtYWxpemVfc2hvcnRjb2RlX3JhdyhcclxuXHRcdFx0XHQkbW9kYWwuZmluZCggJyN3cGJjX2JmYl9wdWJsaXNoX19zaG9ydGNvZGVfcmF3JyApLnZhbCgpIHx8IHZhcnMuZGVmYXVsdF9zaG9ydGNvZGVfcmF3IHx8ICcnLFxyXG5cdFx0XHRcdHJlc291cmNlX2lkLFxyXG5cdFx0XHRcdGZvcm1fbmFtZVxyXG5cdFx0XHQpO1xyXG5cdFx0XHRwYWdlX2lkICAgICAgID0gJG1vZGFsLmZpbmQoICcjd3BiY19iZmJfcHVibGlzaF9wYWdlX2lkJyApLnZhbCgpIHx8ICcnO1xyXG5cdFx0XHRwYWdlX3RpdGxlICAgID0gJC50cmltKCAkbW9kYWwuZmluZCggJyN3cGJjX2JmYl9wdWJsaXNoX3BhZ2VfdGl0bGUnICkudmFsKCkgfHwgJycgKTtcclxuXHRcdFx0JHN1Ym1pdF9idXR0b24gPSAkbW9kYWwuZmluZCggJ1tkYXRhLXdwYmMtYmZiLXB1Ymxpc2gtc3VibWl0PVwiJyArIG1vZGUgKyAnXCJdJyApO1xyXG5cclxuXHRcdFx0JG1vZGFsLmZpbmQoICcjd3BiY19iZmJfcHVibGlzaF9fZm9ybV9uYW1lJyApLnZhbCggZm9ybV9uYW1lICk7XHJcblx0XHRcdCRtb2RhbC5maW5kKCAnI3dwYmNfYmZiX3B1Ymxpc2hfX3Nob3J0Y29kZV9yYXcnICkudmFsKCBzaG9ydGNvZGVfcmF3ICk7XHJcblxyXG5cdFx0XHRpZiAoICdlZGl0JyA9PT0gbW9kZSAmJiAoICEgcGFnZV9pZCB8fCAnMCcgPT09IHBhZ2VfaWQgKSApIHtcclxuXHRcdFx0XHR0aGlzLnJlbmRlcl9ub3RpY2UoICdlcnJvcicsIGkxOG4uc2VsZWN0X3BhZ2UgfHwgJ1BsZWFzZSBzZWxlY3QgYW4gZXhpc3RpbmcgcGFnZS4nICk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoICdjcmVhdGUnID09PSBtb2RlICYmICEgcGFnZV90aXRsZSApIHtcclxuXHRcdFx0XHR0aGlzLnJlbmRlcl9ub3RpY2UoICdlcnJvcicsIGkxOG4uZW50ZXJfcGFnZV90aXRsZSB8fCAnUGxlYXNlIGVudGVyIGEgcGFnZSB0aXRsZS4nICk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLnJlbmRlcl9ub3RpY2UoICdpbmZvJywgaTE4bi5sb2FkaW5nIHx8ICdQdWJsaXNoaW5nIGJvb2tpbmcgZm9ybS4uLicgKTtcclxuXHRcdFx0JG1vZGFsLmZpbmQoICcud3BiY19iZmJfcHVibGlzaF9fcmVzdWx0X2FjdGlvbnMnICkuaGlkZSgpO1xyXG5cclxuXHRcdFx0JHN1Ym1pdF9idXR0b24ucHJvcCggJ2Rpc2FibGVkJywgdHJ1ZSApLmFkZENsYXNzKCAnZGlzYWJsZWQnICk7XHJcblxyXG5cdFx0XHQkLmFqYXgoXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0dXJsOiB2YXJzLmFqYXhfdXJsLFxyXG5cdFx0XHRcdFx0dHlwZTogJ1BPU1QnLFxyXG5cdFx0XHRcdFx0ZGF0YVR5cGU6ICdqc29uJyxcclxuXHRcdFx0XHRcdGRhdGE6IHtcclxuXHRcdFx0XHRcdFx0YWN0aW9uOiB2YXJzLmFjdGlvbixcclxuXHRcdFx0XHRcdFx0bm9uY2U6IHZhcnMubm9uY2UsXHJcblx0XHRcdFx0XHRcdHB1Ymxpc2hfbW9kZTogbW9kZSxcclxuXHRcdFx0XHRcdFx0cmVzb3VyY2VfaWQ6IHJlc291cmNlX2lkLFxyXG5cdFx0XHRcdFx0XHRmb3JtX25hbWU6IGZvcm1fbmFtZSxcclxuXHRcdFx0XHRcdFx0c2hvcnRjb2RlX3Jhdzogc2hvcnRjb2RlX3JhdyxcclxuXHRcdFx0XHRcdFx0cGFnZV9pZDogcGFnZV9pZCxcclxuXHRcdFx0XHRcdFx0cGFnZV90aXRsZTogcGFnZV90aXRsZVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0KVxyXG5cdFx0XHRcdC5kb25lKFxyXG5cdFx0XHRcdFx0ZnVuY3Rpb24oIHJlc3BvbnNlICkge1xyXG5cdFx0XHRcdFx0XHRpZiAoIHJlc3BvbnNlICYmIHJlc3BvbnNlLnN1Y2Nlc3MgJiYgcmVzcG9uc2UuZGF0YSApIHtcclxuXHRcdFx0XHRcdFx0XHRzZWxmLnJlbmRlcl9ub3RpY2UoICdzdWNjZXNzJywgcmVzcG9uc2UuZGF0YS5tZXNzYWdlIHx8ICcnICk7XHJcblx0XHRcdFx0XHRcdFx0c2VsZi5zaG93X3Jlc3VsdF9hY3Rpb25zKCByZXNwb25zZS5kYXRhICk7XHJcblxyXG5cdFx0XHRcdFx0XHRcdGlmICggcmVzcG9uc2UuZGF0YS5mb3JtX25hbWUgKSB7XHJcblx0XHRcdFx0XHRcdFx0XHR3aW5kb3cuV1BCQ19CRkJfQWpheCAgICAgICAgICAgPSB3aW5kb3cuV1BCQ19CRkJfQWpheCB8fCB7fTtcclxuXHRcdFx0XHRcdFx0XHRcdHdpbmRvdy5XUEJDX0JGQl9BamF4LmZvcm1fbmFtZSA9IHNlbGYuc2FuaXRpemVfZm9ybV9uYW1lKCByZXNwb25zZS5kYXRhLmZvcm1fbmFtZSApO1xyXG5cdFx0XHRcdFx0XHRcdFx0c2VsZi5yZWZyZXNoX3B1Ymxpc2hfYnV0dG9uX3Nob3J0Y29kZXMoIHJlc3BvbnNlLmRhdGEuZm9ybV9uYW1lICk7XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKCByZXNwb25zZSAmJiByZXNwb25zZS5kYXRhICYmIHJlc3BvbnNlLmRhdGEubWVzc2FnZSApIHtcclxuXHRcdFx0XHRcdFx0XHRzZWxmLnJlbmRlcl9ub3RpY2UoICdlcnJvcicsIHJlc3BvbnNlLmRhdGEubWVzc2FnZSApO1xyXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdHNlbGYucmVuZGVyX25vdGljZSggJ2Vycm9yJywgaTE4bi5nZW5lcmljX2Vycm9yIHx8ICdBbiB1bmV4cGVjdGVkIGVycm9yIG9jY3VycmVkIHdoaWxlIHB1Ymxpc2hpbmcgdGhlIGJvb2tpbmcgZm9ybS4nICk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHQpXHJcblx0XHRcdFx0LmZhaWwoXHJcblx0XHRcdFx0XHRmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRcdFx0c2VsZi5yZW5kZXJfbm90aWNlKCAnZXJyb3InLCBpMThuLmdlbmVyaWNfZXJyb3IgfHwgJ0FuIHVuZXhwZWN0ZWQgZXJyb3Igb2NjdXJyZWQgd2hpbGUgcHVibGlzaGluZyB0aGUgYm9va2luZyBmb3JtLicgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHQpXHJcblx0XHRcdFx0LmFsd2F5cyhcclxuXHRcdFx0XHRcdGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdFx0XHQkc3VibWl0X2J1dHRvbi5wcm9wKCAnZGlzYWJsZWQnLCBmYWxzZSApLnJlbW92ZUNsYXNzKCAnZGlzYWJsZWQnICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0KTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBOb3JtYWxpemUgbGlzdCBoZWxwZXIuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0geyp9IGlucHV0IExpc3QtbGlrZSBpbnB1dC5cclxuXHQgKlxyXG5cdCAqIEByZXR1cm4ge0FycmF5fVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGFycmF5X29yX2xpc3RfdG9fYXJyYXkoIGlucHV0ICkge1xyXG5cdFx0aWYgKCBBcnJheS5pc0FycmF5KCBpbnB1dCApICkge1xyXG5cdFx0XHRyZXR1cm4gaW5wdXQ7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIFtdO1xyXG5cdH1cclxuXHJcblx0JCggZnVuY3Rpb24oKSB7XHJcblx0XHRwdWJsaXNoX2FwaS5pbml0KCk7XHJcblx0fSApO1xyXG5cclxufSkoIGpRdWVyeSwgd2luZG93LCBkb2N1bWVudCApOyJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUMsVUFBV0EsQ0FBQyxFQUFFQyxNQUFNLEVBQUVDLFFBQVEsRUFBRztFQUNqQyxZQUFZOztFQUVaLElBQUlDLFdBQVcsR0FBRztJQUVqQjtBQUNGO0FBQ0E7QUFDQTtBQUNBO0lBQ0VDLElBQUksRUFBRSxTQUFBQSxDQUFBLEVBQVc7TUFDaEIsSUFBSSxDQUFDQyxXQUFXLENBQUMsQ0FBQztNQUNsQixJQUFJLENBQUNDLDRCQUE0QixDQUFDLENBQUM7TUFDbkMsSUFBSSxDQUFDQyx1QkFBdUIsQ0FBQyxDQUFDO01BQzlCLElBQUksQ0FBQ0MsaUNBQWlDLENBQUUsSUFBSSxDQUFDQyxxQkFBcUIsQ0FBQyxDQUFFLENBQUM7SUFDdkUsQ0FBQztJQUVEO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7SUFDRUMsUUFBUSxFQUFFLFNBQUFBLENBQUEsRUFBVztNQUNwQixPQUFPVCxNQUFNLENBQUNVLHFCQUFxQixJQUFJLENBQUMsQ0FBQztJQUMxQyxDQUFDO0lBRUQ7QUFDRjtBQUNBO0FBQ0E7QUFDQTtJQUNFQyxRQUFRLEVBQUUsU0FBQUEsQ0FBQSxFQUFXO01BQ3BCLElBQUlDLElBQUksR0FB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
