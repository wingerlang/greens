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

export const getRelativeDateLabel = (dateStr: string) => {
  const today = new Date().toISOString().split("T")[0];
  const d = new Date(dateStr).toISOString().split("T")[0];
  if (d === today) return "idag";
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  if (d === yesterday) return "igår";

  // Calculate diff in days
  const diff = Math.floor(
    (new Date(today).getTime() - new Date(d).getTime()) / 86400000,
  );
  if (diff < 7) return `${diff} dgr sen`;
  if (diff < 30) return `${Math.floor(diff / 7)} v. sen`;
  return dateStr;
};

export const getRangeStartDate = (
  range: "14d" | "30d" | "3m" | "1y" | "all",
) => {
  const d = new Date();
  if (range === "14d") d.setDate(d.getDate() - 14);
  else if (range === "30d") d.setDate(d.getDate() - 30);
  else if (range === "3m") d.setMonth(d.getMonth() - 3);
  else if (range === "1y") d.setFullYear(d.getFullYear() - 1);
  else return "0000-00-00";
  return d.toISOString().split("T")[0];
};
