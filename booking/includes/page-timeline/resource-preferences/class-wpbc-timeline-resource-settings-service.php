<?php
/**
 * Authorized Timeline per-Resource settings service.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Orchestrate exact-ID Resource settings reads, saves, and resets.
 */
final class WPBC_Timeline_Resource_Settings_Service {

	/** @var WPBC_Timeline_Authorization Timeline authorization. */
	private $authorization;

	/** @var WPBC_Timeline_Resource_Settings_Request_Validator Request validator. */
	private $validator;

	/** @var WPBC_Timeline_Resource_Repository Resource repository. */
	private $resource_repository;

	/** @var WPBC_Timeline_Resource_Display_Preferences Current-user display preferences. */
	private $display_preferences;

	/** @var WPBC_Timeline_Resource_Settings_DTO_Mapper Settings DTO mapper. */
	private $dto_mapper;

	/** @var callable|null Optional global-default reader for tests. */
	private $default_template_callback;

	/**
	 * Construct the Resource-settings service.
	 *
	 * @param WPBC_Timeline_Authorization|null                        $authorization            Optional authorization service.
	 * @param WPBC_Timeline_Resource_Settings_Request_Validator|null $validator                Optional request validator.
	 * @param WPBC_Timeline_Resource_Repository|null                  $resource_repository      Optional Resource repository.
	 * @param WPBC_Timeline_Resource_Display_Preferences|null         $display_preferences      Optional preference service.
	 * @param WPBC_Timeline_Resource_Settings_DTO_Mapper|null         $dto_mapper               Optional DTO mapper.
	 * @param callable|null                                           $default_template_callback Optional global-default reader.
	 */
	public function __construct(
		$authorization = null,
		$validator = null,
		$resource_repository = null,
		$display_preferences = null,
		$dto_mapper = null,
		$default_template_callback = null
	) {
		$this->authorization             = $authorization ? $authorization : new WPBC_Timeline_Authorization();
		$this->validator                 = $validator ? $validator : new WPBC_Timeline_Resource_Settings_Request_Validator();
		$this->resource_repository       = $resource_repository ? $resource_repository : new WPBC_Timeline_Resource_Repository();
		$this->display_preferences       = $display_preferences ? $display_preferences : new WPBC_Timeline_Resource_Display_Preferences();
		$this->dto_mapper                = $dto_mapper ? $dto_mapper : new WPBC_Timeline_Resource_Settings_DTO_Mapper();
		$this->default_template_callback = is_callable( $default_template_callback ) ? $default_template_callback : null;
	}

	/**
	 * Read one authorized Resource-settings DTO.
	 *
	 * @param mixed $request_values Untrusted allow-listed request values.
	 *
	 * @return array<string,mixed>|WP_Error Settings DTO or a safe error.
	 */
	public function read( $request_values ) {
		$validated = $this->authorize_and_validate( $request_values, false );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}

		return $this->build_dto( $validated['resource'] );
	}

	/**
	 * Save one authorized Resource booking-title display preference.
	 *
	 * @param mixed $request_values Untrusted allow-listed request values.
	 *
	 * @return array<string,mixed>|WP_Error Canonical settings DTO or a safe error.
	 */
	public function save( $request_values ) {
		$validated = $this->authorize_and_validate( $request_values, true );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}

		$resource_id = absint( $validated['resource']['id'] );
		$saved       = $this->display_preferences->save_booking_title_preference(
			$resource_id,
			$validated['booking_title'],
			array( $resource_id )
		);
		if ( is_wp_error( $saved ) ) {
			return $saved;
		}

		return $this->dto_mapper->map(
			$validated['resource'],
			$saved,
			true,
			$this->get_inherited_template()
		);
	}

	/**
	 * Reset one authorized Resource to the missing-record inheritance state.
	 *
	 * @param mixed $request_values Untrusted allow-listed request values.
	 *
	 * @return array<string,mixed>|WP_Error Canonical settings DTO or a safe error.
	 */
	public function reset( $request_values ) {
		$validated = $this->authorize_and_validate( $request_values, false );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}

		$resource_id = absint( $validated['resource']['id'] );
		$reset       = $this->display_preferences->reset_booking_title_preference( $resource_id, array( $resource_id ) );
		if ( is_wp_error( $reset ) ) {
			return $reset;
		}

		return $this->dto_mapper->map(
			$validated['resource'],
			$reset,
			false,
			$this->get_inherited_template()
		);
	}

	/**
	 * Check page authorization, validate the request, and reauthorize its exact ID.
	 *
	 * @param mixed $request_values Untrusted allow-listed request values.
	 * @param bool  $is_save        Whether the save request shape is required.
	 *
	 * @return array<string,mixed>|WP_Error Authorized Resource plus validated fields.
	 */
	private function authorize_and_validate( $request_values, $is_save ) {
		if ( ! $this->authorization->current_user_can_view() ) {
			return new WP_Error(
				'wpbc_timeline_resource_settings_forbidden',
				__( 'Timeline booking Resource settings are unavailable for this account.', 'booking' ),
				array( 'status' => 403 )
			);
		}

		$validated = $is_save ? $this->validator->validate_save( $request_values ) : $this->validator->validate_read( $request_values );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}

		$resources = $this->resource_repository->get_authorized_resources_by_ids( array( $validated['resource_id'] ) );
		if ( is_wp_error( $resources ) ) {
			return new WP_Error(
				'wpbc_timeline_resource_settings_unavailable',
				__( 'The booking Resource settings are not available.', 'booking' ),
				array( 'status' => 404 )
			);
		}
		if ( 1 !== count( $resources ) || absint( $resources[0]['id'] ) !== $validated['resource_id'] ) {
			return new WP_Error(
				'wpbc_timeline_resource_settings_unavailable',
				__( 'The booking Resource settings are not available.', 'booking' ),
				array( 'status' => 404 )
			);
		}

		$validated['resource'] = $resources[0];

		return $validated;
	}

	/**
	 * Build the canonical settings DTO for one authorized Resource.
	 *
	 * @param array<string,mixed> $resource Authorized Resource record.
	 *
	 * @return array<string,mixed>|WP_Error Settings DTO or a safe preference error.
	 */
	private function build_dto( $resource ) {
		$resource_id   = absint( $resource['id'] );
		$booking_title = $this->display_preferences->get_booking_title_preference( $resource_id, array( $resource_id ) );
		$is_configured = $this->display_preferences->has_booking_title_preference( $resource_id, array( $resource_id ) );
		if ( is_wp_error( $booking_title ) ) {
			return $booking_title;
		}
		if ( is_wp_error( $is_configured ) ) {
			return $is_configured;
		}

		return $this->dto_mapper->map(
			$resource,
			$booking_title,
			$is_configured,
			$this->get_inherited_template()
		);
	}

	/**
	 * Read the existing global Timeline booking-title option without changing it.
	 *
	 * @return mixed Current legacy global option value.
	 */
	private function get_inherited_template() {
		if ( $this->default_template_callback ) {
			return call_user_func( $this->default_template_callback );
		}

		return get_bk_option( 'booking_default_title_in_day_for_calendar_view_mode' );
	}
}
