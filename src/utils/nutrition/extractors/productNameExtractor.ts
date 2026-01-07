import { z } from "zod";
import { CleanProductNameSchema } from "../schemas.ts";

/**
 * Heuristic to clean up a product name from a page title or H1.
 *
 * Goal: Extract the core product name (e.g., "Oatly Barista") from noisy web titles (e.g., "Buy Oatly Barista 1L at Best Price").
 * Constraints: Heuristic-based; relies on common patterns in e-commerce titles.
 * Dependencies: Zod for validation.
 *
 * @param title - The page title tag.
 * @param h1 - The main H1 heading (optional).
 * @returns Cleaned product name string.
 */
export const cleanProductName = (title: string, h1?: string): string => {
    // 1. Validate Input
    const input = CleanProductNameSchema.parse({ title, h1 });

    // If title is generic, prioritize H1
    const genericTitles = ['startsida', 'home', 'login', 'produkter', 'varukorg'];
    const lowerTitle = (input.title || '').toLowerCase();

    let base = input.title;
    if (input.h1 && (genericTitles.some(g => lowerTitle.includes(g)) || !input.title)) {
        base = input.h1;
    }

    if (!base) return '';

    // Remove common site suffixes
    let name = base.split(/[|•\-–—]| - /)[0].trim();

    // Remove "Handla", "Köp", "Price" etc if they are at the start
    name = name.replace(/^(Handla|Köp|Pris på|Varuinformation för|Se priset på)\s+/i, '');

    // SMART FEATURE: Remove weight suffixes like "275g" or "1kg" from the name if they exist
    name = name.replace(/\s*\d+\s*(g|kg|ml|l|cl)\b/i, '').trim();

    return name;
};
