/**
 * WPBC BFB: Section Renderer (WP-template–driven, slim version)
 * ---------------------------------------------------------------------------------
 * - Delegates column-style logic to UI.WPBC_BFB_Column_Styles (separate module)
 * - Inspector glue is moved to:  /_out/core/bfb-inspector-patches.js
 *
 * Contracts:
 * - Registry:  Registry.register( 'section', WPBC_BFB_Section );
 * - Class API: static get_defaults(), static render(el, data, ctx), static on_field_drop(data, el, ctx?)
 *
 * File: /includes/page-form-builder/field-packs/section/_out/section-wptpl.js
 *
 * @since     11.0.0
 * @modified  2025-09-16 11:24
 * @version   1.1.0
 */
(function ( w ) {
	'use strict';

	var Core     = w.WPBC_BFB_Core || {};
	var Registry = Core.WPBC_BFB_Field_Renderer_Registry;
	var Base     = Core.WPBC_BFB_Field_Base;
	var UI       = ( Core.UI = Core.UI || {} );

	if ( ! Registry || typeof Registry.register !== 'function' || ! Base ) {
		w._wpbc && w._wpbc.dev && w._wpbc.dev.error && w._wpbc.dev.error( 'WPBC_BFB_Section', 'Core registry/base missing' );
		return;
	}

	// Shortcuts.
	var S         = Core.WPBC_BFB_Sanitize;
	var ColStyles = UI.WPBC_BFB_Column_Styles || null;

	/**
	 * Clamp number of columns to supported range.
	 *
	 * @param {number|string} n
	 * @returns {number}
	 */
	function clamp_cols( n ) {
		return S.clamp( Number( n ) || 1, 1, 4 );
	}

	class WPBC_BFB_Section extends Base {

		static template_id = 'wpbc-bfb-section';

		/**
		 * Default data for a new Section.
		 * NOTE: Keep in sync with PHP schema.
		 */
		static get_defaults() {
			return {
				type       : 'section',
				label      : 'Section',
				columns    : 1,
				id         : '',
				html_id    : '',
				cssclass   : '',
				col_styles : ''           // JSON string, empty by default to avoid activation
			};
		}

		/**
		 * Render section preview into element.
		 *
		 * @param {HTMLElement} el
		 * @param {object}      data
		 * @param {object}      ctx
		 */
		static render( el, data, ctx ) {
			if ( ! el ) { return; }

			var d          = this.normalize_data( data );
			var html_id    = d.html_id ? S.sanitize_html_id( String( d.html_id ) ) : '';
			var next_class = S.sanitize_css_classlist( String( d.cssclass || '' ) );
			var col_styles = ( d.col_styles != null ) ? String( d.col_styles ) : '';

			// Treat legacy "[]" as empty / inactive.
			if ( col_styles.trim() === '[]' ) { col_styles = ''; }

			el.classList.add( 'wpbc_bfb__section' );
			el.dataset.type       = 'section';
			el.dataset.label      = ( d.label != null ? String( d.label ) : '' );
			el.dataset.columns    = ( d.columns != null ? String( clamp_cols( d.columns ) ) : '1' );
			el.dataset.html_id    = html_id;
			el.dataset.cssclass   = next_class || '';
			el.dataset.col_styles = col_styles;

			// Replace previous custom classes.
			var prev = ( el.__wpbc_prev_classes || '' );
			if ( prev ) {
				prev.split( /\s+/ ).filter( Boolean ).forEach( function ( cls ) { el.classList.remove( cls ); } );
			}
			if ( next_class ) {
				next_class.split( /\s+/ ).filter( Boolean ).forEach( function ( cls ) { el.classList.add( cls ); } );
			}
			el.__wpbc_prev_classes = next_class || '';

			// Render wp.template.
			var tpl = this.get_template( this.template_id );
			if ( typeof tpl !== 'function' ) {
				w._wpbc && w._wpbc.dev && w._wpbc.dev.error && w._wpbc.dev.error( 'section_wptpl.tpl.missing', 'Template not found: ' + this.template_id );
				el.innerHTML = '<div class="wpbc_bfb__error" role="alert">Template not found: wpbc-bfb-section.</div>';
				return;
			}
			try {
				el.innerHTML = tpl( {
					type     : 'section',
					label    : el.dataset.label || 'Section',
					columns  : Number( el.dataset.columns || 1 ),
					id       : d.id || '',
					html_id  : html_id,
					cssclass : next_class
				} );
			} catch ( e ) {
				w._wpbc && w._wpbc.dev && w._wpbc.dev.error && w._wpbc.dev.error( 'section_wptpl.tpl.render', e );
				el.innerHTML = '<div class="wpbc_bfb__error" role="alert">Error rendering section preview.</div>';
			}

			// Apply per-column styles via shared UI service (no-op if missing).
			try {
				if ( ColStyles && typeof ColStyles.apply === 'function' ) {
					var arr = ColStyles.parse_col_styles( col_styles );
					ColStyles.apply( el, arr );
				}
			} catch ( e2 ) {
				w._wpbc && w._wpbc.dev && w._wpbc.dev.error && w._wpbc.dev.error( 'section_wptpl.apply_col_styles', e2 );
			}

			// Overlay controls (selection/toolbar), if available.
			UI && UI.WPBC_BFB_Overlay && UI.WPBC_BFB_Overlay.ensure && UI.WPBC_BFB_Overlay.ensure( ctx && ctx.builder, el );
		}

		/**
		 * After drop hook.
		 *
		 * @param {object}      data
		 * @param {HTMLElement} el
		 * @param {object}      ctx
		 */
		static on_field_drop( data, el, ctx ) {
			try {
				var cols = clamp_cols(
					( data && ( data.columns != null ? data.columns : data['data-columns'] ) )
					|| ( el && el.dataset && el.dataset.columns )
					|| 1
				);
				if ( ctx && ctx.builder && typeof ctx.builder.set_section_columns === 'function' ) {
					ctx.builder.set_section_columns( el, cols );
				}
				el.dataset.columns = String( cols );

				// Re-apply styles (baseline + activation state).
				if ( ColStyles && typeof ColStyles.apply === 'function' ) {
					var arr = ColStyles.parse_col_styles( el.dataset.col_styles || '' );
					ColStyles.apply( el, arr );
				}
			} catch ( e ) {
				w._wpbc && w._wpbc.dev && w._wpbc.dev.error && w._wpbc.dev.error( 'WPBC_BFB_Section.on_field_drop', e );
			}
		}
	}

	try {
		Registry.register( 'section', WPBC_BFB_Section );
	} catch ( e ) {
		w._wpbc && w._wpbc.dev && w._wpbc.dev.error && w._wpbc.dev.error( 'WPBC_BFB_Section.register_wptpl', e );
	}

})( window );
