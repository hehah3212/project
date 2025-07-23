// src/app/components/BookSearch.tsx
"use client";

import { useState, useEffect } from "react";
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

export default function BookSearch({ onBookSelect }: BookSearchProps) {
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);

  const [uid, setUid] = useState<string | null>(null);
  const [favs, setFavs] = useState<Set<string>>(new Set());

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

  // 검색 실행
  const handleSearch = async () => {
    setLoading(true);
    try {
      const result = await fetchBooks(query);
      setBooks(result);
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
                  </div>
                </div>

                {/* 즐겨찾기 버튼 */}
                <button
                  onClick={() => toggleFav(book.isbn)}
                  className="p-1 text-red-500"
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
