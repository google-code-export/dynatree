/*************************************************************************
	jquery.dynatree.js
	Dynamic tree view control, with support for lazy loading of branches.

	Copyright (c) 2008  Martin Wendt (http://wwWendt.de)
	Licensed under the MIT License (MIT-License.txt)

	A current version and some documentation should be available at
		http://www.wwWendt.de/ref/lazytree/

	Let me know, if you find bugs or improvements (martin [@] wwWendt.de).

 	@depends: jquery.js
 	@depends: ui.core.js
*************************************************************************/

/*************************************************************************
 *	Common functions for extending classes etc.
 *	Borrowed from prototype.js
 */
var Class = {
	create: function() {
		return function() {
			this.initialize.apply(this, arguments);
		}
	}
}

/*************************************************************************
 *	Debug funcions
 */
var _bDebug = true;

function logMsg (msg) {
	if ( _bDebug  && window.console ) {
		//	window.console && console.log("%o was toggled", this);
		// see http://michaelsync.net/2007/09/09/firebug-tutorial-logging-profiling-and-commandline-part-i
		var dt = new Date();
		var tag = dt.getHours()+':'+dt.getMinutes()+':'+dt.getSeconds()+'.'+dt.getMilliseconds();
		window.console.log(tag + " - " + msg);
	}
}

/*************************************************************************
 *	DynaTreeNode
 */
var LTNodeStatus_Error   = -1;
var LTNodeStatus_Loading = 1;
var LTNodeStatus_Ok      = 0;

var DynaTreeNode = Class.create();
DynaTreeNode.prototype = {
	initialize: function(tree, data) {
		this.tree    = tree;
		if ( typeof data == 'string' ) {
			this.data = { title: data };
		} else {
			this.data = $.extend({}, $.ui.dynatree.nodedatadefaults, data);
		}
		this.parent  = null; // not yet added to a parent
		this.div     = null; // not yet created
		this.span    = null; // not yet created
		this.aChilds = null; // no subnodes yet
		this.bRead = false; // Lazy content not yet read
		this.bExpanded   = false; // Collapsed by default
	},

	toString: function() {
		return "DynaTreeNode '" + this.data.title + "', key=" + this.data.key;
	},

	getInnerHtml: function() {
		// cache tags
		var ip = this.tree.options.imagePath;

		this.tagFld    = '<img src="' + ip + 'ltFld.gif" alt="" height="16" width="16"/>';
		this.tagFld_o  = '<img src="' + ip + 'ltFld_o.gif" alt="" height="16" width="16"/>';
		this.tagDoc    = '<img src="' + ip + 'ltDoc.gif" alt="" height="16" width="16"/>';
		this.tagL_ns   = '<img src="' + ip + 'ltL_ns.gif" alt="|" height="16" width="16"/>';
		this.tagL_     = '<img src="' + ip + 'ltL_.gif" alt="" height="16" width="16"/>';

		var res = '';

		// parent connectors
		var bIsRoot = (this.parent==null);
		var bHideFirstConnector = ( !this.tree.options.rootVisible || !this.tree.options.rootCollapsible );

		var p = this.parent;
		while ( p ) {
			if ( ! (bHideFirstConnector && p.parent==null ) )
				res = ( p.isLastSibling() ? this.tagL_ : this.tagL_ns) + res ;
			p = p.parent;
		}

		// connector (expanded, expandable or simple
		var imgConnector = null;
		var imgAlt = '';
		var bHasLink = true;
		if ( bHideFirstConnector && bIsRoot  ) {
			// skip connector
			imgConnector = null;
			bHasLink = false;
		} else if ( this.aChilds && this.bExpanded  ) {
			imgConnector = ( this.isLastSibling() ? 'ltM_ne' : 'ltM_nes' );
			imgAlt = '-';
		} else if (this.aChilds) {
			imgConnector = ( this.isLastSibling() ? 'ltP_ne' : 'ltP_nes' );
			imgAlt = '+';
		} else if (this.data.isLazy) {
			imgConnector = ( this.isLastSibling() ? 'ltD_ne' : 'ltD_nes' );
			imgAlt = '?';
		} else {
			imgConnector = ( this.isLastSibling() ? 'ltL_ne' : 'ltL_nes' );
			bHasLink = false;
		}

//		var anchor = '#' + this.key;
		if ( bHasLink )
			res += '<a href="#" onClick="parentNode.ltn.toggleExpand();">';
		if ( imgConnector )
			res += '<img src="' + this.tree.options.imagePath + imgConnector + '.gif" alt="' + imgAlt + '" height="16" width="16" />'
		if ( bHasLink )
			res += '</a>';

		// folder or doctype icon
   		if ( this.data && this.data.icon ) {
    		res += '<img src="' + ip + this.data.icon + '" alt="" height="16" width="16"/>';
		} else if ( this.data.isFolder ) {
	    	res += ( this.bExpanded ? this.tagFld_o : this.tagFld );
		} else {
	    	res += this.tagDoc;
		}
		res += '&nbsp;';

		// node name
		var tooltip = ( this.data && typeof this.data.tooltip == 'string' ) ? ' title="' + this.data.tooltip + '"' : '';
/* 		if ( this.data.isFolder && this.tree.options.selectExpandsFolders && (this.aChilds || this.data.isLazy) ) {
 * 			res +=  '<a href="#" onClick="parentNode.ltn.toggleExpand();"' + tooltip + '>' + this.data.title + '</a>';
 * 		} else if ( !this.data.isFolder ) {
 * 			res +=  '<a href="#" onClick="parentNode.ltn.select();"' + tooltip + '>' + this.data.title + '</a>';
 * 		} else {
 * 			res +=  this.data.title;
 * 		}
 */
		res +=  '<a href="#" ' + tooltip + '>' + this.data.title + '</a>';
		return res;
	},

	_createOrSetDomElement: function() {
		if ( this.div==null ) {
			this.div  = document.createElement ('div');
			this.div.className = 'tnLevelN';

			this.span = document.createElement ('span');
			this.span.className = 'ltNode';
			this.span.ltn = this;
			this.div.appendChild ( this.span );
		} else {
			// simply replace existing span's inner html
		}
		return this.div;
	},

	render: function (bDeep, bHidden) {

		// logMsg('render '+this.title+', expanded='+this.bExpanded + ', aChilds='+(this.aChilds?this.aChilds.length:'0'));
		// --- create <div><span>..</span></div> tags for this node
		if ( ! this.span ) {
			this._createOrSetDomElement();
			if ( this.parent )
				this.parent.div.appendChild ( this.div );
			this.span.className = ( this.data.isFolder ? 'ltFolder' : 'ltDocument' );
		}
		// hide root?
		if ( this.parent==null )
			this.span.style.display = ( this.tree.options.rootVisible ? '' : 'none');
		// hide this node, if parent is collapsed
		this.div.style.display = ( this.parent==null || this.parent.bExpanded ? '' : 'none');

		// set node connector images, links and text
		this.span.innerHTML = this.getInnerHtml();

		if ( bDeep && (this.aChilds != null ) && (bHidden || this.bExpanded) ) {
			for (var i=0; i<this.aChilds.length; i++) {
				this.aChilds[i].render (bDeep, bHidden)
			}
		}
	},

	isLastSibling: function() {
		var p = this.parent;
		if ( !p ) return true;
		return p.aChilds[p.aChilds.length-1] == this;
	},

	prevSibling: function() {
		if( !this.parent ) return null;
		var ac = this.parent.aChilds;
		for(var i=1; i<ac.length; i++) // start with 1, so prev(first) = null
			if( ac[i] === this )
				return ac[i-1];
		return null;
	},

	nextSibling: function() {
		if( !this.parent ) return null;
		var ac = this.parent.aChilds;
		for(var i=0; i<ac.length-1; i++) // up to length-2, so next(last) = null
			if( ac[i] === this )
				return ac[i+1];
		return null;
	},

	_setStatusNode: function(data) {
		// Create, modify or remove the status child node (pass 'null', to remove it).
		var firstChild = ( this.aChilds ? this.aChilds[0] : null );
		if( !data ) {
			if ( firstChild ) {
				this.div.removeChild(firstChild.div);
				if( this.aChilds.length == 1 )
					this.aChilds = null;
				else
					this.aChilds.shift();
			}
		} else if ( firstChild ) {
			firstChild.data = data;
			firstChild.render (false, false);
		} else {
			firstChild = this._addChildNode (new DynaTreeNode (this.tree, data));
			firstChild.data.isStatusNode = true;
		}
	},

	setLazyNodeStatus: function (lts) {
		switch( lts ) {
			case LTNodeStatus_Ok:
				this._setStatusNode(null);
				this.bRead = true;
				this.focus();
				break;
			case LTNodeStatus_Loading:
				this._setStatusNode({
					title: this.tree.options.strings.loading,
					icon: "ltWait.gif"
				});
				break;
			case LTNodeStatus_Error:
				this._setStatusNode({
					title: this.tree.options.strings.loadError,
					icon: "ltError.gif"
				});
				break;
			default:
				throw "Bad LazyNodeStatus: '" + lts + "'.";
		}
	},

	select: function() {
		if( this.tree.isDisabled || this.data.isStatusNode )
			return;
		this.tree.tnSelected = this;
		if ( this.tree.options.onSelect )
			this.tree.options.onSelect(this);
	},

	focus: function() {
		$(this.span).find(">a").focus();
	},

	_expand: function (bExpand) {
		if ( this.bExpanded == bExpand )
			return;
		this.bExpanded = bExpand;
		// expanding a lazy node: set 'loading...' and call callback
		if ( bExpand && this.data.isLazy && !this.bRead ) {
			try {
				this.setLazyNodeStatus(LTNodeStatus_Loading);
				if( true == this.tree.options.onLazyRead(this) ) {
					// If function returns 'true', we assume that the loading is done:
					this.setLazyNodeStatus(LTNodeStatus_Ok);
					// Otherwise (i.e. if the loading was started as an asynchronous process)
					// the onLazyRead(tn) handler is expected to call tn.setLazyNodeStatus(LTNodeStatus_Ok/_Error) when done.
				}
			} catch(e) {
				this.setLazyNodeStatus(LTNodeStatus_Error);
			}
			return;
		}
		// render expanded nodes
		this.render (true, false);
		// we didn't render collapsed nodes, so we have to update the visibility of direct childs
		if ( this.aChilds ) {
			for (var i=0; i<this.aChilds.length; i++) {
				this.aChilds[i].div.style.display = (this.bExpanded ? '' : 'none');
			}
		}
	},

	toggleExpand: function() {
		logMsg('toggleExpand ('+this.data.title+')...');
		this._expand ( ! this.bExpanded);
		// auto-collapse mode
		if ( this.bExpanded && this.parent && this.tree.options.autoCollapse ) {
			var ac = this.parent.aChilds;
			for (var i=0; i<ac.length; i++) {
				if ( ac[i]!=this )
					ac[i]._expand (false);
			}
		}
		logMsg('toggleExpand ('+this.data.title+') done.');
	},
/*
	_cbHide: function (tn) {
		tn.div.style.display = 'none';
	},
	_cbShow: function (tn) {
		tn.div.style.display = '';
	},
	showChilds: function (bShow) {
		// don't recurse, because div tags are nested anyway
		this.visit (bShow ? this._cbShow : this._cbHide, false, false);
	},
	visit: function (cb, bSelf, bDeep) { // TODO: better name: each(fn)
		var n = 0;
		if ( bSelf ) { cb (this); n++; }
		if ( this.aChilds ) {
			for (var i=0; i<this.aChilds.length; i++) {
				if ( bDeep ) {
					n += this.aChilds[i].visit (cb, true, bDeep);
				} else {
					cb (this.aChilds[i]);
					n++;
				}
			}
		}
		return n;
	},
*/
	collapseSiblings: function() {
		if ( this.parent==null )
			return;
		var ac = this.parent.aChilds;
		for (var i=0; i<ac.length; i++) {
			if ( ac[i]!=this && ac[i].bExpanded )
				ac[i].toggleExpand();
		}
	},

	onClick: function(event) {
		/*
		this is the <div> element
		event:.target: <a>
		event.type: 'click'
			.which: 1
			.shiftKey: false, .ctrlKey:  false, . metaKey: false
			.buton: 0
			. currentTargte: div#tree
		*/
		logMsg(event.type + ": tn:" + this + ", button:" + event.button + ", which: " + event.which);

		if ( this.data.isFolder && this.tree.options.selectExpandsFolders && (this.aChilds || this.data.isLazy) ) {
			this.toggleExpand();
		} else if ( !this.data.isFolder ) {
			this.select();
		}
		// Make sure that clicks stop
		return false;
	},

	onKeypress: function(event) {
		/*
		this is the <div> element
		event:.target: <a>
		event.type: 'keypress'
			.which: 1
			.shiftKey: false, 	.ctrlKey:  false, 	. metaKey: false
			.charCode:  '+':43, '-':45, '*':42, '/':47, ' ':32
			.keyCode:   left:37, right:39, up:38 , down: 40, <Enter>:13
			. currentTargte: div#tree
		*/
		logMsg(event.type + ": tn:" + this + ", charCode:" + event.charCode + ", keyCode: " + event.keyCode + ", " + event.which);
		var code = ( ! event.charCode ) ? 1000+event.keyCode : event.charCode;
		var handled = true;

		switch( code ) {
			// charCodes:
			case 43: // '+'
				if( !this.bExpanded ) this.toggleExpand();
				break;
			case 45: // '-'
				if( this.bExpanded ) this.toggleExpand();
				break;
			//~ case 42: // '*'
				//~ break;
			//~ case 47: // '/'
				//~ break;
			case 32: // <space>
				this.select();
				break;
			// keyCodes
			case 1008: // <backspace>
				if( this.parent )
					this.parent.focus();
				break;
			case 1037: // <left>
				if( this.bExpanded ) {
					this.toggleExpand();
					this.focus();
				} else if( this.parent ) {
					this.parent.focus();
				}
				break;
			case 1039: // <right>
				if( !this.bExpanded && (this.aChilds || this.data.isLazy) ) {
					this.toggleExpand();
					this.focus();
				} else if( this.aChilds ) {
					this.aChilds[0].focus();
				}
				break;
			case 1038: // <up>
				var sib = this.prevSibling();
				while( sib && sib.bExpanded )
					sib = sib.aChilds[sib.aChilds.length-1];
				if( !sib && this.parent )
					sib = this.parent;
				if( sib ) sib.focus();
				break;
			case 1040: // <down>
				var sib;
				if( this.bExpanded ) {
					sib = this.aChilds[0];
				} else if( this.parent && this.isLastSibling() ) {
					sib = this.parent.nextSibling();
				} else {
					sib = this.nextSibling();
				}
				if( sib ) sib.focus();
				break;
			//~ case 1013: // <enter>
				//~ this.select();
				//~ break;
			default:
				handled = false;
		}
		if( handled )
			return false;
	},

	onFocus: function(event) {
		// Handles blur and focus events.
		logMsg(event.type + ": tn:" + this);
		if ( event.type=="blur" || event.type=="focusout" ) {
			if ( this.tree.options.onBlur )
				this.tree.options.onBlur(this);
			this.tree.tnFocused = null;
		} else if ( event.type=="focus" || event.type=="focusin") {
			this.tree.tnFocused = this;
			if ( this.tree.options.onFocus )
				this.tree.options.onFocus(this);
		}
		// TODO: return anything?
//		return false;
	},

	_addChildNode: function (tn) {
		logMsg ('addChild '+tn);
		if ( this.aChilds==null )
			this.aChilds = new Array();
		this.aChilds.push (tn);
		tn.parent = this;

		if ( this.tree.options.expandOnAdd || ( (!this.tree.options.rootCollapsible || !this.tree.options.rootVisible) && this.parent==null ) )
			this.bExpanded = true;
		if ( this.tree.bEnableUpdate )
			this.render (true, false);
		return tn;
	},
	addNode: function(data) {
		var tn = new DynaTreeNode (this.tree, data);
		return this._addChildNode(tn);
	},
	addObject: function(obj) {
		/*
		Data format: array of node objects, with optional 'children' attributes.
		[
			{ title: "t1", isFolder: true, ... }
			{ title: "t2", isFolder: true, ...,
				children: [
					{title: "t2.1", ..},
					{..}
					]
			}
		]
		A simple object is also accepted instead of an array.
		*/
		if( !obj ) return;
		if( !obj.length ) return this.addNode(obj);
		for (var i=0; i<obj.length; i++) {
			var data = obj[i];
			var tn = this.addNode(data);
			if( data.children )
				for(var j=0; j<data.children.length; j++)
					tn.addObject(data.children[j]);
		}
		return;
	},

	addJson: function(json) {
		return this.addObject(eval("(" + json + ")"));
	},
	// --- end of class
	lastentry: undefined
}

/*************************************************************************
 * DynaTree
 */
var DynaTree = Class.create();
DynaTree.prototype = {
	// static members
	version: '0.3 alpha 3',
	// constructor
	initialize: function (id, options) {
		logMsg ("DynaTree.initialize()");
		// instance members
		this.options = options;

		this.tnSelected    = null;
		this.bEnableUpdate = true;
		this.isDisabled = false;

		// find container element
		this.divTree   = document.getElementById (id);
		// create the root element
		this.tnRoot    = new DynaTreeNode (this, {title: this.options.title, key:"root"});
		this.tnRoot.data.isFolder   = true;
		this.tnRoot.render(false, false);
		this.divRoot   = this.tnRoot.div;
		this.divRoot.className = "lazyTree";
		// add root to container
		this.divTree.appendChild (this.divRoot);
	},
	// member functions
	toString: function() {
		return "DynaTree '" + this.options.title + "'";
	},
	redraw: function() {
		logMsg("redraw...");
		this.tnRoot.render(true, false);
		logMsg("redraw done.");
	},
	getRoot: function (tn) {
		return this.tnRoot;
	},
	enableUpdate: function (bEnable) {
		if ( this.bEnableUpdate==bEnable )
			return bEnable;
		this.bEnableUpdate = bEnable;
		if ( bEnable )
			this.redraw();
		return !bEnable; // return prev. value
	},
	// --- end of class
	lastentry: undefined
};

/*************************************************************************
	jquery.dynatree.js
	Dynamic HTML tree, with support for lazy loading of branches.

 *************************************************************************/


(function($) {

function fnClick(event) {
	var tn = event.target.parentNode.ltn;
	return tn.onClick(event);
}

function fnKeyHandler(event) {
	// Handles keydown and keypressed, because IE and Safari don't fire keypress for cursor keys.
	var tn = event.target.parentNode.ltn;
	// ...but Firefox does, so ignore them:
	if( event.type == "keypress" && event.charCode == 0 )
		return;
	return tn.onKeypress(event);
}

function fnFocusHandler(event) {
	// Handles blur and focus.
	var tn = event.target.parentNode.ltn;
	return tn.onFocus(event);
}
function fnFocusHandlerIE() {
	// Handles blur and focus.
	var event = window.event;
//	alert (event.type + ": src=" + event.srcElement + ", to=" + event.toElement);
//	var el = (event.type=="focusin") ? event.toElement : event.srcElement;
//	var el = (event.toElement) ? event.toElement : event.srcElement;
	var tn = event.srcElement.parentNode.ltn;
	// TODO: use jQuery.event.fix() to make a compatible event object
//	alert (event.type + ": " + tn);
	return tn.onFocus(event);
}


$.widget("ui.dynatree", {
	init: function() {
		// The widget framework supplies this.element and this.options.
		this.options.event += '.dynatree'; // namespace event

		// create lazytree
		var $this = this.element;
		var opts = this.options;

		// Attach the tree object to parent element
		var id = $this.attr("id");
		this.tree = new DynaTree(id, opts);
		var root = this.tree.getRoot()

		// Guess skin path, if not specified
		if(!opts.imagePath) {
			$("script").each( function () {
				if(this.src.toString().match(/jquery.dynatree.js$/)) {
					opts.imagePath = this.src.toString().replace("jquery.dynatree.js", "skin/");
					logMsg("Fixed imagePath: " + opts.imagePath);
				}
			});
		}
		// Init tree from UL tag
		if( opts.initObject ) {
			root.addObject(opts.initObject);
		} else if( opts.initId ) {
			this.createFromTag(root, $("#"+opts.initId));
		} else {
			var $ul = $this.find(">ul").hide();
			this.createFromTag(root, $this.find(">ul"));
		}
		// bind event handlers
		$this.bind("click", fnClick);
		if( opts.keyboard ) {
//			$this.bind("keypress", fnKeypress);
			$this.bind("keypress keydown", fnKeyHandler);

			// focus/blur don't bubble, i.e. are not delegated to enclosing <div> tags.
			// so we use the addEventListener capturing phase
			// see http://www.howtocreate.co.uk/tutorials/javascript/domevents
//			$this.bind("focus blur", fnFocusHandler);
			var div = this.tree.divTree;
			if( div.addEventListener ) {
				div.addEventListener("focus", fnFocusHandler, true);
				div.addEventListener("blur", fnFocusHandler, true);
			} else {
//				alert("regofi");
				div.onfocusin = div.onfocusout = fnFocusHandlerIE;
			}
			if( opts.focusRoot )
				root.focus();
		}
	},

	// --- getter methods (i.e. NOT returning a reference to $)
	getTree: function() {
		return this.tree;
	},

	getRoot: function() {
		return this.tree.getRoot();
	},

	// --- Private methods
	createFromTag: function(parentTreeNode, $ulParent) {
		// Convert a <UL>...</UL> list into children of the parent tree node.
		var self = this;
		$ulParent.find(">li").each(function() {
			var $li = $(this);
			var $liSpan = $li.find(">span:first");
			var title;
			if( $liSpan.length ) {
				// If a <li><span> tag is specified, use it literally.
				title = $liSpan.html();
			} else {
				// If only a <li> tag is specified, use the trimmed string excluding child <ul> tags.
				title = $.trim($li.html().match(/.*(<ul)?/)[0]);
//				title = $.trim($li.html().match(/[^<]*/)[0]);
//				title = $.trim($li.html().match(/\s*([^<]*)<ul/)[0]);
//				title = $.trim($li.html().match(/(.*)([<ul])|$/i)[0]);
			}
			// Parse node attributes data from data="" attribute
			var data = {
				title: title,
				key: $li.attr("id"),
				isFolder: $li.hasClass("folder"),
				isLazy: $li.hasClass("lazy")
			};
			var dataAttr = $.trim($li.attr("data"));
			if( dataAttr ) {
				if( dataAttr[0] != "{" )
					dataAttr = "{" + dataAttr + "}"
				try{
					$.extend(data, eval("(" + dataAttr + ")"));
				} catch(e) {
					throw ("Error parsing node data: " + e + "\ndata:\n'" + dataAttr + "'");
				}
			}
			childNode = parentTreeNode.addNode(data);
			// Recursive reading of child nodes, if LI tag contains an UL tag
			var $ul = $li.find(">ul:first");
			if( $ul.length ) {
				if( data.expanded )
					childNode.bExpanded = true;
				self.createFromTag(childNode, $ul); // must use 'self', because 'this' is the each() context
			}
		});
	},

	// ------------------------------------------------------------------------
	lastentry: undefined
});


// The following methods return a value (thus breaking the jQuery call chain):

$.ui.dynatree.getter = "getTree getRoot";


// Plugin default options:

$.ui.dynatree.defaults = {
	title: "dynatree", // Name of the root node
	rootVisible: false, // Set to true, to make the root node visible
	rootCollapsible: false, // TODO: minExpandLevel: 1,
	initId: null, // Init tree structure from a <ul> element with this ID.
	initObject: null, // Init tree structure from this object array.
	focusRoot: true, // Set focus to root node on init.
	keyboard: true, // Support keyboard navigation.
	onSelect: null, // Callback when a node is selected.
	onLazyRead: null, // Callback when a lazy node is expanded for the first time.
	onFocus: null, // Callback when a node receives keyboard focus.
	onBlur: null, // Callback when a node looses focus.
	imagePath: undefined, //"skin/", // Folder containing icons used.
//	expandLevel: 1, // Expand all branches until level i (set to 0 to )
	autoCollapse: false, // Automatically collapse all siblings, when a node is expanded.
//	persist: "cookie",
	expandOnAdd: false, // Automatically expand parent, when a child is added.
	selectExpandsFolders: true, // Clicking a folder title expands the folder, instead of selecting it.
//	fx: null, // Animations, e.g. { height: 'toggle', opacity: 'toggle', duration: 200 }
	strings: {
		loading: "Loading&#8230;",
		loadError: "Load error!"
	},
	classnames: {
		container: "ui-dynatree-container",
		hidden: "ui-dynatree-hidden",
//		nav: "ui-dynatree-nav", // Hidden when printed or
		disabled: "ui-dynatree-disabled",
		selected: "ui-dynatree-selected",
		folder: "ui-dynatree-folder",
		focused: "ui-dynatree-focused",
		loading: "ui-dynatree-loading"
	},
	debugLevel: 0,

	// ### copied from ui.tabs
	// basic setup
//	cookie: null, // e.g. { expires: 7, path: '/', domain: 'jquery.com', secure: true }
	// TODO history: false,

	// Ajax
	//~ cache: false,
	//~ idPrefix: 'ui-dynatree-',
	//~ ajaxOptions: {},


	// templates
	//~ tabTemplate: '<li><a href="#{href}"><span>#{label}</span></a></li>', // 		var $li = $(o.tabTemplate.replace(/#\{href\}/g, url).replace(/#\{label\}/g, label));
	//~ panelTemplate: '<div></div>'
	// ------------------------------------------------------------------------
	lastentry: undefined
};

/**
 * Reserved data attributes for a tree node.
 */
$.ui.dynatree.nodedatadefaults = {
	title: undefined, // (required) Name of the root node (html is allowed here)
	key: undefined, // May be used with select(), find(), ...
	isFolder: false, // Use a folder icon. Also the node is expandable but not selectable.
	isLazy: false, // Call tree.options.onLazyRead() when the node is expanded for the first time to allow for delayed creation of children.
	expanded: false, // Passed as <li data="expanded: true">.
	tooltip: undefined, // Show this popup text.
	icon: undefined, // Use a custom image (filename relative to tree.options.imagePath)
	children: undefined, // Array of child node dictionaries.
	// NOTE that it is possible to add any custom attributes to this data object.
	// This may then also be used in the onSelect() or on onLazyTree() callbacks.
	// ------------------------------------------------------------------------
	lastentry: undefined
};


// ---------------------------------------------------------------------------
})(jQuery);
