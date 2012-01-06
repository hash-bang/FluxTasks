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
		* The item id currently being edited by the user
		* @access private
		*/
		edititem: 0,

		/**
		* Options storage hash
		* @var array
		* @access private
		*/
		options: {
			idprefix: 'flux-', // What prefix to use when randomly generating IDs
			idselector: '.flux #', // What prefix to use when identifying an ID
			server: 'php/file.php',
			server_refresh: 0, // How often should data be loaded? Set to 0 to disable
			image_path: 'flux/images/', // Location of image files. Must end in '/'
			readonly: 0 // Dont allow any editing (implies turning off all shortcuts and editing events)
		},

		/**
		* Initalize Flux
		*/
		init: function(options) {
			flux['options'] = $.extend(flux['options'], options);

			flux['master'] = this;
			$(this).empty();
			if (!flux['options']['readonly']) { // Can edit...
				// Shortcut keys
				shortcut.add('tab', function() { if (flux['edititem']) flux['demote'](flux['edititem']); }); // In-place demotion via tab
				shortcut.add('shift+tab', function() { if (flux['edititem']) flux['promote'](flux['edititem']); }); // In-place promotion via shift+tab
				shortcut.add('escape', function() { if (flux['edititem']) flux['unedit'](flux['edititem']); }); // Escape edit mode
				shortcut.add('down', function() { if (flux['edititem']) flux['editmove']('down'); }); // Select next node for edit
				shortcut.add('up', function() { if (flux['edititem']) flux['editmove']('up'); }); // Select previous node for edit
				shortcut.add('ctrl+up', function() { if (flux['edititem']) flux['priority'](flux['edititem'], 'up'); }); // Move priority up
				shortcut.add('ctrl+down', function() { if (flux['edititem']) flux['priority'](flux['edititem'], 'down'); }); // Move priority down
				shortcut.add('enter', function() { if (flux['edititem']) var childid = flux['add'](flux['edititem'], '', {edit: 1}); }); // Create new child

				shortcut.add('f8', flux['push']); // Quick save
				shortcut.add('f9', flux['pull']); // Quick load
				shortcut.add('f2', flux['_checktree']); // FIXME: Debugging

				// Menus
				$.contextMenu({
					selector: '.flux .flux-node', 
					items: {
						"edit": {name: "Edit", icon: "edit", callback: function() { flux['edit']($(this).attr('id')) }},
						"add-child": {name: "Add sub-item", icon: "add-child", callback: function() { flux['add']($(this).attr('id'), '', {position: 'under', edit: 1}) }},
						"add-next": {name: "Add next", icon: "add-next", callback: function() { flux['add']($(this).attr('id'), '', {position: 'after', edit: 1}) }},
						"sep1": "---------",
						"promote": {name: "Promote", icon: "promote", callback: function() { flux['promote']($(this).attr('id')) }},
						"demote": {name: "Demote", icon: "demote", callback: function() { flux['demote']($(this).attr('id')) }},
						"sep2": "---------",
						"priority": {name: "Set priority", items: {
							"priority-0": {name: 'No priority', icon: 'priority-0', callback: function() { flux['priority']($(this).attr('id'), 0) }},
							"priority-sep": "---------",
							"priority-5": {name: 'Highest priority', icon: 'priority-5', callback: function() { flux['priority']($(this).attr('id'), 5) }},
							"priority-4": {name: 'High priority', icon: 'priority-4', callback: function() { flux['priority']($(this).attr('id'), 4) }},
							"priority-3": {name: 'Normal priority', icon: 'priority-3', callback: function() { flux['priority']($(this).attr('id'), 3) }},
							"priority-2": {name: 'Low priority', icon: 'priority-2', callback: function() { flux['priority']($(this).attr('id'), 2) }},
							"priority-1": {name: 'Lowest priority', icon: 'priority-1', callback: function() { flux['priority']($(this).attr('id'), 1) }},
						}},
						"remove": {name: "Remove", icon: "remove", callback: function() { flux['remove']($(this).attr('id')) }},
					}
				});
			}
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
			var parent = parent_id ? $(flux['options']['idselector'] + parent_id) : $(this);
			var child = $('<div class="flux-node"/>');
			if (opt['level'] == -1) { // Figure out the level
				if (parent_id) { // From the parent?
					if (opt['position'] == 'under') {
						opt['level'] = parent.data('level') + 1;
						flux['_setbranch'](parent.attr('id'), 1);
					} else
						opt['level'] = parent.data('level');
				} else
					opt['level'] = 0;
			}
			child
				.data('level', opt['level'])
				.data('priority', opt['priority'])
				.attr('id', opt['id'])
				.addClass('nest-' + opt['level'])
				.addClass('priority-' + opt['priority'])
				.html(flux['_construct'](child, text));
			flux['_setbranch'](child, 0);
			if (!flux['options']['readonly'])
				child.click(function(){flux['edit']($(this).attr('id'));});
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
		* Set whether a given node is actually a branch
		* @param string|obj id Either the ID of the object to set the branch state of or the jQuery object
		* @param bool state The boolean status of whether this item is a branch
		*/
		_setbranch: function(id, state) {
			var item = (typeof id == 'object') ? id : $(flux['options']['idselector'] + id);
			if (state) {
				item.addClass('flux-branch');
				item.removeClass('flux-leaf');
			} else {
				item.addClass('flux-leaf');
				item.removeClass('flux-branch');
			}
		},

		/**
		* Recheck the entire tree struture for branches
		*/
		_checktree: function() {
			var lastlevel = 0;
			var lastobj;
			flux['master'].find('.flux-node').each(function(i,o) {
				var obj = $(o);
				flux['_setbranch'](lastobj, obj.data('level') > lastlevel)
				lastlevel = obj.data('level');
				lastobj = obj;
			});
		},

		/**
		* Apply meta styles to a list item
		* @param string The ID of the item to style
		*/
		style: function(id) {
			var item = $(flux['options']['idselector'] + id);
			var itext = item.find('.flux-title').text();
			item.removeClass('style-heading style-spacer');
			if (itext == '-') {
				item.addClass('style-spacer');
				item.find('.flux-title').html('<span>-</span>');
			} else if (itext.substr(0,1) == '!') {
				item.addClass('style-heading');
				item.find('.flux-title').html('<span>!</span>' + itext.substr(1));
			}
		},

		/**
		* Construct the HTML of a list item
		*/
		_construct: function(node, title) {
			var priority = node.data('priority');
			var leveling = '';
			var level = node.data('level');
			for (var l = 1; l < level + 1; l++) {
				leveling += '<div class="flux-bullet-nest-' + l + '"></div>';
			}
			return '<div class="flux-priority">' + (priority > 0 ? '<img src="' + flux['options']['image_path'] + 'priorities/' + priority + '.png"/>' : '') + '</div><div class="flux-main">' + leveling + '<div class="flux-bullet"></div><div class="flux-title">' + title + '</div></div><div class="flux-date"></div>';
		},

		/**
		* Remove a given node by its ID
		* param string id The id of the item to remove
		*/
		remove: function(id) {
			$(flux['options']['idselector'] + id).remove();
			flux['_checktree']();
		},

		/**
		* Demote a given node
		* param string id The id of the item to demote
		*/
		demote: function(id) {
			var item = $(flux['options']['idselector'] + id);
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
		* param string id The item to promote
		*/
		promote: function(id) {
			var item = $(flux['options']['idselector'] + id);
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
		* param string id The id of the item to adjust the priority of
		* param int|string value Either values 0-5, 'up' or 'down'
		*/
		priority: function(id, value) {
			var item = $(flux['options']['idselector'] + id);
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
			item.find('.flux-priority').html(newpri > 0 ? '<img src="' + flux['options']['image_path'] + 'priorities/' + newpri + '.png"/>' : '');
		},

		/**
		* Edit a given item
		* param string id The id of the item to edit
		*/
		edit: function(id) {
			var item = $(flux['options']['idselector'] + id);
			if (flux['edititem'] == item.attr('id')) // Trying to edit the same item twice
				return;
			if (flux['edititem']) { // Already editing - release first
				flux['unedit'](flux['edititem']);
			}

			var editpane = $('<div id="edit"></div');
			flux['edititem'] = item.attr('id');
			var editbox = $('<input type="text" class="edit"/>');
			editbox
				.appendTo(editpane)
				.val(item.find('.flux-title').text())
				.blur(flux['unedit']);
			item.addClass('editing');
			item.find('.flux-title').html(editpane);
			editbox.focus();
		},

		/**
		* Release edit mode
		*/
		unedit: function() {
			if (!flux['edititem']) // Not editing anyway
				return;
			var editbox = $(flux['options']['idselector'] + flux['edititem'] + ' .flux-title input');
			var newval = $.trim(editbox.val());
			if (!newval) {
				flux['remove'](flux['edititem']);
			} else {
				var item = $(flux['options']['idselector'] + flux['edititem']);
				item.removeClass('editing');
				item.find('.flux-title').html(newval);
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
			var active = $(flux['options']['idselector'] + flux['edititem']);
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
		push: function() {
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
		pull: function() {
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
						setTimeout(flux['pull'], flux['options']['server_refresh']);
					flux['_checktree']();
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
