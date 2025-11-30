/*
 * FormSaver 1.2, jQuery plugin for saving unsubmitted form content into the browser's localStorage.
 * (c) 2008-2025 https://github.com/utilmind
 */

/* TODO: (investigation needed) Possible bug (not sure but possible, research needed) is the forward slashes in values. TODO: test values with '/'.
   ------------------------------------
   Usage example:
       $myForm.on('restore', (e, storedDataTimestamp) => { // hook 'restore' before it will be triggered (immediately in the initFormSaver()).
               if ((5 < ((Date.now() - storedDataTimestamp) / 1000)) // if stored more than 5 seconds ago. (But remember, that it saves all values to store every time when you refresh or close the page.)
                       && window.alertify) {
                   // display toaster alert
                   alertify.success('Form content has been restored. If you would like to start filling everything from scratch, please click “Reset form” link above&nbsp;the&nbsp;form.', 10);
               }

           }).on('reset', e => {
               if (window.alertify) {
                   alertify.dismissAll(); // dismiss all toaster messages
               }

           }).initFormSaver({
               // Options. See the list of valid options below, in description of the initFormSaver()
           });

   HINT: If you would like to hook the value loaded in storage, specify the handler (function) in the data('load')

         Example: $field.data('load', function(storedValue) { return storedValue.toUpperCase(); });

         Example 2 (from some real project):
             $checkExactAddress.data('load', function(storedVal, urlParam) {
                 return (urlParam = getUrlParam('exact-address')) // We expect 'y' or 'n', if specified.
                             ? urlParam.toUpperCase()
                             : storedVal;
             });

    Known issues:
        1. (* This issue not related to the formSaver functionality, just a note to workaround.)
            When the input value is set up programmatically (e.g. when input restored by the formSaver), it is
            NOT VALIDATED using "maxlength" and "minlength" properties and can be submitted as-is w/o validation.

            Because the programmatically specified value is considered as correct a priori. "maxlength" and "minlength" require real user interaction.
            The workaround is to always use "pattern" property in addition to "maxlength" and/or "minlength".
            Example of properly set attributes:
                required pattern="^[A-Z][A-Z]?[0-9]{6,14}$" minlength="7" maxlength="16" /> -- require 1 or 2 uppercase alphanumeric characters, then the rest are from 6 to 14 digits.

            See also https://stackoverflow.com/questions/66896018/html-input-checkvalidity-always-returns-true-even-with-minlength-violations,
            which refers to https://stackoverflow.com/questions/10281962/is-there-a-minlength-validation-attribute-in-html/10294291#10294291

*/
(function(window, $, undefined) { // 'use strict';

    /* If you would like to remove items with some specific prefix (storagePrefix) ONE BY ONE, use following:

            Object.keys(localStorage).forEach(function(item) {
                if (item.slice(0, prefixLen) === storagePrefix) {
                    localStorage.removeItem(item);
                }
            });
     */

        // @config
    var defStorageKey = 'form',

        STR_STATUS_IS_LOADING = 'isLoadingStorage',
        classNoSave = '.no-save', // field with this class name will not be saved/restored. Used because we can't have unnamed "radio" groups.
                                 // And it's serve butter than "readonly" attribute. Sometimes we still want to save/restore even "readonly" fields.
        classNoReset = '.no-reset', // However if we reset entire form with native .reset() method, we can't exclude certain fields marked with .no-reset class.

        serveControls = 'input[name]:not([type="password"]):not([type="file"]):not([type="hidden"]):not([readonly]),textarea[name]:not([readonly]),select[name]', // also :not([type="button"]), but who is using <input type="button">'s nowadays?
        getServeControls = function(includePasswords, includeFiles) { // remove fields from exclusion list
            includePasswords = includePasswords
                                ? serveControls.replace(':not([type="password"])', '')
                                : serveControls; // don't skip passwords if we want to include password fields.
            if (includeFiles) {
                includePasswords = includePasswords.replace(':not([type="files"])', ''); // don't skip files if we want to include file fields.
            }
            return includePasswords;
        },

        typeaheadClass = 'tt-input', // twitter typeahead, which require to set value with typeahead('val', value) is natively supported here.

        // disabeld state saver
        saveDisabledStateClass = 'save-disabled-state',
        saveDisabledStatePrefix = 'd-',

        fieldUnloadFocus = 'fs-unload-field', // used to save a timestamp into SESSION storage. Set to FALSE to disable feature.
        fieldStoredDataTimestamp = '_fs_ts', // internal, for localStorage only. Not used in #address-line. Saves timestamp when the form content has been saved.
                                             // AK: I don't want to use *temporarily* session storage for this purpose. I can imagine situations when we really need to know when the form data was saved to the storage.

        // global function names
        nameSaveForm = 'saveForm',
        nameLoadForm = 'loadForm',
        nameClearStorageKeys = 'clearStorageKeys',
        nameRemoveStoredJsonKeys = 'removeStoredJsonKeys',
        // event triggered when the form content restored
        eventFormRestore = 'restore',

        // jQuery plugins
        initPluginFnName = 'initFormSaver',
        initUtilsFnName  = initPluginFnName + 'Utils', // bonus utilities

        ctlCheckAll = '.check-all',
        ctlResetFields = '.reset-fields', // we hooking onClick event of buttons to reset parts of the form. (ATTN! reset != clear. TODO: support .clear-fields.)
        tokenResetDataAttr = 'reset-block', // data-reset-block=".CLASSNAME" PR data-reset-block="#id". All fields in specified block will be reset.
                                            // ATTN! if you specify [#]id, it will be found in entire document. If this is [.]class, it will be found under the form.

        // @private
        llStorage = window.lStorage || localStorage, // safe storage or regular localStorage
        ssStorage = window.sStorage || sessionStorage,

        noWait,
        saveTimer,

        // each input and select fields with ID being saved into localStorage.
        // storageKey can be object with set of options with the same properties as regular argument names.
        saveForm = function($form,
                            storageKey, // or OPTIONS
                            keep1stHash, // keep the first #hash intact, store all values in address line after it.
                            noUseHash, // don't use #hasline in the browser address line
                            noUseStorage, // prepare and return #hashline only. Without overwriting the localStorage. -1 (or another negative value) = use sessionStorage instead of localStorage.
                            storePasswords) { // by default it does not store data from password fields. But this can be enabled.
            if (storageKey) {
                // if this is object -- split into components
                if (storageKey.storageKey) { // AK: it was named as 'storageName' in early versions! Please update legacy code!
                    keep1stHash = storageKey.keep1stHash;
                    noUseHash = storageKey.noUseHash;
                    noUseStorage = storageKey.noUseStorage;
                    storePasswords = storageKey.storePasswords;
                    storageKey = storageKey.storageKey;
                }
            }else {
                storageKey = defStorageKey;
            }

            var theStorage = 0 > noUseStorage ? ssStorage : llStorage, // use sessionStorage instead of localStorage in case of negative value in `noUseStorage`

                $form = $($form), // for sure

                doSave = function() {
                    if (noUseStorage || !$form.data(STR_STATUS_IS_LOADING)) { // not about to write OR not Loading right now...
                        var hash,
                            param = '',
                            store = {};

                        $form.find(getServeControls(storePasswords))
                             .not(classNoSave) // additional filter that applies to selected (served) controls
                                 .each(function() { // ATTN! "readonly" fields saved too. Set "no-save" class (see classNoSave) to avoid the field.
                            var el = this,
                                $el = $(el),
                                type = el.type,
                                name = el.name,
                                val = $el.val(), // The main difference between vanilla's .value and jQuery's .val() is that val() is able to retrieve arrays(). We don't want to parse arrays, jQuery is easier.
                                                 // TODO: we actually want to parse arrays to store them in native format (instead of string) into JSON.
                                storeFalseVal,
                                isDefaultChecked; // for checkboxes only

                            //if (name) { // unnamed fields not saved (UPD. We selecting only fields with name attribute)
                                // For radio we should check whether any value checked. If nothing checked -- let's remove item.
                                if ('radio' === type) {
                                    if (!el.checked) {
                                        // See, whether any radio box in group is checked. Unfortunately we should check it for each unchecked radio...
                                        if ($form.find('input[type="radio"][name="'+ name +'"]:checked').length) {
                                            return; // continue
                                        }
                                        // Nothing checked. Let's clear the value (and this will be performed multiple times... But okay...)
                                        val = null;
                                    }
                                }else if ('checkbox' === type) {
                                    isDefaultChecked = null !== el.getAttribute('checked'); // FYI: it returns empty string (false) even if "checkbox" attribute present. Only if it's NULL it's not there.
                                    val = el.checked
                                            ? (isDefaultChecked ? false : 1) // false = when checked field which already supposed to be checked by default (and it has 'checked' attribute). No need to store = FALSE.
                                            : ((storeFalseVal = isDefaultChecked) ? 0 : false); // not checked, but supposed to be checked by default -- save 0 (really unchecked). Otherwise no need to save = FALSE.
                                            // regular checkbox may have only 2 states: checked (1) and unchecked (). We saving state only for non-default values.
                                            // AK, IMPORTANT NOTES:
                                            //     1. If the rule above will be changed, test pro-pursuit categories.
                                            //     2. Think about adding some data-[attribute], which, if specified, will save any state, both 0 and 1.
                                            //        But it's shouldn't be default. In most (almost all) cases we just want to save state when it's checked or unchecked.

                                    /*  AK 13.01.2022: legacy. Attempt to store value of the checkbox. But we don't need it, since checkbox actually have 2 states. We don't need to know the value or save it.
                                        -----------------------------------------------------------------------------------------------------------------------------------------------------------------------

                                        var convertOn = 1; // 'on' values of checkboxes being stored as specified value. If false, 'on' not converted, stored as-is instead.
                                        if (!el.checked) {
                                            val = ''; // ATTN! It's very tricky moment. Checkbox value can be '0'. Actually even '', but '' will be considered as unchecked.
                                                      // ATTN2: Please DO NOT set unchecked value as NULL (so it will delete item from storage).
                                                      //        We can have default state as "checked". So "unchecked" state will never be saved.
                                        }else if (('on' === val) && convertOn) // AK: maybe this is odd :( But I don't like that default 'on'.
                                            val = convertOn;
                                    */
                                }

                                if (Array.isArray(val)) { // <select multiple>?
                                    val = JSON.stringify(val);
                                }

                                if (!noUseStorage && (val || storeFalseVal)) {
                                    store[name] = val;
                                }

                                // Don't check whether we need to update hash. Even if we don't, we have to RETURN full hash.
                                if (val || storeFalseVal) { // Remember, that 0 or '' can be valid values. But we don't want to save empty strings for all input fields.
                                    param+= '&' + name + '=' + encodeURIComponent(val);
                                }

                                if ($el.hasClass(saveDisabledStateClass)) {
                                    val = el.disabled ? 1 : 0;
                                    if (!noUseStorage) {
                                        theStorage.setItem(storageKey + saveDisabledStatePrefix + name, val);
                                    }
                                    if (val) { // Don't check whether we need to update hash. Even if we don't, we have to RETURN full hash.
                                        param+= '&' + saveDisabledStatePrefix + name + '=' + val;
                                    }
                                }
                            //}
                        });

                        // Leave hash prefix intact.
                        if (keep1stHash && (hash = location.hash)) {
                            var i = hash.indexOf('&'); // & is our delimiter between parameters of hashline. We must strip all content after first & (including it too).
                            if (-1 !== i) {
                                hash = hash.slice(0, i);
                            }
                            hash+= param;

                        }else { // no hash present yet. Create new. Okay to put it without prefix (coordinates?). Prefix (coordinates?) will be added later on first move/zoom action.
                            if (hash = param.slice(1)) {
                                hash = '#' + hash;
                            }
                        }

                        if (!noUseStorage) {
                            store[fieldStoredDataTimestamp] = Date.now();
                            theStorage.setItem(storageKey, JSON.stringify(store));
                        }

                        if (!noUseHash) {
                            history.replaceState(null, null,
                                location.origin + location.pathname + location.search + hash);
                        }

                        return hash; // return value are with #-prefix.
                    }
                };

            if (0 > noUseStorage) {
                noUseStorage = 0; // use it, but session, instead of permanent storage
            }
            // Don't let to save information more often than once per Nms. (AK: I don't remember why I did it, but okay.)
            if (noUseStorage) { // immediately prepare hash if we don't write anything to storage
                return doSave(); // returns #hashline
            }

            // if page is about to be closed or refreshed -- save it ASAP w/o any awaiting.
            if (noWait) {
                doSave();
                noWait = 0; // reset
            }else {
                clearTimeout(saveTimer);
                saveTimer = setTimeout(function() {
                    try {
                        doSave();
                    }catch(err){};
                }, 99);
            }
        },

        // CAUTION! We don't checking whether $form is exist and whether it's part of visible DOM. Take care about it outside. Use fresh $form pointer.
        //
        // loadForm returns the timestamp of last stored values "is something changed", if something loaded from storage into the form fields and some of the form fields are changed.
        //         ...or FALSE if nothing changed, or if there was no previously stored values.
        //     But this is not 100% accurate. Some controls may have pre-filled default values (eg date/time) fields in certain formats,
        //     so we detecting is something loaded when something filled over blank field. Or if some default state of checkbox/radio has changed.
        //     * The reason of this feature, as well as the .on('restore') event for the form is having a possibility to display some toaster message
        //       only when the form content was really restored. Message like 'Form content has been restored. Click 'Reset fields' button above to start filling from scratch'.
        //
        loadForm = function($form, storageKey,
                            keep1stHash,    // keep the first #hash intact, store all values in address line after it.
                            noUseHash,      // don't use #hashline in the browser address line
                            noUseStorage,   // prepare and return #hashline only. Without overwriting the localStorage. -1 (or another negative value) = use sessionStorage instead of localStorage.
                            storePasswords, // restorePassword in case of loading. By default it's FALSE, does NOT store/restore data into password fields. But this can be enabled.
                            onLoadStorage,  // Set up a handler function to get stored data (only from localStorage, not hash!) before it's restored
                                            //  ...and have a possibility to override loaded data or simply CANCEL loading if something else (e.g. URL parameters)
                                            //  require to not restore the form from the localStorage.
                                            //  This event handler should return original or modified data object OR FALSE/NULL/0/{} to cancel loading from storage and use form from scratch.

                            keyField) {     // the most important field which must be present in order to have data restored.
                                            // If it's not present in hash, but present in storage, we'll use storage and completely ignore #hash. (And vice versa, if it's present in #hash, we'll ignore storage.)
                                            // Also 'keyField' is ignored when user reloads the page (e.g. on F5 key press) when some auto-saved field is focused.
                                            // see more info below, in the description of the plugin options.
            if (storageKey) {
                // if this is object -- split into components
                if (storageKey.storageKey) {
                    keep1stHash = storageKey.keep1stHash;
                    noUseHash = storageKey.noUseHash;
                    noUseStorage = storageKey.noUseStorage;
                    storePasswords = storageKey.storePasswords;
                    onLoadStorage = storageKey.onLoadStorage;
                    keyField = storageKey.keyField;
                    // the last one...
                    storageKey = storageKey.storageKey;
                }

            }else {
                storageKey = defStorageKey;
            }

            var theStorage = 0 > noUseStorage ? ssStorage : llStorage; // use sessionStorage instead of localStorage in case of negative value in `noUseStorage`
            if (0 > noUseStorage) {
                noUseStorage = 0; // use it, but session, instead of permanent storage
            }

            var isSomethingLoaded = false, // returned value of this func
                isTypeaheadSupported = $form.typeahead,

                hashLine = noUseHash
                    ? '' // prevent using #hash
                    : location.hash.slice(1), // remove 1st character #
                storedData = (!noUseStorage && parseJSON(theStorage.getItem(storageKey))) || {}, // parseJSON from the "utilmind commons". We always need object (empty if data broken), not string.
                storedDataTimestamp,

                // escape special characters to use the string as-is in regular expression. Idea: https://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
                escapeRegExp = function(str) {
                    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
                },

                getHashComponent = function(componentName, /*var*/ m) {
                    return (hashLine && (m = hashLine.match('(&|^)' + escapeRegExp(componentName) + '=([^&$]+)')))
                        ? decodeURIComponent(m[2])
                        : null; // important to return NULL if value just omitted. We make difference between empty strings and omitted values (represented by NULL), where maybe some default value should be used.
                },

                loadStoredItem = function(name) {
                    return undefined === storedData[name] ? null : storedData[name]; // null = use default. However we don't have undefined values here theStorage.getItem() also returns null if no value and never undefined.
                },

                loadHashOrStorage = function(name /*var*/, rslt) {
                    // ATTN It's important to return NULL if value just omitted.
                    // We make difference between specified empty strings and NULLs, when maybe default value should be used.

                    // #hash is primary (if it's not page refresh)! Storage is secondary. Because we may reuse link with #hash.
                    rslt = noUseHash ? null : getHashComponent(name); // rslt is null if hash not used or value omitted.

                    if (null === rslt && !noUseStorage) {
                        // Use storage if hash omitted (not empty) AND it's allowed to get fallback value from storage
                        rslt = loadStoredItem(name);
                    }

                    return rslt;
                },

                checkKeyField = function(field) {
                    if (getHashComponent(field)) {
                        noUseStorage = 1;
                    }else {
                        noUseHash = 1;
                    }
                    keyField = 0; // not needed anymore
                };


            if (keep1stHash && (-1 === hashLine.indexOf('&'))) {
                hashLine = '';
            }

            // If we do use storage
            if (!noUseStorage) {
                if (storedData && onLoadStorage) {
                    storedData = onLoadStorage(storedData) || {};
                }

                // If we have #hash but still can use storage, choose what to use, #hash or storage.
                if (hashLine) {
                    /* keyField is ignored when user reloads the page (e.g. on F5 key press) when some auto-saved field is focused.
                       If field was not unfocused before page refresh, it using only localStorage and ignoring the #hash.
                       Because browser updating the storage, but not updating the address line (probably doesn't have a time to update the address line).
                       We don't want to roll back to value reflected in the address line before actual update of the input field and using only storage on page refresh.
                     */
                    var lastFocusedField = ssStorage.getItem(fieldUnloadFocus);
                    if (lastFocusedField && (getHashComponent(lastFocusedField) !== loadStoredItem(lastFocusedField))) {
                        // LAST value in #hash is not equals to value in storage...
                        // But let's check other values...
                        // If everything else are the same, then use storage. If something (anything) is different, use #hash.

                        var isDifferent,
                            i, s,
                            m = hashLine.match(new RegExp('(&' + (keep1stHash ? '' : '|^') + ')([^\\s=]+)=([^&$]+)', 'g')); // ATTN! \\s, since this is combined string! It's used as \s in expression.

                        for (i = 0; i < m.length; ++i) {
                            s = m[i].slice(1).split('=');
                            if ((lastFocusedField !== s[0]) && (decodeURIComponent(s[1]) !== loadStoredItem(s[0]))) {
                                isDifferent = 1;
                                break;
                            }
                        }

                        if (!isDifferent) hashLine = ''; // use storage instead.

                    }else if (keyField && ('string' === typeof keyField)) { // if keyField used and name (string value) specified
                        checkKeyField(keyField);
                    }
                }
            }

            // AK: we don't checking whether storage item exits. We don't know for sure what is already stored. But it's not hard to step over each named item on the form.
            // $form = $($form); // for sure
            $form.data(STR_STATUS_IS_LOADING, 1)
                    .find(getServeControls(storePasswords))
                    .not(classNoSave) // additional filter that applies to selected (served) controls
                        .each(function() { // walk through the each form fields that have a "name" attribute.
                try {
                    var el = this,
                        $el = $(el),
                        type = el.type,
                        name = el.name;

                    // if keyField is not string (no field name), but still specified, try to get #hash value for the first available field.
                    if (keyField) {
                        checkKeyField(name);
                    }

                    // CAUTION! We don't checking whether $el are exists. And even if it's exists, whether it's part of visible DOM.
                    // Always use fresh $form pointer.

                    //if (name) { // unnamed fields not restored (UPD we selecting only fields with "name" attribute)
                        // hashline has more priority. Even if there is stored value, check out hash first. But if hashline missing something -- use stored value.

                        var prevVal,
                            storedVal = loadHashOrStorage(name), // NOTE: storedVal could be NULL if we don't have value in storage yet.
                            storedValueHandler = $el.data('load');

                        if (storedValueHandler) {
                            storedVal = storedValueHandler(storedVal);
                        }

                        // debug
                        // console.log('load', name, storedVal);

                        if ('checkbox' === type) {
                            if (null !== storedVal) { // ATTN! storedVal may have "string" type in regular split storage (all values in reg storage are strings), but "int" in other cases. So no strict typed comparison.
                                var isChecked = !!storedVal && 0 != storedVal;

                                prevVal = el.checked;
                                el.checked = isChecked; // check or uncheck. Empty string mean unchecked. (We don't remove item from storage if it's unchecked. We may have "checked" as default state.)

                                if ((isChecked && !prevVal) || // if not checked by default, not a default value selected
                                    (!isChecked && prevVal)) {

                                    $el.trigger('change');
                                    isSomethingLoaded = 1;
                                }
                            }

                            // ATTN! Some customized checkboxes may be initialized before the formSaver restore their state.
                            // Please make sure that formSaver initialized prior to customization of the checkbox control!

                        }else if (storedVal) {
                            if ('radio' === type) {
                                if (el.value === storedVal) {
                                    prevVal = el.checked; // if it's already checked previously (eg on the backend, with "checked" attribute), then 'change' will not be triggered.
                                    el.checked = 1;
                                    if (!prevVal) { // not checked by default?
                                        $el.trigger('change');
                                        isSomethingLoaded = 1;
                                    }
                                }

                            }else {
                                if (el.multiple && '[' === storedVal[0]) { // only if string representation of JSON array. TODO: support arrays! Not strings!
                                    try {
                                        storedVal = JSON.parse(storedVal);
                                        if (storedVal.length) {
                                            $el.find('option:selected').prop('selected', 0); // clear current selection (if exists occasionally)
                                            $.each(storedVal, function(k, v) {
                                                $el.find('option[value="' + v + '"]').prop('selected', 1);
                                            });
                                            isSomethingLoaded = 1;
                                        }
                                    }catch(err){}
                                }else {
                                    prevVal = $el.val();
                                    if (prevVal !== storedVal) {
                                        // TODO 2023-10-29: we probably should have a custom overridable function to set up a value to the control.
                                        if (isTypeaheadSupported && $el.hasClass(typeaheadClass)) {
                                            $el.typeahead('val', storedVal);
                                        }else {
                                            $el.val(storedVal);
                                        }
                                        $el.trigger('change');
                                        if ('' === prevVal) {
                                            isSomethingLoaded = 1;
                                        }
                                    }

                                    if ($el.hasClass(saveDisabledStateClass)
                                            && (0 < loadHashOrStorage(saveDisabledStatePrefix + name))) {
                                        $el.prop('disabled', 1)
                                           // this is very custom feature. Maybe worth to be moved to event handler. TODO: pls move it out of here!
                                           // TODO: use custom event instead of the FontAwesome-specific classes!
                                           .closest('div').find('button i')
                                                            .removeClass('fa-eye')
                                                            .addClass('fa-eye-slash');
                                    }
                                }
                            }
                        }
                    //}

                }catch(err) {
                    console.error(err);
                }
            });

            // Save settings immediately.
            //   * save to hash line only if restored from storage (restored from storage == !hashLine)
            //   * save to storage if it restored from #hash
            saveForm($form, storageKey, keep1stHash, noUseHash || !!hashLine, noUseStorage || !hashLine);

            $form.data(STR_STATUS_IS_LOADING, 0); // not undefined!! When it 0/FALSE we know that it WAS LOADED.
                                           // (Also remember, that $form is not necessarily a <form>. It can be any DOM element.)
            if (isSomethingLoaded) {
                // !!ATTN!! make sure that event handler is set up BEFORE the initFormSaver() executed!
                // *hook* event prior to the loading!
                $form.trigger(eventFormRestore, isSomethingLoaded = storedData[fieldStoredDataTimestamp] || isSomethingLoaded);
                /*
                    $form.on('restore', (e, storedDataTimestamp) => {
                        // if stored more than 5 seconds ago.
                        if (5 < ((Date.now() - storedDataTimestamp) / 1000)) {
                            // do something
                        }
                    }).on('reset', e => {
                        // ...
                    })..initFormSaver({ ... });
                */
            }

            return isSomethingLoaded;
        },

        // Used to clear all storage keys with specified prefix. For example to clear all stored data on user logout.
        clearStorageKeys = function(keyPrefix, isSessionStorage) { // default is localStorage, but can be used for sessionStorage as well
            var theStorage = isSessionStorage ? ssStorage : llStorage,
                prefixLength = keyPrefix.length,
                // get the number of all records in storage
                storageLength = theStorage.length,
                // array for keys we should remove from storage
                keysToRemove = [],
                key, i;

            for (i = 0; i < storageLength; ++i) {
                key = theStorage.key(i);

                // add to array if starts with prefix
                if (key.slice(0, prefixLength) === keyPrefix) { // alternative is key.startsWidth(keyPrefix) in ES6+ syntax
                    keysToRemove.push(key);
                }
            }

            // delete all collected keys with specified keyPrefix
            keysToRemove.forEach(function(key) {
                theStorage.removeItem(key);
            });
        },

        // Remove single value from the stored data, preserving the rest of data.
        // Read, Decode, Remove specific keys from the associative array, Save updated data.
        removeStoredJsonKeys = function(storageKey, keysToRemove, isSessionStorage) { // keysToRemove can be either single value or array of strings
            var theStorage = isSessionStorage ? ssStorage : llStorage,
                value = parseJSON(theStorage.getItem(storageKey)),
                key;

            if (value) {
                if ('string' === typeof keysToRemove) {
                    keysToRemove = [keysToRemove];
                }

                for (key in keysToRemove) { // keep es5 syntax, no 'of'
                    delete value[keysToRemove[key]];
                }

                theStorage.setItem(storageKey, JSON.stringify(value));
            }
        };


    // Miscellaneous bonuses for the forms, which can be initialized and used even without formSaver.
    // Originally they all initialized together with formSaver, but later there was a need to use them separately for the controls in modal dialogs.
    $.fn[initUtilsFnName] = function() { // if controlQuery not specified, it use defControlQuery
        return this.each(function() { // multiple forms supported
            var form = this,
                $form = $(form);

            if (!$form.data(initUtilsFnName)) { // avoid double initialization
                $form.data(initUtilsFnName, 1);

                // ----------- BONUSES --------------

                // RESET part of the form. (ATTN! Reset means reset to original state, not clear the form.)
                // ATTN! Reset usually means the returning to default state (eg values are already filled after form submission and this is their default state).
                // In most cases you probably need to CLEAR the form instead.
                $form.find(ctlResetFields).on('click', function(e) { // this must be a button, not anchor. I don't want to do an odd preventDefault().
                    e.preventDefault();

                    var resetBlock = $(this).data(tokenResetDataAttr),
                        $blockToReset, $fieldsToReset,
                        queryFieldsToReset = getServeControls(1, 1);

                    if (resetBlock) {
                        $blockToReset = '#' === resetBlock[0]
                                            ? $(resetBlock)
                                            : $form.find(resetBlock)

                    // ATTN! If we point entire form, all fields will be reset. We can't exclude them with .no-reset class.
                    }else if ('FORM' !== form.tagName) {
                        $blockToReset = $form; // triggering of the 'reset' method works only for forms. If this is not real form, act like it's resetBlock.
                    }

                    if ($blockToReset.length) {
                        $fieldsToReset = $blockToReset.find(queryFieldsToReset) // we'd like to reset 'password' and 'file' inputs too
                                                            .not(classNoReset); // find all input within specified block. UPD. don't use .not(:hidden)! It excluding invisible fields, not only with type="hidden".

                        // ATTN! Entire form can be EASILY RESET with simple $form.trigger('reset')! Or with $form.resetForm() from utilmind' commons.
                        // However this implementation supposed to reset only PART of the form, inside of the block, specified in "data-reset-class" attribute.
                        // ALSO we can set up some default value (in data-def="..." attribute) for text/number fields instead of just clearing it.
                        // ...but if that reset block not specified, we resetting entire form anyway, see below...

                        // Let's clear the input of all text input fields. (But do not touch values of selects, checkboxes and radios.)
                        $fieldsToReset.not('select,input[type="checkbox"],input[type="radio"]').each(function() {
                            this.value = $(this).data('def') || this.defaultValue; // defaultValue must be better than this.getAttribute('value'); // try to use value specified in data-def="" (highest priority).
                            // BTW, see also 'webcalc.js' (calculium), where we used value in placeholder as default. But it's rare case.
                            // also... Remember that fields with type="numeric" perfectly accepting empty ('') values. If you have some different value, then it is set after form reset.
                        });

                        if ($form.typeahead) { // if typeaheads supported. Also maybe check existence of typeaheadClass?
                            $fieldsToReset.filter('input.' + typeaheadClass).each(function() {
                                $(this).typeahead('val', $(this).data('def') || this.defaultValue); // returning to default state. Reset, not clear!
                            });
                        }

                        $fieldsToReset.filter(':checked').prop('checked', 0); // uncheck all checked
                        var $selectFields = $fieldsToReset.filter('select');

                        $selectFields.filter('[multiple]').find('option:selected').prop('selected', 0);
                        $selectFields.not('[multiple]').each(function(e) {
                            this.selectedIndex = 0;
                            //$(this)[0].selectedIndex = 0;
                        });

                        // $form itself receives on('reset') too!
                        // ATTN! Reset does NOT CLEARS the form! It resets to default states. So after submission of the form, default states are the original form input!
                        $blockToReset.trigger('reset'); // this does nothing, but allows to hook it to take some actions for custom controls.

                    // reset entire form. If you have custom control that require special processing -- hook $form.on('reset') event.
                    }else {
                        if ($form.resetForm) { // $.fn.resetForm from umcommons is exists?
                            // Do prefer resetForm(), because it's already has "typeahead" support.
                            // ATTN! Reset does NOT CLEARS the form! It resets to default states. So after submission of the form, default states are the original form input!
                            $form.resetForm(); // 'RESET' IS NOT 'CLEAR'! For clearing you might need different implementation!
                        }else {
                            // ATTN! Reset does NOT CLEARS the form! It resets to default states. So after submission of the form, default states are the original form input!
                            $form.trigger('reset');
                        }

                        $fieldsToReset = $form.find(queryFieldsToReset);
                    }

                    $fieldsToReset
                        .trigger('change')
                        .first(':enabled').trigger('focus'); // focus first enabled (:visible) field after reset
                });

                // Check all / uncheck all.
                $form.find(ctlCheckAll).on('click', function(e) {
                    e.preventDefault();

                    var $link = $(this),
                        isCheckAll = !!$link.data('check');

                    // find all checkboxes within element with class specified in data-within="..."
                    $form.find($link.data('within') + ' input[type="checkbox"]').each(function() {
                        if (this.checked !== isCheckAll) { // it could be much easier, but I want to trigger
                            this.checked = isCheckAll;
                            $(this).trigger('change'/*, e*/); // we really need to inform the control about the change.
                        } // useless optimize "this" here :)
                    });
                });


                // MORE...
                //     jquery.required-if-visible.js
            }
        });
    };

    // extend jQuery. Setting up the most typical case of usage.
    //
    /* Usage: $form.isLoadingStorage()
    // UPD. Deprecated. Use $form.data('isLoadingStorage') instead.
    $.fn[STR_STATUS_IS_LOADING] = function() {
        return this.data(STR_STATUS_IS_LOADING);
    };*/

    // Usage: $form.initFormSaver({...}), so you don't need to call saveForm(). It will be performed automatically.
    // FYI: $form is not necessarily should be a <form> element. It can be any tag.
    //
    // ATTN!!! If something does not works, if form does not save something, CHECK OUT "name" ATTRIBUTE in the form fields! "name" is required to save input values!
    $.fn[initPluginFnName] = function(options) { // if controlQuery not specified, it use defControlQuery
        /* Valid options are:

               storageKey: the name of key in storage (either localStorage or sessionStorage)
               noUseStorage: don't update localStorage when auto-updating. -1 = use sessionStorage (which clearing when the page is closed) instead of localStorage
               noUseHash: don't update #hashline when auto-updating
               keep1stHash: keep the string used as prefix in the #hashline
               storePasswords: okay to store & load content of the password input fields. Default is FALSE = do NOT store any content of password fields in localStorage/hash, since it's critically unsecure.

               keyField: if we use both #hash and localStorage, we should not mix their values on loading if some field omitted.
                            If this key field found in #hashline, we'll keep using #hash for the rest of field, w/o restoring anything from localStorage.
                            And wise versa, if the `keyField` omitted in #hash but found in storage, this means malformed #hash, so everything will be restored from localStorage only.
                            * You can set keyField to 1 or boolean TRUE. So if any first restorable field found on the form has value in #hash -- we'll keep using #hash,
                              w/o checking storage. And wise versa, if any first field found in localStorage, we'll keep using only storage.
                            * keyField is ignored when user reloads the page (e.g. on F5 key press) when some auto-saved field is focused.
                              If field was not unfocused before page refresh, it using only localStorage and ignoring the #hash.
                              Because browser updating the storage, but not updating the address line (probably doesn't have a time to update the address line).
                              We don't want to roll back to value reflected in the address line before actual update of the input field and using only storage on page refresh.

            // CALLBACKS (not events)

               onLoadStorage: set up a handler function to get stored data (only from localStorage, NOT HASH, STORAGE ONLY!) before it's restored
                              ...and have a possibility to cancel loading if something else (e.g. URL parameters) require to not restore the form from the localStorage.

            // METHODS:

               load: true by default (if undefined), set to FALSE to NOT LOAD anything on start
               reset: (storageKey) erase all keys/value with storageKey as key prefix. If 'reset' has non string value -- storageKey used to remove all stored keys with the same prefix.

           Also if you'd like to hook an event when form is reset/restored, hook the form events. Both 'reset' and 'restore' are valid.
           Eg. $myForm.initFormSaver(options)
                   .on('reset', e => {...})
                   .on('restore', e => {...}) // make sure to set up this event handler *before* the initFormSaver executed
                   .on('submit', e => {...}); // etc...
         */

        if (!options) {
            options = {};
        }
        return this.each(function() {
            var $form = $(this),
                isReset = options.reset;

            if (!$form.data(initPluginFnName)) { // avoid double initialization
                $form.data(initPluginFnName, options); // we don't care if `options` will be changed outside. We only checking whether such data key exists, this is enough. And `options` as value can be just useful.

                // We can remove all stored keys even after initialization of formSaver. Any moment, just call initFormSaver({reset:1}).
                if (isReset) { // of course we don't need to loadForm on reset.
                    (0 > options.noUseStorage ? ssStorage : llStorage) // use sessionStorage or localStorage
                        .removeItem('string' === typeof isReset
                                        ? isReset
                                        : options.storageKey || defStorageKey);

                }else if (undefined === options.load || options.load) { // load by default
                    loadForm($form, options);
                }

                // save to storage on each change
                $form.find(serveControls)
                    .on('change', function() { // It can be 'change input paste', but we don't need to update storage so often.
                        saveForm($form, options);
                    });

                window.addEventListener('beforeunload', function(focusedEl) { // focusedEl is just declaration of variable
                    noWait = 1;
                    saveForm($form, options, 1); // 1 (true) means triggered from `window.beforeunload` event.

                    // We saving last focused element name. If it was changed, we has time to update the localStorage, BUT the #hash still remains the same on page refresh.
                    // This value will be used to check difference between the #hash and values in storage, to determinate
                    // whether it was just refresh (so value must be restored from storage), or navigation to new URL (so we should totally respect full #hash and ignore storage).
                    //
                    // ATTN: don't confuse it with current value in active field! It's SESSION storage and it has nothing to do with actual information on the form.
                    focusedEl = document.activeElement;
                    if (focusedEl && focusedEl.name) {
                        ssStorage.setItem(fieldUnloadFocus, focusedEl.name);
                    }else {
                        ssStorage.removeItem(fieldUnloadFocus);
                    }
                });

                // automatically initialize all bonus utilities for the $form.
                $form[initUtilsFnName]();
            }
        });
    };

    // saveForm
    // Plugin. Force saveForm() with exactly the same options used upon initialization of the formSaver().
    $.fn[nameSaveForm] = function() {
        return this.each(function() {
                var $form = $(this),
                    initOptions = $form.data(initPluginFnName);

                saveForm($form, initOptions);
            });
    };


    /* // We don't need this. Form loaded on initialization
    $.fn[nameLoadForm] = function(storageKey, keep1stHash, noUseHash, noUseStorage) {
        var initOptions = $form.data(initPluginFnName);
        this.each(function() {
            loadForm(this, initOptions);
        });
    };*/

    // EXPORT to window.
    window[nameSaveForm] = saveForm; // NOTE! It also installed as jQuery plugin, $form.saveForm(...)
    window[nameLoadForm] = loadForm; // returns TRUE if something was loaded/restored
    window[nameClearStorageKeys] = clearStorageKeys;
    window[nameRemoveStoredJsonKeys] = removeStoredJsonKeys;


    // ALSO. To check out whether values still loading, check $form.data('isLoadingStorage')
})(window, jQuery);