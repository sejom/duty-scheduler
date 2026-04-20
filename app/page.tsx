"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Shift = "morning" | "afternoon" | "night";

type ScheduleRow = {
  id: number;
  shift_date: string;
  shift_name: Shift;
  assigned_to: string;
  notes: string | null;
};

const SHIFT_LABELS: Record<Shift, string> = {
  morning: "Morning shift",
  afternoon: "Afternoon shift",
  night: "Night shift",
};

function todayLocalDate() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function Home() {
  const [selectedDate, setSelectedDate] = useState(todayLocalDate());
  const [assignments, setAssignments] = useState<Record<Shift, string>>({
    morning: "",
    afternoon: "",
    night: "",
  });
  const [notes, setNotes] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const orderedShifts = useMemo(
    () => Object.keys(SHIFT_LABELS) as Shift[],
    [],
  );

  useEffect(() => {
    const run = async () => {
      try {
        setStatusMessage("Loading schedule...");
        const response = await fetch(`/api/schedules?date=${selectedDate}`);
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
  }, [selectedDate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setStatusMessage("Saving...");

    try {
      const response = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
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
          Simple manual scheduling with three shifts per day.
        </p>
      </section>

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
            disabled={isSaving}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save schedule"}
          </button>
        </div>
      </form>
    </main>
  );
}
