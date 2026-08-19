const urlParams = new URLSearchParams(window.location.search)
const eventId = urlParams.get("event")
const ownerToken = urlParams.get("token")

const STATUS_LABEL = { pending: "Chưa phản hồi", yes: "Sẽ tham dự", no: "Không tham dự" }

function escapeHtml(s){
    return (s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
}

function renderError(msg){
    document.getElementById("dash-body").innerHTML = `<p>${escapeHtml(msg)}</p>`
}

function renderRespondentsTable(rows, hasRelationship){
    if (rows.length === 0) return `<p class="form-text-hint">Chưa có ai phản hồi.</p>`

    const header = hasRelationship
        ? `<tr><th>Tên</th><th>Mối quan hệ</th><th>Trạng thái</th><th>Đi ăn sau đó?</th></tr>`
        : `<tr><th>Tên</th><th>Trạng thái</th><th>Đi ăn sau đó?</th></tr>`

    const body = rows.map(r => {
        const status = STATUS_LABEL[r.status] || r.status
        const afterparty = r.join_afterparty ? "✅ Có" : "—"
        return hasRelationship
            ? `<tr><td>${escapeHtml(r.guest_name)}</td><td>${escapeHtml(r.relationship || "")}</td><td>${status}</td><td>${afterparty}</td></tr>`
            : `<tr><td>${escapeHtml(r.guest_name)}</td><td>${status}</td><td>${afterparty}</td></tr>`
    }).join("")

    return `<table class="table table-sm"><thead>${header}</thead><tbody>${body}</tbody></table>`
}

function renderSummary(rows){
    const counts = { yes: 0, no: 0, pending: 0 }
    rows.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1 })
    return `
        <div class="d-flex gap-3 flex-wrap mb-3">
            <div class="afterparty-box"><strong>${counts.yes}</strong> sẽ tham dự</div>
            <div class="afterparty-box"><strong>${counts.no}</strong> không tham dự</div>
            <div class="afterparty-box"><strong>${counts.pending}</strong> chưa phản hồi</div>
        </div>
    `
}

async function init(){
    if (!supabaseClient) {
        renderError("Trang này cần kết nối Supabase.")
        return
    }
    if (!eventId || !ownerToken) {
        renderError("Thiếu thông tin, kiểm tra lại link quản lý.")
        return
    }

    const { data, error } = await supabaseClient.rpc("get_dashboard", { p_event_id: eventId, p_owner_token: ownerToken })

    if (error || !data || !data.event) {
        renderError("Không tìm thấy thiệp này, hoặc link quản lý không đúng.")
        return
    }

    document.getElementById("dash-title").textContent = `Thiệp của ${data.event.host_name}`
    document.getElementById("dash-subtitle").textContent = data.event.message || ""

    const usingGuestList = data.guests.length > 0
    const rows = usingGuestList ? data.guests : data.rsvps

    let html = `<div class="section-title"><span class="step-num">1</span> Xác nhận tham dự</div>`
    html += renderSummary(rows)
    html += renderRespondentsTable(rows, usingGuestList)

    html += `<div class="section-title mt-4"><span class="step-num">2</span> Sổ lưu bút</div>`
    if (data.wishes.length === 0) {
        html += `<p class="form-text-hint">Chưa có lời chúc nào.</p>`
    } else {
        html += data.wishes.map(w => `
            <div class="wish-item" style="text-align:left;border-bottom:1px solid #f0e6fa;padding:0.6rem 0">
                <strong style="color:#8100eb">${escapeHtml(w.guest_name)}</strong>
                <p style="margin:0.2rem 0 0">${escapeHtml(w.message)}</p>
            </div>
        `).join("")
    }

    document.getElementById("dash-body").innerHTML = html
}

init()
