/* globals window, document, jQuery
* @file: ../includes/page-form-builder/form-settings/_src/global_save_behavior.js
* */
(function (w, d, $) {
	'use strict';

	if (!$) { return; }

	// 1) Click -> call stable saver.
	d.addEventListener('click', function (e) {
		var btn = e.target && e.target.closest
			? e.target.closest('.wpbc_bfb__form_setting_save_btn[data-wpbc-u-save="1"][data-wpbc-u-save-name]')
			: null;

		if (!btn) { return; }

		e.preventDefault();

		if (typeof w.wpbc_save_option_from_element === 'function') {
			w.wpbc_save_option_from_element(btn);
		} else {
			console.error('WPBC | wpbc_save_option_from_element() missing. save-load-option.js is not enqueued.');
		}
	});

	function get_row(btn) {
		return (btn && btn.closest) ? btn.closest('.wpbc-setting[data-scope="global"][data-key]') : null;
	}

	function get_control_value_from_selector(selector) {
		if (!selector) { return ''; }

		var $src = $(selector);
		var $control = $src.is('input,select,textarea') ? $src : $src.find('input,select,textarea').first();
		if (!$control.length) { return ''; }

		// checkbox => On/Off
		if ($control.is(':checkbox')) {
			return $control.is(':checked') ? 'On' : 'Off';
		}
		// radio => checked value in group
		if ($control.is(':radio')) {
			var name = $control.attr('name');
			if (name) {
				var $checked = $('input[type="radio"][name="' + name + '"]:checked');
				return $checked.length ? String($checked.val()) : '';
			}
			return $control.is(':checked') ? String($control.val()) : '';
		}
		// others
		return String($control.val() == null ? '' : $control.val());
	}

	function get_initial_value(row) {
		var type = String(row.getAttribute('data-type') || '');
		if (type === 'radio') {
			var wrap = row.querySelector('.wpbc_bfb__form_setting_radio[data-wpbc-bfb-fs-initial]');
			return wrap ? String(wrap.getAttribute('data-wpbc-bfb-fs-initial') || '') : '';
		}
		var control = row.querySelector('[data-wpbc-bfb-fs-initial]');
		return control ? String(control.getAttribute('data-wpbc-bfb-fs-initial') || '') : '';
	}

	function set_initial_value(row, value) {
		var type = String(row.getAttribute('data-type') || '');
		if (type === 'radio') {
			var wrap = row.querySelector('.wpbc_bfb__form_setting_radio');
			if (wrap) { wrap.setAttribute('data-wpbc-bfb-fs-initial', String(value == null ? '' : value)); }
			return;
		}
		var control = row.querySelector('[data-wpbc-bfb-fs-initial]');
		if (control) { control.setAttribute('data-wpbc-bfb-fs-initial', String(value == null ? '' : value)); }
	}

	function update_dirty_state(row) {
		if (!row) { return; }

		var btn = row.querySelector('.wpbc_bfb__form_setting_save_btn[data-wpbc-u-save="1"]');
		if (!btn) { return; }

		var save_ui = String(btn.getAttribute('data-wpbc-u-save-ui') || '');
		if (save_ui !== 'when_changed') { return; }

		var wrap = row.querySelector('.wpbc_bfb__form_setting_save');
		if (!wrap) { return; }

		var value_from = btn.getAttribute('data-wpbc-u-save-value-from') || '';
		var current = get_control_value_from_selector(value_from);
		var initial = get_initial_value(row);

		var dirty = String(current) !== String(initial);

		wrap.classList.toggle( 'is-hidden', !dirty );
		wrap.hidden = !dirty;
		wrap.setAttribute( 'aria-hidden', (!dirty) ? 'true' : 'false' );
	}

	// 2) Any change in global controls -> show/hide Save (when_changed).
	$(d).on(
		'input change',
		'.wpbc-setting[data-scope="global"] input, .wpbc-setting[data-scope="global"] select, .wpbc-setting[data-scope="global"] textarea',
		function () {
			update_dirty_state(get_row(this));
		}
	);

	// 3) After successful save -> set new initial, hide Save again.
	var last_btn = null;

	$(d).on('wpbc:option:beforeSave', function (evt, $el) {
		last_btn = ($el && $el.length) ? $el.get(0) : null;
	});

	$(d).on('wpbc:option:afterSave', function (evt, resp) {
		if (!resp || !resp.success || !last_btn) { return; }

		var row = get_row(last_btn);
		if (!row) { return; }

		var value_from = last_btn.getAttribute('data-wpbc-u-save-value-from') || '';
		var current = get_control_value_from_selector(value_from);

		set_initial_value(row, current);
		update_dirty_state(row);
	});

	// Init pass.
	$(function () {
		$('.wpbc-setting[data-scope="global"]').each(function () {
			update_dirty_state(this);
		});
	});

}(window, document, window.jQuery));
