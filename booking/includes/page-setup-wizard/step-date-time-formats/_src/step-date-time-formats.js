/**
 * Coordinate the explicit Local translation action on Setup Wizard Step 3.
 *
 * Draft date/time controls remain owned by the shared shell. This adapter only
 * runs after an explicit button click and sends no locale or package URL; the
 * server derives the current site language and owns the installation target.
 *
 * @package Booking Calendar
 */
( function ( $, window, document ) {
	'use strict';

	var module_config = window.wpbc_setup_wizard_date_time_formats || { i18n: {} };
	var request_sequence = 0;

	/**
	 * Extract a safe message from a failed WordPress AJAX response.
	 *
	 * @param {Object} xhr            jQuery request object.
	 * @param {Object} adapter_config Module configuration.
	 * @return {string} Human-readable error message.
	 */
	function get_error_message( xhr, adapter_config ) {
		if ( xhr && xhr.responseJSON && xhr.responseJSON.data && xhr.responseJSON.data.message ) {
			return String( xhr.responseJSON.data.message );
		}

		return adapter_config.i18n.error || '';
	}

	/**
	 * Extract authorized operation-console records from an AJAX payload.
	 *
	 * @param {Object} payload WordPress AJAX response data.
	 * @return {Array} Safe console records.
	 */
	function get_operation_logs( payload ) {
		if ( ! payload || ! Array.isArray( payload.logs ) ) {
			return [];
		}

		return payload.logs.filter( function ( log_entry ) {
			return log_entry && 'string' === typeof log_entry.message;
		} );
	}

	/**
	 * Append one operation record using text-only DOM output.
	 *
	 * @param {HTMLElement} log_container Console list element.
	 * @param {string}      level         Authorized severity.
	 * @param {string}      message       Human-readable operation message.
	 * @return {void}
	 */
	function append_operation_log( log_container, level, message ) {
		var allowed_levels = [ 'info', 'success', 'warning', 'error' ];
		var log_entry;

		if ( ! log_container || ! message ) {
			return;
		}

		level = -1 !== allowed_levels.indexOf( level ) ? level : 'info';
		log_entry = document.createElement( 'li' );
		log_entry.className = 'wpbc_setup_wizard__translation-console-entry is-' + level;
		log_entry.textContent = String( message );
		log_container.appendChild( log_entry );
	}

	/**
	 * Replace the console list with server-authorized operation records.
	 *
	 * @param {HTMLElement} log_container Console list element.
	 * @param {Array}       operation_logs Authorized console records.
	 * @return {void}
	 */
	function render_operation_logs( log_container, operation_logs ) {
		if ( ! log_container ) {
			return;
		}

		log_container.textContent = '';
		operation_logs.forEach( function ( log_entry ) {
			append_operation_log( log_container, String( log_entry.level || 'info' ), String( log_entry.message || '' ) );
		} );
	}

	/**
	 * Refresh the server-authoritative language and translation-source display.
	 *
	 * @param {HTMLElement} editor           Step editor root.
	 * @param {Object}      language_context Authorized language response.
	 * @return {void}
	 */
	function update_language_context( editor, language_context ) {
		var allowed_statuses = [ 'active', 'available', 'builtin', 'unavailable' ];
		var action_label = editor.querySelector( '[data-wpbc-install-local-translation-label]' );
		var action_button = editor.querySelector( '[data-wpbc-install-local-translation]' );
		var help = editor.querySelector( '[data-wpbc-local-translation-help]' );
		var local_source_recommendation = editor.querySelector( '[data-wpbc-local-source-recommendation]' );
		var source = editor.querySelector( '[data-wpbc-local-translation-source]' );
		var source_label = editor.querySelector( '[data-wpbc-local-translation-source-label]' );
		var status = editor.querySelector( '[data-wpbc-local-translation-status]' );
		var updated = editor.querySelector( '[data-wpbc-local-translation-updated]' );
		var recommendation = editor.querySelector( '[data-wpbc-local-translation-recommendation]' );
		var status_key;

		if ( ! language_context ) {
			return;
		}

		status_key = -1 !== allowed_statuses.indexOf( language_context.status ) ? language_context.status : 'unavailable';
		if ( status ) {
			status.className = 'wpbc_setup_wizard__language-status wpbc_setup_wizard__language-status--' + status_key;
			status.textContent = String( language_context.status_label || '' );
		}
		if ( help ) {
			help.textContent = String( language_context.help || '' );
		}
		if ( source ) {
			source.setAttribute( 'data-wpbc-local-translation-source', String( language_context.translation_source || '' ) );
		}
		if ( source_label ) {
			source_label.textContent = String( language_context.translation_source_label || '' );
		}
		if ( action_label ) {
			action_label.textContent = String( language_context.action_label || action_label.textContent );
		}
		if ( action_button ) {
			action_button.classList.toggle( 'wpbc_setup_wizard__translation-action--recommended', Boolean( language_context.is_local_source_recommended ) );
		}
		if ( local_source_recommendation ) {
			local_source_recommendation.textContent = String( language_context.local_source_recommendation || '' );
			local_source_recommendation.hidden = ! language_context.is_local_source_recommended || ! language_context.local_source_recommendation;
		}
		if ( updated ) {
			updated.textContent = String( language_context.updated_label || '' );
			updated.hidden = ! language_context.updated_label;
		}
		if ( recommendation ) {
			recommendation.textContent = String( language_context.update_recommendation || '' );
			recommendation.hidden = ! language_context.is_update_recommended || ! language_context.update_recommendation;
		}
	}

	/**
	 * Create the shell adapter for the Step 3 explicit action.
	 *
	 * @param {Object} adapter_config Localized module configuration.
	 * @return {Object} Shared shell adapter.
	 */
	function create_date_time_formats_adapter( adapter_config ) {
		var services = null;
		var root = null;
		var editor = null;
		adapter_config = adapter_config || { i18n: {} };
		adapter_config.i18n = adapter_config.i18n || {};

		return {
			/**
			 * Bind the Local translation action when it is authorized and rendered.
			 *
			 * @param {Object} shell_services Domain-neutral shell services.
			 * @return {void}
			 */
			initialize: function ( shell_services ) {
				services = shell_services;
				root = shell_services.root;
				editor = root.querySelector( '[data-wpbc-date-time-formats-editor]' );

				if ( ! editor ) {
					return;
				}

				editor.addEventListener( 'click', function ( event ) {
					var install_button = event.target.closest( '[data-wpbc-install-local-translation]' );
					var feedback;
					var operation_console;
					var console_log;
					var console_state;
					var source;
					var source_label;
					var previous_source;
					var previous_source_label;
					var reload_pending = false;
					var sequence;
					var request_id;
					var request;

					if ( ! install_button ) {
						return;
					}

					event.preventDefault();
					feedback = editor.querySelector( '[data-wpbc-local-translation-feedback]' );
					operation_console = editor.querySelector( '[data-wpbc-local-translation-console]' );
					console_log = editor.querySelector( '[data-wpbc-local-translation-console-log]' );
					console_state = editor.querySelector( '[data-wpbc-local-translation-console-state]' );
					source = editor.querySelector( '[data-wpbc-local-translation-source]' );
					source_label = editor.querySelector( '[data-wpbc-local-translation-source-label]' );
					previous_source = source ? source.getAttribute( 'data-wpbc-local-translation-source' ) : '';
					previous_source_label = source_label ? source_label.textContent : '';
					request_sequence += 1;
					sequence = request_sequence;
					request_id = 'translation_' + Date.now() + '_' + sequence;

					if ( feedback ) {
						feedback.classList.remove( 'is-error', 'is-success' );
						feedback.textContent = '';
					}
					if ( operation_console ) {
						operation_console.hidden = false;
						operation_console.setAttribute( 'aria-busy', 'true' );
						if ( 'function' === typeof operation_console.scrollIntoView ) {
							operation_console.scrollIntoView( { block: 'nearest' } );
						}
					}
					if ( console_state ) {
						console_state.textContent = adapter_config.i18n.working || '';
					}
					if ( console_log ) {
						console_log.textContent = '';
						append_operation_log( console_log, 'info', adapter_config.i18n.connecting || adapter_config.i18n.working || '' );
						append_operation_log( console_log, 'info', adapter_config.i18n.working || '' );
					}
					if ( source ) {
						source.setAttribute( 'data-wpbc-local-translation-source', 'wpbc' );
					}
					if ( source_label ) {
						source_label.textContent = adapter_config.i18n.local_source_label || previous_source_label;
					}

					install_button.disabled = true;
					services.set_status( adapter_config.i18n.working || '' );
					request = $.ajax( {
						url: adapter_config.ajax_url,
						method: 'POST',
						dataType: 'json',
						data: {
							action: adapter_config.action,
							nonce: adapter_config.nonce,
							request_id: request_id
						}
					} );

					request.done( function ( response ) {
						var operation_logs;

						if ( sequence !== request_sequence || ! response || ! response.success || ! response.data || response.data.request_id !== request_id ) {
							return;
						}

						operation_logs = get_operation_logs( response.data );
						render_operation_logs( console_log, operation_logs );
						if ( console_state ) {
							console_state.textContent = adapter_config.i18n.complete || '';
						}

						if ( feedback ) {
							feedback.classList.add( 'is-success' );
							feedback.textContent = String( response.data.message || '' );
						}

						update_language_context( editor, response.data.language );

						services.set_status( String( response.data.message || '' ) );
						if ( true === response.data.reload_page ) {
							reload_pending = true;
							if ( console_state ) {
								console_state.textContent = adapter_config.i18n.reloading || adapter_config.i18n.complete || '';
							}
							window.setTimeout( function () {
								window.location.reload();
							}, 250 );
						}
					} );

					request.fail( function ( xhr ) {
						var message;
						var response_data;
						var operation_logs;

						if ( sequence !== request_sequence ) {
							return;
						}

						message = get_error_message( xhr, adapter_config );
						response_data = xhr && xhr.responseJSON ? xhr.responseJSON.data : null;
						operation_logs = get_operation_logs( response_data );
						if ( response_data && response_data.language ) {
							update_language_context( editor, response_data.language );
						} else {
							if ( source ) {
								source.setAttribute( 'data-wpbc-local-translation-source', previous_source || '' );
							}
							if ( source_label ) {
								source_label.textContent = previous_source_label || '';
							}
						}
						render_operation_logs( console_log, operation_logs );
						if ( 0 === operation_logs.length ) {
							append_operation_log( console_log, 'error', message );
						}
						if ( console_state ) {
							console_state.textContent = adapter_config.i18n.failed || '';
						}
						if ( feedback ) {
							feedback.classList.add( 'is-error' );
							feedback.textContent = message;
						}
						services.set_status( message );
					} );

					request.always( function () {
						if ( sequence === request_sequence && ! reload_pending ) {
							install_button.disabled = false;
							if ( operation_console ) {
								operation_console.setAttribute( 'aria-busy', 'false' );
							}
						}
					} );
				} );
			},

			/**
			 * Step 3 native controls need no draft synchronization.
			 *
			 * @return {void}
			 */
			sync: function () {},

			/**
			 * Server and native required-select validation remain authoritative.
			 *
			 * @return {null} No module-specific invalid control.
			 */
			validate: function () {
				return null;
			}
		};
	}

	window.wpbc_setup_editor_modules = window.wpbc_setup_editor_modules || {};
	window.wpbc_setup_editor_modules.date_time_formats = {
		create: create_date_time_formats_adapter
	};

	if ( window.wpbc_setup_wizard_api && 'function' === typeof window.wpbc_setup_wizard_api.register_step_adapter ) {
		window.wpbc_setup_wizard_api.register_step_adapter( create_date_time_formats_adapter( module_config ) );
	}
}( jQuery, window, document ) );
