# hex
Web-based procedural terrain based on hexagons

to do

DONE-r limit height of hexagons

DONE-r remove duplicate debug panel code

DONE-b address lighting and other warning messages

[Error] Viewport argument key "minimal-ui" not recognized and ignored.
	c (aframe.min.js:1:438929)
	forEach
	(anonymous function) (aframe.min.js:1:438701)
	doConnectedCallback (aframe.min.js:1:424551)
	connectedCallback (aframe.min.js:1:406413)
	connectedCallback
	dispatchEvent
	(anonymous function) (aframe.min.js:1:422292)

DONE-r remove redundant console logs from terrain gen


351 of terrain-system
       heightOffset: {type: 'number', default: 16},
-r  This offset needs to be refactored to mechanically
    work with the geometry size. Default is 5. But with
    a geometryHeight of 12, needs to be 16 or 17.