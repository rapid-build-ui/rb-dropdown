/**************
 * RB-DROPDOWN
 **************/
import { props, html, RbBase } from '../../rb-base/scripts/rb-base.js';
import Type from '../../rb-base/scripts/type-service.js';
import '../../rb-input/scripts/rb-input.js';
import template from '../views/rb-dropdown.html';

export class RbDropdown extends RbBase() {
	/* Properties
	 *************/
	static get props() {
		return {
			...super.props,
			horizontal: props.boolean,
			inline: props.boolean,
			label: props.string, // dropdown label
			labelKey: props.string, // option label
			right: props.boolean,
			subtext: props.string,
			disabled: props.boolean,
			validation: props.string,
			data: Object.assign({}, props.array, {
				deserialize(val) { // :array
					if (Type.is.array(val)) return val;
					if (!Type.is.string(val)) return val;
					val = val.trim();
					if (/^\[[^]*\]$/.test(val)) return JSON.parse(val);
					return val;
				}
			}),
			value: Object.assign({}, props.any, {
				deserialize(val) { // :boolean | string | object
					val = Type.is.string(val) ? val.trim() : val;
					let newVal;
					switch (true) {
						case /^(?:true|false)$/i.test(val): // boolean
							newVal = /^true$/i.test(val);
							break;
						case /^{[^]*}$/.test(val): // object
							newVal = JSON.parse(val);
							break;
						default:  // string
							newVal = val;
					}
					return newVal;
				}
			})
		};
	}

	/* Template
	 ***********/
	render({ props }) { // :string
		return html template;
	}
}

customElements.define('rb-dropdown', RbDropdown);
