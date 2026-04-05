/* CAD Viewer — Three.js-baserad 3D-visare för CadQuery STL-modeller */
(function () {
  var scene, camera, renderer, controls, currentMesh;
  var initialized = false;

  function initScene(container) {
    if (initialized && renderer) {
      // Flytta befintlig canvas till containern
      if (renderer.domElement.parentElement !== container) {
        container.innerHTML = '';
        container.appendChild(renderer.domElement);
      }
      onResize();
      return;
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8f6f2);

    // Kamera
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 100000);
    camera.position.set(4000, 3000, 4000);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
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

  function loadSTL(url) {
    if (!scene) return;

    if (currentMesh) {
      scene.remove(currentMesh);
      currentMesh = null;
    }

    var loader = new THREE.STLLoader();
    loader.load(url, function (geometry) {
      var material = new THREE.MeshStandardMaterial({
        color: 0xc49a6c,
        roughness: 0.75,
        metalness: 0.0,
      });

      // CadQuery använder Z-upp, Three.js använder Y-upp — rotera geometrin
      geometry.rotateX(-Math.PI / 2);

      var mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Centrera modellen
      geometry.computeBoundingBox();
      var box = geometry.boundingBox;
      var center = new THREE.Vector3();
      box.getCenter(center);
      mesh.position.sub(center);
      mesh.position.y += (box.max.y - box.min.y) / 2;

      currentMesh = mesh;
      scene.add(mesh);

      // Anpassa kamera
      var size = new THREE.Vector3();
      box.getSize(size);
      var maxDim = Math.max(size.x, size.y, size.z);
      camera.position.set(maxDim * 1.2, maxDim * 0.9, maxDim * 1.2);
      controls.target.set(0, size.y * 0.3, 0);
      controls.update();
    }, undefined, function (err) {
      console.error('STL load error:', err);
    });
  }

  // Exponera globalt
  window.CadViewer = {
    init: function (containerId) {
      var container = document.getElementById(containerId);
      if (!container) return;
      initScene(container);
    },
    load: function (url) {
      loadSTL(url);
    },
    resize: onResize,
  };
})();
