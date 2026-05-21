import { login } from './actions'

type SearchParams = Promise<{ error?: string; next?: string }>

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { error, next } = await searchParams

  return (
    <main className="login">
      <h1>春燕來了 · 歷史報告</h1>
      <p className="subtitle">內部閱覽用，請輸入通行密碼</p>

      <form action={login}>
        <input type="hidden" name="next" value={next ?? '/'} />
        <input
          type="password"
          name="password"
          placeholder="通行密碼"
          autoFocus
          required
        />
        <button type="submit">進入</button>
        {error ? <p className="error">密碼錯誤，請再試一次。</p> : null}
      </form>
    </main>
  )
}
