import {
  antibodyModel,
  complementModel,
  pathogenGeometry,
} from "./MolecularModels";
import { coatings } from "../engine/opsonization";
import { chooseEntity } from "./selection";
import {
  makeTissueActor,
  updateTissueActor,
  disposeTissueActor,
} from "./TissueGeometry";
import * as THREE from "three";
import { placeFieldLabel } from "./labelLayout";
import { membraneGeometry, lymphoid } from "./CellGeometry";
import { buildAnatomy, tissueFloor, anatomyHeight } from "./Anatomy";
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
  inspect?: boolean;
  moving?: boolean;
  reduced: boolean;
  idle: boolean;
  speed: number;
}
export type Pick =
  | { type: "cell"; id: string }
  | { type: "colony"; id: string }
  | { type: "host"; id: string }
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
  form?: string;
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
const terrain = tissueFloor;
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
  private hosts = new Map<string, THREE.Group>();
  private bacteria = new Map<string, Bacteria>();
  private effects: Effect[] = [];
  private fields = new Map<string, THREE.Mesh>();
  private containment = new Map<string, THREE.Group>();
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
  private contacts = new Map<number, { x: number; y: number }>();
  private pinching = false;
  private pinch?: { distance: number; x: number; y: number };
  private swallowClick = false;
  private pointer?: {
    id: number;
    label: boolean;
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
    host.addEventListener("pointerdown", this.down);
    host.addEventListener("pointermove", this.move);
    host.addEventListener("pointerup", this.up);
    host.addEventListener("pointercancel", this.cancelPointer);
    canvas.addEventListener("wheel", this.wheel, { passive: false });
    host.addEventListener("click", this.guardClick, true);
    host.addEventListener("lostpointercapture", this.cancelPointer);
    window.addEventListener("blur", this.resetPointers);
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
    ctx.fillStyle = "#f3d6dc";
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
      ctx.fillStyle = i % 3 ? "rgba(255,240,244,.08)" : "rgba(103,63,97,.05)";
      ctx.fill();
    }
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(10, 10);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  private buildTerrain() {
    const anatomy = buildAnatomy(this.content, this.texture);
    this.scene.add(anatomy.root);
    this.ownedGeometry.push(...anatomy.geometries);
    this.ownedMaterials.push(...anatomy.materials);
    this.fields = anatomy.regions;
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
      opacity: 0.56,
      depthWrite: false,
      clearcoat: 0.4,
      clearcoatRoughness: 0.3,
    });
    const shell = mesh(
      membraneGeometry(cell.kind),
      shellMat,
      new THREE.Vector3(0, 1.2, 0),
      new THREE.Vector3(1.35, 1.1, 1.3),
    );
    shell.castShadow = true;
    body.add(shell);
    this.ownedGeometry.push(shell.geometry);
    const lobeMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.4,
      transparent: true,
      opacity: 0.85,
    });
    const lobes = new THREE.InstancedMesh(
      smallSphere,
      lobeMat,
      cell.kind === "macrophage" ? 7 : cell.kind === "dendritic" ? 8 : 0,
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
            [-0.43, 0.05, 0.15, 0.4],
            [0.03, 0.25, -0.14, 0.37],
            [0.42, -0.12, 0.08, 0.37],
          ]
        : [
            [
              cell.kind === "plasma" ? -0.35 : -0.12,
              0,
              0,
              lymphoid(cell.kind) ? 0.85 : 0.63,
            ],
          ];
    for (const [x, y, z, r] of nuclei) {
      const ng = new THREE.SphereGeometry(1, 24, 16);
      if (cell.kind === "macrophage") {
        const p = ng.attributes.position;
        for (let i = 0; i < p.count; i++)
          p.setX(i, p.getX(i) * 0.67 + 0.32 * Math.cos(p.getY(i) * 2.7));
        ng.computeVertexNormals();
      }
      const n = mesh(
        ng,
        nucleus,
        new THREE.Vector3(x, y, z),
        new THREE.Vector3(r, r * 0.92, r * 0.85),
      );
      nucleusGroup.add(n);
      this.ownedGeometry.push(ng);
    }
    if (cell.kind === "neutrophil") {
      const curve = new THREE.CatmullRomCurve3(
        nuclei.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      );
      const link = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 16, 0.07, 6, false),
        nucleus,
      );
      nucleusGroup.add(link);
      this.ownedGeometry.push(link.geometry);
    }
    body.add(nucleusGroup);
    const granuleMat = material(
      cell.kind === "neutrophil"
        ? 0xb48b9d
        : ["nk", "cytotoxicT"].includes(cell.kind)
          ? 0xbc678c
          : cell.kind === "macrophage"
            ? 0xb79d7e
            : 0x857ebd,
      0.22,
    );
    const granules = new THREE.InstancedMesh(
      smallSphere,
      granuleMat,
      cell.kind === "neutrophil" ? 36 : lymphoid(cell.kind) ? 12 : 24,
    );
    for (let i = 0; i < granules.count; i++) {
      const a = i * 2.39996;
      dummy.position.set(
        Math.cos(a) * (0.85 + (i % 2) * 0.12),
        1.25 + Math.sin(i * 1.7) * 0.45,
        Math.sin(a) * 0.8,
      );
      dummy.scale.setScalar(0.055 + (i % 3) * 0.025);
      dummy.rotation.set(0, a, 0);
      dummy.updateMatrix();
      granules.setMatrixAt(i, dummy.matrix);
    }
    body.add(granules);
    if (["th1", "tfh", "th17", "ilc3"].includes(cell.kind)) {
      const receptor = material(
        cell.kind === "th17" ? 0xf2d5ad : 0xbae5d1,
        0.45,
      );
      this.ownedMaterials.push(receptor);
      const n =
        cell.kind === "tfh"
          ? 6
          : cell.kind === "th1"
            ? 3
            : cell.kind === "th17"
              ? 4
              : 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const g = new THREE.TorusGeometry(0.12, 0.035, 5, 10);
        const m = new THREE.Mesh(g, receptor);
        m.position.set(Math.cos(a) * 1.1, 1.6, Math.sin(a) * 1.1);
        m.rotation.y = -a;
        body.add(m);
        this.ownedGeometry.push(g);
      }
    }
    if (cell.kind === "plasma") {
      const roughER = material(0xa58ab2, 0.5);
      this.ownedMaterials.push(roughER);
      for (let i = 0; i < 4; i++) {
        const pts = Array.from({ length: 12 }, (_, j) => {
          const a = -1.2 + (j / 11) * 2.4;
          return new THREE.Vector3(
            0.2 + Math.cos(a) * (0.65 + i * 0.08),
            1 + 0.15 * i,
            Math.sin(a) * 0.66,
          );
        });
        const band = new THREE.Mesh(
          new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3(pts),
            16,
            0.045,
            5,
            false,
          ),
          roughER,
        );
        body.add(band);
        this.ownedGeometry.push(band.geometry);
      }
    }
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
    const core: THREE.InstancedMesh = new THREE.InstancedMesh(
        smallSphere,
        coreMat,
        100,
      ),
      capsule: THREE.InstancedMesh = new THREE.InstancedMesh(
        smallSphere,
        capMat,
        100,
      );
    root.add(core, capsule);
    const marks = new THREE.Group();
    const markMat = material(0xffdd72, 0.28),
      igMat = material(0x84df9e, 0.25);
    const ownModel = (g: THREE.Group) => {
      g.traverse((o) => {
        if (o instanceof THREE.Mesh) this.ownedGeometry.push(o.geometry);
      });
      return g;
    };
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const ig = ownModel(antibodyModel(igMat));
      ig.position.set(Math.cos(a) * 1.6, 0.25, Math.sin(a) * 1.6);
      ig.rotation.y = -a;
      marks.add(ig);
      const c3 = ownModel(complementModel(markMat));
      c3.position.set(Math.cos(a + 0.3) * 1.5, 0.45, Math.sin(a + 0.3) * 1.5);
      marks.add(c3);
    }
    this.ownedMaterials.push(igMat);
    const pg = pathogenGeometry(
      this.content.pathogen.shape ?? "coccus",
      p.form === "hypha",
    );
    core.geometry = pg;
    capsule.geometry = pg;
    this.ownedGeometry.push(pg);
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
      form: p.form,
      phase: Number(p.id.slice(1)),
    };
  }
  private updateBacteria(p: Colony, b: Bacteria, tick: number) {
    const active = coatings(p, tick),
      marked = active.complement || active.antibody;
    const pending = (kind: string) =>
      !this.read().reduced &&
      this.effects.some(
        (f) =>
          f.event.type === "mark" &&
          f.event.target === p.id &&
          f.event.opsonin === kind &&
          (this.now - f.start) * this.read().speed < 1.05,
      );
    const showC3 = active.complement && !pending("c3b"),
      showIg = active.antibody && !pending("antibody");
    const signature = `${p.load}:${showC3}:${showIg}:${p.form}`;
    if (b.form !== p.form) {
      const g = pathogenGeometry(
        this.content.pathogen.shape ?? "coccus",
        p.form === "hypha",
      );
      b.core.geometry = g;
      b.capsule.geometry = g;
      this.ownedGeometry.push(g);
      b.form = p.form;
      if (p.form === "hypha") b.root.userData.hyphaAt = this.now;
    }

    if (signature === b.signature) return;
    b.signature = signature;
    const count = Math.min(p.load, p.form === "hypha" ? 9 : 50);
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
        const shape = this.content.pathogen.shape;
        const scale =
          p.form === "hypha"
            ? 0.6
            : shape === "fungus"
              ? 0.4
              : shape === "virus" || shape === "retrovirus"
                ? 0.31
                : 0.26;
        dummy.scale.set(
          scale,
          scale * (shape === "rod" || shape === "acidfast" ? 1.05 : 1.2),
          scale,
        );
        dummy.updateMatrix();
        b.core.setMatrixAt(i * 2 + pair, dummy.matrix);
        dummy.scale.multiplyScalar(
          this.content.pathogen.shape === "acidfast" ? 1.06 : 1.2,
        );
        dummy.updateMatrix();
        b.capsule.setMatrixAt(i * 2 + pair, dummy.matrix);
      }
    }
    b.core.instanceMatrix.needsUpdate = true;
    b.capsule.instanceMatrix.needsUpdate = true;
    b.marks.visible = marked;
    b.marks.children.forEach(
      (child) => (child.visible = child.name === "c3b" ? showC3 : showIg),
    );
    (b.core.material as THREE.MeshStandardMaterial).color.setHex(
      this.content.pathogen.shape === "fungus"
        ? 0xdbbda8
        : this.content.pathogen.shape === "acidfast"
          ? 0xc28c87
          : this.content.pathogen.shape === "rod"
            ? 0x7ea7aa
            : this.content.pathogen.shape === "retrovirus"
              ? 0xb077af
              : marked
                ? 0x7291b2
                : 0x536eaa,
    );
  }
  private effect(event: TacticalEvent) {
    if (
      ![
        "engulf",
        "mark",
        "grow",
        "arrive",
        "spread",
        "clear",
        "move",
        "cytotoxic",
        "dock",
        "degranulate",
        "infect",
        "release",
        "barrier",
        "contain",
      ].includes(event.type)
    )
      return;
    const root = new THREE.Group();
    let arms: THREE.InstancedMesh | undefined,
      ghost: THREE.Group | undefined,
      ring: THREE.Mesh | undefined;
    if (event.type === "mark") {
      ghost = new THREE.Group();
      const gm = material(
        event.opsonin === "antibody" ? 0x84df9e : 0xffdd72,
        0.25,
      );
      for (let i = 0; i < 9; i++) {
        const g =
          event.opsonin === "antibody"
            ? antibodyModel(gm)
            : complementModel(gm);
        g.scale.setScalar(event.opsonin === "antibody" ? 0.58 : 1);
        g.traverse((o) => {
          if (o instanceof THREE.Mesh) this.ownedGeometry.push(o.geometry);
        });
        ghost.add(g);
      }
      root.add(ghost);
      this.ownedMaterials.push(gm);
    } else if (
      (event.type === "infect" || event.type === "release") &&
      event.from
    ) {
      ghost = new THREE.Group();
      const gm = material(
        this.content.pathogen.shape === "retrovirus" ? 0xb077af : 0x7084bb,
        0.3,
      );
      const geo = pathogenGeometry(this.content.pathogen.shape ?? "virus");
      this.ownedGeometry.push(geo);
      this.ownedMaterials.push(gm);
      const count = event.type === "release" ? Math.min(4, event.amount) : 1;
      for (let i = 0; i < count; i++)
        ghost.add(
          mesh(
            geo,
            gm,
            new THREE.Vector3((i - (count - 1) / 2) * 0.22, 0, 0),
            new THREE.Vector3(0.3, 0.3, 0.3),
          ),
        );
      root.add(ghost);
    } else if (event.type === "dock") {
      ghost = new THREE.Group();
      const gm = material(0xc4f1d0, 0.3);
      for (let i = 0; i < 5; i++)
        ghost.add(
          mesh(
            smallSphere,
            gm,
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0.12, 0.12, 0.12),
          ),
        );
      root.add(ghost);
      this.ownedMaterials.push(gm);
    } else if (event.type === "cytotoxic" || event.type === "degranulate") {
      ghost = new THREE.Group();
      const gm = material(0xf3b2ca, 0.28);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ghost.add(
          mesh(
            smallSphere,
            gm,
            new THREE.Vector3(Math.cos(a) * 0.23, Math.sin(a) * 0.23, 0),
            new THREE.Vector3(0.07, 0.07, 0.1),
          ),
        );
      }
      root.add(ghost);
      this.ownedMaterials.push(gm);
    } else if (event.type === "engulf") {
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
      const pg = pathogenGeometry(this.content.pathogen.shape ?? "coccus");
      this.ownedGeometry.push(pg);
      for (const x of this.content.pathogen.shape &&
      this.content.pathogen.shape !== "coccus"
        ? [0]
        : [-0.2, 0.2])
        ghost.add(
          mesh(
            pg,
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
          event.type === "arrive"
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
  skipEffects() {
    for (const fx of this.effects) {
      this.scene.remove(fx.root);
      fx.root.traverse((o) => {
        if (o instanceof THREE.InstancedMesh) o.dispose();
      });
    }
    this.effects = [];
    for (const b of this.bacteria.values()) {
      b.signature = "";
      b.root.userData.hyphaAt = -100;
    }
  }
  private animateEffects(reduced: boolean, speed: number) {
    this.effects = this.effects.filter((f) => {
      const duration =
        (f.event.type === "engulf"
          ? 1.1
          : f.event.type === "mark"
            ? 1.35
            : f.event.type === "dock"
              ? 3
              : 0.95) / speed;
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
      if (e.type === "mark" && f.ghost) {
        const from = vector(e.from ?? this.content.portal, 2),
          to = vector(e.position, 0.5);
        f.ghost.children.forEach((g, i) => {
          const delay = i * 0.017,
            t = Math.max(0, Math.min(1, (p - delay) / 0.68));
          const a = i * 2.39996,
            r = ((e.opsonin === "antibody" ? 0.9 : 1.5) * (i + 1)) / 9;
          const landing = to
            .clone()
            .add(new THREE.Vector3(Math.cos(a) * r, 0.15, Math.sin(a) * r));
          g.position.copy(from.clone().lerp(landing, t));
          g.position.y +=
            Math.sin(t * Math.PI) * (e.opsonin === "antibody" ? 1.4 : 4.8);
          g.rotation.set(e.opsonin === "antibody" ? 0 : p * 3, a + p * 0.7, 0);
          g.visible = t < 1 || p < 0.88;
        });
      } else if (
        (e.type === "infect" || e.type === "release") &&
        f.ghost &&
        e.from
      ) {
        const from = vector(e.from, e.type === "release" ? 1 : 0.6),
          to = vector(e.position, 0.8);
        const t = Math.min(1, p / 0.8);
        f.ghost.position.copy(from.lerp(to, t));
        f.ghost.position.y += Math.sin(t * Math.PI) * 0.5;
        f.ghost.scale.setScalar(
          e.type === "infect"
            ? 1 - Math.max(0, (p - 0.6) / 0.4) * 0.85
            : Math.min(1, 0.3 + p * 1.5),
        );
      } else if (e.type === "dock" && f.ghost && e.from) {
        const from = vector(e.from, 1.4),
          to = vector(e.position, 1.4);
        f.ghost.children.forEach((g, i) =>
          g.position
            .copy(from.clone().lerp(to, (i + 0.5) / 5))
            .add(new THREE.Vector3(0, Math.sin(p * 12 + i) * 0.08, 0)),
        );
      } else if (
        (e.type === "cytotoxic" || e.type === "degranulate") &&
        f.ghost &&
        e.from
      ) {
        const from = vector(e.from, 1),
          to = vector(e.position, 1);
        f.ghost.position.copy(from.lerp(to, Math.min(1, p / 0.55)));
        f.ghost.scale.setScalar(p < 0.55 ? 1 : 1 - (p - 0.55));
        // Contact-local pore ring and granule transfer precede host shrinkage/blebbing.
        f.ghost.lookAt(to);
      } else if (f.arms && f.ghost && e.from) {
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
  private draw = () => {
    const stamp = performance.now();
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
      delta = Math.max(0, Math.min(0.4, elapsed - this.now));
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
      if (actor && actor.kind !== cell.kind) {
        this.scene.remove(actor.root);
        actor.lobes.dispose();
        actor.granules.dispose();
        this.actors.delete(cell.id);
        actor = undefined;
      }
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
      if (actor.shell.morphTargetInfluences)
        actor.shell.morphTargetInfluences[0] = live
          ? 0.5 + Math.sin(phase * 1.2) * 0.45
          : 0.5;
      const count = actor.lobes.count;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + 0.15 * Math.sin(i * 3.1),
          dc = cell.kind === "dendritic";
        const wave = live ? Math.sin(phase * 1.2 + i * 1.8) * 0.045 : 0;
        const reach = dc ? 2.55 : 1.65;
        dummy.position.set(
          Math.cos(a) * (reach + wave),
          1.2 + Math.sin(i * 2) * 0.06,
          Math.sin(a) * (reach + wave),
        );
        dummy.scale.set(dc ? 0.09 : 0.15, dc ? 0.1 : 0.13, dc ? 0.12 : 0.22);
        dummy.rotation.set(0, Math.PI / 2 - a, 0);
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
      actor.vacuole.visible = s.internal.some(
        (p) => p.host === cell.id && p.compartment === "phagosome",
      );
      (actor.shell.material as THREE.MeshPhysicalMaterial).emissive.setHex(
        infected ? 0x6b4110 : 0x120c26,
      );
      (actor.shell.material as THREE.MeshPhysicalMaterial).emissiveIntensity =
        infected ? 0.4 : 0.1;
    }
    if (s.campaign && this.content.mechanics === "containment")
      for (const field of this.content.fields) {
        const progress = s.campaign.containment[field.id];
        let wall = this.containment.get(field.id);
        if (!wall) {
          wall = new THREE.Group();
          const mat = material(0xc7b4c5, 0.8);
          this.ownedMaterials.push(mat);
          for (let i = 0; i < 18; i++) {
            const a = (i / 18) * Math.PI * 2;
            const g = new THREE.CapsuleGeometry(0.08, 0.75, 3, 6);
            const fibre = new THREE.Mesh(g, mat);
            fibre.position.set(Math.cos(a) * 4, 0.2, Math.sin(a) * 4);
            fibre.rotation.set(Math.PI / 2, 0, -a);
            wall.add(fibre);
            this.ownedGeometry.push(g);
          }
          this.scene.add(wall);
          this.containment.set(field.id, wall);
        }
        const focus = s.cells.find(
          (u) =>
            u.region === field.id && s.internal.some((p) => p.host === u.id),
        );
        wall.visible = !!focus && progress > 5;
        if (focus) wall.position.copy(vector(focus.position, 0.15));
        wall.children.forEach((f, i) => (f.visible = i / 18 < progress / 100));
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
      this.updateBacteria(p, b, s.tick);
      const growth = input.reduced
        ? 1
        : Math.max(
            0.1,
            Math.min(
              1,
              ((this.now - (b.root.userData.hyphaAt ?? -100)) * input.speed) /
                1.1,
            ),
          );
      b.core.scale.y = b.capsule.scale.y = p.form === "hypha" ? growth : 1;
    }
    for (const [id, root] of this.hosts)
      if (!s.hosts.some((h) => h.id === id)) {
        this.scene.remove(root);
        disposeTissueActor(root);
        this.hosts.delete(id);
      }
    for (const host of s.hosts) {
      let root = this.hosts.get(host.id);
      if (!root) {
        root = makeTissueActor(host, this.content);
        this.scene.add(root);
        this.hosts.set(host.id, root);
      }
      updateTissueActor(
        root,
        host,
        s.tick,
        input.selected === host.id,
        !!input.inspect && input.selected === host.id,
      );
      if (
        !input.reduced &&
        this.effects.some(
          (f) =>
            f.event.type === "infect" &&
            f.event.target === host.id &&
            f.event.from &&
            (this.now - f.start) * input.speed < 0.75,
        )
      )
        root.getObjectByName("infection")!.visible = false;
    }
    for (const f of this.content.fields) {
      const m = this.fields.get(f.id)!;
      const damage = 1 - s.health[f.id] / 100;
      (m.material as THREE.MeshStandardMaterial).color.setRGB(
        0.7 - damage * 0.22,
        0.35 - damage * 0.16,
        0.45 - damage * 0.13,
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
      ...s.hosts.map((h) => ({
        id: h.id,
        p: h.position,
        y: anatomyHeight(h.position.x, h.position.z, this.content) + 0.65,
      })),
      ...this.content.fields.map((f) => ({
        id: `field-${f.id}`,
        p: { x: f.center.x, z: f.center.z - 5.8 },
        y: 0.6,
      })),
      { id: "portal", p: this.content.portal, y: 1 },
      ...(this.content.lymphExit
        ? [{ id: "lymph", p: this.content.lymphExit, y: 1 }]
        : []),
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
    const rect = this.host.getBoundingClientRect();
    const overlays =
      this.host.parentElement?.querySelectorAll<HTMLElement>(
        ".t-hud,.t-objective,.t-tactical-hint,.t-field-tools,.t-strategy-tools,.t-arrival-queue,.t-camera-controls,.t-camera-hint,.t-command-dock,.t-order-banner,.t-tutorial:not([hidden]),.t-recruit-card,.t-event-ribbon,.t-space-caption",
      ) ?? [];
    for (const overlay of overlays) {
      const r = overlay.getBoundingClientRect();
      if (
        r.width &&
        r.height &&
        r.right > rect.left &&
        r.left < rect.right &&
        r.bottom > rect.top &&
        r.top < rect.bottom
      )
        blockers.push({
          x: r.x - rect.x + r.width / 2,
          y: r.y - rect.y + r.height / 2,
          w: r.width,
          h: r.height,
        });
    }
    // Keep model hit regions available as well as their DOM labels.
    for (const u of s.cells)
      blockers.push({ ...this.project(u.position, 1.5), w: 44, h: 44 });
    for (const item of items) {
      const el = this.host.querySelector<HTMLElement>(
        `[data-world-label="${item.id}"]`,
      );
      if (!el) continue;
      let p = this.project(item.p, item.y);
      if (item.id.startsWith("field-")) {
        const placement = placeFieldLabel(
          { ...p, w: el.offsetWidth, h: el.offsetHeight },
          this.size,
          blockers,
        );
        const line = this.host.querySelector<SVGLineElement>(
          `[data-field-line="${item.id}"]`,
        );
        if (line) {
          line.setAttribute("x1", String(p.x));
          line.setAttribute("y1", String(p.y));
          line.setAttribute("x2", String(placement.x));
          line.setAttribute("y2", String(placement.y));
          line.style.visibility =
            Math.hypot(p.x - placement.x, p.y - placement.y) > 5
              ? "visible"
              : "hidden";
        }
        p = placement;
        blockers.push(placement);
      }
      el.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-50%)`;
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
    this.host.dataset.cameraZoom = this.zoom.toFixed(4);
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
  private guardClick = (e: MouseEvent) => {
    if (!this.swallowClick) return;
    this.swallowClick = false;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  private pinchPair() {
    const [a, b] = [...this.contacts.values()];
    return a && b
      ? {
          distance: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)),
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
        }
      : undefined;
  }
  private down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    if (!this.contacts.size) this.swallowClick = false;
    this.contacts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.contacts.size > 1) {
      this.pinching = true;
      this.swallowClick = true;
      this.pointer = undefined;
      this.pinch = this.pinchPair();
      for (const id of this.contacts.keys()) this.host.setPointerCapture(id);
      return;
    }
    if (this.pinching) return;
    this.pointer = {
      id: e.pointerId,
      label: e.target instanceof Element && !!e.target.closest("button"),
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      moved: false,
    };
    if (!this.pointer.label) this.host.setPointerCapture(e.pointerId);
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
    if (!this.contacts.has(e.pointerId)) return;
    this.contacts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pinching) {
      const next = this.pinchPair();
      if (next && this.pinch) {
        const from = this.groundAt(this.pinch.x, this.pinch.y);
        this.setZoom(this.zoom * (next.distance / this.pinch.distance - 1));
        const to = this.groundAt(next.x, next.y);
        if (from && to) {
          this.pan.x = Math.max(-7, Math.min(7, this.pan.x + from.x - to.x));
          this.pan.z = Math.max(-7, Math.min(7, this.pan.z + from.z - to.z));
          this.updateCamera();
        }
      }
      this.pinch = next;
      return;
    }
    if (!this.pointer || this.pointer.id !== e.pointerId) return;
    const p = this.pointer;
    if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) <= 6) return;
    p.moved = true;
    this.swallowClick = true;
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
    if (!this.contacts.has(e.pointerId)) return;
    if (this.pinching) {
      this.contacts.delete(e.pointerId);
      this.pinch = this.pinchPair();
      if (!this.contacts.size) {
        this.pinching = false;
        this.pointer = undefined;
      }
      return;
    }
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
    this.contacts.delete(e.pointerId);
    if (!down || down.moved || down.label) return;
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
      ...s.hosts.map((h) => ({
        type: "host" as const,
        id: h.id,
        point: h.position,
        y: anatomyHeight(h.position.x, h.position.z, this.content) + 0.35,
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
    const entity = chooseEntity(entities, this.read().moving);
    if (entity) {
      this.pick({ type: entity.type, id: entity.id });
      return;
    }
    const hit = this.groundAt(e.clientX, e.clientY);
    if (hit) this.pick({ type: "ground", point: { x: hit.x, z: hit.z } });
  };
  private cancelPointer = (e: PointerEvent) => {
    if (!this.contacts.has(e.pointerId)) return;
    this.contacts.delete(e.pointerId);
    this.pointer = undefined;
    this.swallowClick = true;
    this.pinch = this.pinchPair();
    if (!this.contacts.size) this.pinching = false;
  };
  private resetPointers = () => {
    this.contacts.clear();
    this.pointer = undefined;
    this.pinching = false;
    this.pinch = undefined;
    this.swallowClick = true;
  };
  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    this.setZoom(e.deltaY > 0 ? -0.06 : 0.06);
  };
  dispose() {
    cancelAnimationFrame(this.raf);
    this.resetPointers();
    this.host.removeEventListener("click", this.guardClick, true);
    this.host.removeEventListener("lostpointercapture", this.cancelPointer);
    window.removeEventListener("blur", this.resetPointers);
    this.observer.disconnect();
    this.host.removeEventListener("pointerdown", this.down);
    this.host.removeEventListener("pointermove", this.move);
    this.host.removeEventListener("pointerup", this.up);
    this.host.removeEventListener("pointercancel", this.cancelPointer);
    this.canvas.removeEventListener("wheel", this.wheel);
    for (const a of this.actors.values()) {
      a.lobes.dispose();
      a.granules.dispose();
    }
    for (const h of this.hosts.values()) disposeTissueActor(h);
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
