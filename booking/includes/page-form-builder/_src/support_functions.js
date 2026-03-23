/**
 * Help Fucntions.
 * @file: ../includes/page-form-builder/_out/bfb_support_func.js
 */

/**
 * Clipboard (UI-only helper)
 *
 * @param text
 * @returns {Promise<boolean>}
 */
async function wpbc_copy_to_clipboard(text) {
	try {
		if ( window.isSecureContext && navigator.clipboard && navigator.clipboard.writeText ) {
			await navigator.clipboard.writeText( String( text || '' ) );
			return true;
		}
	} catch ( e ) {
		window._wpbc?.dev?.error?.( 'wpbc_copy_to_clipboard', e );
	}

	try {
		const ta = document.createElement( 'textarea' );
		ta.value = String( text || '' );
		ta.setAttribute( 'readonly', '' );
		ta.style.position = 'fixed';
		ta.style.top      = '-9999px';
		ta.style.opacity  = '0';
		document.body.appendChild( ta );
		ta.focus();
		ta.select();
		const ok = document.execCommand( 'copy' );
		document.body.removeChild( ta );
		return !! ok;
	} catch ( _ ) {
		return false;
	}
}
