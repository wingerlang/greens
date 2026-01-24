import { getSession } from "../db/session.ts";
import { recipeRepo } from "../repositories/recipeRepository.ts";
import { Recipe } from "../../models/types.ts";

export async function handleRecipeRoutes(
  req: Request,
  url: URL,
  headers: Headers,
): Promise<Response> {
  const method = req.method;
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return new Response(JSON.stringify({ error: "No token" }), {
      status: 401,
      headers,
    });
  }

  const session = await getSession(token);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers,
    });
  }

  const userId = session.userId;

  // GET /api/recipes (All)
  // GET /api/recipes/:id
  if (method === "GET") {
    const pathParts = url.pathname.split("/");
    const lastPart = pathParts[pathParts.length - 1];

    if (lastPart !== "recipes") {
      const id = lastPart;
      const recipe = await recipeRepo.getRecipe(userId, id);
      if (!recipe) {
        return new Response(JSON.stringify({ error: "Recipe not found" }), {
          status: 404,
          headers,
        });
      }
      return new Response(JSON.stringify(recipe), { headers });
    } else {
      const recipes = await recipeRepo.getRecipes(userId);
      return new Response(JSON.stringify({ recipes }), { headers });
    }
  }

  // POST /api/recipes (Create)
  if (method === "POST") {
    try {
      const recipe = await req.json() as Recipe;
      if (!recipe.id) {
        return new Response(JSON.stringify({ error: "ID required" }), {
          status: 400,
          headers,
        });
      }

      await recipeRepo.saveRecipe(userId, recipe);
      return new Response(JSON.stringify({ success: true, recipe }), {
        headers,
      });
    } catch (e) {
      console.error("Recipe create error:", e);
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers,
      });
    }
  }

  // PUT /api/recipes/:id (Update)
  if (method === "PUT") {
    try {
      const pathParts = url.pathname.split("/");
      const id = pathParts[pathParts.length - 1];
      const updates = await req.json() as Partial<Recipe>;

      const existing = await recipeRepo.getRecipe(userId, id);
      if (!existing) {
        return new Response(JSON.stringify({ error: "Recipe not found" }), {
          status: 404,
          headers,
        });
      }

      const updated = { ...existing, ...updates };
      await recipeRepo.saveRecipe(userId, updated);

      return new Response(JSON.stringify({ success: true, recipe: updated }), {
        headers,
      });
    } catch (e) {
      console.error("Recipe update error:", e);
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers,
      });
    }
  }

  // DELETE /api/recipes/:id
  if (method === "DELETE") {
    const pathParts = url.pathname.split("/");
    const id = pathParts[pathParts.length - 1];

    await recipeRepo.deleteRecipe(userId, id);
    return new Response(JSON.stringify({ success: true }), { headers });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers,
  });
}
