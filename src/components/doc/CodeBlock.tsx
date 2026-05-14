"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CodeBlock({
  code,
  lang = "ts",
  filename,
  className,
}: {
  code: string;
  lang?: string;
  filename?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const trimmed = code.replace(/^\n/, "").replace(/\n$/, "");

  return (
    <div className={cn("group my-5 overflow-hidden rounded-xl border border-border bg-[var(--code-bg)]", className)}>
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-rose/70" />
          <span className="inline-block h-2 w-2 rounded-full bg-amber/70" />
          <span className="inline-block h-2 w-2 rounded-full bg-emerald/70" />
          {filename && (
            <span className="ml-3 font-mono text-muted-foreground">{filename}</span>
          )}
          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
            {lang}
          </span>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(trimmed);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex items-center gap-1 rounded px-2 py-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="scrollbar-thin overflow-x-auto p-4 text-[13px] leading-[1.65]">
        <code className="font-mono">{highlight(trimmed)}</code>
      </pre>
    </div>
  );
}

// Lightweight TS-ish syntax highlighter (no shiki dep needed for SSR/Worker).
function highlight(code: string) {
  const tokens: { type: string; value: string }[] = [];
  const patterns: { type: string; re: RegExp }[] = [
    { type: "comment", re: /^\/\/[^\n]*|^\/\*[\s\S]*?\*\//y },
    { type: "string", re: /^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/y },
    { type: "keyword", re: /^\b(?:const|let|var|function|return|if|else|for|while|switch|case|break|continue|new|class|extends|implements|interface|type|enum|import|from|export|default|async|await|try|catch|finally|throw|of|in|as|public|private|protected|readonly|static|yield)\b/y },
    { type: "boolean", re: /^\b(?:true|false|null|undefined|this|super)\b/y },
    { type: "number", re: /^\b\d+(?:\.\d+)?\b/y },
    { type: "fn", re: /^[a-zA-Z_$][\w$]*(?=\()/y },
    { type: "ident", re: /^[a-zA-Z_$][\w$]*/y },
    { type: "punct", re: /^[{}()[\];,.:]/y },
    { type: "op", re: /^[=+\-*/<>!&|?%^~]+/y },
    { type: "ws", re: /^\s+/y },
    { type: "any", re: /^./y },
  ];

  let i = 0;
  while (i < code.length) {
    let matched = false;
    for (const p of patterns) {
      p.re.lastIndex = 0;
      const m = p.re.exec(code.slice(i));
      if (m && m[0]) {
        tokens.push({ type: p.type, value: m[0] });
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      tokens.push({ type: "any", value: code[i] });
      i++;
    }
  }

  const colorOf: Record<string, string> = {
    comment: "text-muted-foreground/70 italic",
    string: "text-emerald",
    keyword: "text-[oklch(0.78_0.16_300)]",
    boolean: "text-amber",
    number: "text-amber",
    fn: "text-teal",
    ident: "text-foreground/85",
    punct: "text-muted-foreground",
    op: "text-indigo-soft",
    ws: "",
    any: "",
  };

  return tokens.map((t, idx) =>
    t.type === "ws" || t.type === "any" ? (
      <span key={idx}>{t.value}</span>
    ) : (
      <span key={idx} className={colorOf[t.type]}>
        {t.value}
      </span>
    )
  );
}
