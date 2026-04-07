import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // Small artificial delay to slow down automated brute-force tools
  await new Promise((resolve) => setTimeout(resolve, 300));

  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { username, password } = body;

  const validUsername = process.env.AUTH_USERNAME;
  const validPassword = process.env.AUTH_PASSWORD;
  const sessionToken = process.env.SESSION_TOKEN;

  if (!validUsername || !validPassword || !sessionToken) {
    console.error("Auth env vars not configured (AUTH_USERNAME, AUTH_PASSWORD, SESSION_TOKEN)");
    return NextResponse.json(
      { error: "Auth not configured" },
      { status: 500 }
    );
  }

  if (username !== validUsername || password !== validPassword) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set("session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });

  return response;
}
