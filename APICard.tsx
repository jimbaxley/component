import { motion } from "framer-motion"
import { useEffect, useState, startTransition, type CSSProperties } from "react"
import { addPropertyControls, ControlType, Data } from "framer"

interface FieldMapping {
    sourceField: string
    targetField: string
}

// Add Coda-specific interfaces
interface CodaColumn {
    id: string
    name: string
    display?: boolean
    url: string
    format: {
        type: string
        isArray?: boolean
        options?: {
            choices?: Array<{
                name: string
                id?: string
                url: string
            }>
        }
    }
}

interface CodaApiResponse<T> {
    items: T[]
    nextPageToken?: string
    nextPageLink?: string
}

function formatDate(dateString: string): string {
    if (!dateString) return "Date TBD"
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return "Date TBD"
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    })
}

function formatTime(dateString: string): string {
    if (!dateString) return ""
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return ""
    return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    })
}

function CardButton({
    signupUrl,
    buttonText,
    cardFont,
}: {
    signupUrl: string
    buttonText: string
    cardFont: any
}) {
    const [isHovered, setIsHovered] = useState(false)
    return (
        <button
            onClick={() => {
                if (signupUrl) window.open(signupUrl, "_blank")
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                ...cardFont,
                width: "100%",
                backgroundColor: isHovered ? "#ffa94d" : "#F7931E",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 8,
                padding: "12px 16px",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                transition: "background 0.2s",
                boxShadow: isHovered
                    ? "0 2px 8px rgba(247,147,30,0.15)"
                    : "none",
            }}
        >
            {buttonText || "SIGN UP NOW"}
        </button>
    )
}

// Add Coda field mapping function
function mapCodaTypeToFramerType(column: CodaColumn): any | null {
    const baseType = column.format.type.toLowerCase()
    const name = column.name.toLowerCase()
    const id = column.id.toLowerCase()

    // Skip button type columns
    if (baseType === "button") {
        return null
    }

    // Map as image if Coda type is 'image' or name/id contains 'image' or 'graphic'
    if (
        baseType === "image" ||
        name.includes("image") ||
        name.includes("graphic") ||
        id.includes("image") ||
        id.includes("graphic")
    ) {
        return {
            id: column.id,
            name: column.name,
            url: column.url,
            type: "image",
        }
    }
    // Enum mapping: if select/scale and has options.choices, map to string (remove enum support)
    if (
        (baseType === "select" || baseType === "scale") &&
        column.format.options &&
        Array.isArray(column.format.options.choices)
    ) {
        return {
            id: column.id,
            name: column.name,
            type: "string",
        }
    }
    switch (baseType) {
        case "text":
        case "email":
        case "phone":
            return {
                id: column.id,
                name: column.name,
                type: "string",
            }
        case "number":
        case "currency":
        case "percent":
        case "duration":
            return {
                id: column.id,
                name: column.name,
                type: "number",
            }
        case "checkbox":
            return {
                id: column.id,
                name: column.name,
                type: "boolean",
            }
        case "date": // Coda date-only
            return {
                id: column.id,
                name: column.name,
                type: "date", // Framer date type
            }
        case "datetime": // Coda date with time
            return {
                id: column.id,
                name: column.name,
                type: "date", // Framer date type (will store full ISO string with time)
            }
        case "time": // Coda time-only
            return {
                id: column.id,
                name: column.name,
                type: "string", // Framer string type for time-only values
            }
        case "image":
            return {
                id: column.id,
                name: column.name,
                type: "imageObject",
                url: column.url,
            }
        case "file":
            return {
                id: column.id,
                name: column.name,
                type: "file",
                allowedFileTypes: ["*"],
            }
        case "canvas":
        case "richtext":
            return {
                id: column.id,
                name: column.name,
                type: "formattedText",
            }
        case "person":
        case "lookup":
        case "reference":
            return {
                id: column.id,
                name: column.name,
                type: "string", // Changed from 'collectionReference' to 'string'
            }
        case "url":
        case "link":
            return {
                id: column.id,
                name: column.name,
                type: "link",
            }
        default:
            return {
                id: column.id,
                name: column.name,
                type: "string",
            }
    }
}

// Add function to extract values from Coda objects
function extractCodaValue(obj: any): string {
    if (obj === null || obj === undefined) {
        return ""
    }

    // If it's already a simple value, return it
    if (
        typeof obj === "string" ||
        typeof obj === "number" ||
        typeof obj === "boolean"
    ) {
        return String(obj)
    }

    // If it's an object, try to extract meaningful data
    if (typeof obj === "object") {
        // General object property extraction logic
        return (
            (typeof obj.rawValue === "string" && obj.rawValue) ||
            (typeof obj.value === "string" && obj.value) ||
            (typeof obj.displayValue === "string" && obj.displayValue) ||
            (typeof obj.name === "string" && obj.name) ||
            (typeof obj.content === "string" && obj.content) || // For rich text / canvas like objects
            String(obj) // Fallback: full stringification (might give [object Object])
        )
    }

    return String(obj)
}

interface APICardProps {
    apiUrl: string
    workerUrl: string
    columnsUrl: string
    limit: number
    collection: any
    cardTemplate: any
    fieldMappings: FieldMapping[]
    layoutType: "fixed" | "auto"
    columnsPerRow: number
    minCardWidth: number
    gap: number
    cardFont: any

    // Add field mapping properties
    imageFieldMapping: string
    titleFieldMapping: string
    categoryFieldMapping: string
    locationFieldMapping: string
    descriptionFieldMapping: string
    dateFieldMapping: string
    signupUrlFieldMapping: string
    startTimeFieldMapping: string

    style?: CSSProperties
}

/**
 * API Card Loader
 *
 * Fetches data from an API and displays cards with the fetched data.
 * Built-in card component eliminates the need for complex field mapping.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
export default function APICard(props: APICardProps) {
    const {
        apiUrl,
        columnsUrl,
        limit,
        layoutType,
        columnsPerRow,
        minCardWidth,
        gap,
        style,
    } = props
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [records, setRecords] = useState<any[]>([])
    const [availableColumns, setAvailableColumns] = useState<string[]>([])
    const [columnMapping, setColumnMapping] = useState<{
        [key: string]: string
    }>({})
    const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set())
    const workerEndpoint =
        props.workerUrl || "https://c2c-published.jim-d63.workers.dev/"

    // Fetch columns first, then data
    useEffect(() => {
        const fetchData = async () => {
            if (!apiUrl) return

            setLoading(true)
            setError(null)

            try {
                const response = await fetch(
                    `${workerEndpoint}?apiUrl=${encodeURIComponent(props.apiUrl)}`
                )
                if (!response.ok)
                    throw new Error(
                        `API request failed with status ${response.status}`
                    )
                const result = await response.json()

                if (!response.ok)
                    throw new Error(
                        `API request failed with status ${response.status}`
                    )

                let fetchedRecords = Array.isArray(result)
                    ? result
                    : result.data ||
                      result.records ||
                      result.items ||
                      result.results ||
                      []

                // Sort by start field (ascending)
                fetchedRecords = fetchedRecords.sort((a, b) => {
                    const aDate = new Date(
                        a.values?.[props.dateFieldMapping] ||
                            a[props.dateFieldMapping]
                    )
                    const bDate = new Date(
                        b.values?.[props.dateFieldMapping] ||
                            b[props.dateFieldMapping]
                    )
                    return aDate.getTime() - bDate.getTime()
                })
                // Apply limit if specified
                if (limit > 0) {
                    fetchedRecords = fetchedRecords.slice(0, limit)
                }

                console.log("Records retrieved:", fetchedRecords.length)

                startTransition(() => {
                    setRecords(fetchedRecords)
                    setLoading(false)
                })
            } catch (err) {
                console.error("API fetch error:", err)
                startTransition(() => {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Failed to fetch data"
                    )
                    setLoading(false)
                })
            }
        }

        if (typeof window !== "undefined") {
            fetchData()
        }
    }, [props.apiUrl, props.workerUrl, limit])

    const [selectedType, setSelectedType] = useState("ALL")
    const [hoveredCard, setHoveredCard] = useState<number | null>(null)
    const [tooltipPos, setTooltipPos] = useState<{
        x: number
        y: number
    } | null>(null)
    const [tooltipContent, setTooltipContent] = useState<string | null>(null)

    const filteredRecords =
        selectedType === "ALL"
            ? records
            : records.filter((record) => {
                  const typeField =
                      record.values?.[props.categoryFieldMapping] ||
                      record[props.categoryFieldMapping]
                  return typeField?.toLowerCase() === selectedType.toLowerCase()
              })

    const renderCard = (record: any, index: number) => {
        const isExpanded = expandedCards.has(index)

        // Direct value extraction using property controls only
        const imageField =
            record.values?.[props.imageFieldMapping] ||
            record[props.imageFieldMapping]
        const typeField =
            record.values?.[props.categoryFieldMapping] ||
            record[props.categoryFieldMapping]
        const nameField =
            record.values?.[props.titleFieldMapping] ||
            record[props.titleFieldMapping]
        const locationField =
            record.values?.[props.locationFieldMapping] ||
            record[props.locationFieldMapping]
        const descriptionField =
            record.values?.[props.descriptionFieldMapping] ||
            record[props.descriptionFieldMapping]
        const startField =
            record.values?.[props.dateFieldMapping] ||
            record[props.dateFieldMapping]
        const startTimeField =
            record.values?.[props.startTimeFieldMapping] ||
            record[props.startTimeFieldMapping]
        const signupUrl =
            record.values?.[props.signupUrlFieldMapping] ||
            record[props.signupUrlFieldMapping]

        // Extract image URL from Coda image object structure
        let imageUrl = null

        if (imageField) {
            if (Array.isArray(imageField)) {
                // Find first object with a url property
                const found = imageField.find(
                    (img) =>
                        img &&
                        typeof img === "object" &&
                        typeof img.url === "string"
                )
                if (found) imageUrl = found.url
            } else if (
                typeof imageField === "object" &&
                typeof imageField.url === "string"
            ) {
                imageUrl = imageField.url
            } else if (typeof imageField === "string") {
                imageUrl = imageField
            }
        }
        // Use a variable for hover state
        let isHovered = false

        return (
            <div
                key={index}
                style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: 12,
                    overflow: "hidden",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                    display: "flex",
                    flexDirection: "column",
                    minWidth: layoutType === "auto" ? minCardWidth : undefined,
                    height: "100%", // Ensure card takes full height in grid
                }}
            >
                {/* Image Section */}
                <div
                    style={{
                        position: "relative",
                        width: "100%",
                        paddingTop: "52.5%", // 630 / 1200 = 0.525
                        backgroundColor: "#F5F5F5",
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    {imageUrl ? (
                        <img
                            src={imageUrl}
                            alt="Event image"
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                            }}
                        />
                    ) : (
                        <div
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: "100%",
                                backgroundImage:
                                    "linear-gradient(45deg, #E0E0E0 25%, transparent 25%), linear-gradient(-45deg, #E0E0E0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #E0E0E0 75%), linear-gradient(-45deg, transparent 75%, #E0E0E0 75%)",
                                backgroundSize: "20px 20px",
                                backgroundPosition:
                                    "0 0, 0 10px, 10px -10px, -10px 0px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <span style={{ color: "#999", fontSize: 14 }}>
                                No Image
                            </span>
                        </div>
                    )}
                </div>

                {/* Content Section */}
                <div
                    style={{
                        padding: 20,
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    {/* Category - mapped to Type field */}
                    <div
                        style={{
                            ...props.cardFont,
                            fontSize: 9,
                            fontWeight: 600,
                            color: "#666",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            marginBottom: 8,
                        }}
                    >
                        {typeField || "EVENT"}
                    </div>

                    {/* Title - mapped to Name field */}
                    <h3
                        style={{
                            ...props.cardFont,
                            fontSize: 18,
                            fontWeight: 700,
                            color: "#F7931E",
                            margin: "0 0 16px 0",
                            lineHeight: 1.1,
                        }}
                    >
                        {nameField || "Event Title"}
                    </h3>

                    {/* Date - mapped to Start field */}
                    <div
                        style={{
                            ...props.cardFont,
                            display: "flex",
                            alignItems: "center",
                            marginBottom: 8,
                            fontSize: 12,
                            color: "#666",
                        }}
                    >
                        <span style={{ marginRight: 8 }}>📅</span>
                        {startField ? formatDate(startField) : "Date TBD"}
                        {startTimeField && (
                            <span style={{ marginLeft: 8 }}>
                                🕒 {formatTime(startTimeField)}
                            </span>
                        )}
                    </div>

                    {/* Location */}
                    <div
                        style={{
                            ...props.cardFont,
                            display: "flex",
                            alignItems: "center",
                            marginBottom: 8,
                            fontSize: 12,
                            color: "#666",
                        }}
                    >
                        <span style={{ marginRight: 8 }}>📍</span>
                        {locationField || "Location TBD"}
                    </div>

                    {/* Show Details Tooltip Icon */}
                    <div
                        style={{
                            ...props.cardFont,
                            display: "flex",
                            alignItems: "center",
                            marginBottom: 16,
                            fontSize: 12,
                            color: "#666",
                            position: "relative", // Needed for tooltip positioning
                        }}
                    >
                        <span
                            // style={{ marginRight: 8, cursor: "pointer" }}
                            onMouseEnter={(e) => {
                                setHoveredCard(index)
                                setTooltipPos({ x: e.clientX, y: e.clientY })
                                setTooltipContent(
                                    descriptionField ||
                                        "No additional details available."
                                )
                            }}
                            onMouseMove={(e) => {
                                setTooltipPos({ x: e.clientX, y: e.clientY })
                            }}
                            onMouseLeave={() => {
                                setHoveredCard(null)
                                setTooltipPos(null)
                                setTooltipContent(null)
                            }}
                        >
                            ℹ️{""}
                            <span
                                style={{
                                    marginLeft: 8,
                                    cursor: "pointer",
                                }}
                            >
                                Details
                            </span>
                        </span>
                    </div>

                    {/* Sign Up Button */}
                    <div style={{ marginTop: "auto" }}>
                        <CardButton
                            signupUrl={signupUrl}
                            buttonText={record.buttonText}
                            cardFont={props.cardFont}
                        />
                    </div>
                </div>
            </div>
        )
    }

    const gridStyle: CSSProperties = {
        display: "grid",
        gap: gap,
        ...(layoutType === "fixed"
            ? { gridTemplateColumns: `repeat(${columnsPerRow}, 1fr)` }
            : {
                  gridTemplateColumns: `repeat(auto-fill, minmax(${minCardWidth}px, 1fr))`,
              }),
    }
    const typeOptions = ["ALL", "Phone Bank", "Canvass", "Meeting"]

    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                minWidth: 200,
                minHeight: 100,
                ...style,
            }}
        >
            {/* Type Toggle */}
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
                {typeOptions.map((type) => (
                    <button
                        key={type}
                        onClick={() => setSelectedType(type)}
                        style={{
                            background:
                                selectedType === type ? "#1769aa" : "none",
                            color: selectedType === type ? "#fff" : "#F7931E",
                            border: "none",
                            borderRadius: 6,
                            padding: "4px 4px",
                            fontWeight: 700,
                            cursor: "pointer",
                            fontSize: 12,
                            letterSpacing: "0.5px",
                            transition: "background 0.2s",
                        }}
                    >
                        {type.toUpperCase()}
                    </button>
                ))}
            </div>
            {loading && (
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        //backgroundColor: "rgba(255, 255, 255, 0.8)",
                        zIndex: 10,
                    }}
                >
                    <div
                        style={{
                            ...props.cardFont,
                            display: "flex",
                            alignItems: "center",
                            marginBottom: 8,
                            fontSize: 14,
                            color: "#666",
                        }}
                    >
                        <span style={{ marginRight: 8 }}>
                            Loading the latest signups!
                        </span>
                    </div>
                    <div
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            border: "3px solid #f3f3f3",
                            borderTop: "3px solid #F7931E",
                            animation: "spin 1s linear infinite",
                        }}
                    />
                </div>
            )}

            {error && (
                <div
                    style={{
                        padding: 16,
                        backgroundColor: "#ffebee",
                        color: "#c62828",
                        borderRadius: 8,
                        margin: 16,
                        minHeight: 50,
                    }}
                >
                    Error: {error}
                </div>
            )}

            {!loading && !error && records.length === 0 && (
                <div
                    style={{
                        padding: 16,
                        backgroundColor: "#e8f5e9",
                        color: "#2e7d32",
                        borderRadius: 8,
                        margin: 16,
                        minHeight: 50,
                    }}
                >
                    No data found
                </div>
            )}

            {!loading && !error && filteredRecords.length > 0 && (
                <div style={gridStyle}>
                    {filteredRecords.map((record, index) => (
                        <motion.div
                            key={
                                record.id
                                    ? record.id
                                    : `${record[props.titleFieldMapping] || "card"}-${record[props.categoryFieldMapping] || "type"}-${index}`
                            }
                            layout // <-- enables shuffle animation
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{
                                type: "spring",
                                stiffness: 400,
                                damping: 30,
                            }}
                        >
                            {renderCard(record, index)}
                        </motion.div>
                    ))}
                    {/* Tooltip rendered at root level */}
                    {hoveredCard !== null && tooltipPos && tooltipContent && (
                        <div
                            style={{
                                ...props.cardFont,
                                position: "fixed",
                                left: tooltipPos.x,
                                top: tooltipPos.y,
                                transform: "translateY(8px)",
                                zIndex: 9999,
                                background: "#F9F9F9",
                                color: "#666",
                                borderRadius: 8,
                                boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                                padding: 16,
                                fontSize: 12,
                                lineHeight: 1.5,
                                minWidth: 180,
                                pointerEvents: "none",
                                maxWidth: 320,
                            }}
                        >
                            {tooltipContent}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

addPropertyControls(APICard, {
    workerUrl: {
        type: ControlType.String,
        title: "Worker URL",
        defaultValue: "https://your-worker-url.workers.dev",
    },
    apiUrl: {
        type: ControlType.String,
        title: "API URL",
        defaultValue: "https://jsonplaceholder.typicode.com/posts",
    },

    limit: {
        type: ControlType.Number,
        title: "Limit",
        defaultValue: 0,
        min: 0,
        max: 100,
        step: 1,
    },
    layoutType: {
        type: ControlType.Enum,
        title: "Layout Type",
        options: ["fixed", "auto"],
        optionTitles: ["Fixed Columns", "Auto Grid"],
        defaultValue: "fixed",
        displaySegmentedControl: true,
    },
    columnsPerRow: {
        type: ControlType.Number,
        title: "Columns",
        defaultValue: 3,
        min: 1,
        max: 6,
        step: 1,
        hidden: (props) => props.layoutType === "auto",
    },
    minCardWidth: {
        type: ControlType.Number,
        title: "Min Card Width",
        defaultValue: 250,
        min: 100,
        max: 500,
        step: 1,
        unit: "px",
        hidden: (props) => props.layoutType === "fixed",
    },
    gap: {
        type: ControlType.Number,
        title: "Gap",
        defaultValue: 16,
        min: 0,
        max: 50,
        step: 1,
        unit: "px",
    },
    cardFont: {
        type: ControlType.Font,
        title: "Card Font",
        defaultValue: {
            fontSize: "14px",
            variant: "Medium",
            letterSpacing: "-0.01em",
            lineHeight: "1.3em",
        },
        controls: "extended",
        defaultFontType: "sans-serif",
    },
    imageFieldMapping: {
        type: ControlType.String,
        title: "Image Field Mapping",
        defaultValue: "Graphic",
    },
    titleFieldMapping: {
        type: ControlType.String,
        title: "Title Field Mapping",
        defaultValue: "Name",
    },
    categoryFieldMapping: {
        type: ControlType.String,
        title: "Category Field Mapping",
        defaultValue: "Type",
    },
    locationFieldMapping: {
        type: ControlType.String,
        title: "Location Field Mapping",
        defaultValue: "Location",
    },
    descriptionFieldMapping: {
        type: ControlType.String,
        title: "Description Field Mapping",
        defaultValue: "Description",
    },
    dateFieldMapping: {
        type: ControlType.String,
        title: "Date Field Mapping",
        defaultValue: "Start",
    },
    startTimeFieldMapping: {
        type: ControlType.String,
        title: "Start Time Field Mapping",
        defaultValue: "Start Time",
    },

    signupUrlFieldMapping: {
        type: ControlType.String,
        title: "Signup URL Field Mapping",
        defaultValue: "Signup URL",
    },
})
