import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Persist only minimal fields required to reference a service
function toDb(p: any, userId: string) {
  return {
    user_id: userId,
    id: p.id,
    type: p.type,
    location: p.location, // station name for filtering in details
    location_code: p.locationCode, // station CRS code
    completed: !!p.completed,
    created_at_ms: p.createdAt,
    origin: p.origin ?? null,
    platform: p.platform ?? null,
    operator: p.operator ?? null,
  }
}

function fromDb(r: any) {
  return {
    id: r.id,
    type: r.type,
    location: r.location,
    locationCode: r.location_code,
    completed: r.completed,
    createdAt: r.created_at_ms,
    origin: r.origin ?? undefined,
    platform: r.platform ?? undefined,
    operator: r.operator ?? undefined,
  }
}

function toDbPatch(p: any) {
  const patch: Record<string, any> = {}
  if (p.completed !== undefined) patch.completed = p.completed
  return patch
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data, error } = await supabase
      .from("pickups")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at_ms", { ascending: true })

    if (error) throw error

    const pickups = (data || []).map(fromDb)
    return NextResponse.json({ data: pickups })
  } catch (err) {
    console.error("GET /api/pickups failed", err)
    return NextResponse.json({ error: "Failed to fetch pickups" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    // Basic validation for minimal payload
    if (!body || !body.id || !body.location || !body.locationCode || !body.type || !body.createdAt) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    // Check for active pickups limit
    const { data: activePickups, error: countError } = await supabase
      .from("pickups")
      .select("id", { count: 'exact' })
      .eq("user_id", user.id)
      .eq("completed", false)

    if (countError) throw countError

    if ((activePickups?.length ?? 0) >= 3) {
      return NextResponse.json(
        { error: "You have reached the maximum limit of 3 active pickups" },
        { status: 403 }
      )
    }

    const row = toDb(body, user.id)
    const { data, error } = await supabase
      .from("pickups")
      .insert(row)
      .select("*")
      .limit(1)
      .single()

    if (error) {
      if ((error as any).code === "23505") {
        // Unique violation
        return NextResponse.json({ error: "Pickup already exists" }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ data: fromDb(data) }, { status: 201 })
  } catch (err) {
    console.error("POST /api/pickups failed", err)
    return NextResponse.json({ error: "Failed to create pickup" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const body = await request.json()
    const serviceId = searchParams.get("id")
    const patch = toDbPatch(body)
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Empty patch" }, { status: 400 })

    const { data, error } = await supabase
      .from("pickups")
      .update(patch)
      .eq("user_id", user.id)
      .eq("id", serviceId)
      .select("*")
      .single()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (err) {
    console.error("PATCH /api/pickups?id failed", err)
    return NextResponse.json({ error: "Failed to update pickup" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const serviceId = searchParams.get("id")

    const { error } = await supabase
      .from("pickups")
      .delete()
      .eq("user_id", user.id)
      .eq("id", serviceId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("DELETE /api/pickups?id failed", err)
    return NextResponse.json({ error: "Failed to delete pickup" }, { status: 500 })
  }
}