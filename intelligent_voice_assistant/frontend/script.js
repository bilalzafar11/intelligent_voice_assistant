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


/* ==========================================================
   SESSION DATA
========================================================== */

const teacherData =
    localStorage.getItem("teacher");

const selectedSubjectId =
    localStorage.getItem("selectedSubjectId");

let currentTeacher = null;
let currentSubject = null;


/* ==========================================================
   STATE
========================================================== */

let totalCount = 0;
let toastTimeout = null;

let autoRefreshTimer = null;
let healthCheckTimer = null;

let recognition = null;

let continuousListeningActive = false;

let lastUpdatedMarksText = "--";
let warningMessage = "No warnings";

let stopCommandHandled = false;


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

        /*
         * Our existing API:
         * GET /students/{subject_id}
         *
         * It returns subject information + students.
         */

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


    try {

        const response =
            await fetch(
                `${API_URL}/health`,
                {
                    cache: "no-store"
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

    }

}


/* ==========================================================
   DATABASE STUDENTS
========================================================== */

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

        "Roll No",
        "Student Name",
        "Assignment",
        "Midterm",
        "Final"

    ];


    studentTableHeadRow.innerHTML =
        headers
            .map(
                header =>
                    `<th>${header}</th>`
            )
            .join("");


    /* ==================================================
       NO STUDENTS
    ================================================== */

    if (!Array.isArray(students) || students.length === 0) {

        studentTable.innerHTML = `
            <tr>
                <td
                    colspan="5"
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
                            <strong>
                                ${rollNo}
                            </strong>
                        </td>

                        <td>
                            ${studentName}
                        </td>

                        <td class="mark-cell">
                            --
                        </td>

                        <td class="mark-cell">
                            --
                        </td>

                        <td class="mark-cell">
                            --
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


/* ==========================================================
   MAIN DATABASE DASHBOARD REFRESH
========================================================== */

async function refreshDatabaseDashboard() {

    try {

        showLoading(true);


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

        showLoading(false);

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

    if (
        !row ||
        typeof row !== "object"
    ) {

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


    if (
        matchingKey !== undefined
    ) {

        return row[matchingKey];

    }


    return "";

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
            columnName ===
            excelState.lockedColumn;


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
            headerCell.textContent.trim();


        headerCell.classList.toggle(
            "locked-column",
            Boolean(excelState.lockedColumn) &&
            columnName ===
            excelState.lockedColumn
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
                matchedHeader ===
                excelState.lockedColumn
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
                String(header)
                    .trim()
                    .toLowerCase() ===
                safeColumnName.toLowerCase()
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


    if (!safeColumnName) {
        return;
    }


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
            safeColumnName;


        syncLockedColumn(
            selectedColumn,
            {
                showMessage: true
            }
        );


        showToast(
            data?.message ||
            `Column '${selectedColumn}' Locked`,
            response.ok
                ? "success"
                : "error"
        );


    } catch (error) {

        console.error(error);


        syncLockedColumn(
            safeColumnName,
            {
                showMessage: true
            }
        );


        showToast(
            `Column '${safeColumnName}' Locked locally.`,
            "warning"
        );

    }

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


    await persistLockedColumnToBackend(
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
        "en-US";


    instance.continuous =
        true;


    instance.interimResults =
        false;


    instance.maxAlternatives =
        3;


    return instance;

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


    return /^(?:please\s+)?(?:stop|exit)$/
        .test(commandText);

}


async function processVoiceText(text) {

    const listeningSessionActive =
        continuousListeningActive;


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
            data.selected_column ||
            data.column
        ) {

            syncLockedColumn(
                data.selected_column ||
                data.column,
                {
                    showMessage: true
                }
            );

        }


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
            shouldStopListening(
                text
            );


        if (
            listeningSessionActive &&
            shouldRefreshAfterCommand &&
            !stopCommandHandled
        ) {

            stopCommandHandled = true;

            stopContinuousMode();


            /*
             * Refresh database students
             * after voice command.
             */

            await refreshDatabaseDashboard();


            showToast(
                "Dashboard refreshed.",
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
            false;


        updateVoiceStatusCard();

    }

}


/* ==========================================================
   CONTINUOUS VOICE MODE
========================================================== */

async function startContinuousMode() {

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


        stopListeningAnimation();


        addAlert(
            "Speech recognition is not supported in this browser.",
            "error"
        );


        return;

    }


    recognition.onresult =
        event => {

            const finalTranscripts =
                [];


            for (
                let index = event.resultIndex;
                index < event.results.length;
                index += 1
            ) {

                const result =
                    event.results[index];


                if (
                    result.isFinal &&
                    result[0].transcript.trim()
                ) {

                    finalTranscripts.push(
                        result[0].transcript.trim()
                    );

                }

            }


            finalTranscripts.forEach(
                text =>
                    processVoiceText(text)
            );

        };


    recognition.onerror =
        event => {

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

        };


    recognition.onend =
        () => {

            if (
                continuousListeningActive
            ) {

                try {

                    recognition.start();

                } catch (error) {

                    // Already active.

                }

            }

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


    /*
     * Load students from DATABASE.
     */

    await refreshDatabaseDashboard();


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

        if (
            continuousListeningActive
        ) {

            stopContinuousMode();

            return;

        }


        listenVoice();

    }
);


refreshBtn?.addEventListener(
    "click",
    () => {

        refreshDatabaseDashboard();

    }
);


excelFileInput?.addEventListener(
    "change",
    handleExcelUpload
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