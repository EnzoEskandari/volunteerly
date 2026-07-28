import { Star } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

const testimonials = [
  {
    quote:
      "I used to keep a folder of signed paper forms for community service — half of them got lost. Now everything is verified and in one place before I even get home.",
    name: "Elena Vasquez",
    role: "Junior, Dos Pueblos High School",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=faces",
  },
  {
    quote:
      "We used to spend hours chasing down volunteers for sign-in sheets. QR check-in and one-click verification gave that time back to our actual mission.",
    name: "Renee Ford",
    role: "Volunteer Coordinator, Coastal Paws Animal Rescue",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=faces",
  },
  {
    quote:
      "The recommendation feed actually gets it right. I found a tutoring program I never would have searched for on my own, and now it's my favorite thing I do every week.",
    name: "Sam Whitfield",
    role: "Senior, San Marcos High School",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=faces",
  },
];

export function Testimonials() {
  return (
    <section className="container-app py-20 lg:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">Trusted by the community</p>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
          Students and nonprofits, both better off
        </h2>
      </div>

      <div className="mt-14 grid gap-6 lg:grid-cols-3">
        {testimonials.map((t) => (
          <figure key={t.name} className="flex h-full flex-col rounded-2xl border border-navy-100 bg-white p-6 shadow-card">
            <div className="flex gap-0.5 text-amber-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-navy-600">“{t.quote}”</blockquote>
            <figcaption className="mt-6 flex items-center gap-3">
              <Avatar src={t.avatar} name={t.name} size={40} />
              <div>
                <p className="text-sm font-semibold text-navy-900">{t.name}</p>
                <p className="text-xs text-navy-400">{t.role}</p>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
