import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchMembers } from '@/lib/assembly-api';

// 국회의원 목록 조회 (검색)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name');
    const party = searchParams.get('party');

    // 1. DB에서 먼저 검색
    let members = await prisma.assemblyMember.findMany({
      where: {
        ...(name && { name: { contains: name } }),
        ...(party && { party }),
      },
      take: 20,
      orderBy: { name: 'asc' },
    });

    // 2. DB에 없으면 외부 API 호출
    if (members.length === 0 && (name || party)) {
      try {
        const apiData = await fetchMembers({
          name: name || undefined,
          party: party || undefined
        });

        console.log('API Response:', JSON.stringify(apiData, null, 2));

        // API 응답 파싱
        const responseKey = Object.keys(apiData)[0];
        const responseData = apiData[responseKey];
        const rowData = responseData.find((item: any) => item.row);

        if (rowData && rowData.row && rowData.row.length > 0) {
          // DB에 저장
          for (const memberData of rowData.row) {
            const savedMember = await prisma.assemblyMember.upsert({
              where: { memberId: memberData.MONA_CD },
              create: {
                memberId: memberData.MONA_CD,
                name: memberData.HG_NM,
                engName: memberData.ENG_NM || null,
                party: memberData.POLY_NM,
                district: memberData.ORIG_NM,
                committee: memberData.CMIT_NM || null,
                termNumber: parseInt(memberData.UNITS.replace(/\D/g, '')) || 22,
                reelection: memberData.REELE_GBN_NM !== '초선',
                profileUrl: memberData.HOMEPAGE || null,
              },
              update: {
                name: memberData.HG_NM,
                engName: memberData.ENG_NM || null,
                party: memberData.POLY_NM,
                district: memberData.ORIG_NM,
                committee: memberData.CMIT_NM || null,
                termNumber: parseInt(memberData.UNITS.replace(/\D/g, '')) || 22,
                reelection: memberData.REELE_GBN_NM !== '초선',
                profileUrl: memberData.HOMEPAGE || null,
              },
            });

            members.push(savedMember);
          }

          console.log(`Saved ${members.length} members to DB`);
        }
      } catch (error) {
        console.error('External API error:', error);
      }
    }

    return NextResponse.json({ members });
  } catch (error) {
    console.error('Error fetching members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    );
  }
}
