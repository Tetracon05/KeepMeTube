import React from "react";

/**
 * Renders a small subset of Markdown as JSX: `## `/`### ` headings, `**bold**`,
 * `` `inline code` ``, `- ` list items, and blank-line-separated paragraphs.
 * Not a general CommonMark parser — just enough for GitHub-style release
 * notes (see .github/workflows/build.yml's releaseBody), which is the only
 * place this app ever needs to show Markdown.
 */
export function renderMarkdown(text: string): React.ReactNode {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];
  let paragraphLines: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`}>
        {listItems.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push(<p key={`p-${blocks.length}`}>{renderInline(paragraphLines.join(" "))}</p>);
    paragraphLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const heading = /^(#{2,4})\s+(.*)$/.exec(line);
    const listItem = /^[-*]\s+(.*)$/.exec(line);

    if (heading) {
      flushList();
      flushParagraph();
      const level = heading[1].length;
      const HeadingTag = (level >= 4 ? "h5" : level === 3 ? "h5" : "h4") as "h4" | "h5";
      blocks.push(<HeadingTag key={`h-${blocks.length}`}>{renderInline(heading[2])}</HeadingTag>);
    } else if (listItem) {
      flushParagraph();
      listItems.push(listItem[1]);
    } else if (line === "") {
      flushList();
      flushParagraph();
    } else {
      flushList();
      paragraphLines.push(line);
    }
  }
  flushList();
  flushParagraph();

  return <>{blocks}</>;
}

/** Applies inline `**bold**` and `` `code` `` formatting within a single line. */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter((p) => p !== "");
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}
