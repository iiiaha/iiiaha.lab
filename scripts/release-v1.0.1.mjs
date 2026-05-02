// One-off: 5개 익스텐션 v1.0.1 일괄 배포.
// 실행: node --env-file=.env.local scripts/release-v1.0.1.mjs

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const BASE = "C:/Users/LEE/Desktop/extensions";
const RELEASED_AT = "2026-05-02T00:00:00+09:00";

const releases = [
  { slug: "circuitee", dir: "circuitee" },
  { slug: "cliptomat", dir: "cliptomat" },
  { slug: "humanscale", dir: "humanscale" },
  { slug: "junggenerator", dir: "junggenerator" },
  { slug: "sufx", dir: "SUFX" },
];

function extractV101(text) {
  const m = text.match(/##\s+v1\.0\.1\b[^\n]*\n([\s\S]*?)(?:\n##\s|$)/);
  return m ? m[1].trim() : null;
}

let ok = 0;
let fail = 0;

for (const r of releases) {
  console.log(`\n=== ${r.slug} ===`);
  try {
    const rbzPath = `${BASE}/${r.dir}/iiiaha_${r.slug}_v1.0.1_c.rbz`;
    const clogPath = `${BASE}/${r.dir}/CHANGELOG.md`;
    const fileKey = `rbz/${r.slug}_v1.0.1.rbz`;

    const { data: product, error: pErr } = await sb
      .from("products")
      .select("id")
      .eq("slug", r.slug)
      .single();
    if (pErr || !product) throw new Error(`product not found: ${pErr?.message}`);

    const clogText = await readFile(clogPath, "utf8");
    const changelog = extractV101(clogText);
    if (!changelog) throw new Error("could not extract v1.0.1 from CHANGELOG.md");
    console.log(`  changelog: "${changelog.split("\n")[0].slice(0, 70)}..."`);

    const buf = await readFile(rbzPath);
    const { error: upErr } = await sb.storage
      .from("uploads")
      .upload(fileKey, buf, { upsert: true, contentType: "application/octet-stream" });
    if (upErr) throw new Error(`upload: ${upErr.message}`);
    console.log(`  uploaded ${fileKey} (${buf.length.toLocaleString()} bytes)`);

    const { error: insErr } = await sb
      .from("product_versions")
      .insert({
        product_id: product.id,
        version: "1.0.1",
        file_key: fileKey,
        changelog,
        released_at: RELEASED_AT,
      });
    if (insErr) throw new Error(`insert: ${insErr.message}`);
    console.log("  product_versions row inserted");

    const { error: updErr } = await sb
      .from("products")
      .update({ version: "1.0.1", file_key: fileKey })
      .eq("id", product.id);
    if (updErr) throw new Error(`update: ${updErr.message}`);
    console.log("  products row updated → version=1.0.1");

    ok++;
  } catch (e) {
    console.error(`  FAILED: ${e.message}`);
    fail++;
  }
}

console.log(`\n=== Summary ===\nOK:   ${ok}\nFail: ${fail}`);
