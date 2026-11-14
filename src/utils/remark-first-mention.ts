/**
 * Content-loop device D: link the first mention of a known target (a
 * jurisdiction with its own fee page, or the Fee Index) in a page's body
 * text. One link per target per page; never inside an existing link, a
 * heading, or code. No hand-written list — targets are passed in from
 * fees.json by astro.config.ts.
 *
 * Pure remark plugin: no new dependency, own code only.
 */

type Target = { name: string; href: string };

type Options = { targets: Target[] };

const SKIP_TYPES = new Set([
  "link",
  "linkReference",
  "code",
  "inlineCode",
  "heading",
  "html",
  "table",
]);

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function remarkFirstMention(options: Options) {
  const byName = new Map<string, string>();
  for (const t of options.targets) {
    if (!byName.has(t.name)) byName.set(t.name, t.href);
  }
  // Longest first, so "Los Angeles County" wins over "Los Angeles" at the
  // same position. The lookarounds keep matches to whole words.
  const names = [...byName.keys()].sort((a, b) => b.length - a.length);
  if (names.length === 0) return () => {};
  const pattern = new RegExp(
    `(?<![A-Za-z0-9])(${names.map(escapeRegExp).join("|")})(?![A-Za-z0-9])`,
    "g"
  );

  return (tree: any) => {
    const seen = new Set<string>();

    function splitText(value: string): any[] {
      const out: any[] = [];
      let last = 0;
      pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(value)) !== null) {
        const name = m[1];
        const href = byName.get(name)!;
        if (m.index > last)
          out.push({ type: "text", value: value.slice(last, m.index) });
        if (!seen.has(name)) {
          seen.add(name);
          out.push({
            type: "link",
            url: href,
            children: [{ type: "text", value: name }],
          });
        } else {
          out.push({ type: "text", value: name });
        }
        last = m.index + name.length;
      }
      if (last < value.length)
        out.push({ type: "text", value: value.slice(last) });
      return out;
    }

    function walk(node: any) {
      if (!node || typeof node !== "object") return;
      if (SKIP_TYPES.has(node.type)) return;
      if (Array.isArray(node.children)) {
        const next: any[] = [];
        for (const child of node.children) {
          if (child.type === "text") {
            next.push(...splitText(child.value));
          } else {
            walk(child);
            next.push(child);
          }
        }
        node.children = next;
      }
    }

    walk(tree);
  };
}
