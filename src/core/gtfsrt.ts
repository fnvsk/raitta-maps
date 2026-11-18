const WIRE_VARINT = 0;
const WIRE_64 = 1;
const WIRE_BYTES = 2;
const WIRE_32 = 5;

class Reader {
  private pos: number;
  private readonly view: DataView;

  constructor(
    private readonly bytes: Uint8Array,
    start = 0,
    private readonly end = bytes.length,
  ) {
    this.pos = start;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get done() {
    return this.pos >= this.end;
  }

  varint() {
    let result = 0;
    let scale = 1;
    for (;;) {
      if (this.pos >= this.end) throw new RangeError('Truncated varint');
      const byte = this.bytes[this.pos++];
      result += (byte & 0x7f) * scale;
      if (byte < 0x80) return result;
      scale *= 128;
    }
  }

  float() {
    const value = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return value;
  }

  message() {
    const length = this.varint();
    const start = this.pos;
    this.pos += length;
    return new Reader(this.bytes, start, this.pos);
  }

  skip(wire: number) {
    if (wire === WIRE_VARINT) this.varint();
    else if (wire === WIRE_64) this.pos += 8;
    else if (wire === WIRE_BYTES) {
      const length = this.varint();
      this.pos += length;
    } else if (wire === WIRE_32) this.pos += 4;
    else throw new RangeError(`Unknown wire type ${wire}`);
  }

  fields(handle: (field: number, wire: number) => boolean) {
    while (!this.done) {
      const tag = this.varint();
      const wire = tag % 8;
      if (!handle(Math.floor(tag / 8), wire)) this.skip(wire);
    }
  }
}

export interface DecodedPosition {
  lat: number;
  lon: number;

  bearing: number;

  speed: number;
}

function readPosition(reader: Reader): DecodedPosition | null {
  const position: DecodedPosition = { lat: NaN, lon: NaN, bearing: NaN, speed: 0 };
  reader.fields((field, wire) => {
    if (wire !== WIRE_32) return false;
    if (field === 1) position.lat = reader.float();
    else if (field === 2) position.lon = reader.float();
    else if (field === 3) position.bearing = reader.float();
    else if (field === 5) position.speed = reader.float();
    else return false;
    return true;
  });
  return Number.isNaN(position.lat) || Number.isNaN(position.lon) ? null : position;
}

function nested<T>(reader: Reader, field: number, read: (inner: Reader) => T | null): T | null {
  let found: T | null = null;
  reader.fields((f, wire) => {
    if (f !== field || wire !== WIRE_BYTES || found !== null) return false;
    found = read(reader.message());
    return true;
  });
  return found;
}

export function decodeVehiclePosition(bytes: Uint8Array): DecodedPosition | null {
  try {
    return nested(new Reader(bytes), 2, (entity) =>
      nested(entity, 4, (vehicle) => nested(vehicle, 2, readPosition)),
    );
  } catch {
    return null;
  }
}
