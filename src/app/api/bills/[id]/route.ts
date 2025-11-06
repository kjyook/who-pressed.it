import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 안건 기본 정보만 조회 (빠른 로딩)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const bill = await prisma.bill.findUnique({
      where: { id: parseInt(id) },
      include: {
        votes: {
          include: {
            member: true,
          },
          orderBy: {
            member: {
              name: 'asc',
            },
          },
        },
      },
    });

    if (!bill) {
      return NextResponse.json(
        { error: 'Bill not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ bill });
  } catch (error) {
    console.error('Error fetching bill:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bill' },
      { status: 500 }
    );
  }
}
