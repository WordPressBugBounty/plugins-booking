"use strict";

/**
 * Provide the reusable Booking Form template catalog and interactive preview.
 *
 * Catalog cards remain server-rendered. Direct templates use request-local
 * inline HTML, while Appointment Flow and full-site previews use signed URLs.
 * The browser never receives raw template definitions and never applies a form.
 *
 * @package Booking Calendar
 */
(function (window, document) {
  'use strict';

  var module_config = window.wpbc_setup_wizard_booking_form_template || {
    i18n: {}
  };

  /**
   * Create one isolated Booking Form template selector adapter.
   *
   * @param {Object} config Module endpoint and translation settings.
   * @return {Object} Step adapter accepted by the shared wizard shell.
   */
  function create_booking_form_template_adapter(config) {
    var appointment_flow_dialog_action = 'booking-form-appointment-flow';
    var template_guidance_dialog_action = 'booking-form-template-guidance';
    var shell_api = null;
    var root = null;
    var editor = null;
    var confirmed_booking_form_usage = '';
    var preview_request_sequence = 0;
    var preview_abort_controller = null;
    var open_request_sequence = 0;
    var open_abort_controller = null;
    var open_request_is_loading = false;
    var inline_preview_renderer = null;
    var current_preview = {
      kind: '',
      url: '',
      template_slug: '',
      booking_form_usage: ''
    };

    /**
     * Return one translated string with a safe fallback.
     *
     * @param {string} key      Translation key.
     * @param {string} fallback Fallback copy.
     * @return {string} Translation or fallback.
     */
    function get_message(key, fallback) {
      return config.i18n && config.i18n[key] ? config.i18n[key] : fallback;
    }

    /**
     * Return normalized text for case-insensitive catalog searching.
     *
     * @param {string} text Source text.
     * @return {string} Lowercase normalized text.
     */
    function normalize_search_text(text) {
      return String(text || '').toLocaleLowerCase();
    }

    /**
     * Return one template card's searchable text.
     *
     * @param {HTMLElement} card Template card.
     * @return {string} Normalized searchable text.
     */
    function get_card_search_text(card) {
      var title = card.querySelector('[data-wpbc-template-title]');
      var description = card.querySelector('[data-wpbc-template-description]');
      return normalize_search_text((title ? title.textContent : '') + ' ' + (description ? description.textContent : '') + ' ' + (card.dataset.templateSlug || ''));
    }

    /**
     * Install a graceful fallback for one catalog thumbnail.
     *
     * @param {HTMLImageElement|null} image       Image element.
     * @param {HTMLElement|null}      placeholder Placeholder element.
     * @return {void}
     */
    function initialize_image_fallback(image, placeholder) {
      if (!image) {
        return;
      }
      image.addEventListener('load', function () {
        image.hidden = false;
        if (placeholder) {
          placeholder.hidden = true;
        }
      });
      image.addEventListener('error', function () {
        image.hidden = true;
        if (placeholder) {
          placeholder.hidden = false;
        }
      });
      if (image.complete && image.src && 0 === image.naturalWidth) {
        image.hidden = true;
        if (placeholder) {
          placeholder.hidden = false;
        }
      }
    }

    /**
     * Return the currently selected server-rendered card.
     *
     * @return {HTMLElement|null} Selected card or null.
     */
    function get_selected_card() {
      var selected_radio = editor && editor.node.querySelector('[data-wpbc-template-radio]:checked');
      return selected_radio ? selected_radio.closest('[data-wpbc-template-card]') : null;
    }

    /**
     * Return the selected server-rendered Booking Form entry point.
     *
     * @return {string} Stable usage identifier, or an empty string.
     */
    function get_selected_booking_form_usage() {
      var selected_radio = editor && editor.node.querySelector('[data-wpbc-booking-form-usage-radio]:checked');
      return selected_radio ? String(selected_radio.value || '') : '';
    }

    /**
     * Build the informational shortcode for the current allow-listed choices.
     *
     * The value is inserted with textContent only and is never evaluated by the
     * browser. The preview endpoint independently validates both identifiers.
     *
     * @param {string} booking_form_usage Selected entry-point identifier.
     * @return {string} Informational shortcode.
     */
    function get_preview_shortcode(booking_form_usage) {
      return 'appointment_flow' === booking_form_usage ? '[booking_appointment]' : '[booking]';
    }

    /**
     * Synchronize the selected template metadata below the preview.
     *
     * @param {HTMLElement|null} card Selected template card.
     * @return {void}
     */
    function render_preview_metadata(card) {
      var title_node = editor.node.querySelector('[data-wpbc-template-preview-title]');
      var slug_node = editor.node.querySelector('[data-wpbc-template-preview-slug]');
      var shortcode_node = editor.node.querySelector('[data-wpbc-template-preview-shortcode]');
      var description_node = editor.node.querySelector('[data-wpbc-template-preview-description]');
      var title = card && card.querySelector('[data-wpbc-template-title]');
      var description = card && card.querySelector('[data-wpbc-template-description]');
      var template_slug = card ? String(card.dataset.templateSlug || '') : '';
      if (title_node) {
        title_node.textContent = title ? title.textContent.trim() : '';
      }
      if (slug_node) {
        slug_node.textContent = template_slug;
      }
      if (shortcode_node) {
        shortcode_node.textContent = get_preview_shortcode(get_selected_booking_form_usage());
      }
      if (description_node) {
        description_node.textContent = description ? description.textContent.trim() : '';
      }
    }

    /**
     * Update preview loading, error, and action states.
     *
     * @param {boolean} is_loading Whether a preview request/frame is loading.
     * @param {string}  error_text Plain error text, or an empty string.
     * @return {void}
     */
    function set_preview_state(is_loading, error_text) {
      var has_error = '' !== String(error_text || '');
      editor.preview_stage.classList.toggle('is-loading', is_loading);
      editor.preview_stage.classList.toggle('has-error', has_error);
      editor.preview_stage.setAttribute('aria-busy', is_loading ? 'true' : 'false');
      editor.preview_loader.hidden = !is_loading;
      editor.preview_error.hidden = !has_error;
      if (has_error) {
        editor.preview_error.querySelector('span').textContent = error_text;
      }
      editor.refresh_button.disabled = is_loading || !get_selected_card();
      editor.open_button.disabled = is_loading || open_request_is_loading || !get_selected_card();
    }

    /**
     * Clear the iframe's association with an earlier template preview.
     *
     * The attribute is diagnostic as well as functional: it lets browser tests
     * verify that the visible iframe belongs to the currently selected card.
     *
     * @return {void}
     */
    function clear_preview_frame() {
      editor.preview_frame.removeAttribute('data-preview-template-slug');
      editor.preview_frame.removeAttribute('data-preview-booking-form-usage');
      editor.preview_frame.src = 'about:blank';
      editor.preview_frame.hidden = true;
    }

    /**
     * Record one successfully rendered preview.
     *
     * @param {string} preview_kind      Inline or URL preview kind.
     * @param {string} preview_url       Signed URL when applicable.
     * @param {string} template_slug     Validated template slug.
     * @param {string} booking_form_usage Validated usage identifier.
     * @return {void}
     */
    function set_current_preview(preview_kind, preview_url, template_slug, booking_form_usage) {
      current_preview = {
        kind: preview_kind,
        url: preview_url,
        template_slug: template_slug,
        booking_form_usage: booking_form_usage
      };
    }

    /**
     * Determine whether the current preview matches the selected controls.
     *
     * @param {string} template_slug      Selected template slug.
     * @param {string} booking_form_usage Selected usage identifier.
     * @return {boolean} Whether the active preview belongs to the selection.
     */
    function current_preview_matches(template_slug, booking_form_usage) {
      return current_preview.template_slug === template_slug && current_preview.booking_form_usage === booking_form_usage;
    }

    /**
     * Read a normalized WordPress AJAX error message.
     *
     * @param {Object|null} response Parsed JSON response.
     * @return {string} Plain error message.
     */
    function get_ajax_error_message(response) {
      if (response && response.data && response.data.message) {
        return String(response.data.message);
      }
      return get_message('preview_error', 'The interactive preview could not be loaded. Try refreshing it.');
    }

    /**
     * Build the authenticated request body for one server-owned preview.
     *
     * @param {string} template_slug      Selected template slug.
     * @param {string} booking_form_usage Selected usage identifier.
     * @param {string} preview_target     Embedded or window target.
     * @return {FormData} Request body.
     */
    function build_preview_request_body(template_slug, booking_form_usage, preview_target) {
      var request_body = new window.FormData();
      request_body.append('action', config.preview_action);
      request_body.append('nonce', config.nonce || '');
      request_body.append('template_slug', template_slug);
      request_body.append('booking_form_usage', booking_form_usage);
      request_body.append('preview_target', preview_target);
      return request_body;
    }

    /**
     * Confirm that a response belongs to the current server-validated selection.
     *
     * @param {Object} response            WordPress AJAX response.
     * @param {string} template_slug       Requested template slug.
     * @param {string} booking_form_usage  Requested usage identifier.
     * @param {string} preview_target      Requested preview target.
     * @return {Object} Validated response data.
     * @throws {Error} When response ownership or shape is invalid.
     */
    function validate_preview_response(response, template_slug, booking_form_usage, preview_target) {
      var response_data;
      var selected_card = get_selected_card();
      if (!response || !response.success || !response.data) {
        throw new Error(get_ajax_error_message(response));
      }
      response_data = response.data;
      if (String(response_data.template_slug || '') !== template_slug || String(response_data.booking_form_usage || '') !== booking_form_usage || String(response_data.preview_target || '') !== preview_target || !selected_card || String(selected_card.dataset.templateSlug || '') !== template_slug || get_selected_booking_form_usage() !== booking_form_usage) {
        throw new Error(get_message('preview_error', 'The interactive preview could not be loaded. Try refreshing it.'));
      }
      return response_data;
    }

    /**
     * Request and render the selected allow-listed template.
     *
     * @param {HTMLElement|null} card Selected template card.
     * @return {void}
     */
    function load_preview(card) {
      var template_slug = card ? String(card.dataset.templateSlug || '') : '';
      var booking_form_usage = get_selected_booking_form_usage();
      var request_sequence;
      var request_body;
      if (!template_slug || !booking_form_usage || !config.ajax_url || !config.preview_action) {
        set_preview_state(false, get_message('preview_error', 'The interactive preview could not be loaded. Try refreshing it.'));
        return;
      }
      if (preview_abort_controller && 'function' === typeof preview_abort_controller.abort) {
        preview_abort_controller.abort();
      }
      preview_abort_controller = 'function' === typeof window.AbortController ? new window.AbortController() : null;
      request_sequence = ++preview_request_sequence;
      request_body = build_preview_request_body(template_slug, booking_form_usage, 'embedded');
      set_preview_state(true, '');
      window.fetch(config.ajax_url, {
        method: 'POST',
        body: request_body,
        credentials: 'same-origin',
        signal: preview_abort_controller ? preview_abort_controller.signal : undefined
      }).then(function (response) {
        return response.json();
      }).then(function (response) {
        var response_data;
        var preview_kind;
        var preview_url;
        if (request_sequence !== preview_request_sequence) {
          return;
        }
        response_data = validate_preview_response(response, template_slug, booking_form_usage, 'embedded');
        preview_kind = String(response_data.preview_kind || '');
        if ('inline' === preview_kind && response_data.html && response_data.bootstrap && 'object' === typeof response_data.bootstrap && inline_preview_renderer) {
          return inline_preview_renderer.replace(String(response_data.html), response_data.bootstrap, function () {
            return request_sequence === preview_request_sequence;
          }).then(function () {
            if (request_sequence !== preview_request_sequence) {
              return;
            }
            clear_preview_frame();
            editor.inline_preview.hidden = false;
            set_current_preview('inline', '', template_slug, booking_form_usage);
            set_preview_state(false, '');
          });
        }
        if ('url' !== preview_kind || !response_data.preview_url) {
          throw new Error(get_message('preview_error', 'The interactive preview could not be loaded. Try refreshing it.'));
        }
        preview_url = String(response_data.preview_url);
        editor.preview_frame.onload = function () {
          if (request_sequence !== preview_request_sequence) {
            return;
          }
          editor.inline_preview.hidden = true;
          editor.preview_frame.hidden = false;
          set_current_preview('url', preview_url, template_slug, booking_form_usage);
          set_preview_state(false, '');
        };
        editor.preview_frame.setAttribute('data-preview-template-slug', template_slug);
        editor.preview_frame.setAttribute('data-preview-booking-form-usage', booking_form_usage);
        editor.preview_frame.src = preview_url;
      }).catch(function (error) {
        if (error && 'AbortError' === error.name) {
          return;
        }
        if (request_sequence !== preview_request_sequence) {
          return;
        }
        set_preview_state(false, error && error.message ? error.message : get_message('preview_error', 'The interactive preview could not be loaded. Try refreshing it.'));
      });
    }

    /**
     * Open the full-site preview, lazily creating a signed session when needed.
     *
     * @param {HTMLElement|null} card Selected template card.
     * @return {void}
     */
    function open_preview(card) {
      var template_slug = card ? String(card.dataset.templateSlug || '') : '';
      var booking_form_usage = get_selected_booking_form_usage();
      var preview_window;
      var request_sequence;
      if (!template_slug || !booking_form_usage || editor.open_button.disabled) {
        return;
      }
      if (current_preview_matches(template_slug, booking_form_usage) && current_preview.url) {
        window.open(current_preview.url, '_blank', 'noopener,noreferrer');
        return;
      }
      preview_window = window.open('', '_blank');
      if (!preview_window) {
        set_preview_state(false, get_message('preview_open_error', 'The full-site preview could not be opened. Try again.'));
        return;
      }
      preview_window.opener = null;
      if (open_abort_controller && 'function' === typeof open_abort_controller.abort) {
        open_abort_controller.abort();
      }
      open_abort_controller = 'function' === typeof window.AbortController ? new window.AbortController() : null;
      request_sequence = ++open_request_sequence;
      open_request_is_loading = true;
      editor.open_button.disabled = true;
      window.fetch(config.ajax_url, {
        method: 'POST',
        body: build_preview_request_body(template_slug, booking_form_usage, 'window'),
        credentials: 'same-origin',
        signal: open_abort_controller ? open_abort_controller.signal : undefined
      }).then(function (response) {
        return response.json();
      }).then(function (response) {
        var response_data;
        if (request_sequence !== open_request_sequence) {
          return;
        }
        response_data = validate_preview_response(response, template_slug, booking_form_usage, 'window');
        if ('url' !== String(response_data.preview_kind || '') || !response_data.preview_url) {
          throw new Error(get_message('preview_open_error', 'The full-site preview could not be opened. Try again.'));
        }
        preview_window.location.replace(String(response_data.preview_url));
      }).catch(function (error) {
        if (error && 'AbortError' === error.name) {
          preview_window.close();
          return;
        }
        if (request_sequence !== open_request_sequence) {
          return;
        }
        preview_window.close();
        set_preview_state(false, error && error.message ? error.message : get_message('preview_open_error', 'The full-site preview could not be opened. Try again.'));
      }).then(function () {
        if (request_sequence === open_request_sequence) {
          open_request_is_loading = false;
          editor.open_button.disabled = !get_selected_card();
        }
      });
    }

    /**
     * Select one card and load its real preview.
     *
     * @param {HTMLElement} card         Template card.
     * @param {boolean}     load_selected Whether to request a replacement preview.
     * @return {void}
     */
    function select_card(card, load_selected) {
      var radio = card && card.querySelector('[data-wpbc-template-radio]');
      if (!radio) {
        return;
      }
      radio.checked = true;
      editor.cards.forEach(function (template_card) {
        template_card.classList.toggle('is-selected', template_card === card);
      });
      shell_api.clear_field_error('booking_form_template');
      render_preview_metadata(card);
      if (false !== load_selected) {
        load_preview(card);
      }
    }

    /**
     * Return cards matching the current search and category.
     *
     * @return {HTMLElement[]} Matching cards in server order.
     */
    function get_matching_cards() {
      var query = normalize_search_text(editor.search ? editor.search.value.trim() : '');
      return editor.cards.filter(function (card) {
        var matches_filter = 'all' === editor.active_filter || 'recommended' === editor.active_filter && 'true' === card.dataset.templateRecommended || editor.active_filter === card.dataset.templateCategory;
        var matches_search = !query || -1 !== get_card_search_text(card).indexOf(query);
        return matches_filter && matches_search;
      });
    }

    /**
     * Render every card matching the current search and category.
     *
     * @return {void}
     */
    function render_catalog() {
      var matching_cards = get_matching_cards();
      editor.cards.forEach(function (card) {
        card.hidden = true;
      });
      matching_cards.forEach(function (card) {
        card.hidden = false;
      });
      editor.empty.hidden = 0 !== matching_cards.length;
      editor.empty.textContent = get_message('no_matching_templates', 'No templates match this search and filter.');
      editor.grid.scrollLeft = 0;
    }

    /**
     * Activate one category tab and refresh the visible cards.
     *
     * @param {HTMLElement} tab Filter tab button.
     * @return {void}
     */
    function activate_filter(tab) {
      if (!tab) {
        return;
      }
      editor.active_filter = tab.dataset.wpbcTemplateFilter || 'all';
      editor.tabs.forEach(function (filter_tab) {
        var is_active = filter_tab === tab;
        filter_tab.classList.toggle('is-active', is_active);
        filter_tab.setAttribute('aria-selected', is_active ? 'true' : 'false');
        filter_tab.tabIndex = is_active ? 0 : -1;
      });
      editor.grid.setAttribute('aria-labelledby', tab.id);
      render_catalog();
    }

    /**
     * Return the filter tab with the requested stable ID.
     *
     * @param {string} filter_id Stable filter ID.
     * @return {HTMLElement|null} Matching tab, or null.
     */
    function get_filter_tab(filter_id) {
      return editor.tabs.find(function (tab) {
        return filter_id === tab.dataset.wpbcTemplateFilter;
      }) || null;
    }

    /**
     * Apply text-search changes immediately.
     *
     * Text search intentionally switches to All templates. Otherwise a valid
     * match such as a Full Days or contact template can remain hidden merely
     * because the Recommended tab was active before the user started typing.
     *
     * @return {void}
     */
    function handle_search_change() {
      var query = normalize_search_text(editor.search ? editor.search.value.trim() : '');
      var all_templates_tab = get_filter_tab('all');
      if (query && all_templates_tab && 'all' !== editor.active_filter) {
        activate_filter(all_templates_tab);
        return;
      }
      render_catalog();
    }

    /**
     * Handle selector and preview actions.
     *
     * @param {MouseEvent} event Click event.
     * @return {void}
     */
    function handle_click(event) {
      var filter = event.target.closest('[data-wpbc-template-filter]');
      var refresh_button = event.target.closest('[data-wpbc-template-refresh]');
      var open_link = event.target.closest('[data-wpbc-template-open-preview]');
      var template_card = event.target.closest('[data-wpbc-template-card]');
      var template_radio;
      if (filter) {
        activate_filter(filter);
        return;
      }
      if (refresh_button) {
        load_preview(get_selected_card());
        return;
      }
      if (open_link) {
        open_preview(get_selected_card());
        return;
      }
      if (template_card) {
        template_radio = template_card.querySelector('[data-wpbc-template-radio]');
        if (template_radio && !template_radio.checked) {
          event.preventDefault();
          select_card(template_card, true);
          template_radio.focus();
        }
        return;
      }
    }

    /**
     * Synchronize one entry-point choice with its native radio and card.
     *
     * @param {string} booking_form_usage Stable entry-point identifier.
     * @return {HTMLInputElement|null} Matching radio control, or null.
     */
    function select_booking_form_usage(booking_form_usage) {
      var selected_radio = null;
      Array.prototype.slice.call(editor.node.querySelectorAll('[data-wpbc-booking-form-usage-radio]')).forEach(function (usage_radio) {
        var is_selected = booking_form_usage === String(usage_radio.value || '');
        usage_radio.checked = is_selected;
        usage_radio.closest('.wpbc_setup_wizard__booking-form-usage-option').classList.toggle('is-selected', is_selected);
        if (is_selected) {
          selected_radio = usage_radio;
        }
      });
      return selected_radio;
    }

    /**
     * Commit an explained entry-point choice and refresh its preview.
     *
     * @param {string} booking_form_usage Stable entry-point identifier.
     * @return {void}
     */
    function commit_booking_form_usage(booking_form_usage) {
      if (!select_booking_form_usage(booking_form_usage)) {
        return;
      }
      confirmed_booking_form_usage = booking_form_usage;
      shell_api.clear_field_error('booking_form_usage');
      render_preview_metadata(get_selected_card());
      load_preview(get_selected_card());
    }

    /**
     * Commit or roll back the provisional Appointment flow radio selection.
     *
     * @param {CustomEvent} event Shared dialog lifecycle event.
     * @return {void}
     */
    function handle_dialog_closed(event) {
      var dialog_state = event.detail || {};
      if (appointment_flow_dialog_action !== dialog_state.action) {
        return;
      }
      if ('confirm' === dialog_state.outcome) {
        commit_booking_form_usage('appointment_flow');
        return;
      }
      select_booking_form_usage(confirmed_booking_form_usage);
    }

    /**
     * Handle native template radio changes.
     *
     * @param {Event} event Change event.
     * @return {void}
     */
    function handle_change(event) {
      if (event.target.matches('[data-wpbc-template-radio]')) {
        select_card(event.target.closest('[data-wpbc-template-card]'), true);
        return;
      }
      if (event.target.matches('[data-wpbc-booking-form-usage-radio]')) {
        select_booking_form_usage(String(event.target.value || ''));
        shell_api.clear_field_error('booking_form_usage');
        if ('appointment_flow' === event.target.value && 'appointment_flow' !== confirmed_booking_form_usage && 'function' === typeof shell_api.open_dialog) {
          if (shell_api.open_dialog(appointment_flow_dialog_action, event.target)) {
            return;
          }
        }
        commit_booking_form_usage(String(event.target.value || ''));
      }
    }

    /**
     * Provide arrow-key navigation across horizontally scrollable filter tabs.
     *
     * @param {KeyboardEvent} event Keyboard event.
     * @return {void}
     */
    function handle_keydown(event) {
      var tab = event.target.closest('[data-wpbc-template-filter]');
      var current_index;
      var target_index;
      if (!tab || -1 === ['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(event.key)) {
        return;
      }
      event.preventDefault();
      current_index = editor.tabs.indexOf(tab);
      target_index = current_index;
      if ('ArrowLeft' === event.key) {
        target_index = (current_index - 1 + editor.tabs.length) % editor.tabs.length;
      } else if ('ArrowRight' === event.key) {
        target_index = (current_index + 1) % editor.tabs.length;
      } else if ('Home' === event.key) {
        target_index = 0;
      } else if ('End' === event.key) {
        target_index = editor.tabs.length - 1;
      }
      activate_filter(editor.tabs[target_index]);
      editor.tabs[target_index].focus();
      editor.tabs[target_index].scrollIntoView({
        block: 'nearest',
        inline: 'nearest'
      });
    }

    /**
     * Initialize this module against shell-provided APIs.
     *
     * @param {Object} registered_shell_api Shared wizard adapter services.
     * @return {void}
     */
    function initialize(registered_shell_api) {
      var editor_node;
      var selected_card;
      var initial_preview_kind;
      var initial_template_slug;
      var initial_booking_form_usage;
      var initial_preview_bootstrap;
      var initial_preview_html;
      shell_api = registered_shell_api;
      root = shell_api.root;
      editor_node = root.querySelector('[data-wpbc-booking-form-template-editor]');
      if (!editor_node) {
        return;
      }
      editor = {
        node: editor_node,
        cards: Array.prototype.slice.call(editor_node.querySelectorAll('[data-wpbc-template-card]')),
        tabs: Array.prototype.slice.call(editor_node.querySelectorAll('[data-wpbc-template-filter]')),
        search: editor_node.querySelector('[data-wpbc-template-search]'),
        grid: editor_node.querySelector('[data-wpbc-template-grid]'),
        empty: editor_node.querySelector('[data-wpbc-template-empty]'),
        preview_stage: editor_node.querySelector('[data-wpbc-template-preview-stage]'),
        preview_loader: editor_node.querySelector('[data-wpbc-template-preview-loader]'),
        preview_error: editor_node.querySelector('[data-wpbc-template-preview-error]'),
        inline_preview: editor_node.querySelector('[data-wpbc-template-inline-preview]'),
        inline_preview_content: editor_node.querySelector('[data-wpbc-template-inline-preview-content]'),
        initial_preview_bootstrap: editor_node.querySelector('[data-wpbc-template-initial-preview-bootstrap]'),
        preview_frame: editor_node.querySelector('[data-wpbc-template-preview-frame]'),
        refresh_button: editor_node.querySelector('[data-wpbc-template-refresh]'),
        open_button: editor_node.querySelector('[data-wpbc-template-open-preview]'),
        active_filter: editor_node.dataset.initialFilter || 'all'
      };
      if (window.wpbc_bfb_inline_preview && 'function' === typeof window.wpbc_bfb_inline_preview.create) {
        inline_preview_renderer = window.wpbc_bfb_inline_preview.create(editor.inline_preview_content);
      }
      editor.node.addEventListener('click', handle_click);
      editor.node.addEventListener('change', handle_change);
      editor.node.addEventListener('keydown', handle_keydown);
      root.addEventListener('wpbc:setup-wizard-dialog-closed', handle_dialog_closed);
      confirmed_booking_form_usage = get_selected_booking_form_usage();
      if (editor.search) {
        editor.search.addEventListener('input', handle_search_change);
        editor.search.addEventListener('search', handle_search_change);
        editor.search.addEventListener('change', handle_search_change);
      }
      editor.cards.forEach(function (card) {
        initialize_image_fallback(card.querySelector('[data-wpbc-template-card-image]'), card.querySelector('[data-wpbc-template-image-placeholder]'));
      });
      render_catalog();
      selected_card = get_selected_card();
      if (selected_card) {
        initial_preview_kind = String(editor.preview_stage.dataset.initialPreviewKind || '');
        initial_template_slug = String(editor.preview_stage.dataset.initialPreviewTemplateSlug || '');
        initial_booking_form_usage = String(editor.preview_stage.dataset.initialPreviewBookingFormUsage || '');
        select_card(selected_card, false);
        if ('inline' === initial_preview_kind && initial_template_slug === String(selected_card.dataset.templateSlug || '') && initial_booking_form_usage === get_selected_booking_form_usage() && inline_preview_renderer && editor.initial_preview_bootstrap) {
          try {
            initial_preview_bootstrap = JSON.parse(editor.initial_preview_bootstrap.textContent || '{}');
          } catch (error) {
            initial_preview_bootstrap = null;
          }
          initial_preview_html = editor.inline_preview_content.innerHTML;
          if (initial_preview_bootstrap && 'object' === typeof initial_preview_bootstrap) {
            inline_preview_renderer.replace(initial_preview_html, initial_preview_bootstrap).done(function () {
              set_current_preview('inline', '', initial_template_slug, initial_booking_form_usage);
              set_preview_state(false, '');
            }).fail(function () {
              load_preview(selected_card);
            });
          } else {
            load_preview(selected_card);
          }
        } else {
          load_preview(selected_card);
        }
      } else {
        render_preview_metadata(null);
        set_preview_state(false, get_message('preview_error', 'The interactive preview could not be loaded. Try refreshing it.'));
      }
      if ('function' === typeof shell_api.open_dialog) {
        window.setTimeout(function () {
          shell_api.open_dialog(template_guidance_dialog_action, editor.search || editor.node);
        }, 0);
      }
    }

    /**
     * Validate the required selection before forward navigation.
     *
     * @return {HTMLElement|null} First invalid radio, or null.
     */
    function validate() {
      var selected_radio = editor && editor.node.querySelector('[data-wpbc-template-radio]:checked');
      var selected_usage = editor && editor.node.querySelector('[data-wpbc-booking-form-usage-radio]:checked');
      if (!selected_radio) {
        return shell_api.set_field_error('booking_form_template', get_message('template_required', 'Choose a booking form template.'));
      }
      if (!selected_usage) {
        return shell_api.set_field_error('booking_form_usage', get_message('usage_required', 'Choose how customers will open the booking form.'));
      }
      return null;
    }
    return {
      initialize: initialize,
      sync: function () {},
      validate: validate
    };
  }
  window.wpbc_setup_editor_modules = window.wpbc_setup_editor_modules || {};
  window.wpbc_setup_editor_modules.booking_form_template = {
    create: create_booking_form_template_adapter
  };
  if (window.wpbc_setup_wizard_api && 'function' === typeof window.wpbc_setup_wizard_api.register_step_adapter) {
    window.wpbc_setup_wizard_api.register_step_adapter(create_booking_form_template_adapter(module_config));
  }
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1zZXR1cC13aXphcmQvc3RlcC1ib29raW5nLWZvcm0tdGVtcGxhdGUvX291dC9zdGVwLWJvb2tpbmctZm9ybS10ZW1wbGF0ZS5qcyIsIm5hbWVzIjpbIndpbmRvdyIsImRvY3VtZW50IiwibW9kdWxlX2NvbmZpZyIsIndwYmNfc2V0dXBfd2l6YXJkX2Jvb2tpbmdfZm9ybV90ZW1wbGF0ZSIsImkxOG4iLCJjcmVhdGVfYm9va2luZ19mb3JtX3RlbXBsYXRlX2FkYXB0ZXIiLCJjb25maWciLCJhcHBvaW50bWVudF9mbG93X2RpYWxvZ19hY3Rpb24iLCJ0ZW1wbGF0ZV9ndWlkYW5jZV9kaWFsb2dfYWN0aW9uIiwic2hlbGxfYXBpIiwicm9vdCIsImVkaXRvciIsImNvbmZpcm1lZF9ib29raW5nX2Zvcm1fdXNhZ2UiLCJwcmV2aWV3X3JlcXVlc3Rfc2VxdWVuY2UiLCJwcmV2aWV3X2Fib3J0X2NvbnRyb2xsZXIiLCJvcGVuX3JlcXVlc3Rfc2VxdWVuY2UiLCJvcGVuX2Fib3J0X2NvbnRyb2xsZXIiLCJvcGVuX3JlcXVlc3RfaXNfbG9hZGluZyIsImlubGluZV9wcmV2aWV3X3JlbmRlcmVyIiwiY3VycmVudF9wcmV2aWV3Iiwia2luZCIsInVybCIsInRlbXBsYXRlX3NsdWciLCJib29raW5nX2Zvcm1fdXNhZ2UiLCJnZXRfbWVzc2FnZSIsImtleSIsImZhbGxiYWNrIiwibm9ybWFsaXplX3NlYXJjaF90ZXh0IiwidGV4dCIsIlN0cmluZyIsInRvTG9jYWxlTG93ZXJDYXNlIiwiZ2V0X2NhcmRfc2VhcmNoX3RleHQiLCJjYXJkIiwidGl0bGUiLCJxdWVyeVNlbGVjdG9yIiwiZGVzY3JpcHRpb24iLCJ0ZXh0Q29udGVudCIsImRhdGFzZXQiLCJ0ZW1wbGF0ZVNsdWciLCJpbml0aWFsaXplX2ltYWdlX2ZhbGxiYWNrIiwiaW1hZ2UiLCJwbGFjZWhvbGRlciIsImFkZEV2ZW50TGlzdGVuZXIiLCJoaWRkZW4iLCJjb21wbGV0ZSIsInNyYyIsIm5hdHVyYWxXaWR0aCIsImdldF9zZWxlY3RlZF9jYXJkIiwic2VsZWN0ZWRfcmFkaW8iLCJub2RlIiwiY2xvc2VzdCIsImdldF9zZWxlY3RlZF9ib29raW5nX2Zvcm1fdXNhZ2UiLCJ2YWx1ZSIsImdldF9wcmV2aWV3X3Nob3J0Y29kZSIsInJlbmRlcl9wcmV2aWV3X21ldGFkYXRhIiwidGl0bGVfbm9kZSIsInNsdWdfbm9kZSIsInNob3J0Y29kZV9ub2RlIiwiZGVzY3JpcHRpb25fbm9kZSIsInRyaW0iLCJzZXRfcHJldmlld19zdGF0ZSIsImlzX2xvYWRpbmciLCJlcnJvcl90ZXh0IiwiaGFzX2Vycm9yIiwicHJldmlld19zdGFnZSIsImNsYXNzTGlzdCIsInRvZ2dsZSIsInNldEF0dHJpYnV0ZSIsInByZXZpZXdfbG9hZGVyIiwicHJldmlld19lcnJvciIsInJlZnJlc2hfYnV0dG9uIiwiZGlzYWJsZWQiLCJvcGVuX2J1dHRvbiIsImNsZWFyX3ByZXZpZXdfZnJhbWUiLCJwcmV2aWV3X2ZyYW1lIiwicmVtb3ZlQXR0cmlidXRlIiwic2V0X2N1cnJlbnRfcHJldmlldyIsInByZXZpZXdfa2luZCIsInByZXZpZXdfdXJsIiwiY3VycmVudF9wcmV2aWV3X21hdGNoZXMiLCJnZXRfYWpheF9lcnJvcl9tZXNzYWdlIiwicmVzcG9uc2UiLCJkYXRhIiwibWVzc2FnZSIsImJ1aWxkX3ByZXZpZXdfcmVxdWVzdF9ib2R5IiwicHJldmlld190YXJnZXQiLCJyZXF1ZXN0X2JvZHkiLCJGb3JtRGF0YSIsImFwcGVuZCIsInByZXZpZXdfYWN0aW9uIiwibm9uY2UiLCJ2YWxpZGF0ZV9wcmV2aWV3X3Jlc3BvbnNlIiwicmVzcG9uc2VfZGF0YSIsInNlbGVjdGVkX2NhcmQiLCJzdWNjZXNzIiwiRXJyb3IiLCJsb2FkX3ByZXZpZXciLCJyZXF1ZXN0X3NlcXVlbmNlIiwiYWpheF91cmwiLCJhYm9ydCIsIkFib3J0Q29udHJvbGxlciIsImZldGNoIiwibWV0aG9kIiwiYm9keSIsImNyZWRlbnRpYWxzIiwic2lnbmFsIiwidW5kZWZpbmVkIiwidGhlbiIsImpzb24iLCJodG1sIiwiYm9vdHN0cmFwIiwicmVwbGFjZSIsImlubGluZV9wcmV2aWV3Iiwib25sb2FkIiwiY2F0Y2giLCJlcnJvciIsIm5hbWUiLCJvcGVuX3ByZXZpZXciLCJwcmV2aWV3X3dpbmRvdyIsIm9wZW4iLCJvcGVuZXIiLCJsb2NhdGlvbiIsImNsb3NlIiwic2VsZWN0X2NhcmQiLCJsb2FkX3NlbGVjdGVkIiwicmFkaW8iLCJjaGVja2VkIiwiY2FyZHMiLCJmb3JFYWNoIiwidGVtcGxhdGVfY2FyZCIsImNsZWFyX2ZpZWxkX2Vycm9yIiwiZ2V0X21hdGNoaW5nX2NhcmRzIiwicXVlcnkiLCJzZWFyY2giLCJmaWx0ZXIiLCJtYXRjaGVzX2ZpbHRlciIsImFjdGl2ZV9maWx0ZXIiLCJ0ZW1wbGF0ZVJlY29tbWVuZGVkIiwidGVtcGxhdGVDYXRlZ29yeSIsIm1hdGNoZXNfc2VhcmNoIiwiaW5kZXhPZiIsInJlbmRlcl9jYXRhbG9nIiwibWF0Y2hpbmdfY2FyZHMiLCJlbXB0eSIsImxlbmd0aCIsImdyaWQiLCJzY3JvbGxMZWZ0IiwiYWN0aXZhdGVfZmlsdGVyIiwidGFiIiwid3BiY1RlbXBsYXRlRmlsdGVyIiwidGFicyIsImZpbHRlcl90YWIiLCJpc19hY3RpdmUiLCJ0YWJJbmRleCIsImlkIiwiZ2V0X2ZpbHRlcl90YWIiLCJmaWx0ZXJfaWQiLCJmaW5kIiwiaGFuZGxlX3NlYXJjaF9jaGFuZ2UiLCJhbGxfdGVtcGxhdGVzX3RhYiIsImhhbmRsZV9jbGljayIsImV2ZW50IiwidGFyZ2V0Iiwib3Blbl9saW5rIiwidGVtcGxhdGVfcmFkaW8iLCJwcmV2ZW50RGVmYXVsdCIsImZvY3VzIiwic2VsZWN0X2Jvb2tpbmdfZm9ybV91c2FnZSIsIkFycmF5IiwicHJvdG90eXBlIiwic2xpY2UiLCJjYWxsIiwicXVlcnlTZWxlY3RvckFsbCIsInVzYWdlX3JhZGlvIiwiaXNfc2VsZWN0ZWQiLCJjb21taXRfYm9va2luZ19mb3JtX3VzYWdlIiwiaGFuZGxlX2RpYWxvZ19jbG9zZWQiLCJkaWFsb2dfc3RhdGUiLCJkZXRhaWwiLCJhY3Rpb24iLCJvdXRjb21lIiwiaGFuZGxlX2NoYW5nZSIsIm1hdGNoZXMiLCJvcGVuX2RpYWxvZyIsImhhbmRsZV9rZXlkb3duIiwiY3VycmVudF9pbmRleCIsInRhcmdldF9pbmRleCIsInNjcm9sbEludG9WaWV3IiwiYmxvY2siLCJpbmxpbmUiLCJpbml0aWFsaXplIiwicmVnaXN0ZXJlZF9zaGVsbF9hcGkiLCJlZGl0b3Jfbm9kZSIsImluaXRpYWxfcHJldmlld19raW5kIiwiaW5pdGlhbF90ZW1wbGF0ZV9zbHVnIiwiaW5pdGlhbF9ib29raW5nX2Zvcm1fdXNhZ2UiLCJpbml0aWFsX3ByZXZpZXdfYm9vdHN0cmFwIiwiaW5pdGlhbF9wcmV2aWV3X2h0bWwiLCJpbmxpbmVfcHJldmlld19jb250ZW50IiwiaW5pdGlhbEZpbHRlciIsIndwYmNfYmZiX2lubGluZV9wcmV2aWV3IiwiY3JlYXRlIiwiaW5pdGlhbFByZXZpZXdLaW5kIiwiaW5pdGlhbFByZXZpZXdUZW1wbGF0ZVNsdWciLCJpbml0aWFsUHJldmlld0Jvb2tpbmdGb3JtVXNhZ2UiLCJKU09OIiwicGFyc2UiLCJpbm5lckhUTUwiLCJkb25lIiwiZmFpbCIsInNldFRpbWVvdXQiLCJ2YWxpZGF0ZSIsInNlbGVjdGVkX3VzYWdlIiwic2V0X2ZpZWxkX2Vycm9yIiwic3luYyIsIndwYmNfc2V0dXBfZWRpdG9yX21vZHVsZXMiLCJib29raW5nX2Zvcm1fdGVtcGxhdGUiLCJ3cGJjX3NldHVwX3dpemFyZF9hcGkiLCJyZWdpc3Rlcl9zdGVwX2FkYXB0ZXIiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLXNldHVwLXdpemFyZC9zdGVwLWJvb2tpbmctZm9ybS10ZW1wbGF0ZS9fc3JjL3N0ZXAtYm9va2luZy1mb3JtLXRlbXBsYXRlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUHJvdmlkZSB0aGUgcmV1c2FibGUgQm9va2luZyBGb3JtIHRlbXBsYXRlIGNhdGFsb2cgYW5kIGludGVyYWN0aXZlIHByZXZpZXcuXG4gKlxuICogQ2F0YWxvZyBjYXJkcyByZW1haW4gc2VydmVyLXJlbmRlcmVkLiBEaXJlY3QgdGVtcGxhdGVzIHVzZSByZXF1ZXN0LWxvY2FsXG4gKiBpbmxpbmUgSFRNTCwgd2hpbGUgQXBwb2ludG1lbnQgRmxvdyBhbmQgZnVsbC1zaXRlIHByZXZpZXdzIHVzZSBzaWduZWQgVVJMcy5cbiAqIFRoZSBicm93c2VyIG5ldmVyIHJlY2VpdmVzIHJhdyB0ZW1wbGF0ZSBkZWZpbml0aW9ucyBhbmQgbmV2ZXIgYXBwbGllcyBhIGZvcm0uXG4gKlxuICogQHBhY2thZ2UgQm9va2luZyBDYWxlbmRhclxuICovXG4oIGZ1bmN0aW9uICggd2luZG93LCBkb2N1bWVudCApIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdHZhciBtb2R1bGVfY29uZmlnID0gd2luZG93LndwYmNfc2V0dXBfd2l6YXJkX2Jvb2tpbmdfZm9ybV90ZW1wbGF0ZSB8fCB7IGkxOG46IHt9IH07XG5cblx0LyoqXG5cdCAqIENyZWF0ZSBvbmUgaXNvbGF0ZWQgQm9va2luZyBGb3JtIHRlbXBsYXRlIHNlbGVjdG9yIGFkYXB0ZXIuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgTW9kdWxlIGVuZHBvaW50IGFuZCB0cmFuc2xhdGlvbiBzZXR0aW5ncy5cblx0ICogQHJldHVybiB7T2JqZWN0fSBTdGVwIGFkYXB0ZXIgYWNjZXB0ZWQgYnkgdGhlIHNoYXJlZCB3aXphcmQgc2hlbGwuXG5cdCAqL1xuXHRmdW5jdGlvbiBjcmVhdGVfYm9va2luZ19mb3JtX3RlbXBsYXRlX2FkYXB0ZXIoIGNvbmZpZyApIHtcblx0XHR2YXIgYXBwb2ludG1lbnRfZmxvd19kaWFsb2dfYWN0aW9uID0gJ2Jvb2tpbmctZm9ybS1hcHBvaW50bWVudC1mbG93Jztcblx0XHR2YXIgdGVtcGxhdGVfZ3VpZGFuY2VfZGlhbG9nX2FjdGlvbiA9ICdib29raW5nLWZvcm0tdGVtcGxhdGUtZ3VpZGFuY2UnO1xuXHRcdHZhciBzaGVsbF9hcGkgPSBudWxsO1xuXHRcdHZhciByb290ID0gbnVsbDtcblx0XHR2YXIgZWRpdG9yID0gbnVsbDtcblx0XHR2YXIgY29uZmlybWVkX2Jvb2tpbmdfZm9ybV91c2FnZSA9ICcnO1xuXHRcdHZhciBwcmV2aWV3X3JlcXVlc3Rfc2VxdWVuY2UgPSAwO1xuXHRcdHZhciBwcmV2aWV3X2Fib3J0X2NvbnRyb2xsZXIgPSBudWxsO1xuXHRcdHZhciBvcGVuX3JlcXVlc3Rfc2VxdWVuY2UgPSAwO1xuXHRcdHZhciBvcGVuX2Fib3J0X2NvbnRyb2xsZXIgPSBudWxsO1xuXHRcdHZhciBvcGVuX3JlcXVlc3RfaXNfbG9hZGluZyA9IGZhbHNlO1xuXHRcdHZhciBpbmxpbmVfcHJldmlld19yZW5kZXJlciA9IG51bGw7XG5cdFx0dmFyIGN1cnJlbnRfcHJldmlldyA9IHtcblx0XHRcdGtpbmQ6ICcnLFxuXHRcdFx0dXJsOiAnJyxcblx0XHRcdHRlbXBsYXRlX3NsdWc6ICcnLFxuXHRcdFx0Ym9va2luZ19mb3JtX3VzYWdlOiAnJ1xuXHRcdH07XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gb25lIHRyYW5zbGF0ZWQgc3RyaW5nIHdpdGggYSBzYWZlIGZhbGxiYWNrLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGtleSAgICAgIFRyYW5zbGF0aW9uIGtleS5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gZmFsbGJhY2sgRmFsbGJhY2sgY29weS5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IFRyYW5zbGF0aW9uIG9yIGZhbGxiYWNrLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9tZXNzYWdlKCBrZXksIGZhbGxiYWNrICkge1xuXHRcdFx0cmV0dXJuIGNvbmZpZy5pMThuICYmIGNvbmZpZy5pMThuWyBrZXkgXSA/IGNvbmZpZy5pMThuWyBrZXkgXSA6IGZhbGxiYWNrO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBub3JtYWxpemVkIHRleHQgZm9yIGNhc2UtaW5zZW5zaXRpdmUgY2F0YWxvZyBzZWFyY2hpbmcuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdGV4dCBTb3VyY2UgdGV4dC5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IExvd2VyY2FzZSBub3JtYWxpemVkIHRleHQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbm9ybWFsaXplX3NlYXJjaF90ZXh0KCB0ZXh0ICkge1xuXHRcdFx0cmV0dXJuIFN0cmluZyggdGV4dCB8fCAnJyApLnRvTG9jYWxlTG93ZXJDYXNlKCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIG9uZSB0ZW1wbGF0ZSBjYXJkJ3Mgc2VhcmNoYWJsZSB0ZXh0LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gY2FyZCBUZW1wbGF0ZSBjYXJkLlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gTm9ybWFsaXplZCBzZWFyY2hhYmxlIHRleHQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X2NhcmRfc2VhcmNoX3RleHQoIGNhcmQgKSB7XG5cdFx0XHR2YXIgdGl0bGUgPSBjYXJkLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRlbXBsYXRlLXRpdGxlXScgKTtcblx0XHRcdHZhciBkZXNjcmlwdGlvbiA9IGNhcmQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGVtcGxhdGUtZGVzY3JpcHRpb25dJyApO1xuXG5cdFx0XHRyZXR1cm4gbm9ybWFsaXplX3NlYXJjaF90ZXh0KFxuXHRcdFx0XHQoIHRpdGxlID8gdGl0bGUudGV4dENvbnRlbnQgOiAnJyApICsgJyAnICtcblx0XHRcdFx0KCBkZXNjcmlwdGlvbiA/IGRlc2NyaXB0aW9uLnRleHRDb250ZW50IDogJycgKSArICcgJyArXG5cdFx0XHRcdCggY2FyZC5kYXRhc2V0LnRlbXBsYXRlU2x1ZyB8fCAnJyApXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEluc3RhbGwgYSBncmFjZWZ1bCBmYWxsYmFjayBmb3Igb25lIGNhdGFsb2cgdGh1bWJuYWlsLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MSW1hZ2VFbGVtZW50fG51bGx9IGltYWdlICAgICAgIEltYWdlIGVsZW1lbnQuXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxudWxsfSAgICAgIHBsYWNlaG9sZGVyIFBsYWNlaG9sZGVyIGVsZW1lbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpbml0aWFsaXplX2ltYWdlX2ZhbGxiYWNrKCBpbWFnZSwgcGxhY2Vob2xkZXIgKSB7XG5cdFx0XHRpZiAoICEgaW1hZ2UgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aW1hZ2UuYWRkRXZlbnRMaXN0ZW5lciggJ2xvYWQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGltYWdlLmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0XHRpZiAoIHBsYWNlaG9sZGVyICkge1xuXHRcdFx0XHRcdHBsYWNlaG9sZGVyLmhpZGRlbiA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdGltYWdlLmFkZEV2ZW50TGlzdGVuZXIoICdlcnJvcicsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0aW1hZ2UuaGlkZGVuID0gdHJ1ZTtcblx0XHRcdFx0aWYgKCBwbGFjZWhvbGRlciApIHtcblx0XHRcdFx0XHRwbGFjZWhvbGRlci5oaWRkZW4gPSBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXG5cdFx0XHRpZiAoIGltYWdlLmNvbXBsZXRlICYmIGltYWdlLnNyYyAmJiAwID09PSBpbWFnZS5uYXR1cmFsV2lkdGggKSB7XG5cdFx0XHRcdGltYWdlLmhpZGRlbiA9IHRydWU7XG5cdFx0XHRcdGlmICggcGxhY2Vob2xkZXIgKSB7XG5cdFx0XHRcdFx0cGxhY2Vob2xkZXIuaGlkZGVuID0gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gdGhlIGN1cnJlbnRseSBzZWxlY3RlZCBzZXJ2ZXItcmVuZGVyZWQgY2FyZC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge0hUTUxFbGVtZW50fG51bGx9IFNlbGVjdGVkIGNhcmQgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfc2VsZWN0ZWRfY2FyZCgpIHtcblx0XHRcdHZhciBzZWxlY3RlZF9yYWRpbyA9IGVkaXRvciAmJiBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10ZW1wbGF0ZS1yYWRpb106Y2hlY2tlZCcgKTtcblxuXHRcdFx0cmV0dXJuIHNlbGVjdGVkX3JhZGlvID8gc2VsZWN0ZWRfcmFkaW8uY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGVtcGxhdGUtY2FyZF0nICkgOiBudWxsO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiB0aGUgc2VsZWN0ZWQgc2VydmVyLXJlbmRlcmVkIEJvb2tpbmcgRm9ybSBlbnRyeSBwb2ludC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gU3RhYmxlIHVzYWdlIGlkZW50aWZpZXIsIG9yIGFuIGVtcHR5IHN0cmluZy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfc2VsZWN0ZWRfYm9va2luZ19mb3JtX3VzYWdlKCkge1xuXHRcdFx0dmFyIHNlbGVjdGVkX3JhZGlvID0gZWRpdG9yICYmIGVkaXRvci5ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctZm9ybS11c2FnZS1yYWRpb106Y2hlY2tlZCcgKTtcblxuXHRcdFx0cmV0dXJuIHNlbGVjdGVkX3JhZGlvID8gU3RyaW5nKCBzZWxlY3RlZF9yYWRpby52YWx1ZSB8fCAnJyApIDogJyc7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQnVpbGQgdGhlIGluZm9ybWF0aW9uYWwgc2hvcnRjb2RlIGZvciB0aGUgY3VycmVudCBhbGxvdy1saXN0ZWQgY2hvaWNlcy5cblx0XHQgKlxuXHRcdCAqIFRoZSB2YWx1ZSBpcyBpbnNlcnRlZCB3aXRoIHRleHRDb250ZW50IG9ubHkgYW5kIGlzIG5ldmVyIGV2YWx1YXRlZCBieSB0aGVcblx0XHQgKiBicm93c2VyLiBUaGUgcHJldmlldyBlbmRwb2ludCBpbmRlcGVuZGVudGx5IHZhbGlkYXRlcyBib3RoIGlkZW50aWZpZXJzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGJvb2tpbmdfZm9ybV91c2FnZSBTZWxlY3RlZCBlbnRyeS1wb2ludCBpZGVudGlmaWVyLlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gSW5mb3JtYXRpb25hbCBzaG9ydGNvZGUuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3ByZXZpZXdfc2hvcnRjb2RlKCBib29raW5nX2Zvcm1fdXNhZ2UgKSB7XG5cdFx0XHRyZXR1cm4gJ2FwcG9pbnRtZW50X2Zsb3cnID09PSBib29raW5nX2Zvcm1fdXNhZ2Vcblx0XHRcdFx0PyAnW2Jvb2tpbmdfYXBwb2ludG1lbnRdJ1xuXHRcdFx0XHQ6ICdbYm9va2luZ10nO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFN5bmNocm9uaXplIHRoZSBzZWxlY3RlZCB0ZW1wbGF0ZSBtZXRhZGF0YSBiZWxvdyB0aGUgcHJldmlldy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8bnVsbH0gY2FyZCBTZWxlY3RlZCB0ZW1wbGF0ZSBjYXJkLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX3ByZXZpZXdfbWV0YWRhdGEoIGNhcmQgKSB7XG5cdFx0XHR2YXIgdGl0bGVfbm9kZSA9IGVkaXRvci5ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRlbXBsYXRlLXByZXZpZXctdGl0bGVdJyApO1xuXHRcdFx0dmFyIHNsdWdfbm9kZSA9IGVkaXRvci5ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRlbXBsYXRlLXByZXZpZXctc2x1Z10nICk7XG5cdFx0XHR2YXIgc2hvcnRjb2RlX25vZGUgPSBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10ZW1wbGF0ZS1wcmV2aWV3LXNob3J0Y29kZV0nICk7XG5cdFx0XHR2YXIgZGVzY3JpcHRpb25fbm9kZSA9IGVkaXRvci5ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRlbXBsYXRlLXByZXZpZXctZGVzY3JpcHRpb25dJyApO1xuXHRcdFx0dmFyIHRpdGxlID0gY2FyZCAmJiBjYXJkLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRlbXBsYXRlLXRpdGxlXScgKTtcblx0XHRcdHZhciBkZXNjcmlwdGlvbiA9IGNhcmQgJiYgY2FyZC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10ZW1wbGF0ZS1kZXNjcmlwdGlvbl0nICk7XG5cdFx0XHR2YXIgdGVtcGxhdGVfc2x1ZyA9IGNhcmQgPyBTdHJpbmcoIGNhcmQuZGF0YXNldC50ZW1wbGF0ZVNsdWcgfHwgJycgKSA6ICcnO1xuXG5cdFx0XHRpZiAoIHRpdGxlX25vZGUgKSB7XG5cdFx0XHRcdHRpdGxlX25vZGUudGV4dENvbnRlbnQgPSB0aXRsZSA/IHRpdGxlLnRleHRDb250ZW50LnRyaW0oKSA6ICcnO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBzbHVnX25vZGUgKSB7XG5cdFx0XHRcdHNsdWdfbm9kZS50ZXh0Q29udGVudCA9IHRlbXBsYXRlX3NsdWc7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHNob3J0Y29kZV9ub2RlICkge1xuXHRcdFx0XHRzaG9ydGNvZGVfbm9kZS50ZXh0Q29udGVudCA9IGdldF9wcmV2aWV3X3Nob3J0Y29kZSggZ2V0X3NlbGVjdGVkX2Jvb2tpbmdfZm9ybV91c2FnZSgpICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGRlc2NyaXB0aW9uX25vZGUgKSB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uX25vZGUudGV4dENvbnRlbnQgPSBkZXNjcmlwdGlvbiA/IGRlc2NyaXB0aW9uLnRleHRDb250ZW50LnRyaW0oKSA6ICcnO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFVwZGF0ZSBwcmV2aWV3IGxvYWRpbmcsIGVycm9yLCBhbmQgYWN0aW9uIHN0YXRlcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfbG9hZGluZyBXaGV0aGVyIGEgcHJldmlldyByZXF1ZXN0L2ZyYW1lIGlzIGxvYWRpbmcuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9ICBlcnJvcl90ZXh0IFBsYWluIGVycm9yIHRleHQsIG9yIGFuIGVtcHR5IHN0cmluZy5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNldF9wcmV2aWV3X3N0YXRlKCBpc19sb2FkaW5nLCBlcnJvcl90ZXh0ICkge1xuXHRcdFx0dmFyIGhhc19lcnJvciA9ICcnICE9PSBTdHJpbmcoIGVycm9yX3RleHQgfHwgJycgKTtcblxuXHRcdFx0ZWRpdG9yLnByZXZpZXdfc3RhZ2UuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWxvYWRpbmcnLCBpc19sb2FkaW5nICk7XG5cdFx0XHRlZGl0b3IucHJldmlld19zdGFnZS5jbGFzc0xpc3QudG9nZ2xlKCAnaGFzLWVycm9yJywgaGFzX2Vycm9yICk7XG5cdFx0XHRlZGl0b3IucHJldmlld19zdGFnZS5zZXRBdHRyaWJ1dGUoICdhcmlhLWJ1c3knLCBpc19sb2FkaW5nID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xuXHRcdFx0ZWRpdG9yLnByZXZpZXdfbG9hZGVyLmhpZGRlbiA9ICEgaXNfbG9hZGluZztcblx0XHRcdGVkaXRvci5wcmV2aWV3X2Vycm9yLmhpZGRlbiA9ICEgaGFzX2Vycm9yO1xuXHRcdFx0aWYgKCBoYXNfZXJyb3IgKSB7XG5cdFx0XHRcdGVkaXRvci5wcmV2aWV3X2Vycm9yLnF1ZXJ5U2VsZWN0b3IoICdzcGFuJyApLnRleHRDb250ZW50ID0gZXJyb3JfdGV4dDtcblx0XHRcdH1cblx0XHRcdGVkaXRvci5yZWZyZXNoX2J1dHRvbi5kaXNhYmxlZCA9IGlzX2xvYWRpbmcgfHwgISBnZXRfc2VsZWN0ZWRfY2FyZCgpO1xuXHRcdFx0ZWRpdG9yLm9wZW5fYnV0dG9uLmRpc2FibGVkID0gaXNfbG9hZGluZyB8fCBvcGVuX3JlcXVlc3RfaXNfbG9hZGluZyB8fCAhIGdldF9zZWxlY3RlZF9jYXJkKCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2xlYXIgdGhlIGlmcmFtZSdzIGFzc29jaWF0aW9uIHdpdGggYW4gZWFybGllciB0ZW1wbGF0ZSBwcmV2aWV3LlxuXHRcdCAqXG5cdFx0ICogVGhlIGF0dHJpYnV0ZSBpcyBkaWFnbm9zdGljIGFzIHdlbGwgYXMgZnVuY3Rpb25hbDogaXQgbGV0cyBicm93c2VyIHRlc3RzXG5cdFx0ICogdmVyaWZ5IHRoYXQgdGhlIHZpc2libGUgaWZyYW1lIGJlbG9uZ3MgdG8gdGhlIGN1cnJlbnRseSBzZWxlY3RlZCBjYXJkLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjbGVhcl9wcmV2aWV3X2ZyYW1lKCkge1xuXHRcdFx0ZWRpdG9yLnByZXZpZXdfZnJhbWUucmVtb3ZlQXR0cmlidXRlKCAnZGF0YS1wcmV2aWV3LXRlbXBsYXRlLXNsdWcnICk7XG5cdFx0XHRlZGl0b3IucHJldmlld19mcmFtZS5yZW1vdmVBdHRyaWJ1dGUoICdkYXRhLXByZXZpZXctYm9va2luZy1mb3JtLXVzYWdlJyApO1xuXHRcdFx0ZWRpdG9yLnByZXZpZXdfZnJhbWUuc3JjID0gJ2Fib3V0OmJsYW5rJztcblx0XHRcdGVkaXRvci5wcmV2aWV3X2ZyYW1lLmhpZGRlbiA9IHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVjb3JkIG9uZSBzdWNjZXNzZnVsbHkgcmVuZGVyZWQgcHJldmlldy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBwcmV2aWV3X2tpbmQgICAgICBJbmxpbmUgb3IgVVJMIHByZXZpZXcga2luZC5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gcHJldmlld191cmwgICAgICAgU2lnbmVkIFVSTCB3aGVuIGFwcGxpY2FibGUuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHRlbXBsYXRlX3NsdWcgICAgIFZhbGlkYXRlZCB0ZW1wbGF0ZSBzbHVnLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBib29raW5nX2Zvcm1fdXNhZ2UgVmFsaWRhdGVkIHVzYWdlIGlkZW50aWZpZXIuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRfY3VycmVudF9wcmV2aWV3KCBwcmV2aWV3X2tpbmQsIHByZXZpZXdfdXJsLCB0ZW1wbGF0ZV9zbHVnLCBib29raW5nX2Zvcm1fdXNhZ2UgKSB7XG5cdFx0XHRjdXJyZW50X3ByZXZpZXcgPSB7XG5cdFx0XHRcdGtpbmQ6IHByZXZpZXdfa2luZCxcblx0XHRcdFx0dXJsOiBwcmV2aWV3X3VybCxcblx0XHRcdFx0dGVtcGxhdGVfc2x1ZzogdGVtcGxhdGVfc2x1Zyxcblx0XHRcdFx0Ym9va2luZ19mb3JtX3VzYWdlOiBib29raW5nX2Zvcm1fdXNhZ2Vcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRGV0ZXJtaW5lIHdoZXRoZXIgdGhlIGN1cnJlbnQgcHJldmlldyBtYXRjaGVzIHRoZSBzZWxlY3RlZCBjb250cm9scy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZW1wbGF0ZV9zbHVnICAgICAgU2VsZWN0ZWQgdGVtcGxhdGUgc2x1Zy5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gYm9va2luZ19mb3JtX3VzYWdlIFNlbGVjdGVkIHVzYWdlIGlkZW50aWZpZXIuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gV2hldGhlciB0aGUgYWN0aXZlIHByZXZpZXcgYmVsb25ncyB0byB0aGUgc2VsZWN0aW9uLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGN1cnJlbnRfcHJldmlld19tYXRjaGVzKCB0ZW1wbGF0ZV9zbHVnLCBib29raW5nX2Zvcm1fdXNhZ2UgKSB7XG5cdFx0XHRyZXR1cm4gY3VycmVudF9wcmV2aWV3LnRlbXBsYXRlX3NsdWcgPT09IHRlbXBsYXRlX3NsdWcgJiYgY3VycmVudF9wcmV2aWV3LmJvb2tpbmdfZm9ybV91c2FnZSA9PT0gYm9va2luZ19mb3JtX3VzYWdlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlYWQgYSBub3JtYWxpemVkIFdvcmRQcmVzcyBBSkFYIGVycm9yIG1lc3NhZ2UuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdHxudWxsfSByZXNwb25zZSBQYXJzZWQgSlNPTiByZXNwb25zZS5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IFBsYWluIGVycm9yIG1lc3NhZ2UuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X2FqYXhfZXJyb3JfbWVzc2FnZSggcmVzcG9uc2UgKSB7XG5cdFx0XHRpZiAoIHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5tZXNzYWdlICkge1xuXHRcdFx0XHRyZXR1cm4gU3RyaW5nKCByZXNwb25zZS5kYXRhLm1lc3NhZ2UgKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGdldF9tZXNzYWdlKCAncHJldmlld19lcnJvcicsICdUaGUgaW50ZXJhY3RpdmUgcHJldmlldyBjb3VsZCBub3QgYmUgbG9hZGVkLiBUcnkgcmVmcmVzaGluZyBpdC4nICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQnVpbGQgdGhlIGF1dGhlbnRpY2F0ZWQgcmVxdWVzdCBib2R5IGZvciBvbmUgc2VydmVyLW93bmVkIHByZXZpZXcuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGVfc2x1ZyAgICAgIFNlbGVjdGVkIHRlbXBsYXRlIHNsdWcuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGJvb2tpbmdfZm9ybV91c2FnZSBTZWxlY3RlZCB1c2FnZSBpZGVudGlmaWVyLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBwcmV2aWV3X3RhcmdldCAgICAgRW1iZWRkZWQgb3Igd2luZG93IHRhcmdldC5cblx0XHQgKiBAcmV0dXJuIHtGb3JtRGF0YX0gUmVxdWVzdCBib2R5LlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGJ1aWxkX3ByZXZpZXdfcmVxdWVzdF9ib2R5KCB0ZW1wbGF0ZV9zbHVnLCBib29raW5nX2Zvcm1fdXNhZ2UsIHByZXZpZXdfdGFyZ2V0ICkge1xuXHRcdFx0dmFyIHJlcXVlc3RfYm9keSA9IG5ldyB3aW5kb3cuRm9ybURhdGEoKTtcblxuXHRcdFx0cmVxdWVzdF9ib2R5LmFwcGVuZCggJ2FjdGlvbicsIGNvbmZpZy5wcmV2aWV3X2FjdGlvbiApO1xuXHRcdFx0cmVxdWVzdF9ib2R5LmFwcGVuZCggJ25vbmNlJywgY29uZmlnLm5vbmNlIHx8ICcnICk7XG5cdFx0XHRyZXF1ZXN0X2JvZHkuYXBwZW5kKCAndGVtcGxhdGVfc2x1ZycsIHRlbXBsYXRlX3NsdWcgKTtcblx0XHRcdHJlcXVlc3RfYm9keS5hcHBlbmQoICdib29raW5nX2Zvcm1fdXNhZ2UnLCBib29raW5nX2Zvcm1fdXNhZ2UgKTtcblx0XHRcdHJlcXVlc3RfYm9keS5hcHBlbmQoICdwcmV2aWV3X3RhcmdldCcsIHByZXZpZXdfdGFyZ2V0ICk7XG5cblx0XHRcdHJldHVybiByZXF1ZXN0X2JvZHk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ29uZmlybSB0aGF0IGEgcmVzcG9uc2UgYmVsb25ncyB0byB0aGUgY3VycmVudCBzZXJ2ZXItdmFsaWRhdGVkIHNlbGVjdGlvbi5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZXNwb25zZSAgICAgICAgICAgIFdvcmRQcmVzcyBBSkFYIHJlc3BvbnNlLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZW1wbGF0ZV9zbHVnICAgICAgIFJlcXVlc3RlZCB0ZW1wbGF0ZSBzbHVnLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBib29raW5nX2Zvcm1fdXNhZ2UgIFJlcXVlc3RlZCB1c2FnZSBpZGVudGlmaWVyLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBwcmV2aWV3X3RhcmdldCAgICAgIFJlcXVlc3RlZCBwcmV2aWV3IHRhcmdldC5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IFZhbGlkYXRlZCByZXNwb25zZSBkYXRhLlxuXHRcdCAqIEB0aHJvd3Mge0Vycm9yfSBXaGVuIHJlc3BvbnNlIG93bmVyc2hpcCBvciBzaGFwZSBpcyBpbnZhbGlkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHZhbGlkYXRlX3ByZXZpZXdfcmVzcG9uc2UoIHJlc3BvbnNlLCB0ZW1wbGF0ZV9zbHVnLCBib29raW5nX2Zvcm1fdXNhZ2UsIHByZXZpZXdfdGFyZ2V0ICkge1xuXHRcdFx0dmFyIHJlc3BvbnNlX2RhdGE7XG5cdFx0XHR2YXIgc2VsZWN0ZWRfY2FyZCA9IGdldF9zZWxlY3RlZF9jYXJkKCk7XG5cblx0XHRcdGlmICggISByZXNwb25zZSB8fCAhIHJlc3BvbnNlLnN1Y2Nlc3MgfHwgISByZXNwb25zZS5kYXRhICkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoIGdldF9hamF4X2Vycm9yX21lc3NhZ2UoIHJlc3BvbnNlICkgKTtcblx0XHRcdH1cblxuXHRcdFx0cmVzcG9uc2VfZGF0YSA9IHJlc3BvbnNlLmRhdGE7XG5cdFx0XHRpZiAoXG5cdFx0XHRcdFN0cmluZyggcmVzcG9uc2VfZGF0YS50ZW1wbGF0ZV9zbHVnIHx8ICcnICkgIT09IHRlbXBsYXRlX3NsdWcgfHxcblx0XHRcdFx0U3RyaW5nKCByZXNwb25zZV9kYXRhLmJvb2tpbmdfZm9ybV91c2FnZSB8fCAnJyApICE9PSBib29raW5nX2Zvcm1fdXNhZ2UgfHxcblx0XHRcdFx0U3RyaW5nKCByZXNwb25zZV9kYXRhLnByZXZpZXdfdGFyZ2V0IHx8ICcnICkgIT09IHByZXZpZXdfdGFyZ2V0IHx8XG5cdFx0XHRcdCEgc2VsZWN0ZWRfY2FyZCB8fFxuXHRcdFx0XHRTdHJpbmcoIHNlbGVjdGVkX2NhcmQuZGF0YXNldC50ZW1wbGF0ZVNsdWcgfHwgJycgKSAhPT0gdGVtcGxhdGVfc2x1ZyB8fFxuXHRcdFx0XHRnZXRfc2VsZWN0ZWRfYm9va2luZ19mb3JtX3VzYWdlKCkgIT09IGJvb2tpbmdfZm9ybV91c2FnZVxuXHRcdFx0KSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvciggZ2V0X21lc3NhZ2UoICdwcmV2aWV3X2Vycm9yJywgJ1RoZSBpbnRlcmFjdGl2ZSBwcmV2aWV3IGNvdWxkIG5vdCBiZSBsb2FkZWQuIFRyeSByZWZyZXNoaW5nIGl0LicgKSApO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcmVzcG9uc2VfZGF0YTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXF1ZXN0IGFuZCByZW5kZXIgdGhlIHNlbGVjdGVkIGFsbG93LWxpc3RlZCB0ZW1wbGF0ZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8bnVsbH0gY2FyZCBTZWxlY3RlZCB0ZW1wbGF0ZSBjYXJkLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbG9hZF9wcmV2aWV3KCBjYXJkICkge1xuXHRcdFx0dmFyIHRlbXBsYXRlX3NsdWcgPSBjYXJkID8gU3RyaW5nKCBjYXJkLmRhdGFzZXQudGVtcGxhdGVTbHVnIHx8ICcnICkgOiAnJztcblx0XHRcdHZhciBib29raW5nX2Zvcm1fdXNhZ2UgPSBnZXRfc2VsZWN0ZWRfYm9va2luZ19mb3JtX3VzYWdlKCk7XG5cdFx0XHR2YXIgcmVxdWVzdF9zZXF1ZW5jZTtcblx0XHRcdHZhciByZXF1ZXN0X2JvZHk7XG5cblx0XHRcdGlmICggISB0ZW1wbGF0ZV9zbHVnIHx8ICEgYm9va2luZ19mb3JtX3VzYWdlIHx8ICEgY29uZmlnLmFqYXhfdXJsIHx8ICEgY29uZmlnLnByZXZpZXdfYWN0aW9uICkge1xuXHRcdFx0XHRzZXRfcHJldmlld19zdGF0ZSggZmFsc2UsIGdldF9tZXNzYWdlKCAncHJldmlld19lcnJvcicsICdUaGUgaW50ZXJhY3RpdmUgcHJldmlldyBjb3VsZCBub3QgYmUgbG9hZGVkLiBUcnkgcmVmcmVzaGluZyBpdC4nICkgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIHByZXZpZXdfYWJvcnRfY29udHJvbGxlciAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgcHJldmlld19hYm9ydF9jb250cm9sbGVyLmFib3J0ICkge1xuXHRcdFx0XHRwcmV2aWV3X2Fib3J0X2NvbnRyb2xsZXIuYWJvcnQoKTtcblx0XHRcdH1cblx0XHRcdHByZXZpZXdfYWJvcnRfY29udHJvbGxlciA9ICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cuQWJvcnRDb250cm9sbGVyID8gbmV3IHdpbmRvdy5BYm9ydENvbnRyb2xsZXIoKSA6IG51bGw7XG5cdFx0XHRyZXF1ZXN0X3NlcXVlbmNlID0gKytwcmV2aWV3X3JlcXVlc3Rfc2VxdWVuY2U7XG5cdFx0XHRyZXF1ZXN0X2JvZHkgPSBidWlsZF9wcmV2aWV3X3JlcXVlc3RfYm9keSggdGVtcGxhdGVfc2x1ZywgYm9va2luZ19mb3JtX3VzYWdlLCAnZW1iZWRkZWQnICk7XG5cblx0XHRcdHNldF9wcmV2aWV3X3N0YXRlKCB0cnVlLCAnJyApO1xuXG5cdFx0XHR3aW5kb3cuZmV0Y2goIGNvbmZpZy5hamF4X3VybCwge1xuXHRcdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdFx0Ym9keTogcmVxdWVzdF9ib2R5LFxuXHRcdFx0XHRjcmVkZW50aWFsczogJ3NhbWUtb3JpZ2luJyxcblx0XHRcdFx0c2lnbmFsOiBwcmV2aWV3X2Fib3J0X2NvbnRyb2xsZXIgPyBwcmV2aWV3X2Fib3J0X2NvbnRyb2xsZXIuc2lnbmFsIDogdW5kZWZpbmVkXG5cdFx0XHR9ICkudGhlbiggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdFx0cmV0dXJuIHJlc3BvbnNlLmpzb24oKTtcblx0XHRcdH0gKS50aGVuKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0XHR2YXIgcmVzcG9uc2VfZGF0YTtcblx0XHRcdFx0dmFyIHByZXZpZXdfa2luZDtcblx0XHRcdFx0dmFyIHByZXZpZXdfdXJsO1xuXG5cdFx0XHRcdGlmICggcmVxdWVzdF9zZXF1ZW5jZSAhPT0gcHJldmlld19yZXF1ZXN0X3NlcXVlbmNlICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJlc3BvbnNlX2RhdGEgPSB2YWxpZGF0ZV9wcmV2aWV3X3Jlc3BvbnNlKCByZXNwb25zZSwgdGVtcGxhdGVfc2x1ZywgYm9va2luZ19mb3JtX3VzYWdlLCAnZW1iZWRkZWQnICk7XG5cdFx0XHRcdHByZXZpZXdfa2luZCA9IFN0cmluZyggcmVzcG9uc2VfZGF0YS5wcmV2aWV3X2tpbmQgfHwgJycgKTtcblxuXHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0J2lubGluZScgPT09IHByZXZpZXdfa2luZCAmJlxuXHRcdFx0XHRcdHJlc3BvbnNlX2RhdGEuaHRtbCAmJlxuXHRcdFx0XHRcdHJlc3BvbnNlX2RhdGEuYm9vdHN0cmFwICYmXG5cdFx0XHRcdFx0J29iamVjdCcgPT09IHR5cGVvZiByZXNwb25zZV9kYXRhLmJvb3RzdHJhcCAmJlxuXHRcdFx0XHRcdGlubGluZV9wcmV2aWV3X3JlbmRlcmVyXG5cdFx0XHRcdCkge1xuXHRcdFx0XHRcdHJldHVybiBpbmxpbmVfcHJldmlld19yZW5kZXJlci5yZXBsYWNlKCBTdHJpbmcoIHJlc3BvbnNlX2RhdGEuaHRtbCApLCByZXNwb25zZV9kYXRhLmJvb3RzdHJhcCwgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHJlcXVlc3Rfc2VxdWVuY2UgPT09IHByZXZpZXdfcmVxdWVzdF9zZXF1ZW5jZTtcblx0XHRcdFx0XHR9ICkudGhlbiggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0aWYgKCByZXF1ZXN0X3NlcXVlbmNlICE9PSBwcmV2aWV3X3JlcXVlc3Rfc2VxdWVuY2UgKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNsZWFyX3ByZXZpZXdfZnJhbWUoKTtcblx0XHRcdFx0XHRcdGVkaXRvci5pbmxpbmVfcHJldmlldy5oaWRkZW4gPSBmYWxzZTtcblx0XHRcdFx0XHRcdHNldF9jdXJyZW50X3ByZXZpZXcoICdpbmxpbmUnLCAnJywgdGVtcGxhdGVfc2x1ZywgYm9va2luZ19mb3JtX3VzYWdlICk7XG5cdFx0XHRcdFx0XHRzZXRfcHJldmlld19zdGF0ZSggZmFsc2UsICcnICk7XG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKCAndXJsJyAhPT0gcHJldmlld19raW5kIHx8ICEgcmVzcG9uc2VfZGF0YS5wcmV2aWV3X3VybCApIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoIGdldF9tZXNzYWdlKCAncHJldmlld19lcnJvcicsICdUaGUgaW50ZXJhY3RpdmUgcHJldmlldyBjb3VsZCBub3QgYmUgbG9hZGVkLiBUcnkgcmVmcmVzaGluZyBpdC4nICkgKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHByZXZpZXdfdXJsID0gU3RyaW5nKCByZXNwb25zZV9kYXRhLnByZXZpZXdfdXJsICk7XG5cdFx0XHRcdGVkaXRvci5wcmV2aWV3X2ZyYW1lLm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRpZiAoIHJlcXVlc3Rfc2VxdWVuY2UgIT09IHByZXZpZXdfcmVxdWVzdF9zZXF1ZW5jZSApIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWRpdG9yLmlubGluZV9wcmV2aWV3LmhpZGRlbiA9IHRydWU7XG5cdFx0XHRcdFx0ZWRpdG9yLnByZXZpZXdfZnJhbWUuaGlkZGVuID0gZmFsc2U7XG5cdFx0XHRcdFx0c2V0X2N1cnJlbnRfcHJldmlldyggJ3VybCcsIHByZXZpZXdfdXJsLCB0ZW1wbGF0ZV9zbHVnLCBib29raW5nX2Zvcm1fdXNhZ2UgKTtcblx0XHRcdFx0XHRzZXRfcHJldmlld19zdGF0ZSggZmFsc2UsICcnICk7XG5cdFx0XHRcdH07XG5cdFx0XHRcdGVkaXRvci5wcmV2aWV3X2ZyYW1lLnNldEF0dHJpYnV0ZSggJ2RhdGEtcHJldmlldy10ZW1wbGF0ZS1zbHVnJywgdGVtcGxhdGVfc2x1ZyApO1xuXHRcdFx0XHRlZGl0b3IucHJldmlld19mcmFtZS5zZXRBdHRyaWJ1dGUoICdkYXRhLXByZXZpZXctYm9va2luZy1mb3JtLXVzYWdlJywgYm9va2luZ19mb3JtX3VzYWdlICk7XG5cdFx0XHRcdGVkaXRvci5wcmV2aWV3X2ZyYW1lLnNyYyA9IHByZXZpZXdfdXJsO1xuXHRcdFx0fSApLmNhdGNoKCBmdW5jdGlvbiAoIGVycm9yICkge1xuXHRcdFx0XHRpZiAoIGVycm9yICYmICdBYm9ydEVycm9yJyA9PT0gZXJyb3IubmFtZSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCByZXF1ZXN0X3NlcXVlbmNlICE9PSBwcmV2aWV3X3JlcXVlc3Rfc2VxdWVuY2UgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNldF9wcmV2aWV3X3N0YXRlKCBmYWxzZSwgZXJyb3IgJiYgZXJyb3IubWVzc2FnZSA/IGVycm9yLm1lc3NhZ2UgOiBnZXRfbWVzc2FnZSggJ3ByZXZpZXdfZXJyb3InLCAnVGhlIGludGVyYWN0aXZlIHByZXZpZXcgY291bGQgbm90IGJlIGxvYWRlZC4gVHJ5IHJlZnJlc2hpbmcgaXQuJyApICk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogT3BlbiB0aGUgZnVsbC1zaXRlIHByZXZpZXcsIGxhemlseSBjcmVhdGluZyBhIHNpZ25lZCBzZXNzaW9uIHdoZW4gbmVlZGVkLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxudWxsfSBjYXJkIFNlbGVjdGVkIHRlbXBsYXRlIGNhcmQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBvcGVuX3ByZXZpZXcoIGNhcmQgKSB7XG5cdFx0XHR2YXIgdGVtcGxhdGVfc2x1ZyA9IGNhcmQgPyBTdHJpbmcoIGNhcmQuZGF0YXNldC50ZW1wbGF0ZVNsdWcgfHwgJycgKSA6ICcnO1xuXHRcdFx0dmFyIGJvb2tpbmdfZm9ybV91c2FnZSA9IGdldF9zZWxlY3RlZF9ib29raW5nX2Zvcm1fdXNhZ2UoKTtcblx0XHRcdHZhciBwcmV2aWV3X3dpbmRvdztcblx0XHRcdHZhciByZXF1ZXN0X3NlcXVlbmNlO1xuXG5cdFx0XHRpZiAoICEgdGVtcGxhdGVfc2x1ZyB8fCAhIGJvb2tpbmdfZm9ybV91c2FnZSB8fCBlZGl0b3Iub3Blbl9idXR0b24uZGlzYWJsZWQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCBjdXJyZW50X3ByZXZpZXdfbWF0Y2hlcyggdGVtcGxhdGVfc2x1ZywgYm9va2luZ19mb3JtX3VzYWdlICkgJiYgY3VycmVudF9wcmV2aWV3LnVybCApIHtcblx0XHRcdFx0d2luZG93Lm9wZW4oIGN1cnJlbnRfcHJldmlldy51cmwsICdfYmxhbmsnLCAnbm9vcGVuZXIsbm9yZWZlcnJlcicgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRwcmV2aWV3X3dpbmRvdyA9IHdpbmRvdy5vcGVuKCAnJywgJ19ibGFuaycgKTtcblx0XHRcdGlmICggISBwcmV2aWV3X3dpbmRvdyApIHtcblx0XHRcdFx0c2V0X3ByZXZpZXdfc3RhdGUoIGZhbHNlLCBnZXRfbWVzc2FnZSggJ3ByZXZpZXdfb3Blbl9lcnJvcicsICdUaGUgZnVsbC1zaXRlIHByZXZpZXcgY291bGQgbm90IGJlIG9wZW5lZC4gVHJ5IGFnYWluLicgKSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRwcmV2aWV3X3dpbmRvdy5vcGVuZXIgPSBudWxsO1xuXG5cdFx0XHRpZiAoIG9wZW5fYWJvcnRfY29udHJvbGxlciAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygb3Blbl9hYm9ydF9jb250cm9sbGVyLmFib3J0ICkge1xuXHRcdFx0XHRvcGVuX2Fib3J0X2NvbnRyb2xsZXIuYWJvcnQoKTtcblx0XHRcdH1cblx0XHRcdG9wZW5fYWJvcnRfY29udHJvbGxlciA9ICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cuQWJvcnRDb250cm9sbGVyID8gbmV3IHdpbmRvdy5BYm9ydENvbnRyb2xsZXIoKSA6IG51bGw7XG5cdFx0XHRyZXF1ZXN0X3NlcXVlbmNlID0gKytvcGVuX3JlcXVlc3Rfc2VxdWVuY2U7XG5cdFx0XHRvcGVuX3JlcXVlc3RfaXNfbG9hZGluZyA9IHRydWU7XG5cdFx0XHRlZGl0b3Iub3Blbl9idXR0b24uZGlzYWJsZWQgPSB0cnVlO1xuXG5cdFx0XHR3aW5kb3cuZmV0Y2goIGNvbmZpZy5hamF4X3VybCwge1xuXHRcdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdFx0Ym9keTogYnVpbGRfcHJldmlld19yZXF1ZXN0X2JvZHkoIHRlbXBsYXRlX3NsdWcsIGJvb2tpbmdfZm9ybV91c2FnZSwgJ3dpbmRvdycgKSxcblx0XHRcdFx0Y3JlZGVudGlhbHM6ICdzYW1lLW9yaWdpbicsXG5cdFx0XHRcdHNpZ25hbDogb3Blbl9hYm9ydF9jb250cm9sbGVyID8gb3Blbl9hYm9ydF9jb250cm9sbGVyLnNpZ25hbCA6IHVuZGVmaW5lZFxuXHRcdFx0fSApLnRoZW4oIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRcdHJldHVybiByZXNwb25zZS5qc29uKCk7XG5cdFx0XHR9ICkudGhlbiggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdFx0dmFyIHJlc3BvbnNlX2RhdGE7XG5cblx0XHRcdFx0aWYgKCByZXF1ZXN0X3NlcXVlbmNlICE9PSBvcGVuX3JlcXVlc3Rfc2VxdWVuY2UgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlc3BvbnNlX2RhdGEgPSB2YWxpZGF0ZV9wcmV2aWV3X3Jlc3BvbnNlKCByZXNwb25zZSwgdGVtcGxhdGVfc2x1ZywgYm9va2luZ19mb3JtX3VzYWdlLCAnd2luZG93JyApO1xuXHRcdFx0XHRpZiAoICd1cmwnICE9PSBTdHJpbmcoIHJlc3BvbnNlX2RhdGEucHJldmlld19raW5kIHx8ICcnICkgfHwgISByZXNwb25zZV9kYXRhLnByZXZpZXdfdXJsICkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvciggZ2V0X21lc3NhZ2UoICdwcmV2aWV3X29wZW5fZXJyb3InLCAnVGhlIGZ1bGwtc2l0ZSBwcmV2aWV3IGNvdWxkIG5vdCBiZSBvcGVuZWQuIFRyeSBhZ2Fpbi4nICkgKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHByZXZpZXdfd2luZG93LmxvY2F0aW9uLnJlcGxhY2UoIFN0cmluZyggcmVzcG9uc2VfZGF0YS5wcmV2aWV3X3VybCApICk7XG5cdFx0XHR9ICkuY2F0Y2goIGZ1bmN0aW9uICggZXJyb3IgKSB7XG5cdFx0XHRcdGlmICggZXJyb3IgJiYgJ0Fib3J0RXJyb3InID09PSBlcnJvci5uYW1lICkge1xuXHRcdFx0XHRcdHByZXZpZXdfd2luZG93LmNsb3NlKCk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggcmVxdWVzdF9zZXF1ZW5jZSAhPT0gb3Blbl9yZXF1ZXN0X3NlcXVlbmNlICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRwcmV2aWV3X3dpbmRvdy5jbG9zZSgpO1xuXHRcdFx0XHRzZXRfcHJldmlld19zdGF0ZSggZmFsc2UsIGVycm9yICYmIGVycm9yLm1lc3NhZ2UgPyBlcnJvci5tZXNzYWdlIDogZ2V0X21lc3NhZ2UoICdwcmV2aWV3X29wZW5fZXJyb3InLCAnVGhlIGZ1bGwtc2l0ZSBwcmV2aWV3IGNvdWxkIG5vdCBiZSBvcGVuZWQuIFRyeSBhZ2Fpbi4nICkgKTtcblx0XHRcdH0gKS50aGVuKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGlmICggcmVxdWVzdF9zZXF1ZW5jZSA9PT0gb3Blbl9yZXF1ZXN0X3NlcXVlbmNlICkge1xuXHRcdFx0XHRcdG9wZW5fcmVxdWVzdF9pc19sb2FkaW5nID0gZmFsc2U7XG5cdFx0XHRcdFx0ZWRpdG9yLm9wZW5fYnV0dG9uLmRpc2FibGVkID0gISBnZXRfc2VsZWN0ZWRfY2FyZCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU2VsZWN0IG9uZSBjYXJkIGFuZCBsb2FkIGl0cyByZWFsIHByZXZpZXcuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBjYXJkICAgICAgICAgVGVtcGxhdGUgY2FyZC5cblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59ICAgICBsb2FkX3NlbGVjdGVkIFdoZXRoZXIgdG8gcmVxdWVzdCBhIHJlcGxhY2VtZW50IHByZXZpZXcuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZWxlY3RfY2FyZCggY2FyZCwgbG9hZF9zZWxlY3RlZCApIHtcblx0XHRcdHZhciByYWRpbyA9IGNhcmQgJiYgY2FyZC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10ZW1wbGF0ZS1yYWRpb10nICk7XG5cblx0XHRcdGlmICggISByYWRpbyApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRyYWRpby5jaGVja2VkID0gdHJ1ZTtcblx0XHRcdGVkaXRvci5jYXJkcy5mb3JFYWNoKCBmdW5jdGlvbiAoIHRlbXBsYXRlX2NhcmQgKSB7XG5cdFx0XHRcdHRlbXBsYXRlX2NhcmQuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLXNlbGVjdGVkJywgdGVtcGxhdGVfY2FyZCA9PT0gY2FyZCApO1xuXHRcdFx0fSApO1xuXHRcdFx0c2hlbGxfYXBpLmNsZWFyX2ZpZWxkX2Vycm9yKCAnYm9va2luZ19mb3JtX3RlbXBsYXRlJyApO1xuXHRcdFx0cmVuZGVyX3ByZXZpZXdfbWV0YWRhdGEoIGNhcmQgKTtcblx0XHRcdGlmICggZmFsc2UgIT09IGxvYWRfc2VsZWN0ZWQgKSB7XG5cdFx0XHRcdGxvYWRfcHJldmlldyggY2FyZCApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBjYXJkcyBtYXRjaGluZyB0aGUgY3VycmVudCBzZWFyY2ggYW5kIGNhdGVnb3J5LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7SFRNTEVsZW1lbnRbXX0gTWF0Y2hpbmcgY2FyZHMgaW4gc2VydmVyIG9yZGVyLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9tYXRjaGluZ19jYXJkcygpIHtcblx0XHRcdHZhciBxdWVyeSA9IG5vcm1hbGl6ZV9zZWFyY2hfdGV4dCggZWRpdG9yLnNlYXJjaCA/IGVkaXRvci5zZWFyY2gudmFsdWUudHJpbSgpIDogJycgKTtcblxuXHRcdFx0cmV0dXJuIGVkaXRvci5jYXJkcy5maWx0ZXIoIGZ1bmN0aW9uICggY2FyZCApIHtcblx0XHRcdFx0dmFyIG1hdGNoZXNfZmlsdGVyID0gJ2FsbCcgPT09IGVkaXRvci5hY3RpdmVfZmlsdGVyIHx8XG5cdFx0XHRcdFx0KCAncmVjb21tZW5kZWQnID09PSBlZGl0b3IuYWN0aXZlX2ZpbHRlciAmJiAndHJ1ZScgPT09IGNhcmQuZGF0YXNldC50ZW1wbGF0ZVJlY29tbWVuZGVkICkgfHxcblx0XHRcdFx0XHRlZGl0b3IuYWN0aXZlX2ZpbHRlciA9PT0gY2FyZC5kYXRhc2V0LnRlbXBsYXRlQ2F0ZWdvcnk7XG5cdFx0XHRcdHZhciBtYXRjaGVzX3NlYXJjaCA9ICEgcXVlcnkgfHwgLTEgIT09IGdldF9jYXJkX3NlYXJjaF90ZXh0KCBjYXJkICkuaW5kZXhPZiggcXVlcnkgKTtcblxuXHRcdFx0XHRyZXR1cm4gbWF0Y2hlc19maWx0ZXIgJiYgbWF0Y2hlc19zZWFyY2g7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVuZGVyIGV2ZXJ5IGNhcmQgbWF0Y2hpbmcgdGhlIGN1cnJlbnQgc2VhcmNoIGFuZCBjYXRlZ29yeS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX2NhdGFsb2coKSB7XG5cdFx0XHR2YXIgbWF0Y2hpbmdfY2FyZHMgPSBnZXRfbWF0Y2hpbmdfY2FyZHMoKTtcblxuXHRcdFx0ZWRpdG9yLmNhcmRzLmZvckVhY2goIGZ1bmN0aW9uICggY2FyZCApIHtcblx0XHRcdFx0Y2FyZC5oaWRkZW4gPSB0cnVlO1xuXHRcdFx0fSApO1xuXHRcdFx0bWF0Y2hpbmdfY2FyZHMuZm9yRWFjaCggZnVuY3Rpb24gKCBjYXJkICkge1xuXHRcdFx0XHRjYXJkLmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRlZGl0b3IuZW1wdHkuaGlkZGVuID0gMCAhPT0gbWF0Y2hpbmdfY2FyZHMubGVuZ3RoO1xuXHRcdFx0ZWRpdG9yLmVtcHR5LnRleHRDb250ZW50ID0gZ2V0X21lc3NhZ2UoICdub19tYXRjaGluZ190ZW1wbGF0ZXMnLCAnTm8gdGVtcGxhdGVzIG1hdGNoIHRoaXMgc2VhcmNoIGFuZCBmaWx0ZXIuJyApO1xuXHRcdFx0ZWRpdG9yLmdyaWQuc2Nyb2xsTGVmdCA9IDA7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQWN0aXZhdGUgb25lIGNhdGVnb3J5IHRhYiBhbmQgcmVmcmVzaCB0aGUgdmlzaWJsZSBjYXJkcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHRhYiBGaWx0ZXIgdGFiIGJ1dHRvbi5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGFjdGl2YXRlX2ZpbHRlciggdGFiICkge1xuXHRcdFx0aWYgKCAhIHRhYiApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRlZGl0b3IuYWN0aXZlX2ZpbHRlciA9IHRhYi5kYXRhc2V0LndwYmNUZW1wbGF0ZUZpbHRlciB8fCAnYWxsJztcblx0XHRcdGVkaXRvci50YWJzLmZvckVhY2goIGZ1bmN0aW9uICggZmlsdGVyX3RhYiApIHtcblx0XHRcdFx0dmFyIGlzX2FjdGl2ZSA9IGZpbHRlcl90YWIgPT09IHRhYjtcblx0XHRcdFx0ZmlsdGVyX3RhYi5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtYWN0aXZlJywgaXNfYWN0aXZlICk7XG5cdFx0XHRcdGZpbHRlcl90YWIuc2V0QXR0cmlidXRlKCAnYXJpYS1zZWxlY3RlZCcsIGlzX2FjdGl2ZSA/ICd0cnVlJyA6ICdmYWxzZScgKTtcblx0XHRcdFx0ZmlsdGVyX3RhYi50YWJJbmRleCA9IGlzX2FjdGl2ZSA/IDAgOiAtMTtcblx0XHRcdH0gKTtcblx0XHRcdGVkaXRvci5ncmlkLnNldEF0dHJpYnV0ZSggJ2FyaWEtbGFiZWxsZWRieScsIHRhYi5pZCApO1xuXHRcdFx0cmVuZGVyX2NhdGFsb2coKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gdGhlIGZpbHRlciB0YWIgd2l0aCB0aGUgcmVxdWVzdGVkIHN0YWJsZSBJRC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBmaWx0ZXJfaWQgU3RhYmxlIGZpbHRlciBJRC5cblx0XHQgKiBAcmV0dXJuIHtIVE1MRWxlbWVudHxudWxsfSBNYXRjaGluZyB0YWIsIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X2ZpbHRlcl90YWIoIGZpbHRlcl9pZCApIHtcblx0XHRcdHJldHVybiBlZGl0b3IudGFicy5maW5kKCBmdW5jdGlvbiAoIHRhYiApIHtcblx0XHRcdFx0cmV0dXJuIGZpbHRlcl9pZCA9PT0gdGFiLmRhdGFzZXQud3BiY1RlbXBsYXRlRmlsdGVyO1xuXHRcdFx0fSApIHx8IG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQXBwbHkgdGV4dC1zZWFyY2ggY2hhbmdlcyBpbW1lZGlhdGVseS5cblx0XHQgKlxuXHRcdCAqIFRleHQgc2VhcmNoIGludGVudGlvbmFsbHkgc3dpdGNoZXMgdG8gQWxsIHRlbXBsYXRlcy4gT3RoZXJ3aXNlIGEgdmFsaWRcblx0XHQgKiBtYXRjaCBzdWNoIGFzIGEgRnVsbCBEYXlzIG9yIGNvbnRhY3QgdGVtcGxhdGUgY2FuIHJlbWFpbiBoaWRkZW4gbWVyZWx5XG5cdFx0ICogYmVjYXVzZSB0aGUgUmVjb21tZW5kZWQgdGFiIHdhcyBhY3RpdmUgYmVmb3JlIHRoZSB1c2VyIHN0YXJ0ZWQgdHlwaW5nLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfc2VhcmNoX2NoYW5nZSgpIHtcblx0XHRcdHZhciBxdWVyeSA9IG5vcm1hbGl6ZV9zZWFyY2hfdGV4dCggZWRpdG9yLnNlYXJjaCA/IGVkaXRvci5zZWFyY2gudmFsdWUudHJpbSgpIDogJycgKTtcblx0XHRcdHZhciBhbGxfdGVtcGxhdGVzX3RhYiA9IGdldF9maWx0ZXJfdGFiKCAnYWxsJyApO1xuXG5cdFx0XHRpZiAoIHF1ZXJ5ICYmIGFsbF90ZW1wbGF0ZXNfdGFiICYmICdhbGwnICE9PSBlZGl0b3IuYWN0aXZlX2ZpbHRlciApIHtcblx0XHRcdFx0YWN0aXZhdGVfZmlsdGVyKCBhbGxfdGVtcGxhdGVzX3RhYiApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHJlbmRlcl9jYXRhbG9nKCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSGFuZGxlIHNlbGVjdG9yIGFuZCBwcmV2aWV3IGFjdGlvbnMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge01vdXNlRXZlbnR9IGV2ZW50IENsaWNrIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX2NsaWNrKCBldmVudCApIHtcblx0XHRcdHZhciBmaWx0ZXIgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGVtcGxhdGUtZmlsdGVyXScgKTtcblx0XHRcdHZhciByZWZyZXNoX2J1dHRvbiA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10ZW1wbGF0ZS1yZWZyZXNoXScgKTtcblx0XHRcdHZhciBvcGVuX2xpbmsgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGVtcGxhdGUtb3Blbi1wcmV2aWV3XScgKTtcblx0XHRcdHZhciB0ZW1wbGF0ZV9jYXJkID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXRlbXBsYXRlLWNhcmRdJyApO1xuXHRcdFx0dmFyIHRlbXBsYXRlX3JhZGlvO1xuXG5cdFx0XHRpZiAoIGZpbHRlciApIHtcblx0XHRcdFx0YWN0aXZhdGVfZmlsdGVyKCBmaWx0ZXIgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCByZWZyZXNoX2J1dHRvbiApIHtcblx0XHRcdFx0bG9hZF9wcmV2aWV3KCBnZXRfc2VsZWN0ZWRfY2FyZCgpICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggb3Blbl9saW5rICkge1xuXHRcdFx0XHRvcGVuX3ByZXZpZXcoIGdldF9zZWxlY3RlZF9jYXJkKCkgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0ZW1wbGF0ZV9jYXJkICkge1xuXHRcdFx0XHR0ZW1wbGF0ZV9yYWRpbyA9IHRlbXBsYXRlX2NhcmQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGVtcGxhdGUtcmFkaW9dJyApO1xuXHRcdFx0XHRpZiAoIHRlbXBsYXRlX3JhZGlvICYmICEgdGVtcGxhdGVfcmFkaW8uY2hlY2tlZCApIHtcblx0XHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdHNlbGVjdF9jYXJkKCB0ZW1wbGF0ZV9jYXJkLCB0cnVlICk7XG5cdFx0XHRcdFx0dGVtcGxhdGVfcmFkaW8uZm9jdXMoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3luY2hyb25pemUgb25lIGVudHJ5LXBvaW50IGNob2ljZSB3aXRoIGl0cyBuYXRpdmUgcmFkaW8gYW5kIGNhcmQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gYm9va2luZ19mb3JtX3VzYWdlIFN0YWJsZSBlbnRyeS1wb2ludCBpZGVudGlmaWVyLlxuXHRcdCAqIEByZXR1cm4ge0hUTUxJbnB1dEVsZW1lbnR8bnVsbH0gTWF0Y2hpbmcgcmFkaW8gY29udHJvbCwgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZWxlY3RfYm9va2luZ19mb3JtX3VzYWdlKCBib29raW5nX2Zvcm1fdXNhZ2UgKSB7XG5cdFx0XHR2YXIgc2VsZWN0ZWRfcmFkaW8gPSBudWxsO1xuXG5cdFx0XHRBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCggZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtYm9va2luZy1mb3JtLXVzYWdlLXJhZGlvXScgKSApLmZvckVhY2goIGZ1bmN0aW9uICggdXNhZ2VfcmFkaW8gKSB7XG5cdFx0XHRcdHZhciBpc19zZWxlY3RlZCA9IGJvb2tpbmdfZm9ybV91c2FnZSA9PT0gU3RyaW5nKCB1c2FnZV9yYWRpby52YWx1ZSB8fCAnJyApO1xuXG5cdFx0XHRcdHVzYWdlX3JhZGlvLmNoZWNrZWQgPSBpc19zZWxlY3RlZDtcblx0XHRcdFx0dXNhZ2VfcmFkaW8uY2xvc2VzdCggJy53cGJjX3NldHVwX3dpemFyZF9fYm9va2luZy1mb3JtLXVzYWdlLW9wdGlvbicgKS5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtc2VsZWN0ZWQnLCBpc19zZWxlY3RlZCApO1xuXHRcdFx0XHRpZiAoIGlzX3NlbGVjdGVkICkge1xuXHRcdFx0XHRcdHNlbGVjdGVkX3JhZGlvID0gdXNhZ2VfcmFkaW87XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblxuXHRcdFx0cmV0dXJuIHNlbGVjdGVkX3JhZGlvO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENvbW1pdCBhbiBleHBsYWluZWQgZW50cnktcG9pbnQgY2hvaWNlIGFuZCByZWZyZXNoIGl0cyBwcmV2aWV3LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGJvb2tpbmdfZm9ybV91c2FnZSBTdGFibGUgZW50cnktcG9pbnQgaWRlbnRpZmllci5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNvbW1pdF9ib29raW5nX2Zvcm1fdXNhZ2UoIGJvb2tpbmdfZm9ybV91c2FnZSApIHtcblx0XHRcdGlmICggISBzZWxlY3RfYm9va2luZ19mb3JtX3VzYWdlKCBib29raW5nX2Zvcm1fdXNhZ2UgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25maXJtZWRfYm9va2luZ19mb3JtX3VzYWdlID0gYm9va2luZ19mb3JtX3VzYWdlO1xuXHRcdFx0c2hlbGxfYXBpLmNsZWFyX2ZpZWxkX2Vycm9yKCAnYm9va2luZ19mb3JtX3VzYWdlJyApO1xuXHRcdFx0cmVuZGVyX3ByZXZpZXdfbWV0YWRhdGEoIGdldF9zZWxlY3RlZF9jYXJkKCkgKTtcblx0XHRcdGxvYWRfcHJldmlldyggZ2V0X3NlbGVjdGVkX2NhcmQoKSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENvbW1pdCBvciByb2xsIGJhY2sgdGhlIHByb3Zpc2lvbmFsIEFwcG9pbnRtZW50IGZsb3cgcmFkaW8gc2VsZWN0aW9uLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtDdXN0b21FdmVudH0gZXZlbnQgU2hhcmVkIGRpYWxvZyBsaWZlY3ljbGUgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfZGlhbG9nX2Nsb3NlZCggZXZlbnQgKSB7XG5cdFx0XHR2YXIgZGlhbG9nX3N0YXRlID0gZXZlbnQuZGV0YWlsIHx8IHt9O1xuXG5cdFx0XHRpZiAoIGFwcG9pbnRtZW50X2Zsb3dfZGlhbG9nX2FjdGlvbiAhPT0gZGlhbG9nX3N0YXRlLmFjdGlvbiApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoICdjb25maXJtJyA9PT0gZGlhbG9nX3N0YXRlLm91dGNvbWUgKSB7XG5cdFx0XHRcdGNvbW1pdF9ib29raW5nX2Zvcm1fdXNhZ2UoICdhcHBvaW50bWVudF9mbG93JyApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHNlbGVjdF9ib29raW5nX2Zvcm1fdXNhZ2UoIGNvbmZpcm1lZF9ib29raW5nX2Zvcm1fdXNhZ2UgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBIYW5kbGUgbmF0aXZlIHRlbXBsYXRlIHJhZGlvIGNoYW5nZXMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudCBDaGFuZ2UgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfY2hhbmdlKCBldmVudCApIHtcblx0XHRcdGlmICggZXZlbnQudGFyZ2V0Lm1hdGNoZXMoICdbZGF0YS13cGJjLXRlbXBsYXRlLXJhZGlvXScgKSApIHtcblx0XHRcdFx0c2VsZWN0X2NhcmQoIGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10ZW1wbGF0ZS1jYXJkXScgKSwgdHJ1ZSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICggZXZlbnQudGFyZ2V0Lm1hdGNoZXMoICdbZGF0YS13cGJjLWJvb2tpbmctZm9ybS11c2FnZS1yYWRpb10nICkgKSB7XG5cdFx0XHRcdHNlbGVjdF9ib29raW5nX2Zvcm1fdXNhZ2UoIFN0cmluZyggZXZlbnQudGFyZ2V0LnZhbHVlIHx8ICcnICkgKTtcblx0XHRcdFx0c2hlbGxfYXBpLmNsZWFyX2ZpZWxkX2Vycm9yKCAnYm9va2luZ19mb3JtX3VzYWdlJyApO1xuXG5cdFx0XHRcdGlmIChcblx0XHRcdFx0XHQnYXBwb2ludG1lbnRfZmxvdycgPT09IGV2ZW50LnRhcmdldC52YWx1ZSAmJlxuXHRcdFx0XHRcdCdhcHBvaW50bWVudF9mbG93JyAhPT0gY29uZmlybWVkX2Jvb2tpbmdfZm9ybV91c2FnZSAmJlxuXHRcdFx0XHRcdCdmdW5jdGlvbicgPT09IHR5cGVvZiBzaGVsbF9hcGkub3Blbl9kaWFsb2dcblx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0aWYgKCBzaGVsbF9hcGkub3Blbl9kaWFsb2coIGFwcG9pbnRtZW50X2Zsb3dfZGlhbG9nX2FjdGlvbiwgZXZlbnQudGFyZ2V0ICkgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29tbWl0X2Jvb2tpbmdfZm9ybV91c2FnZSggU3RyaW5nKCBldmVudC50YXJnZXQudmFsdWUgfHwgJycgKSApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFByb3ZpZGUgYXJyb3cta2V5IG5hdmlnYXRpb24gYWNyb3NzIGhvcml6b250YWxseSBzY3JvbGxhYmxlIGZpbHRlciB0YWJzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtLZXlib2FyZEV2ZW50fSBldmVudCBLZXlib2FyZCBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9rZXlkb3duKCBldmVudCApIHtcblx0XHRcdHZhciB0YWIgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGVtcGxhdGUtZmlsdGVyXScgKTtcblx0XHRcdHZhciBjdXJyZW50X2luZGV4O1xuXHRcdFx0dmFyIHRhcmdldF9pbmRleDtcblxuXHRcdFx0aWYgKCAhIHRhYiB8fCAtMSA9PT0gWyAnQXJyb3dMZWZ0JywgJ0Fycm93UmlnaHQnLCAnSG9tZScsICdFbmQnIF0uaW5kZXhPZiggZXZlbnQua2V5ICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGN1cnJlbnRfaW5kZXggPSBlZGl0b3IudGFicy5pbmRleE9mKCB0YWIgKTtcblx0XHRcdHRhcmdldF9pbmRleCA9IGN1cnJlbnRfaW5kZXg7XG5cdFx0XHRpZiAoICdBcnJvd0xlZnQnID09PSBldmVudC5rZXkgKSB7XG5cdFx0XHRcdHRhcmdldF9pbmRleCA9ICggY3VycmVudF9pbmRleCAtIDEgKyBlZGl0b3IudGFicy5sZW5ndGggKSAlIGVkaXRvci50YWJzLmxlbmd0aDtcblx0XHRcdH0gZWxzZSBpZiAoICdBcnJvd1JpZ2h0JyA9PT0gZXZlbnQua2V5ICkge1xuXHRcdFx0XHR0YXJnZXRfaW5kZXggPSAoIGN1cnJlbnRfaW5kZXggKyAxICkgJSBlZGl0b3IudGFicy5sZW5ndGg7XG5cdFx0XHR9IGVsc2UgaWYgKCAnSG9tZScgPT09IGV2ZW50LmtleSApIHtcblx0XHRcdFx0dGFyZ2V0X2luZGV4ID0gMDtcblx0XHRcdH0gZWxzZSBpZiAoICdFbmQnID09PSBldmVudC5rZXkgKSB7XG5cdFx0XHRcdHRhcmdldF9pbmRleCA9IGVkaXRvci50YWJzLmxlbmd0aCAtIDE7XG5cdFx0XHR9XG5cblx0XHRcdGFjdGl2YXRlX2ZpbHRlciggZWRpdG9yLnRhYnNbIHRhcmdldF9pbmRleCBdICk7XG5cdFx0XHRlZGl0b3IudGFic1sgdGFyZ2V0X2luZGV4IF0uZm9jdXMoKTtcblx0XHRcdGVkaXRvci50YWJzWyB0YXJnZXRfaW5kZXggXS5zY3JvbGxJbnRvVmlldyggeyBibG9jazogJ25lYXJlc3QnLCBpbmxpbmU6ICduZWFyZXN0JyB9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSW5pdGlhbGl6ZSB0aGlzIG1vZHVsZSBhZ2FpbnN0IHNoZWxsLXByb3ZpZGVkIEFQSXMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcmVnaXN0ZXJlZF9zaGVsbF9hcGkgU2hhcmVkIHdpemFyZCBhZGFwdGVyIHNlcnZpY2VzLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaW5pdGlhbGl6ZSggcmVnaXN0ZXJlZF9zaGVsbF9hcGkgKSB7XG5cdFx0XHR2YXIgZWRpdG9yX25vZGU7XG5cdFx0XHR2YXIgc2VsZWN0ZWRfY2FyZDtcblx0XHRcdHZhciBpbml0aWFsX3ByZXZpZXdfa2luZDtcblx0XHRcdHZhciBpbml0aWFsX3RlbXBsYXRlX3NsdWc7XG5cdFx0XHR2YXIgaW5pdGlhbF9ib29raW5nX2Zvcm1fdXNhZ2U7XG5cdFx0XHR2YXIgaW5pdGlhbF9wcmV2aWV3X2Jvb3RzdHJhcDtcblx0XHRcdHZhciBpbml0aWFsX3ByZXZpZXdfaHRtbDtcblxuXHRcdFx0c2hlbGxfYXBpID0gcmVnaXN0ZXJlZF9zaGVsbF9hcGk7XG5cdFx0XHRyb290ID0gc2hlbGxfYXBpLnJvb3Q7XG5cdFx0XHRlZGl0b3Jfbm9kZSA9IHJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1mb3JtLXRlbXBsYXRlLWVkaXRvcl0nICk7XG5cdFx0XHRpZiAoICEgZWRpdG9yX25vZGUgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0ZWRpdG9yID0ge1xuXHRcdFx0XHRub2RlOiBlZGl0b3Jfbm9kZSxcblx0XHRcdFx0Y2FyZHM6IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKCBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy10ZW1wbGF0ZS1jYXJkXScgKSApLFxuXHRcdFx0XHR0YWJzOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCggZWRpdG9yX25vZGUucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdGVtcGxhdGUtZmlsdGVyXScgKSApLFxuXHRcdFx0XHRzZWFyY2g6IGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRlbXBsYXRlLXNlYXJjaF0nICksXG5cdFx0XHRcdGdyaWQ6IGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRlbXBsYXRlLWdyaWRdJyApLFxuXHRcdFx0XHRlbXB0eTogZWRpdG9yX25vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGVtcGxhdGUtZW1wdHldJyApLFxuXHRcdFx0XHRwcmV2aWV3X3N0YWdlOiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10ZW1wbGF0ZS1wcmV2aWV3LXN0YWdlXScgKSxcblx0XHRcdFx0cHJldmlld19sb2FkZXI6IGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRlbXBsYXRlLXByZXZpZXctbG9hZGVyXScgKSxcblx0XHRcdFx0cHJldmlld19lcnJvcjogZWRpdG9yX25vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGVtcGxhdGUtcHJldmlldy1lcnJvcl0nICksXG5cdFx0XHRcdGlubGluZV9wcmV2aWV3OiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10ZW1wbGF0ZS1pbmxpbmUtcHJldmlld10nICksXG5cdFx0XHRcdGlubGluZV9wcmV2aWV3X2NvbnRlbnQ6IGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRlbXBsYXRlLWlubGluZS1wcmV2aWV3LWNvbnRlbnRdJyApLFxuXHRcdFx0XHRpbml0aWFsX3ByZXZpZXdfYm9vdHN0cmFwOiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10ZW1wbGF0ZS1pbml0aWFsLXByZXZpZXctYm9vdHN0cmFwXScgKSxcblx0XHRcdFx0cHJldmlld19mcmFtZTogZWRpdG9yX25vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGVtcGxhdGUtcHJldmlldy1mcmFtZV0nICksXG5cdFx0XHRcdHJlZnJlc2hfYnV0dG9uOiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10ZW1wbGF0ZS1yZWZyZXNoXScgKSxcblx0XHRcdFx0b3Blbl9idXR0b246IGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRlbXBsYXRlLW9wZW4tcHJldmlld10nICksXG5cdFx0XHRcdGFjdGl2ZV9maWx0ZXI6IGVkaXRvcl9ub2RlLmRhdGFzZXQuaW5pdGlhbEZpbHRlciB8fCAnYWxsJ1xuXHRcdFx0fTtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHR3aW5kb3cud3BiY19iZmJfaW5saW5lX3ByZXZpZXcgJiZcblx0XHRcdFx0J2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX2JmYl9pbmxpbmVfcHJldmlldy5jcmVhdGVcblx0XHRcdCkge1xuXHRcdFx0XHRpbmxpbmVfcHJldmlld19yZW5kZXJlciA9IHdpbmRvdy53cGJjX2JmYl9pbmxpbmVfcHJldmlldy5jcmVhdGUoIGVkaXRvci5pbmxpbmVfcHJldmlld19jb250ZW50ICk7XG5cdFx0XHR9XG5cblx0XHRcdGVkaXRvci5ub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGhhbmRsZV9jbGljayApO1xuXHRcdFx0ZWRpdG9yLm5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIGhhbmRsZV9jaGFuZ2UgKTtcblx0XHRcdGVkaXRvci5ub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywgaGFuZGxlX2tleWRvd24gKTtcblx0XHRcdHJvb3QuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6c2V0dXAtd2l6YXJkLWRpYWxvZy1jbG9zZWQnLCBoYW5kbGVfZGlhbG9nX2Nsb3NlZCApO1xuXHRcdFx0Y29uZmlybWVkX2Jvb2tpbmdfZm9ybV91c2FnZSA9IGdldF9zZWxlY3RlZF9ib29raW5nX2Zvcm1fdXNhZ2UoKTtcblx0XHRcdGlmICggZWRpdG9yLnNlYXJjaCApIHtcblx0XHRcdFx0ZWRpdG9yLnNlYXJjaC5hZGRFdmVudExpc3RlbmVyKCAnaW5wdXQnLCBoYW5kbGVfc2VhcmNoX2NoYW5nZSApO1xuXHRcdFx0XHRlZGl0b3Iuc2VhcmNoLmFkZEV2ZW50TGlzdGVuZXIoICdzZWFyY2gnLCBoYW5kbGVfc2VhcmNoX2NoYW5nZSApO1xuXHRcdFx0XHRlZGl0b3Iuc2VhcmNoLmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBoYW5kbGVfc2VhcmNoX2NoYW5nZSApO1xuXHRcdFx0fVxuXG5cdFx0XHRlZGl0b3IuY2FyZHMuZm9yRWFjaCggZnVuY3Rpb24gKCBjYXJkICkge1xuXHRcdFx0XHRpbml0aWFsaXplX2ltYWdlX2ZhbGxiYWNrKFxuXHRcdFx0XHRcdGNhcmQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGVtcGxhdGUtY2FyZC1pbWFnZV0nICksXG5cdFx0XHRcdFx0Y2FyZC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10ZW1wbGF0ZS1pbWFnZS1wbGFjZWhvbGRlcl0nIClcblx0XHRcdFx0KTtcblx0XHRcdH0gKTtcblxuXHRcdFx0cmVuZGVyX2NhdGFsb2coKTtcblx0XHRcdHNlbGVjdGVkX2NhcmQgPSBnZXRfc2VsZWN0ZWRfY2FyZCgpO1xuXHRcdFx0aWYgKCBzZWxlY3RlZF9jYXJkICkge1xuXHRcdFx0XHRpbml0aWFsX3ByZXZpZXdfa2luZCA9IFN0cmluZyggZWRpdG9yLnByZXZpZXdfc3RhZ2UuZGF0YXNldC5pbml0aWFsUHJldmlld0tpbmQgfHwgJycgKTtcblx0XHRcdFx0aW5pdGlhbF90ZW1wbGF0ZV9zbHVnID0gU3RyaW5nKCBlZGl0b3IucHJldmlld19zdGFnZS5kYXRhc2V0LmluaXRpYWxQcmV2aWV3VGVtcGxhdGVTbHVnIHx8ICcnICk7XG5cdFx0XHRcdGluaXRpYWxfYm9va2luZ19mb3JtX3VzYWdlID0gU3RyaW5nKCBlZGl0b3IucHJldmlld19zdGFnZS5kYXRhc2V0LmluaXRpYWxQcmV2aWV3Qm9va2luZ0Zvcm1Vc2FnZSB8fCAnJyApO1xuXHRcdFx0XHRzZWxlY3RfY2FyZCggc2VsZWN0ZWRfY2FyZCwgZmFsc2UgKTtcblxuXHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0J2lubGluZScgPT09IGluaXRpYWxfcHJldmlld19raW5kICYmXG5cdFx0XHRcdFx0aW5pdGlhbF90ZW1wbGF0ZV9zbHVnID09PSBTdHJpbmcoIHNlbGVjdGVkX2NhcmQuZGF0YXNldC50ZW1wbGF0ZVNsdWcgfHwgJycgKSAmJlxuXHRcdFx0XHRcdGluaXRpYWxfYm9va2luZ19mb3JtX3VzYWdlID09PSBnZXRfc2VsZWN0ZWRfYm9va2luZ19mb3JtX3VzYWdlKCkgJiZcblx0XHRcdFx0XHRpbmxpbmVfcHJldmlld19yZW5kZXJlciAmJlxuXHRcdFx0XHRcdGVkaXRvci5pbml0aWFsX3ByZXZpZXdfYm9vdHN0cmFwXG5cdFx0XHRcdCkge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRpbml0aWFsX3ByZXZpZXdfYm9vdHN0cmFwID0gSlNPTi5wYXJzZSggZWRpdG9yLmluaXRpYWxfcHJldmlld19ib290c3RyYXAudGV4dENvbnRlbnQgfHwgJ3t9JyApO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKCBlcnJvciApIHtcblx0XHRcdFx0XHRcdGluaXRpYWxfcHJldmlld19ib290c3RyYXAgPSBudWxsO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpbml0aWFsX3ByZXZpZXdfaHRtbCA9IGVkaXRvci5pbmxpbmVfcHJldmlld19jb250ZW50LmlubmVySFRNTDtcblx0XHRcdFx0XHRpZiAoIGluaXRpYWxfcHJldmlld19ib290c3RyYXAgJiYgJ29iamVjdCcgPT09IHR5cGVvZiBpbml0aWFsX3ByZXZpZXdfYm9vdHN0cmFwICkge1xuXHRcdFx0XHRcdFx0aW5saW5lX3ByZXZpZXdfcmVuZGVyZXIucmVwbGFjZSggaW5pdGlhbF9wcmV2aWV3X2h0bWwsIGluaXRpYWxfcHJldmlld19ib290c3RyYXAgKVxuXHRcdFx0XHRcdFx0XHQuZG9uZSggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0XHRcdHNldF9jdXJyZW50X3ByZXZpZXcoICdpbmxpbmUnLCAnJywgaW5pdGlhbF90ZW1wbGF0ZV9zbHVnLCBpbml0aWFsX2Jvb2tpbmdfZm9ybV91c2FnZSApO1xuXHRcdFx0XHRcdFx0XHRcdHNldF9wcmV2aWV3X3N0YXRlKCBmYWxzZSwgJycgKTtcblx0XHRcdFx0XHRcdFx0fSApXG5cdFx0XHRcdFx0XHRcdC5mYWlsKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRcdFx0bG9hZF9wcmV2aWV3KCBzZWxlY3RlZF9jYXJkICk7XG5cdFx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0bG9hZF9wcmV2aWV3KCBzZWxlY3RlZF9jYXJkICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGxvYWRfcHJldmlldyggc2VsZWN0ZWRfY2FyZCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZW5kZXJfcHJldmlld19tZXRhZGF0YSggbnVsbCApO1xuXHRcdFx0XHRzZXRfcHJldmlld19zdGF0ZSggZmFsc2UsIGdldF9tZXNzYWdlKCAncHJldmlld19lcnJvcicsICdUaGUgaW50ZXJhY3RpdmUgcHJldmlldyBjb3VsZCBub3QgYmUgbG9hZGVkLiBUcnkgcmVmcmVzaGluZyBpdC4nICkgKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygc2hlbGxfYXBpLm9wZW5fZGlhbG9nICkge1xuXHRcdFx0XHR3aW5kb3cuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdHNoZWxsX2FwaS5vcGVuX2RpYWxvZyggdGVtcGxhdGVfZ3VpZGFuY2VfZGlhbG9nX2FjdGlvbiwgZWRpdG9yLnNlYXJjaCB8fCBlZGl0b3Iubm9kZSApO1xuXHRcdFx0XHR9LCAwICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogVmFsaWRhdGUgdGhlIHJlcXVpcmVkIHNlbGVjdGlvbiBiZWZvcmUgZm9yd2FyZCBuYXZpZ2F0aW9uLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7SFRNTEVsZW1lbnR8bnVsbH0gRmlyc3QgaW52YWxpZCByYWRpbywgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiB2YWxpZGF0ZSgpIHtcblx0XHRcdHZhciBzZWxlY3RlZF9yYWRpbyA9IGVkaXRvciAmJiBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10ZW1wbGF0ZS1yYWRpb106Y2hlY2tlZCcgKTtcblx0XHRcdHZhciBzZWxlY3RlZF91c2FnZSA9IGVkaXRvciAmJiBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLWZvcm0tdXNhZ2UtcmFkaW9dOmNoZWNrZWQnICk7XG5cblx0XHRcdGlmICggISBzZWxlY3RlZF9yYWRpbyApIHtcblx0XHRcdFx0cmV0dXJuIHNoZWxsX2FwaS5zZXRfZmllbGRfZXJyb3IoICdib29raW5nX2Zvcm1fdGVtcGxhdGUnLCBnZXRfbWVzc2FnZSggJ3RlbXBsYXRlX3JlcXVpcmVkJywgJ0Nob29zZSBhIGJvb2tpbmcgZm9ybSB0ZW1wbGF0ZS4nICkgKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCAhIHNlbGVjdGVkX3VzYWdlICkge1xuXHRcdFx0XHRyZXR1cm4gc2hlbGxfYXBpLnNldF9maWVsZF9lcnJvciggJ2Jvb2tpbmdfZm9ybV91c2FnZScsIGdldF9tZXNzYWdlKCAndXNhZ2VfcmVxdWlyZWQnLCAnQ2hvb3NlIGhvdyBjdXN0b21lcnMgd2lsbCBvcGVuIHRoZSBib29raW5nIGZvcm0uJyApICk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRpbml0aWFsaXplOiBpbml0aWFsaXplLFxuXHRcdFx0c3luYzogZnVuY3Rpb24gKCkge30sXG5cdFx0XHR2YWxpZGF0ZTogdmFsaWRhdGVcblx0XHR9O1xuXHR9XG5cblx0d2luZG93LndwYmNfc2V0dXBfZWRpdG9yX21vZHVsZXMgPSB3aW5kb3cud3BiY19zZXR1cF9lZGl0b3JfbW9kdWxlcyB8fCB7fTtcblx0d2luZG93LndwYmNfc2V0dXBfZWRpdG9yX21vZHVsZXMuYm9va2luZ19mb3JtX3RlbXBsYXRlID0ge1xuXHRcdGNyZWF0ZTogY3JlYXRlX2Jvb2tpbmdfZm9ybV90ZW1wbGF0ZV9hZGFwdGVyXG5cdH07XG5cblx0aWYgKCB3aW5kb3cud3BiY19zZXR1cF93aXphcmRfYXBpICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19zZXR1cF93aXphcmRfYXBpLnJlZ2lzdGVyX3N0ZXBfYWRhcHRlciApIHtcblx0XHR3aW5kb3cud3BiY19zZXR1cF93aXphcmRfYXBpLnJlZ2lzdGVyX3N0ZXBfYWRhcHRlciggY3JlYXRlX2Jvb2tpbmdfZm9ybV90ZW1wbGF0ZV9hZGFwdGVyKCBtb2R1bGVfY29uZmlnICkgKTtcblx0fVxufSggd2luZG93LCBkb2N1bWVudCApICk7XG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0UsV0FBV0EsTUFBTSxFQUFFQyxRQUFRLEVBQUc7RUFDL0IsWUFBWTs7RUFFWixJQUFJQyxhQUFhLEdBQUdGLE1BQU0sQ0FBQ0csdUNBQXVDLElBQUk7SUFBRUMsSUFBSSxFQUFFLENBQUM7RUFBRSxDQUFDOztFQUVsRjtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTQyxvQ0FBb0NBLENBQUVDLE1BQU0sRUFBRztJQUN2RCxJQUFJQyw4QkFBOEIsR0FBRywrQkFBK0I7SUFDcEUsSUFBSUMsK0JBQStCLEdBQUcsZ0NBQWdDO0lBQ3RFLElBQUlDLFNBQVMsR0FBRyxJQUFJO0lBQ3BCLElBQUlDLElBQUksR0FBRyxJQUFJO0lBQ2YsSUFBSUMsTUFBTSxHQUFHLElBQUk7SUFDakIsSUFBSUMsNEJBQTRCLEdBQUcsRUFBRTtJQUNyQyxJQUFJQyx3QkFBd0IsR0FBRyxDQUFDO0lBQ2hDLElBQUlDLHdCQUF3QixHQUFHLElBQUk7SUFDbkMsSUFBSUMscUJBQXFCLEdBQUcsQ0FBQztJQUM3QixJQUFJQyxxQkFBcUIsR0FBRyxJQUFJO0lBQ2hDLElBQUlDLHVCQUF1QixHQUFHLEtBQUs7SUFDbkMsSUFBSUMsdUJBQXVCLEdBQUcsSUFBSTtJQUNsQyxJQUFJQyxlQUFlLEdBQUc7TUFDckJDLElBQUksRUFBRSxFQUFFO01BQ1JDLEdBQUcsRUFBRSxFQUFFO01BQ1BDLGFBQWEsRUFBRSxFQUFFO01BQ2pCQyxrQkFBa0IsRUFBRTtJQUNyQixDQUFDOztJQUVEO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0MsV0FBV0EsQ0FBRUMsR0FBRyxFQUFFQyxRQUFRLEVBQUc7TUFDckMsT0FBT3BCLE1BQU0sQ0FBQ0YsSUFBSSxJQUFJRSxNQUFNLENBQUNG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
