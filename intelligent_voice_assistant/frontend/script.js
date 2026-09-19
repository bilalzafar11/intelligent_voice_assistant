/* ==========================================================
   Intelligent Voice Assistant
   script.js
   Database + Voice + Excel Integration
========================================================== */

const API_URL = "http://127.0.0.1:8000";

const ENABLE_AUTO_REFRESH = false;
const ENABLE_HEALTH_POLLING = false;
const AUTO_REFRESH_MS = 30000;
const HEALTH_CHECK_MS = 15000;
const EXCEL_INTEGRATION_ENABLED = true;


/* ==========================================================
   DOM ELEMENTS
========================================================== */

const micBtn = document.getElementById("micBtn");
const liveText = document.getElementById("liveText");
const backendStatus = document.getElementById("backendStatus");

const voiceStatus = document.getElementById("voiceStatus");
const responseStatus = document.getElementById("responseStatus");

const rollNo = document.getElementById("rollNo");
const subjectName = document.getElementById("subjectName");
const marksValue = document.getElementById("marksValue");

const refreshBtn = document.getElementById("refreshBtn");
const downloadExcelBtn = document.getElementById("downloadExcelBtn");
const studentTable = document.getElementById("studentTable");
const studentTableHeadRow = document.getElementById("studentTableHeadRow");

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
const columnSelectionPanel =
    document.getElementById("columnSelectionPanel");

const microphoneStatusValue =
    document.getElementById("microphoneStatusValue");

let listeningSessionActive = false; // Assuming this variable is defined somewhere in the code

const lockedColumnValue =
    document.getElementById("lockedColumnValue");

const currentRollValue =
    document.getElementById("currentRollValue");

const lastUpdatedMarksValue =
    document.getElementById("lastUpdatedMarksValue");

const statusWarningValue =
    document.getElementById("statusWarningValue");

const teacherNameElement =
    document.getElementById("teacherName");

const currentSubjectElement =
    document.getElementById("currentSubject");

const subjectTitleElement =
    document.getElementById("subjectTitle");

const subjectDetailsElement =
    document.getElementById("subjectDetails");

const studentCountElement =
    document.getElementById("studentCount");

const saveDraftBtn = document.getElementById("saveDraftBtn");
const saveSheetBtn = document.getElementById("saveSheetBtn");
const savedSheetsList = document.getElementById("savedSheetsList");
const draftSheetsList = document.getElementById("draftSheetsList");
const deleteSheetsList = document.getElementById("deleteSheetsList");
const savedSheetCount = document.getElementById("savedSheetCount");
const draftSheetCount = document.getElementById("draftSheetCount");
const sheetTabs = document.querySelectorAll(".sheet-tab");
let currentSheetId = null;


/* ==========================================================
   SESSION DATA
========================================================== */

const teacherData =
    localStorage.getItem("teacher");

const selectedSubjectId =
    localStorage.getItem("selectedSubjectId");

let currentTeacher = null;
let currentSubject = null;


function isTeacherLoggedIn() {

    return Boolean(
        currentTeacher &&
        currentTeacher.id
    );

}


/* ==========================================================
   STATE
========================================================== */

let totalCount = 0;
let toastTimeout = null;

let autoRefreshTimer = null;
let healthCheckTimer = null;

let recognition = null;
let recognitionRestartTimer = null;
let localVoiceRecorder = null;
let localVoiceFallbackActive = false;

let continuousListeningActive = false;
let voiceCommandQueue = Promise.resolve();
const microphonePersistenceKey = "voiceAssistantListeningActive";

let lastUpdatedMarksText = "--";
let warningMessage = "No warnings";

let stopCommandHandled = false;

const lockableTableColumns = new Set([
    "quiz",
    "test",
    "assignment",
    "presentation",
    "midterm",
    "final term"
]);

function normalizeColumnName(columnName) {

    return String(columnName || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

}

/*
 * Resolves any spelling/label of a column ("Final Term", "Final",
 * "final_term", "finalterm" ...) to one canonical key so that
 * locking logic can compare columns reliably regardless of which
 * label the table, the column panel, or the backend happen to use.
 */
function canonicalColumnKey(columnName) {

    const normalized = normalizeColumnName(columnName);

    if (!normalized) {
        return "";
    }

    return MARKS_COLUMN_ALIASES[normalized] || normalized;

}


/* ==========================================================
   MARKS VALIDATION RULES
   Quiz          -> 1 to 5
   Test          -> 1 to 10
   Assignment    -> 1 to 10
   Presentation  -> 1 to 10
   Midterm       -> 1 to 40
   Final Term    -> 1 to 50
========================================================== */

const MARKS_LIMITS = {

    quiz: {
        label: "Quiz",
        ruleLabel: "Quiz",
        min: 1,
        max: 5
    },

    test: {
        label: "Test",
        ruleLabel: "Test",
        min: 1,
        max: 10
    },

    assignment: {
        label: "Assignment",
        ruleLabel: "Assignment",
        min: 1,
        max: 10
    },

    presentation: {
        label: "Presentation",
        ruleLabel: "Presentation",
        min: 1,
        max: 10
    },

    midterm: {
        label: "Midterm",
        ruleLabel: "Midterm",
        min: 1,
        max: 40
    },

    final: {
        label: "Final",
        ruleLabel: "Final Term",
        min: 1,
        max: 50
    }

};


const MARKS_COLUMN_ALIASES = {
    quiz: "quiz",
    quize: "quiz",
    quizz: "quiz",
    quizes: "quiz",
    quizzes: "quiz",
    test: "test",
    tests: "test",
    assignment: "assignment",
    assignments: "assignment",
    assign: "assignment",
    presentation: "presentation",
    presentations: "presentation",
    present: "presentation",
    midterm: "midterm",
    midterms: "midterm",
    mid: "midterm",
    midtermexam: "midterm",
    final: "final",
    finals: "final",
    finalterm: "final",
    finalexam: "final",
    finaltermexam: "final"
};


const MARKS_SUCCESS_MESSAGE =
    "\u2705 Valid marks \u2192 Marks updated successfully.";


function resolveMarksColumn(columnName) {

    const key = normalizeColumnName(columnName);

    if (!key) {
        return null;
    }

    return MARKS_COLUMN_ALIASES[key] ||
        (MARKS_LIMITS[key] ? key : null);

}


function buildInvalidMarksMessage(rule, marks) {

    return `\u274C Invalid ${rule.label} ${marks} \u2192 ` +
        `${rule.ruleLabel} marks must be between ${rule.min} and ${rule.max}.`;

}


/*
 * Returns { valid, column, rule, value, message }.
 * Unknown columns are treated as valid so that
 * non-marks commands keep working exactly as before.
 */

function validateMarksValue(columnName, marks) {

    const column = resolveMarksColumn(columnName);

    if (!column) {
        return { valid: true, column: null };
    }

    const rule = MARKS_LIMITS[column];

    const rawText = String(marks).trim();

    const value = Number(rawText);


    const isInvalid =
        rawText === "" ||
        !Number.isFinite(value) ||
        value < rule.min ||
        value > rule.max;


    if (isInvalid) {

        return {
            valid: false,
            column,
            rule,
            value: rawText,
            message: buildInvalidMarksMessage(rule, rawText)
        };

    }


    return {
        valid: true,
        column,
        rule,
        value
    };

}


function detectSpokenColumn(text) {

    const cleaned =
        " " +
        String(text || "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim() +
        " ";


    const patterns = [
        ["final", /\bfinal(\s+term)?\b/],
        ["midterm", /\b(mid\s*term|midterm|mid)\b/],
        ["presentation", /\b(presentation|presentations|present)\b/],
        ["assignment", /\b(assignment|assignments|assign)\b/],
        ["test", /\btests?\b/],
        ["quiz", /\b(quiz|quize|quizz|quizes|quizzes)\b/]
    ];


    for (const [column, pattern] of patterns) {

        if (pattern.test(cleaned)) {
            return column;
        }

    }


    return null;

}


/*
 * Reads the spoken command and validates the marks
 * before the request is sent to the backend.
 */

function validateVoiceMarksCommand(text) {

    const cleaned =
        String(text || "")
            .toLowerCase()
            .replace(/[^a-z0-9.]+/g, " ")
            .trim();


    if (!cleaned) {
        return { valid: true };
    }


    const withoutRoll =
        cleaned.replace(
            /\b(roll|role)\s*(number|no|num)?\s*[a-z0-9]*\d+/g,
            " "
        );


    const column =
        detectSpokenColumn(cleaned) ||
        resolveMarksColumn(excelState.lockedColumn);


    if (!column) {
        return { valid: true };
    }


    const marksMatch =
        withoutRoll.match(
            /marks?\s*(?:is|are|of|equals?|equal\s+to)?\s*(\d+(?:\.\d+)?)/
        ) ||
        withoutRoll.match(
            new RegExp(
                "\\b(?:quiz|quize|quizz|test|assignment|assign|" +
                "presentation|present|mid\\s*term|midterm|mid|" +
                "final\\s*term|final)\\s*(\\d+(?:\\.\\d+)?)"
            )
        );


    if (!marksMatch) {
        return { valid: true };
    }


    return validateMarksValue(column, marksMatch[1]);

}


function recalculateRowTotal(row) {

    if (!row) {
        return;
    }

    const cells = row.querySelectorAll("td");

    const total = [3, 4, 5, 6, 7, 8].reduce(
        (sum, index) => sum + (Number(cells[index]?.textContent) || 0),
        0
    );

    if (cells[9]) {
        cells[9].textContent = total;
    }

}


/*
    Excel state is still preserved.
    Existing Excel functionality will continue working.
*/

const excelState = {
    headers: [],
    rows: [],
    lockedColumn: null
};


/* ==========================================================
   BASIC HELPERS
========================================================== */

function setTextSafe(element, value) {

    if (element) {
        element.textContent = value;
    }

}


function showToast(message, type = "success") {

    if (!toast) {
        return;
    }

    toast.textContent = message;

    toast.style.background =
        type === "success"
            ? "#1D4ED8"
            : type === "warning"
                ? "#D97706"
                : "#dc2626";

    toast.classList.add("show");

    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }

    toastTimeout = setTimeout(() => {

        toast.classList.remove("show");

    }, 3000);

}


function addAlert(message, type = "success") {

    if (!alertContainer) {
        return;
    }

    const alert = document.createElement("div");

    alert.className = `${type}-alert`;

    alert.innerHTML = message;

    alertContainer.prepend(alert);

    setTimeout(() => {

        alert.remove();

    }, 6000);

}


function showLoading(enabled) {

    if (!loadingOverlay) {
        return;
    }

    loadingOverlay.style.display =
        enabled ? "flex" : "none";

}


function normalizeText(text) {

    return (text || "").trim();

}


function downloadFinalExcel() {

    window.location.href = `${API_URL}/download-excel`;

}

function getEditableTableRows() {
    return Array.from(studentTable?.querySelectorAll("tr[data-roll-no]") || []).map(row => {
        const cells = row.querySelectorAll("td");
        return {
            roll_no: row.dataset.rollNo,
            name: cells[1]?.textContent.trim() || "",
            quiz: Number(cells[3]?.textContent) || 0,
            test: Number(cells[4]?.textContent) || 0,
            assignment: Number(cells[5]?.textContent) || 0,
            presentation: Number(cells[6]?.textContent) || 0,
            midterm: Number(cells[7]?.textContent) || 0,
            final: Number(cells[8]?.textContent) || 0
        };
    });
}

async function loadSheets() {
    if (!currentTeacher?.id || !selectedSubjectId) return;
    const response = await fetch(`${API_URL}/sheets/${currentTeacher.id}?subject_id=${selectedSubjectId}`);
    const data = await response.json();
    const sheets = data.sheets || [];
    const saved = sheets.filter(sheet => sheet.status === "saved");
    const drafts = sheets.filter(sheet => sheet.status === "draft");
    setTextSafe(savedSheetCount, saved.length);
    setTextSafe(draftSheetCount, drafts.length);
    const item = (sheet, includeDelete = false) => `
        <div class="sheet-item">
            <button class="sheet-open-btn" data-sheet-id="${sheet.id}">
                <strong>${sheet.name}</strong><small>${new Date(sheet.updated_at).toLocaleString()}</small>
            </button>
            ${sheet.status === "saved" ? `<button class="sheet-download-btn" data-sheet-id="${sheet.id}" title="Download Excel"><i class="fa-solid fa-download"></i></button>` : ""}
            ${includeDelete ? `<button class="sheet-delete-btn" data-sheet-id="${sheet.id}" title="Delete sheet"><i class="fa-solid fa-trash"></i></button>` : ""}
        </div>`;
    const empty = `<p class="sheet-empty">No sheets yet.</p>`;
    if (savedSheetsList) savedSheetsList.innerHTML = saved.map(sheet => item(sheet)).join("") || empty;
    if (draftSheetsList) draftSheetsList.innerHTML = drafts.map(sheet => item(sheet)).join("") || empty;
    if (deleteSheetsList) deleteSheetsList.innerHTML = sheets.map(sheet => item(sheet, true)).join("") || empty;
}

async function saveCurrentSheet(status) {
    if (!currentTeacher?.id || !selectedSubjectId) return;
    const defaultName = `${currentSubject?.subject_name || "Subject"} - ${status === "draft" ? "Draft" : "Final"}`;
    const name = window.prompt("Sheet name:", defaultName);
    if (name === null) return;
    const response = await fetch(`${API_URL}/sheets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacher_id: currentTeacher.id, subject_id: Number(selectedSubjectId), sheet_id: currentSheetId, name, status, rows: getEditableTableRows() })
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.detail || "Unable to save sheet.");
    currentSheetId = data.sheet.id;
    showToast(status === "draft" ? "Draft saved." : "Sheet saved.", "success");
    await loadSheets();
}

async function openSheet(sheetId) {
    const response = await fetch(`${API_URL}/sheets/${currentTeacher.id}?subject_id=${selectedSubjectId}`);
    const data = await response.json();
    const sheet = (data.sheets || []).find(item => item.id === Number(sheetId));
    if (!sheet) return;
    currentSheetId = sheet.id;
    renderDatabaseStudents(sheet.rows || []);
    showToast(`${sheet.name} loaded.`, "success");
}

async function deleteSavedSheet(sheetId) {
    if (!window.confirm("Delete this sheet permanently?")) return;
    const response = await fetch(`${API_URL}/sheets/${currentTeacher.id}/${sheetId}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Unable to delete sheet.");
    if (currentSheetId === Number(sheetId)) currentSheetId = null;
    await loadSheets();
    showToast("Sheet deleted.", "success");
}


/* ==========================================================
   SESSION / TEACHER
========================================================== */

function loadTeacherInformation() {

    if (!teacherData) {

        window.location.href = "login.html";

        return;

    }

    try {

        currentTeacher =
            JSON.parse(teacherData);

        setTextSafe(
            teacherNameElement,
            currentTeacher.name || "Teacher"
        );

    } catch (error) {

        console.error("Teacher data error:", error);

        localStorage.removeItem("teacher");

        window.location.href = "login.html";

    }

}


function setVoiceAccess(enabled) {

    if (!micBtn) {
        return;
    }

    micBtn.disabled = !enabled;
    micBtn.setAttribute(
        "aria-disabled",
        String(!enabled)
    );

    if (!enabled) {
        micBtn.title = "Login as a teacher to use voice commands.";
        setTextSafe(
            voiceStatus,
            "Login required"
        );
        setTextSafe(
            liveText,
            "Please login as a teacher to use voice commands."
        );
    } else {
        micBtn.title = "Start voice input";
    }

}


/* ==========================================================
   LOAD SUBJECT INFORMATION
========================================================== */

async function loadSelectedSubject() {

    if (!selectedSubjectId) {

        setTextSafe(
            currentSubjectElement,
            "No subject selected"
        );

        setTextSafe(
            subjectTitleElement,
            "No subject selected"
        );

        setTextSafe(
            subjectDetailsElement,
            "Please select a subject from Teacher Dashboard."
        );

        return null;

    }


    try {
        const storedSubject = localStorage.getItem("selectedSubject");
        if (storedSubject) {
            currentSubject = JSON.parse(storedSubject);
            setTextSafe(currentSubjectElement, currentSubject.subject_name);
            setTextSafe(subjectTitleElement, currentSubject.subject_name);
            setTextSafe(
                subjectDetailsElement,
                `${currentSubject.year} • Semester ${currentSubject.semester}`
            );
            return { success: true, subject: currentSubject };
        }

        const response = await fetch(
            `${API_URL}/students/${selectedSubjectId}`,
            {
                cache: "no-store"
            }
        );


        const data =
            await response.json();


        if (!response.ok || !data.success) {

            throw new Error(
                data.message || "Subject could not be loaded."
            );

        }


        currentSubject =
            data.subject;


        setTextSafe(
            currentSubjectElement,
            currentSubject.subject_name
        );


        setTextSafe(
            subjectTitleElement,
            currentSubject.subject_name
        );


        setTextSafe(
            subjectDetailsElement,
            `${currentSubject.year} • Semester ${currentSubject.semester}`
        );


        return data;


    } catch (error) {

        console.error(
            "Subject loading error:",
            error
        );


        setTextSafe(
            currentSubjectElement,
            "Unable to load subject"
        );


        setTextSafe(
            subjectTitleElement,
            "Unable to load subject"
        );


        setTextSafe(
            subjectDetailsElement,
            "Could not connect to database."
        );


        addAlert(
            "Unable to load selected subject.",
            "error"
        );


        return null;

    }

}


/* ==========================================================
   BACKEND STATUS
========================================================== */

function setBackendStatus(
    message,
    variant = "success"
) {

    if (!backendStatus) {
        return;
    }


    const icon =
        variant === "success"
            ? "🔵"
            : variant === "warning"
                ? "🟡"
                : "🔴";


    backendStatus.textContent =
        `${icon} ${message}`;


    backendStatus.style.color =
        variant === "success"
            ? "#38BDF8"
            : variant === "warning"
                ? "#fbbf24"
                : "#f87171";

}


/* ==========================================================
   VOICE STATUS
========================================================== */

function updateVoiceStatusCard() {

    if (microphoneStatusValue) {

        microphoneStatusValue.textContent =
            continuousListeningActive
                ? "Listening Active"
                : (voiceStatus?.textContent || "Ready");

    }


    if (lockedColumnValue) {

        lockedColumnValue.textContent =
            excelState.lockedColumn
                ? `🔒 ${excelState.lockedColumn}`
                : "Not Locked";

    }


    if (currentRollValue) {

        currentRollValue.textContent =
            rollNo?.textContent || "--";

    }


    if (lastUpdatedMarksValue) {

        lastUpdatedMarksValue.textContent =
            lastUpdatedMarksText || "--";

    }


    if (statusWarningValue) {

        statusWarningValue.textContent =
            warningMessage || "No warnings";

    }

}


/* ==========================================================
   PARSE COMMAND DISPLAY
========================================================== */

function parseCommandDisplay(
    text,
    selectedColumn = ""
) {

    const normalized =
        (text || "").toLowerCase();


    const rollMatch =
        normalized.match(
            /roll(?: number)?\s*(\d+)/i
        );


    const subjectMatch =
        normalized.match(
            /\b(assignment|test|midterm|final|finalterm)\b/i
        );


    const marksMatch =
        normalized.match(
            /marks?\s*(\d+)/i
        );


    setTextSafe(
        rollNo,
        rollMatch
            ? rollMatch[1]
            : "--"
    );


    /*
     * If a database subject is selected,
     * show that subject instead of assessment name.
     */

    setTextSafe(
        subjectName,
        currentSubject?.subject_name ||
        (selectedColumn || subjectMatch?.[1] || "--")
            .toUpperCase()
    );


    setTextSafe(
        marksValue,
        marksMatch
            ? marksMatch[1]
            : "--"
    );


    updateVoiceStatusCard();

}


/* ==========================================================
   API RESPONSE HELPERS
========================================================== */

function showJSON(data) {

    if (!jsonViewer) {
        return;
    }

    jsonViewer.textContent =
        JSON.stringify(data, null, 2);

}


function showResponse(data) {

    if (!apiResponse) {
        return;
    }


    const message =
        data?.message ||
        "No response message available.";


    const text =
        data?.text ||
        "No transcription available.";


    apiResponse.innerHTML = `
        <b>Message:</b><br>
        ${message}

        <br><br>

        <b>Voice Text:</b><br>
        ${text}
    `;

}


/* ==========================================================
   HEALTH CHECK
========================================================== */

async function getHealthStatus() {

    setBackendStatus(
        "Checking backend...",
        "warning"
    );

    const controller =
        new AbortController();

    const timeoutId =
        setTimeout(
            () => controller.abort(),
            5000
        );


    try {

        const response =
            await fetch(
                `${API_URL}/health`,
                {
                    cache: "no-store",
                    signal: controller.signal
                }
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        const data =
            await response.json();


        setBackendStatus(
            "Backend Connected",
            "success"
        );


        if (apiResponse) {

            apiResponse.innerHTML = `
                <b>Health:</b>
                ${data.status}

                <br>

                ${data.message}

                <br><br>

                <b>Database:</b>
                Connected

                <br>

                <b>Excel Integration:</b>
                ${EXCEL_INTEGRATION_ENABLED
                    ? "Enabled"
                    : "Disabled"}
            `;

        }


        return true;


    } catch (error) {

        setBackendStatus(
            "Backend Disconnected",
            "error"
        );


        addAlert(
            "Backend health check failed.",
            "error"
        );


        return false;

    } finally {

        clearTimeout(timeoutId);

    }

}


/* ==========================================================
   DATABASE STUDENTS
========================================================== */

async function fetchDatabaseStudents() {

    if (!selectedSubjectId) {

        console.warn("No subject selected.");

        addAlert(
            "No subject selected.",
            "warning"
        );

        setBackendStatus(
            "No Subject Selected",
            "warning"
        );

        return [];

    }

    try {

        setBackendStatus(
            "Loading students...",
            "warning"
        );

        console.log(
            "Loading students for subject ID:",
            selectedSubjectId
        );


        const response = await fetch(
            `${API_URL}/students/${selectedSubjectId}`,
            {
                method: "GET",
                cache: "no-store",
                headers: {
                    "Accept": "application/json"
                }
            }
        );


        if (!response.ok) {

            throw new Error(
                `Server returned ${response.status}`
            );

        }


        const data = await response.json();


        console.log(
            "Students API response:",
            data
        );


        if (!data.success) {

            throw new Error(
                data.message ||
                "Unable to load students."
            );

        }


        /* ==================================================
           SAVE SELECTED SUBJECT
        ================================================== */

        if (data.subject) {

            currentSubject =
                data.subject;


            setTextSafe(
                currentSubjectElement,
                currentSubject.subject_name
            );


            setTextSafe(
                subjectTitleElement,
                currentSubject.subject_name
            );


            setTextSafe(
                subjectDetailsElement,
                `${currentSubject.year} • Semester ${currentSubject.semester}`
            );

        }


        /* ==================================================
           DATABASE STUDENTS
        ================================================== */

        const students =
            Array.isArray(data.students)
                ? data.students
                : [];


        console.log(
            `Students received from database: ${students.length}`
        );


        setBackendStatus(
            "Database Connected",
            "success"
        );


        return students;


    } catch (error) {

        console.error(
            "Database students error:",
            error
        );


        setBackendStatus(
            "Database Error",
            "error"
        );


        addAlert(
            "Unable to load students from database.",
            "error"
        );


        return [];

    }

}


/* ==========================================================
   DATABASE TABLE RENDER
========================================================== */

function renderDatabaseStudents(students) {

    if (
        !studentTableHeadRow ||
        !studentTable
    ) {

        console.error(
            "Student table elements not found in HTML."
        );

        return;

    }


    /* ==================================================
       TABLE HEADERS
    ================================================== */

    const headers = [

        "S.No",
        "Name",
        "Roll No",
        "Quiz",
        "Test",
        "Assignment",
        "Presentation",
        "Midterm",
        "Final Term",
        "Total"

    ];


    studentTableHeadRow.innerHTML =
        headers
            .map(header => {
                const isLockable = lockableTableColumns.has(
                    header.toLowerCase()
                );

                return `
                    <th
                        ${isLockable ? `class="lockable-column" data-column-name="${header}"` : ""}
                    >
                        ${header}
                    </th>
                `;
            })
            .join("");


    /* ==================================================
       NO STUDENTS
    ================================================== */

    if (!Array.isArray(students) || students.length === 0) {

        studentTable.innerHTML = `
            <tr>
                <td
                    colspan="10"
                    style="text-align:center; padding:20px;"
                >
                    No students found for this subject.
                </td>
            </tr>
        `;


        setTextSafe(
            studentCountElement,
            0
        );


        setTextSafe(
            totalStudents,
            0
        );


        setTextSafe(
            averageMarks,
            "0"
        );


        excelState.headers = headers;
        excelState.rows = [];

        return;

    }


    /* ==================================================
       STUDENT ROWS
    ================================================== */

    studentTable.innerHTML =
        students
            .map(student => {

                const quiz = Number(student.quiz) || 0;
                const test = Number(student.test) || 0;
                const assignment = Number(student.assignment) || 0;
                const presentation = Number(student.presentation) || 0;
                const midterm = Number(student.midterm) || 0;
                const finalTerm = Number(student.final ?? student.finalterm) || 0;
                const total = quiz + test + assignment + presentation + midterm + finalTerm;

                const studentId =
                    student.id ?? "";

                const rollNo =
                    student.roll_no ?? "--";

                const studentName =
                    student.name ?? "--";


                return `
                    <tr
                        data-student-id="${studentId}"
                        data-roll-no="${rollNo}"
                    >

                        <td>
                            ${students.indexOf(student) + 1}
                        </td>

                        <td>
                            <strong>${studentName}</strong>
                        </td>

                        <td>
                            ${rollNo}
                        </td>

                        <td class="mark-cell" contenteditable="true" data-field="quiz">${quiz}</td>

                        <td class="mark-cell" contenteditable="true" data-field="test">${test}</td>

                        <td class="mark-cell" contenteditable="true" data-field="assignment">${assignment}</td>

                        <td class="mark-cell" contenteditable="true" data-field="presentation">${presentation}</td>

                        <td class="mark-cell" contenteditable="true" data-field="midterm">${midterm}</td>

                        <td class="mark-cell" contenteditable="true" data-field="final">${finalTerm}</td>

                        <td class="mark-cell total-cell">
                            <strong>${total}</strong>
                        </td>

                    </tr>
                `;

            })
            .join("");


    /* ==================================================
       STUDENT COUNTS
    ================================================== */

    setTextSafe(
        studentCountElement,
        students.length
    );


    setTextSafe(
        totalStudents,
        students.length
    );


    setTextSafe(
        totalEntries,
        0
    );


    setTextSafe(
        averageMarks,
        "0"
    );


    /* ==================================================
       SAVE DATABASE DATA IN EXISTING EXCEL STATE
    ================================================== */

    excelState.headers =
        headers;


    excelState.rows =
        students;


    /* ==================================================
       UPDATE EXISTING COLUMN STYLES
    ================================================== */

    updateLockedColumnStyles();

}


function updateLiveStudentMarks(data) {

    const results = Array.isArray(data?.results)
        ? data.results
        : data?.updated
            ? [{
                roll_no: data.roll_no,
                marks: data.marks,
                updated: true,
                column: data.selected_column || data.column
            }]
            : [];

    const columnIndexes = {
        quiz: 3,
        test: 4,
        assignment: 5,
        presentation: 6,
        midterm: 7,
        final: 8,
        finalterm: 8
    };

    results.forEach(result => {

        if (!result?.updated || result.roll_no == null) {
            return;
        }

        const requestedRoll = String(result.roll_no).trim().toUpperCase();
        const row = Array.from(studentTable?.querySelectorAll("tr[data-roll-no]") || [])
            .find(candidate => {
                const existingRoll = String(candidate.dataset.rollNo || "").trim().toUpperCase();
                if (existingRoll === requestedRoll) return true;
                if (!/^\d+$/.test(requestedRoll)) return false;
                const suffix = requestedRoll.padStart(2, "0");
                return existingRoll.endsWith(`-${suffix}`) || existingRoll.endsWith(`BSIT${suffix}`);
            });

        const rawColumnName = String(
            result.column || data.selected_column || data.column || ""
        ).toLowerCase().replace(/[_-]+/g, " ").trim();
        const columnName = rawColumnName === "final term" || rawColumnName === "finalterm"
            ? "final"
            : rawColumnName;

        const cellIndex = columnIndexes[columnName];

        if (!row || cellIndex === undefined) {
            return;
        }

        const cell = row.querySelectorAll("td")[cellIndex];

        if (cell) {
            cell.textContent = result.marks;
        }

        const cells = row.querySelectorAll("td");
        const total = [3, 4, 5, 6, 7, 8]
            .reduce(
                (sum, index) => sum + (Number(cells[index]?.textContent) || 0),
                0
            );

        if (cells[9]) {
            cells[9].textContent = total;
        }

    });
}


/* ==========================================================
   MAIN DATABASE DASHBOARD REFRESH
========================================================== */

async function refreshDatabaseDashboard(showBusy = true) {

    try {

        showLoading(showBusy);


        const students =
            await fetchDatabaseStudents();


        renderDatabaseStudents(
            students
        );


        /* ==================================================
           SUCCESS MESSAGE
        ================================================== */

        if (students.length > 0) {

            addAlert(
                `${students.length} students loaded successfully.`,
                "success"
            );


            showToast(
                `${students.length} students loaded.`,
                "success"
            );

        }

        /* ==================================================
           EMPTY DATABASE
        ================================================== */

        else {

            addAlert(
                "No students found for this subject.",
                "warning"
            );

        }


    } catch (error) {

        console.error(
            "Dashboard refresh error:",
            error
        );


        addAlert(
            "Unable to refresh student dashboard.",
            "error"
        );


    } finally {

        if (showBusy) {
            showLoading(false);
        }

    }

}


/* ==========================================================
   EXCEL FUNCTIONS
   Existing Excel functionality preserved
========================================================== */

function normalizeRowHeaders(rows) {

    const sourceRows =
        Array.isArray(rows)
            ? rows
            : [];


    if (!sourceRows.length) {
        return [];
    }


    const firstRow =
        sourceRows.find(
            row =>
                row &&
                typeof row === "object" &&
                Object.keys(row).length > 0
        );


    if (!firstRow) {
        return [];
    }


    return Object.keys(firstRow)
        .filter(
            key =>
                String(key).trim() !== ""
        )
        .map(
            key =>
                String(key).trim()
        )
        .filter(
            (key, index, array) =>
                array.indexOf(key) === index
        );

}


function getRowCellValue(
    row,
    header
) {

    if (!row ||
        typeof row !== "object") {

        return "";

    }


    const exactMatch =
        row[header];


    if (
        exactMatch !== undefined &&
        exactMatch !== null &&
        exactMatch !== ""
    ) {

        return exactMatch;

    }


    const normalizedHeader =
        String(header).trim();


    const matchingKey =
        Object.keys(row).find(
            key =>
                String(key)
                    .trim()
                    .toLowerCase() ===
                normalizedHeader.toLowerCase()
        );


    if (matchingKey !== undefined) {

        return row[matchingKey];

    }


    return "";

}


/* ==========================================================
   COLUMN LOCKING
========================================================== */

function updateLockedColumnStyles() {

    const buttons =
        columnSelectionPanel
            ? columnSelectionPanel.querySelectorAll(
                ".column-select-btn"
            )
            : [];


    const headers =
        Array.isArray(excelState.headers)
            ? excelState.headers
            : [];


    buttons.forEach(button => {

        const columnName =
            button.dataset.columnName || "";


        const isLocked =
            excelState.lockedColumn &&
            canonicalColumnKey(columnName) ===
            canonicalColumnKey(excelState.lockedColumn);


        button.classList.toggle(
            "is-locked",
            isLocked
        );


        button.innerHTML =
            isLocked
                ? `🔒 ${columnName}`
                : columnName;

    });


    const tableHeaders =
        studentTableHeadRow
            ? studentTableHeadRow.querySelectorAll("th")
            : [];


    tableHeaders.forEach(headerCell => {

        const columnName =
            headerCell.dataset.columnName ||
            headerCell.textContent.trim();


        headerCell.classList.toggle(
            "locked-column",
            Boolean(excelState.lockedColumn) &&
            canonicalColumnKey(columnName) ===
            canonicalColumnKey(excelState.lockedColumn)
        );

    });


    const rows =
        studentTable
            ? studentTable.querySelectorAll("tr")
            : [];


    rows.forEach(row => {

        const cells =
            row.querySelectorAll("td");


        cells.forEach((cell, index) => {

            const matchedHeader =
                headers[index];


            cell.classList.toggle(
                "locked-column",
                Boolean(excelState.lockedColumn) &&
                canonicalColumnKey(matchedHeader) ===
                canonicalColumnKey(excelState.lockedColumn)
            );

        });

    });

}


function syncLockedColumn(
    columnName,
    options = {}
) {

    const {
        showMessage = false
    } = options;


    const safeColumnName =
        columnName
            ? String(columnName).trim()
            : "";


    if (!safeColumnName) {

        excelState.lockedColumn = null;

        updateLockedColumnStyles();

        return;

    }


    const headers =
        Array.isArray(excelState.headers)
            ? excelState.headers
            : [];


    const matchingHeader =
        headers.find(
            header =>
                canonicalColumnKey(header) ===
                canonicalColumnKey(safeColumnName)
        );


    if (
        headers.length > 0 &&
        !matchingHeader
    ) {

        excelState.lockedColumn = null;

        updateLockedColumnStyles();

        return;

    }


    excelState.lockedColumn =
        matchingHeader ||
        safeColumnName;


    updateLockedColumnStyles();


    if (showMessage) {

        showToast(
            `Column '${excelState.lockedColumn}' Locked`
        );

    }


    updateVoiceStatusCard();

}


function renderColumnSelectionPanel(
    headers = excelState.headers
) {

    if (!columnSelectionPanel) {
        return;
    }


    const panelHeaders =
        Array.isArray(headers) &&
        headers.length > 0
            ? headers
            : [];


    /*
     * Only assessment columns should
     * normally be selectable.
     */

    const selectableHeaders =
        panelHeaders.filter(
            header =>
                ![
                    "Roll No",
                    "Student Name"
                ].includes(header)
        );


    columnSelectionPanel.innerHTML =
        selectableHeaders
            .map(
                header => `
                    <button
                        type="button"
                        class="column-select-btn"
                        data-column-name="${header}"
                    >
                        ${header}
                    </button>
                `
            )
            .join("");


    updateLockedColumnStyles();

}


async function persistLockedColumnToBackend(
    columnName
) {

    const safeColumnName =
        columnName
            ? String(columnName).trim()
            : "";


    try {

        const response =
            await fetch(
                `${API_URL}/set-column`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        column:
                            safeColumnName
                    })
                }
            );


        const data =
            await response.json();


        const selectedColumn =
            data?.selected_column ||
            "";


        syncLockedColumn(
            selectedColumn,
            {
                showMessage: true
            }
        );


        showToast(
            data?.message ||
            (selectedColumn
                ? `Column '${selectedColumn}' Locked`
                : "Column unlocked."),
            response.ok
                ? "success"
                : "error"
        );


    } catch (error) {

        console.error(error);


        syncLockedColumn(safeColumnName, { showMessage: true });


        showToast(
            safeColumnName
                ? `Column '${safeColumnName}' Locked locally.`
                : "Column unlocked locally.",
            "warning"
        );

    }

}


function toggleLockedColumn(columnName) {

    const isSameColumn =
        excelState.lockedColumn &&
        canonicalColumnKey(excelState.lockedColumn) ===
            canonicalColumnKey(columnName);

    return persistLockedColumnToBackend(
        isSameColumn ? "" : columnName
    );

}


async function handleColumnLockSelection(
    event
) {

    const button =
        event.target.closest(
            ".column-select-btn"
        );


    if (!button) {
        return;
    }


    const selectedColumn =
        button.dataset.columnName || "";


    if (!selectedColumn) {
        return;
    }


    await toggleLockedColumn(
        selectedColumn
    );

}


/* ==========================================================
   EXCEL TABLE RENDER
========================================================== */

function renderStudentTable(
    data,
    headers = excelState.headers
) {

    if (!studentTable ||
        !studentTableHeadRow) {

        return;

    }


    const tableHeaders =
        Array.isArray(headers) &&
        headers.length > 0
            ? headers
            : normalizeRowHeaders(data);


    studentTableHeadRow.innerHTML =
        tableHeaders
            .map(
                header =>
                    `<th>${header}</th>`
            )
            .join("");


    renderColumnSelectionPanel(
        tableHeaders
    );


    const rows =
        (Array.isArray(data)
            ? data
            : []
        )
        .map(row => {

            const cells =
                tableHeaders
                    .map(
                        header =>
                            `<td>${getRowCellValue(
                                row,
                                header
                            )}</td>`
                    )
                    .join("");


            return `<tr>${cells}</tr>`;

        })
        .join("");


    studentTable.innerHTML =
        rows;


    setTextSafe(
        studentCountElement,
        Array.isArray(data)
            ? data.length
            : 0
    );


    setTextSafe(
        totalStudents,
        Array.isArray(data)
            ? data.length
            : 0
    );


    updateLockedColumnStyles();

}


/* ==========================================================
   EXCEL UPLOAD
========================================================== */

function readUploadedWorkbook(file) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();


            reader.onload =
                event => {

                    try {

                        const workbook =
                            XLSX.read(
                                event.target.result,
                                {
                                    type: "array"
                                }
                            );


                        const sheetName =
                            workbook.SheetNames[0];


                        const worksheet =
                            workbook.Sheets[
                                sheetName
                            ];


                        const rows =
                            XLSX.utils.sheet_to_json(
                                worksheet,
                                {
                                    defval: "",
                                    raw: false,
                                    blankrows: false
                                }
                            );


                        if (!rows.length) {

                            resolve({
                                headers: [],
                                rows: []
                            });

                            return;

                        }


                        const headers =
                            normalizeRowHeaders(
                                rows
                            );


                        resolve({
                            headers,
                            rows
                        });


                    } catch (error) {

                        reject(
                            new Error(
                                "Unable to read the uploaded Excel file."
                            )
                        );

                    }

                };


            reader.onerror =
                () =>
                    reject(
                        new Error(
                            "Unable to read the uploaded Excel file."
                        )
                    );


            reader.readAsArrayBuffer(file);

        }
    );

}


function handleExcelUpload(event) {

    const file =
        event.target.files?.[0];


    if (!file) {
        return;
    }


    showLoading(true);


    readUploadedWorkbook(file)

        .then(
            ({
                headers,
                rows
            }) => {

                if (
                    !headers.length ||
                    !rows.length
                ) {

                    addAlert(
                        "The uploaded Excel file does not contain readable rows.",
                        "warning"
                    );


                    return;

                }


                excelState.headers =
                    headers;


                excelState.rows =
                    rows;


                excelState.lockedColumn =
                    null;


                renderStudentTable(
                    rows,
                    headers
                );


                showToast(
                    `Loaded Excel file: ${file.name}`,
                    "success"
                );


                addAlert(
                    `Excel file loaded successfully: ${file.name}`,
                    "success"
                );

            }
        )

        .catch(error => {

            console.error(error);


            addAlert(
                "Unable to parse the uploaded Excel file.",
                "error"
            );


            showToast(
                "Excel upload failed.",
                "error"
            );

        })

        .finally(() => {

            showLoading(false);

            event.target.value = "";

        });

}


/* ==========================================================
   AUDIO / BEEP
========================================================== */

let audioContext = null;


function getAudioContext() {

    const AudioCtor =
        window.AudioContext ||
        window.webkitAudioContext;


    if (!AudioCtor) {
        return null;
    }


    if (!audioContext) {
        audioContext =
            new AudioCtor();
    }


    return audioContext;

}


function playBeep(
    count = 1,
    frequency = 700
) {

    const context =
        getAudioContext();


    if (!context) {
        return;
    }


    for (
        let index = 0;
        index < count;
        index += 1
    ) {

        const oscillator =
            context.createOscillator();


        const gainNode =
            context.createGain();


        oscillator.type =
            "sine";


        oscillator.frequency.value =
            frequency +
            (index * 120);


        gainNode.gain.value =
            0.0001;


        oscillator.connect(
            gainNode
        );


        gainNode.connect(
            context.destination
        );


        const startTime =
            context.currentTime +
            (index * 0.18);


        oscillator.start(
            startTime
        );


        gainNode.gain
            .exponentialRampToValueAtTime(
                0.22,
                startTime + 0.02
            );


        gainNode.gain
            .exponentialRampToValueAtTime(
                0.0001,
                startTime + 0.14
            );


        oscillator.stop(
            startTime + 0.16
        );

    }

}


/* ==========================================================
   SPEECH RECOGNITION
========================================================== */

function createSpeechRecognition() {

    const SpeechRecognitionCtor =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;


    if (!SpeechRecognitionCtor) {
        return null;
    }


    const instance =
        new SpeechRecognitionCtor();


    instance.lang =
        "en-IN";


    instance.continuous =
        true;


    instance.interimResults =
           true;


    instance.maxAlternatives =
        5;

    return instance;

}


async function sendLocalAudioChunk(blob) {

    if (!localVoiceFallbackActive || !blob.size) {
        return;
    }

    const formData = new FormData();
    formData.append("audio", blob, "voice.webm");

    try {
        const response = await fetch(
            `${API_URL}/transcribe-audio`,
            {
                method: "POST",
                body: formData
            }
        );
        const data = await response.json();

        if (response.ok && data.text) {
            await queueVoiceCommand(data.text);
        }
    } catch (error) {
        console.error("Local voice fallback error:", error);
        setTextSafe(responseStatus, "Local voice backend error");
    }

}


async function startLocalVoiceFallback() {

    if (
        localVoiceFallbackActive ||
        !navigator.mediaDevices?.getUserMedia
    ) {
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : "audio/webm";

        localVoiceRecorder = new MediaRecorder(stream, { mimeType });
        localVoiceFallbackActive = true;
        localVoiceRecorder.ondataavailable = event => sendLocalAudioChunk(event.data);
        localVoiceRecorder.onstart = () => {
            setTextSafe(voiceStatus, "Listening locally...");
            setTextSafe(responseStatus, "Speak now");
        };
        localVoiceRecorder.start(5000);
        addAlert("Online speech service unavailable. Local voice mode started.", "warning");
    } catch (error) {
        console.error("Local microphone error:", error);
        setTextSafe(responseStatus, "Microphone permission required");
        addAlert("Allow microphone access and try again.", "error");
    }

}


function stopLocalVoiceFallback() {

    localVoiceFallbackActive = false;

    if (localVoiceRecorder) {
        localVoiceRecorder.stream.getTracks().forEach(track => track.stop());
        localVoiceRecorder.stop();
        localVoiceRecorder = null;
    }

}


function syncMicButtonState() {

    if (!micBtn) {
        return;
    }


    micBtn.style.background =
        continuousListeningActive
            ? "#dc2626"
            : "#2563eb";


    micBtn.style.transform =
        continuousListeningActive
            ? "scale(1.15)"
            : "scale(1)";


    micBtn.innerHTML =
        continuousListeningActive
            ? '<i class="fa-solid fa-wave-square"></i>'
            : '<i class="fa-solid fa-microphone"></i>';


    micBtn.setAttribute(
        "aria-pressed",
        String(
            continuousListeningActive
        )
    );

}


function startListeningAnimation() {

    syncMicButtonState();

}


function stopListeningAnimation() {

    syncMicButtonState();

}


function selectBestTranscript(result) {

    const candidates = [];

    for (
        let index = 0;
        index < result.length;
        index += 1
    ) {
        const transcript = normalizeText(
            result[index]?.transcript
        );

        if (transcript) {
            candidates.push(transcript);
        }
    }

    if (candidates.length <= 1) {
        return candidates[0] || "";
    }

    const commandWords =
        /\b(roll|role|marks?|assignment|assign|quiz|quize|test|presentation|present|midterm|final|stop|exit|unlock|clear)\b/gi;

    return candidates
        .map((candidate, index) => {
            const normalized = candidate.toLowerCase();
            let score = 0;

            score += (normalized.match(commandWords) || []).length * 4;
            score += (normalized.match(/\d+/g) || []).length * 3;

            if (/\b(roll|role)\b/.test(normalized)) {
                score += 5;
            }

            if (/\bmarks?\b/.test(normalized)) {
                score += 5;
            }

            if (/\b(stop|exit|unlock|clear)\b/.test(normalized)) {
                score += 10;
            }

            score -= Math.max(0, candidate.length - 80) / 10;
            score -= index * 0.1;

            return { candidate, score };
        })
        .sort((left, right) => right.score - left.score)[0]
        .candidate;

}


/* ==========================================================
   VOICE COMMAND
========================================================== */

function isCommandError(
    response,
    data = {}
) {

    const message =
        String(
            data.message || ""
        ).toLowerCase();


    const hasFailedResult =
        Array.isArray(data.results) &&
        data.results.some(
            result =>
                result.updated === false
        );


    const hasErrorMessage =
        /error|invalid|not found|not recognized|no column|no marks|unable|failed|missing|write-protected|could not|must be between/
            .test(message);


    return (
        !response.ok ||
        hasFailedResult ||
        hasErrorMessage
    );

}


function shouldStopListening(
    text = ""
) {

    const commandText =
        normalizeText(text)
            .toLowerCase()
            .replace(/[.!?]+$/g, "")
            .trim();


    return /^(?:please\s+)?(?:stop|exit|unlock|clear|release|cancel|close\s+(?:microphone|mic|listening)|stop\s+listening|turn\s+off\s+(?:microphone|mic))$/
        .test(commandText);

}


async function processVoiceText(text) {

    const listeningSessionActive =
        continuousListeningActive;

    const commandRequestsStop =
        shouldStopListening(text);

    if (
        listeningSessionActive &&
        commandRequestsStop
    ) {

        stopContinuousMode();

    }


    /* ==================================================
       LOCAL MARKS VALIDATION
       Invalid marks are rejected here and never
       reach the backend.
    ================================================== */

    const marksValidation =
        validateVoiceMarksCommand(text);


    if (!marksValidation.valid) {

        setTextSafe(
            liveText,
            normalizeText(text) ||
            "No text recognized."
        );


        setTextSafe(
            responseStatus,
            marksValidation.message
        );


        setTextSafe(
            voiceStatus,
            "Invalid Marks"
        );


        warningMessage =
            marksValidation.message;


        parseCommandDisplay(
            text,
            marksValidation.rule.ruleLabel
        );


        updateVoiceStatusCard();


        showResponse({
            message: marksValidation.message,
            text: normalizeText(text)
        });


        showJSON({
            updated: false,
            valid: false,
            column: marksValidation.column,
            marks: marksValidation.value,
            allowed_range: `${marksValidation.rule.min} - ${marksValidation.rule.max}`,
            message: marksValidation.message
        });


        addAlert(
            marksValidation.message,
            "error"
        );


        showToast(
            marksValidation.message,
            "error"
        );


        playBeep(
            3,
            260
        );


        if (
            listeningSessionActive &&
            !commandRequestsStop
        ) {

            continuousListeningActive = true;
            syncMicButtonState();
            scheduleRecognitionRestart();

        }


        return;

    }


    setTextSafe(
        voiceStatus,
        "Processing"
    );


    setTextSafe(
        responseStatus,
        "Sending voice command"
    );


    setTextSafe(
        liveText,
        "⏳ Processing your voice command..."
    );


    try {

        const response =
            await fetch(
                `${API_URL}/voice-command`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        text
                    })
                }
            );


        const data =
            await response.json();


        const recognizedText =
            normalizeText(
                data.text || text
            );


        setTextSafe(
            liveText,
            recognizedText ||
            "No text recognized."
        );


        setTextSafe(
            responseStatus,
            data.message ||
            "Response received."
        );


        setTextSafe(
            voiceStatus,
            data.updated
                ? "Updated"
                : data.selected_column
                    ? "Column Selected"
                    : "Ready"
        );


        warningMessage =
            data?.message
                ?.toLowerCase()
                .includes("error") ||
            data?.message
                ?.toLowerCase()
                .includes("warning")
                ? data.message
                : "No warnings";


        parseCommandDisplay(
            recognizedText,
            data.selected_column ||
            data.column ||
            ""
        );


        if (
            data.updated &&
            data.message
        ) {

            const matchedMarks =
                String(
                    data.message
                ).match(
                    /(\d+(?:\.\d+)?)/g
                );


            lastUpdatedMarksText =
                matchedMarks &&
                matchedMarks.length
                    ? matchedMarks[
                        matchedMarks.length - 1
                    ]
                    : (
                        marksValue?.textContent ||
                        "--"
                    );

        }


        updateVoiceStatusCard();


        showResponse(data);


        showJSON(data);


        const commandError =
            isCommandError(
                response,
                data
            );


        if (!commandError && (data.updated || data.updated_count > 0)) {
            updateLiveStudentMarks(data);

            setTextSafe(
                responseStatus,
                MARKS_SUCCESS_MESSAGE
            );

            addAlert(
                MARKS_SUCCESS_MESSAGE,
                "success"
            );

            showToast(
                MARKS_SUCCESS_MESSAGE,
                "success"
            );

            await refreshDatabaseDashboard();
        }


        addAlert(
            commandError
                ? `Error: ${data.message}`
                : `Voice command processed: ${data.message}`,
            commandError
                ? "error"
                : "success"
        );


        if (commandError) {

            playBeep(
                3,
                260
            );


            showToast(
                data.message,
                "error"
            );

        } else {

            playBeep(
                1,
                700
            );

        }


        totalCount += 1;


        setTextSafe(
            totalEntries,
            totalCount
        );


        const shouldRefreshAfterCommand =
            commandRequestsStop;


        if (
            listeningSessionActive &&
            !shouldRefreshAfterCommand
        ) {

            continuousListeningActive = true;
            syncMicButtonState();
            scheduleRecognitionRestart();

        }


        if (
            listeningSessionActive &&
            shouldRefreshAfterCommand &&
            !stopCommandHandled
        ) {

            stopCommandHandled = true;

            stopContinuousMode();


            showToast(
                "Voice listening stopped.",
                "success"
            );

        }


        if (
            !shouldRefreshAfterCommand &&
            data.selected_column
        ) {

            showToast(
                `Column selected: ${data.selected_column}`,
                "success"
            );

        }


    } catch (error) {

        console.error(error);


        setTextSafe(
            liveText,
            "Unable to connect to backend."
        );


        setTextSafe(
            responseStatus,
            "Backend error"
        );


        setTextSafe(
            voiceStatus,
            "Offline"
        );


        warningMessage =
            "Backend connection failed.";


        setBackendStatus(
            "Backend Disconnected",
            "error"
        );


        addAlert(
            "Backend connection failed.",
            "error"
        );


        showToast(
            "Backend connection failed.",
            "error"
        );


        playBeep(
            3,
            260
        );


        continuousListeningActive =
            listeningSessionActive &&
            !commandRequestsStop;


        if (
            listeningSessionActive &&
            !commandRequestsStop
        ) {
            scheduleRecognitionRestart();
        }


        updateVoiceStatusCard();

    }

}

function queueVoiceCommand(text) {
    voiceCommandQueue = voiceCommandQueue
        .then(() => processVoiceText(text))
        .catch(error => console.error("Voice command queue error:", error));
    return voiceCommandQueue;
}


/* ==========================================================
   CONTINUOUS VOICE MODE
========================================================== */

function scheduleRecognitionRestart() {

    if (
        !continuousListeningActive ||
        !recognition
    ) {
        return;
    }

    if (recognitionRestartTimer) {
        clearTimeout(recognitionRestartTimer);
    }

    recognitionRestartTimer = setTimeout(
        () => {

            recognitionRestartTimer = null;

            if (
                !continuousListeningActive
            ) {
                return;
            }

            try {

                recognition.start();

            } catch (error) {

                scheduleRecognitionRestart();

            }

        },
        300
    );

}


async function startContinuousMode() {

    if (!isTeacherLoggedIn()) {
        setVoiceAccess(false);
        window.location.href = "login.html";
        return;
    }

    if (continuousListeningActive) {
        return;
    }


    continuousListeningActive =
        true;


    stopCommandHandled =
        false;


    warningMessage =
        "No warnings";


    startListeningAnimation();


    addAlert(
        "Continuous listening started. Say 'exit' to stop.",
        "success"
    );


    updateVoiceStatusCard();


    if (!recognition) {

        recognition =
            createSpeechRecognition();

    }


    if (!recognition) {

        continuousListeningActive =
            false;

        localStorage.removeItem(microphonePersistenceKey);


        stopListeningAnimation();


        addAlert(
            "Speech recognition is not supported in this browser.",
            "error"
        );


        return;

    }

    localStorage.setItem(microphonePersistenceKey, "true");


    recognition.onresult =
        event => {

            const finalTranscripts =
                [];

            let interimTranscript = "";


            for (
                let index = event.resultIndex;
                index < event.results.length;
                index += 1
            ) {

                const result =
                    event.results[index];

                const liveTranscript =
                    normalizeText(result[0]?.transcript);

                if (
                    !result.isFinal &&
                    liveTranscript
                ) {
                    interimTranscript += `${liveTranscript} `;
                }


                if (result.isFinal) {

                    const transcript =
                        selectBestTranscript(result);

                    if (transcript) {
                        finalTranscripts.push(transcript);
                    }

                }

            }

            if (interimTranscript.trim()) {
                setTextSafe(liveText, interimTranscript.trim());
                setTextSafe(voiceStatus, "Hearing voice...");
            }


            finalTranscripts.forEach(
                text =>
                        queueVoiceCommand(text)
            );

        };


    recognition.onerror =
        event => {

            warningMessage =
                `Microphone: ${event.error}`;

            setTextSafe(
                responseStatus,
                event.error === "not-allowed"
                    ? "Microphone permission denied"
                    : `Microphone ${event.error}`
            );

            if (
                event.error !== "no-speech" &&
                event.error !== "aborted"
            ) {

                warningMessage =
                    `Microphone: ${event.error}`;


                setTextSafe(
                    responseStatus,
                    "Speech recognition error"
                );


                updateVoiceStatusCard();

            }

            if (event.error === "network") {
                continuousListeningActive = true;
                syncMicButtonState();
                try {
                    recognition.stop();
                } catch (error) {
                    // Recognition is already stopped.
                }
                startLocalVoiceFallback();
            }

        };


    recognition.onend =
        () => {

            if (localVoiceFallbackActive) {
                return;
            }

            if (continuousListeningActive) {
                setTextSafe(voiceStatus, "Listening...");
            }

            scheduleRecognitionRestart();

        };


    recognition.onstart =
        () => {

            setTextSafe(voiceStatus, "Listening...");
            setTextSafe(responseStatus, "Speak now");

        };


    try {

        recognition.start();

    } catch (error) {

        // Already running.

    }

}


function stopContinuousMode() {

    continuousListeningActive =
        false;

    localStorage.removeItem(microphonePersistenceKey);

    stopLocalVoiceFallback();

    if (recognitionRestartTimer) {
        clearTimeout(recognitionRestartTimer);
        recognitionRestartTimer = null;
    }


    if (recognition) {

        try {

            recognition.stop();

        } catch (error) {

            // Already stopped.

        }

    }


    stopListeningAnimation();


    setTextSafe(
        voiceStatus,
        "Ready"
    );


    setTextSafe(
        responseStatus,
        "Stopped"
    );


    setTextSafe(
        liveText,
        "Microphone stopped. Click to start again."
    );


    warningMessage =
        "No warnings";


    updateVoiceStatusCard();


    addAlert(
        "Continuous listening stopped.",
        "info"
    );

}


async function listenVoice() {

    if (!isTeacherLoggedIn()) {
        setVoiceAccess(false);
        window.location.href = "login.html";
        return;
    }

    if (
        !window.SpeechRecognition &&
        !window.webkitSpeechRecognition
    ) {

        addAlert(
            "Speech recognition is not supported in this browser.",
            "error"
        );


        return;

    }


    if (continuousListeningActive) {

        stopContinuousMode();

        return;

    }


    showLoading(false);

    await startContinuousMode();

}


/* ==========================================================
   SIDEBAR
========================================================== */

function openSidebar() {

    sidebar?.classList.add(
        "active"
    );


    sidebarOverlay?.classList.add(
        "active"
    );

}


function closeSidebar() {

    sidebar?.classList.remove(
        "active"
    );


    sidebarOverlay?.classList.remove(
        "active"
    );

}


/* ==========================================================
   LOGOUT
========================================================== */

function logoutTeacher() {

    stopContinuousMode();
    setVoiceAccess(false);

    localStorage.removeItem(
        "teacher"
    );


    localStorage.removeItem(
        "selectedSubjectId"
    );


    window.location.href =
        "login.html";

}


/* ==========================================================
   INITIALIZE DASHBOARD
========================================================== */

async function initializeDashboard() {

    /*
     * Check teacher session.
     */

    loadTeacherInformation();

    if (!isTeacherLoggedIn()) {
        setVoiceAccess(false);
        return;
    }

    setVoiceAccess(true);


    /*
     * Load selected subject.
     */

    const subject = await loadSelectedSubject();

    if (!subject) {
        window.location.href = "teacher-dashboard.html";
        return;
    }


    /*
     * Basic voice state.
     */

    setBackendStatus(
        "Starting dashboard...",
        "warning"
    );


    setTextSafe(
        voiceStatus,
        "Ready"
    );


    setTextSafe(
        responseStatus,
        "Waiting"
    );


    setTextSafe(
        liveText,
        "Waiting for voice input..."
    );


    setTextSafe(
        rollNo,
        "--"
    );


    setTextSafe(
        subjectName,
        currentSubject?.subject_name ||
        "--"
    );


    setTextSafe(
        marksValue,
        "--"
    );


    setTextSafe(
        totalEntries,
        totalCount
    );


    setTextSafe(
        averageMarks,
        "0"
    );


    setTextSafe(
        totalStudents,
        "0"
    );


    warningMessage =
        "No warnings";


    lastUpdatedMarksText =
        "--";


    excelState.lockedColumn =
        null;


    updateVoiceStatusCard();


    // Render the dashboard as soon as the subject is known; secondary data can load behind it.
    refreshDatabaseDashboard(false).catch(error => {
        console.error("Dashboard data loading error:", error);
    });
    getHealthStatus().catch(error => {
        console.error("Backend health loading error:", error);
    });
    loadSheets().catch(error => {
        console.error("Sheet records loading error:", error);
    });

    if (localStorage.getItem(microphonePersistenceKey) === "true") {
        startContinuousMode().catch(error => {
            console.error("Microphone restore error:", error);
        });
    }


    if (ENABLE_AUTO_REFRESH) {

        autoRefreshTimer =
            setInterval(
                refreshDatabaseDashboard,
                AUTO_REFRESH_MS
            );

    }


    if (ENABLE_HEALTH_POLLING) {

        healthCheckTimer =
            setInterval(
                getHealthStatus,
                HEALTH_CHECK_MS
            );

    }


    addAlert(
        "Dashboard initialized successfully.",
        "success"
    );

}


/* ==========================================================
   EVENT LISTENERS
========================================================== */

sidebarToggle?.addEventListener(
    "click",
    () => {

        if (
            sidebar?.classList.contains(
                "active"
            )
        ) {

            closeSidebar();

        } else {

            openSidebar();

        }

    }
);


sidebarOverlay?.addEventListener(
    "click",
    closeSidebar
);


sidebarLinks.forEach(
    link => {

        link.addEventListener(
            "click",
            closeSidebar
        );

    }
);


micBtn?.addEventListener(
    "click",
    () => {
        listenVoice();

    }
);


refreshBtn?.addEventListener(
    "click",
    () => {

        refreshDatabaseDashboard();

    }
);

saveDraftBtn?.addEventListener("click", () => saveCurrentSheet("draft").catch(error => showToast(error.message, "error")));
saveSheetBtn?.addEventListener("click", () => saveCurrentSheet("saved").catch(error => showToast(error.message, "error")));

[savedSheetsList, draftSheetsList, deleteSheetsList].forEach(list => {
    list?.addEventListener("click", event => {
        const downloadButton = event.target.closest(".sheet-download-btn");
        const deleteButton = event.target.closest(".sheet-delete-btn");
        const openButton = event.target.closest(".sheet-open-btn");
        if (downloadButton) {
            window.location.href = `${API_URL}/sheets/${currentTeacher.id}/${downloadButton.dataset.sheetId}/download`;
            return;
        }
        const action = deleteButton ? deleteSavedSheet(deleteButton.dataset.sheetId) : openButton ? openSheet(openButton.dataset.sheetId) : null;
        action?.catch(error => showToast(error.message, "error"));
    });
});

function activateSheetView(view) {
    const viewMap = {
        saved: "savedSheetView",
        drafts: "draftSheetView",
        manage: "manageSheetView"
    };
    sheetTabs.forEach(tab => {
        const isActive = tab.dataset.sheetView === view;
        tab.classList.toggle("active", isActive);
        tab.setAttribute("aria-selected", String(isActive));
    });
    Object.values(viewMap).forEach(id => {
        document.getElementById(id)?.classList.toggle("active", id === viewMap[view]);
    });
}

sheetTabs.forEach(tab => {
    tab.addEventListener("click", () => activateSheetView(tab.dataset.sheetView));
});

document.querySelectorAll('.menu a[href="#savedSheets"]').forEach(link => {
    link.addEventListener("click", () => activateSheetView("saved"));
});
document.querySelectorAll('.menu a[href="#draftSheets"]').forEach(link => {
    link.addEventListener("click", () => activateSheetView("drafts"));
});
document.querySelectorAll('.menu a[href="#deleteSheets"]').forEach(link => {
    link.addEventListener("click", () => activateSheetView("manage"));
});


excelFileInput?.addEventListener(
    "change",
    handleExcelUpload
);


/* ==========================================================
   MANUAL TABLE EDIT VALIDATION
   Same rules are applied when marks are typed
   directly inside the table.
========================================================== */

studentTable?.addEventListener(
    "focusin",
    event => {

        const cell =
            event.target?.closest?.(
                "td.mark-cell[data-field]"
            );

        if (cell) {
            cell.dataset.previousValue =
                cell.textContent.trim();
        }

    }
);


studentTable?.addEventListener(
    "focusout",
    event => {

        const cell =
            event.target?.closest?.(
                "td.mark-cell[data-field]"
            );

        if (!cell) {
            return;
        }


        const enteredValue =
            cell.textContent.trim();


        const previousValue =
            cell.dataset.previousValue ?? "0";


        if (enteredValue === previousValue) {
            return;
        }


        const result =
            validateMarksValue(
                cell.dataset.field,
                enteredValue
            );


        if (!result.valid) {

            cell.textContent = previousValue;

            recalculateRowTotal(cell.closest("tr"));

            warningMessage = result.message;

            setTextSafe(
                responseStatus,
                result.message
            );

            updateVoiceStatusCard();

            addAlert(
                result.message,
                "error"
            );

            showToast(
                result.message,
                "error"
            );

            playBeep(
                3,
                260
            );

            return;

        }


        cell.textContent = String(result.value);

        cell.dataset.previousValue = cell.textContent;

        recalculateRowTotal(cell.closest("tr"));

        lastUpdatedMarksText = String(result.value);

        warningMessage = "No warnings";

        setTextSafe(
            responseStatus,
            MARKS_SUCCESS_MESSAGE
        );

        updateVoiceStatusCard();

        showToast(
            MARKS_SUCCESS_MESSAGE,
            "success"
        );

    }
);



studentTableHeadRow?.addEventListener(
    "click",
    event => {
        const headerCell = event.target.closest(
            "th.lockable-column"
        );

        if (!headerCell) {
            return;
        }

        toggleLockedColumn(
            headerCell.dataset.columnName
        );
    }
);


columnSelectionPanel?.addEventListener(
    "click",
    handleColumnLockSelection
);


/*
 * Logout button
 */

document
    .getElementById("logoutBtn")
    ?.addEventListener(
        "click",
        logoutTeacher
    );


/* ==========================================================
   START APPLICATION
========================================================== */

window.addEventListener(
    "DOMContentLoaded",
    initializeDashboard
);


downloadExcelBtn?.addEventListener(
    "click",
    downloadFinalExcel
);


