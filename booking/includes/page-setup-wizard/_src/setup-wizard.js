/**
 * Coordinate Setup Wizard checkpoint saves, navigation, and dialogs.
 *
 * The server remains authoritative for field allow-lists, step order,
 * revisions, access, and persistence. This adapter performs accessible early
 * validation, ignores stale responses, and never applies canonical settings.
 *
 * @package Booking Calendar
 */
( function ( $, window, document ) {
	'use strict';

	var config = window.wpbc_setup_wizard;
	var root = document.querySelector( '[data-wpbc-setup-wizard]' );
	var statusNode;
	var transition_message_node;
	var request_error_node;
	var request_error_message_node;
	var request_error_reference_node;
	var request_error_request_id_node;
	var activeDialog = null;
	var dialogTrigger = null;
	var activeRequest = null;
	var requestSequence = 0;
	var mode_toolbar_show_timer = null;
	var mode_toolbar_hide_timer = null;
	var save_operation_state = null;
	var request_phases = {
		IDLE: 'idle',
		REQUESTING: 'requesting',
		REDIRECTING: 'redirecting'
	};
	var request_phase = request_phases.IDLE;
	var browser_ready = false;
	var step_adapters = [];

	if ( ! config || ! root ) {
		return;
	}

	statusNode = root.querySelector( '[data-wpbc-setup-wizard-status]' );
	transition_message_node = root.querySelector( '[data-wpbc-setup-wizard-transition-message]' );
	request_error_node = root.querySelector( '[data-wpbc-setup-wizard-request-error]' );
	request_error_message_node = root.querySelector( '[data-wpbc-setup-wizard-request-error-message]' );
	request_error_reference_node = root.querySelector( '[data-wpbc-setup-wizard-request-error-reference]' );
	request_error_request_id_node = root.querySelector( '[data-wpbc-setup-wizard-request-error-request-id]' );

	/**
	 * Set the live status message exposed to assistive technology.
	 *
	 * @param {string} message Status text.
	 * @return {void}
	 */
	function setStatus( message ) {
		if ( statusNode ) {
			statusNode.textContent = message || '';
		}
	}

	/**
	 * Return the normalized data object from a direct or jQuery AJAX response.
	 *
	 * @param {Object} response_or_xhr WordPress response or jQuery request object.
	 * @return {Object} Normalized response data.
	 */
	function get_response_data( response_or_xhr ) {
		var response = response_or_xhr && response_or_xhr.responseJSON
			? response_or_xhr.responseJSON
			: response_or_xhr;

		return response && response.data && 'object' === typeof response.data
			? response.data
			: {};
	}

	/**
	 * Hide and reset the shared request error notice.
	 *
	 * @return {void}
	 */
	function clear_request_error() {
		if ( ! request_error_node ) {
			return;
		}

		request_error_node.hidden = true;
		if ( request_error_message_node ) {
			request_error_message_node.textContent = '';
		}
		if ( request_error_reference_node ) {
			request_error_reference_node.hidden = true;
		}
		if ( request_error_request_id_node ) {
			request_error_request_id_node.textContent = '';
		}
	}

	/**
	 * Show one server or transport failure in the common wizard alert region.
	 *
	 * Text is assigned through textContent so an error returned by any step cannot
	 * inject markup. The request reference helps support staff correlate a visible error
	 * with its server response without exposing internal stack details.
	 *
	 * @param {Object} response_or_xhr WordPress response or jQuery request object.
	 * @return {void}
	 */
	function show_request_error( response_or_xhr ) {
		var response_data = get_response_data( response_or_xhr );
		var request_id = response_data.request_id ? String( response_data.request_id ) : '';

		if ( ! request_error_node || ! request_error_message_node ) {
			return;
		}

		request_error_message_node.textContent = getErrorMessage( response_or_xhr );
		if ( request_error_reference_node && request_error_request_id_node ) {
			request_error_request_id_node.textContent = request_id;
			request_error_reference_node.hidden = ! request_id;
		}

		request_error_node.hidden = false;
		try {
			request_error_node.focus( { preventScroll: true } );
		} catch ( focus_error ) {
			request_error_node.focus();
		}
		try {
			request_error_node.scrollIntoView( {
				behavior: window.matchMedia && window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches ? 'auto' : 'smooth',
				block: 'start'
			} );
		} catch ( scroll_error ) {
			request_error_node.scrollIntoView();
		}
	}

	/**
	 * Release the server-locked forward action after browser initialization.
	 *
	 * The primary action is rendered as a disabled non-submit button so a click
	 * cannot fall through to the browser's native GET form submission before the
	 * shared handlers exist. Form-backed steps recover submit behavior only after
	 * the shared controller and dependent step scripts have finished loading.
	 *
	 * @return {void}
	 */
	function enable_continue_when_ready() {
		var continue_button = root.querySelector( '[data-wpbc-setup-wizard-enable-when-ready]' );

		if ( ! browser_ready || request_phases.IDLE !== request_phase || ! continue_button ) {
			return;
		}

		if ( continue_button.hasAttribute( 'data-wpbc-setup-wizard-submit-when-ready' ) ) {
			continue_button.type = 'submit';
		}
		continue_button.disabled = false;
	}

	/**
	 * Mark the shared shell ready after dependent footer scripts have executed.
	 *
	 * @return {void}
	 */
	function mark_browser_ready() {
		browser_ready = true;
		root.dataset.wpbcSetupWizardBrowserReady = 'true';
		enable_continue_when_ready();
	}

	/**
	 * Defer readiness until parsing and all DOMContentLoaded listeners complete.
	 *
	 * The zero-delay task also covers optimized installations that execute the
	 * footer bundle after DOMContentLoaded while preserving dependency order.
	 *
	 * @return {void}
	 */
	function schedule_browser_ready() {
		var defer_ready = function () {
			window.setTimeout( mark_browser_ready, 0 );
		};

		if ( 'loading' === document.readyState ) {
			document.addEventListener( 'DOMContentLoaded', defer_ready, { once: true } );
			return;
		}

		defer_ready();
	}

	/**
	 * Lock or unlock interactive wizard controls around one active request.
	 *
	 * Repeated calls with the current state are ignored so the original disabled
	 * state of every control remains available for restoration.
	 *
	 * @param {boolean} isBusy Whether a request is active.
	 * @return {void}
	 */
	function setBusy( isBusy ) {
		var current_busy_state = 'true' === root.getAttribute( 'aria-busy' );

		if ( current_busy_state === isBusy ) {
			return;
		}

		root.classList.toggle( 'wpbc_setup_wizard--busy', isBusy );
		root.setAttribute( 'aria-busy', isBusy ? 'true' : 'false' );

		root.querySelectorAll( 'button, input, select, textarea' ).forEach( function ( control ) {
			if ( isBusy ) {
				control.dataset.wpbcWasDisabled = control.disabled ? 'true' : 'false';
				control.disabled = true;
			} else {
				control.disabled = 'true' === control.dataset.wpbcWasDisabled;
				delete control.dataset.wpbcWasDisabled;
			}
		} );

		if ( ! isBusy ) {
			enable_continue_when_ready();
		}
	}

	/**
	 * Update the visible message inside the blocking transition overlay.
	 *
	 * The separate live status node remains responsible for announcements to
	 * assistive technology.
	 *
	 * @param {string} message Visible transition text.
	 * @return {void}
	 */
	function set_transition_message( message ) {
		if ( transition_message_node ) {
			transition_message_node.textContent = message || '';
		}
	}

	/**
	 * Move the request controller between idle, requesting, and redirecting.
	 *
	 * Redirecting deliberately remains busy after the AJAX promise settles. The
	 * old document must stay locked until the browser replaces it.
	 *
	 * @param {string} phase   One value from request_phases.
	 * @param {string} message Visible and announced progress text.
	 * @return {void}
	 */
	function set_request_phase( phase, message ) {
		request_phase = phase;
		root.dataset.requestPhase = phase;

		if ( request_phases.IDLE === phase ) {
			set_transition_message( '' );
			setBusy( false );
			return;
		}

		set_transition_message( message );
		setBusy( true );
		setStatus( message );
	}

	/**
	 * Prevent links or delegated controls from acting outside the idle phase.
	 *
	 * Native form controls are disabled by setBusy(). This capture-phase guard
	 * also blocks the header links and shared product menu before their own click
	 * handlers run while the old document is waiting to be replaced.
	 *
	 * @param {MouseEvent} event Captured click event inside the wizard shell.
	 * @return {void}
	 */
	function prevent_interaction_while_busy( event ) {
		if ( request_phases.IDLE === request_phase ) {
			return;
		}

		event.preventDefault();
		event.stopImmediatePropagation();
	}

	/**
	 * Return every draft field control rendered by the current step.
	 *
	 * @return {HTMLElement[]} Ordered controls.
	 */
	function getFieldControls() {
		return Array.prototype.slice.call( root.querySelectorAll( '[data-wpbc-setup-wizard-field]' ) );
	}

	/**
	 * Find all controls sharing one stable field name.
	 *
	 * @param {string} fieldName Draft field name.
	 * @return {HTMLElement[]} Matching controls.
	 */
	function findFieldControls( fieldName ) {
		return getFieldControls().filter( function ( control ) {
			return control.name === fieldName;
		} );
	}

	/**
	 * Find a field-level error container without interpolating a CSS selector.
	 *
	 * @param {string} fieldName Draft field name.
	 * @return {HTMLElement|null} Matching error node.
	 */
	function findFieldError( fieldName ) {
		var errorNodes = root.querySelectorAll( '[data-wpbc-setup-wizard-error-for]' );
		var matchingNode = null;

		errorNodes.forEach( function ( errorNode ) {
			if ( errorNode.dataset.wpbcSetupWizardErrorFor === fieldName ) {
				matchingNode = errorNode;
			}
		} );

		return matchingNode;
	}

	/**
	 * Clear an existing field error and invalid state.
	 *
	 * @param {string} fieldName Draft field name.
	 * @return {void}
	 */
	function clearFieldError( fieldName ) {
		var errorNode = findFieldError( fieldName );
		var alternateControl = root.querySelector( '[data-wpbc-setup-wizard-error-control-for="' + fieldName + '"]' );

		findFieldControls( fieldName ).forEach( function ( control ) {
			control.removeAttribute( 'aria-invalid' );
		} );
		if ( alternateControl ) {
			alternateControl.removeAttribute( 'aria-invalid' );
		}

		if ( errorNode ) {
			errorNode.textContent = '';
		}
	}

	/**
	 * Render one client- or server-provided field error.
	 *
	 * @param {string} fieldName Draft field name.
	 * @param {string} message Human-readable validation message.
	 * @return {HTMLElement|null} First invalid control.
	 */
	function setFieldError( fieldName, message ) {
		var controls = findFieldControls( fieldName );
		var errorNode = findFieldError( fieldName );
		var alternateControl = root.querySelector( '[data-wpbc-setup-wizard-error-control-for="' + fieldName + '"]' );

		controls.forEach( function ( control ) {
			control.setAttribute( 'aria-invalid', 'true' );
		} );

		if ( errorNode ) {
			errorNode.textContent = message;
		}

		if ( alternateControl ) {
			alternateControl.setAttribute( 'aria-invalid', 'true' );
		}

		return alternateControl || ( controls.length ? controls[ 0 ] : null );
	}


	/**
	 * Lock or unlock the consumer shell for an explicit module operation.
	 *
	 * @param {boolean} is_busy Whether the module operation is active.
	 * @param {string}  message Accessible operation status.
	 * @return {void}
	 */
	function set_step_adapter_busy( is_busy, message ) {
		set_request_phase( is_busy ? request_phases.REQUESTING : request_phases.IDLE, message || '' );
	}

	/**
	 * Register one current-page editor adapter with the shared wizard shell.
	 *
	 * A step module owns its rendering, draft synchronization, and client-side
	 * validation. The shell exposes only navigation-safe services and never
	 * assumes which domain fields are present.
	 *
	 * @param {Object} step_adapter Step-owned adapter contract.
	 * @return {void}
	 */
	function register_step_adapter( step_adapter ) {
		if ( ! step_adapter || 'function' !== typeof step_adapter.initialize ) {
			return;
		}

		step_adapters.push( step_adapter );
		step_adapter.initialize( {
			root: root,
			config: config,
			set_status: setStatus,
			show_error: show_request_error,
			clear_error: clear_request_error,
			set_busy: set_step_adapter_busy,
			set_field_error: setFieldError,
			clear_field_error: clearFieldError,
			open_dialog: openDialog
		} );
	}

	/**
	 * Synchronize every registered step adapter before draft collection.
	 *
	 * @return {void}
	 */
	function sync_step_adapters() {
		step_adapters.forEach( function ( step_adapter ) {
			if ( 'function' === typeof step_adapter.sync ) {
				step_adapter.sync();
			}
		} );
	}

	/**
	 * Validate registered step modules in registration order.
	 *
	 * @return {HTMLElement|null} First invalid control, or null.
	 */
	function validate_step_adapters() {
		var first_invalid_control = null;

		step_adapters.some( function ( step_adapter ) {
			if ( 'function' !== typeof step_adapter.validate ) {
				return false;
			}

			first_invalid_control = step_adapter.validate();
			return Boolean( first_invalid_control );
		} );

		return first_invalid_control;
	}

	window.wpbc_setup_wizard_api = {
		register_step_adapter: register_step_adapter
	};

	/**
	 * Remove every visible validation error from the current step.
	 *
	 * @return {void}
	 */
	function clearFieldErrors() {
		getFieldControls().forEach( function ( control ) {
			clearFieldError( control.name );
		} );

		root.querySelectorAll( '[data-wpbc-review-step].has-error' ).forEach( function ( review_row ) {
			review_row.classList.remove( 'has-error' );
		} );
	}

	/**
	 * Validate required and email fields before forward navigation.
	 *
	 * Server validation remains authoritative. This check provides immediate
	 * keyboard focus and avoids a needless request for obvious omissions.
	 *
	 * @return {boolean} True when client-visible constraints pass.
	 */
	function validateCurrentStep() {
		var controls = getFieldControls();
		var handledFields = {};
		var firstInvalidControl = null;

		clearFieldErrors();

		firstInvalidControl = validate_step_adapters();
		if ( firstInvalidControl ) {
			setStatus( config.i18n.validation_error );
			firstInvalidControl.focus();
			return false;
		}

		controls.forEach( function ( control ) {
			var fieldControls;
			var hasValue;
			var invalidMessage = '';

			if ( handledFields[ control.name ] ) {
				return;
			}
			handledFields[ control.name ] = true;
			fieldControls = findFieldControls( control.name );

			if ( 'radio' === control.type ) {
				hasValue = fieldControls.some( function ( radioControl ) {
					return radioControl.checked;
				} );
			} else if ( 'checkbox' === control.type ) {
				hasValue = control.checked;
			} else {
				hasValue = '' !== String( control.value ).trim();
			}

			if ( control.required && ! hasValue ) {
				invalidMessage = config.i18n.required;
			} else if ( 'email' === control.type && hasValue && control.validity && control.validity.typeMismatch ) {
				invalidMessage = config.i18n.invalid_email;
			}

			if ( invalidMessage ) {
				firstInvalidControl = firstInvalidControl || setFieldError( control.name, invalidMessage );
			}
		} );

		if ( firstInvalidControl ) {
			setStatus( config.i18n.validation_error );
			firstInvalidControl.focus();
			return false;
		}

		return true;
	}

	/**
	 * Collect scalar values from the current allow-listed form controls.
	 *
	 * @return {Object} Draft field values keyed by stable field name.
	 */
	function collectFields() {
		var fieldValues = {};

		sync_step_adapters();

		getFieldControls().forEach( function ( control ) {
			if ( 'radio' === control.type ) {
				if ( control.checked ) {
					fieldValues[ control.name ] = control.value;
				}
				return;
			}

			if ( 'checkbox' === control.type ) {
				fieldValues[ control.name ] = control.checked ? '1' : '0';
				return;
			}

			fieldValues[ control.name ] = control.value;
		} );

		return fieldValues;
	}

	/**
	 * Extract a safe message from a failed WordPress AJAX response.
	 *
	 * @param {Object} response_or_xhr WordPress response or jQuery request object.
	 * @return {string} Human-readable error text.
	 */
	function getErrorMessage( response_or_xhr ) {
		var response_data = get_response_data( response_or_xhr );

		if ( response_data.message ) {
			return String( response_data.message );
		}

		return config.i18n.error;
	}

	/**
	 * Render server-side field errors and focus the first rejected control.
	 *
	 * @param {Object} xhr jQuery request object.
	 * @return {void}
	 */
	function renderServerErrors( xhr ) {
		var responseData = xhr && xhr.responseJSON ? xhr.responseJSON.data : null;
		var firstInvalidControl = null;
		var invalid_step_row = null;

		if ( ! responseData || ( ! responseData.field_errors && ! responseData.invalid_step_id ) ) {
			return;
		}

		Object.keys( responseData.field_errors || {} ).forEach( function ( fieldName ) {
			firstInvalidControl = firstInvalidControl || setFieldError( fieldName, String( responseData.field_errors[ fieldName ] ) );
		} );

		if ( responseData.invalid_step_id ) {
			root.querySelectorAll( '[data-wpbc-review-step]' ).forEach( function ( review_row ) {
				if ( review_row.dataset.wpbcReviewStep === responseData.invalid_step_id ) {
					invalid_step_row = review_row;
					review_row.classList.add( 'has-error' );
				}
			} );
		}

		if ( firstInvalidControl ) {
			firstInvalidControl.focus();
		} else if ( invalid_step_row ) {
			firstInvalidControl = invalid_step_row.querySelector( '[data-wpbc-setup-wizard-edit-step]' );
			if ( firstInvalidControl ) {
				firstInvalidControl.focus();
			}
		}
	}

	/**
	 * Build a stable idempotency key for one page, revision, and field snapshot.
	 *
	 * Two browser tabs receive different entropy, while an unchanged retry after
	 * an ambiguous response reuses the same identifier. Editing a field creates
	 * a new logical operation rather than replaying the previous result.
	 *
	 * @param {Object} field_values Current scalar field snapshot.
	 * @return {string} Stable operation identifier.
	 */
	function get_save_operation_id( field_values ) {
		var normalized_fields = {};
		var field_signature;
		var entropy_values;
		var entropy;
		var operation_id;

		Object.keys( field_values || {} ).sort().forEach( function ( field_name ) {
			normalized_fields[ field_name ] = field_values[ field_name ];
		} );
		field_signature = JSON.stringify( normalized_fields );

		if (
			save_operation_state
			&& save_operation_state.step_id === config.current_step
			&& save_operation_state.revision === config.revision
			&& save_operation_state.field_signature === field_signature
		) {
			return save_operation_state.operation_id;
		}

		if ( window.crypto && 'function' === typeof window.crypto.getRandomValues ) {
			entropy_values = new Uint32Array( 2 );
			window.crypto.getRandomValues( entropy_values );
			entropy = entropy_values[ 0 ].toString( 36 ) + entropy_values[ 1 ].toString( 36 );
		} else {
			entropy = Date.now().toString( 36 ) + Math.random().toString( 36 ).slice( 2, 12 );
		}

		operation_id = (
			'save_' +
			String( config.current_step || '' ).replace( /[^a-z0-9_-]/gi, '' ) + '_' +
			String( config.revision ) + '_' +
			entropy
		).slice( 0, 100 );
		save_operation_state = {
			step_id: config.current_step,
			revision: config.revision,
			field_signature: field_signature,
			operation_id: operation_id
		};

		return operation_id;
	}

	/**
	 * Send one revision-bound action and ignore aborted or stale responses.
	 *
	 * @param {string} action WordPress AJAX action.
	 * @param {Object} payload Action-specific scalar or field values.
	 * @return {void}
	 */
	function sendRequest( action, payload ) {
		var sequence;
		var requestId;

		requestSequence += 1;
		sequence = requestSequence;
		requestId = 'request_' + Date.now() + '_' + sequence;

		if ( activeRequest ) {
			activeRequest.abort();
		}

		clear_request_error();
		set_request_phase( request_phases.REQUESTING, config.i18n.working );

		activeRequest = $.ajax( {
			url: config.ajax_url,
			method: 'POST',
			dataType: 'json',
			data: $.extend( {}, payload, {
				action: action,
				nonce: config.nonce,
				current_step: config.current_step,
				expected_revision: config.revision,
				request_id: requestId
			} )
		} );

		activeRequest.done( function ( response ) {
			if ( sequence !== requestSequence ) {
				return;
			}

			if (
				! response ||
				! response.success ||
				! response.data ||
				response.data.request_id !== requestId
			) {
				set_request_phase( request_phases.IDLE );
				show_request_error( response );
				setStatus( getErrorMessage( response ) );
				return;
			}

			if ( response.data.checkpoint ) {
				config.current_step = response.data.checkpoint.current_step;
				config.revision = response.data.checkpoint.revision;
				root.dataset.revision = String( response.data.checkpoint.revision );
			}

			if ( 'string' !== typeof response.data.redirect_url || '' === response.data.redirect_url.trim() ) {
				set_request_phase( request_phases.IDLE );
				show_request_error( response );
				setStatus( getErrorMessage( response ) );
				return;
			}

			set_request_phase( request_phases.REDIRECTING, config.i18n.loading );

			try {
				window.location.assign( response.data.redirect_url );
			} catch ( redirectError ) {
				set_request_phase( request_phases.IDLE );
				show_request_error( {} );
				setStatus( config.i18n.error );
			}
		} );

		activeRequest.fail( function ( xhr, textStatus ) {
			if ( 'abort' === textStatus || sequence !== requestSequence ) {
				return;
			}

			set_request_phase( request_phases.IDLE );
			show_request_error( xhr );
			renderServerErrors( xhr );
			setStatus( getErrorMessage( xhr ) );
		} );

		activeRequest.always( function () {
			if ( sequence === requestSequence ) {
				activeRequest = null;
				if ( request_phases.REDIRECTING !== request_phase ) {
					set_request_phase( request_phases.IDLE );
				}
			}
		} );
	}

	/**
	 * Return focusable controls currently available in a dialog.
	 *
	 * @param {HTMLElement} dialog Dialog element.
	 * @return {HTMLElement[]} Ordered focusable elements.
	 */
	function getFocusableElements( dialog ) {
		return Array.prototype.slice.call(
			dialog.querySelectorAll( 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])' )
		);
	}

	/**
	 * Open a registered confirmation dialog and transfer focus inside it.
	 *
	 * @param {string} action Dialog action identifier.
	 * @param {HTMLElement} trigger Control that opened the dialog.
	 * @return {boolean} Whether the requested dialog was opened.
	 */
	function openDialog( action, trigger ) {
		var backdrop = root.querySelector( '[data-wpbc-setup-wizard-dialog="' + action + '"]' );

		if ( ! backdrop ) {
			return false;
		}

		dialogTrigger = trigger;
		activeDialog = backdrop;
		backdrop.hidden = false;
		document.body.classList.add( 'wpbc_setup_wizard_dialog_open' );

		window.setTimeout( function () {
			var cancelButton = backdrop.querySelector( '[data-wpbc-setup-wizard-dialog-cancel]' );
			if ( cancelButton ) {
				cancelButton.focus();
			}
		}, 0 );

		return true;
	}

	/**
	 * Close the active dialog, announce its outcome, and restore trigger focus.
	 *
	 * The lifecycle event lets a domain adapter commit or roll back provisional
	 * browser state without adding domain branches to the shared shell.
	 *
	 * @param {string} outcome Either confirm or cancel.
	 * @return {void}
	 */
	function closeDialog( outcome ) {
		var closed_dialog;
		var closed_action;
		var closed_trigger;

		if ( ! activeDialog ) {
			return;
		}

		closed_dialog = activeDialog;
		closed_action = String( closed_dialog.dataset.wpbcSetupWizardDialog || '' );
		closed_trigger = dialogTrigger;
		closed_dialog.hidden = true;
		activeDialog = null;
		document.body.classList.remove( 'wpbc_setup_wizard_dialog_open' );

		if ( closed_trigger ) {
			closed_trigger.focus();
		}
		dialogTrigger = null;

		root.dispatchEvent( new window.CustomEvent( 'wpbc:setup-wizard-dialog-closed', {
			detail: {
				action: closed_action,
				outcome: 'confirm' === outcome ? 'confirm' : 'cancel',
				trigger: closed_trigger
			}
		} ) );
	}

	/**
	 * Synchronize visual selection state with native radio controls.
	 *
	 * Native radio behavior supplies Tab, Space, and arrow-key operation. The
	 * card styling is presentation only and does not determine authorization.
	 *
	 * @return {void}
	 */
	function updateExperienceCards() {
		root.querySelectorAll( '.wpbc_setup_wizard__experience-card' ).forEach( function ( card ) {
			var radioControl = card.querySelector( 'input[type="radio"]' );
			var selectedBadge = card.querySelector( '.wpbc_setup_wizard__selected-badge' );
			var isSelected = radioControl && radioControl.checked;

			card.classList.toggle( 'is-selected', Boolean( isSelected ) );
			if ( selectedBadge ) {
				selectedBadge.hidden = ! isSelected;
			}
		} );
	}

	/**
	 * Hide the Step 4 Booking Mode learning tooltip and cancel pending timers.
	 *
	 * @return {void}
	 */
	function hide_mode_toolbar_tooltip() {
		var toolbar = root.querySelector( '[data-wpbc-setup-wizard-mode-toolbar]' );
		var tooltip = root.querySelector( '[data-wpbc-setup-wizard-mode-toolbar-tooltip]' );

		window.clearTimeout( mode_toolbar_show_timer );
		window.clearTimeout( mode_toolbar_hide_timer );
		mode_toolbar_show_timer = null;
		mode_toolbar_hide_timer = null;

		if ( toolbar ) {
			toolbar.classList.remove( 'is-previewing' );
		}

		if ( tooltip ) {
			tooltip.classList.remove( 'is-visible' );
			tooltip.setAttribute( 'aria-hidden', 'true' );
		}
	}

	/**
	 * Synchronize the preview-only toolbar selector with the Step 4 radio draft.
	 *
	 * The preview deliberately avoids the released `.wpbc_booking_mode_option`
	 * hook because that control performs the canonical Booking Mode mutation.
	 *
	 * @param {string}  mode_id        Validated mode identifier from a radio.
	 * @param {boolean} should_animate Whether to teach the toolbar location.
	 * @return {void}
	 */
	function update_mode_toolbar_preview( mode_id, should_animate ) {
		var toolbar = root.querySelector( '[data-wpbc-setup-wizard-mode-toolbar]' );
		var toolbar_label;
		var tooltip;
		var selected_option = null;
		var reduce_motion;

		if ( ! toolbar ) {
			return;
		}

		toolbar_label = toolbar.querySelector( '[data-wpbc-setup-wizard-mode-toolbar-label]' );
		tooltip = toolbar.querySelector( '[data-wpbc-setup-wizard-mode-toolbar-tooltip]' );
		toolbar.querySelectorAll( '[data-wpbc-setup-wizard-mode-toolbar-option]' ).forEach( function ( option ) {
			var is_selected = option.dataset.wpbcSetupWizardModeToolbarOption === mode_id;

			option.classList.toggle( 'is-current', is_selected );
			option.setAttribute( 'aria-checked', is_selected ? 'true' : 'false' );
			if ( is_selected ) {
				selected_option = option;
			}
		} );

		if ( ! selected_option || ! toolbar_label ) {
			return;
		}

		toolbar_label.textContent = selected_option.dataset.wpbcSetupWizardModeToolbarTitle || selected_option.textContent.trim();
		if ( ! should_animate ) {
			return;
		}

		hide_mode_toolbar_tooltip();
		toolbar.classList.remove( 'is-previewing' );
		void toolbar.offsetWidth;
		toolbar.classList.add( 'is-previewing' );

		reduce_motion = window.matchMedia && window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
		mode_toolbar_show_timer = window.setTimeout( function () {
			toolbar.classList.remove( 'is-previewing' );
			if ( ! tooltip ) {
				return;
			}

			tooltip.classList.add( 'is-visible' );
			tooltip.setAttribute( 'aria-hidden', 'false' );
			setStatus( tooltip.textContent.trim() );
			mode_toolbar_hide_timer = window.setTimeout( hide_mode_toolbar_tooltip, 6500 );
		}, reduce_motion ? 0 : 1900 );
	}

	root.addEventListener( 'click', prevent_interaction_while_busy, true );

	root.addEventListener( 'click', function ( event ) {
		var directionButton = event.target.closest( '[data-wpbc-setup-wizard-direction]' );
		var edit_step_button = event.target.closest( '[data-wpbc-setup-wizard-edit-step]' );
		var dialogButton = event.target.closest( '[data-wpbc-setup-wizard-open-dialog]' );
		var cancelButton = event.target.closest( '[data-wpbc-setup-wizard-dialog-cancel]' );
		var confirmButton = event.target.closest( '[data-wpbc-setup-wizard-confirm]' );
		var mode_toolbar_option = event.target.closest( '[data-wpbc-setup-wizard-mode-toolbar-option]' );
		var dismiss_error_button = event.target.closest( '[data-wpbc-setup-wizard-dismiss-error]' );
		var mode_radio = null;
		var direction;
		var action;
		var submitted_fields;

		if ( dismiss_error_button ) {
			event.preventDefault();
			clear_request_error();
			return;
		}

		if ( edit_step_button ) {
			event.preventDefault();
			sendRequest( config.action_edit, {
				target_step: edit_step_button.dataset.wpbcSetupWizardEditStep
			} );
			return;
		}

		if ( mode_toolbar_option ) {
			event.preventDefault();
			root.querySelectorAll( 'input[name="booking_experience"]' ).forEach( function ( radio_control ) {
				if ( radio_control.value === mode_toolbar_option.dataset.wpbcSetupWizardModeToolbarOption ) {
					mode_radio = radio_control;
				}
			} );

			if ( mode_radio && ! mode_radio.checked ) {
				$( mode_radio ).prop( 'checked', true ).trigger( 'change' );
			}
			return;
		}

		if ( directionButton ) {
			event.preventDefault();
			direction = directionButton.dataset.wpbcSetupWizardDirection;
			if ( 'back' === direction ) {
				clearFieldErrors();
				sendRequest( config.action_back, {} );
				return;
			}

			if ( 'next' !== direction || ! validateCurrentStep() ) {
				return;
			}
			clearFieldErrors();
			submitted_fields = collectFields();
			sendRequest( config.action_save_continue, {
				fields: submitted_fields,
				operation_id: get_save_operation_id( submitted_fields )
			} );
			return;
		}

		if ( dialogButton ) {
			event.preventDefault();
			openDialog( dialogButton.dataset.wpbcSetupWizardOpenDialog, dialogButton );
			return;
		}

		if ( cancelButton ) {
			event.preventDefault();
			closeDialog( 'cancel' );
			return;
		}

		if ( confirmButton ) {
			event.preventDefault();
			action = confirmButton.dataset.wpbcSetupWizardConfirm;
			closeDialog( 'confirm' );
			if ( 'restart' === action || 'skip' === action ) {
				sendRequest( 'restart' === action ? config.action_restart : config.action_skip, {
					confirmation: action
				} );
			}
			return;
		}

		if ( activeDialog && event.target === activeDialog ) {
			closeDialog( 'cancel' );
		}
	} );

	root.addEventListener( 'submit', function ( event ) {
		var continueButton;

		if ( 'wpbc-setup-wizard-step-form' !== event.target.id ) {
			return;
		}

		event.preventDefault();
		continueButton = root.querySelector( '[data-wpbc-setup-wizard-direction="next"]' );
		if ( continueButton && ! continueButton.disabled ) {
			continueButton.click();
		}
	} );

	root.addEventListener( 'change', function ( event ) {
		if ( event.target.matches( '[data-wpbc-setup-wizard-field]' ) ) {
			clearFieldError( event.target.name );
		}

		if ( event.target.matches( 'input[name="booking_experience"]' ) ) {
			updateExperienceCards();
			update_mode_toolbar_preview( event.target.value, true );
		}

		if ( event.target.matches( 'input[name="customer_journey"]' ) ) {
			updateExperienceCards();
		}

	} );

	root.addEventListener( 'input', function ( event ) {
		if ( event.target.matches( '[data-wpbc-setup-wizard-field]' ) ) {
			clearFieldError( event.target.name );
		}
	} );

	document.addEventListener( 'keydown', function ( event ) {
		var dialog;
		var focusable;
		var first;
		var last;

		if ( ! activeDialog ) {
			return;
		}

		if ( 'Escape' === event.key ) {
			event.preventDefault();
			closeDialog( 'cancel' );
			return;
		}

		if ( 'Tab' !== event.key ) {
			return;
		}

		dialog = activeDialog.querySelector( '[role="dialog"]' );
		focusable = getFocusableElements( dialog );
		if ( ! focusable.length ) {
			event.preventDefault();
			dialog.focus();
			return;
		}

		first = focusable[ 0 ];
		last = focusable[ focusable.length - 1 ];
		if ( event.shiftKey && document.activeElement === first ) {
			event.preventDefault();
			last.focus();
		} else if ( ! event.shiftKey && document.activeElement === last ) {
			event.preventDefault();
			first.focus();
		}
	} );

	/**
	 * Restore transient request state when the browser revives this document.
	 *
	 * A page restored from the back-forward cache must not retain the disabled
	 * controls or transition overlay from a navigation that already completed.
	 *
	 * @param {PageTransitionEvent} event Browser page-show event.
	 * @return {void}
	 */
	function restore_transient_request_state( event ) {
		if ( ! event.persisted ) {
			return;
		}

		requestSequence += 1;
		if ( activeRequest ) {
			activeRequest.abort();
			activeRequest = null;
		}

		set_request_phase( request_phases.IDLE );
		setStatus( '' );
	}

	window.addEventListener( 'pageshow', restore_transient_request_state );

	updateExperienceCards();
	if ( root.querySelector( 'input[name="booking_experience"]:checked' ) ) {
		update_mode_toolbar_preview( root.querySelector( 'input[name="booking_experience"]:checked' ).value, false );
	}
	schedule_browser_ready();
}( jQuery, window, document ) );
