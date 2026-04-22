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
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = buildSupabaseForRequest(request);
  const date = request.nextUrl.searchParams.get("date");
  const month = request.nextUrl.searchParams.get("month");
  const organizationId = request.nextUrl.searchParams.get("organizationId");

  if (!organizationId) {
    return NextResponse.json({ error: "Missing organizationId query param" }, { status: 400 });
  }

  if (!date && !month) {
    return NextResponse.json(
      { error: "Missing date or month query param" },
      { status: 400 },
    );
  }

  if (month) {
    const [yearText, monthText] = month.split("-");
    const year = Number(yearText);
    const monthNumber = Number(monthText);
    if (!year || !monthNumber || monthNumber < 1 || monthNumber > 12) {
      return NextResponse.json({ error: "Invalid month format" }, { status: 400 });
    }

    const startDate = `${yearText}-${monthText}-01`;
    const lastDay = new Date(year, monthNumber, 0).getDate();
    const endDate = `${yearText}-${monthText}-${String(lastDay).padStart(2, "0")}`;

    const { data, error } = await supabase
      .from("schedules")
      .select("*")
      .eq("organization_id", organizationId)
      .gte("shift_date", startDate)
      .lte("shift_date", endDate)
      .order("shift_date", { ascending: true })
      .order("shift_name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  }

  const { data, error } = await supabase
    .from("schedules")
    .select("*")
    .eq("organization_id", organizationId)
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
    organizationId?: string;
    assignments?: IncomingAssignment[];
    notes?: string;
  };

  if (!body.date || !body.organizationId || !Array.isArray(body.assignments)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const invalidShift = body.assignments.find(
    (assignment) => !VALID_SHIFTS.includes(assignment.shift_name),
  );
  if (invalidShift) {
    return NextResponse.json({ error: `Invalid shift: ${invalidShift.shift_name}` }, { status: 400 });
  }

  const upsertRows = body.assignments.map((assignment) => ({
    organization_id: body.organizationId,
    shift_date: body.date,
    shift_name: assignment.shift_name,
    assigned_to: assignment.assigned_to.trim(),
    notes: body.notes?.trim() || null,
  }));

  const { error } = await supabase
    .from("schedules")
    .upsert(upsertRows, { onConflict: "organization_id,shift_date,shift_name" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
