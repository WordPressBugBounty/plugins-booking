/**
 * Booking Calendar — Confirm Delete modal helper (BFB Admin)
 *
 * UI.Modal_Confirm_Delete.open(label, on_confirm)
 *
 * Depends on:
 * - UI.Templates.ensure_dom_ref_from_wp_template
 * - UI.Modals.show/hide
 * @file: ../includes/page-form-builder/admin-page-tpl/_out/modal_item_delete.js
 */

(function (w, d) {
	'use strict';

	const Core = (w.WPBC_BFB_Core = w.WPBC_BFB_Core || {});
	const UI   = (Core.UI = Core.UI || {});

	UI.Modal_Confirm_Delete = UI.Modal_Confirm_Delete || {};

	// Idempotency guard.
	if ( UI.Modal_Confirm_Delete.__bound ) {
		return;
	}
	UI.Modal_Confirm_Delete.__bound = true;

	const MODAL_DOM_ID = 'wpbc_bfb_modal__confirm_delete';
	const TPL_MODAL_ID = 'wpbc-bfb-tpl-modal-confirm-delete';

	const SEL_CONFIRM = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-confirm="1"]';
	const SEL_CANCEL  = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-cancel="1"]';

	UI.Modal_Confirm_Delete.open = function (label, on_confirm) {

		const ref = UI.Templates.ensure_dom_ref_from_wp_template( TPL_MODAL_ID, MODAL_DOM_ID );
		if ( !ref || !ref.el ) {
			return;
		}

		const modal_el = ref.el;

		// Insert label into translated message placeholder.
		const label_el = modal_el.querySelector ? modal_el.querySelector( '.wpbc_bfb__confirm_label' ) : null;
		if ( label_el ) {
			label_el.textContent = String( label || '' );
		}

		// Store callback on modal instance (single modal, single active confirm).
		modal_el.__wpbc_bfb_confirm_delete_cb = (typeof on_confirm === 'function') ? on_confirm : null;

		UI.Modals.show( ref.id );
	};

	d.addEventListener( 'click', function (e) {

		const modal_el = d.getElementById( MODAL_DOM_ID );
		if ( !modal_el || !e.target || !e.target.closest ) {
			return;
		}

		const is_confirm = e.target.closest( SEL_CONFIRM );
		if ( is_confirm ) {
			e.preventDefault();

			const cb                              = modal_el.__wpbc_bfb_confirm_delete_cb || null;
			modal_el.__wpbc_bfb_confirm_delete_cb = null;

			UI.Modals.hide( modal_el );

			if ( cb ) {
				try {
					cb();
				} catch ( _e ) {
				}
			}
			return;
		}

		const is_cancel = e.target.closest( SEL_CANCEL );
		if ( is_cancel ) {
			e.preventDefault();
			modal_el.__wpbc_bfb_confirm_delete_cb = null;
			UI.Modals.hide( modal_el );
		}

	}, true );

}( window, document ));
