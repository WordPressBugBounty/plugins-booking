"use strict";

// ---------------------------------------------------------------------------------------------------------------------
// == File  /_out/builder-fields_schemas.js ==  Time point: 2025-08-21 17:39
// ---------------------------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------------------------
// Schema Registry for Field Options (start with 'text').
// ---------------------------------------------------------------------------------------------------------------------
window.WPBC_BFB_Field_Option_Schemas = {
  text: {
    title: 'Single Line Text',
    description: 'Basic text input options.',
    groups: [{
      label: 'General',
      fields: [{
        key: 'label',
        label: 'Label',
        type: 'text',
        placeholder: 'Your name',
        required: true,
        default: 'Text'
      }, {
        key: 'name',
        label: 'Field name',
        type: 'text',
        placeholder: 'first_name',
        tooltip: 'HTML name attribute. Must be unique in the form.',
        required: true
      }, {
        key: 'placeholder',
        label: 'Placeholder',
        type: 'text',
        placeholder: 'Enter text…'
      }, {
        key: 'help',
        label: 'Help text',
        type: 'textarea',
        placeholder: 'Shown below input in the form.'
      }, {
        key: 'required',
        label: 'Required',
        type: 'checkbox',
        default: false
      }]
    }, {
      label: 'Validation',
      fields: [{
        key: 'minlength',
        label: 'Min length',
        type: 'number',
        min: 0,
        step: 1
      }, {
        key: 'maxlength',
        label: 'Max length',
        type: 'number',
        min: 1,
        step: 1
      }, {
        key: 'pattern',
        label: 'Regex pattern',
        type: 'text',
        placeholder: '^[A-Za-z\\s]+$',
        tooltip: 'Leave empty to disable regex.'
      }]
    }, {
      label: 'Advanced',
      fields: [{
        key: 'id',
        label: 'Field ID (optional)',
        type: 'text',
        placeholder: 'input-text',
        tooltip: 'Optional HTML id attribute. Leave empty to omit.'
      }, {
        key: 'cssclass',
        label: 'CSS class',
        type: 'text',
        placeholder: 'wpbc-input big'
      }]
    }],
    // IMPORTANT: map UI "id" control to data key "html_id" so it is optional in markup.
    dataMap: {
      label: 'label',
      name: 'name',
      id: 'html_id',
      placeholder: 'placeholder',
      required: 'required',
      minlength: 'minlength',
      maxlength: 'maxlength',
      pattern: 'pattern',
      cssclass: 'cssclass',
      help: 'help'
    }
  }
};
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9idWlsZGVyLWZpZWxkc19zY2hlbWFzLmpzIiwibmFtZXMiOlsid2luZG93IiwiV1BCQ19CRkJfRmllbGRfT3B0aW9uX1NjaGVtYXMiLCJ0ZXh0IiwidGl0bGUiLCJkZXNjcmlwdGlvbiIsImdyb3VwcyIsImxhYmVsIiwiZmllbGRzIiwia2V5IiwidHlwZSIsInBsYWNlaG9sZGVyIiwicmVxdWlyZWQiLCJkZWZhdWx0IiwidG9vbHRpcCIsIm1pbiIsInN0ZXAiLCJkYXRhTWFwIiwibmFtZSIsImlkIiwibWlubGVuZ3RoIiwibWF4bGVuZ3RoIiwicGF0dGVybiIsImNzc2NsYXNzIiwiaGVscCJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL19zcmMvYnVpbGRlci1maWVsZHNfc2NoZW1hcy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLy8gPT0gRmlsZSAgL19vdXQvYnVpbGRlci1maWVsZHNfc2NoZW1hcy5qcyA9PSAgVGltZSBwb2ludDogMjAyNS0wOC0yMSAxNzozOVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vIFNjaGVtYSBSZWdpc3RyeSBmb3IgRmllbGQgT3B0aW9ucyAoc3RhcnQgd2l0aCAndGV4dCcpLlxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxud2luZG93LldQQkNfQkZCX0ZpZWxkX09wdGlvbl9TY2hlbWFzID0ge1xyXG5cdHRleHQ6IHtcclxuXHRcdHRpdGxlICAgICAgOiAnU2luZ2xlIExpbmUgVGV4dCcsXHJcblx0XHRkZXNjcmlwdGlvbjogJ0Jhc2ljIHRleHQgaW5wdXQgb3B0aW9ucy4nLFxyXG5cdFx0Z3JvdXBzICAgICA6IFtcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGxhYmVsIDogJ0dlbmVyYWwnLFxyXG5cdFx0XHRcdGZpZWxkczogW1xyXG5cdFx0XHRcdFx0eyBrZXkgICAgICAgICAgOiAnbGFiZWwnLFxyXG5cdFx0XHRcdFx0XHRsYWJlbCAgICAgIDogJ0xhYmVsJyxcclxuXHRcdFx0XHRcdFx0dHlwZSAgICAgICA6ICd0ZXh0JyxcclxuXHRcdFx0XHRcdFx0cGxhY2Vob2xkZXI6ICdZb3VyIG5hbWUnLFxyXG5cdFx0XHRcdFx0XHRyZXF1aXJlZCAgIDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0ZGVmYXVsdCAgICA6ICdUZXh0J1xyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0a2V5ICAgICAgICA6ICduYW1lJyxcclxuXHRcdFx0XHRcdFx0bGFiZWwgICAgICA6ICdGaWVsZCBuYW1lJyxcclxuXHRcdFx0XHRcdFx0dHlwZSAgICAgICA6ICd0ZXh0JyxcclxuXHRcdFx0XHRcdFx0cGxhY2Vob2xkZXI6ICdmaXJzdF9uYW1lJyxcclxuXHRcdFx0XHRcdFx0dG9vbHRpcCAgICA6ICdIVE1MIG5hbWUgYXR0cmlidXRlLiBNdXN0IGJlIHVuaXF1ZSBpbiB0aGUgZm9ybS4nLFxyXG5cdFx0XHRcdFx0XHRyZXF1aXJlZCAgIDogdHJ1ZVxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdHsga2V5OiAncGxhY2Vob2xkZXInLCBsYWJlbDogJ1BsYWNlaG9sZGVyJywgdHlwZTogJ3RleHQnLCBwbGFjZWhvbGRlcjogJ0VudGVyIHRleHTigKYnIH0sXHJcblx0XHRcdFx0XHR7IGtleSAgICAgICAgICA6ICdoZWxwJyxcclxuXHRcdFx0XHRcdFx0bGFiZWwgICAgICA6ICdIZWxwIHRleHQnLFxyXG5cdFx0XHRcdFx0XHR0eXBlICAgICAgIDogJ3RleHRhcmVhJyxcclxuXHRcdFx0XHRcdFx0cGxhY2Vob2xkZXI6ICdTaG93biBiZWxvdyBpbnB1dCBpbiB0aGUgZm9ybS4nXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0eyBrZXk6ICdyZXF1aXJlZCcsIGxhYmVsOiAnUmVxdWlyZWQnLCB0eXBlOiAnY2hlY2tib3gnLCBkZWZhdWx0OiBmYWxzZSB9XHJcblx0XHRcdFx0XVxyXG5cdFx0XHR9LFxyXG5cdFx0XHR7XHJcblx0XHRcdFx0bGFiZWwgOiAnVmFsaWRhdGlvbicsXHJcblx0XHRcdFx0ZmllbGRzOiBbXHJcblx0XHRcdFx0XHR7IGtleTogJ21pbmxlbmd0aCcsIGxhYmVsOiAnTWluIGxlbmd0aCcsIHR5cGU6ICdudW1iZXInLCBtaW46IDAsIHN0ZXA6IDEgfSxcclxuXHRcdFx0XHRcdHsga2V5OiAnbWF4bGVuZ3RoJywgbGFiZWw6ICdNYXggbGVuZ3RoJywgdHlwZTogJ251bWJlcicsIG1pbjogMSwgc3RlcDogMSB9LFxyXG5cdFx0XHRcdFx0eyBrZXkgICAgICAgICAgOiAncGF0dGVybicsXHJcblx0XHRcdFx0XHRcdGxhYmVsICAgICAgOiAnUmVnZXggcGF0dGVybicsXHJcblx0XHRcdFx0XHRcdHR5cGUgICAgICAgOiAndGV4dCcsXHJcblx0XHRcdFx0XHRcdHBsYWNlaG9sZGVyOiAnXltBLVphLXpcXFxcc10rJCcsXHJcblx0XHRcdFx0XHRcdHRvb2x0aXAgICAgOiAnTGVhdmUgZW1wdHkgdG8gZGlzYWJsZSByZWdleC4nXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XVxyXG5cdFx0XHR9LFxyXG5cdFx0XHR7XHJcblx0XHRcdFx0bGFiZWwgOiAnQWR2YW5jZWQnLFxyXG5cdFx0XHRcdGZpZWxkczogW1xyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRrZXkgICAgICAgIDogJ2lkJyxcclxuXHRcdFx0XHRcdFx0bGFiZWwgICAgICA6ICdGaWVsZCBJRCAob3B0aW9uYWwpJyxcclxuXHRcdFx0XHRcdFx0dHlwZSAgICAgICA6ICd0ZXh0JyxcclxuXHRcdFx0XHRcdFx0cGxhY2Vob2xkZXI6ICdpbnB1dC10ZXh0JyxcclxuXHRcdFx0XHRcdFx0dG9vbHRpcCAgICA6ICdPcHRpb25hbCBIVE1MIGlkIGF0dHJpYnV0ZS4gTGVhdmUgZW1wdHkgdG8gb21pdC4nXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0eyBrZXk6ICdjc3NjbGFzcycsIGxhYmVsOiAnQ1NTIGNsYXNzJywgdHlwZTogJ3RleHQnLCBwbGFjZWhvbGRlcjogJ3dwYmMtaW5wdXQgYmlnJyB9XHJcblx0XHRcdFx0XVxyXG5cdFx0XHR9XHJcblx0XHRdLFxyXG5cdFx0Ly8gSU1QT1JUQU5UOiBtYXAgVUkgXCJpZFwiIGNvbnRyb2wgdG8gZGF0YSBrZXkgXCJodG1sX2lkXCIgc28gaXQgaXMgb3B0aW9uYWwgaW4gbWFya3VwLlxyXG5cdFx0ZGF0YU1hcDoge1xyXG5cdFx0XHRsYWJlbCAgICAgIDogJ2xhYmVsJyxcclxuXHRcdFx0bmFtZSAgICAgICA6ICduYW1lJyxcclxuXHRcdFx0aWQgICAgICAgICA6ICdodG1sX2lkJyxcclxuXHRcdFx0cGxhY2Vob2xkZXI6ICdwbGFjZWhvbGRlcicsXHJcblx0XHRcdHJlcXVpcmVkICAgOiAncmVxdWlyZWQnLFxyXG5cdFx0XHRtaW5sZW5ndGggIDogJ21pbmxlbmd0aCcsXHJcblx0XHRcdG1heGxlbmd0aCAgOiAnbWF4bGVuZ3RoJyxcclxuXHRcdFx0cGF0dGVybiAgICA6ICdwYXR0ZXJuJyxcclxuXHRcdFx0Y3NzY2xhc3MgICA6ICdjc3NjbGFzcycsXHJcblx0XHRcdGhlbHAgICAgICAgOiAnaGVscCdcclxuXHRcdH1cclxuXHR9XHJcbn07XHJcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQUEsTUFBTSxDQUFDQyw2QkFBNkIsR0FBRztFQUN0Q0MsSUFBSSxFQUFFO0lBQ0xDLEtBQUssRUFBUSxrQkFBa0I7SUFDL0JDLFdBQVcsRUFBRSwyQkFBMkI7SUFDeENDLE1BQU0sRUFBTyxDQUNaO01BQ0NDLEtBQUssRUFBRyxTQUFTO01BQ2pCQyxNQUFNLEVBQUUsQ0FDUDtRQUFFQyxHQUFHLEVBQVksT0FBTztRQUN2QkYsS0FBSyxFQUFRLE9BQU87UUFDcEJHLElBQUksRUFBUyxNQUFNO1FBQ25CQyxXQUFXLEVBQUUsV0FBVztRQUN4QkMsUUFBUSxFQUFLLElBQUk7UUFDakJDLE9BQU8sRUFBTTtNQUNkLENBQUMsRUFDRDtRQUNDSixHQUFHLEVBQVUsTUFBTTtRQUNuQkYsS0FBSyxFQUFRLFlBQVk7UUFDekJHLElBQUksRUFBUyxNQUFNO1FBQ25CQyxXQUFXLEVBQUUsWUFBWTtRQUN6QkcsT0FBTyxFQUFNLGtEQUFrRDtRQUMvREYsUUFBUSxFQUFLO01BQ2QsQ0FBQyxFQUNEO1FBQUVILEdBQUcsRUFBRSxhQUFhO1FBQUVGLEtBQUssRUFBRSxhQUFhO1FBQUVHLElBQUksRUFBRSxNQUFNO1FBQUVDLFdBQVcsRUFBRTtNQUFjLENBQUMsRUFDdEY7UUFBRUYsR0FBRyxFQUFZLE1BQU07UUFDdEJGLEtBQUssRUFBUSxXQUFXO1FBQ3hCRyxJQUFJLEVBQVMsVUFBVTtRQUN2QkMsV0FBVyxFQUFFO01BQ2QsQ0FBQyxFQUNEO1FBQUVGLEdBQUcsRUFBRSxVQUFVO1FBQUVGLEtBQUssRUFBRSxVQUFVO1FBQUVHLElBQUksRUFBRSxVQUFVO1FBQUVHLE9BQU8sRUFBRTtNQUFNLENBQUM7SUFFMUUsQ0FBQyxFQUNEO01BQ0NOLEtBQUssRUFBRyxZQUFZO01BQ3BCQyxNQUFNLEVBQUUsQ0FDUDtRQUFFQyxHQUFHLEVBQUUsV0FBVztRQUFFRixLQUFLLEVBQUUsWUFBWTtRQUFFRyxJQUFJLEVBQUUsUUFBUTtRQUFFSyxHQUFHLEVBQUUsQ0FBQztRQUFFQyxJQUFJLEVBQUU7TUFBRSxDQUFDLEVBQzFFO1FBQUVQLEdBQUcsRUFBRSxXQUFXO1FBQUVGLEtBQUssRUFBRSxZQUFZO1FBQUVHLElBQUksRUFBRSxRQUFRO1FBQUVLLEdBQUcsRUFBRSxDQUFDO1FBQUVDLElBQUksRUFBRTtNQUFFLENBQUMsRUFDMUU7UUFBRVAsR0FBRyxFQUFZLFNBQVM7UUFDekJGLEtBQUssRUFBUSxlQUFlO1FBQzVCRyxJQUFJLEVBQVMsTUFBTTtRQUNuQkMsV0FBVyxFQUFFLGdCQUFnQjtRQUM3QkcsT0FBTyxFQUFNO01BQ2QsQ0FBQztJQUVILENBQUMsRUFDRDtNQUNDUCxLQUFLLEVBQUcsVUFBVTtNQUNsQkMsTUFBTSxFQUFFLENBQ1A7UUFDQ0MsR0FBRyxFQUFVLElBQUk7UUFDakJGLEtBQUssRUFBUSxxQkFBcUI7UUFDbENHLElBQUksRUFBUyxNQUFNO1FBQ25CQyxXQUFXLEVBQUUsWUFBWTtRQUN6QkcsT0FBTyxFQUFNO01BQ2QsQ0FBQyxFQUNEO1FBQUVMLEdBQUcsRUFBRSxVQUFVO1FBQUVGLEtBQUssRUFBRSxXQUFXO1FBQUVHLElBQUksRUFBRSxNQUFNO1FBQUVDLFdBQVcsRUFBRTtNQUFpQixDQUFDO0lBRXRGLENBQUMsQ0FDRDtJQUNEO0lBQ0FNLE9BQU8sRUFBRTtNQUNSVixLQUFLLEVBQVEsT0FBTztNQUNwQlcsSUFBSSxFQUFTLE1BQU07TUFDbkJDLEVBQUUsRUFBVyxTQUFTO01BQ3RCUixXQUFXLEVBQUUsYUFBYTtNQUMxQkMsUUFBUSxFQUFLLFVBQVU7TUFDdkJRLFNBQVMsRUFBSSxXQUFXO01BQ3hCQyxTQUFTLEVBQUksV0FBVztNQUN4QkMsT0FBTyxFQUFNLFNBQVM7TUFDdEJDLFFBQVEsRUFBSyxVQUFVO01BQ3ZCQyxJQUFJLEVBQVM7SUFDZDtFQUNEO0FBQ0QsQ0FBQyIsImlnbm9yZUxpc3QiOltdfQ==
