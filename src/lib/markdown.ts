import React from "react";

// 인라인 마크다운만 처리: **bold**, *italic*
// 안전한 접근: HTML 문자열을 만들지 않고 React 노드 배열을 반환.
export function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end > i + 2) {
        out.push(React.createElement("strong", { key: key++ }, text.slice(i + 2, end)));
        i = end + 2;
        continue;
      }
    }
    if (text[i] === "*" && text[i + 1] !== "*") {
      const end = text.indexOf("*", i + 1);
      if (end > i + 1) {
        out.push(React.createElement("em", { key: key++ }, text.slice(i + 1, end)));
        i = end + 1;
        continue;
      }
    }
    // 일반 텍스트 — 다음 마커까지 한 번에 push
    let next = text.indexOf("*", i);
    if (next < 0) next = text.length;
    if (next === i) next = i + 1; // 안전장치 (매칭 안 되는 단독 *)
    out.push(text.slice(i, next));
    i = next;
  }
  return out;
}
