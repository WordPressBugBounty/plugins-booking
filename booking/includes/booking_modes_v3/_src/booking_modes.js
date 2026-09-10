/* global jQuery, wpbc_booking_modes_config, wpbc_admin_show_message */
(function ($) {
	'use strict';

	var switch_busy = false;
	var switch_message_storage_key = 'wpbc_booking_modes_v3_switch_success';
	var switch_message_max_age = 120000;

	/**
	 * Read a user-facing error from a WordPress AJAX response.
	 *
	 * @param {Object|undefined} response Parsed AJAX response.
	 * @param {string|undefined} fallback Optional fallback message.
	 * @return {string} Safe error text.
	 */
	function get_error_message(response, fallback) {
		if (
			response
			&& response.data
			&& typeof response.data.message === 'string'
			&& response.data.message.length
		) {
			return response.data.message;
		}

		return fallback || wpbc_booking_modes_config.i18n.error;
	}

	/**
	 * Show a mode-switch error through the existing Booking Calendar notifier.
	 *
	 * @param {string} message Error message.
	 * @param {number|undefined} delay Optional display duration in milliseconds.
	 * @return {void}
	 */
	function show_error(message, delay) {
		if (typeof window.wpbc_admin_show_message === 'function') {
			window.wpbc_admin_show_message(message, 'error', delay || 10000, false);
			return;
		}

		window.alert(message);
	}

	/**
	 * Show a successful QuickStart message through the existing notifier.
	 *
	 * @param {string} message Success message.
	 * @return {void}
	 */
	function show_success(message) {
		if (typeof window.wpbc_admin_show_message === 'function') {
			window.wpbc_admin_show_message(message, 'success', 10000, false);
			return;
		}

		window.alert(message);
	}

	/**
	 * Show non-blocking mode-switch progress through the admin notifier.
	 *
	 * The request must continue immediately, so this intentionally has no alert
	 * fallback when the shared Booking Calendar notifier is unavailable.
	 *
	 * @param {string} message Progress message.
	 * @return {void}
	 */
	function show_info(message) {
		if (typeof window.wpbc_admin_show_message === 'function') {
			window.wpbc_admin_show_message(message, 'info', 10000, false);
		}
	}

	/**
	 * Show the server-confirmed mode activation before redirecting.
	 *
	 * @param {string} message Success message.
	 * @return {void}
	 */
	function show_switch_success(message) {
		if (message && typeof window.wpbc_admin_show_message === 'function') {
			window.wpbc_admin_show_message(message, 'success', 1500, false);
		}
	}

	/**
	 * Save the activated mode for a V1-compatible notice on the final page.
	 *
	 * V3 uses a signed full-administration landing before the final destination,
	 * so an in-page notice shown before navigation would otherwise disappear.
	 * Session storage keeps this presentation-only state out of WordPress data
	 * and naturally isolates it to the tab that initiated the switch.
	 *
	 * @param {string} mode_id Activated mode identifier.
	 * @return {void}
	 */
	function store_switch_success(mode_id) {
		var normalized_mode_id = typeof mode_id === 'string' ? mode_id : '';

		if (!normalized_mode_id) {
			return;
		}

		try {
			window.sessionStorage.setItem(
				switch_message_storage_key,
				JSON.stringify({
					mode_id: normalized_mode_id,
					created_at: Date.now()
				})
			);
		} catch (error) {
			// A blocked or full browser store must never prevent mode switching.
		}
	}

	/**
	 * Show and consume the pending switch message on the final WPBC page.
	 *
	 * The record is removed before validation or display so refreshes, malformed
	 * values, account changes, and stale records cannot replay it. Matching the
	 * localized selected mode prevents a notice from leaking into another mode.
	 *
	 * @return {void}
	 */
	function show_pending_switch_success() {
		var serialized_message;
		var pending_message;
		var current_mode_id = String(wpbc_booking_modes_config.selected_mode_id || '');
		var success_message = wpbc_booking_modes_config.i18n.switch_success || '';

		try {
			serialized_message = window.sessionStorage.getItem(switch_message_storage_key);
			window.sessionStorage.removeItem(switch_message_storage_key);
		} catch (error) {
			return;
		}

		if (!serialized_message || !current_mode_id || typeof success_message !== 'string' || !success_message) {
			return;
		}

		try {
			pending_message = JSON.parse(serialized_message);
		} catch (error) {
			return;
		}

		if (
			!pending_message
			|| pending_message.mode_id !== current_mode_id
			|| typeof pending_message.created_at !== 'number'
			|| pending_message.created_at > Date.now()
			|| Date.now() - pending_message.created_at > switch_message_max_age
		) {
			return;
		}

		show_switch_success(success_message);
	}

	/**
	 * Toggle the shared switching state and all dropdown choices.
	 *
	 * @param {jQuery} $selector Mode selector container.
	 * @param {boolean} is_busy Whether a mode-switch request is active.
	 * @return {void}
	 */
	function set_switching_state($selector, is_busy) {
		switch_busy = is_busy;
		$selector.toggleClass('is-switching', is_busy);

		if (is_busy) {
			$selector.attr('aria-busy', 'true');
			$selector.find('.wpbc_booking_mode_option').attr('aria-disabled', 'true');
			return;
		}

		$selector.removeAttr('aria-busy');
		$selector.find('.wpbc_booking_mode_option').removeAttr('aria-disabled');
	}

	/**
	 * Persist a selected mode and follow the server-approved redirect.
	 *
	 * @param {Event} event Click event for a selector option.
	 * @return {void}
	 */
	function switch_mode(event) {
		var $option = $(event.currentTarget);
		var $selector = $option.closest('.wpbc_booking_modes_selector');
		var mode_id = String($option.data('mode-id') || '');

		event.preventDefault();

		if (switch_busy || !mode_id || $option.hasClass('is-current')) {
			return;
		}

		set_switching_state($selector, true);
		show_info(wpbc_booking_modes_config.i18n.saving || 'Switching Booking Calendar mode...');

		$.ajax({
			url: wpbc_booking_modes_config.ajax_url,
			method: 'POST',
			dataType: 'json',
			data: {
				action: wpbc_booking_modes_config.action,
				nonce: wpbc_booking_modes_config.nonce,
				mode_id: mode_id,
				origin_url: window.location.href.split('#')[0],
				fragment: window.location.hash ? window.location.hash.substring(1) : ''
			}
		}).done(function (response) {
			if (
				!response
				|| response.success !== true
				|| !response.data
				|| typeof response.data.redirect_url !== 'string'
				|| !response.data.redirect_url.length
			) {
				set_switching_state($selector, false);
				show_error(get_error_message(response), 7000);
				return;
			}

			show_switch_success(response.data.message || wpbc_booking_modes_config.i18n.switched);
			store_switch_success(mode_id);
			window.location.assign(response.data.redirect_url);
		}).fail(function (xhr) {
			set_switching_state($selector, false);
			show_error(get_error_message(xhr.responseJSON), 7000);
		});
	}

	/**
	 * Run a separately confirmed, state-changing QuickStart operation.
	 *
	 * @param {Event} event Click event for a QuickStart button.
	 * @return {void}
	 */
	function run_quickstart(event) {
		var $button = $(event.currentTarget);
		var $actions = $button.closest('.wpbc_booking_modes_quickstart_actions');
		var mode_id = String($button.data('mode-id') || '');
		var quickstart = wpbc_booking_modes_config.quickstart || {};

		event.preventDefault();

		if (!mode_id || !quickstart.action || !quickstart.nonce || $button.prop('disabled')) {
			return;
		}

		if (!window.confirm(wpbc_booking_modes_config.i18n.quickstart_confirm)) {
			return;
		}

		$button.prop('disabled', true).attr('aria-busy', 'true');

		$.ajax({
			url: wpbc_booking_modes_config.ajax_url,
			method: 'POST',
			dataType: 'json',
			data: {
				action: quickstart.action,
				nonce: quickstart.nonce,
				mode_id: mode_id
			}
		}).done(function (response) {
			var $test_page;

			if (
				!response
				|| response.success !== true
				|| !response.data
				|| typeof response.data.test_url !== 'string'
				|| !response.data.test_url.length
			) {
				show_error(get_error_message(response, wpbc_booking_modes_config.i18n.quickstart_error));
				return;
			}

			$test_page = $actions.find('.wpbc_booking_modes_test_page');
			$test_page.attr('href', response.data.test_url).removeClass('is-hidden').trigger('focus');
			show_success(response.data.message || wpbc_booking_modes_config.i18n.test_page);
		}).fail(function (xhr) {
			show_error(get_error_message(xhr.responseJSON, wpbc_booking_modes_config.i18n.quickstart_error));
		}).always(function () {
			$button.prop('disabled', false).removeAttr('aria-busy');
		});
	}

	$(document).on('click', '.wpbc_booking_mode_option', switch_mode);
	$(document).on('click', '.wpbc_booking_modes_quickstart_button', run_quickstart);
	$(show_pending_switch_success);
}(jQuery));
