import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAdmin() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return data ? user : null;
}

// products.version + products.file_key are kept as a "latest cache" so the
// public download path and mypage version-diff logic don't have to change.
// Recompute it from product_versions ordered by released_at desc.
async function syncProductLatest(productId: string) {
  const { data: latest } = await serviceSupabase
    .from("product_versions")
    .select("version, file_key")
    .eq("product_id", productId)
    .order("released_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  await serviceSupabase
    .from("products")
    .update({
      version: latest?.version ?? null,
      file_key: latest?.file_key ?? null,
    })
    .eq("id", productId);
}

// POST: create a new version row.
// Expects { product_id, version, file_key?, changelog?, released_at? }.
// file_key should already be uploaded via /api/admin/installer-url.
export async function POST(req: NextRequest) {
  const admin = await checkAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { product_id, version, file_key, changelog, released_at } = await req.json();

  if (typeof product_id !== "string" || !product_id) {
    return NextResponse.json({ error: "product_id required" }, { status: 400 });
  }
  if (typeof version !== "string" || !version.trim()) {
    return NextResponse.json({ error: "version required" }, { status: 400 });
  }
  if (file_key != null && typeof file_key !== "string") {
    return NextResponse.json({ error: "invalid file_key" }, { status: 400 });
  }
  if (changelog != null && typeof changelog !== "string") {
    return NextResponse.json({ error: "invalid changelog" }, { status: 400 });
  }

  const insertPayload: Record<string, unknown> = {
    product_id,
    version: version.trim(),
    file_key: file_key ?? null,
    changelog: changelog ?? null,
  };
  if (released_at) insertPayload.released_at = released_at;

  const { data, error } = await serviceSupabase
    .from("product_versions")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await syncProductLatest(product_id);
  return NextResponse.json({ row: data });
}

// PATCH: edit changelog / released_at on an existing version.
export async function PATCH(req: NextRequest) {
  const admin = await checkAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, changelog, released_at } = await req.json();
  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const patch: Record<string, unknown> = {};
  if (changelog !== undefined) patch.changelog = changelog ?? null;
  if (released_at !== undefined) patch.released_at = released_at;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const { data, error } = await serviceSupabase
    .from("product_versions")
    .update(patch)
    .eq("id", id)
    .select("product_id")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "not found" }, { status: 400 });
  }

  // released_at edit can shift latest, so resync.
  if (released_at !== undefined) await syncProductLatest(data.product_id);
  return NextResponse.json({ ok: true });
}

// DELETE: remove a version row + its storage file. Recomputes products.version
// + file_key from the next-most-recent row.
export async function DELETE(req: NextRequest) {
  const admin = await checkAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await req.json();
  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const { data: row, error: fetchErr } = await serviceSupabase
    .from("product_versions")
    .select("product_id, file_key")
    .eq("id", id)
    .single();
  if (fetchErr || !row) {
    return NextResponse.json({ error: fetchErr?.message ?? "not found" }, { status: 404 });
  }

  const { error: delErr } = await serviceSupabase
    .from("product_versions")
    .delete()
    .eq("id", id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  // Best-effort storage cleanup. If the same file_key is reused by another row
  // (shouldn't happen for new uploads, but possible for legacy backfilled rows
  // pointing at rbz/{slug}.rbz), skip removal.
  if (row.file_key) {
    const { count } = await serviceSupabase
      .from("product_versions")
      .select("id", { count: "exact", head: true })
      .eq("file_key", row.file_key);
    if (!count || count === 0) {
      await serviceSupabase.storage.from("uploads").remove([row.file_key]);
    }
  }

  await syncProductLatest(row.product_id);
  return NextResponse.json({ ok: true });
}
