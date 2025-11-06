"use client"

import * as React from "react"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AIChatbotSidebar } from "./ai-chatbot-sidebar"

interface AIButtonProps {
  currentPage?: string
}

export function AIButton({ currentPage }: AIButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="ghost"
        className="bg-transparent hover:bg-transparent text-[#181818] hover:text-[#181818] [&_svg]:size-6 border-2 border-[#181818]"
        size="icon"
      >
        <Sparkles className="size-6" />
        <span className="sr-only">AI Insights</span>
      </Button>
      
      <AIChatbotSidebar
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        currentPage={currentPage}
      />
    </>
  )
}
