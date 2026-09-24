import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Use o formulário de ativação de convite para cadastrar o WhatsApp e a senha." }, { status: 410 });
}
