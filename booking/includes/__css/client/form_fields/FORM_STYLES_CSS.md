# Booking Form Styles CSS workflow

This folder contains the editable CSS sources for Booking Form Builder form rendering.

## Source of truth

- Form Style preset tokens are defined in `booking/includes/_front_end/form-style-presets.php`.
- Field, checkbox/radio, focus, template container, and button CSS rules are defined in this folder.
- Builder canvas and Settings > Theme live previews must keep their token cleanup/apply lists synchronized with the PHP preset tokens.

## Runtime load order

Front-end styles are enqueued from `booking/core/wpbc-css.php` in this order:

1. `booking/css/client.css`
2. `booking/_dist/all/_out/wpbc_all_client.css`
3. `booking/css/calendar.css`
4. the selected calendar skin CSS

`client.css` is loaded directly and should keep only broad legacy layout/compatibility rules. Form Style visual rules should live in the Form Style sources and consume CSS variables.

## Generated files

The `_dist/all/_src/` and `_dist/all/_out/` files are generated bundles. Do not treat them as the source of truth. When a local beta environment reads `_dist/all/_out/wpbc_all_client.css` directly before a build is run, mirror only the minimal tested change there and keep the source files authoritative.

## Phase 13 Form Style token contract

The authoritative token list is returned by `wpbc_bfb_settings__get_form_style_css_var_names()` in `booking/includes/_front_end/form-style-presets.php`.

Container:

- `--wpbc-bfb-form-background`
- `--wpbc-bfb-form-border-color`
- `--wpbc-bfb-form-border-width`
- `--wpbc-bfb-form-border-radius`
- `--wpbc-bfb-form-padding`
- `--wpbc-bfb-form-box-shadow`

Text and validation:

- `--wpbc_form-label-color`
- `--wpbc_form-label-sublabel-color`
- `--wpbc_form-label-error-color`

Fields:

- `--wpbc_form-field-background-color`
- `--wpbc_form-field-menu-color`
- `--wpbc_form-field-text-color`
- `--wpbc_form-field-border-color`
- `--wpbc_form-field-border-color-spare`
- `--wpbc_form-field-focus-border-color`
- `--wpbc_form-field-focus-shadow-color`
- `--wpbc_form-field-disabled-color`

Checkbox and radio:

- `--wpbc_form-choice-checked-border-color`
- `--wpbc_form-choice-checked-color`
- `--wpbc_form-choice-focus-color`

Buttons:

- `--wpbc_form-button-background-color`
- `--wpbc_form-button-background-color-alt`
- `--wpbc_form-button-border-color`
- `--wpbc_form-button-text-color`
- `--wpbc_form-button-text-color-alt`
- `--wpbc_form-button-hover-background-color`
- `--wpbc_form-button-hover-border-color`
- `--wpbc_form-button-hover-text-color`
- `--wpbc_form-button-light-background-color`
- `--wpbc_form-button-light-border-color`
- `--wpbc_form-button-light-text-color`
- `--wpbc_form-button-light-box-shadow`
- `--wpbc_form-button-light-hover-background-color`
- `--wpbc_form-button-light-hover-border-color`
- `--wpbc_form-button-light-hover-text-color`
- `--wpbc_form-button-light-hover-box-shadow`
- `--wpbc_form-button-primary-hover-border-color`

Other form UI:

- `--wpbc_form-page-break-color`

## Phase 12 audit notes

Low-risk cleanup completed:

- `booking/css/client.css` legacy text-field border colors now use `--wpbc_form-field-border-color`.
- `booking/css/client.css` legacy text-field focus colors now use `--wpbc_form-field-focus-border-color` and `--wpbc_form-field-focus-shadow-color`.
- `booking/css/client.css` legacy checkbox/radio focus colors now use `--wpbc_form-choice-focus-color`.
- `booking/css/client.css` legacy dark-form text colors now use the label/field text tokens.
- `booking/css/client.css` disabled select option color now uses `--wpbc_form-field-disabled-color`.
- `booking/css/client.css` duplicated dark Form Style text/input color fallbacks now use the label/field text tokens.

Completed later in the button refactor phase:

- Legacy lightweight button and payment gateway button rules were moved out of `booking/css/client.css` during Phase 14-15.
- PayPal branded colors remain gateway-owned and are not normalized into generic Form Style colors.
- Stripe button padding, hover padding, and branded asset rules were preserved while moving color tokens.

Out of scope for Form Styles:

- Calendar skin files define calendar colors and should stay under the calendar skin model.
- Admin UI focus colors under `includes/__css/admin/settings/` are admin control styling, not front-end booking form styling.

## Phase 13 audit notes

Completed:

- Added `wpbc_bfb_settings__get_form_style_css_var_names()` as the PHP-owned token contract.
- Passed the token contract into Settings > Theme and Booking Form Builder localized JS data.
- Updated live preview cleanup/apply code to use the PHP-owned contract when available.
- Added `--wpbc_form-label-error-color` to all presets and Custom resolution.
- Added `--wpbc_form-field-disabled-color` to Custom resolution.
- Added the dark fallback error token in `form__templates.css`.

Validation:

- Every non-custom preset contains every token from the contract.
- Custom style resolution contains every token from the contract.

## Phase 14-15 button and gateway notes

Completed:

- `form__buttons.css` owns front-end lightweight buttons, submit buttons, Stripe buttons, and PayPal gateway button skins.
- `client.css` no longer owns the duplicated lightweight button, Stripe, PayPal, or dark Form Style button rules. It keeps only broad legacy layout, payment container, thank-you, and compatibility rules.
- Stripe buttons use the Form Style lightweight button tokens, while preserving the Stripe logo, `padding-right: 130px`, and hover padding.
- PayPal buttons remain branded gateway buttons. They intentionally keep PayPal yellow, blue, silver, white, and black colors instead of consuming the generic Form Style button colors.
- Dark Form Styles use `filter: brightness(1.2)` for lightweight button hover, with PayPal excluded from the filter so branded colors stay stable.

Validation:

- Keep Booking Calendar Commercial gateway asset URLs relative to the compiled `_dist/all/_out/` bundle when editing `form__buttons.css`, because this source is concatenated into the front-end bundle.
- If `_dist/all/_out/wpbc_all_client.css` is mirrored for local beta testing before a build, mirror only the button-source rules and keep `form__buttons.css` authoritative.

## Phase 16 contract-driven admin JS notes

Completed:

- Settings > Theme now receives `custom_form_style_defaults` from PHP, so Custom style preview defaults do not need an independent browser-side default contract.
- Booking Form Builder now receives `form_style_option_keys` from PHP, so stripping global/retired style keys from per-form JSON follows `wpbc_bfb_settings__get_form_json_style_option_keys()`.
- Settings > Theme and Builder live previews derive fallback CSS variable cleanup keys from localized Form Style presets plus the Custom resolver when `form_style_css_var_names` is unavailable.

Validation:

- PHP remains the source of truth for Form Style presets, custom defaults, CSS variable names, and per-form JSON style keys.
- `_out` admin scripts were mirrored only because they are the runtime-loaded files before the JS build is regenerated.

## Phase 17 visual QA notes

Completed:

- Generated a deterministic local QA fixture from the PHP Form Style preset registry and the runtime CSS stack.
- Checked predefined Form Style contrast for labels, fields, submit buttons, and lightweight buttons.
- Rechecked the runtime cascade for Stripe and PayPal gateway buttons, including Stripe hover padding and PayPal branded exceptions.
- Rechecked dark Form Style scoping so Booking Form Builder page controls and overlay controls are protected from front-end form text colors.

Validation:

- Browser rendering of the local fixture was blocked by the Codex browser security policy for both `file://` and local HTTP URLs, so this phase used static CSS cascade checks and computed token contrast checks instead of screenshots.
- No Form Style token contrast warnings were found in the predefined styles.
- Source CSS and mirrored runtime CSS passed brace-balance checks.

## Phase 18 release-readiness handoff

Completed:

- Removed temporary `.codex_tmp` Form Style QA fixture/export files created during Phase 17.
- Rechecked the Form Style token contract after cleanup.
- Rechecked CSS brace balance for the editable source files and the mirrored runtime bundle.

Handoff:

- Regenerate the official `_dist/all/_out/wpbc_all_client.css` bundle with the project build before release.
- Keep `form-style-presets.php` as the source of truth for preset colors/tokens.
- Keep `form__buttons.css`, `form__fields.css`, and `form__templates.css` as the source CSS for Form Style rendering.
- Do not ship local QA fixtures or ad hoc exported preset JSON files.

## Phase 23 legacy CSS cleanup review

Completed:

- Rechecked `booking/css/client.css` against the Form Style source files.
- Confirmed the old lightweight button, Stripe, PayPal, and dark Form Style button rules are no longer owned by `client.css`.
- Preserved remaining `client.css` form field, focus, dark text, payment, thank-you, and layout rules because they are broad legacy compatibility rules or tokenized fallbacks for older markup.

Decision:

- No additional `client.css` removals were made in this phase. Removing the remaining tokenized fallback rules would risk older booking form templates and payment/thank-you layouts.

## Phase 24-25 release note and final checklist

Completed:

- Added concise release notes for the global Booking Form Styles work.
- Rechecked that no local Form Style QA fixture/export files remain in `.codex_tmp`.
- Rechecked the Form Style token contract.
- Rechecked PHP syntax for the Form Style preset registry.
- Rechecked JavaScript syntax for Settings > Theme and Booking Form Builder settings/effects scripts.
- Rechecked CSS brace balance for `client.css`, Form Style source CSS, and the mirrored runtime bundle.

Remaining manual release checks:

- Run the official project build before release.
- Smoke-test Settings > Theme and Booking Form Builder in WordPress after the build.
- Smoke-test at least one front-end booking form with each predefined Form Style and the Custom style.

## Custom button colors

The Custom Form Style owns separate Primary and Secondary button palettes. Each palette defines background, text, border, and hover/focus/active equivalents. Primary colors apply to submit and primary buttons. Secondary colors apply to Previous, Next, lightweight, and Stripe buttons. PayPal buttons keep their branded colors.

The options are defined and sanitized by `wpbc_bfb_settings__get_default_custom_form_style_options()` and `wpbc_bfb_settings__get_custom_form_style_options()`. PHP rendering and both admin live previews resolve the options into the shared button tokens above.

Settings > Theme owns global Form Style selection and preview only. When Custom is selected, it links to the Forms Builder Appearance section for detailed editing. Its preview reads the saved Custom values from localized settings rather than duplicating the controls.
