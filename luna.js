var luna_settings = {
	framerate  :  60, // frames per second
	moon_speed :  12, // pixels / frame * image_resize_factor
	moon_size  : 1.5, // multiplier
	media      : "media/", // relative path
	z_index    :   1, // base z-index 
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
	}
};

function LunaSettings(change) {
	var settings = {};
	for (var key in luna_settings)
		settings[key] = luna_settings[key];
	for (var key in change)
		settings[key] = change[key];
	return settings;
}

function Luna(element=document.body, settings=luna_settings) {
	
	this.StarAlpha = function (settings, distance) {
		var alpha = 1 - Math.min(1,distance/settings.fade_distance);
		return settings.min_alpha + (settings.max_alpha-settings.min_alpha) * alpha;
	};

	this.EventResize = function () {
		this.area = element.getBoundingClientRect();
		var wratio = this.area.width / this.luna.naturalWidth;
		var hratio = (this.area.height-this.luna.y) / this.luna.naturalHeight;
		this.imgratio = Math.min(wratio,hratio,1);
		
		var width = Math.round(this.luna.naturalWidth * this.imgratio);
		this.luna.style.width = width + 'px';
		this.luna.style.height = 'auto';
		this.luna.style.left = (this.area.width - width) / 2 + "px";
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

	this.EventMouseMove = function (event) {
		var dx = (this.area.x + this.luna.client_x - event.clientX);
		var dy = (this.area.y + this.luna.client_y - event.clientY);
		this.moon.targetpos = { x : this.moon.restingpos.x + dx, y : this.moon.restingpos.y + dy };
		
		for(var s in this.stars) {
			var box = this.stars[s].getBoundingClientRect();
			dx = box.x + box.width / 2 - event.clientX;
			dy = box.y + box.height / 2 - event.clientY;
			this.stars[s].star_target = Math.min(Math.sqrt(dx*dx+dy*dy), this.settings.star.max_fade);
			this.stars[s].star_speed = this.settings.star.fade_speed;
		}
	}

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
	}

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

	this.EventMouseLeave = function () {
		this.moon.targetpos = { x: this.moon.restingpos.x, y: this.moon.restingpos.y };
	}

	this.SpawnLuna = function (parent) {
		this.luna = document.createElement('img');
		this.luna.src = this.settings.media+"luna.png";
		this.luna.alt = "Best Princess"
		parent.insertBefore(this.luna,null);
	}
	
	this.SpawnMainMenu = function() {
		this.menu = document.createElement('menu');
		this.menu.id = "luna-menu_"+Math.random().toString(16).slice(2);
		this.menu.type = "context";
		this.parent.insertBefore(this.menu,null);
		//this.parent.contextMenu = this.menu;
		this.parent.setAttribute("contextmenu",this.menu.id);
	}
	this.InsertMenuItem = function(menu,item) {
		menu.insertBefore(item,null);
	}
	this.SpawnMenuItem = function(object) {
		var menuitem = document.createElement('menuitem');
		for (var key in object)
			menuitem[key] = object[key];
		return menuitem;
	}
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
	// luna
	this.luna = element.getElementsByClassName('luna')[0]; 
	if (!this.luna)
		this.SpawnLuna(element);
	this.luna.style.zIndex = this.settings.z_index+10;
	this.luna.style.position = "absolute";
	// shadow
	this.shadow = document.createElement('div');
	this.shadow.style.zIndex = this.settings.z_index+1;
	this.shadow.style.position = "absolute";
	this.shadow.style.backgroundColor = "black";
	this.shadow.style.opacity = 0;
	this.shadow.style.borderRadius = "100%";
	this.parent.insertBefore(this.shadow,null);
	// moon
	this.moon = document.createElement('img');
	this.moon.src = this.settings.media+"moon.png";
	this.moon.style.position = "absolute";
	this.moon.style.zIndex = this.settings.z_index+2;
	this.moon.style.height = 'auto';
	this.parent.insertBefore(this.moon,null);
	this.EventResize();
	this.moon.style.left = this.moon.restingpos.x+'px';
	this.moon.style.top = this.area.height+'px';
	this.moon.targetpos = { x: this.moon.restingpos.x, y: this.moon.restingpos.y };
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
	// events
	var thisluna = this;
	window.addEventListener("resize",function(){thisluna.EventResize();});
	setInterval(function(){thisluna.Step();}, 1000/this.settings.framerate);
	this.parent.addEventListener("mousemove",function(event){thisluna.EventMouseMove(event);});
	this.parent.addEventListener("mouseleave",function(){thisluna.EventMouseLeave();});
} 
