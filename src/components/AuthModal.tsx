"use client"

import { signIn } from "next-auth/react"
import { useEffect, useMemo, useState, type InputHTMLAttributes } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

const baseSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

const signupSchema = baseSchema.extend({
  name: z.string().min(1, "Full name is required"),
  confirmPassword: z.string().min(6, "Confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords must match",
  path: ["confirmPassword"],
})

const loginSchema = baseSchema.extend({
  name: z.string(),
  confirmPassword: z.string(),
})

type AuthFormValues = z.infer<typeof signupSchema>

export function AuthModal() {
  const [isSignUp, setIsSignUp] = useState(false)
  const signupEnabled = process.env.NEXT_PUBLIC_SIGNUP_ENABLED === "true"
  const [error, setError] = useState("")
  const { data: session } = useSession()

  const resolver = useMemo(() => zodResolver(isSignUp ? signupSchema : loginSchema), [isSignUp])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<AuthFormValues>({
    resolver,
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  })

  useEffect(() => {
    reset({ name: "", email: "", password: "", confirmPassword: "" })
  }, [isSignUp, reset])

  const onSubmit = async (values: AuthFormValues) => {
    setError("")

    if (isSignUp) {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })

      if (res.ok) {
        const result = await signIn("credentials", {
          email: values.email,
          password: values.password,
          redirect: false,
        })
        if (result?.error) setError(result.error)
      } else {
        const data = await res.json()
        setError(data.error || "Signup failed")
      }
      return
    }

    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    })

    if (result?.error) {
      setError(result.error)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="sm:max-w-md border border-border p-0 overflow-hidden rounded-lg shadow-lg bg-card">
        <div className="p-8 space-y-6">
          {/* Logo */}
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-foreground rounded-xl flex items-center justify-center">
              <span className="text-background text-3xl font-bold">E</span>
            </div>
          </div>
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-semibold text-card-foreground">
              {isSignUp ? "Create your account" : "Welcome to Elite CRM"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {isSignUp ? "Enter your details below to create your account" : "Sign in to your account to continue"}
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="relative space-y-4">
            {isSubmitting && (
              <div className="absolute inset-0 bg-background/75 flex items-center justify-center z-50 rounded-lg">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-foreground rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-foreground rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                  <div className="w-2 h-2 bg-foreground rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                </div>
              </div>
            )}

            {isSignUp && (
              <Field label="Full Name" error={errors.name?.message} inputProps={{ ...register("name"), placeholder: "John Doe" }} />
            )}
            <Field label="Email" error={errors.email?.message} inputProps={{ ...register("email"), type: "email", placeholder: "m@example.com" }} />
            <Field label="Password" error={errors.password?.message} inputProps={{ ...register("password"), type: "password" }} />
            {isSignUp && (
              <Field label="Confirm Password" error={errors.confirmPassword?.message} inputProps={{ ...register("confirmPassword"), type: "password" }} />
            )}

            <button type="submit" disabled={isSubmitting}
              className="w-full bg-foreground hover:bg-foreground/90 text-background font-semibold py-2.5 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
              {isSignUp ? "Sign up" : "Sign in"}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm">
            <p className="font-medium text-center mb-1">Quick Login</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <button type="button" onClick={() => { reset({ email: "demo@elite.com", password: "demo123", name: "", confirmPassword: "" }); setIsSignUp(false) }}
                className="text-left hover:text-foreground transition-colors">
                🎯 Demo: demo@elite.com
              </button>
              <button type="button" onClick={() => { reset({ email: "admin@elite.com", password: "admin123", name: "", confirmPassword: "" }); setIsSignUp(false) }}
                className="text-left hover:text-foreground transition-colors">
                👑 Admin: admin@elite.com
              </button>
            </div>
          </div>

          {signupEnabled && (
            <div className="text-center text-sm">
              <span className="text-muted-foreground">
                {isSignUp ? "Already have an account? " : "Don't have an account? "}
              </span>
              <button type="button" onClick={() => setIsSignUp(!isSignUp)}
                className="text-foreground font-semibold hover:underline transition-colors">
                {isSignUp ? "Sign in" : "Sign up"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, error, inputProps }: { label: string; error?: string; inputProps: InputHTMLAttributes<HTMLInputElement> }) {
  return (
    <div className="space-y-2">
      <label className="text-card-foreground font-medium text-sm" htmlFor={inputProps.name}>{label}</label>
      <input {...inputProps}
        className="bg-background border border-input text-foreground placeholder:text-muted-foreground w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-all shadow-sm hover:border-foreground/30" />
      {error && <div className="text-destructive text-sm">{error}</div>}
    </div>
  )
}
