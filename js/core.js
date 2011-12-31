$(function() {
	var flux = {
		/**
		* Handle to the main flux container
		* @var object
		* @access private
		*/
		master: 0,

		/**
		* Unique ID generator
		* @var int
		* @access private
		*/
		nextid: 0,
		
		/**
		* Menu cache used by jquery.contextmenu
		* @var array
		* @access private
		*/
		menus: {},

		/**
		* The item id currently being edited by the user
		* @access private
		*/
		edititem: 0,

		/**
		* Options storage hash
		* @var array
		* @access private
		*/
		options: {},

		/**
		* Initalize Flux
		*/
		init: function(options) {
			flux['options'] = $.extend({
				idprefix: 'flux-', // What prefix to use when randomly generating IDs
				server: 'php/file.php',
				server_refresh: 0 // How often should data be loaded? Set to 0 to disable
			}, options);

			flux['master'] = this;
			flux['menus'] = { // Set up menus
				options: {theme:'human'},
				item: [
					{'Edit':{icon: 'images/menus/edit.png', onclick: flux['edit']}},
					{'Add sub-item':{icon: 'images/menus/add-child.png', onclick: function() { flux['add'](this.id, '', {position: 'under', edit: 1}); }}},
					{'Add next':{icon: 'images/menus/add-sibling.png', onclick: function() { flux['add'](this.id, '', {position: 'after', edit: 1}); }}},
					$.contextMenu.separator,
					{'Promote':{icon: 'images/menus/promote.png', onclick: flux['promote']}},
					{'Demote':{icon: 'images/menus/demote.png', onclick: flux['demote']}},
					$.contextMenu.separator,
					{'<div class="submenu-select"><div style="float:left;">Priority:</div> <img src="images/priorities/0.png" rel="0"/> <img src="images/priorities/1.png" rel="1"/> <img src="images/priorities/2.png" rel="2"/> <img src="images/priorities/3.png" rel="3"/> <img src="images/priorities/4.png" rel="4"/> <img src="images/priorities/5.png" rel="5"/></div><br>': function(m,c,e) {
						flux['priority']($(this).attr('id'), $(e.target).attr('rel'));
						return true;
					}},
					$.contextMenu.separator,
					{'Remove':{icon: 'images/menus/remove.png', onclick: flux['remove']}},
				]
			};

			shortcut.add('tab', function() { // In-place demotion via tab
				if (flux['edititem'])
					flux['demote'](flux['edititem']);
			});
			shortcut.add('shift+tab', function() { // In-place promotion via shift+tab
				if (flux['edititem'])
					flux['promote'](flux['edititem']);
			});
			shortcut.add('escape', function() { // Escape edit mode
				if (flux['edititem'])
					flux['unedit'](flux['edititem']);
			});
			shortcut.add('down', function() { // Select next node for edit
				if (flux['edititem'])
					flux['editmove']('down');
			});
			shortcut.add('up', function() { // Select previous node for edit
				if (flux['edititem'])
					flux['editmove']('up');
			});
			shortcut.add('ctrl+up', function() { // Move priority up
				if (flux['edititem'])
					flux['priority'](flux['edititem'], 'up');
			});
			shortcut.add('ctrl+down', function() { // Move priority down
				if (flux['edititem'])
					flux['priority'](flux['edititem'], 'down');
			});
			shortcut.add('enter', function() { // Create new child
				if (flux['edititem'])
					var childid = flux['add'](flux['edititem'], '', {edit: 1});
			});

			shortcut.add('f8', flux['server_push']); // Quick save
			shortcut.add('f9', flux['server_pull']); // Quick load

			return this.each(function() {
				$(this).empty();
			});
		},

		/**
		* Add a new node under the specified parent
		* @param string parent_id The ID of the parent to append the node to. If omitted the root is used
		* @param string text The text of the node
		* @param array options Additional options if any
		* @return string The ID of the newly created node
		*/
		add: function(parent_id, text, options) {
			var opt = $.extend({
				id: 0,
				priority: 0,
				position: 'under', // Values: under, after
				level: -1, // Override the level to place the object at
				edit: 0 // Open edit pane immediately after creation
			}, options);
			if (!opt['id']) // Assign unique ID if none
				opt['id'] = flux['_uniqueid']();
			var parent = parent_id ? $('.flux #' + parent_id) : $(this);
			var child = $('<div></div>');
			if (opt['level'] == -1) { // Figure out the level
				if (parent_id) { // From the parent?
					opt['level'] = parent.data('level') + (opt['position'] == 'under' ? 1 : 0);
				} else
					opt['level'] = 0;
			}
			child
				.data('level', opt['level'])
				.data('priority', opt['priority'])
				.attr('id', opt['id'])
				.addClass('nest-' + opt['level'])
				.addClass('priority-' + opt['priority'])
				.html(text)
				.click(flux['edit'])
				.contextMenu(flux['menus']['item'], flux['menus']['options']);
			if (parent_id) {
				child.insertAfter(parent)
			} else
				child.appendTo(flux['master']);
			flux['style'](opt['id']);
			if (opt['edit'])
				flux['edit'](opt['id']);
			return opt['id'];
		},

		/**
		* Apply meta styles to a list item
		* @param string The ID of the item to style
		*/
		style: function(id) {
			var item = $('.flux #' + id);
			var itext = item.text();
			item.removeClass('style-heading style-spacer');
			if (itext == '-') {
				item.addClass('style-spacer');
				item.html('<span>-</span>');
			} else if (itext.substr(0,1) == '!') {
				item.html('<span>!</span>' + itext.substr(1));
				item.addClass('style-heading');
			}
		},

		/**
		* Remove a given node by its ID
		* param event|id id Either the event id of a jQuery callback OR the id of the item to remove. If e is an event 'this' is used as the active item
		*/
		remove: function(id) {
			var item = $( (typeof id == 'string') ? '.flux #' + id : this);
			item.remove();
		},

		/**
		* Demote a given node
		* param event|id id Either the event id of a jQuery callback OR the id of the item to demote. If e is an event 'this' is used as the active item
		*/
		demote: function(id) {
			var item = $( (typeof id == 'string') ? '.flux #' + id : this);
			// FIXME: Check this is eligable to be a child (e.g. not first in list)
			var thislevel = item.data('level');
			var newlevel = Number(item.data('level'))+1;
			console.log('DEMOTE! ID: ' + item.attr('id') + ', LVL: ' + thislevel + ', NLVL:' + newlevel);
			item
				.removeClass('nest-' + thislevel)
				.addClass('nest-' + newlevel)
				.data('level', newlevel);
		},

		/**
		* Promote a given node
		* param event|id id Either the event id of a jQuery callback OR the id of the item to promote. If e is an event 'this' is used as the active item
		*/
		promote: function(id) {
			var item = $( (typeof id == 'string') ? '.flux #' + id : this);
			var thislevel = item.data('level');
			var newlevel = Number(item.data('level'))-1;
			console.log('PROMOTE! ID: ' + item.attr('id') + ', LVL: ' + thislevel + ', NLVL:' + newlevel);
			if (item.data('level') > 0)
				item
					.removeClass('nest-' + thislevel)
					.addClass('nest-' + newlevel)
					.data('level', newlevel);
		},

		/**
		* Assign the priority of a given node
		* param event|id id Either the event id of a jQuery callback OR the id of the item to adjust the priority of. If e is an event 'this' is used as the active item
		* param int|string value Either values 0-5, 'up' or 'down'
		*/
		priority: function(id, value) {
			var item = $( (typeof id == 'string') ? $('.flux #' + id) : this);
			var newpri = -1;
			if (value >= 0 && value <= 5 && value != item.data('priority')) {
				newpri = value;
			} else if (value == 'up' && item.data('priority')<5) {
				newpri = item.data('priority')+1;
			} else if (value == 'down' && item.data('priority')>0) {
				newpri = item.data('priority')-1;
			} else {
				return;
			}
			item
				.removeClass('priority-' + item.data('priority'))
				.addClass('priority-' + newpri)
				.data('priority', newpri);
		},

		/**
		* Edit a given item
		* param event|id id Either the event id of a jQuery callback OR the id of the item to edit. If e is an event 'this' is used as the active item
		*/
		edit: function(id) {
			var i = $( (typeof id == 'string') ? '.flux #' + id : this);
			if (flux['edititem'] == i.attr('id')) // Trying to edit the same item twice
				return;
			if (flux['edititem']) { // Already editing - release first
				flux['unedit'](flux['edititem']);
			}

			var editpane = $('<div id="edit"></div');
			flux['edititem'] = i.attr('id');
			var editbox = $('<input type="text" class="edit"/></div>')
				.data('nodeid', flux['edititem'])
				.appendTo(editpane)
				.val(i.text())
				.blur(flux['unedit']);
			i
				.addClass('editing')
				.empty()
				.append(editpane);
			editbox.focus();
		},

		/**
		* Release edit mode
		* param event|id id Either the event id of a jQuery callback OR the id of the item to un edit. If e is an event 'this' is used as the active item
		*/
		unedit: function(id) {
			if (!flux['edititem']) // Not editing anyway
				return;
			var editbox = (typeof id == 'string') ? $('.flux #' + id + ' input') : $(this);
			var newval = $.trim(editbox.val());
			if (!newval) {
				flux['remove'](flux['edititem']);
			} else {
				$('.flux #' + editbox.data('nodeid'))
					.removeClass('editing')
					.html(newval);
				flux['style'](flux['edititem']);
			}
			flux['edititem'] = 0;
		},

		/**
		* Move the edit pane
		* param string direction Either 'up' or 'down'
		*/
		editmove: function(dir) {
			if (!flux['edititem']) // Not editing anyway
				return;
			var active = $('.flux #' + flux['edititem']);
			var next;
			switch(dir) {
				case 'up':
					if (active.index() > 0 && (next = $(active.siblings().eq(active.index()-1))) && next.length)
						flux['edit'](next.attr('id'));
					break;
				case 'down':
					if ((next = $(active.siblings().eq(active.index()))) && next.length)
						flux['edit'](next.attr('id'));
					break;
			}
		},

		/**
		* Store this JSON file on the server
		*/
		server_push: function() {
			var json = { nodes: {} };
			$(flux['master']).find('div').each(function(i,e) {
				var item = $(e);
				json['nodes'][item.attr('id')] = {
					'text': item.text(),
					'level': item.data('level'),
					'priority': item.data('priority'),
				};
			});
			$.ajax({
				url: flux['options']['server'],
				dataType: 'json',
				type: 'POST',
				data: {json: JSON.stringify(json)},
				success: function(data) {
					console.log('SUCCESS!');
				},
				error: function(e,xhr,exception) {
					alert('Error while refreshing - ' + xhr.responseText + ' - ' + exception);
				}
			});
		},

		/**
		* Ask the server for a new version of the JSON file
		*/
		server_pull: function() {
			if (flux['edititem']) {
				console.log('Cowardly refusing to refresh while the user is editing');
				return;
			}
			$.ajax({
				url: flux['options']['server'],
				dataType: 'json',
				type: 'POST',
				success: function(json) {
					$(flux['master']).empty();
					$.each(json.nodes, function(id,e) {
						console.log('DISCOVER ' + id);
						flux['add'](0, e.text, {
							id: id,
							priority: e.priority,
							level: e.level
						});
					});
					if (flux['options']['server_refresh'] > 0)
						setTimeout(flux['server_pull'], flux['options']['server_refresh']);
				},
				error: function(e,xhr,exception) {
					alert('Error while refreshing - ' + xhr.responseText + ' - ' + exception);
				}
			});
		},

		/**
		* Get the next unique ID
		* @return string The next unique ID that can be used for created items
		*/
		_uniqueid: function() {
			var tryid;
			while (1) {
				tryid = flux['options']['idprefix'] + flux['nextid']++;
				if ($('#' + tryid).length == 0)
					return tryid;
			}
		}
	};

	$.fn.flux = function(method) {
		if (flux[method]) {
			return flux[method].apply(this, Array.prototype.slice.call(arguments, 1));
		} else if (typeof method === 'object' || ! method) {
			return flux.init.apply(this, arguments);
		} else {
			$.error('Method ' +  method + ' does not exist on for jQuery.FluxTasks');
		}  
	};
});
