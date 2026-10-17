import * as THREE from "three";
import type {
  Cell,
  Colony,
  TacticalContent,
  TacticalEvent,
  TacticalState,
  Vec,
} from "../domain/model";
export interface SceneInput {
  state: TacticalState;
  selected?: string;
  reduced: boolean;
  idle: boolean;
  speed: number;
}
export type Pick =
  | { type: "cell"; id: string }
  | { type: "colony"; id: string }
  | { type: "ground"; point: Vec };
interface Actor {
  root: THREE.Group;
  body: THREE.Group;
  shell: THREE.Mesh;
  lobes: THREE.InstancedMesh;
  granules: THREE.InstancedMesh;
  vacuole: THREE.Group;
  ring: THREE.Mesh;
  kind: string;
  phase: number;
}
interface Bacteria {
  root: THREE.Group;
  core: THREE.InstancedMesh;
  capsule: THREE.InstancedMesh;
  marks: THREE.Group;
  ring: THREE.Mesh;
  signature: string;
  phase: number;
}
interface Effect {
  event: TacticalEvent;
  start: number;
  root: THREE.Group;
  arms?: THREE.InstancedMesh;
  ghost?: THREE.Group;
  ring?: THREE.Mesh;
}
const terrain = (x: number, z: number) =>
  0.14 * Math.sin(x * 0.35) * Math.cos(z * 0.28) +
  0.08 * Math.sin(z * 0.8 + x * 0.2);
const vector = (p: Vec, y = 0) => new THREE.Vector3(p.x, y, p.z);
const sphere = new THREE.SphereGeometry(1, 24, 16);
const smallSphere = new THREE.SphereGeometry(1, 10, 8);
const dummy = new THREE.Object3D();
function material(color: number, roughness = 0.5) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
}
function mesh(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  position: THREE.Vector3,
  scale: THREE.Vector3,
) {
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(position);
  m.scale.copy(scale);
  return m;
}
export class BattleScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera();
  private actors = new Map<string, Actor>();
  private bacteria = new Map<string, Bacteria>();
  private effects: Effect[] = [];
  private fields = new Map<string, THREE.Mesh>();
  private raf = 0;
  private lastRender = 0;
  private frameInterval = 0;
  private software = false;
  private pendingFrame: WebGLSync | null = null;
  private observer: ResizeObserver;
  private start = performance.now();
  private now = 0;
  private lastEvent = 0;
  private lastTick = 0;
  private lastSeed = 0;
  private yaw = 0.48;
  private zoom = 1;
  private pan = new THREE.Vector3();
  private pointer?: {
    x: number;
    y: number;
    lastX: number;
    lastY: number;
    moved: boolean;
  };
  private raycaster = new THREE.Raycaster();
  private basePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3);
  private size = { w: 1, h: 1 };
  private routeGeometry = new THREE.BufferGeometry();
  private routeLine = new THREE.Line(
    this.routeGeometry,
    new THREE.LineBasicMaterial({
      color: 0xa9edff,
      transparent: true,
      opacity: 0.9,
    }),
  );
  private labelClock = 0;
  private ownedMaterials: THREE.Material[] = [];
  private ownedGeometry: THREE.BufferGeometry[] = [];
  private texture: THREE.CanvasTexture;
  constructor(
    private host: HTMLElement,
    private canvas: HTMLCanvasElement,
    private content: TacticalContent,
    private read: () => SceneInput,
    private pick: (pick: Pick) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const rendererName = debug
      ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
      : "";
    const software = /swiftshader|llvmpipe|software/i.test(rendererName);
    this.software = software;
    host.dataset.renderer = software ? "software" : "hardware";
    this.frameInterval = software ? 1000 / 10 : 0;
    this.renderer.setPixelRatio(
      software ? 0.6 : Math.min(devicePixelRatio, 1.5),
    );
    this.renderer.shadowMap.enabled = !software;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.routeGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(36), 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.routeGeometry.setDrawRange(0, 0);
    this.scene.add(this.routeLine);
    this.ownedGeometry.push(this.routeGeometry);
    this.ownedMaterials.push(this.routeLine.material);
    this.scene.fog = new THREE.Fog(0xb6afc8, 55, 110);
    this.scene.add(new THREE.HemisphereLight(0xe9edff, 0x663b52, 1.6));
    const sun = new THREE.DirectionalLight(0xffeadc, 2.6);
    sun.position.set(-15, 32, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(software ? 512 : 1024, software ? 512 : 1024);
    sun.shadow.camera.left = -28;
    sun.shadow.camera.right = 28;
    sun.shadow.camera.top = 27;
    sun.shadow.camera.bottom = -27;
    sun.shadow.normalBias = 0.06;
    sun.shadow.bias = -0.0003;
    sun.shadow.radius = 3;
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0xb5cfff, 1.4);
    rim.position.set(16, 12, -16);
    this.scene.add(rim);
    this.texture = this.tissueTexture();
    this.buildTerrain();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    canvas.addEventListener("pointerdown", this.down);
    canvas.addEventListener("pointermove", this.move);
    canvas.addEventListener("pointerup", this.up);
    canvas.addEventListener("pointercancel", this.cancelPointer);
    canvas.addEventListener("wheel", this.wheel, { passive: false });
    this.lastEvent = this.read().state.eventId;
    this.lastSeed = this.read().state.seed;
    this.lastTick = this.read().state.tick;
    this.resize();
    this.raf = requestAnimationFrame(this.draw);
  }
  private tissueTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#bd7f91";
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 500; i++) {
      const x = (Math.sin(i * 13.79) * 0.5 + 0.5) * 128,
        y = (Math.cos(i * 6.17) * 0.5 + 0.5) * 128;
      ctx.beginPath();
      ctx.ellipse(
        x,
        y,
        1.2 + (i % 3),
        0.7 + (i % 2),
        Math.sin(i),
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = i % 3 ? "rgba(255,218,222,.12)" : "rgba(83,43,77,.12)";
      ctx.fill();
    }
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(10, 10);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  private buildTerrain() {
    const geo = new THREE.PlaneGeometry(84, 76, 100, 90);
    geo.rotateX(-Math.PI / 2);
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        z = positions.getZ(i);
      positions.setY(i, terrain(x, z));
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xc995a3,
      map: this.texture,
      bumpMap: this.texture,
      bumpScale: 0.22,
      roughness: 0.9,
    });
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.ownedGeometry.push(geo);
    this.ownedMaterials.push(mat);
    const slab = mesh(
      new THREE.BoxGeometry(54, 1.3, 48),
      material(0x9d697e),
      new THREE.Vector3(0, -0.78, 0),
      new THREE.Vector3(1, 1, 1),
    );
    this.ownedGeometry.push(slab.geometry);
    this.ownedMaterials.push(slab.material as THREE.Material);
    const ridgeMat = material(0xae6c80, 0.68);
    this.ownedMaterials.push(ridgeMat);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const x = Math.cos(a) * 24,
        z = Math.sin(a) * 21;
      const ridge = mesh(
        new THREE.TorusGeometry(2.5, 0.72, 8, 32, Math.PI * 1.25),
        ridgeMat,
        new THREE.Vector3(x, -0.15, z),
        new THREE.Vector3(1.2, 1, 0.8),
      );
      ridge.rotation.set(-Math.PI / 2, 0.1, a);
      ridge.castShadow = true;
      ridge.receiveShadow = true;
      this.scene.add(ridge);
      this.ownedGeometry.push(ridge.geometry);
    }
    // Alveolar rims and narrow tissue bridges form a continuous navigable environment.
    for (const f of this.content.fields) {
      const g = new THREE.TorusGeometry(f.radius, 0.09, 6, 60, Math.PI * 0.72);
      const m = new THREE.MeshStandardMaterial({
        color: 0x995d75,
        roughness: 0.55,
      });
      const r = new THREE.Mesh(g, m);
      r.rotation.x = -Math.PI / 2;
      r.position.set(f.center.x, 0.04, f.center.z);
      r.receiveShadow = true;
      this.scene.add(r);
      this.ownedGeometry.push(g);
      this.ownedMaterials.push(m);
      this.fields.set(f.id, r);
      for (let j = 0; j < 5; j++) {
        const a = (j / 5) * Math.PI * 2;
        const p = mesh(
          smallSphere,
          ridgeMat,
          new THREE.Vector3(
            f.center.x + Math.cos(a) * (f.radius + 0.5),
            0.05,
            f.center.z + Math.sin(a) * (f.radius + 0.5),
          ),
          new THREE.Vector3(1.5, 0.35, 0.8),
        );
        p.rotation.y = a;
        p.receiveShadow = true;
        this.scene.add(p);
      }
    }
    const vesselMat = material(0x8e527c, 0.5);
    this.ownedMaterials.push(vesselMat);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-17, 0.3, 18),
      new THREE.Vector3(-7, 0.55, 16.5),
      new THREE.Vector3(1, 0.6, 16),
      new THREE.Vector3(10, 0.3, 19),
      new THREE.Vector3(22, 0.1, 17),
    ]);
    const vein = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 40, 0.65, 10, false),
      vesselMat,
    );
    vein.castShadow = true;
    this.scene.add(vein);
    this.ownedGeometry.push(vein.geometry);
    const portal = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.12, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0xb6efff }),
    );
    portal.rotation.x = -Math.PI / 2;
    portal.position.copy(vector(this.content.portal, 0.65));
    this.scene.add(portal);
    this.ownedMaterials.push(portal.material);
    this.ownedGeometry.push(portal.geometry);
  }
  private makeActor(cell: Cell): Actor {
    const root = new THREE.Group(),
      body = new THREE.Group();
    root.add(body);
    const color = this.content.cells[cell.kind].color;
    const shellMat = new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.28,
      metalness: 0.02,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
      clearcoat: 0.7,
      clearcoatRoughness: 0.3,
    });
    const shell = mesh(
      sphere,
      shellMat,
      new THREE.Vector3(0, 1.2, 0),
      new THREE.Vector3(1.35, 1.1, 1.3),
    );
    shell.castShadow = true;
    body.add(shell);
    const lobeMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.4,
      transparent: true,
      opacity: 0.85,
    });
    const lobes = new THREE.InstancedMesh(
      smallSphere,
      lobeMat,
      cell.kind === "dendritic" ? 12 : 10,
    );
    body.add(lobes);
    const nucleus = material(
      cell.kind === "dendritic" ? 0x5363b5 : 0x66418f,
      0.28,
    );
    const nucleusGroup = new THREE.Group();
    nucleusGroup.position.y = 1.3;
    const nuclei =
      cell.kind === "neutrophil"
        ? [
            [0.1, 0.1, 0.4, 0.48],
            [-0.4, -0.12, -0.1, 0.45],
            [0.4, -0.1, -0.2, 0.44],
          ]
        : cell.kind === "macrophage"
          ? [
              [-0.35, 0, 0, 0.58],
              [0.05, 0.35, -0.1, 0.52],
              [0.1, -0.3, 0, 0.4],
            ]
          : [[0, 0, 0, 0.68]];
    for (const [x, y, z, r] of nuclei) {
      const n = mesh(
        sphere,
        nucleus,
        new THREE.Vector3(x, y, z),
        new THREE.Vector3(r, r * 0.85, r),
      );
      nucleusGroup.add(n);
    }
    body.add(nucleusGroup);
    const granuleMat = material(
      cell.kind === "neutrophil" ? 0x89649e : 0x857ebd,
      0.22,
    );
    const granules = new THREE.InstancedMesh(smallSphere, granuleMat, 16);
    for (let i = 0; i < 16; i++) {
      const a = i * 2.39996;
      dummy.position.set(
        Math.cos(a) * (0.85 + (i % 2) * 0.12),
        1.25 + Math.sin(i * 1.7) * 0.45,
        Math.sin(a) * 0.8,
      );
      dummy.scale.setScalar(0.09 + (i % 3) * 0.04);
      dummy.rotation.set(0, a, 0);
      dummy.updateMatrix();
      granules.setMatrixAt(i, dummy.matrix);
    }
    body.add(granules);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x70e6ff,
      transparent: true,
      opacity: 0.9,
    });
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.8, 0.045, 6, 48),
      ringMat,
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.2;
    root.add(ring);
    ring.visible = false;
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x432d50,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.3, 24), shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.08;
    root.add(shadow);
    root.position.copy(
      vector(cell.position, terrain(cell.position.x, cell.position.z)),
    );
    const vacuole = new THREE.Group();
    vacuole.position.set(0.65, 1.35, 0.35);
    const vacMat = new THREE.MeshStandardMaterial({
      color: 0xffca70,
      transparent: true,
      opacity: 0.7,
      roughness: 0.3,
    });
    vacuole.add(
      mesh(
        sphere,
        vacMat,
        new THREE.Vector3(),
        new THREE.Vector3(0.47, 0.4, 0.47),
      ),
    );
    const liveMat = material(0x4c669b, 0.3);
    for (const x of [-0.16, 0.16])
      vacuole.add(
        mesh(
          smallSphere,
          liveMat,
          new THREE.Vector3(x, 0.15, 0.25),
          new THREE.Vector3(0.17, 0.19, 0.17),
        ),
      );
    body.add(vacuole);
    vacuole.visible = false;
    this.ownedMaterials.push(vacMat, liveMat);
    this.scene.add(root);
    this.ownedMaterials.push(
      shellMat,
      lobeMat,
      nucleus,
      granuleMat,
      ringMat,
      shadowMat,
    );
    this.ownedGeometry.push(ring.geometry, shadow.geometry);
    return {
      root,
      body,
      shell,
      lobes,
      granules,
      vacuole,
      ring,
      kind: cell.kind,
      phase: Number(cell.id.slice(1)) * 0.73,
    };
  }
  private makeBacteria(p: Colony): Bacteria {
    const root = new THREE.Group();
    const coreMat = material(0x5676b1, 0.28);
    const capMat = new THREE.MeshPhysicalMaterial({
      color: 0xb7d8ed,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      roughness: 0.12,
      clearcoat: 1,
    });
    const core = new THREE.InstancedMesh(smallSphere, coreMat, 100),
      capsule = new THREE.InstancedMesh(smallSphere, capMat, 100);
    root.add(core, capsule);
    const marks = new THREE.Group();
    const markMat = new THREE.LineBasicMaterial({ color: 0xffdd72 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const group = new THREE.Group();
      group.position.set(Math.cos(a) * 1.8, 0.5, Math.sin(a) * 1.8);
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0.55, 0),
        new THREE.Vector3(-0.23, 0.8, 0),
        new THREE.Vector3(0, 0.55, 0),
        new THREE.Vector3(0.23, 0.8, 0),
      ]);
      group.add(new THREE.Line(geometry, markMat));
      group.rotation.y = -a;
      marks.add(group);
      this.ownedGeometry.push(geometry);
    }
    root.add(marks);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd580,
      transparent: true,
      opacity: 0.85,
    });
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.1, 0.04, 6, 48),
      ringMat,
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.13;
    root.add(ring);
    ring.visible = false;
    this.scene.add(root);
    this.ownedMaterials.push(coreMat, capMat, markMat, ringMat);
    this.ownedGeometry.push(ring.geometry);
    return {
      root,
      core,
      capsule,
      marks,
      ring,
      signature: "",
      phase: Number(p.id.slice(1)),
    };
  }
  private updateBacteria(p: Colony, b: Bacteria, marked: boolean) {
    const signature = `${p.load}:${marked}`;
    if (signature === b.signature) return;
    b.signature = signature;
    const count = Math.min(p.load, 50);
    b.core.count = b.capsule.count = count * 2;
    for (let i = 0; i < count; i++) {
      const a = i * 2.39996;
      const r = Math.sqrt(i / count) * Math.min(2.2, 0.9 + count * 0.025);
      for (let pair = 0; pair < 2; pair++) {
        dummy.position.set(
          Math.cos(a) * r + (pair ? 1 : -1) * 0.2,
          0.32 + Math.sin(i * 7.1) * 0.06,
          Math.sin(a) * r,
        );
        dummy.rotation.set(0.08 * Math.sin(i), a, 0.2);
        dummy.scale.set(0.26, 0.31, 0.26);
        dummy.updateMatrix();
        b.core.setMatrixAt(i * 2 + pair, dummy.matrix);
        dummy.scale.set(0.34, 0.38, 0.32);
        dummy.updateMatrix();
        b.capsule.setMatrixAt(i * 2 + pair, dummy.matrix);
      }
    }
    b.core.instanceMatrix.needsUpdate = true;
    b.capsule.instanceMatrix.needsUpdate = true;
    b.marks.visible = marked;
    (b.core.material as THREE.MeshStandardMaterial).color.setHex(
      marked ? 0x7291b2 : 0x536eaa,
    );
  }
  private effect(event: TacticalEvent) {
    if (
      !["engulf", "mark", "grow", "arrive", "spread", "clear", "move"].includes(
        event.type,
      )
    )
      return;
    const root = new THREE.Group();
    let arms: THREE.InstancedMesh | undefined,
      ghost: THREE.Group | undefined,
      ring: THREE.Mesh | undefined;
    if (event.type === "engulf") {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xb29ada,
        roughness: 0.3,
        transparent: true,
        opacity: 0.8,
      });
      arms = new THREE.InstancedMesh(smallSphere, mat, 18);
      root.add(arms);
      this.ownedMaterials.push(mat);
      ghost = new THREE.Group();
      const gm = material(event.survives ? 0xe9b958 : 0x7593c9, 0.28);
      for (const x of [-0.2, 0.2])
        ghost.add(
          mesh(
            smallSphere,
            gm,
            new THREE.Vector3(x, 0, 0),
            new THREE.Vector3(0.27, 0.34, 0.27),
          ),
        );
      root.add(ghost);
      this.ownedMaterials.push(gm);
    } else if (event.type === "spread") {
      ghost = new THREE.Group();
      const gm = material(0x7084bb);
      ghost.add(
        mesh(
          smallSphere,
          gm,
          new THREE.Vector3(),
          new THREE.Vector3(0.4, 0.4, 0.4),
        ),
      );
      root.add(ghost);
      this.ownedMaterials.push(gm);
    } else {
      const gm = new THREE.MeshBasicMaterial({
        color:
          event.type === "mark"
            ? 0xffda78
            : event.type === "arrive"
              ? 0x87ebff
              : event.type === "clear"
                ? 0xd5efe6
                : 0xf6b8ac,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      });
      ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.055, 6, 40), gm);
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(vector(event.position, 0.3));
      root.add(ring);
      this.ownedGeometry.push(ring.geometry);
      this.ownedMaterials.push(gm);
    }
    this.scene.add(root);
    this.effects.push({ event, start: this.now, root, arms, ghost, ring });
  }
  private animateEffects(reduced: boolean, speed: number) {
    this.effects = this.effects.filter((f) => {
      const duration = (f.event.type === "engulf" ? 1.1 : 0.95) / speed;
      const p = (this.now - f.start) / duration;
      if (p >= 1) {
        this.scene.remove(f.root);
        f.root.traverse((o) => {
          if (o instanceof THREE.InstancedMesh) o.dispose();
        });
        return false;
      }
      const e = f.event;
      if (reduced) {
        f.root.visible = false;
        return true;
      }
      if (f.arms && f.ghost && e.from) {
        const from = vector(e.from, 1.1),
          to = vector(e.position, 0.7);
        const direction = to.clone().sub(from).setY(0).normalize();
        const side = new THREE.Vector3(-direction.z, 0, direction.x);
        const front = from.clone().addScaledVector(direction, 1.5);
        for (let arm = 0; arm < 2; arm++)
          for (let j = 0; j < 9; j++) {
            const t = j / 8;
            const reach =
              Math.min(1, p / 0.35) *
              (p > 0.75 ? Math.max(0.2, (1 - p) / 0.25) : 1);
            const closure = p < 0.4 ? 1 : Math.max(0.1, 1 - (p - 0.4) * 2.4);
            const at = from
              .clone()
              .lerp(front, t * reach)
              .addScaledVector(
                side,
                (arm ? 1 : -1) * Math.sin(t * Math.PI * 0.82) * 0.9 * closure,
              );
            at.y += Math.sin(t * Math.PI) * 0.4;
            dummy.position.copy(at);
            dummy.scale.set(0.3 - j * 0.016, 0.26, 0.32);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            f.arms.setMatrixAt(arm * 9 + j, dummy.matrix);
          }
        f.arms.instanceMatrix.needsUpdate = true;
        const ghostAt =
          p < 0.28
            ? to.clone().lerp(front, p / 0.28)
            : front
                .clone()
                .lerp(from, Math.max(0, Math.min(1, (p - 0.42) / 0.42)));
        f.ghost.position.copy(ghostAt);
        f.ghost.scale.setScalar(
          p > 0.75 ? (e.survives ? 0.7 : Math.max(0, (1 - p) / 0.25)) : 1,
        );
      } else if (f.ghost && e.from) {
        f.ghost.position.copy(
          vector(e.from, 0.7).lerp(vector(e.position, 0.7), p),
        );
      }
      if (f.ring) {
        const scale = e.type === "mark" ? 2.8 - p * 1 : 0.5 + p * 2.2;
        f.ring.scale.setScalar(scale);
        (f.ring.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.8;
        f.ring.position.y = 0.3 + Math.sin(p * Math.PI) * 0.5;
      }
      return true;
    });
  }
  private draw = (stamp: number) => {
    if (this.software && this.pendingFrame) {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      if (gl.clientWaitSync(this.pendingFrame, 0, 0) === gl.TIMEOUT_EXPIRED) {
        this.raf = requestAnimationFrame(this.draw);
        return;
      }
      gl.deleteSync(this.pendingFrame);
      this.pendingFrame = null;
    }
    if (stamp - this.lastRender < this.frameInterval) {
      this.raf = requestAnimationFrame(this.draw);
      return;
    }
    this.lastRender = stamp;
    const elapsed = (stamp - this.start) / 1000,
      delta = Math.min(0.4, elapsed - this.now);
    this.now = elapsed;
    const input = this.read(),
      s = input.state;
    if (
      s.tick < this.lastTick ||
      s.seed !== this.lastSeed ||
      s.eventId < this.lastEvent
    ) {
      for (const fx of this.effects) this.scene.remove(fx.root);
      this.effects = [];
      this.lastEvent = 0;
    }
    this.lastTick = s.tick;
    this.lastSeed = s.seed;
    const fresh = this.lastEvent === 0;
    for (const e of s.events)
      if (e.id > this.lastEvent) {
        if (!fresh && e.tick >= s.tick - 3) this.effect(e);
        this.lastEvent = e.id;
      }
    for (const [id, actor] of this.actors)
      if (!s.cells.some((u) => u.id === id)) {
        this.scene.remove(actor.root);
        actor.lobes.dispose();
        actor.granules.dispose();
        this.actors.delete(id);
      }
    for (const cell of s.cells) {
      let actor = this.actors.get(cell.id);
      if (!actor) {
        actor = this.makeActor(cell);
        this.actors.set(cell.id, actor);
      }
      const target = vector(
        cell.position,
        terrain(cell.position.x, cell.position.z),
      );
      actor.root.position.lerp(target, 1 - Math.exp(-delta * 18));
      if (actor.root.position.distanceTo(target) > 10)
        actor.root.position.copy(target);
      const phase = this.now + actor.phase;
      const live = input.idle && !input.reduced;
      actor.body.position.y = live ? Math.sin(phase * 1.5) * 0.07 : 0;
      actor.body.rotation.set(
        live ? Math.sin(phase) * 0.025 : 0,
        0,
        live ? Math.cos(phase * 0.8) * 0.025 : 0,
      );
      actor.shell.scale.set(
        1.35 * (1 + (live ? Math.sin(phase * 1.6) * 0.025 : 0)),
        1.1 * (1 + (live ? Math.cos(phase * 1.7) * 0.025 : 0)),
        1.3,
      );
      const count = actor.lobes.count;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const dendritic = cell.kind === "dendritic";
        const reach = dendritic
          ? 1.95
          : cell.kind === "neutrophil"
            ? 1.02
            : 1.18;
        const wave = live ? Math.sin(phase * 1.2 + i * 1.8) * 0.12 : 0;
        dummy.position.set(
          Math.cos(a) * (reach + wave),
          1.1 + Math.sin(i * 2) * 0.22,
          Math.sin(a) * (reach + wave),
        );
        dummy.scale.set(
          dendritic ? 0.14 : cell.kind === "neutrophil" ? 0.16 : 0.2,
          dendritic ? 0.18 : cell.kind === "neutrophil" ? 0.13 : 0.19,
          dendritic ? 0.7 : cell.kind === "neutrophil" ? 0.22 : 0.42,
        );
        dummy.rotation.set(0.1, a, 0);
        dummy.updateMatrix();
        actor.lobes.setMatrixAt(i, dummy.matrix);
      }
      actor.lobes.instanceMatrix.needsUpdate = true;
      actor.granules.rotation.y = live ? Math.sin(phase * 0.6) * 0.06 : 0;
      actor.ring.visible = input.selected === cell.id;
      actor.ring.scale.setScalar(
        input.reduced ? 1 : 1 + Math.sin(this.now * 4) * 0.04,
      );
      const infected = s.internal.some((p) => p.host === cell.id);
      actor.vacuole.visible = infected;
      (actor.shell.material as THREE.MeshPhysicalMaterial).emissive.setHex(
        infected ? 0x6b4110 : 0x120c26,
      );
      (actor.shell.material as THREE.MeshPhysicalMaterial).emissiveIntensity =
        infected ? 0.4 : 0.1;
    }
    for (const [id, b] of this.bacteria)
      if (!s.colonies.some((p) => p.id === id)) {
        this.scene.remove(b.root);
        b.core.dispose();
        b.capsule.dispose();
        this.bacteria.delete(id);
      }
    for (const p of s.colonies) {
      let b = this.bacteria.get(p.id);
      if (!b) {
        b = this.makeBacteria(p);
        this.bacteria.set(p.id, b);
      }
      b.root.position.copy(
        vector(p.position, terrain(p.position.x, p.position.z)),
      );
      b.root.rotation.y =
        input.idle && !input.reduced
          ? Math.sin(this.now * 0.7 + b.phase) * 0.025
          : 0;
      b.ring.visible = input.selected === p.id;
      this.updateBacteria(p, b, p.markedUntil > s.tick);
    }
    for (const f of this.content.fields) {
      const m = this.fields.get(f.id)!;
      const damage = 1 - s.health[f.id] / 100;
      (m.material as THREE.MeshStandardMaterial).color.setRGB(
        0.34 - damage * 0.15,
        0.14 - damage * 0.08,
        0.21 - damage * 0.1,
      );
    }
    const selectedCell = s.cells.find((u) => u.id === input.selected);
    if (selectedCell?.path.length) {
      const points = [selectedCell.position, ...selectedCell.path].slice(0, 12);
      const attribute = this.routeGeometry.attributes.position;
      points.forEach((p, i) =>
        attribute.setXYZ(i, p.x, terrain(p.x, p.z) + 0.25, p.z),
      );
      attribute.needsUpdate = true;
      this.routeGeometry.setDrawRange(0, points.length);
      this.routeGeometry.computeBoundingSphere();
    } else this.routeGeometry.setDrawRange(0, 0);
    this.animateEffects(input.reduced, input.speed);
    this.renderer.render(this.scene, this.camera);
    if (this.software) {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      this.pendingFrame = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
    }
    if (stamp - this.labelClock > 65) {
      this.labels(s);
      this.labelClock = stamp;
    }
    this.raf = requestAnimationFrame(this.draw);
  };
  private project(point: Vec, y = 2) {
    const v = vector(point, y).project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * this.size.w,
      y: (-v.y * 0.5 + 0.5) * this.size.h,
    };
  }
  private labels(s: TacticalState) {
    const items = [
      ...s.cells.map((u) => ({ id: u.id, p: u.position, y: 3.1 })),
      ...s.colonies.map((p) => ({ id: p.id, p: p.position, y: 1 })),
      ...this.content.fields.map((f) => ({
        id: `field-${f.id}`,
        p: { x: f.center.x, z: f.center.z - 5.8 },
        y: 0.6,
      })),
      { id: "portal", p: this.content.portal, y: 1 },
    ];
    // Keep field controls clear of the existing unit/colony hit targets.
    // Only labels move; terrain, models, camera and authority stay unchanged.
    const blockers = items
      .filter((item) => !item.id.startsWith("field-") && item.id !== "portal")
      .flatMap((item) => {
        const el = this.host.querySelector<HTMLElement>(
          `[data-world-label="${item.id}"]`,
        );
        return el
          ? [
              {
                ...this.project(item.p, item.y),
                w: el.offsetWidth,
                h: el.offsetHeight,
              },
            ]
          : [];
      });
    for (const item of items) {
      const el = this.host.querySelector<HTMLElement>(
        `[data-world-label="${item.id}"]`,
      );
      if (el) {
        const p = this.project(item.p, item.y);
        if (item.id.startsWith("field-")) {
          p.x = Math.max(
            el.offsetWidth / 2 + 5,
            Math.min(this.size.w - el.offsetWidth / 2 - 5, p.x),
          );
          for (let n = 0; n < blockers.length; n++) {
            const hit = blockers.find(
              (b) =>
                Math.abs(p.x - b.x) < (el.offsetWidth + b.w) / 2 + 4 &&
                Math.abs(p.y - b.y) < (el.offsetHeight + b.h) / 2 + 4,
            );
            if (!hit) break;
            const y = hit.y - (el.offsetHeight + hit.h) / 2 - 4;
            if (y < el.offsetHeight / 2 + 4) break;
            p.y = y;
          }
        }
        el.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-50%)`;
      }
    }
  }
  private resize() {
    this.size = { w: this.host.clientWidth, h: this.host.clientHeight };
    this.renderer.setSize(this.size.w, this.size.h, false);
    this.updateCamera();
  }
  private updateCamera() {
    const aspect = this.size.w / this.size.h;
    const h = (aspect < 0.9 ? 45 : aspect < 1.4 ? 37 : 31) / this.zoom;
    this.camera.left = (-h * aspect) / 2;
    this.camera.right = (h * aspect) / 2;
    this.camera.top = h / 2;
    this.camera.bottom = -h / 2;
    this.camera.near = 0.1;
    this.camera.far = 160;
    this.camera.position.set(
      Math.sin(this.yaw) * 44 + this.pan.x,
      34,
      Math.cos(this.yaw) * 44 + this.pan.z,
    );
    this.camera.lookAt(this.pan.x, 0.5, this.pan.z);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
    this.labels(this.read().state);
  }
  setZoom(delta: number) {
    this.zoom = Math.max(0.75, Math.min(1.7, this.zoom + delta));
    this.updateCamera();
  }
  rotate(delta: number) {
    this.yaw += delta;
    this.updateCamera();
  }
  focus(point: Vec, zoom = 1.3) {
    this.pan.set(point.x, 0, point.z);
    this.zoom = zoom;
    this.updateCamera();
  }
  reset() {
    this.yaw = 0.48;
    this.zoom = 1;
    this.pan.set(0, 0, 0);
    this.updateCamera();
  }
  private down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.pointer = {
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      moved: false,
    };
    this.canvas.setPointerCapture(e.pointerId);
  };
  private groundAt(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera(
      new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
    return this.raycaster.ray.intersectPlane(
      this.basePlane,
      new THREE.Vector3(),
    );
  }
  private move = (e: PointerEvent) => {
    if (!this.pointer) return;
    const p = this.pointer;
    if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) <= 6) return;
    p.moved = true;
    // Keep the grabbed ground point under the pointer. Ray/plane projection
    // handles camera pitch, yaw, zoom and viewport without inverted axes.
    const from = this.groundAt(p.lastX, p.lastY);
    const to = this.groundAt(e.clientX, e.clientY);
    if (from && to) {
      this.pan.x = Math.max(-7, Math.min(7, this.pan.x + from.x - to.x));
      this.pan.z = Math.max(-7, Math.min(7, this.pan.z + from.z - to.z));
      this.updateCamera();
    }
    p.lastX = e.clientX;
    p.lastY = e.clientY;
  };
  private up = (e: PointerEvent) => {
    const active = this.pointer;
    // Touch moves may be coalesced until the next frame. Apply the release
    // position before clearing capture, so a quick swipe cannot become a click.
    if (
      active &&
      (active.moved ||
        Math.hypot(e.clientX - active.x, e.clientY - active.y) > 6)
    )
      this.move(e);
    const down = this.pointer;
    this.pointer = undefined;
    if (!down || down.moved) return;
    const rect = this.canvas.getBoundingClientRect(),
      p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const s = this.read().state;
    const entities = [
      ...s.cells.map((u) => ({
        type: "cell" as const,
        id: u.id,
        point: u.position,
        y: 1.5,
      })),
      ...s.colonies.map((u) => ({
        type: "colony" as const,
        id: u.id,
        point: u.position,
        y: 0.5,
      })),
    ]
      .map((u) => ({
        ...u,
        d: Math.hypot(
          p.x - this.project(u.point, u.y).x,
          p.y - this.project(u.point, u.y).y,
        ),
      }))
      .sort((a, b) => a.d - b.d);
    if (entities[0]?.d < 28) {
      this.pick({ type: entities[0].type, id: entities[0].id });
      return;
    }
    const hit = this.groundAt(e.clientX, e.clientY);
    if (hit) this.pick({ type: "ground", point: { x: hit.x, z: hit.z } });
  };
  private cancelPointer = () => {
    this.pointer = undefined;
  };
  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    this.setZoom(e.deltaY > 0 ? -0.06 : 0.06);
  };
  dispose() {
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.canvas.removeEventListener("pointerdown", this.down);
    this.canvas.removeEventListener("pointermove", this.move);
    this.canvas.removeEventListener("pointerup", this.up);
    this.canvas.removeEventListener("pointercancel", this.cancelPointer);
    this.canvas.removeEventListener("wheel", this.wheel);
    for (const a of this.actors.values()) {
      a.lobes.dispose();
      a.granules.dispose();
    }
    for (const b of this.bacteria.values()) {
      b.core.dispose();
      b.capsule.dispose();
    }
    for (const material of this.ownedMaterials) material.dispose();
    for (const geometry of this.ownedGeometry) geometry.dispose();
    this.texture.dispose();
    if (this.pendingFrame)
      (this.renderer.getContext() as WebGL2RenderingContext).deleteSync(
        this.pendingFrame,
      );
    this.renderer.dispose();
  }
}
