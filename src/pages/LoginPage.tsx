import { useEffect, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  LogIn,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserPlus,
  UserRound,
} from 'lucide-react'
import loginFamily from '@/assets/login-family.webp'
import { BrandMark } from '@/components/brand/BrandMark'
import { useToast } from '@/context/ToastContext'
import { useAppData } from '@/context/AppDataContext'
import { useAuth } from '@/context/AuthContext'
import { errorMessageOf } from '@/services/http'
import { cn, delay } from '@/lib/utils'

type AuthMode = 'login' | 'register'

interface LoginErrors {
  username?: string
  password?: string
}

interface RegisterErrors {
  name?: string
  account?: string
  password?: string
  confirm?: string
  agreement?: string
}

function SparkleStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 1.6c.6 5.5 4.9 9.8 10.4 10.4-5.5.6-9.8 4.9-10.4 10.4C11.4 16.9 7.1 12.6 1.6 12 7.1 11.4 11.4 7.1 12 1.6Z"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          'flex items-center justify-center rounded-2xl border border-white/80 bg-white/55 shadow-[0_10px_24px_-16px_rgba(109,84,62,0.55)] backdrop-blur-md',
          compact ? 'size-11' : 'size-12',
        )}
      >
        <BrandMark className={compact ? 'size-9' : 'size-10'} />
      </span>
      <span className="min-w-0">
        <span className="block text-[16px] font-semibold tracking-[0.06em] text-[#574232]">星耀童行</span>
        <span className="mt-0.5 block text-[9px] font-medium tracking-[0.22em] text-[#9c8878]">
          XINGYAO TONGXING
        </span>
      </span>
    </div>
  )
}

function AuthNav({
  mode,
  onChange,
  disabled,
}: {
  mode: AuthMode
  onChange: (mode: AuthMode) => void
  disabled?: boolean
}) {
  const tabs = [
    { value: 'login' as const, label: '登录', icon: LogIn },
    { value: 'register' as const, label: '注册', icon: UserPlus },
  ]

  return (
    <div className="absolute -top-6 left-1/2 z-30 w-[calc(100%-52px)] max-w-[286px] -translate-x-1/2">
      <div
        role="tablist"
        aria-label="账号入口"
        className="relative grid grid-cols-2 rounded-[19px] border border-white/80 bg-white/50 p-1.5 shadow-[0_24px_54px_-28px_rgba(96,64,42,0.7),0_6px_18px_-12px_rgba(96,64,42,0.3),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-2xl backdrop-saturate-150"
      >
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute bottom-1.5 left-1.5 top-1.5 w-[calc(50%-6px)] rounded-[14px] bg-[linear-gradient(135deg,#f3aa68_0%,#e58c48_55%,#d97a37_100%)] shadow-[0_10px_22px_-12px_rgba(190,98,35,0.9),inset_0_1px_0_rgba(255,255,255,0.36)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
            mode === 'register' && 'translate-x-full',
          )}
        />
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = mode === tab.value
          return (
            <button
              key={tab.value}
              id={`auth-tab-${tab.value}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="auth-panel"
              tabIndex={active ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(tab.value)}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
                event.preventDefault()
                const next = mode === 'login' ? 'register' : 'login'
                onChange(next)
                window.requestAnimationFrame(() => document.getElementById(`auth-tab-${next}`)?.focus())
              }}
              className={cn(
                'relative z-10 flex h-9 items-center justify-center gap-1.5 rounded-[14px] text-[12px] font-medium tracking-[0.02em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90 disabled:cursor-not-allowed disabled:opacity-60',
                active ? 'text-white' : 'text-[#806b5c] hover:text-[#594332]',
              )}
            >
              <Icon className="size-3.5" strokeWidth={1.9} />
              {tab.label}
            </button>
          )
        })}
      </div>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-2 left-1/2 h-3 w-2/3 -translate-x-1/2 rounded-full bg-[#bd8a62]/20 blur-lg"
      />
    </div>
  )
}

function CheckMark({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'flex size-[18px] shrink-0 items-center justify-center rounded-md border transition peer-focus-visible:ring-4 peer-focus-visible:ring-[#e7a46b]/20',
        checked
          ? 'border-[#e08a48] bg-[#e08a48] text-white shadow-[0_4px_10px_-6px_rgba(201,110,46,0.8)]'
          : 'border-[#d8c6b6] bg-white/60 text-transparent',
        className,
      )}
    >
      <Check
        className={cn('size-3 transition-transform duration-200', checked ? 'scale-100' : 'scale-50')}
        strokeWidth={2.6}
      />
    </span>
  )
}

function PasswordToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? '隐藏密码' : '显示密码'}
      className="flex size-8 items-center justify-center rounded-full border border-white/70 bg-white/40 text-[#a08a79] shadow-[0_5px_14px_-10px_rgba(92,64,43,0.55)] backdrop-blur-md transition hover:border-[#efc9a6] hover:bg-white/75 hover:text-[#7b6453] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e7a46b]/20"
    >
      {visible ? <EyeOff className="size-4" strokeWidth={1.7} /> : <Eye className="size-4" strokeWidth={1.7} />}
    </button>
  )
}

function AuthField({
  id,
  label,
  value,
  placeholder,
  icon,
  type = 'text',
  autoComplete,
  inputMode,
  error,
  trailing,
  onChange,
}: {
  id: string
  label: string
  value: string
  placeholder: string
  icon: ReactNode
  type?: 'text' | 'password'
  autoComplete?: string
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode']
  error?: string
  trailing?: ReactNode
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="text-[11px] font-medium tracking-[0.03em] text-[#7c6656]"
      >
        {label}
      </label>
      <div className="relative mt-1">
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[#a89280] [&>svg]:size-[17px]">
          {icon}
        </span>
        <input
          id={id}
          name={id}
          type={type}
          autoComplete={autoComplete}
          inputMode={inputMode}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'auth-form-error' : undefined}
          placeholder={placeholder}
          className={cn(
            'h-12 w-full rounded-2xl border bg-white/55 pl-10 text-[13px] text-[#4b3729] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none backdrop-blur-sm transition placeholder:text-[#a89484] focus:bg-white/80 focus:ring-4',
            trailing ? 'pr-12' : 'pr-4',
            error
              ? 'border-danger-500/45 focus:border-danger-500 focus:ring-danger-500/10'
              : 'border-white/90 hover:border-white focus:border-[#e7a46b] focus:ring-[#e7a46b]/15',
          )}
        />
        {trailing && <span className="absolute inset-y-0 right-2.5 flex items-center">{trailing}</span>}
      </div>
    </div>
  )
}

function SubmitButton({
  submitting,
  label,
  pendingLabel,
}: {
  submitting: boolean
  label: string
  pendingLabel: string
}) {
  return (
    <div className="group/cta relative mt-4">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-10 -bottom-1.5 h-5 rounded-full bg-[#d97a37]/30 blur-xl transition-all duration-300 group-hover/cta:inset-x-7 group-hover/cta:bg-[#d97a37]/40"
      />
      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className="relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#f0a15f_0%,#e48a45_52%,#d97a37_100%)] text-[14.5px] font-semibold tracking-[0.04em] text-white shadow-[0_16px_30px_-16px_rgba(196,104,39,0.85),inset_0_1px_0_rgba(255,255,255,0.28)] transition duration-200 hover:-translate-y-0.5 hover:brightness-[1.035] hover:shadow-[0_22px_40px_-16px_rgba(196,104,39,0.9),inset_0_1px_0_rgba(255,255,255,0.3)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e78f4d]/30 active:translate-y-0 disabled:pointer-events-none disabled:opacity-70"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),transparent_48%)]"
        />
        {submitting ? (
          <>
            <Loader2 className="relative size-4 animate-spin" />
            <span className="relative">{pendingLabel}</span>
          </>
        ) : (
          <>
            <span className="relative">{label}</span>
            <ArrowRight
              className="relative size-4 transition-transform duration-200 group-hover/cta:translate-x-0.5"
              strokeWidth={2}
            />
          </>
        )}
      </button>
    </div>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const { settings, updateSettings } = useAppData()
  const { status: authStatus, login } = useAuth()
  const isLive = settings.apiMode === 'live'
  const [mode, setMode] = useState<AuthMode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [errors, setErrors] = useState<LoginErrors>({})
  const [regName, setRegName] = useState('')
  const [regAccount, setRegAccount] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')
  const [showRegPassword, setShowRegPassword] = useState(false)
  const [showRegConfirm, setShowRegConfirm] = useState(false)
  const [agreement, setAgreement] = useState(false)
  const [registerErrors, setRegisterErrors] = useState<RegisterErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    const previous = document.title
    document.title =
      mode === 'login'
        ? '登录 · 星耀童行 3D场景辅助训练平台'
        : '注册 · 星耀童行 3D场景辅助训练平台'
    return () => {
      document.title = previous
    }
  }, [mode])

  useEffect(() => {
    if (!isLive) return
    setMode('login')
    setErrors({})
    setRegisterErrors({})
  }, [isLive])

  useEffect(() => {
    if (isLive && authStatus === 'authenticated') {
      navigate('/dashboard', { replace: true })
    }
  }, [isLive, authStatus, navigate])

  const switchMode = (next: AuthMode) => {
    if (next === mode) return
    setMode(next)
    setErrors({})
    setRegisterErrors({})
  }

  const loginError = Object.values(errors).find(Boolean) ?? formError ?? undefined
  const registerError = Object.values(registerErrors).find(Boolean)

  const fillDemoAccount = () => {
    setUsername('demo')
    setPassword('demo123')
    setErrors({})
  }

  const showPolicy = (title: string) => {
    toast({
      title,
      description: '演示环境暂未接入正式条款内容。',
      tone: 'info',
    })
  }

  const switchToDemo = () => {
    updateSettings({ apiMode: 'mock' })
    toast({
      title: '已切换到演示模式',
      description: '当前使用浏览器本地演示数据，无需后端服务。',
      tone: 'info',
    })
    navigate('/dashboard')
  }

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)
    const nextErrors: LoginErrors = {}
    if (!username.trim()) nextErrors.username = '请输入账号或手机号'
    if (!password) nextErrors.password = '请输入密码'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    if (isLive) {
      setSubmitting(true)
      try {
        await login(username.trim(), password)
        toast({
          title: '登录成功',
          description: '欢迎回来',
          tone: 'success',
        })
        const from = (location.state as { from?: string } | null)?.from
        navigate(from && from !== '/login' ? from : '/dashboard', { replace: true })
      } catch (cause) {
        setFormError(errorMessageOf(cause, '登录失败，请检查账号与密码'))
      } finally {
        setSubmitting(false)
      }
      return
    }

    setSubmitting(true)
    await delay(700)
    setSubmitting(false)
    toast({
      title: '登录成功',
      description: '欢迎回来，星耀童行管理员',
      tone: 'success',
    })
    navigate('/dashboard')
  }

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors: RegisterErrors = {}
    if (!regName.trim()) nextErrors.name = '请输入姓名'
    if (!regAccount.trim()) nextErrors.account = '请输入手机号或邮箱'
    else if (regAccount.trim().length < 3) nextErrors.account = '请输入有效的手机号或邮箱'
    if (!regPassword) nextErrors.password = '请设置登录密码'
    else if (regPassword.length < 6) nextErrors.password = '密码至少需要 6 位'
    if (!regConfirm) nextErrors.confirm = '请再次输入密码'
    else if (regConfirm !== regPassword) nextErrors.confirm = '两次输入的密码不一致'
    if (!agreement) nextErrors.agreement = '请先同意服务条款与隐私政策'
    setRegisterErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    await delay(900)
    setSubmitting(false)
    toast({
      title: '注册成功',
      description: `欢迎加入星耀童行，${regName.trim()}`,
      tone: 'success',
    })
    navigate('/dashboard')
  }

  return (
    <main data-auth-mode={mode} className="auth-page relative h-dvh overflow-hidden bg-[#f8f2eb] text-[#4b3729]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_680px_at_82%_8%,rgba(255,255,255,0.92),transparent_62%),radial-gradient(760px_560px_at_94%_86%,rgba(207,207,250,0.56),transparent_64%),radial-gradient(640px_520px_at_36%_108%,rgba(255,206,168,0.42),transparent_68%),linear-gradient(128deg,#fbf4ec_0%,#f8f1ec_42%,#eeecfb_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-28 top-1/3 size-[520px] rounded-full bg-[#ffd7b4]/30 blur-[120px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-1/4 size-[440px] rounded-full bg-[#dfdcff]/45 blur-[110px]"
      />

      <div className="relative z-10 flex h-full w-full">
        <section className="relative hidden h-full w-[56%] shrink-0 lg:block xl:w-[58%]">
          <img
            src={loginFamily}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[center_44%] [mask-image:linear-gradient(to_right,black_0%,black_76%,transparent_100%)]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#f7efe7]/45 to-transparent"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-80 bg-[radial-gradient(ellipse_at_16%_86%,rgba(255,248,240,0.9)_0%,rgba(255,248,240,0.48)_36%,transparent_70%)]"
          />
          <SparkleStar className="absolute right-[13%] top-[13%] size-7 text-[#e9ad72]/60 animate-float-soft" />

          <div className="relative flex h-full flex-col justify-between px-10 py-9 xl:px-14 xl:py-11">
            <BrandLockup />

            <div className="max-w-[320px]">
              <div className="flex items-center gap-3 text-[9.5px] font-medium tracking-[0.26em] text-[#8f7866]">
                <span className="h-px w-8 bg-[#c4ad9a]/80" />
                SCENE-ASSISTED TRAINING
              </div>
              <p className="mt-3.5 text-[16px] leading-7 tracking-[0.01em] text-[#5f4a3a] [text-shadow:0_1px_0_rgba(255,248,240,0.6)]">
                让每一次训练，
                <br />
                都更真实、更高效。
              </p>
              <div className="mt-4 flex items-center gap-2 text-[11px] text-[#826d5c]">
                <span className="size-1.5 rounded-full bg-[#e09b5a]" />
                星耀童行 · 3D 场景辅助训练平台
              </div>
            </div>
          </div>
        </section>

        <section className="relative flex h-full min-h-0 flex-1 flex-col px-5 pb-4 pt-5 sm:px-8 lg:px-10 lg:py-7 xl:px-16">
          <div className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden">
            <div className="absolute -right-20 top-24 size-64 rounded-full bg-[#ffd9b6]/40 blur-[90px]" />
            <div className="absolute -left-24 top-[48%] size-72 rounded-full bg-[#d6d0ff]/45 blur-[100px]" />
            <SparkleStar className="absolute right-9 top-[118px] size-6 text-[#e4ad75]/55 animate-float-soft" />
            <SparkleStar className="absolute left-6 top-[46%] size-3 text-[#bfb2ee]/75" />
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-[2%] top-[16%] hidden size-[330px] rounded-full bg-[#ffd5b2]/55 blur-[100px] lg:block"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[12%] left-[4%] hidden size-[380px] rounded-full bg-[#d2ccff]/55 blur-[110px] lg:block"
          />

          <div className="auth-mobile-brand relative z-10 lg:hidden">
            <BrandLockup compact />
          </div>

          <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center pb-3 pt-9 lg:pt-12">
            <div className="relative my-auto w-full max-w-[432px]">
              {!isLive && <AuthNav mode={mode} onChange={switchMode} disabled={submitting} />}

              <div
                aria-hidden="true"
                className="absolute -inset-5 rounded-[46px] bg-white/20 blur-2xl"
              />
              <div className="relative overflow-hidden rounded-[32px] border border-white/75 bg-[linear-gradient(152deg,rgba(255,255,255,0.78)_0%,rgba(255,255,255,0.56)_46%,rgba(255,255,255,0.43)_100%)] px-5 pb-4 pt-10 shadow-[0_40px_100px_-42px_rgba(102,76,55,0.55),0_10px_28px_-18px_rgba(102,76,55,0.24),inset_0_1px_0_rgba(255,255,255,0.94)] backdrop-blur-[32px] backdrop-saturate-150 sm:px-7 sm:pb-6 sm:pt-11 lg:px-8 lg:pb-6 lg:pt-11">
                <div
                  aria-hidden="true"
                  className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-20 -top-24 size-56 rounded-full bg-white/45 blur-3xl"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-28 -left-20 size-60 rounded-full bg-[#ffdcbd]/30 blur-3xl"
                />
                <SparkleStar className="pointer-events-none absolute right-7 top-16 size-3.5 text-[#e6a96d]/70" />
                <SparkleStar className="pointer-events-none absolute right-11 top-[84px] size-2 text-[#c6baf4]/80" />

                <div
                  key={mode}
                  id="auth-panel"
                  role="tabpanel"
                  aria-labelledby={`auth-tab-${mode}`}
                  className="relative animate-fade-up"
                >
                  <span className="auth-intro-eyebrow inline-flex items-center gap-1.5 rounded-full border border-[#f0ddc9]/90 bg-[#fff8ef]/70 px-3 py-1 text-[10.5px] font-medium tracking-[0.06em] text-[#b0713f]">
                    <Sparkles className="size-3" strokeWidth={1.8} />
                    {mode === 'login' ? '星耀童行 · 欢迎回来' : '初次见面 · 一起童行'}
                  </span>

                  <h1 className="auth-title mt-3 text-[26px] font-semibold leading-[1.22] tracking-[-0.035em] text-[#4a3527] sm:text-[28px] lg:text-[29px]">
                    {mode === 'login' ? '3D场景辅助训练平台' : '创建星耀童行账号'}
                  </h1>
                  <p className="auth-intro-subtitle mt-1.5 text-[12px] leading-5 text-[#8d7868]">
                    {mode === 'login'
                      ? '以真实场景陪伴每一次训练，让成长清晰可见。'
                      : '只需几步，开启属于你的 3D 场景训练空间。'}
                  </p>

                  {mode === 'login' ? (
                    <>
                      <form className="mt-5" onSubmit={handleLogin} noValidate>
                        <div className="space-y-3">
                          <AuthField
                            id="login-username"
                            label="账号"
                            value={username}
                            placeholder="请输入账号或手机号"
                            icon={<UserRound strokeWidth={1.7} />}
                            autoComplete="username"
                            inputMode="text"
                            error={errors.username}
                            onChange={(value) => {
                              setUsername(value)
                              setFormError(null)
                              if (errors.username) setErrors((current) => ({ ...current, username: undefined }))
                            }}
                          />
                          <AuthField
                            id="login-password"
                            label="密码"
                            value={password}
                            placeholder="请输入登录密码"
                            icon={<LockKeyhole strokeWidth={1.7} />}
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            inputMode="text"
                            error={errors.password}
                            trailing={
                              <PasswordToggle
                                visible={showPassword}
                                onToggle={() => setShowPassword((visible) => !visible)}
                              />
                            }
                            onChange={(value) => {
                              setPassword(value)
                              setFormError(null)
                              if (errors.password) setErrors((current) => ({ ...current, password: undefined }))
                            }}
                          />
                        </div>

                        {loginError && (
                          <p
                            id="auth-form-error"
                            role="alert"
                            className="mt-2.5 flex items-center gap-1.5 rounded-xl border border-danger-100 bg-danger-50/70 px-3 py-1.5 text-[11px] leading-4 text-danger-600"
                          >
                            <AlertCircle className="size-3.5 shrink-0" strokeWidth={1.8} />
                            {loginError}
                          </p>
                        )}

                        <div className="mt-3.5 flex items-center justify-between gap-3">
                          <label className="flex cursor-pointer select-none items-center gap-2 text-[12px] text-[#806b5b]">
                            <input
                              type="checkbox"
                              checked={remember}
                              onChange={(event) => setRemember(event.target.checked)}
                              className="peer sr-only"
                            />
                            <CheckMark checked={remember} />
                            记住我
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              toast({
                                title: '演示环境',
                                description: isLive
                                  ? '请联系系统管理员重置密码。'
                                  : '暂未接入密码找回服务，请使用演示账号体验。',
                                tone: 'info',
                              })
                            }
                            className="text-[12px] font-medium text-[#a36a3f] transition hover:text-[#8a512c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e7a46b]/20"
                          >
                            忘记密码？
                          </button>
                        </div>

                        <SubmitButton submitting={submitting} label="登录" pendingLabel="正在登录..." />
                      </form>

                      {isLive ? (
                        <div className="auth-demo-row mt-3 space-y-2 rounded-2xl border border-dashed border-[#ddc9b7]/80 bg-white/35 px-3.5 py-2.5 text-[11px] leading-5 text-[#917c6b] shadow-[0_6px_18px_-16px_rgba(92,64,43,0.6)] backdrop-blur-md">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="size-3.5 shrink-0 text-[#c58a55]" strokeWidth={1.8} />
                            真实 API 模式 · 请使用后端初始化的账号登录
                          </div>
                          <button
                            type="button"
                            onClick={switchToDemo}
                            className="w-full text-left text-[11px] font-medium text-[#a36a3f] underline decoration-[#e2b48f] underline-offset-2 transition hover:text-[#864d29]"
                          >
                            后端暂不可用？切换到演示模式
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={fillDemoAccount}
                          className="auth-demo-row group/demo mt-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-dashed border-[#ddc9b7]/80 bg-white/35 px-3.5 py-2.5 text-left shadow-[0_6px_18px_-16px_rgba(92,64,43,0.6)] backdrop-blur-md transition duration-200 hover:-translate-y-0.5 hover:border-[#e3a26c] hover:bg-white/55 hover:shadow-[0_12px_24px_-16px_rgba(92,64,43,0.55)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e7a46b]/15"
                        >
                          <span className="flex min-w-0 items-center gap-2 text-[11px] leading-5 text-[#917c6b]">
                            <ShieldCheck className="size-3.5 shrink-0 text-[#c58a55]" strokeWidth={1.8} />
                            演示环境 · 任意账号密码均可登录
                          </span>
                          <span className="shrink-0 text-[11px] font-medium text-[#ae6f3c]">填入演示账号</span>
                        </button>
                      )}

                      <p className="auth-legal mt-3.5 text-center text-[10px] leading-4 tracking-[0.02em] text-[#a28e7e]">
                        登录即代表您同意星耀童行训练平台的服务与隐私说明
                      </p>
                    </>
                  ) : (
                    <>
                      <form className="mt-5" onSubmit={handleRegister} noValidate>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <AuthField
                            id="register-name"
                            label="姓名"
                            value={regName}
                            placeholder="请输入姓名"
                            icon={<UserRound strokeWidth={1.7} />}
                            autoComplete="name"
                            inputMode="text"
                            error={registerErrors.name}
                            onChange={(value) => {
                              setRegName(value)
                              if (registerErrors.name)
                                setRegisterErrors((current) => ({ ...current, name: undefined }))
                            }}
                          />
                          <AuthField
                            id="register-account"
                            label="手机号 / 邮箱"
                            value={regAccount}
                            placeholder="手机号或邮箱"
                            icon={<Smartphone strokeWidth={1.7} />}
                            autoComplete="username"
                            inputMode="text"
                            error={registerErrors.account}
                            onChange={(value) => {
                              setRegAccount(value)
                              if (registerErrors.account)
                                setRegisterErrors((current) => ({ ...current, account: undefined }))
                            }}
                          />
                          <AuthField
                            id="register-password"
                            label="设置密码"
                            value={regPassword}
                            placeholder="至少 6 位"
                            icon={<LockKeyhole strokeWidth={1.7} />}
                            type={showRegPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            inputMode="text"
                            error={registerErrors.password}
                            trailing={
                              <PasswordToggle
                                visible={showRegPassword}
                                onToggle={() => setShowRegPassword((visible) => !visible)}
                              />
                            }
                            onChange={(value) => {
                              setRegPassword(value)
                              if (registerErrors.password)
                                setRegisterErrors((current) => ({ ...current, password: undefined }))
                            }}
                          />
                          <AuthField
                            id="register-confirm"
                            label="确认密码"
                            value={regConfirm}
                            placeholder="再次输入密码"
                            icon={<ShieldCheck strokeWidth={1.7} />}
                            type={showRegConfirm ? 'text' : 'password'}
                            autoComplete="new-password"
                            inputMode="text"
                            error={registerErrors.confirm}
                            trailing={
                              <PasswordToggle
                                visible={showRegConfirm}
                                onToggle={() => setShowRegConfirm((visible) => !visible)}
                              />
                            }
                            onChange={(value) => {
                              setRegConfirm(value)
                              if (registerErrors.confirm)
                                setRegisterErrors((current) => ({ ...current, confirm: undefined }))
                            }}
                          />
                        </div>

                        {registerError && (
                          <p
                            id="auth-form-error"
                            role="alert"
                            className="mt-2.5 flex items-center gap-1.5 rounded-xl border border-danger-100 bg-danger-50/70 px-3 py-1.5 text-[11px] leading-4 text-danger-600"
                          >
                            <AlertCircle className="size-3.5 shrink-0" strokeWidth={1.8} />
                            {registerError}
                          </p>
                        )}

                        <div className="mt-3">
                          <label className="flex cursor-pointer select-none items-start gap-2 text-[11px] leading-5 text-[#806b5b]">
                            <input
                              type="checkbox"
                              checked={agreement}
                              onChange={(event) => {
                                setAgreement(event.target.checked)
                                if (registerErrors.agreement)
                                  setRegisterErrors((current) => ({ ...current, agreement: undefined }))
                              }}
                              className="peer sr-only"
                            />
                            <CheckMark checked={agreement} className="mt-0.5" />
                            <span>
                              我已阅读并同意
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  showPolicy('服务条款')
                                }}
                                className="mx-0.5 font-medium text-[#a36a3f] underline decoration-[#e2b48f] underline-offset-2 transition hover:text-[#864d29]"
                              >
                                《服务条款》
                              </button>
                              与
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  showPolicy('隐私政策')
                                }}
                                className="mx-0.5 font-medium text-[#a36a3f] underline decoration-[#e2b48f] underline-offset-2 transition hover:text-[#864d29]"
                              >
                                《隐私政策》
                              </button>
                            </span>
                          </label>
                        </div>

                        <SubmitButton submitting={submitting} label="创建账号" pendingLabel="正在创建账号..." />
                      </form>

                      <p className="auth-register-note mt-3 flex items-center justify-center gap-1.5 text-[10px] leading-4 text-[#9a8676]">
                        <ShieldCheck className="size-3.5 shrink-0 text-[#c58a55]" strokeWidth={1.8} />
                        注册信息仅用于本地演示 · 注册后直接进入工作区
                      </p>
                    </>
                  )}
                </div>
              </div>

              <p className="auth-copyright mt-3.5 text-center text-[10px] tracking-[0.04em] text-[#a08c7d]">
                © 2026 星耀童行科技 · 用 3D 让训练更真实
              </p>
            </div>
          </div>

          <div className="relative z-10 hidden items-center justify-center gap-2 text-[10px] tracking-[0.14em] text-[#a49282] lg:flex">
            <span className="size-1 rounded-full bg-[#d9a06b]" />
            SECURE · GENTLE · PROFESSIONAL
          </div>
        </section>
      </div>
    </main>
  )
}
