( function () {
	'use strict';

	var config = window.wpbc_appointment_http_test_config || {};
	var resultsElement;

	/**
	 * Escape diagnostic text before inserting it into the results table.
	 *
	 * @param {*} value Raw diagnostic value.
	 * @returns {string} HTML-safe text.
	 */
	function escapeHtml( value ) {
		return String( value == null ? '' : value )
			.replace( /&/g, '&amp;' )
			.replace( /</g, '&lt;' )
			.replace( />/g, '&gt;' )
			.replace( /"/g, '&quot;' )
			.replace( /'/g, '&#039;' );
	}

	/**
	 * Render all HTTP test results without trusting response HTML.
	 *
	 * @param {Array<Object>} results Test results.
	 * @returns {void}
	 */
	function renderResults( results ) {
		resultsElement.innerHTML = results.map( function ( result ) {
			var status = result.passed ? 'PASS' : ( result.skipped ? 'SKIP' : 'FAIL' );
			var color = result.passed ? '#008a20' : ( result.skipped ? '#996800' : '#b32d2e' );
			return '<tr><td><strong style="color:' + color + '">' + status + '</strong></td><td>' + escapeHtml( result.label ) + '</td><td>' + escapeHtml( result.details || '' ) + '</td></tr>';
		} ).join( '' );
	}

	/**
	 * Send one real request to the existing WordPress Appointment AJAX action.
	 *
	 * @param {Object} overrides Request overrides.
	 * @returns {Promise<Object>} HTTP status and parsed response.
	 */
	function requestStage( overrides ) {
		var body = new URLSearchParams( {
			action: config.action,
			nonce: config.nonce,
			config_token: config.config_token,
			service_id: 0,
			provider_id: 0
		} );
		Object.keys( overrides || {} ).forEach( function ( key ) {
			body.set( key, overrides[ key ] );
		} );

		return window.fetch( config.ajax_url, {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
			body: body.toString()
		} ).then( function ( response ) {
			return response.json().then( function ( payload ) {
				return { status: response.status, payload: payload };
			} );
		} );
	}

	/**
	 * Send one real request to the read-only time-preflight endpoint.
	 *
	 * @param {Object} nativeContext Signed Service/Provider form context.
	 * @param {Object} overrides Request overrides.
	 * @returns {Promise<Object>} HTTP status and parsed response.
	 */
	function requestTimePreflight( nativeContext, overrides ) {
		var body = new URLSearchParams( {
			action: config.validate_action,
			nonce: config.nonce,
			service_id: nativeContext.service_id,
			provider_id: nativeContext.provider_id,
			context_token: nativeContext.context_token,
			'dates[]': '2099-12-31',
			start_time: '00:00'
		} );
		Object.keys( overrides || {} ).forEach( function ( key ) {
			body.set( key, overrides[ key ] );
		} );

		return window.fetch( config.ajax_url, {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
			body: body.toString()
		} ).then( function ( response ) {
			return response.json().then( function ( payload ) {
				return { status: response.status, payload: payload };
			} );
		} );
	}

	/**
	 * Send one bulk Start Time availability request through WordPress AJAX.
	 *
	 * @param {Object} nativeContext Signed Service/Provider form context.
	 * @param {Array<string>} startTimes Strict Start Time values.
	 * @returns {Promise<Object>} HTTP status and parsed response.
	 */
	function requestStartTimeList( nativeContext, startTimes ) {
		var body = new URLSearchParams( {
			action: config.validate_action,
			nonce: config.nonce,
			service_id: nativeContext.service_id,
			provider_id: nativeContext.provider_id,
			context_token: nativeContext.context_token,
			'dates[]': '2099-12-31'
		} );
		startTimes.forEach( function ( startTime ) {
			body.append( 'start_times[]', startTime );
		} );

		return window.fetch( config.ajax_url, {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
			body: body.toString()
		} ).then( function ( response ) {
			return response.json().then( function ( payload ) {
				return { status: response.status, payload: payload };
			} );
		} );
	}

	/**
	 * Send an authenticated request to a test-only controller action.
	 *
	 * @param {string} action WordPress AJAX action.
	 * @param {Object} parameters Additional request values.
	 * @returns {Promise<Object>} HTTP status and parsed response.
	 */
	function requestTestController( action, parameters ) {
		var body = new URLSearchParams( {
			action: action,
			nonce: config.creation_nonce
		} );
		Object.keys( parameters || {} ).forEach( function ( key ) {
			body.set( key, parameters[ key ] );
		} );

		return window.fetch( config.ajax_url, {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
			body: body.toString()
		} ).then( function ( response ) {
			return response.json().then( function ( payload ) {
				return { status: response.status, payload: payload };
			} );
		} );
	}

	/**
	 * Send prepared fixture parameters to the normal booking-creation endpoint.
	 *
	 * @param {Object} createRequest Sanitized parameters returned by the test controller.
	 * @returns {Promise<Object>} HTTP status and parsed booking response.
	 */
	function requestBookingCreation( createRequest ) {
		var body = new URLSearchParams( {
			action: config.create_action,
			wpbc_ajx_user_id: config.create_user_id,
			nonce: config.create_nonce,
			wpbc_ajx_locale: config.create_locale || 'en_US'
		} );
		Object.keys( createRequest || {} ).forEach( function ( key ) {
			body.set( 'calendar_request_params[' + key + ']', createRequest[ key ] );
		} );

		return window.fetch( config.ajax_url, {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
			body: body.toString()
		} ).then( function ( response ) {
			return response.json().then( function ( payload ) {
				return { status: response.status, payload: payload };
			} );
		} );
	}

	/**
	 * Render controlled booking-creation results.
	 *
	 * @param {Array<Object>} results Creation and cleanup assertions.
	 * @returns {void}
	 */
	function renderCreationResults( results ) {
		var resultsNode = document.getElementById( 'wpbc-appointment-creation-test-results' );
		if ( ! resultsNode ) {
			return;
		}
		resultsNode.innerHTML = results.map( function ( result ) {
			var status = result.passed ? 'PASS' : ( result.skipped ? 'SKIP' : 'FAIL' );
			var color = result.passed ? '#008a20' : ( result.skipped ? '#996800' : '#b32d2e' );
			return '<tr><td><strong style="color:' + color + '">' + status + '</strong></td><td>' + escapeHtml( result.label ) + '</td><td>' + escapeHtml( result.details || '' ) + '</td></tr>';
		} ).join( '' );
	}

	/**
	 * Run the explicitly confirmed real booking creation and immediate cleanup.
	 *
	 * @returns {Promise<void>} Completion promise.
	 */
	function runCreationTests() {
		var fixtureNode = document.getElementById( 'wpbc-appointment-creation-fixture' );
		var dateNode = document.getElementById( 'wpbc-appointment-creation-date' );
		var timeNode = document.getElementById( 'wpbc-appointment-creation-time' );
		var confirmNode = document.getElementById( 'wpbc-appointment-creation-confirm' );
		var creationButton = document.getElementById( 'wpbc-run-appointment-creation-tests' );
		var results = [];
		var fixtureToken = '';
		var createdBookingId = 0;
		if ( ! config.creation_enabled || ! fixtureNode || ! dateNode || ! timeNode || ! confirmNode || ! creationButton ) {
			return Promise.resolve();
		}
		var fixtureIds = String( fixtureNode.value || '' ).split( ':' );
		if ( 2 !== fixtureIds.length || ! Number( fixtureIds[ 0 ] ) || ! Number( fixtureIds[ 1 ] ) ) {
			renderCreationResults( [ { passed: false, skipped: true, label: 'Active Service/Provider fixture', details: 'Create an active Service and assign an active Provider before running creation tests.' } ] );
			return Promise.resolve();
		}
		if ( ! confirmNode.checked ) {
			renderCreationResults( [ { passed: false, label: 'Explicit creation confirmation', details: 'Select the confirmation checkbox before running a destructive fixture.' } ] );
			return Promise.resolve();
		}
		if ( creationButton.disabled ) {
			return Promise.resolve();
		}
		creationButton.disabled = true;

		renderCreationResults( [ { passed: false, skipped: true, label: 'Controlled fixture', details: 'Preparing a marker-owned fixture...' } ] );
		return requestTestController( config.creation_prepare_action, {
			confirmed: '1',
			service_id: fixtureIds[ 0 ],
			provider_id: fixtureIds[ 1 ],
			date: dateNode.value,
			start_time: timeNode.value
		} ).then( function ( response ) {
			var prepared = 200 === response.status && response.payload.success && response.payload.data && response.payload.data.token;
			if ( ! prepared ) {
				throw new Error( response.payload && response.payload.data && response.payload.data.message ? response.payload.data.message : 'Fixture preparation failed with HTTP ' + response.status + '.' );
			}
			fixtureToken = response.payload.data.token;
			results.push( { passed: true, label: 'One-time fixture prepared', details: 'The server validated the Service, Provider, date, time, capability, nonce, and explicit confirmation.' } );
			return requestBookingCreation( response.payload.data.create_request );
		} ).then( function ( response ) {
			var payloadStatus = response.payload && response.payload.ajx_data ? response.payload.ajx_data.status : '';
			var created = 200 === response.status && 'ok' === payloadStatus && 0 < Number( response.payload.booking_id || 0 );
			createdBookingId = created ? Number( response.payload.booking_id ) : 0;
			results.push( {
				passed: created,
				label: 'Normal WordPress booking endpoint creates the Appointment',
				details: created ? 'Created temporary Booking #' + createdBookingId + ' with emails disabled.' : ( response.payload && response.payload.ajx_data && response.payload.ajx_data.ajx_after_action_message ? response.payload.ajx_data.ajx_after_action_message : 'The selected date/time was rejected or the endpoint returned an unexpected response.' )
			} );
			return requestTestController( config.creation_cleanup_action, {
				token: fixtureToken,
				booking_id: createdBookingId
			} );
		} ).then( function ( response ) {
			var fixture = response.payload && response.payload.success && response.payload.data && response.payload.data.fixtures ? response.payload.data.fixtures[ 0 ] : null;
			if ( ! fixture ) {
				throw new Error( 'The cleanup controller returned an invalid response.' );
			}
			results.push( { passed: fixture.snapshot_valid, skipped: ! createdBookingId, label: 'Immutable Appointment snapshot is created', details: fixture.snapshot_valid ? 'The snapshot matches the exact Service and Provider.' : ( createdBookingId ? 'No matching snapshot was found.' : 'Skipped because booking creation was rejected.' ) } );
			results.push( { passed: fixture.duration_valid, skipped: ! createdBookingId, label: 'Stored interval matches effective Service duration', details: fixture.duration_valid ? 'The saved start/end interval equals the immutable duration.' : ( createdBookingId ? 'The stored interval or duration did not match.' : 'Skipped because booking creation was rejected.' ) } );
			results.push( {
				passed: 0 === Number( fixture.remaining_records ) && ( ! createdBookingId || fixture.deleted ),
				label: 'Fixture cleanup is complete',
				details: fixture.deleted ? 'The marker-owned booking, dates, and Appointment snapshot were removed.' : ( createdBookingId ? 'The created marker-owned booking was not removed.' : 'No marker-owned booking remains after the rejected request.' )
			} );
		} ).catch( function ( error ) {
			results.push( { passed: false, label: 'Controlled booking creation lifecycle', details: error.message } );
			if ( fixtureToken ) {
				return requestTestController( config.creation_cleanup_action, { token: fixtureToken, booking_id: createdBookingId } ).catch( function () {
					return null;
				} );
			}
			return null;
		} ).then( function () {
			confirmNode.checked = false;
			creationButton.disabled = false;
			renderCreationResults( results );
		} );
	}

	/**
	 * Remove any marker-owned fixtures left by an interrupted browser request.
	 *
	 * @returns {Promise<void>} Completion promise.
	 */
	function cleanPendingCreationFixtures() {
		var cleanupButton = document.getElementById( 'wpbc-clean-appointment-creation-tests' );
		if ( cleanupButton && cleanupButton.disabled ) {
			return Promise.resolve();
		}
		if ( cleanupButton ) {
			cleanupButton.disabled = true;
		}
		return requestTestController( config.creation_cleanup_action, {} ).then( function ( response ) {
			var fixtures = response.payload && response.payload.success && response.payload.data ? response.payload.data.fixtures || [] : [];
			var remaining = fixtures.reduce( function ( total, fixture ) {
				return total + Number( fixture.remaining_records || 0 );
			}, 0 );
			renderCreationResults( [ {
				passed: 0 === remaining,
				label: 'Pending fixture cleanup',
				details: fixtures.length ? 'Checked ' + fixtures.length + ' pending marker-owned fixture(s); ' + remaining + ' record(s) remain.' : 'There were no pending fixtures for this administrator.'
			} ] );
		} ).catch( function ( error ) {
			renderCreationResults( [ { passed: false, label: 'Pending fixture cleanup', details: error.message } ] );
		} ).then( function () {
			if ( cleanupButton ) {
				cleanupButton.disabled = false;
			}
		} );
	}

	/**
	 * Read the signed Appointment context from returned native-form markup.
	 *
	 * Parsing is detached and does not execute renderer scripts.
	 *
	 * @param {string} html Returned stage markup.
	 * @returns {Object|null} Native form context or null.
	 */
	function readNativeFormContext( html ) {
		var documentFragment = new window.DOMParser().parseFromString( String( html || '' ), 'text/html' );
		var nativeForm = documentFragment.querySelector( '.wpbc_booking_appointment__native_form' );
		if ( ! nativeForm ) {
			return null;
		}

		return {
			service_id: Number( nativeForm.getAttribute( 'data-service-id' ) || 0 ),
			provider_id: Number( nativeForm.getAttribute( 'data-provider-id' ) || 0 ),
			duration: String( nativeForm.getAttribute( 'data-duration' ) || '' ),
			service_cost: String( nativeForm.getAttribute( 'data-service-cost' ) || '' ),
			form_slug: String( nativeForm.getAttribute( 'data-form-slug' ) || '' ),
			context_token: String( nativeForm.getAttribute( 'data-appointment-context-token' ) || '' )
		};
	}

	/**
	 * Convert the native HH:MM duration contract to minutes.
	 *
	 * @param {string} value Native duration value.
	 * @returns {number} Duration in minutes, or zero for an invalid value.
	 */
	function durationToMinutes( value ) {
		var parts = String( value || '' ).split( ':' );
		if ( 2 !== parts.length ) {
			return 0;
		}

		return ( Number( parts[ 0 ] || 0 ) * 60 ) + Number( parts[ 1 ] || 0 );
	}

	/**
	 * Execute the browser HTTP portion of the Appointment suite sequentially.
	 *
	 * @returns {Promise<void>} Completion promise.
	 */
	function runTests() {
		var results = [];
		var resolvedNativeContext = null;
		if ( ! config.feature_enabled ) {
			renderResults( [ { passed: false, skipped: true, label: 'Appointment HTTP endpoint', details: 'Enable WPBC_ENABLE_11_5_FEATURES to run endpoint checks.' } ] );
			return Promise.resolve();
		}

		resultsElement.innerHTML = '<tr><td>RUN</td><td>Sending requests to admin-ajax.php...</td><td></td></tr>';

		return requestStage().then( function ( response ) {
			var passed = 200 === response.status && true === response.payload.success && response.payload.data && response.payload.data.stage;
			results.push( { passed: passed, label: 'Valid signed Appointment stage request', details: passed ? 'HTTP 200, stage: ' + response.payload.data.stage : 'Unexpected HTTP ' + response.status } );
		} ).catch( function ( error ) {
			results.push( { passed: false, label: 'Valid signed Appointment stage request', details: error.message } );
		} ).then( function () {
			return requestStage( { config_token: config.config_token + 'x' } );
		} ).then( function ( response ) {
			var code = response.payload && response.payload.data ? response.payload.data.code : '';
			var passed = 400 === response.status && false === response.payload.success && 'appointment_config_invalid' === code;
			results.push( { passed: passed, label: 'Tampered configuration is rejected over HTTP', details: 'HTTP ' + response.status + ( code ? ', code: ' + code : '' ) } );
		} ).catch( function ( error ) {
			results.push( { passed: false, label: 'Tampered configuration is rejected over HTTP', details: error.message } );
		} ).then( function () {
			return requestStage( { nonce: 'invalid-appointment-test-nonce' } );
		} ).then( function ( response ) {
			var passed = 403 === response.status && false === response.payload.success;
			results.push( { passed: passed, label: 'Invalid AJAX nonce is rejected over HTTP', details: 'HTTP ' + response.status } );
		} ).catch( function ( error ) {
			results.push( { passed: false, label: 'Invalid AJAX nonce is rejected over HTTP', details: error.message } );
		} ).then( function () {
			return Promise.all( [ requestStage(), requestStage() ] ).then( function ( responses ) {
				var passed = responses.every( function ( response ) {
					return 200 === response.status && true === response.payload.success && response.payload.data && response.payload.data.stage;
				} );
				results.push( {
					passed: passed,
					label: 'Parallel Appointment stage requests remain isolated',
					details: passed ? 'Both independent WordPress requests returned valid stages.' : 'One or both parallel requests returned an invalid response.'
				} );
			} );
		} ).catch( function ( error ) {
			results.push( { passed: false, label: 'Parallel Appointment stage requests remain isolated', details: error.message } );
		} ).then( function () {
			if ( ! config.service_id || ! config.provider_id ) {
				results.push( { passed: false, skipped: true, label: 'Real Service/Provider native form request', details: 'Create an active Service and assign an active Provider.' } );
				return null;
			}
			return requestStage( { service_id: config.service_id, provider_id: config.provider_id } ).then( function ( response ) {
				var data = response.payload && response.payload.data ? response.payload.data : {};
				var nativeContext = readNativeFormContext( data.html );
				resolvedNativeContext = nativeContext;
				var passed = 200 === response.status &&
					true === response.payload.success &&
					'booking' === data.stage &&
					Number( data.service_id ) === Number( config.service_id ) &&
					Number( data.provider_id ) === Number( config.provider_id ) &&
					nativeContext &&
					Number( nativeContext.service_id ) === Number( config.service_id ) &&
					Number( nativeContext.provider_id ) === Number( config.provider_id ) &&
					durationToMinutes( nativeContext.duration ) === Number( config.duration_minutes ) &&
					String( nativeContext.service_cost ) === String( config.service_cost ) &&
					String( nativeContext.form_slug ) === String( config.form_slug ) &&
					0 < nativeContext.context_token.length &&
					-1 !== String( data.html || '' ).indexOf( 'data-wpbc-appointment-action="start-over"' );
				var details = passed ? 'HTTP 200, native form rendered with matching form, effective duration, edition-appropriate pricing context, signed context, and AJAX Start Over control.' : 'HTTP ' + response.status + ( data.message ? ': ' + data.message : ', native context, form, duration, pricing context, or Start Over control missing/mismatched.' );
				results.push( { passed: passed, label: 'Real Service/Provider native form request', details: details } );
			} );
		} ).catch( function ( error ) {
			results.push( { passed: false, label: 'Real Service/Provider native form request', details: error.message } );
		} ).then( function () {
			if ( ! resolvedNativeContext || ! config.validate_action ) {
				results.push( { passed: false, skipped: true, label: 'Time availability preflight over HTTP', details: 'A signed native Appointment context is required.' } );
				return null;
			}
			return requestTimePreflight( resolvedNativeContext ).then( function ( response ) {
				var data = response.payload && response.payload.data ? response.payload.data : {};
				var passed = 200 === response.status && true === response.payload.success && 'boolean' === typeof data.valid && 'string' === typeof data.message;
				results.push( {
					passed: passed,
					label: 'Time availability preflight over HTTP',
					details: passed ? 'HTTP 200, structured result: ' + ( data.valid ? 'available' : 'unavailable' ) + '.' : 'Unexpected HTTP ' + response.status
				} );
			} );
		} ).catch( function ( error ) {
			results.push( { passed: false, label: 'Time availability preflight over HTTP', details: error.message } );
		} ).then( function () {
			if ( ! resolvedNativeContext || ! config.validate_action ) {
				results.push( { passed: false, skipped: true, label: 'Bulk Start Time filter over HTTP', details: 'A signed native Appointment context is required.' } );
				return null;
			}
			return requestStartTimeList( resolvedNativeContext, [ '00:00', '23:59' ] ).then( function ( response ) {
				var data = response.payload && response.payload.data ? response.payload.data : {};
				var slots = data.slots || {};
				var passed = 200 === response.status &&
					true === response.payload.success &&
					'number' === typeof data.duration &&
					'number' === typeof data.buffer_before &&
					'number' === typeof data.buffer_after &&
					'boolean' === typeof ( slots[ '00:00' ] && slots[ '00:00' ].valid ) &&
					false === ( slots[ '23:59' ] && slots[ '23:59' ].valid );
				results.push( {
					passed: passed,
					label: 'Bulk Start Time filter over HTTP',
					details: passed ? 'One signed request returned structured results for the complete option list.' : 'Unexpected HTTP response or slot result shape.'
				} );
			} );
		} ).catch( function ( error ) {
			results.push( { passed: false, label: 'Bulk Start Time filter over HTTP', details: error.message } );
		} ).then( function () {
			if ( ! resolvedNativeContext || ! config.validate_action ) {
				results.push( { passed: false, skipped: true, label: 'Tampered time-preflight context is rejected', details: 'A signed native Appointment context is required.' } );
				return null;
			}
			return requestTimePreflight( resolvedNativeContext, { context_token: resolvedNativeContext.context_token + 'x' } ).then( function ( response ) {
				var code = response.payload && response.payload.data ? response.payload.data.code : '';
				var passed = 400 === response.status && false === response.payload.success && 'appointment_context_invalid' === code;
				results.push( { passed: passed, label: 'Tampered time-preflight context is rejected', details: 'HTTP ' + response.status + ( code ? ', code: ' + code : '' ) } );
			} );
		} ).catch( function ( error ) {
			results.push( { passed: false, label: 'Tampered time-preflight context is rejected', details: error.message } );
		} ).then( function () {
			renderResults( results );
		} );
	}

	document.addEventListener( 'DOMContentLoaded', function () {
		resultsElement = document.getElementById( 'wpbc-appointment-http-test-results' );
		var button = document.getElementById( 'wpbc-run-appointment-http-tests' );
		if ( ! resultsElement || ! button ) {
			return;
		}
		button.addEventListener( 'click', runTests );
		runTests();

		if ( config.creation_enabled ) {
			var creationButton = document.getElementById( 'wpbc-run-appointment-creation-tests' );
			var cleanupButton = document.getElementById( 'wpbc-clean-appointment-creation-tests' );
			if ( creationButton ) {
				creationButton.addEventListener( 'click', runCreationTests );
			}
			if ( cleanupButton ) {
				cleanupButton.addEventListener( 'click', cleanPendingCreationFixtures );
			}
		}
	} );
}() );
