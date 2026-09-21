"use client"

import * as React from "react"
import { ClockIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

/** Value/onChange use 24-hour "HH:MM" strings (e.g. "14:05") to match existing form/API usage. */
interface ClockTimePickerProps {
  id?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  /** 24-hour "HH:MM" the dial opens on before anything is chosen (e.g. the office's configured start/end time). */
  defaultValue?: string
  /** Meridiem to start from when no time is set and no defaultValue is given. */
  defaultMeridiem?: "AM" | "PM"
}

function parseValue(value: string): { hour24: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hour24 = Number(match[1])
  const minute = Number(match[2])
  if (Number.isNaN(hour24) || Number.isNaN(minute) || hour24 > 23 || minute > 59) return null
  return { hour24, minute }
}

function to12Hour(hour24: number): { hour12: number; meridiem: "AM" | "PM" } {
  const meridiem = hour24 >= 12 ? "PM" : "AM"
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return { hour12, meridiem }
}

function to24Hour(hour12: number, meridiem: "AM" | "PM"): number {
  const h = hour12 % 12
  return meridiem === "PM" ? h + 12 : h
}

function formatDisplay(value: string): string {
  const parsed = parseValue(value)
  if (!parsed) return ""
  const { hour12, meridiem } = to12Hour(parsed.hour24)
  return `${String(hour12).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")} ${meridiem}`
}

/** Angle in degrees, clockwise from 12 o'clock (0deg = top). */
function angleFromCenter(cx: number, cy: number, px: number, py: number): number {
  const dx = px - cx
  const dy = py - cy
  let deg = (Math.atan2(dx, -dy) * 180) / Math.PI
  if (deg < 0) deg += 360
  return deg
}

const SIZE = 224
const CENTER = SIZE / 2
const OUTER_RADIUS = SIZE / 2 - 16
const HOUR_HAND_RADIUS = OUTER_RADIUS * 0.55
const MINUTE_HAND_RADIUS = OUTER_RADIUS * 0.85

export function ClockTimePicker({
  id,
  value,
  onChange,
  disabled,
  placeholder = "Select time",
  className,
  defaultValue,
  defaultMeridiem = "AM",
}: ClockTimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [mode, setMode] = React.useState<"hour" | "minute">("hour")
  const faceRef = React.useRef<HTMLDivElement | null>(null)
  const draggingRef = React.useRef(false)

  const parsed = parseValue(value) ?? (defaultValue ? parseValue(defaultValue) : null)
  const { hour12, meridiem } = parsed ? to12Hour(parsed.hour24) : { hour12: 12, meridiem: defaultMeridiem }
  const minute = parsed ? parsed.minute : 0

  const commit = React.useCallback(
    (nextHour12: number, nextMinute: number, nextMeridiem: "AM" | "PM") => {
      const hour24 = to24Hour(nextHour12, nextMeridiem)
      onChange(`${String(hour24).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`)
    },
    [onChange]
  )

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) setMode("hour")
  }

  function updateFromPoint(clientX: number, clientY: number) {
    const face = faceRef.current
    if (!face) return
    const rect = face.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const deg = angleFromCenter(cx, cy, clientX, clientY)

    if (mode === "hour") {
      let h = Math.round(deg / 30) % 12
      if (h === 0) h = 12
      commit(h, minute, meridiem)
    } else {
      const m = Math.round(deg / 6) % 60
      commit(hour12, m, meridiem)
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (disabled) return
    draggingRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    updateFromPoint(e.clientX, e.clientY)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return
    updateFromPoint(e.clientX, e.clientY)
  }

  function handlePointerUp() {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (mode === "hour") setMode("minute")
  }

  function selectMeridiem(next: "AM" | "PM") {
    commit(hour12, minute, next)
  }

  const dialNumbers =
    mode === "hour"
      ? Array.from({ length: 12 }, (_, i) => i + 1)
      : Array.from({ length: 12 }, (_, i) => i * 5)

  const selectedAngle = mode === "hour" ? (hour12 % 12) * 30 : minute * 6
  const handRadius = mode === "hour" ? HOUR_HAND_RADIUS : MINUTE_HAND_RADIUS
  const handX = CENTER + handRadius * Math.sin((selectedAngle * Math.PI) / 180)
  const handY = CENTER - handRadius * Math.cos((selectedAngle * Math.PI) / 180)

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn("w-full justify-start font-normal", className)}
          />
        }
      >
        <ClockIcon className="h-4 w-4 text-muted-foreground" />
        {value && formatDisplay(value) ? formatDisplay(value) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode("hour")}
              className={cn(
                "rounded-md px-2 py-1 font-mono text-2xl font-semibold tabular-nums",
                mode === "hour" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              {String(hour12).padStart(2, "0")}
            </button>
            <span className="text-2xl font-semibold text-muted-foreground">:</span>
            <button
              type="button"
              onClick={() => setMode("minute")}
              className={cn(
                "rounded-md px-2 py-1 font-mono text-2xl font-semibold tabular-nums",
                mode === "minute" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              {String(minute).padStart(2, "0")}
            </button>
            <div className="ml-2 flex flex-col overflow-hidden rounded-md border">
              <button
                type="button"
                onClick={() => selectMeridiem("AM")}
                className={cn(
                  "px-2 py-0.5 text-xs font-medium",
                  meridiem === "AM" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => selectMeridiem("PM")}
                className={cn(
                  "px-2 py-0.5 text-xs font-medium",
                  meridiem === "PM" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
              >
                PM
              </button>
            </div>
          </div>

          <div
            ref={faceRef}
            className="relative touch-none rounded-full bg-muted select-none"
            style={{ width: SIZE, height: SIZE }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <svg width={SIZE} height={SIZE} className="pointer-events-none absolute inset-0">
              <circle cx={CENTER} cy={CENTER} r={3} className="fill-primary" />
              <line
                x1={CENTER}
                y1={CENTER}
                x2={handX}
                y2={handY}
                className="stroke-primary"
                strokeWidth={2}
                strokeLinecap="round"
              />
              <circle cx={handX} cy={handY} r={14} className="fill-primary/15 stroke-primary" strokeWidth={1.5} />
            </svg>
            {dialNumbers.map((n) => {
              const angle = mode === "hour" ? n * 30 : (n / 5) * 30
              const x = CENTER + OUTER_RADIUS * Math.sin((angle * Math.PI) / 180)
              const y = CENTER - OUTER_RADIUS * Math.cos((angle * Math.PI) / 180)
              const isSelected = mode === "hour" ? n === hour12 : n === minute
              return (
                <span
                  key={n}
                  className={cn(
                    "pointer-events-none absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-sm tabular-nums",
                    isSelected ? "bg-primary text-primary-foreground" : "text-foreground"
                  )}
                  style={{ left: x, top: y }}
                >
                  {mode === "hour" ? n : String(n).padStart(2, "0")}
                </span>
              )
            })}
          </div>

          <div className="flex w-full justify-end">
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
