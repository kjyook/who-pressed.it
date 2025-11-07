'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Member {
  id: number;
  name: string;
  party: string;
  district: string;
}

interface Bill {
  id: number;
  billNumber: string;
  billName: string;
  proposer: string | null;
  voteDate: string;
  isPassed: boolean;
  _count?: {
    votes: number;
  };
}

export default function Home() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'member' | 'bill'>('member');
  const [memberResults, setMemberResults] = useState<Member[]>([]);
  const [billResults, setBillResults] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // 초기 데이터 로드
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setInitialLoading(true);
        if (searchType === 'member') {
          const response = await fetch('/api/members?limit=30');
          const data = await response.json();
          setMemberResults(data.members || []);
        } else {
          const response = await fetch('/api/bills?limit=30');
          const data = await response.json();
          setBillResults(data.bills || []);
        }
      } catch (error) {
        console.error('Failed to load initial data:', error);
      } finally {
        setInitialLoading(false);
      }
    };

    loadInitialData();
  }, [searchType]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      if (searchType === 'member') {
        const response = await fetch(
          `/api/members?name=${encodeURIComponent(searchQuery)}`
        );
        const data = await response.json();
        setMemberResults(data.members || []);
        setBillResults([]);
      } else {
        const response = await fetch(
          `/api/bills?title=${encodeURIComponent(searchQuery)}`
        );
        const data = await response.json();
        setBillResults(data.bills || []);
        setMemberResults([]);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <main className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Who Pressed It?
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            국회의원 표결 내역 검색 서비스
          </p>
        </div>

        {/* Search Section */}
        <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {/* Search Type Toggle */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => {
                setSearchType('member');
                setSearchQuery('');
              }}
              className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-colors ${
                searchType === 'member'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              국회의원 검색
            </button>
            <button
              onClick={() => {
                setSearchType('bill');
                setSearchQuery('');
              }}
              className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-colors ${
                searchType === 'bill'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              안건 검색
            </button>
          </div>

          {/* Search Input */}
          <div className="mb-6">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                searchType === 'member'
                  ? '국회의원 이름을 입력하세요 (예: 김성회)'
                  : '안건명을 입력하세요'
              }
              className="w-full px-6 py-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              disabled={loading}
            />
          </div>

          <button
            onClick={handleSearch}
            disabled={loading || !searchQuery.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-lg transition-colors"
          >
            {loading ? '검색 중...' : '검색하기'}
          </button>
        </div>

        {/* Member Results */}
        {searchType === 'member' && memberResults.length > 0 && (
          <div className="mt-8 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              {searchQuery ? `검색 결과 (${memberResults.length}명)` : `국회의원 (${memberResults.length}명)`}
            </h2>
            <div className="space-y-3">
              {memberResults.map((member) => (
                <button
                  key={member.id}
                  onClick={() => router.push(`/members/${member.id}`)}
                  className="w-full bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {member.name}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <span className="text-blue-600 dark:text-blue-400 font-semibold">
                          {member.party}
                        </span>
                        <span>•</span>
                        <span>{member.district}</span>
                      </div>
                    </div>
                    <span className="text-blue-600 dark:text-blue-400 text-xl">→</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bill Results */}
        {searchType === 'bill' && billResults.length > 0 && (
          <div className="mt-8 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              {searchQuery ? `검색 결과 (${billResults.length}건)` : `최근 안건 목록 (${billResults.length}건)`}
            </h2>
            <div className="space-y-3">
              {billResults.map((bill) => {
                const hasVotes = bill._count && bill._count.votes > 0;

                return (
                  <button
                    key={bill.id}
                    onClick={() => router.push(`/bills/${bill.id}`)}
                    className="w-full bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                            {bill.billName}
                          </h3>
                          {!hasVotes && (
                            <span className="px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded text-xs font-semibold">
                              표결없음
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <span>의안번호: {bill.billNumber}</span>
                          <span>•</span>
                          <span>
                            표결일: {new Date(bill.voteDate).toLocaleDateString('ko-KR')}
                          </span>
                          {bill.proposer && (
                            <>
                              <span>•</span>
                              <span>제안: {bill.proposer}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className="text-blue-600 dark:text-blue-400 text-xl">→</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 데이터 로딩 중 */}
        {initialLoading && (
          <div className="mt-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">데이터 로딩 중...</p>
          </div>
        )}

        {/* 검색 결과 없음 */}
        {!initialLoading && memberResults.length === 0 && billResults.length === 0 && searchQuery && !loading && (
          <div className="mt-8 text-center text-gray-600 dark:text-gray-400">
            검색 결과가 없습니다. 다른 검색어로 시도해보세요.
          </div>
        )}

        {/* Features */}
        <div className="mt-16 grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
              📊 의원별 표결 내역
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              국회의원을 검색하여 해당 의원이 표결한 모든 안건과 찬성/반대/기권 내역을 확인하세요.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
              🗳️ 안건별 표결 결과
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              특정 안건에 대해 어떤 국회의원들이 찬성/반대했는지 상세 정보를 확인하세요.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
