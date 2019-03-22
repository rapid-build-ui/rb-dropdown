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
		const rbInput = this.shadowRoot.querySelector('rb-input');
		Object.assign(this.rb.formControl, {
			elm:      rbInput.rb.formControl.elm,
			focusElm: rbInput.rb.formControl.focusElm,
		});
		Object.assign(this.rb.elms, {
			rbInput,
			menu:    this.shadowRoot.querySelector('.menu'),
			list:    this.shadowRoot.querySelector('ol'),
			links:   this.shadowRoot.querySelectorAll('li'),
			// TODO: fix having to go into rb-input's shadow root
			input:   rbInput.shadowRoot.querySelector('input'),
			label:   rbInput.shadowRoot.querySelector('.label'),
			trigger: rbInput.shadowRoot.querySelector('.input-wrap')
		});
		rbInput.showErrorMessage = true;
		this.rb.events.add(this.rb.elms.trigger, 'click', this._toggleDropdown);
		this.rb.events.add(window, 'click touchstart', this._windowClickToggle, {
			capture: true // so event fires first
		});
		if(!!this.data && Type.is.object(this.data[0]))
			this._strData = this._stringifyDataObject(this.data)
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
			valueKey: props.string, // sublabels
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
	_getMatchOfValueFromData(data, value) { // :boolean
		let match = undefined;
		let regex = new RegExp(`^${value}$`, 'i')

		if (!data || !value)
			return match

		if (Type.is.object(this.data[0]) && !!this.valueKey) {
			for (const [key,item] of data.entries()) {
				match = item[this.valueKey].match(regex)
				if(!!match)	return {index: key, item: item};
			}
		}

		if (Type.is.object(value))
			regex = new RegExp(`^${JSON.stringify(value)}$`, 'i')

		if (Type.is.string(this.data[0]))
			for (const [key,item] of data.entries()) {
				match = item.match(regex)
				if(!!match) return {index: key, item: item};
			}

		regex = new RegExp(`^${JSON.stringify(value)}`, 'i')
		for (const [key,item] of data.entries()) {
			match = JSON.stringify(item).match(regex)
			if(!!match) return {index: key, item: item};
		}
		return {index: -1, item: null}
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
		return this.value !== value;
	}

	dataChanged(data) { // :boolean
		JSON.stringify(this.data) !== JSON.stringify(data);
	}

	async setValue(value, oninit = false) { // :void
		const valueChanged = this.valueChanged(value);
		if (!oninit) this.rb.elms.input.focus();
		if (!valueChanged && !oninit) return;
		this.value = (!!this.valueKey && Type.is.object(this.data[0])) ? value[this.valueKey] : value;
		if (oninit) this._setInputValue(value);
		await this.validate();
	}

	_setInputToReadonly() { // :void (to prevent using rb-input's readonly styles)
		const { input } = this.rb.elms;
		input.readOnly = true;
		input.style.cursor       = 'pointer';
		input.style.overflow     = 'hidden';
		input.style.whiteSpace   = 'nowrap';
		input.style.textOverflow = 'ellipsis';
	}

	_setInputValue(value) { // :void
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

	_getInitialValue(value) { // :string
		const match = this._getMatchOfValueFromData(this.data, value)
		if (!match)
			return '';
		switch(true) {
			case !!this.valueKey.length && Type.is.object(this.data[0]):
				this.value = match.item[this.valueKey];
				return match.item[this.valueKey];
			case Type.is.object(match.item):
				return JSON.stringify(match.item);
			default:
				return 	match.item;
		}
	}

	_selectNext(evt) {
		let match = this._getMatchOfValueFromData(this.data, this.value)
		let index = !match ? 0 : match.index + 1;
		if (this._indexIsOutOfDataRange(index)) return;
		this.setValue(this.data[index])
	}

	_selectPrevious(evt) {
		let match = this._getMatchOfValueFromData(this.data, this.value)
		if (!match) return undefined;
		let index = match.index - 1;
		if (index < 0 && this.hasAttribute('placeholder')) {
			this.setValue(null)
			return
		}
		if (this._indexIsOutOfDataRange(index)) return;
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
		if (!nextLi) return;
		nextLi.focus();
	}

	_focusPrevious(evt) {
		let focusedLi = evt.composedPath()[0];
		const liToSetFocus = focusedLi.previousElementSibling
		if (!liToSetFocus) return;
		liToSetFocus.focus();
	}

	_hasRepeatedLetters(str) {
		const patt = /^([a-z])\1+$/;
		return patt.test(str);
	}

	_preSearch(key) {
		if (this.searchString === undefined)
			this.searchString = '';

		this.searchString += key;

		this._doSearch(this.searchString)
		clearTimeout(this.timeout)


		this.timeout = setTimeout(() => {
			this._postSearch(true)
		}, 700);

	}

	_searchByOneLetter(char, data) {
		let regex = new RegExp('^' + char, 'i'); //match string from the beginning and ignore case
		const match = this._getMatchOfValueFromData(data, this.value);
		const nextElementMatch = this._getMatchOfValueFromData(data, data[match.index + 1]);
		let indexOfMatchedItem = undefined;

		if (!regex.test(nextElementMatch.item))	{ // go to beginning if next item didn't match char
			const match = this.data.find((item, index) =>{
				indexOfMatchedItem = index //we need index to preselect when dropdown is not open.
				return regex.test(item)
			})

			if(!match) return;
			return this.setValue(this.data[indexOfMatchedItem])
		}

		if (!this.state.showDropdown){ // closed dropdown
			if (regex.test(match.item)) {
				this.setValue(data[match.index + 1])
			}
		}

	}

	_doSearch(searchString) {
		let regex = new RegExp('^' + searchString, 'i'); //match string from the beginning and ignore case
		let _data = [];
		let indexOfMatchedItem = undefined;
		if (!!this.labelKey) _data = this._getDataForLabelKey();
		if ((!this.labelKey || !this.valueKey) && Type.is.object(this.data[0])) {
			_data = this._strData
			regex = new RegExp(searchString, 'i'); //match string and ignore case
		}
		if (Type.is.string(this.data[0])) _data = this.data

		if (!!this.value && ((this.searchString.length == 1	&&
				this.value.charAt(0).toLowerCase() === this.searchString.charAt(0).toLowerCase()
			) || this._hasRepeatedLetters(this.searchString)))
			return this._searchByOneLetter(this.searchString.charAt(0), _data);

		const match = _data.find((item, index) =>{
			indexOfMatchedItem = index //we need index to preselect when dropdown is not open.
			return regex.test(item)
		})

		if (!match) return;

		if (!this.state.showDropdown)
			return this.setValue(this.data[indexOfMatchedItem])

		let linkToFocus = this._findLinkBasedOnValue(match);
		if(!linkToFocus) return;
		linkToFocus.focus();
		this._scrollToFocused(linkToFocus);
	}

	_postSearch(clear) {
		if (!clear) return
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
		if (!!prevProps.data && !this.dataChanged(prevProps.data)) { // if data updated we need update necessary itmes from viewReady
			this.rb.elms.links = this.shadowRoot.querySelectorAll('li');
			if(Type.is.object(this.data[0])) this._strData = this._stringifyDataObject(this.data)
		}

		if (this.valueChanged(prevProps.value))
			this.rb.events.emit(this, 'value-changed', {detail: { value: this.value }});
	}

	/* Event Handlers
	 *****************/
	_onkeydown(value, evt) { // :void
		if (evt === undefined) evt = value; //when nothing is selected evt gets populated in value.
		let keyAction = this.getKeyAction(evt)
		if (keyAction.tab && !this.state.showDropdown) return; //do not prevent when tabbing between elements
		evt.preventDefault();
		if (keyAction.search) return this._preSearch(evt.key)
		if (keyAction.down && !this.state.showDropdown) return this._selectNext(evt);
		if (keyAction.down && this.state.showDropdown) return this._focusNext(evt);
		if (keyAction.up && !this.state.showDropdown) return this._selectPrevious(evt);
		if (keyAction.up && this.state.showDropdown) return this._focusPrevious(evt);
		if (keyAction.close) return this._closeDropdown();
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
		if (!this.state.showDropdown) return;
		const labelStyle = this.rb.elms.label.currentStyle || window.getComputedStyle(this.rb.elms.label);
		const inputHeightWithOutSubtext = this.rb.elms.label.offsetHeight + this.rb.elms.trigger.offsetHeight + parseInt(labelStyle.marginBottom);
		this.rb.elms.menu.style.top = (inputHeightWithOutSubtext - this.rb.elms.rbInput.offsetHeight) + 'px'
	}

	_setActive(item) {
		switch(true) {
			case !!this.valueKey && Type.is.object(item):
				return item[this.valueKey] === this.value

			case Type.is.string(item):
				return item === this.value;

			default:
				return false;
		}
	}

	_findLinkBasedOnValue(value) {
		const regex = new RegExp('^' + value, 'i'); //match string from the beginning and ignore case
		const linkArr = [...this.rb.elms.links]; //converts nodeList to an array
		const matchedLink = linkArr.find((item) =>{
			return (regex.test(item.innerText))
		})

		// const matchedLink = linkArr.find(link => link.innerText.indexOf(value) > -1);
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
