// BUILD_TIMESTAMP_2026_07_23_v100 - Force Metro Cache Invalidation
export const HTML_SOURCE = `<!DOCTYPE html>
<html lang="vi">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>SmartMarketBot - Master Blueprint 3D Map</title>

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
    rel="stylesheet">

  <!-- Three.js & Plugins -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/tween.js/18.6.4/tween.umd.js"></script>

  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }

    body {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background-color: #0B0F17;
      color: #F8FAFC;
    }

    #webgl-container {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1;
    }

    .ui-overlay {
      display: none !important;
    }

    .header, .control-panel, .legend-overlay, .touch-tip {
      display: none !important;
    }
  </style>
</head>

<body>

  <div id="webgl-container"></div>

  <script>
    // ───────────── 1. THREE.JS SCENE SETUP ─────────────
    const container = document.getElementById('webgl-container');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0B0F17);
    scene.fog = new THREE.FogExp2(0x0B0F17, 0.12);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 50);
    camera.position.set(1.5, 4.8, 4.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(1.5, 0.3, 1.5);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minDistance = 0.8;
    controls.maxDistance = 12.0;
    controls.update();

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.9);
    mainLight.position.set(4, 7, 2);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.bias = -0.0005;
    scene.add(mainLight);

    function addCeilingLight(x, z, color = 0x38BDF8) {
      const pLight = new THREE.PointLight(color, 1.2, 3.5);
      pLight.position.set(x, 1.8, z);
      scene.add(pLight);
    }
    addCeilingLight(0.8, 2.2, 0x34D399); // Green Shelves Light (Top-Left)
    addCeilingLight(2.2, 2.2, 0x60A5FA); // Blue Shelves Light (Top-Right)
    addCeilingLight(2.1, 1.0, 0xFBBF24); // Yellow Shelves Light (Bottom-Right)

    function createTileTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 6;
      ctx.strokeRect(0, 0, 512, 512);
      ctx.strokeRect(256, 0, 256, 512);
      ctx.strokeRect(0, 256, 512, 256);

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(6, 6);
      return texture;
    }

    // ───────────── 2. 3D SUPERMARKET MODEL ─────────────
    const mapWidth = 3.0;
    const mapHeight = 3.0;
    const wallHeight = 0.7;
    const wallThickness = 0.08;

    // Floor
    const floorGeo = new THREE.PlaneGeometry(mapWidth, mapHeight);
    const floorMat = new THREE.MeshStandardMaterial({
      map: createTileTexture(),
      roughness: 0.25,
      metalness: 0.15
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(mapWidth / 2, 0, mapHeight / 2);
    floor.receiveShadow = true;
    scene.add(floor);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.2 });

    function createWall(name, x, y, z, w, h, d) {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = name;
      scene.add(mesh);
    }

    // Outer Boundary Walls (3m x 3m)
    createWall("Wall_Left", 0, wallHeight / 2, mapHeight / 2, wallThickness, wallHeight, mapHeight);
    createWall("Wall_Right", mapWidth, wallHeight / 2, mapHeight / 2, wallThickness, wallHeight, mapHeight);
    createWall("Wall_Top", mapWidth / 2, wallHeight / 2, 0, mapWidth, wallHeight, wallThickness);

    // Bottom Wall with Door gap at x = 1.15m -> 1.60m (Center x = 1.375m)
    createWall("Wall_Bottom_Left", 0.575, wallHeight / 2, mapHeight, 1.15, wallHeight, wallThickness);
    createWall("Wall_Bottom_Right", 2.300, wallHeight / 2, mapHeight, 1.40, wallHeight, wallThickness);

    // Green Entrance Mat at Door (x = 1.375, z = 2.9)
    const doorMatGeo = new THREE.PlaneGeometry(0.45, 0.2);
    const doorMatMesh = new THREE.Mesh(doorMatGeo, new THREE.MeshBasicMaterial({ color: 0x10B981, side: THREE.DoubleSide }));
    doorMatMesh.rotation.x = -Math.PI / 2;
    doorMatMesh.position.set(1.375, 0.01, 2.9);
    scene.add(doorMatMesh);

    // MULTI-TIER SHELVES (4 ZONES)
    function createRealisticShelf(x, z, w, d, isVertical, colorHex, labelText) {
      const shelfGroup = new THREE.Group();
      shelfGroup.position.set(x, 0, z);

      const frameMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.7, roughness: 0.3 });
      const boardMat = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.2, roughness: 0.4 });
      const itemMat1 = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.5 });
      const itemMat2 = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3 });

      const levels = 3;
      const height = 0.75;
      const legRadius = 0.015;
      const halfW = w / 2;
      const halfD = d / 2;

      // 4 Metal Legs
      const legGeo = new THREE.CylinderGeometry(legRadius, legRadius, height, 8);
      [[-halfW, halfD], [halfW, halfD], [-halfW, -halfD], [halfW, -halfD]].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(legGeo, frameMat);
        leg.position.set(lx, height / 2, lz);
        leg.castShadow = true;
        shelfGroup.add(leg);
      });

      // Shelf Trays & Products
      for (let i = 1; i <= levels; i++) {
        const trayY = (height / levels) * i - 0.05;
        const tray = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), boardMat);
        tray.position.set(0, trayY, 0);
        tray.castShadow = true;
        tray.receiveShadow = true;
        shelfGroup.add(tray);

        const numItems = 3;
        for (let j = 0; j < numItems; j++) {
          const itemGeo = new THREE.BoxGeometry(w * 0.35, 0.1, isVertical ? (d / numItems) * 0.7 : (w / numItems) * 0.7);
          const item = new THREE.Mesh(itemGeo, j % 2 === 0 ? itemMat1 : itemMat2);
          const offset = (j - (numItems - 1) / 2) * (isVertical ? (d / numItems) : (w / numItems));

          if (isVertical) {
            item.position.set(j % 2 === 0 ? -w * 0.2 : w * 0.2, trayY + 0.06, offset);
          } else {
            item.position.set(offset, trayY + 0.06, j % 2 === 0 ? -d * 0.2 : d * 0.2);
          }
          item.castShadow = true;
          shelfGroup.add(item);
        }
      }

      scene.add(shelfGroup);
      return shelfGroup;
    }

    // Zone 2 (Top-Left - Green #10B981)
    createRealisticShelf(0.795, 0.21, 0.75, 0.38, false, 0x10B981, "Kệ 2 (Top)");
    createRealisticShelf(0.21, 0.795, 0.38, 0.75, true, 0x10B981, "Kệ 2 (Left)");

    // Zone 1 (Top-Right - Blue #2563EB)
    createRealisticShelf(2.175, 0.21, 0.75, 0.38, false, 0x2563EB, "Kệ 1 (Top)");
    createRealisticShelf(2.79, 0.795, 0.38, 0.75, true, 0x2563EB, "Kệ 1 (Right)");

    // Zone 3 (Bottom-Left - Yellow #F59E0B)
    createRealisticShelf(0.21, 2.125, 0.38, 0.75, true, 0xF59E0B, "Kệ 3 (Left)");
    createRealisticShelf(0.795, 2.79, 0.75, 0.38, false, 0xF59E0B, "Kệ 3 (Bottom)");

    // Zone 4 (Center - Red #EF4444)
    createRealisticShelf(1.50, 1.475, 0.40, 0.85, true, 0xEF4444, "Kệ 4 (Center)");

    // WHITE CHECKOUT COUNTER (Thu Ngân: x = 1.80 -> 2.98, y = 2.20 -> 2.98)
    const checkoutGroup = new THREE.Group();
    checkoutGroup.position.set(2.39, 0, 2.59);
    const counterDesk = new THREE.Mesh(
      new THREE.BoxGeometry(1.18, 0.4, 0.78),
      new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.2, metalness: 0.1 })
    );
    counterDesk.position.set(0, 0.2, 0);
    counterDesk.castShadow = true;
    checkoutGroup.add(counterDesk);

    const screenMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.15, 0.02),
      new THREE.MeshBasicMaterial({ color: 0x0EA5E9 })
    );
    screenMesh.position.set(0, 0.475, 0);
    checkoutGroup.add(screenMesh);
    scene.add(checkoutGroup);

    // CHARGING DOCK / START POINT [ ○ ] (x = 2.80, y = 2.00)
    const dockGroup = new THREE.Group();
    dockGroup.position.set(2.80, 0.01, 2.00);
    const dockBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.14, 0.03, 32),
      new THREE.MeshStandardMaterial({ color: 0x06B6D4, emissive: 0x0891B2, emissiveIntensity: 0.6 })
    );
    dockGroup.add(dockBase);
    scene.add(dockGroup);

    // ROBOT AGV (Hidden initially)
    const robotGroup = new THREE.Group();
    robotGroup.visible = false;
    scene.add(robotGroup);

    // ROUTE & ANIMATION SETUP
    let currentWaypoints = [];
    let routeLineGroup = new THREE.Group();
    scene.add(routeLineGroup);

    // SHELVES & OBSTACLES BOUNDING BOXES FOR COLLISION AVOIDANCE
    const OBSTACLE_BOXES = [
      { minX: 1.05, maxX: 1.55, minZ: 0.05, maxZ: 0.35 }  // Checkout Counter
    ];

    function lineIntersectsBox(x1, z1, x2, z2, box) {
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minZ = Math.min(z1, z2);
      const maxZ = Math.max(z1, z2);
      const margin = 0.02;
      return !(
        maxX <= box.minX + margin ||
        minX >= box.maxX - margin ||
        maxZ <= box.minZ + margin ||
        minZ >= box.maxZ - margin
      );
    }

    function isSegmentBlocked(p1, p2) {
      for (let i = 0; i < OBSTACLE_BOXES.length; i++) {
        if (lineIntersectsBox(p1.x, p1.y, p2.x, p2.y, OBSTACLE_BOXES[i])) {
          return true;
        }
      }
      return false;
    }

    function expandToOrthogonal(waypoints) {
      if (!waypoints || waypoints.length < 2) return waypoints || [];
      const expanded = [waypoints[0]];

      for (let i = 0; i < waypoints.length - 1; i++) {
        const p1 = waypoints[i];
        const p2 = waypoints[i + 1];
        const dx = Math.abs(p1.x - p2.x);
        const dy = Math.abs(p1.y - p2.y);

        if (dx > 1e-4 && dy > 1e-4) {
          const cA = { x: p1.x, y: p2.y, productName: "Giao lộ", shelfLocation: "Hành lang" };
          const colA = isSegmentBlocked(p1, cA) || isSegmentBlocked(cA, p2);

          const cB = { x: p2.x, y: p1.y, productName: "Giao lộ", shelfLocation: "Hành lang" };
          const colB = isSegmentBlocked(p1, cB) || isSegmentBlocked(cB, p2);

          if (!colB && colA) {
            expanded.push(cB);
          } else if (!colA && colB) {
            expanded.push(cA);
          } else if (!colA && !colB) {
            if (p1.x > 1.4 && p1.y < 1.6) {
              expanded.push(cB);
            } else {
              expanded.push(cA);
            }
          } else {
            const aisleX = 1.5;
            const cDetour1 = { x: aisleX, y: p1.y, productName: "Giao lộ", shelfLocation: "Hành lang" };
            const cDetour2 = { x: aisleX, y: p2.y, productName: "Giao lộ", shelfLocation: "Hành lang" };
            if (Math.abs(p1.x - aisleX) > 1e-4) expanded.push(cDetour1);
            if (Math.abs(p1.y - p2.y) > 1e-4) expanded.push(cDetour2);
          }
        }
        expanded.push(p2);
      }
      return expanded;
    }

    // ───────────── PRODUCT PINS & TEXT BADGES ─────────────
    function createTextBadgeSprite(text, isDestination) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = isDestination ? 'rgba(6, 78, 59, 0.95)' : 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = isDestination ? '#34D399' : '#38BDF8';
      ctx.lineWidth = 6;

      const r = 24, x = 10, y = 10, w = 492, h = 108;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.font = 'Bold 34px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      let displayStr = text;
      if (displayStr.length > 22) {
        displayStr = displayStr.substring(0, 20) + '...';
      }
      ctx.fillText(displayStr, 256, 64);

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(0.65, 0.22, 1);
      return sprite;
    }

    function createProductPin(wp, index, totalStops) {
      const isDestination = index === totalStops - 1;
      const pinGroup = new THREE.Group();
      const px = wp.x;
      const pz = wp.y;

      const ringGeo = new THREE.RingGeometry(0.05, 0.08, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: isDestination ? 0x10B981 : 0x0EA5E9,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.set(px, 0.02, pz);
      pinGroup.add(ringMesh);

      const stemGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.3, 16);
      const stemMat = new THREE.MeshStandardMaterial({
        color: 0xE2E8F0,
        metalness: 0.8,
        roughness: 0.2
      });
      const stemMesh = new THREE.Mesh(stemGeo, stemMat);
      stemMesh.position.set(px, 0.15, pz);
      pinGroup.add(stemMesh);

      const headGeo = new THREE.SphereGeometry(0.06, 24, 24);
      const headMat = new THREE.MeshStandardMaterial({
        color: isDestination ? 0x10B981 : 0x0EA5E9,
        emissive: isDestination ? 0x047857 : 0x0284C7,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.3
      });
      const headMesh = new THREE.Mesh(headGeo, headMat);
      headMesh.position.set(px, 0.30, pz);
      pinGroup.add(headMesh);

      const name = wp.productName || wp.nodeName || ('Điểm ' + (index + 1));
      const labelText = isDestination ? ('🏁 Đích: ' + name) : ('📍 #' + (index + 1) + ': ' + name);
      const sprite = createTextBadgeSprite(labelText, isDestination);
      sprite.position.set(px, 0.46, pz);
      pinGroup.add(sprite);

      routeLineGroup.add(pinGroup);
    }

    // ───────────── PURE ROUTE LINE VISUALIZATION WITH PINS ─────────────
    function clearRouteVisuals() {
      if (routeLineGroup) {
        while (routeLineGroup.children.length > 0) {
          const obj = routeLineGroup.children[0];
          routeLineGroup.remove(obj);
        }
      }
    }

    function visualize3DRoute(routeData) {
      console.log('[3D Map WebView Log] visualize3DRoute received:', JSON.stringify(routeData));
      clearRouteVisuals();
      if (Array.isArray(routeData)) {
        routeData = { waypoints: routeData };
      }
      if (!routeData || !routeData.waypoints || routeData.waypoints.length === 0) return;

      const expandedWaypoints = routeData.waypoints;
      currentWaypoints = expandedWaypoints;

      const pipeMat = new THREE.MeshBasicMaterial({ color: 0x38BDF8, transparent: true, opacity: 0.95 });

      for (let i = 0; i < expandedWaypoints.length - 1; i++) {
        const p1 = expandedWaypoints[i];
        const p2 = expandedWaypoints[i + 1];

        const startVec = new THREE.Vector3(p1.x, 0.06, p1.y);
        const endVec = new THREE.Vector3(p2.x, 0.06, p2.y);

        const curve = new THREE.LineCurve3(startVec, endVec);
        const tubeGeo = new THREE.TubeGeometry(curve, 8, 0.02, 8, false);
        const tubeMesh = new THREE.Mesh(tubeGeo, pipeMat);
        routeLineGroup.add(tubeMesh);

        const jointGeo = new THREE.SphereGeometry(0.022, 12, 12);
        const jointMesh = new THREE.Mesh(jointGeo, pipeMat);
        jointMesh.position.set(p2.x, 0.06, p2.y);
        routeLineGroup.add(jointMesh);
      }

      // Render Product Pins for waypoints
      if (routeData.waypoints && routeData.waypoints.length > 0) {
        let pinIndex = 0;
        routeData.waypoints.forEach((wp, idx) => {
          const isStart = idx === 0;
          const isEnd = idx === routeData.waypoints.length - 1;
          const nameLower = (wp.productName || '').toLowerCase();
          const isCorridorNode = nameLower.includes('lối vào') || nameLower.includes('giao lộ') || nameLower.includes('bẻ góc') || nameLower.includes('corner') || nameLower.includes('detour');
          const hasProduct = wp.productId || (wp.productName && !isCorridorNode && !nameLower.includes('vị trí robot'));

          if (isStart || isEnd || hasProduct) {
            createProductPin(wp, pinIndex++, routeData.waypoints.length);
          }
        });
        animateRobotAlongPath();
      }
    }

    // ───────────── ANIMATE ROBOT ALONG PATH ─────────────
    function animateRobotAlongPath() {
      if (!currentWaypoints || currentWaypoints.length < 2) return;

      const startPt = currentWaypoints[0];
      robotGroup.position.set(startPt.x, 0.06, startPt.y);

      let idx = 0;
      function moveToNext() {
        if (idx >= currentWaypoints.length - 1) return;
        const endPt = currentWaypoints[idx + 1];

        new TWEEN.Tween(robotGroup.position)
          .to({ x: endPt.x, z: endPt.y }, 800)
          .easing(TWEEN.Easing.Linear.None)
          .onComplete(() => {
            idx++;
            moveToNext();
          })
          .start();
      }
      moveToNext();
    }

    // RENDER LOOP
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    function animate(time) {
      requestAnimationFrame(animate);
      TWEEN.update();
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // Notify React Native WebView that 3D Map is ready
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
      }
    } catch(e) {}

    // Bridge interface for React Native WebView
    window.setRouteData = function(data) {
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch(e) {}
      }
      if (data) {
        visualize3DRoute(data);
      }
    };

    window.addEventListener('message', function(event) {
      try {
        const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (message.type === 'SET_ROUTE' && message.routeData) {
          window.setRouteData(message.routeData);
        }
      } catch(e) {}
    });

    document.addEventListener('message', function(event) {
      try {
        const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (message.type === 'SET_ROUTE' && message.routeData) {
          window.setRouteData(message.routeData);
        }
      } catch(e) {}
    });
  </script>
</body>

</html>`;