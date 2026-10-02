// Minimal column-major 4x4 matrix helpers.

export function mat4() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; }

export function identity(m) { m.fill(0); m[0] = m[5] = m[10] = m[15] = 1; return m; }

export function perspective(out, fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  out.fill(0);
  out[0] = f / aspect; out[5] = f;
  out[10] = (far + near) * nf; out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

export function multiply(out, a, b) {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  for (let i = 0; i < 4; i++) {
    const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
    out[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  }
  return out;
}

export function translate(m, x, y, z) {
  m[12] += m[0] * x + m[4] * y + m[8] * z;
  m[13] += m[1] * x + m[5] * y + m[9] * z;
  m[14] += m[2] * x + m[6] * y + m[10] * z;
  m[15] += m[3] * x + m[7] * y + m[11] * z;
  return m;
}

export function scale(m, x, y, z) {
  for (let i = 0; i < 4; i++) { m[i] *= x; m[4 + i] *= y; m[8 + i] *= z; }
  return m;
}

export function rotateX(m, r) {
  const s = Math.sin(r), c = Math.cos(r);
  for (let i = 0; i < 4; i++) {
    const a = m[4 + i], b = m[8 + i];
    m[4 + i] = a * c + b * s;
    m[8 + i] = b * c - a * s;
  }
  return m;
}

export function rotateY(m, r) {
  const s = Math.sin(r), c = Math.cos(r);
  for (let i = 0; i < 4; i++) {
    const a = m[i], b = m[8 + i];
    m[i] = a * c - b * s;
    m[8 + i] = a * s + b * c;
  }
  return m;
}

export function rotateZ(m, r) {
  const s = Math.sin(r), c = Math.cos(r);
  for (let i = 0; i < 4; i++) {
    const a = m[i], b = m[4 + i];
    m[i] = a * c + b * s;
    m[4 + i] = b * c - a * s;
  }
  return m;
}

export function copy(out, a) { out.set(a); return out; }

export function transformPoint(m, x, y, z, out, o) {
  out[o] = m[0] * x + m[4] * y + m[8] * z + m[12];
  out[o + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
  out[o + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
}

// Frustum planes (a,b,c,d) x6 from a view-projection matrix.
export function frustum(m, out = new Float32Array(24)) {
  const p = (i, a, b, c, d) => {
    const l = Math.hypot(a, b, c);
    out[i] = a / l; out[i + 1] = b / l; out[i + 2] = c / l; out[i + 3] = d / l;
  };
  p(0, m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]);
  p(4, m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]);
  p(8, m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]);
  p(12, m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]);
  p(16, m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]);
  p(20, m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]);
  return out;
}

export function boxInFrustum(f, x0, y0, z0, x1, y1, z1) {
  for (let i = 0; i < 24; i += 4) {
    const a = f[i], b = f[i + 1], c = f[i + 2], d = f[i + 3];
    const x = a > 0 ? x1 : x0, y = b > 0 ? y1 : y0, z = c > 0 ? z1 : z0;
    if (a * x + b * y + c * z + d < 0) return false;
  }
  return true;
}
