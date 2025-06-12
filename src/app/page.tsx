"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Book } from "./components/BookSearch";
import BookSearch from "./components/BookSearch";
import BookCard from "./components/BookCard";
import ChartCard from "./components/ChartCard";
import ProgressBar from "./components/ProgressBar";
import Header from "./components/Header";
import RankingCard from "./components/RankingCard";
import MyPage from "./components/MyPage";
import ReadingMissionList from "./components/ReadingMissionList";
import { getAuth } from "firebase/auth";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "./utils/firebase";

export default function Home() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [bookList, setBookList] = useState<Book[]>([]);
  const [view, setView] = useState<"main" | "mypage">("main");

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

  const handleBookSelect = (book: Book) => {
    setBookList((prev) => {
      const exists = prev.find((b) => b.isbn === book.isbn);
      if (exists) return prev;
      const updated = [...prev, book];
      localStorage.setItem(BOOK_LIST_KEY, JSON.stringify(updated));
      return updated;
    });
    setShowSearch(false);
  };

  const handleReadingIncrease = (delta: number) => {
    console.log("📤 dispatchEvent - delta:", delta);
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
    console.log(`🎉 ${reward} 포인트 지급 완료`);
  };

  return (
    <main className="min-h-screen bg-gray-100">
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setView("main")}
            className={`px-4 py-1 rounded font-semibold transition ${
              view === "main"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-800 hover:bg-gray-300"
            }`}
          >
            홈
          </button>
          <button
            onClick={() => setView("mypage")}
            className={`px-4 py-1 rounded font-semibold transition ${
              view === "mypage"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-800 hover:bg-gray-300"
            }`}
          >
            내 정보
          </button>
        </div>

        {view === "main" && (
          <>
            <div className="flex flex-col-reverse lg:flex-row lg:items-start gap-6">
              <div className="flex-1 space-y-4">
                <div className="bg-white p-6 rounded-2xl shadow flex justify-between items-center">
                  <p className="text-gray-600 text-sm">
                    📚 추가된 책: {bookList.length}권
                  </p>
                  <button
                    onClick={() => setShowSearch((prev) => !prev)}
                    className="bg-yellow-400 hover:bg-yellow-500 text-white font-semibold px-4 py-2 rounded shadow"
                  >
                    📘 책 추가
                  </button>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow space-y-2">
                  <h2 className="font-semibold text-lg mb-2">📈 오늘의 독서 / 목표</h2>
                  <ProgressBar value={50} label="오늘의 독서량" />
                  <ProgressBar value={80} label="주간 목표 달성률" />
                </div>

                <ReadingMissionList
                  showForm={false}
                  onlyActive={true}
                  onReward={handleMissionReward}
                />
              </div>

              <div className="w-full lg:w-[300px] xl:w-[360px]">
                <ChartCard />
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
              <div className="w-full lg:w-[300px]">
                <RankingCard />
              </div>
              <div className="flex-1 overflow-x-auto">
                <div className="flex gap-4 w-max">
                  {bookList.length === 0 ? (
                    <div className="bg-white p-6 rounded-xl shadow text-center text-gray-400">
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
              </div>
            </div>

            {showSearch && (
              <div className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-3xl bg-white p-4 rounded-xl shadow z-50">
                <div className="flex justify-between items-center mb-2">
                  <p className="font-semibold text-gray-700">📚 책 검색</p>
                  <button
                    className="text-sm text-gray-500 hover:text-black"
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
