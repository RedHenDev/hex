# hex
Web-based procedural terrain based on hexagons

principles of dev

-longer-term feature ideas, fixes, or tunings
    kept separate so that not tempting into a 
    hours/days-stealing digression -long invest-

-different sections to this to-do, organised in order to 
    conserve progress while providing means to capture
    creative ideas etc. qua spontaneity. The above is
    an example of a section that I would like. I should
    -name them- here.

-section -deeper general dev-

triage

1: -f steep gradient prevents locomotion

2: -f refactor terrain for specified biomes -- areas that offer
    distinct opportunities for locomotive exploration



to do

-f lerp multiplayer positions.

-r how many socket signals sent. Investigate more performant options.

-d thrust not toggle in VR for movement.

-d in settings, allow mobile users to choose
    between toggle and single pulse for thrust
    button; default is just a single pulse
    thrust. More skill and control, and
    therefore fun.

-d mech suit can pick picked up and discarded

-d appearance of mech suit

-d resize mech suit when on mobile/VR

DONE-f simple mech suit

DONE-b chunks involve a *0.9 spacing or something... cf. 431

DONE-b tree collisions

-b vr-ui -- doesn't work; might be rotation? Is it the cause of 
    white screen when returning from VR to mobile?

-f mining hexagonal numbers.

DONE-f new loco - 'hover-pulse'

DONE-f if very slow or stopped, drift to ground.

DONE-f darken floating formations

-f VR menu and tilt (precision etc.) controls

DONE-f tree colour

DONE-f config controls over terrain colouring
    -f but does this work? Can I have a terrain of just green hue?

DONE-b fit hexagons on z dimension

-i general modularity

DONE-b fix tree placement

-f shadows under trees -- or darker light?

-i prime number quarry; choice of mode: smart-mine or physical-mine

-d ui menu for VR

-d precision locomotion for VR (via just head tilts)

-i understand how the standalone biopulse works. Might prove
    to be a useful method for other systems.

-r refactor key scripts to create simple, clean version
    also opportunity to derive template versions for other projects.

-f work out principled means of permitting collisions with both
    main terrain as well as walls and floating walkways etc.

-i deeper subject of this software: an illustration of our
    sociological progress into flight and 'transcending' our
    ignorance of state in confusion -- in other words, something
    like progress in social norms (likely at level of mechanism)
    like use of soap or jurisdiction, rather than communal 
    enlightenment/apocalypse (oh, note how this appears to
    connect to this project's implied ludic medium of the
    post-singularity)

-f random idea: giant skull being pushed through a portal by
    a group of mysterious, much smaller creatures

-d gallery system (aesthetics of planes), as well as thinking about
    requiring client to rename or be able to upload own files --
    i.e. a way to make more convenient (to all involved) the need
    for a manifest file being generated from backend via node script

-r organise project folder: now (18/4/25) mix of legacy & part-operational

-f floating islands, deep caves

-f fun flight (skilled hover flight, embedded in futurology)

-f shadows from trees on terrain.

-f rippling bioluminescence across terrain

-f perhaps ask trees to be generate where dark voxels are

-b forests not generating at new chunks

-r update appearance of trees -- perhaps build from hexagons

-r huge scale of trees

DONE-f not have ui up at start

DONE-b walk button unresponsive

DONE-f new loco to incorporate VR controls and mobile

DONE-f welcome message for no cursor and sounds

-r revert to older hex-geo and geo, but implement fog fix.

DONE-r limit height of hexagons

DONE-r remove duplicate debug panel code

DONE-b address lighting and other warning messages

DONE-b viewport error

DONE-r remove redundant console logs from terrain gen

DONE-r  This offset needs to be refactored to mechanically
    work with the geometry size. Default is 5. But with
    a geometryHeight of 12, needs to be 16 or 17.