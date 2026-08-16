import { NextResponse } from 'next/server';
import { getSparksMultipliersData } from '@/modules/sparks/multiplierActions';

export async function GET() {
  try {
    const data = await getSparksMultipliersData();
    return NextResponse.json({ success: true, ...data });
  } catch {
    return NextResponse.json({
      success: true,
      designMultiplier: 1.0,
      videoMultiplier: 1.0,
      customTaskMultipliersCount: 0,
      activeMultiplierTasks: [],
    });
  }
}
