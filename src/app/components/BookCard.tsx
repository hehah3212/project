"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import ProgressBar from "./ProgressBar";
import { Book } from "./BookSearch";

type BookCardProps = {
  book: Book;
  onDelete?: (isbn: string) => void;
};

export default function BookCard({ book, onDelete }: BookCardProps) {
  const [totalPages, setTotalPages] = useState<number>(320);
  const [readPages, setReadPages] = useState<number>(0);
  const [summary, setSummary] = useState<string>("");

  const safeReadPages = Math.min(readPages, totalPages);
  const progress = totalPages > 0 ? (safeReadPages / totalPages) * 100 : 0;
  const storageKey = book.isbn.replace(/[^a-zA-Z0-9]/g, "") || "default-book";

  useEffect(() => {
    const saved = localStorage.getItem(`reading-${storageKey}`);
    if (saved) {
      const data = JSON.parse(saved);
      setTotalPages(data.totalPages || 320);
      setReadPages(data.readPages || 0);
      setSummary(data.summary || "");
    } else {
      setTotalPages(320);
      setReadPages(0);
      setSummary("");
    }
  }, [book]);
  {onDelete ? (
  <button onClick={() => onDelete(book.isbn)}>🧪 삭제 확인</button>
) : (
  <div>❌ onDelete 없음</div>
)}

  useEffect(() => {
    const data = { totalPages, readPages, summary };
    localStorage.setItem(`reading-${storageKey}`, JSON.stringify(data));
  }, [totalPages, readPages, summary, book]);

  return (
    <div className="relative bg-white p-6 rounded-xl shadow space-y-6">
      {/* 🗑 삭제 버튼 */}
      {onDelete && (
        <button
          onClick={() => onDelete(book.isbn)}
          className="absolute top-2 right-2 text-sm text-red-500 hover:text-red-700"
        >
          ✕ 삭제
        </button>
      )}

      {/* 책 정보 */}
      <section className="flex gap-6">
        <div className="w-32 h-48 bg-gray-200 rounded overflow-hidden">
          {book.thumbnail ? (
            <Image
              src={book.thumbnail}
              alt={book.title}
              width={128}
              height={192}
              className="object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-gray-500">
              책 이미지
            </div>
          )}
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{book.title}</h2>
          <p className="text-gray-500">{book.authors.join(", ")}</p>
          <p className="text-sm text-gray-400">{book.publisher}</p>
          <p className="text-sm text-gray-400">총 {totalPages}페이지</p>
          <p className="text-sm text-gray-400">2025.04.15 ~ 2025.05.10</p>
        </div>
      </section>

      {/* 요약 */}
      <section>
        <h3 className="font-semibold mb-1">📌 한 문장 요약</h3>
        <textarea
          className="w-full border rounded p-2 text-sm"
          rows={6}
          placeholder="책을 한 문장으로 요약해보세요"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </section>

      {/* 읽은 양 */}
      <section>
        <h3 className="font-semibold mb-1">📖 읽은 양</h3>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="number"
            className="border rounded p-2 w-28"
            value={readPages}
            onChange={(e) => setReadPages(Number(e.target.value))}
          />
          <span className="text-sm text-gray-500">/</span>
          <input
            type="number"
            className="border rounded p-2 w-28"
            value={totalPages}
            onChange={(e) => setTotalPages(Number(e.target.value))}
          />
          <span className="text-sm text-gray-500">페이지</span>
        </div>
        <ProgressBar value={progress} label="진행률" />
      </section>
    </div>
  );
}
