"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  doc,
  setDoc,
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { fetchBooksByISBN } from "../utils/fetchBooks";
import BookCard from "../components/BookCard";
import type { Book } from "../components/BookSearch";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";

export default function FavoritesPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [favBooks, setFavBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  // 🔐 로그인 유저 UID 설정
  useEffect(() => {
    return onAuthStateChanged(getAuth(), (user) => {
      setUid(user?.uid ?? null);
    });
  }, []);

  // 📥 Firestore에서 즐겨찾기 불러오기
  useEffect(() => {
    if (!uid) return;
    (async () => {
      setLoading(true);
      const snap = await getDocs(collection(db, "users", uid, "favorites"));
      const isbns = snap.docs.map((doc) => doc.id);
      const books = await fetchBooksByISBN(isbns);
      setFavBooks(books);
      setLoading(false);
    })();
  }, [uid]);

  // ➕ 추가하기 버튼 → 로컬+DB 반영 후 홈 이동
  const handleSelect = async (book: Book) => {
    // 1. 로컬스토리지에 추가
    const raw = localStorage.getItem("book-list") || "[]";
    const list: Book[] = JSON.parse(raw);
    if (!list.find((b) => b.isbn === book.isbn)) {
      list.push(book);
      localStorage.setItem("book-list", JSON.stringify(list));
    }

    // 2. Firestore에 추가
    const user = getAuth().currentUser;
    if (user) {
      const ref = doc(db, "users", user.uid, "books", book.isbn);
      await setDoc(ref, {
        ...book,
        readPages: 0,
        totalPages: 320,
        summary: "",
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }

    // 3. 메인으로 이동
    router.push("/");
  };

  // ❤️ 하트 클릭 후 목록에서 제거
  const handleUnfavorite = (isbn: string) => {
    setFavBooks((prev) => prev.filter((b) => b.isbn !== isbn));
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* 뒤로가기 */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 mb-6 text-blue-500 hover:underline"
      >
        <ArrowLeftIcon className="w-5 h-5" />
        뒤로가기
      </button>

      <h1 className="text-2xl font-bold mb-4">💙 즐겨찾기한 책</h1>

      {loading ? (
        <p>로딩 중...</p>
      ) : favBooks.length === 0 ? (
        <p className="text-gray-500">아직 즐겨찾기한 책이 없습니다.</p>
      ) : (
        <div className="flex flex-wrap gap-4">
          {favBooks.map((book) => (
            <BookCard
              key={book.isbn}
              book={book}
              onClick={() => handleSelect(book)}
              onUnfavorite={handleUnfavorite}
            />
          ))}
        </div>
      )}
    </div>
  );
}
