"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchBooks } from "../utils/fetchBooks";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../utils/firebase";
import {
  HeartIcon as HeartOutline,
} from "@heroicons/react/24/outline";
import {
  HeartIcon as HeartSolid,
} from "@heroicons/react/24/solid";

export type Book = {
  title: string;
  authors: string[];
  thumbnail: string;
  publisher?: string;
  contents?: string;
  isbn: string;
};

type BookSearchProps = {
  onBookSelect: (book: Book) => void;
};

type RatingInfo = { avg: number | null; count: number };

export default function BookSearch({ onBookSelect }: BookSearchProps) {
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);

  const [uid, setUid] = useState<string | null>(null);
  const [favs, setFavs] = useState<Set<string>>(new Set());

  // isbn -> {avg, count}
  const [ratings, setRatings] = useState<Record<string, RatingInfo>>({});

  // 로그인된 UID 구독
  useEffect(() => {
    return onAuthStateChanged(getAuth(), (user) => {
      setUid(user?.uid ?? null);
    });
  }, []);

  // 즐겨찾기 목록 불러오기
  useEffect(() => {
    if (!uid) return;
    (async () => {
      const snap = await getDocs(collection(db, "users", uid, "favorites"));
      setFavs(new Set(snap.docs.map((d) => d.id)));
    })();
  }, [uid]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const result = await fetchBooks(query);
      setBooks(result);
      // 결과에 대한 평균 별점 동시 로딩
      const entries = await Promise.all(
        result.map(async (b) => {
          try {
            const ref = collection(db, "books", b.isbn, "reviews");
            const snap = await getDocs(ref);
            if (snap.empty) return [b.isbn, { avg: null, count: 0 }] as const;
            let total = 0;
            let cnt = 0;
            snap.docs.forEach((d) => {
              const r = d.data()?.rating;
              if (typeof r === "number" && r > 0) {
                total += r;
                cnt += 1;
              }
            });
            return [b.isbn, { avg: cnt > 0 ? total / cnt : null, count: cnt }] as const;
          } catch {
            return [b.isbn, { avg: null, count: 0 }] as const;
          }
        })
      );
      setRatings(Object.fromEntries(entries));
    } catch {
      alert("검색에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 즐겨찾기 토글
  const toggleFav = async (isbn: string) => {
    if (!uid) return alert("로그인 후 이용하세요");
    const favRef = doc(db, "users", uid, "favorites", isbn);
    if (favs.has(isbn)) {
      await deleteDoc(favRef);
      setFavs((prev) => {
        const next = new Set(prev);
        next.delete(isbn);
        return next;
      });
    } else {
      await setDoc(favRef, {});
      setFavs((prev) => new Set(prev).add(isbn));
    }
  };

  // ⭐ 읽기 전용 별
  const Star = ({ filled }: { filled: boolean }) => (
    <svg
      viewBox="0 0 20 20"
      className={`w-4 h-4 ${filled ? "text-yellow-400" : "text-gray-300"}`}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.1 3.385a1 1 0 00.95.69h3.556c.969 0 1.371 1.24.588 1.81l-2.876 2.09a1 1 0 00-.364 1.118l1.1 3.386c.3.92-.755 1.688-1.54 1.118l-2.876-2.09a1 1 0 00-1.176 0l-2.876 2.09c-.785.57-1.84-.198-1.54-1.118l1.1-3.386a1 1 0 00-.364-1.118L2.755 8.812c-.783-.57-.38-1.81.588-1.81h3.556a1 1 0 00.95-.69l1.2-3.385z"/>
    </svg>
  );

  const RatingRow = ({ isbn }: { isbn: string }) => {
    const info = ratings[isbn];
    if (!info) return null;
    if (!info.count || info.avg == null) {
      return <span className="text-xs text-gray-400">감상평이 없습니다</span>;
    }
    const full = Math.round(info.avg);
    return (
      <div className="flex items-center gap-1">
        {[1,2,3,4,5].map(n => <Star key={n} filled={n <= full} />)}
        <span className="ml-1 text-xs text-gray-600">
          {info.avg.toFixed(1)} ({info.count})
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6 w-full">
      {/* 검색 입력창 */}
      <div className="flex gap-4 w-full">
        <input
          type="text"
          placeholder="책 제목을 검색하세요"
          className="border px-5 py-3 h-12 text-base rounded w-full focus:outline-none focus:ring-2 focus:ring-yellow-300"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
        />
        <button
          onClick={handleSearch}
          className="flex items-center justify-center gap-1 bg-yellow-400 hover:bg-yellow-500 text-white px-6 py-3 rounded shadow text-base whitespace-nowrap min-w-[90px] h-12"
        >
          🔍 검색
        </button>
      </div>

      {/* 검색 결과 리스트 */}
      {(books.length > 0 || loading) && (
        <div className="bg-white border rounded-xl shadow max-h-[300px] overflow-y-auto w-full">
          {loading && (
            <p className="p-4 text-sm text-gray-400">🔍 검색 중...</p>
          )}

          <ul className="divide-y">
            {books.map((book) => (
              <li
                key={book.isbn}
                className="flex items-center gap-4 p-4 hover:bg-gray-50"
              >
                {/* 책 정보 클릭 시 선택 */}
                <div
                  className="flex-1 flex items-start gap-4 cursor-pointer"
                  onClick={() => onBookSelect(book)}
                >
                  <img
                    src={book.thumbnail || "/no-image.png"}
                    alt={book.title}
                    className="w-16 h-24 object-cover rounded shadow"
                  />
                  <div className="space-y-1">
                    <p className="font-semibold text-gray-800 line-clamp-2">
                      {book.title}
                    </p>
                    <p className="text-sm text-gray-600">
                      {book.authors.join(", ")}
                    </p>
                    <p className="text-xs text-gray-400">{book.publisher}</p>

                    {/* ⭐ 평균 별점 (읽기 전용) */}
                    <RatingRow isbn={book.isbn} />
                  </div>a
                </div>

                {/* 즐겨찾기 버튼 */}
                <button
                  onClick={() => toggleFav(book.isbn)}
                  className="p-1 text-red-500"
                  aria-label="즐겨찾기 토글"
                >
                  {favs.has(book.isbn) ? (
                    <HeartSolid className="w-6 h-6 fill-current" />
                  ) : (
                    <HeartOutline className="w-6 h-6 stroke-current" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
