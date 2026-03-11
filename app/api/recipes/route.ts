import { getAllSavedRecipes, saveRecipe, deleteSavedRecipe } from "@/lib/analytics";

export async function GET() {
  const recipes = await getAllSavedRecipes();
  return Response.json({ recipes });
}

export async function POST(req: Request) {
  const body = await req.json();
  const id = await saveRecipe(body);
  return Response.json({ id });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
  await deleteSavedRecipe(id);
  return Response.json({ ok: true });
}
