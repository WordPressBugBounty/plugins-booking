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
      return 'appointment_flow' === booking_form_usage ? '[booking_appointment form_type="standard"]' : '[booking form_type="standard"]';
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1zZXR1cC13aXphcmQvc3RlcC1ib29raW5nLWZvcm0tdGVtcGxhdGUvX291dC9zdGVwLWJvb2tpbmctZm9ybS10ZW1wbGF0ZS5qcyIsIm5hbWVzIjpbIndpbmRvdyIsImRvY3VtZW50IiwibW9kdWxlX2NvbmZpZyIsIndwYmNfc2V0dXBfd2l6YXJkX2Jvb2tpbmdfZm9ybV90ZW1wbGF0ZSIsImkxOG4iLCJjcmVhdGVfYm9va2luZ19mb3JtX3RlbXBsYXRlX2FkYXB0ZXIiLCJjb25maWciLCJhcHBvaW50bWVudF9mbG93X2RpYWxvZ19hY3Rpb24iLCJ0ZW1wbGF0ZV9ndWlkYW5jZV9kaWFsb2dfYWN0aW9uIiwic2hlbGxfYXBpIiwicm9vdCIsImVkaXRvciIsImNvbmZpcm1lZF9ib29raW5nX2Zvcm1fdXNhZ2UiLCJwcmV2aWV3X3JlcXVlc3Rfc2VxdWVuY2UiLCJwcmV2aWV3X2Fib3J0X2NvbnRyb2xsZXIiLCJvcGVuX3JlcXVlc3Rfc2VxdWVuY2UiLCJvcGVuX2Fib3J0X2NvbnRyb2xsZXIiLCJvcGVuX3JlcXVlc3RfaXNfbG9hZGluZyIsImlubGluZV9wcmV2aWV3X3JlbmRlcmVyIiwiY3VycmVudF9wcmV2aWV3Iiwia2luZCIsInVybCIsInRlbXBsYXRlX3NsdWciLCJib29raW5nX2Zvcm1fdXNhZ2UiLCJnZXRfbWVzc2FnZSIsImtleSIsImZhbGxiYWNrIiwibm9ybWFsaXplX3NlYXJjaF90ZXh0IiwidGV4dCIsIlN0cmluZyIsInRvTG9jYWxlTG93ZXJDYXNlIiwiZ2V0X2NhcmRfc2VhcmNoX3RleHQiLCJjYXJkIiwidGl0bGUiLCJxdWVyeVNlbGVjdG9yIiwiZGVzY3JpcHRpb24iLCJ0ZXh0Q29udGVudCIsImRhdGFzZXQiLCJ0ZW1wbGF0ZVNsdWciLCJpbml0aWFsaXplX2ltYWdlX2ZhbGxiYWNrIiwiaW1hZ2UiLCJwbGFjZWhvbGRlciIsImFkZEV2ZW50TGlzdGVuZXIiLCJoaWRkZW4iLCJjb21wbGV0ZSIsInNyYyIsIm5hdHVyYWxXaWR0aCIsImdldF9zZWxlY3RlZF9jYXJkIiwic2VsZWN0ZWRfcmFkaW8iLCJub2RlIiwiY2xvc2VzdCIsImdldF9zZWxlY3RlZF9ib29raW5nX2Zvcm1fdXNhZ2UiLCJ2YWx1ZSIsImdldF9wcmV2aWV3X3Nob3J0Y29kZSIsInJlbmRlcl9wcmV2aWV3X21ldGFkYXRhIiwidGl0bGVfbm9kZSIsInNsdWdfbm9kZSIsInNob3J0Y29kZV9ub2RlIiwiZGVzY3JpcHRpb25fbm9kZSIsInRyaW0iLCJzZXRfcHJldmlld19zdGF0ZSIsImlzX2xvYWRpbmciLCJlcnJvcl90ZXh0IiwiaGFzX2Vycm9yIiwicHJldmlld19zdGFnZSIsImNsYXNzTGlzdCIsInRvZ2dsZSIsInNldEF0dHJpYnV0ZSIsInByZXZpZXdfbG9hZGVyIiwicHJldmlld19lcnJvciIsInJlZnJlc2hfYnV0dG9uIiwiZGlzYWJsZWQiLCJvcGVuX2J1dHRvbiIsImNsZWFyX3ByZXZpZXdfZnJhbWUiLCJwcmV2aWV3X2ZyYW1lIiwicmVtb3ZlQXR0cmlidXRlIiwic2V0X2N1cnJlbnRfcHJldmlldyIsInByZXZpZXdfa2luZCIsInByZXZpZXdfdXJsIiwiY3VycmVudF9wcmV2aWV3X21hdGNoZXMiLCJnZXRfYWpheF9lcnJvcl9tZXNzYWdlIiwicmVzcG9uc2UiLCJkYXRhIiwibWVzc2FnZSIsImJ1aWxkX3ByZXZpZXdfcmVxdWVzdF9ib2R5IiwicHJldmlld190YXJnZXQiLCJyZXF1ZXN0X2JvZHkiLCJGb3JtRGF0YSIsImFwcGVuZCIsInByZXZpZXdfYWN0aW9uIiwibm9uY2UiLCJ2YWxpZGF0ZV9wcmV2aWV3X3Jlc3BvbnNlIiwicmVzcG9uc2VfZGF0YSIsInNlbGVjdGVkX2NhcmQiLCJzdWNjZXNzIiwiRXJyb3IiLCJsb2FkX3ByZXZpZXciLCJyZXF1ZXN0X3NlcXVlbmNlIiwiYWpheF91cmwiLCJhYm9ydCIsIkFib3J0Q29udHJvbGxlciIsImZldGNoIiwibWV0aG9kIiwiYm9keSIsImNyZWRlbnRpYWxzIiwic2lnbmFsIiwidW5kZWZpbmVkIiwidGhlbiIsImpzb24iLCJodG1sIiwiYm9vdHN0cmFwIiwicmVwbGFjZSIsImlubGluZV9wcmV2aWV3Iiwib25sb2FkIiwiY2F0Y2giLCJlcnJvciIsIm5hbWUiLCJvcGVuX3ByZXZpZXciLCJwcmV2aWV3X3dpbmRvdyIsIm9wZW4iLCJvcGVuZXIiLCJsb2NhdGlvbiIsImNsb3NlIiwic2VsZWN0X2NhcmQiLCJsb2FkX3NlbGVjdGVkIiwicmFkaW8iLCJjaGVja2VkIiwiY2FyZHMiLCJmb3JFYWNoIiwidGVtcGxhdGVfY2FyZCIsImNsZWFyX2ZpZWxkX2Vycm9yIiwiZ2V0X21hdGNoaW5nX2NhcmRzIiwicXVlcnkiLCJzZWFyY2giLCJmaWx0ZXIiLCJtYXRjaGVzX2ZpbHRlciIsImFjdGl2ZV9maWx0ZXIiLCJ0ZW1wbGF0ZVJlY29tbWVuZGVkIiwidGVtcGxhdGVDYXRlZ29yeSIsIm1hdGNoZXNfc2VhcmNoIiwiaW5kZXhPZiIsInJlbmRlcl9jYXRhbG9nIiwibWF0Y2hpbmdfY2FyZHMiLCJlbXB0eSIsImxlbmd0aCIsImdyaWQiLCJzY3JvbGxMZWZ0IiwiYWN0aXZhdGVfZmlsdGVyIiwidGFiIiwid3BiY1RlbXBsYXRlRmlsdGVyIiwidGFicyIsImZpbHRlcl90YWIiLCJpc19hY3RpdmUiLCJ0YWJJbmRleCIsImlkIiwiZ2V0X2ZpbHRlcl90YWIiLCJmaWx0ZXJfaWQiLCJmaW5kIiwiaGFuZGxlX3NlYXJjaF9jaGFuZ2UiLCJhbGxfdGVtcGxhdGVzX3RhYiIsImhhbmRsZV9jbGljayIsImV2ZW50IiwidGFyZ2V0Iiwib3Blbl9saW5rIiwidGVtcGxhdGVfcmFkaW8iLCJwcmV2ZW50RGVmYXVsdCIsImZvY3VzIiwic2VsZWN0X2Jvb2tpbmdfZm9ybV91c2FnZSIsIkFycmF5IiwicHJvdG90eXBlIiwic2xpY2UiLCJjYWxsIiwicXVlcnlTZWxlY3RvckFsbCIsInVzYWdlX3JhZGlvIiwiaXNfc2VsZWN0ZWQiLCJjb21taXRfYm9va2luZ19mb3JtX3VzYWdlIiwiaGFuZGxlX2RpYWxvZ19jbG9zZWQiLCJkaWFsb2dfc3RhdGUiLCJkZXRhaWwiLCJhY3Rpb24iLCJvdXRjb21lIiwiaGFuZGxlX2NoYW5nZSIsIm1hdGNoZXMiLCJvcGVuX2RpYWxvZyIsImhhbmRsZV9rZXlkb3duIiwiY3VycmVudF9pbmRleCIsInRhcmdldF9pbmRleCIsInNjcm9sbEludG9WaWV3IiwiYmxvY2siLCJpbmxpbmUiLCJpbml0aWFsaXplIiwicmVnaXN0ZXJlZF9zaGVsbF9hcGkiLCJlZGl0b3Jfbm9kZSIsImluaXRpYWxfcHJldmlld19raW5kIiwiaW5pdGlhbF90ZW1wbGF0ZV9zbHVnIiwiaW5pdGlhbF9ib29raW5nX2Zvcm1fdXNhZ2UiLCJpbml0aWFsX3ByZXZpZXdfYm9vdHN0cmFwIiwiaW5pdGlhbF9wcmV2aWV3X2h0bWwiLCJpbmxpbmVfcHJldmlld19jb250ZW50IiwiaW5pdGlhbEZpbHRlciIsIndwYmNfYmZiX2lubGluZV9wcmV2aWV3IiwiY3JlYXRlIiwiaW5pdGlhbFByZXZpZXdLaW5kIiwiaW5pdGlhbFByZXZpZXdUZW1wbGF0ZVNsdWciLCJpbml0aWFsUHJldmlld0Jvb2tpbmdGb3JtVXNhZ2UiLCJKU09OIiwicGFyc2UiLCJpbm5lckhUTUwiLCJkb25lIiwiZmFpbCIsInNldFRpbWVvdXQiLCJ2YWxpZGF0ZSIsInNlbGVjdGVkX3VzYWdlIiwic2V0X2ZpZWxkX2Vycm9yIiwic3luYyIsIndwYmNfc2V0dXBfZWRpdG9yX21vZHVsZXMiLCJib29raW5nX2Zvcm1fdGVtcGxhdGUiLCJ3cGJjX3NldHVwX3dpemFyZF9hcGkiLCJyZWdpc3Rlcl9zdGVwX2FkYXB0ZXIiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLXNldHVwLXdpemFyZC9zdGVwLWJvb2tpbmctZm9ybS10ZW1wbGF0ZS9fc3JjL3N0ZXAtYm9va2luZy1mb3JtLXRlbXBsYXRlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUHJvdmlkZSB0aGUgcmV1c2FibGUgQm9va2luZyBGb3JtIHRlbXBsYXRlIGNhdGFsb2cgYW5kIGludGVyYWN0aXZlIHByZXZpZXcuXG4gKlxuICogQ2F0YWxvZyBjYXJkcyByZW1haW4gc2VydmVyLXJlbmRlcmVkLiBEaXJlY3QgdGVtcGxhdGVzIHVzZSByZXF1ZXN0LWxvY2FsXG4gKiBpbmxpbmUgSFRNTCwgd2hpbGUgQXBwb2ludG1lbnQgRmxvdyBhbmQgZnVsbC1zaXRlIHByZXZpZXdzIHVzZSBzaWduZWQgVVJMcy5cbiAqIFRoZSBicm93c2VyIG5ldmVyIHJlY2VpdmVzIHJhdyB0ZW1wbGF0ZSBkZWZpbml0aW9ucyBhbmQgbmV2ZXIgYXBwbGllcyBhIGZvcm0uXG4gKlxuICogQHBhY2thZ2UgQm9va2luZyBDYWxlbmRhclxuICovXG4oIGZ1bmN0aW9uICggd2luZG93LCBkb2N1bWVudCApIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdHZhciBtb2R1bGVfY29uZmlnID0gd2luZG93LndwYmNfc2V0dXBfd2l6YXJkX2Jvb2tpbmdfZm9ybV90ZW1wbGF0ZSB8fCB7IGkxOG46IHt9IH07XG5cblx0LyoqXG5cdCAqIENyZWF0ZSBvbmUgaXNvbGF0ZWQgQm9va2luZyBGb3JtIHRlbXBsYXRlIHNlbGVjdG9yIGFkYXB0ZXIuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgTW9kdWxlIGVuZHBvaW50IGFuZCB0cmFuc2xhdGlvbiBzZXR0aW5ncy5cblx0ICogQHJldHVybiB7T2JqZWN0fSBTdGVwIGFkYXB0ZXIgYWNjZXB0ZWQgYnkgdGhlIHNoYXJlZCB3aXphcmQgc2hlbGwuXG5cdCAqL1xuXHRmdW5jdGlvbiBjcmVhdGVfYm9va2luZ19mb3JtX3RlbXBsYXRlX2FkYXB0ZXIoIGNvbmZpZyApIHtcblx0XHR2YXIgYXBwb2ludG1lbnRfZmxvd19kaWFsb2dfYWN0aW9uID0gJ2Jvb2tpbmctZm9ybS1hcHBvaW50bWVudC1mbG93Jztcblx0XHR2YXIgdGVtcGxhdGVfZ3VpZGFuY2VfZGlhbG9nX2FjdGlvbiA9ICdib29raW5nLWZvcm0tdGVtcGxhdGUtZ3VpZGFuY2UnO1xuXHRcdHZhciBzaGVsbF9hcGkgPSBudWxsO1xuXHRcdHZhciByb290ID0gbnVsbDtcblx0XHR2YXIgZWRpdG9yID0gbnVsbDtcblx0XHR2YXIgY29uZmlybWVkX2Jvb2tpbmdfZm9ybV91c2FnZSA9ICcnO1xuXHRcdHZhciBwcmV2aWV3X3JlcXVlc3Rfc2VxdWVuY2UgPSAwO1xuXHRcdHZhciBwcmV2aWV3X2Fib3J0X2NvbnRyb2xsZXIgPSBudWxsO1xuXHRcdHZhciBvcGVuX3JlcXVlc3Rfc2VxdWVuY2UgPSAwO1xuXHRcdHZhciBvcGVuX2Fib3J0X2NvbnRyb2xsZXIgPSBudWxsO1xuXHRcdHZhciBvcGVuX3JlcXVlc3RfaXNfbG9hZGluZyA9IGZhbHNlO1xuXHRcdHZhciBpbmxpbmVfcHJldmlld19yZW5kZXJlciA9IG51bGw7XG5cdFx0dmFyIGN1cnJlbnRfcHJldmlldyA9IHtcblx0XHRcdGtpbmQ6ICcnLFxuXHRcdFx0dXJsOiAnJyxcblx0XHRcdHRlbXBsYXRlX3NsdWc6ICcnLFxuXHRcdFx0Ym9va2luZ19mb3JtX3VzYWdlOiAnJ1xuXHRcdH07XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gb25lIHRyYW5zbGF0ZWQgc3RyaW5nIHdpdGggYSBzYWZlIGZhbGxiYWNrLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGtleSAgICAgIFRyYW5zbGF0aW9uIGtleS5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gZmFsbGJhY2sgRmFsbGJhY2sgY29weS5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IFRyYW5zbGF0aW9uIG9yIGZhbGxiYWNrLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9tZXNzYWdlKCBrZXksIGZhbGxiYWNrICkge1xuXHRcdFx0cmV0dXJuIGNvbmZpZy5pMThuICYmIGNvbmZpZy5pMThuWyBrZXkgXSA/IGNvbmZpZy5pMThuWyBrZXkgXSA6IGZhbGxiYWNrO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBub3JtYWxpemVkIHRleHQgZm9yIGNhc2UtaW5zZW5zaXRpdmUgY2F0YWxvZyBzZWFyY2hpbmcuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdGV4dCBTb3VyY2UgdGV4dC5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IExvd2VyY2FzZSBub3JtYWxpemVkIHRleHQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbm9ybWFsaXplX3NlYXJjaF90ZXh0KCB0ZXh0ICkge1xuXHRcdFx0cmV0dXJuIFN0cmluZyggdGV4dCB8fCAnJyApLnRvTG9jYWxlTG93ZXJDYXNlKCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIG9uZSB0ZW1wbGF0ZSBjYXJkJ3Mgc2VhcmNoYWJsZSB0ZXh0LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gY2FyZCBUZW1wbGF0ZSBjYXJkLlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gTm9ybWFsaXplZCBzZWFyY2hhYmxlIHRleHQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X2NhcmRfc2VhcmNoX3RleHQoIGNhcmQgKSB7XG5cdFx0XHR2YXIgdGl0bGUgPSBjYXJkLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRlbXBsYXRlLXRpdGxlXScgKTtcblx0XHRcdHZhciBkZXNjcmlwdGlvbiA9IGNhcmQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGVtcGxhdGUtZGVzY3JpcHRpb25dJyApO1xuXG5cdFx0XHRyZXR1cm4gbm9ybWFsaXplX3NlYXJjaF90ZXh0KFxuXHRcdFx0XHQoIHRpdGxlID8gdGl0bGUudGV4dENvbnRlbnQgOiAnJyApICsgJyAnICtcblx0XHRcdFx0KCBkZXNjcmlwdGlvbiA/IGRlc2NyaXB0aW9uLnRleHRDb250ZW50IDogJycgKSArICcgJyArXG5cdFx0XHRcdCggY2FyZC5kYXRhc2V0LnRlbXBsYXRlU2x1ZyB8fCAnJyApXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEluc3RhbGwgYSBncmFjZWZ1bCBmYWxsYmFjayBmb3Igb25lIGNhdGFsb2cgdGh1bWJuYWlsLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MSW1hZ2VFbGVtZW50fG51bGx9IGltYWdlICAgICAgIEltYWdlIGVsZW1lbnQuXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxudWxsfSAgICAgIHBsYWNlaG9sZGVyIFBsYWNlaG9sZGVyIGVsZW1lbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpbml0aWFsaXplX2ltYWdlX2ZhbGxiYWNrKCBpbWFnZSwgcGxhY2Vob2xkZXIgKSB7XG5cdFx0XHRpZiAoICEgaW1hZ2UgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aW1hZ2UuYWRkRXZlbnRMaXN0ZW5lciggJ2xvYWQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGltYWdlLmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0XHRpZiAoIHBsYWNlaG9sZGVyICkge1xuXHRcdFx0XHRcdHBsYWNlaG9sZGVyLmhpZGRlbiA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdGltYWdlLmFkZEV2ZW50TGlzdGVuZXIoICdlcnJvcicsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0aW1hZ2UuaGlkZGVuID0gdHJ1ZTtcblx0XHRcdFx0aWYgKCBwbGFjZWhvbGRlciApIHtcblx0XHRcdFx0XHRwbGFjZWhvbGRlci5oaWRkZW4gPSBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXG5cdFx0XHRpZiAoIGltYWdlLmNvbXBsZXRlICYmIGltYWdlLnNyYyAmJiAwID09PSBpbWFnZS5uYXR1cmFsV2lkdGggKSB7XG5cdFx0XHRcdGltYWdlLmhpZGRlbiA9IHRydWU7XG5cdFx0XHRcdGlmICggcGxhY2Vob2xkZXIgKSB7XG5cdFx0XHRcdFx0cGxhY2Vob2xkZXIuaGlkZGVuID0gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gdGhlIGN1cnJlbnRseSBzZWxlY3RlZCBzZXJ2ZXItcmVuZGVyZWQgY2FyZC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge0hUTUxFbGVtZW50fG51bGx9IFNlbGVjdGVkIGNhcmQgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfc2VsZWN0ZWRfY2FyZCgpIHtcblx0XHRcdHZhciBzZWxlY3RlZF9yYWRpbyA9IGVkaXRvciAmJiBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10ZW1wbGF0ZS1yYWRpb106Y2hlY2tlZCcgKTtcblxuXHRcdFx0cmV0dXJuIHNlbGVjdGVkX3JhZGlvID8gc2VsZWN0ZWRfcmFkaW8uY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGVtcGxhdGUtY2FyZF0nICkgOiBudWxsO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiB0aGUgc2VsZWN0ZWQgc2VydmVyLXJlbmRlcmVkIEJvb2tpbmcgRm9ybSBlbnRyeSBwb2ludC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gU3RhYmxlIHVzYWdlIGlkZW50aWZpZXIsIG9yIGFuIGVtcHR5IHN0cmluZy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfc2VsZWN0ZWRfYm9va2luZ19mb3JtX3VzYWdlKCkge1xuXHRcdFx0dmFyIHNlbGVjdGVkX3JhZGlvID0gZWRpdG9yICYmIGVkaXRvci5ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctZm9ybS11c2FnZS1yYWRpb106Y2hlY2tlZCcgKTtcblxuXHRcdFx0cmV0dXJuIHNlbGVjdGVkX3JhZGlvID8gU3RyaW5nKCBzZWxlY3RlZF9yYWRpby52YWx1ZSB8fCAnJyApIDogJyc7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQnVpbGQgdGhlIGluZm9ybWF0aW9uYWwgc2hvcnRjb2RlIGZvciB0aGUgY3VycmVudCBhbGxvdy1saXN0ZWQgY2hvaWNlcy5cblx0XHQgKlxuXHRcdCAqIFRoZSB2YWx1ZSBpcyBpbnNlcnRlZCB3aXRoIHRleHRDb250ZW50IG9ubHkgYW5kIGlzIG5ldmVyIGV2YWx1YXRlZCBieSB0aGVcblx0XHQgKiBicm93c2VyLiBUaGUgcHJldmlldyBlbmRwb2ludCBpbmRlcGVuZGVudGx5IHZhbGlkYXRlcyBib3RoIGlkZW50aWZpZXJzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGJvb2tpbmdfZm9ybV91c2FnZSBTZWxlY3RlZCBlbnRyeS1wb2ludCBpZGVudGlmaWVyLlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gSW5mb3JtYXRpb25hbCBzaG9ydGNvZGUuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3ByZXZpZXdfc2hvcnRjb2RlKCBib29raW5nX2Zvcm1fdXNhZ2UgKSB7XG5cdFx0XHRyZXR1cm4gJ2FwcG9pbnRtZW50X2Zsb3cnID09PSBib29raW5nX2Zvcm1fdXNhZ2Vcblx0XHRcdFx0PyAnW2Jvb2tpbmdfYXBwb2ludG1lbnQgZm9ybV90eXBlPVwic3RhbmRhcmRcIl0nXG5cdFx0XHRcdDogJ1tib29raW5nIGZvcm1fdHlwZT1cInN0YW5kYXJkXCJdJztcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTeW5jaHJvbml6ZSB0aGUgc2VsZWN0ZWQgdGVtcGxhdGUgbWV0YWRhdGEgYmVsb3cgdGhlIHByZXZpZXcuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fG51bGx9IGNhcmQgU2VsZWN0ZWQgdGVtcGxhdGUgY2FyZC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl9wcmV2aWV3X21ldGFkYXRhKCBjYXJkICkge1xuXHRcdFx0dmFyIHRpdGxlX25vZGUgPSBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10ZW1wbGF0ZS1wcmV2aWV3LXRpdGxlXScgKTtcblx0XHRcdHZhciBzbHVnX25vZGUgPSBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10ZW1wbGF0ZS1wcmV2aWV3LXNsdWddJyApO1xuXHRcdFx0dmFyIHNob3J0Y29kZV9ub2RlID0gZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGVtcGxhdGUtcHJldmlldy1zaG9ydGNvZGVdJyApO1xuXHRcdFx0dmFyIGRlc2NyaXB0aW9uX25vZGUgPSBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10ZW1wbGF0ZS1wcmV2aWV3LWRlc2NyaXB0aW9uXScgKTtcblx0XHRcdHZhciB0aXRsZSA9IGNhcmQgJiYgY2FyZC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10ZW1wbGF0ZS10aXRsZV0nICk7XG5cdFx0XHR2YXIgZGVzY3JpcHRpb24gPSBjYXJkICYmIGNhcmQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGVtcGxhdGUtZGVzY3JpcHRpb25dJyApO1xuXHRcdFx0dmFyIHRlbXBsYXRlX3NsdWcgPSBjYXJkID8gU3RyaW5nKCBjYXJkLmRhdGFzZXQudGVtcGxhdGVTbHVnIHx8ICcnICkgOiAnJztcblxuXHRcdFx0aWYgKCB0aXRsZV9ub2RlICkge1xuXHRcdFx0XHR0aXRsZV9ub2RlLnRleHRDb250ZW50ID0gdGl0bGUgPyB0aXRsZS50ZXh0Q29udGVudC50cmltKCkgOiAnJztcblx0XHRcdH1cblx0XHRcdGlmICggc2x1Z19ub2RlICkge1xuXHRcdFx0XHRzbHVnX25vZGUudGV4dENvbnRlbnQgPSB0ZW1wbGF0ZV9zbHVnO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBzaG9ydGNvZGVfbm9kZSApIHtcblx0XHRcdFx0c2hvcnRjb2RlX25vZGUudGV4dENvbnRlbnQgPSBnZXRfcHJldmlld19zaG9ydGNvZGUoIGdldF9zZWxlY3RlZF9ib29raW5nX2Zvcm1fdXNhZ2UoKSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBkZXNjcmlwdGlvbl9ub2RlICkge1xuXHRcdFx0XHRkZXNjcmlwdGlvbl9ub2RlLnRleHRDb250ZW50ID0gZGVzY3JpcHRpb24gPyBkZXNjcmlwdGlvbi50ZXh0Q29udGVudC50cmltKCkgOiAnJztcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBVcGRhdGUgcHJldmlldyBsb2FkaW5nLCBlcnJvciwgYW5kIGFjdGlvbiBzdGF0ZXMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IGlzX2xvYWRpbmcgV2hldGhlciBhIHByZXZpZXcgcmVxdWVzdC9mcmFtZSBpcyBsb2FkaW5nLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgZXJyb3JfdGV4dCBQbGFpbiBlcnJvciB0ZXh0LCBvciBhbiBlbXB0eSBzdHJpbmcuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRfcHJldmlld19zdGF0ZSggaXNfbG9hZGluZywgZXJyb3JfdGV4dCApIHtcblx0XHRcdHZhciBoYXNfZXJyb3IgPSAnJyAhPT0gU3RyaW5nKCBlcnJvcl90ZXh0IHx8ICcnICk7XG5cblx0XHRcdGVkaXRvci5wcmV2aWV3X3N0YWdlLmNsYXNzTGlzdC50b2dnbGUoICdpcy1sb2FkaW5nJywgaXNfbG9hZGluZyApO1xuXHRcdFx0ZWRpdG9yLnByZXZpZXdfc3RhZ2UuY2xhc3NMaXN0LnRvZ2dsZSggJ2hhcy1lcnJvcicsIGhhc19lcnJvciApO1xuXHRcdFx0ZWRpdG9yLnByZXZpZXdfc3RhZ2Uuc2V0QXR0cmlidXRlKCAnYXJpYS1idXN5JywgaXNfbG9hZGluZyA/ICd0cnVlJyA6ICdmYWxzZScgKTtcblx0XHRcdGVkaXRvci5wcmV2aWV3X2xvYWRlci5oaWRkZW4gPSAhIGlzX2xvYWRpbmc7XG5cdFx0XHRlZGl0b3IucHJldmlld19lcnJvci5oaWRkZW4gPSAhIGhhc19lcnJvcjtcblx0XHRcdGlmICggaGFzX2Vycm9yICkge1xuXHRcdFx0XHRlZGl0b3IucHJldmlld19lcnJvci5xdWVyeVNlbGVjdG9yKCAnc3BhbicgKS50ZXh0Q29udGVudCA9IGVycm9yX3RleHQ7XG5cdFx0XHR9XG5cdFx0XHRlZGl0b3IucmVmcmVzaF9idXR0b24uZGlzYWJsZWQgPSBpc19sb2FkaW5nIHx8ICEgZ2V0X3NlbGVjdGVkX2NhcmQoKTtcblx0XHRcdGVkaXRvci5vcGVuX2J1dHRvbi5kaXNhYmxlZCA9IGlzX2xvYWRpbmcgfHwgb3Blbl9yZXF1ZXN0X2lzX2xvYWRpbmcgfHwgISBnZXRfc2VsZWN0ZWRfY2FyZCgpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENsZWFyIHRoZSBpZnJhbWUncyBhc3NvY2lhdGlvbiB3aXRoIGFuIGVhcmxpZXIgdGVtcGxhdGUgcHJldmlldy5cblx0XHQgKlxuXHRcdCAqIFRoZSBhdHRyaWJ1dGUgaXMgZGlhZ25vc3RpYyBhcyB3ZWxsIGFzIGZ1bmN0aW9uYWw6IGl0IGxldHMgYnJvd3NlciB0ZXN0c1xuXHRcdCAqIHZlcmlmeSB0aGF0IHRoZSB2aXNpYmxlIGlmcmFtZSBiZWxvbmdzIHRvIHRoZSBjdXJyZW50bHkgc2VsZWN0ZWQgY2FyZC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY2xlYXJfcHJldmlld19mcmFtZSgpIHtcblx0XHRcdGVkaXRvci5wcmV2aWV3X2ZyYW1lLnJlbW92ZUF0dHJpYnV0ZSggJ2RhdGEtcHJldmlldy10ZW1wbGF0ZS1zbHVnJyApO1xuXHRcdFx0ZWRpdG9yLnByZXZpZXdfZnJhbWUucmVtb3ZlQXR0cmlidXRlKCAnZGF0YS1wcmV2aWV3LWJvb2tpbmctZm9ybS11c2FnZScgKTtcblx0XHRcdGVkaXRvci5wcmV2aWV3X2ZyYW1lLnNyYyA9ICdhYm91dDpibGFuayc7XG5cdFx0XHRlZGl0b3IucHJldmlld19mcmFtZS5oaWRkZW4gPSB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlY29yZCBvbmUgc3VjY2Vzc2Z1bGx5IHJlbmRlcmVkIHByZXZpZXcuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gcHJldmlld19raW5kICAgICAgSW5saW5lIG9yIFVSTCBwcmV2aWV3IGtpbmQuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHByZXZpZXdfdXJsICAgICAgIFNpZ25lZCBVUkwgd2hlbiBhcHBsaWNhYmxlLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZW1wbGF0ZV9zbHVnICAgICBWYWxpZGF0ZWQgdGVtcGxhdGUgc2x1Zy5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gYm9va2luZ19mb3JtX3VzYWdlIFZhbGlkYXRlZCB1c2FnZSBpZGVudGlmaWVyLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2V0X2N1cnJlbnRfcHJldmlldyggcHJldmlld19raW5kLCBwcmV2aWV3X3VybCwgdGVtcGxhdGVfc2x1ZywgYm9va2luZ19mb3JtX3VzYWdlICkge1xuXHRcdFx0Y3VycmVudF9wcmV2aWV3ID0ge1xuXHRcdFx0XHRraW5kOiBwcmV2aWV3X2tpbmQsXG5cdFx0XHRcdHVybDogcHJldmlld191cmwsXG5cdFx0XHRcdHRlbXBsYXRlX3NsdWc6IHRlbXBsYXRlX3NsdWcsXG5cdFx0XHRcdGJvb2tpbmdfZm9ybV91c2FnZTogYm9va2luZ19mb3JtX3VzYWdlXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIERldGVybWluZSB3aGV0aGVyIHRoZSBjdXJyZW50IHByZXZpZXcgbWF0Y2hlcyB0aGUgc2VsZWN0ZWQgY29udHJvbHMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGVfc2x1ZyAgICAgIFNlbGVjdGVkIHRlbXBsYXRlIHNsdWcuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGJvb2tpbmdfZm9ybV91c2FnZSBTZWxlY3RlZCB1c2FnZSBpZGVudGlmaWVyLlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFdoZXRoZXIgdGhlIGFjdGl2ZSBwcmV2aWV3IGJlbG9uZ3MgdG8gdGhlIHNlbGVjdGlvbi5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjdXJyZW50X3ByZXZpZXdfbWF0Y2hlcyggdGVtcGxhdGVfc2x1ZywgYm9va2luZ19mb3JtX3VzYWdlICkge1xuXHRcdFx0cmV0dXJuIGN1cnJlbnRfcHJldmlldy50ZW1wbGF0ZV9zbHVnID09PSB0ZW1wbGF0ZV9zbHVnICYmIGN1cnJlbnRfcHJldmlldy5ib29raW5nX2Zvcm1fdXNhZ2UgPT09IGJvb2tpbmdfZm9ybV91c2FnZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWFkIGEgbm9ybWFsaXplZCBXb3JkUHJlc3MgQUpBWCBlcnJvciBtZXNzYWdlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R8bnVsbH0gcmVzcG9uc2UgUGFyc2VkIEpTT04gcmVzcG9uc2UuXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfSBQbGFpbiBlcnJvciBtZXNzYWdlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9hamF4X2Vycm9yX21lc3NhZ2UoIHJlc3BvbnNlICkge1xuXHRcdFx0aWYgKCByZXNwb25zZSAmJiByZXNwb25zZS5kYXRhICYmIHJlc3BvbnNlLmRhdGEubWVzc2FnZSApIHtcblx0XHRcdFx0cmV0dXJuIFN0cmluZyggcmVzcG9uc2UuZGF0YS5tZXNzYWdlICk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBnZXRfbWVzc2FnZSggJ3ByZXZpZXdfZXJyb3InLCAnVGhlIGludGVyYWN0aXZlIHByZXZpZXcgY291bGQgbm90IGJlIGxvYWRlZC4gVHJ5IHJlZnJlc2hpbmcgaXQuJyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEJ1aWxkIHRoZSBhdXRoZW50aWNhdGVkIHJlcXVlc3QgYm9keSBmb3Igb25lIHNlcnZlci1vd25lZCBwcmV2aWV3LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHRlbXBsYXRlX3NsdWcgICAgICBTZWxlY3RlZCB0ZW1wbGF0ZSBzbHVnLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBib29raW5nX2Zvcm1fdXNhZ2UgU2VsZWN0ZWQgdXNhZ2UgaWRlbnRpZmllci5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gcHJldmlld190YXJnZXQgICAgIEVtYmVkZGVkIG9yIHdpbmRvdyB0YXJnZXQuXG5cdFx0ICogQHJldHVybiB7Rm9ybURhdGF9IFJlcXVlc3QgYm9keS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBidWlsZF9wcmV2aWV3X3JlcXVlc3RfYm9keSggdGVtcGxhdGVfc2x1ZywgYm9va2luZ19mb3JtX3VzYWdlLCBwcmV2aWV3X3RhcmdldCApIHtcblx0XHRcdHZhciByZXF1ZXN0X2JvZHkgPSBuZXcgd2luZG93LkZvcm1EYXRhKCk7XG5cblx0XHRcdHJlcXVlc3RfYm9keS5hcHBlbmQoICdhY3Rpb24nLCBjb25maWcucHJldmlld19hY3Rpb24gKTtcblx0XHRcdHJlcXVlc3RfYm9keS5hcHBlbmQoICdub25jZScsIGNvbmZpZy5ub25jZSB8fCAnJyApO1xuXHRcdFx0cmVxdWVzdF9ib2R5LmFwcGVuZCggJ3RlbXBsYXRlX3NsdWcnLCB0ZW1wbGF0ZV9zbHVnICk7XG5cdFx0XHRyZXF1ZXN0X2JvZHkuYXBwZW5kKCAnYm9va2luZ19mb3JtX3VzYWdlJywgYm9va2luZ19mb3JtX3VzYWdlICk7XG5cdFx0XHRyZXF1ZXN0X2JvZHkuYXBwZW5kKCAncHJldmlld190YXJnZXQnLCBwcmV2aWV3X3RhcmdldCApO1xuXG5cdFx0XHRyZXR1cm4gcmVxdWVzdF9ib2R5O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENvbmZpcm0gdGhhdCBhIHJlc3BvbnNlIGJlbG9uZ3MgdG8gdGhlIGN1cnJlbnQgc2VydmVyLXZhbGlkYXRlZCBzZWxlY3Rpb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcmVzcG9uc2UgICAgICAgICAgICBXb3JkUHJlc3MgQUpBWCByZXNwb25zZS5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGVfc2x1ZyAgICAgICBSZXF1ZXN0ZWQgdGVtcGxhdGUgc2x1Zy5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gYm9va2luZ19mb3JtX3VzYWdlICBSZXF1ZXN0ZWQgdXNhZ2UgaWRlbnRpZmllci5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gcHJldmlld190YXJnZXQgICAgICBSZXF1ZXN0ZWQgcHJldmlldyB0YXJnZXQuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fSBWYWxpZGF0ZWQgcmVzcG9uc2UgZGF0YS5cblx0XHQgKiBAdGhyb3dzIHtFcnJvcn0gV2hlbiByZXNwb25zZSBvd25lcnNoaXAgb3Igc2hhcGUgaXMgaW52YWxpZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiB2YWxpZGF0ZV9wcmV2aWV3X3Jlc3BvbnNlKCByZXNwb25zZSwgdGVtcGxhdGVfc2x1ZywgYm9va2luZ19mb3JtX3VzYWdlLCBwcmV2aWV3X3RhcmdldCApIHtcblx0XHRcdHZhciByZXNwb25zZV9kYXRhO1xuXHRcdFx0dmFyIHNlbGVjdGVkX2NhcmQgPSBnZXRfc2VsZWN0ZWRfY2FyZCgpO1xuXG5cdFx0XHRpZiAoICEgcmVzcG9uc2UgfHwgISByZXNwb25zZS5zdWNjZXNzIHx8ICEgcmVzcG9uc2UuZGF0YSApIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCBnZXRfYWpheF9lcnJvcl9tZXNzYWdlKCByZXNwb25zZSApICk7XG5cdFx0XHR9XG5cblx0XHRcdHJlc3BvbnNlX2RhdGEgPSByZXNwb25zZS5kYXRhO1xuXHRcdFx0aWYgKFxuXHRcdFx0XHRTdHJpbmcoIHJlc3BvbnNlX2RhdGEudGVtcGxhdGVfc2x1ZyB8fCAnJyApICE9PSB0ZW1wbGF0ZV9zbHVnIHx8XG5cdFx0XHRcdFN0cmluZyggcmVzcG9uc2VfZGF0YS5ib29raW5nX2Zvcm1fdXNhZ2UgfHwgJycgKSAhPT0gYm9va2luZ19mb3JtX3VzYWdlIHx8XG5cdFx0XHRcdFN0cmluZyggcmVzcG9uc2VfZGF0YS5wcmV2aWV3X3RhcmdldCB8fCAnJyApICE9PSBwcmV2aWV3X3RhcmdldCB8fFxuXHRcdFx0XHQhIHNlbGVjdGVkX2NhcmQgfHxcblx0XHRcdFx0U3RyaW5nKCBzZWxlY3RlZF9jYXJkLmRhdGFzZXQudGVtcGxhdGVTbHVnIHx8ICcnICkgIT09IHRlbXBsYXRlX3NsdWcgfHxcblx0XHRcdFx0Z2V0X3NlbGVjdGVkX2Jvb2tpbmdfZm9ybV91c2FnZSgpICE9PSBib29raW5nX2Zvcm1fdXNhZ2Vcblx0XHRcdCkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoIGdldF9tZXNzYWdlKCAncHJldmlld19lcnJvcicsICdUaGUgaW50ZXJhY3RpdmUgcHJldmlldyBjb3VsZCBub3QgYmUgbG9hZGVkLiBUcnkgcmVmcmVzaGluZyBpdC4nICkgKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHJlc3BvbnNlX2RhdGE7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVxdWVzdCBhbmQgcmVuZGVyIHRoZSBzZWxlY3RlZCBhbGxvdy1saXN0ZWQgdGVtcGxhdGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fG51bGx9IGNhcmQgU2VsZWN0ZWQgdGVtcGxhdGUgY2FyZC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGxvYWRfcHJldmlldyggY2FyZCApIHtcblx0XHRcdHZhciB0ZW1wbGF0ZV9zbHVnID0gY2FyZCA/IFN0cmluZyggY2FyZC5kYXRhc2V0LnRlbXBsYXRlU2x1ZyB8fCAnJyApIDogJyc7XG5cdFx0XHR2YXIgYm9va2luZ19mb3JtX3VzYWdlID0gZ2V0X3NlbGVjdGVkX2Jvb2tpbmdfZm9ybV91c2FnZSgpO1xuXHRcdFx0dmFyIHJlcXVlc3Rfc2VxdWVuY2U7XG5cdFx0XHR2YXIgcmVxdWVzdF9ib2R5O1xuXG5cdFx0XHRpZiAoICEgdGVtcGxhdGVfc2x1ZyB8fCAhIGJvb2tpbmdfZm9ybV91c2FnZSB8fCAhIGNvbmZpZy5hamF4X3VybCB8fCAhIGNvbmZpZy5wcmV2aWV3X2FjdGlvbiApIHtcblx0XHRcdFx0c2V0X3ByZXZpZXdfc3RhdGUoIGZhbHNlLCBnZXRfbWVzc2FnZSggJ3ByZXZpZXdfZXJyb3InLCAnVGhlIGludGVyYWN0aXZlIHByZXZpZXcgY291bGQgbm90IGJlIGxvYWRlZC4gVHJ5IHJlZnJlc2hpbmcgaXQuJyApICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCBwcmV2aWV3X2Fib3J0X2NvbnRyb2xsZXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHByZXZpZXdfYWJvcnRfY29udHJvbGxlci5hYm9ydCApIHtcblx0XHRcdFx0cHJldmlld19hYm9ydF9jb250cm9sbGVyLmFib3J0KCk7XG5cdFx0XHR9XG5cdFx0XHRwcmV2aWV3X2Fib3J0X2NvbnRyb2xsZXIgPSAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LkFib3J0Q29udHJvbGxlciA/IG5ldyB3aW5kb3cuQWJvcnRDb250cm9sbGVyKCkgOiBudWxsO1xuXHRcdFx0cmVxdWVzdF9zZXF1ZW5jZSA9ICsrcHJldmlld19yZXF1ZXN0X3NlcXVlbmNlO1xuXHRcdFx0cmVxdWVzdF9ib2R5ID0gYnVpbGRfcHJldmlld19yZXF1ZXN0X2JvZHkoIHRlbXBsYXRlX3NsdWcsIGJvb2tpbmdfZm9ybV91c2FnZSwgJ2VtYmVkZGVkJyApO1xuXG5cdFx0XHRzZXRfcHJldmlld19zdGF0ZSggdHJ1ZSwgJycgKTtcblxuXHRcdFx0d2luZG93LmZldGNoKCBjb25maWcuYWpheF91cmwsIHtcblx0XHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRcdGJvZHk6IHJlcXVlc3RfYm9keSxcblx0XHRcdFx0Y3JlZGVudGlhbHM6ICdzYW1lLW9yaWdpbicsXG5cdFx0XHRcdHNpZ25hbDogcHJldmlld19hYm9ydF9jb250cm9sbGVyID8gcHJldmlld19hYm9ydF9jb250cm9sbGVyLnNpZ25hbCA6IHVuZGVmaW5lZFxuXHRcdFx0fSApLnRoZW4oIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRcdHJldHVybiByZXNwb25zZS5qc29uKCk7XG5cdFx0XHR9ICkudGhlbiggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdFx0dmFyIHJlc3BvbnNlX2RhdGE7XG5cdFx0XHRcdHZhciBwcmV2aWV3X2tpbmQ7XG5cdFx0XHRcdHZhciBwcmV2aWV3X3VybDtcblxuXHRcdFx0XHRpZiAoIHJlcXVlc3Rfc2VxdWVuY2UgIT09IHByZXZpZXdfcmVxdWVzdF9zZXF1ZW5jZSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXNwb25zZV9kYXRhID0gdmFsaWRhdGVfcHJldmlld19yZXNwb25zZSggcmVzcG9uc2UsIHRlbXBsYXRlX3NsdWcsIGJvb2tpbmdfZm9ybV91c2FnZSwgJ2VtYmVkZGVkJyApO1xuXHRcdFx0XHRwcmV2aWV3X2tpbmQgPSBTdHJpbmcoIHJlc3BvbnNlX2RhdGEucHJldmlld19raW5kIHx8ICcnICk7XG5cblx0XHRcdFx0aWYgKFxuXHRcdFx0XHRcdCdpbmxpbmUnID09PSBwcmV2aWV3X2tpbmQgJiZcblx0XHRcdFx0XHRyZXNwb25zZV9kYXRhLmh0bWwgJiZcblx0XHRcdFx0XHRyZXNwb25zZV9kYXRhLmJvb3RzdHJhcCAmJlxuXHRcdFx0XHRcdCdvYmplY3QnID09PSB0eXBlb2YgcmVzcG9uc2VfZGF0YS5ib290c3RyYXAgJiZcblx0XHRcdFx0XHRpbmxpbmVfcHJldmlld19yZW5kZXJlclxuXHRcdFx0XHQpIHtcblx0XHRcdFx0XHRyZXR1cm4gaW5saW5lX3ByZXZpZXdfcmVuZGVyZXIucmVwbGFjZSggU3RyaW5nKCByZXNwb25zZV9kYXRhLmh0bWwgKSwgcmVzcG9uc2VfZGF0YS5ib290c3RyYXAsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdHJldHVybiByZXF1ZXN0X3NlcXVlbmNlID09PSBwcmV2aWV3X3JlcXVlc3Rfc2VxdWVuY2U7XG5cdFx0XHRcdFx0fSApLnRoZW4oIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdGlmICggcmVxdWVzdF9zZXF1ZW5jZSAhPT0gcHJldmlld19yZXF1ZXN0X3NlcXVlbmNlICkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjbGVhcl9wcmV2aWV3X2ZyYW1lKCk7XG5cdFx0XHRcdFx0XHRlZGl0b3IuaW5saW5lX3ByZXZpZXcuaGlkZGVuID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRzZXRfY3VycmVudF9wcmV2aWV3KCAnaW5saW5lJywgJycsIHRlbXBsYXRlX3NsdWcsIGJvb2tpbmdfZm9ybV91c2FnZSApO1xuXHRcdFx0XHRcdFx0c2V0X3ByZXZpZXdfc3RhdGUoIGZhbHNlLCAnJyApO1xuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICggJ3VybCcgIT09IHByZXZpZXdfa2luZCB8fCAhIHJlc3BvbnNlX2RhdGEucHJldmlld191cmwgKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCBnZXRfbWVzc2FnZSggJ3ByZXZpZXdfZXJyb3InLCAnVGhlIGludGVyYWN0aXZlIHByZXZpZXcgY291bGQgbm90IGJlIGxvYWRlZC4gVHJ5IHJlZnJlc2hpbmcgaXQuJyApICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRwcmV2aWV3X3VybCA9IFN0cmluZyggcmVzcG9uc2VfZGF0YS5wcmV2aWV3X3VybCApO1xuXHRcdFx0XHRlZGl0b3IucHJldmlld19mcmFtZS5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0aWYgKCByZXF1ZXN0X3NlcXVlbmNlICE9PSBwcmV2aWV3X3JlcXVlc3Rfc2VxdWVuY2UgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVkaXRvci5pbmxpbmVfcHJldmlldy5oaWRkZW4gPSB0cnVlO1xuXHRcdFx0XHRcdGVkaXRvci5wcmV2aWV3X2ZyYW1lLmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0XHRcdHNldF9jdXJyZW50X3ByZXZpZXcoICd1cmwnLCBwcmV2aWV3X3VybCwgdGVtcGxhdGVfc2x1ZywgYm9va2luZ19mb3JtX3VzYWdlICk7XG5cdFx0XHRcdFx0c2V0X3ByZXZpZXdfc3RhdGUoIGZhbHNlLCAnJyApO1xuXHRcdFx0XHR9O1xuXHRcdFx0XHRlZGl0b3IucHJldmlld19mcmFtZS5zZXRBdHRyaWJ1dGUoICdkYXRhLXByZXZpZXctdGVtcGxhdGUtc2x1ZycsIHRlbXBsYXRlX3NsdWcgKTtcblx0XHRcdFx0ZWRpdG9yLnByZXZpZXdfZnJhbWUuc2V0QXR0cmlidXRlKCAnZGF0YS1wcmV2aWV3LWJvb2tpbmctZm9ybS11c2FnZScsIGJvb2tpbmdfZm9ybV91c2FnZSApO1xuXHRcdFx0XHRlZGl0b3IucHJldmlld19mcmFtZS5zcmMgPSBwcmV2aWV3X3VybDtcblx0XHRcdH0gKS5jYXRjaCggZnVuY3Rpb24gKCBlcnJvciApIHtcblx0XHRcdFx0aWYgKCBlcnJvciAmJiAnQWJvcnRFcnJvcicgPT09IGVycm9yLm5hbWUgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggcmVxdWVzdF9zZXF1ZW5jZSAhPT0gcHJldmlld19yZXF1ZXN0X3NlcXVlbmNlICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRzZXRfcHJldmlld19zdGF0ZSggZmFsc2UsIGVycm9yICYmIGVycm9yLm1lc3NhZ2UgPyBlcnJvci5tZXNzYWdlIDogZ2V0X21lc3NhZ2UoICdwcmV2aWV3X2Vycm9yJywgJ1RoZSBpbnRlcmFjdGl2ZSBwcmV2aWV3IGNvdWxkIG5vdCBiZSBsb2FkZWQuIFRyeSByZWZyZXNoaW5nIGl0LicgKSApO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE9wZW4gdGhlIGZ1bGwtc2l0ZSBwcmV2aWV3LCBsYXppbHkgY3JlYXRpbmcgYSBzaWduZWQgc2Vzc2lvbiB3aGVuIG5lZWRlZC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8bnVsbH0gY2FyZCBTZWxlY3RlZCB0ZW1wbGF0ZSBjYXJkLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gb3Blbl9wcmV2aWV3KCBjYXJkICkge1xuXHRcdFx0dmFyIHRlbXBsYXRlX3NsdWcgPSBjYXJkID8gU3RyaW5nKCBjYXJkLmRhdGFzZXQudGVtcGxhdGVTbHVnIHx8ICcnICkgOiAnJztcblx0XHRcdHZhciBib29raW5nX2Zvcm1fdXNhZ2UgPSBnZXRfc2VsZWN0ZWRfYm9va2luZ19mb3JtX3VzYWdlKCk7XG5cdFx0XHR2YXIgcHJldmlld193aW5kb3c7XG5cdFx0XHR2YXIgcmVxdWVzdF9zZXF1ZW5jZTtcblxuXHRcdFx0aWYgKCAhIHRlbXBsYXRlX3NsdWcgfHwgISBib29raW5nX2Zvcm1fdXNhZ2UgfHwgZWRpdG9yLm9wZW5fYnV0dG9uLmRpc2FibGVkICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICggY3VycmVudF9wcmV2aWV3X21hdGNoZXMoIHRlbXBsYXRlX3NsdWcsIGJvb2tpbmdfZm9ybV91c2FnZSApICYmIGN1cnJlbnRfcHJldmlldy51cmwgKSB7XG5cdFx0XHRcdHdpbmRvdy5vcGVuKCBjdXJyZW50X3ByZXZpZXcudXJsLCAnX2JsYW5rJywgJ25vb3BlbmVyLG5vcmVmZXJyZXInICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0cHJldmlld193aW5kb3cgPSB3aW5kb3cub3BlbiggJycsICdfYmxhbmsnICk7XG5cdFx0XHRpZiAoICEgcHJldmlld193aW5kb3cgKSB7XG5cdFx0XHRcdHNldF9wcmV2aWV3X3N0YXRlKCBmYWxzZSwgZ2V0X21lc3NhZ2UoICdwcmV2aWV3X29wZW5fZXJyb3InLCAnVGhlIGZ1bGwtc2l0ZSBwcmV2aWV3IGNvdWxkIG5vdCBiZSBvcGVuZWQuIFRyeSBhZ2Fpbi4nICkgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cHJldmlld193aW5kb3cub3BlbmVyID0gbnVsbDtcblxuXHRcdFx0aWYgKCBvcGVuX2Fib3J0X2NvbnRyb2xsZXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIG9wZW5fYWJvcnRfY29udHJvbGxlci5hYm9ydCApIHtcblx0XHRcdFx0b3Blbl9hYm9ydF9jb250cm9sbGVyLmFib3J0KCk7XG5cdFx0XHR9XG5cdFx0XHRvcGVuX2Fib3J0X2NvbnRyb2xsZXIgPSAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LkFib3J0Q29udHJvbGxlciA/IG5ldyB3aW5kb3cuQWJvcnRDb250cm9sbGVyKCkgOiBudWxsO1xuXHRcdFx0cmVxdWVzdF9zZXF1ZW5jZSA9ICsrb3Blbl9yZXF1ZXN0X3NlcXVlbmNlO1xuXHRcdFx0b3Blbl9yZXF1ZXN0X2lzX2xvYWRpbmcgPSB0cnVlO1xuXHRcdFx0ZWRpdG9yLm9wZW5fYnV0dG9uLmRpc2FibGVkID0gdHJ1ZTtcblxuXHRcdFx0d2luZG93LmZldGNoKCBjb25maWcuYWpheF91cmwsIHtcblx0XHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRcdGJvZHk6IGJ1aWxkX3ByZXZpZXdfcmVxdWVzdF9ib2R5KCB0ZW1wbGF0ZV9zbHVnLCBib29raW5nX2Zvcm1fdXNhZ2UsICd3aW5kb3cnICksXG5cdFx0XHRcdGNyZWRlbnRpYWxzOiAnc2FtZS1vcmlnaW4nLFxuXHRcdFx0XHRzaWduYWw6IG9wZW5fYWJvcnRfY29udHJvbGxlciA/IG9wZW5fYWJvcnRfY29udHJvbGxlci5zaWduYWwgOiB1bmRlZmluZWRcblx0XHRcdH0gKS50aGVuKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0XHRyZXR1cm4gcmVzcG9uc2UuanNvbigpO1xuXHRcdFx0fSApLnRoZW4oIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRcdHZhciByZXNwb25zZV9kYXRhO1xuXG5cdFx0XHRcdGlmICggcmVxdWVzdF9zZXF1ZW5jZSAhPT0gb3Blbl9yZXF1ZXN0X3NlcXVlbmNlICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXNwb25zZV9kYXRhID0gdmFsaWRhdGVfcHJldmlld19yZXNwb25zZSggcmVzcG9uc2UsIHRlbXBsYXRlX3NsdWcsIGJvb2tpbmdfZm9ybV91c2FnZSwgJ3dpbmRvdycgKTtcblx0XHRcdFx0aWYgKCAndXJsJyAhPT0gU3RyaW5nKCByZXNwb25zZV9kYXRhLnByZXZpZXdfa2luZCB8fCAnJyApIHx8ICEgcmVzcG9uc2VfZGF0YS5wcmV2aWV3X3VybCApIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoIGdldF9tZXNzYWdlKCAncHJldmlld19vcGVuX2Vycm9yJywgJ1RoZSBmdWxsLXNpdGUgcHJldmlldyBjb3VsZCBub3QgYmUgb3BlbmVkLiBUcnkgYWdhaW4uJyApICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRwcmV2aWV3X3dpbmRvdy5sb2NhdGlvbi5yZXBsYWNlKCBTdHJpbmcoIHJlc3BvbnNlX2RhdGEucHJldmlld191cmwgKSApO1xuXHRcdFx0fSApLmNhdGNoKCBmdW5jdGlvbiAoIGVycm9yICkge1xuXHRcdFx0XHRpZiAoIGVycm9yICYmICdBYm9ydEVycm9yJyA9PT0gZXJyb3IubmFtZSApIHtcblx0XHRcdFx0XHRwcmV2aWV3X3dpbmRvdy5jbG9zZSgpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHJlcXVlc3Rfc2VxdWVuY2UgIT09IG9wZW5fcmVxdWVzdF9zZXF1ZW5jZSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cHJldmlld193aW5kb3cuY2xvc2UoKTtcblx0XHRcdFx0c2V0X3ByZXZpZXdfc3RhdGUoIGZhbHNlLCBlcnJvciAmJiBlcnJvci5tZXNzYWdlID8gZXJyb3IubWVzc2FnZSA6IGdldF9tZXNzYWdlKCAncHJldmlld19vcGVuX2Vycm9yJywgJ1RoZSBmdWxsLXNpdGUgcHJldmlldyBjb3VsZCBub3QgYmUgb3BlbmVkLiBUcnkgYWdhaW4uJyApICk7XG5cdFx0XHR9ICkudGhlbiggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRpZiAoIHJlcXVlc3Rfc2VxdWVuY2UgPT09IG9wZW5fcmVxdWVzdF9zZXF1ZW5jZSApIHtcblx0XHRcdFx0XHRvcGVuX3JlcXVlc3RfaXNfbG9hZGluZyA9IGZhbHNlO1xuXHRcdFx0XHRcdGVkaXRvci5vcGVuX2J1dHRvbi5kaXNhYmxlZCA9ICEgZ2V0X3NlbGVjdGVkX2NhcmQoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFNlbGVjdCBvbmUgY2FyZCBhbmQgbG9hZCBpdHMgcmVhbCBwcmV2aWV3LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gY2FyZCAgICAgICAgIFRlbXBsYXRlIGNhcmQuXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSAgICAgbG9hZF9zZWxlY3RlZCBXaGV0aGVyIHRvIHJlcXVlc3QgYSByZXBsYWNlbWVudCBwcmV2aWV3LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2VsZWN0X2NhcmQoIGNhcmQsIGxvYWRfc2VsZWN0ZWQgKSB7XG5cdFx0XHR2YXIgcmFkaW8gPSBjYXJkICYmIGNhcmQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGVtcGxhdGUtcmFkaW9dJyApO1xuXG5cdFx0XHRpZiAoICEgcmFkaW8gKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0cmFkaW8uY2hlY2tlZCA9IHRydWU7XG5cdFx0XHRlZGl0b3IuY2FyZHMuZm9yRWFjaCggZnVuY3Rpb24gKCB0ZW1wbGF0ZV9jYXJkICkge1xuXHRcdFx0XHR0ZW1wbGF0ZV9jYXJkLmNsYXNzTGlzdC50b2dnbGUoICdpcy1zZWxlY3RlZCcsIHRlbXBsYXRlX2NhcmQgPT09IGNhcmQgKTtcblx0XHRcdH0gKTtcblx0XHRcdHNoZWxsX2FwaS5jbGVhcl9maWVsZF9lcnJvciggJ2Jvb2tpbmdfZm9ybV90ZW1wbGF0ZScgKTtcblx0XHRcdHJlbmRlcl9wcmV2aWV3X21ldGFkYXRhKCBjYXJkICk7XG5cdFx0XHRpZiAoIGZhbHNlICE9PSBsb2FkX3NlbGVjdGVkICkge1xuXHRcdFx0XHRsb2FkX3ByZXZpZXcoIGNhcmQgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gY2FyZHMgbWF0Y2hpbmcgdGhlIGN1cnJlbnQgc2VhcmNoIGFuZCBjYXRlZ29yeS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge0hUTUxFbGVtZW50W119IE1hdGNoaW5nIGNhcmRzIGluIHNlcnZlciBvcmRlci5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfbWF0Y2hpbmdfY2FyZHMoKSB7XG5cdFx0XHR2YXIgcXVlcnkgPSBub3JtYWxpemVfc2VhcmNoX3RleHQoIGVkaXRvci5zZWFyY2ggPyBlZGl0b3Iuc2VhcmNoLnZhbHVlLnRyaW0oKSA6ICcnICk7XG5cblx0XHRcdHJldHVybiBlZGl0b3IuY2FyZHMuZmlsdGVyKCBmdW5jdGlvbiAoIGNhcmQgKSB7XG5cdFx0XHRcdHZhciBtYXRjaGVzX2ZpbHRlciA9ICdhbGwnID09PSBlZGl0b3IuYWN0aXZlX2ZpbHRlciB8fFxuXHRcdFx0XHRcdCggJ3JlY29tbWVuZGVkJyA9PT0gZWRpdG9yLmFjdGl2ZV9maWx0ZXIgJiYgJ3RydWUnID09PSBjYXJkLmRhdGFzZXQudGVtcGxhdGVSZWNvbW1lbmRlZCApIHx8XG5cdFx0XHRcdFx0ZWRpdG9yLmFjdGl2ZV9maWx0ZXIgPT09IGNhcmQuZGF0YXNldC50ZW1wbGF0ZUNhdGVnb3J5O1xuXHRcdFx0XHR2YXIgbWF0Y2hlc19zZWFyY2ggPSAhIHF1ZXJ5IHx8IC0xICE9PSBnZXRfY2FyZF9zZWFyY2hfdGV4dCggY2FyZCApLmluZGV4T2YoIHF1ZXJ5ICk7XG5cblx0XHRcdFx0cmV0dXJuIG1hdGNoZXNfZmlsdGVyICYmIG1hdGNoZXNfc2VhcmNoO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbmRlciBldmVyeSBjYXJkIG1hdGNoaW5nIHRoZSBjdXJyZW50IHNlYXJjaCBhbmQgY2F0ZWdvcnkuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl9jYXRhbG9nKCkge1xuXHRcdFx0dmFyIG1hdGNoaW5nX2NhcmRzID0gZ2V0X21hdGNoaW5nX2NhcmRzKCk7XG5cblx0XHRcdGVkaXRvci5jYXJkcy5mb3JFYWNoKCBmdW5jdGlvbiAoIGNhcmQgKSB7XG5cdFx0XHRcdGNhcmQuaGlkZGVuID0gdHJ1ZTtcblx0XHRcdH0gKTtcblx0XHRcdG1hdGNoaW5nX2NhcmRzLmZvckVhY2goIGZ1bmN0aW9uICggY2FyZCApIHtcblx0XHRcdFx0Y2FyZC5oaWRkZW4gPSBmYWxzZTtcblx0XHRcdH0gKTtcblxuXHRcdFx0ZWRpdG9yLmVtcHR5LmhpZGRlbiA9IDAgIT09IG1hdGNoaW5nX2NhcmRzLmxlbmd0aDtcblx0XHRcdGVkaXRvci5lbXB0eS50ZXh0Q29udGVudCA9IGdldF9tZXNzYWdlKCAnbm9fbWF0Y2hpbmdfdGVtcGxhdGVzJywgJ05vIHRlbXBsYXRlcyBtYXRjaCB0aGlzIHNlYXJjaCBhbmQgZmlsdGVyLicgKTtcblx0XHRcdGVkaXRvci5ncmlkLnNjcm9sbExlZnQgPSAwO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFjdGl2YXRlIG9uZSBjYXRlZ29yeSB0YWIgYW5kIHJlZnJlc2ggdGhlIHZpc2libGUgY2FyZHMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSB0YWIgRmlsdGVyIHRhYiBidXR0b24uXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBhY3RpdmF0ZV9maWx0ZXIoIHRhYiApIHtcblx0XHRcdGlmICggISB0YWIgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0ZWRpdG9yLmFjdGl2ZV9maWx0ZXIgPSB0YWIuZGF0YXNldC53cGJjVGVtcGxhdGVGaWx0ZXIgfHwgJ2FsbCc7XG5cdFx0XHRlZGl0b3IudGFicy5mb3JFYWNoKCBmdW5jdGlvbiAoIGZpbHRlcl90YWIgKSB7XG5cdFx0XHRcdHZhciBpc19hY3RpdmUgPSBmaWx0ZXJfdGFiID09PSB0YWI7XG5cdFx0XHRcdGZpbHRlcl90YWIuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWFjdGl2ZScsIGlzX2FjdGl2ZSApO1xuXHRcdFx0XHRmaWx0ZXJfdGFiLnNldEF0dHJpYnV0ZSggJ2FyaWEtc2VsZWN0ZWQnLCBpc19hY3RpdmUgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0XHRcdGZpbHRlcl90YWIudGFiSW5kZXggPSBpc19hY3RpdmUgPyAwIDogLTE7XG5cdFx0XHR9ICk7XG5cdFx0XHRlZGl0b3IuZ3JpZC5zZXRBdHRyaWJ1dGUoICdhcmlhLWxhYmVsbGVkYnknLCB0YWIuaWQgKTtcblx0XHRcdHJlbmRlcl9jYXRhbG9nKCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBmaWx0ZXIgdGFiIHdpdGggdGhlIHJlcXVlc3RlZCBzdGFibGUgSUQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gZmlsdGVyX2lkIFN0YWJsZSBmaWx0ZXIgSUQuXG5cdFx0ICogQHJldHVybiB7SFRNTEVsZW1lbnR8bnVsbH0gTWF0Y2hpbmcgdGFiLCBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9maWx0ZXJfdGFiKCBmaWx0ZXJfaWQgKSB7XG5cdFx0XHRyZXR1cm4gZWRpdG9yLnRhYnMuZmluZCggZnVuY3Rpb24gKCB0YWIgKSB7XG5cdFx0XHRcdHJldHVybiBmaWx0ZXJfaWQgPT09IHRhYi5kYXRhc2V0LndwYmNUZW1wbGF0ZUZpbHRlcjtcblx0XHRcdH0gKSB8fCBudWxsO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFwcGx5IHRleHQtc2VhcmNoIGNoYW5nZXMgaW1tZWRpYXRlbHkuXG5cdFx0ICpcblx0XHQgKiBUZXh0IHNlYXJjaCBpbnRlbnRpb25hbGx5IHN3aXRjaGVzIHRvIEFsbCB0ZW1wbGF0ZXMuIE90aGVyd2lzZSBhIHZhbGlkXG5cdFx0ICogbWF0Y2ggc3VjaCBhcyBhIEZ1bGwgRGF5cyBvciBjb250YWN0IHRlbXBsYXRlIGNhbiByZW1haW4gaGlkZGVuIG1lcmVseVxuXHRcdCAqIGJlY2F1c2UgdGhlIFJlY29tbWVuZGVkIHRhYiB3YXMgYWN0aXZlIGJlZm9yZSB0aGUgdXNlciBzdGFydGVkIHR5cGluZy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX3NlYXJjaF9jaGFuZ2UoKSB7XG5cdFx0XHR2YXIgcXVlcnkgPSBub3JtYWxpemVfc2VhcmNoX3RleHQoIGVkaXRvci5zZWFyY2ggPyBlZGl0b3Iuc2VhcmNoLnZhbHVlLnRyaW0oKSA6ICcnICk7XG5cdFx0XHR2YXIgYWxsX3RlbXBsYXRlc190YWIgPSBnZXRfZmlsdGVyX3RhYiggJ2FsbCcgKTtcblxuXHRcdFx0aWYgKCBxdWVyeSAmJiBhbGxfdGVtcGxhdGVzX3RhYiAmJiAnYWxsJyAhPT0gZWRpdG9yLmFjdGl2ZV9maWx0ZXIgKSB7XG5cdFx0XHRcdGFjdGl2YXRlX2ZpbHRlciggYWxsX3RlbXBsYXRlc190YWIgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRyZW5kZXJfY2F0YWxvZygpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEhhbmRsZSBzZWxlY3RvciBhbmQgcHJldmlldyBhY3Rpb25zLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtNb3VzZUV2ZW50fSBldmVudCBDbGljayBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9jbGljayggZXZlbnQgKSB7XG5cdFx0XHR2YXIgZmlsdGVyID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXRlbXBsYXRlLWZpbHRlcl0nICk7XG5cdFx0XHR2YXIgcmVmcmVzaF9idXR0b24gPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGVtcGxhdGUtcmVmcmVzaF0nICk7XG5cdFx0XHR2YXIgb3Blbl9saW5rID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXRlbXBsYXRlLW9wZW4tcHJldmlld10nICk7XG5cdFx0XHR2YXIgdGVtcGxhdGVfY2FyZCA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10ZW1wbGF0ZS1jYXJkXScgKTtcblx0XHRcdHZhciB0ZW1wbGF0ZV9yYWRpbztcblxuXHRcdFx0aWYgKCBmaWx0ZXIgKSB7XG5cdFx0XHRcdGFjdGl2YXRlX2ZpbHRlciggZmlsdGVyICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggcmVmcmVzaF9idXR0b24gKSB7XG5cdFx0XHRcdGxvYWRfcHJldmlldyggZ2V0X3NlbGVjdGVkX2NhcmQoKSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIG9wZW5fbGluayApIHtcblx0XHRcdFx0b3Blbl9wcmV2aWV3KCBnZXRfc2VsZWN0ZWRfY2FyZCgpICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggdGVtcGxhdGVfY2FyZCApIHtcblx0XHRcdFx0dGVtcGxhdGVfcmFkaW8gPSB0ZW1wbGF0ZV9jYXJkLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRlbXBsYXRlLXJhZGlvXScgKTtcblx0XHRcdFx0aWYgKCB0ZW1wbGF0ZV9yYWRpbyAmJiAhIHRlbXBsYXRlX3JhZGlvLmNoZWNrZWQgKSB7XG5cdFx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0XHRzZWxlY3RfY2FyZCggdGVtcGxhdGVfY2FyZCwgdHJ1ZSApO1xuXHRcdFx0XHRcdHRlbXBsYXRlX3JhZGlvLmZvY3VzKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFN5bmNocm9uaXplIG9uZSBlbnRyeS1wb2ludCBjaG9pY2Ugd2l0aCBpdHMgbmF0aXZlIHJhZGlvIGFuZCBjYXJkLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGJvb2tpbmdfZm9ybV91c2FnZSBTdGFibGUgZW50cnktcG9pbnQgaWRlbnRpZmllci5cblx0XHQgKiBAcmV0dXJuIHtIVE1MSW5wdXRFbGVtZW50fG51bGx9IE1hdGNoaW5nIHJhZGlvIGNvbnRyb2wsIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2VsZWN0X2Jvb2tpbmdfZm9ybV91c2FnZSggYm9va2luZ19mb3JtX3VzYWdlICkge1xuXHRcdFx0dmFyIHNlbGVjdGVkX3JhZGlvID0gbnVsbDtcblxuXHRcdFx0QXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoIGVkaXRvci5ub2RlLnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLWJvb2tpbmctZm9ybS11c2FnZS1yYWRpb10nICkgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHVzYWdlX3JhZGlvICkge1xuXHRcdFx0XHR2YXIgaXNfc2VsZWN0ZWQgPSBib29raW5nX2Zvcm1fdXNhZ2UgPT09IFN0cmluZyggdXNhZ2VfcmFkaW8udmFsdWUgfHwgJycgKTtcblxuXHRcdFx0XHR1c2FnZV9yYWRpby5jaGVja2VkID0gaXNfc2VsZWN0ZWQ7XG5cdFx0XHRcdHVzYWdlX3JhZGlvLmNsb3Nlc3QoICcud3BiY19zZXR1cF93aXphcmRfX2Jvb2tpbmctZm9ybS11c2FnZS1vcHRpb24nICkuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLXNlbGVjdGVkJywgaXNfc2VsZWN0ZWQgKTtcblx0XHRcdFx0aWYgKCBpc19zZWxlY3RlZCApIHtcblx0XHRcdFx0XHRzZWxlY3RlZF9yYWRpbyA9IHVzYWdlX3JhZGlvO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cblx0XHRcdHJldHVybiBzZWxlY3RlZF9yYWRpbztcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDb21taXQgYW4gZXhwbGFpbmVkIGVudHJ5LXBvaW50IGNob2ljZSBhbmQgcmVmcmVzaCBpdHMgcHJldmlldy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBib29raW5nX2Zvcm1fdXNhZ2UgU3RhYmxlIGVudHJ5LXBvaW50IGlkZW50aWZpZXIuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjb21taXRfYm9va2luZ19mb3JtX3VzYWdlKCBib29raW5nX2Zvcm1fdXNhZ2UgKSB7XG5cdFx0XHRpZiAoICEgc2VsZWN0X2Jvb2tpbmdfZm9ybV91c2FnZSggYm9va2luZ19mb3JtX3VzYWdlICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uZmlybWVkX2Jvb2tpbmdfZm9ybV91c2FnZSA9IGJvb2tpbmdfZm9ybV91c2FnZTtcblx0XHRcdHNoZWxsX2FwaS5jbGVhcl9maWVsZF9lcnJvciggJ2Jvb2tpbmdfZm9ybV91c2FnZScgKTtcblx0XHRcdHJlbmRlcl9wcmV2aWV3X21ldGFkYXRhKCBnZXRfc2VsZWN0ZWRfY2FyZCgpICk7XG5cdFx0XHRsb2FkX3ByZXZpZXcoIGdldF9zZWxlY3RlZF9jYXJkKCkgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDb21taXQgb3Igcm9sbCBiYWNrIHRoZSBwcm92aXNpb25hbCBBcHBvaW50bWVudCBmbG93IHJhZGlvIHNlbGVjdGlvbi5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7Q3VzdG9tRXZlbnR9IGV2ZW50IFNoYXJlZCBkaWFsb2cgbGlmZWN5Y2xlIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX2RpYWxvZ19jbG9zZWQoIGV2ZW50ICkge1xuXHRcdFx0dmFyIGRpYWxvZ19zdGF0ZSA9IGV2ZW50LmRldGFpbCB8fCB7fTtcblxuXHRcdFx0aWYgKCBhcHBvaW50bWVudF9mbG93X2RpYWxvZ19hY3Rpb24gIT09IGRpYWxvZ19zdGF0ZS5hY3Rpb24gKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCAnY29uZmlybScgPT09IGRpYWxvZ19zdGF0ZS5vdXRjb21lICkge1xuXHRcdFx0XHRjb21taXRfYm9va2luZ19mb3JtX3VzYWdlKCAnYXBwb2ludG1lbnRfZmxvdycgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRzZWxlY3RfYm9va2luZ19mb3JtX3VzYWdlKCBjb25maXJtZWRfYm9va2luZ19mb3JtX3VzYWdlICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSGFuZGxlIG5hdGl2ZSB0ZW1wbGF0ZSByYWRpbyBjaGFuZ2VzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnQgQ2hhbmdlIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX2NoYW5nZSggZXZlbnQgKSB7XG5cdFx0XHRpZiAoIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy10ZW1wbGF0ZS1yYWRpb10nICkgKSB7XG5cdFx0XHRcdHNlbGVjdF9jYXJkKCBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGVtcGxhdGUtY2FyZF0nICksIHRydWUgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy1ib29raW5nLWZvcm0tdXNhZ2UtcmFkaW9dJyApICkge1xuXHRcdFx0XHRzZWxlY3RfYm9va2luZ19mb3JtX3VzYWdlKCBTdHJpbmcoIGV2ZW50LnRhcmdldC52YWx1ZSB8fCAnJyApICk7XG5cdFx0XHRcdHNoZWxsX2FwaS5jbGVhcl9maWVsZF9lcnJvciggJ2Jvb2tpbmdfZm9ybV91c2FnZScgKTtcblxuXHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0J2FwcG9pbnRtZW50X2Zsb3cnID09PSBldmVudC50YXJnZXQudmFsdWUgJiZcblx0XHRcdFx0XHQnYXBwb2ludG1lbnRfZmxvdycgIT09IGNvbmZpcm1lZF9ib29raW5nX2Zvcm1fdXNhZ2UgJiZcblx0XHRcdFx0XHQnZnVuY3Rpb24nID09PSB0eXBlb2Ygc2hlbGxfYXBpLm9wZW5fZGlhbG9nXG5cdFx0XHRcdCkge1xuXHRcdFx0XHRcdGlmICggc2hlbGxfYXBpLm9wZW5fZGlhbG9nKCBhcHBvaW50bWVudF9mbG93X2RpYWxvZ19hY3Rpb24sIGV2ZW50LnRhcmdldCApICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbW1pdF9ib29raW5nX2Zvcm1fdXNhZ2UoIFN0cmluZyggZXZlbnQudGFyZ2V0LnZhbHVlIHx8ICcnICkgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBQcm92aWRlIGFycm93LWtleSBuYXZpZ2F0aW9uIGFjcm9zcyBob3Jpem9udGFsbHkgc2Nyb2xsYWJsZSBmaWx0ZXIgdGFicy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7S2V5Ym9hcmRFdmVudH0gZXZlbnQgS2V5Ym9hcmQgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfa2V5ZG93biggZXZlbnQgKSB7XG5cdFx0XHR2YXIgdGFiID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXRlbXBsYXRlLWZpbHRlcl0nICk7XG5cdFx0XHR2YXIgY3VycmVudF9pbmRleDtcblx0XHRcdHZhciB0YXJnZXRfaW5kZXg7XG5cblx0XHRcdGlmICggISB0YWIgfHwgLTEgPT09IFsgJ0Fycm93TGVmdCcsICdBcnJvd1JpZ2h0JywgJ0hvbWUnLCAnRW5kJyBdLmluZGV4T2YoIGV2ZW50LmtleSApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRjdXJyZW50X2luZGV4ID0gZWRpdG9yLnRhYnMuaW5kZXhPZiggdGFiICk7XG5cdFx0XHR0YXJnZXRfaW5kZXggPSBjdXJyZW50X2luZGV4O1xuXHRcdFx0aWYgKCAnQXJyb3dMZWZ0JyA9PT0gZXZlbnQua2V5ICkge1xuXHRcdFx0XHR0YXJnZXRfaW5kZXggPSAoIGN1cnJlbnRfaW5kZXggLSAxICsgZWRpdG9yLnRhYnMubGVuZ3RoICkgJSBlZGl0b3IudGFicy5sZW5ndGg7XG5cdFx0XHR9IGVsc2UgaWYgKCAnQXJyb3dSaWdodCcgPT09IGV2ZW50LmtleSApIHtcblx0XHRcdFx0dGFyZ2V0X2luZGV4ID0gKCBjdXJyZW50X2luZGV4ICsgMSApICUgZWRpdG9yLnRhYnMubGVuZ3RoO1xuXHRcdFx0fSBlbHNlIGlmICggJ0hvbWUnID09PSBldmVudC5rZXkgKSB7XG5cdFx0XHRcdHRhcmdldF9pbmRleCA9IDA7XG5cdFx0XHR9IGVsc2UgaWYgKCAnRW5kJyA9PT0gZXZlbnQua2V5ICkge1xuXHRcdFx0XHR0YXJnZXRfaW5kZXggPSBlZGl0b3IudGFicy5sZW5ndGggLSAxO1xuXHRcdFx0fVxuXG5cdFx0XHRhY3RpdmF0ZV9maWx0ZXIoIGVkaXRvci50YWJzWyB0YXJnZXRfaW5kZXggXSApO1xuXHRcdFx0ZWRpdG9yLnRhYnNbIHRhcmdldF9pbmRleCBdLmZvY3VzKCk7XG5cdFx0XHRlZGl0b3IudGFic1sgdGFyZ2V0X2luZGV4IF0uc2Nyb2xsSW50b1ZpZXcoIHsgYmxvY2s6ICduZWFyZXN0JywgaW5saW5lOiAnbmVhcmVzdCcgfSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEluaXRpYWxpemUgdGhpcyBtb2R1bGUgYWdhaW5zdCBzaGVsbC1wcm92aWRlZCBBUElzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHJlZ2lzdGVyZWRfc2hlbGxfYXBpIFNoYXJlZCB3aXphcmQgYWRhcHRlciBzZXJ2aWNlcy5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGluaXRpYWxpemUoIHJlZ2lzdGVyZWRfc2hlbGxfYXBpICkge1xuXHRcdFx0dmFyIGVkaXRvcl9ub2RlO1xuXHRcdFx0dmFyIHNlbGVjdGVkX2NhcmQ7XG5cdFx0XHR2YXIgaW5pdGlhbF9wcmV2aWV3X2tpbmQ7XG5cdFx0XHR2YXIgaW5pdGlhbF90ZW1wbGF0ZV9zbHVnO1xuXHRcdFx0dmFyIGluaXRpYWxfYm9va2luZ19mb3JtX3VzYWdlO1xuXHRcdFx0dmFyIGluaXRpYWxfcHJldmlld19ib290c3RyYXA7XG5cdFx0XHR2YXIgaW5pdGlhbF9wcmV2aWV3X2h0bWw7XG5cblx0XHRcdHNoZWxsX2FwaSA9IHJlZ2lzdGVyZWRfc2hlbGxfYXBpO1xuXHRcdFx0cm9vdCA9IHNoZWxsX2FwaS5yb290O1xuXHRcdFx0ZWRpdG9yX25vZGUgPSByb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctZm9ybS10ZW1wbGF0ZS1lZGl0b3JdJyApO1xuXHRcdFx0aWYgKCAhIGVkaXRvcl9ub2RlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGVkaXRvciA9IHtcblx0XHRcdFx0bm9kZTogZWRpdG9yX25vZGUsXG5cdFx0XHRcdGNhcmRzOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCggZWRpdG9yX25vZGUucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdGVtcGxhdGUtY2FyZF0nICkgKSxcblx0XHRcdFx0dGFiczogQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoIGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLXRlbXBsYXRlLWZpbHRlcl0nICkgKSxcblx0XHRcdFx0c2VhcmNoOiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10ZW1wbGF0ZS1zZWFyY2hdJyApLFxuXHRcdFx0XHRncmlkOiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10ZW1wbGF0ZS1ncmlkXScgKSxcblx0XHRcdFx0ZW1wdHk6IGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRlbXBsYXRlLWVtcHR5XScgKSxcblx0XHRcdFx0cHJldmlld19zdGFnZTogZWRpdG9yX25vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGVtcGxhdGUtcHJldmlldy1zdGFnZV0nICksXG5cdFx0XHRcdHByZXZpZXdfbG9hZGVyOiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10ZW1wbGF0ZS1wcmV2aWV3LWxvYWRlcl0nICksXG5cdFx0XHRcdHByZXZpZXdfZXJyb3I6IGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRlbXBsYXRlLXByZXZpZXctZXJyb3JdJyApLFxuXHRcdFx0XHRpbmxpbmVfcHJldmlldzogZWRpdG9yX25vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGVtcGxhdGUtaW5saW5lLXByZXZpZXddJyApLFxuXHRcdFx0XHRpbmxpbmVfcHJldmlld19jb250ZW50OiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10ZW1wbGF0ZS1pbmxpbmUtcHJldmlldy1jb250ZW50XScgKSxcblx0XHRcdFx0aW5pdGlhbF9wcmV2aWV3X2Jvb3RzdHJhcDogZWRpdG9yX25vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGVtcGxhdGUtaW5pdGlhbC1wcmV2aWV3LWJvb3RzdHJhcF0nICksXG5cdFx0XHRcdHByZXZpZXdfZnJhbWU6IGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRlbXBsYXRlLXByZXZpZXctZnJhbWVdJyApLFxuXHRcdFx0XHRyZWZyZXNoX2J1dHRvbjogZWRpdG9yX25vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGVtcGxhdGUtcmVmcmVzaF0nICksXG5cdFx0XHRcdG9wZW5fYnV0dG9uOiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10ZW1wbGF0ZS1vcGVuLXByZXZpZXddJyApLFxuXHRcdFx0XHRhY3RpdmVfZmlsdGVyOiBlZGl0b3Jfbm9kZS5kYXRhc2V0LmluaXRpYWxGaWx0ZXIgfHwgJ2FsbCdcblx0XHRcdH07XG5cblx0XHRcdGlmIChcblx0XHRcdFx0d2luZG93LndwYmNfYmZiX2lubGluZV9wcmV2aWV3ICYmXG5cdFx0XHRcdCdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19iZmJfaW5saW5lX3ByZXZpZXcuY3JlYXRlXG5cdFx0XHQpIHtcblx0XHRcdFx0aW5saW5lX3ByZXZpZXdfcmVuZGVyZXIgPSB3aW5kb3cud3BiY19iZmJfaW5saW5lX3ByZXZpZXcuY3JlYXRlKCBlZGl0b3IuaW5saW5lX3ByZXZpZXdfY29udGVudCApO1xuXHRcdFx0fVxuXG5cdFx0XHRlZGl0b3Iubm9kZS5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBoYW5kbGVfY2xpY2sgKTtcblx0XHRcdGVkaXRvci5ub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBoYW5kbGVfY2hhbmdlICk7XG5cdFx0XHRlZGl0b3Iubm9kZS5hZGRFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIGhhbmRsZV9rZXlkb3duICk7XG5cdFx0XHRyb290LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOnNldHVwLXdpemFyZC1kaWFsb2ctY2xvc2VkJywgaGFuZGxlX2RpYWxvZ19jbG9zZWQgKTtcblx0XHRcdGNvbmZpcm1lZF9ib29raW5nX2Zvcm1fdXNhZ2UgPSBnZXRfc2VsZWN0ZWRfYm9va2luZ19mb3JtX3VzYWdlKCk7XG5cdFx0XHRpZiAoIGVkaXRvci5zZWFyY2ggKSB7XG5cdFx0XHRcdGVkaXRvci5zZWFyY2guYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgaGFuZGxlX3NlYXJjaF9jaGFuZ2UgKTtcblx0XHRcdFx0ZWRpdG9yLnNlYXJjaC5hZGRFdmVudExpc3RlbmVyKCAnc2VhcmNoJywgaGFuZGxlX3NlYXJjaF9jaGFuZ2UgKTtcblx0XHRcdFx0ZWRpdG9yLnNlYXJjaC5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgaGFuZGxlX3NlYXJjaF9jaGFuZ2UgKTtcblx0XHRcdH1cblxuXHRcdFx0ZWRpdG9yLmNhcmRzLmZvckVhY2goIGZ1bmN0aW9uICggY2FyZCApIHtcblx0XHRcdFx0aW5pdGlhbGl6ZV9pbWFnZV9mYWxsYmFjayhcblx0XHRcdFx0XHRjYXJkLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRlbXBsYXRlLWNhcmQtaW1hZ2VdJyApLFxuXHRcdFx0XHRcdGNhcmQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGVtcGxhdGUtaW1hZ2UtcGxhY2Vob2xkZXJdJyApXG5cdFx0XHRcdCk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHJlbmRlcl9jYXRhbG9nKCk7XG5cdFx0XHRzZWxlY3RlZF9jYXJkID0gZ2V0X3NlbGVjdGVkX2NhcmQoKTtcblx0XHRcdGlmICggc2VsZWN0ZWRfY2FyZCApIHtcblx0XHRcdFx0aW5pdGlhbF9wcmV2aWV3X2tpbmQgPSBTdHJpbmcoIGVkaXRvci5wcmV2aWV3X3N0YWdlLmRhdGFzZXQuaW5pdGlhbFByZXZpZXdLaW5kIHx8ICcnICk7XG5cdFx0XHRcdGluaXRpYWxfdGVtcGxhdGVfc2x1ZyA9IFN0cmluZyggZWRpdG9yLnByZXZpZXdfc3RhZ2UuZGF0YXNldC5pbml0aWFsUHJldmlld1RlbXBsYXRlU2x1ZyB8fCAnJyApO1xuXHRcdFx0XHRpbml0aWFsX2Jvb2tpbmdfZm9ybV91c2FnZSA9IFN0cmluZyggZWRpdG9yLnByZXZpZXdfc3RhZ2UuZGF0YXNldC5pbml0aWFsUHJldmlld0Jvb2tpbmdGb3JtVXNhZ2UgfHwgJycgKTtcblx0XHRcdFx0c2VsZWN0X2NhcmQoIHNlbGVjdGVkX2NhcmQsIGZhbHNlICk7XG5cblx0XHRcdFx0aWYgKFxuXHRcdFx0XHRcdCdpbmxpbmUnID09PSBpbml0aWFsX3ByZXZpZXdfa2luZCAmJlxuXHRcdFx0XHRcdGluaXRpYWxfdGVtcGxhdGVfc2x1ZyA9PT0gU3RyaW5nKCBzZWxlY3RlZF9jYXJkLmRhdGFzZXQudGVtcGxhdGVTbHVnIHx8ICcnICkgJiZcblx0XHRcdFx0XHRpbml0aWFsX2Jvb2tpbmdfZm9ybV91c2FnZSA9PT0gZ2V0X3NlbGVjdGVkX2Jvb2tpbmdfZm9ybV91c2FnZSgpICYmXG5cdFx0XHRcdFx0aW5saW5lX3ByZXZpZXdfcmVuZGVyZXIgJiZcblx0XHRcdFx0XHRlZGl0b3IuaW5pdGlhbF9wcmV2aWV3X2Jvb3RzdHJhcFxuXHRcdFx0XHQpIHtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0aW5pdGlhbF9wcmV2aWV3X2Jvb3RzdHJhcCA9IEpTT04ucGFyc2UoIGVkaXRvci5pbml0aWFsX3ByZXZpZXdfYm9vdHN0cmFwLnRleHRDb250ZW50IHx8ICd7fScgKTtcblx0XHRcdFx0XHR9IGNhdGNoICggZXJyb3IgKSB7XG5cdFx0XHRcdFx0XHRpbml0aWFsX3ByZXZpZXdfYm9vdHN0cmFwID0gbnVsbDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aW5pdGlhbF9wcmV2aWV3X2h0bWwgPSBlZGl0b3IuaW5saW5lX3ByZXZpZXdfY29udGVudC5pbm5lckhUTUw7XG5cdFx0XHRcdFx0aWYgKCBpbml0aWFsX3ByZXZpZXdfYm9vdHN0cmFwICYmICdvYmplY3QnID09PSB0eXBlb2YgaW5pdGlhbF9wcmV2aWV3X2Jvb3RzdHJhcCApIHtcblx0XHRcdFx0XHRcdGlubGluZV9wcmV2aWV3X3JlbmRlcmVyLnJlcGxhY2UoIGluaXRpYWxfcHJldmlld19odG1sLCBpbml0aWFsX3ByZXZpZXdfYm9vdHN0cmFwIClcblx0XHRcdFx0XHRcdFx0LmRvbmUoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdFx0XHRzZXRfY3VycmVudF9wcmV2aWV3KCAnaW5saW5lJywgJycsIGluaXRpYWxfdGVtcGxhdGVfc2x1ZywgaW5pdGlhbF9ib29raW5nX2Zvcm1fdXNhZ2UgKTtcblx0XHRcdFx0XHRcdFx0XHRzZXRfcHJldmlld19zdGF0ZSggZmFsc2UsICcnICk7XG5cdFx0XHRcdFx0XHRcdH0gKVxuXHRcdFx0XHRcdFx0XHQuZmFpbCggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0XHRcdGxvYWRfcHJldmlldyggc2VsZWN0ZWRfY2FyZCApO1xuXHRcdFx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGxvYWRfcHJldmlldyggc2VsZWN0ZWRfY2FyZCApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRsb2FkX3ByZXZpZXcoIHNlbGVjdGVkX2NhcmQgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVuZGVyX3ByZXZpZXdfbWV0YWRhdGEoIG51bGwgKTtcblx0XHRcdFx0c2V0X3ByZXZpZXdfc3RhdGUoIGZhbHNlLCBnZXRfbWVzc2FnZSggJ3ByZXZpZXdfZXJyb3InLCAnVGhlIGludGVyYWN0aXZlIHByZXZpZXcgY291bGQgbm90IGJlIGxvYWRlZC4gVHJ5IHJlZnJlc2hpbmcgaXQuJyApICk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHNoZWxsX2FwaS5vcGVuX2RpYWxvZyApIHtcblx0XHRcdFx0d2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRzaGVsbF9hcGkub3Blbl9kaWFsb2coIHRlbXBsYXRlX2d1aWRhbmNlX2RpYWxvZ19hY3Rpb24sIGVkaXRvci5zZWFyY2ggfHwgZWRpdG9yLm5vZGUgKTtcblx0XHRcdFx0fSwgMCApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFZhbGlkYXRlIHRoZSByZXF1aXJlZCBzZWxlY3Rpb24gYmVmb3JlIGZvcndhcmQgbmF2aWdhdGlvbi5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge0hUTUxFbGVtZW50fG51bGx9IEZpcnN0IGludmFsaWQgcmFkaW8sIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gdmFsaWRhdGUoKSB7XG5cdFx0XHR2YXIgc2VsZWN0ZWRfcmFkaW8gPSBlZGl0b3IgJiYgZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGVtcGxhdGUtcmFkaW9dOmNoZWNrZWQnICk7XG5cdFx0XHR2YXIgc2VsZWN0ZWRfdXNhZ2UgPSBlZGl0b3IgJiYgZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1mb3JtLXVzYWdlLXJhZGlvXTpjaGVja2VkJyApO1xuXG5cdFx0XHRpZiAoICEgc2VsZWN0ZWRfcmFkaW8gKSB7XG5cdFx0XHRcdHJldHVybiBzaGVsbF9hcGkuc2V0X2ZpZWxkX2Vycm9yKCAnYm9va2luZ19mb3JtX3RlbXBsYXRlJywgZ2V0X21lc3NhZ2UoICd0ZW1wbGF0ZV9yZXF1aXJlZCcsICdDaG9vc2UgYSBib29raW5nIGZvcm0gdGVtcGxhdGUuJyApICk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICggISBzZWxlY3RlZF91c2FnZSApIHtcblx0XHRcdFx0cmV0dXJuIHNoZWxsX2FwaS5zZXRfZmllbGRfZXJyb3IoICdib29raW5nX2Zvcm1fdXNhZ2UnLCBnZXRfbWVzc2FnZSggJ3VzYWdlX3JlcXVpcmVkJywgJ0Nob29zZSBob3cgY3VzdG9tZXJzIHdpbGwgb3BlbiB0aGUgYm9va2luZyBmb3JtLicgKSApO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0aW5pdGlhbGl6ZTogaW5pdGlhbGl6ZSxcblx0XHRcdHN5bmM6IGZ1bmN0aW9uICgpIHt9LFxuXHRcdFx0dmFsaWRhdGU6IHZhbGlkYXRlXG5cdFx0fTtcblx0fVxuXG5cdHdpbmRvdy53cGJjX3NldHVwX2VkaXRvcl9tb2R1bGVzID0gd2luZG93LndwYmNfc2V0dXBfZWRpdG9yX21vZHVsZXMgfHwge307XG5cdHdpbmRvdy53cGJjX3NldHVwX2VkaXRvcl9tb2R1bGVzLmJvb2tpbmdfZm9ybV90ZW1wbGF0ZSA9IHtcblx0XHRjcmVhdGU6IGNyZWF0ZV9ib29raW5nX2Zvcm1fdGVtcGxhdGVfYWRhcHRlclxuXHR9O1xuXG5cdGlmICggd2luZG93LndwYmNfc2V0dXBfd2l6YXJkX2FwaSAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfc2V0dXBfd2l6YXJkX2FwaS5yZWdpc3Rlcl9zdGVwX2FkYXB0ZXIgKSB7XG5cdFx0d2luZG93LndwYmNfc2V0dXBfd2l6YXJkX2FwaS5yZWdpc3Rlcl9zdGVwX2FkYXB0ZXIoIGNyZWF0ZV9ib29raW5nX2Zvcm1fdGVtcGxhdGVfYWRhcHRlciggbW9kdWxlX2NvbmZpZyApICk7XG5cdH1cbn0oIHdpbmRvdywgZG9jdW1lbnQgKSApO1xuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNFLFdBQVdBLE1BQU0sRUFBRUMsUUFBUSxFQUFHO0VBQy9CLFlBQVk7O0VBRVosSUFBSUMsYUFBYSxHQUFHRixNQUFNLENBQUNHLHVDQUF1QyxJQUFJO0lBQUVDLElBQUksRUFBRSxDQUFDO0VBQUUsQ0FBQzs7RUFFbEY7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU0Msb0NBQW9DQSxDQUFFQyxNQUFNLEVBQUc7SUFDdkQsSUFBSUMsOEJBQThCLEdBQUcsK0JBQStCO0lBQ3BFLElBQUlDLCtCQUErQixHQUFHLGdDQUFnQztJQUN0RSxJQUFJQyxTQUFTLEdBQUcsSUFBSTtJQUNwQixJQUFJQyxJQUFJLEdBQUcsSUFBSTtJQUNmLElBQUlDLE1BQU0sR0FBRyxJQUFJO0lBQ2pCLElBQUlDLDRCQUE0QixHQUFHLEVBQUU7SUFDckMsSUFBSUMsd0JBQXdCLEdBQUcsQ0FBQztJQUNoQyxJQUFJQyx3QkFBd0IsR0FBRyxJQUFJO0lBQ25DLElBQUlDLHFCQUFxQixHQUFHLENBQUM7SUFDN0IsSUFBSUMscUJBQXFCLEdBQUcsSUFBSTtJQUNoQyxJQUFJQyx1QkFBdUIsR0FBRyxLQUFLO0lBQ25DLElBQUlDLHVCQUF1QixHQUFHLElBQUk7SUFDbEMsSUFBSUMsZUFBZSxHQUFHO01BQ3JCQyxJQUFJLEVBQUUsRUFBRTtNQUNSQyxHQUFHLEVBQUUsRUFBRTtNQUNQQyxhQUFhLEVBQUUsRUFBRTtNQUNqQkMsa0JBQWtCLEVBQUU7SUFDckIsQ0FBQzs7SUFFRDtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNDLFdBQVdBLENBQUVDLEdBQUcsRUFBRUMsUUFBUSxFQUFH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
