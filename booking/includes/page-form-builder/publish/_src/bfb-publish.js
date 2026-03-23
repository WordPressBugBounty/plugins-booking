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
(function ( $, window, document ) {
	'use strict';

	var publish_api = {

		/**
		 * Init module.
		 *
		 * @return void
		 */
		init: function() {
			this.bind_events();
			this.bind_form_ajax_loaded_events();
			this.register_global_helpers();
			this.refresh_publish_button_shortcodes( this.get_current_form_name() );
		},

		/**
		 * Get localized vars.
		 *
		 * @return {Object}
		 */
		get_vars: function() {
			return window.wpbc_bfb_publish_vars || {};
		},

		/**
		 * Get i18n vars.
		 *
		 * @return {Object}
		 */
		get_i18n: function() {
			var vars = this.get_vars();

			return vars.i18n || {};
		},

		/**
		 * Get modal jQuery object.
		 *
		 * @return {jQuery}
		 */
		get_modal: function() {
			var vars = this.get_vars();
			var selector = vars.modal_selector || '#wpbc_bfb_modal__publish';

			return $( selector );
		},

		/**
		 * Sanitize form name similar to WP sanitize_key().
		 *
		 * @param {string} form_name Form name.
		 *
		 * @return {string}
		 */
		sanitize_form_name: function( form_name ) {
			form_name = String( form_name || '' ).toLowerCase();
			form_name = form_name.replace( /[^a-z0-9_-]/g, '' );

			if ( ! form_name ) {
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
		normalize_resource_id: function( resource_id ) {
			resource_id = parseInt( resource_id, 10 );

			if ( ! resource_id || resource_id < 1 ) {
				resource_id = parseInt( this.get_vars().default_resource_id || 1, 10 );
			}

			if ( ! resource_id || resource_id < 1 ) {
				resource_id = 1;
			}

			return resource_id;
		},

		/**
		 * Get current BFB form name.
		 *
		 * @return {string}
		 */
		get_current_form_name: function() {
			var vars = this.get_vars();
			var form_name = '';

			if ( window.WPBC_BFB_Ajax && window.WPBC_BFB_Ajax.form_name ) {
				form_name = window.WPBC_BFB_Ajax.form_name;
			}

			if ( ! form_name && vars.default_form_name ) {
				form_name = vars.default_form_name;
			}

			return this.sanitize_form_name( form_name || 'standard' );
		},

		/**
		 * Build default shortcode raw.
		 *
		 * @param {number|string} resource_id Resource ID.
		 * @param {string}        form_name   Form name.
		 *
		 * @return {string}
		 */
		build_default_shortcode_raw: function( resource_id, form_name ) {
			resource_id = this.normalize_resource_id( resource_id );
			form_name   = this.sanitize_form_name( form_name );

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
		upsert_shortcode_attr: function( shortcode_raw, attr_name, attr_value, quote_char ) {
			var escaped_attr_name, pattern, replacement_value, replacement;

			shortcode_raw = $.trim( String( shortcode_raw || '' ) );
			attr_name     = String( attr_name || '' );
			attr_value    = String( attr_value || '' );
			quote_char    = String( quote_char || '' );

			if ( ! attr_name ) {
				return shortcode_raw;
			}

			replacement_value = attr_value;
			if ( quote_char ) {
				replacement_value = quote_char + attr_value + quote_char;
			}

			replacement       = attr_name + '=' + replacement_value;
			escaped_attr_name = attr_name.replace( /[-\/\\^$*+?.()|[\]{}]/g, '\\$&' );
			pattern           = new RegExp( "\\b" + escaped_attr_name + "\\s*=\\s*(?:\"[^\"]*\"|'[^']*'|[^\\s\\]]+)", 'i' );

			if ( pattern.test( shortcode_raw ) ) {
				return shortcode_raw.replace( pattern, replacement );
			}

			if ( /\]$/.test( shortcode_raw ) ) {
				return shortcode_raw.replace( /\]$/, ' ' + replacement + ']' );
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
		normalize_shortcode_raw: function( shortcode_raw, resource_id, form_name ) {
			resource_id   = this.normalize_resource_id( resource_id );
			form_name     = this.sanitize_form_name( form_name );
			shortcode_raw = $.trim( String( shortcode_raw || '' ) );

			if ( ! shortcode_raw || 0 !== $.trim( shortcode_raw ).indexOf( '[booking' ) ) {
				return this.build_default_shortcode_raw( resource_id, form_name );
			}

			shortcode_raw = this.upsert_shortcode_attr( shortcode_raw, 'resource_id', String( resource_id ), '' );
			shortcode_raw = this.upsert_shortcode_attr( shortcode_raw, 'form_type', form_name, '\'' );

			return $.trim( shortcode_raw );
		},

		/**
		 * Refresh toolbar button shortcode attributes.
		 *
		 * @param {string} form_name Form name.
		 *
		 * @return void
		 */
		refresh_publish_button_shortcodes: function( form_name ) {
			var self     = this;
			var vars     = this.get_vars();
			var $buttons = $( '[data-wpbc-bfb-top-publish-btn="1"]' );

			form_name = this.sanitize_form_name( form_name );

			$buttons.each(
				function() {
					var $button       = $( this );
					var resource_id   = self.normalize_resource_id( $button.attr( 'data-wpbc-bfb-resource-id' ) || vars.default_resource_id || 1 );
					var shortcode_raw = $button.attr( 'data-wpbc-bfb-shortcode-raw' ) || vars.default_shortcode_raw || '';

					shortcode_raw = self.normalize_shortcode_raw( shortcode_raw, resource_id, form_name );

					$button.attr( 'data-wpbc-bfb-shortcode-raw', shortcode_raw );
					$button.attr( 'data-wpbc-bfb-form-name', form_name );
				}
			);
		},

		/**
		 * Keep publish shortcode in sync after AJAX form load.
		 *
		 * @return void
		 */
		bind_form_ajax_loaded_events: function() {
			var self = this;

			if ( window.__wpbc_bfb_publish__form_ajax_loaded_bound === '1' ) {
				return;
			}
			window.__wpbc_bfb_publish__form_ajax_loaded_bound = '1';

			document.addEventListener(
				'wpbc:bfb:form:ajax_loaded',
				function( ev ) {
					var detail       = ( ev && ev.detail ) ? ev.detail : {};
					var form_name    = self.sanitize_form_name( detail.form_name || self.get_current_form_name() );
					var $modal       = self.get_modal();
					var resource_id, shortcode_raw;

					window.WPBC_BFB_Ajax           = window.WPBC_BFB_Ajax || {};
					window.WPBC_BFB_Ajax.form_name = form_name;

					self.refresh_publish_button_shortcodes( form_name );

					if ( $modal.length ) {
						resource_id   = $modal.find( '#wpbc_bfb_publish__resource_id' ).val() || self.get_vars().default_resource_id || 1;
						shortcode_raw = $modal.find( '#wpbc_bfb_publish__shortcode_raw' ).val() || self.get_vars().default_shortcode_raw || '';

						$modal.find( '#wpbc_bfb_publish__form_name' ).val( form_name );
						$modal.find( '#wpbc_bfb_publish__shortcode_raw' ).val(
							self.normalize_shortcode_raw( shortcode_raw, resource_id, form_name )
						);
					}
				},
				{ passive: true }
			);
		},

		/**
		 * Bind DOM events.
		 *
		 * @return void
		 */
		bind_events: function() {
			var self = this;

			$( document ).on(
				'click',
				'[data-wpbc-bfb-top-publish-btn="1"]',
				function( event ) {
					self.open_from_button( event, $( this ) );
				}
			);

			$( document ).on(
				'click',
				'[data-wpbc-bfb-publish-save-step="save"]',
				function( event ) {
					self.start_save_and_continue( event, $( this ) );
				}
			);

			$( document ).on(
				'click',
				'[data-wpbc-bfb-publish-save-step="skip"]',
				function( event ) {
					event.preventDefault();
					self.show_chooser_step();
				}
			);

			$( document ).on(
				'click',
				'[data-wpbc-bfb-publish-mode]',
				function( event ) {
					self.open_mode_panel( event, $( this ).attr( 'data-wpbc-bfb-publish-mode' ) );
				}
			);

			$( document ).on(
				'click',
				'[data-wpbc-bfb-publish-submit]',
				function( event ) {
					self.submit_publish( event, $( this ).attr( 'data-wpbc-bfb-publish-submit' ) );
				}
			);

			$( document ).on(
				'click',
				'[data-wpbc-bfb-publish-back="1"]',
				function( event ) {
					self.go_back( event );
				}
			);
		},

		/**
		 * Register global helpers for backward compatibility.
		 *
		 * @return void
		 */
		register_global_helpers: function() {
			var self = this;

			window.wpbc_bfb_publish__open = function( resource_id, shortcode_raw ) {
				self.open_modal( resource_id, shortcode_raw );
			};

			window.wpbc_modal_dialog__show__resource_publish = function( resource_id ) {
				self.open_modal( resource_id, '' );
			};
		},

		/**
		 * Reset modal to default state.
		 *
		 * @return void
		 */
		reset_modal: function() {
			var $modal = this.get_modal();

			if ( ! $modal.length ) {
				return;
			}

			$modal.find( '.wpbc_bfb_publish__notice' ).html( '' );
			$modal.find( '.wpbc_bfb_publish__save_step' ).hide();
			$modal.find( '.wpbc_bfb_publish__chooser' ).hide();
			$modal.find( '.wpbc_bfb_publish__panel' ).hide();
			$modal.find( '.modal-footer' ).hide();
			$modal.find( '.wpbc_bfb_publish__result_actions' ).hide();

			$modal.find( '[data-wpbc-bfb-publish-open-page="1"]' ).hide().attr( 'href', '#' );
			$modal.find( '[data-wpbc-bfb-publish-edit-page="1"]' ).hide().attr( 'href', '#' );
		},

		/**
		 * Show initial save step.
		 *
		 * @return void
		 */
		show_save_step: function() {
			var $modal = this.get_modal();

			if ( ! $modal.length ) {
				return;
			}

			$modal.find( '.wpbc_bfb_publish__chooser' ).hide();
			$modal.find( '.wpbc_bfb_publish__panel' ).hide();
			$modal.find( '.wpbc_bfb_publish__result_actions' ).hide();
			$modal.find( '.wpbc_bfb_publish__save_step' ).show();
			$modal.find( '.modal-footer' ).hide();
		},

		/**
		 * Show chooser step.
		 *
		 * @return void
		 */
		show_chooser_step: function() {
			var $modal = this.get_modal();

			if ( ! $modal.length ) {
				return;
			}

			$modal.find( '.wpbc_bfb_publish__notice' ).html( '' );
			$modal.find( '.wpbc_bfb_publish__save_step' ).hide();
			$modal.find( '.wpbc_bfb_publish__panel' ).hide();
			$modal.find( '.wpbc_bfb_publish__result_actions' ).hide();
			$modal.find( '.wpbc_bfb_publish__chooser' ).show();
			$modal.find( '.modal-footer' ).show();
		},

		/**
		 * Open modal from toolbar button.
		 *
		 * @param {Object} event   Click event.
		 * @param {jQuery} $button Button.
		 *
		 * @return void
		 */
		open_from_button: function( event, $button ) {
			var vars         = this.get_vars();
			var resource_id;
			var shortcode_raw;
			var form_name;

			event.preventDefault();

			resource_id   = $button.attr( 'data-wpbc-bfb-resource-id' ) || vars.default_resource_id || 1;
			form_name     = this.get_current_form_name();
			shortcode_raw = $button.attr( 'data-wpbc-bfb-shortcode-raw' ) || vars.default_shortcode_raw || '';

			shortcode_raw = this.normalize_shortcode_raw( shortcode_raw, resource_id, form_name );

			$button.attr( 'data-wpbc-bfb-shortcode-raw', shortcode_raw );
			$button.attr( 'data-wpbc-bfb-form-name', form_name );

			this.open_modal( resource_id, shortcode_raw );
		},

		/**
		 * Open modal.
		 *
		 * @param {number|string} resource_id  Resource ID.
		 * @param {string}        shortcode_raw Shortcode.
		 *
		 * @return void
		 */
		open_modal: function( resource_id, shortcode_raw ) {
			var $modal = this.get_modal();
			var vars   = this.get_vars();
			var form_name;

			if ( ! $modal.length ) {
				return;
			}

			resource_id   = this.normalize_resource_id( resource_id || vars.default_resource_id || 1 );
			form_name     = this.get_current_form_name();
			shortcode_raw = this.normalize_shortcode_raw( shortcode_raw || vars.default_shortcode_raw || '', resource_id, form_name );

			this.reset_modal();

			$modal.find( '#wpbc_bfb_publish__resource_id' ).val( resource_id );
			$modal.find( '#wpbc_bfb_publish__form_name' ).val( form_name );
			$modal.find( '#wpbc_bfb_publish__shortcode_raw' ).val( shortcode_raw );
			$modal.find( '#wpbc_bfb_publish_page_title' ).val( '' );
			$modal.find( '#wpbc_bfb_publish_page_id' ).val( '0' );

			if ( typeof $modal.wpbc_my_modal === 'function' ) {
				$modal.wpbc_my_modal( 'show' );
			} else {
				$modal.show();
			}

			if ( parseInt( vars.is_demo || 0, 10 ) !== 1 ) {
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
		open_mode_panel: function( event, mode ) {
			var $modal = this.get_modal();

			event.preventDefault();

			if ( ! $modal.length ) {
				return;
			}

			$modal.find( '.wpbc_bfb_publish__notice' ).html( '' );
			$modal.find( '.wpbc_bfb_publish__save_step' ).hide();
			$modal.find( '.wpbc_bfb_publish__chooser' ).hide();
			$modal.find( '.wpbc_bfb_publish__panel' ).hide();
			$modal.find( '.wpbc_bfb_publish__panel--' + mode ).show();
			$modal.find( '.modal-footer' ).show();
			$modal.find( '.wpbc_bfb_publish__result_actions' ).hide();
		},

		/**
		 * Return from current step.
		 *
		 * @param {Object} event Click event.
		 *
		 * @return void
		 */
		go_back: function( event ) {
			var $modal = this.get_modal();

			event.preventDefault();

			if ( ! $modal.length ) {
				return;
			}

			$modal.find( '.wpbc_bfb_publish__notice' ).html( '' );
			$modal.find( '.wpbc_bfb_publish__result_actions' ).hide();

			if ( $modal.find( '.wpbc_bfb_publish__panel:visible' ).length ) {
				this.show_chooser_step();
				return;
			}

			if ( $modal.find( '.wpbc_bfb_publish__chooser:visible' ).length ) {
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
		render_notice: function( type, message ) {
			var $modal     = this.get_modal();
			var css_class  = 'notice-info';

			if ( ! $modal.length ) {
				return;
			}

			if ( 'success' === type ) {
				css_class = 'notice-success';
			} else if ( 'error' === type ) {
				css_class = 'notice-error';
			}

			$modal.find( '.wpbc_bfb_publish__notice' ).html(
				'<div class="wpbc-settings-notice notice ' + css_class + '" style="text-align:left;font-size:1rem;margin-top:0;">' +
					message +
				'</div>'
			);
		},

		/**
		 * Start save flow and continue to chooser after save.
		 *
		 * @param {Object} event       Click event.
		 * @param {jQuery} $save_button Save button.
		 *
		 * @return void
		 */
		start_save_and_continue: function( event, $save_button ) {
			var self        = this;
			var vars        = this.get_vars();
			var i18n        = this.get_i18n();
			var save_fn     = window.wpbc_bfb__ajax_save_current_form;
			var save_result = null;
			var has_async_handle = false;
			var finished    = false;
			var busy_seen   = false;
			var poll_id     = null;
			var quick_id    = null;
			var timeout_id  = null;
			var event_names, event_handlers;

			event.preventDefault();

			if ( parseInt( vars.is_demo || 0, 10 ) === 1 ) {
				this.render_notice( 'error', i18n.demo_error || 'This operation is restricted in the demo version.' );
				return;
			}

			if ( 'function' !== typeof save_fn ) {
				this.render_notice( 'error', i18n.save_fn_missing || 'Save function is not available. You can use Skip to continue without saving.' );
				return;
			}

			this.render_notice( 'info', i18n.saving_form || 'Saving booking form...' );
			$save_button.prop( 'disabled', true ).addClass( 'disabled' );

			event_names = array_or_list_to_array( [
				'wpbc:bfb:form:ajax_saved',
				'wpbc:bfb:form:saved',
				'wpbc:bfb:save:done',
				'wpbc:bfb:ajax_saved'
			] );
			event_handlers = [];

			function cleanup() {
				var i;

				if ( poll_id ) {
					window.clearInterval( poll_id );
				}
				if ( quick_id ) {
					window.clearTimeout( quick_id );
				}
				if ( timeout_id ) {
					window.clearTimeout( timeout_id );
				}

				for ( i = 0; i < event_names.length; i++ ) {
					if ( event_handlers[i] ) {
						document.removeEventListener( event_names[i], event_handlers[i] );
					}
				}

				$save_button.prop( 'disabled', false ).removeClass( 'disabled' );
			}

			function finish_success() {
				if ( finished ) {
					return;
				}
				finished = true;

				cleanup();

				self.refresh_publish_button_shortcodes( self.get_current_form_name() );
				self.render_notice( 'success', i18n.save_success || 'Booking form has been saved. Continue with publishing.' );
				self.show_chooser_step();
			}

			function finish_error( message ) {
				if ( finished ) {
					return;
				}
				finished = true;

				cleanup();

				self.render_notice( 'error', message || i18n.save_failed || 'Unable to confirm that the booking form was saved.' );
			}

			try {
				save_result = save_fn( $save_button.get( 0 ) );
			} catch ( err ) {
				finish_error( i18n.save_failed || 'Unable to confirm that the booking form was saved.' );
				return;
			}

			if ( true === save_result ) {
				finish_success();
				return;
			}

			if ( false === save_result ) {
				finish_error( i18n.save_failed || 'Unable to confirm that the booking form was saved.' );
				return;
			}

			if ( save_result && 'function' === typeof save_result.then ) {
				has_async_handle = true;
				save_result.then(
					function() {
						finish_success();
					},
					function() {
						finish_error( i18n.save_failed || 'Unable to confirm that the booking form was saved.' );
					}
				);
			} else if ( save_result && 'function' === typeof save_result.done && 'function' === typeof save_result.fail ) {
				has_async_handle = true;
				save_result
					.done(
						function() {
							finish_success();
						}
					)
					.fail(
						function() {
							finish_error( i18n.save_failed || 'Unable to confirm that the booking form was saved.' );
						}
					);
			}

			event_names.forEach(
				function( event_name, index ) {
					event_handlers[index] = function() {
						finish_success();
					};
					document.addEventListener( event_name, event_handlers[index] );
				}
			);

			poll_id = window.setInterval(
				function() {
					if ( finished ) {
						return;
					}

					if ( $save_button.hasClass( 'wpbc-is-busy' ) ) {
						busy_seen = true;
						return;
					}

					if ( busy_seen ) {
						finish_success();
					}
				},
				250
			);

			quick_id = window.setTimeout(
				function() {
					if ( finished ) {
						return;
					}

					if ( ! has_async_handle && ! busy_seen ) {
						finish_success();
					}
				},
				1000
			);

			timeout_id = window.setTimeout(
				function() {
					if ( finished ) {
						return;
					}

					finish_error( i18n.save_timeout || 'Saving is taking longer than expected. You can wait a little longer or use Skip to continue without waiting.' );
				},
				20000
			);
		},

		/**
		 * Show success action buttons.
		 *
		 * @param {Object} response_data AJAX success data.
		 *
		 * @return void
		 */
		show_result_actions: function( response_data ) {
			var i18n  = this.get_i18n();
			var $modal = this.get_modal();
			var $wrap = $modal.find( '.wpbc_bfb_publish__result_actions' );
			var $view = $modal.find( '[data-wpbc-bfb-publish-open-page="1"]' );
			var $edit = $modal.find( '[data-wpbc-bfb-publish-edit-page="1"]' );

			if ( ! $modal.length ) {
				return;
			}

			$view.hide();
			$edit.hide();

			if ( response_data.view_url ) {
				$view.attr( 'href', response_data.view_url ).text( i18n.view_page || 'Open Page' ).show();
			}

			if ( response_data.edit_url ) {
				$edit.attr( 'href', response_data.edit_url ).text( i18n.edit_page || 'Edit Page' ).show();
			}

			if ( response_data.view_url || response_data.edit_url ) {
				$wrap.css( 'display', 'flex' );
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
		submit_publish: function( event, mode ) {
			var self          = this;
			var vars          = this.get_vars();
			var i18n          = this.get_i18n();
			var $modal        = this.get_modal();
			var resource_id;
			var form_name;
			var shortcode_raw;
			var page_id;
			var page_title;
			var $submit_button;

			event.preventDefault();

			if ( ! $modal.length ) {
				return;
			}

			if ( parseInt( vars.is_demo || 0, 10 ) === 1 ) {
				this.render_notice( 'error', i18n.demo_error || 'This operation is restricted in the demo version.' );
				return;
			}

			resource_id   = this.normalize_resource_id( $modal.find( '#wpbc_bfb_publish__resource_id' ).val() || vars.default_resource_id || 1 );
			form_name     = this.sanitize_form_name( $modal.find( '#wpbc_bfb_publish__form_name' ).val() || this.get_current_form_name() );
			shortcode_raw = this.normalize_shortcode_raw(
				$modal.find( '#wpbc_bfb_publish__shortcode_raw' ).val() || vars.default_shortcode_raw || '',
				resource_id,
				form_name
			);
			page_id       = $modal.find( '#wpbc_bfb_publish_page_id' ).val() || '';
			page_title    = $.trim( $modal.find( '#wpbc_bfb_publish_page_title' ).val() || '' );
			$submit_button = $modal.find( '[data-wpbc-bfb-publish-submit="' + mode + '"]' );

			$modal.find( '#wpbc_bfb_publish__form_name' ).val( form_name );
			$modal.find( '#wpbc_bfb_publish__shortcode_raw' ).val( shortcode_raw );

			if ( 'edit' === mode && ( ! page_id || '0' === page_id ) ) {
				this.render_notice( 'error', i18n.select_page || 'Please select an existing page.' );
				return;
			}

			if ( 'create' === mode && ! page_title ) {
				this.render_notice( 'error', i18n.enter_page_title || 'Please enter a page title.' );
				return;
			}

			this.render_notice( 'info', i18n.loading || 'Publishing booking form...' );
			$modal.find( '.wpbc_bfb_publish__result_actions' ).hide();

			$submit_button.prop( 'disabled', true ).addClass( 'disabled' );

			$.ajax(
				{
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
				}
			)
				.done(
					function( response ) {
						if ( response && response.success && response.data ) {
							self.render_notice( 'success', response.data.message || '' );
							self.show_result_actions( response.data );

							if ( response.data.form_name ) {
								window.WPBC_BFB_Ajax           = window.WPBC_BFB_Ajax || {};
								window.WPBC_BFB_Ajax.form_name = self.sanitize_form_name( response.data.form_name );
								self.refresh_publish_button_shortcodes( response.data.form_name );
							}
						} else if ( response && response.data && response.data.message ) {
							self.render_notice( 'error', response.data.message );
						} else {
							self.render_notice( 'error', i18n.generic_error || 'An unexpected error occurred while publishing the booking form.' );
						}
					}
				)
				.fail(
					function() {
						self.render_notice( 'error', i18n.generic_error || 'An unexpected error occurred while publishing the booking form.' );
					}
				)
				.always(
					function() {
						$submit_button.prop( 'disabled', false ).removeClass( 'disabled' );
					}
				);
		}
	};

	/**
	 * Normalize list helper.
	 *
	 * @param {*} input List-like input.
	 *
	 * @return {Array}
	 */
	function array_or_list_to_array( input ) {
		if ( Array.isArray( input ) ) {
			return input;
		}

		return [];
	}

	$( function() {
		publish_api.init();
	} );

})( jQuery, window, document );