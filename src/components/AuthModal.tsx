"use client"

import { signIn } from "next-auth/react"
import { useState, type InputHTMLAttributes } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { InquiryModal } from "@/components/InquiryModal"

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function AuthModal() {
  const [error, setError] = useState("")
  const [inquiryOpen, setInquiryOpen] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  const onSubmit = async (values: LoginFormValues) => {
    setError("")

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
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-semibold text-card-foreground">
              Welcome to Elite CRM
            </h2>
            <p className="text-muted-foreground text-sm">
              Sign in to your account to continue
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

            <Field label="Email" error={errors.email?.message} inputProps={{ ...register("email"), type: "email", placeholder: "m@example.com" }} />
            <Field label="Password" error={errors.password?.message} inputProps={{ ...register("password"), type: "password" }} />

            <button type="submit" disabled={isSubmitting}
              className="w-full bg-foreground hover:bg-foreground/90 text-background font-semibold py-2.5 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
              Sign in
            </button>
          </form>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Don&apos;t have an account? </span>
            <button
              type="button"
              onClick={() => setInquiryOpen(true)}
              className="text-foreground font-semibold hover:underline transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>

      <InquiryModal
        open={inquiryOpen}
        onOpenChange={setInquiryOpen}
        defaultEmail={getValues("email")}
      />
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
