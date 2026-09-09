/* ==========================================================
   Intelligent Voice Assistant
   script.js
========================================================== */

const API_URL = "http://127.0.0.1:8000";

const ENABLE_AUTO_REFRESH = false;
const ENABLE_HEALTH_POLLING = false;
const AUTO_REFRESH_MS = 30000;
const HEALTH_CHECK_MS = 15000;
const EXCEL_INTEGRATION_ENABLED = true;

const micBtn = document.getElementById("micBtn");
const liveText = document.getElementById("liveText");
const backendStatus = document.getElementById("backendStatus");
const voiceStatus = document.getElementById("voiceStatus");
const responseStatus = document.getElementById("responseStatus");
const rollNo = document.getElementById("rollNo");
const subjectName = document.getElementById("subjectName");
const marksValue = document.getElementById("marksValue");
const refreshBtn = document.getElementById("refreshBtn");
const studentTable = document.getElementById("studentTable");
const totalStudents = document.getElementById("totalStudents");
const totalEntries = document.getElementById("totalEntries");
const averageMarks = document.getElementById("averageMarks");
const apiResponse = document.getElementById("apiResponse");
const jsonViewer = document.getElementById("jsonViewer");
const alertContainer = document.getElementById("alertContainer");
const loadingOverlay = document.getElementById("loadingOverlay");
const toast = document.getElementById("toast");
const sidebar = document.querySelector(".sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const sidebarLinks = document.querySelectorAll(".menu a");
const excelFileInput = document.getElementById("excelFileInput");
const studentTableHeadRow = document.getElementById("studentTableHeadRow");
const columnSelectionPanel = document.getElementById("columnSelectionPanel");
const microphoneStatusValue = document.getElementById("microphoneStatusValue");
const lockedColumnValue = document.getElementById("lockedColumnValue");
const currentRollValue = document.getElementById("currentRollValue");
const lastUpdatedMarksValue = document.getElementById("lastUpdatedMarksValue");
const statusWarningValue = document.getElementById("statusWarningValue");

let totalCount = 0;
let toastTimeout = null;
let autoRefreshTimer = null;
let healthCheckTimer = null;
let recognition = null;
let keepMicOnAfterColumnSelection = false;
let continuousListeningActive = false;
let recognitionRestartTimer = null;
let lastUpdatedMarksText = "--";
let warningMessage = "No warnings";
let stopCommandHandled = false;
const excelState = {
    headers: [],
    rows: [],
    lockedColumn: null
};

function setTextSafe(element, value) {
    if (element) {
        element.textContent = value;
    }
}

function showToast(message, type = "success") {
    if (!toast) return;
    toast.textContent = message;
    toast.style.background = type === "success" ? "#1D4ED8" : "#dc2626";
    toast.classList.add("show");

    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }

    toastTimeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

function addAlert(message, type = "success") {
    if (!alertContainer) return;
    const alert = document.createElement("div");
    alert.className = `${type}-alert`;
    alert.innerHTML = message;
    alertContainer.prepend(alert);

    setTimeout(() => {
        alert.remove();
    }, 6000);
}

function isCommandError(response, data = {}) {
    const message = String(data.message || "").toLowerCase();
    const hasFailedResult = Array.isArray(data.results)
        && data.results.some((result) => result.updated === false);
    const hasErrorMessage = /error|invalid|not found|not recognized|no column|no marks|unable|failed|missing|write-protected|could not|must be between/.test(message);
    return !response.ok || hasFailedResult || hasErrorMessage;
}

function showLoading(enabled) {
    if (!loadingOverlay) return;
    loadingOverlay.style.display = enabled ? "flex" : "none";
}

function syncMicButtonState() {
    if (!micBtn) return;
    micBtn.style.background = continuousListeningActive ? "#dc2626" : "#2563eb";
    micBtn.style.transform = continuousListeningActive ? "scale(1.15)" : "scale(1)";
    micBtn.innerHTML = continuousListeningActive
        ? '<i class="fa-solid fa-wave-square"></i>'
        : '<i class="fa-solid fa-microphone"></i>';
    micBtn.setAttribute("aria-pressed", String(continuousListeningActive));
}

function startListeningAnimation() {
    syncMicButtonState();
}

function stopListeningAnimation() {
    syncMicButtonState();
}

function setBackendStatus(message, variant = "success") {
    if (!backendStatus) return;
    const icon = variant === "success" ? "🔵" : variant === "warning" ? "🟡" : "🔴";
    backendStatus.textContent = `${icon} ${message}`;
    backendStatus.style.color = variant === "success" ? "#38BDF8" : variant === "warning" ? "#fbbf24" : "#f87171";
}

function buildStatusBadge(average) {
    const normalized = Number(average);
    if (normalized >= 85) {
        return { label: "Excellent", color: "#0284C7", bg: "#E0F2FE" };
    }
    if (normalized >= 70) {
        return { label: "Good", color: "#D97706", bg: "#FEF3C7" };
    }
    return { label: "Review", color: "#DC2626", bg: "#FEE2E2" };
}

function formatNumber(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return "0";
    }
    return Number(value).toFixed(1);
}

function updateVoiceStatusCard() {
    if (microphoneStatusValue) {
        microphoneStatusValue.textContent = continuousListeningActive ? "Listening Active" : (voiceStatus?.textContent || "Ready");
    }

    if (lockedColumnValue) {
        lockedColumnValue.textContent = excelState.lockedColumn ? `🔒 ${excelState.lockedColumn}` : "Not Locked";
    }

    if (currentRollValue) {
        currentRollValue.textContent = rollNo?.textContent || "--";
    }

    if (lastUpdatedMarksValue) {
        lastUpdatedMarksValue.textContent = lastUpdatedMarksText || "--";
    }

    if (statusWarningValue) {
        statusWarningValue.textContent = warningMessage || "No warnings";
    }
}

function parseCommandDisplay(text, selectedColumn = "") {
    const normalized = (text || "").toLowerCase();
    const rollMatch = normalized.match(/roll(?: number)?\s*(\d+)/i);
    const subjectMatch = normalized.match(/\b(assignment|test|midterm|final|finalterm)\b/i);
    const marksMatch = normalized.match(/marks?\s*(\d+)/i);

    setTextSafe(rollNo, rollMatch ? rollMatch[1] : "--");
    setTextSafe(subjectName, (selectedColumn || subjectMatch?.[1] || "--").toUpperCase());
    setTextSafe(marksValue, marksMatch ? marksMatch[1] : "--");
    updateVoiceStatusCard();
}

function showJSON(data) {
    if (!jsonViewer) return;
    jsonViewer.textContent = JSON.stringify(data, null, 2);
}

function showResponse(data) {
    if (!apiResponse) return;

    const message = data?.message || "No response message available.";
    const text = data?.text || "No transcription available.";
    apiResponse.innerHTML = `
        <b>Message:</b><br>${message}
        <br><br>
        <b>Voice Text:</b><br>${text}
    `;
}

async function getHealthStatus() {
    setBackendStatus("Checking backend...", "warning");
    try {
        const response = await fetch(`${API_URL}/health`, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        setBackendStatus("Backend Connected", "success");
        if (apiResponse) {
            apiResponse.innerHTML = `
                <b>Health:</b> ${data.status}<br>
                ${data.message}<br><br>
                <b>Excel Integration:</b> ${EXCEL_INTEGRATION_ENABLED ? "Enabled" : "Pending future integration"}
            `;
        }
        showJSON({ health: data, excelIntegration: EXCEL_INTEGRATION_ENABLED });
        return true;
    } catch (error) {
        setBackendStatus("Backend Disconnected", "error");
        if (apiResponse) {
            apiResponse.textContent = "Health check failed. Backend is unavailable.";
        }
        showJSON({ error: error.message || "Unable to contact backend." });
        addAlert("Backend health check failed.", "error");
        return false;
    }
}

async function fetchStudentData(forceRefresh = false) {
    if (!forceRefresh && excelState.rows.length > 0) {
        return excelState.rows;
    }

    if (!EXCEL_INTEGRATION_ENABLED) {
        addAlert("Excel integration is disabled. Select an Excel file to load data.", "error");
        return [];
    }

    try {
        const response = await fetch(`${API_URL}/students`, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        if (Array.isArray(result) && result.length > 0) {
            excelState.headers = normalizeRowHeaders(result);
            excelState.rows = result;
            return result;
        }

        if (result?.error) {
            throw new Error(result.error);
        }

        excelState.headers = [];
        excelState.rows = [];
        addAlert("No student data was found in the Excel file.", "warning");
        return [];
    } catch (error) {
        excelState.headers = [];
        excelState.rows = [];
        addAlert("Unable to load student data from Excel. Select an Excel file to continue.", "error");
        return [];
    }
}

function normalizeRowHeaders(rows) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    if (!sourceRows.length) {
        return [];
    }

    const firstRow = sourceRows.find((row) => row && typeof row === "object" && Object.keys(row).length > 0);
    if (!firstRow) {
        return [];
    }

    return Object.keys(firstRow)
        .filter((key) => String(key).trim() !== "")
        .map((key) => String(key).trim())
        .filter((key, index, array) => array.indexOf(key) === index);
}

function getRowCellValue(row, header) {
    if (!row || typeof row !== "object") {
        return "";
    }

    const exactMatch = row[header];
    if (exactMatch !== undefined && exactMatch !== null && exactMatch !== "") {
        return exactMatch;
    }

    const normalizedHeader = String(header).trim();
    const matchingKey = Object.keys(row).find((key) => String(key).trim().toLowerCase() === normalizedHeader.toLowerCase());
    if (matchingKey !== undefined) {
        const matchedValue = row[matchingKey];
        if (matchedValue !== undefined && matchedValue !== null && matchedValue !== "") {
            return matchedValue;
        }
    }

    return "";
}

function updateLockedColumnStyles() {
    const buttons = columnSelectionPanel ? columnSelectionPanel.querySelectorAll(".column-select-btn") : [];
    const headers = Array.isArray(excelState.headers) ? excelState.headers : [];

    buttons.forEach((button) => {
        const columnName = button.dataset.columnName || "";
        const isLocked = excelState.lockedColumn && columnName === excelState.lockedColumn;
        button.classList.toggle("is-locked", isLocked);
        button.innerHTML = isLocked ? `🔒 ${columnName}` : columnName;
    });

    const tableHeaders = studentTableHeadRow ? studentTableHeadRow.querySelectorAll("th") : [];
    tableHeaders.forEach((headerCell) => {
        const columnName = headerCell.textContent.trim();
        headerCell.classList.toggle("locked-column", Boolean(excelState.lockedColumn) && columnName === excelState.lockedColumn);
    });

    const rows = studentTable ? studentTable.querySelectorAll("tr") : [];
    rows.forEach((row) => {
        const cells = row.querySelectorAll("td");
        cells.forEach((cell, index) => {
            const matchedHeader = headers[index];
            cell.classList.toggle("locked-column", Boolean(excelState.lockedColumn) && matchedHeader === excelState.lockedColumn);
        });
    });
}

function syncLockedColumn(columnName, options = {}) {
    const { showMessage = false } = options;
    const safeColumnName = columnName ? String(columnName).trim() : "";

    if (!safeColumnName) {
        excelState.lockedColumn = null;
        updateLockedColumnStyles();
        return;
    }

    const headers = Array.isArray(excelState.headers) ? excelState.headers : [];
    const matchingHeader = headers.find((header) => String(header).trim().toLowerCase() === safeColumnName.toLowerCase());

    if (headers.length > 0 && !matchingHeader) {
        excelState.lockedColumn = null;
        updateLockedColumnStyles();
        return;
    }

    excelState.lockedColumn = matchingHeader || safeColumnName;
    updateLockedColumnStyles();

    if (showMessage) {
        showToast(`Column '${excelState.lockedColumn}' Locked`);
    }

    updateVoiceStatusCard();
}

function renderColumnSelectionPanel(headers = excelState.headers) {
    if (!columnSelectionPanel) return;

    const panelHeaders = Array.isArray(headers) && headers.length > 0
        ? headers
        : normalizeRowHeaders(excelState.rows);

    columnSelectionPanel.innerHTML = panelHeaders.map((header) => `
        <button type="button" class="column-select-btn" data-column-name="${header}">${header}</button>
    `).join("");

    updateLockedColumnStyles();
}

async function persistLockedColumnToBackend(columnName) {
    const safeColumnName = columnName ? String(columnName).trim() : "";
    if (!safeColumnName) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/set-column`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ column: safeColumnName })
        });

        const data = await response.json();
        const selectedColumn = data?.selected_column || safeColumnName;
        syncLockedColumn(selectedColumn, { showMessage: true });
        showToast(data?.message || `Column '${selectedColumn}' Locked`, response.ok ? "success" : "error");
    } catch (error) {
        console.error(error);
        syncLockedColumn(safeColumnName, { showMessage: true });
        showToast(`Column '${safeColumnName}' Locked locally.`, "warning");
    }
}

async function handleColumnLockSelection(event) {
    const button = event.target.closest(".column-select-btn");
    if (!button) {
        return;
    }

    const selectedColumn = button.dataset.columnName || "";
    if (!selectedColumn) {
        return;
    }

    await persistLockedColumnToBackend(selectedColumn);
}

function renderStudentTable(data, headers = excelState.headers) {
    if (!studentTable) return;

    const tableHeaders = Array.isArray(headers) && headers.length > 0
        ? headers
        : normalizeRowHeaders(data);

    if (!studentTableHeadRow) return;

    if (tableHeaders.length > 0) {
        studentTableHeadRow.innerHTML = tableHeaders.map((header) => `<th>${header}</th>`).join("");
        renderColumnSelectionPanel(tableHeaders);
    } else {
        studentTableHeadRow.innerHTML = "";
        renderColumnSelectionPanel([]);
    }

    const rows = (Array.isArray(data) ? data : []).map((row) => {
        const cells = tableHeaders.map((header) => `<td>${getRowCellValue(row, header)}</td>`).join("");
        return `<tr>${cells}</tr>`;
    }).join("");

    studentTable.innerHTML = rows;
    updateLockedColumnStyles();
}

function updateSummaryMetrics(data, headers = excelState.headers) {
    const count = Array.isArray(data) ? data.length : 0;
    const tableHeaders = Array.isArray(headers) && headers.length > 0
        ? headers
        : normalizeRowHeaders(data);

    const numericValues = [];

    if (Array.isArray(data)) {
        data.forEach((row) => {
            tableHeaders.forEach((header) => {
                const value = getRowCellValue(row, header);
                const numericValue = Number(value);

                if (value !== "" && value !== null && value !== undefined && !Number.isNaN(numericValue)) {
                    numericValues.push(numericValue);
                }
            });
        });
    }

    const average = numericValues.length > 0
        ? numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length
        : 0;

    setTextSafe(totalStudents, count);
    setTextSafe(averageMarks, count > 0 ? formatNumber(average) : "0");
    setTextSafe(totalEntries, totalCount);
}

async function refreshDashboard(forceRefresh = false) {
    showLoading(true);
    const backendHealthy = await getHealthStatus();
    const students = await fetchStudentData(forceRefresh);
    renderStudentTable(students, excelState.headers.length ? excelState.headers : normalizeRowHeaders(students));
    updateSummaryMetrics(students, excelState.headers.length ? excelState.headers : normalizeRowHeaders(students));

    if (backendHealthy) {
        showToast("Dashboard refreshed successfully.");
    }

    showLoading(false);
}

function normalizeText(text) {
    return (text || "").trim();
}

let audioContext = null;

function getAudioContext() {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) {
        return null;
    }
    if (!audioContext) {
        audioContext = new AudioCtor();
    }
    return audioContext;
}

function playBeep(count = 1, frequency = 700) {
    const context = getAudioContext();
    if (!context) {
        return;
    }

    for (let index = 0; index < count; index += 1) {
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();

        oscillator.type = "sine";
        oscillator.frequency.value = frequency + (index * 120);

        gainNode.gain.value = 0.0001;
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        const startTime = context.currentTime + (index * 0.18);
        oscillator.start(startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.22, startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.14);
        oscillator.stop(startTime + 0.16);
    }
}

function createSpeechRecognition() {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
        return null;
    }

    const instance = new SpeechRecognitionCtor();
    instance.lang = "en-US";
    instance.continuous = true;
    instance.interimResults = false;
    instance.maxAlternatives = 3;
    return instance;
}

function startRecognitionLoop() {
    if (!continuousListeningActive || !recognition) {
        return;
    }

    try {
        recognition.start();
    } catch (error) {
        // Already running, ignore and keep current state.
    }
}

function captureSpeechText() {
    return new Promise((resolve) => {
        recognition = createSpeechRecognition();

        if (!recognition) {
            resolve("");
            return;
        }

        let settled = false;
        let finalTranscript = "";
        const finish = (text) => {
            if (!settled) {
                settled = true;
                resolve(text);
            }
        };

        recognition.onresult = (event) => {
            for (let index = event.resultIndex; index < event.results.length; index += 1) {
                const result = event.results[index];
                if (result.isFinal) {
                    finalTranscript += `${result[0].transcript} `;
                }
            }
            setTextSafe(liveText, finalTranscript.trim() || "Listening...");
            if (finalTranscript.trim()) {
                finish(finalTranscript.trim());
            }
        };

        recognition.onerror = () => finish("");
        recognition.onend = () => {
            if (continuousListeningActive) {
                startRecognitionLoop();
            }
            if (!settled) {
                finish("");
            }
        };

        startRecognitionLoop();
    });
}

function shouldStopListening(text = "", data = {}) {
    const commandText = normalizeText(text || "")
        .toLowerCase()
        .replace(/[.!?]+$/g, "")
        .trim();
    return /^(?:please\s+)?(?:stop|exit)$/.test(commandText);
}

async function processVoiceText(text) {
    const listeningSessionActive = continuousListeningActive;
    setTextSafe(voiceStatus, "Processing");
    setTextSafe(responseStatus, "Sending voice command");
    setTextSafe(liveText, "⏳ Processing your voice command...");

    try {
        const response = await fetch(`${API_URL}/voice-command`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ text })
        });

        const data = await response.json();
        const recognizedText = normalizeText(data.text || text);

        setTextSafe(liveText, recognizedText || "No text recognized.");
        setTextSafe(responseStatus, data.message || "Response received.");
        setTextSafe(voiceStatus, data.updated ? "Updated" : (data.selected_column ? "Column Selected" : "Ready"));
        warningMessage = data?.message?.toLowerCase().includes("error") || data?.message?.toLowerCase().includes("warning") ? data.message : "No warnings";

        parseCommandDisplay(recognizedText, data.selected_column || data.column || "");
        if (data.selected_column || data.column) {
            syncLockedColumn(data.selected_column || data.column, { showMessage: true });
        }
        if (data.updated && data.message) {
            const matchedMarks = String(data.message).match(/(\d+(?:\.\d+)?)/g);
            lastUpdatedMarksText = matchedMarks && matchedMarks.length ? matchedMarks[matchedMarks.length - 1] : (marksValue.textContent || "--");
        } else if (marksValue.textContent && marksValue.textContent !== "--") {
            lastUpdatedMarksText = marksValue.textContent;
        }
        updateVoiceStatusCard();
        showResponse(data);
        showJSON(data);

        const duplicateRolls = Array.isArray(data.commands)
            ? data.commands.filter((command) => command.type === "marks").map((command) => command.roll_no)
            : [];
        const hasDuplicateRolls = duplicateRolls.length > new Set(duplicateRolls).size;

        const beepCount = Array.isArray(data.commands)
            ? data.commands.filter((command) => command.type === "marks").length
            : (data.type === "marks" ? 1 : 0);

        if (beepCount > 0) {
            playBeep(beepCount, 700);
        }

        if (hasDuplicateRolls) {
            playBeep(2, 340);
            addAlert("Duplicate roll number detected in the same command. The last value will be applied.", "warning");
        }

        totalCount += 1;
        setTextSafe(totalEntries, totalCount);

        const commandError = isCommandError(response, data);
        addAlert(
            commandError ? `Error: ${data.message}` : `Voice command processed: ${data.message}`,
            commandError ? "error" : (response.ok ? "success" : "warning")
        );
        if (commandError) {
            playBeep(3, 260);
            showToast(data.message, "error");
        }
        
        const shouldRefreshAfterCommand = shouldStopListening(text, data);
        if (listeningSessionActive && shouldRefreshAfterCommand && !stopCommandHandled) {
            stopCommandHandled = true;
            stopContinuousMode();
            await refreshDashboard(true);
            showToast("Dashboard refreshed after stopping voice mode.", "success");
        }

        if (!shouldRefreshAfterCommand && data.selected_column) {
            showToast(`Column selected: ${data.selected_column}`, "success");
        }
    } catch (error) {
        console.error(error);
        setTextSafe(liveText, "Unable to connect to backend.");
        setTextSafe(responseStatus, "Backend error");
        setTextSafe(voiceStatus, "Offline");
        warningMessage = "Backend connection failed.";
        setBackendStatus("Backend Disconnected", "error");
        showResponse({ message: "Unable to contact backend.", text });
        showJSON({ error: error.message });
        addAlert("Backend connection failed.", "error");
        showToast("Backend connection failed.", "error");
        playBeep(3, 260);
        continuousListeningActive = false;
        updateVoiceStatusCard();
        continuousListeningActive = false;
    }
}

async function captureSingleCommand() {
    startListeningAnimation();
    setTextSafe(voiceStatus, "Listening");
    setTextSafe(responseStatus, "Waiting for voice");
    setTextSafe(liveText, "🎤 Listening... Speak clearly now.");

    try {
        const recognizedText = await captureSpeechText();

        if (!recognizedText) {
            setTextSafe(liveText, "No speech detected.");
            setTextSafe(responseStatus, "No voice input");
            setTextSafe(voiceStatus, "Ready");
            warningMessage = "No speech detected.";
            updateVoiceStatusCard();
            return false;
        }

        await processVoiceText(recognizedText);
        return true;
    } catch (error) {
        console.error(error);
        setTextSafe(liveText, "Unable to capture speech.");
        setTextSafe(responseStatus, "Speech error");
        setTextSafe(voiceStatus, "Offline");
        addAlert("Speech recognition failed.", "error");
        return false;
    }
}

async function startContinuousMode() {
    if (continuousListeningActive) {
        return;
    }

    continuousListeningActive = true;
    stopCommandHandled = false;
    warningMessage = "No warnings";
    startListeningAnimation();
    addAlert("Continuous listening started. Say 'exit' to stop.", "success");
    updateVoiceStatusCard();

    if (!recognition) {
        recognition = createSpeechRecognition();
    }

    if (!recognition) {
        continuousListeningActive = false;
        stopListeningAnimation();
        addAlert("Speech recognition is not supported in this browser.", "error");
        return;
    }

    recognition.onresult = (event) => {
        const finalTranscripts = [];

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const result = event.results[index];
            if (result.isFinal && result[0].transcript.trim()) {
                finalTranscripts.push(result[0].transcript.trim());
            }
        }

        // event.results also contains old results, so process only new final text.
        finalTranscripts.forEach((text) => processVoiceText(text));
    };

    recognition.onerror = (event) => {
        if (event.error !== "no-speech" && event.error !== "aborted") {
            warningMessage = `Microphone: ${event.error}`;
            setTextSafe(responseStatus, "Speech recognition error");
            updateVoiceStatusCard();
        }
    };

    recognition.onend = () => {
        if (continuousListeningActive) {
            try {
                recognition.start();
            } catch (error) {
                // Ignore restart errors while the microphone is already active.
            }
        }
    };

    try {
        recognition.start();
    } catch (error) {
        // Ignore start errors if it is already active.
    }
}

function stopContinuousMode() {
    continuousListeningActive = false;
    if (recognition) {
        try {
            recognition.stop();
        } catch (error) {
            // Ignore stop errors; the recognizer may already be inactive.
        }
    }
    stopListeningAnimation();
    setTextSafe(voiceStatus, "Ready");
    setTextSafe(responseStatus, "Stopped");
    setTextSafe(liveText, "Microphone stopped. Click to start again.");
    warningMessage = "No warnings";
    updateVoiceStatusCard();
    addAlert("Continuous listening stopped.", "info");
}

async function listenVoice() {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
        addAlert("Speech recognition is not supported in this browser.", "error");
        return;
    }

    if (continuousListeningActive) {
        stopContinuousMode();
        return;
    }

    showLoading(false);
    await startContinuousMode();
}

function readUploadedWorkbook(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const workbook = XLSX.read(event.target.result, { type: "array" });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false, blankrows: false });

                if (rows.length === 0) {
                    resolve({ headers: [], rows: [] });
                    return;
                }

                const headers = normalizeRowHeaders(rows);
                excelState.headers = headers;
                excelState.rows = rows;
                resolve({ headers, rows });
            } catch (error) {
                reject(new Error("Unable to read the uploaded Excel file."));
            }
        };

        reader.onerror = () => reject(new Error("Unable to read the uploaded Excel file."));
        reader.readAsArrayBuffer(file);
    });
}

function handleExcelUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
        return;
    }

    showLoading(true);

    readUploadedWorkbook(file)
        .then(({ headers, rows }) => {
            if (!headers.length || !rows.length) {
                addAlert("The uploaded Excel file does not contain readable rows.", "warning");
                showLoading(false);
                return;
            }

            excelState.headers = headers;
            excelState.rows = rows;
            excelState.lockedColumn = headers.includes(excelState.lockedColumn) ? excelState.lockedColumn : null;
            renderStudentTable(rows, headers);
            updateSummaryMetrics(rows, headers);
            showToast(`Loaded Excel file: ${file.name}`, "success");
            addAlert(`Excel file loaded successfully: ${file.name}`, "success");
        })
        .catch((error) => {
            console.error(error);
            addAlert("Unable to parse the uploaded Excel file.", "error");
            showToast("Excel upload failed.", "error");
        })
        .finally(() => {
            showLoading(false);
            event.target.value = "";
        });
}

function initializeDashboard() {
    setBackendStatus("Starting dashboard...", "warning");
    setTextSafe(voiceStatus, "Ready");
    setTextSafe(responseStatus, "Waiting");
    setTextSafe(liveText, "Waiting for voice input...");
    setTextSafe(rollNo, "--");
    setTextSafe(subjectName, "--");
    setTextSafe(marksValue, "--");
    setTextSafe(totalEntries, totalCount);
    setTextSafe(averageMarks, "0");
    setTextSafe(totalStudents, "0");
    warningMessage = "No warnings";
    lastUpdatedMarksText = "--";

    excelState.lockedColumn = null;
    updateVoiceStatusCard();
    refreshDashboard();

    if (ENABLE_AUTO_REFRESH) {
        autoRefreshTimer = setInterval(refreshDashboard, AUTO_REFRESH_MS);
    }

    if (ENABLE_HEALTH_POLLING) {
        healthCheckTimer = setInterval(getHealthStatus, HEALTH_CHECK_MS);
    }

    addAlert("Dashboard initialized.", "success");
}

function openSidebar() {
    sidebar?.classList.add("active");
    sidebarOverlay?.classList.add("active");
}

function closeSidebar() {
    sidebar?.classList.remove("active");
    sidebarOverlay?.classList.remove("active");
}

sidebarToggle?.addEventListener("click", () => {
    if (sidebar?.classList.contains("active")) {
        closeSidebar();
    } else {
        openSidebar();
    }
});

sidebarOverlay?.addEventListener("click", closeSidebar);

sidebarLinks.forEach((link) => {
    link.addEventListener("click", closeSidebar);
});

micBtn?.addEventListener("click", () => {
    if (continuousListeningActive) {
        stopContinuousMode();
        return;
    }

    listenVoice();
});
refreshBtn?.addEventListener("click", () => {
    refreshDashboard();
});

excelFileInput?.addEventListener("change", handleExcelUpload);
columnSelectionPanel?.addEventListener("click", handleColumnLockSelection);

window.addEventListener("DOMContentLoaded", initializeDashboard);
