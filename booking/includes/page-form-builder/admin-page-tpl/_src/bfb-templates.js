/**
 * Booking Calendar — WP template helpers (BFB Admin)
 *
 * Provides a tiny wrapper around wp.template() and a safe "ensure in DOM" helper
 * for templates that produce modal markup or other admin UI.
 *
 * Exposes under:
 *   WPBC_BFB_Core.UI.Templates:
 *     - render_wp_template( template_id, data )
 *     - ensure_dom_from_wp_template( template_id, dom_id?, data? )
 *     - ensure_dom_ref_from_wp_template( template_id, dom_id?, data? )
 *
 * Back-compat aliases (optional):
 *     - render()
 *     - ensure_dom()
 *     - ensure_dom_ref()
 * @file ../includes/page-form-builder/admin-page-tpl/_out/bfb-templates.js
 */
(function (w, d) {
	'use strict';

	const Core = (w.WPBC_BFB_Core = w.WPBC_BFB_Core || {});
	const UI   = (Core.UI = Core.UI || {});

	/**
	 * Namespace for template helpers.
	 */
	const Templates = (UI.Templates = UI.Templates || {});

	/**
	 * Escape an id for querySelector usage.
	 *
	 * @param {string} s
	 * @returns {string}
	 */
	function css_escape(s) {
		s = String( s || '' );
		if ( w.CSS && typeof w.CSS.escape === 'function' ) {
			return w.CSS.escape( s );
		}
		return s.replace( /([^\w-])/g, '\\$1' );
	}

	/**
	 * Try to obtain wp.template render function.
	 *
	 * @param {string} template_id
	 * @returns {Function|null}
	 */
	function get_wp_template_fn(template_id) {
		try {
			if ( ! w.wp || typeof w.wp.template !== 'function' ) {
				return null;
			}
			const fn = w.wp.template( String( template_id || '' ) );
			return (typeof fn === 'function') ? fn : null;
		} catch ( _e ) {
			return null;
		}
	}

	/**
	 * Render wp.template() safely.
	 *
	 * Note: template_id is the id WITHOUT the "tmpl-" prefix.
	 *
	 * @param {string} template_id
	 * @param {Object} [data]
	 * @returns {string} HTML string or empty string on failure
	 */
	function render_wp_template(template_id, data) {
		const fn = get_wp_template_fn( template_id );
		if ( ! fn ) {
			return '';
		}
		try {
			return String( fn( data || {} ) );
		} catch ( _e ) {
			return '';
		}
	}

	/**
	 * Parse arguments for ensure_dom_from_wp_template() supporting both signatures:
	 *   - (template_id, dom_id, data)
	 *   - (template_id, data)          // dom_id omitted
	 *
	 * @param {string|Object} dom_id_or_data
	 * @param {Object} data
	 * @returns {{dom_id:string, tpl_data:Object}}
	 */
	function normalize_dom_args(dom_id_or_data, data) {
		// If 2nd arg is plain object => treat as data, no explicit dom_id.
		if ( dom_id_or_data && typeof dom_id_or_data === 'object' && ! Array.isArray( dom_id_or_data ) ) {
			return { dom_id: '', tpl_data: dom_id_or_data || {} };
		}
		return { dom_id: String( dom_id_or_data || '' ), tpl_data: data || {} };
	}

	/**
	 * Find an id on the root element or inside its subtree.
	 * Used to avoid inserting duplicates when template HTML already has an id.
	 *
	 * @param {HTMLElement} root
	 * @returns {string}
	 */
	function detect_first_id(root) {
		try {
			const direct = String( root.id || root.getAttribute( 'id' ) || '' );
			if ( direct ) {
				return direct;
			}

			const first_with_id = root.querySelector ? root.querySelector( '[id]' ) : null;
			return first_with_id ? String( first_with_id.id || '' ) : '';
		} catch ( _e ) {
			return '';
		}
	}

	/**
	 * Ensure the returned node has a stable id (only if it doesn't have one).
	 *
	 * @param {HTMLElement} el
	 * @param {string} preferred_id
	 * @param {string} fallback_id
	 * @returns {void}
	 */
	function ensure_element_id(el, preferred_id, fallback_id) {
		if ( ! el || el.id ) {
			return;
		}

		const base = String( preferred_id || fallback_id || '' );
		if ( ! base ) {
			return;
		}

		let candidate = base;
		let i         = 2;

		while ( d.getElementById( candidate ) && d.getElementById( candidate ) !== el ) {
			candidate = base + '-' + (i++);
		}

		try {
			el.id = candidate;
		} catch ( _e ) {
		}
	}

	/**
	 * Ensure a rendered template element exists in DOM (lazy insert).
	 *
	 * Behavior:
	 * - If dom_id is provided and exists => returns that existing node.
	 * - Otherwise renders the template and inserts its first root node into DOM.
	 * - If the rendered root (or its subtree) already has an id that exists in DOM,
	 *   return the existing element instead of inserting a duplicate.
	 * - Returns the requested dom_id element if possible, else the inserted root.
	 *
	 * @param {string} template_id
	 * @param {string|Object} [dom_id_or_data]
	 * @param {Object} [data]
	 * @returns {HTMLElement|null}
	 */
	function ensure_dom_from_wp_template(template_id, dom_id_or_data, data) {
		const args     = normalize_dom_args( dom_id_or_data, data );
		const dom_id   = args.dom_id;
		const tpl_data = args.tpl_data;

		// 1) If caller asked for a specific dom_id and it's already in DOM, return it.
		if ( dom_id ) {
			const existing = d.getElementById( dom_id );
			if ( existing ) {
				return existing;
			}
		}

		// 2) Render template HTML.
		const html = render_wp_template( template_id, tpl_data );
		if ( ! html ) {
			return null;
		}

		// 3) Convert HTML -> element (first root node).
		const wrap     = d.createElement( 'div' );
		wrap.innerHTML = String( html ).trim();

		const root = wrap.firstElementChild;
		if ( ! root ) {
			return null;
		}

		// 4) Avoid duplicate IDs:
		//    If template contains an id (root or subtree) and that id already exists in DOM,
		//    return the existing element instead of inserting a duplicate.
		const detected_id = detect_first_id( root );
		if ( !dom_id && detected_id ) {
			const existing_by_detected = d.getElementById( detected_id );
			if ( existing_by_detected ) return existing_by_detected;
		}

		// 5) Insert into DOM.
		(d.body || d.documentElement).appendChild( root );

		// 6) Return requested target:
		//    - If dom_id provided: try getElementById(dom_id), else try querySelector inside root, else root.
		let ret = root;

		if ( dom_id ) {
			ret = d.getElementById( dom_id ) || root;
			if ( ret === root ) {
				try {
					const inside = root.querySelector( '#' + css_escape( dom_id ) );
					if ( inside ) ret = inside;
				} catch ( _e ) {
				}
			}
		}

		// 7) Make sure returned node has an id (useful for modal show/hide).
		ensure_element_id( ret, dom_id, detected_id || ('wpbc_tpl_' + String( template_id || 'tpl' )) );

		// 8) Post-render normalizers (safe no-op if not defined yet).
		try {
			if ( UI.apply_post_render ) {
				UI.apply_post_render( ret );
			}
		} catch ( _e ) {
		}

		return ret;
	}

	/**
	 * Same as ensure_dom_from_wp_template(), but returns both element and resolved id.
	 *
	 * @param {string} template_id
	 * @param {string|Object} [dom_id_or_data]
	 * @param {Object} [data]
	 * @returns {{id:string, el:HTMLElement}|null}
	 */
	function ensure_dom_ref_from_wp_template(template_id, dom_id_or_data, data) {
		const el = ensure_dom_from_wp_template( template_id, dom_id_or_data, data );
		if ( !el ) return null;
		return { id: String( el.id || '' ), el };
	}

	// -------------------------------------------------------------------------
	// Public API (clear names)
	// -------------------------------------------------------------------------

	Templates.render_wp_template              = render_wp_template;
	Templates.ensure_dom_from_wp_template     = ensure_dom_from_wp_template;
	Templates.ensure_dom_ref_from_wp_template = ensure_dom_ref_from_wp_template;

	// Keep escape available (useful for callers that need selector-safe ids).
	Templates.css_escape = css_escape;

	// Also keep your existing UI.* aliases if other files already call these:.
	UI.render_wp_template              = Templates.render_wp_template;
	UI.ensure_dom_from_wp_template     = Templates.ensure_dom_from_wp_template;
	UI.ensure_dom_ref_from_wp_template = Templates.ensure_dom_ref_from_wp_template;


	// -------------------------------------------------------------------------
	// UI.Modals (admin helper)
	// - Optional dependency: jQuery.fn.wpbc_my_modal
	// - Safe fallback: toggles display style
	// -------------------------------------------------------------------------

	const Modals = (UI.Modals = UI.Modals || {});

	// Reuse the same escape helper everywhere.
	Modals.css_escape = Modals.css_escape || Templates.css_escape || css_escape;

	Modals.show = Modals.show || function (modal_el_or_id) {

		const modal_id = (typeof modal_el_or_id === 'string')
			? String( modal_el_or_id || '' )
			: String( (modal_el_or_id && modal_el_or_id.id) ? modal_el_or_id.id : '' );

		const modal_el = (typeof modal_el_or_id === 'string')
			? d.getElementById( modal_id )
			: modal_el_or_id;

		if ( !modal_el ) return;

		try {
			if ( w.jQuery && w.jQuery.fn && w.jQuery.fn.wpbc_my_modal ) {

				const $m = modal_id
					? w.jQuery( '#' + Modals.css_escape( modal_id ) )
					: w.jQuery( modal_el );

				if ( $m && $m.wpbc_my_modal ) {
					$m.wpbc_my_modal( 'show' );
					return;
				}
			}
		} catch ( _e ) {
		}

		modal_el.style.display = 'block';
	};

	Modals.hide = Modals.hide || function (modal_el_or_id) {

		const modal_id = (typeof modal_el_or_id === 'string')
			? String( modal_el_or_id || '' )
			: String( (modal_el_or_id && modal_el_or_id.id) ? modal_el_or_id.id : '' );

		const modal_el = (typeof modal_el_or_id === 'string')
			? d.getElementById( modal_id )
			: modal_el_or_id;

		if ( !modal_el ) return;

		try {
			if ( w.jQuery && w.jQuery.fn && w.jQuery.fn.wpbc_my_modal ) {

				const $m = modal_id
					? w.jQuery( '#' + Modals.css_escape( modal_id ) )
					: w.jQuery( modal_el );

				if ( $m && $m.wpbc_my_modal ) {
					$m.wpbc_my_modal( 'hide' );
					return;
				}
			}
		} catch ( _e ) {
		}

		modal_el.style.display = 'none';
	};

}( window, document ));
