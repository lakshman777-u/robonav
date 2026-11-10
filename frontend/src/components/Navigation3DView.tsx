import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MapData } from '../types/map';
import { RobotStatus, SensorData } from '../types/robot';
import { Destination } from '../types/navigation';
import { 
  Eye, Compass, RotateCcw, Maximize2, Video, 
  Layers, Radio, Navigation, Target 
} from 'lucide-react';

interface Navigation3DViewProps {
  mapData: MapData | null;
  robotStatus: RobotStatus | null;
  sensorData: SensorData | null;
  destinations?: Destination[];
  navigationPath?: { x: number; y: number }[] | null;
}

export type CameraViewMode = 'ORBIT' | 'FOLLOW' | 'TOP_DOWN';

export const Navigation3DView: React.FC<Navigation3DViewProps> = ({
  mapData,
  robotStatus,
  sensorData,
  destinations = [],
  navigationPath = null,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('ORBIT');
  const [wallCount, setWallCount] = useState(0);

  // Mutable refs for Three.js scene objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Dynamic 3D Objects
  const robotGroupRef = useRef<THREE.Group | null>(null);
  const radarSweepRef = useRef<THREE.Mesh | null>(null);
  const lidarPointsRef = useRef<THREE.Points | null>(null);
  const wallsMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const wallsTopMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const pathLineRef = useRef<THREE.Line | null>(null);
  const trajectoryLineRef = useRef<THREE.Line | null>(null);
  const destBeaconsGroupRef = useRef<THREE.Group | null>(null);

  // Robot smoothed pose state (Anti-shaking filter with deadband)
  const poseRef = useRef({
    x: robotStatus?.position?.x ?? 0.0,
    y: robotStatus?.position?.y ?? 0.0,
    heading: robotStatus?.orientation ?? 0.0,
    initialized: false,
  });

  // Track latest props in ref for 60 FPS animation loop
  const propsRef = useRef({
    mapData,
    robotStatus,
    sensorData,
    destinations,
    navigationPath,
    cameraMode,
  });

  useEffect(() => {
    propsRef.current = {
      mapData,
      robotStatus,
      sensorData,
      destinations,
      navigationPath,
      cameraMode,
    };
  }, [mapData, robotStatus, sensorData, destinations, navigationPath, cameraMode]);

  // 1. Initialize Three.js Scene, Camera, Renderer, Lighting, Grid
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 900;
    const height = container.clientHeight || 650;

    // Scene with dark obsidian fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080e);
    scene.fog = new THREE.FogExp2(0x06080e, 0.035);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 7.5, 9.5);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.03; // Don't go below floor
    controls.minDistance = 1.0;
    controls.maxDistance = 45.0;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // Ambient Lighting & Red Accent Spotlights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffebee, 1.2);
    dirLight.position.set(10, 15, 8);
    scene.add(dirLight);

    const redRimLight = new THREE.DirectionalLight(0xef4444, 0.8);
    redRimLight.position.set(-10, 10, -8);
    scene.add(redRimLight);

    // Dark Navigation Floor Grid (30m x 30m, 1m intervals)
    const gridHelper = new THREE.GridHelper(30, 30, 0xef4444, 0x1f2333);
    gridHelper.position.y = 0.001;
    scene.add(gridHelper);

    // Dark Floor Plane (Obsidian)
    const floorGeo = new THREE.PlaneGeometry(60, 60);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x090b12,
      roughness: 0.85,
      metalness: 0.15,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Destination beacons container group
    const destGroup = new THREE.Group();
    scene.add(destGroup);
    destBeaconsGroupRef.current = destGroup;

    // 2. Build 3D Robot Rover Model
    const robotGroup = new THREE.Group();

    // Main Chassis puck (dark gunmetal titanium)
    const bodyGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.08, 32);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x12141c,
      metalness: 0.8,
      roughness: 0.25,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.04;
    robotGroup.add(bodyMesh);

    // Glowing Red LED Perimeter Trim
    const ringGeo = new THREE.TorusGeometry(0.182, 0.012, 16, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.04;
    robotGroup.add(ringMesh);

    // Dual Tread / Wheels (Left and Right)
    const wheelGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.035, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.9 });
    const leftWheel = new THREE.Mesh(wheelGeo, wheelMat);
    leftWheel.rotation.x = Math.PI / 2;
    leftWheel.position.set(0, 0.045, 0.17);
    robotGroup.add(leftWheel);

    const rightWheel = new THREE.Mesh(wheelGeo, wheelMat);
    rightWheel.rotation.x = Math.PI / 2;
    rightWheel.position.set(0, 0.045, -0.17);
    robotGroup.add(rightWheel);

    // YDLIDAR X2 Turret Dome
    const turretGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.05, 24);
    const turretMat = new THREE.MeshStandardMaterial({
      color: 0x1c1e29,
      metalness: 0.7,
      roughness: 0.3,
    });
    const turretMesh = new THREE.Mesh(turretGeo, turretMat);
    turretMesh.position.y = 0.095;
    robotGroup.add(turretMesh);

    // Ruby Center Laser Core (Glow Diode)
    const rubyGeo = new THREE.SphereGeometry(0.022, 16, 16);
    const rubyMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
    const rubyMesh = new THREE.Mesh(rubyGeo, rubyMat);
    rubyMesh.position.y = 0.125;
    robotGroup.add(rubyMesh);

    const robotPointLight = new THREE.PointLight(0xef4444, 2.5, 2.5);
    robotPointLight.position.y = 0.15;
    robotGroup.add(robotPointLight);

    // Forward Heading Pointer (Points +X, YDLIDAR Motor Facing North)
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0.24, 0);
    arrowShape.lineTo(0.14, -0.06);
    arrowShape.lineTo(0.17, -0.02);
    arrowShape.lineTo(0.05, -0.02);
    arrowShape.lineTo(0.05, 0.02);
    arrowShape.lineTo(0.17, 0.02);
    arrowShape.lineTo(0.14, 0.06);
    arrowShape.closePath();

    const arrowGeo = new THREE.ShapeGeometry(arrowShape);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xff3344, side: THREE.DoubleSide });
    const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
    arrowMesh.rotation.x = -Math.PI / 2;
    arrowMesh.position.y = 0.09;
    robotGroup.add(arrowMesh);

    // Rotating Radar Scan Fan Cone (Glowing Red Field)
    const radarGeo = new THREE.RingGeometry(0.1, 4.0, 32, 1, 0, Math.PI / 3);
    const radarMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
    });
    const radarMesh = new THREE.Mesh(radarGeo, radarMat);
    radarMesh.rotation.x = -Math.PI / 2;
    radarMesh.position.y = 0.085;
    robotGroup.add(radarMesh);
    radarSweepRef.current = radarMesh;

    scene.add(robotGroup);
    robotGroupRef.current = robotGroup;

    // 3. Live 3D Red LiDAR Scan Hit Points
    const maxPoints = 720;
    const lidarGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(maxPoints * 3);
    lidarGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    lidarGeo.setDrawRange(0, 0);

    const lidarMat = new THREE.PointsMaterial({
      color: 0xff2222,
      size: 0.08,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
    });
    const lidarPoints = new THREE.Points(lidarGeo, lidarMat);
    scene.add(lidarPoints);
    lidarPointsRef.current = lidarPoints;

    // 4. Resize listener
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 5. 60 FPS Render Loop with Smooth Anti-Shaking Interpolation
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      const { robotStatus: curRobot, sensorData: curSensor, cameraMode: curCamMode } = propsRef.current;

      // Anti-shaking pose interpolation with deadband
      const targetX = curRobot?.position?.x ?? 0.0;
      const targetY = curRobot?.position?.y ?? 0.0;
      const targetHeading = curRobot?.orientation ?? 0.0;

      const p = poseRef.current;
      if (!p.initialized) {
        p.x = targetX;
        p.y = targetY;
        p.heading = targetHeading;
        p.initialized = true;
      } else {
        // Deadband filter (ignore jitter < 3mm and < 0.2 deg)
        const dx = targetX - p.x;
        const dy = targetY - p.y;
        if (Math.abs(dx) > 0.003 || Math.abs(dy) > 0.003) {
          p.x += dx * 0.16;
          p.y += dy * 0.16;
        }

        let dHeading = ((targetHeading - p.heading + 180) % 360) - 180;
        if (dHeading < -180) dHeading += 360;
        if (Math.abs(dHeading) > 0.2) {
          p.heading = (p.heading + dHeading * 0.16 + 360) % 360;
        }
      }

      // Convert 2D world coords (X, Y) to Three.js (X = wx, Z = -wy)
      const rx = p.x;
      const rz = -p.y;
      const headingRad = (p.heading * Math.PI) / 180.0;

      // Update Robot 3D Position & Heading
      if (robotGroupRef.current) {
        robotGroupRef.current.position.set(rx, 0, rz);
        // Motor facing North (+X body aligns with heading)
        robotGroupRef.current.rotation.y = headingRad;
      }

      // Continuous rotating radar sweep effect
      if (radarSweepRef.current) {
        radarSweepRef.current.rotation.z -= delta * 3.5;
      }

      // Update Live LiDAR Hit Points in 3D
      const rays = curSensor?.lidar?.rays || (curRobot as any)?.lidar?.rays || [];
      if (lidarPointsRef.current && rays.length > 0) {
        const geo = lidarPointsRef.current.geometry;
        const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        let count = 0;

        for (let i = 0; i < rays.length && count < maxPoints; i++) {
          const ray = rays[i];
          if (ray.distance < 0.12 || ray.distance > 8.0) continue;

          const rayRad = ((p.heading + ray.angle) * Math.PI) / 180;
          const hitX = p.x + ray.distance * Math.cos(rayRad);
          const hitZ = -(p.y + ray.distance * Math.sin(rayRad));

          arr[count * 3] = hitX;
          arr[count * 3 + 1] = 0.13; // Elevated slightly at sensor height
          arr[count * 3 + 2] = hitZ;
          count++;
        }

        posAttr.needsUpdate = true;
        geo.setDrawRange(0, count);
      }

      // Camera Follow / Modes
      if (cameraRef.current && controlsRef.current) {
        if (curCamMode === 'FOLLOW') {
          controlsRef.current.enabled = false;
          // Smooth chase camera trailing behind the robot
          const followDist = 3.0;
          const camTargetX = rx - Math.cos(headingRad) * followDist;
          const camTargetZ = rz + Math.sin(headingRad) * followDist;
          const camHeight = 2.2;

          cameraRef.current.position.x += (camTargetX - cameraRef.current.position.x) * 0.08;
          cameraRef.current.position.y += (camHeight - cameraRef.current.position.y) * 0.08;
          cameraRef.current.position.z += (camTargetZ - cameraRef.current.position.z) * 0.08;
          cameraRef.current.lookAt(rx, 0.3, rz);
        } else if (curCamMode === 'TOP_DOWN') {
          controlsRef.current.enabled = false;
          cameraRef.current.position.set(rx, 14, rz);
          cameraRef.current.lookAt(rx, 0, rz);
        } else {
          // Free Orbit Controls
          controlsRef.current.enabled = true;
          controlsRef.current.update();
        }
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();

    // Cleanup on unmount
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // 6. Extrude 2D SLAM Occupancy Grid into 3D Vertical Walls
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove existing extruded walls
    if (wallsMeshRef.current) {
      scene.remove(wallsMeshRef.current);
      wallsMeshRef.current.geometry.dispose();
      wallsMeshRef.current = null;
    }
    if (wallsTopMeshRef.current) {
      scene.remove(wallsTopMeshRef.current);
      wallsTopMeshRef.current.geometry.dispose();
      wallsTopMeshRef.current = null;
    }

    if (!mapData || !mapData.occupancy_grid || mapData.occupancy_grid.length === 0) {
      setWallCount(0);
      return;
    }

    const { width = 600, height = 600, resolution = 0.05, origin = { x: -15.0, y: -15.0 }, occupancy_grid } = mapData;
    const wallHeight = 0.55; // 0.55m vertical extruded wall height
    const cellW = resolution;

    // Find all occupied obstacle cells (val >= 50)
    const occupiedCoords: { x: number; z: number }[] = [];
    for (let gy = 0; gy < height; gy++) {
      for (let gx = 0; gx < width; gx++) {
        const val = occupancy_grid[gy * width + gx];
        if (val >= 50) {
          const wx = origin.x + gx * resolution;
          const wy = origin.y + gy * resolution;
          occupiedCoords.push({ x: wx, z: -wy });
        }
      }
    }

    const count = occupiedCoords.length;
    setWallCount(count);
    if (count === 0) return;

    // Build InstancedMesh for Wall Bodies (Dark Obsidian Slate)
    const wallGeo = new THREE.BoxGeometry(cellW * 1.05, wallHeight, cellW * 1.05);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x12141c,
      roughness: 0.5,
      metalness: 0.3,
    });
    const instancedWalls = new THREE.InstancedMesh(wallGeo, wallMat, count);

    // Build InstancedMesh for Glowing Red Wall Tops (Futuristic Tron/Autonomous look)
    const topCapGeo = new THREE.BoxGeometry(cellW * 1.05, 0.03, cellW * 1.05);
    const topCapMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
    });
    const instancedTops = new THREE.InstancedMesh(topCapGeo, topCapMat, count);

    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const c = occupiedCoords[i];

      // Wall Body
      dummy.position.set(c.x, wallHeight / 2, c.z);
      dummy.updateMatrix();
      instancedWalls.setMatrixAt(i, dummy.matrix);

      // Top Cap
      dummy.position.set(c.x, wallHeight + 0.015, c.z);
      dummy.updateMatrix();
      instancedTops.setMatrixAt(i, dummy.matrix);
    }

    instancedWalls.instanceMatrix.needsUpdate = true;
    instancedTops.instanceMatrix.needsUpdate = true;

    scene.add(instancedWalls);
    scene.add(instancedTops);
    wallsMeshRef.current = instancedWalls;
    wallsTopMeshRef.current = instancedTops;
  }, [mapData]);

  // 7. Render 3D Destination Light Beacons & Flags
  useEffect(() => {
    const destGroup = destBeaconsGroupRef.current;
    if (!destGroup) return;

    // Clear old beacons
    while (destGroup.children.length > 0) {
      const child = destGroup.children[0];
      destGroup.remove(child);
    }

    if (!destinations || destinations.length === 0) return;

    destinations.forEach((dest, idx) => {
      const dx = dest.x;
      const dz = -dest.y;

      // Vertical Glowing Light Pillar Beacon
      const pillarGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.4, 16);
      const pillarMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.45,
      });
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(dx, 0.7, dz);
      destGroup.add(pillar);

      // Concentric target ground rings
      const ringGeo = new THREE.RingGeometry(0.12, 0.35, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(dx, 0.01, dz);
      destGroup.add(ring);

      // Top floating marker beacon
      const topGeo = new THREE.OctahedronGeometry(0.12);
      const topMat = new THREE.MeshBasicMaterial({ color: 0xff3344 });
      const topMarker = new THREE.Mesh(topGeo, topMat);
      topMarker.position.set(dx, 1.45, dz);
      destGroup.add(topMarker);
    });
  }, [destinations]);

  // 8. Render Autonomous Planned Path in 3D
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (pathLineRef.current) {
      scene.remove(pathLineRef.current);
      pathLineRef.current.geometry.dispose();
      pathLineRef.current = null;
    }

    if (!navigationPath || navigationPath.length < 2) return;

    const points = navigationPath.map(pt => new THREE.Vector3(pt.x, 0.05, -pt.y));
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 3 });
    const line = new THREE.Line(lineGeo, lineMat);
    scene.add(line);
    pathLineRef.current = line;
  }, [navigationPath]);

  // Reset Camera View
  const handleResetCamera = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const rx = robotStatus?.position?.x ?? 0.0;
    const rz = -(robotStatus?.position?.y ?? 0.0);
    controlsRef.current.target.set(rx, 0, rz);
    cameraRef.current.position.set(rx, 7.5, rz + 9.5);
    controlsRef.current.update();
    setCameraMode('ORBIT');
  }, [robotStatus]);

  const rx = robotStatus?.position?.x ?? 0.0;
  const ry = robotStatus?.position?.y ?? 0.0;
  const heading = robotStatus?.orientation ?? 0.0;

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-950 rounded-3xl border border-red-500/20 shadow-2xl">
      {/* Three.js Canvas Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Left HUD Telemetry Overlay (Cockpit Style) */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 pointer-events-none">
        <div className="px-3.5 py-1.5 rounded-xl bg-slate-950/90 backdrop-blur-md border border-red-500/40 flex items-center gap-2 text-xs font-mono shadow-xl">
          <Layers size={15} className="text-red-400" />
          <span className="font-bold text-white tracking-wider">3D NAVIGATION VIEW</span>
          <span className="text-[10px] text-red-400 font-bold">| THREE.JS WEBGL</span>
        </div>

        <div className="px-3 py-1.5 rounded-xl bg-slate-950/90 backdrop-blur-md border border-white/10 flex items-center gap-2 text-[10px] font-mono shadow-xl">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <span className="text-gray-400 font-bold">WALLS:</span>
          <span className="text-red-400 font-black">{wallCount}</span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-400 font-bold">LIDAR:</span>
          <span className="text-red-400 font-black">
            {(sensorData?.lidar?.scan_rate ?? robotStatus?.bridge?.scan_hz ?? 9.3).toFixed(1)} Hz
          </span>
        </div>

        <div className="px-3 py-1.5 rounded-xl bg-slate-950/90 backdrop-blur-md border border-white/10 flex items-center gap-2 text-[10px] font-mono shadow-xl">
          <span className="text-gray-400">POSE:</span>
          <span className="text-white font-bold">({rx.toFixed(2)}, {ry.toFixed(2)})m</span>
          <span className="text-red-400 font-bold">{heading.toFixed(1)}°</span>
        </div>
      </div>

      {/* Top Right Camera & View Mode HUD Controls */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5">
        <div className="flex items-center p-1 rounded-2xl bg-slate-950/90 backdrop-blur-md border border-white/10 shadow-xl gap-1">
          <button
            onClick={() => setCameraMode('ORBIT')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
              cameraMode === 'ORBIT'
                ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                : 'text-gray-400 hover:text-white hover:bg-slate-900'
            }`}
            title="Free Orbit Camera (Mouse rotate/pan/zoom)"
          >
            <Compass size={14} />
            <span>ORBIT</span>
          </button>

          <button
            onClick={() => setCameraMode('FOLLOW')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
              cameraMode === 'FOLLOW'
                ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                : 'text-gray-400 hover:text-white hover:bg-slate-900'
            }`}
            title="Follow Robot (Third-person chase cam)"
          >
            <Video size={14} />
            <span>FOLLOW</span>
          </button>

          <button
            onClick={() => setCameraMode('TOP_DOWN')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
              cameraMode === 'TOP_DOWN'
                ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                : 'text-gray-400 hover:text-white hover:bg-slate-900'
            }`}
            title="Top-Down Birds Eye View"
          >
            <Eye size={14} />
            <span>TOP-DOWN</span>
          </button>
        </div>

        <button
          onClick={handleResetCamera}
          className="p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-gray-300 hover:text-red-400 border border-white/10 transition-colors shadow-lg"
          title="Reset Camera View"
        >
          <RotateCcw size={15} />
        </button>
      </div>

      {/* Bottom Left Navigation HUD Hint */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
        <div className="px-3.5 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-sm border border-red-500/20 text-[10px] font-mono text-gray-300 flex items-center gap-2 shadow-lg">
          <Radio size={13} className="text-red-400 animate-pulse" />
          <span>Extruded 3D SLAM Walls • Live 3D Floating LiDAR Points • Radar Beam Sweep</span>
        </div>
      </div>
    </div>
  );
};

export default Navigation3DView;
