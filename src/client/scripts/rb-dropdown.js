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
		this.version = '0.0.3';
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
		this._setInitialKeysAndData()
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
	_getMatchOfValueFromData(value) { // : {index, matched item}
		let match = undefined;
		if (!value) return match;
		let _value = Type.is.object(value) ? !!this._key ? value[this._key] : JSON.stringify(value) : value;
		_value = this._escapeRegExp(_value);

		const regex = new RegExp(`^${_value}`, 'i');

		for (const [key,item] of this.data.entries()) {
			if(!this._key && JSON.stringify(item) === _value) return {index: key, item: this.data[key]};
			match = (Type.is.object(item) && !!this._key) ?	regex.test(item[this._key])	: regex.test(item)
			if (!!match) return {index: key, item: this.data[key]};
		}

		return {index: -1, item: null}
	}

	/* Helpers
	 **********/
	_escapeRegExp(string) { // :string | :any (from MDN)
		if (!Type.is.string(string)) return string;
		return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means whole matched string
	}

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
		return JSON.stringify(this.data) !== JSON.stringify(data);
	}

	async setValue(value, oninit = false) { // :void
		const valueChanged = this.valueChanged(value);
		if (!oninit) this.rb.elms.input.focus();
		if (!valueChanged && !oninit) return;
		this.value = (!!this.valueKey && Type.is.object(this.data[0])) ? value[this.valueKey] : value;
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
	_setRbInputActiveStatus(activeFlg) {
		setTimeout(()=>{
			this.rb.elms.rbInput._active = activeFlg;
		})
	}

	_setInitialKeysAndData() {
		if (!this._searchKey) this._searchKey = !!this.labelKey ? this.labelKey : (!!this.valueKey ? this.valueKey : undefined)
		if (!this._key) this._key = !!this.valueKey ? this.valueKey : (!!this.labelKey ? this.labelKey : undefined)
		if (!this._searchData) this._searchData = this._getSearchData(this._searchKey)
	}

	_getInitialValue(value) { // :string
		const match = this._getMatchOfValueFromData(value)
		if (!match)
			return '';

		const result = Type.is.object(match.item) ? (!!this.labelKey ? match.item[this.labelKey]
								: (!!this.valueKey ? match.item[this.valueKey]
												: JSON.stringify(match.item))) : match.item;

		if (!result) return '';

		return result;

	}

	_selectNext(evt) {
		let match = this._getMatchOfValueFromData(this.value)
		let index = !match ? 0 : match.index + 1;
		if (this._indexIsOutOfDataRange(index)) return;
		this.setValue(this.data[index])
	}

	_selectPrevious(evt) {
		let match = this._getMatchOfValueFromData(this.value)
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
		const patt = /^([a-z])\1+$/i;
		str = str.slice(0, 2)
		return patt.test(str);
	}

	_preSearch(evt) {
		if (this.searchString === undefined)
			this.searchString = '';

		this.searchString += evt.key;

		this._doSearch(this.searchString, evt)
		clearTimeout(this.timeout)


		this.timeout = setTimeout(() => {
			this._postSearch(true)
		}, 450);

	}

	_searchByOneLetter(char, evt) {
		char = this._escapeRegExp(char);
		const regex = new RegExp(`^${char}`, 'i'); // match string from the beginning and ignore case
		const matchedItem = !!this.value ? this._getMatchOfValueFromData(this.value) : undefined;
		const nextElementMatch = !!matchedItem ? {index: matchedItem.index + 1, item: this.data[matchedItem.index + 1]} : undefined;
		const nextElementMatchLabel = !!nextElementMatch && Type.is.object(nextElementMatch.item) ?
			(!!this.labelKey ? nextElementMatch.item[this.labelKey] :
				!!this.valueKey ? nextElementMatch.item[this.valueKey]:
					!!nextElementMatch ? nextElementMatch.item : undefined) : (!nextElementMatch ? undefined : nextElementMatch.item)
		let indexOfMatchedItem = undefined;

		if (!this.state.showDropdown){ // closed dropdown
			if (!regex.test(nextElementMatchLabel))	{ // go to beginning if next item didn't match char
				const match = this._searchData.find((item, index) =>{
					indexOfMatchedItem = index // we need index to preselect when dropdown is not open.
					return regex.test(item)
				})

				if(!match) return;
				return this.setValue(this.data[indexOfMatchedItem])
			}
			return this.setValue(this.data[nextElementMatch.index])
		}

		// set Next element active
		let focusedLi = evt.composedPath()[0];
		const nextLi = focusedLi.nextElementSibling

		if (!nextLi || !regex.test(nextLi.innerText.trim()))	{ // go to beginning if next item didn't match char
			const match = this._searchData.find((item, index) =>{
				indexOfMatchedItem = index // we need index to preselect when dropdown is not open.
				return regex.test(item)
			})
			const linkForValue= this._findLinkBasedOnValue(match);
			if (!!linkForValue)
				return linkForValue.focus()

			return
		}
		nextLi.focus();
	}

	_doSearch(searchString, evt) {
		searchString = this._escapeRegExp(searchString);
		let regex = new RegExp(`^${searchString}`, 'i'); // match string from the beginning and ignore case
		let indexOfMatchedItem = undefined;
		if ((!this.labelKey && !this.valueKey) && Type.is.object(this.data[0]))
			regex = new RegExp(searchString, 'i'); // match string and ignore case

		const _label = Type.is.object(this.value) ? (!!this.labelKey ? this.value[this.labelKey]
																	: (!!this.valueKey ? this.value[this.valueKey] : this.value)) : this.value;
		if (this._hasRepeatedLetters(this.searchString) ||
				(Type.is.string(_label) &&
				(this.searchString.length == 1 && _label.charAt(0).toLowerCase() === this.searchString.charAt(0).toLowerCase()
			)))
			return this._searchByOneLetter(this.searchString.charAt(searchString.length-1), evt);

		const match = this._searchData.find((item, index) =>{
			indexOfMatchedItem = index // we need index to preselect when dropdown is not open.
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

	_getDataForKey(key) {
		const _data = [];
		for (const item of this.data)
			_data.push(item[key]);
		return _data;
	}

	_getSearchData(key=this._searchKey) {
		const _data = [];
		if (!this.data) return undefined;
		const dataIsObject = Type.is.object(this.data[0])

		if (!!key && dataIsObject) {
			for (const item of this.data)
				_data.push(item[key]);
			return _data;
		}
		if (dataIsObject) {
			for (const item of this.data)
				_data.push(JSON.stringify(item));
			return _data;
		}

		return this.data;
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
		if (this.dataChanged(prevProps.data)) this._searchData = null;
		if (prevProps._key !== this._key) this._key = null;
		if (prevProps._searchKey !== this._searchKey) this._searchKey = null;

		this._setInitialKeysAndData()
		if (!!prevProps.data && !this.dataChanged(prevProps.data)) { // if data updated we need update necessary itmes from viewReady
			this.rb.elms.links = this.shadowRoot.querySelectorAll('li');
		}

		if (this.valueChanged(prevProps.value))
			this.rb.events.emit(this, 'value-changed', {detail: { value: this.value }});
	}

	/* Event Handlers
	 *****************/
	_onkeydown(value, evt) { // :void
		if (evt === undefined) evt = value; // when nothing is selected evt gets populated in value.
		let keyAction = this.getKeyAction(evt)
		if (keyAction.tab && !this.state.showDropdown) return; // do not prevent when tabbing between elements
		evt.preventDefault();
		this._setRbInputActiveStatus(true)
		if (keyAction.search) return this._preSearch(evt)
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
		if (this.state.showDropdown) this._setRbInputActiveStatus(true)
	}

	_closeDropdown(evt) { // :void
		this.state.showDropdown = false;
		this.triggerUpdate();
	}

	_positionMenu() {
		if (!this.state.showDropdown) return;
		const { label, list, menu, rbInput, trigger } = this.rb.elms;

		const labelStyle = label.currentStyle || window.getComputedStyle(label);
		const listLiStyle = window.getComputedStyle(this.rb.elms.links[0])
		const allLiHeight = (parseInt(listLiStyle.lineHeight) + 2 * parseInt(listLiStyle.paddingTop)) * this.rb.elms.links.length
		const inputHeightWithOutSubtext = label.offsetHeight + trigger.offsetHeight + parseInt(labelStyle.marginBottom);
		menu.style.top = (inputHeightWithOutSubtext - rbInput.offsetHeight) + 'px'
		const rbInputViewPortPos = rbInput.getBoundingClientRect();
		const spaceBelowInput = window.innerHeight - rbInputViewPortPos.top;


		if (spaceBelowInput < rbInputViewPortPos.top) { // display menu on top
			const height = (rbInputViewPortPos.top - inputHeightWithOutSubtext - 5);
			menu.style.top = (height > allLiHeight) ? `${0 - rbInputViewPortPos.top + (height - allLiHeight)}px` : `${0 - rbInputViewPortPos.top}px`;

			list.style.height = (height > allLiHeight) ? `${allLiHeight}px` : `${height}px`;
			return;
		}
		list.style.height = ((spaceBelowInput - 100) > allLiHeight) ? `${allLiHeight}px` : `${spaceBelowInput - 100}px`;
	}

	_setActive(item) {
		if (!this.value) return undefined;
		let match = this._getMatchOfValueFromData(this.value);
		if (JSON.stringify(match.item) === JSON.stringify(item)){
			this.activeItem = item
			return true;
		}
	}

	_findLinkBasedOnValue(value) {
		value = this._escapeRegExp(value);
		const regex = new RegExp(`^${value}`, 'i'); // match string from the beginning and ignore case
		const linkArr = [...this.rb.elms.links]; // converts nodeList to an array
		const matchedLink = linkArr.find((item) =>{
			return (regex.test(item.innerText))
		})

		return matchedLink;
	}

	_scrollToActive() { // :void
		if (!this.state.showDropdown) return;
		setTimeout(()=>{
			const activeLinkArr = [...this.rb.elms.links]; // converts nodeList to an array
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
		this.rb.elms.input.blur();
	}

	/* Template
	 ***********/
	render({ props, state }) { // :string
		return html template;
	}
}

customElements.define('rb-dropdown', RbDropdown);
