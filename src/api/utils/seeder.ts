import { parse } from "./deps/csv.ts";
import { foodRepo } from "../repositories/foodRepository.ts";
import { createUser, getUser } from "../db/user.ts";
import {
  DEFAULT_PRIVACY,
  DEFAULT_USER_SETTINGS,
  FoodItem,
} from "../../models/types.ts";

export async function ensureSeeded() {
  const seeded = await foodRepo.isSeeded();
  if (seeded) {
    console.log("✅ Database already seeded.");
    return;
  }

  console.log("🚀 Starting database seeding...");

  // 1. Seed Users
  const usersToCreate = [
    { username: "admin", role: "admin" as const },
    { username: "johannes", role: "user" as const },
    { username: "jonathan", role: "user" as const },
  ];

  for (const u of usersToCreate) {
    const existing = await getUser(u.username);
    if (!existing) {
      console.log(`👤 Creating user: ${u.username} (${u.role})`);
      const newUser = await createUser(u.username, "admin", undefined, u.role); // Default password is "admin"
      if (newUser) {
        // Update role since createUser defaults to 'user'
        // In a real app we'd have it in createUser params
        // For now, atomic update if needed, but let's just make it work
        // Actually, createUser in db/user.ts sets role: 'user'.
      }
    }
  }

  // 2. Seed Food Database
  try {
    const content = await Deno.readTextFile(
      "data/LivsmedelsDB_Cleaned_Vegan.csv",
    );
    const records = parse(content, {
      skipFirstRow: true,
      columns: [
        "Name",
        "Category",
        "Calories",
        "Protein",
        "Fat",
        "Carbs",
        "Fiber",
        "Sugar",
        "AddedSugar",
        "WholeGrains",
        "SaturatedFat",
        "MonounsaturatedFat",
        "PolyunsaturatedFat",
        "Cholesterol",
        "VitaminD",
        "VitaminB12",
        "Iron",
        "Zinc",
        "Calcium",
        "Omega3",
        "Omega6",
        "IsVegan",
      ],
    });

    let count = 0;
    const now = new Date().toISOString();
    for (const record of records) {
      const food: FoodItem = {
        id: `food_${encodeURIComponent(record.Name).toLowerCase()}`,
        name: record.Name,
        category: record.Category as any, // Should map to FoodCategory enum eventually
        calories: parseFloat(record.Calories) || 0,
        protein: parseFloat(record.Protein) || 0,
        fat: parseFloat(record.Fat) || 0,
        carbs: parseFloat(record.Carbs) || 0,
        fiber: parseFloat(record.Fiber) || 0,
        unit: "g",
        isCooked: false,
        iron: parseFloat(record.Iron) || 0,
        zinc: parseFloat(record.Zinc) || 0,
        calcium: parseFloat(record.Calcium) || 0,
        vitaminB12: parseFloat(record.VitaminB12) || 0,
        extendedDetails: {
          sugar: parseFloat(record.Sugar) || 0,
          addedSugar: parseFloat(record.AddedSugar) || 0,
          fiber: parseFloat(record.Fiber) || 0,
          wholeGrains: parseFloat(record.WholeGrains) || 0,
          saturatedFat: parseFloat(record.SaturatedFat) || 0,
          monounsaturatedFat: parseFloat(record.MonounsaturatedFat) || 0,
          polyunsaturatedFat: parseFloat(record.PolyunsaturatedFat) || 0,
          cholesterol: parseFloat(record.Cholesterol) || 0,
          omega3: parseFloat(record.Omega3) || 0,
          omega6: parseFloat(record.Omega6) || 0,
          vitaminD: parseFloat(record.VitaminD) || 0,
        },
        createdAt: now,
        updatedAt: now,
      };

      await foodRepo.saveFood(food);
      count++;
      if (count % 100 === 0) console.log(`🍎 Imported ${count} food items...`);
    }
    console.log(`✅ Imported ${count} food items.`);
  } catch (e) {
    console.error("❌ Error seeding food database:", e);
  }

  await foodRepo.markAsSeeded();
  console.log("🎉 Seeding complete!");
}
