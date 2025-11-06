'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Vote {
  id: number;
  result: string;
  createdAt: string;
  bill: {
    id: number;
    billName: string;
    billNumber: string;
    voteDate: string;
    isPassed: boolean;
  };
}

interface Member {
  id: number;
  name: string;
  engName: string;
  party: string;
  district: string;
  committee: string;
  profileUrl: string | null;
  votes: Vote[];
}

interface VoteStats {
  FAVOR: number;
  AGAINST: number;
  ABSTAIN: number;
  ABSENT: number;
}

const VOTES_PER_PAGE = 50;

export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [allVotes, setAllVotes] = useState<Vote[]>([]);
  const [stats, setStats] = useState<VoteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [votesLoading, setVotesLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [previousLength, setPreviousLength] = useState(0);
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set());
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef(false);

  // 의원 기본 정보 로드
  useEffect(() => {
    const fetchMember = async () => {
      try {
        // 새로운 의원이면 모든 상태 초기화
        setAllVotes([]);
        setLoadedPages(new Set());
        setCurrentPage(1);
        setPreviousLength(0);
        setHasMore(true);

        const response = await fetch(`/api/members/${params.id}/votes`);
        const data = await response.json();
        setMember(data.member);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch member:', error);
        setLoading(false);
      }
    };

    if (params.id) {
      fetchMember();
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
        `/api/members/${params.id}/votes?page=${page}&pageSize=${VOTES_PER_PAGE}`
      );
      const data = await response.json();

      if (data.member && data.member.votes) {
        // 이전 길이 저장 (애니메이션 용도)
        setAllVotes((prev) => {
          setPreviousLength(prev.length);
          return [...prev, ...data.member.votes];
        });
        setStats(data.stats);
        setHasMore(data.pagination.hasMore);
        setLoadedPages((prev) => new Set([...prev, page]));
        console.log(`Successfully loaded page ${page}, total votes: ${data.member.votes.length}`);
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
    if (member && allVotes.length === 0) {
      fetchVotesPage(1);
    }
  }, [member]);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">로딩 중...</div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">의원 정보를 찾을 수 없습니다.</div>
      </div>
    );
  }

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

        {/* Member Info Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                {member.name}
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-4">
                {member.engName}
              </p>
              <div className="space-y-2">
                <p className="text-lg">
                  <span className="font-semibold">정당:</span>{' '}
                  <span className="text-blue-600 dark:text-blue-400">{member.party}</span>
                </p>
                <p className="text-lg">
                  <span className="font-semibold">선거구:</span> {member.district}
                </p>
                <p className="text-lg">
                  <span className="font-semibold">소속 위원회:</span>{' '}
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {member.committee}
                  </span>
                </p>
              </div>
              {member.profileUrl && (
                <a
                  href={member.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-4 text-blue-600 hover:text-blue-800 dark:text-blue-400"
                >
                  홈페이지 방문 →
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Vote Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-green-100 dark:bg-green-900 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-green-700 dark:text-green-300">
              {stats?.FAVOR || 0}
            </div>
            <div className="text-sm text-green-600 dark:text-green-400 mt-2">찬성</div>
          </div>
          <div className="bg-red-100 dark:bg-red-900 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-red-700 dark:text-red-300">
              {stats?.AGAINST || 0}
            </div>
            <div className="text-sm text-red-600 dark:text-red-400 mt-2">반대</div>
          </div>
          <div className="bg-yellow-100 dark:bg-yellow-900 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-yellow-700 dark:text-yellow-300">
              {stats?.ABSTAIN || 0}
            </div>
            <div className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">기권</div>
          </div>
          <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-gray-700 dark:text-gray-300">
              {stats?.ABSENT || 0}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">불참</div>
          </div>
        </div>

        {/* Vote History */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {/* 초기 로딩 메시지 */}
          {votesLoading && allVotes.length === 0 && (
            <div className="mb-6 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <div>
                  <p className="text-blue-800 dark:text-blue-200 font-semibold">
                    표결 데이터를 불러오는 중...
                  </p>
                  <p className="text-sm text-blue-600 dark:text-blue-300">
                    최근 20개 안건의 표결 정보를 가져옵니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 데이터 없음 */}
          {!votesLoading && allVotes.length === 0 && !hasMore && (
            <div className="mb-6 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
              <p className="text-yellow-800 dark:text-yellow-200">
                이 의원의 표결 데이터가 없습니다.
              </p>
            </div>
          )}

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            표결 내역
            {stats && (
              <span className="text-gray-600 dark:text-gray-400 ml-2">
                (현재 {allVotes.length}건 로드됨)
              </span>
            )}
          </h2>

          {/* 초기 로딩 스켈레톤 */}
          {votesLoading && allVotes.length === 0 ? (
            <div className="text-center py-12">
              <div className="animate-pulse space-y-4">
                <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
          ) : allVotes.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-8">
              표결 내역이 없습니다.
            </p>
          ) : (
            <>
              <div className="space-y-4">
                {allVotes.map((vote, index) => {
                  const isNewItem = index >= previousLength;
                  const animationDelay = isNewItem ? `${(index - previousLength) * 0.02}s` : '0s';

                  return (
                    <button
                      key={vote.id}
                      onClick={() => router.push(`/bills/${vote.bill.id}`)}
                      className={`w-full border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all text-left ${isNewItem ? 'animate-fadeIn' : ''}`}
                      style={isNewItem ? { animationDelay } : undefined}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                            {vote.bill.billName}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                            <span>의안번호: {vote.bill.billNumber}</span>
                            <span>•</span>
                            <span>
                              표결일:{' '}
                              {new Date(vote.bill.voteDate).toLocaleDateString('ko-KR')}
                            </span>
                            <span>•</span>
                            <span
                              className={
                                vote.bill.isPassed ? 'text-green-600' : 'text-red-600'
                              }
                            >
                              {vote.bill.isPassed ? '가결' : '부결'}
                            </span>
                          </div>
                        </div>
                        <div
                          className={`px-4 py-2 rounded-lg font-semibold ${
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
                  모든 표결 내역을 표시했습니다. (총 {allVotes.length}건)
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
