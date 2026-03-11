Problem Statement and Goal

Athletes often want to compare multiple runs on the same segment—such as downhill mountain bike descents, ski runs, or timed trail efforts—to understand exactly where time was gained or lost. Existing tools (for example Strava’s segment comparison) provide useful visualizations but impose important limitations: they automatically determine segment start and end points, they align efforts based on internal heuristics that may shift start timing slightly between riders, and they typically hide the underlying GPS sampling points by interpolating positions along a smoothed track. These design choices make it difficult to perform precise analysis when timing differences are small, when GPS devices sample at different frequencies, or when a user needs to verify that comparisons are based on the exact recorded points rather than inferred positions. In particular, small errors in segment alignment or start timing can propagate through the entire analysis, producing misleading gap charts and inaccurate comparisons.

The goal of this program is to provide a precise, transparent tool for comparing up to five GPX tracks while giving the user full control over the alignment and analysis process. The application will be a browser-based tool hosted on GitHub Pages, meaning it runs entirely client-side and requires no backend server. Users will upload up to five GPX files directly in the browser. The system will parse every track point from each file and allow the user to inspect and visualize each individual GPS ping. Users will be able to manually set the exact start and end point for each rider independently, ensuring that comparisons are aligned to the correct moment in each run rather than relying on automatic segment detection. The application will also allow users to define or generate a reference route that represents the segment being analyzed. This route may be uploaded as a GPX file or computed by averaging several rider tracks to produce the most accurate shared path.

Once tracks are aligned, the tool will normalize each run to elapsed time from the user-defined start point and replay the efforts simultaneously on an interactive map. The interface will provide multiple map styles, synchronized playback controls, and comparison visualizations such as route-distance charts and relative-time tables showing gaps between riders over the course of the segment. Crucially, the tool will allow users to inspect both the raw GPX points and any interpolated positions, ensuring that the analysis remains transparent and verifiable. The overall objective is to create a reliable, inspectable environment for high-precision run comparisons where users can fully control alignment, segment definition, and visualization rather than relying on opaque heuristics used by existing platforms.

1) Product definition: what this tool should actually do

Do not frame this as “Strava but better.” Frame it as a segment-aligned, point-inspectable GPX comparison workbench.

Core user flow:
	1.	Upload up to 5 GPX files.
	2.	Parse every point from every file, preserving raw timestamp, lat, lon, elevation, and original point index.
	3.	Show all tracks on a map.
	4.	Let the user inspect and select the exact start point and exact end point separately for each rider.
	5.	Separately let the user define a reference route / segment corridor:
	•	upload one route GPX, or
	•	generate one by averaging several uploaded tracks into a consensus line.
	6.	Snap all rider points to that route so comparison is along-route rather than raw wall-clock or raw map position.
	7.	Normalize each rider’s run to elapsed time from the user-selected start point, not file timestamp.
	8.	Replay everybody simultaneously on the map.
	9.	Show a relative-time table and distance-gap table against a chosen leader or chosen reference rider.
	10.	Let the user inspect every original ping and see whether a computed position is raw or interpolated.

That last point is critical. If you do not clearly distinguish raw GPX pings from interpolated playback positions, users will distrust the output.

2) Architecture recommendation

Use this stack:
	•	Frontend: plain TypeScript + Vite
	•	Hosting: GitHub Pages
	•	Map engine: Leaflet first
	•	Geometry/math: Turf.js
	•	GPX/XML parsing: DOMParser + toGeoJSON, with your own extraction layer
	•	Charts: uPlot or lightweight custom SVG/Canvas
	•	State: Zustand or a minimal custom store
	•	Persistence: localStorage for settings, optional IndexedDB for session save/load

Why this stack:
	•	GitHub Pages is static-only, so a browser-only SPA is the correct deployment model.
	•	Leaflet is simpler than MapLibre for a first build and works well with raster base maps and custom overlays.  ￼
	•	Turf already gives you the hard spatial primitives you need: nearest point on line, line slicing, distance along line, etc.  ￼
	•	toGeoJSON.gpx() is a clean browser-side path from GPX XML to structured geometry.  ￼

Recommended repo structure

/src
  /app
    main.ts
    store.ts
    router.ts
  /domain
    gpx.ts
    route.ts
    alignment.ts
    playback.ts
    metrics.ts
    consensusRoute.ts
    validation.ts
  /map
    map.ts
    layers.ts
    markers.ts
    basemaps.ts
    hover.ts
  /ui
    uploadPanel.ts
    riderPanel.ts
    routePanel.ts
    playbackPanel.ts
    chartsPanel.ts
    compareTable.ts
    pointInspector.ts
  /types
    gpx.ts
    route.ts
    playback.ts
  /workers
    snapWorker.ts
    consensusWorker.ts
/public
  basemap-preview-icons/

3) The actual data model you need

You need a much stricter data model than most hobby map apps use.

Raw GPX point

Each raw point should contain:

type RawPoint = {
  riderId: string
  pointIndex: number
  lat: number
  lon: number
  ele?: number
  time?: string
  timeMs?: number
  sourceSegmentIndex?: number
  sourceTrackIndex?: number
}

Derived point

After processing:

type DerivedPoint = {
  riderId: string
  pointIndex: number
  raw: RawPoint
  cumulativeDistanceM: number
  elapsedFromFileStartMs?: number
  snappedRouteDistanceM?: number
  lateralErrorM?: number
  isInsideChosenSegment: boolean
}

Rider segment selection

This is separate per rider:

type RiderTrim = {
  riderId: string
  startPointIndex: number
  endPointIndex: number
  normalizedStartTimeMs?: number
}

Route definition

The route should support multiple origins:

type ReferenceRoute = {
  routeId: string
  source: "uploaded_route" | "single_rider" | "consensus_average"
  coordinates: [number, number][]
  cumulativeDistanceM: number[]
}

Playback frame

You need two versions:
	•	nearest raw point at time t
	•	interpolated route position at time t

type PlaybackFrame = {
  riderId: string
  elapsedMs: number
  rawPointIndexNearest?: number
  interpolatedPosition?: {
    lat: number
    lon: number
    routeDistanceM: number
  }
  isRawPingExact: boolean
}

That distinction is not optional.

4) Core technical recommendation: compare along a route, not only in geographic space

This is the single biggest design decision.

If you compare riders only by timestamp and lat/lon, downhill tracks will look noisy and unfair because:
	•	GPS pings are irregular
	•	different devices sample at different frequencies
	•	riders do not hit identical lines through turns
	•	a tiny start offset contaminates everything afterward

So the comparison engine should project every rider onto a shared route axis.

In practice:
	1.	Build a reference route polyline.
	2.	For each raw rider point, snap it to the nearest point on the route.
	3.	Store:
	•	snapped position
	•	route distance from segment start
	•	lateral deviation from route
	4.	Compare riders by:
	•	elapsed time since chosen start
	•	route distance reached at elapsed time t
	•	time required to reach route distance d

This is exactly what Turf’s nearest-point-on-line primitives are for.  ￼

5) How to define “start” and “end” correctly

Your UX should support two independent concepts:

A. Rider start/end trim

This is where each rider’s effort begins and ends.
The user should be able to set it exactly per rider.

B. Reference route segment start/end

This is the spatial segment everyone is compared against.

These are not always identical. A rider may start recording early or late. The segment corridor may be defined on a route line that is cleaner than the rider file.

Required UX for exact point selection

For each rider:
	•	map polyline visible
	•	raw points visible as dots
	•	list or scrubber by point index
	•	hover tooltip: point index, timestamp, lat/lon, elevation, cumulative distance
	•	click a point → mark as rider start
	•	click another point → mark as rider end
	•	keyboard arrows to move start/end one ping forward/back

This solves your “Strava chose the wrong start offset” problem directly.

6) Raw ping visibility: do not fake this

You specifically want to see each and each GPX point. So build this into the UI as a first-class mode.

Raw point display modes

Provide toggles:
	•	Track only
	•	Track + all raw pings
	•	Track + sampled pings every N points
	•	Track + active ping labels

On hover/click

Show:
	•	rider
	•	raw point index
	•	original timestamp
	•	elapsed since file start
	•	elapsed since chosen segment start
	•	elevation
	•	cumulative raw distance
	•	snapped route distance
	•	lateral error to reference route

Also color raw points by one of:
	•	time
	•	speed
	•	lateral error
	•	sequence index

That will let you visually debug whether a rider was snapped wrong or had GPS wander.

7) Consensus/averaged route: how to do it without producing garbage

This feature is useful, but it is easy to do badly.

Do not just average lat/lon point-by-point across files. That fails immediately because files have different numbers of points and different timing.

Use this workflow instead:

Consensus route algorithm
	1.	Select 2–5 tracks to contribute.
	2.	Trim each to the same real-world segment first.
	3.	Resample each trimmed track by distance, not time. Example: every 1 meter or 2 meters.
	4.	Choose one provisional master line:
	•	either the first selected rider
	•	or the medoid track, the one with smallest average deviation to others
	5.	For each distance step along the master line:
	•	find the nearest corresponding point on each contributor track
	•	discard points with too much lateral deviation
	•	average the remaining lat/lon positions
	6.	Smooth lightly, then rebuild cumulative distance.
	7.	Expose the resulting line as a new reference route.

Additional recommendation

Show confidence metrics:
	•	how many tracks contributed at each route station
	•	lateral spread band
	•	mean / max deviation from consensus

Otherwise users will assume the route is “truth” when it may be unstable in certain turns.

8) Comparison engine: the two correct ways to compare

You need both views.

View 1: position at elapsed time t

For each rider at normalized elapsed time t:
	•	find the exact raw points bracketing t
	•	interpolate position between them
	•	compute route distance reached
	•	compute gap behind leader

Use this for playback.

View 2: time to reach route distance d

For each rider:
	•	invert the function and ask:
“how long did it take rider X to reach 50 m, 100 m, 150 m…?”
	•	compare those times across riders

Use this for the chart and table. This is often more stable than comparing positions at fixed times.

Why you need both

On a descent, riders may have different line choices and sampling densities. Time-at-distance often gives a cleaner gap metric than position-at-time.

9) Playback recommendations

Build playback with an explicit global normalized clock:

globalElapsedMs = 0 ... maxComparedElapsedMs

For each rider:
	•	if globalElapsedMs is before their chosen start: hide marker
	•	if after chosen end: freeze or hide marker depending on toggle
	•	else show:
	•	interpolated marker on route
	•	optional nearest raw ping marker
	•	optional line from raw ping to snapped position

Playback controls

Must include:
	•	play / pause
	•	0.25x, 0.5x, 1x, 2x, 4x
	•	frame step by raw ping
	•	frame step by 100 ms
	•	jump to selected rider’s start/end
	•	scrubber
	•	“follow leader”
	•	“lock map to all visible markers”
	•	“ghost trail” for last N seconds

Critical UX point

Show two marker styles:
	•	solid marker = interpolated current position
	•	outlined dot = nearest raw ping

That makes it obvious what is measured vs estimated.

10) Maps: variety without making the project brittle

You asked for a variety of maps.

On GitHub Pages, the easiest path is Leaflet with selectable raster base layers:
	•	OpenStreetMap standard
	•	OpenTopoMap
	•	satellite imagery provider if terms allow
	•	dark map
	•	terrain map

Do not overcomplicate v1 with full vector styling unless you need MapLibre-specific controls.

Recommendation

Support:
	•	standard road
	•	topo
	•	satellite
	•	dark

Also add:
	•	hillshade overlay
	•	contour overlay if available
	•	route elevation profile panel below map

For downhill analysis, topo + satellite are the useful ones.

11) UI layout recommendation

Copy the good parts of the Strava screen, but add the missing controls you actually need.

Left side
	•	main map
	•	elevation profile / route-distance chart below it
	•	playback scrubber below that

Right side

Accordion-style panels:
	1.	Uploaded riders
	2.	Route definition
	3.	Start/end selection
	4.	Comparison table
	5.	Point inspector
	6.	Display settings

Key panels

Uploaded riders
For each rider:
	•	color
	•	file name
	•	start time
	•	end time
	•	point count
	•	sampling irregularity warning
	•	trim controls

Route definition
Options:
	•	use uploaded route file
	•	use rider X as route
	•	build consensus route from selected riders

Start/end selection
For each rider:
	•	current chosen start point index
	•	current chosen end point index
	•	buttons:
	•	set from current selected map point
	•	nudge -1 / +1
	•	nudge -5 / +5
	•	auto-snap to route start/end candidate

Comparison table
Columns:
	•	rider
	•	normalized time
	•	route distance reached
	•	time gap to leader
	•	distance gap to leader
	•	speed over last 1s / 3s / 5s
	•	lateral deviation from route
	•	current raw point index
	•	interpolation status

12) Suggested algorithms in more detail

GPX parsing

Use DOMParser on uploaded file text, then toGeoJSON.gpx() to get geometry, but also preserve raw XML-derived metadata if available. toGeoJSON is good for geometry conversion, but for your use case you may want your own extractor for timestamps/elevation/trackpoint order because comparison depends on those details.  ￼

Cumulative distance

For each rider track:
	•	compute cumulative geodesic distance point-to-point
	•	keep both raw cumulative distance and snapped-route cumulative distance

Snap-to-route

For each rider point:
	•	use nearest point on line
	•	save:
	•	snapped lat/lon
	•	route distance
	•	lateral distance error

Turf’s nearestPointOnLine covers the core snap primitive.  ￼

Segment extraction

After route distances are known:
	•	determine route start distance and route end distance
	•	filter rider points whose snapped distance falls within that interval
	•	also support extracting sublines by route distance using a line-slice approach; Turf has lineSliceAlong for this pattern.  ￼

Interpolation

Between two rider pings at times t0 and t1, linearly interpolate:
	•	lat/lon for map display
	•	route distance for comparison display

But do not interpolate if:
	•	the time gap is too large
	•	the rider is stationary
	•	GPS jump is implausible

Set hard thresholds and visibly flag bad spans.

Leader gap

At each playback frame:
	•	leader = highest route distance among active riders at globalElapsedMs
	•	each rider gapDistance = leaderDist - riderDist
	•	convert to time gap by sampling the leader’s time-distance curve or by comparing the riders’ time to same route station

That second method is better for the chart.

13) Data-quality rules you should implement from day one

If you skip these, the tool will produce polished nonsense.

Required validation checks

On upload:
	•	has timestamps or not
	•	monotonic timestamps
	•	duplicate timestamps
	•	missing elevation
	•	point count too low
	•	impossible speed spikes
	•	large GPS jumps
	•	multiple track segments
	•	empty or malformed GPX

Warnings to show
	•	“Track has no timestamps; playback disabled, spatial comparison only”
	•	“Track contains timestamp reversals”
	•	“Track has long gaps > 2 s”
	•	“Track has probable GPS outliers”
	•	“Track deviates strongly from route in 14% of points”

Filters

Add optional preprocessing:
	•	remove duplicate coordinates
	•	median filter on lateral noise
	•	speed spike suppression
	•	Douglas-Peucker display simplification only for rendering, never for calculations

Important: never simplify the computation track unless the user explicitly chooses it. Render simplification is fine. Analysis simplification is not.

14) Performance recommendations for browser-only GitHub Pages

Up to 5 GPX files is manageable, but raw points plus hover interactions plus charts can still get sluggish.

Do this
	•	parse in a Web Worker
	•	snap-to-route in a Web Worker
	•	store raw points in typed arrays where practical
	•	use Canvas layers for dense point rendering
	•	keep DOM markers only for active playback markers
	•	virtualize long point tables

Do not do this
	•	one Leaflet marker per raw point for all riders at once
	•	re-render all layers on every scrubber move
	•	recompute snapping every time the user changes playback position

Precompute everything you can after upload.

15) GitHub Pages deployment recommendation

Use Vite with a base path configured for GitHub Pages.

Typical workflow:
	•	repo: gpx-segment-compare
	•	branch: main
	•	GitHub Action builds /dist
	•	deploy to gh-pages

Recommended project setup
	•	TypeScript strict mode on
	•	ESLint + Prettier
	•	Vitest for logic tests
	•	Playwright for a few UI regressions
	•	GitHub Actions:
	•	build
	•	test
	•	deploy

Why static deployment is good here

The user uploads local files and analysis happens in-browser, so there is no server cost, no privacy issue from uploading runs to your backend, and GitHub Pages is sufficient.

16) MVP vs v2: what to build first

MVP

Build this first:
	•	upload up to 5 GPX files
	•	display tracks on Leaflet map
	•	show every raw point as toggleable dots
	•	select exact start/end point per rider
	•	choose one rider as reference route
	•	snap everyone to route
	•	normalize to chosen starts
	•	playback with map markers
	•	table of time gap / distance gap
	•	topo + road map styles

v1.1
	•	upload separate route GPX
	•	consensus route from multiple riders
	•	chart of time gap over route distance
	•	point inspector with hover sync between map and chart

v2
	•	better route averaging with uncertainty band
	•	export comparison session as JSON
	•	shareable URLs with state serialization
	•	split/sector analysis
	•	heatmap of where each rider gained/lost time
	•	mobile layout

17) Exact feature recommendations for your use case

These are the features I would consider non-negotiable.

Non-negotiable
	•	exact per-rider start point
	•	exact per-rider end point
	•	raw point visibility
	•	point index nudge controls
	•	reference route snapping
	•	normalized elapsed time comparison
	•	gap table
	•	route-distance chart
	•	multiple map styles
	•	clear raw vs interpolated distinction

Very worth adding
	•	“Use selected point as rider start”
	•	“Use this route station as common segment start”
	•	“Jump all riders to nearest comparable point”
	•	“Show only points within 5 m of route”
	•	“Highlight sections with high GPS uncertainty”
	•	“Freeze end state when rider finishes”
	•	“Choose comparison basis: leader / selected rider / median rider”

18) Technical decisions I would avoid

A few things sound attractive but will waste time.

Do not:
	•	start with React unless you already want React; this app is geometry-heavy, not app-shell-heavy
	•	start with Mapbox GL unless you truly need vector styling
	•	rely on Leaflet GPX plugins as your analysis engine; they are fine for display, but your comparison logic is custom
	•	average routes by timestamp
	•	compare downhill efforts purely by raw map proximity
	•	hide interpolation from the user

The leaflet-gpx plugin exists and can parse/display GPX plus expose track stats, but your tool needs tighter control over point extraction and alignment than a display-oriented plugin is likely to give you.  ￼

19) Recommended internal formulas

Use these internal concepts:

Elapsed time from chosen rider start

elapsedMs = rawPoint.timeMs - chosenStartPoint.timeMs

Route distance from segment start

segmentDistanceM = snappedRouteDistanceM - routeSegmentStartDistanceM

Gap by distance

gapDistanceM = leaderSegmentDistanceM - riderSegmentDistanceM

Gap by time at same distance

For rider A at distance d:
	•	find time tA(d)
	•	leader time tL(d)
	•	gapTime(d) = tA(d) - tL(d)

That should be the primary charted gap metric.

20) A concrete implementation order

Week 1:
	•	repo scaffolding
	•	file upload
	•	GPX parse
	•	map display
	•	raw point rendering

Week 2:
	•	rider point selection UI
	•	exact start/end trim
	•	point inspector
	•	keyboard nudging

Week 3:
	•	reference route selection
	•	snap-to-route worker
	•	segment extraction
	•	normalized clock

Week 4:
	•	playback
	•	comparison table
	•	chart of gap vs route distance

Week 5:
	•	consensus route builder
	•	uncertainty metrics
	•	more basemaps

Week 6:
	•	polish
	•	tests
	•	deploy to GitHub Pages

21) What I would name the key modules
	•	parseGpxFile(file): Promise<RiderTrack>
	•	computeCumulativeDistance(track): RiderTrack
	•	buildReferenceRoute(source): ReferenceRoute
	•	snapTrackToRoute(track, route): SnappedTrack
	•	trimTrackByPointIndices(track, startIdx, endIdx): RiderTrack
	•	normalizeTrackStart(track, startIdx): NormalizedTrack
	•	interpolateTrackAtElapsedMs(track, t): PlaybackFrame
	•	computeLeaderGaps(frames): GapRow[]
	•	buildConsensusRoute(tracks, options): ReferenceRoute

22) Final recommendation

If your goal is a tool you personally trust, optimize for auditability, not slickness.

That means:
	•	every computed marker should be explainable
	•	every raw point should be inspectable
	•	every start/end choice should be explicit
	•	every snapped route distance should be debuggable
	•	every gap should say whether it comes from raw ping alignment or interpolation

That is the core difference between a toy replay app and a serious downhill-run comparison tool.

If you want, next I can turn this into a full technical spec with:
	•	exact UI wireframe
	•	data structures
	•	algorithm pseudocode
	•	GitHub Pages project scaffold
	•	first-pass TypeScript file layout.