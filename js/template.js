const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const cardDATA = JSON.parse(cardPicPaths);
const innerTitle = document.getElementById("chead")
const name_ele = document.getElementById("uname")
const text_ele = document.getElementById("utext")
const type_ele = document.getElementById("utype")
const rsvp_ele = document.getElementById("rsvp")
const eventinfo_ele = document.getElementById("eventinfo")
const music_ele = document.getElementById("music")
const countdown_ele = document.getElementById("countdown")
const wishes_ele = document.getElementById("wishes")

const eventId = urlParams.get('event')
const guestId = urlParams.get('guest')

const TYPE_ICONS = { graduation: "🎓", birthday: "🎂", anniversary: "💐", thankyou: "🙏" }

function renderCard(utype, utempl, uname, utext, photoUrl){
    const clist = Object.values(cardDATA[utype]["img"])
    const getInnerTitle = cardDATA[utype]["title"]
    name_ele.innerHTML = uname
    innerTitle.innerText = getInnerTitle
    text_ele.innerHTML = utext
    type_ele.innerHTML = `<img style="width:100%" src="${clist[utempl]}" alt="${getInnerTitle}">`

    const icon = TYPE_ICONS[utype] || "🎉"
    document.getElementById("typeicon").textContent = icon
    document.querySelector(".page__1").setAttribute("data-flipicon", icon)

    const photoBadge = document.getElementById("photobadge")
    if (photoUrl) {
        photoBadge.innerHTML = `<img src="${photoUrl}" alt="${uname}">`
        photoBadge.style.display = "flex"
    }

    // Hover only works with a mouse — tap-to-flip so phones (how guests will
    // actually open this link) can open the card and reach the RSVP form.
    document.querySelector(".page").addEventListener("click", function(){
        const nowOpen = this.classList.toggle("flipped")
        if (nowOpen) {
            // Everything below the card (RSVP, guestbook...) is easy to miss —
            // nudge the guest to scroll once the flip animation settles.
            setTimeout(() => document.getElementById("scroll-hint").classList.add("visible"), 900)
        } else {
            document.getElementById("scroll-hint").classList.remove("visible")
        }
    })

    window.addEventListener("scroll", function onScroll(){
        if (window.scrollY > 40) {
            document.getElementById("scroll-hint").classList.remove("visible")
            window.removeEventListener("scroll", onScroll)
        }
    })
}

function googleCalendarLink(title, dateStr, timeStr, location, details){
    if (!dateStr) return null
    const compactDate = dateStr.replaceAll("-", "")
    let dates
    if (timeStr) {
        const compactTime = timeStr.replaceAll(":", "") + "00"
        const [h, m] = timeStr.split(":").map(Number)
        const endH = String((h + 2) % 24).padStart(2, "0")
        dates = `${compactDate}T${compactTime}/${compactDate}T${endH}${String(m).padStart(2,"0")}00`
    } else {
        dates = `${compactDate}/${compactDate}`
    }
    const params = new URLSearchParams({ action: "TEMPLATE", text: title, dates, location: location || "", details: details || "" })
    return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function renderEventInfo(title, dateStr, timeStr, location){
    if (!eventinfo_ele || (!dateStr && !location)) return

    const parts = [`<h3>Thông tin sự kiện</h3>`]
    if (dateStr) {
        const d = new Date(dateStr + "T00:00:00")
        const dateLabel = d.toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
        parts.push(`<p>📅 ${dateLabel}${timeStr ? " — " + timeStr : ""}</p>`)
    }
    if (location) {
        parts.push(`<p>📍 ${location}</p>`)
    }

    const calLink = googleCalendarLink(title, dateStr, timeStr, location, "")
    if (calLink) {
        parts.push(`<a href="${calLink}" target="_blank" rel="noopener">➕ Thêm vào Google Calendar</a>`)
    }
    if (location) {
        parts.push(`<iframe style="width:100%;height:180px;border:0;margin-top:8px;border-radius:12px" loading="lazy" src="https://www.google.com/maps?q=${encodeURIComponent(location)}&output=embed"></iframe>`)
    }

    eventinfo_ele.innerHTML = parts.join("")
}

function renderCountdown(dateStr, timeStr){
    if (!countdown_ele || !dateStr) return

    const target = new Date(`${dateStr}T${timeStr || "00:00"}:00`)
    if (isNaN(target.getTime())) return

    countdown_ele.innerHTML = `
        <h3>Đếm ngược</h3>
        <div class="countdown-grid">
            <div><span id="cd-days">0</span><small>Ngày</small></div>
            <div><span id="cd-hours">0</span><small>Giờ</small></div>
            <div><span id="cd-mins">0</span><small>Phút</small></div>
            <div><span id="cd-secs">0</span><small>Giây</small></div>
        </div>
    `

    function tick(){
        const diff = target.getTime() - Date.now()
        if (diff <= 0) {
            countdown_ele.querySelector(".countdown-grid").innerHTML = "<p>🎉 Đã đến giờ!</p>"
            clearInterval(timer)
            return
        }
        const days = Math.floor(diff / 86400000)
        const hours = Math.floor((diff % 86400000) / 3600000)
        const mins = Math.floor((diff % 3600000) / 60000)
        const secs = Math.floor((diff % 60000) / 1000)
        document.getElementById("cd-days").textContent = days
        document.getElementById("cd-hours").textContent = hours
        document.getElementById("cd-mins").textContent = mins
        document.getElementById("cd-secs").textContent = secs
    }

    tick()
    const timer = setInterval(tick, 1000)
}

function renderMusic(musicUrl){
    if (!music_ele || !musicUrl) return
    music_ele.innerHTML = `
        <audio id="bg-audio" src="${musicUrl}" loop></audio>
        <button id="music-toggle">🔊 Nhạc nền</button>
    `
    const audio = document.getElementById("bg-audio")
    const btn = document.getElementById("music-toggle")
    btn.addEventListener("click", () => {
        if (audio.paused) {
            audio.play()
            btn.textContent = "🔇 Tắt nhạc"
        } else {
            audio.pause()
            btn.textContent = "🔊 Nhạc nền"
        }
    })
}

function renderRsvpForGuest(guest){
    if (!rsvp_ele) return

    if (guest.status !== "pending") {
        rsvp_ele.innerHTML = `<h3>Xác nhận tham dự</h3><p>Bạn đã phản hồi: ${guest.status === "yes" ? "Sẽ tham dự" : "Không tham dự được"}. Cảm ơn bạn!</p>`
        return
    }

    rsvp_ele.innerHTML = `
        <h3>Xác nhận tham dự</h3>
        <p>Xin chào ${guest.guest_name}, bạn có tham dự không?</p>
        <button id="rsvp-yes">Sẽ tham dự</button>
        <button id="rsvp-no">Không tham dự được</button>
        <p id="rsvp-msg"></p>
    `

    async function submitRsvp(status){
        const { error } = await supabaseClient.rpc("submit_guest_rsvp", { p_guest_id: guestId, p_status: status })
        const msg = document.getElementById("rsvp-msg")
        msg.innerText = error ? "Có lỗi, thử lại sau." : "Đã gửi phản hồi, cảm ơn bạn!"
    }

    document.getElementById("rsvp-yes").addEventListener("click", () => submitRsvp("yes"))
    document.getElementById("rsvp-no").addEventListener("click", () => submitRsvp("no"))
}

function renderRsvpGeneric(){
    if (!rsvp_ele || !eventId) return

    rsvp_ele.innerHTML = `
        <h3>Xác nhận tham dự</h3>
        <input id="rsvp-name" placeholder="Tên của bạn" type="text">
        <button id="rsvp-yes">Sẽ tham dự</button>
        <button id="rsvp-no">Không tham dự được</button>
        <p id="rsvp-msg"></p>
    `

    async function submitRsvp(status){
        const guestName = document.getElementById("rsvp-name").value
        const msg = document.getElementById("rsvp-msg")
        if (!guestName) {
            msg.innerText = "Vui lòng nhập tên trước."
            return
        }
        const { error } = await supabaseClient
            .from("rsvps")
            .insert({ event_id: eventId, guest_name: guestName, status, responded_at: new Date().toISOString() })

        msg.innerText = error ? "Có lỗi, thử lại sau." : "Đã gửi phản hồi, cảm ơn bạn!"
    }

    document.getElementById("rsvp-yes").addEventListener("click", () => submitRsvp("yes"))
    document.getElementById("rsvp-no").addEventListener("click", () => submitRsvp("no"))
}

function escapeHtml(s){
    return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
}

async function loadWishesList(){
    const { data: wishes } = await supabaseClient.rpc("get_wishes", { p_event_id: eventId })
    const list = document.getElementById("wishes-list")
    if (!list) return
    if (!wishes || wishes.length === 0) {
        list.innerHTML = `<p>Hãy là người đầu tiên gửi lời chúc 💌</p>`
        return
    }
    list.innerHTML = wishes.map(w => `
        <div class="wish-item">
            <strong>${escapeHtml(w.guest_name)}</strong>
            <p>${escapeHtml(w.message)}</p>
        </div>
    `).join("")
}

function renderWishes(){
    if (!wishes_ele || !eventId) return

    wishes_ele.innerHTML = `
        <h3>Sổ lưu bút</h3>
        <div id="wishes-list"></div>
        <input id="wish-name" placeholder="Tên của bạn" type="text">
        <textarea id="wish-message" rows="2" placeholder="Gửi lời chúc..."></textarea>
        <button id="wish-submit">Gửi lời chúc</button>
        <p id="wish-msg"></p>
    `

    loadWishesList()

    document.getElementById("wish-submit").addEventListener("click", async () => {
        const guestName = document.getElementById("wish-name").value.trim()
        const message = document.getElementById("wish-message").value.trim()
        const msg = document.getElementById("wish-msg")
        if (!guestName || !message) {
            msg.innerText = "Vui lòng nhập tên và lời chúc."
            return
        }
        const { error } = await supabaseClient.from("wishes").insert({ event_id: eventId, guest_name: guestName, message })
        if (error) {
            msg.innerText = "Có lỗi, thử lại sau."
            return
        }
        document.getElementById("wish-message").value = ""
        msg.innerText = "Đã gửi lời chúc, cảm ơn bạn!"
        loadWishesList()
    })
}

async function init(){
    if (!supabaseClient) {
        // Fallback: old base64-in-URL flow (no backend configured)
        const uname = decodeURI(window.atob(urlParams.get('name')))
        const utext = decodeURI(window.atob(urlParams.get('text')))
        const utype = urlParams.get('card')
        const utempl = urlParams.get('templ')
        renderCard(utype, utempl, uname, utext)
        return
    }

    if (!eventId) {
        innerTitle.innerText = "Không tìm thấy thiệp này."
        return
    }

    const { data: event, error } = await supabaseClient.rpc("get_event", { p_event_id: eventId }).single()

    if (error || !event) {
        innerTitle.innerText = "Không tìm thấy thiệp này."
        return
    }

    renderCard(event.card_type, event.template_no, event.host_name, event.message, event.photo_url)

    if (guestId) {
        const { data: guest, error: guestError } = await supabaseClient.rpc("get_guest", { p_guest_id: guestId }).single()
        if (!guestError && guest) {
            renderRsvpForGuest(guest)
        }
    } else {
        renderRsvpGeneric()
    }

    renderEventInfo(cardDATA[event.card_type]["title"], event.event_date, event.event_time, event.event_location)
    renderCountdown(event.event_date, event.event_time)
    renderMusic(event.music_url)
    renderWishes()
}

init()
