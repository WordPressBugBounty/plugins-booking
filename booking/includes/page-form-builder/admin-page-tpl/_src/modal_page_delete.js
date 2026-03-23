/**
 * Booking Calendar — Page Delete Confirm controller (BFB Admin)
 *
 * Depends on:
 * - WPBC_BFB_Core (bfb-core.js)
 * - UI.Templates (bfb-templates.js)
 * - UI.Modals (modal show/hide helpers)
 *
 * @file: ../includes/page-form-builder/admin-page-tpl/_out/modal_page_delete.js
 */

(function (w, d) {
	'use strict';

	const Core = (w.WPBC_BFB_Core = w.WPBC_BFB_Core || {});
	const UI   = (Core.UI = Core.UI || {});

	// -------------------------------------------------------------------------
	// Constants (keep selectors in one place)
	// -------------------------------------------------------------------------

	const ACTION_KEY   = 'bfb_action__page_delete';
	const MODAL_DOM_ID = 'wpbc_bfb_modal__page_delete';
	const TPL_MODAL_ID = 'wpbc-bfb-tpl-modal-page-delete';

	const SEL_TRIGGER = '[data-wpbc-bfb-action="' + ACTION_KEY + '"]';
	const SEL_PAGE    = '.wpbc_bfb__panel--preview';
	const SEL_CONFIRM = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-confirm="1"][data-wpbc-bfb-action="' + ACTION_KEY + '"]';

	// -------------------------------------------------------------------------
	// Module: Page Delete Confirm
	// -------------------------------------------------------------------------

	UI.WPBC_BFB_Page_Delete_Confirm = class extends UI.WPBC_BFB_Module {

		init() {
			if ( !this.builder || !this.builder.pages_container ) {
				return;
			}
			this._bind_events();
		}

		destroy() {
			const b = this.builder;

			try {
				if ( this._on_trigger_click && b && b.pages_container ) {
					b.pages_container.removeEventListener( 'click', this._on_trigger_click, true );
				}
				if ( this._on_confirm_click ) {
					d.removeEventListener( 'click', this._on_confirm_click, true );
				}
			} catch ( _e ) {
			}

			this._on_trigger_click = null;
			this._on_confirm_click = null;
		}

		// -----------------------
		// Event binding
		// -----------------------

		_bind_events() {
			const b = this.builder;

			this._on_trigger_click = (e) => {
				const trigger = this._closest( e.target, SEL_TRIGGER );
				if ( !trigger ) {
					return;
				}

				const page_el = this._closest( trigger, SEL_PAGE );
				if ( !page_el ) {
					return;
				}

				e.preventDefault();
				this._open_modal_for_page( page_el );
			};

			this._on_confirm_click = (e) => {
				const btn = this._closest( e.target, SEL_CONFIRM );
				if ( !btn ) {
					return;
				}

				e.preventDefault();
				this._confirm_delete();
			};

			b.pages_container.addEventListener( 'click', this._on_trigger_click, true );
			d.addEventListener( 'click', this._on_confirm_click, true );
		}

		_closest(el, selector) {
			return (el && el.closest) ? el.closest( selector ) : null;
		}

		// -----------------------
		// Modal open / confirm
		// -----------------------

		_open_modal_for_page(page_el) {
			const page_number = page_el.getAttribute( 'data-page' ) || '';

			const ref = UI.Templates.ensure_dom_ref_from_wp_template(
				TPL_MODAL_ID,
				MODAL_DOM_ID,
				{ page_number: page_number }
			);

			if ( !ref || !ref.el ) {
				// No template/modal available => remove directly.
				this._remove_page_el( page_el );
				return;
			}

			const modal_el = ref.el;

			// Store the target page on the modal instance (one modal, one active target).
			modal_el.__wpbc_bfb_page_el = page_el;

			// Update page number in modal header (optional, template already renders it too).
			const sup = modal_el.querySelector ? modal_el.querySelector( '.wpbc_bfb__modal_page_number' ) : null;
			if ( sup ) {
				sup.textContent = String( page_number );
			}

			UI.Modals.show( ref.id );
		}

		_confirm_delete() {
			const modal_el = d.getElementById( MODAL_DOM_ID );
			if ( !modal_el ) {
				return;
			}

			const page_el               = modal_el.__wpbc_bfb_page_el || null;
			modal_el.__wpbc_bfb_page_el = null;

			if ( page_el ) {
				this._remove_page_el( page_el );
			}

			UI.Modals.hide( modal_el );
		}

		// -----------------------
		// Deletion implementation
		// -----------------------

		_remove_page_el(page_el) {
			const b        = this.builder;
			const selected = (b.get_selected_field) ? b.get_selected_field() : null;

			let neighbor = null;

			// If selection is inside the deleted page, try to select something nearby after deletion.
			if ( selected && page_el.contains( selected ) ) {
				const page_id = page_el.getAttribute( 'data-page' ) || '';
				neighbor      = b.pages_container.querySelector(
					'.wpbc_bfb__panel--preview:not([data-page="' + page_id + '"]) .wpbc_bfb__field:not(.is-invalid)'
				);
			}

			page_el.remove();

			if ( b.usage && b.usage.update_palette_ui ) {
				b.usage.update_palette_ui();
			}

			// Notify structure change.
			try {
				const EV        = Core.WPBC_BFB_Events || {};
				const structure = (typeof b.get_structure === 'function') ? b.get_structure() : null;

				if ( b.bus && b.bus.emit ) {
					b.bus.emit( EV.STRUCTURE_CHANGE, {
						source   : 'page-remove',
						structure: structure,
						page_el  : page_el
					} );
				}
			} catch ( _e ) {
			}

			if ( b.select_field ) {
				b.select_field( neighbor || null );
			}
		}
	};

	// -------------------------------------------------------------------------
	// Auto attach
	// -------------------------------------------------------------------------

	function attach(builder) {
		if ( !builder || typeof builder.use_module !== 'function' ) {
			return;
		}

		if ( builder.__wpbc_bfb_has_page_delete_confirm ) {
			return;
		}

		builder.__wpbc_bfb_has_page_delete_confirm = true;
		builder.use_module( UI.WPBC_BFB_Page_Delete_Confirm );
	}

	if ( w.wpbc_bfb_api && w.wpbc_bfb_api.ready && typeof w.wpbc_bfb_api.ready.then === 'function' ) {
		w.wpbc_bfb_api.ready.then( attach );
	}

}( window, document ));
