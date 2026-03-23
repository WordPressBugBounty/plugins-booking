/**
 * WPBC BFB: Field Renderer for "text" (WP-template–driven Reference, no fallback)
 * =========================================================================
 * - Uses wp.template('wpbc-bfb-field-text') for preview
 * - If template is unavailable or fails, shows an inline error message
 * - Inspector UI is produced by wp.template('wpbc-bfb-inspector-text')
 * - Assumes wpbc-bfb_core provides WPBC_BFB_Sanitize
 *
 * Contracts:
 * - Registry:  WPBC_BFB_Field_Renderer_Registry.register('text', Class)
 * - Class API: static get_defaults(), static render(el, data, ctx), static on_field_drop(data, el, ctx?) [optional]
 *
  * File:  ../includes/page-form-builder/field-packs/text/_out/field-text-wptpl.js
 *
 * @since   11.0.0
 * @modified  2025-09-06 14:08
 * @version 1.0.1
 */
(function (w) {
	'use strict';

	var Core     = w.WPBC_BFB_Core || {};
	var Registry = Core.WPBC_BFB_Field_Renderer_Registry;
	var Base     = Core.WPBC_BFB_Field_Base;

	if ( ! Registry || typeof Registry.register !== 'function' || ! Base ) {
		_wpbc?.dev?.error?.( 'WPBC_BFB_Field_Text', 'Core registry/base missing' );
		return;
	}

	class WPBC_BFB_Field_Text extends Base {

		/** Template id without the "tmpl-" prefix (Base will normalize/caches it). */
		static template_id = 'wpbc-bfb-field-text';

		static get_defaults() {
			return {
				type         : 'text',
				label        : 'Text',
				name         : '',
				html_id      : '',
				placeholder  : '',
				required     : false,
				minlength    : null,
				maxlength    : null,
				pattern      : '',
				cssclass     : '',
				help         : '',
				default_value: ''
			};
		}

		/**
		 * Render via wp.template; if missing, print a tiny error message.
		 *
		 * @param {HTMLElement} el
		 * @param {Object}      data
		 * @param {Object}      ctx
		 */
		static render(el, data, ctx) {

			if ( ! el ) {
				return;
			}

			// Normalize first (mirrors Base.render).
			const d = this.normalize_data( data );

			// Sanitize helpers actually available in core.
			const S       = Core.WPBC_BFB_Sanitize;
			const html_id = d.html_id ? S.sanitize_html_id( String( d.html_id ) ) : '';
			const name    = S.sanitize_html_name( String( d.name || d.id || 'field' ) );
			const cssNext = S.sanitize_css_classlist( String( d.cssclass || '' ) );

			// Keep wrapper dataset/styles in sync (do NOT assign DOM id to the wrapper).
			if ( el.dataset.html_id !== html_id ) {
				el.dataset.html_id = html_id;
			}

			// const prev = el.dataset.cssclass || '';
			// if ( prev !== cssNext ) {
			// 	prev.split( /\s+/ ).filter( Boolean ).forEach( (c) => el.classList.remove( c ) );
			// 	cssNext.split( /\s+/ ).filter( Boolean ).forEach( (c) => el.classList.add( c ) );
			// 	el.dataset.cssclass = cssNext;
			// }
			// NEW: store only.
			if ( 'cssclass' in d ) {
				if ( el.dataset.cssclass !== cssNext ) {
					el.dataset.cssclass = cssNext;
				}
			}
			// Compile template via Base (handles "tmpl-" + caching).
			const tpl = this.get_template( this.template_id );
			if ( typeof tpl !== 'function' ) {
				_wpbc?.dev?.error?.( 'text_wptpl.tpl.missing', 'Template not found: ' + this.template_id );
				el.innerHTML = '<div class="wpbc_bfb__error" role="alert">Template not found: wpbc-bfb-field-text.</div>';
				return;
			}

			// Render. Pass sanitized name/html_id back to template data.
			try {
				const tpl_data = { ...d, name, html_id, cssclass: cssNext, default_value: (d.default_value ?? '') };
				el.innerHTML   = tpl( tpl_data );
			} catch ( e ) {
				_wpbc?.dev?.error?.( 'text_wptpl.tpl.render', e );
				el.innerHTML = '<div class="wpbc_bfb__error" role="alert">Error rendering field preview.</div>';
				return;
			}

			// Keep wrapper metadata consistent with Base.render().
			el.dataset.type = d.type || 'text';
			el.setAttribute( 'data-label', (d.label != null ? String( d.label ) : '') );

			// Normalize a few attributes via the DOM (quotes/newlines), like Base.render().
			const input = el.querySelector( 'input, textarea, select' );
			if ( input ) {
				if ( d.placeholder != null ) input.setAttribute( 'placeholder', String( d.placeholder ) );
			}

			// Overlay (handles/toolbars).
			Core.UI?.WPBC_BFB_Overlay?.ensure?.( ctx?.builder, el );
		}

		/**
		 * Optional hook executed after field is dropped from the palette.
		 * Example recipe placeholder for future:   try { if ( !data.name ) { data.name = core.WPBC_BFB_IdService?.next_name?.( 'text' ) || 'text'; }  } catch ( e ) { }
		 *
		 * @param {Object}      data  Palette/field data.
		 * @param {HTMLElement} el    Newly created field element.
		 * @param {Object}      ctx   Context { builder, sanit, context: 'drop' | 'load' | 'preview' }
		 * @returns {void}
		 */
		static on_field_drop(data, el, ctx) {
			super.on_field_drop?.( data, el, ctx );  // Required for correctly auto-names from  Labels !
			// (your extra pack-specific logic if ever needed)
		}

	}

	try {
		Registry.register( 'text', WPBC_BFB_Field_Text );
	} catch ( e ) {
		_wpbc?.dev?.error?.( 'WPBC_BFB_Field_Text.register_wptpl', e );
	}
})( window );
