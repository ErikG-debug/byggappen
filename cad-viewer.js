/* CAD Viewer — Three.js-baserad 3D-visare för CadQuery STL-modeller */
/* Stödjer per-lager STL med visibility-toggling */
(function () {
  var scene, camera, renderer, controls;
  var initialized = false;
  var layerGroup = null; // THREE.Group som håller alla lager-meshes
  var layerMeshes = {};  // { "Stolpar": THREE.Mesh, "Trall": THREE.Mesh, ... }

  function initScene(container) {
    if (initialized && renderer) {
      if (renderer.domElement.parentElement !== container) {
        container.innerHTML = '';
        container.appendChild(renderer.domElement);
      }
      onResize();
      return;
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8f6f2);

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 100000);
    camera.position.set(4000, 3000, 4000);

    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Ljus — varm sommarbelysning
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    var dirLight = new THREE.DirectionalLight(0xfff5e0, 1.0);
    dirLight.position.set(3000, 5000, 4000);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 100;
    dirLight.shadow.camera.far = 20000;
    dirLight.shadow.camera.left = -5000;
    dirLight.shadow.camera.right = 5000;
    dirLight.shadow.camera.top = 5000;
    dirLight.shadow.camera.bottom = -5000;
    scene.add(dirLight);

    scene.add(new THREE.DirectionalLight(0xc4d4ff, 0.3).translateX(-2000).translateY(1000).translateZ(-2000));

    // Markplan (grönt gräs)
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20000, 20000),
      new THREE.MeshStandardMaterial({ color: 0x8fbc6a, roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1;
    ground.receiveShadow = true;
    scene.add(ground);

    // OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 500;
    controls.maxDistance = 12000;
    controls.target.set(0, 300, 0);
    controls.update();

    // Animation loop
    (function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    })();

    window.addEventListener('resize', onResize);
    initialized = true;
  }

  function onResize() {
    if (!renderer) return;
    var container = renderer.domElement.parentElement;
    if (!container) return;
    var w = container.clientWidth;
    var h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function clearModel() {
    if (layerGroup) {
      scene.remove(layerGroup);
      layerGroup = null;
    }
    layerMeshes = {};
  }

  function loadLayers(data) {
    if (!scene) return;
    clearModel();

    layerGroup = new THREE.Group();
    var loader = new THREE.STLLoader();
    var allBox = new THREE.Box3();
    var lagerNamn = data.lager || [];
    var farger = data.farger || {};
    var stlData = data.stl || {};
    var loaded = 0;

    for (var i = 0; i < lagerNamn.length; i++) {
      (function (namn) {
        var b64 = stlData[namn];
        if (!b64) return;

        var binary = atob(b64);
        var bytes = new Uint8Array(binary.length);
        for (var j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
        var buffer = bytes.buffer;

        var geometry = loader.parse(buffer);
        geometry.rotateX(-Math.PI / 2); // Z-upp → Y-upp

        var farg = farger[namn] || [0.7, 0.5, 0.3];
        var color = new THREE.Color(farg[0], farg[1], farg[2]);

        var material = new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.75,
          metalness: 0.0,
        });

        var mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.name = namn;

        layerMeshes[namn] = mesh;
        layerGroup.add(mesh);

        geometry.computeBoundingBox();
        allBox.expandByObject(mesh);

        loaded++;
        if (loaded === lagerNamn.length) {
          positionModel(allBox);
        }
      })(lagerNamn[i]);
    }

    scene.add(layerGroup);
  }

  function positionModel(box) {
    var center = new THREE.Vector3();
    box.getCenter(center);
    layerGroup.position.sub(center);
    layerGroup.position.y += (box.max.y - box.min.y) / 2;

    var size = new THREE.Vector3();
    box.getSize(size);
    var maxDim = Math.max(size.x, size.y, size.z);
    camera.position.set(maxDim * 1.2, maxDim * 0.9, maxDim * 1.2);
    controls.target.set(0, size.y * 0.3, 0);
    controls.update();
  }

  var originalMaterials = {};

  function setLayerVisible(namn, visible) {
    var mesh = layerMeshes[namn];
    if (!mesh) return;
    // Spara originalmaterial första gången
    if (!originalMaterials[namn]) {
      originalMaterials[namn] = mesh.material;
    }
    mesh.visible = true;
    mesh.material = visible ? originalMaterials[namn] : fadedMaterial;
  }

  function getLayerNames() {
    return Object.keys(layerMeshes);
  }

  // Halvtransparent material för dolda/filtrerade lager
  var fadedMaterial = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    roughness: 0.9,
    transparent: true,
    opacity: 0.15,
    depthWrite: false,
  });

  // Gråmaterial för "redan byggda" delar
  var ghostMaterial = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    roughness: 0.9,
    metalness: 0.0,
    transparent: true,
    opacity: 0.3,
  });

  // Material för fokusläge
  var dimMaterial = new THREE.MeshStandardMaterial({
    color: 0xaaaaaa,
    roughness: 0.9,
    metalness: 0.0,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });
  var focusMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xffaa00,
    emissiveIntensity: 0.35,
    roughness: 0.5,
    metalness: 0.1,
  });

  var focusState = null; // { savedMaterials, savedCamPos, savedTarget, startHandler }

  function focusLayer(namn) {
    if (!isReady()) return;
    if (!layerMeshes[namn]) return;

    // Återställ ev. tidigare fokus först
    if (focusState) clearFocus();

    var savedMaterials = {};
    for (var n in layerMeshes) {
      savedMaterials[n] = layerMeshes[n].material;
      if (n === namn) {
        layerMeshes[n].material = focusMaterial;
      } else {
        layerMeshes[n].material = dimMaterial;
      }
    }

    // Beräkna bounding box för fokuserad mesh
    var box = new THREE.Box3().setFromObject(layerMeshes[namn]);
    var center = new THREE.Vector3();
    box.getCenter(center);
    var size = new THREE.Vector3();
    box.getSize(size);
    var maxDim = Math.max(size.x, size.y, size.z) || 500;

    var savedCamPos = camera.position.clone();
    var savedTarget = controls.target.clone();

    // Zooma in: avstånd ~2.2x största måttet
    var dist = Math.max(maxDim * 2.2, 800);
    camera.position.set(center.x + dist * 0.8, center.y + dist * 0.6, center.z + dist * 0.8);
    controls.target.copy(center);

    // Auto-rotera långsammare för stora delar
    controls.autoRotate = true;
    controls.autoRotateSpeed = Math.max(0.5, Math.min(2.0, 3000 / Math.max(maxDim, 500)));
    controls.update();

    // Stoppa autorotation när användaren interagerar
    var startHandler = function () {
      controls.autoRotate = false;
    };
    controls.addEventListener('start', startHandler);

    focusState = {
      savedMaterials: savedMaterials,
      savedCamPos: savedCamPos,
      savedTarget: savedTarget,
      startHandler: startHandler,
    };
  }

  function clearFocus() {
    if (!focusState) return;
    for (var n in focusState.savedMaterials) {
      if (layerMeshes[n]) layerMeshes[n].material = focusState.savedMaterials[n];
    }
    controls.autoRotate = false;
    controls.removeEventListener('start', focusState.startHandler);
    camera.position.copy(focusState.savedCamPos);
    controls.target.copy(focusState.savedTarget);
    controls.update();
    focusState = null;
  }

  function isReady() {
    return !!(initialized && renderer && layerGroup && Object.keys(layerMeshes).length > 0);
  }

  /**
   * Renderar en snapshot med highlighting: nya lager i full färg, gamla i grått.
   * @param {string[]} nyaLager  — lagernamn som ska highlightas (nya i detta steg)
   * @param {string[]} gamlaLager — lagernamn som visas nedtonade (redan byggda)
   * @param {object} [kamera]    — valfri kamera-override: { position: [x,y,z], target: [x,y,z] }
   * @returns {string|null} data-URL (image/png) eller null om ej redo
   */
  function snapshot(nyaLager, gamlaLager, kamera) {
    if (!isReady()) return null;

    // Spara ursprunglig state
    var savedVisibility = {};
    var savedMaterials = {};
    var savedCamPos = camera.position.clone();
    var savedTarget = controls.target.clone();
    for (var namn in layerMeshes) {
      savedVisibility[namn] = layerMeshes[namn].visible;
      savedMaterials[namn] = layerMeshes[namn].material;
    }

    // Dölj allt
    for (var namn in layerMeshes) {
      layerMeshes[namn].visible = false;
    }

    // Visa gamla lager med grått material
    for (var g = 0; g < gamlaLager.length; g++) {
      var mesh = layerMeshes[gamlaLager[g]];
      if (mesh) {
        mesh.visible = true;
        mesh.material = ghostMaterial;
      }
    }

    // Visa nya lager i full originalfärg
    for (var n = 0; n < nyaLager.length; n++) {
      var mesh = layerMeshes[nyaLager[n]];
      if (mesh) {
        mesh.visible = true;
        mesh.material = savedMaterials[nyaLager[n]];
      }
    }

    // Kamerapositionering
    if (kamera && kamera.position && kamera.target) {
      camera.position.set(kamera.position[0], kamera.position[1], kamera.position[2]);
      controls.target.set(kamera.target[0], kamera.target[1], kamera.target[2]);
    } else {
      // Auto-fit baserat på synliga meshes (inte hela layerGroup)
      var visBox = new THREE.Box3();
      for (var namn in layerMeshes) {
        if (layerMeshes[namn].visible) visBox.expandByObject(layerMeshes[namn]);
      }
      var size = new THREE.Vector3();
      visBox.getSize(size);
      var maxDim = Math.max(size.x, size.y, size.z) || 1000;
      camera.position.set(maxDim * 1.2, maxDim * 0.9, maxDim * 1.2);
      controls.target.set(0, size.y * 0.3, 0);
    }
    controls.update();

    // Rendera och fånga
    renderer.render(scene, camera);
    var dataUrl = renderer.domElement.toDataURL('image/png');

    // Återställ
    for (var namn in layerMeshes) {
      layerMeshes[namn].visible = savedVisibility[namn];
      layerMeshes[namn].material = savedMaterials[namn];
    }
    camera.position.copy(savedCamPos);
    controls.target.copy(savedTarget);
    controls.update();

    return dataUrl;
  }

  // Exponera globalt
  window.CadViewer = {
    init: function (containerId) {
      var container = document.getElementById(containerId);
      if (!container) return;
      initScene(container);
    },
    loadLayers: loadLayers,
    setLayerVisible: setLayerVisible,
    getLayerNames: getLayerNames,
    isReady: isReady,
    snapshot: snapshot,
    focusLayer: focusLayer,
    clearFocus: clearFocus,
    clear: clearModel,
    resize: onResize,
  };
})();
