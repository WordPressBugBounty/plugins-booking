/**
 * Drive the progressive Publish & integrate Setup Wizard page.
 *
 * The adapter updates presentation fields and validates the current draft. It
 * never creates, publishes, or changes a WordPress page.
 *
 * @package Booking Calendar
 */
( function ( window, document ) {
	'use strict';

	var module_config = window.wpbc_setup_wizard_publish_integration || { i18n: {} };

	/**
	 * Create one isolated publishing-plan step adapter.
	 *
	 * @param {Object} config Localized messages.
	 * @return {Object} Adapter accepted by the shared wizard shell.
	 */
	function create_publish_integration_adapter( config ) {
		var shell_api = null;
		var editor = null;

		/**
		 * Return a localized message with a safe fallback.
		 *
		 * @param {string} key      Localized message key.
		 * @param {string} fallback English fallback.
		 * @return {string} Available message.
		 */
		function get_message( key, fallback ) {
			return config.i18n && config.i18n[ key ] ? String( config.i18n[ key ] ) : fallback;
		}

		/**
		 * Return the selected destination identifier.
		 *
		 * @return {string} Destination ID or an empty string.
		 */
		function get_destination() {
			var selected = editor ? editor.node.querySelector( '[data-wpbc-publish-destination]:checked' ) : null;

			return selected ? String( selected.value || '' ) : '';
		}

		/**
		 * Toggle an element's semantic hidden state.
		 *
		 * @param {HTMLElement|null} element   Element to update.
		 * @param {boolean}          is_hidden Whether the element is hidden.
		 * @return {void}
		 */
		function set_hidden( element, is_hidden ) {
			if ( ! element ) {
				return;
			}

			element.hidden = Boolean( is_hidden );
		}

		/**
		 * Build a safe root-relative URL preview from a page title.
		 *
		 * @param {string} page_title Proposed page title.
		 * @return {string} Root-relative preview URL.
		 */
		function build_page_url( page_title ) {
			var slug = '';
			var home_path = String( editor.node.dataset.homePath || '/' );

			if ( window.wp && window.wp.url && 'function' === typeof window.wp.url.cleanForSlug ) {
				slug = window.wp.url.cleanForSlug( page_title );
			} else {
				slug = String( page_title || '' )
					.toLowerCase()
					.trim()
					.replace( /[^a-z0-9\s-]/g, '' )
					.replace( /[\s-]+/g, '-' )
					.replace( /^-+|-+$/g, '' );
			}

			home_path = '/' + home_path.replace( /^\/+|\/+$/g, '' );
			if ( '/' !== home_path ) {
				home_path += '/';
			}

			return home_path + ( slug || 'booking' ) + '/';
		}

		/**
		 * Read the selected existing page's authorized display URL.
		 *
		 * @return {string} Root-relative page URL or an empty string.
		 */
		function get_existing_page_url() {
			var option = editor.existing_page && editor.existing_page.selectedIndex >= 0
				? editor.existing_page.options[ editor.existing_page.selectedIndex ]
				: null;

			return option ? String( option.dataset.pageUrl || '' ) : '';
		}

		/**
		 * Update the URL preview for the active page destination.
		 *
		 * @param {string} destination Active destination ID.
		 * @return {void}
		 */
		function update_page_url( destination ) {
			if ( ! editor.page_url ) {
				return;
			}

			if ( 'create_page' === destination ) {
				editor.page_url.value = build_page_url( editor.page_title ? editor.page_title.value : '' );
			} else if ( 'existing_page' === destination ) {
				editor.page_url.value = get_existing_page_url();
			} else {
				editor.page_url.value = '';
			}
		}

		/**
		 * Update journey-aware content details and shortcode presentation.
		 *
		 * @return {void}
		 */
		function update_content_details() {
			var option = editor.content && editor.content.selectedIndex >= 0
				? editor.content.options[ editor.content.selectedIndex ]
				: null;

			if ( ! option ) {
				return;
			}

			if ( editor.content_title ) {
				editor.content_title.textContent = option.textContent.trim();
			}
			if ( editor.content_description ) {
				editor.content_description.textContent = String( option.dataset.contentDescription || '' );
			}
			if ( editor.shortcode ) {
				editor.shortcode.value = String( option.dataset.contentShortcode || '' );
			}
			if ( editor.shortcode_help ) {
				editor.shortcode_help.href = String( option.dataset.contentHelpUrl || '' );
				editor.shortcode_help.hidden = ! option.dataset.contentHelpUrl;
			}
			if ( editor.shortcode_help_label ) {
				editor.shortcode_help_label.textContent = String( option.dataset.contentHelpLabel || '' );
			}
		}

		/**
		 * Return destination-specific approval notice copy.
		 *
		 * @param {string} destination Active destination ID.
		 * @return {string} Notice message.
		 */
		function get_notice( destination ) {
			if ( 'existing_page' === destination ) {
				return get_message( 'notice_existing', 'Save adds or updates one managed Booking Calendar block without replacing the page\'s other content.' );
			}
			if ( 'manual' === destination ) {
				return get_message( 'notice_manual', 'Save records this shortcode for the setup summary. No WordPress page is created or changed.' );
			}
			if ( 'later' === destination ) {
				return get_message( 'notice_later', 'No page will be created or changed. You can integrate the booking experience later.' );
			}

			return get_message( 'notice_create', 'Save this step to create the booking page now, or update the same page on a later save.' );
		}

		/**
		 * Return the server-localized primary action label for a destination.
		 *
		 * @param {string} destination Active destination ID.
		 * @return {string} Primary action label.
		 */
		function get_action_label( destination ) {
			if ( 'create_page' === destination ) {
				return '1' === editor.node.dataset.hasCreatedPage
					? get_message( 'action_update', 'Update page & continue' )
					: get_message( 'action_create', 'Create page & continue' );
			}
			if ( 'existing_page' === destination ) {
				return get_message( 'action_update', 'Update page & continue' );
			}

			return get_message( 'action_save', 'Save & continue' );
		}

		/**
		 * Synchronize all conditional fields with the selected destination.
		 *
		 * @return {void}
		 */
		function render_destination() {
			var destination = get_destination();
			var is_create = 'create_page' === destination;
			var is_existing = 'existing_page' === destination;
			var is_later = 'later' === destination;

			editor.cards.forEach( function ( card ) {
				var control = card.querySelector( '[data-wpbc-publish-destination]' );

				card.classList.toggle( 'is-selected', Boolean( control && control.checked ) );
			} );

			set_hidden( editor.create_field, ! is_create );
			set_hidden( editor.existing_field, ! is_existing );
			set_hidden( editor.url_field, ! is_create && ! is_existing );
			set_hidden( editor.settings_body, is_later );
			set_hidden( editor.later_panel, ! is_later );

			if ( editor.page_title ) {
				editor.page_title.required = is_create;
			}
			if ( editor.existing_page ) {
				editor.existing_page.required = is_existing;
			}
			if ( editor.content ) {
				editor.content.required = ! is_later;
			}
			if ( editor.notice_text ) {
				editor.notice_text.textContent = get_notice( destination );
			}
			if ( editor.continue_label ) {
				editor.continue_label.textContent = get_action_label( destination );
			}

			update_page_url( destination );
		}

		/**
		 * Copy text while preserving keyboard focus on the invoking button.
		 *
		 * @param {string}      text   Text to copy.
		 * @param {HTMLElement} button Invoking button.
		 * @return {Promise<void>} Completion promise.
		 */
		function copy_text( text, button ) {
			var clipboard_promise;

			if ( navigator.clipboard && 'function' === typeof navigator.clipboard.writeText ) {
				clipboard_promise = navigator.clipboard.writeText( text );
			} else {
				clipboard_promise = new Promise( function ( resolve, reject ) {
					var temporary = document.createElement( 'textarea' );

					temporary.value = text;
					temporary.setAttribute( 'readonly', 'readonly' );
					temporary.style.position = 'fixed';
					temporary.style.opacity = '0';
					document.body.appendChild( temporary );
					temporary.select();
					if ( document.execCommand( 'copy' ) ) {
						resolve();
					} else {
						reject( new Error( 'copy_failed' ) );
					}
					temporary.remove();
				} );
			}

			return clipboard_promise.then( function () {
				shell_api.set_status( get_message( 'copied', 'Copied to the clipboard.' ) );
				button.focus();
			} ).catch( function () {
				shell_api.set_status( get_message( 'copy_failed', 'Copy failed. Select the text and copy it manually.' ) );
				button.focus();
			} );
		}

		/**
		 * Handle destination and copy-button clicks.
		 *
		 * @param {MouseEvent} event Click event.
		 * @return {void}
		 */
		function handle_click( event ) {
			var copy_button = event.target.closest( '[data-wpbc-publish-copy]' );
			var copy_type;
			var copy_source;

			if ( ! copy_button || ! editor.node.contains( copy_button ) ) {
				return;
			}

			copy_type = String( copy_button.dataset.wpbcPublishCopy || '' );
			copy_source = 'page-url' === copy_type ? editor.page_url : editor.shortcode;
			if ( copy_source && copy_source.value ) {
				copy_text( String( copy_source.value ), copy_button );
			}
		}

		/**
		 * Handle select and radio changes.
		 *
		 * @param {Event} event Change event.
		 * @return {void}
		 */
		function handle_change( event ) {
			if ( event.target.matches( '[data-wpbc-publish-destination]' ) ) {
				render_destination();
			} else if ( event.target === editor.content ) {
				update_content_details();
			} else if ( event.target === editor.existing_page ) {
				update_page_url( get_destination() );
			}
		}

		/**
		 * Initialize the adapter against shell-owned services.
		 *
		 * @param {Object} registered_shell_api Shared wizard adapter services.
		 * @return {void}
		 */
		function initialize( registered_shell_api ) {
			var editor_node;

			shell_api = registered_shell_api;
			editor_node = shell_api.root.querySelector( '[data-wpbc-publish-integration-editor]' );
			if ( ! editor_node ) {
				return;
			}

			editor = {
				node: editor_node,
				cards: Array.prototype.slice.call( editor_node.querySelectorAll( '.wpbc_setup_wizard__publish-destination-card' ) ),
				create_field: editor_node.querySelector( '[data-wpbc-publish-create-field]' ),
				existing_field: editor_node.querySelector( '[data-wpbc-publish-existing-field]' ),
				url_field: editor_node.querySelector( '[data-wpbc-publish-page-url-field]' ),
				settings_body: editor_node.querySelector( '[data-wpbc-publish-settings-body]' ),
				later_panel: editor_node.querySelector( '[data-wpbc-publish-later-panel]' ),
				page_title: editor_node.querySelector( '[data-wpbc-publish-page-title]' ),
				existing_page: editor_node.querySelector( '[data-wpbc-publish-existing-page]' ),
				page_url: editor_node.querySelector( '[data-wpbc-publish-page-url]' ),
				content: editor_node.querySelector( '[data-wpbc-publish-page-content]' ),
				content_title: editor_node.querySelector( '[data-wpbc-publish-content-title]' ),
				content_description: editor_node.querySelector( '[data-wpbc-publish-content-description]' ),
				shortcode_help: editor_node.querySelector( '[data-wpbc-publish-shortcode-help]' ),
				shortcode_help_label: editor_node.querySelector( '[data-wpbc-publish-shortcode-help-label]' ),
				shortcode: editor_node.querySelector( '[data-wpbc-publish-shortcode]' ),
				notice_text: editor_node.querySelector( '[data-wpbc-publish-notice-text]' ),
				continue_label: shell_api.root.querySelector( '[data-wpbc-setup-wizard-direction="next"] > span' )
			};

			editor.node.addEventListener( 'click', handle_click );
			editor.node.addEventListener( 'change', handle_change );
			if ( editor.page_title ) {
				editor.page_title.addEventListener( 'input', function () {
					update_page_url( get_destination() );
				} );
			}

			render_destination();
			update_content_details();
		}

		/**
		 * Validate destination-specific fields before forward navigation.
		 *
		 * @return {HTMLElement|null} First invalid control or null.
		 */
		function validate() {
			var destination = get_destination();

			if ( 'create_page' === destination && ( ! editor.page_title || ! editor.page_title.value.trim() ) ) {
				return shell_api.set_field_error( 'publish_page_title', get_message( 'title_required', 'Enter a page title.' ) );
			}
			if ( 'existing_page' === destination && ( ! editor.existing_page || '0' === editor.existing_page.value ) ) {
				return shell_api.set_field_error( 'publish_existing_page_id', get_message( 'page_required', 'Choose a WordPress page.' ) );
			}
			if ( 'later' !== destination && ( ! editor.content || ! editor.content.value ) ) {
				return shell_api.set_field_error( 'publish_page_content', get_message( 'content_required', 'Choose the booking experience to display.' ) );
			}

			return null;
		}

		return {
			initialize: initialize,
			sync: render_destination,
			validate: validate
		};
	}

	window.wpbc_setup_editor_modules = window.wpbc_setup_editor_modules || {};
	window.wpbc_setup_editor_modules.publish_integration = { create: create_publish_integration_adapter };

	if ( window.wpbc_setup_wizard_api && 'function' === typeof window.wpbc_setup_wizard_api.register_step_adapter ) {
		window.wpbc_setup_wizard_api.register_step_adapter( create_publish_integration_adapter( module_config ) );
	}
}( window, document ) );
