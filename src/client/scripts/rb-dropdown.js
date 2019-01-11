/**************
 * RB-DROPDOWN
 **************/
import { RbBase, props, html } from '../../rb-base/scripts/rb-base.js';
import FormControl             from '../../form-control/scripts/form-control.js';
import Type                    from '../../rb-base/scripts/public/services/type.js';
import template                from '../views/rb-dropdown.html';
import '../../rb-input/scripts/rb-input.js';
import '../../rb-popover/scripts/rb-popover.js';

export class RbDropdown extends FormControl(RbBase()) {
	/* Lifecycle
	 ************/
	constructor() {
		super();
		this.state = {
			...super.state,
			showDropdown: false
		};
	}

	viewReady() { // :void
		super.viewReady && super.viewReady();
		this.validateValue();
		Object.assign(this.rb.elms, {
			focusElm:    this.shadowRoot.querySelector('.sublabel'),
			formControl: this.shadowRoot.querySelector('input'),
			menu:        this.shadowRoot.querySelector('.menu'),
			rbInput:     this.shadowRoot.querySelector('rb-input'),
			// TODO: fix having to go into rb-input's shadow root
			input:       this.shadowRoot.querySelector('rb-input').shadowRoot.querySelector('input'),
			label:       this.shadowRoot.querySelector('rb-input').shadowRoot.querySelector('label'),
			trigger:     this.shadowRoot.querySelector('rb-input').shadowRoot.querySelector('.input-wrap')
		});
		this.rb.events.add(this.rb.elms.trigger, 'click', this._toggleDropdown);
		this.rb.events.add(window, 'click touchstart', this._windowClickToggle, {
			capture: true // so event fires first
		});
		this._initSlotStates(); // see rb-base: private/mixins/slot.js
	}

	/* Properties
	 *************/
	static get props() {
		return {
			...super.props,
			inline: props.boolean,
			label: props.string, // label
			labelKey: props.string, // sublabels
			right: props.boolean,
			subtext: props.string,
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

	/* Value Helpers
	 ****************/
	validateValue() { // :void
		if (!this.data.length || !this.value) return;

		switch (true) {
			case Type.is.string(this.data[0]):
				if (this.data.indexOf(this.value) == -1)
					this.value = undefined;
				break;
			case Type.is.object(this.data[0]):
				if (!this.objectArrayContains(this.data, this.value))
					this.value = undefined;
				break;
		}
	}
	objectArrayContains() { // :boolean
		let isMatch = false;
		for (const item of this.data) {
			if (JSON.stringify(this.value) === JSON.stringify(item)) {
				isMatch = true;
				break;
			};
		}
		return isMatch;
	}

	/* Helpers
	 **********/
	getKey(code) { // :string | void
		if (!code) return;
		return code.toLowerCase();
	}

	valueChanged(value) { // :boolean
		const valueChanged = this.value !== value;
		return valueChanged;
	}

	async setValue(value) { // :void
		const valueChanged = this.valueChanged(value);
		if (valueChanged) {
			this.value = value;
			this._setInputValue(value);
			this.rb.elms.input.focus();
			await this.validate();
			return;
		}

	}

	_setInputValue(value) {
		if (typeof value == 'object' && this.labelKey.length)
			return this.rb.elms.rbInput.value = value[this.labelKey];

		if (typeof value == 'object')
			return this.rb.elms.rbInput.value = JSON.stringify(value);

		this.rb.elms.rbInput.value = value;
	}

	/* Observer
	 ***********/
	updating(prevProps) { // :void
		if (prevProps.value === this.value) return;
		this.rb.events.emit(this, 'value-changed', {
			detail: { value: this.value }
		});
	}

	/* Event Handlers
	 *****************/
	_onclick(value, evt) { // :void
		console.log(evt);
		this.setValue(value);
		this._toggleDropdown(evt);
	}
	_onkeypress(value, evt) { // :void
		const keys = ['enter','space'];
		const key  = this.getKey(evt.code);
		if (keys.indexOf(key) === -1) return;
		evt.preventDefault(); // prevent space key from moving page down
		this.setValue(value);
		if (this.value === undefined) return;
		// evt.currentTarget = label
		evt.currentTarget.querySelector('input').checked = true;
	}
	_toggleDropdown(evt) { // :void
		this.state.showDropdown = !this.state.showDropdown;
		this.triggerUpdate();
	}
	_windowClickToggle(evt) { // :void
		if (!this.state.showDropdown) return;
		const path = evt.composedPath();
		if (path.includes(this.rb.elms.menu)) return;
		if (path.includes(this.rb.elms.input)) return;
		if (path.includes(this.rb.elms.label)) return;
		if (path.includes(this.rb.elms.trigger)) return;
		this._toggleDropdown(evt);
	}

	/* Template
	 ***********/
	render({ props, state }) { // :string
		return html template;
	}
}

customElements.define('rb-dropdown', RbDropdown);
