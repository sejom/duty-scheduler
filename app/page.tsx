"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Shift = "morning" | "afternoon" | "night";

type ScheduleRow = {
  id: number;
  organization_id: string;
  shift_date: string;
  shift_name: Shift;
  assigned_to: string;
  notes: string | null;
};

type Organization = {
  id: string;
  name: string;
  role: "admin" | "scheduler" | "staff" | "viewer";
};

const SHIFT_LABELS: Record<Shift, string> = {
  morning: "Morning shift",
  afternoon: "Afternoon shift",
  night: "Night shift",
};

const SHIFT_TIMES: Record<Shift, string> = {
  morning: "06:00 - 14:00",
  afternoon: "14:00 - 22:00",
  night: "22:00 - 06:00",
};

const SHIFT_STYLES: Record<Shift, string> = {
  morning: "border-amber-200 bg-amber-50",
  afternoon: "border-sky-200 bg-sky-50",
  night: "border-indigo-200 bg-indigo-50",
};

function todayLocalDate() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function monthKeyFromDate(dateValue: string) {
  return dateValue.slice(0, 7);
}

function daysInMonth(monthKey: string) {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  return new Date(year, monthNumber, 0).getDate();
}

const SHIFT_ORDER: Record<Shift, number> = {
  morning: 0,
  afternoon: 1,
  night: 2,
};

export default function Home() {
  const [selectedDate, setSelectedDate] = useState(todayLocalDate());
  const [session, setSession] = useState<Session | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [assignments, setAssignments] = useState<Record<Shift, string>>({
    morning: "",
    afternoon: "",
    night: "",
  });
  const [notes, setNotes] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [monthRows, setMonthRows] = useState<ScheduleRow[]>([]);
  const [employeeName, setEmployeeName] = useState("");

  const orderedShifts = useMemo(
    () => Object.keys(SHIFT_LABELS) as Shift[],
    [],
  );

  const namesThisMonth = useMemo(() => {
    const set = new Set<string>();
    for (const row of monthRows) {
      const name = row.assigned_to?.trim();
      if (name) {
        set.add(name);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [monthRows]);

  const employeeSchedule = useMemo(() => {
    const query = employeeName.trim().toLowerCase();
    if (!query) {
      return [];
    }
    const matches = monthRows.filter((row) => {
      const assigned = row.assigned_to?.trim().toLowerCase() ?? "";
      return assigned === query || assigned.includes(query);
    });
    return [...matches].sort((a, b) => {
      if (a.shift_date !== b.shift_date) {
        return a.shift_date.localeCompare(b.shift_date);
      }
      return SHIFT_ORDER[a.shift_name] - SHIFT_ORDER[b.shift_name];
    });
  }, [monthRows, employeeName]);

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    };

    void run();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!session) {
        setOrganizations([]);
        setSelectedOrganizationId("");
        return;
      }

      const response = await fetch("/api/organizations", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const payload = (await response.json()) as {
        data?: Organization[];
        error?: string;
      };

      if (!response.ok || !payload.data) {
        setStatusMessage(payload.error ?? "Failed to load organizations");
        setOrganizations([]);
        setSelectedOrganizationId("");
        return;
      }

      setOrganizations(payload.data);
      setSelectedOrganizationId((current) => {
        if (current && payload.data.some((organization) => organization.id === current)) {
          return current;
        }
        return payload.data[0]?.id ?? "";
      });
    };

    void run();
  }, [session]);

  useEffect(() => {
    const run = async () => {
      try {
        if (!session || !selectedOrganizationId) {
          setAssignments({ morning: "", afternoon: "", night: "" });
          setNotes("");
          return;
        }

        setStatusMessage("Loading schedule...");
        const response = await fetch(
          `/api/schedules?date=${selectedDate}&organizationId=${selectedOrganizationId}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          },
        );
        const payload = (await response.json()) as { data?: ScheduleRow[]; error?: string };

        if (!response.ok || !payload.data) {
          throw new Error(payload.error ?? "Failed to load schedule");
        }

        const nextAssignments: Record<Shift, string> = {
          morning: "",
          afternoon: "",
          night: "",
        };

        let nextNotes = "";
        for (const row of payload.data) {
          nextAssignments[row.shift_name] = row.assigned_to ?? "";
          if (row.notes) {
            nextNotes = row.notes;
          }
        }

        setAssignments(nextAssignments);
        setNotes(nextNotes);
        setStatusMessage("");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected error";
        setStatusMessage(message);
      }
    };

    void run();
  }, [selectedDate, selectedOrganizationId, session]);

  useEffect(() => {
    const run = async () => {
      try {
        if (!session || !selectedOrganizationId) {
          setMonthRows([]);
          return;
        }

        const monthKey = monthKeyFromDate(selectedDate);
        const response = await fetch(
          `/api/schedules?month=${monthKey}&organizationId=${selectedOrganizationId}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          },
        );
        const payload = (await response.json()) as { data?: ScheduleRow[]; error?: string };
        if (!response.ok || !payload.data) {
          throw new Error(payload.error ?? "Failed to load month schedule");
        }
        setMonthRows(payload.data);
      } catch {
        setMonthRows([]);
      }
    };

    void run();
  }, [selectedDate, selectedOrganizationId, session, statusMessage]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage("Signing in...");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setPassword("");
    setStatusMessage("Signed in.");
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setStatusMessage(error.message);
      return;
    }
    setStatusMessage("Signed out.");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session || !selectedOrganizationId) {
      setStatusMessage("Please sign in before saving.");
      return;
    }

    setIsSaving(true);
    setStatusMessage("Saving...");

    try {
      const token = session.access_token;
      const response = await fetch("/api/schedules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          date: selectedDate,
          organizationId: selectedOrganizationId,
          assignments: orderedShifts.map((shift) => ({
            shift_name: shift,
            assigned_to: assignments[shift],
          })),
          notes,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save schedule");
      }

      setStatusMessage("Saved successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      setStatusMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 p-6 md:p-10">
      <section>
        <h1 className="text-3xl font-semibold">Duty Scheduler</h1>
        <p className="mt-2 text-sm text-gray-600">
          Multi-tenant shift scheduling for hospitals.
        </p>
      </section>

      {session && (
        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Hospital selection</h2>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Active hospital
            <select
              value={selectedOrganizationId}
              onChange={(event) => setSelectedOrganizationId(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2"
            >
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name} ({organization.role})
                </option>
              ))}
            </select>
          </label>
          {!organizations.length && (
            <p className="text-sm text-red-600">
              No hospital membership found for this user. Add a row in
              organization_members in Supabase.
            </p>
          )}
        </section>
      )}

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold">Daily schedule view</h2>
          <p className="mt-1 text-sm text-gray-600">
            Visual overview for {selectedDate}
          </p>
        </div>
        <div className="grid gap-3">
          {orderedShifts.map((shift) => (
            <div
              key={`visual-${shift}`}
              className={`rounded-lg border p-4 ${SHIFT_STYLES[shift]}`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-gray-900">
                  {SHIFT_LABELS[shift]}
                </p>
                <p className="text-xs text-gray-600">{SHIFT_TIMES[shift]}</p>
              </div>
              <p className="mt-2 text-sm text-gray-800">
                {assignments[shift] || "Unassigned"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold">Monthly schedule view</h2>
          <p className="mt-1 text-sm text-gray-600">
            Overview for {monthKeyFromDate(selectedDate)}
          </p>
        </div>
        <div className="overflow-x-auto">
          <div className="grid min-w-[920px] grid-cols-8 gap-2 text-xs">
            <div className="rounded-md border border-gray-200 bg-gray-50 p-2 font-semibold text-gray-700">
              Date
            </div>
            {orderedShifts.map((shift) => (
              <div
                key={`month-head-${shift}`}
                className="rounded-md border border-gray-200 bg-gray-50 p-2 font-semibold text-gray-700"
              >
                {SHIFT_LABELS[shift]}
              </div>
            ))}
            <div className="col-span-4 rounded-md border border-gray-200 bg-gray-50 p-2 font-semibold text-gray-700">
              Notes
            </div>

            {Array.from({ length: daysInMonth(monthKeyFromDate(selectedDate)) }).map(
              (_unused, index) => {
                const day = String(index + 1).padStart(2, "0");
                const dateValue = `${monthKeyFromDate(selectedDate)}-${day}`;
                const dayRows = monthRows.filter((row) => row.shift_date === dateValue);
                const byShift: Record<Shift, string> = {
                  morning:
                    dayRows.find((row) => row.shift_name === "morning")?.assigned_to || "",
                  afternoon:
                    dayRows.find((row) => row.shift_name === "afternoon")?.assigned_to || "",
                  night: dayRows.find((row) => row.shift_name === "night")?.assigned_to || "",
                };
                const dayNote = dayRows.find((row) => row.notes)?.notes || "";

                return (
                  <div key={`month-row-${dateValue}`} className="contents">
                    <div className="rounded-md border border-gray-200 p-2 font-medium text-gray-800">
                      {dateValue}
                    </div>
                    {orderedShifts.map((shift) => (
                      <div key={`${dateValue}-${shift}`} className="rounded-md border border-gray-200 p-2 text-gray-700">
                        {byShift[shift] || "Unassigned"}
                      </div>
                    ))}
                    <div className="col-span-4 rounded-md border border-gray-200 p-2 text-gray-600">
                      {dayNote || "-"}
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold">Employee view</h2>
          <p className="mt-1 text-sm text-gray-600">
            Shifts for one person in {monthKeyFromDate(selectedDate)} (matches name as you type).
          </p>
        </div>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Employee name
          <input
            type="text"
            list="employee-names-this-month"
            value={employeeName}
            onChange={(event) => setEmployeeName(event.target.value)}
            placeholder="e.g. Alice"
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
          <datalist id="employee-names-this-month">
            {namesThisMonth.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
        {!employeeName.trim() ? (
          <p className="text-sm text-gray-500">Enter a name to see their shifts this month.</p>
        ) : employeeSchedule.length === 0 ? (
          <p className="text-sm text-gray-500">
            No shifts found for &quot;{employeeName.trim()}&quot; in this month.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600">
                  <th className="py-2 pr-4 font-semibold">Date</th>
                  <th className="py-2 pr-4 font-semibold">Shift</th>
                  <th className="py-2 pr-4 font-semibold">Time</th>
                  <th className="py-2 font-semibold">Day notes</th>
                </tr>
              </thead>
              <tbody>
                {employeeSchedule.map((row) => {
                  const dayNote =
                    monthRows.find(
                      (r) => r.shift_date === row.shift_date && r.notes,
                    )?.notes ?? null;
                  return (
                    <tr key={row.id} className="border-b border-gray-100">
                      <td className="py-2 pr-4 text-gray-900">{row.shift_date}</td>
                      <td className="py-2 pr-4 text-gray-800">{SHIFT_LABELS[row.shift_name]}</td>
                      <td className="py-2 pr-4 text-gray-600">{SHIFT_TIMES[row.shift_name]}</td>
                      <td className="py-2 text-gray-600">{dayNote || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-gray-500">
              {employeeSchedule.length} shift{employeeSchedule.length === 1 ? "" : "s"} this month.
            </p>
          </div>
        )}
      </section>

      {!session ? (
        <form
          onSubmit={handleLogin}
          className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold">Sign in to edit schedule</h2>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2"
              required
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Sign in
          </button>
        </form>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-700">Signed in as {session.user.email}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium"
          >
            Sign out
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <label className="flex flex-col gap-2 text-sm font-medium">
          Schedule date
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2"
            required
          />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          {orderedShifts.map((shift) => (
            <label key={shift} className="flex flex-col gap-2 text-sm font-medium">
              {SHIFT_LABELS[shift]}
              <input
                type="text"
                placeholder="Person name"
                value={assignments[shift]}
                onChange={(event) =>
                  setAssignments((prev) => ({ ...prev, [shift]: event.target.value }))
                }
                className="rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
          ))}
        </div>

        <label className="flex flex-col gap-2 text-sm font-medium">
          Notes (optional)
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-24 rounded-lg border border-gray-300 px-3 py-2"
            placeholder="Anything to remember for this day..."
          />
        </label>

        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">{statusMessage}</p>
          <button
            type="submit"
            disabled={isSaving || !session || !selectedOrganizationId}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save schedule"}
          </button>
        </div>
      </form>
    </main>
  );
}
