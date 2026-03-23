/**
 * Booking Calendar — Load Form modal helper (BFB Admin)
 *
 * UI.Modal_Load_Form.open(on_confirm, on_open)
 *
 * on_confirm(payload):
 * payload = { form_slug: string, form: Object|null }
 *
 * Depends on:
 * - UI.Templates.ensure_dom_ref_from_wp_template
 * - UI.Modals.show/hide
 * - wpbc_bfb__ajax_list_user_forms()
 *
 * @file: ../includes/page-form-builder/admin-page-tpl/_out/modal__form_open.js
 */
(function (w, d) {
	'use strict';

	const Core         = (w.WPBC_BFB_Core = w.WPBC_BFB_Core || {});
	const UI           = (Core.UI = Core.UI || {});
	UI.Modal_Load_Form = UI.Modal_Load_Form || {};

	// Idempotency guard.
	if ( UI.Modal_Load_Form.__bound ) {
		return;
	}
	UI.Modal_Load_Form.__bound = true;

	const MODAL_DOM_ID = 'wpbc_bfb_modal__load_form';
	const TPL_MODAL_ID = 'wpbc-bfb-tpl-modal-load_form';

	const ID_SEARCH = 'wpbc_bfb_popup_modal__load_form__search';

	const SEL_CONFIRM = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-confirm="1"]';
	const SEL_CANCEL  = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-cancel="1"]';
	const SEL_ERROR   = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-error="1"]';

	function has_text(v) {
		return !! (v && String( v ).trim());
	}

	function get_el(id) {
		return d.getElementById( id );
	}

	function get_modal_el() {
		return d.getElementById( MODAL_DOM_ID );
	}

	function set_error(msg) {
		const modal_el = get_modal_el();
		const el       = modal_el ? modal_el.querySelector( '[data-wpbc-bfb-error="1"]' ) : null;
		if ( ! el ) {
			return;
		}

		if ( has_text( msg ) ) {
			el.innerHTML     = String( msg );
			el.style.display = '';
		} else {
			el.innerHTML     = '';
			el.style.display = 'none';
		}
	}

	function set_confirm_enabled(is_enabled) {
		const modal_el = get_modal_el();
		const btn      = modal_el ? modal_el.querySelector( '[data-wpbc-bfb-confirm="1"]' ) : null;
		if ( ! btn ) {
			return;
		}

		if ( is_enabled ) {
			btn.classList.remove( 'disabled' );
			btn.setAttribute( 'aria-disabled', 'false' );
		} else {
			btn.classList.add( 'disabled' );
			btn.setAttribute( 'aria-disabled', 'true' );
		}
	}

	function escape_html(s) {
		return String( s == null ? '' : s )
			.replace( /&/g, '&amp;' )
			.replace( /</g, '&lt;' )
			.replace( />/g, '&gt;' )
			.replace( /"/g, '&quot;' )
			.replace( /'/g, '&#039;' );
	}

	function render_list(modal_el, forms) {
		const root = modal_el ? modal_el.querySelector( '[data-wpbc-bfb-forms-list="1"]' ) : null;
		if ( ! root ) {
			return;
		}

		let html = '';
		let any  = false;

		for ( let i = 0; i < (forms || []).length; i++ ) {
			const item  = forms[i] || {};
			const slug  = String( item.form_slug || '' );
			const title = String( item.title || slug || '' );
			const desc  = String( item.description || '' );
			const pic   = String( item.picture_url || item.image_url || '' );

			if ( ! slug ) {
				continue;
			}
			any = true;

			const thumb = pic
				? '<img src="' + escape_html( pic ) + '" alt="" />'
				: '<div class="wpbc_bfb__load_form_item_thumb_blank_img">No image</div>';

			const meta = '<div class="form_item_text_slug">' + escape_html( slug ) + '</div>';

			const line2 = desc ? '<div class="form_item_text_desc">' + escape_html( desc ) + '</div>' : '';

			html += ''
				+ '<div class="wpbc_bfb__load_form_item" data-wpbc-bfb-form-item="1" data-form-slug="' + escape_html( slug ) + '"'
				+ ' >'
				+ '  <div class="wpbc_bfb__load_form_item_thumb">' + thumb + '</div>'
				+ '  <div  class="wpbc_bfb__load_form_item_text">'
				+ '    <div class="form_item_text_title">' + escape_html( title ) + '</div>'
				+ meta
				+ line2
				+ '  </div>'
				+ '</div>';
		}

		if ( ! any ) {
			html = '<div style="padding:10px;color:#666;">No forms found.</div>';
		}

		root.innerHTML = html;

		// Re-apply selection highlight if still present on this page.
		const sel = modal_el.__wpbc_bfb_selected_form_slug || '';
		if ( sel ) {
			let found = null;
			try {
				found = root.querySelector( '[data-form-slug="' + CSS.escape( sel ) + '"]' );
			} catch ( _e ) {
				found = null;
			}
			if ( found ) {
				// found.style.background = '#f6f7f7';
				found.classList.add( 'wpbc_bfb__load_form_item_selected' );
				set_confirm_enabled( true );
			} else {
				// Selection not on this page anymore -> reset.
				root.querySelectorAll( '.wpbc_bfb__load_form_item' ).forEach( (el) => {
					el.classList.remove( 'wpbc_bfb__load_form_item_selected' );
				} );
				modal_el.__wpbc_bfb_selected_form_slug = '';
				set_confirm_enabled( false );
			}
		}
	}

	function set_pager(modal_el, page, has_more) {
		const pager = modal_el ? modal_el.querySelector( '[data-wpbc-bfb-forms-pager="1"]' ) : null;
		if ( ! pager ) {
			return;
		}

		const prev = pager.querySelector( '[data-wpbc-bfb-page-prev="1"]' );
		const next = pager.querySelector( '[data-wpbc-bfb-page-next="1"]' );
		const lab  = pager.querySelector( '[data-wpbc-bfb-page-label="1"]' );

		page = parseInt( page || 1, 10 );
		if ( ! page || page < 1 ) {
			page = 1;
		}

		if ( lab ) {
			lab.textContent = 'Page ' + page;
		}

		const prev_enabled = (page > 1);
		const next_enabled = !! has_more;

		function set_btn(btn, enabled) {
			if ( ! btn ) {
				return;
			}
			if ( enabled ) {
				btn.classList.remove( 'disabled' );
				btn.setAttribute( 'aria-disabled', 'false' );
			} else {
				btn.classList.add( 'disabled' );
				btn.setAttribute( 'aria-disabled', 'true' );
			}
		}

		set_btn( prev, prev_enabled );
		set_btn( next, next_enabled );
	}

	function set_loading(modal_el, is_loading) {
		const root = modal_el ? modal_el.querySelector( '[data-wpbc-bfb-forms-list="1"]' ) : null;
		if ( ! root ) {
			return;
		}

		if ( is_loading ) {
			const mainNav  = document.querySelector( '.wpbc_bfb_popup_modal__forms_loading_spin_container' ).outerHTML;
			root.innerHTML = mainNav;
			// root.innerHTML = '<div class="wpbc_bfb_popup_modal__forms_loading_spin_container" data-wpbc-bfb-forms-loading="1">Loading...</div>'; //.
		}
	}

	function bind_handlers(modal_el) {
		if ( ! modal_el || modal_el.__wpbc_bfb_handlers_bound ) {
			return;
		}
		modal_el.__wpbc_bfb_handlers_bound = true;

		// Click select item (delegated inside list).
		modal_el.addEventListener( 'click', function (e) {
			if ( ! e || ! e.target || ! e.target.closest ) {
				return;
			}

			const item = e.target.closest( '[data-wpbc-bfb-form-item="1"]' );
			if ( ! item ) {
				return;
			}

			const slug                             = item.getAttribute( 'data-form-slug' ) || '';
			modal_el.__wpbc_bfb_selected_form_slug = slug;

			// Visual highlight
			const root = modal_el.querySelector( '[data-wpbc-bfb-forms-list="1"]' );
			if ( root ) {
				const all = root.querySelectorAll( '[data-wpbc-bfb-form-item="1"]' );
				for ( let i = 0; i < all.length; i++ ) {
					all[i].style.background = '';
				}
			}
			// item.style.background = '#f6f7f7';
			root.querySelectorAll( '.wpbc_bfb__load_form_item' ).forEach( (el) => {
				el.classList.remove( 'wpbc_bfb__load_form_item_selected' );
			} );
			item.classList.add( 'wpbc_bfb__load_form_item_selected' );
			set_confirm_enabled( !! slug );
		}, true );

		// Search filter. (server-side, debounced).
		const search_el = get_el( ID_SEARCH );
		if ( search_el ) {
			if ( ! modal_el.__wpbc_bfb_search_timer ) {
				modal_el.__wpbc_bfb_search_timer = 0;
			}

			search_el.addEventListener( 'input', function () {
				const v = String( search_el.value || '' );

				if ( modal_el.__wpbc_bfb_search_timer ) {
					clearTimeout( modal_el.__wpbc_bfb_search_timer );
				}
				modal_el.__wpbc_bfb_search_timer = setTimeout( function () {
					load_forms( modal_el, 1, v );
				}, 300 );
			}, true );
		}

		// Pager click.
		modal_el.addEventListener( 'click', function (e) {
			if ( ! e || ! e.target || ! e.target.closest ) {
				return;
			}

			const prev = e.target.closest( '[data-wpbc-bfb-page-prev="1"]' );
			const next = e.target.closest( '[data-wpbc-bfb-page-next="1"]' );

			if ( ! prev && ! next ) {
				return;
			}

			e.preventDefault();

			if ( (prev && (prev.classList.contains( 'disabled' ) || prev.getAttribute( 'aria-disabled' ) === 'true')) ||
				(next && (next.classList.contains( 'disabled' ) || next.getAttribute( 'aria-disabled' ) === 'true')) ) {
				return;
			}

			const page   = parseInt( modal_el.__wpbc_bfb_page || 1, 10 ) || 1;
			const search = String( modal_el.__wpbc_bfb_search || '' );

			if ( prev ) {
				load_forms( modal_el, Math.max( 1, page - 1 ), search );
			}
			if ( next ) {
				load_forms( modal_el, page + 1, search );
			}
		}, true );

	}

	function load_forms(modal_el, page, search, done) {
		if ( typeof w.wpbc_bfb__ajax_list_user_forms !== 'function' ) {
			set_error( 'WPBC BFB: list forms helper missing.' );
			set_loading( modal_el, false );
			if ( typeof done === 'function' ) {
				done( false, null );
			}
			return;
		}

		page   = parseInt( page || 1, 10 );
		search = String( search || '' );

		if ( ! page || page < 1 ) {
			page = 1;
		}

		set_error( '' );
		set_confirm_enabled( false );
		modal_el.__wpbc_bfb_selected_form_slug = '';
		set_loading( modal_el, true );

		w.wpbc_bfb__ajax_list_user_forms(
			null,
			{
				include_global: 0,
				page          : page,
				limit         : 20,
				search        : search
			},
			function (ok, data) {
				if ( ! ok || ! data || ! data.forms ) {
					set_loading( modal_el, false );
					set_error( 'Failed to load forms list.' );
					set_pager( modal_el, 1, false );
					if ( typeof done === 'function' ) {
						done( false, null );
					}
					return;
				}

				modal_el.__wpbc_bfb_forms_cache = data.forms || [];
				modal_el.__wpbc_bfb_page        = data.page || page;
				modal_el.__wpbc_bfb_has_more    = !! data.has_more;
				modal_el.__wpbc_bfb_search      = search;

				render_list( modal_el, modal_el.__wpbc_bfb_forms_cache );
				set_pager( modal_el, modal_el.__wpbc_bfb_page, modal_el.__wpbc_bfb_has_more );

				set_error( '' );
				if ( typeof done === 'function' ) {
					done( true, data );
				}
			}
		);
	}


	UI.Modal_Load_Form.open = function (on_confirm, on_open) {

		const ref = UI.Templates.ensure_dom_ref_from_wp_template( TPL_MODAL_ID, MODAL_DOM_ID );
		if ( ! ref || ! ref.el ) {
			return;
		}

		let modal_el = ref.el;
		if ( modal_el && modal_el.id !== MODAL_DOM_ID ) {
			const inside = modal_el.querySelector ? modal_el.querySelector( '#' + MODAL_DOM_ID ) : null;
			if ( inside ) {
				modal_el = inside;
			}
		}
		if ( ! modal_el ) {
			return;
		}

		modal_el.__wpbc_bfb_load_form_cb = (typeof on_confirm === 'function') ? on_confirm : null;

		bind_handlers( modal_el );

		// Reset basic UI.
		const search_el = get_el( ID_SEARCH );
		if ( search_el ) {
			search_el.value = '';
		}
		modal_el.__wpbc_bfb_forms_cache        = [];
		modal_el.__wpbc_bfb_selected_form_slug = '';
		set_error( '' );
		set_confirm_enabled( false );
		set_loading( modal_el, true );

		UI.Modals.show( modal_el );

		// Load list via ajax.
		modal_el.__wpbc_bfb_page     = 1;
		modal_el.__wpbc_bfb_has_more = false;
		modal_el.__wpbc_bfb_search   = '';

		load_forms( modal_el, 1, '' );
		set_pager( modal_el, 1, false );

		// Focus search.
		w.setTimeout( function () {
			const s = get_el( ID_SEARCH );
			if ( s && s.focus ) {
				try { s.focus(); } catch ( _e ) {}
			}
		}, 0 );

		if ( on_open ) {
			try { on_open( modal_el ); } catch ( _e2 ) {}
		}
	};

	// Confirm / Cancel (delegated).
	d.addEventListener( 'click', function (e) {

		const modal_el = get_modal_el();
		if ( ! modal_el || ! e || ! e.target || ! e.target.closest ) {
			return;
		}

		const is_confirm = e.target.closest( SEL_CONFIRM );
		if ( is_confirm ) {
			e.preventDefault();

			if ( is_confirm.classList.contains( 'disabled' ) || is_confirm.getAttribute( 'aria-disabled' ) === 'true' ) {
				return;
			}

			const slug = modal_el.__wpbc_bfb_selected_form_slug || '';
			if ( ! slug ) {
				return;
			}

			const cb                         = modal_el.__wpbc_bfb_load_form_cb || null;
			modal_el.__wpbc_bfb_load_form_cb = null;

			UI.Modals.hide( modal_el );

			if ( cb ) {
				// Try to find selected full object:
				let full   = null;
				const list = modal_el.__wpbc_bfb_forms_cache || [];
				for ( let i = 0; i < list.length; i++ ) {
					if ( String( list[i].form_slug || '' ) === String( slug ) ) {
						full = list[i];
						break;
					}
				}
				try { cb( { form_slug: slug, form: full } ); } catch ( _e3 ) {}
			}
			return;
		}

		const is_cancel = e.target.closest( SEL_CANCEL );
		if ( is_cancel ) {
			e.preventDefault();
			modal_el.__wpbc_bfb_load_form_cb = null;
			UI.Modals.hide( modal_el );
		}

	}, true );

})( window, document );


function wpbc_bfb__menu_forms__load(menu_option_this) {

	WPBC_BFB_Core.UI.Modal_Load_Form.open( function (payload) {

		if ( ! payload || ! payload.form_slug ) {
			return;
		}

		// Load selected form into builder.
		if ( typeof window.wpbc_bfb__ajax_load_form_by_slug !== 'function' ) {
			wpbc_admin_show_message( 'WPBC BFB: load-by-slug helper missing.', 'error', 10000 );
			return;
		}

		window.wpbc_bfb__ajax_load_form_by_slug( payload.form_slug, menu_option_this, function (ok, data) {
			if ( ok ) {
				wpbc_admin_show_message( 'Form loaded', 'success', 1500, false );
			}
		} );

	} );
}
