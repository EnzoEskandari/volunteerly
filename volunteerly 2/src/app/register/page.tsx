"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { HeartHandshake, GraduationCap, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useAuth } from "@/lib/context/auth-context";
import { cn } from "@/lib/utils";
import { CAUSE_CATEGORIES, type CauseCategory } from "@/lib/types";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const params = useSearchParams();
  const [accountType, setAccountType] = useState<"student" | "organization">(
    params.get("type") === "organization" ? "organization" : "student",
  );

  return (
    <div className="min-h-screen bg-surface px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 font-display text-lg font-bold text-navy-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy text-white">
            <HeartHandshake className="h-4.5 w-4.5" />
          </span>
          Volunteerly
        </Link>

        <div className="rounded-2xl border border-navy-100 bg-white p-6 shadow-card sm:p-8">
          <h1 className="text-center font-display text-2xl font-bold text-navy-900">Create your account</h1>
          <p className="mt-1.5 text-center text-sm text-navy-500">Choose the account type that fits you.</p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              onClick={() => setAccountType("student")}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-4 transition-colors",
                accountType === "student" ? "border-brand bg-brand-50" : "border-navy-100 hover:bg-navy-50",
              )}
            >
              <GraduationCap className={cn("h-6 w-6", accountType === "student" ? "text-brand" : "text-navy-400")} />
              <span className="text-sm font-semibold text-navy-900">I'm a Student</span>
            </button>
            <button
              onClick={() => setAccountType("organization")}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-4 transition-colors",
                accountType === "organization" ? "border-brand bg-brand-50" : "border-navy-100 hover:bg-navy-50",
              )}
            >
              <Building2 className={cn("h-6 w-6", accountType === "organization" ? "text-brand" : "text-navy-400")} />
              <span className="text-sm font-semibold text-navy-900">I'm an Organization</span>
            </button>
          </div>

          <div className="mt-6">
            {accountType === "student" ? <StudentRegisterForm /> : <OrganizationRegisterForm />}
          </div>

          <p className="mt-6 text-center text-sm text-navy-500">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function StudentRegisterForm() {
  const { registerStudent } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerStudent({ fullName, email });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Maya Chen" />
      </div>
      <div>
        <Label htmlFor="email">School or personal email</Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@student.edu"
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" required placeholder="••••••••" />
      </div>
      <Button type="submit" className="w-full">
        Create student account
      </Button>
      <p className="text-center text-xs text-navy-400">Next, we'll ask a few quick questions to personalize your matches.</p>
    </form>
  );
}

function OrganizationRegisterForm() {
  const { registerOrganization } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ein, setEin] = useState("");
  const [website, setWebsite] = useState("");
  const [contactName, setContactName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CauseCategory[]>([]);

  const toggleCategory = (c: CauseCategory) =>
    setCategory((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerOrganization({ name, email, ein, website: website || undefined, contactName, category });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="orgName">Organization name</Label>
        <Input id="orgName" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Coastal Paws Animal Rescue" />
      </div>
      <div>
        <Label htmlFor="contactName">Primary contact name</Label>
        <Input id="contactName" required value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Renee Ford" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="orgEmail">Organization email</Label>
          <Input id="orgEmail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hello@org.org" />
        </div>
        <div>
          <Label htmlFor="ein">Tax ID / EIN</Label>
          <Input id="ein" required value={ein} onChange={(e) => setEin(e.target.value)} placeholder="94-3021847" />
        </div>
      </div>
      <div>
        <Label htmlFor="website">Website (optional)</Label>
        <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
      </div>
      <div>
        <Label htmlFor="description">Brief description</Label>
        <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does your organization do?" />
      </div>
      <div>
        <Label>Cause categories</Label>
        <div className="flex flex-wrap gap-2">
          {CAUSE_CATEGORIES.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => toggleCategory(c)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                category.includes(c)
                  ? "border-brand bg-brand-50 text-brand-700"
                  : "border-navy-200 text-navy-600 hover:bg-navy-50",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
        Your registration will be reviewed by a Volunteerly administrator before you can publish opportunities or
        verify hours — usually within 1–2 business days.
      </div>
      <Button type="submit" className="w-full">
        Submit for approval
      </Button>
    </form>
  );
}
