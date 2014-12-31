/*
	@licstart  The following is the entire license notice for the JavaScript 
	code in this file.
	
	Copyright (C) 2014 Mattia Basaglia

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>.
	
	
	@licend  The above is the entire license notice for the JavaScript 
	code in this file.
*/
"use strict";

var luna_settings = {
	framerate  :      60, // frames per second
	moon_speed :      12, // pixels / frame * image_resize_factor
	moon_size  :     1.5, // multiplier
	media      :"media/", // path/prefix
	z_index    :       1, // base z-index 
	image_type :   'svg', // svg or png
	shadow: {
		move   : 1/3, // multiplier
		opacity: 0.5, // alpha
	},
	star: {
		number       :  48,  // number of stars
		size         :  64,  // pixels
		fade_speed   :   8,  // pixels(distance) / 10ms
		twinkle_speed:   3,  // pixels(distance) / 10ms
		core: {
			fade_distance: 256, // distance in pixels
			min_alpha    : 0.4,
			max_alpha    : 1,
		},
		glow: { 
			fade_distance: 256, // distance in pixels
			min_alpha    : 0,
			max_alpha    : 1,
		},
		streak: { 
			fade_distance: 128, // distance in pixels
			min_alpha    : 0,
			max_alpha    : 0.8,
		},
	},
	svg: {
		star_scale_min: 0.5, // multiplier
		star_scale_max: 2.5, // multiplier
		star_scale_inc: 0.1, // multiplier increase
		star_orbit    :   2, // increase in degree / frame
		star_spin     :   5, // increase in degree / frame
	},
};

function LunaSettings(change) {
	var settings = {};
	for (var key in luna_settings)
		settings[key] = luna_settings[key];
	for (var key in change)
		settings[key] = change[key];
	return settings;
}

function SvgNsResolver(prefix) {
	var xmlns = {
		rdf  : "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
		cc   : "http://creativecommons.org/ns#",
		xlink: "http://www.w3.org/1999/xlink",
		dc   : "http://purl.org/dc/elements/1.1/",
		svg  : "http://www.w3.org/2000/svg"
	};
	return xmlns[prefix] || null;
}

function Luna(element, settings) {
	
	// Evaluates the alpha of a star component
	this.StarAlpha = function (settings, distance) {
		var alpha = 1 - Math.min(1,distance/settings.fade_distance);
		return settings.min_alpha + (settings.max_alpha-settings.min_alpha) * alpha;
	};

	// Resizes Luna to fit in the window
	this.EventResize = function () {
		var luna_box = this.luna.getBoundingClientRect();
		if (this.luna.image_type == 'svg') {
			this.luna.x = luna_box.left;
			this.luna.y = luna_box.top;
		}
		
		this.area = element.getBoundingClientRect();
		var wratio = this.area.width / this.luna.naturalWidth;
		var hratio = (this.area.height-this.luna.y) / this.luna.naturalHeight;
		this.imgratio = Math.min(wratio,hratio,1);
		
		var width = this.luna.naturalWidth * this.imgratio;
		var x = (this.area.width - width) / 2;
		this.luna.style.width = width + 'px';
		this.luna.style.height = 'auto';
		this.luna.style.left = x + "px";
		if (this.luna.image_type == 'svg') {
			this.luna.width = width;
			this.luna.height = Math.round(this.luna.naturalHeight * this.imgratio);
			this.luna.x = x;
		}
		this.luna.client_x = this.luna.x + this.luna.width/2;
		this.luna.client_y = this.luna.y + this.luna.height/2;
		
		
		this.shadow.style.width = width + "px";
		this.shadow.style.height = width/3 + "px";
		
		this.imgratio = Math.min(1,this.imgratio*this.settings.moon_size);
		this.moon.style.width = Math.round(this.moon.naturalWidth * this.imgratio) + 'px';
		this.moon.restingpos = {
			x: this.luna.client_x - this.moon.width/2,
			y: this.luna.client_y - this.moon.height/2
		};
	}

	// Interact with the mouse
	this.EventMouseMove = function (event) {
		var dx = (this.area.left + this.luna.client_x - event.clientX);
		var dy = (this.area.top + this.luna.client_y - event.clientY);
		this.moon.targetpos = { x : this.moon.restingpos.x + dx, y : this.moon.restingpos.y + dy };
		
		for(var s in this.stars) {
			var box = this.stars[s].getBoundingClientRect();
			dx = box.left + box.width / 2 - event.clientX;
			dy = box.top + box.height / 2 - event.clientY;
			this.stars[s].star_target = Math.min(Math.sqrt(dx*dx+dy*dy), this.settings.star.max_fade);
			this.stars[s].star_speed = this.settings.star.fade_speed;
		}
	}
	
	// Calculates scaling factor for a svg mane/tail star
	this.SvgStarScale = function() {
		return Math.random() * 
			(this.settings.svg.star_scale_max - this.settings.svg.star_scale_min) +
			this.settings.svg.star_scale_min;
	}
	
	// Initializes interactions once the media have been loaded
	// For each call of this.Ready() there should be a 
	// this.loading++ in the appropriate location
	this.Ready = function() {
		this.loading--;
		if (!this.loading) {
			this.EventResize();
			
			this.moon.style.left = this.moon.restingpos.x+'px';
			this.moon.style.top = this.area.height+'px';
			this.moon.targetpos = { x: this.moon.restingpos.x, y: this.moon.restingpos.y };
			
			this.moon.style.visibility = 'visible';
			this.shadow.style.visibility = 'visible';
			this.luna.style.visibility = 'visible';
			
			if (this.luna.image_type == 'svg') {
				var snapshot = document.evaluate(
					'//svg:use[@xlink:href="#star_original"]', 
					this.luna.svg, SvgNsResolver, 
					XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null );
				
				this.mane_stars = [];
				for (var i = 0; i < snapshot.snapshotLength; i++) {
					var mane_star = snapshot.snapshotItem(i);
					
					var old_matrix = mane_star.transform.baseVal[0].matrix;
					mane_star.transform.baseVal.clear();
					
					var translate = this.luna.svg.createSVGTransform();
					translate.setTranslate(old_matrix.e,old_matrix.f);
					mane_star.transform.baseVal.appendItem(translate);
					
					
					var orbit = this.luna.svg.createSVGTransform();
					orbit.setRotate(Math.random()*360,0,0);
					mane_star.transform.baseVal.appendItem(orbit);
					
					var scale = this.luna.svg.createSVGTransform();
					var scale_factor = this.SvgStarScale();
					scale.setScale(scale_factor,scale_factor);
					mane_star.transform.baseVal.appendItem(scale);
					
					
					var spin = this.luna.svg.createSVGTransform();
					spin.setRotate(Math.random()*360,0,0);
					mane_star.transform.baseVal.appendItem(spin);
					
					mane_star.scale = {
						transform: scale,
						speed    : (Math.round(Math.random())*2-1) * this.settings.svg.star_scale_inc,
						factor   : scale_factor
					};
					
					mane_star.rotate = {
						orbit      : orbit,
						orbit_speed: (Math.random()*2-1)*this.settings.svg.star_orbit,
						spin       : spin,
						spin_speed : (Math.random()*2-1)*this.settings.svg.star_spin,
					};
					
					this.mane_stars.push(mane_star);
					
					
				}
			}
			
			// events
			setInterval(this.Step.bind(this), 1000/this.settings.framerate);
			window.addEventListener("resize",this.EventResize.bind(this));
			this.parent.addEventListener("mousemove",this.EventMouseMove.bind(this));
			this.parent.addEventListener("mouseleave",this.EventMouseLeave.bind(this));
		}
	}

	// Executes a frame
	this.Step = function() {
		var dx = this.moon.targetpos.x - this.moon.x;
		var dy = this.moon.targetpos.y - this.moon.y;
		var speed = this.settings.moon_speed*this.imgratio;
		var len = Math.sqrt(dx*dx+dy*dy);
		var angle = Math.atan2(dy,dx);
		var next_pos = { x: this.moon.targetpos.x, y : this.moon.targetpos.y };
		
		// TODO handle case in which the moon is far away
		if ( Math.abs(len) > speed ) {
			next_pos.x = this.moon.x + Math.cos(angle)*speed;
			next_pos.y = this.moon.y + Math.sin(angle)*speed;
		} else {
			next_pos.x = this.moon.targetpos.x;
			next_pos.y = this.moon.targetpos.y;
		}

		this.moon.style.left = (next_pos.x)+'px';
		this.moon.style.top = (next_pos.y)+'px';
		
		var shadow_box = this.shadow.getBoundingClientRect();
		/*var shadow_hfactor = 1/3;
		if (next_pos.y < this.moon.restingpos.y) {
			dy = (this.moon.restingpos.y - next_pos.y) / (this.area.height/2);
			shadow_hfactor = shadow_hfactor * (1-dy) + 1/9 * dy;
		}
		shadow_box.height = shadow_box.width * shadow_hfactor;
		this.shadow.style.height = shadow_box.height + "px";*/
		
		var shadow_target = { x: 0, y:0 };
		shadow_target.y = this.luna.client_y +  this.luna.height/2
		shadow_target.x = this.luna.client_x;
		
		dx = this.moon.restingpos.x - next_pos.x;
		var shadow_max = this.settings.shadow.move * shadow_box.width;
		dx *= shadow_max / (this.area.width / 2);
		this.shadow.style.left = dx + shadow_target.x - shadow_box.width/2 + "px";
		
		shadow_max = this.settings.shadow.move * shadow_box.height;
		dy = this.moon.restingpos.y - next_pos.y;
		dy /= this.area.height / 2;
		if (dy < 0 ) {
			var opacity_mult = 1 + Math.max(dy, -1);
			this.shadow.style.opacity = opacity_mult*opacity_mult*this.settings.shadow.opacity;
		} else
			this.shadow.style.opacity = this.settings.shadow.opacity;
		this.shadow.style.top = shadow_max*dy + shadow_target.y - shadow_box.height/2 + "px";
		
		
		for(var s in this.stars) {
			this.stars[s].star_streak.style.opacity = 
				this.StarAlpha(this.settings.star.streak, this.stars[s].star_distance);
			this.stars[s].star_glow.style.opacity = 
				this.StarAlpha(this.settings.star.glow, this.stars[s].star_distance);
			this.stars[s].star_core.style.opacity = 
				this.StarAlpha(this.settings.star.core, this.stars[s].star_distance);
			var delta = this.stars[s].star_distance - this.stars[s].star_target;
			if (delta > this.stars[s].star_speed)
				this.stars[s].star_distance -= this.stars[s].star_speed;
			else if (delta < -this.stars[s].star_speed)
				this.stars[s].star_distance += this.stars[s].star_speed;
			else {
				this.stars[s].star_target = Math.random() * this.settings.star.max_fade;
				this.stars[s].star_speed = this.settings.star.twinkle_speed;
			}
		}
		
		for (var s in this.mane_stars) {
			var scale = this.mane_stars[s].scale;
			scale.factor += scale.speed;
			scale.transform.setScale(scale.factor,scale.factor);
			if (scale.factor >= this.settings.svg.star_scale_max) {
				scale.speed = -this.settings.svg.star_scale_inc;
			} else if (scale.factor <= this.settings.svg.star_scale_min) {
				scale.speed = this.settings.svg.star_scale_inc;
			}
			var rotate = this.mane_stars[s].rotate;
			rotate.orbit.setRotate(rotate.orbit.angle+rotate.orbit_speed,0,0);
			rotate.spin.setRotate(rotate.spin.angle+rotate.spin_speed,0,0);
		}
	}

	// Creates a star
	this.SpawnStar = function () {
		var star_wrapper = document.createElement('div');
		star_wrapper.className = "star";
		star_wrapper.style.position = "absolute";
		star_wrapper.style.zIndex = this.settings.z_index+0;
		star_wrapper.style.left = Math.round(Math.random()*100)+'%';
		star_wrapper.style.top = Math.round(Math.random()*100)+'%';
		star_wrapper.star_distance = this.settings.star.max_fade * Math.random();
		star_wrapper.star_target = this.settings.star.max_fade;
		star_wrapper.star_speed = this.settings.star.fade_speed;
		
		
		var star_offset = document.createElement('div');
		star_offset.style.position = "relative";
		star_offset.style.left = -this.settings.star.size/2 + "px";
		star_offset.style.top = -this.settings.star.size/2 + "px";
		star_wrapper.insertBefore(star_offset,null);
		
		var star_core = document.createElement('img');
		star_core.className = "star_core";
		star_core.src = this.settings.media+"star_0.png";
		star_core.style.height = 'auto';
		star_core.style.width = this.settings.star.size+'px';
		star_core.style.opacity = 0.4;
		star_core.style.position = 'absolute';
		star_offset.insertBefore(star_core,null);
		star_wrapper.star_core = star_core;
		
		var star_glow = document.createElement('img');
		star_glow.className = "star_glow";
		star_glow.src = this.settings.media+"star_2.png";
		star_glow.style.height = 'auto';
		star_glow.style.width = this.settings.star.size+'px';
		star_glow.style.opacity = 0;
		star_glow.style.position = 'absolute';
		star_offset.insertBefore(star_glow,star_core);
		star_wrapper.star_glow = star_glow;
		
		var star_streak = document.createElement('img');
		star_streak.className = "star_core";
		star_streak.src = this.settings.media+"star_1.png";
		star_streak.style.height = 'auto';
		star_streak.style.width = this.settings.star.size+'px';
		star_streak.style.opacity = 0;
		star_streak.style.position = 'absolute';
		star_offset.insertBefore(star_streak,star_glow);
		star_wrapper.star_streak = star_streak;
		
		this.parent.insertBefore(star_wrapper,null);
		this.stars.push(star_wrapper);
	}

	// Sets the moon to get back behind Luna
	this.EventMouseLeave = function () {
		this.moon.targetpos = { x: this.moon.restingpos.x, y: this.moon.restingpos.y };
	}
	
	// Sets style features common to SVG and PNG Luna image
	this.SetLunaCommonStyle = function () {
		this.luna.style.zIndex = this.settings.z_index+10;
		this.luna.style.position = "absolute";
	}
	
	// Executed when we receive Luna's SVG data
	this.ReceiveSvgLuna = function (luna_request) {
		if (luna_request.readyState == 4 && luna_request.status == 200) {
			this.luna = document.createElement('div');
			
			this.luna.svg = luna_request.responseXML.documentElement;
			this.luna.svg.style.width = '100%';
			this.luna.svg.style.height = '100%';
			
			this.luna.naturalWidth = this.luna.svg.width.baseVal.value;
			this.luna.naturalHeight = this.luna.svg.height.baseVal.value;
			this.SetLunaCommonStyle();
			this.luna.style.visibility = 'hidden';
			this.luna.image_type = 'svg';
			
			this.luna.insertBefore(this.luna.svg,null);
			this.parent.insertBefore(this.luna,null);
			
			this.Ready();
		}
	}

	// Creates Luna's image
	this.SpawnLuna = function (parent) {
		if (this.settings.image_type == 'png') {
			this.luna = document.createElement('img');
			this.luna.src = this.settings.media+"luna.png";
			this.luna.alt = "Best Princess"
			this.luna.image_type = 'png';
			this.loading++;
			this.luna.onload = this.Ready.bind(this);
			this.parent.insertBefore(this.luna,null);
			this.SetLunaCommonStyle();
		} else if (this.settings.image_type == 'svg') {
			this.loading++;
			var luna_request = new XMLHttpRequest();
			luna_request.onreadystatechange = this.ReceiveSvgLuna.bind(this,luna_request);
			luna_request.open("GET",this.settings.media+"luna.svg",true);
			luna_request.send();
		}
	}
	
	// Creates the main menu
	this.SpawnMainMenu = function() {
		this.menu = document.createElement('menu');
		this.menu.id = "luna-menu_"+Math.random().toString(16).slice(2);
		this.menu.type = "context";
		this.parent.insertBefore(this.menu,null);
		//this.parent.contextMenu = this.menu;
		this.parent.setAttribute("contextmenu",this.menu.id);
	}
	// Adds a menu item/submenu to a menu
	this.InsertMenuItem = function(menu,item) {
		menu.insertBefore(item,null);
	}
	// Creates a simple menu item
	this.SpawnMenuItem = function(object) {
		var menuitem = document.createElement('menuitem');
		for (var key in object)
			menuitem[key] = object[key];
		return menuitem;
	}
	// Creates a sub menu
	this.SpawnSubMenu = function(label) {
		var menu = document.createElement('menu');
		menu.label = label;
		return menu;
	}

	//parent
	this.parent = element;
	var parent_position = window.getComputedStyle(this.parent).position;
	if (parent_position == "" || parent_position == "static")
		this.parent.style.position = "relative";
	this.parent.style.overflow = "hidden";
	// settings
	this.settings = JSON.parse(JSON.stringify(settings)); // poor man's deep copy
	this.settings.star.max_fade = Math.max(
		this.settings.star.core.fade_distance,
		this.settings.star.glow.fade_distance,
		this.settings.star.streak.fade_distance
	);
	//misc
	this.imgratio = 1;
	this.area = element.getBoundingClientRect();
	this.loading = 0;
	// luna
	this.SpawnLuna();
	// shadow
	this.shadow = document.createElement('div');
	this.shadow.style.zIndex = this.settings.z_index+1;
	this.shadow.style.position = "absolute";
	this.shadow.style.backgroundColor = "black";
	this.shadow.style.opacity = 0;
	this.shadow.style.borderRadius = "100%";
	this.shadow.style.visibility = 'hidden';
	this.parent.insertBefore(this.shadow,null);
	// moon
	this.moon = document.createElement('img');
	this.moon.src = this.settings.media+"moon.png";
	this.moon.style.position = "absolute";
	this.moon.style.zIndex = this.settings.z_index+2;
	this.moon.style.height = 'auto';
	this.moon.style.visibility = 'hidden';
	this.parent.insertBefore(this.moon,null);
	this.loading++;
	this.moon.onload = this.Ready.bind(this);
	// stars
	this.stars = [];
	for (var i = 0; i < this.settings.star.number; i++)
		this.SpawnStar();
	// menu
	// NOTE <menu> is only implemented on Firefox
	// NOTE Luna may or not be best princess but Firefox is surely best browser
	this.SpawnMainMenu();
	this.InsertMenuItem(this.menu, this.SpawnMenuItem({
		label:"About Luna", 
		onlick: function() { window.open("https://github.com/mbasaglia/Luna/"); },
		icon: this.settings.media+"icon.png"
	}));
	var bp_menu = this.SpawnSubMenu("Best Princess");
	this.InsertMenuItem(bp_menu,this.SpawnMenuItem({
		label: "Celestia",
		disabled: true,
		type: "radio"
	}));
	this.InsertMenuItem(bp_menu,this.SpawnMenuItem({
		label: "Luna",
		checked: true,
		default: true,
		type: "radio"
	}));
	this.InsertMenuItem(bp_menu,this.SpawnMenuItem({
		label: "Cadance",
		disabled: true,
		type: "radio"
	}));
	this.InsertMenuItem(bp_menu,this.SpawnMenuItem({
		label: "Twilight Sparkle",
		disabled: true,
		type: "radio"
	}));
	this.InsertMenuItem(this.menu, bp_menu);
	
	
} 

function SetupLuna(element,settings) {
	
	if (!element)
		element = document.body;
	
	if (!settings)
		settings = luna_settings;
	else
		settings = LunaSettings(settings);
	
	var luna = new Luna(element,settings);
	return luna;
}
