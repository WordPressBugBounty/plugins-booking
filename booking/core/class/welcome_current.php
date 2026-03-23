<?php

// Exit if accessed directly
if ( !defined( 'ABSPATH' ) ) exit;

/**
 * What's New section for Booking Calendar 11.0
 *
 * @param object $obj
 *
 * @return void
 */
function wpbc_welcome_section_10_15( $obj ) {

	$section_param_arr = array( 'version_num' => '10.15', 'show_expand' => false );

	$obj->expand_section_start( $section_param_arr );

	// $obj->asset_path = 'http://beta/assets/'; // TODO: comment this in production.
	?>
	<div class="wpbc_wn_container">

		<div class="wpbc_wn_section">
			<h2><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( 'New Drag & Drop Booking Form Builder' ) ); ?></h2>

			<div class="wpbc_wn_col" style="flex: 1 1 100%;margin: 0;">
				<?php // phpcs:ignore PluginCheck.CodeAnalysis.ImageFunctions.NonEnqueuedImage ?>
				<img src="<?php echo esc_attr( $obj->section_img_url( '10.15/wp_booking_calendar__form_builder_overview_02.png' ) ); ?>" style="margin:10px 0;width:98%;" />
			</div>

			<div class="wpbc_wn_col" style="flex: 1 1 100%;margin: 0;">
				<ul>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **NEW / BETA**: Introduced the new **Drag & Drop Booking Form Builder** for visually creating booking forms without manually editing form code.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Build forms visually**: Drag fields into the canvas, arrange the layout, and see the result instantly in the live preview.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Faster and easier workflow**: Create modern booking forms without working with complex manual shortcodes.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Available in all versions**: Booking Calendar now supports **multiple custom booking form configurations** in all versions, including the Free version.' ) ); ?></li>
				</ul>
			</div>
		</div>


		<div class="wpbc_wn_section">
			<h2><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( 'Create Booking Forms, Contact Forms, and Inquiry Forms' ) ); ?></h2>

			<div class="wpbc_wn_col" style="flex: 1 1 48%;margin: 0 1% 0 0;">
				<?php // phpcs:ignore PluginCheck.CodeAnalysis.ImageFunctions.NonEnqueuedImage ?>
				<img src="<?php echo esc_attr( $obj->section_img_url( '10.15/wp_booking_calendar_10_15_contact_inquiry_forms_05.png' ) ); ?>" style="margin:10px 0;width:98%;" />
			</div>

			<div class="wpbc_wn_col" style="flex: 1 1 48%;margin: 0 0 0 1%;">
				<?php // phpcs:ignore PluginCheck.CodeAnalysis.ImageFunctions.NonEnqueuedImage ?>
				<img src="<?php echo esc_attr( $obj->section_img_url( '10.15/wp_booking_calendar_10_15_contact_form_preview_01.png' ) ); ?>" style="margin:10px 0;width:98%;" />
			</div>

			<div class="wpbc_wn_col" style="flex: 1 1 100%;margin: 0;">
				<ul>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **NEW**: Added support for **Contact Forms / Inquiry Forms / Request Forms** — the calendar is now optional.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Use Booking Calendar as a contact form alternative**: Create forms without booking dates and manage all submissions inside Booking Calendar.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Ready-to-use templates**: Start faster with predefined templates for booking, contact, and inquiry forms.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Flexible start**: Create a form from a template or begin with a blank canvas for full control.' ) ); ?></li>
				</ul>
			</div>
		</div>


		<div class="wpbc_wn_section">
			<h2><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( 'Powerful Visual Layout Builder' ) ); ?></h2>

			<div class="wpbc_wn_col" style="flex: 1 1 100%;margin: 0;">
				<?php // phpcs:ignore PluginCheck.CodeAnalysis.ImageFunctions.NonEnqueuedImage ?>
				<img src="<?php echo esc_attr( $obj->section_img_url( '10.15/wp_booking_calendar__form_builder_02.gif' ) ); ?>" style="margin:10px 0;width:98%;" />
			</div>

			<div class="wpbc_wn_col" style="flex: 1 1 100%;margin: 0;">
				<ul>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Drag & drop fields** from the Fields palette directly into the form canvas.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Live visual preview** while building and editing the form.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Rows and columns layout** for clean and structured form designs.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Nested sections** (up to 5 levels) for advanced multi-row and multi-column layouts.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Ready section layouts** with 1, 2, 3, or 4 columns.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Column resizing with visual resizers** for precise control of layout widths.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Multi-page forms** for creating step-by-step wizard-style booking forms.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Drag & drop sorting of sections** plus **Move Up / Move Down controls** for faster layout management.' ) ); ?></li>
				</ul>
			</div>
		</div>


		<div class="wpbc_wn_section">
			<h2><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( 'Smart Editing and Form Controls' ) ); ?></h2>

			<div class="wpbc_wn_col" style="flex: 1 1 48%;margin: 0 1% 0 0;">
				<?php // phpcs:ignore PluginCheck.CodeAnalysis.ImageFunctions.NonEnqueuedImage ?>
				<img src="<?php echo esc_attr( $obj->section_img_url( '10.15/wp_booking_calendar_10_15_sidebar_inspector_02.png' ) ); ?>" style="margin:10px 0;width:98%;" />
			</div>

			<div class="wpbc_wn_col" style="flex: 1 1 48%;margin: 0 0 0 1%;">
				<?php // phpcs:ignore PluginCheck.CodeAnalysis.ImageFunctions.NonEnqueuedImage ?>
				<img src="<?php echo esc_attr( $obj->section_img_url( '10.15/wp_booking_calendar_10_15_field_limits_02.png' ) ); ?>" style="margin:10px 0;width:98%;" />
			</div>

			<div class="wpbc_wn_col" style="flex: 1 1 100%;margin: 0;">
				<ul>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Right sidebar inspector**: Easily edit field and section settings in a clear visual interface.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Field usage limits**: The Builder automatically prevents adding one-time fields, such as the Calendar field, more than once.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Responsive-friendly column width control** with layout protection for more stable form structure.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Improved visual editing controls** for easier field, section, and layout management directly inside the canvas.' ) ); ?></li>
				</ul>
			</div>
		</div>


		<div class="wpbc_wn_section">
			<h2><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( 'Better Form Management and Reuse' ) ); ?></h2>

			<div class="wpbc_wn_col" style="flex: 1 1 100%;margin: 0;">
				<?php // phpcs:ignore PluginCheck.CodeAnalysis.ImageFunctions.NonEnqueuedImage ?>
				<img src="<?php echo esc_attr( $obj->section_img_url( '10.15/wpbc_11_0_form_management_01.png' ) ); ?>" style="margin:10px 0;width:98%;" />
			</div>

			<div class="wpbc_wn_col" style="flex: 1 1 100%;margin: 0;">
				<ul>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Predefined templates:** Start building your new booking form with ready-made templates.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Save and restore complete form layouts** including pages, sections, columns, and fields.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Duplicate existing form configurations** to create similar forms much faster.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Save As workflow**: Create a new form based on an existing layout and settings.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Flexible form configuration management** for creating, saving, loading, organizing, and previewing custom forms.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Form details management**: Set a custom form title, slug, description, and image.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Media library integration** for selecting a custom image for each form configuration.' ) ); ?></li>
				</ul>
			</div>
		</div>


		<div class="wpbc_wn_section">
			<h2><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( 'Preview, Import, and Flexible Workflow' ) ); ?></h2>

			<div class="wpbc_wn_col" style="flex: 1 1 48%;margin: 0 1% 0 0;">
				<?php // phpcs:ignore PluginCheck.CodeAnalysis.ImageFunctions.NonEnqueuedImage ?>
				<img src="<?php echo esc_attr( $obj->section_img_url( '10.15/wpbc_11_0_preview_page_01.png' ) ); ?>" style="margin:10px 0;width:98%;" />
			</div>

			<div class="wpbc_wn_col" style="flex: 1 1 48%;margin: 0 0 0 1%;">
				<?php // phpcs:ignore PluginCheck.CodeAnalysis.ImageFunctions.NonEnqueuedImage ?>
				<img src="<?php echo esc_attr( $obj->section_img_url( '10.15/wp_booking_calendar_10_15_advanced_mode.png' ) ); ?>" style="margin:10px 0;width:98%;" />
			</div>

			<div class="wpbc_wn_col" style="flex: 1 1 100%;margin: 0;">
				<ul>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Preview page / live front-end preview**: Test how the form looks and works before publishing it on your website.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Import existing legacy booking forms** into the new Builder for easier transition to the visual workflow.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Builder mode and Advanced Form mode**: Work visually or keep manual form configuration when needed.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Blank form creation in Builder mode** lets you start new forms immediately in the visual editor.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Section presets** help you insert commonly used layout structures faster.' ) ); ?></li>
				</ul>
			</div>
		</div>


		<div class="wpbc_wn_section">
			<h2><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( 'Important Note About the Beta Builder' ) ); ?></h2>

			<div class="wpbc_wn_col" style="flex: 1 1 100%;margin: 0;">
				<ul>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **This feature is currently in Beta** and can still be disabled at any time.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; To return to the previous legacy booking form configuration, go to **Form Builder > Settings** in the right sidebar and disable the **"Drag & Drop Form Builder"** option.' ) ); ?></li>
				</ul>
			</div>
		</div>

	</div>
	<?php

	$obj->expand_section_end( $section_param_arr );
}

function wpbc_welcome_section_10_14( $obj ){

	$section_param_arr = array( 'version_num' => '10.14', 'show_expand' => true );

	$obj->expand_section_start( $section_param_arr );


	//   $obj->asset_path = 'http://beta/assets/';	// TODO: 2024-06-01 comment this


	// <editor-fold     defaultstate="collapsed"                        desc=" = F R E E = "  >
	// -----------------------------------------------------------------------------------------------------------------
	//  = F R E E =
	// -----------------------------------------------------------------------------------------------------------------
	?>
	<div class="wpbc_wn_container">
		<div class="wpbc_wn_section">
			<h2><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( 'Control start and end dates for booking and availability' ) ); ?></h2>
			<div class="wpbc_wn_col" style="flex: 1 1 100%;margin: 0;">
				 <?php // phpcs:ignore PluginCheck.CodeAnalysis.ImageFunctions.NonEnqueuedImage ?>
				<img src="<?php echo esc_attr( $obj->section_img_url( '10.14/wp_booking_calendar_elementor_advanced_01.png' ) ); ?>" style="margin:10px 0;width:98%;" />
				<span><span style="font-size: 0.9em;font-style: italic;"><?php //echo wp_kses_post( wpbc_replace_to_strong_symbols( 'Available in the  Booking Calendar Business Small or higher versions' ) ); ?></span></span>
			</div>
			<div class="wpbc_wn_col" style="flex: 1 1 100%;margin: 0;">
				<ul>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Control which dates are shown!**: You can now control which dates are shown in the Booking Calendar by using two new shortcode parameters: **[booking resource_id=1 calendar_dates_start=\'2025-01-01\' calendar_dates_end=\'2025-12-31\']**' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **New**:  Ability to **set the start and end dates for the calendar** using shortcode parameters. Example: [booking resource_id=1 calendar_dates_start=\'2025-01-01\' calendar_dates_end=\'2025-12-31\' startmonth=\'2025-3\']' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **New**:  If startmonth is omitted, the calendar will now automatically use the month from calendar_dates_start as the initial display month.  Example: [booking resource_id=1 calendar_dates_start=\'2025-01-01\' calendar_dates_end=\'2025-12-31\']' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **New**:  New: You can now **allow users to submit bookings for past dates**, as long as those dates are within the visible range set by calendar_dates_start and calendar_dates_end in the shortcode. Useful for administrative or backdated bookings. Shortcode Example: [booking resource_id=1 calendar_dates_start=\'2025-01-01\' calendar_dates_end=\'2025-12-31\']' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **New**:  Elementor native supports of these parameters calendar_dates_start=\'2025-01-01\' calendar_dates_end=\'2025-12-31\' in Advanced section.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Improvement**: When calendar_dates_start and calendar_dates_end are defined in the shortcode, the system skips checking availability from today, and instead starts from the defined calendar_dates_start.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Improvement**: To **enable the new Smart Phone Validation** feature introduced in the previous update, go to: WP Booking Calendar > Settings > Booking Form > Form Options and enable the "Smart Phone Validation" option. It is disabled by default.' ) ); ?></li>
				</ul>
			</div>
		</div>
	</div>
	<?php

	$obj->expand_section_end( $section_param_arr );
}

function wpbc_welcome_section_10_13( $obj ){

	$section_param_arr = array( 'version_num' => '10.13', 'show_expand' => true );

	$obj->expand_section_start( $section_param_arr );


	//   $obj->asset_path = 'http://beta/assets/';	// TODO: 2024-06-01 comment this


	// <editor-fold     defaultstate="collapsed"                        desc=" = F R E E = "  >
	// -----------------------------------------------------------------------------------------------------------------
	//  = F R E E =
	// -----------------------------------------------------------------------------------------------------------------
	?>
	<div class="wpbc_wn_container">
		<div class="wpbc_wn_section">
			<h2><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( 'Smarter Bookings, Elementor Integration and Cleaner Interface' ) ); ?></h2>
			<div class="wpbc_wn_col" style="flex: 1 1 100%;margin: 0;">
				<h3><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '**Booking Calendar meets Elementor!**' ) ); ?></h3>
				 <?php // phpcs:ignore PluginCheck.CodeAnalysis.ImageFunctions.NonEnqueuedImage ?>
				<img src="<?php echo esc_attr( $obj->section_img_url( '10.13/wp_booking_calendar_elementor_01.png' ) ); ?>" style="margin:10px 0;width:98%;" />
				<span><span style="font-size: 0.9em;font-style: italic;"><?php //echo wp_kses_post( wpbc_replace_to_strong_symbols( 'Available in the  Booking Calendar Business Small or higher versions' ) ); ?></span></span>
			</div>
			<div class="wpbc_wn_col" style="flex: 1 1 100%;margin: 0;">
				<ul>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Full Elementor Support!**: Design and customize your booking forms directly inside the Elementor editor—with real-time form previews and a built-in skin selector. No more shortcode guesswork—just drag, configure, and save!' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Calendar Preloader:** We’ve added a smooth-loading preloader bar that prevents layout jumps on slower connections, ensuring a polished experience for your visitors.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **New Booking Form Template – Service Selection Wizard (Pro):** Perfect for appointment-based bookings: this template features a left-side service selector with a streamlined date/time step for faster, easier bookings.' ) ); ?></li>
				</ul>
			</div>
		</div>
		<hr class="wpbc_hr_dots"><?php // ---------------------------------------------------------------------- ?>
		<div class="wpbc_wn_section">
			<div class="wpbc_wn_col" style="flex: 1 1 45%;margin: 10px 0;">
				<h3><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '**Cleaner & More Intuitive Interface**' ) ); ?></h3>
				<ul>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Updated Sidebar Navigation:** All plugin menus now live in a single, collapsible sidebar—easier to navigate and quicker to access.' ) ); ?></li>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Visual Polish & UX Tweaks:** We’ve made subtle design upgrades across the board: improved calendar styling, better visual hierarchy, smarter warnings (e.g., duplicate calendar IDs), and more compact menu visuals in compact mode.' ) ); ?></li>
				</ul>
			</div>
			<div class="wpbc_wn_col" style="flex: 1 1 50%;margin: 0px 0;">
				 <?php // phpcs:ignore PluginCheck.CodeAnalysis.ImageFunctions.NonEnqueuedImage ?>
				<img src="<?php echo esc_attr( $obj->section_img_url( '10.13/vertical_menu_01.png' ) ); ?>" style="margin:10px 0;width:98%;" />
				<span><span style="font-size: 0.9em;font-style: italic;"><?php //echo wp_kses_post( wpbc_replace_to_strong_symbols( 'Available in the  Booking Calendar Business Small or higher versions' ) ); ?></span></span>
			</div>
		</div>
		<hr class="wpbc_hr_dots"><?php // ---------------------------------------------------------------------- ?>
		<div class="wpbc_wn_section">
			<div class="wpbc_wn_col" style="flex: 1 1 45%;margin: 10px 0;">
				<h3><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '**Smart Phone Validation**' ) ); ?></h3>
				<ul>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull; **Auto-Detect & Format Phone Fields:** Phone fields now automatically detect and format numbers based on the user’s input and locale. Start typing +1 and the field instantly formats to +1 000 000 0000 (USA); type +34 for Spain and get +34 000 000 0000.' ) ); ?></li>
				</ul>
			</div>
			<div class="wpbc_wn_col" style="flex: 1 1 50%;margin: 0px 0;">
				 <?php // phpcs:ignore PluginCheck.CodeAnalysis.ImageFunctions.NonEnqueuedImage ?>
				<img src="<?php echo esc_attr( $obj->section_img_url( '10.13/phone_validattion_01.png' ) ); ?>" style="margin:10px auto;max-width:600px;" />
			</div>
			<div class="wpbc_wn_col" style="flex: 1 1 100%;margin: 0;">
				<ul>
					<li><?php echo wp_kses_post( wpbc_replace_to_strong_symbols( '&bull;  **Built-In Intelligence – No Setup Required** We intelligently detect phone fields by name (e.g., “phone”, “fone”, “tel”, “mobile”, “telefono”, etc.) and apply the right mask and placeholder automatically—no third-party APIs needed. Only valid digits are allowed; unsupported characters are blocked instantly.' ) ); ?></li>
				</ul>
			</div>
		</div>

	</div>
	<?php

	$obj->expand_section_end( $section_param_arr );
}
