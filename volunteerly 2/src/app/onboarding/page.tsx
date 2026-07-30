"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HeartHandshake, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/context/auth-context";
import { useAppData } from "@/lib/context/data-context";
import { RequireRole } from "@/components/auth/require-role";
import { CAUSE_CATEGORIES, type CauseCategory, type WeekDay, type TimeOfDay } from "@/lib/types";

const DAYS: WeekDay[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIMES: TimeOfDay[] = ["Morning", "Afternoon", "Evening"];

export default function OnboardingPage() {
  return (
    <RequireRole role="student">
      <OnboardingFlow />
    </RequireRole>
  );
}

function OnboardingFlow() {
  const { currentUser } = useAuth();
  const { updateStudent } = useAppData();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState<CauseCategory[]>([]);
  const [availableDays, setAvailableDays] = useState<WeekDay[]>([]);
  const [availableTimes, setAvailableTimes] = useState<TimeOfDay[]>([]);
  const [travelDistanceMiles, setTravelDistanceMiles] = useState(10);
  const [virtualPreference, setVirtualPreference] = useState<"virtual" | "in-person" | "both">("both");
  const [transportation, setTransportation] = useState(true);
  const [age, setAge] = useState("");

  const steps = ["Causes", "Availability", "Distance", "Format", "Transportation", "About you"];
  const isLast = step === steps.length - 1;

  const toggle = <T,>(list: T[], setList: (v: T[]) => void, value: T) =>
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const finish = () => {
    if (!currentUser) return;
    updateStudent(currentUser.id, {
      interests,
      availableDays,
      availableTimes,
      travelDistanceMiles,
      virtualPreference,
      transportation,
      age: age ? Number(age) : undefined,
      onboardingComplete: true,
    });
    router.push("/dashboard/student?onboarded=1");
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="border-b border-navy-100 bg-white">
        <div className="container-app flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 font-display text-lg font-bold text-navy-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy text-white">
              <HeartHandshake className="h-4.5 w-4.5" />
            </span>
            Volunteerly
          </div>
          <p className="text-sm text-navy-400">
            Step {step + 1} of {steps.length}
          </p>
        </div>
        <div className="h-1 w-full bg-navy-100">
          <div
            className="h-full bg-brand transition-all duration-500"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>
      </header>

      <div className="container-app flex flex-1 items-start justify-center py-12">
        <div className="w-full max-w-xl">
          {step === 0 && (
            <StepShell title="What causes interest you?" description="Pick as many as you'd like — you can change these anytime.">
              <div className="flex flex-wrap gap-2">
                {CAUSE_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => toggle(interests, setInterests, c)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                      interests.includes(c)
                        ? "border-brand bg-brand-50 text-brand-700"
                        : "border-navy-200 text-navy-600 hover:bg-navy-50",
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </StepShell>
          )}

          {step === 1 && (
            <StepShell title="When are you available?" description="Select the days and times that usually work for you.">
              <div className="space-y-5">
                <div>
                  <p className="mb-2 text-sm font-medium text-navy-700">Available days</p>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((d) => (
                      <button
                        key={d}
                        onClick={() => toggle(availableDays, setAvailableDays, d)}
                        className={cn(
                          "h-11 w-14 rounded-xl border text-sm font-medium transition-colors",
                          availableDays.includes(d)
                            ? "border-brand bg-brand-50 text-brand-700"
                            : "border-navy-200 text-navy-600 hover:bg-navy-50",
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-navy-700">Available times</p>
                  <div className="flex flex-wrap gap-2">
                    {TIMES.map((t) => (
                      <button
                        key={t}
                        onClick={() => toggle(availableTimes, setAvailableTimes, t)}
                        className={cn(
                          "rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors",
                          availableTimes.includes(t)
                            ? "border-brand bg-brand-50 text-brand-700"
                            : "border-navy-200 text-navy-600 hover:bg-navy-50",
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </StepShell>
          )}

          {step === 2 && (
            <StepShell title="How far can you travel?" description="We'll prioritize opportunities within this range.">
              <div className="rounded-2xl border border-navy-100 bg-white p-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-navy-700">Travel distance</span>
                  <span className="font-display text-lg font-bold text-brand">{travelDistanceMiles} miles</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={travelDistanceMiles}
                  onChange={(e) => setTravelDistanceMiles(Number(e.target.value))}
                  className="mt-4 w-full accent-brand"
                />
                <div className="mt-1 flex justify-between text-xs text-navy-400">
                  <span>1 mi</span>
                  <span>30+ mi</span>
                </div>
              </div>
            </StepShell>
          )}

          {step === 3 && (
            <StepShell title="Virtual or in-person?" description="You'll still see everything — this just tunes your recommendations.">
              <div className="grid grid-cols-3 gap-3">
                {(["in-person", "virtual", "both"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVirtualPreference(v)}
                    className={cn(
                      "rounded-xl border-2 px-4 py-5 text-sm font-semibold capitalize transition-colors",
                      virtualPreference === v ? "border-brand bg-brand-50 text-brand-700" : "border-navy-100 text-navy-600 hover:bg-navy-50",
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </StepShell>
          )}

          {step === 4 && (
            <StepShell title="Do you have reliable transportation?" description="This helps us flag opportunities that are realistic for you.">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setTransportation(true)}
                  className={cn(
                    "rounded-xl border-2 px-4 py-5 text-sm font-semibold transition-colors",
                    transportation ? "border-brand bg-brand-50 text-brand-700" : "border-navy-100 text-navy-600 hover:bg-navy-50",
                  )}
                >
                  Yes, I can drive or get a ride
                </button>
                <button
                  onClick={() => setTransportation(false)}
                  className={cn(
                    "rounded-xl border-2 px-4 py-5 text-sm font-semibold transition-colors",
                    !transportation ? "border-brand bg-brand-50 text-brand-700" : "border-navy-100 text-navy-600 hover:bg-navy-50",
                  )}
                >
                  Not usually
                </button>
              </div>
            </StepShell>
          )}

          {step === 5 && (
            <StepShell title="One last thing" description="Some opportunities have minimum age requirements.">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-navy-700" htmlFor="age">
                  Your age
                </label>
                <input
                  id="age"
                  type="number"
                  min={13}
                  max={19}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="h-11 w-full max-w-[160px] rounded-xl border border-navy-200 px-3.5 text-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand-100"
                />
              </div>
            </StepShell>
          )}

          <div className="mt-8 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            {isLast ? (
              <Button onClick={finish}>
                <Check className="h-4 w-4" />
                Finish setup
              </Button>
            ) : (
              <Button onClick={() => setStep((s) => s + 1)} className="group">
                Continue
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="animate-fade-up">
      <h1 className="font-display text-2xl font-bold text-navy-900">{title}</h1>
      <p className="mt-1.5 text-navy-500">{description}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}
