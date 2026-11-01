import { NextResponse } from "next/server";
import { seedDemo } from "@/lib/seed-demo";
import { seedGeneralExam } from "@/lib/seed-general";
import { getLevels } from "@/lib/config";

// Hanya untuk dev (DB in-memory tidak bisa diisi dari proses lain). Mati total di production.
export async function POST() {
  if (process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });
  await getLevels(); // pastikan level bawaan ada
  const result = { ...(await seedDemo()), ...(await seedGeneralExam()) };
  return NextResponse.json(result);
}
