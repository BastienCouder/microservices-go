"use client"

import * as React from "react"
import { format } from "date-fns"
import { enUS, fr } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"
import { useIntlayer } from "react-intlayer"
import { useLocale } from "next-intlayer"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

export function DatePickerWithRange({
    className,
    date,
    setDate,
    period,
    setPeriod,
}: {
    className?: string
    date: DateRange | undefined
    setDate: (date: DateRange | undefined) => void
    period: string
    setPeriod: (period: string) => void
}) {
    const content = useIntlayer("dashboard-left-col");
    const { locale } = useLocale();
    const dateFnsLocale = locale === "fr" ? fr : enUS;
    const resetToDefaultLabel =
      typeof content.resetToDefault === "string" && content.resetToDefault.length > 0
        ? content.resetToDefault
        : locale === "fr"
          ? "Réinitialiser par défaut"
          : "Reset to default";

    const [open, setOpen] = React.useState(false)

    const handlePreset = (val: string) => {
        setPeriod(val);
        setOpen(false);
    }

    const handleReset = () => {
        setPeriod('7d');
        setOpen(false);
    }

    // Label logic
    const getLabel = () => {
        if (period === 'custom' && date?.from) {
            if (date.to) {
                return `${format(date.from, "LLL dd, y", { locale: dateFnsLocale })} - ${format(date.to, "LLL dd, y", { locale: dateFnsLocale })}`
            }
            return format(date.from, "LLL dd, y", { locale: dateFnsLocale })
        }
        switch (period) {
            case 'today': return content.today24h;
            case '7d': return content.last7Days;
            case '14d': return content.last14Days;
            case '30d': return content.last30Days;
            case '90d': return content.last3Months;
            default: return content.pickDate;
        }
    }

    return (
        <div className={cn("grid gap-2", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "h-8 w-full justify-start text-left text-xs font-normal",
                            !date && period === 'custom' && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        <span className="min-w-0 truncate">{getLabel()}</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[calc(100vw-1rem)] p-0 sm:w-auto" align="start">
                    <div className="flex flex-col sm:flex-row">
                        {/* Sidebar */}
                        <div className="flex w-full flex-col gap-1 border-b p-2 sm:w-[180px] sm:border-b-0 sm:border-r">
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn("h-auto min-h-8 justify-start whitespace-normal text-left text-xs font-normal leading-tight", period === 'today' && "bg-accent text-accent-foreground")}
                                onClick={() => handlePreset('today')}
                            >
                                {content.today24h}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn("h-auto min-h-8 justify-start whitespace-normal text-left text-xs font-normal leading-tight", period === '7d' && "bg-accent text-accent-foreground")}
                                onClick={() => handlePreset('7d')}
                            >
                                {content.last7Days}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn("h-auto min-h-8 justify-start whitespace-normal text-left text-xs font-normal leading-tight", period === '14d' && "bg-accent text-accent-foreground")}
                                onClick={() => handlePreset('14d')}
                            >
                                {content.last14Days}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn("h-auto min-h-8 justify-start whitespace-normal text-left text-xs font-normal leading-tight", period === '30d' && "bg-accent text-accent-foreground")}
                                onClick={() => handlePreset('30d')}
                            >
                                {content.last30Days}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn("h-auto min-h-8 justify-start whitespace-normal text-left text-xs font-normal leading-tight", period === '90d' && "bg-accent text-accent-foreground")}
                                onClick={() => handlePreset('90d')}
                            >
                                {content.last3Months}
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 h-auto min-h-8 justify-center whitespace-normal px-2 py-1 text-xs leading-tight"
                                onClick={handleReset}
                            >
                                {resetToDefaultLabel}
                            </Button>
                        </div>

                        {/* Calendar */}
                        <div className="overflow-x-auto p-0">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={date?.from}
                                selected={date}
                                onSelect={(newDate) => {
                                    setDate(newDate);
                                    // setDate inside store automatically sets period='custom', 
                                    // but if we need manual control we could do it here too.
                                }}
                                numberOfMonths={1}
                                locale={dateFnsLocale}
                            />
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
