# 비움 정거장

## 설치 및 실행

### 1. 패키지 설치
```
npm install
```

### 2. Supabase 설정
1. https://supabase.com 에서 무료 계정 만들기
2. 새 프로젝트 생성
3. SQL Editor에서 아래 쿼리 실행:

```sql
create table items (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  method text not null,
  memo text,
  is_book boolean default false,
  book_read boolean,
  photo_url text,
  date text not null,
  created_at timestamp with time zone default now()
);

alter table items enable row level security;
create policy "모두 접근 가능" on items for all using (true);
```

4. Storage에서 `photos` 버킷 생성 (Public 버킷으로)

5. `.env.example` 을 `.env` 로 복사하고 Supabase URL과 Key 입력:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxx...
```

### 3. 로컬 실행
```
npm run dev
```

### 4. Vercel 배포
1. https://vercel.com 에서 GitHub 연결
2. 이 프로젝트 import
3. Environment Variables에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 추가
4. Deploy!

### 5. 아이폰 홈 화면 추가
Safari에서 배포된 URL 열고 → 공유 버튼 → 홈 화면에 추가
