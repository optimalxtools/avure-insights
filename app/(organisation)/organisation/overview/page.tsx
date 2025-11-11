"use client"

import * as React from "react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { SectionTitle } from "@/components/section-title"
import { AIButton } from "@/components/ai-button"
import { ExportButton } from "@/components/export-button"

export default function Page() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
        <div className="flex items-center justify-between w-full px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage><SectionTitle /></BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-2">
            <AIButton currentPage="Organisation - Overview" />
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 px-2 md:px-4 pt-0 md:pt-0 pb-2 md:pb-4" style={{ maxWidth: "100vw" }}>
        <div className="px-2 md:px-0">
          <span className="text-muted-foreground">Organisation</span>
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Overview
            </h1>
            <ExportButton />
          </div>
        </div>
        <div className="rounded-md border p-6 text-sm text-muted-foreground">
          Organisation overview coming soon
        </div>
      </div>
    </>
  )
}