import { Fragment, type ReactNode } from "react";

// Tiny, safe Markdown subset for coach replies: paragraphs, "- " / "1. " lists,
// **bold** and _italic_. Builds React nodes, never raw HTML.
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|_[^_]+_|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<strong key={k++}>{tok.slice(2, -2)}</strong>);
    else out.push(<em key={k++}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function RichText({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <div className="space-y-2 leading-relaxed">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim());
        const bullet = lines.length > 0 && lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l));
        if (bullet) {
          const ordered = /^\s*\d/.test(lines[0]);
          const items = lines.map((l) => l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
          const List = ordered ? "ol" : "ul";
          return (
            <List key={i} className={ordered ? "list-decimal space-y-1 pl-5" : "list-disc space-y-1 pl-5"}>
              {items.map((it, j) => (
                <li key={j}>{inline(it)}</li>
              ))}
            </List>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l.replace(/^#+\s*/, ""))}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
