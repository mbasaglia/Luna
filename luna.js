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
};

// Simple clone of a simple object
function RecursiveClone(object, output) {
	if (!output) 
		output = {}
	for (var key in object) {
		if (typeof object[key] === 'object' && object[key] != null)
			output[key] = RecursiveClone(object[key]);
		else
			output[key] = object[key];
	}
	return output;
}

// Returns a copy of luna_settings with some values overridden from the given object
function LunaSettings(change) {
	var settings = {};
	RecursiveClone(luna_settings,settings);
	RecursiveClone(change,settings);
	return settings;
}

function SvgNsResolver(prefix) {
	var xmlns = {
		rdf  : "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
		cc   : "http://creativecommons.org/ns#",
		xlink: "http://www.w3.org/1999/xlink",
		dc   : "http://purl.org/dc/elements/1.1/",
		svg  : "http://www.w3.org/2000/svg",
		pony : "http://mlp.mattbas.org/luna/xmlns",
	};
	return xmlns[prefix] || null;
}

// Get a random number between the given values (floating point)
function RandomBetween(min, max) {
	return Math.random() * (max-min) + min;
}

// A point to be moved by a flow animation
function SvgPathAnimationPoint(segment) {
	
	// Sets the out control point to the captured reference
	this.ControlPointOutCapture = function (segment,number) {
		this.cp_out = {
			x      : segment["x"+number],
			y      : segment["y"+number],
			segment: segment,
			number : number
		};
	}
	// Sets the out control point to the given coordinates
	this.ControlPointOutSimple = function (x,y) {
		this.cp_out = {
			x      : x,
			y      : y,
		};
	}
	// Sets the in control point to the captured reference
	this.ControlPointInCapture = function (segment,number) {
		this.cp_in = {
			x      : segment["x"+number],
			y      : segment["y"+number],
			segment: segment,
			number : number
		};
	}
	// Sets the in control point to the given coordinates
	this.ControlPointInSimple = function (x,y) {
		this.cp_in = {
			x      : x,
			y      : y,
		};
	}
	
	// Copies some attributes if they are needed
	this.MaybeCopy = function(object,attributes) {
		for(var i in attributes)
			if (object[attributes[i]] && !this[attributes[i]])
				this[attributes[i]] = object[attributes[i]];
	}
	
	// Copies the relevant data from the other point to merge them
	this.Join = function (point) {
		var abserror = Math.abs(this.x - point.x) + Math.abs(this.y - point.y);
		var relerror = abserror / (Math.abs(this.x)+Math.abs(this.y));
		if ( relerror < 0.001 ) { // .1% accuracy
			// close enough to be the same point
			this.MaybeCopy(point,["cp_in","cp_out","next_neighbour","prev_neighbour"]);
			this.segments = this.segments.concat(point.segments);
			return true;
		}
		return false;
	}
	
	// Evaluates the moving angle
	this.Setup = function() {
		if ( !this.cp_in && !this.cp_out) {
			var previous = i == 0 ? this.pony_points.length - 1 : i-1;
			this.cp_in = { 
				x: this.pony_points[previous].x,
				y: this.pony_points[previous].y,
			};
			var next = (i+1) % this.pony_points.length;
			this.cp_out = { 
				x: this.pony_points[next].x,
				y: this.pony_points[next].y,
			};
		} else if (!this.cp_in) {
			this.cp_in = { 
				x: this.x,
				y: this.y,
			};
		} else if (!this.cp_out) {
			this.cp_out = { 
				x: this.x,
				y: this.y,
			};
		}
		
		var tangent_angle = Math.atan2(
			this.cp_out.y - this.cp_in.y,
			this.cp_out.x - this.cp_in.x );
		this.move_angle = tangent_angle + Math.PI/2;
	
		this.move_param = Math.random()*Math.PI*2;
		
		// Uncomment to make waves relative to their neighbours (standing wave)
		// what it does is that 
		// when pos == 1 => base shape
		// when pos == 0 => all troughs and crests cancel out in the middle
		/*if (this.next_neighbour && this.prev_neighbour) {
			var average = {
				x : (this.next_neighbour.x + this.prev_neighbour.x) / 2,
				y : (this.next_neighbour.y + this.prev_neighbour.y) / 2,
			};
			average.x = (average.x + this.x) / 2;
			average.y = (average.y + this.y) / 2;
		
			this.origin_delta = {
				x : average.x - this.x,
				y : average.y - this.y,
			};
			this.move_radius = Math.sqrt(this.origin_delta.x*this.origin_delta.x,
									this.origin_delta.y*this.origin_delta.y);
			
			this.pony_pos = { 
				x: (-this.origin_delta.x) / (this.move_radius*Math.cos(this.move_angle)),
				y: (-this.origin_delta.y) / (this.move_radius*Math.sin(this.move_angle)),
			};
		} else 
			this.pony_pos = { x: 1, y: 1};*/
	}
	
	// Moves a fully initialized point
	this.Move = function(speed_correction) {
		this.move_param += speed_correction*this.move_speed/180*Math.PI;
		var pos = Math.cos(this.move_param);
		// uncomment for standing wave:
		/*var dx = this.pony_pos.x * pos * this.move_radius * Math.cos(this.move_angle);
		var dy = this.pony_pos.y * pos * this.move_radius * Math.sin(this.move_angle);*/
		var dx = pos * this.move_radius * Math.cos(this.move_angle);
		var dy = pos * this.move_radius * Math.sin(this.move_angle);
		if (this.origin_delta) {
			dx += this.origin_delta.x;
			dy += this.origin_delta.y;
		}
		for (var k in this.segments) {
			this.segments[k].x = this.x + dx;
			this.segments[k].y = this.y + dy;
		}
		if (this.cp_in.segment) {
			this.cp_in.segment["x"+this.cp_in.number] = this.cp_in.x + dx;
			this.cp_in.segment["y"+this.cp_in.number] = this.cp_in.y + dy;
		}
		if (this.cp_out.segment) {
			this.cp_out.segment["x"+this.cp_out.number] = this.cp_out.x + dx;
			this.cp_out.segment["y"+this.cp_out.number] = this.cp_out.y + dy;
		}
		return { x: dx, y:dy };
	}
	
	this.segments = [segment];
	this.x = segment.x;
	this.y = segment.y;
	this.handles = [];
}

function SvgPathAnimation(path) {
	
	this.PushPoint = function (segment,index) {
		var new_point = new SvgPathAnimationPoint(segment);
		new_point.move_speed = Number(this.path.getAttribute("pony:anim-flow-speed"));
		new_point.move_radius = Number(this.path.getAttribute("pony:anim-flow-radius"));
		this.pony_points.push(new_point);
		if (index > 0) {
			this.pony_points[index-1].next_neighbour = new_point;
			new_point.prev_neighbour = this.pony_points[index-1];
		}
		return new_point;
	}
	
	this.ControlPointIn = function (segment,number) {
		if (!this.pony_points.length)
			return;
		this.pony_points[this.pony_points.length-1].ControlPointInCapture(segment,number);
	}
	this.ControlPointInSimple = function (x,y) {
		if (!this.pony_points.length)
			return;
		this.pony_points[this.pony_points.length-1].ControlPointInSimple(x,y);
	}
	
	this.ControlPointOut = function (segment,number) {
		if (!this.pony_points.length)
			return;
		this.pony_points[this.pony_points.length-1].ControlPointOutCapture(segment,number);
	}
	
	this.ControlPointMirrorOut = function () {
		if (!this.pony_points.length)
			return null;
		var point = this.pony_points[this.pony_points.length-1];
		if (point.cp_in) {
			point.ControlPointOutSimple(
				point.x + (point.x - point.cp_in.x),
				point.y + (point.y - point.cp_in.y)
			);
			return point.cp_out;
		}
		return { x: point.x, y: point.y };
	}
	
	this.path = path;
	
	// Converts SVG path description to absolute coordinates
	this.PathToAbsolute = function(path) {
		var x = 0;
		var y = 0;
		var x0 = 0;
		var y0 = 0;
		var seg_list = path.pathSegList;
		for (var j = 0; j < seg_list.numberOfItems; j++) {
			var segment = seg_list.getItem(j);
			var char = segment.pathSegTypeAsLetter;
			var new_item = null;
			switch(char) {
				case 'M':
					x0 = segment.x;
					y0 = segment.x;
					break;
				case 'm':
					new_item = path.createSVGPathSegMovetoAbs(x+segment.x,y+segment.y);
					x0 = new_item.x;
					y0 = new_item.x;
					break;
				case 'l':
					new_item = 
						path.createSVGPathSegLinetoAbs(x+segment.x,y+segment.y);
					break;
				case 'h':
					new_item = 
						path.createSVGPathSegLinetoHorizontalAbs(x+segment.x);
					break;
				case 'v':
					new_item = 
						path.createSVGPathSegLinetoVerticalAbs(y+segment.y);
					break;
				case 'c':
					new_item = 
						path.createSVGPathSegCurvetoCubicAbs(
							x+segment.x, y+segment.y,
							x+segment.x1,y+segment.y1, 
							x+segment.x2,y+segment.y2
						);
					break;
				case 's':
					new_item = 
						path.createSVGPathSegCurvetoCubicSmoothAbs(
							x+segment.x, y+segment.y,
							x+segment.x2,y+segment.y2
						);
					break;
				case 'q':
					new_item = 
						path.createSVGPathSegCurvetoQuadraticAbs(
							x+segment.x, y+segment.y,
							x+segment.x1,y+segment.y1
						);
					break;
				case 't':
					new_item = 
						path.createSVGPathSegCurvetoQuadraticSmoothAbs(x+segment.x, y+segment.y);
					break;
				case 'a':
					new_item = 
						path.createSVGPathSegArcAbs(x+segment.x, y+segment.y,
							segment.r1, segment.r2, segment.angle,
							segment.largeArcFlag, segment.sweepFlag );
					break;
				case 'z':
				case 'Z':
					x = x0;
					y = y0;
					break;
			}
			// replace relative item
			if (new_item) {
				seg_list.replaceItem(new_item,j);
				segment = seg_list.getItem(j);
			}
			// update coordinates
			if("x" in segment)
				x = segment.x;
			if ("y" in segment)
				y = segment.y;
			
		}
	}
	
	// normalizedPathSegList ?
	this.PathToAbsolute(path);
	
	this.pony_points = [];
	
	// Build points
	for (var j = 0; j < path.pathSegList.numberOfItems; j++) {
		var segment = path.pathSegList.getItem(j);
		var offset_x = 0;
		var offset_y = 0;
		switch (segment.pathSegTypeAsLetter.toUpperCase()) {
			case 'M':
			case 'L':
				this.PushPoint(segment,j);
				break;
			case 'Z':
				if (j > 0 && this.pony_points[0].Join(this.pony_points[j-1])) {
					this.pony_points.pop();
				}
				// TODO support multiple segments
				break;
			case 'C':
				this.ControlPointOut(segment,1);
				this.PushPoint(segment,j);
				this.ControlPointIn(segment,2);
				break;
			case 'S':
				this.ControlPointMirrorOut();
				this.PushPoint(segment,j);
				this.ControlPointIn(segment,2);
				break;
			case 'Q':
				this.ControlPointOut(segment,1); // simple?
				this.PushPoint(segment,j);
				this.ControlPointInSimple(segment.x1,segment.x1);
				break;
			case 'T':
				var p = this.ControlPointMirrorOut();
				this.PushPoint(segment,j);
				this.ControlPointInSimple(p.y,p.x);
				break;
			case 'A':
				// not fully supported
				this.PushPoint(segment,j);
				break;
			case 'H': case 'V':
				// not supported
				break;
		}
	}
	
	// Fix stuff + calculations
	for (var i = 0; i < this.pony_points.length; i++) {
		this.pony_points[i].Setup();
	}
	
	// Done!
	path.pony_points = this.pony_points;
	path.pony_clones = [];
	
	// Workaround for Chromium not updating <use>
	path.pony_workaround = path.ownerSVGElement.createSVGTransform();
	path.transform.baseVal.appendItem(path.pony_workaround);
	
	path.PonyFlow = function(speed_correction) {
		for (var i in this.pony_points) {
			this.pony_points[i].Move(speed_correction);
		}
		this.pony_workaround.setTranslate(0,0);
		for (var i in this.pony_clones) {
			this.pony_clones[i].setAttribute("d",this.getAttribute("d"));
		}
	}.bind(path);
	path.PonyClone = function(clone) {
		this.pony_clones.push(clone);
	}.bind(path);
}

// Luna constructor
function Luna(element, settings) {

// Animation
	
	// Evaluates the alpha of a star component
	this.StarAlpha = function (settings, distance) {
		var alpha = 1 - Math.min(1,distance/settings.fade_distance);
		return settings.min_alpha + (settings.max_alpha-settings.min_alpha) * alpha;
	};
	
	
	// Creates a star
	this.SpawnStar = function () {
		// TODO svg stars
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
	
	// Simplifies the interface to evaluate an XPath expression
	this.SvgXpath = function(expression,result_type,old_object) {
		if (!result_type) 
			result_type = XPathResult.ANY_TYPE;
		return document.evaluate( expression, this.luna.svg, SvgNsResolver, 
					result_type, old_object );
	}
	
	this.SetupSvgAnimations = function() {
		if (!this.luna.svg)
			return;
		
		this.svg = {};
		
		var eyes_snapshot = this.SvgXpath('//svg:*[@pony:anim="eye"]',
				XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE );
		
		this.svg.eyes = [];
		for (var i = 0; i < eyes_snapshot.snapshotLength; i++) {
			var eye = eyes_snapshot.snapshotItem(i);
			
			var gaze = this.luna.svg.createSVGTransform();
			gaze.setTranslate(0,0);
			eye.transform.baseVal.insertItemBefore(gaze,0);
			eye.gaze = gaze;
			
			var pony_anim = {
				top   : Number(eye.getAttribute("pony:anim-eye-top")),
				bottom: Number(eye.getAttribute("pony:anim-eye-bottom")),
				left  : Number(eye.getAttribute("pony:anim-eye-left")),
				right : Number(eye.getAttribute("pony:anim-eye-right")),
				speed : Number(eye.getAttribute("pony:anim-eye-speed")),
			};
			pony_anim.height = pony_anim.bottom - pony_anim.top;
			pony_anim.width = pony_anim.right - pony_anim.left;
			pony_anim.cy = pony_anim.top + pony_anim.height / 2;
			pony_anim.cx = pony_anim.left + pony_anim.width / 2;
			eye.pony_anim = pony_anim;
			
			this.svg.eyes.push(eye);
		}
		
		
		this.svg.mane_stars = [];
		
		var star_parent_snapshot = this.SvgXpath(
				'//svg:*[@pony:anim="sparkle"]',
				XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE );
		
		for (var j = 0; j < eyes_snapshot.snapshotLength; j++) {
			var original_star = star_parent_snapshot.snapshotItem(j);
			if (!original_star.id) continue;
			
			var pony_anim = {
				scale_max: Number(original_star.getAttribute("pony:anim-sparkle-scale-max")),
				scale_min: Number(original_star.getAttribute("pony:anim-sparkle-scale-min")),
				scale_inc: Number(original_star.getAttribute("pony:anim-sparkle-scale-inc")),
				spin     : Number(original_star.getAttribute("pony:anim-sparkle-spin")),
			}
			pony_anim.scale_mid = pony_anim.scale_min + 
				(pony_anim.scale_max-pony_anim.scale_min)/2;
			if (original_star.hasAttribute("pony:anim-sparkle-cx") &&
					original_star.hasAttribute("pony:anim-sparkle-cy")) {
				pony_anim.cx = Number(original_star.getAttribute("pony:anim-sparkle-cx"));
				pony_anim.cy = Number(original_star.getAttribute("pony:anim-sparkle-cy"));
			} else {
				var star_box = original_star.getBBox();
				pony_anim.cx = star_box.width/2;
				pony_anim.cy = star_box.height/2;
			}
			original_star.pony_anim = pony_anim;
			
			var clones_snapshot = this.SvgXpath(
				'//svg:use[@xlink:href="#'+original_star.id+'"]',
				XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE );
				
			for (var i = 0; i < clones_snapshot.snapshotLength; i++) {
				var mane_star = clones_snapshot.snapshotItem(i);
				mane_star.pony_anim = pony_anim;
				
				var old_matrix = null;
				if (mane_star.transform.baseVal[0])
					old_matrix = mane_star.transform.baseVal[0].matrix;
				
				mane_star.transform.baseVal.clear();
				
				if (old_matrix) {
					var translate = this.luna.svg.createSVGTransform();
					translate.setTranslate(old_matrix.e,old_matrix.f);
					mane_star.transform.baseVal.appendItem(translate);
				}
			
				var scale = this.luna.svg.createSVGTransform();
				var scale_factor = RandomBetween(
					mane_star.pony_anim.scale_min,
					mane_star.pony_anim.scale_max);
				scale.setScale(scale_factor,scale_factor);
				mane_star.transform.baseVal.appendItem(scale);
				mane_star.scale = {
					transform: scale,
					max      : RandomBetween(scale_factor,mane_star.pony_anim.scale_max),
					min      : RandomBetween(mane_star.pony_anim.scale_min,scale_factor),
					speed    : (Math.round(Math.random())*2-1) * mane_star.pony_anim.scale_inc,
					factor   : scale_factor
				};
				
				var center = this.luna.svg.createSVGTransform();
				center.setTranslate(-pony_anim.cx,-pony_anim.cy);
				mane_star.transform.baseVal.appendItem(center);
				
				var spin = this.luna.svg.createSVGTransform();
				spin.setRotate(Math.random()*360,pony_anim.cx,pony_anim.cy);
				mane_star.transform.baseVal.appendItem(spin);
				mane_star.rotate = {
					transform: spin,
					speed    : (Math.random()*2-1)*mane_star.pony_anim.spin,
				};
				
				this.svg.mane_stars.push(mane_star);
				
			}
		}
		
		// Direct flows
		this.svg.flows = [];
		var flow_snapshot = this.SvgXpath('//svg:path[@pony:anim="flow"]',
				XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE );
		for (var i = 0; i < flow_snapshot.snapshotLength; i++) {
			var flow = flow_snapshot.snapshotItem(i);
			new SvgPathAnimation(flow);
			this.svg.flows.push(flow);
		}
		// Clone flows
		var flow_clones = [];
		flow_snapshot = this.SvgXpath('//svg:path[@pony:anim="flow-clone"]',
				XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE );
		for (var i = 0; i < flow_snapshot.snapshotLength; i++) {
			var flow = flow_snapshot.snapshotItem(i);
			if (flow.hasAttribute("pony:anim-flow-clone")) {
				for(var j in this.svg.flows) {
					if ('#'+this.svg.flows[j].id == flow.getAttribute("pony:anim-flow-clone"))
						this.svg.flows[j].PonyClone(flow);
				}
			}
		}
		
	}
	
	// Performs animations on the SVG
	this.SvgAnimation = function() {
		for (var s in this.svg.mane_stars) {
			var mane_star = this.svg.mane_stars[s];
			var scale = mane_star.scale;
			scale.factor += scale.speed*this.speed_correction;
			scale.transform.setScale(scale.factor,scale.factor);
			if (scale.factor >= scale.max) {
				scale.min = RandomBetween(mane_star.pony_anim.scale_min,
										  mane_star.pony_anim.scale_mid),
				scale.speed = -mane_star.pony_anim.scale_inc;
			} else if (scale.factor <= scale.min) {
				scale.max = RandomBetween(mane_star.pony_anim.scale_mid,
										  mane_star.pony_anim.scale_max),
				scale.speed = mane_star.pony_anim.scale_inc;
			}
			var rotate = mane_star.rotate;
			rotate.transform.setRotate(rotate.transform.angle+rotate.speed*this.speed_correction,
									   mane_star.pony_anim.cx,
									   mane_star.pony_anim.cy);
		}
		
		for (var i in this.svg.eyes) {
			var eye = this.svg.eyes[i];
			// TODO normalize this a bit and use pony_anim.speed when following the mouse
			if (!isNaN(this.mouse.x)) {		
				var client_eyebox = eye.getBoundingClientRect();
				client_eyebox.cy = client_eyebox.top + client_eyebox.height/2;
				client_eyebox.cx = client_eyebox.left + client_eyebox.width/2;
				
				var dx = this.mouse.x - client_eyebox.cx;
				if (dy < 0)
					dx = dx/(client_eyebox.cx-this.area.left);
				else
					dx = dx/(this.area.right-client_eyebox.cx);
				
				var dy = this.mouse.y - client_eyebox.cy;
				if (dy < 0)
					dy = dy/(client_eyebox.cy-this.area.top);
				else
					dy = dy/(this.area.bottom-client_eyebox.cy);
				
				eye.gaze.setTranslate(dx * eye.pony_anim.width  + eye.pony_anim.cx, 
											dy * eye.pony_anim.height + eye.pony_anim.cy);
			} else {
				var dx = eye.gaze.matrix.e;
				var dy = eye.gaze.matrix.f;
				var len = Math.max(0,Math.sqrt(dx*dx+dy*dy)-eye.pony_anim.speed*this.speed_correction);
				var angle = Math.atan2(dy,dx);
				eye.gaze.setTranslate(len*Math.cos(angle), 
											len*Math.sin(angle));
				
			}
		}
		
		for (var i in this.svg.flows) {
			this.svg.flows[i].PonyFlow(this.speed_correction);
		}
	}
	
	this.TwinkleStars = function() {
		for(var s in this.stars) {
			this.stars[s].star_streak.style.opacity = 
				this.StarAlpha(this.settings.star.streak, this.stars[s].star_distance);
			this.stars[s].star_glow.style.opacity = 
				this.StarAlpha(this.settings.star.glow, this.stars[s].star_distance);
			this.stars[s].star_core.style.opacity = 
				this.StarAlpha(this.settings.star.core, this.stars[s].star_distance);
			var delta = this.stars[s].star_distance - this.stars[s].star_target;
			if (delta > this.stars[s].star_speed*this.speed_correction)
				this.stars[s].star_distance -= this.stars[s].star_speed*this.speed_correction;
			else if (delta < -this.stars[s].star_speed)
				this.stars[s].star_distance += this.stars[s].star_speed*this.speed_correction;
			else {
				this.stars[s].star_target = Math.random() * this.settings.star.max_fade;
				this.stars[s].star_speed = this.settings.star.twinkle_speed;
			}
		}
	}
	
	// Moves moon and shadow
	this.MoveMoon = function() {
		var dx = this.moon.targetpos.x - this.moon.x;
		var dy = this.moon.targetpos.y - this.moon.y;
		var speed = this.settings.moon_speed*this.imgratio * this.speed_correction;
		var len = Math.sqrt(dx*dx+dy*dy);
		var angle = Math.atan2(dy,dx);
		var next_pos = { x: this.moon.targetpos.x, y : this.moon.targetpos.y };
		
		// TODO handle case in which the moon is far away (?)
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
	}

// Events

	// Resizes Luna to fit in the window
	this.EventResize = function () {
		var luna_box = this.luna.getBoundingClientRect();
		if (this.luna.svg) {
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
		if (this.luna.svg) {
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
		this.mouse = {
			x : event.clientX,
			y : event.clientY
		};
		var dx = this.mouse.x - this.area.left - this.luna.client_x;
		var dy = this.mouse.y - this.area.top  - this.luna.client_y;
		// NOTE currently targetpos is always restingpos - mouse delta
		this.moon.targetpos = { 
			x : this.moon.restingpos.x - dx, 
			y : this.moon.restingpos.y - dy 
		};
		
		for(var s in this.stars) {
			var box = this.stars[s].getBoundingClientRect();
			var dx = box.left + box.width / 2 - event.clientX;
			var dy = box.top + box.height / 2 - event.clientY;
			this.stars[s].star_target = Math.min(Math.sqrt(dx*dx+dy*dy), this.settings.star.max_fade);
			this.stars[s].star_speed = this.settings.star.fade_speed;
		}
	}

	// Executes a frame
	this.Step = function() {
		var time_before = window.performance.now();
		this.frame_time = time_before - this.frame_timestamp;
		this.frame_timestamp = time_before;
		this.speed_correction = this.frame_time / this.target_frame_time;
		
		this.MoveMoon();
		this.TwinkleStars();
		if (this.luna.svg)
			this.SvgAnimation();
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
			this.EventMouseLeave();
			
			this.moon.style.visibility = 'visible';
			this.shadow.style.visibility = 'visible';
			this.luna.style.visibility = 'visible';
			
			this.SetupSvgAnimations();
			
			//timing
			this.target_frame_time = 1000/this.settings.framerate;
			this.frame_time = this.target_frame_time;
			this.frame_timestamp = window.performance.now();
			setInterval(this.Step.bind(this), this.target_frame_time);
			
			// events
			window.addEventListener("resize",this.EventResize.bind(this));
			this.parent.addEventListener("mousemove",this.EventMouseMove.bind(this));
			this.parent.addEventListener("mouseleave",this.EventMouseLeave.bind(this));
		}
	}
	
	// Sets the moon to get back behind Luna
	this.EventMouseLeave = function () {
		this.mouse = { x: NaN, y: NaN };
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
			this.luna.svg = false;
		} else if (this.settings.image_type == 'svg') {
			this.loading++;
			var luna_request = new XMLHttpRequest();
			luna_request.onreadystatechange = this.ReceiveSvgLuna.bind(this,luna_request);
			luna_request.open("GET",this.settings.media+"luna.svg",true);
			luna_request.send();
		}
	}
	
// Menu

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
	
// Constructor

	//parent
	this.parent = element;
	var parent_position = window.getComputedStyle(this.parent).position;
	if (parent_position == "" || parent_position == "static")
		this.parent.style.position = "relative";
	this.parent.style.overflow = "hidden";
	// settings
	this.settings = RecursiveClone(settings);
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
