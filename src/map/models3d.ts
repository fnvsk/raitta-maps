import { MercatorCoordinate, type CustomLayerInterface, type Map as MapLibre } from 'maplibre-gl';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Mode } from '@/core/types';
import { MODE_COLORS } from './layers';

export const MODEL_LAYER_ID = 'raita-models';

const MIN_VEHICLE_ZOOM = 14.5;
const MIN_LANDMARK_ZOOM = 12;
const MAX_INSTANCES = 800;
const LANDMARK_RANGE_M = 40_000;

export interface ModelVehicle {
  lon: number;
  lat: number;
  bearing: number;
  mode: Mode;
}

interface ModelLayerOptions {
  dark: boolean;
  vehicles: () => ModelVehicle[];
}

type Part = THREE.BufferGeometry;

const paint = (geometry: Part, color: string) => {
  const c = new THREE.Color(color);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set([c.r, c.g, c.b], i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
};

const box = (width: number, depth: number, height: number, x: number, y: number, z: number, color: string) =>
  paint(new THREE.BoxGeometry(width, depth, height).translate(x, y, z + height / 2), color);

const column = (bottom: number, top: number, height: number, z: number, color: string, x = 0, y = 0, sides = 24) =>
  paint(
    new THREE.CylinderGeometry(top, bottom, height, sides).rotateX(Math.PI / 2).translate(x, y, z + height / 2),
    color,
  );

const dome = (radius: number, z: number, color: string, x = 0, y = 0) =>
  paint(
    new THREE.SphereGeometry(radius, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).translate(x, y, z),
    color,
  );

const gable = (length: number, width: number, height: number, x: number, y: number, z: number, color: string) => {
  const profile = new THREE.Shape();
  profile.moveTo(-width / 2, 0);
  profile.lineTo(width / 2, 0);
  profile.lineTo(0, height);
  profile.closePath();
  const geometry = new THREE.ExtrudeGeometry(profile, { depth: length, bevelEnabled: false })
    .rotateY(Math.PI / 2)
    .rotateX(Math.PI / 2)
    .translate(x - length / 2, y, z);
  return paint(geometry, color);
};

const merge = (parts: Part[]) => {
  const flat = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  for (const part of flat) part.deleteAttribute('uv');
  const merged = mergeGeometries(flat);
  merged.computeVertexNormals();
  return merged;
};

const WHITE = '#FFFFFF';
const GLASS = '#1E2A38';
const TYRE = '#1B1F27';
const HUB = '#C9CFD8';
const ROOF = '#F2F4F7';
const GREY = '#B8C0CC';
const BELLOWS = '#2C333D';
const HEADLIGHT = '#FFF4C2';
const TAILLIGHT = '#FF3B30';
const SIGN = '#FFB020';

const ALONG_TO_WORLD = new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);

function hull(length: number, width: number, bottom: number, top: number, color: string, { front = 0.2, rear = 0.2, radius = 0.35, y = 0 } = {}) {
  const bevel = 0.08;
  const half = length / 2 - bevel;
  bottom += bevel;
  top -= bevel;
  const shape = new THREE.Shape();
  shape.moveTo(-half, bottom);
  shape.lineTo(half, bottom);
  shape.lineTo(half, bottom + 0.6);
  shape.lineTo(half - front, top - radius);
  shape.quadraticCurveTo(half - front, top, half - front - radius, top);
  shape.lineTo(-half + rear + radius, top);
  shape.quadraticCurveTo(-half + rear, top, -half + rear, top - radius);
  shape.lineTo(-half, bottom + 0.6);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 1,
    curveSegments: 3,
  })
    .applyMatrix4(ALONG_TO_WORLD)
    .translate(-width / 2 + bevel, y, 0);
  return paint(geometry, color);
}

const sidePanel = (width: number, side: number, length: number, height: number, y: number, z: number, color: string) =>
  box(0.04, length, height, side * (width / 2 + 0.02), y, z, color);

function windscreen(width: number, end: number, y: number, z: number, height: number, slope: number, color = GLASS) {
  const pane = new THREE.BoxGeometry(width - 0.35, 0.05, height).rotateX(end * Math.atan2(slope, height));
  return paint(pane.translate(0, y + end * (0.03 - slope / 2), z + height / 2), color);
}

const wheels = (width: number, y: number, radius = 0.5) =>
  [-1, 1].flatMap((side) => [
    paint(new THREE.CylinderGeometry(radius, radius, 0.32, 10).rotateZ(Math.PI / 2).translate(side * (width / 2 - 0.12), y, radius), TYRE),
    paint(new THREE.CylinderGeometry(radius * 0.45, radius * 0.45, 0.34, 8).rotateZ(Math.PI / 2).translate(side * (width / 2 - 0.12), y, radius), HUB),
  ]);

const lamps = (width: number, y: number, z: number, color: string) =>
  [-1, 1].map((side) => box(0.45, 0.06, 0.18, side * (width / 2 - 0.4), y, z, color));

interface VehicleModel {
  body: Part;
  detail: Part;
  lights: Part;
}

function busModel(): VehicleModel {
  const W = 2.55;
  const L = 12;
  return {
    body: merge([hull(L, W, 0.35, 3.0, WHITE, { front: 0.25, rear: 0.1, radius: 0.4 })]),
    detail: merge([
      box(W - 0.25, L - 0.9, 0.06, 0, -0.1, 3.0, ROOF),
      box(1.7, 3.2, 0.32, 0, -1.6, 3.04, GREY),

      ...[-1, 1].flatMap((side) => [
        sidePanel(W, side, L - 1.6, 1.15, -0.4, 1.55, GLASS),
        ...[4.4, -0.4].map((y) => sidePanel(W, side, 1.2, 2.25, y, 0.5, GLASS)),
      ]),
      windscreen(W, 1, L / 2 - 0.05, 1.2, 1.7, 0.22),
      windscreen(W, -1, -L / 2 + 0.02, 1.7, 1.1, 0.08),

      box(W - 0.1, 0.12, 0.35, 0, L / 2 - 0.02, 0.35, '#2A313B'),
      box(W - 0.1, 0.12, 0.35, 0, -L / 2 + 0.02, 0.35, '#2A313B'),
      box(1.8, 0.06, 0.26, 0, L / 2 - 0.2, 2.62, '#141A22'),
      ...wheels(W, 3.95),
      ...wheels(W, -2.7),
    ]),
    lights: merge([...lamps(W, L / 2 + 0.03, 0.85, HEADLIGHT), ...lamps(W, -L / 2 - 0.03, 0.9, TAILLIGHT), box(1.5, 0.08, 0.16, 0, L / 2 - 0.16, 2.67, SIGN)]),
  };
}

function tramModel(): VehicleModel {
  const W = 2.65;
  const SECTION = 10.4;
  const GAP = 0.9;
  const ys = [-(SECTION + GAP), 0, SECTION + GAP];
  const end = SECTION * 1.5 + GAP;
  return {
    body: merge(
      ys.map((y, i) =>
        hull(SECTION, W, 0.3, 3.35, WHITE, { y, front: i === 2 ? 0.7 : 0.05, rear: i === 0 ? 0.7 : 0.05, radius: 0.45 }),
      ),
    ),
    detail: merge([
      ...ys.flatMap((y) => [
        box(W - 0.3, SECTION - 1.6, 0.06, 0, y, 3.35, ROOF),
        ...[-1, 1].flatMap((side) => [
          sidePanel(W, side, SECTION - 2, 1.3, y, 1.25, GLASS),
          sidePanel(W, side, 1.3, 2.4, y + 2.6, 0.4, GLASS),
        ]),
      ]),

      ...[-1, 1].map((side) => box(W - 0.25, GAP + 0.2, 2.7, 0, side * (SECTION + GAP) / 2, 0.45, BELLOWS)),

      ...ys.map((y) => box(1.6, 3.4, 0.4, 0, y - 1.5, 3.38, GREY)),

      box(0.9, 1.2, 0.14, 0, 1.2, 3.38, '#3A414C'),
      paint(new THREE.BoxGeometry(0.1, 0.1, 1.15).rotateX(-Math.PI / 4).translate(0, 1.6, 3.92), '#3A414C'),
      box(1.5, 0.1, 0.08, 0, 2.0, 4.3, '#3A414C'),
      windscreen(W, 1, end - 0.1, 1.15, 2.0, 0.65),
      windscreen(W, -1, -end + 0.1, 1.15, 2.0, 0.65),
      box(1.7, 0.06, 0.28, 0, end - 0.55, 3.0, '#141A22'),
    ]),
    lights: merge([...lamps(W, end + 0.02, 0.8, HEADLIGHT), ...lamps(W, -end - 0.02, 0.8, TAILLIGHT), box(1.4, 0.08, 0.17, 0, end - 0.5, 3.05, SIGN)]),
  };
}

function metroModel(): VehicleModel {
  const W = 3.2;
  const CAR = 22;
  const GAP = 0.8;
  const ys = [-(CAR + GAP) / 2, (CAR + GAP) / 2];
  const end = CAR + GAP / 2;
  return {
    body: merge(ys.map((y, i) => hull(CAR, W, 0.4, 3.7, WHITE, { y, front: i === 1 ? 0.35 : 0.05, rear: i === 0 ? 0.35 : 0.05, radius: 0.5 }))),
    detail: merge([
      ...ys.flatMap((y) => [
        box(W - 0.3, CAR - 1.2, 0.06, 0, y, 3.7, ROOF),
        ...[-1, 1].flatMap((side) => [
          sidePanel(W, side, CAR - 2, 1.1, y, 1.7, GLASS),
          ...[-6.5, 0, 6.5].map((dy) => sidePanel(W, side, 1.4, 2.6, y + dy, 0.6, '#2B3542')),
        ]),
      ]),
      box(W - 0.3, GAP + 0.2, 2.9, 0, 0, 0.6, BELLOWS),
      windscreen(W, 1, end - 0.05, 1.5, 1.8, 0.3),
      windscreen(W, -1, -end + 0.05, 1.5, 1.8, 0.3),
    ]),
    lights: merge([...lamps(W, end + 0.03, 1.0, HEADLIGHT), ...lamps(W, -end - 0.03, 1.0, TAILLIGHT)]),
  };
}

function trainModel(): VehicleModel {
  const W = 3.2;
  const CAR = 18.4;
  const ys = [-19, 0, 19];
  const end = 19 + CAR / 2;
  return {
    body: merge(ys.map((y, i) => hull(CAR, W, 0.5, 4.3, WHITE, { y, front: i === 2 ? 2.2 : 0.05, rear: i === 0 ? 2.2 : 0.05, radius: 0.6 }))),
    detail: merge([
      ...ys.flatMap((y) => [
        box(W - 0.3, CAR - 1.2, 0.06, 0, y, 4.3, ROOF),
        ...[-1, 1].map((side) => sidePanel(W, side, CAR - 3, 1.2, y, 2.3, GLASS)),
      ]),
      ...[-1, 1].map((side) => box(W - 0.3, 0.8, 3.2, 0, side * 9.5, 0.7, BELLOWS)),
      windscreen(W, 1, end - 1.1, 2.3, 1.6, 1.5),
      windscreen(W, -1, -end + 1.1, 2.3, 1.6, 1.5),
    ]),
    lights: merge([...lamps(W, end + 0.02, 1.1, HEADLIGHT), ...lamps(W, -end - 0.02, 1.1, TAILLIGHT)]),
  };
}

function ferryModel(): VehicleModel {
  return {
    body: merge([box(10, 30, 2, 0, 0, 0, WHITE)]),
    detail: merge([
      box(8, 20, 3, 0, -2, 2, '#F3F5F8'),
      box(8.04, 19, 1.1, 0, -2, 3, GLASS),
      box(4, 6, 2.6, 0, 3, 5, '#F3F5F8'),
      column(0.9, 0.9, 3, 7, '#39424F', 0, -6),
    ]),
    lights: merge([box(0.5, 0.5, 0.5, 0, 15, 2, HEADLIGHT)]),
  };
}

const VEHICLE_SHAPES = { bus: busModel, tram: tramModel, metro: metroModel, train: trainModel, ferry: ferryModel };

type VehicleShape = keyof typeof VEHICLE_SHAPES;

const SHAPE_OF_MODE: Record<Mode, VehicleShape> = {
  bus: 'bus',
  tram: 'tram',
  metro: 'metro',
  train: 'train',
  ferry: 'ferry',
};

const vehicleScale = (zoom: number) => Math.min(5, Math.max(1.3, 2 ** (18.2 - zoom)));
const GLOW_RADIUS_M = 8;

const VIEW_MARGIN = 0.15;

function softDisc() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const fade = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  fade.addColorStop(0, 'rgba(255, 255, 255, 1)');
  fade.addColorStop(0.45, 'rgba(255, 255, 255, 0.55)');
  fade.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

const CONCRETE = '#E9ECEF';
const COPPER = '#5E9B86';
const BRICK = '#9E4C36';
const PLASTER = '#F4F1E8';

const LANDMARKS: { name: string; lat: number; lon: number; rotation?: number; build: () => Part }[] = [
  {
    name: 'Näsinneula',
    lat: 61.50497,
    lon: 23.74329,
    build: () =>
      merge([
        column(16, 13, 4, 0, '#C9CED4'),
        column(10, 6.5, 118, 4, CONCRETE),
        column(6.5, 18, 8, 116, CONCRETE),
        column(18, 18, 3.4, 124, GLASS),
        column(18, 17, 3, 127.4, CONCRETE),
        column(17, 17, 3, 130.4, GLASS),
        column(17, 10, 5, 133.4, CONCRETE),
        column(2.2, 0.5, 30, 138, '#E2564B', 0, 0, 10),
      ]),
  },
  {
    name: 'Helsinki Cathedral',
    lat: 60.17042,
    lon: 24.95218,
    build: () =>
      merge([
        box(62, 26, 25, 0, 0, 6, PLASTER),
        box(26, 62, 25, 0, 0, 6, PLASTER),
        box(70, 34, 6, 0, 0, 0, '#D8D3C6'),
        box(34, 70, 6, 0, 0, 0, '#D8D3C6'),
        ...[-1, 1].flatMap((side) => [
          gable(30, 28, 7, side * 16, 0, 31, '#7AA899'),
          box(24, 10, 12, 0, side * 32, 6, PLASTER),
          ...[-9, -3, 3, 9].map((x) => column(1.1, 1.1, 14, 6, PLASTER, x, side * 36, 10)),
        ]),
        column(13, 13, 15, 31, PLASTER),
        dome(14, 46, COPPER),
        column(1.8, 1.4, 6, 59, '#E3C766', 0, 0, 10),
        ...[
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].flatMap(([x, y]) => [
          column(4, 4, 8, 31, PLASTER, x * 19, y * 19),
          dome(4.4, 39, COPPER, x * 19, y * 19),
        ]),
      ]),
  },
  {
    name: 'Helsinki Central Station tower',
    lat: 60.1713,
    lon: 24.9436,
    build: () =>
      merge([
        box(13, 13, 42, 0, 0, 0, '#B8BBA8'),
        box(14, 14, 1, 0, 0, 34, '#F4EFD8'),
        box(10, 10, 5, 0, 0, 42, '#A9AC98'),
        column(4.5, 0.6, 7, 47, COPPER, 0, 0, 8),
      ]),
  },
  {
    name: 'Turku Cathedral',
    lat: 60.45245,
    lon: 22.27845,
    build: () =>
      merge([
        box(82, 32, 22, 8, 0, 0, BRICK),
        gable(82, 32, 12, 8, 0, 22, '#7C3A2C'),
        box(15, 15, 62, -40, 0, 0, BRICK),
        column(8.5, 0.5, 39, 62, '#3E5C50', -40, 0, 8),
      ]),
  },
  {
    name: 'Turku Castle',
    lat: 60.43534,
    lon: 22.22862,
    rotation: -38,
    build: () =>
      merge([
        box(118, 36, 22, 0, 0, 0, PLASTER),
        gable(118, 36, 13, 0, 0, 22, '#5B3C33'),
        box(44, 18, 34, -6, 0, 0, PLASTER),
        gable(44, 18, 10, -6, 0, 34, '#5B3C33'),
        column(9, 9, 30, 0, PLASTER, 60, 12),
        column(10, 0.5, 12, 30, '#5B3C33', 60, 12),
        column(9, 9, 30, 0, PLASTER, 60, -12),
        column(10, 0.5, 12, 30, '#5B3C33', 60, -12),
      ]),
  },
  {
    name: 'Puijo Tower',
    lat: 62.90943,
    lon: 27.6553,
    build: () =>
      merge([
        column(7, 5.5, 64, 0, CONCRETE),
        column(11, 13, 3, 62, CONCRETE),
        column(13, 13, 4, 65, GLASS),
        column(13, 9, 3, 69, CONCRETE),
        column(1.2, 0.4, 8, 72, '#E2564B', 0, 0, 8),
      ]),
  },
  {
    name: 'Oulu Cathedral',
    lat: 65.01464,
    lon: 25.47582,
    build: () =>
      merge([
        box(44, 24, 20, 6, 0, 0, '#EBD9AC'),
        gable(44, 24, 7, 6, 0, 20, '#7C8A86'),
        box(12, 12, 38, -20, 0, 0, PLASTER),
        dome(6.5, 38, COPPER, -20, 0),
        column(1.2, 0.3, 9, 44, '#E3C766', -20, 0, 8),
      ]),
  },
];

export function createModelLayer({ dark, vehicles }: ModelLayerOptions): CustomLayerInterface {
  let map: MapLibre;
  let renderer: THREE.WebGLRenderer;
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();

  const world = new THREE.Group();
  world.scale.y = -1;
  scene.add(world);

  scene.add(new THREE.HemisphereLight('#FFFFFF', '#8A93A3', dark ? 2.4 : 2.1));
  const sun = new THREE.DirectionalLight('#FFF4E0', dark ? 1.6 : 2);
  sun.position.set(0.6, -0.5, 1);
  scene.add(sun);

  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const vehicleMaterial = new THREE.MeshLambertMaterial({
    vertexColors: true,
    emissive: dark ? '#3A4254' : '#000000',
  });

  const glow = new THREE.InstancedMesh(
    new THREE.CircleGeometry(GLOW_RADIUS_M, 32),
    new THREE.MeshBasicMaterial({ map: softDisc(), transparent: true, opacity: dark ? 0.8 : 0.6, depthWrite: false }),
    MAX_INSTANCES,
  );
  glow.frustumCulled = false;
  glow.count = 0;
  glow.setColorAt(0, new THREE.Color(WHITE));

  (glow.material as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
  world.add(glow);

  const lampMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  const fleets = new Map<VehicleShape, { body: THREE.InstancedMesh; parts: THREE.InstancedMesh[] }>();
  for (const shape of Object.keys(VEHICLE_SHAPES) as VehicleShape[]) {
    const model = VEHICLE_SHAPES[shape]();
    const make = (geometry: Part, meshMaterial: THREE.Material) => {
      const mesh = new THREE.InstancedMesh(geometry, meshMaterial, MAX_INSTANCES);
      mesh.frustumCulled = false;
      mesh.count = 0;
      world.add(mesh);
      return mesh;
    };
    const body = make(model.body, vehicleMaterial);
    body.setColorAt(0, new THREE.Color(WHITE));
    fleets.set(shape, { body, parts: [make(model.detail, material), make(model.lights, lampMaterial)] });
  }

  const landmarks = LANDMARKS.map((landmark) => {
    const mesh = new THREE.Mesh(landmark.build(), material);
    mesh.frustumCulled = false;
    mesh.rotation.z = THREE.MathUtils.degToRad(landmark.rotation ?? 0);
    world.add(mesh);
    return { ...landmark, mesh, mercator: MercatorCoordinate.fromLngLat([landmark.lon, landmark.lat]) };
  });

  const tint = new THREE.Color();
  const instance = new THREE.Object3D();
  const modeColors = Object.fromEntries(
    Object.entries(MODE_COLORS).map(([mode, color]) => [mode, new THREE.Color(color)]),
  ) as Record<Mode, THREE.Color>;

  return {
    id: MODEL_LAYER_ID,
    type: 'custom',
    renderingMode: '3d',
    onAdd(target, gl) {
      map = target;
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },
    onRemove() {
      for (const { body, parts } of fleets.values()) for (const mesh of [body, ...parts]) mesh.geometry.dispose();
      lampMaterial.dispose();
      for (const { mesh } of landmarks) mesh.geometry.dispose();
      glow.geometry.dispose();
      vehicleMaterial.dispose();
      material.dispose();
      renderer.dispose();
    },
    render(_gl, options) {
      const center = map.getCenter();
      const origin = MercatorCoordinate.fromLngLat(center);
      const metre = origin.meterInMercatorCoordinateUnits();
      const zoom = map.getZoom();
      const toLocal = (x: number, y: number): [number, number] => [(x - origin.x) / metre, (origin.y - y) / metre];

      const projection = new THREE.Matrix4().fromArray(options.defaultProjectionData.mainMatrix as unknown as number[]);
      camera.projectionMatrix = projection
        .multiply(new THREE.Matrix4().makeTranslation(origin.x, origin.y, 0))
        .multiply(new THREE.Matrix4().makeScale(metre, metre, metre));

      for (const landmark of landmarks) {
        const [x, y] = toLocal(landmark.mercator.x, landmark.mercator.y);
        landmark.mesh.visible = zoom >= MIN_LANDMARK_ZOOM && Math.hypot(x, y) < LANDMARK_RANGE_M;
        landmark.mesh.position.set(x, y, 0);
      }

      const counts = new Map<VehicleShape, number>();
      let glowing = 0;
      if (zoom >= MIN_VEHICLE_ZOOM) {
        const scale = vehicleScale(zoom);
        const bounds = map.getBounds();
        const padLat = (bounds.getNorth() - bounds.getSouth()) * VIEW_MARGIN;
        const padLon = (bounds.getEast() - bounds.getWest()) * VIEW_MARGIN;
        for (const vehicle of vehicles()) {
          if (
            vehicle.lat < bounds.getSouth() - padLat ||
            vehicle.lat > bounds.getNorth() + padLat ||
            vehicle.lon < bounds.getWest() - padLon ||
            vehicle.lon > bounds.getEast() + padLon
          ) {
            continue;
          }
          const shape = SHAPE_OF_MODE[vehicle.mode];
          const fleet = fleets.get(shape)!;
          const index = counts.get(shape) ?? 0;
          if (index >= MAX_INSTANCES) continue;
          const point = MercatorCoordinate.fromLngLat([vehicle.lon, vehicle.lat]);
          const [x, y] = toLocal(point.x, point.y);
          instance.position.set(x, y, 0);
          instance.rotation.set(0, 0, THREE.MathUtils.degToRad(-vehicle.bearing));
          instance.scale.setScalar(scale);
          instance.updateMatrix();
          fleet.body.setMatrixAt(index, instance.matrix);
          for (const part of fleet.parts) part.setMatrixAt(index, instance.matrix);
          fleet.body.setColorAt(index, tint.copy(modeColors[vehicle.mode]));
          counts.set(shape, index + 1);
          if (glowing < MAX_INSTANCES) {
            instance.position.z = 0.4;
            instance.updateMatrix();
            glow.setMatrixAt(glowing, instance.matrix);
            glow.setColorAt(glowing, tint);
            glowing++;
          }
        }
      }
      for (const [shape, { body, parts }] of fleets) {
        const count = counts.get(shape) ?? 0;
        for (const mesh of [body, ...parts]) {
          mesh.count = count;
          mesh.instanceMatrix.needsUpdate = true;
        }
        if (body.instanceColor) body.instanceColor.needsUpdate = true;
      }

      glow.count = glowing;
      glow.instanceMatrix.needsUpdate = true;
      if (glow.instanceColor) glow.instanceColor.needsUpdate = true;

      renderer.resetState();
      renderer.render(scene, camera);

      renderer.resetState();
    },
  };
}
