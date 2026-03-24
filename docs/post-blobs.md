# Post Blobs

## Overview

Post blobs are opaque JSON strings attached to posts that carry arbitrary off-schema data. The backend treats them as plain text — all parsing and rendering happens client-side.

A blob is a JSON array of typed entries:

```json
[
  { "type": "file", "version": 1, ... },
  { "type": "chart", "version": 1, ... }
]
```

## Entry Types

### file v1

Represents an uploaded file attachment.

| Field      | Type     | Required | Description           |
|------------|----------|----------|-----------------------|
| type       | `"file"` | yes      | Entry type identifier |
| version    | `1`      | yes      | Schema version        |
| fileUri    | string   | yes      | URI of uploaded file  |
| mimeType   | string   | no       | MIME type             |
| name       | string   | no       | Display filename      |
| size       | number   | yes      | File size in bytes    |

### voicememo v1

Represents a voice memo recording.

| Field            | Type          | Required | Description                          |
|------------------|---------------|----------|--------------------------------------|
| type             | `"voicememo"` | yes      | Entry type identifier                |
| version          | `1`           | yes      | Schema version                       |
| fileUri          | string        | yes      | URI of uploaded audio                |
| size             | number        | yes      | File size in bytes                   |
| transcription    | string        | no       | Text transcription                   |
| waveformPreview  | number[]      | no       | Waveform values (0-1)                |
| duration         | number        | no       | Duration in seconds                  |

### video v1

Represents a video attachment.

| Field      | Type       | Required | Description                    |
|------------|------------|----------|--------------------------------|
| type       | `"video"`  | yes      | Entry type identifier          |
| version    | `1`        | yes      | Schema version                 |
| fileUri    | string     | yes      | URI of uploaded video          |
| mimeType   | string     | no       | MIME type                      |
| name       | string     | no       | Display filename               |
| size       | number     | yes      | File size in bytes             |
| width      | number     | no       | Width in pixels                |
| height     | number     | no       | Height in pixels               |
| duration   | number     | no       | Duration in seconds            |
| posterUri  | string     | no       | Preview image URI              |

### chart v1

Represents a rich interactive chart. Primarily used by bots and agents to send data visualizations as message attachments.

| Field      | Type                                               | Required | Description                          |
|------------|----------------------------------------------------|----------|--------------------------------------|
| type       | `"chart"`                                          | yes      | Entry type identifier                |
| version    | `1`                                                | yes      | Schema version                       |
| chartType  | `"line" \| "bar" \| "pie" \| "area" \| "sparkline"` | yes      | Chart visualization type             |
| title      | string                                             | no       | Chart title                          |
| series     | Array\<Series\>                                    | yes      | Data series (see below)              |
| xLabels    | string[]                                           | no       | Labels for x-axis ticks              |
| yLabel     | string                                             | no       | Label for the y-axis                 |
| height     | number                                             | no       | Render height hint in logical pixels |

**Series object:**

| Field  | Type     | Required | Description                |
|--------|----------|----------|----------------------------|
| label  | string   | yes      | Series name (for legend)   |
| values | number[] | yes      | Numeric data points        |
| color  | string   | no       | CSS color for this series  |

**Example:**

```json
[
  {
    "type": "chart",
    "version": 1,
    "chartType": "bar",
    "title": "Monthly Revenue",
    "series": [
      { "label": "Product A", "values": [10, 20, 30, 25], "color": "#4C9AFF" },
      { "label": "Product B", "values": [5, 15, 10, 20], "color": "#F5A623" }
    ],
    "xLabels": ["Jan", "Feb", "Mar", "Apr"],
    "yLabel": "USD (thousands)"
  }
]
```

**Plaintext fallback:** `[Chart: Monthly Revenue]` (or `[Chart: bar]` if no title)

## Client Helpers

- `appendToPostBlob(blob, entry)` — append any entry to an existing blob string
- `appendFileUploadToPostBlob(blob, opts)` — convenience for file entries
- `appendVideoToPostBlob(blob, opts)` — convenience for video entries
- `appendChartToPostBlob(blob, opts)` — convenience for chart entries
- `parsePostBlob(blob)` — parse blob string to typed entries; unknown types degrade to `{ type: 'unknown' }`
