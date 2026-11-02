<?php
/**
 * Shared Booking form-definition repository.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Load the exact authorized Booking Form definition used by canonical workflows.
 *
 * This repository reuses the front-end form-source resolver so BFB ownership,
 * MultiUser scope, preview validation, and the published fallback chain remain
 * identical to the form that accepted the booking. It returns configuration
 * data only and never renders fields or accepts a browser-selected source.
 * The class remains extensible only so released domain-specific class names can
 * provide inheritance-only compatibility facades.
 *
 * @since 12.0.0
 */
class WPBC_Booking_Form_Definition_Repository {

	/**
	 * Load one normalized form definition.
	 *
	 * @param int                 $resource_id Booking Resource ID.
	 * @param string              $form_key    Exact form slug selected by the canonical workflow.
	 * @param array<string,mixed> $context     Server-validated form-source context.
	 *
	 * @return array<string,string> Structure, settings, Advanced Mode, and content-form sources.
	 */
	public function get_form_definition( $resource_id, $form_key, $context = array() ) {
		$resource_id = absint( $resource_id );
		$form_key    = sanitize_text_field( (string) $form_key );
		$context     = is_array( $context ) ? $context : array();
		$form_status = isset( $context['form_status'] ) ? sanitize_key( $context['form_status'] ) : 'published';
		$form_status = 'preview' === $form_status ? 'preview' : 'published';

		if ( '' === $form_key ) {
			$form_key = 'standard';
		}

		$preview_definition = $this->get_preview_definition( $form_status, $context );
		if ( ! empty( $preview_definition ) ) {
			return $this->normalize_definition( $preview_definition, $form_key, 'preview' );
		}

		if (
			! class_exists( 'WPBC_FE_Form_Source_Resolver' )
			|| ! class_exists( 'WPBC_BFB_Form_Storage' )
			|| ! method_exists( 'WPBC_BFB_Form_Storage', 'get_form_row_by_key' )
		) {
			return $this->get_pair_fallback( $resource_id, $form_key, $context );
		}

		$request = array(
			'resource_id'     => $resource_id,
			'form_slug'       => $form_key,
			'form_status'     => $form_status,
			'custom_params'   => array(),
			'legacy_instance' => null,
			'ctx'             => $context,
		);
		if ( isset( $context['owner_user_id'] ) ) {
			$request['owner_user_id'] = absint( $context['owner_user_id'] );
		}

		$resolution = WPBC_FE_Form_Source_Resolver::resolve( $request );
		if ( ( empty( $resolution['engine'] ) || 'bfb_db' !== $resolution['engine'] ) && 'preview' === $form_status ) {
			$request['form_status'] = 'published';
			$resolution             = WPBC_FE_Form_Source_Resolver::resolve( $request );
		}
		if ( empty( $resolution['engine'] ) || 'bfb_db' !== $resolution['engine'] || empty( $resolution['bfb_loader_args'] ) ) {
			return $this->get_pair_fallback( $resource_id, $form_key, $context );
		}

		$loader_args = is_array( $resolution['bfb_loader_args'] ) ? $resolution['bfb_loader_args'] : array();
		$resolved_key = isset( $loader_args['form_slug'] ) ? sanitize_text_field( (string) $loader_args['form_slug'] ) : $form_key;
		$status       = isset( $loader_args['status'] ) ? sanitize_key( (string) $loader_args['status'] ) : 'published';
		$owner_id     = isset( $loader_args['owner_user_id'] ) ? absint( $loader_args['owner_user_id'] ) : 0;
		$form_row     = WPBC_BFB_Form_Storage::get_form_row_by_key( $resolved_key, $status, $owner_id );

		if ( ! $form_row || empty( $form_row->booking_form_id ) ) {
			return $this->get_pair_fallback( $resource_id, $form_key, $context );
		}
		if ( ! empty( $loader_args['form_id'] ) && absint( $loader_args['form_id'] ) !== absint( $form_row->booking_form_id ) ) {
			return array();
		}

		return $this->normalize_definition(
			array(
				'structure_json' => isset( $form_row->structure_json ) ? $form_row->structure_json : '',
				'settings_json'  => isset( $form_row->settings_json ) ? $form_row->settings_json : '',
				'advanced_form'  => isset( $form_row->advanced_form ) ? $form_row->advanced_form : '',
				'content_form'   => isset( $form_row->content_form ) ? $form_row->content_form : '',
			),
			$resolved_key,
			'bfb_storage'
		);
	}

	/**
	 * Read an authenticated preview payload already validated by the BFB layer.
	 *
	 * @param string              $form_status Normalized source status.
	 * @param array<string,mixed> $context     Server-validated source context.
	 *
	 * @return array<string,mixed> Preview form definition or an empty array.
	 */
	private function get_preview_definition( $form_status, $context ) {
		if ( 'preview' !== $form_status || ! function_exists( 'wpbc_bfb_preview__maybe_get_payload_from_context' ) ) {
			return array();
		}

		$preview_payload = wpbc_bfb_preview__maybe_get_payload_from_context( $context );

		return is_array( $preview_payload ) ? $preview_payload : array();
	}

	/**
	 * Retain the established Advanced Mode pair when structured BFB storage is unavailable.
	 *
	 * @param int                 $resource_id Booking Resource ID.
	 * @param string              $form_key    Exact form key.
	 * @param array<string,mixed> $context     Server-validated source context.
	 *
	 * @return array<string,string> Normalized fallback definition.
	 */
	private function get_pair_fallback( $resource_id, $form_key, $context ) {
		if ( ! function_exists( 'wpbc_get__booking_form_pair__for_field_names_listing' ) ) {
			return array();
		}

		$form_pair = wpbc_get__booking_form_pair__for_field_names_listing( $resource_id, $form_key, $context );
		if ( ! is_array( $form_pair ) ) {
			return array();
		}

		return $this->normalize_definition(
			array(
				'advanced_form' => isset( $form_pair['form'] ) ? $form_pair['form'] : '',
				'content_form'  => isset( $form_pair['content'] ) ? $form_pair['content'] : '',
			),
			$form_key,
			'advanced_mode'
		);
	}

	/**
	 * Normalize form-definition strings without exposing storage metadata.
	 *
	 * @param array<string,mixed> $definition Candidate definition.
	 * @param string              $form_key   Resolved form key.
	 * @param string              $source     Internal definition source.
	 *
	 * @return array<string,string> Bounded data-only definition.
	 */
	private function normalize_definition( $definition, $form_key, $source ) {
		$structure_json = isset( $definition['structure_json'] ) && is_scalar( $definition['structure_json'] ) ? (string) $definition['structure_json'] : '';
		$settings_json  = isset( $definition['settings_json'] ) && is_scalar( $definition['settings_json'] ) ? (string) $definition['settings_json'] : '';
		$advanced_form  = isset( $definition['advanced_form'] ) && is_scalar( $definition['advanced_form'] ) ? (string) $definition['advanced_form'] : '';
		$content_form   = isset( $definition['content_form'] ) && is_scalar( $definition['content_form'] ) ? (string) $definition['content_form'] : '';

		if ( function_exists( 'wpbc_bf__replace_custom_html_shortcodes' ) ) {
			$advanced_form = wpbc_bf__replace_custom_html_shortcodes( $advanced_form );
			$content_form  = wpbc_bf__replace_custom_html_shortcodes( $content_form );
		}
		if ( function_exists( 'wpbc_lang' ) ) {
			$advanced_form = wpbc_lang( $advanced_form );
			$content_form  = wpbc_lang( $content_form );
		}

		if ( '' === trim( $structure_json ) && '' === trim( $settings_json ) && '' === trim( $advanced_form ) && '' === trim( $content_form ) ) {
			return array();
		}

		return array(
			'form_key'       => substr( sanitize_text_field( (string) $form_key ), 0, 191 ),
			'source'         => sanitize_key( (string) $source ),
			'structure_json' => $structure_json,
			'settings_json'  => $settings_json,
			'advanced_form'  => $advanced_form,
			'content_form'   => $content_form,
		);
	}
}
