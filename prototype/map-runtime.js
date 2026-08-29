(function installCloudWayfarerMapRuntime() {
  const DEFAULT_CONFIG = {
    provider: "auto",
    amapKey: "",
    amapSecurityJsCode: "",
    amapWebServiceKey: "",
    nearbyRadius: 3000
  };
  let amapLoadPromise = null;

  function getConfig() {
    return { ...DEFAULT_CONFIG, ...(window.CLOUD_WAYFARER_MAP_CONFIG || {}) };
  }

  function point(lat, lng) {
    return { lat: Number(lat), lng: Number(lng) };
  }

  function toRadians(value) {
    return value * Math.PI / 180;
  }

  function distanceBetween(a, b) {
    const earthRadius = 6371008.8;
    const latDelta = toRadians(b.lat - a.lat);
    const lngDelta = toRadians(b.lng - a.lng);
    const latA = toRadians(a.lat);
    const latB = toRadians(b.lat);
    const haversine = Math.sin(latDelta / 2) ** 2
      + Math.cos(latA) * Math.cos(latB) * Math.sin(lngDelta / 2) ** 2;
    return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(haversine)));
  }

  function headingBetween(a, b) {
    const latA = toRadians(a.lat);
    const latB = toRadians(b.lat);
    const lngDelta = toRadians(b.lng - a.lng);
    const y = Math.sin(lngDelta) * Math.cos(latB);
    const x = Math.cos(latA) * Math.sin(latB)
      - Math.sin(latA) * Math.cos(latB) * Math.cos(lngDelta);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  function outsideChina(lat, lng) {
    return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
  }

  function transformLat(lng, lat) {
    let result = -100 + 2 * lng + 3 * lat + 0.2 * lat * lat
      + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
    result += (20 * Math.sin(6 * lng * Math.PI) + 20 * Math.sin(2 * lng * Math.PI)) * 2 / 3;
    result += (20 * Math.sin(lat * Math.PI) + 40 * Math.sin(lat / 3 * Math.PI)) * 2 / 3;
    result += (160 * Math.sin(lat / 12 * Math.PI) + 320 * Math.sin(lat * Math.PI / 30)) * 2 / 3;
    return result;
  }

  function transformLng(lng, lat) {
    let result = 300 + lng + 2 * lat + 0.1 * lng * lng
      + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
    result += (20 * Math.sin(6 * lng * Math.PI) + 20 * Math.sin(2 * lng * Math.PI)) * 2 / 3;
    result += (20 * Math.sin(lng * Math.PI) + 40 * Math.sin(lng / 3 * Math.PI)) * 2 / 3;
    result += (150 * Math.sin(lng / 12 * Math.PI) + 300 * Math.sin(lng / 30 * Math.PI)) * 2 / 3;
    return result;
  }

  // OSM/GeoNames 等开放数据一般使用 WGS84；高德在中国大陆使用 GCJ-02。
  function wgs84ToGcj02(source) {
    const { lat, lng } = source;
    if (outsideChina(lat, lng)) return point(lat, lng);
    const axis = 6378245;
    const eccentricity = 0.006693421622965943;
    let deltaLat = transformLat(lng - 105, lat - 35);
    let deltaLng = transformLng(lng - 105, lat - 35);
    const radLat = toRadians(lat);
    let magic = Math.sin(radLat);
    magic = 1 - eccentricity * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    deltaLat = deltaLat * 180 / ((axis * (1 - eccentricity)) / (magic * sqrtMagic) * Math.PI);
    deltaLng = deltaLng * 180 / (axis / sqrtMagic * Math.cos(radLat) * Math.PI);
    return point(lat + deltaLat, lng + deltaLng);
  }

  function gcj02ToWgs84(source) {
    if (outsideChina(source.lat, source.lng)) return point(source.lat, source.lng);
    let estimate = point(source.lat, source.lng);
    for (let index = 0; index < 3; index += 1) {
      const projected = wgs84ToGcj02(estimate);
      estimate = point(
        estimate.lat + source.lat - projected.lat,
        estimate.lng + source.lng - projected.lng
      );
    }
    return estimate;
  }

  function loadAmap(config) {
    if (window.AMap) return Promise.resolve(window.AMap);
    if (!config.amapKey) return Promise.reject(new Error("未配置高德地图 Key"));
    if (amapLoadPromise) return amapLoadPromise;
    window._AMapSecurityConfig = {
      securityJsCode: config.amapSecurityJsCode || ""
    };
    const loading = new Promise((resolve, reject) => {
      const callbackName = `__cloud_wayfarerAmapReady${Date.now()}`;
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("高德地图组件加载超时"));
      }, 12000);
      const cleanup = () => {
        window.clearTimeout(timeout);
        delete window[callbackName];
      };
      window[callbackName] = () => {
        cleanup();
        resolve(window.AMap);
      };
      const script = document.createElement("script");
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(config.amapKey)}&plugin=AMap.ToolBar,AMap.Scale&callback=${callbackName}`;
      script.async = true;
      script.onerror = () => {
        cleanup();
        reject(new Error("高德地图组件加载失败"));
      };
      document.head.appendChild(script);
    });
    amapLoadPromise = loading;
    loading.catch(() => {
      if (amapLoadPromise === loading) amapLoadPromise = null;
    });
    return loading;
  }

  function uniquePois(items) {
    const seen = new Set();
    return items.filter((item) => {
      const key = `${item.name || ""}|${item.address || ""}`;
      if (!item.name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function resolveRouteMode(mode = "自驾") {
    if (mode === "步行") return { id: "walking", label: "步行", fallbackSpeedMps: 1.25 };
    if (mode === "自行车" || mode === "骑行") return { id: "bicycling", label: "自行车", fallbackSpeedMps: 4.2 };
    if (mode === "电动车" || mode === "电动自行车") return { id: "electrobike", label: "电动车", fallbackSpeedMps: 7.2 };
    return { id: "driving", label: mode === "阿镜决定" ? "自驾（阿镜决定）" : "自驾", fallbackSpeedMps: 13.9 };
  }

  function parseRoutePath(route) {
    const path = [];
    (route?.steps || []).forEach((step) => {
      String(step.polyline || "").split(";").forEach((pair) => {
        const [lng, lat] = pair.split(",").map(Number);
        const previous = path[path.length - 1];
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
        if (previous && Math.abs(previous[0] - lng) < 0.000001 && Math.abs(previous[1] - lat) < 0.000001) return;
        path.push([lng, lat]);
      });
    });
    return path;
  }

  async function requestAmapRouteSegment(start, end, mode, config) {
    if (!config.amapWebServiceKey) throw new Error("未配置高德 Web 服务 Key");
    const routeMode = resolveRouteMode(mode);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    const url = new URL(`https://restapi.amap.com/v5/direction/${routeMode.id}`);
    const params = {
      origin: wgs84ToGcj02(start),
      destination: wgs84ToGcj02(end)
    };
    url.search = new URLSearchParams({
      origin: `${params.origin.lng.toFixed(6)},${params.origin.lat.toFixed(6)}`,
      destination: `${params.destination.lng.toFixed(6)},${params.destination.lat.toFixed(6)}`,
      ...(routeMode.id === "driving" ? { strategy: "32", ferry: "1" } : {}),
      show_fields: "cost,polyline",
      key: config.amapWebServiceKey,
      output: "json"
    });
    try {
      const response = await window.fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`高德服务请求失败：${response.status}`);
      const result = await response.json();
      if (result.status !== "1") throw new Error(result.info || "高德服务没有返回结果");
      const route = result.route?.paths?.[0];
      const gcjPath = parseRoutePath(route);
      if (!route || gcjPath.length < 2) throw new Error("高德服务没有返回可用路线");
      return {
        points: gcjPath.map(([lng, lat]) => gcj02ToWgs84(point(lat, lng))),
        distanceMeters: Number(route.distance) || null,
        durationSeconds: Number(route.cost?.duration ?? route.duration) || null,
        source: `amap-${routeMode.id}`,
        mode: routeMode.label,
        available: true
      };
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function requestOsrmDrivingSegment(start, end) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 9000);
    const coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`;
    try {
      const response = await window.fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`, { signal: controller.signal });
      if (!response.ok) throw new Error(`OSRM ${response.status}`);
      const data = await response.json();
      const route = data.routes?.[0];
      const points = route?.geometry?.coordinates?.map(([lng, lat]) => point(lat, lng));
      if (!points || points.length < 2) throw new Error("OSRM 没有返回可用路线");
      return {
        points,
        distanceMeters: Number(route.distance) || null,
        durationSeconds: Number(route.duration) || null,
        source: "osrm-driving",
        mode: "自驾",
        available: true
      };
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function planRouteSegment(start, end, mode = "自驾") {
    const routeMode = resolveRouteMode(mode);
    const config = getConfig();
    try {
      return await requestAmapRouteSegment(start, end, mode, config);
    } catch (amapError) {
      if (routeMode.id === "driving") {
        try { return await requestOsrmDrivingSegment(start, end); } catch { /* truthful fallback below */ }
      }
      const distanceMeters = distanceBetween(start, end);
      return {
        points: [point(start.lat, start.lng), point(end.lat, end.lng)],
        distanceMeters,
        durationSeconds: Math.round(distanceMeters / routeMode.fallbackSpeedMps),
        source: "unavailable",
        mode: routeMode.label,
        available: false,
        error: amapError?.message || "当前交通方式暂时无法算路"
      };
    }
  }

  function agentMarkerHtml(mode = "自驾", heading = 0) {
    if (mode === "自驾") {
      return `<span class="agent-vehicle-marker" style="--agent-heading:${heading}deg"><span class="agent-vehicle-glow"></span><img class="agent-vehicle-asset" src="assets/travel-car-top.svg" alt="" draggable="false"><b class="agent-vehicle-badge">镜</b></span>`;
    }
    if (mode === "骑行" || mode === "自行车" || mode === "电动车" || mode === "电动自行车") {
      const electric = mode === "电动车" || mode === "电动自行车";
      const source = electric ? "assets/travel-ebike.svg" : "assets/travel-bicycle.svg";
      const markerClass = electric ? " is-electric" : "";
      return `<span class="agent-ride-marker${markerClass}"><span class="agent-ride-glow"></span><img class="agent-ride-asset" src="${source}" alt="" draggable="false"><b class="agent-vehicle-badge">镜</b></span>`;
    }
    const label = mode === "步行" ? "步" : "镜";
    return `<span class="agent-live-dot is-mode"><i></i><b>${label}</b></span>`;
  }

  function applyAgentHeading(root, heading) {
    const marker = root?.querySelector?.(".agent-vehicle-marker");
    marker?.style.setProperty("--agent-heading", `${heading}deg`);
  }

  class LeafletRuntime {
    constructor(options) {
      this.provider = "osm";
      this.options = options;
      this.map = null;
      this.progressLayer = null;
      this.routeShadowLayer = null;
      this.routePlanLayer = null;
      this.agentMarker = null;
      this.agentPoint = null;
      this.agentHeading = 0;
      this.stopMarkers = new Map();
      this.routePoints = options.route;
      this.routeSource = options.routeMeta?.source || "snapshot";
      this.routeMeta = options.routeMeta || null;
    }

    async initialize() {
      if (!window.L) throw new Error("OpenStreetMap 地图组件没有载入");
      const { container, route, stops } = this.options;
      this.map = window.L.map(container, {
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true,
        minZoom: 6,
        maxZoom: 18,
        zoomSnap: 0.25,
        zoomDelta: 0.5
      });
      const tileLayer = window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        minZoom: 6,
        maxZoom: 18,
        detectRetina: true
      });
      let tileErrors = 0;
      tileLayer.on("load", () => this.options.onReady?.());
      tileLayer.on("tileerror", () => {
        tileErrors += 1;
        if (tileErrors > 5) this.options.onError?.("道路路线已经载入，地图底图暂时无法连接。");
      });
      tileLayer.addTo(this.map);
      if (this.options.showControls !== false) {
        window.L.control.zoom({ position: "topright" }).addTo(this.map);
      }

      const leafletRoute = route.map((entry) => window.L.latLng(entry.lat, entry.lng));
      this.routeShadowLayer = window.L.polyline(leafletRoute, {
        className: "real-route-shadow",
        color: "#10231a",
        opacity: this.options.hideFutureRoute ? 0 : 0.72,
        weight: 11,
        lineCap: "round",
        lineJoin: "round",
        interactive: false
      }).addTo(this.map);
      this.routePlanLayer = window.L.polyline(leafletRoute, {
        className: "real-route-plan",
        color: "#fff5d8",
        opacity: this.options.hideFutureRoute ? 0 : 0.92,
        weight: 4,
        dashArray: "2 10",
        lineCap: "round",
        lineJoin: "round",
        interactive: false
      }).addTo(this.map);
      this.progressLayer = window.L.polyline([], {
        className: "real-route-progress",
        color: "#d99a43",
        opacity: 1,
        weight: 6,
        lineCap: "round",
        lineJoin: "round",
        interactive: false
      }).addTo(this.map);

      stops.forEach((stop, index) => {
        const marker = window.L.marker([stop.lat, stop.lng], {
          icon: window.L.divIcon({
            className: `cloud_wayfarer-stop-icon is-${stop.state}`,
            html: `<span>${String(index + 1).padStart(2, "0")}</span>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          }),
          keyboard: true,
          riseOnHover: true,
          title: `${stop.name}：${stop.detail}`
        }).addTo(this.map);
        marker.bindTooltip(`<b>${stop.name}</b><small>${stop.detail}</small>`, {
          permanent: true,
          className: "cloud_wayfarer-stop-tooltip",
          direction: stop.direction,
          offset: stop.direction === "left" ? [-12, 0] : [12, 0]
        });
        marker.on("click", () => this.options.onStopClick?.(stop));
        this.stopMarkers.set(stop.name, marker);
      });

      this.agentPoint = route[0];
      this.agentMarker = window.L.marker([route[0].lat, route[0].lng], {
        icon: window.L.divIcon({
          className: "cloud_wayfarer-agent-icon",
          html: agentMarkerHtml(this.options.mode, this.agentHeading),
          iconSize: [84, 84],
          iconAnchor: [42, 42]
        }),
        keyboard: false,
        interactive: false,
        zIndexOffset: 1000
      }).addTo(this.map);
      this.map.on("dragstart", () => this.options.onDrag?.());
      window.setTimeout(() => this.resize(), 0);
      return this;
    }

    setProgress(currentPoint, travelled) {
      if (this.agentPoint && distanceBetween(this.agentPoint, currentPoint) > 1) {
        this.agentHeading = headingBetween(this.agentPoint, currentPoint);
      }
      this.agentPoint = currentPoint;
      this.agentMarker?.setLatLng([currentPoint.lat, currentPoint.lng]);
      this.progressLayer?.setLatLngs(travelled.map((entry) => [entry.lat, entry.lng]));
      applyAgentHeading(this.agentMarker?.getElement(), this.agentHeading);
    }

    setMode(mode) {
      this.options.mode = mode;
      this.agentMarker?.setIcon(window.L.divIcon({
        className: "cloud_wayfarer-agent-icon",
        html: agentMarkerHtml(mode, this.agentHeading),
        iconSize: [84, 84],
        iconAnchor: [42, 42]
      }));
    }

    setRoute(route, hideFutureRoute = false) {
      const latLngs = route.map((entry) => [entry.lat, entry.lng]);
      this.routeShadowLayer?.setLatLngs(latLngs);
      this.routePlanLayer?.setLatLngs(latLngs);
      this.routeShadowLayer?.setStyle({ opacity: hideFutureRoute ? 0 : 0.72 });
      this.routePlanLayer?.setStyle({ opacity: hideFutureRoute ? 0 : 0.92 });
    }

    setView(currentPoint, zoom, animate = true) {
      this.map?.setView([currentPoint.lat, currentPoint.lng], zoom, {
        animate,
        duration: 0.65
      });
    }

    panTo(currentPoint, animate = true) {
      this.map?.panTo([currentPoint.lat, currentPoint.lng], {
        animate,
        duration: 0.75,
        noMoveStart: true
      });
    }

    distanceFromCenter(currentPoint) {
      const center = this.map?.getCenter();
      return center ? center.distanceTo([currentPoint.lat, currentPoint.lng]) : 0;
    }

    isPointNearViewportEdge(currentPoint, marginRatio = 0.24) {
      if (!this.map) return false;
      const size = this.map.getSize();
      const projected = this.map.latLngToContainerPoint([currentPoint.lat, currentPoint.lng]);
      const margin = Math.max(0.05, Math.min(0.45, Number(marginRatio) || 0.24));
      return projected.x <= size.x * margin
        || projected.x >= size.x * (1 - margin)
        || projected.y <= size.y * margin
        || projected.y >= size.y * (1 - margin);
    }

    resize() {
      this.map?.invalidateSize();
    }

    destroy() {
      this.map?.remove();
      this.map = null;
    }

    focusStop(name) {
      const marker = this.stopMarkers.get(name);
      if (!marker || !this.map) return false;
      this.map.flyTo(marker.getLatLng(), Math.max(10, this.map.getZoom()), {
        animate: true,
        duration: 0.7
      });
      marker.openTooltip();
      return true;
    }

    async discoverNearby() {
      return null;
    }
  }

  class AmapRuntime {
    constructor(options, config) {
      this.provider = "amap";
      this.options = options;
      this.config = config;
      this.map = null;
      this.progressLayer = null;
      this.agentMarker = null;
      this.agentPoint = null;
      this.agentHeading = 0;
      this.stopMarkers = new Map();
      this.routeShadowLayer = null;
      this.routePlanLayer = null;
      this.routePoints = options.route;
      this.routeSource = options.routeMeta?.source || "snapshot";
      this.routeMeta = options.routeMeta || null;
    }

    project(source) {
      const converted = wgs84ToGcj02(source);
      return [converted.lng, converted.lat];
    }

    async initialize() {
      const AMap = await loadAmap(this.config);
      const { container, route, stops } = this.options;
      this.map = new AMap.Map(container, {
        viewMode: "2D",
        pitch: 0,
        rotation: 0,
        zoom: 11.5,
        zooms: [6, 18],
        mapStyle: "amap://styles/normal",
        showLabel: true,
        features: ["bg", "road", "building", "point"]
      });
      this.map.on("complete", () => this.options.onReady?.());
      if (this.options.showControls !== false) {
        if (AMap.ToolBar) this.map.addControl(new AMap.ToolBar({ position: { top: "96px", right: "20px" } }));
        if (AMap.Scale) this.map.addControl(new AMap.Scale({ position: { bottom: "72px", left: "20px" } }));
      }

      const amapRoute = route.map((entry) => this.project(entry));
      this.routeShadowLayer = new AMap.Polyline({
        path: amapRoute,
        strokeColor: "#10231a",
        strokeOpacity: this.options.hideFutureRoute ? 0 : 0.74,
        strokeWeight: 11,
        lineJoin: "round",
        lineCap: "round",
        zIndex: 40
      });
      this.map.add(this.routeShadowLayer);
      this.routePlanLayer = new AMap.Polyline({
        path: amapRoute,
        strokeColor: "#fff5d8",
        strokeOpacity: this.options.hideFutureRoute ? 0 : 0.92,
        strokeWeight: 4,
        strokeStyle: "dashed",
        strokeDasharray: [2, 10],
        lineJoin: "round",
        lineCap: "round",
        zIndex: 41
      });
      this.map.add(this.routePlanLayer);
      this.progressLayer = new AMap.Polyline({
        path: amapRoute.slice(0, 1),
        strokeColor: "#d99a43",
        strokeOpacity: 1,
        strokeWeight: 6,
        lineJoin: "round",
        lineCap: "round",
        zIndex: 42
      });
      this.map.add(this.progressLayer);

      stops.forEach((stop, index) => {
        const marker = new AMap.Marker({
          position: this.project(stop),
          anchor: "center",
          content: `<span class="cloud_wayfarer-stop-icon is-${stop.state}"><span>${String(index + 1).padStart(2, "0")}</span></span>`,
          title: `${stop.name}：${stop.detail}`,
          label: {
            direction: stop.direction === "left" ? "left" : "right",
            offset: stop.direction === "left" ? new AMap.Pixel(-12, 0) : new AMap.Pixel(12, 0),
            content: `<span class="cloud_wayfarer-stop-tooltip amap-stop-tooltip"><b>${stop.name}</b><small>${stop.detail}</small></span>`
          },
          zIndex: 120
        });
        marker.on("click", () => this.options.onStopClick?.(stop));
        this.map.add(marker);
        this.stopMarkers.set(stop.name, marker);
      });

      this.agentPoint = route[0];
      this.agentMarker = new AMap.Marker({
        position: this.project(route[0]),
        anchor: "center",
        content: `<span class="cloud_wayfarer-agent-icon">${agentMarkerHtml(this.options.mode, this.agentHeading)}</span>`,
        offset: new AMap.Pixel(0, 0),
        zIndex: 300
      });
      this.map.add(this.agentMarker);
      this.map.on("dragstart", () => this.options.onDrag?.());
      return this;
    }

    async requestWebService(pathname, params) {
      if (!this.config.amapWebServiceKey) throw new Error("未配置高德 Web 服务 Key");
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12000);
      const url = new URL(`https://restapi.amap.com${pathname}`);
      url.search = new URLSearchParams({
        ...params,
        key: this.config.amapWebServiceKey,
        output: "json"
      });
      try {
        const response = await window.fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`高德服务请求失败：${response.status}`);
        const result = await response.json();
        if (result.status !== "1") throw new Error(result.info || "高德服务没有返回结果");
        return result;
      } finally {
        window.clearTimeout(timeout);
      }
    }

    parseWebRoutePath(route) {
      const path = [];
      (route.steps || []).forEach((step) => {
        String(step.polyline || "").split(";").forEach((pair) => {
          const [lng, lat] = pair.split(",").map(Number);
          const previous = path[path.length - 1];
          if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
          if (previous && Math.abs(previous[0] - lng) < 0.000001 && Math.abs(previous[1] - lat) < 0.000001) return;
          path.push([lng, lat]);
        });
      });
      return path;
    }

    async planDrivingRoute(stops) {
      try {
        const projectedStops = stops.map((stop) => this.project(stop));
        const result = await this.requestWebService("/v5/direction/driving", {
          origin: projectedStops[0].join(","),
          destination: projectedStops[projectedStops.length - 1].join(","),
          waypoints: projectedStops.slice(1, -1).map((entry) => entry.join(",")).join(";"),
          strategy: "32",
          ferry: "1",
          show_fields: "cost,polyline"
        });
        const route = result.route?.paths?.[0];
        if (!route) return false;
        const gcjPath = this.parseWebRoutePath(route);
        if (gcjPath.length < 2) return false;
        this.routeShadowLayer.setPath(gcjPath);
        this.routePlanLayer.setPath(gcjPath);
        this.progressLayer.setPath(gcjPath.slice(0, 2));
        this.routePoints = gcjPath.map(([lng, lat]) => gcj02ToWgs84(point(lat, lng)));
        this.routeSource = "amap-driving";
        this.routeMeta = {
          distanceMeters: Number(route.distance) || null,
          durationSeconds: Number(route.cost?.duration) || null,
          pointCount: this.routePoints.length
        };
        return true;
      } catch (error) {
        return false;
      }
    }

    setProgress(currentPoint, travelled) {
      if (this.agentPoint && distanceBetween(this.agentPoint, currentPoint) > 1) {
        this.agentHeading = headingBetween(this.agentPoint, currentPoint);
      }
      this.agentPoint = currentPoint;
      this.agentMarker?.setPosition(this.project(currentPoint));
      this.progressLayer?.setPath(travelled.map((entry) => this.project(entry)));
      applyAgentHeading(this.map?.getContainer()?.querySelector(".cloud_wayfarer-agent-icon"), this.agentHeading);
    }

    setMode(mode) {
      this.options.mode = mode;
      this.agentMarker?.setContent(`<span class="cloud_wayfarer-agent-icon">${agentMarkerHtml(mode, this.agentHeading)}</span>`);
    }

    setRoute(route, hideFutureRoute = false) {
      const path = route.map((entry) => this.project(entry));
      this.routePoints = route;
      this.routeShadowLayer?.setPath(path);
      this.routePlanLayer?.setPath(path);
      this.routeShadowLayer?.setOptions({ strokeOpacity: hideFutureRoute ? 0 : 0.74 });
      this.routePlanLayer?.setOptions({ strokeOpacity: hideFutureRoute ? 0 : 0.92 });
    }

    setView(currentPoint, zoom, animate = true) {
      if (!this.map) return;
      this.map.setZoomAndCenter(zoom, this.project(currentPoint), !animate, animate ? 520 : 0);
    }

    panTo(currentPoint, animate = true) {
      this.map?.panTo(this.project(currentPoint), animate ? 520 : 0);
    }

    distanceFromCenter(currentPoint) {
      const center = this.map?.getCenter();
      if (!center) return 0;
      const target = this.project(currentPoint);
      return window.AMap.GeometryUtil.distance([center.lng, center.lat], target);
    }

    isPointNearViewportEdge(currentPoint, marginRatio = 0.24) {
      if (!this.map) return false;
      const container = this.map.getContainer();
      const projected = this.map.lngLatToContainer(this.project(currentPoint));
      const x = Number(projected?.x ?? projected?.getX?.());
      const y = Number(projected?.y ?? projected?.getY?.());
      const width = container?.clientWidth || 0;
      const height = container?.clientHeight || 0;
      if (!Number.isFinite(x) || !Number.isFinite(y) || !width || !height) return false;
      const margin = Math.max(0.05, Math.min(0.45, Number(marginRatio) || 0.24));
      return x <= width * margin
        || x >= width * (1 - margin)
        || y <= height * margin
        || y >= height * (1 - margin);
    }

    resize() {
      this.map?.resize();
    }

    destroy() {
      this.map?.destroy();
      this.map = null;
    }

    focusStop(name) {
      const marker = this.stopMarkers.get(name);
      if (!marker || !this.map) return false;
      this.map.setZoomAndCenter(Math.max(11, this.map.getZoom()), marker.getPosition(), false, 520);
      return true;
    }

    async reverseGeocode(center) {
      try {
        const result = await this.requestWebService("/v3/geocode/regeo", {
          location: center.join(","),
          radius: String(this.config.nearbyRadius),
          extensions: "all"
        });
        const regeocode = result.regeocode;
        const pois = (regeocode?.pois || []).map((poi) => ({
          id: poi.id,
          name: poi.name,
          type: poi.type,
          address: poi.address,
          distance: Number(poi.distance) || null,
          source: "amap"
        }));
        return { address: regeocode?.formatted_address || "当前位置附近", pois, unavailable: false };
      } catch (error) {
        return { address: "当前位置附近", pois: [], unavailable: true };
      }
    }

    async searchNearby(center) {
      try {
        const result = await this.requestWebService("/v3/place/around", {
          location: center.join(","),
          keywords: "景区|博物馆|古迹|村寨|公园",
          radius: String(this.config.nearbyRadius),
          offset: "12",
          page: "1",
          extensions: "base"
        });
        return {
          unavailable: false,
          pois: (result.pois || []).map((poi) => ({
            id: poi.id,
            name: poi.name,
            type: poi.type,
            address: poi.address,
            distance: Number(poi.distance) || null,
            source: "amap"
          }))
        };
      } catch (error) {
        return { pois: [], unavailable: true };
      }
    }

    async discoverNearby(sourcePoint) {
      const center = this.project(sourcePoint);
      const [geocode, searched] = await Promise.all([
        this.reverseGeocode(center),
        this.searchNearby(center)
      ]);
      const pois = uniquePois([...searched.pois, ...geocode.pois])
        .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
        .slice(0, 6);
      return {
        provider: "amap",
        address: geocode.address,
        radius: this.config.nearbyRadius,
        unavailable: geocode.unavailable && searched.unavailable,
        pois
      };
    }
  }

  async function create(options) {
    const config = getConfig();
    const wantsAmap = config.provider === "amap"
      || (config.provider === "auto" && Boolean(config.amapKey));
    if (wantsAmap) {
      try {
        return await new AmapRuntime(options, config).initialize();
      } catch (error) {
        options.onProviderFallback?.(error);
      }
    }
    return new LeafletRuntime(options).initialize();
  }

  window.CloudWayfarerMapRuntime = {
    create,
    point,
    distanceBetween,
    planRouteSegment,
    resolveRouteMode,
    getConfig
  };
})();
