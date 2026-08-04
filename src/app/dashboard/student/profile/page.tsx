"use client";

import { useState } from "react";
import { Pencil, Check, MapPin, GraduationCap, Clock, Building2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useAuth } from "@/lib/context/auth-context";
import { useAppData } from "@/lib/context/data-context";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { CAUSE_CATEGORIES, type CauseCategory, type Student } from "@/lib/types";

export default function StudentProfilePage() {
  const { currentUser } = useAuth();
  const { updateStudent, verifiedHours, organizations, studentAchievements, achievementsCatalog } = useAppData();
  const { showToast } = useToast();
  const student = currentUser as Student;

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    bio: student.bio ?? "",
    school: student.school ?? "",
    gradYear: student.gradYear?.toString() ?? "",
    location: student.location ?? "",
    skills: student.skills.join(", "),
    languages: student.languages.join(", "),
    interests: student.interests,
  });

  const toggleInterest = (c: CauseCategory) =>
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(c) ? f.interests.filter((x) => x !== c) : [...f.interests, c],
    }));

  const save = () => {
    updateStudent(student.id, {
      bio: form.bio,
      school: form.school,
      gradYear: form.gradYear ? Number(form.gradYear) : undefined,
      location: form.location,
      skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
      languages: form.languages.split(",").map((s) => s.trim()).filter(Boolean),
      interests: form.interests,
    });
    setEditing(false);
    showToast("Profile updated");
  };

  const myOrgs = Array.from(new Set(verifiedHours.filter((h) => h.studentId === student.id).map((h) => h.orgId)))
    .map((id) => organizations.find((o) => o.id === id))
    .filter(Boolean);

  const myAchievements = studentAchievements
    .filter((a) => a.studentId === student.id)
    .map((a) => achievementsCatalog.find((c) => c.key === a.achievementKey))
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 pt-6 text-center sm:flex-row sm:text-left">
          <Avatar src={student.avatarUrl} name={student.fullName} size={88} />
          <div className="flex-1">
            <h1 className="font-display text-xl font-bold text-navy-900">{student.fullName}</h1>
            <p className="text-sm text-navy-400">{student.email}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
              {student.school && (
                <Badge tone="slate">
                  <GraduationCap className="h-3 w-3" /> {student.school} {student.gradYear ? `'${String(student.gradYear).slice(2)}` : ""}
                </Badge>
              )}
              {student.location && (
                <Badge tone="slate">
                  <MapPin className="h-3 w-3" /> {student.location}
                </Badge>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => (editing ? save() : setEditing(true))}>
            {editing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            {editing ? "Save changes" : "Edit profile"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatBlock icon={Clock} label="Verified Hours" value={student.totalVerifiedHours} />
        <StatBlock icon={Building2} label="Organizations" value={myOrgs.length} />
        <StatBlock icon={GraduationCap} label="Achievements" value={myAchievements.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="bio">Bio</Label>
                <Textarea id="bio" rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="school">School</Label>
                  <Input id="school" value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="gradYear">Graduation year</Label>
                  <Input id="gradYear" type="number" value={form.gradYear} onChange={(e) => setForm({ ...form, gradYear: e.target.value })} />
                </div>
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input id="location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="skills">Skills (comma separated)</Label>
                <Input id="skills" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="languages">Languages (comma separated)</Label>
                <Input id="languages" value={form.languages} onChange={(e) => setForm({ ...form, languages: e.target.value })} />
              </div>
              <div>
                <Label>Preferred causes</Label>
                <div className="flex flex-wrap gap-2">
                  {CAUSE_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => toggleInterest(c)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        form.interests.includes(c) ? "border-brand bg-brand-50 text-brand-700" : "border-navy-200 text-navy-600 hover:bg-navy-50",
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              <p className="text-navy-600">{student.bio || "No bio added yet."}</p>
              <div>
                <p className="mb-1.5 font-medium text-navy-700">Interests</p>
                <div className="flex flex-wrap gap-1.5">
                  {student.interests.map((i) => (
                    <Badge key={i} tone="brand">
                      {i}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 font-medium text-navy-700">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {student.skills.map((s) => (
                    <Badge key={s} tone="slate">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 font-medium text-navy-700">Languages</p>
                <p className="text-navy-500">{student.languages.join(", ") || "—"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-1.5 font-medium text-navy-700">Availability</p>
                  <p className="text-navy-500">
                    {student.availableDays.join(", ") || "—"} · {student.availableTimes.join(", ") || "—"}
                  </p>
                </div>
                <div>
                  <p className="mb-1.5 font-medium text-navy-700">Transportation</p>
                  <p className="text-navy-500">{student.transportation ? "Available" : "Not available"}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organizations Volunteered With</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {myOrgs.length === 0 ? (
            <p className="text-sm text-navy-400">No verified hours yet.</p>
          ) : (
            myOrgs.map((o) => (
              <div key={o!.id} className="flex items-center gap-2 rounded-xl border border-navy-100 px-3 py-2">
                <Avatar src={o!.logoUrl} name={o!.name} size={28} />
                <span className="text-sm font-medium text-navy-800">{o!.name}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatBlock({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <Card className="p-5 text-center">
      <Icon className="mx-auto h-5 w-5 text-brand" />
      <p className="mt-2 font-display text-2xl font-bold text-navy-900">{value}</p>
      <p className="text-xs text-navy-400">{label}</p>
    </Card>
  );
}
