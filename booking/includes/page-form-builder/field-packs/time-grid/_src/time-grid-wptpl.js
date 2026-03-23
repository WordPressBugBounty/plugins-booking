// File: /includes/page-form-builder/field-packs/time-slots/_out/field-time-slots-wptpl.js
(function (w, d) {
	'use strict';

	/**
	 * WPBC BFB — Time Slots (robust)
	 * - Defers renderer registration until Core/Registry exists (prevents "No renderer found").
	 * - Initializes the Inspector via custom event, DOMContentLoaded, and MutationObserver fallbacks.
	 * - Implements toolbar buttons: rename, duplicate, clear, copy ← day, copy ← week, Fill row…, Fill column…
	 * - All helpers and identifiers use snake_case where possible.
	 */

	/* ====================== Tiny utils ====================== */

	function pad2( n ) { n = parseInt( n, 10 ); return ( n < 10 ? '0' + n : '' + n ); }

	function time_to_min( t ) {
		if ( ! t || 'string' !== typeof t ) { return null; }
		var m = t.match( /^(\d{1,2}):(\d{2})$/ );
		if ( ! m ) { return null; }
		var hh = parseInt( m[1], 10 ), mm = parseInt( m[2], 10 );
		if ( hh < 0 || hh > 23 || mm < 0 || mm > 59 ) { return null; }
		return hh * 60 + mm;
	}

	function min_to_time( mins ) {
		var m = parseInt( mins, 10 );
		if ( ! isFinite( m ) ) { m = 0; }
		if ( m < 0 ) { m = 0; }
		m = m % ( 24 * 60 );
		var hh = Math.floor( m / 60 ), mm = m % 60;
		return pad2( hh ) + ':' + pad2( mm );
	}

	function normalize_step( step ) {
		var s = parseInt( step, 10 );
		if ( ! isFinite( s ) || s < 5 ) { s = 5; }
		if ( s > 180 ) { s = 180; }
		return s;
	}

	function build_row_minutes( from_min, to_min, step ) {
		var arr = []; for ( var m = from_min; m < to_min; m += step ) { arr.push( m ); } return arr;
	}

	/**
	 * Merge minute indexes into continuous time ranges.
	 *
	 * @param {Array<number>} selected_minutes Sorted minute indexes (start of each slot)
	 * @param {number} step Step in minutes
	 * @return {Array<{from:string,to:string}>}
	 */
	function merge_day_ranges( selected_minutes, step ) {
		var out = [];
		if ( ! Array.isArray( selected_minutes ) || ! selected_minutes.length ) { return out; }
		selected_minutes.sort( function(a,b){ return a - b; } );
		var run_start = selected_minutes[0], prev = run_start, i, m;
		for ( i = 1; i < selected_minutes.length; i++ ) {
			m = selected_minutes[i];
			if ( m === prev + step ) { prev = m; continue; }
			out.push( { from: min_to_time( run_start ), to: min_to_time( prev + step ) } );
			run_start = m; prev = m;
		}
		out.push( { from: min_to_time( run_start ), to: min_to_time( prev + step ) } );
		return out;
	}

	/**
	 * Expand ranges to a set of "on" minute cells for easy painting.
	 */
	function expand_day_ranges( ranges, step, from_min, to_min ) {
		var set = Object.create( null );
		( ranges || [] ).forEach( function( r ) {
			var a = time_to_min( r.from ), b = time_to_min( r.to );
			if ( a == null || b == null ) { return; }
			for ( var m = a; m < b; m += step ) {
				if ( m >= from_min && m < to_min ) { set[ m ] = true; }
			}
		} );
		return set;
	}

	/**
	 * Keep profiles length in sync with week_cycle.
	 */
	function reconcile_profiles( profiles, week_cycle ) {
		var out = [], labels = ['Week A','Week B','Week C','Week D','Week E','Week F'], i;
		for ( i = 0; i < week_cycle; i++ ) {
			if ( profiles && profiles[i] ) {
				out.push( profiles[i] );
			} else {
				out.push( { key: String.fromCharCode( 65 + i ), label: labels[i] || ( 'Week ' + ( i + 1 ) ), slots: { '1':[], '2':[], '3':[], '4':[], '5':[], '6':[], '7':[] } } );
			}
		}
		return out;
	}

	/**
	 * Snap a minute value to a step grid.
	 *
	 * @param {number} m Minute value
	 * @param {number} step Step in minutes
	 * @param {'down'|'up'} dir Direction
	 */
	function snap_to_step( m, step, dir ) {
		var q = Math.floor( m / step ) * step;
		if ( 'up' === dir && q < m ) { q += step; }
		return q;
	}

	/* ====================== Templates ====================== */

	var tmpl_fn = ( w.wp && w.wp.template ) ? w.wp.template : function(){ return function(){ return ''; }; };

	function render_grid_rows( body_el, start_min, end_min, step ) {
		body_el.innerHTML = '';
		var row_t = tmpl_fn( 'wpbc-bfb-timegrid-row' );
		build_row_minutes( start_min, end_min, step ).forEach( function( minute ) {
			var html = row_t( { minute: minute, label: min_to_time( minute ) } );
			var wrap = d.createElement( 'div' ); wrap.innerHTML = html;
			var row = wrap.firstElementChild; if ( row ) { body_el.appendChild( row ); }
		} );
	}

	function paint_selection( root, profile, start_min, end_min, step ) {
		var body = root.querySelector( '.wpbc_bfb__timegrid_body' );
		if ( ! body || ! profile || ! profile.slots ) { return; }
		for ( var d_i = 1; d_i <= 7; d_i++ ) {
			var ranges = profile.slots[ String( d_i ) ] || [];
			var set    = expand_day_ranges( ranges, step, start_min, end_min );
			var cells  = body.querySelectorAll( '.wpbc_bfb__timegrid_cell--slot[data-day="' + d_i + '"]' );
			for ( var i = 0; i < cells.length; i++ ) {
				var c  = cells[ i ];
				var mm = parseInt( c.getAttribute( 'data-minute' ), 10 );
				if ( set[ mm ] ) { c.classList.add( 'is-on' ); } else { c.classList.remove( 'is-on' ); }
			}
		}
	}

	function read_selection_into_profile( root, profile, start_min, end_min, step ) {
		var body = root.querySelector( '.wpbc_bfb__timegrid_body' );
		if ( ! body || ! profile ) { return; }
		for ( var d_i = 1; d_i <= 7; d_i++ ) {
			var cells = body.querySelectorAll( '.wpbc_bfb__timegrid_cell--slot[data-day="' + d_i + '"].is-on' );
			var minutes = [], i;
			for ( i = 0; i < cells.length; i++ ) {
				minutes.push( parseInt( cells[i].getAttribute( 'data-minute' ), 10 ) );
			}
			profile.slots[ String( d_i ) ] = merge_day_ranges( minutes, step );
		}
	}

	function toggle_rect( root, day_from, day_to, min_from, min_to, mode ) {
		var body = root.querySelector( '.wpbc_bfb__timegrid_body' );
		if ( ! body ) { return; }
		var df = Math.min( day_from, day_to ), dt = Math.max( day_from, day_to );
		var mf = Math.min( min_from, min_to ),  mt = Math.max( min_from, min_to );
		for ( var d_i = df; d_i <= dt; d_i++ ) {
			var cells = body.querySelectorAll( '.wpbc_bfb__timegrid_cell--slot[data-day="' + d_i + '"]' );
			for ( var i = 0; i < cells.length; i++ ) {
				var c  = cells[i], mm = parseInt( c.getAttribute( 'data-minute' ), 10 );
				if ( mm >= mf && mm <= mt ) {
					if ( 'on' === mode ) { c.classList.add( 'is-on' ); }
					else if ( 'off' === mode ) { c.classList.remove( 'is-on' ); }
					else { c.classList.toggle( 'is-on' ); }
				}
			}
		}
	}

	/* ====================== Inspector controller ====================== */

	/**
	 * Parse day tokens like "Mon,Wed,Fri", "1-5", "Mon-Fri".
	 *
	 * @return {Array<number>} days 1..7
	 */
	function parse_days_input( txt ) {
		var map = { mon:1, tue:2, wed:3, thu:4, fri:5, sat:6, sun:7 };
		if ( ! txt || 'string' !== typeof txt ) { return [1,2,3,4,5,6,7]; }
		var t = txt.toLowerCase().replace(/\s+/g,'').trim();
		if ( ! t ) { return [1,2,3,4,5,6,7]; }

		function push_range( a, b, out ) {
			var i, s = Math.min( a, b ), e = Math.max( a, b );
			for ( i = s; i <= e; i++ ) { out.push( i ); }
		}

		var out = [];
		// split by comma first, then support ranges with '-'
		var parts = t.split(',');
		for ( var i = 0; i < parts.length; i++ ) {
			var p = parts[i];
			if ( ! p ) { continue; }
			var rng = p.split('-');
			if ( rng.length === 2 ) {
				var a = map[ rng[0] ] || parseInt( rng[0], 10 );
				var b = map[ rng[1] ] || parseInt( rng[1], 10 );
				if ( isFinite( a ) && isFinite( b ) ) { push_range( a, b, out ); }
			} else {
				var v = map[ p ] || parseInt( p, 10 );
				if ( isFinite( v ) ) { out.push( v ); }
			}
		}
		// sanitize to 1..7 unique
		var seen = {}; out = out.filter( function(n){ if ( n < 1 || n > 7 || seen[n] ){ return false; } seen[n] = true; return true; } );
		return out.length ? out : [1,2,3,4,5,6,7];
	}

	/**
	 * Initialize grid (rows, painting, events) and wire toolbar actions.
	 */
	function init_grid_controller( inspector_root, data_obj, update_hidden_json_cb ) {
		if ( inspector_root.__wpbc_timegrid_inited ) { return; }
		inspector_root.__wpbc_timegrid_inited = true;

		var grid_root     = inspector_root.querySelector( '.wpbc_bfb__timegrid_root' );
		var body_el       = grid_root.querySelector( '.wpbc_bfb__timegrid_body' );
		var start_time_in = inspector_root.querySelector( '[data-inspector-key="start_time"]' );
		var end_time_in   = inspector_root.querySelector( '[data-inspector-key="end_time"]' );
		var step_in       = inspector_root.querySelector( '[data-inspector-key="step_minutes"]' );
		var week_cycle_in = inspector_root.querySelector( '.js-week-cycle' );
		var profile_sel   = inspector_root.querySelector( '.js-profile-select' );

		var btn_rename    = inspector_root.querySelector( '.js-profile-rename' );
		var btn_duplicate = inspector_root.querySelector( '.js-profile-duplicate' );
		var btn_clear     = inspector_root.querySelector( '.js-profile-clear' );
		var btn_row_fill  = inspector_root.querySelector( '.js-row-fill' );
		var btn_col_fill  = inspector_root.querySelector( '.js-col-fill' );
		var btn_copy_day  = inspector_root.querySelector( '.js-copy-prev-day' );
		var btn_copy_week = inspector_root.querySelector( '.js-copy-prev-week' );

		function get_state() {
			var start_min = time_to_min( ( start_time_in && start_time_in.value ) || '08:00' );
			var end_min   = time_to_min( ( end_time_in   && end_time_in.value   ) || '20:00' );
			var step      = normalize_step( ( step_in     && step_in.value ) || 30 );
			if ( start_min == null ) { start_min = 8 * 60; }
			if ( end_min   == null ) { end_min   = 20 * 60; }
			if ( end_min <= start_min ) { end_min = start_min + step; }
			return { start_min: start_min, end_min: end_min, step: step };
		}

		function refresh_profile_selector() {
			profile_sel.innerHTML = '';
			( data_obj.profiles || [] ).forEach( function( p, i ) {
				var opt = d.createElement( 'option' );
				opt.value = '' + i;
				opt.textContent = ( p && p.label ) ? p.label : ( 'Week ' + ( i + 1 ) );
				profile_sel.appendChild( opt );
			} );
			if ( data_obj.profiles.length ) { profile_sel.value = '0'; }
		}

		function current_profile_index() {
			var idx = parseInt( profile_sel.value || '0', 10 );
			if ( ! isFinite( idx ) || idx < 0 ) { idx = 0; }
			if ( idx >= data_obj.profiles.length ) { idx = data_obj.profiles.length - 1; }
			return idx;
		}

		function current_profile() {
			return data_obj.profiles[ current_profile_index() ];
		}

		function rebuild_rows_and_paint() {
			var st = get_state();
			render_grid_rows( body_el, st.start_min, st.end_min, st.step );
			paint_selection( grid_root, current_profile(), st.start_min, st.end_min, st.step );
		}

		function persist_profiles() {
			var st = get_state();
			read_selection_into_profile( grid_root, current_profile(), st.start_min, st.end_min, st.step );
			update_hidden_json_cb( data_obj.profiles );
		}

		/* ---------- Toolbar actions (buttons) ---------- */

		// Rename profile
		if ( btn_rename ) {
			btn_rename.addEventListener( 'click', function() {
				var p = current_profile(); if ( ! p ) { return; }
				var nv = w.prompt( 'Profile name:', p.label || '' );
				if ( nv != null ) {
					p.label = ( '' + nv ).trim() || p.label;
					var keep = current_profile_index();
					refresh_profile_selector();
					profile_sel.value = '' + keep;
					persist_profiles();
				}
			} );
		}

		// Duplicate profile (max 6, per UI)
		if ( btn_duplicate ) {
			btn_duplicate.addEventListener( 'click', function() {
				if ( data_obj.profiles.length >= 6 ) {
					w.alert( 'Maximum profiles reached (6).' );
					return;
				}
				var idx = current_profile_index();
				var p   = current_profile();
				var copy = JSON.parse( JSON.stringify( p ) );
				copy.label = ( p.label || 'Week' ) + ' (copy)';
				data_obj.profiles.splice( idx + 1, 0, copy );

				// Adjust cycle to fit
				var wc = parseInt( ( week_cycle_in && week_cycle_in.value ) || '1', 10 );
				if ( ! isFinite( wc ) || wc < 1 ) { wc = 1; }
				wc = Math.min( 6, Math.max( wc, data_obj.profiles.length ) );
				if ( week_cycle_in ) { week_cycle_in.value = '' + wc; }
				data_obj.week_cycle = wc;

				refresh_profile_selector();
				profile_sel.value = '' + ( idx + 1 );
				rebuild_rows_and_paint();
				persist_profiles();
			} );
		}

		// Clear all slots in current profile
		if ( btn_clear ) {
			btn_clear.addEventListener( 'click', function() {
				var p = current_profile(); if ( ! p ) { return; }
				p.slots = { '1':[], '2':[], '3':[], '4':[], '5':[], '6':[], '7':[] };
				rebuild_rows_and_paint();
				persist_profiles();
			} );
		}

		// Copy ← day : copy day-1 into day, for 2..7
		if ( btn_copy_day ) {
			btn_copy_day.addEventListener( 'click', function() {
				var p = current_profile(); if ( ! p ) { return; }
				var st = get_state();
				read_selection_into_profile( grid_root, p, st.start_min, st.end_min, st.step );
				for ( var d_i = 2; d_i <= 7; d_i++ ) {
					p.slots[ String( d_i ) ] = JSON.parse( JSON.stringify( p.slots[ String( d_i - 1 ) ] || [] ) );
				}
				rebuild_rows_and_paint();
				persist_profiles();
			} );
		}

		// Copy ← week : copy previous profile slots into current
		if ( btn_copy_week ) {
			btn_copy_week.addEventListener( 'click', function() {
				var idx = current_profile_index();
				if ( idx <= 0 ) { return; }
				var prev = data_obj.profiles[ idx - 1 ];
				var cur  = data_obj.profiles[ idx ];
				cur.slots = JSON.parse( JSON.stringify( prev && prev.slots ? prev.slots : { '1':[], '2':[], '3':[], '4':[], '5':[], '6':[], '7':[] } ) );
				rebuild_rows_and_paint();
				persist_profiles();
			} );
		}

		// Fill row… : prompt for time range; apply across ALL days
		if ( btn_row_fill ) {
			btn_row_fill.addEventListener( 'click', function() {
				var st = get_state();
				var rng = w.prompt( 'Enter time range to fill across ALL days (e.g. 09:00-12:00):', '' );
				if ( ! rng ) { return; }
				var mm = rng.replace(/\s+/g,'').split('-');
				if ( mm.length !== 2 ) { return; }
				var a = time_to_min( mm[0] ), b = time_to_min( mm[1] );
				if ( a == null || b == null ) { return; }
				a = snap_to_step( a, st.step, 'down' );
				b = snap_to_step( b, st.step, 'up' );
				if ( b <= a ) { return; }
				// paint DOM rectangle then persist (automatic merge)
				toggle_rect( grid_root, 1, 7, a, b - st.step, 'on' );
				persist_profiles();
				paint_selection( grid_root, current_profile(), st.start_min, st.end_min, st.step );
			} );
		}

		// Fill column… : prompt for time range and days (e.g. "Mon-Fri" or "1,3,5")
		if ( btn_col_fill ) {
			btn_col_fill.addEventListener( 'click', function() {
				var st = get_state();
				var rng = w.prompt( 'Enter time range (e.g. 10:00-14:00):', '' );
				if ( ! rng ) { return; }
				var days = w.prompt( 'Enter days (Mon-Fri, 1-7, Mon,Wed,Fri). Leave empty for Mon-Fri:', 'Mon-Fri' );
				var day_list = parse_days_input( days || 'Mon-Fri' );

				var mm = rng.replace(/\s+/g,'').split('-');
				if ( mm.length !== 2 ) { return; }
				var a = time_to_min( mm[0] ), b = time_to_min( mm[1] );
				if ( a == null || b == null ) { return; }
				a = snap_to_step( a, st.step, 'down' );
				b = snap_to_step( b, st.step, 'up' );
				if ( b <= a ) { return; }

				// apply to selected days only
				for ( var i = 0; i < day_list.length; i++ ) {
					var d_i = day_list[i];
					toggle_rect( grid_root, d_i, d_i, a, b - st.step, 'on' );
				}
				persist_profiles();
				paint_selection( grid_root, current_profile(), st.start_min, st.end_min, st.step );
			} );
		}

		/* ---------- Core UI bindings ---------- */

		// Week cycle
		if ( week_cycle_in ) {
			week_cycle_in.addEventListener( 'change', function() {
				var wc = parseInt( week_cycle_in.value || '1', 10 );
				if ( ! isFinite( wc ) || wc < 1 ) { wc = 1; }
				if ( wc > 6 ) { wc = 6; }
				data_obj.week_cycle = wc;
				data_obj.profiles   = reconcile_profiles( data_obj.profiles || [], wc );
				var keep_idx = 0;
				refresh_profile_selector();
				profile_sel.value = '' + keep_idx;
				rebuild_rows_and_paint();
				persist_profiles();
			} );
		}

		// Profile switch
		if ( profile_sel ) {
			profile_sel.addEventListener( 'change', function() {
				rebuild_rows_and_paint();
			} );
		}

		// Time range / step
		[ start_time_in, end_time_in, step_in ].forEach( function( el ) {
			if ( el ) {
				el.addEventListener( 'change', function() {
					rebuild_rows_and_paint();
					persist_profiles();
				} );
			}
		} );

		// Drag selection
		var drag_state = null;
		body_el.addEventListener( 'mousedown', function( ev ) {
			var cell = ev.target && ev.target.closest && ev.target.closest( '.wpbc_bfb__timegrid_cell--slot' );
			if ( ! cell ) { return; }
			var day = parseInt( cell.getAttribute( 'data-day' ), 10 );
			var mm  = parseInt( cell.getAttribute( 'data-minute' ), 10 );
			var will_on = ! cell.classList.contains( 'is-on' );
			drag_state = { day0: day, mm0: mm, mode: will_on ? 'on' : 'off' };
			toggle_rect( grid_root, day, day, mm, mm, drag_state.mode );
			ev.preventDefault();
		} );
		body_el.addEventListener( 'mouseover', function( ev ) {
			if ( ! drag_state ) { return; }
			var cell = ev.target && ev.target.closest && ev.target.closest( '.wpbc_bfb__timegrid_cell--slot' );
			if ( ! cell ) { return; }
			var day = parseInt( cell.getAttribute( 'data-day' ), 10 );
			var mm  = parseInt( cell.getAttribute( 'data-minute' ), 10 );
			toggle_rect( grid_root, drag_state.day0, day, drag_state.mm0, mm, drag_state.mode );
		} );
		w.addEventListener( 'mouseup', function() {
			if ( drag_state ) {
				drag_state = null;
				persist_profiles();
			}
		} );

		// First render
		data_obj.week_cycle = parseInt( data_obj.week_cycle || 1, 10 );
		if ( ! isFinite( data_obj.week_cycle ) || data_obj.week_cycle < 1 ) { data_obj.week_cycle = 1; }
		if ( data_obj.week_cycle > 6 ) { data_obj.week_cycle = 6; }
		data_obj.profiles = reconcile_profiles( Array.isArray( data_obj.profiles ) ? data_obj.profiles : [], data_obj.week_cycle );

		refresh_profile_selector();
		rebuild_rows_and_paint();
		persist_profiles();
	}

	/* ====================== Registration (deferred) ====================== */

	function with_registry( cb ) {
		var tries = 0, max_tries = 200;
		(function loop() {
			var Core = w.WPBC_BFB_Core || {};
			var Registry = Core.WPBC_BFB_Field_Renderer_Registry;
			var Field_Base = Core.WPBC_BFB_Field_Base || Core.WPBC_BFB_Select_Base;
			if ( Registry && Registry.register && Field_Base ) {
				cb( Registry, Field_Base );
			} else if ( tries++ < max_tries ) {
				setTimeout( loop, 50 );
			} else if ( w.console ) {
				w.console.error( '[WPBC][time_slots] Core/Registry not available.' );
			}
		})();
	}

	function register_time_slots() {
		with_registry( function( Registry, Field_Base ) {
			class wpbc_bfb_field_time_slots extends Field_Base {
				static template_id = 'wpbc-bfb-field-time-slots';
				static kind        = 'time_slots';
				static get_defaults() {
					var d = ( super.get_defaults ? super.get_defaults() : {} );
					return Object.assign( {}, d, {
						type        : 'time_slots',
						label       : 'Time Slots',
						cssclass    : '',
						help        : '',
						start_time  : '08:00',
						end_time    : '20:00',
						step_minutes: 30,
						week_cycle  : 1,
						profiles    : [
							{ key: 'A', label: 'Week A', slots: { '1':[], '2':[], '3':[], '4':[], '5':[], '6':[], '7':[] } }
						],
						min_width   : '320px'
					} );
				}
			}
			try { Registry.register( 'time_slots', wpbc_bfb_field_time_slots ); }
			catch ( e ) { if ( w.console ) { w.console.error( '[WPBC][time_slots] register failed:', e ); } }
			w.WPBC_BFB_Field_Time_Slots = wpbc_bfb_field_time_slots; // for debugging
		} );
	}
	register_time_slots();

	/* ====================== Inspector init bindings ====================== */

	function try_init_on_panel( panel ) {
		if ( ! panel ) { return; }
		var grid_root = panel.querySelector( '.wpbc_bfb__timegrid_root' );
		var json_el   = panel.querySelector( '.js-profiles-json' );
		if ( ! grid_root || ! json_el ) { return; }
		if ( panel.__wpbc_timegrid_inited ) { return; }

		var profiles = [];
		try { profiles = JSON.parse( json_el.value || '[]' ); } catch (e) { profiles = []; }

		function update_hidden_json( profiles_arr ) {
			try {
				json_el.value = JSON.stringify( profiles_arr || [] );
				var evt = d.createEvent( 'HTMLEvents' ); evt.initEvent( 'change', true, false ); json_el.dispatchEvent( evt );
			} catch (e) {}
		}

		var data_obj = {
			start_time  : ( ( panel.querySelector( '[data-inspector-key="start_time"]' ) || {} ).value ) || '08:00',
			end_time    : ( ( panel.querySelector( '[data-inspector-key="end_time"]' )   || {} ).value ) || '20:00',
			step_minutes: parseInt( ( ( panel.querySelector( '[data-inspector-key="step_minutes"]' ) || {} ).value ) || '30', 10 ),
			week_cycle  : parseInt( ( ( panel.querySelector( '.js-week-cycle' ) || {} ).value ) || '1', 10 ),
			profiles    : profiles
		};

		init_grid_controller( panel, data_obj, update_hidden_json );
	}

	d.addEventListener( 'wpbc_bfb_inspector_ready', function( ev ) {
		try { try_init_on_panel( ev && ev.detail && ev.detail.panel ); } catch (e) {}
	} );

	d.addEventListener( 'DOMContentLoaded', function() {
		var panels = d.querySelectorAll( '.wpbc_bfb__inspector__body' );
		for ( var i = 0; i < panels.length; i++ ) { try_init_on_panel( panels[ i ] ); }
	} );

	try {
		var mo = new MutationObserver( function( muts ) {
			for ( var i = 0; i < muts.length; i++ ) {
				var n = muts[ i ].target;
				if ( ! n ) { continue; }
				if ( n.classList && n.classList.contains( 'wpbc_bfb__inspector__body' ) ) {
					try_init_on_panel( n );
				} else if ( n.querySelector ) {
					var p = n.querySelector( '.wpbc_bfb__inspector__body' );
					if ( p ) { try_init_on_panel( p ); }
				}
			}
		} );
		mo.observe( d.documentElement, { childList: true, subtree: true } );
	} catch (e) {}

	/* ====================== Minimal CSS (scoped) ====================== */

	var css = ''
	+ '.wpbc_bfb__time_preview__week{border:1px solid #e5e5e5;border-radius:6px;padding:8px;margin:8px 0;}'
	+ '.wpbc_bfb__time_preview__week_title{margin-bottom:6px;}'
	+ '.wpbc_bfb__time_preview__row{display:flex;align-items:center;margin:2px 0;}'
	+ '.wpbc_bfb__time_preview__day{width:42px;opacity:.8;font-size:12px;}'
	+ '.wpbc_bfb__time_badge{display:inline-block;border:1px solid #d0d0d0;border-radius:12px;padding:2px 8px;margin:0 4px 4px 0;font-size:11px;background:#f7f7f7;}'
	+ '.wpbc_bfb__time_badge--empty{opacity:.6;}'
	+ '.wpbc_bfb__timegrid_root{border:1px solid #e1e1e1;border-radius:6px;overflow:hidden;margin-top:6px;}'
	+ '.wpbc_bfb__timegrid_head,.wpbc_bfb__timegrid_row{display:grid;grid-template-columns:80px repeat(7,1fr);}'
	+ '.wpbc_bfb__timegrid_cell{border-bottom:1px solid #f0f0f0;border-right:1px solid #f5f5f5;padding:4px;min-height:24px;box-sizing:border-box;}'
	+ '.wpbc_bfb__timegrid_cell--corner{background:#fafafa;}'
	+ '.wpbc_bfb__timegrid_cell--day{background:#fafafa;text-align:center;font-weight:600;}'
	+ '.wpbc_bfb__timegrid_cell--time{background:#fafafa;font-variant-numeric:tabular-nums;}'
	+ '.wpbc_bfb__timegrid_cell--slot{cursor:crosshair;}'
	+ '.wpbc_bfb__timegrid_cell--slot.is-on{background:rgba(0,120,212,.12);outline:1px solid rgba(0,120,212,.35);}'
	+ '.wpbc_bfb__timegrid_toolbar{display:flex;justify-content:space-between;gap:8px;margin:8px 0;}'
	+ '.wpbc_bfb__timegrid_profiles select{min-width:140px;}';

	try { var st = d.createElement( 'style' ); st.type = 'text/css'; st.appendChild( d.createTextNode( css ) ); d.head.appendChild( st ); } catch (e) {}

})( window, document );
