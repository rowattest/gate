// RFC 8785, the JSON Canonicalization Scheme (JCS), ported from the engine's
// src/jcs.ts (AP-1a, X4) so the app can verify a signature without depending on
// rowattest-engine. Object members sorted by UTF-16 code unit, no insignificant
// whitespace, ECMAScript number serialization and JSON string escaping. A
// direct recursive emitter: JSON.stringify would put integer-like keys first
// ("2" before "10"), which the RFC's code-unit ordering does not ("10" before
// "2"). Strings and finite numbers go through JSON.stringify, whose output the
// RFC adopts. worker/test/jcs-parity.test.ts checks these bytes against the
// engine's own.

export function canonicalize(value: unknown): string {
  return emit(value);
}

function emit(value: unknown): string {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "boolean") return value ? "true" : "false";
  if (t === "number") {
    if (!Number.isFinite(value as number)) {
      throw new Error("JCS: NaN and Infinity are not valid JSON numbers");
    }
    // RFC 8785 §3.2.2.3: the ECMAScript Number-to-String algorithm (-0 -> "0").
    return JSON.stringify(value);
  }
  if (t === "string") {
    // RFC 8785 §3.2.2.2 adopts the ECMAScript JSON string production verbatim.
    return JSON.stringify(value);
  }
  if (t === "bigint") {
    throw new Error("JCS: bigint is not a JSON value");
  }
  if (Array.isArray(value)) {
    // JSON.stringify renders an undefined element as null, so match that.
    return "[" + value.map((v) => emit(v === undefined ? null : v)).join(",") + "]";
  }
  if (t === "object") {
    const obj = value as Record<string, unknown>;
    // Undefined-valued members are dropped (as JSON.stringify does); the rest
    // are sorted by UTF-16 code unit, what the JS `<` operator compares.
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort(compareCodeUnits);
    let out = "{";
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i] as string;
      if (i > 0) out += ",";
      out += JSON.stringify(k) + ":" + emit(obj[k]);
    }
    return out + "}";
  }
  throw new Error(`JCS: unsupported value of type ${t}`);
}

function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
