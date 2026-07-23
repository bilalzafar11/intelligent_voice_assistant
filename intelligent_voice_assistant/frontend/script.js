/* ==========================================================
   Intelligent Voice Assistant
   script.js
========================================================== */

const API_URL = "http://127.0.0.1:8000";
fetch("http://127.0.0.1:8000/health")
  .then(res => res.json())
  .then(data => {
    console.log("Connected:", data);
    document.getElementById("status").innerText = "🟢 Backend Connected";
  })
  .catch(error => {
    console.log("Error:", error);
    document.getElementById("status").innerText = "🔴 Backend Disconnected";
  });

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

let totalCount = 0;
let toastTimeout = null;
let autoRefreshTimer = null;
let healthCheckTimer = null;
let recognition = null;

const sampleStudents = [
    {
        rollNo: 1,
        student_name: "Ali Khan",
        assignment: 84,
        quiz: 91,
        mid: 78,
        final: 88
    },
    {
        rollNo: 2,
        student_name: "Sara Malik",
        assignment: 92,
        quiz: 88,
        mid: 81,
        final: 94
    },
    {
        rollNo: 3,
        student_name: "Bilal Ahmed",
        assignment: 76,
        quiz: 74,
        mid: 69,
        final: 72
    },
    {
        rollNo: 4,
        student_name: "Ayesha Noor",
        assignment: 89,
        quiz: 95,
        mid: 86,
        final: 91
    },
    {
        rollNo: 5,
        student_name: "Zain Shah",
        assignment: 68,
        quiz: 72,
        mid: 70,
        final: 74
    }
];

function showToast(message, type = "success") {
    if (!toast) return;
    toast.textContent = message;
    toast.style.background = type === "success" ? "#16a34a" : "#dc2626";
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

function showLoading(enabled) {
    if (!loadingOverlay) return;
    loadingOverlay.style.display = enabled ? "flex" : "none";
}

function startListeningAnimation() {
    if (!micBtn) return;
    micBtn.style.background = "#dc2626";
    micBtn.style.transform = "scale(1.15)";
    micBtn.innerHTML = '<i class="fa-solid fa-wave-square"></i>';
}

function stopListeningAnimation() {
    if (!micBtn) return;
    micBtn.style.background = "#2563eb";
    micBtn.style.transform = "scale(1)";
    micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
}

function setBackendStatus(message, variant = "success") {
    if (!backendStatus) return;
    const icon = variant === "success" ? "🟢" : variant === "warning" ? "🟡" : "🔴";
    backendStatus.textContent = `${icon} ${message}`;
    backendStatus.style.color = variant === "success" ? "#4ade80" : variant === "warning" ? "#fbbf24" : "#f87171";
}

function buildStatusBadge(average) {
    const normalized = Number(average);
    if (normalized >= 85) {
        return { label: "Excellent", color: "#22c55e" };
    }
    if (normalized >= 70) {
        return { label: "Good", color: "#fbbf24" };
    }
    return { label: "Review", color: "#f97316" };
}

function formatNumber(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return "0";
    }
    return Number(value).toFixed(1);
}

function parseCommandDisplay(text, selectedColumn = "") {
    const normalized = (text || "").toLowerCase();
    const rollMatch = normalized.match(/roll(?: number)?\s*(\d+)/i);
    const subjectMatch = normalized.match(/\b(assignment|test|midterm|final|finalterm)\b/i);
    const marksMatch = normalized.match(/marks?\s*(\d+)/i);

    rollNo.textContent = rollMatch ? rollMatch[1] : "--";
    subjectName.textContent = (selectedColumn || subjectMatch?.[1] || "--").toUpperCase();
    marksValue.textContent = marksMatch ? marksMatch[1] : "--";
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
        apiResponse.innerHTML = `
            <b>Health:</b> ${data.status}<br>
            ${data.message}<br><br>
            <b>Excel Integration:</b> ${EXCEL_INTEGRATION_ENABLED ? "Enabled" : "Pending future integration"}
        `;
        showJSON({ health: data, excelIntegration: EXCEL_INTEGRATION_ENABLED });
        return true;
    } catch (error) {
        setBackendStatus("Backend Disconnected", "error");
        apiResponse.textContent = "Health check failed. Backend is unavailable.";
        showJSON({ error: error.message || "Unable to contact backend." });
        addAlert("Backend health check failed.", "error");
        return false;
    }
}

async function fetchStudentData() {
    if (!EXCEL_INTEGRATION_ENABLED) {
        addAlert("Using sample student table until Excel integration is enabled.", "warning");
        return sampleStudents;
    }

    try {
        const response = await fetch(`${API_URL}/students`, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        if (Array.isArray(result) && result.length > 0) {
            return result;
        }

        if (result?.error) {
            throw new Error(result.error);
        }

        return sampleStudents;
    } catch (error) {
        addAlert("Unable to load student data from Excel. Displaying sample data.", "warning");
        return sampleStudents;
    }
}

function renderStudentTable(data) {
    if (!studentTable) return;

    const columns = ["Assignment", "Test", "Midterm", "Finalterm"];
    const rows = data.map((student, index) => {
        const values = columns.map((column) => Number(student[column] ?? 0));
        const average = values.reduce((sum, value) => sum + value, 0) / values.length;
        const status = buildStatusBadge(average);

        const roll = student.rollNo ?? student.roll_no ?? student.RollNo ?? "--";

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${roll}</td>
                <td>${values[0]}</td>
                <td>${values[1]}</td>
                <td>${values[2]}</td>
                <td>${values[3]}</td>
                <td><span style="display:inline-flex;padding:6px 10px;border-radius:999px;color:#fff;background:${status.color};font-size:13px;font-weight:600;">${status.label}</span></td>
            </tr>`;
    }).join("");

    studentTable.innerHTML = rows;
}

function updateSummaryMetrics(data) {
    const count = data.length;
    const columns = ["Assignment", "Test", "Midterm", "Finalterm"];
    const totalAverage = data.reduce((sum, student) => {
        const values = columns.map((column) => Number(student[column] ?? 0));
        return sum + values.reduce((subSum, value) => subSum + value, 0) / values.length;
    }, 0);

    const average = count > 0 ? totalAverage / count : 0;

    totalStudents.textContent = count;
    averageMarks.textContent = count > 0 ? formatNumber(average) : "0";
    totalEntries.textContent = totalCount;
}

async function refreshDashboard() {
    showLoading(true);
    const backendHealthy = await getHealthStatus();
    const students = await fetchStudentData();
    renderStudentTable(students);
    updateSummaryMetrics(students);

    if (backendHealthy) {
        showToast("Dashboard refreshed successfully.");
    }

    showLoading(false);
}

function normalizeText(text) {
    return (text || "").trim();
}

function createSpeechRecognition() {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
        return null;
    }

    const instance = new SpeechRecognitionCtor();
    instance.lang = "en-US";
    instance.continuous = false;
    instance.interimResults = false;
    instance.maxAlternatives = 1;
    return instance;
}

function startContinuousListening() {
    if (!recognition) {
        recognition = createSpeechRecognition();
    }

    if (!recognition) {
        return;
    }

    recognition.onend = () => {
        if (micBtn) {
            startListeningAnimation();
            liveText.textContent = "🎤 Listening... Speak clearly now.";
            voiceStatus.textContent = "Listening";
            responseStatus.textContent = "Waiting for voice";
        }
        try {
            recognition.start();
        } catch (error) {
            console.error(error);
        }
    };

    try {
        recognition.start();
    } catch (error) {
        console.error(error);
    }
}

function captureSpeechText() {
    return new Promise((resolve) => {
        if (!recognition) {
            recognition = createSpeechRecognition();
        }

        if (!recognition) {
            resolve("");
            return;
        }

        let settled = false;
        const finish = (text) => {
            if (!settled) {
                settled = true;
                resolve(text);
            }
        };

        recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map((result) => result[0].transcript)
                .join(" ")
                .trim();
            if (transcript) {
                finish(transcript);
            }
        };

        recognition.onerror = () => finish("");
        recognition.onend = () => {
            if (!settled) {
                finish("");
            }
        };

        try {
            recognition.start();
        } catch (error) {
            finish("");
        }
    });
}

async function processVoiceText(text) {
    voiceStatus.textContent = "Processing";
    responseStatus.textContent = "Sending voice command";
    liveText.textContent = "⏳ Processing your voice command...";

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

        liveText.textContent = recognizedText || "No text recognized.";
        responseStatus.textContent = data.message || "Response received.";
        voiceStatus.textContent = data.updated ? "Updated" : (data.selected_column ? "Column Selected" : "Ready");

        parseCommandDisplay(recognizedText, data.selected_column || data.column || "");
        showResponse(data);
        showJSON(data);

        totalCount += 1;
        totalEntries.textContent = totalCount;

        addAlert(`Voice command processed: ${data.message}`, response.ok ? "success" : "warning");
        if (data.updated || data.message?.toLowerCase().includes("updated")) {
            await refreshDashboard();
            showToast("Marks updated successfully.", "success");
        } else if (data.selected_column) {
            showToast(`Column selected: ${data.selected_column}`, "success");
        }
    } catch (error) {
        console.error(error);
        liveText.textContent = "Unable to connect to backend.";
        responseStatus.textContent = "Backend error";
        voiceStatus.textContent = "Offline";
        setBackendStatus("Backend Disconnected", "error");
        showResponse({ message: "Unable to contact backend.", text });
        showJSON({ error: error.message });
        addAlert("Backend connection failed.", "error");
        showToast("Backend connection failed.", "error");
    }
}

async function listenVoice() {
    if (!recognition) {
        recognition = createSpeechRecognition();
    }

    if (!recognition) {
        addAlert("Speech recognition is not supported in this browser.", "error");
        return;
    }

    startListeningAnimation();
    showLoading(false);
    voiceStatus.textContent = "Listening";
    responseStatus.textContent = "Waiting for voice";
    liveText.textContent = "🎤 Listening... Speak clearly now.";

    try {
        const recognizedText = await captureSpeechText();

        if (!recognizedText) {
            liveText.textContent = "No speech detected.";
            responseStatus.textContent = "No voice input";
            voiceStatus.textContent = "Ready";
            addAlert("No speech detected. Please try again.", "warning");
            return;
        }

        await processVoiceText(recognizedText);
        startContinuousListening();
    } catch (error) {
        console.error(error);
        liveText.textContent = "Unable to capture speech.";
        responseStatus.textContent = "Speech error";
        voiceStatus.textContent = "Offline";
        addAlert("Speech recognition failed.", "error");
    } finally {
        stopListeningAnimation();
        showLoading(false);
    }
}

function initializeDashboard() {
    setBackendStatus("Starting dashboard...", "warning");
    voiceStatus.textContent = "Ready";
    responseStatus.textContent = "Waiting";
    liveText.textContent = "Waiting for voice input...";
    rollNo.textContent = "--";
    subjectName.textContent = "--";
    marksValue.textContent = "--";
    totalEntries.textContent = totalCount;
    averageMarks.textContent = "0";
    totalStudents.textContent = "0";

    refreshDashboard();
    autoRefreshTimer = setInterval(refreshDashboard, AUTO_REFRESH_MS);
    healthCheckTimer = setInterval(getHealthStatus, HEALTH_CHECK_MS);
    addAlert("Dashboard initialized.", "success");
}

micBtn?.addEventListener("click", () => {
    listenVoice();
});
refreshBtn?.addEventListener("click", () => {
    refreshDashboard();
});

window.addEventListener("DOMContentLoaded", initializeDashboard);

