// ---------------------------------------------------------------------------------------------------------------------
// == File  /_out/builder-fields_schemas.js ==  Time point: 2025-08-21 17:39
// ---------------------------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------------------------
// Schema Registry for Field Options (start with 'text').
// ---------------------------------------------------------------------------------------------------------------------
window.WPBC_BFB_Field_Option_Schemas = {
	text: {
		title      : 'Single Line Text',
		description: 'Basic text input options.',
		groups     : [
			{
				label : 'General',
				fields: [
					{ key          : 'label',
						label      : 'Label',
						type       : 'text',
						placeholder: 'Your name',
						required   : true,
						default    : 'Text'
					},
					{
						key        : 'name',
						label      : 'Field name',
						type       : 'text',
						placeholder: 'first_name',
						tooltip    : 'HTML name attribute. Must be unique in the form.',
						required   : true
					},
					{ key: 'placeholder', label: 'Placeholder', type: 'text', placeholder: 'Enter text…' },
					{ key          : 'help',
						label      : 'Help text',
						type       : 'textarea',
						placeholder: 'Shown below input in the form.'
					},
					{ key: 'required', label: 'Required', type: 'checkbox', default: false }
				]
			},
			{
				label : 'Validation',
				fields: [
					{ key: 'minlength', label: 'Min length', type: 'number', min: 0, step: 1 },
					{ key: 'maxlength', label: 'Max length', type: 'number', min: 1, step: 1 },
					{ key          : 'pattern',
						label      : 'Regex pattern',
						type       : 'text',
						placeholder: '^[A-Za-z\\s]+$',
						tooltip    : 'Leave empty to disable regex.'
					}
				]
			},
			{
				label : 'Advanced',
				fields: [
					{
						key        : 'id',
						label      : 'Field ID (optional)',
						type       : 'text',
						placeholder: 'input-text',
						tooltip    : 'Optional HTML id attribute. Leave empty to omit.'
					},
					{ key: 'cssclass', label: 'CSS class', type: 'text', placeholder: 'wpbc-input big' }
				]
			}
		],
		// IMPORTANT: map UI "id" control to data key "html_id" so it is optional in markup.
		dataMap: {
			label      : 'label',
			name       : 'name',
			id         : 'html_id',
			placeholder: 'placeholder',
			required   : 'required',
			minlength  : 'minlength',
			maxlength  : 'maxlength',
			pattern    : 'pattern',
			cssclass   : 'cssclass',
			help       : 'help'
		}
	}
};
