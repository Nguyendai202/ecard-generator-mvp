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

// Set by renderMusic()/renderYoutubeMusic() once the music source is ready,
// as { play, pause }. Tapping the card is a real user gesture, so calling
// play() from inside that same click handler is what lets the browser allow
// autoplay with sound — a later, unrelated call (e.g. on a timer) would be
// blocked. Tied to the card's open/closed state (not "only the first tap")
// so re-opening the card after closing it resumes the music too.
let musicControls = null

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
            setTimeout(() => document.getElementById("scroll-hint").classList.add("visible"), 3000)

            musicControls?.play()
        } else {
            document.getElementById("scroll-hint").classList.remove("visible")
            musicControls?.pause()
        }
    })

    window.addEventListener("scroll", function onScroll(){
        if (window.scrollY > 40) {
            document.getElementById("scroll-hint").classList.remove("visible")
            window.removeEventListener("scroll", onScroll)
        }
    })
}

function googleCalendarLink(title, dateStr, timeStr, timeEndStr, location, details){
    if (!dateStr) return null
    const compactDate = dateStr.replaceAll("-", "")
    let dates
    if (timeStr) {
        const compactTime = timeStr.replaceAll(":", "") + "00"
        let endCompact
        if (timeEndStr) {
            endCompact = timeEndStr.replaceAll(":", "") + "00"
        } else {
            const [h, m] = timeStr.split(":").map(Number)
            const endH = String((h + 2) % 24).padStart(2, "0")
            endCompact = `${endH}${String(m).padStart(2,"0")}00`
        }
        dates = `${compactDate}T${compactTime}/${compactDate}T${endCompact}`
    } else {
        dates = `${compactDate}/${compactDate}`
    }
    const params = new URLSearchParams({ action: "TEMPLATE", text: title, dates, location: location || "", details: details || "" })
    return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function renderEventInfo(title, dateStr, timeStr, timeEndStr, location, notes){
    if (!eventinfo_ele || (!dateStr && !location)) return

    const parts = [`<h3>Thông tin sự kiện</h3>`]
    if (dateStr) {
        const d = new Date(dateStr + "T00:00:00")
        const dateLabel = d.toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
        const timeLabel = timeStr ? (timeEndStr ? `${timeStr} - ${timeEndStr}` : timeStr) : ""
        parts.push(`<p>📅 ${dateLabel}${timeLabel ? " — " + timeLabel : ""}</p>`)
    }
    if (location) {
        parts.push(`<p>📍 ${location}</p>`)
    }
    if (notes) {
        parts.push(`<p>ℹ️ ${escapeHtml(notes)}</p>`)
    }

    const calLink = googleCalendarLink(title, dateStr, timeStr, timeEndStr, location, "")
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
    music_ele.innerHTML = `<audio id="bg-audio" src="${musicUrl}" loop></audio>`
    const audio = document.getElementById("bg-audio")

    musicControls = {
        play: () => audio.play().catch(() => {}),
        pause: () => audio.pause()
    }
}

function renderYoutubeMusic(youtubeId, startSec, endSec){
    if (!music_ele || !youtubeId) return

    music_ele.innerHTML = `<div id="yt-audio-player" style="width:0;height:0;overflow:hidden"></div>`
    const start = startSec || 0
    const end = endSec || null
    let player = null
    let playing = false
    let autoplayPending = false

    function checkLoop(){
        if (player && end && player.getCurrentTime() >= end) {
            player.seekTo(start, true)
        }
        if (playing) setTimeout(checkLoop, 1000)
    }

    function startPlaying(){
        if (!player) { autoplayPending = true; return }
        player.playVideo()
    }

    function stopPlaying(){
        autoplayPending = false
        if (player) player.pauseVideo()
    }

    musicControls = { play: startPlaying, pause: stopPlaying }

    function init(){
        if (typeof YT === "undefined" || !YT.Player) {
            setTimeout(init, 300)
            return
        }
        player = new YT.Player("yt-audio-player", {
            videoId: youtubeId,
            playerVars: { start, end: end || undefined, controls: 0 },
            events: {
                onReady: () => {
                    if (autoplayPending) player.playVideo()
                },
                onStateChange: (e) => {
                    if (e.data === YT.PlayerState.PLAYING) {
                        playing = true
                        checkLoop()
                    } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
                        playing = false
                    }
                }
            }
        })
    }
    init()
}

function greetingFor(name, relationship){
    const r = (relationship || "").toLowerCase()
    // Match whole words only (not substrings) — e.g. "ba" must not match inside "ban".
    const words = r.split(/[^a-zàáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]+/)
    const formal = new Set(["thầy", "cô", "giáo", "chú", "bác", "ông", "bà", "sếp"])
    const family = new Set(["bố", "mẹ", "ba", "má", "anh", "chị", "em"])
    const romanticPhrases = ["người yêu", "bạn trai", "bạn gái", "vợ", "chồng"]

    if (words.some(w => formal.has(w))) return `Kính mời ${name}`
    if (romanticPhrases.some(p => r.includes(p))) return `Gửi ${name} yêu thương`
    if (words.some(w => family.has(w)) || r.includes("gia đình")) return `Thân mời ${name}`
    return `Xin chào ${name}`
}

function afterpartyFieldHtml(afterpartyNote){
    if (!afterpartyNote) return ""
    return `
        <div class="afterparty-check">
            <input type="checkbox" id="rsvp-afterparty">
            <label for="rsvp-afterparty">🍜 ${escapeHtml(afterpartyNote)} — mình cũng muốn tham gia</label>
        </div>
    `
}

function renderRsvpForGuest(guest, afterpartyNote){
    if (!rsvp_ele) return

    if (guest.status !== "pending") {
        const afterpartyLine = guest.join_afterparty ? `<p>🍜 Đã đăng ký tham gia phần đi ăn/tụ tập sau đó.</p>` : ""
        rsvp_ele.innerHTML = `<h3>Xác nhận tham dự</h3><p>Bạn đã phản hồi: ${guest.status === "yes" ? "Sẽ tham dự" : "Không tham dự được"}. Cảm ơn bạn!</p>${afterpartyLine}`
        return
    }

    rsvp_ele.innerHTML = `
        <h3>Xác nhận tham dự</h3>
        <p>${greetingFor(escapeHtml(guest.guest_name), guest.relationship)}, bạn có tham dự không?</p>
        <button id="rsvp-yes">Sẽ tham dự</button>
        <button id="rsvp-no">Không tham dự được</button>
        ${afterpartyFieldHtml(afterpartyNote)}
        <p id="rsvp-msg"></p>
    `

    async function submitRsvp(status){
        const joinAfterparty = document.getElementById("rsvp-afterparty")?.checked || false
        const { error } = await supabaseClient.rpc("submit_guest_rsvp", { p_guest_id: guestId, p_status: status, p_join_afterparty: joinAfterparty })
        const msg = document.getElementById("rsvp-msg")
        msg.innerText = error ? "Có lỗi, thử lại sau." : "Đã gửi phản hồi, cảm ơn bạn!"
    }

    document.getElementById("rsvp-yes").addEventListener("click", () => submitRsvp("yes"))
    document.getElementById("rsvp-no").addEventListener("click", () => submitRsvp("no"))
}

function renderRsvpGeneric(afterpartyNote){
    if (!rsvp_ele || !eventId) return

    rsvp_ele.innerHTML = `
        <h3>Xác nhận tham dự</h3>
        <input id="rsvp-name" placeholder="Tên của bạn" type="text">
        <button id="rsvp-yes">Sẽ tham dự</button>
        <button id="rsvp-no">Không tham dự được</button>
        ${afterpartyFieldHtml(afterpartyNote)}
        <p id="rsvp-msg"></p>
    `

    async function submitRsvp(status){
        const guestName = document.getElementById("rsvp-name").value
        const joinAfterparty = document.getElementById("rsvp-afterparty")?.checked || false
        const msg = document.getElementById("rsvp-msg")
        if (!guestName) {
            msg.innerText = "Vui lòng nhập tên trước."
            return
        }
        const { error } = await supabaseClient
            .from("rsvps")
            .insert({ event_id: eventId, guest_name: guestName, status, join_afterparty: joinAfterparty, responded_at: new Date().toISOString() })

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

    // Render everything that doesn't need another network round-trip first,
    // in particular the music setup (musicControls) — renderCard() wires the
    // opening tap straight to musicControls.play(), so if that tap can
    // happen before this runs (e.g. while we're still awaiting get_guest
    // below), the first tap opens the card but the music call is a silent
    // no-op and the guest has to tap again.
    renderEventInfo(cardDATA[event.card_type]["title"], event.event_date, event.event_time, event.event_time_end, event.event_location, event.notes)
    renderCountdown(event.event_date, event.event_time)
    if (event.youtube_id) {
        renderYoutubeMusic(event.youtube_id, event.youtube_start, event.youtube_end)
    } else {
        renderMusic(event.music_url)
    }
    renderWishes()

    renderCard(event.card_type, event.template_no, event.host_name, event.message, event.photo_url)

    if (guestId) {
        const { data: guest, error: guestError } = await supabaseClient.rpc("get_guest", { p_guest_id: guestId }).single()
        if (!guestError && guest) {
            renderRsvpForGuest(guest, event.afterparty_note)
        }
    } else {
        renderRsvpGeneric(event.afterparty_note)
    }
}

init()
