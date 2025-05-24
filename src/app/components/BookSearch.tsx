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
    <div className="relative w-full">
      {/* 검색 입력창 */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="책 제목을 검색하세요"
          className="border px-3 py-2 rounded w-full"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSearch();
            }
          }}
        />
        <button
          onClick={handleSearch}
          className="bg-yellow-400 hover:bg-yellow-500 px-4 py-2 rounded text-white shadow"
        >
          검색
        </button>
      </div>

      {/* 검색 결과 리스트 */}
      {(books.length > 0 || loading) && (
        <div className="absolute top-full mt-2 w-full bg-white border rounded-xl shadow-lg max-h-[300px] overflow-y-auto z-50">
          {loading && <p className="p-4 text-sm text-gray-400">🔍 검색 중...</p>}

          <ul className="space-y-2 p-2">
            {books.map((book) => (
              <li
                key={book.isbn}
                className="flex gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                onClick={() => onBookSelect(book)}
              >
                <img
                  src={book.thumbnail || "/no-image.png"}
                  alt={book.title}
                  className="w-12 h-16 object-cover rounded"
                />
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">{book.title}</p>
                  <p className="text-sm text-gray-500">{book.authors.join(", ")}</p>
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
