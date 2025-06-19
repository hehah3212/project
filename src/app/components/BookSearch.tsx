"use client";

import { useState } from "react";
import { fetchBooks } from "../utils/fetchBooks";

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
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const result = await fetchBooks(query);
      setBooks(result);
    } catch (e) {
      alert("검색에 실패했습니다.");
    } finally {
      setLoading(false);
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
                className="flex gap-4 p-4 cursor-pointer hover:bg-gray-50"
                onClick={() =>
                  onBookSelect({
                    ...book,
                    isbn: book.isbn.split(" ")[0], // ✅ 공백 제거하고 첫 번째 ISBN만 사용
                  })
                }
              >
                <img
                  src={book.thumbnail || "/no-image.png"}
                  alt={book.title}
                  className="w-16 h-24 object-cover rounded shadow"
                />
                <div className="flex-1 space-y-1">
                  <p className="font-semibold text-gray-800 line-clamp-2">{book.title}</p>
                  <p className="text-sm text-gray-600">{book.authors.join(", ")}</p>
                  <p className="text-xs text-gray-400">{book.publisher}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
