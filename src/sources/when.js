function resolvePath(path, data) {
  // path like "$.a.b[0].c"
  const body = path.replace(/^\$\.?/, '');
  if (body === '') return data;
  const tokens = body.match(/[^.[\]]+/g) ?? [];
  let cur = data;
  for (const tok of tokens) {
    if (cur == null) return undefined;
    const key = /^\d+$/.test(tok) ? Number(tok) : tok;
    cur = cur[key];
  }
  return cur;
}

function parseLiteral(raw) {
  const s = raw.trim();
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  const m = s.match(/^["'](.*)["']$/);
  if (m) return m[1];
  return s;
}

const OPS = {
  '>=': (a, b) => a >= b,
  '<=': (a, b) => a <= b,
  '==': (a, b) => a === b,
  '!=': (a, b) => a !== b,
  '>': (a, b) => a > b,
  '<': (a, b) => a < b,
};

export function evaluateWhen(expr, data) {
  const m = expr.trim().match(/^(\$[^<>=!]*?)\s*(>=|<=|==|!=|>|<)\s*(.+)$/);
  if (!m) {
    return Boolean(resolvePath(expr.trim(), data));
  }
  const [, lhs, op, rhsRaw] = m;
  const left = resolvePath(lhs.trim(), data);
  const right = parseLiteral(rhsRaw);
  return OPS[op](left, right);
}
