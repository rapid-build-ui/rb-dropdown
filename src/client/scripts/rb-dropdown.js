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
		this.timout = null;
	}

	viewReady() { // :void
		super.viewReady && super.viewReady();
		this.validateValue();
		Object.assign(this.rb.elms, {
			focusElm:    this.shadowRoot.querySelector('.sublabel'),
			formControl: this.shadowRoot.querySelector('input'),
			menu:        this.shadowRoot.querySelector('.menu'),
			rbInput:     this.shadowRoot.querySelector('rb-input'),
			list:        this.shadowRoot.querySelector('ol'),
			links:       this.shadowRoot.querySelectorAll('li'),
			// TODO: fix having to go into rb-input's shadow root
			input:       this.shadowRoot.querySelector('rb-input').shadowRoot.querySelector('input'),
			label:       this.shadowRoot.querySelector('rb-input').shadowRoot.querySelector('.label'),
			trigger:     this.shadowRoot.querySelector('rb-input').shadowRoot.querySelector('.input-wrap')
		});
		this.rb.events.add(this.rb.elms.trigger, 'click', this._toggleDropdown);
		this.rb.events.add(window, 'click touchstart', this._windowClickToggle, {
			capture: true // so event fires first
		});
		this._setInputToReadonly();
		this._initSlotStates(); // see rb-base: private/mixins/slot.js
		this._updatePopoverSlot();
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
			placeholder: props.string,
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
	getKeyAction(evt) { // :string | void
		const matchWordRegex = /(4[8-9]|5[0-8]|6[5-9]|[7-8][0-9]|90)/g
		const evtKeyCode = evt.keyCode
		const isSearching = evt.keyCode.toString().match(matchWordRegex) != null

		if (!evtKeyCode) return;
		let keyAction = {
			alt: evtKeyCode === 18,
			enter: evtKeyCode === 13,
			escape: evtKeyCode === 27,
			space: evtKeyCode === 32,
			tab: evtKeyCode === 9,
			down: evtKeyCode === 40,
			up: evtKeyCode === 38,
			search: isSearching

		}

		keyAction.close = keyAction.escape || keyAction.tab;
		keyAction.toggle = keyAction.enter || keyAction.space || (keyAction.alt && (keyAction.up || keyAction.down))
		return keyAction;
	}

	valueChanged(value) { // :boolean
		const valueChanged = this.value !== value;
		return valueChanged;
	}

	async setValue(value) { // :void
		const valueChanged = this.valueChanged(value);
		this.rb.elms.input.focus();
		if (!valueChanged) return;
		this.value = value;
		this._setInputValue(value);
		await this.validate();
		if (this._valid) return; // todo: add method to validation mixin
		this.rb.elms.rbInput._eMsg = this._eMsg;
		this.rb.elms.rbInput.setDirty({
			blurred: true,
			dirty: true
		})
	}

	_setInputToReadonly() { // :void (to prevent using rb-input's readonly styles)
		const { input } = this.rb.elms;
		input.readOnly = true;
		input.style.cursor = 'pointer';
	}

	_setInputValue(value) {
		switch(true) {
			case Type.is.object(value) && !!this.labelKey.length:
				return this.rb.elms.rbInput.value = value[this.labelKey];

			case Type.is.object(value):
				return this.rb.elms.rbInput.value = JSON.stringify(value);

			case Type.is.null(value):
				return this.rb.elms.rbInput.value = '';

			default:
				this.rb.elms.rbInput.value = value;
		}
	}

	_selectNext(evt) {
		let index = this.data.indexOf(this.value) + 1;
		if(this._indexIsOutOfDataRange(index)) return;
		this.setValue(this.data[index])
	}

	_selectPrevious(evt) {
		let index = this.data.indexOf(this.value) - 1;
		if(index < 0 && this.hasAttribute('placeholder')) {
			this.setValue(null)
			return
		}
		if(this._indexIsOutOfDataRange(index)) return;
		this.setValue(this.data[index])
	}

	_focusNext(evt) {
		let focusedLi = evt.composedPath()[0];
		if (focusedLi.tagName == 'INPUT'){
			focusedLi =  this.rb.elms.links[0];
			focusedLi.focus();
			return
		}

		const nextLi = focusedLi.nextElementSibling
		if(!nextLi) return;
		nextLi.focus();
	}

	_focusPrevious(evt) {
		let focusedLi = evt.composedPath()[0];
		const liToSetFocus = focusedLi.previousElementSibling
		if(!liToSetFocus) return;
		liToSetFocus.focus();
	}

	_preSearch(key) {
		return new Promise((resolve, reject) => {
			if (this.searchString === undefined)
				this.searchString = '';

			this.searchString += key;

			if(this.timeout)
				return resolve(false);

			this.timeout = setTimeout(() => {
				this._doSearch(this.searchString)
				resolve(true);
			}, 500);
		});
	}

	_doSearch(searchString) {
		let regex = new RegExp('^' + searchString, 'i'); //match string from the beginning and ignore case
		let _data = [];
		let indexOfMatchedItem = undefined;
		if(!!this.labelKey) _data = this._getDataForLabelKey();
		if(!this.labelKey && (typeof this.data[0] == 'object')) {
			_data = this._stringifyDataObject()
			regex = new RegExp(searchString, 'i'); //match string and ignore case
		}
		if(!this.labelKey && (typeof this.data[0] == 'string')) _data = this.data

		const match = _data.find((item, index) =>{
			if (regex.test(item)) return indexOfMatchedItem = index //we need index to preselect when dropdown is not open.
		})
		if (!match) return;

		if(!this.state.showDropdown)
			return this.setValue(this.data[indexOfMatchedItem])

		let linkToFocus = this._findLinkBasedOnValue(match);
		linkToFocus.focus();
		this._scrollToFocused(linkToFocus);
	}

	_postSearch(clear) {
		if(!clear) return
		clearTimeout(this.timeout);
		this.timeout = null;
		this.searchString = '';
	}

	_getDataForLabelKey() {
		const _data = [];
		for (const item of this.data)
			_data.push(item[this.labelKey]);
		return _data;
	}

	_stringifyDataObject() {
		const _data = [];
		for (const item of this.data)
			_data.push(JSON.stringify(item));
		return _data;
	}

	_indexIsOutOfDataRange(index){
		return !(index in this.data)
	}

	_updatePopoverSlot() {
		if (this.state.slots.popover) return;
		this.rb.elms.rbInput.state.slots.popover = false;
		this.rb.elms.rbInput.triggerUpdate();
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
	_onkeydown(value, evt) { // :void
		if (evt === undefined) evt = value; //when nothing is selected evt gets populated in value.
		evt.preventDefault();
		let keyAction = this.getKeyAction(evt)
		if (keyAction.search) return this._preSearch(evt.key).then((clear) => {
			this._postSearch(clear)
		});
		if (keyAction.down && !this.state.showDropdown) return this._selectNext(evt);
		if (keyAction.down && this.state.showDropdown) return this._focusNext(evt);
		if (keyAction.up && !this.state.showDropdown) return this._selectPrevious(evt);
		if (keyAction.up && this.state.showDropdown) return this._focusPrevious(evt);
		if (keyAction.escape) return this._closeDropdown();
		if (keyAction.toggle) return this._ontoggle(value, evt);

	}

	_onclick(value, evt) { // :void
		this.setValue(value);
		this._toggleDropdown(evt);
	}

	_ontoggle(value, evt) { // :void
		if (!this.state.showDropdown) return this._toggleDropdown();
		this.setValue(value);
		this._toggleDropdown(evt);
	}

	_toggleDropdown(evt) { // :void
		this.state.showDropdown = !this.state.showDropdown;
		this._positionMenu()
		this.triggerUpdate();
		this._scrollToActive(true);
	}

	_closeDropdown(evt) { // :void
		this.state.showDropdown = false;
		this.triggerUpdate();
	}

	_positionMenu() {
		if(!this.state.showDropdown) return;
		const labelStyle = this.rb.elms.label.currentStyle || window.getComputedStyle(this.rb.elms.label);
		const inputHeightWithOutSubtext = this.rb.elms.label.offsetHeight + this.rb.elms.trigger.offsetHeight + parseInt(labelStyle.marginBottom);
		this.rb.elms.menu.style.top = (inputHeightWithOutSubtext - this.rb.elms.rbInput.offsetHeight) + 'px'
	}

	_findLinkBasedOnValue(value) {
		const linkArr = [...this.rb.elms.links]; //converts nodeList to an array
		const matchedLink = linkArr.find(link => link.innerText.indexOf(value) > -1);
		return matchedLink;
	}

	_scrollToActive() { // :void
		if (!this.state.showDropdown) return;
		setTimeout(()=>{
			const activeLinkArr = [...this.rb.elms.links]; //converts nodeList to an array
			const activeLink = activeLinkArr.find(link => link.classList.contains('active'));
			if (!activeLink) return;
			activeLink.focus();
			this.rb.elms.list.scrollTop = activeLink.offsetTop; // (scroll past top border)
		})
	}

	_scrollToFocused(focusedLi) { // :void
		setTimeout(()=>{
			this.rb.elms.list.scrollTop = focusedLi.offsetTop; // (scroll past top border)
		})
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
