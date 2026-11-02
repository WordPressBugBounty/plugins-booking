/**
 * Thin host adapters for the reusable Booking Inspector domain.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
( function ( window ) {
	'use strict';

	var host_contracts = {
		timeline: {
			trigger_selector: '[data-wpbc-booking-inspector-trigger]',
			active_class: 'is-booking-details-open',
			activation_mode: 'manual',
			owns_trigger_aria: false,
			focus_selector: '[data-wpbc-timeline-booking-select]'
		},
		booking_listing: {
			trigger_selector: '[data-wpbc-booking-inspector-listing-trigger]',
			active_class: 'is-booking-details-open'
		},
		calendar: {
			trigger_selector: '[data-wpbc-booking-inspector-calendar-trigger]',
			active_class: 'is-booking-details-open',
			refresh_legacy_timeline: true
		},
		schedule: {
			trigger_selector: '[data-wpbc-booking-inspector-schedule-trigger]',
			active_class: 'is-booking-details-open',
			refresh_legacy_timeline: true
		}
	};

	/**
	 * Create one host-specific facade over the shared booking-domain controller.
	 *
	 * The facade contains no authorization, field, activity, or template logic.
	 * A MutationObserver only asks the domain controller to reconcile the active
	 * trigger after a host replaces its own rows or booking elements.
	 *
	 * @param {string}      source_identifier Allow-listed host identifier.
	 * @param {HTMLElement} host_root         Host root containing booking triggers.
	 * @param {HTMLElement} shell_host        Empty Inspector shell mount.
	 * @param {Object}      configuration     Server-owned domain configuration.
	 * @return {Object|null} Host facade or null when the contract is unavailable.
	 */
	function create( source_identifier, host_root, shell_host, configuration ) {
		var contract = host_contracts[ source_identifier ];
		var transport = configuration && configuration.transport ? configuration.transport : {};
		var controller;
		var observer;
		var refresh_scheduled = false;
		var host_refresh_generation = 0;
		var host_refresh_request = null;

		if (
			! contract || ! host_root || ! shell_host || source_identifier !== transport.source ||
			! window.wpbc_booking_inspector || 'function' !== typeof window.wpbc_booking_inspector.create
		) {
			return null;
		}

		controller = window.wpbc_booking_inspector.create( host_root, shell_host, configuration, contract );
		if ( ! controller ) {
			return null;
		}

		if ( window.MutationObserver ) {
			observer = new window.MutationObserver( function () {
				if ( refresh_scheduled ) {
					return;
				}
				refresh_scheduled = true;
				window.requestAnimationFrame( function () {
					refresh_scheduled = false;
					controller.refresh();
				} );
			} );
			observer.observe( host_root, { childList: true, subtree: true } );
		}

		/**
		 * Reload a Calendar or Schedule host through its canonical Timeline loader.
		 *
		 * The host keeps request ownership. A monotonically increasing generation
		 * rejects duplicate completion events while the loader rejects stale AJAX
		 * responses and returns the jqXHR needed for teardown.
		 *
		 * @param {CustomEvent} event Booking Inspector save-completion event.
		 * @return {void}
		 */
		function handle_saved( event ) {
			var event_detail = event && event.detail ? event.detail : {};
			var refresh_generation = Number( event_detail.refresh_generation || 0 );
			var timeline_root;
			var timeline_configuration;
			var pending_request;

			if ( ! contract.refresh_legacy_timeline || source_identifier !== event_detail.source ) {
				return;
			}
			if ( refresh_generation && refresh_generation <= host_refresh_generation ) {
				return;
			}
			host_refresh_generation = refresh_generation || host_refresh_generation + 1;
			timeline_root = host_root.querySelector( '.wpbc_timeline_client_border[id]' );
			timeline_configuration = timeline_root && window.wpbc_timeline_obj
				? window.wpbc_timeline_obj[ timeline_root.id ]
				: null;
			if ( ! timeline_configuration || 'function' !== typeof window.wpbc_flextimeline_nav ) {
				return;
			}
			pending_request = window.wpbc_flextimeline_nav( timeline_configuration, 0 );
			if ( ! pending_request || 'function' !== typeof pending_request.done ) {
				return;
			}
			host_refresh_request = pending_request;
			pending_request.done( function () {
				if ( refresh_generation && refresh_generation !== host_refresh_generation ) {
					return;
				}
				controller.refresh();
			} ).always( function () {
				if ( host_refresh_request === pending_request ) {
					host_refresh_request = null;
				}
			} );
		}

		if ( contract.refresh_legacy_timeline ) {
			host_root.addEventListener( 'wpbc:booking-inspector:saved', handle_saved );
		}

		return {
			open: controller.open,
			open_rescheduling: controller.open_rescheduling,
			refresh_after_external_apply: controller.refresh_after_external_apply,
			refresh: controller.refresh,
			close: controller.close,
			destroy: function () {
				if ( contract.refresh_legacy_timeline ) {
					host_root.removeEventListener( 'wpbc:booking-inspector:saved', handle_saved );
				}
				if ( host_refresh_request && 'function' === typeof host_refresh_request.abort ) {
					host_refresh_request.abort();
				}
				host_refresh_request = null;
				if ( observer ) {
					observer.disconnect();
				}
				controller.destroy();
			}
		};
	}

	/**
	 * Create the Timeline host adapter.
	 *
	 * @param {HTMLElement} host_root     Timeline root.
	 * @param {HTMLElement} shell_host    Inspector shell mount.
	 * @param {Object}      configuration Server-owned domain configuration.
	 * @return {Object|null} Host facade or null.
	 */
	function create_timeline( host_root, shell_host, configuration ) {
		return create( 'timeline', host_root, shell_host, configuration );
	}

	/**
	 * Create the Booking Listing host adapter.
	 *
	 * @param {HTMLElement} host_root     Listing root.
	 * @param {HTMLElement} shell_host    Inspector shell mount.
	 * @param {Object}      configuration Server-owned domain configuration.
	 * @return {Object|null} Host facade or null.
	 */
	function create_booking_listing( host_root, shell_host, configuration ) {
		return create( 'booking_listing', host_root, shell_host, configuration );
	}

	/**
	 * Create the Calendar host adapter.
	 *
	 * @param {HTMLElement} host_root     Calendar root.
	 * @param {HTMLElement} shell_host    Inspector shell mount.
	 * @param {Object}      configuration Server-owned domain configuration.
	 * @return {Object|null} Host facade or null.
	 */
	function create_calendar( host_root, shell_host, configuration ) {
		return create( 'calendar', host_root, shell_host, configuration );
	}

	/**
	 * Create the Schedule host adapter.
	 *
	 * @param {HTMLElement} host_root     Schedule root.
	 * @param {HTMLElement} shell_host    Inspector shell mount.
	 * @param {Object}      configuration Server-owned domain configuration.
	 * @return {Object|null} Host facade or null.
	 */
	function create_schedule( host_root, shell_host, configuration ) {
		return create( 'schedule', host_root, shell_host, configuration );
	}

	/**
	 * Mount declarative production hosts rendered by Booking Calendar pages.
	 *
	 * A host owns only its root and source identifier. Server-localized
	 * configurations remain authoritative, and the selected factory delegates
	 * every booking concern to the shared booking-domain controller.
	 *
	 * @return {void}
	 */
	function mount_registered_hosts() {
		var configurations = window.wpbc_booking_inspector_host_configurations || {};
		var factories = {
			calendar: create_calendar,
			schedule: create_schedule
		};

		Array.prototype.forEach.call( document.querySelectorAll( '[data-wpbc-booking-inspector-host-root]' ), function ( host_root ) {
			var source_identifier = host_root.getAttribute( 'data-wpbc-booking-inspector-host-root' );
			var shell_host = host_root.querySelector( '[data-wpbc-booking-inspector-host-shell]' );
			var factory = factories[ source_identifier ];

			if ( host_root.wpbc_booking_inspector_host || ! factory || ! configurations[ source_identifier ] || ! shell_host ) {
				return;
			}
			host_root.wpbc_booking_inspector_host = factory( host_root, shell_host, configurations[ source_identifier ] );
		} );
	}

	window.wpbc_booking_inspector_hosts = window.wpbc_booking_inspector_hosts || {};
	window.wpbc_booking_inspector_hosts.create = create;
	window.wpbc_booking_inspector_hosts.create_timeline = create_timeline;
	window.wpbc_booking_inspector_hosts.create_booking_listing = create_booking_listing;
	window.wpbc_booking_inspector_hosts.create_calendar = create_calendar;
	window.wpbc_booking_inspector_hosts.create_schedule = create_schedule;
	window.wpbc_booking_inspector_hosts.mount_registered_hosts = mount_registered_hosts;

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', mount_registered_hosts );
	} else {
		mount_registered_hosts();
	}
}( window ) );
