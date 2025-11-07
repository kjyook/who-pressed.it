'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Vote {
  id: number;
  result: string;
  member: {
    id: number;
    name: string;
    party: string;
    district: string;
  };
}

interface Bill {
  id: number;
  billNumber: string;
  billName: string;
  proposer: string | null;
  voteDate: string;
  isPassed: boolean;
  favorCount: number | null;
  againstCount: number | null;
  abstainCount: number | null;
  absentCount: number | null;
  votes: Vote[];
}

interface BillStats {
  favor: number;
  against: number;
  abstain: number;
  absent: number;
}

const VOTES_PER_PAGE = 50;

export default function BillDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [bill, setBill] = useState<Bill | null>(null);
  const [allVotes, setAllVotes] = useState<Vote[]>([]);
  const [stats, setStats] = useState<BillStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [votesLoading, setVotesLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'FAVOR' | 'AGAINST' | 'ABSTAIN' | 'ABSENT'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [previousLength, setPreviousLength] = useState(0);
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set());
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef(false);

  // 안건 기본 정보 로드
  useEffect(() => {
    const fetchBill = async () => {
      try {
        // 새로운 안건이면 모든 상태 초기화
        setAllVotes([]);
        setLoadedPages(new Set());
        setCurrentPage(1);
        setPreviousLength(0);
        setHasMore(true);

        const response = await fetch(`/api/bills/${params.id}`);
        const data = await response.json();
        setBill(data.bill);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch bill:', error);
        setLoading(false);
      }
    };

    if (params.id) {
      fetchBill();
    }
  }, [params.id]);

  // 표결 데이터 페이지별 로드
  const fetchVotesPage = useCallback(async (page: number) => {
    // 이미 로드 중이거나 이미 로드한 페이지면 중단
    if (isFetchingRef.current) {
      console.log(`Already fetching, skipping page ${page}`);
      return;
    }

    if (loadedPages.has(page)) {
      console.log(`Page ${page} already loaded, skipping`);
      return;
    }

    console.log(`Fetching page ${page}...`);
    isFetchingRef.current = true;
    setVotesLoading(true);

    try {
      const response = await fetch(
        `/api/bills/${params.id}/votes?page=${page}&pageSize=${VOTES_PER_PAGE}`
      );
      const data = await response.json();

      if (data.bill && data.bill.votes) {
        // 이전 길이 저장 (애니메이션 용도)
        setAllVotes((prev) => {
          setPreviousLength(prev.length);
          return [...prev, ...data.bill.votes];
        });
        setStats(data.stats);
        setHasMore(data.pagination.hasMore);
        setLoadedPages((prev) => new Set([...prev, page]));
        console.log(`Successfully loaded page ${page}, total votes: ${data.bill.votes.length}`);
      }
    } catch (error) {
      console.error('Failed to fetch votes:', error);
    } finally {
      setVotesLoading(false);
      isFetchingRef.current = false;
    }
  }, [params.id, loadedPages]);

  // 초기 표결 데이터 로드
  useEffect(() => {
    if (bill && allVotes.length === 0) {
      fetchVotesPage(1);
    }
  }, [bill]);

  // 다음 페이지 로드
  const loadMoreVotes = useCallback(() => {
    if (hasMore && !votesLoading) {
      setCurrentPage((prev) => {
        const nextPage = prev + 1;
        fetchVotesPage(nextPage);
        return nextPage;
      });
    }
  }, [hasMore, votesLoading, fetchVotesPage]);

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreVotes();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [loadMoreVotes]);

  // 필터 변경 시 previousLength 초기화
  useEffect(() => {
    setPreviousLength(0);
    // 필터 변경 시에는 loadedPages 초기화 안함 (데이터는 이미 로드됨)
  }, [filter]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">로딩 중...</div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">안건 정보를 찾을 수 없습니다.</div>
      </div>
    );
  }

  const filteredVotes = filter === 'all'
    ? allVotes
    : allVotes.filter(vote => vote.result === filter);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <button
          onClick={() => router.push('/')}
          className="mb-6 text-blue-600 hover:text-blue-800 dark:text-blue-400 flex items-center gap-2"
        >
          ← 홈으로 돌아가기
        </button>

        {/* Bill Info Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8">
          <div className="mb-4">
            <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-sm font-semibold mb-2">
              의안번호: {bill.billNumber}
            </span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {bill.billName}
          </h1>

          <div className="space-y-2 text-lg">
            {bill.proposer && (
              <p>
                <span className="font-semibold">제안자:</span> {bill.proposer}
              </p>
            )}
            <p>
              <span className="font-semibold">표결일:</span>{' '}
              {new Date(bill.voteDate).toLocaleDateString('ko-KR')}
            </p>
            <p>
              <span className="font-semibold">의결결과:</span>{' '}
              <span className={bill.isPassed ? 'text-green-600' : 'text-red-600'}>
                {bill.isPassed ? '가결' : '부결'}
              </span>
            </p>
          </div>
        </div>

        {/* Vote Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-green-100 dark:bg-green-900 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-green-700 dark:text-green-300">
              {bill.favorCount || stats?.favor || 0}
            </div>
            <div className="text-sm text-green-600 dark:text-green-400 mt-2">찬성</div>
          </div>
          <div className="bg-red-100 dark:bg-red-900 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-red-700 dark:text-red-300">
              {bill.againstCount || stats?.against || 0}
            </div>
            <div className="text-sm text-red-600 dark:text-red-400 mt-2">반대</div>
          </div>
          <div className="bg-yellow-100 dark:bg-yellow-900 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-yellow-700 dark:text-yellow-300">
              {bill.abstainCount || stats?.abstain || 0}
            </div>
            <div className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">기권</div>
          </div>
          <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-gray-700 dark:text-gray-300">
              {bill.absentCount || stats?.absent || 0}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">불참</div>
          </div>
        </div>

        {/* Votes List */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {/* 초기 로딩 메시지 */}
          {votesLoading && allVotes.length === 0 && (
            <div className="mb-6 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <div>
                  <p className="text-blue-800 dark:text-blue-200 font-semibold">
                    모든 표결 데이터를 불러오는 중...
                  </p>
                  <p className="text-sm text-blue-600 dark:text-blue-300">
                    최대 500명의 의원 표결 정보를 한번에 가져옵니다. 완료되면 50명씩 표시됩니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 데이터 없음 */}
          {!votesLoading && allVotes.length === 0 && !hasMore && (
            <div className="mb-6 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <svg
                  className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="flex-1">
                  <h3 className="text-yellow-900 dark:text-yellow-100 font-bold text-lg mb-2">
                    표결 데이터 없음
                  </h3>
                  <p className="text-yellow-800 dark:text-yellow-200 mb-3">
                    이 안건에 대한 표결 데이터가 없습니다. 다음 중 하나의 사유일 수 있습니다:
                  </p>
                  <ul className="list-disc list-inside text-yellow-800 dark:text-yellow-200 space-y-1 ml-2">
                    <li>본회의 표결을 거치지 않음 (위원회 심사 단계)</li>
                    <li>합의 처리 또는 무기명 표결</li>
                    <li>표결 데이터가 아직 Open API에 등록되지 않음</li>
                    <li>폐기되거나 철회된 안건</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* 필터 및 제목 - 표결 데이터가 있을 때만 표시 */}
          {(allVotes.length > 0 || votesLoading) && (
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                의원별 표결 내역
                {stats && (
                  <span className="text-gray-600 dark:text-gray-400 ml-2">
                    (현재 {allVotes.length}명 로드됨)
                  </span>
                )}
              </h2>

              {/* Filter Buttons */}
              <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                전체
              </button>
              <button
                onClick={() => setFilter('FAVOR')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  filter === 'FAVOR'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                찬성
              </button>
              <button
                onClick={() => setFilter('AGAINST')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  filter === 'AGAINST'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                반대
              </button>
              <button
                onClick={() => setFilter('ABSTAIN')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  filter === 'ABSTAIN'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                기권
              </button>
              <button
                onClick={() => setFilter('ABSENT')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  filter === 'ABSENT'
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                불참
              </button>
            </div>
            </div>
          )}

          {/* 초기 로딩 스켈레톤 */}
          {votesLoading && allVotes.length === 0 ? (
            <div className="text-center py-12">
              <div className="animate-pulse space-y-4">
                <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
          ) : filteredVotes.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-8">
              표결 내역이 없습니다.
            </p>
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredVotes.map((vote, index) => {
                  const isNewItem = index >= previousLength;
                  const animationDelay = isNewItem ? `${(index - previousLength) * 0.02}s` : '0s';

                  return (
                    <button
                      key={vote.id}
                      onClick={() => router.push(`/members/${vote.member.id}`)}
                      className={`border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all text-left ${isNewItem ? 'animate-fadeIn' : ''}`}
                      style={isNewItem ? { animationDelay } : undefined}
                    >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 dark:text-white mb-1">
                        {vote.member.name}
                      </h3>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <div className="text-blue-600 dark:text-blue-400 font-semibold">
                          {vote.member.party}
                        </div>
                        <div>{vote.member.district}</div>
                      </div>
                    </div>
                    <div
                      className={`px-3 py-1 rounded-lg font-semibold text-sm ${
                        vote.result === 'FAVOR'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : vote.result === 'AGAINST'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                          : vote.result === 'ABSTAIN'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {vote.result === 'FAVOR'
                        ? '찬성'
                        : vote.result === 'AGAINST'
                        ? '반대'
                        : vote.result === 'ABSTAIN'
                        ? '기권'
                        : '불참'}
                    </div>
                  </div>
                </button>
                  );
                })}
            </div>

            {/* Infinite Scroll Trigger - 보이지 않는 감지 영역 */}
            {hasMore && !votesLoading && (
              <div ref={loadMoreRef} className="h-10" />
            )}

            {/* 완료 메시지 */}
            {!hasMore && allVotes.length > 0 && (
              <p className="py-8 text-center text-gray-600 dark:text-gray-400">
                모든 의원의 표결 내역을 표시했습니다. (총 {allVotes.length}명)
              </p>
            )}
          </>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
}
