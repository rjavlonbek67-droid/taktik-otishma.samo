import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function crc32(buffer) {
  let crc = ~0
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i]
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return ~crc >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const name = Buffer.from(type)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, crc])
}

function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  const center = (size - 1) / 2
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1)
    raw[row] = 0
    for (let x = 0; x < size; x += 1) {
      const dx = (x - center) / (size * 0.5)
      const dy = (y - center) / (size * 0.5)
      const radius = Math.hypot(dx, dy)
      const ring = Math.exp(-(((radius - 0.58) * 9) ** 2))
      const core = Math.exp(-((radius * 3.4) ** 2))
      const glow = Math.exp(-((radius * 1.7) ** 2)) * 0.28
      const red = Math.min(255, core * 255 + ring * 30 + glow * 10)
      const green = Math.min(255, core * 70 + ring * 230 + glow * 70)
      const blue = Math.min(255, core * 230 + ring * 255 + glow * 140)
      const offset = row + 1 + x * 4
      raw[offset] = red
      raw[offset + 1] = green
      raw[offset + 2] = blue
      raw[offset + 3] = 255
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    signature,
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const dir = path.join(root, 'public')
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, 'icon-180.png'), png(180))
fs.writeFileSync(path.join(dir, 'icon-192.png'), png(192))
fs.writeFileSync(path.join(dir, 'icon-512.png'), png(512))
