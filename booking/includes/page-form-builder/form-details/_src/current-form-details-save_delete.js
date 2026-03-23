/*
* @file ../includes/page-form-builder/form-details/_src/current-form-details-save_delete.js
*/
(function (w, d) {
	'use strict';

	function get_value(setting_key) {
		var el = d.getElementById('wpbc_bfb_setting__' + setting_key);
		return el ? el.value : '';
	}

	function collect_form_details() {
		var details = {
			form_name:    String(get_value('bfb_form_details__form_name') || '').trim(),
			title:        String(get_value('bfb_form_details__title') || '').trim(),
			picture_url:  String(get_value('bfb_form_details__picture_url') || '').trim(),
			description:  String(get_value('bfb_form_details__description') || '').trim()
		};

		if ( ! details.title ) {
			details.title = details.form_name || '';
		}

		return details;
	}

	function set_payload_form_details(payload, details_obj) {

		// If payload is FormData -> must stringify.
		if ( payload && typeof payload.append === 'function' ) {
			var json = JSON.stringify(details_obj);

			// Prefer set() if available (prevents duplicates).
			if ( typeof payload.set === 'function' ) {
				payload.set('form_details', json);
			} else {
				payload.append('form_details', json);
			}
			return;
		}

		// Plain object payload (jQuery can serialize nested objects fine in many cases).
		payload.form_details = details_obj;
	}

	function on_before_save_payload(e) {
		var detail = e && e.detail ? e.detail : null;
		if ( ! detail || ! detail.payload || typeof detail.payload !== 'object' ) {
			return;
		}

		set_payload_form_details(detail.payload, collect_form_details());
	}

	function boot() {
		d.addEventListener('wpbc:bfb:form:before_save_payload', on_before_save_payload, { passive: true });
	}

	if ( d.readyState === 'loading' ) {
		d.addEventListener('DOMContentLoaded', boot, { once: true });
	} else {
		boot();
	}


	// == Delete Custom  Form functionality ============================================================================
	var is_ready = false;

	function get_btn_el() {
		return d.getElementById( 'wpbc_bfb__form_details_delete_form' );
	}

	function get_note_el() {
		return d.getElementById( 'wpbc_bfb__form_details_delete_form__note' );
	}

	function get_current_form_name() {
		var el = d.getElementById( 'wpbc_bfb_setting__bfb_form_details__form_name' );
		return el ? String( el.value || '' ).trim() : '';
	}

	function get_current_form_title() {
		var el = d.getElementById( 'wpbc_bfb_setting__bfb_form_details__title' );
		return el ? String( el.value || '' ).trim() : '';
	}

	function set_btn_state(form_name) {
		var btn  = get_btn_el();
		var note = get_note_el();

		if ( ! btn ) {
			return;
		}

		var is_standard = ( 'standard' === String( form_name || '' ).toLowerCase() );

		btn.style.display = is_standard ? 'none' : '';
		if ( note ) {
			note.style.display = is_standard ? '' : 'none';
		}
	}

	function get_ajax_url() {
		if ( w.WPBC_BFB_Ajax && w.WPBC_BFB_Ajax.url ) {
			return w.WPBC_BFB_Ajax.url;
		}
		if ( typeof w.ajaxurl === 'string' && w.ajaxurl ) {
			return w.ajaxurl;
		}
		return '';
	}

	function redirect_to_standard_form() {
		// Best-effort: enforce form_name=standard in URL.
		try {
			var url = new URL( w.location.href );
			url.searchParams.set( 'form_name', 'standard' );
			w.location.href = url.toString();
			return;
		} catch ( e ) {}

		// Fallback.
		w.location.reload();
	}

	function do_ajax_delete(form_name, nonce, action_name, done_cb) {

		var ajax_url = get_ajax_url();
		if ( ! ajax_url || ! w.jQuery ) {
			done_cb( false, { message: 'AJAX is not available.' } );
			return;
		}

		w.jQuery
			.post(
				ajax_url,
				{
					action:    action_name,
					nonce:     nonce,
					form_name: form_name
				}
			)
			.done( function (res) {
				if ( res && res.success ) {
					if ( (res) && (res.data) && (res.data.message) ) {
						wpbc_admin_show_message( 'WPBC BFB: ' + res.data.message, 'success', 10000 );
					} else {
						wpbc_admin_show_message( 'WPBC BFB: Deleted', 'success', 10000 );
					}
					done_cb( true, res.data || {} );
				} else {
					if ( (res) && (res.data) && (res.data.message) ) {
						wpbc_admin_show_message( 'WPBC BFB: ' + resp.data.message, 'error', 10000 );
					} else {
						wpbc_admin_show_message( 'WPBC BFB: Deleted', 'error', 10000 );
					}
					done_cb( false, (res && res.data) ? res.data : {} );
				}
			} )
			.fail( function () {
				wpbc_admin_show_message( 'WPBC BFB: Delete Request failed', 'error', 10000 );

				done_cb( false, { message: 'Request failed.' } );
			} );
	}

	function open_delete_confirm(label, on_confirm) {

		// Prefer the shared BFB confirm modal.
		var core = w.WPBC_BFB_Core || {};
		var ui   = core.UI || {};

		if ( ui.Modal_Confirm_Delete && typeof ui.Modal_Confirm_Delete.open === 'function' ) {
			ui.Modal_Confirm_Delete.open( label, on_confirm );
			return;
		}

		// Fallback (should not happen if modal script + template are loaded).
		var ok = w.confirm( 'Delete "' + String( label || '' ) + '"?\n\nThis action cannot be undone.' );
		if ( ok && typeof on_confirm === 'function' ) {
			on_confirm();
		}
	}

	function on_click_delete(ev) {
		var btn = get_btn_el();

		if ( ! btn ) {
			return;
		}
		ev.preventDefault();
		if ( btn.disabled ) { return; }



		var form_name = get_current_form_name();
		form_name = String( form_name || '' ).toLowerCase();

		if ( ! form_name || 'standard' === form_name ) {
			set_btn_state( form_name );
			return;
		}

		var title = get_current_form_title();
		if ( ! title ) {
			title = form_name;
		}

		var label = title ? title : form_name;

		// Open shared modal (then continue only on confirm).
		open_delete_confirm( label, function () {

			var nonce       = btn.getAttribute( 'data-wpbc-bfb-delete-nonce' ) || '';
			var action_name = btn.getAttribute( 'data-wpbc-bfb-delete-action' ) || 'WPBC_AJX_BFB_DELETE_FORM_CONFIG';

			btn.disabled = true;

			do_ajax_delete( form_name, nonce, action_name, function (is_ok, data) {

				btn.disabled = false;

				if ( ! is_ok ) {
					var msg = (data && data.message) ? String( data.message ) : 'Error deleting form.';
					w.alert( msg );
					return;
				}

				// Notify other modules (optional).
				try {
					d.dispatchEvent(
						new CustomEvent(
							'wpbc:bfb:form:ajax_deleted',
							{ detail: { form_name: form_name, deleted: (data && data.deleted) ? data.deleted : 0 } }
						)
					);
				} catch ( e ) {}

				// Move user to Standard form to avoid reloading a deleted slug.
				redirect_to_standard_form();
			} );
		} );

		return;
	}

	function bind_events() {
		if ( is_ready ) {
			return;
		}
		is_ready = true;

		// Update button visibility after form load/save.
		d.addEventListener(
			'wpbc:bfb:form:ajax_loaded',
			function (e) {
				var detail = e && e.detail ? e.detail : null;
				var name   = detail && detail.form_name ? detail.form_name : get_current_form_name();
				set_btn_state( name );
			},
			{ passive: true }
		);

		d.addEventListener(
			'wpbc:bfb:form:ajax_saved',
			function (e) {
				var detail = e && e.detail ? e.detail : null;
				var name   = detail && detail.form_name ? detail.form_name : get_current_form_name();
				set_btn_state( name );
			},
			{ passive: true }
		);

		// Click handler.
		var btn = get_btn_el();
		if ( btn ) {
			btn.addEventListener( 'click', on_click_delete );
		}

		// Initial state.
		set_btn_state( get_current_form_name() );
	}

	if ( d.readyState === 'loading' ) {
		d.addEventListener( 'DOMContentLoaded', bind_events, { once: true } );
	} else {
		bind_events();
	}

})( window, document );

