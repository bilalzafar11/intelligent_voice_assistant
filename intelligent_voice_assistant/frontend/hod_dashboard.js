const API_BASE = "http://127.0.0.1:8000";

const dashboardTableBody =
    document.getElementById("dashboardTableBody");

const emptyState =
    document.getElementById("emptyState");

const totalTeachers =
    document.getElementById("totalTeachers");

const totalSubjects =
    document.getElementById("totalSubjects");

const completedSheets =
    document.getElementById("completedSheets");

const pendingSheets =
    document.getElementById("pendingSheets");

const hodName =
    document.getElementById("hodName");

const hodAvatar =
    document.getElementById("hodAvatar");

const refreshBtn =
    document.getElementById("refreshBtn");

const refreshNavBtn =
    document.getElementById("refreshNavBtn");

const logoutBtn =
    document.getElementById("logoutBtn");

// ============================================================
// LOAD HOD INFORMATION
// ============================================================

function loadHODInfo() {

    const storedHOD =
        localStorage.getItem("hod");

    if (!storedHOD) {
        return;
    }

    try {

        const hod = JSON.parse(storedHOD);

        const name =
            hod.name ||
            hod.hod_id ||
            "HOD";

        hodName.textContent = name;

        hodAvatar.textContent =
            name.charAt(0).toUpperCase();

    } catch (error) {

        console.error(
            "Unable to read HOD information:",
            error
        );

    }

}

// ============================================================
// FORMAT DATE
// ============================================================

function formatDate(dateValue) {

    if (!dateValue) {
        return "—";
    }

    const date =
        new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleString(
        "en-GB",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}

// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}

// ============================================================
// LOADING STATE
// ============================================================

function showLoading() {

    emptyState.style.display = "none";

    dashboardTableBody.innerHTML = `
        <tr class="loading-row">
            <td colspan="6">
                <div class="loading">
                    <div class="spinner"></div>
                    Loading dashboard data...
                </div>
            </td>
        </tr>
    `;

}

// ============================================================
// ERROR STATE
// ============================================================

function showError(message) {

    dashboardTableBody.innerHTML = `
        <tr>
            <td colspan="6">
                <div style="
                    padding: 45px 20px;
                    text-align: center;
                    color: #dc2626;
                    font-size: 13px;
                ">
                    <strong>
                        Unable to load dashboard
                    </strong>

                    <div style="
                        margin-top: 7px;
                        color: #64748b;
                        font-size: 11px;
                    ">
                        ${escapeHTML(message)}
                    </div>
                </div>
            </td>
        </tr>
    `;

    emptyState.style.display = "none";

}

// ============================================================
// RENDER DASHBOARD
// ============================================================

function renderDashboard(rows) {

    dashboardTableBody.innerHTML = "";

    if (!rows || rows.length === 0) {

        emptyState.style.display = "block";

        totalTeachers.textContent = "0";
        totalSubjects.textContent = "0";
        completedSheets.textContent = "0";
        pendingSheets.textContent = "0";

        return;
    }

    emptyState.style.display = "none";

    // --------------------------------------------------------
    // STATISTICS
    // --------------------------------------------------------

    const teacherIds =
        new Set(
            rows.map(row => row.teacher_id)
        );

    const completed =
        rows.filter(
            row => row.final_sheet_done === true
        ).length;

    const pending =
        rows.length - completed;

    totalTeachers.textContent =
        teacherIds.size;

    totalSubjects.textContent =
        rows.length;

    completedSheets.textContent =
        completed;

    pendingSheets.textContent =
        pending;

    // --------------------------------------------------------
    // TABLE ROWS
    // --------------------------------------------------------

    rows.forEach(row => {

        const teacherName =
            escapeHTML(
                row.teacher_name || "Unknown Teacher"
            );

        const teacherEmail =
            escapeHTML(
                row.teacher_email || ""
            );

        const subjectName =
            escapeHTML(
                row.subject_name || "Unknown Subject"
            );

        const semester =
            escapeHTML(
                row.semester ?? "—"
            );

        const year =
            escapeHTML(
                row.year || "—"
            );

        let statusHTML;

        if (row.final_sheet_done === true) {

            statusHTML = `
                <span class="status-badge done">
                    <span class="status-dot-small"></span>
                    Done
                </span>
            `;

        } else {

            statusHTML = `
                <span class="status-badge pending">
                    <span class="status-dot-small"></span>
                    Not Done
                </span>
            `;
        }

        const updated =
            formatDate(
                row.updated_at
            );

        const tr =
            document.createElement("tr");

        tr.innerHTML = `

            <td>

                <div class="teacher-name">
                    ${teacherName}
                </div>

                ${
                    teacherEmail
                    ? `
                    <span class="teacher-email">
                        ${teacherEmail}
                    </span>
                    `
                    : ""
                }

            </td>


            <td>

                <span class="subject-name">
                    ${subjectName}
                </span>

            </td>


            <td>
                <span class="muted-value">
                    ${semester}
                </span>
            </td>


            <td>
                <span class="muted-value">
                    ${year}
                </span>
            </td>


            <td>
                ${statusHTML}
            </td>


            <td>
                <span class="muted-value">
                    ${updated}
                </span>
            </td>

        `;

        dashboardTableBody.appendChild(tr);

    });

}

// ============================================================
// FETCH DASHBOARD DATA
// ============================================================

async function loadDashboard() {

    showLoading();

    refreshBtn.classList.add("loading");

    try {

        const response =
            await fetch(
                `${API_BASE}/hod/dashboard`
            );

        if (!response.ok) {

            throw new Error(
                `Server returned ${response.status}`
            );

        }

        const data =
            await response.json();

        if (!data.success) {

            throw new Error(
                data.message ||
                "Unable to load HOD dashboard."
            );

        }

        renderDashboard(
            data.rows || []
        );

    } catch (error) {

        console.error(
            "HOD dashboard error:",
            error
        );

        showError(
            error.message ||
            "Please check that the backend server is running."
        );

    } finally {

        refreshBtn.classList.remove("loading");

    }

}

// ============================================================
// LOGOUT
// ============================================================

function logout() {

    localStorage.removeItem("hod");

    window.location.href = "login.html";

}

// ============================================================
// EVENTS
// ============================================================

refreshBtn?.addEventListener(
    "click",
    loadDashboard
);

refreshNavBtn?.addEventListener(
    "click",
    loadDashboard
);

logoutBtn?.addEventListener(
    "click",
    logout
);

// ============================================================
// INITIALIZE
// ============================================================

loadHODInfo();

loadDashboard();

