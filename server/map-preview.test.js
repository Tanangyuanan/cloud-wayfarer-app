const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const projectRoot = join(__dirname, "..");
const appSource = readFileSync(join(projectRoot, "prototype/app.js"), "utf8");
const runtimeSource = readFileSync(join(projectRoot, "prototype/map-runtime.js"), "utf8");
const indexSource = readFileSync(join(projectRoot, "prototype/index.html"), "utf8");

test("地图预览使用近景跟随并在进入工作台时校正尺寸", () => {
  assert.match(appSource, /function travelPreviewTrackingZoom\(\) \{[\s\S]*return mobileQuery\.matches \? 13\.5 : 14\.5;/);
  assert.match(runtimeSource, /this\.map\.setZoomAndCenter\(zoom, this\.project\(currentPoint\)/);
  assert.doesNotMatch(runtimeSource, /setZoomAndCenter\(Math\.round\(zoom\)/);
  assert.match(appSource, /travelMapPreview\?\.resize\?\.\(\);\s*if \(travelMapPreview && travelAgentLatLng\)/);
});

test("地图预览逐帧更新车辆，但限制镜头频率以免打断瓦片渲染", () => {
  const renderer = appSource.slice(
    appSource.indexOf("function renderTravelPosition(progress)"),
    appSource.indexOf("function animateTravelMap", appSource.indexOf("function renderTravelPosition(progress)"))
  );
  const previewUpdate = renderer.indexOf("travelMapPreview?.setProgress(routePosition.point, [routePosition.point])");
  const mainThrottle = renderer.indexOf("if (travelMap && now - travelMapLastRenderAt >= 80)");
  assert.ok(previewUpdate >= 0 && previewUpdate < mainThrottle, "预览位置更新应位于主地图节流之外");
  assert.match(renderer, /now - travelPreviewFollowLastUpdate >= 600/);
  assert.match(renderer, /isPointNearViewportEdge\?\.\(routePosition\.point, 0\.3\)/);
  assert.match(renderer, /travelMapPreview\.panTo\(routePosition\.point, !reduceMotion\)/);
  assert.match(appSource, /personalJourney\?\.state\?\.phase === "travelling"[\s\S]*liveJourneySegmentProgress\(personalJourney\.state, Date\.now\(\)\)/);
});

test("地图预览只显示底图与当前位置，不叠加已走轨迹或说明文案", () => {
  assert.match(appSource, /travelMapPreview\?\.setProgress\(routePosition\.point, \[routePosition\.point\]\)/);
  assert.doesNotMatch(indexSource, /LIVE ROUTE|已走的路，都在这里|点击放大地图|正在定位阿镜/);
  assert.doesNotMatch(indexSource, /agent-map-preview-shade|agent-map-preview-copy/);
});

test("跟随镜头只在车辆接近视窗边缘时移动，让车辆在画面内产生可见位移", () => {
  const renderer = appSource.slice(
    appSource.indexOf("function renderTravelPosition(progress)"),
    appSource.indexOf("function animateTravelMap", appSource.indexOf("function renderTravelPosition(progress)"))
  );
  const edgeChecks = runtimeSource.match(/isPointNearViewportEdge\(currentPoint, marginRatio = 0\.24\)/g) || [];
  assert.equal(edgeChecks.length, 2, "Leaflet 与高德运行时都应按视窗边缘判断是否跟随");
  assert.match(renderer, /travelMapExpanded \? 0\.18 : 0\.28/);
  assert.doesNotMatch(renderer, /cameraDistance > 55|previewCameraDistance > 70/);
});

test("隐藏下一站时不再用完整道路几何泄露方向", () => {
  const initializer = appSource.slice(
    appSource.indexOf("async function initializeTravelMap(journey"),
    appSource.indexOf("function renderTravelPosition", appSource.indexOf("async function initializeTravelMap(journey"))
  );
  assert.match(initializer, /const visibleStops = hidesTarget \? routingStops\.slice\(0, currentIndex \+ 1\) : routingStops;/);
  assert.match(initializer, /hideFutureRoute: true,/);
  assert.match(initializer, /travelMapPreview\?\.setRoute\?\.\(travelRouteLatLngs, true\)/);
  assert.match(initializer, /只显示已经发生的轨迹 · 下一段未公开/);
  assert.doesNotMatch(initializer, /hideFutureRoute: false/);
});

test("预览车辆不依赖主地图或本地状态类才能移动", () => {
  const renderer = appSource.slice(
    appSource.indexOf("function renderTravelPosition(progress)"),
    appSource.indexOf("function animateTravelMap", appSource.indexOf("function renderTravelPosition(progress)"))
  );
  const animator = appSource.slice(
    appSource.indexOf("function animateTravelMap(timestamp)"),
    appSource.indexOf("async function toggleTravelPause", appSource.indexOf("function animateTravelMap(timestamp)"))
  );
  const journeyRenderer = appSource.slice(
    appSource.indexOf("function renderAgentJourneyState(journey)"),
    appSource.indexOf("function syncJourneySettingsFromServer", appSource.indexOf("function renderAgentJourneyState(journey)"))
  );

  assert.match(renderer, /if \(routePosition\) \{/);
  assert.doesNotMatch(renderer, /if \(routePosition && travelMap\)/);
  assert.match(renderer, /if \(travelMap && now - travelMapLastRenderAt >= 80\)/);
  assert.match(animator, /const serverJourneyTravelling = personalJourney\?\.state\?\.phase === "travelling";/);
  assert.match(animator, /\(serverJourneyTravelling \|\| localJourneyTravelling\)/);
  assert.doesNotMatch(animator, /\(serverJourneyTravelling \|\| localJourneyTravelling\) && !reduceMotion/);
  assert.doesNotMatch(animator, /body\.classList\.contains\("is-ai-travelling"\) && !reduceMotion/);
  assert.match(journeyRenderer, /body\.classList\.toggle\("is-ai-travelling", journeyIsActive\)/);
});

test("地图预览不再等待远程路线请求才创建", () => {
  const initializer = appSource.slice(
    appSource.indexOf("async function initializeTravelMap(journey"),
    appSource.indexOf("function renderTravelPosition", appSource.indexOf("async function initializeTravelMap(journey"))
  );
  const previewStart = initializer.indexOf("initializeTravelMapPreview(routingStops)");
  const routeStart = initializer.indexOf("fetchJourneyRouteSegments(routingStops, travelMode)");
  assert.ok(previewStart >= 0, "应在主地图初始化中启动预览");
  assert.ok(routeStart > previewStart, "预览应先于路线请求启动");
  assert.match(runtimeSource, /async function planRouteSegment\(start, end, mode = "自驾"\)/);
  assert.match(runtimeSource, /setRoute\(route, hideFutureRoute = false\)/);
});

test("主地图与预览共享高德 SDK 加载，避免预览竞态降级", () => {
  assert.match(runtimeSource, /let amapLoadPromise = null;/);
  assert.match(runtimeSource, /if \(amapLoadPromise\) return amapLoadPromise;/);
  assert.match(runtimeSource, /amapLoadPromise = loading;/);
  assert.match(appSource, /hideFutureRoute: true,\s*showControls: false,\s*mode: travelMode/);
  assert.match(runtimeSource, /if \(this\.options\.showControls !== false\)/);
  assert.match(appSource, /previewContainer\.className = "workspace-mini-map-canvas real-map";/);
  assert.match(appSource, /document\.createElement\("div"\)/);
  assert.match(appSource, /container: previewContainer,/);
  assert.match(appSource, /if \(travelMapPreviewInitialization\) return travelMapPreviewInitialization;/);
  assert.match(appSource, /travelMapPreviewInitialization = initialization;/);
  assert.doesNotMatch(appSource, /travelMapPreview\?\.destroy\?\.\(\);\s*const previewContainer/);
});

test("过期主地图请求不会覆盖最新路线", () => {
  assert.match(appSource, /const nextRouteSegments = await segmentRequest;[\s\S]*if \(buildToken !== travelMapBuildToken\) return;[\s\S]*travelRouteSegments = nextRouteSegments;/);
});

test("每种交通方式使用自己的高德算路端点", () => {
  assert.match(runtimeSource, /mode === "步行"[\s\S]*id: "walking"/);
  assert.match(runtimeSource, /mode === "自行车"[\s\S]*id: "bicycling"/);
  assert.match(runtimeSource, /mode === "电动车"[\s\S]*id: "electrobike"/);
  assert.match(runtimeSource, /`https:\/\/restapi\.amap\.com\/v5\/direction\/\$\{routeMode\.id\}`/);
});

test("自驾模式显示小汽车而不是人物标记", () => {
  const markerRenderer = runtimeSource.slice(
    runtimeSource.indexOf("function agentMarkerHtml"),
    runtimeSource.indexOf("function applyAgentHeading")
  );
  assert.match(markerRenderer, /if \(mode === "自驾"\)[\s\S]*assets\/travel-car-top\.svg/);
  assert.doesNotMatch(markerRenderer, /if \(mode === "自驾"\)[\s\S]*travel-ajing-marker-image2\.png/);
  assert.match(runtimeSource, /querySelector\?\.\("\.agent-vehicle-marker"\)/);
});

test("历史路线按段缓存，并用段边界计算进度", () => {
  assert.match(appSource, /ROUTE_SEGMENT_CACHE_STORAGE_KEY/);
  assert.match(appSource, /persistTravelRouteSegment\(key, segment\)/);
  assert.match(appSource, /travelRouteStopDistances\.push\(travelRouteDistance\)/);
  assert.match(appSource, /function routeProgressForStopIndex\(index\)/);
  assert.doesNotMatch(appSource, /function routeProgressForStop\(stop\)/);
});

test("展开地图同时显示真实道路时间与云游进度", () => {
  assert.match(indexSource, /id="travel-location"/);
  assert.match(indexSource, /id="travel-eta"/);
  assert.match(indexSource, /id="travel-route-detail"/);
  assert.match(indexSource, /id="travel-sim-eta"/);
  assert.match(appSource, /travelActiveSegmentMeta\?\.durationSeconds/);
  assert.match(appSource, /本次云游剩余/);
});

test("真实道路时长会同步到服务端并按节奏倍率推进", () => {
  assert.match(appSource, /action: "sync_route_timing"/);
  assert.match(appSource, /realDurationSeconds/);
  assert.match(appSource, /syncActiveJourneyRouteTiming\(journey, travelActiveSegmentMeta\)/);
  assert.match(appSource, /"实时同行": \{ fallbackMinutes: 40, multiplier: 1/);
  assert.match(appSource, /"沉浸节奏": \{ fallbackMinutes: 30, multiplier: 10/);
  assert.match(appSource, /"快速云游": \{ fallbackMinutes: 8, multiplier: 40/);
  assert.match(indexSource, /data-pace="实时同行"[\s\S]*按真实道路时间/);
  assert.match(indexSource, /data-pace="沉浸节奏"[\s\S]*约 10× 加速/);
  assert.match(indexSource, /data-pace="快速云游"[\s\S]*约 40× 加速/);
  assert.doesNotMatch(indexSource, /分钟 \/ 路段/);
});

test("旅程轮询不会重复启动同一份未完成的地图构建", () => {
  assert.match(appSource, /let travelMapPendingSignature = "";/);
  assert.match(appSource, /signature === travelMapSignature \|\| signature === travelMapPendingSignature/);
  assert.match(appSource, /travelMapPendingSignature = signature;[\s\S]*\.finally\(\(\) => \{[\s\S]*travelMapPendingSignature === signature/);
});
