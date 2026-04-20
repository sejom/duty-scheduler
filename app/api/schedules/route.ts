import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Shift = "morning" | "afternoon" | "night";

type IncomingAssignment = {
  shift_name: Shift;
  assigned_to: string;
};

const VALID_SHIFTS: Shift[] = ["morning", "afternoon", "night"];

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
  const supabase = buildSupabaseForRequest(request);
  const date = request.nextUrl.searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "Missing date query param" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("schedules")
    .select("*")
    .eq("shift_date", date)
    .order("shift_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = buildSupabaseForRequest(request);
  const body = (await request.json()) as {
    date?: string;
    assignments?: IncomingAssignment[];
    notes?: string;
  };

  if (!body.date || !Array.isArray(body.assignments)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const invalidShift = body.assignments.find(
    (assignment) => !VALID_SHIFTS.includes(assignment.shift_name),
  );
  if (invalidShift) {
    return NextResponse.json({ error: `Invalid shift: ${invalidShift.shift_name}` }, { status: 400 });
  }

  const upsertRows = body.assignments.map((assignment) => ({
    shift_date: body.date,
    shift_name: assignment.shift_name,
    assigned_to: assignment.assigned_to.trim(),
    notes: body.notes?.trim() || null,
  }));

  const { error } = await supabase
    .from("schedules")
    .upsert(upsertRows, { onConflict: "shift_date,shift_name" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
