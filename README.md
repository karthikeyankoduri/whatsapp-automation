#WhatsApp Campaign Automation

A **secure, browser-based WhatsApp campaign dispatcher** that lets you upload contact lists, compose personalized messages (with optional image attachments), and fire them to an **n8n webhook** — which handles the actual WhatsApp delivery via the WhatsApp Business API or any WhatsApp messaging provider.

> **Architecture in one line:** React SPA → n8n Webhook → WhatsApp Business API

---

## 📸 Overview

```
┌─────────────────────────────────────────────────────┐
│              React Web App (Frontend)               │
│                                                     │
│  ┌──────────┐  ┌────────────┐  ┌─────────────────┐ │
│  │ Uploads  │  │ Campaigns  │  │   Preferences   │ │
│  │   Tab    │  │    Tab     │  │      Tab        │ │
│  └──────────┘  └────────────┘  └─────────────────┘ │
└────────────────────────┬────────────────────────────┘
                         │ multipart/form-data POST
                         ▼
┌────────────────────────────────────────────────────┐
│                  n8n Webhook Node                  │
│                                                    │
│  ┌─────────────┐   ┌──────────────────────────┐   │
│  │ Parse Body  │──▶│  Loop over recipients[]  │   │
│  └─────────────┘   └────────────┬─────────────┘   │
│                                 │                  │
│                    ┌────────────▼────────────┐     │
│                    │  HTTP Request Node      │     │
│                    │  (WhatsApp Business API)│     │
│                    └─────────────────────────┘     │
└────────────────────────────────────────────────────┘
                         │
                         ▼
              📲 WhatsApp Messages Delivered
```

---

## ✨ Features

| Feature | Details |
|---|---|
| 📁 **CSV & Excel Upload** | Upload `.csv`, `.xlsx`, or `.xls` contact files with any column layout |
| 🗂️ **Column Mapping** | Flexible name/phone column picker — auto-guesses on upload |
| 🎯 **Recipient Selection** | Filter by row range or free-text search (name, phone, row number) |
| 👁️ **Live Preview** | See exactly who will receive the message before dispatching |
| ✉️ **Message Personalization** | Use `{{name}}` placeholder for per-contact name injection |
| 🖼️ **Image Attachment** | Drag-and-drop or browse an image (JPG/PNG/WEBP/GIF, max 5 MB) |
| 📊 **Campaign History** | Timestamped log of all dispatched campaigns with status |
| 🔒 **Security Suite** | 8 active hardening layers (see Security section below) |
| ⚡ **Rate Limiting** | Built-in 30-second cooldown between dispatches to prevent abuse |
| 🌐 **n8n Integration** | Sends structured `multipart/form-data` payload to any n8n webhook |

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React 19 + TypeScript |
| **Build Tool** | Vite 8 |
| **Styling** | Tailwind CSS v4 |
| **Icons** | Lucide React |
| **CSV Parsing** | PapaParse |
| **Excel Parsing** | SheetJS (xlsx) |
| **Toast Notifications** | react-hot-toast |
| **State / Storage** | Custom `Store` class over obfuscated `localStorage` |
| **Automation Backend** | n8n (self-hosted or cloud) |

---

## 📁 Project Structure

```
whatsapp-automation/
└── stitch/                     # React app root
    ├── src/
    │   ├── App.tsx             # Root layout + tab router
    │   ├── components/
    │   │   ├── Dashboard.tsx       # Campaigns tab wrapper
    │   │   ├── CampaignForm.tsx    # Campaign composer form
    │   │   ├── CampaignTable.tsx   # Campaign history table
    │   │   ├── UploadsTab.tsx      # Contact file uploader + preview
    │   │   ├── PreferencesTab.tsx  # Webhook URL config + security status
    │   │   └── SecurityBadge.tsx   # Security indicator in sidebar
    │   └── lib/
    │       ├── store.ts            # Data layer (contacts, batches, campaigns)
    │       └── security.ts         # All security utilities
    ├── index.html
    ├── vite.config.ts
    └── package.json
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or later
- **n8n** (self-hosted or [n8n Cloud](https://n8n.io)) with a configured workflow

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/whatsapp-automation.git
cd whatsapp-automation/stitch
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Configure Your n8n Webhook URL

1. Navigate to the **Preferences** tab in the app.
2. Paste your n8n Webhook URL (must start with `https://`).
3. Click **Save Configuration**.

---

## 📋 How to Use

### Step 1 — Upload Contacts

1. Go to the **Uploads** tab.
2. Drag & drop or click to browse your `.csv` or `.xlsx` file.
3. The app auto-detects all column headers and stores your contacts securely.
4. A preview modal opens immediately after upload.

> **Column format:** Any layout is accepted. You map Name and Phone columns later in the campaign form. Example columns: `Name`, `Mobile`, `Company`, `Email` — any combination works.

### Step 2 — Create a Campaign

1. Go to the **Campaigns** tab.
2. Select your uploaded file from the dropdown.
3. Map the **Name column** and **Phone column** using the column pickers.
4. Type your message. Use `{{name}}` to personalize per recipient.
5. Optionally attach an image (drag-and-drop or click to browse).
6. Choose recipients:
   - **By Range** — enter start and end row numbers.
   - **By Search** — search by name, phone, or exact row number.
7. Review the **Live Preview** table showing selected contacts.
8. Click **Dispatch Messages**.

### Step 3 — Monitor Results

- The **Campaigns** tab shows a history of all dispatched campaigns.
- Each entry shows: Campaign ID, message preview, targeting mode, status (Completed / Failed), and timestamp.

---

## 🔌 n8n Integration

### Webhook Payload

The app sends a `POST` request with `multipart/form-data` content type containing:

| Field | Type | Description |
|---|---|---|
| `campaign_id` | `string` | Unique 7-character alphanumeric ID |
| `message` | `string` | The message template text |
| `recipients` | `string` (JSON) | JSON-encoded array of recipient objects |
| `image` | `File` *(optional)* | Binary image file if one was attached |

#### `recipients` JSON structure

```json
[
  {
    "row_number": 1,
    "name": "Alice",
    "phone": "+919876543210",
    "message": "Hi Alice, we have a special offer for you!"
  },
  {
    "row_number": 2,
    "name": "Bob",
    "phone": "+919123456789",
    "message": "Hi Bob, we have a special offer for you!"
  }
]
```

> `message` in each recipient entry already has `{{name}}` replaced with their actual name — no substitution needed in n8n.

---

### n8n Workflow Setup

#### 1. Add a Webhook Node

- **Method:** `POST`
- **Response Mode:** `Immediately` (or `When Last Node Finishes` for synchronous feedback)
- Copy the **Production URL** and paste it into the app's Preferences tab.

#### 2. Parse the Recipients

Add a **Code** node (or **Set** node) to parse the JSON string from the form body:

```javascript
// Code node — parse recipients JSON
const recipients = JSON.parse($input.first().json.body.recipients);
return recipients.map(r => ({ json: r }));
```

#### 3. Loop Over Recipients

Add a **SplitInBatches** node (or use the **Loop Over Items** node in newer n8n) connected to the Code node output. Set **Batch Size** to `1` to process one contact at a time.

#### 4. Send WhatsApp Message

Add an **HTTP Request** node inside the loop:

- **Method:** `POST`
- **URL:** `https://graph.facebook.com/v19.0/<YOUR_PHONE_NUMBER_ID>/messages`
- **Authentication:** Header Auth → `Authorization: Bearer <YOUR_WHATSAPP_TOKEN>`
- **Body Type:** JSON

**Body (text message):**
```json
{
  "messaging_product": "whatsapp",
  "to": "{{ $json.phone }}",
  "type": "text",
  "text": {
    "body": "{{ $json.message }}"
  }
}
```

**Body (image message — when `image` field is present):**
```json
{
  "messaging_product": "whatsapp",
  "to": "{{ $json.phone }}",
  "type": "image",
  "image": {
    "link": "<publicly-accessible-image-url>",
    "caption": "{{ $json.message }}"
  }
}
```

> **Tip:** If an image is attached, first upload it to your media server (e.g., upload to S3 / Cloudinary in a separate node), get the public URL, then use it in the image message body.

#### 5. Handle the Image (Optional)

To handle the binary image from the webhook:

1. **Binary Data** is available as `$binary.image` in the Webhook node output.
2. Add an **HTTP Request** node to upload it to your media host (S3, Cloudinary, etc.).
3. Use the returned URL in your WhatsApp image message node.

#### Full n8n Workflow (Example)

```
[Webhook] → [Code: Parse Recipients] → [Loop Over Items]
                                              │
                                    ┌─────────▼──────────┐
                                    │ Has image?          │
                                    │  YES → Upload Image │
                                    │   → Send WA Image  │
                                    │  NO  → Send WA Text │
                                    └─────────────────────┘
```

---

## 🔒 Security Features

The app implements **8 hardening layers** out of the box:

| # | Protection | How it Works |
|---|---|---|
| 1 | **Input Sanitization** | Strips HTML tags, `javascript:` protocols, and `on*` event handlers from all user inputs before sending |
| 2 | **Formula Injection Guard** | Cells starting with `=`, `+`, `-`, `@` are prefixed with `'` to prevent CSV DDE attacks |
| 3 | **File Upload Validation** | Checks extension, MIME type, file size (≤ 10 MB), and empty file |
| 4 | **Image Validation** | Validates image MIME, extension, and size (≤ 5 MB) before attaching |
| 5 | **HTTPS-Only Webhooks** | Rejects any webhook URL not starting with `https://` |
| 6 | **SSRF Prevention** | Blocks private IPs, localhost, and loopback addresses in webhook URL |
| 7 | **Rate Limiting** | Enforces a 30-second cooldown between campaign dispatches |
| 8 | **Data Obfuscation** | All localStorage data is Base64-encoded with a namespace prefix to deter casual snooping |

---

## 🛠️ Build for Production

```bash
npm run build
```

Output is in `stitch/dist/`. Serve with any static host (Netlify, Vercel, Firebase Hosting, Nginx, etc.).

---

## 🤝 Contributing

1. Fork the repo
2. Create your feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📄 License

MIT — feel free to use and adapt this project for your own campaigns.

---

## 🙋 FAQ

**Q: Does the app send WhatsApp messages directly?**  
A: No. The app is a frontend-only dispatcher. It sends a structured payload to your n8n webhook, which handles the actual WhatsApp API calls. This keeps API credentials off the browser entirely.

**Q: Is contact data stored on a server?**  
A: No. All contact data lives in your browser's `localStorage`, obfuscated with Base64. Nothing is sent to any server except the webhook when you dispatch a campaign.

**Q: What's the maximum number of contacts I can upload?**  
A: The app enforces a hard limit of **50,000 rows** per batch to prevent browser memory issues.

**Q: Can I use this with any WhatsApp provider?**  
A: Yes. The n8n workflow can connect to **Meta's official WhatsApp Business API**, **Twilio**, **360dialog**, **Gupshup**, or any provider that accepts HTTP requests. Just update the HTTP Request node URL and auth headers accordingly.

**Q: Why is there a 30-second cooldown between sends?**  
A: To prevent accidental double-sends (e.g., clicking Dispatch twice) and to respect rate limits on the WhatsApp API side.
