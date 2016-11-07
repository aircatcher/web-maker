/* eslint-disable no-extra-semi */
;(function () {

/* eslint-enable no-extra-semi */
	var editur = window.editur || {};
	var version = '1.7.1';

	window.$ = document.querySelector.bind(document);
	window.$all = document.querySelectorAll.bind(document);
	window.DEBUG = 1;

	var HtmlModes = {
		HTML: 'html',
		MARKDOWN: 'markdown',
		JADE: 'jade' // unsafe eval is put in manifest for this file
	};
	var CssModes = {
		CSS: 'css',
		SCSS: 'scss',
		LESS: 'less'
	};
	var JsModes = {
		JS: 'js',
		ES6: 'es6',
		COFFEESCRIPT: 'coffee'
	};
	var modes = {};
	modes[HtmlModes.HTML] = { label: 'HTML', cmMode: 'htmlmixed', codepenVal: 'none' };
	modes[HtmlModes.MARKDOWN] = { label: 'Markdown', cmMode: 'markdown', codepenVal: 'markdown' };
	modes[HtmlModes.JADE] = { label: 'Jade', cmMode: 'jade', codepenVal: 'jade' };
	modes[JsModes.JS] = { label: 'JS', cmMode: 'javascript', codepenVal: 'none' };
	modes[JsModes.COFFEESCRIPT] = { label: 'CoffeeScript', cmMode: 'coffeescript', codepenVal: 'coffeescript' };
	modes[JsModes.ES6] = { label: 'ES6 (Babel)', cmMode: 'javascript', codepenVal: 'babel' };
	modes[CssModes.CSS] = { label: 'CSS', cmMode: 'css', codepenVal: 'none' };
	modes[CssModes.SCSS] = { label: 'SCSS', cmMode: 'sass', codepenVal: 'scss' };
	modes[CssModes.LESS] = { label: 'LESS', cmMode: 'text/x-less', codepenVal: 'less' };

	var updateTimer
		, updateDelay = 500
		, currentLayoutMode
		, hasSeenNotifications = true
		, htmlMode = HtmlModes.HTML
		, jsMode = JsModes.JS
		, cssMode = CssModes.CSS
		, sass
		, currentItem

		// DOM nodes 
		, frame = $('#demo-frame')
		, htmlCode = $('#js-html-code')
		, cssCode = $('#js-css-code')
		, jsCode = $('#js-js-code')
		, layoutBtn1 = $('#js-layout-btn-1')
		, layoutBtn2 = $('#js-layout-btn-2')
		, layoutBtn3 = $('#js-layout-btn-3')
		, helpBtn = $('#js-help-btn')
		, helpModal = $('#js-help-modal')
		, codepenBtn = $('#js-codepen-btn')
		, codepenForm = $('#js-codepen-form')
		, saveHtmlBtn = $('#js-save-html')
		, settingsBtn = $('#js-settings-btn')
		, notificationsBtn = $('#js-notifications-btn')
		, openBtn = $('#js-open-btn')
		, saveBtn = $('#js-save-btn')
		, newBtn = $('#js-new-btn')
		, savedItemsPane = $('#js-saved-items-pane')
		, savedItemsPaneCloseBtn = $('#js-saved-items-pane-close-btn')
		, notificationsModal = $('#js-notifications-modal')
		, htmlModelLabel = $('#js-html-mode-label')
		, cssModelLabel = $('#js-css-mode-label')
		, jsModelLabel = $('#js-js-mode-label')
		, titleInput = $('#js-title-input')
		;

	editur.cm = {};
	editur.demoFrameDocument = frame.contentDocument || frame.contentWindow.document;


	function resetSplitting() {
		var gutters = $all('.gutter');
		for (var i = gutters.length; i--;) {
			gutters[i].remove();
		}
		$('#js-html-code').setAttribute('style', '');
		$('#js-css-code').setAttribute('style', '');
		$('#js-js-code').setAttribute('style', '');
		$('#js-code-side').setAttribute('style', '');
		$('#js-demo-side').setAttribute('style', '');

		Split(['#js-html-code', '#js-css-code', '#js-js-code'], {
			direction: (currentLayoutMode === 2 ? 'horizontal' : 'vertical'),
			minSize: 34,
			gutterSize: 6
		});
		Split(['#js-code-side', '#js-demo-side' ], {
			direction: (currentLayoutMode === 2 ? 'vertical' : 'horizontal'),
			minSize: 34,
			gutterSize: 6
		});
	}
	function toggleLayout(mode) {
		currentLayoutMode = mode;
		$('#js-layout-btn-1').classList.remove('selected');
		$('#js-layout-btn-2').classList.remove('selected');
		$('#js-layout-btn-3').classList.remove('selected');
		$('#js-layout-btn-' + mode).classList.add('selected');
		document.body.classList.remove('layout-1');
		document.body.classList.remove('layout-2');
		document.body.classList.remove('layout-3');
		document.body.classList.add('layout-' + mode);

		resetSplitting();
	}

	function saveSetting(setting, value) {
		var obj = {};
		obj[setting] = value;
		chrome.storage.local.set(obj, function() {
		});
	}

	// Save current item to storage
	function saveItem() {
		var isNewItem = !currentItem.id;
		currentItem.id = currentItem.id || ('item-' + generateRandomId()); 
		saveCode();

		// Push into the items hash if its a new item being saved
		if (isNewItem) {
			chrome.storage.local.get({
				items: {}
			}, function (result) {
				result.items[currentItem.id] = true;
				chrome.storage.local.set({
					items: result.items
				});
			})
		}
	}

	function saveCode(key) {
		currentItem.title = titleInput.value;
		currentItem.html = editur.cm.html.getValue();
		currentItem.css = editur.cm.css.getValue();
		currentItem.js = editur.cm.js.getValue();
		currentItem.updatedOn = Date.now();
		log('saving key', key || currentItem.id, currentItem)
		currentItem.hoid = currentItem.id;
		saveSetting(key || currentItem.id, currentItem);
	}

	function populateItem(items) {
		currentItem = savedItems[];
		refreshEditor();
	}
	function populateItemsInSavedPane(items) {
		if (!items || !items.length) return;
		var html = '';
		// TODO: sort desc. by updation date
		items.forEach(function (item) {
			html += '<div class="saved-item-tile">' + item.title + '</div>';
		})
		savedItemsPane.querySelector('#js-saved-items-wrap').innerHTML = html;
		toggleSavedItemsPane();
	}

	function toggleSavedItemsPane() {
		savedItemsPane.classList.toggle('is-open');
	}
	function openSavedItemsPane() {
		chrome.storage.local.get('items', function (result) {
			var itemIds = Object.getOwnPropertyNames(result.items),
				items = [];

			for (var i = 0; i < itemIds.length; i++) {
				(function (index) {
					chrome.storage.local.get(itemIds[index], function (itemResult) {
						items.push(itemResult[itemIds[index]]);
						// Check if we have all items now.
						if (itemIds.length === items.length) {
							populateItemsInSavedPane(items);
						}
					});
				})(i);
			}
		});
	}

	function createNewItem() {
		currentItem = {
			title: 'Untitled ' + (new Date).getDate()
		};
		editur.cm.html.setValue('');
		editur.cm.css.setValue('');
		editur.cm.js.setValue('');
		editur.cm.html.refresh();
		editur.cm.css.refresh();
		editur.cm.js.refresh();
	}

	function refreshEditor() {
		titleInput.value = currentItem.title || 'Untitled';
		editur.cm.html.setValue(currentItem.html);
		editur.cm.css.setValue(currentItem.css);
		editur.cm.js.setValue(currentItem.js);

		editur.cm.html.refresh();
		editur.cm.css.refresh();
		editur.cm.js.refresh();
	}

	/**
	 * Loaded the code comiler based on the mode selected
	 */
	function handleModeRequirements(mode) {
		// Exit if already loaded
		if (modes[mode].hasLoaded) { return; }

		function setLoadedFlag() {
			modes[mode].hasLoaded = true;
		}

		if (mode === HtmlModes.JADE) {
			loadJS('lib/jade.js').then(setLoadedFlag);
		} else if (mode === HtmlModes.MARKDOWN) {
			loadJS('lib/marked.js').then(setLoadedFlag);
		} else if (mode === CssModes.LESS) {
			loadJS('lib/less.min.js').then(setLoadedFlag);
		} else if (mode === CssModes.SCSS) {
			loadJS('lib/sass.js').then(function () {
				sass = new Sass('lib/sass.worker.js');
				setLoadedFlag();
			});
		} else if (mode === JsModes.COFFEESCRIPT) {
			loadJS('lib/coffee-script.js').then(setLoadedFlag);
		} else if (mode === JsModes.ES6) {
			loadJS('lib/babel.min.js').then(setLoadedFlag);
		}
	}

	function updateHtmlMode(value) {
		htmlMode = value;
		htmlModelLabel.textContent = modes[value].label;
		handleModeRequirements(value);
		editur.cm.html.setOption('mode', modes[value].cmMode);
		CodeMirror.autoLoadMode(editur.cm.html, modes[value].cmMode);
		chrome.storage.sync.set({
			htmlMode: value
		}, function () {});
	}
	function updateCssMode(value) {
		cssMode = value;
		cssModelLabel.textContent = modes[value].label;
		handleModeRequirements(value);
		editur.cm.css.setOption('mode', modes[value].cmMode);
		CodeMirror.autoLoadMode(editur.cm.css, modes[value].cmMode);
		chrome.storage.sync.set({
			cssMode: value
		}, function () {});
	}
	function updateJsMode(value) {
		jsMode = value;
		jsModelLabel.textContent = modes[value].label;
		handleModeRequirements(value);
		editur.cm.js.setOption('mode', modes[value].cmMode);
		CodeMirror.autoLoadMode(editur.cm.js, modes[value].cmMode);
		chrome.storage.sync.set({
			jsMode: value
		}, function () {});
	}

	// computeHtml, computeCss & computeJs evaluate the final code according
	// to whatever mode is selected and resolve the returned promise with the code.
	function computeHtml() {
		var d = deferred();
		var code = editur.cm.html.getValue();
		if (htmlMode === HtmlModes.HTML) {
			d.resolve(code);
		} else if (htmlMode === HtmlModes.MARKDOWN) {
			d.resolve(marked(code));
		} else if (htmlMode === HtmlModes.JADE) {
			d.resolve(jade.render(code));
		}

		return d.promise;
	}
	function computeCss() {
		var d = deferred();
		var code = editur.cm.css.getValue();
		if (cssMode === CssModes.CSS) {
			d.resolve(code);
		} else if (cssMode === CssModes.SCSS) {
			sass.compile(code, function(result) {
				d.resolve(result.text);
			});
		} else if (cssMode === CssModes.LESS) {
			less.render(code).then(function (result) {
				d.resolve(result.css);
			});
		}

		return d.promise;
	}
	function computeJs() {
		var d = deferred();
		var code = editur.cm.js.getValue();
		if (jsMode === JsModes.JS) {
			d.resolve(code);
		} else if (jsMode === JsModes.COFFEESCRIPT) {
			d.resolve(CoffeeScript.compile(code, { bare: true }));
		} else if (jsMode === JsModes.ES6) {
			d.resolve(Babel.transform(editur.cm.js.getValue(), { presets: ['es2015'] }).code);
		}

		return d.promise;
	}

	window.onunload = function () {
		saveCode('code');
	};

	function createPreviewFile(html, css, js) {
		var contents = 
			'<html>\n<head>\n' + 
			'<style>\n' + css + '\n</style>\n</head>\n' + 
			'<body>\n' + html + '\n<script>\n' + js + '\n</script></body>\n</html>';

		var fileWritten = false;

		var blob = new Blob([ contents ], { type: "text/plain;charset=UTF-8" });

		function errorHandler() { console.log(arguments); }

		window.webkitRequestFileSystem(window.TEMPORARY, 1024 * 1024 * 5, function(fs){
			fs.root.getFile('preview.html', { create: true }, function(fileEntry) {
				fileEntry.createWriter(function(fileWriter) {
					function onWriteComplete() {
						if (fileWritten) {
							frame.src = 'filesystem:chrome-extension://' + 
							chrome.i18n.getMessage('@@extension_id') + '/temporary/' + 'preview.html';
						}
						else {
							fileWritten = true;
							fileWriter.seek(0);
							fileWriter.write(blob);
						}
					}
					fileWriter.onwriteend = onWriteComplete;
					fileWriter.truncate(0)
				}, errorHandler);
			}, errorHandler);
		}, errorHandler);
	}

	editur.setPreviewContent = function () {
		var htmlPromise = computeHtml();
		var cssPromise = computeCss();
		var jsPromise = computeJs();
		Promise.all([htmlPromise, cssPromise, jsPromise]).then(function (result) {
			createPreviewFile(result[0], result[1], result[2]);
		});
	};

	function saveFile() {
		var htmlPromise = computeHtml();
		var cssPromise = computeCss();
		var jsPromise = computeJs();
		Promise.all([htmlPromise, cssPromise, jsPromise]).then(function (result) {
			var html = result[0],
				css = result[1],
				js = result[2];

			var fileContent = '<html><head>\n<style>\n'
				+ css + '\n</style>\n</head>\n<body>\n'
				+ html + '\n<script>\n' + js + '\n</script>\n\n</body>\n</html>';

			var d = new Date();
			var fileName = [ 'web-maker', d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds() ].join('-');
			fileName += '.html';

			var a = document.createElement('a');
			var blob = new Blob([ fileContent ], { type: "text/html;charset=UTF-8" });
			a.href = window.URL.createObjectURL(blob);
			a.download = fileName;
			a.style.display = 'none';
			document.body.appendChild(a);
			a.click();
			a.remove();
		});
	}

	function initEditor(element, options) {
		var cm = CodeMirror(element, {
			mode: options.mode,
			lineNumbers: true,
			lineWrapping: true,
			autofocus: options.autofocus || false,
			autoCloseBrackets: true,
			matchBrackets: true,
			tabMode: 'indent',
			keyMap: 'sublime',
			theme: 'monokai',
			// cursorScrollMargin: '20', has issue with scrolling
			profile: options.profile || ''
		});
		cm.on('change', function onChange() {
			clearTimeout(updateTimer);
			updateTimer = setTimeout(function () {
				editur.setPreviewContent();
			}, updateDelay);
		});
		return cm;
	}

	editur.cm.html = initEditor(htmlCode, {
		mode: 'htmlmixed',
		profile: 'xhtml'
	});
	emmetCodeMirror(editur.cm.html);
	editur.cm.css = initEditor(cssCode, {
		mode: 'css'
	});
	editur.cm.js = initEditor(jsCode, {
		mode: 'javascript'
	});

	function init () {
		var lastCode;

		CodeMirror.modeURL = "lib/codemirror/mode/%N/%N.js";

		layoutBtn1.addEventListener('click', function () { saveSetting('layoutMode', 1); toggleLayout(1); return false; });
		layoutBtn2.addEventListener('click', function () { saveSetting('layoutMode', 2); toggleLayout(2); return false; });
		layoutBtn3.addEventListener('click', function () { saveSetting('layoutMode', 3); toggleLayout(3); return false; });

		onButtonClick(helpBtn, function () {
			helpModal.classList.toggle('is-modal-visible');
		});

		notificationsBtn.addEventListener('click', function () {
			notificationsModal.classList.toggle('is-modal-visible');
			if (notificationsModal.classList.contains('is-modal-visible') && !hasSeenNotifications) {
				hasSeenNotifications = true;
				notificationsBtn.classList.remove('has-new');
				chrome.storage.sync.set({
					lastSeenVersion: version
				}, function () {});
			}
			return false;
		});

		codepenBtn.addEventListener('click', function (e) {
			var json = {
				title: 'A Web Maker experiment',
				html: editur.cm.html.getValue(),
				css: editur.cm.css.getValue(),
				js: editur.cm.js.getValue(),

				/* eslint-disable camelcase */
				html_pre_processor: modes[htmlMode].codepenVal,
				css_pre_processor: modes[cssMode].codepenVal,
				js_pre_processor: modes[jsMode].codepenVal

				/* eslint-enable camelcase */
			};
			json = JSON.stringify(json)
				.replace(/"/g, "&​quot;")
				.replace(/'/g, "&apos;")
			codepenForm.querySelector('input').value = json;
			codepenForm.submit();
			e.preventDefault();
		});

		onButtonClick(saveHtmlBtn, saveFile);
		onButtonClick(openBtn, openSavedItemsPane);
		onButtonClick(saveBtn, saveItem);
		onButtonClick(newBtn, createNewItem);
		onButtonClick(savedItemsPaneCloseBtn, toggleSavedItemsPane);

		// Attach listeners on mode change menu items
		var modeItems = [].slice.call($all('.js-modes-menu a'));
		modeItems.forEach(function (item) {
			item.addEventListener('click', function (e) {
				var mode = e.currentTarget.dataset.mode;
				var type = e.currentTarget.dataset.type;
				var currentMode = type === 'html' ? htmlMode : (type === 'css' ? cssMode : jsMode);
				if (currentMode !== mode) {
					if (type === 'html') {
						updateHtmlMode(mode);
					} else if (type === 'js') {
						updateJsMode(mode);
					} else if (type === 'css') {
						updateCssMode(mode);
					}
				}
			});
		});

		window.addEventListener('keydown', function (event) {
			if ((event.ctrlKey || event.metaKey) && (event.keyCode === 83)){
				event.preventDefault();
				saveFile();
			}
		});

		window.addEventListener('click', function(e) {
			if (typeof e.target.className === 'string' && e.target.className.indexOf('modal-overlay') !== -1) {
				helpModal.classList.remove('is-modal-visible');
				notificationsModal.classList.remove('is-modal-visible');
			}
		});

		onButtonClick(settingsBtn, function() {
			if (!chrome.runtime.openOptionsPage) {
				// New way to open options pages, if supported (Chrome 42+).
				// Bug: https://bugs.chromium.org/p/chromium/issues/detail?id=601997
				// Until this bug fixes, use the
				// fallback.
				chrome.runtime.openOptionsPage();
			} else {
				// Fallback.
				chrome.tabs.create({
					url: 'chrome://extensions?options=' + chrome.i18n.getMessage('@@extension_id')
				});
			}
		});

		chrome.storage.local.get({
			layoutMode: 1,
			code: ''
		}, function localGetCallback(result) {
			toggleLayout(result.layoutMode);
			if (result.code) {
				lastCode = result.code;
			}
		});

		// Get synced `preserveLastCode` setting to get back last code (or not).
		chrome.storage.sync.get({
			preserveLastCode: true,
			htmlMode: 'html',
			jsMode: 'js',
			cssMode: 'css'
		}, function syncGetCallback(result) {
			if (result.preserveLastCode && lastCode) {
				if (lastCode.id) {
					chrome.storage.local.get(lastCode.id, function (result) {
						log('Load item ', lastCode.id)
						currentItem = result[lastCode.id];
						refreshEditor();
					})
				} else {
					log('Load last unsaved item');
					currentItem = lastCode;
					refreshEditor();
				}
			} else {
				createNewItem();
			}
			updateHtmlMode(result.htmlMode);
			updateJsMode(result.jsMode);
			updateCssMode(result.cssMode);
		});

		// Check for new version notifications
		chrome.storage.sync.get({
			lastSeenVersion: ''
		}, function syncGetCallback(result) {
			// console.log(result, hasSeenNotifications, version);
			if (!result.lastSeenVersion || semverCompare(result.lastSeenVersion, version) === -1) {
				notificationsBtn.classList.add('has-new');
				hasSeenNotifications = false;
			}
		});
	}

	init();

})();