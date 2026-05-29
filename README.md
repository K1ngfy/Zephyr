# Zephyr - Minimalist English Assistant

Zephyr is a lightweight, beautifully designed Chrome Extension (Manifest V3) that serves as your personal English speaking and listening assistant. It is built with React, Tailwind CSS, and powered by **Volcengine (豆包大模型 & TTS 2.0)**. 

Zephyr operates on a **Bring Your Own Key (BYOK)** model, meaning no API keys are hardcoded. It relies entirely on your own Volcengine credentials, ensuring your data and usage are fully under your control.

## 🌟 Features

- **Read Aloud (Selection):** Select any text on a webpage, right-click, and choose "Read Aloud" to hear native-sounding TTS with gapless streaming narration.
- **Explain & Read:** Highlight complex vocabulary or grammar, and get an instant AI-powered explanation via an elegant, Shadow DOM-isolated popover, followed by an audio narration.
- **Floating Assistant:** A draggable, minimalist "Pet" icon sits on your screen. Click it to open a clean chat interface where you can ask questions or use the `/read` command to test TTS out loud.
- **Apple-Style Minimalism:** The UI is heavily inspired by clean, high-contrast, breathing-room-heavy design principles. Only essential elements are visible, and everything is packaged neatly with fluid animations.

## 🏗️ Architecture

- **Manifest V3:** The extension strictly follows the latest Chrome Extension API guidelines.
- **Frontend:** React + Tailwind CSS, bundled with Vite. 
- **Shadow DOM:** All injected UI elements (popovers, the floating assistant) are wrapped in a Shadow DOM to prevent any host page CSS from bleeding in.
- **Background Service Worker:** Handles all Volcengine network requests. It uses HTTP Server-Sent Events (SSE) to stream TTS audio chunks (Base64 MP3) and LLM tokens directly to the content script in real-time.
- **AudioStreamer Engine:** A custom `AudioStreamer` class manages base64 MP3 chunks, utilizing the Web Audio API for gapless, continuous playback as the stream downloads.

## 🚀 Installation & Build

### Prerequisites
Make sure you have Node.js installed.

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the extension:**
   ```bash
   npm run build
   ```
   *This command will bundle the React application, background worker, and content scripts into the `dist/` directory.*

3. **Load into Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **Developer mode** in the top right corner.
   - Click **Load unpacked** and select the **`dist/`** folder (inside the project directory). *Do not select the root `zephyr` folder, or you will get a "Manifest file is missing" error.*

## ⚠️ Troubleshooting

1. **`vite: command not found` during build:**
   If `npm install` failed or aborted, `vite` won't be available. This can happen due to dependency conflicts with React 19. Run the following to force installation:
   ```bash
   npm install --legacy-peer-deps
   npm run build
   ```

2. **Manifest file missing error in Chrome:**
   Ensure you click "Load unpacked" and select the **`dist/`** folder, NOT the root project folder. The project builds the extension output into `dist/`.

## ⚙️ Configuration (Volcengine)

Upon first installation, Zephyr will guide you to configure your Volcengine Services.

1. **Enable Services:** Visit the [Volcengine Console](https://console.volcengine.com/) and enable both **Doubao LLM** and **Speech Synthesis (TTS) 2.0**.
2. **Get your API Key:** Generate a standard API Key from the API Keys management page.
3. **Get your Endpoint ID:** Create an endpoint for Doubao Pro or Doubao Lite. You will receive an Endpoint ID starting with `ep-` (e.g., `ep-202xxxxxxxx`).
4. **Enter in Zephyr:** Fill these two details into Zephyr's elegant onboarding Setup screen.

## 🛠️ Development

You can preview the Options and Setup UI locally using the Vite dev server, which includes mocked Chrome APIs for local testing without the extension wrapper:

```bash
npm run dev
```

*(Note: To test Context Menus and true Shadow DOM injection on live webpages, you must build and load it as a Chrome Extension as described above).*
