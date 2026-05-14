import katex from "katex";

export function Math({ tex, block = false }: { tex: string; block?: boolean }) {
  const html = katex.renderToString(tex, { throwOnError: false, displayMode: block });
  return block ? (
    <div className="my-4 overflow-x-auto rounded-lg border border-border bg-surface/40 px-4 py-3" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span dangerouslySetInnerHTML={{ __html: html }} />
  );
}
