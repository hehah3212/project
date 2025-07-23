"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Book } from "./components/BookSearch";
import BookSearch from "./components/BookSearch";
import BookCard from "./components/BookCard";
import FavoritePicker from "./components/FavoritePage";
import ChartCard from "./components/ChartCard";
import ProgressBar from "./components/ProgressBar";
import Header from "./components/Header";
import RankingCard from "./components/RankingCard";
import MyPage from "./components/MyPage";
import ReadingMissionList from "./components/ReadingMissionList";
import { getAuth } from "firebase/auth";
import { doc, getDoc, updateDoc, deleteDoc, setDoc } from "firebase/firestore";
import { db } from "./utils/firebase";

export default function Home() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [bookList, setBookList] = useState<Book[]>([]);
  const [view, setView] = useState<"main" | "mypage">("main");
  const [showFavModal, setShowFavModal] = useState(false);
  const BOOK_LIST_KEY = "book-list";

  useEffect(() => {
    const raw = localStorage.getItem("user");
    try {
      const user = JSON.parse(raw || "{}");
      if (!user.uid) {
        router.push("/login");
      } else {
        setUid(user.uid);
      }
    } catch {
      router.push("/login");
    }
  }, [router]);

  useEffect(() => {
    const saved = localStorage.getItem(BOOK_LIST_KEY);
    if (saved) {
      try {
        setBookList(JSON.parse(saved));
      } catch {
        console.error("책 목록 불러오기 실패");
      }
    }
  }, []);



  const handleBookSelect = async (book: Book) => {
    const isbn = book.isbn.split(" ")[0];
    const cleanedBook = { ...book, isbn };

    setBookList((prev) => {
      const exists = prev.find((b) => b.isbn === isbn);
      if (exists) return prev;
      const updated = [...prev, cleanedBook];
      localStorage.setItem(BOOK_LIST_KEY, JSON.stringify(updated));
      return updated;
    });

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    const ref = doc(db, "users", user.uid, "books", isbn);
    await setDoc(
      ref,
      {
        ...cleanedBook,
        readPages: 0,
        totalPages: 320,
        summary: "",
        thoughts: "",
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );

    setShowSearch(false);
  };

  const handleReadingIncrease = (delta: number) => {
    const event = new CustomEvent("reading-progress", { detail: delta });
    window.dispatchEvent(event);
  };

  const handleDeleteBook = async (isbn: string) => {
    const updated = bookList.filter((b) => b.isbn !== isbn);
    setBookList(updated);
    localStorage.setItem("book-list", JSON.stringify(updated));
    localStorage.removeItem(`reading-${isbn}`);

    if (!uid) return;
    try {
      await deleteDoc(doc(db, "users", uid, "books", isbn));
    } catch (err: any) {
      alert("Firestore 삭제 실패: " + err.message);
    }
  };

  const handleMissionReward = async (reward: number) => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    const current = snap.exists() ? snap.data().point || 0 : 0;

    await updateDoc(ref, { point: current + reward });
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 pt-32 space-y-12">
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setView("main")}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition border ${view === "main" ? "bg-indigo-600 text-white" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"}`}
          >
            홈
          </button>
          <button
            onClick={() => setView("mypage")}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition border ${view === "mypage" ? "bg-indigo-600 text-white" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"}`}
          >
            내 정보
          </button>
        </div>

        {view === "main" && (
          <>
            <section className="space-y-6">
              <h2 className="text-xl font-bold text-gray-800">📊 독서 통계</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ChartCard />
                <div className="bg-white p-6 rounded-2xl shadow space-y-4">
                  <h3 className="text-base font-semibold text-gray-700">📈 오늘의 목표</h3>
                  <ProgressBar value={50} label="오늘의 독서량" />
                </div>
                <div className="bg-white p-6 rounded-2xl shadow space-y-4">
                  <h3 className="text-base font-semibold text-gray-700">🏆 실시간 랭킹</h3>
                  <RankingCard />
                </div>
              </div>
            </section>

            <section className="mt-12">
              <div className="bg-white p-6 rounded-2xl shadow">
                {view === "main" && (
                  <ReadingMissionList
                    showForm={false}
                    onlyActive={true}
                    onReward={handleMissionReward}
                  />
                )}

                {/* 숨겨진 상태로 항상 마운트 */}
                {view !== "main" && (
                  <section className="hidden">
                    <ReadingMissionList
                      showForm={false}
                      onlyActive={true}
                      onReward={handleMissionReward}
                    />
                  </section>
                )}
              </div>
            </section>

            <section className="bg-white p-6 rounded-2xl shadow-inner mt-12">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  📘 추가된 책: {bookList.length}권
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push("/favorites")}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-full"
                  >
                    즐겨찾기 보기
                  </button>
                  <button
                    onClick={() => setShowSearch((prev) => !prev)}
                    className="bg-yellow-400 hover:bg-yellow-500 text-white px-4 py-2 rounded-full"
                  >
                    책 추가
                  </button>
                </div>
              </div>
              <div className="flex gap-4 overflow-x-auto">
                {bookList.length === 0 ? (
                  <div className="text-gray-400 text-center w-full">
                    📚 책을 추가하고 독서를 시작해보세요!
                  </div>
                ) : (
                  bookList.map((book) => (
                    <BookCard
                      key={book.isbn}
                      book={book}
                      onDelete={handleDeleteBook}
                      onReadIncrease={handleReadingIncrease}
                    />
                  ))
                )}
              </div>
            </section>

            {showSearch && (
              <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl bg-white px-10 py-6 shadow-lg border-b z-50 rounded-b-xl">
                <div className="flex justify-between items-center mb-5">
                  <h4 className="text-xl font-bold text-yellow-500 flex items-center gap-2">
                    📖 책 검색
                  </h4>
                  <button
                    className="text-sm text-gray-400 hover:text-black"
                    onClick={() => setShowSearch(false)}
                  >
                    ✕ 닫기
                  </button>
                </div>
                <BookSearch onBookSelect={handleBookSelect} />
              </div>
            )}
          </>
        )}


        {view === "mypage" && <MyPage />}
      </div>
    </main>
  );
}