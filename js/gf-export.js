/* ============================================================================
 * 国风古建像素工坊 · 导出（PNG / ZIP）
 * 自带 PNG 编码（stored deflate）与最小 ZIP 打包，Node 与浏览器通用
 * ==========================================================================*/
(function (global) {
  'use strict';
  const GF = (global.GF = global.GF || {});

  const CRC_TABLE = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  GF.crc32 = crc32;

  function adler32(bytes) {
    let a = 1, b = 0;
    for (let i = 0; i < bytes.length; i++) {
      a = (a + bytes[i]) % 65521;
      b = (b + a) % 65521;
    }
    return ((b << 16) | a) >>> 0;
  }

  function u32(n) { return [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255]; }
  // PNG / zlib 中的长度、CRC、adler 均为大端
  function be32(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }

  /** RGBA 像素 → PNG 字节（无压缩存储块，纯 JS，无需 zlib） */
  GF.encodePNG = function (w, h, rgba) {
    // 原始扫描线：每行 filter=0
    const stride = w * 4 + 1;
    const raw = new Uint8Array(stride * h);
    for (let y = 0; y < h; y++) {
      raw[y * stride] = 0;
      for (let x = 0; x < w * 4; x++) raw[y * stride + 1 + x] = rgba[y * w * 4 + x];
    }

    // zlib: header + stored deflate blocks + adler
    const parts = [new Uint8Array([0x78, 0x01])];
    const maxBlock = 65535;
    for (let off = 0; off < raw.length; off += maxBlock) {
      const len = Math.min(maxBlock, raw.length - off);
      const header = new Uint8Array(5);
      header[0] = off + len >= raw.length ? 1 : 0; // BFINAL
      header[1] = len & 255;
      header[2] = (len >> 8) & 255;
      header[3] = (~len) & 255;
      header[4] = ((~len) >> 8) & 255;
      parts.push(header);
      parts.push(raw.subarray(off, off + len));
    }
    const ad = be32(adler32(raw));
    parts.push(new Uint8Array(ad));
    const zlib = concat(parts);

    const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const chunk = (type, data) => {
      const out = new Uint8Array(12 + data.length);
      const t = new Uint8Array([...type].map((c) => c.charCodeAt(0)));
      out.set(new Uint8Array(be32(data.length)), 0);
      out.set(t, 4);
      out.set(data, 8);
      out.set(new Uint8Array(be32(crc32(out.subarray(4, 8 + data.length)))), 8 + data.length);
      return out;
    };
    const ihdr = new Uint8Array([
      ...be32(w), ...be32(h),
      8, 6, 0, 0, 0 // 8bit RGBA
    ]);
    return concat([
      sig,
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib),
      chunk('IEND', new Uint8Array(0))
    ]);
  };

  function concat(arrs) {
    let total = 0;
    arrs.forEach((a) => (total += a.length));
    const out = new Uint8Array(total);
    let off = 0;
    arrs.forEach((a) => { out.set(a, off); off += a.length; });
    return out;
  }
  GF.concatBytes = concat;

  /* ------------------------------ ZIP ------------------------------ */
  function dosTime(d) {
    d = d || new Date();
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2));
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return [time, date];
  }

  GF.makeZip = function (files) {
    // files: [{name, data:Uint8Array}]
    const [time, date] = dosTime();
    const locals = [];
    const centrals = [];
    let offset = 0;
    files.forEach((f) => {
      const nameBytes = new Uint8Array([...Buffer_or_chars(f.name)]);
      const crc = crc32(f.data);
      const local = concat([
        new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...u16(20), ...u16(0), ...u16(0), ...u16(time), ...u16(date),
          ...u32(crc), ...u32(f.data.length), ...u32(f.data.length), ...u16(nameBytes.length), ...u16(0)]),
        nameBytes,
        f.data
      ]);
      locals.push(local);
      const central = concat([
        new Uint8Array([0x50, 0x4b, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(time), ...u16(date),
          ...u32(crc), ...u32(f.data.length), ...u32(f.data.length),
          ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]),
        nameBytes
      ]);
      centrals.push(central);
      offset += local.length;
    });
    const cd = concat(centrals);
    const eocd = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0),
      ...u16(files.length), ...u16(files.length), ...u32(cd.length), ...u32(offset), ...u16(0)]);
    return concat([...locals, cd, eocd]);
  };

  function u16(n) { return [n & 255, (n >> 8) & 255]; }
  function Buffer_or_chars(s) {
    const out = [];
    for (const ch of s) {
      const code = ch.codePointAt(0);
      if (code < 128) out.push(code);
      else {
        // UTF-8 编码
        const bytes = unescape(encodeURIComponent(ch)).split('').map((c) => c.charCodeAt(0));
        out.push(...bytes);
      }
    }
    return out;
  }

  /* --------------------------- 导出为 DataURL --------------------------- */
  GF.toDataURL = function (frame) {
    if (typeof document === 'undefined') return null;
    const cv = document.createElement('canvas');
    cv.width = frame.w; cv.height = frame.h;
    const ctx = cv.getContext('2d');
    ctx.putImageData(new ImageData(new Uint8ClampedArray(frame.rgba), frame.w, frame.h), 0, 0);
    return cv.toDataURL('image/png');
  };
})(typeof window !== 'undefined' ? window : globalThis);
