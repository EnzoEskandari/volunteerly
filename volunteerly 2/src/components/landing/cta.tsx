import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CTA() {
  return (
    <section className="container-app pb-20 lg:pb-28">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-900 to-navy-950 px-8 py-16 text-center sm:px-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background: "radial-gradient(500px circle at 50% 0%, rgba(37,99,235,0.35), transparent 60%)",
          }}
        />
        <h2 className="relative font-display text-3xl font-bold text-white sm:text-4xl">
          Ready to make your service count?
        </h2>
        <p className="relative mx-auto mt-3 max-w-md text-navy-300">
          Join students and nonprofits already building trusted, verified impact together.
        </p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/register">
            <Button size="lg">Get Started as a Student</Button>
          </Link>
          <Link href="/register?type=organization">
            <Button size="lg" variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
              Register Your Organization
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
