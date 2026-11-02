/**
 * Timeline browser-module registry and instance lifecycle contract.
 *
 * This boundary intentionally contains no Timeline rendering, requests, domain
 * rules, or presentation state. It establishes the ordered factory contract
 * used by the page controller and independently owned focused modules.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
( function ( window ) {
	'use strict';

	var existing_api = window.wpbc_timeline_modules;
	var factories = Object.create( null );
	var instances = Object.create( null );
	var contract_version = 1;

	if ( existing_api ) {
		return;
	}

	/**
	 * Normalize one internal module or instance identifier.
	 *
	 * Identifiers are code-owned keys rather than DOM selectors or request data.
	 * Keeping the accepted alphabet narrow prevents ambiguous registry entries.
	 *
	 * @param {string} identifier Candidate identifier.
	 * @return {string} Safe identifier, or an empty string when invalid.
	 */
	function normalize_identifier( identifier ) {
		identifier = String( identifier || '' );

		return /^[a-z0-9_-]+$/.test( identifier ) ? identifier : '';
	}

	/**
	 * Register one Timeline module factory without replacing an existing owner.
	 *
	 * Re-registering the same function is idempotent. A different factory using
	 * an occupied identifier is rejected so separately loaded scripts cannot
	 * silently replace active behavior.
	 *
	 * @param {string}   module_id Stable code-owned module identifier.
	 * @param {Function} factory   Factory returning initialize/destroy methods.
	 * @return {boolean} True when the exact factory owns the identifier.
	 */
	function register_factory( module_id, factory ) {
		module_id = normalize_identifier( module_id );

		if ( ! module_id || 'function' !== typeof factory ) {
			return false;
		}
		if ( factories[ module_id ] ) {
			return factories[ module_id ] === factory;
		}

		factories[ module_id ] = factory;
		return true;
	}

	/**
	 * Report whether a factory is registered for one module identifier.
	 *
	 * @param {string} module_id Stable code-owned module identifier.
	 * @return {boolean} True when a factory is registered.
	 */
	function has_factory( module_id ) {
		module_id = normalize_identifier( module_id );

		return Boolean( module_id && factories[ module_id ] );
	}

	/**
	 * Tear down one module instance without allowing its failure to escape.
	 *
	 * Extension teardown is an isolation boundary: one optional adapter must not
	 * prevent sibling adapters or the read-only Timeline controller from being
	 * released. The registry deliberately keeps the failure local and exposes no
	 * exception text because module errors can contain private runtime state.
	 *
	 * @param {Object|null} instance Candidate module instance.
	 * @return {boolean} True when destroy() completed without throwing.
	 */
	function safely_destroy_instance( instance ) {
		if ( ! instance || 'function' !== typeof instance.destroy ) {
			return false;
		}

		try {
			instance.destroy();
			return true;
		} catch ( error ) {
			return false;
		}
	}

	/**
	 * Create and initialize one uniquely identified module instance.
	 *
	 * A duplicate request returns the existing instance without invoking either
	 * the factory or initialize method again. Factories must return an object
	 * containing both initialize() and destroy() so every mounted module has a
	 * symmetrical lifecycle at every module boundary.
	 *
	 * @param {string} module_id   Registered module identifier.
	 * @param {string} instance_id Stable page-instance identifier.
	 * @param {Object} context     Controller-owned host context for the factory.
	 * @return {Object|null} Initialized module instance, or null on rejection.
	 */
	function create( module_id, instance_id, context ) {
		var instance;

		module_id = normalize_identifier( module_id );
		instance_id = normalize_identifier( instance_id );
		if ( ! module_id || ! instance_id || ! factories[ module_id ] ) {
			return null;
		}
		if ( instances[ instance_id ] ) {
			return instances[ instance_id ];
		}

		try {
			instance = factories[ module_id ]( context && 'object' === typeof context ? context : {} );
		} catch ( error ) {
			return null;
		}
		if (
			! instance
			|| 'function' !== typeof instance.initialize
			|| 'function' !== typeof instance.destroy
		) {
			return null;
		}

		instances[ instance_id ] = instance;
		try {
			instance.initialize();
		} catch ( error ) {
			delete instances[ instance_id ];
			safely_destroy_instance( instance );
			return null;
		}

		return instance;
	}

	/**
	 * Return one current module instance without exposing the registry itself.
	 *
	 * @param {string} instance_id Stable page-instance identifier.
	 * @return {Object|null} Current instance, or null when it is not mounted.
	 */
	function get_instance( instance_id ) {
		instance_id = normalize_identifier( instance_id );

		return instance_id && instances[ instance_id ] ? instances[ instance_id ] : null;
	}

	/**
	 * Destroy and forget one module instance.
	 *
	 * The instance is removed from the registry before its teardown runs. This
	 * prevents a synchronous callback during teardown from retrieving a partly
	 * destroyed controller.
	 *
	 * @param {string} instance_id Stable page-instance identifier.
	 * @return {boolean} True when an active instance was destroyed.
	 */
	function destroy( instance_id ) {
		var instance;

		instance_id = normalize_identifier( instance_id );
		if ( ! instance_id || ! instances[ instance_id ] ) {
			return false;
		}

		instance = instances[ instance_id ];
		delete instances[ instance_id ];
		safely_destroy_instance( instance );
		return true;
	}

	/**
	 * Destroy every instance owned by this Timeline module boundary.
	 *
	 * @return {void}
	 */
	function destroy_all() {
		Object.keys( instances ).forEach( function ( instance_id ) {
			destroy( instance_id );
		} );
	}

	window.wpbc_timeline_modules = {
		contract_version: contract_version,
		register_factory: register_factory,
		has_factory: has_factory,
		create: create,
		get_instance: get_instance,
		destroy: destroy,
		destroy_all: destroy_all
	};
}( window ) );
