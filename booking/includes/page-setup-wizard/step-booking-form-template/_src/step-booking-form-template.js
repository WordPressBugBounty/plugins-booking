/**
 * Provide the reusable Booking Form template catalog and interactive preview.
 *
 * Catalog cards remain server-rendered. Direct templates use request-local
 * inline HTML, while Appointment Flow and full-site previews use signed URLs.
 * The browser never receives raw template definitions and never applies a form.
 *
 * @package Booking Calendar
 */
( function ( window, document ) {
	'use strict';

	var module_config = window.wpbc_setup_wizard_booking_form_template || { i18n: {} };

	/**
	 * Create one isolated Booking Form template selector adapter.
	 *
	 * @param {Object} config Module endpoint and translation settings.
	 * @return {Object} Step adapter accepted by the shared wizard shell.
	 */
	function create_booking_form_template_adapter( config ) {
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
		function get_message( key, fallback ) {
			return config.i18n && config.i18n[ key ] ? config.i18n[ key ] : fallback;
		}

		/**
		 * Return normalized text for case-insensitive catalog searching.
		 *
		 * @param {string} text Source text.
		 * @return {string} Lowercase normalized text.
		 */
		function normalize_search_text( text ) {
			return String( text || '' ).toLocaleLowerCase();
		}

		/**
		 * Return one template card's searchable text.
		 *
		 * @param {HTMLElement} card Template card.
		 * @return {string} Normalized searchable text.
		 */
		function get_card_search_text( card ) {
			var title = card.querySelector( '[data-wpbc-template-title]' );
			var description = card.querySelector( '[data-wpbc-template-description]' );

			return normalize_search_text(
				( title ? title.textContent : '' ) + ' ' +
				( description ? description.textContent : '' ) + ' ' +
				( card.dataset.templateSlug || '' )
			);
		}

		/**
		 * Install a graceful fallback for one catalog thumbnail.
		 *
		 * @param {HTMLImageElement|null} image       Image element.
		 * @param {HTMLElement|null}      placeholder Placeholder element.
		 * @return {void}
		 */
		function initialize_image_fallback( image, placeholder ) {
			if ( ! image ) {
				return;
			}

			image.addEventListener( 'load', function () {
				image.hidden = false;
				if ( placeholder ) {
					placeholder.hidden = true;
				}
			} );
			image.addEventListener( 'error', function () {
				image.hidden = true;
				if ( placeholder ) {
					placeholder.hidden = false;
				}
			} );

			if ( image.complete && image.src && 0 === image.naturalWidth ) {
				image.hidden = true;
				if ( placeholder ) {
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
			var selected_radio = editor && editor.node.querySelector( '[data-wpbc-template-radio]:checked' );

			return selected_radio ? selected_radio.closest( '[data-wpbc-template-card]' ) : null;
		}

		/**
		 * Return the selected server-rendered Booking Form entry point.
		 *
		 * @return {string} Stable usage identifier, or an empty string.
		 */
		function get_selected_booking_form_usage() {
			var selected_radio = editor && editor.node.querySelector( '[data-wpbc-booking-form-usage-radio]:checked' );

			return selected_radio ? String( selected_radio.value || '' ) : '';
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
		function get_preview_shortcode( booking_form_usage ) {
			return 'appointment_flow' === booking_form_usage
				? '[booking_appointment form_type="standard"]'
				: '[booking form_type="standard"]';
		}

		/**
		 * Synchronize the selected template metadata below the preview.
		 *
		 * @param {HTMLElement|null} card Selected template card.
		 * @return {void}
		 */
		function render_preview_metadata( card ) {
			var title_node = editor.node.querySelector( '[data-wpbc-template-preview-title]' );
			var slug_node = editor.node.querySelector( '[data-wpbc-template-preview-slug]' );
			var shortcode_node = editor.node.querySelector( '[data-wpbc-template-preview-shortcode]' );
			var description_node = editor.node.querySelector( '[data-wpbc-template-preview-description]' );
			var title = card && card.querySelector( '[data-wpbc-template-title]' );
			var description = card && card.querySelector( '[data-wpbc-template-description]' );
			var template_slug = card ? String( card.dataset.templateSlug || '' ) : '';

			if ( title_node ) {
				title_node.textContent = title ? title.textContent.trim() : '';
			}
			if ( slug_node ) {
				slug_node.textContent = template_slug;
			}
			if ( shortcode_node ) {
				shortcode_node.textContent = get_preview_shortcode( get_selected_booking_form_usage() );
			}
			if ( description_node ) {
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
		function set_preview_state( is_loading, error_text ) {
			var has_error = '' !== String( error_text || '' );

			editor.preview_stage.classList.toggle( 'is-loading', is_loading );
			editor.preview_stage.classList.toggle( 'has-error', has_error );
			editor.preview_stage.setAttribute( 'aria-busy', is_loading ? 'true' : 'false' );
			editor.preview_loader.hidden = ! is_loading;
			editor.preview_error.hidden = ! has_error;
			if ( has_error ) {
				editor.preview_error.querySelector( 'span' ).textContent = error_text;
			}
			editor.refresh_button.disabled = is_loading || ! get_selected_card();
			editor.open_button.disabled = is_loading || open_request_is_loading || ! get_selected_card();
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
			editor.preview_frame.removeAttribute( 'data-preview-template-slug' );
			editor.preview_frame.removeAttribute( 'data-preview-booking-form-usage' );
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
		function set_current_preview( preview_kind, preview_url, template_slug, booking_form_usage ) {
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
		function current_preview_matches( template_slug, booking_form_usage ) {
			return current_preview.template_slug === template_slug && current_preview.booking_form_usage === booking_form_usage;
		}

		/**
		 * Read a normalized WordPress AJAX error message.
		 *
		 * @param {Object|null} response Parsed JSON response.
		 * @return {string} Plain error message.
		 */
		function get_ajax_error_message( response ) {
			if ( response && response.data && response.data.message ) {
				return String( response.data.message );
			}

			return get_message( 'preview_error', 'The interactive preview could not be loaded. Try refreshing it.' );
		}

		/**
		 * Build the authenticated request body for one server-owned preview.
		 *
		 * @param {string} template_slug      Selected template slug.
		 * @param {string} booking_form_usage Selected usage identifier.
		 * @param {string} preview_target     Embedded or window target.
		 * @return {FormData} Request body.
		 */
		function build_preview_request_body( template_slug, booking_form_usage, preview_target ) {
			var request_body = new window.FormData();

			request_body.append( 'action', config.preview_action );
			request_body.append( 'nonce', config.nonce || '' );
			request_body.append( 'template_slug', template_slug );
			request_body.append( 'booking_form_usage', booking_form_usage );
			request_body.append( 'preview_target', preview_target );

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
		function validate_preview_response( response, template_slug, booking_form_usage, preview_target ) {
			var response_data;
			var selected_card = get_selected_card();

			if ( ! response || ! response.success || ! response.data ) {
				throw new Error( get_ajax_error_message( response ) );
			}

			response_data = response.data;
			if (
				String( response_data.template_slug || '' ) !== template_slug ||
				String( response_data.booking_form_usage || '' ) !== booking_form_usage ||
				String( response_data.preview_target || '' ) !== preview_target ||
				! selected_card ||
				String( selected_card.dataset.templateSlug || '' ) !== template_slug ||
				get_selected_booking_form_usage() !== booking_form_usage
			) {
				throw new Error( get_message( 'preview_error', 'The interactive preview could not be loaded. Try refreshing it.' ) );
			}

			return response_data;
		}

		/**
		 * Request and render the selected allow-listed template.
		 *
		 * @param {HTMLElement|null} card Selected template card.
		 * @return {void}
		 */
		function load_preview( card ) {
			var template_slug = card ? String( card.dataset.templateSlug || '' ) : '';
			var booking_form_usage = get_selected_booking_form_usage();
			var request_sequence;
			var request_body;

			if ( ! template_slug || ! booking_form_usage || ! config.ajax_url || ! config.preview_action ) {
				set_preview_state( false, get_message( 'preview_error', 'The interactive preview could not be loaded. Try refreshing it.' ) );
				return;
			}

			if ( preview_abort_controller && 'function' === typeof preview_abort_controller.abort ) {
				preview_abort_controller.abort();
			}
			preview_abort_controller = 'function' === typeof window.AbortController ? new window.AbortController() : null;
			request_sequence = ++preview_request_sequence;
			request_body = build_preview_request_body( template_slug, booking_form_usage, 'embedded' );

			set_preview_state( true, '' );

			window.fetch( config.ajax_url, {
				method: 'POST',
				body: request_body,
				credentials: 'same-origin',
				signal: preview_abort_controller ? preview_abort_controller.signal : undefined
			} ).then( function ( response ) {
				return response.json();
			} ).then( function ( response ) {
				var response_data;
				var preview_kind;
				var preview_url;

				if ( request_sequence !== preview_request_sequence ) {
					return;
				}

				response_data = validate_preview_response( response, template_slug, booking_form_usage, 'embedded' );
				preview_kind = String( response_data.preview_kind || '' );

				if (
					'inline' === preview_kind &&
					response_data.html &&
					response_data.bootstrap &&
					'object' === typeof response_data.bootstrap &&
					inline_preview_renderer
				) {
					return inline_preview_renderer.replace( String( response_data.html ), response_data.bootstrap, function () {
						return request_sequence === preview_request_sequence;
					} ).then( function () {
						if ( request_sequence !== preview_request_sequence ) {
							return;
						}
						clear_preview_frame();
						editor.inline_preview.hidden = false;
						set_current_preview( 'inline', '', template_slug, booking_form_usage );
						set_preview_state( false, '' );
					} );
				}

				if ( 'url' !== preview_kind || ! response_data.preview_url ) {
					throw new Error( get_message( 'preview_error', 'The interactive preview could not be loaded. Try refreshing it.' ) );
				}

				preview_url = String( response_data.preview_url );
				editor.preview_frame.onload = function () {
					if ( request_sequence !== preview_request_sequence ) {
						return;
					}
					editor.inline_preview.hidden = true;
					editor.preview_frame.hidden = false;
					set_current_preview( 'url', preview_url, template_slug, booking_form_usage );
					set_preview_state( false, '' );
				};
				editor.preview_frame.setAttribute( 'data-preview-template-slug', template_slug );
				editor.preview_frame.setAttribute( 'data-preview-booking-form-usage', booking_form_usage );
				editor.preview_frame.src = preview_url;
			} ).catch( function ( error ) {
				if ( error && 'AbortError' === error.name ) {
					return;
				}
				if ( request_sequence !== preview_request_sequence ) {
					return;
				}
				set_preview_state( false, error && error.message ? error.message : get_message( 'preview_error', 'The interactive preview could not be loaded. Try refreshing it.' ) );
			} );
		}

		/**
		 * Open the full-site preview, lazily creating a signed session when needed.
		 *
		 * @param {HTMLElement|null} card Selected template card.
		 * @return {void}
		 */
		function open_preview( card ) {
			var template_slug = card ? String( card.dataset.templateSlug || '' ) : '';
			var booking_form_usage = get_selected_booking_form_usage();
			var preview_window;
			var request_sequence;

			if ( ! template_slug || ! booking_form_usage || editor.open_button.disabled ) {
				return;
			}

			if ( current_preview_matches( template_slug, booking_form_usage ) && current_preview.url ) {
				window.open( current_preview.url, '_blank', 'noopener,noreferrer' );
				return;
			}

			preview_window = window.open( '', '_blank' );
			if ( ! preview_window ) {
				set_preview_state( false, get_message( 'preview_open_error', 'The full-site preview could not be opened. Try again.' ) );
				return;
			}
			preview_window.opener = null;

			if ( open_abort_controller && 'function' === typeof open_abort_controller.abort ) {
				open_abort_controller.abort();
			}
			open_abort_controller = 'function' === typeof window.AbortController ? new window.AbortController() : null;
			request_sequence = ++open_request_sequence;
			open_request_is_loading = true;
			editor.open_button.disabled = true;

			window.fetch( config.ajax_url, {
				method: 'POST',
				body: build_preview_request_body( template_slug, booking_form_usage, 'window' ),
				credentials: 'same-origin',
				signal: open_abort_controller ? open_abort_controller.signal : undefined
			} ).then( function ( response ) {
				return response.json();
			} ).then( function ( response ) {
				var response_data;

				if ( request_sequence !== open_request_sequence ) {
					return;
				}
				response_data = validate_preview_response( response, template_slug, booking_form_usage, 'window' );
				if ( 'url' !== String( response_data.preview_kind || '' ) || ! response_data.preview_url ) {
					throw new Error( get_message( 'preview_open_error', 'The full-site preview could not be opened. Try again.' ) );
				}

				preview_window.location.replace( String( response_data.preview_url ) );
			} ).catch( function ( error ) {
				if ( error && 'AbortError' === error.name ) {
					preview_window.close();
					return;
				}
				if ( request_sequence !== open_request_sequence ) {
					return;
				}
				preview_window.close();
				set_preview_state( false, error && error.message ? error.message : get_message( 'preview_open_error', 'The full-site preview could not be opened. Try again.' ) );
			} ).then( function () {
				if ( request_sequence === open_request_sequence ) {
					open_request_is_loading = false;
					editor.open_button.disabled = ! get_selected_card();
				}
			} );
		}

		/**
		 * Select one card and load its real preview.
		 *
		 * @param {HTMLElement} card         Template card.
		 * @param {boolean}     load_selected Whether to request a replacement preview.
		 * @return {void}
		 */
		function select_card( card, load_selected ) {
			var radio = card && card.querySelector( '[data-wpbc-template-radio]' );

			if ( ! radio ) {
				return;
			}

			radio.checked = true;
			editor.cards.forEach( function ( template_card ) {
				template_card.classList.toggle( 'is-selected', template_card === card );
			} );
			shell_api.clear_field_error( 'booking_form_template' );
			render_preview_metadata( card );
			if ( false !== load_selected ) {
				load_preview( card );
			}
		}

		/**
		 * Return cards matching the current search and category.
		 *
		 * @return {HTMLElement[]} Matching cards in server order.
		 */
		function get_matching_cards() {
			var query = normalize_search_text( editor.search ? editor.search.value.trim() : '' );

			return editor.cards.filter( function ( card ) {
				var matches_filter = 'all' === editor.active_filter ||
					( 'recommended' === editor.active_filter && 'true' === card.dataset.templateRecommended ) ||
					editor.active_filter === card.dataset.templateCategory;
				var matches_search = ! query || -1 !== get_card_search_text( card ).indexOf( query );

				return matches_filter && matches_search;
			} );
		}

		/**
		 * Render every card matching the current search and category.
		 *
		 * @return {void}
		 */
		function render_catalog() {
			var matching_cards = get_matching_cards();

			editor.cards.forEach( function ( card ) {
				card.hidden = true;
			} );
			matching_cards.forEach( function ( card ) {
				card.hidden = false;
			} );

			editor.empty.hidden = 0 !== matching_cards.length;
			editor.empty.textContent = get_message( 'no_matching_templates', 'No templates match this search and filter.' );
			editor.grid.scrollLeft = 0;
		}

		/**
		 * Activate one category tab and refresh the visible cards.
		 *
		 * @param {HTMLElement} tab Filter tab button.
		 * @return {void}
		 */
		function activate_filter( tab ) {
			if ( ! tab ) {
				return;
			}

			editor.active_filter = tab.dataset.wpbcTemplateFilter || 'all';
			editor.tabs.forEach( function ( filter_tab ) {
				var is_active = filter_tab === tab;
				filter_tab.classList.toggle( 'is-active', is_active );
				filter_tab.setAttribute( 'aria-selected', is_active ? 'true' : 'false' );
				filter_tab.tabIndex = is_active ? 0 : -1;
			} );
			editor.grid.setAttribute( 'aria-labelledby', tab.id );
			render_catalog();
		}

		/**
		 * Return the filter tab with the requested stable ID.
		 *
		 * @param {string} filter_id Stable filter ID.
		 * @return {HTMLElement|null} Matching tab, or null.
		 */
		function get_filter_tab( filter_id ) {
			return editor.tabs.find( function ( tab ) {
				return filter_id === tab.dataset.wpbcTemplateFilter;
			} ) || null;
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
			var query = normalize_search_text( editor.search ? editor.search.value.trim() : '' );
			var all_templates_tab = get_filter_tab( 'all' );

			if ( query && all_templates_tab && 'all' !== editor.active_filter ) {
				activate_filter( all_templates_tab );
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
		function handle_click( event ) {
			var filter = event.target.closest( '[data-wpbc-template-filter]' );
			var refresh_button = event.target.closest( '[data-wpbc-template-refresh]' );
			var open_link = event.target.closest( '[data-wpbc-template-open-preview]' );
			var template_card = event.target.closest( '[data-wpbc-template-card]' );
			var template_radio;

			if ( filter ) {
				activate_filter( filter );
				return;
			}
			if ( refresh_button ) {
				load_preview( get_selected_card() );
				return;
			}
			if ( open_link ) {
				open_preview( get_selected_card() );
				return;
			}
			if ( template_card ) {
				template_radio = template_card.querySelector( '[data-wpbc-template-radio]' );
				if ( template_radio && ! template_radio.checked ) {
					event.preventDefault();
					select_card( template_card, true );
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
		function select_booking_form_usage( booking_form_usage ) {
			var selected_radio = null;

			Array.prototype.slice.call( editor.node.querySelectorAll( '[data-wpbc-booking-form-usage-radio]' ) ).forEach( function ( usage_radio ) {
				var is_selected = booking_form_usage === String( usage_radio.value || '' );

				usage_radio.checked = is_selected;
				usage_radio.closest( '.wpbc_setup_wizard__booking-form-usage-option' ).classList.toggle( 'is-selected', is_selected );
				if ( is_selected ) {
					selected_radio = usage_radio;
				}
			} );

			return selected_radio;
		}

		/**
		 * Commit an explained entry-point choice and refresh its preview.
		 *
		 * @param {string} booking_form_usage Stable entry-point identifier.
		 * @return {void}
		 */
		function commit_booking_form_usage( booking_form_usage ) {
			if ( ! select_booking_form_usage( booking_form_usage ) ) {
				return;
			}

			confirmed_booking_form_usage = booking_form_usage;
			shell_api.clear_field_error( 'booking_form_usage' );
			render_preview_metadata( get_selected_card() );
			load_preview( get_selected_card() );
		}

		/**
		 * Commit or roll back the provisional Appointment flow radio selection.
		 *
		 * @param {CustomEvent} event Shared dialog lifecycle event.
		 * @return {void}
		 */
		function handle_dialog_closed( event ) {
			var dialog_state = event.detail || {};

			if ( appointment_flow_dialog_action !== dialog_state.action ) {
				return;
			}

			if ( 'confirm' === dialog_state.outcome ) {
				commit_booking_form_usage( 'appointment_flow' );
				return;
			}

			select_booking_form_usage( confirmed_booking_form_usage );
		}

		/**
		 * Handle native template radio changes.
		 *
		 * @param {Event} event Change event.
		 * @return {void}
		 */
		function handle_change( event ) {
			if ( event.target.matches( '[data-wpbc-template-radio]' ) ) {
				select_card( event.target.closest( '[data-wpbc-template-card]' ), true );
				return;
			}

			if ( event.target.matches( '[data-wpbc-booking-form-usage-radio]' ) ) {
				select_booking_form_usage( String( event.target.value || '' ) );
				shell_api.clear_field_error( 'booking_form_usage' );

				if (
					'appointment_flow' === event.target.value &&
					'appointment_flow' !== confirmed_booking_form_usage &&
					'function' === typeof shell_api.open_dialog
				) {
					if ( shell_api.open_dialog( appointment_flow_dialog_action, event.target ) ) {
						return;
					}
				}

				commit_booking_form_usage( String( event.target.value || '' ) );
			}
		}

		/**
		 * Provide arrow-key navigation across horizontally scrollable filter tabs.
		 *
		 * @param {KeyboardEvent} event Keyboard event.
		 * @return {void}
		 */
		function handle_keydown( event ) {
			var tab = event.target.closest( '[data-wpbc-template-filter]' );
			var current_index;
			var target_index;

			if ( ! tab || -1 === [ 'ArrowLeft', 'ArrowRight', 'Home', 'End' ].indexOf( event.key ) ) {
				return;
			}

			event.preventDefault();
			current_index = editor.tabs.indexOf( tab );
			target_index = current_index;
			if ( 'ArrowLeft' === event.key ) {
				target_index = ( current_index - 1 + editor.tabs.length ) % editor.tabs.length;
			} else if ( 'ArrowRight' === event.key ) {
				target_index = ( current_index + 1 ) % editor.tabs.length;
			} else if ( 'Home' === event.key ) {
				target_index = 0;
			} else if ( 'End' === event.key ) {
				target_index = editor.tabs.length - 1;
			}

			activate_filter( editor.tabs[ target_index ] );
			editor.tabs[ target_index ].focus();
			editor.tabs[ target_index ].scrollIntoView( { block: 'nearest', inline: 'nearest' } );
		}

		/**
		 * Initialize this module against shell-provided APIs.
		 *
		 * @param {Object} registered_shell_api Shared wizard adapter services.
		 * @return {void}
		 */
		function initialize( registered_shell_api ) {
			var editor_node;
			var selected_card;
			var initial_preview_kind;
			var initial_template_slug;
			var initial_booking_form_usage;
			var initial_preview_bootstrap;
			var initial_preview_html;

			shell_api = registered_shell_api;
			root = shell_api.root;
			editor_node = root.querySelector( '[data-wpbc-booking-form-template-editor]' );
			if ( ! editor_node ) {
				return;
			}

			editor = {
				node: editor_node,
				cards: Array.prototype.slice.call( editor_node.querySelectorAll( '[data-wpbc-template-card]' ) ),
				tabs: Array.prototype.slice.call( editor_node.querySelectorAll( '[data-wpbc-template-filter]' ) ),
				search: editor_node.querySelector( '[data-wpbc-template-search]' ),
				grid: editor_node.querySelector( '[data-wpbc-template-grid]' ),
				empty: editor_node.querySelector( '[data-wpbc-template-empty]' ),
				preview_stage: editor_node.querySelector( '[data-wpbc-template-preview-stage]' ),
				preview_loader: editor_node.querySelector( '[data-wpbc-template-preview-loader]' ),
				preview_error: editor_node.querySelector( '[data-wpbc-template-preview-error]' ),
				inline_preview: editor_node.querySelector( '[data-wpbc-template-inline-preview]' ),
				inline_preview_content: editor_node.querySelector( '[data-wpbc-template-inline-preview-content]' ),
				initial_preview_bootstrap: editor_node.querySelector( '[data-wpbc-template-initial-preview-bootstrap]' ),
				preview_frame: editor_node.querySelector( '[data-wpbc-template-preview-frame]' ),
				refresh_button: editor_node.querySelector( '[data-wpbc-template-refresh]' ),
				open_button: editor_node.querySelector( '[data-wpbc-template-open-preview]' ),
				active_filter: editor_node.dataset.initialFilter || 'all'
			};

			if (
				window.wpbc_bfb_inline_preview &&
				'function' === typeof window.wpbc_bfb_inline_preview.create
			) {
				inline_preview_renderer = window.wpbc_bfb_inline_preview.create( editor.inline_preview_content );
			}

			editor.node.addEventListener( 'click', handle_click );
			editor.node.addEventListener( 'change', handle_change );
			editor.node.addEventListener( 'keydown', handle_keydown );
			root.addEventListener( 'wpbc:setup-wizard-dialog-closed', handle_dialog_closed );
			confirmed_booking_form_usage = get_selected_booking_form_usage();
			if ( editor.search ) {
				editor.search.addEventListener( 'input', handle_search_change );
				editor.search.addEventListener( 'search', handle_search_change );
				editor.search.addEventListener( 'change', handle_search_change );
			}

			editor.cards.forEach( function ( card ) {
				initialize_image_fallback(
					card.querySelector( '[data-wpbc-template-card-image]' ),
					card.querySelector( '[data-wpbc-template-image-placeholder]' )
				);
			} );

			render_catalog();
			selected_card = get_selected_card();
			if ( selected_card ) {
				initial_preview_kind = String( editor.preview_stage.dataset.initialPreviewKind || '' );
				initial_template_slug = String( editor.preview_stage.dataset.initialPreviewTemplateSlug || '' );
				initial_booking_form_usage = String( editor.preview_stage.dataset.initialPreviewBookingFormUsage || '' );
				select_card( selected_card, false );

				if (
					'inline' === initial_preview_kind &&
					initial_template_slug === String( selected_card.dataset.templateSlug || '' ) &&
					initial_booking_form_usage === get_selected_booking_form_usage() &&
					inline_preview_renderer &&
					editor.initial_preview_bootstrap
				) {
					try {
						initial_preview_bootstrap = JSON.parse( editor.initial_preview_bootstrap.textContent || '{}' );
					} catch ( error ) {
						initial_preview_bootstrap = null;
					}
					initial_preview_html = editor.inline_preview_content.innerHTML;
					if ( initial_preview_bootstrap && 'object' === typeof initial_preview_bootstrap ) {
						inline_preview_renderer.replace( initial_preview_html, initial_preview_bootstrap )
							.done( function () {
								set_current_preview( 'inline', '', initial_template_slug, initial_booking_form_usage );
								set_preview_state( false, '' );
							} )
							.fail( function () {
								load_preview( selected_card );
							} );
					} else {
						load_preview( selected_card );
					}
				} else {
					load_preview( selected_card );
				}
			} else {
				render_preview_metadata( null );
				set_preview_state( false, get_message( 'preview_error', 'The interactive preview could not be loaded. Try refreshing it.' ) );
			}

			if ( 'function' === typeof shell_api.open_dialog ) {
				window.setTimeout( function () {
					shell_api.open_dialog( template_guidance_dialog_action, editor.search || editor.node );
				}, 0 );
			}
		}

		/**
		 * Validate the required selection before forward navigation.
		 *
		 * @return {HTMLElement|null} First invalid radio, or null.
		 */
		function validate() {
			var selected_radio = editor && editor.node.querySelector( '[data-wpbc-template-radio]:checked' );
			var selected_usage = editor && editor.node.querySelector( '[data-wpbc-booking-form-usage-radio]:checked' );

			if ( ! selected_radio ) {
				return shell_api.set_field_error( 'booking_form_template', get_message( 'template_required', 'Choose a booking form template.' ) );
			}

			if ( ! selected_usage ) {
				return shell_api.set_field_error( 'booking_form_usage', get_message( 'usage_required', 'Choose how customers will open the booking form.' ) );
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

	if ( window.wpbc_setup_wizard_api && 'function' === typeof window.wpbc_setup_wizard_api.register_step_adapter ) {
		window.wpbc_setup_wizard_api.register_step_adapter( create_booking_form_template_adapter( module_config ) );
	}
}( window, document ) );
