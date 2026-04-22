import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function buildSupabaseForRequest(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const authHeader = request.headers.get("authorization");

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = buildSupabaseForRequest(request);
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(id, name)")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const organizations = (data ?? []).flatMap((row) => {
    const organization = Array.isArray(row.organizations)
      ? row.organizations[0]
      : row.organizations;

    if (!organization || typeof organization.id !== "string" || typeof organization.name !== "string") {
      return [];
    }

    return [
      {
        id: organization.id,
        name: organization.name,
        role: row.role,
      },
    ];
  });

  return NextResponse.json({ data: organizations });
}
