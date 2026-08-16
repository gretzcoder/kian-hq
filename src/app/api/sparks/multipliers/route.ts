import { NextResponse } from 'next/server';
import { getSparksMultipliersData } from '@/modules/sparks/multiplierActions';

export async function GET() {
  try {
    const data = await getSparksMultipliersData();
    return NextResponse.json({ success: true, ...data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
