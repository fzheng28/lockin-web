// content.js

(function() {
    // Prevent script from running multiple times on the same page (e.g., in iframes)
    if (window.hasLockedInScript) {
        return;
    }
    window.hasLockedInScript = true;

    const STRIKE_LIMIT = 2; // Keep in sync with background.js

    // --- Webcam Frame Capture (for facial focus detection) ---
    let videoStream = null;
    let video = null;
    let canvas = null;
    let webcamInitialized = false;
    
    async function initWebcamCapture() {
      try {
        if (webcamInitialized || videoStream) return; // Already initialized or attempting
        webcamInitialized = true;
        
        videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, frameRate: 30 } });
        video = document.createElement('video');
        video.srcObject = videoStream;
        video.play();
        canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        console.log('✅ Webcam initialized for focus detection (30 FPS)');
      } catch (err) {
        webcamInitialized = false; // Reset flag on error so it can retry
        console.warn('⚠️  Webcam access denied or unavailable:', err.message);
      }
    }
    
    async function captureFrame() {
      try {
        if (!video || !canvas) {
          await initWebcamCapture();
        }
        if (!video || !canvas) {
          console.warn('Webcam not available');
          return null;
        }
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.8).split(',')[1]; // Base64 without data URL prefix
      } catch (err) {
        console.error('Error capturing frame:', err);
        return null;
      }
    }

    // --- Helper Functions ---
    function isSensitivePage() {
        const path = location.pathname.toLowerCase();
        if (path.includes('login') || path.includes('signin') || path.includes('signup')) {
            return true;
        }
        if (document.querySelector('input[type="password"]')) {
            return true;
        }
        const formWithAuthAction = document.querySelector('form[action*="login"], form[action*="signin"], form[action*="signup"]');
        return Boolean(formWithAuthAction);
    }

    function getPageSnippet() {
        try {
            if (isSensitivePage()) return '';

            const headings = Array.from(document.querySelectorAll('h1, h2'))
                .map(h => h.innerText)
                .filter(Boolean)
                .slice(0, 8);
            const combined = headings.join(' | ').replace(/\s+/g, ' ').trim();
            return combined.slice(0, 800);
        } catch (err) {
            console.warn('Could not extract page snippet:', err.message);
            return '';
        }
    }

    function injectFlagButton() {
        const button = document.createElement('button');
        button.id = 'locked-in-flag-button';
        button.title = 'Flag this site as a distraction (adds a strike)';
        button.innerHTML = '&#128681;'; // Flag emoji

        Object.assign(button.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: '2147483647',
            fontSize: '24px',
            padding: '8px 12px',
            border: '1px solid #fff',
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            color: 'white',
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
            transition: 'transform 0.2s ease, background-color 0.2s ease'
        });
        
        button.onmouseover = () => button.style.transform = 'scale(1.1)';
        button.onmouseout = () => button.style.transform = 'scale(1.0)';

        button.addEventListener('click', () => {
            console.log('Manual strike button clicked.');
            chrome.runtime.sendMessage({
                type: "MANUAL_STRIKE",
                data: { url: location.href }
            });
            button.style.backgroundColor = '#e53935';
            button.innerHTML = '&#10003;'; // Checkmark
            button.disabled = true;
        });

        const appendButton = () => {
            if (document.body && !document.getElementById(button.id)) {
                document.body.appendChild(button);
            } else {
                // If body is not yet available, retry after DOMContentLoaded
                if (document.readyState === "loading") {
                     document.addEventListener('DOMContentLoaded', appendButton, { once: true });
                } else {
                     console.warn("Could not append flag button: document.body not available or button already exists.");
                }
            }
        };

        appendButton(); // Attempt to append immediately or defer
    }

    function injectControlPanelButton() {
        ensureOverlayStyles();
        if (document.getElementById('locked-in-control-button')) return;

        const button = document.createElement('button');
        button.id = 'locked-in-control-button';
        button.className = 'lockedin-control-button';
        button.title = 'Open LockedIn controls';
        button.textContent = 'LOCK';

        button.addEventListener('click', () => {
            const panel = document.getElementById('locked-in-control-panel') || createControlPanel();
            const isOpen = panel.style.display === 'block';
            panel.style.display = isOpen ? 'none' : 'block';
            if (!isOpen) {
                refreshControlPanel(panel);
            }
        });

        const appendButton = () => {
            if (document.body && !document.getElementById(button.id)) {
                document.body.appendChild(button);
            } else {
                if (document.readyState === "loading") {
                    document.addEventListener('DOMContentLoaded', appendButton, { once: true });
                }
            }
        };

        appendButton();
    }

    function createControlPanel() {
        const existing = document.getElementById('locked-in-control-panel');
        if (existing) return existing;

        const panel = document.createElement('div');
        panel.id = 'locked-in-control-panel';
        panel.className = 'lockedin-control-panel';

        const header = document.createElement('div');
        header.className = 'lockedin-panel-header';

        const title = document.createElement('div');
        title.className = 'lockedin-panel-title';
        title.textContent = 'LOCK IN';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'lockedin-panel-close';
        closeBtn.textContent = 'Close';
        closeBtn.addEventListener('click', () => {
            panel.style.display = 'none';
        });

        header.appendChild(title);
        header.appendChild(closeBtn);

        const tagline = document.createElement('p');
        tagline.className = 'lockedin-panel-tagline';
        tagline.textContent = 'Attention is all you need; Time to LOCK IN';

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'lockedin-panel-button lockedin-panel-toggle';
        toggleBtn.id = 'locked-in-toggle-button';
        toggleBtn.dataset.state = 'inactive';
        toggleBtn.textContent = 'Attention Deactivated';

        toggleBtn.addEventListener('mouseenter', () => {
            const active = toggleBtn.dataset.state === 'active';
            toggleBtn.textContent = active ? 'Deactivate' : "I'm ready";
        });

        toggleBtn.addEventListener('mouseleave', () => {
            const active = toggleBtn.dataset.state === 'active';
            toggleBtn.textContent = active ? 'Attention Activated' : 'Attention Deactivated';
        });

        toggleBtn.addEventListener('click', () => {
            const active = toggleBtn.dataset.state === 'active';
            toggleBtn.disabled = true;
            if (active) {
                setPanelStatus(panel, 'Pausing attention...', '#f59e0b');
                sendPanelMessage({ message: "STOP_WARDEN" }, (response) => {
                    if (response && response.success) {
                        setPanelStatus(panel, 'Attention deactivated.', '#6b7280');
                        updateToggleButton(toggleBtn, false);
                        panel.style.display = 'none';
                    } else {
                        setPanelStatus(panel, 'Could not pause attention.', '#b91c1c');
                    }
                    toggleBtn.disabled = false;
                });
            } else {
                setPanelStatus(panel, 'Activating attention...', '#2563eb');
                sendPanelMessage({ message: "START_WARDEN" }, (response) => {
                    if (response && response.success) {
                        setPanelStatus(panel, 'Attention Activated.', '#059669');
                        updateToggleButton(toggleBtn, true);
                    } else {
                        setPanelStatus(panel, 'Signal sent, but no confirmation received.', '#b91c1c');
                    }
                    toggleBtn.disabled = false;
                });
            }
        });

        const status = document.createElement('div');
        status.className = 'lockedin-panel-status';
        status.textContent = '';

        const strikeSection = document.createElement('div');
        strikeSection.className = 'lockedin-panel-section';
        strikeSection.innerHTML = '<div class="lockedin-panel-label">Strike Progress</div>';
        const strikeList = document.createElement('div');
        strikeList.id = 'locked-in-strike-display';
        strikeList.className = 'lockedin-panel-list';
        strikeList.textContent = 'Domains with strikes will appear here...';
        strikeSection.appendChild(strikeList);

        const blacklistSection = document.createElement('div');
        blacklistSection.className = 'lockedin-panel-section';
        blacklistSection.innerHTML = '<div class="lockedin-panel-label">Hard Wall Blacklist</div>';
        const blacklistList = document.createElement('div');
        blacklistList.id = 'locked-in-blacklist-display';
        blacklistList.className = 'lockedin-panel-list';
        blacklistList.textContent = 'Your blocked domains will appear here...';

        const inputRow = document.createElement('div');
        inputRow.className = 'lockedin-panel-inputrow';
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'e.g., netflix.com';
        input.className = 'lockedin-panel-input';
        input.id = 'locked-in-blacklist-input';
        const addBtn = document.createElement('button');
        addBtn.className = 'lockedin-panel-button lockedin-panel-button-secondary';
        addBtn.textContent = 'Add';
        addBtn.addEventListener('click', () => addDomainFromPanel(panel));
        input.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') addDomainFromPanel(panel);
        });

        inputRow.appendChild(input);
        inputRow.appendChild(addBtn);

        blacklistSection.appendChild(blacklistList);
        blacklistSection.appendChild(inputRow);

        panel.appendChild(header);
        panel.appendChild(tagline);
        panel.appendChild(toggleBtn);
        panel.appendChild(status);
        panel.appendChild(strikeSection);
        panel.appendChild(blacklistSection);

        panel.style.display = 'none';
        document.body.appendChild(panel);
        return panel;
    }

    function setPanelStatus(panel, message, color) {
        const status = panel.querySelector('.lockedin-panel-status');
        if (status) {
            status.textContent = message;
            status.style.color = color;
        }
    }

    function sendPanelMessage(payload, callback) {
        try {
            chrome.runtime.sendMessage(payload, (response) => {
                if (chrome.runtime.lastError) {
                    if (callback) callback({ success: false, error: chrome.runtime.lastError.message });
                } else if (callback) {
                    callback(response);
                }
            });
        } catch (error) {
            if (callback) callback({ success: false, error: error.message });
        }
    }

    function refreshControlPanel(panel) {
        sendPanelMessage({ message: "GET_BLACKLIST" }, (response) => {
            if (response && response.success) {
                renderBlacklistPanel(panel, response.blacklist);
            }
        });
        sendPanelMessage({ message: "GET_STRIKE_COUNTS" }, (response) => {
            if (response && response.success) {
                renderStrikePanel(panel, response.strikeCounts);
            }
        });
        chrome.storage.local.get("monitoringState", (result) => {
            const toggleBtn = panel.querySelector('#locked-in-toggle-button');
            if (!toggleBtn) return;
            const active = Boolean(result && result.monitoringState);
            updateToggleButton(toggleBtn, active);
            if (!active) {
                setPanelStatus(panel, '', '#6b7280');
            }
        });
    }

    function updateToggleButton(button, active) {
        button.dataset.state = active ? 'active' : 'inactive';
        button.textContent = active ? 'Attention Activated' : 'Attention Deactivated';
        button.classList.toggle('lockedin-panel-button-active', active);
        button.classList.toggle('lockedin-panel-button-inactive', !active);
    }

    function renderBlacklistPanel(panel, domains) {
        const display = panel.querySelector('#locked-in-blacklist-display');
        if (!display) return;
        display.innerHTML = '';
        if (!domains || domains.length === 0) {
            display.textContent = 'No domains are currently blacklisted.';
            return;
        }
        domains.forEach(domain => {
            const item = document.createElement('div');
            item.className = 'lockedin-panel-item';
            const text = document.createElement('span');
            text.textContent = domain;
            const remove = document.createElement('button');
            remove.className = 'lockedin-panel-remove';
            remove.textContent = 'Remove';
            remove.addEventListener('click', () => {
                sendPanelMessage({ message: "REMOVE_FROM_BLACKLIST", domain }, (response) => {
                    if (response && response.success) renderBlacklistPanel(panel, response.blacklist);
                });
            });
            item.appendChild(text);
            item.appendChild(remove);
            display.appendChild(item);
        });
    }

    function renderStrikePanel(panel, strikeCounts) {
        const display = panel.querySelector('#locked-in-strike-display');
        if (!display) return;
        display.innerHTML = '';
        if (!strikeCounts || Object.keys(strikeCounts).length === 0) {
            display.textContent = 'No domains currently have strikes.';
            return;
        }
        for (const domain in strikeCounts) {
            const item = document.createElement('div');
            item.className = 'lockedin-panel-item';
            item.textContent = `${domain}: ${strikeCounts[domain]}/${STRIKE_LIMIT}`;
            display.appendChild(item);
        }
    }

    function addDomainFromPanel(panel) {
        const input = panel.querySelector('#locked-in-blacklist-input');
        if (!input) return;
        const domain = input.value.trim();
        if (!domain) return;
        sendPanelMessage({ message: "ADD_TO_BLACKLIST", domain }, (response) => {
            if (response && response.success) {
                renderBlacklistPanel(panel, response.blacklist);
                input.value = '';
            }
        });
    }
    
    function applyGlassDoorEffect(strikeCount = 0) {
        if (document.getElementById('locked-in-glass-overlay')) return;

        ensureOverlayStyles();

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'locked-in-glass-overlay';
        overlay.className = 'lockedin-overlay';

        const card = document.createElement('div');
        card.className = 'lockedin-card';

        const accent = document.createElement('div');
        accent.className = 'lockedin-accent';

        const title = document.createElement('h1');
        title.className = 'lockedin-title';
        title.textContent = 'Focus Check';

        const message = document.createElement('p');
        message.className = 'lockedin-subtitle';
        let messageText = 'This site was deemed distracting.';
        if (strikeCount > 0) {
            messageText = `This site is distracting. Strike ${strikeCount}/${STRIKE_LIMIT}.`;
        }
        message.textContent = messageText;

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'lockedin-actions';

        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'lockedin-options';
        optionsContainer.style.display = 'none';

        const resetFlagButton = () => {
            const flagButton = document.getElementById('locked-in-flag-button');
            if (flagButton) {
                flagButton.innerHTML = '&#128681;';
                flagButton.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
                flagButton.disabled = false;
            }
        };

        const breakButton = document.createElement('button');
        breakButton.textContent = 'Break Glass';
        breakButton.className = 'lockedin-btn lockedin-btn-primary';

        breakButton.addEventListener('click', () => {
            optionsContainer.style.display = 'flex';
        });

        const productiveButton = document.createElement('button');
        productiveButton.textContent = "This is productive - don't glass-wall this page again";
        productiveButton.className = 'lockedin-btn lockedin-btn-ghost';
        productiveButton.addEventListener('click', () => {
            chrome.runtime.sendMessage({
                type: "ALLOW_PATH_PERMANENT",
                data: { url: location.href }
            });
            overlay.remove();
            resetFlagButton();
        });

        const breakButtonTimed = document.createElement('button');
        const breakMinutes = 20;
        breakButtonTimed.textContent = `I'm taking a break - allow for ${breakMinutes} minutes`;
        breakButtonTimed.className = 'lockedin-btn lockedin-btn-warm';
        breakButtonTimed.addEventListener('click', () => {
            chrome.runtime.sendMessage({
                type: "ALLOW_PATH_TEMP",
                data: { url: location.href, minutes: breakMinutes }
            });
            overlay.remove();
            resetFlagButton();
        });

        const closeTabButton = document.createElement('button');
        closeTabButton.textContent = 'Close Tab & Get Back to Work';
        closeTabButton.className = 'lockedin-btn lockedin-btn-success';

        closeTabButton.addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: "CLOSE_CURRENT_TAB" });
            // The tab will be closed by background.js, no need to remove overlay here
        });

        optionsContainer.appendChild(productiveButton);
        optionsContainer.appendChild(breakButtonTimed);

        buttonContainer.appendChild(breakButton);
        buttonContainer.appendChild(closeTabButton);

        card.appendChild(accent);
        card.appendChild(title);
        card.appendChild(message);
        card.appendChild(buttonContainer);
        card.appendChild(optionsContainer);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
    }

    function ensureOverlayStyles() {
        if (document.getElementById('locked-in-style')) return;
        const style = document.createElement('style');
        style.id = 'locked-in-style';
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600&display=swap');
            .lockedin-overlay {
                position: fixed;
                inset: 0;
                z-index: 2147483646;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(8, 12, 18, 0.55);
                backdrop-filter: blur(6px);
                -webkit-backdrop-filter: blur(6px);
                padding: 24px;
            }
            .lockedin-card {
                position: relative;
                width: min(640px, 92vw);
                border-radius: 16px;
                padding: 24px;
                background: #ffffff;
                border: 1px solid #e5e7eb;
                box-shadow: 0 18px 40px rgba(8, 12, 18, 0.18);
                color: #111827;
                text-align: left;
                overflow: hidden;
                animation: lockedin-rise 180ms ease-out;
            }
            .lockedin-accent {
                position: absolute;
                inset: 0 0 auto 0;
                height: 2px;
                background: #111827;
                opacity: 0.08;
            }
            .lockedin-title {
                margin: 8px 0 6px;
                font-family: "Work Sans", "Segoe UI", sans-serif;
                font-size: 1.4rem;
                font-weight: 600;
                letter-spacing: 0.1px;
            }
            .lockedin-subtitle {
                margin: 0;
                font-family: "Work Sans", "Segoe UI", sans-serif;
                font-size: 0.98rem;
                color: #374151;
                line-height: 1.5;
            }
            .lockedin-actions {
                display: flex;
                gap: 12px;
                margin-top: 22px;
                flex-wrap: wrap;
            }
            .lockedin-options {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-top: 16px;
                padding: 12px;
                border-radius: 12px;
                background: #f9fafb;
                border: 1px solid #e5e7eb;
                animation: lockedin-fade 160ms ease-out;
            }
            .lockedin-btn {
                font-family: "Work Sans", "Segoe UI", sans-serif;
                border: 1px solid #d1d5db;
                padding: 10px 16px;
                border-radius: 10px;
                cursor: pointer;
                font-size: 0.95rem;
                font-weight: 600;
                background: #ffffff;
                color: #111827;
                transition: transform 120ms ease, box-shadow 120ms ease;
            }
            .lockedin-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 6px 16px rgba(15, 23, 42, 0.12);
            }
            .lockedin-btn-primary {
                background: #111827;
                color: #f9fafb;
                border-color: #111827;
            }
            .lockedin-btn-success {
                background: #ffffff;
                color: #065f46;
                border-color: #10b981;
            }
            .lockedin-btn-ghost {
                background: #ffffff;
                color: #1f2937;
                border-color: #cbd5f5;
            }
            .lockedin-btn-warm {
                background: #fff7ed;
                color: #9a3412;
                border-color: #fdba74;
            }
            .lockedin-control-button {
                position: fixed;
                bottom: 20px;
                right: 80px;
                z-index: 2147483645;
                padding: 8px 12px;
                border-radius: 999px;
                border: 1px solid rgba(17, 24, 39, 0.18);
                background: #ffffff;
                color: #111827;
                font-family: "Work Sans", "Segoe UI", sans-serif;
                font-size: 0.75rem;
                font-weight: 600;
                letter-spacing: 0.8px;
                cursor: pointer;
                box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
            }
            .lockedin-control-button:hover {
                transform: translateY(-1px);
                box-shadow: 0 10px 22px rgba(15, 23, 42, 0.18);
            }
            .lockedin-control-panel {
                position: fixed;
                bottom: 80px;
                right: 20px;
                width: 320px;
                max-height: 70vh;
                overflow: auto;
                background: #ffffff;
                border: 1px solid #e5e7eb;
                border-radius: 14px;
                box-shadow: 0 18px 40px rgba(8, 12, 18, 0.18);
                z-index: 2147483645;
                padding: 16px;
                color: #111827;
                font-family: "Work Sans", "Segoe UI", sans-serif;
            }
            .lockedin-panel-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 6px;
            }
            .lockedin-panel-title {
                font-size: 1rem;
                font-weight: 600;
                letter-spacing: 0.4px;
            }
            .lockedin-panel-close {
                border: 1px solid #e5e7eb;
                background: #ffffff;
                color: #6b7280;
                border-radius: 8px;
                padding: 4px 10px;
                cursor: pointer;
                font-size: 0.8rem;
            }
            .lockedin-panel-tagline {
                margin: 0 0 12px;
                color: #6b7280;
                font-size: 0.9rem;
            }
            .lockedin-panel-button {
                width: 100%;
                padding: 10px 14px;
                border-radius: 10px;
                border: 1px solid #111827;
                background: #111827;
                color: #ffffff;
                font-weight: 600;
                cursor: pointer;
            }
            .lockedin-panel-button-secondary {
                width: auto;
                background: #ffffff;
                color: #111827;
                border: 1px solid #d1d5db;
            }
            .lockedin-panel-button-active {
                background: #111827;
                color: #ffffff;
                border-color: #111827;
            }
            .lockedin-panel-button-inactive {
                background: #ffffff;
                color: #111827;
                border-color: #d1d5db;
            }
            .lockedin-panel-status {
                margin-top: 8px;
                font-size: 0.85rem;
                color: #6b7280;
                min-height: 18px;
            }
            .lockedin-panel-section {
                margin-top: 14px;
            }
            .lockedin-panel-label {
                font-size: 0.85rem;
                font-weight: 600;
                color: #111827;
                margin-bottom: 6px;
            }
            .lockedin-panel-list {
                background: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 10px;
                padding: 8px;
                max-height: 140px;
                overflow: auto;
                font-size: 0.85rem;
                color: #6b7280;
            }
            .lockedin-panel-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 6px 4px;
                border-bottom: 1px solid #e5e7eb;
                color: #111827;
            }
            .lockedin-panel-item:last-child {
                border-bottom: none;
            }
            .lockedin-panel-remove {
                border: 1px solid #e5e7eb;
                background: #ffffff;
                color: #b91c1c;
                border-radius: 8px;
                padding: 3px 8px;
                cursor: pointer;
                font-size: 0.75rem;
            }
            .lockedin-panel-inputrow {
                display: flex;
                gap: 8px;
                margin-top: 8px;
            }
            .lockedin-panel-input {
                flex: 1;
                padding: 8px 10px;
                border-radius: 10px;
                border: 1px solid #e5e7eb;
                font-size: 0.85rem;
            }
            @keyframes lockedin-rise {
                from { transform: translateY(8px); opacity: 0.8; }
                to { transform: translateY(0); opacity: 1; }
            }
            @keyframes lockedin-fade {
                from { opacity: 0; transform: translateY(6px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head && document.head.appendChild(style);
    }



    // --- Main execution flow ---
    // Listen for commands from the background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log("Content script received message:", request);
        if (request.type === "APPLY_GLASS_DOOR") {
            applyGlassDoorEffect(request.strikeCount);
        } else if (request.type === "INJECT_FLAG_BUTTON") {
             // Ensure this runs only when requested to avoid duplicates
            if (!document.getElementById('locked-in-flag-button')) {
                injectFlagButton();
                // Don't initialize webcam here — let it init lazily on first capture
            }
            if (!document.getElementById('locked-in-control-button')) {
                injectControlPanelButton();
            }
        } else if (request.type === "REMOVE_FLAG_BUTTON") {
            const button = document.getElementById('locked-in-flag-button');
            if (button) {
                button.remove();
            }
            const panel = document.getElementById('locked-in-control-panel');
            if (panel) {
                panel.style.display = 'none';
            }
            const overlay = document.getElementById('locked-in-glass-overlay');
            if (overlay) { // Also remove any active glass wall
                overlay.remove();
            }
        } else if (request.type === "CAPTURE_FRAME") {
            captureFrame().then(frameBase64 => {
                sendResponse({ frameBase64 });
            });
            return true; // Indicates async response
        } else if (request.type === "GET_PAGE_SNIPPET") {
            const snippet = getPageSnippet();
            sendResponse({ snippet });
            return true; // Indicates async response
        }
    });

})();
