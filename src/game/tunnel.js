import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { SEG, TUNNEL_LEN, WALL } from './constants.js'

const vertexShader = /* glsl */ `
precision highp float;
out vec3 vWorld;
void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorld = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`

const fragmentShader = /* glsl */ `
precision highp float;
in vec3 vWorld;
uniform vec3 uColor;
uniform vec3 uPulsePos;
uniform float uPulseRadius;
uniform float uPulseAmt;
uniform vec3 uPulsePos2;
uniform float uPulseRadius2;
uniform float uPulseAmt2;
uniform float uPlayerZ;
uniform vec3 uGravity;
uniform float uTime;
uniform float uGain;
out vec4 fragColor;

float ring(vec3 origin, float radius, float amt) {
  float d = distance(vWorld, origin);
  return exp(-pow((d - radius) * 0.45, 2.0)) * amt;
}

void main() {
  float ahead = vWorld.z - uPlayerZ;
  float fade = (1.0 - smoothstep(16.0, 120.0, ahead)) * smoothstep(-28.0, 2.0, ahead);
  float len = length(vWorld.xy);
  float floorBoost = 0.0;
  if (len > 0.001) {
    floorBoost = smoothstep(0.45, 0.98, dot(vWorld.xy / len, uGravity.xy));
  }
  float glow = ring(uPulsePos, uPulseRadius, uPulseAmt)
    + ring(uPulsePos2, uPulseRadius2, uPulseAmt2);
  float scan = 0.05 * sin(vWorld.z * 0.42 - uTime * 2.4);
  float intensity = (0.2 + floorBoost * 0.72 + glow * 3.1 + scan) * fade;
  vec3 col = uColor * intensity * uGain;
  col += vec3(0.55, 0.2, 1.0) * glow * fade;
  fragColor = vec4(col, 1.0);
}
`

export function createTunnelMaterial(color, gain) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    toneMapped: false,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uPulsePos: { value: new THREE.Vector3() },
      uPulseRadius: { value: 0 },
      uPulseAmt: { value: 0 },
      uPulsePos2: { value: new THREE.Vector3() },
      uPulseRadius2: { value: 0 },
      uPulseAmt2: { value: 0 },
      uPlayerZ: { value: 0 },
      uGravity: { value: new THREE.Vector3(0, -1, 0) },
      uTime: { value: 0 },
      uGain: { value: gain },
    },
    vertexShader,
    fragmentShader,
  })
}

function box(w, h, d, x, y, z) {
  const geometry = new THREE.BoxGeometry(w, h, d)
  geometry.translate(x, y, z)
  return geometry
}

export function buildTunnelGeometry() {
  const rails = []
  const rings = []
  const t = 0.055
  const s = WALL
  const zStart = -32
  const zEnd = TUNNEL_LEN
  const length = zEnd - zStart
  const zMid = (zStart + zEnd) * 0.5
  const add = (list, w, h, d, x, y, z) => {
    list.push(box(w, h, d, x, y, z))
  }

  add(rails, t, t, length, -s, -s, zMid)
  add(rails, t, t, length, s, -s, zMid)
  add(rails, t, t, length, s, s, zMid)
  add(rails, t, t, length, -s, s, zMid)

  const inset = 0.02
  const c = t * 0.62
  add(rails, c, c, length, 0, -s + inset, zMid)
  add(rails, c, c, length, 0, s - inset, zMid)
  add(rails, c, c, length, s - inset, 0, zMid)
  add(rails, c, c, length, -s + inset, 0, zMid)

  for (let z = zStart; z <= zEnd; z += SEG) {
    add(rings, s * 2, t, t, 0, -s, z)
    add(rings, s * 2, t, t, 0, s, z)
    add(rings, t, s * 2, t, -s, 0, z)
    add(rings, t, s * 2, t, s, 0, z)
  }

  const railGeo = mergeGeometries(rails)
  const ringGeo = mergeGeometries(rings)
  rails.forEach((geometry) => geometry.dispose())
  rings.forEach((geometry) => geometry.dispose())
  return { railGeo, ringGeo }
}

export function syncTunnel(material, pulses, playerZ, gravity, time) {
  const uniforms = material.uniforms
  const newest = pulses[pulses.length - 1]
  const previous = pulses[pulses.length - 2]
  if (newest) {
    uniforms.uPulsePos.value.copy(newest.pos)
    uniforms.uPulseRadius.value = newest.radius
    uniforms.uPulseAmt.value = Math.max(0, 1 - newest.age / 1.15)
  } else {
    uniforms.uPulseAmt.value = 0
  }
  if (previous) {
    uniforms.uPulsePos2.value.copy(previous.pos)
    uniforms.uPulseRadius2.value = previous.radius
    uniforms.uPulseAmt2.value = Math.max(0, 1 - previous.age / 1.15)
  } else {
    uniforms.uPulseAmt2.value = 0
  }
  uniforms.uPlayerZ.value = playerZ
  uniforms.uGravity.value.copy(gravity)
  uniforms.uTime.value = time
}
