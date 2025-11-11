"use client"

import * as React from "react"
import { X, Sparkles, Plus, TrendingUp, AlertTriangle, Zap, BarChart3, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

interface AIChatbotSidebarProps {
  isOpen: boolean
  onClose: () => void
  currentPage?: string
}

const PREDEFINED_PROMPTS = [
  {
    title: "Analyze Trends",
    prompt: "What are the key trends in the current data?",
    icon: TrendingUp,
  },
  {
    title: "Identify Issues",
    prompt: "Are there any anomalies or issues I should be aware of?",
    icon: AlertTriangle,
  },
  {
    title: "Optimize Performance",
    prompt: "How can I improve performance based on this data?",
    icon: Zap,
  },
  {
    title: "Compare Periods",
    prompt: "Compare current period with previous period",
    icon: BarChart3,
  },
]

export function AIChatbotSidebar({ isOpen, onClose, currentPage }: AIChatbotSidebarProps) {
  const [message, setMessage] = React.useState("")
  const [contextAdded, setContextAdded] = React.useState(false)
  const [messages, setMessages] = React.useState<Array<{ role: "user" | "assistant"; content: string }>>([])

  const handleSendMessage = () => {
    if (!message.trim()) return
    
    // Add user message (placeholder - no actual AI functionality yet)
    setMessages([...messages, { role: "user", content: message }])
    setMessage("")
    
    // Placeholder response
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "This is a placeholder response. AI functionality will be implemented soon." 
      }])
    }, 500)
  }

  const handlePromptClick = (prompt: string) => {
    setMessage(prompt)
  }

  const toggleContext = () => {
    setContextAdded(!contextAdded)
  }

  React.useEffect(() => {
    if (!isOpen) {
      // Reset state when sidebar closes
      setMessages([])
      setMessage("")
      setContextAdded(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-full sm:w-[420px] md:w-[520px] bg-white border-l shadow-xl z-50 flex flex-col transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-sidebar">
              <Sparkles className="h-6 w-6 text-[#7a7a7a]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">AI Insights</h2>
              <p className="text-sm text-muted-foreground">Ask me anything about your data</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9 text-foreground hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Context Badge */}
        {currentPage && (
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground/80">Context:</span>
                {contextAdded ? (
                  <Badge variant="default" className="bg-sidebar text-white hover:bg-sidebar-accent">
                    {currentPage}
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">None</span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleContext}
                className="h-8 text-xs border-border text-foreground hover:bg-accent"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                {contextAdded ? "Remove" : "Add Context"}
              </Button>
            </div>
            {contextAdded && (
              <p className="text-xs text-muted-foreground mt-2">
                AI will focus on data from this page only
              </p>
            )}
          </div>
        )}

        {/* Predefined Prompts */}
        {messages.length === 0 && (
          <div className="p-5 border-b border-border bg-white">
            <h3 className="text-base font-semibold mb-4 text-foreground">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              {PREDEFINED_PROMPTS.map((prompt, index) => {
                const IconComponent = prompt.icon
                return (
                  <Button
                    key={index}
                    variant="outline"
                    className="h-auto flex-col items-start p-4 text-left border-sidebar/20 bg-sidebar/5 hover:bg-sidebar/10 hover:border-sidebar/30 transition-all group"
                    onClick={() => handlePromptClick(prompt.prompt)}
                  >
                    <div className="mb-2 p-2 rounded-md bg-sidebar/10 group-hover:bg-sidebar/20 transition-colors">
                      <IconComponent className="h-5 w-5 text-sidebar group-hover:text-sidebar-accent" />
                    </div>
                    <div className="text-sm font-medium text-foreground">{prompt.title}</div>
                  </Button>
                )
              })}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-white">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="p-5 rounded-full bg-sidebar mb-5">
                <Sparkles className="h-10 w-10 text-[#7a7a7a]" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">Welcome to AI Insights</h3>
              <p className="text-base text-muted-foreground max-w-sm leading-relaxed">
                Ask questions about your data, get insights, or use one of the quick actions above.
              </p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="p-2.5 rounded-lg bg-sidebar h-fit">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                )}
                <div
                  className={cn(
                    "rounded-lg p-4 max-w-[80%]",
                    msg.role === "user"
                      ? "bg-sidebar text-white shadow-sm"
                      : "bg-muted text-foreground border border-border"
                  )}
                >
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <div className="p-5 border-t border-border bg-white">
          <div className="flex gap-3">
            <Textarea
              placeholder="Ask a question..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              className="min-h-[70px] resize-none bg-white border-border text-foreground placeholder:text-muted-foreground focus:border-sidebar focus:ring-sidebar/20"
            />
            <Button
              onClick={handleSendMessage}
              size="icon"
              className="bg-sidebar hover:bg-sidebar-accent text-white self-end h-[70px] w-12 shadow-sm"
              disabled={!message.trim()}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2.5">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  )
}
