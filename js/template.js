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

const eventId = urlParams.get('event')
const guestId = urlParams.get('guest')

function renderCard(utype, utempl, uname, utext){
    const clist = Object.values(cardDATA[utype]["img"])
    const getInnerTitle = cardDATA[utype]["title"]
    name_ele.innerHTML = uname
    innerTitle.innerText = getInnerTitle
    text_ele.innerHTML = utext
    type_ele.innerHTML = `<img style="width:100%" src="${clist[utempl]}" alt="${getInnerTitle}">`

    // Hover only works with a mouse — tap-to-flip so phones (how guests will
    // actually open this link) can open the card and reach the RSVP form.
    document.querySelector(".page").addEventListener("click", function(){
        this.classList.toggle("flipped")
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

    const parts = []
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
        parts.push(`<iframe style="width:100%;height:180px;border:0;margin-top:8px" loading="lazy" src="https://www.google.com/maps?q=${encodeURIComponent(location)}&output=embed"></iframe>`)
    }

    eventinfo_ele.innerHTML = parts.join("")
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
        rsvp_ele.innerHTML = `<p>Bạn đã phản hồi: ${guest.status === "yes" ? "Sẽ tham dự" : "Không tham dự được"}. Cảm ơn bạn!</p>`
        return
    }

    rsvp_ele.innerHTML = `
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

    let displayName = event.host_name

    if (guestId) {
        const { data: guest, error: guestError } = await supabaseClient.rpc("get_guest", { p_guest_id: guestId }).single()
        if (!guestError && guest) {
            renderCard(event.card_type, event.template_no, event.host_name, event.message)
            renderRsvpForGuest(guest)
        } else {
            renderCard(event.card_type, event.template_no, event.host_name, event.message)
        }
    } else {
        renderCard(event.card_type, event.template_no, event.host_name, event.message)
        renderRsvpGeneric()
    }

    renderEventInfo(cardDATA[event.card_type]["title"], event.event_date, event.event_time, event.event_location)
    renderMusic(event.music_url)
}

init()
