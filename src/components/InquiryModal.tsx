"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface InquiryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultEmail?: string
}

const needsOptions = [
  "I want to test the CRM",
  "I want to run my company on Elite CRM",
  "I need a custom solution",
] as const

const teamSizeOptions = ["1-5", "6-15", "16-50", "50+"] as const

export function InquiryModal({ open, onOpenChange, defaultEmail = "" }: InquiryModalProps) {
  const [needs, setNeeds] = useState("")
  const [teamSize, setTeamSize] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [yourName, setYourName] = useState("")
  const [yourEmail, setYourEmail] = useState(defaultEmail)
  const [requirements, setRequirements] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const subject = `Elite CRM Inquiry - ${companyName || "Unknown Company"}`
    const body = [
      `Name: ${yourName}`,
      `Email: ${yourEmail}`,
      `Company: ${companyName}`,
      `Needs: ${needs}`,
      `Team Size: ${teamSize}`,
      requirements ? `Requirements: ${requirements}` : "",
    ]
      .filter(Boolean)
      .join("\n")

    const mailtoUrl = `mailto:sales@elitepartnersus.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.location.href = mailtoUrl

    onOpenChange(false)
  }

  const isFormValid = needs && teamSize && companyName.trim() && yourName.trim() && yourEmail.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">Get Started with Elite CRM</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Tell us about your needs and we&apos;ll get back to you.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Needs dropdown */}
          <div className="space-y-2">
            <Label className="text-card-foreground">What best describes your needs?</Label>
            <Select value={needs} onValueChange={setNeeds}>
              <SelectTrigger className="w-full bg-background border-input text-foreground">
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                {needsOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Team size dropdown */}
          <div className="space-y-2">
            <Label className="text-card-foreground">How many team members will be in your space?</Label>
            <Select value={teamSize} onValueChange={setTeamSize}>
              <SelectTrigger className="w-full bg-background border-input text-foreground">
                <SelectValue placeholder="Select team size" />
              </SelectTrigger>
              <SelectContent>
                {teamSizeOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Company name */}
          <div className="space-y-2">
            <Label htmlFor="inquiry-company" className="text-card-foreground">Company name</Label>
            <Input
              id="inquiry-company"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Inc."
              className="bg-background border-input text-foreground"
            />
          </div>

          {/* Your name */}
          <div className="space-y-2">
            <Label htmlFor="inquiry-name" className="text-card-foreground">Your name</Label>
            <Input
              id="inquiry-name"
              value={yourName}
              onChange={(e) => setYourName(e.target.value)}
              placeholder="John Doe"
              className="bg-background border-input text-foreground"
            />
          </div>

          {/* Your email */}
          <div className="space-y-2">
            <Label htmlFor="inquiry-email" className="text-card-foreground">Your email</Label>
            <Input
              id="inquiry-email"
              type="email"
              value={yourEmail}
              onChange={(e) => setYourEmail(e.target.value)}
              placeholder="m@example.com"
              className="bg-background border-input text-foreground"
            />
          </div>

          {/* Requirements */}
          <div className="space-y-2">
            <Label htmlFor="inquiry-requirements" className="text-card-foreground">
              Any specific requirements? <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="inquiry-requirements"
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="Tell us about any specific needs or integrations..."
              className="bg-background border-input text-foreground min-h-20"
            />
          </div>

          <Button
            type="submit"
            disabled={!isFormValid}
            className="w-full bg-foreground hover:bg-foreground/90 text-background font-semibold"
          >
            Submit Inquiry
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
