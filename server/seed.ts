import { db } from "./db";
import { categories } from "@shared/schema";

const initialCategories = [
  {
    name: "Handmade Jewelry",
    nameAr: "مجوهرات يدوية",
    slug: "jewelry",
    description: "Unique handcrafted jewelry pieces",
    icon: "Gem",
  },
  {
    name: "Pottery & Ceramics",
    nameAr: "فخار وسيراميك",
    slug: "pottery",
    description: "Traditional Lebanese pottery and ceramic art",
    icon: "UtensilsCrossed",
  },
  {
    name: "Textiles & Weaving",
    nameAr: "منسوجات ونسيج",
    slug: "textiles",
    description: "Hand-woven textiles and fabrics",
    icon: "Shirt",
  },
  {
    name: "Home Decor",
    nameAr: "ديكور منزلي",
    slug: "home-decor",
    description: "Handmade decorative items for the home",
    icon: "Home",
  },
  {
    name: "Art & Paintings",
    nameAr: "فن ولوحات",
    slug: "art",
    description: "Original artwork and paintings",
    icon: "Palette",
  },
  {
    name: "Leather Goods",
    nameAr: "منتجات جلدية",
    slug: "leather",
    description: "Handcrafted leather products",
    icon: "Briefcase",
  },
  {
    name: "Woodwork",
    nameAr: "أعمال خشبية",
    slug: "woodwork",
    description: "Traditional wood crafts and furniture",
    icon: "TreePine",
  },
  {
    name: "Glass Art",
    nameAr: "فن الزجاج",
    slug: "glass-art",
    description: "Handblown and stained glass art",
    icon: "Wine",
  },
];

export async function seedDatabase() {
  try {
    // Check if categories already exist
    const existingCategories = await db.select().from(categories);
    
    if (existingCategories.length === 0) {
      console.log("Seeding categories...");
      await db.insert(categories).values(initialCategories);
      console.log("Categories seeded successfully!");
    } else {
      console.log("Categories already exist, skipping seed.");
    }
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

