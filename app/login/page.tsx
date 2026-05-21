import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { login } from './actions'

type SearchParams = Promise<{ error?: string; next?: string }>

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { error, next } = await searchParams

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 py-16">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="font-serif text-2xl font-bold text-brand-brown">
            春燕來了 · 歷史報告
          </CardTitle>
          <CardDescription>內部閱覽用，請輸入通行密碼</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={login} className="flex flex-col gap-3">
            <input type="hidden" name="next" value={next ?? '/'} />
            <Input
              type="password"
              name="password"
              placeholder="通行密碼"
              autoFocus
              required
              autoComplete="current-password"
            />
            <Button type="submit" className="w-full">
              進入
            </Button>
            {error ? (
              <p className="text-center text-sm text-tier-orange" role="alert">
                密碼錯誤，請再試一次。
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
