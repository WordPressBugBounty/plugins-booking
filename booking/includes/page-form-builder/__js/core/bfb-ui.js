// ---------------------------------------------------------------------------------------------------------------------
// == File  /includes/page-form-builder/_out/core/bfb-ui.js == | 2025-09-10 15:47
// ---------------------------------------------------------------------------------------------------------------------
(function (w, d) {
	'use strict';

	// Single global namespace (idempotent & load-order safe).
	const Core = (w.WPBC_BFB_Core = w.WPBC_BFB_Core || {});
	const UI   = (Core.UI = Core.UI || {});

	// --- Highlight Element,  like Generator brn  -  Tiny UI helpers ------------------------------------
	UI._pulse_timers = UI._pulse_timers || new Map(); // el -> timer_id
	UI._pulse_meta   = UI._pulse_meta   || new Map(); // el -> { token, last_ts, debounce_id, color_set }
	// Pulse tuning (milliseconds).
	UI.PULSE_THROTTLE_MS  = Number.isFinite( UI.PULSE_THROTTLE_MS ) ? UI.PULSE_THROTTLE_MS : 500;
	UI.PULSE_DEBOUNCE_MS  = Number.isFinite( UI.PULSE_DEBOUNCE_MS ) ? UI.PULSE_DEBOUNCE_MS : 750;

	// Debounce STRUCTURE_CHANGE for continuous inspector controls (sliders / scrubbing).
	// Tune: 180..350 is usually a sweet spot.
	UI.STRUCTURE_CHANGE_DEBOUNCE_MS = Number.isFinite( UI.STRUCTURE_CHANGE_DEBOUNCE_MS ) ? UI.STRUCTURE_CHANGE_DEBOUNCE_MS : 180;
	// Change this to tune speed: 50..120 ms is a good range. Can be configured in <div data-len-group data-len-throttle="180">...</div>.
	UI.VALUE_SLIDER_THROTTLE_MS = Number.isFinite( UI.VALUE_SLIDER_THROTTLE_MS ) ? UI.VALUE_SLIDER_THROTTLE_MS : 120;

	/**
	 * Cancel any running pulse sequence for an element.
	 * Uses token invalidation so already-scheduled callbacks become no-ops.
	 *
	 * @param {HTMLElement} el
	 */
	UI.cancel_pulse = function (el) {
		if ( !el ) { return; }
		try {
			clearTimeout( UI._pulse_timers.get( el ) );
		} catch ( _ ) {}
		UI._pulse_timers.delete( el );

		var meta = UI._pulse_meta.get( el ) || {};
		meta.token = (Number.isFinite( meta.token ) ? meta.token : 0) + 1;
		meta.color_set = false;
		try { el.classList.remove( 'wpbc_bfb__scroll-pulse', 'wpbc_bfb__highlight-pulse' ); } catch ( _ ) {}
		try { el.style.removeProperty( '--wpbc-bfb-pulse-color' ); } catch ( _ ) {}
		UI._pulse_meta.set( el, meta );
		try { clearTimeout( meta.debounce_id ); } catch ( _ ) {}
		meta.debounce_id = 0;
	};

	/**
	 * Force-restart a CSS animation on a class.
	 * @param {HTMLElement} el
	 * @param {string} cls
	 */
	UI._restart_css_animation = function (el, cls) {
		if ( ! el ) { return; }
		try {
			el.classList.remove( cls );
		} catch ( _ ) {}
		// Force reflow so the next add() retriggers the keyframes.
		void el.offsetWidth;
		try {
			el.classList.add( cls );
		} catch ( _ ) {}
	};

	/**
		Single pulse (back-compat).
		@param {HTMLElement} el
		@param {number} dur_ms
	 */
	UI.pulse_once = function (el, dur_ms) {
		if ( ! el ) { return; }
		var cls = 'wpbc_bfb__scroll-pulse';
		var ms  = Number.isFinite( dur_ms ) ? dur_ms : 700;

		UI.cancel_pulse( el );

		var meta  = UI._pulse_meta.get( el ) || {};
		var token = (Number.isFinite( meta.token ) ? meta.token : 0) + 1;
		meta.token = token;
		UI._pulse_meta.set( el, meta );

		UI._restart_css_animation( el, cls );
		var t = setTimeout( function () {
			// ignore if a newer pulse started.
			var m = UI._pulse_meta.get( el ) || {};
			if ( m.token !== token ) { return; }
			try {
				el.classList.remove( cls );
			} catch ( _ ) {}
			UI._pulse_timers.delete( el );
		}, ms );
		UI._pulse_timers.set( el, t );
	};

	/**
		Multi-blink sequence with optional per-call color override.
		@param {HTMLElement} el
		@param {number} [times=3]
		@param {number} [on_ms=280]
		@param {number} [off_ms=180]
		@param {string} [hex_color] Optional CSS color (e.g. '#ff4d4f' or 'rgb(...)').
	 */
	UI.pulse_sequence = function (el, times, on_ms, off_ms, hex_color) {
		if ( !el || !d.body.contains( el ) ) {
			return;
		}
		var cls   = 'wpbc_bfb__highlight-pulse';
		var count = Number.isFinite( times ) ? times : 2;
		var on    = Number.isFinite( on_ms ) ? on_ms : 280;
		var off   = Number.isFinite( off_ms ) ? off_ms : 180;

		// Throttle: avoid reflow spam if called repeatedly while typing/dragging.
		var meta = UI._pulse_meta.get( el ) || {};
		var now  = Date.now();
		var throttle_ms = Number.isFinite( UI.PULSE_THROTTLE_MS ) ? UI.PULSE_THROTTLE_MS : 120;
		if ( Number.isFinite( meta.last_ts ) && (now - meta.last_ts) < throttle_ms ) {
			return;
		}
		meta.last_ts = now;

		// cancel any running pulse and reset class (token invalidation).
		UI.cancel_pulse( el );

		// new token for this run
		var token = (Number.isFinite( meta.token ) ? meta.token : 0) + 1;
		meta.token = token;

		var have_color = !!hex_color && typeof hex_color === 'string';
		if ( have_color ) {
			try {
				el.style.setProperty( '--wpbc-bfb-pulse-color', hex_color );
			} catch ( _ ) {}
			meta.color_set = true;
		}
		UI._pulse_meta.set( el, meta );

		var i = 0;
		(function tick() {
			var m = UI._pulse_meta.get( el ) || {};
			if ( m.token !== token ) {
				// canceled/replaced
				return;
			}
			if ( i >= count ) {
				UI._pulse_timers.delete( el );
				if ( have_color ) {
					try {
						el.style.removeProperty( '--wpbc-bfb-pulse-color' );
					} catch ( _ ) {}
				}
				return;
			}
			UI._restart_css_animation( el, cls );
			UI._pulse_timers.set( el, setTimeout( function () {     // ON -> OFF
				var m2 = UI._pulse_meta.get( el ) || {};
				if ( m2.token !== token ) { return; }
				try {
					el.classList.remove( cls );
				} catch ( _ ) {
				}
				UI._pulse_timers.set( el, setTimeout( function () { // OFF gap -> next
					var m3 = UI._pulse_meta.get( el ) || {};
					if ( m3.token !== token ) { return; }
					i++;
					tick();
				}, off ) );
			}, on ) );
		})();
	};


	/**
	 * Debounced query + pulse.
	 * Useful for `input` events (sliders / typing) to avoid forced reflow spam.
	 *
	 * @param {HTMLElement|string} root_or_selector
	 * @param {string} selector
	 * @param {number} wait_ms
	 * @param {number} [a]
	 * @param {number} [b]
	 * @param {number} [c]
	 * @param {string} [color]
	 */
	UI.pulse_query_debounced = function (root_or_selector, selector, wait_ms, a, b, c, color) {
		var root = (typeof root_or_selector === 'string') ? d : (root_or_selector || d);
		var sel  = (typeof root_or_selector === 'string') ? root_or_selector : selector;
		if ( !sel ) { return; }
		var el = root.querySelector( sel );
		if ( !el ) { return; }

		var def_ms = Number.isFinite( UI.PULSE_DEBOUNCE_MS ) ? UI.PULSE_DEBOUNCE_MS : 120;
		var ms     = Number.isFinite( wait_ms ) ? wait_ms : def_ms;
		var meta = UI._pulse_meta.get( el ) || {};
		try { clearTimeout( meta.debounce_id ); } catch ( _ ) {}
		meta.debounce_id = setTimeout( function () {
			UI.pulse_sequence( el, a, b, c, color );
		}, ms );
		UI._pulse_meta.set( el, meta );
	};

	/**
		Query + pulse:
		(BC) If only 3rd arg is a number and no 4th/5th -> single long pulse.
		Otherwise -> strong sequence (defaults 3×280/180).
		Optional 6th arg: color.
		@param {HTMLElement|string} root_or_selector
		@param {string} [selector]
		@param {number} [a]
		@param {number} [b]

		@param {number} [c]

		@param {string} [color]
	 */
	UI.pulse_query = function (root_or_selector, selector, a, b, c, color) {
		var root = (typeof root_or_selector === 'string') ? d : (root_or_selector || d);
		var sel  = (typeof root_or_selector === 'string') ? root_or_selector : selector;
		if ( !sel ) {
			return;
		}

		var el = root.querySelector( sel );
		if ( !el ) {
			return;
		}

// Back-compat: UI.pulseQuery(root, sel, dur_ms)
		if ( Number.isFinite( a ) && b === undefined && c === undefined ) {
			return UI.pulse_once( el, a );
		}
// New: sequence; params optional; supports optional color.
		UI.pulse_sequence( el, a, b, c, color );
	};

	/**
	Convenience helper (snake_case) to call a strong pulse with options.

	@param {HTMLElement} el

	@param {Object} [opts]

	@param {number} [opts.times=3]

	@param {number} [opts.on_ms=280]

	@param {number} [opts.off_ms=180]

	@param {string} [opts.color]
	 */
	UI.pulse_sequence_strong = function (el, opts) {
		opts = opts || {};
		UI.pulse_sequence(
			el,
			Number.isFinite( opts.times ) ? opts.times : 3,
			Number.isFinite( opts.on_ms ) ? opts.on_ms : 280,
			Number.isFinite( opts.off_ms ) ? opts.off_ms : 180,
			opts.color
		);
	};


	/**
	 * Base class for BFB modules.
	 */
	UI.WPBC_BFB_Module = class {
		/** @param {WPBC_Form_Builder} builder */
		constructor(builder) {
			this.builder = builder;
		}

		/** Initialize the module. */
		init() {
		}

		/** Cleanup the module. */
		destroy() {
		}
	};

	/**
	 * Central overlay/controls manager for fields/sections.
	 * Pure UI composition; all actions route back into the builder instance.
	 */
	UI.WPBC_BFB_Overlay = class {

		/**
		 * Ensure an overlay exists and is wired up on the element.
		 * @param {WPBC_Form_Builder} builder
		 * @param {HTMLElement} el - field or section element
		 */
		static ensure(builder, el) {

			if ( !el ) {
				return;
			}
			const isSection = el.classList.contains( 'wpbc_bfb__section' );

			// let overlay = el.querySelector( Core.WPBC_BFB_DOM.SELECTORS.overlay );
			let overlay = el.querySelector( `:scope > ${Core.WPBC_BFB_DOM.SELECTORS.overlay}` );
			if ( !overlay ) {
				overlay = Core.WPBC_Form_Builder_Helper.create_element( 'div', 'wpbc_bfb__overlay-controls' );
				el.prepend( overlay );
			}

			// Drag handle.
			if ( !overlay.querySelector( '.wpbc_bfb__drag-handle' ) ) {
				const dragClass = isSection ? 'wpbc_bfb__drag-handle section-drag-handle' : 'wpbc_bfb__drag-handle';
				overlay.appendChild(
					Core.WPBC_Form_Builder_Helper.create_element( 'span', dragClass, '<span class="wpbc_icn_drag_indicator"></span>' )
				);
			}

			// SETTINGS button (shown for both fields & sections).
			if ( !overlay.querySelector( '.wpbc_bfb__settings-btn' ) ) {
				const settings_btn   = Core.WPBC_Form_Builder_Helper.create_element( 'button', 'wpbc_bfb__settings-btn', '<i class="menu_icon icon-1x wpbc_icn_settings"></i>' );
				settings_btn.type    = 'button';
				settings_btn.title   = 'Open settings';
				settings_btn.onclick = (e) => {
					e.preventDefault();
					// Select THIS element and scroll it into view.
					builder.select_field( el, { scrollIntoView: true } );

					// Auto-open Inspector from the overlay “Settings” button.
					wpbc_bfb__dispatch_event_safe(
						'wpbc_bfb:show_panel',
						{
							panel_id: 'wpbc_bfb__inspector',
							tab_id  : 'wpbc_tab_inspector'
						}
					);

					// Try to bring the inspector into view / focus first input.
					const ins = document.getElementById( 'wpbc_bfb__inspector' );
					if ( ins ) {
						ins.scrollIntoView( { behavior: 'smooth', block: 'nearest' } );
						// Focus first interactive control (best-effort).
						setTimeout( () => {
							const focusable = ins.querySelector( 'input,select,textarea,button,[contenteditable],[tabindex]:not([tabindex="-1"])' );
							focusable?.focus?.();
						}, 260 );
					}
				};

				overlay.appendChild( settings_btn );
			}

			overlay.setAttribute( 'role', 'toolbar' );
			overlay.setAttribute( 'aria-label', el.classList.contains( 'wpbc_bfb__section' ) ? 'Section tools' : 'Field tools' );

			return overlay;
		}
	};

	/**
	 * WPBC Layout Chips helper - visual layout picker (chips), e.g., "50%/50%", to a section overlay.
	 *
	 * Renders Equal/Presets/Custom chips into a host container and wires them to apply the layout.
	 */
	UI.WPBC_BFB_Layout_Chips = class {

		/** Read per-column min (px) from CSS var set by the guard. */
		static _get_col_min_px(col) {
			const v = getComputedStyle( col ).getPropertyValue( '--wpbc-col-min' ) || '0';
			const n = parseFloat( v );
			return Number.isFinite( n ) ? Math.max( 0, n ) : 0;
		}

		/**
		 * Turn raw weights (e.g. [1,1], [2,1,1]) into effective "available-%" bases that
		 * (a) sum to the row's available %, and (b) meet every column's min px.
		 * Returns an array of bases (numbers) or null if impossible to satisfy mins.
		 */
		static _fit_weights_respecting_min(builder, row, weights) {
			const cols = Array.from( row.querySelectorAll( ':scope > .wpbc_bfb__column' ) );
			const n    = cols.length;
			if ( !n ) return null;
			if ( !Array.isArray( weights ) || weights.length !== n ) return null;

			// available % after gaps (from LayoutService)
			const gp       = builder.col_gap_percent;
			const eff      = builder.layout.compute_effective_bases_from_row( row, gp );
			const availPct = eff.available;               // e.g. 94 if 2 cols and 3% gap
			const rowPx    = row.getBoundingClientRect().width;
			const availPx  = rowPx * (availPct / 100);

			// collect minima in % of "available"
			const minPct = cols.map( (c) => {
				const minPx = UI.WPBC_BFB_Layout_Chips._get_col_min_px( c );
				if ( availPx <= 0 ) return 0;
				return (minPx / availPx) * availPct;
			} );

			// If mins alone don't fit, bail.
			const sumMin = minPct.reduce( (a, b) => a + b, 0 );
			if ( sumMin > availPct - 1e-6 ) {
				return null; // impossible to respect mins; don't apply preset
			}

			// Target percentages from weights, normalized to availPct.
			const wSum      = weights.reduce( (a, w) => a + (Number( w ) || 0), 0 ) || n;
			const targetPct = weights.map( (w) => ((Number( w ) || 0) / wSum) * availPct );

			// Lock columns that would be below min, then distribute the remainder
			// across the remaining columns proportionally to their targetPct.
			const locked  = new Array( n ).fill( false );
			let lockedSum = 0;
			for ( let i = 0; i < n; i++ ) {
				if ( targetPct[i] < minPct[i] ) {
					locked[i] = true;
					lockedSum += minPct[i];
				}
			}

			let remaining     = availPct - lockedSum;
			const freeIdx     = [];
			let freeTargetSum = 0;
			for ( let i = 0; i < n; i++ ) {
				if ( !locked[i] ) {
					freeIdx.push( i );
					freeTargetSum += targetPct[i];
				}
			}

			const result = new Array( n ).fill( 0 );
			// Seed locked with their minima.
			for ( let i = 0; i < n; i++ ) {
				if ( locked[i] ) result[i] = minPct[i];
			}

			if ( freeIdx.length === 0 ) {
				// everything locked exactly at min; any leftover (shouldn't happen)
				// would be ignored to keep simplicity and stability.
				return result;
			}

			if ( remaining <= 0 ) {
				// nothing left to distribute; keep exactly mins on locked,
				// nothing for free (degenerate but consistent)
				return result;
			}

			if ( freeTargetSum <= 0 ) {
				// distribute equally among free columns
				const each = remaining / freeIdx.length;
				freeIdx.forEach( (i) => (result[i] = each) );
				return result;
			}

			// Distribute remaining proportionally to free columns' targetPct
			freeIdx.forEach( (i) => {
				result[i] = remaining * (targetPct[i] / freeTargetSum);
			} );
			return result;
		}

		/** Apply a preset but guard it by minima; returns true if applied, false if skipped. */
		static _apply_preset_with_min_guard(builder, section_el, weights) {
			const row = section_el.querySelector( ':scope > .wpbc_bfb__row' );
			if ( !row ) return false;

			const fitted = UI.WPBC_BFB_Layout_Chips._fit_weights_respecting_min( builder, row, weights );
			if ( !fitted ) {
				builder?._announce?.( 'Not enough space for this layout because of fields’ minimum widths.' );
				return false;
			}

			// `fitted` already sums to the row’s available %, so we can apply bases directly.
			builder.layout.apply_bases_to_row( row, fitted );
			return true;
		}


		/**
		 * Build and append layout chips for a section.
		 *
		 * @param {WPBC_Form_Builder} builder - The form builder instance.
		 * @param {HTMLElement} section_el - The .wpbc_bfb__section element.
		 * @param {HTMLElement} host_el - Container where chips should be rendered.
		 * @returns {void}
		 */
		static render_for_section(builder, section_el, host_el) {

			if ( !builder || !section_el || !host_el ) {
				return;
			}

			const row = section_el.querySelector( ':scope > .wpbc_bfb__row' );
			if ( !row ) {
				return;
			}

			const cols = row.querySelectorAll( ':scope > .wpbc_bfb__column' ).length || 1;

			// Clear host.
			host_el.innerHTML = '';

			// Equal chip.
			host_el.appendChild(
				UI.WPBC_BFB_Layout_Chips._make_chip( builder, section_el, Array( cols ).fill( 1 ), 'Equal' )
			);

			// Presets based on column count.
			const presets = builder.layout.build_presets_for_columns( cols );
			presets.forEach( (weights) => {
				host_el.appendChild(
					UI.WPBC_BFB_Layout_Chips._make_chip( builder, section_el, weights, null )
				);
			} );

			// Custom chip.
			const customBtn       = document.createElement( 'button' );
			customBtn.type        = 'button';
			customBtn.className   = 'wpbc_bfb__layout_chip';
			customBtn.textContent = 'Custom…';
			customBtn.title       = `Enter ${cols} percentages`;
			customBtn.addEventListener( 'click', () => {
				const example = (cols === 2) ? '50,50' : (cols === 3 ? '20,60,20' : '25,25,25,25');
				const text    = prompt( `Enter ${cols} percentages (comma or space separated):`, example );
				if ( text == null ) return;
				const weights = builder.layout.parse_weights( text );
				if ( weights.length !== cols ) {
					alert( `Please enter exactly ${cols} numbers.` );
					return;
				}
				// OLD:
				// builder.layout.apply_layout_preset( section_el, weights, builder.col_gap_percent );
				// Guarded apply:.
				if ( !UI.WPBC_BFB_Layout_Chips._apply_preset_with_min_guard( builder, section_el, weights ) ) {
					return;
				}
				host_el.querySelectorAll( '.wpbc_bfb__layout_chip' ).forEach( c => c.classList.remove( 'is-active' ) );
				customBtn.classList.add( 'is-active' );
			} );
			host_el.appendChild( customBtn );
		}

		/**
		 * Create a single layout chip button.
		 *
		 * @private
		 * @param {WPBC_Form_Builder} builder
		 * @param {HTMLElement} section_el
		 * @param {number[]} weights
		 * @param {string|null} label
		 * @returns {HTMLButtonElement}
		 */
		static _make_chip(builder, section_el, weights, label = null) {

			const btn     = document.createElement( 'button' );
			btn.type      = 'button';
			btn.className = 'wpbc_bfb__layout_chip';

			const title = label || builder.layout.format_preset_label( weights );
			btn.title   = title;

			// Visual miniature.
			const vis     = document.createElement( 'div' );
			vis.className = 'wpbc_bfb__layout_chip-vis';
			const sum     = weights.reduce( (a, b) => a + (Number( b ) || 0), 0 ) || 1;
			weights.forEach( (w) => {
				const bar      = document.createElement( 'span' );
				bar.style.flex = `0 0 calc( ${((Number( w ) || 0) / sum * 100).toFixed( 3 )}% - 1.5px )`;
				vis.appendChild( bar );
			} );
			btn.appendChild( vis );

			const txt       = document.createElement( 'span' );
			txt.className   = 'wpbc_bfb__layout_chip-label';
			txt.textContent = label || builder.layout.format_preset_label( weights );
			btn.appendChild( txt );

			btn.addEventListener( 'click', () => {
				// OLD:
				// builder.layout.apply_layout_preset( section_el, weights, builder.col_gap_percent );

				// NEW:
				if ( !UI.WPBC_BFB_Layout_Chips._apply_preset_with_min_guard( builder, section_el, weights ) ) {
					return; // do not toggle active if we didn't change layout
				}

				btn.parentElement?.querySelectorAll( '.wpbc_bfb__layout_chip' ).forEach( c => c.classList.remove( 'is-active' ) );
				btn.classList.add( 'is-active' );
			} );

			return btn;
		}
	};

	/**
	 * Selection controller for fields and announcements.
	 */
	UI.WPBC_BFB_Selection_Controller = class extends UI.WPBC_BFB_Module {

		init() {

			this._selected_uid              = null;
			this.builder.select_field       = this.select_field.bind( this );
			this.builder.get_selected_field = this.get_selected_field.bind( this );
			this._on_clear                  = this.on_clear.bind( this );

			// Centralized delete command used by keyboard + inspector + overlay.
			this.builder.delete_item = (el) => {
				if ( !el ) {
					return null;
				}
				const b        = this.builder;
				const neighbor = b._find_neighbor_selectable?.( el ) || null;
				el.remove();
				// Use local Core constants (not a global) to avoid ReferenceErrors.
				b.bus?.emit?.( Core.WPBC_BFB_Events.FIELD_REMOVE, { el, id: el?.dataset?.id, uid: el?.dataset?.uid } );
				b.usage?.update_palette_ui?.();
				// Notify generic structure listeners, too:
				b.bus?.emit?.( Core.WPBC_BFB_Events.STRUCTURE_CHANGE, { reason: 'delete', el } );
				// Defer selection a tick so the DOM is fully settled before Inspector hydrates.
				requestAnimationFrame( () => {
					// This calls inspector.bind_to_field() and opens the Inspector panel.
					b.select_field?.( neighbor || null, { scrollIntoView: !!neighbor } );
				} );
				return neighbor;
			};
			this.builder.bus.on( Core.WPBC_BFB_Events.CLEAR_SELECTION, this._on_clear );
			this.builder.bus.on( Core.WPBC_BFB_Events.STRUCTURE_LOADED, this._on_clear );
			// delegated click selection (capture ensures we win before bubbling to containers).
			this._on_canvas_click = this._handle_canvas_click.bind( this );
			this.builder.pages_container.addEventListener( 'click', this._on_canvas_click, true );
		}

		destroy() {
			this.builder.bus.off( Core.WPBC_BFB_Events.CLEAR_SELECTION, this._on_clear );

			if ( this._on_canvas_click ) {
				this.builder.pages_container.removeEventListener( 'click', this._on_canvas_click, true );
				this._on_canvas_click = null;
			}
		}

		/**
		 * Delegated canvas click -> select closest field/section (inner beats outer).
		 * @private
		 * @param {MouseEvent} e
		 */
		_handle_canvas_click(e) {
			const root = this.builder.pages_container;
			if ( !root ) return;

			// Ignore clicks on controls/handles/resizers, etc.
			const IGNORE = [
				'.wpbc_bfb__overlay-controls',
				'.wpbc_bfb__layout_picker',
				'.wpbc_bfb__drag-handle',
				'.wpbc_bfb__field-remove-btn',
				'.wpbc_bfb__field-move-up',
				'.wpbc_bfb__field-move-down',
				'.wpbc_bfb__column-resizer'
			].join( ',' );

			if ( e.target.closest( IGNORE ) ) {
				return; // let those controls do their own thing.
			}

			// Find the closest selectable (field OR section) from the click target.
			let hit = e.target.closest?.(
				`${Core.WPBC_BFB_DOM.SELECTORS.validField}, ${Core.WPBC_BFB_DOM.SELECTORS.section}, .wpbc_bfb__column`
			);

			if ( !hit || !root.contains( hit ) ) {
				this.select_field( null );           // Clear selection on blank click.
				return;                              // Empty space is handled elsewhere.
			}

			// NEW: if user clicked a COLUMN -> remember tab key on its SECTION, but still select the section.
			let preselect_tab_key = null;
			if ( hit.classList.contains( 'wpbc_bfb__column' ) ) {
				const row  = hit.closest( '.wpbc_bfb__row' );
				const cols = row ? Array.from( row.querySelectorAll( ':scope > .wpbc_bfb__column' ) ) : [];
				const idx  = Math.max( 0, cols.indexOf( hit ) );
				const sec  = hit.closest( '.wpbc_bfb__section' );
				if ( sec ) {
					preselect_tab_key = String( idx + 1 );              // tabs are 1-based in ui-column-styles.js
					// Hint for the renderer (it reads this BEFORE rendering and restores the tab).
					sec.dataset.col_styles_active_tab = preselect_tab_key;
					// promote selection to the section (same UX as before).
					hit                               = sec;
					// NEW: visually mark which column is being edited
					if ( UI && UI.WPBC_BFB_Column_Styles && UI.WPBC_BFB_Column_Styles.set_selected_col_flag ) {
						UI.WPBC_BFB_Column_Styles.set_selected_col_flag( sec, preselect_tab_key );
					}
				}
			}

			// Select and stop bubbling so outer containers don’t reselect a parent.
			this.select_field( hit );
			e.stopPropagation();

			// Also set the tab after the inspector renders (works even if it was already open).
			if ( preselect_tab_key ) {
				(window.requestAnimationFrame || setTimeout)( function () {
					try {
						const ins  = document.getElementById( 'wpbc_bfb__inspector' );
						const tabs = ins && ins.querySelector( '[data-bfb-slot="column_styles"] [data-wpbc-tabs]' );
						if ( tabs && window.wpbc_ui_tabs && typeof window.wpbc_ui_tabs.set_active === 'function' ) {
							window.wpbc_ui_tabs.set_active( tabs, preselect_tab_key );
						}
					} catch ( _e ) {
					}
				}, 0 );

				// Politely ask the Inspector to focus/open the "Column Styles" group and tab.
				wpbc_bfb__dispatch_event_safe(
					'wpbc_bfb:inspector_focus',
					{
						group  : 'column_styles',
						tab_key: preselect_tab_key
					}
				);
			}
		}


		/**
		 * Select a field element or clear selection.
		 *
		 * @param {HTMLElement|null} field_el
		 * @param {{scrollIntoView?: boolean}} [opts = {}]
		 */
		select_field(field_el, { scrollIntoView = false } = {}) {
			const root   = this.builder.pages_container;
			const prevEl = this.get_selected_field?.() || null;   // the one we’re leaving.

			// Ignore elements not in the canvas.
			if ( field_el && !root.contains( field_el ) ) {
				field_el = null; // treat as "no selection".
			}

			// NEW: if we are leaving a section, clear its column highlight
			if (
				prevEl && prevEl !== field_el &&
				prevEl.classList?.contains( 'wpbc_bfb__section' ) &&
				UI?.WPBC_BFB_Column_Styles?.clear_selected_col_flag
			) {
				UI.WPBC_BFB_Column_Styles.clear_selected_col_flag( prevEl );
			}

			// If we're leaving a field, permanently stop auto-name for it.
			if ( prevEl && prevEl !== field_el && prevEl.classList?.contains( 'wpbc_bfb__field' ) ) {
				prevEl.dataset.autoname = '0';
				prevEl.dataset.fresh    = '0';
			}

			root.querySelectorAll( '.is-selected' ).forEach( (n) => {
				n.classList.remove( 'is-selected' );
			} );
			if ( !field_el ) {
				const prev         = this._selected_uid || null;
				this._selected_uid = null;
				this.builder.inspector?.clear?.();
				root.classList.remove( 'has-selection' );
				this.builder.bus.emit( Core.WPBC_BFB_Events.CLEAR_SELECTION, { prev_uid: prev, source: 'builder' } );

				// Auto-open "Add Fields" when nothing is selected.
				wpbc_bfb__dispatch_event_safe(
					'wpbc_bfb:show_panel',
					{
						panel_id: 'wpbc_bfb__palette_add_new',
						tab_id  : 'wpbc_tab_library'
					}
				);

				return;
			}
			field_el.classList.add( 'is-selected' );
			this._selected_uid = field_el.getAttribute( 'data-uid' ) || null;

			// Fallback: ensure sections announce themselves as type="section".
			if ( field_el.classList.contains( 'wpbc_bfb__section' ) && !field_el.dataset.type ) {
				field_el.dataset.type = 'section';
			}

			if ( scrollIntoView ) {
				field_el.scrollIntoView( { behavior: 'smooth', block: 'center' } );
			}
			this.builder.inspector?.bind_to_field?.( field_el );

			// Fallback: ensure inspector enhancers (incl. ValueSlider) run every bind.
			try {
				const ins = document.getElementById( 'wpbc_bfb__inspector' )
					|| document.querySelector( '.wpbc_bfb__inspector' );
				if ( ins ) {
					UI.InspectorEnhancers?.scan?.( ins );              // runs all enhancers
					UI.WPBC_BFB_ValueSlider?.init_on?.( ins );         // extra belt-and-suspenders
				}
			} catch ( _ ) {
			}

			// NEW: when selecting a section, reflect its active tab as the highlighted column.
			if ( field_el.classList.contains( 'wpbc_bfb__section' ) &&
				UI?.WPBC_BFB_Column_Styles?.set_selected_col_flag ) {
				var k = (field_el.dataset && field_el.dataset.col_styles_active_tab)
					? field_el.dataset.col_styles_active_tab : '1';
				UI.WPBC_BFB_Column_Styles.set_selected_col_flag( field_el, k );
			}

			// Keep sections & fields in the same flow:
			// 1) Generic hydrator for simple dataset-backed controls.
			if ( field_el ) {
				UI.WPBC_BFB_Inspector_Bridge._generic_hydrate_controls?.( this.builder, field_el );
				UI.WPBC_BFB_Inspector_Bridge._hydrate_special_controls?.( this.builder, field_el );
			}

			// Auto-open Inspector when a user selects a field/section .
			wpbc_bfb__dispatch_event_safe(
				'wpbc_bfb:show_panel',
				{
					panel_id: 'wpbc_bfb__inspector',
					tab_id  : 'wpbc_tab_inspector'
				}
			);

			root.classList.add( 'has-selection' );
			this.builder.bus.emit( Core.WPBC_BFB_Events.SELECT, { uid: this._selected_uid, el: field_el } );
			const label = field_el?.querySelector( '.wpbc_bfb__field-label' )?.textContent || (field_el.classList.contains( 'wpbc_bfb__section' ) ? 'section' : '') || field_el?.dataset?.id || 'item';
			this.builder._announce( 'Selected ' + label + '.' );
		}

		/** @returns {HTMLElement|null} */
		get_selected_field() {
			if ( !this._selected_uid ) {
				return null;
			}
			const esc_attr = Core.WPBC_BFB_Sanitize.esc_attr_value_for_selector( this._selected_uid );
			return this.builder.pages_container.querySelector( `.wpbc_bfb__field[data-uid="${esc_attr}"], .wpbc_bfb__section[data-uid="${esc_attr}"]` );
		}

		/** @param {CustomEvent} ev */
		on_clear(ev) {
			const src = ev?.detail?.source ?? ev?.source;
			if ( src !== 'builder' ) {
				this.select_field( null );
			}
		}

	};

	/**
	 * Bridges the builder with the Inspector and sanitizes id/name edits.
	 */
	UI.WPBC_BFB_Inspector_Bridge = class extends UI.WPBC_BFB_Module {

		init() {
			this._attach_inspector();
			this._bind_id_sanitizer();
			this._open_inspector_after_field_added();
			this._bind_focus_shortcuts();
		}

		_attach_inspector() {
			const b      = this.builder;
			const attach = () => {
				if ( typeof window.WPBC_BFB_Inspector === 'function' ) {
					b.inspector = new WPBC_BFB_Inspector( document.getElementById( 'wpbc_bfb__inspector' ), b );
					this._bind_id_sanitizer();
					document.removeEventListener( 'wpbc_bfb_inspector_ready', attach );
				}
			};
			// Ensure we bind after late ready as well.
			if ( typeof window.WPBC_BFB_Inspector === 'function' ) {
				attach();
			} else {
				b.inspector = {
					bind_to_field() {
					}, clear() {
					}
				};
				document.addEventListener( 'wpbc_bfb_inspector_ready', attach );
				setTimeout( attach, 0 );
			}
		}

		/**
		 * Listen for "focus" hints from the canvas and open the right group/tab.
		 * - Supports: group === 'column_styles'
		 * - Also scrolls the group into view.
		 */
		_bind_focus_shortcuts() {
			/** @param {CustomEvent} e */
			const on_focus = (e) => {
				try {
					const grp_key = e && e.detail && e.detail.group;
					const tab_key = e && e.detail && e.detail.tab_key;
					if ( !grp_key ) {
						return;
					}

					const ins = document.getElementById( 'wpbc_bfb__inspector' ) || document.querySelector( '.wpbc_bfb__inspector' );
					if ( !ins ) {
						return;
					}

					if ( grp_key === 'column_styles' ) {
						// Find the Column Styles slot/group.
						const slot = ins.querySelector( '[data-bfb-slot="column_styles"]' ) || ins.querySelector( '[data-inspector-group-key="column_styles"]' );
						if ( slot ) {
							// Open collapsible container if present.
							const group_wrap = slot.closest( '.inspector__group' ) || slot.closest( '[data-inspector-group]' );
							if ( group_wrap && !group_wrap.classList.contains( 'is-open' ) ) {
								group_wrap.classList.add( 'is-open' );
								// Mirror ARIA state if your header uses aria-expanded.
								const header_btn = group_wrap.querySelector( '[aria-expanded]' );
								if ( header_btn ) {
									header_btn.setAttribute( 'aria-expanded', 'true' );
								}
							}

							// Optional: set the requested tab key if tabs exist in this group.
							if ( tab_key ) {
								const tabs = slot.querySelector( '[data-wpbc-tabs]' );
								if ( tabs && window.wpbc_ui_tabs && typeof window.wpbc_ui_tabs.set_active === 'function' ) {
									window.wpbc_ui_tabs.set_active( tabs, String( tab_key ) );
								}
							}

							// Bring into view for convenience.
							try {
								// Uncomment (Only  if needed) this to AUTO SCROLL to  specific COLUMN in the section:.
								// slot.scrollIntoView( { behavior: 'smooth', block: 'nearest' } );
							} catch ( _e ) {}
						}
					}
				} catch ( _e ) {}
			};

			this._on_inspector_focus = on_focus;
			document.addEventListener( 'wpbc_bfb:inspector_focus', on_focus, true );
		}

		destroy() {
			try {
				if ( this._on_inspector_focus ) {
					document.removeEventListener( 'wpbc_bfb:inspector_focus', this._on_inspector_focus, true );
					this._on_inspector_focus = null;
				}
			} catch ( _e ) {
			}
		}


		/**
		 * Hydrate inspector inputs for "special" keys that we handle explicitly.
		 * Works for both fields and sections.
		 * @param {WPBC_Form_Builder} builder
		 * @param {HTMLElement} sel
		 */
		static _hydrate_special_controls(builder, sel) {
			const ins = document.getElementById( 'wpbc_bfb__inspector' );
			if ( !ins || !sel ) return;

			const setVal = (key, val) => {
				const ctrl = ins.querySelector( `[data-inspector-key="${key}"]` );
				if ( ctrl && 'value' in ctrl ) ctrl.value = String( val ?? '' );
			};

			// Internal id / name / public html_id.
			setVal( 'id', sel.getAttribute( 'data-id' ) || '' );
			setVal( 'name', sel.getAttribute( 'data-name' ) || '' );
			setVal( 'html_id', sel.getAttribute( 'data-html_id' ) || '' );

			// Section-only extras are harmless to set for fields (controls may not exist).
			setVal( 'cssclass', sel.getAttribute( 'data-cssclass' ) || '' );
			setVal( 'label', sel.getAttribute( 'data-label' ) || '' );
		}


		/**
		 * Hydrate inspector inputs that declare a generic dataset mapping via
		 * [data-inspector-key] but do NOT declare a custom value_from adapter.
		 * This makes sections follow the same data flow as fields with almost no glue.
		 *
		 * @param {WPBC_Form_Builder} builder
		 * @param {HTMLElement} sel - currently selected field/section
		 */
		static _generic_hydrate_controls(builder, sel) {
			const ins = document.getElementById( 'wpbc_bfb__inspector' );
			if ( !ins || !sel ) return;

			const SKIP = /^(id|name|html_id|cssclass|label)$/; // handled by _hydrate_special_controls

			// NEW: read schema for the selected element’s type.
			const schemas     = window.WPBC_BFB_Schemas || {};
			const typeKey     = (sel.dataset && sel.dataset.type) || '';
			const schemaEntry = schemas[typeKey] || null;
			const propsSchema = (schemaEntry && schemaEntry.schema && schemaEntry.schema.props) ? schemaEntry.schema.props : {};
			const hasOwn      = Function.prototype.call.bind( Object.prototype.hasOwnProperty );
			const getDefault  = (key) => {
				const meta = propsSchema[key];
				return (meta && hasOwn( meta, 'default' )) ? meta.default : undefined;
			};

			ins.querySelectorAll( '[data-inspector-key]' ).forEach( (ctrl) => {
				const key = String( ctrl.dataset?.inspectorKey || '' ).toLowerCase();
				if ( !key || SKIP.test( key ) ) return;

				// Element-level lock.
				const dl = (ctrl.dataset?.locked || '').trim().toLowerCase();
				if ( dl === '1' || dl === 'true' || dl === 'yes' ) return;

				// Respect explicit adapters.
				if ( ctrl.dataset?.value_from || ctrl.dataset?.valueFrom ) return;

				const raw      = sel.dataset ? sel.dataset[key] : undefined;
				const hasRaw   = sel.dataset ? hasOwn( sel.dataset, key ) : false;
				const defValue = getDefault( key );

				// Best-effort control typing with schema default fallback when value is absent.

				if ( ctrl instanceof HTMLInputElement && (ctrl.type === 'checkbox' || ctrl.type === 'radio') ) {
					// If dataset is missing the key entirely -> use schema default (boolean).
					if ( !hasRaw ) {
						ctrl.checked = !!defValue;
					} else {
						ctrl.checked = Core.WPBC_BFB_Sanitize.coerce_boolean( raw, !!defValue );
					}
				} else if ( 'value' in ctrl ) {
					if ( hasRaw ) {
						ctrl.value = (raw != null) ? String( raw ) : '';
					} else {
						ctrl.value = (defValue == null) ? '' : String( defValue );
					}
				}
			} );
		}

		_bind_id_sanitizer() {
			const b   = this.builder;
			const ins = document.getElementById( 'wpbc_bfb__inspector' );
			if ( ! ins ) {
				return;
			}
			if ( ins.__wpbc_bfb_id_sanitizer_bound ) {
				return;
			}
			ins.__wpbc_bfb_id_sanitizer_bound = true;

			const handler = (e) => {

				const t = e.target;
				if ( !t || !('value' in t) ) {
					return;
				}
				const key       = (t.dataset?.inspectorKey || '').toLowerCase();
				const sel       = b.get_selected_field?.();
				const isSection = sel?.classList?.contains( 'wpbc_bfb__section' );
				if ( !sel ) return;

				// Unified emitter that always includes the element reference.
				const EV              = Core.WPBC_BFB_Events;
				// STRUCTURE_CHANGE can be "expensive" because other listeners may trigger full canvas refresh.
				// Debounce only continuous controls (e.g. value slider scrubbing) on the INPUT phase.
				const ensure_sc_debounce_state = () => {
					if ( b.__wpbc_bfb_sc_debounce_state ) {
						return b.__wpbc_bfb_sc_debounce_state;
					}
					b.__wpbc_bfb_sc_debounce_state = { timer_id: 0, pending_payload: null };
					return b.__wpbc_bfb_sc_debounce_state;
				};

				const cancel_sc_debounced_emit = () => {
					const st = b.__wpbc_bfb_sc_debounce_state;
					if ( !st ) return;
					try { clearTimeout( st.timer_id ); } catch ( _ ) {}
					st.timer_id        = 0;
					st.pending_payload = null;
				};

				const bus_emit_change = (reason, extra = {}) => {
					// If we’re committing something (change/blur/etc), drop any pending "input" emit.
					cancel_sc_debounced_emit();
					b.bus?.emit?.( EV.STRUCTURE_CHANGE, { reason, el: sel, ...extra } );
				};

				const bus_emit_change_debounced = (reason, extra = {}, wait_ms) => {
					const st = ensure_sc_debounce_state();
					const ms = Number.isFinite( wait_ms )
						? wait_ms
						: (Number.isFinite( UI.STRUCTURE_CHANGE_DEBOUNCE_MS ) ? UI.STRUCTURE_CHANGE_DEBOUNCE_MS : 240);

					// Capture the CURRENT selected element into the payload now (stable ref).
					st.pending_payload = { reason, el: sel, ...extra, debounced: true };

					try { clearTimeout( st.timer_id ); } catch ( _ ) {}
					st.timer_id = setTimeout( function () {
						st.timer_id = 0;
						const payload = st.pending_payload;
						st.pending_payload = null;
						if ( payload ) {
							b.bus?.emit?.( EV.STRUCTURE_CHANGE, payload );
						}
					}, ms );
				};

				// ---- FIELD/SECTION: internal id ----
				if ( key === 'id' ) {
					const unique = b.id.set_field_id( sel, t.value );
					if ( b.preview_mode && !isSection ) {
						b.render_preview( sel );
					}
					if ( t.value !== unique ) {
						t.value = unique;
					}
					bus_emit_change( 'id-change' );
					return;
				}

				// ---- FIELD/SECTION: public HTML id ----
				if ( key === 'html_id' ) {
					const applied = b.id.set_field_html_id( sel, t.value );
					// For sections, also set the real DOM id so anchors/CSS can target it.
					if ( isSection ) {
						sel.id = applied || '';
					} else if ( b.preview_mode ) {
						b.render_preview( sel );
					}
					if ( t.value !== applied ) {
						t.value = applied;
					}
					bus_emit_change( 'html-id-change' );
					return;
				}

				// ---- FIELDS ONLY: name ----
				if ( key === 'name' && !isSection ) {

					// Live typing: sanitize only (NO uniqueness yet) to avoid "-2" spam
					if ( e.type === 'input' ) {
						const before    = t.value;
						const sanitized = Core.WPBC_BFB_Sanitize.sanitize_html_name( before );
						if ( before !== sanitized ) {
							// optional: preserve caret to avoid jump
							const selStart = t.selectionStart, selEnd = t.selectionEnd;
							t.value        = sanitized;
							try {
								t.setSelectionRange( selStart, selEnd );
							} catch ( _ ) {
							}
						}
						return; // uniqueness on change/blur
					}

					// Commit (change/blur)
					const raw = String( t.value ?? '' ).trim();

					if ( !raw ) {
						// RESEED: keep name non-empty and provisional (autoname stays ON)
						const S    = Core.WPBC_BFB_Sanitize;
						const base = S.sanitize_html_name( sel.getAttribute( 'data-id' ) || sel.dataset.id || sel.dataset.type || 'field' );
						const uniq = b.id.ensure_unique_field_name( base, sel );

						sel.setAttribute( 'data-name', uniq );
						sel.dataset.autoname          = '1';
						sel.dataset.name_user_touched = '0';

						// Keep DOM in sync if we’re not re-rendering
						if ( !b.preview_mode ) {
							const ctrl = sel.querySelector( 'input,textarea,select' );
							if ( ctrl ) ctrl.setAttribute( 'name', uniq );
						} else {
							b.render_preview( sel );
						}

						if ( t.value !== uniq ) t.value = uniq;
						bus_emit_change( 'name-reseed' );
						return;
					}

					// Non-empty commit: user takes control; disable autoname going forward
					sel.dataset.name_user_touched = '1';
					sel.dataset.autoname          = '0';

					const sanitized = Core.WPBC_BFB_Sanitize.sanitize_html_name( raw );
					const unique    = b.id.set_field_name( sel, sanitized );

					if ( !b.preview_mode ) {
						const ctrl = sel.querySelector( 'input,textarea,select' );
						if ( ctrl ) ctrl.setAttribute( 'name', unique );
					} else {
						b.render_preview( sel );
					}

					if ( t.value !== unique ) t.value = unique;
					bus_emit_change( 'name-change' );
					return;
				}

				// ---- SECTIONS & FIELDS: cssclass (live apply; no re-render) ----
				if ( key === 'cssclass' ) {
					const next       = Core.WPBC_BFB_Sanitize.sanitize_css_classlist( t.value || '' );
					const desiredArr = next.split( /\s+/ ).filter( Boolean );
					const desiredSet = new Set( desiredArr );

					// Core classes are never touched.
					const isCore = (cls) => cls === 'is-selected' || cls.startsWith( 'wpbc_' );

					// Snapshot before mutating (DOMTokenList is live).
					const beforeClasses = Array.from( sel.classList );
					const customBefore  = beforeClasses.filter( (c) => !isCore( c ) );

					// Remove stray non-core classes not in desired.
					customBefore.forEach( (c) => {
						if ( !desiredSet.has( c ) ) sel.classList.remove( c );
					} );

					// Add missing desired classes in one go.
					const missing = desiredArr.filter( (c) => !customBefore.includes( c ) );
					if ( missing.length ) sel.classList.add( ...missing );

					// Keep dataset in sync (avoid useless attribute writes).
					if ( sel.getAttribute( 'data-cssclass' ) !== next ) {
						sel.setAttribute( 'data-cssclass', next );
					}

					// Emit only if something actually changed.
					const afterClasses = Array.from( sel.classList );
					const changed      = afterClasses.length !== beforeClasses.length || beforeClasses.some( (c, i) => c !== afterClasses[i] );

					const detail = { key: 'cssclass', phase: e.type };
					if ( isSection ) {
						bus_emit_change( 'cssclass-change', detail );
					} else {
						bus_emit_change( 'prop-change', detail );
					}
					return;
				}


				// ---- SECTIONS: label ----
				if ( isSection && key === 'label' ) {
					const val = String( t.value ?? '' );
					sel.setAttribute( 'data-label', val );
					bus_emit_change( 'label-change' );
					return;
				}

				// ---- FIELDS: label (auto-name while typing; freeze on commit) ----
				if ( !isSection && key === 'label' ) {
					const val         = String( t.value ?? '' );
					sel.dataset.label = val;

					// while typing, allow auto-name (if flags permit)
					try {
						Core.WPBC_BFB_Field_Base.maybe_autoname_from_label( b, sel, val );
					} catch ( _ ) {
					}

					// if user committed the label (blur/change), freeze future auto-name
					if ( e.type !== 'input' ) {
						sel.dataset.autoname = '0';   // stop future label->name sync
						sel.dataset.fresh    = '0';   // also kill the "fresh" escape hatch
					}

					// Optional UI nicety: disable Name when auto is ON, enable when OFF
					const ins      = document.getElementById( 'wpbc_bfb__inspector' );
					const nameCtrl = ins?.querySelector( '[data-inspector-key="name"]' );
					if ( nameCtrl ) {
						const autoActive =
								  (sel.dataset.autoname ?? '1') !== '0' &&
								  sel.dataset.name_user_touched !== '1' &&
								  sel.dataset.was_loaded !== '1';
						nameCtrl.toggleAttribute( 'disabled', autoActive );
						if ( autoActive && !nameCtrl.placeholder ) {
							nameCtrl.placeholder = b?.i18n?.auto_from_label ?? 'auto — from label';
						}
						if ( !autoActive && nameCtrl.placeholder === (b?.i18n?.auto_from_label ?? 'auto — from label') ) {
							nameCtrl.placeholder = '';
						}
					}

					// Always re-render the preview so label changes are visible immediately.
					b.render_preview( sel );
					bus_emit_change( 'label-change' );
					return;
				}


				// ---- DEFAULT (GENERIC): dataset writer for both fields & sections ----
				// Any inspector control with [data-inspector-key] that doesn't have a custom
				// adapter/value_from will simply read/write sel.dataset[key].
				if ( key ) {

					const selfLocked = /^(1|true|yes)$/i.test( (t.dataset?.locked || '').trim() );
					if ( selfLocked ) {
						return;
					}

					// Skip keys we handled above to avoid double work.
					if ( key === 'id' || key === 'name' || key === 'html_id' || key === 'cssclass' || key === 'label' ) {
						return;
					}
					let nextVal = '';
					if ( t instanceof HTMLInputElement && (t.type === 'checkbox' || t.type === 'radio') ) {
						nextVal = t.checked ? '1' : '';
					} else if ( 'value' in t ) {
						nextVal = String( t.value ?? '' );
					}
					// Persist to dataset.
					if ( sel?.dataset ) sel.dataset[key] = nextVal;

					// Generator controls are "UI inputs" — avoid STRUCTURE_CHANGE spam while dragging/typing.
					const is_gen_key = (key.indexOf( 'gen_' ) === 0);

					// Re-render on visual keys so preview stays in sync (calendar label/help, etc.).
					const visualKeys = new Set( [ 'help', 'placeholder', 'min_width', 'cssclass' ] );
					if ( !isSection && (visualKeys.has( key ) || key.startsWith( 'ui_' )) ) {
						// Light heuristic: only re-render on commit for heavy inputs; live for short ones is fine.
						if ( e.type === 'change' || key === 'help' || key === 'placeholder' ) {
							b.render_preview( sel );
						}
					}

					if ( !(is_gen_key && e.type === 'input') ) {
						// Debounce continuous value slider input events to avoid full-canvas refresh spam.
						// We detect the slider group via [data-len-group] wrapper.
						const is_len_group_ctrl = !!(t && t.closest && t.closest( '[data-len-group]' ));

						if ( is_len_group_ctrl && e.type === 'input' ) {
							bus_emit_change_debounced( 'prop-change', { key, phase: e.type } );
						} else {
							bus_emit_change( 'prop-change', { key, phase: e.type } );
						}
					}
					return;
				}
			};

			ins.addEventListener( 'change', handler, true );
			// reflect instantly while typing as well.
			ins.addEventListener( 'input', handler, true );
		}

		/**
		 * Open Inspector after a field is added.
		 * @private
		 */
		_open_inspector_after_field_added() {
			const EV = Core.WPBC_BFB_Events;
			this.builder?.bus?.on?.( EV.FIELD_ADD, (e) => {
				const el = e?.detail?.el || null;
				if ( el && this.builder?.select_field ) {
					this.builder.select_field( el, { scrollIntoView: true } );
				}
				// Show Inspector Palette.
				wpbc_bfb__dispatch_event_safe(
					'wpbc_bfb:show_panel',
					{
						panel_id: 'wpbc_bfb__inspector',
						tab_id  : 'wpbc_tab_inspector'
					}
				);
			} );
		}
	};

	/**
	 * Keyboard shortcuts for selection, deletion, and movement.
	 */
	UI.WPBC_BFB_Keyboard_Controller = class extends UI.WPBC_BFB_Module {
		init() {
			this._on_key = this.on_key.bind( this );
			document.addEventListener( 'keydown', this._on_key, true );
		}

		destroy() {
			document.removeEventListener( 'keydown', this._on_key, true );
		}

		/** @param {KeyboardEvent} e */
		on_key(e) {
			const b         = this.builder;
			const is_typing = this._is_typing_anywhere();
			if ( e.key === 'Escape' ) {
				if ( is_typing ) {
					return;
				}
				this.builder.bus.emit( Core.WPBC_BFB_Events.CLEAR_SELECTION, { source: 'esc' } );
				return;
			}
			const selected = b.get_selected_field?.();
			if ( !selected || is_typing ) {
				return;
			}
			if ( e.key === 'Delete' || e.key === 'Backspace' ) {
				e.preventDefault();
				b.delete_item?.( selected );
				return;
			}
			if ( (e.altKey || e.ctrlKey || e.metaKey) && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.shiftKey ) {
				e.preventDefault();
				const dir = (e.key === 'ArrowUp') ? 'up' : 'down';
				b.move_item?.( selected, dir );
				return;
			}
			if ( e.key === 'Enter' ) {
				e.preventDefault();
				b.select_field( selected, { scrollIntoView: true } );
			}
		}

		/** @returns {boolean} */
		_is_typing_anywhere() {
			const a   = document.activeElement;
			const tag = a?.tagName;
			if ( tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (a?.isContentEditable === true) ) {
				return true;
			}
			const ins = document.getElementById( 'wpbc_bfb__inspector' );
			return !!(ins && a && ins.contains( a ));
		}
	};

	/**
	 * Column resize logic for section rows.
	 */
	UI.WPBC_BFB_Resize_Controller = class extends UI.WPBC_BFB_Module {
		init() {
			this.builder.init_resize_handler = this.handle_resize.bind( this );
		}

		/**
		 * read the CSS var (kept local so it doesn’t depend on the Min-Width module)
		 *
		 * @param col
		 * @returns {number|number}
		 * @private
		 */
		_get_col_min_px(col) {
			const v = getComputedStyle( col ).getPropertyValue( '--wpbc-col-min' ) || '0';
			const n = parseFloat( v );
			return Number.isFinite( n ) ? Math.max( 0, n ) : 0;
		}

		/** @param {MouseEvent} e */
		handle_resize(e) {
			const b = this.builder;
			e.preventDefault();
			if ( e.button !== 0 ) return;

			const resizer   = e.currentTarget;
			const row_el    = resizer.parentElement;
			const cols      = Array.from( row_el.querySelectorAll( ':scope > .wpbc_bfb__column' ) );
			const left_col  = resizer?.previousElementSibling;
			const right_col = resizer?.nextElementSibling;
			if ( !left_col || !right_col || !left_col.classList.contains( 'wpbc_bfb__column' ) || !right_col.classList.contains( 'wpbc_bfb__column' ) ) return;

			const left_index  = cols.indexOf( left_col );
			const right_index = cols.indexOf( right_col );
			if ( left_index === -1 || right_index !== left_index + 1 ) return;

			const start_x        = e.clientX;
			const left_start_px  = left_col.getBoundingClientRect().width;
			const right_start_px = right_col.getBoundingClientRect().width;
			const pair_px        = Math.max( 0, left_start_px + right_start_px );

			const gp         = b.col_gap_percent;
			const computed   = b.layout.compute_effective_bases_from_row( row_el, gp );
			const available  = computed.available;                 // % of the “full 100” after gaps
			const bases      = computed.bases.slice( 0 );            // current effective %
			const pair_avail = bases[left_index] + bases[right_index];

			// Bail if we can’t compute sane deltas.
			if (!pair_px || !Number.isFinite(pair_avail) || pair_avail <= 0) return;

			// --- MIN CLAMPS (pixels) -------------------------------------------------
			const pctToPx       = (pct) => (pair_px * (pct / pair_avail)); // pair-local percent -> px
			const genericMinPct = Math.min( 0.1, available );                  // original 0.1% floor (in “available %” space)
			const genericMinPx  = pctToPx( genericMinPct );

			const leftMinPx  = Math.max( this._get_col_min_px( left_col ), genericMinPx );
			const rightMinPx = Math.max( this._get_col_min_px( right_col ), genericMinPx );

			// freeze text selection + cursor
			const prev_user_select         = document.body.style.userSelect;
			document.body.style.userSelect = 'none';
			row_el.style.cursor            = 'col-resize';

			const on_mouse_move = (ev) => {
				if ( !pair_px ) return;

				// work in pixels, clamp by each side’s min
				const delta_px   = ev.clientX - start_x;
				let newLeftPx    = left_start_px + delta_px;
				newLeftPx        = Math.max( leftMinPx, Math.min( pair_px - rightMinPx, newLeftPx ) );
				const newRightPx = pair_px - newLeftPx;

				// translate back to pair-local percentages
				const newLeftPct      = (newLeftPx / pair_px) * pair_avail;
				const newBases        = bases.slice( 0 );
				newBases[left_index]  = newLeftPct;
				newBases[right_index] = pair_avail - newLeftPct;

				b.layout.apply_bases_to_row( row_el, newBases );
			};

			const on_mouse_up = () => {
				document.removeEventListener( 'mousemove', on_mouse_move );
				document.removeEventListener( 'mouseup', on_mouse_up );
				window.removeEventListener( 'mouseup', on_mouse_up );
				document.removeEventListener( 'mouseleave', on_mouse_up );
				document.body.style.userSelect = prev_user_select || '';
				row_el.style.cursor            = '';

				// normalize to the row’s available % again
				const normalized = b.layout.compute_effective_bases_from_row( row_el, gp );
				b.layout.apply_bases_to_row( row_el, normalized.bases );
			};

			document.addEventListener( 'mousemove', on_mouse_move );
			document.addEventListener( 'mouseup', on_mouse_up );
			window.addEventListener( 'mouseup', on_mouse_up );
			document.addEventListener( 'mouseleave', on_mouse_up );
		}

	};

	/**
	 * Page and section creation, rebuilding, and nested Sortable setup.
	 */
	UI.WPBC_BFB_Pages_Sections = class extends UI.WPBC_BFB_Module {

		init() {
			this.builder.add_page                  = (opts) => this.add_page( opts );
			this.builder.add_section               = (container, cols) => this.add_section( container, cols );
			this.builder.rebuild_section           = (section_data, container) => this.rebuild_section( section_data, container );
			this.builder.init_all_nested_sortables = (el) => this.init_all_nested_sortables( el );
			this.builder.init_section_sortable     = (el) => this.init_section_sortable( el );
			this.builder.pages_sections            = this;
		}

		/**
		 * Give every field/section in a cloned subtree a fresh data-uid so
		 * uniqueness checks don't exclude their originals.
		 */
		_retag_uids_in_subtree(root) {
			const b = this.builder;
			if ( !root ) return;
			const nodes = [];
			if ( root.classList?.contains( 'wpbc_bfb__section' ) || root.classList?.contains( 'wpbc_bfb__field' ) ) {
				nodes.push( root );
			}
			nodes.push( ...root.querySelectorAll( '.wpbc_bfb__section, .wpbc_bfb__field' ) );
			nodes.forEach( (el) => {
				const prefix   = el.classList.contains( 'wpbc_bfb__section' ) ? 's' : 'f';
				el.dataset.uid = `${prefix}-${++b._uid_counter}-${Date.now()}-${Math.random().toString( 36 ).slice( 2, 7 )}`;
			} );
		}

		/**
		 * Bump "foo", "foo-2", "foo-3", ...
		 */
		_make_unique(base, taken) {
			const s = Core.WPBC_BFB_Sanitize;
			let v   = String( base || '' );
			if ( !v ) v = 'field';
			const m  = v.match( /-(\d+)$/ );
			let n    = m ? (parseInt( m[1], 10 ) || 1) : 1;
			let stem = m ? v.replace( /-\d+$/, '' ) : v;
			while ( taken.has( v ) ) {
				n = Math.max( 2, n + 1 );
				v = `${stem}-${n}`;
			}
			taken.add( v );
			return v;
		}

		/**
		 * Strict, one-pass de-duplication for a newly-inserted subtree.
		 * - Ensures unique data-id (internal), data-name (fields), data-html_id (public)
		 * - Also updates DOM: <section id>, <input id>, <label for>, and input[name].
		 */
		_dedupe_subtree_strict(root) {
			const b = this.builder;
			const s = Core.WPBC_BFB_Sanitize;
			if ( !root || !b?.pages_container ) return;

			// 1) Build "taken" sets from outside the subtree.
			const takenDataId   = new Set();
			const takenDataName = new Set();
			const takenHtmlId   = new Set();
			const takenDomId    = new Set();

			// All fields/sections outside root
			b.pages_container.querySelectorAll( '.wpbc_bfb__field, .wpbc_bfb__section' ).forEach( el => {
				if ( root.contains( el ) ) return;
				const did  = el.getAttribute( 'data-id' );
				const dnam = el.getAttribute( 'data-name' );
				const hid  = el.getAttribute( 'data-html_id' );
				if ( did ) takenDataId.add( did );
				if ( dnam ) takenDataName.add( dnam );
				if ( hid ) takenHtmlId.add( hid );
			} );

			// All DOM ids outside root (labels, inputs, anything)
			document.querySelectorAll( '[id]' ).forEach( el => {
				if ( root.contains( el ) ) return;
				if ( el.id ) takenDomId.add( el.id );
			} );

			const nodes = [];
			if ( root.classList?.contains( 'wpbc_bfb__section' ) || root.classList?.contains( 'wpbc_bfb__field' ) ) {
				nodes.push( root );
			}
			nodes.push( ...root.querySelectorAll( '.wpbc_bfb__section, .wpbc_bfb__field' ) );

			// 2) Walk the subtree and fix collisions deterministically.
			nodes.forEach( el => {
				const isField   = el.classList.contains( 'wpbc_bfb__field' );
				const isSection = el.classList.contains( 'wpbc_bfb__section' );

				// INTERNAL data-id
				{
					const raw  = el.getAttribute( 'data-id' ) || '';
					const base = s.sanitize_html_id( raw ) || (isSection ? 'section' : 'field');
					const uniq = this._make_unique( base, takenDataId );
					if ( uniq !== raw ) el.setAttribute( 'data-id', uniq );
				}

				// HTML name (fields only)
				if ( isField ) {
					const raw = el.getAttribute( 'data-name' ) || '';
					if ( raw ) {
						const base = s.sanitize_html_name( raw );
						const uniq = this._make_unique( base, takenDataName );
						if ( uniq !== raw ) {
							el.setAttribute( 'data-name', uniq );
							// Update inner control immediately
							const input = el.querySelector( 'input, textarea, select' );
							if ( input ) input.setAttribute( 'name', uniq );
						}
					}
				}

				// Public HTML id (fields + sections)
				{
					const raw = el.getAttribute( 'data-html_id' ) || '';
					if ( raw ) {
						const base          = s.sanitize_html_id( raw );
						// Reserve against BOTH known data-html_id and real DOM ids.
						const combinedTaken = new Set( [ ...takenHtmlId, ...takenDomId ] );
						let candidate       = this._make_unique( base, combinedTaken );
						// Record into the real sets so future checks see the reservation.
						takenHtmlId.add( candidate );
						takenDomId.add( candidate );

						if ( candidate !== raw ) el.setAttribute( 'data-html_id', candidate );

						// Reflect to DOM immediately
						if ( isSection ) {
							el.id = candidate || '';
						} else {
							const input = el.querySelector( 'input, textarea, select' );
							const label = el.querySelector( 'label.wpbc_bfb__field-label' );
							if ( input ) input.id = candidate || '';
							if ( label ) label.htmlFor = candidate || '';
						}
					} else if ( isSection ) {
						// Ensure no stale DOM id if data-html_id was cleared
						el.removeAttribute( 'id' );
					}
				}
			} );
		}

		_make_add_columns_control(page_el, section_container, insert_pos = 'bottom') {

			// Accept insert_pos ('top'|'bottom'), default 'bottom'.

			const tpl = document.getElementById( 'wpbc_bfb__add_columns_template' );
			if ( !tpl ) {
				return null;
			}

			// Clone *contents* (not the id), unhide, and add a page-scoped class.
			const src = (tpl.content && tpl.content.firstElementChild) ? tpl.content.firstElementChild : tpl.firstElementChild;
			if ( !src ) {
				return null;
			}

			const clone = src.cloneNode( true );
			clone.removeAttribute( 'hidden' );
			if ( clone.id ) {
				clone.removeAttribute( 'id' );
			}
			clone.querySelectorAll( '[id]' ).forEach( n => n.removeAttribute( 'id' ) );

			// Mark where this control inserts sections.
			clone.dataset.insert = insert_pos; // 'top' | 'bottom'

			// // Optional UI hint for users (keeps existing markup intact).
			// const hint = clone.querySelector( '.nav-tab-text .selected_value' );
			// if ( hint ) {
			// 	hint.textContent = (insert_pos === 'top') ? ' (add at top)' : ' (add at bottom)';
			// }

			// Click on options - add section with N columns.
			clone.addEventListener( 'click', (e) => {
				const a = e.target.closest( '.ul_dropdown_menu_li_action_add_sections' );
				if ( !a ) {
					return;
				}
				e.preventDefault();

				// Read N either from data-cols or fallback to parsing text like "3 Columns".
				let cols = parseInt( a.dataset.cols || (a.textContent.match( /\b(\d+)\s*Column/i )?.[1] ?? '1'), 10 );
				cols     = Math.max( 1, Math.min( 4, cols ) );

				// NEW: honor the control's insertion position
				this.add_section( section_container, cols, insert_pos );

				// Reflect last choice (unchanged)
				const val = clone.querySelector( '.selected_value' );
				if ( val ) {
					val.textContent = ` (${cols})`;
				}
			} );

			return clone;
		}

		/**
		 * @param {{scroll?: boolean}} [opts = {}]
		 * @returns {HTMLElement}
		 */
		add_page({ scroll = true } = {}) {
			const b       = this.builder;
			const page_el = Core.WPBC_Form_Builder_Helper.create_element( 'div', 'wpbc_bfb__panel wpbc_bfb__panel--preview  wpbc_bfb_form wpbc_container wpbc_form wpbc_container_booking_form' );
			page_el.setAttribute( 'data-page', ++b.page_counter );

			// "Page 1 | X" - Render page Title with Remove X button.
			const controls_html = UI.render_wp_template( 'wpbc-bfb-tpl-page-remove', { page_number: b.page_counter } );
			page_el.innerHTML   = controls_html + '<div class="wpbc_bfb__form_preview_section_container wpbc_wizard__border_container"></div>';

			b.pages_container.appendChild( page_el );
			if ( scroll ) {
				page_el.scrollIntoView( { behavior: 'smooth', block: 'start' } );
			}

			const section_container         = page_el.querySelector( '.wpbc_bfb__form_preview_section_container' );
			const section_count_on_add_page = 2;
			this.init_section_sortable( section_container );
			this.add_section( section_container, section_count_on_add_page );

			// Dropdown control cloned from the hidden template.
			const controls_host_top = page_el.querySelector( '.wpbc_bfb__controls' );
			const ctrl_top          = this._make_add_columns_control( page_el, section_container, 'top' );
			if ( ctrl_top ) {
				controls_host_top.appendChild( ctrl_top );
			}
			// Bottom control bar after the section container.
			const controls_host_bottom = Core.WPBC_Form_Builder_Helper.create_element( 'div', 'wpbc_bfb__controls wpbc_bfb__controls--bottom' );
			section_container.after( controls_host_bottom );
			const ctrl_bottom = this._make_add_columns_control( page_el, section_container, 'bottom' );
			if ( ctrl_bottom ) {
				controls_host_bottom.appendChild( ctrl_bottom );
			}

			return page_el;
		}

		/**
		 * @param {HTMLElement} container
		 * @param {number}      cols
		 * @param {'top'|'bottom'} [insert_pos='bottom']  // NEW
		 */
		add_section(container, cols, insert_pos = 'bottom') {
			const b = this.builder;
			cols    = Math.max( 1, parseInt( cols, 10 ) || 1 );

			const section = Core.WPBC_Form_Builder_Helper.create_element( 'div', 'wpbc_bfb__section' );
			section.setAttribute( 'data-id', `section-${++b.section_counter}-${Date.now()}` );
			section.setAttribute( 'data-uid', `s-${++b._uid_counter}-${Date.now()}-${Math.random().toString( 36 ).slice( 2, 7 )}` );
			section.setAttribute( 'data-type', 'section' );
			section.setAttribute( 'data-label', 'Section' );
			section.setAttribute( 'data-columns', String( cols ) );
			// Do not persist or seed per-column styles by default (opt-in via inspector).

			const row = Core.WPBC_Form_Builder_Helper.create_element( 'div', 'wpbc_bfb__row wpbc__row' );
			for ( let i = 0; i < cols; i++ ) {
				const col           = Core.WPBC_Form_Builder_Helper.create_element( 'div', 'wpbc_bfb__column wpbc__field' );
				col.style.flexBasis = (100 / cols) + '%';
				// No default CSS vars here; real columns remain unaffected until user activates styles.
				b.init_sortable?.( col );
				row.appendChild( col );
				if ( i < cols - 1 ) {
					const resizer = Core.WPBC_Form_Builder_Helper.create_element( 'div', 'wpbc_bfb__column-resizer' );
					resizer.addEventListener( 'mousedown', b.init_resize_handler );
					row.appendChild( resizer );
				}
			}
			section.appendChild( row );
			b.layout.set_equal_bases( row, b.col_gap_percent );
			b.add_overlay_toolbar( section );
			section.setAttribute( 'tabindex', '0' );
			this.init_all_nested_sortables( section );

			// Insertion policy: top | bottom.
			if ( insert_pos === 'top' && container.firstElementChild ) {
				container.insertBefore( section, container.firstElementChild );
			} else {
				container.appendChild( section );
			}
		}

		/**
		 * @param {Object} section_data
		 * @param {HTMLElement} container
		 * @returns {HTMLElement} The rebuilt section element.
		 */
		rebuild_section(section_data, container) {
			const b         = this.builder;
			const cols_data = Array.isArray( section_data?.columns ) ? section_data.columns : [];
			this.add_section( container, cols_data.length || 1 );
			const section = container.lastElementChild;
			if ( !section.dataset.uid ) {
				section.setAttribute( 'data-uid', `s-${++b._uid_counter}-${Date.now()}-${Math.random().toString( 36 ).slice( 2, 7 )}` );
			}
			section.setAttribute( 'data-id', section_data?.id || `section-${++b.section_counter}-${Date.now()}` );
			section.setAttribute( 'data-type', 'section' );
			section.setAttribute( 'data-label', section_data?.label || 'Section' );
			section.setAttribute( 'data-columns', String( (section_data?.columns || []).length || 1 ) );
			// Persisted attributes
			if ( section_data?.html_id ) {
				section.setAttribute( 'data-html_id', String( section_data.html_id ) );
				// give the container a real id so anchors/CSS can target it
				section.id = String( section_data.html_id );
			}

			// NEW: restore persisted per-column styles (raw JSON string).
			if ( section_data?.col_styles != null ) {
				const json = String( section_data.col_styles );
				section.setAttribute( 'data-col_styles', json );
				try {
					section.dataset.col_styles = json;
				} catch ( _e ) {
				}
			}
			// (No render_preview() call here on purpose: sections’ builder DOM uses .wpbc_bfb__row/.wpbc_bfb__column.)


			if ( section_data?.cssclass ) {
				section.setAttribute( 'data-cssclass', String( section_data.cssclass ) );
				// keep core classes, then add custom class(es)
				String( section_data.cssclass ).split( /\s+/ ).filter( Boolean ).forEach( cls => section.classList.add( cls ) );
			}

			const row = section.querySelector( '.wpbc_bfb__row' );
			// Delegate parsing + activation + application to the Column Styles service.
			try {
				const json = section.getAttribute( 'data-col_styles' )
					|| (section.dataset ? (section.dataset.col_styles || '') : '');
				const arr  = UI.WPBC_BFB_Column_Styles.parse_col_styles( json );
				UI.WPBC_BFB_Column_Styles.apply( section, arr );
			} catch ( _e ) {
			}

			cols_data.forEach( (col_data, index) => {
				const columns_only  = row.querySelectorAll( ':scope > .wpbc_bfb__column' );
				const col           = columns_only[index];
				col.style.flexBasis = col_data.width || '100%';
				(col_data.items || []).forEach( (item) => {
					if ( !item || !item.type ) {
						return;
					}
					if ( item.type === 'field' ) {
						const el = b.build_field( item.data );
						if ( el ) {
							col.appendChild( el );
							b.trigger_field_drop_callback( el, 'load' );
						}
						return;
					}
					if ( item.type === 'section' ) {
						this.rebuild_section( item.data, col );
					}
				} );
			} );
			const computed = b.layout.compute_effective_bases_from_row( row, b.col_gap_percent );
			b.layout.apply_bases_to_row( row, computed.bases );
			this.init_all_nested_sortables( section );

			// NEW: retag UIDs first (so uniqueness checks don't exclude originals), then dedupe all keys.
			this._retag_uids_in_subtree( section );
			this._dedupe_subtree_strict( section );
			return section;
		}

		/** @param {HTMLElement} container */
		init_all_nested_sortables(container) {
			const b = this.builder;
			if ( container.classList.contains( 'wpbc_bfb__form_preview_section_container' ) ) {
				this.init_section_sortable( container );
			}
			container.querySelectorAll( '.wpbc_bfb__section' ).forEach( (section) => {
				section.querySelectorAll( '.wpbc_bfb__column' ).forEach( (col) => {
					this.init_section_sortable( col );
				} );
			} );
		}

		/** @param {HTMLElement} container */
		init_section_sortable(container) {
			const b = this.builder;
			if ( !container ) {
				return;
			}
			const is_column    = container.classList.contains( 'wpbc_bfb__column' );
			const is_top_level = container.classList.contains( 'wpbc_bfb__form_preview_section_container' );
			if ( !is_column && !is_top_level ) {
				return;
			}
			b.init_sortable?.( container );
		}
	};

	/**
	 * Serialization and deserialization of pages/sections/fields.
	 */
	UI.WPBC_BFB_Structure_IO = class extends UI.WPBC_BFB_Module {
		init() {
			this.builder.get_structure        = () => this.serialize();
			this.builder.load_saved_structure = (s, opts) => this.deserialize( s, opts );
		}

		/** @returns {Array} */
		serialize() {
			const b = this.builder;
			this._normalize_ids();
			this._normalize_names();
			const pages = [];
			b.pages_container.querySelectorAll( '.wpbc_bfb__panel--preview' ).forEach( (page_el, page_index) => {
				const container = page_el.querySelector( '.wpbc_bfb__form_preview_section_container' );
				const content   = [];
				if ( !container ) {
					pages.push( { page: page_index + 1, content } );
					return;
				}
				container.querySelectorAll( ':scope > *' ).forEach( (child) => {
					if ( child.classList.contains( 'wpbc_bfb__section' ) ) {
						content.push( { type: 'section', data: this.serialize_section( child ) } );
						return;
					}
					if ( child.classList.contains( 'wpbc_bfb__field' ) ) {
						if ( child.classList.contains( 'is-invalid' ) ) {
							return;
						}
						const f_data = Core.WPBC_Form_Builder_Helper.get_all_data_attributes( child );
						// Drop ephemeral/editor-only flags
						[ 'uid', 'fresh', 'autoname', 'was_loaded', 'name_user_touched' ]
							.forEach( k => {
								if ( k in f_data ) delete f_data[k];
							} );
						content.push( { type: 'field', data: f_data } );
					}
				} );
				pages.push( { page: page_index + 1, content } );
			} );
			return pages;
		}

		/**
		 * @param {HTMLElement} section_el
		 * @returns {{id:string,label:string,html_id:string,cssclass:string,col_styles:string,columns:Array}}
		 */
		serialize_section(section_el) {
			const row = section_el.querySelector( ':scope > .wpbc_bfb__row' );

			// NEW: read per-column styles from dataset/attributes (underscore & hyphen)
			var col_styles_raw =
					section_el.getAttribute( 'data-col_styles' ) ||
					(section_el.dataset ? (section_el.dataset.col_styles) : '') ||
					'';

			const base = {
				id        : section_el.dataset.id,
				label     : section_el.dataset.label || '',
				html_id   : section_el.dataset.html_id || '',
				cssclass  : section_el.dataset.cssclass || '',
				col_styles: String( col_styles_raw )        // <-- NEW: keep as raw JSON string
			};

			if ( !row ) {
				return Object.assign( {}, base, { columns: [] } );
			}

			const columns = [];
			row.querySelectorAll( ':scope > .wpbc_bfb__column' ).forEach( function (col) {
				const width = col.style.flexBasis || '100%';
				const items = [];
				Array.prototype.forEach.call( col.children, function (child) {
					if ( child.classList.contains( 'wpbc_bfb__section' ) ) {
						items.push( { type: 'section', data: this.serialize_section( child ) } );
						return;
					}
					if ( child.classList.contains( 'wpbc_bfb__field' ) ) {
						if ( child.classList.contains( 'is-invalid' ) ) {
							return;
						}
						const f_data = Core.WPBC_Form_Builder_Helper.get_all_data_attributes( child );
						[ 'uid', 'fresh', 'autoname', 'was_loaded', 'name_user_touched' ].forEach( function (k) {
							if ( k in f_data ) {
								delete f_data[k];
							}
						} );
						items.push( { type: 'field', data: f_data } );
					}
				}.bind( this ) );
				columns.push( { width: width, items: items } );
			}.bind( this ) );

			// Clamp persisted col_styles to the actual number of columns on Save.
			try {
				const colCount = columns.length;
				const raw      = String( col_styles_raw || '' ).trim();

				if ( raw ) {
					let arr = [];
					try {
						const parsed = JSON.parse( raw );
						arr          = Array.isArray( parsed ) ? parsed : (parsed && Array.isArray( parsed.columns ) ? parsed.columns : []);
					} catch ( _e ) {
						arr = [];
					}

					if ( colCount <= 0 ) {
						base.col_styles = '[]';
					} else {
						if ( arr.length > colCount ) arr.length = colCount;
						while ( arr.length < colCount ) arr.push( {} );
						base.col_styles = JSON.stringify( arr );
					}
				} else {
					base.col_styles = '';
				}
			} catch ( _e ) {
			}

			return Object.assign( {}, base, { columns: columns } );
		}

		/**
		 * @param {Array} structure
		 * @param {{deferIfTyping?: boolean}} [opts = {}]
		 */
		deserialize(structure, { deferIfTyping = true } = {}) {
			const b = this.builder;
			if ( deferIfTyping && this._is_typing_in_inspector() ) {
				clearTimeout( this._defer_timer );
				this._defer_timer = setTimeout( () => {
					this.deserialize( structure, { deferIfTyping: false } );
				}, 150 );
				return;
			}
			b.pages_container.innerHTML = '';
			b.page_counter              = 0;
			(structure || []).forEach( (page_data) => {
				const page_el               = b.pages_sections.add_page( { scroll: false } );
				const section_container     = page_el.querySelector( '.wpbc_bfb__form_preview_section_container' );
				section_container.innerHTML = '';
				b.init_section_sortable?.( section_container );
				(page_data.content || []).forEach( (item) => {
					if ( item.type === 'section' ) {
						// Now returns the element; attributes (incl. col_styles) are applied inside rebuild.
						b.pages_sections.rebuild_section( item.data, section_container );
						return;
					}
					if ( item.type === 'field' ) {
						const el = b.build_field( item.data );
						if ( el ) {
							section_container.appendChild( el );
							b.trigger_field_drop_callback( el, 'load' );
						}
					}
				} );
			} );
			b.usage?.update_palette_ui?.();
			b.bus.emit( Core.WPBC_BFB_Events.STRUCTURE_LOADED, { structure } );
		}

		_normalize_ids() {
			const b = this.builder;
			b.pages_container.querySelectorAll( '.wpbc_bfb__panel--preview .wpbc_bfb__field:not(.is-invalid)' ).forEach( (el) => {
				const data = Core.WPBC_Form_Builder_Helper.get_all_data_attributes( el );
				const want = Core.WPBC_BFB_Sanitize.sanitize_html_id( data.id || '' ) || 'field';
				const uniq = b.id.ensure_unique_field_id( want, el );
				if ( data.id !== uniq ) {
					el.setAttribute( 'data-id', uniq );
					if ( b.preview_mode ) {
						b.render_preview( el );
					}
				}
			} );
		}

		_normalize_names() {
			const b = this.builder;
			b.pages_container.querySelectorAll( '.wpbc_bfb__panel--preview .wpbc_bfb__field:not(.is-invalid)' ).forEach( (el) => {
				const data = Core.WPBC_Form_Builder_Helper.get_all_data_attributes( el );
				const base = Core.WPBC_BFB_Sanitize.sanitize_html_name( (data.name != null) ? data.name : data.id ) || 'field';
				const uniq = b.id.ensure_unique_field_name( base, el );
				if ( data.name !== uniq ) {
					el.setAttribute( 'data-name', uniq );
					if ( b.preview_mode ) {
						b.render_preview( el );
					}
				}
			} );
		}

		/** @returns {boolean} */
		_is_typing_in_inspector() {
			const ins = document.getElementById( 'wpbc_bfb__inspector' );
			return !!(ins && document.activeElement && ins.contains( document.activeElement ));
		}
	};

	/**
	 * Minimal, standalone guard that enforces per-column min widths based on fields' data-min_width.
	 *
	 * @type {UI.WPBC_BFB_Min_Width_Guard}
	 */
	UI.WPBC_BFB_Min_Width_Guard = class extends UI.WPBC_BFB_Module {

		constructor(builder) {
			super( builder );
			this._on_field_add        = this._on_field_add.bind( this );
			this._on_field_remove     = this._on_field_remove.bind( this );
			this._on_structure_loaded = this._on_structure_loaded.bind( this );
			this._on_structure_change = this._on_structure_change.bind( this );
			this._on_window_resize    = this._on_window_resize.bind( this );

			this._pending_rows = new Set();
			this._pending_all  = false;
			this._raf_id       = 0;
		}

		init() {
			const EV = Core.WPBC_BFB_Events;
			this.builder?.bus?.on?.( EV.FIELD_ADD, this._on_field_add );
			this.builder?.bus?.on?.( EV.FIELD_REMOVE, this._on_field_remove );
			this.builder?.bus?.on?.( EV.STRUCTURE_LOADED, this._on_structure_loaded );
			// Refresh selectively on structure change (NOT on every prop input).
			this.builder?.bus?.on?.( EV.STRUCTURE_CHANGE, this._on_structure_change );

			window.addEventListener( 'resize', this._on_window_resize, { passive: true } );
			this._schedule_refresh_all();
		}

		destroy() {
			const EV = Core.WPBC_BFB_Events;
			this.builder?.bus?.off?.( EV.FIELD_ADD, this._on_field_add );
			this.builder?.bus?.off?.( EV.FIELD_REMOVE, this._on_field_remove );
			this.builder?.bus?.off?.( EV.STRUCTURE_LOADED, this._on_structure_loaded );
			this.builder?.bus?.off?.( EV.STRUCTURE_CHANGE, this._on_structure_change );
			window.removeEventListener( 'resize', this._on_window_resize );
		}

		_on_field_add(e) {
			this._schedule_refresh_all();
			// if you really want to be minimal work here, keep your row-only version.
		}

		_on_field_remove(e) {
			const src_el = e?.detail?.el || null;
			const row    = (src_el && src_el.closest) ? src_el.closest( '.wpbc_bfb__row' ) : null;
			if ( row ) {
				this._schedule_refresh_row( row );
			} else {
				this._schedule_refresh_all();
			}
		}

		_on_structure_loaded() {
			this._schedule_refresh_all();
		}

		_on_structure_change(e) {
			const reason = e?.detail?.reason || '';
			const key    = e?.detail?.key || '';

			// Ignore noisy prop changes that don't affect min widths.
			if ( reason === 'prop-change' && key !== 'min_width' ) {
				return;
			}

			const el  = e?.detail?.el || null;
			const row = el?.closest?.( '.wpbc_bfb__row' ) || null;
			if ( row ) {
				this._schedule_refresh_row( row );
			} else {
				this._schedule_refresh_all();
			}
		}

		_on_window_resize() {
			this._schedule_refresh_all();
		}

		_schedule_refresh_row(row_el) {
			if ( !row_el ) return;
			this._pending_rows.add( row_el );
			this._kick_raf();
		}

		_schedule_refresh_all() {
			this._pending_all = true;
			this._pending_rows.clear();
			this._kick_raf();
		}

		_kick_raf() {
			if ( this._raf_id ) return;
			this._raf_id = (window.requestAnimationFrame || setTimeout)( () => {
				this._raf_id = 0;
				if ( this._pending_all ) {
					this._pending_all = false;
					this.refresh_all();
					return;
				}
				const rows = Array.from( this._pending_rows );
				this._pending_rows.clear();
				rows.forEach( (r) => this.refresh_row( r ) );
			}, 0 );
		}


		refresh_all() {
			this.builder?.pages_container
				?.querySelectorAll?.( '.wpbc_bfb__row' )
				?.forEach?.( (row) => this.refresh_row( row ) );
		}

		refresh_row(row_el) {
			if ( !row_el ) return;

			const cols = row_el.querySelectorAll( ':scope > .wpbc_bfb__column' );

			// 1) Recalculate each column’s required min px and write it to the CSS var.
			cols.forEach( (col) => this.apply_col_min( col ) );

			// 2) Enforce it at the CSS level right away so layout can’t render narrower.
			cols.forEach( (col) => {
				const px           = parseFloat( getComputedStyle( col ).getPropertyValue( '--wpbc-col-min' ) || '0' ) || 0;
				col.style.minWidth = px > 0 ? Math.round( px ) + 'px' : '';
			} );

			// 3) Normalize current bases so the row respects all mins without overflow.
			try {
				const b   = this.builder;
				const gp  = b.col_gap_percent;
				const eff = b.layout.compute_effective_bases_from_row( row_el, gp );  // { bases, available }
				// Re-fit *current* bases against mins (same algorithm layout chips use).
				const fitted = UI.WPBC_BFB_Layout_Chips._fit_weights_respecting_min( b, row_el, eff.bases );
				if ( Array.isArray( fitted ) ) {
					const changed = fitted.some( (v, i) => Math.abs( v - eff.bases[i] ) > 0.01 );
					if ( changed ) {
						b.layout.apply_bases_to_row( row_el, fitted );
					}
				}
			} catch ( e ) {
				w._wpbc?.dev?.error?.( 'WPBC_BFB_Min_Width_Guard - refresh_row', e );
			}
		}

		apply_col_min(col_el) {
			if ( !col_el ) return;
			let max_px    = 0;
			const colRect = col_el.getBoundingClientRect();
			col_el.querySelectorAll( ':scope > .wpbc_bfb__field' ).forEach( (field) => {
				const raw = field.getAttribute( 'data-min_width' );
				let px    = 0;
				if ( raw ) {
					const s = String( raw ).trim().toLowerCase();
					if ( s.endsWith( '%' ) ) {
						const n = parseFloat( s );
						if ( Number.isFinite( n ) && colRect.width > 0 ) {
							px = (n / 100) * colRect.width;
						} else {
							px = 0;
						}
					} else {
						px = this.parse_len_px( s );
					}
				} else {
					const cs = getComputedStyle( field );
					px       = parseFloat( cs.minWidth || '0' ) || 0;
				}
				if ( px > max_px ) max_px = px;
			} );
			col_el.style.setProperty( '--wpbc-col-min', max_px > 0 ? Math.round( max_px ) + 'px' : '0px' );
		}

		parse_len_px(value) {
			if ( value == null ) return 0;
			const s = String( value ).trim().toLowerCase();
			if ( s === '' ) return 0;
			if ( s.endsWith( 'px' ) ) {
				const n = parseFloat( s );
				return Number.isFinite( n ) ? n : 0;
			}
			if ( s.endsWith( 'rem' ) || s.endsWith( 'em' ) ) {
				const n    = parseFloat( s );
				const base = parseFloat( getComputedStyle( document.documentElement ).fontSize ) || 16;
				return Number.isFinite( n ) ? n * base : 0;
			}
			const n = parseFloat( s );
			return Number.isFinite( n ) ? n : 0;
		}
	};

	/**
	 * WPBC_BFB_Toggle_Normalizer
	 *
	 * Converts plain checkboxes into toggle UI:
	 * <div class="inspector__control wpbc_ui__toggle">
	 *   <input type="checkbox" id="{unique}" data-inspector-key="..." class="inspector__input" role="switch"
	 * aria-checked="true|false">
	 *   <label class="wpbc_ui__toggle_icon"  for="{unique}"></label>
	 *   <label class="wpbc_ui__toggle_label" for="{unique}">Label</label>
	 * </div>
	 *
	 * - Skips inputs already inside `.wpbc_ui__toggle`.
	 * - Reuses an existing <label for="..."> text if present; otherwise falls back to nearby labels or attributes.
	 * - Auto-generates a unique id when absent.
	 */
	UI.WPBC_BFB_Toggle_Normalizer = class {

		/**
		 * Upgrade all raw checkboxes in a container to toggles.
		 * @param {HTMLElement} root_el
		 */
		static upgrade_checkboxes_in(root_el) {

			if ( !root_el || !root_el.querySelectorAll ) {
				return;
			}

			var inputs = root_el.querySelectorAll( 'input[type="checkbox"]' );
			if ( !inputs.length ) {
				return;
			}

			Array.prototype.forEach.call( inputs, function (input) {

				// 1) Skip if already inside toggle wrapper.
				if ( input.closest( '.wpbc_ui__toggle' ) ) {
					return;
				}
				// Skip rows / where input checkbox explicitly marked with  attribute 'data-wpbc-ui-no-toggle'.
				if ( input.hasAttribute( 'data-wpbc-ui-no-toggle' ) ) {
					return;
				}

				// 2) Ensure unique id; prefer existing.
				var input_id = input.getAttribute( 'id' );
				if ( !input_id ) {
					var key  = (input.dataset && input.dataset.inspectorKey) ? String( input.dataset.inspectorKey ) : 'opt';
					input_id = UI.WPBC_BFB_Toggle_Normalizer.generate_unique_id( 'wpbc_ins_auto_' + key + '_' );
					input.setAttribute( 'id', input_id );
				}

				// 3) Find best label text.
				var label_text = UI.WPBC_BFB_Toggle_Normalizer.resolve_label_text( root_el, input, input_id );

				// 4) Build the toggle wrapper.
				var wrapper       = document.createElement( 'div' );
				wrapper.className = 'inspector__control wpbc_ui__toggle';

				// Keep original input; just move it into wrapper.
				input.classList.add( 'inspector__input' );
				input.setAttribute( 'role', 'switch' );
				input.setAttribute( 'aria-checked', input.checked ? 'true' : 'false' );

				var icon_label       = document.createElement( 'label' );
				icon_label.className = 'wpbc_ui__toggle_icon';
				icon_label.setAttribute( 'for', input_id );

				var text_label       = document.createElement( 'label' );
				text_label.className = 'wpbc_ui__toggle_label';
				text_label.setAttribute( 'for', input_id );
				text_label.appendChild( document.createTextNode( label_text ) );

				// 5) Insert wrapper into DOM near the input.
				//    Preferred: replace the original labeled row if it matches typical inspector layout.
				var replaced = UI.WPBC_BFB_Toggle_Normalizer.try_replace_known_row( input, wrapper, label_text );

				if ( !replaced ) {
					if ( !input.parentNode ) return; // NEW guard
					// Fallback: just wrap the input in place and append labels.
					input.parentNode.insertBefore( wrapper, input );
					wrapper.appendChild( input );
					wrapper.appendChild( icon_label );
					wrapper.appendChild( text_label );
				}

				// 6) ARIA sync on change.
				input.addEventListener( 'change', function () {
					input.setAttribute( 'aria-checked', input.checked ? 'true' : 'false' );
				} );
			} );
		}

		/**
		 * Generate a unique id with a given prefix.
		 * @param {string} prefix
		 * @returns {string}
		 */
		static generate_unique_id(prefix) {
			var base = String( prefix || 'wpbc_ins_auto_' );
			var uid  = Math.random().toString( 36 ).slice( 2, 8 );
			var id   = base + uid;
			// Minimal collision guard in the current document scope.
			while ( document.getElementById( id ) ) {
				uid = Math.random().toString( 36 ).slice( 2, 8 );
				id  = base + uid;
			}
			return id;
		}

		/**
		 * Resolve the best human label for an input.
		 * Priority:
		 *  1) <label for="{id}">text</label>
		 *  2) nearest sibling/parent .inspector__label text
		 *  3) input.getAttribute('aria-label') || data-label || data-inspector-key || name || 'Option'
		 * @param {HTMLElement} root_el
		 * @param {HTMLInputElement} input
		 * @param {string} input_id
		 * @returns {string}
		 */
		static resolve_label_text(root_el, input, input_id) {
			// for= association
			if ( input_id ) {
				var assoc = root_el.querySelector( 'label[for="' + UI.WPBC_BFB_Toggle_Normalizer.css_escape( input_id ) + '"]' );
				if ( assoc && assoc.textContent ) {
					var txt = assoc.textContent.trim();
					// Remove the old label from DOM; its text will be used by toggle.
					assoc.parentNode && assoc.parentNode.removeChild( assoc );
					if ( txt ) {
						return txt;
					}
				}
			}

			// nearby inspector label
			var near_label = input.closest( '.inspector__row' );
			if ( near_label ) {
				var il = near_label.querySelector( '.inspector__label' );
				if ( il && il.textContent ) {
					var t2 = il.textContent.trim();
					// If this row had the standard label+control, drop the old text label to avoid duplicates.
					il.parentNode && il.parentNode.removeChild( il );
					if ( t2 ) {
						return t2;
					}
				}
			}

			// fallbacks
			var aria = input.getAttribute( 'aria-label' );
			if ( aria ) {
				return aria;
			}
			if ( input.dataset && input.dataset.label ) {
				return String( input.dataset.label );
			}
			if ( input.dataset && input.dataset.inspectorKey ) {
				return String( input.dataset.inspectorKey );
			}
			if ( input.name ) {
				return String( input.name );
			}
			return 'Option';
		}

		/**
		 * Try to replace a known inspector row pattern with a toggle wrapper.
		 * Patterns:
		 *  <div.inspector__row>
		 *    <label.inspector__label>Text</label>
		 *    <div.inspector__control> [input[type=checkbox]] </div>
		 *  </div>
		 *
		 * @param {HTMLInputElement} input
		 * @param {HTMLElement} wrapper
		 * @returns {boolean} replaced
		 */
		static try_replace_known_row(input, wrapper, label_text) {
			var row       = input.closest( '.inspector__row' );
			var ctrl_wrap = input.parentElement;

			if ( row && ctrl_wrap && ctrl_wrap.classList.contains( 'inspector__control' ) ) {
				// Clear control wrap and reinsert toggle structure.
				while ( ctrl_wrap.firstChild ) {
					ctrl_wrap.removeChild( ctrl_wrap.firstChild );
				}
				row.classList.add( 'inspector__row--toggle' );

				ctrl_wrap.classList.add( 'wpbc_ui__toggle' );
				ctrl_wrap.appendChild( input );

				var input_id       = input.getAttribute( 'id' );
				var icon_lbl       = document.createElement( 'label' );
				icon_lbl.className = 'wpbc_ui__toggle_icon';
				icon_lbl.setAttribute( 'for', input_id );

				var text_lbl       = document.createElement( 'label' );
				text_lbl.className = 'wpbc_ui__toggle_label';
				text_lbl.setAttribute( 'for', input_id );
				if ( label_text ) {
					text_lbl.appendChild( document.createTextNode( label_text ) );
				}
				// If the row previously had a .inspector__label (we removed it in resolve_label_text),
				// we intentionally do NOT recreate it; the toggle text label becomes the visible one.
				// The text content is already resolved in resolve_label_text() and set below by caller.

				ctrl_wrap.appendChild( icon_lbl );
				ctrl_wrap.appendChild( text_lbl );
				return true;
			}

			// Not a known pattern; caller will wrap in place.
			return false;
		}

		/**
		 * CSS.escape polyfill for selectors.
		 * @param {string} s
		 * @returns {string}
		 */
		static css_escape(s) {
			s = String( s );
			if ( window.CSS && typeof window.CSS.escape === 'function' ) {
				return window.CSS.escape( s );
			}
			return s.replace( /([^\w-])/g, '\\$1' );
		}
	};

	/**
	 * Apply all UI normalizers/enhancers to a container (post-render).
	 * Keep this file small and add more normalizers later in one place.
	 *
	 * @param {HTMLElement} root
	 */
	UI.apply_post_render = function (root) {
		if ( !root ) {
			return;
		}
		try {
			UI.WPBC_BFB_ValueSlider?.init_on?.( root );
		} catch ( e ) { /* noop */
		}
		try {
			var T = UI.WPBC_BFB_Toggle_Normalizer;
			if ( T && typeof T.upgrade_checkboxes_in === 'function' ) {
				T.upgrade_checkboxes_in( root );
			}
		} catch ( e ) {
			w._wpbc?.dev?.error?.( 'apply_post_render.toggle', e );
		}

		// Accessibility: keep aria-checked in sync for all toggles inside root.
		try {
			root.querySelectorAll( '.wpbc_ui__toggle input[type="checkbox"]' ).forEach( function (cb) {
				if ( cb.__wpbc_aria_hooked ) {
					return;
				}
				cb.__wpbc_aria_hooked = true;
				cb.setAttribute( 'aria-checked', cb.checked ? 'true' : 'false' );
				// Delegate ‘change’ just once per render – native delegation still works fine for your logic.
				cb.addEventListener( 'change', () => {
					cb.setAttribute( 'aria-checked', cb.checked ? 'true' : 'false' );
				}, { passive: true } );
			} );
		} catch ( e ) {
			w._wpbc?.dev?.error?.( 'apply_post_render.aria', e );
		}
	};

	UI.InspectorEnhancers = UI.InspectorEnhancers || (function () {
		var regs = [];

		function register(name, selector, init, destroy) {
			regs.push( { name, selector, init, destroy } );
		}

		function scan(root) {
			if ( !root ) return;
			regs.forEach( function (r) {
				root.querySelectorAll( r.selector ).forEach( function (node) {
					node.__wpbc_eh = node.__wpbc_eh || {};
					if ( node.__wpbc_eh[r.name] ) return;
					try {
						r.init && r.init( node, root );
						node.__wpbc_eh[r.name] = true;
					} catch ( _e ) {
					}
				} );
			} );
		}

		function destroy(root) {
			if ( !root ) return;
			regs.forEach( function (r) {
				root.querySelectorAll( r.selector ).forEach( function (node) {
					try {
						r.destroy && r.destroy( node, root );
					} catch ( _e ) {
					}
					if ( node.__wpbc_eh ) delete node.__wpbc_eh[r.name];
				} );
			} );
		}

		return { register, scan, destroy };
	})();

	UI.WPBC_BFB_ValueSlider = {
		init_on(root) {
			var groups = (root.nodeType === 1 ? [ root ] : []).concat( [].slice.call( root.querySelectorAll?.( '[data-len-group]' ) || [] ) );
			groups.forEach( function (g) {
				if ( !g.matches || !g.matches( '[data-len-group]' ) ) return;
				if ( g.__wpbc_len_wired ) return;

				var number = g.querySelector( '[data-len-value]' );
				var range  = g.querySelector( '[data-len-range]' );
				var unit   = g.querySelector( '[data-len-unit]' );

				if ( !number || !range ) return;

				// Mirror constraints if missing on the range.
				[ 'min', 'max', 'step' ].forEach( function (a) {
					if ( !range.hasAttribute( a ) && number.hasAttribute( a ) ) {
						range.setAttribute( a, number.getAttribute( a ) );
					}
				} );


				function sync_range_from_number() {
					if ( range.value !== number.value ) {
						range.value = number.value;
					}
				}

				function dispatch_input(el) {
					try { el.dispatchEvent( new Event( 'input', { bubbles: true } ) ); } catch ( _e ) {}
				}
				function dispatch_change(el) {
					try { el.dispatchEvent( new Event( 'change', { bubbles: true } ) ); } catch ( _e ) {}
				}

				// Throttle range->number syncing (time-based).
				var timer_id       = 0;
				var pending_val    = null;
				var pending_change = false;
				var last_flush_ts  = 0;

				// Change this to tune speed: 50..120 ms is a good range.
				var min_interval_ms = parseInt( g.dataset.lenThrottle || UI.VALUE_SLIDER_THROTTLE_MS, 10 );
				min_interval_ms = Number.isFinite( min_interval_ms ) ? Math.max( 0, min_interval_ms ) : 120;

				function flush_range_to_number() {
					timer_id = 0;

					if ( pending_val == null ) {
						return;
					}

					var next    = String( pending_val );
					pending_val = null;

					if ( number.value !== next ) {
						number.value = next;
						// IMPORTANT: only 'input' while dragging.
						dispatch_input( number );
					}

					if ( pending_change ) {
						pending_change = false;
						dispatch_change( number );
					}

					last_flush_ts = Date.now();
				}

				function schedule_range_to_number(val, emit_change) {
					pending_val = val;
					if ( emit_change ) {
						pending_change = true;
					}

					// If commit requested, flush immediately.
					if ( pending_change ) {
						if ( timer_id ) {
							clearTimeout( timer_id );
							timer_id = 0;
						}
						flush_range_to_number();
						return;
					}

					var now   = Date.now();
					var delta = now - last_flush_ts;

					// If enough time passed, flush immediately; else schedule.
					if ( delta >= min_interval_ms ) {
						flush_range_to_number();
						return;
					}

					if ( timer_id ) {
						return;
					}

					timer_id = setTimeout( flush_range_to_number, Math.max( 0, min_interval_ms - delta ) );
				}

				function on_number_input() {
					sync_range_from_number();
				}

				function on_number_change() {
					sync_range_from_number();
				}

				function on_range_input() {
					schedule_range_to_number( range.value, false );
				}

				function on_range_change() {
					schedule_range_to_number( range.value, true );
				}

				number.addEventListener( 'input',  on_number_input );
				number.addEventListener( 'change', on_number_change );
				range.addEventListener( 'input',  on_range_input );
				range.addEventListener( 'change', on_range_change );

				if ( unit ) {
					unit.addEventListener( 'change', function () {
						// We just nudge the number so upstream handlers re-run.
						try {
							number.dispatchEvent( new Event( 'input', { bubbles: true } ) );
						} catch ( _e ) {
						}
					} );
				}

				// Initial sync
				sync_range_from_number();

				g.__wpbc_len_wired = {
					destroy() {
						number.removeEventListener( 'input',  on_number_input );
						number.removeEventListener( 'change', on_number_change );
						range.removeEventListener( 'input',  on_range_input );
						range.removeEventListener( 'change', on_range_change );
					}
				};
			} );
		},
		destroy_on(root) {
			var groups = (root && root.nodeType === 1 ? [ root ] : []).concat(
				[].slice.call( root.querySelectorAll?.( '[data-len-group]' ) || [] )
			);
			groups.forEach( function (g) {
				if ( !g.matches || !g.matches( '[data-len-group]' ) ) return;
				try {
					g.__wpbc_len_wired && g.__wpbc_len_wired.destroy && g.__wpbc_len_wired.destroy();
				} catch ( _e ) {
				}
				delete g.__wpbc_len_wired;
			} );
		}
	};

	// Register with the global enhancers hub.
	UI.InspectorEnhancers && UI.InspectorEnhancers.register(
		'value-slider',
		'[data-len-group]',
		function (el, _root) {
			UI.WPBC_BFB_ValueSlider.init_on( el );
		},
		function (el, _root) {
			UI.WPBC_BFB_ValueSlider.destroy_on( el );
		}
	);

	// Single, load-order-safe patch so enhancers auto-run on every bind.
	(function patchInspectorEnhancers() {
		function applyPatch() {
			var Inspector = w.WPBC_BFB_Inspector;
			if ( !Inspector || Inspector.__wpbc_enhancers_patched ) return false;
			Inspector.__wpbc_enhancers_patched = true;
			var orig                           = Inspector.prototype.bind_to_field;
			Inspector.prototype.bind_to_field  = function (el) {
				orig.call( this, el );
				try {
					var ins = this.panel
						|| document.getElementById( 'wpbc_bfb__inspector' )
						|| document.querySelector( '.wpbc_bfb__inspector' );
					UI.InspectorEnhancers && UI.InspectorEnhancers.scan( ins );
				} catch ( _e ) {
				}
			};
			// Initial scan if the DOM is already present.
			try {
				var insEl = document.getElementById( 'wpbc_bfb__inspector' )
					|| document.querySelector( '.wpbc_bfb__inspector' );
				UI.InspectorEnhancers && UI.InspectorEnhancers.scan( insEl );
			} catch ( _e ) {
			}
			return true;
		}

		// Try now; if Inspector isn’t defined yet, patch when it becomes ready.
		if ( !applyPatch() ) {
			document.addEventListener(
				'wpbc_bfb_inspector_ready',
				function () {
					applyPatch();
				},
				{ once: true }
			);
		}
	})();

}( window, document ));
