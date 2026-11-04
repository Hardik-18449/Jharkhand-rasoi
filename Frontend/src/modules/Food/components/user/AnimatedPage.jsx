import React from "react"

export default function AnimatedPage({ children, className = "" }) {
  return (
    <div className={`animate-in fade-in duration-200 ${className} md:pb-0`}>
      {children}
    </div>
  )
}
