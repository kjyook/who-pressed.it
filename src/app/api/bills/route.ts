import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchBills } from '@/lib/assembly-api';

// 안건 목록 조회 (검색)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const title = searchParams.get('title');
    const billNo = searchParams.get('billNo');
    const proposer = searchParams.get('proposer');

    // 1. DB에서 먼저 검색
    let bills = await prisma.bill.findMany({
      where: {
        ...(title && { billName: { contains: title } }),
        ...(billNo && { billNumber: billNo }),
        ...(proposer && { proposer: { contains: proposer } }),
      },
      take: 100,
      orderBy: { voteDate: 'desc' },
    });

    // 2. DB에 결과가 부족하면 외부 API 호출
    if (bills.length < 10 && (title || billNo || proposer)) {
      try {
        const apiData = await fetchBills({
          billName: title || undefined,
          billNo: billNo || undefined,
          proposer: proposer || undefined,
          age: '22',
          pSize: 100,
        });

        console.log('Bill API Response:', JSON.stringify(apiData, null, 2));

        // API 응답 파싱
        const responseKey = Object.keys(apiData)[0];
        const responseData = apiData[responseKey];
        const rowData = responseData.find((item: any) => item.row);

        if (rowData && rowData.row && rowData.row.length > 0) {
          // DB에 저장
          for (const billData of rowData.row) {
            const savedBill = await prisma.bill.upsert({
              where: { billId: billData.BILL_ID },
              create: {
                billId: billData.BILL_ID,
                billNumber: billData.BILL_NO,
                billName: billData.BILL_NM,
                proposer: billData.PROPOSER || null,
                voteDate: billData.RGS_PROC_DT
                  ? new Date(billData.RGS_PROC_DT.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'))
                  : new Date(),
                isPassed: billData.PROC_RESULT_CD?.includes('가결') || false,
                favorCount: parseInt(billData.YES_TCNT) || null,
                againstCount: parseInt(billData.NO_TCNT) || null,
                abstainCount: parseInt(billData.BLANK_TCNT) || null,
                absentCount: null,
              },
              update: {
                billNumber: billData.BILL_NO,
                billName: billData.BILL_NM,
                proposer: billData.PROPOSER || null,
                voteDate: billData.RGS_PROC_DT
                  ? new Date(billData.RGS_PROC_DT.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'))
                  : new Date(),
                isPassed: billData.PROC_RESULT_CD?.includes('가결') || false,
                favorCount: parseInt(billData.YES_TCNT) || null,
                againstCount: parseInt(billData.NO_TCNT) || null,
                abstainCount: parseInt(billData.BLANK_TCNT) || null,
              },
            });

            bills.push(savedBill);
          }

          console.log(`Saved ${bills.length} bills to DB`);
        }
      } catch (error) {
        console.error('External API error:', error);
      }
    }

    return NextResponse.json({ bills });
  } catch (error) {
    console.error('Error fetching bills:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bills' },
      { status: 500 }
    );
  }
}
