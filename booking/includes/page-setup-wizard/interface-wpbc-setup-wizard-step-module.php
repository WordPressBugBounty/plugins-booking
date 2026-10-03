<?php
/**
 * Reusable step-module contract for the Setup Wizard module.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Define the server-owned boundary implemented by a reusable setup editor.
 *
 * A module owns its field contract, read-only initial data, presentation
 * context, validation, template, and compiled assets. Consumer pages own
 * navigation, authorization, persistence, and any canonical mutation.
 */
interface WPBC_Setup_Wizard_Step_Module {

	/**
	 * Return the stable module and step identifier.
	 *
	 * @return string Stable identifier.
	 */
	public function get_step_id();

	/**
	 * Return the rail and template metadata contributed by this module.
	 *
	 * @return array{id:string,label:string,template:string,footer_note?:string} Step definition.
	 */
	public function get_step_definition();

	/**
	 * Return the absolute server-owned template path.
	 *
	 * @return string Absolute template path.
	 */
	public function get_template_path();

	/**
	 * Return the ordered field names accepted by this module.
	 *
	 * @return string[] Field allow-list.
	 */
	public function get_field_names();

	/**
	 * Return fields required when the consumer advances.
	 *
	 * @return string[] Required field identifiers.
	 */
	public function get_required_fields();

	/**
	 * Return authorized canonical values or safe read-only suggestions.
	 *
	 * @return array<string,mixed> Initial field values.
	 */
	public function get_initial_values();

	/**
	 * Return other step values required to build this module's context.
	 *
	 * Dependencies are read-only presentation inputs. They do not grant access
	 * to another step's mutation or persistence behavior.
	 *
	 * @return string[] Stable dependency step identifiers.
	 */
	public function get_context_dependencies();

	/**
	 * Build the data-only template context for one consumer.
	 *
	 * @param array<string,mixed> $field_values     Validated module field values.
	 * @param array<string,mixed> $consumer_context Read-only dependency values keyed by step ID.
	 *
	 * @return array<string,mixed> Authorized presentation context.
	 */
	public function get_context( array $field_values, array $consumer_context = array() );

	/**
	 * Validate one allow-listed module field.
	 *
	 * @param string $field_id     Stable field identifier.
	 * @param mixed  $raw_value    Untrusted submitted or stored value.
	 * @param bool   $is_required  Whether an empty value is invalid.
	 *
	 * @return mixed|WP_Error Normalized value or a validation error.
	 */
	public function validate_field( $field_id, $raw_value, $is_required );

	/**
	 * Enqueue compiled module assets for an authorized consumer page.
	 *
	 * @param string       $module_url          Absolute URL to the Setup Wizard module root.
	 * @param string|false $asset_version       Plugin version used for cache busting.
	 * @param string       $shared_style_handle Consumer shell style handle.
	 * @param string       $shared_script_handle Consumer shell script handle.
	 *
	 * @return void
	 */
	public function enqueue_assets( $module_url, $asset_version, $shared_style_handle, $shared_script_handle );
}

/**
 * Identify step fields that must be rebuilt from current plugin state.
 *
 * The Setup Wizard checkpoint records the values submitted at each successful
 * save boundary. That history is useful for navigation, idempotency, and
 * wizard-only metadata, but it must not become a stale cache of canonical
 * Booking Calendar settings. Modules implement this companion contract for
 * fields whose initial values are read from current canonical state, or whose
 * value is an intentionally one-request lifecycle reset such as a consumed
 * mutation intent.
 *
 * Fields not returned by this contract remain checkpoint-owned wizard
 * metadata. This distinction is intentionally explicit because some steps,
 * such as publishing and Booking Form template selection, store choices that
 * cannot be reconstructed safely from canonical records.
 */
interface WPBC_Setup_Wizard_Current_Values_Module {

	/**
	 * Return fields that always use the module's latest initial values.
	 *
	 * Every returned name must also be present in the module field allow-list.
	 * Unknown names are ignored by the shared presentation service.
	 *
	 * @return string[] Current-value field identifiers.
	 */
	public function get_current_value_field_names();
}

/**
 * Define optional validation for relationships between normalized fields.
 *
 * Modules implement this companion contract only when correctness depends on
 * more than one field. Field-level validation always runs first, so this method
 * receives scalar values that already passed the module's allow-list.
 */
interface WPBC_Setup_Wizard_Step_Values_Validator {

	/**
	 * Validate relationships across one module's normalized field set.
	 *
	 * @param array<string,mixed> $validated_values Field values after individual validation.
	 *
	 * @return array<string,mixed>|WP_Error Validated values or a field-addressable error.
	 */
	public function validate_values( array $validated_values );
}

/**
 * Define optional validation that depends on earlier wizard-step values.
 *
 * This companion contract keeps cross-step business rules inside the consuming
 * domain module. The shared draft validator supplies only allow-listed,
 * normalized dependency values and remains unaware of their business meaning.
 */
interface WPBC_Setup_Wizard_Contextual_Values_Validator {

	/**
	 * Validate normalized module values against read-only dependency values.
	 *
	 * @param array<string,mixed> $validated_values Field values after module validation.
	 * @param array<string,mixed> $consumer_context Allow-listed dependency values keyed by step ID.
	 *
	 * @return array<string,mixed>|WP_Error Validated values or a field-addressable error.
	 */
	public function validate_values_with_context( array $validated_values, array $consumer_context );
}

/**
 * Define optional route availability for a registered step module.
 *
 * Registration keeps the template and validation contract explicit. Route
 * availability determines whether the consumer may expose the step in the
 * current site context, such as omitting publishing from live-demo websites.
 */
interface WPBC_Setup_Wizard_Conditional_Step_Module {

	/**
	 * Determine whether the module belongs to the current active route.
	 *
	 * @param array<string,mixed> $consumer_context Optional read-only route context.
	 *
	 * @return bool True when the module may be exposed.
	 */
	public function is_available( array $consumer_context = array() );
}
