import { NextResponse } from 'next/server';
import { getEnquiries, createEnquiry, updateEnquiryStatus } from '@/lib/server/enquiries';
import { httpResult, readBody } from '@/lib/server/http';

export async function GET(request: Request) {
  return httpResult(await getEnquiries(request.headers));
}

export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body.ok) return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  return httpResult(await createEnquiry(body.value, request.headers));
}

export async function PATCH(request: Request) {
  const body = await readBody(request);
  if (!body.ok) return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  return httpResult(await updateEnquiryStatus(body.value, request.headers));
}
