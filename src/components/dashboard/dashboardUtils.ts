/**
 * Get BMI category with label, color, and background classes.
 */
export const getBMICategory = (bmi: number) => {
  if (bmi < 18.5) {
    return {
      label: "Undervikt",
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    };
  }
  if (bmi < 25) {
    return {
      label: "Normalvikt",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    };
  }
  if (bmi < 30) {
    return {
      label: "Övervikt",
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    };
  }
  return { label: "Fetma", color: "text-rose-500", bg: "bg-rose-500/10" };
};

/**
 * Get a human-readable relative date label (idag, igår, X dgr sen, etc.)
 */
export const getRelativeDateLabel = (dateStr: string) => {
  const today = new Date();
  const date = new Date(dateStr + "T00:00:00");
  const diffDays = Math.floor(
    (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return "Idag";
  if (diffDays === 1) return "Igår";
  if (diffDays < 7) return `${diffDays} dgr sen`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} v. sen`;
  return dateStr;
};

/**
 * Get the ISO date string for the start of a given range.
 */
export const getRangeStartDate = (
  range: "14d" | "30d" | "3m" | "1y" | "all",
): string => {
  const d = new Date();
  if (range === "14d") d.setDate(d.getDate() - 14);
  else if (range === "30d") d.setDate(d.getDate() - 30);
  else if (range === "3m") d.setMonth(d.getMonth() - 3);
  else if (range === "1y") d.setFullYear(d.getFullYear() - 1);
  else return "0000-00-00";
  return d.toISOString().split("T")[0];
};

export type WeightRange = "14d" | "30d" | "3m" | "1y" | "all";
