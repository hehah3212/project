export async function fetchBooks(query: string) {
  const res = await fetch(
    `https://dapi.kakao.com/v3/search/book?target=title&query=${encodeURIComponent(query)}`,
    {
      headers: {
        Authorization: `KakaoAK ${process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error("책 정보를 가져오지 못했습니다.");
  }

  const data = await res.json();
  return data.documents;
}