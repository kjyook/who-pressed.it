import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchVoteRecords } from '@/lib/assembly-api';

const VOTES_PER_PAGE = 50;

// 특정 안건에 대한 표결 결과 조회 (어떤 의원이 어떻게 투표했는지)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || String(VOTES_PER_PAGE));

    // 1. DB에서 안건과 표결 결과 조회
    let bill = await prisma.bill.findUnique({
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

    // 2. DB에 표결 데이터가 없으면 API 호출 (한번에 모두 가져오기)
    // DB에 이미 데이터가 있으면 API는 호출하지 않음
    if (bill.votes.length === 0) {
      try {
        // Open API는 BILL_ID로 조회 시 pIndex가 작동하지 않고 모든 데이터를 반환
        // 따라서 한 번에 모두 가져옴 (pSize 500)
        const apiData = await fetchVoteRecords({
          billId: bill.billId,
          pIndex: 1,
          pSize: 500,
        });

        console.log(`Bill votes API request: fetching all data for bill ${bill.billId}`);

        // API 응답 확인 (타입 단언 사용)
        const apiResponse = apiData as any;
        if (apiResponse.RESULT) {
          console.log(`No vote data from API: ${apiResponse.RESULT.MESSAGE}`);
          // 데이터가 없으면 그냥 종료
        } else {
          // API 응답 파싱
          const responseKey = Object.keys(apiData)[0];
          const responseData = apiData[responseKey];

          // responseData가 배열인지 확인
          if (!Array.isArray(responseData)) {
            console.log('Unexpected API response format:', responseData);
            return;
          }

          const rowData = responseData.find((item: any) => item.row);

          if (rowData && rowData.row && rowData.row.length > 0) {
            console.log(`API returned ${rowData.row.length} vote records`);
            // 의원별 표결 데이터 저장 (배치 처리)
            const voteRecords = [];

          for (const voteData of rowData.row) {
            // 의원 정보 먼저 확인/저장
            const member = await prisma.assemblyMember.upsert({
              where: { memberId: voteData.MONA_CD },
              create: {
                memberId: voteData.MONA_CD,
                name: voteData.HG_NM,
                engName: null,
                party: voteData.POLY_NM,
                district: voteData.ORIG_NM,
                committee: null,
                termNumber: parseInt(voteData.AGE) || 22,
                reelection: false,
                profileUrl: null,
              },
              update: {
                name: voteData.HG_NM,
                party: voteData.POLY_NM,
                district: voteData.ORIG_NM,
              },
            });

            // 표결 결과 매핑
            let voteResult: 'FAVOR' | 'AGAINST' | 'ABSTAIN' | 'ABSENT';
            const resultStr = voteData.RESULT_VOTE_MOD?.trim();

            if (resultStr === '찬성' || resultStr === '가') {
              voteResult = 'FAVOR';
            } else if (resultStr === '반대' || resultStr === '부') {
              voteResult = 'AGAINST';
            } else if (resultStr === '기권') {
              voteResult = 'ABSTAIN';
            } else {
              voteResult = 'ABSENT';
            }

            voteRecords.push({
              memberId: member.id,
              billId: bill.id,
              result: voteResult,
            });
          }

          // 배치로 표결 정보 저장
          for (const voteRecord of voteRecords) {
            await prisma.vote.upsert({
              where: {
                memberId_billId: {
                  memberId: voteRecord.memberId,
                  billId: voteRecord.billId,
                },
              },
              create: voteRecord,
              update: {
                result: voteRecord.result,
              },
            });
          }

            console.log(`Saved ${rowData.row.length} vote records for bill ${bill.id}`);

            // 표결 정보 다시 조회
            const updatedBill = await prisma.bill.findUnique({
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

            if (updatedBill) {
              bill = updatedBill;
            }
          } else {
            // API가 빈 데이터를 반환
            console.log('API returned no vote records');
          }
        }
      } catch (error) {
        console.error('External API error:', error);
      }
    }

    // 3. 표결 결과 통계 계산 (전체 데이터 기준)
    const voteStats = bill.votes.reduce(
      (acc, vote) => {
        acc[vote.result.toLowerCase()]++;
        return acc;
      },
      { favor: 0, against: 0, abstain: 0, absent: 0 } as Record<string, number>
    );

    // 4. 페이지네이션된 응답 반환 (DB에서만 처리)
    const totalVotes = bill.votes.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedVotes = bill.votes.slice(startIndex, endIndex);

    // hasMore 판단: DB에 더 많은 데이터가 있는지만 확인
    const hasMore = endIndex < totalVotes;

    console.log(`Pagination: page=${page}, totalVotes=${totalVotes}, returning ${paginatedVotes.length} votes, hasMore=${hasMore}`);

    return NextResponse.json({
      bill: {
        ...bill,
        votes: paginatedVotes,
      },
      stats: voteStats,
      pagination: {
        page,
        pageSize,
        total: totalVotes,
        hasMore,
      },
    });
  } catch (error) {
    console.error('Error fetching bill votes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bill votes' },
      { status: 500 }
    );
  }
}
