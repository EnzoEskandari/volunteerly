import * as Icons from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Achievement, StudentAchievement } from "@/lib/types";

export function AchievementsCard({
  catalog,
  earned,
}: {
  catalog: Achievement[];
  earned: StudentAchievement[];
}) {
  const earnedKeys = new Set(earned.map((e) => e.achievementKey));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Achievements</CardTitle>
        <CardDescription>
          {earnedKeys.size} of {catalog.length} unlocked
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {catalog.map((a) => {
            const unlocked = earnedKeys.has(a.key);
            const Icon = (Icons as any)[a.icon] ?? Icons.Award;
            return (
              <div key={a.key} className="group relative flex flex-col items-center gap-1.5 text-center" title={a.description}>
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-2xl transition-colors",
                    unlocked ? "bg-brand-50 text-brand" : "bg-navy-50 text-navy-300",
                  )}
                >
                  <Icon className="h-5.5 w-5.5" />
                </div>
                <p className={cn("text-[11px] font-medium leading-tight", unlocked ? "text-navy-700" : "text-navy-300")}>
                  {a.label}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
