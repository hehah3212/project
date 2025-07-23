"use client";

import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../utils/firebase";
import type { Book } from "./BookSearch";
import { fetchBooksByISBN } from "../utils/fetchBooks";
import { XMarkIcon } from "@heroicons/react/24/solid";
import BookCard from "./BookCard";

type Props = {
  onSelect: (book: Book) => void;
  onClose: () => void;
};

export default function FavoritePicker({ onSelect, onClose }: Props) {
  const [uid, setUid] = useState<string | null>(null);
  const [favBooks, setFavBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  // 1) 로그인된 UID 구독
  useEffect(() => {
    return onAuthStateChanged(getAuth(), (user) => {
      setUid(user?.uid ?? null);
    });
  }, []);

  // 2) 즐겨찾기된 ISBN 불러와서 fetchBooksByISBN
  useEffect(() => {
    if (!uid) return;
    (async () => {
      setLoading(true);
      // favorites 서브컬렉션에서 ISBN 목록
      const snap = await getDocs(collection(db, "users", uid, "favorites"));
      const isbns = snap.docs.map((d) => d.id);
      // 헬퍼로 실제 책 정보 불러오기
      const books = await fetchBooksByISBN(isbns);
      setFavBooks(books);
      setLoading(false);
    })();
  }, [uid]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-4xl p-6 rounded-xl relative">
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold mb-4">💙 즐겨찾기한 책</h2>

        {loading ? (
          <p className="text-gray-500">로딩 중...</p>
        ) : favBooks.length === 0 ? (
          <p className="text-gray-400">아직 즐겨찾기한 책이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {favBooks.map((book) => (
              <div key={book.isbn}>
                <BookCard
                  book={book}
                  onDelete={undefined}    // 여기선 삭제 버튼 숨기기
                  onReadIncrease={undefined} // 독서 진행 버튼 숨기기
                  // 책 추가 액션: 부모 onSelect 호출
                  onClick={() => {
                    onSelect(book);
                    onClose();
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
