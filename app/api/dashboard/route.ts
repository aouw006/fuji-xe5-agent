import { getDashboardData } from "@/lib/analytics";

export async function GET() {
  const data = await getDashboardData();
  if (!data) return Response.json({ error: "Failed to load dashboard data" }, { status: 500 });
  return Response.json(data);
}
